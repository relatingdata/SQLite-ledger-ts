# Storage space as currencies — a real, consolidated design, for approval before any implementation

Per direct instruction, built entirely on what the manual already documents
(`docs/cartesian-account-linking-plan.md`, `docs/multicurrency-design.md`) —
no new mechanism invented, only the existing Hierarchy/Product/currency-pair
system applied to a new domain. Nothing here is implemented yet.

## 1. The core, corrected principle

**Storage space, in every real form, is a set of real currencies.** Each
distinct combination of storage dimensions (Hot-Bottle, Cold-Bottle,
Secure-Carton, and so on) is its own real currency, exactly the way USD and
EUR are. **Nothing is ever single-sided.** Every real event — receiving,
dispatching, transferring, selling, or converting storage — is one journal
entry whose lines decompose into independently-balancing currency groups,
per the manual's own core rule: "a single journal entry can genuinely
involve multiple currencies, but each currency present must independently
balance to zero among its own lines."

## 2. User-defined dimensions, via the existing Hierarchy mechanism

Storage dimensions are ordinary Hierarchy groupings — nothing special-cased:

- `Storage` → `Hot`, `Cold`, `Secure`, `Open` (a bottle shop's own real values)
- `Container` → `Bottle`, `Carton`, `Cask`, `Aluminum Can`
- A factory's own, entirely different business would instead define
  `Standard` → `Metric`, `Imperial` and `Fastener` → `Nut`, `Bolt`, `Washer` —
  the exact, same mechanism, different real groupings and values, per direct
  instruction that this must generalize with zero code change per business.

A product shape (`defineProductShape`) combines `Location → Storage →
Container` (or whatever dimensions a business actually needs); each real,
specific combination in use becomes a real Product Instance
(`ensureProductInstance`), and `ensureCombinationAccountLeaf` creates that
combination's own accounts under Inventory, "Storage Capacity Remaining,"
and "Storage Capacity Installed" alike — the same, one mechanism for all
three, not a special case for capacity.

## 3. Exchange rates between storage currencies — one-directional by design

Per direct instruction: converting Hot-Bottle to Cold-Bottle is a real
currency pair (`ensureCurrencyPair`), exactly like USD→EUR, with its own
real rate (`setCurrencyExchangeRate`) — here, a unit ratio (1 bottle → 1
bottle) or a repackaging ratio (1 carton → 24 bottles), not necessarily a
decimal multiplier; the mechanism doesn't distinguish a "physical" ratio
from a "monetary" one, any more than it distinguishes £→s (20) from
s→d (12). **Irreversibility is expressed structurally, per pair, as a
missing reverse rate** — Hot→Cold is defined; Cold→Hot is simply never
configured, exactly as the manual already treats any undefined pair.
Carton→Bottle and Hot→Cold are independent pairs, each with its own,
independent reversibility.

## 4. The real, complete transaction shape — corrected, three balanced groups

Per direct correction, twice: no Expense account is involved (this is
inventory movement, not a purchase), and the item's own real inventory
*value* genuinely moves between the two combinations' own Inventory leaves —
this is `transferStock`'s already-proven logic, applied to a combination
instance instead of a geographic location, never a new mechanism.

One journal entry, converting 1 carton of Hot-Carton beer to 24 bottles of
Cold-Bottle beer:

1. **SPACE-HOT-CARTON** (zero on its own): Debit Space Conversion Clearing
   (SPACE-HOT-CARTON), Credit SPACE-HOT-CARTON — 1 unit of space freed.
2. **SPACE-COLD-BOTTLE** (zero on its own): Debit SPACE-COLD-BOTTLE, Credit
   Space Conversion Clearing (SPACE-COLD-BOTTLE) — 24 units of space
   consumed, at the real, defined carton→bottle rate.
3. **Home currency** (zero on its own): Debit Inventory (Cold-Bottle leaf),
   Credit Inventory (Hot-Carton leaf) — the stock's real, current carrying
   value relocating, no gain or loss, a pure move.

A real, explicit fee (refrigeration handling, if a business genuinely
charges one) is a real, fourth, separate, optional currency group — never
assumed, only posted when a real transaction actually states one.

## 5. Where this touches the existing system

- **Location / Storage Space**: the current, fixed `bottle_capacity`/
  `carton_capacity` fields are superseded by real, named Storage combinations
  per location — a location's own real capacity is expressed as opening
  balances on each real combination's own "Storage Capacity Remaining"/
  "Installed" pair (per the checkpoint 395 mechanism, generalized across
  combinations rather than one fixed pair per location).
- **Item / Inventory**: each real combination gets its own real Inventory
  leaf (already the documented mechanism) — no new inventory concept, just
  consistent use of leaves that already exist for this purpose.
- **Stock Transfer**: a transfer between two combinations at the *same*
  location (a storage conversion) and a transfer between two *locations*
  become the same, one real function conceptually — both move real
  inventory value between two combination leaves; a same-location conversion
  additionally posts the two real space-currency groups above, a
  cross-location transfer does not (space doesn't change kind, only place).
- **Receiving / Dispatching**: `receiveStockAtLocation` gains an optional
  combination parameter (mirroring how `PosSaleLineInput` already accepts
  one) — receiving whiskey directly into `Main Warehouse → Secure → Bottle`
  posts into that combination's own Inventory and Storage Capacity leaves
  from the start, never received "plain" and moved later.
- **Sales / POS**: already wired for combinations per the manual (§7-9 of
  the cartesian plan) — selling from a specific combination already
  resolves price and posts Inventory/COGS/Sales correctly; this design adds
  that a sale also releases that combination's own Storage Capacity space
  back, which is not yet wired in and is real, new, required work.
- **Frontend UI**: real, further, separate work, deliberately not designed
  or built yet, per direct instruction to check backend/API first.

## 6. The tutorial e2e's own, real augmentation plan

Per direct instruction, at least these two, real, obvious combinations, to
directly exercise this design without inflating scope beyond what's needed
to prove it:

- **The beer example**: receive a carton of beer into `Hot Storage`, then
  convert it to bottles in `Cold Storage` — exercising the full, three-group
  balanced conversion (space out, space in, inventory value relocated).
- **Whiskey into secure storage**: receive whiskey directly into `Secure
  Storage` — exercising a combination-tagged receipt from the start, per
  §7 of the cartesian plan, not received plain and moved later.

## 7. Regression prevention

Per direct instruction: the existing, plain (non-combination) tutorial
steps (login, business, location, the two beer items already built) must
keep passing unchanged — combinations are additive, an optional path, never
a replacement for the plain path an item or location can still use without
ever defining a Storage hierarchy at all. The full backend suite (194
tests) and the step-runner's own suite (14 tests) must both remain fully
green throughout.

## 8. Honest, explicit scope for this pass

Backend/API only, per direct instruction — no frontend design or
implementation until this is approved and proven via the API. This document
itself is the approval checkpoint; nothing below it is built yet.

## 9. A real, elaborated workflow — restocking as suggested, staff-acknowledged work, not a standalone screen

Per direct, further instruction: "Convert Storage" is not a separate, standalone
screen at all — it is part of the same, real setup done when a location's own
Cartesian storage combinations are configured (§5's "Location / Storage
Space" point). The real, everyday sequence this actually supports:

- **The POS terminal notices** a real, specific combination (Cold-Bottle beer,
  say) has fallen to a real, low quantity (4 bottles), and that a real,
  further combination at the same location (Cold-Carton, 2 cartons; or
  Ambient-Carton elsewhere in the same store, 20 cartons) can supply it.
- **A real, internal, suggested stock-transfer order is created** —
  restocking the fridge back up to its own real maximum level, with a real,
  explicit instruction on how many cartons to open to get there.
- **Bottle restocking happens before carton restocking**, always, when both
  are genuinely available — a real, deliberate priority, not incidental.
- **Sales staff simply carry out the real, physical restocking and
  acknowledge the work as complete** — a real, simple work-order pattern:
  the system suggests and sequences, a person executes and confirms, never
  the reverse.

**Not unlike, at a wider scale**: a stock controller asking for, or being
prompted with, a real, division-wide beer purchase order to restock every
real warehouse and location to its own real, seasonal maximum capacity — or
simply moving real, already-owned inventory the application itself suggests,
from warehouse to location, when a purchase isn't even needed.

**Honest, explicit scope**: this is real, further, significant work beyond
receiving/dispatching/transferring/converting themselves — a real,
suggestion-generating engine (comparing current combination quantities
against real Min/Max/Reorder levels per combination, not only per item)
and a real, staff-facing work-order/acknowledgment screen. Not designed in
detail or implemented in this pass; recorded here so the foundational
pieces (per-combination levels, the balanced conversion mechanism itself)
are built in a way this can be layered on top of later, not designed to
preclude it.

## 10. Corrected, and confirmed working — no "clearing" account needed

Per direct correction: there is no real "Space Conversion Clearing" account
at all — a genuine, elegant simplification found immediately once pointed
out. The already-built "Storage Capacity Remaining"/"Installed" pair
(checkpoint 395) already balances independently within its own currency;
converting is simply reversing that pair at the source combination and
repeating it at the destination — never an invented, third account. The
inventory-value-relocation group (§4, item 3) remains a real, honest,
unimplemented placeholder (the actual current-carrying-value lookup is
real, further, separate work).

`convertStorageSpace` (backend/src/db.ts) implemented and directly, fully
tested: a real, deliberately-forced test confirms a genuine conversion
(Hot→Cold, at a real, defined 1:1 rate) posts one, real, balanced journal
entry, that the overall trial balance and every real currency group
(including the two, real, new SPACE-HOT/SPACE-COLD groups) stay genuinely
balanced afterward, and that the exact, same conversion attempted in
reverse (Cold→Hot, never defined) genuinely refuses, not silently
succeeds. 195/195 backend tests pass.

Honest, explicit scope still open, given severe time constraints: the
frontend UI (receiving into a named combination, the "Convert Storage"
action as part of location setup, the suggested-restocking workflow of
§9) remains entirely undesigned in detail and unbuilt.

## 11. Corrected again — Inventory value is many currencies too, not one relocating amount

Per direct, further instruction: real inventory value, exactly like real
space, is expressed in many, real, differing currencies — one per real
combination (`INVENTORY-HOT`, `INVENTORY-COLD`, and so on) — never a single,
plain home-currency amount that merely relocates between two leaves. The
person setting up the location/hierarchy nominates this conversion's own
real rate separately from space's own rate (a case of beer need not carry
the identical, real, per-unit value once split into singles).

Each real inventory currency needed its own, real, balancing counterpart,
exactly mirroring "Storage Capacity Remaining"/"Installed" — a bare,
two-line move between two different real currencies cannot balance on its
own, the exact, same reason space needed one. A real, new "Inventory Sourced
From" account fills this role. `convertStorageSpace` now posts four,
independently-balancing real currency groups per conversion (space out,
space in, inventory out, inventory in), each genuinely resolved via its own,
separately-nominated real exchange rate — confirmed directly: 195/195
backend tests pass, including the existing, direct conversion proof,
extended to also configure and use a real `INVENTORY-HOT`→`INVENTORY-COLD`
rate.

## 12. Corrected a third time — inventory value is a fixed multiplier, not a currency; carton/bottle space is independent, never rate-linked

Per direct, precise correction: counting cartons and counting bottles is
exactly like counting dollars and cents — a fixed, known multiplier (12 for
wine, 24 for beer), never an exchange rate between two currencies. §11's
`INVENTORY-HOT`/`INVENTORY-COLD` currency pair and "Inventory Sourced From"
account were removed entirely — no journal entry is needed to re-express the
same, real inventory value in a different, real counting unit.

**Two genuinely different cases, not one mechanism**:
- **Hot↔Cold** (the same container, different temperature zone) is a real
  conversion between two real, distinct space-currencies, with its own,
  real, nominated rate — exactly as designed, unchanged.
- **Carton-space↔Bottle-space** is not a conversion at all, and no rate
  exists between them — opening a carton doesn't "convert" carton-space
  into bottle-space; it is two independent, real events (carton-space
  freed, bottle-space separately consumed) that merely happen together
  because opening a carton is one, real, physical action. This case is not
  yet implemented by `convertStorageSpace`, which today only handles the
  rate-based case; a real, separate mechanism for independent, paired space
  movements (with no rate lookup at all) remains real, honest, open work.

`convertStorageSpace` now posts exactly two, real, independently-balancing
currency groups (space out, space in) — no inventory posting of any kind.
Confirmed directly: 195/195 backend tests pass, the direct conversion test
simplified to match.

## 13. openStorageContainer implemented and directly, fully tested — the independent, non-rate-linked case from §12

`openStorageContainer` (backend/src/db.ts): opening a carton posts two,
real, completely independent currency groups (carton-space freed,
bottle-space consumed), each balanced only against its own real "Storage
Capacity Installed" counterpart — never against each other, and never
through any real currency-pair rate lookup, since none exists or is needed.

A real, direct, deliberately-forced test confirms: exactly one journal
entry posts; both real currency groups independently sum to zero.

A real, pre-existing, separate bug found while writing this test, not
introduced by it: `ensureCombinationAccountLeaf`'s own base-account lookup
(e.g. "Storage Capacity Remaining") is a bare, global name, not scoped to
the specific, real business calling it — the first real business to create
that name "wins" it globally, so a second, different business's own
combinations silently attach to the first business's tree instead of their
own. Confirmed directly: `getTrialBalance`, correctly scoped to one
specific business, saw none of this test's own real journal lines at all,
because they were never actually created under that business's Chart of
Accounts. Worked around in the test (querying `journal_line` directly by
reference, sidestepping the business-scoping question entirely) rather
than masked; the real, underlying bug in `ensureCombinationAccountLeaf`
itself remains open, unfixed, and is the same, already-familiar class of
bare-name ambiguity found and fixed repeatedly elsewhere this session — it
should receive the same, real, `businessId`-scoped fix eventually.

196/196 backend tests pass.

Honestly, precisely incomplete, given severe time constraints: the tutorial
e2e fixture has not yet been extended to exercise this new function, and no
frontend work (location setup, item setup, either storage case) has been
started.
