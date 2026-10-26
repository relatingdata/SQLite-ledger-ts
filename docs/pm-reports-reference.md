# The Reports API — `backend/src/db-reports.ts` and `backend/src/db-matrix-reports.ts`

## The core rule: balances for financial statements always come from `getLedgerBalances`, never from `account.balance_minor`

`account.balance_minor` (maintained by the `post_journal_entry` trigger) is a single running total across every ledger a business has — it does not distinguish "Actual" from a budget scenario. Posting 100 to Actual and 500 to a Budget ledger for the same account adds both into that one column. Every financial statement in this file instead computes balances fresh from `journal_occurrences`, filtered to one specific ledger (`getLedgerBalances`), and that is the only place this filtering logic lives.

`getLedgerBalances` reads from `journal_occurrences`, not `journal_line` directly, so a recurring journal's virtual occurrences (a budget's monthly rent, stepped through a year) count toward a ledger's balances exactly like an ordinary one-off posting. It restricts to real descendants of "Chart of Accounts" plus the `Customers`/`Vendors` subtrees (AR/AP post directly to each customer's/vendor's own name, which lives structurally outside the Chart of Accounts) — any account outside both would be invisible to every report, breaking the fundamental identity that a trial balance always balances. `fromDate`/`toDate` are both optional; point-in-time reports (Trial Balance, Balance Sheet) only ever pass `toDate` ("as of"), while Profit and Loss needs both, since income/expense should accumulate only within the period, not from inception.

## `getBusinessReports` / `getChartOfAccounts`

Both replace direct reads of the old `business_reports` / `chart_of_accounts` views, which walked the Chart of Accounts with no business scoping at all (a bare `WHERE name = 'Chart of Accounts'` matches every business's own root simultaneously). Both are now direct, business-scoped recursive queries, with one exception: `admin` (the one legacy, pre-multi-tenancy demo business seeded in `schema/00-core.sql`) never got its own structural Chart-of-Accounts copy and posts directly against the global one, so the base case falls back to the global root whenever the business's own copy has no real category child (`relation_id IS NOT NULL`) under it.

`getBusinessReports`'s category-to-report resolution has to handle two different join depths: a business-scoped category's `relation_id` normally points at its global counterpart, whose own `relation_id` finally points at the report (two hops) — except for `admin`, which falls back straight to the global category, so `relation_id` already points at the report directly (one hop). The query disambiguates by checking whether the first hop already lands on a report (a direct child of "Business Reports").

`getChartOfAccounts` additionally merges in accounts that live structurally outside the Chart of Accounts but have set a CoA leaf as their "Header Account" hierarchy parent — generically, for any entity, not hardcoded to `Customers`/`Vendors` — so a vivified customer/vendor account with a real balance still shows up under the right heading. Structural plumbing entities (`% — Hierarchy: %`, `% — Contact Type: %`) are excluded from that merged subtree.

## Currency- and Profit-Center-tagged sibling accounts

`ensureCurrencyAccount(baseAccountId, currency, userId)` creates (or reuses) a currency-specific sibling of a base account — e.g. "Sales Revenue (USD)" next to "Sales Revenue" — per `docs/multicurrency-design.md`: a foreign-currency sale never converts at posting time, so every leg (Revenue, Tax, COGS, Cash) stays denominated in the nominated currency, each posted to its own currency-tagged sibling, balancing entirely within that currency group. It takes the base account's **id**, not its name — scoped-uniqueness deliberately allows the same name at two different parent levels (e.g. a COGS leaf and an Inventory leaf for the same product/location), so a name-only lookup is ambiguous and could create one shared sibling for what should be two separate ones. It also resolves the sibling's own id explicitly before calling `setAccountCurrency`, rather than passing the name alone, because two different businesses routinely have same-named siblings (e.g. both have "Cash at Bank (USD)") and a bare name lookup could tag the wrong business's account.

`ensureProfitCenterRetainedEarningsAccount(baseAccountId, profitCenterName, userId)` is the equivalent for Profit Centers (`docs/profit-centers-design.md`): a postable sibling under the business's one shared Retained Earnings account, named `"{base} (Profit Center: {name})"`, created the moment that Profit Center first closes with a non-zero result. The parenthesized form means it never collides with, and nests cleanly under, a currency-tagged sibling built on top of it by `ensureCurrencyAccount`.

## `resolveCashAtBankAccount`

Replaces a bare, unscoped `WHERE name = 'Cash at Bank'` lookup that resolved every business to the same global entity. Resolved against the business's own "Asset" category (via `resolveBusinessCoaAccountId`, the same business-scoping fix used throughout this file). Three cases:

- Plain/home-currency: `admin` specifically has always used "Cash and Bank" (a different name, entity id 11, seeded directly) rather than "Cash at Bank" — checked first and preferred when it exists, so an earlier foreign-currency sale's lazily-created "Cash at Bank" header never shadows it. Falls back to an existing "Cash at Bank" leaf, then lazily creates one for a genuinely new business.
- Foreign/nominated-currency: always built on "Cash at Bank" specifically (never "Cash and Bank", even for `admin`), get-or-created independently of whichever plain leaf ordinary postings use.
- Existing currency leaves under that base are distinguished from a ledger-scoped rollover child (`resolveRolloverLines` creates a node named after the ledger itself, e.g. "Actual 2027-28", with `relation_id` pointing at that ledger) by matching only names ending in `(XXX)` — a plain single-currency "Cash at Bank" leaf that has been through a rollover otherwise gets a non-currency child and would wrongly look multi-currency.

Cash is included in the same lazy currency-tagging pattern every other leg of a foreign-currency sale already uses (`completePosSale`); leaving it out meant the first foreign-currency sale always failed with a per-currency balance error.

## Trial Balance

`getTrialBalance` qualifies a display name (via `getQualifiedDisplayName`/`getCombinationDisplayName`) only for accounts that are both genuinely duplicated by bare name **and** actually have a non-zero balance in this specific business/ledger — checking `balances.get(id)` for a non-zero value, not just map-key presence, since `getLedgerBalances`'s map carries an entry (possibly zero) for every reportable account system-wide.

`has_quantity_postings` marks an account that has ever received a direct quantity-tracking posting (a journal reference ending `-QTY` — unit counts, not money), checked structurally against `journal_line`/`journal.reference`, not against `account.currency` being non-null — a genuine foreign-currency account is just as non-null as a quantity account, so a currency-based check would mislabel it.

`by_currency` gives independent per-currency debit/credit subtotals, each checked for balance on its own — because this schema's rule is that a single journal entry may span multiple currencies, but every distinct currency present must independently balance to zero, so a caller checking for a genuine imbalance should prefer this breakdown over the single combined total.

## Balance Sheet

`getBalanceSheet` uses `getBusinessReports` only for structural grouping (which category an account falls under); the actual balance per line always comes from `getLedgerBalances`. `is_contra` marks a line whose balance landed in the column opposite its section's normal side (an Asset with a credit balance, say) — genuinely unusual, not an error, worth flagging rather than presenting as an ordinary signed number.

It includes a synthetic "Current Year Earnings" equity line equal to net income from `getProfitAndLoss`. Without it, Assets = Liabilities + Equity only holds at the instant books are formally closed; at any other moment, revenue sitting in an Income account has increased Assets with no corresponding Equity entry yet. (Caught originally by a real failing balance check, not assumed correct.)

Accounts Receivable and Accounts Payable are summed separately via `sumHierarchyDescendants`, because `Customers`/`Vendors` are Vocabulary words living structurally outside the Chart of Accounts, reached only through the "Header Account" hierarchy link — generic, not hardcoded by name, so any future entity setting the same link against any other heading is picked up automatically. A real asymmetry: a customer reaches "Accounts Receivable" only via an indirect hierarchy child ("Customers"), while a vendor (`createProvider`) lives directly under "Accounts Payable" itself — so the header account's own id is also a valid starting point for the walk, not just its hierarchy children.

`assets_tree`/`liabilities_tree` group leaves by their real CoA category structure via `buildCategoryTree` (Current Assets/Non-Current Assets, etc.); AR/AP/Current Year Earnings appear as synthetic top-level nodes since they have no structural category to nest under. `equity_tree` is always flat — there is no genuine Current/Non-Current split for equity.

## Profit and Loss

`getProfitAndLoss` is a thin wrapper: fetch the one balance map this ledger/date-range needs via `getLedgerBalances`, then hand it to `buildProfitAndLossFromBalances`, which holds the actual P&L-building logic. This split exists so `getProfitAndLossByHierarchy` can call the shared balance query exactly once and build every group's P&L from its own slice of that one result, rather than re-querying the whole dataset once per group (an earlier version did the latter and measured roughly 20 seconds against a full business simulation).

`cogs_expenses` is split out of `expenses` via a direct `relation_id` check against the "COGS" entity — not derived from `getBusinessReports`, which only tags top-level categories, not individual accounts within one. `gross_profit_minor` is revenue minus COGS specifically, a distinct subtotal from `net_income_minor` that most tax/lending contexts expect.

`buildCategoryTree` walks `Hierarchy.buildTree` for every node under a root regardless of balance, then prunes any node that is both non-leaf and has no surviving (non-zero) children, restoring the established sparse-output behavior (no category rows with nothing posted under them).

## Grouped/hierarchy-based P&L (`getProfitAndLossByHierarchy`, `getProfitAndLossForHierarchyGroup`, `getProfitAndLossByHierarchyTree`)

`resolveAccountHierarchyGroup(accountName, hierarchyPath)` is the generic hierarchy-grouping mechanism behind every "Consolidated per X" report. `hierarchyPath` is an ordered chain of hierarchy-link hops — `['Location']` groups by an account's direct Location link, `['Location', 'Division']` walks account → Location → whatever a business has named "Division" — with no hierarchy name ever hardcoded. An empty path is a deliberate "no breakdown" request: every account resolves to one shared `null` group rather than its own bare name.

`getLedgerBalancesByHierarchyStructural` computes balances once, per account **and** per resolved group, in a single pass — this is the shared query both `getProfitAndLossByHierarchy` and `computeCloseLines` (the year-end close) use to avoid the same repeated-full-scan cost described above.

`getProfitAndLossForHierarchyGroup` rolls a single group's P&L up to include every nested descendant group beneath it (as many levels as the hierarchy actually has), using the flat `{name, parentName}` list from `getHierarchyGroups`.

`getProfitAndLossByHierarchyTree` nests the flat per-group breakdown into a tree by each group's own parent. A top-level group with active children but no direct activity of its own still gets a synthesized, genuinely empty P&L node, so its children have somewhere to nest — without this, such a level would simply vanish and leave its children orphaned. The null-group "(No group)" entry is always its own separate root, never nested under anything.

## Year-end close (`closeBooks`, `previewCloseBooks`, `computeCloseLines`)

Zeroes every Income and Expense account and transfers the net difference to Retained Earnings as one single balanced journal entry — not a special rule, just an ordinary posting that happens to touch every P&L account at once. `computeCloseLines` is the one shared computation both `previewCloseBooks` and `closeBooks` use, so a preview can never drift from what actually posts.

A hierarchy group (e.g. "Division") is purely a reporting dimension here, never a structural split in what gets posted: every group's net income still rolls into the single, caller-chosen `retainedEarningsAccount`. `groupBreakdown` on the result is read-only summary information about what closed, not a decision about where anything posted. An earlier version created a separate `"{account} - {group}"` Retained Earnings leaf per group; that has been removed.

What **does** structurally split the posted Retained Earnings lines is currency and Profit Center: closing a foreign-currency Income/Expense account against a plain home-currency Retained Earnings would break the per-currency balance check, so lines are grouped by (group, currency, Profit Center) before collapsing to one combined line per (currency, Profit Center) pair, each posted against its own currency-/Profit-Center-tagged Retained Earnings sibling (`ensureCurrencyAccount`, `ensureProfitCenterRetainedEarningsAccount`). A Profit Center is never read off the journal line the way currency and group are — it's determined structurally per account via `getAccountProfitCenter`, constant across every group/balance under that one account. `profitCenterBreakdown` merges across group and currency (unlike `groupBreakdown`, which keeps per-currency entries); a business with zero Profit Centers gets exactly one entry, `{ profitCenter: null, netIncomeMinor: <the whole net income> }`.

## Rollover (`resolveRolloverLines`, `rolloverToNewPeriod`)

Must be called after `closeBooks` has already closed the old ledger's Income/Expense accounts — this only ever touches Balance Sheet accounts (Asset/Liability/Equity), which start fresh, lazily, in the new ledger. Nothing here ever posts across ledgers; there is no "transfer" primitive between ledgers and must never be one.

Three phases, split the same way Close Books splits preview from posting:
1. **Structural** (read-write, no journal entry): create each carried-forward account's own node under the new ledger, named after the ledger, with `relation_id` pointing at that ledger entity — a genuine descendant of Chart of Accounts, so every existing report's tree walk finds it with no further changes anywhere.
2. **Read**: compute the proposed opening-balance lines from the old ledger's non-zero Balance Sheet lines (`getBalanceSheet`). Done logically first, since phase 1 needs to know which accounts actually carry a non-zero closing balance.
3. **Post** (`rolloverToNewPeriod` only): stage and post the opening-balance lines as one ordinary balanced journal entry entirely within the new ledger, then soft-switch the business's active ledger (`setActiveLedger`) — no forced logout, and the old ledger stays fully postable for later corrections (per `docs/active-ledger-design.md`).

`resolveRolloverLines` covers phases 1+2 and is the shared computation both the frontend-facing "resolve, don't post" endpoint and `rolloverToNewPeriod` itself call, so a frontend-driven rollover can never drift from a direct backend call. Each carried-forward account is resolved against this specific business's Chart of Accounts via `resolveBusinessCoaAccountId`, not a bare global name lookup, which could otherwise resolve to a different business's same-named account.

## Sales report

`getSalesReport` includes every posted AR sale line (ordinary invoices and POS sales alike); credit notes are excluded, since a return isn't a sale. Category rollup groups each line by the sold item's own, optional `Hierarchy: Category` tag (`getHierarchyParent(itemName, 'Category')`, falling back to `'Other'` when untagged) — a pure, computed lookup, never a real position in the catalog's entity tree, so an item can be re-tagged into a different category at any time with no catalog reshuffling.

## Comparison reports

`getTrialBalanceComparison` and `getProfitAndLossComparison` both just call `getLedgerBalances` (or `getProfitAndLoss`) twice, once per ledger, and merge the results — no new balance-computation logic, so there's nothing new to get wrong. `ProfitAndLossComparisonLine.variance_minor` is always `(ledgerB − ledgerA)` in the conventional positive-total presentation, so calling this with `(Actual, Budget)` gives "how much more the budget expects than actually happened," positive meaning the budget is ahead.

---

# The Sales/COGS and Stock-on-Hand matrix reports — `backend/src/db-matrix-reports.ts`

A separate, standalone reporting engine, deliberately kept in its own file and touching none of the mechanisms above. The core idea: Sales vs. COGS (and, separately, Stock on Hand) broken down along two independent axes at once — one for "what was sold" (`Item` / `Consolidated`, or any further business-defined grouping such as `Category`), one for "where" (`Location` / `Consolidated`, or any further business-defined grouping such as `Division`) — so any combination of the two is a valid report, from the most granular Item-by-Location matrix down to a single Consolidated-by-Consolidated total. Only Item and Location are structural in the Chart of Accounts; every other grouping, Category and Division included, is a lateral `Hierarchy:` tag lookup, never a structural walk.

## Axes are open-ended, not a closed enum

`MatrixAxis` names `Item`/`Location`/`Consolidated` for IDE autocomplete, but is typed as `'Item' | 'Location' | 'Consolidated' | (string & {})` — any other string, Category and Division included, is treated as a genuinely user-defined hierarchy name (e.g. "Category", "Division", "Bottle Size", or anything a business defines), resolved through `getHierarchyParent`/`getHierarchyChildren` the exact same generic way, with no axis name ever privileged in code. Category used to be a fourth structural literal here (a product's own real ancestor position in the Items catalog tree, resolved by two now-removed functions, `categoryForAccount`/`categoryForItem`) until it was generalized to this same tag mechanism — see "Hierarchies and multi-dimensional reporting" in `docs/pm-domain-reference.md`.

`resolveKey(axis, accountId, entityIndex)` (for Sales/COGS accounts) and `resolveItemKey(axis, itemName, locationName)` (for Stock on Hand items) are the two key-resolution functions. For an axis that isn't one of the two structural ones, resolution is tried first directly on the product/item itself (a hierarchy tag like "Category" or "Bottle Size" typically lives there), falling back to the product's resolved Location (a tag like "Division" more often lives there instead) — both via the same generic `getHierarchyParent` link every hierarchy uses.

`loadEntityIndex()` is a one-time, in-memory snapshot of every entity's id/name/parent_id, used to walk each account's structural chain locally rather than one query per account — deliberately a standalone minimal equivalent rather than reusing `getEntityTree()` from `db.ts`, keeping this file's own dependencies self-contained. It still backs `resolveKey`'s `Item` axis and `getSalesCogsMatrix`'s own account enumeration, even though it's no longer used to walk a category chain.

`stripLocationSuffix` strips a trailing `" — LocationName"` suffix (the convention `ensureItemTierLocationLeaf` already uses) and a leading `"Sales - "`/`"COGS - "` prefix, so a product's Sales and COGS sides combine under the same Item key — the whole point of this report is comparing both sides for the same product, not listing them as separate unmatched rows.

`locationForAccount` reads an account's Location via a separate, explicitly-named child entity (`"{account} — Hierarchy: Location"`) whose own `relation_id` points at the target location — the same structural link `ensureItemTierLocationLeaf` sets via `setHierarchyParent`/`setEntityLink`, re-implemented here as a direct query rather than importing `getLocationForAccount` from `db.ts`, to keep this file's dependencies self-contained.

## `getSalesCogsMatrix`

Sums every Sales Revenue/Cost of Goods Sold account's ledger-scoped balance (date-filtered, close entries excluded) and buckets each into a `(rowKey, colKey)` cell via `resolveKey`. Sales is credit-normal, so a positive display amount is the negated raw balance; COGS is debit-normal and used as-is.

## `getStockOnHandMatrix`

Simpler than the Sales/COGS matrix: no date filtering at all, since stock on hand is always "right now." Per-unit cost is deliberately approximated given build-time constraints: `item_location` tracks quantity only, with no per-item cost column, and Inventory value is tracked at one single shared GL account rather than per item, so there is no existing per-item "average cost over time" to read. Cost is instead taken from the preferred (or first available) vendor's current `item_source.price_minor`, **divided by `package_quantity`** to get a correct per-unit figure — `price_minor` is confirmed to be the whole package's price (e.g. a carton of 24), not a per-unit price; skipping that division would overstate inventory value by a whole package's worth. The same per-unit cost is used for both "last" and "average" cost fields, since no separate historical-average figure exists to distinguish them. `lastCostMinor`/`averageCostMinor` are only precisely meaningful for a cell representing a single item; once multiple distinct items share a cell (e.g. under "Consolidated"), the figure is indicative only.

## `getProfitAndLossByAxis` and `getAxisValues`

`getProfitAndLossByAxis` is a full P&L statement (reusing `buildProfitAndLossFromBalances`/`buildCategoryTree` from `db-reports.ts`, so it gets the same drillable category tree the ordinary P&L report has) grouped by two independent axes nested "vertically" — an outer axis value containing a further-nested inner axis value — each optionally narrowed to one specific value. This generalizes the original report's own division picker to any axis, not only division.

`plAccountIds` collects every account whose structural ancestor chain reaches an "Income" or "Expense" entity. It must collect **every** entity named "Income"/"Expense", not just one: these names are only genuinely global as report categories — every business gets its own separate "Income"/"Expense" entity (via `copyChartOfAccountsInto`), a distinct id from the global template and from every other business's own copy, all sharing the same plain name. A `.find()`-style lookup that stops at the first match silently excludes every other business's P&L accounts from axis-based reports entirely — this was a confirmed bug, fixed by collecting the full set.

`getAxisValues` returns every distinct value that exists for each axis type, including one further entry per hierarchy a business has actually set up (`getBusinessHierarchy`) — e.g. "Division" — never a hardcoded, privileged axis name. It makes one pass over every P&L account's resolved axis keys; no full P&L is computed.

## Open area

`getSalesCogsMatrix` and `getProfitAndLossByAxis` is where a spreadsheet-style pivot and a drillable P&L statement coexist as two deliberately separate reports over the same axis-resolution mechanism — `getProfitAndLossByAxis` was added later, as a direct correction, after `getSalesCogsMatrix` alone didn't match the vertical, drillable layout the rest of the app's P&L already has. Neither replaces the other.
