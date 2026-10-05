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

## The replacement for `updateEntity` — done, matching what was actually built

**`supersedeEntity(id, { name?, parent?, parentId?, relation?, relationId? }, userId)`**
(`backend/src/db.ts`, not `primitives.ts` — `getEntity`/`resolveId`, which this needs, already live
there, and moving it would have created a circular import) — an honestly-named function whose name
itself states what happens: the current row for `id` is superseded by a new one carrying the given
changes, every other field carried forward unchanged. A thin, direct rename of the same, real
`entity_update` insert-only mechanism already in the schema — not a new one.

`updateEntity` was deleted entirely, not deprecated or aliased, across every file in the repository
(backend, frontend, tests, scripts) — confirmed directly, zero occurrences remain anywhere.

## A second, parallel rename, confirmed necessary by direct, later correction: `deleteEntity` → `revokeEntity`

Per direct, absolute correction after this chapter's own first version: **there is no delete
anywhere in this design either** — only ever a younger value superseding an older one, the complete
history staying in the `entities` table forever. `deleteEntity` was renamed to `revokeEntity`,
matching the real `entity_revoke` mechanism (supersedes `relation_id` to `NULL`, confirmed in
`docs/entities-append-only-redesign.md`). This only applies to genuinely link-shaped entities
(something whose current value's real point is what it points at — a role grant, a tag's own
presence-fact); a plain, structural entity (a ledger, a temporary record) has no natural
`relation_id` to supersede to `NULL` and is never "revoked" at all under this design — confirmed
directly by a real test failure this uncovered, not assumed.

## Implementation plan — completed

1. ~~Add `Entity.supersede` to `primitives.ts`~~ — done as `supersedeEntity` in `db.ts` instead, for
   the import-cycle reason above.
2. All 37 `updateEntity` call sites converted to `supersedeEntity`, confirmed by a repository-wide
   search finding zero remaining occurrences.
3. `updateEntity` deleted entirely once every call site compiled clean.
4. Transaction-safety audit for multi-step sequences: **not yet done** — remains open work, tracked
   here, not yet started as of this chapter's latest revision. A function already called from inside
   another's transaction does not need its own
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
