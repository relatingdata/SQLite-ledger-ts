// Fails when a screen is written by hand in a way the manual does not list.
//
// Every screen is described once in application/application.entities
// and generated for both front ends (docs/pm-application-config.md, "One
// description, two front ends"). The screens still written by hand are
// listed there as debt, and this gate keeps that list true and shrinking:
// - every hand-written web page (a +page.svelte in git under
//   frontend/src/routes) and TUI screen (tui/src/screens/*.svelte) is
//   listed;
// - every listed one exists, so deleting a screen removes it from the list;
// - no route is both generated (has a Template) and hand-written.
//
// Run via `make check-screens-described`; part of `make check-manual`.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const manual = readFileSync(join(ROOT, 'docs/pm-application-config.md'), 'utf8');

function listed(marker: string): string[] {
  const match = new RegExp(`<!-- ${marker} -->\\n([\\s\\S]*?)<!-- /${marker} -->`).exec(manual);
  if (!match) throw new Error(`docs/pm-application-config.md has no <!-- ${marker} --> list.`);
  return [...match[1].matchAll(/^- `([^`]+)`$/gm)].map((m) => m[1]);
}

const webPages = execSync('git ls-files frontend/src/routes', { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter((f) => f.endsWith('/+page.svelte'))
  .map((f) => f.slice('frontend/src/routes'.length, -'/+page.svelte'.length) || '/');
const tuiScreens = readdirSync(join(ROOT, 'tui/src/screens')).filter((f) => f.endsWith('.svelte'));

// The routes the entities describe with a Template: one line per screen,
// `   "<route>" :Screen ... Template=<name>`, or a variant of one.
const entities = readFileSync(join(ROOT, 'application/application.entities'), 'utf8');
const templated = new Set<string>();
for (const line of entities.split('\n')) {
  const m = /^ {3}"([^"]+)" :Screen .*(Template=|"Variant Of">)/.exec(line);
  if (m) templated.add(m[1]);
}

const failures: string[] = [];
const compare = (what: string, actual: string[], list: string[]) => {
  for (const a of actual) if (!list.includes(a)) failures.push(`${what} ${a} is written by hand but not listed in docs/pm-application-config.md: describe it in application/application.entities instead.`);
  for (const l of list) if (!actual.includes(l)) failures.push(`${what} ${l} is listed in docs/pm-application-config.md but no longer exists: remove it from the list.`);
};
compare('Web page', webPages, listed('hand-written-web'));
compare('TUI screen', tuiScreens, listed('hand-written-tui'));
for (const page of webPages) if (templated.has(page)) failures.push(`Web page ${page} is both generated and written by hand.`);

if (failures.length > 0) {
  for (const f of failures) console.log(`❌ ${f}`);
  process.exit(1);
}
console.log(`✅ PASS: ${webPages.length} hand-written web pages and ${tuiScreens.length} hand-written TUI screens, all listed; ${templated.size} screens described in the entities.`);
