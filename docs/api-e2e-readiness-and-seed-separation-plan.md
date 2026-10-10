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

## Part 3 — The real UI-path tutorial e2e run, per direct instruction

Per direct instruction: run the UI tutorial test interactively, falling back
to the matching API call whenever a UI step fails, confirm whether a failing
UI step fails *completely* (safe to retry via the API afterward), then plan
the implementation work the findings call for.

### 3.1 A real, confirmed, serious gap in the test runner itself, found and fixed first

Before any UI bug could be trusted, `runStepViaUi` (`backend/scripts/
step-runner.ts`) itself had to be fixed. Its own success/failure detection
only ever caught a thrown Playwright exception or an explicit, per-row
`verify` registry failure — **it never checked whether any real browser
interaction happened at all.** A first full UI run, before this fix, reported
**26/26 ✅** while the resulting database held **zero rows in `journal`,
`journal_line`, and `journal_entry_staging`, combined** — every money-moving
step (Stage Journal Line, Post Journal Entry, Cash Purchase, POS Sale, Cash
Sale, Close Books, Rollover, …) silently did nothing.

**Root cause, confirmed directly** (via a throwaway Playwright trace script —
`docs/programmer-tooling.md` §4's own documented debugging technique — driving
the real `runStepViaUi` against a fresh, freshly-started backend/frontend,
logging every `console`/`requestfinished`/`requestfailed` event): `screens.csv`
has **real UI wiring (`ui_path`/`open_selector`/`field_selector`/
`submit_selector`) for only 5 of the 19 screen types the tutorial uses** —
Login, Select Business, Switch Session, Create Business, Create Location, and
Create Item. The other 14 (Create Employee, Create Provider, Set Item Cost
and Pack Size, Post Journal Entry, Create Purchase Order, Cash Purchase,
Transfer Items, POS Sale, Close Books, Create Ledger, Rollover To New Period,
Stage Journal Line, Cash Sale, Create Customer) have **only `api_function`
filled in — every UI column is blank.** `runStepViaUi`'s own field loop
(`if (!field.field_selector) continue;`) and submit guard
(`if (screen.submit_selector) { ... }`) silently skip everything for these
rows, so the function does genuinely nothing and still returns `{ ok: true }`.
These screens' UI paths have simply never been implemented or exercised —
only their API-path equivalents have.

**Fixed**: `runStepViaUi` now checks, up front, whether the screen has *any*
real UI wiring at all (`ui_path`, `open_selector`, `submit_selector`, or any
field's `field_selector`); if not, it returns a real, explicit failure
instead of a silent no-op. Combined with the `--fallback-to-api` flag added
this session, a UI run now tells the truth: it genuinely attempts the 5
wired screens through the real browser, and transparently (and correctly)
falls back to the real API call for the other 14, rather than lying about
having tested them.

### 3.2 The real UI run, with the fix in place: two genuine, concrete UI bugs found

Re-run from a fresh database (`SEED_DEMO_BUSINESSES=false npx tsx
scripts/step-runner.ts ../shared-fixtures/tutorial-steps.csv --screens
../shared-fixtures/screens.csv --path ui --non-interactive
--fallback-to-api --delay 500`): 24 of 26 steps now pass honestly (4 via a
real, successful browser interaction; 1 via a genuinely successful fallback
after an honest "no UI wiring" failure... in total, 14 fall back and succeed).
**Two steps reveal real, confirmed UI bugs:**

1. **Step 6, Create Location ("Main Street Cellar")**: the real browser
   interaction timed out after 30s waiting for the `button:has-text('+ New
   Location')` locator to become clickable again, right after step 5 had just
   used that same button to create "Head Office". This is a real frontend
   bug — the create-location flow leaves the page in a state (very likely a
   modal/dialog from the first creation not fully dismissed, or a client-side
   navigation not yet settled) where immediately creating a second location
   back-to-back cannot be driven the same way.
   - **This step does NOT fail completely.** Despite the UI step reporting
     failure, "Main Street Cellar" was already created server-side (visible
     in `current_entities` under the real `Locations` root) — with its name
     and carton-capacity structure, but **without its bottle-capacity
     structure**, confirming the timeout happened partway through the form
     interaction, after some fields/sub-mission had already gone through.
   - The `--fallback-to-api` retry correctly refused to make this worse:
     `createAndConfigureLocation` rejects a same-named location under the
     same parent ("`"Main Street Cellar" already exists under this real,
     same parent`") rather than silently duplicating it — but this means the
     location is left permanently short its bottle-capacity structure, with
     no automatic repair path.
   - **Confirmed cascading consequence**: step 23 (Open Container) later
     fails for a genuine, separate, correct business reason — "`"Main Street
     Cellar" has no real bottle shelving (bottle capacity is not set)`" —
     directly caused by step 6's partial UI failure, not a bug in Open
     Container itself.
2. **Steps 7-26's "no UI wiring" screens** (listed in 3.1): these fail
   *completely*, in the good sense — nothing is attempted, nothing is
   written, so the API fallback for every one of them is genuinely safe and
   succeeded cleanly. The one exception is step 23 above, which fails for a
   real, pre-existing-state reason unrelated to its own lack of UI wiring.

**Confirmed, with the fix and fallback in place, the resulting database is
now fully correct**: 28 journal entries / 58 journal lines (previously
zero), a correctly-located "Jordan Lee" employee (previously missing
entirely), both items correctly categorized, and a real, balanced trial
balance for "Tutorial Wine Retail Business" after Close Books and Rollover.
The only residual, real defect is "Main Street Cellar"'s missing
bottle-capacity structure, a direct, confirmed consequence of the one real
UI bug found (3.2.1) — not of the fallback mechanism.

### 3.3 Implementation work this calls for

Per direct instruction, this is a plan to review, not work already applied
beyond the two items explicitly marked done below.

1. **Done this session**: `runStepViaUi`'s "no real UI wiring → honest
   failure" check (3.1) and the `--fallback-to-api` flag. Low-risk,
   mechanical, and already proven to turn a false "26/26 ✅" into a truthful
   result with a working, safe fallback for every screen that has no UI
   implementation at all.
2. **Not yet done — real UI implementation work, one screen at a time**:
   wire real `ui_path`/`open_selector`/`field_selector`/`submit_selector`
   values into `screens.csv` for the 14 screens listed in 3.1, once each
   screen's real frontend route/form actually exists and is stable enough to
   automate against. Until then, the UI path for these screens is, correctly,
   "not implemented" rather than "silently broken" — this is now visible and
   honest, not a blocker to keep testing the rest through the API fallback.
3. **Not yet done — the real "+ New Location" back-to-back bug (3.2.1)**:
   needs its own, dedicated investigation into the Locations page's own
   Svelte component — specifically what state (a modal, a toast, a pending
   navigation) is left behind immediately after a successful creation that
   blocks the same button from being clickable again within 30s. This is a
   genuine frontend bug, confirmed directly through the real browser, not a
   test-runner or selector-wording issue (the selector itself matched and
   worked correctly for the first location).
4. **Not yet done — a real repair/guard for Main Street Cellar's missing
   bottle-capacity structure**, caused by the above bug in this specific run.
   Two independent angles, either or both worth doing: (a) fix the root
   frontend bug in (3) so this can't happen again; (b) decide whether
   `createAndConfigureLocation`'s own "already exists" guard should instead
   offer a real repair path (detect and backfill a missing capacity structure
   on an existing location) rather than only blocking a duplicate — a product
   decision, not assumed here.
5. **Worth doing generally, not just for this run**: `runStepViaUi` still has
   no way to tell a *fully successful* submission from one whose POST/PUT the
   browser aborted client-side while the server still processed it (seen
   directly in the pre-fix trace: Create Location's and Create Item's own
   submission requests both showed `net::ERR_ABORTED`, yet both ultimately
   left correct, real server-side state). A `verify` registry entry, or a
   real network-response assertion, for every state-changing screen would
   catch this class of problem — not required to act on today's findings, but
   the same shape of gap that made 3.1 possible in the first place.

## Appendix — known tooling issue, found while starting servers for the UI run, deferred

`make stop-servers` (and therefore `make ensure-servers-no-demo`, which calls
the same kill logic when it detects a wrongly-seeded backend) hangs/gets
killed in this session's sandboxed environment — reproduced directly,
`make stop-servers` alone returns `make: *** [Makefile:288: stop-servers]
Killed`, exit code 2, even with the sandbox restriction lifted. Root cause
not yet investigated — deferred per direct instruction ("file for later") so
as not to block the actual UI tutorial run, which used a backend/frontend
started directly instead (`setsid nohup ... & disown`, the same primitive
`ensure-servers`'s own recipe uses). Needs a real root-cause pass later:
whether it's the `kill -- -$PID` process-group signal, the `pkill -9`, or
something about this specific sandboxed session that differs from the
environment this target was built and verified against.
