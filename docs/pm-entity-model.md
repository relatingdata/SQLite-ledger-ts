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

## Item hierarchies: Category → Product → Item

Items sit under a business-scoped `{business} Items` root (one of
`PER_BUSINESS_ROOTS` — `Locations`, `Items`, `Contacts`, `Vocabulary`,
`Ledgers`, `Profit Centers` — every business gets exactly these six).
An item can sit several real levels deep — a category (`Beer`), a
Product underneath it (`Amber`, conceptual/brand, never itself
sellable), and the concrete, sellable Item beneath that:

```
{business} Items → Beer → Amber → Amber Ale 330ml Aluminum Can (Cold)
```

`listProducts()` finds any entity under Items that is the *direct*
parent of at least one real Item — the level immediately above where
Items sit, regardless of how many broader category levels sit above
that. Each dimension in parentheses (`(Ale)`, `(330ml)`, `(Aluminum
Can)`, `(Cold)`) is a naming convention today, not yet a separate,
structured field per dimension.

Any function walking "up from an item to find its category" must
recognize either the exact global `Items` name or any name ending in
`" Items"` (a word-boundary suffix match, never a loose `endsWith`) —
a hardcoded exact match terminates too early and never reaches a
business-scoped root.

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
- **The "typed child entity" prototype** — `getTypedAddresses`,
  `getTypedPhones`, `getTypedContactPersons`, and their own
  `addTyped*`/`deleteTyped*` siblings. Each is its own separate
  implementation, independently following the same pattern (a direct
  child entity, named `{parent} — {type} {Kind}`, carrying its own
  `relation_id` pointing at a "type" entity) rather than sharing code
  through one common helper — a real, acknowledged reuse gap, not yet
  factored into a shared implementation.

Nearly every other `get*` function is built by composing these —
reading an entity's tree position, its relation, and its contact
fields, then joining against whatever additional tables
(`journal_line`, `part`, `account`) a particular report needs.
