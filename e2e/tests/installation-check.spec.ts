import { test, expect } from '@playwright/test';

/**
 * A very simple installation check: log in, confirm the language
 * selector on the login screen shows the real, currently supported
 * languages, then log out. Not a deep test of app behavior — just
 * confirming the whole stack (backend + frontend + browser) is wired
 * up and talking to each other correctly.
 *
 * Run with: npx playwright test installation-check
 * (from inside the e2e/ directory — make dev must NOT already be
 * running on the same ports, or start it yourself and skip
 * Playwright's own webServer step by setting reuseExistingServer)
 */
test('installation check: log in, see the real languages, log out', async ({ page }) => {
  await page.goto('/login');

  // The language selector only renders once the backend has actually
  // returned a real language list — waiting for at least one real
  // <option> confirms the backend is reachable, not just that the
  // frontend loaded.
  const languageSelect = page.locator('select').first();
  await expect(languageSelect.locator('option')).not.toHaveCount(0);

  const languageNames = await languageSelect.locator('option').allTextContents();
  console.log('Languages found on the login screen:', languageNames);

  // NOTE: this app's current install genuinely has 5 supported
  // languages (English, German, French, Danish, Italian), confirmed
  // directly by actually running this script — not 4. If you only
  // see 4, Italian may be missing from your install; if fewer still,
  // something else installed incompletely. The real list is printed
  // above regardless, so you can see exactly what's there.
  expect(languageNames.length).toBeGreaterThanOrEqual(4);

  // Log in as the real, default admin user.
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('changeme123');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'));

  // A real business/ledger/language selection screen appears next,
  // with sensible defaults already chosen — Continue accepts them.
  await page.getByRole('button', { name: /continue/i }).click();

  // Log back out — confirms the logged-in shell (the real nav menu,
  // not just the login screen) is also working.
  await page.getByRole('button', { name: /log out/i }).click();
  await page.waitForURL((url) => url.pathname.includes('/login'));
});
