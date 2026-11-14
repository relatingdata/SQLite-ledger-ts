// Reports over the two stores. Every figure is a sum of journal lines
// against the accounts of the instance's ledger; nothing is kept
// pre-computed.

import type { Instance } from './core.js';
import type { Node, DateRange } from './store.js';

export interface TrialBalance {
  total_debit_minor: number;
  total_credit_minor: number;
  rows: { account: string; type: string; balance_minor: number }[];
}

export interface ProfitAndLoss {
  total_income_minor: number;
  total_expense_minor: number;
  net_income_minor: number;
}

export interface BalanceSheet {
  total_assets_minor: number;
  total_liabilities_minor: number;
  total_equity_minor: number;
  /** Income less expenses not yet closed to Retained Earnings. */
  current_earnings_minor: number;
  balanced: boolean;
}

export interface AxisNode {
  key: string;
  profitAndLoss: ProfitAndLoss;
  children: AxisNode[];
}

const UNASSIGNED = '(none)';

interface MoneyBalance {
  node: Node;
  type: string;
  amount: number;
}

/** Balances of the ledger's money accounts of the five statement types. */
function moneyBalances(inst: Instance, range: DateRange, excludeEntries: number[] = []): MoneyBalance[] {
  const sums = inst.sums(range, excludeEntries);
  const out: MoneyBalance[] = [];
  for (const { node, type } of inst.statementAccounts()) {
    const amount = sums.get(node.id);
    if (amount === undefined || amount === 0) continue;
    if (inst.unitOf(node.id) !== '') continue;
    out.push({ node, type, amount });
  }
  return out;
}

export function trialBalance(inst: Instance, asOf?: string): TrialBalance {
  const balances = moneyBalances(inst, { to: asOf });
  let debit = 0;
  let credit = 0;
  for (const b of balances) {
    if (b.amount > 0) debit += b.amount;
    else credit -= b.amount;
  }
  return {
    total_debit_minor: debit,
    total_credit_minor: credit,
    rows: balances.map((b) => ({ account: b.node.name, type: b.type, balance_minor: b.amount })),
  };
}

function summarise(balances: MoneyBalance[]): ProfitAndLoss {
  let income = 0;
  let expense = 0;
  for (const b of balances) {
    if (b.type === 'Income') income -= b.amount;
    else if (b.type === 'Expense') expense += b.amount;
  }
  return { total_income_minor: income, total_expense_minor: expense, net_income_minor: income - expense };
}

/** Income less expenses over a period. Closing entries are left out, so the
 * figure for a year is the same before and after its books are closed. */
export function profitAndLoss(inst: Instance, from?: string, to?: string): ProfitAndLoss {
  return summarise(moneyBalances(inst, { from, to }, inst.entriesMarked('Closing')));
}

export function balanceSheet(inst: Instance, asOf?: string): BalanceSheet {
  const balances = moneyBalances(inst, { to: asOf });
  let assets = 0;
  let liabilities = 0;
  let equity = 0;
  let earnings = 0;
  for (const b of balances) {
    if (b.type === 'Asset') assets += b.amount;
    else if (b.type === 'Liability') liabilities -= b.amount;
    else if (b.type === 'Equity') equity -= b.amount;
    else earnings -= b.amount;
  }
  return {
    total_assets_minor: assets,
    total_liabilities_minor: liabilities,
    total_equity_minor: equity,
    current_earnings_minor: earnings,
    balanced: assets === liabilities + equity + earnings,
  };
}

/** The value an account takes along a reporting axis. `Item` and `Location`
 * are the account's own dimensions; any other axis is a hierarchy grouping,
 * read from the account's item, then its location, then the account. */
function axisValue(inst: Instance, account: Node, axis: string): string {
  if (axis === 'Consolidated') return 'Consolidated';
  const item = inst.core.related(account.id, 'Item');
  const location = inst.core.related(account.id, 'Location');
  if (axis === 'Item') return item?.name ?? UNASSIGNED;
  if (axis === 'Location') return location?.name ?? UNASSIGNED;
  for (const holder of [item, location, account]) {
    const value = holder && inst.core.related(holder.id, axis);
    if (value) return value.name;
  }
  return UNASSIGNED;
}

/** Profit and loss broken down along an outer axis, and within each of its
 * groups along an inner axis. The groups always add up to the whole. */
export function profitAndLossByAxis(inst: Instance, from: string | undefined, to: string | undefined, outer: string, inner: string): AxisNode[] {
  const balances = moneyBalances(inst, { from, to }, inst.entriesMarked('Closing')).filter((b) => b.type === 'Income' || b.type === 'Expense');
  const group = (rows: MoneyBalance[], axis: string): Map<string, MoneyBalance[]> => {
    const groups = new Map<string, MoneyBalance[]>();
    for (const row of rows) {
      const key = axisValue(inst, row.node, axis);
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return groups;
  };
  return [...group(balances, outer)].map(([key, rows]) => ({
    key,
    profitAndLoss: summarise(rows),
    children:
      inner === 'Consolidated'
        ? []
        : [...group(rows, inner)].map(([innerKey, innerRows]) => ({ key: innerKey, profitAndLoss: summarise(innerRows), children: [] })),
  }));
}

export interface InventoryGroup {
  location: string;
  rows: { item: string; quantity_on_hand: number }[];
}

/** Stock on hand, by location and item, summed over any further dimensions. */
export function inventoryListing(inst: Instance): InventoryGroup[] {
  const accounts = inst.store.child(inst.accountsRoot().id, 'Quantities');
  const onHand = accounts && inst.store.child(accounts.id, 'On Hand');
  if (!onHand) return [];
  const byLocation = new Map<string, Map<string, number>>();
  for (const account of inst.core.things(onHand.id, 'Account')) {
    const item = inst.core.related(account.id, 'Item');
    const location = inst.core.related(account.id, 'Location');
    if (!item || !location) continue;
    const rows = byLocation.get(location.name) ?? new Map<string, number>();
    rows.set(item.name, (rows.get(item.name) ?? 0) + inst.balance(account.id));
    byLocation.set(location.name, rows);
  }
  return [...byLocation].map(([location, rows]) => ({
    location,
    rows: [...rows].map(([item, quantity_on_hand]) => ({ item, quantity_on_hand })),
  }));
}
