#!/usr/bin/env bun
// A real, mechanical, structural check - per
// /mnt/skills/user/documentation-coverage-enforcement/SKILL.md (see
// that skill, and docs/skill-documentation-coverage-enforcement.md,
// for the full, honest rationale and real, stated limits - kept brief
// here deliberately). Extracts every real exported backend function,
// Makefile target, and frontend route, and fails loudly if its own
// name never appears anywhere in the assembled Programmer's Manual.

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dir, '..');
const manualPath = path.join(root, 'docs', 'programmer-manual.md');

if (!fs.existsSync(manualPath)) {
  console.error(`❌ ${manualPath} does not exist — run "cd docs && python3 build-programmer-manual.py" first.`);
  process.exit(1);
}
let manual = fs.readFileSync(manualPath, 'utf-8');
// A real, honest fix: the baseline document itself lists every known-
// undocumented name, by name - if searched as-is, every one of those
// names would appear to "pass" simply by being listed as undocumented,
// which is the opposite of real documentation. Excise that one real
// section's own text (up to, but not including, whatever real chapter
// heading comes next) from the search before checking anything.
const baselineMarker = '# Documentation Coverage Baseline';
const baselineStart = manual.indexOf(baselineMarker);
if (baselineStart !== -1) {
  const afterMarker = manual.indexOf('\n# ', baselineStart + baselineMarker.length);
  const baselineEnd = afterMarker === -1 ? manual.length : afterMarker;
  manual = manual.slice(0, baselineStart) + manual.slice(baselineEnd);
}

function findFiles(dir: string, ext: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findFiles(full, ext, out);
    else if (entry.name.endsWith(ext)) out.push(full);
  }
  return out;
}

// 1. Every real exported backend function AND every real exported
// const - per direct, confirmed finding, this used to check functions
// only, leaving every real, exported const (the many typeXxxName
// TypeDescriptor values built for no-generic-functions, among others)
// completely invisible to this check, however undocumented.
const backendFunctions = new Set<string>();
for (const file of findFiles(path.join(root, 'backend', 'src'), '.ts')) {
  const content = fs.readFileSync(file, 'utf-8');
  for (const m of content.matchAll(/^export function (\w+)/gm)) backendFunctions.add(m[1]);
  for (const m of content.matchAll(/^export const (\w+)/gm)) backendFunctions.add(m[1]);
}

// 2. Every real Makefile target.
const makefileTargets = new Set<string>();
const makefile = fs.readFileSync(path.join(root, 'Makefile'), 'utf-8');
for (const m of makefile.matchAll(/^([a-zA-Z][\w-]*):/gm)) makefileTargets.add(m[1]);

// 3. Every real frontend route.
const frontendRoutes = new Set<string>();
const routesDir = path.join(root, 'frontend', 'src', 'routes');
for (const file of findFiles(routesDir, '.svelte')) {
  if (!file.endsWith('+page.svelte')) continue;
  const route = path.dirname(file).slice(routesDir.length) || '/';
  frontendRoutes.add(route);
}

function checkCoverage(label: string, names: Set<string>, baseline: Set<string>): { newlyMissing: string[]; stillBaselined: string[] } {
  const newlyMissing: string[] = [];
  const stillBaselined: string[] = [];
  for (const name of names) {
    if (!manual.includes(name)) {
      if (baseline.has(name)) stillBaselined.push(name);
      else newlyMissing.push(name);
    }
  }
  if (newlyMissing.length > 0) {
    console.error(`\n❌ ${label}: ${newlyMissing.length} real, NEW, undocumented names (not in the known baseline):`);
    for (const m of newlyMissing) console.error(`   - ${m}`);
  }
  if (stillBaselined.length > 0) {
    console.log(`⚠️  ${label}: ${stillBaselined.length} real, already-known gaps still open (see docs/documentation-coverage-baseline.md) - not blocking, but not forgotten.`);
  }
  if (newlyMissing.length === 0 && stillBaselined.length === 0) {
    console.log(`✅ ${label}: all ${names.size} real names mentioned in the manual.`);
  }
  return { newlyMissing, stillBaselined };
}

// A real, honest ratchet, per documentation-coverage-enforcement's own
// stated scope: this project had 149 real, pre-existing gaps the
// first time this check was run - fixing all of them before this
// check could exist at all was not realistic. The baseline lists
// those known gaps explicitly, by name, in a real, tracked file - this
// check enforces zero NEW gaps from this point forward, and the
// baseline is expected to shrink over time as real, separate
// documentation work closes each one, never to grow.
const baselinePath = path.join(root, 'docs', 'documentation-coverage-baseline.md');
const baselineNames = new Set<string>();
if (fs.existsSync(baselinePath)) {
  for (const line of fs.readFileSync(baselinePath, 'utf-8').split('\n')) {
    const m = line.match(/^- `([^`]+)`/);
    if (m) baselineNames.add(m[1]);
  }
}

const fnResult = checkCoverage('Backend exported functions/consts', backendFunctions, baselineNames);
const targetResult = checkCoverage('Makefile targets', makefileTargets, baselineNames);
const routeResult = checkCoverage('Frontend routes', frontendRoutes, baselineNames);

const totalNew = fnResult.newlyMissing.length + targetResult.newlyMissing.length + routeResult.newlyMissing.length;
if (totalNew > 0) {
  console.error(`\n❌ ${totalNew} real, NEW, undocumented names found — document them, or add them to docs/documentation-coverage-baseline.md only if this is a real, deliberate, temporary gap.`);
  process.exit(1);
}
const totalBaselined = fnResult.stillBaselined.length + targetResult.stillBaselined.length + routeResult.stillBaselined.length;
console.log(`\n✅ Real documentation coverage check passed — zero new, undocumented names (${totalBaselined} real, pre-existing, tracked gaps remain open).`);
