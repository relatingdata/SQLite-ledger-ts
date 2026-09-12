import { test } from '@playwright/test';

test('Screenshot Login page after centering fix', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/login');
  await page.waitForTimeout(6000);
  await page.screenshot({ path: '/tmp/screenshot_login_fixed.png', fullPage: true });
});
