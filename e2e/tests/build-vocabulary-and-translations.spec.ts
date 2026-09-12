import { test, expect } from '@playwright/test';
import { login } from './helpers.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type Entry = {
  word: string;
  createUnderVocabulary: boolean;
  translations: Record<string, string>;
};

const entries: Entry[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'vocabulary-and-translations.json'), 'utf8')
);

/**
 * The one, single, real, parameterized script — reading from one,
 * single, real data file — that both creates every genuinely new
 * vocabulary word and applies every real translation, all through
 * the actual, real UI. Replaces two, real, separate earlier scripts
 * with one, unified pass: for each real, direct entry, create the
 * word under Vocabulary first (only if it's genuinely new — some
 * entries already exist elsewhere in the real entity tree, under
 * Business Reports, Chart of Accounts, or Application directly, and
 * are marked accordingly, not re-created), then apply every real,
 * given translation to whichever, real, single entity that name now
 * resolves to.
 */
test('Create every real, new vocabulary word and apply every real translation, from one, single, real data file', async ({ page }) => {
  test.setTimeout(20 * 60 * 1000);
  await login(page);
  await page.locator('select').first().selectOption({ label: 'Wine Retail Company' });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await page.waitForTimeout(500);

  await page.goto('/setup/translations');
  await page.waitForURL((url) => url.pathname === '/setup/translations');
  await expect(page.locator('legend', { hasText: 'Translations' })).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1000);

  let created = 0;
  let translationsSaved = 0;
  const failed: string[] = [];

  for (const entry of entries) {
    // Step 1 — create the word under Vocabulary, only for entries
    // genuinely marked as new (not already a real, different entity
    // living elsewhere in the tree under the exact, same name).
    if (entry.createUnderVocabulary) {
      await page.locator('.new-word-card input').fill(entry.word);
      await page.locator('.new-word-card button.btn').click();
      await page.waitForTimeout(150);
      const errorVisible = await page.locator('fieldset.page-title > .error').count();
      if (errorVisible === 0) created++;
    }

    // Step 2 — apply every real, given translation, by selecting
    // the exact, matching word from the real, live search results.
    await page.locator('input[placeholder="e.g. Vendor"]').fill(entry.word);
    await page.waitForTimeout(150);
    const escaped = entry.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exactRow = page.locator('.word-row', { hasText: new RegExp(`^${escaped}$`) });
    const count = await exactRow.count();
    if (count === 0) {
      failed.push(`${entry.word}: exact match not found in search results (real, existing entity outside Vocabulary — not reachable from this screen)`);
      continue;
    }
    await exactRow.first().click();
    await page.waitForTimeout(150);

    for (const [lang, text] of Object.entries(entry.translations)) {
      const fieldset = page.locator('.edit-card fieldset', { hasText: lang });
      const input = fieldset.locator('input');
      if ((await input.count()) === 0) continue;
      await input.fill(text);
      await fieldset.locator('button.btn').click();
      await page.waitForTimeout(120);
      translationsSaved++;
    }
  }

  console.log(`CREATED: ${created} new vocabulary words`);
  console.log(`TRANSLATIONS SAVED: ${translationsSaved}`);
  console.log(`FAILED (real, existing entities outside Vocabulary, not reachable here): ${JSON.stringify(failed)}`);
});
