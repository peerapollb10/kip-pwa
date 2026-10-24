-- Kip — PromptPay QR + slip upload: the user pays via QR, uploads the slip, and an admin approves it.
-- Run after 0005_trash.sql.

-- ───────────────────────── server-side price (mirrors src/lib/pricing.js + api/checkout.js) ─────────────────────────
-- Grandfathering: returning subscribers keep their tier, and their locked price for the same interval.
create or replace function public.checkout_price(p_user uuid, p_interval text, out tier int, out amount int)
language plpgsql stable security definer set search_path = public as $$
declare v_sub subscriptions%rowtype; v_count int;
begin
  if p_interval not in ('month', 'year') then raise exception 'INVALID_INTERVAL'; end if;
  select * into v_sub from subscriptions where user_id = p_user;
  if v_sub.tier is not null then
    tier := v_sub.tier;
  else
    select count(*) into v_count from subscriptions where slot_number is not null;
    tier := case when v_count < 100 then 1 when v_count < 300 then 2 when v_count < 600 then 3 else 4 end;
  end if;
  if v_sub.locked_price is not null and v_sub.billing_interval = p_interval then
    amount := v_sub.locked_price;
  else
    amount := case p_interval when 'month' then (array[19, 29, 39, 49])[tier] else (array[190, 290, 390, 490])[tier] end;
  end if;
end $$;
revoke execute on function public.checkout_price from public, anon, authenticated;

-- ───────────────────────── payment_slips ─────────────────────────
create table public.payment_slips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  billing_interval text not null check (billing_interval in ('month', 'year')),
  tier int not null check (tier between 1 and 4),
  amount numeric(12, 2) not null,          -- THB, computed server-side
  slip_path text not null,                 -- payment-slips bucket: <user_id>/<uuid>.<ext>
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid references auth.users on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index payment_slips_status_idx on public.payment_slips (status, created_at);
-- One slip waiting for review per user.
create unique index payment_slips_one_pending on public.payment_slips (user_id) where status = 'pending';

alter table public.payment_slips enable row level security;
-- Users read their own slips; writes go through the RPCs below.
create policy "own slips read" on public.payment_slips for select using (user_id = auth.uid());

-- ───────────────────────── Storage: private bucket for slips ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-slips', 'payment-slips', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "own slips upload" on storage.objects for insert
  with check (bucket_id = 'payment-slips' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own or admin slips read" on storage.objects for select
  using (bucket_id = 'payment-slips' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "own slips delete" on storage.objects for delete
  using (bucket_id = 'payment-slips' and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────────────────────── user: submit a slip ─────────────────────────
-- p_amount is what the QR showed; a mismatch means the price changed while the user was paying.
create or replace function public.submit_payment_slip(p_interval text, p_amount numeric, p_slip_path text)
returns public.payment_slips language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_price record; v_row payment_slips%rowtype;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED' using errcode = '42501'; end if;
  if p_slip_path is null or split_part(p_slip_path, '/', 1) <> v_uid::text then raise exception 'INVALID_SLIP_PATH'; end if;
  if exists (select 1 from payment_slips where user_id = v_uid and status = 'pending') then
    raise exception 'SLIP_PENDING' using errcode = 'P0001';
  end if;
  select * into v_price from checkout_price(v_uid, p_interval);
  if p_amount is distinct from v_price.amount then raise exception 'PRICE_CHANGED' using errcode = 'P0001'; end if;

  insert into payment_slips (user_id, billing_interval, tier, amount, slip_path)
  values (v_uid, p_interval, v_price.tier, v_price.amount, p_slip_path)
  returning * into v_row;
  return v_row;
end $$;

-- ───────────────────────── admin: list + review ─────────────────────────
create or replace function public.admin_list_slips(p_status text default 'pending')
returns table (
  id uuid, user_id uuid, email text, display_name text, amount numeric, billing_interval text, tier int,
  slip_path text, status text, review_note text, created_at timestamptz, reviewed_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select s.id, s.user_id, p.email, p.display_name, s.amount, s.billing_interval, s.tier,
      s.slip_path, s.status, s.review_note, s.created_at, s.reviewed_at
    from payment_slips s
    left join profiles p on p.id = s.user_id
    where p_status is null or s.status = p_status
    order by case when s.status = 'pending' then s.created_at end asc, s.created_at desc
    limit 100;
end $$;

-- Approve → Pro for one billing period (extends an active plan; Lifetime stays Lifetime) + revenue row.
create or replace function public.admin_review_slip(p_slip uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_slip payment_slips%rowtype; v_from timestamptz;
begin
  if not is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into v_slip from payment_slips where id = p_slip for update;
  if not found then raise exception 'SLIP_NOT_FOUND'; end if;
  if v_slip.status <> 'pending' then raise exception 'SLIP_ALREADY_REVIEWED' using errcode = 'P0001'; end if;

  if p_approve then
    select greatest(coalesce(pro_until, now()), now()) into v_from from profiles where id = v_slip.user_id;
    perform activate_pro(
      v_slip.user_id, v_slip.tier, v_slip.billing_interval, v_slip.amount::int, 'promptpay',
      coalesce(v_from, now()) + case v_slip.billing_interval when 'month' then interval '1 month' else interval '1 year' end
    );
    insert into payments (user_id, amount, payment_method, stripe_ref)
    values (v_slip.user_id, v_slip.amount, 'promptpay_slip', 'slip:' || v_slip.id);
  end if;

  update payment_slips set
    status = case when p_approve then 'approved' else 'rejected' end,
    review_note = nullif(trim(coalesce(p_note, '')), ''),
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where id = p_slip;
end $$;

revoke execute on function public.submit_payment_slip, public.admin_list_slips, public.admin_review_slip from public, anon;
grant execute on function public.submit_payment_slip, public.admin_list_slips, public.admin_review_slip to authenticated;
