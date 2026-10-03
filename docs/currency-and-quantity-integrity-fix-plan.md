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
