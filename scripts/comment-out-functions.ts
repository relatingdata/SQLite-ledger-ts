// Docs: docs/unused-functions.md § How they were commented out
import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const argv = process.argv.slice(2);
const valueOf = (flag: string): string | undefined => {
  const at = argv.indexOf(flag);
  return at >= 0 ? argv[at + 1] : undefined;
};
const fileArg = valueOf('--file');
const namesArg = valueOf('--names');
const dryRun = argv.includes('--dry-run');
if (!fileArg || !namesArg) {
  console.error('Usage: comment-out-functions.ts --file <path.ts> --names a,b,c [--dry-run]');
  process.exit(1);
}

const file = resolve(ROOT, fileArg);
const original = readFileSync(file, 'utf-8');
const sf = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true);
const wanted = new Set(namesArg.split(',').map((n) => n.trim()).filter(Boolean));
const found = new Map<string, { startLine: number; endLine: number }>();

const lineOf = (pos: number): number => sf.getLineAndCharacterOfPosition(pos).line;
for (const st of sf.statements) {
  if (ts.isFunctionDeclaration(st) && st.name && wanted.has(st.name.text)) {
    found.set(st.name.text, { startLine: lineOf(st.getStart(sf)), endLine: lineOf(st.getEnd()) });
  } else if (ts.isVariableStatement(st)) {
    const names = st.declarationList.declarations.map((d) => (ts.isIdentifier(d.name) ? d.name.text : ''));
    const hit = names.filter((n) => wanted.has(n));
    if (hit.length === 1 && names.length === 1) found.set(hit[0], { startLine: lineOf(st.getStart(sf)), endLine: lineOf(st.getEnd()) });
  }
}

const missing = [...wanted].filter((n) => !found.has(n));
const MARKER = '// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md';
const lines = original.split('\n');
const spans = [...found.entries()].sort((a, b) => b[1].startLine - a[1].startLine);
for (const [, { startLine, endLine }] of spans) {
  for (let i = startLine; i <= endLine; i++) lines[i] = lines[i].length ? `// ${lines[i]}` : '//';
  lines.splice(startLine, 0, MARKER);
}

console.log(`${fileArg}: ${found.size} of ${wanted.size} function(s) ${dryRun ? 'would be' : 'were'} commented out.`);
if (missing.length) console.log(`  not found as a single top-level function: ${missing.join(', ')}`);
if (!dryRun && found.size > 0) writeFileSync(file, lines.join('\n'), 'utf-8');
