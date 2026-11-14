// The screens of the application, served by the simplified core.
//
// Each entry takes a screen's named fields and calls the operations in
// ops.ts. The user, the business and the ledger are never arguments of an
// operation: they are the three globals of the instance the session is
// using. A screen that names a business or a ledger simply selects which
// instance serves it.
//
// The names match scripts/step-runner.ts's own registries, so the same
// fixtures drive either middleware.

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, rmSync } from 'fs';
import { Core, Instance, Refused, NotFound, GLOBAL_BUSINESS } from './core.js';
import * as ops from './ops.js';
import * as reports from './reports.js';
import { verifyPassword } from '../password.js';

type Args = Record<string, string>;

const here = dirname(fileURLToPath(import.meta.url));
export const CORE_DB_PATH = process.env.CORE_DB_PATH ?? join(here, '..', '..', 'data', 'core.sqlite');

let core: Core | undefined;
const instances = new Map<string, Instance>();

/** The session: who is signed in, and the business and ledger they chose.
 * These select the instance; they are never passed further. */
const session = { user: 'admin', business: GLOBAL_BUSINESS, ledger: 'Actual' };

export function openCore(path = CORE_DB_PATH): Core {
  if (!core) {
    mkdirSync(dirname(path), { recursive: true });
    core = new Core(path);
  }
  return core;
}

/** Closes the store and forgets the session. With `remove`, deletes the
 * database file too, so the next open starts from a fresh installation. */
export function resetCore(remove = false, path = CORE_DB_PATH): void {
  core?.close();
  core = undefined;
  instances.clear();
  session.user = 'admin';
  session.business = GLOBAL_BUSINESS;
  session.ledger = 'Actual';
  staged.clear();
  if (remove) for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true });
}

/** The legacy fixtures sign in to a business called "admin": the Global
 * Business under its former name. */
function businessName(name: string): string {
  return name === 'admin' ? GLOBAL_BUSINESS : name;
}

function instance(business: string, ledger: string): Instance {
  const key = `${session.user}\u0000${business}\u0000${ledger}`;
  let inst = instances.get(key);
  if (!inst) {
    inst = openCore().open(session.user, business, ledger);
    instances.set(key, inst);
  }
  return inst;
}

/** The instance a screen is served by: the business and ledger it names,
 * else the session's. */
function inst(a: Args): Instance {
  const business = a.businessName ? businessName(a.businessName) : session.business;
  const ledger = a.ledger || (business === session.business ? session.ledger : 'Actual');
  return instance(business, ledger);
}

function global(): Instance {
  return instance(GLOBAL_BUSINESS, 'Actual');
}

/** Sign-in, choosing a business, and switching business or ledger. */
export function coreSessionStep(screenName: string, a: Args): void {
  if (screenName === 'Login') {
    const user = openCore().open(a.username, GLOBAL_BUSINESS).user;
    const hash = openCore().value(user.id, 'Password Hash');
    if (!hash || !verifyPassword(a.password, hash)) throw new Refused('Wrong username or password.');
    session.user = a.username;
    session.business = GLOBAL_BUSINESS;
    session.ledger = 'Actual';
  } else if (screenName === 'Select Business' || screenName === 'Switch Session') {
    const business = businessName(a.businessName);
    const ledger = a.ledger || 'Actual';
    instance(business, ledger);
    session.business = business;
    session.ledger = ledger;
  }
}

// --- journal entries typed by hand --------------------------------------------
//
// Lines typed one at a time are held here until the entry is posted. This
// is working memory, not a record: an entry exists only once it is posted.

const staged = new Map<string, { account: string; amount: number }[]>();

function stageKey(i: Instance, reference: string): string {
  return `${i.ledger.id}\u0000${reference}`;
}

function stageLine(a: Args): void {
  const i = inst(a);
  i.accountNamed(a.account);
  const key = stageKey(i, a.reference);
  staged.set(key, [...(staged.get(key) ?? []).filter((l) => l.account !== a.account), { account: a.account, amount: Number(a.amountMinor) }]);
}

function postStaged(a: Args): void {
  const i = inst(a);
  const key = stageKey(i, a.reference);
  const lines = staged.get(key);
  if (!lines || lines.length === 0) throw new NotFound(`Nothing staged for "${a.reference}".`);
  i.store.tx(() => i.post(a.reference, lines.map((l) => ({ account: i.accountNamed(l.account).id, amount: l.amount }))));
  staged.delete(key);
}

function list(text: string | undefined): string[] {
  return (text ?? '').split(',').map((r) => r.trim()).filter(Boolean);
}

function ensureCategory(i: Instance, grouping: string, value: string): void {
  i.store.tx(() => i.groupValue(grouping, value));
}

function sale(a: Args): void {
  ops.sell(inst(a), { item: a.itemName, location: a.locationName, quantity: Number(a.quantity), unitMinor: Number(a.unitPriceMinor) });
}

const CHARTS: Record<string, string> = { 'English / generic': 'English CoA' };

export const CORE_API_REGISTRY: Record<string, (a: Args) => unknown> = {
  createBusiness: (a) =>
    ops.createBusiness(global(), {
      name: a.businessName,
      financialYear: a.financialYearLabel,
      businessType: a.businessType,
      homeCurrency: a.homeCurrency,
      chartOfAccounts: a.coaPrototype ? (CHARTS[a.coaPrototype] ?? a.coaPrototype) : 'English CoA',
      secondaryCurrencies: a.secondaryCurrencies,
    }),
  nominateBankAccountSimple: (a) => ops.nominateBankAccount(inst(a), a.bankAccountName, a.routingDetail, a.accountNumber),
  buildBankCurrencyStructureSimple: (a) => ops.buildBankCurrencyStructure(inst(a), a.bankAccountName, a.currency),

  createAndConfigureLocation: (a) =>
    ops.createLocation(inst(a), {
      name: a.locationName,
      city: a.city,
      locationType: a.locationType,
      bottleCapacity: a.bottleCapacity,
      cartonCapacity: a.cartonCapacity,
      timezone: 'Australia/Adelaide',
      division: a.division,
    }),
  createEmployeeAt: (a) => ops.createEmployee(inst(a), a.employeeName, a.locationName),
  createProviderSimple: (a) => ops.createContact(inst(a), a.providerName, 'Provider'),
  createCustomerSimple: (a) => ops.createContact(inst(a), a.customerName, 'Customer'),
  setEmployeeWageSimple: (a) => {
    const i = inst(a);
    i.relate(i.contact(a.employeeName).id, 'Wage Per Hour', a.wageMinorPerHour);
  },
  createPlantItemSimple: (a) => ops.createPlant(inst(a), a.name, Number(a.hourlyRateMinor), a.ownedOrHired, a.hireVendor),
  ensureSkillSimple: (a) => ops.ensureSkill(inst(a), a.skillName),
  tagSkillSimple: (a) => ops.tagSkill(inst(a), a.contactName, a.skillName, Number(a.rateMinorPerHour)),

  createUncategorizedItem: (a) => ops.createItem(inst(a), a.itemName),
  createItemUnderCategory: (a) => {
    const i = inst(a);
    i.store.tx(() => {
      ops.createItem(i, a.itemName);
      ops.setGroup(i, a.itemName, 'Category', a.category);
    });
  },
  createItemAndCategory: (a) => {
    const i = inst(a);
    i.store.tx(() => {
      ops.createItem(i, a.itemName);
      ops.setGroup(i, a.itemName, 'Category', a.category === '+ New category…' ? a.newCategoryName : a.category);
    });
  },
  createCategorySimple: (a) => ensureCategory(inst(a), 'Category', a.categoryName),
  addTopLevelCategoryViaStructurePopup: (a) => ensureCategory(inst(a), 'Category', a.categoryName),
  addDivisionViaStructurePopup: (a) => ensureCategory(inst(a), 'Division', a.valueName),
  createHierarchyGroupingSimple: (a) => {
    const i = inst(a);
    i.store.tx(() => i.grouping(a.groupingName));
  },
  createHierarchyValueSimple: (a) => ensureCategory(inst(a), a.groupingName, a.valueName),
  tagItemHierarchy: (a) => ops.setGroup(inst(a), a.itemName, a.groupingName, a.valueName),
  setHierarchyTagSimple: (a) => ops.setGroup(inst(a), a.locationName, 'Division', a.division),
  addDepartmentViaStructurePopup: (a) => ops.createDepartment(inst(a), a.departmentName),
  deleteDepartmentViaStructurePopup: (a) => ops.deleteDepartment(inst(a), a.departmentName),
  assignEmployeeDepartmentViaStructurePopup: (a) => ops.setEmployeeDepartment(inst(a), a.employeeName, a.departmentName),
  setEmployeeManagerViaStructurePopup: (a) => ops.setEmployeeManager(inst(a), a.employeeName, a.managerName),
  renameEntitySimple: (a) => ops.renameByName(inst(a), a.oldName, a.newName, a.parentName || undefined),
  createEntitySimple: (a) => {
    const i = inst(a);
    i.store.tx(() => i.core.thing(a.name, i.branch(a.parent || 'Vocabulary').id, 'Word', i.id));
  },
  setTranslationSimple: (a) => {
    const i = inst(a);
    i.store.tx(() => i.relate(i.localise('Vocabulary', a.concept, 'Word').id, `Translation: ${a.language}`, a.translationText));
  },

  stageJournalLine: stageLine,
  postJournalEntrySimple: postStaged,

  ensureItemInventoryAccountSimple: (a) => {
    const i = inst(a);
    i.store.tx(() => i.productAccount('Inventory', { item: i.item(a.itemName) }));
  },
  setItemCostAndPackSize: (a) => ops.setItemSource(inst(a), a.itemName, a.providerName, Number(a.unitCostMinor), Number(a.packageQuantity)),
  createPurchaseOrderInCartons: (a) => {
    const i = inst(a);
    const pack = ops.itemSource(i, a.itemName, a.providerName)?.packageQuantity ?? 1;
    const cartons = Number(a.cartons);
    ops.placePurchaseOrder(i, a.reference, a.providerName, a.itemName, cartons * pack, cartons * Number(a.pricePerCartonMinor));
  },
  stagePurchaseOrderSimple: (a) => {
    staged.set(`order\u0000${a.reference}`, [{ account: JSON.stringify(a), amount: 0 }]);
  },
  postPurchaseOrderSimple: (a) => {
    const held = staged.get(`order\u0000${a.reference}`);
    if (!held) throw new NotFound(`Nothing staged for purchase order "${a.reference}".`);
    const order = JSON.parse(held[0].account) as Args;
    ops.placePurchaseOrder(inst(a), a.reference, order.vendor, order.item, Number(order.quantity), Number(order.quantity) * Number(order.priceMinor));
    staged.delete(`order\u0000${a.reference}`);
  },
  cashPurchaseSimple: (a) =>
    ops.purchase(inst(a), { item: a.itemName, location: a.locationName, quantity: Number(a.quantity), unitMinor: Number(a.unitCostMinor) }),
  cashSaleSimple: sale,
  posSaleSimple: sale,
  posSaleInLedgerSimple: sale,
  transferItemsSimple: (a) =>
    ops.transferStock(inst(a), a.reference || `TRANSFER-${a.itemName}`, a.itemName, a.fromLocationName, a.toLocationName, Number(a.quantity)),
  receiveStockQuantitySimple: (a) => ops.receiveStock(inst(a), a.reference, a.itemName, a.locationName, Number(a.quantity), a.transdate),
  dispatchStockQuantitySimple: (a) => ops.dispatchStock(inst(a), a.reference, a.itemName, a.locationName, Number(a.quantity), a.transdate),
  receiveStockWithCombination: (a) => {
    const i = inst(a);
    i.store.tx(() => {
      const value = i.groupValue(a.groupingName, a.storageValue);
      const reference = i.freeReference(`RECEIVE-${a.itemName}-${a.storageValue}`);
      ops.receiveStock(i, reference, a.itemName, a.locationName, Number(a.quantity), undefined, { [a.groupingName]: value });
    });
  },
  openContainer: (a) => {
    const i = inst(a);
    i.store.tx(() => {
      i.groupValue('Container', a.containerValue);
      i.groupValue('Container', a.unitValue);
      ops.openContainer(i, a.locationName, a.itemName, Number(a.cartonsOpened), Number(a.unitsProduced));
    });
  },

  setBomComponentSimple: (a) => {
    const i = inst(a);
    i.item(a.componentItem);
    ops.setLine(i, i.item(a.assemblyItem), { component: a.componentItem, kind: 'Material', quantity: Number(a.quantity), unit: a.unit });
  },
  createPrototypeSimple: (a) => ops.createPrototype(inst(a), a.prototypeName),
  addPrototypeLineSimple: (a) => {
    const i = inst(a);
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
  updatePrototypeLineSimple: (a) => {
    const i = inst(a);
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
  instantiateProjectProposalSimple: (a) =>
    ops.instantiateProposal(inst(a), a.prototypeName, a.reference, a.client, a.headerItem, a.transdate, a.targetCompletionDate),
  acceptProjectProposalSimple: (a) => ops.acceptProposal(inst(a), a.reference, a.projectName, a.targetCompletionDate),
  clockInToProjectSimple: (a) => ops.clockInToProject(inst(a), a.employeeName, a.projectExpenseAccount),
  clockOutOfProjectSimple: (a) => ops.clockOutOfProject(inst(a), a.employeeName),
  clockPlantInSimple: (a) => ops.clockPlantIn(inst(a), a.plantName, a.projectExpenseAccount),
  clockPlantOutSimple: (a) => ops.clockPlantOut(inst(a), a.plantName),

  closeBooksSimple: (a) => ops.closeBooks(inst(a), a.asOfDate, a.retainedEarningsAccount),
  createLedgerSimple: (a) => ops.createLedger(instance(businessName(a.businessName), 'Actual'), a.ledger),
  rolloverToNewPeriodSimple: (a) => ops.rollover(instance(businessName(a.businessName), a.oldLedger), a.newLedger, a.asOfDate),

  createUserSimple: (a) => ops.createUser(inst(a), a.username, a.password, list(a.roles)),
  setUserRolesSimple: (a) => ops.setUserRoles(inst(a), a.username, list(a.roles)),
};

// Figures recorded by one step for a later step to compare against.
const recordedTrialBalanceTotals = new Map<string, number>();
const recordedNetIncome = new Map<string, number>();
const tbKey = (a: Args) => `${a.businessName}::${a.ledger}::${a.asOfDate ?? ''}`;
const plKey = (a: Args) => `${a.businessName}::${a.ledger}::${a.fromDate ?? ''}::${a.toDate ?? ''}`;

const pl = (a: Args) => reports.profitAndLoss(inst(a), a.fromDate || undefined, a.toDate || undefined);
const tb = (a: Args) => reports.trialBalance(inst(a), a.asOfDate || undefined);
const axis = (a: Args, outer: string, inner: string) =>
  reports.profitAndLossByAxis(inst(a), a.fromDate || undefined, a.toDate || undefined, outer, inner);

function exists(read: () => unknown): boolean {
  try {
    return !!read();
  } catch (err) {
    if (err instanceof NotFound) return false;
    throw err;
  }
}

export const CORE_VERIFY_REGISTRY: Record<string, (a: Args) => boolean> = {
  business_exists: (a) => exists(() => openCore().business(a.businessName)),
  location_exists: (a) => exists(() => inst(a).location(a.locationName)),
  cash_at_bank_exists: (a) => {
    const i = inst(a);
    return !!i.core.findNamed(i.accountsRoot().id, 'Cash at Bank', 'Account');
  },
  transfer_landed: (a) =>
    reports.inventoryListing(inst(a)).some((g) => g.location === a.toLocationName && g.rows.some((r) => r.item === a.itemName && r.quantity_on_hand > 0)),
  purchase_order_posted: (a) => {
    const entry = inst(a).entry(a.reference);
    return !!entry && inst(a).core.value(entry.id, 'Status') === 'placed';
  },
  item_source_registered: (a) => ops.itemSource(inst(a), a.itemName, a.providerName) !== undefined,
  bom_components_recorded: (a) => {
    const i = inst(a);
    const owner = ops.recipeOwner(i, a.assemblyItem);
    return !!owner && ops.getLines(i, owner).length === Number(a.expectedCount);
  },
  stock_on_hand_nonnegative: (a) => reports.inventoryListing(inst(a)).every((g) => g.rows.every((r) => r.quantity_on_hand >= 0)),
  schedule_risk_absent: (a) => ops.scheduleRisk(inst(a), a.projectName) === undefined,
  schedule_risk_flagged: (a) => ops.scheduleRisk(inst(a), a.projectName) !== undefined,
  project_margin_sign: (a) => {
    const margin = ops.projectMargin(inst(a), a.projectName).marginMinor;
    return a.expectedSign === 'positive' ? margin > 0 : margin < 0;
  },
  prototype_line_updated: (a) => {
    const i = inst(a);
    const line = ops.getLines(i, i.require('Prototypes', a.prototypeName, 'prototype')).find((l) => l.component === a.component);
    return !!line && line.priceMinor === Number(a.expectedPriceMinor);
  },
  trial_balance_balanced: (a) => {
    const t = tb(a);
    return t.total_debit_minor === t.total_credit_minor && t.total_debit_minor > 0;
  },
  balance_sheet_balanced: (a) => {
    const bs = reports.balanceSheet(inst(a), a.asOfDate || undefined);
    return bs.balanced && bs.total_assets_minor > 0;
  },
  record_trial_balance_total: (a) => {
    recordedTrialBalanceTotals.set(tbKey(a), tb(a).total_debit_minor);
    return true;
  },
  trial_balance_total_matches_recorded: (a) => recordedTrialBalanceTotals.get(tbKey(a)) === tb(a).total_debit_minor,
  profit_and_loss_positive: (a) => pl(a).net_income_minor > 0,
  profit_and_loss_zero: (a) => pl(a).net_income_minor === 0 && pl(a).total_income_minor === 0,
  record_profit_and_loss_net_income: (a) => {
    recordedNetIncome.set(plKey(a), pl(a).net_income_minor);
    return true;
  },
  profit_and_loss_net_income_matches_recorded: (a) => recordedNetIncome.get(plKey(a)) === pl(a).net_income_minor,
  profit_and_loss_by_item_single_row: (a) => {
    const nodes = axis(a, 'Item', 'Consolidated');
    const itemNode = nodes.find((n) => n.key === a.itemName);
    const summed = nodes.reduce((sum, n) => sum + n.profitAndLoss.net_income_minor, 0);
    return !!itemNode && itemNode.profitAndLoss.net_income_minor > 0 && summed === pl(a).net_income_minor;
  },
  profit_and_loss_by_category_detailed: (a) => {
    const categoryNode = axis(a, 'Category', 'Item').find((n) => n.key === a.categoryName);
    return !!categoryNode && categoryNode.children.some((c) => c.key === a.itemName);
  },
  profit_and_loss_by_division_consolidated: (a) => {
    const nodes = axis(a, 'Division', 'Consolidated');
    const total = pl(a).net_income_minor;
    const divisionNode = nodes.find((n) => n.key === a.divisionName);
    const summed = nodes.reduce((sum, n) => sum + n.profitAndLoss.net_income_minor, 0);
    return !!divisionNode && divisionNode.profitAndLoss.net_income_minor === total && summed === total;
  },
  user_has_exact_roles: (a) => {
    const expected = list(a.roles).sort();
    const actual = ops.userRoles(inst(a), a.username).sort();
    return expected.length === actual.length && expected.every((r, n) => r === actual[n]);
  },
  translation_matches: (a) => {
    const i = inst(a);
    const word = i.lookup('Vocabulary', a.concept);
    return !!word && i.core.value(word.node.id, `Translation: ${a.language}`) === a.translationText;
  },
  entity_named_exists: (a) => {
    const i = inst(a);
    return !!i.anything(a.name) || !!i.lookup('Vocabulary', a.name);
  },
  location_in_hierarchy_group: (a) => ops.groupOf(inst(a), a.locationName, 'Division') === a.division,
};
