# The Entity Model: `parent_id`, `relation_id`, and the Primitives Built on It

Every row in the single `entities` table has:

- **`parent_id`** — its position in exactly **one** hierarchy (a real
  tree, walked recursively via `WITH RECURSIVE` throughout this
  codebase). Genuine containment/classification: "Amber Ale 330ml" is
  a child of "Ale," which is a child of "Parts."
- **`relation_id`** — **one** additional, lateral pointer to any other
  entity, for a purpose that is *not* hierarchical containment.

The shape is a tree (`parent_id`) with at most one extra directed edge
leaving each node (`relation_id`) — every node has out-degree ≤ 2.
Each entity gets exactly one lateral relationship, never several;
that one-slot constraint is the thing to keep in mind before adding a
new use of `relation_id` (ask first whether the entity that would need
it might ever also need an existing one).

![Parent link (structural, "lives under") versus relation link (lateral, "refers to").](diagrams/parent-vs-relation-link.svg)

## What `relation_id` is used for today

Grouped by category (the exact, current, complete breakdown is
mechanically regenerated via `make source-reference` —
`docs/source-reference.md`'s "Parent Link / Sibling (Relation) Link
Index" — rather than kept as static prose here):

- **Translations** — every Vocabulary word's `relation_id` points at
  its own language (English, German, French, Italian, Danish, Hebrew,
  Arabic).
- **Chart-of-Accounts prototype tagging** — every account under a CoA
  prototype (English/German/French/Italian/Swiss CoA) points back at
  that prototype.
- **Menu/UI labels and route metadata.**
- **COGS / Balance Sheet / P&L Statement tagging** — which rollup
  category a given account belongs to.
- **Structural relationship markers** — `Belongs To Division`,
  `Belongs To Business`, `Place of Employment`, each a per-instance
  link (one marker per fact, never a shared aggregate target).
- **Contact-type and Location-Type markers** — `Customer Contact
  Type`, `Vendor Contact Type`, `Employee Contact Type`, and each live
  Location Type (`Retail`, `Warehouse`, `Wine Bar`).

`getDefaultLanguage`/`setDefaultLanguage` can also store the
system-wide default display language on the root `Application`
entity's `relation_id` — real, working code, currently unused (no
business has called `setDefaultLanguage`, so this is `NULL` today).

Vocabulary-word translation itself does **not** use `relation_id` at
all — it works entirely through the separate `translation_entry`
table (`localized_text` view).

## The relationship-type pattern

An intermediate, `relation_id`-tagged entity can supply both a type
and a target — a plain classification tag is the degenerate case of
this same pattern (where the type entity alone is the complete
answer). A full relationship (e.g. "Smith Prototype Trust" is
"Trustee Of" "Boutique Wine Company") needs two facts, so it goes one
hop deeper: the entity's `relation_id` points at a lazily-created
intermediate record; that record's `parent_id` gives the type (under
`Relationship Types`), and its own `relation_id` gives the target.

```sql
SELECT rel_type.name AS type, target.name AS target
FROM current_entities e
JOIN current_entities rel ON rel.id = e.relation_id
JOIN current_entities rel_type ON rel_type.id = rel.parent_id
JOIN current_entities target ON target.id = rel.relation_id
WHERE e.name = 'Smith Prototype Trust';
-- -> type: 'Trustee Of', target: 'Boutique Wine Company'
```

`setRelationship`/`getRelationship`/`getEntitiesWithRelationship`
implement this. **Not yet applied**: a shared packaging-tier class
("Six-Pack") multiple products' own tier instances would point to —
the mechanism supports it; nothing uses it this way yet.

**Multiple typed addresses/phones per entity** use the same pattern
one level down: each address/phone is its own child entity
(`parent_id` gives the one-to-many), and *that child's* `relation_id`
points at a type marker under `Address Types`/`Phone Types`. The
child's value lives in its own `contact_entry` row.

```sql
SELECT type_marker.name AS address_type, child.name AS record_name
FROM current_entities child
JOIN current_entities parent ON parent.id = child.parent_id AND parent.name = 'Riverside Cellars'
JOIN current_entities type_marker ON type_marker.id = child.relation_id
JOIN current_entities type_category
  ON type_category.id = type_marker.parent_id AND type_category.name = 'Address Types';
```

Entity names are globally unique in this system — a type-marker name
must not collide with any other real entity's name anywhere in the
tree.

## The primitive set (`backend/src/primitives.ts`)

Almost every backend function is one of five kinds of fact about an
entity: its structural position, a named link to another entity, a
posted balance, a contact detail, or a hierarchy walk. These five
primitives are the shared, canonical way to express each:

```ts
// Entity - the one node type
Entity.create(name, parent, userId)
Entity.get(idOrName, parent?)                      // scoped lookup; parent required unless
                                                     // the name is already known globally unique
Entity.getUnder(name, parentId)
Entity.ensureUnder(name, parentId, userId)          // find-or-create
Entity.rename(id, name, userId)
Entity.reparent(id, parent, userId)
Entity.relate(id, target, userId)
Entity.delete(id, userId)
Entity.children(parentId)

// Link - a named relationship between two entities
Link.set(entityName, linkType, target, userId)
Link.get(entityName, linkType)                      // -> target name, or undefined
Link.delete(entityName, linkType, userId)
Link.mark(entityName, markType, userId)             // presence-only marker
Link.unmark(entityName, markType, userId)
Link.isMarked(entityName, markType)
Link.withTarget(linkType, target)                   // every entity linked this way

// Balance - a posted currency or quantity figure
Balance.post(business, ledger, reference, accountName, accountId, delta, userId, transdate?)
Balance.get(accountId)                              // live figure, 0 if never posted, never null
Balance.getScoped(accountName, dimensionColumn, dimensionName)

// Currency - debit/credit as a property of a signed amount
Currency.toDebitCredit(amountMinor, normalSide)     // output: every report's own split
Currency.fromDebitCredit(debitMinor, creditMinor)   // input: General Journal / lines-entry

// Detail - an open-ended contact fact (address, phone, email, web page...)
Detail.set(entityName, detailType, value, userId)
Detail.list(entityName, detailType?)
Detail.delete(entityName, detailType, value, userId)
```

`Entity.get`'s `parent` argument exists so every lookup can be scoped
— a child is unique by name *within one parent*, never resolved via a
bare, global `WHERE name = ?`. An unscoped lookup silently resolving
to the wrong same-named entity is the single most common real bug
class in this codebase's own history (see the Historical log for
several, separate, confirmed instances) — always scope a lookup by
parent when the name is not already known to be globally unique.

**Status**: this is the shared target, not a completed migration —
most of `db.ts`, `db-reports.ts`, and `db-matrix-reports.ts` still use
their own, separately-implemented functions rather than composing
these primitives. New code should prefer the primitives; converting
existing functions is ongoing, incremental work.

### Hierarchical access and in-memory data structures

```ts
getHierarchy(rootName, relationshipType?): HierarchyNode
// HierarchyNode = { id: number; name: string; children: HierarchyNode[] }
```

Builds the in-memory tree for any root (Chart of Accounts, Vocabulary,
or any other structural tree), walking both `parent_id` and,
optionally, one named relationship type, with a depth-counter cycle
guard (`MAX_DEPTH = 100`).

```ts
Hierarchy.buildTree(rootName, getProperties, relationshipType?): HierarchyTreeNode
// HierarchyTreeNode = {
//   name: string; accountId: number | null;
//   own: Record<string, number>;    // this node's own direct values
//   total: Record<string, number>;  // recursive sum per property, every level
//   children: HierarchyTreeNode[];
// }
```

The one, general drill-down primitive: walks a hierarchy and attaches
any caller-named set of numeric properties to every node, summed
independently per property at every level. Drives the P&L drill-down
(`Hierarchy.buildTree('Income', ...)`) and the Inventory drill-down
(`Hierarchy.buildTree('Inventory', ...)`) from the same function.

## `create<T>`/`fetch<T>`: typed, generic entity creation

A second, generic creation primitive, alongside `Entity.create` above
— the two coexist and are not yet unified.

```ts
interface TypeDescriptor<TBrand extends string> {
  readonly brand: TBrand;
  readonly validNames?: () => string[];          // a Vocabulary-backed kind
  readonly validate?: (name: string) => boolean; // a structural check
}
interface TypedNode<TBrand extends string> {
  readonly id: EntityId;
  readonly name: string & { readonly __brand: TBrand };
}
function fetch<TBrand extends string>(name: string, type: TypeDescriptor<TBrand>): TypedNode<TBrand>;
function create<TParentBrand extends string, TChildBrand extends string>(
  parent: TypedNode<TParentBrand>, type: TypeDescriptor<TChildBrand>, name: string, userId: UserId
): TypedNode<TChildBrand>;
```

`fetch` confirms an existing entity genuinely matches a descriptor
before it is trusted as a parent; `create` allocates a new one
directly against `entity_entry`, the same low-level, trigger-backed
mechanism `createEntity` uses — a `TypeDescriptor` with
`validNames`/`validate` rejects a bad name before any allocation
happens. Scoped-not-global uniqueness (two siblings under the same
parent can't share a name; the same name is fine under a different
parent) is enforced natively.

Roughly three dozen `TypeDescriptor` constants exist
(`typeBusinessName`, `typeDivisionName`, `typeLocationEntityName`,
`typeVocabularyWordName`, `typeCategoryOrItemsRootName`, and more —
see `docs/source-reference.md`'s generated, complete index rather than
a copy here that could go stale), grouped by purpose:

- **Contact/business-entity kinds**: `typeProviderName`, `typeCustomerName`.
- **Structural/reporting kinds**: `typeItemName`, `typeLedgerName`, `typeExpenseCategoryName`.
- **Chart of Accounts structure**: `typeChartOfAccountsNodeName`.
- **Per-record marker/detail kinds**: `typeLineTypeMarkerName`, `typeStorageOriginMarkerName`, `typeTextDirectionMarkerName`, `typeRelationshipRecordName`, `typeOpenHoursRecordName`/`typeScheduleRecordName`, `typeEntityLinkRecordName`, `typeLocationTypeMarkerName`, `typeIsBillingAddressMarkerName`.
- **Project/task tracking**: `typeProjectTaskName`.
- **Menu/UI configuration**: `typeMenuOverrideName`, `typeMenuSectionName`, `typeMenuLinkName`, `typeMenuLinkFlagName`, `typeHiddenMarkerName`.
- **Translation/vocabulary infrastructure**: `typeTranslationConceptName`.
- **Business-type setup**: `typeBusinessTypeQuestionsRootName`, `typeBusinessTypeQuestionName`.

Two call sites deliberately still use generic `createEntity` directly
rather than a specific `TypeDescriptor`, since a genuinely open-ended
tool should stay generic: the Entity Tree Editor's own endpoint
(`routes/entities.ts`, an administrator may create any kind) and
`primitives.ts`'s own `Entity.create`.

### Primitive implementation notes

`primitives.ts` is additive, not a completed migration (see "Status,"
above) — 260 separately-named functions existed historically because
each new screen got its own name for what is structurally the same
operation on a different entity; the five primitives above are the
real generalization. A few implementation details worth knowing:

- **`Entity.get(name)` with no `parent` is only safe for a name
  already known to be globally unique** (Vocabulary, a language) — a
  business name is *not* safe here, confirmed directly: a business can
  share a bare name with something else entirely (an admin login
  username, tried as a business name), and an unscoped lookup has no
  way to tell them apart. Every business lookup elsewhere in this
  codebase scopes to parent `'Businesses'` for exactly this reason.
- **No JSON for a structured fact.** `Entity.tag`/`untag`/`hasTag` and
  `Entity.setAttr`/`getAttr` exist so a fact about an entity (a lead
  time in days, a BOM quantity, which of several kinds a child is) is
  itself a named child entity, found by an exact `(parent, name)`
  lookup — never a name pattern, never a JSON field. `setAttr` is a
  single-valued fact (a quantity, a date, a status), replaced in place
  under its own named type-grouping whenever it changes, rather than
  accumulated.
- **`entities` permits only `INSERT` and `SELECT`.**
  `Entity.setDetailJson`/`mergeDetailJson`/`setRelationId`/
  `setCombinationIds` wrap the insert-only mechanisms
  (`entity_set_detail`/`entity_merge_detail`/`entity_set_relation`/
  `entity_set_combination_ids`, `backend/schema/00-core.sql`) that
  replace every direct `UPDATE entities SET ...` call site — no
  function in this codebase ever runs a raw `UPDATE` against
  `entities` itself.
- **`Currency.toDebitCredit(amountMinor, normalSide)`** is the one
  output method every report uses, never a separate, hand-rolled
  `x > 0 ? x : 0` split. `normalSide` says which column an amount is
  expected to land in for its own section (Asset/Expense are
  normal-debit; Liability/Equity/Income are normal-credit);
  `is_contra` flags an amount that landed in the opposite column from
  what's normal for that section — worth showing distinctly rather
  than as an ordinary positive number the way a raw signed amount
  would read. `Currency.fromDebitCredit` is the same class, the other
  direction — every lines-entry screen (AR sale, AP purchase, POS,
  stock receipt/dispatch) produces a signed `amount_minor` this way
  before it ever reaches `post_journal_entry`.
- **`Balance.post`** is genuinely not always a balanced, double-entry
  transaction — a quantity movement or a capacity figure has no
  meaningful counter-item; a caller needing real double-entry posts
  two of these, to two accounts, under the same reference.
- **`Hierarchy.buildTree`** is deliberately one general function, never
  one named per specific category (no `buildCategoryTree`, no
  `buildDivisionTree`) — the same function serves a P&L drill-down, an
  Inventory drill-down, or, passing more than one property at once, a
  combined view showing several figures side by side per row, all from
  the same walk.

`asUserId`, `asEntityId`, `asDivisionName`, `asLocationName`,
`asEmployeeName`, `asCustomerName`, `asProviderName`, `asItemName`
(`backend/src/db.ts`) are the paired, compile-time-only branding
functions — no runtime validation of their own (that's the paired
`TypeDescriptor`'s `validate`/`validNames`, applied by `fetch`). Used
at the boundary where an untyped value (a route's `req.params`, a raw
database row) first becomes a typed value the rest of the codebase
can trust.

## Item hierarchies: Product → Item, with Category as a lateral tag

Items sit under a business-scoped `{business} Items` root (one of
`PER_BUSINESS_ROOTS` — `Locations`, `Items`, `Contacts`, `Vocabulary`,
`Ledgers`, `Profit Centers` — every business gets exactly these six),
always flat, directly under that root
(`createItem(name, 'Items', userId, business)`) — never positioned by
category. Only **Product → Item** is a real, structural `parent_id`
relationship: a Product (`Amber`, conceptual/brand, never itself
sellable) is the direct parent of one or more concrete, sellable
Items beneath it:

```
{business} Items → Amber → Amber Ale 330ml Aluminum Can (Cold)
```

`listProducts()` finds any entity under Items that is the *direct*
parent of at least one real Item — the level immediately above where
Items sit. Each dimension in parentheses (`(Ale)`, `(330ml)`,
`(Aluminum Can)`, `(Cold)`) is a naming convention today, not yet a
separate, structured field per dimension.

**Category is a separate, optional, lateral tag** — exactly like
Division — applied to a Product or an Item by name
(`setHierarchyParent(name, 'Category', parentName, userId)`,
`getHierarchyParent(name, 'Category')`), never a real ancestor in this
tree. A category *value* (`Beer`) is itself a lightweight entity
registered once under the business's own Hierarchy registry, not
nested under `Items` — "walking up from an item to find its category"
is a single tag lookup today, never a `parent_id` walk, and an item or
product can be re-tagged into a different category at any time with no
catalog reshuffling. See `docs/pm-domain-reference.md`'s "Hierarchies
and multi-dimensional reporting" for the full, generic mechanism this
shares with Division and any other business-defined grouping.

Any function walking "up from an item to find its business-scoped
Items root" must recognize either the exact global `Items` name or any
name ending in `" Items"` (a word-boundary suffix match, never a loose
`endsWith`) — a hardcoded exact match terminates too early and never
reaches a business-scoped root.

**Storage Origin** (Hot/Cold) and **Text Direction** (LTR/RTL, for
Hebrew/Arabic) are both explicit, per-entity dimensions using the same
`setEntityLink`/`getEntityLink` mechanism, each with its own marker-
entity parent (`Storage Origin Types`, `Text Direction Types`):
`setItemStorageOrigin`/`getItemStorageOrigin`,
`setLanguageDirection`/`getLanguageDirection` (`backend/src/db.ts`).

## Chart of Accounts: shared categories, per-prototype leaves

Only the five top-level report categories (`Asset`, `Liability`,
`Equity`, `Income`, `Expense`) are genuinely shared across every
business — every country's accounting still groups into the same five
buckets. The named *leaf* accounts underneath are country-specific
prototypes: distinct entities (confirmed by `entity_id`, not just
display name) per prototype (English/German/French/Italian/Swiss
CoA). `getCoaPrototypeAccounts(ledgerName)` surfaces which accounts a
ledger has actually posted to, for the new-business-setup UI's
prototype picker (only works for ledgers with posted history).

A word and its translations stay owned by the one, global Vocabulary
by default; a business's own `Vocabulary` entry is created only for a
structural category, never eagerly for an ordinary leaf account.
`ensureVocabularyAlternate(conceptName, desiredText, businessName,
userId)` (`backend/src/db.ts`, called from `POST
/api/vocabulary-preference`) is the one mechanism that creates a
business-local alternate name, only when the requested text isn't
already a known entity anywhere.

## Bank accounts × currencies

`nominateBankAccount(businessName, bankAccountName, routingDetail,
accountNumber, userId)` stores a nominated bank account, lazily
creating the business's own `Bank Accounts` area.
`getNominatedBankAccounts(businessName)` lists them back.

`buildBankCurrencyStructure(businessName, headerName, leafType,
selections, userId)` is the shared mechanism behind both "Cash at
Bank" and a partner's own Drawing account: one ticked combination
collapses to a plain account; more than one creates `headerName` as a
structural parent with one leaf per combination, named `"{headerName}
— {bankAccountName} ({currency})"`.

`is_postable_account` means "a genuine descendant of Chart of
Accounts," not "is a leaf" — nothing currently prevents posting
directly to a structural header node once it has leaves underneath.

## Notes to the Financial Statements, and the Business Configuration Report

`addFinancialStatementNote(businessName, noteText, userId)` /
`getFinancialStatementNotes(businessName)` (`backend/src/db.ts`) hold
each business's own free-text disclosures, lazily creating that
business's "Notes to the Financial Statements" area.

`getBusinessConfigurationReport(businessName)` aggregates everything a
business's own setup captured — Name, Addresses, Phones,
Owner(s)/Partner(s), Banking Details, Currencies, Divisions,
Locations, Categories (deliberately never Item Details — see the
Inventory Catalog/Listing reports for those). Reachable via `GET
/businesses/:name/configuration-report` and `/reports/business-configuration`.

## How data actually moves

### No ORM

A real, synchronous SQLite driver is used directly —
`better-sqlite3` under Node and Deno, `bun:sqlite` under Bun (see
`backend/src/sqlite-runtime.ts` and the multi-runtime chapter for the
adapter bridging the two) — never an ORM. No Prisma, no TypeORM, no
Drizzle, no query builder of any kind. Every read and write is a
hand-written SQL string:

```typescript
db.prepare(`SELECT * FROM current_entities WHERE id = ?`).get(id);
db.prepare(`INSERT INTO entity_update (entity_id, name, parent, relation, updated_by)
             VALUES (?, ?, ?, ?, ?)`).run(id, name, parentName, relationName, userId);
```

This is deliberate: the "everything is an entity, reached through one
general tree" model doesn't map onto an ORM's own assumption of one
table per concept with a fixed set of typed columns. Writing SQL
directly keeps that model honest — a query can walk the tree, resolve
a dimension link, or read a historical value exactly as the model
requires.

### Append-only, not mutated in place

Most core tables are append-only. `updateEntity` never runs `UPDATE`
on an entity's own row — it inserts a new row into `entity_update`,
recording the new name/parent/relation alongside who changed it and
when. `current_entities`, what an ordinary query actually reads from,
is itself a computed view over this full history, always resolving to
latest state while the full history of every change remains intact —
this is what makes `getEntityHistory` (an entity's own "History" tab)
possible at all.

Not universal: `account.accountnumber` is genuinely mutated in place
with a plain `UPDATE` — no history of a past account number is kept.
The guiding distinction is whether a past value is worth keeping (an
entity's own name or structural position: yes; an account-number
correction: generally not), not one blanket rule applied everywhere.

### The commit path, concretely — a Structured Editor "Save" click

1. **On screen**: an ordinary Svelte component holds a local,
   in-memory copy of the fields being edited (`editName`,
   `editParent`, `editRelation`) — plain reactive variables, no
   client-side database or cache.
2. **On Save**: the component calls a typed function from
   `frontend/src/lib/api.ts` (`updateEntity(id, { name, parent,
   relation })`) — a thin wrapper around `fetch`, sending an HTTP
   `PATCH`.
3. **The backend route** (`backend/src/routes/entities.ts`) validates
   the request shape (`zod`) and calls the corresponding function in
   `backend/src/db.ts`.
4. **`updateEntity` (db.ts)** runs the SQL above — inserting into
   `entity_update`, never mutating a row in place.
5. **The response**: the backend returns the freshly re-read, current
   state of that entity (`getEntity`, reading back from
   `current_entities`), and the frontend replaces its local copy with
   it — what's on screen always reflects what was actually,
   successfully committed, never just what was optimistically typed.

No separate "ORM layer" at any point: a Svelte component, an HTTP
call, an Express route, a SQL statement — each its own readable
piece.

### `journal_entry_staging` — the one shared staging table

```sql
CREATE TABLE journal_entry_staging (
  reference    TEXT NOT NULL,
  business     TEXT NOT NULL,
  ledger       TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  transdate    TEXT,
  account      TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  memo         TEXT NOT NULL DEFAULT '',
  division     TEXT NOT NULL DEFAULT '(none)',
  ...
);
```

A temporary holding area — every posting function inserts one row per
individual debit or credit line here first, all sharing the same
`reference` + `business` + `ledger` triple, before ever touching a
`journal`/`journal_line` row. Nothing here is posted yet; a trigger
(below) finds every line belonging to one transaction and acts on all
of them together, atomically, in one `INSERT`.

### `post_journal_entry_insert` — the trigger behind every balanced posting

An `INSTEAD OF INSERT` trigger on an otherwise-empty view
(`post_journal_entry`). A posting function's last step is always:
stage every line, then `INSERT INTO post_journal_entry (reference,
business, ledger, user_id) VALUES (...)` — a single-row insert
carrying no financial data itself, just the signal "everything for
this reference is staged, post it now." In order, the trigger:

1. **Refuses to post nothing** — aborts if no staged rows exist for
   this reference/business/ledger.
2. **Refuses to post into a closed period** — checks the most recent
   `period_lock_history` row for this business/ledger; aborts if the
   staged transaction date falls on or before the locked-through date.
3. **Refuses to post an entry that doesn't balance, per currency** —
   groups staged lines by account currency (an account with no
   explicit currency, or one that doesn't exist yet, is its own group)
   and aborts if any group's sum isn't zero. A transaction can span
   currencies (buying EUR with USD is one entry, two independently-
   balanced groups) but can't blend them into one combined sum.
4. **Auto-creates any account that doesn't exist yet.**
5. **Inserts the `journal` header row.**
6. **Inserts every `journal_line` row**, one per staged line.
7. **Updates every affected account's running balance**
   (`balance_minor`), summed per account, in the same trigger
   execution.
8. **Deletes the now-posted staging rows** for that reference/
   business/ledger.

All eight steps happen inside one SQLite trigger body — atomic; there
is no intermediate, half-posted state.

### `post_quantity_movement_insert` — the deliberately separate sibling

A second `INSTEAD OF INSERT` trigger, on its own otherwise-empty view
(`post_quantity_movement`), sharing the same `journal_entry_staging`
table and writing to the same `journal`/`journal_line`/`account`
tables — through its own separate trigger, because a quantity
movement (stock received, dispatched, transferred, written off) is
not a balanced, double-entry transaction: it's a single line against
one product's own quantity-tracking account ("+50 bottles received"),
not a debit-here/credit-there relationship between two accounts.
Forcing it to sum to zero would mean inventing a fake, meaningless
offsetting account. These two triggers are the *only* two paths that
ever write to `journal`, `journal_line`, and `account`; every posting
screen ultimately goes through one or the other.

### Every other `INSTEAD OF INSERT` trigger in the schema

The same mechanism — an otherwise-empty view, backed by a trigger
that does the real work — is used throughout, not just for financial
posting:

| View | What its trigger does |
|---|---|
| `entity_entry` | Creates a brand-new entity |
| `entity_update` | Records a rename/reparent/relation change (append-only) |
| `entity_delete` | Records an entity deletion |
| `account_entry` | Sets an account's account number/currency |
| `contact_entry` | Sets an entity's address/phone/contact-person/payment-terms fields — and a location's city/capacity/timezone and a part's description/unit/UPC/retail price too, since neither is a separate table (below) |
| `translation_entry` | Sets a vocabulary translation |
| `ar_sale_post` / `ar_receipt_post` / `ap_purchase_post` / `ap_payment_post` | Purpose-built shortcuts — each stages its own lines internally, then posts through the same mechanism as `post_journal_entry_insert` |

### Division, location, and part are genuinely just entities — no dedicated table

An entity's own append-only, self-auditing name/parent/relation record
(`entities`) is sufficient on its own — being a division, a location,
or a part is never a reason for a separate `CREATE TABLE`. Three
tables (`division`, `location`, `part`) were introduced this way at
various points in the project's history and have since been removed.

**Where the data lives now:**

- A division's "kind" (cost vs. profit center): a named relationship
  record, `Division Type — {division} → Cost Center` or `→ Profit
  Center` — the same mechanism `Belongs To Division` already uses.
- A location's city, shelving/floor-area capacity, and IANA timezone:
  ordinary per-entity data on `contact` (the general-purpose table
  every party's details already live on), never a dedicated table.
- A location's "kind" (retail vs. warehouse) and billing-address flag:
  named relationship records (`Location Type — {location} → Retail`/
  `→ Warehouse`, `Is Billing Address — {location} → Billing Address`).
- A part's description, unit of measure, UPC, and current retail
  price: likewise ordinary per-entity data on `contact` (prefixed
  `part_description`, `part_unit_of_measure`, `part_upc`,
  `part_retail_price_minor`, to avoid colliding with `contact`'s own
  pre-existing columns).

**Why a named relationship record and not the entity's own
`relation_id` directly**: an entity has only one `relation_id` slot. A
location already uses its own `relation_id` for `Belongs To Division`,
so a "kind" tag can't also live there without silently overwriting it.
A separate, small marker entity sidesteps this, at the cost of one
extra entity per tagged fact.

**`part_source` remains a genuinely dedicated table** — correctly so:
a part sourced from multiple vendors is a real many-to-many
relationship, not 1:1 extension data one entity could hold alone.

**`part_location` and `menu_section`/`menu_link`/`menu_override` did
not belong, and have been removed** — the same class of mistake:
a dedicated table that was also mutated in place, instead of living in
the self-auditing entity tree. A (part, location) pair's quantity on
hand is now a `journal_line.location_id`-tagged posting through
`stageQuantityMovementLine`/`post_quantity_movement` — the same
mechanism Stock Receipt already uses, genuinely append-only. The menu
is just another hierarchy (`Menu` > `Menu Section: X` > `Menu Link: X
— Y`), ordinary entities under `Application`, with a link's target
route as a `setEntityLink` record, `notImplemented`/`isSubheading` as
presence-only marker children, `requiredRoles` as one child per role,
and `sort_order` needing no mechanism at all since `entity_id`'s own
creation order already is the seeded display order.

### Entity retrieval — the core functions everything else is built on

`backend/src/db.ts` holds dozens of exported `get*` functions, most
genuinely specific (`getAgedInvoices`, `getCustomerStatement`,
`getCashPosition`) — each its own query for one particular report or
screen. A small handful underneath all of them are foundational:

- **`getEntity(id)`** — the single most basic read: one row from
  `current_entities`, by id. Nearly every other function that needs
  to confirm something exists, or fetch its current name/parent, calls
  this first.
- **`getEntityTree()`** — the complete current entity table, walked
  from its one root, in hierarchy order, each row annotated with its
  own depth and whether it's a postable account. The Entity Tree
  Editor's direct data source; also the underlying data most tree-
  shaped UI (Business Setup, the Structured Editor, Locations)
  ultimately filters down from client-side, rather than each issuing
  its own separate query.
- **`getRelationship(entityName)`** / **`getEntitiesWithRelationship
  (type)`** — reads an entity's own `relation_id` link, or finds every
  entity pointing at a given relation type. The generic mechanism
  behind "Place of Employment," category links, and every other
  lateral (non-hierarchical) reference in the system.
- **`getContact(entityName)`** — reads the shared address/phone/
  payment-terms/language fields any entity can carry, regardless of
  whether it's a customer, vendor, employee, or location.
- **The "typed child entity" prototype** — `getTypedAddresses`/
  `addTypedAddress`/`deleteTypedAddress` and `getTypedPhones`/
  `addTypedPhone`/`deleteTypedPhone` were, until a refactor, two
  near-identical copies of the same structure, differing only in the
  record-name suffix ("Address" vs "Phone"), the type-category name,
  and how the value itself is saved/loaded. Both now share one real,
  generic implementation — `addTyped<T>`/`getTyped<T>`/`deleteTyped`
  (private, in `db.ts`) — with each public function a thin wrapper
  preserving its own existing external signature. `addTyped<T>`
  creates (or reuses) a direct child entity named `{entityName} —
  {type} {thingSuffix}`, tags it via `relation_id` to the type marker
  entity, then saves its value through a caller-supplied `save`
  callback (always `setContact` today, kept as a callback rather than
  hardcoded so a future typed-thing whose value isn't contact-shaped
  can still reuse this without a further refactor). `getTyped<T>`
  walks the entity's children filtered to the given type category (so
  an address child is never mistaken for a phone child despite
  sharing the same parent/relation shape) and loads each through a
  caller-supplied `load` callback; `typeKey` lets each caller keep its
  own existing field name (`address_type` vs `phone_type`). Contact
  persons (`ensureContactPersonType`/`listContactPersonTypes`) follow
  the identical pattern, genuinely user-definable — a new type is
  created the moment someone types one that doesn't already exist,
  rather than requiring it pre-seeded.

Nearly every other `get*` function is built by composing these —
reading an entity's tree position, its relation, and its contact
fields, then joining against whatever additional tables
(`journal_line`, `part`, `account`) a particular report needs.

## `backend/src/db.ts` — the data model, write primitives, and the Hierarchy/Product cartesian mechanism

### The data model in one place

Permanent data lives in two categories: (1) the core double-entry
ledger (`entities`, `journal`, `journal_line`, `account`) — the only
permanent record of what financially happened; and (2) permanent side
data that cannot live in (1) because a journal line has no field for
it — who a user is and what they're allowed to do, an entity's own
contact/location/item details, a document's lifecycle distinct from
its underlying posting, physical count records, templates,
translations, period-close history. Transient staging data
(`journal_entry_staging` and the screen-specific `*_staging` tables)
exists only between a form being filled in and being posted, and is
deleted the moment posting succeeds.

There are exactly three write paths into `journal`/`journal_line`/
`account`, each for a distinct reason:
1. **Ordinary financial postings** (the vast majority): a staging
   table's `INSTEAD OF INSERT` trigger copies rows into
   `journal_entry_staging`; inserting into `post_journal_entry` fires
   `post_journal_entry_insert`, which validates the entry balances
   (per currency), the period is open, then writes
   `journal`/`journal_line`, updates `account.balance_minor`, and
   clears staging.
2. **Quantity movements** (stock received/dispatched/transferred): the
   same staging table, but `post_quantity_movement` instead of
   `post_journal_entry` — a quantity movement is a single line against
   one product's tracking account, not a balanced two-sided
   transaction, so forcing it through the balance check would require
   inventing a fake offsetting account.
3. **Recurring journals**: written directly by `createRecurringJournal`,
   never staged — recurrence is a property of the journal itself, with
   no single moment to balance-check against; each future occurrence
   gets its own check at read time, via the `journal_occurrences` view.

A fourth, much narrower case — `confirmPickedLine`/
`confirmRestockPickedLine` (see "Picking, packing, and dispatch"
below) — writes a bare `journal` row with deliberately no
`journal_line` and no account at all, since a picking-list tick-off
has no financial or quantity meaning; it exists purely as an auditable
"who ticked this, and when" record.

### Entities: append-only, branded types, and the generic creation/lookup primitives

Every entity write goes through `entity_entry`/`entity_update`/
`entity_revoke`, never a raw `UPDATE`/`DELETE` — `supersedeEntity`
closes out the current row and appends its replacement; fields not
given are carried forward from the current row.

`BusinessName`, `LedgerName`, `AccountName`, `UserId`, `EntityId`, etc.
are all branded types (`string & { __brand }` / `number & { __brand }`)
— plain structural typing can't catch a caller silently swapping which
string/number goes where, so branding makes that a compile error. The
`as*` functions are the one explicit boundary where a plain value
becomes branded.

`TypeDescriptor<TBrand>` pairs a compile-time brand with an optional
runtime check (`validate`, for a structural kind like "is this a live
descendant of Items") and an optional `validNames()` (for a
Vocabulary-backed kind like Location Type, checked against before
insertion). `create`/`createEntityRaw` are the generic creation
primitives: both enforce scoped-not-global uniqueness (two siblings
under the same parent can't share a name; the same name is fine under
a different parent — a business, a division, a location, and an
employee can all genuinely be "Springfield" at once). `createEntityRaw`
additionally enforces case-insensitive uniqueness specifically under
the global Vocabulary (so "Tax" and "tax" can never silently fragment
into two words), and gives every real word created under the global
Vocabulary — from *any* code path, not just "Add a new word" — its own
editable English translation row, via `setTranslation`.

`requireEntity`/`requireEntityById` resolve an existing entity against
a `TypeDescriptor`, by default globally (matching genuinely singleton
concepts — Application, Businesses, Vocabulary, Vendors). An optional
`parent` argument narrows this to a scoped lookup — the fix for a
fundamental gap found directly: `create()`'s own uniqueness check was
already scoped, but `fetch()` had no way to honor that on the read
side, so a name repeated per parent (a business's own "Hierarchies")
could only be found via a mangled, business-prefixed name or resolved
ambiguously to whichever row a global lookup happened to return first.

### The business-scoping problem, and `knownRootId`/scoped-lookup fixes throughout

A recurring bug class, found and fixed repeatedly through this file: a
bare, unscoped name lookup (`WHERE name = 'Income'`, `WHERE name =
'Equity'`, `WHERE name = 'Chart of Accounts'`) is only ever safe while
exactly one business exists. The moment a second business exists, it
gets its own separate mirror entity with the same plain name (every
business's Chart of Accounts copies the five top-level report
categories — Asset/Liability/Equity/Income/Expense — as its own
distinct entities; see `copyChartOfAccountsInto`/`instantiateChartOfAccounts`
below), and a bare lookup silently resolves to whichever one a query
happens to return first — frequently the wrong business's.

The fix, applied throughout (`getHierarchy`, `resolveCashAtBankAccount`,
`getChartOfAccounts`, `resolvePostingRoot`, `ensureItemInventoryAccount`,
year-end close, rollover, and more): a `knownRootId`/explicit-id
parameter lets a caller that already knows the correct, business-scoped
entity id bypass the ambiguous name resolution entirely.
`resolveBusinessCoaAccountId(businessName, accountName)` is the shared
helper for this — it walks one specific business's own Chart of
Accounts subtree for a known header name ("Sales Revenue", "Cost of
Goods Sold", "Inventory"), the same business-scoped recursive walk
`post_journal_entry_insert`'s own trigger uses, falling back to the
old bare global lookup only for `admin` (the one legacy,
pre-multi-tenancy business, which never got its own Chart of Accounts
copy at all — `schema/00-core.sql`'s seeded bootstrap business).
`requireGlobalCoaCategory` is the equivalent for resolving a category
under the one true *global* template specifically (never a business's
own copy), via `Application` → the global `Chart of Accounts`.

`getHierarchy`'s own cycle guard (`MAX_DEPTH = 100`) exists because
better-sqlite3 is synchronous and blocking: an unguarded cycle in a
relationship chain (A → B → A) would hang the entire event loop, not
just one request.

### `getEntityTree` and `is_postable_account`

`getEntityTree()` flat-walks the whole entity tree with each row's
depth and a computed `is_postable_account` flag — the correct way to
identify a postable account, never a depth heuristic (several screens'
account pickers once used raw depth and picked up ledgers and
vocabulary words purely by depth coincidence, since e.g. a ledger entity
can sit at the same depth as a real account for unrelated structural
reasons). It deliberately does **not** also require "has no children"
— the proven Product/Tier/Item design has a genuine case where a
postable "Sales" leaf also has its own further child (the tier-level
item entity): an account can be both directly postable *and* a
structural parent for an unrelated purpose at once. "Has children" is
therefore not a safe general signal for "is a header, never postable"
in this codebase.

Sibling ordering is a real, explicit linked list, not a stored
integer: `"{entity} — Display Order"` (via `setEntityLink`) points at
whichever sibling comes immediately after it. An entity with no such
link, and that no sibling points at, is first; one with no link that
something points at is last. Siblings with no explicit link at all
keep today's alphabetical order, appended after every explicitly-ordered
one — a "lazily migrate only once actually touched" design.
`reorderSiblings`/`reorderSiblingsBulk` convert a level from
alphabetical to an explicit chain the first time anything in it is
moved; `getEntityTree`'s own query joins the Display Order link
directly (`display_order_next`) rather than calling `getEntityLink`
once per sibling, which was previously this function's dominant cost
(a confirmed N+1 query problem).

### Relationships, hierarchy links, and entity links — three distinct, similar-looking mechanisms

These three mechanisms look superficially alike (a tagged child
entity, a `relation_id` pointer) but serve genuinely different needs,
and the file is explicit about not blurring them:

- **`setRelationship`/`getRelationship`/`getEntitiesWithRelationship`**
  — for a two-fact relationship ("X is Trustee Of Y"): `entityName`'s
  own `relation_id` points at a lazily-created intermediate record,
  whose `parent_id` gives the type and `relation_id` gives the target.
  A plain report/category tag (COGS, Balance Sheet) is the degenerate
  case of this same shape, where the type entity alone is the complete
  answer. **Writes directly to the source entity's own `relation_id`**
  — safe only when that slot isn't already spoken for by something
  else.
- **`setEntityLink`/`getEntityLink`/`deleteEntityLink`** — for exactly
  that case where the source's `relation_id` slot is already taken
  (a GL account's `relation_id` already carries its CoA-prototype tag;
  a bank account's own currency pairing already depends on it).
  Creates its own separate child entity for the link, so the source's
  `relation_id` is never touched. `setEntityLink` tags the link record
  via `Entity.tag` on *every* call, not just creation — a link
  previously removed by `deleteEntityLink` (which only ever untags,
  deliberately leaving `relation_id` as permanent history) and set
  again later needs that presence tag re-applied, or it stays
  invisible forever; `Entity.tag` is idempotent, so this is always
  safe. `deleteEntityLink` recognizes "deleted" by the *absence* of
  that presence-only tag, never by `relation_id` being null (it never
  is).
- **`setHierarchyParent`/`getHierarchyParent`/`getHierarchyGroups`/
  `getHierarchyAncestorChain`/`getHierarchyChildren`/
  `getHierarchyLinksPointingAt`** — the general, reusable "place this
  entity into any number of equal, independent accumulation paths"
  mechanism from `docs/multi-dimensional-reporting.md`. Built entirely
  on `setEntityLink`/`getEntityLink`. `hierarchyName` is always a
  free-form, caller-supplied string ("Division", "Location", "Reporting
  Manager") — never hardcoded, so one mechanism serves every case. This
  is explicitly **not** the same word as "dimension" in the
  matrix-stock-report/drag-and-drop sense (`definitionDimensions`,
  below) — that's a separate, reserved usage. `getHierarchyAncestorChain`
  walks up to a hard depth cap as a cycle guard, same reasoning as
  `getHierarchy`. `getHierarchyLinksPointingAt` is a guard-rail query
  ("why is this entity reachable from there at all") added after a
  near-miss where a mistaken re-parent went unnoticed because nothing
  made the hierarchy-link path to a target visibly inspectable.

`revokeEntity` only clears `relation_id` (sufficient for every
`relation_id`-based consumer, which already requires a live entity's
`relation_id` to match) — it does nothing for a `parent_id`-based
structural consumer, so a revoked entity additionally gets reparented
to a dedicated `Revoked` holding root under `Application`, closing that
gap for every `parent_id`-based walk at once. Revoking refuses if the
entity has children or journal postings, and specifically refuses to
revoke a business's last-remaining Actual or Budget ledger (every
business must always have both, even a brand-new, empty one with
no postings yet to otherwise block the revoke).

### The Hierarchy / Product cartesian mechanism

Per `docs/cartesian-account-linking-plan.md`, two layers:

- **Hierarchy**: named groupings and values (`Beer` → `Lager`/`Ale`,
  `Storage` → `Hot`/`Cold`), living under one business's own
  `Hierarchy` root — a user-extensible vocabulary of facts, never
  hardcoded (`ensureHierarchyGrouping`/`ensureHierarchyValue`).
- **Product**: one node under a business's `Product` root, holding
  both **Definitions** (`defineProductShape` — an ordered chain of
  dimension names, each paired with the Hierarchy grouping it
  represents, e.g. `[["Item","Beer"],["Storage","Storage"]]`) and
  **Instances** (`ensureProductInstance` — one specific, real
  combination, e.g. Riverside Cellars / Lager / 330ml / can / single /
  Cold). A Product Instance is one single entity directly under
  `Product`, not a chain of intermediate nodes — its identity is a
  flat, ordered JSON array of the Hierarchy values' own stable entity
  ids (`combination_ids`), genuinely rename-safe since `entity_id`
  never changes across a rename (the `entity_update` trigger carries
  `combination_ids` forward on every rename).

New Inventory/Sales/COGS leaves point directly, via `relation_id`, at
a Product Instance's own node — the one shared, canonical identity all
three financial accounts for the same real combination refer back to
(`ensureCombinationAccountLeaf`), rather than each independently
re-deriving the combination. `getCombinationDisplayName` always
recomputes a combination's display name live from `combination_ids`,
never trusting a stored name column — genuinely rename-safe even if
every Hierarchy value in the chain has since been renamed.
`ensureCombinationAccountLeaf` looks up an existing leaf by its
`combination_ids` array matching exactly (never a bare name, since a
combination's own terminal value, e.g. "Cold", can genuinely be shared
by different, unrelated items) and falls back to a bare-name check
too, since a leaf of the same name under the same parent can
genuinely have been created by a completely different mechanism that
never set `combination_ids` at all (e.g. a location's own plain
capacity-tracking account).

Barcode scanning (`climbInstanceTree`, `getCombinationByUpc`) resolves
a scanned UPC directly to its exact combination's `combination_ids`
array, in one lookup — never requiring a cashier to manually pick each
dimension.

### Tier and location as structural leaves, not tags

Per the confirmed design in `docs/multi-dimensional-reporting.md` §10:
a tier (e.g. "Amber Ale 330ml (Bottle)" vs "(Carton)") and a location
are each their own **structural, distinct entity and Sales/COGS leaf**
— never a tag on an otherwise-shared posting, and critically, never by
re-parenting the shared base item. `ensureItemTier` creates a brand-new,
additional tier-level entity alongside the base product, which is left
completely untouched — the direct fix for an earlier, corrupting
attempt where re-parenting the one shared item broke every other
tier's own ability to resolve its own flat posting root
(`resolvePostingRoot`, directly under `Sales Revenue`/`Cost of Goods
Sold` — see `docs/pm-domain-reference.md`). `ensureItemTierLocationLeaf`
mirrors this one level deeper:
`setHierarchyParent(salesAccount, 'Location', locationName, userId)`
is set on the actual posting targets (the Sales/COGS leaves
themselves, since that's what `journal_line.account_id` ever points
at), replacing the retired `journal_line.division_id` tag entirely.
`getLocationForAccount`/`getHierarchyGroupForAccount` are the read-side
structural replacements for that same retired tag.

### Profit Centers

Per `docs/profit-centers-design.md` Phase A/B: a Profit Center is a
**structural subtree nested inside** one business's own CoA — its own
Sales Revenue/COGS/Inventory grouping nodes, one level deeper than the
flat Item leaves `resolvePostingRoot` otherwise posts directly under
(there is no further product-category grouping level in real CoA
structure to be deeper than — Category is a lateral tag now, never
real account nesting), under the exact same shared headers every
business already has — deliberately *not* a second root alongside
Chart of Accounts, so `getBalanceSheet`/`getProfitAndLoss`/
`getBusinessReports`'s existing structural tree walk picks up every
Profit Center's leaves automatically, with no separate reporting path
to keep in sync. The one exception: a Profit Center has no Balance
Sheet of its own except its own Retained Earnings sibling (nested
under the business's one shared Equity — see `computeCloseLines` in
`pm-reports-reference.md`). `resolveProfitCenterGroupNode` is the one
shared mechanism every per-item resolver uses to scope itself to a
Profit Center — disambiguated by the grouping node's own id, since the
same Profit Center name genuinely recurs three times (once each under
Sales Revenue, COGS, and Inventory). `getAccountProfitCenter` walks an
account's parent chain to the nearest ancestor carrying a "Hierarchy:
Profit Center" link — deliberately *not* via the generic
`getHierarchyParent`/`getEntityLink`, since those resolve by a bare
link-record name with no parent disambiguation, which is ambiguous
here for exactly the same three-times-recurring-name reason.

### Chart of Accounts: template vs. per-business instance

Only the five top-level report categories (Asset/Liability/Equity/
Income/Expense) are genuinely global; the real, named leaf accounts
underneath are country-specific prototypes that already exist as
distinct entities (English/generic "Cash and Bank"; German
"Bankkontokorrent"; French "Autres créances"; and so on — confirmed by
distinct `entity_id`, not just display name). `copyChartOfAccountsInto`
is the one shared copy mechanism (used both by `instantiateChartOfAccounts`,
a per-business copy, and the business-type template mechanism): a
prototype-tagged leaf is copied only if it matches the business's
chosen `coaPrototype`; a universal (untagged) leaf is shared as-is,
never copied (copying it too would create a dangerous global
name-duplicate); a non-leaf structural category (Asset, Liability...)
is always copied, and gets its own Vocabulary word copy (never a
`relation_id` link back to the shared word), so a business is free to
rename its own "Equity" without touching the global template or any
other business's copy. "Cost of Goods Sold" is special-cased to always
copy regardless of `coaPrototype` and regardless of demo data, since
its own `relation_id` slot is permanently spoken for by the Gross
Profit report's "COGS" tag rather than a prototype tag — omitting this
case was a confirmed, found bug (a non-`admin` business's COGS
postings silently landed in `operating_expenses` instead of
`cogs_expenses` on every P&L).

`PER_BUSINESS_ROOTS` is the single, consolidated list of every
structural root a new business gets (Locations, Items, Contacts,
Vocabulary, Ledgers, Profit Centers, Hierarchies...) — adding a new
one is a one-line addition there, never a scattered search. Chart of
Accounts is deliberately *not* in that list, since its creation does
real further work (prototype copying) beyond a bare root.
`createBusiness` always creates **two** ledgers (Actual and Budget) —
"Budget is just another ledger" — since every business genuinely
needs both from day one, and sets the fresh Actual ledger as the
business's starting active ledger (`setActiveLedger`).
