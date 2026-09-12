# The Expansion-Walker — a Purely Read-Side, Duplicated-Reference Report Mechanism

Not a builder. Nothing about this design creates, stores, or
materializes a cartesian product anywhere. It's a walker: a read-side
mechanism that lets one real, flat, sparse fact table be traversed
through several different hierarchical lenses — Sales, Inventory, a
slightly different correlated one for COGS — entirely at report-
generation time, with the "same node appearing in more than one place"
trick handled by this codebase's own, already-existing relationship
primitive, not by copying anything.

## The real, flat, sparse fact table — confirmed directly, corrected twice along the way

`journal_line` is the actual data. Confirmed directly against its own
schema and the functions that write to it, after two real, necessary
corrections to what I'd first assumed:

- **First correction**: `journal_line` carries no stored category,
  supplier, manufacturer, or product hierarchy chain at all —
  `division_id` is a real column, but it is its own, separate
  financial-reporting dimension, unrelated to the category/product
  chain being discussed here. Every hierarchical grouping above the
  leaf (which category an item belongs to, which product groups it,
  which supplier it comes from) is **never stored on the row** — it's
  only ever derivable by walking that leaf entity's own real
  `parent_id` chain at read time, via `getHierarchy`.
- **Second correction**: the row's own leaf pair is not
  `location_id × account_id` in the sense of "account" being some
  separate ledger account — `account_id` **is** the Item pointer.
  Confirmed directly: the `account` table is a lazy marker,
  `INSERT INTO account (entity_id) ... ON CONFLICT (entity_id) DO
  NOTHING`, created the first time any entity is ever posted to. So
  `journal_line.account_id` resolves straight through `account.entity_id`
  to the real Item entity itself — there's no intermediate "combo
  account" standing in between the row and the Item.

So the real, flat, sparse fact table is exactly: **`location_id ×
item_id → amount_minor`, one row per real, actual posting** — sparse
because most conceivable Location/Item pairs never had a real
transaction and so simply have no row, not a stored zero.

## What the expansion-walker actually does

Given a report needs to view this flat fact table through **two
hierarchies folded together** (e.g. Product and Location, or Item
category and Location), the walker:

1. For each real, sparse `journal_line` row, resolves its `location_id`
   up through the **Location** hierarchy's own real `parent_id` chain,
   and its `account_id` (→ Item) up through the **Parts/Product**
   hierarchy's own real `parent_id` chain — two independent, ordinary
   `getHierarchy`-style walks, run per row, not pre-computed.
2. Builds the combined key on the fly (e.g. `(Product, Location)` at
   whatever pair of levels the report asked for — "by Product and by
   region" is a different pair of levels than "by Item and by exact
   outlet," from the exact same underlying rows).
3. Sub-totals into that combined key, exactly the way `Hierarchy.buildTree`
   already sub-totals a single hierarchy today — the same, real vector-
   sum-per-property mechanism, just keyed on a pair instead of a
   single name.

Nothing here writes anything. A report asking for a different pair of
levels, or a different hierarchy pairing entirely (Item category ×
Location instead of Product × Location), is just a different call
with different resolved keys — never a different stored structure.

## The "duplicate here" part — reusing the existing relationship primitive

Per direct instruction, this whole cartesian pairing exists "for
report selection/expansion/sub-totaling only" — it's a lens, not a
new fact. But different real reports want to walk that lens rooted
at different real places: Sales wants it under a Sales root, Inventory
wants the identical lens under an Inventory root, and COGS wants a
**correlated but genuinely different** version (per the earlier,
separate, direct instruction: COGS never splits by cold/shelf storage
origin, since COGS is the same real value regardless of physical
storage — so COGS's own version of this lens collapses that one axis
away, while still being the same real Product × Location pairing
underneath).

This is exactly what `getHierarchy(rootName, relationshipType)`
already does, confirmed directly: a node's children come from its
real `parent_id` **plus** whatever real entities point at it via a
named relationship (`getEntitiesWithRelationship`). So:

- The walker's own resolved `(Product, Location)` keys are exposed as
  real, ordinary entities (they already are — Products and Locations
  both already exist as real entities; nothing new needs creating
  here) with a real relationship type, say `"Sales View"`, pointing
  each resolved pair at wherever Sales reporting wants it rooted.
- The exact, same resolved pairs get a second, real relationship,
  `"Inventory View"`, pointing them at wherever Inventory reporting
  wants them rooted — genuinely duplicated in *position*, not in
  *data*: `getHierarchy('Sales', 'Sales View')` and
  `getHierarchy('Inventory', 'Inventory View')` both walk the
  identical underlying rows, just rooted differently.
- COGS gets its own, third relationship type, `"COGS View"`, pointing
  at a **different, correlated** set of resolved keys — the same
  Product × Location pairs, but without the storage-origin axis
  folded in, matching the direct instruction that COGS never cares
  about that distinction.

## Correction: today's real behavior, confirmed directly against the live system, not just the code's own comments

My first read of this was wrong in an important way. `ensureProductSalesCogsAccounts`/`ensureProductInventoryAccount` are only ever called from inside real posting functions, and a code comment even says a product with no category "never exercises" this path — which reads as if the whole thing, entities included, is lazy. **Confirmed directly to be wrong** for the entity layer: the real Sales/COGS/Inventory *nodes* are already visible in the live CoA today — genuinely created, not deferred. Only one specific layer beneath that is lazy: the `account` table row itself (a marker for "this entity is postable," `INSERT ... ON CONFLICT DO NOTHING`, confirmed directly against its own schema and every real call site). So today's real behavior is:

- Creating a Product/Item **eagerly creates its own real entity nodes** under Inventory, Sales, and COGS (but, per direct correction, currently *not* Breakage — a real, existing gap in the application today, not by design).
- Only the `account` row marking each of those nodes as postable is deferred to first real posting.

This is a real, meaningful distinction from "the whole thing is lazy," and the proposal below is a genuine departure from *both* layers of today's behavior, not a refinement of the second one.

## The actual proposal: the cartesian product itself is virtual, not just its account rows

Per direct clarification: an Item is defined **once**, full stop — one real entity, in a Product's own hierarchy — not once per combination it could ever appear in. The entire cartesian expansion (Item × Location, and by extension Item × Location × Sales/Inventory/COGS/Breakage) is **never instantiated as real entities up front at all** — it exists only conceptually, the same way the Product × Location report-walk earlier in this doc is conceptual. A specific combination-node — "Golden Lager 330ml, at Eastside Cellar Door, in Inventory" — becomes a **real entity**, not merely a real `account` row on an already-existing entity, only the first time something genuinely needs to reference it (a real receipt, a real sale, a real stock take).

This changes the shape of the earlier expansion-walker design in one significant way: that design assumed the leaf entities themselves (Products, Locations) already exist, and only the *report-time pairing* was virtual. This proposal pushes virtuality one level deeper — the *per-combination entities* themselves don't exist until first use, not just the report view over them.

### What "instantiated on a lazy basis" means here, concretely

Extending the same, already-proven `account`-table pattern one level up, from "lazily mark an existing entity as postable" to "lazily create the entity itself, then mark it postable":

1. A real posting (receipt, sale, stock take) references a virtual combination — Item + Location, e.g. — that has never been posted to before.
2. Instead of failing (today's real behavior would require the entity to already exist), the system resolves what the entity's own real name/parent *would* be under the existing structural convention (the same convention `ensureProductSalesCogsAccounts` already uses to place a Sales/COGS leaf under a mirrored category chain), and creates it — a genuine `createEntity` call, not just an `account` insert — the first time, and only the first time.
3. Every subsequent reference to that same combination finds the real, already-created entity, exactly as if it had existed all along.

### Why this matters, per direct instruction

"This keeps the CoA from having to house accounts never needed." Today, creating one Item eagerly creates its Sales/COGS/Inventory nodes regardless of whether every location ever actually sells or stocks it — for a business with many locations and many Items, most of that cartesian space is genuinely never used, and today's eager creation pays the cost anyway. Under this proposal, the CoA only ever grows nodes for combinations that a real transaction actually touched — the exact same "don't pay for what's never used" argument that already justifies the existing `account`-row laziness, applied one level higher.

### Relationship to the read-side expansion-walker above

The two ideas compose rather than compete: the report-time walker (Product × Location, Sales view vs. Inventory view vs. a correlated-but-different COGS view) still runs as a pure read-side traversal — but it now has to account for the fact that not every conceptual combination it walks has a corresponding real entity yet. A combination with no real entity contributes nothing to any real total (there's genuinely nothing there — no transaction has ever touched it), the same way `journal_line`'s own sparseness already means an untouched combination contributes zero today. The walker doesn't need to instantiate anything to report correctly; instantiation only happens on the write side, when a real transaction needs somewhere real to post to.

### What's still genuinely open, given this correction

- **Where the "would-be name/parent" resolution rule lives** — the same real, structural mirroring convention `ensureProductSalesCogsAccounts` already uses (mirror the Item's own category chain under Sales/COGS/Inventory) needs to be extended to include Location as a real second axis in that mirrored structure, and to cover Breakage too (the currently-missing fourth leaf, confirmed directly above).
- **Whether "first use" creates just the one combination needed, or the whole row of combinations implied by it** — e.g. does receiving stock at one Location for the first time only instantiate that Location's own Inventory leaf for that Item, or does it make sense to also pre-touch Sales/COGS/Breakage at the same moment, since they're likely to be needed together? The "never house what's never needed" argument favors instantiating only the exact leaf actually touched, not the whole implied set.
- **Undoing an instantiation** — if a combination is created on a genuine data-entry mistake (a stock take against the wrong location, corrected immediately after), does the now-real entity get cleaned up, or does it simply sit unused forever (a real, small, permanent trace of a mistake, the same way any other over-eager entity creation in this codebase already can)?

