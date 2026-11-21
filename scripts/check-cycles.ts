#!/usr/bin/env bun
// Import cycles in backend/src, checked against the manual. Every group
// of backend files that import each other in a ring (a strongly
// connected component of the runtime import graph; `import type` is
// left out, since it is erased) must be listed, one group per line, in
// docs/pm-build-and-tooling.md under "Import cycles", and every group
// listed there must still exist. So a new cycle fails, and so does a
// fixed cycle the manual still lists.
// Documented in docs/pm-build-and-tooling.md, "Import cycles".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'backend', 'src');
const CHAPTER = path.join(root, 'docs', 'pm-build-and-tooling.md');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

const files = walk(srcDir);
const rel = (f: string) => path.relative(root, f).split(path.sep).join('/');
const edges = new Map<string, string[]>();
for (const file of files) {
  const text = fs.readFileSync(file, 'utf-8');
  const targets: string[] = [];
  for (const m of text.matchAll(/^\s*(import|export)\s+(?!type\b)[^;]*?\bfrom\s+['"](\.[^'"]+)['"]/gm)) {
    const target = path.resolve(path.dirname(file), m[2].replace(/\.js$/, '.ts'));
    if (fs.existsSync(target)) targets.push(rel(target));
  }
  for (const m of text.matchAll(/^\s*import\s+['"](\.[^'"]+)['"]/gm)) {
    const target = path.resolve(path.dirname(file), m[1].replace(/\.js$/, '.ts'));
    if (fs.existsSync(target)) targets.push(rel(target));
  }
  edges.set(rel(file), targets);
}

// Tarjan's strongly connected components.
let index = 0;
const idx = new Map<string, number>();
const low = new Map<string, number>();
const stack: string[] = [];
const onStack = new Set<string>();
const groups: string[][] = [];
function visit(v: string): void {
  idx.set(v, index);
  low.set(v, index);
  index++;
  stack.push(v);
  onStack.add(v);
  for (const w of edges.get(v) ?? []) {
    if (!idx.has(w)) {
      visit(w);
      low.set(v, Math.min(low.get(v)!, low.get(w)!));
    } else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, idx.get(w)!));
  }
  if (low.get(v) === idx.get(v)) {
    const group: string[] = [];
    let w: string;
    do {
      w = stack.pop()!;
      onStack.delete(w);
      group.push(w);
    } while (w !== v);
    if (group.length > 1) groups.push(group.sort());
  }
}
for (const v of [...edges.keys()].sort()) if (!idx.has(v)) visit(v);

const actual = new Set(groups.map((g) => g.map((f) => `\`${f}\``).join(', ')));
const chapter = fs.readFileSync(CHAPTER, 'utf-8');
const start = chapter.indexOf('### Import cycles');
if (start === -1) {
  console.error('docs/pm-build-and-tooling.md has no "### Import cycles" section.');
  process.exit(1);
}
const end = chapter.indexOf('\n#', start + 5);
const listed = new Set(
  chapter
    .slice(start, end === -1 ? undefined : end)
    .split('\n')
    .filter((l) => l.startsWith('- `backend/src/'))
    .map((l) => l.slice(2).trim())
);

const unlisted = [...actual].filter((g) => !listed.has(g));
const gone = [...listed].filter((g) => !actual.has(g));
console.log(`${files.length} backend files, ${groups.length} import cycle group(s).`);
for (const g of unlisted) console.error(`  not in the manual: ${g}`);
for (const g of gone) console.error(`  in the manual, no longer a cycle: ${g}`);
if (unlisted.length || gone.length) {
  console.error('\n❌ FAIL: the import cycles and docs/pm-build-and-tooling.md, "Import cycles", disagree.');
  process.exit(1);
}
console.log('✅ PASS: every import cycle is the one the manual lists.');
