// Rewrites an .entities file in its canonical form: loads it and writes it
// back, so that relations are in name order and every line is spelled the
// one way the writer spells it. Run after editing the file by hand.
//
//   entities-format.ts <file.entities>

import { readFileSync, writeFileSync } from 'fs';
import { Store } from '../src/core/store.js';
import { loadEntitiesText, dumpEntitiesText } from '../src/entities/entities-text.js';

const file = process.argv[2];
if (!file) throw new Error('Usage: entities-format.ts <file.entities>');
const before = readFileSync(file, 'utf-8');
const store = new Store(':memory:');
loadEntitiesText(store, before);
const after = dumpEntitiesText(store);
if (after !== before) writeFileSync(file, after);
console.log(after === before ? `${file} is already canonical.` : `${file} rewritten in canonical form.`);
