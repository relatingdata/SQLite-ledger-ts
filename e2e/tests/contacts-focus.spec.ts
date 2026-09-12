import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test('Contacts page is context-aware — the real, focused category shown depends on which real menu link was used', async ({ page }) => {
  await login(page);
  await page.locator('select').first().selectOption({ label: 'Wine Retail Company' });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.getByRole('button', { name: 'Accounts Receivable (Debtors / Sales)' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('link', { name: 'Customers' }).click();
  await page.waitForTimeout(700);

  await expect(page.locator('.page-title legend')).toContainText('Customers');
  await expect(page.getByRole('link', { name: 'Customers' })).toHaveClass(/active/);
  await expect(page.locator('.list-card')).toHaveCount(1);

  await page.getByRole('button', { name: 'Accounts Payable (Creditors / Purchasing)' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('link', { name: 'Vendors' }).click();
  await page.waitForTimeout(700);

  await expect(page.locator('.page-title legend')).toContainText('Vendors');
  await expect(page.locator('.list-card')).toHaveCount(1);

  await page.getByRole('button', { name: 'Show everything' }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('.list-card')).toHaveCount(4);
});
