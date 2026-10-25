import { test, expect } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';
import { login } from './helpers.js';

// Scoped to what's functional against this demo business — see docs/pm-testing-e2e.md
// "Known gap: Wine Retail Business's legacy Locations root".
test('Business Setup: the tree, company-wide staff, and group creation via Insert', async ({ page }) => {
  await login(page);
  await page.locator('select').first().selectOption({ label: fixtures.business });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.goto('/setup/business-setup');
  await page.waitForTimeout(1500);

  // Company-wide staff is read off "Place of Employment" -> business, not the Locations tree.
  await expect(page.getByText('Company-wide staff')).toBeVisible();

  // Group creation is keyboard-driven (Insert/Delete); focus must land on the
  // toolbar div itself (role="toolbar"), not the surrounding fieldset.
  await page.locator('[aria-keyshortcuts="Insert Delete"]').focus();
  await page.keyboard.press('Insert');
  await page.waitForTimeout(300);
  await page.locator('input[placeholder="Division name"]').fill('Testburg');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  await expect(page.getByRole('button', { name: 'Testburg' })).toBeVisible();

  await page.getByRole('button', { name: 'Testburg' }).click();
  await page.waitForTimeout(300);
  await expect(page.getByText('is purely a reporting grouping')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[aria-keyshortcuts="Insert Delete"]').focus();
  await page.keyboard.press('Delete');
  await page.waitForTimeout(1000);
  await expect(page.getByRole('button', { name: 'Testburg' })).toHaveCount(0);
});
