import { test, expect } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';
import { login } from './helpers.js';

test('a new product can be assigned a real category directly on the Items page, without the Entity Editor', async ({ page }) => {
  await login(page);
  await page.locator('select').first().selectOption({ label: fixtures.business });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.goto('/items');
  await page.waitForSelector('.add-item');

  // Pick an existing category directly
  await page.locator('.add-item input').first().fill('Test Vodka Product');
  await page.locator('.add-item select').first().selectOption({ label: 'Vodka' });
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.waitForTimeout(800);
  await expect(page.locator('.entry', { hasText: 'Test Vodka Product' })).toBeVisible();
  await expect(page.locator('.entry', { hasText: 'Test Vodka Product' }).locator('.cat')).toHaveText('Vodka');

  // Create a genuinely new category on the fly
  await page.locator('.add-item input').first().fill('Test New Category Product');
  await page.locator('.add-item select').first().selectOption('__new__');
  await page.waitForTimeout(300);
  await page.locator('.new-category-form input').fill('Dessert Wine');
  await page.locator('.new-category-form select').selectOption({ label: 'under Red Wine' });
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.waitForTimeout(800);
  await expect(page.locator('.entry', { hasText: 'Test New Category Product' }).locator('.cat')).toHaveText('Dessert Wine');
});
