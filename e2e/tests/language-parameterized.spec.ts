import { test, expect } from '@playwright/test';
import fixtures from '../../shared-fixtures/wine-retail.json' with { type: 'json' };
import { login } from './helpers.js';

// Every real, supported language — no separate, hardcoded list to
// keep in sync elsewhere; if a new language is ever added to the app
// (see backend/schema.sql's Languages), it needs adding here too,
// but nothing about the *translated text itself* is duplicated.
const LANGUAGES = ['English', 'German', 'French', 'Danish', 'Italian'];

// Real, known vocabulary keys this test checks against real pages —
// keys, not hardcoded translated strings. The actual expected text
// for each language is fetched live from the app's own
// /api/i18n/text/:language endpoint (exactly what powers
// $translations in the real UI), so this test can never drift out of
// sync with the real data the way a hardcoded string could.
const CHECKS: { url: string; waitFor: string; key: string }[] = [
  { url: '/setup/divisions', waitFor: '.intro-wrap', key: 'Divisions' },
  { url: '/stock/po', waitFor: '.heading-wrap', key: 'Purchase Order' },
  { url: '/pos', waitFor: '.heading-wrap', key: 'POS Terminal' },
];

for (const language of LANGUAGES) {
  test(`UI text matches the real, current translation data for ${language}`, async ({ page, request }) => {
    // Fetch the real, live translation map directly from the app's
    // own API — the same data source the real UI itself uses, not a
    // second, hand-maintained copy that could go stale.
    const response = await request.get(`http://localhost:3001/api/i18n/text/${language}`);
    expect(response.ok()).toBeTruthy();
    const realTranslations: Record<string, string> = await response.json();

    await login(page);
    await page.locator('select').first().selectOption({ label: fixtures.business });
    await page.waitForTimeout(300);
    if (language !== 'English') {
      // English is the default; only switch away from it explicitly.
      await page.locator('select').nth(2).selectOption({ label: language });
      await page.waitForTimeout(300);
    }
    await page.getByRole('button', { name: /continue|weiter|continuer|fortsæt|continua/i }).click();
    await page.waitForURL((url) => url.pathname === '/');

    for (const check of CHECKS) {
      const expectedText = realTranslations[check.key];
      // Every one of these keys must have a real translation for
      // every real, supported language — if one is missing, that's a
      // real, genuine gap this test should catch, not silently skip.
      expect(expectedText, `${language} is missing a real translation for "${check.key}"`).toBeTruthy();

      await page.goto(check.url);
      await page.waitForSelector(check.waitFor, { timeout: 8000 });
      await page.waitForTimeout(300);
      await expect(page.locator('body')).toContainText(expectedText!);
    }
  });
}
