// Fails if a grouping the business names for itself is named in the code.
//
// A business names its own groupings of its items and its locations
// (docs/pm-domain-reference.md, "No grouping name is in the code"). The
// names the fixtures give them (Division, Category, Size, ...) are
// collected from every step that creates one, and none may appear as a
// string literal in the application's code: backend/src (the Vocabulary
// seed excepted), frontend/src, tui/src, the step runner and its frontend
// API client, or the code inside application/application.entities.
// Comments are not code, and a literal inside a translation lookup
// (translations.current['...'], t('...')) is a word to show, not a
// grouping.
//
// Run via `make check-grouping-names`; part of `make check-manual`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitCsvLine, unescapeAscii } from '../shared-fixtures/csv.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SKIP_DIRS = new Set(['node_modules', '.svelte-kit', 'dist', 'build']);
const CREATING_STEPS = new Set(['Create Hierarchy Grouping', 'Create Location Grouping Via Structure Popup', 'Create Item Grouping Via Structure Popup']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const rel = (file: string) => relative(ROOT, file).split(sep).join('/');

// --- the names the fixtures give their groupings ---------------------------------
const names = new Set<string>();
for (const file of walk(join(ROOT, 'shared-fixtures'))) {
  if (!file.endsWith('.csv') || file.endsWith('.control.csv')) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.startsWith('"')) continue;
    const fields = splitCsvLine(line).map(unescapeAscii);
    if (CREATING_STEPS.has(fields[0]) && fields[2] && !fields[2].includes('${')) names.add(fields[2]);
  }
}

// --- the code ----------------------------------------------------------------------
const CODE = /\.(ts|svelte)$/;
const EXCEPT = new Set(['backend/src/db-seed.ts']);
const files = [
  ...['backend/src', 'frontend/src', 'tui/src'].flatMap((d) => walk(join(ROOT, d))).filter((f) => CODE.test(f) && !EXCEPT.has(rel(f))),
  join(ROOT, 'backend/scripts/step-runner.ts'),
  join(ROOT, 'backend/scripts/core-api-client.ts'),
];

function stripComments(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}
// A translation lookup, and the word it falls back to, show a word; they
// do not name a grouping.
const WORD_LOOKUP = /(translations\.current\[|\bt\()\s*(['"`])[^'"`]*\2(\s*\]\s*\?\?\s*(['"`])[^'"`]*\4)?/g;

const found: string[] = [];
function scan(where: string, text: string, firstLine = 1): void {
  const lines = stripComments(text).replace(WORD_LOOKUP, '$1""').split('\n');
  lines.forEach((line, i) => {
    for (const name of names) {
      const literal = new RegExp(`(['"\`])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1`);
      if (literal.test(line)) found.push(`${where}:${firstLine + i}: "${name}"  ${line.trim().slice(0, 120)}`);
    }
  });
}
for (const file of files) scan(rel(file), readFileSync(file, 'utf8'));

// application.entities: the code in its attribute values ({...} and
// handlers), not its words (Label, Text, Title, Placeholder, ...).
const entities = readFileSync(join(ROOT, 'application/application.entities'), 'utf8').split('\n');
entities.forEach((line, i) => {
  for (const m of line.matchAll(/(?:Handler|Bind|Prop [\w ]+|Calls [\w ]+)="([^"]*)"|="(\{[^"]*\})"/g)) scan(`application/application.entities`, m[1] ?? m[2], i + 1);
});

console.log(`Grouping names the fixtures create: ${[...names].sort().join(', ')}.`);
if (found.length > 0) {
  console.error(`❌ ${found.length} grouping name(s) in the code:`);
  for (const f of found) console.error(`   ${f}`);
  console.error('A business names its own groupings; take the name from the data (docs/pm-domain-reference.md).');
  process.exit(1);
}
console.log(`✅ PASS: no grouping name in ${files.length} code files or application/application.entities.`);
