# Scoped Uniqueness, and the Real, Physical (Product × Location) Recording Grid

Two, real, related facts about how this application's own entity tree behaves: names are unique only among real, direct siblings, never globally (the "Springfield" principle — see `docs/entity-model.md`), and every real, physical stock fact is recorded against a genuine (product, location) pair, never a product alone.

## Scoped entity name uniqueness, and the real, physical (product × location) recording grid

### Entity name uniqueness is scoped, not global

Two real, direct siblings under the same real parent can't share a
name:

```sql
CREATE UNIQUE INDEX entities_name_current ON entities(parent_id, name)
WHERE deleted_at IS NULL;
```

The exact, same name is genuinely fine at a different level, or under
a different parent — a company, a division, a location, and an
employee can all correctly be named "Springfield" at once.
`createEntity`'s own application-level check enforces the same rule.

### The real, physical recording grid: only product and location

Only product and location genuinely map to a real, physical,
posted-to account. Division and category are purely computed
reporting rollups — walking a location's own real parent (the
division tree) or a product's own real parent (the category tree) at
report time — never a separately recorded dimension on the journal
line itself. Checked directly against the current schema
(`backend/schema/00-core.sql`): `journal_line` has no `division_id`
column at all anymore — not even as a vestigial, unused one. It was
fully retired, not merely demoted to "legacy" (confirmed by the
retirement comments in `backend/src/db.ts`, around lines 3375 and
3437). Division is purely the structural, tree-walk fact described
above, with nothing stored per-line.

Every product, tiered or not, resolves to its own real
`{Product} — {Location}` Sales/COGS/Inventory leaf when a location is
known — `ensureItemLocationLeaf` for an ordinary product,
`ensureItemTierLocationLeaf` for a tiered one — wired into
`completePosSale`'s own Sales, COGS, and Inventory resolution.

![The New New P&L report, division as the outer grouping and location as the inner — a real, direct division expanded to show its own, real location-level breakdown underneath.](manual-images/pm_new_new_pl_location_axis.png)

### Delivery/dispatch location on Purchase Orders and Sales Orders

`PurchaseOrderInput` and `SalesOrderInput` both carry an optional
`location` field — a Purchase Order's own delivery instructions, a
Sales Order's own dispatch instructions. Recorded via the same,
existing, generic `setDimensionParent` mechanism already used for a
posted Sales/COGS leaf, not a new table.

### Location on AR Sale, Cash Sale, AP Purchase, and Cash Purchase

All four carry a real, direct, per-invoice location — not per line,
since none of these four screens has genuine line-item detail beyond
an optional single part. `ensureLocationScopedAccount` generalizes the
same `{account} — {location}` pattern for an account with no specific
product at all — AR Sale's generic "Sales Revenue", or AP Purchase's
own, user-chosen expense account. Both real triggers
(`ar_sale_post_insert`, `ap_purchase_post_insert`) post to the
location-scoped account name whenever a location is staged, with
`postARSale`/`postAPPurchase` ensuring the location-scoped account
(and its own real Location dimension link) exists directly, in
TypeScript, before the trigger runs — a SQL trigger can't itself call
`setDimensionParent`.

Every one of these four screens' own frontend forms carries a real
"Location" dropdown, populated from the real, live `listLocations`
API: Purchase Order ("Delivery location"), Sales Order ("Dispatch
location"), AR Sale, and AP Purchase.

### The generic dimension mechanism generalizes to any further, lateral classification

`setDimensionParent`/`getDimensionParent` — the same mechanism used
for "Location" and "COGS Product" — supports any further, lateral
classification a product or location might carry, with zero new
structural code: a wine's own region (Bordeaux, Tuscany), a beer's
own brewer, or any other lateral fact, the same way. These are
separate, additional classification links, not a second, competing
category hierarchy — a product's own real category chain (Parts →
Category → sub-category) stays the one, structural grouping its
Sales/COGS accounts nest under; a region or brewer link is a separate,
lateral fact about that same product, read the same way
`locationForAccount` already reads the Location dimension.

\clearpage

## Closing the vocabulary gap through the actual UI

### Adding a new vocabulary word

The Translations screen has an "Add a new word" feature, matching the
same, established pattern as "Add a new language" right next to it.

![The Translations screen, showing the "Add a new word" feature — the same, established pattern as "Add a new language" right next to it.](manual-images/pm_translations_add_word.png)

### One, parameterized script, from one data file

`e2e/tests/build-vocabulary-and-translations.spec.ts` reads one JSON
data file, `e2e/vocabulary-and-translations.json`. Each entry carries
its own word, whether it's genuinely new (create it under Vocabulary
first) or already exists elsewhere in the tree (skip creation,
translations only), and its own German/French/Danish/Italian text
together. The same script handles both jobs in one pass, for any
future word added to the data file.

### A known, remaining limitation

11 words live outside Vocabulary — under Business Reports, Chart of
Accounts, Application, or Credit Sale — and are genuinely unreachable
from the Translations screen as it exists today: no UI screen
currently lets a person edit a translation for an entity parented
under one of those. Their translations were applied directly to the
seed for now; a person editing one of these words' translations in
the live application cannot do so yet.
