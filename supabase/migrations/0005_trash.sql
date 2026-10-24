-- Kip — Trash: soft delete with 30-day retention (the client purges expired rows + their images).
-- Run after 0004_drop_seeded_categories.sql.

alter table public.items add column if not exists deleted_at timestamptz;
create index if not exists items_user_deleted_idx on public.items (user_id, deleted_at) where deleted_at is not null;

-- Free limit counts only items outside the trash.
create or replace function public.enforce_item_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare cnt int;
begin
  if public.is_pro(new.user_id) then return new; end if;
  perform pg_advisory_xact_lock(hashtext('items:' || new.user_id::text));
  select count(*) into cnt from items where user_id = new.user_id and deleted_at is null;
  if cnt >= 50 then
    raise exception 'FREE_LIMIT_REACHED' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- Restoring from the trash is subject to the same limit as a new insert.
drop trigger if exists items_limit_restore on public.items;
create trigger items_limit_restore before update of deleted_at on public.items
  for each row when (old.deleted_at is not null and new.deleted_at is null)
  execute function public.enforce_item_limit();
