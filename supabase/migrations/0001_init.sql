-- Kip — initial schema
create extension if not exists pgcrypto;

-- ───────────────────────── profiles ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  pro_until timestamptz,                -- Pro is active while pro_until > now()
  quick_mode boolean not null default false,
  view_mode text not null default 'grid' check (view_mode in ('grid', 'list')),
  onboarded boolean not null default false,
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

create or replace function public.is_pro(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select pro_until > now() from profiles where id = uid), false);
$$;

-- ───────────────────────── categories ─────────────────────────
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  emoji text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index categories_user_idx on public.categories (user_id, position);

-- ───────────────────────── items ─────────────────────────
-- category_id null = Inbox
create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  category_id uuid references public.categories on delete set null,
  type text not null check (type in ('link', 'youtube', 'facebook', 'image', 'note')),
  url text,
  title text,
  description text,
  thumbnail_url text,
  site_name text,
  image_path text,
  note text,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index items_user_created_idx on public.items (user_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger items_touch before update on public.items
  for each row execute function public.touch_updated_at();

-- Free plan: max 50 items. Existing items are never deleted; only new inserts are blocked.
create or replace function public.enforce_item_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare cnt int;
begin
  if public.is_pro(new.user_id) then return new; end if;
  perform pg_advisory_xact_lock(hashtext('items:' || new.user_id::text));
  select count(*) into cnt from items where user_id = new.user_id;
  if cnt >= 50 then
    raise exception 'FREE_LIMIT_REACHED' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger items_limit before insert on public.items
  for each row execute function public.enforce_item_limit();

-- Quick Mode is Pro-only.
create or replace function public.guard_quick_mode()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.quick_mode and not coalesce(new.pro_until > now(), false) then
    raise exception 'PRO_REQUIRED' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger profiles_quick_mode before update of quick_mode on public.profiles
  for each row execute function public.guard_quick_mode();

-- ───────────────────────── subscriptions ─────────────────────────
-- One row per user who has ever paid. slot_number drives the tier counter and never
-- decreases, so tiers don't roll back when someone cancels.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users on delete cascade,
  slot_number int not null unique,
  tier int not null check (tier between 1 and 4),
  billing_interval text not null check (billing_interval in ('month', 'year')),
  locked_price int not null,            -- THB per billing_interval, grandfathered on renewal
  payment_method text not null check (payment_method in ('card', 'promptpay')),
  status text not null default 'active' check (status in ('active', 'canceled', 'past_due')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- Webhook idempotency
create table public.stripe_events (
  id text primary key,
  type text not null,
  created_at timestamptz not null default now()
);

-- Public counter for the pricing page (no personal data exposed).
create or replace function public.get_pro_count()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from subscriptions;
$$;

-- Called by the Stripe webhook (service role only).
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
declare v_slot int;
begin
  perform pg_advisory_xact_lock(hashtext('pro_slots'));

  if exists (select 1 from subscriptions where user_id = p_user) then
    -- Renewal / re-subscribe: keep original tier & locked_price (grandfathering).
    update subscriptions set
      billing_interval = p_interval,
      locked_price = case when billing_interval = p_interval then locked_price else p_price end,
      payment_method = p_method,
      status = 'active',
      stripe_customer_id = coalesce(p_customer, stripe_customer_id),
      stripe_subscription_id = coalesce(p_subscription, stripe_subscription_id),
      current_period_end = greatest(coalesce(current_period_end, now()), p_period_end)
    where user_id = p_user;
  else
    select coalesce(max(slot_number), 0) + 1 into v_slot from subscriptions;
    insert into subscriptions (user_id, slot_number, tier, billing_interval, locked_price,
      payment_method, stripe_customer_id, stripe_subscription_id, current_period_end)
    values (p_user, v_slot, p_tier, p_interval, p_price, p_method, p_customer, p_subscription, p_period_end);
  end if;

  update profiles set
    pro_until = greatest(coalesce(pro_until, now()), p_period_end),
    stripe_customer_id = coalesce(p_customer, stripe_customer_id)
  where id = p_user;
end $$;

revoke execute on function public.activate_pro from public, anon, authenticated;

-- ───────────────────────── feedback ─────────────────────────
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users on delete set null,
  kind text not null check (kind in ('suggestion', 'bug', 'rating')),
  message text check (char_length(message) <= 4000),
  rating int check (rating between 1 and 5),
  user_agent text,
  created_at timestamptz not null default now(),
  check (kind <> 'rating' or rating is not null)
);

-- ───────────────────────── new user bootstrap ─────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));

  insert into categories (user_id, name, emoji, position) values
    (new.id, 'ความรู้ / บทความ', '📚', 0),
    (new.id, 'บันเทิง / คลิปวิดีโอ', '🎬', 1),
    (new.id, 'งาน / โปรเจกต์', '💼', 2),
    (new.id, 'ช้อปปิ้ง / ของที่อยากได้', '🛍️', 3),
    (new.id, 'ทั่วไป', '📌', 4);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── RLS ─────────────────────────
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.subscriptions enable row level security;
alter table public.feedback enable row level security;
alter table public.stripe_events enable row level security; -- no policies: service role only

create policy "own profile read" on public.profiles for select using (id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid());
-- Users may only change preference columns, never billing fields.
revoke update on public.profiles from authenticated, anon;
grant update (display_name, quick_mode, view_mode, onboarded) on public.profiles to authenticated;

create policy "own categories" on public.categories for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own items" on public.items for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own subscription read" on public.subscriptions for select using (user_id = auth.uid());

create policy "insert own feedback" on public.feedback for insert with check (user_id = auth.uid());

grant execute on function public.get_pro_count() to anon, authenticated;

-- ───────────────────────── Storage ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kip-images', 'kip-images', false, 5242880, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

create policy "own images read" on storage.objects for select
  using (bucket_id = 'kip-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own images insert" on storage.objects for insert
  with check (bucket_id = 'kip-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own images delete" on storage.objects for delete
  using (bucket_id = 'kip-images' and (storage.foldername(name))[1] = auth.uid()::text);
