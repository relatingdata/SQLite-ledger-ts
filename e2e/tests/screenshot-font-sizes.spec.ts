import { test } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';

test('Screenshot AP Purchase and P&L with expanded rows, to show the new font-size scale', async ({ page }) => {
  test.setTimeout(60000);

  await page.goto('/login');
  await page.waitForTimeout(1000);
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

  // AP Purchase
  await page.goto('/arap/ap-purchase');
  await page.waitForTimeout(1000);
  await page.locator('table.lines-table input').first().fill('Golden Lager 330ml');
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/screenshot_ap_purchase.png', fullPage: true });

  // P&L statement, with a couple of disclosure rows expanded
  await page.goto('/reports/profit-and-loss');
  await page.waitForTimeout(1500);
  const disclosures = page.locator('.disclosure');
  const count = await disclosures.count();
  for (let i = 0; i < Math.min(2, count); i++) {
    await disclosures.nth(i).click();
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: '/tmp/screenshot_pl_statement.png', fullPage: true });
});
