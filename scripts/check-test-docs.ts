// Every test must be explained in the Programmer's Manual: its exact title must
// appear there. When a test fails, its title is the search key that leads from
// the failure to the explanation of the code it exercises.
// (docs/coding-standards.md, "Where explanation lives".)
//
// The other direction holds too: every test the manual lists, as
//   - "title" (`file`)
// in a "Tests:" list, must be a test with that title in that file, so the
// manual cannot name a test that was renamed or removed.
//
// Run via `make check-test-docs` (it first rebuilds the manual).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const MANUAL = join(ROOT, 'docs', 'programmer-manual.md');
// TypeScript unit tests (`test('title', …)`), the Playwright specs
// (`e2e/tests/*.spec.ts`), and the storage engine's Gleam tests, whose
// title is the test function's name (`pub fn name_test()`).
const TEST_DIRS = ['backend/test', 'backend/scripts', 'frontend/test', 'e2e/tests', 'storage_engine/test'];
const SKIP_DIRS = new Set(['node_modules', '.git']);

// Collapse whitespace so a title wrapped across lines in the manual still matches.
const normalise = (s: string): string => s.replace(/\s+/g, ' ').trim();

function walk(dir: string, out: string[] = []): string[] {
  let names: string[];
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.test.ts') || name.endsWith('.spec.ts') || name.endsWith('_test.gleam')) out.push(full);
  }
  return out;
}

const GLEAM_RE = /^pub fn (\w+_test)\(/gm;
const TITLE_RE = /(?:^|\n)[ \t]*test(?:\.(?:only|skip|fixme|serial))?\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`)/g;

interface TestRef { title: string; file: string }
const tests: TestRef[] = [];
for (const file of TEST_DIRS.flatMap((d) => walk(join(ROOT, d)))) {
  const rel = relative(ROOT, file).split(sep).join('/');
  const text = readFileSync(file, 'utf-8');
  if (file.endsWith('.gleam')) {
    for (const m of text.matchAll(GLEAM_RE)) tests.push({ title: m[1], file: rel });
    continue;
  }
  for (const m of text.matchAll(TITLE_RE)) {
    const raw = m[1] ?? m[2] ?? m[3] ?? '';
    tests.push({ title: normalise(raw.replace(/\\(['"`\\])/g, '$1')), file: rel });
  }
}

if (!existsSync(MANUAL)) {
  console.error('docs/programmer-manual.md does not exist - run "make programmer-manual" first.');
  process.exit(1);
}
const manual = normalise(readFileSync(MANUAL, 'utf-8'));
const undocumented = tests.filter((t) => !manual.includes(t.title));
const documented = tests.length - undocumented.length;

const perFile = new Map<string, { total: number; missing: number }>();
for (const t of tests) {
  const e = perFile.get(t.file) ?? { total: 0, missing: 0 };
  e.total++;
  if (!manual.includes(t.title)) e.missing++;
  perFile.set(t.file, e);
}

console.log(`Tests found: ${tests.length}   documented in the manual: ${documented}   undocumented: ${undocumented.length}`);
for (const [file, e] of [...perFile].sort()) console.log(`   ${file}: ${e.total} test(s), ${e.missing} undocumented`);

// Every "Tests:" entry in the manual names a real test in a real file.
const real = new Set(tests.map((t) => `${t.file}\u0000${t.title}`));
const rawManual = readFileSync(MANUAL, 'utf-8');
const listed = [...rawManual.matchAll(/^- "(.*)" \(`([^`]+)`\)\s*$/gm)].map((m) => ({ title: normalise(m[1]), file: m[2] }));
const dangling = listed.filter((l) => !real.has(`${l.file}\u0000${l.title}`));

if (undocumented.length > 0) {
  console.error(`\nFAIL: ${undocumented.length} test(s) are not explained anywhere in the Programmer's Manual:`);
  for (const t of undocumented) console.error(`   ${t.file}: ${t.title}`);
  console.error('\nList each one under the section that explains the code it exercises (see docs/coding-standards.md, "Where explanation lives").');
}
if (dangling.length > 0) {
  console.error(`\nFAIL: ${dangling.length} test(s) the manual lists do not exist (renamed or removed):`);
  for (const l of dangling) console.error(`   ${l.file}: ${l.title}`);
}
if (undocumented.length > 0 || dangling.length > 0) process.exit(1);
console.log(`\nOK: all ${tests.length} tests are in the manual, and all ${listed.length} listed tests exist.`);
