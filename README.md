# Kip — Personal Content Vault (PWA)

React (Vite) + Tailwind · Supabase (DB/Auth/Storage/Edge Functions) · Stripe (Card + PromptPay) · Vercel

## Setup
1. `npm install`
2. Supabase
   - รัน `supabase/migrations/0001_init.sql` → `0002_spec_alignment.sql` → `0003_no_default_categories.sql` → `0004_drop_seeded_categories.sql` ใน SQL Editor (หรือ `supabase db push`)
   - Auth → เปิด Google provider, ตั้ง Site URL / Redirect URLs เป็นโดเมน Vercel (รวม `/**`)
   - Edge Function: `supabase functions deploy og-metadata` (ดึง OG metadata แทน browser เพื่อเลี่ยง CORS)
   - ตั้ง admin: `update profiles set role = 'admin' where email = 'you@gmail.com';`
3. LINE Login: สร้าง LINE Login channel → Callback URL `https://<domain>/api/auth/line-callback`, ขอสิทธิ์ Email (OpenID Connect) แล้วใส่ `LINE_CHANNEL_ID` / `LINE_CHANNEL_SECRET` ใน Vercel env
4. คัดลอก `.env.example` → `.env.local` แล้วใส่ค่า (ตัวแปร `VITE_*` เท่านั้นที่ไปฝั่ง browser)
5. Stripe: เปิด PromptPay ใน Dashboard (บัญชีไทย, THB), สร้าง webhook → `https://<domain>/api/stripe-webhook`
   events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`
6. `npm run dev` (ฟังก์ชัน `/api/*` ต้องรันด้วย `vercel dev`) · `npm test` = unit test
7. Playwright (mobile viewport Pixel 7 + iPhone 14): `npm run test:e2e:install` ครั้งแรก แล้ว `npm run test:e2e` → ภาพอยู่ที่ `e2e/screenshots/`
   ทดสอบลิงก์จริงบน Vercel: `E2E_BASE_URL=https://<domain> npm run test:e2e`

## Assets ที่ต้องเพิ่ม
- `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`
- `public/onboarding/*.mp4` (คลิปวนลูปไร้เสียง: ios-install, ios-share, android-install, android-share, save, desktop-install, desktop-drag, desktop-paste) — ถ้าไม่มีไฟล์จะแสดงภาพเคลื่อนไหว CSS แทน
- `VITE_IOS_SHORTCUT_URL` — ลิงก์ iCloud ของ iOS Shortcut “Save to Kip” ที่เปิด `https://<domain>/share?text=<Shortcut Input>`

## Notes
- **Guest Mode**: เปิดแอปใช้ได้ทันทีโดยไม่ล็อกอิน ข้อมูลเก็บใน localStorage (`kip.guest.v1`, รูปเป็น WebP data URL) — เมื่อล็อกอินด้วย Gmail/LINE จะ migrate ขึ้น Supabase อัตโนมัติ (หมวดจับคู่ตามชื่อ, รายการที่เกินโควตาฟรีจะค้างไว้ในเครื่อง)
- **Auth providers**: ตั้งค่าที่ `src/lib/auth.js` (`AUTH_PROVIDERS`: `flow: 'supabase'` = Supabase OAuth, `'redirect'` = endpoint ของเราเอง) · ปุ่มแบรนด์ทางการอยู่ที่ `src/components/AuthButtons.jsx`
- **LINE**: ไม่ใช่ provider ในตัวของ Supabase → `/api/auth/line` + `/api/auth/line-callback` ยืนยัน id_token กับ LINE แล้วสร้าง/หา user ด้วย service role และส่ง magic link เข้าสู่ระบบ ถ้า LINE ไม่ให้อีเมลจะใช้ `line_<userId>@line.kip.invalid`
- **Pro** = `profiles.subscription_tier = 'pro'` และ (`pro_until` เป็น null = Lifetime หรือยังไม่หมดอายุ)
- Free = 50 รายการ บังคับที่ DB trigger (`enforce_item_limit`) — ข้อมูลเดิมไม่ถูกลบ
- หมวดหมู่: ไม่มีหมวดเริ่มต้นและไม่มี Inbox — ผู้ใช้สร้างเอง (Settings หรือปุ่ม ＋ ตอนเซฟ/ในการ์ด), ไม่เลือกหมวด = `category_id` null · แถบกรองหมวดซ่อนจนกว่าจะมีหมวดแรก
- Quick Mode (Pro): ข้ามหน้าเลือกหมวด เซฟแบบไม่มีหมวด (null)
- ประเภท: `link` (Web Link), `youtube`, `facebook`, `instagram`, `tiktok`, `document`, `image`, `text` (โน้ต) — Filter ประเภทเลือกได้หลายอัน
  - `instagram` / `tiktok` / `document` ปิดเป็นค่าเริ่มต้น เปิดได้ใน Settings → "ประเภทคอนเทนต์เสริม" (`localStorage` `kip.types`, ต่ออุปกรณ์) — ตอนปิดอยู่จะไม่แสดงใน Filter และลิงก์ประเภทนั้นเซฟเป็น `link`
  - หมวดหมู่ที่ระบบเคย seed ไว้ (เช่น 'ทั่วไป') ถูกลบอัตโนมัติถ้ายังว่าง (Guest: ตอนโหลด, บัญชี: migration 0004)
- ธีม: Light เป็นค่าเริ่มต้น สลับ Dark ได้ใน Settings (`localStorage` `kip.theme`, Tailwind `darkMode: 'class'`)
- แถบจำนวนรายการ x/50 แสดงเฉพาะเมื่อ > 40 รายการ (`ITEM_COUNT_THRESHOLD`)
- Admin: `/admin` — ค้นหา user (email/ID), Manual Override (Pro/Free + 1 เดือน/1 ปี/Lifetime + note), สถิติ (ผู้ใช้, Pro, ยอดขายจากตาราง `payments`, Storage)
- Tier counter = จำนวนแถว `subscriptions` ที่มี `slot_number` (แถวที่ admin ให้ฟรีไม่นับ); `locked_price` + `tier` ใช้ล็อกราคาตอนต่ออายุ
- iOS ไม่รองรับ Web Share Target → ใช้ iOS Shortcut ส่งไปที่ `/share?url=...` (GET) แทน · Android/desktop: manifest `share_target` POST → `/share` (service worker รับ)
