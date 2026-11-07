// Documented in docs/pm-reports-reference.md, "The Reports API" -
// this file carries no further multiline comments.
import { db, getQualifiedDisplayName, getCombinationDisplayName, resolveBusinessCoaAccountId } from './db.js';
import { Hierarchy, Currency, type HierarchyTreeNode } from './primitives.js';
import { ValidationError, getEntityTree, stageLine, postJournalEntry, getHierarchyGroups, getHierarchyParent, getHierarchyChildren, asAccountName, requireEntity, typeBusinessName, typeRootName, getBusinessHomeCurrency, getAccountProfitCenter, setActiveLedger, type BusinessName, type LedgerName, type UserId } from './db.js';
import { Entity } from './primitives.js';
import type { EntityNode } from './entity-driver.js';

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

// Resolves the Chart of Accounts root a business's reports should walk —
// the business's own copy when it has at least one real category child
// (relation_id IS NOT NULL: every real category's relation_id points at
// its own global counterpart), else the GLOBAL Chart of Accounts under
// "Application". 'admin' (schema/00-core.sql's own "the one legacy,
// pre-multi-tenancy demo business" comment) never got its own, separate
// Chart of Accounts copy via copyChartOfAccountsInto — it posts directly
// against the GLOBAL one instead, and falls back here for exactly that
// reason, the same, already-established fallback post_journal_entry_insert
// documents and uses. Resolved once in TS instead of twice per query (the
// original SQL took the business name as two positional params, once per
// branch of its own CASE).
function resolveBusinessReportsCoaRootId(business: string): number {
  const businessEntity = Entity.get(business, 'Businesses');
  const businessCoa = businessEntity ? Entity.getUnder('Chart of Accounts', businessEntity.id) : undefined;
  const hasRealCategoryChild = businessCoa ? Entity.children(businessCoa.id).some((c) => c.relation_id !== null) : false;
  if (businessCoa && hasRealCategoryChild) return businessCoa.id;
  const applicationRoot = Entity.get('Application');
  const globalCoa = applicationRoot ? Entity.getUnder('Chart of Accounts', applicationRoot.id) : undefined;
  if (!globalCoa) throw new ValidationError('No global Chart of Accounts found.');
  return globalCoa.id;
}

// Replaces a `WITH RECURSIVE coa_walk ... current_entities` CTE joined to
// `account` in the same statement — a category-4 site, and the most
// involved one in this file (6 distinct entity roles: the walked node
// itself, its category, the category's relation target, the resolved
// report, the node's own relation target, and that relation target's own
// parent). The tree walk now happens via the EntityDriver; every
// id-to-name/parent/relation resolution below is a direct port of the
// original SQL's own JOIN conditions, preserving its exact one-hop/two-hop
// report disambiguation and its "ledger-scoped account displays its
// parent's name instead of its own" override. combination_ids is the one
// other approved JSON exception (see getTrialBalance's identical note
// below) — EntityNode deliberately doesn't carry it, so it's read
// directly off current_entities by id, a plain single-table lookup, not a
// category-4 join.
export function getBusinessReports(business: string): ReportRow[] {
  const rootId = resolveBusinessReportsCoaRootId(business);
  const businessReportsRoot = Entity.get('Business Reports');
  const categories = Entity.children(rootId);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  type WalkNode = { id: number; name: string; depth: number; categoryId: number; parent_id: number | null; relation_id: number | null };
  const walk: WalkNode[] = [];
  for (const category of categories) {
    for (const node of Entity.descendantsWithDepth(category.id)) {
      walk.push({ id: node.id, name: node.name, depth: node.depth, categoryId: category.id, parent_id: node.parent_id, relation_id: node.relation_id });
    }
  }

  // Per-category report resolution (cat -> cat_relation -> rpt) — small
  // cardinality (one real top-level category at a time), each resolved
  // once and reused by every row under it. A category with no resolvable
  // report (missing relation_id, or a relation target with no report of
  // its own) is dropped entirely below, matching the original's INNER
  // JOINs on cat_relation/rpt.
  const reportByCategoryId = new Map<number, EntityNode>();
  for (const category of categories) {
    if (category.relation_id === null) continue;
    const catRelation = Entity.get(category.relation_id);
    if (!catRelation) continue;
    const isOneHop = businessReportsRoot !== undefined && catRelation.parent_id === businessReportsRoot.id;
    const rpt = isOneHop ? catRelation : catRelation.relation_id !== null ? Entity.get(catRelation.relation_id) : undefined;
    if (rpt) reportByCategoryId.set(category.id, rpt);
  }

  // Batch-resolve every walked row's own relation target (`rel`) and
  // parent (`parent_e`) — the ledger-scoped-account display-name override.
  const relIds = [...new Set(walk.map((w) => w.relation_id).filter((id): id is number => id !== null))];
  const relById = new Map(Entity.getMany(relIds).map((e) => [e.id, e]));
  const relParentIds = [...new Set([...relById.values()].map((rel) => rel.parent_id).filter((id): id is number => id !== null))];
  const relParentById = new Map(Entity.getMany(relParentIds).map((e) => [e.id, e]));
  const parentIds = [...new Set(walk.map((w) => w.parent_id).filter((id): id is number => id !== null))];
  const parentById = new Map(Entity.getMany(parentIds).map((e) => [e.id, e]));

  const walkIds = walk.map((w) => w.id);
  const combinationIdsById = new Map(
    walkIds.length === 0
      ? []
      : (db.prepare(`SELECT id, combination_ids FROM current_entities WHERE id IN (${walkIds.map(() => '?').join(',')})`).all(...walkIds) as { id: number; combination_ids: string | null }[]).map(
          (r) => [r.id, r.combination_ids] as const
        )
  );
  const accountById = new Map(
    walkIds.length === 0
      ? []
      : (db.prepare(`SELECT entity_id, accountnumber, balance_minor FROM account WHERE entity_id IN (${walkIds.map(() => '?').join(',')})`).all(...walkIds) as {
          entity_id: number;
          accountnumber: string | null;
          balance_minor: number;
        }[]
        ).map((a) => [a.entity_id, a] as const)
  );

  const result: ReportRow[] = [];
  for (const w of walk) {
    if (w.depth < 1) continue;
    const rpt = reportByCategoryId.get(w.categoryId);
    if (!rpt) continue;
    const category = categoryById.get(w.categoryId)!;
    const rel = w.relation_id !== null ? relById.get(w.relation_id) : undefined;
    const relParent = rel && rel.parent_id !== null ? relParentById.get(rel.parent_id) : undefined;
    const relParentIsLedgers = relParent?.name === 'Ledgers';
    const parentE = relParentIsLedgers && w.parent_id !== null ? parentById.get(w.parent_id) : undefined;
    const account = accountById.get(w.id);
    result.push({
      report: rpt.name,
      category: category.name,
      account: parentE?.name ?? w.name,
      account_id: w.id,
      depth: w.depth,
      combination_ids: combinationIdsById.get(w.id) ?? null,
      accountnumber: account?.accountnumber ?? null,
      balance_minor: account?.balance_minor ?? null,
    });
  }
  result.sort((a, b) => a.report.localeCompare(b.report) || a.category.localeCompare(b.category) || a.account.localeCompare(b.account));
  return result;
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
  const id = entityId ?? Entity.get(accountName)?.id;
  if (id == null) throw new ValidationError(`No such account: "${accountName}".`);
  db.prepare(`INSERT INTO account (entity_id) VALUES (?) ON CONFLICT (entity_id) DO NOTHING`).run(id);
  const result = db.prepare(`UPDATE account SET currency = ? WHERE entity_id = ?`).run(currency, id);
  if (result.changes !== 1) throw new ValidationError(`No such account: "${accountName}".`);
}

export function ensureCurrencyAccount(baseAccountId: number, currency: string, userId: UserId): { name: string; id: number } {
  const base = Entity.get(baseAccountId);
  if (!base || base.parent_id === null) throw new ValidationError(`No such account id: ${baseAccountId}.`);
  const currencyAccountName = `${base.name} (${currency})`;
  const existing = Entity.getUnder(currencyAccountName, base.parent_id) ?? Entity.create(currencyAccountName, base.parent_id, userId);
  setAccountCurrency(currencyAccountName, currency, existing.id);
  return { name: currencyAccountName, id: existing.id };
}

export function ensureProfitCenterRetainedEarningsAccount(baseAccountId: number, profitCenterName: string, userId: UserId): { name: string; id: number } {
  const base = Entity.get(baseAccountId);
  if (!base || base.parent_id === null) throw new ValidationError(`No such account id: ${baseAccountId}.`);
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

// Structural plumbing the hierarchy/contact-type link mechanisms create as
// real, named child entities of their own (e.g. "Acme Corp — Contact
// Type: Customer") — never real accounts, excluded from the linked-rows
// walk below the same way this report already only shows real CoA
// leaves, not its own internal wiring.
function isStructuralWiringName(name: string): boolean {
  return name.includes(' — Hierarchy: ') || name.includes(' — Contact Type: ');
}

// Replaces a `WITH RECURSIVE walk ... current_entities` CTE this file used
// to run inline (twice — once per call site below), joined to `account`
// in the same statement: a category-4 site. The tree walk itself (depth +
// " > "-joined path, exactly matching the original SQL's own path-building)
// now happens here via the EntityDriver; only the resulting plain id list
// crosses back into SQL, to read `account.accountnumber`/`balance_minor`
// by id — a plain, non-entity table lookup, not a current_entities join.
// `excludeStructuralWiring` reproduces the second call site's own
// recursive-step filter: a node that fails the check is both excluded AND
// never descended into, same as the original CTE's recursive branch
// (its WHERE clause doesn't apply to the root/base case either way).
function walkChartTree(rootId: number, excludeStructuralWiring: boolean): Omit<ChartRow, 'accountnumber' | 'balance_minor'>[] {
  const root = Entity.get(rootId);
  if (!root) return [];
  const out: Omit<ChartRow, 'accountnumber' | 'balance_minor'>[] = [];
  function recurse(node: EntityNode, depth: number, path: string): void {
    out.push({ id: node.id, name: node.name, depth, path });
    for (const child of Entity.children(node.id)) {
      if (excludeStructuralWiring && isStructuralWiringName(child.name)) continue;
      recurse(child, depth + 1, `${path} > ${child.name}`);
    }
  }
  recurse(root, 0, root.name);
  return out;
}

function withAccountData(nodes: Omit<ChartRow, 'accountnumber' | 'balance_minor'>[]): ChartRow[] {
  if (nodes.length === 0) return [];
  const ids = nodes.map((n) => n.id);
  const accountRows = db
    .prepare(`SELECT entity_id, accountnumber, balance_minor FROM account WHERE entity_id IN (${ids.map(() => '?').join(',')})`)
    .all(...ids) as { entity_id: number; accountnumber: string | null; balance_minor: number }[];
  const accountByEntityId = new Map(accountRows.map((a) => [a.entity_id, a]));
  return nodes.map((n) => {
    const account = accountByEntityId.get(n.id);
    return { ...n, accountnumber: account?.accountnumber ?? null, balance_minor: account?.balance_minor ?? null };
  });
}

export function getChartOfAccounts(business: string): ChartRow[] {
  const rootId = resolveBusinessReportsCoaRootId(business);
  const rows = withAccountData(walkChartTree(rootId, false)).filter((r) => r.depth >= 1);

  const linkedRows: ChartRow[] = [];
  for (const row of rows) {
    for (const childRootName of getHierarchyChildren(row.name, 'Header Account')) {
      const childRoot = Entity.get(childRootName);
      if (!childRoot) continue;
      const descendants = withAccountData(walkChartTree(childRoot.id, true)).filter((r) => r.depth >= 1);
      for (const d of descendants) {
        linkedRows.push({ ...d, depth: row.depth + d.depth, path: `${row.path} > ${d.path}` });
      }
    }
  }

  return [...rows, ...linkedRows].sort((a, b) => a.path.localeCompare(b.path));
}

// Shared business/ledger id resolution — same pattern as db-journal.ts's
// identical local helpers, duplicated here rather than shared across files
// (small, local, per-file helpers, not a new cross-file abstraction).
function resolveBusinessEntityId(business: string): number | undefined {
  return Entity.get(business, 'Businesses')?.id;
}
function resolveLedgerEntityId(business: string, ledger: string): number | undefined {
  const businessId = resolveBusinessEntityId(business);
  if (businessId === undefined) return undefined;
  const ledgersRoot = Entity.getUnder('Ledgers', businessId);
  return ledgersRoot ? Entity.getUnder(ledger, ledgersRoot.id)?.id : undefined;
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

// Both of these replace a `WITH RECURSIVE ... current_entities` CTE this
// file used to run inline — a category-4 join (current_entities joined
// against account/journal in the same statement), so the walk itself now
// happens here via the EntityDriver, and only a plain id list crosses back
// into SQL (`a.entity_id IN (...)`), keeping the financial query itself
// entity-backend-agnostic. `exactly(name)` guards each `findAll` nameSuffix
// lookup down to a true exact match (nameSuffix is `LIKE '%suffix'` under
// the hood, so e.g. a hypothetical "Our Chart of Accounts" would also
// match the suffix — there's no such entity in this domain, but filtering
// exactly in TS costs nothing and removes the possibility outright).
function exactly<T extends { name: string }>(name: string, nodes: T[]): T[] {
  return nodes.filter((n) => n.name === name);
}

// The real, chart-of-accounts subtree(s) — every business has its own
// "Chart of Accounts" root (plus one global template under Application),
// so, matching the original SQL's unscoped `WHERE name = 'Chart of
// Accounts'`, this walks every entity with that exact name, not just one
// business's. A root's own descent stops at (but still includes) any
// entity with a `contact` row — that entity's own sub-ledger detail isn't
// walked further, same as the original CTE's `WHERE NOT EXISTS (SELECT 1
// FROM contact WHERE entity_id = r.id)` guard on the *parent* side of the
// recursive step.
// Exported for getEntityTree (db.ts), which needs the exact same
// contact-stopping real-accounts walk for its own is_postable_account flag.
export function realAccountIds(): Set<number> {
  const roots = exactly('Chart of Accounts', Entity.findAll({ nameSuffix: 'Chart of Accounts' }));
  const contactEntityIds = new Set((db.prepare(`SELECT entity_id FROM contact`).all() as { entity_id: number }[]).map((r) => r.entity_id));
  const ids = new Set<number>();
  function walk(id: number): void {
    if (ids.has(id)) return;
    ids.add(id);
    if (contactEntityIds.has(id)) return;
    for (const child of Entity.children(id)) walk(child.id);
  }
  for (const root of roots) walk(root.id);
  return ids;
}

// The full "Customers"/"Vendors" subtrees — every descendant, unlike
// realAccountIds above, which stops at a contact-bearing node. Matches the
// original CTE's unconditional recursive descent.
function contactAccountIds(): Set<number> {
  const ids = new Set<number>();
  for (const rootName of ['Customers', 'Vendors']) {
    for (const root of exactly(rootName, Entity.findAll({ nameSuffix: rootName }))) {
      for (const node of Entity.descendantsWithDepth(root.id)) ids.add(node.id);
    }
  }
  return ids;
}

export function getLedgerBalancesByHierarchyStructural(
  businessName: BusinessName,
  ledgerName: LedgerName,
  hierarchyPath: string[],
  fromDate?: string,
  toDate?: string,
  excludeCloseEntries = false
): Map<number, Map<string | null, number>> {
  const ledgerId = resolveLedgerEntityId(businessName, ledgerName) ?? -1;
  const accountIds = [...realAccountIds()];
  if (accountIds.length === 0) return new Map();
  const rows = db
    .prepare(
      `SELECT a.entity_id AS id, SUM(jo.amount_minor) AS balance_minor
       FROM account a
       JOIN journal_occurrences jo ON jo.account_id = a.entity_id
       JOIN journal j ON j.id = jo.journal_id
       WHERE jo.ledger_id = ?
         AND (? IS NULL OR jo.transdate >= ?)
         AND (? IS NULL OR jo.transdate <= ?)
         AND (? = 0 OR j.reference NOT LIKE 'CLOSE-%')
         AND a.entity_id IN (${accountIds.map(() => '?').join(',')})
       GROUP BY a.entity_id`
    )
    .all(ledgerId, fromDate ?? null, fromDate ?? null, toDate ?? null, toDate ?? null, excludeCloseEntries ? 1 : 0, ...accountIds) as {
    id: number;
    balance_minor: number;
  }[];
  const nameById = new Map(Entity.getMany(rows.map((r) => r.id)).map((e) => [e.id, e.name]));
  const result = new Map<number, Map<string | null, number>>();
  for (const r of rows) {
    const accountName = nameById.get(r.id);
    const group = accountName !== undefined ? (resolveAccountHierarchyGroup(accountName, hierarchyPath) ?? null) : null;
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
  const ledgerId = resolveLedgerEntityId(businessName, ledgerName) ?? -1;
  const accountIds = [...new Set([...realAccountIds(), ...contactAccountIds()])];
  if (accountIds.length === 0) return new Map();
  const rows = db
    .prepare(
      `SELECT a.entity_id AS id,
              COALESCE(SUM(CASE WHEN jo.ledger_id = ?
                                 AND (? IS NULL OR jo.transdate >= ?)
                                 AND (? IS NULL OR jo.transdate <= ?)
                                 AND (? = 0 OR j.reference NOT LIKE 'CLOSE-%')
                                 THEN jo.amount_minor ELSE 0 END), 0) AS balance_minor
       FROM account a
       LEFT JOIN journal_occurrences jo ON jo.account_id = a.entity_id
       LEFT JOIN journal j ON j.id = jo.journal_id
       WHERE a.entity_id IN (${accountIds.map(() => '?').join(',')})
       GROUP BY a.entity_id`
    )
    .all(ledgerId, fromDate ?? null, fromDate ?? null, toDate ?? null, toDate ?? null, excludeCloseEntries ? 1 : 0, ...accountIds) as {
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
  // Stays raw SQL (category 4): needs e.combination_ids directly, which
  // EntityNode/getMany deliberately don't carry — combination_ids is the
  // one other approved JSON exception, explicitly out of the Entity-driver
  // migration's scope, so this join is the simplest way to get both an
  // account's identity and its combination_ids in one read.
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

  const balanceSheetLedgerId = resolveLedgerEntityId(businessName, ledgerName) ?? -1;
  // Was a `WITH RECURSIVE walk ... current_entities` CTE — a category-4
  // join (current_entities' own id-walk feeding a journal_occurrences
  // filter in the same statement). The walk now happens via the
  // EntityDriver; only the resulting plain id list crosses back into SQL.
  // Unscoped exact-name lookup (possibly several matches, same as the
  // original SQL's unscoped `WHERE name IN (...)`) — see `exactly` above.
  const sumHierarchyDescendants = (headerAccountName: string): number => {
    const hierarchyChildren = getHierarchyChildren(headerAccountName, 'Header Account');
    const startNames = [headerAccountName, ...hierarchyChildren];
    const alreadyCapturedIds = new Set(rows.map((r) => r.account_id));
    const walkIds = new Set<number>();
    for (const name of startNames) {
      for (const root of exactly(name, Entity.findAll({ nameSuffix: name }))) {
        for (const node of Entity.descendantsWithDepth(root.id)) walkIds.add(node.id);
      }
    }
    const targetIds = [...walkIds].filter((id) => !alreadyCapturedIds.has(id));
    if (targetIds.length === 0) return 0;
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(jo.amount_minor), 0) AS total
         FROM journal_occurrences jo
         WHERE jo.account_id IN (${targetIds.map(() => '?').join(',')})
           AND jo.ledger_id = ?
           AND (? IS NULL OR jo.transdate <= ?)`
      )
      .get(...targetIds, balanceSheetLedgerId, asOfDate ?? null, asOfDate ?? null) as { total: number };
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

  const cogsId = Entity.get('COGS')?.id ?? -1;
  const cogsAccountIds = new Set(Entity.findAll({ relationId: cogsId }).map((e) => e.id));
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
  const accountRows = db.prepare(`SELECT entity_id AS id, accountnumber FROM account`).all() as { id: number; accountnumber: string | null }[];
  const accountNames = new Map(Entity.getMany(accountRows.map((r) => r.id)).map((e) => [e.id, e.name] as const));
  // The original INNER JOIN silently dropped any account whose entity_id
  // had no current_entities row; mirrored here rather than defaulting to
  // an empty name.
  const accounts = accountRows
    .filter((r) => accountNames.has(r.id))
    .map((r) => ({ id: r.id, name: accountNames.get(r.id)!, accountnumber: r.accountnumber }));

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
        const retainedEarningsId = Entity.get(retainedEarningsAccount)!.id;
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
  const businessId = Entity.get(business, 'Businesses')?.id;
  if (!businessId) throw new ValidationError(`No real business named "${business}".`);
  const ledgersRootId = Entity.getUnder('Ledgers', businessId)?.id;
  if (!ledgersRootId) throw new ValidationError(`No real "Ledgers" node for "${business}" — this business was not created with the current, real structure.`);
  const newLedgerId = Entity.getUnder(newLedger, ledgersRootId)?.id;
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
  const businessId = resolveBusinessEntityId(business) ?? -1;
  const ledgerId = resolveLedgerEntityId(business, ledger) ?? -1;
  // item_name is resolved below via Entity.getMany, not joined in SQL here
  // (current_entities is a category-4 join site — SQL returns ids only,
  // the driver resolves names, the join happens in TypeScript, so this
  // stays backend-agnostic for entities).
  const rawRows = db
    .prepare(
      `SELECT i.invoice_date, i.reference, l.description,
              l.quantity, l.unit_price_minor, l.amount_minor, l.item_id
       FROM invoice_detail_line l
       JOIN invoice i ON i.id = l.invoice_id
       WHERE i.business_id = ?
         AND i.ledger_id = ?
         AND i.invoice_type = 'AR'
         AND i.document_type = 'invoice'
         AND i.status = 'posted'
         AND (? IS NULL OR i.invoice_date >= ?)
         AND (? IS NULL OR i.invoice_date <= ?)
       ORDER BY i.invoice_date, i.reference, l.line_order`
    )
    .all(businessId, ledgerId, fromDate ?? null, fromDate ?? null, toDate ?? null, toDate ?? null) as (Omit<SalesReportLine, 'item_name'> & { item_id: number | null })[];

  const itemIds = [...new Set(rawRows.map((r) => r.item_id).filter((id): id is number => id !== null))];
  const itemNameById = new Map(Entity.getMany(itemIds).map((e) => [e.id, e.name]));
  const rows: (SalesReportLine & { item_id: number | null })[] = rawRows.map((r) => ({
    ...r,
    item_name: r.item_id !== null ? (itemNameById.get(r.item_id) ?? null) : null,
  }));

  const entities = getEntityTree();
  // Category is a genuinely optional, generic Hierarchy tag here — the
  // exact same `getHierarchyParent` mechanism Division/any other
  // business-defined grouping already uses, never a special, real
  // tree-position lookup. An item with no Category tag at all (the
  // single-item, no-grouping case) genuinely, correctly falls to
  // 'Other' rather than resolving to whatever real entity happens to
  // sit above it in the tree.
  const categoryOf = (itemId: number | null): string => {
    if (!itemId) return 'Other';
    const entity = entities.find((e) => e.id === itemId);
    if (!entity) return 'Other';
    return getHierarchyParent(entity.name, 'Category') ?? 'Other';
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

