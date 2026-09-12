import { test } from '@playwright/test';

test('Screenshot Welcome panel after full-panel fix', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/login');
  await page.waitForTimeout(3000);
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('changeme123');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForTimeout(3000);
  await page.locator('select').first().selectOption({ label: 'Wine Retail Company' });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: '/tmp/screenshot_welcome.png', fullPage: true });
});
