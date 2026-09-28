# The Stock API — `backend/src/db-stock.ts`

This chapter is the single, complete source of explanation for `backend/src/db-stock.ts`.
Every comment that used to live in that file has been moved here; the file itself carries
only a pointer back to this chapter. It follows the pattern of
`docs/journal-api-reference.md`: one section per function, in file order, recording *why*
each thing is the way it is, including bugs that shaped it.

The seven functions that move stock and space — `ensureLocationCapacityAccount`,
`adjustLocationCapacity`, `ensureUnitsTrackingBaseAccounts`, `receiveStockAtLocation`,
`dispatchStockFromLocation`, `transferStock`, `writeOffStock` — are documented, with their
tests, in `docs/storage-space-as-currency-design.md`, "Code and tests: where to look".
They are not repeated here.

Where this chapter records a problem it has not resolved, it says so under "Open
questions" at the end, rather than picking a side.

## Two design decisions the whole file rests on

**1. Quantity and monetary value are two independent facts, not a debit/credit pair of
each other.** Money is naturally double-entry: it always has a from and a to. A physical
unit arriving was originally thought to have no such natural counteritem in the books. So
monetary movements keep using the existing balanced staging and posting mechanism
unchanged, while quantity movements use a separate, simpler counter update (the
`post_quantity_movement` trigger): still an ordinary `journal` / `journal_line` row, so
there is a full audit trail, but never forced through a zero-sum check that only makes sense
for money. *(This decision has been overtaken in part by the movement functions; see Open
question 1.)*

**2. Orders live under `Orders`, not under Chart of Accounts.** Reports only ever walk the
real chart, so nothing posted for an order can leak into a real financial statement.
Placing an order posts to that order's own Qty and Value accounts; fulfilling it posts the
opposite. **The order's remaining balance *is* the back-order quantity.** There is no
separate status field anywhere, in the same way a bank balance is just a number and not a
number plus a flag saying how much money it is.

## Quantity movements: `stageQuantityMovementLine`, `postStagedQuantityMovement`, `postQuantityMovement`

`postQuantityMovement` posts a single quantity movement against one account, creating the
account first if it has never been posted to, the same guarantee ordinary posting and
recurring journals give. (Its own doc comment had been detached and left above
`stageQuantityMovementLine`.)

`stageQuantityMovementLine` stages one quantity-movement line into the same
`journal_entry_staging` table the ordinary financial path uses. It is exposed separately from
`postQuantityMovement`, which stages and posts one line in a single call for the common
single-location case, so that a genuinely two-sided movement, a transfer between two
locations, can stage both lines under **one shared reference** and post once as one true,
balanced entry, instead of two postings that merely happen to net to zero.

Resolving an account by name follows one rule. A product entity always, structurally,
descends from `Items`; its own Sales, COGS and Inventory accounts never do (they live under
Sales Revenue, Cost of Goods Sold and Inventory). When one name resolves to more than one
entity (scoped uniqueness allows this), prefer the one whose ancestor chain reaches `Items`:
that is the reliable, structural way to tell the product itself from its same-named
financial accounts, and it does not depend on an `item` table row that not every entity under
Items is guaranteed to have yet. **This name-based fallback is used only when the caller does
not already know the exact account id.** Every account scoped under a specific item or
location (On Order, Units Sold and the storage-capacity leaves) has a simple,
non-globally-unique name, so passing the id explicitly is what keeps posting correct.

`postStagedQuantityMovement` posts every line staged under a reference through the parallel
`post_quantity_movement` trigger, not a direct write. The explanation of why quantity needs
its own path rather than reusing `post_journal_entry` is in the schema, above that trigger.

## Locations: `Location`, `getLocationTypes`, `createLocationType`, `setLocation`, `getLocation`, `todayAtLocation`

**Timezone.** A location's `timezone` is a real IANA identifier, never a fixed UTC offset;
the schema's own comment on `location.timezone` explains why.

**Location types are Vocabulary words**, user-extensible through `createLocationType`, never
a fixed, built-in list. Every "type" a person sees must be user-extensible and translatable.
`createLocationType` adds one (for example "Retail" or "Warehouse", or any kind a business
needs). *A confirmed bug shaped it:* it used to derive the list of types from whichever
entities already had a "Location Type → X" link, a chicken-and-egg problem, since a
brand-new type by definition has no location using it yet and so could never appear until it
was assigned somewhere. It now uses the same proven pattern as `listAddressTypes` /
`ensureAddressType`: a dedicated "Location Types" container entity, listing its own direct
children.

**`setLocation`.** A location's plain data (city, shelving and floor-area capacity, timezone)
is ordinary per-entity data, stored on `contact`, the general-purpose table every party's
details already live on, not on a dedicated location table. `location_type` and
`is_billing_address` are "kind" tags, recorded as a named relationship record
(`Location Type — {location} → {marker}`) found by its predictable name, exactly matching
`setDivisionType`'s proven mechanism. This deliberately never touches the location's own
`relation_id` slot, which is already used by its "Belongs To Division" link (an entity has
only one). The marker is any Vocabulary word. **Exactly one billing address at a time:**
setting a new one removes every other "Is Billing Address" record first.

**`todayAtLocation`** returns the correct calendar day *right now at a specific location*,
using that location's own IANA timezone, never the server's. SQLite has no working timezone
support: no ICU extension is compiled in, so `datetime()` and `strftime()` silently return
`NULL` for a named zone such as `Australia/Brisbane`, and only ever understand a fixed
numeric offset, which cannot represent a region that observes daylight saving. Luxon, backed
by Node's complete IANA data through `Intl`, does this correctly, including seasonal
transitions. Confirmed directly: Sydney and Brisbane, sharing a long border, are an hour
apart every southern-hemisphere summer, since New South Wales observes daylight saving and
Queensland never does. It is necessary for a correct audit trail and so as not to confuse a
sales clerk: a sale at 11:45pm local time must never be recorded against the following day
because the server runs in a different zone, or because UTC has rolled over while the
clerk's own clock has not.

## Item-location levels and capacity status

`getItemLocation` and `setItemLocationLevelDetails` carried no explanatory comments; their
signatures are the only record of what they do.

**`getLocationCapacityStatus`** returns a location's current total quantity on hand, checked
against its configured capacity. Capacity was found to be purely informational and never
checked anywhere (`docs/TODO.md`); this makes it a real, **non-blocking** status a caller can
surface as a warning. The carton-equivalent quantity is computed per product using each
product's own preferred-vendor `package_quantity`, not a flat bottles-per-carton figure, since
that genuinely varies (wine and spirits at 12, beer at 24).

**`preferredVendorPackageQuantity`** (private) supplies that conversion. Per
`no-new-tables`, there is no exchange-rate table: the existing `item_source.package_quantity`
field *is* the carton-to-bottles rate. It is one-directional (a carton broken open becomes
bottles; bottles are never reassembled), matching `docs/cold-shelf-storage-inventory-model-plan.md`.
A retail outlet, with `bottle_capacity` set, tracks in bottles; a warehouse, with only
`carton_capacity`, tracks in carton-equivalents using the specific item's own factor.

## POS terminals: `createPosTerminal`, `listPosTerminals`, `setTerminalCurrency`, `getEffectiveSaleCurrency`

Per `docs/border-multicurrency-pos-plan.md`, Slice 2: two terminals at one shared location can
each transact in their own currency (a border business with one till in CAD and one in USD).
Per `no-new-tables`, a terminal's currency reuses the `account.currency` column and
`setAccountCurrency`, the same way any account's currency is set, not a bespoke mechanism.

`listPosTerminals` returns every terminal created at a location, each with its resolved
currency; `null` means it transacts in the business's home currency, the ordinary case. **A
location with no terminal ever created returns an empty array, never a guessed default.**

`getEffectiveSaleCurrency` extends the currency precedence chain documented in
`docs/multicurrency-design.md` (Division → Business → Account → Contact) by one level: **a
terminal's own currency, when set, wins over all of them**, because it is the most specific
fact about where the sale physically happened.

## Stock listing and the movement report

**`getStockListing` / `countStockListing`** list every item and location combination that has,
or has ever had, stock tracked: the "what do we have, where" listing this project had no page
for. Ordered by item then location for a stable read, and paginated (`limit`, `offset`) like
every other list in the application, not dumped as one unbounded page. Each row carries the
division matching the location's own city, using `cityDivisionFor` rather than a separate
lookup so it always agrees with how a real sale is tagged, and the location's capacity status,
so the page that shows stock can also show whether a location is over its configured capacity.

**`getStockListingByLocation`** is the same data grouped by location and by each location's
division, for a report wanting detail per location or division. **It is deliberately not
paginated:** a grouped view is read a location at a time, not row by row, and the number of
locations for one business stays small even as its catalogue grows.

**`allItemCategories` and `allPreferredVendors`** (private) each fetch every item's category or
preferred vendor (or first vendor on file) in **one query**, to avoid a query per row on a
report that can have thousands. *Measured:* the naive per-row version took nearly 4 seconds to
load one month of Wine Retail Company data, too slow for a report page.

**`getStockMovementReport`** reports the physical journey of stock: purchases received into
each warehouse or location, transfers on to retail outlets, and sales, each groupable by the
internal hierarchy (division or location) as well as by vendor and category. It is built from
the same `journal_line.location_id` that the receive, dispatch and transfer functions already
populate, **not a separate, parallel log that could drift** out of sync with what happened.
Both legs of every transfer share one journal entry, so they are matched by `journal_id`
directly, not by parsing a reference suffix, which is simpler and more robust. Every Sales
posting for the ledger and date range is fetched once and keyed by (invoice reference, Sales
account name), to avoid a query per sale row for what is usually the largest of the three
sections. A Sales account named `Sales - X (Bottle)` is reduced to `X`, the plain item name a
dispatch's own quantity row already carries: a direct key match, not a linear scan of every
sales posting for every sale row. *Measured:* the naive prefix-scan version still took over 3
seconds even after the category and vendor lookups were batched.

## Reorder, lead times, and stock-out risk

**`getBelowReorderStock`** lists every (item, location) at or below its own reorder level right
now. That is the real trigger for "time to order", and is distinct from the floor *min* level,
which only says something has already gone wrong.

**`setItemSourceLeadTime` / `getItemLeadTimes`** hold a lead time, in days, for one item from
one vendor, with **no new tables or columns**, not even on `item_source`. The number is
encoded directly in a named link-entity, matching the bill-of-materials pattern:
`{item} — Lead Time: {vendor} (14 days)`. `getItemLeadTimes` parses each one back out of its
own link-entity name to list every known lead time for an item across its vendors.

**`getStockOutRiskReport`** answers: will this item genuinely run out before a fresh order,
placed today, could arrive? Recent consumption, over a deliberately short trailing window, is
compared against the **shortest** lead time among the item's known vendors, the fastest a
reorder could arrive. The short window is noisy day to day for something like a keg, and that
noise is kept on purpose: it is the honest answer to "how fast is this going right now", not
something to smooth away.

## Stock takes: `createStockTake`, `getStockTake`, `recordStockTakeCount`, `completeStockTake`

**`createStockTake`** creates a sheet for one location: one line per item currently on record
there, snapshotting the expected quantity and `shelf_side` / `rack` / `level` at that moment,
**ordered the way someone walks the floor** (shelf side, then rack, then top to bottom), not
alphabetically by item. A stock take is a "Stock Take" entity under the location, one per event,
its own name carrying the take date and status directly; never a separate table. Each line is a
child entity under the Stock Take, one per item, with `relation_id` pointing at the item and its
own name carrying shelf side, rack, level, expected and counted. `counted` starts genuinely
empty: never yet counted.

**`completeStockTake`** treats every counted line's variance (counted versus expected) as a
genuine loss or gain, **not a silent correction**. It posts the variance to the ledger and
brings `item_location.quantity_on_hand` into line with what was actually counted. A shortage
debits the variance expense and credits inventory; an overage is the reverse (found more is a
gain: debit inventory, credit the variance account). **Lines never counted are left untouched:
no count means no correction.** Its `inventoryAccount` parameter is deprecated and unused: each
line resolves its own per-product Inventory account, the same fix already applied to Purchases
and Sales/COGS; it is kept so existing callers (the Stock Take screen, the simulation) do not
break.

Two confirmed bugs shaped it:

- **Silent data loss across products.** Each product's variance now uses its own reference,
  not one reference shared by every product in the stock take. `stageLine` upserts on
  (reference, account), which silently collapsed every product's line into the *last* one
  whenever more than one product shared the same variance-expense account in one stock take,
  losing every earlier product's variance entirely. It had never surfaced as an error because
  both sides of the entry collided equally. The per-line reference matches the pattern already
  used for invoice allocation.
- **An unbalanced quantity line.** The quantity side used to stage a single line, the item's own
  quantity account, with no counteritem, unlike every other movement (receipt uses On Order,
  dispatch uses Units Sold, transfer uses the same item at the other location). A stock count
  that finds a real difference is exactly as real an event as those, so it now has its own
  counter-account, **Count Adjustment**.

## Lots: `receiveLot`, `consumeFromLots`, `getExpiringStock`

**`receiveLot`** records a specific batch of an item arriving, with its own expiration date,
separate from but kept in step with the item's overall quantity: `postQuantityMovement` is still
the source of truth for "how much do we have", while lots answer "which batches, expiring when".
A lot is a child entity under the item, one per lot, **never a separate table**. Mutable state
(`quantity_on_hand`, `cost_basis_minor`) lives in that entity's own `detail_json`, updated in
place exactly as the removed table's `UPDATE` statement did.

**`consumeFromLots`** draws from an item's lots **oldest-expiring first**, the FIFO-by-expiration
convention spoilage management needs, not just "reduce the total". It rejects consuming more than
is on hand across all lots combined, rather than silently going negative, and returns which lots
were drawn from and how much, for an audit trail. The `id ASC` tiebreaker matters for lots
sharing a `NULL` expiration: buying and selling a currency needs the same FIFO discipline as wine,
by acquisition order, and a currency lot never expires at all. `entity_id` is monotonic with
creation order, so it means exactly what it always did.

**`getExpiringStock`** returns lots expiring within a window or already expired (shown with a
negative `days_until_expiration`). Lots with no expiration date are never included: there is
nothing to warn about.

## Orders: `createSystemEntity`, `placeOrder`, `fulfillOrder`, `getOrderStatus`

**`createSystemEntity`** is a lightweight entity for internal bookkeeping (an order's own Qty and
Value entities, a bootstrap category). It bypasses the normal `entity_entry` audit-trail machinery
because these are never edited or renamed, only created once. Shared by `placeOrder` and the
one-time migrations in `db-migration.ts`. It reuses `Entity.create` directly, the same allocation
mechanism every other creation path uses, after the `entity_ids` table was eliminated, rather than
keeping a second manual implementation. (Its doc block had been left above `placeOrder`'s.)

**`placeOrder`** creates the order's Qty and Value entities under `Orders` (parented by name so
multiple orders do not collide) and posts the committed quantity and value to them. **It is purely
informational: nothing here touches a real account.** With no new table or column, the order's two
entities use the one relation slot every entity already has: Qty's relation carries the vendor and
Value's carries the item, the same "relation is a separate, lateral tag" mechanism used for COGS and
Chart-of-Accounts prototype tagging. Delivery or dispatch instructions (where a purchase order should
arrive, where a sales order should ship from) use the generic Location *dimension* on the Qty leaf,
since the relation slots are already taken and a dimension is a separate, independent slot. It also
posts the product's own "on order" quantity, credited later at receipt (see
`receiveStockAtLocation`). See Open question 2 about that line.

**`fulfillOrder`** reduces the order's Qty and Value memo balances by exactly what was fulfilled.
**Whatever remains on those accounts afterwards is the back order**, read directly, never stored as a
separate fact. Its references include the `fulfillingReference` (the receipt or dispatch doing the
fulfilling) so they are unique per call. *A found bug:* the old `${orderReference}-FULFILL` naming
assumed exactly one fulfilment per order, but partial fulfilment, a back order closed over several
separate receipts, is explicitly supported, and reusing the same reference on a second partial
fulfilment silently corrupted `journal_line`. See the `journal_reference_unique` index and its
comment for how that surfaced.

**`getOrderStatus`** returns the remaining committed quantity and value on an order: zero means
fully fulfilled; anything else is the open back order.

## Comments that were wrong or damaged, removed at checkpoint 420

Recorded because each was trusted by the next reader.

- **Detached doc blocks**, separated from their function by later insertions: `postQuantityMovement`'s
  sat above `stageQuantityMovementLine`; `getStockListing`'s above the row interface; `placeOrder`'s
  above `createSystemEntity`.
- **An orphan of a replaced function.** The block describing capacity as a double-entry counteritem
  "the same real relationship as Owner's Capital ↔ Cash" was the doc of the *old*
  `ensureLocationCapacityAccount`, left above the POS-terminal functions. It contradicts the current
  design (space moves between `Remaining` and `Occupied`; see D2 in the storage chapter).
- **Stale names:** the account-resolution comment still listed "Storage Capacity Remaining", which is
  now a nested structure.
- **Corrupted words:** "aitem" (twice) and "a item" (several times), damage from a mechanical
  `part` → `item` rename that turned "apart" into "aitem" and broke articles.

## Open questions — recorded, not resolved

1. **Are quantity movements balanced, and is that enforced?** The header comment (Decision 1) and
   `docs/journal-api-reference.md` ("three posting paths") both say a quantity movement is a single
   line against one product's tracking account, with no counteritem. But every movement function now
   gives its lines a counteritem: receipt uses On Order, dispatch uses Units Sold, write-off uses
   Write-off, a stock take uses Count Adjustment, and a transfer uses the same item at the other
   location. Whether the `post_quantity_movement` trigger *enforces* that the lines sum to zero was
   **not checked**. Both descriptions cannot be right.
2. **`placeOrder`'s "on order" line is single-sided.** A removed comment called it correct: "a new
   commitment being recorded, not a transfer between two existing pools, so this one single-sided line
   is correct, since the offsetting credit happens at the real, later moment the stock actually
   arrives." The standing rule is that no posting is ever single-sided. Whether an order is a genuine
   exception to that rule, or needs a counteritem, has not been decided.
3. **Classification.** The stock listing groups by division and the movement report by division and
   category. Those are among the terms the classification-neutrality analysis measures
   (`docs/classification-neutrality-impact.md`).

## Tests

The tests that exercise this file's functions are **not yet documented individually** in this chapter,
apart from the ten in the storage chapter. Listing their titles here without an entry for each would
make `make check-test-docs` count them as documented when they are not, so they are deliberately left
out until each can be documented properly.
