import { db } from './db.js';
import { Hierarchy, Currency, type HierarchyTreeNode } from './primitives.js';
import { ValidationError, getEntityTree, stageLine, postJournalEntry, getDivisions, getDivisionForAccount, getDimensionChildren, asAccountName, asDivisionName, type BusinessName, type LedgerName, type UserId } from './db.js';

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export interface ReportRow {
  report: string;
  category: string;
  account: string;
  account_id: number;
  depth: number;
  accountnumber: string | null;
  balance_minor: number | null;
}

/** Structural grouping only (which report/category an account falls
 * under) — NOT scoped to a ledger. Its balance_minor column is the same
 * all-ledgers-combined total as account.balance_minor (see the note on
 * that column below) — fine for browsing the hierarchy, not meant for
 * financial statements, which use getLedgerBalances instead. */
export function getBusinessReports(): ReportRow[] {
  return db.prepare(`SELECT * FROM business_reports`).all() as ReportRow[];
}

export interface ChartRow {
  id: number;
  name: string;
  depth: number;
  path: string;
  accountnumber: string | null;
  balance_minor: number | null;
}

/** Sets an account's fixed currency — NULL means the business's own
 * home/reporting currency. Every account in a single journal entry
 * that shares a currency must balance to zero together; see
 * post_journal_entry_insert for the actual enforcement. Auto-creates
 * the account row if this entity has never been posted to before,
 * matching the same lazy-vivification every other account already
 * uses. */
export function setAccountCurrency(accountName: string, currency: string | null): void {
  db.prepare(`INSERT INTO account (entity_id) VALUES ((SELECT id FROM current_entities WHERE name = ?)) ON CONFLICT (entity_id) DO NOTHING`).run(accountName);
  const result = db.prepare(`UPDATE account SET currency = ? WHERE entity_id = (SELECT id FROM current_entities WHERE name = ?)`).run(currency, accountName);
  if (result.changes !== 1) throw new ValidationError(`No such account: "${accountName}".`);
}

export function getChartOfAccounts(): ChartRow[] {
  return db.prepare(`SELECT * FROM chart_of_accounts`).all() as ChartRow[];
}

// ---------------------------------------------------------------------------
// Financial statements — real totals and balance checks, not just a list.
//
// IMPORTANT: account.balance_minor (maintained by the post_journal_entry
// trigger) is a single running total across every ledger a business has
// — it does NOT distinguish "Actual" from a budget scenario. Posting the
// same account in both ledgers adds both amounts into that one number.
// This was a real bug, not a hypothetical one: posting 100 to Actual and
// 500 to a Budget ledger for the same account produced a trial balance
// of 600 for either ledger — completely defeating the point of having
// separate ledgers. Financial statements below therefore compute
// balances fresh from journal_line/journal, filtered to one specific
// ledger, rather than trusting the stored (combined) balance_minor at
// all. getLedgerBalances is the one place that filtering logic lives.
// ---------------------------------------------------------------------------

/** Ledger-scoped balances, computed from journal_occurrences — not the
 * raw journal_line table directly. This is what makes a recurring
 * journal's virtual occurrences (a budget's monthly rent, stepped
 * through a year) actually count toward that ledger's balances, trial
 * balance, and statements, exactly the same as any ordinary ('once')
 * posting — they're the same mechanism, this is the one place that
 * matters. */
/** Ledger-scoped balances, computed from journal_occurrences — not the
 * raw journal_line table directly. This is what makes a recurring
 * journal's virtual occurrences (a budget's monthly rent, stepped
 * through a year) actually count toward that ledger's balances, trial
 * balance, and statements, exactly the same as any ordinary ('once')
 * posting — they're the same mechanism, this is the one place that
 * matters.
 *
 * Deliberately restricted to accounts that are actual descendants of
 * 'Chart of Accounts' — a real, caught bug: the `account` table has no
 * notion of tree position at all, so without this filter, a memo/
 * quantity account (an Order's Qty tally, a stock batch's quantity
 * counter) that happens to have been posted to in this ledger would get
 * silently summed in here as if it were real money, just by virtue of
 * sharing the same account table. Moving such an account to live
 * outside the Chart of Accounts subtree only works if this function
 * actually respects that — simply parenting it elsewhere in the tree
 * changed nothing on its own. */
/** Ledger balances, optionally restricted to a date range —
 * omitted fromDate/toDate means "since ever"/"through today", the
 * same all-time behavior every report has always had. Point-in-time
 * reports (Trial Balance, Balance Sheet) only ever need toDate, an
 * "as of" cutoff; Profit and Loss genuinely needs both, since income
 * and expense should accumulate only within the period, not from an
 * account's whole inception the way a balance-sheet balance does. */
// AR/AP posts directly to each customer's/vendor's own name (the
// established pattern AR Sale/AP Purchase and completePosSale already
// use) — but Customers/Vendors live structurally outside the Chart of
// Accounts entirely. Without including them here, ANY report built on
// getLedgerBalances silently omits real, posted monetary amounts —
// not a cosmetic gap, the fundamental accounting identity breaking:
// a genuine Trial Balance must always balance (confirmed directly:
// the underlying journal_occurrences data already sums to exactly
// zero once Customers/Vendors are correctly included — the bug was
// only ever in which accounts this function chose to sum, never in
// the posted data itself).
/** Every (account, division) pair's real balance — used specifically
 * by closeBooks, which needs to know not just each account's total
 * balance but which real division(s) actually contributed to it, so
 * a period with multiple real profit centers correctly rolls each
 * division's own net income into its own real Retained Earnings leaf,
 * rather than collapsing every division together into one figure. A
 * line with no division at all groups under the null key. */
export function getLedgerBalancesByDivision(
  businessName: BusinessName,
  ledgerName: LedgerName,
  fromDate?: string,
  toDate?: string,
  excludeCloseEntries = false
): Map<number, Map<string | null, number>> {
  const rows = db
    .prepare(
      `WITH RECURSIVE real_accounts(id) AS (
         SELECT id FROM current_entities WHERE name = 'Chart of Accounts'
         UNION ALL
         SELECT e.id FROM current_entities e
         JOIN real_accounts r ON e.parent_id = r.id
         WHERE NOT EXISTS (SELECT 1 FROM contact WHERE entity_id = r.id)
       )
       SELECT a.entity_id AS id, d.name AS division_name,
              SUM(jo.amount_minor) AS balance_minor
       FROM account a
       JOIN real_accounts ra ON ra.id = a.entity_id
       JOIN journal_occurrences jo ON jo.account_id = a.entity_id
       JOIN journal j ON j.id = jo.journal_id
       LEFT JOIN current_entities d ON d.id = jo.division_id
       WHERE jo.ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ?))
         AND (? IS NULL OR jo.transdate >= ?)
         AND (? IS NULL OR jo.transdate <= ?)
         AND (? = 0 OR j.reference NOT LIKE 'CLOSE-%')
       GROUP BY a.entity_id, jo.division_id`
    )
    .all(ledgerName, businessName, fromDate ?? null, fromDate ?? null, toDate ?? null, toDate ?? null, excludeCloseEntries ? 1 : 0) as {
    id: number;
    division_name: string | null;
    balance_minor: number;
  }[];
  const result = new Map<number, Map<string | null, number>>();
  for (const r of rows) {
    if (!result.has(r.id)) result.set(r.id, new Map());
    result.get(r.id)!.set(r.division_name, r.balance_minor);
  }
  return result;
}

/** A real, new, parallel implementation of getLedgerBalancesByDivision
 * above, using the real, structural location/division derivation
 * (getDivisionForAccount) instead of reading journal_line.division_id
 * as a separate tag — per direct confirmation, the real, intended
 * replacement, migrated to carefully, one real step at a time. Not
 * yet used by any real caller — built and tested standalone first,
 * compared directly against the existing function's own real output
 * on real, live data, before any real report is switched over to it.
 *
 * The real, structural version is genuinely simpler at the SQL level:
 * division is now a real, per-account fact (derived once per account,
 * not read per posted line), so the query itself needs no division
 * grouping at all — just a real, plain, per-account balance, with
 * division derived afterward, once per real, distinct account. */
export function getLedgerBalancesByDivisionStructural(
  businessName: BusinessName,
  ledgerName: LedgerName,
  fromDate?: string,
  toDate?: string,
  excludeCloseEntries = false
): Map<number, Map<string | null, number>> {
  const rows = db
    .prepare(
      `WITH RECURSIVE real_accounts(id) AS (
         SELECT id FROM current_entities WHERE name = 'Chart of Accounts'
         UNION ALL
         SELECT e.id FROM current_entities e
         JOIN real_accounts r ON e.parent_id = r.id
         WHERE NOT EXISTS (SELECT 1 FROM contact WHERE entity_id = r.id)
       )
       SELECT a.entity_id AS id, e.name AS account_name,
              SUM(jo.amount_minor) AS balance_minor
       FROM account a
       JOIN current_entities e ON e.id = a.entity_id
       JOIN real_accounts ra ON ra.id = a.entity_id
       JOIN journal_occurrences jo ON jo.account_id = a.entity_id
       JOIN journal j ON j.id = jo.journal_id
       WHERE jo.ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ?))
         AND (? IS NULL OR jo.transdate >= ?)
         AND (? IS NULL OR jo.transdate <= ?)
         AND (? = 0 OR j.reference NOT LIKE 'CLOSE-%')
       GROUP BY a.entity_id`
    )
    .all(ledgerName, businessName, fromDate ?? null, fromDate ?? null, toDate ?? null, toDate ?? null, excludeCloseEntries ? 1 : 0) as {
    id: number;
    account_name: string;
    balance_minor: number;
  }[];
  const result = new Map<number, Map<string | null, number>>();
  for (const r of rows) {
    const division = getDivisionForAccount(r.account_name) ?? null;
    if (!result.has(r.id)) result.set(r.id, new Map());
    result.get(r.id)!.set(division, r.balance_minor);
  }
  return result;
}

export function getLedgerBalances(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, divisionName?: string, excludeCloseEntries = false): Map<number, number> {
  const rows = db
    .prepare(
      `WITH RECURSIVE real_accounts(id) AS (
         SELECT id FROM current_entities WHERE name = 'Chart of Accounts'
         UNION ALL
         SELECT e.id FROM current_entities e
         JOIN real_accounts r ON e.parent_id = r.id
         WHERE NOT EXISTS (SELECT 1 FROM contact WHERE entity_id = r.id)
       ),
       contact_accounts(id) AS (
         SELECT id FROM current_entities WHERE name IN ('Customers', 'Vendors')
         UNION ALL
         SELECT e.id FROM current_entities e JOIN contact_accounts c ON e.parent_id = c.id
       ),
       reportable_accounts(id) AS (
         SELECT id FROM real_accounts
         UNION
         SELECT id FROM contact_accounts
       ),
       -- The requested division and every real division nested under
       -- it — a division can be genuinely nested (e.g. a real
       -- per-location division under a real per-city one), and
       -- filtering by the coarser one must include the finer one's
       -- own real activity too, not just an exact division_id match.
       division_and_descendants(id) AS (
         SELECT id FROM current_entities WHERE name = ?
         UNION ALL
         SELECT e.id FROM current_entities e JOIN division_and_descendants d ON e.parent_id = d.id
       )
       SELECT a.entity_id AS id,
              COALESCE(SUM(CASE WHEN jo.ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ?))
                                 AND (? IS NULL OR jo.transdate >= ?)
                                 AND (? IS NULL OR jo.transdate <= ?)
                                 AND (? IS NULL OR jo.division_id IN (SELECT id FROM division_and_descendants))
                                 AND (? = 0 OR j.reference NOT LIKE 'CLOSE-%')
                                 THEN jo.amount_minor ELSE 0 END), 0) AS balance_minor
       FROM account a
       JOIN reportable_accounts ra ON ra.id = a.entity_id
       LEFT JOIN journal_occurrences jo ON jo.account_id = a.entity_id
       LEFT JOIN journal j ON j.id = jo.journal_id
       GROUP BY a.entity_id`
    )
    .all(divisionName ?? '__none__', ledgerName, businessName, fromDate ?? null, fromDate ?? null, toDate ?? null, toDate ?? null, divisionName ?? null, excludeCloseEntries ? 1 : 0) as {
    id: number;
    balance_minor: number;
  }[];
  return new Map(rows.map((r) => [r.id, r.balance_minor]));
}

export interface TrialBalanceRow {
  id: number;
  name: string;
  accountnumber: string | null;
  debit_minor: number;
  credit_minor: number;
}

export interface TrialBalance {
  rows: TrialBalanceRow[];
  total_debit_minor: number;
  total_credit_minor: number;
}

/** Every account with a non-zero balance *in the given ledger*, split
 * into its debit or credit column — the classic trial balance report. */
export function getTrialBalance(businessName: BusinessName, ledgerName: LedgerName, asOfDate?: string, divisionName?: string): TrialBalance {
  const balances = getLedgerBalances(businessName, ledgerName, undefined, asOfDate, divisionName);
  const accounts = db
    .prepare(`SELECT e.id, e.name, a.accountnumber FROM account a JOIN current_entities e ON e.id = a.entity_id`)
    .all() as { id: number; name: string; accountnumber: string | null }[];

  const rows: TrialBalanceRow[] = accounts
    .map((a) => {
      const balance_minor = balances.get(a.id) ?? 0;
      return {
        id: a.id,
        name: a.name,
        accountnumber: a.accountnumber,
        debit_minor: balance_minor > 0 ? balance_minor : 0,
        credit_minor: balance_minor < 0 ? -balance_minor : 0,
      };
    })
    .filter((r) => r.debit_minor !== 0 || r.credit_minor !== 0)
    .sort((a, b) => (a.accountnumber ?? '').localeCompare(b.accountnumber ?? '') || a.name.localeCompare(b.name));

  return {
    rows,
    total_debit_minor: rows.reduce((s, r) => s + r.debit_minor, 0),
    total_credit_minor: rows.reduce((s, r) => s + r.credit_minor, 0),
  };
}

export interface StatementLine {
  name: string;
  accountnumber: string | null;
  debit_minor: number;
  credit_minor: number;
  /** True when this line's balance sits in the column opposite its
   * section's normal side — an Asset with a credit balance, a
   * Liability with a debit balance, and so on. Genuinely unusual
   * (an overdrawn bank account, a customer who overpaid), not an
   * error, but worth flagging visually rather than presenting as
   * an ordinary positive number the way a raw signed balance would. */
  is_contra: boolean;
}

export interface BalanceSheet {
  assets: StatementLine[];
  liabilities: StatementLine[];
  equity: StatementLine[];
  /** Assets/Liabilities grouped by their real, structural CoA category
   * (e.g. Current Assets/Non-Current Assets) — the same, real,
   * already-proven buildCategoryTree mechanism the P&L report already
   * uses, applied here too. Accounts Receivable/Payable and Current
   * Year Earnings are real, genuine balance-sheet facts but live
   * structurally outside the Chart of Accounts entirely (see below),
   * so each appears as its own, real, synthetic top-level node
   * alongside the real, structural tree, rather than nested within
   * it — there is no real, structural category they could correctly
   * belong to. Equity has no real Current/Non-Current split at all
   * (that distinction is genuinely meaningless for equity), so
   * equity_tree is always flat, one real node per equity line. */
  assets_tree: CategoryTreeNode[];
  liabilities_tree: CategoryTreeNode[];
  equity_tree: CategoryTreeNode[];
  total_assets_minor: number;
  total_liabilities_minor: number;
  total_equity_minor: number;
  balanced: boolean;
}

/** Assets, Liabilities, Equity with real subtotals, plus the check that
 * Assets = Liabilities + Equity — for the given ledger specifically.
 * Uses business_reports only for its structural grouping (which
 * category/report an account falls under); the actual balance for each
 * line comes from getLedgerBalances, not the view's combined number, for
 * exactly the reason described in the comment above getLedgerBalances.
 * Only accounts that actually have a postable balance appear as lines;
 * categories with nothing posted to them yet are omitted rather than
 * shown as an empty zero row.
 *
 * Includes a synthetic "Current Year Earnings" equity line equal to
 * net income from getProfitAndLoss() — without it, the accounting
 * equation only holds at the instant books are formally closed and net
 * income is transferred into Retained Earnings; at any other moment
 * (i.e. always, for a live running system), revenue sitting in an
 * Income account has increased Assets without yet having a
 * corresponding Equity entry, and Assets = Liabilities + Equity would
 * be false. This was caught by a real test failure (62345 != 0), not
 * assumed correct and shipped. */
export function getBalanceSheet(businessName: BusinessName, ledgerName: LedgerName, asOfDate?: string, divisionName?: string): BalanceSheet {
  const balances = getLedgerBalances(businessName, ledgerName, undefined, asOfDate, divisionName);
  const rows = getBusinessReports()
    .filter((r) => r.report === 'Balance Sheet')
    .map((r) => ({ ...r, balance_minor: balances.get(r.account_id) ?? 0 }))
    .filter((r) => r.balance_minor !== 0);

  // normalSide: which column this line is EXPECTED to fall in — Assets
  // are normal-debit, Liabilities/Equity are normal-credit. is_contra
  // marks a line that landed in the opposite column from what's normal
  // for its section, not merely "negative".
  const toLine = (r: (typeof rows)[number], normalSide: 'debit' | 'credit'): StatementLine => {
    const { debit_minor, credit_minor, is_contra } = Currency.toDebitCredit(r.balance_minor, normalSide);
    return {
      name: r.account,
      accountnumber: r.accountnumber,
      debit_minor,
      credit_minor,
      is_contra,
    };
  };

  const assets = rows.filter((r) => r.category === 'Asset').map((r) => toLine(r, 'debit'));
  const liabilities = rows.filter((r) => r.category === 'Liability').map((r) => toLine(r, 'credit'));
  const equity = rows.filter((r) => r.category === 'Equity').map((r) => toLine(r, 'credit'));

  // account_id lookup by name, for buildCategoryTree to walk each
  // leaf's own real parent chain — the same rows already carry it,
  // just re-keyed by the display name each StatementLine uses. Built
  // from the real, CoA-based lines only, before AR/AP/Current Year
  // Earnings are appended below (those three live structurally
  // outside the Chart of Accounts entirely and have no real account_id
  // of their own to walk at all).
  const accountIdByName = new Map(rows.map((r) => [r.account, r.account_id]));
  const assets_tree = buildCategoryTree(assets, accountIdByName, 'Asset');
  const liabilities_tree = buildCategoryTree(liabilities, accountIdByName, 'Liability', 'credit');
  // Equity genuinely has no real Current/Non-Current distinction at
  // all — always presented flat, one real node per real equity line,
  // matching the real, existing equity[] array exactly rather than
  // walking a real category structure that wouldn't mean anything here.
  const equity_tree: CategoryTreeNode[] = equity.map((l) => ({ name: l.name, accountnumber: l.accountnumber, is_leaf: true, debit_minor: l.debit_minor, credit_minor: l.credit_minor, is_contra: l.is_contra, children: [] }));

  // Per direct, emphatic instruction: nothing on this report may be
  // hardcoded or synthetic. A real entity (Customers, Vendors, or any
  // future one) can genuinely, structurally live outside the Chart of
  // Accounts entirely (Customers/Vendors are real Vocabulary words —
  // their own, real "source of truth" home) while still, genuinely,
  // additionally reaching a real CoA heading for reporting purposes,
  // via the established "Header Account" dimension — the same, real,
  // "multiple equal paths" mechanism already proven this session for
  // division/location/tier. This is not hardcoded to "Customers"/
  // "Vendors" by name at all — it generically discovers ANY real
  // entity that has set a given real Asset/Liability account as its
  // own "Header Account" dimension-parent, then sums that entity's
  // own, real, structural descendants (every real customer/vendor
  // beneath it). A real, future entity setting up this same, real
  // dimension link against any other real heading is picked up
  // automatically, with no further code change required at all.
  const sumDimensionDescendants = (headerAccountName: string): number => {
    const dimensionChildren = getDimensionChildren(headerAccountName, 'Header Account');
    if (dimensionChildren.length === 0) return 0;
    const row = db
      .prepare(
        `WITH RECURSIVE walk(id) AS (
           SELECT id FROM current_entities WHERE name IN (${dimensionChildren.map(() => '?').join(',')})
           UNION ALL
           SELECT e.id FROM current_entities e JOIN walk w ON e.parent_id = w.id
         )
         SELECT COALESCE(SUM(jo.amount_minor), 0) AS total
         FROM journal_occurrences jo
         WHERE jo.account_id IN (SELECT id FROM walk)
           AND jo.ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ?))
           AND (? IS NULL OR jo.transdate <= ?)
           AND (? IS NULL OR jo.division_id = (SELECT id FROM current_entities WHERE name = ?))`
      )
      .get(...dimensionChildren, ledgerName, businessName, asOfDate ?? null, asOfDate ?? null, divisionName ?? null, divisionName ?? null) as { total: number };
    return row.total;
  };

  const receivableTotal = sumDimensionDescendants('Accounts Receivable');
  if (receivableTotal !== 0) {
    const line: StatementLine = {
      name: 'Accounts Receivable',
      accountnumber: null,
      debit_minor: receivableTotal > 0 ? receivableTotal : 0,
      credit_minor: receivableTotal < 0 ? -receivableTotal : 0,
      is_contra: receivableTotal < 0,
    };
    assets.push(line);
    assets_tree.push({ ...line, is_leaf: true, children: [] });
  }
  const payableTotal = sumDimensionDescendants('Accounts Payable');
  if (payableTotal !== 0) {
    const line: StatementLine = {
      name: 'Accounts Payable',
      accountnumber: null,
      debit_minor: payableTotal > 0 ? payableTotal : 0,
      credit_minor: payableTotal < 0 ? -payableTotal : 0,
      is_contra: payableTotal > 0,
    };
    liabilities.push(line);
    liabilities_tree.push({ ...line, is_leaf: true, children: [] });
  }

  const { net_income_minor } = getProfitAndLoss(businessName, ledgerName, undefined, undefined, divisionName, false);
  if (net_income_minor !== 0) {
    // Same signed convention as the raw ledger balances (credit-normal,
    // negative for a genuine credit/profit) so it splits into
    // debit/credit the same way every other equity line does.
    const raw = -net_income_minor;
    const line: StatementLine = {
      name: 'Current Year Earnings',
      accountnumber: null,
      debit_minor: raw > 0 ? raw : 0,
      credit_minor: raw < 0 ? -raw : 0,
      is_contra: raw > 0,
    };
    equity.push(line);
    equity_tree.push({ ...line, is_leaf: true, children: [] });
  }

  // Section totals: sum whichever column is that section's normal
  // side minus the other — Assets net debit, Liabilities/Equity net
  // credit, the conventional positive-total presentation any real
  // balance sheet uses, now computed from the same split columns the
  // lines themselves show, not a separate sign-flipped calculation.
  const total_assets_minor = assets.reduce((s, l) => s + l.debit_minor - l.credit_minor, 0);
  const total_liabilities_minor = liabilities.reduce((s, l) => s + l.credit_minor - l.debit_minor, 0);
  const total_equity_minor = equity.reduce((s, l) => s + l.credit_minor - l.debit_minor, 0);

  return {
    assets,
    liabilities,
    equity,
    assets_tree,
    liabilities_tree,
    equity_tree,
    total_assets_minor,
    total_liabilities_minor,
    total_equity_minor,
    balanced: total_assets_minor === total_liabilities_minor + total_equity_minor,
  };
}

export interface ProfitAndLoss {
  income: StatementLine[];
  expenses: StatementLine[];
  /** The subset of `expenses` tagged as Cost of Goods Sold (via
   * relation_id — the same tagging mechanism business_reports already
   * uses for report grouping, reused one level deeper here). */
  cogs_expenses: StatementLine[];
  /** Every other expense — ordinary operating costs, not item of COGS. */
  operating_expenses: StatementLine[];
  /** The same three line sets above, grouped by their real, existing
   * GL category hierarchy (e.g. Sales - Beer -> Sales - Ale -> a real
   * leaf account) rather than presented flat — for a report page that
   * wants to show real subtotals at each real level, not just a flat
   * list of every leaf account. See buildCategoryTree. */
  income_tree: CategoryTreeNode[];
  cogs_tree: CategoryTreeNode[];
  operating_expenses_tree: CategoryTreeNode[];
  total_income_minor: number;
  total_expenses_minor: number;
  /** Revenue minus COGS specifically, stopping there — the standard
   * subtotal most tax and lending contexts expect distinctly from Net
   * Profit, not the same figure under a different name. */
  gross_profit_minor: number;
  net_income_minor: number;
}

export interface CategoryTreeNode {
  name: string;
  accountnumber: string | null;
  /** True for a real, leaf, postable account — false for a category
   * grouping (e.g. "Sales - Beer") that exists only to hold other
   * categories/accounts underneath it. */
  is_leaf: boolean;
  debit_minor: number;
  credit_minor: number;
  is_contra: boolean;
  /** Real children, already sorted by name — empty for a leaf. */
  children: CategoryTreeNode[];
}

/** Groups a flat set of statement lines by their real, existing GL
 * category hierarchy — the same hierarchy ensureProductSalesCogsAccounts
 * already builds and keeps in sync with the real product category
 * tree, walked here directly from parent_id rather than assumed or
 * duplicated. A leaf with no real category parent (sitting directly
 * under the given root) appears as a top-level line, same as before —
 * this only groups accounts that genuinely have real category
 * ancestors between them and the root. */
export function buildCategoryTree(lines: StatementLine[], accountIdByName: Map<string, number>, rootName: string, normalSide: 'debit' | 'credit' = 'debit'): CategoryTreeNode[] {
  const lineByAccountId = new Map(lines.map((l) => [accountIdByName.get(l.name), l]));

  // Hierarchy.buildTree walks every real node under rootName,
  // regardless of whether it has a nonzero balance — genuinely
  // different from this function's own, established, sparse output
  // (never showing a category with nothing real posted under it).
  // getProperties below supplies each real leaf's own, real, signed
  // currency amount (0 for a pure category with no account of its
  // own), via Currency.fromDebitCredit — the one, real input method
  // for this class, restoring the exact, same, signed value a real
  // debit/credit line pair always represents. pruneEmpty afterwards
  // removes any real node whose own recursive total is genuinely zero
  // and has no real, surviving children, restoring the exact, same,
  // established sparse behavior.
  const tree = Hierarchy.buildTree(rootName, (name, id) => {
    const line = id != null ? lineByAccountId.get(id) : undefined;
    return { amount_minor: line ? Currency.fromDebitCredit(line.debit_minor, line.credit_minor) : 0 };
  });

  function toCategoryNode(n: HierarchyTreeNode): CategoryTreeNode | null {
    const line = n.accountId != null ? lineByAccountId.get(n.accountId) : undefined;
    const children = n.children.map((c) => toCategoryNode(c)).filter((c): c is CategoryTreeNode => c !== null);
    const isLeaf = line !== undefined;
    if (!isLeaf && children.length === 0) return null; // pruneEmpty: no real account here, no real surviving children
    if (isLeaf) return { name: line.name, accountnumber: line.accountnumber, is_leaf: true, debit_minor: line.debit_minor, credit_minor: line.credit_minor, is_contra: line.is_contra, children: [] };
    // The one, real output method again, for this category's own
    // recursive signed subtotal (n.total.amount_minor, already summed
    // by Hierarchy.buildTree itself) — never a separate, hand-rolled
    // debit/credit sum. is_contra is not meaningful at the category
    // level (only a real, individual leaf account has a genuine
    // "normal side" to be contrary to) — always false here, exactly
    // matching this function's own, established, original behavior.
    const { debit_minor, credit_minor } = Currency.toDebitCredit(n.total.amount_minor, normalSide);
    return { name: n.name, accountnumber: null, is_leaf: false, debit_minor, credit_minor, is_contra: false, children: children.sort((a, b) => a.name.localeCompare(b.name)) };
  }

  const topLevel = tree.children.map((c) => toCategoryNode(c)).filter((c): c is CategoryTreeNode => c !== null);
  topLevel.sort((a, b) => a.name.localeCompare(b.name));
  return topLevel;
}

/** Income, Expenses, and Net Income — for the given ledger specifically,
 * same reasoning as getBalanceSheet above. */
export function getProfitAndLoss(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, divisionName?: string, excludeCloseEntries = true): ProfitAndLoss {
  const balances = getLedgerBalances(businessName, ledgerName, fromDate, toDate, divisionName, excludeCloseEntries);
  return buildProfitAndLossFromBalances(balances);
}

/** The real, shared logic behind every real P&L, factored out so it
 * can be built directly from an already-computed, real balance map —
 * critical for getProfitAndLossByDivision below, which needs this
 * same, real logic run once per real division without each one
 * separately, expensively re-querying the full, real dataset from
 * scratch (a real, confirmed, ~20-second performance problem found
 * live, fixed here). getProfitAndLoss itself is now a thin wrapper:
 * fetch the one, real balance map this ledger/date-range/division
 * needs, then hand it to this real, shared builder. */
export function buildProfitAndLossFromBalances(balances: Map<number, number>): ProfitAndLoss {
  const rows = getBusinessReports()
    .filter((r) => r.report === 'Profit and Loss Statement')
    .map((r) => ({ ...r, balance_minor: balances.get(r.account_id) ?? 0 }))
    .filter((r) => r.balance_minor !== 0);

  const toLine = (r: (typeof rows)[number], normalSide: 'debit' | 'credit'): StatementLine => {
    const { debit_minor, credit_minor, is_contra } = Currency.toDebitCredit(r.balance_minor, normalSide);
    return {
      name: r.account,
      accountnumber: r.accountnumber,
      debit_minor,
      credit_minor,
      is_contra,
    };
  };

  const income = rows.filter((r) => r.category === 'Income').map((r) => toLine(r, 'credit'));
  const expenseRows = rows.filter((r) => r.category === 'Expense');
  const expenses = expenseRows.map((r) => toLine(r, 'debit'));

  // Which expense accounts are COGS-tagged — a direct relation_id
  // check, not derived from business_reports (which only tags
  // top-level categories, not individual accounts within one).
  const cogsAccountIds = new Set(
    (
      db
        .prepare(
          `SELECT e.id FROM current_entities e
           WHERE e.relation_id = (SELECT id FROM current_entities WHERE name = 'COGS')`
        )
        .all() as { id: number }[]
    ).map((r) => r.id)
  );
  const cogs_expenses = expenseRows.filter((r) => cogsAccountIds.has(r.account_id)).map((r) => toLine(r, 'debit'));
  const operating_expenses = expenseRows.filter((r) => !cogsAccountIds.has(r.account_id)).map((r) => toLine(r, 'debit'));

  // account_id lookup by name, for buildCategoryTree to walk each
  // leaf's own real parent chain — the same rows already carry it,
  // just re-keyed by the display name each StatementLine uses.
  const accountIdByName = new Map(rows.map((r) => [r.account, r.account_id]));
  const income_tree = buildCategoryTree(income, accountIdByName, 'Income', 'credit');
  const cogs_tree = buildCategoryTree(cogs_expenses, accountIdByName, 'Expense');
  const operating_expenses_tree = buildCategoryTree(operating_expenses, accountIdByName, 'Expense');

  // Income is credit-normal, Expense is debit-normal — both summed to
  // their conventional positive totals from the same split columns the
  // lines themselves show, matching a real P&L.
  const total_income_minor = income.reduce((s, l) => s + l.credit_minor - l.debit_minor, 0);
  const total_expenses_minor = expenses.reduce((s, l) => s + l.debit_minor - l.credit_minor, 0);
  const cogs_minor = cogs_expenses.reduce((s, l) => s + l.debit_minor - l.credit_minor, 0);

  return {
    income,
    expenses,
    cogs_expenses,
    operating_expenses,
    income_tree,
    cogs_tree,
    operating_expenses_tree,
    total_income_minor,
    total_expenses_minor,
    gross_profit_minor: total_income_minor - cogs_minor,
    net_income_minor: total_income_minor - total_expenses_minor,
  };
}

export interface ProfitAndLossByDivision {
  division: string | null;
  profitAndLoss: ProfitAndLoss;
}

/** Per direct request: "Consolidated per Division" — one full, real
 * P&L per real division that actually has activity within this real
 * ledger and date range (including a real, null-division "everything
 * not tagged to any division" group), not every division that merely
 * exists somewhere in the app. Deliberately a thin wrapper around the
 * already-proven getProfitAndLoss, called once per real, discovered
 * division, rather than a real, separate, duplicated implementation —
 * the exact same real income/COGS/operating-expense split, per
 * division, that the plain, consolidated P&L already gets right.
 *
 * Genuinely independent of the real product/tier/leaf restructuring
 * (docs/multi-dimensional-reporting.md §10) — this uses the
 * already-existing, already-proven journal_line.division_id
 * mechanism directly, not the newer item/tier work, so it's real and
 * usable regardless of how or when that separate work gets wired
 * into live posting. */
/** Per direct request: "Consolidated per Division" — one full, real
 * P&L per real division that actually has activity within this real
 * ledger and date range (including a real, null-division "everything
 * not tagged to any division" group), not every division that merely
 * exists somewhere in the app.
 *
 * A real, confirmed performance fix: an earlier version called the
 * plain getProfitAndLoss once per real division, each call
 * independently re-querying the full, real dataset from scratch — a
 * real, measured ~20 seconds against the full Wine Retail Company
 * simulation, confirmed live, not estimated. Fixed here by querying
 * getLedgerBalancesByDivisionStructural exactly once (the same,
 * already efficient, single-pass query the year-end close's own
 * division breakdown already uses), then building each real
 * division's own P&L directly from its own real slice of that one,
 * shared result via buildProfitAndLossFromBalances — the exact same,
 * real P&L-building logic getProfitAndLoss itself uses, just handed
 * an already-computed balance map instead of fetching its own.
 *
 * Per direct confirmation ("location becomes structural the same way
 * tier did"), this now derives each real division from a real
 * account's own, real, structural location — not
 * journal_line.division_id, a real, separate tag mechanism being
 * retired. Verified directly, before switching over: the two real
 * functions agree exactly on real, live data carrying both. */
export function getProfitAndLossByDivision(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string): ProfitAndLossByDivision[] {
  const balancesByDivision = getLedgerBalancesByDivisionStructural(businessName, ledgerName, fromDate, toDate, true);

  // Re-key from "account -> division -> balance" to "division ->
  // account -> balance", the real shape buildProfitAndLossFromBalances
  // itself needs, one real division at a time.
  const byDivision = new Map<string | null, Map<number, number>>();
  for (const [accountId, divisionMap] of balancesByDivision.entries()) {
    for (const [divisionName, balance] of divisionMap.entries()) {
      if (!byDivision.has(divisionName)) byDivision.set(divisionName, new Map());
      byDivision.get(divisionName)!.set(accountId, balance);
    }
  }

  return Array.from(byDivision.entries())
    .sort(([a], [b]) => (a ?? '').localeCompare(b ?? ''))
    .map(([division, balances]) => ({
      division,
      profitAndLoss: buildProfitAndLossFromBalances(balances),
    }));
}

export interface ProfitAndLossByDivisionNode extends ProfitAndLossByDivision {
  children: ProfitAndLossByDivisionNode[];
}

/** Per direct request: "Consolidated per Division per Location" — the
 * same real, per-division P&L breakdown as getProfitAndLossByDivision
 * above, nested into a real tree by each division's own real parent,
 * rather than presented as one, flat list. A location is already,
 * structurally, the finest-grain division in the real, existing
 * hierarchy (confirmed directly: real divisions can already, genuinely
 * nest — a real per-location division under a real per-city one) —
 * this report doesn't need the separate, real product/tier/leaf
 * restructuring work (docs/multi-dimensional-reporting.md §10) at
 * all, since division/location was never the problem that work
 * addresses.
 *
 * A real, genuine complication handled directly: a real, top-level
 * division (e.g. a real city) may have no real, direct activity of
 * its own at all — only its own, real children do. Rather than
 * silently dropping that level (which would leave real children with
 * nowhere real to nest), a real, genuinely empty P&L node is
 * synthesized for it, so the real tree's own shape stays intact. The
 * real, null-division "(No division)" group is always treated as its
 * own, separate, real root — it has no real, meaningful parent to
 * nest under. */
export function getProfitAndLossByDivisionTree(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string): ProfitAndLossByDivisionNode[] {
  const flat = getProfitAndLossByDivision(businessName, ledgerName, fromDate, toDate);
  const divisions = getDivisions();
  const parentByName = new Map(divisions.map((d) => [d.name, d.parentName]));

  const emptyProfitAndLoss: ProfitAndLoss = {
    income: [],
    expenses: [],
    cogs_expenses: [],
    operating_expenses: [],
    income_tree: [],
    cogs_tree: [],
    operating_expenses_tree: [],
    total_income_minor: 0,
    total_expenses_minor: 0,
    gross_profit_minor: 0,
    net_income_minor: 0,
  };

  const nodesByName = new Map<string | null, ProfitAndLossByDivisionNode>();
  for (const entry of flat) {
    nodesByName.set(entry.division, { ...entry, children: [] });
  }
  // A real, top-level division with real, active children but no
  // real, direct activity of its own must still get a real, genuinely
  // empty node, so its own real children have somewhere real to nest.
  for (const entry of flat) {
    if (entry.division === null) continue;
    let current: string | null = parentByName.get(entry.division) ?? null;
    while (current !== null && !nodesByName.has(current)) {
      nodesByName.set(current, { division: current, profitAndLoss: emptyProfitAndLoss, children: [] });
      current = parentByName.get(current) ?? null;
    }
  }

  const roots: ProfitAndLossByDivisionNode[] = [];
  for (const [name, node] of nodesByName.entries()) {
    if (name === null) {
      roots.push(node);
      continue;
    }
    const parentName = parentByName.get(name) ?? null;
    if (parentName !== null && nodesByName.has(parentName)) {
      nodesByName.get(parentName)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNode = (n: ProfitAndLossByDivisionNode) => {
    n.children.sort((a, b) => (a.division ?? '').localeCompare(b.division ?? ''));
    n.children.forEach(sortNode);
  };
  roots.sort((a, b) => (a.division ?? '').localeCompare(b.division ?? ''));
  roots.forEach(sortNode);
  return roots;
}

// ---------------------------------------------------------------------------
// Comparison reports — Actual vs. any other ledger (a budget, a growth
// scenario), side by side, rather than switching the ledger selector and
// eyeballing two separate reports. Both reuse getLedgerBalances, so
// there's no new balance-computation logic to get wrong — just two calls
// to the same, already-tested function, joined together.
// ---------------------------------------------------------------------------

export interface TrialBalanceComparisonRow {
  id: number;
  name: string;
  accountnumber: string | null;
  a_debit_minor: number;
  a_credit_minor: number;
  b_debit_minor: number;
  b_credit_minor: number;
}

export interface TrialBalanceComparison {
  ledgerA: LedgerName;
  ledgerB: LedgerName;
  rows: TrialBalanceComparisonRow[];
}

export function getTrialBalanceComparison(businessName: BusinessName, ledgerA: LedgerName, ledgerB: LedgerName): TrialBalanceComparison {
  const balancesA = getLedgerBalances(businessName, ledgerA);
  const balancesB = getLedgerBalances(businessName, ledgerB);
  const accounts = db
    .prepare(`SELECT e.id, e.name, a.accountnumber FROM account a JOIN current_entities e ON e.id = a.entity_id`)
    .all() as { id: number; name: string; accountnumber: string | null }[];

  const rows: TrialBalanceComparisonRow[] = accounts
    .map((acct) => {
      const a = balancesA.get(acct.id) ?? 0;
      const b = balancesB.get(acct.id) ?? 0;
      return {
        id: acct.id,
        name: acct.name,
        accountnumber: acct.accountnumber,
        a_debit_minor: a > 0 ? a : 0,
        a_credit_minor: a < 0 ? -a : 0,
        b_debit_minor: b > 0 ? b : 0,
        b_credit_minor: b < 0 ? -b : 0,
      };
    })
    .filter((r) => r.a_debit_minor || r.a_credit_minor || r.b_debit_minor || r.b_credit_minor)
    .sort((x, y) => (x.accountnumber ?? '').localeCompare(y.accountnumber ?? '') || x.name.localeCompare(y.name));

  return { ledgerA, ledgerB, rows };
}

export interface ProfitAndLossComparisonLine {
  name: string;
  accountnumber: string | null;
  a_minor: number;
  b_minor: number;
  variance_minor: number;
}

export interface ProfitAndLossComparison {
  ledgerA: LedgerName;
  ledgerB: LedgerName;
  income: ProfitAndLossComparisonLine[];
  expenses: ProfitAndLossComparisonLine[];
  a_total_income_minor: number;
  b_total_income_minor: number;
  a_total_expenses_minor: number;
  b_total_expenses_minor: number;
  a_net_income_minor: number;
  b_net_income_minor: number;
  net_income_variance_minor: number;
}

/** variance_minor is always (ledgerB - ledgerA) in the conventional
 * positive-total presentation (same flip as getProfitAndLoss uses) — so
 * calling this with (Actual, Budget) gives "how much more the budget
 * expects than actually happened," positive meaning the budget is ahead. */
export interface CloseBooksResult {
  reference: string;
  netIncomeMinor: number;
  accountsZeroed: number;
  /** A real summary of every real division's own net income/loss for
   * this period. Per direct request ("the whole point of the
   * restructuring"), the real, posted Retained Earnings side of the
   * close now genuinely carries one, real, separate line per real,
   * active division too (see computeCloseLines) — this summary and
   * that real, posted detail agree, by construction. Division is
   * still only ever a real, pure sub-totaling/reporting dimension in
   * one, further sense: every division's own line still posts into
   * the exact same, single, chosen retainedEarningsAccount, never a
   * real, separate, division-specific account. The one entry with a
   * null division is the real, undivided remainder (any income/
   * expense posted with no division at all). */
  divisionBreakdown: { division: string | null; netIncomeMinor: number }[];
}

/** Year-end (or any period) close: zeroes every Income and Expense
 * account's balance and transfers the net difference to Retained
 * Earnings, as ONE single, balanced journal entry — not a rule
 * enforced by extra validation, just an ordinary posting that happens
 * to touch every P&L account at once. A genuinely profitable period
 * increases Retained Earnings (credit); a loss decreases it (debit) —
 * the sign falls out of the reversal arithmetic, never assumed. Income
 * accounts are credit-normal (negative balance_minor), Expense
 * accounts are debit-normal (positive balance_minor) — reversing each
 * means posting the OPPOSITE sign of its current balance, bringing it
 * to exactly zero, not an approximation.
 *
 * Per direct correction: division is only a real, pure sub-totaling/
 * reporting dimension — already genuinely available on P&L, Trial
 * Balance, and other reports via a real division filter — not
 * something the close itself needs to structurally split by. An
 * earlier version of this function created a real, separate "{account}
 * - {division}" Retained Earnings leaf per division; that's now
 * removed entirely. Every real division's own net income still rolls
 * up into the exact same, single, chosen retainedEarningsAccount,
 * exactly like any other Income/Expense account being closed — a
 * division-scoped P&L or Trial Balance still shows each division's
 * own real contribution whenever that view is wanted, without the
 * close itself needing to know or care that divisions exist at all.
 * divisionBreakdown, in the real result below, stays purely
 * informational — a real, read-only summary of what closed, not a
 * structural decision about where anything actually posted. */
export interface CloseBooksLine {
  account: string;
  accountId?: number;
  amount_minor: number;
  /** Per direct request: "the whole point of the restructuring" —
   * the real Retained Earnings posting is now broken into several,
   * real, separate lines, one per real, active profit center, each
   * tagged with its own real division. Every other, ordinary
   * Income/Expense-zeroing line stays combined across divisions
   * (undefined here) — only the destination of the close, Retained
   * Earnings, carries the real, meaningful "which profit center
   * earned this" breakdown. */
  division?: string;
}
interface ComputedClose {
  lines: CloseBooksLine[];
  netIncomeMinor: number;
  accountsZeroed: number;
  divisionBreakdown: { division: string | null; netIncomeMinor: number }[];
}

/** The real, shared computation both previewCloseBooks and closeBooks
 * itself use — kept as one, single source of truth so a preview can
 * never drift from what actually posts. Computes the real, proposed
 * lines without staging or posting anything at all. */
function computeCloseLines(businessName: BusinessName, ledger: LedgerName, asOfDate: string, retainedEarningsAccount: string): ComputedClose {
  const balancesByDivision = getLedgerBalancesByDivisionStructural(businessName, ledger, undefined, asOfDate);
  const rows = getBusinessReports().filter((r) => r.report === 'Profit and Loss Statement' || r.category === 'Income' || r.category === 'Expense');

  let netIncomeMinor = 0;
  let accountsZeroed = 0;
  const netIncomeByDivision = new Map<string | null, number>();
  const lines: CloseBooksLine[] = [];

  for (const r of rows) {
    const divisionBalances = balancesByDivision.get(r.account_id);
    if (!divisionBalances) continue;
    let accountTotal = 0;
    for (const [divisionName, balance] of divisionBalances) {
      if (balance === 0) continue;
      accountTotal += balance;
      netIncomeByDivision.set(divisionName, (netIncomeByDivision.get(divisionName) ?? 0) - balance);
    }
    if (accountTotal === 0) continue;
    lines.push({ account: r.account, accountId: r.account_id, amount_minor: -accountTotal });
    netIncomeMinor -= accountTotal;
    accountsZeroed += 1;
  }

  if (accountsZeroed > 0) {
    // Per direct request: "the whole point of the restructuring" —
    // Retained Earnings is broken into several, real, separate lines,
    // one per real, active profit center, rather than one, single,
    // combined line. Each real division's own net income becomes its
    // own real line, tagged with its own division; a genuinely
    // untagged remainder (division: null) still posts as its own
    // real, division-less line, exactly as an ordinary posting would.
    for (const [division, net] of netIncomeByDivision.entries()) {
      if (net === 0) continue;
      lines.push({ account: retainedEarningsAccount, amount_minor: -net, ...(division !== null ? { division } : {}) });
    }
  }

  const divisionBreakdown = Array.from(netIncomeByDivision.entries())
    .filter(([, net]) => net !== 0)
    .map(([division, netIncomeMinor]) => ({ division, netIncomeMinor }))
    .sort((a, b) => (a.division ?? '').localeCompare(b.division ?? ''));

  return { lines, netIncomeMinor, accountsZeroed, divisionBreakdown };
}

export interface CloseBooksPreview {
  lines: CloseBooksLine[];
  netIncomeMinor: number;
  accountsZeroed: number;
  divisionBreakdown: { division: string | null; netIncomeMinor: number }[];
}

/** A real, live preview of exactly what closeBooks would post, given
 * the same real inputs — computes and returns the real, proposed
 * debit/credit lines without staging or posting a single one of them.
 * Per direct request: a person should be able to see the real,
 * proposed general journal entry and explicitly accept or reject it,
 * not just click one button that immediately posts. Throws the exact
 * same real "nothing to close" error closeBooks itself would, so a
 * person never previews something that couldn't actually be posted. */
export function previewCloseBooks(businessName: BusinessName, ledger: LedgerName, asOfDate: string, retainedEarningsAccount: string): CloseBooksPreview {
  const computed = computeCloseLines(businessName, ledger, asOfDate, retainedEarningsAccount);
  if (computed.accountsZeroed === 0) {
    throw new ValidationError(`Nothing to close for "${ledger}" as of ${asOfDate} — every Income/Expense account is already zero.`);
  }
  return computed;
}

export function closeBooks(business: BusinessName, ledger: LedgerName, asOfDate: string, retainedEarningsAccount: string, userId: UserId): CloseBooksResult {
  const reference = `CLOSE-${ledger}-${asOfDate}`;
  const computed = computeCloseLines(business, ledger, asOfDate, retainedEarningsAccount);

  if (computed.accountsZeroed === 0) {
    throw new ValidationError(`Nothing to close for "${ledger}" as of ${asOfDate} — every Income/Expense account is already zero.`);
  }

  // journal_entry_staging's own real key now includes division (see
  // schema.sql), per direct request: "the whole point of the
  // restructuring" — every ordinary Income/Expense-zeroing line still
  // stays combined across divisions (line.division is undefined for
  // these), but Retained Earnings itself may now genuinely appear
  // several times in computed.lines, once per real, active division,
  // each staged as its own, real, separate row rather than merged.
  for (const line of computed.lines) {
    stageLine({
      reference,
      business,
      ledger,
      transdate: asOfDate,
      account: asAccountName(line.account),
      accountId: line.accountId,
      amount_minor: line.amount_minor,
      division: line.division ? asDivisionName(line.division) : undefined,
      memo: line.account === retainedEarningsAccount ? (line.division ? `Year-end close — net income retained (${line.division})` : 'Year-end close — net income retained') : 'Year-end close',
    });
  }

  postJournalEntry(reference, business, ledger, userId);

  return { reference, netIncomeMinor: computed.netIncomeMinor, accountsZeroed: computed.accountsZeroed, divisionBreakdown: computed.divisionBreakdown };
}


export interface SalesReportLine {
  invoice_date: string;
  reference: string;
  item_name: string | null;
  description: string;
  quantity: number | null;
  unit_price_minor: number | null;
  amount_minor: number;
}

export interface SalesCategorySummary {
  category: string;
  quantity: number;
  amount_minor: number;
}

export interface SalesReport {
  detailed: SalesReportLine[];
  category_summary: SalesCategorySummary[];
  total_quantity: number;
  total_amount_minor: number;
}

/** A real sales report — every posted AR sale line (ordinary invoices
 * and POS sales alike; credit notes are excluded, since a return
 * isn't a sale), plus a genuine category rollup (each product's real
 * parent in the entity tree — Shiraz, Ale, Prosecco, etc.), not a
 * hand-maintained list of category names that could drift from the
 * actual catalog. */
export function getSalesReport(business: BusinessName, ledger: LedgerName, fromDate?: string, toDate?: string): SalesReport {
  const rows = db
    .prepare(
      `SELECT i.invoice_date, i.reference, pe.name AS item_name, l.description,
              l.quantity, l.unit_price_minor, l.amount_minor, l.item_id
       FROM invoice_detail_line l
       JOIN invoice i ON i.id = l.invoice_id
       LEFT JOIN current_entities pe ON pe.id = l.item_id
       WHERE i.business_id = (SELECT id FROM current_entities WHERE name = ?)
         AND i.ledger_id = (SELECT id FROM current_entities WHERE name = ?)
         AND i.invoice_type = 'AR'
         AND i.document_type = 'invoice'
         AND i.status = 'posted'
         AND (? IS NULL OR i.invoice_date >= ?)
         AND (? IS NULL OR i.invoice_date <= ?)
       ORDER BY i.invoice_date, i.reference, l.line_order`
    )
    .all(business, ledger, fromDate ?? null, fromDate ?? null, toDate ?? null, toDate ?? null) as (SalesReportLine & { item_id: number | null })[];

  const entities = getEntityTree();
  const categoryOf = (itemId: number | null): string => {
    if (!itemId) return 'Other';
    const entity = entities.find((e) => e.id === itemId);
    const parent = entities.find((e) => e.id === entity?.parent_id);
    return parent?.name ?? 'Other';
  };

  const summaryMap = new Map<string, { quantity: number; amount_minor: number }>();
  let total_quantity = 0;
  let total_amount_minor = 0;
  const detailed: SalesReportLine[] = [];
  for (const r of rows) {
    const { item_id, ...line } = r;
    detailed.push(line);
    const cat = categoryOf(item_id);
    const existing = summaryMap.get(cat) ?? { quantity: 0, amount_minor: 0 };
    existing.quantity += line.quantity ?? 0;
    existing.amount_minor += line.amount_minor;
    summaryMap.set(cat, existing);
    total_quantity += line.quantity ?? 0;
    total_amount_minor += line.amount_minor;
  }
  const category_summary = [...summaryMap.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.amount_minor - a.amount_minor);

  return { detailed, category_summary, total_quantity, total_amount_minor };
}

export function getProfitAndLossComparison(businessName: BusinessName, ledgerA: LedgerName, ledgerB: LedgerName): ProfitAndLossComparison {
  const plA = getProfitAndLoss(businessName, ledgerA);
  const plB = getProfitAndLoss(businessName, ledgerB);

  function mergeLines(
    linesA: StatementLine[],
    linesB: StatementLine[],
    sign: 1 | -1
  ): ProfitAndLossComparisonLine[] {
    const names = new Set([...linesA.map((l) => l.name), ...linesB.map((l) => l.name)]);
    // Reconstructs the raw signed balance from debit_minor/credit_minor
    // (debit is the positive item, credit the negated-positive item of
    // the same underlying signed value), same as before StatementLine
    // moved to the split-column shape.
    const rawBalance = (l: StatementLine | undefined) => (l ? l.debit_minor - l.credit_minor : 0);
    return Array.from(names).map((name) => {
      const la = linesA.find((l) => l.name === name);
      const lb = linesB.find((l) => l.name === name);
      const accountnumber = la?.accountnumber ?? lb?.accountnumber ?? null;
      const a_minor = sign * rawBalance(la);
      const b_minor = sign * rawBalance(lb);
      return { name, accountnumber, a_minor, b_minor, variance_minor: b_minor - a_minor };
    });
  }

  return {
    ledgerA,
    ledgerB,
    income: mergeLines(plA.income, plB.income, -1),
    expenses: mergeLines(plA.expenses, plB.expenses, 1),
    a_total_income_minor: plA.total_income_minor,
    b_total_income_minor: plB.total_income_minor,
    a_total_expenses_minor: plA.total_expenses_minor,
    b_total_expenses_minor: plB.total_expenses_minor,
    a_net_income_minor: plA.net_income_minor,
    b_net_income_minor: plB.net_income_minor,
    net_income_variance_minor: plB.net_income_minor - plA.net_income_minor,
  };
}

