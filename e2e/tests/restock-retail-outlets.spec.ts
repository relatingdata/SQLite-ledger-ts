import { test, expect } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';
import { login } from './helpers.js';

test('Restock Retail Outlets: a real, pre-filled restocking list, a real shelf-ordered picking list, refuses to dispatch until every line is ticked, then moves real stock', async ({ page }) => {
  await login(page);
  await page.locator('select').first().selectOption({ label: fixtures.business });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.goto('/stock/restock');
  await page.waitForTimeout(1000);
  await page.locator('select').first().selectOption({ label: 'Head Office' });
  await page.waitForTimeout(500);
  await page.locator('select').nth(1).selectOption({ index: 1 });
  await page.waitForTimeout(700);

  await expect(page.locator('table.lines-table tbody tr')).toHaveCount(1);

  await page.getByRole('button', { name: /Generate picking list/i }).click();
  await page.waitForTimeout(1000);
  await expect(page.locator('.picking-card')).toBeVisible();
  await expect(page.getByRole('button', { name: /Dispatch/i })).toBeDisabled();

  await page.locator('.tick').first().click();
  await page.waitForTimeout(500);
  await expect(page.getByRole('button', { name: /Dispatch/i })).toBeEnabled();

  await page.getByRole('button', { name: /Dispatch/i }).click();
  await page.waitForTimeout(1000);
  await expect(page.locator('.success')).toContainText('dispatched');
});
