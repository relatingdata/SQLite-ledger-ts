// Docs: docs/coding-standards.md § How it is measured and enforced
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const argv = process.argv.slice(2);
const optionValue = (flag: string): string | undefined => {
  const at = argv.indexOf(flag);
  return at >= 0 ? argv[at + 1] : undefined;
};
const namesArg = optionValue('--names');
const patternArg = optionValue('--pattern');
const SCAN = ['backend', 'frontend/src', 'e2e', 'shared-fixtures', 'scripts', 'docs'];
const SKIP_DIRS = new Set(['node_modules', '.git', '.svelte-kit', 'dist', 'data', 'manual-images', 'test-results', 'playwright-report']);
const SKIP_FILES = /^docs\/(programmer-manual|user-manual|naming-vocabulary-analysis|classification-neutrality-analysis|documentation-baseline-report)\.md$/;
const EXT = /\.(ts|svelte|js|sql|md|csv|json)$/;

const areaOf = (rel: string): string => {
  if (rel.startsWith('backend/src/')) return 'backend src';
  if (rel.startsWith('backend/')) return 'backend tests+scripts';
  if (rel.startsWith('frontend/')) return 'frontend';
  if (rel.startsWith('docs/')) return 'docs';
  return 'e2e, fixtures, scripts';
};
const AREAS = ['backend src', 'backend tests+scripts', 'frontend', 'e2e, fixtures, scripts', 'docs'];

function walk(dir: string, out: string[] = []): string[] {
  let names: string[];
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXT.test(name)) out.push(full);
  }
  return out;
}

if (!namesArg && !patternArg) {
  console.error('Usage: find-uses.ts --names a,b,c   |   --pattern <regex>');
  process.exit(1);
}

interface Hit { lines: number; files: Set<string>; byArea: Record<string, number> }
const hits = new Map<string, Hit>();
const record = (key: string, rel: string): void => {
  const h = hits.get(key) ?? { lines: 0, files: new Set<string>(), byArea: {} };
  h.lines++; h.files.add(rel);
  h.byArea[areaOf(rel)] = (h.byArea[areaOf(rel)] ?? 0) + 1;
  hits.set(key, h);
};

const names = namesArg ? namesArg.split(',').map((n) => n.trim()).filter(Boolean) : [];
const nameRes = names.map((n) => [n, new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)] as const);
const patternRe = patternArg ? new RegExp(patternArg) : null;
for (const n of names) hits.set(n, { lines: 0, files: new Set(), byArea: {} });

const allFiles = new Set<string>();
for (const file of SCAN.flatMap((d) => walk(join(ROOT, d)))) {
  const rel = relative(ROOT, file).split(sep).join('/');
  if (SKIP_FILES.test(rel)) continue;
  for (const line of readFileSync(file, 'utf-8').split('\n')) {
    for (const [n, re] of nameRes) if (re.test(line)) { record(n, rel); allFiles.add(rel); }
    if (patternRe) {
      const seen = new Set<string>();
      for (const token of line.match(/[A-Za-z_]\w*/g) ?? []) {
        if (patternRe.test(token) && !seen.has(token)) { seen.add(token); record(token, rel); allFiles.add(rel); }
      }
    }
  }
}

const rows = [...hits.entries()].sort((a, b) => b[1].lines - a[1].lines);
const pad = (s: string | number, n: number): string => String(s).padStart(n);
console.log(`${'name'.padEnd(44)} ${pad('lines', 6)} ${pad('files', 6)}   by area (${AREAS.map((a) => a.split(' ')[0]).join(' / ')})`);
for (const [key, h] of rows.slice(0, 60)) {
  console.log(`${key.padEnd(44)} ${pad(h.lines, 6)} ${pad(h.files.size, 6)}   ${AREAS.map((a) => h.byArea[a] ?? 0).join(' / ')}`);
}
if (rows.length > 60) console.log(`… ${rows.length - 60} more names`);
console.log(`\n${rows.length} name(s); ${rows.reduce((n, [, h]) => n + h.lines, 0)} referencing line(s) in ${allFiles.size} distinct file(s).`);
