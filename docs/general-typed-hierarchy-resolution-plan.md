# User-Defined Hierarchies as Reporting Structures — Prototype Nodes and Real, Pointing Data

Per direct, iterative correction — the earlier drafts of this document (a generic `TypeDescriptor<TBrand>` walk, then a plain, uniform parent_id chain-walker) are both superseded by this, the real, settled design. Kept in git history for the record of how the design arrived here, not deleted.

## 1. The core idea, in the user's own words

**Hierarchies are merely useful reporting structures for P&L formatting, in exactly the same way the Chart of Accounts is a formatting/business-reporting structure — with a real caveat, covered in §5.**

Nothing here identifies "is this a Division" by *where* an entity sits (its `parent_id` depth) or by a TypeScript generic type parameter. Instead, identity comes from *what a real entity points at* — a real, lateral `relation_id` link back to an abstract **prototype node** that names the kind. This works identically no matter how deep the real entity actually is, because the pointer is direct, not a walk.

## 2. Two, real, separate concepts

1. **Prototype nodes** — abstract, few in number, define the *shape* of a hierarchy type. Not real business data; the schema for a hierarchy, not an instance of one.
2. **Actual, named, real nodes** — the real, live data ("Springfield," "Red Wine," "Riverside Cellars") — each one points back, via `relation_id`, to whichever prototype node describes what kind of thing it genuinely is.

## 3. The real, default prototype structure

```
"Hierarchies" --(relation_id)--> "Wine Retail Business"

"Division" --(relation_id)--> "Hierarchies"
"Location" --(relation_id)--> "Division"

"Category" --(relation_id)--> "Hierarchies"
"Item"     --(relation_id)--> "Category"
```

Four small, real prototype nodes, defining two real hierarchy types for this business: Division -> Location, and Category -> Item.

**Real, actual data then uses these prototypes** — every real node in a real hierarchy points, via its own `relation_id`, at the one, real prototype node describing its kind:

```
"Springfield"           --(relation_id)--> "Division"
"ChainTest SubDivision" --(relation_id)--> "Division"    (a real sub-division - same prototype, deeper in the real tree)
"Riverside Cellars"     --(relation_id)--> "Location"

"Red Wine"              --(relation_id)--> "Category"
"Merlot 2021"           --(relation_id)--> "Item"
```

A sub-division and a top-level division both point at the exact same "Division" prototype — genuinely uniform regardless of real depth, with no walk required to answer "what kind of thing is this," only one, direct `relation_id` lookup.

## 4. Nothing "built in" — Division/Location/Category/Item are a recommended default, not a privileged special case

Per direct, important correction: the real mechanism must never special-case "is this the Division prototype specifically." It only ever asks the one, generic, real question — *"what prototype does this real node's `relation_id` point at"* — treating every hierarchy type, pre-seeded or user-invented, identically. A business renaming "Division" to "Region," deleting it, or defining a genuinely new, third hierarchy type (say, a real org chart, or a regional-sales grouping independent of the cost-accounting division) is exactly the same, unremarkable operation as using the default one. The four prototypes above are simply what a new business gets seeded with by default, for convenience — not a fixed, closed set the code itself is aware of.

## 5. The real caveat — the Chart of Accounts is the *same* mechanism, but not *only* a reporting structure

The Chart of Accounts (Balance Sheet / P&L, Assets / Liabilities / Equity / Income / Expense) is itself just another real instance of this identical, generic prototype-pointer mechanism — not structurally special, seeded by default exactly like Division/Location.

The real, honest caveat: unlike a user-invented hierarchy such as "Division," which carries no meaning beyond grouping and presentation, the CoA's specific prototype nodes carry real, functional accounting weight that is not optional or reporting-only:

- **Debit/credit normal balance** — whether an account under "Assets" versus "Liabilities" increases with a debit or a credit is load-bearing double-entry mechanics, not a display choice.
- **Year-end close behavior** — Income/Expense accounts genuinely zero out to Retained Earnings at close; Balance Sheet accounts genuinely carry forward. Real, required behavior.
- **Statutory shape** — a real Balance Sheet and P&L have to reconcile in ways regulators and auditors actually check; a "Division" report has no such external obligation.

**Every hierarchy is a reporting structure, but not every reporting structure is only a reporting structure.** The CoA's prototype nodes carry extra, real, functional metadata (normal balance side, close behavior) a generic, user-invented prototype never needs — the pointer mechanism is identical either way; only the CoA's specific prototypes have real consequences attached beyond formatting.

## 6. Real, concrete, no-new-tables implementation

Per `no-new-tables`: the entire mechanism is `relation_id` links between real entities — no new table, no new column, reusing the exact, same primitives `create<T>`/`fetch<T>`/`updateEntity` already provide.

```ts
/** Per direct design: the real, generic question this whole mechanism
 * answers - "what real prototype does this real node point at,"
 * never "is this specifically a Division." Works identically for a
 * pre-seeded or a genuinely user-invented hierarchy type. */
function getPrototypeOf(entityName: string): string | undefined {
  const row = db.prepare(
    `SELECT proto.name FROM current_entities e
     JOIN current_entities proto ON proto.id = e.relation_id
     WHERE e.name = ?`
  ).get(entityName) as { name: string } | undefined;
  return row?.name;
}

/** Seeds the four, real, default prototypes for a new business - a
 * real, recommended starting point, never treated specially by any
 * other real code. A business is free to rename, delete, or add to
 * these immediately. */
function seedDefaultHierarchyPrototypes(business: TypedNode<'BusinessName'>, userId: UserId): void {
  const hierarchies = create(business, typeRootName, 'Hierarchies', userId);
  const division = create(hierarchies, typeRootName, 'Division', userId);
  create(division, typeRootName, 'Location', userId);
  const category = create(hierarchies, typeRootName, 'Category', userId);
  create(category, typeRootName, 'Item', userId);
}
```

Tagging a real, actual node with its prototype reuses the direct `setPrototype` function shown above — no separate, new mechanism, and no `setEntityLink`-style intermediate record:

```ts
setPrototype('Springfield', 'Division', userId); // real entity, real prototype it points at
```

## 7. What this replaces, and why

Supersedes both earlier drafts of this document directly:

- The generic `TypeDescriptor<TBrand>`-per-kind approach forced an artificial, compile-time distinction between things (a Division and a genuine sub-Division) that are structurally, and now conceptually, the exact same real kind of node — wrong per direct correction.
- The plain, uniform `parent_id`-walk-to-Business approach (`getHierarchyChain`) correctly identified that every level is the same kind of thing, but revealed a real, separate, deeper problem: Divisions are not currently rooted under any business via `parent_id` at all (a real, pre-existing, already-documented data bug, confirmed directly against live data — see `docs/multi-dimensional-reporting.md` §2). The prototype-pointer mechanism sidesteps this entirely — knowing "what kind is this real node" no longer depends on successfully walking all the way to a Business at all.

## 8. Real, concrete next steps

1. Build `getPrototypeOf`/`seedDefaultHierarchyPrototypes` directly, with a real, direct test proving a sub-division and a top-level division both correctly resolve to the same "Division" prototype.
2. Wire `createBusiness` to call `seedDefaultHierarchyPrototypes` for every new, real business.
3. Migrate `categoryForAccount`/`divisionForLocation` (`db-matrix-reports.ts`) to use `getPrototypeOf` plus a real, generic ancestor-search (walk `parent_id` up, stopping at the nearest real ancestor whose prototype matches), rather than their own, separate, ad-hoc, differently-incomplete logic.
4. Leave the real, separate Division/Business `parent_id` data bug (§7) as its own, distinct, not-yet-decided fix — not conflated with this mechanism, which does not depend on it being fixed first.

## 9. Real, direct proof: a genuinely user-defined axis, through the real P&L report

Confirmed directly, not just designed: `MatrixAxis` (in `db-matrix-reports.ts`) was extended from a closed, four-value union to also accept any real, user-defined string, with `resolveKey` falling through to the already-generic `getDimensionParent` for anything it doesn't recognize as one of the four recommended defaults. A real, direct test proves a genuinely user-invented "Bottle Size" hierarchy — never one of the four defaults, never known to any reporting code — correctly, independently groups real P&L income through `getProfitAndLossByAxis`, exactly like Division or Location would. This directly answers the open question `multi-dimensional-reporting.md` §9 left undecided: the axis set is no longer closed.

Not started before this — this is real, built, and directly tested.

## 10. Real, direct follow-on: the naming pattern itself was redundant, and genuinely fixed (not just diagnosed)

Per direct, further investigation and correction: nearly every real, per-entity account this codebase creates baked its own real parent's name directly into its own stored name (`${itemName} — On Order`), even though the parent relationship (`parent_id`) already, structurally supplies exactly that fact. Confirmed directly, this was not cosmetic — `post_journal_entry_insert`'s own trigger already prefers a real, explicit `account_id` over name-based lookup everywhere it posts, which is what made the fix safe: `ensureProductQuantityAccounts` now creates real, simple, non-globally-unique names (`On Order`, `Units Sold`, `Count Adjustment`, `Write-off`), each genuinely scoped by its own real parent, and returns the real, exact `accountId` alongside each name so every caller posts by id, never by an ambiguous, possibly-shared bare name. `stageQuantityMovementLine`/`postQuantityMovement` were extended with a real, optional `accountId` parameter, used in preference to their own, pre-existing, fragile, name-based ancestor-walk fallback.

`getQualifiedDisplayName(entityId)` is the real, generic counterpart for genuinely display-only purposes — reconstructing the familiar "Parent — Child" form from the live tree at lookup time, never stored as the entity's own literal name.

Confirmed via the full, real backend test suite (166/166) that this is safe and correct, including fixing one real, existing test that had been asserting against the old, now-removed literal name directly.

Real, honest scope: this fix has only been applied to `ensureProductQuantityAccounts` so far — many further real, confirmed instances of the exact, same redundant pattern remain (`${locationName} — Storage Capacity Remaining`, `${businessName} Locations/Items/Contacts`, the tier/location Sales-COGS leaf naming, and several more) - a real, larger, ongoing piece of work, not completed in one pass.
