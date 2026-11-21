#!/usr/bin/env bun
// Runs every standalone test in shared-fixtures/tests/ through the step
// runner, each on a fresh database of its own, and reports each by name.
//
//   run-step-tests.ts api [name…]   the original middleware, in process,
//                                   a new database file per test
//   run-step-tests.ts ui  [name…]   the browser against the running
//                                   servers, `make reset-db ensure-servers`
//                                   before each test
//
// A test never relies on another test or on demo data: it builds what it
// needs, mostly through shared-fixtures/common/*.csv. With names, only
// those tests run. Exits non-zero when any test fails.
// Documented in docs/pm-testing-e2e.md, "Standalone tests".
import { spawnSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testsDir = path.join(root, 'shared-fixtures', 'tests');
const [mode = 'api', ...only] = process.argv.slice(2);
if (mode !== 'api' && mode !== 'ui') {
  console.error('Usage: run-step-tests.ts api|ui [test-name …]');
  process.exit(2);
}
const runtime = process.env.RUN_SCRIPT ?? 'npx tsx';
const tests = readdirSync(testsDir)
  .filter((f) => f.endsWith('.csv') && !f.endsWith('.control.csv'))
  .map((f) => f.replace(/\.csv$/, ''))
  .filter((name) => only.length === 0 || only.includes(name))
  .sort();

const failed: string[] = [];
for (const name of tests) {
  console.log(`\n=== ${name} (${mode}) ===`);
  const env: NodeJS.ProcessEnv = { ...process.env, MIDDLEWARE: 'legacy' };
  if (mode === 'api') {
    const dbPath = path.join(os.tmpdir(), `step-test-${name}-${process.pid}.sqlite`);
    for (const suffix of ['', '-wal', '-shm']) rmSync(dbPath + suffix, { force: true });
    env.DB_PATH = dbPath;
    env.SEED_DEMO_BUSINESSES = 'false';
  } else {
    const reset = spawnSync('make', ['-s', 'reset-db', 'ensure-servers'], { cwd: root, stdio: 'inherit' });
    if (reset.status !== 0) { failed.push(name); continue; }
  }
  const [cmd, ...cmdArgs] = runtime.split(' ');
  const run = spawnSync(
    cmd,
    [...cmdArgs, 'scripts/step-runner.ts', `../shared-fixtures/tests/${name}.csv`, '--path', mode, '--non-interactive', '--delay', '0'],
    { cwd: path.join(root, 'backend'), env, stdio: 'inherit' }
  );
  if (run.status !== 0) failed.push(name);
}

console.log(`\n${tests.length - failed.length} of ${tests.length} standalone test(s) passed on the ${mode} path.`);
for (const name of failed) console.log(`  FAILED: ${name}`);
process.exit(failed.length > 0 ? 1 : 0);
