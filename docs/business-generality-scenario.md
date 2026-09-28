# Generality: the Virtual Kit Retailer as the Litmus Test

## The principle

The application's core is **accounting.** Around it sit a small number of fundamental
concepts:

- **Things:** Locations, Items, Suppliers and, most importantly, Customers.
- **A lifecycle:** order, purchase, receive, store, move or redistribute, sell, dispatch.
  Any step may be skipped; a business uses the ones it needs.
- **Configuration, not code:** everything else. Whether stock is classed hot or cold,
  inside or outside, whether a business groups by division or category, what a unit is
  called: a business chooses these, and the code must not know them.

## The litmus scenario

A **virtual retailer**, with no shop. It has a website that offers, and takes orders for,
kits of parts for 3D printers and drones, and also sells the *assembled* item. It buys
parts from suppliers **in carton quantities**, holds them in **storage**, and runs an
**assembly** service at a warehouse or factory where **staff are hired** to put kits and
finished items together. It then **dispatches** them to customers.

Nothing in that description is about wine, bottles, refrigeration or a till. If the
application handles it without special cases, the generality is real. If a step needs a
workaround, that step marks a place where the code is specific rather than general.

This chapter walks the scenario through what exists. Each claim is marked **verified**
(read in code or in the manual during this work) or **not verified**.

## Two different meanings of "assembly"

`docs/wine-bar-assemblies-plan.md` describes one pattern: **assemble at the moment of sale,
never hold the finished item.** A gin and tonic is made from a bottle and a can when it is
ordered; nobody stocks pre-poured drinks. That plan follows LedgerSMB's "restock to zero"
workaround.

The kit retailer needs the other pattern: **produce, then hold.** Staff build items over
time from parts, spending labour, and the finished item enters stock at a location, ready
to be sold and dispatched. The same LedgerSMB documentation the plan quotes defines an
assembly as parts, services *and/or labor and overhead*, so both are in scope. The
difference is what an assembly *does*:

| | Assemble at sale | Produce, then hold |
|---|---|---|
| Finished item held in stock | never | yes, at a location |
| When components are consumed | at the sale | when it is built |
| Labour and overhead | negligible or ignored | a real cost added to the item |
| Trigger | the sale itself | an explicit action by staff (or a job) |

The plan's own open question 3 asks whether consuming components should be automatic at
sale or an explicit "Produce Assembly" action. The kit retailer needs the explicit action.
A general application needs both, and needs to let an item choose.

## Walking the scenario through what exists

| # | Step | Status | Evidence and notes |
|---|---|---|---|
| 1 | Create the business | supported | `createBusiness`. **Not verified:** whether its defaults are neutral, since seed data is wine retail. |
| 2 | Define parts and kits as Items | supported | Items and their catalogue exist. |
| 3 | Define what a kit is made of | **partly** | `stageBomComponent`, `postBomComponents`, `deleteBomComponent`, `getBomComponents`, a staging table and a screen exist. The component quantity is encoded in the link entity's *name* (for example `Gin & Tonic — BOM: Gin (30ml)`), a string used as data. The screen defaults its unit to `ml`. |
| 4 | Suppliers and what they sell, with carton size | supported | `item_source.package_quantity` is the carton-to-unit rate (used for capacity and delivery fees). **Not verified:** whether a purchase order line is entered in cartons or in units. |
| 5 | Order from suppliers | supported | `postPurchaseOrder`, `placeOrder`. Orders live under `Orders`, outside the chart, so they cannot leak into a statement. |
| 6 | Receive stock into a location | supported | `receiveStockAtLocation`. A receipt with no purchase order is allowed and simply drives "on order" negative. |
| 7 | Store it, with capacity | supported, wine-named | Capacity is tracked. See the next section for what is hardcoded. |
| 8 | **Build a kit or finished item** | **missing** | No function consumes components and produces an item. `consumeFromLots` is for lots only. Nothing takes staff time or wages into an item's cost. |
| 9 | Staff who are hired | supported | `createEmployee`, `setEmployeeSchedule`, shifts, `payEmployeeWages`, and time clocked against a project (`getOpenProjectClockForEmployee`). These are building blocks for step 8. |
| 10 | Customers place orders on a website | **not verified** | A `CustomerName` type exists and `postSalesOrder` exists. **Not verified:** whether there is an inbound interface a storefront could call, or customer accounts. |
| 11 | Offer only what is available | **not verified** | Sales orders track committed quantity, but whether availability-to-promise (on hand minus committed) is computed was not checked. |
| 12 | Move stock between locations | **within one city only** | `transferStock`, plus a restock picking list and `dispatchRestockFromPickingList`. **`transferStock` refuses any transfer between locations in different cities** (verified), on the assumption that a warehouse only serves its own city's outlets. A factory in another country could not ship to a distribution warehouse. Transfers are also instantaneous: there is no in-transit state (verified: nothing in the code is named for in-transit, freight, duty, customs or landed cost). |
| 13 | Pick and dispatch to a customer | supported | `getPickingList`, `dispatchOrderFromPickingList`, `dispatchStockFromLocation`. **Not verified:** carriers, tracking, shipping to a customer address. |
| 14 | Invoice and be paid | supported | This is the accounting core. |
| 15 | Returns, warranty, repairs | **not verified** | Not searched for. |

### Optional steps

The lifecycle functions are **independent of one another**, which is what lets steps be
skipped: a receipt does not need a purchase order, and a dispatch does not need a sales
order. So a cash sale and a receipt without an order already work, and so does a transfer
with no sale, *within one city* (step 12). **Not verified:** *drop-shipping*, where a supplier ships straight to the customer and
nothing is ever received or stored. It needs a purchase order tied to a sales order, with no
receipt, and I did not check whether that is expressible.

## Where the code is specific rather than general

**Verified in code:**

- **Capacity is named for wine.** A `Location` has `bottle_capacity` and `carton_capacity`.
  `ensureLocationCapacityAccount` chooses a unit of `'bottle' | 'carton'`, and the space
  currencies are `SPACE-BOTTLE` and `SPACE-CARTON`. The *structure* is general: a base unit,
  and a pack of several base units. The *names* are not. A drone motor is not a bottle.
- **A default carton of 12.** When an item has no preferred-vendor package size, the carton
  conversion falls back to `12`, a wine figure. (Beer is 24 elsewhere in the comments.)
- **Hot and cold are built in three times** (item Storage Origin typed `'Hot' | 'Cold'`,
  `resolveDispatchLocation` matching `LIKE '%Refrigerated%'`, and the Locations page's
  refrigerated section). See `docs/classification-neutrality-impact.md`.
- **Division and category are structural**, in reports and in where an item sits in the tree.
  Same chapter.
- **The assembly screen defaults its unit to `ml`.**

**Carton quantities and storage are not the problem.** The kit retailer needs both, so a pack
size and a storage capacity are core concepts, and they are already in the code. What is
missing is that their *names* and the *base unit* are configuration rather than a fixed
choice between "bottle" and "carton".

## Requirements clarified after the first walk-through

Stated directly, and they narrow the scope considerably:

1. **Assemblies and bills of materials are the one thing missing** from the list of
   fundamental concepts; the rest of the lifecycle is taken as present.
2. **Assemblies nest.** An assembly can itself be a component of another: kits plus
   labour make an assembled product. A bill of materials is therefore recursive.
3. **Kits and assembled products are produced and held in inventory** before being sold
   and dispatched. This is the "produce, then hold" pattern, and it is required.
4. **Warehouses and factories are genuine locations**, and may be in different
   countries from the headquarters.

Requirement 3 settles Decision 3 below in part: an explicit *produce* action is required.
Whether assembling at the moment of sale is *also* supported, per item, is still open.
Requirement 4 adds a gap the first walk-through did not name: stock cannot move between
locations in different cities today (step 12). The design for both is in
`docs/assembly-production-design.md`.

## What is genuinely missing

1. **A production step (step 8).** An explicit action that consumes components from stock,
   adds labour and overhead, and produces the finished item into stock at a location, as a
   balanced posting. This is the one true gap in the lifecycle. Everything it needs to draw on
   (BOM definition, employees, time against a project, receiving into a location) exists.
2. **A way to choose per item** between assembling at sale and producing to stock.
3. **Making capacity and unit names configuration.**
4. **Customer-facing intake** (steps 10 and 11), if the storefront is in scope at all.

## Decisions needed before building

1. **Is the storefront part of this application, or a separate system that calls it?** The
   accounting core, orders, stock and dispatch are back office. A website that "offers and
   takes orders" could be built inside this application or be an external client of an
   interface it exposes. This decides whether steps 10 and 11 are in scope.
2. **How does labour become cost?** Options: staff clock time against a job (a project) and a
   rate turns it into cost added to the finished item; or a flat labour and overhead amount
   per assembly on the BOM (LedgerSMB's approach); or both.
3. **Explicit "Produce" action, automatic consumption at sale, or both?** See above.
4. **Should quantities encoded in a link entity's name stay?** A BOM quantity stored as text
   in a name is fragile, and a production step will depend on it heavily. This deserves an
   explicit look before it is built on.

## The proposed way to keep this honest

Turn the scenario into an **acceptance fixture**: a second data file for the Step Runner,
alongside the tutorial, that walks the kit retailer through the steps above. Steps that work
would pass; steps that do not would fail and name themselves. Progress toward generality
would then be a number that goes up, not an opinion. It would not need a special case for
wine, so it would also be a check on the classification work.

## What this chapter did not verify

Whether a default business is neutral; whether purchase-order lines take cartons; anything
about customer accounts, a storefront interface, availability-to-promise, carriers, returns,
or drop-shipping; and how much of the BOM screen is generic beyond its unit default. Each is
marked above and needs looking at directly before it is relied on.
