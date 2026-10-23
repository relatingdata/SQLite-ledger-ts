import { test, expect } from '@playwright/test';
import { fixtures } from '../../shared-fixtures/wine-retail.js';
import { login } from './helpers.js';

// Every supported language (backend/schema.sql's Languages) — must stay in sync if a
// language is added. Hebrew and Arabic are genuinely-loaded languages too (see
// shared-fixtures/translations.csv and the Translator screen).
const LANGUAGES = ['English', 'German', 'French', 'Danish', 'Italian', 'Hebrew', 'Arabic'];

// Keys (not hardcoded translated strings) checked against real pages — the expected
// text for each is fetched live from /api/i18n/text/:language, the same source the
// UI itself uses, so this can't drift from a hand-maintained copy.
const CHECKS: { url: string; waitFor: string; key: string }[] = [
  { url: '/setup/business-setup', waitFor: '.page-title', key: 'Business Setup' },
  { url: '/setup/periods', waitFor: '.page-title', key: 'Accounting Periods' },
  { url: '/stock/po', waitFor: '.page-title', key: 'Purchase Order' },
];

for (const language of LANGUAGES) {
  test(`UI text matches the real, current translation data for ${language}`, async ({ page, request }) => {
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
      expect(expectedText, `${language} is missing a real translation for "${check.key}"`).toBeTruthy();

      await page.goto(check.url);
      await page.waitForSelector(check.waitFor, { timeout: 8000 });
      await page.waitForTimeout(300);
      await expect(page.locator('body')).toContainText(expectedText!);
    }
  });
}
