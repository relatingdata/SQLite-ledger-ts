# Build, Run & Tooling

## The Makefile — the single entry point for everyday work

| Target | What it does |
|---|---|
| `make install` | Installs every workspace's packages (`$(RUN_INSTALL)`) and enables the commit hook (`git config core.hooksPath githooks`) |
| `make clean` | Removes `node_modules`, the lockfiles, `frontend/.svelte-kit`, the built PDFs and the assembled manuals |
| `make dev` | Starts backend (`:3001`) and frontend (`:5173`) together, one `Ctrl+C` stops both |
| `make dev-verbose` | The same, with `DB_VERBOSE=1` — every SQL statement the backend executes is printed live |
| `make web-frontend` / `make frontend` | The browser (SvelteKit) frontend alone |
| `make text-frontend` | The terminal UI (`tui/`, on sveltui), built and run in the current terminal, so not part of `dev`. It currently stops at start-up (*Testing: The Test-Runner*, "`--path text` — driving the terminal UI"). |
| `make test` | `make test-unit`, the standalone tests on the API path (`make test-steps`), then `make check-manual` ("Gates", below) |
| `make test-unit` | The unit tests in five levels, `test-unit-frontend`, `test-unit-store`, `test-unit-core`, `test-unit-backend` and `test-unit-calls`, each depending on the one before (*Testing: Unit*, "Levels") |
| `make test-steps` / `make test-steps-browser` | The standalone tests in `shared-fixtures/tests/`, on the API path or in the browser, each on a fresh database (`scripts/run-step-tests.ts`; `TEST=a,b` runs only those) — see the Testing: E2E chapter, "Standalone tests" |
| `make test-e2e` / `make demo-full-year` | Full/volume simulation and full-year data generation — see the Testing: E2E chapter |
| `make test-e2e-tutorials` | The Retail, Manufacturing and Project Builder fixtures on the API path. `MIDDLEWARE=core` (the default) sends every step through the core middleware's frontend API in-process; `MIDDLEWARE=legacy` runs them on the original middleware. See "The Core Middleware" |
| `make test-e2e-tutorials-http` | The same three fixtures on the core, over real HTTP: starts the backend with `MIDDLEWARE=core` on `CORE_HTTP_PORT` (default 3101), runs the step runner with `STEP_RUNNER_API_URL`, stops the server |
| `make test-storage-engine` / `make storage-engine-deps` | The Gleam storage engine's own suite (`storage_engine/`); its dependencies are first cloned at pinned commits into `storage_engine/deps/` by `storage_engine/fetch_deps.sh` |
| `make test-e2e-tutorial-text` | Builds the terminal UI and runs the tutorial's first step through it (*Testing: The Test-Runner*, "`--path text` — driving the terminal UI") |
| `make check-db-consistency` | The consistency check alone, on whatever database currently exists — balanced entries, no orphaned references, referential integrity |
| `make reset-db` | Stops a running backend and storage engine, copies `backend/data/entities.sqlite` to `backend/data/archive/`, deletes it and `backend/data/core.sqlite`, and builds a new one from `backend/schema/` (`scripts/bootstrap-schema.ts`); the core middleware's database installs itself on first open |
| `make verify-fresh` | `reset-db`, then `scripts/sanity-check-db-loads.ts`, then `make test` |
| `make manual` / `make programmer-manual` / `make historical-manual` | Builds the User Manual / this Programmer's Manual / the Historical Design & Decision Log, each from its own source chapters via pandoc + xelatex |
| `make tutorial-section-user-manual` | The User Manual's Chapter 3 alone, as a PDF, with screenshots from `test-e2e-tutorial-browser` |
| `make tutorial-section-user-manual-tui` / `make tutorial-section-user-manual-manufacturing-tui` | Chapters 3 and 4 as terminal transcripts, as PDFs: the API-path tutorial, then `backend/scripts/capture-tui-transcripts.ts` or `capture-manufacturing-tui-transcripts.ts` driving the built terminal UI. They fail while the terminal UI does not start |
| `make screens-inventory` | Regenerates `docs/screens-inventory.md` from the live frontend route tree |
| `make function-inventory` / `make check-function-inventory` | Regenerates / checks `docs/function-inventory.md` against the live backend source |
| `make servers-status` / `make ensure-servers` / `make stop-servers` | Dev-server lifecycle management, see below |

### Analysis, generation and one-off targets

| Target | What it does |
|---|---|
| `make untrack FILE=…` | Stops git tracking a file that should have been ignored, keeps it on disk, and commits that. |
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

`backend/test/*.test.ts` and `frontend/test/*.test.ts` use Node's
`node:test` and `node:assert/strict`, run by `$(RUN_TEST)` (`npx tsx
--test` by default). The frontend tests check plain TypeScript (the
journal grid, the entity tree, formatting), not rendered components;
the pages are tested by the step runner in the browser.

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

## Testing the terminal frontend

The step runner's `--path text` drives the terminal UI through
`@microsoft/tui-test`, with the same fixtures as the other paths
(*Testing: The Test-Runner*, "`--path text` — driving the terminal
UI"). `docs/tui-design.md` describes the terminal UI.

## The Wine Retail Business simulation and its companion scripts

`backend/scripts/simulate-wine-retail-month.ts` creates Wine Retail
Business and trades for one month, from a seeded random-number
generator, so every run is the same. `add-wine-retail-budget-and-year.ts`
(a Budget ledger and 11 more summary months) and
`set-wine-retail-credit-terms.ts` (payment terms and credit limits)
extend it for `make demo-full-year` (*Testing: The Test-Runner*).

## Verification scripts

`backend/scripts/verify-simulation.ts` checks the simulation's own
output against exact, documented expected figures (Testing: E2E
chapter). `backend/scripts/verify-db-consistency.ts` runs direct SQL
checks against the current database: every financial entry balances
to zero, every active ledger's Trial Balance and Balance Sheet
balance, no orphaned entities, no duplicate sibling names, no
`journal_line` or Levels link to a missing entity, and no negative
quantity on hand.

Two non-obvious points in its balance checks: "reportable" postable
accounts are the union of two separate entity subtrees — Chart of
Accounts and Customers/Vendors (contact entities are valid AR/AP
posting targets but live under a separate branch, not under Chart of
Accounts). For quantity-movement entries (posted under Items), only
a *multi-line* entry must balance to zero — a single-line
adjustment/breakage or order-placement entry (e.g. crediting "On
Order" when a PO is placed, before stock has moved) is intentionally
one line on its own and is never expected to balance.

## `backend/schema/` — structural schema

Two files: `00-core.sql` (every table, view and trigger, and the
structural entities) and `30-coa-links.sql`, which relates the English
chart's leaves and the `Cash Sale` customer to the `English CoA`
prototype. `db.ts` runs both, in that order, when a
database has no `entities` table.

`seedRemainingData()` (`backend/src/db-seed.ts`, called from `db.ts`)
then seeds the vocabulary and its translations, the menu and the
business-type scaffolding. A new database has no business: the
administrator creates the first from the session screen (*Frontend
Reference*, the session picker). It runs on every load, not only on a new database, so it can
add an entity that was added to the seed since (a new vocabulary word)
to an existing database.

## This project ships no Python and no stray TypeScript/Playwright loaders

`make check-no-python` fails on any `.py` file, or any build file
that invokes python; part of `make verify-fresh`. All data loading
goes through the step runner (see the Testing: E2E chapter) — no
other `.ts` or raw Playwright script loads data anywhere in this
application.

## Dev-server lifecycle management

`make servers-status`, `make ensure-servers` and `make stop-servers`
keep one pid file a server (`/tmp/sql-ledger-ts-pids/`). A server
counts as up when its pid is alive (`kill -0`) and it answers (`curl
-sf http://localhost:3001/api/health` for the backend, the root page
for the frontend). `ensure-servers` starts only the servers that are
not up, with `setsid nohup … &` so they outlive the recipe; the
screenshot targets depend on it, so consecutive runs reuse the servers.

`stop-servers` kills each server's process group (`kill -- -$PID`;
`setsid` made it a group leader), so `tsx watch`'s child `node`
process goes too, then falls back to `scripts/safe-pkill.sh "tsx watch
src/server.ts"` and `"vite dev"`, which never match the recipe's own
shell.

## Gates: the manual and the code may not differ

`make check-manual` runs every gate below and reports each failure by
name, so one failing gate never hides another. It runs in three places,
so a difference between the Programmer's Manual and the code cannot be
committed, pushed or merged unnoticed:

- at the end of `make test` (and so of `make verify-fresh`);
- before every commit, in `githooks/pre-commit`, which `make install`
  enables (`git config core.hooksPath githooks`);
- on every push and pull request, in `.github/workflows/check.yml`
  (`make install`, `make test`, `make test-storage-engine`, and
  `make test-e2e`, the simulation checked against its exact figures,
  *Testing: E2E*).

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
| `check-translations` | Every menu, screen and frontend text has a translation in every language, English included (*Translations*). |
| `check-unit-levels` | Every unit test file is in exactly one level of `make test-unit` (`scripts/check-unit-levels.ts`). |
| `check-backend-types` | `backend/src`, `shared-fixtures` and every script in `backend/scripts` type-check (`tsc --noEmit`, then `tsc -p backend/tsconfig.scripts.json`, which also allows `.ts` import paths as tsx does). A script that imports or calls something `db.ts` no longer has fails here. |

Other checks, not part of `check-manual`:

| Check | What it does |
|---|---|
| `check-frontend` | `svelte-check` across every `.svelte` file. |
| `check-db-consistency` | See above. |

`backend/test/` is type-checked only for unused names (`check-unused`).

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

`RUNTIME` (default `node`) picks the commands every target uses:

```
make test                  # node
make test RUNTIME=bun
make test RUNTIME=deno
```

| | `RUN_INSTALL` | `RUN_SCRIPT` | `RUN_NPM_SCRIPT` | `RUN_BINARY` | `RUN_TEST` |
|---|---|---|---|---|---|
| node | `npm install` | `npx tsx` | `npm run` | `npx` | `npx tsx --test` |
| bun | `bun install` | `bun` | `bun run` | `bun x` | `bun test --timeout 20000` |
| deno | `deno install --allow-scripts` | `deno run -A --no-check` | `deno task` | `scripts/deno-run-bin.sh` | `deno test -A --no-check` |

A target runs a script, a binary or a package script only through these
variables. The exception is the terminal UI, which runs on bun
whatever `RUNTIME` is (`tui/package.json`).

Two modules hide the differences:

- **`backend/src/sqlite-runtime.ts`** exports `Database`: `bun:sqlite`
  under bun, `better-sqlite3` under node and deno. `better-sqlite3`'s
  `.transaction()` behaves as `bun:sqlite`'s, so no adapter is needed
  for it.
- **`backend/test/test-runtime.ts`** gives the tests `test`, `before`
  and `after`: `node:test` under node and deno, `bun:test` under bun.

Under bun, the backend tests get a 20-second timeout, since some
report tests run longer than bun's default 5 seconds. Under deno,
every command passes `--no-check`: `check-backend-types` is the type
check, and deno's own would reject the tests' bare number literals
where a branded type is expected. `make test` calls `$(RUN_TEST)`
directly rather than through `deno task`, which type-checks too.
`scripts/deno-run-bin.sh` finds a package's binary in `node_modules`
for `RUN_BINARY`, because `deno run npm:<pkg>` needs the name as one
token. Playwright does not run under deno (it rejects deno's
`process.version`), so the browser targets need `RUNTIME=node` or
`bun`.

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
