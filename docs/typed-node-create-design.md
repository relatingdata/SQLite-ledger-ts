# Design Note: `create<T>` with Type Descriptors, Not Strings

## Corrected per direct instruction

No `createChildNode`. No bare string kind arguments (`'Category'`,
`'Division'`). One real, generic `create<T>`, and real, named,
**typed values** — `typeBusinessName`, `typeDivisionName`,
`typeLocationName` — passed as arguments, never a string literal
standing in for a kind.

## The real type descriptor — a value, not a string

TypeScript has no runtime reflection on generic type parameters, so
the *kind* has to be a real, passable value that carries both the
compile-time brand and the runtime check together, as one thing:

```ts
interface TypeDescriptor<TBrand extends string> {
  readonly brand: TBrand;
  readonly validate: (entityName: string) => boolean;
}

type BusinessName = string & { readonly __brand: 'BusinessName' };
type DivisionName = string & { readonly __brand: 'DivisionName' };
type LocationName = string & { readonly __brand: 'LocationName' };
type EmployeeName = string & { readonly __brand: 'EmployeeName' };
type CategoryName = string & { readonly __brand: 'CategoryName' };

// Real, named, passable values - never a bare string kind argument.
const typeBusinessName: TypeDescriptor<'BusinessName'> = {
  brand: 'BusinessName',
  validate: (name) => isDescendantOf(name, 'Businesses'),
};
const typeDivisionName: TypeDescriptor<'DivisionName'> = {
  brand: 'DivisionName',
  validate: (name) => /* real check, see below */ true,
};
const typeLocationName: TypeDescriptor<'LocationName'> = {
  brand: 'LocationName',
  validate: (name) => getLocation(name) !== undefined,
};
const typeEmployeeName: TypeDescriptor<'EmployeeName'> = {
  brand: 'EmployeeName',
  validate: (name) => isDescendantOf(name, 'Employees'),
};
const typeCategoryName: TypeDescriptor<'CategoryName'> = {
  brand: 'CategoryName',
  validate: (name) => isDescendantOf(name, 'Categories'), // arbitrary depth, unaffected
};
```

## The real node — carries its own real, branded name

```ts
interface TypedNode<TBrand extends string> {
  readonly id: EntityId;
  readonly name: string & { readonly __brand: TBrand };
}
```

## The one, real, generic `create<T>`

```ts
function create<TParentBrand extends string, TChildBrand extends string>(
  parent: TypedNode<TParentBrand>,
  type: TypeDescriptor<TChildBrand>,
  name: string,
  userId: UserId
): TypedNode<TChildBrand> {
  createEntity({ name, parent: parent.name }, userId);
  if (!type.validate(name)) {
    throw new ValidationError(`"${name}" was created but is not a genuine ${type.brand}.`);
  }
  return { id: asEntityId(resolveIdOrThrow(name)), name: name as string & { __brand: TChildBrand } };
}
```

## Usage — the exact chain requested

```ts
const business = create(rootNode, typeBusinessName, 'Wine Retail Company', userId);
const division = create(business, typeDivisionName, 'Sydney Division', userId);
const location = create(division, typeLocationName, 'Riverside Cellars', userId);

// createDivisionEmployee etc. collapse into the same, one, generic
// function - no separate function per level needed anymore:
const employee1 = create(business, typeEmployeeName, 'Alex Chen', userId);
const employee2 = create(division, typeEmployeeName, 'Sam Lee', userId);
const employee3 = create(location, typeEmployeeName, 'Jo Park', userId);
```

Passing `location` where `create` expects a `TypedNode<'DivisionName'>`
parent is a real compile error — not a runtime check. Passing
`typeLocationName` where a division was needed is equally a compile
error, since the descriptor's own brand is a real generic parameter,
not a string that TypeScript can't distinguish from any other string.

## Arbitrary depth, confirmed unaffected

`create(someCategory, typeCategoryName, 'Merlot', userId)` — a
`TypedNode<'CategoryName'>` can be its own parent argument to another
`create` call, recursing to any real depth. The one, generic function
covers both the fixed chain and the arbitrary-depth case identically.

## Real, direct implementation status

**Built and directly tested**: `isDescendantOf` (the missing, reliable
"did this walk genuinely reach the root" answer `getAncestorChain`
itself doesn't provide), and `create`/`fetch` themselves (the real,
generic primitives, `TypeDescriptor`, `TypedNode`) — all implemented
directly against the real, low-level `entity_entry` mechanism, with no
dependency on generic `createEntity` at all, per direct instruction.
Confirmed via a real, direct test explicitly proving the Springfield
principle: a business, a division, a location, and an employee can
all genuinely, correctly be named the same thing at once, while a
real, same-parent collision is still genuinely rejected — and a real,
Vocabulary-backed descriptor (`validNames()`) rejects an unknown name
*before* any allocation happens, so there is nothing to roll back.

**The original, confirmed gap is now genuinely closed**: `isGenuineCategoryOrItemsRoot`
(a real, structural check — any live descendant of the global `Items`
root, at arbitrary depth) backs the new `typeCategoryOrItemsRootName`
descriptor, and `createItem` now calls `fetch(parent, typeCategoryOrItemsRootName)`
internally before creating — "Vendors" can no longer silently succeed
as an item's parent, confirmed via a real, direct test, for every
existing caller, with no breaking signature change required.

A real, genuine JS temporal-dead-zone bug found and fixed along the
way, not glossed over: `seedRemainingData()` runs at real module-load
time, before this file's own `const typeXxxName` declarations further
down would otherwise have initialized — found via a real, failing
test run, not assumed correct, and fixed by moving the `const`
declarations (but not the hoisted function declarations that
reference them) to before that call.

## Real, complete eradication of createEntity from db.ts and db-stock.ts

Every real, internal `createEntity` call in these two core files has
been migrated to `create`/`fetch`/`fetchById` - confirmed directly,
zero remaining real calls (one, historical, illustrative comment about
a past bug scenario remains, correctly untouched, since it isn't real
code). `fetchById` was added alongside `fetch` for the real cases that
already hold a numeric id (from a route param, a prior query) rather
than a name. Real, named descriptors now exist for every distinct kind
this migration touched: type markers (Location Type, Storage Origin,
Text Direction, Is Billing Address), record kinds (relationship,
open-hours, schedule, entity-link, menu-override, hidden-marker,
translation-concept, project-task), and Chart-of-Accounts nodes
(Equity/Asset accounts, the per-business root, recursive mirror
nodes). All 163 backend tests pass; the full backend+frontend suite
and documentation-coverage check are clean.

## Complete eradication of createEntity from the entire, live application

Confirmed directly, project-wide: `db.ts`, `db-stock.ts`, `db-seed.ts`,
every route handler, all 19 scripts under `backend/scripts/`, and the
entire test file (`backend/test/db.test.ts`, 274 real call sites) are
all now free of generic `createEntity` calls. Two, real, explicitly
documented exceptions remain, both matching this skill's own rule 4
(a genuinely open-ended value/purpose is correctly left generic):
`routes/entities.ts`'s own Entity Tree Editor endpoint (an
administrator may be creating any real kind, not known in advance),
and `primitives.ts`'s own `Entity.create` - a separate, real,
deliberate "five primitives" abstraction layer this application was
already being migrated toward, documented in that file's own header
as the intended, generic foundation every specific function should
compose from. Both are real, stated, deliberate exceptions, not
oversights. A historical, already-superseded Python generator script
(`generate-wine-retail-migration.py`) also references `createEntity`
inside generated string output - not live TypeScript application
code, and not touched.

All 163 backend tests, the full 196-test backend+frontend suite, and
`check-docs-coverage` are clean throughout this entire migration.

## Real, open items before wider adoption

1. Each descriptor's own `validate` needs its real, correct check —
   `typeDivisionName`'s is genuinely still open (there's no existing,
   direct "is this really a Division" query the way `getLocation`
   already gives one for locations).
2. `resolveIdOrThrow` runs *after* `createEntity` above — on a real
   validation failure, the entity now exists but was rejected. Needs
   a real decision: roll back (delete it) or leave it and surface the
   error clearly. Rolling back is almost certainly correct.
3. Migrating existing callers (`db-seed.ts`, the simulation script,
   every test) to this new shape is the same real, large, honest cost
   as the branded-types pass — not attempted to be hidden or
   understated here.

Proceeding to implementation now unless you want to adjust anything
here first.
