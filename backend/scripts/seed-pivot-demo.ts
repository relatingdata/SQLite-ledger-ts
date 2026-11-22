// Demo data for the pivots (Sales and Margin, Stock on Hand): a business,
// "Pivot Demo Wines", with three wines bought at two prices and sold
// unevenly at three shops. Run with `make seed-pivot-demo` while the
// servers are stopped or running; it adds to the dev database.
// Full documentation: docs/pm-application-config.md.
const db = await import('../src/db.ts');
const userId = db.asUserId(1);
const business = db.asBusinessName('Pivot Demo Wines');
if (db.getBusinesses().some((b) => b.name === business)) {
  console.log(`${business} is already there.`);
  process.exit(0);
}
const { actualLedger: ledger } = db.createBusiness(business, '2026-27', userId, 'English CoA');
const shops = ['Riverside', 'Uptown', 'Harbour'].map((name) => {
  db.createAndConfigureLocation(business, name, { city: 'Brisbane', location_type: 'Retail', is_billing_address: false, bottle_capacity: 1000, carton_capacity: 100, timezone: 'Australia/Brisbane' } as never, userId);
  return name;
});
const wines = ['Shiraz', 'Riesling', 'Pinot Noir'];
for (const wine of wines) db.createItem(wine, 'Items', userId, business);
const buy = (shop: string, unitPrices: number[], date: string) =>
  db.completeCashPurchase({ business, ledger, locationName: shop, vendorName: db.asProviderName('Cash'), lines: wines.map((itemName, i) => ({ itemName, quantity: 60, unitPriceMinor: unitPrices[i], taxMinor: 0 })), taxAccount: db.asAccountName('Sales Tax Payable'), paymentMethod: 'cash', transdate: date } as never, userId);
for (const shop of shops) {
  buy(shop, [1000, 1100, 1200], '2026-08-01');
  buy(shop, [1200, 1150, 1500], '2026-09-01');
}
// Units sold [shop][wine]; each shop prices a little differently.
const sold = [
  [70, 15, 30],
  [12, 45, 6],
  [25, 25, 80],
];
const price = [2200, 1800, 2600];
shops.forEach((shop, s) => {
  db.completePosSale({ business, ledger, locationName: shop, customerName: db.asCustomerName('Cash'), lines: wines.map((itemName, w) => ({ itemName, quantity: sold[s][w], unitPriceMinor: price[w] + s * 150, taxMinor: 0 })), taxAccount: db.asAccountName('Sales Tax Payable'), paymentMethod: 'cash', transdate: '2026-10-15' } as never, userId);
});
console.log(`Added ${business}: ${wines.join(', ')} at ${shops.join(', ')}.`);

export {};
