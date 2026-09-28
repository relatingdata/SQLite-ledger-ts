# Stock Lifecycle: A Complete, Honest Review

Per direct request: a full review of how this application actually
handles a product's entire real lifecycle — creation, ordering,
receiving (in full or in part, with a genuine back order), selling
(immediate or deferred), writing off, and physical storage capacity —
checking what's genuinely built and documented against what's only
assumed. Partial/security-driven stocktakes are deliberately excluded
from this pass, per direct instruction, until everything else here is
settled.

## 1. Create a product — confirmed, built, documented

`createItem` places a real item under its real category in the
existing entity tree; `ensureItemSalesCogsAccounts`/
`ensureItemQuantityAccounts` lazily create its real GL and
quantity-tracking accounts the first time they're actually needed —
confirmed directly in `db.ts`/`db-stock.ts`. Genuinely no gap here.

## 2. Order a product — confirmed, built, NOT documented

`placeOrder` is a complete, real, already-working mechanism:

- Posts a real `{orderReference} Qty` and `{orderReference} Value`
  account, representing the standing commitment.
- Posts a real, genuine double-entry counteritem to the product's own
  `On Order` quantity account (confirmed directly — this is exactly
  the "genuine future commitment," not an invented placeholder).

This is real, working, correct — and appears nowhere in
`docs/programmer-manual.md`. A direct search for "back order"/
"backorder" returns zero results.

## 3. Fully or partially receive an order, with a genuine back order — confirmed, built, NOT documented

`fulfillOrder` can be called more than once against the same real
order reference — each call reduces the order's own `Qty`/`Value`
balances by exactly what was actually received *this time*.
`getOrderStatus` reads whatever remains directly — that remainder
*is* the real back order, with no separate table or flag anywhere.
A real, confirmed bug (`journal_reference_unique`, documented in
`fulfillOrder`'s own comment) was already found and fixed here: an
earlier version reused one fixed reference per order, which silently
corrupted `journal_line` the moment a *second* partial fulfillment
happened against the same order.

**This is a genuinely complete, already-correct mechanism.** The real
gap is that the manual doesn't describe it at all — a reader has no
way to know partial receiving is supported, or how a back order is
actually represented, without reading `db-stock.ts` directly.

## 4. Sell with immediate delivery — confirmed, built, documented

POS/Cash Sale — dispatches stock and posts revenue/COGS together, in
one real transaction. Already covered in the manual.

## 5. Sell a larger quantity, later delivery from a warehouse — a real, direct contradiction in the manual itself

Sales Order (`/stock/so`) plus a later, separate Stock Dispatch is the
real, intended shape — the same real stage→post pattern as Purchase
Order, mirrored. **But the manual currently says two different things
about it**: one section (the real routes/functions table) states
Sales Order is *"not yet implemented — a real, confirmed stub"*;
another, later section describes it in full, with a real screenshot,
as a working "real, standing commitment to a customer, to be fulfilled
later," including partial fulfillment via Stock Dispatch.

**This needs a direct, real check against the live code** (not
assumed either way) to determine which statement is actually true
today, then the other one corrected — a manual that disagrees with
itself is worse than one with an honest, marked gap.

## 6. Write off a breakage — confirmed, built, documented, and recently fixed

`writeOffStock` — a real, dual-effect transaction (GL loss +
quantity reduction). Its own quantity-movement posting was found
genuinely unbalanced and fixed this same session (checkpoint 283) —
now posts against a real `Write-off` counteritem account, matching
the same, established pattern as receipt/dispatch/transfer.

## 7. Storage capacity as an active, double-entry constraint — confirmed missing, and more specific than what's currently tracked

Directly confirmed, not assumed: `bottle_capacity`/`carton_capacity`
are real, static fields on a location, read only to compute an
on-the-fly "are we currently over capacity" comparison
(`getStockCapacityStatus`-style logic in `db-stock.ts`) — nothing
actively debits or credits a real capacity *account* as stock moves.

`docs/TODO.md` already tracks a related, but less specific, real gap
(appearing as an exact duplicate entry, itself worth cleaning up):
*"Capacity is still purely informational — not enforced anywhere...
not built yet"* — described there only as a possible future
warn/block validation, not the specific mechanism now being asked
for.

**The real, proposed design, stated directly**: a location's own
remaining storage capacity becomes a genuine, actively-tracked
quantity account — decremented every time stock is received or
transferred in, incremented every time stock is dispatched, written
off, or transferred out. This gives every physical stock movement a
real, meaningful, structural counteritem (space consumed ↔ stock
held), the same real relationship as Owner's Capital ↔ Cash — not
the generic, per-product `Count Adjustment`/`Write-off` accounts
added this session as a narrower, more immediate fix for the specific
reported bug.

**Open questions to resolve before building this:**
- A location's capacity today is expressed as *two, separate* real
  figures (`bottle_capacity`, `carton_capacity`) — does a genuine
  "space" account track one, unified unit, or two, separate capacity
  accounts per location (bottle-space and carton-space each their own
  real, independently-tracked account)?
- Warehouses currently have `carton_capacity` only (no
  `bottle_capacity` — confirmed directly, `NULL` for both real
  warehouses per `docs/TODO.md`'s own note). Does a warehouse's real
  capacity account track cartons only, or does receiving loose bottles
  at a warehouse need its own real conversion?
- Does exceeding capacity **block** the movement outright (a real,
  hard `RAISE(ABORT)`, matching how the balance check on financial
  entries already works), or only **warn** — per direct instruction,
  the "sacred principle" framing suggests blocking is intended for
  double-entry balance itself; capacity might reasonably be a softer,
  separate rule. This needs a direct decision, not an assumption.

## Real, concrete next steps, in order

1. Resolve the Sales Order contradiction (§5) — a direct, five-minute
   check against the live code and one manual correction.
2. Write the missing documentation for placeOrder/fulfillOrder/
   getOrderStatus (§2, §3) — the mechanism is real and correct; it
   just needs to be written down.
3. Answer the three open questions in §7, then design and build the
   real capacity-account mechanism — the largest, genuinely new piece
   of work here.
4. Partial/security-driven stocktakes — deliberately deferred, per
   direct instruction, until the above has settled.
