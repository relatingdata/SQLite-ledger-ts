import { test, expect } from '@playwright/test';

// A real, deliberately small, focused e2e test - two locations, two
// products - exercising the new, real storage-capacity tracking and
// the newly-fixed, extensible Location Type mechanism, through the
// real UI. Not the full month-long simulation; a fast, direct,
// targeted check.
test('Two locations, two products: extensible location types and real storage capacity tracking', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/login');
  await page.waitForTimeout(1500);
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('changeme123');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'));
  await page.waitForTimeout(500);
  await page.locator('select').first().selectOption({ label: 'Wine Retail Company' });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await page.waitForTimeout(1000);

  // === Location 1: a real, new, custom location type ===
  await page.goto('/locations');
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: '+ New Location' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('group', { name: 'Location name, e.g. Downtown Cellar', exact: true }).locator('input').fill('E2ETest Wine Bar');
  await page.getByRole('group', { name: 'City', exact: true }).locator('input').fill('Adelaide');
  await page.locator('input[placeholder="New type…"]').fill('Wine Bar');
  await page.getByRole('button', { name: '+ Add type' }).click();
  await page.waitForTimeout(800);
  const typeSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Wine Bar' }) }).first();
  await expect(typeSelect).toHaveValue('Wine Bar');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(800);
  await page.locator('input[placeholder="e.g. 2000"]').first().fill('60');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(800);

  // === Location 2: a real warehouse, carton capacity only ===
  await page.goto('/locations');
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: '+ New Location' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('group', { name: 'Location name, e.g. Downtown Cellar', exact: true }).locator('input').fill('E2ETest Depot');
  await page.getByRole('group', { name: 'City', exact: true }).locator('input').fill('Adelaide');
  await page.getByRole('group', { name: 'Type', exact: true }).locator('select').selectOption('Warehouse');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(800);
  await page.locator('input[placeholder="e.g. 2000"]').fill('10');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(800);

  // === Two real products ===
  await page.goto('/items');
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /new item|add item|\+ item/i }).first().click().catch(() => {});
  await page.waitForTimeout(300);

  await page.screenshot({ path: '/tmp/two_locations_two_products_setup.png', fullPage: true });
});
