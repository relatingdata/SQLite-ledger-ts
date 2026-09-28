// Docs: docs/coding-standards.md § How a file is migrated
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const [fileArg, docArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dryRun = process.argv.includes('--dry-run');

if (!fileArg || !docArg) {
  console.error('Usage: strip-code-comments.ts <file.ts> <docs/chapter.md> [--dry-run]');
  process.exit(1);
}
const file = resolve(ROOT, fileArg);
const docPath = join(ROOT, docArg);
if (!existsSync(docPath)) {
  console.error(`FAIL: ${docArg} does not exist. Write the chapter first: the content must land in the manual before the comments go.`);
  process.exit(1);
}
const builder = readFileSync(join(ROOT, 'scripts', 'build-programmer-manual.ts'), 'utf-8');
if (!builder.includes(`'${docArg.replace(/^docs\//, '')}'`)) {
  console.error(`FAIL: ${docArg} is not registered in scripts/build-programmer-manual.ts, so it would not appear in the manual.`);
  process.exit(1);
}

const original = readFileSync(file, 'utf-8');

const FUNCTIONAL = /^(\/\/\s*@ts-|\/\/\/\s*<|\/\/\s*eslint|\/\*\s*eslint|\/\/\s*prettier|\/\*\*?\s*@deprecated|\/\/\s*Docs:|\/\/\s*The full documentation)/;

function commentRanges(text: string): ts.CommentRange[] {
  const sf = ts.createSourceFile('x.ts', text, ts.ScriptTarget.Latest, true);
  const found = new Map<number, ts.CommentRange>();
  const collect = (pos: number): void => {
    for (const r of ts.getLeadingCommentRanges(text, pos) ?? []) found.set(r.pos, r);
    for (const r of ts.getTrailingCommentRanges(text, pos) ?? []) found.set(r.pos, r);
  };
  const visit = (node: ts.Node): void => {
    for (const child of node.getChildren(sf)) { collect(child.getFullStart()); visit(child); }
  };
  collect(0);
  visit(sf);
  return [...found.values()].sort((a, b) => a.pos - b.pos);
}

function skeleton(text: string): string {
  let out = ''; let cursor = 0;
  for (const r of commentRanges(text)) { out += text.slice(cursor, r.pos); cursor = r.end; }
  return (out + text.slice(cursor)).replace(/\s+/g, '');
}

const ranges = commentRanges(original);
const lineStartOf = (pos: number): number => original.lastIndexOf('\n', pos - 1) + 1;
const lineEndOf = (pos: number): number => { const i = original.indexOf('\n', pos); return i === -1 ? original.length : i + 1; };

let kept = 0; let trailing = 0; let removedLines = 0; let needsManual = 0;
const spans: [number, number][] = [];
for (const r of ranges) {
  const text = original.slice(r.pos, r.end);
  const start = lineStartOf(r.pos);
  const end = lineEndOf(r.end);
  const wholeLine = original.slice(start, r.pos).trim() === '' && original.slice(r.end, end).trim() === '';
  if (!wholeLine) { trailing++; continue; }
  if (FUNCTIONAL.test(text.trim())) {
    if (/@deprecated/.test(text) && text.includes('\n')) {
      needsManual++;
      console.log(`  needs hand-editing: multi-line @deprecated at line ${original.slice(0, r.pos).split('\n').length}`);
    }
    kept++;
    continue;
  }
  spans.push([start, end]);
  removedLines += original.slice(start, end).split('\n').length - 1;
}

let result = ''; let cursor = 0;
for (const [start, end] of spans) { result += original.slice(cursor, start); cursor = end; }
result += original.slice(cursor);
result = result.replace(/\n{3,}/g, '\n\n');

if (!/^\/\/ (The full documentation for every function in this file lives in|Docs:)/m.test(result.split('\n').slice(0, 3).join('\n'))) {
  result = `// The full documentation for every function in this file lives in ${docArg} — this file carries no further comments.\n\n${result.replace(/^\n+/, '')}`;
}

if (skeleton(original) !== skeleton(result)) {
  console.error('FAIL: removing the comments would have changed the code itself. Nothing was written.');
  process.exit(1);
}

console.log(`${fileArg}: ${spans.length} whole-line comment block(s) (${removedLines} line(s)) ${dryRun ? 'would be' : 'were'} removed.`);
console.log(`  kept: ${kept} functional or pointer comment(s) (${needsManual} of them need hand-editing); ${trailing} trailing comment(s) on code lines were left alone.`);
console.log('  verified: with every comment stripped, the file is identical before and after.');
if (dryRun) { console.log('  --dry-run: nothing written.'); process.exit(0); }
writeFileSync(file, result, 'utf-8');
