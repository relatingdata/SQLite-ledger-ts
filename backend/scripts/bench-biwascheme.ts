// bench-biwascheme.ts — permanent, git-tracked capability (never a
// disposable script): isolates ONE specific variable left open by
// bench-entity-drivers.ts's own findings — how much of Kaappi's measured
// slowdown (78x-1079x, see that script's own header and the plan log) was
// the subprocess/worker-thread/Atomics IPC boundary, versus the linear-scan,
// no-index data structure entity-model/entities.sld actually uses.
//
// BiwaScheme (https://www.npmjs.com/package/biwascheme) is a Scheme
// interpreter written IN JavaScript, so it runs in the SAME Node process —
// no subprocess, no worker thread, no JSON (de)serialization across a
// pipe, no Atomics.wait/notify. This script defines the SAME linear-scan
// algorithm entities.sld uses (find-by-name / children-of / a BFS
// descendants-with-depth over `filter`), in Scheme, run in-process via
// BiwaScheme, over the SAME real entity rows a bootstrapped db copy holds
// — then times it against SqlEntityDriver on the identical rows, in the
// same run, so the two numbers are directly comparable.
//
// This is NOT a claim that BiwaScheme could replace Kaappi for real (it
// has nowhere near Kaappi's R7RS coverage, performance engineering, or
// this project's own entity-model code) — it is a controlled probe, with
// the transport variable removed, answering: is Kaappi's measured
// slowdown dominated by crossing a process boundary, or by the no-index
// linear scan underneath it?
//
// Usage:
//   tsx scripts/bench-biwascheme.ts <path-to-db-copy> [--runs N]
//
// Same safety discipline as bench-entity-drivers.ts/migrate-entities-to-
// kaappi.ts: refuses the live default db path without
// MIGRATE_ALLOW_LIVE_DB=1. Read-only — never writes to the db.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// No @types/biwascheme exists (confirmed: not published) — treated as a
// loosely-typed import at this one boundary rather than hand-writing and
// maintaining a declaration file for a library used only by this one,
// investigative script.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BiwaScheme: any = require('biwascheme');

function flagValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

function timeRuns(runs: number, fn: () => void): number {
  fn(); // untimed warm-up, same convention as bench-entity-drivers.ts
  const start = performance.now();
  for (let i = 0; i < runs; i++) fn();
  return (performance.now() - start) / runs;
}

// Scheme string literals: backslash and double-quote need escaping; a real
// entity name is never expected to contain a literal newline (the rest of
// this engagement already relies on that for CSV framing), so no \n
// handling is needed here either.
function schemeString(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

async function main(): Promise<void> {
  const [, , dbPathArg, ...rest] = process.argv;
  if (!dbPathArg) {
    console.error('usage: tsx scripts/bench-biwascheme.ts <path-to-db-copy> [--runs N]');
    process.exit(1);
  }
  const runs = Number(flagValue(rest, '--runs') ?? '20');
  const dbPath = path.resolve(dbPathArg);

  const liveDefaultPath = path.resolve(__dirname, '..', 'data', 'entities.sqlite');
  if (dbPath === liveDefaultPath && !process.env.MIGRATE_ALLOW_LIVE_DB) {
    console.error(`refusing to run against the live default database path (${liveDefaultPath}). Use a disposable copy (see bench-entity-drivers.ts's own header for the exact steps).`);
    process.exit(1);
  }
  if (!fs.existsSync(dbPath)) {
    console.error(`no database file at ${dbPath}`);
    process.exit(1);
  }

  process.env.DB_PATH = dbPath;
  // Same confirmed circular-import fix as bench-entity-drivers.ts: db.ts
  // must finish initializing before sql-entity-driver.js is imported on
  // its own.
  await import('../src/db.js');
  const { SqlEntityDriver } = await import('../src/drivers/sql-entity-driver.js');
  const sql = new SqlEntityDriver();

  const applicationNode = sql.getByName('Application', 'Root');
  if (!applicationNode) {
    console.error('no "Application" entity under "Root" in this db — is it a real, bootstrapped dev/test db?');
    process.exit(1);
  }
  const subtree = sql.descendantsWithDepth(applicationNode.id); // real rows, root included at depth 0 — same data bench-entity-drivers.ts measured SQL/Kaappi against

  console.log(`Benchmarking against: ${dbPath}`);
  console.log(`subtree rooted at "Application": ${subtree.length} entities`);
  console.log(`runs per operation: ${runs} (plus one untimed warm-up each)\n`);

  // ---- build the BiwaScheme side: the SAME linear-scan algorithm shape
  // entity-model/entities.sld actually uses (confirmed by reading that
  // file directly) — a flat list, `filter`/`find`-style scans, no index —
  // populated with the real rows above, defined ONCE (excluded from the
  // timed runs, same "one-time setup" convention as Kaappi's own WAL
  // replay being excluded in bench-entity-drivers.ts).
  const schemeRows = subtree
    .map((r) => `(list ${r.id} ${schemeString(r.name)} ${r.parent_id === null ? '#f' : r.parent_id})`)
    .join(' ');

  const setupProgram = `
    (define entity-list (list ${schemeRows}))
    (define (entity-id e) (car e))
    (define (entity-name e) (cadr e))
    (define (entity-parent e) (caddr e))
    (define (find-by-name name lst)
      (cond ((null? lst) #f)
            ((string=? (entity-name (car lst)) name) (car lst))
            (else (find-by-name name (cdr lst)))))
    (define (children-of pid lst)
      (filter (lambda (e) (and (entity-parent e) (= (entity-parent e) pid))) lst))
    (define (descendants-with-depth root-id lst)
      (let loop ((frontier (list root-id)) (acc (list root-id)))
        (if (null? frontier)
            (reverse acc)
            (let* ((child-lists (map (lambda (pid) (children-of pid lst)) frontier))
                   (all-children (apply append child-lists))
                   (child-ids (map entity-id all-children)))
              (loop child-ids (append (reverse child-ids) acc))))))
  `;

  function freshInterp() {
    const interp = new BiwaScheme.Interpreter((e: unknown) => console.error('[biwascheme error]', e));
    interp.evaluate(setupProgram, () => {});
    return interp;
  }

  const interp = freshInterp();

  function evalSync(expr: string): unknown {
    let result: unknown;
    let ran = false;
    interp.evaluate(expr, (r: unknown) => {
      result = r;
      ran = true;
    });
    if (!ran) throw new Error(`BiwaScheme: "${expr}" did not call back synchronously — this script assumes pure computation with no async port I/O.`);
    return result;
  }

  // Correctness check before timing anything, same discipline as every
  // other verification this engagement has done — not just assumed.
  const biwaDescendants = evalSync(`(length (descendants-with-depth ${applicationNode.id} entity-list))`);
  if (biwaDescendants !== subtree.length) {
    console.error(`MISMATCH: SQL subtree has ${subtree.length} entities, BiwaScheme's own descendants-with-depth counted ${biwaDescendants}.`);
    process.exit(1);
  }
  console.log(`correctness check: BiwaScheme's own BFS counted ${biwaDescendants} descendants — matches SQL.\n`);

  const results: { op: string; sqlMs: number; biwaMs: number; ratio: number }[] = [];
  function compare(op: string, sqlFn: () => void, biwaExpr: string): void {
    const sqlMs = timeRuns(runs, sqlFn);
    const biwaMs = timeRuns(runs, () => evalSync(biwaExpr));
    results.push({ op, sqlMs, biwaMs, ratio: biwaMs / sqlMs });
  }

  compare(
    'getByName / find-by-name ("Application")',
    () => sql.getByName('Application', 'Root'),
    `(find-by-name ${schemeString('Application')} entity-list)`
  );
  compare(
    'children(Application)',
    () => sql.children(applicationNode.id),
    `(children-of ${applicationNode.id} entity-list)`
  );
  compare(
    'descendantsWithDepth(Application) — full subtree walk',
    () => sql.descendantsWithDepth(applicationNode.id),
    `(descendants-with-depth ${applicationNode.id} entity-list)`
  );

  console.log('operation'.padEnd(45), 'sql (ms)'.padStart(10), 'biwascheme (ms)'.padStart(16), 'biwa/sql'.padStart(10));
  for (const r of results) {
    console.log(r.op.padEnd(45), r.sqlMs.toFixed(3).padStart(10), r.biwaMs.toFixed(3).padStart(16), `${r.ratio.toFixed(1)}x`.padStart(10));
  }
  console.log(
    `\nSame algorithm shape as entity-model/entities.sld (linear filter/find, no index), zero subprocess/IPC boundary. ` +
      `Compare against bench-entity-drivers.ts's own numbers for the real, subprocess-backed KaappiEntityDriver on this same "Application" subtree.`
  );
}

main();
