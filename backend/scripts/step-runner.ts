// The one, unified testing and data-loading tool for this application.
// Full documentation: docs/pm-testing-e2e.md.

import { readFileSync, mkdirSync, existsSync, writeFileSync, appendFileSync } from 'fs';
import { createInterface } from 'readline';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium, type Browser, type Page } from 'playwright';
import { TuiTest } from '@microsoft/tui-test';
import * as db from '../src/db.js';
import { getBalanceSheet } from '../src/db-reports.js';
import { getProfitAndLossByAxis } from '../src/db-matrix-reports.js';
import * as auth from '../src/auth.js';
import { unescapeAscii } from '../../shared-fixtures/csv.js';
import { press, typeAndEnter } from './text-driver-helpers.js';

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
  comment: string; // free-text explanation of this step, from a '#' line preceding it in the data file
}

/** The one, real registry mapping a screen's own api_function name to
 * the real, actual backend function it calls - extend this as
 * further, real screens are added to screens.csv. */
// See docs/pm-testing-e2e.md — "API_REGISTRY — notable, non-obvious mappings"
export const API_REGISTRY: Record<string, (args: Record<string, string>) => unknown> = {
  createBusiness: (a) => {
    const BUSINESS_TYPE_TO_ENTITY_STRUCTURE: Record<string, string> = {
      'Sole Trader': 'sole_trader',
      Partnership: 'partnership',
      'Pty Ltd Company': 'llc',
      'Incorporated Company': 'publicly_traded',
    };
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
  // Matches POST /businesses/:name/bank-accounts (the new-business banking wizard's first step).
  nominateBankAccountSimple: (a) => db.nominateBankAccount(a.businessName as any, a.bankAccountName, a.routingDetail, a.accountNumber, db.asUserId(1)),
  // The wizard's final "Confirm and build Cash at Bank" step; single bank/currency only.
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
  // Division is a Hierarchy value (see Naming Glossary), ensured the same way "Storage"/"Container" are.
  createAndConfigureLocation: (a) => {
    const userId = db.asUserId(1);
    return db.createAndConfigureLocation(a.businessName as any, a.locationName, {
      city: a.city,
      location_type: a.locationType,
      is_billing_address: false,
      bottle_capacity: a.bottleCapacity ? Number(a.bottleCapacity) : null,
      carton_capacity: a.cartonCapacity ? Number(a.cartonCapacity) : null,
      timezone: 'Australia/Adelaide',
    } as any, userId, a.division || undefined, a.division ? 'Division' : undefined);
  },
  createEmployeeAt: (a) => db.createEmployee(a.employeeName, a.locationName, db.asUserId(1)),
  createProviderSimple: (a) => db.createProvider(a.providerName, db.asUserId(1)),
  createCustomerSimple: (a) => db.createCustomer(a.customerName, db.asUserId(1)),
  // One row per HTTP call (/journal/staging, /journal/post) — never one combined row for a multi-line entry.
  stageJournalLine: (a) => {
    db.stageLine({ reference: a.reference, business: a.businessName as any, ledger: a.ledger as any, account: a.account as any, amount_minor: Number(a.amountMinor) });
  },
  postJournalEntrySimple: (a) => {
    const userId = db.asUserId(1);
    db.postJournalEntry(a.reference, a.businessName as any, a.ledger as any, userId);
  },
  // The generic (name, parent) shape, matching POST /entities — shared by several screens (Create Item among them).
  createEntitySimple: (a) => {
    db.createEntityRaw({ name: a.name, parent: a.parent || undefined }, db.asUserId(1));
  },
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
  // Sets cost/pack size against a specific provider — there is no provider-independent item cost mechanism.
  setItemCostAndPackSize: (a) =>
    db.addOrUpdateItemSource({
      itemName: a.itemName,
      vendorName: a.providerName,
      priceMinor: Number(a.unitCostMinor),
      packageQuantity: Number(a.packageQuantity),
      isPreferred: true,
    }),
  // Converts cartons to the item's registered pack size (item_source), then stages and posts the order in one step.
  createPurchaseOrderInCartons: (a) => {
    const userId = db.asUserId(1);
    const business = a.businessName as any;
    const ledger = db.asLedgerName(a.ledger || 'Actual');
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
  // Always to the one real "Cash" provider/customer, matching the real
  // screen — see "Cash Sale and Cash Purchase" in pm-domain-reference.md.
  // `a.ledger` defaults to "Actual" when a row doesn't carry it - every
  // row that now trades after a rollover (the reshaped Chapter 3
  // tutorial's wine-business phase, in "Actual 2027-28") passes it
  // explicitly instead.
  cashPurchaseSimple: (a) => {
    const userId = db.asUserId(1);
    return db.completeCashPurchase({
      business: a.businessName as any,
      ledger: db.asLedgerName(a.ledger || 'Actual'),
      locationName: a.locationName as any,
      vendorName: 'Cash' as any,
      lines: [{ itemName: a.itemName, quantity: Number(a.quantity), unitPriceMinor: Number(a.unitCostMinor), taxMinor: 0 }],
      taxAccount: 'Sales Tax Payable' as any,
      paymentMethod: 'cash',
    }, userId);
  },
  cashSaleSimple: (a) => {
    const userId = db.asUserId(1);
    return db.completePosSale({
      business: a.businessName as any,
      ledger: db.asLedgerName(a.ledger || 'Actual'),
      locationName: a.locationName as any,
      customerName: 'Cash' as any,
      lines: [{ itemName: a.itemName, quantity: Number(a.quantity), unitPriceMinor: Number(a.unitPriceMinor), taxMinor: 0 }],
      taxAccount: 'Sales Tax Payable' as any,
      paymentMethod: 'cash',
    }, userId);
  },
  transferItemsSimple: (a) => {
    const userId = db.asUserId(1);
    db.transferItems(a.businessName as any, db.asLedgerName(a.ledger || 'Actual'), a.itemName as any, a.fromLocationName as any, a.toLocationName as any, Number(a.quantity), `TRANSFER-${a.itemName}-${Date.now()}`, userId);
  },
  posSaleSimple: (a) => {
    const userId = db.asUserId(1);
    return db.completePosSale({
      business: a.businessName as any,
      ledger: db.asLedgerName(a.ledger || 'Actual'),
      locationName: a.locationName as any,
      customerName: 'Cash' as any,
      lines: [{ itemName: a.itemName, quantity: Number(a.quantity), unitPriceMinor: Number(a.unitPriceMinor), taxMinor: 0 }],
      taxAccount: 'Sales Tax Payable' as any,
      paymentMethod: 'cash',
    }, userId);
  },
  createItemAndCategory: (a) => {
    const userId = db.asUserId(1);
    const categoryName = a.category === '+ New category…' ? a.newCategoryName : a.category;
    db.createItem(a.itemName, 'Items', userId, a.businessName as any);
    db.setHierarchyParent(a.itemName, 'Category', categoryName, userId);
  },
  // Mirrors items/+page.svelte's addUncategorizedItem — an item directly under the business's
  // Items root, with no category at all. Uses the real, canonical db.createItem (which also
  // creates the item table row via setItem, unlike createItemAndCategory above, a pre-existing,
  // separate function this one deliberately does not touch). See docs/pm-frontend-reference.md.
  createUncategorizedItem: (a) => {
    const userId = db.asUserId(1);
    db.createItem(a.itemName, 'Items', userId, a.businessName as any);
  },
  // A real, top-level category on its own - items/+page.svelte's current tree UI has no combined
  // "new category + item in it" action any more (that belonged to the old dropdown form); creating
  // a brand-new category is now its own real, separate step (the "+ Category" / Insert-with-
  // nothing-selected path), done before an item can be added under it. See
  // docs/pm-frontend-reference.md.
  createCategorySimple: (a) => {
    const userId = db.asUserId(1);
    db.ensureHierarchyGrouping(a.businessName as any, 'Category', userId);
    db.ensureHierarchyValue(a.businessName as any, 'Category', a.categoryName, userId);
  },
  // An item tagged into an EXISTING category (created via createCategorySimple above, or already
  // present) - the real browser path selects that category's own tree node by name (the category
  // argument only drives the browser's open_selector per screen, hardcoded per fixture screen
  // name, since open_selector itself can't be templated - see docs/pm-testing-e2e.md), then
  // presses Insert. Category is a real, optional Hierarchy tag here - the same, generic
  // setHierarchyParent mechanism Division already uses - never a real tree position.
  createItemUnderCategory: (a) => {
    const userId = db.asUserId(1);
    db.createItem(a.itemName, 'Items', userId, a.businessName as any);
    db.setHierarchyParent(a.itemName, 'Category', a.category, userId);
  },
  // An already-existing item tagged into a hierarchy grouping that isn't
  // Category/Division - the exact, same, generic setHierarchyParent
  // mechanism those two already use, just under whatever groupingName
  // this call names (e.g. "Size", "Packaging" - not "Container", which
  // already names a different, real, existing grouping, Open
  // Container's own Carton/Bottle unit-of-measure form, below). This
  // fixture's own Create Hierarchy Grouping/Create Hierarchy Value steps already run
  // through the real /setup/hierarchy screen on both paths; this one
  // tagging action, API-path only for now (data-kind in screens.csv,
  // the same, documented exception the ledger-creation-at-rollover step
  // already uses) - no dedicated UI control exists yet for tagging an
  // existing item into an arbitrary hierarchy value after creation
  // (Category is only ever set inline at item-creation time; Division
  // tagging has its own, Location-specific "Move..." action in the
  // Business Structure popup). See docs/sales-item-cartesian-product.md.
  tagItemHierarchy: (a) => {
    const userId = db.asUserId(1);
    db.ensureHierarchyGrouping(a.businessName as any, a.groupingName, userId);
    db.ensureHierarchyValue(a.businessName as any, a.groupingName, a.valueName, userId);
    db.setHierarchyParent(a.itemName, a.groupingName, a.valueName, userId);
  },
  // Idempotent precondition for receiveStockWithCombination/openContainer below, which otherwise create these lazily.
  createHierarchyGroupingSimple: (a) => {
    const userId = db.asUserId(1);
    db.ensureHierarchyGrouping(a.businessName as any, a.groupingName, userId);
  },
  createHierarchyValueSimple: (a) => {
    const userId = db.asUserId(1);
    db.ensureHierarchyValue(a.businessName as any, a.groupingName, a.valueName, userId);
  },
  // Business Structure popup (frontend/src/lib/components/BusinessStructurePopup.svelte)
  // "+ New Division" — one click, two backend calls: the Division
  // grouping itself is ensured idempotently (it may not exist yet, as
  // in the reshaped tutorial's first expansion), then the new value.
  addDivisionViaStructurePopup: (a) => {
    const userId = db.asUserId(1);
    db.ensureHierarchyGrouping(a.businessName as any, 'Division', userId);
    db.ensureHierarchyValue(a.businessName as any, 'Division', a.valueName, userId);
  },
  // Business Structure popup's "Move…" action on a Location node —
  // always against the Division grouping (the only hierarchy the
  // Locations & Divisions tab tags), matching the popup's own
  // hardcoded DIVISION constant.
  setHierarchyTagSimple: (a) => {
    const userId = db.asUserId(1);
    db.setHierarchyParent(a.locationName, 'Division', a.division, userId);
  },
  // Business Structure popup's Hierarchies tab, "+ New top-level category" -
  // registers the Category grouping/value exactly like any other
  // business-defined Hierarchy (Division included), never a real tree position.
  addTopLevelCategoryViaStructurePopup: (a) => {
    const userId = db.asUserId(1);
    db.ensureHierarchyGrouping(a.businessName as any, 'Category', userId);
    db.ensureHierarchyValue(a.businessName as any, 'Category', a.categoryName, userId);
  },
  // Business Structure popup's Org Chart tab, "+ New Department" — one
  // click, the same db.createAndConfigureDepartment the dedicated route
  // calls, provisioning the Payroll/Other Expenses leaves alongside.
  addDepartmentViaStructurePopup: (a) => {
    const userId = db.asUserId(1);
    db.createAndConfigureDepartment(a.businessName as any, a.departmentName, userId);
  },
  // An Employee box's own "Move…" action in the Org Chart tab means
  // "change Department" (never Division, which only applies to Location
  // boxes) — setEntityLink-based, independent of Place of Employment.
  assignEmployeeDepartmentViaStructurePopup: (a) => {
    const userId = db.asUserId(1);
    db.setEmployeeDepartment(a.employeeName, a.departmentName, userId);
  },
  // The Org Chart tab's Employee-only "Reports to…" action.
  setEmployeeManagerViaStructurePopup: (a) => {
    const userId = db.asUserId(1);
    db.setEmployeeManager(a.employeeName, a.managerName, userId);
  },
  // Business Structure popup's Org Chart tab Delete key on a selected
  // Department box — cascades to its two provisioned leaves, same as the
  // dedicated DELETE /departments/:name route.
  deleteDepartmentViaStructurePopup: (a) => {
    const userId = db.asUserId(1);
    db.deleteDepartment(a.businessName as any, a.departmentName, userId);
  },
  receiveStockWithCombination: (a) => {
    const userId = db.asUserId(1);
    db.ensureHierarchyGrouping(a.businessName as any, a.groupingName, userId);
    db.ensureHierarchyValue(a.businessName as any, a.groupingName, a.storageValue, userId);
    db.defineProductShape(a.businessName as any, [[a.groupingName, a.groupingName]], userId);
    db.receiveItems(
      a.businessName as any, db.asLedgerName(a.ledger || 'Actual'), `RECEIVE-${a.itemName}-${a.storageValue}`,
      a.itemName as any, a.locationName as any, Number(a.quantity), userId, undefined,
      [a.storageValue], [[a.groupingName, a.groupingName]]
    );
  },
  // Opening a carton is two independent space movements, not a "conversion"; scoped to one location.
  openContainer: (a) => {
    const userId = db.asUserId(1);
    db.ensureHierarchyGrouping(a.businessName as any, 'Container', userId);
    db.ensureHierarchyValue(a.businessName as any, 'Container', a.containerValue, userId);
    db.ensureHierarchyValue(a.businessName as any, 'Container', a.unitValue, userId);
    db.defineProductShape(a.businessName as any, [['Container', 'Container']], userId);
    db.openStorageContainer(
      a.businessName as any, db.asLedgerName(a.ledger || 'Actual'), a.locationName as any, a.itemName as any, [['Container', 'Container']],
      [a.containerValue], Number(a.cartonsOpened), [a.unitValue], Number(a.unitsProduced), userId,
      `STORAGE-OPEN-${a.locationName}`
    );
  },
  closeBooksSimple: (a) => {
    const userId = db.asUserId(1);
    return db.closeBooks(a.businessName as any, a.ledger as any, a.asOfDate, a.retainedEarningsAccount as any, userId);
  },
  createLedgerSimple: (a) => {
    const userId = db.asUserId(1);
    db.createLedger(a.businessName as any, a.ledger as any, userId);
  },
  rolloverToNewPeriodSimple: (a) => {
    const userId = db.asUserId(1);
    return db.rolloverToNewPeriod(a.businessName as any, a.oldLedger as any, a.newLedger as any, a.asOfDate, userId);
  },
  // Separate from posSaleSimple (which hardcodes ledger 'Actual'): needed to post into the NEW ledger after rollover.
  posSaleInLedgerSimple: (a) => {
    const userId = db.asUserId(1);
    return db.completePosSale({
      business: a.businessName as any,
      ledger: db.asLedgerName(a.ledger),
      locationName: a.locationName as any,
      customerName: 'Cash' as any,
      lines: [{ itemName: a.itemName, quantity: Number(a.quantity), unitPriceMinor: Number(a.unitPriceMinor), taxMinor: 0 }],
      taxAccount: 'Sales Tax Payable' as any,
      paymentMethod: 'cash',
    }, userId);
  },
  // api_function only — the role grid (/setup/users) is a dynamic checkbox column, not stable positional fields.
  createUserSimple: (a) => {
    auth.createUser(a.username, a.password, (a.roles || '').split(',').map((r) => r.trim()).filter(Boolean));
  },
  setUserRolesSimple: (a) => {
    const user = auth.listUsers().find((u) => u.username === a.username);
    if (!user) throw new Error(`No such user "${a.username}" - Create User must run first.`);
    auth.setUserRoles(user.id, (a.roles || '').split(',').map((r) => r.trim()).filter(Boolean));
  },
  // Assumes the concept entity already exists — a structural entity, or a Vocabulary word created first.
  setTranslationSimple: (a) => {
    db.setTranslation(a.concept, a.language, a.translationText, db.asUserId(1));
  },
};

// See docs/pm-testing-e2e.md — "Structural verification, not golden figures"
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
  // posts is suffixed. `${reference}-PLACE-VALUE` always posts,
  // regardless of whether the order has a real item; `${reference}-
  // PLACE` (quantity, on the order's own synthetic Qty account) only
  // posts when there's no item, and `${reference}-PLACE-ONORDER`
  // (quantity, on the item's own real On Order account instead) only
  // when there is one - an ordinary tutorial Purchase Order always
  // names a real item, so `-PLACE` itself never posts here. Matching
  // on `-PLACE-VALUE`, the one suffix every placeOrder call posts
  // unconditionally, confirmed directly via a live query against the
  // real `journal` table after a real, UI-driven Purchase Order.
  purchase_order_posted: (a) => db.listJournalEntries(a.businessName as any, db.asLedgerName(a.ledger || 'Actual'), 500, 0).some((j) => j.reference === `${a.reference}-PLACE-VALUE`),
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
  // Pairs with /reports/balance-sheet's own screenshot steps below — the real, missing report
  // screenshot the user flagged. See docs/pm-testing-e2e.md.
  balance_sheet_balanced: (a) => {
    const bs = getBalanceSheet(a.businessName as any, db.asLedgerName(a.ledger), a.asOfDate || undefined);
    return bs.balanced && bs.total_assets_minor > 0;
  },
  record_trial_balance_total: (a) => {
    const tb = db.getTrialBalance(a.businessName as any, db.asLedgerName(a.ledger), a.asOfDate || undefined);
    recordedTrialBalanceTotals.set(tbKey(a), tb.total_debit_minor);
    return true;
  },
  trial_balance_total_matches_recorded: (a) => {
    const tb = db.getTrialBalance(a.businessName as any, db.asLedgerName(a.ledger), a.asOfDate || undefined);
    const recorded = recordedTrialBalanceTotals.get(tbKey(a));
    return recorded !== undefined && recorded === tb.total_debit_minor;
  },
  profit_and_loss_positive: (a) => {
    const pl = db.getProfitAndLoss(a.businessName as any, db.asLedgerName(a.ledger), a.fromDate || undefined, a.toDate || undefined);
    return pl.net_income_minor > 0;
  },
  profit_and_loss_zero: (a) => {
    const pl = db.getProfitAndLoss(a.businessName as any, db.asLedgerName(a.ledger), a.fromDate || undefined, a.toDate || undefined);
    return pl.net_income_minor === 0 && pl.total_income_minor === 0;
  },
  record_profit_and_loss_net_income: (a) => {
    const pl = db.getProfitAndLoss(a.businessName as any, db.asLedgerName(a.ledger), a.fromDate || undefined, a.toDate || undefined);
    recordedNetIncome.set(plKey(a), pl.net_income_minor);
    return true;
  },
  profit_and_loss_net_income_matches_recorded: (a) => {
    const pl = db.getProfitAndLoss(a.businessName as any, db.asLedgerName(a.ledger), a.fromDate || undefined, a.toDate || undefined);
    const recorded = recordedNetIncome.get(plKey(a));
    return recorded !== undefined && recorded === pl.net_income_minor;
  },
  // The simplest possible two-axis breakdown: a single item, in a
  // single location, with zero hierarchy configured at all (the Ice
  // stall - see docs/pm-domain-reference.md's "the application should
  // work fine with a single item in a single location"). Item axis
  // against Consolidated must still resolve the one real item to its
  // own, real, positive-net-income outer node - and summing every
  // outer node this axis finds (Ice's own node, plus Rent's, the
  // business's one other real account by this point) must reconcile
  // exactly to the business's one, real, ordinary getProfitAndLoss
  // total - proving the generic axis-resolution path needs no Category
  // or Division to be configured to work, or to reconcile, at all.
  profit_and_loss_by_item_single_row: (a) => {
    const nodes = getProfitAndLossByAxis(a.businessName as any, db.asLedgerName(a.ledger), a.fromDate || undefined, a.toDate || undefined, 'Item', 'Consolidated');
    const pl = db.getProfitAndLoss(a.businessName as any, db.asLedgerName(a.ledger), a.fromDate || undefined, a.toDate || undefined);
    const itemNode = nodes.find((n) => n.key === a.itemName);
    const summed = nodes.reduce((sum, n) => sum + n.profitAndLoss.net_income_minor, 0);
    return !!itemNode && itemNode.profitAndLoss.net_income_minor > 0 && summed === pl.net_income_minor;
  },
  // Detailed: once a real category and a real item exist (Beer, tagged
  // onto Amber Ale) and have real, posted Sales/COGS activity, a
  // Category-outer/Item-inner breakdown must resolve the item under
  // the category it was tagged into - via getHierarchyParent's own
  // generic lookup, not any structural, Category-specific walk (see
  // "Hierarchies and multi-dimensional reporting" in
  // docs/pm-domain-reference.md). Scoped to Beer/Amber Ale specifically
  // - Highland Single Malt (tagged Whiskey) is only ever received into
  // storage in this tutorial, never sold, so it posts no real
  // Sales/COGS leaf for any axis to resolve at all.
  profit_and_loss_by_category_detailed: (a) => {
    const nodes = getProfitAndLossByAxis(a.businessName as any, db.asLedgerName(a.ledger), a.fromDate || undefined, a.toDate || undefined, 'Category', 'Item');
    const categoryNode = nodes.find((n) => n.key === a.categoryName);
    return !!categoryNode && categoryNode.children.some((c) => c.key === a.itemName);
  },
  // Full, summary/consolidated: a Division-outer/Consolidated-inner
  // breakdown across the whole, by-now multi-location wine retailer
  // must still reconcile exactly to the one, real, ordinary
  // getProfitAndLoss total - no matter which real hierarchy a report
  // slices by, the sum across every real outer group is always the
  // same, real, whole-business net income. Every real location this
  // tutorial creates ends up tagged into the one real "Adelaide Metro"
  // division, so this also confirms that division's own outer node
  // alone accounts for the business's entire real net income.
  profit_and_loss_by_division_consolidated: (a) => {
    const nodes = getProfitAndLossByAxis(a.businessName as any, db.asLedgerName(a.ledger), a.fromDate || undefined, a.toDate || undefined, 'Division', 'Consolidated');
    const pl = db.getProfitAndLoss(a.businessName as any, db.asLedgerName(a.ledger), a.fromDate || undefined, a.toDate || undefined);
    const divisionNode = nodes.find((n) => n.key === a.divisionName);
    const summed = nodes.reduce((sum, n) => sum + n.profitAndLoss.net_income_minor, 0);
    return !!divisionNode && divisionNode.profitAndLoss.net_income_minor === pl.net_income_minor && summed === pl.net_income_minor;
  },
  user_has_exact_roles: (a) => {
    const user = auth.listUsers().find((u) => u.username === a.username);
    if (!user) return false;
    const expected = [...(a.roles || '').split(',').map((r) => r.trim()).filter(Boolean)].sort();
    const actual = [...user.roles].sort();
    return expected.length === actual.length && expected.every((r, i) => r === actual[i]);
  },
  translation_matches: (a) => db.getTranslation(a.concept, a.language) === a.translationText,
  entity_named_exists: (a) => db.getEntityTree().some((e) => e.name === a.name),
  // Confirms a Business Structure popup "Move…" action genuinely
  // re-tagged the location's Division membership - the same
  // getHierarchyParent read the popup itself uses to render its tree.
  location_in_hierarchy_group: (a) => db.getHierarchyParent(a.locationName, 'Division') === a.division,
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

// '#'-prefixed lines in the data file (docs/pm-testing-e2e.md) — never a data row.
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

/** Loads the screen registry, grouping each screen's fields by position. */
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

/** Loads a positional data file (docs/pm-testing-e2e.md) plus its
 * optional sibling .control.csv (verify/screenshot/skip). */
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

// {{fieldName}} templating — see docs/pm-testing-e2e.md "Field types and action sequences".
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

/** Integrity checks on a data file and its referenced screens. */
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
    if (screen.submit_selector && !screen.api_function && screen.screen_kind === 'data') {
      problems.push(`Row ${s.index}: screen "${s.screen_name}" has a real submit_selector but no real api_function - running this step via --path api would silently do nothing at all.`);
    }
    if (s.verify && !VERIFY_REGISTRY[s.verify]) problems.push(`Row ${s.index}: verify "${s.verify}" has no real VERIFY_REGISTRY entry.`);
  }
  return problems;
}

/** Human-readable printing of every step (--pretty). */
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

// Reads the logged-in session's bearer token from sessionStorage ('sql-ledger-ts-auth',
// frontend/src/lib/state.svelte.ts) — a raw page.request call is not cookie-authenticated.
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

// Shared by open_selector/submit_selector — see docs/pm-testing-e2e.md "Field types and action sequences".
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
    } else if (action.startsWith('maybe-click:')) {
      // Clicks only if the element is genuinely there within a short, real wait - never fails the
      // step when it isn't. For a screen reused across several, real, same-page steps in a row
      // (e.g. POS Sale, run twice per shared-fixtures/tutorial-steps.csv) where an earlier run's
      // own real, live UI state (here: /pos's own post-sale receipt view replacing the register
      // form until "New sale" is clicked) would otherwise block every later run's own real fields.
      const selector = action.slice('maybe-click:'.length);
      const locator = page.locator(selector);
      if (await locator.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await locator.first().click();
      }
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
    // See docs/pm-testing-e2e.md — "runStepViaUi fails loudly when a screen has no UI wiring"
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
      // A real, confirmed race, found wiring the New New P&L screen's
      // two axis <select>s: page.goto() resolves once the document has
      // loaded, which can be before SvelteKit has finished hydrating -
      // a selectOption() landing in that window sets the DOM value and
      // fires a native 'change' event into a page that isn't listening
      // yet, so the reactive state it should have driven (here,
      // allowedOuterAxes/allowedInnerAxes, each sourced from an onMount
      // fetch) never updates, and a later field's own selectOption call
      // times out hunting for an <option> that a fully-hydrated page
      // would already have rendered. Every "data" screen already waits
      // for networkidle once, right before its own screenshot, for the
      // same underlying reason (see below) - doing it here too, before
      // any field is ever touched, is the same fix applied where the
      // race actually first bites.
      await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
      console.log(`  [load] goto ${screen.ui_path}: ${Date.now() - navStart}ms`);
    }
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
        const resolvedSelector = resolveSelectorTemplate(field.field_selector, args);
        if (field.field_type === 'signed_money') {
          const [debitSelector, creditSelector] = resolvedSelector.split('|');
          const minorUnits = Number(value);
          if (minorUnits === 0) continue;
          const targetSelector = minorUnits > 0 ? debitSelector : creditSelector;
          await page.locator(targetSelector).fill((Math.abs(minorUnits) / 100).toFixed(2));
          await page.waitForTimeout(200);
          continue;
        }
        if (field.field_type === 'check_by_text') {
          const container = page.locator(resolvedSelector);
          for (const name of value.split(',').map((n) => n.trim()).filter(Boolean)) {
            await container.locator('label', { hasText: name }).locator('input[type=checkbox]').check();
            await page.waitForTimeout(200);
          }
          continue;
        }
        if (field.field_type === 'search_and_select') {
          const [searchSelector, itemSelector] = resolvedSelector.split('|');
          await page.locator(searchSelector).fill(value);
          await page.waitForTimeout(300);
          const exact = new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
          await page.locator(itemSelector).filter({ hasText: exact }).first().click();
          await page.waitForTimeout(200);
          continue;
        }
        const locator = page.locator(resolvedSelector);
        if (field.field_type === 'select') await locator.selectOption({ label: value });
        else if (field.field_type === 'select_value') await locator.selectOption({ value });
        else if (field.field_type === 'check') await (value === 'true' ? locator.check() : locator.uncheck());
        else if (field.field_type === 'money') await locator.fill((Number(value) / 100).toFixed(2));
        else if (field.field_type === 'text_enter') {
          await locator.fill(value);
          await locator.press('Enter');
        } else await locator.fill(value);
        await page.waitForTimeout(200);
      }
      if (screen.submit_selector) {
        const resolvedSubmitSelector = resolveSelectorTemplate(screen.submit_selector, args);
        for (const action of resolvedSubmitSelector.split(';;').map((a) => a.trim()).filter(Boolean)) {
          if (action.startsWith('key:')) await page.keyboard.press(action.slice(4));
          else await page.locator(action).click();
          // 2000ms margin after submit click, so the POST completes before the next verify reads the DB.
          await page.waitForTimeout(2000);
        }
      }
    }
    if (step.screenshot) {
      // Report screens (screen_kind 'data' with no submit_selector) fetch and render
      // reactively after the last field change rather than on a button click, so the
      // 200ms per-field margin above isn't enough: a screenshot taken right after filling
      // the last field can catch the page's own bootstrap/loading splash instead of the
      // real report. See docs/pm-testing-e2e.md - "Profit and Loss / Balance Sheet
      // after-close screenshots captured the loading spinner, not the report".
      if (!screen?.submit_selector) {
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      }
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

/** The real, per-screen keystroke driver registry for `--path text` —
 * the same, real role API_REGISTRY plays for `--path api` and
 * field_selector/open_selector/submit_selector play for `--path ui`,
 * but TUI screens are step machines (SelectInput pickers, line-item
 * Insert/Delete/Save sub-loops, blank-means-default conventions), not
 * flat, column-driven forms — so each entry here is real, hand-written
 * code, not a generic selector template. Keyed by the exact, real
 * screen_name a row in screens.csv/tutorial-steps.csv names — see
 * docs/pm-testing-e2e.md and docs/tui-design.md.
 *
 * Deliberately small today: only the screens actually proven live (see
 * tutorial-steps.control.csv's own `text` column) have a real entry
 * here. Every other screen_name fails loudly via runStepViaText below,
 * the same, real way runStepViaUi already fails loudly for a
 * screen.csv row with no real UI wiring at all — never a silent no-op.
 */
export const TEXT_DRIVER_REGISTRY: Record<string, (terminal: TuiTest, args: Record<string, string>) => Promise<void>> = {
  // tui/src/screens/Login.tsx — the one, real screen every `--path text`
  // run starts from; a fresh TuiTest session always opens here first.
  // Waits for the real "Choose a business" screen afterward rather than
  // just returning once the keys are sent - a real, confirmed gap
  // found live: without this wait, the step reported success even with
  // no backend running at all behind it (the login POST simply never
  // resolved, and nothing here was checking for that) - the exact kind
  // of silent false-positive runStepViaUi's own design already refuses
  // to allow.
  Login: async (terminal, args) => {
    await terminal.getByText('Log in').expect();
    await typeAndEnter(terminal, args.username);
    await typeAndEnter(terminal, args.password);
    await terminal.getByText('Choose a business').expect({ timeout: 10_000 });
  },
};

/** Drives one real, already-open TUI session via @microsoft/tui-test —
 * the same, real role runStepViaUi plays for a real, driven browser,
 * never importing tui/src TypeScript directly (see docs/tui-design.md,
 * "--path text"). */
export async function runStepViaText(terminal: TuiTest, step: Step, screens: Map<string, Screen>): Promise<{ ok: boolean; error?: string }> {
  try {
    const screen = screens.get(step.screen_name);
    const args = buildArgs(step, screen);
    const driver = TEXT_DRIVER_REGISTRY[step.screen_name];
    if (!driver) {
      return {
        ok: false,
        error: `No real TEXT_DRIVER_REGISTRY entry for screen "${step.screen_name}" - this screen's TUI driver has never actually been implemented/proven. See tutorial-steps.control.csv's "text" column and docs/tui-design.md.`,
      };
    }
    await driver(terminal, args);
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
    console.error('Usage: step-runner <data.csv> [--screens screens.csv] [--lint] [--pretty] [--path api|ui|text] [--steps N] [--only N] [--skip N] [--non-interactive] [--delay MS] [--ui] [--screenshot-dir DIR] [--verify NAME] [--screenshot NAME] [--fallback-to-api] [--verify-via-recording] [--timing-file FILE]');
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
  const screenshotDir = args.includes('--screenshot-dir') ? args[args.indexOf('--screenshot-dir') + 1] : '../docs/manual-images-tutorial';
  const inlineVerify = args.includes('--verify') ? args[args.indexOf('--verify') + 1] : undefined;
  const inlineScreenshot = args.includes('--screenshot') ? args[args.indexOf('--screenshot') + 1] : undefined;
  const fallbackToApi = args.includes('--fallback-to-api');
  const verifyViaRecording = args.includes('--verify-via-recording');
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
      // Logs measured backend wait time (responseEnd - requestStart) per network call.
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

  // A persistent TuiTest session, parallel to how `ui` reuses one
  // Playwright `page` across steps — one real, long-lived TUI process,
  // driven step by step, rather than a fresh process per row. Runs the
  // real tui/src/cli.tsx (npx tsx), never importing its TypeScript
  // source directly - the exact, same "drive a real, separately-
  // running process" rule `ui` already follows for the browser
  // frontend. See docs/tui-design.md - "--path text".
  let textTerminal: TuiTest | undefined;
  async function ensureTextTerminal(): Promise<TuiTest> {
    if (!textTerminal) {
      textTerminal = TuiTest.ephemeral('step-runner-text');
      await textTerminal.run('npx', ['tsx', 'src/cli.tsx'], {
        cwd: join(__dirname, '../../tui'),
        cols: 100,
        rows: 40,
        timeouts: { text: 10_000 } as any,
      });
    }
    return textTerminal;
  }
  if (path === 'text') await ensureTextTerminal();

  // --verify-via-recording state — see docs/pm-testing-e2e.md "The Admin recording feature".
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
      let result = stepPath === 'ui'
        ? await runStepViaUi(await ensureUiPage(), step, screens, screenshotDir)
        : stepPath === 'text'
          ? await runStepViaText(await ensureTextTerminal(), step, screens)
          : runStepViaApi(step, screens);
      const stepMs = Date.now() - stepStart;
      recordTiming(step.index, step.screen_name, stepPath, stepMs, result.ok, result.ok ? undefined : result.error);
      const uiSucceededDirectly = stepPath === 'ui' && result.ok;
      console.log(result.ok ? `✅ ${step.index}: ${step.screen_name} (${stepPath}) [${stepMs}ms]` : `❌ ${step.index}: ${step.screen_name} (${stepPath}): ${result.error} [${stepMs}ms]`);
      if (verifyViaRecording && uiSucceededDirectly) {
        if (step.screen_name === 'Login' && !recordingStarted) {
          try {
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
    // Recording file lives at the project root (backend/src/recording.ts); read back via loadSteps.
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
  if (textTerminal) await textTerminal.close();
  if (timingFile) {
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
