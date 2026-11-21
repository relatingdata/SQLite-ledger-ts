#!/usr/bin/env bun
// The manuals' pictures and the tests that take them. A picture is taken
// by the step runner, in the browser, at a step whose control row names
// it in the screenshot column; the test file that step belongs to builds
// the data the picture shows.
//
//   manual-pictures.ts check         every picture a chapter of docs/
//                                    shows (manual-images*/x.png) is taken
//                                    by some test or tutorial, or made by
//                                    a Makefile rule from one that is
//   manual-pictures.ts take <file>   takes that one picture: runs the
//                                    standalone test (or the tutorial's
//                                    browser target) that takes it
//
// Documented in docs/pm-testing-e2e.md, "Pictures for the manuals".
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = process.env.RUN_SCRIPT ?? 'npx tsx';
const fixtures = path.join(root, 'shared-fixtures');

// The tutorials take their pictures through their own make targets.
const TUTORIAL_TARGETS: Record<string, string> = {
  'shared-fixtures/tutorial-steps.csv': 'test-e2e-tutorial-browser',
  'shared-fixtures/manufacturing-tutorial-steps.csv': 'test-e2e-manufacturing-tutorial-browser',
  'shared-fixtures/project-builder-tutorial-steps.csv': 'test-e2e-project-builder-tutorial-browser',
};

function run(cmd: string, args: string[], cwd = root): { status: number | null; stdout: string } {
  const [bin, ...pre] = cmd.split(' ');
  const r = spawnSync(bin, [...pre, ...args], { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, SEED_DEMO_BUSINESSES: 'false' } });
  return { status: r.status, stdout: r.stdout ?? '' };
}

/** picture (repository path) -> the data file whose steps take it. */
function takenBy(): Map<string, string> {
  const files = [
    ...Object.keys(TUTORIAL_TARGETS),
    ...readdirSync(path.join(fixtures, 'tests'))
      .filter((f) => f.endsWith('.csv') && !f.endsWith('.control.csv'))
      .map((f) => `shared-fixtures/tests/${f}`),
  ];
  const listed = run(runtime, ['scripts/step-runner.ts', ...files.map((f) => `../${f}`), '--list-screenshots'], path.join(root, 'backend'));
  if (listed.status !== 0) throw new Error('step-runner.ts --list-screenshots failed.');
  const map = new Map<string, string>();
  for (const line of listed.stdout.split('\n').filter(Boolean)) {
    const [file, picture] = line.split('\t');
    map.set(picture, file);
  }
  return map;
}

/** picture -> the picture a Makefile rule makes it from. */
function madeFrom(): Map<string, string> {
  const makefile = readFileSync(path.join(root, 'Makefile'), 'utf-8');
  const map = new Map<string, string>();
  for (const m of makefile.matchAll(/^(docs\/manual-images[^/\s]*\/[\w.-]+\.png):\s+(docs\/manual-images[^/\s]*\/[\w.-]+\.png)/gm)) map.set(m[1], m[2]);
  return map;
}

const [command, target] = process.argv.slice(2);
if (command === 'check') {
  const taken = takenBy();
  const derived = madeFrom();
  const shown = new Map<string, string>();
  for (const f of readdirSync(path.join(root, 'docs')).filter((f) => f.endsWith('.md'))) {
    for (const m of readFileSync(path.join(root, 'docs', f), 'utf-8').matchAll(/\((manual-images[^/\s)]*\/[\w.-]+\.png)\)/g)) shown.set(`docs/${m[1]}`, `docs/${f}`);
  }
  const missing = [...shown].filter(([p]) => !taken.has(p) && !(derived.has(p) && taken.has(derived.get(p)!)));
  console.log(`${shown.size} picture(s) shown in docs/, ${taken.size} taken by tests and tutorials.`);
  for (const [p, chapter] of missing) console.error(`  ${chapter} shows ${p}, which no test takes.`);
  if (missing.length > 0) {
    console.error('\n❌ FAIL: give each picture a test whose control file takes it (docs/pm-testing-e2e.md, "Pictures for the manuals").');
    process.exit(1);
  }
  console.log('✅ PASS: every picture the manuals show is taken by a test.');
} else if (command === 'take' && target) {
  const file = takenBy().get(target);
  if (!file) {
    console.error(`No test takes ${target}.`);
    process.exit(1);
  }
  const make = TUTORIAL_TARGETS[file];
  const r = make
    ? spawnSync('make', [make], { cwd: root, stdio: 'inherit' })
    : spawnSync(runtime.split(' ')[0], [...runtime.split(' ').slice(1), 'scripts/run-step-tests.ts', 'ui', path.basename(file, '.csv')], { cwd: root, stdio: 'inherit' });
  process.exit(r.status ?? 1);
} else {
  console.error('Usage: manual-pictures.ts check | take <docs/manual-images/x.png>');
  process.exit(2);
}
