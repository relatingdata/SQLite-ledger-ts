# System Overview

This manual describes the system as it is, with what a programmer
needs to reimplement any part of it. Why it is so, what was rejected
and what went wrong on the way are in the **Historical Design &
Decision Log** (`make historical-manual`).

## What this is

A double-entry ledger application ("Better Brighter Multi-Ledger") on
a small SQLite schema: the `entities` table holds the whole tree
(businesses, accounts, locations, items, vocabulary, translations,
users), and `account`, `journal` and `journal_line` hold balances and
postings, with `journal_entry_staging` for entries being built
(*Build, Run & Tooling*, "The four permanent tables"). See Part
II, "The Entity Model," for the one mechanism everything else in this
system is built on.

## The two halves, and how they talk

- **Backend** — `backend/src/`, Express + `better-sqlite3`, runs
  identically under Node, Bun, or Deno (see "Build, Run & Tooling").
  Owns the database; the frontend never touches SQLite directly.
- **Frontend** — `frontend/src/`, SvelteKit 5 + Svelte 5 (runes) + Vite,
  talks to the backend only over its HTTP API.
- **Middleware** — the business rules that turn what a form carries into
  journal entries and records — exists twice in the backend today: the
  original (`db*.ts`, dispatched through `call-dispatch/`), which the web
  and terminal frontends use, and the simplified **core**
  (`backend/src/core/`), which the step runner and all three tutorials
  use through its frontend API, and which serves `/api/call` when the
  backend is started with `MIDDLEWARE=core`. See "The Core Middleware."
- **Storage engine** — `storage_engine/`, a Gleam service compiled to
  Erlang and run on the BEAM (not compiled to TypeScript), serving HTTP
  on port 8090. It holds the same schema and its rules. The original
  middleware's entity driver can use it (`ENTITY_DRIVER=gleam`), but the
  backend's default driver is still `sql`, in-process better-sqlite3:
  under `gleam` the tutorials fail on database locks (see "The Core
  Middleware", "The storage engine").
- **Terminal UI** — `tui/`, Svelte on sveltui, another client of
  `/api/call` (*Testing: The Test-Runner*, "`--path text`", for its
  state).
- `backend`, `frontend` and `tui` are npm workspaces of the root
  `package.json`; `make install` installs all three.

## Where to find the rest of the real specification

What the application does for its user, and what each screen is
for, is in the **User Manual** (`docs/user-manual.md`, `make manual`),
the functional specification. This manual says how it is built. For a
change a user will see, read the User Manual chapter first, then this
manual for the mechanism.

The User Manual has not yet been checked against the application the
way this manual has.

## Everyday entry points

```
make install              # one install, all three workspaces
make dev                  # backend :3001, frontend :5173, together
make test                 # unit/sanity tests - see "Testing: Unit & Compile-Level"
make test-e2e             # full simulation + exact-figure check - see "Testing: The Test-Runner..."
make manual                     # User Manual PDF
make programmer-manual          # this manual
make historical-manual          # the full design/decision archive
```

Every command goes through `make`, from the repository root (*Build,
Run & Tooling*).
