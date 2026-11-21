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
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manualPath = path.join(root, 'docs', 'programmer-manual.md');

if (!fs.existsSync(manualPath)) {
  console.error(`❌ ${manualPath} does not exist — run "make programmer-manual" first.`);
  process.exit(1);
}
let manual = fs.readFileSync(manualPath, 'utf-8');
manual = manual.replace(/<!-- generated:start -->[\s\S]*?<!-- generated:end -->/g, '');
// A test title in a "Tests:" list is not an explanation: a name that is
// mentioned only there is not documented.
manual = manual.split('\n').filter((line) => !/^- "[^"]*" \(`[^`]+`\)\s*$/.test(line)).join('\n');

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

function checkCoverage(label: string, names: Set<string>): string[] {
  const missing = [...names].filter((name) => !manual.includes(name)).sort();
  if (missing.length > 0) {
    console.error(`\n❌ ${label}: ${missing.length} name(s) the Programmer's Manual never mentions:`);
    for (const m of missing) console.error(`   - ${m}`);
  } else {
    console.log(`✅ ${label}: all ${names.size} names are in the manual.`);
  }
  return missing;
}

const missing = [
  ...checkCoverage('Backend exported functions/consts', backendFunctions),
  ...checkCoverage('Makefile targets', makefileTargets),
  ...checkCoverage('Frontend routes', frontendRoutes),
];
if (missing.length > 0) {
  console.error(`\n❌ ${missing.length} undocumented name(s): describe each in the chapter that covers it, or remove the code.`);
  process.exit(1);
}
console.log('\n✅ Documentation coverage check passed: every exported backend name, Makefile target and route is in the manual.');
