# Cold/Shelf Storage Inventory Model — Design Doc

A real, separate, larger piece of design work than the Cash Sale/
Purchase page fix that surfaced it (see `docs/RELEASE-NOTES.md` for
that fix). Captured directly from the domain rules as given, not yet
implemented.

## The domain rules, as given directly

1. **Receiving is (almost) always hot; selling cold-storage products
   is (almost) always from cold.** A product may be purchased hot and
   stored cold, but the reverse (purchased cold) is genuinely
   unlikely. This is a real, one-directional flow: shelf → cold, not
   the other way.
2. **The store keeps cold capacity topped up.** The real, standing
   preference is to keep a cold-storage product's own cold quantity
   at its real maximum; the store only genuinely runs out of a
   product once its real refrigerated stock is exhausted — shelf
   stock (still in cartons) doesn't count as "available" for a
   cold-storage product until it's moved to cold.
3. **Units differ by direction.** A product is normally *sold* by the
   bottle or six-pack, but *received* by the carton — a real,
   genuine unit-of-measure mismatch between the purchasing and
   selling side of the exact same product.
4. **Cartons get broken open on demand.** The real, physical
   transfer from shelf (carton) to cold (bottle/six-pack) happens
   when cold demands more stock — a carton is opened and its
   contents become individually available bottles/six-packs in cold
   storage.
5. **Beer is essentially never sold hot by the bottle/six-pack.** A
   real, near-absolute rule for that product category specifically
   (matches this codebase's own existing `COLD_STORAGE_CATEGORIES`
   set — Lager, Stout, Champagne, Cava, Prosecco).

## What already exists, confirmed directly (not assumed)

- **`isColdStorageProduct(partName)`** (`backend/src/db.ts`) already
  exists — a real, category-based lookup (Lager/Stout/Champagne/
  Cava/Prosecco) with no per-product override yet.
- **`resolveDispatchLocation(partName, logicalLocationName)`**
  already exists — already searches for a real, `relation_id`-linked
  cold sub-location by name pattern (`%Refrigerated%`) when
  dispatching a cold-storage product, falling back to the logical
  location itself if none is linked. This is a real, existing,
  automatic mechanism, not something to build from scratch — but no
  actual "Refrigerated" sub-location entity exists in any real
  business's data yet, confirmed directly, so this path has never
  actually been exercised end-to-end.
- **`part.unit_of_measure`** already exists but is a single, free-text
  label per product (e.g. "Bottle", "Carton") — there is no real
  conversion ratio between two units of the same product today (no
  "1 carton = 24 bottles" anywhere).
- **A real, established, separate restocking mechanism already
  exists** (`getRestockPickingList`/`confirmRestockPickedLine`/
  `dispatchRestockFromPickingList`, plus `transferItems` in
  `db-stock.ts`) — but this is a *between-location* transfer
  (warehouse → retail outlet), genuinely different from what's
  described here, which is a *within-location* transfer (a single
  retail outlet's own shelf stock → that same outlet's own cold
  stock). The two are related in spirit (both move real stock to
  where it's needed) but operate on different real axes and
  shouldn't be conflated into one mechanism.
- **`getLocation`/`getPartLocation`/`dispatchItems`/
  `receiveItems`** (`db-stock.ts`) — the real, existing
  per-location, per-part quantity tracking this new mechanism would
  need to extend, not replace.

## What's genuinely new

- **A real unit-conversion ratio per product** — how many bottles (or
  six-packs) one carton contains. Doesn't exist today at all.
- **Two real, separate stock quantities per product per location** —
  a shelf quantity (in cartons) and a cold quantity (in bottles/six-
  packs) — rather than today's single quantity per part per location.
- **A real "cold-first" depletion rule** at sale time: a cold-storage
  product's sale is satisfied from cold stock first; if cold stock is
  insufficient, this is a real trigger condition (see below), not
  silently satisfied from shelf.
- **A real, automatic (or manually triggered — an open design
  question, see below) shelf→cold transfer**: breaks open enough
  cartons to replenish cold back toward its real, standing maximum,
  converting carton quantity to bottle/six-pack quantity via the new
  ratio.
- **A real, product-level "sold cold only" flag**, distinct from
  `isColdStorageProduct`'s existing pure category check — beer's
  near-absolute rule (rule 5) suggests category alone may already be
  sufficient for most products, but a real, explicit per-product
  override should exist for the genuine exceptions the category rule
  won't catch on its own.

## Open design questions (not yet decided)

- **Trigger for the shelf→cold transfer**: automatically whenever
  cold drops below its own real maximum (a background/on-demand
  top-up), or only reactively when a sale would otherwise fail for
  lack of cold stock? The domain rule ("keep cold at a maximum")
  suggests the former; a purely reactive version is simpler to build
  first and could be the real, honest first increment.
- **What happens when shelf itself runs out** (no more cartons to
  break open)? A real, genuine stock-out — the same as today's
  existing insufficient-stock handling, or does cold-storage products
  need their own, distinct out-of-stock message given the two-stage
  nature of their supply?
- **Six-pack vs. individual bottle**: rule 3 mentions both as real,
  separate selling units for the same underlying product — is a
  six-pack a real, second product entity with its own conversion
  ratio (1 six-pack = 6 bottles), or a purely cosmetic selling-unit
  label with no separate stock tracking of its own? This changes the
  schema shape significantly and needs a real, direct answer before
  implementation starts.

## Refinements, from direct follow-up clarification

- **Terminology**: this codebase's existing entity type is called
  "Part"/"Parts" internally, but the preferred term going forward for
  this domain is **"Item"/"Items"** — new work should say "inventory
  item," not "part," in anything user-facing or in fresh design
  writing, even where it continues to use the existing `Part`
  entity/table internally (a rename of the existing mechanism is a
  separate, later concern, not bundled into this).
- **Warehouses may also have real cold/refrigerated storage** — this
  doc's earlier draft, and the existing `Locations` page intro text
  it was drawn from, both assumed cold storage was retail-only ("a
  warehouse deals in full cartons only"). That assumption is now
  confirmed too narrow: a warehouse *may* also carry real
  refrigerated capacity, not exclusively cartons. The two-quantity
  (shelf/cold) model below should apply to any location type that
  genuinely has cold capacity, not be hardcoded to retail outlets.
- **Cold/shelf is a sales-side and physical-storage concern, not a
  COGS concern.** Which storage an item was physically sold from
  (cold vs. shelf) affects *sales*-side logic (the cold-first
  depletion preference, the real Sales Revenue posting per direction/
  location as already established elsewhere) — it should **not**
  create any separate cold-vs-shelf split in Cost of Goods Sold
  postings. COGS is the same real value regardless of which physical
  storage the unit came from; the storage distinction is logistical,
  not financial.
- **Line items should be real entities, not new plain-SQL-table
  rows.** Confirmed directly: AR Sale/AP Purchase line items should
  be modeled the same way Parts/Items already are — real entities in
  the existing entity tree — rather than a new dedicated line-items
  table. See the implementation note below on how this interacts with
  the existing single-row-per-reference staging tables.
- **"Product" and "Item" are two real, distinct levels, not one** —
  confirmed directly: neither a "product" concept nor a container/
  packaging attribute exists anywhere in this codebase today (a
  direct search found zero matches). A **product** is the real,
  conceptual/brand thing (e.g. "Golden Lager") — not itself directly
  sellable or stockable. An **item** is the real, concrete, sellable/
  stockable unit — a specific packaging variant of a product, each
  genuinely its own separate entity with its own real unit-of-measure
  and (per the conversion-ratio point above) its own real relationship
  to any other item of the same product:
  - 330ml single (one bottle/can)
  - 6× 330ml pack (a six-pack)
  - 24× 300ml carton (a full carton)
  - The same product may also genuinely vary by **container material**
    (e.g. "aluminum can" vs. "glass bottle") — a real, orthogonal
    variant axis to pack size, not the same thing.

  This means the existing `Part`/`Parts` entity as it stands today —
  one entity per what's actually being called an "Item" here, with no
  real product-level grouping above it — maps onto the *item* level
  of this model, not the *product* level. A genuine new hierarchy
  level (Product, sitting above today's Parts/Items) is what's
  missing, not a replacement for what already exists. This is a real,
  substantial addition to the scope above (the carton→bottle
  conversion ratio, for instance, is now naturally a relationship
  *between two items of the same product*, not a bare number on a
  single item).

  **Why this matters beyond the wine/beer example, confirmed
  directly**: the same real Product/Item split is exactly what a
  clothing retailer needs — one product ("Men's Crew T-Shirt") sold
  as many real, distinct items (Small/Red, Small/Blue, Medium/Red,
  ...), where sales statistics genuinely need rolling up to the
  product level (total T-shirts sold, regardless of size/colour) to
  plan future inventory, not just tracked per individual item. This
  isn't a wine-retail-specific need — it's a real, general retail
  pattern this data model should support.

  **Sequencing decision, made directly**: the Product level itself is
  not yet designed or decided (open questions above, plus this new
  clothing example, both still need real answers). Per direct
  instruction, the AR Sale/AP Purchase restructure proceeds now
  against today's existing Part/Item level — real Part entities
  referenced per line, exactly like Cash Sale/Purchase already does —
  rather than waiting on the Product level to be designed first. The
  Product level remains real, separate, later work.

## Suggested implementation order (once open questions are resolved)

1. The real conversion ratio field on a product, and the two
   separate (shelf/cold) quantities per product per location —
   additive to existing stock tracking, non-breaking for products
   that aren't cold-storage.
2. Cold-first depletion at sale time (`completePosSale`/
   `completeCashPurchase`'s own sale-side sibling) — read from cold
   first, fail (or fall back, depending on the open question above)
   if insufficient.
3. The shelf→cold transfer mechanism itself, using whichever trigger
   is decided above.
4. Surface real, live cold/shelf quantities (not just the existing
   binary hot/cold tag) in the Cash Sale/Purchase line UI, so a
   person can see genuine availability before completing a sale.
