# The Stock API — `backend/src/db-stock.ts`

The functions that move stock and space are described under "Moving
stock and space", below.

## Two design decisions the whole file rests on

**1. Quantity and monetary value are two independent facts, not a
debit/credit pair of each other.** Money is naturally double-entry —
it always has a from and a to. A physical unit arriving has no such
natural counter-item in the books. Monetary movements keep using the
existing balanced staging/posting mechanism unchanged; quantity
movements are posted by `commitStagedQuantityMovement` without the
balance check — still an ordinary `journal`/
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
reference through `commitStagedQuantityMovement` (*The Journal API*,
"The three posting paths").

Tests:
- "quantity movements carry a real, queryable location — receive, dispatch, and transfer (both legs) each record where it actually happened, not just updating the current-state snapshot" (`backend/test/db.test.ts`)
- "true double-entry quantity tracking: a real "on order" account for receipts and a real "units sold" account for dispatches — the genuine counteritem, not derived arithmetic, per direct confirmation" (`backend/test/db.test.ts`)

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

Tests:
- "Locations: per-location stock, exactly one billing address, warehouse-direct dispatch for large orders, same-city transfers, and below-reorder reporting" (`backend/test/db.test.ts`)
- "getLocation/setLocation: two real locations sharing the exact same name under two different real businesses stay genuinely distinct" (`backend/test/db.test.ts`)
- "createAndConfigureLocation: real, atomic, balanced Storage Capacity Remaining/Installed accounts, created as part of location creation itself, never a single-sided posting" (`backend/test/db.test.ts`)

## Moving stock and space

Receipt, dispatch and transfer each run in one `db.transaction`, so
their quantity, space and value postings land together or not at all;
a write-off posts its value entry and its quantity entry one after the
other, outside a transaction:

- **`receiveItems`** refuses a quantity that is not positive, an
  unknown item or location, and a service item. It moves the quantity
  onto the item's per-location quantity account against its **On
  Order** account (a receipt with no order drives On Order negative),
  and occupies space (`adjustLocationCapacity`). For a combination it
  also debits the combination's Inventory leaf against Accounts
  Payable at the item's known unit cost (none when the cost is
  unknown), and counts the units: `Units On Hand` against `Units
  Received From` (`ensureUnitsTrackingBaseAccounts`), in a
  `UNITS-{values}` currency.
- **`dispatchItems`** refuses more than is on hand at that location.
  It moves the quantity off the per-location account against **Units
  Sold** and frees space; for a combination it credits the Inventory
  leaf against Cost of Goods Sold and reverses the unit count.
- **`transferItems`** refuses locations in different cities and more
  than is on hand at the source. It posts one two-line quantity entry
  (source down, destination up) and moves space at both locations; for
  a combination it moves the value and the count from the source's
  combination to the destination's.
- **`writeOffItems`** refuses a quantity that is not positive. It debits
  the write-off expense and credits the item's Inventory account for
  quantity × unit cost, moves the quantity against **Write-off**, and,
  given a location, frees its space; for a combination it also writes
  off the unit count.
- **`ensureLocationCapacityAccount`** gives a location its space
  account the first time it is needed (see "The Storage Space Report")
  and posts its opening capacity; **`adjustLocationCapacity`** moves
  space between Remaining and Occupied by the item quantity, divided by
  the package size for a carton location. It never touches Installed.

Tests:
- "stock write-offs (breakage/spoilage): a real dual-effect transaction, reducing quantity on hand AND recognizing the actual loss in the GL, not just an adjustment with no accounting consequence" (`backend/test/db.test.ts`)
- "ensureLocationCapacityAccount: a real, one-time opening balance from the location's own static capacity, retail tracks bottles, warehouse tracks carton-equivalents" (`backend/test/db.test.ts`)
- "adjustLocationCapacity: a real, direct check of the capacity math, retail (1:1 bottles) and warehouse (real, per-item carton conversion)" (`backend/test/db.test.ts`)
- "receiveItems: a real, combination-tagged receipt builds up a real, distinct Inventory value at the exact, right leaf, per direct instruction" (`backend/test/db.test.ts`)
- "transferItems: a real, combination-tagged transfer correctly moves the real Inventory value from the source location instance to the destination location instance, per direct instruction" (`backend/test/db.test.ts`)
- "adjustLocationCapacity: a real, genuinely balanced posting against Occupied - never single-sided, and Installed = Remaining + Occupied holds as a real accounting identity" (`backend/test/db.test.ts`)
- "receiveItems with a real combination: parallel currency AND count postings both appear, each genuinely balanced on its own" (`backend/test/db.test.ts`)
- "dispatchItems with a real combination: parallel currency AND count postings both appear, genuinely reversed from a real receipt, each independently balanced" (`backend/test/db.test.ts`)
- "transferItems with a real combination: the real unit count moves in parallel with the real dollar value, one, shared, real currency for the same, physical units - genuinely balanced" (`backend/test/db.test.ts`)
- "writeOffItems with a real combination: the real Inventory value and real unit count are both genuinely written off, in parallel, each independently balanced" (`backend/test/db.test.ts`)

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
parameters. When they are omitted they fall back to the ambient session
context, `Session.*` (`backend/src/session-context.ts`). That context
exists only for a request whose login has a business recorded:
`auth-middleware.ts` enters it from `getSessionBusiness(token)`, and the
frontend records the business with the `setSessionBusiness` call when one
is chosen on `/session`, and again on every load (`+layout.svelte`).
Without it, `Session.Business` throws and the call fails with a 500 — the
step runner's API path, and any caller that does not log in through the
frontend, must pass the business explicitly.
`setItemLocationLevels` is the narrower, UI-facing wrapper that accepts
the same levels by their camelCase field names.

One naming quirk worth knowing:
`ensureLocationCapacityAccount` resolves a business's own `Locations`
root via the shared `resolveBusinessLocationsRootId` helper rather than
assuming the root is always named plain `"Locations"` — the bundled
Wine Retail Business's own seed data names its root `"Wine Retail
Business Locations"` instead, a pre-existing, tolerated irregularity
in that one business's seed data, not a bug in this function.

Tests:
- "getLocationCapacityStatus: a real location's own, current real stock checked against its own, real configured capacity — found to be purely informational and never enforced anywhere, per docs/TODO.md" (`backend/test/db.test.ts`)

## POS terminals

Two terminals at one shared location can each transact in their own
currency (a border business with one till in CAD and one in USD). A
terminal's currency reuses the `account.currency` column and
`setAccountCurrency` — no bespoke mechanism.

`listPosTerminals` returns every terminal created at a location with
its resolved currency; `null` means it transacts in the business's
home currency. A location with no terminal ever created returns an
empty array, never a guessed default.

`createPosTerminal(terminal, location)` creates the terminal under the
location's `{location} Terminals` container (both only when missing);
`setTerminalCurrency(terminal, currency)` sets or clears its currency.

`getEffectiveSaleCurrency` extends the currency precedence chain
(`docs/multicurrency-design.md`: Division → Business → Account →
Contact) by one level: a terminal's own currency, when set, wins over
all of them.

Tests:
- "createPosTerminal/setTerminalCurrency/getEffectiveSaleCurrency: a real, direct, border-business scenario - two real terminals, one location, two different currencies" (`backend/test/db.test.ts`)

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
`allItemCategories` is a thin wrapper over the fully generic
`getHierarchyAssignments('Category')` (`db.ts`) — the same bulk
tag-lookup every hierarchy-backed screen uses, not a dedicated
Category query.

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

Tests:
- "getStockMovementReport: the real, physical journey of stock — purchases into a warehouse, a real transfer on to a retail outlet, and a real sale, each correctly enriched with its own real category, division, and vendor" (`backend/test/db.test.ts`)
- "getInventoryListing/countInventoryListing: a real, paginated listing of every item/location combination with stock" (`backend/test/db.test.ts`)
- "getInventoryListingByLocation: groups the same real stock data by real location, tagging each with its real group where one exists" (`backend/test/db.test.ts`)

## The Storage Space Report

**`getStorageSpaceReport`** is a dedicated report for the physical
storage-space accounts under each Location's own `Storage Capacity`
structure (Installed/Occupied/Remaining, per currency —
`SPACE-BOTTLE`/`SPACE-CARTON`). They sit in the business's Chart of
Accounts, under `Storage` > *location* > `Storage Capacity`
(`ensureLocationStorageRoot`, then `ensureStorageCapacityStructure`,
`db.ts`); the financial statements leave them out by their `SPACE-`
currency (`nonMoneyCurrencyAccountIds`, `db-reports.ts`), so this is
the one report that shows them.
Installed balances against Remaining at opening (Occupied starts at
zero); a currency's own `balanced` flag checks that however much space
is occupied or remaining still sums to exactly the installed total.
Scoped to the current session's own business (`Session.Business`: see
"Item-location levels and capacity status" for how the frontend sets it).

- **One unit per location.** `ensureLocationCapacityAccount` picks
  `SPACE-BOTTLE` when the location has a `bottle_capacity`, else
  `SPACE-CARTON` from `carton_capacity`, and posts the opening capacity
  (Remaining against Installed) the first time it is called.
- **Every quantity movement moves space.** `adjustLocationCapacity` is
  called by receipts, dispatches, transfers and write-offs with the
  quantity moved; for a carton location it divides by the item's
  `preferredProviderPackageQuantity` (12 when none is set).
- **Never enforced.** Over-filling a location is not refused; Remaining
  goes negative.
- **Shown by** the generated *Inventory and Storage* screen
  (`/reports/storage-space`, report `storageSpace` in
  `frontend/src/lib/screen-runtime.ts`).


## Converting storage space, and opening a container

Both are balanced journal entries between storage-space accounts, each
space account a Product Instance leaf (*The Entity Model*, "The
Hierarchy / Product cartesian mechanism") with a `SPACE-{values}`
currency:

- **`convertStorageSpace(business, ledger, item, shape, from, to,
  quantity, userId, reference?)`** re-fits space from one combination to
  another (shelving for cartons into shelving for bottles) under the
  business's own `Storage Capacity`. The rate is the `sell` exchange
  rate between the two `SPACE-` currencies (*Core Domain Reference*,
  "Currency exchange"); a direction with no rate is refused. It posts
  four lines: `from`'s Remaining and Installed both shrink by
  `quantity`, and `to`'s both grow by `quantity × rate`.
- **`openStorageContainer(business, ledger, location, item, shape,
  container, cartons, unit, units, userId, reference?)`** opens sealed
  cartons into loose units at a location. A location with no
  `bottle_capacity` is refused. It posts four lines: the container's
  Remaining up and Occupied down by `cartons`, the unit's Remaining down
  and Occupied up by `units`; no rate is involved. When the item has a
  unit cost, a second entry moves `units × cost` from the container
  tier's Inventory account to the unit tier's at that location.

Tests:
- "convertStorageSpace: a real, balanced conversion between storage combinations - never single-sided, and a real, undefined reverse direction genuinely refuses" (`backend/test/db.test.ts`)
- "openStorageContainer: opening a carton is two, real, independent space movements - never a rate-linked conversion, and genuinely never requires one to be defined" (`backend/test/db.test.ts`)
- "openStorageContainer: a dozen 12-bottle cartons (144 bottles) moves directly into its own, real, bottle-tier Inventory account, with no contra accounting of any kind - the same real dollar value, just re-tagged, per direct instruction" (`backend/test/db.test.ts`)

## Receive: a physical-only variant that posts value from the frontend

**`receiveStockPhysical`** is a narrower sibling of `receiveItems`: it
does only the physical half of the operation — the quantity movement and the
location-capacity adjustment — and posts **no dollar value journal
entry of any kind**, even for a combination-tracked item. The dollar
Inventory/Accounts-Payable (or Accounts-Payable-equivalent) VALUE
entry that `receiveItems` posts internally for a
combination-tracked item is instead posted **separately, from the
frontend**, through the same generic `/journal/staging` +
`/journal/post` calls the General Journal screen's own "Save" button
uses (`resolveReceiveAccounts` resolves the account names/ids and known
unit cost a frontend caller needs to build that entry itself, returning
`null` when the receipt isn't combination-tracked, since a plain
receipt posts no dollar entry either way).

`receiveItems` itself does the whole job, VALUE entry included, for
every other caller (Cash Purchase's own `/pos/receive-stock` endpoint,
the restocking flow, the tutorials, the tests).

A transfer has no such split. Every caller (the Stock Transfer screen,
the terminal's Transfer Items, the step runner, the restocking flow)
makes the one call, `transferItems`: the stock and its value move in
one transaction. Its non-combination path moves the per-location
Inventory value at the stock's first-in-first-out cost
(`fifoCostMinor`), between the two locations' accounts
(`ensureItemLocationInventoryAccount`), and only when that cost is
above 0, so a transfer of stock with no recorded cost creates no
value account. The core middleware's `transferStock` (`core/ops.ts`)
does the same.

## First-in, first-out cost (original middleware)

What stock leaving a location costs is worked out first in, first out
(FIFO), per item and per location. Nothing extra is stored: no layer
table, no cost column. The layers are read back from the journal every
time, so they cannot drift from the Inventory balance they explain. The
core middleware does the same in `stockLayers`/`costOf` (`core/ops.ts`,
*Core middleware*); the two are kept to the same rules, listed under
"The two middlewares", below.

### The two accounts read

For an item at a location, `stockCostLayers` reads the lines of the
ledger on two accounts, ordered by date, then journal:

- the **quantity account**, `<item> — <location> — Qty`, a child of the
  item (`resolveItemLocationQuantityAccountId`); and
- the **value account**, `<item> — <location>`, under the item's own
  Inventory account in the business's chart (provisioned by
  `ensureItemLocationInventoryAccount`).

No quantity account means no stock there yet: no layers.

### Movements

One business event posts several journals, one reference stem shared:

| Event | Quantity journal | Value journal |
|---|---|---|
| Purchase (cash or on credit) | `REF-RECV-<item>` | `REF` (its invoice) |
| POS or cash sale | `REF-DISPATCH-<item>` | `REF-COGS` |
| Transfer (`transferItems`) | `REF` | `REF-VALUE` |

`stem(reference)` strips `-VALUE`, `-COGS`, `-RECV-…` and `-DISPATCH-…`,
and the lines of one stem add up to one **movement**: a quantity and a
value, and the journals it came from.

### Building the layers

The movements are walked in order, keeping a list of layers, oldest
first, each `{ quantity, value }` in minor units:

1. **Quantity in.** A new layer at the value posted with it. When the
   stock was transferred in (`transferSource` finds, in the movement's own
   journals, a negative line on the same item's quantity account at
   another location), the units arrive as the **source's layers**: the
   source's layers as they stood just before that journal
   (`stockCostLayers(…, beforeJournalId)`), with the transferred quantity
   taken from them oldest first. Any difference between that and the value
   the transfer posted (none, as `transferItems` posts exactly that cost)
   goes to the first layer that arrived.
2. **Quantity out.** `takeLayers` takes the oldest layers first. A whole
   layer goes at its own value; part of one takes
   `round(value × units / quantity)` and leaves the rest, so a layer
   always adds up to exactly what it cost. The value posted with it
   (normally the negative of what was taken) and the value taken are
   placed as below.
3. **Value with no quantity** (a general journal entry on the value
   account, the difference after a quantity out) goes to the newest
   layer, or, with no layer yet, waits for the next quantity in.

So the layers always add up to the location's Inventory balance.

> **Example (the unit test below).** Buy 4 at $10.00 and 6 at $13.00 at
> the shop: `[4 @ $40.00, 6 @ $78.00]`. Transfer 7 to the store: the shop
> keeps `[3 @ $39.00]`; the store holds `[4 @ $40.00, 3 @ $39.00]`, not
> `[7 @ $79.00]`. Selling 5 at the store costs $40.00 + $13.00 = $53.00.

### The cost of stock leaving

`fifoCostMinor(business, ledger, item, location, quantity)` is the value
of `takeLayers(stockCostLayers(…), quantity)`. When the location's layers
hold no value at all (stock received as a quantity only, or its cost
posted to the item's Inventory account rather than the location's), it
falls back to `quantity × getItemUnitCostMinor(item)` (the preferred item
source's unit cost); with no unit cost either, `null`, and the caller
posts no value.

### Callers

- `completePosSale` costs every line before dispatching any of them; two
  lines of one item at one location take successive layers (the cost of
  `before + quantity` minus the cost of `before`). A combination line
  (sizes, variants) uses `getItemUnitCostMinor`.
- `transferItems` costs the transfer before moving the quantity, then
  posts that value out of the source's value account and into the
  destination's, as `REF-VALUE`, only when it is above 0. The Stock
  Transfer screen, the terminal's Transfer Items, the step runner and the
  restocking flow all call it.
- The cube's `stockValue` measure (*New Stock on Hand*, `getCube` in
  `db-matrix-reports.ts`) is the value of the layers still held.

Still at the registered unit cost (`getItemUnitCostMinor`), not FIFO:
`receiveItems` for a combination receipt, `dispatchItems` (delivery
against a sales order), combination transfers, and `openStorageContainer`.
`writeOffItems` and `completeStockTake` take the unit cost from their
caller.

### The two middlewares

| Rule | Original (`db-stock.ts`) | Core (`core/ops.ts`) |
|---|---|---|
| Layers read from the journal, oldest first | yes | yes |
| A transfer arrives as the source's layers | yes (`transferSource`) | yes (the entry's `From Location` relation) |
| Part of a layer, rounded, the rest left behind | yes | yes |
| Value with no quantity goes to the newest layer | yes | yes |
| Layers with no value at all | the preferred source's unit cost | no cost |
| Stock found at a count | the caller's unit cost | the newest layer's unit cost (`costOfFound`) |
| Year-end count merges the layers into one average | not yet | yes (`YEAR_END_COUNT` entries) |
| Write-offs | the caller's unit cost | first in, first out |

Tests:
- "a POS sale costs its units first in, first out, and a transfer carries their cost" (`backend/test/cube.test.ts`)
- "transferred stock arrives as the layers it left with: its oldest units keep their own cost at the new location" (`backend/test/cube.test.ts`)

## Item sources

An item's sources are `Item Source` records under the item, each
related to its vendor, with its detail in `detail_json`, read through
the `item_source` view (`backend/src/db.ts`):

- `addOrUpdateItemSource(input)` creates or replaces the source for one
  (manufacturer, vendor, currency, product instance) combination: SKU,
  UPC, price, package quantity, preferred flag and notes. The item,
  vendor and manufacturer must exist. Preference is set, never derived
  from price.
- `listItemSources(item)` lists them, preferred first.
- `deleteItemSource(id)` removes the `Item Source` tag, so the record
  drops out of the view.
- `getItemPriceForCurrency(item, currency, productInstanceId?)` is the
  price for a currency: the combination's own price when one is set,
  else the item's price in that currency, else its home-currency
  price, else `null`. The preferred source wins at each step.
- `setItemSourceLeadTime(item, vendor, days)` sets a source's lead time
  (below).

Tests:
- "a item can be sourced from multiple manufacturer/vendor combinations, and preference is never derived from price" (`backend/test/db.test.ts`)
- "addOrUpdateItemSource/getItemPriceForCurrency: a real, direct, dual-currency pricing scenario - one real product, two real, independently-set prices" (`backend/test/db.test.ts`)
- "getItemPriceForCurrency: a real, combination-specific price wins over the base item price, per direct instruction (a cold beer costs more than a warm one)" (`backend/test/db.test.ts`)

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

Tests:
- "setItemSourceLeadTime/getItemLeadTimes/getStockOutRiskReport: will this genuinely run out before a fresh order could arrive?" (`backend/test/db.test.ts`)

## Stock takes

**`createStockTake`** creates a sheet for one location: one line per
item currently on record there, snapshotting expected quantity and
`shelf_side`/`rack`/`level`, ordered the way someone walks the floor
(not alphabetically). A stock take is a "Stock Take" entity under the
location, one per event; each line is a child entity, `relation_id`
pointing at the item. `counted` starts empty. Takes `business` as an
optional, explicit parameter for the same reason noted above for
`getInventoryListingByLocation`, which it calls internally.

**`recordStockTakeCount(take, item, counted)`** records one line's
count on a draft take, by renaming the line to `… counted:{n}`. A
completed take, a negative count or an item not on the sheet is
refused.

**`completeStockTake`** treats every counted line's variance as a
genuine loss or gain, never a silent correction — posts the variance
to the ledger and moves the item's per-location quantity account to
what was counted (the quantity against **Count Adjustment**, and the
storage space with `adjustLocationCapacity`), then renames the take
from `— draft` to `— completed`. A shortage debits the variance expense
and credits inventory; an overage is the reverse. Lines never counted
are left untouched. A counted line needs a unit cost in
`unitCostMinorByItem`, or the take is refused. Its `inventoryAccount`
parameter is unused (each line resolves its own per-location Inventory
account).

Two fixed bugs shaped its current shape: each product's variance now
uses its own reference (not one reference shared by every product in
the stock take — `stageLine` upserts on `(reference, account)`, which
used to silently collapse every product's line into the last one
whenever more than one product shared a variance-expense account);
and the quantity side now has its own counter-account, **Count
Adjustment** (it used to stage a single, unbalanced line with no
counter-item, unlike every other movement).

Tests:
- "stock take sheets: ordered by shelf_side/rack (alphabetically, as free text) then level numerically (top to bottom), and completing posts genuine loss/gain variance while leaving uncounted lines untouched" (`backend/test/db.test.ts`)
- "completeStockTake: multiple real, different products sharing the same variance expense account in one real stock take must all post, keeping debit == credit" (`backend/test/db.test.ts`)
- "completeStockTake and writeOffItems: the real quantity-movement journal entry itself must be balanced (debit == credit), not just the dollar-value side" (`backend/test/db.test.ts`)
- "createStockTake resolves an item by its real, scoped item identity, never a same-named entity of a different kind elsewhere in the tree" (`backend/test/db.test.ts`)

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

Tests:
- "lot/expiration tracking: consumption is genuinely FIFO by expiration date, not receipt order, and the expiring-stock report only shows what actually still has quantity" (`backend/test/db.test.ts`)

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

1. **Quantity movements are not all balanced, and nothing enforces
   it.** `commitStagedQuantityMovement` posts without the balance
   check. Receipt, dispatch, write-off, stock take and transfer stage a
   counter-item (On Order, Units Sold, Write-off, Count Adjustment, the
   same item at the other location), but `postQuantityMovement` posts
   one line on its own and is called from 14 places, and `Balance.post`
   (2 places) likewise. The design says every transaction is a cooked,
   balanced general journal entry; step 2 of
   `docs/engine-single-writer-plan.md` (one posting path through the
   engine, which refuses an unbalanced entry) needs these to be
   balanced first.
2. **`placeOrder`'s "on order" line is single-sided.** The standing
   rule is that no posting is ever single-sided. Whether an order is a
   genuine exception, or needs a counter-item, is undecided.
3. **Classification.** The stock listing groups by division and the
   movement report by division and category — among the terms the
   classification-neutrality analysis measures
   (`docs/classification-neutrality-impact.md`).
