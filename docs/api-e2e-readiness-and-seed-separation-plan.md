# Getting the API-path tutorial e2e test passing, and the full seed-data separation that follows

This session found and partly fixed a tangle of problems that all surfaced from one
starting point: a real, confirmed cross-business account-leakage bug in the journal
posting trigger. Fixing it correctly required removing all business/demo data from
core, which in turn exposed how much of this codebase's seed data still depends on
that removed data, and how much of it is loaded through a mechanism (`db-seed.ts`'s
TypeScript functions) that's now explicitly forbidden. This plan separates what is
**strictly necessary** to get `shared-fixtures/tutorial-steps.csv` passing through
`step-runner.ts --path api` from the **full separation** the project owner has asked
for, which is real, worthwhile, but not blocking.

## Part 1 — Strictly necessary for the API tutorial e2e test to pass

### 1.1 Done and verified this session

- **`post_journal_entry_insert` and the parallel quantity-movement trigger** now
  resolve a staged line's bare account name within that specific business's own
  Chart of Accounts subtree first (recursive CTE), falling back to the old,
  unscoped lookup only when a business has no own CoA copy at all. This was the
  real, confirmed root cause of cross-business leakage.
- **`getChartOfAccounts`/`getBusinessReports`** (`db-reports.ts`) now take an
  explicit business and walk only that business's own subtree, including the
  category → global-category → report `relation_id` indirection.
- **`resolveCashAtBankAccount`** replaces the old global `ensureCashAtBankAccount`,
  wired into `completePosSale`, `completeCashPurchase`, `payEmployeeWages`,
  `createBusiness`.
- **All business/demo data removed from `00-core.sql`**: the `CS-1001` bootstrap
  posting under "My Business", the entire Wine/Beer/Spirits demo
  locations/divisions/categories/products/prices block, and the Acme
  Corp/Beta Pty Ltd/Acme Supplies Pty Ltd demo AR/AP accounts. Core data is now
  limited to structural entities, vocabulary/translations, and the admin user.
- **Ditta Italiana Srl / Schweizer KMU AG** moved out of `00-core.sql` into their
  own gated `20-demo-italian-swiss.sql`, loaded the same way as
  `20-demo-bmw-peugeot.sql` — fixing a real, confirmed integrity gap (4 dangling
  `parent_id` rows) the old text-pattern filter left behind.
- **Integrity re-verified** on the fresh, `SEED_DEMO_BUSINESSES=false` database:
  zero dangling references across `parent_id`, `relation_id`,
  `account.entity_id`, `entity_merge_detail.entity_id`, `account_entry.name`.
- `tutorial-steps.csv` **lints clean** under `SEED_DEMO_BUSINESSES=false`: 26 real
  steps, no problems found.

### 1.2 Done and verified: the real `--path api` run, now passing 26/26

The real, full run (`SEED_DEMO_BUSINESSES=false npx tsx scripts/step-runner.ts
../shared-fixtures/tutorial-steps.csv --screens ../shared-fixtures/screens.csv
--path api --non-interactive`) now passes all 26 steps, confirmed twice in a
row from a freshly rebuilt database (deleting `backend/data/entities.sqlite*`
each time), with a full integrity sweep (zero dangling `parent_id`,
`relation_id`, `account.entity_id`, `entity_merge_detail.entity_id`,
`journal_line.account_id` references) and both ledgers' own Balance Sheets and
Trial Balance confirmed genuinely balanced after Close Books and the
year/period rollover.

**What was actually wrong, found by running the real test and tracing each
failure to its source, not by inspection alone:**

1. **`step-runner.ts`'s own `createBusiness` API_REGISTRY entry never read the
   CSV's `businessType` field at all**, so neither `coaPrototype` nor
   `entityStructure` ever reached `db.createBusiness()` on the API path — unlike
   the real frontend (`setup/new-business/+page.svelte`), which always submits
   both (a `coaPrototype` defaulting to `"English CoA"`, and an `entityStructure`
   mapped from the business-type select). Fixed by mapping `businessType` to
   `entityStructure` and passing `"English CoA"` as `coaPrototype`, mirroring the
   frontend's own defaults exactly.
2. **`copyChartOfAccountsInto`'s own "is this a genuine structural category"
   heuristic** (`hasRealStructuralChild`) skipped `Cost of Goods Sold`
   specifically, since it cannot carry an `"% CoA"` prototype tag at all — its
   one real `relation_id` slot is already spoken for by the Gross Profit
   report's own "COGS" category marker. On a database with zero demo data it
   has no real children either, so it was never copied into any new business's
   own Chart of Accounts at all. Fixed with a narrow, explicit, by-name
   exception, the same style this function already uses throughout.
3. **The deeper, systemic bug, confirmed across five separate functions**:
   `ensureCombinationAccountLeaf`'s bare-name fallback, `ensureCategoryChain`,
   `ensureItemSalesCogsAccounts`, `ensureItemInventoryAccount`, and
   `rolloverToNewPeriod`'s own "attach the new ledger node" lookup all resolved
   a known account name (`Sales Revenue`, `Cost of Goods Sold`, `Inventory`,
   `Cash and Bank`, `Owner's Equity`, ...) with a bare, global
   `WHERE name = ?`, with no business scoping at all — landing every lazily-
   created, per-product/per-location leaf on the one, shared, global Chart of
   Accounts template, invisible to `getBusinessReports`'/`getBalanceSheet`'s own,
   correct, business-scoped walk (itself fixed earlier this session). This is
   why the Close Books and Rollover steps failed: the real Sales
   Revenue/COGS/Inventory postings existed, with real balances (confirmed via
   `getTrialBalance`, which resolves by `journal.business_id` rather than by
   walking any Chart of Accounts tree), but were structurally invisible to any
   report that does walk the tree. Fixed with one new, shared helper,
   `resolveBusinessCoaAccountId(business, accountName)` (`db.ts`) — the same
   business-scoped recursive-CTE walk the journal-posting trigger itself
   already uses, with the same legacy-business COALESCE fallback — threaded
   through every one of these call sites as an optional, backward-compatible
   trailing parameter, so no existing caller (unit tests, scripts) was broken.
4. **`backend/test/db.test.ts`'s 4 zero-arg call sites** (`getBusinessReports()`,
   `getChartOfAccounts()` without a business argument) will still fail to
   compile/run if anything invokes the full backend unit suite — unchanged,
   **not required for the API tutorial test itself** (step-runner doesn't touch
   this file), flagged only so it isn't mistaken for a blocker.

### 1.3 Known, pre-existing, NOT required for this

- The BMW/Peugeot `deleted_at` column error when `SEED_DEMO_BUSINESSES` is left
  at its default (true). This only matters if demo businesses are ever turned
  on; the tutorial e2e test runs with them off. Pre-existing, not touched
  tonight, not a blocker here.

## Part 2 — The full separation, for later

Everything below is real, agreed-necessary work, explicitly **not** required to
get the API tutorial test passing — tracked here so it isn't lost, per direct
instruction, since "it must have been lost somewhere" once already.

### 2.1 `db-seed.ts` is completely forbidden — retire it entirely

Per direct, standing instruction: **zero TypeScript should be involved in
loading any seed data.** The only documented way to load data is one plain SQL
script that creates the fundamental tables, inserts into `entities`, and
creates the staging tables with their triggers.

- `db-seed.ts`'s Wine Retail Business functions (`migrateForWineRetailDemoData`,
  `migrateForWineRetailCompany`, `seedWineRetailEmployees`,
  `migrateForWineRetailUpcs`, and the orchestrating `seedRemainingData`) all call
  real backend functions directly — `createItem`, `setLocation`, `receiveItems` —
  instead of writing the equivalent staging-table SQL. This is exactly the
  pattern `post_journal_entry`'s own trigger mechanism already proves is
  unnecessary: any business operation expressible as a TypeScript function call
  is, by construction, also expressible as an `INSERT` into the right staging
  table plus the trigger that already exists for it.
- **Required action**: remove `db-seed.ts`'s call into these functions from
  `db.ts`'s startup path entirely. Whatever real value this data had (a
  realistic Wine Retail Business to explore) is superseded by the Step Runner
  fixture building the equivalent, live, through real screens or the real API —
  per direct instruction, "All other Wine Retail or other Business data... is
  to be loaded exclusively through the test runner." This is `docs/
  realistic-tutorial-e2e-plan.md`'s own Phase D, previously deferred, now
  un-deferred.

### 2.2 Separate Language/Vocabulary/Translation data out of core — urgent, but later

Per direct instruction, this was built once before (when the translator UI/API
was built) and the separation was since lost. Confirmed directly tonight:

- There is no dedicated `translation` table at all — a translation is itself an
  ordinary row in the `entities` table (a child of the target Language entity,
  `relation_id` pointing back at the vocabulary word it translates), read
  through the `localized_text` view.
- These rows are interleaved throughout `00-core.sql`, mixed in with structural
  entities and vocabulary definitions, not cleanly separable today. The five
  `10-vocab-*.sql` files exist but are mostly dead stub comments — the real
  separation they were meant to carry never actually landed, or was lost.
- **Required action**: re-establish a clean separation — core structural schema
  in one file, vocabulary words in another, and actual translated text loaded
  through whatever mechanism the translator UI/API already expects (need to
  find/reconstruct that contract, since it was apparently built once and lost).

### 2.3 Collapse the baked-in historical/superseded entity rows

Confirmed directly tonight: in the fresh, minimal database, `entities` holds
7,801 total rows for only 4,426 live ones — 3,321 distinct `entity_id`s already
carry a superseded row baked in from the seed's own construction (an
`entity_update`-style edit applied during authoring, not a genuine runtime
change). Per direct instruction, core data should be a contiguous block with
zero historical data.

- **Required action**: rewrite the affected `INSERT` statements in `00-core.sql`
  to set the entity's final `parent_id`/`relation_id` directly on its one and
  only row, rather than inserting once and then "updating" it via a second,
  superseding row during seed authorship. A few entity_ids (999006, 999008, ...)
  suggest some of this came from a one-off script run against a live dev
  database and baked back in — worth checking `tag-coa-prototypes.ts`/
  `tag-coa-prototypes-remaining.ts` for exactly this pattern first.

### 2.4 Wire up `db_version` to actually drive re-initialization

A real version mechanism already exists and is correctly stamped — the root
`VERSION` file, read by both frontend and backend, and the `db_version` table
in `00-core.sql`, exposed via `/api/health`. Confirmed directly: nothing
currently *uses* it. `db.ts`'s own startup check is still just "does a table
named `entities` exist at all" — not a version comparison — which is why a
manual `make reset-db` / deleting the database file has been required all
session to pick up any schema change.

- **Required action**: on backend startup, compare the stamped `db_version` row
  against the current `VERSION` file; on mismatch (or a missing database),
  re-run the SQL schema files automatically rather than requiring a manual
  reset. `docs/skill-version-check.md` already names this as the deliberately
  deferred "real migration runner" — this is building that, now.

### 2.5 Decide the fate of the unit test suite's demo-data dependencies

`backend/test/db.test.ts` has roughly 90 references to the now-removed demo
accounts (Acme Corp, Beta Pty Ltd, Acme Supplies Pty Ltd) and the CS-1001
baseline balance. Per direct instruction: unit tests should stand alone only if
and when actually needed, and not be supplanted by the same coverage now
available through the Step Runner's real API/UI testing.

- **Required action**: go through each affected test individually — not a bulk
  fix — and for each one, decide: (a) genuinely backend-only regression
  coverage worth keeping, made self-contained per `docs/
  skill-test-writing-standard.md` (create its own account/business, never
  assume a shared demo name exists); or (b) now redundant with what the
  tutorial/full e2e fixture already exercises through real screens or the real
  API, and removed.

### 2.6 Decide the fate of the remaining foreign-business demo files

`20-demo-bmw-peugeot.sql` and the newly-separated `20-demo-italian-swiss.sql`
are still real business/demo data, just gated rather than removed. Given "all
other business data... is to be loaded exclusively through the test runner,"
these likely belong re-expressed as Step Runner fixtures too, not left as a
gated SQL exception. Not decided here — flagged for a direct decision,
consistent with `skill-manual-as-source-of-truth`'s own discipline of
reporting a stop point rather than guessing.
