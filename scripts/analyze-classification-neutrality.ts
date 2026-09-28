// Impact analysis: where does the code give special treatment to a particular
// classification (hot/cold, storage, division, category)?
//
// The principle being measured: those are merely SUGGESTED classification
// hierarchies a business may choose (a wine shop's hot/cold, a hardware
// store's inside/outside). Locations and Items are the real things. So a
// classification word appearing in a function name, a table name, a hardcoded
// string, or a route is a place where one business's assumption was baked in.
//
// Reports, per term and per area: identifier hits, string-literal hits and
// comment hits; every definition named for a classification with its blast
// radius (files referencing it); and the distinct hardcoded strings.
//
// Run via `make analyze-classification`. Writes
// docs/classification-neutrality-analysis.md (generated - never hand-edited).
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = join(ROOT, 'docs', 'classification-neutrality-analysis.md');
const SCAN_DIRS = ['backend/src', 'backend/schema', 'backend/test', 'backend/scripts', 'frontend/src', 'e2e', 'shared-fixtures', 'scripts'];
const SKIP_DIRS = new Set(['node_modules', '.git', '.svelte-kit', 'dist', 'data', 'manual-images', 'test-results', 'playwright-report']);
const EXTENSIONS = ['.ts', '.svelte', '.sql', '.csv', '.js', '.json'];

// A term matches when any WORD of an identifier or string equals it, after
// splitting camelCase / PascalCase / snake_case / UPPER_CASE into words.
const TERMS: Record<string, (w: string) => boolean> = {
  cold: (w) => w === 'cold',
  hot: (w) => w === 'hot',
  refrigerated: (w) => w.startsWith('refrigerat'),
  storage: (w) => w === 'storage',
  division: (w) => w === 'division' || w === 'divisions',
  category: (w) => w === 'category' || w === 'categories',
};
const TERM_NAMES = Object.keys(TERMS);

const AREAS = ['backend src', 'frontend', 'schema: structure & seed', 'schema: translations (data)', 'tests, scripts, fixtures'] as const;
type Area = (typeof AREAS)[number];
const PRODUCTION: Area[] = ['backend src', 'frontend', 'schema: structure & seed'];

function areaOf(rel: string): Area {
  if (rel.startsWith('backend/src/')) return 'backend src';
  if (rel.startsWith('frontend/src/')) return 'frontend';
  if (rel.startsWith('backend/schema/')) return /\/10-vocab-/.test(rel) ? 'schema: translations (data)' : 'schema: structure & seed';
  return 'tests, scripts, fixtures';
}

function wordsOf(token: string): string[] {
  return (token.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|[0-9]+/g) ?? []).map((w) => w.toLowerCase());
}
function termsIn(text: string): Set<string> {
  const found = new Set<string>();
  for (const token of text.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) {
    if (/^(local|session)Storage$/.test(token)) continue; // browser API, not a classification
    for (const w of wordsOf(token)) for (const t of TERM_NAMES) if (TERMS[t](w)) found.add(t);
  }
  return found;
}

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

const STRING_RE = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;

interface Counts { identifier: number; string: number; comment: number }
const counts: Record<string, Record<Area, Counts>> = {};
for (const t of TERM_NAMES) {
  counts[t] = {} as Record<Area, Counts>;
  for (const a of AREAS) counts[t][a] = { identifier: 0, string: 0, comment: 0 };
}
const perFile: Record<string, Map<string, number>> = {};
for (const t of TERM_NAMES) perFile[t] = new Map();
const literals: Record<string, Map<string, { n: number; example: string }>> = {};
for (const t of TERM_NAMES) literals[t] = new Map();

interface Definition { term: string; name: string; kind: string; file: string; line: number }
const definitions: Definition[] = [];
const DECLARATIONS: [RegExp, number, string][] = [
  [/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_]\w*)/, 1, 'function'],
  [/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_]\w*)/, 1, 'const/var'],
  [/^\s*(?:export\s+)?(?:interface|type|class|enum)\s+([A-Za-z_]\w*)/, 1, 'type'],
  [/CREATE\s+(?:TABLE|VIEW|TRIGGER|INDEX)\s+(?:IF NOT EXISTS\s+)?([A-Za-z_]\w*)/i, 1, 'SQL object'],
];

const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));
const contents = new Map<string, string>();

for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join('/');
  const text = readFileSync(file, 'utf-8');
  contents.set(rel, text);
  const area = areaOf(rel);

  // A route or file whose own path is named for a classification.
  for (const t of termsIn(rel.replace(/\//g, ' '))) definitions.push({ term: t, name: rel, kind: 'file path', file: rel, line: 0 });

  let inBlock = false;
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    let isComment = false;
    if (inBlock) { isComment = true; if (line.includes('*/') || line.includes('-->')) inBlock = false; }
    else if (/^(\/\/|\/\*|\*|<!--|--|#)/.test(line)) {
      isComment = true;
      if ((line.startsWith('/*') && !line.includes('*/')) || (line.startsWith('<!--') && !line.includes('-->'))) inBlock = true;
    }

    const found = termsIn(line);
    if (found.size === 0) return;

    if (isComment) {
      for (const t of found) counts[t][area].comment++;
      return;
    }
    const strings: string[] = [];
    const codeOnly = line.replace(STRING_RE, (_m, a, b, c) => { strings.push(a ?? b ?? c ?? ''); return ' '; });
    const inCode = termsIn(codeOnly);
    const inStrings = new Set<string>();
    for (const s of strings) for (const t of termsIn(s)) inStrings.add(t);

    for (const t of found) {
      if (inCode.has(t)) counts[t][area].identifier++;
      else counts[t][area].string++;
      if (PRODUCTION.includes(area)) perFile[t].set(rel, (perFile[t].get(rel) ?? 0) + 1);
    }
    if (PRODUCTION.includes(area)) {
      for (const s of strings) for (const t of termsIn(s)) {
        if (s.length > 80) continue;
        const cur = literals[t].get(s);
        if (cur) cur.n++; else literals[t].set(s, { n: 1, example: `${rel}:${i + 1}` });
      }
    }

    if (area !== 'tests, scripts, fixtures') {
      for (const [re, group, kind] of DECLARATIONS) {
        const m = line.match(re);
        if (!m) continue;
        for (const t of termsIn(m[group])) definitions.push({ term: t, name: m[group], kind, file: rel, line: i + 1 });
      }
    }
  });
}

// Blast radius: how many files (and total references) mention each defined name.
function radius(name: string, ownFile: string): { files: number; refs: number } {
  if (name.includes('/')) return { files: 0, refs: 0 };
  const re = new RegExp(`\\b${name}\\b`, 'g');
  let fileCount = 0; let refs = 0;
  for (const [rel, text] of contents) {
    const n = (text.match(re) ?? []).length;
    if (n === 0) continue;
    if (rel === ownFile && n === 1) continue; // only its own declaration
    fileCount++; refs += rel === ownFile ? n - 1 : n;
  }
  return { files: fileCount, refs };
}

const md: string[] = [];
md.push('# Classification Neutrality: Impact Analysis');
md.push('');
md.push('Generated by `scripts/analyze-classification-neutrality.ts` (`make analyze-classification`) — never hand-edited.');
md.push('');
md.push('**The principle measured:** hot/cold, storage, division and category are merely *suggested* classification hierarchies a business may choose — a wine shop might use hot/cold, a hardware store inside/outside. Locations and Items are the real things. A classification word in a function name, table name, route, or hardcoded string is a place where one business\'s assumption is baked into code.');
md.push('');
md.push('A hit is one of three kinds: an **identifier** (in code — a name), a **string** (a hardcoded value), or a **comment**. Identifiers and strings are the ones that can change behaviour; comments only describe it.');
md.push('');
md.push(`Scanned ${files.length} files under ${SCAN_DIRS.join(', ')}.`);
md.push('');

md.push('## 1. Hits by term and area (identifier / string / comment)');
md.push('');
md.push(`| Term | ${AREAS.join(' | ')} |`);
md.push(`|---|${AREAS.map(() => '---').join('|')}|`);
for (const t of TERM_NAMES) {
  md.push(`| **${t}** | ${AREAS.map((a) => { const c = counts[t][a]; return `${c.identifier} / ${c.string} / ${c.comment}`; }).join(' | ')} |`);
}
md.push('');
md.push('*Production areas are the first three columns. "schema: translations" is per-language vocabulary data, and the last column is tests and tooling.*');
md.push('');

md.push('## 2. Definitions named for a classification, with blast radius');
md.push('');
md.push('Each is a function, constant, type, SQL object or file path whose *name* is a classification word. **Blast radius** = other files that reference that exact name; it is what removal or generalisation would have to touch.');
md.push('');
const seen = new Set<string>();
for (const t of TERM_NAMES) {
  const defs = definitions.filter((d) => d.term === t && !seen.has(`${t}|${d.name}|${d.file}`));
  defs.forEach((d) => seen.add(`${t}|${d.name}|${d.file}`));
  md.push(`### ${t} — ${defs.length} definition(s)`);
  md.push('');
  if (defs.length === 0) { md.push('None.'); md.push(''); continue; }
  md.push('| Symbol | Kind | Defined at | Files referencing | References |');
  md.push('|---|---|---|---|---|');
  const rows = defs.map((d) => ({ d, r: radius(d.name, d.file) })).sort((a, b) => b.r.refs - a.r.refs).slice(0, 40);
  for (const { d, r } of rows) md.push(`| \`${d.name}\` | ${d.kind} | ${d.file}${d.line ? ':' + d.line : ''} | ${d.kind === 'file path' ? '-' : r.files} | ${d.kind === 'file path' ? '-' : r.refs} |`);
  if (defs.length > 40) md.push(`| *… ${defs.length - 40} more, lowest blast radius* | | | | |`);
  md.push('');
}

md.push('## 3. Hardcoded strings in production code');
md.push('');
md.push('Quoted literals containing a classification word, in backend source, frontend and structural schema (translations excluded). These are the values a business would need to be able to choose for itself.');
md.push('');
for (const t of TERM_NAMES) {
  const entries = [...literals[t].entries()].sort((a, b) => b[1].n - a[1].n);
  md.push(`### ${t} — ${entries.length} distinct string(s)`);
  md.push('');
  if (entries.length === 0) { md.push('None.'); md.push(''); continue; }
  md.push('| String | Uses | First seen |');
  md.push('|---|---|---|');
  for (const [s, v] of entries.slice(0, 25)) md.push(`| \`${s.replace(/\|/g, '\\|')}\` | ${v.n} | ${v.example} |`);
  if (entries.length > 25) md.push(`| *… ${entries.length - 25} more* | | |`);
  md.push('');
}

md.push('## 4. Files with the most hits (production areas only)');
md.push('');
for (const t of TERM_NAMES) {
  const top = [...perFile[t].entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  md.push(`**${t}** — ${perFile[t].size} production file(s): ${top.map(([f, n]) => `\`${f}\` (${n})`).join(', ') || 'none'}`);
  md.push('');
}

writeFileSync(OUT, md.join('\n') + '\n', 'utf-8');
console.log(`Wrote ${OUT}`);
console.log('');
console.log('Identifier / string / comment hits, PRODUCTION areas only (backend src + frontend + structural schema):');
for (const t of TERM_NAMES) {
  const sum = PRODUCTION.reduce((acc, a) => ({ identifier: acc.identifier + counts[t][a].identifier, string: acc.string + counts[t][a].string, comment: acc.comment + counts[t][a].comment }), { identifier: 0, string: 0, comment: 0 });
  console.log(`  ${t.padEnd(13)} ${String(sum.identifier).padStart(5)} / ${String(sum.string).padStart(5)} / ${String(sum.comment).padStart(5)}   (${perFile[t].size} files)`);
}
