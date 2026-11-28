// The one, unified testing and data-loading tool for this application.
// Full documentation: docs/pm-testing-e2e.md.

import { readFileSync, mkdirSync, existsSync, writeFileSync, appendFileSync } from 'fs';
import { createInterface } from 'readline';
import { join, dirname, relative, resolve } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { chromium, type Browser, type Page } from 'playwright';
import { TuiTest } from '@microsoft/tui-test';
import * as db from '../src/db.js';
import { getBalanceSheet } from '../src/db-reports.js';
import { getProfitAndLossByAxis } from '../src/db-matrix-reports.js';
import * as auth from '../src/auth.js';
import { unescapeAscii } from '../../shared-fixtures/csv.js';
import { press, typeAndEnter, findItemByText, openScreenGenerically } from './text-driver-helpers.js';
import { CoreApiClient, runStepViaFrontendApi } from './core-api-client.js';
import { resetCore } from '../src/core/api.js';

// Which middleware serves the API path. With `MIDDLEWARE=core` every step
// goes through the core middleware's frontend API (src/core/api.ts,
// docs/pm-core-middleware.md): one request of its plain-text protocol per
// step, as a frontend would send it, and each check made from what the
// API returns. Otherwise the original db.ts functions are called directly
// through the registries below. The fixtures and screens.csv are the same
// for both.
export const USE_CORE = process.env.MIDDLEWARE === 'core';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ScreenField {
  position: number;
  field_name: string;
  field_selector: string;
  field_type: string;
}

export interface Screen {
  screen_name: string;
  screen_kind: string; // 'session' | 'data' (default) | 'api' (no browser form: runs through the API on every path) | 'ui' (a browser gesture or check)
  ui_path: string;
  open_selector: string;
  api_function: string;
  submit_selector: string;
  fields: ScreenField[];
}

export interface Step {
  index: number; // 1-indexed, real step number (excluding blank lines)
  file_line: number; // the line number in the data file the step came from
  file?: string; // the data file the step came from (an included file, or the test itself)
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
  createAndConfigureLocation: (a) => {
    const userId = db.asUserId(1);
    return db.createAndConfigureLocation(a.businessName as any, a.locationName, {
      city: a.city,
      location_type: a.locationType,
      is_billing_address: false,
      bottle_capacity: a.bottleCapacity ? Number(a.bottleCapacity) : null,
      carton_capacity: a.cartonCapacity ? Number(a.cartonCapacity) : null,
      timezone: 'Australia/Adelaide',
    } as any, userId);
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
  // Manufacturing tutorial (Stage 6): mirrors items/+page.svelte's real
  // Bill of Materials card's addBomComponent() handler exactly — one
  // real Material-only component line, staged then immediately posted
  // (the same two real backend calls call-dispatch/items.ts's own
  // setBomComponent dispatch entry makes). kind/durationHours/
  // scheduledStart/scheduledEnd/priceMinor are all deliberately left
  // undefined here — proving the widened, Stage-1 BOM mechanism still
  // works exactly as it always did for a Material-only caller.
  // Manufacturing tutorial (Stage 6): provisions a real, properly
  // classified Inventory (Asset) account for an item - db.ts's own
  // ensureItemInventoryAccount, the exact, real mechanism POS/Purchase-
  // Order flows already use before their first real $ posting against
  // an item. Done once, right after the item is created, before any
  // Stage Journal Line against it - a real, confirmed gap found live:
  // posting a journal line to a bare item name BEFORE this call still
  // succeeds (the name resolves to the item entity itself), but that
  // entity was never parented under the business's own CoA "Inventory"
  // node, so it posts a real, balanced journal entry that the Balance
  // Sheet's own Asset walk never finds - trial balance balances, but
  // assets stop reconciling to liabilities+equity. Calling this first
  // avoids ever creating a second, duplicate, differently-parented
  // entity of the same name later.
  ensureItemInventoryAccountSimple: (a) => {
    db.ensureItemInventoryAccount(a.itemName as any, db.asUserId(1), undefined, a.businessName as any);
  },
  setBomComponentSimple: (a) => {
    const userId = db.asUserId(1);
    db.stageBomComponent({
      assemblyItem: a.assemblyItem,
      business: a.businessName,
      componentItem: a.componentItem,
      quantity: Number(a.quantity),
      unit: a.unit,
    });
    db.postBomComponents(a.assemblyItem, a.businessName as any, userId);
  },
  // Quantity only, one movement per row (db-stock.ts's receiveItems/
  // dispatchItems); the value is its own Stage/Post Journal Line step in
  // the manufacturing tutorial, which models assembly as a dispatch of
  // the components plus a receipt of the finished item.
  receiveStockQuantitySimple: (a) => {
    const userId = db.asUserId(1);
    db.receiveItems(a.businessName as any, a.ledger as any, a.reference, a.itemName as any, a.locationName as any, Number(a.quantity), userId, a.transdate || undefined);
  },
  dispatchStockQuantitySimple: (a) => {
    const userId = db.asUserId(1);
    db.dispatchItems(a.businessName as any, a.ledger as any, a.reference, a.itemName as any, a.locationName as any, Number(a.quantity), userId, a.transdate || undefined);
  },
  // Project Builder tutorial (Stage 7): Plant and Skill, db.ts's own
  // createPlantItem/ensureSkill/tagSkill — real per-business equipment
  // and a real, global named-skill taxonomy tagged onto a contact with
  // its own pairing-specific rate.
  createPlantItemSimple: (a) => {
    db.createPlantItem(a.name, a.businessName as any, Number(a.hourlyRateMinor), a.ownedOrHired as 'Owned' | 'Hired', db.asUserId(1), a.hireVendor || undefined);
  },
  ensureSkillSimple: (a) => {
    db.ensureSkill(a.skillName, db.asUserId(1));
  },
  tagSkillSimple: (a) => {
    db.tagSkill(a.contactName, a.skillName, Number(a.rateMinorPerHour), db.asUserId(1));
  },
  // Sets a real employee's hourly wage without disturbing any other
  // contact field already on record — db.ts's own setContact replaces
  // the WHOLE contact record, so this reads the real, current one back
  // first (createEmployee's own contact row, or whatever an earlier
  // step already set) and only changes wage_minor_per_hour. Required
  // before clockInToProject, which refuses an employee with no real,
  // configured wage rate.
  setEmployeeSalarySimple: (a) => {
    const existing = db.getContact(a.employeeName) ?? {};
    db.setContact(a.employeeName, { ...existing, salary_minor_per_year: Number(a.salaryMinorPerYear) });
  },
  // A draft sales invoice of one line, dated today, in the Actual ledger;
  // source 'pos' stands for one a POS sale made, so a test needs no stock.
  createSalesInvoiceSimple: (a) => db.createInvoice({
    invoiceType: 'AR',
    business: a.businessName,
    ledger: 'Actual',
    reference: a.reference,
    counterpartyName: a.customerName,
    invoiceDate: new Date().toISOString().slice(0, 10),
    lines: [{ description: a.reference, amountMinor: Number(a.amountMinor) }],
    source: (a.source || 'manual') as 'manual' | 'pos',
  }, db.asUserId(1)),
  // Posts the draft sales invoice with that reference: revenue to Sales
  // Revenue, tax to Sales Tax Payable.
  postSalesInvoiceSimple: (a) => {
    const invoice = db.listInvoices(db.asBusinessName(a.businessName), db.asLedgerName('Actual'), { invoiceType: 'AR', source: 'all' }).find((i) => i.reference === a.reference);
    if (!invoice) throw new Error(`No sales invoice "${a.reference}" in ${a.businessName}.`);
    db.postInvoice(invoice.id, 'Sales Revenue', 'Sales Tax Payable', db.asUserId(1));
  },
  // The stock levels the stock listing's inputs keep for an item at a
  // location; an empty value leaves that level unset.
  setItemLocationLevelsSimple: (a) => {
    const level = (v: string) => (v === '' || v === undefined ? null : Number(v));
    db.setItemLocationLevels(db.asItemName(a.itemName), db.asLocationName(a.locationName), { minLevel: level(a.minLevel), maxLevel: level(a.maxLevel), reorderLevel: level(a.reorderLevel) }, db.asBusinessName(a.businessName), db.asLedgerName('Actual'), db.asUserId(1));
  },
  // A known supplier of an item, at a price, preferred or not (the Items
  // page's sources panel).
  addItemSourceSimple: (a) => db.addOrUpdateItemSource({ itemName: a.itemName, vendorName: a.providerName, priceMinor: Number(a.priceMinor), isPreferred: a.preferred === 'true' }),
  setItemStorageOriginSimple: (a) => db.setItemStorageOrigin(db.asItemName(a.itemName), (a.origin || null) as 'Hot' | 'Cold' | null, db.asUserId(1)),
  setEmployeeWageSimple: (a) => {
    const existing = db.getContact(a.employeeName) ?? {};
    db.setContact(a.employeeName, { ...existing, wage_minor_per_hour: Number(a.wageMinorPerHour) });
  },
  // Project Proposal Prototypes (Stage 4/7) — db-prototypes.ts's own
  // createPrototype/addPrototypeLine, reusing Stage 1's BOM mechanism
  // verbatim, staged under the prototype's own entity.
  createPrototypeSimple: (a) => {
    db.createPrototype(a.prototypeName, a.businessName as any, db.asUserId(1));
  },
  addPrototypeLineSimple: (a) => {
    db.addPrototypeLine(
      a.prototypeName,
      a.businessName as any,
      a.kind as db.BomLineKind,
      a.resourceOrItemName,
      Number(a.quantity),
      a.unit,
      Number(a.priceMinor),
      db.asUserId(1),
      a.durationHours ? Number(a.durationHours) : undefined,
      a.scheduledStart || undefined
    );
  },
  // Copies a prototype's own Recipe lines onto a brand-new Quotation —
  // db-prototypes.ts's own instantiateProjectProposal.
  instantiateProjectProposalSimple: (a) => {
    db.instantiateProjectProposal(
      a.prototypeName,
      a.reference,
      a.client,
      a.businessName as any,
      a.ledger,
      a.headerItem,
      a.transdate,
      db.asUserId(1),
      a.targetCompletionDate || undefined
    );
  },
  // Accepting a multi-line Project Proposal — db-quotations.ts's own
  // acceptQuotation, opted into Stage 3/4/5's project-creation path by
  // passing real projectDetails (never done by any plain, line-less
  // Quotation/RFQ caller, which is unaffected). Creates the real Live
  // Project + Invoicing Milestone + Profit Center, copies every Recipe
  // line onto it, and resolves each real Labour/Plant line's actual
  // schedule via findNextAvailableWindow — flagging (never blocking) a
  // real Schedule Risk if a genuine resource double-booking pushes the
  // resolved completion date past the client's own wanted date.
  acceptProjectProposalSimple: (a) => {
    db.acceptQuotation(a.reference, db.asUserId(1), { projectName: a.projectName, targetCompletionDate: a.targetCompletionDate });
  },
  // Labour/Plant clock-in/out — db-journal.ts's own clockInToProject/
  // clockOutOfProject/clockPlantIn/clockPlantOut, posted directly
  // against a Live Project's own, real Profit-Center-scoped Expense
  // account (provisionProjectProfitCenter, run automatically by
  // acceptProjectProposalSimple above).
  clockInToProjectSimple: (a) => {
    db.clockInToProject(a.employeeName as any, a.projectExpenseAccount as any, a.businessName as any, a.ledger as any, db.asUserId(1));
  },
  clockOutOfProjectSimple: (a) => {
    db.clockOutOfProject(a.employeeName as any, a.businessName as any, a.ledger as any, db.asUserId(1));
  },
  clockPlantInSimple: (a) => {
    db.clockPlantIn(a.plantName, a.projectExpenseAccount as any, a.businessName as any, a.ledger as any, db.asUserId(1));
  },
  clockPlantOutSimple: (a) => {
    db.clockPlantOut(a.plantName, a.businessName as any, a.ledger as any, db.asUserId(1));
  },
  // A bounded, explicit, human-driven revision of a Project Proposal
  // Prototype — db-prototypes.ts's own updatePrototypeLine. Never
  // automatic learning from project profitability, per direct
  // instruction — the tutorial's own narration decides the new
  // duration/price, exactly as a real business owner would.
  updatePrototypeLineSimple: (a) => {
    db.updatePrototypeLine(
      a.prototypeName,
      a.businessName as any,
      a.resourceOrItemName,
      db.asUserId(1),
      a.newDurationHours ? Number(a.newDurationHours) : undefined,
      a.newPriceMinor ? Number(a.newPriceMinor) : undefined
    );
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
  // Mirrors items/+page.svelte's addUncategorizedItem — an item directly under the business's
  // Items root, with no category at all. Uses the real, canonical db.createItem (which also
  // creates the item table row via setItem). See docs/pm-frontend-reference.md.
  createUncategorizedItem: (a) => {
    const userId = db.asUserId(1);
    db.createItem(a.itemName, 'Items', userId, a.businessName as any);
  },
  // The Items catalog: a value added to the item hierarchy the page shows,
  // and an item created in a value of it (docs/pm-domain-reference.md,
  // "Screens choose among the business's hierarchies").
  createItemGroupValue: (a) => {
    const userId = db.asUserId(1);
    db.ensureHierarchyValue(a.businessName as any, a.hierarchyName, a.valueName, userId);
  },
  createItemInGroup: (a) => {
    const userId = db.asUserId(1);
    db.checkHierarchyTag(a.businessName, a.hierarchyName, a.itemName);
    db.createItem(a.itemName, 'Items', userId, a.businessName as any);
    db.setHierarchyParent(a.itemName, a.hierarchyName, a.valueName, userId);
  },
  // An existing item tagged with a value of an item hierarchy (API path
  // only: no screen tags an existing item yet).
  tagItemHierarchy: (a) => {
    const userId = db.asUserId(1);
    db.checkHierarchyTag(a.businessName, a.hierarchyName, a.itemName);
    db.ensureHierarchyValue(a.businessName as any, a.hierarchyName, a.valueName, userId);
    db.setHierarchyParent(a.itemName, a.hierarchyName, a.valueName, userId);
  },
  // A hierarchy of the business's own: groups says what it is of.
  createHierarchySimple: (a) => {
    const userId = db.asUserId(1);
    db.ensureHierarchy(a.businessName as any, a.hierarchyName, userId, a.of as db.HierarchyKind);
  },
  createHierarchyValueSimple: (a) => {
    const userId = db.asUserId(1);
    db.ensureHierarchyValue(a.businessName as any, a.hierarchyName, a.valueName, userId);
  },
  // Business Setup's tree: a value within a value, and a location or a
  // value moved within another value (docs/pm-domain-reference.md,
  // "Values nest to any depth").
  createHierarchyValueWithin: (a) => {
    const userId = db.asUserId(1);
    const value = db.ensureHierarchyValue(a.businessName as any, a.hierarchyName, a.entityName, userId);
    db.checkHierarchyTag(a.businessName, a.hierarchyName, a.entityName, a.valueName);
    db.setHierarchyParent(a.entityName, a.hierarchyName, a.valueName, userId, value.id, db.resolveHierarchyValueId(a.businessName, a.hierarchyName, a.valueName));
  },
  setHierarchyParentSimple: (a) => {
    const userId = db.asUserId(1);
    db.checkHierarchyTag(a.businessName, a.hierarchyName, a.entityName, a.valueName);
    const entityId = db.resolveBusinessLocationId(a.businessName, a.entityName) ?? db.resolveHierarchyValueId(a.businessName, a.hierarchyName, a.entityName);
    db.setHierarchyParent(a.entityName, a.hierarchyName, a.valueName, userId, entityId, db.resolveHierarchyValueId(a.businessName, a.hierarchyName, a.valueName));
  },
  // Hierarchy prototypes (Setup → Hierarchies).
  saveHierarchyPrototypeSimple: (a) => db.saveHierarchyPrototype(a.businessName as any, a.hierarchyName, a.prototypeName, db.asUserId(1)),
  createHierarchyFromPrototypeSimple: (a) => db.createHierarchyFromPrototype(a.businessName as any, a.prototypeName, a.hierarchyName, db.asUserId(1)),
  // Business Structure popup (frontend/src/lib/components/BusinessStructurePopup.svelte):
  // a value added to the location or item hierarchy a step shows, and a
  // location moved to a value of a location hierarchy ("Move…").
  addLocationGroupValueViaStructurePopup: (a) => {
    const userId = db.asUserId(1);
    db.ensureHierarchyValue(a.businessName as any, a.hierarchyName, a.valueName, userId);
  },
  addItemGroupValueViaStructurePopup: (a) => {
    const userId = db.asUserId(1);
    db.ensureHierarchyValue(a.businessName as any, a.hierarchyName, a.valueName, userId);
  },
  setLocationGroup: (a) => {
    const userId = db.asUserId(1);
    db.checkHierarchyTag(a.businessName, a.hierarchyName, a.locationName);
    db.setHierarchyParent(a.locationName, a.hierarchyName, a.valueName, userId);
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
  // Setup -> Chart of Accounts' own real "Rename" fieldset, by name
  // instead of a tree click - the same, real supersedeEntity({name})
  // that screen's own rename() handler calls. data-kind, no real
  // ui_path/selectors wired yet (the same, documented exception Tag
  // Item Hierarchy already uses) - selecting a tree node by name in
  // that page isn't a simple field-fill, so --path ui falls back to
  // this real API call too rather than a half-built browser automation.
  renameEntitySimple: (a) => {
    const userId = db.asUserId(1);
    db.renameEntityByName(a.oldName, a.newName, userId, a.parentName || undefined);
  },
  receiveStockWithCombination: (a) => {
    const userId = db.asUserId(1);
    db.ensureHierarchyValue(a.businessName as any, a.hierarchyName, a.storageValue, userId);
    db.defineProductShape(a.businessName as any, [[a.hierarchyName, a.hierarchyName]], userId);
    db.receiveItems(
      a.businessName as any, db.asLedgerName(a.ledger || 'Actual'), `RECEIVE-${a.itemName}-${a.storageValue}`,
      a.itemName as any, a.locationName as any, Number(a.quantity), userId, undefined,
      [a.storageValue], [[a.hierarchyName, a.hierarchyName]]
    );
  },
  // Opening a carton is two independent space movements, not a "conversion"; scoped to one location.
  openContainer: (a) => {
    const userId = db.asUserId(1);
    const shape: [string, string][] = [[a.hierarchyName, a.hierarchyName]];
    db.ensureHierarchyValue(a.businessName as any, a.hierarchyName, a.containerValue, userId);
    db.ensureHierarchyValue(a.businessName as any, a.hierarchyName, a.unitValue, userId);
    db.defineProductShape(a.businessName as any, shape, userId);
    db.openStorageContainer(
      a.businessName as any, db.asLedgerName(a.ledger || 'Actual'), a.locationName as any, a.itemName as any, shape,
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
  // Manufacturing tutorial (Stage 6): confirms a real, posted assembly's
  // BOM lines genuinely round-tripped through Stage 1's widened
  // stageBomComponent/postBomComponents/getBomComponents, Material-only,
  // exactly as many lines as the tutorial staged.
  bom_components_recorded: (a) => db.getBomComponents(a.assemblyItem).length === Number(a.expectedCount),
  // Manufacturing tutorial (Stage 6): a real, computed invariant check
  // (never a hardcoded golden figure) — no location's real on-hand
  // quantity for any item has gone negative, the basic sanity check a
  // real raw-material-consumed/finished-goods-produced assembly flow
  // must never violate.
  stock_on_hand_nonnegative: (a) => db.getInventoryListingByLocation(a.businessName as any).every((g) => g.rows.every((r) => r.quantity_on_hand >= 0)),
  // Project Builder tutorial (Stage 7): the real, never-blocking warning
  // the whole contention engine exists to raise — set by
  // checkMilestoneAchievability (run automatically inside
  // acceptProjectProposalSimple) only when a real resource
  // double-booking pushed the resolved completion date past the
  // client's own wanted date. Asserts BOTH directions: a project with
  // no real conflict must show no risk, and one with a genuine,
  // engineered double-booking must.
  schedule_risk_absent: (a) => {
    const project = db.getLiveProject(a.projectName);
    return !!project && !project.scheduleRisk;
  },
  schedule_risk_flagged: (a) => {
    const project = db.getLiveProject(a.projectName);
    return !!project && !!project.scheduleRisk;
  },
  // Project Builder tutorial (Stage 7): the real, computed quoted-vs-
  // actual margin (db-projects.ts's own getProjectCostReport, Stage 5) —
  // checked by sign against what the tutorial's own postings are
  // deliberately built to produce, never a hardcoded dollar figure.
  project_margin_sign: (a) => {
    const report = db.getProjectCostReport(a.projectName);
    return a.expectedSign === 'positive' ? report.marginMinor > 0 : report.marginMinor < 0;
  },
  // Project Builder tutorial (Stage 7): confirms updatePrototypeLine's
  // own, explicit, human-driven revision genuinely landed — checked
  // against the exact value the tutorial's own step just asked for, not
  // an unrelated magic number.
  prototype_line_updated: (a) => {
    const line = db.getPrototypeLines(a.prototypeName).find((l) => l.component === a.component);
    return !!line && line.priceMinor === Number(a.expectedPriceMinor);
  },
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
  // The value valueName of the inner hierarchy holds the item itemName.
  profit_and_loss_group_has_item: (a) => {
    const nodes = getProfitAndLossByAxis(a.businessName as any, db.asLedgerName(a.ledger), a.fromDate || undefined, a.toDate || undefined, a.innerAxis, 'Item');
    const group = nodes.find((n) => n.key === a.valueName);
    return !!group && group.children.some((c) => c.key === a.itemName);
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
  profit_and_loss_group_is_whole: (a) => {
    const nodes = getProfitAndLossByAxis(a.businessName as any, db.asLedgerName(a.ledger), a.fromDate || undefined, a.toDate || undefined, a.outerAxis, a.innerAxis);
    const pl = db.getProfitAndLoss(a.businessName as any, db.asLedgerName(a.ledger), a.fromDate || undefined, a.toDate || undefined);
    const group = nodes.find((n) => n.key === a.valueName);
    const summed = nodes.reduce((sum, n) => sum + n.profitAndLoss.net_income_minor, 0);
    return !!group && group.profitAndLoss.net_income_minor === pl.net_income_minor && summed === pl.net_income_minor;
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
  // Confirms a Business Structure popup "Move…" re-tagged the location:
  // the same getHierarchyParent read the popup renders its tree from.
  location_in_hierarchy_group: (a) => db.getHierarchyParent(a.locationName, a.hierarchyName) === a.valueName,
  // A location or a value is within the value valueName of the hierarchy.
  in_hierarchy_value: (a) => db.getHierarchyTree(a.businessName, a.hierarchyName).some((n) => n.name === a.entityName && n.parent === a.valueName),
  hierarchy_prototype_exists: (a) => db.listHierarchyPrototypes().some((p) => p.prototype === a.prototypeName),
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

/** Loads the screen registry, hierarchy each screen's fields by position. */
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
 * optional sibling .control.csv (path/verify/screenshot/skip), row for
 * row, and expands its directives:
 *
 * - `"Include","common/x.csv"` inserts every step of that file (and its
 *   own control file), resolved relative to the including file. A file
 *   cannot include itself, directly or through another.
 * - `"Set","name","value"` sets a variable for the rows after it,
 *   included files too; `"Default","name","value"` sets it only when it
 *   is not set yet, so a common file can name its own default.
 * - `${name}` in any value, and in a control row, is replaced by the
 *   variable; an unset variable is an error.
 *
 * A directive's own control row is ignored. Steps are numbered 1..n in
 * the order they run. Shared steps live in shared-fixtures/common/. */
export function loadSteps(dataPath: string, vars: Record<string, string> = {}, including: string[] = []): Step[] {
  if (including.includes(dataPath)) throw new Error(`${dataPath} includes itself (through ${including.join(' -> ')}).`);
  const lines = splitDataAndComments(readCsvLines(dataPath));
  const controlPath = dataPath.replace(/\.csv$/, '.control.csv');
  const controlLines = existsSync(controlPath) ? readCsvLines(controlPath).map((l) => l.line) : [];
  const controlRows = controlLines.length > 0 ? controlLines.slice(1).map(parseCsvLine) : [];
  const substitute = (value: string, fileLine: number) =>
    value.replace(/\$\{(\w+)\}/g, (_m, name: string) => {
      if (!(name in vars)) throw new Error(`${dataPath}:${fileLine}: \${${name}} is not set.`);
      return vars[name];
    });

  const out: Step[] = [];
  lines.forEach((entry, i) => {
    const [screen_name, ...rawValues] = parseCsvLine(entry.line);
    const values = rawValues.map((v) => substitute(v, entry.fileLine));
    if (screen_name === 'Include') {
      out.push(...loadSteps(join(dirname(dataPath), values[0]), vars, [...including, dataPath]));
      return;
    }
    if (screen_name === 'Set') { vars[values[0]] = values[1] ?? ''; return; }
    if (screen_name === 'Default') { if (!(values[0] in vars)) vars[values[0]] = values[1] ?? ''; return; }
    const control = (controlRows[i] ?? []).map((v) => substitute(v, entry.fileLine));
    out.push({ index: 0, file_line: entry.fileLine, file: dataPath, screen_name, values, path: control[0] ?? '', verify: control[1] ?? '', screenshot: control[2] ?? '', skip: (control[3] ?? '').toLowerCase() === 'true', comment: entry.comment });
  });
  if (including.length === 0) out.forEach((step, i) => { step.index = i + 1; });
  return out;
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
    if (screen.screen_kind === 'ui' && !UI_ACTIONS[s.screen_name]) problems.push(`Row ${s.index}: browser-only screen "${s.screen_name}" has no UI_ACTIONS entry.`);
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

/** Waits up to `ms` for `check` to hold, polling; the last failure's
 * message, if any, explains why it never did. */
async function waitUntil(check: () => Promise<boolean>, what: string, ms = 10_000): Promise<void> {
  const until = Date.now() + ms;
  for (;;) {
    if (await check().catch(() => false)) return;
    if (Date.now() > until) throw new Error(`timed out after ${ms}ms waiting until ${what}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

/** The browser-only screens (screen_kind `ui` in screens.csv): a gesture
 * or a check of what the page shows, with no backend call of its own.
 * Each takes the step's named fields. On the api and text paths they are
 * skipped, since there is no page; the data a test builds is checked on
 * every path by its verify column. Documented in docs/pm-testing-e2e.md,
 * "Browser-only steps". */
export const UI_ACTIONS: Record<string, (page: Page, a: Record<string, string>) => Promise<void>> = {
  'Open Page': async (page, a) => {
    await page.goto(a.route);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  },
  Click: async (page, a) => { await page.locator(a.selector).first().click(); await page.waitForTimeout(300); },
  Focus: async (page, a) => { await page.locator(a.selector).first().focus(); },
  Fill: async (page, a) => { await page.locator(a.selector).first().fill(a.value); await page.waitForTimeout(200); },
  'Select Option': async (page, a) => { await page.locator(a.selector).first().selectOption({ label: a.label }); await page.waitForTimeout(300); },
  'Press Key': async (page, a) => { await page.keyboard.press(a.key); await page.waitForTimeout(200); },
  'Page Shows': async (page, a) =>
    waitUntil(async () => ((await page.locator(a.selector).allTextContents()).join('\n')).includes(a.text), `${a.selector} shows "${a.text}"`),
  'Page Lacks': async (page, a) =>
    waitUntil(
      async () => (a.text === '' ? (await page.locator(a.selector).count()) === 0 : !((await page.locator(a.selector).allTextContents()).join('\n')).includes(a.text)),
      a.text === '' ? `there is no ${a.selector}` : `${a.selector} no longer shows "${a.text}"`
    ),
  'Page Count': async (page, a) =>
    waitUntil(async () => (await page.locator(a.selector).count()) === Number(a.count), `there are ${a.count} of ${a.selector}`),
  'Page Value': async (page, a) =>
    waitUntil(async () => (await page.locator(a.selector).first().inputValue()) === a.value, `${a.selector} holds "${a.value}"`),
  'Page Enabled': async (page, a) =>
    waitUntil(async () => (await page.locator(a.selector).first().isEnabled()) === (a.enabled === 'true'), `${a.selector} is ${a.enabled === 'true' ? 'enabled' : 'disabled'}`),
  'Page Has Option': async (page, a) =>
    waitUntil(
      async () => (await page.locator(a.selector).first().locator('option').allInnerTexts()).some((t) => t.trim() === a.label) === (a.present !== 'false'),
      `${a.selector} ${a.present === 'false' ? 'has no' : 'has an'} option "${a.label}"`
    ),
  'Page Focused': async (page, a) =>
    waitUntil(async () => page.locator(a.selector).first().evaluate((el) => el === document.activeElement), `${a.selector} has the keyboard focus`),
  // Opens the route and fails on a server error (HTTP 500 or more) or on
  // a script error the page throws while it loads. A minute to load, as
  // the dev server builds a page on its first visit.
  'Page Opens Cleanly': async (page, a) => {
    const errors: string[] = [];
    const onError = (e: Error) => errors.push(e.message);
    page.on('pageerror', onError);
    try {
      const response = await page.goto(a.route, { timeout: 60000 });
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      const status = response?.status() ?? 0;
      if (status >= 500) throw new Error(`${a.route} answered HTTP ${status}.`);
      if (errors.length > 0) throw new Error(`${a.route} threw: ${errors.join('; ')}`);
    } finally {
      page.off('pageerror', onError);
    }
  },
  // Files a page hands over or takes in, kept by name in stepFile().
  Download: async (page, a) => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator(a.selector).first().click()]);
    await download.saveAs(stepFile(a.file));
  },
  Upload: async (page, a) => { await page.locator(a.selector).first().setInputFiles(stepFile(a.file)); await page.waitForTimeout(300); },
  'File Contains': async (_page, a) => {
    if (!readFileSync(stepFile(a.file), 'utf-8').includes(a.text)) throw new Error(`${a.file} does not contain "${a.text}".`);
  },
};

/** Where Download saves a file and Upload finds it, by name: the
 * STEP_RUNNER_FILES_DIR environment variable, or step-runner-files in
 * the system's temporary directory. */
function stepFile(name: string): string {
  const dir = process.env.STEP_RUNNER_FILES_DIR ?? join(tmpdir(), 'step-runner-files');
  mkdirSync(dir, { recursive: true });
  return join(dir, name);
}

/** Where a screenshot goes: a name with a directory (`manual-images/x`)
 * is relative to docs/, a bare name goes to --screenshot-dir. */
function screenshotPath(name: string, screenshotDir: string): string {
  const file = screenshotFile(name, screenshotDir);
  mkdirSync(dirname(file), { recursive: true });
  return file;
}
function screenshotFile(name: string, screenshotDir: string): string {
  return `${name.includes('/') ? join(__dirname, '../../docs', name) : resolve(screenshotDir, name)}.png`;
}

export async function runStepViaUi(page: Page, step: Step, screens: Map<string, Screen>, screenshotDir: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const screen = screens.get(step.screen_name);
    const args = buildArgs(step, screen);
    // A screen with no browser wiring at all (screen_kind `api`: setup the
    // UI has no form for, or a check of the stored data) runs through the
    // API on every path, by design rather than as a fallback.
    if (screen?.screen_kind === 'api') return runStepViaApi(step, screens);
    if (screen?.screen_kind === 'ui') {
      const action = UI_ACTIONS[step.screen_name];
      if (!action) return { ok: false, error: `No browser action named "${step.screen_name}".` };
      await action(page, args);
      if (step.screenshot) await page.screenshot({ path: screenshotPath(step.screenshot, screenshotDir), fullPage: true });
      return { ok: true };
    }
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
      await runActionSequence(page, resolveSelectorTemplate(screen.open_selector, args));
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
      await page.screenshot({ path: screenshotPath(step.screenshot, screenshotDir), fullPage: true });
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

/** Drives one real, already-open TUI session via @microsoft/tui-test —
 * purely generic, exactly the same real way runStepViaUi is: no
 * per-screen driver code anywhere, no screen_name-keyed registry. It
 * reuses exactly the same screen_name + positional field list
 * (position/field_name/field_type) screens.csv already carries for
 * `--path api`/`--path ui`, plus the PRESENCE (never the web-specific
 * value) of two columns that mechanism already has:
 *
 * - A field with a blank `field_selector` has no real on-screen TUI
 *   input either — the exact, same skip rule runStepViaUi already
 *   applies (a position that only ever fed `api_function`, e.g. "Post
 *   Journal Entry"'s own reference/businessName/ledger columns, which
 *   carry no real UI field on the web path either).
 * - A screen with no real `submit_selector` is an intermediate "add
 *   one line" action — driven by the one, real, uniform
 *   Insert/Enter/Escape/Delete idiom every TUI screen already shares
 *   (Insert opens the line-item sub-form; its own last field's Enter
 *   both confirms that field AND adds the line, returning to the
 *   list) — never a screen-specific key. A screen WITH a real
 *   `submit_selector` and no real fields of its own (e.g. "Post
 *   Journal Entry") is a pure finalize action: one, real, standalone
 *   Enter at the screen's own list, now standardized across every TUI
 *   screen to both confirm and finalize (save/post) — see
 *   docs/tui-design.md.
 *
 * Navigating there in the first place (`navigateMenuGenerically`,
 * `text-driver-helpers.ts`) is the same kind of generic, text-search
 * mechanism — it never hardcodes which top-level section a given
 * screen_name lives under.
 *
 * This genuinely can't reach every screen yet: it depends on the TUI's
 * own on-screen menu label matching `screen_name` exactly, which isn't
 * true for every row today (see "`--path text` — driving the terminal UI"
 * in docs/pm-testing-e2e.md — General
 * Journal's "Stage Journal Line"/"Post Journal Entry" rows are real,
 * separate screen_names that don't match the TUI's own single
 * "General Journal" menu label, for one). Fails loudly either way —
 * `navigateMenuGenerically` throws rather than guessing, same as every
 * other real failure path here. */
/** The label the menu shows for a screen: the one menu link whose href
 * is the screen's ui_path, as getMenuTree gives it; the screen's own
 * name when no single link has that href. */
function menuLabelFor(screen: Screen): string {
  if (!screen.ui_path) return screen.screen_name;
  const links = db.getMenuTree().flatMap((section) => section.links).filter((l) => l.href === screen.ui_path);
  return links.length === 1 ? links[0].label : screen.screen_name;
}

export async function runStepViaText(terminal: TuiTest, step: Step, screens: Map<string, Screen>): Promise<{ ok: boolean; error?: string }> {
  try {
    const screen = screens.get(step.screen_name);
    const args = buildArgs(step, screen);
    if (!screen) return { ok: false, error: `No real screen registry entry for "${step.screen_name}".` };
    if (screen.screen_kind === 'api') return runStepViaApi(step, screens);
    if (screen.screen_kind !== 'session') {
      await openScreenGenerically(terminal, menuLabelFor(screen));
    }
    const realFields = screen.fields.filter((f) => f.field_selector);
    if (!screen.submit_selector && realFields.length > 0) {
      await press(terminal, 'i'); // the one, real, uniform "add a line" key — never screen-specific
    }
    for (const field of realFields) {
      const value = step.values[field.position - 1] ?? '';
      if (value === '') {
        await press(terminal, 'Enter'); // blank — accept whatever default this step is already on
        continue;
      }
      if (field.field_type === 'signed_money') {
        // The web's debit and credit columns are two inputs in the TUI,
        // debit first: a positive amount is typed in the debit, a negative
        // one in the credit, in dollars as on the ui path.
        const minorUnits = Number(value);
        const dollars = (Math.abs(minorUnits) / 100).toFixed(2);
        if (minorUnits >= 0) {
          await typeAndEnter(terminal, dollars);
          await press(terminal, 'Enter');
        } else {
          await press(terminal, 'Enter');
          await typeAndEnter(terminal, dollars);
        }
        continue;
      }
      if (field.field_type === 'money') {
        await typeAndEnter(terminal, (Number(value) / 100).toFixed(2));
        continue;
      }
      if (field.field_type === 'select' || field.field_type === 'select_value' || field.field_type === 'search_and_select') {
        const found = await findItemByText(terminal, value, 200);
        if (!found) return { ok: false, error: `No real picker item matching "${value}" found for field "${field.field_name}".` };
        await press(terminal, 'Enter');
      } else {
        await typeAndEnter(terminal, value);
      }
    }
    if (screen.submit_selector && realFields.length === 0) {
      // A pure finalize row with no real fields of its own — the one,
      // standalone Enter every TUI screen now uses uniformly.
      await press(terminal, 'Enter');
    }
    if ((await terminal.text()).includes('RUNTIME ERROR')) return { ok: false, error: 'The terminal UI stopped with a runtime error.' };
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
    console.error('Usage: step-runner <data.csv> [--screens screens.csv] [--lint] [--pretty] [--path api|ui|text] [--steps N] [--only N] [--skip N] [--until N] [--non-interactive] [--delay MS] [--ui] [--screenshot-dir DIR] [--verify NAME] [--screenshot NAME] [--fallback-to-api] [--verify-via-recording] [--timing-file FILE] [--list-screenshots]');
    process.exit(1);
  }
  // The one screen registry: beside the data file, else shared-fixtures/screens.csv.
  const besideData = dataPath.replace(/[^/]+$/, 'screens.csv');
  const screensPath = args.includes('--screens') ? args[args.indexOf('--screens') + 1] : existsSync(besideData) ? besideData : join(__dirname, '../../shared-fixtures/screens.csv');
  const path = args.includes('--path') ? args[args.indexOf('--path') + 1] : 'api';
  const stepsArg = args.includes('--steps') ? Number(args[args.indexOf('--steps') + 1]) : 1;
  const nonInteractive = args.includes('--non-interactive');
  const onlyN = args.includes('--only') ? Number(args[args.indexOf('--only') + 1]) : undefined;
  const skipN = args.includes('--skip') ? Number(args[args.indexOf('--skip') + 1]) : 0;
  const untilN = args.includes('--until') ? Number(args[args.indexOf('--until') + 1]) : undefined;
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
  if (untilN !== undefined) allSteps = allSteps.filter((s) => s.index <= untilN);
  allSteps = allSteps.filter((s) => !s.skip);
  if (onlyN) allSteps = allSteps.filter((s) => s.index === onlyN);
  if (onlyN && (inlineVerify || inlineScreenshot)) {
    allSteps = allSteps.map((s) => ({ ...s, verify: inlineVerify ?? s.verify, screenshot: inlineScreenshot ?? s.screenshot }));
  }

  // Every picture the data files' screenshot columns take (every .csv
  // argument is one), as "data file<TAB>picture" lines, both relative to
  // the repository (scripts/manual-pictures.ts reads these).
  if (args.includes('--list-screenshots')) {
    const repo = join(__dirname, '../..');
    for (const file of args.filter((a, i) => a.endsWith('.csv') && args[i - 1] !== '--screens')) {
      for (const step of loadSteps(file)) {
        if (step.screenshot && !step.skip) console.log(`${relative(repo, resolve(file))}\t${relative(repo, screenshotFile(step.screenshot, screenshotDir))}`);
      }
    }
    return;
  }

  if (args.includes('--lint')) {
    const problems = lintSteps(allSteps, screens);
    if (problems.length === 0) { console.log(`✅ ${dataPath}: ${allSteps.length} real step(s), no real problems found.`); return; }
    console.log(`❌ ${dataPath}: ${problems.length} real problem(s) found:\n`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exitCode = 1;
    return;
  }

  // A fixture always builds its own business from scratch, so an
  // in-process run starts from a fresh installation. Over HTTP the server
  // owns the database: start it on a fresh one (make reset-db).
  const coreApi = new CoreApiClient();
  if (USE_CORE && path === 'api') {
    if (!process.env.STEP_RUNNER_API_URL && skipN === 0 && !onlyN) resetCore(true);
    console.log(`Frontend API: ${coreApi.transport}`);
  }
  const runApiStep = async (step: Step) => (USE_CORE ? runStepViaFrontendApi(step, screens, coreApi) : runStepViaApi(step, screens));

  if (args.includes('--pretty')) {
    console.log(prettyPrintSteps(args.includes('--steps') && !onlyN ? allSteps.slice(0, stepsArg) : allSteps, screens));
    return;
  }

  let browser: Browser | undefined;
  let page: Page | undefined;
  async function ensureUiPage(): Promise<Page> {
    if (!page) {
      browser = await chromium.launch({ headless: !openInspector });
      const context = await browser.newContext({ baseURL: 'http://localhost:5173', acceptDownloads: true });
      page = await context.newPage();
      // A confirmation dialog (Delete a division: "Are you sure?") is
      // accepted, as the person following the test would.
      page.on('dialog', (dialog) => { dialog.accept().catch(() => {}); });
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

  // One TUI process for the whole run, as `ui` keeps one Playwright page:
  // the built terminal UI (tui/dist/src/cli.mjs, from `tui/sveltui-build`),
  // run as a separate process. It must show its Log in panel, or the run
  // fails here.
  let textTerminal: TuiTest | undefined;
  async function ensureTextTerminal(): Promise<TuiTest> {
    if (!textTerminal) {
      textTerminal = TuiTest.ephemeral('step-runner-text');
      await textTerminal.run('bun', ['--conditions', 'browser', 'dist/src/cli.mjs'], {
        cwd: join(__dirname, '../../tui'),
        cols: 100,
        rows: 40,
        timeouts: { text: 10_000 } as any,
      });
      await textTerminal.getByText('Log in').expect();
    }
    return textTerminal;
  }
  if (path === 'text') await ensureTextTerminal();

  // --verify-via-recording state — see docs/pm-testing-e2e.md "The Admin recording feature".
  let recordingStarted = false;
  let recordingUsername: string | undefined;
  const recordedExpectations: { screen_name: string; values: string[] }[] = [];

  // A run with any failed step exits non-zero, so `make` and CI see it.
  let failedSteps = 0;
  let index = 0;
  while (index < allSteps.length) {
    const batch = allSteps.slice(index, index + (nonInteractive ? allSteps.length : stepsArg));
    console.log(prettyPrintSteps(batch, screens));
    if (!nonInteractive) {
      const answer = await prompt(`\nRun these ${batch.length} step(s)? [Y/n] `);
      if (answer.trim().toLowerCase() === 'n') { console.log('Stopped.'); if (browser) await browser.close(); return; }
    }
    for (const step of batch) {
      // A control row's path `ui-only` runs the step only in the browser:
      // a check of data that only the browser's gestures created.
      const uiOnly = step.path === 'ui-only';
      const stepPath = uiOnly ? path : step.path || path;
      if (step.comment) console.log(`\n# ${step.comment}`);
      if ((uiOnly || screens.get(step.screen_name)?.screen_kind === 'ui') && stepPath !== 'ui') {
        console.log(`⏭  ${step.index}: ${step.screen_name} (browser only, skipped on the ${stepPath} path)`);
        continue;
      }
      const stepStart = Date.now();
      let result = stepPath === 'ui'
        ? await runStepViaUi(await ensureUiPage(), step, screens, screenshotDir)
        : stepPath === 'text'
          ? await runStepViaText(await ensureTextTerminal(), step, screens)
          : await runApiStep(step);
      const stepMs = Date.now() - stepStart;
      recordTiming(step.index, step.screen_name, stepPath, stepMs, result.ok, result.ok ? undefined : result.error);
      if (!result.ok && stepPath === 'ui' && page) {
        // What the page looked like when the step failed, for diagnosis.
        const failureDir = join(process.env.STEP_RUNNER_FAILURE_DIR ?? '/tmp/step-runner-failures', step.file ? step.file.replace(/^.*\//, '').replace(/\.csv$/, '') : 'run');
        mkdirSync(failureDir, { recursive: true });
        await page.screenshot({ path: join(failureDir, `${step.index}.png`), fullPage: true }).catch(() => {});
        writeFileSync(join(failureDir, `${step.index}.txt`), `${page.url()}\n\n${await page.locator('body').innerText().catch(() => '')}`);
      }
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
        const apiResult = await runApiStep(step);
        const fallbackMs = Date.now() - fallbackStart;
        recordTiming(step.index, step.screen_name, 'api-fallback', fallbackMs, apiResult.ok, apiResult.ok ? undefined : apiResult.error);
        console.log(apiResult.ok
          ? `   ↳ ✅ ${step.index}: ${step.screen_name} (api fallback, after ui failure) [${fallbackMs}ms]`
          : `   ↳ ❌ ${step.index}: ${step.screen_name} (api fallback also failed): ${apiResult.error} [${fallbackMs}ms]`);
        result = apiResult;
      }
      if (!result.ok) failedSteps += 1;
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
  console.log(`\nDone - ${allSteps.length} step(s) processed${failedSteps > 0 ? `, ${failedSteps} FAILED` : ''}.`);
  if (failedSteps > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
