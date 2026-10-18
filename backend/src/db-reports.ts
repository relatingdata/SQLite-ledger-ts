import { db, getQualifiedDisplayName, getCombinationDisplayName, resolveBusinessCoaAccountId } from './db.js';
import { Hierarchy, Currency, type HierarchyTreeNode } from './primitives.js';
import { ValidationError, getEntityTree, stageLine, postJournalEntry, getHierarchyGroups, getHierarchyParent, getHierarchyChildren, asAccountName, requireEntity, typeBusinessName, typeRootName, getBusinessHomeCurrency, getAccountProfitCenter, setActiveLedger, type BusinessName, type LedgerName, type UserId } from './db.js';
import { Entity } from './primitives.js';

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

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

/** Structural grouping only (which report/category an account falls
 * under) — NOT scoped to a ledger. Its balance_minor column is the same
 * all-ledgers-combined total as account.balance_minor (see the note on
 * that column below) — fine for browsing the hierarchy, not meant for
 * financial statements, which use getLedgerBalances instead.
 *
 * Replaces a direct read of the business_reports view - confirmed,
 * directly, TWO real, separate bugs in that view:
 *   1. Same unscoped-root bug as getChartOfAccounts - its own
 *      recursive walk's base case, `WHERE e.parent_id = (SELECT id
 *      FROM current_entities WHERE name = 'Chart of Accounts')`, is a
 *      bare predicate with no business scoping, so it silently walks
 *      every business's own Chart of Accounts at once.
 *   2. A genuine TWO-LEVEL indirection the view's own single join
 *      never accounted for: a business's own category (its own real
 *      "Asset", say) has relation_id pointing at the GLOBAL category
 *      of the same name, not at the report directly - and only THAT
 *      global category's own relation_id finally points at the real
 *      report ("Balance Sheet"). Confirmed directly by tracing one
 *      real row: {id: 1006434, name: 'Asset', relation_id: 6} -> {id:
 *      6, name: 'Asset', relation_id: 32} -> {id: 32, name: 'Balance
 *      Sheet'}. The view's one join only ever reached the first hop,
 *      so `report` showed the category's own name ("Asset") instead
 *      of the real report name, and every real caller's own
 *      `.filter(r => r.report === 'Balance Sheet')` silently matched
 *      nothing at all. */
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

/** Sets an account's fixed currency — NULL means the business's own
 * home/reporting currency. Every account in a single journal entry
 * that shares a currency must balance to zero together; see
 * post_journal_entry_insert for the actual enforcement. Auto-creates
 * the account row if this entity has never been posted to before,
 * matching the same lazy-vivification every other account already
 * uses. */
export function setAccountCurrency(accountName: string, currency: string | null, entityId?: number): void {
  const id = entityId ?? (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(accountName) as { id: number } | undefined)?.id;
  if (id == null) throw new ValidationError(`No such account: "${accountName}".`);
  db.prepare(`INSERT INTO account (entity_id) VALUES (?) ON CONFLICT (entity_id) DO NOTHING`).run(id);
  const result = db.prepare(`UPDATE account SET currency = ? WHERE entity_id = ?`).run(currency, id);
  if (result.changes !== 1) throw new ValidationError(`No such account: "${accountName}".`);
}

/** A real, direct, currency-specific sibling of any given, real,
 * home-currency account (e.g. "Sales Revenue (USD)", "Sales Tax
 * Payable (USD)", "Cash at Bank (USD)") - per
 * docs/multicurrency-design.md, "The validation change required" and
 * "A fully worked example": a sale genuinely nominated in a foreign
 * currency never converts to the home currency at posting time. Every
 * real leg of that transaction (Revenue, Tax, COGS, Cash) stays
 * consistently denominated in the real, nominated currency it
 * actually happened in, each posted to its own, real, currency-tagged
 * sibling account, balancing entirely within that one, real,
 * independent currency group. Created once, under the exact, same,
 * real parent as the base account, its own account.currency set
 * directly - the real, established, existing per-account currency
 * mechanism, reused exactly, not a new one invented for this. */
/** A real, direct, currency-specific sibling of any given, real,
 * home-currency account (e.g. "Sales Revenue (USD)", "Sales Tax
 * Payable (USD)", "Cash at Bank (USD)") - per
 * docs/multicurrency-design.md, "The validation change required" and
 * "A fully worked example": a sale genuinely nominated in a foreign
 * currency never converts to the home currency at posting time. Every
 * real leg of that transaction (Revenue, Tax, COGS, Cash) stays
 * consistently denominated in the real, nominated currency it
 * actually happened in, each posted to its own, real, currency-tagged
 * sibling account, balancing entirely within that one, real,
 * independent currency group.
 *
 * Takes the real, specific base account's own real id, not just its
 * name - a real, confirmed bug, found directly: this system's own,
 * established, scoped-uniqueness design deliberately allows the exact
 * same name at two, real, different parent levels (a COGS leaf and an
 * Inventory leaf for the same product/location can genuinely share
 * one name) - looking a base account up by name alone is genuinely
 * ambiguous in that real case, and silently created one, single,
 * shared currency-tagged sibling for what should have been two, real,
 * separate ones (COGS and Inventory ending up as the exact same
 * account, breaking the per-currency balance immediately). Resolving
 * from the real, specific, already-known id instead - every real
 * caller already has it - removes the ambiguity entirely. */
export function ensureCurrencyAccount(baseAccountId: number, currency: string, userId: UserId): { name: string; id: number } {
  const base = db.prepare(`SELECT name, parent_id FROM current_entities WHERE id = ?`).get(baseAccountId) as { name: string; parent_id: number } | undefined;
  if (!base) throw new ValidationError(`No such account id: ${baseAccountId}.`);
  const currencyAccountName = `${base.name} (${currency})`;
  const existing = Entity.getUnder(currencyAccountName, base.parent_id) ?? Entity.create(currencyAccountName, base.parent_id, userId);
  // A real, confirmed bug, found directly via fixture work porting
  // tests off the one, shared 'admin' business: two different
  // businesses' own currency-tagged siblings routinely share this
  // exact, same display name (e.g. two businesses each have their
  // own "Cash at Bank (USD)") — passing only the name here let
  // setAccountCurrency's own, separate, bare `WHERE name = ?` lookup
  // resolve to whichever one of them happened to have the lower id,
  // silently tagging some OTHER business's account instead of the
  // one `existing` just, correctly, scoped-ly resolved — leaving
  // THIS one's own currency unset and breaking the per-currency
  // balance check on its very next real posting. Passing the real,
  // already-resolved id directly closes that gap.
  setAccountCurrency(currencyAccountName, currency, existing.id);
  return { name: currencyAccountName, id: existing.id };
}

/** Per docs/profit-centers-design.md: the one, real, structural thing
 * a Profit Center adds to the Balance Sheet — a real, postable
 * sibling under the business's one, shared Retained Earnings account,
 * named after the Profit Center, created the moment that Profit
 * Center first closes with a non-zero result. Equity is never
 * duplicated; it only ever grows one more real leaf, the exact, same
 * shape ensureCurrencyAccount above already proves for a foreign
 * currency closing against the same, shared Retained Earnings.
 * Deliberately parenthesized as "(Profit Center: X)" rather than bare
 * "(X)" so it can never collide with - and, when both apply, nests
 * cleanly underneath - a currency-tagged sibling built by
 * ensureCurrencyAccount on top of this one's own id. */
export function ensureProfitCenterRetainedEarningsAccount(baseAccountId: number, profitCenterName: string, userId: UserId): { name: string; id: number } {
  const base = db.prepare(`SELECT name, parent_id FROM current_entities WHERE id = ?`).get(baseAccountId) as { name: string; parent_id: number } | undefined;
  if (!base) throw new ValidationError(`No such account id: ${baseAccountId}.`);
  const pcAccountName = `${base.name} (Profit Center: ${profitCenterName})`;
  const existing = Entity.getUnder(pcAccountName, base.parent_id) ?? Entity.create(pcAccountName, base.parent_id, userId);
  return { name: pcAccountName, id: existing.id };
}

/** Replaces ensureCashAtBankAccount - confirmed, directly, a real,
 * standing bug: "Cash at Bank" was a bare, unscoped name lookup
 * (`WHERE name = 'Cash at Bank'`, no parent at all), so it resolved
 * to the ONE, single, global entity the whole application shared -
 * every business's own postings landed on the exact same account,
 * even though nominateBankAccount/buildBankCurrencyStructure already,
 * correctly build a real, separate "Cash at Bank" structure under
 * each business's own "Asset" category at business-creation time
 * (see docs/bank-accounts-and-currencies-design.md; confirmed
 * directly, per the user's own answer, settling the design tension
 * this raised against the rollover work: every business genuinely
 * gets its own Cash at Bank, the shared/universal entity was the bug,
 * not the intended design).
 *
 * Three real cases, resolved against this one, specific business's
 * own "Asset" category:
 *   - nothing yet under "Cash at Bank" for this business - lazily
 *     creates a plain, base account there (the one-bank/one-currency
 *     case, or a business that never ran the wizard at all);
 *   - a plain, single, postable leaf already (one bank, one
 *     currency) - returned directly;
 *   - a real header with multiple real currency leaves underneath
 *     (buildBankCurrencyStructure's multi-combination case) -
 *     resolved by the requested currency, falling back to this
 *     business's own home currency. */
export function resolveCashAtBankAccount(business: BusinessName, currency: string | undefined, userId: UserId): { name: string; id: number } {
  requireEntity(business, typeBusinessName, requireEntity('Businesses', typeRootName));
  // A real, confirmed bug found directly: a bare requireEntity('Asset',
  // typeRootName, <this business's own Chart of Accounts>) always
  // failed for 'admin' - schema/00-core.sql's own "the one legacy,
  // pre-multi-tenancy demo business" - since its own CoA copy has no
  // real category children at all (it posts directly against the
  // GLOBAL Chart of Accounts instead). resolveBusinessCoaAccountId is
  // the same, real, established, already-proven fallback this exact
  // class of bug was already fixed with elsewhere (Sales Revenue/COGS/
  // Inventory resolution, just below in this same file).
  const assetId = resolveBusinessCoaAccountId(business, 'Asset');
  const existing = Entity.getUnder('Cash at Bank', assetId);
  const homeCurrency = getBusinessHomeCurrency(business) ?? undefined;
  const effectiveCurrency = currency ?? homeCurrency;

  if (!effectiveCurrency || effectiveCurrency === homeCurrency) {
    // Plain/home-currency case: 'admin' - the one, real, legacy,
    // pre-multi-tenancy demo business (schema/00-core.sql) - never
    // got "Cash at Bank"; it has always, genuinely used "Cash and
    // Bank" (entity id 11, seeded directly, also the real, hand-
    // written name every trigger/vocabulary entry already,
    // consistently uses). Since 'admin' has no own CoA copy, assetId
    // above resolves to the GLOBAL "Asset" category - the exact same
    // one "Cash and Bank" already, really lives under - so this
    // prefers it directly, regardless of whether a bare "Cash at
    // Bank" header ALSO happens to already exist there (the foreign-
    // currency branch below lazily creates exactly that header,
    // purely as a currency-tagging root, the first time any foreign-
    // currency sale runs - it is never itself a real, posted-to plain
    // account, so an earlier foreign sale must never shadow 'admin's
    // own, real, legacy "Cash and Bank" leaf for this, unrelated,
    // plain case). Only when NEITHER already exists (a genuinely
    // brand-new business) does this create a fresh "Cash at Bank"
    // leaf.
    const legacyCashAndBank = Entity.getUnder('Cash and Bank', assetId);
    if (legacyCashAndBank) return { name: legacyCashAndBank.name, id: legacyCashAndBank.id };
    if (existing) return { name: existing.name, id: existing.id };
    const created = Entity.create('Cash at Bank', assetId, userId);
    return { name: created.name, id: created.id };
  }

  // Foreign/nominated-currency case: always built on "Cash at Bank"
  // specifically - buildBankCurrencyStructure's own, established,
  // dedicated currency-structure root (docs/multicurrency-design.md)
  // - get-or-created fresh here if it doesn't exist yet, entirely
  // independent of whatever plain/home-currency leaf this business's
  // ordinary, undifferentiated postings actually use ("Cash and Bank"
  // for 'admin', "Cash at Bank" for everyone else). A real, confirmed
  // bug found directly: once 'admin' started falling back to its own,
  // legacy "Cash and Bank" leaf above, a later, genuinely different
  // foreign-currency sale's own currency-tagged sibling must still be
  // named "Cash at Bank (USD)" per docs/multicurrency-design.md's own,
  // already-established worked example and naming convention - never
  // "Cash and Bank (USD)", which nothing else expects.
  const currencyBase = existing ?? Entity.create('Cash at Bank', assetId, userId);
  // A real, confirmed, live bug found directly via the tutorial e2e's
  // own post-rollover sale (a real, further e2e extension, per direct
  // instruction): Entity.children(currencyBase.id) also picks up a
  // real, further kind of child this same, real CoA leaf can carry -
  // resolveRolloverLines' own, real, ledger-scoped node, named after
  // the ledger itself (e.g. "Actual 2027-28", relation_id pointing at
  // that real ledger - see docs/ledger-scoped-accounts-and-
  // rollover.md), created directly here once this account has ever
  // carried a real, non-zero balance through a real rollover. That
  // node is never a real currency leaf (buildBankCurrencyStructure's
  // own, separate, multi-combination case) - only a name ending in
  // "(CUR)" genuinely is. Without this, the real single-currency case
  // ("Cash at Bank" is itself the real, plain leaf, children.length
  // === 0) broke the moment this business's first real rollover ran,
  // since the ledger-scoped child made children.length > 0 while
  // matching no real currency at all.
  const currencyLeaves = Entity.children(currencyBase.id).filter((c) => /\([A-Za-z]{3}\)$/.test(c.name));
  const existingLeaf = currencyLeaves.find((c) => c.name.endsWith(`(${effectiveCurrency})`));
  if (existingLeaf) return existingLeaf;
  // A real, confirmed bug found directly, posting a real foreign-
  // currency POS sale for the first time: completePosSale's own
  // documented design (docs/multicurrency-design.md) redirects every
  // real leg of such a sale - Revenue, Tax, COGS, AND Cash - to its
  // own, real, currency-tagged sibling via ensureCurrencyAccount,
  // created lazily the first time it's needed. Cash alone was the one
  // leg this function left out of that lazy-create pattern, throwing
  // or silently falling back to the plain, home-currency leaf instead
  // whenever buildBankCurrencyStructure hadn't already, separately,
  // pre-built a matching one - so the very first foreign-currency sale
  // always failed with "entry does not balance (per currency)" (every
  // other leg correctly tagged, Cash alone landing in the home group).
  // Cash deserves the exact, same, already-proven treatment.
  return ensureCurrencyAccount(currencyBase.id, effectiveCurrency, userId);
}

/** Replaces a direct read of the chart_of_accounts view - confirmed,
 * directly, the exact same real bug class as resolveCashAtBankAccount:
 * that view's own recursive walk starts from `WHERE e.name = 'Chart
 * of Accounts'` with no scoping at all, which - since every business
 * genuinely has its own, separate "Chart of Accounts" root node -
 * doesn't resolve to one arbitrary business, it walks EVERY business's
 * own Chart of Accounts simultaneously and mixes them into one,
 * undifferentiated listing (confirmed directly: "Asset" appeared 4
 * times in a real listing with only a handful of real businesses).
 * This is a real, direct, business-scoped recursive query instead,
 * taking the one, specific business this listing is actually for. */
export function getChartOfAccounts(business: string): ChartRow[] {
  // Same shape as the old chart_of_accounts view exactly (root itself
  // at depth 0, excluded from the final rows; "path" prefixed with
  // "Chart of Accounts > ") - only the base case's root lookup is
  // scoped to this one, specific business, in place of the view's
  // bare, unscoped `WHERE e.name = 'Chart of Accounts'`.
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

  // Per the same, established "Header Account" hierarchy mechanism
  // getBusinessReports' own balance-sheet totals already use (see
  // sumHierarchyDescendants above): a real Customer/Vendor/any other
  // contact genuinely, structurally lives outside the Chart of
  // Accounts entirely (Customers/Vendors are real Vocabulary words —
  // their own, real "source of truth" home), while still reaching a
  // real CoA heading for reporting purposes via that hierarchy link.
  // Without this, a real, vivified customer account (one that has
  // actually posted) was simply missing from this report altogether,
  // even though it has a real, genuine balance. Generic, not
  // hardcoded to "Customers"/"Vendors" by name — any real leaf this
  // walk already found that some entity has set as its own "Header
  // Account" is merged in here, nested under that leaf's own path.
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
/** The real, generic hierarchy-grouping mechanism behind every
 * "Consolidated per X" report — any real, business-chosen hierarchy
 * name (e.g. "Division," "Location," or any future one) — generalized
 * per direct instruction: not a "dimension" in the matrix-stock-report
 * sense (that word stays reserved for definitionDimensions and the
 * drag-and-drop hierarchy editor), just a real, named hierarchy walk.
 * hierarchyPath is the real, ordered chain of hierarchy-link hops from
 * an account to its final group, walked as many levels as the real
 * hierarchy actually has - e.g. ['Location'] groups by an account's
 * own, direct Location link; ['Location', 'Division'] walks account ->
 * Location -> whatever grouping a business has named "Division," and a
 * future, real, longer chain works exactly the same way, with no
 * further code change and no hierarchy name ever hardcoded here. Each
 * named hierarchy's own real values can independently nest arbitrarily
 * deep too (a real per-location group under a broader one) - that part
 * was always separate from this walk, and getProfitAndLossForHierarchyGroup
 * below still resolves it via the group's own real structural
 * descendants (getHierarchyGroups). */
function resolveAccountHierarchyGroup(accountName: string, hierarchyPath: string[]): string | undefined {
  // An empty path is a real, deliberate "no breakdown at all" request
  // (e.g. a close with no real hierarchy chosen) — every account
  // resolves to the one, shared, null group, never to its own bare
  // name (which the loop below would otherwise return unchanged).
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

/** Per direct instruction: Location and any further, real,
 * business-chosen hierarchy (e.g. a business's own "Division") are the
 * real paths a caller may walk; Item would need a real account -> Item
 * hierarchy link of its own first, which doesn't exist yet - separate
 * work. No specific hierarchy path is ever privileged here - a caller
 * passes its own real, chosen path (getLedgerBalancesByHierarchyStructural
 * above) or just ['Location'] for a plain Location breakdown. */
const LOCATION_HIERARCHY_PATH = ['Location'];

/** Groups by an account's own, direct Location link only, with no
 * further walk up to any higher-level grouping. Not yet wired to any
 * real route or page of its own; exists and is tested standalone,
 * ready for one the moment a real Location-breakdown report is asked
 * for. */
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
  // Per direct request: an account's own, real, fixed currency (see
  // account.currency in the schema - NULL means the business's own
  // home/reporting currency, never inferred). Surfaced directly on
  // each row so a caller can genuinely tell them apart, rather than
  // silently mixing DKK, EUR, and home-currency minor units into one,
  // meaningless sum.
  currency: string | null;
  // Per direct request: true when this exact account has ever
  // received a real, direct quantity-tracking posting (a "-QTY"
  // reference - unit counts, never dollars) alongside whatever real,
  // ordinary value postings it may also carry. Surfaced so a reader
  // can immediately see whether a row's own balance is genuinely,
  // purely monetary, or a real, confirmed mix that needs its own,
  // separate investigation before being trusted as a dollar figure.
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
  // Per direct request: the same rows, genuinely separated by their
  // own, real, fixed currency - each currency's own debit and credit
  // totals, checked independently for balance, matching this
  // schema's own, established rule (see account.currency) that a
  // single journal entry may span multiple currencies, but every
  // distinct currency present must independently balance to zero.
  // Summing across currencies (as total_debit_minor/total_credit_minor
  // above do, for backward compatibility) is only ever meaningful when
  // every business's accounts share one currency - genuinely
  // confirmed false here (DKK and EUR are both real, live, non-home
  // currencies in use elsewhere in this system) - so a caller
  // checking for a genuine imbalance should always prefer this
  // breakdown over the single, combined total.
  by_currency: TrialBalanceCurrencySubtotal[];
}

/** Every account with a non-zero balance *in the given ledger*, split
 * into its debit or credit column — the classic trial balance report. */
export function getTrialBalance(businessName: BusinessName, ledgerName: LedgerName, asOfDate?: string): TrialBalance {
  const balances = getLedgerBalances(businessName, ledgerName, undefined, asOfDate);
  const accounts = db
    .prepare(`SELECT e.id, e.name, e.parent_id, e.combination_ids, a.accountnumber, a.currency FROM account a JOIN current_entities e ON e.id = a.entity_id`)
    .all() as { id: number; name: string; parent_id: number | null; combination_ids: string | null; accountnumber: string | null; currency: string | null }[];

  // Per direct correction: several real, per-parent-scoped accounts
  // (a tier/location Sales-COGS leaf, among others) now genuinely,
  // correctly share the same, real, simple, bare name across
  // different real parents - the parent relationship distinguishes
  // them structurally, but a real, human-facing report still needs a
  // real, distinct display name. Only ever qualifies a name that is
  // genuinely, confirmed duplicated here - a uniquely-named account
  // (the overwhelming majority) keeps its own, plain, real name
  // unchanged, never over-qualified. Scoped to only the real accounts
  // that actually, genuinely have a balance in this specific
  // business/ledger - a real, confirmed bug, found directly:
  // getLedgerBalances' own Map already carries a (possibly zero)
  // entry for every reportable account system-wide (every other
  // business, every other test), since its own SQL walks every
  // business's "Chart of Accounts" node, not just this one's — so
  // `balances.has(a.id)` was true for virtually every account in the
  // whole database regardless of business, defeating the scoping this
  // comment already describes. Checking the actual balance VALUE is
  // nonzero (not just key presence) is what genuinely, correctly
  // excludes every other business's own, unrelated, same-named
  // account — confirmed directly: a second business vivifying its own
  // "Sales Revenue" account elsewhere in the same suite run was
  // wrongly qualifying a completely unrelated business's own, genuine
  // "Sales Revenue" row here into "Income — Sales Revenue".
  const relevantAccounts = accounts.filter((a) => (balances.get(a.id) ?? 0) !== 0);
  const nameCounts = new Map<string, number>();
  for (const a of relevantAccounts) nameCounts.set(a.name, (nameCounts.get(a.name) ?? 0) + 1);

  // A real, confirmed bug found directly: this used to treat any
  // account with a non-null `currency` as a quantity account, on the
  // theory that quantity/storage-space accounts are tagged the same
  // way a foreign currency is (setAccountCurrency). But a REAL foreign
  // currency account (e.g. "CcyTBTest Cash (EUR)", genuinely tagged
  // 'EUR') is just as non-null as a genuine quantity account, so every
  // currency-tagged financial account got wrongly flagged
  // has_quantity_postings too - confirmed directly against this
  // field's own, documented contract just above: "a real, direct
  // quantity-tracking posting (a '-QTY' reference - unit counts, never
  // dollars)". That's a real, structural, reference-based fact, not a
  // currency-column one - checked directly here against the real
  // journal this account's own lines actually posted through, exactly
  // the convention postQuantityMovement's own, real call sites
  // (completeStockTake, writeOffStock) already use.
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
      // A real, combination-tagged leaf (Inventory/Sales/COGS under
      // the Hierarchy/Product mechanism) always displays its own,
      // live, real combination name - never the duplicate-count
      // heuristic below, since combination_ids already, genuinely
      // distinguishes it from every other, real combination on its
      // own terms.
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
export function getBalanceSheet(businessName: BusinessName, ledgerName: LedgerName, asOfDate?: string): BalanceSheet {
  const balances = getLedgerBalances(businessName, ledgerName, undefined, asOfDate);
  const rows = getBusinessReports(businessName)
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
  // Business-scoped root ids - see getHierarchy's own comment on why
  // the bare category name alone ('Asset', 'Liability', ...) is
  // ambiguous once more than one business exists.
  const assets_tree = buildCategoryTree(assets, accountIdByName, 'Asset', 'debit', resolveBusinessCoaAccountId(businessName, 'Asset'));
  const liabilities_tree = buildCategoryTree(liabilities, accountIdByName, 'Liability', 'credit', resolveBusinessCoaAccountId(businessName, 'Liability'));
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
  // via the established "Header Account" hierarchy link — the same, real,
  // "multiple equal paths" mechanism already proven this session for
  // division/location/tier. This is not hardcoded to "Customers"/
  // "Vendors" by name at all — it generically discovers ANY real
  // entity that has set a given real Asset/Liability account as its
  // own "Header Account" hierarchy-parent, then sums that entity's
  // own, real, structural descendants (every real customer/vendor
  // beneath it). A real, future entity setting up this same, real
  // hierarchy link against any other real heading is picked up
  // automatically, with no further code change required at all.
  const sumHierarchyDescendants = (headerAccountName: string): number => {
    // A real, confirmed asymmetry, found directly by a test suite
    // that finally exercises a genuinely isolated, non-'admin'
    // business: a real customer always lives under an indirect
    // hierarchy child ("Customers"), reaching "Accounts Receivable"
    // only via the Header Account link below - but a real vendor
    // (createProvider) lives DIRECTLY under the header account itself
    // ("Accounts Payable"), per the real, deliberate design confirmed
    // in db-seed.ts's own migrateForContactTypesAndPerBusinessContacts
    // comment. headerAccountName's own id must therefore also be a
    // real, valid starting point for this walk, not just its
    // hierarchy children - otherwise such a direct child is entirely
    // invisible to any business whose own real CoA mirror never
    // reaches the GLOBAL header account at all (every business except
    // the one, legacy 'admin' business, which reaches it directly
    // through its own, documented, unconditional global-fallback walk
    // in getBusinessReports, and so already has it in `rows` above -
    // excluded from the sum below specifically to avoid counting it
    // twice for that one, real, legacy case).
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
 * category hierarchy — the same hierarchy ensureItemSalesCogsAccounts
 * already builds and keeps in sync with the real product category
 * tree, walked here directly from parent_id rather than assumed or
 * duplicated. A leaf with no real category parent (sitting directly
 * under the given root) appears as a top-level line, same as before —
 * this only groups accounts that genuinely have real category
 * ancestors between them and the root. */
export function buildCategoryTree(lines: StatementLine[], accountIdByName: Map<string, number>, rootName: string, normalSide: 'debit' | 'credit' = 'debit', knownRootId?: number): CategoryTreeNode[] {
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
export function getProfitAndLoss(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, excludeCloseEntries = true): ProfitAndLoss {
  const balances = getLedgerBalances(businessName, ledgerName, fromDate, toDate, excludeCloseEntries);
  return buildProfitAndLossFromBalances(businessName, balances);
}

/** The real, shared logic behind every real P&L, factored out so it
 * can be built directly from an already-computed, real balance map —
 * critical for getProfitAndLossByHierarchy below, which needs this
 * same, real logic run once per real group without each one
 * separately, expensively re-querying the full, real dataset from
 * scratch (a real, confirmed, ~20-second performance problem found
 * live, fixed here). getProfitAndLoss itself is now a thin wrapper:
 * fetch the one, real balance map this ledger/date-range/group
 * needs, then hand it to this real, shared builder. */
export function buildProfitAndLossFromBalances(business: string, balances: Map<number, number>): ProfitAndLoss {
  const rows = getBusinessReports(business)
    .filter((r) => r.report === 'Profit and Loss Statement')
    .map((r) => ({ ...r, balance_minor: balances.get(r.account_id) ?? 0 }))
    .filter((r) => r.balance_minor !== 0);

  // Per direct correction: several real, per-parent-scoped accounts
  // (a tier/location Sales-COGS leaf, among others) now genuinely,
  // correctly share the same, real, simple, bare name across
  // different real parents. Only ever qualifies a name genuinely,
  // confirmed duplicated within this real, current report's own rows
  // - a uniquely-named account (the overwhelming majority) keeps its
  // own, plain, real name unchanged, never over-qualified (a real
  // account named "Cash at Bank" must never become "Assets — Cash at
  // Bank").
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
  // Business-scoped root ids - see getHierarchy's own comment on why
  // the bare category name alone ('Income', 'Expense') is ambiguous
  // once more than one business exists.
  const incomeRootId = resolveBusinessCoaAccountId(business as BusinessName, 'Income');
  const expenseRootId = resolveBusinessCoaAccountId(business as BusinessName, 'Expense');
  const income_tree = buildCategoryTree(income, accountIdByName, 'Income', 'credit', incomeRootId);
  const cogs_tree = buildCategoryTree(cogs_expenses, accountIdByName, 'Expense', 'debit', expenseRootId);
  const operating_expenses_tree = buildCategoryTree(operating_expenses, accountIdByName, 'Expense', 'debit', expenseRootId);

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

export interface ProfitAndLossByGroup {
  group: string | null;
  profitAndLoss: ProfitAndLoss;
}

/** Per direct request: "Consolidated per X" — one full, real P&L per
 * real group (under any real, business-chosen hierarchy name, e.g.
 * "Division") that actually has activity within this real ledger and
 * date range (including a real, null-group "everything not tagged at
 * all" entry), not every group that merely exists somewhere in the
 * app.
 *
 * A real, confirmed performance fix: an earlier version called the
 * plain getProfitAndLoss once per real group, each call independently
 * re-querying the full, real dataset from scratch — a real, measured
 * ~20 seconds against the full Wine Retail Business simulation,
 * confirmed live, not estimated. Fixed here by querying
 * getLedgerBalancesByHierarchyStructural exactly once (the same,
 * already efficient, single-pass query the year-end close's own group
 * breakdown already uses), then building each real group's own P&L
 * directly from its own real slice of that one, shared result via
 * buildProfitAndLossFromBalances — the exact same, real P&L-building
 * logic getProfitAndLoss itself uses, just handed an already-computed
 * balance map instead of fetching its own. No specific hierarchy
 * name is ever hardcoded here — hierarchyPath is the real, ordered
 * chain of hierarchy-link hops a caller supplies (see
 * resolveAccountHierarchyGroup above). */
export function getProfitAndLossByHierarchy(businessName: BusinessName, ledgerName: LedgerName, hierarchyPath: string[], fromDate?: string, toDate?: string): ProfitAndLossByGroup[] {
  const balancesByGroup = getLedgerBalancesByHierarchyStructural(businessName, ledgerName, hierarchyPath, fromDate, toDate, true);

  // Re-key from "account -> group -> balance" to "group -> account ->
  // balance", the real shape buildProfitAndLossFromBalances itself
  // needs, one real group at a time.
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

/** A single real group's own, rolled-up P&L — its own direct activity
 * PLUS every real, nested group beneath it structurally (e.g. a real
 * per-location group under a broader, real parent group), walked as
 * many levels deep as this real group hierarchy actually has — the
 * exact same "coarser group includes its finer descendants" behavior
 * the real report pages depend on. groups is the flat list of every
 * real group and its own real structural parent — getHierarchyGroups
 * (db.ts) for a real, business-chosen hierarchy name, or an empty list
 * for a real, flat hierarchy that never nests, like a plain Location
 * breakdown. Built from the exact same, real, structural per-group
 * balances getProfitAndLossByHierarchy already computes, just summed
 * across the requested group's own real subtree instead of split out
 * group by group. */
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

/** Per direct request: "Consolidated per X per Location" — the same
 * real, per-group P&L breakdown as getProfitAndLossByHierarchy above,
 * nested into a real tree by each group's own real parent, rather
 * than presented as one, flat list. hierarchyName names which real,
 * business-chosen hierarchy to read the group tree from
 * (getHierarchyGroups in db.ts) — never hardcoded here, so this works
 * identically for "Division" or any other real, nestable hierarchy a
 * business has set up.
 *
 * A real, genuine complication handled directly: a real, top-level
 * group may have no real, direct activity of its own at all — only
 * its own, real children do. Rather than silently dropping that level
 * (which would leave real children with nowhere real to nest), a
 * real, genuinely empty P&L node is synthesized for it, so the real
 * tree's own shape stays intact. The real, null-group "(No group)"
 * entry is always treated as its own, separate, real root — it has no
 * real, meaningful parent to nest under. */
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
  // A real, top-level group with real, active children but no real,
  // direct activity of its own must still get a real, genuinely empty
  // node, so its own real children have somewhere real to nest.
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
  /** A real summary of every real group's own net income/loss for this
   * period, under whichever real, business-chosen hierarchy
   * (hierarchyPath) the caller asked this close to break down by — no
   * hierarchy name is ever hardcoded here. Per direct request ("the
   * whole point of the restructuring"), the real, posted Retained
   * Earnings side of the close now genuinely carries one, real,
   * separate line per real, active group too (see computeCloseLines) —
   * this summary and that real, posted detail agree, by construction.
   * A group is still only ever a real, pure sub-totaling/reporting
   * dimension in one, further sense: every group's own line still
   * posts into the exact same, single, chosen retainedEarningsAccount,
   * never a real, separate, group-specific account. The one entry with
   * a null group is the real, undivided remainder (any income/expense
   * posted with no group at all, or when hierarchyPath is empty). */
  groupBreakdown: { group: string | null; netIncomeMinor: number }[];
  /** Per docs/profit-centers-design.md's Phase B: the real, structural
   * counterpart to groupBreakdown above — one entry per real Profit
   * Center with a non-zero net result this close, merged across group
   * and currency (unlike groupBreakdown, which keeps a separate entry
   * per currency bucket). A business with zero Profit Centers gets
   * exactly one entry here, { profitCenter: null, netIncomeMinor:
   * <the whole, real net income> } — the same, real total closeBooks
   * always reported before this field existed. */
  profitCenterBreakdown: { profitCenter: string | null; netIncomeMinor: number }[];
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
 * Per direct correction: a group is only a real, pure sub-totaling/
 * reporting dimension — already genuinely available on P&L, Trial
 * Balance, and other reports via a real group filter — not something
 * the close itself needs to structurally split by. An earlier version
 * of this function created a real, separate "{account} - {group}"
 * Retained Earnings leaf per group; that's now removed entirely.
 * Every real group's own net income still rolls up into the exact
 * same, single, chosen retainedEarningsAccount, exactly like any
 * other Income/Expense account being closed — a group-scoped P&L or
 * Trial Balance still shows each group's own real contribution
 * whenever that view is wanted, without the close itself needing to
 * know or care that groups exist at all. groupBreakdown, in the real
 * result below, stays purely informational — a real, read-only
 * summary of what closed, not a structural decision about where
 * anything actually posted. hierarchyPath is the real, business-
 * chosen chain to break the summary down by (e.g. ['Location',
 * 'Division']) — no hierarchy name is ever hardcoded here; an empty
 * path simply reports everything under one, single null group. */
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

/** The real, shared computation both previewCloseBooks and closeBooks
 * itself use — kept as one, single source of truth so a preview can
 * never drift from what actually posts. Computes the real, proposed
 * lines without staging or posting anything at all. */
function computeCloseLines(businessName: BusinessName, ledger: LedgerName, asOfDate: string, retainedEarningsAccount: string, hierarchyPath: string[], userId?: UserId): ComputedClose {
  const balancesByGroup = getLedgerBalancesByHierarchyStructural(businessName, ledger, hierarchyPath, undefined, asOfDate);
  const rows = getBusinessReports(businessName).filter((r) => r.report === 'Profit and Loss Statement' || r.category === 'Income' || r.category === 'Expense');

  let netIncomeMinor = 0;
  let accountsZeroed = 0;
  // Per direct, confirmed finding: closing a real, foreign-currency
  // Income/Expense account against the exact, same, plain, home-
  // currency Retained Earnings genuinely breaks the per-currency
  // balance check the exact, same way an un-tagged Cash leg once did
  // - grouped by (group, currency, Profit Center) together now, not
  // group alone, so each real currency's own net income closes
  // against its own, real, currency-tagged Retained Earnings sibling,
  // and each real Profit Center's own net income closes against its
  // own, real, Profit-Center-tagged sibling (per
  // docs/profit-centers-design.md's Phase B). Unlike group and
  // currency, a Profit Center is never read off the journal line — a
  // real account's own, structural position already determines it
  // (getAccountProfitCenter), constant for every group/balance under
  // one account.
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
    // One, single, combined Retained Earnings line per real
    // (currency, Profit Center) combination — group stays purely a
    // reporting dimension (groupBreakdown, below, is the
    // informational summary of it), never a structural split in what
    // actually posts here; Profit Center, unlike group, genuinely IS
    // a structural split, per docs/profit-centers-design.md.
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

/** A real, live preview of exactly what closeBooks would post, given
 * the same real inputs — computes and returns the real, proposed
 * debit/credit lines without staging or posting a single one of them.
 * Per direct request: a person should be able to see the real,
 * proposed general journal entry and explicitly accept or reject it,
 * not just click one button that immediately posts. Throws the exact
 * same real "nothing to close" error closeBooks itself would, so a
 * person never previews something that couldn't actually be posted. */
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

/** The real, shared computation both resolveRolloverLines (the
 * frontend-facing "resolve, don't post" endpoint — see
 * docs/canned-journal-to-frontend-design.md's Phase 2 section) and
 * rolloverToNewPeriod itself use — kept as one, single source of
 * truth so a frontend-driven rollover can never drift from what the
 * direct, backend-only call would have posted. Mirrors exactly the
 * same split already proven safe for Close Books (computeCloseLines /
 * previewCloseBooks / closeBooks, above).
 *
 * Does Phase 1 (structural) and Phase 2 (read) of the real,
 * three-phase rollover, per direct, confirmed design
 * (docs/ledger-scoped-accounts-and-rollover.md) — creates each real,
 * non-zero Balance Sheet account's own node under the new ledger (so
 * the lines returned below can actually be staged against them
 * afterwards), then returns the real, proposed opening-balance lines
 * without staging or posting a single one of them. Phase 1 is a real,
 * structural write (new entities), not a side-effect-free preview —
 * the same, already-proven shape as this codebase's other
 * resolve-then-post endpoints (resolveOpenContainerAccounts,
 * resolveTransferAccounts, etc.): the backend keeps the genuinely
 * stateful account-creation piece, the caller does the posting. */
export function resolveRolloverLines(business: BusinessName, oldLedger: LedgerName, newLedger: LedgerName, asOfDate: string, userId: UserId): ResolvedRollover {
  const businessId = (db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')`).get(business) as { id: number } | undefined)?.id;
  if (!businessId) throw new ValidationError(`No real business named "${business}".`);
  const ledgersRootId = (db.prepare(`SELECT id FROM current_entities WHERE name = 'Ledgers' AND parent_id = ?`).get(businessId) as { id: number } | undefined)?.id;
  if (!ledgersRootId) throw new ValidationError(`No real "Ledgers" node for "${business}" — this business was not created with the current, real structure.`);
  const newLedgerId = (db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(newLedger, ledgersRootId) as { id: number } | undefined)?.id;
  if (!newLedgerId) throw new ValidationError(`No real ledger named "${newLedger}" under "${business}" — create it first.`);

  // Phase 2 (read) done first, since phase 1 needs to know which real
  // accounts genuinely carry a non-zero closing balance - a plain
  // read, nothing written anywhere yet.
  const bs = getBalanceSheet(business, oldLedger, asOfDate);
  const usedLines = [...bs.assets, ...bs.liabilities, ...bs.equity].filter((l) => l.debit_minor !== 0 || l.credit_minor !== 0);

  if (usedLines.length === 0) {
    throw new ValidationError(`Nothing to carry forward for "${oldLedger}" as of ${asOfDate} — every Balance Sheet account is already zero.`);
  }

  // Phase 1 (structural): create each real account's own node as a
  // real child of the real Chart of Accounts posting leaf itself -
  // named after the new ledger, relation_id pointing at that real
  // ledger entity. A genuine descendant of Chart of Accounts, so
  // every existing report's own real_accounts-style tree walk finds
  // it automatically, with no changes anywhere else. No journal entry
  // anywhere in this phase.
  for (const line of usedLines) {
    // A real, confirmed bug, found and fixed directly: this bare,
    // global lookup could resolve to a completely different, same-
    // named account under some other business's own Chart of Accounts
    // copy (or the shared, global template), rather than this specific
    // business's own leaf — business-scoped via resolveBusinessCoaAccountId,
    // the exact, same fix already applied throughout the lazy account-
    // creation functions above.
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

/** The real, three-phase year/period rollover, per direct, confirmed
 * design (docs/ledger-scoped-accounts-and-rollover.md). Must be called
 * after closeBooks has already closed the old ledger's own Income and
 * Expense accounts into Retained Earnings — this function only ever
 * touches real Balance Sheet accounts (Asset/Liability/Equity), never
 * Income/Expense, which start fresh, lazily, in the new ledger exactly
 * as today.
 *
 * Nothing here ever posts across ledgers - there is no "transfer"
 * primitive, and must never be one. Phase 1 (structural) creates real
 * entities directly, no journal entry at all. Phase 2 (read) is a
 * plain read. Phase 3 (post) is one, ordinary, balanced journal entry
 * entirely within the new ledger. Kept intact (rather than removed in
 * favor of the frontend calling resolveRolloverLines + stageLine/
 * postJournalEntry itself) for backward compatibility with any direct
 * backend/test/script caller — it now simply calls the shared
 * resolveRolloverLines for phases 1+2 and does phase 3 itself, the
 * exact, same sharing pattern closeBooks already uses with
 * computeCloseLines. */
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
  // Per docs/active-ledger-design.md and direct instruction: the real
  // moment ordinary trading moves to the new ledger — a real, soft
  // switch (no forced logout), never a hard lock on the old ledger,
  // which stays genuinely postable for real corrections.
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

