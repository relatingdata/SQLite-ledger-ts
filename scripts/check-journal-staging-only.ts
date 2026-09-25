// Per direct, absolute instruction: ALL financial data must be
// guaranteed to go through the journal + line staging tables. This is
// a real, mechanical, automated enforcement of that guarantee - not a
// convention, which has already been violated three times in this
// same codebase (createRecurringJournal, confirmPickedLine,
// confirmRestockPickedLine) before this check existed.
//
// The rule: only backend/src/db-journal.ts (the one, real, dedicated
// module for the journal API) and backend/schema/*.sql (the trigger
// definitions themselves, whose entire job is to perform these
// inserts) may contain a direct INSERT INTO journal or
// INSERT INTO journal_line. Every other real, exported backend
// function must reach these tables only through db-journal.ts's own,
// exported, staging-based functions (stageLine, postJournalEntry).

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ALLOWED_FILES = new Set(['backend/src/db-journal.ts']);
const PATTERN = /INSERT\s+(OR\s+\w+\s+)?INTO\s+journal(_line)?\b/gi;

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

const violations: { file: string; line: number; text: string }[] = [];

for (const file of walk('backend/src', ['.ts'])) {
  const relPath = file;
  if (ALLOWED_FILES.has(relPath)) continue;
  const lines = readFileSync(file, 'utf-8').split('\n');
  lines.forEach((line, i) => {
    if (PATTERN.test(line)) violations.push({ file: relPath, line: i + 1, text: line.trim() });
    PATTERN.lastIndex = 0;
  });
}

if (violations.length > 0) {
  console.error('❌ Real, confirmed violation(s) of the journal-staging-only guarantee found:\n');
  for (const v of violations) {
    console.error(`   ${v.file}:${v.line}: ${v.text}`);
  }
  console.error(
    '\nAll financial data must be guaranteed to go through the journal_entry_staging + post_journal_entry_insert trigger mechanism (backend/src/db-journal.ts). A direct INSERT INTO journal/journal_line anywhere else bypasses the real, per-currency balance check entirely.'
  );
  process.exit(1);
}

console.log('✅ Journal-staging-only guarantee holds — no direct INSERT INTO journal/journal_line found outside backend/src/db-journal.ts.');
