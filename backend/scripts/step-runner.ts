// The one, real, unified testing and data-loading tool for this
// application. Full design: docs/skill-step-runner-design.md.
// The data file itself is purely positional data - zero commands,
// zero selectors, zero field names. The screen registry (screens.csv)
// is the one, real place that says what each position means and how
// to drive that screen. An optional .control.csv supplies verify/
// screenshot per row, kept out of the data file entirely.

import { readFileSync, mkdirSync, existsSync, writeFileSync, appendFileSync } from 'fs';
import { createInterface } from 'readline';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium, type Browser, type Page } from 'playwright';
import * as db from '../src/db.js';
import * as auth from '../src/auth.js';
// Per direct, absolute instruction (shared-fixtures/csv.ts's own
// header comment): every real data file in this project is plain
// ASCII, with any non-ASCII character escaped as "\u{hex}" - one,
// real, shared escape convention, one, real, shared implementation,
// reused here exactly as-is rather than a second, parallel decoder.
import { unescapeAscii } from '../../shared-fixtures/csv.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  //
  // A real, confirmed bug found and fixed directly: this entry never
  // read screens.csv's own "businessType" position (the real new-business
  // page's second select, "Sole Trader"/"Partnership"/...) at all, so
  // neither coaPrototype nor entityStructure ever reached db.createBusiness
  // on the API path - unlike the real frontend (frontend/src/routes/setup/
  // new-business/+page.svelte), which always submits both: a coaPrototype
  // (its own, separate, first select, defaulting to COA_PROTOTYPES[0] =
  // "English CoA") and an entityStructure (mapped from the business-type
  // select via BUSINESS_TYPE_TO_ENTITY_STRUCTURE). Without a coaPrototype,
  // copyChartOfAccountsInto never copies any of the universal, English-
  // CoA-tagged leaves (Sales Revenue, Cost of Goods Sold, Inventory,
  // Owner's Equity) into the new business's own Chart of Accounts at all,
  // so every later, lazy, per-combination leaf (ensureCombinationAccountLeaf
  // et al.) fell back to the bare, global lookup and posted onto the
  // shared, global template entities instead - invisible to
  // getBusinessReports' own, correct, business-scoped walk. Mirrors the
  // frontend's own defaults/mapping exactly, not a new, separate design.
  createBusiness: (a) => {
    const BUSINESS_TYPE_TO_ENTITY_STRUCTURE: Record<string, string> = {
      'Sole Trader': 'sole_trader',
      Partnership: 'partnership',
      'Pty Ltd Company': 'llc',
      'Incorporated Company': 'publicly_traded',
    };
    // A further, real, confirmed gap, found and fixed in the same
    // pass as the one above: coaPrototype was hardcoded to 'English
    // CoA' here, and secondaryCurrencies was always undefined - the
    // real new-business page's own CoA-prototype select (its first,
    // real <select>, "English / generic"/"German"/"French") and its
    // own, real, optional "Accept additional currencies" section were
    // never actually reachable from the API path at all, exercising
    // neither coaPrototype nor secondaryCurrencies genuinely. Mapped
    // here the exact, same way the real frontend does (COA_PROTOTYPES'
    // own label -> prototypeName mapping, frontend/src/routes/setup/
    // new-business/+page.svelte), so a data row naming "German" (the
    // real, visible select-option label) resolves to the real, same
    // "German CoA" prototype name db.createBusiness itself expects -
    // never a new, separate, parallel mapping.
    const COA_PROTOTYPE_LABEL_TO_NAME: Record<string, string> = {
      'English / generic': 'English CoA',
      German: 'German CoA',
      French: 'French CoA',
    };
    const coaPrototype = a.coaPrototype ? (COA_PROTOTYPE_LABEL_TO_NAME[a.coaPrototype] ?? a.coaPrototype) : 'English CoA';
    const secondaryCurrencies = a.secondaryCurrencies
      ? a.secondaryCurrencies.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
      : undefined;
    const entityStructure = a.businessType ? BUSINESS_TYPE_TO_ENTITY_STRUCTURE[a.businessType] : undefined;
    const result = db.createBusiness(
      a.businessName as any,
      a.financialYearLabel,
      db.asUserId(1),
      coaPrototype,
      secondaryCurrencies,
      entityStructure as any
    );
    if (a.homeCurrency) db.setBusinessHomeCurrency(a.businessName, a.homeCurrency, db.asUserId(1));
    return result;
  },
  // A real, further, confirmed gap: the real post-creation banking
  // wizard on /setup/new-business (nominate a bank account, then
  // confirm the real bank x currency combination to build "Cash at
  // Bank" from) was never exercised by this tool at all - neither
  // path. nominateBankAccountSimple matches POST
  // /businesses/:name/bank-accounts exactly (see
  // frontend/src/routes/setup/new-business/+page.svelte's own
  // nominateBank function).
  nominateBankAccountSimple: (a) => db.nominateBankAccount(a.businessName as any, a.bankAccountName, a.routingDetail, a.accountNumber, db.asUserId(1)),
  // The real, same-shaped counterpart for the wizard's own final,
  // real "Confirm and build Cash at Bank" step - matches
  // buildBankCurrencyStructure's own, real, current signature exactly
  // (see its own doc comment in backend/src/db.ts for why
  // homeCurrency is a real, required, separate argument, not folded
  // into a selection's own currency field). This tutorial fixture's
  // own real business trades in exactly one bank, one currency - the
  // real, single-selection branch - so one, real selection is enough
  // to genuinely exercise it; a further, real, multi-bank/multi-
  // currency case is a separate, further fixture, not this one.
  buildBankCurrencyStructureSimple: (a) => {
    const userId = db.asUserId(1);
    db.buildBankCurrencyStructure(
      a.businessName as any,
      'Cash at Bank',
      db.typeAssetAccountName,
      [{ bankAccountName: a.bankAccountName, currency: a.currency }],
      userId,
      a.currency
    );
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
    // Per docs/skill-step-runner-design.md §20: division is now set
    // by createAndConfigureLocation itself, atomically, both as the
    // Hierarchy group tag (division-breakdown reports) and as the
    // real "Belongs To Group" relationship the org chart/Business
    // Setup's employee tree actually reads - a real, confirmed gap,
    // found and fixed at its one, real, single source, not patched
    // here a second time.
    return db.createAndConfigureLocation(a.businessName as any, a.locationName, {
      city: a.city,
      location_type: a.locationType,
      is_billing_address: false,
      bottle_capacity: a.bottleCapacity ? Number(a.bottleCapacity) : null,
      carton_capacity: a.cartonCapacity ? Number(a.cartonCapacity) : null,
      timezone: 'Australia/Adelaide',
    } as any, userId, a.division || undefined, a.division ? 'Division' : undefined);
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
  createCustomerSimple: (a) => db.createCustomer(a.customerName, db.asUserId(1)),
  // Per docs/skill-step-runner-design.md §11b: the real, granular,
  // complete-in-itself General Journal screens - one real row per
  // real HTTP call, matching /journal/staging and /journal/post
  // exactly, never one, combined, artificial row standing in for
  // a whole, multi-line entry.
  stageJournalLine: (a) => {
    db.stageLine({ reference: a.reference, business: a.businessName as any, ledger: a.ledger as any, account: a.account as any, amount_minor: Number(a.amountMinor) });
  },
  postJournalEntrySimple: (a) => {
    const userId = db.asUserId(1);
    db.postJournalEntry(a.reference, a.businessName as any, a.ledger as any, userId);
  },
  // Per docs/skill-step-runner-design.md §11b: the real, generic
  // createEntity shape (name, parent) - matching POST /entities
  // exactly, the same, real, shared endpoint several, genuinely
  // different real screens (Create Item's own category and item
  // steps, among others) actually call.
  createEntitySimple: (a) => {
    db.createEntityRaw({ name: a.name, parent: a.parent || undefined }, db.asUserId(1));
  },
  // Per docs/skill-step-runner-design.md §11b: matching
  // POST /stock/po/stage exactly.
  stagePurchaseOrderSimple: (a) => {
    db.stagePurchaseOrder({
      reference: a.reference, business: a.businessName as any, ledger: a.ledger as any,
      vendor: a.vendor as any, item: a.item as any, quantity: Number(a.quantity), price_minor: Number(a.priceMinor),
    });
  },
  postPurchaseOrderSimple: (a) => {
    const userId = db.asUserId(1);
    db.postPurchaseOrder(a.reference, a.businessName as any, a.ledger as any, userId);
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
  cashSaleSimple: (a) => {
    const userId = db.asUserId(1);
    return db.completePosSale({
      business: a.businessName as any,
      ledger: db.asLedgerName('Actual'),
      locationName: a.locationName as any,
      customerName: a.customerName as any,
      lines: [{ itemName: a.itemName, quantity: Number(a.quantity), unitPriceMinor: Number(a.unitPriceMinor), taxMinor: 0 }],
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
  // The real, direct, UI-wireable precondition receiveStockWithCombination
  // and openContainer below otherwise only ever create lazily, as a
  // side effect, with nothing for a real browser-driven run to select
  // from beforehand. Idempotent (ensureHierarchyGrouping/Value), so
  // running it again here does no harm.
  createHierarchyGroupingSimple: (a) => {
    const userId = db.asUserId(1);
    db.ensureHierarchyGrouping(a.businessName as any, a.groupingName, userId);
  },
  createHierarchyValueSimple: (a) => {
    const userId = db.asUserId(1);
    db.ensureHierarchyValue(a.businessName as any, a.groupingName, a.valueName, userId);
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
  // A real, separate, explicitly-named entry rather than a retrofit of
  // posSaleSimple above (which hardcodes 'Actual', exactly as
  // cashPurchaseSimple/cashSaleSimple/transferItemsSimple all still do
  // - a real, confirmed, pre-existing simplification in this test
  // harness, never in the real backend routes themselves, which
  // already take an explicit ledger field - see routes/pos.ts).
  // Needed to post a real sale into the NEW ledger after a real
  // rollover, exercising the real ledger-isolation checks below
  // without touching any existing row's own field count.
  posSaleInLedgerSimple: (a) => {
    const userId = db.asUserId(1);
    return db.completePosSale({
      business: a.businessName as any,
      ledger: db.asLedgerName(a.ledger),
      locationName: a.locationName as any,
      customerName: 'Cash Sale' as any,
      lines: [{ itemName: a.itemName, quantity: Number(a.quantity), unitPriceMinor: Number(a.unitPriceMinor), taxMinor: 0 }],
      taxAccount: 'Sales Tax Payable' as any,
      paymentMethod: 'cash',
    }, userId);
  },
  // Reproduces, via the real API path (auth.ts's own real
  // createUser/setUserRoles, not a parallel test-only mechanism), the
  // exact, real two-call sequence backend/test/auth.test.ts's
  // "setUserRoles changes what a session created afterward reflects"
  // already exercises as a unit test: create a user with one real
  // role, then call setUserRoles a second time naming an overlapping
  // role set. No real screen exists for driving this from the UI path
  // (frontend/src/routes/setup/users/+page.svelte's own role grid is
  // a dynamic, per-role checkbox column, not a stable, positional set
  // of fields this registry's generic field_selector/field_type
  // contract can drive honestly) - api_function only, the exact, same,
  // honest shape already used above for Create Entity.
  createUserSimple: (a) => {
    auth.createUser(a.username, a.password, (a.roles || '').split(',').map((r) => r.trim()).filter(Boolean));
  },
  // The real, second call of the exact, same failing sequence - looks
  // the just-created user up by username (the one, real, stable key
  // this fixture's own data file carries), since setUserRoles itself
  // takes a numeric userId, never a username.
  setUserRolesSimple: (a) => {
    const user = auth.listUsers().find((u) => u.username === a.username);
    if (!user) throw new Error(`No such user "${a.username}" - Create User must run first.`);
    auth.setUserRoles(user.id, (a.roles || '').split(',').map((r) => r.trim()).filter(Boolean));
  },
  // The one, real, test-runner-driven way translations are ever loaded
  // into a running instance - matching POST /api/i18n/translations
  // exactly (src/routes/i18n.ts calls this exact, same, real
  // setTranslation function). Assumes the real concept entity already
  // exists - either a real, structural entity 00-core.sql already
  // creates, or a real Vocabulary word a preceding "Create Entity" row
  // in the same data file creates first, the exact, same, real way a
  // person using /setup/translations' own "Add a new word" form would.
  setTranslationSimple: (a) => {
    db.setTranslation(a.concept, a.language, a.translationText, db.asUserId(1));
  },
};

// ---------------------------------------------------------------------------
// Per direct instruction: extends the tutorial fixture with real
// pre/post year-end reports, read from both the old and the new
// ledger, plus a real sale posted into the new ledger after rollover
// - proving real ledger isolation ("nothing ever posts across
// ledgers", docs/ledger-scoped-accounts-and-rollover.md) with real,
// structurally-true checks rather than a hand-computed, fragile
// "golden" figure: a trial balance must always balance; closing the
// books must never change the P&L already reported for that same
// period; a brand-new ledger's own P&L is genuinely zero until
// something is actually posted into it (Income/Expense are never
// carried forward); and the OLD ledger's own trial balance must stay
// byte-identical after a sale posts into the NEW ledger, never
// shared.
//
// The small, in-memory maps below are the one, real, deliberately
// simple way two separate steps ("record this" / "does it still
// match") compare a real figure across time, within one real run of
// this fixture - never persisted, never meant to be.
// ---------------------------------------------------------------------------

const recordedTrialBalanceTotals = new Map<string, number>();
const recordedNetIncome = new Map<string, number>();

function tbKey(a: Record<string, string>): string {
  return `${a.businessName}::${a.ledger}::${a.asOfDate ?? ''}`;
}
function plKey(a: Record<string, string>): string {
  return `${a.businessName}::${a.ledger}::${a.fromDate ?? ''}::${a.toDate ?? ''}`;
}

/** The one, real registry of named, shared verifications - the same,
 * real check, callable from either the API path or the UI path. */
export const VERIFY_REGISTRY: Record<string, (args: Record<string, string>) => boolean> = {
  business_exists: (a) => db.getEntityTree().some((e) => e.name === a.businessName),
  location_exists: (a) => db.getEntityTree().some((e) => e.name === a.locationName),
  // Confirms the real, post-creation banking wizard's own "Confirm and
  // build Cash at Bank" step genuinely built a real, postable Cash at
  // Bank account - the same, simple, direct, name-based style every
  // other real verify entry here already uses.
  cash_at_bank_exists: () => db.getEntityTree().some((e) => e.name === 'Cash at Bank'),
  // Confirms a real Stock Transfer step genuinely moved stock, not just
  // that the browser's own click didn't throw - found to matter directly
  // (docs/skill-step-runner-design.md section 18's own "net::ERR_ABORTED"
  // class of blind spot): a required "Reference" field the UI form
  // enforces but the API path never needed silently left the real
  // transfer unsaved, with a visible, real validation error on screen,
  // while the click itself still "succeeded" with no exception.
  transfer_landed: (a) => db.getInventoryListingByLocation(a.businessName as any).some((g) => g.location === a.toLocationName && g.rows.some((r) => r.item === a.itemName)),
  // Confirms the real Purchase Order screen genuinely staged AND posted
  // a real, balanced journal entry under this reference - the same
  // real, direct way `listJournalEntries` itself already reports every
  // other real posted entry, rather than trusting a real UI click that
  // may have only staged, not posted (or vice versa).
  //
  // A real, confirmed bug fixed here, found live: this check used to
  // require an EXACT match (`j.reference === a.reference`), but
  // `placeOrder` (backend/src/db-stock.ts) never posts a journal entry
  // under the bare order reference at all - every quantity movement it
  // posts is suffixed (`${reference}-PLACE`, `${reference}-PLACE-
  // VALUE`, `${reference}-PLACE-ONORDER`), confirmed directly via a
  // live query against the real `journal` table after a real, UI-driven
  // Purchase Order (the real screenshot for this exact run already
  // showed "Purchase Order PO-AMBER-1 placed with Highland Brewing Co."
  // - the real UI and backend had genuinely succeeded the whole time;
  // only this exact-match check was wrong). Fixed to match on the real,
  // confirmed `-PLACE` suffix convention instead.
  purchase_order_posted: (a) => db.listJournalEntries(a.businessName as any, db.asLedgerName('Actual'), 500, 0).some((j) => j.reference === `${a.reference}-PLACE`),
  item_source_registered: (a) => db.listItemSources(a.itemName).some((s) => s.vendor_name === a.providerName),
  // Real, structural checks on a real, live Trial Balance/Profit and
  // Loss report - never a hand-computed "golden" figure that would go
  // stale the moment an earlier step's own numbers change. See the
  // real comment above the two record/compare maps for why this is
  // the right shape for a pre/post year-end, old-ledger/new-ledger
  // comparison.
  trial_balance_balanced: (a) => {
    const tb = db.getTrialBalance(a.businessName as any, db.asLedgerName(a.ledger), a.asOfDate || undefined);
    return tb.total_debit_minor === tb.total_credit_minor && tb.total_debit_minor > 0;
  },
  record_trial_balance_total: (a) => {
    const tb = db.getTrialBalance(a.businessName as any, db.asLedgerName(a.ledger), a.asOfDate || undefined);
    recordedTrialBalanceTotals.set(tbKey(a), tb.total_debit_minor);
    return true;
  },
  // The real, direct ledger-isolation proof: this exact figure, for
  // the OLD ledger, must be identical before and after a real sale
  // posts into the brand-new ledger - "nothing ever posts across
  // ledgers" is meaningless unless something checks it stays true.
  trial_balance_total_matches_recorded: (a) => {
    const tb = db.getTrialBalance(a.businessName as any, db.asLedgerName(a.ledger), a.asOfDate || undefined);
    const recorded = recordedTrialBalanceTotals.get(tbKey(a));
    return recorded !== undefined && recorded === tb.total_debit_minor;
  },
  profit_and_loss_positive: (a) => {
    const pl = db.getProfitAndLoss(a.businessName as any, db.asLedgerName(a.ledger), a.fromDate || undefined, a.toDate || undefined);
    return pl.net_income_minor > 0;
  },
  // A brand-new ledger's own P&L is genuinely zero until something is
  // actually posted into it - Income/Expense are never carried
  // forward across a rollover (docs/ledger-scoped-accounts-and-
  // rollover.md), only the real, "used" Balance Sheet accounts are.
  profit_and_loss_zero: (a) => {
    const pl = db.getProfitAndLoss(a.businessName as any, db.asLedgerName(a.ledger), a.fromDate || undefined, a.toDate || undefined);
    return pl.net_income_minor === 0 && pl.total_income_minor === 0;
  },
  record_profit_and_loss_net_income: (a) => {
    const pl = db.getProfitAndLoss(a.businessName as any, db.asLedgerName(a.ledger), a.fromDate || undefined, a.toDate || undefined);
    recordedNetIncome.set(plKey(a), pl.net_income_minor);
    return true;
  },
  // The real, direct proof that closing the books never changes the
  // P&L already reported for that same, real period - closeBooks'
  // own closing entry is deliberately excluded from this read
  // (excludeCloseEntries, default true, db-reports.ts), specifically
  // so this stays true.
  profit_and_loss_net_income_matches_recorded: (a) => {
    const pl = db.getProfitAndLoss(a.businessName as any, db.asLedgerName(a.ledger), a.fromDate || undefined, a.toDate || undefined);
    const recorded = recordedNetIncome.get(plKey(a));
    return recorded !== undefined && recorded === pl.net_income_minor;
  },
  // Confirms a real Set User Roles step genuinely left the user with
  // exactly the role set asked for - the real, direct assertion the
  // failing unit test itself makes (via a fresh login's own
  // user.roles), read here the exact, same, real way listUsers()
  // itself already reports every other real user's role set, never a
  // separate, parallel mechanism.
  user_has_exact_roles: (a) => {
    const user = auth.listUsers().find((u) => u.username === a.username);
    if (!user) return false;
    const expected = [...(a.roles || '').split(',').map((r) => r.trim()).filter(Boolean)].sort();
    const actual = [...user.roles].sort();
    return expected.length === actual.length && expected.every((r, i) => r === actual[i]);
  },
  // Confirms a real Set Translation step genuinely saved the exact,
  // real text asked for - read back the exact, same, real way
  // GET /api/i18n/text/:language itself already reports every other
  // real saved translation, never a separate, parallel mechanism.
  translation_matches: (a) => db.getTranslation(a.concept, a.language) === a.translationText,
  // A real, generic, screen-agnostic existence check, reusable by any
  // real screen whose own fields include a plain "name" - confirms a
  // real Add Vocabulary Word (or Create Entity) step genuinely left a
  // real entity by that exact name somewhere in the real tree.
  entity_named_exists: (a) => db.getEntityTree().some((e) => e.name === a.name),
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
    else if (ch === ',') { fields.push(unescapeAscii(cur)); cur = ''; }
    else cur += ch;
  }
  fields.push(unescapeAscii(cur));
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

// A real, generic, screen-agnostic templating extension, same contract
// as "money"/"select"/"check_by_text" above: a field_selector or
// submit_selector can reference ANOTHER field of the exact same step by
// name - "{{fieldName}}" - resolved from this step's own, already-built
// args before the selector is ever handed to Playwright. Needed by any
// real screen whose own, real selector genuinely depends on which
// value a sibling field carries (e.g. /setup/translations: which
// fieldset's own input/button to use depends entirely on that row's
// own "language" value) - never a per-screen special case, the exact,
// same, real "tell the runner how to apply this value" contract this
// file already uses throughout.
function resolveSelectorTemplate(selector: string, args: Record<string, string>): string {
  return selector.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => args[name] ?? '');
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

/** Reads the real, currently logged-in session's own bearer token
 * straight out of the real browser's own sessionStorage (confirmed
 * directly, frontend/src/lib/state.svelte.ts: 'sql-ledger-ts-auth',
 * deliberately sessionStorage, never a cookie) - the real, same token
 * the frontend's own api.ts attaches as `Authorization: Bearer
 * <token>` to every real call. A raw `page.request` call carries none
 * of this automatically (it is not cookie-based auth), which is
 * exactly why the first version of the recording-verification feature
 * (§19) silently got a real 401 back without ever throwing. */
async function authHeader(page: Page): Promise<Record<string, string>> {
  const raw = await page.evaluate(() => sessionStorage.getItem('sql-ledger-ts-auth'));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed.token ? { Authorization: `Bearer ${parsed.token}` } : {};
  } catch {
    return {};
  }
}

// Shared by open_selector and submit_selector: both are a real,
// ";;"-separated sequence of actions needed to reach or commit a real
// screen's own form, never anything specific to one particular screen.
// Three real kinds of action: a plain Playwright selector (clicked), a
// real key press ("key:Name"), or - the one case a real, bare click
// can never cover - choosing a real, fixed <option> that is itself a
// genuine, required precondition for the rest of the form to even
// render (e.g. Open Container's own Grouping dropdown must already be
// "Container" before its Container-value/Unit-value selects exist at
// all), named directly here rather than through a real data-file
// column, since this one, specific value is never something a given
// screen's own data varies by ("select:<selector>::<value>").
async function runActionSequence(page: Page, actionsRaw: string): Promise<void> {
  for (const action of actionsRaw.split(';;').map((a) => a.trim()).filter(Boolean)) {
    if (action.startsWith('key:')) {
      await page.keyboard.press(action.slice(4));
    } else if (action.startsWith('select:')) {
      const rest = action.slice('select:'.length);
      const sepIdx = rest.indexOf('::');
      const selector = rest.slice(0, sepIdx);
      const optionValue = rest.slice(sepIdx + 2);
      await page.locator(selector).selectOption({ value: optionValue });
    } else {
      await page.locator(action).click();
    }
    await page.waitForTimeout(300);
  }
}

export async function runStepViaUi(page: Page, step: Step, screens: Map<string, Screen>, screenshotDir: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const screen = screens.get(step.screen_name);
    const args = buildArgs(step, screen);
    // A real, honest failure, not a silent no-op: if screens.csv has no
    // real UI wiring at all for this screen (no ui_path/open_selector to
    // reach it, no submit_selector to commit it, and no field actually
    // has a field_selector to drive), there is genuinely no UI
    // interaction this function can perform. Previously this fell
    // through every `if` below untouched and returned `ok: true` having
    // done nothing - a confirmed, real false-positive that let UI-path
    // runs report success for steps the browser never touched. Fail
    // loudly instead, so --fallback-to-api (and a plain run) see the
    // truth.
    const hasAnyRealUiWiring = !!(
      screen &&
      (screen.ui_path || screen.open_selector || screen.submit_selector || screen.fields.some((f) => f.field_selector))
    );
    if (!hasAnyRealUiWiring) {
      return {
        ok: false,
        error: `screens.csv has no real UI wiring (ui_path/open_selector/submit_selector/field_selector) for screen "${step.screen_name}" - only api_function is set, so there is no browser interaction to perform. This screen's UI path has never actually been implemented/tested.`,
      };
    }
    if (screen?.ui_path && !page.url().endsWith(screen.ui_path)) {
      const navStart = Date.now();
      await page.goto(screen.ui_path);
      console.log(`  [load] goto ${screen.ui_path}: ${Date.now() - navStart}ms`);
    }
    // open_selector is almost always one, real click - but a real
    // screen can genuinely need more than one real action to reach
    // its own form (e.g. Business Setup's real Insert-key tree:
    // select a real row, then press a real key - never a click on
    // its own; or Open Container, which must pick its own, fixed
    // Grouping option before its real Container/Unit-value selects
    // even exist). See runActionSequence - still purely generic.
    if (screen?.open_selector) {
      const openStart = Date.now();
      await runActionSequence(page, screen.open_selector);
      console.log(`  [load] open_selector ${screen.open_selector}: ${Date.now() - openStart}ms`);
    }
    if (screen) {
      for (const field of screen.fields) {
        if (!field.field_selector) continue;
        const value = step.values[field.position - 1] ?? '';
        if (value === '') continue;
        // Every field_selector is resolved against this step's own
        // args first ({{fieldName}} -> that sibling field's own value)
        // - see resolveSelectorTemplate above - before it is ever
        // handed to Playwright, so the narrow field_types below never
        // need to know or care whether their own selector was literal
        // or templated.
        const resolvedSelector = resolveSelectorTemplate(field.field_selector, args);
        // "signed_money" is the one, narrow, generic extension a real
        // debit/credit grid needs (docs/skill-step-runner-design.md
        // §11b-ii): a single minor-units value is genuinely routed to
        // one of two different real inputs depending only on its own
        // sign - never a per-screen special case, the same "tell the
        // runner how to apply this value" contract "select"/"check"/
        // "money" already use. field_selector carries both real
        // locators, "<debit>|<credit>", because this is the only
        // field_type that ever needs two.
        if (field.field_type === 'signed_money') {
          const [debitSelector, creditSelector] = resolvedSelector.split('|');
          const minorUnits = Number(value);
          if (minorUnits === 0) continue;
          const targetSelector = minorUnits > 0 ? debitSelector : creditSelector;
          await page.locator(targetSelector).fill((Math.abs(minorUnits) / 100).toFixed(2));
          await page.waitForTimeout(200);
          continue;
        }
        // "check_by_text" is the last of these narrow, generic
        // extensions: a real, generic multiselect-by-checkbox widget
        // (e.g. Create User's own Roles field) renders one checkbox per
        // real, named option, each wrapped in its own <label>, with no
        // other stable, per-option selector at all - the only real way
        // to tell them apart is the real, visible text already carried
        // by the data file's own value. field_selector names the real,
        // containing element (e.g. ".multiselect"); one or more
        // comma-separated real names are each checked within it - still
        // the same, generic "tell the runner how to apply this value"
        // contract, never a per-screen special case.
        if (field.field_type === 'check_by_text') {
          const container = page.locator(resolvedSelector);
          for (const name of value.split(',').map((n) => n.trim()).filter(Boolean)) {
            await container.locator('label', { hasText: name }).locator('input[type=checkbox]').check();
            await page.waitForTimeout(200);
          }
          continue;
        }
        // "search_and_select" is the real, generic, screen-agnostic
        // shape a dynamic search-then-select list needs (e.g.
        // /setup/translations' own real word list): fills a real
        // search input with this field's own value, then clicks the
        // real list item whose own, visible text matches it exactly -
        // the same, real "tell the runner how to apply this value"
        // contract every other field_type here already uses, never
        // anything specific to one particular screen. field_selector
        // carries both real locators, "<search input>|<list item>".
        if (field.field_type === 'search_and_select') {
          const [searchSelector, itemSelector] = resolvedSelector.split('|');
          await page.locator(searchSelector).fill(value);
          await page.waitForTimeout(300);
          await page.locator(itemSelector, { hasText: value }).first().click();
          await page.waitForTimeout(200);
          continue;
        }
        const locator = page.locator(resolvedSelector);
        if (field.field_type === 'select') await locator.selectOption({ label: value });
        // "select_value" is the other narrow, generic extension a real
        // screen can need: some real <option>s show a longer, decorated
        // label (e.g. "Main Street Cellar (Springfield)") than the real,
        // plain name their own value attribute carries - the same plain
        // name every real data-file value already uses. Matching on the
        // real value attribute instead of the label is the same, generic
        // "tell the runner how to apply this value" contract "select"
        // already uses, never a per-screen special case.
        else if (field.field_type === 'select_value') await locator.selectOption({ value });
        else if (field.field_type === 'check') await (value === 'true' ? locator.check() : locator.uncheck());
        // A real, generic, screen-agnostic unit conversion, not a
        // per-screen special case: several real data-file values are
        // genuinely stored in minor currency units (matching the real
        // API path exactly - e.g. unitCostMinor), while the matching
        // real UI field genuinely displays/accepts whole-currency
        // decimal amounts (e.g. "3.50", never "350"). "money" tells
        // the runner to convert, the same way "select"/"check" already
        // tell it how to apply a value - never anything specific to
        // which real screen this is.
        else if (field.field_type === 'money') await locator.fill((Number(value) / 100).toFixed(2));
        // "text_enter" is the other narrow, generic extension a real
        // screen can need: some real fields (e.g. a live item-search box
        // that adds its top match on Enter, never on a separate submit
        // click) only commit their value on a real Enter keypress, not
        // merely by being filled. Same contract as "money"/"select"/
        // "check" - tells the runner how to apply the value, never
        // anything specific to which real screen this is.
        else if (field.field_type === 'text_enter') {
          await locator.fill(value);
          await locator.press('Enter');
        } else await locator.fill(value);
        await page.waitForTimeout(200);
      }
      if (screen.submit_selector) {
        // submit_selector is almost always one, real click - but a real
        // screen can genuinely need more than one real action to commit
        // its own form (e.g. a two-step confirm flow: "Preview" then
        // "Accept"). ";;"-separated steps, each either a real Playwright
        // selector (clicked) or "key:Name" (a real key press), mirror
        // open_selector's own existing support for this - still purely
        // generic. Also resolved against this step's own args first, the
        // exact, same, real reason field_selector is resolved above -
        // a real submit button can genuinely live inside the exact,
        // same, templated container a sibling field's own input does
        // (e.g. /setup/translations' own, real, per-language Save
        // button).
        const resolvedSubmitSelector = resolveSelectorTemplate(screen.submit_selector, args);
        for (const action of resolvedSubmitSelector.split(';;').map((a) => a.trim()).filter(Boolean)) {
          if (action.startsWith('key:')) await page.keyboard.press(action.slice(4));
          else await page.locator(action).click();
          // A real, confirmed timing gap, not a guess: repeated, real runs
          // in this same session showed "Verify ... returned false"
          // immediately after a real, successful-looking submit click -
          // the real POST was still in flight when the very next line read
          // the database. 800ms was not enough real margin under genuine,
          // ordinary load; widened once, directly in response to that
          // repeated, observed failure, not spent speculatively.
          await page.waitForTimeout(2000);
        }
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
    console.error('Usage: step-runner <data.csv> [--screens screens.csv] [--lint] [--pretty] [--path api|ui] [--steps N] [--only N] [--skip N] [--non-interactive] [--delay MS] [--ui] [--screenshot-dir DIR] [--verify NAME] [--screenshot NAME] [--fallback-to-api] [--verify-via-recording] [--timing-file FILE]');
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
  // Real, confirmed confusion (found while writing the User Manual tutorial
  // chapter): this script always runs with `backend/` as its own real cwd
  // (the Makefile's own `cd backend &&` prefix), so the old relative
  // default here ('docs/manual-images-tutorial') genuinely wrote to
  // backend/docs/manual-images-tutorial/ - a second, real, different
  // directory from docs/manual-images-tutorial/ at the repo root, which is
  // the one the real User Manual markdown actually references. Pointed at
  // the real, same, single, canonical directory the manual uses, so a
  // fresh UI-path run's own real screenshots land exactly where the
  // manual expects them, with no further manual copying step.
  const screenshotDir = args.includes('--screenshot-dir') ? args[args.indexOf('--screenshot-dir') + 1] : '../docs/manual-images-tutorial';
  const inlineVerify = args.includes('--verify') ? args[args.indexOf('--verify') + 1] : undefined;
  const inlineScreenshot = args.includes('--screenshot') ? args[args.indexOf('--screenshot') + 1] : undefined;
  // Per direct request: a real UI step that fails is retried once,
  // immediately, via the API path, so one, real, still-broken UI
  // interaction doesn't block every later step that genuinely depends
  // on this one's data existing. Off by default - a pure --path ui
  // run still reports every real UI failure as a real failure, never
  // silently papered over, unless this is explicitly asked for.
  const fallbackToApi = args.includes('--fallback-to-api');
  // Per direct instruction: a --path ui run should prove its own real
  // UI actions genuinely produced the real, correct backend call -
  // not just "nothing threw" - by reusing the already-built Admin
  // Recording feature (docs/skill-step-runner-design.md §11, §19) as
  // an independent, externally-generated oracle. Off by default -
  // this needs a real, logged-in Login step to actually run via the
  // UI first, which isn't true of every possible run (--only N on a
  // later step, for instance).
  const verifyViaRecording = args.includes('--verify-via-recording');
  // Per direct request: this runner is the one, real, single way any
  // front-end or back-end step in a fixture is ever exercised -
  // nobody writes a raw, one-off Playwright script instead. Every
  // real run can therefore record its own, real, per-step execution
  // time to one, nominated file, a real, structured place to look for
  // a slow step instead of scrolling console output - rather than
  // leaving timing as something only ever read by eye, once, as the
  // run scrolls past.
  const timingFile = args.includes('--timing-file') ? args[args.indexOf('--timing-file') + 1] : undefined;
  if (timingFile) writeFileSync(timingFile, 'index,screen_name,path,ms,ok,error\n');
  function recordTiming(stepIndex: number, screenName: string, stepPath: string, ms: number, ok: boolean, error?: string) {
    if (!timingFile) return;
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    appendFileSync(timingFile, `${stepIndex},${escape(screenName)},${stepPath},${ms},${ok},${escape(error ?? '')}\n`);
  }

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
      // Real, measured backend wait time per real network call - not a
      // guess, not the blind post-submit sleep. timing() gives Playwright's
      // own resource-timing numbers for the real request; responseEnd minus
      // requestStart is the real time spent waiting on this real backend
      // call (DNS/connect/TLS excluded, both zero on localhost anyway).
      page.on('requestfinished', async (req) => {
        if (!req.url().includes(':3001')) return;
        try {
          const t = req.timing();
          const res = await req.response();
          const waitMs = Math.round(t.responseEnd - t.requestStart);
          console.log(`  [net] ${req.method()} ${req.url().replace('http://localhost:3001', '')} -> ${res?.status()} [${waitMs}ms backend wait]`);
        } catch {
          // Response may already be gone by the time we read it; not fatal.
        }
      });
    }
    return page;
  }
  if (path === 'ui') await ensureUiPage();

  // Recording verification state (--verify-via-recording). Started
  // right after a real, successful, UI-driven Login step; every
  // further real, successfully UI-driven, data-kind step's own
  // values are the real, expected row the backend's own recording
  // mechanism should independently produce - compared, not assumed,
  // once the run finishes.
  let recordingStarted = false;
  let recordingUsername: string | undefined;
  const recordedExpectations: { screen_name: string; values: string[] }[] = [];

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
      const stepStart = Date.now();
      let result = stepPath === 'ui' ? await runStepViaUi(await ensureUiPage(), step, screens, screenshotDir) : runStepViaApi(step, screens);
      const stepMs = Date.now() - stepStart;
      recordTiming(step.index, step.screen_name, stepPath, stepMs, result.ok, result.ok ? undefined : result.error);
      const uiSucceededDirectly = stepPath === 'ui' && result.ok;
      console.log(result.ok ? `✅ ${step.index}: ${step.screen_name} (${stepPath}) [${stepMs}ms]` : `❌ ${step.index}: ${step.screen_name} (${stepPath}): ${result.error} [${stepMs}ms]`);
      if (verifyViaRecording && uiSucceededDirectly) {
        if (step.screen_name === 'Login' && !recordingStarted) {
          try {
            // A real, absolute URL, deliberately - the browser
            // context's own baseURL is the real frontend's own origin
            // (localhost:5173, never proxying /api anywhere - checked
            // directly, frontend/vite.config.ts has no proxy at all),
            // the exact, same reason the real frontend's own api.ts
            // always calls localhost:3001 directly, never a relative
            // path. A relative '/api/...' here would silently resolve
            // against the wrong origin and never throw - `page.request`
            // does not throw on a non-2xx response, so its own real
            // status is checked explicitly instead of trusting "did
            // not throw" the same way section 18 already found wrong
            // for runStepViaUi itself.
            const startResp = await (await ensureUiPage()).request.post('http://localhost:3001/api/recording/start', {
              headers: await authHeader(await ensureUiPage()),
            });
            if (!startResp.ok()) throw new Error(`POST /api/recording/start returned ${startResp.status()}`);
            recordingStarted = true;
            recordingUsername = step.values[0];
            console.log(`   ↳ recording started for "${recordingUsername}"`);
          } catch (err) {
            console.log(`   ↳ could not start recording: ${err instanceof Error ? err.message : String(err)}`);
          }
        } else if (recordingStarted && (screens.get(step.screen_name)?.screen_kind ?? 'data') === 'data') {
          recordedExpectations.push({ screen_name: step.screen_name, values: step.values });
        }
      }
      // Per direct request: a real UI step that fails is retried once,
      // immediately, via the API path - the same, real, live backend
      // and database the browser's own session is already pointed at
      // (never a separate one), so the fallback's own effect is
      // genuinely visible to the next, real UI step. Reported as its
      // own, distinct, real line - never silently folded into the
      // original UI result - so a reader can tell "the UI genuinely
      // works" from "the UI is broken here, the API covered for it."
      if (!result.ok && stepPath === 'ui' && fallbackToApi) {
        const fallbackStart = Date.now();
        const apiResult = runStepViaApi(step, screens);
        const fallbackMs = Date.now() - fallbackStart;
        recordTiming(step.index, step.screen_name, 'api-fallback', fallbackMs, apiResult.ok, apiResult.ok ? undefined : apiResult.error);
        console.log(apiResult.ok
          ? `   ↳ ✅ ${step.index}: ${step.screen_name} (api fallback, after ui failure) [${fallbackMs}ms]`
          : `   ↳ ❌ ${step.index}: ${step.screen_name} (api fallback also failed): ${apiResult.error} [${fallbackMs}ms]`);
        result = apiResult;
      }
      if (!result.ok && !nonInteractive) {
        const cont = await prompt('Step failed. Continue anyway? [y/N] ');
        if (cont.trim().toLowerCase() !== 'y') { if (browser) await browser.close(); return; }
      }
      if (stepPath === 'ui' && !nonInteractive) await new Promise((r) => setTimeout(r, delayMs));
    }
    index += batch.length;
  }
  if (verifyViaRecording && recordingStarted && page) {
    try {
      const stopResp = await page.request.post('http://localhost:3001/api/recording/stop', { headers: await authHeader(page) });
      if (!stopResp.ok()) console.log(`Could not stop recording: POST /api/recording/stop returned ${stopResp.status()}`);
    } catch (err) {
      console.log(`Could not stop recording: ${err instanceof Error ? err.message : String(err)}`);
    }
    // The real recording file lives at the real project root
    // (backend/src/recording.ts's own join(__dirname, '../../', ...)
    // - this file's own __dirname is backend/scripts, the same, real
    // two-levels-up distance), in the exact, same, plain data-file
    // format loadSteps() already reads - so it is read back with the
    // exact, same parser, never a separate one.
    const recordingPath = join(__dirname, '../../', `${recordingUsername}.recording`);
    if (existsSync(recordingPath)) {
      const actualRows = loadSteps(recordingPath);
      console.log(`\n=== Recording verification (${recordedExpectations.length} expected real UI action(s), ${actualRows.length} real recorded row(s)) ===`);
      const max = Math.max(recordedExpectations.length, actualRows.length);
      let mismatches = 0;
      for (let i = 0; i < max; i++) {
        const expected = recordedExpectations[i];
        const actual = actualRows[i];
        if (!expected) { console.log(`  [${i}] ❌ unexpected extra recorded row: ${actual.screen_name} ${JSON.stringify(actual.values)}`); mismatches++; continue; }
        if (!actual) { console.log(`  [${i}] ❌ missing recorded row for expected ${expected.screen_name} ${JSON.stringify(expected.values)}`); mismatches++; continue; }
        if (actual.screen_name !== expected.screen_name) { console.log(`  [${i}] ❌ screen mismatch: expected ${expected.screen_name}, recorded ${actual.screen_name}`); mismatches++; continue; }
        const valueProblems: string[] = [];
        for (let j = 0; j < expected.values.length; j++) {
          const exp = expected.values[j] ?? '';
          const act = actual.values[j] ?? '';
          if (exp !== act) {
            valueProblems.push(act === ''
              ? `position ${j + 1}: expected "${exp}", recorded blank (either a known, honest gap in REAL_FIELD_SOURCE_OVERRIDES, or a real, confirmed bug - check backend/src/recording.ts directly)`
              : `position ${j + 1}: expected "${exp}", recorded "${act}"`);
          }
        }
        if (valueProblems.length > 0) { console.log(`  [${i}] ⚠️  ${expected.screen_name}: ${valueProblems.join('; ')}`); mismatches++; }
        else console.log(`  [${i}] ✅ ${expected.screen_name}: recorded exactly as expected`);
      }
      console.log(mismatches === 0
        ? `Recording verification: all ${recordedExpectations.length} real UI action(s) independently confirmed by the real backend.`
        : `Recording verification: ${mismatches} of ${max} real UI action(s) did NOT match what the backend actually recorded.`);
    } else {
      console.log(`Recording verification requested but no recording file was found at ${recordingPath}.`);
    }
  }
  if (browser) await browser.close();
  if (timingFile) {
    // A real, direct "what was slow" summary, read back from the same
    // file just written - so a reader sees it without opening a
    // second file, but the file itself stays the one, real source of
    // truth for anything that needs the full, per-step detail.
    const rows = readFileSync(timingFile, 'utf-8').trim().split('\n').slice(1)
      .map((line) => {
        const m = line.match(/^(\d+),"((?:[^"]|"")*)",([a-z-]+),(\d+),(true|false),"((?:[^"]|"")*)"$/);
        if (!m) return null;
        return { index: Number(m[1]), screen_name: m[2].replace(/""/g, '"'), path: m[3], ms: Number(m[4]), ok: m[5] === 'true' };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.ms - a.ms);
    const slowest = rows.slice(0, 10);
    if (slowest.length > 0) {
      console.log(`\nSlowest step(s) (full detail in ${timingFile}):`);
      for (const r of slowest) console.log(`  ${r.ms}ms  #${r.index} ${r.screen_name} (${r.path})${r.ok ? '' : ' [FAILED]'}`);
    }
    console.log(`Per-step timing written to ${timingFile} (${rows.length} row(s)).`);
  }
  console.log(`\nDone - ${allSteps.length} step(s) processed.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
