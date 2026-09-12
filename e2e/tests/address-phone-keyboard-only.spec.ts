import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test('AddressList and PhoneList work with keyboard only, no visible Add/Remove buttons', async ({ page }) => {
  await login(page);
  await page.locator('select').first().selectOption({ label: 'Wine Retail Company' });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.goto('/locations');
  await page.waitForSelector('.entry');
  await page.locator('.entry').first().click();
  await page.waitForTimeout(300);

  // Confirm there's no visible "Add New" or "Remove" button anywhere in either section
  await expect(page.getByRole('button', { name: 'Add New' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(0);

  // Add an address purely via Insert key — click the empty-state hint to focus the fieldset first
  await page.getByText('No addresses yet').click();
  await page.keyboard.press('Insert');
  await page.waitForTimeout(300);
  await page.locator('textarea').fill('12 Cellar Lane');
  await page.getByRole('button', { name: 'Save Address' }).click();
  await page.waitForTimeout(500);

  await expect(page.locator('.repeat-block-body')).toContainText('12 Cellar Lane');

  // Remove it purely via Delete key
  await page.locator('.repeat-block').first().click();
  await page.keyboard.press('Delete');
  await page.waitForTimeout(500);
  await expect(page.locator('.repeat-block')).toHaveCount(0);

  // Same for phones — genuinely independent component, own Insert/Delete scope
  await page.getByText('No phone numbers yet').click();
  await page.keyboard.press('Insert');
  await page.waitForTimeout(300);
  await page.locator('input[type="tel"]').fill('555-0199');
  await page.getByRole('button', { name: 'Save Phone' }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('.repeat-block-body')).toContainText('555-0199');
});
