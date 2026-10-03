# A Realistic Tutorial e2e Test: the Full Plan

**Status: Phases A, B, and C are built and verified. Phase D is deliberately deferred, per direct
instruction ("worry about simulate-wine-retail-monthly later"). Phase E's core check (a per-currency
journal review) is done; the rest of Phase E is not.**

**What was built:** every field and screen type listed in Phases A and B below, in
`shared-fixtures/screens.csv` and `backend/scripts/step-runner.ts`'s `API_REGISTRY`; the full,
21-step data file (`shared-fixtures/tutorial-steps.csv`) matching Chapter 3's own scenario, using
real `#`-comment lines per step (a new, real capability — see `docs/skill-step-runner-design.md`
§2a, §8.1 — not merely an assumed convention); and the multicurrency section (step 17) was
deliberately left out of this pass, since it depends on `multicurrency-design.md`'s own,
separately-confirmed build status, per decision 4 below.

**Verified, directly, not assumed:** `--lint` passes (21 real steps, no problems); the full data
file runs via `--path api`, all 21 steps passing; the full backend (230/230) and frontend (24/24)
suites still pass; every journal line the run produced was dumped and grouped by currency — zero
fractional `amount_minor` lines, and the Cash and Bank balance landed at exactly 468400 (AUD cents),
matching Chapter 3's own numbers by direct arithmetic: 500000 (opening capital) − 33600 (4 cartons ×
8400) + 1000 (two sales × 2 bottles × 500) = 468400. The per-currency imbalances the review also
found are not new: they are exactly `docs/currency-and-quantity-integrity-fix-plan.md`'s own,
already-documented Phase 1 gap (an item's own quantity account carries no currency, unlike its
counteraccount), now visible at a realistic scale rather than fixed here, since that fix belongs to
the other plan, not this one.

**Not done:** Phase D (retiring `simulate-wine-retail-month.ts`, the tutorial's own bespoke
Playwright script, and demo-seeding) — deferred by direct instruction; `--path ui` has not been run
against the new data file; the multicurrency section (step 17); and the Trial Balance / Stock on
Hand / Profit & Loss report comparison named in Phase E.5 below.

--- It exists because of a direct, confirmed failure,
recorded in `docs/skill-manual-as-source-of-truth.md` ("a second, more severe occurrence") and
`docs/skill-step-runner-design.md` ("honest, real, current status"): the tutorial fixture built
and rebuilt across a long session was never checked against the one, authoritative, already-written
scenario that already existed — User Manual Chapter 3, "Building a Real Wine Retail Business, Start
to Finish." This plan is that check, made explicit, plus what closing the gap actually requires.

## The governing decision, already made, not re-litigated here

The Step Runner chapter states, as its own opening line, "per direct instruction": it is "the one
and only real testing and data-loading tool for this application — replacing the tutorial e2e's own,
bespoke Playwright script, the wine-retail simulation script, and demo-seeding." This plan treats
that as settled. It does not propose keeping `backend/scripts/simulate-wine-retail-month.ts`, the
tutorial's own bespoke Playwright script, or demo-seeding as parallel, permanent mechanisms —
it proposes retiring all three into Step Runner data files, which is what was already decided and
not yet done.

## Chapter 3, as the specification, walked step by step

Each row below is one step of Chapter 3. "Screen type" names the existing `screens.csv` entry it
would use, or **NEW** where none exists yet. "Fields present / missing" compares Chapter 3's own
narrative against that screen's current, real field list in `shared-fixtures/screens.csv`.

| # | Chapter 3 step | Screen type | Fields present | Fields missing |
|---|---|---|---|---|
| 1 | Login | Login | username, password | — |
| 2 | Choose business | Select Business | businessName | — |
| 3 | Create the business | Create Business | businessName, financialYearLabel, businessType | **home currency**, CoA-prototype choice (country/jurisdiction match) |
| 4 | Switch session | Switch Session | businessName | — |
| 5 | Create the first location | Create Location | businessName, locationName, city, locationType | — |
| 6 | Set that location's shelf/carton capacity | **NEW**: Set Location Capacity | — | locationName, bottleCapacity, cartonCapacity |
| 6a | *(optional)* a second typed address for the location | **NEW**: Add Typed Address | — | entityName, addressType, address fields |
| 7 | Business Setup: first Division | **NEW**: Create Division | — | businessName, divisionName |
| 7a | Business Setup: Warehouse within that Division | Create Location (extended) | businessName, locationName, city, locationType | **division** |
| 7b | Business Setup: first Employee | **NEW**: Create Employee | — | businessName, employeeName, locationName |
| 8 | Items Catalog: category + item, with cost and price | Create Item | businessName, itemName, category, newCategoryName | **cost**, **sellingPrice**, package_quantity (units/carton), unit of measure |
| 9 | Owner's opening capital, via General Journal | **NEW**: Post Journal Entry | — | businessName, ledger, debitAccount, creditAccount, amount, currency |
| 10 | Create the first supplier (Vendor/Provider) | **NEW**: Create Provider | — | businessName, providerName |
| 11 | Purchase Order: 4 cartons at $84.00/carton | **NEW**: Create Purchase Order | — | businessName, providerName, itemName, cartons, pricePerCarton |
| 12 | Place the order | (part of 11, or a separate **NEW**: Place Order) | — | — |
| 13 | Cash Purchase: receive at warehouse, pay in full | **NEW**: Cash Purchase | — | businessName, locationName, itemName, cartons, totalCost |
| 14 | Stock Transfer: 24 bottles warehouse → retail | **NEW**: Transfer Items | — | businessName, itemName, fromLocationName, toLocationName, quantity |
| 15 | POS Sale at retail, run more than once | **NEW**: POS Sale | — | businessName, locationName, itemName, quantity, unitPrice |
| 16 | Review reports | (no screen; a `verify` check against each report) | — | — |
| 17 | *(separate, "design stated ahead of the mechanism")* a further location trading in USD | Create Location (extended) + **NEW**: Nominate Location Currency, **NEW**: Create POS Terminal | — | currency nomination, terminal currency |

**Count: of 17 real steps (18 counting 7a/7b/12 as their own rows), 6 already have a working screen
type, 3 of those 6 are missing required fields, and 11 have no screen type at all.** This is not a
small, incremental gap — closing it is most of the remaining work.

## Two numbers Chapter 3 itself never states

1. **The owner's opening capital amount** (step 9). Chapter 3 shows the journal entry's shape
   (DR Cash/Bank, CR Owner's Equity) but never states a figure.
2. **The quantity sold per POS sale** (step 15, "run more than once"). Needs a decision before the
   fixture can give it a concrete value.

Both need a decision before the fixture can be written, not an assumption.

## The work, in order

### Phase A — extend existing screens with their missing fields

1. **Create Business**: add `homeCurrency` (and, if the real form requires it, a CoA-prototype
   selection field).
2. **Create Location**: add `division` (optional — blank for a location created before any division
   exists, named once one does).
3. **Create Item**: add `cost`, `sellingPrice`.
4. **Open Container**: add `locationName` — its complete absence is a separate, already-recorded
   defect (`docs/currency-and-quantity-integrity-fix-plan.md`), not just a tutorial gap: without it,
   the operation cannot say which location's carton it is opening at all.

Each addition means a new `position`/`field_name` row in `screens.csv` for that `screen_name`, and
the corresponding `API_REGISTRY` function accepting and using the new argument.

### Phase B — the new screen types

In the order Chapter 3 needs them:

1. **Set Location Capacity** — sets `bottle_capacity`/`carton_capacity` on an existing location.
2. **Create Division** — creates a Division (a reporting grouping, per Chapter 3's own description:
   "a real profit or cost center").
3. **Create Employee** — creates an employee at a given location.
4. **Post Journal Entry** — a direct, general-ledger posting (debit account, credit account, amount,
   currency) — the one, real, free-form entry point every manual transaction in the app is described
   as using.
5. **Create Provider** — per the settled vocabulary (`docs/naming-vocabulary.md`): the code-level
   function is `createProvider`; the screen and its own translatable label stay whatever the
   business owner's Vocabulary word is (Vendor, Supplier, Provider, Purveyor).
6. **Create Purchase Order**, and **Place Order** if kept separate — in whole cartons, per Chapter
   3's own "an important, real detail, easy to get wrong."
7. **Cash Purchase** — receives an order at a location, converts cartons to the item's own base
   unit, pays in full immediately.
8. **Transfer Items** — moves a quantity of an item between two named locations.
9. **POS Sale** — a retail sale at a stated location, item, quantity, and unit price.
10. **Nominate Location Currency** and **Create POS Terminal** — for the Chapter 3 section
    explicitly marked "design stated here, ahead of the mechanism it describes." Build only once
    that underlying mechanism itself is confirmed built (the Programmer's Manual's own
    `multicurrency-design.md` is the next manual to check before starting this one, per
    `manual-as-source-of-truth` — not re-derived from scratch here).

Each new screen type needs: a `screens.csv` entry (or entries, one row per field), a matching
`API_REGISTRY` function in `step-runner.ts` calling the real, existing backend function, and at
least one direct unit test in `step-runner.test.ts` proving the registry entry calls the right
function with the right arguments — per the Step Runner's own, already-documented testing plan
(section 7), not skipped because the surrounding screens were.

### Phase C — the fixture itself

Once Phase A and B exist, rewrite `tutorial-steps.csv` to express Chapter 3's full scenario, one
row per step, in the order above, using real `#`-prefixed comment lines (now an assumed, standing
convention for this project, per direct instruction) explaining each row's own accounting or
entity-creation intent — the same discipline already attempted by hand mid-session, now done against
a fixture that can actually carry the steps it describes.

### Phase D — retire the three superseded mechanisms

1. **`backend/scripts/simulate-wine-retail-month.ts`**: converted into one or more Step Runner data
   files covering its own scenario (several locations, many items, a month of receipts, sales,
   transfers, and write-offs at volume) — not deleted outright until its coverage is confirmed
   replaced, per the same testing-plan discipline.
2. **The tutorial's own bespoke Playwright script** (if a separate one still exists outside the Step
   Runner's own `--path ui`): confirmed superseded by the Step Runner's UI path, then removed.
3. **Demo-seeding**: converted into its own Step Runner data file(s), loaded the same way any other
   fixture is.

### Phase E — verify end to end

1. `--lint` the new fixture.
2. Run it via `--path api`, confirm every step passes.
3. Run it via `--path ui`, confirm every step passes (the Step Runner's own stated purpose: the
   same steps, either path, so the two can never silently drift apart).
4. Dump every journal line the fixture produces, grouped by currency, confirming every group
   balances to zero with no fractional minor-unit amounts — the same review discipline already
   applied by hand to the smaller, six-step version of this fixture, now applied to the complete
   scenario.
5. Compare the resulting Trial Balance, Stock on Hand, and Profit & Loss figures against Chapter
   3's own stated numbers ($3.50/bottle cost, $5.00/bottle sell, 96 bottles received, 24
   transferred, 72 remaining at the warehouse) to confirm the fixture reproduces the manual's own
   worked example, not just a plausible-looking one.

## Decisions needed before Phase A can start

1. The owner's opening capital amount (not stated in Chapter 3).
2. The quantity sold per POS sale (not stated in Chapter 3; "run more than once" needs a number).
3. Whether "Create Purchase Order" and "Place Order" are one screen/step or two.
4. Whether the multicurrency section (step 17) is in scope for this pass, or deferred until
   `multicurrency-design.md`'s own build status is separately confirmed.
5. Whether `simulate-wine-retail-month.ts`'s retirement (Phase D.1) happens in the same pass as
   building the new fixture, or as a separate, later piece of work.

## What this plan has not verified

Whether every backend function Phase B's new screens would call already exists and needs no change
of its own (createProvider, a Purchase Order function, a Cash Purchase function, and Transfer Items
were referenced earlier this session; a direct Post Journal Entry function suitable for a generic
screen has not been confirmed); the exact shape `multicurrency-design.md` specifies for step 17; and
how large the converted `simulate-wine-retail-month.ts` fixture would be once expressed as Step
Runner rows, since no count has been taken.
