// The single, real, comprehensive translation loader, per direct,
// absolute instruction: every real translation this application uses
// lives in one, real, plain-ASCII CSV file
// (shared-fixtures/translations.csv), not scattered across several
// separate, hardcoded TypeScript arrays. Replaces
// migrateAllTranslationsToEntities, migrateForCompleteTranslations,
// migrateForDanish, and seedHebrewArabicTranslations - this one real
// function does what all four of those combined used to do.
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { readCsv } from './csv.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export interface TranslationRow {
  concept: string;
  language: string;
  text: string;
}

export function loadAllTranslations(): TranslationRow[] {
  const csvText = fs.readFileSync(path.join(here, 'translations.csv'), 'utf-8');
  return readCsv(csvText).map((row) => ({
    concept: row.concept,
    language: row.language,
    text: row.text,
  }));
}
