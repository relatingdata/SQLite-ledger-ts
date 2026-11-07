// Documented in docs/pm-reports-reference.md, "The Sales/COGS and
// Stock-on-Hand matrix reports" - this file carries no further
// multiline comments.
import { db } from './db.js';
import { getHierarchyParent, getBusinessHierarchy } from './db.js';
import { buildProfitAndLossFromBalances, getLedgerBalances, type ProfitAndLoss } from './db-reports.js';
import { allQtyLocationAccounts } from './db-stock.js';
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

// 'Category', 'Division', or any other business-defined grouping flows
// through the same, single generic Hierarchy branch below — only
// Consolidated/Item/Location are structural literals here.
export type MatrixAxis = 'Item' | 'Location' | 'Consolidated' | (string & {});

export interface MatrixCell {
  rowKey: string;
  colKey: string;
  salesMinor: number;
  cogsMinor: number;
}

export interface SalesCogsMatrix {
  rowAxis: MatrixAxis;
  colAxis: MatrixAxis;
  cells: MatrixCell[];
  totalSalesMinor: number;
  totalCogsMinor: number;
}

const CONSOLIDATED_KEY = 'Consolidated';
const NO_LOCATION_KEY = '(No location)';

function loadEntityIndex(): Map<number, { name: string; parent_id: number | null }> {
  const index = new Map<number, { name: string; parent_id: number | null }>();
  for (const e of Entity.findAll({})) index.set(e.id, { name: e.name, parent_id: e.parent_id });
  return index;
}

function stripLocationSuffix(name: string): string {
  let n = name;
  if (n.startsWith('Sales - ')) n = n.slice('Sales - '.length);
  else if (n.startsWith('COGS - ')) n = n.slice('COGS - '.length);
  const idx = n.indexOf(' — ');
  return idx === -1 ? n : n.slice(0, idx);
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

export function getSalesCogsMatrix(businessName: BusinessName, ledgerName: LedgerName, fromDate: string | undefined, toDate: string | undefined, rowAxis: MatrixAxis, colAxis: MatrixAxis): SalesCogsMatrix {
  const entityIndex = loadEntityIndex();
  const ledgerId = resolveLedgerEntityId(businessName, ledgerName) ?? -1;
  // The original query's WITH RECURSIVE ancestors + current_entities joins
  // did two jobs at once: (1) find every account entity descending from a
  // "Sales Revenue"/"Cost of Goods Sold" entity, and (2) read each account's
  // own name for the isSales check. Both are pure entity-graph work —
  // accountIdsUnderNamed (below) does (1) in TypeScript via entityIndex
  // (already loaded for resolveKey below), and entityIndex itself already
  // carries every entity's name for (2) — so the SQL below needs no
  // current_entities join at all, only account/journal_occurrences/journal.
  const salesCogsIds = accountIdsUnderNamed(entityIndex, ['Sales Revenue', 'Cost of Goods Sold']);

  const rows = db
    .prepare(
      `SELECT a.entity_id AS id, SUM(jo.amount_minor) AS balance_minor
       FROM account a
       JOIN journal_occurrences jo ON jo.account_id = a.entity_id
       JOIN journal j ON j.id = jo.journal_id
       WHERE jo.ledger_id = ?
         AND (? IS NULL OR jo.transdate >= ?)
         AND (? IS NULL OR jo.transdate <= ?)
         AND j.reference NOT LIKE 'CLOSE-%'
       GROUP BY a.entity_id`
    )
    .all(ledgerId, fromDate ?? null, fromDate ?? null, toDate ?? null, toDate ?? null) as { id: number; balance_minor: number }[];

  const cellMap = new Map<string, MatrixCell>();
  let totalSalesMinor = 0;
  let totalCogsMinor = 0;

  for (const r of rows) {
    if (r.balance_minor === 0 || !salesCogsIds.has(r.id)) continue;
    const name = entityIndex.get(r.id)?.name ?? '';
    const isSales = name.startsWith('Sales - ');
    const rowKey = resolveKey(rowAxis, r.id, entityIndex);
    const colKey = resolveKey(colAxis, r.id, entityIndex);
    const key = `${rowKey}\u0000${colKey}`;
    if (!cellMap.has(key)) cellMap.set(key, { rowKey, colKey, salesMinor: 0, cogsMinor: 0 });
    const cell = cellMap.get(key)!;
    if (isSales) {
      cell.salesMinor += -r.balance_minor;
      totalSalesMinor += -r.balance_minor;
    } else {
      cell.cogsMinor += r.balance_minor;
      totalCogsMinor += r.balance_minor;
    }
  }

  return { rowAxis, colAxis, cells: [...cellMap.values()], totalSalesMinor, totalCogsMinor };
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
// one of `rootNames` — pure entity-graph work, no SQL. Shared by
// plAccountIds (roots: Income/Expense) and getSalesCogsMatrix's own
// Sales Revenue/Cost of Goods Sold lookup, same one-helper-not-two
// discipline as every other shared shape in this rollout.
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
  Category: string[];
  Location: string[];
  [hierarchyName: string]: string[];
}

export function getAxisValues(businessName: BusinessName, ledgerName: LedgerName): AxisValues {
  const entityIndex = loadEntityIndex();
  const validIds = plAccountIds(entityIndex);
  const balances = getLedgerBalances(businessName, ledgerName, undefined, undefined, true);

  const products = new Set<string>();
  const categories = new Set<string>();
  const locations = new Set<string>();
  const hierarchyNames = getBusinessHierarchy(businessName).map((g) => g.grouping);
  const hierarchyValues = new Map<string, Set<string>>(hierarchyNames.map((n) => [n, new Set<string>()]));

  for (const [id, balance] of balances.entries()) {
    if (!validIds.has(id) || balance === 0) continue;
    const item = resolveKey('Item', id, entityIndex);
    if (item !== CONSOLIDATED_KEY) products.add(item);
    const category = resolveKey('Category', id, entityIndex);
    if (category !== CONSOLIDATED_KEY) categories.add(category);
    const location = resolveKey('Location', id, entityIndex);
    if (location !== NO_LOCATION_KEY) locations.add(location);
    for (const name of hierarchyNames) {
      const value = resolveKey(name, id, entityIndex);
      if (!value.startsWith('No ')) hierarchyValues.get(name)!.add(value);
    }
  }

  const result: AxisValues = {
    Item: [...products].sort(),
    Category: [...categories].sort(),
    Location: [...locations].sort(),
  };
  for (const [name, values] of hierarchyValues) result[name] = [...values].sort();
  return result;
}
