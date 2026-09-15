import { test, expect } from '@playwright/test';

// A minimal, direct e2e test against 'My Business' - the one, real,
// always-present dummy company - not the larger Wine Retail Business
// dataset. Backend math for capacity tracking is already thoroughly,
// directly verified via 4 real backend tests (no browser needed for
// that); this test's real job is narrower: confirm the Location Type
// extensibility fix genuinely works through the real UI.
test('Location Type extensibility, against the minimal My Business dataset', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/login');
  await page.waitForTimeout(1000);
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('changeme123');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'));
  await page.waitForTimeout(500);
  await page.locator('select').first().selectOption({ label: 'My Business' });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await page.waitForTimeout(500);

  await page.goto('/locations');
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: '+ New Location' }).click();
  await page.waitForTimeout(500);

  await page.getByRole('group', { name: 'Location name, e.g. Downtown Cellar', exact: true }).locator('input').fill('E2ETest Wine Bar');
  await page.getByRole('group', { name: 'City', exact: true }).locator('input').fill('Adelaide');

  // The real, direct point of this test: add a genuinely new, custom
  // location type through the UI, confirming the fix that replaced a
  // hardcoded two-option dropdown with the backend's own, already-real,
  // extensible mechanism.
  await page.locator('input[placeholder="New type…"]').fill('Wine Bar');
  await page.getByRole('button', { name: '+ Add type' }).click();
  await page.waitForTimeout(800);

  const typeSelect = page.getByRole('group', { name: 'Type', exact: true }).locator('select');
  await expect(typeSelect).toHaveValue('Wine Bar');

  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(800);

  await page.screenshot({ path: '/tmp/location_type_extensibility.png', fullPage: true });

  // A real, second, independent confirmation: reload and re-open the
  // form - the new type must now be a real, persisted, selectable
  // option, not just a transient, in-memory one from the same session.
  await page.goto('/locations');
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: '+ New Location' }).click();
  await page.waitForTimeout(500);
  const reloadedOptions = await page.getByRole('group', { name: 'Type', exact: true }).locator('select option').allTextContents();
  expect(reloadedOptions).toContain('Wine Bar');
});
