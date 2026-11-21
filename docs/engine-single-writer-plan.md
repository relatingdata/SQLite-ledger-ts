# Plan: the storage engine as the only writer

**Status:** plan, 21 November 2026. Nothing below is built yet.

## Why

Two programs write `backend/data/entities.sqlite` today. The backend's
better-sqlite3 connection writes the journal, and under
`ENTITY_DRIVER=gleam` the Gleam engine writes entities. SQLite allows one
writer at a time, so the two lock each other. On the Retail tutorial that
fails 18 of 75 steps (see "The storage engine" in *The Core Middleware*).

With one writer there is nothing to lock. The engine already takes its
calls one at a time: one actor per file, and its mailbox is the order of
writes. The engine then also becomes the one place where the rules are
kept: append-only, balance, unique references, locked periods.

## Rules this plan keeps

- **The stored balance is maintained.** Every account's balance is kept
  as a stored total. The engine updates it in the same transaction as the
  lines that change it, so it always equals the sum of those lines. It is
  the one value updated in place; the journal lines are the record it can
  be checked against.
- **No reversal mark.** A reversal is a new entry with every amount
  negated and a `Reverses` relation to the original, as the core
  middleware already does (`core/ops.ts`). Nothing is ever stamped on the
  original entry, and no row is updated. The original middleware's
  `journal.reversal_of` stamp (`db-journal.ts`) and its write-once trigger
  go.
- **Append-only, enforced twice.** The engine writes only by INSERT,
  apart from the stored balance. The schema's triggers refuse any UPDATE
  or DELETE of entities, journal headers or journal lines from any client.
- **Balance is checked before anything is written.** Each unit
  (currency, or an item's quantity) must add up to zero.

## What the engine does instead of the backend

The target is the design the backend is already moving onto: the core
middleware's four calls (`create`, `relate`, `copy`, `post`) over two
stores. These are already written twice: in TypeScript
(`backend/src/core/store.ts`, in-process SQLite) and in Gleam
(`storage_engine/src/core.gleam`). The engine becomes the core's only
store, and the frontends move onto the core. The original middleware
writes about 40 kinds of row (journal, account, eleven staging tables,
the INSTEAD OF posting triggers), so routing it through the engine as it
stands would only move the locking. It is retired instead.

## Steps

Each step ends with its tests passing, and is committed on its own.

1. **The engine's post becomes one transaction, with a stored balance.**
   - Today `core.post` writes the new accounts, the entry and its
     relations in separate statements before the transaction that writes
     the lines. Build them all into the one script instead, with the
     balance updates.
   - Add the balance store: one row per account and unit, updated in the
     same script.
   - `core.balance` reads that row.
   - Tests: a failed post leaves no entry, account or relation behind;
     after every post the stored balance equals the sum of the lines; a
     raw UPDATE of a balance row from outside the engine is refused
     (trigger), while the engine's own post updates it.
2. **Reversal without a mark.**
   - Add `core.reverse(reference)`: it posts the negated lines with
     `Reverses`, and refuses a second reversal of the same entry by
     looking for an existing `Reverses` relation.
   - In the original middleware, stop stamping `reversal_of`.
   - Tests: reversing twice is refused; the original entry's rows are
     unchanged.
3. **The engine serves the core over HTTP.**
   - Add the four calls, the reads the core uses (child, lookup, entry
     lines, balance) and opening an instance (user, business, ledger) to
     `http_api.gleam`.
   - Tests: the engine's own suite, through HTTP.
4. **The core's store on the engine.**
   - Add a second implementation of `backend/src/core/store.ts`'s `Store`
     that calls the engine, chosen by `CORE_STORE=engine`.
   - Its in-memory index of entities is filled from the engine's replies.
   - Tests: `core.test.ts`, `core-api.test.ts` and the three tutorials
     (`make test-e2e-tutorials`) pass with both stores.
5. **The frontends on the core.**
   - The core serves about 90 calls; the web and terminal screens use
     about 270 (`application/application.entities`, `Calls`). Add the
     rest to `core/api.ts`, screen by screen.
   - Tests: the browser tutorials (Retail, Manufacturing, Project
     Builder) with `MIDDLEWARE=core`.
6. **Switch and retire.**
   - `MIDDLEWARE=core` with `CORE_STORE=engine` becomes the default.
   - The original middleware (`db*.ts`, `call-dispatch/`), its schema and
     the SQL, Kaappi and memory entity drivers are removed, with the
     engine's original-middleware schema (`priv/schema.sql`) and routes.
   - The manuals are updated with each step.

## What stays the same for users

The screens, the reports, first in, first out, and the storage space
accounts work as they do now. Step 5 has to carry them across to the
core, and the browser tutorials check that.

## Open question

Reads: the backend may keep reading the file directly, through a
read-only connection (WAL lets readers run beside the one writer), or
ask the engine for everything. Direct reads keep reports fast. Asking the
engine keeps one way in. Step 4 starts with direct reads.
