# The Journal API — `backend/src/db-journal.ts`

## The three posting paths

1. **Ordinary financial postings** (the vast majority): a screen-
   specific staging table's own `INSTEAD OF INSERT` trigger copies
   rows into `journal_entry_staging`, then `INSERT INTO
   post_journal_entry` fires `post_journal_entry_insert`, which
   validates the entry balances (per currency) and the period is
   open, then writes `journal` + `journal_line`, updates
   `account.balance_minor`, then clears staging.
2. **Quantity movements** (stock received/dispatched/transferred): the
   same staging + trigger pair, but `post_quantity_movement` instead
   of `post_journal_entry` — a quantity movement is a single line
   against one product's own tracking account, not a two-sided,
   balanced transaction, so it isn't forced through the balance check.
3. **Recurring journals**: `createRecurringJournal` writes directly to
   `journal`/`journal_line`, never staged at all — see the known gap,
   below.

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

**Known, open gap**: this function bypasses `journal_entry_staging`
and the per-currency balance check `post_journal_entry_insert`
enforces for every other posting path. Its own balance check is a
flat sum across every line with no currency grouping, so a recurring
entry mixing currencies could pass as "balanced" while not being
balanced per currency. `journal_occurrences` performs no currency or
balance check either — there is no secondary safety net.

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
doesn't exist yet, the same guarantee `post_journal_entry`'s own
trigger gives ordinary entries — performed in TypeScript here, since
this path doesn't go through that trigger. Vivifying uses
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

## AR/AP entry screens — the shared shape

AR Sale, AR Receipt, AP Purchase, and AP Payment are each a
purpose-built form with its own staging table (customer/vendor,
amount, date), posting through the same, atomic `post_journal_entry`
mechanism. Two functions per form: `stage...` (plain insert) and
`post...` (fires the form's `INSTEAD OF INSERT` trigger, which builds
the two-line entry and posts it).

**`stageARSale`/`postARSale` and `stageAPPurchase`/`postAPPurchase` no
longer exist** (see the canned-journal-to-frontend design) — confirmed
directly that nothing live called either one (the frontend's own calls
into their routes were already commented out). `stageARReceipt`/
`postARReceipt` and `stageAPPayment`/`postAPPayment` stay exactly as
they were — the Payment Receipt screen genuinely calls them. The real,
live canned-journal logic for Cash Purchase/Cash Sale/POS Sale lives in
`db.ts` (`completeCashPurchase` and similar), on the frontend side, not
here.

## `ensureLocationScopedAccount`

The `"{account} — {location}"` leaf pattern, generalized for an
account with no specific product (AR Sale's generic Sales Revenue, AP
Purchase's chosen expense account). Location is per-invoice, not
per-line.

## Stock/order entry screens — the shared shape

Purchase Order, Sales Order, Stock Receipt, and Stock Dispatch each
stage into their own table; `post...` reads the staged row, does the
real work (placing/fulfilling an order, moving quantity, posting the
monetary side through the ordinary balanced mechanism), then clears
the staged row — the same shape as AR/AP, written as a TypeScript
function instead of a SQL trigger. A Purchase Order's `location` is
delivery instructions, not a per-line detail.

## Employee project-clock functions

`clockInToProject` / `clockOutOfProject` /
`getOpenProjectClockForEmployee` — which employee is clocked into
which project, posting the running labor cost against that project's
expense account as time passes.

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

## `removeStagedLine`

Removes one staged line by reference/business/ledger/account — used
when a person changes their mind about one line before posting the
rest.

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

## `recordInvoiceLine`

Exported from `backend/src/db.ts` so `db-journal.ts`'s own
`postARSale`/`postAPPurchase` can call it after a successful post —
records one line of narrative detail (description, quantity, unit
price, amount, tax) against the underlying invoice these two screens
create, so it shows the same line detail as one built through the
dedicated Invoices screen.

## `stageLocation` / `postLocation`

Every user-facing data-entry form has a dedicated staging table behind
it — `location_staging`, the same shape as `stock_receipt_staging`: a
plain table, no trigger of its own, holding the screen's raw input.

`stageLocation` inserts (or, on conflict, updates) the staged row.
`postLocation` reads it back and is the one place a new location is
actually created, through the typed `createLocation`/`setLocation`/
`ensureLocationCapacityAccount` functions — never a raw SQL insert
into `entities` (append-only and self-auditing by design; there is no
"create entity" SQL statement at all). The balanced opening-capacity
posting into the location's built-in `Storage Capacity` structure
(`Remaining`, `Installed`, `Occupied`; see
`docs/storage-space-as-currency-design.md`) happens atomically, inside
the same transaction as the location's own creation, then the staged
row is cleared.

`postLocation` also sets a `Belongs To Group` relationship on the new
location, unconditionally, pointing at itself. This screen has no
group concept of its own, but `getOrganizationChart` (Business Setup's
"+ Insert employee" tree) only recognizes a location once it carries a
`Belongs To Group` relationship — a single-location group that simply
targets itself is the already-supported case for exactly this (a
business genuinely does not have to have any groups at all). Setting
it here too keeps a location created through this screen just as
reachable from Business Setup as one created directly through it.

## Express routers — the full current mount table

Every `xxxRouter` constant (`backend/src/routes/*.ts`) is a plain
Express `Router()` instance, mounted at its own path in
`backend/src/server.ts`:

| Router | File | Mounted at | Purpose |
|---|---|---|---|
| `authRouter` | `auth.ts` | `/api/auth` | Login, logout, session/business selection, own-user settings — public `/login`, everything else its own, per-route `requireAuth`. |
| `entitiesRouter` | `entities.ts` | `/api/entities` | The Entity Tree Editor's own generic create/reorder/relationship endpoints. |
| `reportsRouter` | `reports.ts` | `/api/reports` | Trial Balance, Balance Sheet, Profit and Loss, and the other general financial reports. |
| `matrixReportsRouter` | `matrix-reports.ts` | `/api/reports/matrix` | Sales/COGS and Stock-on-Hand matrix reports, by division/location axis. |
| `menuRouter` | `menu.ts` | `/api/menu` | A business's own configured menu tree, with any per-role overrides applied. |
| `i18nRouter` | `i18n.ts` | `/api/i18n` | Languages, translations, and text direction — the one public (no login) router, since the login page itself needs translated text. |
| `businessesRouter` | `businesses.ts` | `/api/businesses` | Create/list businesses, business types, bank accounts, the Business Configuration Report. |
| `journalRouter` | `journal.ts` | `/api/journal` | Posted Journal Entries — listing and detail. |
| `contactsRouter` | `contacts.ts` | `/api/contacts` | Named contacts and their typed views (Vendor/Customer/Employee). |
| `itemsRouter` | `items.ts` | `/api/items` | Sellable/stockable items, categories, vendor sources. |
| `productsRouter` | `products.ts` | `/api/products` | Product groupings above individual items, for reporting. |
| `invoicesRouter` | `invoices.ts` | `/api/invoices` | AR/AP invoices — creation, listing, e-invoicing (UBL) export/import. |
| `agedRouter` | `invoices.ts` | `/api/reports/aged` | Aged Payables/Receivables. |
| `statementRouter` | `invoices.ts` | `/api/reports/statement` | A customer/vendor's own account statement. |
| `historyRouter` | `invoices.ts` | `/api/reports/history` | A contact's own transaction history. |
| `remindersRouter` | `invoices.ts` | `/api/reminders` | Scheduled payment-reminder tracking. |
| `stockLotsRouter` | `stock-lots.ts` | `/api/stock-lots` | Lot-tracked stock detail. |
| `locationsRouter` | `locations.ts` | `/api/locations` | Locations — creation, currencies, receiving/dispatch, transfer, restocking, open hours/schedule. |
| `belowReorderRouter` | `locations.ts` | `/api/reports/below-reorder` | Items below their own reorder point. |
| `stockOutRiskRouter` | `locations.ts` | `/api/reports/stock-out-risk` | Items at risk of a stock-out, by projected usage. |
| `stockListingRouter` | `locations.ts` | `/api/stock-listing` | The full Inventory Listing report. |
| `stockTakesRouter` | `locations.ts` | `/api/stock-takes` | Physical stock-take counts and their reconciliation. |
| `posRouter` | `pos.ts` | `/api/pos` | Point-of-Sale terminals, sign-on/off, sales. |
| `customerRegistrationRouter` | `customer-registration.ts` | `/api/customers` | Public, self-service customer registration — no staff login required. |
| `customerVerificationRouter` | `customer-registration.ts` | `/api/customer-verification` | Verifying a pending customer registration. |
| `arAPRouter` | `arap.ts` | `/api/arap` | Cash Purchase/Cash Sale — the direct, one-step AR/AP posting screens. |
| `projectsRouter` | `projects.ts` | `/api/projects` | Projects and their tasks. |
| `stockRouter` | `stock.ts` | `/api/stock` | Stock receipts, write-offs, expiration tracking. |
| `invoiceRouter` | `invoice.ts` | `/api/invoice` | A single invoice's own outstanding balance. |
| `periodRouter` | `period.ts` | `/api/period` | Financial-period/year-end configuration. |
| `hierarchyRouter` | `hierarchy.ts` | `/api/hierarchy` | A business's own named Hierarchies (e.g. Division/Category) and their groups, plus Vocabulary. |
