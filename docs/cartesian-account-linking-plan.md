# One Real, Canonical (Item × Location × Applicable Hierarchies) Node, Shared by Inventory, Sales, and COGS

Per direct design: Inventory, Sales, and COGS are three real, separate financial accounts, but they all exist for the exact same, real, underlying fact — "this specific product, sold or stocked in this specific real combination of circumstances." Today, `ensureProductLocationInventoryAccount` and `ensureProductLocationLeaf` (Sales/COGS) each independently re-derive the same (Item, Location) combination, as two separate, parallel structures. This plan replaces that with one, real, canonical combination node, expanded once, that all three accounts point back to — DRY, applied to the entity tree itself, not just to code.

## 1. The real problem, restated precisely

- Cash, Cash Sale, Cost of Goods Sold — every top-level account — has one, single, real identity. But a *per-product, per-location* Sales account and its COGS counterpart are really two, real facets of the *same* real fact (this product, at this location), currently built as two, independent, parallel structures that happen to derive the same location suffix twice.
- Per direct extension: it's not just Location. **Any hierarchy that genuinely affects the item's selling price is a real, additional axis of this same combination** — Storage (a cold beer priced higher than a warm one), Glass Size (a large pour priced higher than a small one), and potentially others, each applicable only where it genuinely matters (Glass Size at a Wine Bar location; Storage wherever hot/cold genuinely differs).
- **The item's own name must never encode any of this.** "Lager," not "Cold Lager" or "Lager (Large Glass)" — per direct instruction, anything separable into a real hierarchy must live in that hierarchy, not be baked into the product's own identity, specifically so a real report can break sales down *by* Storage, or *by* Glass Size, across every product that has one — impossible if the fact is buried inside a different, per-variant item name instead.

## 2. The real, canonical combination node

For a given item, at a given location, with whichever further hierarchy values genuinely apply, there is exactly **one** real, canonical node representing that combination — created once, the first time it's genuinely needed, never re-derived independently by Inventory, Sales, and COGS separately.

```
Lager (the real Item)
  └── Riverside Cellars (the real Location — always the first axis after the item)
        └── Cold (a real, applicable Storage value — only present where Storage applies here)
              └── Inventory     (created the first time Lager is stocked, cold, at Riverside Cellars)
              └── Sales         (created the first time a cold Lager sells there)
              └── COGS          (created at the same moment as Sales)
```

Each real level in this chain is a simple, real, scoped-by-parent name (`Cold`, not `Lager — Riverside Cellars — Cold`) — genuinely safe, per the same, real, confirmed mechanism already proven this session: `Entity.getUnder`/`Entity.create` already scope correctly by parent id; `setEntityLink`/`setDimensionParent` now accept an explicit id to avoid the one, real, remaining ambiguity risk (a bare-name lookup); and any report that displays these names checks for genuine duplication first, qualifying only where real ambiguity exists, never over-qualifying a uniquely-named account.

At a location with no applicable further hierarchies (an ordinary retail outlet, no Storage or Glass Size distinction), the real chain is simply `Item → Location → {Inventory, Sales, COGS}` — exactly what already exists today, just unified into one shared node instead of two, separate, parallel ones.

## 3. "Applicable to a Location" — real, conditional hierarchy membership

Not every hierarchy applies everywhere. Glass Size matters at a Wine Bar location; it means nothing at a Warehouse. This is real, existing, conditional structure, not a new mechanism: a Location can carry a real, direct link (the same, established `setDimensionParent`-style mechanism) naming which real hierarchies apply to it, in what order the combination chain should walk them. Determining "which hierarchies apply here" is a real, direct lookup against the location itself — not hardcoded per location type, so a location can genuinely have any real combination of applicable hierarchies, including a business-invented one no default list ever anticipated.

## 4. Real pricing implication — not just a reporting concern

Because Storage and Glass Size genuinely affect price (a real, direct, given fact — cold costs more than warm, a large pour costs more than a small one), `item_source`'s own real pricing must be able to resolve a real price **per combination**, not merely per item. Concretely: pricing resolution becomes a real, direct walk of the same, real combination chain — checking for a price specific to the full combination first, falling back toward the base item price only where no more specific, real override exists. This reuses the exact, same "most specific real fact wins" principle `getItemPriceForCurrency` already applies for currency-specific pricing, generalized to any real, applicable hierarchy value, not currency alone.

## 5. Real, concrete, lazy creation timing

- **Inventory**: created the moment stock is first received for this exact, real combination (item, location, and whichever applicable hierarchy values that specific stock genuinely has — a cold delivery creates the `Cold` branch; a room-temperature one wouldn't).
- **Sales and COGS**: created together, at the moment of the first real sale for that exact combination — not before, since a combination that's stocked but never yet sold has no real, meaningful Sales/COGS history to speak of yet.

## 6. Real, concrete next steps

1. Build the one, real, generic `ensureCombinationNode(itemName, path: string[], userId)` — walks/creates the real chain (Location, then each real, applicable hierarchy value in order) once, returning the real, canonical terminal node.
2. Rewrite `ensureProductLocationInventoryAccount` and `ensureProductLocationLeaf` to both call this one, shared function for the combination node itself, each then only ensuring their own real Inventory/Sales/COGS child beneath it — eliminating the current, real, duplicated (Item, Location) derivation.
3. Extend location-level "applicable hierarchies" lookup — a real, direct, per-location list, ordered, used to build the real `path` array passed into step 1.
4. Extend `item_source`/pricing resolution to check for a real, combination-specific price before falling back to the base item price.

Not started — this is the real, settled design, per direct instruction; a first, real, concrete slice (the two-axis Item × Location case) implemented next, within this session's remaining scope.
