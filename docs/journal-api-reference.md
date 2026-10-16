# The Journal API — `backend/src/db-journal.ts`

Per direct instruction: this chapter is the single, complete, authoritative source for
every function in `backend/src/db-journal.ts`. Every comment previously living in that
source file has been moved here; the source file itself carries only a reference back
to this chapter. This chapter is written to be complete enough that the real behavior
of every function here could be reconstructed from this text alone, without reading
the implementation.

## The three, real, distinct posting paths — and why there are exactly three

1. **Ordinary financial postings** (the vast majority): a screen-specific staging
   table's own `INSTEAD OF INSERT` trigger copies rows into `journal_entry_staging`,
   then `INSERT INTO post_journal_entry` fires `post_journal_entry_insert`, which
   validates the entry balances (per currency) and the period is open, then writes
   `journal` + `journal_line` + updates `account.balance_minor`, then clears staging.
2. **Quantity movements** (stock received/dispatched/transferred): a real, parallel
   staging + trigger pair — `journal_entry_staging` again, but `post_quantity_movement`
   instead of `post_journal_entry` — because a quantity movement is a single, real
   line against one product's own tracking account, not a two-sided, balanced
   transaction; forcing it through the balance check would require inventing a fake
   offsetting account.
3. **Recurring journals**: `createRecurringJournal`, as it exists today, writes
   directly to `journal`/`journal_line`, never staged at all — a real, confirmed,
   open bug (see below), not a legitimate third exception the way it was once
   believed to be.

## `StagedLine` / `stageLine`

The real shape of one staged line, exactly as declared in `backend/src/db-journal.ts`:
`reference`, `business`, `ledger`, an optional `description`/`transdate`, the `account`
(and optional `accountId`, when the caller already knows it — set directly by
`findLedgerScopedAccount` when a ledger-scoped posting account already exists for this
`(ledger, account)` pair), `amount_minor`, an optional `memo`/`bankReference`. **There is
no `division` field on `StagedLine`, and no Cost-Center/Profit-Center distinction
anywhere in this file** — a previous revision of this chapter claimed `stageLine`
refuses to stage a Cost-Center division's line against an Income account; that claim
was checked directly against the current source and found false (`grep -i "Cost Center"
backend/src/` returns zero matches anywhere in the backend). Division/Profit-Center
scoping is a real, separate mechanism (`setDimensionParent`, `ensureProfitCenterAccount`
— see `docs/profit-centers-design.md`), applied to *accounts*, not enforced inside
`stageLine` against staged lines.

`stageLine` itself does exactly one thing: it inserts, or on conflict updates, one row
in `journal_entry_staging`, keyed on the real SQLite `ON CONFLICT` target —
`(reference, business, ledger, account, account_id, location)`, not just the first four
of those — so two lines against the same bare account name in one entry only collide
if they also share the same resolved `account_id` and `location`.

## `getStagedLines`

Returns every real, currently-staged line for one `reference`/`business`/`ledger` —
used by a screen to show what's about to be posted before the person confirms.

## `RecurringJournalLine` / `Recurrence` / `createRecurringJournal`

**A real, confirmed, open bug — not yet fixed.** This function writes directly to
`journal`/`journal_line`, bypassing `journal_entry_staging` and the real, correct,
per-currency balance check `post_journal_entry_insert` enforces for every other
posting path. Its own balance check is a flat sum across every line — `l.amount_minor`
summed with no currency grouping at all — so a recurring entry mixing real currencies
(a USD debit and a EUR credit of the same minor-unit amount, say) could pass this
check as "balanced" while genuinely not being balanced per currency at all.

It was, for a time, believed to be a second, legitimate exception to the
staging-based posting path — recorded in an earlier comment as: "recurrence is a
property of the journal itself, not something that makes sense to 'post' the way a
single balanced entry does — there's no single moment to validate balance against;
each future occurrence is its own, separate balance check, done by
`journal_occurrences` at read time." **This claim was checked directly and found
false — `journal_occurrences` performs no currency or balance check of any kind.**
There is no secondary safety net; the bug is real and unmitigated.

**The planned, real fix — not yet implemented, per direct instruction that
scheduling belongs purely in the entity tree**: the recurrence *schedule* itself
(recurrence type, count, start date, template lines) should be a real, entity-based
definition, never special columns on the `journal` table and never a recursive,
virtual-expansion view replaying one set of lines across computed future dates. A
combined, real timeline function should `UNION` real, already-posted `journal` rows
with virtual, projected future occurrences computed from the definition entities,
clearly tagged so callers can distinguish "posted" from "projected." Materializing a
due (or early) occurrence is a real, reviewed, person-driven action from the General
Journal Entry screen — a new "Upcoming recurring entries" section loads that
occurrence's own template lines into the same, ordinary line-entry form, fully
editable, then posts it through the ordinary `stageLine`/`postJournalEntry` path.
`journal.recurrence`/`recurrence_count` and the `journal_occurrences` view are
retired once this lands.

The current, real function still vivifies every referenced account that doesn't have
one yet — the same guarantee `post_journal_entry`'s own trigger gives ordinary
entries, just performed in TypeScript rather than SQL, since this path doesn't go
through that trigger at all.

## AR/AP entry screens — the shared shape

Each of AR Sale, AR Receipt, AP Purchase, and AP Payment is a purpose-built form with
its own staging table (customer/vendor, amount, date — exactly that form's fields),
posting through the exact, same, atomic `post_journal_entry` mechanism everything
else uses. Two functions per form: `stage...` (a plain insert) and `post...` (fires
the form's own `INSTEAD OF INSERT` trigger, which builds the real, correct two-line
entry and posts it).

## `ensureLocationScopedAccount`

The same, real, established `"{account} — {location}"` leaf pattern, generalized for
accounts with no real, specific product at all (AR Sale's generic Sales Revenue, AP
Purchase's chosen expense account). Location here is genuinely per-invoice, not
per-line.

## Stock/order entry screens — the shared shape

Purchase Order, Sales Order, Stock Receipt, and Stock Dispatch each stage into their
own table, then `post...` reads the staged row, does the real work (placing or
fulfilling an order, moving quantity, posting the monetary side through the ordinary
balanced mechanism), and clears the staged row — the same shape as AR/AP, just
written as a TypeScript function instead of a SQL trigger, for the reasons noted in
`backend/schema/00-core.sql`. A Purchase Order's own `location` field is real,
direct delivery instructions — where the order should arrive, not a per-line detail.

## Employee project-clock functions

`clockInToProject`/`clockOutOfProject`/`getOpenProjectClockForEmployee` track which
employee is clocked into which project, posting the real, running labor cost against
that project's own expense account as time passes.

## Period-lock functions

`getLedgerDateRange`, `getPeriodLockStatus`, `closePeriod`, `reopenPeriod`,
`assertPeriodOpen` — a business/ledger's own period can be closed to ordinary
posting after a given date (a genuine, real, month-end/year-end lock); `assertPeriodOpen`
is the one, shared guard every real posting path calls before writing anything.

## `removeStagedLine`

Removes one real, specific staged line by reference/business/ledger/account —
used when a person changes their mind about one line before posting the rest.

## `JournalSummary` / `listJournalEntries` / `countJournalEntries` / `JournalDetail` / `getJournalEntry`

The real, listing and detail views over posted journal entries — one row per real
occurrence (a recurring journal's own multiple, computed dates each get their own
row), with total debit/credit, description, reference, and who posted it.

## `reverseJournalEntry`

Posts a real, balanced, opposite entry against the original one, then marks it — a
genuine correction, not a silent edit or delete of the original, real, historical
record. Precisely, in the order the real function does it:

1. The new reversal's reference is deterministic, never caller-supplied:
   `` `${original.reference}-REV-${occurrenceDate}` ``.
2. If a journal with that exact reversal reference already exists for this
   business/ledger, the function refuses outright — an entry can only be reversed
   once; reverse the reversal itself to undo it again.
3. Every original line is staged again with its sign flipped (`-line.amount_minor`)
   under the new reversal reference, then posted through the ordinary
   `stageLine`/`postJournalEntry` path — a reversal is not a special internal
   mechanism, it is an ordinary balanced entry whose lines happen to be computed from
   another one.
4. Only after that post succeeds does `reversal_of` get set — and it is set on the
   **new reversal row**, pointing back at the **original**'s `journal.id`
   (`UPDATE journal SET reversal_of = <original id> WHERE reference = <new reversal
   reference> ...`), not the other way around. A row's own `reversal_of` being
   non-null is what marks *that row* as itself being a reversal of something earlier.

## `recordInvoiceLine`

Exported from `backend/src/db.ts` specifically so `db-journal.ts`'s own
`postARSale`/`postAPPurchase` can call it after a successful post — records one
real line of narrative detail (description, quantity, unit price, amount, tax)
against the real, underlying invoice these two screens create, so an invoice
built this way shows the same real line detail as one built through the
dedicated Invoices screen.

## `stageLocation` / `postLocation`

Per direct, absolute instruction: every real, user-facing data-entry form has a
real, dedicated staging table behind it — `location_staging`, the exact, same,
established shape as `stock_receipt_staging`: a plain table, no trigger of its
own, holding a real screen's own raw, real input.

`stageLocation` inserts (or, on conflict, updates) the real, staged row.
`postLocation` reads it back and is the one, real place a new location is
actually created — through the exact, same, typed `createLocation`/
`setLocation`/`ensureLocationCapacityAccount` functions this whole codebase
already uses everywhere, never a raw SQL insert into the `entities` table
(which is genuinely append-only and self-auditing by design — there is no
"create entity" SQL statement at all). The real, balanced opening-capacity
posting into the location's built-in `Storage Capacity` structure (`Remaining`,
`Installed`, `Occupied`; see `docs/storage-space-as-currency-design.md`, "Code
and tests: where to look") happens here too, atomically, inside the exact,
same, real transaction as the location's own creation, then the staged row is
cleared.
