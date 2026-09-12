# Tooling and scripting — a real, honest guide for anyone working on this codebase

Per direct request: a description of the real tooling and scripting
this project actually uses — the day-to-day commands, what each one
genuinely does, and where to look for more detail on any one piece.
This is a companion to `backend/scripts/README.md` (which covers only
the seed-data generation scripts specifically) and
`docs/orm-and-commit-path.md`/`docs/svelte-usage.md` (which cover the
application's own, real architecture) — this document covers the real
tools used to build, test, and verify the application itself.

## 1. The Makefile — the real, single entry point for everyday work

Every real, common task runs through `make`, from the project root:

Table: Every real Makefile target and what it actually does

| Target | What it actually does |
|---|---|
| `make install` | Fresh install for both backend and frontend — always removes `node_modules`/lockfiles first (see the Makefile's own comment for why: a real, recurring `ERESOLVE` conflict from a stale install, not a hypothetical one) |
| `make dev` | Starts backend (`:3001`) and frontend (`:5173`) together, one `Ctrl+C` stops both |
| `make dev-verbose` | The same, with `DB_VERBOSE=1` — every real SQL statement the backend executes is printed live |
| `make test` | Runs the backend's own unit tests (Node's built-in test runner) and the frontend's own tests |
| `make test-e2e` | Resets the database, runs the real Wine Retail Company simulation (a seeded PRNG — never `Math.random()`, so it produces the exact, same numbers every real run), then checks the result against exact, documented expected figures |
| `make demo-full-year` | The fuller, real dataset — one detailed month plus a real Budget and 11 more summary-level Actual months, so a full year's Budget-vs-Actual comparison genuinely exists to explore. A real, separate target from `test-e2e`, since it changes the exact figures `test-e2e`'s own checks depend on |
| `make check-db-consistency` | Just the consistency check on whatever database currently exists — balanced entries, no orphaned references, referential integrity |
| `make reset-db` | Deletes the SQLite database file; it reinitializes from `backend/schema/*.sql` on the next backend start |

## 2. Backend tests — Node's own, built-in test runner

`backend/test/*.test.ts`, run via `node --test` (wired up as `npm test`
in `backend/package.json`). No separate test framework (Jest, Vitest,
etc.) — Node's own, built-in `node:test` module, with `node:assert/strict`
for assertions. As of this writing, 161 real, individual tests, each
one directly exercising real application logic against a real, live,
in-memory SQLite database — not mocked.

## 3. Frontend tests

`frontend/test/*.test.ts` (e.g. `journalGrid.test.ts`,
`entityTree.test.ts`, `format.test.ts`), run the exact, same, real
way as the backend's own tests — Node's built-in test runner, via
`tsx --test test/*.test.ts` (wired up as `npm test` in
`frontend/package.json`) — genuine, plain TypeScript logic tests
(formatting, data-shaping helpers), not real, rendered-component
tests; those are covered live instead, via Playwright (below).

## 4. Playwright — real, live, end-to-end browser testing

`e2e/tests/*.spec.ts`, run via `npx playwright test` from the `e2e/`
directory (not wired into the Makefile directly — used throughout
this project's own development, ad hoc, to verify a real, specific
change actually works in a real, live browser, against the real,
running backend and frontend together, not just checked by reading
code). This is the real, primary way any UI change in this project
gets verified before being trusted — a clean compile or a passing
unit test is necessary but not sufficient; several real, genuine bugs
this project's own history recorded (see individual commit messages)
were only ever caught by actually driving a real browser against the
real, running application and looking at what it did.

### Real, practical findings from extensive, hands-on use

**`reuseExistingServer` means one, real, shared database across every
test file in a run.** `playwright.config.ts`'s own
`reuseExistingServer: !process.env.CI` means, outside CI, Playwright
reuses whatever backend/frontend is already running rather than
starting its own — so every real `*.spec.ts` file executed together
shares the exact, same, real, live SQLite database and its own,
accumulating state. A test that assumes a real entity created by an
earlier, real test file (alphabetically or otherwise) already exists
is a genuine, real test-order dependency, not a bug in the
application itself — several were found and fixed this way,
distinguishable from a real application bug by re-running the exact,
same test in isolation against a freshly-reset database: if it now
passes, the dependency was real; if it still fails identically, the
bug is real too.

**Server cold-start needs a real, generous wait before the first
test.** Killing and restarting the backend/frontend, then launching
Playwright immediately, produced real, transient failures (a login
button click, or even the login page's own render, genuinely timing
out) that vanished entirely once a longer, deliberate pause (around
ten real seconds) was given after each server's own start before
running any test against it — indistinguishable, from the test
output alone, from a genuine, live bug, until isolated by waiting
longer and re-running.

**A real, reproducible, still-open discrepancy worth documenting
plainly**: the exact, same UI sequence (create a location, fill its
own shelf capacity, save) passed reliably, repeatedly, in isolation
against the bundled Wine Retail Company, but hung — not slowly, but
genuinely, indefinitely, past even Playwright's own internal timeout
— every time it was run as part of a longer script that first created
a brand-new business and switched the live session into it. This was
never root-caused before this manual's own most recent edit; whoever
investigates it next should start by inspecting the actual network
request/response at the exact hang point (a debug `page.on(
'requestfinished', ...)` handler, the same, real technique that
successfully diagnosed several other, similar issues this project's
own history recorded — see `db.ts`'s own `createDivision`/`'Profit
Center'` casing bug, found exactly this way), since the backend
process itself was confirmed alive and responsive to unrelated
requests throughout every one of these hangs.

**Debugging technique that reliably worked**: a small, throwaway
`debug_*.spec.ts` file, deleted immediately after use, with explicit
`console.log` calls between every real step and a `page.on('console',
...)`/`page.on('requestfinished', ...)` handler attached — isolates
exactly which real step a hang or failure occurs at, and what the
real, live network traffic looked like at that moment, far faster
than staring at a full script's own combined failure.

## 5. The Wine Retail Company simulation

`backend/scripts/simulate-wine-retail-month.ts` — the real, single
largest script in this project (over 32,000 bytes). Generates one
full, real, detailed month of retail activity for the bundled
example business (Wine Retail Company): real POS sales, real
purchases, real stock receipts and dispatches, real COGS recognition,
all using a seeded random-number generator so the exact, same
scenario reproduces identically on every real run — never
`Math.random()`. This is the real, live data behind almost every
screenshot and every manual verification pass throughout this
project's own development.

Two, real, companion scripts extend this same, real dataset:
`add-wine-retail-budget-and-year.ts` (a real Budget ledger, plus 11
more summary months either side of the detailed one) and
`set-wine-retail-credit-terms.ts` (varied, real payment terms and
credit limits across the example business's own customers/vendors).

## 6. Verification scripts

`backend/scripts/verify-simulation.ts` checks the simulation's own,
real output against exact, documented expected figures (see
`docs/testing.md`) — a real regression in a posting path, year-end
close, or a report silently excluding real accounts fails loudly here.

`backend/scripts/verify-db-consistency.ts` runs real, direct SQL
checks against whatever database currently exists: every real
`journal_line` balances to zero, no orphaned foreign-key references,
no negative on-hand stock quantities (a real, physical
impossibility), no duplicate active entity names (the real, enforced
global-uniqueness rule).

## 7. Seed-data generation scripts

`backend/scripts/generate-*.py` and a handful of `.ts` equivalents —
already documented in detail in `backend/scripts/README.md`, which
this document defers to rather than duplicates. In short: these
scripts produced the SQL now baked directly into
`backend/schema/*.sql` (see below) — kept in the repository for
provenance and auditability, not run as part of normal development.

## 8. `backend/schema/` — the real, structural schema and seed data

Originally one file (`schema.sql`, 4,886 lines); split into real,
separate files per direct request — `00-core.sql` (every real table,
view, trigger, and entity-creation statement), `10-vocab-{language}.sql`
(one real file per supported language's own translations),
`20-demo-bmw-peugeot.sql` (the German BMW / French Peugeot demo
ledger data), and `30-coa-links.sql` (linking every real business to
its own real Chart of Accounts family — genuinely depends on entities
from both core and the demo block, so it loads last). `db.ts` loads
these, concatenated, in this exact, dependency-safe order — see the
comment directly above that code, and the commit message for
`backend/scripts/split-schema-historical.py`, for the real, genuine
dependency issue this split's own verification found and fixed before
being trusted.

## 9. `backend/scripts/prototype-*.ts`

Real, exploratory scripts from earlier design work — multi-currency
handling, gross-vs-net P&L, typed contacts, category mirroring,
relationship types. Not run as part of any current workflow; kept for
the same, real reason the `generate-*` scripts are — a real, honest
record of design work actually done, not thrown away once its
conclusions were absorbed into the main application.

## 10. Other real, direct tooling used across this project

- **`better-sqlite3`** — the real, direct, synchronous SQLite driver
  the entire backend is built on; see `docs/orm-and-commit-path.md`
  for why there's no ORM layered on top of it.
- **Playwright** (`@playwright/test`) — both for the `e2e/` suite
  above, and for capturing real, live screenshots used throughout
  this project's own documentation (the User Manual among them) —
  never a mocked-up or hand-drawn interface.
- **pandoc + LaTeX** (`pdflatex`/`xelatex`) — used to build the User
  Manual PDF from its own, single, real Markdown source
  (`docs/user-manual.md`); see the manual-build documentation for the
  real, direct reasoning behind this choice over a hand-written LaTeX
  document or a more limited PDF-generation library.
