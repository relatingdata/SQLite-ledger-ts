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

Tests (`backend/test/db.test.ts`): "journal_entry_staging is the only
staging table: every transaction is a cooked general journal entry", "an
AR receipt and an AP payment are cooked into general journal lines when
staged", and "posting a screen with nothing staged is rejected clearly,
not silently a no-op".

## The three posting paths

Every posting is TypeScript, not a trigger: `commitStagedEntry`
(`db-journal.ts`) resolves the business, ledger and account ids first,
then writes `journal`, `journal_line` and the stored balances in one
`db.transaction(...)`. It is called two ways, and recurring journals are
a third path:

1. **Ordinary financial postings** (the vast majority): the screen's
   transaction is cooked into `journal_entry_staging` (see "Staging"
   above), and the commit step is
   `postJournalEntry(reference, business, ledger, userId)`, a plain
   TypeScript call into `commitStagedEntry(..., { requireBalance: true,
   includeBankReference: true })` — it validates the entry balances
   (per currency) and the period is open, then writes `journal` +
   `journal_line`, updates `account.balance_minor`, then clears
   staging, in that order, inside one `db.transaction(...)`. Entity
   resolution (business/ledger/account ids, via
   `resolveStagingBusinessId`/`resolveStagingLedgerId`/
   `resolveStagedAccountId` below) happens first, before that
   transaction ever opens.
2. **Quantity movements** (stock received/dispatched/transferred): the
   same staging pipeline, but the commit step is the new, separately
   exported `commitStagedQuantityMovement(reference, business, ledger,
   userId)`, calling the same shared `commitStagedEntry` with `{
   requireBalance: false, includeBankReference: false }` — a quantity
   movement is a single line against one product's own tracking
   account, not a two-sided, balanced transaction, so it isn't forced
   through the balance check, and its own `journal_line` insert never
   carried a `bank_reference` either. `Balance.post`
   (`primitives.ts`) and `db-stock.ts`'s `postStagedQuantityMovement`
   both call it.
3. **Recurring journals**: `createRecurringJournal` writes directly to
   `journal`/`journal_line`, never staged at all — deliberately, not a
   gap. A recurring entry's real "balance" was never the kind of thing
   `journal_entry_staging`/`commitStagedEntry` exist to check once:
   `journal_occurrences` (00-core.sql) expands the one stored line set
   into every scheduled occurrence at read time, resolving each line to
   whichever `effective_date` is current as of that occurrence — the
   same mechanism every report, the journal list, and account balances
   already read through for every ledger, recurring or not. Routing a
   12-month schedule through the ordinary commit step would try to
   apply its whole staged sum once, immediately, which is simply the
   wrong operation for a template with its own expansion view — not a
   stricter version of the same one. See `RecurringJournalLine`/
   `Recurrence`/`createRecurringJournal` below for what *was* a real
   gap here (now fixed) and what's still open.

Tests:
- "staging + posting a balanced entry works end to end and clears staging" (`backend/test/db.test.ts`)
- "posting an unbalanced entry is rejected and leaves staging untouched" (`backend/test/db.test.ts`)
- "an account is vivified on first post and gets a real balance" (`backend/test/db.test.ts`)
- "journal postings record who posted them — the other half of the audit trail, alongside entities own append-only history" (`backend/test/db.test.ts`)
- "postJournalEntry: a real multi-currency entry must balance independently per currency — the exact danger this catches: an EUR imbalance masked by an offsetting USD imbalance must never pass" (`backend/test/db.test.ts`)

### `resolveStagingBusinessId` / `resolveStagingLedgerId` /
### `resolveStagedAccountId` / `commitStagedEntry`

Entity resolution for a staged entry, ported from the two removed
triggers' own shared `COALESCE` chains: business/ledger id lookup, and
the per-line account fallback (a business-scoped Chart-of-Accounts walk
first, then a bare, unscoped name lookup as a last resort for the one
legacy business with no CoA copy of its own — deliberately still
unordered/undisambiguated, matching the original trigger's own
`LIMIT 1` with no `ORDER BY`, a known, pre-existing weakness, not
something this conversion tried to fix). Originally raw, read-only SQL
directly against `current_entities` ("byte-for-byte identical to the
replaced trigger"); converted to go through `Entity.get`/`getUnder`/
`descendantsWithDepth` (Stage E) once it was confirmed none of the
three actually joins `current_entities` against `account`/`journal` in
the same statement (the real category-4 pattern the plan reserves for
raw SQL) and all three already run before `commitStagedEntry`'s own
write transaction opens — the exact ordering the plan calls for, so
routing them through a driver that may call out to a non-SQL backend is
safe here. This was also the fix that unblocked ordinary postings under
`ENTITY_DRIVER=kaappi` — until converted, every business/account
created live under that driver was invisible to these three functions,
since Kaappi-mode entity writes never touch `current_entities` at all.
`commitStagedEntry` itself (the lock check, balance validation, account
vivification, `journal`/`journal_line` writes, balance updates, staging
cleanup) stays exactly as Stage D wrote it — only the entity-resolution
helpers above changed.

## `StagedLine` / `stageLine`

Fields: `reference`, `business`, `ledger`, an optional
`description`/`transdate`, `account` (and optional `accountId`, set
directly by `findLedgerScopedAccount` when a ledger-scoped posting
account already exists for this `(ledger, account)` pair),
`amount_minor`, an optional `memo`/`bankReference`. No `division`
field, and no Cost-Center/Profit-Center distinction, anywhere in this
file — Division/Profit-Center scoping is the separate hierarchy-link
mechanism (see "Hierarchies" in the Domain Reference chapter and
`docs/profit-centers-design.md`), applied to *accounts*, never
enforced inside `stageLine` against staged lines.

`stageLine` inserts, or on conflict updates, one row in
`journal_entry_staging`, keyed on `(reference, business, ledger,
account, account_id, location)` — two lines against the same bare
account name in one entry only collide if they also share the same
resolved `account_id` and `location`.

### `findLedgerScopedAccount`

Resolves an already-existing, ledger-scoped posting-account node for
`(accountName, ledger)` — never creates one. Only the explicit,
structural rollover phase creates these nodes (see the ledger-scoped
accounts and rollover design); an ordinary posting must never create
one lazily, the same way it must never silently acquire its own,
separate Balance Sheet carried forward. The node is a child of the CoA
leaf itself (`parent_id`) — a genuine descendant of Chart of Accounts,
so every existing report's tree walk already finds it with no changes
elsewhere — named after, and pointing via `relation_id` at, the ledger
it belongs to. Returns `undefined` when no such node exists yet, so
the caller falls back to the ordinary, bare CoA-leaf resolution
unchanged — the normal, correct behavior for a business with only ever
one ledger in use, exactly like the tutorial.

## `getStagedLines`

Every currently-staged line for one `reference`/`business`/`ledger` —
what a screen shows before the person confirms the post.

## `RecurringJournalLine` / `Recurrence` / `createRecurringJournal`

**Fixed, previously a real gap**: this function deliberately bypasses
`journal_entry_staging` (see above — a recurring entry isn't staged at
all, by design), but its own start-date balance check used to be a
flat sum across every line with no currency grouping, so a recurring
entry genuinely mixing currencies could have passed as "balanced"
while not actually balancing in either currency on its own.
`commitStagedEntry` checks every ordinary posting per currency, and
`createRecurringJournal` now does the same grouping directly, in TypeScript, before writing anything: every
referenced account is resolved and vivified first (inside the same
transaction), each line effective at the start date is bucketed by its
own account's real `currency` (NULL/home-currency is its own bucket),
and the whole write
is rejected — nothing inserted — the moment any one bucket doesn't sum
to zero. `journal_occurrences` itself still performs no currency or
balance check of its own for later occurrences — it only ever expands
rows that already passed this check at creation time, as an ordinary
journal's `journal_line` rows only ever contain what passed
`commitStagedEntry`.

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

The current function does vivify every referenced account that
doesn't exist yet, the same guarantee `commitStagedEntry` gives
ordinary entries. Vivifying uses
`resolveBusinessCoaAccountId`, not a bare, unscoped name lookup — a
bare lookup is only safe while `line.account` names exactly one entity
anywhere, true only for the very first business that ever used a given
account name (e.g. "Rent"). Every other business gets its own mirror
of the same name, so an unscoped lookup could silently vivify an
`account` row for some *other* business's own account, never this
one's. `resolveBusinessCoaAccountId` is the same business-scoped
resolution used throughout `db.ts`, with its own documented global
fallback for an account genuinely outside this business's own CoA
mirror (AR/AP, a counterparty name).

Tests:
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

An invoiced sale or purchase is an invoice (`createInvoice`, then
`postInvoiceById`; *Core Domain Reference*, "Invoices"). The canned
journal logic for Cash Purchase, Cash Sale and POS Sale lives in
`db.ts` (`completeCashPurchase`, `completePosSale`).

Tests:
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

Tests:
- "complete end-to-end lifecycle: purchase order -> receipt -> sales order -> dispatch/invoice -> cash collected -> vendor paid, every account balance verified at each step" (`backend/test/db.test.ts`)
- "a partial receipt against a purchase order leaves a genuine, correctly-sized back order" (`backend/test/db.test.ts`)
- "a real Purchase Order still knows its real vendor and item after posting — carried by its own real journal entry, no per-order entity of any kind" (`backend/test/db.test.ts`)
- "the four real entry screens: PO -> receipt -> SO -> dispatch, using the actual staging/post functions a person would use, not just the underlying primitives" (`backend/test/db.test.ts`)

## Employee project-clock functions

`clockInToProject` / `clockOutOfProject` /
`getOpenProjectClockForEmployee` — which employee is clocked into
which project, posting the running labor cost against that project's
expense account as time passes.

Tests:
- "clockInToProject/clockOutOfProject and clockPlantIn/clockPlantOut: a real project expense account whose own name contains " — " (provisionProjectProfitCenter's own `${projectName} — Labour & Plant` naming) round-trips correctly — a real, found-and-fixed bug: the clock entity's own name encodes po_reference/account/clockedInAt positionally, separated by the same " — ", and a naive 4-way split silently misparsed clockedInAt as a fragment of the account's own name once the account name carried its own " — "" (`backend/test/db.test.ts`)

## Period-lock functions

`getLedgerDateRange`, `getPeriodLockStatus`, `closePeriod`,
`reopenPeriod`, `assertPeriodOpen` — a ledger's period can be closed
to ordinary posting after a given date (month-end/year-end lock);
`assertPeriodOpen` is the shared guard every posting path calls first.

A ledger is a structural child of `Ledgers`, never of the business
entity directly — `getPeriodLockStatus` and `ensurePeriodLockEntity`
both resolve the ledger entity through that intermediate `Ledgers`
level, the same way every other ledger-scoped query in this file does
(`getLedgerDateRange`, `getJournalEntry`, `reverseJournalEntry`); a
lookup that skips it will never find the ledger at all.

Tests:
- "closing a period rejects normal posting into it, and reopening lifts that immediately for a correction" (`backend/test/db.test.ts`)
- "quantity movements and recurring journal start dates are also protected by a closed period, not just ordinary posting" (`backend/test/db.test.ts`)

## `removeStagedLine`

Removes one staged line by reference/business/ledger/account — used
when a person changes their mind about one line before posting the
rest.

Tests:
- "removeStagedLine removes exactly one line" (`backend/test/db.test.ts`)

## `JournalSummary` / `listJournalEntries` / `countJournalEntries` / `JournalDetail` / `getJournalEntry`

Listing and detail views over posted journal entries — one row per
occurrence (a recurring journal's own multiple, computed dates each
get their own row), with total debit/credit, description, reference,
and who posted it.

`JournalSummary.currency` matches the Trial Balance's own approach: a
quantity or storage-space posting is a plain, whole count, never a
dollar figure divided by 100 — this field (`null` meaning the
business's home currency) tells the caller which formatting applies.
One journal entry spanning more than one currency produces one row
per currency here, never a single, blended total.

Tests:
- "getJournalEntry returns full line detail with account numbers" (`backend/test/db.test.ts`)
- "a recurring journal expands into the correct number of occurrences, each showing in listJournalEntries" (`backend/test/db.test.ts`)
- "getLedgerDateRange: reports the real, earliest and latest transdate of what has actually been posted" (`backend/test/db.test.ts`)

## `reverseJournalEntry`

Posts a balanced, opposite entry against the original, then marks it
— a correction, never a silent edit or delete of the original record.

1. The reversal's reference is deterministic, never caller-supplied:
   `` `${original.reference}-REV-${occurrenceDate}` ``.
2. If a journal with that exact reversal reference already exists,
   the function refuses — an entry can only be reversed once; reverse
   the reversal itself to undo it again.
3. Every original line is staged again with its sign flipped
   (`-line.amount_minor`) under the new reversal reference, then
   posted through the ordinary `stageLine`/`postJournalEntry` path — a
   reversal is an ordinary balanced entry whose lines are computed
   from another one, not a special internal mechanism.
4. Only after that post succeeds does `reversal_of` get set, on the
   **new reversal row**, pointing back at the **original**'s
   `journal.id`.

Tests:
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

Tests:
- "invoice_line records genuinely per-line tax, never assumed uniform — one line exempt, another at a different rate entirely" (`backend/test/db.test.ts`)
- "an ordinary General Journal posting records no invoice_line at all — it has no invoice concept" (`backend/test/db.test.ts`)

## `stageLocation` / `postLocation`

`stageLocation` holds the screen's input as a staged form (see
"Staging"); staging the same reference again replaces it.
`postLocation` reads it back and is the one place a new location is
actually created, through the typed `createLocation`/`setLocation`/
`ensureLocationCapacityAccount` functions — never a raw SQL insert
into `entities` (append-only and self-auditing by design; there is no
"create entity" SQL statement at all). The balanced opening-capacity
posting into the location's built-in `Storage Capacity` structure
(`Remaining`, `Installed`, `Occupied`; see
`docs/storage-space-as-currency-design.md`) happens atomically, inside
the same transaction as the location's own creation, then the staged
form is dropped.

`postLocation` also sets a `Belongs To Group` relationship on the new
location, unconditionally, pointing at itself. This screen has no
group concept of its own, but `getOrganizationChart` (Business Setup's
"+ Insert employee" tree) only recognizes a location once it carries a
`Belongs To Group` relationship — a single-location group that simply
targets itself is the already-supported case for exactly this (a
business genuinely does not have to have any groups at all). Setting
it here too keeps a location created through this screen just as
reachable from Business Setup as one created directly through it.

Tests:
- "stageLocation/postLocation: the location form is held as a staged form - the location, and its own balanced capacity accounts, only appear once posted, never at stage time" (`backend/test/db.test.ts`)

## Quotations (AR) and RFQs (AP) — `backend/src/db-quotations.ts`

A Quotation (to a customer) or RFQ (to a provider) is, from the moment
it is drafted, a real journal entry — `createRecurringJournal`
(unmodified), dated at its `transdate` (which may be in the future,
with zero effect on any report until that date falls inside a query's
own range), `recurrence: 'once'` for an ordinary quote or `'weekly'`/
`'monthly'`/`'yearly'` + a count for a standing one — plus a real
`postQuantityMovement` against the item's own, existing `On Order`
account (`ensureItemQuantityAccounts`), tagged by reference. There is
no staging step: neither a staged form nor `journal_entry_staging` plays
any part in a Quotation/RFQ. Per direct instruction, this
introduces no new SQL table, no new column, and no schema change of
any kind — every moving part here (`createRecurringJournal`,
`reverseJournalEntry`, `ensureItemQuantityAccounts`,
`postQuantityMovement`) already existed before this file did.

"Accepting" a quote changes nothing about what's already posted — the
real commitment (the journal entry and the On Order posting) exists
from draft time, so accepting is a pure `Status` flip. "Rejecting"/
"expiring" reverses both real postings: the journal entry via the
existing `reverseJournalEntry`, and the On Order posting via an equal,
opposite `postQuantityMovement` — no new logic, both pre-existing
mechanisms used exactly as they already are everywhere else. A
quotation whose circumstances change (different date/quantity/price)
is handled the same way: reject (reverse), then draft a fresh one.

Every fact a quote needs beyond the real journal entry itself —
direction, status, business/ledger, counterparty, item, quantity,
price, location, an optional expiry — is a scalar child entity via the
existing, generic `Entity.setAttr`/`getAttr` primitives
(`primitives.ts`). Per direct instruction, none of this uses
`detail_json`/JSON of any kind or a raw SQL `UPDATE` (an upsert's own
`ON CONFLICT DO UPDATE` included) anywhere in `db-quotations.ts`.

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
- `rejectQuotation(reference, userId, asOfDate?)` — looks the real
  journal entry up by reference (`journal.reference` is unique per
  business/ledger, the same guarantee the old sales order staging key gave),
  calls `reverseJournalEntry` against it, posts an equal/opposite
  `postQuantityMovement` on the item's On Order account, then sets
  `Status: 'rejected'`. Refuses an already-`accepted`/`rejected`/
  `expired` quote.

Calls: `quotationsFunctions` (`call-dispatch/quotations.ts`, through
`POST /api/call`), each behind `requireRole(user, 'Administrator',
'Bookkeeper')`. Screens: `/arap/quotations` (AR) and `/arap/rfq` (AP, a
variant of it), generated from `application/application.entities` with
the `transaction` template: a drafting form plus a list with Mark sent,
Accept and Reject actions.

Tests:
- "a Quotation (AR) is, from the moment it is drafted, a real future-dated journal entry and a real On Order posting — accepting it is a pure status flip, nothing new gets posted" (`backend/test/db.test.ts`)
- "an RFQ (AP) is the same real future-dated journal entry and On Order posting, and rejecting one reverses both — never leaving a half-posted trace" (`backend/test/db.test.ts`)

## The HTTP mounts (`backend/src/server.ts`)

The backend mounts four things, and nothing else:

| Mount | Router | Purpose |
|---|---|---|
| `GET /api/health` | (inline in `server.ts`) | `{ ok, appVersion, dbVersion }`: the `VERSION` file and `db_version.version`. |
| `POST /api/call` | `callRouter` (`routes/call.ts`) | The ASCII-CSV call protocol. The first body line is `name,value1,value2,...`; every further line is one line item. `callBackendFunction` (`call-dispatch.ts`) looks the name up in `BACKEND_FUNCTIONS`, which merges the per-domain tables in `call-dispatch/*.ts` (`arapFunctions`, `authFunctions`, `businessesFunctions`, `contactsFunctions`, `customerRegistrationFunctions`, `departmentsFunctions`, `entitiesFunctions`, `hierarchyFunctions`, `i18nFunctions`, `invoicesFunctions`, `itemsFunctions`, `journalFunctions`, `locationsFunctions`, `matrixReportsFunctions`, `menuFunctions`, `periodFunctions`, `plantFunctions`, `posFunctions`, `productsFunctions`, `projectsFunctions`, `prototypesFunctions`, `quotationsFunctions`, `reportsFunctions`, `stockFunctions`, `stockLotsFunctions`). An unknown name is a 404, never evaluated. The mount itself is public; each function that needs a user calls `requireAuth`, `requireRole` or `requireGlobalRole` itself. Started with `MIDDLEWARE=core`, this mount serves the core middleware's `coreCallRouter` instead. |
| `POST /api/core/call` | `coreCallRouter` (`routes/core-call.ts`) | The core middleware's frontend API, always (*The Core Middleware*). |
| `/api/recording` | `recordingRouter` (`routes/recording.ts`), behind `requireAuth` | `GET /api/recording` answers `{ recording: isRecording(user) }`; `POST /api/recording/start` calls `startRecording`; `POST /api/recording/stop` calls `stopRecording`, which writes the recorded calls out (*Testing*, "The Admin recording feature"). |

A response is `ok,value1,...` (one line, a `row`) or `ok`, a header line and one line per record (a `table`); an error is `error,message` with the HTTP status (401, 403, 404, 409, 500). Values inside one field that are themselves lists, pairs or trees are packed with the `call-dispatch.ts` codecs, each the inverse of the other:

- `encodeStringList`/`decodeStringList`: a list of strings as one CSV line.
- `encodeShape`/`decodeShape`: a Hierarchy/Product shape, a list of `[name, relation]` pairs, flattened.
- `encodeRecordList`/`decodeRecordList`: a list of records, each an encoded string list of the named fields.
- `encodeCategoryTree`/`decodeCategoryTree`: a financial-statement tree (name, account number, leaf, debit, credit, contra, children), recursively.
- `encodeGenericTree`/`decodeGenericTree`: a cube tree (name, account id, own and total amounts by key, children), recursively.
- `encodeProfitAndLoss` (`call-dispatch/reports.ts`): a Profit and Loss report as one row, its income and expense trees encoded with `encodeCategoryTree`.

Tests:
- "callRouter: a call to an unknown function is a 404, never evaluated" (`backend/test/call-dispatch.test.ts`)
- "the call-dispatch codecs: every decode is the exact inverse of its encode, including commas, quotes and empty values" (`backend/test/call-dispatch.test.ts`)
