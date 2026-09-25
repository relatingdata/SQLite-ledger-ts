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
session (`receiveStockAtLocation`, `dispatchStockFromLocation`,
`transferStock`, `placeOrder`, `fulfillOrder`) was genuinely required by this
skill, not merely good practice.

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
`receiveStockAtLocation` (also had its own real, stale doc comment brought up to
date — it never mentioned the real capacity adjustment or combination-value
posting it's always done), `dispatchStockFromLocation`, `transferStock`,
`placeOrder`, `fulfillOrder`.

**A real, important, confirmed finding**: `postApPayment` (and the same pattern
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
