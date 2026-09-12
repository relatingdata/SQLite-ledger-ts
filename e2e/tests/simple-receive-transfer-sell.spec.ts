import { test, expect } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'manual-images-simple-test');

test('Simple: receive stock at warehouse, transfer a quarter to retail, sell in three separate sales', async ({ page }) => {
  test.setTimeout(60000);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let n = 1;
  const shot = async (name: string) => {
    await page.screenshot({ path: path.join(OUT_DIR, `s${String(n).padStart(2, '0')}_${name}.png`), fullPage: true });
    n++;
  };

  await page.goto('/login');
  await page.waitForTimeout(500);
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('changeme123');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'));
  await page.locator('select').first().selectOption({ label: fixtures.business });
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  // === Create the Purchase Order Stock Receipt requires ===
  await page.goto('/stock/po');
  await page.waitForTimeout(800);
  await page.locator('input[placeholder="e.g. PO-1001"]').fill('SIMPLE-TEST-PO-1');
  await page.locator('select').nth(0).selectOption({ label: 'Amber Ale 330ml' });
  await page.waitForTimeout(300);
  await page.locator('select').nth(1).selectOption({ label: 'Boutique Wine Importers Pty Ltd' });
  await page.waitForTimeout(300);
  await page.locator('input[placeholder="0"]').fill('1200');
  await page.locator('input[placeholder="0.00"]').fill('8.80');
  await page.locator('select').nth(2).selectOption({ label: 'Head Office' });
  await shot('po_form_filled');
  await page.getByRole('button', { name: /Place order|Save|Submit/i }).first().click();
  await page.waitForTimeout(1000);
  await shot('po_result');

  // === Receive 1200 bottles (100 cartons x 12/carton) at Head Office ===
  await page.goto('/stock/stock-receipt');
  await page.waitForTimeout(800);
  await page.locator('select').nth(0).selectOption({ label: 'Boutique Wine Importers Pty Ltd' });
  await page.waitForTimeout(300);
  await page.locator('select').nth(1).selectOption({ label: 'Amber Ale 330ml' });
  await page.waitForTimeout(300);
  await page.locator('select').nth(2).selectOption({ label: 'Amber Ale 330ml' });
  await page.waitForTimeout(300);
  await page.locator('input[placeholder="e.g. RCPT-1001"]').fill('SIMPLE-TEST-RECV-1');
  await page.locator('input[placeholder="e.g. PO-1001"]').fill('SIMPLE-TEST-PO-1');
  await page.waitForTimeout(500);
  await page.locator('input[placeholder="0"]').first().fill('1200');
  await page.locator('input[placeholder="0.00"]').fill('10560.00');
  await shot('receipt_form_filled');
  await page.getByRole('button', { name: /Receive|Post|Save/i }).first().click();
  await page.waitForTimeout(1000);
  await shot('receipt_result');
});
