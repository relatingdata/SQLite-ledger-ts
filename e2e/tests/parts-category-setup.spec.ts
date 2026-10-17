import { test, expect } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';
import { login } from './helpers.js';

// Per direct instruction (docs/shared-tree-editor-component-plan.md Stage 2):
// the Items page was redesigned onto the same, real, shared TreeEditor
// idiom already proven for Business Setup - a selectable tree of
// categories/items, Insert/Delete as the add/remove mechanism, and a
// real, plain "+ Subcategory" link button for the one, secondary action
// (nesting a further category) deliberately kept outside Insert/Delete.
// This spec locks down exactly the same, real coverage the old,
// dropdown-driven flow had - assigning a new item to an existing
// category, and creating a genuinely new (now: nested) category on the
// fly - through the new UI.
test('a new item can be assigned a real category directly on the Items page, via Insert/Delete', async ({ page }) => {
  test.setTimeout(90000);
  await login(page);
  await page.locator('select').first().selectOption({ label: fixtures.business });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.goto('/items');
  await page.waitForSelector('[aria-keyshortcuts="Insert Delete"]');

  // Select an existing category, then Insert adds an item within it.
  await page.getByRole('button', { name: 'Vodka', exact: true }).click();
  await page.locator('[aria-keyshortcuts="Insert Delete"]').focus();
  await page.keyboard.press('Insert');
  await page.waitForSelector('input[placeholder="New item name"]');
  await page.locator('input[placeholder="New item name"]').fill('Test Vodka Product');
  await page
    .locator('.inline-add', { has: page.locator('input[placeholder="New item name"]') })
    .getByRole('button', { name: 'Add', exact: true })
    .click();
  await expect(page.getByRole('button', { name: /Test Vodka Product/ })).toBeVisible({ timeout: 15000 });

  // The new item shows up nested under "Vodka", and selecting it opens
  // its own, real detail panel (category line confirms the real parent).
  await page.getByRole('button', { name: /Test Vodka Product/ }).click();
  await expect(page.locator('.category-line')).toHaveText('Category: Vodka');

  // "+ Subcategory" (never Insert/Delete) nests a genuinely new category
  // under an existing one.
  await page.getByRole('button', { name: 'Red Wine', exact: true }).click();
  await page.getByRole('button', { name: '+ Subcategory' }).click();
  await page.waitForSelector('input[placeholder="Subcategory name"]');
  await page.locator('input[placeholder="Subcategory name"]').fill('Dessert Wine');
  await page
    .locator('.inline-add', { has: page.locator('input[placeholder="Subcategory name"]') })
    .getByRole('button', { name: 'Add', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Dessert Wine', exact: true })).toBeVisible({ timeout: 15000 });

  // Selecting the new subcategory and pressing Insert adds an item
  // within IT, not its parent - confirming real, arbitrary-depth nesting.
  await page.getByRole('button', { name: 'Dessert Wine', exact: true }).click();
  await page.locator('[aria-keyshortcuts="Insert Delete"]').focus();
  await page.keyboard.press('Insert');
  await page.waitForSelector('input[placeholder="New item name"]');
  await page.locator('input[placeholder="New item name"]').fill('Test New Category Product');
  await page
    .locator('.inline-add', { has: page.locator('input[placeholder="New item name"]') })
    .getByRole('button', { name: 'Add', exact: true })
    .click();
  await expect(page.getByRole('button', { name: /Test New Category Product/ })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /Test New Category Product/ }).click();
  await expect(page.locator('.category-line')).toHaveText('Category: Dessert Wine', { timeout: 15000 });

  // Delete removes the item first — revokeEntity refuses to remove a
  // category that still has real children — then the now-empty
  // subcategory, the same, real Insert/Delete pattern's other half.
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[aria-keyshortcuts="Insert Delete"]').focus();
  await page.keyboard.press('Delete');
  await expect(page.getByRole('button', { name: /Test New Category Product/ })).toHaveCount(0, { timeout: 15000 });

  await page.getByRole('button', { name: 'Dessert Wine', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[aria-keyshortcuts="Insert Delete"]').focus();
  await page.keyboard.press('Delete');
  await expect(page.getByRole('button', { name: 'Dessert Wine', exact: true })).toHaveCount(0, { timeout: 15000 });
});
