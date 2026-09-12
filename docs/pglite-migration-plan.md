# Migrating to PGlite, with materialized views over the entity tree

## Status: a real, considered plan, not yet started. No code has been changed for this.

## What PGlite actually is (confirmed via web search, not assumed)

PGlite (`@electric-sql/pglite`, from ElectricSQL) is a genuine WASM build of real PostgreSQL — not a reimplementation, not an emulation. It runs Postgres compiled to WebAssembly, in single-user mode, embedded directly in a Node.js/Bun/Deno process (or a browser). It's packaged as an ordinary npm dependency, persists to the real filesystem in Node (or IndexedDB/OPFS in the browser), and needs no separate server process — the same "just an embedded file" deployment story SQLite has today, but backed by real Postgres semantics instead of SQLite's own.

Two capabilities confirmed directly relevant to this project's own request:
- **Real materialized views** — genuine Postgres `CREATE MATERIALIZED VIEW`, not a SQLite workaround.
- **`pg_ivm`** (Incremental View Maintenance) — a real, separate, installable PGlite extension (`@electric-sql/pglite-pg_ivm`) that keeps a materialized view continuously up to date on every write, computing only the incremental delta, rather than requiring a manual `REFRESH MATERIALIZED VIEW` (which recomputes the whole view from scratch). This is the genuine analog of the trigger-based "materialized view kept live" pattern from the previous PostgreSQL implementation this request references.

## Why this is a genuinely good fit for this project's own architecture

This project already deliberately keeps its real schema tiny (30 tables) by pushing almost everything through one generic, append-only `entities` tree, with `setEntityLink`/`getEntityLink` standing in for what would otherwise be dozens of per-relationship join tables. This buys enormous flexibility (a new business concept costs zero schema migrations — confirmed repeatedly this session: Storage Origin, Chart of Accounts Line Types, and the Category→Product→Item hierarchy all shipped without touching a single `CREATE TABLE`), at a real, acknowledged cost: correctness now depends on every query correctly walking a generic tree, rather than the database's own foreign keys and typed columns enforcing it. This session alone found and fixed the same class of bug twice (`resolveItemId`, then `getAncestorChain`) — a hardcoded `'Items'` string that silently stopped matching once a business-scoped root existed.

Materialized views, kept live via `pg_ivm`, are a genuine way to have both things at once: the append-only entity tree stays exactly as it is (the source of truth, the audit trail, the thing that never lies about history), while a real, live, referentially-typed relational view sits on top of it for anything that wants to query it like an ordinary normalized schema — CRUD through the view, real foreign keys, real `NOT NULL`, real column types, all derived and kept current automatically rather than hand-maintained.

## The real, concrete migration shape

### Phase 1 — Swap the driver, change nothing else

SQLite and Postgres are close enough in the subset this project actually uses (no SQLite-specific `INSTEAD OF INSERT` trigger syntax carries over directly — Postgres uses real `CREATE TRIGGER ... FOR EACH ROW EXECUTE FUNCTION`, and views need `INSTEAD OF` triggers written as real PL/pgSQL functions, not inline SQL) that a first, honest phase should just be: get the existing schema (`entities`, `entity_ids`, `account`, `contact`, all 30 tables) running unmodified-in-spirit on PGlite, with `better-sqlite3` swapped for `@electric-sql/pglite`'s own query interface. This alone validates the WASM build is fast enough and stable enough in this project's own real test suite (187 tests) before any new feature (materialized views) is introduced. Confirm the full backend suite passes, unchanged, before touching anything else.

**Real, known friction points to expect, not guess at**: SQLite's `INSTEAD OF INSERT ON <view>` triggers (the `entity_entry`/`entity_update`/`entity_delete` mechanism this whole append-only design rests on) need rewriting as real Postgres rule/trigger syntax — this is not a drop-in port, it's a genuine rewrite of the single most load-bearing mechanism in the schema, and needs its own careful, isolated verification pass before anything else proceeds. `AUTOINCREMENT`/`ROWID` semantics differ (Postgres uses `SERIAL`/`IDENTITY`). SQLite's dynamic typing (a column can hold any type regardless of declared type) is real and has likely been leaned on informally somewhere; Postgres will reject that, and existing SQL will need auditing for it.

### Phase 2 — Add materialized views over the entity tree, additively

**Update, from a real, executed prototype (see `backend/scripts/prototype-pglite-ivm.ts` and its own findings below): this phase, as originally conceived, does not work as described. The open questions this section originally posed have real, empirical answers now — both negative.**

Not a replacement for the entity tree — a real, derived, read-optimized layer on top of it. For each concern the codebase currently derives at query time via a recursive CTE walk (item hierarchies, location hierarchies, Chart of Accounts hierarchies), the original hope was a materialized view with genuine typed, named columns and real foreign keys, kept live via `pg_ivm`.

**Confirmed directly, via a real, running prototype against real PGlite (`@electric-sql/pglite` + `@electric-sql/pglite-pg_ivm`), not assumed:**

1. **`pg_ivm`'s `create_immv` rejects recursive CTEs outright.** The real, exact error: `recursive query is not supported on incrementally maintainable materialized view`. This is not a PGlite limitation specifically — it's `pg_ivm` itself (confirmed extension version 1.13) refusing the feature. There is no incremental path for a tree walk through this extension.

2. **`pg_ivm`'s `create_immv` also rejects any source query that reads from a view at all** — not just recursive ones. A trivial, non-recursive `SELECT ... FROM current_entities` (itself just `SELECT ... FROM entities WHERE deleted_at IS NULL`) fails with `VIEW or MATERIALIZED VIEW is not supported on incrementally maintainable materialized view`. Confirmed directly that the identical query against the real, underlying base table (`entities` itself, with the `WHERE deleted_at IS NULL` filter written inline rather than through the `current_entities` view) succeeds. `create_immv` genuinely requires its source query to reference base tables only, throughout.

**What this means for this project's own real design, honestly:** the entire `current_entities`-view-based convention this schema is built on — the single most repeated pattern in the whole codebase — cannot be the source of a `pg_ivm`-maintained view without a real, structural rewrite: either (a) inline the `deleted_at IS NULL` filter into every materialized view's own query instead of going through `current_entities`, which is workable for a flat filter but doesn't solve the recursive-CTE rejection at all, or (b) abandon `pg_ivm` for anything hierarchical and fall back to manual `REFRESH MATERIALIZED VIEW` (ordinary Postgres materialized views, which do support recursive CTEs directly - confirmed by their absence from any error above) on some real, deliberate schedule or trigger-driven call, trading true incremental maintenance for a real, periodic full recompute. Given the entity tree's own item/location/CoA hierarchies are exactly the recursive case, **(b) is the only real, currently-viable path for this project's actual use case** - `pg_ivm` does not deliver on the "materialized view of the entity tree, kept live automatically" goal as originally hoped.

A genuinely viable, reduced version of Phase 2: ordinary (non-incremental) materialized views over the real recursive tree walks, refreshed via an explicit `REFRESH MATERIALIZED VIEW` call from application code immediately after any write to `entities` (mirroring, in spirit, the same "recompute after every real mutation" discipline this schema's own append-only convention already assumes) - real, correct, but not free the way `pg_ivm`'s incremental delta computation would have been. This is a real, honest downgrade from the original hope, not a minor footnote.

```sql
-- What DOES work: an ordinary (non-incremental) materialized view,
-- over a real, inlined-filter base-table query, holding a recursive
-- tree walk. Genuinely correct Postgres; just not IVM-maintained.
CREATE MATERIALIZED VIEW item_hierarchy AS
  WITH RECURSIVE tree AS (
    SELECT entity_id AS id, name, parent_id, name AS category
    FROM entities WHERE deleted_at IS NULL AND (name = 'Items' OR name LIKE '% Items')
    UNION ALL
    SELECT e.entity_id, e.name, e.parent_id, t.category
    FROM entities e JOIN tree t ON e.parent_id = t.id
    WHERE e.deleted_at IS NULL
  )
  SELECT id, name, category FROM tree;

-- Explicit, application-triggered refresh - not automatic, not
-- incremental, but real and correct.
REFRESH MATERIALIZED VIEW item_hierarchy;
```

### Phase 3 — Directed-graph/inverted-tree native support

Per direct mention: real Postgres has genuine, native support for this beyond what a recursive CTE alone gives — `ltree` (a real extension for hierarchical label paths, with real, efficient ancestor/descendant operators like `<@`/`@>`) is the standard, mature answer, and ordinary recursive CTEs are already real, first-class Postgres SQL (not a SQLite-specific workaround). Confirm directly whether `ltree` is available as a PGlite extension (not yet checked in this session) before relying on it in the plan — if it isn't, the recursive-CTE approach already used throughout this codebase remains the fallback, and is already proven to work.

### Phase 4 — Cut over, in a real, staged way

Dual-write to both SQLite and PGlite for a real, bounded verification window, comparing every query's result across both, before the SQLite path is removed entirely. Given how much of this project's own value is in its extensive, already-passing test suite (187 backend tests, the full Playwright e2e suite), the honest, low-risk path is: get every existing test passing against PGlite first (Phase 1), then add materialized-view coverage as new, additional tests (Phase 2) rather than replacing existing ones, so a regression in either layer is caught immediately and attributably.

## What this plan deliberately does not yet claim

- **Performance**: PGlite is explicit in its own docs that it is "a little slower than WASM SQLite" today, with further optimization (OPFS support in-browser, Emscripten overhead reduction) planned but not yet delivered as of this search. This project's own real test suite and simulation script (`simulate-wine-retail-month.ts`, hundreds of transactions) is the right, concrete benchmark to run before deciding this trade-off is acceptable — not a guess.
- **`pg_ivm` on recursive views**: **resolved, negatively, by direct prototype** — see Phase 2's own update above. `pg_ivm` rejects recursive CTEs outright, and separately rejects any source query touching a view at all (not just recursive ones). The originally-hoped incremental, always-live materialized view over the entity tree is not achievable via `pg_ivm` as it currently stands; ordinary, explicitly-refreshed materialized views are the real, viable fallback.
- **`ltree` availability in PGlite**: still genuinely not checked — a real, remaining open item.
- **Browser deployment**: this plan focuses on the Node.js backend use case already in place; PGlite's own in-browser story (IndexedDB/OPFS persistence) is a separate, further consideration if this application's own architecture ever needs a fully client-side database, which it does not today.

## Recommended next real step

A small, isolated, throwaway prototype (matching this project's own established `backend/scripts/prototype-*.ts` convention) — not a full migration attempt — that: (1) boots PGlite, (2) recreates just the `entities`/`entity_ids` tables and the `entity_entry` trigger mechanism in real Postgres syntax, (3) attempts a `pg_ivm`-backed materialized view over a small recursive CTE matching the real shape of `item_hierarchy` above, and (4) reports back, honestly, whether steps 2 and 3 genuinely work as described here or hit a real, concrete obstacle this plan didn't anticipate.
