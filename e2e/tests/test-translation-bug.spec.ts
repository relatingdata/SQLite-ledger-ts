import { test } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';

test('Try saving a real translation', async ({ page }) => {
  test.setTimeout(30000);
  page.on('response', async (res) => {
    if (res.status() >= 400) {
      console.log('HTTP ERROR:', res.status(), res.url(), (await res.text().catch(() => '')).slice(0, 300));
    }
  });
  await page.goto('/login');
  await page.waitForTimeout(3000);
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('changeme123');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'));
  await page.waitForTimeout(500);
  await page.locator('select').first().selectOption({ label: fixtures.business });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await page.waitForTimeout(500);
  await page.goto('/setup/translations');
  await page.waitForTimeout(3000);
  await page.getByText('A payment received from a customer').first().click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Save' }).first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/screenshot_after_save.png', fullPage: true });
});
