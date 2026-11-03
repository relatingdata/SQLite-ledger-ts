# sql-ledger-ts

A double-entry ledger application over a deliberately minimal SQLite
schema: **one entities table** carrying the entire structural tree
(businesses, accounts, locations, items, vocabulary, users —
everything), plus small, typed extension tables (`account`,
`translation`, a journal/journal_line/staging trio for postings) for
the data that doesn't fit the tree shape. See
`backend/schema/00-core.sql` (the 15 core tables, each decision
explained in comments next to the SQL it applies to) and
`backend/schema/30-coa-links.sql` (the Chart-of-Accounts linking
views) for the full design notes.

**New to this app?** See [`USER_GUIDE.md`](./USER_GUIDE.md) — a
walkthrough for actually using it, with a real, verified sample business
(its own Actual and Budget ledgers, real transactions posted to each,
real report numbers). For the story behind why a business ends up needing
this kind of software, and each screen introduced in the order a real
business would actually need it, see
[`docs/user-manual.md`](./docs/user-manual.md) (`make manual` builds the
PDF).

This README is the developer quick-start. For the real, current
technical specification — the entity model, the EntityDriver storage
boundary, every API and report, build/test tooling — see the
**Programmer's Manual** (`docs/pm-*.md`, built as one PDF via `make
programmer-manual`), starting with
[`docs/pm-system-overview.md`](./docs/pm-system-overview.md). The design
rationale and rejected approaches behind how the system got this way
live in the separate Historical Design & Decision Log (`make
historical-manual`), not repeated here.

## Quick start

```bash
make install
make dev      # backend :3001, frontend :5173, together
```

### Running under Node, Bun, or Deno

This project runs identically under Node (default), Bun, or Deno — some
organizations' own corporate policy requires one of these specifically.
Override `RUNTIME` on any `make` command:

```bash
make install RUNTIME=bun
make dev RUNTIME=bun
make test RUNTIME=deno
```

See `docs/multi-runtime-support.md` for the real mechanism behind this (a
small SQLite/test-framework adapter — everything else in the stack is
already runtime-agnostic).

### If `make install` warns about blocked install scripts

Newer npm versions (11.16+, and the default from npm 12 onward — this
could already be your version) block a dependency's own install
scripts unless explicitly approved, a real, recent supply-chain-safety
feature (npm RFC #868). `esbuild` (a real dependency of Vite, used by
the frontend) needs its own postinstall script to download its native
binary — if npm blocks it, the frontend dev server can fail later with
a confusing "missing binary" error, not at install time. Fix:

```bash
cd frontend && npm approve-scripts --allow-scripts-pending && npm install
```

(Older npm versions won't show this warning at all — nothing to do.)

### If `make dev`/`make backend` fails with `SqliteError: database disk image is malformed`

`backend/data/entities.sqlite` is real, per-install runtime data —
deliberately not committed to git (see `.gitignore`) — regenerated
fresh from `backend/schema/*.sql` automatically the first time the
backend starts. If a previous run was interrupted mid-write (a killed
process, a full disk, a crash), the leftover file can be left corrupt,
and since `make install` never touches this file, a corrupt one will
silently persist across reinstalls. Fix — delete it and let the
backend recreate a fresh one:

```bash
make reset-db
make dev
```

Open http://localhost:5173 — you'll land on a login screen. The default
account is **username `admin`, password `changeme123`** — this is
intentionally not a secret (it's in this README and in
`backend/schema/00-core.sql` in plain sight), it exists only so the
first login works at all. **Change it immediately** via Setup → Users,
or create your own Administrator account and deactivate this one.

Or manually, in two terminals:

```bash
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

Open http://localhost:5173.

## What's here

24 backend route modules (`backend/src/routes/`) and 84 frontend pages
(`frontend/src/routes/`). The full, current screen-by-screen and
API-by-API reference lives in the Programmer's Manual and User Manual
above; highlights:

- **Choose business, ledger, and language** (`/session`) — the actual
  startup choice screen: every other page redirects here first if
  nothing's been chosen yet, persisted via localStorage. The chosen
  language drives `translations`, read through `Save`/`Delete`/`Debit`/
  `Credit`/etc. wherever those vocabulary words appear in the UI,
  falling back to English for anything not yet translated.
- **Entity Tree Report** (`/`) — the whole entity table, walked from its
  one root, in hierarchy order.
- **Structured Editor** (`/editor`) — create, rename, reparent, change
  the relation of, or delete any entity; assign account numbers.
- **Journal Entries** (`/journal`, `/journal/[id]`) and **Post Journal
  Entry** (`/post`) — stage lines one at a time, then post atomically:
  the whole entry is validated to sum to zero and moved to the real
  tables, or none of it is.
- **Reports** (`/reports`) — Trial Balance, Balance Sheet (with a real
  Assets = Liabilities + Equity check, including a synthetic *Current
  Year Earnings* line for income not yet closed), Profit & Loss,
  Compare Ledgers (Actual vs. a budget or scenario), Sales Report,
  multi-dimensional (hierarchy/location/division) breakdowns, and
  Business Reports (Balance Sheet/P&L mapped through a business's own
  Chart of Accounts).
- **Stock control** — locations, storage capacity/occupancy, stock
  receipts/dispatches/takes, inventory listings and movement reports,
  a Hierarchy/Product cartesian combination mechanism (barcode
  resolution, combination-specific pricing).
- **AP/AR** — contacts (customers/vendors), invoices, quotations,
  payment allocation.
- **POS** — point-of-sale terminals and sales, with tiers, locations,
  and item combinations.
- **Matrix / business reports, departments, projects, period
  management** — each with its own route module and db-logic file (see
  `backend/src/routes/` and `backend/src/db-*.ts`).
- **Setup** — authentication and role-based authorization
  (`users`/`roles`/`user_roles`/`sessions` as dedicated infrastructure
  tables, not entities), three roles (Administrator, Bookkeeper,
  Read-Only) enforced on every route.

## The EntityDriver storage boundary

Every entity read/write in the backend goes through one `EntityDriver`
interface (`backend/src/entity-driver.ts`), not raw SQL scattered
through the codebase. `backend/src/entity-driver-select.ts` is the one
module allowed to choose between implementations, via `ENTITY_DRIVER=
sql|kaappi` (default `sql`):

- `SqlEntityDriver` (`backend/src/drivers/sql-entity-driver.ts`) —
  today's real, default, production path: the entity tree lives in the
  same SQLite database as everything else.
- `KaappiEntityDriver` (`backend/src/drivers/kaappi-entity-driver.ts`)
  — an experimental alternative backing the entity tree with a Kaappi
  Scheme subprocess instead of SQL, proving the storage choice really
  is swappable behind one boundary (a future non-SQL or even
  logic-programming backend is a real, intended direction, not
  speculative). Not the default, not yet feature-complete (some
  report-adjacent paths still read SQL's `current_entities` directly
  for financial-join reasons, a documented, scoped gap) — a real,
  running proof, not a finished product.

See `docs/entities-append-only-redesign.md` and the Programmer's Manual
for the full rationale and status.

## Schema highlights

- `entities(id, name, parent_id, relation_id)` — no `entity_type_id`, no
  type/instance distinction. A category, a business, a customer, a piece
  of UI vocabulary are all just rows here. Entity history is append-only
  (`entity_entry`/`entity_update`), never an in-place `UPDATE`.
- `account` and `translation` are genuine *extensions* of specific
  entities (not competing concepts) — `account` 1:1 via shared primary
  key, `translation` 1:many, both looked up by name through their own
  views.
- Money is always integer minor units (`amount_minor`, `balance_minor`), never
  a float.
- Posting a transaction is one atomic operation — it validates, vivifies
  any not-yet-seen account, moves staged lines to the permanent tables,
  updates balances, and clears staging, or none of that happens at all.
- i18n: `Save`/`Cancel`/etc. exist as single, global vocabulary entities;
  translating one is one row in `translation`, read back with automatic
  fallback to the canonical (English) name for anything not yet
  translated.

## Frontend stack

Svelte 5 + SvelteKit 2.

## Current state (for someone reviewing this as a snapshot)

See `SQL_LEDGER_MAPPING.md` for a table-by-table comparison against the
real SQL-Ledger PostgreSQL schema — what's covered, what's partial, and
what's an honest, named gap (payroll and audit trail specifically).

**Fully built, tested, wired into the UI:** entities/account/translation/
journal/staging schema with append-only entity history; the EntityDriver
storage boundary (SQL by default, an experimental Kaappi-backed
alternative behind it); atomic posting with genuine per-ledger isolation;
the full report suite (Trial Balance, Balance Sheet, P&L, Compare
Ledgers, Sales Report, multi-dimensional/structural breakdowns, Business
Reports); stock control (locations, capacity/occupancy, receipts/
dispatches/takes, movement reports, the Hierarchy/Product cartesian
mechanism); AP/AR (contacts, invoices, quotations, payment allocation);
POS; departments/projects/period management; Setup/Structured Editor;
the full vocabulary sweep (every nav label, heading, column header
sourced from translated vocabulary, not hardcoded); authentication and
role-based authorization (three roles, enforced on every route).

**Known gap, open and not yet scoped:** the remaining
raw-SQL-joined-against-entities sites in `db-matrix-reports.ts`,
`db-quotations.ts`, and `auth.ts` haven't yet been migrated onto the
EntityDriver boundary, so they stay invisible to the experimental Kaappi
driver (SQL remains the default and fully-featured path regardless).
**Not yet built:** an audit trail of who did what, and self-service
password changes for non-administrators (currently only an
Administrator can reset a password, including their own).

**A real, deliberate policy, not an oversight**: this app does not
support upgrading an existing database in place. Every schema change
lives in `backend/schema/*.sql` itself, applied fresh via `make
reset-db` — never a conditional "does this old database have the new
column yet?" migration function.

## Testing

Run with `make test` (`make test RUNTIME=bun`/`RUNTIME=deno` to switch).
**Current count, measured directly against a freshly-reset database**:
247 backend tests (`backend/test/db.test.ts`, `backend/test/
auth.test.ts`, `backend/scripts/step-runner.test.ts`) and 28 frontend
tests, 275 total, all passing under both Node (~115s) and Bun (~87s).
Bun's own default per-test timeout (5000ms) is too tight for a couple of
the slower report tests once the suite's shared db has accumulated many
businesses' worth of entities — `make test RUNTIME=bun` raises it
(`--timeout 20000`) rather than mask anything; this is a timeout-budget
fix, not a behavior change, and all three runtimes exercise the exact
same test files. Deno is supported per `docs/multi-runtime-support.md`
but wasn't independently re-measured in this pass (not installed in
every environment).

Unit tests are the right tool for proving a specific mechanism correct
in isolation against small, synthetic scenarios. They are the *wrong*
tool for catching a bug that only shows up once real, large-scale,
interrelated data exists — see `docs/testing.md` for real examples of
bugs only the simulation below ever caught.

Beyond the unit suite:

- `make test-e2e` — resets the database and runs a full, deterministic,
  seeded-PRNG month of simulated wine-retail trading (hundreds of
  purchase orders, several thousand retail sales, stock takes, a
  year-end close), then checks the result against exact, documented
  expected figures (`backend/scripts/verify-simulation.ts`,
  `docs/testing.md`). **Known, open issue, not caused by anything in
  this session's changes**: this currently fails a number of its own
  checks (confirmed, via an isolated worktree at an earlier commit, to
  predate the most recent EntityDriver migration work — not a
  regression from it). Needs its own dedicated investigation; treat its
  current failing state as real and unresolved, not as noise to ignore.
- `make test-e2e-tutorial` (and `-browser`/`-text` variants) — a
  CSV-driven tutorial fixture (`shared-fixtures/tutorial-steps.csv`)
  replayed through the real API, a real driven browser, or a real
  driven text UI, step by step.
- `e2e/` — a separate Playwright suite (`make e2e-spec-smoke`,
  `make e2e-spec-all`) exercising real routes in a real, live browser.
