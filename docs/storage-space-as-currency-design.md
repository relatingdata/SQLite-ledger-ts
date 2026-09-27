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
