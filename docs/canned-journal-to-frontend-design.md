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

## Phase 1 — done, verified directly against the real, live app

Built: `posSaleLines`, `transferLines`, `openContainerLines`, `receiveIntoStorageLines` in
`canned-journal.ts`; `resolveSaleAccounts`/`dispatchStock` (Cash Sale), `transferStock`/
`resolveTransferAccounts` (Transfer Items), `resolveOpenContainerAccounts` (Open Container), and
`receiveIntoStorageStock`/`resolveReceiveAccounts` (Receive Into Storage) as the real, narrow,
stateful backend endpoints each screen still genuinely needs. `CashTransaction.svelte`'s sale
branch, `stock/transfer/+page.svelte`, `locations/+page.svelte`'s `doOpenContainer`, and
`items/+page.svelte`'s `doReceiveIntoStorage` were all rewritten to call these and post through the
same generic `/journal/staging`+`/journal/post` calls Phase 0 already proved.

Verified live, end to end, via a real Playwright run against the running app (not assumed from the
code alone, and not via the pre-existing `screens.csv`/`step-runner.ts` harness, which turned out to
have no real UI wiring for most of these screens — a pre-existing gap, left as-is): Transfer Items
(24 bottles, Head Office → Main Street Cellar, with a real dollar VALUE entry since the item's unit
cost is known), Receive Into Storage (24 units tagged "Carton", no known unit cost yet — the real
"no VALUE entry" path), and Open Container (1 Carton → 24 loose Bottles) all posted correctly
through their real screens.

That verification run surfaced three genuine, pre-existing bugs, none introduced by this port but
all blocking real verification of it until fixed (commit `76ea3a1`):

- **Express route-shadowing in `locations.ts`:** several real, single-segment `POST` routes
  (`/transfer`, `/transfer-stock`, `/resolve-transfer-accounts`, `/resolve-receive-accounts`) were
  registered *after* the catch-all `POST /:name` (location create/update) — Express matches by
  registration order, not specificity, so every request to them was silently caught by `/:name`
  instead. This affected the pre-existing `/transfer` route too: Transfer Items had likely never
  actually worked via a real HTTP POST from a browser, only via direct backend-function calls in
  unit tests. Fixed by moving every real, single-segment route ahead of the wildcard.
- **Unscoped lookup in `PUT /locations/:name`:** the Locations page's own Save button never passed
  `business` to `setLocation`, so its lookup fell back to a bare name match. Once a location has had
  any real storage-combination action against it, that location's own GL "Storage" account root
  gets a child node sharing the exact, same literal name as the location itself — a same-business,
  same-name collision the existing business-scoping fix (for the different-businesses case) never
  covered. Saving capacity after that silently wrote onto the wrong entity. Fixed by threading
  `business` through, matching what `POST /:name` already did.
- **Open Container's "Remaining"/"Occupied" leaf accounts can share one literal name:** e.g. both
  named "Carton", differing only by parent (not reflected in the name string). Staging by bare name
  alone collapsed two real, different accounts into one, breaking posting with a `UNIQUE constraint
  failed` on `(journal_id, account_id, effective_date)`. The original `openStorageContainer`
  function always avoided this by staging with each account's own, already-resolved `accountId`;
  the new frontend-driven path had no way to do that until `resolveOpenContainerAccounts` was
  extended to also return each account's real id, threaded through `canned-journal.ts` and into
  `stageLine`'s now-optional `accountId` field.

## Phase 2 — investigated directly; the plan above was wrong about what it actually is

Checked both pieces against the real code before writing anything, the same way Phase 0's
investigation corrected its own premise. Neither one is a case-2 instance in the sense this
document defined:

**Purchase Order / Stage Purchase Order / Post Purchase Order: nothing to port.** `placeOrder`/
`fulfillOrder` (`backend/src/db-stock.ts`) never touch the generic journal staging table at all —
they post quantity movements against synthetic, reference-scoped tracking entities
(`${orderReference} Qty`/`${orderReference} Value`), which is open-order bookkeeping, not a
discretionary choice of real Chart-of-Accounts leaves. The one function in this area that does post
a real journal entry, `postOrderReceipt` (`backend/src/db-journal.ts`), already takes the vendor
and item/account as plain strings the person chose themselves on the Stock Receipt screen's own
vendor/account dropdowns (`frontend/src/routes/stock/stock-receipt/+page.svelte`) — there is no
backend logic deciding *which* account to use, unlike `postInvoice`'s real, algorithmic
location-scoped Inventory resolution for Cash Purchase/Sale. This screen is already, functionally,
exactly like the General Journal screen: the person picks the accounts, the submit handler posts
them. `postOrderReceipt` bundling that post together with its own further, genuinely stateful side
effects (the item's own quantity movement, `fulfillOrder`'s decrement of the order's own running
balance, `recordInvoiceLine`) is the same, correct shape Phase 1's narrow stateful endpoints
already use — nothing here needs to move anywhere. **No changes made.**

**Close Books / Rollover: a real case-2 instance — ported, directly, per explicit instruction.**
An earlier pass through this document reasoned that `computeCloseLines`/`rolloverToNewPeriod`
(`backend/src/db-reports.ts`) genuinely decide, server-side, which accounts and amounts post, and
that re-deriving that arithmetic a second time on the frontend — correct rounding, correct currency
grouping, correct division sub-totaling, across *every* Income/Expense or Balance Sheet account in
the ledger — would risk two independent implementations drifting apart, for an action whose failure
mode is corrupted financial history rather than one wrong sale. That reasoning missed something,
pointed out directly: there is no re-derivation needed at all, because `previewCloseBooks` already
computes and *returns* the exact lines `closeBooks` would post, without posting them
(`CloseBooksLine[]` — `{ account, accountId?, amount_minor }[]`). The frontend doesn't need to
reconstruct the trial-balance arithmetic; it only needs to take the lines the backend already
computed and post them itself, through the exact same generic `stageLine`/`postJournalEntry` calls
every other canned screen already uses. The same shape was then built for Rollover, which had no
existing frontend screen at all: `rolloverToNewPeriod`'s own Phase 1 (create each carried-forward
account's own node under the new ledger — a real, stateful write) and Phase 2 (read the old
ledger's non-zero Balance Sheet lines) were split out into a new, shared `resolveRolloverLines`,
mirroring the already-proven `computeCloseLines`/`previewCloseBooks`/`closeBooks` split exactly;
`rolloverToNewPeriod` itself is unchanged in behavior, now just calling the shared function
internally for backward compatibility with any direct backend/test/script caller.

Concretely:
- `backend/src/db-reports.ts`: added `resolveRolloverLines` (Phase 1 + Phase 2, returns
  `{ reference, lines, accountsCarriedForward }` without posting); `rolloverToNewPeriod` now calls
  it and does Phase 3 (stage + post) itself, same as before.
- `backend/src/routes/journal.ts`: added `POST /journal/resolve-rollover-lines`, the
  frontend-facing twin of `/journal/preview-close-books` — genuinely stateful (Phase 1 writes), not
  a side-effect-free preview, the same shape this codebase's other resolve-then-post endpoints
  (`resolveOpenContainerAccounts`, `resolveTransferAccounts`, etc.) already use.
- `frontend/src/lib/api.ts`: added `accountId?: number` to `CloseBooksPreview.lines` (mirroring the
  backend's own `CloseBooksLine`, the same "Remaining"/"Occupied" naming-collision fix Phase 1
  already applied elsewhere); fixed a real, confirmed bug found directly while doing this —
  `previewCloseBooks`'s own input type had always omitted `business`, even though the backend's
  `previewCloseBooksSchema` has always required it; added `resolveRolloverLines` and `createLedger`
  wrappers.
- `frontend/src/routes/setup/yearend/+page.svelte`: `acceptAndClose()` now posts `preview.lines`
  directly (reference `CLOSE-${ledger}-${asOfDate}`, matching the backend's own convention) instead
  of calling the old, all-in-one `closeBooks()`; a new "Roll over to a new period" section lets the
  person name or pick a ledger, resolve the real, proposed opening-balance lines, review them, and
  accept/post them the same way the Close Books preview already works.

Verified directly against the real, live app (not just code review): a fresh, self-contained
Playwright run built its own business via the real `/setup/new-business` UI, posted a genuinely
unclosed Rent expense through General Journal, closed the books (preview showed the real lines,
accept posted them and zeroed the account), then rolled over into a brand-new ledger created on
the fly (resolve showed Cash and Bank's own real, adjusted balance, accept posted it as that
ledger's opening balance). `tsc --noEmit` (backend, same 6 pre-existing baseline errors),
`svelte-check` (frontend, 0 errors/warnings), and the backend test suite (134 pass / 80 fail,
unchanged baseline) all confirmed unaffected.

One, real, separate, pre-existing bug was found and fixed along the way, unrelated to this port
itself: `backend/schema/20-demo-bmw-peugeot.sql` still ran
`UPDATE entities SET deleted_at = ..., deleted_by = ... WHERE entity_id = ...` immediately before
several of its own re-parenting `INSERT`s — left over from this project's earlier, rejected
"close out the old row" design; the `entities` table has had no such columns at all since the real,
settled "no delete, only supersede" design, so every one of those `UPDATE`s broke a genuinely
fresh, from-scratch, demo-seeded (`SEED_DEMO_BUSINESSES` unset/true) backend startup outright. The
dead `UPDATE`s were removed; the `INSERT`s alone were always sufficient. A second, separate,
pre-existing issue was found in the same demo-seeded path (a `NOT NULL constraint failed:
journal.ledger_id` from `post_journal_entry`, since that file's own BMW/Peugeot ledgers were never
given the `Ledgers` structural parent node the current, real design requires) but was left alone —
out of scope for this change, and why this port's own verification above built a fresh business via
the UI rather than depending on that demo data at all.

Phase 2, as originally scoped, is therefore complete.
