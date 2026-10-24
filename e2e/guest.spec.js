import { test, expect } from '@playwright/test';

const shot = (page, name) => page.screenshot({ path: `e2e/screenshots/${test.info().project.name}-${name}.png`, fullPage: true });

// Skip onboarding by pre-seeding the guest profile.
async function startAsOnboardedGuest(page, { categories = [{ id: 'c1', name: 'ความรู้ / บทความ', emoji: '📚', position: 0, is_default: false }], items = [] } = {}) {
  await page.addInitScript(
    ({ categories, items }) => {
      if (localStorage.getItem('kip.guest.v1')) return;
      localStorage.setItem(
        'kip.guest.v1',
        JSON.stringify({
          profile: { view_mode: 'grid', onboarded: true, quick_mode: false, subscription_tier: 'free', pro_until: null, role: 'user' },
          categories,
          items,
        }),
      );
    },
    { categories, items },
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
  await expect(page.getByTestId('guest-banner')).toBeVisible();
});

test('guest can save a note that persists after reload', async ({ page }) => {
  await startAsOnboardedGuest(page);
  await page.goto('/');
  await expect(page.getByTestId('guest-banner')).toBeVisible();
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
  await startAsOnboardedGuest(page, { categories: [], items: Array.from({ length: 41 }, (_, i) => fakeItem(i, types[i % 3])) });
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

test('login page offers Gmail and LINE', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /Gmail/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /LINE/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'ใช้งานต่อแบบ Guest' })).toBeVisible();
  await shot(page, '05-login');
});

test('settings shows guest account section', async ({ page }) => {
  await startAsOnboardedGuest(page);
  await page.goto('/settings');
  await expect(page.getByText('โหมด Guest', { exact: true })).toBeVisible();
  await expect(page.getByText('ออกจากระบบ')).toHaveCount(0);
  await shot(page, '06-settings-guest');
});

test('admin route is closed to guests', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);
});
