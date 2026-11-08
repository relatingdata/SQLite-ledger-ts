// The Manufacturing tutorial's own "full" tier (Stage 6 of the three-
// tutorial-chapters plan — docs/user-manual-ch4-manufacturing-tutorial.md).
// Per the user's own "lighter now" answer (a bespoke, Retail-style
// golden-figure volume simulation is explicitly deferred, future work —
// see the plan's "Open, deliberately deferred" section), this is a real,
// looped simulation — 3 repeated purchase/assemble/sell cycles against
// one fresh db — verified entirely via computed invariants, never a
// hardcoded dollar figure. Run: node --import tsx
// backend/scripts/simulate-manufacturing-cycles.ts (or via `make
// test-e2e-manufacturing-full`, which also does the real reset-db first).
//
// Builds its own real business ("Tutorial Window & Door Manufacturing —
// Full Cycle") from scratch, genuinely separate from the narrative
// tutorial fixture (manufacturing-tutorial-steps.csv) — the two never
// share a reference or an item name, so either can run against the same
// db without colliding.
import {
  asUserId,
  asBusinessName,
  asLedgerName,
  asItemName,
  asLocationName,
  createBusiness,
  createAndConfigureLocation,
  createProvider,
  createCustomer,
  createItem,
  ensureItemInventoryAccount,
  stageBomComponent,
  postBomComponents,
  getBomComponents,
  stageLine,
  postJournalEntry,
  receiveItems,
  dispatchItems,
  getItemLocation,
  getInventoryListingByLocation,
  getTrialBalance,
  getProfitAndLoss,
} from '../src/db.js';

const userId = asUserId(1);
const BUSINESS = asBusinessName('Tutorial Window & Door Manufacturing — Full Cycle');
const LEDGER = asLedgerName('Actual');
const RAW_STORE = asLocationName('Raw Materials Store');
const FG_STORE = asLocationName('Finished Goods Store');
const CYCLES = 3;

// Real, fixed per-unit costs (minor units) — the same figures the
// narrative tutorial fixture uses, kept here as the one, real source of
// truth this script's own invariant checks are computed against.
const UNIT_COST_MINOR: Record<string, number> = {
  'Aluminum Extrusion': 800,
  'Glass Pane': 2500,
  'Hardware Kit': 1500,
  'Timber Stile': 1200,
  'Timber Rail': 1000,
  'Door Hardware Kit': 4500,
};

// Real BOM, Material-only, per assembly unit — proving the widened
// Stage-1 BOM mechanism round-trips identically on every cycle, not just
// once.
const BOM: Record<string, { component: string; quantity: number }[]> = {
  'Aluminum Window Frame': [
    { component: 'Aluminum Extrusion', quantity: 4 },
    { component: 'Glass Pane', quantity: 1 },
    { component: 'Hardware Kit', quantity: 1 },
  ],
  'Wooden Front Door Frame': [
    { component: 'Timber Stile', quantity: 2 },
    { component: 'Timber Rail', quantity: 3 },
    { component: 'Door Hardware Kit', quantity: 1 },
  ],
  'Wooden Rear Door Frame': [
    { component: 'Timber Stile', quantity: 2 },
    { component: 'Timber Rail', quantity: 3 },
    { component: 'Door Hardware Kit', quantity: 1 },
  ],
  'Wooden Internal Door Frame': [
    { component: 'Timber Stile', quantity: 2 },
    { component: 'Timber Rail', quantity: 2 },
  ],
};

// Per cycle: how many of each assembly are built and sold.
const ASSEMBLE_QTY: Record<string, number> = {
  'Aluminum Window Frame': 2,
  'Wooden Front Door Frame': 1,
  'Wooden Rear Door Frame': 1,
  'Wooden Internal Door Frame': 1,
};

// Per cycle: how many of each raw material are bought (a real buffer
// above what that one cycle actually consumes, exactly as the narrative
// tutorial does — proving leftover buffer stock accumulates correctly,
// cycle over cycle, rather than silently being dropped or double-counted).
const PURCHASE_QTY: Record<string, number> = {
  'Aluminum Extrusion': 10,
  'Glass Pane': 4,
  'Hardware Kit': 4,
  'Timber Stile': 8,
  'Timber Rail': 10,
  'Door Hardware Kit': 4,
};

const SALE_PRICE_MINOR: Record<string, number> = {
  'Aluminum Window Frame': 15000,
  'Wooden Front Door Frame': 18000,
  'Wooden Rear Door Frame': 18000,
  'Wooden Internal Door Frame': 9000,
};

function assemblyCostMinor(assembly: string): number {
  return BOM[assembly].reduce((sum, line) => sum + line.quantity * UNIT_COST_MINOR[line.component], 0);
}

function postBalanced(reference: string, lines: { account: string; amount_minor: number }[]): void {
  for (const line of lines) {
    stageLine({ reference, business: BUSINESS, ledger: LEDGER, account: line.account as any, amount_minor: line.amount_minor });
  }
  postJournalEntry(reference, BUSINESS, LEDGER, userId);
}

console.log(`Setting up ${BUSINESS}...`);
createBusiness(BUSINESS, '2026-27', userId, 'English CoA');
createAndConfigureLocation(BUSINESS, 'Raw Materials Store', { city: 'Adelaide', location_type: 'Warehouse', is_billing_address: false, bottle_capacity: null, carton_capacity: null, timezone: 'Australia/Adelaide' } as any, userId);
createAndConfigureLocation(BUSINESS, 'Finished Goods Store', { city: 'Adelaide', location_type: 'Warehouse', is_billing_address: false, bottle_capacity: null, carton_capacity: null, timezone: 'Australia/Adelaide' } as any, userId);
createProvider('Statewide Timber & Glass Supplies — Full Cycle', userId);
createCustomer('BuildRight Constructions — Full Cycle', userId);
// Every item is immediately provisioned with a real, properly
// classified Inventory (Asset) account - db.ts's own
// ensureItemInventoryAccount - before any real $ posting ever names it,
// so every later stageLine call against it resolves to a real,
// Balance-Sheet-classified account, not a bare, unclassified item node
// (a real, confirmed gap found live while building the narrative
// tutorial fixture: posting to a bare item name before this call still
// succeeds and still balances the trial balance, but the posted value
// never reaches the Balance Sheet's own Asset walk).
for (const item of Object.keys(UNIT_COST_MINOR)) {
  createItem(item, 'Items', userId, BUSINESS);
  ensureItemInventoryAccount(asItemName(item), userId, undefined, BUSINESS);
}
for (const assembly of Object.keys(BOM)) {
  createItem(assembly, 'Items', userId, BUSINESS);
  ensureItemInventoryAccount(asItemName(assembly), userId, undefined, BUSINESS);
}

// Opening capital — real cash before any real trading.
postBalanced('JE-OWNER-CAPITAL', [
  { account: 'Cash and Bank', amount_minor: 5000000 },
  { account: "Owner's Equity", amount_minor: -5000000 },
]);

for (const assembly of Object.keys(BOM)) {
  for (const line of BOM[assembly]) {
    stageBomComponent({ assemblyItem: assembly, business: BUSINESS, componentItem: line.component, quantity: line.quantity, unit: 'ea' });
  }
  postBomComponents(assembly, BUSINESS, userId);
  const recorded = getBomComponents(assembly);
  if (recorded.length !== BOM[assembly].length) {
    throw new Error(`BOM round-trip failed for "${assembly}": expected ${BOM[assembly].length} lines, got ${recorded.length}.`);
  }
}
console.log('BOM recorded and verified for every assembly.');

for (let cycle = 1; cycle <= CYCLES; cycle++) {
  console.log(`--- Cycle ${cycle} of ${CYCLES} ---`);
  const suffix = `-C${cycle}`;

  // Purchase + receive raw materials (real cash, real quantity).
  for (const [item, qty] of Object.entries(PURCHASE_QTY)) {
    const valueMinor = qty * UNIT_COST_MINOR[item];
    postBalanced(`JE-BUY-${item.replace(/\s+/g, '')}${suffix}`, [
      { account: item, amount_minor: valueMinor },
      { account: 'Cash and Bank', amount_minor: -valueMinor },
    ]);
    receiveItems(BUSINESS, LEDGER, `RECV-${item.replace(/\s+/g, '')}${suffix}`, asItemName(item), RAW_STORE, qty, userId);
  }

  // Assemble — a real stock dispatch (raw materials out) + a real stock
  // receive (finished assemblies in), using the EXISTING dispatch/
  // receive functions, exactly per the plan's own instruction. One real
  // reclassification journal entry per assembly moves its own, real,
  // BOM-computed cost from the consumed raw materials' own accounts
  // into the assembly's own account.
  const consumedThisCycle: Record<string, number> = {};
  for (const [assembly, qty] of Object.entries(ASSEMBLE_QTY)) {
    const reclassLines: { account: string; amount_minor: number }[] = [{ account: assembly, amount_minor: assemblyCostMinor(assembly) * qty }];
    for (const line of BOM[assembly]) {
      const consumedQty = line.quantity * qty;
      consumedThisCycle[line.component] = (consumedThisCycle[line.component] ?? 0) + consumedQty;
      dispatchItems(BUSINESS, LEDGER, `ASM-${line.component.replace(/\s+/g, '')}-${assembly.replace(/\s+/g, '')}${suffix}`, asItemName(line.component), RAW_STORE, consumedQty, userId);
      reclassLines.push({ account: line.component, amount_minor: -(line.quantity * qty * UNIT_COST_MINOR[line.component]) });
    }
    receiveItems(BUSINESS, LEDGER, `ASM-RECV-${assembly.replace(/\s+/g, '')}${suffix}`, asItemName(assembly), FG_STORE, qty, userId);
    postBalanced(`JE-RECLASS-${assembly.replace(/\s+/g, '')}${suffix}`, reclassLines);
  }

  // Sell every finished assembly — real revenue, real BOM-costed COGS,
  // a real stock dispatch out of Finished Goods Store.
  for (const [assembly, qty] of Object.entries(ASSEMBLE_QTY)) {
    const saleAmount = qty * SALE_PRICE_MINOR[assembly];
    const cogsAmount = assemblyCostMinor(assembly) * qty;
    postBalanced(`JE-SALE-${assembly.replace(/\s+/g, '')}${suffix}`, [
      { account: 'Cash and Bank', amount_minor: saleAmount },
      { account: 'Sales Revenue', amount_minor: -saleAmount },
    ]);
    postBalanced(`JE-COGS-${assembly.replace(/\s+/g, '')}${suffix}`, [
      { account: 'Cost of Goods Sold', amount_minor: cogsAmount },
      { account: assembly, amount_minor: -cogsAmount },
    ]);
    dispatchItems(BUSINESS, LEDGER, `SALE-${assembly.replace(/\s+/g, '')}${suffix}`, asItemName(assembly), FG_STORE, qty, userId);
  }
}

console.log('--- Verifying computed invariants (never a hardcoded golden figure) ---');
let failures = 0;

// 1. Trial balance balances.
const tb = getTrialBalance(BUSINESS, LEDGER);
if (tb.total_debit_minor !== tb.total_credit_minor || tb.total_debit_minor <= 0) {
  failures++;
  console.error(`FAIL: trial balance does not balance (debit=${tb.total_debit_minor}, credit=${tb.total_credit_minor}).`);
} else {
  console.log(`OK: trial balance balances at ${tb.total_debit_minor} minor units.`);
}

// 2. No negative on-hand quantity anywhere.
const groups = getInventoryListingByLocation(BUSINESS);
for (const g of groups) {
  for (const r of g.rows) {
    if (r.quantity_on_hand < 0) {
      failures++;
      console.error(`FAIL: negative on-hand quantity for "${r.item}" at "${r.location}": ${r.quantity_on_hand}.`);
    }
  }
}
console.log('OK: no negative on-hand quantity anywhere.');

// 3. Raw-material leftover buffer stock accumulates correctly, cycle
// over cycle — real, computed expected values, not approximated.
for (const item of Object.keys(UNIT_COST_MINOR)) {
  let consumedPerCycle = 0;
  for (const assembly of Object.keys(BOM)) {
    const line = BOM[assembly].find((l) => l.component === item);
    if (line) consumedPerCycle += line.quantity * ASSEMBLE_QTY[assembly];
  }
  const expectedOnHand = (PURCHASE_QTY[item] - consumedPerCycle) * CYCLES;
  const actualOnHand = getItemLocation(asItemName(item), RAW_STORE).quantity_on_hand;
  if (actualOnHand !== expectedOnHand) {
    failures++;
    console.error(`FAIL: "${item}" leftover at Raw Materials Store is ${actualOnHand}, expected ${expectedOnHand}.`);
  }
}
console.log('OK: raw-material leftover buffer stock matches the real, computed BOM-consumption ratio across all cycles.');

// 4. Every assembly produced this run was also sold this run — Finished
// Goods Store holds none of it afterward.
for (const assembly of Object.keys(ASSEMBLE_QTY)) {
  const onHand = getItemLocation(asItemName(assembly), FG_STORE).quantity_on_hand;
  if (onHand !== 0) {
    failures++;
    console.error(`FAIL: "${assembly}" has ${onHand} unsold units left at Finished Goods Store.`);
  }
}
console.log('OK: every assembly produced was also sold — nothing stuck in Finished Goods Store.');

// 5. Net income is positive — the real, structural check, never a
// hardcoded dollar figure.
const pl = getProfitAndLoss(BUSINESS, LEDGER);
if (pl.net_income_minor <= 0) {
  failures++;
  console.error(`FAIL: net income is not positive (${pl.net_income_minor}).`);
} else {
  console.log(`OK: net income is positive (${pl.net_income_minor} minor units over ${CYCLES} cycles).`);
}

if (failures > 0) {
  console.error(`\n${failures} invariant check(s) failed.`);
  process.exit(1);
}
console.log(`\nAll computed invariants hold across ${CYCLES} real purchase/assemble/sell cycles.`);
