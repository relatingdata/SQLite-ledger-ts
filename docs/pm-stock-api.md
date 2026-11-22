# The Stock API — `backend/src/db-stock.ts`

The functions that move stock and space are described under "Moving
stock and space", below.

## Two design decisions the whole file rests on

**1. Quantity and money are two separate facts.** Money is
double-entry: it always has a from and a to. A unit arriving has no
natural counter-item, so quantity movements are posted by
`commitStagedQuantityMovement` without the balance check. They are
still ordinary `journal`/`journal_line` rows, with the same audit
trail. (Open Question 1, below, asks whether this still holds.)

**2. Orders live under `Orders`, not under Chart of Accounts.**
Reports walk only the chart, so nothing posted for an order reaches a
financial statement. Placing an order posts to its own Qty and Value
accounts; fulfilling it posts the opposite. **The order's remaining
balance is the back-order quantity**: there is no status field.

## Quantity movements

`postQuantityMovement` posts a single quantity movement against one
account, creating the account first if it has never been posted to.

`stageQuantityMovementLine` stages one quantity line into
`journal_entry_staging`, the table the money path uses too, so a
two-sided movement (a transfer's two locations) stages both lines under
**one reference** and posts once.

Resolving an account by name: a product descends from `Items`; its
Sales, COGS and Inventory accounts never do. When a name resolves to
more than one entity, the one under `Items` is the product. That
fallback is only for callers without the account id: the accounts under
an item or a location (On Order, Units Sold, the storage leaves) have
names that repeat, so callers pass their id.

`postStagedQuantityMovement` posts every line staged under a
reference through `commitStagedQuantityMovement` (*The Journal API*,
"The three posting paths").

Tests (*Testing: Unit*, "Running the tests"):
- "quantity movements carry a real, queryable location — receive, dispatch, and transfer (both legs) each record where it actually happened, not just updating the current-state snapshot" (`backend/test/db.test.ts`)
- "true double-entry quantity tracking: a real "on order" account for receipts and a real "units sold" account for dispatches — the genuine counteritem, not derived arithmetic, per direct confirmation" (`backend/test/db.test.ts`)

## Locations

`Location.timezone` is a real IANA identifier, never a fixed UTC
offset.

**Location types are Vocabulary words**, added with
`createLocationType`, like `listAddressTypes`/`ensureAddressType`: the
children of a "Location Types" container, so a new type is listed
before anything has it.

**`setLocation`**: a location's data (city, capacities, timezone) is
on `contact`, the table every party's details live on. `location_type`
and `is_billing_address` are relationship records (`Location Type —
{location} → {marker}`), leaving the location's `relation_id` to its
Division link. **One billing address at a time**: setting one removes
every other "Is Billing Address" record first.

**`setLocation`/`getLocation` select the row within the business**
(`resolveBusinessLocationsRootId`, then `parent_id` = that root). A
location's name is unique only within its business, so an unscoped
lookup could find another business's location of the same name. With
no `business`, both take the first row of that name anywhere, so a
caller that knows the business passes it.

**`todayAtLocation`** is today's date at the location, in its own IANA
timezone, not the server's. SQLite has no timezone support
(`datetime()` returns `NULL` for a named zone), so Luxon works it out,
daylight saving included: Sydney and Brisbane are an hour apart in the
southern summer.

Tests (*Testing: Unit*, "Running the tests"):
- "Locations: per-location stock, exactly one billing address, warehouse-direct dispatch for large orders, same-city transfers, and below-reorder reporting" (`backend/test/db.test.ts`)
- "getLocation/setLocation: two real locations sharing the exact same name under two different real businesses stay genuinely distinct" (`backend/test/db.test.ts`)
- "createAndConfigureLocation: real, atomic, balanced Storage Capacity Remaining/Installed accounts, created as part of location creation itself, never a single-sided posting" (`backend/test/db.test.ts`)

## Moving stock and space

Receipt, dispatch and transfer each run in one `db.transaction`, so
their quantity, space and value postings land together or not at all.
A write-off posts its value entry, then its quantity entry, with no
transaction around both:

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
  (source down, destination up), moves space at both locations, and
  moves the value: at first-in-first-out cost between the two
  locations' Inventory accounts, as `REF-VALUE`, when that cost is
  above 0 ("First-in, first-out cost", below); for a combination, the
  value and the count from the source's combination to the
  destination's, at the unit cost.
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

Tests (*Testing: Unit*, "Running the tests"):
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

**`getLocationCapacityStatus`** is a location's total quantity on
hand against its capacity, for information: nothing is refused for
being over it (`docs/TODO.md`). A retail outlet (`bottle_capacity`
set) counts bottles; a warehouse (only `carton_capacity`) counts
cartons, each item's bottles divided by its preferred source's
`package_quantity` (`preferredProviderPackageQuantity`, 12 when it has
none: wine and spirits 12, beer 24). That is the one carton-to-bottle
rate, and it goes one way: an opened carton becomes bottles, bottles
never become a carton again.

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
`setItemLocationLevels` takes the minimum, maximum and reorder levels
by their camelCase names, as the stock listing's inputs send them.

`ensureLocationCapacityAccount` finds a business's locations root with
`resolveBusinessLocationsRootId` rather than by the name `"Locations"`:
the Wine Retail Business's seed data names its root `"Wine Retail
Business Locations"`.

Tests (*Testing: Unit*, "Running the tests"):
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

Tests (*Testing: Unit*, "Running the tests"):
- "createPosTerminal/setTerminalCurrency/getEffectiveSaleCurrency: a real, direct, border-business scenario - two real terminals, one location, two different currencies" (`backend/test/db.test.ts`)

## Stock listing and the movement report

**`getInventoryListing`/`countInventoryListing`** list every item and
location with stock, item then location, a page at a time (`limit`,
`offset`); `countInventoryListing` counts within the session's
business.

**`getInventoryListingByLocation`** is the same, grouped by location,
each tagged with its group in the grouping `hierarchyName` asks for
(`"Division"`, or any other; `group` is `null` when none is asked). It
is not paged: there are few locations. `business` is optional and falls
back to the session's, as for `setItemLocationLevelDetails` above.
`getBelowReorderStock` and `getStockOutRiskReport` are built on it.

**Not yet scoped by business**: `getItemLocation` (levels, shelf
position) and `getLocationCapacityStatus` take no `business`, so two
businesses with an item and a location of the same names could read
each other's figures. This is an open gap.

**`allItemCategories`/`allPreferredProviders`** (private) read every
item's category or preferred vendor in one query each, so a report of
thousands of rows makes no query per row (per row took about 4 seconds
for a month). `allItemCategories` is `getHierarchyAssignments('Category')`
(`db.ts`).

**`getStockMovementReport`** is stock's physical journey (received,
transferred, sold), from the quantity lines on the per-location
quantity accounts (`<item> — <location> — Qty`) in the date range. A
journal with lines at two locations is a transfer, from the one whose
count fell to the one whose count rose; a journal at one location is a
receipt when the quantity is positive and a sale when negative. Rows
carry each item's category and preferred vendor, and, with
`hierarchyName`, each location's group. Sales for the range are read
once, keyed by invoice reference and Sales account (`Sales - X
(Bottle)` is read as `X`).

Tests (*Testing: Unit*, "Running the tests"):
- "getStockMovementReport: the real, physical journey of stock — purchases into a warehouse, a real transfer on to a retail outlet, and a real sale, each correctly enriched with its own real category, division, and vendor" (`backend/test/db.test.ts`)
- "getInventoryListing/countInventoryListing: a real, paginated listing of every item/location combination with stock" (`backend/test/db.test.ts`)
- "getInventoryListingByLocation: groups the same real stock data by real location, tagging each with its real group where one exists" (`backend/test/db.test.ts`)
- "stock-listing-by-division" (`shared-fixtures/tests/stock-listing-by-division.csv`)
- "stock-listing-over-capacity" (`shared-fixtures/tests/stock-listing-over-capacity.csv`)
- "stock-movement-by-grouping" (`shared-fixtures/tests/stock-movement-by-grouping.csv`)

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

Tests (*Testing: Unit*, "Running the tests"):
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

Tests (*Testing: Unit*, "Running the tests"):
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

Tests (*Testing: Unit*, "Running the tests"):
- "a item can be sourced from multiple manufacturer/vendor combinations, and preference is never derived from price" (`backend/test/db.test.ts`)
- "addOrUpdateItemSource/getItemPriceForCurrency: a real, direct, dual-currency pricing scenario - one real product, two real, independently-set prices" (`backend/test/db.test.ts`)
- "getItemPriceForCurrency: a real, combination-specific price wins over the base item price, per direct instruction (a cold beer costs more than a warm one)" (`backend/test/db.test.ts`)
- "purchase-order-known-suppliers" (`shared-fixtures/tests/purchase-order-known-suppliers.csv`)

## Reorder, lead times, and stock-out risk

**`getBelowReorderStock`** lists every item and location at or below
its reorder level: time to order. The *min* level is lower: below it,
something has already gone wrong.

**`setItemSourceLeadTime`/`getItemLeadTimes`** hold a lead time in
days for one item from one vendor, as a link entity named `{item} —
Lead Time: {vendor} (14 days)`.

**`getStockOutRiskReport`**: will the item run out before an order
placed today could arrive? Recent consumption, over a short trailing
window, against the shortest lead time among the item's vendors.

Tests (*Testing: Unit*, "Running the tests"):
- "setItemSourceLeadTime/getItemLeadTimes/getStockOutRiskReport: will this genuinely run out before a fresh order could arrive?" (`backend/test/db.test.ts`)
- "restock-retail-outlet" (`shared-fixtures/tests/restock-retail-outlet.csv`)

## Stock takes

**`createStockTake`** creates a sheet for one location: a line per item
on record there, with its expected quantity and
`shelf_side`/`rack`/`level`, in the order someone walks the floor. A
take is a "Stock Take" entity under the location; each line is a child
whose `relation_id` is the item, and `counted` starts empty. `business`
is optional, as for `getInventoryListingByLocation`, which it calls.

**`recordStockTakeCount(take, item, counted)`** records one line's
count on a draft take, by renaming the line to `… counted:{n}`. A
completed take, a negative count or an item not on the sheet is
refused.

**`completeStockTake`** posts each counted line's variance as a loss or
a gain, and moves the item's per-location quantity to what was counted
(against **Count Adjustment**, the space with
`adjustLocationCapacity`), then renames the take from `— draft` to `—
completed`. A shortage debits the variance expense and credits the
location's Inventory account; an overage is the reverse. Lines never
counted are left alone. A counted line needs a unit cost in
`unitCostMinorByItem`, or the take is refused. The `inventoryAccount`
parameter is unused.

Each item's variance has its own reference: `stageLine` upserts on
`(reference, account)`, so items sharing a variance account under one
reference would collapse into one line.

Tests (*Testing: Unit*, "Running the tests"):
- "stock take sheets: ordered by shelf_side/rack (alphabetically, as free text) then level numerically (top to bottom), and completing posts genuine loss/gain variance while leaving uncounted lines untouched" (`backend/test/db.test.ts`)
- "completeStockTake: multiple real, different products sharing the same variance expense account in one real stock take must all post, keeping debit == credit" (`backend/test/db.test.ts`)
- "completeStockTake and writeOffItems: the real quantity-movement journal entry itself must be balanced (debit == credit), not just the dollar-value side" (`backend/test/db.test.ts`)
- "createStockTake resolves an item by its real, scoped item identity, never a same-named entity of a different kind elsewhere in the tree" (`backend/test/db.test.ts`)

## Lots

**`receiveLot`** records a batch of an item arriving, with its
expiration date. How much is on hand is still the quantity accounts';
lots say which batches, expiring when. A lot is a child of the item,
its `quantity_on_hand` and `cost_basis_minor` in its `detail_json`.

**`consumeFromLots`** draws from the lots that expire first (this is
separate from the first-in, first-out cost above), refuses more than
all the lots hold, and returns what it drew from each. Lots with no
expiration date go in the order they were made (`id`).

**`getExpiringStock`** returns lots expiring within a window or
already expired (negative `days_until_expiration`). Lots with no
expiration date are never included.

Tests (*Testing: Unit*, "Running the tests"):
- "lot/expiration tracking: consumption is genuinely FIFO by expiration date, not receipt order, and the expiring-stock report only shows what actually still has quantity" (`backend/test/db.test.ts`)

## Orders

**`createSystemEntity`** makes an entity for internal bookkeeping (an
order's Qty and Value entities, a bootstrap category) without the
`entity_entry` audit trail, as these are created once and never edited.

**`placeOrder`** creates the order's Qty and Value entities under
`Orders`, named for the order, and posts the committed quantity and
value to them. **No real account is touched.** Qty's relation is the
vendor and Value's the item; where it is to be delivered is the
Location dimension on the Qty leaf.

**`fulfillOrder`** takes exactly what was fulfilled off the order's Qty
and Value balances: **what remains is the back order**. Its references
include the `fulfillingReference` (the receipt or dispatch), so an
order fulfilled by several receipts gets a reference for each.

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
