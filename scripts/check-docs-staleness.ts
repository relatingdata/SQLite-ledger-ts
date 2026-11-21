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
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = path.join(root, 'docs');

// Every hand-written chapter of the Programmer's Manual: the pm-*.md files
// and the storage model specification (function-inventory.md and
// screens-inventory.md are generated from the code).
const chapters = fs
  .readdirSync(docsDir)
  .filter((f) => (f.startsWith('pm-') && f.endsWith('.md')) || f === 'storage-model-specification.md');

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
    else if (SOURCE_EXTS.has(path.extname(entry.name))) {
      basenameIndex.add(entry.name);
      pathIndex.push(path.relative(root, full).split(path.sep).join('/'));
    }
  }
}
const pathIndex: string[] = [];
indexSourceFiles(root);

const pathPattern = /`([\w./-]+\.(?:ts|svelte|sql|scm|sld))`/g;


for (const chapter of chapters) {
  const content = fs.readFileSync(path.join(docsDir, chapter), 'utf-8');
  for (const m of content.matchAll(pathPattern)) {
    const ref = m[1];
    const base = path.basename(ref);
    // A path with a directory must name a real file: the whole path from the
    // repository root, or its tail (`call-dispatch/pos.ts`); a bare file
    // name must exist under some path.
    if (ref.includes('/') ? pathIndex.some((p) => p === ref || p.endsWith('/' + ref)) : basenameIndex.has(base)) continue;
    console.error(`❌ ${chapter}: references \`${ref}\`, which does not exist anywhere in the real source tree (checked by basename, not just the exact path).`);
    failures++;
  }
}

// --- Check 2: dead HTTP route references -------------------------------
const routePattern = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[\w/:_-]*)/g;
const liveMounts = ['/api/call', '/api/core/call', '/api/health', '/api/recording'];
// The storage engine's own HTTP routes (storage_engine/src/http_api.gleam,
// port 8090): `["journal", id, "reverse"], "POST"` is POST /journal/<id>/reverse.
const engineRoutes = [...fs.readFileSync(path.join(root, "storage_engine/src/http_api.gleam"), 'utf-8').matchAll(/\[([^\]]*)\],\s*"(GET|POST|PUT|PATCH|DELETE)"/g)].map(
  ([, segments, verb]) => ({ verb, segments: segments.split(',').map((seg) => seg.trim()).map((seg) => (seg.startsWith('"') ? seg.slice(1, -1) : null)) })
);
const isEngineRoute = (verb: string, routePath: string) => {
  const parts = routePath.replace(/\/$/, '').split('/').slice(1);
  return engineRoutes.some(
    (r) => r.verb === verb && (r.segments.length === parts.length || (routePath.endsWith('/') && r.segments.length > parts.length)) && parts.every((p, i) => r.segments[i] === null || r.segments[i] === p)
  );
};

for (const chapter of chapters) {
  const content = fs.readFileSync(path.join(docsDir, chapter), 'utf-8');
  for (const m of content.matchAll(routePattern)) {
    const [, verb, routePath] = m;
    if (liveMounts.some((mount) => routePath === mount || routePath.startsWith(mount + '/'))) continue;
    if (isEngineRoute(verb, routePath)) continue;
    console.error(`❌ ${chapter}: references \`${verb} ${routePath}\`, which is not one of the app's three real, current HTTP mounts (/api/call, /api/health, /api/recording/...). Every other route was deleted in the ASCII-CSV migration — if this is describing real, current behavior, it should name a BACKEND_FUNCTIONS dispatch key via /api/call instead.`);
    failures++;
  }
}

// --- Check 3: code names that exist nowhere in the code ---------------
// Every backtick-quoted span is split into words; every word shaped like a
// code name (camelCase, PascalCase with two capitals, or snake_case) must
// occur in some tracked source file, or be the name of one. So the manual
// cannot describe a function, type, table, column or field that the code
// does not have.
const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf-8' }).split('\n').filter(Boolean);
const codeWords = new Set<string>();
for (const file of tracked) {
  if (file.startsWith('docs/') || !/\.(ts|svelte|gleam|lfe|sql|js|mjs|cjs|csv|entities|erl|sh|json|scm|sld|toml|yml|yaml)$|(^|\/)Makefile$/.test(file)) continue;
  codeWords.add(path.basename(file).replace(/\.[^.]+$/, ''));
  codeWords.add(path.basename(file).replace(/\..*$/, ''));
  let text: string;
  try { text = fs.readFileSync(path.join(root, file), 'utf-8'); } catch { continue; }
  // Comments do not count: a name that survives only in a comment is not
  // in the code.
  const ext = path.extname(file);
  if (['.ts', '.svelte', '.js', '.mjs', '.cjs', '.gleam', '.sql', '.erl', '.lfe'].includes(ext)) {
    text = text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
    text = text.replace(ext === '.sql' ? /--.*$/gm : ext === '.erl' || ext === '.lfe' ? /[%;].*$/gm : /(^|[^:'"`])\/\/.*$/gm, '$1');
  } else if (file.endsWith('Makefile') || ext === '.sh' || ext === '.toml' || ext === '.yml' || ext === '.yaml') {
    text = text.replace(/(^|\s)#.*$/gm, '$1');
  }
  for (const w of text.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) codeWords.add(w);
}
// Names of things outside this repository that the manual mentions.
// DatabaseSync (node:sqlite), hooksPath (git config), NumberFormat (Intl),
// state_referenced_locally (a Svelte compiler warning).
const externalNames = new Set(['DatabaseSync', 'hooksPath', 'NumberFormat', 'state_referenced_locally']);
const codeShaped = (w: string) => /^[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*$/.test(w) || /^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+$/.test(w) || /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(w);
for (const chapter of chapters) {
  const lines = fs.readFileSync(path.join(docsDir, chapter), 'utf-8').split('\n');
  lines.forEach((line, i) => {
    for (const [, span] of line.matchAll(/`([^`\n]+)`/g)) {
      for (const w of span.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) {
        if (!codeShaped(w) || codeWords.has(w) || externalNames.has(w)) continue;
        console.error(`❌ ${chapter}:${i + 1}: names \`${w}\`, which occurs in no tracked source file.`);
        failures++;
      }
    }
  });
}

if (failures > 0) {
  console.error(`\n❌ ${failures} real, stale reference(s) found in the Programmer's Manual's source chapters. Fix the doc, or if this is a deliberate historical reference (e.g. docs/old/historical-manual.md, which this check does not scan), leave it there instead.`);
  process.exit(1);
}
console.log(`✅ Real documentation staleness check passed — zero dangling file-path, dead-route or unknown code-name references across ${chapters.length} pm-*.md chapters.`);
