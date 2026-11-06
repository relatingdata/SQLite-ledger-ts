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
  await import('../src/db.js');
  const [{ SqlEntityDriver }, { KaappiEntityDriver }] = await Promise.all([
    import('../src/drivers/sql-entity-driver.js'),
    import('../src/drivers/kaappi-entity-driver.js'),
  ]);

  const sql = new SqlEntityDriver();
  console.log('starting Kaappi subprocess + WAL replay (this is a one-time cost, excluded from every timed run below)...');
  const kaappi = new KaappiEntityDriver();

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

  const results: { op: string; sqlMs: number; kaappiMs: number; ratio: number }[] = [];

  function compare(op: string, sqlFn: () => void, kaappiFn: () => void): void {
    const sqlResult = timeRuns(op, runs, sqlFn);
    const kaappiResult = timeRuns(op, runs, kaappiFn);
    results.push({ op, sqlMs: sqlResult.avgMs, kaappiMs: kaappiResult.avgMs, ratio: kaappiResult.avgMs / sqlResult.avgMs });
  }

  compare(
    'getByName("Application" under "Root")',
    () => sql.getByName('Application', 'Root'),
    () => kaappi.getByName('Application', 'Root')
  );

  compare(
    `children(Application) — direct children only`,
    () => sql.children(applicationNode.id),
    () => kaappi.children(applicationNode.id)
  );

  compare(
    `descendantsWithDepth(Application) — full subtree walk`,
    () => sql.descendantsWithDepth(applicationNode.id),
    () => kaappi.descendantsWithDepth(applicationNode.id)
  );

  if (firstBusiness) {
    compare(
      `descendantsWithDepth(first business) — smaller subtree`,
      () => sql.descendantsWithDepth(firstBusiness.id),
      () => kaappi.descendantsWithDepth(firstBusiness.id)
    );
  }

  const sampleIds = sql.descendantsWithDepth(applicationNode.id).slice(0, 50).map((n) => n.id);
  compare(
    `getMany(50 ids)`,
    () => sql.getMany(sampleIds),
    () => kaappi.getMany(sampleIds)
  );

  console.log('operation'.padEnd(55), 'sql (ms)'.padStart(10), 'kaappi (ms)'.padStart(12), 'kaappi/sql'.padStart(11));
  for (const r of results) {
    console.log(
      r.op.padEnd(55),
      r.sqlMs.toFixed(3).padStart(10),
      r.kaappiMs.toFixed(3).padStart(12),
      `${r.ratio.toFixed(1)}x`.padStart(11)
    );
  }

  const slower = results.filter((r) => r.ratio > 1);
  const faster = results.filter((r) => r.ratio <= 1);
  console.log(
    `\n${slower.length}/${results.length} operations: Kaappi slower than SQL.` +
      (faster.length ? ` ${faster.length} operation(s) where Kaappi was not slower.` : '')
  );

  process.exit(0); // KaappiEntityDriver's worker is unref'd but this is explicit, not relied-upon
}

main();
