// Documented in docs/pm-reports-reference.md, "The Reports API" -
// this file carries no further multiline comments.
import { db, getQualifiedDisplayName, getCombinationDisplayName, resolveBusinessCoaAccountId } from './db.js';
import { Hierarchy, Currency, type HierarchyTreeNode } from './primitives.js';
import { ValidationError, getEntityTree, stageLine, postJournalEntry, getHierarchyGroups, getHierarchyParent, getHierarchyChildren, asAccountName, requireEntity, typeBusinessName, typeRootName, getBusinessHomeCurrency, getAccountProfitCenter, setActiveLedger, type BusinessName, type LedgerName, type UserId } from './db.js';
import { Entity } from './primitives.js';

export interface ReportRow {
  report: string;
  category: string;
  account: string;
  account_id: number;
  depth: number;
  combination_ids: string | null;
  accountnumber: string | null;
  balance_minor: number | null;
}

export function getBusinessReports(business: string): ReportRow[] {
  return db
    .prepare(
      `WITH RECURSIVE coa_walk(id, name, depth, category_id, combination_ids, parent_id, relation_id) AS (
        SELECT e.id, e.name, 0, e.id, e.combination_ids, e.parent_id, e.relation_id
        FROM current_entities e
        WHERE e.parent_id = CASE
          -- 'admin' (schema/00-core.sql's own "the one legacy,
          -- pre-multi-tenancy demo business" comment) never got its
          -- own real, separate Chart of Accounts copy via
          -- copyChartOfAccountsInto - it posts directly against the
          -- GLOBAL Chart of Accounts instead (confirmed directly:
          -- "Cash and Bank" for 'admin' is entity id 11, parented
          -- under the GLOBAL "Asset," id 6, not under any
          -- business-scoped copy). It still has its OWN, real
          -- business-scoped "Chart of Accounts" entity (used for
          -- unrelated structural children like "Storage"), so a plain
          -- COALESCE on the root id alone can't detect this case - the
          -- root exists, it just has no real category children (every
          -- real category has relation_id pointing at its own global
          -- counterpart; "Storage" does not). Detected here instead by
          -- checking for at least one such real category child -
          -- falling back to the GLOBAL root, the exact, same,
          -- already-established fallback 00-core.sql's own
          -- post_journal_entry_insert trigger documents and uses for
          -- this identical, confirmed reason, only when none exist.
          WHEN EXISTS (
            SELECT 1 FROM current_entities cc
            WHERE cc.parent_id = (SELECT id FROM current_entities WHERE name = 'Chart of Accounts' AND parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')))
            AND cc.relation_id IS NOT NULL
          )
          THEN (SELECT id FROM current_entities WHERE name = 'Chart of Accounts' AND parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')))
          ELSE (SELECT id FROM current_entities WHERE name = 'Chart of Accounts' AND parent_id = (SELECT id FROM current_entities WHERE name = 'Application'))
        END
        UNION ALL
        SELECT e.id, e.name, w.depth + 1, w.category_id, e.combination_ids, e.parent_id, e.relation_id
        FROM current_entities e JOIN coa_walk w ON e.parent_id = w.id
      )
      SELECT
        rpt.name AS report,
        cat.name AS category,
        COALESCE(parent_e.name, w.name) AS account,
        w.id AS account_id,
        w.depth,
        w.combination_ids,
        a.accountnumber,
        a.balance_minor
      FROM coa_walk w
      JOIN current_entities cat ON cat.id = w.category_id
      -- The normal, real, two-hop case (a business-scoped category's
      -- relation_id points at its GLOBAL counterpart, whose own
      -- relation_id finally points at the report) breaks down for the
      -- one legacy business falling back to the GLOBAL Chart of
      -- Accounts directly above: there, cat IS already the global
      -- category, so cat.relation_id points straight at the report,
      -- one hop, not two. Disambiguated here by checking whether
      -- cat.relation_id's own target is itself a real report (a
      -- direct child of "Business Reports") - if so, that target IS
      -- the report (one hop); otherwise it's the intermediate global
      -- category, and ITS relation_id is the report (two hops), the
      -- original, real shape this query already handled.
      JOIN current_entities cat_relation ON cat_relation.id = cat.relation_id
      JOIN current_entities rpt ON rpt.id = CASE
        WHEN cat_relation.parent_id = (SELECT id FROM current_entities WHERE name = 'Business Reports') THEN cat_relation.id
        ELSE cat_relation.relation_id
      END
      LEFT JOIN account a ON a.entity_id = w.id
      LEFT JOIN current_entities rel ON rel.id = w.relation_id
      LEFT JOIN current_entities rel_parent ON rel_parent.id = rel.parent_id AND rel_parent.name = 'Ledgers'
      LEFT JOIN current_entities parent_e ON parent_e.id = w.parent_id AND rel_parent.id IS NOT NULL
      WHERE w.depth >= 1
      ORDER BY report, category, COALESCE(parent_e.name, w.name)`
    )
    .all(business, business) as ReportRow[];
}

export interface ChartRow {
  id: number;
  name: string;
  depth: number;
  path: string;
  accountnumber: string | null;
  balance_minor: number | null;
}

export function setAccountCurrency(accountName: string, currency: string | null, entityId?: number): void {
  const id = entityId ?? (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(accountName) as { id: number } | undefined)?.id;
  if (id == null) throw new ValidationError(`No such account: "${accountName}".`);
  db.prepare(`INSERT INTO account (entity_id) VALUES (?) ON CONFLICT (entity_id) DO NOTHING`).run(id);
  const result = db.prepare(`UPDATE account SET currency = ? WHERE entity_id = ?`).run(currency, id);
  if (result.changes !== 1) throw new ValidationError(`No such account: "${accountName}".`);
}

export function ensureCurrencyAccount(baseAccountId: number, currency: string, userId: UserId): { name: string; id: number } {
  const base = db.prepare(`SELECT name, parent_id FROM current_entities WHERE id = ?`).get(baseAccountId) as { name: string; parent_id: number } | undefined;
  if (!base) throw new ValidationError(`No such account id: ${baseAccountId}.`);
  const currencyAccountName = `${base.name} (${currency})`;
  const existing = Entity.getUnder(currencyAccountName, base.parent_id) ?? Entity.create(currencyAccountName, base.parent_id, userId);
  setAccountCurrency(currencyAccountName, currency, existing.id);
  return { name: currencyAccountName, id: existing.id };
}

export function ensureProfitCenterRetainedEarningsAccount(baseAccountId: number, profitCenterName: string, userId: UserId): { name: string; id: number } {
  const base = db.prepare(`SELECT name, parent_id FROM current_entities WHERE id = ?`).get(baseAccountId) as { name: string; parent_id: number } | undefined;
  if (!base) throw new ValidationError(`No such account id: ${baseAccountId}.`);
  const pcAccountName = `${base.name} (Profit Center: ${profitCenterName})`;
  const existing = Entity.getUnder(pcAccountName, base.parent_id) ?? Entity.create(pcAccountName, base.parent_id, userId);
  return { name: pcAccountName, id: existing.id };
}

export function resolveCashAtBankAccount(business: BusinessName, currency: string | undefined, userId: UserId): { name: string; id: number } {
  requireEntity(business, typeBusinessName, requireEntity('Businesses', typeRootName));
  const assetId = resolveBusinessCoaAccountId(business, 'Asset');
  const existing = Entity.getUnder('Cash at Bank', assetId);
  const homeCurrency = getBusinessHomeCurrency(business) ?? undefined;
  const effectiveCurrency = currency ?? homeCurrency;

  if (!effectiveCurrency || effectiveCurrency === homeCurrency) {
    const legacyCashAndBank = Entity.getUnder('Cash and Bank', assetId);
    if (legacyCashAndBank) return { name: legacyCashAndBank.name, id: legacyCashAndBank.id };
    if (existing) return { name: existing.name, id: existing.id };
    const created = Entity.create('Cash at Bank', assetId, userId);
    return { name: created.name, id: created.id };
  }

  const currencyBase = existing ?? Entity.create('Cash at Bank', assetId, userId);
  const currencyLeaves = Entity.children(currencyBase.id).filter((c) => /\([A-Za-z]{3}\)$/.test(c.name));
  const existingLeaf = currencyLeaves.find((c) => c.name.endsWith(`(${effectiveCurrency})`));
  if (existingLeaf) return existingLeaf;
  return ensureCurrencyAccount(currencyBase.id, effectiveCurrency, userId);
}

export function getChartOfAccounts(business: string): ChartRow[] {
  const rows = db
    .prepare(
      `WITH RECURSIVE walk(id, name, depth, path) AS (
        SELECT e.id, e.name, 0, e.name
        FROM current_entities e
        -- Same two, real, stacked bugs already found and fixed in
        -- getBusinessReports, just above: (1) the business-name lookup
        -- must be scoped to 'Businesses', since a bare lookup collides
        -- with the admin login user (same name, different entity) and
        -- (2) 'admin' (schema/00-core.sql's own "the one legacy,
        -- pre-multi-tenancy demo business" comment) never got its own,
        -- separate Chart of Accounts copy - it posts directly against
        -- the GLOBAL one, so falls back to that root, the same,
        -- already-established COALESCE-fallback pattern
        -- post_journal_entry_insert documents, when this business's
        -- own Chart of Accounts has no real category child at all
        -- (relation_id IS NOT NULL) to find.
        WHERE e.id = CASE
          WHEN EXISTS (
            SELECT 1 FROM current_entities cc
            WHERE cc.parent_id = (SELECT id FROM current_entities WHERE name = 'Chart of Accounts' AND parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')))
            AND cc.relation_id IS NOT NULL
          )
          THEN (SELECT id FROM current_entities WHERE name = 'Chart of Accounts' AND parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')))
          ELSE (SELECT id FROM current_entities WHERE name = 'Chart of Accounts' AND parent_id = (SELECT id FROM current_entities WHERE name = 'Application'))
        END
        UNION ALL
        SELECT e.id, e.name, w.depth + 1, w.path || ' > ' || e.name
        FROM current_entities e JOIN walk w ON e.parent_id = w.id
      )
      SELECT w.id, w.name, w.depth, w.path, a.accountnumber, a.balance_minor
      FROM walk w
      LEFT JOIN account a ON a.entity_id = w.id
      WHERE w.depth >= 1
      ORDER BY w.path`
    )
    .all(business, business) as ChartRow[];

  const linkedRows: ChartRow[] = [];
  for (const row of rows) {
    for (const childRootName of getHierarchyChildren(row.name, 'Header Account')) {
      const childRoot = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(childRootName) as { id: number } | undefined;
      if (!childRoot) continue;
      const descendants = db
        .prepare(
          `WITH RECURSIVE walk(id, name, depth, path) AS (
            SELECT e.id, e.name, 0, e.name
            FROM current_entities e WHERE e.id = ?
            UNION ALL
            SELECT e.id, e.name, w.depth + 1, w.path || ' > ' || e.name
            FROM current_entities e JOIN walk w ON e.parent_id = w.id
            -- Structural plumbing the hierarchy/contact-type link
            -- mechanisms create as real, named child entities of their
            -- own (e.g. "Acme Corp — Contact Type: Customer") — never
            -- real accounts, so excluded here the same way this report
            -- already only shows real CoA leaves, not its own internal
            -- wiring.
            WHERE e.name NOT LIKE '% — Hierarchy: %' AND e.name NOT LIKE '% — Contact Type: %'
          )
          SELECT w.id, w.name, w.depth, w.path, a.accountnumber, a.balance_minor
          FROM walk w
          LEFT JOIN account a ON a.entity_id = w.id
          WHERE w.depth >= 1
          ORDER BY w.path`
        )
        .all(childRoot.id) as ChartRow[];
      for (const d of descendants) {
        linkedRows.push({ ...d, depth: row.depth + d.depth, path: `${row.path} > ${d.path}` });
      }
    }
  }

  return [...rows, ...linkedRows].sort((a, b) => a.path.localeCompare(b.path));
}

function resolveAccountHierarchyGroup(accountName: string, hierarchyPath: string[]): string | undefined {
  if (hierarchyPath.length === 0) return undefined;
  let current: string | undefined = accountName;
  for (const hierarchyName of hierarchyPath) {
    if (!current) return undefined;
    current = getHierarchyParent(current, hierarchyName);
  }
  return current;
}

export function getLedgerBalancesByHierarchyStructural(
  businessName: BusinessName,
  ledgerName: LedgerName,
  hierarchyPath: string[],
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
       WHERE jo.ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Ledgers' AND parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses'))))
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
    const group = resolveAccountHierarchyGroup(r.account_name, hierarchyPath) ?? null;
    if (!result.has(r.id)) result.set(r.id, new Map());
    result.get(r.id)!.set(group, r.balance_minor);
  }
  return result;
}

const LOCATION_HIERARCHY_PATH = ['Location'];

export function getLedgerBalancesByLocationStructural(
  businessName: BusinessName,
  ledgerName: LedgerName,
  fromDate?: string,
  toDate?: string,
  excludeCloseEntries = false
): Map<number, Map<string | null, number>> {
  return getLedgerBalancesByHierarchyStructural(businessName, ledgerName, LOCATION_HIERARCHY_PATH, fromDate, toDate, excludeCloseEntries);
}

export function getLedgerBalances(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, excludeCloseEntries = false): Map<number, number> {
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
       )
       SELECT a.entity_id AS id,
              COALESCE(SUM(CASE WHEN jo.ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Ledgers' AND parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses'))))
                                 AND (? IS NULL OR jo.transdate >= ?)
                                 AND (? IS NULL OR jo.transdate <= ?)
                                 AND (? = 0 OR j.reference NOT LIKE 'CLOSE-%')
                                 THEN jo.amount_minor ELSE 0 END), 0) AS balance_minor
       FROM account a
       JOIN reportable_accounts ra ON ra.id = a.entity_id
       LEFT JOIN journal_occurrences jo ON jo.account_id = a.entity_id
       LEFT JOIN journal j ON j.id = jo.journal_id
       GROUP BY a.entity_id`
    )
    .all(ledgerName, businessName, fromDate ?? null, fromDate ?? null, toDate ?? null, toDate ?? null, excludeCloseEntries ? 1 : 0) as {
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
  currency: string | null;
  has_quantity_postings: boolean;
}

export interface TrialBalanceCurrencySubtotal {
  currency: string | null;
  total_debit_minor: number;
  total_credit_minor: number;
  balanced: boolean;
}

export interface TrialBalance {
  rows: TrialBalanceRow[];
  total_debit_minor: number;
  total_credit_minor: number;
  by_currency: TrialBalanceCurrencySubtotal[];
}

export function getTrialBalance(businessName: BusinessName, ledgerName: LedgerName, asOfDate?: string): TrialBalance {
  const balances = getLedgerBalances(businessName, ledgerName, undefined, asOfDate);
  const accounts = db
    .prepare(`SELECT e.id, e.name, e.parent_id, e.combination_ids, a.accountnumber, a.currency FROM account a JOIN current_entities e ON e.id = a.entity_id`)
    .all() as { id: number; name: string; parent_id: number | null; combination_ids: string | null; accountnumber: string | null; currency: string | null }[];

  const relevantAccounts = accounts.filter((a) => (balances.get(a.id) ?? 0) !== 0);
  const nameCounts = new Map<string, number>();
  for (const a of relevantAccounts) nameCounts.set(a.name, (nameCounts.get(a.name) ?? 0) + 1);

  const quantityAccountIds = new Set(
    (
      db
        .prepare(`SELECT DISTINCT jl.account_id AS id FROM journal_line jl JOIN journal j ON j.id = jl.journal_id WHERE j.reference LIKE '%-QTY'`)
        .all() as { id: number }[]
    ).map((r) => r.id)
  );

  const rows: TrialBalanceRow[] = accounts
    .map((a) => {
      const balance_minor = balances.get(a.id) ?? 0;
      const displayName = a.combination_ids != null ? getCombinationDisplayName(a.id) : (nameCounts.get(a.name) ?? 0) > 1 ? getQualifiedDisplayName(a.id) : a.name;
      return {
        id: a.id,
        name: displayName,
        accountnumber: a.accountnumber,
        debit_minor: balance_minor > 0 ? balance_minor : 0,
        credit_minor: balance_minor < 0 ? -balance_minor : 0,
        currency: a.currency,
        has_quantity_postings: quantityAccountIds.has(a.id),
      };
    })
    .filter((r) => r.debit_minor !== 0 || r.credit_minor !== 0)
    .sort((a, b) => (a.accountnumber ?? '').localeCompare(b.accountnumber ?? '') || a.name.localeCompare(b.name));

  const currencyTotals = new Map<string | null, { debit: number; credit: number }>();
  for (const r of rows) {
    const entry = currencyTotals.get(r.currency) ?? { debit: 0, credit: 0 };
    entry.debit += r.debit_minor;
    entry.credit += r.credit_minor;
    currencyTotals.set(r.currency, entry);
  }
  const by_currency: TrialBalanceCurrencySubtotal[] = [...currencyTotals.entries()]
    .map(([currency, { debit, credit }]) => ({ currency, total_debit_minor: debit, total_credit_minor: credit, balanced: debit === credit }))
    .sort((a, b) => (a.currency ?? '').localeCompare(b.currency ?? ''));

  return {
    rows,
    total_debit_minor: rows.reduce((s, r) => s + r.debit_minor, 0),
    total_credit_minor: rows.reduce((s, r) => s + r.credit_minor, 0),
    by_currency,
  };
}

export interface StatementLine {
  name: string;
  accountnumber: string | null;
  debit_minor: number;
  credit_minor: number;
    is_contra: boolean;
}

export interface BalanceSheet {
  assets: StatementLine[];
  liabilities: StatementLine[];
  equity: StatementLine[];
    assets_tree: CategoryTreeNode[];
  liabilities_tree: CategoryTreeNode[];
  equity_tree: CategoryTreeNode[];
  total_assets_minor: number;
  total_liabilities_minor: number;
  total_equity_minor: number;
  balanced: boolean;
}

export function getBalanceSheet(businessName: BusinessName, ledgerName: LedgerName, asOfDate?: string): BalanceSheet {
  const balances = getLedgerBalances(businessName, ledgerName, undefined, asOfDate);
  const rows = getBusinessReports(businessName)
    .filter((r) => r.report === 'Balance Sheet')
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

  const assets = rows.filter((r) => r.category === 'Asset').map((r) => toLine(r, 'debit'));
  const liabilities = rows.filter((r) => r.category === 'Liability').map((r) => toLine(r, 'credit'));
  const equity = rows.filter((r) => r.category === 'Equity').map((r) => toLine(r, 'credit'));

  const accountIdByName = new Map(rows.map((r) => [r.account, r.account_id]));
  const assets_tree = buildCategoryTree(assets, accountIdByName, 'Asset', 'debit', resolveBusinessCoaAccountId(businessName, 'Asset'));
  const liabilities_tree = buildCategoryTree(liabilities, accountIdByName, 'Liability', 'credit', resolveBusinessCoaAccountId(businessName, 'Liability'));
  const equity_tree: CategoryTreeNode[] = equity.map((l) => ({ name: l.name, accountnumber: l.accountnumber, is_leaf: true, debit_minor: l.debit_minor, credit_minor: l.credit_minor, is_contra: l.is_contra, children: [] }));

  const sumHierarchyDescendants = (headerAccountName: string): number => {
    const hierarchyChildren = getHierarchyChildren(headerAccountName, 'Header Account');
    const startNames = [headerAccountName, ...hierarchyChildren];
    const alreadyCapturedIds = [...new Set(rows.map((r) => r.account_id))];
    const row = db
      .prepare(
        `WITH RECURSIVE walk(id) AS (
           SELECT id FROM current_entities WHERE name IN (${startNames.map(() => '?').join(',')})
           UNION ALL
           SELECT e.id FROM current_entities e JOIN walk w ON e.parent_id = w.id
         )
         SELECT COALESCE(SUM(jo.amount_minor), 0) AS total
         FROM journal_occurrences jo
         WHERE jo.account_id IN (SELECT id FROM walk)
           AND jo.account_id NOT IN (${alreadyCapturedIds.length ? alreadyCapturedIds.map(() => '?').join(',') : 'NULL'})
           AND jo.ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Ledgers' AND parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses'))))
           AND (? IS NULL OR jo.transdate <= ?)`
      )
      .get(...startNames, ...alreadyCapturedIds, ledgerName, businessName, asOfDate ?? null, asOfDate ?? null) as { total: number };
    return row.total;
  };

  const receivableTotal = sumHierarchyDescendants('Accounts Receivable');
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
  const payableTotal = sumHierarchyDescendants('Accounts Payable');
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

  const { net_income_minor } = getProfitAndLoss(businessName, ledgerName, undefined, undefined, false);
  if (net_income_minor !== 0) {
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
    cogs_expenses: StatementLine[];
    operating_expenses: StatementLine[];
    income_tree: CategoryTreeNode[];
  cogs_tree: CategoryTreeNode[];
  operating_expenses_tree: CategoryTreeNode[];
  total_income_minor: number;
  total_expenses_minor: number;
    gross_profit_minor: number;
  net_income_minor: number;
}

export interface CategoryTreeNode {
  name: string;
  accountnumber: string | null;
    is_leaf: boolean;
  debit_minor: number;
  credit_minor: number;
  is_contra: boolean;
    children: CategoryTreeNode[];
}

export function buildCategoryTree(lines: StatementLine[], accountIdByName: Map<string, number>, rootName: string, normalSide: 'debit' | 'credit' = 'debit', knownRootId?: number): CategoryTreeNode[] {
  const lineByAccountId = new Map(lines.map((l) => [accountIdByName.get(l.name), l]));

  const tree = Hierarchy.buildTree(
    rootName,
    (name, id) => {
      const line = id != null ? lineByAccountId.get(id) : undefined;
      return { amount_minor: line ? Currency.fromDebitCredit(line.debit_minor, line.credit_minor) : 0 };
    },
    undefined,
    knownRootId
  );

  function toCategoryNode(n: HierarchyTreeNode): CategoryTreeNode | null {
    const line = n.accountId != null ? lineByAccountId.get(n.accountId) : undefined;
    const children = n.children.map((c) => toCategoryNode(c)).filter((c): c is CategoryTreeNode => c !== null);
    const isLeaf = line !== undefined;
    if (!isLeaf && children.length === 0) return null;
    if (isLeaf) return { name: line.name, accountnumber: line.accountnumber, is_leaf: true, debit_minor: line.debit_minor, credit_minor: line.credit_minor, is_contra: line.is_contra, children: [] };
    const { debit_minor, credit_minor } = Currency.toDebitCredit(n.total.amount_minor, normalSide);
    return { name: n.name, accountnumber: null, is_leaf: false, debit_minor, credit_minor, is_contra: false, children: children.sort((a, b) => a.name.localeCompare(b.name)) };
  }

  const topLevel = tree.children.map((c) => toCategoryNode(c)).filter((c): c is CategoryTreeNode => c !== null);
  topLevel.sort((a, b) => a.name.localeCompare(b.name));
  return topLevel;
}

export function getProfitAndLoss(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, excludeCloseEntries = true): ProfitAndLoss {
  const balances = getLedgerBalances(businessName, ledgerName, fromDate, toDate, excludeCloseEntries);
  return buildProfitAndLossFromBalances(businessName, balances);
}

export function buildProfitAndLossFromBalances(business: string, balances: Map<number, number>): ProfitAndLoss {
  const rows = getBusinessReports(business)
    .filter((r) => r.report === 'Profit and Loss Statement')
    .map((r) => ({ ...r, balance_minor: balances.get(r.account_id) ?? 0 }))
    .filter((r) => r.balance_minor !== 0);

  const nameCounts = new Map<string, number>();
  for (const r of rows) nameCounts.set(r.account, (nameCounts.get(r.account) ?? 0) + 1);

  const toLine = (r: (typeof rows)[number], normalSide: 'debit' | 'credit'): StatementLine => {
    const { debit_minor, credit_minor, is_contra } = Currency.toDebitCredit(r.balance_minor, normalSide);
    const isDuplicated = (nameCounts.get(r.account) ?? 0) > 1;
    const name = r.combination_ids != null ? getCombinationDisplayName(r.account_id) : isDuplicated ? getQualifiedDisplayName(r.account_id) : r.account;
    return {
      name,
      accountnumber: r.accountnumber,
      debit_minor,
      credit_minor,
      is_contra,
    };
  };

  const income = rows.filter((r) => r.category === 'Income').map((r) => toLine(r, 'credit'));
  const expenseRows = rows.filter((r) => r.category === 'Expense');
  const expenses = expenseRows.map((r) => toLine(r, 'debit'));

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

  const accountIdByName = new Map(rows.map((r) => [r.account, r.account_id]));
  const incomeRootId = resolveBusinessCoaAccountId(business as BusinessName, 'Income');
  const expenseRootId = resolveBusinessCoaAccountId(business as BusinessName, 'Expense');
  const income_tree = buildCategoryTree(income, accountIdByName, 'Income', 'credit', incomeRootId);
  const cogs_tree = buildCategoryTree(cogs_expenses, accountIdByName, 'Expense', 'debit', expenseRootId);
  const operating_expenses_tree = buildCategoryTree(operating_expenses, accountIdByName, 'Expense', 'debit', expenseRootId);

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

export interface ProfitAndLossByGroup {
  group: string | null;
  profitAndLoss: ProfitAndLoss;
}

export function getProfitAndLossByHierarchy(businessName: BusinessName, ledgerName: LedgerName, hierarchyPath: string[], fromDate?: string, toDate?: string): ProfitAndLossByGroup[] {
  const balancesByGroup = getLedgerBalancesByHierarchyStructural(businessName, ledgerName, hierarchyPath, fromDate, toDate, true);

  const byGroup = new Map<string | null, Map<number, number>>();
  for (const [accountId, groupMap] of balancesByGroup.entries()) {
    for (const [groupName, balance] of groupMap.entries()) {
      if (!byGroup.has(groupName)) byGroup.set(groupName, new Map());
      byGroup.get(groupName)!.set(accountId, balance);
    }
  }

  return Array.from(byGroup.entries())
    .sort(([a], [b]) => (a ?? '').localeCompare(b ?? ''))
    .map(([group, balances]) => ({
      group,
      profitAndLoss: buildProfitAndLossFromBalances(businessName, balances),
    }));
}

export function getProfitAndLossForHierarchyGroup(
  businessName: BusinessName,
  ledgerName: LedgerName,
  hierarchyPath: string[],
  groups: { name: string; parentName: string | null }[],
  groupName: string,
  fromDate?: string,
  toDate?: string
): ProfitAndLoss {
  const descendants = new Set<string>([groupName]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const g of groups) {
      if (g.parentName && descendants.has(g.parentName) && !descendants.has(g.name)) {
        descendants.add(g.name);
        grew = true;
      }
    }
  }
  const balancesByGroup = getLedgerBalancesByHierarchyStructural(businessName, ledgerName, hierarchyPath, fromDate, toDate, true);
  const combined = new Map<number, number>();
  for (const [accountId, groupMap] of balancesByGroup.entries()) {
    let total = 0;
    for (const [group, balance] of groupMap.entries()) {
      if (group !== null && descendants.has(group)) total += balance;
    }
    if (total !== 0) combined.set(accountId, total);
  }
  return buildProfitAndLossFromBalances(businessName, combined);
}

export interface ProfitAndLossByGroupNode extends ProfitAndLossByGroup {
  children: ProfitAndLossByGroupNode[];
}

export function getProfitAndLossByHierarchyTree(businessName: BusinessName, ledgerName: LedgerName, hierarchyPath: string[], hierarchyName: string, fromDate?: string, toDate?: string): ProfitAndLossByGroupNode[] {
  const flat = getProfitAndLossByHierarchy(businessName, ledgerName, hierarchyPath, fromDate, toDate);
  const groups = getHierarchyGroups(hierarchyName);
  const parentByName = new Map(groups.map((g) => [g.name, g.parentName]));

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

  const nodesByName = new Map<string | null, ProfitAndLossByGroupNode>();
  for (const entry of flat) {
    nodesByName.set(entry.group, { ...entry, children: [] });
  }
  for (const entry of flat) {
    if (entry.group === null) continue;
    let current: string | null = parentByName.get(entry.group) ?? null;
    while (current !== null && !nodesByName.has(current)) {
      nodesByName.set(current, { group: current, profitAndLoss: emptyProfitAndLoss, children: [] });
      current = parentByName.get(current) ?? null;
    }
  }

  const roots: ProfitAndLossByGroupNode[] = [];
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

  const sortNode = (n: ProfitAndLossByGroupNode) => {
    n.children.sort((a, b) => (a.group ?? '').localeCompare(b.group ?? ''));
    n.children.forEach(sortNode);
  };
  roots.sort((a, b) => (a.group ?? '').localeCompare(b.group ?? ''));
  roots.forEach(sortNode);
  return roots;
}

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

export interface CloseBooksResult {
  reference: string;
  netIncomeMinor: number;
  accountsZeroed: number;
    groupBreakdown: { group: string | null; netIncomeMinor: number }[];
    profitCenterBreakdown: { profitCenter: string | null; netIncomeMinor: number }[];
}

export interface CloseBooksLine {
  account: string;
  accountId?: number;
  amount_minor: number;
}
interface ComputedClose {
  lines: CloseBooksLine[];
  netIncomeMinor: number;
  accountsZeroed: number;
  groupBreakdown: { group: string | null; netIncomeMinor: number }[];
  profitCenterBreakdown: { profitCenter: string | null; netIncomeMinor: number }[];
}

function computeCloseLines(businessName: BusinessName, ledger: LedgerName, asOfDate: string, retainedEarningsAccount: string, hierarchyPath: string[], userId?: UserId): ComputedClose {
  const balancesByGroup = getLedgerBalancesByHierarchyStructural(businessName, ledger, hierarchyPath, undefined, asOfDate);
  const rows = getBusinessReports(businessName).filter((r) => r.report === 'Profit and Loss Statement' || r.category === 'Income' || r.category === 'Expense');

  let netIncomeMinor = 0;
  let accountsZeroed = 0;
  const netByGroup = new Map<string, { group: string | null; currency: string | null; profitCenter: string | null; net: number }>();
  const lines: CloseBooksLine[] = [];

  for (const r of rows) {
    const groupBalances = balancesByGroup.get(r.account_id);
    if (!groupBalances) continue;
    const currency = (db.prepare(`SELECT currency FROM account WHERE entity_id = ?`).get(r.account_id) as { currency: string | null } | undefined)?.currency ?? null;
    const profitCenter = getAccountProfitCenter(r.account_id);
    let accountTotal = 0;
    for (const [groupName, balance] of groupBalances) {
      if (balance === 0) continue;
      accountTotal += balance;
      const key = `${groupName ?? ''}\u0000${currency ?? ''}\u0000${profitCenter ?? ''}`;
      const existing = netByGroup.get(key) ?? { group: groupName, currency, profitCenter, net: 0 };
      existing.net -= balance;
      netByGroup.set(key, existing);
    }
    if (accountTotal === 0) continue;
    lines.push({ account: r.account, accountId: r.account_id, amount_minor: -accountTotal });
    netIncomeMinor -= accountTotal;
    accountsZeroed += 1;
  }

  if (accountsZeroed > 0) {
    const netByCurrencyProfitCenter = new Map<string, { currency: string | null; profitCenter: string | null; net: number }>();
    for (const { currency, profitCenter, net } of netByGroup.values()) {
      const key = `${currency ?? ''}\u0000${profitCenter ?? ''}`;
      const existing = netByCurrencyProfitCenter.get(key) ?? { currency, profitCenter, net: 0 };
      existing.net += net;
      netByCurrencyProfitCenter.set(key, existing);
    }
    for (const { currency, profitCenter, net } of netByCurrencyProfitCenter.values()) {
      if (net === 0) continue;
      if ((currency || profitCenter) && userId) {
        const retainedEarningsId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(retainedEarningsAccount) as { id: number }).id;
        const target = profitCenter ? ensureProfitCenterRetainedEarningsAccount(retainedEarningsId, profitCenter, userId) : { id: retainedEarningsId, name: retainedEarningsAccount };
        const tagged = currency ? ensureCurrencyAccount(target.id, currency, userId) : target;
        lines.push({ account: tagged.name, accountId: tagged.id, amount_minor: -net });
      } else {
        lines.push({ account: retainedEarningsAccount, amount_minor: -net });
      }
    }
  }

  const groupBreakdown = (() => {
    const netByGroupCurrency = new Map<string, { group: string | null; currency: string | null; net: number }>();
    for (const { group, currency, net } of netByGroup.values()) {
      const key = `${group ?? ''}\u0000${currency ?? ''}`;
      const existing = netByGroupCurrency.get(key) ?? { group, currency, net: 0 };
      existing.net += net;
      netByGroupCurrency.set(key, existing);
    }
    return Array.from(netByGroupCurrency.values())
      .filter(({ net }) => net !== 0)
      .map(({ group, net }) => ({ group, netIncomeMinor: net }))
      .sort((a, b) => (a.group ?? '').localeCompare(b.group ?? ''));
  })();

  const profitCenterBreakdown = (() => {
    const netByProfitCenter = new Map<string | null, number>();
    for (const { profitCenter, net } of netByGroup.values()) {
      netByProfitCenter.set(profitCenter, (netByProfitCenter.get(profitCenter) ?? 0) + net);
    }
    return Array.from(netByProfitCenter.entries())
      .filter(([, net]) => net !== 0)
      .map(([profitCenter, net]) => ({ profitCenter, netIncomeMinor: net }))
      .sort((a, b) => (a.profitCenter ?? '').localeCompare(b.profitCenter ?? ''));
  })();

  return { lines, netIncomeMinor, accountsZeroed, groupBreakdown, profitCenterBreakdown };
}

export interface CloseBooksPreview {
  lines: CloseBooksLine[];
  netIncomeMinor: number;
  accountsZeroed: number;
  groupBreakdown: { group: string | null; netIncomeMinor: number }[];
  profitCenterBreakdown: { profitCenter: string | null; netIncomeMinor: number }[];
}

export function previewCloseBooks(businessName: BusinessName, ledger: LedgerName, asOfDate: string, retainedEarningsAccount: string, hierarchyPath: string[] = []): CloseBooksPreview {
  const computed = computeCloseLines(businessName, ledger, asOfDate, retainedEarningsAccount, hierarchyPath);
  if (computed.accountsZeroed === 0) {
    throw new ValidationError(`Nothing to close for "${ledger}" as of ${asOfDate} — every Income/Expense account is already zero.`);
  }
  return computed;
}

export function closeBooks(business: BusinessName, ledger: LedgerName, asOfDate: string, retainedEarningsAccount: string, userId: UserId, hierarchyPath: string[] = []): CloseBooksResult {
  const reference = `CLOSE-${ledger}-${asOfDate}`;
  const computed = computeCloseLines(business, ledger, asOfDate, retainedEarningsAccount, hierarchyPath, userId);

  if (computed.accountsZeroed === 0) {
    throw new ValidationError(`Nothing to close for "${ledger}" as of ${asOfDate} — every Income/Expense account is already zero.`);
  }

  for (const line of computed.lines) {
    stageLine({
      reference,
      business,
      ledger,
      transdate: asOfDate,
      account: asAccountName(line.account),
      accountId: line.accountId,
      amount_minor: line.amount_minor,
      memo: line.account === retainedEarningsAccount ? 'Year-end close — net income retained' : 'Year-end close',
    });
  }

  postJournalEntry(reference, business, ledger, userId);

  return { reference, netIncomeMinor: computed.netIncomeMinor, accountsZeroed: computed.accountsZeroed, groupBreakdown: computed.groupBreakdown, profitCenterBreakdown: computed.profitCenterBreakdown };
}

export interface RolloverResult {
  newLedger: LedgerName;
  accountsCarriedForward: number;
  openingBalanceReference: string;
}

export interface RolloverLine {
  account: string;
  amount_minor: number;
}
export interface ResolvedRollover {
  reference: string;
  lines: RolloverLine[];
  accountsCarriedForward: number;
}

export function resolveRolloverLines(business: BusinessName, oldLedger: LedgerName, newLedger: LedgerName, asOfDate: string, userId: UserId): ResolvedRollover {
  const businessId = (db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')`).get(business) as { id: number } | undefined)?.id;
  if (!businessId) throw new ValidationError(`No real business named "${business}".`);
  const ledgersRootId = (db.prepare(`SELECT id FROM current_entities WHERE name = 'Ledgers' AND parent_id = ?`).get(businessId) as { id: number } | undefined)?.id;
  if (!ledgersRootId) throw new ValidationError(`No real "Ledgers" node for "${business}" — this business was not created with the current, real structure.`);
  const newLedgerId = (db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(newLedger, ledgersRootId) as { id: number } | undefined)?.id;
  if (!newLedgerId) throw new ValidationError(`No real ledger named "${newLedger}" under "${business}" — create it first.`);

  const bs = getBalanceSheet(business, oldLedger, asOfDate);
  const usedLines = [...bs.assets, ...bs.liabilities, ...bs.equity].filter((l) => l.debit_minor !== 0 || l.credit_minor !== 0);

  if (usedLines.length === 0) {
    throw new ValidationError(`Nothing to carry forward for "${oldLedger}" as of ${asOfDate} — every Balance Sheet account is already zero.`);
  }

  for (const line of usedLines) {
    const coaLeafId = resolveBusinessCoaAccountId(business, line.name);
    const existing = Entity.getUnder(newLedger, coaLeafId);
    if (!existing) {
      const node = Entity.create(newLedger, coaLeafId, userId);
      Entity.relate(node.id, null, userId, newLedgerId);
    }
  }

  const reference = `ROLLOVER-${newLedger}-${asOfDate}`;
  const lines: RolloverLine[] = usedLines.map((line) => ({ account: line.name, amount_minor: line.debit_minor - line.credit_minor }));

  return { reference, lines, accountsCarriedForward: usedLines.length };
}

export function rolloverToNewPeriod(business: BusinessName, oldLedger: LedgerName, newLedger: LedgerName, asOfDate: string, userId: UserId): RolloverResult {
  const resolved = resolveRolloverLines(business, oldLedger, newLedger, asOfDate, userId);

  for (const line of resolved.lines) {
    stageLine({
      reference: resolved.reference,
      business,
      ledger: newLedger,
      transdate: asOfDate,
      account: asAccountName(line.account),
      amount_minor: line.amount_minor,
      memo: `Opening balance carried forward from ${oldLedger}`,
    });
  }
  postJournalEntry(resolved.reference, business, newLedger, userId);
  setActiveLedger(business, newLedger, userId);

  return { newLedger, accountsCarriedForward: resolved.accountsCarriedForward, openingBalanceReference: resolved.reference };
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

export function getSalesReport(business: BusinessName, ledger: LedgerName, fromDate?: string, toDate?: string): SalesReport {
  const rows = db
    .prepare(
      `SELECT i.invoice_date, i.reference, pe.name AS item_name, l.description,
              l.quantity, l.unit_price_minor, l.amount_minor, l.item_id
       FROM invoice_detail_line l
       JOIN invoice i ON i.id = l.invoice_id
       LEFT JOIN current_entities pe ON pe.id = l.item_id
       WHERE i.business_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses'))
         AND i.ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Ledgers' AND parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses'))))
         AND i.invoice_type = 'AR'
         AND i.document_type = 'invoice'
         AND i.status = 'posted'
         AND (? IS NULL OR i.invoice_date >= ?)
         AND (? IS NULL OR i.invoice_date <= ?)
       ORDER BY i.invoice_date, i.reference, l.line_order`
    )
    .all(business, ledger, business, fromDate ?? null, fromDate ?? null, toDate ?? null, toDate ?? null) as (SalesReportLine & { item_id: number | null })[];

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

