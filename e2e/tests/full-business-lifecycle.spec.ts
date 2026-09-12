import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

const BIZ = `Lifecycle Test Co ${Date.now()}`;
const LEDGER = `${BIZ} Actual`;

test('Full business lifecycle, entirely through the real UI, from a genuinely empty database', async ({ page }) => {
  test.setTimeout(300_000);
  await login(page);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  // Step 1: create the real, brand-new business.
  await page.goto('/setup/new-business');
  await page.waitForTimeout(500);
  await page.locator('input[placeholder="e.g. Corner Store Pty Ltd"]').fill(BIZ);
  await page.locator('input[placeholder="e.g. 2026-27"]').fill('2027-28');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /create business/i }).click();
  await page.waitForTimeout(1500);

  // Step 1b: switch the real session to the new business.
  await page.goto('/session');
  await page.waitForTimeout(500);
  await page.locator('select').first().selectOption({ label: BIZ });
  await page.waitForTimeout(300);
  await page.locator('select').nth(1).selectOption({ label: LEDGER });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await page.waitForTimeout(500);

  // Step 2: post the real owner's capital contribution — the page's
  // own, real, direct guidance after creating the business.
  await page.goto('/post');
  await page.waitForSelector('table');
  await page.waitForTimeout(500);
  await page.locator('input[placeholder="e.g. GJ-1001"]').fill('GJ-CAPITAL-1');

  async function selectAccountContaining(select: ReturnType<typeof page.locator>, text: string) {
    const options = await select.locator('option').allTextContents();
    const match = options.find((o) => o.includes(text));
    if (!match) throw new Error(`No real account option containing "${text}" found. Options: ${options.slice(0, 15).join(', ')}`);
    await select.selectOption({ label: match });
  }

  const firstRow = page.locator('tbody tr').first();
  await selectAccountContaining(firstRow.locator('select'), 'Cash and Bank');
  await firstRow.locator('input.num').first().fill('20000.00');
  await page.waitForTimeout(300);

  const secondRow = page.locator('tbody tr').nth(1);
  await selectAccountContaining(secondRow.locator('select'), "Owner's Equity");
  await secondRow.locator('input.num').nth(1).fill('20000.00');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/lifecycle_2_capital.png', fullPage: true });

  // Step 3: create a real warehouse and a real retail outlet.
  await page.goto('/locations');
  await page.waitForSelector('button:has-text("New Location")');
  await page.waitForTimeout(500);

  await page.getByRole('button', { name: '+ New Location' }).click();
  await page.locator('.new-location-form input').first().fill('Main Warehouse');
  await page.locator('.new-location-form input').nth(1).fill('Testville');
  await page.locator('.new-location-form select').first().selectOption('Warehouse');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: '+ New Location' }).click();
  await page.locator('.new-location-form input').first().fill('Main Store');
  await page.locator('.new-location-form input').nth(1).fill('Testville');
  await page.locator('.new-location-form select').first().selectOption('Retail');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/lifecycle_3_locations.png', fullPage: true });

  // Step 4: create a real division.
  await page.goto('/setup/divisions');
  await page.waitForTimeout(500);
  await page.locator('.form-card input').fill('Testville Region');
  await page.getByRole('button', { name: 'Create Division' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/lifecycle_4_divisions.png', fullPage: true });

  // Step 5: create two real employees via the Structured Editor — one
  // hourly, one salaried.
  await page.goto('/editor');
  await page.waitForTimeout(500);
  const newEntityCard = page.locator('.form-card').filter({ hasText: 'New entity' });
  await newEntityCard.locator('input').first().fill('Test Clerk');
  await newEntityCard.locator('select').first().selectOption('Employees');
  await newEntityCard.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(800);

  await newEntityCard.locator('input').first().fill('Test Manager');
  await newEntityCard.locator('select').first().selectOption('Employees');
  await newEntityCard.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/lifecycle_5_employees_created.png', fullPage: true });

  // Set their real wage/salary via Contacts.
  await page.goto('/contacts');
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Test Clerk' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/lifecycle_5b_contact_page.png', fullPage: true });

  // Test Clerk is hourly.
  await page.locator('input[placeholder="e.g. 28.50 — an hourly employee"]').fill('27.00');
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/lifecycle_5b2_clerk_wage_saved.png', fullPage: true });

  // Test Manager is salaried.
  await page.getByRole('button', { name: 'Test Manager' }).click();
  await page.waitForTimeout(500);
  await page.locator('input[placeholder="e.g. 88000.00 — a salaried employee, instead of an hourly wage"]').fill('75000.00');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/lifecycle_5c_employees_paid_setup.png', fullPage: true });

  // Step 6: pay both real employees through the real /hr Pay Wages page.
  await page.goto('/hr');
  await page.waitForTimeout(700);
  const empSelect = page.locator('.form-card select').first();
  await empSelect.selectOption({ label: 'Test Clerk' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/lifecycle_6a0_clerk_selected.png', fullPage: true });
  await page.locator('input[placeholder="e.g. 38.5"]').fill('20');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/lifecycle_6a1_hours_filled.png', fullPage: true });
  const payBtn = page.getByRole('button', { name: 'Pay employee' });
  console.log('Pay button disabled?', await payBtn.isDisabled());
  await payBtn.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/lifecycle_6a_clerk_paid.png', fullPage: true });

  await empSelect.selectOption({ label: 'Test Manager' });
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Pay employee' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/lifecycle_6b_manager_paid.png', fullPage: true });

  // Step 7: create a real product category and two real products.
  await page.goto('/items');
  await page.waitForTimeout(500);
  await page.locator('.add-item input').first().fill('Test Widget A');
  await page.locator('.add-item select').first().selectOption('+ New category…');
  await page.waitForTimeout(300);
  await page.locator('.new-category-form input').fill('Test Widgets');
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/lifecycle_7a_first_item.png', fullPage: true });

  await page.locator('.add-item input').first().fill('Test Widget B');
  await page.locator('.add-item select').first().selectOption({ label: 'Test Widgets' });
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/lifecycle_7b_second_item.png', fullPage: true });

  // Step 8: create a real vendor via the Structured Editor — neither
  // Cash Purchase nor AP Purchase actually support free-text vendor
  // entry, both require the vendor to already exist as a real entity.
  await page.goto('/editor');
  await page.waitForTimeout(500);
  const newEntityCard2 = page.locator('.form-card').filter({ hasText: 'New entity' });
  await newEntityCard2.locator('input').first().fill('Test Vendor Co');
  await newEntityCard2.locator('select').first().selectOption('Accounts Payable');
  await newEntityCard2.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/lifecycle_8_vendor_created.png', fullPage: true });

  // Step 9: a real Cash Purchase, receiving real stock at the warehouse.
  await page.goto('/arap/cash-purchase');
  await page.waitForTimeout(700);
  await page.locator('select').first().selectOption({ label: 'Test Vendor Co' });
  await page.locator('select').nth(1).selectOption({ label: 'Main Warehouse (warehouse)' });
  await page.getByRole('button', { name: /add line/i }).click();
  await page.waitForTimeout(300);
  await page.locator('input[placeholder="e.g. Golden Lager 330ml"]').fill('Test Widget A');
  await page.locator('.num-input').first().fill('50');
  await page.locator('.lines-table input').nth(2).fill('10.00');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/lifecycle_9a_purchase_filled.png', fullPage: true });
  await page.getByRole('button', { name: /complete purchase/i }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/lifecycle_9b_purchase_done.png', fullPage: true });

  // Step 10: create a real customer via the Structured Editor —
  // neither Cash Sale nor AR Sale actually support free-text customer
  // entry, both require the customer to already exist as a real
  // entity, the same real constraint as vendors.
  await page.goto('/editor');
  await page.waitForTimeout(500);
  const newEntityCard3 = page.locator('.form-card').filter({ hasText: 'New entity' });
  await newEntityCard3.locator('input').first().fill('Test Customer Co');
  await newEntityCard3.locator('select').first().selectOption('Accounts Receivable');
  await newEntityCard3.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/lifecycle_10_customer_created.png', fullPage: true });

  // Step 11: a real Cash Sale of the stock just received.
  await page.goto('/arap/cash-sale');
  await page.waitForTimeout(700);
  await page.locator('select').nth(0).selectOption({ label: 'Test Customer Co' });
  await page.locator('select').nth(1).selectOption({ label: 'Main Warehouse (warehouse)' });
  await page.getByRole('button', { name: /add line/i }).click();
  await page.waitForTimeout(300);
  await page.locator('input[placeholder="e.g. Golden Lager 330ml"]').fill('Test Widget A');
  await page.locator('.num-input').first().fill('10');
  await page.locator('.lines-table input').nth(2).fill('25.00');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/lifecycle_11a_sale_filled.png', fullPage: true });
  await page.getByRole('button', { name: /complete sale/i }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/lifecycle_11b_sale_done.png', fullPage: true });

  // Step 12: a real transfer of the remaining stock to the retail store.
  await page.goto('/stock/transfer');
  await page.waitForTimeout(700);
  await page.locator('select').first().selectOption({ label: 'Test Widget A' });
  await page.waitForTimeout(300);
  await page.locator('select').nth(1).selectOption({ label: 'Main Warehouse (Testville)' });
  await page.waitForTimeout(300);
  await page.locator('select').nth(2).selectOption({ label: 'Main Store' });
  await page.locator('input[placeholder="e.g. 240"]').fill('20');
  await page.locator('input[placeholder="e.g. XFER-1001"]').fill('LIFECYCLE-XFER-1');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/lifecycle_12a_transfer_filled.png', fullPage: true });
  await page.getByRole('button', { name: 'Stock Transfer' }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/lifecycle_12b_transfer_done.png', fullPage: true });

  // Step 13: a real stocktake at the retail store — counted matches
  // expected (20), no real variance, the simplest real case.
  await page.goto('/stock/stock-take');
  await page.waitForTimeout(700);
  await page.locator('select').first().selectOption({ label: 'Main Store (Testville)' });
  await page.locator('input[type="date"]').fill('2027-04-01');
  await page.getByRole('button', { name: 'Create sheet' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/lifecycle_13a_stocktake_sheet.png', fullPage: true });

  await page.locator('.count-input').first().fill('20');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/lifecycle_13b_count_saved.png', fullPage: true });

  await page.locator('input[placeholder="e.g. Miscellaneous"]').fill('Miscellaneous');
  await page.getByRole('button', { name: 'Complete', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/tmp/lifecycle_13c_stocktake_done.png', fullPage: true });

  // Step 14: the final year-end close, using the real preview/accept-
  // reject flow — completes the whole lifecycle, from a genuinely
  // empty database to a closed period, entirely through the real UI.
  await page.goto('/setup/yearend');
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Preview the close' }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/tmp/lifecycle_14a_close_preview.png', fullPage: true });
  await page.getByRole('button', { name: 'Accept and close' }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/lifecycle_14b_close_done.png', fullPage: true });
});
