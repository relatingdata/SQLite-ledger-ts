# Item/Inventory Lifecycle: Blow-by-Blow, Entity by Entity, Journal by Journal

Every real step traced directly against the live code — each numbered
step below names exactly which entities get created and which real
journal lines get posted, so each can be checked off individually.

## 1. Create a location

Real function: `setLocation(name, {...})`. The entity itself
(`createEntity`) is created *before* this is called (a separate, real
step in every real caller — the entity's name comes first).

1. **Entity already exists** (created via `createEntity({ name,
   parent: 'Locations' })`, a real, plain entity — no journal
   involved).
2. **`contact` row upserted** for that entity: `city`,
   `bottle_capacity`, `carton_capacity`, `timezone`. No journal — this
   is real, plain descriptive data, the same table every contact's own
   details live on.
3. **A real `Location Type — {name} → {type}` entity created**, under
   `Location Type`, its `relation_id` set to point at the real
   Vocabulary word (`Warehouse`/`Retail`/etc.). Any *stale* one for
   this same location (a previous type, if this is a re-set) is
   deleted first. No journal.
4. **If `is_billing_address` is true**: a real `Is Billing Address —
   {name} → Billing Address` entity created; any other location's own
   billing-address record is removed first (exactly one at a time).
   No journal.

**No journal entries at all in location creation.** Purely entity-tree
and `contact`-table facts.

## 2. Create a product/item

Real function: `createItem(name, parentCategory)`.

1. **Entity created** under its real category (`createEntity`).
2. **`setItem`** — a real `contact` row for the item (required for
   `listItems()` to show it at all — confirmed, directly, a real bug
   this session found: an entity alone under Items is not enough).

**No journal entries.** Its real Sales/COGS/Inventory/On
Order/Units Sold accounts are *not* created yet — they're created
**lazily**, the first time something actually needs them (the first
real sale, receipt, etc.) — confirmed directly via
`ensureItemSalesCogsAccounts`/`ensureItemQuantityAccounts`, both
called on-demand, not at item-creation time.

## 3. Order a product (Purchase Order)

Real function: `placeOrder(...)`.

1. **A real `{orderReference} Qty` account** posted to, quantity =
   the ordered amount. Single-sided — a genuine, real, standing
   commitment, no counteritem yet.
2. **A real `{orderReference} Value` account** posted to, same
   pattern, for the dollar value.
3. **The product's own real `On Order` account** (lazily created if
   needed) posted to, **+quantity** — a genuine, real double-entry
   counteritem: "this many units are now genuinely committed, not yet
   physically here."

Reference used for all three: `{orderReference}-PLACE`,
`{orderReference}-PLACE-VALUE`, `{orderReference}-PLACE-ONORDER`.

## 4. Fully receive an ordered product

Two real, separate things happen, together, in the real UI flow:

**(a) `receiveItems(...)`** — the real physical arrival:
1. The item's own real quantity account, **+quantity**, tagged with
   the real, specific location it arrived at.
2. The item's own real `On Order` account, **−quantity** (the real
   counteritem — the commitment is now fulfilled).

Reference: the receipt's own reference (one, shared reference for
both lines — a real, balanced pair).

**(b) `fulfillOrder(orderReference, receiptReference, ...)`** — closes
out the standing order commitment:
1. The order's own `{orderReference} Qty` account, **−quantity
   fulfilled**.
2. The order's own `{orderReference} Value` account, **−value
   fulfilled**.

Reference: `{orderReference}-FULFILL-{receiptReference}` (and its own
`-VALUE` sibling) — genuinely unique per fulfillment, confirmed
directly as a real, fixed bug: reusing one fixed reference broke a
second, later partial fulfillment against the same order.

After a **full** receipt, `getOrderStatus(orderReference)` reads back
`{ quantity: 0, value_minor: 0 }` — nothing left owing.

## 5. Partially receive an ordered product (a real back order)

Identical to §4, except `quantityFulfilled` is less than the real,
original ordered quantity. `fulfillOrder` can be called **again
later**, with a **new**, different `receiptReference`, when the rest
arrives — each call reduces the same order's own `Qty`/`Value`
accounts further. `getOrderStatus` at any point reads back exactly
what's still genuinely outstanding — the real back order, computed
directly, never stored as its own, separate fact.

## 6. Sell with immediate delivery (POS / Cash Sale)

Real function: `completePosSale(...)`, inside one real DB transaction.

1. **A real AR invoice created** (`createInvoice`) — one real line per
   item sold, quantity/price/tax as entered.
2. **The invoice posted** — real Sales Revenue (credit) and
   Accounts Receivable or Cash (debit) journal lines, per the real,
   standard invoice-posting path.
3. **Stock dispatched** from the real, resolved location — the item's
   own real quantity account, **−quantity**; its own real `Units Sold`
   account, **+quantity** (the real, balanced double-entry pair).
4. **COGS recognized** — the item's own real COGS account debited,
   its own real Inventory account credited, at the item's own real,
   current unit cost.
5. **Payment allocated** (if paid immediately, not on-account) —
   real Cash/Bank debited, the invoice's own AR balance reduced by the
   same amount.

## 7. Sell a larger quantity, later delivery from a warehouse (Sales Order → Stock Dispatch)

**(a) `postSalesOrder(...)`** — the real, standing commitment (mirrors
Purchase Order exactly): a real `{orderReference} Qty`/`Value` pair,
plus the product's own real `Units Sold`-side commitment tracking.
Memo-only — no revenue recognized yet.

**(b) `postOrderDispatch(...)`**, later, in full or in part — the real
physical fulfillment: dispatches real stock from the real warehouse
(the same real, balanced quantity pair as §6 step 3), recognizes real
revenue/COGS for exactly what was actually dispatched this time, and
calls `fulfillOrder` against the Sales Order's own reference — the
exact, same real mechanism as a Purchase Order's own partial
fulfillment (§5), mirrored for the sales side.

## 8. Transfer stock between two locations (same city)

Real function: `transferItems(...)`.

1. The item's own real quantity account, **−quantity**, tagged with
   the real, specific **source** location.
2. The item's own real quantity account, **+quantity**, tagged with
   the real, specific **destination** location.

One real, shared reference — the same product's own account, debited
at the destination and credited at the source: a real, meaningful
double-entry pair (the same, real bottles, one real event, two real
locations), not an invented counteritem. No GL/revenue entry at all —
genuinely not a sale.

## 9. Write off a breakage/spoilage

Real function: `writeOffItems(...)`.

1. **The real write-off expense account debited**, the item's own real
   Inventory account credited, at the given unit cost × quantity — the
   real, dollar-value loss recognized in the GL.
2. **The item's own real quantity account, −quantity**; its own real,
   per-product `Write-off` account, **+quantity** — the real, balanced
   quantity-side counteritem, fixed this session (checkpoint 283;
   previously posted only step 2's first half, genuinely unbalanced).

## 10. Stock take, with a real, counted variance

Real function: `completeStockTake(...)`, once per line that has a real
variance (counted ≠ expected).

1. **The real variance expense account** (e.g. `Miscellaneous`)
   credited or debited by the variance's real dollar value; the
   item's own real, per-location Inventory account takes the other
   side — the real, dollar-value side.
2. **The item's own real quantity account** adjusted by the real
   delta (counted − currently on hand); its own real, per-product
   `Count Adjustment` account takes the other side — the real,
   balanced quantity-side counteritem, fixed this session (checkpoint
   283; previously posted only this step's first half, genuinely
   unbalanced — the exact, original, reported bug).

## Real, open items, not yet resolved (see `stock-lifecycle-review-plan.md`)

- **Storage capacity as an actively-tracked, double-entry counteritem — corrected, this was stale.** `adjustLocationCapacity` already posts real, live entries against each location's own real `Storage Capacity Remaining` account, checked directly (confirmed live in the real chart of accounts, one per location). `bottle_capacity`/`carton_capacity` are not merely informational.
- **Refrigerated vs. room-temperature capacity as its own, separate, real dimension — corrected, this was stale too, and the design is now settled: storage capacity is a real cartesian product, Location × StorageType (Room-temperature, Refrigerated), the exact, same, established structural pattern this codebase already uses for Product × Tier.** Today's actual, live mechanism still models refrigerated storage as a second, separate location entity, name-linked to its own real parent (`"{location} — Refrigerated"`) rather than a genuine second facet of the one, same location — a real, working, but structurally different workaround from the cartesian design now specified, and the two are not yet reconciled; the cartesian design is the intended, corrected shape, the paired-sibling-location mechanism is what's actually built today.
- **Item size within a storage section — a real, further, genuinely unresolved constraint.** A shelf or fridge section built for 330ml cans or bottles has a fixed, real, physical height a 750ml bottle simply cannot fit into, regardless of how much numeric capacity is nominally left — "is there room" and "does the size fit at all" are two, separate, real questions today's plain count doesn't distinguish. Two real directions, neither chosen yet: (a) a real size-class compatibility check, alongside the existing count, each storage section carrying its own real maximum size class and each item its own; or (b) capacity measured in a real physical unit (e.g. a volume or height-equivalent slot count) rather than plain item count, so a 750ml item genuinely consumes more of it than a 330ml one — capturing both facts in one number, at the cost of re-deriving every existing capacity figure into that unit.
- Partial/security-driven stocktakes — deliberately deferred.
