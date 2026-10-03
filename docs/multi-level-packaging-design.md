# Multi-Level Packaging and Pricing: a Design Analysis

**Status: an analysis and a proposal. Nothing in it is built.** Raised directly, with a concrete
example: imported beer, ordered by the shipping container, which may hold up to 36 pallets, each
holding 20 cartons, each holding some number of bottles. This is a genuine, three-level packaging
chain (container → pallet → carton → bottle), and it exposes two separate, real limitations —
one smaller than first suspected, one real and unaddressed.

## The two mechanisms, checked separately, not assumed together

**`openStorageContainer` is more general than it first appears, and is not the problem.** Read
directly: it takes `cartonsOpened` and `unitsProduced` as explicit, caller-supplied numbers, not a
fixed, derived ratio. It never computes a conversion itself — it only posts whatever two numbers
it is given. This means it can already be called in a chain for a multi-level hierarchy, since
nothing about its own signature assumes exactly two levels:

```
openStorageContainer(..., ['Container'], 1, ['Pallet'], 34, ...)   // this shipment's container held 34 pallets
openStorageContainer(..., ['Pallet'], 34, ['Carton'], 680, ...)    // 34 pallets x 20 cartons/pallet = 680
openStorageContainer(..., ['Carton'], 680, ['Bottle'], 16320, ...) // 680 cartons x 24 bottles/carton = 16320
```

Each step is the same, real, one-way, physical act already settled for the simple carton/bottle
case — a container cannot be "closed" back up any more than a carton can. `openStorageContainer`'s
own location-scoping defect (it posts to the business root, not a real location) is real and
already recorded in `docs/currency-and-quantity-integrity-fix-plan.md`, Phase 3 — but it is the
same defect at every level of a chain, not a new one introduced by having more levels.

**`price_minor`/`package_quantity`/`getItemUnitCostMinor` is the real, confirmed limitation.**
Read directly: `item_source` carries exactly one `price_minor` and one `package_quantity` per
provider relationship, and `getItemUnitCostMinor` computes the item's real unit cost as
`Math.round(price_minor / package_quantity)` — one single division, assuming the price is quoted
at exactly one level above the item's own base unit. For the beer example, this breaks down two
separate ways:

1. **Which level is the price actually quoted at?** A real, imported-beer invoice is priced per
   container, or per pallet, or per carton, depending on the supplier and the deal — never
   assumed to be any one of them. `package_quantity` has no way to say which level `price_minor`
   belongs to.
2. **The count at each level is not a fixed fact about the item — it is a fact about this
   shipment.** "Up to 36 pallets" means the real number varies by container; it is not a stable,
   universal constant the way "24 bottles per carton" usually is. `item_source`'s own
   `package_quantity` is stored once, per provider relationship, as if it never changes — correct
   for carton/bottle, wrong for container/pallet.

## The model this points to

Per the same, already-settled exchange-rate model this project already uses (a dozen's relation
to a single is one instance of the general concept "exchange rate," the same as a currency rate):
a packaging chain is a sequence of exchange rates, each one a real fact, and **some of those facts
are fixed properties of the item, while others are facts about a specific shipment** — that
distinction, not the number of levels, is the real design question.

- **carton → bottle** is a fixed, universal fact about the item itself: every carton of this item
  always holds 24 bottles. This is exactly what `item_source.package_quantity` already models
  correctly, for this one level.
- **container → pallet** is a fact about a specific purchase order or receipt, not the item: this
  shipment's container held 34 pallets; the next might hold 30. Storing this as a fixed,
  item-level constant (the way `package_quantity` does today) would be wrong the first time a
  real shipment varied from it.

This suggests two different, real mechanisms are needed, not one generalized further:

1. **Fixed, item-level packaging facts** (carton → bottle, and any other level that is genuinely
   always the same for this item) stay exactly where they are, in `item_source`, extended to
   allow more than one named level if a real item genuinely has more than one fixed level (a
   six-pack within a carton, say) — each with its own name and its own fixed rate to the level
   below it, not a single, flat `package_quantity` number.
2. **Variable, shipment-level packaging facts** (container → pallet, when the count genuinely
   varies per shipment) are not item properties at all — they are facts stated once, on a specific
   Purchase Order or Cash Purchase, the same way `openStorageContainer`'s own `cartonsOpened`/
   `unitsProduced` are already stated once, per call, not derived from a stored constant. This
   points toward extending the Purchase Order / Cash Purchase screens themselves to accept a
   quantity at whatever level the supplier actually quotes (so many containers, so many pallets
   per container this time), converting to the item's own base unit using the fixed, item-level
   rate(s) from (1) plus the stated, shipment-specific rate(s), rather than extending
   `item_source` to hold a number that was never fixed to begin with.

## Where the price should be anchored

Per the same distinction: **the price belongs with whichever level it is genuinely quoted at**,
which may be a fixed, item-level unit (cost per carton, always) or a shipment-specific one (this
container's total price, this time). `getItemUnitCostMinor`'s own single division is correct only
when exactly one, fixed, item-level rate separates the quoted price from the base unit — true for
carton/bottle, not true when a variable, shipment-level count sits between them. A price quoted at
a variable level cannot be reduced to a single, fixed, item-level number at all; it has to be
computed at the moment of that specific order or receipt, from that shipment's own, stated counts.

## A concrete proposal, not yet built

1. **Extend `item_source`** to carry an ordered list of fixed, named packaging levels (each with
   its own name and its own rate to the level below), rather than one flat `package_quantity` —
   closing the "more than one fixed level" gap (a six-pack within a carton) without touching the
   variable-level problem.
2. **Do not extend `item_source` to hold a variable, shipment-level count at all.** Instead,
   extend the Purchase Order and Cash Purchase screens (`docs/realistic-tutorial-e2e-plan.md`'s
   own Phase B work) to accept a quantity at any named level the supplier actually quotes for that
   order, plus that order's own, stated count at each variable level between it and the item's
   fixed packaging — exactly the same shape `openStorageContainer` already uses for a single,
   caller-stated conversion, generalized to accept it as real order data instead of a backend
   function argument.
3. **`getItemUnitCostMinor` stays as it is for the fixed-level case** (carton → bottle, via
   `item_source`'s own rate) — it is correct for that case today, and nothing above changes it.
   A variable-level price is computed separately, at the point of that specific order, not
   retrofitted into this function.

## What this analysis has not verified

Whether a real item in this business ever genuinely needs more than one *fixed* packaging level
(the six-pack-within-a-carton case) or whether every real, fixed case so far is exactly two levels
(item/carton); the exact screen fields the Purchase Order/Cash Purchase extension in proposal 2
would need, which has not been designed in detail; and whether any other function besides
`getItemUnitCostMinor` reads `item_source.package_quantity` and would need the same reconsideration
— a direct search found only the one call site, but a change to the stored shape itself would need
re-confirming this before being made.
