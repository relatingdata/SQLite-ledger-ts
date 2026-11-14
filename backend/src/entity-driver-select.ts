// entity-driver-select.ts — the ONE module in the backend allowed to import
// every concrete EntityDriver implementation. Everything else (primitives.ts,
// and eventually the ~470 call sites migrated in Stage C) imports only
// `entityDriver` from here, never a concrete driver module directly —
// that's the isolation boundary the whole plan exists to create.
//
// `ENTITY_DRIVER=sql|kaappi|memory|gleam`. The Kaappi and Gleam drivers'
// constructors each spawn a worker thread (and, for Kaappi, the Kaappi
// subprocess inside it) synchronously at module load; GleamEntityDriver's
// worker instead waits for storage_engine's already-running HTTP server
// to answer (see gleam-worker.ts) — no subprocess spawned here either
// way. MemoryEntityDriver's constructor replays the same kaappi_wal op
// log into its own in-process box/version model, no subprocess involved.
// Each driver pays its own startup cost only when actually selected.
//
// Default is `sql` — NOT `gleam`, for now, despite the direct
// instruction to replace the live backend. Found directly, the hard
// way, running the real tutorial e2e suite under ENTITY_DRIVER=gleam:
// several functions across db.ts/db-stock.ts (placeOrder was the
// first, now fixed; at least 6 more remain, found by a direct grep for
// `Entity.`/`entityDriver.` calls inside a `db.transaction(...)` body)
// wrap entity writes and direct-SQL journal/account writes inside ONE
// better-sqlite3 transaction. Under `gleam`, an entity write goes out
// over real HTTP to storage_engine, which writes the SAME file through
// its OWN, separate SQLite connection — calling that while a
// still-open write transaction already holds this file's one write
// lock is a genuine deadlock (confirmed: it hangs for exactly the
// configured busy-timeout ceiling, not a transient slowdown). Fixing
// this for real means auditing and restructuring every such call site
// (entity/configuration work moved before the transaction opens, never
// inside it alongside direct-SQL accounting writes) — real, substantial,
// not-yet-done work, tracked as its own follow-on item rather than
// rushed. `gleam` is fully built, wired into the Makefile's server
// lifecycle, and correct for every operation that doesn't hit this
// pattern — select it explicitly with ENTITY_DRIVER=gleam once that
// audit is complete, or to keep fixing/testing it incrementally now.
import { SqlEntityDriver } from './drivers/sql-entity-driver.js';
import { KaappiEntityDriver } from './drivers/kaappi-entity-driver.js';
import { MemoryEntityDriver } from './drivers/memory-entity-driver.js';
import { GleamEntityDriver } from './drivers/gleam-entity-driver.js';
import type { EntityDriver } from './entity-driver.js';

function selectDriver(): EntityDriver {
  const choice = process.env.ENTITY_DRIVER ?? 'sql';
  if (choice === 'kaappi') return new KaappiEntityDriver();
  if (choice === 'memory') return new MemoryEntityDriver();
  if (choice === 'sql') return new SqlEntityDriver();
  if (choice === 'gleam') return new GleamEntityDriver();
  throw new Error(`ENTITY_DRIVER must be "sql", "kaappi", "memory", or "gleam", got "${choice}".`);
}

// LAZY by construction — real, load-bearing, not a style choice. db.ts
// imports primitives.ts (which imports this module) BEFORE db.ts's own
// top-level code runs its once-ever schema bootstrap (`if
// (!alreadyInitialized) { db.exec(readSchema('00-core.sql')); ... }` —
// ES module imports are hoisted/evaluated before the importing module's
// own top-level code, regardless of where the import statement sits
// textually). If `selectDriver()` ran eagerly at this module's own
// top level the way it used to, GleamEntityDriver's constructor would
// block waiting for storage_engine to answer BEFORE db.ts's schema
// bootstrap has had any chance to run — and if storage_engine answers
// first (it applies its own, much smaller schema at its own process
// startup, independently), db.ts would see an `entities` table already
// present on a freshly-reset database and wrongly skip its entire real
// schema init. Deferring real construction (and the Kaappi/Gleam
// drivers' worker-thread startup blocking that comes with it) to the
// FIRST actual call keeps that ordering correct — nothing at db.ts's/
// primitives.ts's own module scope calls an entityDriver method eagerly;
// every real call happens well after both modules have finished loading.
let cached: EntityDriver | undefined;
function getDriver(): EntityDriver {
  if (!cached) cached = selectDriver();
  return cached;
}

export const entityDriver: EntityDriver = new Proxy({} as EntityDriver, {
  get(_target, prop, receiver) {
    const driver = getDriver();
    const value = Reflect.get(driver as object, prop, receiver);
    return typeof value === 'function' ? value.bind(driver) : value;
  },
});
