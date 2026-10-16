import { setItem, getPart, getEntityTree, listItems, asBusinessName } from '../src/db.js';

const BEER = new Set(['Ale', 'Lager', 'Stout']);
const SPARKLING = new Set(['Cava', 'Champagne', 'Prosecco']);
const SPIRITS = new Set(['Whisky', 'Gin', 'Vodka', 'Rum']);
// Everything else (Shiraz, Merlot, Pinot Noir, Chablis, Riesling,
// Cabernet Sauvignon, Sauvignon Blanc, Chardonnay) is still wine.

// A simple, deterministic hash — not Math.random() — so this bootstrap
// data is stable and reproducible, not different on every fresh install.
function hashFraction(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

const items = listItems(asBusinessName('Wine Retail Business'));
const entities = getEntityTree();
const categoryOf = (name: string): string | undefined => {
  const e = entities.find((x) => x.name === name);
  const p = entities.find((x) => x.id === e?.parent_id);
  return p?.name;
};

let updated = 0;
for (const item of items) {
  const cat = categoryOf(item.name);
  const f = hashFraction(item.name);
  let minorUnits: number;
  if (cat && BEER.has(cat)) minorUnits = Math.round((600 + f * 600) / 5) * 5; // $6-$12, nearest 5c
  else if (cat && SPARKLING.has(cat)) minorUnits = Math.round((2200 + f * 5300) / 50) * 50; // $22-$75, nearest 50c
  else if (cat && SPIRITS.has(cat)) minorUnits = Math.round((3500 + f * 5000) / 50) * 50; // $35-$85
  else minorUnits = Math.round((1800 + f * 3700) / 50) * 50; // still wine, $18-$55

  const existing = getPart(item.name);
  setItem(item.name, { description: existing?.description ?? null, unit_of_measure: existing?.unit_of_measure ?? null, upc: existing?.upc ?? null, retail_price_minor: minorUnits });
  updated++;
}
console.log(`Set real retail_price_minor for ${updated} products.`);
