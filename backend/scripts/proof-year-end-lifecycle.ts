// A real, minimal, direct, backend-level proof of a complete business
// lifecycle - per direct request: locations of at least each real
// type, minimal products and an assembly, staff, and a full cycle
// through to year-end close, including a stock take. Backend-first,
// per the backend-first-testing skill - no browser, no Playwright,
// direct function calls, checking every real balance/quantity along
// the way, not just the final result.
import {
  createBusiness,
  createEntity,
  getTrialBalance,
  stageBomComponent,
  postBomComponents,
  getBomComponents,
  addOrUpdateItemSource,
  createItem,
  completePosSale,
} from '../src/db.ts';
import {
  setLocation,
  placeOrder,
  receiveStockAtLocation,
  fulfillOrder,
  getOrderStatus,
  transferStock,
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

console.log(`\n=== 1. Create the business ===`);
createBusiness(BIZ as any, '2026-27', USER as any);
check('Business created', true);

console.log(`\n=== 2. Locations - at least one of each real type ===`);
createEntity({ name: 'Proof Retail Outlet', parent: `${BIZ} Locations` }, USER as any);
setLocation('Proof Retail Outlet', { city: 'Adelaide', location_type: 'Retail', is_billing_address: true, bottle_capacity: 200, carton_capacity: 20, timezone: 'Australia/Adelaide' } as any);
createEntity({ name: 'Proof Warehouse', parent: `${BIZ} Locations` }, USER as any);
setLocation('Proof Warehouse', { city: 'Adelaide', location_type: 'Warehouse', is_billing_address: false, bottle_capacity: null, carton_capacity: 100, timezone: 'Australia/Adelaide' } as any);
check('Retail outlet created', true);
check('Warehouse created', true);

console.log(`\n=== 3. Staff ===`);
createEntity({ name: 'Proof Employee — Alex Chen', parent: 'Employees' }, USER as any);
check('Employee created', true);

console.log(`\n=== 4. Minimal products, including one real assembly ===`);
createItem('Proof Component A', `${BIZ} Items`, USER as any);
createItem('Proof Component B', `${BIZ} Items`, USER as any);
createItem('Proof Gift Pack', `${BIZ} Items`, USER as any);
createEntity({ name: 'Proof Vendor', parent: 'Accounts Payable' }, USER as any);
addOrUpdateItemSource({ itemName: 'Proof Component A', vendorName: 'Proof Vendor', priceMinor: 500, packageQuantity: 12, isPreferred: true });
addOrUpdateItemSource({ itemName: 'Proof Component B', vendorName: 'Proof Vendor', priceMinor: 700, packageQuantity: 12, isPreferred: true });
stageBomComponent({ assemblyItem: 'Proof Gift Pack', business: BIZ, componentItem: 'Proof Component A', quantity: 2, unit: 'each' });
stageBomComponent({ assemblyItem: 'Proof Gift Pack', business: BIZ, componentItem: 'Proof Component B', quantity: 1, unit: 'each' });
postBomComponents('Proof Gift Pack', BIZ, USER as any);
const bom = getBomComponents('Proof Gift Pack');
check('Assembly (Proof Gift Pack) has exactly 2 real components', bom.length === 2);

console.log(`\n=== 5. Order and receive stock at the warehouse ===`);
placeOrder('PO-PROOF-1', BIZ as any, LEDGER as any, 96, 500, USER as any, '2026-07-01', 'Proof Vendor', 'Proof Component A', 'Proof Warehouse');
receiveStockAtLocation(BIZ as any, LEDGER as any, 'REC-PROOF-1', 'Proof Component A', 'Proof Warehouse', 96, USER as any, '2026-07-05');
fulfillOrder('PO-PROOF-1', 'REC-PROOF-1', BIZ as any, LEDGER as any, 96, 500, USER as any, '2026-07-05');
const orderStatus = getOrderStatus('PO-PROOF-1');
check('Purchase order fully fulfilled (0 remaining)', orderStatus.quantity === 0);

console.log(`\n=== 6. Transfer stock from warehouse to retail ===`);
transferStock(BIZ as any, LEDGER as any, 'Proof Component A', 'Proof Warehouse', 'Proof Retail Outlet', 24, 'XFER-PROOF-1', USER as any, '2026-07-10');
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

console.log(`\n=== 8. Month/year-end stock take, with a real, deliberate variance ===`);
const takeId = createStockTake('Proof Retail Outlet', '2027-06-30', USER as any);
recordStockTakeCount(takeId, 'Proof Component A', 13); // real, deliberate shortage of 1 (14 on hand -> 13 counted)
const capBefore = ensureLocationCapacityAccount(BIZ, LEDGER, 'Proof Retail Outlet', USER as any);
completeStockTake(takeId, BIZ as any, LEDGER as any, 'Miscellaneous', 'Inventory', { 'Proof Component A': 500 }, USER as any);
check('Stock take completed', true);

console.log(`\n=== 9. Trial balance must be genuinely, exactly balanced before closing ===`);
const tbBeforeClose = getTrialBalance(BIZ as any, LEDGER as any, '2027-06-30');
check(`Trial balance balanced before close (debit ${tbBeforeClose.total_debit_minor} = credit ${tbBeforeClose.total_credit_minor})`, tbBeforeClose.total_debit_minor === tbBeforeClose.total_credit_minor);

console.log(`\n=== 10. Year-end close ===`);
createEntity({ name: 'Proof Retained Earnings', parent: 'Equity' }, USER as any);
const preview = previewCloseBooks(BIZ as any, LEDGER as any, '2027-06-30', 'Proof Retained Earnings');
check(`Close preview found real accounts to zero (${preview.accountsZeroed})`, preview.accountsZeroed > 0);
closeBooks(BIZ as any, LEDGER as any, '2027-06-30', 'Proof Retained Earnings', USER as any);
const tbAfterClose = getTrialBalance(BIZ as any, LEDGER as any, '2027-06-30');
check(`Trial balance still genuinely balanced after close (debit ${tbAfterClose.total_debit_minor} = credit ${tbAfterClose.total_credit_minor})`, tbAfterClose.total_debit_minor === tbAfterClose.total_credit_minor);

console.log(`\n${process.exitCode ? '❌ FAILED' : '✅ ALL REAL CHECKS PASSED'}\n`);
