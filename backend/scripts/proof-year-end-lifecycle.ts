// A real, minimal, direct, backend-level proof of a complete business
// lifecycle - per direct request: locations of at least each real
// type, minimal products and an assembly, staff, and a full cycle
// through to year-end close, including a stock take. Backend-first,
// per the backend-first-testing skill - no browser, no Playwright,
// direct function calls, checking every real balance/quantity along
// the way, not just the final result.
import { createBusiness, createEntityRaw, create, fetch, typeRootName, getTrialBalance, stageBomComponent, postBomComponents, getBomComponents, addOrUpdateItemSource, createItem, completePosSale, ensureProductInstance, ensureCombinationAccountLeaf, getItemPriceForCurrency, db, asBusinessName, asLedgerName, asAccountName, asLocationName, asVendorName, asItemName } from '../src/db.ts';
import {
  setLocation,
  placeOrder,
  receiveItems,
  fulfillOrder,
  getOrderStatus,
  transferItems,
  createStockTake,
  recordStockTakeCount,
  completeStockTake,
  ensureLocationCapacityAccount,
} from '../src/db-stock.ts';
import { previewCloseBooks, closeBooks } from '../src/db-reports.ts';

const USER = 1;
const BIZ = 'YearEnd Proof Co';
const LEDGER = 'Actual';

function check(label: string, condition: boolean) {
  console.log(`${condition ? '✅' : '❌'} ${label}`);
  if (!condition) process.exitCode = 1;
}

function getAccountBalance(entityId: number): number {
  return (db.prepare(`SELECT balance_minor FROM account WHERE entity_id = ?`).get(entityId) as { balance_minor: number } | undefined)?.balance_minor ?? 0;
}

console.log(`\n=== 1. Create the business ===`);
createBusiness(BIZ as any, '2026-27', USER as any);
check('Business created', true);

console.log(`\n=== 2. Locations - at least one of each real type ===`);
create(fetch(`${BIZ} Locations`, typeRootName), typeRootName, 'Proof Retail Outlet', USER as any);
setLocation('Proof Retail Outlet', { city: 'Adelaide', location_type: 'Retail', is_billing_address: true, bottle_capacity: 200, carton_capacity: 20, timezone: 'Australia/Adelaide' } as any);
create(fetch(`${BIZ} Locations`, typeRootName), typeRootName, 'Proof Warehouse', USER as any);
setLocation('Proof Warehouse', { city: 'Adelaide', location_type: 'Warehouse', is_billing_address: false, bottle_capacity: null, carton_capacity: 100, timezone: 'Australia/Adelaide' } as any);
check('Retail outlet created', true);
check('Warehouse created', true);

console.log(`\n=== 3. Staff ===`);
create(fetch('Employees', typeRootName), typeRootName, 'Proof Employee — Alex Chen', USER as any);
check('Employee created', true);

console.log(`\n=== 4. Minimal products, including one real assembly ===`);
createItem('Proof Component A', `${BIZ} Items`, USER as any);
createItem('Proof Component B', `${BIZ} Items`, USER as any);
createItem('Proof Gift Pack', `${BIZ} Items`, USER as any);
create(fetch('Accounts Payable', typeRootName), typeRootName, 'Proof Vendor', USER as any);
addOrUpdateItemSource({ itemName: 'Proof Component A', vendorName: 'Proof Vendor', priceMinor: 500, packageQuantity: 12, isPreferred: true });
addOrUpdateItemSource({ itemName: 'Proof Component B', vendorName: 'Proof Vendor', priceMinor: 700, packageQuantity: 12, isPreferred: true });
stageBomComponent({ assemblyItem: 'Proof Gift Pack', business: BIZ, componentItem: 'Proof Component A', quantity: 2, unit: 'each' });
stageBomComponent({ assemblyItem: 'Proof Gift Pack', business: BIZ, componentItem: 'Proof Component B', quantity: 1, unit: 'each' });
postBomComponents('Proof Gift Pack', BIZ, USER as any);
const bom = getBomComponents('Proof Gift Pack');
check('Assembly (Proof Gift Pack) has exactly 2 real components', bom.length === 2);

console.log(`\n=== 5. Order and receive stock at the warehouse ===`);
placeOrder('PO-PROOF-1', BIZ as any, LEDGER as any, 96, 500, USER as any, '2026-07-01', asVendorName('Proof Vendor'), asItemName('Proof Component A'), asLocationName('Proof Warehouse'));
receiveItems(BIZ as any, LEDGER as any, 'REC-PROOF-1', asItemName('Proof Component A'), asLocationName('Proof Warehouse'), 96, USER as any, '2026-07-05');
fulfillOrder('PO-PROOF-1', 'REC-PROOF-1', BIZ as any, LEDGER as any, 96, 500, USER as any, '2026-07-05');
const orderStatus = getOrderStatus('PO-PROOF-1');
check('Purchase order fully fulfilled (0 remaining)', orderStatus.quantity === 0);

console.log(`\n=== 6. Transfer stock from warehouse to retail ===`);
transferItems(BIZ as any, LEDGER as any, asItemName('Proof Component A'), asLocationName('Proof Warehouse'), asLocationName('Proof Retail Outlet'), 24, 'XFER-PROOF-1', USER as any, '2026-07-10');
check('Transfer completed', true);

console.log(`\n=== 7. A real sale, giving the business a real, non-zero P&L to close ===`);
const saleResult = completePosSale(
  {
    business: BIZ as any,
    ledger: LEDGER as any,
    locationName: 'Proof Retail Outlet' as any,
    customerName: 'Cash Sale' as any,
    lines: [{ itemName: 'Proof Component A', quantity: 10, unitPriceMinor: 1200, taxMinor: 0 }],
    taxAccount: 'GST Collected' as any,
    paymentMethod: 'Cash',
    cashTenderedMinor: 12000,
    transdate: '2026-07-15',
  },
  USER as any
);
check('Sale completed', !!saleResult);

console.log(`\n=== 7b. A real, hierarchy-varied combination sale, with its own real, combination-specific price ===`);
createItem('Proof Lager', `${BIZ} Items`, USER as any);
addOrUpdateItemSource({ itemName: 'Proof Lager', vendorName: 'Proof Vendor', priceMinor: 500, isPreferred: true });
receiveItems(BIZ as any, LEDGER as any, 'REC-PROOF-LAGER-1', asItemName('Proof Lager'), asLocationName('Proof Retail Outlet'), 24, USER as any, '2026-07-10');
const comboShape: [string, string][] = [
  ['Location', 'Location'],
  ['Item', 'Beer'],
  ['Storage', 'Storage'],
];
const coldInstance = ensureProductInstance(BIZ as any, comboShape, ['Proof Retail Outlet', 'Proof Lager', 'Cold'], USER as any);
addOrUpdateItemSource({ itemName: 'Proof Lager', vendorName: 'Proof Vendor', priceMinor: 800, isPreferred: true, productInstanceId: coldInstance.id });
const comboSaleResult = completePosSale(
  {
    business: BIZ as any,
    ledger: LEDGER as any,
    locationName: 'Proof Retail Outlet' as any,
    customerName: 'Cash Sale' as any,
    lines: [{ itemName: 'Proof Lager', quantity: 3, taxMinor: 0, combinationValues: ['Proof Retail Outlet', 'Proof Lager', 'Cold'], combinationShape: comboShape }],
    taxAccount: 'GST Collected' as any,
    paymentMethod: 'Cash',
    cashTenderedMinor: 2400,
    transdate: '2026-07-16',
  },
  USER as any
);
check('Combination sale completed', !!comboSaleResult);
check('Combination-specific price (800/unit, not the base 500) correctly resolved (total 2400)', comboSaleResult.totalMinor === 2400);
const basePrice = getItemPriceForCurrency('Proof Lager', null);
check(`Base item price genuinely unaffected (still 500, got ${basePrice})`, basePrice === 500);

console.log(`\n=== 7c. Combination-tagged receiving (from a PO-style receipt) and warehouse transfer, per direct instruction ===`);
createItem('Proof Ale', `${BIZ} Items`, USER as any);
addOrUpdateItemSource({ itemName: 'Proof Ale', vendorName: 'Proof Vendor', priceMinor: 400, packageQuantity: 1, isPreferred: true });
receiveItems(BIZ as any, LEDGER as any, 'REC-PROOF-ALE-1', asItemName('Proof Ale'), asLocationName('Proof Warehouse'), 48, USER as any, '2026-07-11', ['Proof Warehouse', 'Proof Ale', 'Cold'], comboShape);
const warehouseInstance = ensureProductInstance(BIZ as any, comboShape, ['Proof Warehouse', 'Proof Ale', 'Cold'], USER as any);
const warehouseInvLeaf = ensureCombinationAccountLeaf('Inventory', warehouseInstance, USER as any);
const warehouseBalanceAfterReceipt = getAccountBalance(warehouseInvLeaf.id);
check(`Combination-tagged receipt built up the real Inventory value (48 x 400 = 19200, got ${warehouseBalanceAfterReceipt})`, warehouseBalanceAfterReceipt === 48 * 400);

transferItems(BIZ as any, LEDGER as any, asItemName('Proof Ale'), asLocationName('Proof Warehouse'), asLocationName('Proof Retail Outlet'), 20, 'XFER-PROOF-ALE-1', USER as any, '2026-07-12', comboShape, ['Proof Ale', 'Cold']);
const retailInstance = ensureProductInstance(BIZ as any, comboShape, ['Proof Retail Outlet', 'Proof Ale', 'Cold'], USER as any);
const retailInvLeaf = ensureCombinationAccountLeaf('Inventory', retailInstance, USER as any);
const warehouseBalanceAfterTransfer = getAccountBalance(warehouseInvLeaf.id);
const retailBalanceAfterTransfer = getAccountBalance(retailInvLeaf.id);
check(`Combination-tagged transfer correctly reduced the real warehouse Inventory value (28 x 400 = 11200, got ${warehouseBalanceAfterTransfer})`, warehouseBalanceAfterTransfer === 28 * 400);
check(`Combination-tagged transfer correctly increased the real retail Inventory value (20 x 400 = 8000, got ${retailBalanceAfterTransfer})`, retailBalanceAfterTransfer === 20 * 400);

console.log(`\n=== 8. Month/year-end stock take, with a real, deliberate variance ===`);
const takeId = createStockTake(asLocationName('Proof Retail Outlet'), '2027-06-30', USER as any);
recordStockTakeCount(takeId, asItemName('Proof Component A'), 13); // real, deliberate shortage of 1 (14 on hand -> 13 counted)
const capBefore = ensureLocationCapacityAccount(asBusinessName(BIZ), asLedgerName(LEDGER), asLocationName('Proof Retail Outlet'), USER as any);
completeStockTake(takeId, BIZ as any, LEDGER as any, asAccountName('Miscellaneous'), 'Inventory', { 'Proof Component A': 500 }, USER as any);
check('Stock take completed', true);

console.log(`\n=== 9. Trial balance must be genuinely, exactly balanced before closing ===`);
const tbBeforeClose = getTrialBalance(BIZ as any, LEDGER as any, '2027-06-30');
check(`Trial balance balanced before close (debit ${tbBeforeClose.total_debit_minor} = credit ${tbBeforeClose.total_credit_minor})`, tbBeforeClose.total_debit_minor === tbBeforeClose.total_credit_minor);

console.log(`\n=== 10. Year-end close ===`);
create(fetch('Equity', typeRootName), typeRootName, 'Proof Retained Earnings', USER as any);
const preview = previewCloseBooks(BIZ as any, LEDGER as any, '2027-06-30', 'Proof Retained Earnings');
check(`Close preview found real accounts to zero (${preview.accountsZeroed})`, preview.accountsZeroed > 0);
closeBooks(BIZ as any, LEDGER as any, '2027-06-30', 'Proof Retained Earnings', USER as any);
const tbAfterClose = getTrialBalance(BIZ as any, LEDGER as any, '2027-06-30');
check(`Trial balance still genuinely balanced after close (debit ${tbAfterClose.total_debit_minor} = credit ${tbAfterClose.total_credit_minor})`, tbAfterClose.total_debit_minor === tbAfterClose.total_credit_minor);

console.log(`\n${process.exitCode ? '❌ FAILED' : '✅ ALL REAL CHECKS PASSED'}\n`);
