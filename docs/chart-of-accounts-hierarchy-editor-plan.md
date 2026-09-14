# Chart of Accounts Hierarchy Editor — Requirements, Current State, and Implementation Plan

A real, direct plan for letting a user reshape their own Chart of Accounts hierarchy through the real interface, rather than only through the Entity Tree Editor's own, more generic screen — covering what's already possible today, and what a purpose-built editor would still need to add.

## Requirements, as captured directly

Per direct instruction, this is a standard hierarchy/tree editor for
the Chart of Accounts, expected to support:

1. **Expansion of levels** — already exists today (the external
   `@keenmate/svelte-treeview` library already used by
   `setup/chart-of-accounts`).
2. **Insertion of real, distinct account/line types**, not just plain
   accounts:
   - **Header** — a non-postable, structural grouping line.
   - **Total / Sub-total** — a real, computed rollup of the accounts
     beneath it.
   - **Descriptive line** — a real, non-postable line that exists only
     to label or annotate, with no balance at all.
   - **Ordinary posting account** — a real, leaf account that
     transactions can actually post to (what "postable" already means
     today).
3. **A currency the account will hold** — already exists as a real,
   per-account field (`account.currency`, confirmed directly against
   the schema last turn); the editor needs a way to *set* it on a
   leaf/posting account, not invent the concept.
4. **Insert and Delete keys** for adding/removing entries — the same,
   established interaction pattern already used throughout this
   codebase (`TypedList.svelte`'s own Insert/Delete convention).
5. **A real, workflow assumption**: the Chart of Accounts is prepared
   *before* a business starts trading and posting — not something
   restructured casually mid-year. The one, real, anticipated
   exception: splitting one posting account into two or more (e.g.
   separating a single "Bank Fees" account into per-bank-account
   fee lines), typically surrounded by a new header/sub-total, with
   the original balance transferred to the new structure via a real
   General Journal entry — a workflow already discussed and already
   supported by this application's own existing journal-entry
   mechanism, not something the editor itself needs to automate.
6. **Multi-select and reordering within a level** — select one or more
   accounts at the same level (highlighting), and move them up/down
   within that level. This should be a standard feature of the
   editor, not an afterthought.

## What already exists, confirmed directly (not assumed)

- **`getEntityTree()`** (`backend/src/db.ts`) already returns the
  whole hierarchy, including a computed `is_postable_account` flag —
  true only for a Chart-of-Accounts leaf entity with no `contact`
  record of its own (the same mechanism that distinguishes a real
  posting account from a vendor/customer entity elsewhere in the
  tree).
- **`account.currency`** already exists per-account, `NULL` meaning
  "this account's own home/reporting currency."
- **`createEntity`/`updateEntity`/`deleteEntity`** already exist and
  already handle the general entity-tree mutations the editor will
  need to call.
- **Per-currency journal balancing** is already enforced at the
  database trigger level (`post_journal_entry_insert`), confirmed
  directly last turn — the balance-transfer workflow in requirement 5
  above needs no new backend work.
- **What does *not* yet exist, confirmed directly**:
  - No explicit account/line **type** column distinguishing
    Header/Total/Descriptive/Posting — today's schema only has the
    computed, binary `is_postable_account`.
  - No explicit **sort-order** column on `entities` — `getEntityTree`
    orders by `(depth, name)`, i.e. alphabetically within each level.
    Reordering (requirement 6) is not possible against today's schema
    without a new column.

## Uses / called by

- **`setup/chart-of-accounts/+page.svelte`** is the current, real
  editor page — already uses the external tree-view library, already
  supports add-child/rename/delete against a single selected node.
  This is the page this plan replaces/extends, not a new route.
- **`reports/balance-sheet`, `reports/profit-and-loss`,
  `reports/trial-balance`** (and every other report walking the Chart
  of Accounts) read `getEntityTree()`'s own output directly — any new
  `line_type` column must default in a way that doesn't change what
  these reports already compute for existing accounts (a Header/Total
  distinction is additive information for the editor's own purposes;
  the reports' own real math already derives "is this postable" from
  existing structure, and should keep doing so unless a report is
  deliberately taught to use the new, explicit type instead).
- **`post/+page.svelte`** (General Journal entry) already reads
  `account.currency` per line, confirmed last turn — no change needed
  there; a new posting account created through this editor is already
  visible correctly the moment it's created, via the same, existing
  mechanism.

## Implementation plan

### Backend (implemented — see the relationship-based design below)

**Correction, made directly during implementation**: the schema
section below originally proposed new columns on `entities` (before
being corrected further to a genuinely new table, `entity_display`).
Both were rejected per direct instruction — no new tables, ever.
The actual implementation instead reuses this codebase's own,
already-proven `setEntityLink`/`getEntityLink` relationship mechanism
(see `docs/entity-model.md`), the same real primitive already used
for dimension links elsewhere:

- **Line type**: a real relationship named `"Line Type"` from the
  account entity to a real, pre-seeded type-marker entity (`Header`,
  `Total`, `Descriptive`, `Posting`, each a real, ordinary entity
  under a new `Chart of Accounts Line Types` parent — the same,
  established, user-amendable pattern already used for Address Types
  and Phone Types). `setLineType`/`getLineType`/`listLineTypes` in
  `backend/src/db.ts`.
- **Display order**: a genuine linked list, per direct instruction —
  a real relationship named `"Display Order"` from one sibling to
  whichever real sibling comes immediately after it in display order.
  An entity with no such link, and that no other sibling points at,
  is the real first item. `reorderSiblings`/`reorderSiblingsBulk` in
  `backend/src/db.ts` re-link the whole real chain to reflect a move;
  `getEntityTree()`'s own query fetches the flat tree in today's
  exact, existing alphabetical order, then a `orderSiblingsByDisplayOrder`
  post-processing pass (in TypeScript, since a linked list can't be
  expressed in a plain SQL `ORDER BY`) re-orders each real level that
  has an explicit chain, leaving every other level exactly as it
  already was.

No schema migration at all — `setEntityLink` already creates its own,
real child entities under the existing `entities` table, the same
shape every other relationship in this codebase already uses.

API: `GET /entities/line-types`, `PUT /entities/line-type`,
`POST /entities/reorder` (accepts either one id or several, routing
to the single or bulk function accordingly).



### Frontend

- Extend `setup/chart-of-accounts/+page.svelte`'s own existing
  add/edit form with a `line_type` select (Header / Total /
  Descriptive / Posting), and — only when Posting is selected — the
  existing currency field.
- Multi-select: track a real `Set<number>` of selected entity ids at
  the currently-open level (not global — a real, deliberate scope
  limit, since moving items only makes sense among true siblings).
  Click toggles membership in the set (matching Insert/Delete's own
  keyboard-first convention already used elsewhere, extended here
  with a real, standard Shift-click-range and Ctrl/Cmd-click-toggle,
  the same real convention any desktop file manager already uses).
- Up/Down: two real, new buttons (or keyboard shortcuts) that call
  `reorderSiblingsBulk` with the current selection.

## Honest scope note

This is real, substantial new work — a new schema column, several new
backend functions, and non-trivial frontend selection/reordering UI —
not a quick pass. This plan is written to be implemented incrementally:
the schema and `line_type` support can land and be useful (a real,
visible Header/Total/Descriptive distinction) before multi-select
reordering exists at all, and reordering itself can land using
single-item up/down before multi-select is added on top of it.
