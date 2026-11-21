# Plan: the storage engine as the only writer

**Status:** step 1 is done (commit `e13ce47`); steps 2 to 5 are not built yet.

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

## The design this rests on

Every transaction is a cooked general journal transaction, and nothing
else. A screen (cash purchase, sale, receipt, payment, order, transfer)
cooks its business fact into the lines of a general journal entry. There
is one staging table, for the general journal: `journal_entry_staging`
(*CSS Styling and Data Entry*, "the one, real, shared staging table").
There is one way to post: the staged entry, balanced, as one journal
entry. Everything else about a transaction (the invoice, the order, its
reference) is an entity or a relation.

So the engine needs exactly one accounting call: post a balanced general
journal entry. It already has that call (`POST /journal`,
`storage.post_journal_entry`), and the backend's entities already go
through it under `ENTITY_DRIVER=gleam`.

## Where the code departed from the design (step 1, done)

These staging tables in `backend/schema/00-core.sql` were removed in step 1:

| Table | Used by |
|---|---|
| `po_staging`, `so_staging` | `db-journal.ts`, `db-quotations.ts` (orders and quotations) |
| `stock_receipt_staging`, `stock_dispatch_staging` | `db-journal.ts` |
| `location_staging` | `db-journal.ts` |
| `ar_receipt_staging` (and its posting view `ar_receipt_post`) | `db-journal.ts` |
| `ap_payment_staging` (and its posting view `ap_payment_post`) | `db-journal.ts` |
| `assembly_bom_staging` | `db.ts` |

Each holds one kind of transaction's fields before posting. The two
posting views do the cooking inside SQLite triggers. Each must cook into
general journal lines instead, in TypeScript, through
`journal_entry_staging`, or for a pure configuration fact such as a new
location or a recipe line, write entities directly.

## Steps

Each step ends with its tests passing, and is committed on its own.

1. **One staging table.**
   - Each flow above stages general journal lines in
     `journal_entry_staging` and posts through `postJournalEntry`; its
     non-accounting facts become entities or relations.
   - Then the other staging tables and the two posting views are dropped.
   - Tests: the backend suite and the three tutorials, on the API path
     and in the browser.
2. **One posting path, through the engine.**
   - `postJournalEntry` (`db-journal.ts`) is the only place that writes
     `journal`, `journal_line` and the stored balance; the three other
     direct `INSERT INTO journal` sites (`db.ts`) move onto it.
   - Under `ENTITY_DRIVER=gleam` it sends the staged entry to the
     engine's `POST /journal`, which checks the balance and writes
     header, lines and stored balances in one transaction.
   - Quantity movements must be balanced first: `postQuantityMovement`
     (14 callers) and `Balance.post` (2) post a single line, which the
     engine's balance check would refuse (*The Stock API*, "Open
     questions").
   - The staging table itself is per-request scratch, so it moves out of
     the shared file into the backend's own memory or file. Then the
     backend writes nothing to `entities.sqlite`, and nothing locks.
3. **Reversal without a mark.**
   - A reversal posts the negated lines with a `Reverses` relation.
     `journal.reversal_of`, its write-once trigger and the `UPDATE` in
     `db-journal.ts` go. The engine's reverse call stops stamping.
   - A second reversal is refused because a `Reverses` relation already
     exists.
4. **Account attributes as relations.**
   - `account.accountnumber`, `currency` and `overdraft_limit_minor` are
     updated in place today (`db.ts`, `db-reports.ts`). They become
     relations of the account entity, so the `account` table holds only
     the stored balance, which only the engine's post updates.
5. **The gleam driver as the default.**
   - With 1 to 4 done, `ENTITY_DRIVER=gleam` becomes the default once the
     backend suite, the three tutorials on both paths and the engine's
     own suite pass with it.
   - The manuals are updated with each step.

## What stays the same for users

The screens, the reports, first in, first out, and the storage space
accounts work as they do now; the browser tutorials check that after
each step.

## Open question

Reads: the backend may keep reading the file directly, through a
read-only connection (WAL lets readers run beside the one writer), or
ask the engine for everything. Direct reads keep reports fast. Asking the
engine keeps one way in. Step 2 starts with direct reads.
