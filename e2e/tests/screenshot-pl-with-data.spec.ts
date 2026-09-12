import { test } from '@playwright/test';

test('Post a real sale, then screenshot the P&L with expanded rows', async ({ page }) => {
  test.setTimeout(60000);

  await page.goto('/login');
  await page.waitForTimeout(1000);
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

  // Post a couple of real Cash Sales, so there's genuine P&L activity.
  await page.goto('/arap/cash-sale');
  await page.waitForTimeout(1000);
  const customerSelect1 = page.locator('fieldset:has(legend:text-is("Customer")) select');
  await customerSelect1.selectOption({ index: 1 });
  await page.locator('table.lines-table input').first().fill('Golden Lager 330ml');
  await page.waitForTimeout(300);
  await page.locator('table.lines-table tbody tr').nth(0).locator('input').nth(2).fill('25.00');
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Complete sale' }).click();
  await page.waitForTimeout(1000);

  await page.goto('/arap/cash-sale');
  await page.waitForTimeout(1000);
  const customerSelect2 = page.locator('fieldset:has(legend:text-is("Customer")) select');
  await customerSelect2.selectOption({ index: 1 });
  await page.locator('table.lines-table input').first().fill('Barossa Shiraz 2021');
  await page.waitForTimeout(300);
  await page.locator('table.lines-table tbody tr').nth(0).locator('input').nth(2).fill('35.00');
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Complete sale' }).click();
  await page.waitForTimeout(1000);

  // Now the P&L, with real activity to expand.
  await page.goto('/reports/profit-and-loss');
  await page.waitForTimeout(1500);
  const disclosures = page.locator('.disclosure');
  const count = await disclosures.count();
  console.log('Disclosure rows found:', count);
  for (let i = 0; i < Math.min(2, count); i++) {
    await disclosures.nth(i).click();
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: '/tmp/screenshot_pl_statement_v2.png', fullPage: true });
});
