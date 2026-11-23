// What the business does, written only in terms of the four calls
// (create, relate, copy, post) and the lookups of core.ts.
//
// Configuration operations record things and their relations. Each
// transaction posts one entry: one event, however many lines, with money
// and every quantity unit each adding up to zero on their own.
//
// Almost everything is optional. A cash sale needs an item and an amount;
// the lines for stock, cost and storage capacity are added only when the
// business has given the system something to add them from.

import { Instance, Refused, NotFound, GLOBAL_BUSINESS, today, type Product, type Target } from './core.js';
import type { Node, Line } from './store.js';
import { hashPassword } from '../password.js';

let sequence = 0;
/** A reference for an event the user did not name. */
function generated(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}`;
}

function optional(text: string | undefined): string | undefined {
  return text === undefined || text === '' ? undefined : text;
}

// --- businesses, users and roles --------------------------------------------

export interface NewBusiness {
  name: string;
  financialYear?: string;
  businessType?: string;
  homeCurrency?: string;
  chartOfAccounts?: string;
  secondaryCurrencies?: string;
}

/** Only the Global Business creates a business. Nothing is copied into the
 * new one: it gets a name, its `Actual` ledger and its first user, who is
 * the user creating it. Its accounts appear as they are first posted to. */
export function createBusiness(inst: Instance, input: NewBusiness): Node {
  if (!inst.isGlobal) throw new Refused('A business can only be created from the Global Business.');
  return inst.store.tx(() => {
    const core = inst.core;
    const businesses = core.at(['Businesses']);
    if (inst.store.child(businesses.id, input.name)) throw new Refused(`A business named "${input.name}" already exists.`);
    const business = core.thing(input.name, businesses.id, 'Business', inst.id);
    const facts: Record<string, string | undefined> = {
      'Financial Year': input.financialYear,
      'Business Type': input.businessType,
      'Home Currency': input.homeCurrency,
      'Chart of Accounts': input.chartOfAccounts,
      'Secondary Currencies': input.secondaryCurrencies,
    };
    for (const [relation, value] of Object.entries(facts)) if (optional(value)) core.relate(business.id, relation, value!, inst.id);
    core.thing('Actual', core.ensure('Ledgers', business.id, inst.id).id, 'Ledger', inst.id);

    const user = core.thing(inst.user.name, core.ensure('Users', business.id, inst.id).id, 'User', inst.id);
    const hash = core.value(inst.user.id, 'Password Hash');
    if (hash) core.relate(user.id, 'Password Hash', hash, inst.id);
    const owner = core.open(inst.user.name, input.name);
    setUserRoles(owner, inst.user.name, ['Administrator']);
    return business;
  });
}

function usersFolder(inst: Instance): Node {
  return inst.branch('Users');
}

export function createUser(inst: Instance, username: string, password: string, roles: string[]): Node {
  return inst.store.tx(() => {
    if (inst.store.child(usersFolder(inst).id, username)) throw new Refused(`A user named "${username}" already exists.`);
    const user = inst.core.thing(username, usersFolder(inst).id, 'User', inst.id);
    inst.core.relate(user.id, 'Password Hash', hashPassword(password), inst.id);
    setUserRoles(inst, username, roles);
    return user;
  });
}

const ROLE_PREFIX = 'Role: ';

export function userRoles(inst: Instance, username: string): string[] {
  const user = inst.require('Users', username, 'user');
  return inst.store
    .children(user.id)
    .filter((c) => c.name.startsWith(ROLE_PREFIX) && c.relation !== null)
    .map((c) => c.name.slice(ROLE_PREFIX.length));
}

/** A user holds exactly the roles named. Each role is the business's own
 * instance of a global prototype role, made the first time it is given. */
export function setUserRoles(inst: Instance, username: string, roles: string[]): void {
  inst.store.tx(() => {
    const user = inst.require('Users', username, 'user');
    for (const held of userRoles(inst, username)) {
      if (!roles.includes(held)) inst.core.relate(user.id, ROLE_PREFIX + held, null, inst.id);
    }
    for (const role of roles) inst.core.relate(user.id, ROLE_PREFIX + role, inst.localise('Roles', role, 'Role').id, inst.id);
  });
}

// --- banking ----------------------------------------------------------------

export function nominateBankAccount(inst: Instance, name: string, routingDetail: string, accountNumber: string): Node {
  return inst.store.tx(() => {
    const bank = inst.thingIn('Bank Accounts', name, 'Bank Account');
    inst.core.relate(bank.id, 'Routing Detail', routingDetail, inst.id);
    inst.core.relate(bank.id, 'Account Number', accountNumber, inst.id);
    return bank;
  });
}

/** `Cash at Bank`, with one account beneath it for each nominated bank
 * account and currency. */
export function buildBankCurrencyStructure(inst: Instance, bankAccountName: string, currency: string): Node {
  return inst.store.tx(() => {
    const bank = inst.require('Bank Accounts', bankAccountName, 'bank account');
    const asset = inst.chartAccount('Asset');
    const cashAtBank = inst.core.thing('Cash at Bank', asset.id, 'Account', inst.id);
    const account = inst.core.thing(`${bankAccountName} (${currency})`, cashAtBank.id, 'Account', inst.id);
    inst.core.relate(account.id, 'Bank Account', bank.id, inst.id);
    const home = inst.core.value(inst.business.id, 'Home Currency');
    if (home && currency !== home) inst.core.relate(account.id, 'Unit', currency, inst.id);
    return account;
  });
}

// --- locations, items, contacts, plant, skills ----------------------------------

export interface NewLocation {
  name: string;
  city?: string;
  locationType?: string;
  bottleCapacity?: string;
  cartonCapacity?: string;
  timezone?: string;
}

export function createLocation(inst: Instance, input: NewLocation): Node {
  return inst.store.tx(() => {
    const location = inst.thingIn('Locations', input.name, 'Location');
    const facts: Record<string, string | undefined> = {
      City: input.city,
      Timezone: input.timezone,
      'Bottle Capacity': input.bottleCapacity,
      'Carton Capacity': input.cartonCapacity,
    };
    for (const [relation, value] of Object.entries(facts)) if (optional(value)) inst.core.relate(location.id, relation, value!, inst.id);
    if (optional(input.locationType)) {
      inst.core.relate(location.id, 'Location Type', inst.localise('Location Types', input.locationType!, 'Location Type').id, inst.id);
    }
    return location;
  });
}

export function createItem(inst: Instance, name: string, storable = true): Node {
  return inst.store.tx(() => {
    const item = inst.thingIn('Items', name, 'Item');
    if (!storable) inst.core.relate(item.id, 'Storable', 'no', inst.id);
    return item;
  });
}

export function isStorable(inst: Instance, item: Node): boolean {
  return inst.core.value(item.id, 'Storable') !== 'no';
}

/** A service item such as Labour or Plant Hire, made the first time the
 * business needs it. */
function serviceItem(inst: Instance, name: string): Node {
  const existing = inst.existing('Items', name);
  if (existing) return existing;
  const item = createItem(inst, name, false);
  inst.core.relate(item.id, 'Unit Of Measure', 'HOUR', inst.id);
  return item;
}

export function createContact(inst: Instance, name: string, type: string): Node {
  return inst.store.tx(() => {
    const contact = inst.thingIn('Contacts', name, 'Contact');
    inst.core.relate(contact.id, 'Contact Type', inst.localise('Contact Types', type, 'Contact Type').id, inst.id);
    return contact;
  });
}

export function createEmployee(inst: Instance, name: string, locationName?: string): Node {
  return inst.store.tx(() => {
    const employee = createContact(inst, name, 'Employee');
    if (optional(locationName)) inst.core.relate(employee.id, 'Place of Employment', inst.location(locationName!).id, inst.id);
    return employee;
  });
}

export function setEmployeeManager(inst: Instance, employeeName: string, managerName: string): void {
  inst.store.tx(() => {
    const employee = inst.contact(employeeName);
    const manager = inst.contact(managerName);
    for (let at: Node | undefined = manager; at; at = inst.core.related(at.id, 'Manager')) {
      if (at.id === employee.id) throw new Refused(`"${managerName}" already reports, directly or not, to "${employeeName}".`);
    }
    inst.core.relate(employee.id, 'Manager', manager.id, inst.id);
  });
}

export function createPlant(inst: Instance, name: string, hourlyRateMinor: number, ownedOrHired: string, hireVendor?: string): Node {
  return inst.store.tx(() => {
    const plant = inst.thingIn('Plant', name, 'Plant');
    inst.core.relate(plant.id, 'Hourly Rate', String(hourlyRateMinor), inst.id);
    inst.core.relate(plant.id, 'Owned or Hired', ownedOrHired, inst.id);
    if (optional(hireVendor)) {
      const vendor = inst.existing('Contacts', hireVendor!) ?? createContact(inst, hireVendor!, 'Provider');
      inst.core.relate(plant.id, 'Hire Vendor', vendor.id, inst.id);
    }
    return plant;
  });
}

export function ensureSkill(inst: Instance, name: string): Node {
  return inst.store.tx(() => inst.thingIn('Skills', name, 'Skill'));
}

/** A contractor is a contact with skills. Each skill carries its own rate. */
export function tagSkill(inst: Instance, contactName: string, skillName: string, rateMinorPerHour: number): void {
  inst.store.tx(() => {
    const contact = inst.contact(contactName);
    const skill = inst.require('Skills', skillName, 'skill');
    const relation = `Skill: ${skillName}`;
    inst.core.relate(contact.id, relation, skill.id, inst.id);
    inst.core.relate(inst.store.child(contact.id, relation)!.id, 'Rate', String(rateMinorPerHour), inst.id);
  });
}

/** A provider's price and pack size for an item. */
export function setItemSource(inst: Instance, itemName: string, providerName: string, priceMinor: number, packageQuantity: number): void {
  inst.store.tx(() => {
    const item = inst.item(itemName);
    const provider = inst.contact(providerName);
    const relation = `Source: ${providerName}`;
    inst.core.relate(item.id, relation, provider.id, inst.id);
    const source = inst.store.child(item.id, relation)!;
    inst.core.relate(source.id, 'Price', String(priceMinor), inst.id);
    inst.core.relate(source.id, 'Package Quantity', String(packageQuantity), inst.id);
  });
}

export function itemSource(inst: Instance, itemName: string, providerName: string): { priceMinor: number; packageQuantity: number } | undefined {
  const item = inst.item(itemName);
  const source = inst.store.child(item.id, `Source: ${providerName}`);
  if (!source || source.relation === null) return undefined;
  return { priceMinor: inst.core.number(source.id, 'Price') ?? 0, packageQuantity: inst.core.number(source.id, 'Package Quantity') ?? 1 };
}

// --- hierarchy ----------------------------------------------------------------

/** Puts a thing in a group: one relation, named after the hierarchy. An
 * item goes only in an item hierarchy, a location only in a location
 * hierarchy (docs/pm-domain-reference.md). */
export function setGroup(inst: Instance, thingName: string, hierarchy: string, value: string): void {
  inst.store.tx(() => {
    const thing = inst.anything(thingName);
    if (!thing) throw new NotFound(`Nothing named "${thingName}" to put in ${hierarchy}.`);
    const kind = inst.hierarchyKind(hierarchy);
    const isLocation = inst.existing('Locations', thingName)?.id === thing.id;
    if (kind === 'Locations' && !isLocation) throw new Refused(`"${hierarchy}" is a hierarchy of locations; "${thingName}" is not one.`);
    if (kind === 'Items' && isLocation) throw new Refused(`"${hierarchy}" is a hierarchy of items; "${thingName}" is a location.`);
    inst.core.relate(thing.id, hierarchy, inst.valueOf(hierarchy, value).id, inst.id);
  });
}

export function groupOf(inst: Instance, thingName: string, hierarchy: string): string | undefined {
  const thing = inst.anything(thingName);
  return thing && inst.core.value(thing.id, hierarchy);
}

const DEPARTMENT_ACCOUNTS = ['Payroll', 'Other Expenses'];

function departmentFolder(inst: Instance): Node {
  return inst.core.thing('Departments', inst.chartAccount('Expense').id, 'Account', inst.id);
}

/** A department is a group, with its own Payroll and Other Expenses accounts. */
export function createDepartment(inst: Instance, name: string): Node {
  return inst.store.tx(() => {
    const value = inst.groupValue('Department', name);
    const accounts = inst.core.thing(name, departmentFolder(inst).id, 'Account', inst.id);
    inst.core.relate(accounts.id, 'Department', value.id, inst.id);
    for (const account of DEPARTMENT_ACCOUNTS) {
      const node = inst.core.thing(account, accounts.id, 'Account', inst.id);
      inst.core.relate(node.id, 'Department', value.id, inst.id);
    }
    return value;
  });
}

export function deleteDepartment(inst: Instance, name: string): void {
  inst.store.tx(() => {
    const hierarchy = inst.existing('Hierarchy', 'Department');
    const value = hierarchy && inst.core.things(hierarchy.id, 'Value').find((v) => v.name === name);
    if (!value) throw new NotFound(`No department named "${name}".`);
    const folder = inst.core.things(departmentFolder(inst).id, 'Account').find((a) => inst.core.related(a.id, 'Department')?.id === value.id);
    const accounts = folder ? [...inst.core.all(folder.id, 'Account'), folder] : [];
    for (const account of accounts) {
      if (inst.store.hasLines(account.id)) throw new Refused(`"${name}" has postings and cannot be deleted.`);
    }
    const assigned = inst.core.things(inst.branch('Contacts').id).some((c) => inst.core.related(c.id, 'Department')?.id === value.id);
    if (assigned) throw new Refused(`"${name}" still has employees and cannot be deleted.`);
    for (const node of [...accounts, value]) inst.core.relate(node.id, 'Retired', true, inst.id);
  });
}

export function setEmployeeDepartment(inst: Instance, employeeName: string, departmentName: string): void {
  inst.store.tx(() => {
    const hierarchy = inst.existing('Hierarchy', 'Department');
    const value = hierarchy && inst.core.things(hierarchy.id, 'Value').find((v) => v.name === departmentName);
    if (!value) throw new NotFound(`No department named "${departmentName}".`);
    inst.core.relate(inst.contact(employeeName).id, 'Department', value.id, inst.id);
  });
}

/** Renames a thing of the business, or an account of the ledger, by name.
 * With a parent name, only a thing directly under a thing of that name. */
export function renameByName(inst: Instance, oldName: string, newName: string, parentName?: string): void {
  inst.store.tx(() => {
    const candidates = [...inst.core.all(inst.accountsRoot().id)];
    for (const folder of inst.store.children(inst.business.id)) candidates.push(...inst.core.all(folder.id));
    const match = candidates.find((n) => n.name === oldName && (!parentName || (n.parent !== null && inst.store.get(n.parent).name === parentName)));
    if (!match) throw new NotFound(`Nothing named "${oldName}"${parentName ? ` under "${parentName}"` : ''}.`);
    inst.store.rename(match.id, newName, inst.id);
  });
}

// --- recipes: bills of materials, prototypes, proposals, projects ---------------

export interface RecipeLine {
  component: string;
  kind: string;
  quantity: number;
  unit: string;
  priceMinor?: number;
  durationHours?: number;
  scheduledStart?: string;
  scheduledEnd?: string;
}

const LINE_RELATIONS: [keyof RecipeLine, string][] = [
  ['kind', 'Line Kind'],
  ['quantity', 'Quantity'],
  ['unit', 'Unit'],
  ['priceMinor', 'Price'],
  ['durationHours', 'Duration Hours'],
  ['scheduledStart', 'Scheduled Start'],
  ['scheduledEnd', 'Scheduled End'],
];

/** Sets one line of a recipe. Only the fields given are changed. */
export function setLine(inst: Instance, owner: Node, line: Partial<RecipeLine> & { component: string }): void {
  inst.store.tx(() => {
    const lines = inst.core.ensure('Lines', owner.id, inst.id);
    const node = inst.core.thing(line.component, lines.id, 'Line', inst.id);
    for (const [field, relation] of LINE_RELATIONS) {
      const value = line[field];
      if (value !== undefined && value !== '') inst.core.relate(node.id, relation, String(value), inst.id);
    }
  });
}

export function getLines(inst: Instance, owner: Node): RecipeLine[] {
  const lines = inst.store.child(owner.id, 'Lines');
  if (!lines) return [];
  return inst.core.things(lines.id, 'Line').map((node) => ({
    component: node.name,
    kind: inst.core.value(node.id, 'Line Kind') ?? 'Material',
    quantity: inst.core.number(node.id, 'Quantity') ?? 0,
    unit: inst.core.value(node.id, 'Unit') ?? '',
    priceMinor: inst.core.number(node.id, 'Price'),
    durationHours: inst.core.number(node.id, 'Duration Hours'),
    scheduledStart: inst.core.value(node.id, 'Scheduled Start'),
    scheduledEnd: inst.core.value(node.id, 'Scheduled End'),
  }));
}

/** Whatever carries a recipe under this name: an item (its bill of
 * materials), a prototype, a project, or a proposal. */
export function recipeOwner(inst: Instance, name: string): Node | undefined {
  return inst.existing('Items', name) ?? inst.existing('Prototypes', name) ?? inst.existing('Projects', name) ?? (inst.isGlobal ? undefined : inst.entry(name));
}

export function createPrototype(inst: Instance, name: string): Node {
  return inst.store.tx(() => inst.thingIn('Prototypes', name, 'Prototype'));
}

function recipeTotal(lines: RecipeLine[]): number {
  return lines.reduce((sum, l) => sum + (l.priceMinor ?? 0), 0);
}

/** Orders are commitments. They post only to counter accounts that appear
 * on no statement, so placing one changes nothing the business reports. */
function orderLines(inst: Instance, side: 'Purchase' | 'Sales', item: Node, quantity: number, valueMinor: number): Line[] {
  const onOrder = side === 'Purchase' ? 'On Order' : 'Sales On Order';
  const ordered = side === 'Purchase' ? 'Ordered' : 'Sales Ordered';
  return [
    { account: inst.quantityAccount(onOrder, { item }).id, amount: quantity },
    { account: inst.quantityAccount(ordered, { item }).id, amount: -quantity },
    { account: inst.memoAccount(`${onOrder} Value`, { item }).id, amount: valueMinor },
    { account: inst.memoAccount(side === 'Purchase' ? 'Order Commitments' : 'Sales Commitments', { item }).id, amount: -valueMinor },
  ];
}

function reversed(lines: Line[]): Line[] {
  return lines.map((l) => ({ account: l.account, amount: -l.amount }));
}

/** A proposal to a client, instantiated from a prototype: a sales order for
 * the header item at the prototype's total, carrying a copy of its lines. */
export function instantiateProposal(
  inst: Instance,
  prototypeName: string,
  reference: string,
  clientName: string,
  headerItemName: string,
  date: string,
  targetCompletionDate?: string
): Node {
  return inst.store.tx(() => {
    const prototype = inst.require('Prototypes', prototypeName, 'prototype');
    const lines = getLines(inst, prototype);
    if (lines.length === 0) throw new Refused(`Prototype "${prototypeName}" has no lines to copy.`);
    const item = inst.item(headerItemName);
    const client = inst.contact(clientName);
    const total = recipeTotal(lines);
    const entry = inst.post(reference, orderLines(inst, 'Sales', item, 1, total), {
      date,
      relations: {
        Counterparty: client.id,
        Item: item.id,
        Status: 'draft',
        'Instance Of': prototype.id,
        Description: `Instantiated from prototype "${prototypeName}".`,
        ...(optional(targetCompletionDate) ? { 'Target Completion Date': targetCompletionDate! } : {}),
      },
    });
    inst.core.copy(inst.store.child(prototype.id, 'Lines')!.id, inst.core.ensure('Lines', entry.id, inst.id).id, inst.id);
    return entry;
  });
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.ceil(days));
  return d.toISOString().slice(0, 10);
}

function projects(inst: Instance): Node[] {
  return inst.core.things(inst.branch('Projects').id, 'Project');
}

/** The first window of the wanted length, at or after the wanted start, in
 * which the resource is booked by no other project. Never refuses: a
 * double-booking pushes the start out. */
function nextWindow(inst: Instance, resource: string, wantedStart: string, days: number, exclude: Node): { start: string; end: string } {
  const bookings: { start: string; end: string }[] = [];
  for (const project of projects(inst)) {
    if (project.id === exclude.id) continue;
    for (const line of getLines(inst, project)) {
      if (line.component === resource && (line.kind === 'Labour' || line.kind === 'Plant') && line.scheduledStart && line.scheduledEnd) {
        bookings.push({ start: line.scheduledStart, end: line.scheduledEnd });
      }
    }
  }
  bookings.sort((a, b) => a.start.localeCompare(b.start));
  let start = wantedStart;
  for (let moved = true; moved; ) {
    moved = false;
    const end = addDays(start, days);
    const clash = bookings.find((b) => start < b.end && b.start < end);
    if (clash) {
      start = clash.end;
      moved = true;
    }
  }
  return { start, end: addDays(start, days) };
}

/** Accepting a proposal is the sale: the client is invoiced the quoted
 * total and the order is released. If it carries lines and is given a
 * project name, the project is created with its own expense account and
 * milestone, and each labour and plant line is given a free window. */
export function acceptProposal(inst: Instance, reference: string, projectName?: string, targetCompletionDate?: string): void {
  inst.store.tx(() => {
    const proposal = inst.entry(reference);
    if (!proposal || inst.core.value(proposal.id, 'Status') === undefined) throw new NotFound(`No proposal named "${reference}".`);
    const status = inst.core.value(proposal.id, 'Status');
    if (status !== 'draft' && status !== 'sent') throw new Refused(`"${reference}" is ${status} and cannot be accepted.`);
    const client = inst.core.related(proposal.id, 'Counterparty')!;
    const item = inst.core.related(proposal.id, 'Item')!;
    const lines = getLines(inst, proposal);
    const total = recipeTotal(lines);
    const date = inst.store.entryDate(proposal.id)!;

    inst.core.relate(proposal.id, 'Status', 'accepted', inst.id);
    inst.post(
      `${reference}-ACCEPTED`,
      [
        { account: inst.contactAccount(client).id, amount: total },
        { account: inst.productAccount('Sales Revenue', { item }).id, amount: -total },
        ...reversed(inst.store.entryLines(proposal.id)),
      ],
      { date, relations: { Order: proposal.id, Counterparty: client.id } }
    );

    if (lines.length === 0 || !optional(projectName)) return;
    const target = optional(targetCompletionDate) ?? inst.core.value(proposal.id, 'Target Completion Date') ?? date;
    if (inst.existing('Projects', projectName!)) throw new Refused(`A project named "${projectName}" already exists.`);
    const project = inst.thingIn('Projects', projectName!, 'Project');
    inst.core.relate(project.id, 'Client', client.id, inst.id);
    inst.core.relate(project.id, 'Requested Start', date, inst.id);
    inst.core.relate(project.id, 'Target Completion Date', target, inst.id);
    inst.core.relate(project.id, 'Proposal', proposal.id, inst.id);

    const milestone = inst.core.thing(`${projectName} — Invoicing — ${target}`, project.id, 'Milestone', inst.id);
    inst.core.relate(milestone.id, 'Milestone Type', 'Invoicing', inst.id);
    inst.core.relate(milestone.id, 'Due Date', target, inst.id);

    const profitCenter = inst.groupValue('Profit Center', `${projectName} — Profit Center`);
    const expense = inst.core.thing(`${projectName} — Labour & Plant`, inst.chartAccount('Expense').id, 'Account', inst.id);
    inst.core.relate(expense.id, 'Profit Center', profitCenter.id, inst.id);
    inst.core.relate(project.id, 'Profit Center', profitCenter.id, inst.id);
    inst.core.relate(project.id, 'Project Expense Account', expense.id, inst.id);

    inst.core.copy(inst.store.child(proposal.id, 'Lines')!.id, inst.core.ensure('Lines', project.id, inst.id).id, inst.id);
    let completion = date;
    for (const line of getLines(inst, project)) {
      if ((line.kind !== 'Labour' && line.kind !== 'Plant') || !line.scheduledStart || line.durationHours === undefined) continue;
      const window = nextWindow(inst, line.component, line.scheduledStart, Math.max(1, Math.ceil(line.durationHours / 8)), project);
      setLine(inst, project, { component: line.component, scheduledStart: window.start, scheduledEnd: window.end });
      if (window.end > completion) completion = window.end;
    }
    if (completion > target) {
      const risk = `Completion now resolves to ${completion}, after the client's own ${target}: a resource was double-booked elsewhere.`;
      inst.core.relate(project.id, 'Schedule Risk', risk, inst.id);
      inst.core.relate(milestone.id, 'Schedule Risk', risk, inst.id);
    }
  });
}

export function scheduleRisk(inst: Instance, projectName: string): string | undefined {
  return inst.core.value(inst.require('Projects', projectName, 'project').id, 'Schedule Risk');
}

/** Quoted total against what the project's expense account has cost. */
export function projectMargin(inst: Instance, projectName: string): { quotedTotalMinor: number; actualCostMinor: number; marginMinor: number } {
  const project = inst.require('Projects', projectName, 'project');
  const quoted = recipeTotal(getLines(inst, project));
  const expense = inst.core.related(project.id, 'Project Expense Account');
  const actual = expense ? Math.abs(inst.balance(expense.id)) : 0;
  return { quotedTotalMinor: quoted, actualCostMinor: actual, marginMinor: quoted - actual };
}

// --- clocking on and off a project ---------------------------------------------

interface Clockable {
  node: Node;
  rate: number;
  serviceItem: string;
  /** The account credited with the cost at clock-off. */
  payee: () => Node;
}

function employeeClock(inst: Instance, name: string): Clockable {
  const node = inst.contact(name);
  const rate = inst.core.number(node.id, 'Wage Per Hour');
  if (rate === undefined) throw new Refused(`"${name}" has no hourly wage set and cannot clock on.`);
  return { node, rate, serviceItem: 'Labour', payee: () => inst.contactAccount(node) };
}

function plantClock(inst: Instance, name: string): Clockable {
  const node = inst.require('Plant', name, 'plant item');
  const rate = inst.core.number(node.id, 'Hourly Rate');
  if (rate === undefined) throw new Refused(`"${name}" has no hourly rate set and cannot clock on.`);
  const vendor = inst.core.related(node.id, 'Hire Vendor');
  return { node, rate, serviceItem: 'Plant Hire', payee: () => (vendor ? inst.contactAccount(vendor) : inst.accountNamed('Other Income')) };
}

/** Clocking on places an order for one hour of a service item at the
 * hourly rate. The open clock is that order, related from the resource. */
function clockOn(inst: Instance, clock: Clockable, projectExpenseAccount: string): Node {
  return inst.store.tx(() => {
    if (inst.core.related(clock.node.id, 'Open Clock')) throw new Refused(`"${clock.node.name}" is already clocked on.`);
    const expense = inst.accountNamed(projectExpenseAccount);
    const item = serviceItem(inst, clock.serviceItem);
    const order = inst.post(generated('CLOCK'), orderLines(inst, 'Purchase', item, 1, clock.rate), {
      relations: { Counterparty: clock.node.id, Item: item.id, 'Project Expense Account': expense.id, 'Clocked On At': new Date().toISOString() },
    });
    inst.core.relate(clock.node.id, 'Open Clock', order.id, inst.id);
    return order;
  });
}

/** Clocking off is a purchase on credit that delivers that order: the
 * hours worked at the rate, charged to the project's expense account. */
function clockOff(inst: Instance, clock: Clockable): void {
  inst.store.tx(() => {
    const order = inst.core.related(clock.node.id, 'Open Clock');
    if (!order) throw new Refused(`"${clock.node.name}" is not clocked on.`);
    const startedAt = inst.core.value(order.id, 'Clocked On At')!;
    const hours = (Date.now() - new Date(startedAt).getTime()) / 3_600_000;
    const cost = Math.round(hours * clock.rate);
    const expense = inst.core.related(order.id, 'Project Expense Account')!;
    inst.post(
      `${order.name}-RECEIPT`,
      [{ account: expense.id, amount: cost }, { account: clock.payee().id, amount: -cost }, ...reversed(inst.store.entryLines(order.id))],
      { relations: { Order: order.id, Counterparty: clock.node.id, Hours: hours.toFixed(4) } }
    );
    inst.core.relate(clock.node.id, 'Open Clock', null, inst.id);
  });
}

export const clockInToProject = (inst: Instance, employee: string, account: string) => clockOn(inst, employeeClock(inst, employee), account);
export const clockOutOfProject = (inst: Instance, employee: string) => clockOff(inst, employeeClock(inst, employee));
export const clockPlantIn = (inst: Instance, plant: string, account: string) => clockOn(inst, plantClock(inst, plant), account);
export const clockPlantOut = (inst: Instance, plant: string) => clockOff(inst, plantClock(inst, plant));

// --- stock, storage and trading ---------------------------------------------------
//
// A location is optional everywhere. A business that does not distinguish
// its places simply has accounts per item; one that uses neither items nor
// locations has one simple posting account under each header.

function product(inst: Instance, itemName: string, locationName?: string): { item: Node; location?: Node } {
  return { item: inst.item(itemName), location: optional(locationName) ? inst.location(locationName!) : undefined };
}

function onHand(inst: Instance, of: Product): number {
  const account = inst.existingQuantityAccount('On Hand', of);
  return account ? inst.balance(account.id) : 0;
}

const TIERS = { Bottle: 'Bottle Capacity', Carton: 'Carton Capacity' } as const;
type Tier = keyof typeof TIERS;

function capacityAccount(inst: Instance, group: 'Installed' | 'Remaining' | 'Occupied', location: Node, tier: Tier): Node {
  const tierValue = inst.groupValue('Storage Tier', tier);
  return inst.quantityAccount(`Capacity ${group}`, { location, extra: { 'Storage Tier': tierValue } }, `SPACE-${tier.toUpperCase()}`);
}

/** Lines recording a change in the space a location has in use. Only a
 * location that was given a capacity has any. The first use also records
 * the installed capacity. */
function capacityLines(inst: Instance, location: Node | undefined, tier: Tier, occupiedDelta: number): Line[] {
  if (!location) return [];
  const capacity = inst.core.number(location.id, TIERS[tier]);
  if (capacity === undefined || occupiedDelta === 0) return [];
  const installed = capacityAccount(inst, 'Installed', location, tier);
  const remaining = capacityAccount(inst, 'Remaining', location, tier);
  const occupied = capacityAccount(inst, 'Occupied', location, tier);
  const lines: Line[] = [];
  if (inst.balance(installed.id) === 0) {
    lines.push({ account: remaining.id, amount: capacity }, { account: installed.id, amount: -capacity });
  }
  lines.push({ account: occupied.id, amount: occupiedDelta }, { account: remaining.id, amount: -occupiedDelta });
  return lines;
}

function requireStorable(inst: Instance, item: Node, verb: string): void {
  if (!isStorable(inst, item)) throw new Refused(`"${item.name}" is a service item, not a stored item, and cannot be ${verb}.`);
}

function requirePositive(quantity: number): void {
  if (!(quantity > 0)) throw new Refused('The quantity must be positive.');
}

function requireOnHand(inst: Instance, of: Product, quantity: number, verb: string): void {
  const available = onHand(inst, of);
  if (quantity > available) {
    const where = of.location ? ` at "${of.location.name}"` : '';
    throw new Refused(`Only ${available} of "${of.item!.name}" on hand${where}: cannot ${verb} ${quantity}.`);
  }
}

function about(of: Product): Record<string, number> {
  return { ...(of.item ? { Item: of.item.id } : {}), ...(of.location ? { Location: of.location.id } : {}) };
}

/** Stock arrives: a quantity only, with no money. */
export function receiveStock(inst: Instance, reference: string, itemName: string, locationName: string | undefined, quantity: number, date?: string, extra?: Record<string, Node>): Node {
  return inst.store.tx(() => {
    const of = product(inst, itemName, locationName);
    requireStorable(inst, of.item, 'received');
    requirePositive(quantity);
    return inst.post(
      reference,
      [
        { account: inst.quantityAccount('On Hand', { ...of, extra }).id, amount: quantity },
        { account: inst.quantityAccount('Units Bought', { item: of.item }).id, amount: -quantity },
        ...capacityLines(inst, of.location, 'Bottle', quantity),
      ],
      { date: optional(date), relations: about(of) }
    );
  });
}

/** Stock leaves: a quantity only, with no money. */
export function dispatchStock(inst: Instance, reference: string, itemName: string, locationName: string | undefined, quantity: number, date?: string): Node {
  return inst.store.tx(() => {
    const of = product(inst, itemName, locationName);
    requireStorable(inst, of.item, 'dispatched');
    requirePositive(quantity);
    requireOnHand(inst, of, quantity, 'dispatch');
    return inst.post(
      reference,
      [
        { account: inst.quantityAccount('On Hand', of).id, amount: -quantity },
        { account: inst.quantityAccount('Units Sold', { item: of.item }).id, amount: quantity },
        ...capacityLines(inst, of.location, 'Bottle', -quantity),
      ],
      { date: optional(date), relations: about(of) }
    );
  });
}

/** A quantity of stock received together, and what is left of its cost. */
interface Layer {
  quantity: number;
  value: number;
}

/** Takes `quantity` from the oldest layers first and returns what was
 * taken, layer by layer. A part of a layer takes its share of what is left
 * of the layer's value, so the last unit of a layer carries any rounding. */
function take(layers: Layer[], quantity: number): Layer[] {
  const taken: Layer[] = [];
  let wanted = quantity;
  while (wanted > 0 && layers.length > 0) {
    const layer = layers[0];
    const units = Math.min(wanted, layer.quantity);
    const value = units === layer.quantity ? layer.value : Math.round((layer.value * units) / layer.quantity);
    taken.push({ quantity: units, value });
    layer.quantity -= units;
    layer.value -= value;
    wanted -= units;
    if (layer.quantity === 0) layers.shift();
  }
  return taken;
}

function valueOf(layers: Layer[]): number {
  return layers.reduce((total, layer) => total + layer.value, 0);
}

/** The stock of an item (at a location) still on hand, as the layers it
 * was received in, oldest first, each at the cost it was received at.
 * With `before`, as it stood just before that entry.
 *
 * Nothing is stored for this: the layers are read back from the journal.
 * Each entry that moves the item's On Hand quantity is one movement: a
 * quantity in, with the value posted to its Inventory account in the same
 * entry, is a new layer; a quantity out takes the oldest layers first. A
 * transfer in arrives as the very layers that left the other location.
 * Value posted with no quantity, or the part of a quantity out that a
 * quantity-only movement left behind, stays with the newest layer, so the
 * layers always add up to the Inventory account's balance. A year-end
 * stock take merges every layer into one, at their average cost. */
function stockLayers(inst: Instance, of: Product, before?: number): Layer[] {
  const quantityAccount = inst.existingQuantityAccount('On Hand', of);
  if (!quantityAccount) return [];
  const valueAccount = inst.existingProductAccount('Inventory', of);
  interface Movement extends Layer {
    entry: number;
    date: string;
    average: boolean;
  }
  const movements = new Map<number, Movement>();
  const movement = (entry: number, date: string) => {
    let found = movements.get(entry);
    if (!found) movements.set(entry, (found = { entry, date, quantity: 0, value: 0, average: false }));
    return found;
  };
  for (const line of inst.store.accountLines(valueAccount ? [quantityAccount.id, valueAccount.id] : [quantityAccount.id])) {
    const m = movement(line.entry, line.date);
    if (line.account === quantityAccount.id) m.quantity += line.amount;
    else m.value += line.amount;
  }
  for (const entry of inst.entriesMarked(YEAR_END_COUNT)) {
    if (inst.core.related(entry, 'Item')?.id !== of.item?.id || inst.core.related(entry, 'Location')?.id !== of.location?.id) continue;
    movement(entry, inst.store.entryDate(entry) ?? '').average = true;
  }
  const ordered = [...movements.values()].sort((a, b) => (a.date === b.date ? a.entry - b.entry : a.date < b.date ? -1 : 1));
  const layers: Layer[] = [];
  let unplaced = 0;
  const place = (value: number) => {
    if (layers.length > 0) layers[layers.length - 1].value += value;
    else unplaced += value;
  };
  for (const { entry, quantity, value, average } of ordered) {
    if (entry === before) break;
    if (quantity > 0) {
      const source = inst.core.related(entry, 'From Location');
      const arrived = source && source.id !== of.location?.id ? take(stockLayers(inst, { ...of, location: source }, entry), quantity) : [];
      const received = arrived.length > 0 ? arrived : [{ quantity, value: 0 }];
      received[0].value += unplaced + value - valueOf(arrived);
      unplaced = 0;
      layers.push(...received);
    } else if (quantity < 0) {
      place(valueOf(take(layers, -quantity)) + value);
    } else {
      place(value);
    }
    if (average && layers.length > 1) {
      const merged = { quantity: layers.reduce((t, l) => t + l.quantity, 0), value: valueOf(layers) };
      layers.splice(0, layers.length, merged);
    }
  }
  return layers;
}

/** The cost of a quantity of stock leaving, first in, first out: the cost
 * of the oldest stock received for that item (at that location). */
function costOf(inst: Instance, of: Product, quantity: number): number {
  return valueOf(take(stockLayers(inst, of), quantity));
}

/** The cost of stock found that the books did not hold: at the unit cost
 * of the most recent stock received, or nothing if none is held. */
function costOfFound(inst: Instance, of: Product, quantity: number): number {
  const newest = stockLayers(inst, of).at(-1);
  return newest && newest.quantity > 0 ? Math.round((newest.value * quantity) / newest.quantity) : 0;
}

export function transferStock(inst: Instance, reference: string, itemName: string, fromName: string, toName: string, quantity: number): Node {
  return inst.store.tx(() => {
    const item = inst.item(itemName);
    const from = inst.location(fromName);
    const to = inst.location(toName);
    requireStorable(inst, item, 'transferred');
    requirePositive(quantity);
    const fromCity = inst.core.value(from.id, 'City');
    const toCity = inst.core.value(to.id, 'City');
    if (fromCity && toCity && fromCity !== toCity) throw new Refused(`"${fromName}" and "${toName}" are in different cities.`);
    requireOnHand(inst, { item, location: from }, quantity, 'transfer');
    const cost = costOf(inst, { item, location: from }, quantity);
    const lines: Line[] = [
      { account: inst.quantityAccount('On Hand', { item, location: from }).id, amount: -quantity },
      { account: inst.quantityAccount('On Hand', { item, location: to }).id, amount: quantity },
      ...capacityLines(inst, from, 'Bottle', -quantity),
      ...capacityLines(inst, to, 'Bottle', quantity),
    ];
    if (cost > 0) {
      lines.push(
        { account: inst.productAccount('Inventory', { item, location: from }).id, amount: -cost },
        { account: inst.productAccount('Inventory', { item, location: to }).id, amount: cost }
      );
    }
    return inst.post(inst.freeReference(reference), lines, { relations: { Item: item.id, Location: to.id, 'From Location': from.id } });
  });
}

/** A purchase or a sale. Only the item, the quantity and the unit amount
 * are required. With no counterparty it is for cash; with no location the
 * business does not distinguish its places. */
export interface Trade {
  item: string;
  quantity: number;
  /** Unit cost for a purchase, unit price for a sale, in cents. */
  unitMinor: number;
  location?: string;
  /** The provider or customer. Left out, the trade is for cash. */
  counterparty?: string;
  taxMinor?: number;
  /** The reference of the order this delivers, if any. */
  order?: string;
  reference?: string;
  date?: string;
}

/** The lines releasing the delivered part of an order, and the relation
 * tying the delivery to it. */
function delivery(inst: Instance, side: 'Purchase' | 'Sales', trade: Trade, item: Node, valueMinor: number): { lines: Line[]; relations: Record<string, number> } {
  if (!optional(trade.order)) return { lines: [], relations: {} };
  const order = inst.entry(trade.order!);
  if (!order) throw new NotFound(`No order named "${trade.order}".`);
  return { lines: reversed(orderLines(inst, side, item, trade.quantity, valueMinor)), relations: { Order: order.id } };
}

export function purchase(inst: Instance, trade: Trade): Node {
  return inst.store.tx(() => {
    const of = product(inst, trade.item, trade.location);
    requirePositive(trade.quantity);
    const cost = trade.quantity * trade.unitMinor;
    const tax = trade.taxMinor ?? 0;
    const payee = optional(trade.counterparty) ? inst.contact(trade.counterparty!) : undefined;
    const lines: Line[] = [{ account: (payee ? inst.contactAccount(payee) : inst.accountNamed('Cash and Bank')).id, amount: -(cost + tax) }];
    if (tax !== 0) lines.push({ account: inst.accountNamed('Purchases Tax Claimed').id, amount: tax });
    if (isStorable(inst, of.item)) {
      lines.push(
        { account: inst.productAccount('Inventory', of).id, amount: cost },
        { account: inst.quantityAccount('On Hand', of).id, amount: trade.quantity },
        { account: inst.quantityAccount('Units Bought', { item: of.item }).id, amount: -trade.quantity },
        ...capacityLines(inst, of.location, 'Bottle', trade.quantity)
      );
    } else {
      lines.push({ account: inst.productAccount('Cost of Goods Sold', of).id, amount: cost });
    }
    const delivered = delivery(inst, 'Purchase', trade, of.item, cost);
    return inst.post(optional(trade.reference) ?? generated('PURCHASE'), [...lines, ...delivered.lines], {
      date: optional(trade.date),
      relations: { ...about(of), ...delivered.relations, ...(payee ? { Counterparty: payee.id } : {}) },
    });
  });
}

/** One entry carrying the sale and, for stock, the cost of what was sold
 * and the quantity leaving. */
export function sell(inst: Instance, trade: Trade): Node {
  return inst.store.tx(() => {
    const of = product(inst, trade.item, trade.location);
    requirePositive(trade.quantity);
    const revenue = trade.quantity * trade.unitMinor;
    const tax = trade.taxMinor ?? 0;
    const payer = optional(trade.counterparty) ? inst.contact(trade.counterparty!) : undefined;
    const lines: Line[] = [
      { account: (payer ? inst.contactAccount(payer) : inst.accountNamed('Cash and Bank')).id, amount: revenue + tax },
      { account: inst.productAccount('Sales Revenue', of).id, amount: -revenue },
    ];
    if (tax !== 0) lines.push({ account: inst.accountNamed('Sales Tax Payable').id, amount: -tax });
    if (isStorable(inst, of.item)) {
      requireOnHand(inst, of, trade.quantity, 'sell');
      const cost = costOf(inst, of, trade.quantity);
      if (cost > 0) {
        lines.push(
          { account: inst.productAccount('Cost of Goods Sold', of).id, amount: cost },
          { account: inst.productAccount('Inventory', of).id, amount: -cost }
        );
      }
      lines.push(
        { account: inst.quantityAccount('On Hand', of).id, amount: -trade.quantity },
        { account: inst.quantityAccount('Units Sold', { item: of.item }).id, amount: trade.quantity },
        ...capacityLines(inst, of.location, 'Bottle', -trade.quantity)
      );
    }
    const delivered = delivery(inst, 'Sales', trade, of.item, revenue);
    return inst.post(optional(trade.reference) ?? generated('SALE'), [...lines, ...delivered.lines], {
      date: optional(trade.date),
      relations: { ...about(of), ...delivered.relations, ...(payer ? { Counterparty: payer.id } : {}) },
    });
  });
}

/** Money received from a customer, or paid to anyone else. */
export function payment(inst: Instance, contactName: string, amountMinor: number, reference?: string): Node {
  return inst.store.tx(() => {
    const contact = inst.contact(contactName);
    if (!(amountMinor > 0)) throw new Refused('The amount must be positive.');
    const account = inst.contactAccount(contact);
    const received = inst.typeOf(account.id) === 'Asset';
    const cash = inst.accountNamed('Cash and Bank').id;
    return inst.post(
      optional(reference) ?? generated('PAYMENT'),
      [
        { account: cash, amount: received ? amountMinor : -amountMinor },
        { account: account.id, amount: received ? -amountMinor : amountMinor },
      ],
      { relations: { Counterparty: contact.id } }
    );
  });
}

export function placePurchaseOrder(inst: Instance, reference: string, providerName: string, itemName: string, quantity: number, valueMinor: number): Node {
  return inst.store.tx(() => {
    const item = inst.item(itemName);
    const provider = inst.contact(providerName);
    requirePositive(quantity);
    return inst.post(reference, orderLines(inst, 'Purchase', item, quantity, valueMinor), {
      relations: { Counterparty: provider.id, Item: item.id, Status: 'placed' },
    });
  });
}

/** What is left of an order: what was placed less what deliveries related
 * to it have released. */
export function onOrder(inst: Instance, itemName: string): number {
  const account = inst.existingQuantityAccount('On Order', { item: inst.item(itemName) });
  return account ? inst.balance(account.id) : 0;
}

/** Damaged, lost or expired stock: its cost to Write-offs, its quantity out. */
export function writeOff(inst: Instance, itemName: string, quantity: number, locationName?: string, reference?: string): Node {
  return inst.store.tx(() => {
    const of = product(inst, itemName, locationName);
    requireStorable(inst, of.item, 'written off');
    requirePositive(quantity);
    requireOnHand(inst, of, quantity, 'write off');
    const cost = costOf(inst, of, quantity);
    const lines: Line[] = [
      { account: inst.quantityAccount('On Hand', of).id, amount: -quantity },
      { account: inst.quantityAccount('Written Off', { item: of.item }).id, amount: quantity },
      ...capacityLines(inst, of.location, 'Bottle', -quantity),
    ];
    if (cost > 0) {
      lines.push({ account: inst.productAccount('Write-offs', of).id, amount: cost }, { account: inst.productAccount('Inventory', of).id, amount: -cost });
    }
    return inst.post(optional(reference) ?? generated('WRITEOFF'), lines, { relations: about(of) });
  });
}

/** The relation marking a year-end stock take's entry. */
const YEAR_END_COUNT = 'Year End Count';

export interface StockTakeOptions {
  /** The count closing a year: it is posted even when it agrees with the
   * books, values any difference at the average cost held, and from then
   * on the stock is held as one layer at that average cost. */
  yearEnd?: boolean;
  date?: string;
}

/** A stock count that differs from the books: on hand is set to what was
 * counted, the difference in value going to Write-offs. During the year,
 * stock missing is costed first in, first out, and stock found at the
 * latest receipt's cost. At year end both are at the average cost held. */
export function stockTake(inst: Instance, itemName: string, counted: number, locationName?: string, reference?: string, options: StockTakeOptions = {}): Node | undefined {
  return inst.store.tx(() => {
    const of = product(inst, itemName, locationName);
    requireStorable(inst, of.item, 'counted');
    if (counted < 0) throw new Refused('A count cannot be negative.');
    const held = onHand(inst, of);
    const difference = counted - held;
    if (difference === 0 && !options.yearEnd) return undefined;
    let value: number;
    if (options.yearEnd) {
      const total = valueOf(stockLayers(inst, of));
      value = held > 0 ? Math.round((total * difference) / held) : 0;
    } else {
      value = difference < 0 ? -costOf(inst, of, -difference) : costOfFound(inst, of, difference);
    }
    const lines: Line[] = [];
    if (difference !== 0) {
      lines.push(
        { account: inst.quantityAccount('On Hand', of).id, amount: difference },
        { account: inst.quantityAccount('Count Adjustment', { item: of.item }).id, amount: -difference },
        ...capacityLines(inst, of.location, 'Bottle', difference)
      );
    }
    if (value !== 0) {
      lines.push({ account: inst.productAccount('Inventory', of).id, amount: value }, { account: inst.productAccount('Write-offs', of).id, amount: -value });
    }
    const relations: Record<string, Target> = { ...about(of), Counted: String(counted) };
    if (options.yearEnd) relations[YEAR_END_COUNT] = true;
    const entry = inst.post(optional(reference) ?? generated(options.yearEnd ? 'YEAR-END-COUNT' : 'STOCKTAKE'), lines, { date: optional(options.date), relations });
    if (options.yearEnd && (difference !== 0 || value !== 0)) {
      reclose(inst, entry, of, value);
      carryForward(inst, entry, of, difference, value);
    }
    return entry;
  });
}

/** A year-end correction made after the year's books were closed: its
 * write-off (or write-on) is closed to Retained Earnings too, so the old
 * year's profit includes it and its balance sheet still balances. */
function reclose(inst: Instance, correction: Node, of: Product, value: number): void {
  if (value === 0) return;
  const date = inst.store.entryDate(correction.id)!;
  const closings = inst.entriesMarked('Closing').filter((e) => inst.store.entryDate(e)! >= date);
  if (closings.length === 0) return;
  const closedOn = closings.map((e) => inst.store.entryDate(e)!).sort().at(-1)!;
  // The correction credited Write-offs with `value`; closing takes it out.
  inst.post(
    inst.freeReference(`CLOSE-${closedOn}-${correction.name}`),
    [
      { account: inst.productAccount('Write-offs', of).id, amount: value },
      { account: inst.accountNamed('Retained Earnings').id, amount: -value },
    ],
    { date: closedOn, relations: { Closing: true, 'Correction Of': correction.id } }
  );
}

/** A year-end correction made after the new year was opened, while the
 * business trades on in the new ledger: the same quantity and value are
 * corrected in the new ledger's opening stock, against Retained Earnings
 * (the difference belongs to the old year's profit, not the new one's)
 * and the quantity brought forward. Dated the new ledger's opening date. */
function carryForward(inst: Instance, correction: Node, of: Product, difference: number, value: number): void {
  const to = inst.core.related(inst.ledger.id, 'Carried Forward To');
  if (!to) return;
  const next = inst.forLedger(to.name);
  const openedOn = inst.core.value(to.id, 'Opened On')!;
  const lines: Line[] = [];
  if (difference !== 0) {
    lines.push(
      { account: next.quantityAccount('On Hand', of).id, amount: difference },
      { account: next.quantityAccount('Brought Forward', { item: of.item }).id, amount: -difference },
      ...capacityLines(next, of.location, 'Bottle', difference)
    );
  }
  if (value !== 0) {
    lines.push({ account: next.productAccount('Inventory', of).id, amount: value }, { account: next.accountNamed('Retained Earnings').id, amount: -value });
  }
  next.post(next.freeReference(`OPENING-${openedOn}-${correction.name}`), lines, {
    date: openedOn,
    relations: { ...about(of), Opening: true, [YEAR_END_COUNT]: true, 'Correction Of': correction.id, 'Carried From': inst.ledger.id },
  });
}

// --- the year-end stock take ---------------------------------------------
//
// Counted per item per location. A point-of-sale terminal or a phone app
// lists the count sheet, and confirms each line: the number counted, or,
// left empty, the books' quantity. Whatever is not confirmed by hand can be
// confirmed automatically at the books' quantities. Each confirmation is a
// year-end stock take (see stockTake).

export interface CountLine {
  item: string;
  /** Empty for a business that does not distinguish its places. */
  location: string;
  onHand: number;
  /** The count confirmed for this date, if any. */
  counted?: number;
}

/** Every item held (or once held) at every location, as the On Hand
 * accounts record it. */
function stocked(inst: Instance): Product[] {
  const quantities = inst.store.child(inst.accountsRoot().id, 'Quantities');
  const folder = quantities && inst.store.child(quantities.id, 'On Hand');
  if (!folder) return [];
  const out: Product[] = [];
  for (const account of inst.core.things(folder.id, 'Account')) {
    if (inst.core.value(account.id, 'Dimensions')) continue;
    const item = inst.core.related(account.id, 'Item');
    if (!item) continue;
    const location = inst.core.related(account.id, 'Location');
    out.push({ item, ...(location ? { location } : {}) });
  }
  return out;
}

/** The count confirmed for an item at a location on a date: the last
 * year-end stock take of that date. */
function confirmedCount(inst: Instance, of: Product, asOfDate: string): number | undefined {
  let counted: number | undefined;
  for (const entry of inst.entriesMarked(YEAR_END_COUNT)) {
    if (inst.core.related(entry, 'Item')?.id !== of.item?.id || inst.core.related(entry, 'Location')?.id !== of.location?.id) continue;
    if (inst.store.entryDate(entry) !== asOfDate) continue;
    counted = inst.core.number(entry, 'Counted');
  }
  return counted;
}

/** The count sheet for a year end: each item at each location, what the
 * books hold, and what has been confirmed so far. */
export function stockTakeSheet(inst: Instance, asOfDate: string): CountLine[] {
  return stocked(inst).map((of) => ({
    item: of.item!.name,
    location: of.location?.name ?? '',
    onHand: onHand(inst, of),
    counted: confirmedCount(inst, of, asOfDate),
  }));
}

/** One line of the count, confirmed from a terminal or a phone: the number
 * counted, or with none given, the books' quantity. Confirming again
 * records the recount. */
export function confirmCount(inst: Instance, itemName: string, locationName: string | undefined, counted: number | undefined, asOfDate: string): Node {
  requireDate(asOfDate);
  return inst.store.tx(() => {
    const of = product(inst, itemName, locationName);
    const count = counted ?? onHand(inst, of);
    return stockTake(inst, itemName, count, locationName, inst.freeReference(`YEAR-END-COUNT-${asOfDate}-${productLabel(of)}`), { yearEnd: true, date: asOfDate })!;
  });
}

/** The automatic option: every line not yet confirmed for the date is
 * confirmed at the books' quantity. Returns how many were. */
export function completeYearEndStockTake(inst: Instance, asOfDate: string): number {
  requireDate(asOfDate);
  return inst.store.tx(() => {
    let confirmed = 0;
    for (const of of stocked(inst)) {
      if (confirmedCount(inst, of, asOfDate) !== undefined) continue;
      confirmCount(inst, of.item!.name, of.location?.name, undefined, asOfDate);
      confirmed += 1;
    }
    return confirmed;
  });
}

function requireDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Refused(`The year-end date must be given as YYYY-MM-DD, not "${date}".`);
}

function productLabel(of: Product): string {
  return of.location ? `${of.item!.name}@${of.location.name}` : of.item!.name;
}

/** Opening a container frees space in the container tier and takes up
 * space in the unit tier, at one location. */
export function openContainer(inst: Instance, locationName: string, itemName: string, containersOpened: number, unitsProduced: number): Node {
  return inst.store.tx(() => {
    const location = inst.location(locationName);
    const item = inst.item(itemName);
    const lines = [...capacityLines(inst, location, 'Carton', -containersOpened), ...capacityLines(inst, location, 'Bottle', unitsProduced)];
    if (lines.length === 0) throw new Refused(`"${locationName}" has no storage capacity recorded.`);
    return inst.post(generated(`STORAGE-OPEN-${locationName}`), lines, { relations: { Item: item.id, Location: location.id } });
  });
}

// --- wages ----------------------------------------------------------------------

const DEFAULT_MEDICARE_LEVY_RATE = 0.015;
const DEFAULT_SUPERANNUATION_RATE = 0.12;

export interface Payslip {
  grossMinor: number;
  medicareLevyMinor: number;
  superannuationMinor: number;
  netMinor: number;
}

/** Pays an employee by the hour, or a month of salary. The two rates are
 * relations of the business, with the statutory figures as defaults. */
export function payWages(inst: Instance, employeeName: string, hours?: number, paid = true): Payslip {
  return inst.store.tx(() => {
    const employee = inst.contact(employeeName);
    const wage = inst.core.number(employee.id, 'Wage Per Hour');
    const salary = inst.core.number(employee.id, 'Salary Per Year');
    let gross: number;
    if (wage !== undefined) {
      if (!hours || hours <= 0) throw new Refused(`"${employeeName}" is paid by the hour: the hours worked must be given.`);
      gross = Math.round(hours * wage);
    } else if (salary !== undefined) {
      if (hours) throw new Refused(`"${employeeName}" is on a salary: hours worked do not apply.`);
      gross = Math.round(salary / 12);
    } else {
      throw new Refused(`"${employeeName}" has no wage or salary set.`);
    }
    const levy = Math.round(gross * (inst.core.number(inst.business.id, 'Medicare Levy Rate') ?? DEFAULT_MEDICARE_LEVY_RATE));
    const superannuation = Math.round(gross * (inst.core.number(inst.business.id, 'Superannuation Rate') ?? DEFAULT_SUPERANNUATION_RATE));
    const net = gross - levy;
    const owed = inst.contactAccount(employee).id;
    const lines: Line[] = [
      { account: inst.accountNamed('Wages').id, amount: gross },
      { account: owed, amount: -gross },
      { account: owed, amount: levy },
      { account: inst.accountNamed('Medicare Levy Payable').id, amount: -levy },
      { account: inst.accountNamed('Superannuation Expense').id, amount: superannuation },
      { account: inst.accountNamed('Superannuation Payable').id, amount: -superannuation },
    ];
    if (paid) lines.push({ account: owed, amount: net }, { account: inst.accountNamed('Cash and Bank').id, amount: -net });
    inst.post(generated('WAGES'), lines, { relations: { Counterparty: employee.id } });
    return { grossMinor: gross, medicareLevyMinor: levy, superannuationMinor: superannuation, netMinor: net };
  });
}

// --- corrections and period end -----------------------------------------------------

/** A posted entry is never changed. It is corrected by a new entry with
 * every amount negated, related to the one it reverses. */
export function reverseEntry(inst: Instance, reference: string, date?: string): Node {
  return inst.store.tx(() => {
    const entry = inst.entry(reference);
    if (!entry) throw new NotFound(`No entry named "${reference}".`);
    if (inst.core.related(entry.id, 'Reversed By')) throw new Refused(`"${reference}" has already been reversed.`);
    const reversal = inst.post(`${reference}-REVERSAL`, reversed(inst.store.entryLines(entry.id)), {
      date: optional(date),
      relations: { 'Reversal Of': entry.id },
    });
    inst.core.relate(entry.id, 'Reversed By', reversal.id, inst.id);
    return reversal;
  });
}

/** Nothing may be posted on or before the date. Null reopens the ledger. */
export function lockLedger(inst: Instance, through: string | null): void {
  inst.relate(inst.ledger.id, 'Locked Through', through);
}

/** Brings every Income and Expense account to zero as of a date, the
 * difference going to Retained Earnings. */
export function closeBooks(inst: Instance, asOfDate: string, retainedEarningsAccount: string): Node {
  return inst.store.tx(() => {
    const sums = inst.sums({ to: asOfDate });
    const lines: Line[] = [];
    let net = 0;
    for (const { node, type } of inst.statementAccounts()) {
      if (type !== 'Income' && type !== 'Expense') continue;
      const balance = sums.get(node.id) ?? 0;
      if (balance === 0 || inst.unitOf(node.id) !== '') continue;
      lines.push({ account: node.id, amount: -balance });
      net += balance;
    }
    if (lines.length === 0) throw new Refused(`Nothing to close as of ${asOfDate}: every Income and Expense account is already zero.`);
    lines.push({ account: inst.accountNamed(retainedEarningsAccount).id, amount: net });
    return inst.post(inst.freeReference(`CLOSE-${asOfDate}`), lines, { date: asOfDate, relations: { Closing: true } });
  });
}

export function createLedger(inst: Instance, name: string): Node {
  return inst.store.tx(() => inst.core.thing(name, inst.branch('Ledgers').id, 'Ledger', inst.id));
}

const FLOW_COUNTERS = ['Units Bought', 'Units Sold', 'Written Off', 'Count Adjustment'];

/** The account in another ledger that mirrors this one: same place, same
 * name, same relations. */
function mirror(from: Instance, to: Instance, account: Node): Node {
  const root = from.accountsRoot().id;
  const path: Node[] = [];
  for (let at = account; at.id !== root; at = from.store.get(at.parent!)) path.unshift(at);
  let parent = to.accountsRoot();
  for (const step of path) {
    let made = to.store.child(parent.id, step.name);
    if (!made) {
      made = to.store.create(step.name, parent.id, to.id);
      for (const relation of from.store.children(step.id)) {
        if (relation.relation === null || from.core.kindOf(relation.id) !== undefined) continue;
        const target = from.store.get(relation.relation);
        to.core.relate(made.id, relation.name, target.parent === relation.id ? target.name : target.id, to.id);
      }
    }
    parent = made;
  }
  return parent;
}

/** Carries every balance forward into a new ledger as its opening entry.
 * Income and Expense are not carried: what they have not yet been closed
 * into goes to Retained Earnings. */
export function rollover(inst: Instance, newLedgerName: string, asOfDate: string): Node {
  return inst.store.tx(() => {
    const next = inst.forLedger(newLedgerName);
    const sums = inst.sums();
    const statement = new Map(inst.statementAccounts().map((a) => [a.node.id, a.type]));
    const lines: Line[] = [];
    let unclosed = 0;
    const flows = new Map<number, number>();
    for (const account of inst.core.all(inst.accountsRoot().id, 'Account')) {
      const balance = sums.get(account.id) ?? 0;
      if (balance === 0) continue;
      const type = statement.get(account.id);
      if ((type === 'Income' || type === 'Expense') && inst.unitOf(account.id) === '') {
        unclosed += balance;
        continue;
      }
      // Running counts of units bought, sold, written off and adjusted are
      // the quantity side's income and expense: they start again at zero,
      // their total going to one Brought Forward account per item.
      const group = account.parent !== null ? inst.store.get(account.parent).name : '';
      const item = inst.core.related(account.id, 'Item');
      if (item && FLOW_COUNTERS.includes(group)) {
        flows.set(item.id, (flows.get(item.id) ?? 0) + balance);
        continue;
      }
      lines.push({ account: mirror(inst, next, account).id, amount: balance });
    }
    for (const [itemId, total] of flows) {
      if (total !== 0) lines.push({ account: next.quantityAccount('Brought Forward', { item: inst.store.get(itemId) }).id, amount: total });
    }
    if (unclosed !== 0) lines.push({ account: next.accountNamed('Retained Earnings').id, amount: unclosed });
    if (lines.length === 0) throw new Refused('There are no balances to carry forward.');
    // Each item's stock arrives in one opening movement, so the new ledger
    // holds it as one layer at the average cost: what the year-end stock
    // take established.
    // The old ledger knows where it was carried, so that corrections to it
    // (the year-end count, above all) can be carried there too.
    inst.core.relate(inst.ledger.id, 'Carried Forward To', next.ledger.id, inst.id);
    inst.core.relate(next.ledger.id, 'Opened On', asOfDate, inst.id);
    return next.post(`OPENING-${asOfDate}`, lines, { date: asOfDate, relations: { Opening: true, 'Carried From': inst.ledger.id } });
  });
}


export { GLOBAL_BUSINESS, today };
