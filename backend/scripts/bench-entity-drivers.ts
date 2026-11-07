// bench-entity-drivers.ts — permanent, git-tracked capability (never a
// disposable script, per this engagement's own standing rule) measuring
// SqlEntityDriver vs KaappiEntityDriver head-to-head, on the exact same
// real EntityDriver operations against the exact same real data.
//
// Deliberate, documented exception to entity-driver-select.ts's "only
// module allowed to import both concrete drivers" rule — the same
// category of exception migrate-entities-to-kaappi.ts already carries
// (its own job already requires straddling both SQL and Kaappi). This
// script's entire purpose is comparing them, so it needs both, directly,
// never through the selector.
//
// Usage:
//   tsx scripts/bench-entity-drivers.ts <path-to-bootstrapped-db-copy> [--runs N]
//
// The db copy must already have a non-empty kaappi_wal — i.e.
// migrate-entities-to-kaappi.ts has already been run against it. Same
// safety discipline as that script: refuses the live default db path
// (backend/data/entities.sqlite) without MIGRATE_ALLOW_LIVE_DB=1 (reusing
// that exact env var rather than inventing a second one), and requires
// the file to already exist. Every operation benchmarked is a pure read
// on both drivers (getByName/children/descendantsWithDepth/getMany) —
// this script never writes to the db, SQL or Kaappi side, so running it
// repeatedly is always safe.
//
// See docs/pm-testing-e2e.md and
// /root/.claude/plans/stateful-snacking-adleman.md for why this
// comparison matters, and for the up-to-date picture of what's fixed vs.
// still a real, disclosed gap. As of this session: entity-model's
// entities.sld now backs entity-children/entity-get-by-name-anywhere with
// a materialized per-box children list and a name->boxes hash index
// (previously a linear `filter` over every entity), and
// KaappiEntityDriver.descendantsWithDepth now calls the native, recursive
// entity-descendants primitive plus one entity-get-many, instead of its
// own TS-side one-entity-children-call-per-parent BFS — 2 round trips
// total regardless of subtree size, down from O(subtree size). Measured
// effect (this session, same disposable bootstrapped db copy both times):
// descendantsWithDepth over the full "Application" subtree went from
// 1079x slower than SQL to 128.7x slower (absolute: ~9s -> 1.67s); the
// smaller single-business subtree went from 102x to 12.3x. Still real
// gaps, not closed: entity-children/entity-descendants are still an
// interpreted Scheme walk, not an indexed B-tree, and every call still
// crosses the worker-thread + subprocess + JSON boundary — see
// kaappi-entity-driver.ts's own header for what remains disclosed there.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function flagValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

function timeRuns(label: string, runs: number, fn: () => void): { label: string; totalMs: number; avgMs: number } {
  // One untimed warm-up call first — excluded from the measured runs, so a
  // one-time cost (e.g. a cold prepared-statement cache, a cold TCP/pipe
  // buffer) doesn't get misread as this operation's steady-state cost.
  fn();
  const start = performance.now();
  for (let i = 0; i < runs; i++) fn();
  const totalMs = performance.now() - start;
  return { label, totalMs, avgMs: totalMs / runs };
}

async function main(): Promise<void> {
  const [, , dbPathArg, ...rest] = process.argv;
  if (!dbPathArg) {
    console.error('usage: tsx scripts/bench-entity-drivers.ts <path-to-bootstrapped-db-copy> [--runs N]');
    process.exit(1);
  }
  const runs = Number(flagValue(rest, '--runs') ?? '20');
  const dbPath = path.resolve(dbPathArg);

  const liveDefaultPath = path.resolve(__dirname, '..', 'data', 'entities.sqlite');
  if (dbPath === liveDefaultPath && !process.env.MIGRATE_ALLOW_LIVE_DB) {
    console.error(
      `refusing to run against the live default database path (${liveDefaultPath}).\n` +
        `This script is for a COPY of a dev database only, already bootstrapped via\n` +
        `migrate-entities-to-kaappi.ts (see this file's own header comment). Copy and\n` +
        `bootstrap first, e.g.:\n` +
        `  cp ${liveDefaultPath} /tmp/bench-copy.sqlite\n` +
        `  tsx scripts/migrate-entities-to-kaappi.ts /tmp/bench-copy.sqlite\n` +
        `  tsx scripts/bench-entity-drivers.ts /tmp/bench-copy.sqlite\n` +
        `(Set MIGRATE_ALLOW_LIVE_DB=1 only if you have deliberately decided to run\n` +
        `this against the live file directly.)`
    );
    process.exit(1);
  }
  if (!fs.existsSync(dbPath)) {
    console.error(`no database file at ${dbPath}`);
    process.exit(1);
  }

  // Set BEFORE importing anything db-backed: db.ts (SqlEntityDriver's own
  // import) and kaappi-worker.ts both read process.env.DB_PATH once, at
  // their own module-load time.
  process.env.DB_PATH = dbPath;

  // db.ts -> primitives.ts -> entity-driver-select.ts already imports both
  // concrete driver modules at its own top level and calls selectDriver()
  // immediately on load — importing sql-entity-driver.js/kaappi-entity-
  // driver.js directly, before db.ts has been pulled in through its own
  // natural chain, hits a real, confirmed circular-import ReferenceError
  // ("Cannot access 'SqlEntityDriver' before initialization"), the same
  // hazard this engagement traced once before while developing the (since
  // deleted) disposable tmp-print-lisp-tree.ts script. Importing db.js
  // FIRST forces the whole chain to finish initializing in its natural
  // order; the two driver imports right after this just reuse the
  // already-initialized modules from Node's module cache.
  const { db } = await import('../src/db.js');

  // Real, found-this-session gotcha: db.ts's own module-load side effect
  // (seedRemainingData(), db.ts:106) runs UNCONDITIONALLY on every fresh
  // import, regardless of SEED_DEMO_BUSINESSES, and is a backfill/
  // migration step — it's allowed to genuinely create a few new
  // entities the FIRST time it meets an older db snapshot that predates
  // some since-added vocabulary/translation entry. If kaappi_wal was
  // captured by an EARLIER, separate process (e.g. a prior, separate
  // `migrate-entities-to-kaappi.ts` invocation) and THIS process's own
  // seedRemainingData() then adds a few more rows via the plain,
  // default SqlEntityDriver (which never touches kaappi_wal — only
  // KaappiEntityDriver/MemoryEntityDriver append to it, on their OWN
  // mutations), SQL's live view and the frozen WAL snapshot silently
  // diverge by exactly those few rows. Re-snapshotting the WAL HERE, in
  // THIS process, immediately after db.ts has already finished its own
  // import-time seeding and before either alternate driver is
  // constructed, closes that gap entirely — there is no process
  // boundary left for anything to drift across. This duplicates
  // migrate-entities-to-kaappi.ts's own op-building loop rather than
  // importing that script directly, because that script's own `main()`
  // runs unconditionally at import time AND calls `db.close()` at the
  // end, which would tear down the very connection this benchmark goes
  // on to use.
  type JsonOp = [string, ...(string | number | boolean | null)[]];
  function resyncWalFromEntitiesTable(): void {
    db.exec(`CREATE TABLE IF NOT EXISTS kaappi_wal (id INTEGER PRIMARY KEY CHECK (id = 1), ops_json TEXT NOT NULL DEFAULT '[]')`);
    db.exec(`INSERT OR IGNORE INTO kaappi_wal (id, ops_json) VALUES (1, '[]')`);
    const rows = db
      .prepare(`SELECT row_id, entity_id, name, parent_id, relation_id, created_by FROM entities ORDER BY row_id`)
      .all() as { entity_id: number; name: string; parent_id: number | null; relation_id: number | null; created_by: number }[];
    const ops: JsonOp[] = [];
    const lastSeen = new Map<number, { name: string; parent_id: number | null; relation_id: number | null }>();
    for (const row of rows) {
      const prev = lastSeen.get(row.entity_id);
      if (!prev) {
        ops.push(['create', row.entity_id, row.name, row.parent_id, row.relation_id, row.created_by]);
      } else {
        if (row.name !== prev.name) ops.push(['rename', row.entity_id, row.name, row.created_by]);
        if (row.parent_id !== prev.parent_id) ops.push(['reparent', row.entity_id, row.parent_id, row.created_by]);
        if (row.relation_id !== prev.relation_id) ops.push(['relate', row.entity_id, row.relation_id, row.created_by]);
      }
      lastSeen.set(row.entity_id, { name: row.name, parent_id: row.parent_id, relation_id: row.relation_id });
    }
    db.prepare(`UPDATE kaappi_wal SET ops_json = ? WHERE id = 1`).run(JSON.stringify(ops));
    console.log(`re-synced kaappi_wal in-process from ${rows.length} rows / ${lastSeen.size} entities (closes the cross-process drift gap described above).`);
  }
  resyncWalFromEntitiesTable();

  const [{ SqlEntityDriver }, { KaappiEntityDriver }, { MemoryEntityDriver }] = await Promise.all([
    import('../src/drivers/sql-entity-driver.js'),
    import('../src/drivers/kaappi-entity-driver.js'),
    import('../src/drivers/memory-entity-driver.js'),
  ]);

  const sql = new SqlEntityDriver();
  console.log('starting Kaappi subprocess + WAL replay (this is a one-time cost, excluded from every timed run below)...');
  const kaappi = new KaappiEntityDriver();
  // MemoryEntityDriver's own construction (replaying the SAME kaappi_wal
  // op log into its in-process box/version model) is also a one-time cost
  // excluded from every timed run below — but unlike Kaappi's, it's pure
  // in-process JS with no subprocess to spawn, so it's not separately
  // narrated the way Kaappi's startup is.
  const memory = new MemoryEntityDriver();

  // A real, large subtree every tutorial-fixture db has: Application ->
  // Business Reports / Business Type (prototype CoAs) / Vocabulary /
  // Menus, the exact "whole tree including language translations menus
  // and prototype CoAs" subtree this engagement already inspected by hand.
  const applicationNode = sql.getByName('Application', 'Root');
  if (!applicationNode) {
    console.error('no "Application" entity under "Root" in this db — is it a real, bootstrapped dev/test db?');
    process.exit(1);
  }

  // A smaller, representative subtree for comparison — the first business
  // this same db has, so the benchmark also shows how the gap scales down
  // for a modestly-sized real subtree, not just the largest one.
  const businessesRoot = sql.getByName('Businesses', 'Root');
  const firstBusiness = businessesRoot ? sql.children(businessesRoot.id)[0] : undefined;

  console.log(`\nBenchmarking against: ${dbPath}`);
  console.log(`runs per operation: ${runs} (plus one untimed warm-up each)\n`);

  const results: { op: string; sqlMs: number; kaappiMs: number; memoryMs: number; kaappiRatio: number; memoryRatio: number }[] = [];

  // Normalizes a result for comparison: neither driver's ordering
  // contract is identical (SqlEntityDriver's descendantsWithDepth orders
  // by depth then name; MemoryEntityDriver's follows BFS insertion order;
  // `children`/`getMany` make no ordering promise on either side), so a
  // raw JSON.stringify of the two results can legitimately differ in
  // order while agreeing on content — sort by id first so the check is
  // about the real result set, not an incidental, undocumented order.
  function normalize(rows: unknown): string {
    if (!Array.isArray(rows)) return JSON.stringify(rows);
    return JSON.stringify([...rows].sort((a: any, b: any) => (a.id ?? 0) - (b.id ?? 0)));
  }

  function compare(op: string, sqlFn: () => void, kaappiFn: () => void, memoryFn: () => void): void {
    // Correctness check BEFORE timing, same discipline as every other
    // comparison this engagement has run — a misbehaving driver that
    // happens to be fast is not a result worth reporting.
    const sqlCheck = normalize(sqlFn());
    const memoryCheck = normalize(memoryFn());
    if (sqlCheck !== memoryCheck) {
      console.error(`MISMATCH on "${op}": SqlEntityDriver and MemoryEntityDriver returned different results. Aborting rather than reporting a misleading number.\nsql:    ${sqlCheck}\nmemory: ${memoryCheck}`);
      process.exit(1);
    }
    const sqlResult = timeRuns(op, runs, sqlFn);
    const kaappiResult = timeRuns(op, runs, kaappiFn);
    const memoryResult = timeRuns(op, runs, memoryFn);
    results.push({
      op,
      sqlMs: sqlResult.avgMs,
      kaappiMs: kaappiResult.avgMs,
      memoryMs: memoryResult.avgMs,
      kaappiRatio: kaappiResult.avgMs / sqlResult.avgMs,
      memoryRatio: memoryResult.avgMs / sqlResult.avgMs,
    });
  }

  compare(
    'getByName("Application" under "Root")',
    () => sql.getByName('Application', 'Root'),
    () => kaappi.getByName('Application', 'Root'),
    () => memory.getByName('Application', 'Root')
  );

  compare(
    `children(Application) — direct children only`,
    () => sql.children(applicationNode.id),
    () => kaappi.children(applicationNode.id),
    () => memory.children(applicationNode.id)
  );

  compare(
    `descendantsWithDepth(Application) — full subtree walk`,
    () => sql.descendantsWithDepth(applicationNode.id),
    () => kaappi.descendantsWithDepth(applicationNode.id),
    () => memory.descendantsWithDepth(applicationNode.id)
  );

  if (firstBusiness) {
    compare(
      `descendantsWithDepth(first business) — smaller subtree`,
      () => sql.descendantsWithDepth(firstBusiness.id),
      () => kaappi.descendantsWithDepth(firstBusiness.id),
      () => memory.descendantsWithDepth(firstBusiness.id)
    );
  }

  const sampleIds = sql.descendantsWithDepth(applicationNode.id).slice(0, 50).map((n) => n.id);
  compare(
    `getMany(50 ids)`,
    () => sql.getMany(sampleIds),
    () => kaappi.getMany(sampleIds),
    () => memory.getMany(sampleIds)
  );

  console.log(
    'operation'.padEnd(55),
    'sql (ms)'.padStart(10),
    'kaappi (ms)'.padStart(12),
    'memory (ms)'.padStart(12),
    'kaappi/sql'.padStart(11),
    'memory/sql'.padStart(11)
  );
  for (const r of results) {
    console.log(
      r.op.padEnd(55),
      r.sqlMs.toFixed(3).padStart(10),
      r.kaappiMs.toFixed(3).padStart(12),
      r.memoryMs.toFixed(3).padStart(12),
      `${r.kaappiRatio.toFixed(1)}x`.padStart(11),
      `${r.memoryRatio.toFixed(2)}x`.padStart(11)
    );
  }

  const kaappiSlower = results.filter((r) => r.kaappiRatio > 1);
  const kaappiFaster = results.filter((r) => r.kaappiRatio <= 1);
  const memorySlower = results.filter((r) => r.memoryRatio > 1);
  const memoryFaster = results.filter((r) => r.memoryRatio <= 1);
  console.log(
    `\n${kaappiSlower.length}/${results.length} operations: Kaappi slower than SQL.` +
      (kaappiFaster.length ? ` ${kaappiFaster.length} operation(s) where Kaappi was not slower.` : '')
  );
  console.log(
    `${memorySlower.length}/${results.length} operations: MemoryEntityDriver slower than SQL.` +
      (memoryFaster.length ? ` ${memoryFaster.length} operation(s) where MemoryEntityDriver was as fast or faster.` : '')
  );

  process.exit(0); // KaappiEntityDriver's worker is unref'd but this is explicit, not relied-upon
}

main();
