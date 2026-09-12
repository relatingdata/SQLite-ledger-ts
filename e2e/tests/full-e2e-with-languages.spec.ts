import { test, expect } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';

// Shares the exact, same real database used by `make test-e2e` -
// per direct instruction, this does NOT rebuild Wine Retail Company
// from scratch via slow UI clicks; it exercises the UI against the
// same, real, already-populated business simulate-wine-retail-month.ts
// creates, run first by the real Makefile target this test belongs to.

const EXPECTED_LANGUAGES = ['English', 'German', 'French', 'Danish', 'Italian', 'Hebrew', 'Arabic'];

test('All real languages are present, then Wine Retail Company (already populated) is exercised through the UI', async ({ page }) => {
  test.setTimeout(90000);

  // === Login ===
  await page.goto('/login');
  await page.waitForTimeout(2000);

  // === Every real language genuinely appears in the Login dropdown ===
  const loginLanguageOptions = await page.locator('select').first().locator('option').allTextContents();
  for (const lang of EXPECTED_LANGUAGES) {
    expect(loginLanguageOptions, `"${lang}" must appear in the real Login language list`).toContain(lang);
  }

  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('changeme123');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'));
  await page.waitForTimeout(500);

  // === Every real language also appears on Choose Business ===
  const sessionLanguageOptions = await page.locator('select').nth(2).locator('option').allTextContents();
  for (const lang of EXPECTED_LANGUAGES) {
    expect(sessionLanguageOptions, `"${lang}" must appear in the real Choose Business language list`).toContain(lang);
  }

  await page.locator('select').first().selectOption({ label: fixtures.business });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await page.waitForTimeout(500);

  // === Exercise the real, already-populated business ===
  await page.goto('/items');
  await page.waitForTimeout(2000);
  const itemCount = await page.locator('button.entry').count();
  expect(itemCount, 'Wine Retail Company must genuinely have real items, from the simulation already run').toBeGreaterThan(30);

  await page.goto('/reports/trial-balance');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/e2e_trial_balance.png', fullPage: true });

  await page.goto('/reports/profit-and-loss');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/e2e_profit_and_loss.png', fullPage: true });

  await page.goto('/locations');
  await page.waitForTimeout(2000);
  const locationCount = await page.locator('button.entry').count();
  expect(locationCount, 'Wine Retail Company must genuinely have real locations, from the simulation already run').toBeGreaterThan(3);
});
