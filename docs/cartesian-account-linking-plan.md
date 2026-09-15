# The Hierarchy/Product Cartesian Mechanism — Implemented, Real, and Tested

Per direct, iterative design (the earlier drafts of this document — a combination node living under the item, applicable-hierarchies-per-location, pricing-resolution changes — are superseded by this, the real, settled, and now-implemented design). Kept in git history for the record of how the design arrived here, not deleted.

## 1. The real problem this solves

Inventory, Sales, and COGS are three real, separate financial accounts, but they can all exist for the exact same, real, underlying fact — "this specific product, sold or stocked in this specific real combination of circumstances" (a cold beer, in a can, sold as a single, at Riverside Cellars). Before this work, any such per-location, per-variant leaf independently re-derived its own name and identity. This mechanism gives every such combination one real, canonical identity, expanded once, that any number of real financial accounts can point back to.

## 2. The real, implemented structure

![The real, settled structure: Hierarchy (where named values live), Product (holding both a Definition chain and a real Instance chain), and Inventory/Sales/COGS in their real, unchanged positions, each new leaf pointing at the Instance's own top node.](diagrams/cartesian-product-structure.svg)

*(Regenerated via `make manual-diagrams` whenever the real `.mmd` source changes.)*

**`Hierarchy`** — a real, top-level node under a business, holding real, named groupings and their values (`Beer` → `Lager`/`Ale`, `Storage` → `Hot`/`Cold`). Genuinely user-extensible: nothing in the mechanism special-cases any particular grouping or value name.

**`Product`** — a second, real, top-level node, sibling to `Items`/`Locations`, holding two, real, different kinds of chain:

- **A Definition** — an ordered chain of dimension nodes (e.g. `Location → Item → Size → Container → Quantity → Storage`), each one's own `relation_id` pointing at the real Hierarchy *grouping* it represents.
- **An Instance** — one real, specific combination (e.g. `Riverside Cellars → Lager → 330ml → can → single → Cold`), each node's own `relation_id` pointing at the real Hierarchy *value* it represents. The instance's own first node additionally records, via a real dimension link, which Definition shape it follows.

**The one, sufficient distinction between a Definition node and an Instance node**: a Definition's `relation_id` always lands on a real Hierarchy grouping itself; an Instance's always lands one level deeper, on one of that grouping's own children. No separate flag is needed anywhere.

**New leaves under Inventory, Sales, and COGS** — created directly under these real, existing, unchanged accounts (never an intermediate per-item grouping node), each one's own `relation_id` pointing at the real Instance's own top node. This is the one, shared, canonical identity all three financial accounts refer back to.

## 3. Why the accounts themselves could not simply relocate under the combination

Confirmed directly by reading the real, live schema: `business_reports` (which drives every financial statement — Trial Balance, Balance Sheet, P&L) is a recursive walk starting from `Chart of Accounts`. An account that isn't structurally reachable from there — via `parent_id` — silently disappears from every financial report. This is why the new leaves stay genuine, structural children of Inventory/Sales/COGS; the cartesian identity is carried laterally, via `relation_id`, never by moving these accounts to live under `Product` instead.

## 4. A real, system-wide bug found and fixed while building this

`updateEntity`'s relation-setting resolved its target by a global, bare-name lookup (`resolveId`). This is genuinely ambiguous the moment two, real, differently-scoped entities share a name — exactly the case here, since a Product Instance node ("Riverside Cellars") and the real Location it represents ("Riverside Cellars") are two, separate, real entities with the identical name. Fixed by adding a real, optional `relationId` field throughout `updateEntity`, `Entity.relate`, `setEntityLink`, and `setDimensionParent` — the same, already-proven disambiguation pattern used earlier this session for `accountId`/`entityId`. Every caller in this new mechanism uses the explicit id, never the ambiguous name-based path.

## 5. The real, implemented functions

```ts
ensureHierarchyGrouping(businessName, groupingName, userId)
ensureHierarchyValue(businessName, groupingName, valueName, userId)
defineProductShape(businessName, dimensions: [dimensionName, groupingName][], userId)
ensureProductInstance(businessName, definitionDimensions, values: string[], userId)
ensureCombinationAccountLeaf(baseAccountName, instanceTopNode, userId)
```

All five are real, live, exported functions in `backend/src/db.ts`, backed by a real, direct, comprehensive test (`backend/test/db.test.ts`) that builds the full, six-dimension example end to end and confirms: the Definition/Instance relation_id distinction; that an instance's own top node correctly records its Definition; that every new leaf under Inventory/Sales/COGS points at the same, shared instance; and that these new leaves remain genuinely, structurally reachable from Chart of Accounts.

## 6. Real, honest, remaining scope

- **Wired into a real, live transaction flow**: `PosSaleLineInput` now accepts optional `combinationValues`/`combinationShape`; `completePosSale` uses them, taking priority over tier/location resolution, for Sales, COGS, and Inventory alike.
- **Pricing resolution per combination, implemented**: a real, optional `product_instance_id` column on `item_source` (using a `0` sentinel, matching the exact, existing fix for `currency`'s identical NULL-uniqueness problem) lets a business register a real, combination-specific price; `getItemPriceForCurrency` checks it first, falling back to the base item price.
- **A real, serious bug found and fixed while wiring this in, stated directly**: the initial implementation called `ensureCombinationAccountLeaf('Sales', ...)`/`ensureCombinationAccountLeaf('COGS', ...)` — bare names that collided with unrelated Vocabulary words sharing those exact names, silently posting to the wrong entities entirely and breaking the trial balance by exactly the sale amount. Found by running the extended minimal e2e proof and getting a genuine, non-zero imbalance, not assumed correct from the unit tests alone (which used different account names and never exercised this specific collision). Fixed by using the real, correct Chart-of-Accounts names (`Sales Revenue`, `Cost of Goods Sold`) throughout.
- **A second, real bug found in the same investigation**: `getTrialBalance`'s own duplicate-name detection (added to safely qualify genuinely ambiguous account names) was scoped globally across the entire database rather than to the specific business/ledger being reported on, causing coincidental collisions with unrelated accounts. Fixed by scoping the duplicate check to only the accounts with a real balance in the specific business/ledger being queried.
- **Minimal e2e coverage added**: `backend/scripts/proof-year-end-lifecycle.ts` (the fast, direct, backend-only lifecycle proof) now includes a real combination-sale step, confirming the combination-specific price resolves correctly, the base price stays unaffected, and the trial balance remains genuinely, exactly balanced both before and after year-end close.

Real, honestly still open: `receiveStockAtLocation` (the quantity-tracking side of a stock receipt) is not yet wired with combination support — only the POS sale path (Sales/COGS/Inventory-value reduction) is. The full `make test-e2e` simulation (`simulate-wine-retail-month.ts`) still does not exercise any real, hierarchy-varied combination — only the minimal proof script does.
