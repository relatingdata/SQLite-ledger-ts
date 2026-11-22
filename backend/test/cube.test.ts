// The general report cube (getCube): measures as configuration, broken
// down by any two axes. Full documentation: docs/pm-application-config.md.
import { test, after } from './test-runtime.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeFixtures } from './fixtures.ts';
const tmpDbPath = path.join(os.tmpdir(), `sql-ledger-ts-cube-test-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = tmpDbPath;
process.env.SEED_DEMO_BUSINESSES = 'false';
const db = await import('../src/db.ts');
const matrix = await import('../src/db-matrix-reports.ts');
const fx = makeFixtures(db);
after(() => {
  for (const f of [tmpDbPath, `${tmpDbPath}-wal`, `${tmpDbPath}-shm`]) fs.rmSync(f, { force: true });
});

// Two items stocked at two locations, sold unevenly.
const biz = fx.freshBusiness('Cube Co');
const north = fx.freshLocation(biz.business, 'Cube North', { bottle_capacity: 100, carton_capacity: 20 });
const south = fx.freshLocation(biz.business, 'Cube South', { bottle_capacity: 100, carton_capacity: 20 });
const red = fx.uniqueName('Cube Red');
const white = fx.uniqueName('Cube White');
for (const item of [red, white]) {
  db.createItem(item, 'Items', fx.userId, biz.business);
}
// Bought at $8.00 a unit, so each sale also posts its cost of goods sold.
for (const loc of [north, south]) {
  db.completeCashPurchase(
    {
      business: biz.business,
      ledger: biz.actualLedger,
      locationName: loc.name,
      vendorName: db.asProviderName('Cash'),
      lines: [red, white].map((itemName) => ({ itemName, quantity: 10, unitPriceMinor: 800, taxMinor: 0 })) as any,
      taxAccount: db.asAccountName('Sales Tax Payable'),
      paymentMethod: 'cash',
      transdate: '2027-01-01',
    } as any,
    fx.userId
  );
}
function sell(loc: string, lines: [string, number, number][], date: string) {
  db.completePosSale(
    {
      business: biz.business,
      ledger: biz.actualLedger,
      locationName: loc,
      customerName: db.asCustomerName('Cash'),
      lines: lines.map(([itemName, quantity, unitPriceMinor]) => ({ itemName, quantity, unitPriceMinor, taxMinor: 0 })) as any,
      taxAccount: db.asAccountName('Sales Tax Payable'),
      paymentMethod: 'cash',
      transdate: date,
    },
    fx.userId
  );
}
sell(north.name, [[red, 2, 1500], [white, 3, 2000]], '2027-01-02');
sell(south.name, [[red, 1, 1500]], '2027-02-02');
const measures = ['sales=postings:-Sales Revenue', 'cogs=postings:+Cost of Goods Sold|#COGS', 'quantity=onHand', 'value=stockValue'].map(matrix.parseCubeMeasure);
const cube = (row: string, col: string, from?: string, to?: string) =>
  new Map(matrix.getCube(biz.business, biz.actualLedger, row, col, measures, from, to).map((c) => [`${c.rowKey}|${c.colKey}`, c.values]));

test('getCube: sales by item and location, positive, each in its own cell', () => {
  const c = cube('Item', 'Location');
  assert.equal(c.get(`${red}|${north.name}`)?.sales, 3000);
  assert.equal(c.get(`${red}|${south.name}`)?.sales, 1500);
  assert.equal(c.get(`${white}|${north.name}`)?.sales, 6000);
  assert.equal(c.get(`${white}|${south.name}`)?.sales ?? 0, 0);
});

test('getCube: on-hand quantity is what was received less what was sold, per item and location', () => {
  const c = cube('Item', 'Location');
  assert.equal(c.get(`${red}|${north.name}`)?.quantity, 8);
  assert.equal(c.get(`${red}|${south.name}`)?.quantity, 9);
  assert.equal(c.get(`${white}|${north.name}`)?.quantity, 7);
  assert.equal(c.get(`${white}|${south.name}`)?.quantity, 10);
});

test('getCube: stock on hand at what it cost, as the books hold it', () => {
  const c = cube('Item', 'Location');
  assert.equal(c.get(`${red}|${north.name}`)?.value, 8 * 800);
  assert.equal(c.get(`${white}|${south.name}`)?.value, 10 * 800);
});

test('getCube: swapping the axes transposes the cells, and Consolidated totals them', () => {
  const byItem = cube('Item', 'Location');
  const byLocation = cube('Location', 'Item');
  for (const [key, values] of byItem) {
    const [r, c] = key.split('|');
    assert.deepEqual(byLocation.get(`${c}|${r}`), values);
  }
  const all = cube('Consolidated', 'Consolidated');
  assert.equal(all.size, 1);
  const total = [...all.values()][0];
  assert.equal(total.sales, 10500);
  assert.equal(total.quantity, 34, "this business's stock only");
});

test('getCube: a period counts only the postings in it', () => {
  const january = cube('Item', 'Consolidated', '2027-01-01', '2027-01-31');
  assert.equal(january.get(`${red}|Consolidated`)?.sales, 3000);
  assert.equal(january.get(`${white}|Consolidated`)?.sales, 6000);
});

test('getCube: cost of goods sold per item and location, at what the units sold cost', () => {
  const c = cube('Item', 'Location');
  assert.equal(c.get(`${red}|${north.name}`)?.cogs, 1600);
  assert.equal(c.get(`${red}|${south.name}`)?.cogs, 800);
  assert.equal(c.get(`${white}|${north.name}`)?.cogs, 2400);
  assert.equal(c.get(`${red}|${north.name}`)!.sales - c.get(`${red}|${north.name}`)!.cogs, 1400);
});

// getSalesCogsMatrix (behind the retired Sales vs COGS screen) told sales
// from cost of goods sold by a "Sales - " name prefix that per-item sales
// accounts no longer carry, so every sale came out as negative cost of
// goods sold. getCube tells them apart by where the account sits.
test('getCube agrees with getStockOnHandMatrix, and corrects getSalesCogsMatrix', () => {
  const c = cube('Item', 'Location');
  for (const cell of matrix.getStockOnHandMatrix('Item', 'Location').cells.filter((x) => x.rowKey === red || x.rowKey === white)) {
    assert.equal(c.get(`${cell.rowKey}|${cell.colKey}`)?.quantity, cell.quantityBottles, `${cell.rowKey} at ${cell.colKey}`);
  }
  const old = matrix.getSalesCogsMatrix(biz.business, biz.actualLedger, undefined, undefined, 'Item', 'Location');
  for (const cell of old.cells) {
    const mine = c.get(`${cell.rowKey}|${cell.colKey}`);
    assert.equal(cell.salesMinor, 0, 'the old matrix finds no sales');
    assert.equal((mine?.cogs ?? 0) - (mine?.sales ?? 0), cell.cogsMinor, `the old matrix nets ${cell.rowKey}'s sales at ${cell.colKey} into its cost of goods sold`);
  }
});

test('parseCubeMeasure: rejects what it cannot read', () => {
  assert.throws(() => matrix.parseCubeMeasure('sales'));
  assert.throws(() => matrix.parseCubeMeasure('x=postings:'));
  assert.throws(() => matrix.parseCubeMeasure('x=onHandAt:wholesale'));
  assert.deepEqual(matrix.parseCubeMeasure('m=postings:-A|B'), { name: 'm', kind: 'postings', under: ['A', 'B'], sign: -1 });
});

// First in, first out: what a sale costs is what its units were bought at,
// oldest first, at the location they leave; a transfer carries that cost.
test('transferred stock arrives as the layers it left with: its oldest units keep their own cost at the new location', () => {
  const fifo = fx.freshBusiness('FIFO Layers Co');
  const shop = fx.freshLocation(fifo.business, 'Layers Shop', { bottle_capacity: 100, carton_capacity: 20 });
  const store = fx.freshLocation(fifo.business, 'Layers Store', { bottle_capacity: 100, carton_capacity: 20 });
  const gin = fx.uniqueName('Layers Gin');
  db.createItem(gin, 'Items', fx.userId, fifo.business);
  const buy = (quantity: number, unitPriceMinor: number, date: string) =>
    db.completeCashPurchase({ business: fifo.business, ledger: fifo.actualLedger, locationName: shop.name, vendorName: db.asProviderName('Cash'), lines: [{ itemName: gin, quantity, unitPriceMinor, taxMinor: 0 }], taxAccount: db.asAccountName('Sales Tax Payable'), paymentMethod: 'cash', transdate: date } as any, fx.userId);
  buy(4, 1000, '2027-03-01');
  buy(6, 1300, '2027-03-02');
  const layers = (location: string) => db.stockCostLayers(fifo.business, fifo.actualLedger, db.asItemName(gin), db.asLocationName(location));
  // 7 move: the 4 at $10 and 3 of the 6 at $13, as two layers, not 7 at a blended $11.29.
  db.transferItems(fifo.business, fifo.actualLedger, db.asItemName(gin), db.asLocationName(shop.name), db.asLocationName(store.name), 7, 'LAYERS-XFER', fx.userId, '2027-03-03');
  assert.deepEqual(layers(store.name), [{ quantity: 4, value: 4000 }, { quantity: 3, value: 3900 }]);
  assert.deepEqual(layers(shop.name), [{ quantity: 3, value: 3900 }]);
  // 5 sold at the store cost the 4 at $10 and 1 at $13.
  assert.equal(db.fifoCostMinor(fifo.business, fifo.actualLedger, db.asItemName(gin), db.asLocationName(store.name), 5), 4000 + 1300);
});

test('a POS sale costs its units first in, first out, and a transfer carries their cost', () => {
  const fifo = fx.freshBusiness('FIFO Co');
  const shop = fx.freshLocation(fifo.business, 'FIFO Shop', { bottle_capacity: 100, carton_capacity: 20 });
  const store = fx.freshLocation(fifo.business, 'FIFO Store', { bottle_capacity: 100, carton_capacity: 20 });
  const gin = fx.uniqueName('FIFO Gin');
  db.createItem(gin, 'Items', fx.userId, fifo.business);
  const buy = (quantity: number, unitPriceMinor: number, date: string) =>
    db.completeCashPurchase({ business: fifo.business, ledger: fifo.actualLedger, locationName: shop.name, vendorName: db.asProviderName('Cash'), lines: [{ itemName: gin, quantity, unitPriceMinor, taxMinor: 0 }], taxAccount: db.asAccountName('Sales Tax Payable'), paymentMethod: 'cash', transdate: date } as any, fx.userId);
  buy(4, 1000, '2027-03-01');
  buy(6, 1300, '2027-03-02');
  const layers = () => db.stockCostLayers(fifo.business, fifo.actualLedger, db.asItemName(gin), db.asLocationName(shop.name));
  assert.deepEqual(layers(), [{ quantity: 4, value: 4000 }, { quantity: 6, value: 7800 }]);
  // 5 units: the 4 at $10, then 1 at $13.
  db.completePosSale({ business: fifo.business, ledger: fifo.actualLedger, locationName: shop.name, customerName: db.asCustomerName('Cash'), lines: [{ itemName: gin, quantity: 5, unitPriceMinor: 2000, taxMinor: 0 }], taxAccount: db.asAccountName('Sales Tax Payable'), paymentMethod: 'cash', transdate: '2027-03-03' } as any, fx.userId);
  assert.deepEqual(layers(), [{ quantity: 5, value: 6500 }]);
  const sold = (from: string, to: string) =>
    new Map(matrix.getCube(fifo.business, fifo.actualLedger, 'Location', 'Consolidated', measures, from, to).map((c) => [c.rowKey, c.values]));
  assert.equal(sold('2027-03-03', '2027-03-03').get(shop.name)?.cogs, 5300);
  // 2 to the store carry $26.00 with them; the shop keeps 3 at $13.
  db.transferItems(fifo.business, fifo.actualLedger, db.asItemName(gin), db.asLocationName(shop.name), db.asLocationName(store.name), 2, 'FIFO-XFER', fx.userId, '2027-03-04');
  assert.deepEqual(layers(), [{ quantity: 3, value: 3900 }]);
  assert.deepEqual(db.stockCostLayers(fifo.business, fifo.actualLedger, db.asItemName(gin), db.asLocationName(store.name)), [{ quantity: 2, value: 2600 }]);
});
