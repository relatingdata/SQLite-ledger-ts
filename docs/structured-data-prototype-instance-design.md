# Structured data via prototype/instance — replacing `detail_json`

## The problem, stated precisely

`detail_json` is a generic JSON bag with no structural notion of what fields a given kind of thing
is allowed to have. A contact, an address, a phone, an item, a location — each reads and writes an
arbitrary set of named keys with no schema enforcing which keys are valid, which are required, or
what a different country's own address format should even contain. A per-country postal address
(US: street/city/state/zip; UK: street/town/county/postcode; a third country entirely different
again) cannot be expressed as "the shape" at all under this design — only as whatever keys a given
caller happened to write.

## The real, already-established pattern this must follow

**Correction, added later**: `getPrototypeOf`/`setPrototype` (quoted below as this proposal
originally found them) were removed from `backend/src/db.ts` — they had zero real callers anywhere
in the codebase, and the Hierarchy mechanism they were meant to serve shipped on a different,
link-based design instead (`setHierarchyParent`/`getHierarchyParent`, built on `setEntityLink`; see
`docs/general-typed-hierarchy-resolution-plan.md`'s own correction note for the full account). This
proposal was never built, so nothing here depends on the removal — but if it's revisited, it needs
a different real primitive for "what prototype does this node represent," most directly a plain
`relation_id` write via `supersedeEntity`/`updateEntity` (the same mechanism `setPrototype` itself
was a thin wrapper over), not a call to either removed function.

`getPrototypeOf`/`setPrototype` (`backend/src/db.ts`, documented in
`docs/general-typed-hierarchy-resolution-plan.md`) already solve exactly this class of problem for
Hierarchies: *"identity by what a node points at, not by depth or a compile-time type."* A real
node's own `relation_id` names which real prototype it is an instance of —

```typescript
export function getPrototypeOf(entityName: string): string | undefined {
  const row = db.prepare(
    `SELECT proto.name FROM current_entities e JOIN current_entities proto ON proto.id = e.relation_id WHERE e.name = ?`
  ).get(entityName) as { name: string } | undefined;
  return row?.name;
}
export function setPrototype(entityName: string, prototypeName: string, userId: UserId): void {
  updateEntity(resolveIdOrThrow(entityName), { relation: prototypeName }, userId);
}
```

Per direct instruction, this same mechanism — not a new one — is what arbitrary structured data
must be built on.

## The design

**A prototype defines a shape as its own real, named children.** `"US Address"` is a real entity
whose own real children are `"Street"`, `"City"`, `"State"`, `"Zip Code"`. `"UK Address"` is a
wholly separate real entity with its own real children `"Street"`, `"Town"`, `"County"`,
`"Postcode"`. A field slot can be tagged `Entity.tag(fieldSlot, 'Required', userId)` to mark it
required — the same, real, presence-only tag mechanism `docs/skill-no-name-encoded-values.md`
already established, not a new one.

**An actual address is a real instance, never a row with named columns.**
`setPrototype(thisAddress, 'US Address', userId)` — its own `relation_id` says what kind it is,
exactly like a Hierarchy prototype today. Its own field *values* are real, named children
mirroring the prototype's own field-slot names, using the same `Entity.setAttr` shape:
`thisAddress > "Street" > "123 Main St"`.

**This is structural validation for free.** A value with no name matching one of its prototype's
own real children is, by construction, not a real field of that address type — there is nothing
further to enforce by hand.

**No JSON anywhere in this design.** The prototype's own shape, the instance's own type tag, and
every one of its own field values are all real, named entities — the same three primitives
(`Entity.tag`, `setPrototype`/`relation_id`, `Entity.setAttr`) used everywhere else, not a fourth,
JSON-based mechanism introduced for this one case.

## Scope: what this replaces, and what it doesn't yet

Targeted first at `TypedAddress`/`TypedPhone` (`backend/src/db.ts`, currently `detail_json`-backed
views) — real, per-country address/phone formats are the motivating case directly raised. Contact
fields (`person_name`, `payment_terms_days`, etc.), item fields (description, UPC, retail price),
and location fields (capacity, timezone) are the same class of problem and candidates for the same
design, but are explicitly **not** assumed to be covered by this document until each is scoped and
built as its own, separate pass — this is a large, foundational change and is being done
deliberately, one step at a time, matching direct instruction given earlier.

## Implementation plan

1. **Seed the real address/phone prototypes** as real entities under a real, dedicated root (e.g.
   `Vocabulary > Address Types > "US Address" > Street/City/State/Zip Code`), each field slot
   tagged `Required` where applicable, matching `seedDefaultHierarchyPrototypes`'s own, established
   shape exactly.
2. **Build `createTypedAddress(ownerName, prototypeName, fields: Record<string, string>, userId)`**:
   resolve the prototype, validate every `Required` field slot's name is present in `fields`,
   create the instance entity under the owner, `setPrototype` it, then `Entity.setAttr` each
   provided field.
3. **Build `getTypedAddresses(ownerName)`**: for each instance child of the owner, read
   `getPrototypeOf` and, for each of that prototype's own real children, `Entity.getAttr` the
   matching value — returning a real, typed shape per real prototype, not a generic bag.
4. **Migrate every existing caller of `addTypedAddress`/`getTypedAddresses`/`addTypedPhone`/
   `getTypedPhones`** (confirmed call sites: `db.ts` itself, and every route/page reading a
   contact's addresses/phones) onto the new functions, one call site at a time, verifying
   compilation after each.
5. **Retire the `detail_json`-backed `TypedAddress`/`TypedPhone` views and interfaces** only once
   every caller is migrated and the full suite is green against the new shape.

## Testing plan

- A real, direct unit test per country format: create a `"US Address"` instance and a
  `"UK Address"` instance for two different real owners, confirm `getTypedAddresses` returns the
  correct, distinct field set for each — never one bleeding into the other's shape.
- A real, direct test that creating an instance missing a `Required` field slot is rejected with a
  clear error naming which field is missing.
- A real, direct test that renaming a prototype's own field-slot name (e.g. `"Zip Code"` →
  `"ZIP"`) does not silently orphan existing instances' own values — confirming whatever the real,
  chosen behavior is (migrate forward, or flag as stale) rather than leaving it undefined.
- Full backend suite green (`make test`) before and after each migration step in the implementation
  plan above, not just at the end.
- API-first per the established discipline (`docs/skill-backend-first-testing.md`): every new
  function proven directly against the database before any frontend page is touched.
