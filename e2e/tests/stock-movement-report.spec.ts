import { test, expect } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';
import { login } from './helpers.js';

test('stock movement report shows real purchases, transfers, and sales, groupable by division/location/vendor/category', async ({ page }) => {
  await login(page);
  await page.locator('select').first().selectOption({ label: fixtures.business });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.goto('/reports/stock-movement');
  await page.waitForSelector('.grid-box, .empty', { timeout: 15000 });
  await page.locator('input[type="date"]').first().fill('2027-03-01');
  await page.locator('input[type="date"]').nth(1).fill('2027-03-28');
  await page.waitForTimeout(1500);

  // Purchases tab, grouped by division by default.
  await expect(page.locator('.group-head', { hasText: 'Head Office Division' })).toBeVisible();
  await expect(page.locator('.group-head', { hasText: 'Warehouse B Division' })).toBeVisible();

  // A real, bounded detail view — never an unbounded, page-breaking dump of every row at once.
  await page.locator('.group-head', { hasText: 'Head Office Division' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(56);

  // Transfers correctly has no real division of its own.
  await page.getByRole('button', { name: 'Transfers' }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('text=Transfers have no real Division')).toBeVisible();

  // Group by location instead — real transfers now show up.
  await page.locator('select').first().selectOption('location');
  await page.waitForTimeout(1000);
  await expect(page.locator('.group-head').first()).toBeVisible();

  // Sales tab, grouped by provider — a real, known total.
  await page.getByRole('button', { name: 'Sales', exact: true }).click();
  await page.locator('select').first().selectOption('provider');
  await page.waitForTimeout(1000);
  await expect(page.locator('.group-head', { hasText: 'Boutique Wine Importers' })).toContainText('192,835.33');
});
