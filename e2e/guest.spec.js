import { test, expect } from '@playwright/test';

const shot = (page, name) => page.screenshot({ path: `e2e/screenshots/${test.info().project.name}-${name}.png`, fullPage: true });

// Skip onboarding by pre-seeding the guest profile.
async function startAsOnboardedGuest(page) {
  await page.addInitScript(() => {
    if (localStorage.getItem('kip.guest.v1')) return;
    localStorage.setItem(
      'kip.guest.v1',
      JSON.stringify({
        profile: { view_mode: 'grid', onboarded: true, quick_mode: false, subscription_tier: 'free', pro_until: null, role: 'user' },
        categories: [
          { id: 'c1', name: 'ความรู้ / บทความ', emoji: '📚', position: 0, is_default: false },
          { id: 'c5', name: 'ทั่วไป', emoji: '📌', position: 1, is_default: true },
        ],
        items: [],
      }),
    );
  });
}

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
  await sheet.getByRole('button', { name: /ทั่วไป/ }).click();
  await shot(page, '03-save-sheet');
  await sheet.getByRole('button', { name: 'เซฟ', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'ซื้อนมก่อนกลับบ้าน' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'ซื้อนมก่อนกลับบ้าน' })).toBeVisible();
  await shot(page, '04-guest-with-item');
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
