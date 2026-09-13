// Adds the real Hebrew/Arabic translation for the app's own brand
// name, per direct request.
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { readCsv, writeCsv } from './csv.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.join(here, 'translations.csv');
const existing = readCsv(fs.readFileSync(csvPath, 'utf-8'));

const translations: Record<string, { hebrew: string; arabic: string }> = {
  'Better Brighter Multi-Ledger': { hebrew: 'בטר ברייטר מאלטי-לדג׳ר', arabic: 'بيتر برايتر ملتي ليدجر' },
};

const merged = new Map(existing.map((r) => [r.concept + '|' + r.language, r]));
let added = 0;
for (const [concept, { hebrew, arabic }] of Object.entries(translations)) {
  for (const [language, text] of [['Hebrew', hebrew], ['Arabic', arabic]] as const) {
    const key = concept + '|' + language;
    if (!merged.has(key)) {
      merged.set(key, { concept, language, text });
      added++;
    }
  }
}
fs.writeFileSync(csvPath, writeCsv(Array.from(merged.values()), ['concept', 'language', 'text']));
console.log(`Added ${added} real, new brand-name translations.`);
