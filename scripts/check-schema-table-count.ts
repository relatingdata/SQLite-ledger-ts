#!/usr/bin/env bun
// The four permanent tables, enforced. Every CREATE TABLE the project's
// own code can run (the backend's SQL schema and TypeScript, the storage
// engine's SQL and Gleam schemas) is found, and the build fails unless:
//   - every permanent table is one of entities, account, journal,
//     journal_line;
//   - the one staging table is journal_entry_staging;
//   - kaappi_wal, the Kaappi and memory entity drivers' op log, is
//     created only by those two drivers.
// Tracked files only (git ls-files), so scratch files never count.
// Documented in docs/pm-build-and-tooling.md, "The four permanent tables".
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PERMANENT = new Set(['entities', 'account', 'journal', 'journal_line']);
const STAGING = new Set(['journal_entry_staging']);
const DRIVER_LOG = 'kaappi_wal';
const DRIVER_LOG_FILES = new Set(['backend/src/drivers/kaappi-worker.ts', 'backend/src/drivers/memory-entity-driver.ts']);

const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf-8' }).split('\n').filter(Boolean);
const schemaFiles = tracked.filter(
  (f) => f.endsWith('.sql') || f.endsWith('.gleam') || (f.endsWith('.ts') && (f.startsWith('backend/src/') || f.startsWith('storage_engine/')))
);

const found: { name: string; file: string }[] = [];
for (const file of schemaFiles) {
  const text = fs.readFileSync(path.join(root, file), 'utf-8');
  for (const m of text.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(?!IF\b)([A-Za-z_]\w*)/g)) found.push({ name: m[1], file });
}

const problems: string[] = [];
for (const t of found) {
  if (PERMANENT.has(t.name) || STAGING.has(t.name)) continue;
  if (t.name === DRIVER_LOG && DRIVER_LOG_FILES.has(t.file)) continue;
  problems.push(`${t.name} (${t.file})`);
}

const byName = new Map<string, Set<string>>();
for (const t of found) byName.set(t.name, (byName.get(t.name) ?? new Set()).add(t.file));
console.log('Tables the code creates:');
for (const [name, files] of [...byName].sort()) console.log(`  - ${name}: ${[...files].sort().join(', ')}`);

if (problems.length > 0) {
  console.error(`\n❌ FAIL: tables outside entities, account, journal, journal_line and journal_entry_staging:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('\n✅ PASS: only entities, account, journal, journal_line, journal_entry_staging, and the drivers\' kaappi_wal.');
