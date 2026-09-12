import { test } from '@playwright/test';

test('Screenshot Choose Business page', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/login');
  await page.waitForTimeout(3000);
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('changeme123');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: '/tmp/screenshot_choosebusiness.png', fullPage: true });
});
