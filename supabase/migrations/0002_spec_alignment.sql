-- Kip — align schema with spec §7 + admin dashboard (§6)
-- Run after 0001_init.sql.

-- ───────────────────────── profiles: email, role, subscription_tier ─────────────────────────
alter table public.profiles
  add column email text,
  add column role text not null default 'user' check (role in ('user', 'admin')),
  add column subscription_tier text not null default 'free' check (subscription_tier in ('free', 'pro'));

update public.profiles p set email = u.email from auth.users u where u.id = p.id;
update public.profiles set subscription_tier = 'pro' where pro_until > now();
create index profiles_email_idx on public.profiles (lower(email));

-- Pro = tier 'pro' and not expired. pro_until null with tier 'pro' = Lifetime.
create or replace function public.is_pro(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select subscription_tier = 'pro' and (pro_until is null or pro_until > now())
    from profiles where id = uid
  ), false);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid()), false);
$$;

create or replace function public.guard_quick_mode()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.quick_mode and not (new.subscription_tier = 'pro' and (new.pro_until is null or new.pro_until > now())) then
    raise exception 'PRO_REQUIRED' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- Keep profiles.email in sync with auth (e.g. email change).
create or replace function public.sync_profile_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update profiles set email = new.email where id = new.id;
  return new;
end $$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function public.sync_profile_email();

-- ───────────────────────── items: content_url, type 'text' ─────────────────────────
alter table public.items rename column url to content_url;
alter table public.items drop constraint items_type_check;
update public.items set type = 'text' where type = 'note';
alter table public.items add constraint items_type_check
  check (type in ('link', 'youtube', 'facebook', 'image', 'text'));

-- ───────────────────────── categories: is_default ─────────────────────────
alter table public.categories add column is_default boolean not null default false;
update public.categories set is_default = true where id in (
  select distinct on (user_id) id from public.categories where name = 'ทั่วไป' order by user_id, position
);
insert into public.categories (user_id, name, emoji, position, is_default)
select p.id, 'ทั่วไป', '📌', 99, true from public.profiles p
where not exists (select 1 from public.categories c where c.user_id = p.id and c.is_default);
create unique index categories_one_default on public.categories (user_id) where is_default;

-- The default category ('ทั่วไป') is the Quick Mode target — it can't be deleted
-- (except when the whole account is being deleted via cascade).
create or replace function public.protect_default_category()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.is_default and exists (select 1 from auth.users where id = old.user_id) then
    raise exception 'DEFAULT_CATEGORY' using errcode = 'P0001';
  end if;
  return old;
end $$;

create trigger categories_protect_default before delete on public.categories
  for each row execute function public.protect_default_category();

-- Users may not flip is_default themselves.
revoke update on public.categories from authenticated, anon;
grant update (name, emoji, position) on public.categories to authenticated;

-- ───────────────────────── subscriptions: start_date, expires_at, admin_note ─────────────────────────
alter table public.subscriptions rename column current_period_end to expires_at;
alter table public.subscriptions
  add column start_date timestamptz not null default now(),
  add column admin_note text;
update public.subscriptions set start_date = created_at;

-- Manual (admin) rows have no Stripe slot/tier/price.
alter table public.subscriptions
  alter column slot_number drop not null,
  alter column tier drop not null,
  alter column locked_price drop not null;
alter table public.subscriptions drop constraint subscriptions_billing_interval_check;
alter table public.subscriptions add constraint subscriptions_billing_interval_check
  check (billing_interval in ('month', 'year', 'lifetime'));
alter table public.subscriptions drop constraint subscriptions_payment_method_check;
alter table public.subscriptions add constraint subscriptions_payment_method_check
  check (payment_method in ('card', 'promptpay', 'manual'));

-- Tier counter only counts paid slots.
create or replace function public.get_pro_count()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from subscriptions where slot_number is not null;
$$;

create or replace function public.activate_pro(
  p_user uuid,
  p_tier int,
  p_interval text,
  p_price int,
  p_method text,
  p_period_end timestamptz,
  p_customer text default null,
  p_subscription text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_slot int; v_row subscriptions%rowtype; v_exists boolean;
begin
  perform pg_advisory_xact_lock(hashtext('pro_slots'));
  select * into v_row from subscriptions where user_id = p_user;
  v_exists := found;

  if v_exists and v_row.slot_number is not null then
    -- Renewal / re-subscribe: keep original tier & locked_price (grandfathering).
    update subscriptions set
      billing_interval = p_interval,
      locked_price = case when billing_interval = p_interval then locked_price else p_price end,
      payment_method = p_method,
      status = 'active',
      stripe_customer_id = coalesce(p_customer, stripe_customer_id),
      stripe_subscription_id = coalesce(p_subscription, stripe_subscription_id),
      expires_at = greatest(coalesce(expires_at, now()), p_period_end)
    where user_id = p_user;
  else
    select coalesce(max(slot_number), 0) + 1 into v_slot from subscriptions;
    if v_exists then
      -- First payment by a user who only had a manual (admin) row.
      update subscriptions set slot_number = v_slot, tier = p_tier, billing_interval = p_interval,
        locked_price = p_price, payment_method = p_method, status = 'active', start_date = now(),
        stripe_customer_id = p_customer, stripe_subscription_id = p_subscription, expires_at = p_period_end
      where user_id = p_user;
    else
      insert into subscriptions (user_id, slot_number, tier, billing_interval, locked_price,
        payment_method, stripe_customer_id, stripe_subscription_id, expires_at)
      values (p_user, v_slot, p_tier, p_interval, p_price, p_method, p_customer, p_subscription, p_period_end);
    end if;
  end if;

  update profiles set
    subscription_tier = 'pro',
    -- Lifetime (tier pro + null pro_until) is never shortened by a payment.
    pro_until = case when subscription_tier = 'pro' and pro_until is null then null
                     else greatest(coalesce(pro_until, now()), p_period_end) end,
    stripe_customer_id = coalesce(p_customer, stripe_customer_id)
  where id = p_user;
end $$;

revoke execute on function public.activate_pro from public, anon, authenticated;

-- ───────────────────────── payments (for "ยอดขายสะสม") ─────────────────────────
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  amount numeric(12, 2) not null,          -- THB
  payment_method text not null,
  stripe_ref text unique,                  -- checkout session / invoice id
  created_at timestamptz not null default now()
);
alter table public.payments enable row level security; -- service role only

-- ───────────────────────── feedback → feedbacks ─────────────────────────
alter table public.feedback rename to feedbacks;
alter table public.feedbacks rename column kind to type;
-- Guests (no account yet) may send feedback anonymously.
drop policy "insert own feedback" on public.feedbacks;
create policy "insert own feedback" on public.feedbacks for insert
  with check (user_id is not distinct from auth.uid());

-- ───────────────────────── new user bootstrap ─────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));

  insert into categories (user_id, name, emoji, position, is_default) values
    (new.id, 'ความรู้ / บทความ', '📚', 0, false),
    (new.id, 'บันเทิง / คลิปวิดีโอ', '🎬', 1, false),
    (new.id, 'งาน / โปรเจกต์', '💼', 2, false),
    (new.id, 'ช้อปปิ้ง / ของที่อยากได้', '🛍️', 3, false),
    (new.id, 'ทั่วไป', '📌', 4, true);
  return new;
end $$;

-- ───────────────────────── Admin RPCs (role = 'admin' only) ─────────────────────────
create or replace function public.admin_stats()
returns json language plpgsql stable security definer set search_path = public, storage as $$
begin
  if not is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return json_build_object(
    'total_users', (select count(*) from profiles),
    'pro_users', (select count(*) from profiles
                  where subscription_tier = 'pro' and (pro_until is null or pro_until > now())),
    'revenue_thb', (select coalesce(sum(amount), 0) from payments),
    'storage_bytes', (select coalesce(sum((metadata->>'size')::bigint), 0)
                      from storage.objects where bucket_id = 'kip-images')
  );
end $$;

create or replace function public.admin_search_users(q text)
returns table (
  id uuid, email text, role text, subscription_tier text, pro_until timestamptz,
  created_at timestamptz, item_count bigint, sub_status text, payment_method text, admin_note text
) language plpgsql stable security definer set search_path = public as $$
declare v_q text := trim(coalesce(q, ''));
begin
  if not is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select p.id, p.email, p.role, p.subscription_tier, p.pro_until, p.created_at,
      (select count(*) from items i where i.user_id = p.id),
      s.status, s.payment_method, s.admin_note
    from profiles p
    left join subscriptions s on s.user_id = p.id
    where v_q = ''
       or (v_q ~* '^[0-9a-f-]{36}$' and p.id = v_q::uuid)
       or p.email ilike '%' || v_q || '%'
    order by p.created_at desc
    limit 30;
end $$;

-- Manual Override: p_tier 'pro'|'free', p_duration 'month'|'year'|'lifetime'.
create or replace function public.admin_set_plan(p_user uuid, p_tier text, p_duration text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_until timestamptz;
begin
  if not is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_tier not in ('pro', 'free') then raise exception 'INVALID_TIER'; end if;

  if p_tier = 'free' then
    update profiles set subscription_tier = 'free', pro_until = null, quick_mode = false where id = p_user;
    update subscriptions set status = 'canceled', expires_at = now(), admin_note = p_note where user_id = p_user;
    return;
  end if;

  if p_duration not in ('month', 'year', 'lifetime') then raise exception 'INVALID_DURATION'; end if;
  v_until := case p_duration when 'month' then now() + interval '1 month'
                             when 'year' then now() + interval '1 year'
                             else null end;

  update profiles set subscription_tier = 'pro', pro_until = v_until where id = p_user;
  if not found then raise exception 'USER_NOT_FOUND'; end if;

  insert into subscriptions (user_id, billing_interval, payment_method, status, start_date, expires_at, admin_note)
  values (p_user, p_duration, 'manual', 'active', now(), v_until, p_note)
  on conflict (user_id) do update set
    status = 'active', start_date = now(), expires_at = v_until, admin_note = p_note,
    billing_interval = case when subscriptions.slot_number is null then p_duration else subscriptions.billing_interval end;
end $$;

revoke execute on function public.admin_stats, public.admin_search_users, public.admin_set_plan from public, anon;
grant execute on function public.admin_stats, public.admin_search_users, public.admin_set_plan to authenticated;
