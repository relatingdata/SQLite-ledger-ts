# No `updateEntity`; every mutation explicit; every multi-step sequence atomic

## The two, direct, absolute rules, per direct instruction

1. **There is zero possibility of an `updateEntity` function existing.** A function named (or behaving)
   like "update" implies in-place mutation. This design has none — every change to what an
   `entity_id` currently means is, and must visibly be, closing out the previous entity and creating
   a new, replacement entity. That action must be explicit everywhere it happens, not hidden behind
   a conveniently-named wrapper.
2. **Every multi-step entity mutation must be atomic as a whole.** Checked directly: only 9 functions
   in `db.ts` currently use an explicit `db.transaction()`; there is no request-level or middleware
   wrapping. A sequence of several inserts representing one logical change (create, then tag, then
   set two attributes) has no atomicity guarantee today — a crash or thrown error partway through
   leaves a permanently broken, half-formed record, since nothing can ever update or delete a row to
   fix it afterward. better-sqlite3's own `db.transaction()` nests correctly via SQLite savepoints,
   confirmed directly — no special nested-transaction mechanism needs to be built, only consistent use
   of it.

## Audit, done directly against the real codebase

- `updateEntity(...)` call sites: **37** (`db.ts` 20, `db-stock.ts` 7, `db-seed.ts` 3, `auth.ts` 2,
  `db-journal.ts` 2, `primitives.ts` 3).
- `Entity.create(...)` call sites: **52**.
- `setEntityLink(...)` call sites: **16**.
- Only 9 functions wrap themselves in `db.transaction()` today.

Every one of the 37 `updateEntity` call sites must be converted. Every function that performs more
than one entity-mutating call (`Entity.create`, `Entity.tag`, `Entity.setAttr`, `setEntityLink`, the
new `Entity.supersede` below, or any raw `INSERT INTO entity_*`) as part of one logical operation
must be wrapped in `db.transaction()`, including the 9 already correct and every one not yet audited.

## The replacement for `updateEntity`

`Entity.supersede(id, { name?, parent?, parentId?, relation?, relationId? }, userId)`
(`backend/src/primitives.ts`) — an honestly-named function whose name itself states what happens:
the current row for `id` is superseded by a new one carrying the given changes, every other field
carried forward unchanged. It is a thin, direct wrapper around the same, real `entity_update`
insert-only view already in the schema — **not a new mechanism**, a new, honest name replacing a
misleading one, with every call site required to show it's calling something named for what it does.

`updateEntity` is deleted entirely, not deprecated or aliased — there must be nothing left that a
future caller could reach for under the old, misleading name.

## Implementation plan, one step at a time

1. Add `Entity.supersede` to `primitives.ts` (the exact logic `updateEntity` already has, moved and
   renamed, calling the same `entity_update` insert).
2. Convert all 37 `updateEntity` call sites to `Entity.supersede`, file by file
   (`primitives.ts` → `auth.ts` → `db-journal.ts` → `db-seed.ts` → `db-stock.ts` → `db.ts`),
   `make check-backend-types` after each file.
3. Delete the `updateEntity` function itself once every call site is converted and compiles clean.
4. Audit every function containing more than one entity-mutating call for transaction safety, file
   by file, same order as step 2. Wrap each in `db.transaction()` where not already covered by an
   enclosing one. A function already called from inside another's transaction does not need its own
   (better-sqlite3's nesting handles this correctly) — but must not be left unwrapped when called on
   its own, directly, from a route.
5. Full backend suite (`make test`) after every file in steps 2 and 4, not batched to the end.

## Testing plan

- A direct test that no file in `backend/src/` contains the literal string `updateEntity` after step 3
  (a real, mechanical confirmation, not a visual check).
- A direct test that a simulated failure partway through a multi-step sequence (e.g. an injected
  thrown error between `Entity.tag` and `Entity.setAttr` in `postBomComponents`) leaves **zero** trace
  of the partial change — the whole transaction rolled back, not a half-formed BOM link.
- A direct test confirming nested transactions behave correctly: an outer operation calling two
  already-wrapped inner ones, with a failure in the second inner one rolling back both inner changes
  while leaving the outer's own, already-committed-before-the-call state intact only if the outer
  transaction itself is still in progress (i.e., the whole outer transaction rolls back too, since a
  savepoint failure propagates up) — confirming the real, expected all-or-nothing semantics, not
  partial success.
- Full suite green after every step, per the implementation plan above.
