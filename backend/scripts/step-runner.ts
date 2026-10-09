// The one, real, unified testing and data-loading tool for this
// application. Full design: docs/skill-step-runner-design.md.
// The data file itself is purely positional data - zero commands,
// zero selectors, zero field names. The screen registry (screens.csv)
// is the one, real place that says what each position means and how
// to drive that screen. An optional .control.csv supplies verify/
// screenshot per row, kept out of the data file entirely.

import { readFileSync, mkdirSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import { chromium, type Browser, type Page } from 'playwright';
import * as db from '../src/db.js';

export interface ScreenField {
  position: number;
  field_name: string;
  field_selector: string;
  field_type: string;
}

export interface Screen {
  screen_name: string;
  screen_kind: string; // 'session' | 'data' (default 'data')
  ui_path: string;
  open_selector: string;
  api_function: string;
  submit_selector: string;
  fields: ScreenField[];
}

export interface Step {
  index: number; // 1-indexed, real step number (excluding blank lines)
  file_line: number; // the real, original, raw line number in the data file itself
  screen_name: string;
  values: string[]; // positional, values[0] is position 1
  path: string; // 'api' | 'ui' | '' (falls back to the CLI's own --path)
  verify: string;
  screenshot: string;
  skip: boolean; // true if this real step's own control row marks it to be skipped
  // Per direct instruction: a real, free-text explanation of what this
  // step does and why - the real accounting or entity-creation
  // reasoning, not restated step mechanics - read from the control
  // file's own 5th column, shown before the step runs, both pretty-
  // printed and during an actual run (api or ui), so a person reading
  // the real output sees the real intent alongside the real result.
  comment: string;
}

/** The one, real registry mapping a screen's own api_function name to
 * the real, actual backend function it calls - extend this as
 * further, real screens are added to screens.csv. */
export const API_REGISTRY: Record<string, (args: Record<string, string>) => unknown> = {
  // Per docs/realistic-tutorial-e2e-plan.md, Phase A: Chapter 3 nominates a
  // home currency at business creation. setBusinessHomeCurrency is a
  // real, separate, existing function - called immediately after, not
  // folded into createBusiness itself, which has no currency parameter.
  createBusiness: (a) => {
    const result = db.createBusiness(a.businessName as any, a.financialYearLabel, db.asUserId(1));
    if (a.homeCurrency) db.setBusinessHomeCurrency(a.businessName, a.homeCurrency, db.asUserId(1));
    return result;
  },
  // Per docs/realistic-tutorial-e2e-plan.md, Phase A: Chapter 3's
  // "Division" is a Hierarchy (per docs/naming-vocabulary.md, Division is
  // an example classification, never a built-in concept) - the division
  // field, when given, is ensured as a Hierarchy value the exact, same
  // way "Storage" and "Container" already are below, never a new,
  // separate mechanism.
  // Per docs/currency-and-quantity-integrity-fix-plan.md, "a third,
  // confirmed finding": capacity is folded into creation itself, not a
  // later, separate step - createAndConfigureLocation's own, existing
  // design calls ensureLocationCapacityAccount immediately, atomically,
  // specifically so the real opening balance is known and posted at
  // creation time, never lazily. A real, confirmed bug was found and
  // fixed here: an earlier version of this registry entry passed null
  // capacity at creation and set the real number via a separate
  // setLocationCapacity step afterward - this created the Storage
  // Capacity structure with opening = 0 (silently correct for a
  // capacity of zero), and by the time the real capacity was later
  // known, the structure already existed, so the real opening balance
  // was never posted at all. Matches Chapter 3's own narrative too:
  // capacity is set "directly on the same screen" as creation.
  createAndConfigureLocation: (a) => {
    const userId = db.asUserId(1);
    const result = db.createAndConfigureLocation(a.businessName as any, a.locationName, {
      city: a.city,
      location_type: a.locationType,
      is_billing_address: false,
      bottle_capacity: a.bottleCapacity ? Number(a.bottleCapacity) : null,
      carton_capacity: a.cartonCapacity ? Number(a.cartonCapacity) : null,
      timezone: 'Australia/Adelaide',
    } as any, userId);
    if (a.division) {
      db.ensureHierarchyGrouping(a.businessName as any, 'Division', userId);
      db.ensureHierarchyValue(a.businessName as any, 'Division', a.division, userId);
      db.setDimensionParent(a.locationName, 'Division', a.division, userId);
    }
    return result;
  },
  // Phase B: Chapter 3's Business Setup employee creation, at a named
  // location - createEmployee already exists and takes exactly this
  // shape.
  createEmployeeAt: (a) => db.createEmployee(a.employeeName, a.locationName, db.asUserId(1)),
  // Phase B: Chapter 3's first supplier, name only - createProvider
  // already exists and takes exactly this shape (per
  // docs/naming-vocabulary.md, Provider is the code-level name; the
  // business owner's own displayed label stays separately
  // translatable).
  createProviderSimple: (a) => db.createProvider(a.providerName, db.asUserId(1)),
  // Phase B: a real, generic two-line journal entry (debit one account,
  // credit another, for the same amount) - used for Chapter 3's own
  // opening-capital posting. Built on the real, existing stageLine/
  // postJournalEntry pair, the same, one, real path every other
  // manual transaction in this application posts through.
  postJournalEntrySimple: (a) => {
    const userId = db.asUserId(1);
    const business = a.businessName as any;
    const ledger = db.asLedgerName('Actual');
    const reference = `JE-${Date.now()}`;
    const amount = Number(a.amountMinor);
    db.stageLine({ reference, business, ledger, account: a.debitAccount as any, amount_minor: amount });
    db.stageLine({ reference, business, ledger, account: a.creditAccount as any, amount_minor: -amount });
    db.postJournalEntry(reference, business, ledger, userId);
  },
  // Phase B: sets an item's real cost and real pack size (units per
  // carton) against a specific, named provider - the real, existing
  // addOrUpdateItemSource mechanism, which is genuinely
  // provider-specific (a provider's own offer for an item), unlike
  // Chapter 3's own narrative, which sets this before any provider
  // exists. No generic, provider-independent item cost/price mechanism
  // exists in the backend today (confirmed directly, not assumed) - the
  // provider is created first in this data file for exactly that reason.
  setItemCostAndPackSize: (a) =>
    db.addOrUpdateItemSource({
      itemName: a.itemName,
      vendorName: a.providerName,
      priceMinor: Number(a.unitCostMinor),
      packageQuantity: Number(a.packageQuantity),
      isPreferred: true,
    }),
  // Phase B: Chapter 3's Purchase Order, placed in whole cartons - "an
  // important, real detail, easy to get wrong" per the manual itself.
  // Converts cartons to the item's own real, registered pack size
  // (read directly from item_source, the one, real place it is kept),
  // then stages and immediately posts the order - a single, real
  // step, since this data file has no separate "place the order" row.
  createPurchaseOrderInCartons: (a) => {
    const userId = db.asUserId(1);
    const business = a.businessName as any;
    const ledger = db.asLedgerName('Actual');
    const packRow = db.db
      .prepare(
        `SELECT src.package_quantity AS package_quantity
         FROM item_source src
         JOIN current_entities item ON item.id = src.item_id
         JOIN current_entities vendor ON vendor.id = src.vendor_id
         WHERE item.name = ? AND vendor.name = ?
         ORDER BY src.id DESC LIMIT 1`
      ).get(a.itemName, a.providerName) as { package_quantity: number | null } | undefined;
    const packageQuantity = packRow?.package_quantity ?? 1;
    const cartons = Number(a.cartons);
    const quantity = cartons * packageQuantity;
    const priceMinorPerUnit = Math.round(Number(a.pricePerCartonMinor) / packageQuantity);
    db.stagePurchaseOrder({
      reference: a.reference, business, ledger, vendor: a.providerName, item: a.itemName,
      quantity, price_minor: priceMinorPerUnit,
    });
    db.postPurchaseOrder(a.reference, business, ledger, userId);
  },
  // Phase B: Chapter 3's Cash Purchase - receives stock at a location,
  // at cost, paid in full immediately. completeCashPurchase already
  // exists and takes exactly this shape.
  cashPurchaseSimple: (a) => {
    const userId = db.asUserId(1);
    return db.completeCashPurchase({
      business: a.businessName as any,
      ledger: db.asLedgerName('Actual'),
      locationName: a.locationName as any,
      vendorName: a.providerName as any,
      lines: [{ itemName: a.itemName, quantity: Number(a.quantity), unitPriceMinor: Number(a.unitCostMinor), taxMinor: 0 }],
      taxAccount: 'Sales Tax Payable' as any,
      paymentMethod: 'cash',
    }, userId);
  },
  // Phase B: a plain (non-combination) transfer between two named
  // locations - transferItems already exists and takes exactly this
  // shape.
  transferItemsSimple: (a) => {
    const userId = db.asUserId(1);
    db.transferItems(a.businessName as any, db.asLedgerName('Actual'), a.itemName as any, a.fromLocationName as any, a.toLocationName as any, Number(a.quantity), `TRANSFER-${a.itemName}-${Date.now()}`, userId);
  },
  // Phase B: Chapter 3's retail sale - completePosSale already exists
  // and takes exactly this shape.
  posSaleSimple: (a) => {
    const userId = db.asUserId(1);
    return db.completePosSale({
      business: a.businessName as any,
      ledger: db.asLedgerName('Actual'),
      locationName: a.locationName as any,
      customerName: 'Cash Sale' as any,
      lines: [{ itemName: a.itemName, quantity: Number(a.quantity), unitPriceMinor: Number(a.unitPriceMinor), taxMinor: 0 }],
      taxAccount: 'Sales Tax Payable' as any,
      paymentMethod: 'cash',
    }, userId);
  },
  // Matches the real, actual UI's own real behaviour exactly: a real
  // "+ New category…" value means create the real, new category
  // first (under this business's own real Items root), then create
  // the real item under it; any other real value names a real,
  // already-existing category directly.
  createItemAndCategory: (a) => {
    const userId = db.asUserId(1);
    const categoryName = a.category === '+ New category…' ? a.newCategoryName : a.category;
    const business = db.requireEntity(a.businessName as any, db.typeBusinessName, db.requireEntity('Businesses', db.typeRootName));
    const itemsRoot = db.requireEntity('Items', db.typeRootName, business);
    let categoryEntity;
    try {
      categoryEntity = db.requireEntity(categoryName, db.typeRootName, itemsRoot);
    } catch {
      categoryEntity = db.createItemCategory(a.businessName as any, categoryName, undefined, userId);
    }
    db.create(categoryEntity, db.typeItemName, a.itemName, userId);
  },
  // Per direct instruction: exercises the real, existing combination
  // support already wired into receiveItems - receiving an
  // item directly into a real, named storage combination (e.g.
  // whiskey into Secure storage), never received plain and moved
  // later. Lazily ensures the real Hierarchy grouping/value exist,
  // matching what a real setup screen would do.
  receiveStockWithCombination: (a) => {
    const userId = db.asUserId(1);
    db.ensureHierarchyGrouping(a.businessName as any, a.groupingName, userId);
    db.ensureHierarchyValue(a.businessName as any, a.groupingName, a.storageValue, userId);
    db.defineProductShape(a.businessName as any, [[a.groupingName, a.groupingName]], userId);
    db.receiveItems(
      a.businessName as any, db.asLedgerName('Actual'), `RECEIVE-${a.itemName}-${a.storageValue}`,
      a.itemName as any, a.locationName as any, Number(a.quantity), userId, undefined,
      [a.storageValue], [[a.groupingName, a.groupingName]]
    );
  },
  // Per direct instruction: exercises the independent, non-rate-linked
  // carton/bottle space case - opening a carton is never a real
  // "conversion," it is two, real, independent space movements.
  // Per direct instruction, the already-documented Phase 3 gap is now
  // closed: openStorageContainer takes a real locationName and scopes
  // its posting to that specific location, and refuses the operation
  // if that location has no real bottle shelving at all.
  openContainer: (a) => {
    const userId = db.asUserId(1);
    db.ensureHierarchyGrouping(a.businessName as any, 'Container', userId);
    db.ensureHierarchyValue(a.businessName as any, 'Container', a.containerValue, userId);
    db.ensureHierarchyValue(a.businessName as any, 'Container', a.unitValue, userId);
    db.defineProductShape(a.businessName as any, [['Container', 'Container']], userId);
    db.openStorageContainer(
      a.businessName as any, db.asLedgerName('Actual'), a.locationName as any, a.itemName as any, [['Container', 'Container']],
      [a.containerValue], Number(a.cartonsOpened), [a.unitValue], Number(a.unitsProduced), userId,
      `STORAGE-OPEN-${a.locationName}`
    );
  },
  // Per docs/ledger-scoped-accounts-and-rollover.md: the standard
  // closing entry - net profit or loss for the period is posted into
  // Retained Earnings, entirely within the one, named ledger.
  closeBooksSimple: (a) => {
    const userId = db.asUserId(1);
    return db.closeBooks(a.businessName as any, a.ledger as any, a.asOfDate, a.retainedEarningsAccount as any, userId);
  },
  // Per docs/ledger-scoped-accounts-and-rollover.md: creates a further
  // real ledger under the business's own, real Ledgers node - the
  // real, direct prerequisite rolloverToNewPeriod needs before it can
  // do anything at all.
  createLedgerSimple: (a) => {
    const userId = db.asUserId(1);
    db.createLedger(a.businessName as any, a.ledger as any, userId);
  },
  // Per docs/ledger-scoped-accounts-and-rollover.md: the real,
  // three-phase rollover itself - structural (new ledger's own
  // account nodes), read (old ledger's own real closing balances),
  // post (one, ordinary, balanced journal entry, entirely within the
  // new ledger). Never posts across ledgers.
  rolloverToNewPeriodSimple: (a) => {
    const userId = db.asUserId(1);
    return db.rolloverToNewPeriod(a.businessName as any, a.oldLedger as any, a.newLedger as any, a.asOfDate, userId);
  },
};

/** The one, real registry of named, shared verifications - the same,
 * real check, callable from either the API path or the UI path. */
export const VERIFY_REGISTRY: Record<string, (args: Record<string, string>) => boolean> = {
  business_exists: (a) => db.getEntityTree().some((e) => e.name === a.businessName),
  location_exists: (a) => db.getEntityTree().some((e) => e.name === a.locationName),
};

/** A minimal, real CSV field parser handling real, quoted fields with
 * real, embedded commas and doubled quotes. */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { fields.push(cur); cur = ''; }
    else cur += ch;
  }
  fields.push(cur);
  return fields;
}

function readCsvLines(path: string): { line: string; fileLine: number }[] {
  return readFileSync(path, 'utf-8')
    .split('\n')
    .map((line, i) => ({ line, fileLine: i + 1 }))
    .filter((l) => l.line.trim() !== '');
}

// Per direct instruction: a real line in the data file itself, starting
// with '#', is a real, free-text explanation of the step(s) that
// follow it - never a data row, never counted as a real step, never
// touching the control file at all (which stays exactly the four,
// documented columns: path, verify, screenshot, skip). One or more
// consecutive '#' lines accumulate into a single, real comment,
// attached to the next real data row that follows them, shown before
// that step runs - pretty-printed or during an actual run, api or ui.
function splitDataAndComments(lines: { line: string; fileLine: number }[]): { line: string; fileLine: number; comment: string }[] {
  const out: { line: string; fileLine: number; comment: string }[] = [];
  let pending: string[] = [];
  for (const l of lines) {
    if (l.line.trim().startsWith('#')) { pending.push(l.line.trim().replace(/^#\s?/, '')); continue; }
    out.push({ ...l, comment: pending.join(' ') });
    pending = [];
  }
  return out;
}

/** Loads the real screen registry, grouping each screen's own real
 * field rows together, sorted by their own real position. */
export function loadScreens(path: string): Map<string, Screen> {
  const lines = readCsvLines(path).map((l) => l.line);
  const headers = parseCsvLine(lines[0]);
  const screens = new Map<string, Screen>();
  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    let screen = screens.get(row.screen_name);
    if (!screen) {
      screen = { screen_name: row.screen_name, screen_kind: row.screen_kind || 'data', ui_path: row.ui_path, open_selector: row.open_selector, api_function: row.api_function, submit_selector: row.submit_selector, fields: [] };
      screens.set(row.screen_name, screen);
    }
    if (row.field_name) screen.fields.push({ position: Number(row.position), field_name: row.field_name, field_selector: row.field_selector, field_type: row.field_type });
  }
  for (const screen of screens.values()) screen.fields.sort((a, b) => a.position - b.position);
  return screens;
}

/** Loads a real, purely positional data file - no header row, column
 * 1 is the screen name, columns 2+ are that screen's own real values
 * in position order. Loads the matching, optional .control.csv
 * (same base name) for verify/screenshot, kept entirely separate. */
export function loadSteps(dataPath: string): Step[] {
  const lines = splitDataAndComments(readCsvLines(dataPath));
  const controlPath = dataPath.replace(/\.csv$/, '.control.csv');
  const controlLines = existsSync(controlPath) ? readCsvLines(controlPath).map((l) => l.line) : [];
  const controlRows = controlLines.length > 0 ? controlLines.slice(1).map(parseCsvLine) : [];

  return lines.map((entry, i) => {
    const fields = parseCsvLine(entry.line);
    const [screen_name, ...values] = fields;
    const control = controlRows[i] ?? [];
    return { index: i + 1, file_line: entry.fileLine, screen_name, values, path: control[0] ?? '', verify: control[1] ?? '', screenshot: control[2] ?? '', skip: (control[3] ?? '').toLowerCase() === 'true', comment: entry.comment };
  });
}

/** Builds a real, named-argument object for a step's own real,
 * positional values, using the screen registry's own field order. */
function buildArgs(step: Step, screen: Screen | undefined): Record<string, string> {
  const args: Record<string, string> = {};
  if (!screen) return args;
  for (const field of screen.fields) args[field.field_name] = step.values[field.position - 1] ?? '';
  return args;
}

/** Real, direct integrity checks on a proposed data file and its
 * real, referenced screens - catching a real, broken fixture before
 * any real step of it is ever run. */
export function lintSteps(steps: Step[], screens: Map<string, Screen>): string[] {
  const problems: string[] = [];
  for (const s of steps) {
    if (!s.screen_name) { problems.push(`Row ${s.index}: no real screen name in column 1.`); continue; }
    const screen = screens.get(s.screen_name);
    if (!screen) { problems.push(`Row ${s.index}: screen "${s.screen_name}" has no real entry in the screen registry.`); continue; }
    if (screen.fields.length > 0 && s.values.length !== screen.fields.length) {
      problems.push(`Row ${s.index} ("${s.screen_name}"): has ${s.values.length} real value(s), but the registry defines ${screen.fields.length} real field(s).`);
    }
    if (screen.api_function && !API_REGISTRY[screen.api_function]) {
      problems.push(`Row ${s.index}: screen "${s.screen_name}"'s api_function "${screen.api_function}" has no real API_REGISTRY entry.`);
    }
    // Per direct, absolute instruction: a real screen that genuinely
    // submits data (it has its own real submit_selector) but has no
    // real api_function at all is a real, silent no-op waiting to
    // happen the moment anyone runs it via --path api - lint must
    // strenuously object to this, not stay quiet about it.
    if (screen.submit_selector && !screen.api_function && screen.screen_kind === 'data') {
      problems.push(`Row ${s.index}: screen "${s.screen_name}" has a real submit_selector but no real api_function - running this step via --path api would silently do nothing at all.`);
    }
    if (s.verify && !VERIFY_REGISTRY[s.verify]) problems.push(`Row ${s.index}: verify "${s.verify}" has no real VERIFY_REGISTRY entry.`);
  }
  return problems;
}

/** Real, formatted, human-readable printing of every real step. */
export function prettyPrintSteps(steps: Step[], screens: Map<string, Screen>): string {
  const lines: string[] = [];
  for (const s of steps) {
    lines.push(`\n━━━ ${s.index}: ${s.screen_name} ━━━`);
    if (s.comment) lines.push(`  # ${s.comment}`);
    const screen = screens.get(s.screen_name);
    const args = buildArgs(s, screen);
    for (const [k, v] of Object.entries(args)) lines.push(`  ${k}: ${v}`);
    if (s.path) lines.push(`  path: ${s.path}`);
    if (s.verify) lines.push(`  verify: ${s.verify}`);
    if (s.screenshot) lines.push(`  screenshot: ${s.screenshot}`);
    if (s.skip) lines.push(`  skip: true`);
  }
  lines.push(`\n${steps.length} real step(s) shown.`);
  return lines.join('\n');
}

export function runStepViaApi(step: Step, screens: Map<string, Screen>): { ok: boolean; error?: string } {
  try {
    const screen = screens.get(step.screen_name);
    const args = buildArgs(step, screen);
    if (screen?.api_function) {
      const fn = API_REGISTRY[screen.api_function];
      if (!fn) return { ok: false, error: `No real API registry entry for "${screen.api_function}".` };
      fn(args);
    }
    if (step.verify) {
      const verifyFn = VERIFY_REGISTRY[step.verify];
      if (!verifyFn) return { ok: false, error: `No real verify registry entry for "${step.verify}".` };
      if (!verifyFn(args)) return { ok: false, error: `Verify "${step.verify}" returned false.` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function runStepViaUi(page: Page, step: Step, screens: Map<string, Screen>, screenshotDir: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const screen = screens.get(step.screen_name);
    const args = buildArgs(step, screen);
    if (screen?.ui_path && !page.url().endsWith(screen.ui_path)) await page.goto(screen.ui_path);
    if (screen?.open_selector) {
      await page.locator(screen.open_selector).click();
      await page.waitForTimeout(500);
    }
    if (screen) {
      for (const field of screen.fields) {
        if (!field.field_selector) continue;
        const value = step.values[field.position - 1] ?? '';
        if (value === '') continue;
        const locator = page.locator(field.field_selector);
        if (field.field_type === 'select') await locator.selectOption({ label: value });
        else if (field.field_type === 'check') await (value === 'true' ? locator.check() : locator.uncheck());
        else await locator.fill(value);
        await page.waitForTimeout(200);
      }
      if (screen.submit_selector) {
        await page.locator(screen.submit_selector).click();
        await page.waitForTimeout(800);
      }
    }
    if (step.screenshot) {
      mkdirSync(screenshotDir, { recursive: true });
      await page.screenshot({ path: `${screenshotDir}/${step.screenshot}.png`, fullPage: true });
    }
    if (step.verify) {
      const verifyFn = VERIFY_REGISTRY[step.verify];
      if (!verifyFn) return { ok: false, error: `No real verify registry entry for "${step.verify}".` };
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
  const dataPath = args[0];
  if (!dataPath) {
    console.error('Usage: step-runner <data.csv> [--screens screens.csv] [--lint] [--pretty] [--path api|ui] [--steps N] [--only N] [--skip N] [--non-interactive] [--delay MS] [--ui] [--screenshot-dir DIR] [--verify NAME] [--screenshot NAME]');
    process.exit(1);
  }
  const screensPath = args.includes('--screens') ? args[args.indexOf('--screens') + 1] : dataPath.replace(/[^/]+$/, 'screens.csv');
  const path = args.includes('--path') ? args[args.indexOf('--path') + 1] : 'api';
  const stepsArg = args.includes('--steps') ? Number(args[args.indexOf('--steps') + 1]) : 1;
  const nonInteractive = args.includes('--non-interactive');
  const onlyN = args.includes('--only') ? Number(args[args.indexOf('--only') + 1]) : undefined;
  const skipN = args.includes('--skip') ? Number(args[args.indexOf('--skip') + 1]) : 0;
  const delayMs = args.includes('--delay') ? Number(args[args.indexOf('--delay') + 1]) : 5000;
  const openInspector = args.includes('--ui');
  const screenshotDir = args.includes('--screenshot-dir') ? args[args.indexOf('--screenshot-dir') + 1] : 'docs/manual-images-tutorial';
  const inlineVerify = args.includes('--verify') ? args[args.indexOf('--verify') + 1] : undefined;
  const inlineScreenshot = args.includes('--screenshot') ? args[args.indexOf('--screenshot') + 1] : undefined;

  const screens = loadScreens(screensPath);
  let allSteps = loadSteps(dataPath);
  if (skipN > 0) allSteps = allSteps.filter((s) => s.index > skipN);
  allSteps = allSteps.filter((s) => !s.skip);
  if (onlyN) allSteps = allSteps.filter((s) => s.index === onlyN);
  if (onlyN && (inlineVerify || inlineScreenshot)) {
    allSteps = allSteps.map((s) => ({ ...s, verify: inlineVerify ?? s.verify, screenshot: inlineScreenshot ?? s.screenshot }));
  }

  if (args.includes('--lint')) {
    const problems = lintSteps(allSteps, screens);
    if (problems.length === 0) { console.log(`✅ ${dataPath}: ${allSteps.length} real step(s), no real problems found.`); return; }
    console.log(`❌ ${dataPath}: ${problems.length} real problem(s) found:\n`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exitCode = 1;
    return;
  }

  if (args.includes('--pretty')) {
    console.log(prettyPrintSteps(args.includes('--steps') && !onlyN ? allSteps.slice(0, stepsArg) : allSteps, screens));
    return;
  }

  let browser: Browser | undefined;
  let page: Page | undefined;
  async function ensureUiPage(): Promise<Page> {
    if (!page) {
      browser = await chromium.launch({ headless: !openInspector });
      const context = await browser.newContext({ baseURL: 'http://localhost:5173' });
      page = await context.newPage();
    }
    return page;
  }
  if (path === 'ui') await ensureUiPage();

  let index = 0;
  while (index < allSteps.length) {
    const batch = allSteps.slice(index, index + (nonInteractive ? allSteps.length : stepsArg));
    console.log(prettyPrintSteps(batch, screens));
    if (!nonInteractive) {
      const answer = await prompt(`\nRun these ${batch.length} step(s)? [Y/n] `);
      if (answer.trim().toLowerCase() === 'n') { console.log('Stopped.'); if (browser) await browser.close(); return; }
    }
    for (const step of batch) {
      const stepPath = step.path || path;
      if (step.comment) console.log(`\n# ${step.comment}`);
      const result = stepPath === 'ui' ? await runStepViaUi(await ensureUiPage(), step, screens, screenshotDir) : runStepViaApi(step, screens);
      console.log(result.ok ? `✅ ${step.index}: ${step.screen_name} (${stepPath})` : `❌ ${step.index}: ${step.screen_name} (${stepPath}): ${result.error}`);
      if (!result.ok && !nonInteractive) {
        const cont = await prompt('Step failed. Continue anyway? [y/N] ');
        if (cont.trim().toLowerCase() !== 'y') { if (browser) await browser.close(); return; }
      }
      if (stepPath === 'ui' && !nonInteractive) await new Promise((r) => setTimeout(r, delayMs));
    }
    index += batch.length;
  }
  if (browser) await browser.close();
  console.log(`\nDone - ${allSteps.length} step(s) processed.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
