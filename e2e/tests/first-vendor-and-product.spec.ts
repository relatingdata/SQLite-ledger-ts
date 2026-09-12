import { test, expect } from '@playwright/test';
import fixtures from '../../shared-fixtures/wine-retail.json' with { type: 'json' };
import { login } from './helpers.js';

test('demo: create the first real vendor with address/phone, then the first product they supply, in a new sub-category', async ({ page }) => {
  await login(page);
  await page.locator('select').first().selectOption({ label: fixtures.business });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  // Step 1: create the first real vendor
  await page.goto('/editor');
  await page.waitForSelector('table');
  await page.locator('input[placeholder="e.g. Gamma LLC"]').fill('Southern Highlands Vineyard');
  await page.locator('.card', { hasText: 'New entity' }).locator('select').first().selectOption({ label: 'Accounts Payable' });
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/demo_02_vendor_created.png', fullPage: true });

  // Step 2: select the new vendor to add its address/phone
  await page.locator('tr', { hasText: 'Southern Highlands Vineyard' }).click();
  await page.waitForTimeout(500);
  await page.getByText('No addresses yet').click();
  await page.keyboard.press('Insert');
  await page.waitForTimeout(300);
  await page.locator('textarea').fill('412 Old Hume Highway');
  await page.locator('input[placeholder="City"]').fill('Mittagong');
  await page.locator('input[placeholder="Region / State"]').fill('NSW');
  await page.locator('input[placeholder="Postal code"]').fill('2575');
  await page.locator('input[placeholder="Country"]').fill('Australia');
  await page.getByRole('button', { name: 'Save Address' }).click();
  await page.waitForTimeout(600);

  await page.getByText('No phone numbers yet').click();
  await page.keyboard.press('Insert');
  await page.waitForTimeout(300);
  await page.locator('input[type="tel"]').fill('02 4861 0198');
  await page.getByRole('button', { name: 'Save Phone' }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/demo_03_vendor_contact_details.png', fullPage: true });

  // Step 3: create a genuinely new product category, demonstrating real category flexibility
  await page.locator('input[placeholder="e.g. Gamma LLC"]').fill('Pinot Noir');
  await page.locator('.card', { hasText: 'New entity' }).locator('select').first().selectOption({ label: 'Red Wine' });
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(800);

  // Step 4: create the first real product this vendor supplies, under the new category
  await page.locator('input[placeholder="e.g. Gamma LLC"]').fill('Southern Highlands Pinot Noir 2024');
  await page.locator('.card', { hasText: 'New entity' }).locator('select').first().selectOption({ label: 'Pinot Noir' });
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/demo_04_product_and_category.png', fullPage: true });
});
