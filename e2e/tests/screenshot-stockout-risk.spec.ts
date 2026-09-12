import { test } from '@playwright/test';

test('Screenshot the new Stock-Out Risk report page', async ({ page }) => {
  test.setTimeout(30000);
  await page.goto('/login');
  await page.waitForTimeout(3000);
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('changeme123');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'));
  await page.waitForTimeout(500);
  await page.locator('select').first().selectOption({ label: 'Wine Retail Company' });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await page.waitForTimeout(500);
  await page.goto('/reports/stock-out-risk');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/screenshot_stockout_risk.png', fullPage: true });
});
