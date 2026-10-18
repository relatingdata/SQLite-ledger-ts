# System Overview

This manual describes **the system as it stands today**, with the
minimum background a programmer needs to reimplement any part of it.
It is deliberately short. Design rationale, rejected approaches, and
the real incidents that led to a given decision all live in the
separate **Historical Design & Decision Log** (`make historical-manual`)
— this manual states what is true now; that one explains how it got
that way.

## What this is

A double-entry ledger application (branded "Better Brighter
Multi-Ledger") over a deliberately minimal SQLite schema: one
`entities` table carrying the entire structural tree (businesses,
accounts, locations, items, vocabulary, users — everything), plus
small, typed extension tables (`account`, `translation`, `journal`/
`journal_line`) for the data that doesn't fit the tree shape. See Part
II, "The Entity Model," for the one mechanism everything else in this
system is built on.

## The two halves, and how they talk

- **Backend** — `backend/src/`, Express + `better-sqlite3`, runs
  identically under Node, Bun, or Deno (see "Build, Run & Tooling").
  Owns the database; the frontend never touches SQLite directly.
- **Frontend** — `frontend/src/`, SvelteKit 5 + Svelte 5 (runes) + Vite,
  talks to the backend only over its HTTP API.
- Both are real npm workspaces (`backend`, `frontend`, `e2e`) under one
  root `package.json`; `make install` installs all three with one
  command.

## Where to find the rest of the real specification

This manual intentionally does **not** restate what the application
does from a user's point of view, or what each screen is for — that is
the **User Manual**'s job (`docs/user-manual.md`, built via `make
manual`), which this Programmer's Manual treats as the real,
authoritative **operational and functional specification**: what the
system is for, what each screen does, and the full setup-through-
year-end Tutorial that exercises it end to end. Where this manual
describes *how* something is implemented, the User Manual is the
place that says *what it is for* and *what it should do* — read the
relevant User Manual chapter first when implementing or changing
user-facing behavior, then use this manual for the mechanism.

Flagged, open item: the User Manual has not yet had the same
current-state accuracy pass this Programmer's Manual just had. It
should get one — confirm every screen and workflow it describes still
matches the live application — before it's fully trusted as the
functional spec on its own.

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

Every real, everyday command for this project goes through `make`,
from the repository root — see "Build, Run & Tooling" for the full
target reference.
