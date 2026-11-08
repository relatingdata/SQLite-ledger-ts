#!/usr/bin/env bun
// A real, mechanical staleness check — the counterpart to
// check-docs-coverage.ts. Coverage asks "is every real name mentioned
// somewhere in the manual?" This asks the opposite, equally real
// question: "does everything the manual mentions still exist?"
//
// Added directly in response to a real, found failure: pm-testing-e2e.md
// and friends kept describing deleted per-path JSON Express routes
// (POST /journal/staging, GET /journal/staging/:reference/..., etc.)
// long after the whole app moved onto the ASCII-CSV POST /api/call
// protocol — nothing caught that drift because coverage-style checks
// only ever look for *missing* mentions, never *false* ones.
//
// Two real, mechanical, low-false-positive checks, run against every
// docs/pm-*.md chapter (the Programmer's Manual's own source chapters —
// the files people actually edit, not the generated, assembled output):
//
// 1. Dangling file-path references: any backtick-quoted path ending in
//    a real source extension (.ts/.svelte/.sql/.scm/.sld) that doesn't
//    exist on disk. Catches "this doc still points at a deleted file."
// 2. Dead HTTP route references: any `VERB /path` pattern (the shape
//    every doc in this repo uses to describe a real HTTP call) whose
//    path isn't one of the three real, current mounts
//    (/api/call, /api/health, /api/recording/...). Since the whole app
//    now runs through those three mounts and nothing else, any other
//    VERB+path combination is almost certainly a leftover description
//    of a route that was deleted in the ASCII-CSV migration.
//
// Run via `make check-docs-staleness`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = path.join(root, 'docs');

const chapters = fs
  .readdirSync(docsDir)
  .filter((f) => f.startsWith('pm-') && f.endsWith('.md'));

let failures = 0;

// --- Check 1: dangling file-path references ---------------------------
// Docs in this repo refer to files both root-relative
// (`backend/src/db.ts`) and by bare basename (`db.ts`) depending on
// context, so a real check can't just test root-relative existence (that
// alone produced ~150 false positives the first time this ran, every one
// a legitimately bare-basename reference, not a real dangling path).
// Instead: build a real index of every source file's basename anywhere
// in the real tree, and only flag a reference whose basename matches
// NOTHING real anywhere — that's a genuine "this file doesn't exist
// under any path" case, not a formatting difference.
const SOURCE_EXTS = new Set(['.ts', '.svelte', '.sql', '.scm', '.sld']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist']);
const basenameIndex = new Set<string>();
function indexSourceFiles(dir: string): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) indexSourceFiles(full);
    else if (SOURCE_EXTS.has(path.extname(entry.name))) basenameIndex.add(entry.name);
  }
}
indexSourceFiles(root);

const pathPattern = /`([\w./-]+\.(?:ts|svelte|sql|scm|sld))`/g;
// Deliberate, confirmed exceptions — each is a path mentioned on
// purpose because it USED to exist and was removed (prose like "a
// prior `tui/test/smoke.test.ts` ... was removed"), not a stale claim
// that it still exists. Grows only when a real case like this is found
// and confirmed, never to silence a genuine dangling reference.
const deliberateHistoricalRefs = new Set<string>(['tui/test/smoke.test.ts']);

for (const chapter of chapters) {
  const content = fs.readFileSync(path.join(docsDir, chapter), 'utf-8');
  for (const m of content.matchAll(pathPattern)) {
    const ref = m[1];
    if (deliberateHistoricalRefs.has(ref)) continue;
    const base = path.basename(ref);
    if (basenameIndex.has(base)) continue; // exists somewhere real, under some path
    console.error(`❌ ${chapter}: references \`${ref}\`, which does not exist anywhere in the real source tree (checked by basename, not just the exact path).`);
    failures++;
  }
}

// --- Check 2: dead HTTP route references -------------------------------
const routePattern = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[\w/:_-]*)/g;
const liveMounts = ['/api/call', '/api/health', '/api/recording'];

for (const chapter of chapters) {
  const content = fs.readFileSync(path.join(docsDir, chapter), 'utf-8');
  for (const m of content.matchAll(routePattern)) {
    const [, verb, routePath] = m;
    if (liveMounts.some((mount) => routePath === mount || routePath.startsWith(mount + '/'))) continue;
    console.error(`❌ ${chapter}: references \`${verb} ${routePath}\`, which is not one of the app's three real, current HTTP mounts (/api/call, /api/health, /api/recording/...). Every other route was deleted in the ASCII-CSV migration — if this is describing real, current behavior, it should name a BACKEND_FUNCTIONS dispatch key via /api/call instead.`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`\n❌ ${failures} real, stale reference(s) found in the Programmer's Manual's source chapters. Fix the doc, or if this is a deliberate historical reference (e.g. docs/old/historical-manual.md, which this check does not scan), leave it there instead.`);
  process.exit(1);
}
console.log(`✅ Real documentation staleness check passed — zero dangling file-path or dead-route references across ${chapters.length} pm-*.md chapters.`);
