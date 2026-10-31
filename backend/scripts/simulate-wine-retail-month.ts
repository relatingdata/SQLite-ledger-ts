// A full month of trading for Wine Retail Business, end to end, through the same
// functions the frontend calls. Run: node --import tsx backend/scripts/simulate-wine-retail-month.ts
// Full documentation: docs/pm-build-and-tooling.md ("Wine Retail Business simulation").
import {
  create,
  requireEntity,
  requireEntityById,
  resolveBusinessLocationsRootId,
  typeRootName,
  typeBusinessName,
  typeBusinessLocationsRootName,
  typeProviderName,
  typeCustomerName,
  typeCategoryOrItemsRootName,
  typeItemName,
  typeLocationEntityName,
  typeEmployeeName,
  createBusiness,
  createAndConfigureLocation,
  getItem,
  setItem,
  asItemName,
  asLocationName,
  setContact,
  setRelationship,
  stageLine,
  postJournalEntry,
  receiveItems,
  transferItems,
  getRestockPickingList,
  confirmRestockPickedLine,
  dispatchRestockFromPickingList,
  dispatchItems,
  writeOffItems,
  completePosSale,
  createStockTake,
  recordStockTakeCount,
  completeStockTake,
  closeBooks,
  getEntityTree,
  supersedeEntity,
  getLocation,
  setLocation,
  addOrUpdateItemSource,
  listItems,
  getInvoice,
  createInvoice,
  postInvoice,
  getHierarchyGroupForLocation,
  getAccountsPostedTo,
  stagePurchaseOrder,
  postPurchaseOrder,
  stageAPPayment,
  postAPPayment,
  stageARReceipt,
  postARReceipt,
  allocatePayment,
  getInvoiceOutstandingMinor,
  ensureItemSalesCogsAccounts,
  ensureProductTierPart,
  stageBomComponent,
  postBomComponents,
  ensureItemInventoryAccount,
  ensureHierarchyGrouping,
  ensureHierarchyValue,
  setHierarchyParent,
  setCurrencyExchangeRate,
  nominateLocationCurrency,
  asBusinessName,
} from '../src/db.js';
import { getItemLocation, createPosTerminal, setTerminalCurrency, setItemLocationLevels } from '../src/db-stock.js';
import { fixtures } from '../../shared-fixtures/wine-retail.js';
import { readCsv } from '../../shared-fixtures/csv.js';
import { loadDemoLocations, loadDemoCategories, loadDemoProducts, loadDemoUpcs, loadDemoStockLevels, loadDemoEmployees } from '../../shared-fixtures/wine-retail-demo-data.js';
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
  const locationsRootId = resolveBusinessLocationsRootId(BUSINESS);
  const locationEntities = locationsRootId ? entities.filter((e) => e.parent_id === locationsRootId) : [];
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

  console.log('=== Setup: vendor, customer, CoA accounts this simulation needs ===');
  create(requireEntity('Accounts Payable', typeRootName), typeProviderName, VENDOR, 1);
  setContact(VENDOR, { payment_terms_days: 30 });
  // The real, named customer every completePosSale call below attributes
  // walk-in retail/POS/wine-bar sales to — also real, permanent, missing
  // infrastructure this script never created itself (same real gap as
  // the locations/catalog/stock fix above): every one of those calls
  // failed with "No customer/vendor named 'Cash Sale'" on a fresh
  // database, confirmed live, until this was added.
  try {
    create(requireEntity('Customers', typeRootName), typeCustomerName, 'Cash Sale', 1);
  } catch {
    // already exists from a prior run
  }
  for (const [name, category] of [
    ['Freight In', 'Expense'],
    ['Breakage & Spoilage', 'Expense'],
    ['Wine Returns', 'Expense'],
  ] as const) {
    try {
      create(requireEntity(category, typeRootName), typeRootName, name, 1);
    } catch {
      // already exists from a prior run — fine, this script is safe to re-run
    }
  }

  // Real locations, a full product catalog, and opening stock — this
  // business's own structural data, loaded from shared-fixtures/
  // wine-retail-demo-data.ts (plain, real CSV, per direct instruction;
  // never a hardcoded TypeScript array). This used to come from a
  // demo-seed migration that ran once at boot (migrateForWineRetailDemoData,
  // in backend/src/db-seed.ts); that whole boot-time path was removed
  // entirely, per direct instruction, with this script named as its
  // real, intended replacement — but the actual replacement call was
  // never written, leaving the loader above genuinely orphaned (zero
  // real callers anywhere in the codebase) and this simulation unable
  // to run at all on a fresh database. Fixed here: every real step
  // below only creates what's genuinely missing, so this is still
  // safe to re-run against a database that already has some or all
  // of this real structure in place.
  console.log(`=== Setup: real locations, product catalog, and opening stock for ${BUSINESS}, if missing (shared-fixtures/wine-retail-demo-data.ts) ===`);
  const itemsRoot = requireEntity('Items', typeRootName, requireEntity(BUSINESS, typeBusinessName, requireEntity('Businesses', typeRootName)));
  // Scoped to this one business's own subtree, not the whole, real,
  // global entity namespace — confirmed live, a global snapshot
  // wrongly treats a genuine, permanent, structural Vocabulary word
  // (e.g. "Lager" is also the real Danish word for "warehouse") as
  // this business's own "Lager" beer subcategory already existing,
  // silently skipping its real creation.
  let existingNames = new Set(getEntityTree(BUSINESS).map((e) => e.name));

  const locationsRoot = requireEntityById(resolveBusinessLocationsRootId(BUSINESS)!, typeBusinessLocationsRootName);
  let locationsCreated = 0;
  for (const loc of loadDemoLocations()) {
    if (existingNames.has(loc.name)) continue;
    // createAndConfigureLocation, not a raw create+setLocation, so each
    // location also gets its real "Belongs To Group"/"Belongs To Business"
    // wiring (grouped by city, under the existing "Division" hierarchy
    // convention — the same one the refrigerated-outlet setup below reads
    // back via getHierarchyGroupForLocation) — confirmed directly: without
    // this, getOrganizationChart has no group containing any location, so
    // the Business Setup org chart (and every employee on it) never
    // renders at all, regardless of how many real employees exist.
    createAndConfigureLocation(
      BUSINESS,
      loc.name,
      {
        city: loc.city,
        location_type: loc.locationType,
        is_billing_address: loc.isBilling,
        bottle_capacity: loc.bottleCap,
        carton_capacity: loc.cartonCap,
        timezone: loc.timezone,
      },
      1,
      loc.city,
      'Division'
    );
    existingNames.add(loc.name);
    locationsCreated++;
  }
  console.log(`Locations: ${locationsCreated} created, ${loadDemoLocations().length - locationsCreated} already real and present.`);

  // categoryOfSubcategory tracked by hand, here, rather than resolved
  // later by name (as createItem's own businessName branch would) —
  // confirmed live, a real, permanent, structural Vocabulary word can
  // genuinely collide, by plain string, with a product subcategory
  // ("Lager" is also the real Danish word for "warehouse"), and
  // isDescendantOf (db.ts) resolves a bare name globally, picking
  // whichever same-named entity happens to come first in the whole,
  // real entity tree — not necessarily this business's own real
  // subcategory. Looking each category/subcategory node up by its own,
  // already-known, directly-scoped parent (itemsRoot, then that
  // category's own real node) side-steps that collision entirely,
  // rather than papering over it with a rename of otherwise real,
  // correct fixture data.
  const categoryOfSubcategory = new Map<string, string>();
  let categoriesCreated = 0;
  // 'Category' as a real Hierarchy grouping, alongside (never instead of)
  // the structural Items/category/subcategory tree above — confirmed
  // directly: the Items screen's own category picker and getSalesReport's
  // own category grouping (db-reports.ts) both read a product's Category
  // through getHierarchyParent(itemName, 'Category'), the exact same
  // generic tag mechanism Division already uses for locations, never the
  // structural tree position. Without this, every product has no
  // Category tag at all and genuinely, correctly falls back to 'Other'.
  ensureHierarchyGrouping(BUSINESS, 'Category', 1);
  for (const cat of loadDemoCategories()) {
    categoryOfSubcategory.set(cat.subcategory, cat.category);
    if (!existingNames.has(cat.category)) {
      create(itemsRoot, typeCategoryOrItemsRootName, cat.category, 1);
      existingNames.add(cat.category);
      categoriesCreated++;
    }
    ensureHierarchyValue(BUSINESS, 'Category', cat.category, 1);
    if (!existingNames.has(cat.subcategory)) {
      create(requireEntity(cat.category, typeCategoryOrItemsRootName, itemsRoot), typeCategoryOrItemsRootName, cat.subcategory, 1);
      existingNames.add(cat.subcategory);
      categoriesCreated++;
    }
  }
  console.log(`Categories/subcategories: ${categoriesCreated} created.`);

  let productsCreated = 0;
  for (const prod of loadDemoProducts()) {
    const category = categoryOfSubcategory.get(prod.subcategory);
    if (!category) throw new Error(`No real category found for subcategory "${prod.subcategory}" (product "${prod.name}") in shared-fixtures/categories.csv.`);
    if (existingNames.has(prod.name)) continue;
    const subcategoryNode = requireEntity(prod.subcategory, typeCategoryOrItemsRootName, requireEntity(category, typeCategoryOrItemsRootName, itemsRoot));
    create(subcategoryNode, typeItemName, prod.name, 1);
    setItem(prod.name, { description: null, unit_of_measure: null, upc: null, retail_price_minor: null });
    setHierarchyParent(prod.name, 'Category', category, 1);
    existingNames.add(prod.name);
    productsCreated++;
  }
  console.log(`Products: ${productsCreated} created.`);

  let upcsSet = 0;
  for (const upc of loadDemoUpcs()) {
    const existing = getItem(upc.name);
    if (existing && !existing.upc) {
      setItem(upc.name, { upc: upc.upc });
      upcsSet++;
    }
  }
  console.log(`UPCs: ${upcsSet} set.`);

  let stockRowsLoaded = 0;
  for (const row of loadDemoStockLevels()) {
    let onHand = 0;
    try {
      onHand = getItemLocation(asItemName(row.itemName), asLocationName(row.locationName)).quantity_on_hand;
    } catch {
      // No real quantity account for this item/location pair yet — genuinely zero.
    }
    if (onHand <= 0 && row.qty > 0) {
      receiveItems(BUSINESS, LEDGER, `OPENING-STOCK-${row.itemName}-${row.locationName}`, asItemName(row.itemName), asLocationName(row.locationName), row.qty, 1, today(0));
      stockRowsLoaded++;
    }
    setItemLocationLevels(
      asItemName(row.itemName),
      asLocationName(row.locationName),
      { minLevel: row.minLevel, maxLevel: row.maxLevel, reorderLevel: row.reorderLevel, shelfSide: row.shelfSide, rack: row.rack, level: row.level },
      BUSINESS,
      LEDGER,
      1
    );
  }
  console.log(`Opening stock: ${stockRowsLoaded} real receipts posted (quantity movement only — no dollar value until a unit cost is registered below).`);

  const locations = listLocations();
  const warehouses = locations.filter((l) => l.location_type === 'Warehouse');
  const retailOutlets = locations.filter((l) => l.location_type === 'Retail');
  console.log(`Warehouses: ${warehouses.map((w) => w.name).join(', ')}`);
  console.log(`Retail outlets: ${retailOutlets.map((r) => r.name).join(', ')}`);

  // A refrigerated display at each outlet (an ordinary location, same mechanism, for
  // cold beer/sparkling wine) sized to ~10% of that outlet's own bottle capacity.
  const refrigeratedOutlets: { name: string; city: string; location_type: 'Retail' }[] = [];
  for (const outlet of retailOutlets) {
    const mainLocation = getLocation(outlet.name);
    const mainBottleCapacity = mainLocation?.bottle_capacity ?? 1500;
    const fridgeBottleCapacity = Math.round((mainBottleCapacity * 0.1) / 10) * 10; // nearest 10
    const fridgeCartonCapacity = Math.round(fridgeBottleCapacity / 10); // roughly one carton per 10 bottles of fridge space
    const name = `${outlet.name} — Refrigerated`;
    try {
      create(locationsRoot, typeLocationEntityName, name, 1);
    } catch {
      // already exists from a prior run
    }
    // outlet.city is coarse; the fine-grained division (needed so cold-storage sales
    // attribute to the same division as the parent outlet) comes from getHierarchyGroupForLocation.
    const fineGrainedDivision = getHierarchyGroupForLocation(outlet.name, 'Division') ?? outlet.city;
    setLocation(name, { city: fineGrainedDivision, location_type: 'Retail', is_billing_address: false, bottle_capacity: fridgeBottleCapacity, carton_capacity: fridgeCartonCapacity, timezone: getLocation(outlet.name)?.timezone ?? 'UTC' });
    // Relation to the parent outlet lets completePosSale route a cold product to the
    // fridge automatically — the POS "store" dropdown only shows the logical outlet.
    supersedeEntity(getEntityTree().find((e) => e.name === name)!.id, { relation: outlet.name }, 1);
    refrigeratedOutlets.push({ name, city: outlet.city, location_type: 'Retail' });
  }
  console.log(`Refrigerated displays set up at all ${refrigeratedOutlets.length} retail outlets, each sized proportionally to its own shop.`);

  // Real, named staff (shared-fixtures/employees.csv) — the real replacement
  // for the old boot-time seedWineRetailEmployees (removed in 5697d46, which
  // named this script as the intended replacement but never wired this part
  // either; the User Manual's own screenshot capture genuinely depends on
  // specific, real, named employees existing, e.g. "Nadia Petrovska").
  let employeesCreated = 0;
  for (const emp of loadDemoEmployees()) {
    if (!getEntityTree().some((e) => e.name === emp.name)) {
      create(requireEntity('Employees', typeRootName), typeEmployeeName, emp.name, 1);
      employeesCreated++;
    }
    setContact(emp.name, {
      phone: emp.phone,
      address_line1: emp.address,
      address_line2: emp.role,
      city: emp.city,
      country: 'Australia',
      wage_minor_per_hour: emp.wageMinorPerHour,
      salary_minor_per_year: emp.salaryMinorPerYear,
    });
    // Real "Place of Employment" relationship, pointing from the employee to
    // wherever they actually work — a real location for on-site staff, or
    // the business itself for a genuinely company-wide role (office staff,
    // both managers) — never a reparenting of the employee's own parent_id,
    // which stays under Employees, exactly as every existing lookup assumes.
    setRelationship(emp.name, 'Place of Employment', emp.employedAt ?? BUSINESS, 1);
  }
  console.log(`Staff: ${employeesCreated} created, ${loadDemoEmployees().length - employeesCreated} already real and present.`);

  const allParts = listItems(asBusinessName('Wine Retail Business'));
  const entities = getEntityTree();
  // Category classification via the entity tree, not a hardcoded product list.
  const categoryOf = (itemName: string): string | undefined => {
    const entity = entities.find((e) => e.name === itemName);
    const parent = entities.find((e) => e.id === entity?.parent_id);
    return parent?.name;
  };
  const products = allParts.filter((p) => categoryOf(p.name) !== undefined);
  console.log(`${products.length} real products confirmed present — every product in the catalog, not a curated subset.`);

  const BEER_CATEGORIES = new Set(['Ale', 'Lager', 'Stout']);
  const COLD_BEER_CATEGORIES = new Set(['Lager', 'Stout']);
  const SPARKLING_CATEGORIES = new Set(['Champagne', 'Cava', 'Prosecco']);
  const beerNames = new Set(products.filter((p) => BEER_CATEGORIES.has(categoryOf(p.name)!)).map((p) => p.name));
  const coldProducts = new Set(
    products.filter((p) => COLD_BEER_CATEGORIES.has(categoryOf(p.name)!) || SPARKLING_CATEGORIES.has(categoryOf(p.name)!)).map((p) => p.name)
  );

  // Wine/spirits carton = 12 bottles; beer carton = 24 (and beer additionally sells in six-packs).
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

  // Deliberate reorder cadence (one major + one minor order/week per warehouse, on
  // staggered days): products split into a fast-moving "major" rotation (beer, cheap
  // wine) and a slower "minor" one (premium wine/spirits) by category/price.
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
      // A major day restocks a rotating subset of fast-moving products (not literally
      // all at once — that drove purchase spend to 3.6x sales revenue); a minor day
      // tops up a smaller rotating subset of the slow-moving ones.
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

      // A Purchase Order first — a commitment with no GL effect of its own.
      stagePurchaseOrder({ reference: `${ref}-PO`, business: BUSINESS, ledger: LEDGER, vendor: VENDOR, item: item.name, quantity: qty, price_minor: unitCost, transdate: today(day) });
      postPurchaseOrder(`${ref}-PO`, BUSINESS, LEDGER, 1);

      { const inv = ensureItemInventoryAccount(item.name, 1); stageLine({ reference: ref, business: BUSINESS, ledger: LEDGER, transdate: today(day), account: inv.inventoryAccount, accountId: inv.inventoryAccountId, amount_minor: totalCost, division: warehouse.city }); }
      stageLine({ reference: ref, business: BUSINESS, ledger: LEDGER, transdate: today(day), account: VENDOR, amount_minor: -totalCost, division: warehouse.city });
      postJournalEntry(ref, BUSINESS, LEDGER, 1);
      receiveItems(BUSINESS, LEDGER, `${ref}-RECV`, item.name, warehouse.name, qty, 1, today(day));
      purchaseCount++;

      // Vendor terms: paid 7-21 days after receipt; a late-month purchase stays
      // outstanding at month-end (realistic, not a bug).
      const payDay = day + rand(7, 21);
      if (payDay < 28) scheduledPayments.push({ payDay, amount: totalCost, ref: `${ref}-PAY` });

      // Distribute roughly 60% of what's received out to retail outlets over the next day or two.
      if (seededRandom() < 0.85) {
        const toSend = Math.floor(qty * (0.4 + seededRandom() * 0.4));
        if (toSend > 0) {
          const outlet = pick(retailOutlets.filter((r) => r.city === warehouse.city));
          if (outlet) {
            // Cold products go to the refrigerated display, not the ordinary shelf.
            const destination = coldProducts.has(item.name) ? refrigeratedOutlets.find((r) => r.city === outlet.city)! : outlet;
            try {
              // Routed through the picking-list/dispatch mechanism (not a direct transferItems call).
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

  let paymentsPosted = 0;
  let totalPaidMinor = 0;
  scheduledPayments.sort((a, b) => a.payDay - b.payDay);
  for (const p of scheduledPayments) {
    stageAPPayment({ reference: p.ref, business: BUSINESS, ledger: LEDGER, vendor: VENDOR, amount_minor: p.amount, transdate: today(p.payDay), description: 'Vendor payment' });
    postAPPayment(p.ref, BUSINESS, LEDGER, 1);
    paymentsPosted++;
    totalPaidMinor += p.amount;
  }
  console.log(`${paymentsPosted} vendor payments posted, totaling $${(totalPaidMinor / 100).toFixed(2)} — the rest genuinely still outstanding at month-end, matching real net-30-ish terms.`);
  console.log(`${purchaseCount} purchase transactions posted and received across the month, each a genuine carton quantity (${dozen.filter((p) => beerNames.has(p.name)).length} beer products at 24/carton, ${dozen.length - beerNames.size} wine/spirits products at 12/carton).`);

  // ---------------------------------------------------------------
  console.log('\n=== 2b. Real, manual AR/AP invoices, allocated three real ways ===');
  // Exercises invoice allocation (AR Receipt/AP Payment) three ways a live business
  // encounters it, not just posting a receipt/payment in isolation.
  const allocationCustomer = 'Riverside Wine Merchants Pty Ltd';
  const allocationVendor2 = 'Alpine Cellar Imports GmbH';
  create(requireEntity('Accounts Receivable', typeRootName), typeCustomerName, allocationCustomer, 1);
  create(requireEntity('Accounts Payable', typeRootName), typeProviderName, allocationVendor2, 1);

  // (1) Full payment.
  const fullPayInvoiceId = createInvoice(
    { invoiceType: 'AR', business: BUSINESS, ledger: LEDGER, reference: 'ALLOC-AR-FULL', counterpartyName: allocationCustomer, invoiceDate: today(3),
      lines: [{ description: 'Case order — full payment example', amountMinor: 84000, taxMinor: 0 }] },
    1
  );
  postInvoice(fullPayInvoiceId, 'Sales Revenue', 'Sales Tax Payable', 1, false);
  stageARReceipt({ reference: 'ALLOC-AR-FULL-RCPT', business: BUSINESS, ledger: LEDGER, customer: allocationCustomer, amount_minor: 84000, transdate: today(10), description: 'Full payment of ALLOC-AR-FULL' });
  postARReceipt('ALLOC-AR-FULL-RCPT', BUSINESS, LEDGER, 1);
  allocatePayment(fullPayInvoiceId, 'ALLOC-AR-FULL-RCPT-alloc', 84000, today(10), 'Cash and Bank', 1);

  // (2) Partial payment — balance left outstanding at month-end.
  const partialPayInvoiceId = createInvoice(
    { invoiceType: 'AR', business: BUSINESS, ledger: LEDGER, reference: 'ALLOC-AR-PARTIAL', counterpartyName: allocationCustomer, invoiceDate: today(5),
      lines: [{ description: 'Case order — partial payment example', amountMinor: 120000, taxMinor: 0 }] },
    1
  );
  postInvoice(partialPayInvoiceId, 'Sales Revenue', 'Sales Tax Payable', 1, false);
  stageARReceipt({ reference: 'ALLOC-AR-PARTIAL-RCPT', business: BUSINESS, ledger: LEDGER, customer: allocationCustomer, amount_minor: 50000, transdate: today(14), description: 'Partial payment of ALLOC-AR-PARTIAL' });
  postARReceipt('ALLOC-AR-PARTIAL-RCPT', BUSINESS, LEDGER, 1);
  allocatePayment(partialPayInvoiceId, 'ALLOC-AR-PARTIAL-RCPT-alloc', 50000, today(14), 'Cash and Bank', 1);

  // (3) Overpayment — only the invoice's own outstanding amount is allocated;
  // the excess is left unallocated as a customer credit balance (allocatePayment
  // refuses to allocate more than the invoice's outstanding balance).
  const overpayInvoiceId = createInvoice(
    { invoiceType: 'AR', business: BUSINESS, ledger: LEDGER, reference: 'ALLOC-AR-OVERPAID', counterpartyName: allocationCustomer, invoiceDate: today(7),
      lines: [{ description: 'Case order — overpayment example', amountMinor: 60000, taxMinor: 0 }] },
    1
  );
  postInvoice(overpayInvoiceId, 'Sales Revenue', 'Sales Tax Payable', 1, false);
  const overpayReceiptMinor = 75000; // genuinely more than the invoice's own $600.00
  stageARReceipt({ reference: 'ALLOC-AR-OVERPAID-RCPT', business: BUSINESS, ledger: LEDGER, customer: allocationCustomer, amount_minor: overpayReceiptMinor, transdate: today(16), description: 'Overpayment of ALLOC-AR-OVERPAID — real, remaining excess deliberately left unallocated' });
  postARReceipt('ALLOC-AR-OVERPAID-RCPT', BUSINESS, LEDGER, 1);
  const overpayOutstanding = getInvoiceOutstandingMinor(overpayInvoiceId);
  allocatePayment(overpayInvoiceId, 'ALLOC-AR-OVERPAID-RCPT-alloc', overpayOutstanding, today(16), 'Cash and Bank', 1);
  const overpayUnallocatedMinor = overpayReceiptMinor - overpayOutstanding;

  // Same three scenarios, mirrored on the AP side with a second, distinct vendor.
  const fullPayAPInvoiceId = createInvoice(
    { invoiceType: 'AP', business: BUSINESS, ledger: LEDGER, reference: 'ALLOC-AP-FULL', counterpartyName: allocationVendor2, invoiceDate: today(4),
      lines: [{ description: 'Case order — full payment example', amountMinor: 45000, taxMinor: 0 }] },
    1
  );
  postInvoice(fullPayAPInvoiceId, 'Cost of Goods Sold', 'Sales Tax Payable', 1, false);
  stageAPPayment({ reference: 'ALLOC-AP-FULL-PMT', business: BUSINESS, ledger: LEDGER, vendor: allocationVendor2, amount_minor: 45000, transdate: today(11), description: 'Full payment of ALLOC-AP-FULL' });
  postAPPayment('ALLOC-AP-FULL-PMT', BUSINESS, LEDGER, 1);
  allocatePayment(fullPayAPInvoiceId, 'ALLOC-AP-FULL-PMT-alloc', 45000, today(11), 'Cash and Bank', 1);

  const partialPayAPInvoiceId = createInvoice(
    { invoiceType: 'AP', business: BUSINESS, ledger: LEDGER, reference: 'ALLOC-AP-PARTIAL', counterpartyName: allocationVendor2, invoiceDate: today(6),
      lines: [{ description: 'Case order — partial payment example', amountMinor: 90000, taxMinor: 0 }] },
    1
  );
  postInvoice(partialPayAPInvoiceId, 'Cost of Goods Sold', 'Sales Tax Payable', 1, false);
  stageAPPayment({ reference: 'ALLOC-AP-PARTIAL-PMT', business: BUSINESS, ledger: LEDGER, vendor: allocationVendor2, amount_minor: 30000, transdate: today(15), description: 'Partial payment of ALLOC-AP-PARTIAL' });
  postAPPayment('ALLOC-AP-PARTIAL-PMT', BUSINESS, LEDGER, 1);
  allocatePayment(partialPayAPInvoiceId, 'ALLOC-AP-PARTIAL-PMT-alloc', 30000, today(15), 'Cash and Bank', 1);

  console.log(
    `Real invoice allocation exercised: 2 full payments, 2 partial payments, and 1 real, direct overpayment ` +
    `(receipt $${(overpayReceiptMinor / 100).toFixed(2)} against a $600.00 invoice, leaving $${(overpayUnallocatedMinor / 100).toFixed(2)} genuinely unallocated as a real customer credit).`
  );

  // ---------------------------------------------------------------
  console.log('\n=== 2c. Real, alternate suppliers for a handful of products ===');
  // Adds a second, non-preferred source for a handful of products, so the PO
  // page's vendor-matching UI has data beyond the single "only known source" case.
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
      writeOffItems(BUSINESS, LEDGER, `BREAK-${i}`, item.name, qty, unitCostMinor[item.name], 'Breakage & Spoilage', 'Inventory', pick(reasons), 1, today(rand(2, 26)));
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
      // Later lines stay in the same cold/warm category as the first — completePosSale
      // only supports one stock location per sale.
      let saleIsCold: boolean | null = null;
      for (let l = 0; l < lineCount; l++) {
        const candidates = saleIsCold === null ? dozen : dozen.filter((p) => coldProducts.has(p.name) === saleIsCold);
        const item = pick(candidates);
        if (partsThisSale.has(item.name)) continue;
        partsThisSale.add(item.name);
        saleIsCold = coldProducts.has(item.name);

        // Cold products sell from the refrigerated display, not the ordinary shelf.
        const sellLocation = coldProducts.has(item.name) ? `${outlet.name} — Refrigerated` : outlet.name;

        // Beer sells bottle/six-pack(~8% off)/carton; everything else sells bottle/carton.
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
        // completePosSale takes one location per sale; skip rather than force a wrong one.
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
        // COGS + inventory-value reduction happens inside completePosSale itself.
      } catch {
        saleFailures++;
      }
    }
  }
  console.log(`${saleCount} retail sales completed (${saleFailures} skipped — insufficient stock at that moment, expected at this volume).`);

  console.log(`\n=== Foreign-currency sales: one real POS terminal, one real border-town location, real exchange rates ===`);
  // 3-currency cartesian setup (AUD home, USD/EUR foreign): 6 distinct, independently-set
  // buy/sell rates plus 3 trivial self-pairs — see docs/multicurrency-design.md.
  const CCY_PAIRS: [string, string, number, number][] = [
    ['AUD', 'USD', 65000, 65500],
    ['USD', 'AUD', 153000, 154000],
    ['AUD', 'EUR', 60000, 60500],
    ['EUR', 'AUD', 165000, 166000],
    ['USD', 'EUR', 92000, 92500],
    ['EUR', 'USD', 107500, 108000],
  ];
  for (const [from, to, buy, sell] of CCY_PAIRS) setCurrencyExchangeRate(BUSINESS, from, to, 1, buy, sell);

  const usdTerminalLocation = retailOutlets[0].name;
  nominateLocationCurrency(usdTerminalLocation, 'USD', 1);
  createPosTerminal('Border Store USD Till', usdTerminalLocation, 1);
  setTerminalCurrency('Border Store USD Till', 'USD');
  const usdCandidateProducts = ['Barossa Shiraz 2021', 'Margaret River Chardonnay 2022'];
  for (const productName of usdCandidateProducts) {
    addOrUpdateItemSource({ itemName: productName, vendorName: VENDOR, currency: 'USD', priceMinor: 1500, isPreferred: true });
  }
  let usdSaleCount = 0;
  for (let i = 0; i < 4; i++) {
    const product = usdCandidateProducts[i % usdCandidateProducts.length];
    try {
      completePosSale(
        {
          business: BUSINESS,
          ledger: LEDGER,
          locationName: usdTerminalLocation,
          terminalName: 'Border Store USD Till',
          customerName: 'Cash Sale',
          lines: [{ itemName: product, quantity: 1 }],
          taxAccount: 'Sales Tax Payable',
          paymentMethod: 'card',
          cashTenderedMinor: undefined,
          transdate: today(10 + i),
        },
        1
      );
      usdSaleCount++;
    } catch {
      /* insufficient stock at that moment */
    }
  }
  console.log(`${usdSaleCount} real USD sales completed through Border Store USD Till, at real, independently-configured exchange rates.`);

  console.log(`\n=== Wine bars: one per division, selling by the glass ===`);
  // Cocktails get a BOM (existing assembly mechanism) recording their recipe for
  // costing, but are stocked as a pre-mixed, directly-received item for sale —
  // assembly-at-time-of-sale is separate future work (docs/stock-lifecycle-review-plan.md).
  const wineBars = listLocations().filter((l) => l.location_type === 'Wine Bar');
  const wineByGlass = ['Barossa Shiraz 2021', 'Margaret River Chardonnay 2022'];
  const beerByGlass = ['Golden Lager 330ml', 'Amber Ale 330ml'];
  const softDrinksByGlass = ['Cola 375ml', 'Lemonade 375ml'];
  const cocktails = ['Classic Gin & Tonic', 'Rum & Cola'];
  const snacks = ['Salted Potato Chips 45g', 'Roasted Mixed Nuts 50g'];

  stageBomComponent({ assemblyItem: 'Classic Gin & Tonic', business: BUSINESS, componentItem: 'London Dry Gin 700ml', quantity: 0.05, unit: 'bottle' });
  stageBomComponent({ assemblyItem: 'Classic Gin & Tonic', business: BUSINESS, componentItem: 'Tonic Water 375ml', quantity: 1, unit: 'bottle' });
  postBomComponents('Classic Gin & Tonic', BUSINESS, 1);
  stageBomComponent({ assemblyItem: 'Rum & Cola', business: BUSINESS, componentItem: 'Spiced Rum 700ml', quantity: 0.05, unit: 'bottle' });
  stageBomComponent({ assemblyItem: 'Rum & Cola', business: BUSINESS, componentItem: 'Cola 375ml', quantity: 1, unit: 'bottle' });
  postBomComponents('Rum & Cola', BUSINESS, 1);

  let wineBarSaleCount = 0;
  for (const bar of wineBars) {
    // Wine/beer/soft drinks are poured by the glass from real, physical
    // bottle stock — "Small Glass"/"Large Glass" are a sales/COGS account
    // split only (completePosSale's own per-line tier handling calls
    // ensureItemTier/ensureItemTierLocationLeaf internally for that), not
    // separate physical stock. quantity_on_hand is always checked and
    // consumed against the base item name (confirmed directly:
    // completePosSale's own stock check uses line.itemName, never a
    // resolved tier item name) — so stock is received here once per base
    // item, not once per tier.
    for (const base of [...wineByGlass, ...beerByGlass, ...softDrinksByGlass]) {
      receiveItems(BUSINESS, LEDGER, `WINEBAR-REC-${bar.name}-${base}`, base, bar.name, 80, 1, today(1));
    }
    for (const item of [...cocktails, ...snacks]) {
      receiveItems(BUSINESS, LEDGER, `WINEBAR-REC-${bar.name}-${item}`, item, bar.name, 30, 1, today(1));
    }

    for (let day = 2; day <= 26; day++) {
      if (seededRandom() < 0.5) continue; // not every day is a wine-bar sales day, deliberately
      const lines = [];
      for (let i = 0; i < 1 + Math.floor(seededRandom() * 3); i++) {
        const category = pick([wineByGlass, beerByGlass, softDrinksByGlass, cocktails, snacks]);
        if (category === cocktails || category === snacks) {
          const item = pick(category);
          lines.push({ itemName: item, quantity: 1, unitPriceMinor: item === 'Classic Gin & Tonic' || item === 'Rum & Cola' ? 1600 : 400, taxMinor: 0 });
        } else {
          const base = pick(category);
          const tier = pick(['Small Glass', 'Large Glass']);
          // itemName stays the real, physical base item; tier is a separate
          // field that completePosSale's own postInvoice logic uses to pick
          // the right tier sales/COGS account — see the comment above the
          // opening-stock loop for why a resolved tier item name must never
          // go here.
          lines.push({ itemName: base, tier, quantity: 1, unitPriceMinor: tier === 'Small Glass' ? 800 : 1400, taxMinor: 0 });
        }
      }
      try {
        completePosSale(
          {
            business: BUSINESS,
            ledger: LEDGER,
            locationName: bar.name,
            customerName: 'Cash Sale',
            lines,
            taxAccount: 'Sales Tax Payable',
            paymentMethod: seededRandom() < 0.6 ? 'card' : 'cash',
            transdate: today(day),
          },
          1
        );
        wineBarSaleCount++;
      } catch {
        // insufficient stock at that moment - expected occasionally at this volume
      }
    }
  }
  console.log(`${wineBars.length} wine bars stocked and trading, ${wineBarSaleCount} wine-bar sales completed.`);

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
      // The original sale posts to a tier-specific Sales account (e.g. "Sales - X
      // (Bottle)"); ensureItemSalesCogsAccounts without a tier would fall back to a
      // different, tier-less "ghost" account, so look up the account the sale actually used.
      const originalSalesAccounts = getAccountsPostedTo(original.reference).filter((n) => n.startsWith('Sales - '));
      const salesAccount = originalSalesAccounts[0] ?? ensureItemSalesCogsAccounts(line.itemName!, 1).salesAccount;
      const originalLocationMatch = original.description?.match(/^POS sale at (.+)$/);
      const returnLocation = originalLocationMatch?.[1];
      const returnDivision = returnLocation ? getHierarchyGroupForLocation(returnLocation, 'Division') : undefined;
      // A spoiled return is never restocked — the financial reversal (crediting the
      // customer) happens, but the bottle doesn't become sellable stock again.
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
    const takeId = createStockTake(location.name, today(28), 1, BUSINESS);
    const take = (await import('../src/db.js')).getStockTake(takeId)!;
    for (const line of take.lines) {
      // Only products actually traded here have a defined unit cost; others get no variance.
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
