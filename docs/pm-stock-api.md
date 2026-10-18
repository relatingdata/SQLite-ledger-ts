# The Stock API — `backend/src/db-stock.ts`

The seven functions that move stock and space —
`ensureLocationCapacityAccount`, `adjustLocationCapacity`,
`ensureUnitsTrackingBaseAccounts`, `receiveItems`, `dispatchItems`,
`transferItems`, `writeOffItems` — are documented, with their tests,
in `docs/storage-space-as-currency-design.md`, "Code and tests: where
to look," and not repeated here.

## Two design decisions the whole file rests on

**1. Quantity and monetary value are two independent facts, not a
debit/credit pair of each other.** Money is naturally double-entry —
it always has a from and a to. A physical unit arriving has no such
natural counter-item in the books. Monetary movements keep using the
existing balanced staging/posting mechanism unchanged; quantity
movements use a separate, simpler counter update (the
`post_quantity_movement` trigger) — still an ordinary `journal`/
`journal_line` row, so there is a full audit trail, but never forced
through a zero-sum check that only makes sense for money. (Whether
this still holds cleanly in practice is Open Question 1, below.)

**2. Orders live under `Orders`, not under Chart of Accounts.**
Reports only ever walk the real chart, so nothing posted for an order
leaks into a real financial statement. Placing an order posts to that
order's own Qty and Value accounts; fulfilling it posts the opposite.
**The order's remaining balance *is* the back-order quantity** — no
separate status field anywhere, the same way a bank balance is just a
number, not a number plus a flag.

## Quantity movements

`postQuantityMovement` posts a single quantity movement against one
account, creating the account first if it has never been posted to.

`stageQuantityMovementLine` stages one quantity-movement line into the
same `journal_entry_staging` table the ordinary financial path uses —
exposed separately from `postQuantityMovement` (which stages and
posts in one call for the common single-location case) so a genuinely
two-sided movement, a transfer between two locations, can stage both
lines under **one shared reference** and post once as one balanced
entry, rather than two postings that merely happen to net to zero.

Resolving an account by name: a product entity always, structurally,
descends from `Items`; its Sales/COGS/Inventory accounts never do
(they live under Sales Revenue/Cost of Goods Sold/Inventory). When one
name resolves to more than one entity, prefer the one whose ancestor
chain reaches `Items` — the reliable way to tell the product itself
from its same-named financial accounts. This name-based fallback is
used only when the caller doesn't already know the exact account id;
every account scoped under a specific item or location (On Order,
Units Sold, the storage-capacity leaves) has a simple, non-globally-
unique name, so passing the id explicitly is what keeps posting
correct.

`postStagedQuantityMovement` posts every line staged under a
reference through the parallel `post_quantity_movement` trigger, not
a direct write.

## Locations

`Location.timezone` is a real IANA identifier, never a fixed UTC
offset.

**Location types are Vocabulary words**, user-extensible through
`createLocationType`, never a fixed, built-in list — the same proven
pattern as `listAddressTypes`/`ensureAddressType`: a dedicated
"Location Types" container entity, listing its own direct children
(not derived from which entities already have a type link, which would
make a brand-new type unable to appear until first assigned).

**`setLocation`**: a location's plain data (city, shelving/floor-area
capacity, timezone) is ordinary per-entity data on `contact`, the
general-purpose table every party's details live on, not a dedicated
location table. `location_type` and `is_billing_address` are "kind"
tags, recorded as a named relationship record (`Location Type —
{location} → {marker}`) — this deliberately never touches the
location's own `relation_id` slot, already used by its "Belongs To
Division" link. **Exactly one billing address at a time**: setting a
new one removes every other "Is Billing Address" record first.

**`todayAtLocation`** returns the correct calendar day right now at a
specific location, using that location's own IANA timezone, never the
server's — SQLite has no working timezone support (no ICU extension;
`datetime()`/`strftime()` silently return `NULL` for a named zone).
Luxon, backed by Node's complete IANA data, handles this correctly,
including seasonal transitions (Sydney and Brisbane, sharing a long
border, are an hour apart every southern-hemisphere summer, since NSW
observes daylight saving and Queensland never does).

## Item-location levels and capacity status

**`getLocationCapacityStatus`** returns a location's current total
quantity on hand, checked against its configured capacity — purely
informational, never checked/blocked anywhere (`docs/TODO.md`). The
carton-equivalent quantity is computed per product using that
product's own preferred-vendor `package_quantity`, not a flat
bottles-per-carton figure, since that genuinely varies (wine/spirits
at 12, beer at 24). `preferredProviderPackageQuantity` (private)
supplies that conversion — there is no exchange-rate table;
`item_source.package_quantity` *is* the carton-to-bottles rate,
one-directional (a carton broken open becomes bottles; bottles are
never reassembled). A retail outlet (with `bottle_capacity` set) tracks
in bottles; a warehouse (only `carton_capacity`) tracks in
carton-equivalents using the item's own factor.

## POS terminals

Two terminals at one shared location can each transact in their own
currency (a border business with one till in CAD and one in USD). A
terminal's currency reuses the `account.currency` column and
`setAccountCurrency` — no bespoke mechanism.

`listPosTerminals` returns every terminal created at a location with
its resolved currency; `null` means it transacts in the business's
home currency. A location with no terminal ever created returns an
empty array, never a guessed default.

`getEffectiveSaleCurrency` extends the currency precedence chain
(`docs/multicurrency-design.md`: Division → Business → Account →
Contact) by one level: a terminal's own currency, when set, wins over
all of them.

## Stock listing and the movement report

**`getStockListing`/`countStockListing`** list every item/location
combination with stock tracked, ordered item then location, paginated
(`limit`, `offset`). Each row carries the division matching the
location's own city (`cityDivisionFor`) and the location's capacity
status.

**`getStockListingByLocation`** is the same data grouped by
location/division — deliberately not paginated (read a location at a
time; the number of locations stays small even as the catalogue
grows).

**`allItemCategories`/`allPreferredProviders`** (private) fetch every
item's category or preferred vendor in one query each, to avoid a
query per row on a report that can have thousands (measured: the
naive per-row version took ~4 seconds for one month of data).

**`getStockMovementReport`** reports stock's physical journey
(received, transferred, sold), groupable by division/location/vendor/
category — built from the same `journal_line.location_id` the
receive/dispatch/transfer functions already populate, never a
separate, parallel log. Both legs of a transfer are matched by
`journal_id` directly. Sales postings for the date range are fetched
once and keyed by (invoice reference, Sales account name) to avoid a
per-row query — a Sales account named `Sales - X (Bottle)` is reduced
to `X`, the plain item name a dispatch's quantity row already carries.

## Reorder, lead times, and stock-out risk

**`getBelowReorderStock`** lists every (item, location) at or below
its reorder level — the real trigger for "time to order," distinct
from the floor *min* level (which says something has already gone
wrong).

**`setItemSourceLeadTime`/`getItemLeadTimes`** hold a lead time in
days for one item from one vendor, with no new tables or columns —
encoded in a named link-entity (`{item} — Lead Time: {vendor} (14
days)`).

**`getStockOutRiskReport`** answers: will this item run out before a
fresh order placed today could arrive? Recent consumption (a
deliberately short trailing window) is compared against the shortest
lead time among the item's known vendors.

## Stock takes

**`createStockTake`** creates a sheet for one location: one line per
item currently on record there, snapshotting expected quantity and
`shelf_side`/`rack`/`level`, ordered the way someone walks the floor
(not alphabetically). A stock take is a "Stock Take" entity under the
location, one per event; each line is a child entity, `relation_id`
pointing at the item. `counted` starts empty.

**`completeStockTake`** treats every counted line's variance as a
genuine loss or gain, never a silent correction — posts the variance
to the ledger and brings `item_location.quantity_on_hand` into line
with what was actually counted. A shortage debits the variance expense
and credits inventory; an overage is the reverse. Lines never counted
are left untouched. Its `inventoryAccount` parameter is deprecated and
unused (each line resolves its own per-product Inventory account) but
kept so existing callers don't break.

Two fixed bugs shaped its current shape: each product's variance now
uses its own reference (not one reference shared by every product in
the stock take — `stageLine` upserts on `(reference, account)`, which
used to silently collapse every product's line into the last one
whenever more than one product shared a variance-expense account);
and the quantity side now has its own counter-account, **Count
Adjustment** (it used to stage a single, unbalanced line with no
counter-item, unlike every other movement).

## Lots

**`receiveLot`** records a specific batch of an item arriving, with
its own expiration date — `postQuantityMovement` is still the source
of truth for "how much do we have"; lots answer "which batches,
expiring when." A lot is a child entity under the item, never a
separate table; mutable state (`quantity_on_hand`, `cost_basis_minor`)
lives in that entity's own `detail_json`.

**`consumeFromLots`** draws from an item's lots oldest-expiring first
(FIFO-by-expiration) — rejects consuming more than is on hand across
all lots combined rather than silently going negative, and returns
which lots were drawn from and how much. The `id ASC` tiebreaker
matters for lots sharing a `NULL` expiration (a currency lot never
expires; `entity_id` is monotonic with creation order, so it still
means acquisition order).

**`getExpiringStock`** returns lots expiring within a window or
already expired (negative `days_until_expiration`). Lots with no
expiration date are never included.

## Orders

**`createSystemEntity`** is a lightweight entity for internal
bookkeeping (an order's own Qty and Value entities, a bootstrap
category) — bypasses the normal `entity_entry` audit-trail machinery
since these are never edited or renamed, only created once.

**`placeOrder`** creates the order's Qty and Value entities under
`Orders` (parented by name so multiple orders don't collide) and posts
the committed quantity/value to them — **purely informational;
nothing here touches a real account.** Qty's relation carries the
vendor and Value's carries the item (the same "relation is a separate,
lateral tag" mechanism used for COGS and CoA-prototype tagging).
Delivery/dispatch instructions use the generic Location dimension on
the Qty leaf, since the relation slots are already taken.

**`fulfillOrder`** reduces the order's Qty and Value memo balances by
exactly what was fulfilled — **whatever remains is the back order**,
read directly, never stored separately. References include the
`fulfillingReference` (the receipt/dispatch doing the fulfilling) so
they're unique per call — a fixed bug: the naming used to assume
exactly one fulfilment per order, but partial fulfilment (a back order
closed over several separate receipts) is explicitly supported, and
reusing the same reference on a second partial fulfilment used to
silently corrupt `journal_line`.

**`getOrderStatus`** returns the remaining committed quantity/value on
an order: zero means fully fulfilled; anything else is the open back
order.

## Open questions — recorded, not resolved

1. **Are quantity movements balanced, and is that enforced?** Decision
   1 above (and the Journal API chapter's "three posting paths") both
   say a quantity movement is a single line with no counter-item. But
   every movement function now gives its lines a counter-item: receipt
   uses On Order, dispatch uses Units Sold, write-off uses Write-off, a
   stock take uses Count Adjustment, a transfer uses the same item at
   the other location. Whether the `post_quantity_movement` trigger
   *enforces* that the lines sum to zero has **not been checked**. Both
   descriptions cannot be right.
2. **`placeOrder`'s "on order" line is single-sided.** The standing
   rule is that no posting is ever single-sided. Whether an order is a
   genuine exception, or needs a counter-item, is undecided.
3. **Classification.** The stock listing groups by division and the
   movement report by division and category — among the terms the
   classification-neutrality analysis measures
   (`docs/classification-neutrality-impact.md`).
