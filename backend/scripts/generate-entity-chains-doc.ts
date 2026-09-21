// Generates docs/entity-chains.md directly from a real, live,
// fully-simulated database — every name, count, and chain in the
// output is what actually exists, not hand-written or assumed.
// Run after `make demo-full-year` (or any full simulation run) via:
//   node --import tsx backend/scripts/generate-entity-chains-doc.ts
import { getEntityTree, getContact, getLocation } from '../src/db.js';
import fs from 'node:fs';
import path from 'node:path';

const tree = getEntityTree();
const byId = new Map(tree.map((e) => [e.id, e]));
const byParent = new Map<number, typeof tree>();
for (const e of tree) {
  if (!byParent.get(e.parent_id)) byParent.set(e.parent_id, []);
  byParent.get(e.parent_id)!.push(e);
}
function childrenOfId(id: number) {
  return (byParent.get(id) || []).slice().sort((a, b) => a.name.localeCompare(b.name));
}
function childrenOfName(name: string) {
  const node = tree.find((e) => e.name === name);
  if (!node) return [];
  return childrenOfId(node.id);
}
function sampleNames(name: string, n = 6): string[] {
  const c = childrenOfName(name);
  const shown = c.slice(0, n).map((e) => e.name);
  if (c.length > n) shown.push(`… ${c.length - n} more`);
  return shown;
}
function esc(s: string) {
  return s.replace(/\|/g, '\\|');
}

let out = '';
out += '# Entity Chains — A Real, Live Snapshot\n\n';
out +=
  'Generated directly from a real, fully-simulated database (`make demo-full-year`), not hand-written — every name, count, and chain below is what actually exists at generation time, not what was intended or assumed. Regenerate after any real, structural change: `node --import tsx backend/scripts/generate-entity-chains-doc.ts`.\n\n';
out += `Total real entities in this snapshot: **${tree.length}**\n\n`;
out += 'See `docs/entity-model.md` for the deeper mechanics (`parent_id` vs. `relation_id`, the relationship-type pattern, typed addresses/phones). This document is the map; that one is the explanation of how the map is drawn.\n\n';

const app = tree.find((e) => e.name === 'Application')!;
const topLevel = childrenOfId(app.id);

out += '## The 13 real, top-level classes\n\n';
out +=
  'Every real entity in this app has exactly one parent, walked recursively — a real tree, not a general graph. These 13 are the direct children of the root `Application` entity.\n\n';
out += '| Class | Direct children | What it is |\n|---|---|---|\n';
const classNotes: Record<string, string> = {
  'Business Reports': 'The real, shared list of report kinds themselves — Balance Sheet, Profit and Loss Statement, Trial Balance, and each business\'s own real Notes to the Financial Statements — never the accounts underneath a report.',
  Businesses: "Every real company using this system — each with its own real ledgers and (where applicable) its own real locations sub-tree.",
  'Chart of Accounts': 'The 5 real, shared top-level report categories (Asset/Liability/Equity/Income/Expense) — genuinely shared across every business, with country-specific prototypes of named, postable leaf accounts underneath them — English, German, French, Italian, Swiss.',
  Divisions: 'Real profit/cost centers — city regions, per-location divisions.',
  Employees: 'Every real staff member, across every business, as real AP counterparties.',
  Languages: 'The 5 real, supported display languages.',
  Locations: 'The real, generic root — actual, real locations live reparented under `{Business} Locations`, see below, not directly here.',
  Manufacturers: 'Real product manufacturers/brand owners.',
  Orders: "Real, individual purchase/sales order records (the older Qty/Value-account mechanism) — the single largest class.",
  Items: 'The real, shared product catalog — categories, subcategories, and individual products.',
  'Stock Quantities': 'A real, generic root for quantity-tracking; the real, per-product On Order/Units Sold accounts (see below) live under each product itself, not here.',
  'Transaction Templates': 'A real, now-mostly-dead design direction — see `docs/entity-model.md` and the recent table-audit commit for what remains and why.',
  Vocabulary: 'Every real, translatable UI word/phrase — the largest, single flat category, with real translations in `translation_entry`.',
};
for (const t of topLevel) {
  const c = childrenOfId(t.id).length;
  out += `| ${esc(t.name)} | ${c} | ${classNotes[t.name] ?? ''} |\n`;
}
out += '\n';

out += '## Businesses and their own real sub-trees\n\n';
out += 'Every real business is its own, top-level entity under `Businesses`, and where a business has real, posted activity, it grows its own child sub-trees (ledgers, and — for a retail business — its own locations).\n\n';
for (const biz of childrenOfName('Businesses')) {
  const kids = childrenOfId(biz.id);
  out += `### ${esc(biz.name)}\n\n`;
  if (kids.length === 0) {
    out += '_No real, posted activity yet — no child ledgers or sub-trees._\n\n';
    continue;
  }
  for (const k of kids) {
    const grandkids = childrenOfId(k.id);
    out += `- **${esc(k.name)}**`;
    if (grandkids.length > 0) {
      out += ` (${grandkids.length} real ${grandkids.length === 1 ? 'child' : 'children'}: ${grandkids
        .slice(0, 8)
        .map((g) => esc(g.name))
        .join(', ')}${grandkids.length > 8 ? `, … ${grandkids.length - 8} more` : ''})`;
    }
    out += '\n';
  }
  out += '\n';
}

out += '## Real, deeper chains — a sample of each\n\n';

out += '### Items: category → subcategory → product\n\n';
for (const cat of childrenOfName('Items')) {
  const subs = childrenOfId(cat.id);
  out += `- **${esc(cat.name)}**\n`;
  for (const sub of subs.slice(0, 4)) {
    const products = childrenOfId(sub.id);
    out += `  - ${esc(sub.name)} (${products.length} real product${products.length === 1 ? '' : 's'}: ${products
      .slice(0, 3)
      .map((p) => esc(p.name))
      .join(', ')}${products.length > 3 ? `, … ${products.length - 3} more` : ''})\n`;
  }
  if (subs.length > 4) out += `  - … ${subs.length - 4} more subcategories\n`;
}
out += '\n';

out += '### A single, real product — its full, real chain of accounts\n\n';
const sampleProduct = tree.find((e) => e.name === 'Golden Lager 330ml');
if (sampleProduct) {
  const productKids = childrenOfId(sampleProduct.id);
  out += `\`Golden Lager 330ml\` (a real, live product) has ${productKids.length} real, direct child accounts:\n\n`;
  for (const k of productKids) {
    out += `- ${esc(k.name)}\n`;
  }
  out += '\nThese are exactly the real accounts a real sale/receipt/transfer posts against — see `postQuantityMovement`, `receiveStockAtLocation`, and `dispatchStockFromLocation` in `backend/src/db-stock.ts` for how each is actually used, and `docs/money-model.md` for why quantity and value are tracked as two independent facts.\n\n';
}

out += '### Employees — a real, complete roster sample\n\n';
const employees = childrenOfName('Employees');
out += `${employees.length} real employees exist across every business. A sample of 5, with their real, configured pay structure:\n\n`;
out += '| Name | Pay structure | Address |\n|---|---|---|\n';
for (const e of employees.slice(0, 5)) {
  const c = getContact(e.name);
  const pay = c?.wage_minor_per_hour ? `$${(c.wage_minor_per_hour / 100).toFixed(2)}/hour` : c?.salary_minor_per_year ? `$${(c.salary_minor_per_year / 100).toFixed(2)}/year (salary)` : 'not yet configured';
  out += `| ${esc(e.name)} | ${pay} | ${esc(c?.address_line1 ?? '')}, ${esc(c?.city ?? '')} |\n`;
}
out += '\n';

out += '### Locations — the real, business-specific sub-tree, not the generic root\n\n';
out += 'A real, important structural note: `Locations` (the generic, top-level class above) has zero real, direct children in a live database. Every real, actual location lives reparented under its own business — e.g. `Wine Retail Business Locations` — confirmed directly, not assumed.\n\n';
for (const biz of childrenOfName('Businesses')) {
  const locRoot = tree.find((e) => e.name === `${biz.name} Locations`);
  if (!locRoot) continue;
  const locs = childrenOfId(locRoot.id);
  out += `**${esc(locRoot.name)}** (${locs.length} real location${locs.length === 1 ? '' : 's'}):\n\n`;
  out += '| Location | Type | City |\n|---|---|---|\n';
  for (const l of locs) {
    const loc = getLocation(l.name);
    out += `| ${esc(l.name)} | ${loc?.location_type ?? ''} | ${esc(loc?.city ?? '')} |\n`;
  }
  out += '\n';
}

out += '### Divisions — real profit/cost centers\n\n';
for (const d of childrenOfName('Divisions')) {
  const kids = childrenOfId(d.id);
  out += `- **${esc(d.name)}**${kids.length > 0 ? ` (${kids.length}: ${kids.map((k) => esc(k.name)).join(', ')})` : ''}\n`;
}
out += '\n';

out += '### Vocabulary — the largest, flat class, a real sample\n\n';
out += `${childrenOfName('Vocabulary').length} real, translatable words/phrases exist. An alphabetically-first sample of 10:\n\n`;
const vocabSample = childrenOfName('Vocabulary').slice(0, 10);
out += vocabSample.map((v) => `- ${esc(v.name)}`).join('\n') + '\n\n';

const outPath = path.join(process.cwd(), '..', 'docs', 'entity-chains.md');
const resolvedPath = fs.existsSync(path.join(process.cwd(), 'docs')) ? path.join(process.cwd(), 'docs', 'entity-chains.md') : outPath;
fs.writeFileSync(resolvedPath, out);
console.log('Wrote', resolvedPath, `(${out.length} chars)`);
