import { setTranslation, db } from '../src/db.js';
import { readFileSync } from 'fs';

// The 25 real help-text vocabulary entities already exist (created in
// the German/French/Danish round) — only the Italian translation rows
// are new here.
const it: Record<string, string> = JSON.parse(readFileSync('/tmp/help_text_it.json', 'utf-8'));

let added = 0;
for (const [english, text] of Object.entries(it)) {
  const exists = db.prepare('SELECT 1 FROM current_entities WHERE name = ?').get(english);
  if (!exists) {
    console.error('MISSING ENTITY (should already exist):', english.slice(0, 60));
    continue;
  }
  setTranslation(english, 'Italian', text);
  added++;
}
console.log('Added', added, 'Italian translations for help text.');
