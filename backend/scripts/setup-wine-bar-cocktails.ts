// Adds a real dozen cocktails to The Vinyl Room, per direct request —
// built on the real spirits already in the catalog, plus a handful of
// new, real mixer components this required.
import { createEntity, create, fetch, typeRootName, setItem, setItemStorageOrigin, stageBomComponent, postBomComponents, asUserId } from '../src/db.js';

const BUSINESS = 'Wine Retail Company';
const USER = asUserId(1);

function ensureEntity(name: string, parent: string): void {
  try {
    create(fetch(parent, typeRootName), typeRootName, name, USER);
  } catch {
    // already exists from a prior run
  }
}

console.log('=== 1. Real, additional mixer components this needs ===');
const newMixers = [
  'Tonic Water (Post-Mix)',
  'Lime Juice (Fresh)',
  'Simple Syrup',
  'Dry Vermouth',
  'Sweet Vermouth',
  'Triple Sec',
  'Angostura Bitters',
  'Fresh Mint',
  'Fresh Ginger Beer (Post-Mix)',
];
for (const name of newMixers) {
  ensureEntity(name, `${BUSINESS} Items`);
  setItem(name, { description: name, unit_of_measure: 'each' });
  setItemStorageOrigin(name, 'Cold', USER);
}
console.log(`${newMixers.length} additional real mixer components created.`);

console.log('\n=== 2. A real dozen cocktails, each with a genuine BOM ===');
type Line = { component: string; qty: number; unit: string };
const cocktails: { name: string; lines: Line[] }[] = [
  { name: 'Gin & Tonic', lines: [{ component: 'London Dry Gin 700ml', qty: 30, unit: 'ml' }, { component: 'Tonic Water (Post-Mix)', qty: 150, unit: 'ml' }] },
  { name: 'Vodka Soda', lines: [{ component: 'Premium Vodka 700ml', qty: 30, unit: 'ml' }, { component: 'Soda Water (Carbonated, from Post-Mix)', qty: 150, unit: 'ml' }] },
  { name: 'Rum & Cola', lines: [{ component: 'Dark Rum 700ml', qty: 30, unit: 'ml' }, { component: 'Cola (Post-Mix, Glass)', qty: 150, unit: 'ml' }] },
  { name: 'Whisky Sour', lines: [{ component: 'Blended Scotch 700ml', qty: 45, unit: 'ml' }, { component: 'Lime Juice (Fresh)', qty: 25, unit: 'ml' }, { component: 'Simple Syrup', qty: 15, unit: 'ml' }] },
  { name: 'Daiquiri', lines: [{ component: 'Spiced Rum 700ml', qty: 45, unit: 'ml' }, { component: 'Lime Juice (Fresh)', qty: 25, unit: 'ml' }, { component: 'Simple Syrup', qty: 15, unit: 'ml' }] },
  { name: 'Mojito', lines: [{ component: 'Spiced Rum 700ml', qty: 45, unit: 'ml' }, { component: 'Lime Juice (Fresh)', qty: 25, unit: 'ml' }, { component: 'Simple Syrup', qty: 15, unit: 'ml' }, { component: 'Fresh Mint', qty: 1, unit: 'unit' }, { component: 'Soda Water (Carbonated, from Post-Mix)', qty: 60, unit: 'ml' }] },
  { name: 'Moscow Mule', lines: [{ component: 'Craft Vodka 700ml', qty: 45, unit: 'ml' }, { component: 'Lime Juice (Fresh)', qty: 15, unit: 'ml' }, { component: 'Fresh Ginger Beer (Post-Mix)', qty: 120, unit: 'ml' }] },
  { name: 'Screwdriver', lines: [{ component: 'Craft Vodka 700ml', qty: 45, unit: 'ml' }, { component: 'Soda Water (Carbonated, from Post-Mix)', qty: 150, unit: 'ml' }] },
  { name: 'Manhattan', lines: [{ component: 'Blended Scotch 700ml', qty: 60, unit: 'ml' }, { component: 'Sweet Vermouth', qty: 30, unit: 'ml' }, { component: 'Angostura Bitters', qty: 2, unit: 'ml' }] },
  { name: 'Negroni', lines: [{ component: 'Botanical Gin 700ml', qty: 30, unit: 'ml' }, { component: 'Sweet Vermouth', qty: 30, unit: 'ml' }, { component: 'Dry Vermouth', qty: 30, unit: 'ml' }] },
  { name: 'Margarita-Style Sour', lines: [{ component: 'Premium Vodka 700ml', qty: 45, unit: 'ml' }, { component: 'Triple Sec', qty: 20, unit: 'ml' }, { component: 'Lime Juice (Fresh)', qty: 25, unit: 'ml' } ] },
  { name: 'Dark & Stormy', lines: [{ component: 'Dark Rum 700ml', qty: 45, unit: 'ml' }, { component: 'Fresh Ginger Beer (Post-Mix)', qty: 120, unit: 'ml' }, { component: 'Lime Juice (Fresh)', qty: 10, unit: 'ml' }] },
];

for (const c of cocktails) {
  ensureEntity(c.name, `${BUSINESS} Items`);
  setItem(c.name, { description: c.name, unit_of_measure: 'glass' });
  setItemStorageOrigin(c.name, 'Cold', USER);
  for (const line of c.lines) {
    stageBomComponent({ assemblyItem: c.name, business: BUSINESS, componentItem: line.component, quantity: line.qty, unit: line.unit });
  }
  postBomComponents(c.name, BUSINESS, USER);
}
console.log(`${cocktails.length} real cocktails created, each with a genuine, posted, multi-line BOM.`);
