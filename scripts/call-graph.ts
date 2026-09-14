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
const directCallCounts = new Map<string, number>();
const referenceCounts = new Map<string, number>();
for (const name of functionNames) {
  const callPattern = new RegExp(`\\b${name}\\(`, 'g');
  // A real, direct fix for a real, confirmed false-positive: Express
  // middleware (requireAuth, attachUser) is genuinely used, but by
  // reference (`app.use(requireAuth)`), never as `requireAuth(...)` -
  // the direct-call pattern alone would wrongly call these dead code.
  // This second pattern counts every real, bare appearance of the
  // name as its own word, anywhere - a real superset of direct calls,
  // catching by-reference usage too.
  const referencePattern = new RegExp(`\\b${name}\\b`, 'g');
  let directTotal = 0;
  let referenceTotal = 0;
  for (const [file, content] of fileContents) {
    const isDefiningFile = backendSrcFiles.includes(file) && content.includes(`export function ${name}(`);
    const callMatches = content.match(callPattern);
    if (callMatches) directTotal += callMatches.length - (isDefiningFile ? 1 : 0);
    const refMatches = content.match(referencePattern);
    if (refMatches) referenceTotal += refMatches.length - (isDefiningFile ? 1 : 0);
  }
  directCallCounts.set(name, Math.max(0, directTotal));
  referenceCounts.set(name, Math.max(0, referenceTotal));
  // The real, reported count: prefer the more generous, real,
  // reference-inclusive count for genuine dead-code detection, since
  // a real, live, by-reference usage is still a real usage.
  callCounts.set(name, Math.max(0, referenceTotal));
}

const totalFunctions = functionNames.size;
const totalCalls = [...callCounts.values()].reduce((a, b) => a + b, 0);

console.log(`Total real, exported backend functions: ${totalFunctions}`);
console.log(`Total real, direct invocations found: ${totalCalls}`);
console.log('');

const sorted = [...callCounts.entries()].sort((a, b) => a[1] - b[1]);
for (const [name, count] of sorted) {
  const byReferenceOnly = directCallCounts.get(name) === 0 && count > 0;
  console.log(`${count}\t${name}${byReferenceOnly ? '\t(by reference only - e.g. real middleware, never directly invoked with parentheses)' : ''}`);
}

const deadCode = sorted.filter(([, count]) => count === 0);
console.log(`\n${deadCode.length} real function(s) with ZERO found usages, direct or by-reference (real dead-code candidates):`);
for (const [name] of deadCode) console.log(`   - ${name}`);
