import { test, expect } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';
import { login } from './helpers.js';

test('Contacts page correctly uses the shared AddressList/PhoneList components', async ({ page }) => {
  await login(page);
  await page.locator('select').first().selectOption({ label: fixtures.business });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.goto('/contacts');
  await page.waitForSelector('.list-card');
  // Select the first real customer
  await page.locator('.lists .entry').first().click();
  await page.waitForTimeout(500);

  // Confirm the AddressList/PhoneList components render (their real legends)
  await expect(page.locator('legend', { hasText: 'Addresses' })).toBeVisible();
  await expect(page.locator('legend', { hasText: 'Phone numbers' })).toBeVisible();
  // Confirm the OLD address_line1/phone fields are gone
  await expect(page.getByText('Address line 1')).toHaveCount(0);

  // Add a real address purely via Insert key
  await page.getByText('No addresses yet').click();
  await page.keyboard.press('Insert');
  await page.waitForTimeout(300);
  await page.locator('textarea').fill('88 Vendor Way');
  await page.getByRole('button', { name: 'Save Address' }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('.repeat-block-body')).toContainText('88 Vendor Way');
});
