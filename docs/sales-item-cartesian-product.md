# Sales items as a Cartesian product: Size × Packaging, and beyond

This is a design/convention note, not a new mechanism. The two real, generic
primitives this design rests on — "generic Hierarchy" and "generic Cartesian
Product Builder" — already existed in this codebase before this note was
written; it documents applying them to a real, worked case (Amber Ale
330ml/700ml, glass bottle vs. aluminium), and records the adjective-ordering
convention that keeps every name produced this way reading naturally.

## The real observation

"Amber Ale 330ml" and "Highland Single Malt 700ml" are each, today, a single
Item entity whose name happens to encode two further, real facts — a **Size**
and a **Packaging** — as a plain string suffix, unqueryable as anything but
text. The real insight: a retail Sales Item's full identity is genuinely a
**Cartesian product** of its base product against every further dimension
like this one a business actually stocks in — Amber Ale × {330ml, 700ml} ×
{Glass Bottle, Aluminium Can} is, in principle, up to four real, distinct,
separately-trackable products, not one item with a decorative name.

Note on naming: "Container" was deliberately **not** reused for this new
grouping, even though it reads naturally for "glass bottle vs. aluminium
can." The name is already taken — "Container" is a real, pre-existing
Hierarchy grouping used by the unrelated Open Container feature
(`backend/scripts/step-runner.ts`), for Carton↔Bottle unit-of-measure
conversion. Reusing it here would have produced one grouping silently
holding two unrelated meanings — exactly the ambiguous-shared-name bug class
already found and fixed earlier in this project (the id-based `getHierarchy`
fix). The new grouping is called **"Packaging"** throughout.

## The two existing, generic primitives

**Generic Hierarchy** (`ensureHierarchyGrouping` / `ensureHierarchyValue` /
`setHierarchyParent`, `backend/src/db.ts`) — the exact mechanism Category and
Division already use. A grouping (`"Category"`, `"Division"`, `"Storage"`)
holds a flat set of named values; any entity can be tagged under one value
via `setHierarchyParent`, a pure, lateral `relation_id` tag — never a change
to the entity's own tree position, never a new column, never a new table.
Reporting (`getHierarchyParent`, the New New P&L's axis grouping) resolves
this generically, by grouping name, with no special-cased code per grouping.

**Generic Cartesian Product Builder** (`ensureProductInstance` /
`defineProductShape` / `climbInstanceTree`, `backend/src/db.ts`) — given a
business, a *shape* (an ordered list of `[key, groupingName]` dimension
pairs) and one real value per dimension, ensures a single, concrete,
addressable entity for that exact combination, named by joining the values
(`values.join(' — ')`) and keyed by the sorted tuple of the real hierarchy
values' own entity ids (`combination_ids`) so the same combination always
resolves to the same real entity. Already in real, production use for
currency-exchange pairs, user-role links, and the storage-combination
quantity/value postings `receiveItems`/`dispatchItems`/`transferItems`
already support (`combinationValues`/`combinationShape`).

Both are real, already-shipped, generic, grouping-name-agnostic mechanisms —
nothing below needed a line of new backend infrastructure. Only the e2e
fixture (`shared-fixtures/tutorial-steps.csv`) and the step-runner
(`backend/scripts/step-runner.ts`'s new `tagItemHierarchy` handler) needed a
new line each, to exercise an existing mechanism against a new grouping name.

## Which of the two fits Size/Packaging — and why it's not the other one

These look superficially identical (both are "tag this thing by a value from
a named set"), but they answer different questions, and picking the wrong
one for the wrong reason would be a real mistake:

- **Generic Hierarchy** answers "how do I **classify** an existing, single,
  real entity for reporting?" — the entity's own identity, accounts, and
  postings are untouched; the tag is purely a lateral fact read back by
  reports. Category and Division are exactly this: Amber Ale stays one real
  Item, with its own real Sales/COGS/Inventory/On Order accounts
  (`ensureItemSalesCogsAccounts`/`ensureItemQuantityAccounts`), and Category
  is just another way to group it in a report.
- **Generic Cartesian Product Builder** answers "I need one, real, concrete,
  addressable **thing** for this exact combination of values, with its own
  identity, distinct from every other combination" — a currency pair, a
  user-role link, a storage combination. The combination *is* the entity;
  there is no separate, prior "base" entity it's merely tagging.

Size and Packaging, applied to a sellable wine/beer item, are the **first**
case, not the second — and the reason is concrete, not stylistic: an Item's
real quantity/COGS/Sales/On Order accounts (`ensureItemQuantityAccounts`,
`ensureItemSalesCogsAccounts`) are provisioned as children of the **Item**
entity itself, under the business's `Items` root. A `ensureProductInstance`
combination is, by contrast, a child of a separate `Product` root — it has
no such accounts, and nothing in `db-stock.ts`/`db.ts` knows how to post
quantity or COGS against one. Routing Amber Ale's real identity through
`ensureProductInstance` would mean either duplicating the whole
quantity/COGS/On-Order account-provisioning machinery for a second kind of
"sellable thing," or losing it — a real, structural regression, not a
simplification. So: **Size and Packaging are tagged onto the existing Amber
Ale/Highland Single Malt Item entities via the Hierarchy mechanism** — the
same call Category and Division already make, under two further grouping
names — and the Item itself keeps its one, real, existing identity and
accounts.

This also means the current `createRecurringJournal`/`placeOrder`/
`postOrderDispatch` machinery (which already identifies a line item purely
by its Item name) needs no change at all: Amber Ale 330ml, Glass Bottle is
still, structurally, just "Amber Ale 330ml" — wholly unchanged entity,
wholly unchanged postings — now additionally classifiable by two further,
real, generic hierarchies.

**When would the other mechanism (`ensureProductInstance`) actually be the
right call for a product variant?** When the variant genuinely has no prior,
separate "base" entity of its own — the combination of values *is* the whole
identity, with nothing above it that would otherwise need its own accounts.
A currency pair is the clean example already in production: there is no
real "FX" entity that `USD`/`EUR` merely tag — the pair itself is the one,
whole, addressable thing. A retail SKU, by contrast, nearly always does have
that prior base entity (the product line), which is exactly why Hierarchy
tagging, not a product instance, is the right tool here.

## A second, worked example: a secondhand/thrift shop

To show this generalizes past wine retail: a thrift shop's own catalog is a
cleaner illustration precisely because its real, practical sale-dimensions
line up closely with English's own standard adjective order (**OSASCOMP** —
Opinion, Size, Age, Shape, Colour, Origin, Material, Purpose; see the next
section). A donated "Bag" base item might carry:

- **Size**: Small / Medium / Large
- **Colour**: Red / Blue / Black
- **Origin**: Italian / French / Local
- **Material**: Leather / Canvas

— four further, real Hierarchy groupings, each tagged the same
`setHierarchyParent(itemName, groupingName, valueName, userId)` way Size and
Packaging are above. A small, round, red, Italian, leather bag is still,
structurally, one real Item (`"Bag"`), classified by four further,
independent, generic hierarchy tags — never four nested entities, never a
new table, never a `ensureProductInstance` combination (there's still one,
real prior base entity — the specific, physical bag on the shelf — that
these four facts classify, not compose).

## The naming convention: supply values in OSASCOMP order

Where a combined display name actually is built by joining several such
values — `ensureProductInstance`'s own `values.join(' — ')` is the one place
in this codebase that already does this, for whichever mechanism's values a
caller passes in — the values should always be supplied in **OSASCOMP**
order: Opinion, Size, Age, Shape, Colour, Origin, Material, Purpose. Applied
to the thrift-shop bag above (Size, Colour, Origin, Material are the only
four of the eight that are real catalog dimensions here — Opinion/Age/Shape/
Purpose aren't separately tracked facts for a bag): **Small — Red — Italian
— Leather**, read aloud, is already the exact, natural English order a
person would say it in ("a small, red, Italian, leather bag"), for free,
purely because the caller supplied the dimensions in that order. Supplying
them in a different order (`Leather — Italian — Red — Small`) would build a
real, working, but unnaturally-ordered name — a convention worth stating
explicitly, since nothing in `ensureProductInstance` itself enforces an
order; it joins whatever order it's given.

This is a documentation/convention recommendation for whoever calls
`ensureProductInstance` or orders a set of Hierarchy groupings for display,
not a code change: there is nothing to enforce here that the existing
mechanism doesn't already support by simply being given its arguments in
the right order.

## What this session actually did

- Tagged Amber Ale 330ml (`Size: 330ml`, `Packaging: Glass Bottle`) and
  Highland Single Malt 700ml (`Size: 700ml`, `Packaging: Glass Bottle`) in
  the tutorial fixture, via the existing `setHierarchyParent` mechanism —
  see `shared-fixtures/tutorial-steps.csv`.
- Added one new, generic step-runner handler, `tagItemHierarchy`
  (`backend/scripts/step-runner.ts`), API-path only for now — there is no
  dedicated UI control yet for tagging an *existing* item into an arbitrary
  hierarchy value after creation (Category is only ever set inline at
  item-creation time; Division tagging has its own, Location-specific
  "Move…" action in the Business Structure popup). A real, open UI gap,
  not papered over with a fake selector.
- Did **not** touch `ensureProductInstance`/`defineProductShape`/
  `climbInstanceTree`, the schema, or any Item/quantity/COGS account
  provisioning — this is purely an application of the existing, generic
  Hierarchy mechanism to two further grouping names.

## Open, genuinely unresolved

- **No UI for post-creation item tagging.** Building one (where? the Items
  Catalog screen? a generalized version of the Business Structure popup's
  "Move…" action?) is real, separate, future work.
- **Reports already offer Size/Packaging as an Outer/Inner grouping choice —
  no gap, confirmed by reading the code.** `backend/src/routes/matrix-reports.ts`'s
  `/profit-and-loss-by-axis` and `/axis-values` endpoints, and
  `backend/src/db-matrix-reports.ts`'s `getAxisValues`, accept **any** real,
  business-defined Hierarchy grouping name as an axis — not a fixed list.
  `getAxisValues` calls `getBusinessHierarchy(businessName)`, which
  dynamically discovers every real grouping a business actually has. So the
  moment Size and Packaging exist as real groupings (as of this session's
  tutorial-fixture change), they are automatically selectable P&L axes on
  the New New P&L screen, exactly like Category and Division — zero further
  backend or frontend code needed. This was verified by reading the
  reporting code, not merely assumed.
