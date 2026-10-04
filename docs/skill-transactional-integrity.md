## Transactional integrity — an absolute, non-negotiable requirement

Per direct instruction, stated in the strongest possible terms, and recorded here
permanently, not as a preference: **every time a person hits Save or Submit anywhere
in this application, there must be an absolute, ironclad guarantee that a real
transaction has been successfully committed, or a real, clear message telling them
their data failed to be stored, and why.** There is no acceptable third outcome —
never a silent partial success, never a save that "mostly" happened.

**Everything that manipulates real business data must be wrapped in a real database
transaction.** A compound operation — one that performs more than one real write
(more than one `INSERT`/`UPDATE`/`DELETE`, more than one `create`/`createEntity`/
`updateEntity` call) — must either fully apply or fully not apply. A crash, an
exception, or a rejected write partway through must never leave some of its real
writes committed and others not.

### What counts as real, financial data — the full, real scope

Per direct, absolute instruction: **anything that involves a currency amount, a
stock unit, or a unit of shelving/storage space is real, financial data**, and
must be held to the exact, same integrity guarantee as a dollar amount in the
journal. A stock quantity and a location's own remaining shelf/carton capacity
are not "just numbers" — they represent real, quantifiable business value
(inventory on hand, storage genuinely committed) exactly the way a currency
balance does, and a partial, uncommitted, or silently-diverged write to either
is exactly as real a data-integrity failure as an unbalanced journal entry.
This is why `post_quantity_movement_insert` (the real, single-line quantity
trigger) exists as a real, first-class sibling to `post_journal_entry_insert`,
not an afterthought — and why every real function in
`backend/src/db-stock.ts` wrapped in a transaction earlier in this same
session (`receiveItems`, `dispatchItems`,
`transferItems`, `placeOrder`, `fulfillOrder`) was genuinely required by this
skill, not merely good practice.

### Every real stock movement must post exactly three (or four) real "lots" — a real, absolute requirement, not yet fully implemented

Per direct, absolute instruction: **whenever a bottle or carton is received,
sold, transferred, or written off, the corresponding journal must show real,
distinct "lots" (journal lines) in each of these real, separate currencies —
never blended into one, meaningless combined total**:

1. **Dollars** — the real, genuine financial value of the movement.
2. **Bottles or Cartons** — the real, physical unit count (whichever real unit
   this specific item is actually tracked in).
3. **Space for Bottles or Cartons** — the real, physical storage capacity
   consumed or freed, itself real, distinctly split into **Hot** and **Cold**
   (real, separate storage pools, never combined — a wine cellar's ordinary
   shelf space and its real refrigerated space are not interchangeable).

**Checked directly, and confirmed as a real, open gap, not yet fixed**: today,
quantity-tracking accounts (`On Order`, `Units Sold`, `Count Adjustment`,
`Write-off`, every capacity account) are created via `Entity.create` with
**no distinct currency tag at all** — no `setAccountCurrency` call anywhere
for them. `post_quantity_movement_insert` inserts these postings into the
exact, same `journal`/`journal_line` tables, using the exact, same
`amount_minor` column, real dollar postings use — a bottle count of 50 and
$0.50 are structurally indistinguishable in that column today. Because
neither carries a distinct currency, `getTrialBalance`'s own real
`by_currency` breakdown silently folds quantity counts into the same bucket
as real, plain home-currency dollar amounts, and the real, required third and
fourth "lots" (space, hot vs. cold) are not consistently posted by every real
stock-movement function today (`receiveItems` posts a quantity
movement, a capacity adjustment, and *optionally* a dollar-value line only
when combination data is present — never a real, guaranteed three-or-four-lot
set on every real movement).

**The real, planned fix, now partly implemented and confirmed working**:
1. **Done, confirmed by a real, direct test**: opening storage capacity is
   never single-sided. `ensureLocationCapacityAccount` now creates a real,
   distinct "Storage Capacity Installed" counterpart alongside "Storage
   Capacity Remaining," and posts the real opening value as a genuine,
   balanced, two-line entry through the exact, same, real staging mechanism
   (`stageLine`/`postJournalEntry`) every other real posting uses — never a
   bare, single-sided `Balance.post` — the exact, same shape as an owner's
   real, initial cash contribution (debit Cash, credit Owner's Equity). Both
   accounts are tagged with their own, real, distinct currency
   (`SPACE-BOTTLE`/`SPACE-CARTON`), so `getTrialBalance`'s own `by_currency`
   breakdown genuinely, correctly separates real storage space from real
   dollars. Per direct instruction, this now happens atomically, as part of
   `createAndConfigureLocation` itself — never lazily, the first time some
   later, real stock movement happens to touch the location.
   `ensureItemQuantityAccounts` similarly tags every real quantity account
   (`On Order`, `Units Sold`, `Count Adjustment`, `Write-off`) with the
   item's own real unit of measure. A real, further, confirmed bug found and
   fixed along the way: `setAccountCurrency`'s own bare, name-based lookup is
   genuinely ambiguous now that account names like "Storage Capacity
   Remaining" legitimately repeat per-location — given an optional, real
   `entityId` parameter to disambiguate, exactly the same class of fix
   applied throughout this whole session.
2. **Not yet done — an attempted fix was built, then fully reverted**: Min/
   Max/Reorder/Shelf Level figures remain posted through `Balance.post`/the
   journal today, despite being real configuration settings, not real
   movements. A real attempt to move them into the `Detail` primitive was
   built and directly tested, then removed in full, per direct instruction
   that `Detail` itself had never been properly, formally designed and
   approved — "if it has not been designed it does not exist." `git checkout`
   restored the affected files to their last, committed state. The real,
   correct fix — moving these out of the journal entirely — remains open,
   pending a real, proper design for whatever mechanism replaces `Balance.post`
   here (which may or may not end up being `Detail`, once `Detail` itself has
   a real design of its own).
3. **Not yet done**: auditing every real stock-movement function
   (`receiveItems`, `dispatchItems`, `transferItems`,
   `writeOffItems`, `completeStockTake`) to guarantee each one always posts
   the full, real set of required lots (dollars, units, and space) for that
   kind of movement — today, only some of these are consistently posted.
4. **Done for the Trial Balance screen** — found, by direct, close inspection prompted
   directly, to have been left half-finished: `getTrialBalance` (`backend/src/db-reports.ts`)
   already computed `TrialBalance.by_currency` correctly — confirmed directly, by calling it and
   reading its real return value — but the real screen a person actually sees
   (`frontend/src/routes/reports/trial-balance/+page.svelte`) never read that field at all, and the
   frontend's own, separately-maintained `TrialBalance`/`TrialBalanceRow` interfaces
   (`frontend/src/lib/api.ts`) didn't even declare `by_currency`, `currency`, or
   `has_quantity_postings` as fields, despite the backend already returning all three on every
   request. Checking that a backend function returns the right value is not the same claim as
   checking that a person sees it — an earlier report of this feature "working" rested only on the
   first, not the second, and was wrong to claim both.

   **Fixed, per the User Manual's own "Trial Balance" section, now the complete, descriptive
   specification this screen is built against** (not a design-ahead-of-implementation note — the
   mechanism already existed): the frontend interfaces were corrected to declare the fields the
   backend already sends; the screen now groups every row by its own real `currency`, shows each
   group's own subtotal and `balanced` flag with a visible warning when a group does not balance,
   marks any row with `has_quantity_postings` set, and shows the combined, all-currency total only
   when exactly one currency is present for the business/ledger being viewed — summing different
   currencies together, as the screen did before this fix, is not a real number.

   **The Inventory Listing report's own equivalent work remains not yet done** — this pass covered
   only the Trial Balance screen, per what was directly asked; `getInventoryListing`'s own rows
   carry a `min_level`/`max_level`/`reorder_level` shape with no currency field at all today, and
   have not been checked for the same gap.
5. **A real, further, separate, confirmed gap, raised directly and not yet
   designed**: storage capacity today is two, fixed fields per location
   (bottle/carton, with separate hot/cold variants) — the real, better design
   discussed is flexible, named Storage Zones per location (however many a
   business actually needs — "Ambient," "Cold," "Secure," and so on), each
   with its own real capacity, its own optional real maximum bottle size, and
   its own real, distinct currency tag — genuinely generalizing "hot vs.
   cold" rather than hardcoding exactly two zones. Not yet implemented; a
   full, real design write-up was offered and not yet started.

### The real, confirmed, current state — found directly, not assumed

Checked directly against the real code: only **four** real operations in this entire
backend are currently wrapped in an explicit, atomic `db.transaction(...)` — a POS
sale, a Cash Purchase, paying employee wages, and posting a journal entry
(`backend/src/db.ts`). Every other real, compound, multi-write function — including
`createBusiness` itself, which performs many, real, separate writes (the business
entity, two real ledgers, every real `PER_BUSINESS_ROOTS` entry, Chart of Accounts
instantiation, equity structure) — is **not** wrapped in a transaction today. Each
individual SQL statement is, by SQLite's own nature, atomic on its own, but the real,
full sequence is not: a real crash or a real, thrown exception partway through
leaves whatever already committed permanently committed, with no real, further
step undoing it.

This is the real, confirmed, root mechanism behind a real, concrete, observed
symptom from this same session: a Playwright test crashing mid-flow left a real,
partially-created business in the database; re-running the same test from scratch
then collided with its own, earlier, half-finished attempt (`"Wine Retail Business"
already exists`) — not a flaw in the test, a real, direct consequence of this gap.

### The real, required fix, going forward

- Every real, compound, business-data-writing function gets wrapped in
  `db.transaction(() => { ... })` (or the equivalent, if a different real mechanism
  is more appropriate for a specific real case) — no further, real, compound write
  function should be added without this from now on.
- Every real route handler that can fail after a real write has already happened
  must return a real, clear, honest error the frontend can show directly — never a
  silently swallowed exception, never a generic, unhelpful message that hides
  whether the person's own real data was actually saved.
- The real, existing four (`db.transaction` around POS sale, Cash Purchase, pay
  wages, journal posting) were chosen because they are financial postings, where a
  partial write would be genuinely, financially dangerous — but this reasoning
  under-scoped the real requirement: a partially-created business, a partially-set
  set of item-location levels, a partially-nominated bank account are every bit as
  real a data-integrity failure as half a journal entry, just not immediately,
  visibly a financial one.

### Real, honest scope — progress so far

Fixed and verified, each with a real, deliberately-forced-failure test proving
rollback, not just asserting it: `createBusiness`, `postInvoice`, `allocatePayment`.
`createInvoice` wrapped (its own real, obvious failure points are all checked
*before* the transaction opens, by design, so no natural mid-transaction trigger has
yet been found to prove it the same way — recorded honestly in
docs/documentation-debt-tally.md rather than left unstated).

Also wrapped, in `backend/src/db-stock.ts` — the real, everyday stock-movement
functions behind Receiving, Dispatch, Transfer, and Purchase Orders:
`receiveItems` (also had its own real, stale doc comment brought up to
date — it never mentioned the real capacity adjustment or combination-value
posting it's always done), `dispatchItems`, `transferItems`,
`placeOrder`, `fulfillOrder`.

**A real, important, confirmed finding**: `postAPPayment` (and the same pattern
wherever else it appears — `ap_payment_post`, `journal` itself, and any other
`INSTEAD OF INSERT` view+trigger pair) does **not** need an explicit
`db.transaction()` wrap at all. A single `INSERT` statement that fires an `INSTEAD
OF INSERT` trigger is one, indivisible SQLite statement by construction — SQLite
already guarantees the whole cascade (every real write the trigger itself performs)
either fully applies or fully doesn't, with no further, real work needed. This is
the real, direct answer to "the staging triggers and the general journal trigger/
function must both complete successfully": for this specific pattern, that
guarantee already exists, and always has — the real gap this skill addresses is
specifically the *application-code* (TypeScript function) side, where multiple,
separate SQL statements are issued one after another with nothing tying them
together.

Still open: 328 real, exported functions across `db.ts`/`db-stock.ts`/
`db-reports.ts`/`auth.ts` alone; the real, full audit identifying every real,
compound write function still needing this fix, and applying it function by
function, remains real, substantial, further work.
