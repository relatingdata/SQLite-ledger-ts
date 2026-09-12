import { createEntity, getCoaFamilyAccounts, updateEntity, db, getBusinesses } from '../src/db.js';

// Real, confirmed representative business+ledger for each real CoA
// family — getCoaFamilyAccounts on each returns exactly the real
// accounts that family's own bootstrapped, published financial
// statements reference (see docs comment on getCoaFamilyAccounts
// itself). Ledger names are no longer business-prefixed, so both are
// needed to correctly scope the lookup.
const familyRepresentatives: Record<string, { business: string; ledger: string }> = {
  'English CoA': { business: 'Wine Retail Company', ledger: 'Actual' },
  'German CoA': { business: 'BMW M GmbH', ledger: 'Actual' },
  'French CoA': { business: 'Peugeot Citroën Sochaux SNC', ledger: 'Actual' },
  'Italian CoA': { business: 'Ditta Italiana Srl', ledger: 'Actual' },
  'Swiss CoA': { business: 'Schweizer KMU AG', ledger: 'Actual' },
};

// Which real business(es) belong to each family — tagged the same
// way, so a business's own family is directly, cheaply knowable
// without re-deriving it from posting history every time.
const businessFamilies: Record<string, string> = {
  'My Business': 'English CoA',
  'Wine Retail Company': 'English CoA',
  'BMW M GmbH': 'German CoA',
  'Peugeot Citroën Sochaux SNC': 'French CoA',
  'Ditta Italiana Srl': 'Italian CoA',
  'Schweizer KMU AG': 'Swiss CoA',
};

let accountsTagged = 0;
let familiesCreated = 0;

for (const familyName of Object.keys(familyRepresentatives)) {
  const exists = db.prepare('SELECT 1 FROM current_entities WHERE name = ?').get(familyName);
  if (!exists) {
    createEntity({ name: familyName, parent: 'Vocabulary' }, 1);
    familiesCreated++;
  }
}

for (const [familyName, { business, ledger }] of Object.entries(familyRepresentatives)) {
  const accounts = getCoaFamilyAccounts(business, ledger);
  for (const accountName of accounts) {
    const entity = db.prepare('SELECT id, relation_id FROM current_entities WHERE name = ?').get(accountName) as { id: number; relation_id: number | null } | undefined;
    if (!entity) continue;
    // Don't overwrite a real, existing relation (e.g. a COGS tag) —
    // family membership is recorded as a *second*, independent fact
    // about the same account where one is already set, by checking
    // first rather than clobbering.
    if (entity.relation_id != null) continue;
    updateEntity(entity.id, { relation: familyName }, 1);
    accountsTagged++;
  }
}

let businessesTagged = 0;
const allBusinesses = getBusinesses();
for (const biz of allBusinesses) {
  const familyName = businessFamilies[biz.name];
  if (!familyName) {
    console.warn('No known family for business:', biz.name, '- leaving untagged');
    continue;
  }
  updateEntity(biz.id, { relation: familyName }, 1);
  businessesTagged++;
}

console.log('Families created:', familiesCreated);
console.log('Accounts tagged with their real CoA family:', accountsTagged);
console.log('Businesses tagged with their real CoA family:', businessesTagged, 'of', allBusinesses.length);
