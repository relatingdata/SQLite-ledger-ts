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

**`setLocation`/`getLocation` are both scoped by `business` directly
in the SQL that selects the row** (via `resolveBusinessLocationsRootId`
and a `parent_id = <that root>` filter), never a bare, unscoped
name lookup followed by a check applied afterward — a location name is
only unique *within* a business, not globally, so an unscoped lookup
can silently resolve to an unrelated, same-named location (or even a
same-named business, e.g. one literally called `"admin"`) belonging to
someone else entirely. When `business` is omitted, both fall back to
the first globally-matching row by bare name — callers that know which
business they mean should always pass it.

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

**`setItemLocationLevelDetails`** (min/max/reorder/shelf-side/rack/
shelf-level) takes `business`/`ledger`/`userId` as optional, explicit
parameters — set them when calling from an HTTP route, since nothing
in this application's own request handling establishes the ambient
session context `Session.*` these fall back to when omitted.
`setItemLocationLevels` is the narrower, UI-facing wrapper that accepts
the same levels by their camelCase field names.

**`ensureLocationCapacityAccount`/`adjustLocationCapacity`/
`ensureUnitsTrackingBaseAccounts`/`receiveItems`/`dispatchItems`/
`transferItems`/`writeOffItems`** are documented, with their tests, in
`docs/storage-space-as-currency-design.md` § 24, "Code and tests: where
to look" — not repeated here. One naming quirk worth knowing:
`ensureLocationCapacityAccount` resolves a business's own `Locations`
root via the shared `resolveBusinessLocationsRootId` helper rather than
assuming the root is always named plain `"Locations"` — the bundled
Wine Retail Business's own seed data names its root `"Wine Retail
Business Locations"` instead, a pre-existing, tolerated irregularity
in that one business's seed data, not a bug in this function.

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

**`getInventoryListing`/`countInventoryListing`** list every
item/location combination with stock tracked, ordered item then
location, paginated (`limit`, `offset`); `countInventoryListing` is
scoped to the current session's own business, never a bare, global
count across every business.

**`getInventoryListingByLocation`** is the same data grouped by
location, optionally tagged with a named-Hierarchy group
(`hierarchyName` — e.g. `"Division"`, or any other real, business-
chosen hierarchy; never hardcoded, so a location's `group` is `null`
unless a caller explicitly asks for one). Deliberately not paginated —
read a location at a time; the number of locations stays small even as
the catalogue grows. Takes `business` as an optional, explicit
parameter — falls back to the ambient session context only when
omitted, the same pattern as `setItemLocationLevelDetails` above, and
for the same reason (no live HTTP route in this application
establishes that ambient context itself). `getBelowReorderStock` and
`getStockOutRiskReport` are both built directly on top of this
function's own output.

**Business-scoping is not yet complete end to end**: `getItemLocation`
(min/max/reorder levels, shelf position) and `getLocationCapacityStatus`
still have no `business` parameter of their own, so if two different
businesses genuinely share both an item name and a location name,
either one's figures could still come from the wrong business — a
narrower, real, currently open gap, distinct from (and already fixed
ahead of) the broader unscoped-lookup bug class documented throughout
this chapter.

**`allItemCategories`/`allPreferredProviders`** (private) fetch every
item's category or preferred vendor in one query each, to avoid a
query per row on a report that can have thousands (measured: the
naive per-row version took ~4 seconds for one month of data).

**`getStockMovementReport`** reports stock's physical journey
(received, transferred, sold), groupable by vendor/category and,
optionally, by a named-Hierarchy group for each row's location (the
same `hierarchyName` convention as `getInventoryListingByLocation`
above) — built from the same `journal_line.location_id` the
receive/dispatch/transfer functions already populate, never a
separate, parallel log. Two distinct locations sharing one journal
entry is structurally what a transfer's two legs are (one location's
count decreasing, the other's increasing) — matched by `journal_id`
directly. A single location's own line is a receipt when its quantity
is positive and a dispatch when negative — the sign itself is the
structural distinction, never a reference-string pattern. Sales
postings for the date range are fetched once and keyed by (invoice
reference, Sales account name) to avoid a per-row query — a Sales
account named `Sales - X (Bottle)` is reduced to `X`, the plain item
name a dispatch's quantity row already carries.

## The Storage Space Report

**`getStorageSpaceReport`** is a dedicated report for the physical
storage-space accounts under each Location's own `Storage Capacity`
structure (Installed/Occupied/Remaining, per currency —
`SPACE-BOTTLE`/`SPACE-CARTON`) — these are never financial accounts
under Chart of Accounts, so the Trial Balance's own tree walk
structurally excludes them; this is the one place to see them.
Installed balances against Remaining at opening (Occupied starts at
zero); a currency's own `balanced` flag checks that however much space
is occupied or remaining still sums to exactly the installed total.
Scoped to the current session's own business.

## Receive/transfer: physical-only variants that post value from the frontend

**`receiveStockPhysical`** and **`transferStock`** are narrower
siblings of `receiveItems`/`transferItems`: each does only the
physical half of the operation — the quantity movement and the
location-capacity adjustment — and posts **no dollar value journal
entry of any kind**, even for a combination-tracked item. The dollar
Inventory/Accounts-Payable (or Accounts-Payable-equivalent) VALUE
entry that `receiveItems`/`transferItems` post internally for a
combination-tracked item is instead posted **separately, from the
frontend**, through the same generic `/journal/staging` +
`/journal/post` calls the General Journal screen's own "Save" button
uses (`resolveReceiveAccounts` resolves the account names/ids and known
unit cost a frontend caller needs to build that entry itself, returning
`null` when the receipt isn't combination-tracked, since a plain
receipt posts no dollar entry either way).

`receiveItems` and `transferItems` themselves are deliberately left
completely unchanged — every other real caller (Cash Purchase's own
`/pos/receive-stock` endpoint, the restocking flow, the tutorial's own
proof scripts, every existing test) is a backend-to-backend call with
no browser-side step of its own to post that VALUE entry instead, so
those two functions still need to do the whole job themselves, VALUE
entry included. `transferItems`'s own non-combination path does now
also move the plain per-location Inventory dollar value with the
stock (via `ensureItemLocationInventoryAccount`), mirroring what its
combination-tagged path already did — a transfer genuinely moves value
with the stock, not just its count and its space, on either path.

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
pointing at the item. `counted` starts empty. Takes `business` as an
optional, explicit parameter for the same reason noted above for
`getInventoryListingByLocation`, which it calls internally.

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
