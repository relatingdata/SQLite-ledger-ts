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

interface UiAction {
  type: 'goto' | 'fill' | 'click' | 'select' | 'check' | 'wait';
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
            await page.locator(action.selector!).fill(action.value ?? '');
            break;
          case 'click':
            await page.locator(action.selector!).click();
            break;
          case 'select':
            await page.locator(action.selector!).selectOption(action.value ?? '');
            break;
          case 'check':
            await page.locator(action.selector!).check();
            break;
          case 'wait':
            await page.waitForTimeout(Number(action.value ?? 500));
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

async function main() {
  const args = process.argv.slice(2);
  const fixturePath = args[0];
  if (!fixturePath) {
    console.error('Usage: step-runner <fixture.csv> [--path api|ui] [--steps N] [--non-interactive] [--from id] [--to id] [--only id] [--delay MS] [--ui] [--screenshot-dir DIR] [--screenshot-only ids]');
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
