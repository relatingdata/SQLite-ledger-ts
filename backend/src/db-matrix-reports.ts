// Documented in docs/pm-reports-reference.md, "The Sales/COGS and
// Stock-on-Hand matrix reports" - this file carries no further
// multiline comments.
import { db } from './db.js';
import { getHierarchyParent, getBusinessHierarchy } from './db.js';
import { buildProfitAndLossFromBalances, getLedgerBalances, type ProfitAndLoss } from './db-reports.js';
import { allQtyLocationAccounts, stockCostLayers } from './db-stock.js';
import { resolveBusinessLocationsRootId, asItemName, asLocationName } from './db.js';
import type { BusinessName, LedgerName } from './db.js';
import { Entity } from './primitives.js';

// Same business/ledger id resolution pattern as db-journal.ts/db-reports.ts's
// identical local helpers, duplicated here per Stage C discipline.
function resolveLedgerEntityId(business: string, ledger: string): number | undefined {
  const businessId = Entity.get(business, 'Businesses')?.id;
  if (businessId === undefined) return undefined;
  const ledgersRoot = Entity.getUnder('Ledgers', businessId);
  return ledgersRoot ? Entity.getUnder(ledger, ledgersRoot.id)?.id : undefined;
}

// Every grouping of the business flows through the same generic branch
// below; only Consolidated/Item/Location are axes of their own.
export type MatrixAxis = 'Item' | 'Location' | 'Consolidated' | (string & {});

const CONSOLIDATED_KEY = 'Consolidated';
const NO_LOCATION_KEY = '(No location)';

function loadEntityIndex(): Map<number, { name: string; parent_id: number | null }> {
  const index = new Map<number, { name: string; parent_id: number | null }>();
  for (const e of Entity.findAll({})) index.set(e.id, { name: e.name, parent_id: e.parent_id });
  return index;
}

function stripLocationSuffix(name: string): string {
  const idx = name.indexOf(' — ');
  return idx === -1 ? name : name.slice(0, idx);
}

function locationForAccount(accountName: string): string | undefined {
  const child = Entity.get(`${accountName} — Hierarchy: Location`);
  if (!child || child.relation_id === null) return undefined;
  return Entity.get(child.relation_id)?.name;
}

function resolveKey(axis: MatrixAxis, accountId: number, entityIndex: Map<number, { name: string; parent_id: number | null }>): string {
  if (axis === 'Consolidated') return CONSOLIDATED_KEY;
  if (axis === 'Item') return stripLocationSuffix(entityIndex.get(accountId)?.name ?? '');
  const accountName = entityIndex.get(accountId)?.name ?? '';
  const location = locationForAccount(accountName);
  if (axis === 'Location') return location ?? NO_LOCATION_KEY;
  const baseProductName = stripLocationSuffix(entityIndex.get(accountId)?.name ?? '');
  const direct = getHierarchyParent(baseProductName, axis);
  if (direct) return direct;
  if (location) {
    const viaLocation = getHierarchyParent(location, axis);
    if (viaLocation) return viaLocation;
  }
  return `No ${axis}`;
}

function resolveItemKey(axis: MatrixAxis, itemName: string, locationName: string): string {
  if (axis === 'Consolidated') return CONSOLIDATED_KEY;
  if (axis === 'Item') return stripLocationSuffix(itemName);
  if (axis === 'Location') return locationName;
  const baseProductName = stripLocationSuffix(itemName);
  const direct = getHierarchyParent(baseProductName, axis);
  if (direct) return direct;
  const viaLocation = getHierarchyParent(locationName, axis);
  if (viaLocation) return viaLocation;
  return `No ${axis}`;
}

export interface StockOnHandCell {
  rowKey: string;
  colKey: string;
  quantityBottles: number;
  valueAtCostMinor: number;
  lastCostMinor: number | null;
  averageCostMinor: number | null;
  realizableValueMinor: number;
}

export interface StockOnHandMatrix {
  rowAxis: MatrixAxis;
  colAxis: MatrixAxis;
  cells: StockOnHandCell[];
  totalValueAtCostMinor: number;
  totalRealizableValueMinor: number;
}

export function getStockOnHandMatrix(rowAxis: MatrixAxis, colAxis: MatrixAxis): StockOnHandMatrix {
  // Quantity-on-hand is read directly from each real, provisioned
  // per-location quantity account's own balance_minor (see
  // ensureItemLocationQuantityAccount, backend/src/db.ts) rather than
  // summed from journal_line, which no longer carries a location of its
  // own — the account itself (a child of the item, named
  // "{item} — {location} — Qty") now carries the location, found the same
  // way locationForAccount above reads it, via the " — Hierarchy: Location"
  // link record. See docs/pm-domain-reference.md, "Quantity-on-hand by
  // location: real per-location accounts, not a side-channel column".
  //
  // This used to be one raw SQL statement joining current_entities four
  // times (leaf/item/link/loc) plus contact — a category-4 site. The
  // leaf/item/link/loc walk is exactly db-stock.ts's own
  // allQtyLocationAccounts() shape (same entity graph, same business
  // reasoning), so it's reused here rather than duplicated; only the
  // contact/item_source lookups (keyed by the now-already-resolved
  // itemId, no current_entities join needed) stay as plain SQL.
  const qtyRows = allQtyLocationAccounts().filter((r) => r.balance_minor !== 0);
  const itemIds = [...new Set(qtyRows.map((r) => r.itemId))];

  // The original query INNER JOINed contact (every row needed a matching
  // contact record to appear at all) — contactItemIds preserves that
  // exactly, rather than silently defaulting a missing contact to a $0
  // retail price.
  const contactRows =
    itemIds.length === 0
      ? []
      : (
          db
            .prepare(`SELECT entity_id, item_retail_price_minor FROM contact WHERE entity_id IN (${itemIds.map(() => '?').join(',')})`)
            .all(...itemIds) as { entity_id: number; item_retail_price_minor: number | null }[]
        );
  const contactItemIds = new Set(contactRows.map((c) => c.entity_id));
  const retailPriceByItemId = new Map(contactRows.map((c) => [c.entity_id, c.item_retail_price_minor]));
  const costByItemId = new Map(
    itemIds.length === 0
      ? []
      : (
          db
            .prepare(
              `SELECT item_id, price_minor AS package_cost_minor, package_quantity
               FROM item_source
               WHERE item_id IN (${itemIds.map(() => '?').join(',')})
               ORDER BY item_id, is_preferred DESC, id ASC`
            )
            .all(...itemIds) as { item_id: number; package_cost_minor: number | null; package_quantity: number | null }[]
        )
          // first row per item_id after the ORDER BY above is the preferred
          // (or, failing that, lowest-id) source — same tie-break as the
          // original correlated subqueries, just taken from one batched
          // query's first-seen row per item instead of N per-item ones.
          .filter((r, i, arr) => arr.findIndex((x) => x.item_id === r.item_id) === i)
          .map((r) => [r.item_id, r])
  );

  const cellMap = new Map<string, StockOnHandCell>();
  let totalValueAtCostMinor = 0;
  let totalRealizableValueMinor = 0;

  for (const r of qtyRows) {
    if (!contactItemIds.has(r.itemId)) continue; // original INNER JOIN contact
    const rowKey = resolveItemKey(rowAxis, r.item, r.location);
    const colKey = resolveItemKey(colAxis, r.item, r.location);

    const key = `${rowKey}\u0000${colKey}`;
    if (!cellMap.has(key)) {
      cellMap.set(key, { rowKey, colKey, quantityBottles: 0, valueAtCostMinor: 0, lastCostMinor: null, averageCostMinor: null, realizableValueMinor: 0 });
    }
    const cell = cellMap.get(key)!;
    const cost = costByItemId.get(r.itemId);
    const costMinor = cost?.package_cost_minor && cost?.package_quantity ? Math.round(cost.package_cost_minor / cost.package_quantity) : 0;
    const retailPriceMinor = retailPriceByItemId.get(r.itemId) ?? 0;
    const valueAtCost = r.balance_minor * costMinor;
    const realizable = r.balance_minor * retailPriceMinor;
    cell.quantityBottles += r.balance_minor;
    cell.valueAtCostMinor += valueAtCost;
    cell.realizableValueMinor += realizable;
    cell.lastCostMinor = costMinor || null;
    cell.averageCostMinor = costMinor || null;
    totalValueAtCostMinor += valueAtCost;
    totalRealizableValueMinor += realizable;
  }

  return { rowAxis, colAxis, cells: [...cellMap.values()], totalValueAtCostMinor, totalRealizableValueMinor };
}

export interface ProfitAndLossByAxisNode {
  key: string;
  profitAndLoss: ProfitAndLoss;
  children: ProfitAndLossByAxisNode[];
}

// Every entity id that is, or is a descendant of, an entity whose name is
// one of `rootNames` — pure entity-graph work, no SQL (plAccountIds:
// Income/Expense).
function accountIdsUnderNamed(entityIndex: Map<number, { name: string; parent_id: number | null }>, rootNames: string[]): Set<number> {
  const rootNameSet = new Set(rootNames);
  const rootIds = new Set<number>();
  for (const [id, e] of entityIndex.entries()) {
    if (rootNameSet.has(e.name)) rootIds.add(id);
  }
  const result = new Set<number>();
  for (const [id] of entityIndex.entries()) {
    let cur: number | undefined = id;
    let hops = 0;
    while (cur !== undefined && hops < 30) {
      if (rootIds.has(cur)) {
        result.add(id);
        break;
      }
      cur = entityIndex.get(cur)?.parent_id ?? undefined;
      hops++;
    }
  }
  return result;
}

function plAccountIds(entityIndex: Map<number, { name: string; parent_id: number | null }>): Set<number> {
  return accountIdsUnderNamed(entityIndex, ['Income', 'Expense']);
}

export function getProfitAndLossByAxis(
  businessName: BusinessName,
  ledgerName: LedgerName,
  fromDate: string | undefined,
  toDate: string | undefined,
  outerAxis: MatrixAxis,
  innerAxis: MatrixAxis,
  outerFilter?: string,
  innerFilter?: string
): ProfitAndLossByAxisNode[] {
  const entityIndex = loadEntityIndex();
  const validIds = plAccountIds(entityIndex);
  const balances = getLedgerBalances(businessName, ledgerName, fromDate, toDate, true);

  const resolved: { id: number; balance: number; outerKey: string; innerKey: string }[] = [];
  for (const [id, balance] of balances.entries()) {
    if (!validIds.has(id) || balance === 0) continue;
    const outerKey = resolveKey(outerAxis, id, entityIndex);
    if (outerFilter && outerKey !== outerFilter) continue;
    const innerKey = resolveKey(innerAxis, id, entityIndex);
    if (innerFilter && innerKey !== innerFilter) continue;
    resolved.push({ id, balance, outerKey, innerKey });
  }

  const outerKeys = [...new Set(resolved.map((r) => r.outerKey))].sort();
  const nodes: ProfitAndLossByAxisNode[] = [];
  for (const outerKey of outerKeys) {
    const outerRows = resolved.filter((r) => r.outerKey === outerKey);
    const outerBalances = new Map(outerRows.map((r) => [r.id, r.balance]));
    const outerPL = buildProfitAndLossFromBalances(businessName, outerBalances);

    const innerKeys = [...new Set(outerRows.map((r) => r.innerKey))].sort();
    const children: ProfitAndLossByAxisNode[] = [];
    if (innerAxis !== 'Consolidated' && innerKeys.length > 0 && !(innerKeys.length === 1 && innerKeys[0] === outerKey)) {
      for (const innerKey of innerKeys) {
        const innerRows = outerRows.filter((r) => r.innerKey === innerKey);
        const innerBalances = new Map(innerRows.map((r) => [r.id, r.balance]));
        children.push({ key: innerKey, profitAndLoss: buildProfitAndLossFromBalances(businessName, innerBalances), children: [] });
      }
    }

    nodes.push({ key: outerKey, profitAndLoss: outerPL, children });
  }

  return nodes;
}

export interface AxisValues {
  Item: string[];
  Location: string[];
  [hierarchyName: string]: string[];
}

/** Which side each grouping is on: items or locations — two axes of the
 * same side never cross. Filled in by getAxisValues: what a grouping of
 * the business's own records it groups; an application grouping by how
 * its values were reached. */
export type AxisGroups = Record<string, 'item' | 'location'>;

export function getAxisValues(businessName: BusinessName, ledgerName: LedgerName, groups: AxisGroups = {}): AxisValues {
  const entityIndex = loadEntityIndex();
  const validIds = plAccountIds(entityIndex);
  const balances = getLedgerBalances(businessName, ledgerName, undefined, undefined, true);

  const products = new Set<string>();
  const locations = new Set<string>();
  const hierarchy = getBusinessHierarchy(businessName);
  for (const g of hierarchy) if (g.groups) groups[g.grouping] = g.groups === 'Items' ? 'item' : 'location';
  const hierarchyNames = hierarchy.map((g) => g.grouping);
  const hierarchyValues = new Map<string, Set<string>>(hierarchyNames.map((n) => [n, new Set<string>()]));

  for (const [id, balance] of balances.entries()) {
    if (!validIds.has(id) || balance === 0) continue;
    const item = resolveKey('Item', id, entityIndex);
    if (item !== CONSOLIDATED_KEY) products.add(item);
    const location = resolveKey('Location', id, entityIndex);
    if (location !== NO_LOCATION_KEY) locations.add(location);
    for (const name of hierarchyNames) {
      const value = resolveKey(name, id, entityIndex);
      if (value.startsWith('No ')) continue;
      hierarchyValues.get(name)!.add(value);
      groups[name] ??= getHierarchyParent(item, name) ? 'item' : 'location';
    }
  }

  const result: AxisValues = {
    Item: [...products].sort(),
    Location: [...locations].sort(),
  };
  for (const [name, values] of hierarchyValues) result[name] = [...values].sort();
  return result;
}

// --- the general report cube -----------------------------------------------------
//
// Every financial event is a journal posting to an account, and an
// account resolves to an Item, a Location and each of the business's
// groupings (resolveKey above). So any report on sales, cost of goods sold
// or stock is: some measures, each a total over a set of accounts (or the
// on-hand quantity of stock, possibly valued at a price), broken down by a
// row axis and a column axis. getStockOnHandMatrix is one fixed instance;
// getCube takes the measures as configuration.

/** A measure: what each cell totals.
 * - postings: the journal postings (in the period; or, with no fromDate, up
 *   to toDate) to every account under one of `under`, times `sign`; an
 *   entry `#TAG` instead means every account tagged TAG (as each item's
 *   cost of goods sold account is tagged COGS);
 * - onHand: the quantity of stock on hand now;
 * - stockValue: what the stock on hand cost, as the Inventory value the
 *   books hold for it (its first-in, first-out cost layers);
 * - onHandAt: on-hand quantity valued at each item's preferred source cost
 *   per unit ('cost') or its retail price ('retail'). */
export type CubeMeasure =
  | { name: string; kind: 'postings'; under: string[]; sign: 1 | -1 }
  | { name: string; kind: 'onHand' }
  | { name: string; kind: 'stockValue' }
  | { name: string; kind: 'onHandAt'; price: 'cost' | 'retail' };

export interface CubeCell {
  rowKey: string;
  colKey: string;
  values: Record<string, number>;
}

/** A measure written as text, as calls carry it: `name=postings:-Root|Root`,
 * `name=onHand`, `name=stockValue`, `name=onHandAt:cost` or
 * `name=onHandAt:retail`. */
export function parseCubeMeasure(text: string): CubeMeasure {
  const eq = text.indexOf('=');
  if (eq <= 0) throw new Error(`A measure is name=kind: ${text}`);
  const name = text.slice(0, eq);
  const [kind, ...rest] = text.slice(eq + 1).split(':');
  const arg = rest.join(':');
  if (kind === 'postings') {
    const sign = arg.startsWith('-') ? -1 : 1;
    const under = arg.replace(/^[+-]/, '').split('|').filter((s) => s !== '');
    if (under.length === 0) throw new Error(`postings needs the accounts it totals: ${text}`);
    return { name, kind, under, sign };
  }
  if (kind === 'onHand' || kind === 'stockValue') return { name, kind };
  if (kind === 'onHandAt' && (arg === 'cost' || arg === 'retail')) return { name, kind, price: arg };
  throw new Error(`Unknown measure: ${text}`);
}

export function getCube(
  businessName: BusinessName,
  ledgerName: LedgerName,
  rowAxis: MatrixAxis,
  colAxis: MatrixAxis,
  measures: CubeMeasure[],
  fromDate?: string,
  toDate?: string
): CubeCell[] {
  const cells = new Map<string, CubeCell>();
  const add = (rowKey: string, colKey: string, name: string, amount: number) => {
    const key = `${rowKey}\u0000${colKey}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = { rowKey, colKey, values: Object.fromEntries(measures.map((m) => [m.name, 0])) };
      cells.set(key, cell);
    }
    cell.values[name] += amount;
  };

  const postings = measures.filter((m): m is Extract<CubeMeasure, { kind: 'postings' }> => m.kind === 'postings');
  if (postings.length > 0) {
    const entityIndex = loadEntityIndex();
    const ledgerId = resolveLedgerEntityId(businessName, ledgerName) ?? -1;
    const totals = db
      .prepare(
        `SELECT jo.account_id AS id, SUM(jo.amount_minor) AS balance_minor
         FROM journal_occurrences jo
         JOIN journal j ON j.id = jo.journal_id
         WHERE jo.ledger_id = ?
           AND (? IS NULL OR jo.transdate >= ?)
           AND (? IS NULL OR jo.transdate <= ?)
           AND j.reference NOT LIKE 'CLOSE-%'
         GROUP BY jo.account_id`
      )
      .all(ledgerId, fromDate ?? null, fromDate ?? null, toDate ?? null, toDate ?? null) as { id: number; balance_minor: number }[];
    const accountsOf = new Map(
      postings.map((m) => {
        const roots = m.under.filter((u) => !u.startsWith('#'));
        const ids = roots.length > 0 ? accountIdsUnderNamed(entityIndex, roots) : new Set<number>();
        for (const tag of m.under.filter((u) => u.startsWith('#'))) {
          const tagId = Entity.get(tag.slice(1))?.id;
          if (tagId !== undefined) for (const e of Entity.findAll({ relationId: tagId })) ids.add(e.id);
        }
        return [m.name, ids];
      })
    );
    for (const r of totals) {
      if (r.balance_minor === 0) continue;
      let keys: [string, string] | undefined;
      for (const m of postings) {
        if (!accountsOf.get(m.name)!.has(r.id)) continue;
        keys ??= [resolveKey(rowAxis, r.id, entityIndex), resolveKey(colAxis, r.id, entityIndex)];
        add(keys[0], keys[1], m.name, m.sign * r.balance_minor);
      }
    }
  }

  const stock = measures.filter((m) => m.kind === 'onHand' || m.kind === 'onHandAt' || m.kind === 'stockValue');
  if (stock.length > 0) {
    // Only this business's own locations.
    const locationsRootId = resolveBusinessLocationsRootId(businessName);
    const ours = (location: string) => locationsRootId !== undefined && Entity.getUnder(location, locationsRootId) !== undefined;
    for (const s of stockOnHandRows().filter((r) => ours(r.location))) {
      const rowKey = resolveItemKey(rowAxis, s.item, s.location);
      const colKey = resolveItemKey(colAxis, s.item, s.location);
      for (const m of stock) {
        const amount =
          m.kind === 'onHand'
            ? s.quantity
            : m.kind === 'stockValue'
              ? stockCostLayers(businessName, ledgerName, asItemName(s.item), asLocationName(s.location)).reduce((t, l) => t + l.value, 0)
              : s.quantity * (m.price === 'cost' ? s.unitCostMinor : s.retailPriceMinor);
        add(rowKey, colKey, m.name, amount);
      }
    }
  }

  return [...cells.values()].filter((c) => Object.values(c.values).some((v) => v !== 0));
}

/** Each item at each location with stock on hand: its quantity, its
 * preferred source's cost per unit, and its retail price (the same reading
 * as getStockOnHandMatrix: only items with a contact record). */
function stockOnHandRows(): { item: string; location: string; quantity: number; unitCostMinor: number; retailPriceMinor: number }[] {
  const qtyRows = allQtyLocationAccounts().filter((r) => r.balance_minor !== 0);
  const itemIds = [...new Set(qtyRows.map((r) => r.itemId))];
  if (itemIds.length === 0) return [];
  const marks = itemIds.map(() => '?').join(',');
  const contacts = db.prepare(`SELECT entity_id, item_retail_price_minor FROM contact WHERE entity_id IN (${marks})`).all(...itemIds) as {
    entity_id: number;
    item_retail_price_minor: number | null;
  }[];
  const retail = new Map(contacts.map((c) => [c.entity_id, c.item_retail_price_minor ?? 0]));
  const sources = db
    .prepare(`SELECT item_id, price_minor, package_quantity FROM item_source WHERE item_id IN (${marks}) ORDER BY item_id, is_preferred DESC, id ASC`)
    .all(...itemIds) as { item_id: number; price_minor: number | null; package_quantity: number | null }[];
  const unitCost = new Map<number, number>();
  for (const s of sources) {
    if (unitCost.has(s.item_id)) continue;
    unitCost.set(s.item_id, s.price_minor && s.package_quantity ? Math.round(s.price_minor / s.package_quantity) : 0);
  }
  return qtyRows
    .filter((r) => retail.has(r.itemId))
    .map((r) => ({ item: r.item, location: r.location, quantity: r.balance_minor, unitCostMinor: unitCost.get(r.itemId) ?? 0, retailPriceMinor: retail.get(r.itemId) ?? 0 }));
}
