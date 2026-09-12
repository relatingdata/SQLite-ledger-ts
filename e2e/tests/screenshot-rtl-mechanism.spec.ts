import { test } from '@playwright/test';

test('Screenshot Login in Hebrew - mechanism only, no translations yet', async ({ page }) => {
  test.setTimeout(30000);
  await page.goto('/login');
  await page.waitForTimeout(3000);
  await page.locator('select').first().selectOption({ label: 'Hebrew' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/screenshot_mechanism.png', fullPage: true });
});
