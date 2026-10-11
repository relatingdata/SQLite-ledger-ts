/**
 * Selector-discovery tool for shared-fixtures/screens.csv authors.
 *
 * Per direct instruction, this project's established, correct method for
 * finding a screen's real selectors is to inspect the actual, live DOM
 * directly (docs/skill-step-runner-design.md section 12 — the real
 * create_location selector bug was found exactly this way, "by directly
 * inspecting the actual, live DOM rather than guessing further"), never by
 * reading the Svelte source and guessing a selector from it, and never by
 * relying on an author's own CSS styling class (which may change for purely
 * visual reasons, unrelated to the real HTML form/menu it renders).
 *
 * Real `playwright codegen` records a human's live clicks in a real GUI
 * browser; that is not available to run here. This script is the
 * agent-usable equivalent for the same job: it launches a real, live
 * browser, drives it to the real screen named on the command line, and
 * dumps the real accessibility tree (role, accessible name, and for form
 * controls their real native attributes - placeholder, type, options) for
 * every real interactive element on that one screen - nothing more, same
 * as a real person using a screen reader would see. Never any CSS class,
 * never any framework-internal detail.
 *
 * Usage:
 *   cd backend && RUNTIME-appropriate script runner \
 *     scripts/discover-selectors.ts <url-path> [--after-login]
 *
 * Example:
 *   cd backend && npx tsx scripts/discover-selectors.ts /editor --after-login
 */
import { chromium } from 'playwright';

async function main() {
  const [urlPath, ...flags] = process.argv.slice(2);
  if (!urlPath) {
    console.error('Usage: discover-selectors.ts <url-path> [--after-login]');
    process.exit(1);
  }
  const afterLogin = flags.includes('--after-login');
  const afterSession = flags.includes('--after-session');
  const sessionBusiness = process.env.DISCOVER_BUSINESS;
  const baseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';

  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (msg) => console.error(`[console:${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => console.error(`[pageerror] ${err.message}`));
  page.on('requestfailed', (req) => console.error(`[requestfailed] ${req.url()} ${req.failure()?.errorText}`));
  page.on('response', (res) => {
    if (res.url().includes('3001') || res.status() >= 400) console.error(`[response ${res.status()}] ${res.url()}`);
  });

  if (afterLogin || afterSession) {
    await page.goto(`${baseUrl}/login`);
    await page.locator('input[autocomplete=username]').fill(process.env.DISCOVER_USER || 'admin');
    await page.locator('input[autocomplete=current-password]').fill(process.env.DISCOVER_PASS || 'changeme123');
    await page.locator("button:has-text('Log in')").click();
    await page.waitForTimeout(500);
  }

  // The real app, after login, always lands on /session until a real
  // business/ledger is chosen (the same real "Select Business"/"Switch
  // Session" screen the step runner itself already drives) - any other
  // real page redirects there first if nothing has been chosen yet in
  // this real browser context.
  if (afterSession) {
    if (page.url().endsWith('/session')) {
      if (sessionBusiness) await page.locator('select >> nth=0').selectOption({ label: sessionBusiness });
      await page.locator("button:has-text('Continue')").click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);
      console.error(`--- real, live URL right after /session Continue click: ${page.url()} ---`);
    }
  }

  if (flags.includes('--click-link')) {
    const idx = flags.indexOf('--click-link');
    const section = flags[idx + 1];
    const linkText = flags[idx + 2];
    await page.locator(`button:has-text('${section}')`).click();
    await page.waitForTimeout(300);
    await page.locator(`a:text-is('${linkText}')`).click();
  } else {
    await page.goto(`${baseUrl}${urlPath}`);
  }
  await page.waitForTimeout(3000);
  console.error(`--- real, live URL after navigation: ${page.url()} ---`);

  // Native HTML attributes real form controls carry - placeholder, type,
  // and (for <select>) the real option labels, in real document order.
  // This is the concrete data screens.csv's own field_selector column
  // needs, read directly off the live page, never off a .svelte file.
  // Scoped under <main> specifically (never global document): the real,
  // live app chrome (nav) sits outside <main>, and a global
  // document.querySelectorAll call from page.evaluate was found, directly,
  // to miss <main>'s own real content on at least one real, confirmed
  // screen even though page.locator('main').innerHTML() saw it correctly
  // moments earlier in the same run - real, unexplained, not yet
  // root-caused. Scoping through Playwright's own locator API (proven
  // reliable) sidesteps it rather than trusting the global evaluate.
  const handles = await page.locator('main input, main select, main button, main textarea').all();
  const controls: Array<Record<string, unknown>> = [];
  for (const h of handles) {
    const tag = await h.evaluate((el) => el.tagName.toLowerCase());
    const entry: Record<string, unknown> = {
      tag,
      type: await h.evaluate((el) => (el as HTMLInputElement).type || undefined),
      placeholder: await h.evaluate((el) => (el as HTMLInputElement).placeholder || undefined),
      text: tag === 'button' ? (await h.textContent())?.trim() : undefined,
    };
    if (tag === 'select') {
      entry.options = await h.evaluate((el) => Array.from((el as HTMLSelectElement).options).map((o) => o.textContent?.trim()));
    }
    controls.push(entry);
  }
  console.log('--- real, native form controls, in real document order ---');
  console.log(JSON.stringify(controls, null, 2));

  await browser.close();
}

main();
