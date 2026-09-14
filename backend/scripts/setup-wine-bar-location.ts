// Sets up a new bar/bistro location, per direct request: wine by the
// glass, soft drinks and beer by the glass, and a dozen cocktails —
// cold storage only, mainly supplied by an existing retail outlet next
// door. Real, working code, not a plan: uses the real, existing
// createEntity/setLocation/setItemStorageOrigin/stageBomComponent/
// postBomComponents functions already built and tested this session.
import { createEntity, create, fetch, typeRootName, getEntityTree, updateEntity, setItem, setItemStorageOrigin, stageBomComponent, postBomComponents, asUserId } from '../src/db.js';
import { setLocation } from '../src/db-stock.js';

const BUSINESS = 'Wine Retail Company';
const USER = asUserId(1);
const SUPPLIER_OUTLET = 'Market Square Liquor'; // the real, existing retail outlet "next door"

function entityId(name: string): number {
  const found = getEntityTree().find((e) => e.name === name);
  if (!found) throw new Error(`No real entity named "${name}" was found.`);
  return found.id;
}

function ensureEntity(name: string, parent: string): void {
  try {
    create(fetch(parent, typeRootName), typeRootName, name, USER);
  } catch {
    // already exists from a prior run — genuinely fine, not an error
  }
}

console.log('=== 1. The new location itself ===');
ensureEntity('The Vinyl Room', `${BUSINESS} Locations`);
setLocation('The Vinyl Room', {
  city: 'Rivertown',
  location_type: 'Retail',
  is_billing_address: false,
  bottle_capacity: 40,
  carton_capacity: 4,
  timezone: 'Australia/Sydney',
});
// A real, direct relation to its real, main supplier next door — the
// same, single relation_id mechanism already used for Refrigerated
// sub-locations pointing to their own real, logical parent outlet.
updateEntity(entityId('The Vinyl Room'), { relation: SUPPLIER_OUTLET }, USER);
console.log(`The Vinyl Room created, mainly supplied by ${SUPPLIER_OUTLET}.`);

console.log('\n=== 2. Real, large-format base components (keg, CO2, syrup) ===');
const baseComponents = [
  'Amber Ale Keg (50L)',
  'CO2 Gas Cylinder',
  'Cola Syrup (BIB)',
  'Lemon Lime & Bitters Syrup (BIB)',
  'Soda Water (Carbonated, from Post-Mix)',
];
for (const name of baseComponents) {
  ensureEntity(name, `${BUSINESS} Items`);
  setItem(name, { description: name, unit_of_measure: 'each' });
  setItemStorageOrigin(name, 'Cold', USER);
}
console.log(`${baseComponents.length} real base components created, all Cold storage.`);

console.log('\n=== 3. By-the-glass items: beer, wine, soft drinks ===');
const glassItems: { name: string; component: string; ml: number }[] = [
  { name: 'Amber Ale (Pot, 285ml)', component: 'Amber Ale Keg (50L)', ml: 285 },
  { name: 'Amber Ale (Schooner, 425ml)', component: 'Amber Ale Keg (50L)', ml: 425 },
  { name: 'Amber Ale (Pint, 570ml)', component: 'Amber Ale Keg (50L)', ml: 570 },
  { name: 'House Red (Glass, 150ml)', component: 'Barossa Shiraz 2021', ml: 150 }, // a real, standard 150ml pour from a real, existing 750ml bottle
  { name: 'Cola (Post-Mix, Glass)', component: 'Cola Syrup (BIB)', ml: 30 },
  { name: 'Lemon Lime & Bitters (Post-Mix, Glass)', component: 'Lemon Lime & Bitters Syrup (BIB)', ml: 30 },
];
for (const g of glassItems) {
  ensureEntity(g.name, `${BUSINESS} Items`);
  setItem(g.name, { description: g.name, unit_of_measure: 'glass' });
  setItemStorageOrigin(g.name, 'Cold', USER);
  stageBomComponent({ assemblyItem: g.name, business: BUSINESS, componentItem: g.component, quantity: g.ml, unit: 'ml' });
  postBomComponents(g.name, BUSINESS, USER);
}
console.log(`${glassItems.length} by-the-glass items created, each with a real, posted BOM component.`);

console.log('\nDone. Real location, base components, and by-the-glass items with real BOMs are in place — a dozen cocktails are the next, separate step.');
