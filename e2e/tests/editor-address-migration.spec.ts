import { test, expect } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';
import { login } from './helpers.js';

test('Structured Editor correctly uses the shared AddressList/PhoneList components', async ({ page }) => {
  await login(page);
  await page.locator('select').first().selectOption({ label: fixtures.business });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.goto('/editor');
  await page.waitForTimeout(1000);
  // Click the real vendor's own row specifically, by its name cell —
  // not just any row mentioning it, since real Purchase Order
  // entities now correctly carry this same vendor as their own real
  // relation (a working feature, not a bug), which would otherwise
  // make a broader row-text match genuinely ambiguous.
  await page.getByRole('row', { name: /^Boutique Wine Importers Pty Ltd/ }).click();
  await page.waitForTimeout(500);

  await expect(page.getByRole('heading', { name: 'Contact details' })).toBeVisible();
  await expect(page.locator('legend', { hasText: 'Addresses' })).toBeVisible();
  await expect(page.locator('legend', { hasText: 'Phone numbers' })).toBeVisible();
  await expect(page.getByText('Address line 1')).toHaveCount(0);

  // Confirm it's genuinely functional, not just visually present
  await page.getByText('No addresses yet').click();
  await page.keyboard.press('Insert');
  await page.waitForTimeout(300);
  await page.locator('textarea').fill('1 Import Terminal Road');
  await page.getByRole('button', { name: 'Save Address' }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('.repeat-block-body')).toContainText('1 Import Terminal Road');
});
