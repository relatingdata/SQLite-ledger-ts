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
  types: string[];
  exportedVars: string[];
  imports: string[];
}

function extractInfo(filePath: string, group: FileInfo['group']): FileInfo {
  const content = fs.readFileSync(filePath, 'utf-8');
  const functions = [...content.matchAll(/^export function (\w+)/gm)].map((m) => m[1]);
  const types = [
    ...[...content.matchAll(/^export interface (\w+)/gm)].map((m) => m[1]),
    ...[...content.matchAll(/^export type (\w+)/gm)].map((m) => m[1]),
  ];
  const exportedVars = [...content.matchAll(/^export const (\w+)/gm)].map((m) => m[1]);
  const imports = [...content.matchAll(/from ['"](\.[^'"]+)['"]/g)].map((m) => m[1]);
  return { path: filePath, group, functions, types, exportedVars, imports };
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
    if (f.functions.length) console.log(`**Functions**: ${f.functions.map((n) => `\`${n}\``).join(', ')}`);
    if (f.types.length) console.log(`**Types**: ${f.types.map((n) => `\`${n}\``).join(', ')}`);
    if (f.exportedVars.length) console.log(`**Exported variables**: ${f.exportedVars.map((n) => `\`${n}\``).join(', ')}`);
    console.log('');
  }
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
