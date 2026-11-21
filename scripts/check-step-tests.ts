#!/usr/bin/env bun
// Every test of the running app goes through the step runner:
//   - no tracked file is a Playwright spec (*.spec.ts) or imports the
//     Playwright test library (@playwright/test); the step runner's own
//     browser driver, the playwright library, is the one way in;
//   - every page of the app (each +page.svelte under frontend/src/routes
//     with no parameter in its path, generated pages too) has a "Page
//     Opens Cleanly" row in shared-fixtures/tests/every-page-opens.csv,
//     and every row there is a page that still exists.
// Files git tracks or would track (git ls-files), so ignored scratch
// files never count.
// Documented in docs/pm-testing-e2e.md, "Standalone tests".
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf-8' })
  .split('\n')
  .filter((f) => f && fs.existsSync(path.join(root, f)));
const problems: string[] = [];

for (const f of tracked) {
  if (f.endsWith('.spec.ts')) problems.push(`${f} is a Playwright spec: make it a standalone test in shared-fixtures/tests/.`);
  else if (/\.(ts|js|mjs|cjs|json)$/.test(f) && !f.startsWith('docs/') && fs.readFileSync(path.join(root, f), 'utf-8').includes('@playwright/test')) {
    if (f !== 'scripts/check-step-tests.ts') problems.push(`${f} uses @playwright/test.`);
  }
}

// The pages on disk, the generated ones too (make generate writes them
// from application/application.entities; they are not tracked).
const routesDir = path.join(root, 'frontend/src/routes');
const pages = new Set<string>();
(function walk(dir: string): void {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!e.name.includes('[')) walk(path.join(dir, e.name)); }
    else if (e.name === '+page.svelte') pages.add('/' + path.relative(routesDir, dir).split(path.sep).join('/'));
  }
})(routesDir);
if (pages.delete('/')) pages.add('/');
const smoke = fs.readFileSync(path.join(root, 'shared-fixtures/tests/every-page-opens.csv'), 'utf-8');
const opened = new Set([...smoke.matchAll(/^"Page Opens Cleanly","([^"]+)"/gm)].map((m) => m[1]));
for (const p of pages) if (!opened.has(p)) problems.push(`the page ${p} has no "Page Opens Cleanly" row in shared-fixtures/tests/every-page-opens.csv.`);
for (const p of opened) if (!pages.has(p)) problems.push(`shared-fixtures/tests/every-page-opens.csv opens ${p}, which is no longer a page.`);

console.log(`${tracked.length} files, ${pages.size} pages, ${opened.size} opened by every-page-opens.`);
if (problems.length > 0) {
  for (const p of problems) console.error(`  ${p}`);
  console.error('\n❌ FAIL: every test goes through the step runner (docs/pm-testing-e2e.md, "Standalone tests").');
  process.exit(1);
}
console.log('✅ PASS: no Playwright specs, and every page is opened by every-page-opens.');
