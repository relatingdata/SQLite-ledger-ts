// Full UI-path tutorial walkthrough. Full documentation: docs/pm-testing-e2e.md.
import { test, expect } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'manual-images-tutorial');
const BIZ = 'Wine Retail Business';

test('Tutorial: build a real wine retail business from scratch through the UI', async ({ page }) => {
  test.setTimeout(600000);
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

  // Login requires an existing business first; 'admin' is always present.
  await page.locator('select').first().selectOption({ label: 'admin' });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await page.waitForTimeout(500);

  // === Create the new business ===
  await page.goto('/setup/new-business');
  await page.waitForTimeout(800);
  await page.locator('input[placeholder="e.g. Corner Store Pty Ltd"]').fill(BIZ);
  await page.locator('input[placeholder="e.g. 2026-27"]').fill('2026-27');

  await page.waitForTimeout(500);
  const businessTypeSelect = page.locator('select').nth(1);
  await businessTypeSelect.selectOption({ label: 'Sole Trader' });
  const selectedValue = await businessTypeSelect.inputValue();
  const selectedLabel = await businessTypeSelect.locator(`option[value="${selectedValue}"]`).textContent();
  expect(selectedLabel?.trim()).toBe('Sole Trader');

  await page.getByLabel('Owner name').fill('Jamie Chen');

  await page.waitForTimeout(300);
  await shot('new_business_form');
  await page.getByRole('button', { name: 'Create Business' }).click();
  await page.waitForTimeout(1500);
  await shot('new_business_created');

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
  await page.locator('.tree-panel [role="toolbar"]').focus();
  await page.keyboard.press('Insert');
  await page.waitForTimeout(300);
  await page.locator('input[placeholder="Division name"]').fill('Main Division');
  await page.locator('.inline-add .btn.small').first().click();
  await page.waitForTimeout(800);
  await shot('first_division_created');

  await page.getByRole('button', { name: 'Main Division' }).click();
  await page.waitForTimeout(300);
  await page.locator('.tree-panel [role="toolbar"]').focus();
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
  await page.locator('.tree-panel [role="toolbar"]').focus();
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

  // === A second packaging of the same beer (cans) - its own, separate item/SKU ===
  await page.locator('input[placeholder="New item name"]').fill('Amber Ale 330ml Can');
  await page.locator('select').first().selectOption({ label: 'Beer' });
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.waitForTimeout(1000);
  await shot('beer_can_variant_created');

  // === A wine, sold in 750ml bottles, bought in cartons of 12 (vs. beer's 24) ===
  await page.locator('input[placeholder="New item name"]').fill('Barossa Shiraz 750ml');
  await page.locator('select').first().selectOption({ label: '+ New category…' });
  await page.waitForTimeout(300);
  await page.locator('input[placeholder="New category name, e.g. Pinot Noir"]').fill('Wine');
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.waitForTimeout(1000);
  await shot('wine_item_created');

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

  // === Set physical details on Amber Ale 330ml: glass bottle, cold storage ===
  await page.goto('/items');
  await page.waitForTimeout(800);
  await page.locator('button.entry', { hasText: 'Amber Ale 330ml' }).filter({ hasNotText: 'Can' }).click();
  await page.waitForTimeout(500);
  await page.locator('input[placeholder="e.g. each"]').fill('glass bottle');
  await page.getByRole('textbox').filter({ hasText: '' }).first().fill('Requires cold storage (refrigerated display).').catch(() => {});
  await page.waitForTimeout(500);
  await shot('item_glass_bottle_cold');

  // === Register the real vendor this item is ordered from ===
  await page.goto('/editor');
  await page.waitForSelector('table');
  await page.locator('input[placeholder="e.g. Gamma LLC"]').fill('Highland Brewing Co');
  await page.locator('.card, .form-card', { hasText: 'New entity' }).locator('select').first().selectOption({ label: 'Accounts Payable' });
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(800);
  await shot('vendor_created');

  // === Order it: a real Purchase Order, delivered to the warehouse ===
  await page.goto('/stock/po');
  await page.waitForTimeout(800);
  await page.locator('select').filter({ has: page.locator('option', { hasText: 'Amber Ale 330ml' }) }).selectOption({ label: 'Amber Ale 330ml' }).catch(async () => {
    await page.getByRole('combobox').filter({ hasText: /Item/ }).selectOption({ label: 'Amber Ale 330ml' });
  });
  await page.waitForTimeout(300);
  await page.locator('select', { hasText: 'Select vendor' }).selectOption({ label: 'Highland Brewing Co' }).catch(() => {});
  await page.locator('input[placeholder="0"]').first().fill('96');
  await page.locator('input[placeholder="0.00"]').first().fill('3.50');
  await page.locator('input[placeholder="e.g. PO-1001"]').fill('PO-AMBER-1');
  await page.locator('select').filter({ has: page.locator('option', { hasText: 'Warehouse Hub' }) }).selectOption({ label: 'Warehouse Hub' }).catch(() => {});
  await page.waitForTimeout(300);
  await shot('purchase_order_filled');
  await page.getByRole('button', { name: /Save/i }).click();
  await page.waitForTimeout(1200);
  await shot('purchase_order_placed');

  // === Receive it into the warehouse via Cash Purchase ===
  await page.goto('/arap/cash-purchase');
  await page.waitForTimeout(1200);
  await page.locator('select').first().locator('option', { hasText: 'Highland Brewing Co' }).waitFor({ state: 'attached', timeout: 15000 });
  await page.locator('select').first().selectOption({ label: 'Highland Brewing Co' });
  await page.locator('select').nth(1).locator('option', { hasText: 'Warehouse Hub' }).waitFor({ state: 'attached', timeout: 15000 });
  await page.locator('select').nth(1).selectOption({ label: 'Warehouse Hub' });
  await page.locator('input[placeholder="e.g. Golden Lager 330ml"]').fill('Amber Ale 330ml');
  await page.locator('.num-input').first().fill('96');
  await page.locator('.lines-table input').nth(2).fill('3.50');
  await page.waitForTimeout(300);
  await shot('purchase_received_filled');
  await page.getByRole('button', { name: /complete purchase/i }).click();
  await page.waitForTimeout(1500);
  await shot('purchase_received_done');

  // === A vendor source for the wine, with its own carton size (12) ===
  await page.goto('/items');
  await page.waitForTimeout(800);
  await page.locator('button.entry', { hasText: 'Barossa Shiraz 750ml' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('group', { name: 'Vendor', exact: true }).locator('select').selectOption({ label: 'Highland Brewing Co' });
  await page.locator('input[placeholder="0.00"]').first().fill('18.00');
  await page.getByRole('group', { name: 'Package quantity', exact: true }).locator('input').fill('12');
  await page.waitForTimeout(300);
  await shot('wine_source_filled');
  await page.getByRole('button', { name: /Save source|Add source/i }).click();
  await page.waitForTimeout(800);
  await shot('wine_source_saved');

  // === Receive one whole carton (12 bottles) into ordinary warehouse storage ===
  await page.goto('/arap/cash-purchase');
  await page.waitForTimeout(1200);
  await page.locator('select').first().locator('option', { hasText: 'Highland Brewing Co' }).waitFor({ state: 'attached', timeout: 15000 });
  await page.locator('select').first().selectOption({ label: 'Highland Brewing Co' });
  await page.locator('select').nth(1).locator('option', { hasText: 'Warehouse Hub' }).waitFor({ state: 'attached', timeout: 15000 });
  await page.locator('select').nth(1).selectOption({ label: 'Warehouse Hub' });
  await page.locator('input[placeholder="e.g. Golden Lager 330ml"]').fill('Barossa Shiraz 750ml');
  await page.locator('.num-input').first().fill('12');
  await page.locator('.lines-table input').nth(2).fill('18.00');
  await page.waitForTimeout(300);
  await shot('wine_carton_received_filled');
  await page.getByRole('button', { name: /complete purchase/i }).click();
  await page.waitForTimeout(1500);
  await shot('wine_carton_received_done');

  // === Check Inventory Listing and Trial Balance ===
  await page.goto('/stock/listing');
  await page.waitForTimeout(1000);
  // Level-input fields only render once their division/location disclosures are expanded.
  const divisionButtons = page.locator('button.division-head');
  for (let i = 0; i < (await divisionButtons.count()); i++) await divisionButtons.nth(i).click();
  await page.waitForTimeout(300);
  const locationButtons = page.locator('button.location-head');
  for (let i = 0; i < (await locationButtons.count()); i++) await locationButtons.nth(i).click();
  await page.waitForTimeout(500);
  await shot('inventory_listing_wine_received');
  const wineRow = await page.locator('tr', { hasText: 'Barossa Shiraz 750ml' }).first().innerText();
  expect(wineRow).toContain('12');

  // === Set min/max/reorder stock levels; confirm by reloading and reading them back ===
  const wineRowLocator = page.locator('tr', { hasText: 'Barossa Shiraz 750ml' }).first();
  const levelInputs = wineRowLocator.locator('input.level-input');
  await levelInputs.nth(0).fill('4');
  await levelInputs.nth(0).dispatchEvent('change');
  await page.waitForTimeout(500);
  await levelInputs.nth(1).fill('20');
  await levelInputs.nth(1).dispatchEvent('change');
  await page.waitForTimeout(500);
  await levelInputs.nth(2).fill('6');
  await levelInputs.nth(2).dispatchEvent('change');
  await page.waitForTimeout(500);
  await shot('inventory_listing_wine_levels_set');
  await page.reload();
  await page.waitForTimeout(1000);
  const wineRowAfterReload = page.locator('tr', { hasText: 'Barossa Shiraz 750ml' }).first();
  await expect(wineRowAfterReload.locator('input.level-input').nth(0)).toHaveValue('4');
  await expect(wineRowAfterReload.locator('input.level-input').nth(1)).toHaveValue('20');
  await expect(wineRowAfterReload.locator('input.level-input').nth(2)).toHaveValue('6');

  await page.goto('/reports/trial-balance');
  await page.waitForTimeout(1000);
  await shot('trial_balance_wine_received');

  // === A vendor source for the beer's can variant (carton size 24) ===
  await page.goto('/items');
  await page.waitForTimeout(800);
  await page.locator('button.entry', { hasText: 'Amber Ale 330ml Can' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('group', { name: 'Vendor', exact: true }).locator('select').selectOption({ label: 'Highland Brewing Co' });
  await page.locator('input[placeholder="0.00"]').first().fill('3.50');
  await page.getByRole('group', { name: 'Package quantity', exact: true }).locator('input').fill('24');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Save source|Add source/i }).click();
  await page.waitForTimeout(800);
  await shot('beer_can_source_saved');

  // === Some vendors deliver already-chilled beer directly to a retail outlet's
  // === refrigerated section, bypassing the (non-refrigerated) warehouse entirely ===
  await page.goto('/locations');
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Main Street Cellar' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '+ Add refrigerated section' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Create Refrigerated Section' }).click();
  await page.waitForTimeout(800);
  await shot('retail_refrigerated_section_created');

  // === One carton (24 cans) received directly at the retail outlet's refrigerated section ===
  await page.goto('/arap/cash-purchase');
  await page.waitForTimeout(1200);
  await page.locator('select').first().locator('option', { hasText: 'Highland Brewing Co' }).waitFor({ state: 'attached', timeout: 15000 });
  await page.locator('select').first().selectOption({ label: 'Highland Brewing Co' });
  await page.locator('select').nth(1).locator('option', { hasText: 'Main Street Cellar (Refrigerated)' }).waitFor({ state: 'attached', timeout: 15000 });
  await page.locator('select').nth(1).selectOption({ label: 'Main Street Cellar (Refrigerated)' });
  await page.locator('input[placeholder="e.g. Golden Lager 330ml"]').fill('Amber Ale 330ml Can');
  await page.locator('.num-input').first().fill('24');
  await page.locator('.lines-table input').nth(2).fill('3.50');
  await page.waitForTimeout(300);
  await shot('chilled_beer_direct_delivery_filled');
  await page.getByRole('button', { name: /complete purchase/i }).click();
  await page.waitForTimeout(1500);
  await shot('chilled_beer_direct_delivery_done');

  // === Confirm the chilled carton shows up at the refrigerated section, not the warehouse ===
  await page.goto('/stock/listing');
  await page.waitForTimeout(1000);
  await shot('inventory_listing_chilled_beer_delivered');
  const chilledBeerRow = await page.locator('tr', { hasText: 'Amber Ale 330ml Can' }).first().innerText();
  expect(chilledBeerRow).toContain('Refrigerated');
  expect(chilledBeerRow).toContain('24');
  await page.goto('/reports/trial-balance');
  await page.waitForTimeout(1000);
  await shot('trial_balance_chilled_beer_delivered');

  // === Create a second retail location ===
  await page.goto('/locations');
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '+ New Location' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('group', { name: 'Location name, e.g. Downtown Cellar', exact: true }).locator('input').fill('Rundle Street Bottleshop');
  await page.getByRole('group', { name: 'City', exact: true }).locator('input').fill('Adelaide');
  await page.getByRole('group', { name: 'Type', exact: true }).locator('select').selectOption('Retail');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(800);
  await page.locator('input[placeholder="e.g. 2000"]').fill('1500');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(800);
  await shot('second_retail_location_created');

  // === A third retail location that never stocks the item — to distinguish an
  // === expected absence from a bug (item wrongly missing from a sheet) ===
  await page.goto('/locations');
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '+ New Location' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('group', { name: 'Location name, e.g. Downtown Cellar', exact: true }).locator('input').fill('Glenelg Beachside Store');
  await page.getByRole('group', { name: 'City', exact: true }).locator('input').fill('Glenelg');
  await page.getByRole('group', { name: 'Type', exact: true }).locator('select').selectOption('Retail');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(800);
  await page.locator('input[placeholder="e.g. 2000"]').fill('1200');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(800);
  await shot('third_retail_location_never_stocked');

  // === Transfer to the first retail location (Main Street Cellar) ===
  await page.goto('/stock/transfer');
  await page.waitForTimeout(700);
  await page.locator('select').first().selectOption({ label: 'Amber Ale 330ml' });
  await page.waitForTimeout(300);
  await page.locator('select').nth(1).selectOption({ label: 'Warehouse Hub' });
  await page.locator('select').nth(2).selectOption({ label: 'Main Street Cellar' });
  await page.getByRole('group', { name: 'Quantity', exact: true }).locator('input').fill('24');
  await page.getByRole('group', { name: 'Reference', exact: true }).locator('input').fill('XFER-AMBER-1');
  await page.waitForTimeout(300);
  await shot('transfer_to_main_street_filled');
  await page.getByRole('button', { name: 'Transfer', exact: true }).click();
  await page.waitForTimeout(1200);
  await shot('transfer_to_main_street_done');

  // === Transfer to the second retail location (Rundle Street) ===
  await page.goto('/stock/transfer');
  await page.waitForTimeout(700);
  await page.locator('select').first().selectOption({ label: 'Amber Ale 330ml' });
  await page.waitForTimeout(300);
  await page.locator('select').nth(1).selectOption({ label: 'Warehouse Hub' });
  await page.locator('select').nth(2).selectOption({ label: 'Rundle Street Bottleshop' });
  await page.getByRole('group', { name: 'Quantity', exact: true }).locator('input').fill('24');
  await page.getByRole('group', { name: 'Reference', exact: true }).locator('input').fill('XFER-AMBER-2');
  await page.waitForTimeout(300);
  await shot('transfer_to_rundle_street_filled');
  await page.getByRole('button', { name: 'Transfer', exact: true }).click();
  await page.waitForTimeout(1200);
  await shot('transfer_to_rundle_street_done');

  // === Stock take #1: Main Street Cellar (has real stock) ===
  await page.goto('/stock/stock-take');
  await page.waitForTimeout(700);
  await page.locator('select').first().selectOption({ label: 'Main Street Cellar' });
  await page.locator('input[type="date"]').fill('2027-01-31');
  await page.getByRole('button', { name: 'Create sheet' }).click();
  await page.waitForTimeout(1000);
  await shot('stocktake_main_street_sheet');
  await page.locator('.count-input').first().fill('24');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(800);
  await page.locator('input[placeholder="e.g. Miscellaneous"]').fill('Miscellaneous');
  await page.getByRole('button', { name: 'Complete stock take' }).click();
  await page.waitForTimeout(1200);
  await shot('stocktake_main_street_done');

  // === Stock take #2: Rundle Street Bottleshop (has real stock) ===
  await page.goto('/stock/stock-take');
  await page.waitForTimeout(700);
  await page.locator('select').first().selectOption({ label: 'Rundle Street Bottleshop' });
  await page.locator('input[type="date"]').fill('2027-01-31');
  await page.getByRole('button', { name: 'Create sheet' }).click();
  await page.waitForTimeout(1000);
  await shot('stocktake_rundle_street_sheet');
  await page.locator('.count-input').first().fill('24');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(800);
  await page.locator('input[placeholder="e.g. Miscellaneous"]').fill('Miscellaneous');
  await page.getByRole('button', { name: 'Complete stock take' }).click();
  await page.waitForTimeout(1200);
  await shot('stocktake_rundle_street_done');

  // === A POS sale at Main Street Cellar (ordinary home-currency retail path) ===
  await page.goto('/pos');
  await page.waitForTimeout(800);
  await page.locator('select').first().selectOption({ value: 'Main Street Cellar' });
  await page.waitForTimeout(300);
  await page.locator('input[placeholder*="Scan" i], input[placeholder*="search" i]').first().fill('Amber Ale 330ml');
  await page.waitForTimeout(500);
  await page.locator('input[placeholder*="Scan" i], input[placeholder*="search" i]').first().press('Enter');
  await page.waitForTimeout(300);
  // See docs/pm-testing-e2e.md "Honest, current status" — no screen sets a persistent retail price.
  await page.locator('.price-input').first().fill('5.00');
  await page.waitForTimeout(300);
  await shot('pos_sale_filled');
  await page.getByRole('button', { name: /complete sale/i }).click();
  await page.waitForTimeout(1200);
  await shot('pos_sale_done');

  // === Multicurrency: nominate USD, create a terminal for it, set a USD price, sell ===
  await page.goto('/locations');
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Main Street Cellar' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Nominate a further currency/i }).click();
  await page.waitForTimeout(300);
  await page.locator('input[placeholder="e.g. USD"]').first().fill('USD');
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();
  await page.waitForTimeout(800);
  await shot('location_currency_nominated');

  await page.goto('/items');
  await page.waitForTimeout(800);
  await page.locator('button.entry', { hasText: 'Amber Ale 330ml' }).filter({ hasNotText: 'Can' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('group', { name: 'Vendor', exact: true }).locator('select').selectOption({ label: 'Highland Brewing Co' });
  await page.locator('input[placeholder="0.00"]').first().fill('5.00');
  await page.locator('.currency-field input').fill('USD');
  await page.waitForTimeout(300);
  await shot('item_source_usd_price_filled');
  await page.getByRole('button', { name: /Save source|Add source/i }).click();
  await page.waitForTimeout(800);
  await shot('item_source_usd_price_saved');

  await page.goto('/pos');
  await page.waitForTimeout(800);
  await page.locator('select').first().selectOption({ value: 'Main Street Cellar' });
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Add a foreign-currency terminal/i }).click();
  await page.waitForTimeout(300);
  await page.locator('input[placeholder="Terminal name"]').fill('Border Store USD Till');
  await page.locator('input[placeholder="e.g. USD"]').fill('USD');
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();
  await page.waitForTimeout(800);
  await shot('pos_terminal_created');
  await page.locator('input[placeholder*="Scan" i], input[placeholder*="search" i]').first().fill('Amber Ale 330ml');
  await page.waitForTimeout(500);
  await page.locator('input[placeholder*="Scan" i], input[placeholder*="search" i]').first().press('Enter');
  await page.waitForTimeout(300);
  // Same gap, per-currency — see docs/pm-testing-e2e.md "Honest, current status".
  await page.locator('.price-input').first().fill('5.00');
  await page.waitForTimeout(300);
  await shot('pos_usd_sale_filled');
  await page.getByRole('button', { name: /complete sale/i }).click();
  await page.waitForTimeout(1200);
  await shot('pos_usd_sale_done');

  // === Review Trial Balance, Balance Sheet, P&L, and the DND P&L pivot builder ===
  await page.goto('/reports/trial-balance');
  await page.waitForTimeout(1000);
  await shot('trial_balance_final');
  // Every posting made throughout still balances, debits to credits, at the end.
  const finalDebit = await page.locator('.totals-row .amount-debit').innerText();
  const finalCredit = await page.locator('.totals-row .amount-credit').innerText();
  expect(finalDebit.trim()).toBe(finalCredit.trim());
  await expect(page.locator('.status')).toHaveClass(/balanced/);
  await expect(page.locator('.status')).toContainText('Balanced');
  await page.goto('/reports/balance-sheet');
  await page.waitForTimeout(1000);
  await shot('balance_sheet_final');
  await page.goto('/reports/profit-and-loss');
  await page.waitForTimeout(1000);
  await shot('profit_and_loss_final');
  await page.goto('/reports/pl-pivot');
  await page.waitForTimeout(1000);
  await shot('dnd_pl_final');

  // === Stock take #3: Glenelg Beachside Store, never stocked — expect an empty sheet ===
  await page.goto('/stock/stock-take');
  await page.waitForTimeout(700);
  await page.locator('select').first().selectOption({ label: 'Glenelg Beachside Store' });
  await page.locator('input[type="date"]').fill('2027-01-31');
  await page.getByRole('button', { name: 'Create sheet' }).click();
  await page.waitForTimeout(1000);
  await shot('stocktake_glenelg_never_stocked_sheet');
  const amberRowAtGlenelg = await page.locator('tr', { hasText: 'Amber Ale 330ml' }).count();
  expect(amberRowAtGlenelg).toBe(0);
});
