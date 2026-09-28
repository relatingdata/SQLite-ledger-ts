// Every test must be explained in the Programmer's Manual: its exact title must
// appear there. When a test fails, its title is the search key that leads from
// the failure to the explanation of the code it exercises.
// (docs/coding-standards.md, "Where explanation lives".)
//
// Tests that were undocumented when this check was introduced are listed in
// docs/test-documentation-baseline.txt. The check fails only for a test that is
// undocumented AND not in that list, so the gap can shrink but not grow.
//
// Run via `make check-test-docs`; regenerate the baseline (after documenting
// some tests) with `make test-docs-baseline`. Both first rebuild the manual.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const MANUAL = join(ROOT, 'docs', 'programmer-manual.md');
const BASELINE = join(ROOT, 'docs', 'test-documentation-baseline.txt');
const TEST_DIRS = ['backend/test', 'backend/scripts', 'frontend/test'];
const SKIP_DIRS = new Set(['node_modules', '.git']);
const writeBaseline = process.argv.includes('--write-baseline');

// Collapse whitespace so a title wrapped across lines in the manual still matches.
const normalise = (s: string): string => s.replace(/\s+/g, ' ').trim();

function walk(dir: string, out: string[] = []): string[] {
  let names: string[];
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

const TITLE_RE = /(?:^|\n)[ \t]*test\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`)/g;

interface TestRef { title: string; file: string }
const tests: TestRef[] = [];
for (const file of TEST_DIRS.flatMap((d) => walk(join(ROOT, d)))) {
  const rel = relative(ROOT, file).split(sep).join('/');
  const text = readFileSync(file, 'utf-8');
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

if (writeBaseline) {
  writeFileSync(BASELINE, [...new Set(undocumented.map((t) => t.title))].sort().join('\n') + '\n', 'utf-8');
  console.log(`\nWrote ${BASELINE} (${undocumented.length} undocumented test title(s)).`);
  process.exit(0);
}

const baseline = new Set(existsSync(BASELINE) ? readFileSync(BASELINE, 'utf-8').split('\n').map(normalise).filter(Boolean) : []);
const fresh = undocumented.filter((t) => !baseline.has(t.title));
const nowDocumented = [...baseline].filter((title) => manual.includes(title));
const gone = [...baseline].filter((title) => !tests.some((t) => t.title === title));

if (nowDocumented.length > 0) console.log(`\nNote: ${nowDocumented.length} baseline entr(ies) are now documented - shrink the baseline with "make test-docs-baseline".`);
if (gone.length > 0) console.log(`Note: ${gone.length} baseline entr(ies) no longer match any test (renamed or removed) - "make test-docs-baseline" clears them.`);

if (fresh.length > 0) {
  console.error(`\nFAIL: ${fresh.length} test(s) are not explained anywhere in the Programmer's Manual:`);
  for (const t of fresh) console.error(`   ${t.file}: ${t.title}`);
  console.error('\nDocument each one next to the code it exercises (see docs/coding-standards.md, "Where explanation lives"),');
  console.error('so that its exact title appears in the manual.');
  process.exit(1);
}
console.log(`\nOK: no new undocumented tests (${baseline.size} known, tracked gaps remain in the baseline).`);
