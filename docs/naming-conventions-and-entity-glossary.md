# Naming Convention Glossary, and Type vs. Instance in the Entity Tree

A real, direct explanation of the naming patterns used consistently
throughout this codebase, so a new name can be read correctly on
sight, and a new function can be named consistently with what already
exists — checked directly against real, existing code, not asserted
from memory.

## Verb prefixes — what each one really, consistently means

- **`get`** — a real, read-only query. No side effects, ever. Returns
  data (or `undefined`/`null` if not found).
- **`list`** — a real, read-only query returning a plural collection
  (`listItems`, `listLocations`, `listItemSources`).
- **`set`** — a real, idempotent upsert. Calling it twice with the
  same input leaves the same, real end state — never throws for
  "already exists" (`setLocation`, `setContact`, `setAccountCurrency`).
- **`create`** — must **not** already exist; throws if it does. Strict,
  one-time creation (`createEntity`, `createBusiness`, `createItem`).
- **`ensure`** — lazily creates only if missing, returns the existing
  one otherwise — idempotent creation, the middle ground between
  `create` (strict) and `set` (always overwrites)
  (`ensureItemQuantityAccounts`, `ensureLocationCapacityAccount`,
  `ensureAddressType`).
- **`add`** — adds a new item to a real collection; some real variants
  are add-or-update (`addOrUpdateItemSource`), stated explicitly in
  the name when they are.
- **`delete`/`remove`** — removes something real. `delete` for an
  entity or a real database row; `remove` reserved for lateral
  relationships specifically (`removeContactType`).
- **`stage`** — prepares real data for a **later**, separate `post`
  call — the real, established two-step pattern for every real
  transaction in this codebase (`stageLine`, `stageBomComponent`,
  `stagePurchaseOrder`).
- **`post`** — commits a real, final, irreversible transaction, usually
  to the journal/ledger (`postJournalEntry`, `postInvoice`,
  `postBomComponents`).
- **`complete`** — a real, atomic, multi-step business transaction that
  internally stages *and* posts *and* handles other, real, related
  side effects in one call (`completePosSale`, `completeStockTake`,
  `completeCashPurchase`) — the real, single entry point a UI screen
  actually calls, as opposed to `stage`/`post`, which are the lower-
  level primitives `complete*` functions are built from.
- **`resolve`** — looks up or computes the one, real, correct value
  from among several real, possible sources or a real, structural
  chain (`resolveItemId`, `resolveDispatchLocation`,
  `getEffectiveSaleCurrency`'s own real precedence chain).
- **`is`/`has`/`verify`** — a real, boolean check or confirmation.

## Noun patterns — what a name's own shape tells you

- **`{Product} — {Real Purpose}`** (an em-dash, not a hyphen) — a
  real, per-product or per-location *account*, lazily created under
  its own, real, owning entity: `Amber Ale 330ml — On Order`. (A
  location's storage capacity no
  longer follows this pattern: it is a nested `Storage Capacity` →
  `Remaining` / `Installed` / `Occupied` structure; see
  `docs/storage-space-as-currency-design.md`.) The text after the
  dash is always a real, specific GL/tracking purpose, never a
  generic label.
- **`{Concept} Type` / `{Concept} Types`** — a real, user-extensible
  Vocabulary word marking a *kind* of something (`Location Type`,
  `Address Types`, `Division Type`) — never a fixed, compile-time enum.
  Singular when it names one, real, specific marker link
  (`Location Type — X → Retail`); plural when it names the real,
  shared container every real instance of that type lives under
  (`Location Types` → `Retail`, `Warehouse`, `Wine Bar`).
- **`{Business} {Concept}`** — a real, per-business container, created
  fresh by `createBusiness` for every new, real business
  (`{Business} Locations`, `{Business} Items`, `{Business} Contacts`)
  — see "Type vs. Instance" below for why this exists at all.

## Type vs. Instance in the entity tree — per business, and at the real, application root

Two, real, distinct kinds of entities live in the same, single entity
tree, distinguished only by *where* they sit, never by a separate
mechanism:

- **Real, application-root, shared "type" entities** exist exactly
  once, globally, shared by every real business — `Vocabulary`,
  `Location Types`, `Address Types`, `Phone Types`, `Currencies`.
  These are the real, closest equivalent to a "class" or "enum
  definition" — genuinely singular, never duplicated per business.
- **Real, per-business "instance" containers** are created fresh, once
  per real business, by `createBusiness` — `{Business} Locations`,
  `{Business} Items`, `{Business} Contacts`. A specific, real location
  (`Riverside Cellars`) is a real *instance*, living under its own
  business's own, real, private container — never the shared, global
  one.
- **The link between them**: a specific, real instance's own *type*
  is never copied or duplicated — it's a real, lateral `relation_id`
  link pointing back at the one, shared, root-level type entity (see
  "Parent link vs. sibling link" below). `Riverside Cellars` doesn't
  have its own, private copy of "Retail" — it has a real
  `Location Type — Riverside Cellars → Retail` marker entity whose own
  `relation_id` points at the one, single, real, shared `Retail`
  entity under the root `Location Types` container.

This is the real, structural reason two different, real businesses can
each have their own "Springfield" location without colliding, while
still both genuinely being of the exact same, single, shared "Retail"
type — the *name* is scoped per business (a real parent-link fact);
the *type* is shared globally (a real relation-link fact).

## Parent link vs. sibling (relation) link — the real, fundamental distinction

- **`parent_id`** is the real, **structural, hierarchical** fact:
  "this entity genuinely lives inside/under that one." Walking
  `parent_id` upward always answers "where does this real thing
  belong" — a location under its business's own Locations container,
  an account under its own owning product or location.
- **`relation_id`** is the real, **lateral, non-hierarchical** fact:
  "this entity is *related to* / *refers to* / *is a translation of*
  that one" — never a structural home, always a real, separate,
  same-level cross-reference. A translation's `relation_id` points at
  its Vocabulary concept; a product's Sales account's `relation_id`
  points at its own COGS Product; a location instance's own type
  marker's `relation_id` points at the shared, root-level type entity.

The real, practical test: if removing the link would leave the entity
with nowhere to structurally live, it's a parent link. If the entity
would still have a perfectly real, valid home without it, and the link
only supplies an extra, cross-cutting fact about it, it's a relation
link.

See `docs/source-reference.md` (regenerate via `make source-reference`)
for the real, generated, complete index of every function, type, and
file this glossary's own naming conventions apply to.
