// Every text the person reads (the menus, the screens' titles, headings,
// field labels, placeholders and help texts, and the frontend's own words)
// is defined in every language, English included (docs/pm-translations.md).
//
// Builds a new database in a temporary file, loads every translation the
// project defines (the seed, then shared-fixtures/translations-steps.csv
// through the step runner's API path), and compares, per language, the
// texts with getLocalizedText(language). Prints a summary per language and
// kind and writes the full list to backend/data/missing-translations.csv.
// Exits 1 when anything is missing.
//
// Run via `make check-translations` (after `make generate`, so the
// generated pages exist).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'check-translations-'));
process.env.DB_PATH = path.join(tmp, 'entities.sqlite');
process.env.ENTITY_DRIVER = 'sql';

type Kind = 'menu' | 'screen title' | 'heading' | 'field' | 'help text' | 'screen text' | 'shared text';
interface Text { text: string; kind: Kind; where: string }
const texts = new Map<string, Text>(); // keyed by text; first place found wins
const add = (text: string, kind: Kind, where: string) => {
  const t = text.trim();
  if (t && /[A-Za-z]/.test(t) && !texts.has(t)) texts.set(t, { text: t, kind, where });
};

function unquote(body: string): string {
  return body.replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\(.)/g, '$1');
}
const literal = /(?:translations\.current\[|\bt\()\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*[\])]/g;

// --- 1. The screens' configuration (application/application.entities) ---
const KIND_OF_ATTRIBUTE: Record<string, Kind> = {
  Title: 'screen title',
  Text: 'heading',
  Label: 'field',
  Placeholder: 'field',
  Description: 'help text',
  Intro: 'help text',
  Empty: 'help text',
  Summary: 'help text',
};
let currentScreen = '';
for (const line of fs.readFileSync(path.join(root, 'application/application.entities'), 'utf-8').split('\n')) {
  const screen = line.match(/^\s*(?:"([^"]+)"|(\S+)) :Screen\b/);
  if (screen) currentScreen = screen[1] ?? screen[2];
  for (const m of line.matchAll(/\b(Title|Text|Label|Placeholder|Description|Intro|Empty|Summary)=(?:"((?:[^"\\]|\\.)*)"|(\S+))/g)) {
    const value = unquote(m[2] ?? m[3]);
    const where = currentScreen ? `screen ${currentScreen}` : 'a component (application.entities)';
    if (value.includes('translations.current[') || /\bt\(['"]/.test(value)) {
      // A label written as code: the words are its literals.
      for (const inner of value.matchAll(literal)) add(unquote(inner[1] ?? inner[2]), KIND_OF_ATTRIBUTE[m[1]], where);
      continue;
    }
    if (/^\{.*\}$/.test(value) || /^[a-z][A-Za-z0-9_.]*$/.test(value)) continue; // a code expression or name, not a text
    add(value, KIND_OF_ATTRIBUTE[m[1]], where);
  }
}

// --- 2. The frontend's own words: translations.current['…'] and t('…') ---
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(svelte|ts)$/.test(e.name)) out.push(full);
  }
  return out;
}
for (const file of walk(path.join(root, 'frontend/src'))) {
  const rel = path.relative(path.join(root, 'frontend/src'), file).split(path.sep).join('/');
  const route = rel.startsWith('routes/') ? '/' + rel.replace(/^routes\//, '').replace(/\/?\+page\.svelte$|\/?\+layout\.svelte$/, '') : '';
  for (const m of fs.readFileSync(file, 'utf-8').matchAll(literal)) {
    add(unquote(m[1] ?? m[2]), route ? 'screen text' : 'shared text', route ? `page ${route || '/'}` : rel);
  }
}

// --- 3. A database with every translation the project defines ---
const db = await import('../src/db.ts');
const { loadScreens, loadSteps, runStepViaApi } = await import('./step-runner.ts');
const fixtures = path.join(root, 'shared-fixtures');
const screens = loadScreens(path.join(fixtures, 'screens.csv'));
let fixtureFailures = 0;
for (const step of loadSteps(path.join(fixtures, 'translations-steps.csv'))) {
  if (step.skip) continue;
  if (!runStepViaApi(step, screens).ok) fixtureFailures++;
}

// --- 4. The menus ---
for (const section of db.getMenuTree()) {
  add(section.label, 'menu', 'menu');
  for (const link of section.links) add(link.label, 'menu', `menu "${section.label}"`);
}

// --- 5. Compare, per language ---
// Read the translations themselves, not localized_text: that view gives
// every concept with no translation its English key as the text.
const raw = db.db;
const languages = db.getLanguages().map((l: { name: string }) => l.name);
const concepts = new Set(
  (raw.prepare(`SELECT name FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'Vocabulary' AND parent_id = (SELECT id FROM current_entities WHERE name = 'Application'))`).all() as { name: string }[]).map((r) => r.name)
);
const translatedIn = raw.prepare(
  `SELECT DISTINCT c.name FROM current_entities t JOIN current_entities c ON c.id = t.relation_id WHERE t.parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Languages'))`
);
const missing: { language: string; t: Text; reason: string }[] = [];
for (const language of languages) {
  const defined = new Set((translatedIn.all(language) as { name: string }[]).map((r) => r.name));
  for (const t of texts.values()) {
    if (defined.has(t.text)) continue;
    missing.push({ language, t, reason: concepts.has(t.text) ? 'no translation' : 'not a Vocabulary concept' });
  }
}

const notConcepts = [...texts.values()].filter((t) => !concepts.has(t.text)).length;

const kinds: Kind[] = ['menu', 'screen title', 'heading', 'field', 'help text', 'screen text', 'shared text'];
const count = (language: string, kind: Kind) => missing.filter((m) => m.language === language && m.t.kind === kind).length;
const total = (kind: Kind) => [...texts.values()].filter((t) => t.kind === kind).length;
console.log(`Texts checked: ${texts.size} (${kinds.map((k) => `${k} ${total(k)}`).join(', ')}).`);
console.log(`${notConcepts} of them are not Vocabulary concepts, so no language can translate them.`);
if (fixtureFailures) console.log(`(${fixtureFailures} step(s) of translations-steps.csv failed; their translations are not loaded.)`);
console.log(['Missing'.padEnd(10), ...kinds.map((k) => k.padStart(12)), 'total'.padStart(7)].join(' '));
for (const language of languages) {
  const row = kinds.map((k) => count(language, k));
  console.log([language.padEnd(10), ...row.map((n) => String(n).padStart(12)), String(row.reduce((a, b) => a + b, 0)).padStart(7)].join(' '));
}

const outFile = path.join(root, 'backend/data/missing-translations.csv');
const csv = (s: string) => `"${s.replace(/"/g, '""')}"`;
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, ['language,kind,reason,where,text', ...missing.map((m) => [m.language, m.t.kind, m.reason, m.t.where, m.t.text].map(csv).join(','))].join('\n') + '\n');
fs.rmSync(tmp, { recursive: true, force: true });

if (missing.length) {
  console.error(`❌ ${missing.length} missing translation(s); the list is in backend/data/missing-translations.csv.`);
  process.exit(1);
}
console.log('✅ PASS: every text is defined in every language.');
process.exit(0);
