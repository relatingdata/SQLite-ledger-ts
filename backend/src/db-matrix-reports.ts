// Documented in docs/pm-reports-reference.md, "The Sales/COGS and
// Stock-on-Hand matrix reports" - this file carries no further
// multiline comments.
import { db } from './db.js';
import { getHierarchyParent, getBusinessHierarchy } from './db.js';
import { buildProfitAndLossFromBalances, getLedgerBalances, type ProfitAndLoss } from './db-reports.js';
import type { BusinessName, LedgerName } from './db.js';

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
  const rows = db.prepare(`SELECT id, name, parent_id FROM current_entities`).all() as { id: number; name: string; parent_id: number | null }[];
  const index = new Map<number, { name: string; parent_id: number | null }>();
  for (const r of rows) index.set(r.id, { name: r.name, parent_id: r.parent_id });
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
  const row = db
    .prepare(
      `SELECT target.name AS location_name
       FROM current_entities child
       JOIN current_entities target ON target.id = child.relation_id
       WHERE child.name = ?`
    )
    .get(`${accountName} — Hierarchy: Location`) as { location_name: string } | undefined;
  return row?.location_name;
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

  const rows = db
    .prepare(
      `WITH RECURSIVE ancestors(id, orig) AS (
         SELECT id, id FROM current_entities
         UNION ALL
         SELECT e.parent_id, a.orig FROM current_entities e JOIN ancestors a ON e.id = a.id WHERE e.parent_id IS NOT NULL
       ),
       sales_cogs_accounts AS (
         SELECT DISTINCT orig AS id FROM ancestors a
         JOIN current_entities e ON e.id = a.id
         WHERE e.name IN ('Sales Revenue', 'Cost of Goods Sold')
       )
       SELECT a.entity_id AS id, e.name AS name,
              SUM(jo.amount_minor) AS balance_minor
       FROM account a
       JOIN current_entities e ON e.id = a.entity_id
       JOIN sales_cogs_accounts sca ON sca.id = a.entity_id
       JOIN journal_occurrences jo ON jo.account_id = a.entity_id
       JOIN journal j ON j.id = jo.journal_id
       WHERE jo.ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Ledgers' AND parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses'))))
         AND (? IS NULL OR jo.transdate >= ?)
         AND (? IS NULL OR jo.transdate <= ?)
         AND j.reference NOT LIKE 'CLOSE-%'
       GROUP BY a.entity_id`
    )
    .all(ledgerName, businessName, fromDate ?? null, fromDate ?? null, toDate ?? null, toDate ?? null) as { id: number; name: string; balance_minor: number }[];

  const cellMap = new Map<string, MatrixCell>();
  let totalSalesMinor = 0;
  let totalCogsMinor = 0;

  for (const r of rows) {
    if (r.balance_minor === 0) continue;
    const isSales = r.name.startsWith('Sales - ');
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
  const rows = db
    .prepare(
      `SELECT item.id AS item_id, item.name AS item_name, loc.name AS location_name,
              acct.balance_minor AS quantity_on_hand, p.item_retail_price_minor AS retail_price_minor,
              (SELECT ps.price_minor FROM item_source ps WHERE ps.item_id = item.id ORDER BY ps.is_preferred DESC, ps.id ASC LIMIT 1) AS package_cost_minor,
              (SELECT ps.package_quantity FROM item_source ps WHERE ps.item_id = item.id ORDER BY ps.is_preferred DESC, ps.id ASC LIMIT 1) AS package_quantity
       FROM current_entities leaf
       JOIN account acct ON acct.entity_id = leaf.id
       JOIN current_entities item ON item.id = leaf.parent_id
       JOIN current_entities link ON link.name = leaf.name || ' — Hierarchy: Location'
       JOIN current_entities loc ON loc.id = link.relation_id
       JOIN contact p ON p.entity_id = item.id
       WHERE leaf.name LIKE '% — Qty'
         AND acct.balance_minor != 0`
    )
    .all() as {
    item_id: number;
    item_name: string;
    location_name: string;
    quantity_on_hand: number;
    retail_price_minor: number | null;
    package_cost_minor: number | null;
    package_quantity: number | null;
  }[];

  const cellMap = new Map<string, StockOnHandCell>();
  let totalValueAtCostMinor = 0;
  let totalRealizableValueMinor = 0;

  for (const r of rows) {
    const rowKey = resolveItemKey(rowAxis, r.item_name, r.location_name);
    const colKey = resolveItemKey(colAxis, r.item_name, r.location_name);

    const key = `${rowKey}\u0000${colKey}`;
    if (!cellMap.has(key)) {
      cellMap.set(key, { rowKey, colKey, quantityBottles: 0, valueAtCostMinor: 0, lastCostMinor: null, averageCostMinor: null, realizableValueMinor: 0 });
    }
    const cell = cellMap.get(key)!;
    const costMinor = r.package_cost_minor && r.package_quantity ? Math.round(r.package_cost_minor / r.package_quantity) : 0;
    const valueAtCost = r.quantity_on_hand * costMinor;
    const realizable = r.quantity_on_hand * (r.retail_price_minor ?? 0);
    cell.quantityBottles += r.quantity_on_hand;
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

function plAccountIds(entityIndex: Map<number, { name: string; parent_id: number | null }>): Set<number> {
  const rootIds = new Set<number>();
  for (const [id, e] of entityIndex.entries()) {
    if (e.name === 'Income' || e.name === 'Expense') rootIds.add(id);
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
