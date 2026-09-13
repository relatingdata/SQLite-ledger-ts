import { test } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';

test('Screenshot General Journal in Hebrew, for approval', async ({ page }) => {
  test.setTimeout(30000);
  await page.goto('/login');
  await page.waitForTimeout(2000);
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('changeme123');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'));
  await page.waitForTimeout(500);
  await page.locator('select').first().selectOption({ label: fixtures.business });
  await page.waitForTimeout(300);
  await page.locator('select').nth(2).selectOption({ label: 'Hebrew' });
  await page.waitForTimeout(500);
  await page.locator('button.btn').click();
  await page.waitForURL((url) => url.pathname === '/');
  await page.waitForTimeout(1000);
  await page.goto('/post');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/screenshot_journal_hebrew.png', fullPage: true });
});
