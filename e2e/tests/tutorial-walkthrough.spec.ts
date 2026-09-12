import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'manual-images-tutorial');
const BIZ = 'Wine Retail Company';

test('Tutorial: build a real wine retail business from scratch through the UI', async ({ page }) => {
  test.setTimeout(180000);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let n = 1;
  const shot = async (name: string) => {
    await page.screenshot({ path: path.join(OUT_DIR, `t${String(n).padStart(2, '0')}_${name}.png`), fullPage: true });
    n++;
  };

  // === Login ===
  await page.goto('/login');
  await page.waitForTimeout(1000);
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('changeme123');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'));
  await page.waitForTimeout(500);
  await shot('login_landing');

  // Choose any real, existing business first — the app's own real
  // session requirement, before creating a new one. Always 'My
  // Business' — the one, real, always-present dummy company for
  // login purposes — never Wine Retail Company, which may not exist
  // at all (SEED_DEMO_BUSINESSES=false).
  await page.locator('select').first().selectOption({ label: 'My Business' });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await page.waitForTimeout(500);

  // === Create the new business ===
  await page.goto('/setup/new-business');
  await page.waitForTimeout(800);
  await page.locator('input[placeholder="e.g. Corner Store Pty Ltd"]').fill(BIZ);
  await page.locator('input[placeholder="e.g. 2026-27"]').fill('2026-27');

  // Explicitly select and verify the real, database-driven "Sole
  // Trader" business type — proving the selector itself works,
  // rather than passing by coincidence via whatever the default
  // happens to be.
  await page.waitForTimeout(500);
  const businessTypeSelect = page.locator('select').nth(1);
  await businessTypeSelect.selectOption({ label: 'Sole Trader' });
  const selectedValue = await businessTypeSelect.inputValue();
  const selectedLabel = await businessTypeSelect.locator(`option[value="${selectedValue}"]`).textContent();
  expect(selectedLabel?.trim()).toBe('Sole Trader');

  // Sole Trader's own real question ("Owner name") should now be
  // shown — answer it, exercising the real Detail.set write path.
  await page.getByLabel('Owner name').fill('Jamie Chen');

  await page.waitForTimeout(300);
  await shot('new_business_form');
  await page.getByRole('button', { name: 'Create Business' }).click();
  await page.waitForTimeout(1500);
  await shot('new_business_created');

  // Switch the real, active session to the newly-created business.
  await page.goto('/session');
  await page.waitForTimeout(500);
  await page.locator('select').first().selectOption({ label: BIZ });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await page.waitForTimeout(500);

  // === Create the first location ===
  await page.goto('/locations');
  await page.waitForTimeout(800);
  await shot('locations_empty');
  await page.getByRole('button', { name: '+ New Location' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('group', { name: 'Location name, e.g. Downtown Cellar', exact: true }).locator('input').fill('Main Street Cellar');
  await page.getByRole('group', { name: 'City', exact: true }).locator('input').fill('Adelaide');
  await page.getByRole('group', { name: 'Type', exact: true }).locator('select').selectOption('Retail');
  await shot('locations_new_form');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(800);
  await page.locator('input[placeholder="e.g. 2000"]').fill('2000');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(800);
  await shot('locations_created');

  // === Create the first employee (via Business Setup) ===
  await page.goto('/setup/business-setup');
  await page.waitForTimeout(1500);
  await shot('business_setup_landing');
  await page.locator('.tree-panel').focus();
  await page.keyboard.press('Insert');
  await page.waitForTimeout(300);
  await page.locator('input[placeholder="Division name"]').fill('Main Division');
  await page.locator('.inline-add .btn.small').first().click();
  await page.waitForTimeout(800);
  await shot('first_division_created');

  // Add a warehouse location within the division (Main Street Cellar,
  // created earlier, is the real retail outlet; a warehouse is also
  // needed for the real receiving/transfer steps below).
  await page.getByRole('button', { name: 'Main Division' }).click();
  await page.waitForTimeout(300);
  await page.locator('.tree-panel').focus();
  await page.keyboard.press('Insert');
  await page.waitForTimeout(300);
  await page.locator('input[placeholder="Location name"]').fill('Warehouse Hub');
  await page.locator('input[placeholder="City"]').fill('Adelaide');
  await page.getByRole('button', { name: 'Add' }).first().click();
  await page.waitForTimeout(800);
  await shot('first_warehouse_created');

  // === Create the first employee, at the warehouse ===
  await page.getByRole('button', { name: 'Warehouse Hub' }).click();
  await page.waitForTimeout(300);
  await page.locator('.tree-panel').focus();
  await page.keyboard.press('Insert');
  await page.waitForTimeout(300);
  await page.locator('input[placeholder="Employee name"]').fill('Jamie Chen');
  await page.getByRole('button', { name: 'Add' }).first().click();
  await page.waitForTimeout(800);
  await shot('first_employee_created');

  // === Create the first product category and product ===
  await page.goto('/items');
  await page.waitForTimeout(800);
  await shot('items_empty');
  await page.locator('input[placeholder="New item name"]').fill('Amber Ale 330ml');
  await page.locator('select').first().selectOption({ label: '+ New category…' });
  await page.waitForTimeout(300);
  await page.locator('input[placeholder="New category name, e.g. Pinot Noir"]').fill('Beer');
  await shot('new_category_and_product_form');
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.waitForTimeout(1000);
  await shot('first_product_created');

  // === Post the owner's initial cash deposit via General Journal ===
  await page.goto('/post');
  await page.waitForTimeout(800);
  await shot('general_journal_empty');
  await page.locator('input[placeholder="e.g. GJ-1001"]').fill('GJ-1');
  await page.locator('tbody tr').first().locator('select').selectOption('Cash and Bank');
  await page.locator('tbody tr').first().locator('input.num').first().fill('100000.00');
  await page.locator('tbody tr').first().locator('select').press('Insert');
  await page.waitForTimeout(300);
  await page.locator('tbody tr').nth(1).locator('select').selectOption("Owner's Equity");
  await page.locator('tbody tr').nth(1).locator('input.num').nth(1).fill('100000.00');
  await shot('general_journal_filled');
  await page.getByRole('button', { name: /Save|Post/i }).first().click();
  await page.waitForTimeout(1000);
  await shot('general_journal_posted');

  // === Verify via the Trial Balance ===
  await page.goto('/reports/trial-balance');
  await page.waitForTimeout(1000);
  await shot('trial_balance_after_first_transaction');
});
