import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test('Sales Invoices defaults to real account invoices only, with real pagination when showing everything', async ({ page }) => {
  await login(page);
  await page.locator('select').first().selectOption({ label: 'Wine Retail Company' });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.goto('/invoices');
  await page.waitForSelector('.list-card', { timeout: 8000 });
  await page.waitForTimeout(800);

  // A real, direct fix for a reported bug: the default view must never be flooded with thousands of POS sales.
  await expect(page.locator('.entry')).toHaveCount(3);

  const sourceSelect = page.locator('.source-filter select');
  await sourceSelect.selectOption('all');
  await page.waitForTimeout(800);
  await expect(page.locator('.entry')).toHaveCount(50);
  await expect(page.locator('.page-summary')).toContainText('of 884');

  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(600);
  await expect(page.locator('.page-summary')).toContainText('51–100 of 884');
});
