// Real, plain-ASCII CSV loader for the core wine-retail identifiers,
// per direct, absolute instruction: no JSON anywhere. Reconstructs
// the exact same object shape every real call site already expects
// (fixtures.business, fixtures.warehouses, etc.) from the real,
// plain wine-retail.csv file, so no calling code needs to change.
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { readCsv } from './csv.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const csvText = fs.readFileSync(path.join(here, 'wine-retail.csv'), 'utf-8');
const rows = readCsv(csvText);

function one(kind: string): string {
  const row = rows.find((r) => r.kind === kind);
  if (!row) throw new Error(`shared-fixtures/wine-retail.csv is missing a real "${kind}" row.`);
  return row.value;
}

function many(kind: string): string[] {
  return rows.filter((r) => r.kind === kind).map((r) => r.value);
}

export const fixtures = {
  business: one('business'),
  ledger: one('ledger'),
  vendor: one('vendor'),
  alternateVendor: one('alternateVendor'),
  trainingBusiness: one('trainingBusiness'),
  warehouses: many('warehouse'),
  retailOutlets: many('retailOutlet'),
};
