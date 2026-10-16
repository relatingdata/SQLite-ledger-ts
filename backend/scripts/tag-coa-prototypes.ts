import { createEntityRaw, create, requireEntity, typeRootName, typeVocabularyWordName, getCoaPrototypeAccounts, supersedeEntity, db, getBusinesses } from '../src/db.js';

// Real, confirmed representative business+ledger for each real CoA
// prototype — getCoaPrototypeAccounts on each returns exactly the real
// accounts that prototype's own bootstrapped, published financial
// statements reference (see docs comment on getCoaPrototypeAccounts
// itself). Ledger names are no longer business-prefixed, so both are
// needed to correctly scope the lookup.
const prototypeRepresentatives: Record<string, { business: string; ledger: string }> = {
  'English CoA': { business: 'Wine Retail Business', ledger: 'Actual' },
  'German CoA': { business: 'BMW M GmbH', ledger: 'Actual' },
  'French CoA': { business: 'Peugeot Citroën Sochaux SNC', ledger: 'Actual' },
  'Italian CoA': { business: 'Ditta Italiana Srl', ledger: 'Actual' },
  'Swiss CoA': { business: 'Schweizer KMU AG', ledger: 'Actual' },
};

// Which real business(es) belong to each prototype — tagged the same
// way, so a business's own prototype is directly, cheaply knowable
// without re-deriving it from posting history every time.
const businessPrototypes: Record<string, string> = {
  'admin': 'English CoA',
  'Wine Retail Business': 'English CoA',
  'BMW M GmbH': 'German CoA',
  'Peugeot Citroën Sochaux SNC': 'French CoA',
  'Ditta Italiana Srl': 'Italian CoA',
  'Schweizer KMU AG': 'Swiss CoA',
};

let accountsTagged = 0;
let prototypesCreated = 0;

for (const prototypeName of Object.keys(prototypeRepresentatives)) {
  const exists = db.prepare('SELECT 1 FROM current_entities WHERE name = ?').get(prototypeName);
  if (!exists) {
    create(requireEntity('Vocabulary', typeRootName), typeVocabularyWordName, prototypeName, 1);
    prototypesCreated++;
  }
}

for (const [prototypeName, { business, ledger }] of Object.entries(prototypeRepresentatives)) {
  const accounts = getCoaPrototypeAccounts(business, ledger);
  for (const accountName of accounts) {
    const entity = db.prepare('SELECT id, relation_id FROM current_entities WHERE name = ?').get(accountName) as { id: number; relation_id: number | null } | undefined;
    if (!entity) continue;
    // Don't overwrite a real, existing relation (e.g. a COGS tag) —
    // prototype membership is recorded as a *second*, independent fact
    // about the same account where one is already set, by checking
    // first rather than clobbering.
    if (entity.relation_id != null) continue;
    supersedeEntity(entity.id, { relation: prototypeName }, 1);
    accountsTagged++;
  }
}

let businessesTagged = 0;
const allBusinesses = getBusinesses();
for (const biz of allBusinesses) {
  const prototypeName = businessPrototypes[biz.name];
  if (!prototypeName) {
    console.warn('No known prototype for business:', biz.name, '- leaving untagged');
    continue;
  }
  supersedeEntity(biz.id, { relation: prototypeName }, 1);
  businessesTagged++;
}

console.log('Prototypes created:', prototypesCreated);
console.log('Accounts tagged with their real CoA prototype:', accountsTagged);
console.log('Businesses tagged with their real CoA prototype:', businessesTagged, 'of', allBusinesses.length);
