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
// The cost of what was sold, to each item's own cost of goods sold account
// (a POS sale here posts the sale only).
for (const [item, cost] of [[red, 2400], [white, 2400]] as [string, number][]) {
  const { cogsAccount, cogsAccountId } = db.ensureItemSalesCogsAccounts(db.asItemName(item), fx.userId, undefined, biz.business);
  const reference = `CUBE-COGS-${item}`;
  for (const [account, accountId, amount] of [[cogsAccount, cogsAccountId, cost], ['Inventory', undefined, -cost]] as [string, number | undefined, number][]) {
    db.stageLine({ reference, business: biz.business, ledger: biz.actualLedger, description: 'Cost of goods sold', transdate: '2027-02-03', account: db.asAccountName(account), accountId, amount_minor: amount } as any);
  }
  db.postJournalEntry(reference, biz.business, biz.actualLedger, fx.userId);
}

const measures = ['sales=postings:-Sales Revenue', 'cogs=postings:+Cost of Goods Sold|#COGS', 'quantity=onHand'].map(matrix.parseCubeMeasure);
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
  assert.equal(total.quantity >= 34, true, 'every item on hand, this business and any other');
});

test('getCube: a period counts only the postings in it', () => {
  const january = cube('Item', 'Consolidated', '2027-01-01', '2027-01-31');
  assert.equal(january.get(`${red}|Consolidated`)?.sales, 3000);
  assert.equal(january.get(`${white}|Consolidated`)?.sales, 6000);
});

test('getCube: cost of goods sold by item, and gross margin follows from the two', () => {
  const c = cube('Item', 'Consolidated');
  assert.equal(c.get(`${red}|Consolidated`)?.cogs, 2400);
  assert.equal(c.get(`${white}|Consolidated`)?.cogs, 2400);
  assert.equal(c.get(`${red}|Consolidated`)!.sales - c.get(`${red}|Consolidated`)!.cogs, 2100);
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
