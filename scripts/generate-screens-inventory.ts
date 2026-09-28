// Generates docs/screens-inventory.md - the Screens Inventory table for the
// Programmer's Manual.
//
// For every frontend route (+page.svelte) it reports: route path, source file,
// code lines, comment lines (blank lines excluded from both), and whether the
// screen is implemented, a thin wrapper, or a NotImplemented stub.
//
// A line counts as a comment if, after stripping leading whitespace, it starts
// with // or <!-- , or falls inside a /* ... */ block comment (including the
// line that opens or closes one). A line holding both code and a trailing
// comment (`let x = 1; // note`) counts as code: the line is doing real work.
//
// Run via `make screens-inventory`. Replaces generate-screens-inventory.py
// (this project ships no Python).
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const ROUTES_DIR = join(REPO_ROOT, 'frontend', 'src', 'routes');
const OUT = join(REPO_ROOT, 'docs', 'screens-inventory.md');

// Same splitting rule as Python's str.splitlines().
function splitLines(text: string): string[] {
  if (text === '') return [];
  const pieces = text.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/);
  if (pieces[pieces.length - 1] === '') pieces.pop();
  return pieces;
}

// All +page.svelte files under a directory, ordered component by component
// (so `a/b` sorts before `a-b`, unlike a plain string sort).
function findPages(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found.push(...findPages(full));
    else if (name === '+page.svelte') found.push(full);
  }
  return found;
}

function compareByComponents(a: string, b: string): number {
  const pa = a.split(sep);
  const pb = b.split(sep);
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return pa.length - pb.length;
}

function classifyLines(text: string): { code: number; comments: number } {
  let code = 0;
  let comments = 0;
  let inBlockComment = false;
  for (const rawLine of splitLines(text)) {
    const line = rawLine.trim();
    if (!line) continue; // blank lines are excluded from both counts
    if (inBlockComment) {
      comments++;
      if (line.includes('*/')) inBlockComment = false;
      continue;
    }
    if (line.startsWith('//') || line.startsWith('<!--')) {
      comments++;
      continue;
    }
    if (line.startsWith('/*')) {
      comments++;
      if (!line.includes('*/')) inBlockComment = true;
      continue;
    }
    code++;
  }
  return { code, comments };
}

function statusFor(text: string, totalLines: number): string {
  if (text.includes('NotImplemented')) return 'Not implemented';
  if (totalLines <= 10) return 'Thin wrapper (shared component)';
  return 'Implemented';
}

interface Row { route: string; relPath: string; code: number; comments: number; status: string }

const rows: Row[] = [];
for (const path of findPages(ROUTES_DIR).sort(compareByComponents)) {
  const dirPart = relative(ROUTES_DIR, path).split(sep).slice(0, -1).join('/');
  const route = dirPart === '' ? '/' : '/' + dirPart;
  const text = readFileSync(path, 'utf-8');
  const { code, comments } = classifyLines(text);
  const totalLines = (text.match(/\n/g) ?? []).length; // what `wc -l` counts
  rows.push({ route, relPath: relative(REPO_ROOT, path).split(sep).join('/'), code, comments, status: statusFor(text, totalLines) });
}

const out: string[] = [];
out.push('# Screens Inventory');
out.push('');
out.push(
  'Every real frontend route (`+page.svelte`), its source file, a real code/comment line split ' +
    '(blank lines excluded from both, per direct instruction), and whether it\'s genuinely ' +
    'implemented, a thin wrapper around a shared component, or still a `NotImplemented` stub. ' +
    'Generated directly from source by `scripts/generate-screens-inventory.ts` (`make screens-inventory`) ' +
    '— never hand-edited.',
);
out.push('');
out.push('| Route | Source File | Code Lines | Comment Lines | Status |');
out.push('|---|---|---|---|---|');
for (const r of rows) out.push(`| ${r.route} | ${r.relPath} | ${r.code} | ${r.comments} | ${r.status} |`);

const totalCode = rows.reduce((n, r) => n + r.code, 0);
const totalComments = rows.reduce((n, r) => n + r.comments, 0);
const implemented = rows.filter((r) => r.status === 'Implemented').length;
const thin = rows.filter((r) => r.status === 'Thin wrapper (shared component)').length;
const notImpl = rows.filter((r) => r.status === 'Not implemented').length;
out.push('');
out.push(
  `**${rows.length} screens total** — ${implemented} implemented, ${thin} thin wrapper ` +
    `(shared component), ${notImpl} not yet implemented. ` +
    `${totalCode} total code lines, ${totalComments} total comment lines ` +
    `across all screens (blank lines excluded from both).`,
);

writeFileSync(OUT, out.join('\n') + '\n', 'utf-8');
console.log(`Wrote ${OUT} (${rows.length} screens)`);
