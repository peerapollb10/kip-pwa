import { test, expect } from '@playwright/test';

const shot = (page, name) => page.screenshot({ path: `e2e/screenshots/${test.info().project.name}-${name}.png`, fullPage: true });

// Skip onboarding by pre-seeding the guest profile.
async function startAsOnboardedGuest(page, { categories = [{ id: 'c1', name: 'ความรู้ของฉัน', emoji: '📚', position: 0, is_default: false }], items = [], enabledTypes = [] } = {}) {
  await page.addInitScript(
    ({ categories, items, enabledTypes }) => {
      if (localStorage.getItem('kip.guest.v1')) return;
      localStorage.setItem('kip.types', JSON.stringify(enabledTypes));
      localStorage.setItem(
        'kip.guest.v1',
        JSON.stringify({
          profile: { view_mode: 'grid', onboarded: true, quick_mode: false, subscription_tier: 'free', pro_until: null, role: 'user' },
          categories,
          items,
        }),
      );
    },
    { categories, items, enabledTypes },
  );
}

const fakeItem = (i, type) => ({
  id: `i${i}`, type, content_url: type === 'text' ? null : `https://example.com/${i}`, title: `รายการ ${i}`, note: null,
  description: null, thumbnail_url: null, site_name: null, image_url: null, image_path: null, category_id: null,
  is_favorite: false, created_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
});

test('first visit opens onboarding without a login wall', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole('button', { name: 'ข้าม' })).toBeVisible();
  await shot(page, '01-onboarding');
  await page.getByRole('button', { name: 'ข้าม' }).click();
  await expect(page.getByTestId('guest-banner')).toHaveCount(0);
});

test('guest can save a note that persists after reload', async ({ page }) => {
  await startAsOnboardedGuest(page);
  await page.goto('/');
  await expect(page.getByTestId('guest-banner')).toHaveCount(0);
  await expect(page.getByText('ยังไม่มีอะไรใน Kip')).toBeVisible();
  await shot(page, '02-guest-empty');

  await page.getByRole('button', { name: 'เพิ่มรายการใหม่' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByPlaceholder('วางลิงก์ หรือพิมพ์โน้ต...').fill('ซื้อนมก่อนกลับบ้าน');
  await sheet.getByRole('button', { name: /ความรู้/ }).click();
  await shot(page, '03-save-sheet');
  await sheet.getByRole('button', { name: 'เซฟ', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'ซื้อนมก่อนกลับบ้าน' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'ซื้อนมก่อนกลับบ้าน' })).toBeVisible();
  await shot(page, '04-guest-with-item');
});

test('no categories: no Inbox, category filter hidden, + creates one from the save sheet', async ({ page }) => {
  await startAsOnboardedGuest(page, { categories: [] });
  await page.goto('/');
  await expect(page.getByTestId('type-filter')).toBeVisible();
  await expect(page.getByTestId('category-filter')).toHaveCount(0);
  await expect(page.getByText('Inbox')).toHaveCount(0);
  await expect(page.getByTestId('item-count-bar')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveClass(/dark/); // Light by default

  await page.getByRole('button', { name: 'เพิ่มรายการใหม่' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByPlaceholder('วางลิงก์ หรือพิมพ์โน้ต...').fill('โน้ตไม่มีหมวด');
  await sheet.getByRole('button', { name: 'สร้างหมวดหมู่ใหม่' }).click();
  await sheet.getByPlaceholder('ชื่อหมวดหมู่ใหม่').fill('อ่านทีหลัง');
  await sheet.getByRole('button', { name: 'เพิ่ม', exact: true }).click();
  await expect(sheet.getByRole('button', { name: /อ่านทีหลัง/ })).toHaveClass(/chip-on/);
  await shot(page, '07-save-sheet-new-category');
  await sheet.getByRole('button', { name: 'เซฟ', exact: true }).click();
  await expect(page.getByTestId('category-filter')).toBeVisible();
});

test('type filter is multi-select and count bar shows only above 40 items', async ({ page }) => {
  const types = ['text', 'youtube', 'instagram'];
  await startAsOnboardedGuest(page, { categories: [], items: Array.from({ length: 41 }, (_, i) => fakeItem(i, types[i % 3])), enabledTypes: ['instagram'] });
  await page.goto('/');
  await expect(page.getByTestId('item-count-bar')).toContainText('41/50');

  const filter = page.getByTestId('type-filter');
  await filter.getByRole('button', { name: 'YouTube' }).click();
  await expect(page.getByRole('heading', { name: /^รายการ/ })).toHaveCount(14);
  await filter.getByRole('button', { name: 'Instagram' }).click();
  await expect(page.getByRole('heading', { name: /^รายการ/ })).toHaveCount(27);
  await shot(page, '08-type-filter');
  await filter.getByRole('button', { name: 'ทั้งหมด' }).click();
  await expect(page.getByRole('heading', { name: /^รายการ/ })).toHaveCount(41);
});

test('free plan at 50 items: + is locked and opens the upgrade sheet instead of the save sheet', async ({ page }) => {
  await startAsOnboardedGuest(page, { categories: [], items: Array.from({ length: 50 }, (_, i) => fakeItem(i, 'text')) });
  await page.goto('/');
  await expect(page.getByTestId('item-count-bar')).toContainText('50/50');
  const fab = page.getByTestId('fab');
  await expect(fab).toHaveAttribute('data-locked', 'true');

  await fab.click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByTestId('limit-reached')).toContainText('50/50');
  await expect(sheet.getByPlaceholder('วางลิงก์ หรือพิมพ์โน้ต...')).toHaveCount(0);
  await shot(page, '14-limit-reached');

  // Paste outside inputs is blocked the same way.
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await page.evaluate(() => {
    const e = new Event('paste', { bubbles: true, cancelable: true });
    e.clipboardData = { files: [], getData: () => 'https://example.com/new' };
    window.dispatchEvent(e);
  });
  await expect(page.getByTestId('limit-reached')).toBeVisible();
  await expect(page.getByPlaceholder('วางลิงก์ หรือพิมพ์โน้ต...')).toHaveCount(0);
});

test('IG / TikTok / Document stay out of the filter until enabled in settings', async ({ page }) => {
  await startAsOnboardedGuest(page);
  await page.goto('/');
  const filter = page.getByTestId('type-filter');
  for (const name of ['Facebook', 'โน้ต', 'รูปภาพ', 'YouTube']) await expect(filter.getByRole('button', { name })).toBeVisible();
  for (const name of ['Instagram', 'TikTok', 'Document']) await expect(filter.getByRole('button', { name })).toHaveCount(0);

  await page.goto('/settings');
  await page.getByRole('switch', { name: 'TikTok' }).click();
  await expect(page.getByRole('switch', { name: 'TikTok' })).toHaveAttribute('aria-checked', 'true');
  await shot(page, '10-settings-content-types');
  await page.getByRole('link', { name: '← กลับ' }).click();
  await expect(filter.getByRole('button', { name: 'TikTok' })).toBeVisible();
  await expect(filter.getByRole('button', { name: 'Instagram' })).toHaveCount(0);
});

test('settings can switch to dark mode and it persists', async ({ page }) => {
  await startAsOnboardedGuest(page);
  await page.goto('/settings');
  await page.getByRole('radio', { name: /Dark/ }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await shot(page, '09-settings-dark');
  await page.getByRole('radio', { name: /Light/ }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('login page shows official Google and LINE buttons', async ({ page }) => {
  await page.goto('/login');
  const google = page.getByRole('button', { name: 'ลงชื่อเข้าใช้ด้วย Google' });
  const line = page.getByRole('button', { name: 'เข้าสู่ระบบด้วย LINE' });
  await expect(google).toBeVisible();
  await expect(line).toBeVisible();
  await expect(google).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(google).toHaveCSS('border-top-color', 'rgb(116, 119, 117)'); // #747775
  await expect(line).toHaveCSS('background-color', 'rgb(6, 199, 85)'); // #06C755
  await expect(google.locator('svg path')).toHaveCount(4); // 4-colour G
  await expect(page.getByRole('link', { name: 'ใช้งานต่อแบบ Guest' })).toBeVisible();
  await shot(page, '05-login');
});

test('login page shows LINE callback errors', async ({ page }) => {
  await page.goto('/login?error=LINE_CANCELLED');
  await expect(page.getByRole('alert')).toHaveText('ยกเลิกการเข้าสู่ระบบด้วย LINE');
});

test('LINE button goes to the LINE redirect endpoint', async ({ page }) => {
  await page.route('**/api/auth/line**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'line-redirect' }));
  await page.goto('/login');
  await page.getByRole('button', { name: 'เข้าสู่ระบบด้วย LINE' }).click();
  await expect(page).toHaveURL(/\/api\/auth\/line\?from=%2F$/);
});

test('guest sees login entry in header and brand buttons in settings', async ({ page }) => {
  await startAsOnboardedGuest(page);
  await page.goto('/');
  await expect(page.getByTestId('guest-login')).toBeVisible();
  await expect(page.getByTestId('member-avatar')).toHaveCount(0);
  await page.goto('/settings');
  await expect(page.getByText('โหมด Guest', { exact: true })).toBeVisible();
  await expect(page.getByTestId('account-guest').getByRole('button', { name: 'ลงชื่อเข้าใช้ด้วย Google' })).toBeVisible();
  await expect(page.getByTestId('account-guest').getByRole('button', { name: 'เข้าสู่ระบบด้วย LINE' })).toBeVisible();
  await expect(page.getByText('ออกจากระบบ')).toHaveCount(0);
  await shot(page, '06-settings-guest');
});

// Member: fake a stored Supabase session + mock PostgREST, so no real backend is needed.
test('member sees avatar in header and account card in settings', async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), 'needs the local dev server with placeholder Supabase URL');
  const ref = new URL(process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321').hostname.split('.')[0];
  const user = {
    id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'line_U123@line.kip.invalid',
    app_metadata: { provider: 'email' }, user_metadata: { provider: 'line', line_user_id: 'U123', full_name: 'สมชาย LINE' },
  };
  await page.addInitScript(({ key, user }) => {
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem(key, JSON.stringify({ access_token: 'e2e', refresh_token: 'e2e', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user }));
  }, { key: `sb-${ref}-auth-token`, user });
  await page.route('**/rest/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/profiles')) {
      return route.fulfill({ json: { id: user.id, onboarded: true, view_mode: 'grid', quick_mode: false, subscription_tier: 'free', pro_until: null, role: 'user' } });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto('/');
  await expect(page.getByTestId('member-avatar')).toBeVisible();
  await expect(page.getByTestId('guest-login')).toHaveCount(0);
  await shot(page, '12-member-header');
  await page.getByTestId('member-avatar').click();
  await expect(page).toHaveURL(/\/settings$/);
  const card = page.getByTestId('account-member');
  await expect(card).toContainText('สมชาย LINE');
  await expect(card).toContainText('เชื่อมต่อด้วย LINE');
  await expect(card).not.toContainText('.invalid');
  await expect(page.getByRole('button', { name: 'ออกจากระบบ' })).toBeVisible();
  await shot(page, '13-settings-member');
  await page.goto('/login');
  await expect(page).toHaveURL(/\/$/); // members skip the login page
});

test('member at the limit pays by PromptPay QR and attaches a slip → pending review', async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), 'needs the local dev server with placeholder Supabase URL');
  const ref = new URL(process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321').hostname.split('.')[0];
  const user = { id: '00000000-0000-0000-0000-000000000002', aud: 'authenticated', role: 'authenticated', email: 'pay@example.com', app_metadata: { provider: 'google' }, user_metadata: { full_name: 'ผู้จ่าย' } };
  await page.addInitScript(({ key, user }) => {
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem(key, JSON.stringify({ access_token: 'e2e', refresh_token: 'e2e', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user }));
  }, { key: `sb-${ref}-auth-token`, user });
  let submitted = null;
  await page.route('**/rest/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/profiles')) return route.fulfill({ json: { id: user.id, onboarded: true, view_mode: 'grid', quick_mode: false, subscription_tier: 'free', pro_until: null, role: 'user' } });
    if (url.includes('/items')) return route.fulfill({ json: url.includes('deleted_at=not.is.null') ? [] : Array.from({ length: 50 }, (_, i) => ({ ...fakeItem(i, 'text'), deleted_at: null })) });
    if (url.includes('/rpc/get_pro_count')) return route.fulfill({ json: 0 });
    if (url.includes('/rpc/submit_payment_slip')) {
      submitted = route.request().postDataJSON();
      return route.fulfill({ json: { id: 's1', user_id: user.id, amount: 19, billing_interval: 'month', tier: 1, status: 'pending', slip_path: submitted.p_slip_path, created_at: new Date().toISOString() } });
    }
    return route.fulfill({ json: [] });
  });
  await page.route('**/storage/v1/object/payment-slips/**', (route) => route.fulfill({ json: { Key: 'payment-slips/x' } }));

  await page.goto('/');
  await page.getByTestId('fab').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: /PromptPay QR/ }).click();
  await expect(sheet.getByTestId('promptpay-qr')).toBeVisible();
  await expect(sheet.getByTestId('promptpay-amount')).toHaveText('฿19.00');
  await expect(sheet.getByTestId('promptpay-id')).toHaveText('081-234-5678');
  await shot(page, '15-promptpay-qr');

  // 1×1 PNG as the slip.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await sheet.getByTestId('slip-input').setInputFiles({ name: 'slip.png', mimeType: 'image/png', buffer: png });
  await sheet.getByRole('button', { name: 'ส่งสลิปเพื่อยืนยันการชำระเงิน' }).click();
  await expect(sheet.getByTestId('slip-pending')).toContainText('รอแอดมินตรวจสอบ');
  expect(submitted).toMatchObject({ p_interval: 'month', p_amount: 19 });
  expect(submitted.p_slip_path).toMatch(new RegExp(`^${user.id}/`));
  await shot(page, '16-slip-pending');
});

test('admin reviews pending slips: image, amount, name, approve → RPC', async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), 'needs the local dev server with placeholder Supabase URL');
  const ref = new URL(process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321').hostname.split('.')[0];
  const admin = { id: '00000000-0000-0000-0000-0000000000aa', aud: 'authenticated', role: 'authenticated', email: 'admin@example.com', app_metadata: { provider: 'google' }, user_metadata: {} };
  await page.addInitScript(({ key, user }) => {
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem(key, JSON.stringify({ access_token: 'e2e', refresh_token: 'e2e', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user }));
  }, { key: `sb-${ref}-auth-token`, user: admin });
  const slip = { id: 's1', user_id: 'u1', email: 'buyer@example.com', display_name: 'คุณผู้ซื้อ', amount: 190, billing_interval: 'year', tier: 1, slip_path: 'u1/a.webp', status: 'pending', review_note: null, created_at: new Date().toISOString(), reviewed_at: null };
  let reviewed = null;
  await page.route('**/rest/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/profiles')) return route.fulfill({ json: { id: admin.id, onboarded: true, view_mode: 'grid', quick_mode: false, subscription_tier: 'free', pro_until: null, role: 'admin' } });
    if (url.includes('/rpc/admin_stats')) return route.fulfill({ json: { total_users: 3, pro_users: 1, revenue_thb: 0, storage_bytes: 0 } });
    if (url.includes('/rpc/admin_list_slips')) return route.fulfill({ json: reviewed ? [] : [slip] });
    if (url.includes('/rpc/admin_review_slip')) {
      reviewed = route.request().postDataJSON();
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fulfill({ json: [] });
  });
  await page.route('**/storage/v1/object/sign/payment-slips', (route) => route.fulfill({ json: [{ path: 'u1/a.webp', signedURL: '/object/sign/payment-slips/u1/a.webp?token=x', error: null }] }));

  await page.goto('/admin');
  const row = page.getByTestId('slip-row');
  await expect(row).toContainText('฿190');
  await expect(row).toContainText('คุณผู้ซื้อ');
  await expect(row).toContainText('รายปี');
  await expect(row.getByRole('img', { name: 'สลิปการโอน' })).toHaveCount(1);
  await shot(page, '17-admin-slips');
  await row.getByRole('button', { name: '✓ อนุมัติ' }).click();
  await expect(page.getByText('ไม่มีสลิปรออนุมัติ')).toBeVisible();
  expect(reviewed).toMatchObject({ p_slip: 's1', p_approve: true });
});

test('admin route is closed to guests', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);
});

test('long press → multi-select → trash, then restore / delete permanently from Settings', async ({ page }) => {
  const day = 24 * 60 * 60 * 1000;
  const trashed = (i, daysAgo) => ({ ...fakeItem(i, 'link'), title: `ในถัง ${i}`, deleted_at: new Date(Date.now() - daysAgo * day).toISOString() });
  await startAsOnboardedGuest(page, { items: [fakeItem(1, 'link'), fakeItem(2, 'text'), fakeItem(3, 'youtube'), trashed(8, 2), trashed(9, 31)] });
  await page.goto('/');
  const cards = page.getByTestId('item-card');
  await expect(cards).toHaveCount(3);

  // Long press the first card
  const box = await cards.first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect(page.getByTestId('selection-bar')).toBeVisible();
  await expect(page.getByText('เลือกแล้ว 1 รายการ')).toBeVisible();
  await cards.nth(1).click(); // tap toggles while selecting
  await expect(page.getByText('เลือกแล้ว 2 รายการ')).toBeVisible();
  await shot(page, '10-multi-select');

  await page.getByTestId('selection-bar').getByRole('button', { name: 'ลบ' }).click();
  await expect(cards).toHaveCount(1);
  await expect(page.getByTestId('selection-bar')).toHaveCount(0);

  await page.goto('/settings');
  await page.getByTestId('trash-link').click();
  await expect(page).toHaveURL(/\/trash$/);
  const rows = page.getByTestId('trash-row');
  await expect(rows).toHaveCount(3); // the 31-day-old item was auto-deleted
  await expect(page.getByText('ในถัง 9')).toHaveCount(0);
  await shot(page, '11-trash');

  await rows.filter({ hasText: 'ในถัง 8' }).getByRole('button', { name: 'ลบถาวร' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'ลบถาวร' }).click();
  await expect(rows).toHaveCount(2);
  await rows.first().getByRole('button', { name: /คืนค่า/ }).click();
  await expect(rows).toHaveCount(1);

  await page.goto('/');
  await expect(cards).toHaveCount(2);
});

test('share target pre-fills the composer and waits for the user to save', async ({ page }) => {
  await startAsOnboardedGuest(page);
  await page.route('**/functions/v1/og-metadata', (route) => route.fulfill({ json: { title: 'Example', description: null, thumbnail_url: null, site_name: 'example.com' } }));
  await page.goto(`/share?title=${encodeURIComponent('บทความดี')}&text=${encodeURIComponent('อ่านทีหลัง https://example.com/post')}`);
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByTestId('shared-hint')).toBeVisible();
  await expect(sheet.getByPlaceholder('วางลิงก์ หรือพิมพ์โน้ต...')).toHaveValue('https://example.com/post');
  await expect(sheet.getByPlaceholder('ชื่อเรื่อง (ไม่บังคับ)')).toHaveValue('บทความดี');
  await expect(sheet.getByPlaceholder('เพิ่มโน้ต (ไม่บังคับ)')).toHaveValue('อ่านทีหลัง');
  // Nothing is saved until the user taps save (no background quick-save).
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kip.guest.v1')).items.length)).toBe(0);
  await shot(page, '12-share-composer');
  await sheet.getByRole('button', { name: 'เซฟ', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'บทความดี' })).toBeVisible();
});

test('install guide: OS-specific steps, opened from the dashboard hint and settings', async ({ page }, info) => {
  await startAsOnboardedGuest(page);
  await page.goto('/');
  await page.getByTestId('install-hint').getByRole('button', { name: 'วิธีติดตั้ง' }).click();
  const guide = page.getByTestId('install-guide');
  await expect(guide.getByTestId(info.project.name === 'iphone' ? 'install-ios' : 'install-android')).toBeVisible();
  await shot(page, '13-install-guide');
  await guide.getByRole('tab', { name: 'iPhone / iPad' }).click();
  await expect(guide.getByText('“เพิ่มไปยังหน้าจอโฮม”')).toBeVisible();
  await page.getByRole('button', { name: 'ปิด' }).click();

  // Dismissing the hint persists across reloads; the guide stays reachable from settings.
  await page.getByRole('button', { name: 'ซ่อนคำแนะนำการติดตั้ง' }).click();
  await page.reload();
  await expect(page.getByText('ยังไม่มีอะไรใน Kip')).toBeVisible();
  await expect(page.getByTestId('install-hint')).toHaveCount(0);
  await page.goto('/settings');
  await page.getByTestId('open-install-guide').click();
  await expect(page.getByTestId('install-guide')).toBeVisible();
});
