-- Kip — no default categories / no Inbox, more item types.
-- Run after 0002_spec_alignment.sql.

-- ───────────────────────── items: instagram, tiktok, document ─────────────────────────
alter table public.items drop constraint items_type_check;
alter table public.items add constraint items_type_check
  check (type in ('link', 'youtube', 'facebook', 'image', 'text', 'instagram', 'tiktok', 'document'));

-- ───────────────────────── categories: user-created only ─────────────────────────
-- Uncategorised items simply have category_id = null. Quick Mode no longer targets 'ทั่วไป',
-- so the old default category becomes an ordinary, deletable one. Existing categories are kept.
drop trigger if exists categories_protect_default on public.categories;
drop function if exists public.protect_default_category();
update public.categories set is_default = false where is_default;

-- ───────────────────────── new user bootstrap: no seeded categories ─────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end $$;
