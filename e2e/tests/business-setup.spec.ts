import { test, expect } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';
import { login } from './helpers.js';

// Per a real, confirmed, separate finding (docs/TODO.md): "Wine Retail
// Business" (this demo fixture) seeds its own real locations under a
// legacy, combined-name root ("Wine Retail Business Locations" - one
// entity, predating the modern per-business root convention every
// business created through the application itself actually uses -
// PER_BUSINESS_ROOTS: a plain "Locations" child of the business).
// getOrganizationChart's own businessLocationNames lookup, and
// setLocation/createEntity's own "Locations child of this business"
// lookup used when creating or saving a location, both only recognize
// the modern shape - so, for this one, specific demo business, the
// Business Setup tree shows no groups/locations at all, AND creating
// or saving a new real location against it fails outright (confirmed
// independently by wine-business-setup.spec.ts timing out against
// /locations for the exact, same, root-cause reason). Neither is
// fixed here - migrating this one, large, pre-existing demo dataset
// onto the modern root shape is its own, real, separate, riskier
// undertaking, deliberately not folded into an unrelated refactor.
// This spec therefore only covers what is genuinely, currently
// functional against this business: company-wide staff display, and
// group/division creation (createHierarchyValue/setEntityRelationship
// - neither touches the Locations root at all). Location/employee/
// open-hours/schedule coverage for Business Setup is exercised
// instead by `make test-e2e-tutorial-browser`, which runs against a
// correctly-structured, freshly-created business.
test('Business Setup: the tree, company-wide staff, and group creation via Insert', async ({ page }) => {
  await login(page);
  await page.locator('select').first().selectOption({ label: fixtures.business });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await page.goto('/setup/business-setup');
  await page.waitForTimeout(1500);

  // Company-wide staff is read directly off "Place of Employment" ->
  // business, with no dependency on the Locations tree at all.
  await expect(page.getByText('Company-wide staff')).toBeVisible();

  // A real, new group (named "Division" here, this page's own default
  // suggestion for a business with no hierarchy configured yet) can
  // be created directly from this screen — per a real, confirmed,
  // deliberate design change: keyboard-driven (Insert/Delete), not a
  // dedicated button. Focus must land on the real toolbar div the
  // keydown handler is actually attached to (role="toolbar",
  // aria-keyshortcuts="Insert Delete") — not the surrounding fieldset,
  // which cannot itself receive focus.
  await page.locator('[aria-keyshortcuts="Insert Delete"]').focus();
  await page.keyboard.press('Insert');
  await page.waitForTimeout(300);
  await page.locator('input[placeholder="Division name"]').fill('Testburg');
  await page.locator('.inline-add .btn.small').first().click();
  await page.waitForTimeout(1000);
  await expect(page.getByRole('button', { name: 'Testburg' })).toBeVisible();

  // Selecting the new group shows its own, real, dynamic hint text —
  // never a hardcoded "division" literal baked into the template.
  await page.getByRole('button', { name: 'Testburg' }).click();
  await page.waitForTimeout(300);
  await expect(page.getByText('is purely a reporting grouping')).toBeVisible();

  // Delete removes it again — the other half of the same, real
  // Insert/Delete pattern.
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[aria-keyshortcuts="Insert Delete"]').focus();
  await page.keyboard.press('Delete');
  await page.waitForTimeout(1000);
  await expect(page.getByRole('button', { name: 'Testburg' })).toHaveCount(0);
});
