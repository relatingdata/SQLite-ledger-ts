// Docs: docs/coding-standards.md § How it is measured and enforced
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const pattern = process.argv[2];
if (!pattern) {
  console.error('Usage: find-symbols.ts <regex>   (case-insensitive)');
  process.exit(1);
}
const re = new RegExp(pattern, 'i');
const SKIP = new Set(['node_modules', '.git', '.svelte-kit', 'dist', 'data', 'manual-images', 'test-results', 'playwright-report']);

function walk(dir: string, out: string[] = []): string[] {
  let names: string[];
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const DECLARATIONS: [RegExp, string][] = [
  [/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_]\w*)/, 'function'],
  [/^\s*export\s+(?:const|let)\s+([A-Za-z_]\w*)/, 'const'],
  [/^\s*(?:export\s+)?(?:interface|type|class|enum)\s+([A-Za-z_]\w*)/, 'type'],
  [/CREATE\s+(?:TABLE|VIEW|TRIGGER)\s+(?:IF NOT EXISTS\s+)?([A-Za-z_]\w*)/i, 'sql'],
  [/^#{1,4}\s+(.+)$/, 'doc heading'],
];

const rows: { kind: string; where: string; text: string }[] = [];
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).split(sep).join('/');
  if (rel === 'docs/programmer-manual.md' || rel === 'docs/user-manual.md' || rel.startsWith('docs/classification-neutrality-analysis')) continue;
  if (/\/routes\//.test(rel) && re.test(rel) && rel.endsWith('+page.svelte')) rows.push({ kind: 'screen', where: rel, text: '' });
  if (!/\.(ts|sql|md)$/.test(rel)) continue;
  const isDoc = rel.endsWith('.md');
  readFileSync(file, 'utf-8').split('\n').forEach((line, i) => {
    for (const [d, kind] of DECLARATIONS) {
      if ((kind === 'doc heading') !== isDoc) continue;
      const m = line.match(d);
      if (m && re.test(m[1])) { rows.push({ kind, where: `${rel}:${i + 1}`, text: m[1].trim().slice(0, 90) }); break; }
    }
  });
}

const order = ['function', 'type', 'const', 'sql', 'screen', 'doc heading'];
rows.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.where.localeCompare(b.where));
let last = '';
for (const r of rows) {
  if (r.kind !== last) { console.log(`\n== ${r.kind} ==`); last = r.kind; }
  console.log(`  ${r.where}  ${r.text}`);
}
console.log(`\n${rows.length} match(es) for /${pattern}/i`);
