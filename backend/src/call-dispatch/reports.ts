// Converted from routes/reports.ts. The whole router was mounted behind
// a blanket requireAuth in server.ts; the two bank-account mutations
// further require Administrator or Bookkeeper, replicated per-function
// here, same as every other file in this rollout.
import {
  getBusinessReports,
  getChartOfAccounts,
  getTrialBalance,
  getBalanceSheet,
  getProfitAndLoss,
  getProfitAndLossByHierarchy,
  getProfitAndLossByHierarchyTree,
  getProfitAndLossForHierarchyGroup,
  getHierarchyGroups,
  getTrialBalanceComparison,
  getProfitAndLossComparison,
  getSalesReport,
  getLedgerDateRange,
  registerBankAccount,
  unregisterBankAccount,
  getBankAccounts,
  getCashPosition,
  getCashFlowForecast,
  asBusinessName,
  asLedgerName,
  ValidationError,
  asUserId,
  type ProfitAndLoss,
  type ProfitAndLossByGroupNode,
} from '../db.js';
import { Balance, Hierarchy } from '../primitives.js';
import {
  CallError,
  encodeCategoryTree,
  encodeGenericTree,
  encodeRecordList,
  encodeStringList,
  requireAuth,
  requireRole,
  row,
  table,
  type BackendCall,
  type WireCategoryTreeNode,
} from '../call-dispatch.js';

const STATEMENT_LINE_FIELDS: ('name' | 'accountnumber' | 'debit_minor' | 'credit_minor' | 'is_contra')[] = ['name', 'accountnumber', 'debit_minor', 'credit_minor', 'is_contra'];

// A ProfitAndLoss is embedded both at the top level (getProfitAndLoss)
// and once per node inside a ProfitAndLossByGroupNode tree
// (getProfitAndLossByHierarchyTree) — one shared encode/decode pair, used
// both ways, rather than two separate encodings for the same shape.
// Exported for matrix-reports.ts's getProfitAndLossByAxis, which embeds
// the exact same ProfitAndLoss shape at every node of its own axis tree.
export function encodeProfitAndLoss(pl: ProfitAndLoss): string {
  return encodeStringList([
    encodeRecordList(STATEMENT_LINE_FIELDS, pl.income),
    encodeRecordList(STATEMENT_LINE_FIELDS, pl.expenses),
    encodeRecordList(STATEMENT_LINE_FIELDS, pl.cogs_expenses),
    encodeRecordList(STATEMENT_LINE_FIELDS, pl.operating_expenses),
    encodeCategoryTree(pl.income_tree as WireCategoryTreeNode[]),
    encodeCategoryTree(pl.cogs_tree as WireCategoryTreeNode[]),
    encodeCategoryTree(pl.operating_expenses_tree as WireCategoryTreeNode[]),
    String(pl.total_income_minor),
    String(pl.total_expenses_minor),
    String(pl.gross_profit_minor),
    String(pl.net_income_minor),
  ]);
}

// A ProfitAndLossByGroupNode tree nests a genuine, arbitrary-depth group
// tree (children: ProfitAndLossByGroupNode[]) AND, at every node, a full
// ProfitAndLoss (itself containing three more arbitrary-depth category
// trees) — the deepest nesting in this whole rollout. Built from exactly
// the same two recursive primitives (encodeStringList/encodeCategoryTree)
// applied as many times as the real shape needs, not a one-off encoding.
function encodeProfitAndLossByGroupTree(nodes: ProfitAndLossByGroupNode[]): string {
  return encodeStringList(nodes.map((n) => encodeStringList([n.group ?? '', encodeProfitAndLoss(n.profitAndLoss), encodeProfitAndLossByGroupTree(n.children)])));
}

export const reportsFunctions: Record<string, BackendCall> = {
  // Positional args: [0] business. No live frontend caller (already
  // commented out as unused in api.ts) — built anyway for a complete
  // backend surface. combination_ids is the one other approved JSON
  // exception — carried through as a plain, un-decoded string field,
  // same as everywhere else it appears.
  getBusinessReports: (v, user) => {
    requireAuth(user);
    const [business] = v;
    if (!business) throw new CallError(400, 'business is required.');
    return table(
      ['report', 'category', 'account', 'account_id', 'depth', 'combination_ids', 'accountnumber', 'balance_minor'],
      getBusinessReports(business)
    );
  },
  // Positional args: [0] business. No live frontend caller — built
  // anyway for completeness.
  getChartOfAccounts: (v, user) => {
    requireAuth(user);
    const [business] = v;
    if (!business) throw new CallError(400, 'business is required.');
    return table(['id', 'name', 'depth', 'path', 'accountnumber', 'balance_minor'], getChartOfAccounts(business));
  },
  // Positional args: [0] business, [1] ledger.
  getBankAccounts: (v, user) => {
    requireAuth(user);
    const [business, ledger] = v;
    if (!business || !ledger) throw new CallError(400, 'business and ledger are both required.');
    return table(['name', 'accountnumber', 'balance_minor', 'currency', 'overdraft_limit_minor', 'scope'], getBankAccounts(asBusinessName(business), asLedgerName(ledger)));
  },
  // Positional args: [0] business, [1] ledger.
  getCashPosition: (v, user) => {
    requireAuth(user);
    const [business, ledger] = v;
    if (!business || !ledger) throw new CallError(400, 'business and ledger are both required.');
    return table(['currency', 'total_balance_minor', 'total_overdraft_limit_minor', 'headroom_minor'], getCashPosition(asBusinessName(business), asLedgerName(ledger)));
  },
  // Positional args: [0] business, [1] ledger, [2] asOfDate (optional),
  // [3] horizonDays (optional, default 90).
  getCashFlowForecast: (v, user) => {
    requireAuth(user);
    const [business, ledger, asOfDateRaw, horizonDaysRaw] = v;
    if (!business || !ledger) throw new CallError(400, 'business and ledger are both required.');
    const asOfDate = asOfDateRaw || new Date().toISOString().slice(0, 10);
    const horizonDays = horizonDaysRaw ? Number(horizonDaysRaw) : 90;
    if (!Number.isFinite(horizonDays) || horizonDays <= 0 || horizonDays > 365) throw new CallError(400, 'horizonDays must be a real number between 1 and 365.');
    const forecast = getCashFlowForecast(asBusinessName(business), asLedgerName(ledger), asOfDate, horizonDays);
    return row(
      forecast.as_of_date,
      forecast.horizon_end_date,
      forecast.starting_cash_minor,
      forecast.overdraft_limit_minor,
      encodeRecordList(['date', 'description', 'amount_minor', 'source'], forecast.lines),
      forecast.ending_cash_minor,
      forecast.lowest_projected_balance_minor,
      forecast.lowest_balance_date,
      forecast.first_shortfall_date,
      forecast.first_shortfall_amount_minor
    );
  },
  // Positional args: [0] accountName, [1] business, [2] scopeName,
  // [3] overdraftLimitMinor (optional).
  registerBankAccount: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [accountName, business, scopeName, overdraftLimitMinorRaw] = v;
    if (!accountName || !business || !scopeName) throw new CallError(400, 'accountName, business and scopeName are all required.');
    try {
      registerBankAccount(accountName, business, scopeName, overdraftLimitMinorRaw ? Number(overdraftLimitMinorRaw) : null, asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] accountName.
  unregisterBankAccount: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [accountName] = v;
    if (!accountName) throw new CallError(400, 'accountName is required.');
    try {
      unregisterBankAccount(accountName, asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] business, [1] ledger, [2] fromDate (optional),
  // [3] toDate (optional).
  getSalesReport: (v, user) => {
    requireAuth(user);
    const [business, ledger, fromDate, toDate] = v;
    if (!business || !ledger) throw new CallError(400, 'business and ledger query parameters are both required.');
    const report = getSalesReport(asBusinessName(business), asLedgerName(ledger), fromDate || undefined, toDate || undefined);
    return row(
      encodeRecordList(['invoice_date', 'reference', 'item_name', 'description', 'quantity', 'unit_price_minor', 'amount_minor'], report.detailed),
      encodeRecordList(['category', 'quantity', 'amount_minor'], report.category_summary),
      report.total_quantity,
      report.total_amount_minor
    );
  },
  // Positional args: [0] business, [1] ledger, [2] asOfDate (optional).
  getTrialBalance: (v, user) => {
    requireAuth(user);
    const [business, ledger, asOfDate] = v;
    if (!business || !ledger) throw new CallError(400, "Both business and ledger are required — financial statements are always scoped to one business's own ledger.");
    const tb = getTrialBalance(asBusinessName(business), asLedgerName(ledger), asOfDate || undefined);
    return row(
      encodeRecordList(['id', 'name', 'accountnumber', 'debit_minor', 'credit_minor', 'currency', 'has_quantity_postings'], tb.rows),
      tb.total_debit_minor,
      tb.total_credit_minor,
      encodeRecordList(['currency', 'total_debit_minor', 'total_credit_minor', 'balanced'], tb.by_currency)
    );
  },
  // Positional args: [0] business, [1] ledger, [2] asOfDate (optional).
  getBalanceSheet: (v, user) => {
    requireAuth(user);
    const [business, ledger, asOfDate] = v;
    if (!business || !ledger) throw new CallError(400, "Both business and ledger are required — financial statements are always scoped to one business's own ledger.");
    const bs = getBalanceSheet(asBusinessName(business), asLedgerName(ledger), asOfDate || undefined);
    return row(
      encodeRecordList(STATEMENT_LINE_FIELDS, bs.assets),
      encodeRecordList(STATEMENT_LINE_FIELDS, bs.liabilities),
      encodeRecordList(STATEMENT_LINE_FIELDS, bs.equity),
      encodeCategoryTree(bs.assets_tree as WireCategoryTreeNode[]),
      encodeCategoryTree(bs.liabilities_tree as WireCategoryTreeNode[]),
      encodeCategoryTree(bs.equity_tree as WireCategoryTreeNode[]),
      bs.total_assets_minor,
      bs.total_liabilities_minor,
      bs.total_equity_minor,
      bs.balanced
    );
  },
  // Positional args: [0] business, [1] ledger.
  getLedgerDateRange: (v, user) => {
    requireAuth(user);
    const [business, ledger] = v;
    if (!business || !ledger) throw new CallError(400, "Both business and ledger are required — financial statements are always scoped to one business's own ledger.");
    const range = getLedgerDateRange(asBusinessName(business), asLedgerName(ledger));
    return row(range.earliest, range.latest);
  },
  // Positional args: [0] business, [1] ledger, [2] fromDate (optional),
  // [3] toDate (optional), [4] group (optional), [5] hierarchyPath
  // (comma-separated, optional), [6] hierarchyName (optional — defaults
  // to the last segment of hierarchyPath). Mirrors the old route's own
  // group/hierarchyPath/hierarchyName dispatch: plain getProfitAndLoss
  // unless both group and a non-empty hierarchyPath are given.
  getProfitAndLoss: (v, user) => {
    requireAuth(user);
    const [business, ledger, fromDate, toDate, group, hierarchyPathRaw, hierarchyNameRaw] = v;
    if (!business || !ledger) throw new CallError(400, "Both business and ledger are required — financial statements are always scoped to one business's own ledger.");
    const hierarchyPath = hierarchyPathRaw ? hierarchyPathRaw.split(',').filter(Boolean) : undefined;
    const pl =
      group && hierarchyPath && hierarchyPath.length > 0
        ? getProfitAndLossForHierarchyGroup(
            asBusinessName(business),
            asLedgerName(ledger),
            hierarchyPath,
            getHierarchyGroups(hierarchyNameRaw || hierarchyPath[hierarchyPath.length - 1]),
            group,
            fromDate || undefined,
            toDate || undefined
          )
        : getProfitAndLoss(asBusinessName(business), asLedgerName(ledger), fromDate || undefined, toDate || undefined);
    return row(encodeProfitAndLoss(pl));
  },
  // Positional args: [0] root (e.g. Income, Expense, Inventory). No live
  // frontend caller anywhere (grep-confirmed) — built anyway for a
  // complete backend surface, using the fully generic tree codec since
  // Hierarchy.buildTree's own callback result shape isn't fixed.
  getDrillDown: (v, user) => {
    requireAuth(user);
    const [root] = v;
    if (!root) throw new CallError(400, 'root is required (e.g. Income, Expense, Inventory).');
    const tree = Hierarchy.buildTree(root, (name, id) => ({ balance: id != null ? Balance.get(id) : 0 }));
    return row(encodeGenericTree(tree.children));
  },
  // Positional args: [0] business, [1] ledger, [2] hierarchyPath (comma-
  // separated, required), [3] fromDate (optional), [4] toDate (optional).
  getProfitAndLossByHierarchy: (v, user) => {
    requireAuth(user);
    const [business, ledger, hierarchyPathRaw, fromDate, toDate] = v;
    if (!business || !ledger) throw new CallError(400, "Both business and ledger are required — financial statements are always scoped to one business's own ledger.");
    const hierarchyPath = hierarchyPathRaw ? hierarchyPathRaw.split(',').filter(Boolean) : [];
    if (hierarchyPath.length === 0) throw new CallError(400, 'hierarchyPath is required (comma-separated, e.g. Location,Division).');
    const groups = getProfitAndLossByHierarchy(asBusinessName(business), asLedgerName(ledger), hierarchyPath, fromDate || undefined, toDate || undefined);
    return table(
      ['group', 'profitAndLoss'],
      groups.map((g) => ({ group: g.group ?? '', profitAndLoss: encodeProfitAndLoss(g.profitAndLoss) }))
    );
  },
  // Positional args: [0] business, [1] ledger, [2] hierarchyPath (comma-
  // separated, required), [3] hierarchyName (optional — defaults to the
  // last segment of hierarchyPath), [4] fromDate (optional), [5] toDate
  // (optional). The deepest structure converted in this rollout — see
  // encodeProfitAndLossByGroupTree's own doc comment.
  getProfitAndLossByHierarchyTree: (v, user) => {
    requireAuth(user);
    const [business, ledger, hierarchyPathRaw, hierarchyNameRaw, fromDate, toDate] = v;
    if (!business || !ledger) throw new CallError(400, "Both business and ledger are required — financial statements are always scoped to one business's own ledger.");
    const hierarchyPath = hierarchyPathRaw ? hierarchyPathRaw.split(',').filter(Boolean) : [];
    if (hierarchyPath.length === 0) throw new CallError(400, 'hierarchyPath is required (comma-separated, e.g. Location,Division).');
    const hierarchyName = hierarchyNameRaw || hierarchyPath[hierarchyPath.length - 1];
    const tree = getProfitAndLossByHierarchyTree(asBusinessName(business), asLedgerName(ledger), hierarchyPath, hierarchyName, fromDate || undefined, toDate || undefined);
    return row(encodeProfitAndLossByGroupTree(tree));
  },
  // Positional args: [0] business, [1] a (ledger), [2] b (ledger).
  getTrialBalanceComparison: (v, user) => {
    requireAuth(user);
    const [business, a, b] = v;
    if (!business || !a || !b) throw new CallError(400, 'A business, and both "a" and "b" ledger values (both belonging to that same business), are required for a comparison.');
    const cmp = getTrialBalanceComparison(asBusinessName(business), asLedgerName(a), asLedgerName(b));
    return row(cmp.ledgerA, cmp.ledgerB, encodeRecordList(['id', 'name', 'accountnumber', 'a_debit_minor', 'a_credit_minor', 'b_debit_minor', 'b_credit_minor'], cmp.rows));
  },
  // Positional args: [0] business, [1] a (ledger), [2] b (ledger).
  getProfitAndLossComparison: (v, user) => {
    requireAuth(user);
    const [business, a, b] = v;
    if (!business || !a || !b) throw new CallError(400, 'A business, and both "a" and "b" ledger values (both belonging to that same business), are required for a comparison.');
    const cmp = getProfitAndLossComparison(asBusinessName(business), asLedgerName(a), asLedgerName(b));
    const COMPARISON_LINE_FIELDS: ('name' | 'accountnumber' | 'a_minor' | 'b_minor' | 'variance_minor')[] = ['name', 'accountnumber', 'a_minor', 'b_minor', 'variance_minor'];
    return row(
      cmp.ledgerA,
      cmp.ledgerB,
      encodeRecordList(COMPARISON_LINE_FIELDS, cmp.income),
      encodeRecordList(COMPARISON_LINE_FIELDS, cmp.expenses),
      cmp.a_total_income_minor,
      cmp.b_total_income_minor,
      cmp.a_total_expenses_minor,
      cmp.b_total_expenses_minor,
      cmp.a_net_income_minor,
      cmp.b_net_income_minor,
      cmp.net_income_variance_minor
    );
  },
};
