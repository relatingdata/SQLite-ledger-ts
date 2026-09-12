import { updateEntity, db } from '../src/db.js';

const german = [
  'Aktienkapital', 'Anzahlungen von Kunden', 'Aufwand für Dienstleistungen', 'Bankkontokorrent',
  'Büromaschinen, Informatik', 'Debitoren', 'Dienstleistungsertrag', 'Finanzaufwand', 'Handelswaren',
  'Kasse', 'Kreditoren', 'Rohstoffe', 'Steuern', 'Verwaltungsaufwand', 'Warenaufwand', 'Warenertrag',
];
const italian = [
  'Autovetture', 'Banca c/c', 'Banca di ... c/c', 'Capitale sociale', 'Cassa e valori',
  'Crediti verso clienti per fatture emesse', 'Energia elettrica', 'Materie prime',
  'Merci destinate alla rivendita', 'Ricavi cessione beni', 'Ricavi per prestazioni a terzi',
  'Rimanenze prodotti finiti', 'Riserva legale', 'Spese di assicurazione', 'Spese telefoniche',
  'Utili esercizi precedenti',
];
const english = [
  'Bank', 'Bank Account (DKK)', 'Bank Account (EUR)', 'Fixed Assets', 'Freight In', 'Loans Payable',
  'Miscellaneous', 'Office', 'Other Income', 'Purchases Tax Claimed', 'Rent', 'Retained Earnings',
  'Sales Discounts', 'Sales Revenue', 'Wages', 'Wine Returns', 'Gas', 'Internet', 'Telephone', 'Water',
  'Lighting & General', 'Refrigeration',
];
// Deliberately NOT tagged at all: 'Acme Corp', 'Acme Supplies Pty Ltd',
// 'Beta Pty Ltd' — real vendor/customer contact accounts, not Chart
// of Accounts leaves. A vendor or customer isn't part of any CoA
// family; the same real supplier could in principle be paid by a
// business using any family's books, so tagging them would be wrong,
// not just unnecessary.

const groups: [string[], string][] = [
  [german, 'German CoA'],
  [italian, 'Italian CoA'],
  [english, 'English CoA'],
];

let tagged = 0;
let skippedAlreadyTagged = 0;
let skippedNotFound = 0;
for (const [names, family] of groups) {
  for (const name of names) {
    const entity = db.prepare('SELECT id, relation_id FROM current_entities WHERE name = ?').get(name) as { id: number; relation_id: number | null } | undefined;
    if (!entity) {
      skippedNotFound++;
      console.warn('Not found, skipped:', name);
      continue;
    }
    if (entity.relation_id != null) {
      skippedAlreadyTagged++;
      continue;
    }
    updateEntity(entity.id, { relation: family }, 1);
    tagged++;
  }
}
console.log('Tagged:', tagged, '| Already tagged (skipped):', skippedAlreadyTagged, '| Not found:', skippedNotFound);
