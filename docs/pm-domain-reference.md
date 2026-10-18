# Core Domain Reference

Current-state reference for the domain concepts that sit on top of
the entity model (previous chapter): sessions, scoped uniqueness,
money, identity resolution, translation, contacts, and hierarchies/
multi-dimensional reporting.

## Session-scoped business context

Once a login occurs (or a new business is established), that becomes
the current, connected session's own business (and user) context —
read implicitly by the HTTP layer, not re-sent by the frontend on
every call.

**Built and working**: `backend/src/session-context.ts`
(`SessionContext`, `runInSessionContext`, `setCurrentBusiness`,
`getCurrentBusiness`, `getCurrentUserId`) — an `AsyncLocalStorage`-
backed context primitive. `attachUser` (`auth-middleware.ts`) runs
every request inside it. `setSessionBusiness`/`getSessionBusiness`
(`auth.ts`) persist the current business onto the session entity's own
`detail_json` (alongside `expires_at`), the same real, database-backed
session record `req.user` already comes from — no WebSocket or
persistent connection needed. `POST /api/session/business` is the one
route a person's business selection reaches this session through.

**Deliberate boundary**: this is an HTTP-layer concern only.
`db.ts`/`db-stock.ts`'s own 100+ business-taking functions keep
`businessName` as an explicit, real parameter — they stay pure and
directly testable with no implicit session dependency
(`backend/test/db.test.ts` calls every one of them directly, with no
request or session involved). A route's job is simply to supply the
session's current business as the argument these functions already
expect.

**Not yet done**: converting those 100+ functions to read
`getCurrentBusiness()` instead of taking an explicit parameter is
further, not-yet-started work; nothing in `db.ts` reads the session
context today.

### Auth/user functions (`backend/src/auth.ts` unless noted)

- `listUsers()` / `listRoles()` — every active user, every available role.
- `setUserRoles(userId, roleNames)` / `setUserActive(userId, active)` — admin control over roles/login ability.
- `changePassword(userId, newPassword)` — admin reset, no current password required.
- `changeOwnPassword(userId, currentPassword, newPassword)` — self-service, requires the current password.
- `logout(token)` — closes one session record.
- `getSessionUser(token)` — resolves a live token to its user, `null` if missing/expired/unknown.
- `setOwnPageSize` / `setOwnNumberFormat` / `setOwnDateFormat` — personal display preferences.
- `attachUser` / `requireAuth` (`auth-middleware.ts`) — `attachUser` resolves `req.user` (and the session context) without rejecting; `requireAuth` actually rejects an unauthenticated request.
- `hashPassword` / `verifyPassword` (`password.ts`) — every stored password goes through this; never stored or compared as plain text.

## Scoped uniqueness, and the physical (product × location) recording grid

Two names, sibling and non-sibling, follow one rule:

```sql
CREATE UNIQUE INDEX entities_name_current ON entities(parent_id, name)
WHERE deleted_at IS NULL;
```

Two direct siblings under the same parent can't share a name; the
same name is fine under a different parent or at a different tree
depth — a company, a division, a location, and an employee can all
correctly be named "Springfield" at once.

Only **product** and **location** map to a real, physical, posted-to
account. Division and category are purely computed reporting rollups
— walked at report time from a location's own division-tree parent or
a product's own category-tree parent — never a stored column on the
journal line (`journal_line` has no `division_id` column at all).
Every product, tiered or not, resolves to its own `{Product} —
{Location}` Sales/COGS/Inventory leaf once a location is known
(`ensureItemLocationLeaf`, `ensureItemTierLocationLeaf`).

Purchase Orders and Sales Orders carry an optional `location` field
(delivery/dispatch instructions). AR Sale, Cash Sale, AP Purchase, and
Cash Purchase each carry one location per invoice (not per line — none
of the four have genuine line-item detail beyond an optional single
item). `ensureLocationScopedAccount` generalizes the `{account} —
{location}` pattern for an account with no specific product.

The underlying mechanism (`setDimensionParent`/`getDimensionParent` —
see "Hierarchies," below, for its current, generic name) generalizes
to any further lateral classification with zero new structural code —
a region, a brewer, or any other lateral fact about a product or
location.

## Money: integer minor units, never floating-point

Every monetary value is stored as an integer count of the currency's
own smallest unit (a "minor unit" — not assumed to be "cents," since
not every currency divides the same way: JPY/KRW have none, BHD/KWD
have three decimal places). Every column, function parameter, and
type uses the `*_minor` suffix throughout the backend, frontend, and
tests. `decimalPlacesFor(unitCode)` (`format.ts`) gives the correct,
per-currency scale.

**Known, deliberately unfixed gap**: `parseMinorUnits` (`money.ts`) —
what a typed form amount gets converted into before posting — still
hardcodes `* 100`, correct for 2-decimal currencies only, wrong for
JPY/KRW (should be `* 1`) or BHD/KWD (should be `* 1000`). Tracked in
`docs/TODO.md`.

## Entity identity resolution: scoped lookups, and branded types

An unscoped, bare-name lookup (`SELECT id FROM current_entities WHERE
name = ?`, no `parent_id` qualifier) cannot distinguish two real,
different entities that happen to share a name — this is the single
most common real bug class in this codebase's history. Two real
mechanisms address it:

**ID-alongside-name.** `journal_entry_staging` carries an optional
`account_id` column alongside `account` (the name);
`post_journal_entry_insert`/`post_quantity_movement_insert` both
resolve via `COALESCE(account_id, (SELECT id FROM current_entities
WHERE name = account))` — the direct id is preferred when a caller
has one, falling back to the name lookup for an ordinary, user-typed
value. `createEntity`, `ensureCategoryChain`,
`ensureItemSalesCogsAccounts`, `ensureProductTierPart`,
`ensureItemLocationLeaf`, `ensureItemTierLocationLeaf`,
`ensureItemInventoryAccount`, and `ensureItemLocationInventoryAccount`
all resolve and return a real id alongside the name for this reason.
`resolvePartId` is the shared way to resolve a product's entity id
specifically, confirming its ancestor chain reaches `Parts`.

A number of bare-name lookups remain for structurally singular,
low-collision-risk anchors (`Chart of Accounts`, `Vocabulary`,
`Income`, `Expense`, `Divisions` on the backend; filtering by
`Accounts Receivable`/`Accounts Payable` on the frontend) — not fixed
structurally, since the benefit is marginal for names an ordinary
business would not independently duplicate.

**Branded (nominal) types**, system-wide, for the compile-time risk
one level up (a plain `string` can't stop a caller from passing a
ledger name where a business name belongs):

```typescript
export type BusinessName = string & { readonly __brand: 'BusinessName' };
// ...LedgerName, AccountName, DivisionName, LocationName, EmployeeName,
//    CustomerName, ProviderName, PartName, and more

export function asBusinessName(name: string): BusinessName {
  return name as BusinessName;
}
```

Every `asXxxName` constructor is the one, explicit boundary where an
ordinary string becomes branded — a database read or a zod-parsed
HTTP body is cast exactly once, at the point it's read; every function
downstream carries the correct, branded type automatically. Applied
across the entire backend's business/ledger/account/division/
location/employee/customer/vendor/part parameter surface — confirmed
exhaustively (an empty-result grep for any remaining `(business:
string, ledger: string)` pair), not assumed. A product's own name and
its quantity-tracking account name are often the identical string but
are not the same *kind* — `PartName` is cast to `AccountName`
explicitly, visibly, at the exact point it's staged as a posting line.

## Language-neutral translation

English is a peer language, not a privileged source text. A
language-neutral *concept* entity holds no text of its own; every
language (English included) is a peer with its own vocabulary of
direct child entities — one child per concept it has a word for, that
child's own `relation_id` pointing back at the shared concept. See the
Testing/fixtures chapter and `docs/pm-system-overview.md` for how this
plays out for the application's own UI vocabulary.

```typescript
export function setTranslation(conceptName: string, languageName: string, text: string, userId: UserId): void {
  // creates a new entity named `text` under the language, relation_id -> the concept;
  // replaces any stale prior entity under that language for that concept
}
```

`getVocabularyWords()` — read by the Translations admin screen — finds
a concept as any entity with at least one direct child translation
under any language, not merely a direct child of a `Vocabulary` node
(a word like `Balance Sheet` lives under `Business Reports`, its real
menu parent, not under `Vocabulary` directly).

Two different concepts can genuinely share the same word in the same
language ("Setup" and "Configuration" both translate to
"Configuration" in French). `setTranslation` detects this via the
scoped-uniqueness constraint and logs it as a flagged collision for
further review rather than crashing or silently resolving it.

## Contact types: one contact, any combination of roles

`Contacts` (business-scoped) is the one structural home every
contact's `parent_id` points to, regardless of how many roles it
plays. A "contact type" (`Customer`, `Vendor`, `Employee`, or any
further, user-defined type — itself an extensible Vocabulary concept)
is a named relationship, not a structural parent, since a contact can
genuinely hold more than one type at once:

```typescript
export function setContactType(contactName: string, typeName: string, userId: UserId): void {
  setEntityLink(contactName, `Contact Type: ${typeName}`, typeName, userId);
}
export function getContactTypes(contactName: string): string[] { /* ... */ }
export function getContactBaseAccounts(contactName: string): string[] { /* derives from types */ }
```

Each contact type carries its own base account via the hierarchy-link
mechanism: `Customer` → `Accounts Receivable`, `Vendor` → `Accounts
Payable`, `Employee` → `Accounts Payable` also (payroll owed is a
payable obligation, not a receivable one). A contact's effective base
account(s) are derived, never stored directly.

`Contacts` is deliberately hidden structurally — a person never sees
a generic "Contacts" list or picks "Contacts" as a parent. Every
user-facing screen (Vendors, Employees, Customers) is its own filtered
view through one specific type; creating "a new vendor" means,
underneath: create the contact entity under `Contacts`, then
`setContactType(name, 'Vendor', userId)`. `createContact<TBrand>`
(`backend/src/db.ts`) is the one shared implementation behind
`createProvider`/`createCustomer`/`createEmployee`, consolidated
behind one route (`POST /entities/contact`).

**Open question, not yet decided**: whether two contacts can share one
address/phone record, or whether each must always hold its own,
independent copy even when the values coincidentally match (no
structural sharing mechanism exists today — each `addTypedAddress`
call always creates an independent record).

## Application vocabulary vs. sample business data

Two genuinely different things:

1. **Application vocabulary** — every UI label, button, column
   heading the interface displays, translated through the mechanism
   above. Lives as direct children of one `Vocabulary` entity (plus a
   small, named exception: report names under `Business Reports`,
   translated through the identical mechanism).
2. **Sample business data** — a demo business's own account names,
   product names, customer/vendor names. Wine Retail Business's
   accounts are named in English because it's a modeled Australian
   business, not because they've been translated — switching the
   interface language never changes any of these.

Structurally separate from the very first parent link: vocabulary
lives under `Vocabulary`; a business's own data lives under that
business's own entity. The application's vocabulary translations are
split one-file-per-language (`backend/schema/10-vocab-{english,
german,french,danish,italian}.sql`); Wine Retail Business's sample
data currently still lives inside `00-core.sql` itself rather than its
own file (a flagged, not-yet-done cleanup).

## Hierarchies and multi-dimensional reporting

A single leaf account is reachable via more than one independent,
equally-valid accumulation path to the same business root — e.g. a
division/location path and a product-category path for the same
"Amber Ale 330ml — Sales" leaf. Neither path is the account's "real"
`parent_id` with the other as secondary; both are genuine, complete,
independent summation paths, and a leaf's own name never encodes
which hierarchy it's being viewed through (the *path* carries that
meaning, not the *name*).

`parent_id` gives exactly one such path for free (whichever dimension
is chosen as the entity's structural placement — for a GL account,
that's the Chart of Accounts/product-category placement). Every
further, equal dimension needs its own real, separate, reversible
index, independent of `parent_id`:

```typescript
export function setEntityLink(entityName: string, linkType: string, targetName: string, userId: UserId): string {
  // creates "{entityName} — {linkType}" as a child of entityName, relation_id -> targetName
}
export function setHierarchyParent(entityName: string, hierarchyName: string, parentName: string, userId: UserId): void {
  setEntityLink(entityName, `Hierarchy: ${hierarchyName}`, parentName, userId);
}
// getHierarchyParent / getHierarchyChildren / getHierarchyAncestorChain /
// deleteHierarchyParent / getHierarchyLinksPointingAt complete the set.
```

Since the record name includes the hierarchy name, one entity can hold
any number of independent, coexisting hierarchy links, none of them
touching the entity's own `relation_id` (which stays free for whatever
else it already means to that entity). **"Hierarchy link"** is the
correct, current term for this mechanism; **"dimension"** is reserved
for two unrelated things — `definitionDimensions` (a product's own
variant axes: Size/Pack/Color) and the drag-and-drop hierarchy editor.

**"Division" is not a privileged concept anywhere in the code.**
Everything that once had Division-specific naming has been
generalized to take an ordinary, business-chosen hierarchy name as a
parameter:

- `getHierarchyGroups(hierarchyName)`, `getHierarchyGroupForAccount(accountName, hierarchyName)`, `getHierarchyGroupForLocation(locationName, hierarchyName)`
- `getProfitAndLossByHierarchy(business, ledger, hierarchyPath, ...)`, `getProfitAndLossForHierarchyGroup(business, ledger, hierarchyPath, groups, groupName, ...)`, `getProfitAndLossByHierarchyTree(business, ledger, hierarchyPath, hierarchyName, ...)`
- `getLedgerBalancesByHierarchyStructural(business, ledger, hierarchyPath, fromDate?, toDate?, excludeCloseEntries?)` — resolves each account to its group by walking `hierarchyPath` (an ordered list of hierarchy names) one `getHierarchyParent` hop at a time; `['Location']` for a one-hop breakdown, `['Location', 'Division']` for a two-hop one.
- `closeBooks`/`previewCloseBooks`/`computeCloseLines` take an explicit `hierarchyPath: string[] = []`; their result's informational summary field is `groupBreakdown`, not `divisionBreakdown`.
- `MatrixAxis` is `'Product' | 'Category' | 'Location' | 'Consolidated' | (string & {})` — no fixed `'Division'` member; `resolveKey`'s fallback tries a hierarchy-parent lookup on the product, then its location, for any axis name not already structurally known.
- The frontend's generic `HierarchyGroupTreePicker.svelte`/`HierarchyGroupPLNode.svelte`/`HierarchyGroupTreeNode.svelte` each take a `hierarchyName` prop; the matrix-report pages read a business's configured hierarchies live (`getHierarchy`/`getAxisValues`) rather than hardcoding `'Division'` in an axis list.
- A business that names a hierarchy "Division" gets identical reports, close-books breakdown, and org-chart grouping as before — nothing privileges that one name over any other a business might choose.

`getOrganizationChart`'s own HR-specific relationship is a separate
mechanism (`Belongs To Group`, formerly `Belongs To Division`) — a
genuinely different concern from the reporting hierarchy above; a
single-location "division" with no separate division entity of its
own is picked up as either a `Belongs To Business` target, or any
target of a `Belongs To Group` relationship whose own locations trace
back to that business.

`getHierarchy(rootName, relationshipType?)` is the one, generic
tree-builder for any hierarchy — plain structural nesting
(`parent_id`), a named relationship, or, in the genuine edge case
above, both at once.

### The product/tier/leaf structure

A product that is sold in more than one real unit (Bottle, Carton,
Six-Pack, each at its own price) is a non-sellable, non-postable
summary node with one real, separate, sellable leaf per tier:

```
Amber Ale 330ml            (a summary category — never sold, never postable)
    ├── Bottle              (a distinct, sellable leaf — own price, own UPC)
    ├── Carton              (a distinct, sellable leaf — own price, own UPC)
    └── Six-Pack            (a distinct, sellable leaf — own price, own UPC)
```

`ensureProductTierPart` creates a new, additional, distinct tier-level
part alongside the existing base product (never re-parenting the
shared, ambiguous one — re-parenting breaks the moment a product has
more than one tier, since the second tier can no longer walk back to
its own category chain). Wired into the live POS sale posting path.
The `real_accounts` recursive CTE (`getLedgerBalances` and relatives)
stops walking the moment it reaches an entity with a real `part` row —
never descending into that part's own quantity-domain children
("On Order"/"Units Sold"), which would otherwise corrupt a Trial
Balance/Balance Sheet total with unit counts instead of money.

### "Header Account": the Accounts Receivable/Payable case

A Vocabulary word (`Customers`, `Vendors`) stays structurally under
`Vocabulary` — its own real, correct, structural home — while
additionally reaching `Accounts Receivable`/`Accounts Payable` via a
hierarchy link named `Header Account`. `getBalanceSheet` discovers
this generically via `getHierarchyChildren('Accounts Receivable',
'Header Account')`, never a hardcoded name check. The general
principle: an entity's single, structural `parent_id` should always
reflect its genuine structural identity; wherever a report needs an
entity to "also" belong somewhere it doesn't structurally live, the
hierarchy-link mechanism is the tool, never a second, competing
`parent_id`.

## A live, generated snapshot

`docs/entity-chains.md` is a generated (not hand-written) snapshot of
the live entity tree after a full-year simulation — every name, count,
and chain in it is read directly off a real database at generation
time. Regenerate via `node --import tsx
backend/scripts/generate-entity-chains-doc.ts` after any structural
change, rather than trusting a stale copy; it is not duplicated here
since it would go stale the moment this file isn't updated in lockstep.
