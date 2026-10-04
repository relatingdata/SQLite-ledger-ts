# `entities` — guarded, append-only: only INSERT and SELECT, ever

## The rule, stated precisely, per direct instruction

The `entities` table must be structurally guarded so that **no UPDATE or DELETE is ever possible
against it** — only INSERT and SELECT. This is enforced by real SQL triggers on the table itself
(`BEFORE UPDATE`/`BEFORE DELETE`, each unconditionally `RAISE(ABORT, ...)`), not by convention or
code review alone.

## The schema change

`entities` has **only** `created_at`/`created_by` — no `deleted_at`, no `deleted_by`, no
`updated_at`. For a given `entity_id`, **the current row is simply the one with the latest
`created_at`** — "if a younger entity exists, it is the current one," per direct instruction. No
special row shape, no marker row, no flag distinguishes a "live" row from a "closed" one; every row
is an ordinary row.

`created_at` is `strftime('%Y-%m-%d %H:%M:%f', 'now')` (millisecond precision) on every insert,
settled directly after considering the alternative (`entity_id = row_id` per row) and confirming
why it's wrong: `entity_id` must stay fixed across a rename specifically so `parent_id`,
`relation_id`, and `combination_ids`' own array of sibling ids never need rewriting when the thing
they point at is renamed — collapsing `entity_id` into `row_id` would reintroduce exactly the
cascading-update cost `combination_ids`' own design was built to eliminate.

`row_id` remains as SQLite's own, free, guaranteed-strictly-increasing tiebreaker for the rare case
of two rows for the same `entity_id` sharing a millisecond — never a concept the application reasons
about directly, only the one, single query below.

```sql
CREATE VIEW current_entities AS
  SELECT entity_id AS id, name, parent_id, relation_id, combination_ids, detail_json, created_at, created_by
  FROM entities e
  WHERE row_id = (
    SELECT row_id FROM entities e2 WHERE e2.entity_id = e.entity_id
    ORDER BY created_at DESC, row_id DESC LIMIT 1
  );
```

## What "deleted" means now — the open question, not yet resolved

With no flag and no marker row, and every row an ordinary row, "this entity_id no longer exists" is
not yet a defined concept in this redesign. A real `Deleted` reparent-node was proposed (deletion
is itself a reparent — insert a younger row for that `entity_id` under a real, dedicated archive
location) but **not yet confirmed**. Every function currently relying on "deleted things are simply
absent from `current_entities`" will need to instead exclude the `Deleted` subtree specifically, by
ancestry — once this is confirmed, not before.

## Implementation plan, one step at a time (per direct instruction — not all at once)

1. **Rewrite `current_entities`** to the query above. Verify independently: every existing,
   already-passing test that reads `current_entities` directly must still pass unchanged, since the
   view's own output shape is identical — only its internal selection logic changes.
2. **Rewrite `entity_update_insert` and `entity_delete_insert`** (the two existing triggers that
   currently `UPDATE entities SET deleted_at = ...`) to stop referencing the now-removed column
   entirely. `entity_update_insert`'s existing "insert the replacement row" half already works
   unchanged; its removed "close out the old row" UPDATE half needs no replacement at all under the
   new model, since the old row simply stops being the latest the moment a younger one exists.
   `entity_delete_insert` needs its real, confirmed meaning once the open question above is settled
   — not implemented blind.
3. **Convert every direct `UPDATE entities` call site** (confirmed count: ~20 in
   `backend/src/db.ts`/`db-stock.ts`/`auth.ts`, plus dozens more in the seed data,
   `backend/schema/00-core.sql` and `20-demo-bmw-peugeot.sql`) to insert a younger, full replacement
   row instead — the same shape as a rename, carrying every other column forward unchanged. One
   file at a time; `make check-backend-types` and the full suite after each file, not after the
   whole batch.
4. **Add the guard triggers** (`BEFORE UPDATE`/`BEFORE DELETE ON entities`, unconditional
   `RAISE(ABORT, ...)`) only once steps 1–3 are complete and the full suite is green — adding them
   earlier breaks every rename and delete immediately, confirmed directly: a related, overly broad
   change to `deleteEntity` earlier this session (a cascading delete through any child subtree with
   no postings yet) caused a 134-test regression from a 12-test baseline, by deleting genuine,
   structural data the original guard existed to protect. The lesson applies here directly: no
   foundational change to this table's own write path ships without the full suite confirming it
   first.
5. **Document the final, confirmed shape here**, replacing this plan's own "not yet resolved"
   section once deletion semantics are settled and built.

## Testing plan

- Full backend suite (`make test`) after every one of the five steps above, not batched to the end.
- A real, direct test confirming a rename under high-frequency insert (several renames of the same
  entity within one call) resolves correctly via `(created_at DESC, row_id DESC)` — proving the
  tiebreaker actually does its job, not just that the common case works.
- A real, direct test confirming the guard triggers (step 4) reject a raw `UPDATE`/`DELETE` against
  `entities` with a clear error, once added.
- Re-run the realistic tutorial end-to-end (`shared-fixtures/tutorial-steps.csv`, `--path api` then
  `--path ui`) after step 4, confirming nothing in the real, user-facing application silently
  depended on the old `deleted_at` column existing.
