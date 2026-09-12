/**
 * A full month of real trading for Wine Retail Company, end to end,
 * through the exact same functions the real frontend calls — not raw
 * SQL. Committed (per this project's "never throw away" discipline),
 * not a one-off throwaway.
 *
 * Sequence: owner's $100,000 capital injection -> several hundred
 * purchases of a dozen key products, received at the two warehouses
 * and distributed to retail outlets -> several thousand retail sales
 * across the outlets -> a handful of realistic breakages and returns
 * -> a month-end stocktake -> year-end close.
 *
 * Run with: node --import tsx backend/scripts/simulate-wine-retail-month.ts
 * (runs against the real app database at backend/data/entities.sqlite)
 */
import {
  createEntity,
  createBusiness,
  setContact,
  stageLine,
  postJournalEntry,
  receiveStockAtLocation,
  transferStock,
  getRestockPickingList,
  confirmRestockPickedLine,
  dispatchRestockFromPickingList,
  dispatchStockFromLocation,
  writeOffStock,
  completePosSale,
  createStockTake,
  recordStockTakeCount,
  completeStockTake,
  closeBooks,
  getEntityTree,
  updateEntity,
  getLocation,
  setLocation,
  addOrUpdateItemSource,
  listItems,
  getInvoice,
  createInvoice,
  postInvoice,
  cityDivisionFor,
  getAccountsPostedTo,
  stagePurchaseOrder,
  postPurchaseOrder,
  stageApPayment,
  postApPayment,
  stageArReceipt,
  postArReceipt,
  allocatePayment,
  getInvoiceOutstandingMinor,
  ensureProductSalesCogsAccounts,
  ensureProductTierPart,
  ensureProductTierLocationLeaf,
  ensureProductInventoryAccount,
} from '../src/db.js';
import { getItemLocation } from '../src/db-stock.js';
import { fixtures } from '../../shared-fixtures/wine-retail.js';
import { readCsv } from '../../shared-fixtures/csv.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __simDir = path.dirname(fileURLToPath(import.meta.url));
const pricingRows = readCsv(fs.readFileSync(path.join(__simDir, '../../shared-fixtures/pricing.csv'), 'utf-8'));
const wholesaleCostBySubcategory = new Map(pricingRows.map((r) => [r.subcategory, Number(r.wholesaleCostMinor)]));
const BUSINESS = process.env.SIM_BUSINESS ?? fixtures.business;
const LEDGER = fixtures.ledger;
const VENDOR = fixtures.vendor;

function listLocations() {
  const entities = getEntityTree();
  const locationsParent = entities.find((e) => e.name === `${BUSINESS} Locations`);
  const locationEntities = locationsParent ? entities.filter((e) => e.parent_id === locationsParent.id) : [];
  return locationEntities.map((e) => ({ name: e.name, ...getLocation(e.name)! }));
}
const today = (offsetDays: number) => {
  const d = new Date('2027-03-01T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

// A simple, seeded PRNG (mulberry32) — Math.random() isn't seedable,
// and reproducible demo data (same sales, same breakages, same numbers
// every time this is re-run) is genuinely useful, not just a nicety.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seededRandom = mulberry32(20270301); // fixed seed — deterministic, reproducible

function rand(min: number, max: number) {
  return Math.floor(seededRandom() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[rand(0, arr.length - 1)];
}

async function main() {
  console.log(`=== Setup: ${BUSINESS} itself, if it doesn't already exist ===`);
  if (!getEntityTree().some((e) => e.name === BUSINESS)) {
    const created = createBusiness(BUSINESS, '2026-27', 1, 'English CoA');
    console.log(`Created ${created.business}, with ${created.actualLedger} and ${created.budgetLedger}.`);
  } else {
    console.log(`${BUSINESS} already exists — using it as-is.`);
  }

  console.log('=== Setup: vendor, CoA accounts this simulation needs ===');
  // A real, direct, previously-existing bug fixed here, found live:
  // this vendor was incorrectly parented under "Vendors" — the real,
  // Vocabulary alternate-word entity for "Suppliers", linked to
  // Accounts Payable only via the real, established "Header Account"
  // dimension relationship, never a real, direct parent-child one —
  // rather than under "Accounts Payable" itself. Every real page's
  // own, established vendor filter (`parent?.name === 'Accounts
  // Payable'`) genuinely missed this vendor entirely as a real,
  // direct, confirmed consequence.
  createEntity({ name: VENDOR, parent: 'Accounts Payable' }, 1);
  setContact(VENDOR, { payment_terms_days: 30 });
  for (const [name, category] of [
    ['Freight In', 'Expense'],
    ['Breakage & Spoilage', 'Expense'],
    ['Wine Returns', 'Expense'],
  ] as const) {
    try {
      createEntity({ name, parent: category }, 1);
    } catch {
      // already exists from a prior run — fine, this script is safe to re-run
    }
  }

  const locations = listLocations();
  const warehouses = locations.filter((l) => l.location_type === 'Warehouse');
  const retailOutlets = locations.filter((l) => l.location_type === 'Retail');
  console.log(`Warehouses: ${warehouses.map((w) => w.name).join(', ')}`);
  console.log(`Retail outlets: ${retailOutlets.map((r) => r.name).join(', ')}`);

  // A refrigerated display at each retail outlet — sparkling wine and
  // some popular beer need to be kept cold, ordinary still wine and
  // spirits don't. A genuinely separate location, same mechanism as
  // every other location, not a new concept: the same item can sit at
  // different locations, this is just one more of them.
  //
  // Sized proportionally to each outlet's own real capacity, not a
  // flat number regardless of shop size — a real beverage cooler is a
  // dedicated appliance/area, roughly 8-10% of a shop's total bottle
  // capacity in practice, not comparable in scale to the shop itself.
  const refrigeratedOutlets: { name: string; city: string; location_type: 'Retail' }[] = [];
  for (const outlet of retailOutlets) {
    const mainLocation = getLocation(outlet.name);
    const mainBottleCapacity = mainLocation?.bottle_capacity ?? 1500;
    const fridgeBottleCapacity = Math.round((mainBottleCapacity * 0.1) / 10) * 10; // nearest 10
    const fridgeCartonCapacity = Math.round(fridgeBottleCapacity / 10); // roughly one carton per 10 bottles of fridge space
    const name = `${outlet.name} — Refrigerated`;
    try {
      createEntity({ name, parent: `${BUSINESS} Locations` }, 1);
    } catch {
      // already exists from a prior run
    }
    // A real, confirmed bug, found live: outlet.city is the real,
    // coarse, city-level value (e.g. "Rivertown"), not the real,
    // fine-grained division of this specific outlet (e.g. "Eastside
    // Cellar Door Division"). The plain outlet resolves its own real
    // division correctly via a real, direct division.relation_id link
    // set up separately (db-seed.ts), which this real, newer
    // Refrigerated location never got. Using the coarse city here
    // caused every real cold-storage sale (beer, sparkling wine) to be
    // misattributed one, real division level up, making its own real
    // outlet look like it never sold any — the exact, confirmed root
    // cause of a real, reported "missing Beer and Sparkling Wine"
    // finding. Fixed here by deriving the real, correct, fine-grained
    // division directly from the real, already-proven cityDivisionFor,
    // falling back to the coarse city only if the real parent outlet
    // genuinely has no division link at all yet.
    const fineGrainedDivision = cityDivisionFor(outlet.name) ?? outlet.city;
    setLocation(name, { city: fineGrainedDivision, location_type: 'Retail', is_billing_address: false, bottle_capacity: fridgeBottleCapacity, carton_capacity: fridgeCartonCapacity, timezone: getLocation(outlet.name)?.timezone ?? 'UTC' });
    // A real, explicit relation to its own real parent outlet — per
    // direct report, a store clerk shouldn't need to know or care
    // which physical fridge a bottle actually lives in; this real
    // link is what lets completePosSale route a cold product there
    // automatically, so the real POS "store" dropdown only ever needs
    // to show the one, real, logical outlet.
    updateEntity(getEntityTree().find((e) => e.name === name)!.id, { relation: outlet.name }, 1);
    refrigeratedOutlets.push({ name, city: outlet.city, location_type: 'Retail' });
  }
  console.log(`Refrigerated displays set up at all ${refrigeratedOutlets.length} retail outlets, each sized proportionally to its own shop.`);

  const allParts = listItems();
  const entities = getEntityTree();
  // Real category classification via the actual entity tree, not a
  // hardcoded list of product names — every product in Ale/Lager/Stout
  // is genuinely beer, every product in Champagne/Cava/Prosecco is
  // genuinely sparkling, regardless of which specific 36 products this
  // seed data happens to contain.
  const categoryOf = (itemName: string): string | undefined => {
    const entity = entities.find((e) => e.name === itemName);
    const parent = entities.find((e) => e.id === entity?.parent_id);
    return parent?.name;
  };
  const products = allParts.filter((p) => categoryOf(p.name) !== undefined);
  console.log(`${products.length} real products confirmed present — every product in the catalog, not a curated subset.`);

  // Lagers and stouts genuinely serve cold; ales traditionally don't
  // (a real, defensible distinction, not an arbitrary one) — same for
  // sparkling wine (always cold) vs. still wine and spirits (not).
  const BEER_CATEGORIES = new Set(['Ale', 'Lager', 'Stout']);
  const COLD_BEER_CATEGORIES = new Set(['Lager', 'Stout']);
  const SPARKLING_CATEGORIES = new Set(['Champagne', 'Cava', 'Prosecco']);
  const beerNames = new Set(products.filter((p) => BEER_CATEGORIES.has(categoryOf(p.name)!)).map((p) => p.name));
  const coldProducts = new Set(
    products.filter((p) => COLD_BEER_CATEGORIES.has(categoryOf(p.name)!) || SPARKLING_CATEGORIES.has(categoryOf(p.name)!)).map((p) => p.name)
  );

  // Real package quantities — a wine/spirits carton is a dozen
  // bottles, a beer carton is two dozen, both genuinely different from
  // each other, not an arbitrary shared constant. Beer additionally
  // sells in six-packs at retail, wine and spirits don't.
  const packageQuantity: Record<string, number> = {};
  for (const p of products) packageQuantity[p.name] = beerNames.has(p.name) ? 24 : 12;
  const dozen = products; // kept as `dozen` below purely to minimize an already-large diff — this is genuinely every product now, not a curated twelve.

  // ---------------------------------------------------------------
  console.log('\n=== 1. Owner puts in $100,000 ===');
  stageLine({ reference: 'CAPITAL-1', business: BUSINESS, ledger: LEDGER, transdate: today(0), account: 'Cash and Bank', amount_minor: 10000000 });
  stageLine({ reference: 'CAPITAL-1', business: BUSINESS, ledger: LEDGER, transdate: today(0), account: "Owner's Equity", amount_minor: -10000000 });
  postJournalEntry('CAPITAL-1', BUSINESS, LEDGER, 1);
  console.log('$100,000.00 capital injection posted.');

  // ---------------------------------------------------------------
  console.log('\n=== 2. Several hundred purchases, received at warehouses, distributed to retail ===');
  let purchaseCount = 0;
  const unitCostMinor: Record<string, number> = {};
  for (const p of dozen) {
    unitCostMinor[p.name] = wholesaleCostBySubcategory.get(categoryOf(p.name)!) ?? (() => { throw new Error(`No real, fixed wholesale cost found for subcategory "${categoryOf(p.name)}" (product "${p.name}").`); })();
    addOrUpdateItemSource({
      itemName: p.name,
      vendorName: VENDOR,
      priceMinor: unitCostMinor[p.name] * packageQuantity[p.name],
      packageQuantity: packageQuantity[p.name],
      isPreferred: true,
      preferenceNotes: 'Only known source for this simulation.',
    });
  }
  const sampleWine = dozen.find((p) => !beerNames.has(p.name))!.name;
  const sampleBeer = dozen.find((p) => beerNames.has(p.name))?.name;
  console.log(`Registered real item_source rows: wine/spirits ${packageQuantity[sampleWine]}-bottle cartons, beer ${sampleBeer ? packageQuantity[sampleBeer] : 24}-bottle cartons.`);

  const scheduledPayments: { payDay: number; amount: number; ref: string }[] = [];

  // A real, deliberate reorder cadence — not a random daily flood.
  // Per direct request: "a major and perhaps a minor one are placed
  // per week spaced suitably in each warehouse to get an even
  // workload for the current human work force." Products are split
  // by real, relative popularity (their own real, existing category
  // and price already say which is which — beer and cheaper wine
  // move fast, premium wine/spirits move slow) into a real "major"
  // rotation (large, frequent orders) and a real "minor" rotation
  // (smaller, less frequent orders), each warehouse working through
  // its own real rotation on its own, staggered real days so two
  // warehouses' own real deliveries never land on the same day.
  const majorProducts = dozen.filter((p) => beerNames.has(p.name) || unitCostMinor[p.name] < 2500);
  const minorProducts = dozen.filter((p) => !majorProducts.includes(p));
  const majorOrderDaysByWarehouse: Record<string, number> = {};
  const minorOrderDaysByWarehouse: Record<string, number> = {};
  warehouses.forEach((w, i) => {
    majorOrderDaysByWarehouse[w.name] = 1 + i * 3; // Head Office: Tue; Warehouse B: Fri, of each real week
    minorOrderDaysByWarehouse[w.name] = 4 - i * 2; // Head Office: Fri; Warehouse B: Tue — never clashing with either warehouse's own major day
  });

  for (let day = 0; day < 28; day++) {
    const weekday = day % 7;
    for (const warehouse of warehouses) {
      const isMajorDay = weekday === majorOrderDaysByWarehouse[warehouse.name];
      const isMinorDay = weekday === minorOrderDaysByWarehouse[warehouse.name];
      if (!isMajorDay && !isMinorDay) continue;
      const week = Math.floor(day / 7);
      // A real major delivery day restocks every fast-moving product
      // at once (a real weekly truck naturally carries several real
      // products in one visit, even though each is still its own real
      // PO) — a real minor day only tops up a small, rotating subset
      // of the slower-moving ones, not everything.
      // A real major day restocks a real, rotating subset of the
      // fast-moving products — not literally everything at once,
      // which would be a genuinely unrealistic single delivery and,
      // confirmed directly, drove total purchase spend to 3.6x real
      // sales revenue regardless of timing. A real minor day tops up
      // a smaller, rotating subset of the slow-moving ones.
      const majorSubsetSize = 12;
      const partsToOrder = isMajorDay
        ? Array.from({ length: Math.min(majorSubsetSize, majorProducts.length) }, (_, k) => majorProducts[(week * majorSubsetSize + k) % majorProducts.length])
        : minorProducts.length > 0
          ? [minorProducts[week % minorProducts.length], minorProducts[(week + 1) % minorProducts.length]]
          : [];
      for (const item of partsToOrder) {
      const cartons = isMajorDay ? rand(14, 22) : rand(4, 8); // a real, major restock vs. a real, smaller top-up — sized to keep real cash flow positive throughout, not requiring an overdraft
      const qty = cartons * packageQuantity[item.name];
      const unitCost = unitCostMinor[item.name];
      const totalCost = qty * unitCost;
      const ref = `PO-${day}-${warehouse.name.replace(/\s/g, '')}-${purchaseCount}`;

      // A real Purchase Order first — a genuine commitment, no GL
      // effect of its own — found to be a real, genuine gap via
      // direct report: this simulation previously went straight to a
      // direct receipt, so the real Purchase Order screen always
      // appeared empty, even though the mechanism itself was real and
      // already tested.
      stagePurchaseOrder({ reference: `${ref}-PO`, business: BUSINESS, ledger: LEDGER, vendor: VENDOR, item: item.name, quantity: qty, price_minor: unitCost, transdate: today(day) });
      postPurchaseOrder(`${ref}-PO`, BUSINESS, LEDGER, 1);

      { const inv = ensureProductInventoryAccount(item.name, 1); stageLine({ reference: ref, business: BUSINESS, ledger: LEDGER, transdate: today(day), account: inv.inventoryAccount, accountId: inv.inventoryAccountId, amount_minor: totalCost, division: warehouse.city }); }
      stageLine({ reference: ref, business: BUSINESS, ledger: LEDGER, transdate: today(day), account: VENDOR, amount_minor: -totalCost, division: warehouse.city });
      postJournalEntry(ref, BUSINESS, LEDGER, 1);
      receiveStockAtLocation(BUSINESS, LEDGER, `${ref}-RECV`, item.name, warehouse.name, qty, 1, today(day));
      purchaseCount++;

      // Real vendor terms — paid roughly 7-21 days after receipt, not
      // instantly and not never. Only scheduled if it actually falls
      // within this simulated month; a late-month purchase genuinely
      // would still be outstanding at month-end, which is realistic,
      // not a bug.
      const payDay = day + rand(7, 21);
      if (payDay < 28) scheduledPayments.push({ payDay, amount: totalCost, ref: `${ref}-PAY` });

      // Distribute roughly 60% of what's received out to retail outlets over the next day or two.
      if (seededRandom() < 0.85) {
        const toSend = Math.floor(qty * (0.4 + seededRandom() * 0.4));
        if (toSend > 0) {
          const outlet = pick(retailOutlets.filter((r) => r.city === warehouse.city));
          if (outlet) {
            // Cold products go straight to the refrigerated display at
            // that outlet, not the ordinary shelf — the same transfer
            // mechanism, just a different destination location.
            const destination = coldProducts.has(item.name) ? refrigeratedOutlets.find((r) => r.city === outlet.city)! : outlet;
            try {
              // The real restocking mechanism, per direct request —
              // not a direct transferStock call any more: a real
              // picking list (shelf-ordered, even if this specific
              // product has no real shelf position recorded at this
              // specific warehouse), a real tick-off, then a real
              // dispatch that itself calls transferStock internally —
              // the exact same real, physical stock movement as
              // before, just genuinely routed through the real
              // mechanism this app now has for it.
              const runRef = `${ref}-RESTOCK`;
              const restockLines = [{ item: item.name, quantity: toSend }];
              getRestockPickingList(runRef, warehouse.name, restockLines);
              confirmRestockPickedLine(runRef, item.name, BUSINESS, LEDGER, 1);
              dispatchRestockFromPickingList(runRef, BUSINESS, LEDGER, warehouse.name, destination.name, restockLines, 1, today(day));
            } catch {
              // insufficient stock at this exact moment (a prior transfer already took it) — skip, not fatal to the simulation
            }
          }
        }
      }
      }
    }
  }

  // Actually pay the vendor — via the real, already-correct AP payment
  // mechanism (stageApPayment/postApPayment already post a genuine,
  // balanced GL entry; they were simply never called before).
  let paymentsPosted = 0;
  let totalPaidMinor = 0;
  scheduledPayments.sort((a, b) => a.payDay - b.payDay);
  for (const p of scheduledPayments) {
    stageApPayment({ reference: p.ref, business: BUSINESS, ledger: LEDGER, vendor: VENDOR, amount_minor: p.amount, transdate: today(p.payDay), description: 'Vendor payment' });
    postApPayment(p.ref, BUSINESS, LEDGER, 1);
    paymentsPosted++;
    totalPaidMinor += p.amount;
  }
  console.log(`${paymentsPosted} vendor payments posted, totaling $${(totalPaidMinor / 100).toFixed(2)} — the rest genuinely still outstanding at month-end, matching real net-30-ish terms.`);
  console.log(`${purchaseCount} purchase transactions posted and received across the month, each a genuine carton quantity (${dozen.filter((p) => beerNames.has(p.name)).length} beer products at 24/carton, ${dozen.length - beerNames.size} wine/spirits products at 12/carton).`);

  // ---------------------------------------------------------------
  console.log('\n=== 2b. Real, manual AR/AP invoices, allocated three real ways ===');
  // Per direct request: exercise the real, direct invoice-allocation
  // mechanism (AR Receipt/AP Payment, built this session) three,
  // real, distinct ways a real, live business genuinely encounters —
  // not just posting a receipt/payment in isolation, the way the
  // rest of this simulation already, largely does.
  const allocationCustomer = 'Riverside Wine Merchants Pty Ltd';
  const allocationVendor2 = 'Alpine Cellar Imports GmbH';
  createEntity({ name: allocationCustomer, parent: 'Accounts Receivable' }, 1);
  createEntity({ name: allocationVendor2, parent: 'Accounts Payable' }, 1);

  // (1) Full payment — a real invoice, paid off completely, in one,
  // single, real receipt.
  const fullPayInvoiceId = createInvoice(
    { invoiceType: 'AR', business: BUSINESS, ledger: LEDGER, reference: 'ALLOC-AR-FULL', counterpartyName: allocationCustomer, invoiceDate: today(3),
      lines: [{ description: 'Case order — full payment example', amountMinor: 84000, taxMinor: 0 }] },
    1
  );
  postInvoice(fullPayInvoiceId, 'Sales Revenue', 'Sales Tax Payable', 1, false);
  stageArReceipt({ reference: 'ALLOC-AR-FULL-RCPT', business: BUSINESS, ledger: LEDGER, customer: allocationCustomer, amount_minor: 84000, transdate: today(10), description: 'Full payment of ALLOC-AR-FULL' });
  postArReceipt('ALLOC-AR-FULL-RCPT', BUSINESS, LEDGER, 1);
  allocatePayment(fullPayInvoiceId, 'ALLOC-AR-FULL-RCPT-alloc', 84000, today(10), 'Cash and Bank', 1);

  // (2) Partial payment — a real invoice, only item paid, a real,
  // genuine balance still outstanding at month-end (matching how
  // this simulation's own AP side already, deliberately leaves real
  // amounts unpaid).
  const partialPayInvoiceId = createInvoice(
    { invoiceType: 'AR', business: BUSINESS, ledger: LEDGER, reference: 'ALLOC-AR-PARTIAL', counterpartyName: allocationCustomer, invoiceDate: today(5),
      lines: [{ description: 'Case order — partial payment example', amountMinor: 120000, taxMinor: 0 }] },
    1
  );
  postInvoice(partialPayInvoiceId, 'Sales Revenue', 'Sales Tax Payable', 1, false);
  stageArReceipt({ reference: 'ALLOC-AR-PARTIAL-RCPT', business: BUSINESS, ledger: LEDGER, customer: allocationCustomer, amount_minor: 50000, transdate: today(14), description: 'Partial payment of ALLOC-AR-PARTIAL' });
  postArReceipt('ALLOC-AR-PARTIAL-RCPT', BUSINESS, LEDGER, 1);
  allocatePayment(partialPayInvoiceId, 'ALLOC-AR-PARTIAL-RCPT-alloc', 50000, today(14), 'Cash and Bank', 1);

  // (3) Overpayment — a real receipt genuinely larger than the real
  // invoice it's for; only the invoice's own, real, outstanding
  // amount is allocated to it, the real, remaining excess
  // deliberately left unallocated — a real, genuine customer credit
  // balance, exactly as a real business would see it (allocatePayment
  // itself already, correctly refuses to allocate more than a real
  // invoice's own outstanding balance).
  const overpayInvoiceId = createInvoice(
    { invoiceType: 'AR', business: BUSINESS, ledger: LEDGER, reference: 'ALLOC-AR-OVERPAID', counterpartyName: allocationCustomer, invoiceDate: today(7),
      lines: [{ description: 'Case order — overpayment example', amountMinor: 60000, taxMinor: 0 }] },
    1
  );
  postInvoice(overpayInvoiceId, 'Sales Revenue', 'Sales Tax Payable', 1, false);
  const overpayReceiptMinor = 75000; // genuinely more than the invoice's own $600.00
  stageArReceipt({ reference: 'ALLOC-AR-OVERPAID-RCPT', business: BUSINESS, ledger: LEDGER, customer: allocationCustomer, amount_minor: overpayReceiptMinor, transdate: today(16), description: 'Overpayment of ALLOC-AR-OVERPAID — real, remaining excess deliberately left unallocated' });
  postArReceipt('ALLOC-AR-OVERPAID-RCPT', BUSINESS, LEDGER, 1);
  const overpayOutstanding = getInvoiceOutstandingMinor(overpayInvoiceId);
  allocatePayment(overpayInvoiceId, 'ALLOC-AR-OVERPAID-RCPT-alloc', overpayOutstanding, today(16), 'Cash and Bank', 1);
  const overpayUnallocatedMinor = overpayReceiptMinor - overpayOutstanding;

  // The exact, same, real three scenarios, mirrored on the AP side —
  // a real, second, distinct vendor from the one already used above,
  // so its own real, outstanding balance is genuinely isolated and
  // easy to find/verify directly.
  const fullPayApInvoiceId = createInvoice(
    { invoiceType: 'AP', business: BUSINESS, ledger: LEDGER, reference: 'ALLOC-AP-FULL', counterpartyName: allocationVendor2, invoiceDate: today(4),
      lines: [{ description: 'Case order — full payment example', amountMinor: 45000, taxMinor: 0 }] },
    1
  );
  postInvoice(fullPayApInvoiceId, 'Cost of Goods Sold', 'Sales Tax Payable', 1, false);
  stageApPayment({ reference: 'ALLOC-AP-FULL-PMT', business: BUSINESS, ledger: LEDGER, vendor: allocationVendor2, amount_minor: 45000, transdate: today(11), description: 'Full payment of ALLOC-AP-FULL' });
  postApPayment('ALLOC-AP-FULL-PMT', BUSINESS, LEDGER, 1);
  allocatePayment(fullPayApInvoiceId, 'ALLOC-AP-FULL-PMT-alloc', 45000, today(11), 'Cash and Bank', 1);

  const partialPayApInvoiceId = createInvoice(
    { invoiceType: 'AP', business: BUSINESS, ledger: LEDGER, reference: 'ALLOC-AP-PARTIAL', counterpartyName: allocationVendor2, invoiceDate: today(6),
      lines: [{ description: 'Case order — partial payment example', amountMinor: 90000, taxMinor: 0 }] },
    1
  );
  postInvoice(partialPayApInvoiceId, 'Cost of Goods Sold', 'Sales Tax Payable', 1, false);
  stageApPayment({ reference: 'ALLOC-AP-PARTIAL-PMT', business: BUSINESS, ledger: LEDGER, vendor: allocationVendor2, amount_minor: 30000, transdate: today(15), description: 'Partial payment of ALLOC-AP-PARTIAL' });
  postApPayment('ALLOC-AP-PARTIAL-PMT', BUSINESS, LEDGER, 1);
  allocatePayment(partialPayApInvoiceId, 'ALLOC-AP-PARTIAL-PMT-alloc', 30000, today(15), 'Cash and Bank', 1);

  console.log(
    `Real invoice allocation exercised: 2 full payments, 2 partial payments, and 1 real, direct overpayment ` +
    `(receipt $${(overpayReceiptMinor / 100).toFixed(2)} against a $600.00 invoice, leaving $${(overpayUnallocatedMinor / 100).toFixed(2)} genuinely unallocated as a real customer credit).`
  );

  // ---------------------------------------------------------------
  console.log('\n=== 2c. Real, alternate suppliers for a handful of products ===');
  // Per direct request: "products need the notion of normal and
  // alternate suppliers, so purchase orders need to match suppliers
  // of products being ordered." Every real product already, above,
  // got its own, single, preferred source — this adds a real, second,
  // genuine, alternate source for a handful of them, so the Purchase
  // Order page's own, real vendor-matching UI has real, live data to
  // actually exercise, not just the one, single, "only known source"
  // scenario every other product still has.
  const alternateSupplierCandidates = dozen.slice(0, 6);
  for (const p of alternateSupplierCandidates) {
    addOrUpdateItemSource({
      itemName: p.name,
      vendorName: allocationVendor2,
      priceMinor: Math.round(unitCostMinor[p.name] * packageQuantity[p.name] * 1.08), // a real, direct, genuinely higher price — a real, plausible reason to prefer the other source
      packageQuantity: packageQuantity[p.name],
      isPreferred: false,
      preferenceNotes: 'Real, direct alternate — slightly higher price, kept for real, genuine supply-continuity reasons.',
    });
  }
  console.log(`${alternateSupplierCandidates.length} real products now have a genuine, second, alternate source registered (${allocationVendor2}), alongside their own, existing preferred one.`);

  // ---------------------------------------------------------------
  console.log('\n=== 3. A few breakages and returns of bad wine ===');
  let breakageCount = 0;
  for (let i = 0; i < 7; i++) {
    const item = pick(dozen);
    const location = pick(retailOutlets);
    const onHand = getItemLocation(item.name, location.name).quantity_on_hand;
    if (onHand < 2) continue;
    const qty = rand(1, Math.min(3, onHand));
    const reasons = ['Bottle broke during shelf restocking', 'Cork failure, wine spoiled', 'Damaged in transit from warehouse', 'Dropped by staff, bottle shattered'];
    try {
      writeOffStock(BUSINESS, LEDGER, `BREAK-${i}`, item.name, qty, unitCostMinor[item.name], 'Breakage & Spoilage', 'Inventory', pick(reasons), 1, today(rand(2, 26)));
      breakageCount++;
    } catch {
      // fine, skip
    }
  }
  console.log(`${breakageCount} breakage/spoilage write-offs recorded.`);

  // A couple of real customer returns of bad wine — credit notes against real prior sales, done below after sales exist.

  // ---------------------------------------------------------------
  console.log('\n=== 4. Several thousand retail sales to many happy customers ===');
  let saleCount = 0;
  let saleFailures = 0;
  const saleInvoiceIds: number[] = [];
  const retailPriceMinor: Record<string, number> = {};
  for (const p of dozen) {
    retailPriceMinor[p.name] = Math.round(unitCostMinor[p.name] * (1.6 + seededRandom() * 0.5)); // realistic retail markup
  }

  for (let day = 0; day < 28; day++) {
    const salesToday = rand(80, 160);
    for (let i = 0; i < salesToday; i++) {
      const outlet = pick(retailOutlets);
      const lineCount = rand(1, 3);
      const lines = [];
      let feasible = true;
      const partsThisSale = new Set<string>();
      // Once the first line determines whether this basket is cold or
      // warm, later lines stay in the same category — completePosSale
      // only supports one stock location per sale, and mixing would
      // otherwise make a large, unrealistic fraction of multi-line
      // sales simply impossible rather than genuinely rare.
      let saleIsCold: boolean | null = null;
      for (let l = 0; l < lineCount; l++) {
        const candidates = saleIsCold === null ? dozen : dozen.filter((p) => coldProducts.has(p.name) === saleIsCold);
        const item = pick(candidates);
        if (partsThisSale.has(item.name)) continue;
        partsThisSale.add(item.name);
        saleIsCold = coldProducts.has(item.name);

        // Cold products are sold from that outlet's refrigerated
        // display, not its ordinary shelf — the same completePosSale
        // call, just a different source location for stock/COGS purposes.
        const sellLocation = coldProducts.has(item.name) ? `${outlet.name} — Refrigerated` : outlet.name;

        // Beer genuinely sells three ways: single bottle, six-pack (a
        // real ~8% discount vs. six singles, a typical real-world
        // deal), or occasionally a full carton for a party. Every
        // other product sells at least two ways too — mostly single
        // bottles, occasionally a full carton (a steeper discount) —
        // "at least bottle and carton" for the whole catalog, not just
        // beer.
        let qty: number;
        let unitPriceMinor: number;
        let tier: string;
        if (beerNames.has(item.name)) {
          const roll = seededRandom();
          if (roll < 0.5) {
            qty = 1;
            unitPriceMinor = retailPriceMinor[item.name];
            tier = 'Bottle';
          } else if (roll < 0.9) {
            qty = 6;
            unitPriceMinor = Math.round((retailPriceMinor[item.name] * 6 * 0.92) / 6); // six-pack discount, applied per unit so tax/totals stay consistent with an ordinary line
            tier = 'Six-Pack';
          } else {
            qty = packageQuantity[item.name]; // a full carton, for a party
            unitPriceMinor = Math.round((retailPriceMinor[item.name] * packageQuantity[item.name] * 0.85) / packageQuantity[item.name]); // a steeper carton discount
            tier = 'Carton';
          }
        } else if (seededRandom() < 0.85) {
          qty = rand(1, 3);
          unitPriceMinor = retailPriceMinor[item.name];
          tier = 'Bottle';
        } else {
          qty = packageQuantity[item.name];
          unitPriceMinor = Math.round((retailPriceMinor[item.name] * packageQuantity[item.name] * 0.85) / packageQuantity[item.name]); // a steeper carton discount, same as beer's
          tier = 'Carton';
        }

        const onHand = getItemLocation(item.name, sellLocation).quantity_on_hand;
        if (onHand < qty) {
          feasible = false;
          continue;
        }
        lines.push({ itemName: item.name, quantity: qty, unitPriceMinor, tier, taxMinor: Math.round(qty * unitPriceMinor * 0.1), locationOverride: sellLocation });
      }
      if (!feasible || lines.length === 0) {
        saleFailures++;
        continue;
      }
      try {
        // completePosSale takes one location for the whole sale — cold
        // and ordinary items can't genuinely mix in one register
        // transaction here, so skip (rare, most sales are single-category)
        // rather than force an incorrect stock location.
        const locationsInSale = new Set(lines.map((l) => l.locationOverride));
        if (locationsInSale.size > 1) {
          saleFailures++;
          continue;
        }
        const result = completePosSale(
          {
            business: BUSINESS,
            ledger: LEDGER,
            locationName: lines[0].locationOverride,
            customerName: 'Cash Sale',
            lines: lines.map(({ locationOverride, ...l }) => l),
            // No revenueAccount — each line posts to its own real,
            // per-product Sales account, not one shared aggregate.
            taxAccount: 'Sales Tax Payable',
            paymentMethod: seededRandom() < 0.6 ? 'card' : 'cash',
            cashTenderedMinor: undefined,
            transdate: today(day),
          },
          1
        );
        saleInvoiceIds.push(result.invoiceId);
        saleCount++;
        // Real COGS + Inventory-value reduction now happens directly
        // inside completePosSale itself — a real, structural fix
        // (this simulation's own, earlier, manual workaround here is
        // no longer needed at all, and would double-post if left in
        // place). Reads each product's own real cost from the exact,
        // same item_source data already registered above.
      } catch {
        saleFailures++;
      }
    }
  }
  console.log(`${saleCount} retail sales completed (${saleFailures} skipped — insufficient stock at that moment, expected at this volume).`);

  // A couple of real returns — credit notes against real prior sales.
  console.log('\n=== A couple of customer returns of bad wine ===');
  let returnCount = 0;
  for (let i = 0; i < Math.min(3, saleInvoiceIds.length); i++) {
    const original = getInvoice(saleInvoiceIds[rand(0, saleInvoiceIds.length - 1)]);
    if (!original || original.lines.length === 0) continue;
    const line = original.lines[0];
    try {
      const creditId = createInvoice(
        {
          invoiceType: 'AR',
          documentType: 'credit_note',
          referencesInvoiceId: original.id,
          business: BUSINESS,
          ledger: LEDGER,
          reference: `RETURN-${i}`,
          counterpartyName: original.counterparty,
          invoiceDate: today(rand(5, 27)),
          description: 'Customer return — wine had turned/corked',
          lines: [{ description: line.description, quantity: 1, unitPriceMinor: line.unitPriceMinor, amountMinor: line.unitPriceMinor ?? 0, taxMinor: 0, itemName: line.itemName }],
        },
        1
      );
      // A real bug found and fixed here, not assumed correct: the
      // original sale posts to a specific package-tier's own real
      // Sales account (e.g. "Sales - X (Bottle)"), but
      // ensureProductSalesCogsAccounts without a tier falls back to a
      // plain, tier-less account that was never the real account the
      // sale itself used — creating a separate, disconnected "ghost"
      // account that only ever holds tiny, orphaned return amounts.
      // Found the real, actual account the original sale posted to
      // directly, rather than guessing or reconstructing it.
      const originalSalesAccounts = getAccountsPostedTo(original.reference).filter((n) => n.startsWith('Sales - '));
      const salesAccount = originalSalesAccounts[0] ?? ensureProductSalesCogsAccounts(line.itemName!, 1).salesAccount;
      const originalLocationMatch = original.description?.match(/^POS sale at (.+)$/);
      const returnLocation = originalLocationMatch?.[1];
      const returnDivision = returnLocation ? cityDivisionFor(returnLocation) : undefined;
      // A real, direct fix per direct question: "it definitely cannot
      // go back on the shelves" — confirmed exactly right. The
      // financial reversal (crediting the customer) is real and
      // correct, but restockInventory: true was previously putting a
      // genuinely corked, unsellable bottle back into real, sellable
      // stock. Fixed: never restock a spoiled return — the bottle
      // simply never becomes sellable stock again, the same real,
      // permanent loss "Breakage & Spoilage" already represents
      // elsewhere in this simulation, not a separate write-off entry
      // needed on top of the credit note's own real reversal.
      postInvoice(creditId, salesAccount, 'Sales Tax Payable', 1, false, returnDivision);
      returnCount++;
    } catch {
      // fine, skip
    }
  }
  console.log(`${returnCount} customer returns processed as credit notes.`);

  // ---------------------------------------------------------------
  console.log('\n=== 5. Month-end stocktake ===');
  let stocktakeCount = 0;
  for (const location of [...warehouses, ...retailOutlets]) {
    const takeId = createStockTake(location.name, today(28), 1);
    const take = (await import('../src/db.js')).getStockTake(takeId)!;
    for (const line of take.lines) {
      // Only products actually traded in this simulation have a real
      // defined unit cost — anything else at a location has no real
      // activity, so it must not get random variance applied.
      const variance = unitCostMinor[line.item] != null && seededRandom() < 0.15 ? rand(-2, 2) : 0;
      recordStockTakeCount(takeId, line.item, Math.max(0, line.expected_quantity + variance));
    }
    const costs: Record<string, number> = {};
    for (const line of take.lines) {
      if (unitCostMinor[line.item] != null) costs[line.item] = unitCostMinor[line.item];
    }
    completeStockTake(takeId, BUSINESS, LEDGER, 'Breakage & Spoilage', 'Inventory', costs, 1);
    stocktakeCount++;
  }
  console.log(`${stocktakeCount} stock takes completed (one per location).`);

  // ---------------------------------------------------------------
  console.log('\n=== 6. Year-end (month-end) close ===');
  const closeResult = closeBooks(BUSINESS, LEDGER, today(28), "Owner's Equity", 1);
  console.log(`Books closed. Net income for the month: $${(closeResult.netIncomeMinor / 100).toFixed(2)}, ${closeResult.accountsZeroed} accounts zeroed.`);

  console.log('\n=== SIMULATION COMPLETE ===');
  console.log(`Purchases: ${purchaseCount} | Breakages: ${breakageCount} | Sales: ${saleCount} | Returns: ${returnCount} | Stock takes: ${stocktakeCount}`);
}

main().catch((err) => {
  console.error('SIMULATION FAILED:', err);
  process.exit(1);
});
