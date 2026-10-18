# Build, Run & Tooling

## The Makefile — the single entry point for everyday work

| Target | What it does |
|---|---|
| `make install` | Fresh install for both backend and frontend — always removes `node_modules`/lockfiles first (a recurring `ERESOLVE` conflict from a stale install) |
| `make dev` | Starts backend (`:3001`) and frontend (`:5173`) together, one `Ctrl+C` stops both |
| `make dev-verbose` | The same, with `DB_VERBOSE=1` — every SQL statement the backend executes is printed live |
| `make dev-no-demo` | The same, with `SEED_DEMO_BUSINESSES=false` — only the one, dummy "My Business," no Wine Retail/BMW/Peugeot/Ditta/Schweizer demo data |
| `make test` | Backend unit tests (Node's built-in test runner) + frontend tests — see the Testing: Unit chapter |
| `make test-e2e` / `make demo-full-year` | Full/volume simulation and full-year data generation — see the Testing: E2E chapter |
| `make check-db-consistency` | The consistency check alone, on whatever database currently exists — balanced entries, no orphaned references, referential integrity |
| `make reset-db` | Deletes the SQLite database file; it reinitializes from `backend/schema/*.sql` on the next backend start |
| `make verify-fresh` | Resets the database, confirms it loads cleanly, then runs the full backend test suite plus every mechanical gate (see "Gates," below) |
| `make manual` / `make programmer-manual` / `make historical-manual` | Builds the User Manual / this Programmer's Manual / the Historical Design & Decision Log, each from its own source chapters via pandoc + xelatex |
| `make screens-inventory` | Regenerates `docs/screens-inventory.md` from the live frontend route tree |
| `make function-inventory` / `make check-function-inventory` | Regenerates / checks `docs/function-inventory.md` against the live backend source |
| `make servers-status` / `make ensure-servers` / `make stop-servers` | Dev-server lifecycle management, see below |

## Backend and frontend tests

`backend/test/*.test.ts`, run via `node --test` (`npm test` in
`backend/package.json`) — no separate test framework (Jest, Vitest);
Node's own built-in `node:test` module with `node:assert/strict`.
`frontend/test/*.test.ts` (`journalGrid.test.ts`, `entityTree.test.ts`,
`format.test.ts`, …) run the same way via `tsx --test test/*.test.ts`
— plain TypeScript logic tests (formatting, data-shaping helpers), not
rendered-component tests; those are covered live via Playwright.

## Playwright — live, end-to-end browser testing

`e2e/tests/*.spec.ts`, run via `npx playwright test` from `e2e/`.
`playwright.config.ts`'s `reuseExistingServer: !process.env.CI` means,
outside CI, every spec file run together shares the same live SQLite
database and its accumulating state — a test that assumes an entity
created by an earlier file already exists has a real test-order
dependency (distinguishable from an application bug by re-running the
same test in isolation against a freshly-reset database: if it now
passes, the dependency was real).

A reliable debugging technique: a small, throwaway `debug_*.spec.ts`
file, deleted immediately after use, with `console.log` between every
step and `page.on('console'/'requestfinished', ...)` handlers attached
— isolates exactly which step a hang or failure occurs at and what the
live network traffic looked like at that moment.

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

## `backend/schema/` — structural schema and seed data

Split into `00-core.sql` (every table, view, trigger, and
entity-creation statement), `10-vocab-{language}.sql` (one file per
supported language's translations), `20-demo-bmw-peugeot.sql` (the
German BMW / French Peugeot/Ditta/Schweizer demo ledger data), and
`30-coa-links.sql` (linking every business to its Chart of Accounts
prototype — depends on entities from both core and the demo block, so
it loads last). `db.ts` loads these, concatenated, in this exact,
dependency-safe order.

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

## Gates: `make verify-fresh` and the mechanical checks

`verify-fresh` runs its independent, mechanical gates in a loop,
reporting each failure by name, rather than stopping at the first
failing line — so one known-red gate never silently hides every gate
wired in after it.

| Gate | What it enforces |
|---|---|
| `check-backend-types` | `tsc --noEmit` against `backend/src` and `../shared-fixtures` only — does **not** cover `backend/test/` or `backend/scripts/`, which only ever run through `tsx` (types stripped, never checked) |
| `check-unused` | `noUnusedLocals` (`TS6133` only) over `backend/src/`, `backend/test/`, and the step runner, via `backend/tsconfig.unused.json` — deliberately separate from `check-backend-types`, which is red from older, unrelated errors and can't gate anything while it stays red. A name prefixed `_` is exempt by TypeScript design and never reported by this gate. |
| `check-e2e-types` | The same `tsc --noEmit` check, against the Playwright suite |
| `check-frontend` | `svelte-check` across every `.svelte` file |
| `check-schema-table-count` | A pure, mechanical count of every `CREATE TABLE` across every `.sql` file in the project — fails unless the permanent (non-staging) count is exactly 4, matching `entities`, `account`, `journal`, `journal_line` by name. Staging tables are counted and reported separately. Unbypassable, wired into `verify-fresh`. |
| `check-no-python` | No `.py` file, and no build file that invokes python |
| `check-docs-coverage` | Rebuilds the Programmer's Manual, then checks every tracked name is genuinely documented |
| `check-db-consistency` | See above |

A fact worth holding onto precisely because it is not visible from any
currently-green gate: `backend/test/` and `backend/scripts/` are not
type-checked by anything in CI today. `scripts/` (other than the step
runner) still carries a meaningful number of unused declarations and
type errors, none currently gated.

## `mergeContactDetail` and the four-permanent-table rule

The `contact` table (a true 1:1 entity extension) was eliminated as
its own table — every field now lives in the parent entity's own
`detail_json` (the same pattern already proven for
`item_source`/`stock_lot`). `mergeContactDetail`
(`backend/src/db.ts`) is the one exported helper every write path
(`setContact`, `recordReminderSent`, `resetReminderLevel`,
`setPosPin`, `registerCustomer`, `verifyCustomer`, `setItem`,
`setLocation`, and a UPC-backfill site in `db-seed.ts`) uses to
read-merge-write into `detail_json`, replicating the removed table's
own "partial upsert, only touch the given fields" semantics exactly. A
read-compatibility view (`contact`, in `backend/schema/00-core.sql`)
recomputes the exact same column shape via `json_extract`, so every
existing read query against "contact" keeps working unchanged. This is
what keeps the permanent-table count at exactly four — see
`check-schema-table-count` above, and "no dedicated table" in the
Entity Model chapter for the general principle this follows.

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