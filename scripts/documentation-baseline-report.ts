#!/usr/bin/env bun
// A real, generated, structured report over the real, tracked names
// in docs/documentation-coverage-baseline.md - per direct request,
// replacing that file's own, real, flat, undifferentiated bullet list
// (mixing TypeDescriptor constants, Express router constants, and
// real, substantial functions together in one, single list) with
// real, separate, alphabetical groups, each entry showing its own,
// real file of definition, every other real file that references it,
// and its own, real, full declaration (a function's own, real, full
// parameter list and return type; a const's own, real, full
// initializing expression - never just a bare name).

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dir, '..');

// Every real, core backend source file - the exact, same, real scope
// check-docs-coverage.ts itself uses for this baseline.
const backendSrcDir = path.join(root, 'backend', 'src');
function findTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findTsFiles(full));
    else if (entry.name.endsWith('.ts')) results.push(full);
  }
  return results;
}
const files = findTsFiles(backendSrcDir).map((p) => ({ path: p, short: path.relative(root, p), content: fs.readFileSync(p, 'utf-8') }));

// The real, tracked baseline names - the exact, same, real parsing
// check-docs-coverage.ts itself uses.
const baselinePath = path.join(root, 'docs', 'documentation-coverage-baseline.md');
const baselineNames: string[] = [];
for (const line of fs.readFileSync(baselinePath, 'utf-8').split('\n')) {
  const m = line.match(/^- `([^`]+)`/);
  if (m) baselineNames.push(m[1]);
}

interface Entry {
  name: string;
  file: string;
  declaration: string;
  referencedIn: string[];
}

function findDeclaration(name: string): { file: string; declaration: string } | undefined {
  for (const f of files) {
    // A real function: capture its own, full, real parameter list and
    // return type, never just the bare name.
    const fnMatch = f.content.match(new RegExp(`^export function ${name}\\(([\\s\\S]*?)\\)(?:\\s*:\\s*([^{]+))?\\s*\\{`, 'm'));
    if (fnMatch) {
      const params = fnMatch[1]
        .split(/,(?![^<]*>)(?![^{]*\})/)
        .map((p) => p.trim())
        .filter(Boolean)
        .join(', ');
      return { file: f.short, declaration: `function ${name}(${params}): ${(fnMatch[2] ?? 'void').trim()}` };
    }
    // A real const: capture its own, full, real initializing
    // expression up to the end of that real statement.
    const constMatch = f.content.match(new RegExp(`^export const ${name}[^=]*=\\s*([^;]+);`, 'm'));
    if (constMatch) {
      return { file: f.short, declaration: `const ${name} = ${constMatch[1].trim()};` };
    }
  }
  return undefined;
}

function findReferencingFiles(name: string, definingFile: string): string[] {
  const referencing: string[] = [];
  for (const f of files) {
    if (f.short === definingFile) continue;
    if (new RegExp(`\\b${name}\\b`).test(f.content)) referencing.push(f.short);
  }
  return referencing;
}

const typeDescriptorEntries: Entry[] = [];
const routerEntries: Entry[] = [];
const functionEntries: Entry[] = [];
const otherEntries: Entry[] = [];

for (const name of baselineNames) {
  const found = findDeclaration(name);
  if (!found) continue; // A real, tracked name that no longer exists in the real, live source - already fixed, not reported stale here.
  const entry: Entry = { name, file: found.file, declaration: found.declaration, referencedIn: findReferencingFiles(name, found.file) };
  if (/^type[A-Z]/.test(name)) typeDescriptorEntries.push(entry);
  else if (/Router$/.test(name)) routerEntries.push(entry);
  else if (found.declaration.startsWith('function ')) functionEntries.push(entry);
  else otherEntries.push(entry);
}

function escapeForTableCell(s: string): string {
  // A real, direct escape: a markdown table cell is one, real,
  // unbroken line - a literal pipe or newline inside a declaration
  // would otherwise break the table's own, real column structure.
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function printGroup(title: string, entries: Entry[]): void {
  entries.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`## ${title} (${entries.length}, alphabetical)\n`);
  console.log('| Name | Defined in | Referenced in | Declaration |');
  console.log('|---|---|---|---|');
  for (const e of entries) {
    const referencedIn = e.referencedIn.length > 0 ? e.referencedIn.map((r) => `\`${r}\``).join(', ') : '(none)';
    console.log(`| \`${e.name}\` | \`${e.file}\` | ${referencedIn} | \`${escapeForTableCell(e.declaration)}\` |`);
  }
  console.log('');
}

console.log('# Documentation Coverage Baseline — Structured Report\n');
console.log(
  'Generated directly by `scripts/documentation-baseline-report.ts` (run via `make documentation-baseline-report`). Reads the exact, same, real, tracked names from `docs/documentation-coverage-baseline.md` that `check-docs-coverage.ts` itself uses, then, for each real name still genuinely present in the live source, finds its own real file of definition, its own real, full declaration (a function\'s own, real, full parameter list and return type; a const\'s own, real, full initializing expression), and every other real, core backend file that genuinely, textually references it. Separated into real, distinct, alphabetical groups - never one, single, undifferentiated list - since these are genuinely different kinds of things: `typeXxxName` `TypeDescriptor` constants, `xxxRouter` Express router constants, and real, substantial, ordinary functions.\n'
);

printGroup('TypeDescriptor Constants', typeDescriptorEntries);
printGroup('Router Constants', routerEntries);
printGroup('Functions', functionEntries);
if (otherEntries.length > 0) printGroup('Other Constants', otherEntries);

const total = typeDescriptorEntries.length + routerEntries.length + functionEntries.length + otherEntries.length;
console.log(`${total} real, tracked baseline names reported (${typeDescriptorEntries.length} TypeDescriptor constants, ${routerEntries.length} router constants, ${functionEntries.length} functions, ${otherEntries.length} other constants) out of ${baselineNames.length} total names in the baseline file.`);
