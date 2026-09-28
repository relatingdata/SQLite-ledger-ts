# Assemblies, Production and Cross-Border Stock: a Design Proposal

**Status: proposal. Nothing here is built.** Each real choice lists options and a
recommendation, and the decisions that need an answer are collected at the end. It follows
`docs/business-generality-scenario.md`, which sets out the litmus scenario and the
requirements this answers.

## 1. Requirements

1. **Assemblies nest.** An assembly can be a component of another: kits plus labour make
   an assembled product. The bill of materials (BOM) is recursive.
2. **Produce, then hold.** Kits and assembled products are produced into inventory at a
   location, held, then sold and dispatched. Assembling at the moment of sale may also be
   wanted, per item, but is not the requirement.
3. **Labour is part of what an assembly costs.** Hired staff do the assembling.
4. **Factories and warehouses are genuine locations**, possibly in other countries from the
   headquarters, and stock must be able to move between them.
5. **No special cases for any one kind of business.** The kit retailer and the wine shop use
   the same code; what differs is configuration.

## 2. What exists (verified by reading the code)

| Area | What is there |
|---|---|
| BOM definition | `stageBomComponent`, `postBomComponents`, `deleteBomComponent`, `getBomComponents` (`backend/src/db.ts`), the staging table `assembly_bom_staging`, and a screen. |
| BOM storage | One link entity per component, under the assembly item, named `{assembly} — BOM: {component} ({quantity}{unit})`, with `relation_id` pointing at the component. The quantity lives in the **name**. |
| Consuming or producing | **Nothing.** No function consumes components or produces an assembled item. |
| Unit cost | `getProductUnitCostMinor`: the preferred supplier's `price_minor` divided by that supplier's `package_quantity`; `null` if there is no supplier. |
| Cost layers | Lots carry a `cost_basis_minor` (in `detail_json`); `consumeFromLots` draws oldest-expiring first. **Not verified:** whether `consumeFromLots` returns the cost it consumed. |
| Staff | Employees, schedules, shifts, `payEmployeeWages`, and time clocked against a project. |
| Currency | A location can nominate currencies (`getLocationCurrencies`, `nominateLocationCurrency`); a location has its own timezone and `todayAtLocation`. |
| Moving stock | `transferStock`, instantaneous, one posting. |

## 3. Findings that shape the design

**3.1 Recursion is representable, but unguarded.** A component link can point at any item, so
an assembly can already be a component of another. Nothing prevents a cycle (`A` contains `B`
contains `A`) or an assembly containing itself: `stageBomComponent` and `postBomComponents`
do no such check. Producing a cyclic assembly would never terminate.

**3.2 Quantity in the name is fragile.** *Suspected, not proven by running it:* removing or
updating component `Motor` matches link names with
`LIKE '{assembly} — BOM: Motor (%'`, and the link for a component called `Motor (2200KV)`
also starts with exactly that text, so one could be deleted when the other is meant. `_` and
`%` in a component name act as `LIKE` wildcards for the same reason. Separately, the parse
`/ — BOM: (.+) \(([0-9.]+)([a-z]+)\)$/` accepts only digits and dots in the quantity and only
lowercase letters in the unit, and **silently drops** any line that does not match: a unit
such as `m2` or `mm2` would vanish from the BOM without an error.

**3.3 An assembly has no cost.** An assembly is made, not bought, so it has no supplier, so
`getProductUnitCostMinor` returns `null`, and its own comment says Inventory and COGS "won't
move for it." A produced kit could not be valued or sold through the existing costing.

**3.4 Unit cost is a catalogue price, not a stock cost.** It is a supplier's current price
per unit, not what was actually paid for the stock on hand. There is no weighted average and
no cost layer behind it, except in lots. The combination-receipt path values stock at
`quantity × getProductUnitCostMinor`. So costing needs to be designed for production, not
borrowed from this function.

**3.5 Stock cannot cross a city boundary, or take time.** `transferStock` rejects a transfer
between locations in different cities, on the wine-shop assumption that a warehouse serves
only its own city's outlets. It is one instantaneous posting, so there is no state for items
that have left and not yet arrived. Nothing exists for freight, duty, customs or landed cost.
A `Location` records a city and a timezone but **no country.**

## 4. Proposed design

### 4.1 A produce operation

One explicit action, at one location, for one assembly and a quantity. It runs as a single
transaction and every posting balances on its own currency:

| Effect | Posting |
|---|---|
| The assembled item enters stock | debit that item's Inventory for the total cost |
| Each component leaves stock | credit that component's Inventory at its cost |
| Labour and overhead go into the item | credit a "labour and overhead absorbed" account |
| The count moves, in parallel | components out and assembled item in, each with its own counter-account, as receipts and dispatches already do |

Debits equal credits because the item's total cost *is* the sum of the components plus the
labour and overhead. Nothing is single-sided. It reuses what already exists: the per-product
quantity counter-accounts (add "consumed in production" and "produced" beside On Order, Units
Sold, Count Adjustment and Write-off), the parallel unit-count currencies, and the
one-transaction discipline of the four stock movements. Per the rule that every form has a
staging table, it needs a `production_staging` table.

### 4.2 Nesting

**Option A (recommended): each level is its own production run.** Producing an assembly
consumes *held stock* of its sub-assemblies, so those must already have been produced. A
shortfall is refused with a message naming what is missing.

**Option B: producing an assembly automatically produces missing sub-assemblies.** Convenient,
but it hides production events that have their own labour, and it makes a single click post
many things.

A is recommended because "produce, then hold" already means each level is a real event with
real labour. Alongside it: a **read-only explosion** that walks the whole tree and reports
total raw requirements and what is on hand at a location, for planning and for the refusal
messages; and a **cycle check when a BOM line is defined**, refusing any line that would make
an assembly contain itself, directly or through others.

### 4.3 Costing

The unit cost of what is produced is (components + labour and overhead) ÷ quantity. The open
choice is where a stock cost is *held*, since 3.4 shows nothing holds one today.

| Option | How | For | Against |
|---|---|---|---|
| A | Derive it: Inventory value ÷ quantity on hand (weighted average) | needs nothing new; natural in accounting | a location's stock mixes runs at different costs |
| B | Keep the catalogue cost, with a per-assembly override | smallest change | costs still are not historical, and the override is a second source of truth |
| C | Each run creates a lot carrying its own `cost_basis_minor`; consumption draws FIFO | reuses existing lot machinery; gives batch traceability for kits | **not verified** that `consumeFromLots` exposes the cost; lots are built around expiry |

**Recommendation: A**, unless traceability of kit batches is wanted, in which case C. Either
way this also fixes the wider gap in 3.4 for anything produced.

### 4.4 Labour

**(i) An explicit labour amount, or hours times a rate, entered per production run.**
**(ii) Derived from staff time clocked against a project or job, which already exists.**
**(iii) A standard labour and overhead amount per unit held on the BOM.**
**(iv) Labour as a Service line on the BOM.** Services are distinct from Items, and the
LedgerSMB definition of an assembly is parts, services and/or labor and overhead. A Service has
a rate and a Provider, so "assembly labour" would be a Service consumed by the assembly, costed
like any other line. It needs the Services catalogue to exist first (see
`docs/naming-vocabulary.md`, decision 4).

**Recommendation: (i) first**, since it is the simplest thing that is honest about cost, with
(ii) added later by letting a run reference a project. (iii) is LedgerSMB's approach and could
be a default that (i) overrides. (iv) becomes the natural home once Services exist.

### 4.5 Where quantity is stored

The quantity-in-name design (3.2) will carry the whole production step, so it should be looked
at first. **Option 1: keep it, and harden it** (an unambiguous delimiter, an exact-match delete
instead of `LIKE`, a broader unit, and an error instead of a silent drop). **Option 2: give BOM
lines a proper numeric home.** An earlier attempt to use a structured detail store for item
level figures (minimum, maximum, reorder) was reverted because that mechanism had not been
designed or approved, so this option needs the mechanism decided first. **Recommendation: Option 1 now**, and revisit.

### 4.6 Item behaviour is configuration

Whether an item is an assembly, and whether it is produced to stock or assembled at sale, is a
setting on the item, not a code path. It is recorded the way other item settings are.

### 4.7 Locations in different countries

- **Country is classification, not a column.** Following the principle that classifications
  are suggested hierarchies, "Country" would be a hierarchy a business defines and tags its
  locations with, not a hardcoded field. Anything that later depends on country (tax, duty)
  reads that classification.
- **The same-city rule goes.** It is a wine-shop assumption. A business that wants to
  restrict where a warehouse ships should be able to configure that; the code should not
  decide it.
- **In transit is a real place.** Items on a ship are somewhere. In the settled lifecycle
  (`docs/naming-vocabulary.md`) it is the state between Dispatch and Receive, for a Provider, a
  Transfer and a Customer alike, and a cross-country move is a **TransferOrder**. Model it as a genuine
  location ("In Transit, Shenzhen to Adelaide"): a cross-country move is a dispatch out of
  the source into it and a receipt from it into the destination, which can be simultaneous
  for a same-site move. It reuses the existing dispatch and receive.
- **Landed cost** (freight, duty, insurance added to the value of received items) is a real
  feature and out of scope here; it is noted so the design leaves room for it.
- **Currency.** A location can already nominate currencies, and each location has its own
  timezone, so dates are correct across countries. **Not verified:** in what currency a
  produced item's cost is held when its components were bought in several currencies. This
  needs looking at against `docs/multicurrency-design.md` before production is built.

## 5. Testing approach

Test-first, per the project's skills. The tests to write first, described here by what they
must prove rather than by title:

- producing one level balances, per currency, and moves the right quantities;
- producing a nested assembly consumes held sub-assemblies, and refuses when they are short;
- a definition that would create a cycle is refused;
- labour appears in the produced item's cost;
- a factory in one country can produce, then transfer to a warehouse in another, through an
  in-transit location, with every leg balanced;
- a BOM whose component names overlap (one a prefix of another) keeps both lines when one is
  removed. This should be written first, because it tests the suspected bug in 3.2.

Each is documented in the standard shape, with the failure guidance, beside the code it
exercises.

## 6. Order of work

1. **Prove and fix the BOM foundation.** Write the overlap test (confirm the suspected bug),
   harden the encoding (4.5), add the cycle check, add the read-only explosion.
2. **A single-level produce** with labour, posting balanced, costed by the chosen option.
3. **Nested production**, with the shortfall refusal.
4. **Cross-border movement**: drop the city rule, add the in-transit location.
5. **The kit-retailer acceptance fixture**, walking all of it end to end.

## 7. Decisions needed

1. **Costing (4.3):** weighted average (A), catalogue with override (B), or lot layers (C)?
2. **Labour (4.4):** entered per run, derived from clocked project time, a standard per
   unit, or a combination?
3. **Nesting (4.2):** each level its own run (recommended), or automatic?
4. **Quantity storage (4.5):** harden the name encoding now, or design a structured home first?
5. **Assemble-at-sale:** is it wanted at all, per item, alongside produce-to-stock?
6. **Country (4.7):** confirm it is a classification hierarchy and not a location field.
7. **Currency of a produced item's cost** when components come from several currencies.

## 8. What this proposal did not verify

Whether `consumeFromLots` returns cost; whether the BOM screen accepts an assembly as a
component; the suspected `LIKE` bug in 3.2, which has not been demonstrated by a test; how
inventory cost behaves across currencies; and whether the item settings mechanism suits the
assembly flag in 4.6.
