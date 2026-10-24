-- Kip — remove the categories older sign-ups were seeded with. Run after 0003_no_default_categories.sql.
-- Only empty ones go; a seeded category the user actually filed items into is kept.
delete from public.categories c
where c.name in ('ความรู้ / บทความ', 'บันเทิง / คลิปวิดีโอ', 'งาน / โปรเจกต์', 'ช้อปปิ้ง / ของที่อยากได้', 'ทั่วไป')
  and not exists (select 1 from public.items i where i.category_id = c.id);
