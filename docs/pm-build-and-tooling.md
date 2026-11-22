# Build, Run & Tooling

## The Makefile — the single entry point for everyday work

| Target | What it does |
|---|---|
| `make install` | Fresh install for both backend and frontend — always removes `node_modules`/lockfiles first (a recurring `ERESOLVE` conflict from a stale install) |
| `make dev` | Starts backend (`:3001`) and frontend (`:5173`) together, one `Ctrl+C` stops both |
| `make dev-verbose` | The same, with `DB_VERBOSE=1` — every SQL statement the backend executes is printed live |
| `make dev-no-demo` | The same, with `SEED_DEMO_BUSINESSES=false` — only the one, dummy "My Business," no Wine Retail/BMW/Peugeot/Ditta/Schweizer demo data |
| `make web-frontend` | The real, browser (SvelteKit) frontend alone — `make frontend` stays as a working alias to it, for old muscle memory |
| `make text-frontend` | The real, Ink-based terminal frontend (`tui/`) alone — a second, real client of the exact same backend API; needs its own real terminal, so never bundled into `dev`/`dev-verbose` the way backend+web are paired there. See `docs/tui-design.md`. |
| `make test` | Backend unit tests (Node's built-in test runner) + frontend tests — see the Testing: Unit chapter — then the standalone step-runner tests on the API path (`make test-steps`), then `make check-manual` ("Gates", below) |
| `make test-steps` / `make test-steps-browser` | The standalone tests in `shared-fixtures/tests/`, on the API path or in the browser, each on a fresh database (`scripts/run-step-tests.ts`; `TEST=a,b` runs only those) — see the Testing: E2E chapter, "Standalone tests" |
| `make test-e2e` / `make demo-full-year` | Full/volume simulation and full-year data generation — see the Testing: E2E chapter |
| `make test-e2e-tutorials` | The Retail, Manufacturing and Project Builder fixtures on the API path. `MIDDLEWARE=core` (the default) sends every step through the core middleware's frontend API in-process; `MIDDLEWARE=legacy` runs them on the original middleware. See "The Core Middleware" |
| `make test-e2e-tutorials-http` | The same three fixtures on the core, over real HTTP: starts the backend with `MIDDLEWARE=core` on `CORE_HTTP_PORT` (default 3101), runs the step runner with `STEP_RUNNER_API_URL`, stops the server |
| `make test-storage-engine` / `make storage-engine-deps` | The Gleam storage engine's own suite (`storage_engine/`); its dependencies are first cloned at pinned commits into `storage_engine/deps/` by `storage_engine/fetch_deps.sh` |
| `make test-e2e-tutorial-text` | The real, CSV-driven tutorial fixture, driven through the terminal frontend via `@microsoft/tui-test` — see "Testing the terminal frontend" below |
| `make check-db-consistency` | The consistency check alone, on whatever database currently exists — balanced entries, no orphaned references, referential integrity |
| `make reset-db` | Deletes the SQLite database files, the core middleware's `backend/data/core.sqlite` included; the original reinitializes from `backend/schema/*.sql` on the next backend start, the core installs itself on first open |
| `make verify-fresh` | Resets the database, confirms it loads cleanly, then runs `make test` (the unit tests and every gate, see "Gates," below) |
| `make manual` / `make programmer-manual` / `make historical-manual` | Builds the User Manual / this Programmer's Manual / the Historical Design & Decision Log, each from its own source chapters via pandoc + xelatex |
| `make tutorial-section-user-manual` / `make tutorial-section-user-manual-tui` | The User Manual's Chapter 3 tutorial, standalone — the web edition (real browser screenshots, via `test-e2e-tutorial-browser`) and the TUI edition (real terminal-text transcripts, via `test-e2e-tutorial` + `backend/scripts/capture-tui-transcripts.ts`) — each built to its own PDF |
| `make tutorial-section-user-manual-manufacturing-tui` | Chapter 4's own TUI sibling — the Manufacturing tutorial's own real terminal-text transcripts (via `test-e2e-manufacturing-tutorial` + `backend/scripts/capture-manufacturing-tui-transcripts.ts`), built to its own PDF |
| `make screens-inventory` | Regenerates `docs/screens-inventory.md` from the live frontend route tree |
| `make function-inventory` / `make check-function-inventory` | Regenerates / checks `docs/function-inventory.md` against the live backend source |
| `make servers-status` / `make ensure-servers` / `make stop-servers` | Dev-server lifecycle management, see below |

### Analysis, generation and one-off targets

| Target | What it does |
|---|---|
| `make release` | Refuses while anything is uncommitted; otherwise pushes `main` and writes `dist/sql-ledger-ts-<commit>.zip` of the committed files (`git archive`). |
| `make backend-verbose` | The backend alone, with `DB_VERBOSE=1`. |
| `make test-one TEST=…` | Only the backend tests whose title contains `TEST`. The tests share one database, so a test that fails alone may need the whole file. |
| `make sim-golden` / `make check-sim-unchanged` | Record the simulation's PASS/FAIL lines in `backend/test/golden/simulation-results.txt`, and compare a fresh run against them, before and after a rename. |
| `make load-translations-api` / `make load-translations-ui` | Reset the database and load every translation in `shared-fixtures/translations-steps.csv` through the step runner, on the API path or through the browser. |
| `make add-menu-translations`, `add-journal-translations`, `add-journal-remaining-translations`, `add-header-translations`, `add-brand-translation` | Run the `shared-fixtures/add-*.ts` scripts that add those translations to the current database. |
| `make list-menu-labels` | Lists every menu label (`backend/scripts/list-menu-labels.ts`). |
| `make entity-tree-svg` / `make entity-tree-sample-svg` | Draw the whole entity tree, or a sample of it (`SAMPLE`, `BUSINESS`, `MAXDEPTH`), as SVG with graphviz. |
| `make manual-diagrams` | Render every `docs/diagrams/*.mmd` to SVG with `mmdc`. |
| `make call-graph` | Every exported backend function and how often it is called (`scripts/call-graph.ts`). |
| `make svelte-call-trace` | Which backend calls each screen makes, on load or on interaction (`scripts/svelte-call-trace.ts`). |
| `make role-routes-matrix` | Writes `docs/role-routes-matrix.md` from every role check. |
| `make find-symbols PATTERN=…` | Declarations, SQL objects, screens and manual headings whose name matches. |
| `make find-uses NAMES=a,b` or `PATTERN=…` | How many lines and files reference those names, by area: the reach of a rename. |
| `make explain-function NAME=…` | Every reference the compiler found for one function, behind its function-inventory entry. |
| `make rename-identifiers MAP=renames/….txt` | Applies a rename map by whole-word replacement; refuses a new name that already exists; `DRY=1` previews. |
| `make comment-out-functions FILE=… NAMES=…` | Comments out named unreferenced functions, with a marker pointing at `docs/unused-functions.md`; `DRY=1` previews. |
| `make measure-comments` / `make show-comments FILE=…` | Count code comments per file and how many point at the manual; list one file's comment lines. |
| `make strip-comments FILE=… DOC=…` | Removes a file's whole-line comments once its explanation is in the named chapter, checking the code is unchanged; `DRY=1` previews. |
| `make analyze-classification` | Writes `docs/classification-neutrality-analysis.md`: where the code treats one suggested hierarchy specially. |
| `make analyze-vocabulary` | Writes `docs/naming-vocabulary-analysis.md`: which words the code uses per concept. |
| `make check-node-refs` | Lists every `node` in the Makefile, to catch a script run that ignores `RUNTIME`. |
| `make check-test-docs` | Fails when a test's title is not in the manual (below). |

## Backend and frontend tests

`backend/test/*.test.ts`, run via `node --test` (`npm test` in
`backend/package.json`) — no separate test framework (Jest, Vitest);
Node's own built-in `node:test` module with `node:assert/strict`.
`frontend/test/*.test.ts` (`journalGrid.test.ts`, `entityTree.test.ts`,
`format.test.ts`, …) run the same way via `tsx --test test/*.test.ts`
— plain TypeScript logic tests (formatting, data-shaping helpers), not
rendered-component tests; those are covered live by the step runner's
standalone tests in the browser.

## Browser tests — the step runner, never a spec file

Every test of the running app is a step-runner data file: a tutorial
(`shared-fixtures/*-steps.csv`) or a standalone test
(`shared-fixtures/tests/*.csv`), each building its own business on a
fresh database (*Testing*, "Standalone tests"). In the browser
(`--path ui`) the runner drives Chromium through the `playwright`
library, a dependency of `backend/`; there is no Playwright test
runner, no spec file and no `e2e/` directory, and `check-step-tests`
keeps it so.

When a browser step fails, the runner saves a picture and the page's
text in `/tmp/step-runner-failures/` (*Testing*, "The CLI"): look there
first.

## Testing the terminal frontend — `@microsoft/tui-test`

There is no separate, hand-written test file for the terminal
frontend. `backend/scripts/step-runner.ts`'s
`--path text` drives the real Ink terminal frontend the same way
`--path ui` drives the real browser one above — a genuine
terminal-emulator engine (`@microsoft/tui-test`), not a mock — and,
critically, through the exact same `screens.csv`/`tutorial-steps.csv`
fixture `--path api`/`--path ui` already use: `runStepViaText` is
purely generic, with no per-screen driver code, dispatching only on a
field's `field_type` and on whether `field_selector`/`submit_selector`
are present (never their web-specific values). Run it with `make
test-e2e-tutorial-text`. See `docs/tui-design.md` for the mechanism,
the two real, confirmed gotchas typing text and repeated key presses
into Ink both ran into, and the current, honest limit on how much of
the fixture this reaches today.

## The Wine Retail Business simulation and its companion scripts

`backend/scripts/simulate-wine-retail-month.ts` — the largest script
in this project. Generates one full, detailed month of retail
activity for the bundled Wine Retail Business using a seeded
random-number generator, so the exact same scenario reproduces
identically on every run. `add-wine-retail-budget-and-year.ts` (a
Budget ledger plus 11 more summary months) and
`set-wine-retail-credit-terms.ts` (varied payment terms and credit
limits) extend this same dataset — see the Testing: E2E chapter for
how these fit into `make test-e2e`/`make demo-full-year`.

## Verification scripts

`backend/scripts/verify-simulation.ts` checks the simulation's own
output against exact, documented expected figures (Testing: E2E
chapter). `backend/scripts/verify-db-consistency.ts` runs direct SQL
checks against whatever database currently exists: every
`journal_line` balances to zero, no orphaned foreign-key references,
no negative on-hand stock quantities, no duplicate active entity
names.

Two non-obvious points in its balance checks: "reportable" postable
accounts are the union of two separate entity subtrees — Chart of
Accounts and Customers/Vendors (contact entities are valid AR/AP
posting targets but live under a separate branch, not under Chart of
Accounts). And for quantity-movement entries (posted under Items), only
a *multi-line* entry must balance to zero — a single-line
adjustment/breakage or order-placement entry (e.g. crediting "On
Order" when a PO is placed, before stock has moved) is intentionally
one line on its own and is never expected to balance.

## `backend/schema/` — structural schema

Only two real files remain here today: `00-core.sql` (every table,
view, trigger, and entity-creation statement) and `30-coa-links.sql`
(linking every business to its Chart of Accounts prototype). `db.ts`
loads both, in that order, on every fresh database.

Per-language vocabulary/translations and the German BMW / French
Peugeot/Ditta/Schweizer demo ledger data no longer live in separate
SQL files at all — both moved into TypeScript, seeded unconditionally
on every module load by `seedRemainingData()` (`backend/src/db-seed.ts`,
called from `db.ts`). This also means `seedRemainingData()` is a real
backfill step, not a one-time fresh-db seed: it runs on every import,
so it can genuinely add a few new entities (a since-added vocabulary
word, say) to an *existing*, non-fresh database too — worth knowing
before assuming a database's entity count is frozen between runs.

## This project ships no Python and no stray TypeScript/Playwright loaders

`make check-no-python` fails on any `.py` file, or any build file
that invokes python; part of `make verify-fresh`. All data loading
goes through the step runner (see the Testing: E2E chapter) — no
other `.ts` or raw Playwright script loads data anywhere in this
application.

## Dev-server lifecycle management

`make servers-status` / `make ensure-servers` / `make stop-servers`
give a direct answer to "are the backend/frontend dev servers already
up and healthy" — a pid file per server
(`/tmp/sql-ledger-ts-pids/`), checked against both a live `kill -0`
and a live health check (`curl -sf http://localhost:3001/api/health`
for the backend, a root-page fetch for the frontend), never trusting a
pid file alone. `ensure-servers` starts only whichever server isn't
already healthy, using `setsid nohup ... &` so the started process
survives past the end of the Make recipe's own subshell. Every
screenshot-capture target depends on `ensure-servers` directly, so
running several back to back reuses the same servers instead of
paying a ~10s startup cost each time.

`stop-servers` kills the real process group (`kill -- -$PID`, since
`setsid` makes the spawned process its own session/group leader), with
a `pkill -f "tsx watch src/server.ts"` / `pkill -f "vite dev"`
fallback — killing only the top-level pid would leave `tsx watch`'s
own spawned child `node` process running, orphaned, still bound to the
port.

`make ensure-servers-no-demo` is the same pattern for driving the UI
path against a database with only "My Business" seeded — it checks
the already-running backend's own environment
(`/proc/<pid>/environ`) for `SEED_DEMO_BUSINESSES=false` and, if that
can't be confirmed, stops and restarts the backend rather than risk
running a no-demo test against a wrongly-seeded one.

## Gates: the manual and the code may not differ

`make check-manual` runs every gate below and reports each failure by
name, so one failing gate never hides another. It runs in three places,
so a difference between the Programmer's Manual and the code cannot be
committed, pushed or merged unnoticed:

- at the end of `make test` (and so of `make verify-fresh`);
- before every commit, in `githooks/pre-commit`, which `make install`
  enables (`git config core.hooksPath githooks`);
- on every push and pull request, in `.github/workflows/check.yml`
  (`make install`, `make test`, `make test-storage-engine`).

None of them has a baseline or an exception list: each gate passes only
when the manual and the code agree.

| Gate | What it enforces |
|---|---|
| `check-docs-coverage` | Every exported backend function and constant, Makefile target and frontend route is described in the manual. A name that occurs only in a generated section (the function inventory, the screens inventory) or only in a test title does not count. |
| `check-docs-staleness` | Everything the manual names exists. A file path with a directory names a real file (the whole path, or its tail); an HTTP route is one of the backend's mounts or a storage engine route; every code-shaped name in backticks (camelCase, PascalCase, snake_case) occurs in some tracked source file outside its comments. |
| `check-test-docs` | Every test is listed in the manual: the TypeScript unit tests, the storage engine's Gleam tests (by function name) and the step runner's standalone tests (by file name). Every test the manual lists as `- "title" (`file`)` exists in that file. |
| `check-function-inventory` | `docs/function-inventory.md` matches the code (`make function-inventory` regenerates it). |
| `check-cycles` | The backend's import cycles are exactly the ones listed under "Import cycles" below. |
| `check-schema-table-count` | No table but the four permanent ones and `journal_entry_staging` (see "The four permanent tables" below). |
| `check-journal-staging-only` | Only `db-journal.ts` and `core/store.ts` write `journal` and `journal_line`. |
| `check-unused` | `noUnusedLocals` (`TS6133` only) over `backend/src/`, `backend/test/` and the step runner, via `backend/tsconfig.unused.json`. A name prefixed `_` is exempt by TypeScript design. |
| `check-no-python` | No `.py` file, and no build file that invokes python. |
| `check-step-tests` | No Playwright spec (`*.spec.ts`) and no use of `@playwright/test`; every page of the app is opened by `shared-fixtures/tests/every-page-opens.csv`, and every page it opens exists (`scripts/check-step-tests.ts`; it runs `make generate` first, as some pages are generated). |
| `check-manual-pictures` | Every picture a chapter shows is taken by a test or tutorial's screenshot column (`scripts/manual-pictures.ts check`). |

Other checks, not part of `check-manual`:

| Check | What it does |
|---|---|
| `check-backend-types` | `tsc --noEmit` against `backend/src` and `../shared-fixtures`. |
| `check-frontend` | `svelte-check` across every `.svelte` file. |
| `check-db-consistency` | See above. |

⚠️ Not covered by any gate: `backend/scripts/` (other than the step
runner) is not type-checked, and `tsc` reports type errors in 31 of its
scripts (one, `tag-coa-prototypes.ts`, imports a function `db.ts` no
longer exports). `backend/test/` is type-checked only for unused names.

## The four permanent tables

The database has four permanent tables, `entities`, `account`,
`journal` and `journal_line`, and one staging table,
`journal_entry_staging` (*The Journal API*, "Staging"). Everything else
is an entity, an attribute fact or a relation, read through views:

- Contact, location and item fields are attribute facts, one child
  entity per field, written by `mergeContactDetail` (`db.ts`) and read
  through the `contact` view (*Core Domain Reference*, "Contact field
  storage").
- The database version is the `Database Version` attribute of
  `Application`: `DB_VERSION` (`db.ts`) is set the first time a
  database starts without one, and `getDbVersion()` reads it for
  `GET /api/health`.
- The Kaappi and memory entity drivers keep their op log in
  `kaappi_wal`, which each driver creates when it is selected
  (`drivers/kaappi-worker.ts`, `drivers/memory-entity-driver.ts`); the
  default `sql` driver never creates it.

`make check-schema-table-count` reads every `CREATE TABLE` in the
tracked SQL, Gleam and backend TypeScript (the backend schema, the core
middleware's `core/store.ts`, and the storage engine's two schemas) and
fails on any other table, or on `kaappi_wal` created anywhere but those
two drivers.

## Multi-Runtime Support (bun / node / deno)

This project runs identically under all three runtimes, switched by a
single Makefile variable:

```
make test                  # RUNTIME defaults to bun
make test RUNTIME=node
make test RUNTIME=deno
make dev RUNTIME=node
```

```makefile
RUNTIME ?= bun   # override on the command line, or `export RUNTIME=node` first

ifeq ($(RUNTIME),bun)
  RUN_INSTALL    := bun install
  RUN_SCRIPT     := bun
  RUN_NPM_SCRIPT := bun run
  RUN_BINARY     := bun x
  RUN_TEST       := bun test
else ifeq ($(RUNTIME),node)
  RUN_INSTALL    := npm install
  RUN_SCRIPT     := npx tsx
  RUN_NPM_SCRIPT := npm run
  RUN_BINARY     := npx
  RUN_TEST       := npx tsx --test
else ifeq ($(RUNTIME),deno)
  RUN_INSTALL    := deno install --allow-scripts
  RUN_SCRIPT     := deno run -A --no-check
  RUN_NPM_SCRIPT := deno task
  RUN_BINARY     := deno run -A --no-check npm:
  RUN_TEST       := deno test -A --no-check
endif
```

Every Makefile target that runs a script, an installed binary, or a
package.json script goes through one of these derived variables —
never a hardcoded `bun`/`npm`/`deno` command anywhere else in the
file.

### What actually differs between the three runtimes

Two things — everything else (Express, SvelteKit, Vite, Playwright) is
already runtime-agnostic.

**1. The SQLite driver — `backend/src/sqlite-runtime.ts`.** `bun:sqlite`
is bun-only; Node and Deno both use `better-sqlite3` instead (Deno via
its own npm compatibility, `npm:better-sqlite3`) — chosen over Node's
built-in `node:sqlite`, which still carries an experimental-feature
warning and has confirmed behavioral differences (`node:sqlite`
throws on an unused named parameter; `better-sqlite3` silently ignores
it). Every file imports `Database` from `sqlite-runtime.ts`, never
from `bun:sqlite`/`better-sqlite3` directly; the adapter detects the
runtime (`typeof globalThis.Bun !== 'undefined'`) and re-exports the
right class. Two bridged API differences: the exported class is named
`Database` in bun, `DatabaseSync` in node (aliased to one `Database`
export); `better-sqlite3` already provides a native `.transaction()`
method with the same semantics as `bun:sqlite`'s `db.transaction(fn)()`
pattern, so no adapter method was needed for it.

**2. The test framework — `backend/test/test-runtime.ts`.** `bun:test`
is bun-only; Node's built-in `node:test` (stable since Node 18)
provides the same `test`/`before`/`after` shape, and Deno 2.x's Node
compatibility layer supports `node:test` directly too.

### Confirmed results across all three runtimes

Each runtime run directly against the full backend test suite (as of
this measurement, 173 tests): bun 172/173 (one pre-existing,
bun-specific timeout on a `languages`/`localized_text` test — passes
cleanly under both other runtimes, confirming it's a bun-specific
quirk, not an introduced bug); node 173/173; deno 173/173.

**Deno type-checks by default** (`deno test`/`deno task`/`deno run`),
and flags a large number of pre-existing type mismatches in this
codebase's deliberately-terse test call sites (plain number literals
passed where a branded type like `UserId` is expected). This project's
own `check-backend-types` gate already covers real type-checking, so
every Deno invocation uses `--no-check`. `deno task` triggers this
same type-checking even for a task whose command string doesn't invoke
Deno's own tooling — so the `test` Makefile target calls `$(RUN_TEST)`
directly, bypassing `$(RUN_NPM_SCRIPT)`, to avoid re-triggering it.

**Deno/Playwright**: `deno run`'s own Node-compatibility layer reports
an unrealistic `process.version` that Playwright's version-detection
logic rejects outright — a confirmed, open, external Deno/Playwright
incompatibility, not fixable from this codebase; Playwright-driven
targets simply don't run under `RUNTIME=deno`.

### What was deliberately left alone

Express (`app.listen()`), SvelteKit, Vite, and Playwright are already
runtime-agnostic — no changes needed in `server.ts`, the frontend, or
the e2e suite. `RUN_TEST` is defined for all three runtimes but used
only by the top-level `test` target directly, for the `deno task`
reason above.
### Import cycles

`make check-cycles` (`scripts/check-cycles.ts`) finds every group of
backend files that import each other in a ring (`import type` is left
out, since it is erased at run time). The groups below are the ones
there are; the check fails on a group not listed here, and on a listed
group that is no longer a cycle.

The first group is the domain modules and the entity drivers: `db.ts`
imports the domain modules it re-exports, and they import `db.ts` and
`primitives.ts` back. The second is the call dispatcher:
`call-dispatch.ts` merges every `call-dispatch/*.ts` table, and each
table imports `row`, `table` and the role checks from it.

- `backend/src/db-journal.ts`, `backend/src/db-projects.ts`, `backend/src/db-prototypes.ts`, `backend/src/db-quotations.ts`, `backend/src/db-reports.ts`, `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/db.ts`, `backend/src/drivers/gleam-entity-driver.ts`, `backend/src/drivers/memory-entity-driver.ts`, `backend/src/drivers/sql-entity-driver.ts`, `backend/src/entity-driver-select.ts`, `backend/src/primitives.ts`
- `backend/src/call-dispatch.ts`, `backend/src/call-dispatch/arap.ts`, `backend/src/call-dispatch/auth.ts`, `backend/src/call-dispatch/businesses.ts`, `backend/src/call-dispatch/contacts.ts`, `backend/src/call-dispatch/customer-registration.ts`, `backend/src/call-dispatch/departments.ts`, `backend/src/call-dispatch/entities.ts`, `backend/src/call-dispatch/hierarchy.ts`, `backend/src/call-dispatch/i18n.ts`, `backend/src/call-dispatch/invoices.ts`, `backend/src/call-dispatch/items.ts`, `backend/src/call-dispatch/journal.ts`, `backend/src/call-dispatch/locations.ts`, `backend/src/call-dispatch/matrix-reports.ts`, `backend/src/call-dispatch/menu.ts`, `backend/src/call-dispatch/period.ts`, `backend/src/call-dispatch/plant.ts`, `backend/src/call-dispatch/pos.ts`, `backend/src/call-dispatch/products.ts`, `backend/src/call-dispatch/projects.ts`, `backend/src/call-dispatch/prototypes.ts`, `backend/src/call-dispatch/quotations.ts`, `backend/src/call-dispatch/reports.ts`, `backend/src/call-dispatch/stock-lots.ts`, `backend/src/call-dispatch/stock.ts`
