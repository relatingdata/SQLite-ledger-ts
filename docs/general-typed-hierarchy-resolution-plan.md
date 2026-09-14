# A General, Typed Hierarchy-Resolution Plan: Expanding on the Existing Category and Division Code

Per direct request: a real plan reusing and expanding the existing Chart-of-Accounts (Category) and Division code, unified through `create<T>`/`fetch<T>`'s own typed-parameter mechanism — not a replacement, not a new, separate system built alongside them.

## 1. Confirm reality first

- **Category resolution genuinely has a bug**: `categoryForAccount` (`db-matrix-reports.ts`) walks exactly one real `parent_id` level, not the full ancestor chain — confirmed directly by reading the function. A deeper real nesting (a hypothetical category under a broader category) would resolve to the wrong, immediate parent, not the true top-level category.
- **Division nesting is structurally already possible, but not resolved correctly**: confirmed directly, `Springfield`/`Rivertown` are real, live children of a real `Divisions` root via `parent_id`, and `routes/divisions.ts` already lets a caller specify any real parent (`parsed.data.parent ?? 'Divisions'`) — a sub-division nested under another division is already a real, buildable structure today. But `divisionForLocation` resolves a location's division via the separate "Belongs To Division" `relation_id` link, which is a flat, single-hop lookup — it does not walk a `parent_id` chain, so a genuine division-under-division nesting wouldn't be correctly attributed to its own top-level division by the existing reporting code.
- **Both real bugs are the same, real, underlying gap**: neither resolver genuinely walks an arbitrary-depth `parent_id` chain up to a real, typed root. Two separate, ad-hoc functions, each with its own, different, incomplete answer to the same real question: "what is this entity's ancestor of kind X."

## 2. The one, real, generic primitive this plan is built around

A single, generic, arbitrary-depth ancestor walker, parameterized by a real `TypeDescriptor` — reusing `create<T>`/`fetch<T>`'s own, established pattern directly, not inventing a parallel one:

```ts
/** Walks entityId's own real parent_id chain, arbitrarily deep, until
 * it finds a real ancestor whose own name the given TypeDescriptor
 * validates - returning that ancestor as a real, typed node. Reused
 * directly for Category, Division, and any future dimension that is
 * genuinely parent_id-structural, rather than each dimension writing
 * its own, separate, ad-hoc walk. */
function resolveAncestorOfType<TBrand extends string>(
  entityId: number,
  type: TypeDescriptor<TBrand>,
  entityIndex: Map<number, { name: string; parent_id: number | null }>
): TypedNode<TBrand> | undefined {
  let current = entityIndex.get(entityId);
  let currentId = entityId;
  for (let i = 0; i < 100 && current; i++) {
    if (type.validate?.(current.name)) {
      return { id: asEntityId(currentId), name: current.name as string & { __brand: TBrand } };
    }
    if (current.parent_id == null) return undefined;
    currentId = current.parent_id;
    current = entityIndex.get(currentId);
  }
  return undefined;
}
```

This is a real, direct generalization of `isDescendantOf` (already built for `create<T>`) — the same, real walk, but returning the matching ancestor itself, not just a boolean.

## 3. Real, concrete `TypeDescriptor`s this enables — reusing, not replacing, the existing concepts

```ts
// Real, already-existing concepts, now given a real, typed identity
// each can be resolved *by*, not just created *as*.
const typeCategoryBucketName: TypeDescriptor<'CategoryBucketName'> = {
  brand: 'CategoryBucketName',
  // A real, direct category bucket: its own parent is genuinely
  // "Items" (or a business's own "{Business} Items"), matching
  // isGenuineCategoryOrItemsRoot's own, already-proven definition -
  // reused directly, not reimplemented.
  validate: (name) => {
    const row = /* real, direct parent_id lookup */;
    return row != null && isGenuineCategoryOrItemsRoot(row.parentName);
  },
};

const typeDivisionBucketName: TypeDescriptor<'DivisionBucketName'> = {
  brand: 'DivisionBucketName',
  // A real division is genuinely a live child of the real Divisions
  // root, or of another real division (a real sub-division) - reuses
  // typeDivisionName's own, existing brand concept, generalized to
  // "any real ancestor that is itself a Division," not just the
  // immediate one.
  validate: (name) => isDescendantOf(name, 'Divisions') || name === 'Divisions',
};
```

## 4. Replacing the two, real, separate, ad-hoc resolvers

- `categoryForAccount(accountId, ...)` becomes `resolveAncestorOfType(accountId, typeCategoryBucketName, entityIndex)?.name` — genuinely arbitrary-depth now, the one-level bug fixed by construction, not by a special case.
- `divisionForLocation(locationName, ...)` gets a second, real, direct path added alongside its existing "Belongs To Division" relation-link check (kept, since that's a real, deliberate, explicit override mechanism, not obsolete) — falling back to `resolveAncestorOfType` on the location's own `parent_id` chain when no explicit relation link exists, correctly attributing a location under a real, nested sub-division to its own real division ancestor, not just its immediate parent.

## 5. What this means for `MatrixAxis` and `getProfitAndLossByAxis`

The fixed, closed `MatrixAxis` union (`'Product' | 'Category' | 'Location' | 'Division' | 'Consolidated'`) is **not** replaced by this plan — per the original design document's own Section 9, deliberately left undecided whether to generalize the axis set itself now or defer it. This plan closes the two, real, confirmed *resolution* bugs within the existing four axes; it does not, on its own, make the axis set open-ended. A real, separate, later decision, not conflated with this one.

## 6. Real, concrete sequencing

1. Build `resolveAncestorOfType` directly in `db.ts` (alongside `isDescendantOf`, which it generalizes), with a real, direct backend test proving arbitrary depth on both a real, multi-level category and a real, deliberately-constructed sub-division.
2. Fix `categoryForAccount` to use it — a real, non-breaking change, since a single-level category still resolves identically; only genuinely deeper nesting changes behavior, and only correctly.
3. Extend `divisionForLocation` to fall back to it — kept behind the existing "Belongs To Division" override, so no real, current behavior changes for the existing, flat two-division data.
4. Add one real, direct test reproducing the original plan's own example structure (a division containing a sub-division containing a location leaf) end to end through `getProfitAndLossByAxis`, confirming the Division axis now attributes correctly through the nested case.

Not started — this is the real, honest plan, per direct instruction, execution to follow.
