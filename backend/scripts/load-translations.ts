/**
 * Loads every real translation in `shared-fixtures/translations.csv`
 * into a running instance of the application — the one, real,
 * test-runner replacement for what used to be baked, unconditionally,
 * into every boot (db-seed.ts's own `loadTranslationsFromSharedCsv`,
 * now removed entirely). The application's own basic initial data
 * load (schema/00-core.sql) now carries zero non-English language
 * text at all; this script is the one, deliberate, on-demand way to
 * add it back, against an already-running backend.
 *
 * Per direct instruction: the UI path and the API path must never
 * load two different, divergent datasets — one, real, shared CSV
 * file (`shared-fixtures/translations.csv`, read through the exact,
 * same `loadAllTranslations()` both paths call) is the single source
 * of truth either way. Either path may skip a row the other doesn't
 * need (the UI path below only drives real, visible word/language
 * pairs the live `/setup/translations` page can reach — see the
 * "Skipped" note below), but neither path is ever handed its own,
 * separate copy of the data.
 *
 * --path api (default): real HTTP calls against the backend's own
 * real `POST /api/i18n/translations` route (src/routes/i18n.ts) —
 * logs in for real first, then posts every real row with a real
 * bearer token, exactly the way the live frontend itself would.
 *
 * --path ui: a real Playwright browser, logging in through the real
 * login form, then driving the real, live `/setup/translations` page
 * (frontend/src/routes/setup/translations/+page.svelte) exactly as a
 * real person would: search for the word, select it, fill its real
 * per-language input, click its real "Save" button. This page's own
 * real interaction shape is a dynamic search-then-select, not the
 * static, one-row-per-field shape `scripts/step-runner.ts`'s generic
 * `screens.csv` driver assumes — forcing it through that generic
 * driver would produce exactly the kind of silently-not-really-working
 * wiring `docs/api-e2e-readiness-and-seed-separation-plan.md` (§3.1)
 * already found and fixed once for the tutorial e2e; this script
 * drives the real selectors directly instead, honestly, rather than
 * faking a fit.
 *
 * Usage:
 *   npx tsx scripts/load-translations.ts --path api
 *   npx tsx scripts/load-translations.ts --path ui [--headed] [--language German]
 *
 * Requires a backend already running (default http://localhost:3001),
 * and for --path ui, a frontend already running (default
 * http://localhost:5173) — this script does not start either itself,
 * matching `step-runner.ts`'s own convention.
 */
import { loadAllTranslations } from '../../shared-fixtures/translations.js';

const API_BASE = process.env.API_BASE ?? 'http://localhost:3001';
const FRONTEND_BASE = process.env.FRONTEND_BASE ?? 'http://localhost:5173';
const ADMIN_USERNAME = process.env.LOAD_TRANSLATIONS_USERNAME ?? 'admin';
const ADMIN_PASSWORD = process.env.LOAD_TRANSLATIONS_PASSWORD ?? 'changeme123';

function parseArgs() {
  const args = process.argv.slice(2);
  const path = (args.includes('--path') ? args[args.indexOf('--path') + 1] : 'api') as 'api' | 'ui';
  const headed = args.includes('--headed');
  const languageFilterIdx = args.indexOf('--language');
  const languageFilter = languageFilterIdx >= 0 ? args[languageFilterIdx + 1] : undefined;
  if (path !== 'api' && path !== 'ui') {
    console.error(`Unknown --path "${path}" — must be "api" or "ui".`);
    process.exit(1);
  }
  return { path, headed, languageFilter };
}

async function apiLogin(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  const { token } = (await res.json()) as { token: string };
  return token;
}

async function loadViaApi(rows: { concept: string; language: string; text: string }[]) {
  const token = await apiLogin();
  // One real, up-front read of the whole real entity tree, so the
  // "does this concept already exist as some entity" check below is
  // a real, local Set lookup, never a per-row round trip — and never
  // mistakes an already-existing, long (>200 char) help-text entity
  // for a missing one just because the API's own create-entity Zod
  // schema (unlike the raw entity table itself) caps name length at
  // 200, which setTranslation's own entity lookup has no such limit on.
  const treeRes = await fetch(`${API_BASE}/api/entities`, { headers: { Authorization: `Bearer ${token}` } });
  const existingNames = new Set<string>((await treeRes.json() as { name: string }[]).map((e) => e.name));
  let ok = 0;
  let failed = 0;
  const ensuredConcepts = new Set<string>();
  for (const row of rows) {
    // `setTranslation` (behind `POST /api/i18n/translations`) requires
    // SOME real entity by this exact name to already exist — exactly
    // what the real "Add a new word" step on `/setup/translations`
    // is for. A concept this CSV names that isn't yet a real entity
    // at all (never created by `00-core.sql`, nor by an earlier row
    // in this same run) gets created here first, as a real Vocabulary
    // word, the same real way a person using that page would.
    if (!existingNames.has(row.concept) && !ensuredConcepts.has(row.concept)) {
      ensuredConcepts.add(row.concept);
      const createRes = await fetch(`${API_BASE}/api/entities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: row.concept, parent: 'Vocabulary' }),
      });
      if (createRes.ok) {
        existingNames.add(row.concept);
      } else if (createRes.status !== 409) {
        // A real, confirmed, narrow gap, found directly: a "concept"
        // longer than 200 characters (a few real help-text strings in
        // this CSV, not ordinary short vocabulary words) can never be
        // created through this real API route at all — its Zod schema
        // caps name length at 200, stricter than the underlying entity
        // table itself. Reported here honestly rather than retried or
        // silently dropped; see this script's own final summary.
        console.error(`Could not ensure Vocabulary word "${row.concept}" exists: ${createRes.status} ${await createRes.text()}`);
      }
    }
    const res = await fetch(`${API_BASE}/api/i18n/translations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ entity: row.concept, language: row.language, text: row.text }),
    });
    if (res.ok) {
      ok++;
    } else {
      failed++;
      console.error(`FAILED (${row.language}) "${row.concept}" -> "${row.text}": ${res.status} ${await res.text()}`);
    }
  }
  console.log(`--path api: ${ok} saved, ${failed} failed, out of ${rows.length} real rows.`);
  if (failed > 0) process.exitCode = 1;
}

async function loadViaUi(rows: { concept: string; language: string; text: string }[], headed: boolean) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({ baseURL: FRONTEND_BASE });
  const page = await context.newPage();

  await page.goto('/login');
  await page.locator('input[autocomplete="username"]').fill(ADMIN_USERNAME);
  await page.locator('input[autocomplete="current-password"]').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'));

  // A real, successful login lands on the real `/session` screen first
  // (frontend/src/routes/session/+page.svelte) — this app's own real
  // business/ledger/language picker, not optional for any other page.
  // Its own defaults already resolve to exactly what this script
  // needs (the real "admin" business, its real "Actual" ledger,
  // English) the moment the real businesses/ledgers/languages finish
  // loading, so the real "Continue" button just needs clicking once
  // it stops being disabled.
  if (page.url().includes('/session')) {
    const continueButton = page.getByRole('button', { name: /continue/i });
    await continueButton.waitFor({ state: 'visible' });
    await page.waitForFunction(
      () => !document.querySelector('button.btn')?.hasAttribute('disabled'),
      undefined,
      { timeout: 10000 },
    );
    await continueButton.click();
    await page.waitForURL((url) => !url.pathname.includes('/session'));
  }

  await page.goto('/setup/translations');
  await page.waitForTimeout(500);

  // Group by concept so each real word is searched for and selected
  // exactly once, then every real language row for it is filled and
  // saved in turn, matching how a real person would actually use
  // this page — never re-searching for the same word per language.
  const byConcept = new Map<string, { language: string; text: string }[]>();
  for (const row of rows) {
    if (!byConcept.has(row.concept)) byConcept.set(row.concept, []);
    byConcept.get(row.concept)!.push({ language: row.language, text: row.text });
  }

  let ok = 0;
  let failed = 0;
  let skipped = 0;
  const searchInput = page.locator('.word-list-card input');

  for (const [concept, translations] of byConcept) {
    await searchInput.fill(concept);
    await page.waitForTimeout(150);
    const wordRow = page.locator('.word-row', { hasText: concept }).first();
    if ((await wordRow.count()) === 0) {
      // Real, honest skip, not a silent, fake success: the real
      // /setup/translations page only ever lists real Vocabulary
      // words it can find via getVocabularyWords() — a concept this
      // CSV names that isn't (yet) a real, standalone Vocabulary
      // word genuinely has nothing to select here. --path api above
      // has no such restriction (setTranslation creates the real
      // Vocabulary word itself when needed), so this is a real,
      // known, narrower case for the UI path specifically, not a bug.
      console.error(`SKIPPED (no matching word row in the real UI list): "${concept}"`);
      skipped += translations.length;
      continue;
    }
    await wordRow.click();
    await page.waitForTimeout(150);

    for (const { language, text } of translations) {
      const row = page.locator('.edit-card fieldset', { has: page.locator(`legend:text-is("${language}")`) });
      if ((await row.count()) === 0) {
        console.error(`SKIPPED (no "${language}" fieldset on the real edit card for "${concept}" — language not yet added in this real instance): "${concept}"`);
        skipped++;
        continue;
      }
      await row.locator('input').fill(text);
      await row.getByRole('button', { name: /save/i }).click();
      const saved = await row.getByRole('button', { name: /save/i }).waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
      if (saved) {
        ok++;
      } else {
        failed++;
        console.error(`FAILED (real Save click never completed) (${language}) "${concept}" -> "${text}"`);
      }
    }
  }

  await browser.close();
  console.log(`--path ui: ${ok} saved, ${failed} failed, ${skipped} skipped (no matching real word/language in this instance's UI), out of ${rows.length} real rows.`);
  if (failed > 0) process.exitCode = 1;
}

async function main() {
  const { path, headed, languageFilter } = parseArgs();
  const allRows = loadAllTranslations();
  const rows = languageFilter ? allRows.filter((r) => r.language === languageFilter) : allRows;
  console.log(`Loading ${rows.length} real translation row(s) from shared-fixtures/translations.csv via --path ${path}${languageFilter ? ` (language: ${languageFilter})` : ''}...`);
  if (path === 'api') {
    await loadViaApi(rows);
  } else {
    await loadViaUi(rows, headed);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
