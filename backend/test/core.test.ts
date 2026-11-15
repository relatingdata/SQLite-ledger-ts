// The simplified middleware core (src/core), proved from the smallest
// business upward. See docs/pm-core-middleware.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { Core, Instance, Refused, NotFound, GLOBAL_BUSINESS } from '../src/core/core.js';
import * as ops from '../src/core/ops.js';
import * as reports from '../src/core/reports.js';

let n = 0;
function fresh(): Core {
  n += 1;
  const file = path.join(os.tmpdir(), `sql-ledger-ts-core-${process.pid}-${n}.sqlite`);
  fs.rmSync(file, { force: true });
  return new Core(file);
}

function business(core: Core, name = 'Ice'): Instance {
  ops.createBusiness(core.open('admin', GLOBAL_BUSINESS), { name });
  return core.open('admin', name);
}

function accountNames(inst: Instance, under: string): string[] {
  const header = inst.core.findNamed(inst.accountsRoot().id, under, 'Account');
  return header ? inst.core.things(header.id, 'Account').map((a) => a.name) : [];
}

test('the ice trader: a business, one item, and two entries', () => {
  const core = fresh();
  const ice = business(core);
  // Nothing was copied in: the business has no accounts until it posts.
  assert.deepEqual(core.things(ice.accountsRoot().id), []);

  ops.createItem(ice, 'Ice');
  ops.purchase(ice, { item: 'Ice', quantity: 50, unitMinor: 100 });
  ops.sell(ice, { item: 'Ice', quantity: 40, unitMinor: 200 });

  const pl = reports.profitAndLoss(ice);
  assert.equal(pl.total_income_minor, 8000);
  assert.equal(pl.total_expense_minor, 4000);
  assert.equal(pl.net_income_minor, 4000);
  const tb = reports.trialBalance(ice);
  assert.equal(tb.total_debit_minor, tb.total_credit_minor);
  assert.ok(reports.balanceSheet(ice).balanced);

  // A Cartesian product of cardinality one: a single account, Ice, under
  // each header the trader has used.
  for (const header of ['Sales Revenue', 'Cost of Goods Sold', 'Inventory']) assert.deepEqual(accountNames(ice, header), ['Ice']);
  // An account that was never posted to was never created.
  assert.equal(core.findNamed(ice.accountsRoot().id, 'Wages', 'Account'), undefined);
  assert.equal(core.findNamed(ice.accountsRoot().id, 'Write-offs', 'Account'), undefined);
});

test('the null product is one simple posting account under a header', () => {
  const core = fresh();
  const shop = business(core, 'Simple');
  // Naming a header when posting by hand reaches its simple account.
  const sales = shop.accountNamed('Sales Revenue');
  assert.equal(sales.name, 'General');
  shop.post('S-1', [{ account: shop.accountNamed('Cash and Bank').id, amount: 500 }, { account: sales.id, amount: -500 }]);
  assert.deepEqual(accountNames(shop, 'Sales Revenue'), ['General']);
  assert.equal(reports.profitAndLoss(shop).net_income_minor, 500);
});

test('using locations adds the second dimension, and nothing else changes', () => {
  const core = fresh();
  const ice = business(core);
  ops.createItem(ice, 'Ice');
  ops.createLocation(ice, { name: 'Home' });
  ops.createLocation(ice, { name: 'Stall' });
  ops.purchase(ice, { item: 'Ice', location: 'Home', quantity: 10, unitMinor: 100 });
  ops.transferStock(ice, 'T-1', 'Ice', 'Home', 'Stall', 4);
  ops.sell(ice, { item: 'Ice', location: 'Stall', quantity: 4, unitMinor: 300 });
  assert.deepEqual(accountNames(ice, 'Inventory').sort(), ['Ice at Home', 'Ice at Stall']);
  assert.deepEqual(accountNames(ice, 'Sales Revenue'), ['Ice at Stall']);
  assert.deepEqual(reports.inventoryListing(ice), [
    { location: 'Home', rows: [{ item: 'Ice', quantity_on_hand: 6 }] },
    { location: 'Stall', rows: [{ item: 'Ice', quantity_on_hand: 0 }] },
  ]);
  assert.equal(reports.profitAndLoss(ice).net_income_minor, 1200 - 400);
  const byLocation = reports.profitAndLossByAxis(ice, undefined, undefined, 'Location', 'Item');
  assert.deepEqual(byLocation.map((g) => [g.key, g.children.map((c) => c.key)]), [['Stall', ['Ice']]]);
});

test('the Global Business creates businesses and never trades', () => {
  const core = fresh();
  const global = core.open('admin', GLOBAL_BUSINESS);
  const ice = business(core);
  assert.throws(() => global.post('X', []), Refused);
  assert.throws(() => global.accountsRoot(), Refused);
  assert.throws(() => ops.createBusiness(ice, { name: 'Another' }), Refused);
  assert.throws(() => ops.createBusiness(global, { name: 'Ice' }), Refused);
});

test('users and roles belong to a business', () => {
  const core = fresh();
  const ice = business(core);
  const wine = business(core, 'Wine');
  // The user who created the business is its first user, an Administrator.
  assert.deepEqual(ops.userRoles(ice, 'admin'), ['Administrator']);
  ops.createUser(ice, 'sam', 'a-good-password', ['Bookkeeper']);
  ops.setUserRoles(ice, 'sam', ['Bookkeeper', 'Administrator']);
  assert.deepEqual(ops.userRoles(ice, 'sam').sort(), ['Administrator', 'Bookkeeper']);
  ops.setUserRoles(ice, 'sam', ['Accountant']);
  assert.deepEqual(ops.userRoles(ice, 'sam'), ['Accountant']);
  // sam is a user of Ice only.
  assert.throws(() => core.open('sam', 'Wine'), NotFound);
  assert.throws(() => ops.userRoles(wine, 'sam'), NotFound);
  assert.throws(() => ops.setUserRoles(ice, 'sam', ['No Such Role']), NotFound);
});

test('lookup is local first; renaming is renaming the local instance', () => {
  const core = fresh();
  const ice = business(core);
  const wine = business(core, 'Wine');
  // Reading creates nothing.
  assert.equal(ice.lookup('Vocabulary', 'Profit and Loss Statement')?.local, false);
  assert.equal(ice.label('Vocabulary', 'Profit and Loss Statement'), 'Profit and Loss Statement');

  const word = ice.store.tx(() => ice.localise('Vocabulary', 'Profit and Loss Statement', 'Word'));
  ice.store.tx(() => ice.store.rename(word.id, 'Income Statement', ice.id));
  assert.equal(ice.label('Vocabulary', 'Profit and Loss Statement'), 'Income Statement');
  assert.equal(ice.lookup('Vocabulary', 'Income Statement')?.local, true);
  assert.equal(wine.label('Vocabulary', 'Profit and Loss Statement'), 'Profit and Loss Statement');

  // A renamed account is still the same account.
  ice.post('S-1', [{ account: ice.accountNamed('Cash and Bank').id, amount: 100 }, { account: ice.accountNamed('Rent').id, amount: -100 }]);
  ops.renameByName(ice, 'Cash and Bank', 'Till');
  assert.equal(ice.accountNamed('Till').id, ice.accountNamed('Cash and Bank').id);
  assert.equal(ice.balance(ice.accountNamed('Cash and Bank').id), 100);
});

test('a relation holds a value, another entity, or yes; setting one touches no other', () => {
  const core = fresh();
  const ice = business(core);
  const acme = ops.createContact(ice, 'Acme', 'Provider');
  ice.relate(acme.id, 'Phone', '0412 345 678');
  ice.relate(acme.id, 'Verified', true);
  ice.relate(acme.id, 'Introduced By', ice.user.id);
  ice.relate(acme.id, 'Phone', '0499 000 111');
  assert.equal(core.value(acme.id, 'Phone'), '0499 000 111');
  assert.ok(core.is(acme.id, 'Verified'));
  assert.equal(core.related(acme.id, 'Introduced By')?.name, 'admin');
  ice.relate(acme.id, 'Verified', false);
  assert.equal(core.is(acme.id, 'Verified'), false);
  assert.equal(core.value(acme.id, 'Phone'), '0499 000 111');
  // Going back to an earlier value is allowed.
  ice.relate(acme.id, 'Phone', '0412 345 678');
  assert.equal(core.value(acme.id, 'Phone'), '0412 345 678');
});

test('an entry must add up to zero within each unit, and a refused entry leaves nothing behind', () => {
  const core = fresh();
  const ice = business(core);
  const before = core.store.db.prepare('SELECT COUNT(*) AS n FROM entities').get() as { n: number };
  assert.throws(
    () => ice.store.tx(() => ice.post('BAD', [{ account: ice.accountNamed('Cash and Bank').id, amount: 500 }, { account: ice.accountNamed('Rent').id, amount: -400 }])),
    Refused
  );
  const after = core.store.db.prepare('SELECT COUNT(*) AS n FROM entities').get() as { n: number };
  assert.equal(after.n, before.n);
  assert.deepEqual(core.things(ice.accountsRoot().id), []);

  // Units cannot be balanced with cents.
  ops.createItem(ice, 'Ice');
  const item = ice.item('Ice');
  assert.throws(
    () => ice.store.tx(() => ice.post('MIX', [{ account: ice.quantityAccount('On Hand', { item }).id, amount: 10 }, { account: ice.accountNamed('Cash and Bank').id, amount: -10 }])),
    Refused
  );
  // The reference is still free.
  ice.post('BAD', [{ account: ice.accountNamed('Cash and Bank').id, amount: 500 }, { account: ice.accountNamed('Rent').id, amount: -500 }]);
  assert.throws(() => ice.post('BAD', [{ account: ice.accountNamed('Cash and Bank').id, amount: 1 }, { account: ice.accountNamed('Rent').id, amount: -1 }]), Refused);
});

test('the journal holds only the entry and its date, the account and the amount', () => {
  const core = fresh();
  const ice = business(core);
  const entry = ice.post('S-1', [{ account: ice.accountNamed('Cash and Bank').id, amount: 100 }, { account: ice.accountNamed('Rent').id, amount: -100 }], {
    date: '2026-11-14',
    relations: { Description: 'Saturday market' },
  });
  const columns = (table: string) => (core.store.db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
  assert.deepEqual(columns('journal'), ['entry_id', 'date']);
  assert.deepEqual(columns('journal_line'), ['id', 'entry_id', 'account_id', 'amount']);
  // Reference, description and who posted it are read from the entry entity.
  assert.equal(entry.name, 'S-1');
  assert.equal(core.value(entry.id, 'Description'), 'Saturday market');
  // The business and the ledger are implied by the account.
  for (const line of core.store.entryLines(entry.id)) assert.ok(core.store.within(line.account, ice.ledger.id));
  assert.throws(() => core.store.db.prepare('UPDATE journal_line SET amount = 0').run(), /append-only/);
  assert.throws(() => core.store.db.prepare('DELETE FROM entities').run(), /append-only/);
});

test('an entry cannot name an account of another business or ledger', () => {
  const core = fresh();
  const ice = business(core);
  const wine = business(core, 'Wine');
  const theirs = wine.store.tx(() => wine.accountNamed('Cash and Bank'));
  assert.throws(() => ice.store.tx(() => ice.post('X', [{ account: theirs.id, amount: 5 }, { account: ice.accountNamed('Rent').id, amount: -5 }])), Refused);
  // The same reference is free in each business.
  for (const inst of [ice, wine]) {
    inst.post('S-1', [{ account: inst.accountNamed('Cash and Bank').id, amount: 5 }, { account: inst.accountNamed('Rent').id, amount: -5 }]);
  }
  assert.equal(ice.balance(ice.accountNamed('Cash and Bank').id), 5);
});

test('a locked ledger refuses dates on or before the lock', () => {
  const core = fresh();
  const ice = business(core);
  const lines = () => [{ account: ice.accountNamed('Cash and Bank').id, amount: 100 }, { account: ice.accountNamed('Rent').id, amount: -100 }];
  ops.lockLedger(ice, '2026-06-30');
  assert.throws(() => ice.store.tx(() => ice.post('A', lines(), { date: '2026-06-30' })), Refused);
  ice.store.tx(() => ice.post('B', lines(), { date: '2026-07-01' }));
  ops.lockLedger(ice, null);
  ice.store.tx(() => ice.post('A', lines(), { date: '2026-06-30' }));
});

test('a service item is ordered and sold, never stocked', () => {
  const core = fresh();
  const ice = business(core);
  ops.createItem(ice, 'Delivery', false);
  ops.createItem(ice, 'Ice');
  assert.throws(() => ops.receiveStock(ice, 'R-1', 'Delivery', undefined, 1), Refused);
  assert.throws(() => ops.writeOff(ice, 'Delivery', 1), Refused);
  assert.throws(() => ops.stockTake(ice, 'Delivery', 1), Refused);
  ops.sell(ice, { item: 'Delivery', quantity: 2, unitMinor: 1500 });
  assert.equal(reports.profitAndLoss(ice).total_income_minor, 3000);
  // Stock that is not there cannot be sold.
  assert.throws(() => ops.sell(ice, { item: 'Ice', quantity: 1, unitMinor: 200 }), Refused);
});

test('buying and selling on credit, tax, and payment', () => {
  const core = fresh();
  const ice = business(core);
  ops.createItem(ice, 'Ice');
  ops.createContact(ice, 'Polar Supplies', 'Provider');
  ops.createContact(ice, 'Riverside Cafe', 'Customer');
  ops.purchase(ice, { item: 'Ice', quantity: 10, unitMinor: 100, counterparty: 'Polar Supplies', taxMinor: 100 });
  ops.sell(ice, { item: 'Ice', quantity: 10, unitMinor: 200, counterparty: 'Riverside Cafe', taxMinor: 200 });
  const supplier = ice.contactAccount(ice.contact('Polar Supplies'));
  const customer = ice.contactAccount(ice.contact('Riverside Cafe'));
  assert.equal(ice.typeOf(supplier.id), 'Liability');
  assert.equal(ice.typeOf(customer.id), 'Asset');
  assert.equal(ice.balance(supplier.id), -1100);
  assert.equal(ice.balance(customer.id), 2200);
  ops.payment(ice, 'Riverside Cafe', 2200);
  ops.payment(ice, 'Polar Supplies', 1100);
  assert.equal(ice.balance(supplier.id), 0);
  assert.equal(ice.balance(customer.id), 0);
  assert.equal(ice.balance(ice.accountNamed('Cash and Bank').id), 1100);
  assert.ok(reports.balanceSheet(ice).balanced);
});

test('an order is a commitment; a delivery related to it releases it', () => {
  const core = fresh();
  const ice = business(core);
  ops.createItem(ice, 'Ice');
  ops.createContact(ice, 'Polar Supplies', 'Provider');
  ops.placePurchaseOrder(ice, 'PO-1', 'Polar Supplies', 'Ice', 100, 10000);
  // Placing an order changes nothing the business reports.
  assert.equal(reports.trialBalance(ice).total_debit_minor, 0);
  assert.equal(ops.onOrder(ice, 'Ice'), 100);
  const delivery = ops.purchase(ice, { item: 'Ice', quantity: 60, unitMinor: 100, counterparty: 'Polar Supplies', order: 'PO-1' });
  assert.equal(ops.onOrder(ice, 'Ice'), 40);
  assert.equal(core.related(delivery.id, 'Order')?.name, 'PO-1');
});

test('write-off, stock-take and reversal', () => {
  const core = fresh();
  const ice = business(core);
  ops.createItem(ice, 'Ice');
  ops.purchase(ice, { item: 'Ice', quantity: 10, unitMinor: 100 });
  ops.writeOff(ice, 'Ice', 2);
  assert.deepEqual(accountNames(ice, 'Write-offs'), ['Ice']);
  assert.equal(reports.profitAndLoss(ice).total_expense_minor, 200);
  // The count finds one more than the books: on hand is set to the count.
  const take = ops.stockTake(ice, 'Ice', 9, undefined, 'COUNT-1')!;
  assert.equal(ops.stockTake(ice, 'Ice', 9), undefined);
  assert.equal(reports.profitAndLoss(ice).total_expense_minor, 100);
  ops.reverseEntry(ice, take.name);
  assert.equal(reports.profitAndLoss(ice).total_expense_minor, 200);
  assert.throws(() => ops.reverseEntry(ice, take.name), Refused);
});

test('stock leaves first in, first out, at the cost each receipt was bought at', () => {
  const core = fresh();
  const ice = business(core);
  ops.createItem(ice, 'Ice');
  ops.createLocation(ice, { name: 'Home' });
  ops.createLocation(ice, { name: 'Stall' });
  const cogs = () => reports.profitAndLoss(ice).total_expense_minor;
  const inventory = (location: string) => ice.balance(ice.existingProductAccount('Inventory', { item: ice.item('Ice'), location: ice.location(location) })!.id);
  ops.purchase(ice, { item: 'Ice', location: 'Home', quantity: 10, unitMinor: 100 });
  ops.purchase(ice, { item: 'Ice', location: 'Home', quantity: 10, unitMinor: 130 });
  // 12 sold: all 10 of the first receipt, then 2 of the second.
  ops.sell(ice, { item: 'Ice', location: 'Home', quantity: 12, unitMinor: 300 });
  assert.equal(cogs(), 10 * 100 + 2 * 130);
  assert.equal(inventory('Home'), 8 * 130);
  // A transfer carries the cost of the oldest stock at the place it leaves.
  ops.purchase(ice, { item: 'Ice', location: 'Home', quantity: 5, unitMinor: 160 });
  ops.transferStock(ice, 'T-1', 'Ice', 'Home', 'Stall', 9);
  assert.equal(inventory('Stall'), 8 * 130 + 160);
  assert.equal(inventory('Home'), 4 * 160);
  // A write-off, too, takes the oldest first.
  ops.writeOff(ice, 'Ice', 8, 'Stall');
  assert.equal(cogs(), 10 * 100 + 2 * 130 + 8 * 130);
  assert.equal(inventory('Stall'), 160);
  // A part of a receipt takes its share, the last unit carrying the rounding.
  ops.purchase(ice, { item: 'Ice', location: 'Stall', quantity: 3, unitMinor: 0 });
  ice.post('ADJ-1', [
    { account: ice.existingProductAccount('Inventory', { item: ice.item('Ice'), location: ice.location('Stall') })!.id, amount: 100 },
    { account: ice.accountNamed('Cash and Bank').id, amount: -100 },
  ]);
  const before = cogs();
  ops.sell(ice, { item: 'Ice', location: 'Stall', quantity: 2, unitMinor: 300 });
  assert.equal(cogs() - before, 160 + 33);
  ops.sell(ice, { item: 'Ice', location: 'Stall', quantity: 2, unitMinor: 300 });
  assert.equal(cogs() - before, 160 + 100);
  assert.equal(inventory('Stall'), 0);
  assert.ok(reports.balanceSheet(ice).balanced);
});

test('the year-end stock take averages the cost of what is held, and the new ledger starts from it', () => {
  const core = fresh();
  const ice = business(core);
  ops.createItem(ice, 'Ice');
  const inventory = (inst: Instance) => inst.balance(inst.existingProductAccount('Inventory', { item: inst.item('Ice') })!.id);
  ops.purchase(ice, { item: 'Ice', quantity: 10, unitMinor: 100, date: '2027-05-01' });
  ops.purchase(ice, { item: 'Ice', quantity: 10, unitMinor: 160, date: '2027-06-01' });
  ops.sell(ice, { item: 'Ice', quantity: 5, unitMinor: 300, date: '2027-06-15' });
  // Held: 5 at $1.00 and 10 at $1.60, $21.00 in all, an average of $1.40.
  assert.equal(inventory(ice), 2100);
  // One is missing at the count: it goes at the average, not the oldest cost.
  const count = ops.stockTake(ice, 'Ice', 14, undefined, undefined, { yearEnd: true, date: '2027-06-30' })!;
  assert.equal(ice.core.value(count.id, 'Counted'), '14');
  assert.equal(inventory(ice), 2100 - 140);
  // A year-end count that agrees with the books is still recorded.
  assert.ok(ops.stockTake(ice, 'Ice', 14, undefined, 'YE-AGAIN', { yearEnd: true, date: '2027-06-30' }));
  // From the count on, the 14 are one layer at $1.40.
  ops.sell(ice, { item: 'Ice', quantity: 2, unitMinor: 300, date: '2027-06-30' });
  assert.equal(inventory(ice), 12 * 140);
  ops.closeBooks(ice, '2027-06-30', 'Retained Earnings');
  ops.createLedger(ice, 'Actual 2027-28');
  ops.rollover(ice, 'Actual 2027-28', '2027-07-01');
  const next = ice.forLedger('Actual 2027-28');
  assert.equal(inventory(next), 12 * 140);
  ops.purchase(next, { item: 'Ice', quantity: 10, unitMinor: 200, date: '2027-07-02' });
  // The new year issues the brought-forward stock first, at its average.
  ops.sell(next, { item: 'Ice', quantity: 13, unitMinor: 300, date: '2027-07-03' });
  assert.equal(reports.profitAndLoss(next).total_expense_minor, 12 * 140 + 200);
  assert.ok(reports.balanceSheet(next).balanced);
});

test('the year-end count is per item per location, confirmed by hand or automatically', () => {
  const core = fresh();
  const ice = business(core);
  ops.createItem(ice, 'Ice');
  ops.createItem(ice, 'Cups');
  ops.createLocation(ice, { name: 'Home' });
  ops.createLocation(ice, { name: 'Stall' });
  ops.purchase(ice, { item: 'Ice', location: 'Home', quantity: 10, unitMinor: 100 });
  ops.purchase(ice, { item: 'Ice', location: 'Stall', quantity: 4, unitMinor: 100 });
  ops.purchase(ice, { item: 'Cups', location: 'Stall', quantity: 50, unitMinor: 10 });
  const sheet = () => ops.stockTakeSheet(ice, '2027-06-30').map((l) => `${l.item}@${l.location}=${l.onHand}/${l.counted ?? '-'}`);
  assert.deepEqual(sheet(), ['Ice@Home=10/-', 'Ice@Stall=4/-', 'Cups@Stall=50/-']);
  // Counted at the stall's terminal: three ice short; the cups as booked.
  ops.confirmCount(ice, 'Ice', 'Stall', 1, '2027-06-30');
  ops.confirmCount(ice, 'Cups', 'Stall', undefined, '2027-06-30');
  assert.deepEqual(sheet(), ['Ice@Home=10/-', 'Ice@Stall=1/1', 'Cups@Stall=50/50']);
  // The rest at the books' quantities; nothing left to confirm after.
  assert.equal(ops.completeYearEndStockTake(ice, '2027-06-30'), 1);
  assert.equal(ops.completeYearEndStockTake(ice, '2027-06-30'), 0);
  assert.deepEqual(sheet(), ['Ice@Home=10/10', 'Ice@Stall=1/1', 'Cups@Stall=50/50']);
  assert.equal(reports.profitAndLoss(ice).total_expense_minor, 300);
  assert.throws(() => ops.completeYearEndStockTake(ice, '30/06/2027'), Refused);
});

test('a count confirmed after the new year opened corrects both ledgers', () => {
  const core = fresh();
  const ice = business(core);
  ops.createItem(ice, 'Ice');
  ops.purchase(ice, { item: 'Ice', quantity: 10, unitMinor: 100, date: '2027-05-01' });
  ops.purchase(ice, { item: 'Ice', quantity: 10, unitMinor: 160, date: '2027-06-01' });
  ops.sell(ice, { item: 'Ice', quantity: 5, unitMinor: 300, date: '2027-06-15' });
  const oldProfit = reports.profitAndLoss(ice).net_income_minor;
  // The year is closed and the new one opened at the books' 15 ($21.00).
  ops.closeBooks(ice, '2027-06-30', 'Retained Earnings');
  ops.createLedger(ice, 'Actual 2027-28');
  ops.rollover(ice, 'Actual 2027-28', '2027-07-01');
  const next = ice.forLedger('Actual 2027-28');
  const item = next.item('Ice');
  const onHand = (inst: Instance) => inst.balance(inst.existingQuantityAccount('On Hand', { item })!.id);
  const inventory = (inst: Instance) => inst.balance(inst.existingProductAccount('Inventory', { item })!.id);
  // Trading carries on in the new ledger before the count comes in.
  ops.sell(next, { item: 'Ice', quantity: 3, unitMinor: 300, date: '2027-07-02' });
  const newProfit = reports.profitAndLoss(next).net_income_minor;

  // The count, as at the year end: 13, two short, at the average $1.40.
  ops.confirmCount(ice, 'Ice', undefined, 13, '2027-06-30');
  // The old year: two fewer, $2.80 less stock, $2.80 less profit; still closed.
  assert.equal(onHand(ice), 13);
  assert.equal(inventory(ice), 2100 - 280);
  assert.equal(reports.profitAndLoss(ice).net_income_minor, oldProfit - 280);
  assert.equal(reports.balanceSheet(ice).current_earnings_minor, 0);
  assert.ok(reports.balanceSheet(ice).balanced);
  // The new year: its opening stock corrected the same way, against
  // Retained Earnings, so its own profit is untouched.
  assert.equal(onHand(next), 13 - 3);
  assert.equal(inventory(next), 2100 - 280 - 3 * 140);
  assert.equal(reports.profitAndLoss(next).net_income_minor, newProfit);
  assert.ok(reports.balanceSheet(next).balanced);
  // A count found more: written on in both, the same way.
  ops.confirmCount(ice, 'Ice', undefined, 14, '2027-06-30');
  assert.equal(onHand(ice), 14);
  assert.equal(onHand(next), 11);
  assert.equal(reports.profitAndLoss(ice).net_income_minor, oldProfit - 140);
  assert.ok(reports.balanceSheet(next).balanced);
});

test('wages: hourly or salaried, with the two rates as relations of the business', () => {
  const core = fresh();
  const ice = business(core);
  ops.createEmployee(ice, 'Sam');
  assert.throws(() => ops.payWages(ice, 'Sam', 10), Refused);
  ice.relate(ice.contact('Sam').id, 'Wage Per Hour', '3000');
  assert.deepEqual(ops.payWages(ice, 'Sam', 10), { grossMinor: 30000, medicareLevyMinor: 450, superannuationMinor: 3600, netMinor: 29550 });
  assert.equal(ice.balance(ice.contactAccount(ice.contact('Sam')).id), 0);
  ice.relate(ice.business.id, 'Superannuation Rate', '0.10');
  assert.equal(ops.payWages(ice, 'Sam', 10).superannuationMinor, 3000);
  assert.ok(reports.balanceSheet(ice).balanced);
});

test('closing the books, then a new ledger with its own accounts', () => {
  const core = fresh();
  const ice = business(core);
  ops.createItem(ice, 'Ice');
  ops.purchase(ice, { item: 'Ice', quantity: 10, unitMinor: 100 });
  ops.sell(ice, { item: 'Ice', quantity: 6, unitMinor: 300 });
  const net = reports.profitAndLoss(ice).net_income_minor;
  ops.closeBooks(ice, '2027-06-30', 'Retained Earnings');
  // The year's profit reads the same after its books are closed.
  assert.equal(reports.profitAndLoss(ice).net_income_minor, net);
  assert.equal(reports.balanceSheet(ice, '2027-06-30').current_earnings_minor, 0);

  ops.createLedger(ice, 'Actual 2027-28');
  ops.rollover(ice, 'Actual 2027-28', '2027-07-01');
  const next = ice.forLedger('Actual 2027-28');
  assert.equal(reports.profitAndLoss(next).total_income_minor, 0);
  assert.ok(reports.balanceSheet(next).balanced);
  assert.deepEqual(reports.inventoryListing(next), []);
  // Stock on hand came forward; each ledger has its own accounts.
  const item = next.item('Ice');
  assert.equal(next.balance(next.existingQuantityAccount('On Hand', { item })!.id), 4);
  assert.notEqual(next.accountNamed('Cash and Bank').id, ice.accountNamed('Cash and Bank').id);
  const before = reports.trialBalance(ice).total_debit_minor;
  ops.sell(next, { item: 'Ice', quantity: 4, unitMinor: 300 });
  assert.equal(reports.trialBalance(ice).total_debit_minor, before);
});

test('copy makes an independent instance of a prototype', () => {
  const core = fresh();
  const ice = business(core);
  const esky = ops.createPrototype(ice, 'Esky Pack');
  ops.setLine(ice, esky, { component: 'Ice', kind: 'Material', quantity: 2, unit: 'bag', priceMinor: 400 });
  const job = ice.create('Job 1', ice.business.id);
  ice.copy(esky.id, job.id);
  ops.setLine(ice, esky, { component: 'Ice', quantity: 3 });
  assert.equal(ops.getLines(ice, job)[0].quantity, 2);
  assert.equal(ops.getLines(ice, esky)[0].quantity, 3);
  assert.equal(ops.getLines(ice, esky)[0].priceMinor, 400);
});

test('reopening the store rebuilds the same state from the two tables', () => {
  const file = path.join(os.tmpdir(), `sql-ledger-ts-core-${process.pid}-reopen.sqlite`);
  fs.rmSync(file, { force: true });
  let core = new Core(file);
  let ice = business(core);
  ops.createItem(ice, 'Ice');
  ops.purchase(ice, { item: 'Ice', quantity: 5, unitMinor: 100 });
  core.close();
  core = new Core(file);
  ice = core.open('admin', 'Ice');
  assert.equal(reports.trialBalance(ice).total_debit_minor, 500);
  ops.sell(ice, { item: 'Ice', quantity: 5, unitMinor: 200 });
  assert.equal(reports.profitAndLoss(ice).net_income_minor, 500);
});
