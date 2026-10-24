import test from 'node:test';
import assert from 'node:assert/strict';
import { getPricingStatus, resolveCheckoutPrice, isPro, showItemCount } from '../src/lib/pricing.js';
import { detectPlatform, isIOSSafari } from '../src/lib/device.js';
import { composerFromShare, draftFromShare, getYouTubeId, detectType, ITEM_TYPES, visibleItemTypes } from '../src/lib/content.js';
import { getEnabledTypes, setEnabledTypes } from '../src/lib/typePrefs.js';
import { loadGuest, saveGuest, clearGuest, hasGuestData, newGuestItem, newGuestCategory } from '../src/lib/guestStore.js';
import { getTheme } from '../src/lib/theme.js';
import { isExpired, daysLeft, TRASH_RETENTION_DAYS } from '../src/lib/trash.js';
import { safePath, emailForLine } from '../api/_lib/line.js';
import { AUTH_PROVIDERS, PROVIDER_ORDER, authStatus, describeUser, loginErrorMessage } from '../src/lib/auth.js';

test('auth providers: Google via Supabase OAuth, LINE via our redirect endpoint', () => {
  assert.deepEqual(PROVIDER_ORDER, ['google', 'line']);
  assert.equal(AUTH_PROVIDERS.google.flow, 'supabase');
  assert.equal(AUTH_PROVIDERS.line.flow, 'redirect');
  assert.equal(AUTH_PROVIDERS.line.endpoint, '/api/auth/line');
});

test('authStatus: loading / guest / member', () => {
  assert.equal(authStatus(undefined), 'loading');
  assert.equal(authStatus(null), 'guest');
  assert.equal(authStatus({ user: { id: 'u1' } }), 'member');
});

test('describeUser: provider, name and hidden LINE placeholder email', () => {
  assert.equal(describeUser(null), null);
  const g = describeUser({ email: 'a@gmail.com', app_metadata: { provider: 'google' }, user_metadata: { full_name: 'Ann', avatar_url: 'https://x/a.png' } });
  assert.deepEqual([g.provider, g.providerName, g.name, g.email, g.avatarUrl, g.initial], ['google', 'Google', 'Ann', 'a@gmail.com', 'https://x/a.png', 'A']);
  const l = describeUser({ email: 'line_U1@line.kip.invalid', app_metadata: { provider: 'email' }, user_metadata: { provider: 'line', line_user_id: 'U1', full_name: 'บี' } });
  assert.deepEqual([l.provider, l.providerName, l.email, l.initial], ['line', 'LINE', null, 'บ']);
  assert.equal(describeUser({ email: 'c@x.com', user_metadata: {} }).name, 'c');
});

test('login error codes map to Thai messages', () => {
  assert.equal(loginErrorMessage(null), null);
  assert.equal(loginErrorMessage('LINE_CANCELLED'), 'ยกเลิกการเข้าสู่ระบบด้วย LINE');
  assert.equal(loginErrorMessage('???'), 'เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง');
});

test('tier boundaries', () => {
  assert.equal(getPricingStatus(0).tier, 1);
  assert.equal(getPricingStatus(99).tier, 1); // user #100 still tier 1
  assert.equal(getPricingStatus(100).tier, 2); // user #101
  assert.equal(getPricingStatus(299).tier, 2);
  assert.equal(getPricingStatus(300).tier, 3);
  assert.equal(getPricingStatus(599).tier, 3);
  assert.equal(getPricingStatus(600).tier, 4);
  assert.deepEqual(getPricingStatus(5000).price, { month: 49, year: 490 });
  assert.deepEqual(getPricingStatus(150).price, { month: 29, year: 290 });
});

test('urgency only when <= 50 slots remain', () => {
  assert.equal(getPricingStatus(49).showUrgency, false); // 51 left
  assert.equal(getPricingStatus(50).showUrgency, true); // 50 left
  assert.equal(getPricingStatus(68).remaining, 32);
  assert.equal(getPricingStatus(68).progress, 0.68);
  assert.equal(getPricingStatus(100).showUrgency, false); // 200 left in tier 2
  assert.equal(getPricingStatus(250).showUrgency, true);
  assert.equal(getPricingStatus(700).showUrgency, false); // tier 4 unlimited
  assert.equal(getPricingStatus(700).remaining, null);
});

test('grandfathering keeps locked tier price', () => {
  assert.deepEqual(resolveCheckoutPrice({ proCount: 900, interval: 'month', lockedTier: 1 }), { tier: 1, amount: 19 });
  assert.deepEqual(resolveCheckoutPrice({ proCount: 120, interval: 'year' }), { tier: 2, amount: 290 });
  assert.throws(() => resolveCheckoutPrice({ proCount: 1, interval: 'week' }));
});

test('isPro', () => {
  const now = new Date('2026-10-22T00:00:00Z');
  assert.equal(isPro({ subscription_tier: 'pro', pro_until: '2026-11-01T00:00:00Z' }, now), true);
  assert.equal(isPro({ subscription_tier: 'pro', pro_until: '2026-10-01T00:00:00Z' }, now), false);
  assert.equal(isPro({ subscription_tier: 'pro', pro_until: null }, now), true); // Lifetime
  assert.equal(isPro({ subscription_tier: 'free', pro_until: '2026-11-01T00:00:00Z' }, now), false);
  assert.equal(isPro(null, now), false);
});

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('guest store: no default categories, uncategorised = null, detects real data', () => {
  const s = memoryStorage();
  const g = loadGuest(s);
  assert.deepEqual(g.categories, []);
  assert.equal(hasGuestData(s), false);
  saveGuest({ ...g, items: [newGuestItem({ type: 'link', url: 'https://a.co' }, null)] }, s);
  assert.equal(hasGuestData(s), true);
  assert.equal(loadGuest(s).items[0].content_url, 'https://a.co');
  assert.equal(loadGuest(s).items[0].category_id, null);
  clearGuest(s);
  assert.equal(hasGuestData(s), false);

  // A user-created category alone is worth migrating; an untouched legacy seed is not.
  saveGuest({ ...g, categories: [newGuestCategory('อ่านทีหลัง', '📖', 0)] }, s);
  assert.equal(hasGuestData(s), true);
  const legacy = ['ความรู้ / บทความ', 'บันเทิง / คลิปวิดีโอ', 'งาน / โปรเจกต์', 'ช้อปปิ้ง / ของที่อยากได้', 'ทั่วไป'];
  saveGuest({ ...g, categories: legacy.map((name, i) => newGuestCategory(name, null, i)) }, s);
  assert.equal(hasGuestData(s), false);
  assert.deepEqual(loadGuest(s).categories, []); // empty seeded categories are dropped on load

  // ...but a seeded category that holds an item is kept.
  const kept = newGuestCategory('ทั่วไป', '📌', 0);
  saveGuest({ ...g, categories: [kept], items: [newGuestItem({ type: 'text', note: 'x' }, kept.id)] }, s);
  assert.deepEqual(loadGuest(s).categories.map((c) => c.name), ['ทั่วไป']);
});

test('optional content types are off by default', () => {
  const s = memoryStorage();
  assert.deepEqual(getEnabledTypes(s), []);
  assert.deepEqual(visibleItemTypes([]).map(([t]) => t), ['facebook', 'text', 'image', 'youtube', 'link']);
  assert.equal(detectType({ url: 'https://www.instagram.com/p/Cxyz/' }, []), 'link');
  assert.equal(draftFromShare({ text: 'https://vt.tiktok.com/ZSabc/' }, []).type, 'link');

  setEnabledTypes(['tiktok', 'bogus'], s);
  assert.deepEqual(getEnabledTypes(s), ['tiktok']);
  assert.deepEqual(visibleItemTypes(['tiktok']).map(([t]) => t).slice(-1), ['tiktok']);
  assert.equal(detectType({ url: 'https://vt.tiktok.com/ZSabc/' }, ['tiktok']), 'tiktok');
  assert.equal(detectType({ url: 'https://example.com/a.pdf' }, ['tiktok']), 'link');
});

test('item count bar only above 40 items', () => {
  assert.equal(showItemCount(0), false);
  assert.equal(showItemCount(40), false);
  assert.equal(showItemCount(41), true);
  assert.equal(showItemCount(50), true);
});

test('theme defaults to light', () => {
  const s = memoryStorage();
  assert.equal(getTheme(s), 'light');
  s.setItem('kip.theme', 'dark');
  assert.equal(getTheme(s), 'dark');
  s.setItem('kip.theme', 'bogus');
  assert.equal(getTheme(s), 'light');
});

test('guest store: quota error is surfaced', () => {
  const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} };
  assert.throws(() => saveGuest({ items: [] }, full), (e) => e.code === 'QUOTA_EXCEEDED');
});

test('LINE helpers', () => {
  assert.equal(safePath('/share?x=1'), '/share?x=1');
  assert.equal(safePath('//evil.com'), '/');
  assert.equal(safePath('https://evil.com'), '/');
  assert.equal(safePath(undefined), '/');
  assert.equal(emailForLine({ email: 'A@B.com', sub: 'U1' }), 'a@b.com');
  assert.equal(emailForLine({ sub: 'U1' }), 'line_U1@line.kip.invalid');
});

test('platform detection', () => {
  assert.equal(detectPlatform({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }), 'ios');
  assert.equal(detectPlatform({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 }), 'ios');
  assert.equal(detectPlatform({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' }), 'android');
  assert.equal(detectPlatform({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32' }), 'desktop');
});

test('content detection', () => {
  assert.equal(getYouTubeId('https://youtu.be/dQw4w9WgXcQ?si=abc'), 'dQw4w9WgXcQ');
  assert.equal(getYouTubeId('https://m.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(getYouTubeId('https://www.youtube.com/shorts/abcDEF12345'), 'abcDEF12345');
  assert.equal(detectType({ url: 'https://www.facebook.com/share/p/123' }), 'facebook');
  assert.equal(detectType({ url: 'https://example.com' }), 'link');
  assert.equal(detectType({ url: 'https://www.instagram.com/p/Cxyz/' }), 'instagram');
  assert.equal(detectType({ url: 'https://vt.tiktok.com/ZSabc/' }), 'tiktok');
  assert.equal(detectType({ url: 'https://www.tiktok.com/@a/video/1' }), 'tiktok');
  assert.equal(detectType({ url: 'https://example.com/files/report.PDF' }), 'document');
  assert.equal(detectType({ url: 'https://docs.google.com/document/d/abc/edit' }), 'document');
  assert.equal(detectType({ url: 'https://notinstagram.com/x' }), 'link');
  assert.equal(detectType({}), 'text');
  assert.equal(ITEM_TYPES.length, 8);

  const d = draftFromShare({ title: '', text: 'ดูอันนี้ https://youtu.be/dQw4w9WgXcQ', url: '' });
  assert.equal(d.type, 'youtube');
  assert.equal(d.url, 'https://youtu.be/dQw4w9WgXcQ');
  assert.equal(d.note, 'ดูอันนี้');

  const n = draftFromShare({ text: 'ซื้อนมก่อนกลับบ้าน' });
  assert.equal(n.type, 'text');
  assert.equal(n.note, 'ซื้อนมก่อนกลับบ้าน');
});

test('trash keeps items for 30 days', () => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.UTC(2026, 9, 24);
  const at = (d) => ({ deleted_at: new Date(now - d * day).toISOString() });
  assert.equal(TRASH_RETENTION_DAYS, 30);
  assert.equal(isExpired({ deleted_at: null }, now), false);
  assert.equal(isExpired(at(29.9), now), false);
  assert.equal(isExpired(at(30), now), true);
  assert.equal(daysLeft(at(0), now), 30);
  assert.equal(daysLeft(at(29.5), now), 1);
  assert.equal(daysLeft(at(45), now), 0);
});

test('promptpay: CRC-16/CCITT-FALSE check value', async () => {
  const { crc16 } = await import('../src/lib/promptpay.js');
  assert.equal(crc16('123456789'), '29B1');
});

test('promptpay: payload matches dtinth/promptpay-qr reference vectors', async () => {
  const { buildPromptPayPayload } = await import('../src/lib/promptpay.js');
  assert.equal(buildPromptPayPayload('0801234567'), '00020101021129370016A000000677010111011300668012345675802TH530376463046197');
  assert.equal(buildPromptPayPayload('+66-89-123-4567'), '00020101021129370016A000000677010111011300668912345675802TH5303764630429C1');
  assert.equal(buildPromptPayPayload('1-1111-11111-11-1'), '00020101021129370016A000000677010111021311111111111115802TH530376463047B5A');
  assert.equal(buildPromptPayPayload('0123456789012'), '00020101021129370016A000000677010111021301234567890125802TH530376463040CBD');
  assert.equal(buildPromptPayPayload('012345678901234'), '00020101021129390016A00000067701011103150123456789012345802TH530376463049781');
  assert.equal(buildPromptPayPayload('000-000-0000', 4.22), '00020101021229370016A000000677010111011300660000000005802TH530376454044.226304E469');
});

test('promptpay: national ID / e-wallet targets, invalid IDs rejected, formatting', async () => {
  const { buildPromptPayPayload, promptPayTarget, isValidPromptPayId, formatPromptPayId, slipErrorMessage } = await import('../src/lib/promptpay.js');
  assert.deepEqual(promptPayTarget('1234567890123'), ['02', '1234567890123']);
  assert.deepEqual(promptPayTarget('123456789012345'), ['03', '123456789012345']);
  assert.equal(isValidPromptPayId('12345'), false);
  assert.equal(isValidPromptPayId(''), false);
  assert.throws(() => buildPromptPayPayload('12345', 19), /INVALID_PROMPTPAY_ID/);
  const idPayload = buildPromptPayPayload('1234567890123', 190);
  assert.ok(idPayload.includes('29370016A00000067701011102131234567890123'));
  assert.ok(idPayload.includes('5406190.00'));
  assert.equal(formatPromptPayId('0812345678'), '081-234-5678');
  assert.equal(formatPromptPayId('1234567890123'), '1-2345-67890-12-3');
  assert.equal(slipErrorMessage(new Error('PRICE_CHANGED')), 'ราคามีการเปลี่ยนแปลง กรุณาปิดแล้วเปิดหน้านี้ใหม่ก่อนโอน');
  assert.equal(slipErrorMessage(new Error('boom')), 'ส่งสลิปไม่สำเร็จ ลองใหม่อีกครั้ง');
  assert.equal(slipErrorMessage(new Error('IMAGE_UNSUPPORTED')), 'อ่านไฟล์รูปนี้ไม่ได้ กรุณาใช้ไฟล์ JPG หรือ PNG');
});

test('image: size targets in KB, width cap, skip re-encoding already-optimal files', async () => {
  const { PROFILES, longestSideFor, isAlreadyOptimized, extFor } = await import('../src/lib/image.js');
  assert.equal(PROFILES.content.maxSizeKB, 300);
  assert.equal(PROFILES.slip.maxSizeKB, 500);
  assert.ok(PROFILES.slip.quality > PROFILES.content.quality);
  // 4000×3000 landscape → width 1200 → longest side 1200; 1080×2400 phone slip stays as-is
  assert.equal(longestSideFor(4000, 3000), 1200);
  assert.equal(longestSideFor(3000, 4000), 1600);
  assert.equal(longestSideFor(1080, 2400), 2400);
  const small = { type: 'image/webp', size: 120 * 1024, width: 1080 };
  assert.equal(isAlreadyOptimized(small), true);
  assert.equal(isAlreadyOptimized({ ...small, type: 'image/png' }), false);
  assert.equal(isAlreadyOptimized({ ...small, size: 400 * 1024 }), false);
  assert.equal(isAlreadyOptimized({ ...small, size: 400 * 1024 }, PROFILES.slip), true);
  assert.equal(isAlreadyOptimized({ ...small, width: 3000 }), false);
  assert.equal(extFor('image/webp'), 'webp');
  assert.equal(extFor('image/jpeg'), 'jpg');
});

test('composerFromShare: URL goes to the composer, leftover text to the note, no duplicates', () => {
  // Android Chrome: title + url, text repeats the title
  assert.deepEqual(composerFromShare({ title: 'Cool Page', text: 'Cool Page', url: 'https://ex.com/a' }), { title: 'Cool Page', text: 'https://ex.com/a', note: '', file: null });
  // URL inside text only (YouTube / LINE style)
  assert.deepEqual(composerFromShare({ text: 'ดูอันนี้ https://youtu.be/abc123xyz' }), { title: '', text: 'https://youtu.be/abc123xyz', note: 'ดูอันนี้', file: null });
  // url param + same URL repeated in text
  assert.equal(composerFromShare({ text: 'https://ex.com/a', url: 'https://ex.com/a' }).note, '');
  // plain text share stays in the composer as a note
  assert.deepEqual(composerFromShare({ text: 'ซื้อนม' }), { title: '', text: 'ซื้อนม', note: '', file: null });
});

test('isIOSSafari: only real Safari on iOS', () => {
  const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';
  assert.equal(isIOSSafari({ userAgent: `${ios} Version/17.0 Mobile/15E148 Safari/604.1` }), true);
  assert.equal(isIOSSafari({ userAgent: `${ios} CriOS/120.0 Mobile/15E148 Safari/604.1` }), false);
  assert.equal(isIOSSafari({ userAgent: `${ios} Mobile/15E148 Safari Line/13.0.0` }), false);
  assert.equal(isIOSSafari({ userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36' }), false);
});
