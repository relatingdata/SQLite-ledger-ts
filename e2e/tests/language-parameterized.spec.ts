import { test, expect } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';
import { login } from './helpers.js';

// Every real, supported language — no separate, hardcoded list to
// keep in sync elsewhere; if a new language is ever added to the app
// (see backend/schema.sql's Languages), it needs adding here too,
// but nothing about the *translated text itself* is duplicated.
// Hebrew and Arabic are real, genuinely-loaded languages too (see
// shared-fixtures/translations.csv and the Translator screen) and
// belong in this check exactly as much as the others — confirmed
// directly against the live backend that every key used below has a
// real, non-fallback translation in all seven.
const LANGUAGES = ['English', 'German', 'French', 'Danish', 'Italian', 'Hebrew', 'Arabic'];

// Real, known vocabulary keys this test checks against real pages —
// keys, not hardcoded translated strings. The actual expected text
// for each language is fetched live from the app's own
// /api/i18n/text/:language endpoint (exactly what powers
// $translations in the real UI), so this test can never drift out of
// sync with the real data the way a hardcoded string could.
//
// These three were chosen and verified directly against the real
// frontend source and the live /api/i18n/vocabulary-words data: the
// URL is a real route, the waitFor selector is the real wrapper class
// each of those pages actually renders (`.page-title` — neither
// `.intro-wrap` nor `.heading-wrap`, used by an earlier version of
// this list, exists anywhere in the frontend), and the key is a
// concept with a real, non-fallback translation in every language
// above, not just the four this list used to cover. `/setup/divisions`
// was also dropped: there is no such route in the app (Divisions are
// managed from the generic hierarchy/tree editor), so that check could
// never have passed.
const CHECKS: { url: string; waitFor: string; key: string }[] = [
  { url: '/setup/business-setup', waitFor: '.page-title', key: 'Business Setup' },
  { url: '/setup/periods', waitFor: '.page-title', key: 'Accounting Periods' },
  { url: '/stock/po', waitFor: '.page-title', key: 'Purchase Order' },
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
    await page.getByRole('button', { name: /continue|weiter|continuer|fortsæt|continua|המשך|متابعة/i }).click();
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
