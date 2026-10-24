# Kip App - Development Roadmap & Task List

## Phase 1: Authentication & Monetization
- [x] Implement Google (Gmail) OAuth Integration (code done — needs Google provider enabled in Supabase Dashboard)
- [x] Implement LINE Login Integration (code done — needs LINE_CHANNEL_ID/SECRET in Vercel env)
- [x] Define Free vs. Pro Plan limits — Free = 50 active items (DB trigger `enforce_item_limit` + client gate: locked + / paste / drop / share → upgrade sheet). Media storage cap per plan still open.
- [x] PromptPay QR + slip upload → admin review (`/admin` tab "ตรวจสลิป", migration `0006_payment_slips.sql`; needs migration run + `VITE_PROMPTPAY_ID`)
- [ ] Setup Automated Payment Status Management
- [x] Build Admin Dashboard for Manual Subscription Override (`/admin`, RPCs `admin_search_users` / `admin_set_plan`; first admin must be set via SQL)

## Phase 2: Mobile UX & Native Integration
- [x] Configure Web Share Target API in PWA — shared URL pre-fills the SaveSheet (`composerFromShare`), user reviews & saves manually
- [~] ~~Build Quick-Save background processing pipeline~~ — dropped (decision 2026-10-24: no background save). Quick Mode toggle in Settings/Pricing now has no effect → decide: remove or redefine
- [x] Create Onboarding Guide — `InstallGuide` modal (iOS Safari steps / Android one-tap install / Desktop), from Dashboard hint, Settings, InstallBanner "ดูวิธี". GIF/MP4 assets in `public/onboarding/` still missing (fallback animation shown)

## Phase 3: System Optimization & Backend Rules
- [ ] Implement Client-side Image Compression before uploading to Supabase Storage
- [ ] Enforce Item Limit checks via Supabase RLS / DB Functions based on Free/Pro status

## Phase 4: Mobile Testing & Production Validation
- [ ] Perform PWA end-to-end testing on real iOS and Android devices via Vercel Production
- [ ] Verify Service Worker caching and offline behavior
