#!/usr/bin/env bun
// Per direct, absolute instruction: no accounting, no per-table
// justification, no judgment calls about which tables are
// "defensible." A pure, mechanical grep and count of every real
// CREATE TABLE statement across the entire project. Staging tables
// (name contains "staging") are counted and reported separately.
// Every other (permanent) table is counted; if that count is not
// exactly 4 - entities, account, journal, journal_line - the build
// fails, full stop.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function findFiles(dir: string, ext: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.svelte-kit') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findFiles(full, ext));
    else if (entry.name.endsWith(ext)) results.push(full);
  }
  return results;
}

const sqlFiles = findFiles(root, '.sql');
const allTables: { name: string; file: string }[] = [];
for (const file of sqlFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  for (const m of content.matchAll(/^CREATE TABLE (\w+)/gm)) {
    allTables.push({ name: m[1], file: path.relative(root, file) });
  }
}

const stagingTables = allTables.filter((t) => t.name.includes('staging'));
const permanentTables = allTables.filter((t) => !t.name.includes('staging'));

// For each staging table, a plain, mechanical fact: does any real
// CREATE TRIGGER statement anywhere in the project reference it by
// name at all - reported, not judged, not required.
const allTriggerContent = sqlFiles.map((f) => fs.readFileSync(f, 'utf-8')).join('\n');
function hasReferencingTrigger(tableName: string): boolean {
  const triggerMatches = [...allTriggerContent.matchAll(/CREATE TRIGGER (\w+)[\s\S]*?(?=CREATE TRIGGER|\Z)/g)];
  return triggerMatches.some((m) => new RegExp(`\\b${tableName}\\b`).test(m[0]));
}

console.log(`Total CREATE TABLE statements found (entire project, all *.sql files): ${allTables.length}\n`);

console.log(`Staging tables (${stagingTables.length}):`);
for (const t of stagingTables.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  - ${t.name} (${t.file}) - referencing trigger found: ${hasReferencingTrigger(t.name)}`);
}

console.log(`\nPermanent (non-staging) tables (${permanentTables.length}):`);
for (const t of permanentTables.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  - ${t.name} (${t.file})`);
}

const EXPECTED_PERMANENT = ['account', 'entities', 'journal', 'journal_line'].sort();
const actualPermanentNames = permanentTables.map((t) => t.name).sort();

console.log('');
if (permanentTables.length !== 4 || JSON.stringify(actualPermanentNames) !== JSON.stringify(EXPECTED_PERMANENT)) {
  console.error(`❌ FAIL: expected exactly 4 permanent (non-staging) tables - entities, account, journal, journal_line. Found ${permanentTables.length}: ${actualPermanentNames.join(', ')}.`);
  process.exit(1);
}

console.log('✅ PASS: exactly 4 permanent tables, matching entities, account, journal, journal_line.');
