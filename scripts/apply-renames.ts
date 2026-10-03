// Docs: docs/bulk-rename-plan.md § How a rename is applied
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const argv = process.argv.slice(2);
const mapFile = argv[argv.indexOf('--map') + 1];
const dryRun = argv.includes('--dry-run');
const identifiersOnly = argv.includes('--identifiers-only');
const under = argv.includes('--under') ? argv[argv.indexOf('--under') + 1].split(',') : [];
if (argv.indexOf('--map') < 0 || !mapFile) {
  console.error('Usage: apply-renames.ts --map <file> [--dry-run] [--identifiers-only] [--under a/,b/]   (map lines: "old new"; # starts a comment)');
  process.exit(1);
}

const TEXT = /\.(ts|svelte|csv|json|md|mjs)$/;
const EXCLUDED = [
  /(^|\/)package-lock\.json$/,
  /^docs\/(RELEASE-NOTES|lessons-learned|naming-vocabulary|bulk-rename-plan|item-terminology-and-storage-design-notes)\.md$/,
  /^docs\/(programmer-manual|user-manual|function-inventory|source-reference|naming-vocabulary-analysis|classification-neutrality-analysis|documentation-baseline-report)\.md$/,
  /^backend\/test\/golden\//,
];

const pairs: [string, string][] = readFileSync(join(ROOT, mapFile), 'utf-8')
  .split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean)
  .map((l) => { const [a, b] = l.split(/\s+/); return [a, b] as [string, string]; });

const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT }).toString().split('\0')
  .filter((f) => f && TEXT.test(f) && !EXCLUDED.some((re) => re.test(f))
    && (under.length === 0 || under.some((p) => f.startsWith(p)))
    && (!identifiersOnly || f.endsWith('.ts')));
const contents = new Map(files.map((f) => [f, readFileSync(join(ROOT, f), 'utf-8')]));

const word = (name: string): RegExp => new RegExp(`(?<![A-Za-z0-9_$])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_$])`, 'g');
const olds = new Set(pairs.map(([a]) => a));

const collisions: string[] = [];
for (const [, to] of pairs) {
  if (olds.has(to)) continue;
  const re = word(to);
  for (const [f, text] of contents) if (re.test(text)) { collisions.push(`${to} already appears in ${f}`); break; }
}
if (collisions.length) {
  console.error('FAIL: a new name already exists, so the rename would merge two different things:');
  for (const c of collisions) console.error(`   ${c}`);
  process.exit(1);
}

let total = 0;
const changed = new Set<string>();
const notFound: string[] = [];
if (identifiersOnly) {
  const table = new Map(pairs);
  const perName = new Map<string, number>();
  for (const [f, text] of contents) {
    const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true);
    const edits: [number, number, string][] = [];
    const visit = (n: ts.Node): void => {
      if (ts.isIdentifier(n) && table.has(n.text)) {
        edits.push([n.getStart(sf), n.getEnd(), table.get(n.text) as string]);
        perName.set(n.text, (perName.get(n.text) ?? 0) + 1);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
    if (edits.length === 0) continue;
    let out = text;
    for (const [start, end, to] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, start) + to + out.slice(end);
    contents.set(f, out); changed.add(f); total += edits.length;
  }
  for (const [from, to] of pairs) {
    const n = perName.get(from) ?? 0;
    if (n === 0) notFound.push(from); else console.log(`${String(n).padStart(5)}  ${from} -> ${to}   (identifier tokens only)`);
  }
} else for (const [from, to] of pairs) {
  const re = word(from);
  let lines = 0;
  for (const [f, text] of contents) {
    const n = (text.match(re) ?? []).length;
    if (n === 0) continue;
    lines += n; changed.add(f);
    contents.set(f, text.replace(re, to));
  }
  total += lines;
  if (lines === 0) notFound.push(from);
  else console.log(`${String(lines).padStart(5)}  ${from} -> ${to}`);
}
console.log(`\n${total} replacement(s) of ${pairs.length - notFound.length} name(s) in ${changed.size} file(s).`);
if (notFound.length) console.log(`Not found anywhere (nothing to rename): ${notFound.join(', ')}`);
if (dryRun) { console.log('--dry-run: nothing written.'); process.exit(0); }
for (const f of changed) writeFileSync(join(ROOT, f), contents.get(f) as string, 'utf-8');
