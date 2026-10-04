## No name-encoded values, no wildcards, no JSON

### The problem, found directly across this codebase

A real, repeated pattern, found independently in at least nine places: a real fact about an
entity — a lead time in days, a BOM quantity and unit, a dependency type, which of several real
kinds a child link is, a shift's open/closed status — was encoded directly into that entity's own
name (`"{item} — Lead Time: {vendor} (30 days)"`), then parsed back out with a regex or `.slice()`,
and found again later with a `LIKE '%...'` wildcard. This is fragile in three, separate, confirmed
ways: a changed value produces a genuinely different name (so "update" silently creates a second,
duplicate link rather than replacing the first — confirmed directly, a real test once showed 3 BOM
components where 2 were posted); a component name containing `_` or `%` collides with the wildcard
syntax itself (`Motor` matches `Motor (2200KV)`'s own link, confirmed directly in section 3.2 of
the BOM design); and a reference-naming convention that quietly changes elsewhere (a rename, a
retired suffix) silently breaks every `LIKE` built against the old one, with no compiler error to
catch it — confirmed directly: `db-journal.ts`'s own `NOT LIKE '%-QTY'` filter had already gone
stale this way before being found.

One further, separate case was found at the schema level, not just in TypeScript: the `item_source`
SQLite view itself (`backend/schema/00-core.sql`) was defined as
`WHERE e.name LIKE '% — Source — %'` — the identical pattern, baked into the database schema.

### The one, real replacement: `Entity.tag` / `Entity.setAttr` (`backend/src/primitives.ts`)

No JSON of any kind, except the one, separately documented exception (`combination_ids`, §10 of
`docs/storage-space-as-currency-design.md` — a flat array of real Hierarchy value ids, never
names, never an arbitrary field bag). Every other real fact is a real, named child entity:

```typescript
Entity.tag(id: number, tagName: string, userId: UserId): void
```
A real, presence-only marker — a named child entity with no further meaning beyond existing.
Classifies *what kind* of thing an entity is (a role link, a BOM-component link, an open shift)
without touching that entity's own name or any JSON field. Found later by an exact
`(parent_id, name)` match:
```sql
JOIN current_entities tag ON tag.parent_id = rec.id AND tag.name = 'BOM'
```

```typescript
Entity.hasTag(id: number, tagName: string): boolean
```
Presence check for the same marker — used for a yes/no fact where the tag itself is the whole
answer (a shift is "open" exactly when its own `Open` tag still exists; signing off deletes it).

```typescript
Entity.setAttr(id: number, attrType: string, value: string, userId: UserId): void
Entity.getAttr(id: number, attrType: string): string | undefined
```
One real, single-valued fact (a quantity, a date, a dependency type) as its own, real, named
grouping child, with the actual value as *that* grouping's own single child — e.g.
`shiftEntity > "Signed Off At" > "2026-10-04T10:15:00Z"`. `setAttr` replaces the grouping's child
in place on each write, matching the already-established "detail record" design elsewhere in this
codebase — a changed value is never a second, duplicate fact sitting alongside the first.

### The seven real conversions, each the same, one pattern

| Mechanism | File | Before | After |
|---|---|---|---|
| Lead Time | `db-stock.ts` | days in the link's own name, regex-parsed | `Entity.tag(..., 'Lead Time')` + `Entity.setAttr(..., 'Days', ...)` |
| BOM | `db.ts` | quantity+unit in the link's own name, regex-parsed | `Entity.tag(..., 'BOM')` + `setAttr('Quantity')`/`setAttr('Unit')` |
| Task Dependencies | `db.ts` | dependency type in the link's own name | `Entity.tag(..., 'Dependency')` + `setAttr('Dependency Type')` |
| Role links | `auth.ts` | `LIKE '% — Role — %'` on the link's own name | `Entity.tag(..., 'Role')`, matched exactly |
| Open Shift | `db.ts` | `"— Open"` / `"— Closed at {time}"` name suffix | `Entity.tag(..., 'Open')` (removed at sign-off); `signed_on_at` reuses the shift entity's own, already-real `created_at`; `signed_off_at` is its own `setAttr` |
| Item Source | `db.ts` + the `item_source` **schema view** | `LIKE '% — Source — %'`, in both TypeScript and SQL | `Entity.tag(..., 'Item Source')`; the view's own `WHERE` clause became a real `EXISTS` check against that same tag |
| Preference scope | `db.ts` | `scope`/`scopeId` parsed out of the preference's own name | `scope` ('user'/'business') is itself a real `Entity.tag`; `scopeId` is a real `setAttr('Scope Id', ...)` |

Every reverse lookup (`getItemLeadTimes`, `getBomComponents`, `getTaskDependencies`,
`getUserRoleNames`, `getActiveShiftsAtLocation`, `getOpenShiftForEmployee`, `getLocalizedText`)
joins on the real tag/attribute child directly — no `LIKE`, no regex, no JSON field, in any of the
seven.

### What this does not yet cover

`detail_json` remains the real, extensive, separate storage mechanism behind `contact` (every
person/address/phone field), `item` (description, UPC, retail price), `location`
(bottle/carton capacity, timezone), and `invoice`/`invoice_line`/`payment` — the application's own,
foundational "any entity can carry arbitrary typed fields" design, not something introduced by or
fixed in this chapter. Converting that onto the same `Entity.tag`/`setAttr` shape is a separate,
much larger, not-yet-scoped piece of work, not assumed to be covered by anything above.
