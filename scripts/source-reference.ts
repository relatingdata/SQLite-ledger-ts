#!/usr/bin/env bun
// A real, generated, comprehensive source reference - per direct
// request: functions arranged by file, common first, then backend,
// then frontend, with filenames, function names, types, and variables
// all indexed, plus a real include graph and call graph at the start.
// Generated, not hand-written, per pattern-recognition-to-tooling -
// this covers the real, core, top-level .ts files (shared-fixtures,
// backend/src, frontend/src/lib) as a first, real pass; the many real
// route (.svelte) and component files are real, separate, larger
// follow-on work, not attempted here.

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dir, '..');

interface FileInfo {
  path: string;
  group: 'common' | 'backend' | 'frontend';
  functions: string[];
  functionSignatures: string[];
  types: string[];
  typeDefinitions: string[];
  exportedVars: string[];
  imports: string[];
}

function extractInfo(filePath: string, group: FileInfo['group']): FileInfo {
  const content = fs.readFileSync(filePath, 'utf-8');
  const functions = [...content.matchAll(/^export function (\w+)/gm)].map((m) => m[1]);

  // A real, full signature - name, every real parameter (with its own
  // real type), and the real return type, per direct request, not
  // just the bare name.
  const functionSignatures: string[] = [];
  for (const m of content.matchAll(/^export function (\w+)\(([\s\S]*?)\)(?:\s*:\s*([^{]+))?\s*\{/gm)) {
    const [, name, rawParams, returnType] = m;
    const params = rawParams
      .split(/,(?![^<]*>)(?![^{]*\})/)
      .map((p) => p.trim())
      .filter(Boolean)
      .join(', ');
    functionSignatures.push(`${name}(${params}): ${(returnType ?? 'void').trim()}`);
  }

  const types = [
    ...[...content.matchAll(/^export interface (\w+)/gm)].map((m) => m[1]),
    ...[...content.matchAll(/^export type (\w+)/gm)].map((m) => m[1]),
  ];

  // A real, full type definition - every real field, one per line, per
  // direct request, not just the type's own bare name.
  const typeDefinitions: string[] = [];
  for (const m of content.matchAll(/^export interface (\w+)\s*\{([\s\S]*?)\n\}/gm)) {
    const [, name, body] = m;
    const fields = body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('/*'));
    typeDefinitions.push(`interface ${name} {`);
    for (const field of fields) typeDefinitions.push(`  ${field}`);
    typeDefinitions.push('}');
  }
  for (const m of content.matchAll(/^export type (\w+)\s*=\s*([^;]+);/gm)) {
    typeDefinitions.push(`type ${m[1]} = ${m[2].trim()};`);
  }

  const exportedVars = [...content.matchAll(/^export const (\w+)/gm)].map((m) => m[1]);
  const imports = [...content.matchAll(/from ['"](\.[^'"]+)['"]/g)].map((m) => m[1]);
  return { path: filePath, group, functions, functionSignatures, types, typeDefinitions, exportedVars, imports };
}

const files: FileInfo[] = [];
for (const f of fs.readdirSync(path.join(root, 'shared-fixtures')).filter((f) => f.endsWith('.ts')))
  files.push(extractInfo(path.join(root, 'shared-fixtures', f), 'common'));
for (const f of fs.readdirSync(path.join(root, 'backend', 'src')).filter((f) => f.endsWith('.ts')))
  files.push(extractInfo(path.join(root, 'backend', 'src', f), 'backend'));
for (const f of fs.readdirSync(path.join(root, 'frontend', 'src', 'lib')).filter((f) => f.endsWith('.ts')))
  files.push(extractInfo(path.join(root, 'frontend', 'src', 'lib', f), 'frontend'));

function shortName(f: FileInfo): string {
  return path.relative(root, f.path);
}

// === Include graph ===
console.log('# Real Source Reference — Common, Backend, Frontend\n');
console.log('## Include Graph (real, direct, relative imports between these files)\n');
for (const f of files) {
  if (f.imports.length === 0) continue;
  console.log(`- \`${shortName(f)}\` imports: ${f.imports.map((i) => `\`${i}\``).join(', ')}`);
}

// === Call graph summary (reuses the same, real logic as call-graph.ts) ===
console.log('\n## Call Graph Summary (real, direct invocation counts — see `make call-graph` for the complete, standalone report)\n');
const allContent = files.map((f) => fs.readFileSync(f.path, 'utf-8')).join('\n');
const callCounts: [string, number][] = [];
for (const f of files) {
  for (const fn of f.functions) {
    const matches = allContent.match(new RegExp(`\\b${fn}\\b`, 'g'));
    callCounts.push([fn, matches ? matches.length - 1 : 0]);
  }
}
callCounts.sort((a, b) => b[1] - a[1]);
console.log(`Top 15 most-referenced functions across these ${files.length} real, core files:`);
for (const [name, count] of callCounts.slice(0, 15)) console.log(`- \`${name}\`: ${count}`);

// === Per-file breakdown, grouped: common, then backend, then frontend ===
for (const group of ['common', 'backend', 'frontend'] as const) {
  console.log(`\n## ${group[0].toUpperCase()}${group.slice(1)} Files\n`);
  for (const f of files.filter((f) => f.group === group)) {
    console.log(`### \`${shortName(f)}\`\n`);
    if (f.functionSignatures.length) {
      console.log('**Functions**:\n');
      console.log('```ts');
      for (const sig of f.functionSignatures) console.log(sig);
      console.log('```\n');
    }
    if (f.typeDefinitions.length) {
      console.log('**Types**:\n');
      console.log('```ts');
      for (const line of f.typeDefinitions) console.log(line);
      console.log('```\n');
    }
    if (f.exportedVars.length) {
      console.log('**Exported variables**:\n');
      for (const n of f.exportedVars) console.log(`- \`${n}\``);
      console.log('');
    }
  }
}

// === Parent link / sibling (relation) link index ===
// Per docs/naming-conventions-and-entity-glossary.md: parent_id is a
// real, structural fact ("lives under"); relation_id is a real,
// lateral fact ("refers to / is a translation of"). This extracts
// every real, direct createEntity({ parent: ... }) and
// updateEntity(..., { relation: ... }) call across these files.
console.log('\n## Parent Link / Sibling (Relation) Link Index\n');
console.log('See `docs/naming-conventions-and-entity-glossary.md` for what these two, real, distinct link kinds mean.\n');
console.log('### Real `parent:` usages (structural — "this entity lives under that one")\n');
for (const f of files) {
  const content = fs.readFileSync(f.path, 'utf-8');
  const matches = [...content.matchAll(/parent:\s*([^,}\n]+)/g)];
  if (matches.length === 0) continue;
  console.log(`- \`${shortName(f)}\`: ${matches.map((m) => m[1].trim()).join('; ')}`);
}
console.log('\n### Real `relation:` usages (lateral — "this entity refers to / is a translation of that one")\n');
for (const f of files) {
  const content = fs.readFileSync(f.path, 'utf-8');
  const matches = [...content.matchAll(/relation:\s*([^,}\n]+)/g)];
  if (matches.length === 0) continue;
  console.log(`- \`${shortName(f)}\`: ${matches.map((m) => m[1].trim()).join('; ')}`);
}

// === The real index — every name, alphabetical, pointing back to its file ===
console.log('\n## Index (alphabetical — every real function, type, and exported variable, with its file)\n');
type IndexEntry = { name: string; kind: string; file: string };
const index: IndexEntry[] = [];
for (const f of files) {
  for (const n of f.functions) index.push({ name: n, kind: 'function', file: shortName(f) });
  for (const n of f.types) index.push({ name: n, kind: 'type', file: shortName(f) });
  for (const n of f.exportedVars) index.push({ name: n, kind: 'variable', file: shortName(f) });
}
index.sort((a, b) => a.name.localeCompare(b.name));
for (const entry of index) console.log(`- \`${entry.name}\` (${entry.kind}) — \`${entry.file}\``);

console.log(`\n${index.length} real, indexed names across ${files.length} real, core files.`);
