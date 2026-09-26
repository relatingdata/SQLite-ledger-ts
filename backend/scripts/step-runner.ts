// The one, real, unified testing and data-loading tool for this
// application. Full design: docs/skill-step-runner-design.md.
// Currently implements the API-path engine, interactive tabular
// display, and non-interactive mode. The UI-path (Playwright) engine
// and the web interface are real, further, not-yet-built work.

import { readFileSync, mkdirSync } from 'fs';
import { createInterface } from 'readline';
import { chromium, type Browser, type Page } from 'playwright';
import * as db from '../src/db.js';

interface StepRow {
  step_id: string;
  description: string;
  api_function: string;
  api_args: string;
  ui_screen: string;
  ui_actions: string;
  verify: string;
  screenshot: string;
}

/** The one, real registry mapping a step's own api_function name to the
 * real, actual backend function it calls - extend this as further,
 * real steps are added to any real fixture. */
const API_REGISTRY: Record<string, (args: Record<string, unknown>) => unknown> = {
  createBusiness: (a) => db.createBusiness((a.businessName as string) as any, a.financialYearLabel as string, db.asUserId(1)),
  createAndConfigureLocation: (a) =>
    db.createAndConfigureLocation((a.businessName as string) as any, a.locationName as string, a.location as any, db.asUserId(1)),
};

/** The one, real registry of named, shared verifications - the same,
 * real check, callable from either the API path or the UI path, so
 * both paths are held to the exact, same real standard. */
const VERIFY_REGISTRY: Record<string, (args: Record<string, unknown>) => boolean> = {
  business_exists: (a) => {
    const rows = db.getEntityTree();
    return rows.some((e) => e.name === (a.businessName as string));
  },
  location_exists: (a) => {
    const rows = db.getEntityTree();
    return rows.some((e) => e.name === (a.locationName as string));
  },
};

/** Parses one real step-runner CSV file - real "#"-prefixed lines
 * (one or more, directly above the step they describe) are real
 * comments, skipped here, never part of the real tabular data. A
 * minimal, real CSV field parser handling real, quoted fields
 * containing real, embedded commas and doubled quotes (JSON columns
 * need this). */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

export function parseStepFile(path: string): StepRow[] {
  const raw = readFileSync(path, 'utf-8');
  const lines = raw.split('\n').filter((l) => !l.startsWith('#') && l.trim() !== '');
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]);
  const steps: StepRow[] = [];
  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    const row = {} as StepRow;
    headers.forEach((h, i) => {
      (row as unknown as Record<string, string>)[h] = values[i] ?? '';
    });
    steps.push(row);
  }
  return steps;
}

/** Real, tabular display of upcoming steps - real column headers
 * taken directly from the fixture file's own headers, per direct
 * instruction, so what's shown matches what's actually in the file,
 * not a paraphrase of it. */
export function printStepsTable(steps: StepRow[]): void {
  const cols: (keyof StepRow)[] = ['step_id', 'description', 'api_function', 'ui_screen', 'verify', 'screenshot'];
  const widths = cols.map((c) => Math.max(c.length, ...steps.map((s) => String(s[c] ?? '').length)));
  const printRow = (vals: string[]) => console.log(vals.map((v, i) => v.padEnd(widths[i])).join('  |  '));
  printRow(cols);
  printRow(cols.map((c) => '-'.repeat(widths[cols.indexOf(c)])));
  for (const s of steps) printRow(cols.map((c) => String(s[c] ?? '')));
}

function runStepViaApi(step: StepRow): { ok: boolean; error?: string } {
  try {
    if (step.api_function) {
      const fn = API_REGISTRY[step.api_function];
      if (!fn) return { ok: false, error: `No real API registry entry for "${step.api_function}" - add one to API_REGISTRY.` };
      const args = step.api_args ? JSON.parse(step.api_args) : {};
      fn(args);
    }
    if (step.verify) {
      const verifyFn = VERIFY_REGISTRY[step.verify];
      if (!verifyFn) return { ok: false, error: `No real verify registry entry for "${step.verify}".` };
      const args = step.api_args ? JSON.parse(step.api_args) : {};
      if (!verifyFn(args)) return { ok: false, error: `Verify "${step.verify}" returned false.` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Resolves a real selector string into a real Playwright Locator -
 * plain CSS/text selectors work as-is; a selector starting with
 * "role:" is real, further, pipe-delimited data
 * ("role:group|Location name|input") telling this to use the real,
 * proper getByRole API instead (needed for this application's own,
 * real, dynamically-generated form fields, where a plain CSS selector
 * cannot reliably target one specific, real field) - pipe-delimited,
 * deliberately, never JSON-within-a-string, since that would need a
 * real, further, second level of escaping on top of the CSV's own. */
function resolveLocator(page: Page, selector: string) {
  if (selector.startsWith('role:')) {
    const [role, name, then] = selector.slice('role:'.length).split('|');
    const base = page.getByRole(role as never, { name, exact: true });
    return then ? base.locator(then) : base;
  }
  return page.locator(selector);
}

interface UiAction {
  type: 'goto' | 'fill' | 'click' | 'select' | 'check' | 'wait' | 'press' | 'focus';
  selector?: string;
  value?: string;
}

/** Drives one real step through an actual, real browser - the real
 * "prove the UI works" path, per direct instruction the one and only
 * other real way any step can be verified, alongside the API path. */
async function runStepViaUi(page: Page, step: StepRow, screenshotDir: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (step.ui_screen) await page.goto(step.ui_screen);
    if (step.ui_actions) {
      const actions: UiAction[] = JSON.parse(step.ui_actions);
      for (const action of actions) {
        switch (action.type) {
          case 'goto':
            await page.goto(action.value!);
            break;
          case 'fill':
            await resolveLocator(page, action.selector!).fill(action.value ?? '');
            break;
          case 'click':
            await resolveLocator(page, action.selector!).click();
            break;
          case 'select':
            await resolveLocator(page, action.selector!).selectOption(action.value ?? '');
            break;
          case 'check':
            await resolveLocator(page, action.selector!).check();
            break;
          case 'wait':
            await page.waitForTimeout(Number(action.value ?? 500));
            break;
          case 'focus':
            await resolveLocator(page, action.selector!).focus();
            break;
          case 'press':
            await page.keyboard.press(action.value!);
            break;
        }
      }
    }
    await page.waitForTimeout(500);
    if (step.screenshot) {
      mkdirSync(screenshotDir, { recursive: true });
      await page.screenshot({ path: `${screenshotDir}/${step.screenshot}.png`, fullPage: true });
    }
    if (step.verify) {
      const verifyFn = VERIFY_REGISTRY[step.verify];
      if (!verifyFn) return { ok: false, error: `No real verify registry entry for "${step.verify}".` };
      const args = step.api_args ? JSON.parse(step.api_args) : {};
      if (!verifyFn(args)) return { ok: false, error: `Verify "${step.verify}" returned false.` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

/** Real, direct integrity checks on a proposed fixture file, per
 * direct instruction - catching a real, broken fixture before any
 * real step of it is ever run, not partway through. */
function lintStepFile(steps: StepRow[]): string[] {
  const problems: string[] = [];
  const seenIds = new Set<string>();
  for (const s of steps) {
    if (!s.step_id) { problems.push(`A real row has no real step_id.`); continue; }
    if (seenIds.has(s.step_id)) problems.push(`Duplicate real step_id: "${s.step_id}".`);
    seenIds.add(s.step_id);
    if (s.api_function && !API_REGISTRY[s.api_function]) {
      problems.push(`${s.step_id}: api_function "${s.api_function}" has no real API_REGISTRY entry.`);
    }
    if (s.verify && !VERIFY_REGISTRY[s.verify]) {
      problems.push(`${s.step_id}: verify "${s.verify}" has no real VERIFY_REGISTRY entry.`);
    }
    if (s.api_args) {
      try { JSON.parse(s.api_args); } catch { problems.push(`${s.step_id}: api_args is not real, valid JSON.`); }
    }
    if (s.ui_actions) {
      try {
        const actions = JSON.parse(s.ui_actions) as UiAction[];
        for (const a of actions) {
          if (!['goto', 'fill', 'click', 'select', 'check', 'wait', 'press', 'focus'].includes(a.type)) {
            problems.push(`${s.step_id}: unknown real ui_action type "${a.type}".`);
          }
          if (a.type !== 'wait' && a.type !== 'press' && a.type !== 'goto' && !a.selector) {
            problems.push(`${s.step_id}: a real "${a.type}" action has no real selector.`);
          }
        }
      } catch {
        problems.push(`${s.step_id}: ui_actions is not real, valid JSON.`);
      }
    }
    if (!s.api_function && !s.ui_actions && !s.ui_screen) {
      problems.push(`${s.step_id}: has neither a real api_function nor any real ui_screen/ui_actions - does nothing.`);
    }
  }
  return problems;
}

/** Real, formatted, human-readable printing of every real step in a
 * fixture, per direct instruction - real, named sections, and each
 * step's own real data shown as a real, tabular block with the
 * fixture's own real column headers, not a paraphrase of it. */
function prettyPrintSteps(steps: StepRow[]): void {
  for (const s of steps) {
    console.log(`\n━━━ ${s.step_id} ━━━`);
    console.log(`  ${s.description}`);
    const cols: (keyof StepRow)[] = ['api_function', 'api_args', 'ui_screen', 'ui_actions', 'verify', 'screenshot'];
    const present = cols.filter((c) => s[c]);
    if (present.length === 0) continue;
    const widths = present.map((c) => Math.max(c.length, String(s[c]).length > 80 ? 80 : String(s[c]).length));
    present.forEach((c, i) => {
      const val = String(s[c]).length > 80 ? String(s[c]).slice(0, 77) + '...' : String(s[c]);
      console.log(`  ${c.padEnd(widths[i])} : ${val}`);
    });
  }
  console.log(`\n${steps.length} real step(s) total.`);
}

async function main() {
  const args = process.argv.slice(2);
  const fixturePath = args[0];
  if (!fixturePath) {
    console.error('Usage: step-runner <fixture.csv> [--lint] [--pretty] [--path api|ui] [--steps N] [--non-interactive] [--from id] [--to id] [--only id] [--delay MS] [--ui] [--screenshot-dir DIR] [--screenshot-only ids]');
    process.exit(1);
  }
  const path = args.includes('--path') ? args[args.indexOf('--path') + 1] : 'api';
  const stepsArg = args.includes('--steps') ? Number(args[args.indexOf('--steps') + 1]) : 1;
  const nonInteractive = args.includes('--non-interactive');
  const onlyId = args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined;
  const delayMs = args.includes('--delay') ? Number(args[args.indexOf('--delay') + 1]) : 5000;
  const openInspector = args.includes('--ui');
  const screenshotDir = args.includes('--screenshot-dir') ? args[args.indexOf('--screenshot-dir') + 1] : 'docs/manual-images-tutorial';
  const screenshotOnly = args.includes('--screenshot-only') ? args[args.indexOf('--screenshot-only') + 1].split(',') : undefined;

  let allSteps = parseStepFile(fixturePath);
  if (onlyId) allSteps = allSteps.filter((s) => s.step_id === onlyId);
  if (screenshotOnly) allSteps = allSteps.filter((s) => screenshotOnly.includes(s.step_id));

  if (args.includes('--lint')) {
    const problems = lintStepFile(allSteps);
    if (problems.length === 0) {
      console.log(`✅ ${fixturePath}: ${allSteps.length} real step(s), no real problems found.`);
      return;
    }
    console.log(`❌ ${fixturePath}: ${problems.length} real problem(s) found:\n`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exitCode = 1;
    return;
  }

  if (args.includes('--pretty')) {
    prettyPrintSteps(allSteps);
    return;
  }

  let browser: Browser | undefined;
  let page: Page | undefined;
  if (path === 'ui') {
    browser = await chromium.launch({ headless: !openInspector });
    const context = await browser.newContext({ baseURL: 'http://localhost:5173' });
    page = await context.newPage();
  }

  let index = 0;
  while (index < allSteps.length) {
    const batch = allSteps.slice(index, index + (nonInteractive ? allSteps.length : stepsArg));
    printStepsTable(batch);
    if (!nonInteractive) {
      const answer = await prompt(`\nRun these ${batch.length} step(s) via ${path.toUpperCase()}? [Y/n] `);
      if (answer.trim().toLowerCase() === 'n') {
        console.log('Stopped.');
        if (browser) await browser.close();
        return;
      }
    }
    for (const step of batch) {
      const result = path === 'ui' ? await runStepViaUi(page!, step, screenshotDir) : runStepViaApi(step);
      console.log(result.ok ? `✅ ${step.step_id}` : `❌ ${step.step_id}: ${result.error}`);
      if (!result.ok && !nonInteractive) {
        const cont = await prompt('Step failed. Continue anyway? [y/N] ');
        if (cont.trim().toLowerCase() !== 'y') {
          if (browser) await browser.close();
          return;
        }
      }
      if (path === 'ui' && !nonInteractive) await new Promise((r) => setTimeout(r, delayMs));
    }
    index += batch.length;
  }
  if (browser) await browser.close();
  console.log(`\nDone - ${allSteps.length} step(s) processed.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
