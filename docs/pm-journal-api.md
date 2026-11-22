# The Journal API — `backend/src/db-journal.ts`

## Staging

Every transaction is a cooked general journal transaction. There is one
staging table, `journal_entry_staging`: a screen's transaction is cooked
into general journal lines there and posted as one entry by
`postJournalEntry` (or, for a quantity movement,
`commitStagedQuantityMovement`). No other staging table and no posting
trigger exists. The unit test "journal_entry_staging is the only staging
table" (`backend/test/db.test.ts`) fails if one is added, and the backend
drops the old ones from an existing database when it starts (`db.ts`).

A form is staged by one call and posted by another (`stage...`, then
`post...`). The forms are of two kinds:

- **Cooked when staged.** An AR receipt (`stageARReceipt`) and an AP
  payment (`stageAPPayment`) stage their two general journal lines
  straight away: Cash and Bank against the customer's or provider's own
  account. Staging the same reference again replaces the lines.
  `postARReceipt`/`postAPPayment` post them, and refuse with "nothing
  staged" when there are none.
- **Cooked when posted.** A form whose posting needs more than its
  lines is held in the backend's memory until it is posted
  (`backend/src/staged-forms.ts`: `stageForm`, `stagedForm`,
  `dropStagedForm`, `stagedFormsOf`). These are a purchase or sales
  order, a stock receipt or dispatch, a location and a recipe line.
  - An order needs its quantity and value; a receipt or dispatch also
    needs its order reference, and quantities for the invoice line.
  - The post call cooks the form into general journal lines and posts
    them, then drops the form. If the post fails, the form stays staged
    so it can be tried again.
  - Nothing is written to the database before the post. A backend
    restart forgets forms staged but not posted.
  - Posting a reference with nothing staged throws `NotFoundError`.

Tests (*Testing: Unit*, "Running the tests"):
- "journal_entry_staging is the only staging table: every transaction is a cooked general journal entry" (`backend/test/db.test.ts`)
- "an AR receipt and an AP payment are cooked into general journal lines when staged" (`backend/test/db.test.ts`)
- "posting a screen with nothing staged is rejected clearly, not silently a no-op" (`backend/test/db.test.ts`)

## The three posting paths

Every posting is TypeScript, not a trigger: `commitStagedEntry`
(`db-journal.ts`) resolves the business, ledger and account ids first,
then writes `journal`, `journal_line` and the stored balances in one
`db.transaction(...)`. It is called two ways, and recurring journals are
a third path:

1. **Money**: the transaction is cooked into `journal_entry_staging`
   ("Staging", above) and posted by `postJournalEntry(reference,
   business, ledger, userId)`, which calls `commitStagedEntry` with
   `{ requireBalance: true, includeBankReference: true }`. Inside one
   `db.transaction` it checks that the entry balances in each currency
   and that the period is open, writes `journal` and `journal_line`,
   updates `account.balance_minor`, and clears the staged lines. The
   business, ledger and account ids are resolved before the transaction
   opens (below).
2. **Quantity movements** (stock received, dispatched, transferred):
   the same staging, posted by `commitStagedQuantityMovement(reference,
   business, ledger, userId)`, which calls `commitStagedEntry` with
   `{ requireBalance: false, includeBankReference: false }`: no balance
   check (*Stock API*, "Two design decisions") and no bank reference.
   `Balance.post` (`primitives.ts`) and `postStagedQuantityMovement`
   (`db-stock.ts`) call it.
3. **Recurring journals**: `createRecurringJournal` writes `journal` and
   `journal_line` directly, without staging. One stored set of lines is
   expanded into every scheduled occurrence when read, by the
   `journal_occurrences` view (`00-core.sql`), each line as of its
   `effective_date` then; every report, the journal list and the
   balances read through that view. Posting the schedule through
   `commitStagedEntry` would apply it once, at once, which is not what
   a schedule is. Its own checks are below.

Tests (*Testing: Unit*, "Running the tests"):
- "staging + posting a balanced entry works end to end and clears staging" (`backend/test/db.test.ts`)
- "posting an unbalanced entry is rejected and leaves staging untouched" (`backend/test/db.test.ts`)
- "an account is vivified on first post and gets a real balance" (`backend/test/db.test.ts`)
- "journal postings record who posted them — the other half of the audit trail, alongside entities own append-only history" (`backend/test/db.test.ts`)
- "postJournalEntry: a real multi-currency entry must balance independently per currency — the exact danger this catches: an EUR imbalance masked by an offsetting USD imbalance must never pass" (`backend/test/db.test.ts`)

### `resolveStagingBusinessId` / `resolveStagingLedgerId` /
### `resolveStagedAccountId` / `commitStagedEntry`

They resolve a staged entry's business and ledger ids, and each line's
account: first in the business's Chart of Accounts; then as a contact
(`resolveCounterpartyId`, since contacts are not copied into a
business's chart; *Core Domain Reference*, "Invoices — AR and AP share
one mechanism"); then by the bare name, taking whichever matches
first. They go through the
entity driver (`Entity.get`, `getUnder`, `descendantsWithDepth`), not
SQL on `current_entities`, so they work under every driver
(`ENTITY_DRIVER=kaappi` writes no `current_entities` rows), and they
run before `commitStagedEntry` opens its write transaction.
`commitStagedEntry` then, inside one `db.transaction(...)`:

1. Refuses to post nothing: no staged rows for this
   reference/business/ledger.
2. Refuses to post into a closed period: the staged date is on or
   before the locked-through date (`getPeriodLockStatus`).
3. With `requireBalance`, refuses an entry that does not balance in
   each currency: lines are grouped by account currency (an account
   with no currency, or not yet created, is its own group) and every
   group must sum to zero. Buying EUR with USD is one entry with two
   balanced groups.
4. Creates any account that does not exist yet.
5. Inserts the `journal` row.
6. Inserts one `journal_line` per staged line.
7. Updates each account's `balance_minor`, per line; the
   `journal_line_unique_ordinary` index allows at most one line per
   account per entry, so this equals a bulk sum.
8. Deletes the posted staging rows.

If any step fails nothing is written and the staged lines stay.

## `StagedLine` / `stageLine`

Fields: `reference`, `business`, `ledger`, an optional
`description`/`transdate`, `account` (and optional `accountId`, set
directly by `findLedgerScopedAccount` when a ledger-scoped posting
account already exists for this `(ledger, account)` pair),
`amount_minor`, an optional `memo`/`bankReference`. There is no
`division` field: a division or Profit Center is a hierarchy link on
the *account* (*Core Domain Reference*, "Hierarchies";
`docs/profit-centers-design.md`), never on a staged line.

`stageLine` inserts one row in `journal_entry_staging`, or updates the
row with the same `(reference, business, ledger, account, account_id)`:
two lines on the same account name in one entry replace each other
unless their `account_id` differs.

### `findLedgerScopedAccount`

Finds the ledger-scoped posting account for `(accountName, ledger)`,
and never creates one: only the rollover does. It is a child of the
chart's leaf, named after the ledger and related to it (`relation_id`),
so every report's walk of the chart finds it. With none, the caller
posts to the chart's leaf itself, as a business with one ledger always
does.

## `getStagedLines`

Every currently-staged line for one `reference`/`business`/`ledger` —
what a screen shows before the person confirms the post.

## `RecurringJournalLine` / `Recurrence` / `createRecurringJournal`

`createRecurringJournal` checks the entry balances at its start date,
in each currency, as `commitStagedEntry` does: it resolves and vivifies
every account first (inside the same transaction), sums the lines in
effect at the start date by their account's `currency` (the home
currency is one bucket), and writes nothing if any currency does not
come to zero. `journal_occurrences` checks nothing: it only expands
lines that passed this check.

**Planned fix, not yet implemented**: the recurrence *schedule*
(recurrence type, count, start date, template lines) should be a
real, entity-based definition, not special columns on `journal` or a
recursive virtual-expansion view. A combined timeline function would
`UNION` already-posted `journal` rows with virtual, projected future
occurrences, clearly tagged "posted" vs. "projected." Materializing a
due occurrence would be a reviewed, person-driven action from the
General Journal Entry screen, loading the occurrence's template lines
into the ordinary line-entry form, then posting through the ordinary
`stageLine`/`postJournalEntry` path. `journal.recurrence`/
`recurrence_count` and the `journal_occurrences` view would retire
once this lands.

Accounts are found with `resolveBusinessCoaAccountId`, within the
business's own chart (every business has its own "Rent"), falling back
to a global name only for an account outside any chart (AR/AP, a
counterparty).

Tests (*Testing: Unit*, "Running the tests"):
- "createRecurringJournal rejects an entry that does not balance at its start date" (`backend/test/db.test.ts`)
- "createRecurringJournal vivifies any account with no BALANCE yet, same guarantee as ordinary posting" (`backend/test/db.test.ts`)
- "a recurring journal correctly affects Trial Balance for its ledger, across all its occurrences" (`backend/test/db.test.ts`)
- "the exact wage-increase scenario: a mid-schedule amendment applies only from its effective date onward, via the same journal_line row set — no new table, no new journal" (`backend/test/db.test.ts`)
- "createRecurringJournal has not touched the Budget ledger — Actual and Budget stay isolated even for recurring entries, same as ordinary ones" (`backend/test/db.test.ts`)
- "a recurring journal records who created it — every occurrence it generates shows the same poster" (`backend/test/db.test.ts`)
- "createRecurringJournal now rejects a start-date entry that is balanced in flat total but NOT balanced within either real currency — the exact gap docs/pm-journal-api.md used to document as open" (`backend/test/db.test.ts`)

## AR/AP entry screens — the shared shape

AR Receipt and AP Payment are cooked into their two general journal lines
when staged (see "Staging"), and posted by `postJournalEntry`.

An invoiced sale or purchase is an invoice posted with its stock
movement by `postOnAccountInvoice` (*Core Domain Reference*,
"Cash Sale and Cash Purchase"). The canned
journal logic for Cash Purchase, Cash Sale and POS Sale lives in
`db.ts` (`completeCashPurchase`, `completePosSale`).

Tests (*Testing: Unit*, "Running the tests"):
- "a realistic set of transactions — cash purchase, cash sale, AR sale, a receipt against it, AP purchase, a payment against it — all post correctly and the full chain (balances, trial balance, balance sheet, P&L) reflects every one of them" (`backend/test/db.test.ts`)
- "AR Sale form: staging and posting creates the correct Debit AR / Credit Sales Revenue entry" (`backend/test/db.test.ts`)
- "AR Receipt form: staging and posting creates the correct Debit Cash / Credit AR entry, reducing the customer balance" (`backend/test/db.test.ts`)
- "AP Purchase form: staging and posting creates the correct Debit expense/asset / Credit AP entry" (`backend/test/db.test.ts`)
- "AP Payment form: staging and posting creates the correct Debit AP / Credit Cash entry, reducing the vendor balance" (`backend/test/db.test.ts`)
- "AR Sale with tax: customer owes amount+tax, tax posts to Sales Tax Payable, everything balances" (`backend/test/db.test.ts`)
- "AP Purchase with tax: Purchases Tax Claimed is debited, vendor is owed amount+tax, everything balances" (`backend/test/db.test.ts`)

## `ensureLocationScopedAccount`

The `"{account} — {location}"` leaf pattern, generalized for an
account with no specific product (AR Sale's generic Sales Revenue, AP
Purchase's chosen expense account). Location is per-invoice, not
per-line.

## Stock/order entry screens — the shared shape

Purchase Order, Sales Order, Stock Receipt and Stock Dispatch are held
as staged forms (see "Staging"). `post...` cooks the form: it places or
fulfils the order, moves the quantity, and posts the monetary side
through `postJournalEntry`. Then it drops the form. A Purchase Order's
`location` is delivery instructions, not a per-line detail.

Tests (*Testing: Unit*, "Running the tests"):
- "complete end-to-end lifecycle: purchase order -> receipt -> sales order -> dispatch/invoice -> cash collected -> vendor paid, every account balance verified at each step" (`backend/test/db.test.ts`)
- "a partial receipt against a purchase order leaves a genuine, correctly-sized back order" (`backend/test/db.test.ts`)
- "a real Purchase Order still knows its real vendor and item after posting — carried by its own real journal entry, no per-order entity of any kind" (`backend/test/db.test.ts`)
- "the four real entry screens: PO -> receipt -> SO -> dispatch, using the actual staging/post functions a person would use, not just the underlying primitives" (`backend/test/db.test.ts`)

## Employee project-clock functions

`clockInToProject` / `clockOutOfProject` /
`getOpenProjectClockForEmployee` — which employee is clocked into
which project, posting the running labor cost against that project's
expense account as time passes.

Tests (*Testing: Unit*, "Running the tests"):
- "clockInToProject/clockOutOfProject and clockPlantIn/clockPlantOut: a real project expense account whose own name contains " — " (provisionProjectProfitCenter's own `${projectName} — Labour & Plant` naming) round-trips correctly — a real, found-and-fixed bug: the clock entity's own name encodes po_reference/account/clockedInAt positionally, separated by the same " — ", and a naive 4-way split silently misparsed clockedInAt as a fragment of the account's own name once the account name carried its own " — "" (`backend/test/db.test.ts`)

## Period-lock functions

`getLedgerDateRange`, `getPeriodLockStatus`, `closePeriod`,
`reopenPeriod`, `assertPeriodOpen` — a ledger's period can be closed
to ordinary posting after a given date (month-end/year-end lock);
`assertPeriodOpen` is the shared guard every posting path calls first.

A ledger is a child of the business's `Ledgers`, not of the business
itself, so `getPeriodLockStatus`, `ensurePeriodLockEntity` and every
other ledger query here (`getLedgerDateRange`, `getJournalEntry`,
`reverseJournalEntry`) look it up there.

Tests (*Testing: Unit*, "Running the tests"):
- "closing a period rejects normal posting into it, and reopening lifts that immediately for a correction" (`backend/test/db.test.ts`)
- "quantity movements and recurring journal start dates are also protected by a closed period, not just ordinary posting" (`backend/test/db.test.ts`)

## `removeStagedLine`

Removes one staged line by reference/business/ledger/account — used
when a person changes their mind about one line before posting the
rest.

Tests (*Testing: Unit*, "Running the tests"):
- "removeStagedLine removes exactly one line" (`backend/test/db.test.ts`)

## `JournalSummary` / `listJournalEntries` / `countJournalEntries` / `JournalDetail` / `getJournalEntry`

The posted entries, a row per occurrence (each date of a recurring
journal is a row), with total debit and credit, description, reference
and who posted it, and one entry in detail.

`JournalSummary.currency` (`null`: the home currency) says how to show
the amounts, as on the Trial Balance: a quantity or storage-space
posting is a whole count, not cents. An entry in several currencies is
a row per currency, never one blended total.

Tests (*Testing: Unit*, "Running the tests"):
- "getJournalEntry returns full line detail with account numbers" (`backend/test/db.test.ts`)
- "a recurring journal expands into the correct number of occurrences, each showing in listJournalEntries" (`backend/test/db.test.ts`)
- "getLedgerDateRange: reports the real, earliest and latest transdate of what has actually been posted" (`backend/test/db.test.ts`)

## `reverseJournalEntry`

Posts the opposite of an entry and links the two: a correction, never
an edit or a delete of the original.

1. The reversal's reference is deterministic, never caller-supplied:
   `` `${original.reference}-REV-${occurrenceDate}` ``.
2. If a journal with that exact reversal reference already exists,
   the function refuses — an entry can only be reversed once; reverse
   the reversal itself to undo it again.
3. Every line is staged again with its sign flipped under the reversal
   reference and posted by `stageLine`/`postJournalEntry`, like any
   other entry.
4. Only after that post succeeds does `reversal_of` get set, on the
   **new reversal row**, pointing back at the **original**'s
   `journal.id`.

Tests (*Testing: Unit*, "Running the tests"):
- "reversing a posted entry creates a new entry with every line negated, and the net effect on balances is exactly zero" (`backend/test/db.test.ts`)
- "reversing a nonexistent occurrence is rejected clearly" (`backend/test/db.test.ts`)
- "reversing the same occurrence twice is rejected clearly — the real bug this prevents silently corrupted journal_line by attaching a second reversals lines to the first one, since the reversal reference is deterministic" (`backend/test/db.test.ts`)
- "reverseJournalEntry: a real year-end close, with activity spread across multiple real divisions rolling into one, single, combined Retained Earnings line, must reverse cleanly and balance to zero" (`backend/test/db.test.ts`)

## `recordInvoiceLine`

Exported from `backend/src/db.ts`; `postOrderReceipt` and
`postOrderDispatch` (`db-journal.ts`) call it after a successful post.
It records one line of narrative detail (description, quantity, unit
price, amount, tax) under `Invoice Lines`, keyed by business, ledger
and reference, which `getInvoiceLine` reads back for printing.

Tests (*Testing: Unit*, "Running the tests"):
- "invoice_line records genuinely per-line tax, never assumed uniform — one line exempt, another at a different rate entirely" (`backend/test/db.test.ts`)
- "an ordinary General Journal posting records no invoice_line at all — it has no invoice concept" (`backend/test/db.test.ts`)

## `stageLocation` / `postLocation`

`stageLocation` holds the screen's input as a staged form ("Staging");
staging the same reference again replaces it. `postLocation` creates
the location with `createLocation`/`setLocation`/
`ensureLocationCapacityAccount`, and posts its opening capacity into
its `Storage Capacity` accounts (`Remaining`, `Installed`, `Occupied`;
`docs/storage-space-as-currency-design.md`), in one transaction, then
drops the form.

It also gives the location a `Belongs To Group` relationship to
itself: `getOrganizationChart` (Business Setup) shows only locations
that have one, and a location that is its own group is how a business
with no groups has one.

Tests (*Testing: Unit*, "Running the tests"):
- "stageLocation/postLocation: the location form is held as a staged form - the location, and its own balanced capacity accounts, only appear once posted, never at stage time" (`backend/test/db.test.ts`)

## Quotations (AR) and RFQs (AP) — `backend/src/db-quotations.ts`

A Quotation (to a customer) or an RFQ (to a provider) is, from the
draft, a journal entry made by `createRecurringJournal`, dated at its
`transdate` (a future date affects no report until a report's range
reaches it), `recurrence: 'once'`, or `'weekly'`/`'monthly'`/`'yearly'`
with a count for a standing quote; and a `postQuantityMovement` on the
item's `On Order` account (`ensureItemQuantityAccounts`), by its
reference. Nothing is staged, and nothing in the schema is its own.

Accepting a quote only sets its `Status`: what it commits was posted
when it was drafted. Rejecting or expiring it reverses both postings
(`reverseJournalEntry`, and the opposite `postQuantityMovement`). A
quote whose date, quantity or price changes is rejected and drafted
again.

The rest of a quote (direction, status, business, ledger,
counterparty, item, quantity, price, location, expiry) is attributes
of its entity (`Entity.setAttr`/`getAttr`, `primitives.ts`): no
`detail_json` and no SQL `UPDATE` in `db-quotations.ts`.

- `createQuotation(input: QuotationInput, userId, expiryDate?,
  recurrence?, recurrenceCount?)` / `createRfq(...)` — post the real
  journal entry (debit customer / credit `Sales Revenue` for a
  Quotation; debit item / credit vendor for an RFQ) and the real On
  Order posting, then create the quote's entity with
  `Direction`/`Status: 'draft'`/`Business`/`Ledger`/`Counterparty`/
  `Item`/`Quantity`/`Price Minor`/`Transdate` (and `Location`/
  `Description`/`Expiry Date` if given) as scalar attributes.
- `getQuotation(reference)` / `listQuotations(business, ledger,
  direction?)` — read the entity's own attributes; nothing to read
  from staging, since none is ever written.
- `markQuotationSent(reference, userId)` — sets `Status: 'sent'`;
  posts nothing further.
- `acceptQuotation(reference, userId)` — sets `Status: 'accepted'`
  only. Refuses an already-`accepted`/`rejected`/`expired` quote.
- `rejectQuotation(reference, userId, asOfDate?)` — finds the journal
  entry by reference (`journal.reference` is unique per business and
  ledger), reverses it, posts the opposite On Order movement, then
  sets `Status: 'rejected'`. Refuses an already-`accepted`/`rejected`/
  `expired` quote.

Calls: `quotationsFunctions` (`call-dispatch/quotations.ts`, through
`POST /api/call`), each behind `requireRole(user, 'Administrator',
'Bookkeeper')`. Screens: `/arap/quotations` (AR) and `/arap/rfq` (AP, a
variant of it), generated from `application/application.entities` with
the `transaction` template: a drafting form plus a list with Mark sent,
Accept and Reject actions.

Tests (*Testing: Unit*, "Running the tests"):
- "a Quotation (AR) is, from the moment it is drafted, a real future-dated journal entry and a real On Order posting — accepting it is a pure status flip, nothing new gets posted" (`backend/test/db.test.ts`)
- "an RFQ (AP) is the same real future-dated journal entry and On Order posting, and rejecting one reverses both — never leaving a half-posted trace" (`backend/test/db.test.ts`)

## The HTTP mounts (`backend/src/server.ts`)

The backend mounts four things, and nothing else:

| Mount | Router | Purpose |
|---|---|---|
| `GET /api/health` | (inline in `server.ts`) | `{ ok, appVersion, dbVersion }`: the `VERSION` file and the Application entity's `Database Version` attribute (`getDbVersion`). |
| `POST /api/call` | `callRouter` (`routes/call.ts`) | The ASCII-CSV call protocol. The first body line is `name,value1,value2,...`; every further line is one line item. `callBackendFunction` (`call-dispatch.ts`) looks the name up in `BACKEND_FUNCTIONS`, which merges the per-domain tables in `call-dispatch/*.ts` (`arapFunctions`, `authFunctions`, `businessesFunctions`, `contactsFunctions`, `customerRegistrationFunctions`, `departmentsFunctions`, `entitiesFunctions`, `hierarchyFunctions`, `i18nFunctions`, `invoicesFunctions`, `itemsFunctions`, `journalFunctions`, `locationsFunctions`, `matrixReportsFunctions`, `menuFunctions`, `periodFunctions`, `plantFunctions`, `posFunctions`, `productsFunctions`, `projectsFunctions`, `prototypesFunctions`, `quotationsFunctions`, `reportsFunctions`, `stockFunctions`, `stockLotsFunctions`). An unknown name is a 404, never evaluated. The mount itself is public; each function that needs a user calls `requireAuth`, `requireRole` or `requireGlobalRole` itself. Started with `MIDDLEWARE=core`, this mount serves the core middleware's `coreCallRouter` instead. |
| `POST /api/core/call` | `coreCallRouter` (`routes/core-call.ts`) | The core middleware's frontend API, always (*The Core Middleware*). |
| `/api/recording` | `recordingRouter` (`routes/recording.ts`), behind `requireAuth` | `GET /api/recording` answers `{ recording: isRecording(user) }`; `POST /api/recording/start` calls `startRecording`; `POST /api/recording/stop` calls `stopRecording`, which closes the file (*Testing: The Test-Runner*, "The recording feature records nothing today"). |

Every line is plain ASCII (`shared-fixtures/csv.ts`, and its copies in `frontend/src/lib/api.ts`, `frontend/src/lib/matrix-api.ts` and `tui/src/api.ts`): a character outside printable ASCII, a line break or a tab included, is written `\u{hex}`, so one record is always one line, even a value holding a whole XML document (an exported e-invoice).

A response is `ok,value1,...` (one line, a `row`) or `ok`, a header line and one line per record (a `table`); an error is `error,message` with the HTTP status (401, 403, 404, 409, 500). Values inside one field that are themselves lists, pairs or trees are packed with the `call-dispatch.ts` codecs, each the inverse of the other:

- `encodeStringList`/`decodeStringList`: a list of strings as one CSV line.
- `encodeShape`/`decodeShape`: a Hierarchy/Product shape, a list of `[name, relation]` pairs, flattened.
- `encodeRecordList`/`decodeRecordList`: a list of records, each an encoded string list of the named fields.
- `encodeCategoryTree`/`decodeCategoryTree`: a financial-statement tree (name, account number, leaf, debit, credit, contra, children), recursively.
- `encodeGenericTree`/`decodeGenericTree`: a cube tree (name, account id, own and total amounts by key, children), recursively.
- `encodeProfitAndLoss` (`call-dispatch/reports.ts`): a Profit and Loss report as one row, its income and expense trees encoded with `encodeCategoryTree`.

Tests (*Testing: Unit*, "Running the tests"):
- "callRouter: a call to an unknown function is a 404, never evaluated" (`backend/test/call-dispatch.test.ts`)
- "the call-dispatch codecs: every decode is the exact inverse of its encode, including commas, quotes and empty values" (`backend/test/call-dispatch.test.ts`)
- "the wire codec keeps a value with line breaks on one line: an XML document goes out and comes back whole" (`backend/test/call-dispatch.test.ts`)
