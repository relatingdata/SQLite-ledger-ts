// bench-scan-baseline.ts — permanent, git-tracked capability: directly
// tests a specific claim raised about bench-entity-drivers.ts/
// bench-biwascheme.ts's own findings — that SQL's advantage there was
// mainly "it has an index," which should be a negligible effect at the
// data sizes this project's own entity tree actually holds (~3000-5000
// rows). Three variants of the SAME children()-per-BFS-frontier-node
// algorithm, over the SAME real rows:
//
//   1. SQL, indexed  — current_entities WHERE parent_id = ?, the real
//      SqlEntityDriver.children query, index use confirmed via
//      EXPLAIN QUERY PLAN before any timing.
//   2. SQL, forced full scan — the identical query with NOT INDEXED on
//      every table reference (including the view's own correlated
//      "which row is current" subquery), confirmed via EXPLAIN QUERY
//      PLAN to produce a real SCAN, not an index SEARCH.
//   3. Plain JS, no SQL at all — Array.prototype.filter over an
//      in-memory array of the same rows, no interpreter, no index,
//      nothing but V8's own JIT.
//
// This isolates "indexed vs. unindexed SQL" from "compiled/JIT'd loop
// vs. interpreted traversal" (the actual explanation bench-biwascheme.ts
// settled on) — if (2) and (3) land close together and both nowhere
// near bench-biwascheme.ts's 8.3ms-per-children-call or
// bench-entity-drivers.ts's 9+ second descendantsWithDepth, the earlier
// "no index" framing was an overstatement: the real gap is interpreted
// traversal of boxed/cons-cell data vs. ANY tight compiled loop over
// compact rows, indexed or not.
//
// Usage:
//   tsx scripts/bench-scan-baseline.ts <path-to-db-copy> [--runs N]
//
// Same safety discipline as the other bench-*.ts scripts: refuses the
// live default db path without MIGRATE_ALLOW_LIVE_DB=1. Read-only.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function flagValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

function timeRuns(runs: number, fn: () => void): number {
  fn(); // untimed warm-up, same convention as the other bench-*.ts scripts
  const start = performance.now();
  for (let i = 0; i < runs; i++) fn();
  return (performance.now() - start) / runs;
}

async function main(): Promise<void> {
  const [, , dbPathArg, ...rest] = process.argv;
  if (!dbPathArg) {
    console.error('usage: tsx scripts/bench-scan-baseline.ts <path-to-db-copy> [--runs N]');
    process.exit(1);
  }
  const runs = Number(flagValue(rest, '--runs') ?? '50');
  const dbPath = path.resolve(dbPathArg);

  const liveDefaultPath = path.resolve(__dirname, '..', 'data', 'entities.sqlite');
  if (dbPath === liveDefaultPath && !process.env.MIGRATE_ALLOW_LIVE_DB) {
    console.error(`refusing to run against the live default database path (${liveDefaultPath}). Use a disposable copy.`);
    process.exit(1);
  }
  if (!fs.existsSync(dbPath)) {
    console.error(`no database file at ${dbPath}`);
    process.exit(1);
  }

  process.env.DB_PATH = dbPath;
  await import('../src/db.js'); // same confirmed circular-import fix as the other bench-*.ts scripts
  const { SqlEntityDriver } = await import('../src/drivers/sql-entity-driver.js');
  const { db } = await import('../src/db.js');
  const sql = new SqlEntityDriver();

  const applicationNode = sql.getByName('Application', 'Root');
  if (!applicationNode) {
    console.error('no "Application" entity under "Root" in this db — is it a real, bootstrapped dev/test db?');
    process.exit(1);
  }
  const subtree = sql.descendantsWithDepth(applicationNode.id); // the real rows, via SQL's own single recursive CTE — ground truth for correctness checks below

  console.log(`Benchmarking against: ${dbPath}`);
  console.log(`subtree rooted at "Application": ${subtree.length} entities`);
  console.log(`runs per operation: ${runs} (plus one untimed warm-up each)\n`);

  // ---- variant 1: SQL, indexed (the real SqlEntityDriver.children query) ----
  const indexedStmt = db.prepare(`SELECT id, name, parent_id, relation_id FROM current_entities WHERE parent_id = ?`);
  const indexedPlan = db.prepare(`EXPLAIN QUERY PLAN ${indexedStmt.source}`).all(applicationNode.id) as { detail: string }[];
  console.log('indexed query plan:', indexedPlan.map((p) => p.detail).join(' | '));
  if (!indexedPlan.some((p) => p.detail.includes('USING INDEX') || p.detail.includes('USING COVERING INDEX'))) {
    console.error('expected the indexed query to actually use an index — plan does not show one. Aborting rather than reporting a misleading number.');
    process.exit(1);
  }

  // ---- variant 2: SQL, forced full scan (NOT INDEXED on every table ref,
  // including the view's own correlated "is this the current version"
  // subquery, hand-expanded here since NOT INDEXED can't be pushed through
  // a view reference) ----
  const forcedStmt = db.prepare(`
    SELECT entity_id AS id, name, parent_id, relation_id FROM entities e NOT INDEXED
    WHERE parent_id = ? AND row_id = (
      SELECT row_id FROM entities e2 NOT INDEXED WHERE e2.entity_id = e.entity_id
      ORDER BY created_at DESC, row_id DESC LIMIT 1
    )
  `);
  const forcedPlan = db.prepare(`EXPLAIN QUERY PLAN ${forcedStmt.source}`).all(applicationNode.id) as { detail: string }[];
  console.log('forced-full-scan query plan:', forcedPlan.map((p) => p.detail).join(' | '));
  if (!forcedPlan.every((p) => !p.detail.includes('USING INDEX') && !p.detail.includes('USING COVERING INDEX'))) {
    console.error('expected NOT INDEXED to eliminate every index use — plan still shows one. Aborting rather than reporting a misleading number.');
    process.exit(1);
  }
  const indexedCount = indexedStmt.all(applicationNode.id).length;
  const forcedCount = forcedStmt.all(applicationNode.id).length;
  if (indexedCount !== forcedCount) {
    console.error(`MISMATCH: indexed query returned ${indexedCount} rows, forced-scan query returned ${forcedCount} — not a fair comparison.`);
    process.exit(1);
  }
  console.log(`correctness check: both SQL variants return ${indexedCount} rows for children(Application).\n`);

  // ---- variant 3: plain JS, no SQL, no interpreter — Array.filter over
  // an in-memory array of the exact same rows ----
  const plainRows = subtree.map((r) => ({ id: r.id, name: r.name, parent_id: r.parent_id }));
  function plainChildren(parentId: number) {
    return plainRows.filter((r) => r.parent_id === parentId);
  }
  const plainCount = plainChildren(applicationNode.id).length;
  if (plainCount !== indexedCount) {
    console.error(`MISMATCH: plain JS scan found ${plainCount} children, SQL found ${indexedCount}.`);
    process.exit(1);
  }

  // ---- single children() call, three ways ----
  const results: { op: string; ms: number }[] = [];
  results.push({ op: 'SQL, indexed', ms: timeRuns(runs, () => indexedStmt.all(applicationNode.id)) });
  results.push({ op: 'SQL, forced full scan (NOT INDEXED)', ms: timeRuns(runs, () => forcedStmt.all(applicationNode.id)) });
  results.push({ op: 'Plain JS, Array.filter (no SQL, no index)', ms: timeRuns(runs, () => plainChildren(applicationNode.id)) });

  console.log('children(Application) — one call:');
  console.log('  variant'.padEnd(45), 'avg ms'.padStart(10), 'vs indexed'.padStart(12));
  for (const r of results) console.log(`  ${r.op}`.padEnd(45), r.ms.toFixed(4).padStart(10), `${(r.ms / results[0].ms).toFixed(1)}x`.padStart(12));

  // ---- the same BFS shape bench-entity-drivers.ts/bench-biwascheme.ts
  // used (one children-equivalent scan per frontier node, not SQL's own
  // single recursive CTE) — so this is a fair, like-for-like comparison
  // against THEIR numbers, not against SqlEntityDriver.descendantsWithDepth's
  // own, structurally different single-query approach. ----
  function bfsCount(childrenFn: (parentId: number) => { id: number }[]): number {
    let frontier = [applicationNode.id];
    let count = 1; // root itself, same convention as the other bench-*.ts scripts
    const seen = new Set(frontier);
    while (frontier.length > 0) {
      const next: number[] = [];
      for (const pid of frontier) {
        for (const child of childrenFn(pid)) {
          if (seen.has(child.id)) continue;
          seen.add(child.id);
          count++;
          next.push(child.id);
        }
      }
      frontier = next;
    }
    return count;
  }

  const bfsResults: { op: string; ms: number }[] = [];
  const indexedBfsCount = bfsCount((pid) => indexedStmt.all(pid) as { id: number }[]);
  if (indexedBfsCount !== subtree.length) {
    console.error(`MISMATCH: BFS-via-repeated-children-calls counted ${indexedBfsCount}, SQL's own recursive CTE counted ${subtree.length}.`);
    process.exit(1);
  }
  console.log(`\ncorrectness check: BFS-via-repeated-children-calls counted ${indexedBfsCount} — matches SQL's own recursive CTE.\n`);

  bfsResults.push({ op: 'SQL, indexed', ms: timeRuns(Math.min(runs, 10), () => bfsCount((pid) => indexedStmt.all(pid) as { id: number }[])) });
  bfsResults.push({ op: 'SQL, forced full scan (NOT INDEXED)', ms: timeRuns(Math.min(runs, 10), () => bfsCount((pid) => forcedStmt.all(pid) as { id: number }[])) });
  bfsResults.push({ op: 'Plain JS, Array.filter (no SQL, no index)', ms: timeRuns(Math.min(runs, 10), () => bfsCount(plainChildren)) });

  console.log(`descendantsWithDepth(Application) — same BFS shape as bench-entity-drivers.ts/bench-biwascheme.ts:`);
  console.log('  variant'.padEnd(45), 'avg ms'.padStart(10), 'vs indexed'.padStart(12));
  for (const r of bfsResults) console.log(`  ${r.op}`.padEnd(45), r.ms.toFixed(3).padStart(10), `${(r.ms / bfsResults[0].ms).toFixed(1)}x`.padStart(12));

  console.log(
    `\nFor context: bench-biwascheme.ts measured 8.301ms for a single children(Application) call and 25249.859ms for the ` +
      `full BFS on this same subtree — both via an interpreted Scheme traversal of boxed cons cells, no SQL involved at all.`
  );
}

main();
