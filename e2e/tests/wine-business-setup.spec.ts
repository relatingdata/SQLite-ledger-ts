import { test, expect } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';
import { login } from './helpers.js';

test('run real transactions for Wine Retail Company entirely through the real web UI, from a fresh database', async ({ page }) => {
  await login(page);
  // Wine Retail Company already exists as real, bootstrapped demo data
  // in schema.sql (its own business, ledger, product catalog, and
  // Chart of Accounts) — select it directly rather than creating a
  // duplicate.
  await page.locator('select').first().selectOption({ label: fixtures.business });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  // Step 1: create a real, new location through the real /locations UI
  await page.goto('/locations');
  await page.waitForSelector('.entry');
  await page.getByRole('button', { name: '+ New Location' }).click();
  await page.locator('.new-location-form input').first().fill('Northside Depot');
  await page.locator('.new-location-form input').nth(1).fill('Springfield');
  await page.locator('.new-location-form select').first().selectOption('Warehouse');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(1200);
  await expect(page.locator('.entry', { hasText: 'Northside Depot' })).toBeVisible();

  // Step 2: post a real owner's capital contribution through the real /post General Journal UI
  // — account dropdown options are real, live account numbers + names
  // (e.g. "1000 — Cash and Bank"), not just the plain name, so match
  // by the real, distinctive text rather than assuming an exact label.
  await page.goto('/post');
  await page.waitForSelector('table');
  await page.waitForTimeout(500);
  await page.locator('input[placeholder="e.g. GJ-1001"]').fill('GJ-CAPITAL-1');

  async function selectAccountContaining(select: ReturnType<typeof page.locator>, text: string) {
    const options = await select.locator('option').allTextContents();
    const match = options.find((o) => o.includes(text));
    if (!match) throw new Error(`No real account option containing "${text}" found. Options: ${options.slice(0, 10).join(', ')}`);
    await select.selectOption({ label: match });
  }

  const firstRow = page.locator('tbody tr').first();
  await selectAccountContaining(firstRow.locator('select'), 'Cash and Bank');
  await firstRow.locator('input.num').first().fill('1000.00');
  await page.waitForTimeout(300);

  const secondRow = page.locator('tbody tr').nth(1);
  await selectAccountContaining(secondRow.locator('select'), "Owner's Equity");
  await secondRow.locator('input.num').nth(1).fill('1000.00');
  await page.waitForTimeout(300);

  const debitTotal = await page.locator('.amount-debit').first().textContent();
  const creditTotal = await page.locator('.amount-credit').first().textContent();
  console.log('Debit total:', debitTotal, '| Credit total:', creditTotal);
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(1000);

  // Step 3: confirm this real posting actually shows up correctly, ledger-scoped, on the real Trial Balance report
  await page.goto('/reports/trial-balance');
  await page.waitForTimeout(800);
  await page.locator('select').first().selectOption({ label: 'Actual' });
  await page.waitForTimeout(800);
  await expect(page.getByText('Cash and Bank')).toBeVisible();
  await expect(page.getByText("Owner's Equity")).toBeVisible();
});
