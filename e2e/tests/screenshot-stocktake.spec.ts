import { test } from '@playwright/test';
import fixtures from '../../shared-fixtures/wine-retail.json' with { type: 'json' };

test('Screenshot Stock Take page', async ({ page }) => {
  test.setTimeout(60000);
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
  await page.goto('/stock/stock-take');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '/tmp/screenshot_stocktake.png', fullPage: true });
});
