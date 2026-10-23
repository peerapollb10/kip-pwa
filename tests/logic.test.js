import test from 'node:test';
import assert from 'node:assert/strict';
import { getPricingStatus, resolveCheckoutPrice, isPro } from '../src/lib/pricing.js';
import { detectPlatform } from '../src/lib/device.js';
import { draftFromShare, getYouTubeId, detectType } from '../src/lib/content.js';
import { loadGuest, saveGuest, clearGuest, hasGuestData, newGuestItem } from '../src/lib/guestStore.js';
import { safePath, emailForLine } from '../api/_lib/line.js';

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

test('guest store: seeds defaults incl. ทั่วไป, detects real data', () => {
  const s = memoryStorage();
  const g = loadGuest(s);
  assert.equal(g.categories.filter((c) => c.is_default).length, 1);
  assert.equal(g.categories.find((c) => c.is_default).name, 'ทั่วไป');
  assert.equal(hasGuestData(s), false);
  saveGuest({ ...g, items: [newGuestItem({ type: 'link', url: 'https://a.co' }, g.categories[0].id)] }, s);
  assert.equal(hasGuestData(s), true);
  assert.equal(loadGuest(s).items[0].content_url, 'https://a.co');
  clearGuest(s);
  assert.equal(hasGuestData(s), false);
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
  assert.equal(detectType({}), 'text');

  const d = draftFromShare({ title: '', text: 'ดูอันนี้ https://youtu.be/dQw4w9WgXcQ', url: '' });
  assert.equal(d.type, 'youtube');
  assert.equal(d.url, 'https://youtu.be/dQw4w9WgXcQ');
  assert.equal(d.note, 'ดูอันนี้');

  const n = draftFromShare({ text: 'ซื้อนมก่อนกลับบ้าน' });
  assert.equal(n.type, 'text');
  assert.equal(n.note, 'ซื้อนมก่อนกลับบ้าน');
});
