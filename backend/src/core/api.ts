// The frontend API of the core middleware.
//
// One endpoint, one plain-text protocol - the same one the frontends
// already speak to /api/call (routes/call.ts):
//
//   request   functionName,value1,value2,...      one CSV line, positional
//             (further lines are the form's line items)
//   reply     ok,value1,value2,...                a single result
//             ok\n<CSV table with a header row>   a list
//             error,message                       with status 400/401/404/500
//
// The caller signs in with `login`, which returns a token, and from then
// on sends it as `Authorization: Bearer <token>`. The token's session
// holds the user, the business and the ledger: the three globals of the
// instance that serves each call. An operation never receives them.
// Forms that still carry a business or a ledger field use it only to
// choose which of the user's instances serves that one call.
//
// Every function declares the order of its values in `params`, which is
// the order of the fields of its screen in shared-fixtures/screens.csv.

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, rmSync } from 'fs';
import { randomBytes } from 'crypto';
import { splitCsvLine, csvField, unescapeAscii, writeCsv } from '../../../shared-fixtures/csv.js';
import { Core, Instance, Refused, NotFound, GLOBAL_BUSINESS } from './core.js';
import * as ops from './ops.js';
import * as reports from './reports.js';
import { verifyPassword } from '../password.js';

type Args = Record<string, string>;
type Scalar = string | number | boolean | undefined;
type Result = void | { row: Scalar[] } | { header: string[]; rows: Scalar[][] };

/** Who is signed in, and the business and ledger they chose. */
interface Session {
  user: string;
  business: string;
  ledger: string;
}

interface CoreCall {
  /** The names of the positional values, in order. */
  params: string[];
  run: (a: Args, session: Session, token: string) => Result | unknown;
  /** True for the one call that needs no session: signing in. */
  open?: boolean;
}

export interface CoreReply {
  status: number;
  body: string;
}

class Unauthorised extends Error {}

const here = dirname(fileURLToPath(import.meta.url));
export const CORE_DB_PATH = process.env.CORE_DB_PATH ?? join(here, '..', '..', 'data', 'core.sqlite');

let core: Core | undefined;
const sessions = new Map<string, Session>();
const instances = new Map<string, Instance>();

export function openCore(path = CORE_DB_PATH): Core {
  if (!core) {
    mkdirSync(dirname(path), { recursive: true });
    core = new Core(path);
  }
  return core;
}

/** Closes the store and ends every session. With `remove`, deletes the
 * database file too, so the next open starts from a fresh installation. */
export function resetCore(remove = false, path = CORE_DB_PATH): void {
  core?.close();
  core = undefined;
  sessions.clear();
  instances.clear();
  staged.clear();
  if (remove) for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true });
}


function instance(user: string, business: string, ledger: string): Instance {
  const key = `${user}\u0000${business}\u0000${ledger}`;
  let inst = instances.get(key);
  if (!inst) {
    inst = openCore().open(user, business, ledger);
    instances.set(key, inst);
  }
  return inst;
}

/** The instance a call is served by: the business and ledger its form
 * names, else the session's. The user is always the session's. */
function inst(a: Args, s: Session): Instance {
  const business = a.businessName ? a.businessName : s.business;
  const ledger = a.ledger || (business === s.business ? s.ledger : 'Actual');
  return instance(s.user, business, ledger);
}

// --- journal entries typed by hand --------------------------------------------
//
// Lines typed one at a time are held here until the entry is posted. This
// is working memory, not a record: an entry exists only once it is posted.

const staged = new Map<string, { account: string; amount: number }[]>();

function stageKey(i: Instance, reference: string): string {
  return `${i.ledger.id}\u0000${reference}`;
}

function stageLine(a: Args, s: Session): void {
  const i = inst(a, s);
  i.store.tx(() => i.accountNamed(a.account));
  const key = stageKey(i, a.reference);
  staged.set(key, [...(staged.get(key) ?? []).filter((l) => l.account !== a.account), { account: a.account, amount: Number(a.amountMinor) }]);
}

function postStaged(a: Args, s: Session): void {
  const i = inst(a, s);
  const key = stageKey(i, a.reference);
  const lines = staged.get(key);
  if (!lines || lines.length === 0) throw new NotFound(`Nothing staged for "${a.reference}".`);
  i.store.tx(() => i.post(a.reference, lines.map((l) => ({ account: i.accountNamed(l.account).id, amount: l.amount }))));
  staged.delete(key);
}

function list(text: string | undefined): string[] {
  return (text ?? '').split(',').map((r) => r.trim()).filter(Boolean);
}

function ensureValue(i: Instance, grouping: string, value: string): void {
  i.store.tx(() => i.groupValue(grouping, value));
}

function sale(a: Args, s: Session): void {
  ops.sell(inst(a, s), { item: a.itemName, location: a.locationName, quantity: Number(a.quantity), unitMinor: Number(a.unitPriceMinor) });
}

const CHARTS: Record<string, string> = { 'English / generic': 'English CoA' };
const SALE_PARAMS = ['businessName', 'locationName', 'itemName', 'quantity', 'unitPriceMinor', 'ledger'];
const optionalDate = (text: string) => text || undefined;

const KIND_BRANCHES: Record<string, string> = {
  Location: 'Locations',
  Item: 'Items',
  Contact: 'Contacts',
  Plant: 'Plant',
  Project: 'Projects',
  Prototype: 'Prototypes',
  User: 'Users',
  Skill: 'Skills',
};

function exists(a: Args, s: Session): boolean {
  if (a.kind === 'Business') {
    try {
      return !!openCore().business(a.name);
    } catch (err) {
      if (err instanceof NotFound) return false;
      throw err;
    }
  }
  const i = inst(a, s);
  if (a.kind === 'Account') return !i.isGlobal && !!i.core.findNamed(i.accountsRoot().id, a.name, 'Account');
  if (a.kind === 'Word') return !!i.lookup('Vocabulary', a.name);
  if (a.kind === 'Anything') return !!i.anything(a.name) || !!i.lookup('Vocabulary', a.name);
  const branch = KIND_BRANCHES[a.kind];
  if (!branch) throw new Refused(`"${a.kind}" is not a kind that can be looked up.`);
  return !!i.existing(branch, a.name);
}

export const CORE_CALLS: Record<string, CoreCall> = {
  // --- session ---------------------------------------------------------------
  login: {
    open: true,
    params: ['username', 'password'],
    run: (a) => {
      let hash: string | undefined;
      try {
        hash = openCore().value(openCore().open(a.username, GLOBAL_BUSINESS).user.id, 'Password Hash');
      } catch (err) {
        if (!(err instanceof NotFound)) throw err;
      }
      if (!hash || !verifyPassword(a.password, hash)) throw new Unauthorised('Wrong username or password.');
      const token = randomBytes(24).toString('hex');
      sessions.set(token, { user: a.username, business: GLOBAL_BUSINESS, ledger: 'Actual' });
      return { row: [token] };
    },
  },
  logout: { params: [], run: (_a, _s, token) => void sessions.delete(token) },
  whoAmI: { params: [], run: (_a, s) => ({ row: [s.user, s.business, s.ledger] }) },
  // Choosing a business, or a business and a ledger, changes which
  // instance serves the calls that follow. The user must be one of its own.
  selectBusiness: {
    params: ['businessName'],
    run: (a, s) => {
      const business = a.businessName;
      instance(s.user, business, 'Actual');
      s.business = business;
      s.ledger = 'Actual';
    },
  },
  switchSession: {
    params: ['businessName', 'ledger'],
    run: (a, s) => {
      const business = a.businessName;
      const ledger = a.ledger || 'Actual';
      instance(s.user, business, ledger);
      s.business = business;
      s.ledger = ledger;
    },
  },

  // --- businesses, users, banking ----------------------------------------------
  createBusiness: {
    params: ['businessName', 'financialYearLabel', 'businessType', 'homeCurrency', 'coaPrototype', 'secondaryCurrencies'],
    run: (a, s) =>
      void ops.createBusiness(instance(s.user, GLOBAL_BUSINESS, 'Actual'), {
        name: a.businessName,
        financialYear: a.financialYearLabel,
        businessType: a.businessType,
        homeCurrency: a.homeCurrency,
        chartOfAccounts: a.coaPrototype ? (CHARTS[a.coaPrototype] ?? a.coaPrototype) : 'English CoA',
        secondaryCurrencies: a.secondaryCurrencies,
      }),
  },
  createUserSimple: { params: ['username', 'password', 'roles'], run: (a, s) => void ops.createUser(inst(a, s), a.username, a.password, list(a.roles)) },
  setUserRolesSimple: { params: ['username', 'roles'], run: (a, s) => ops.setUserRoles(inst(a, s), a.username, list(a.roles)) },
  nominateBankAccountSimple: {
    params: ['businessName', 'bankAccountName', 'routingDetail', 'accountNumber'],
    run: (a, s) => void ops.nominateBankAccount(inst(a, s), a.bankAccountName, a.routingDetail, a.accountNumber),
  },
  buildBankCurrencyStructureSimple: {
    params: ['businessName', 'bankAccountName', 'currency', 'confirmCombination'],
    run: (a, s) => void ops.buildBankCurrencyStructure(inst(a, s), a.bankAccountName, a.currency),
  },

  // --- things and their relations ------------------------------------------------
  createAndConfigureLocation: {
    params: ['businessName', 'locationName', 'city', 'locationType', 'division', 'bottleCapacity', 'cartonCapacity'],
    run: (a, s) =>
      void ops.createLocation(inst(a, s), {
        name: a.locationName,
        city: a.city,
        locationType: a.locationType,
        bottleCapacity: a.bottleCapacity,
        cartonCapacity: a.cartonCapacity,
        timezone: 'Australia/Adelaide',
        division: a.division,
      }),
  },
  createEmployeeAt: { params: ['businessName', 'employeeName', 'locationName'], run: (a, s) => void ops.createEmployee(inst(a, s), a.employeeName, a.locationName) },
  createProviderSimple: { params: ['businessName', 'providerName', 'parent'], run: (a, s) => void ops.createContact(inst(a, s), a.providerName, 'Provider') },
  createCustomerSimple: { params: ['businessName', 'customerName', 'parent'], run: (a, s) => void ops.createContact(inst(a, s), a.customerName, 'Customer') },
  setEmployeeWageSimple: {
    params: ['employeeName', 'wageMinorPerHour'],
    run: (a, s) => {
      const i = inst(a, s);
      i.relate(i.contact(a.employeeName).id, 'Wage Per Hour', a.wageMinorPerHour);
    },
  },
  createPlantItemSimple: {
    params: ['name', 'businessName', 'hourlyRateMinor', 'ownedOrHired', 'hireVendor'],
    run: (a, s) => void ops.createPlant(inst(a, s), a.name, Number(a.hourlyRateMinor), a.ownedOrHired, a.hireVendor),
  },
  ensureSkillSimple: { params: ['skillName'], run: (a, s) => void ops.ensureSkill(inst(a, s), a.skillName) },
  tagSkillSimple: { params: ['contactName', 'skillName', 'rateMinorPerHour'], run: (a, s) => ops.tagSkill(inst(a, s), a.contactName, a.skillName, Number(a.rateMinorPerHour)) },
  createUncategorizedItem: { params: ['businessName', 'itemName'], run: (a, s) => void ops.createItem(inst(a, s), a.itemName) },
  createItemUnderCategory: {
    params: ['businessName', 'itemName', 'category'],
    run: (a, s) => {
      const i = inst(a, s);
      i.store.tx(() => {
        ops.createItem(i, a.itemName);
        ops.setGroup(i, a.itemName, 'Category', a.category);
      });
    },
  },
  createCategorySimple: { params: ['businessName', 'categoryName'], run: (a, s) => ensureValue(inst(a, s), 'Category', a.categoryName) },
  addTopLevelCategoryViaStructurePopup: { params: ['businessName', 'categoryName'], run: (a, s) => ensureValue(inst(a, s), 'Category', a.categoryName) },
  addDivisionViaStructurePopup: { params: ['businessName', 'valueName'], run: (a, s) => ensureValue(inst(a, s), 'Division', a.valueName) },
  createHierarchyGroupingSimple: {
    params: ['businessName', 'groupingName'],
    run: (a, s) => {
      const i = inst(a, s);
      i.store.tx(() => i.grouping(a.groupingName));
    },
  },
  createHierarchyValueSimple: { params: ['businessName', 'groupingName', 'valueName'], run: (a, s) => ensureValue(inst(a, s), a.groupingName, a.valueName) },
  tagItemHierarchy: { params: ['businessName', 'itemName', 'groupingName', 'valueName'], run: (a, s) => ops.setGroup(inst(a, s), a.itemName, a.groupingName, a.valueName) },
  setHierarchyTagSimple: { params: ['businessName', 'locationName', 'division'], run: (a, s) => ops.setGroup(inst(a, s), a.locationName, 'Division', a.division) },
  addDepartmentViaStructurePopup: { params: ['businessName', 'departmentName'], run: (a, s) => void ops.createDepartment(inst(a, s), a.departmentName) },
  deleteDepartmentViaStructurePopup: { params: ['businessName', 'departmentName'], run: (a, s) => ops.deleteDepartment(inst(a, s), a.departmentName) },
  assignEmployeeDepartmentViaStructurePopup: {
    params: ['businessName', 'employeeName', 'departmentName'],
    run: (a, s) => ops.setEmployeeDepartment(inst(a, s), a.employeeName, a.departmentName),
  },
  setEmployeeManagerViaStructurePopup: {
    params: ['businessName', 'employeeName', 'managerName'],
    run: (a, s) => ops.setEmployeeManager(inst(a, s), a.employeeName, a.managerName),
  },
  renameEntitySimple: {
    params: ['businessName', 'oldName', 'newName', 'parentName'],
    run: (a, s) => ops.renameByName(inst(a, s), a.oldName, a.newName, a.parentName || undefined),
  },
  createEntitySimple: {
    params: ['name', 'parent'],
    run: (a, s) => {
      const i = inst(a, s);
      i.store.tx(() => i.core.thing(a.name, i.branch(a.parent || 'Vocabulary').id, 'Word', i.id));
    },
  },
  setTranslationSimple: {
    params: ['concept', 'language', 'translationText'],
    run: (a, s) => {
      const i = inst(a, s);
      i.store.tx(() => i.relate(i.localise('Vocabulary', a.concept, 'Word').id, `Translation: ${a.language}`, a.translationText));
    },
  },
  setItemCostAndPackSize: {
    params: ['businessName', 'itemName', 'providerName', 'unitCostMinor', 'packageQuantity'],
    run: (a, s) => ops.setItemSource(inst(a, s), a.itemName, a.providerName, Number(a.unitCostMinor), Number(a.packageQuantity)),
  },
  ensureItemInventoryAccountSimple: {
    params: ['businessName', 'itemName'],
    run: (a, s) => {
      const i = inst(a, s);
      i.store.tx(() => i.productAccount('Inventory', { item: i.item(a.itemName) }));
    },
  },

  // --- recipes, proposals, projects, clocking --------------------------------------
  setBomComponentSimple: {
    params: ['assemblyItem', 'businessName', 'componentItem', 'quantity', 'unit'],
    run: (a, s) => {
      const i = inst(a, s);
      i.item(a.componentItem);
      ops.setLine(i, i.item(a.assemblyItem), { component: a.componentItem, kind: 'Material', quantity: Number(a.quantity), unit: a.unit });
    },
  },
  createPrototypeSimple: { params: ['prototypeName', 'businessName'], run: (a, s) => void ops.createPrototype(inst(a, s), a.prototypeName) },
  addPrototypeLineSimple: {
    params: ['prototypeName', 'businessName', 'kind', 'resourceOrItemName', 'quantity', 'unit', 'priceMinor', 'durationHours', 'scheduledStart'],
    run: (a, s) => {
      const i = inst(a, s);
      ops.setLine(i, i.require('Prototypes', a.prototypeName, 'prototype'), {
        component: a.resourceOrItemName,
        kind: a.kind,
        quantity: Number(a.quantity),
        unit: a.unit,
        priceMinor: Number(a.priceMinor),
        durationHours: a.durationHours ? Number(a.durationHours) : undefined,
        scheduledStart: a.scheduledStart || undefined,
      });
    },
  },
  updatePrototypeLineSimple: {
    params: ['prototypeName', 'businessName', 'resourceOrItemName', 'newDurationHours', 'newPriceMinor'],
    run: (a, s) => {
      const i = inst(a, s);
      const prototype = i.require('Prototypes', a.prototypeName, 'prototype');
      if (!ops.getLines(i, prototype).some((l) => l.component === a.resourceOrItemName)) {
        throw new NotFound(`No "${a.resourceOrItemName}" line on prototype "${a.prototypeName}".`);
      }
      ops.setLine(i, prototype, {
        component: a.resourceOrItemName,
        durationHours: a.newDurationHours ? Number(a.newDurationHours) : undefined,
        priceMinor: a.newPriceMinor ? Number(a.newPriceMinor) : undefined,
      });
    },
  },
  instantiateProjectProposalSimple: {
    params: ['prototypeName', 'reference', 'client', 'businessName', 'ledger', 'headerItem', 'transdate', 'targetCompletionDate'],
    run: (a, s) => void ops.instantiateProposal(inst(a, s), a.prototypeName, a.reference, a.client, a.headerItem, a.transdate, a.targetCompletionDate),
  },
  acceptProjectProposalSimple: {
    params: ['reference', 'projectName', 'targetCompletionDate'],
    run: (a, s) => ops.acceptProposal(inst(a, s), a.reference, a.projectName, a.targetCompletionDate),
  },
  clockInToProjectSimple: {
    params: ['employeeName', 'projectExpenseAccount', 'businessName', 'ledger'],
    run: (a, s) => void ops.clockInToProject(inst(a, s), a.employeeName, a.projectExpenseAccount),
  },
  clockOutOfProjectSimple: { params: ['employeeName', 'businessName', 'ledger'], run: (a, s) => ops.clockOutOfProject(inst(a, s), a.employeeName) },
  clockPlantInSimple: {
    params: ['plantName', 'projectExpenseAccount', 'businessName', 'ledger'],
    run: (a, s) => void ops.clockPlantIn(inst(a, s), a.plantName, a.projectExpenseAccount),
  },
  clockPlantOutSimple: { params: ['plantName', 'businessName', 'ledger'], run: (a, s) => ops.clockPlantOut(inst(a, s), a.plantName) },

  // --- transactions -------------------------------------------------------------------
  stageJournalLine: { params: ['reference', 'businessName', 'ledger', 'account', 'amountMinor'], run: stageLine },
  postJournalEntrySimple: { params: ['reference', 'businessName', 'ledger'], run: postStaged },
  createPurchaseOrderInCartons: {
    params: ['businessName', 'providerName', 'itemName', 'cartons', 'pricePerCartonMinor', 'reference', 'ledger'],
    run: (a, s) => {
      const i = inst(a, s);
      const pack = ops.itemSource(i, a.itemName, a.providerName)?.packageQuantity ?? 1;
      const cartons = Number(a.cartons);
      ops.placePurchaseOrder(i, a.reference, a.providerName, a.itemName, cartons * pack, cartons * Number(a.pricePerCartonMinor));
    },
  },
  cashPurchaseSimple: {
    params: ['businessName', 'locationName', 'itemName', 'quantity', 'unitCostMinor', 'ledger'],
    run: (a, s) => void ops.purchase(inst(a, s), { item: a.itemName, location: a.locationName, quantity: Number(a.quantity), unitMinor: Number(a.unitCostMinor) }),
  },
  cashSaleSimple: { params: SALE_PARAMS, run: sale },
  posSaleSimple: { params: SALE_PARAMS, run: sale },
  posSaleInLedgerSimple: { params: ['businessName', 'locationName', 'ledger', 'itemName', 'quantity', 'unitPriceMinor'], run: sale },
  transferItemsSimple: {
    params: ['businessName', 'itemName', 'fromLocationName', 'toLocationName', 'quantity', 'reference', 'ledger'],
    run: (a, s) => void ops.transferStock(inst(a, s), a.reference || `TRANSFER-${a.itemName}`, a.itemName, a.fromLocationName, a.toLocationName, Number(a.quantity)),
  },
  receiveStockQuantitySimple: {
    params: ['reference', 'businessName', 'ledger', 'itemName', 'locationName', 'quantity'],
    run: (a, s) => void ops.receiveStock(inst(a, s), a.reference, a.itemName, a.locationName, Number(a.quantity)),
  },
  dispatchStockQuantitySimple: {
    params: ['reference', 'businessName', 'ledger', 'itemName', 'locationName', 'quantity'],
    run: (a, s) => void ops.dispatchStock(inst(a, s), a.reference, a.itemName, a.locationName, Number(a.quantity)),
  },
  receiveStockWithCombination: {
    params: ['businessName', 'itemName', 'locationName', 'quantity', 'groupingName', 'storageValue', 'ledger'],
    run: (a, s) => {
      const i = inst(a, s);
      i.store.tx(() => {
        const value = i.groupValue(a.groupingName, a.storageValue);
        const reference = i.freeReference(`RECEIVE-${a.itemName}-${a.storageValue}`);
        ops.receiveStock(i, reference, a.itemName, a.locationName, Number(a.quantity), undefined, { [a.groupingName]: value });
      });
    },
  },
  openContainer: {
    params: ['businessName', 'locationName', 'itemName', 'containerValue', 'cartonsOpened', 'unitValue', 'unitsProduced', 'ledger'],
    run: (a, s) => {
      const i = inst(a, s);
      i.store.tx(() => {
        i.groupValue('Container', a.containerValue);
        i.groupValue('Container', a.unitValue);
        ops.openContainer(i, a.locationName, a.itemName, Number(a.cartonsOpened), Number(a.unitsProduced));
      });
    },
  },
  closeBooksSimple: {
    params: ['businessName', 'ledger', 'asOfDate', 'retainedEarningsAccount'],
    run: (a, s) => void ops.closeBooks(inst(a, s), a.asOfDate, a.retainedEarningsAccount),
  },
  createLedgerSimple: {
    params: ['businessName', 'ledger'],
    run: (a, s) => void ops.createLedger(instance(s.user, a.businessName, 'Actual'), a.ledger),
  },
  rolloverToNewPeriodSimple: {
    params: ['businessName', 'oldLedger', 'newLedger', 'asOfDate'],
    run: (a, s) => void ops.rollover(instance(s.user, a.businessName, a.oldLedger), a.newLedger, a.asOfDate),
  },

  // --- the year-end stock take, from a terminal or a phone ----------------------
  // An empty `counted` confirms the books' quantity.
  confirmStockCount: {
    params: ['itemName', 'locationName', 'counted', 'asOfDate', 'businessName', 'ledger'],
    run: (a, s) => void ops.confirmCount(inst(a, s), a.itemName, a.locationName || undefined, a.counted === '' ? undefined : Number(a.counted), a.asOfDate),
  },
  completeYearEndStockTake: {
    params: ['asOfDate', 'businessName', 'ledger'],
    run: (a, s) => ({ row: [ops.completeYearEndStockTake(inst(a, s), a.asOfDate)] }),
  },
  getStockTakeSheet: {
    params: ['asOfDate', 'businessName', 'ledger'],
    run: (a, s) => ({
      header: ['location', 'item', 'on_hand', 'counted'],
      rows: ops.stockTakeSheet(inst(a, s), a.asOfDate).map((l) => [l.location, l.item, l.onHand, l.counted]),
    }),
  },

  // --- reading ------------------------------------------------------------------------
  exists: { params: ['kind', 'name', 'businessName', 'ledger'], run: (a, s) => ({ row: [exists(a, s)] }) },
  getTrialBalance: {
    params: ['businessName', 'ledger', 'asOfDate'],
    run: (a, s) => {
      const t = reports.trialBalance(inst(a, s), optionalDate(a.asOfDate));
      return { row: [t.total_debit_minor, t.total_credit_minor] };
    },
  },
  getProfitAndLoss: {
    params: ['businessName', 'ledger', 'fromDate', 'toDate'],
    run: (a, s) => {
      const p = reports.profitAndLoss(inst(a, s), optionalDate(a.fromDate), optionalDate(a.toDate));
      return { row: [p.total_income_minor, p.total_expense_minor, p.net_income_minor] };
    },
  },
  getBalanceSheet: {
    params: ['businessName', 'ledger', 'asOfDate'],
    run: (a, s) => {
      const b = reports.balanceSheet(inst(a, s), optionalDate(a.asOfDate));
      return { row: [b.total_assets_minor, b.total_liabilities_minor, b.total_equity_minor, b.current_earnings_minor, b.balanced] };
    },
  },
  // One row per outer group, with `inner` empty, followed by one row for
  // each of its inner groups.
  getProfitAndLossByAxis: {
    params: ['businessName', 'ledger', 'fromDate', 'toDate', 'outerAxis', 'innerAxis'],
    run: (a, s) => {
      const nodes = reports.profitAndLossByAxis(inst(a, s), optionalDate(a.fromDate), optionalDate(a.toDate), a.outerAxis, a.innerAxis || 'Consolidated');
      const rows: Scalar[][] = [];
      for (const node of nodes) {
        rows.push([node.key, '', node.profitAndLoss.total_income_minor, node.profitAndLoss.total_expense_minor, node.profitAndLoss.net_income_minor]);
        for (const child of node.children) {
          rows.push([node.key, child.key, child.profitAndLoss.total_income_minor, child.profitAndLoss.total_expense_minor, child.profitAndLoss.net_income_minor]);
        }
      }
      return { header: ['outer', 'inner', 'total_income_minor', 'total_expense_minor', 'net_income_minor'], rows };
    },
  },
  getInventoryListing: {
    params: ['businessName', 'ledger'],
    run: (a, s) => ({
      header: ['location', 'item', 'quantity_on_hand'],
      rows: reports.inventoryListing(inst(a, s)).flatMap((g) => g.rows.map((r) => [g.location, r.item, r.quantity_on_hand])),
    }),
  },
  getUserRoles: { params: ['username'], run: (a, s) => ({ header: ['role'], rows: ops.userRoles(inst(a, s), a.username).map((r) => [r]) }) },
  getRecipeLines: {
    params: ['name', 'businessName', 'ledger'],
    run: (a, s) => {
      const i = inst(a, s);
      const owner = ops.recipeOwner(i, a.name);
      if (!owner) throw new NotFound(`Nothing named "${a.name}" carries a recipe.`);
      return {
        header: ['component', 'kind', 'quantity', 'unit', 'price_minor', 'duration_hours', 'scheduled_start', 'scheduled_end'],
        rows: ops.getLines(i, owner).map((l) => [l.component, l.kind, l.quantity, l.unit, l.priceMinor, l.durationHours, l.scheduledStart, l.scheduledEnd]),
      };
    },
  },
  getProject: {
    params: ['projectName'],
    run: (a, s) => {
      const i = inst(a, s);
      const margin = ops.projectMargin(i, a.projectName);
      return { row: [ops.scheduleRisk(i, a.projectName) ?? '', margin.quotedTotalMinor, margin.actualCostMinor, margin.marginMinor] };
    },
  },
  getEntry: {
    params: ['reference', 'businessName', 'ledger'],
    run: (a, s) => {
      const i = inst(a, s);
      const entry = i.entry(a.reference);
      if (!entry) throw new NotFound(`No entry named "${a.reference}".`);
      return { row: [i.store.entryDate(entry.id), i.core.value(entry.id, 'Status') ?? '', i.core.related(entry.id, 'Counterparty')?.name ?? ''] };
    },
  },
  getItemSource: {
    params: ['businessName', 'itemName', 'providerName'],
    run: (a, s) => {
      const source = ops.itemSource(inst(a, s), a.itemName, a.providerName);
      if (!source) throw new NotFound(`"${a.providerName}" is not a source of "${a.itemName}".`);
      return { row: [source.priceMinor, source.packageQuantity] };
    },
  },
  getGroup: { params: ['businessName', 'thingName', 'groupingName'], run: (a, s) => ({ row: [ops.groupOf(inst(a, s), a.thingName, a.groupingName) ?? ''] }) },
  getTranslation: {
    params: ['concept', 'language'],
    run: (a, s) => {
      const i = inst(a, s);
      const word = i.lookup('Vocabulary', a.concept);
      return { row: [(word && i.core.value(word.node.id, `Translation: ${a.language}`)) ?? ''] };
    },
  },
};

function text(value: Scalar): string {
  return value === undefined ? '' : String(value);
}

function failure(status: number, message: string): CoreReply {
  return { status, body: 'error,' + csvField(message) };
}

/** Serves one request of the protocol: the request body in, the reply out. */
export function callCore(body: string, token?: string): CoreReply {
  const first = body.split('\n').find((l) => l.length > 0) ?? '';
  const parts = splitCsvLine(first).map(unescapeAscii);
  const name = parts[0];
  if (!name) return failure(400, 'Request body must be at least one CSV line: functionName,value1,value2,...');
  const call = CORE_CALLS[name];
  if (!call) return failure(404, `No function named "${name}".`);
  const session = token ? sessions.get(token) : undefined;
  if (!call.open && !session) return failure(401, 'Not signed in.');

  const args: Args = {};
  call.params.forEach((param, n) => {
    args[param] = parts[n + 1] ?? '';
  });
  try {
    const result = call.run(args, session ?? { user: '', business: GLOBAL_BUSINESS, ledger: 'Actual' }, token ?? '') as Result;
    if (result && 'row' in result) return { status: 200, body: ['ok', ...result.row.map((v) => csvField(text(v)))].join(',') };
    if (result && 'header' in result) {
      const rows = result.rows.map((r) => Object.fromEntries(result.header.map((h, n) => [h, text(r[n])])));
      return { status: 200, body: 'ok\n' + writeCsv(rows, result.header) };
    }
    return { status: 200, body: 'ok' };
  } catch (err) {
    if (err instanceof Unauthorised) return failure(401, err.message);
    if (err instanceof NotFound) return failure(404, err.message);
    if (err instanceof Refused) return failure(400, err.message);
    console.error(err);
    return failure(500, err instanceof Error ? err.message : 'Internal error.');
  }
}
