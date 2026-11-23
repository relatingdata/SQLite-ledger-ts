// The simplified middleware core: two stores, three globals, four calls.
//
//   Stores   entities; journal header and journal lines      (store.ts)
//   Globals  Id, Business, Ledger: fixed when an Instance is opened,
//            never passed to a call
//   Calls    create, relate, copy, post
//
// Everything recorded about a thing is a relation: a child of the thing,
// named after the relation, whose relation column holds its target. The
// target is a value (a child of the relation whose name is the value),
// another entity, or the entity `Active` for yes.
//
// Global first, local on first use: a name is looked for in the business,
// then under Application. Reading creates nothing. The first write to a
// global thing makes a local instance related `Instance Of` to it.
//
// Four header accounts are mandatory in every business: Sales Revenue,
// Cost of Goods Sold, Inventory and Write-offs. The posting accounts under
// each are the Cartesian product Location x Item. A dimension that is not
// used drops out, so the null product is one simple posting account.

import { Store, type Node, type Line, type DateRange } from './store.js';
import { hashPassword } from '../password.js';

export class Refused extends Error {}
export class NotFound extends Error {}

/** What a hierarchy of the business groups (docs/pm-domain-reference.md). */
export type HierarchyKind = 'Items' | 'Locations';
export const HIERARCHY_KINDS: readonly HierarchyKind[] = ['Items', 'Locations'];

/** What a relation relates a thing to: text is a value, a number is another
 * entity's id, true is yes, and false or null clears the relation. */
export type Target = string | number | boolean | null;

export const GLOBAL_BUSINESS = 'Global Business';
export const HEADERS = ['Sales Revenue', 'Cost of Goods Sold', 'Inventory', 'Write-offs'] as const;
export type Header = (typeof HEADERS)[number];
export const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'] as const;

const INSTALL_USER = 0;

/** The chart of accounts every business draws on, a piece at a time. */
const ENGLISH_CHART: Record<string, (string | [string, string[]])[]> = {
  Asset: ['Accounts Receivable', 'Cash and Bank', 'Fixed Assets', 'Inventory', 'Purchases Tax Claimed'],
  Liability: ['Accounts Payable', 'Loans Payable', 'Medicare Levy Payable', 'Sales Tax Payable', 'Superannuation Payable'],
  Equity: ["Owner's Equity", 'Retained Earnings'],
  Income: ['Sales Revenue', 'Sales Discounts', 'Other Income'],
  Expense: [
    'Cost of Goods Sold',
    'Write-offs',
    'Rent',
    'Wages',
    'Office',
    'Miscellaneous',
    'Superannuation Expense',
    ['Utilities', ['Electricity', 'Gas', 'Water', 'Internet', 'Telephone']],
  ],
};

const KINDS = [
  'Business', 'Ledger', 'Account', 'Entry', 'User', 'Role', 'Contact', 'Contact Type', 'Location', 'Location Type',
  'Item', 'Plant', 'Skill', 'Hierarchy', 'Value', 'Prototype', 'Line', 'Project', 'Milestone', 'Bank Account', 'Word',
];

const ROLES = ['Administrator', 'Security Administrator', 'Bookkeeper', 'Accountant', 'Read-Only', 'Developer'];

export class Core {
  readonly store: Store;
  private kindIds = new Map<string, number>();
  private activeId = 0;

  constructor(path: string) {
    this.store = new Store(path);
    this.install();
  }

  close(): void {
    this.store.close();
  }

  // --- entity helpers shared by every instance ---------------------------

  ensure(name: string, parent: number | null, by: number): Node {
    return this.store.child(parent, name) ?? this.store.create(name, parent, by);
  }

  ensurePath(from: number, path: string[], by: number): Node {
    let at = this.store.get(from);
    for (const name of path) at = this.ensure(name, at.id, by);
    return at;
  }

  at(path: string[]): Node {
    let at = this.store.child(null, 'Root');
    for (const name of path) at = at ? this.store.child(at.id, name) : undefined;
    if (!at) throw new NotFound(`No "${path.join(' / ')}".`);
    return at;
  }

  /** Records one relation of a thing. No other relation is touched. */
  relate(thing: number, relation: string, target: Target, by: number): void {
    const node = this.ensure(relation, thing, by);
    if (target === null || target === false) this.store.point(node.id, null, by);
    else if (target === true) this.store.point(node.id, this.activeId, by);
    else if (typeof target === 'number') this.store.point(node.id, target, by);
    else this.store.point(node.id, this.ensure(target, node.id, by).id, by);
  }

  /** The entity a relation of a thing currently relates it to. */
  related(thing: number, relation: string): Node | undefined {
    const node = this.store.child(thing, relation);
    return node && node.relation !== null ? this.store.get(node.relation) : undefined;
  }

  value(thing: number, relation: string): string | undefined {
    return this.related(thing, relation)?.name;
  }

  number(thing: number, relation: string): number | undefined {
    const text = this.value(thing, relation);
    return text === undefined || text === '' ? undefined : Number(text);
  }

  is(thing: number, relation: string): boolean {
    return this.related(thing, relation)?.id === this.activeId;
  }

  kind(name: string): number {
    const id = this.kindIds.get(name);
    if (id === undefined) throw new Error(`No kind "${name}".`);
    return id;
  }

  kindOf(id: number): string | undefined {
    return this.related(id, 'Kind')?.name;
  }

  /** Get-or-create of a thing: an entity that is something in its own
   * right, as opposed to a relation or a value. */
  thing(name: string, parent: number, kind: string, by: number): Node {
    const existing = this.store.child(parent, name);
    if (existing) return existing;
    const node = this.store.create(name, parent, by);
    this.relate(node.id, 'Kind', this.kind(kind), by);
    return node;
  }

  /** The things directly under a parent. Relations, values and retired
   * things are left out. */
  things(parent: number, kind?: string): Node[] {
    return this.store.children(parent).filter((c) => {
      const k = this.kindOf(c.id);
      return k !== undefined && (kind === undefined || k === kind) && !this.is(c.id, 'Retired');
    });
  }

  /** Depth-first search through things only. */
  find(under: number, match: (node: Node) => boolean): Node | undefined {
    for (const child of this.things(under)) {
      if (match(child)) return child;
      const deeper = this.find(child.id, match);
      if (deeper) return deeper;
    }
    return undefined;
  }

  findNamed(under: number, name: string, kind?: string): Node | undefined {
    return this.find(under, (n) => n.name === name && (kind === undefined || this.kindOf(n.id) === kind));
  }

  all(under: number, kind?: string): Node[] {
    const out: Node[] = [];
    const walk = (parent: number) => {
      for (const child of this.things(parent)) {
        if (kind === undefined || this.kindOf(child.id) === kind) out.push(child);
        walk(child.id);
      }
    };
    walk(under);
    return out;
  }

  /** The thing under `under` that is an instance of the given prototype,
   * whatever it has since been renamed to. */
  instanceOf(under: number, prototype: number): Node | undefined {
    return this.find(under, (n) => this.related(n.id, 'Instance Of')?.id === prototype);
  }

  /** Copies a prototype's children under another entity. A relation to one
   * of the prototype's own children is repointed at the copied child. */
  copy(prototype: number, under: number, by: number): void {
    for (const child of this.store.children(prototype)) {
      const made = this.ensure(child.name, under, by);
      this.copy(child.id, made.id, by);
      if (child.relation !== null) {
        const target = this.store.get(child.relation);
        const own = target.parent === child.id ? this.ensure(target.name, made.id, by).id : target.id;
        this.store.point(made.id, own, by);
      }
    }
  }

  // --- installation -------------------------------------------------------

  /** Creates what every installation starts with: Application (the global
   * prototypes and defaults), Active, and the Global Business with its own
   * Admin user and role. Safe to run again. */
  private install(): void {
    this.store.tx(() => {
      const by = INSTALL_USER;
      const root = this.ensure('Root', null, by);
      this.activeId = this.ensure('Active', root.id, by).id;
      const application = this.ensure('Application', root.id, by);
      const kinds = this.ensure('Kinds', application.id, by);
      for (const kind of KINDS) this.kindIds.set(kind, this.ensure(kind, kinds.id, by).id);

      for (const branch of ['Vocabulary', 'Menus', 'Hierarchies', 'Cartesian Products']) this.ensure(branch, application.id, by);
      const vocabulary = this.ensure('Vocabulary', application.id, by);
      for (const word of ['Profit and Loss Statement', 'Balance Sheet', 'Trial Balance']) this.thing(word, vocabulary.id, 'Word', by);
      // The minimal Cartesian product, mandatory under the four headers.
      this.ensurePath(application.id, ['Cartesian Products', 'Location × Item'], by);

      const roles = this.ensure('Roles', application.id, by);
      for (const role of ROLES) this.thing(role, roles.id, 'Role', by);
      const contactTypes = this.ensure('Contact Types', application.id, by);
      const control: Record<string, string> = { Customer: 'Accounts Receivable', Provider: 'Accounts Payable', Employee: 'Accounts Payable' };
      for (const [type, account] of Object.entries(control)) {
        const node = this.thing(type, contactTypes.id, 'Contact Type', by);
        this.relate(node.id, 'Header Account', account, by);
      }
      const locationTypes = this.ensure('Location Types', application.id, by);
      for (const type of ['Retail', 'Warehouse']) this.thing(type, locationTypes.id, 'Location Type', by);

      const chart = this.ensurePath(application.id, ['Charts of Accounts', 'English CoA'], by);
      const plant = (parent: number, entries: (string | [string, string[]])[]) => {
        for (const entry of entries) {
          const [name, below] = typeof entry === 'string' ? [entry, []] : entry;
          const account = this.thing(name, parent, 'Account', by);
          if ((HEADERS as readonly string[]).includes(name)) this.relate(account.id, 'Header', true, by);
          plant(account.id, below);
        }
      };
      for (const [type, entries] of Object.entries(ENGLISH_CHART)) plant(this.thing(type, chart.id, 'Account', by).id, entries);

      const businesses = this.ensure('Businesses', root.id, by);
      if (!this.store.child(businesses.id, GLOBAL_BUSINESS)) {
        const global = this.thing(GLOBAL_BUSINESS, businesses.id, 'Business', by);
        const users = this.ensure('Users', global.id, by);
        const admin = this.thing('admin', users.id, 'User', by);
        this.relate(admin.id, 'Password Hash', hashPassword('changeme123'), by);
        const localRoles = this.ensure('Roles', global.id, by);
        const role = this.thing('Administrator', localRoles.id, 'Role', by);
        this.relate(role.id, 'Instance Of', this.store.child(roles.id, 'Administrator')!.id, by);
        this.relate(admin.id, 'Role: Administrator', role.id, by);
      }
    });
  }

  business(name: string): Node {
    const node = this.store.child(this.at(['Businesses']).id, name);
    if (!node) throw new NotFound(`No business named "${name}".`);
    return node;
  }

  /** Creates an instance. The user must be a user of the business, and the
   * ledger must already exist; every business is created with `Actual`. */
  open(user: string, business: string, ledger = 'Actual'): Instance {
    const businessNode = this.business(business);
    const users = this.store.child(businessNode.id, 'Users');
    const userNode = users && this.store.child(users.id, user);
    if (!userNode || this.is(userNode.id, 'Retired')) throw new NotFound(`"${user}" is not a user of "${business}".`);
    if (business === GLOBAL_BUSINESS) return new Instance(this, userNode, businessNode, undefined);
    const ledgers = this.store.child(businessNode.id, 'Ledgers');
    const ledgerNode = ledgers && this.store.child(ledgers.id, ledger);
    if (!ledgerNode) throw new NotFound(`"${business}" has no ledger named "${ledger}".`);
    return new Instance(this, userNode, businessNode, ledgerNode);
  }
}

export interface Product {
  item?: Node;
  location?: Node;
  /** Further dimensions: hierarchy name to value entity. */
  extra?: Record<string, Node>;
}

export interface PostOptions {
  date?: string;
  relations?: Record<string, Target>;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** One storage engine instance. `user`, `business` and `ledger` are its
 * three globals. The Global Business has no ledger. */
export class Instance {
  readonly store: Store;

  constructor(
    readonly core: Core,
    readonly user: Node,
    readonly business: Node,
    readonly ledgerNode: Node | undefined
  ) {
    this.store = core.store;
  }

  get id(): number {
    return this.user.id;
  }

  get isGlobal(): boolean {
    return this.ledgerNode === undefined;
  }

  get ledger(): Node {
    if (!this.ledgerNode) throw new Refused('The Global Business has no ledger and never trades.');
    return this.ledgerNode;
  }

  /** A sibling instance: the same user and business, another ledger. */
  forLedger(name: string): Instance {
    return this.core.open(this.user.name, this.business.name, name);
  }

  // --- the four calls ------------------------------------------------------

  /** Returns the entity of that name under that parent, creating it if it
   * is not there. */
  create(name: string, parent: number): Node {
    return this.store.tx(() => this.core.ensure(name, parent, this.id));
  }

  /** Records one relation of a thing. */
  relate(thing: number, relation: string, target: Target): void {
    this.store.tx(() => this.core.relate(thing, relation, target, this.id));
  }

  /** Copies a prototype's children under another entity. */
  copy(prototype: number, under: number): void {
    this.store.tx(() => this.core.copy(prototype, under, this.id));
  }

  /** Posts one entry: one event, however many lines. Positive is a debit,
   * negative a credit. Lines must add up to zero within each unit. */
  post(reference: string, lines: Line[], options: PostOptions = {}): Node {
    return this.store.tx(() => {
      const ledger = this.ledger;
      const merged = new Map<number, number>();
      for (const line of lines) merged.set(line.account, (merged.get(line.account) ?? 0) + line.amount);
      const kept = [...merged].filter(([, amount]) => amount !== 0).map(([account, amount]) => ({ account, amount }));

      const date = options.date || today();
      const locked = this.core.value(ledger.id, 'Locked Through');
      if (locked && date <= locked) throw new Refused(`The ledger is locked through ${locked}.`);

      const totals = new Map<string, number>();
      for (const line of kept) {
        if (!this.store.within(line.account, ledger.id)) throw new Refused(`Account ${this.store.get(line.account).name} is not in this ledger.`);
        const unit = this.unitOf(line.account);
        totals.set(unit, (totals.get(unit) ?? 0) + line.amount);
      }
      for (const [unit, sum] of totals) {
        if (sum !== 0) throw new Refused(`"${reference}" does not add up to zero in ${unit || 'money'} (out by ${sum}).`);
      }

      const entries = this.core.ensure('Entries', ledger.id, this.id);
      if (this.store.child(entries.id, reference)) throw new Refused(`An entry named "${reference}" already exists in this ledger.`);
      const entry = this.core.thing(reference, entries.id, 'Entry', this.id);
      for (const [relation, target] of Object.entries(options.relations ?? {})) this.core.relate(entry.id, relation, target, this.id);
      this.store.insertEntry(entry.id, date, kept);
      return entry;
    });
  }

  entry(reference: string): Node | undefined {
    const entries = this.store.child(this.ledger.id, 'Entries');
    return entries && this.store.child(entries.id, reference);
  }

  /** A reference not yet used in this ledger, starting from the one given. */
  freeReference(reference: string): string {
    let candidate = reference;
    for (let n = 2; this.entry(candidate); n += 1) candidate = `${reference}-${n}`;
    return candidate;
  }

  // --- global first, local on first use -----------------------------------

  /** A folder of the business, created on first use. */
  branch(name: string): Node {
    return this.core.ensure(name, this.business.id, this.id);
  }

  private existingBranch(name: string): Node | undefined {
    return this.store.child(this.business.id, name);
  }

  private globalBranch(name: string): Node | undefined {
    return this.store.child(this.core.at(['Application']).id, name);
  }

  /** Looks a name up in one of the business's branches, local first, then
   * under Application. Creates nothing. */
  lookup(branch: string, name: string): { node: Node; local: boolean } | undefined {
    const localRoot = this.existingBranch(branch);
    const local = localRoot && this.core.findNamed(localRoot.id, name);
    if (local) return { node: local, local: true };
    const globalRoot = this.globalBranch(branch);
    const global = globalRoot && this.core.findNamed(globalRoot.id, name);
    if (!global) return undefined;
    const renamed = localRoot && this.core.instanceOf(localRoot.id, global.id);
    return renamed ? { node: renamed, local: true } : { node: global, local: false };
  }

  /** The business's own instance of something in a branch, made on this
   * first write if it only existed globally. */
  localise(branch: string, name: string, kind: string): Node {
    const found = this.lookup(branch, name);
    if (!found) throw new NotFound(`No "${name}" in ${branch}.`);
    if (found.local) return found.node;
    const made = this.core.thing(found.node.name, this.branch(branch).id, kind, this.id);
    this.core.relate(made.id, 'Instance Of', found.node.id, this.id);
    return made;
  }

  /** The name the business shows for something: its own if it has a local
   * instance, otherwise the global one. */
  label(branch: string, name: string): string {
    const found = this.lookup(branch, name);
    if (!found) throw new NotFound(`No "${name}" in ${branch}.`);
    return found.node.name;
  }

  // --- things of the business ----------------------------------------------

  thingIn(branch: string, name: string, kind: string): Node {
    return this.core.thing(name, this.branch(branch).id, kind, this.id);
  }

  existing(branch: string, name: string): Node | undefined {
    const root = this.existingBranch(branch);
    const node = root && this.store.child(root.id, name);
    return node && this.core.kindOf(node.id) !== undefined && !this.core.is(node.id, 'Retired') ? node : undefined;
  }

  require(branch: string, name: string, what: string): Node {
    const node = this.existing(branch, name);
    if (!node) throw new NotFound(`No ${what} named "${name}".`);
    return node;
  }

  item(name: string): Node {
    return this.require('Items', name, 'item');
  }

  location(name: string): Node {
    return this.require('Locations', name, 'location');
  }

  contact(name: string): Node {
    return this.require('Contacts', name, 'contact');
  }

  /** Anything of the business that can be put in a group or renamed by name. */
  anything(name: string): Node | undefined {
    for (const branch of ['Items', 'Locations', 'Contacts', 'Plant', 'Projects', 'Prototypes']) {
      const node = this.existing(branch, name);
      if (node) return node;
    }
    return undefined;
  }

  // --- hierarchy -------------------------------------------------------------

  /** A hierarchy of the business; one of its own records what it is of,
   * its Items or its Locations (docs/pm-domain-reference.md). */
  hierarchy(name: string, of?: HierarchyKind): Node {
    const hierarchy = this.thingIn('Hierarchy', name, 'Hierarchy');
    if (of) {
      const recorded = this.hierarchyKind(name);
      if (recorded && recorded !== of) throw new Refused(`"${name}" is a hierarchy of ${recorded.toLowerCase()}, not of ${of.toLowerCase()}.`);
      if (!recorded) this.core.relate(hierarchy.id, 'Hierarchy Of', this.branch(of).id, this.id);
    }
    return hierarchy;
  }

  /** What a hierarchy groups, if it records it. */
  hierarchyKind(name: string): HierarchyKind | undefined {
    const hierarchy = this.existing('Hierarchy', name);
    const target = hierarchy && this.core.related(hierarchy.id, 'Hierarchy Of');
    return target && (HIERARCHY_KINDS as readonly string[]).includes(target.name) ? (target.name as HierarchyKind) : undefined;
  }

  groupValue(hierarchy: string, value: string): Node {
    return this.core.thing(value, this.hierarchy(hierarchy).id, 'Value', this.id);
  }

  /** A value of an existing hierarchy: the business creates its hierarchies
   * itself, saying what each is of. */
  valueOf(hierarchy: string, value: string): Node {
    const node = this.existing('Hierarchy', hierarchy);
    if (!node) throw new NotFound(`No hierarchy named "${hierarchy}".`);
    return this.core.thing(value, node.id, 'Value', this.id);
  }

  // --- accounts --------------------------------------------------------------

  accountsRoot(): Node {
    return this.core.ensure('Accounts', this.ledger.id, this.id);
  }

  private chartRoot(): Node {
    const chart = this.core.value(this.business.id, 'Chart of Accounts') ?? 'English CoA';
    return this.core.at(['Application', 'Charts of Accounts', chart]);
  }

  /** The local instance of a global chart account, with the accounts above
   * it, made on first use so that it sits where it does globally. */
  private instantiate(global: Node): Node {
    const chart = this.chartRoot();
    const steps: Node[] = [];
    for (let at = global; at.id !== chart.id; at = this.store.get(at.parent!)) steps.unshift(at);
    const root = this.accountsRoot();
    let parent = root;
    for (const step of steps) {
      let local = this.core.instanceOf(root.id, step.id);
      if (!local) {
        local = this.core.thing(step.name, parent.id, 'Account', this.id);
        this.core.relate(local.id, 'Instance Of', step.id, this.id);
      }
      parent = local;
    }
    return parent;
  }

  /** A chart account by its global name: the business's own instance,
   * whatever it has renamed it to, made now if need be. */
  chartAccount(name: string): Node {
    const global = this.core.findNamed(this.chartRoot().id, name, 'Account');
    if (!global) throw new NotFound(`No account named "${name}".`);
    return this.core.instanceOf(this.accountsRoot().id, global.id) ?? this.instantiate(global);
  }

  private prototypeOf(account: number): Node | undefined {
    return this.core.related(account, 'Instance Of');
  }

  isHeader(account: number): boolean {
    if (this.core.is(account, 'Header')) return true;
    const prototype = this.prototypeOf(account);
    return prototype !== undefined && this.core.is(prototype.id, 'Header');
  }

  /** What an account counts: '' is money; anything else is a quantity. */
  unitOf(account: number): string {
    const own = this.core.value(account, 'Unit');
    if (own !== undefined) return own;
    const prototype = this.prototypeOf(account);
    return (prototype && this.core.value(prototype.id, 'Unit')) ?? '';
  }

  /** Asset, Liability, Equity, Income or Expense, or the name of the top
   * folder for accounts outside the five (Quantities, Memorandum). */
  typeOf(account: number): string {
    const root = this.accountsRoot().id;
    let at = this.store.get(account);
    while (at.parent !== null && at.parent !== root) at = this.store.get(at.parent);
    return this.prototypeOf(at.id)?.name ?? at.name;
  }

  private sameProduct(account: number, product: Product): boolean {
    if (this.core.related(account, 'Item')?.id !== product.item?.id) return false;
    if (this.core.related(account, 'Location')?.id !== product.location?.id) return false;
    const extra = product.extra ?? {};
    const own = this.core.value(account, 'Dimensions') ?? '';
    if (own !== Object.keys(extra).sort().join(',')) return false;
    return Object.entries(extra).every(([hierarchy, value]) => this.core.related(account, hierarchy)?.id === value.id);
  }

  private productName(product: Product): string {
    const parts: string[] = [];
    if (product.item && product.location) parts.push(`${product.item.name} at ${product.location.name}`);
    else if (product.item) parts.push(product.item.name);
    else if (product.location) parts.push(product.location.name);
    for (const value of Object.values(product.extra ?? {})) parts.push(value.name);
    return parts.length > 0 ? parts.join(' — ') : 'General';
  }

  /** The one account under a parent for a combination, created by the first
   * use that needs it. The null product is one simple account, `General`. */
  productUnder(parent: Node, product: Product, unit?: string): Node {
    const existing = this.core.things(parent.id, 'Account').find((a) => this.sameProduct(a.id, product));
    if (existing) return existing;
    let name = this.productName(product);
    for (let n = 2; this.store.child(parent.id, name); n += 1) name = `${this.productName(product)} (${n})`;
    const account = this.core.thing(name, parent.id, 'Account', this.id);
    if (product.item) this.core.relate(account.id, 'Item', product.item.id, this.id);
    if (product.location) this.core.relate(account.id, 'Location', product.location.id, this.id);
    const extra = product.extra ?? {};
    if (Object.keys(extra).length > 0) this.core.relate(account.id, 'Dimensions', Object.keys(extra).sort().join(','), this.id);
    for (const [hierarchy, value] of Object.entries(extra)) this.core.relate(account.id, hierarchy, value.id, this.id);
    if (unit) this.core.relate(account.id, 'Unit', unit, this.id);
    return account;
  }

  /** The posting account under one of the four mandatory headers. */
  productAccount(header: Header, product: Product = {}): Node {
    return this.productUnder(this.chartAccount(header), product);
  }

  existingProductAccount(header: Header, product: Product): Node | undefined {
    const global = this.core.findNamed(this.chartRoot().id, header, 'Account')!;
    const local = this.core.instanceOf(this.accountsRoot().id, global.id);
    return local && this.core.things(local.id, 'Account').find((a) => this.sameProduct(a.id, product));
  }

  private folder(path: string[]): Node {
    let at = this.accountsRoot();
    for (const name of path) at = this.core.thing(name, at.id, 'Account', this.id);
    return at;
  }

  unitOfItem(item: Node): string {
    return (this.core.value(item.id, 'Unit Of Measure') ?? 'UNITS').toUpperCase();
  }

  /** A quantity account: On Hand, Units Bought, Units Sold, On Order and so
   * on, for an item, optionally at a location. */
  quantityAccount(group: string, product: Product, unit?: string): Node {
    return this.productUnder(this.folder(['Quantities', group]), product, unit ?? (product.item ? this.unitOfItem(product.item) : 'UNITS'));
  }

  existingQuantityAccount(group: string, product: Product): Node | undefined {
    const quantities = this.store.child(this.accountsRoot().id, 'Quantities');
    const folder = quantities && this.store.child(quantities.id, group);
    return folder && this.core.things(folder.id, 'Account').find((a) => this.sameProduct(a.id, product));
  }

  /** A money account that records a commitment and appears on no statement. */
  memoAccount(group: string, product: Product): Node {
    return this.productUnder(this.folder(['Memorandum', group]), product);
  }

  /** A contact's own account, under the control account its type names. */
  contactAccount(contact: Node): Node {
    const type = this.core.related(contact.id, 'Contact Type');
    const prototype = type && (this.core.related(type.id, 'Instance Of') ?? type);
    const control = (prototype && this.core.value(prototype.id, 'Header Account')) ?? 'Accounts Payable';
    const parent = this.chartAccount(control);
    const existing = this.core.things(parent.id, 'Account').find((a) => this.core.related(a.id, 'Contact')?.id === contact.id);
    if (existing) return existing;
    const account = this.core.thing(contact.name, parent.id, 'Account', this.id);
    this.core.relate(account.id, 'Contact', contact.id, this.id);
    return account;
  }

  /** Every account of the ledger that is one of the five statement types. */
  statementAccounts(): { node: Node; type: string }[] {
    const out: { node: Node; type: string }[] = [];
    for (const top of this.core.things(this.accountsRoot().id, 'Account')) {
      const type = this.prototypeOf(top.id)?.name ?? top.name;
      if (!(ACCOUNT_TYPES as readonly string[]).includes(type)) continue;
      out.push({ node: top, type });
      for (const node of this.core.all(top.id, 'Account')) out.push({ node, type });
    }
    return out;
  }

  /** Resolves the name a person gives for an account when posting a
   * journal entry by hand. Local accounts first; then an item (its
   * Inventory account), then a contact (its own account), then the global
   * chart. Naming a header reaches its one simple posting account. */
  accountNamed(name: string): Node {
    const root = this.accountsRoot();
    for (const top of this.core.things(root.id, 'Account')) {
      const type = this.prototypeOf(top.id)?.name ?? top.name;
      if (!(ACCOUNT_TYPES as readonly string[]).includes(type)) continue;
      const local = top.name === name ? top : this.core.findNamed(top.id, name, 'Account');
      if (local) return this.isHeader(local.id) ? this.productUnder(local, {}) : local;
    }
    const item = this.existing('Items', name);
    if (item) return this.productAccount('Inventory', { item });
    const contact = this.existing('Contacts', name);
    if (contact) return this.contactAccount(contact);
    const account = this.chartAccount(name);
    return this.isHeader(account.id) ? this.productUnder(account, {}) : account;
  }

  balance(account: number): number {
    return this.store.balance(account);
  }

  /** The entries of this ledger carrying a yes/no relation, such as the
   * closing entries. */
  entriesMarked(relation: string): number[] {
    const entries = this.store.child(this.ledger.id, 'Entries');
    if (!entries) return [];
    return this.core.things(entries.id, 'Entry').filter((e) => this.core.is(e.id, relation)).map((e) => e.id);
  }

  sums(range: DateRange = {}, excludeEntries: number[] = []): Map<number, number> {
    return this.store.sums(range, excludeEntries);
  }
}
