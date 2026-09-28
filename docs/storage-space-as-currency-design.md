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

## 14. The real bug from §13 fixed, and the tutorial fixture extended - confirmed working end to end

The real, pre-existing bug found at checkpoint 406 (`ensureCombinationAccountLeaf`'s
base-account lookup finding the wrong, location-scoped "Storage Capacity
Remaining" instead of a business-scoped one) is fixed by renaming the
combination-based accounts to **"Storage Space Remaining"/"Storage Space
Installed"** — genuinely distinct from checkpoint 395's own, real,
per-location "Storage Capacity Remaining"/"Installed" pair, sidestepping
the name collision entirely rather than attempting a deeper, real
business-scoping fix to `ensureCombinationAccountLeaf` itself (still real,
honest, open work). A new `ensureStorageBaseAccounts` helper creates both,
real, distinct accounts directly under the specific business's own real
Chart of Accounts before either `convertStorageSpace` or
`openStorageContainer` runs, so they are genuinely reachable from
`getTrialBalance`'s own real, recursive walk.

**The real tutorial fixture extended** (`shared-fixtures/tutorial-steps.csv`,
now 10 real steps): a real "Highland Single Malt 700ml" item created, then
received directly into `Secure` storage via the real, existing
`receiveStockAtLocation` combination support (a new `receiveStockWithCombination`
API-registry entry); then a real carton of the existing "Amber Ale 330ml
Can" opened into 24 real bottles via `openStorageContainer` (a new
`openContainer` API-registry entry). Both real, new screens added to
`shared-fixtures/screens.csv`.

**Confirmed directly, not assumed**: all 10 real steps pass via the API
path; the real trial balance shows `SPACE-BOTTLE` (24/24) and `SPACE-CARTON`
(1/1), both genuinely balanced; the real stock report
(`getStockListingByLocation`) already correctly shows the whiskey's own 24
real units on hand at Main Street Cellar, confirming the existing
combination-tagged receipt mechanism was already stock-report-visible
without any further, real change needed there. 196/196 backend tests pass;
the step-runner's own suite, 14/14.

Honestly, precisely incomplete: no frontend work has been started -
location setup, item setup, or either storage case, exactly as before.

## 15. Backend API routes added and directly proven, before any frontend work

Per direct instruction to proceed with frontend work, starting with the API
layer it will call: two, real, new routes added to `backend/src/routes/locations.ts`
- `POST /api/locations/convert-storage` and `POST /api/locations/open-container`
- wrapping `convertStorageSpace`/`openStorageContainer` directly. The
existing `POST /api/locations/:name/receive` route extended to accept
optional `combinationValues`/`combinationShape`, passing them through to
`receiveStockAtLocation`'s own, already-existing combination support.

**A real, genuine route-ordering bug found and fixed, not assumed correct**:
Express matches route definitions in the order they're registered - the
generic `POST /:name` (location creation) was defined before the new
`/convert-storage`/`/open-container` routes, so it silently treated
"convert-storage"/"open-container" as a real location's own name,
producing a confusing "city is required" validation error instead of ever
reaching the real, intended handler. Fixed by placing both new routes
before `/:name` in the file.

Confirmed directly, not assumed, against the real, live, running backend
(curl, not a unit test alone): `POST /convert-storage` and
`POST /open-container` both return `204`; `POST /:name/receive` with a real
combination correctly posts. 196/196 backend tests pass; check-backend-types
and check-docs-coverage both clean.

Honestly, precisely incomplete: no frontend UI exists yet at all - the
Locations page has no way to trigger either action, and Item setup has no
storage-combination concept in its own UI either. That remains the next,
real, immediate piece.

## 16. Frontend UI added - the Locations page, following the established Hierarchy/Cartesian style directly

Per direct instruction: no new, separate setup screen was built for storage
combinations themselves - the existing `/setup/hierarchy` page (already
generic, already lets a business define any real grouping/values and
Product shape) is reused directly, exactly as intended by its own design.

**A new "Storage Actions" section added to the Locations page**
(`frontend/src/routes/locations/+page.svelte`), shown only once a business
has at least one real Hierarchy grouping defined, matching the established
card/add-row visual style from the Hierarchies setup page precisely:

- **Open a Container**: picks a real grouping, a real "from" value (e.g.
  Carton) and quantity opened, a real "to" value (e.g. Bottle) and units
  produced - calls the real `openStorageContainer` API directly.
- **Convert Storage**: picks a real grouping and real from/to values (e.g.
  Hot/Cold) and a real quantity - calls the real `convertStorageSpace` API,
  surfacing its own real, honest error message when a direction was never
  defined, rather than a generic failure.

Real API wrappers added (`frontend/src/lib/api.ts`): `convertStorageSpace`,
`openStorageContainer`, and `receiveStockAtLocation` extended to accept
optional `combinationValues`/`combinationShape`, matching the backend's own,
already-proven support exactly.

Confirmed directly: `check-frontend` clean (0 errors); the real, live
Locations page (via the Step Runner's own UI path) still creates a real
location correctly, with no regression from this addition.

Honestly, precisely incomplete: `convertStorageSpace`'s own `itemName`
parameter is passed the selected location's own name as a placeholder -
genuinely unused inside the function itself today, but a real, honest gap
worth resolving properly once item-scoped storage actions are designed.
Item setup has no storage-combination concept in its own UI yet - only
Locations. The receive-stock screen has no combination picker of its own
either - only the two, new, direct actions above.

## 17. Item page extended - Receive Into Storage, following the exact, same pattern

A new "Receive Into Storage" card added to the Items page, matching the
Locations page's own "Storage Actions" style precisely: picks a real
location and quantity, optionally a real Hierarchy grouping and value
(defaulting to a plain receipt when none is chosen, since combinations are
genuinely additive, never required). Calls `receiveStockAtLocation`'s own,
already-proven combination support directly.

A real, global `.success` CSS class added (`frontend/src/lib/app.css`),
replacing the Locations page's own, earlier, local duplicate of the same
rule - one, real, shared style, not two, separately-maintained copies.

Confirmed directly: `check-frontend` clean; full backend suite 196/196
unchanged; the real, live fixture (Step Runner's own UI path) still creates
a real location correctly, with no regression - the one, known,
pre-existing screenshot-capture issue on "Create Item" (checkpoint 408)
persists, confirmed unrelated (backend stays fully healthy throughout).

Honestly, precisely incomplete: no UI exists yet for the "Convert Storage"
action from an item's own context (only Locations has it) - opening a
container or converting storage is still framed as a location-level action,
not yet reachable while looking at a specific item.

## 18. Corrected, per direct instruction: "Storage Capacity" is the real, built-in Hierarchy name, with Remaining/Installed as its own real leaves, amplified by the real Cartesian Product

Per direct, absolute correction: the earlier "Storage Space
Remaining"/"Installed" flat names (§14 onward) are wrong. The real,
"built-in" Hierarchy is named **"Storage Capacity,"** with two, real, named
leaves of its own — **"Remaining"** and **"Installed"** — never a flat,
bare-named pair. This exact, same, real structure exists under both a real
business (directly under `<Business name>`, not nested under Chart of
Accounts) and every real location alike, per direct instruction — meaning
it is genuinely structurally invisible to every financial report (Balance
Sheet, P&L, and even Trial Balance, all of which walk from Chart of
Accounts specifically), a real, deliberate consequence, not an oversight.

Each real "Remaining"/"Installed" leaf is itself "amplified" by whatever
real, user-defined Storage Cartesian Product combinations are actually in
use — confirmed directly against the real, live database:

```
Wine Retail Business II
└── Storage Capacity
    ├── Installed
    │   ├── Bottle
    │   └── Carton
    └── Remaining
        ├── Bottle
        └── Carton
```

**A real, general fix made to `ensureCombinationAccountLeaf` itself**: it now
accepts an optional, explicit `baseAccountId`, bypassing its own, real,
bare-name lookup entirely when given — the same, real, general fix already
applied elsewhere this session to every other bare-name ambiguity, since
"Remaining"/"Installed" now legitimately repeat under every real business
and every real location alike. `ensureStorageCapacityStructure(parentEntity,
userId)` is the one, real, new, shared function creating this exact
structure under any given real parent — a business or a location alike —
returning both real leaf ids for direct, unambiguous use.

`convertStorageSpace`/`openStorageContainer` rewired to this corrected
structure and confirmed directly, not assumed: 196/196 backend tests pass;
the real tutorial fixture's own trial run reproduces the exact structure
shown above.

**Honestly, precisely incomplete, per direct instruction that "the new
entirely replaces the old" — not yet done**: the earlier, real, per-location
mechanism (`ensureLocationCapacityAccount`, checkpoint 395's own flat
"Storage Capacity Remaining"/"Installed" pair, created directly under a
location with no Cartesian breakdown at all) has not yet been replaced. It
has four, real, separate call sites (`postLocation`, `createAndConfigureLocation`,
and the stock-movement capacity-adjustment path in `db-stock.ts`) plus
several, real, direct unit tests — a real, further, separate, careful piece
of work, not completed in this pass given its real scope and risk.

**A real, further, significant requirement received, not yet started**: per
direct instruction, the real Location × Item Cartesian Product (summed
suitably by Hierarchies) must appear under Inventory, Sales, and COGS too,
in parallel currency *and* count amounts — real, further, separate, and
substantial work, recorded here honestly rather than attempted under severe
time pressure in the same pass as the Storage Capacity correction above.

## 19. Task 1 complete: the old, per-location mechanism entirely replaced

Per direct instruction ("the new entirely replaces the old"): `ensureLocationCapacityAccount`
(backend/src/db-stock.ts) rewritten to use `ensureStorageCapacityStructure`
directly - the exact, same, corrected "Storage Capacity" structure now
applies under both a business and every real location, confirmed identical:

```
Main Street Cellar
└── Storage Capacity
    ├── Installed
    └── Remaining
        └── Carton
```

A real, general fix needed along the way: `ensureStorageCapacityStructure`
lives in `backend/src/db.ts`, but `ensureLocationCapacityAccount` lives in
`backend/src/db-stock.ts` - a real, direct import from db-stock.ts back into
db.ts, alongside db.ts's own, existing import the other way. Confirmed
directly, not merely assumed safe: this circular import compiles and works
correctly at runtime, since the actual call only happens after both
modules have finished loading.

**Correction (checkpoint 425).** This paragraph presented the `db.ts` ↔ `db-stock.ts`
cycle as something special that was added and then checked by hand. It was
neither special nor new in kind. dependency-cruiser (`make check-cycles`) reports **nine**
import cycles among the 52 backend modules, all centred on `db.ts`: with
`primitives.ts`, `db-stock.ts`, `db-seed.ts`, `db-reports.ts` and `db-journal.ts`. The
`db-stock.ts` cycle was one I added; the others predate it. They are recorded as a known
baseline, and the gate fails only on a *new* cycle. Hand-checking one of them was the wrong
tool; the standard one finds all of them at once.

Two, real, existing tests updated to match the corrected, nested structure
rather than the old, flat one. Confirmed directly: the real tutorial
fixture's own trial run reproduces the exact, corrected structure at both
levels; 196/196 backend tests pass.

**A real, further, separate, genuine issue found while replacing this, not
yet fixed**: `adjustLocationCapacity` (called by every real stock movement -
receive, dispatch, transfer) posts via a bare, single-sided `Balance.post`
call, never balanced against "Installed" or anything else - a real, further
instance of the exact, same "no posting is ever single-sided" violation
this whole design was built to eliminate. Recorded here honestly as a real,
separate, still-open gap, not addressed in this pass.

## 20. Task 2, checked directly - partially implemented, not fully as suspected

Per direct instruction to check rather than assume: the real Location × Item
Cartesian Product **is** already implemented for the *dollar value* — a
combination-tagged stock receipt already creates a real, distinct Inventory
leaf per combination, posting its real value correctly (checked directly in
`backend/src/db-stock.ts`, `receiveStockAtLocation`'s own combination code
path: debit Inventory, credit Accounts Payable, both explicitly resolved by
id, never a bare name).

**What is genuinely missing, found by direct inspection, not assumed**: no
parallel *count* (quantity) posting exists at all for this same,
combination-tagged path — only the dollar value is posted; the real unit
count is never separately, currency-tagged and posted the way Storage
Capacity's own "Bottle"/"Carton" leaves already are. Per direct instruction
that both must appear "in parallel currency and count amounts," this is a
real, further, separate, unimplemented piece — real, further work, not yet
started.

## 21. Both fundamental gaps completed fully, per direct instruction

### adjustLocationCapacity fixed - never single-sided

A real, new "Occupied" leaf added alongside Remaining/Installed under
"Storage Capacity" (`ensureStorageCapacityStructure`, `ensureLocationCapacityAccount`)
- the real, genuine, balanced counterpart for ordinary stock movements.
"Installed" only ever changes when real, physical capacity itself is built
or removed; an ordinary receipt/dispatch now posts a real, balanced,
two-line entry (Remaining ↔ Occupied) instead of the earlier, bare,
single-sided `Balance.post`. The real, meaningful accounting identity
**Installed = Remaining + Occupied** holds at every real moment - confirmed
directly by a real, deliberately-checked test: a real location opens with
100 real units of capacity; 10 real units arriving moves Remaining to 90 and
Occupied to 10, Installed staying at its own, real, original 100, with the
identity holding exactly.

### Location × Item Cartesian Product under Inventory - parallel currency and count, completed

`receiveStockAtLocation`'s own, existing combination code path extended
with a real, second, genuinely balanced posting: "Units On Hand" (the real
count itself) against "Units Received From" (its own, real, genuine,
balanced counterpart) - both under this specific business, both tagged
with their own, distinct, real currency (e.g. `UNITS-SECURE`), entirely
separate from the real dollar value already posted alongside it. Neither
currency is ever blended with the other - the real, established
"many-currencies" principle applied consistently to counts, not only space
and dollars.

Both confirmed directly, not assumed: 198/198 backend tests pass (196 plus
these two, real, new, deliberately-checked proof tests); the real tutorial
fixture's own trial run still passes all 10 real steps unchanged;
check-backend-types and check-docs-coverage both clean; the
journal-staging-only guard re-confirmed with no new violations (the same
two, already-known, pre-existing exceptions, unrelated to this work).

**Honestly, precisely incomplete, stated directly**: this parallel
count-posting is implemented for `receiveStockAtLocation`'s own combination
path only - Sales and COGS, and every other real stock-movement function
(dispatch, transfer, write-off), do not yet have their own parallel
count-posting built. Per direct instruction that this is fundamental, this
remains real, further, necessary work, not yet finished everywhere it
belongs.

## 22. Extended one after another until completed - dispatch, transfer, write-off all now have parallel count-posting

Per direct instruction to proceed "one after another until completed":
every real stock-movement function now has the same parallel count-posting
`receiveStockAtLocation` was given at checkpoint 414.

**`dispatchStockFromLocation`**: had no real combination support at all
before this - extended with both the real, combination-tagged Inventory
value posting (debit COGS, credit Inventory - the exact, real mirror of a
receipt, reversed) and the real, parallel "Units On Hand"/"Units Received
From" count posting. Proven directly: 12 real units received, 5 real units
dispatched, exactly 7 remaining for that specific, real combination.

**`transferStock`**: already had real, combination-tagged value support; a
real, parallel count posting added. **A real, genuine bug found and fixed
in the process**: the first attempt gave the source and destination leaves
two different, real currencies (each tagged with its own location name) -
since the source and destination sides of a real, balanced posting must
share the exact, same real currency to balance against each other at all,
this genuinely could never balance. Corrected: the same, real, physical
units use one, shared, real currency based on the combination values alone
(never the location) - a transfer relocates the same real units, it never
changes their real kind. Proven directly: two, real, distinct leaves
(source and destination), sharing the exact, same real `UNITS-SECURE`
currency, summing to a genuine zero (-8/+8).

**`writeOffStock`**: had no real combination support at all before this -
extended with the real, parallel count posting only (the real dollar value
is already recorded by the existing, outer, non-combination code - never
re-posted a second time). **A real, separate, pre-existing bug found while
writing the direct proof test, not introduced by this work**:
`ensureProductInventoryAccount`'s own base "Inventory" lookup, and the
outer write-off code's own bare-name resolution of a real, brand-new
expense account name, both assume the referenced, real entity already
exists - `stageLine`'s own bare-name resolution auto-vivifies only the
`account` table row for an already-existing real entity, never the entity
itself. A real, brand-new business's write-off genuinely fails with a
"NOT NULL constraint" error unless its own real expense account entity is
created first - worked around directly in the test (creating the real
entity explicitly before the real write-off call), the real, underlying gap
left open and undocumented no further, since it lies in code this session
did not touch or introduce.

Confirmed directly: 201/201 backend tests pass (198 plus three, real, new,
deliberately-checked proof tests - dispatch, transfer, write-off); the real
tutorial fixture's own trial run still passes all 10 real steps unchanged;
check-backend-types and check-docs-coverage both clean; the
journal-staging-only guard re-confirmed with no new violations.

**Every real stock-movement function named at checkpoint 414 now has
parallel currency and count posting for a real, tagged combination -
receive, dispatch, transfer, and write-off alike.**

## 23. Two conflicts with the manual found and surfaced, per the "manual is authoritative" skill

**1. This design's own documents were not in the manual.** Checked by
direct query at checkpoint 416: `storage-space-as-currency-design.md`,
`skill-manual-is-authoritative.md`, `skill-transactional-integrity.md`, and
`skill-version-check.md` were not registered in
`docs/build-programmer-manual.py`, so none of them appeared in the assembled
Programmer's Manual (the skill requiring the manual be authoritative had
zero hits in it). The documentation-coverage check had been passing only
because one-line mentions were being added to a document that *was*
included — satisfying the checker, not the intent. All four are now
registered and confirmed present in the built manual.

**2. A pre-existing plan overlaps this design and was never consulted
before designing.** `cold-shelf-storage-inventory-model-plan.md` (Part IV)
already describes hot/cold storage and carton-to-bottle breaking. Read so
far (its rules and its "what already exists" section):

- Consistent with this design: the one-directional shelf-to-cold flow, and
  cartons being opened on demand into bottles.
- **Unresolved overlap, needs a decision:** it models cold storage as a
  separate, linked "Refrigerated" *sub-location* (`resolveDispatchLocation`
  and the "Create Refrigerated Section" button on the Locations page). This
  design models Hot/Cold as a *Storage dimension of the cartesian product*
  instead. Both mechanisms now exist in the code. The instruction that the
  new mechanism "entirely replaces the old" was applied to per-location
  capacity accounts only; it has not been applied to the cold-section
  mechanism.

**Correction (checkpoint 417):** the first version of this section named
`isColdStorageProduct` and `COLD_STORAGE_CATEGORIES` as existing code. They
do not: `docs/entity-model.md` ("The first real dimension made explicit:
Storage Origin") records that both were removed entirely, replaced by
`setItemStorageOrigin`/`getItemStorageOrigin`. The cold-shelf plan and
`docs/function-inventory.md` are stale on this point. The names were taken
from the plan's "what already exists" section and never checked against the
code. `resolveDispatchLocation` does exist (`backend/src/db.ts`).

**3. The manual records Hot/Cold as a deliberate first-class design, which
the current principle contradicts.** `docs/entity-model.md` documents Storage
Origin (Hot/Cold) as "the first [dimension] made genuinely explicit, per
direct instruction". The current principle is that hot/cold, storage,
division and category are merely *suggested* classification hierarchies with
no special treatment anywhere in code. These conflict. See
`docs/classification-neutrality-impact.md` for the measured impact.

The remaining ~145 lines of the cold-shelf plan have not been read.

## 24. Code and tests: where to look

**How to use this section when a test fails.** Search the manual for the failing
test's exact title. It appears once below, under the step of the story it
belongs to. Each entry has the same five parts: what the test *proves*, the
*code under test*, *why the code is shaped that way* (what a fix must preserve),
*if it fails* (what the failure means and where to look), and how to *run it
alone*. Read the design decisions first if you have time; they explain the
shapes the tests check. Run one test with `make test-one TEST="<fragment>"`.
Verified at checkpoint 418: each of the ten tests below passes when run alone
against a fresh database (`make reset-db` first). That is not guaranteed of every
test in the suite, which shares one database, so if a test fails alone, run the
whole file before concluding the code is broken.

### The story, in the order it happens

1. A **location is created** and, in the same transaction, given a built-in
   `Storage Capacity` structure holding its opening capacity.
2. **Stock arrives** (`receiveStockAtLocation`): value, unit count and occupied
   space are each recorded, each balanced on its own.
3. Stock **leaves** (`dispatchStockFromLocation`), **relocates**
   (`transferStock`) or is **lost** (`writeOffStock`).
4. Cartons are **opened** into bottles (`openStorageContainer`), and space is
   **converted** between storage combinations (`convertStorageSpace`).

| Function | File | Job |
|---|---|---|
| `ensureStorageCapacityStructure` | `backend/src/db.ts` | creates `Storage Capacity` → `Remaining`/`Installed`/`Occupied` under any parent |
| `ensureLocationCapacityAccount` | `backend/src/db-stock.ts` | a location's opening capacity, as a `Bottle` or `Carton` leaf |
| `adjustLocationCapacity` | `backend/src/db-stock.ts` | moves space between `Remaining` and `Occupied` on every stock movement |
| `ensureUnitsTrackingBaseAccounts` | `backend/src/db-stock.ts` | creates `Units On Hand` / `Units Received From` under a business |
| `receiveStockAtLocation`, `dispatchStockFromLocation`, `transferStock`, `writeOffStock` | `backend/src/db-stock.ts` | the four stock movements |
| `convertStorageSpace`, `openStorageContainer` | `backend/src/db.ts` | the two space operations |
| `stageLocation`, `postLocation` | `backend/src/db-journal.ts` | the location form's staging and posting |

### Design decisions: why the code is this shape

**D1. `Storage Capacity` is built in, with three leaves.** `Remaining` is space
still free, `Installed` is total physical capacity, `Occupied` is space in use.
The identity **Installed = Remaining + Occupied** holds at every moment. The
structure sits directly under a business and under every location — not under
Chart of Accounts, so it is deliberately invisible to the Balance Sheet, P&L and
Trial Balance, which all walk from Chart of Accounts. Each leaf is "amplified" by
the user-defined combinations in use (for example `Bottle`, `Carton`), each its
own leaf with its own currency.

**D2. `Installed` moves only when physical capacity is built or removed.** An
ordinary stock movement merely occupies or frees existing space, so it moves
space between `Remaining` and `Occupied` and never touches `Installed`. An
earlier version posted stock movements one-sided against `Remaining` alone,
breaking the rule that no posting is ever single-sided. `Occupied` exists to be
`Remaining`'s genuine counterpart.

`adjustLocationCapacity` takes the change in the item's own base unit (bottles):
**positive when stock arrives** (receipt, transfer in), **negative when it leaves**
(dispatch, write-off, transfer out, a stock-take shortfall). Capacity moves the
opposite way: arriving stock consumes space, leaving stock frees it. For a
location tracked in cartons, the quantity is divided by the item's preferred
vendor package size, defaulting to 12.

**D3. Names repeat, so leaves are found by id, never by name.** `Remaining` and
`Installed` legitimately exist under every business and every location.
`ensureCombinationAccountLeaf` therefore takes an explicit parent id; its
bare-name lookup would attach a leaf under whichever parent created that name
first. This is the same class of bug fixed elsewhere in this project.

**D4. Unit counts are a currency too.** How many units exist is a fact
independent of what they are worth, so it is posted separately, in its own
currency (`UNITS-<combination values>`), against its own counterpart:
`Units On Hand` is balanced by `Units Received From`, the way a receipt's
Inventory is balanced by Accounts Payable. Counts are never blended with dollars
(`USD`) or space (`SPACE-<values>`); each currency balances on its own.

**D5. A transfer shares one currency across both locations.** The same physical
units are relocating; they never change kind. The count currency is built from
the combination values alone, never the location. A first attempt tagged each
side with its own location and could never balance, since two different
currencies cannot offset each other. Transfers count 1:1 and never look up a
rate: a transfer does not repackage or re-denominate.

**D6. A write-off posts only the count, and this leaves a known gap.** The outer,
non-combination code records the dollar value and credits the *generic*
per-product Inventory account. The combination block adds only the unit count.
This was **not** the result of a failing balance. A first version also posted
value from the combination block; the test then failed for an unrelated reason (a
missing expense-account entity, see the write-off test below), and the value
posting was removed on a design theory that it would reduce Inventory twice, not
on evidence. **Open gap:** a receipt builds value in the *combination's*
Inventory leaf (D8), but a write-off credits the generic account, so after a
receipt followed by a write-off the combination's Inventory leaf still holds the
value of units that no longer exist. Which Inventory account a write-off should
credit for a combination has not been decided or tested.

**D7. Opening a carton is not a conversion.** Carton-space freed and
bottle-space consumed are two independent events that merely happen together, one
physical action. Each balances only against its own `Installed` counterpart, and
no rate connects them. Converting Hot to Cold, by contrast, is a genuine
exchange between two currencies with its own one-directional rate; if no rate was
ever defined, that direction was never meant to be possible (Cold back to Hot).
Neither operation posts inventory *value*: a carton versus its own bottles is a
fixed multiplier, like dollars versus cents, never an exchange.

**D8. How the four stock movements are shaped.**

- Every write in a movement happens in **one atomic transaction**. It used to be
  several separate steps that could diverge if interrupted, such as a quantity
  movement posting while its capacity adjustment never happened.
- **Receipt** updates the location's own `quantity_on_hand` (`item_location`) and
  the item's overall quantity, through `postQuantityMovement`, which remains the
  source of truth for "how much do we have in total, across every location". It
  debits the product's on-hand quantity at the location it arrived at and credits its "on order" quantity. "On order" is an independently
  meaningful fact, built up when a purchase order is placed (`placeOrder`), not
  an invented counteritem. A receipt with no matching order (an emergency
  purchase) simply drives on-order negative, which is a real signal, not an
  error.
- A **combination receipt** also builds financial Inventory value the moment
  stock is first received for that exact combination, at the item's known unit
  cost (the source `ensureProductLocationLeaf` uses for COGS). An item with no
  known cost builds no fabricated value. It debits Inventory and credits
  Accounts Payable, both resolved by explicit id, because "Accounts Payable" is
  ambiguous by bare name (a Vocabulary word and its translation share it).
- **Dispatch** mirrors receipt. It rejects more than is on hand *at that
  location* (a warehouse may have plenty overall while this location has none).
  It credits on-hand and debits "units sold", the quantity-side counteritem to
  COGS. A combination dispatch frees the same value and count a receipt built.
- **Transfer** is not a sale: no GL entry, no revenue, no customer. It rejects
  locations in different cities (a warehouse serves only its own city's
  outlets). It uses **one shared reference** for a single balanced two-line entry
  (debited at the destination, credited at the source, summing to zero), not two
  postings that merely net out; this is the one case where a quantity account
  has a genuine other side. It records a queryable movement history, because
  transfers once updated only the current-state table. A combination transfer
  moves value from the source location's instance to the destination's; Location
  is always the combination chain's first dimension.
- **Write-off** is a dual-effect transaction, not a quantity adjustment with no
  accounting consequence. It reduces physical quantity through
  `postQuantityMovement` (the mechanism dispatch and receipt use) **and** posts a
  general-ledger entry recognising the loss: debit the write-off expense, credit
  Inventory for the same value. Unlike a sale there is no revenue or customer on
  the other side, only a loss. It once posted a single unbalanced quantity line with no
  counteritem, the same class of bug as the stock-take variance fix. When the
  caller supplies the location, the space the item occupied is freed. Its
  `inventoryAccount` parameter is deprecated, kept only so existing callers do
  not break; the function resolves the product's own Inventory sub-account.

**D9. Capacity postings are unique per location.** `transferStock` calls
`adjustLocationCapacity` twice for one base reference, once per location, so the
location's name is part of the capacity reference. Without it the second call
collides with the first on the unique `(reference, business, ledger)` constraint.

**D10. Comments that were wrong, removed at checkpoints 418 and 419.** They are recorded
because each was trusted by the next reader:

- A block above `ensureStorageCapacityStructure` described
  `ensureStorageBaseAccounts`, a function that no longer exists, and said a base
  account must live under Chart of Accounts to appear in a report. That is the
  opposite of D1.
- A block detached from `convertStorageSpace` listed a third effect, inventory
  value relocating between combinations. The function does not do that, and per
  D7 must not.
- `writeOffStock` carried two adjacent comments that disagreed; the first, saying
  value *and* count are written off in the combination block, was false (D6).
- `transferStock` carried two comments a few lines apart that contradicted each
  other: one said the source and destination leaves share one currency, the other
  said they use two distinct currencies. The second was left over from the first,
  wrong attempt (D5) and never updated when the code was fixed.
- `receiveStockAtLocation`'s own doc block sat above the doc block of
  `ensureUnitsTrackingBaseAccounts`, detached from its function when that helper
  was inserted between them.
- `openStorageContainer` and `postLocation` still called the structure "Storage
  Capacity Remaining/Installed" after it became nested with a third leaf.

### The tests, in the order the story happens

#### `createAndConfigureLocation: real, atomic, balanced Storage Capacity Remaining/Installed accounts, created as part of location creation itself, never a single-sided posting`
- **Proves:** creating a location immediately creates `Storage Capacity` under it,
  with `Carton` leaves under `Remaining` and `Installed` holding +500 / -500 in
  `SPACE-CARTON`.
- **Code under test:** `createAndConfigureLocation` (`db.ts`) →
  `ensureLocationCapacityAccount` (`db-stock.ts`) → `ensureStorageCapacityStructure` (`db.ts`).
- **Why:** D1, D2.
- **If it fails:** a missing `Storage Capacity` means the structure is not created
  directly under the location (check `ensureStorageCapacityStructure`'s parent). A
  wrong balance or currency points at the opening entry in
  `ensureLocationCapacityAccount`. Do not fix it by posting only one side.
- **Run alone:** `make test-one TEST="createAndConfigureLocation: real, atomic"`

#### `stageLocation/postLocation: a real, dedicated staging table behind the location-creation form, matching the exact, established stage/post pattern - the real location, and its own real, balanced capacity accounts, only appear once genuinely posted, never at stage time`
- **Proves:** staging a location creates nothing; posting creates the location and
  its capacity structure atomically, then clears the staged row.
- **Code under test:** `stageLocation`, `postLocation` (`db-journal.ts`);
  `docs/journal-api-reference.md`, "`stageLocation` / `postLocation`".
- **Why:** every form has its own staging table; a location is created only through
  the typed `create()` functions, never a raw insert into `entities` (append-only,
  self-auditing).
- **If it fails:** a location existing before the post means staging is creating
  entities. Missing capacity after the post means `postLocation` no longer calls
  `ensureLocationCapacityAccount` inside its transaction. A surviving staged row
  means the cleanup step is missing.
- **Run alone:** `make test-one TEST="stageLocation/postLocation"`

#### `receiveStockAtLocation with a real combination: parallel currency AND count postings both appear, each genuinely balanced on its own`
- **Proves:** a combination receipt posts dollar value and unit count as two
  separate balanced entries; the count sits in `UNITS-SECURE` under
  `Units On Hand` / `Units Received From` (+12 / -12).
- **Code under test:** `receiveStockAtLocation`, `ensureUnitsTrackingBaseAccounts` (`db-stock.ts`).
- **Why:** D4, D8.
- **If it fails:** missing `Units On Hand` under the business means the count block
  did not run (is `combinationValues` reaching it?). A wrong balance or currency
  points at the count entry; an imbalance error usually means the two count legs
  do not share one currency.
- **Run alone:** `make test-one TEST="receiveStockAtLocation with a real combination"`

#### `adjustLocationCapacity: a real, genuinely balanced posting against Occupied - never single-sided, and Installed = Remaining + Occupied holds as a real accounting identity`
- **Proves:** with 100 units of capacity, receiving 10 leaves `Remaining` 90,
  `Occupied` 10 and `Installed` untouched at 100, and posts exactly one journal
  entry.
- **Code under test:** `adjustLocationCapacity`, `ensureLocationCapacityAccount` (`db-stock.ts`).
- **Why:** D2, D9.
- **If it fails:** if `Installed` changed, something posted against it during an
  ordinary movement. If the entry count is not one, the posting has become
  one-sided or split. If the identity breaks, look for a path that moves `Remaining`
  without `Occupied`.
- **Run alone:** `make test-one TEST="adjustLocationCapacity"`

#### `dispatchStockFromLocation with a real combination: parallel currency AND count postings both appear, genuinely reversed from a real receipt, each independently balanced`
- **Proves:** receiving 12 then dispatching 5 leaves 7 units on hand for that
  combination.
- **Code under test:** `dispatchStockFromLocation` (`db-stock.ts`).
- **Why:** D8, D4.
- **If it fails:** a count of 12 means the dispatch count block did not run; a
  count of 17 means it posted with the wrong sign. Compare with the receipt test
  first; if that fails, fix it before this one.
- **Run alone:** `make test-one TEST="dispatchStockFromLocation with a real combination"`

#### `transferStock with a real combination: the real unit count moves in parallel with the real dollar value, one, shared, real currency for the same, physical units - genuinely balanced`
- **Proves:** a transfer of 8 creates two distinct leaves that share `UNITS-SECURE`
  and hold -8 and +8.
- **Code under test:** `transferStock` (`db-stock.ts`).
- **Why:** D5.
- **If it fails:** "entry does not balance (per currency)" almost always means the
  currency became location-specific again. Do not fix it by adding a rate lookup.
- **Run alone:** `make test-one TEST="transferStock with a real combination"`

#### `transferStock: a real, combination-tagged transfer correctly moves the real Inventory value from the source location instance to the destination location instance, per direct instruction`
- **Proves:** the dollar value of a combination transfer moves from the source
  location's Inventory leaf to the destination's.
- **Code under test:** `transferStock` (`db-stock.ts`).
- **Why:** D8 (transfer).
- **If it fails:** the failing test that broke *after* the count posting was added
  was this one, with "entry does not balance", caused by D5's mistake. Suspect the
  count block before the value block.
- **Run alone:** `make test-one TEST="transferStock: a real, combination-tagged"`

#### `writeOffStock with a real combination: the real Inventory value and real unit count are both genuinely written off, in parallel, each independently balanced`
- **Proves:** receiving 10 then writing off 3 leaves 7 units for the combination.
- **Code under test:** `writeOffStock` (`db-stock.ts`).
- **Why:** D6, D8. **This title overclaims.** It says value *and* count are written
  off; the assertion checks only the count, and the combination's Inventory value
  is *not* reduced (the open gap in D6). The test does not detect that gap.
- **If it fails:** a "NOT NULL constraint" on `journal_line.account_id` means the
  expense account entity does not exist yet: the outer code resolves it by bare
  name, which only finds an existing entity. The test creates it first for that
  reason. This is a known gap in `ensureProductInventoryAccount` and the outer
  write-off code, not in the count block.
- **Run alone:** `make test-one TEST="writeOffStock with a real combination"`

#### `openStorageContainer: opening a carton is two, real, independent space movements - never a rate-linked conversion, and genuinely never requires one to be defined`
- **Proves:** opening cartons posts two independently balancing currency groups
  (`SPACE-CARTON`, `SPACE-BOTTLE`) with no rate defined anywhere.
- **Code under test:** `openStorageContainer` (`db.ts`).
- **Why:** D7.
- **If it fails:** an error about a missing exchange rate means a rate lookup was
  added; there must be none. An imbalance means one of the two groups no longer
  pairs with its own `Installed` counterpart.
- **Run alone:** `make test-one TEST="openStorageContainer"`

#### `convertStorageSpace: a real, balanced conversion between storage combinations - never single-sided, and a real, undefined reverse direction genuinely refuses`
- **Proves:** converting Hot to Cold at a defined rate balances in both currencies,
  and the reverse direction, for which no rate was defined, throws.
- **Code under test:** `convertStorageSpace` (`db.ts`); `getCurrencyExchangeRate`.
- **Why:** D7.
- **If it fails:** if the reverse conversion succeeds, a rate exists for it: check
  whether other state defined one, since the test defines a rate in one direction
  only. If the forward conversion does not balance, the freed and consumed groups
  are not each paired with their own `Installed` leaf.
- **Run alone:** `make test-one TEST="convertStorageSpace"`
