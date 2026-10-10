# Moving canned-journal account selection into the frontend (v0.0.1.457)

Per direct instruction: every "financial" transaction must go through the one, real General
Journal API (`/journal/staging` + `/journal/post`) — the same two endpoints the General Journal
screen itself already uses. The frontend UI itself does not change at all — same screens, same
fields, same buttons. What changes is what happens when a screen's submit button is clicked: the
"canned" logic that currently decides *which accounts* get debited/credited for a given kind of
transaction moves out of the backend and into a single, shared, non-duplicated frontend module.
That module builds the real, complete, already-balanced set of journal lines; the screen's existing
submit handler then sends those lines straight to `/journal/staging` + `/journal/post`, exactly as
if a person had typed them into the General Journal screen by hand. The backend's job shrinks to
the one, generic thing it already does for the General Journal: accept staged lines, check they
balance, post them.

**Per direct, explicit correction: a journal entry never carries a division or category of any
kind.** Every real dimension that reporting ever needs to slice by — which location, which item,
which storage tier or pack size, whatever else genuinely changes cost or selling price — is baked
directly into the account's own name: the cartesian product of Location × Item (× tier, where that
distinction is real), exactly the pattern `ensureItemLocationInventoryAccount` already uses
(`<item> (<tier>) — <location>`). This was checked, found, and corrected directly during Phase 0:
the old, pre-existing `completeCashPurchase`/`postInvoice` code path does pass a `divisionName`
(`cityDivisionFor(locationName)`) into every staged line via a real `division` column on
`journal_entry_staging`, and an early draft of this design copied that behavior into the new,
public `/journal/staging` endpoint and into `canned-journal.ts`. **That copy was wrong and has been
reverted** — the new, frontend-driven canned-journal mechanism carries no division field anywhere,
on any line, for any screen. The one, narrow account-selection task this leaves the backend (see
`resolveCashTransactionAccounts`, below) only ever returns real, already-cartesian-product account
names (e.g. the Inventory account), never a division name.

## What "canned journal mechanics in the backend" actually turned out to be — checked directly, not assumed

Two genuinely different things were found under this name, and they must not be conflated:

1. **A real, but entirely dead, SQL-trigger mechanism.** `ar_sale_staging`/`ar_sale_post`,
   `ar_receipt_staging`/`ar_receipt_post`, `ap_purchase_staging`/`ap_purchase_post`,
   `ap_payment_staging`/`ap_payment_post` (`backend/schema/00-core.sql`) are real tables with real
   `INSTEAD OF INSERT` triggers that do exactly what "canned journal in a DB trigger" sounds like:
   given a simple business fact (customer, amount, tax), the trigger itself picks the real accounts
   (Sales Revenue, Sales Tax Payable, the customer's own AR balance, etc.) and writes the matching
   `journal_entry_staging` rows, then posts them. **Checked directly: nothing in the live
   application calls any of this.** `backend/src/routes/arap.ts` exposes it at
   `/arap/ar-sale/stage`, `/ar-sale/post`, etc., but `frontend/src/lib/api.ts`'s own calls into
   those routes are commented out (lines 704–719) — dead code on both ends. **Decision: delete this
   mechanism outright** (the four staging tables, their four trigger-backed `*_post` views, the
   `stageARSale`/`postARSale`/`stageARReceipt`/`postARReceipt`/`stageAPPurchase`/`postAPPurchase`/
   `stageAPPayment`/`postAPPayment` functions in `backend/src/db-journal.ts`, and the whole
   `arAPRouter` in `backend/src/routes/arap.ts`). This is pure removal, not a rewrite — it was never
   live, so there is nothing to port.

2. **The real, live mechanism — much larger, and not trigger-based at all.** The screens that are
   actually exercised by the tutorial (`Cash Purchase` → `completeCashPurchase`, and its mirror for
   sales, `POS Sale`/`Cash Sale`) call real TypeScript functions in `backend/src/db.ts` that do far
   more than pick two account names: `createInvoice` (builds a multi-line AP/AR invoice entity),
   `postInvoice` (this is the real, live account-selection logic — resolves the correct
   location-scoped Inventory account per item via `ensureItemLocationInventoryAccount`, handles the
   tax account, decides Cash-and-Bank vs. the counterparty's own AP/AR balance depending on whether
   a `paymentMethod` was given, and is the function that actually writes the journal lines),
   `receiveItems` (a real, physical stock-quantity side effect — not a journal line at all), and
   `allocatePayment` (closes out the invoice against the same Cash-and-Bank account). The equivalent
   chain exists for sales (`completePosSale`), stock transfer, container opening, and the
   receive-into-storage flow, each in `backend/src/db-stock.ts`/`backend/src/db.ts`.

The instruction's own premise — move the canned template logic to the frontend, leave the backend
"virtually no db.ts" — is correct and achievable **for the account-selection/journal-lines part**
of case 2. It is not achievable, and must not be attempted, for the parts of case 2 that are not
journal entries at all: creating the invoice entity, resolving/creating a location's own Inventory
account the first time an item is stocked there, physically adjusting stock quantities, and
allocating a payment against an invoice's own running balance. Those are real, stateful,
server-side facts (what accounts exist, what an invoice's outstanding balance is, how many units
are on a shelf) that a stateless frontend calculation cannot safely own, because two concurrent
users' browsers would each be computing against a view of that state that might already be stale by
the time they submit — the one reason a generic client-side "build the lines" step is safe for
*accounts and amounts*, which are deterministic given the form's own inputs, but not for *entity
creation* or *quantity mutation*, which are not.

## The new architecture

**Frontend — one shared module, `frontend/src/lib/canned-journal.ts` (new, not yet built):**
exports one pure function per transaction type (`cashPurchaseLines(input)`, `posSaleLines(input)`,
`cashSaleLines(input)`, `transferLines(input)`, `openContainerLines(input)`, etc.), each taking
exactly the fields that screen's form already collects and returning
`{ reference, lines: { account: string; amount_minor: number }[] }` — a complete, balanced set,
computed the same way `postInvoice`'s own account-selection logic does it today (same account
names, same signs, same tax treatment), so the posted result is bit-for-bit identical to today's.
Every screen's existing submit handler calls its one matching function, then calls the two already-
existing, generic endpoints directly: `POST /journal/staging` once per returned line, then
`POST /journal/post` — the exact same two calls the General Journal screen's own "Save" button
makes. No duplication: every screen's handler is a two-line wrapper (`const {reference, lines} =
cashPurchaseLines(formValues); await postLines(reference, business, ledger, lines)`), with
`postLines` itself written once, shared by all of them.

**Backend — reduced to the generic primitives, plus the real non-journal side effects, which stay
real backend code:** `/journal/staging` and `/journal/post` already exist and need no change. What
is removed from `db.ts`/`db-stock.ts` is only the part that decided *which account* and *how much* —
that logic is now in the frontend module, byte-for-byte ported. What **stays**, because it is not
journal logic: invoice-entity creation (if the invoice document itself is kept — see Open Question
below), `ensureItemLocationInventoryAccount` (creating a ledger account the first time it's needed
is a real, stateful, server-side fact), `receiveItems`/stock-quantity mutation, and payment
allocation against an invoice's running balance. Each of these becomes its own small, focused
endpoint that performs only that one real side effect and returns whatever the frontend's canned-
line calculation needs as input (e.g., "what is this item's resolved Inventory account name at this
location" must still be asked of the backend, since the frontend cannot safely invent that name).

## Phased delivery (this pass vs. follow-on)

Given the real scope difference between case 1 (dead code, pure deletion) and case 2 (the live
engine, genuinely large), this is delivered in phases rather than one unreviewable rewrite:

- **Phase 0 (this pass):** delete the dead AR/AP trigger mechanism (case 1) outright. Build
  `canned-journal.ts` and port the first, simplest real screen — `Cash Purchase` — onto it,
  end to end, as the proof of the pattern. Test it produces an identical posted result to today's
  `completeCashPurchase`.
- **Phase 1 (follow-on):** `Cash Sale`/`POS Sale`, `Transfer Items`, `Open Container`,
  `Receive Into Storage` onto the same pattern, each reusing the one shared `postLines` helper.
- **Phase 2 (follow-on):** `Purchase Order`/`Stage Purchase Order`/`Post Purchase Order` and
  `Close Books`/`Rollover` — these have their own, additional non-journal lifecycle (an order's own
  staged/fulfilled status; a ledger rollover's own structural account-creation step) that needs the
  same case-2 split applied carefully before porting.

This document is the authoritative design; implementation proceeds against it directly.

## Phase 0 — done, verified directly against the real, live app

Built: `frontend/src/lib/canned-journal.ts` (shared, non-duplicated — `cashPurchaseLines` +
`freshReference`); `resolveCashTransactionAccounts` and `receiveItems`'s own thin route
(`/pos/resolve-cash-transaction-accounts`, `/pos/receive-stock` in `backend/src/routes/pos.ts`) for
the one, real, stateful piece that must stay server-side; `CashTransaction.svelte`'s purchase branch
rewritten to call these instead of the old, single `completeCashPurchase` endpoint. The dead
`ar_sale_staging`/`ar_sale_post` and `ap_purchase_staging`/`ap_purchase_post` mechanism is gone
entirely; `ar_receipt_staging`/`ap_payment_staging` (genuinely live, via `PaymentReceipt.svelte`)
were left untouched after that mistake was caught and fixed.

Verified live, end to end, via a real, scripted Chromium session against the running app (not
assumed from the code alone): created a business, a location, a vendor and an item; submitted a
real Cash Purchase (10 × Test Widget @ $5.00) through the real `/arap/cash-purchase` screen; read
the resulting rows directly out of the database afterward. The real, posted journal entry has
exactly two lines — debit `Test Widget — Head Office` $50.00, credit `Cash at Bank` $50.00 — with
`division_id` null on both, confirming the no-division correction above actually holds in the
posted result, not just in the new code's intent. The real, physical stock receipt (10 units) and
the real storage-capacity usage posting both fired correctly as their own, separate, non-journal
side effects, exactly as designed.

Cash Sale/POS Sale, Transfer Items, Open Container, and Receive Into Storage (Phase 1) are not yet
started — `completePosSale` and the rest of `db.ts`'s canned logic for those screens is untouched.
