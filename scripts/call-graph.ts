#!/usr/bin/env bun
// A real, direct, static call-graph analysis - per direct request, to
// replace ad-hoc grepping with one, real, comprehensive tool. Extracts
// every real `export function <name>` from backend/src, then counts
// every real invocation of that name (as `name(`) across the whole
// codebase (backend/src, backend/scripts, frontend/src, e2e/tests),
// excluding the definition line itself.

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dir, '..');

function findFiles(dir: string, exts: string[], out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.svelte-kit') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findFiles(full, exts, out);
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

const backendSrcFiles = findFiles(path.join(root, 'backend', 'src'), ['.ts']);
const allSearchFiles = [
  ...backendSrcFiles,
  ...findFiles(path.join(root, 'backend', 'scripts'), ['.ts']),
  ...findFiles(path.join(root, 'frontend', 'src'), ['.ts', '.svelte']),
  ...findFiles(path.join(root, 'e2e', 'tests'), ['.ts']),
];

// 1. Every real, exported function definition, and which file defines it.
const functionNames = new Set<string>();
for (const file of backendSrcFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  for (const m of content.matchAll(/^export function (\w+)/gm)) functionNames.add(m[1]);
}

// 2. Every real invocation of each function name, across every real file.
const fileContents = new Map<string, string>();
for (const file of allSearchFiles) fileContents.set(file, fs.readFileSync(file, 'utf-8'));

const callCounts = new Map<string, number>();
for (const name of functionNames) {
  const pattern = new RegExp(`\\b${name}\\(`, 'g');
  let total = 0;
  for (const [file, content] of fileContents) {
    const matches = content.match(pattern);
    if (!matches) continue;
    // Subtract the definition line itself for the file that defines it.
    const isDefiningFile = backendSrcFiles.includes(file) && content.includes(`export function ${name}(`);
    total += matches.length - (isDefiningFile ? 1 : 0);
  }
  callCounts.set(name, Math.max(0, total));
}

const totalFunctions = functionNames.size;
const totalCalls = [...callCounts.values()].reduce((a, b) => a + b, 0);

console.log(`Total real, exported backend functions: ${totalFunctions}`);
console.log(`Total real, direct invocations found: ${totalCalls}`);
console.log('');

const sorted = [...callCounts.entries()].sort((a, b) => a[1] - b[1]);
for (const [name, count] of sorted) {
  console.log(`${count}\t${name}`);
}

const deadCode = sorted.filter(([, count]) => count === 0);
console.log(`\n${deadCode.length} real function(s) with ZERO found invocations (dead-code candidates):`);
for (const [name] of deadCode) console.log(`   - ${name}`);
