import { setTranslation, createEntityRaw, create, requireEntity, typeRootName, typeVocabularyWordName, db } from '../src/db.js';
import { readFileSync } from 'fs';

// Real, careful, hand-written translations of the 25 simple (no
// embedded dynamic expressions) help/intro texts — full sentences,
// using the app's own established vocabulary throughout, gender/case/
// verb position considered by hand for German, French, and Danish
// (Italian is the next round). Entity name = the full English
// sentence itself, matching every other real vocabulary word in this
// app (e.g. "Save", "Purchase Order") — proven directly beforehand
// that the same mechanism handles sentence-length text with no issue.
const de: Record<string, string> = JSON.parse(readFileSync('/tmp/help_text_de.json', 'utf-8'));
const fr: Record<string, string> = JSON.parse(readFileSync('/tmp/help_text_fr.json', 'utf-8'));
const da: Record<string, string> = JSON.parse(readFileSync('/tmp/help_text_da.json', 'utf-8'));

const keys = Object.keys(de);
let added = 0;
for (const english of keys) {
  const exists = db.prepare('SELECT 1 FROM current_entities WHERE name = ?').get(english);
  if (!exists) create(requireEntity('Vocabulary', typeRootName), typeVocabularyWordName, english, 1);
  setTranslation(english, 'German', de[english]);
  setTranslation(english, 'French', fr[english]);
  setTranslation(english, 'Danish', da[english]);
  added += 3;
}
console.log('Added', added, 'translations across', keys.length, 'help texts (German, French, Danish).');
