# Currency and Quantity Integrity: a Backend Fix Plan

**Status: Phase 0 complete and verified. Phases 1 through 4 are a plan, not yet built.** This
chapter follows directly from reviewing every journal line of the tutorial e2e test three ways:
as the journal submenu lists them, as the general journal entry form opens them, and grouped by
each line's real currency.

## The model this plan is built on

Every movement is an exchange between two currencies, and the only question that matters is:
**are the two sides of this exchange interchangeable at a fixed, known rate, or not?**

| Exchange | Interchangeable? | The rate |
|---|---|---|
| A dozen of an Item ↔ a single of that Item | **Yes**, exactly like dollars↔cents | the item's `package_quantity` |
| An Item count ↔ its dollar value | **Yes**, at the moment of a sale or purchase | the unit price **is** an exchange rate |
| Carton space ↔ Bottle space | **No** — two genuinely separate currencies | none; the only legal bridge is the physical, one-way act of opening a sealed carton |
| One real currency ↔ another (USD↔AUD) | **No**, except via an explicit, nominated, one-directional rate | `setCurrencyExchangeRate` |

A foreign currency is itself just an Item bought and sold at an exchange rate, realising a gain
or loss — the same shape as buying and selling wine. "Exchange rate" is the one general concept;
a unit price, a pack size, and a currency rate are all instances of it.

**The corrected carton/bottle model (per direct correction):** opening a carton is not a special
operation and does not need `openStorageContainer` to exist as its own mechanism. It is an
`ItemTransfer` — the same movement that relocates any Item — with a defined exchange rate of 12
in the carton→bottle direction and no rate at all in the reverse direction, because reversing it
is not merely undefined, it is physically impossible: an opened carton cannot be resealed with
its 12 bottles back inside. The existing `convertStorageSpace` machinery already refuses an
undefined direction; that refusal is the right behaviour here too, not a function to be replaced
by a special case.

**Locations hold both currencies, not one.** A retail outlet genuinely holds sealed cartons and
loose bottles at the same time. A warehouse usually holds only sealed cartons, except when a
carton has been damaged and partially written off, which puts a few loose bottles into a
warehouse's stock too. A location's storage capacity is therefore two, separate, simultaneous
space currencies — never a single choice between them.

## `openStorageContainer` rebuilt correctly, per direct instruction

Per direct correction: **there is no contra accounting here.** Opening a container is an ordinary
internal stock movement at one location, mirrored on both sides exactly like any other movement
(a receipt, a transfer) — never a special, separate mechanism. The corrected model, stated
directly: each location's `Installed` (set once, a real, user-defined storage size - Carton,
Bottle, Six-pack, Hot, Cold, any size) balances against `Unoccupied` at opening, with `Occupied`
tracked separately; every item movement in, out, or around a location mirrors itself in both the
storage accounts and the item's own real accounts (units and currency) — inventory is always per
location and per business.

Rebuilt `openStorageContainer` to do exactly this, in three parts:
1. **Storage-space accounts** (already fixed above): `Occupied`/`Remaining` only, for both the
   container form and the unit form, at the real, specific location — `Installed` is never
   touched by this or any other movement.
2. **The item's own On Hand quantity**, newly added (the function previously had no `itemName`
   parameter at all, so it could never say which item's quantity was moving): the carton form's
   real count decreases, the bottle form's real count increases, each posted against its own
   contra account (`ensureUnitsTrackingBaseAccounts`'s `onHandId`/`receivedFromId`, the exact
   mechanism `receiveItems` already uses) within its own real currency (`UNITS-CARTON`,
   `UNITS-BOTTLE`) — found necessary directly, by a real balance failure: the two forms' real
   quantities (1 carton, 24 bottles) are genuinely different numbers and can never balance against
   each other directly, only each against its own contra.
3. **The item's own Inventory value**, unchanged in total, only re-tagged: the same real dollars
   move from the carton-tagged Inventory leaf to the bottle-tagged one.

A second, real business rule added: a location with no real bottle shelving (`bottle_capacity`
null) cannot open a carton at all — there is nowhere for the resulting loose bottles to go.

`openStorageContainer`'s signature changed (added `locationName`, `itemName`) — every caller
updated: the HTTP route's schema and the frontend's wrapper and page (`/locations`, a new
item-name field added to its own Open Container form), the Step Runner's registry and
`screens.csv`, the tutorial data file, and the one direct unit test, whose own assertion ("exactly
one journal entry") was itself corrected to match the new, real, multi-sided posting (two entries:
storage-space and the item's own On Hand count, no value entry in that test since it never
registers a real cost).

**Verified, by direct reconciliation**: the tutorial's own Highland Single Malt 700ml now shows
exactly -1 in `Units On Hand > Carton` and +24 in `Units On Hand > Bottle`; Main Street Cellar's
bottle-space accounts remain correctly balanced (68 + 52 = 120) and unaffected by the carton-side
movement; full backend suite 230/230, full frontend suite 24/24, tutorial 19/19 via the API.

## A third, confirmed finding: a location's opening capacity balance can be silently lost — FIXED

Found by direct investigation, continuing the "does it correctly account for storage space"
review: `createAndConfigureLocation` calls `ensureLocationCapacityAccount` immediately, at
location-creation time, per its own, existing, direct-instruction design — "never lazily, the
first time some later, real stock movement happens to touch this location." This is correct
**only if the real capacity is already known at creation time.** The tutorial's own "Set Location
Capacity" step (`docs/realistic-tutorial-e2e-plan.md`, Phase B) was built as a *separate* step
after location creation, passing `bottle_capacity: null, carton_capacity: null` to
`createAndConfigureLocation` itself. This creates the `Remaining`/`Installed`/`Occupied` leaves
immediately, with `opening = 0` (since capacity is still unknown), so no opening entry posts —
correctly, for a capacity of zero. When "Set Location Capacity" later sets the real number (40
cartons, say), the leaves already exist, so the next real call to `ensureLocationCapacityAccount`
(during a receipt or transfer) never re-checks or re-posts the now-known opening balance. The
location's real, physical capacity is silently never recorded; only its *changes* (receipts,
transfers) post correctly from a starting point of zero instead of the real number.

**Fixed**, not by patching the posting logic, but by retiring "Set Location Capacity" as a
separate step entirely and folding its fields into "Create Location" itself — matching both User
Manual Chapter 3's own narrative ("directly on the same screen") and
`createAndConfigureLocation`'s own, pre-existing design intent, which already insists the real
capacity be known atomically at creation specifically to avoid this class of bug.
`shared-fixtures/screens.csv`, `backend/scripts/step-runner.ts`'s registry, and the tutorial data
file were all updated together; the control file's row count was corrected to match the now-19,
not 21, real steps.

**Verified by direct reconciliation, not just that the suites pass:** every journal line touching
`Storage Capacity` was dumped and summed by account. Head Office (Installed −40, Occupied 3,
Remaining 37) and Main Street Cellar (Installed −120, Occupied 44, Remaining 76) both satisfy
`Occupied + Remaining = |Installed|` exactly. Full backend suite 230/230, full frontend suite
24/24, `svelte-check` 0 errors, tutorial 19/19 via the API.

**What this does not fix, deliberately left as is**: the business-root `Storage Capacity` entries
(from "Open Container") are unchanged — `openStorageContainer`'s own location-scoping gap (listed
below, unfixed) is a separate, larger piece of work (its own signature needs a location
parameter), not addressed in this pass.

## Two further findings, from `docs/realistic-tutorial-e2e-plan.md`'s Phase E.5

**6. FIXED. `getStockListing()` had no business-scoping parameter at all**, and aggregated stock
across every business whose items happened to share a name — confirmed directly, the same
bare-name bug class as `getLocation`/`setLocation` below, found in a report function this time.
Renamed to `getInventoryListing`/`getInventoryListingByLocation`/`countInventoryListing`
throughout (backend, frontend, tests), per direct instruction: "Stock" is retired from the code,
"Inventory" is the real, correct word for this collection. Fixed using `Session.Business` (real,
per-session ambient context, per the standing agreement — never an explicit parameter), not a new
parameter — verified safe by confirming `attachUser` middleware already calls
`runInSessionContext` globally, before every route, so every HTTP call already has this context
available.

**7. FIXED. `transferItems` moved quantity and location capacity, but never Inventory dollar
value**, between two locations' own sub-accounts for its plain (non-combination) path — confirmed
by reading its implementation directly. The combination-tagged path already did this correctly;
the plain path, which the tutorial actually uses, had no equivalent at all. Fixed by mirroring
that same, existing logic into the plain path, using the real, existing
`ensureItemLocationInventoryAccount` mechanism `completeCashPurchase` already posts to. Verified
directly against the tutorial's own numbers: Head Office's Inventory dropped by exactly 8400 (24
units × the real $3.50/unit cost) after the transfer, and Main Street Cellar's own Inventory,
COGS, and Sales Revenue accounts all reconciled exactly against the tutorial's own figures. A
separate, real bug in the tutorial's own data was found and fixed along the way: the "Set Item
Cost and Pack Size" step had passed a per-unit price (350) where `getItemUnitCostMinor` expects a
per-package price (it computes `Math.round(price_minor / package_quantity)` itself) — corrected
to 8400 (the real per-carton price), matching the Purchase Order.

`transferItems` itself still takes explicit `business`/`userId` parameters, not
`Session.Business`/`Session.UserId` — deliberately not converted in this pass, given its 89 call
sites across 26 files. The fuller conversion of this and the rest of `db.ts`'s 100+
business/user-taking functions remains the separate, larger, not-yet-done piece of work this
chapter's own "governing decision" section already names.

## What was found, read directly from real journal lines, not assumed

**1. Every quantity movement is genuinely unbalanced per currency.** `stageQuantityMovementLine`'s
own `INSERT` writes no currency at all. An item's own quantity account is therefore left with
whatever currency it last happened to have (often none), while its counteraccount (On Order,
Units Sold, Count Adjustment) is explicitly tagged with a unit currency such as `BOTTLE`. Grouping
a real receipt's journal entry by its real currency column proves it directly: the item's own
account subtotal is unbalanced by the full quantity in one currency, while its counterpart is
unbalanced by the same amount in the other. This is not specific to one test fixture — it is true
of every `receiveItems`, `dispatchItems`, and `writeOffItems` call in the whole codebase, since
they all route through the same, single `stageQuantityMovementLine`. The
`post_quantity_movement_insert` trigger's own comment says so plainly: *"Deliberately NO balance
check here."*

**2. The general journal entry form, and the submenu beneath it, cannot represent a
multi-currency entry at all.** `getJournalEntry`'s `JournalDetail.lines` carries no currency
field, and its `total_debit_minor`/`total_credit_minor` sum every line's raw `amount_minor`
regardless of currency. Opening the "Open Container" entry directly proves this concretely: 24
bottles plus 1 carton were added together into a single total of 25 — a meaningless number, since
the data shape itself has no room for "which currency is this subtotal in."

**3. A fractional amount is posted directly into `amount_minor` whenever a quantity moved is not
an exact multiple of the carton factor.** `adjustLocationCapacity`:
```ts
const capacityDelta = -(itemQuantityDelta / conversionFactor);
```
divides a bottle-count delta by 12 with no rounding, producing values like `0.16666666666666666`.
Per the model above, this is not an arithmetic bug to round — it is an attempt to express a
loose-bottle movement as a quantity of carton-space, which is not a legitimate question to ask of
two non-interchangeable currencies. The division itself is the mistake, not its precision. This
was already present throughout the pre-existing seed data, not introduced by this session's own
testing.

**4. `openStorageContainer` posts to the business root, never to the real, physical location
where the carton was actually opened.** Traced by its full entity path, it posts under
`Businesses > {business} > Storage Capacity`, while a receipt or transfer at a real location posts
under `Businesses > {business} > Locations > {location} > Storage Capacity`. These are two
disconnected trees. A location's own carton count never moves when a carton there is opened; a
separate, business-wide ledger silently absorbs it instead.

**5. A new location can silently attach to an unrelated, pre-existing entity of the same name.**
A location created fresh under one business was found, by tracing its real entity path, attached
to a completely different structure elsewhere in the tree — reached because that name already
existed somewhere else and the lookup resolving it was never scoped to the business creating it.

## Phase 0 — stop the unrelated-entity collision — COMPLETE

This was done first because it is a correctness hazard independent of every currency question
below it, and because every other phase's own tests need locations that are trustworthily scoped
to the business that created them.

**Two real bugs found and fixed in `backend/src/db-stock.ts`, both a genuinely bare
`WHERE name = ?` with no business in the query:**

1. **`getLocation`** — confirmed as the exact mechanism behind the location-collision symptom.
   `createLocation` itself was already correctly scoped; the collision happened the first time
   anything looked the location back up by its bare name alone.
2. **`setLocation`** — a second, deeper, separate bug found in the same investigation, and worse
   since it **writes**: it resolved a location by the same unscoped lookup, so a brand-new
   location's own contact details (city, capacity, timezone) were silently written onto an
   unrelated, pre-existing entity of the same name under a different business, leaving the real,
   new location with no contact row at all.

Both now take an optional `business?: BusinessName` parameter. The fix filters the candidate row
**within the SQL itself**, never as a check applied after an arbitrary first match — a first
attempt at this same fix made exactly that mistake (validating whichever row an unscoped query
happened to return first, rather than selecting the right one to begin with) and was caught by
testing it directly, not by reasoning about it alone.

**Every caller with `business` already in scope was updated to pass it:** `getLocation` in
`ensureLocationCapacityAccount` and `transferItems`; `setLocation` in `postLocation`
(`db-journal.ts`) and `createAndConfigureLocation` (`db.ts`). Two callers were deliberately left
unscoped, recorded honestly rather than silently skipped: `todayAtLocation` and
`getLocationCapacityStatus` have no `business` parameter in their own signatures, and widening
them is a separate, larger change than this phase's own scope; and
`migrateForWineRetailDemoData` (`db-seed.ts`) is a one-shot seed function that runs first, on an
empty database, with nothing yet to collide with, so the same bare lookup there is lower risk,
not yet fixed.

**A further, genuine, independent gap found while fixing the tests that exercise this: two of the
three real businesses used throughout the test suite, "My Business" and "Wine Retail Business,"
had never actually been given their own real `Locations` root at all** — unlike a business
created through `createBusiness` itself, which creates every standard root automatically. Every
test that bare-created a location under either of these two was therefore never testing against
the business it named; it was silently finding whichever business's `Locations` happened to exist
first in the database, and only ever "worked" by that accident. Fixed properly, using only the
established `create()`/`requireEntity()` pair, exactly as `createLocation` itself already uses —
**not** the test-only `createEntityRaw` helper, which was tried first and corrected directly per
explicit instruction not to reach for a secondary helper function when the standard ones already
exist: 58 occurrences of the bare lookup in `backend/test/db.test.ts` were rewritten to a small,
local `myBusinessLocationsRoot()` helper that creates "My Business"'s own `Locations` root once,
lazily, the first time any test genuinely needs it; "Wine Retail Business"'s own missing root was
fixed the same way, inline, in the one test that needed it
(`transferItems: a real, combination-tagged transfer...`), which also needed its own two
locations created properly rather than relying on an accidental match to an entirely unrelated
structure.

**The tutorial's own business was renamed** from "Wine Retail Business II" to
**"Tutorial Wine Retail Business"**, in `shared-fixtures/tutorial-steps.csv`, per direct
instruction.

**A direct, new proof test was added**, not merely the fix: two businesses, two locations sharing
the exact same name, each set with different, real, distinguishing details, and each business's
own `getLocation` call confirmed to see only its own location, never the other's.

**Verified, all together, not separately:** the tutorial e2e fixture passes all 10 steps via the
API; the full backend suite passes 230 of 230 (229 existing plus this phase's own new test); the
full frontend suite passes 24 of 24; `make check-backend-types` shows no new errors beyond the 6
already-known, pre-existing ones.

## The remaining plan, in the order it must be done

### Phase 1 — give quantity movements a real, enforced currency

1. Decide the currency naming convention for an item's own plain (non-combination) quantity
   account — most likely the item's own base unit, matching what its counteraccounts already use.
2. Tag the item's own quantity account with that currency wherever it is first created
   (`ensureItemQuantityAccounts`'s own account-creation step).
3. Decide whether `post_quantity_movement_insert` should be extended to **enforce** a per-currency
   zero sum, or whether it stays permissive by design for legitimate single-sided cases, with
   correctness proven by test instead.
4. A migration for data already posted incorrectly is a separate, later decision, not bundled
   into this phase.

### Phase 2 — make reports and forms currency-aware

1. Extend `JournalDetail.lines` with each line's own real currency, and change the totals into a
   per-currency structure, never a single summed number across currencies.
2. Update the general journal entry form to group its lines by currency and show one,
   separately-balanced subtotal per currency.
3. Update the submenu similarly.
4. Audit the trial balance and the stock report for the same flat-sum assumption.

### Phase 3 — correct the carton/bottle model itself

1. Retire `openStorageContainer` as a separate mechanism. Model opening a carton as an
   `ItemTransfer` using the existing one-directional exchange-rate mechanism: a rate of 12 defined
   carton→bottle, no rate defined bottle→carton.
2. Let a location hold both a Bottle-space account and a Carton-space account simultaneously.
3. Fix `adjustLocationCapacity` so it never divides a count across two non-interchangeable
   currencies.
4. Fix the location scoping of the carton-opening operation, so it adjusts the real location's own
   capacity, not a disconnected, business-wide figure.

### Phase 4 — verify end to end

Re-run the full tutorial fixture, dump every journal line by currency, and confirm every single
currency group balances to zero with no fractional minor-unit amounts anywhere. Then re-run the
Wine Retail simulation and compare against its golden output — this phase is very likely to
change the simulation's actual numbers, which is expected, not a regression to chase back to zero.

## Decisions needed before Phase 1 can start

1. What is the correct unit currency for a plain item quantity account?
2. Should the quantity-movement trigger enforce balance going forward, or stay permissive with
   correctness proven by test instead?
3. Is correcting already-posted history in scope now, or a deliberately separate, later task?
4. Does a location's dual Bottle/Carton capacity need a schema change, or can it be expressed with
   the existing entity-tree mechanism, as `Storage Capacity`'s own `Remaining`/`Installed`/
   `Occupied` leaves already are?

## What this plan has not verified

Whether any other quantity-movement caller beyond `receiveItems`, `dispatchItems`, and
`writeOffItems` exists and shares the same bug; whether the trial balance and stock report have
exactly one flat-sum assumption each or several, independently; and how many already-posted
journal entries in any existing checkpoint's own data are affected, since no count has been
taken.
