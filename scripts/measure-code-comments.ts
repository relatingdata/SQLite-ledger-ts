// Docs: docs/coding-standards.md § How it is measured and enforced
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SCAN_DIRS = ['backend/src', 'backend/test', 'backend/scripts', 'frontend/src', 'e2e', 'scripts', 'shared-fixtures'];
const SKIP_DIRS = new Set(['node_modules', '.git', '.svelte-kit', 'dist', 'data', 'test-results', 'playwright-report']);
const EXTENSIONS = ['.ts', '.svelte', '.js', '.sql'];
const POINTER = /docs\/[\w./-]+\.md|Programmer'?s Manual/i;
// Comment lines that are structure rather than prose: the pointer itself (and its
// header sentence), @deprecated tags, and directives the tools act on.
const STRUCTURAL = /docs\/[\w./-]+\.md|Programmer'?s Manual|The full,? (real )?documentation|@deprecated|@ts-|eslint|prettier|\/\/\/\s*</i;

function walk(dir: string, out: string[] = []): string[] {
  let names: string[];
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.some((e) => name.endsWith(e))) out.push(full);
  }
  return out;
}

interface Row { file: string; area: string; code: number; comments: number; pointers: number; migrated: boolean }

// `make show-comments FILE=path [FROM=n TO=m]` lists a file's comment lines,
// so a migration can see exactly what must move into the manual first.
const argv = process.argv.slice(2);
const showIdx = argv.indexOf('--show');
if (showIdx >= 0) {
  const target = join(ROOT, argv[showIdx + 1] ?? '');
  const from = Number(argv[argv.indexOf('--from') + 1]) || 1;
  const to = Number(argv[argv.indexOf('--to') + 1]) || Infinity;
  let inBlockShow = false;
  let shown = 0;
  readFileSync(target, 'utf-8').split('\n').forEach((raw, i) => {
    const line = raw.trim();
    let isComment = false;
    if (inBlockShow) { isComment = true; if (line.includes('*/') || line.includes('-->')) inBlockShow = false; }
    else if (line && /^(\/\/|\/\*|\*|<!--|--)/.test(line)) {
      isComment = true;
      if ((line.startsWith('/*') && !line.includes('*/')) || (line.startsWith('<!--') && !line.includes('-->'))) inBlockShow = true;
    }
    if (isComment && i + 1 >= from && i + 1 <= to) { console.log(`${String(i + 1).padStart(5)}: ${raw}`); shown++; }
  });
  console.log(`\n${shown} comment line(s) in ${argv[showIdx + 1]}${from > 1 || to < Infinity ? ` (lines ${from}-${to})` : ''}`);
  process.exit(0);
}

function areaOf(rel: string): string {
  if (rel.startsWith('backend/src/')) return 'backend library (src)';
  if (rel.startsWith('backend/test/')) return 'backend tests';
  if (rel.startsWith('frontend/src/')) return 'frontend';
  if (rel.endsWith('.sql')) return 'schema';
  return 'scripts, e2e, fixtures';
}

const rows: Row[] = [];
for (const file of SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)))) {
  const rel = relative(ROOT, file).split(sep).join('/');
  let code = 0; let comments = 0; let pointers = 0; let prose = 0; let inBlock = false;
  for (const raw of readFileSync(file, 'utf-8').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    let isComment = false;
    if (inBlock) { isComment = true; if (line.includes('*/') || line.includes('-->')) inBlock = false; }
    else if (/^(\/\/|\/\*|\*|<!--|--)/.test(line)) {
      isComment = true;
      if ((line.startsWith('/*') && !line.includes('*/')) || (line.startsWith('<!--') && !line.includes('-->'))) inBlock = true;
    }
    if (isComment) { comments++; if (POINTER.test(line)) pointers++; if (!STRUCTURAL.test(line)) prose++; } else code++;
  }
  rows.push({ file: rel, area: areaOf(rel), code, comments, pointers, migrated: pointers > 0 && prose === 0 });
}

const pad = (s: string | number, n: number) => String(s).padStart(n);
console.log('Comment lines by area (comment lines are lines that are only a comment; a trailing comment counts as code)');
console.log('');
console.log(`${'area'.padEnd(26)} ${pad('files', 6)} ${pad('code', 8)} ${pad('comments', 9)} ${pad('% comment', 10)} ${pad('migrated', 9)} ${pad('unmigrated', 11)}`);
const areas = [...new Set(rows.map((r) => r.area))].sort();
let totalCode = 0; let totalComments = 0;
for (const a of areas) {
  const rs = rows.filter((r) => r.area === a);
  const code = rs.reduce((n, r) => n + r.code, 0);
  const comments = rs.reduce((n, r) => n + r.comments, 0);
  const migrated = rs.filter((r) => r.migrated).length;
  totalCode += code; totalComments += comments;
  console.log(`${a.padEnd(26)} ${pad(rs.length, 6)} ${pad(code, 8)} ${pad(comments, 9)} ${pad((100 * comments / Math.max(1, code + comments)).toFixed(0) + '%', 10)} ${pad(migrated, 9)} ${pad(rs.length - migrated, 11)}`);
}
console.log(`${'TOTAL'.padEnd(26)} ${pad(rows.length, 6)} ${pad(totalCode, 8)} ${pad(totalComments, 9)} ${pad((100 * totalComments / (totalCode + totalComments)).toFixed(0) + '%', 10)}`);
console.log('');
console.log('Largest unmigrated files by comment lines:');
for (const r of rows.filter((x) => !x.migrated).sort((a, b) => b.comments - a.comments).slice(0, 20)) {
  console.log(`  ${pad(r.comments, 5)} comment / ${pad(r.code, 5)} code   ${r.file}${r.pointers ? `   (${r.pointers} pointer)` : ''}`);
}
console.log('');
console.log('Files already migrated (pointer to the manual, few comments of their own):');
for (const r of rows.filter((x) => x.migrated)) console.log(`  ${r.file}  (${r.comments} comment line(s))`);
