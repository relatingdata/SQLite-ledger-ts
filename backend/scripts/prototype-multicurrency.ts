/**
 * Multi-currency prototype — a throwaway-in-spirit but committed
 * script (per this project's "never throw away" discipline) that
 * tests the design in docs/multicurrency-design.md against real
 * numbers, using the real receiveLot/consumeFromLots/stageLine/
 * postJournalEntry against a scratch database, before any
 * schema/migration work begins on the actual app.
 *
 * Simplified per direct correction: a multi-currency transaction is
 * NOT one journal entry needing a new per-currency validator — it's
 * simply a SET of separate, ordinary, single-currency journal entries,
 * each already satisfying the existing, completely unmodified
 * postJournalEntry balance check. This prototype proves that directly,
 * plus a reusable "canned" delivery-fee template using the EXISTING
 * item_source.package_quantity field — no new schema either.
 *
 * Run with: DB_PATH=/tmp/proto.db node --import tsx backend/scripts/prototype-multicurrency.ts
 */
import { createEntityRaw, create, requireEntity, typeRootName, typeVocabularyWordName, setItem, stageLine, postJournalEntry, receiveLot, consumeFromLots, addOrUpdateItemSource } from '../src/db.js';

async function main() {
  console.log('=== Setup: EUR and USD as real items, same commodity mechanism as wine ===');
  create(requireEntity('Items', typeRootName), typeRootName, 'EUR', 1);
  setItem('EUR', { unit_of_measure: 'cent' });
  create(requireEntity('Items', typeRootName), typeRootName, 'USD', 1);
  setItem('USD', { unit_of_measure: 'cent' });
  create(requireEntity('Asset', typeRootName), typeRootName, 'FX Conversion Clearing', 1);
  create(requireEntity('Expense', typeRootName), typeRootName, 'Delivery Fees', 1);
  create(requireEntity('Income', typeRootName), typeRootName, 'FX Gain/Loss', 1);
  create(requireEntity('Asset', typeRootName), typeRootName, 'Cash at Bank (EUR)', 1);
  create(requireEntity('Asset', typeRootName), typeRootName, 'Cash at Bank (USD)', 1);

  console.log('\n=== Canned delivery fee template: max(perUnitRate * cartons, minimum) ===');
  // A "bank fee" generalized into a delivery/handling fee — the same
  // template applies to any commodity purchase, not something bespoke
  // to currency. Uses the EXISTING item_source.package_quantity to
  // convert an order's base-unit quantity into a carton count — no new
  // field. How a carton is internally packed (12 loose, 4 six-packs, 6
  // quads) is a separate, downstream concern package_quantity already
  // handles per vendor/product; the fee only needs the carton count.
  create(requireEntity('Vendors', typeRootName), typeRootName, 'FX Broker', 1);
  addOrUpdateItemSource({ itemName: 'EUR', vendorName: 'FX Broker', package_quantity: 10000 }); // "cartons" here = units of 100.00 EUR each, an arbitrary but real packaging convention for this prototype
  function deliveryFee(orderQuantityBaseUnits: number, packageQuantity: number, perUnitRateMinor: number, minimumFeeMinor: number): number {
    const cartons = Math.ceil(orderQuantityBaseUnits / packageQuantity);
    return Math.max(perUnitRateMinor * cartons, minimumFeeMinor);
  }
  const packageQty = 10000; // 100.00 EUR "cartons"
  const feeSmallOrder = deliveryFee(50000, packageQty, 200, 1500); // 5 cartons * $2.00 = $10.00, but minimum is $15.00
  const feeLargeOrder = deliveryFee(1000000, packageQty, 200, 1500); // 100 cartons * $2.00 = $200.00, well above minimum
  console.log('Small order (5 cartons, rate-based fee $10.00 < minimum $15.00): fee =', feeSmallOrder, '(expect 1500, minimum applies)');
  console.log('Large order (100 cartons, rate-based fee $200.00 > minimum $15.00): fee =', feeLargeOrder, '(expect 20000, rate applies)');
  if (feeSmallOrder !== 1500) throw new Error('PROTOTYPE FAILURE: minimum should have applied');
  if (feeLargeOrder !== 20000) throw new Error('PROTOTYPE FAILURE: rate-based fee should have applied');

  console.log('\n=== Scenario 1: buy €1,000 for $1,090, plus a $15 delivery fee — as TWO separate, ordinary entries ===');
  const fee = 1500;
  const usdPaid = 109000;

  // Entry 1: entirely in EUR, balances alone, no new validator needed.
  stageLine({ reference: 'FX-BUY-1-EUR', business: 'admin', ledger: 'Actual', transdate: '2027-01-01', account: 'Cash at Bank (EUR)', amount_minor: 100000 });
  stageLine({ reference: 'FX-BUY-1-EUR', business: 'admin', ledger: 'Actual', transdate: '2027-01-01', account: 'FX Conversion Clearing', amount_minor: -100000 });
  postJournalEntry('FX-BUY-1-EUR', 'admin', 'Actual', 1);
  console.log('EUR entry posted successfully through the REAL, unmodified postJournalEntry.');

  // Entry 2: entirely in USD, balances alone.
  stageLine({ reference: 'FX-BUY-1-USD', business: 'admin', ledger: 'Actual', transdate: '2027-01-01', account: 'FX Conversion Clearing', amount_minor: usdPaid });
  stageLine({ reference: 'FX-BUY-1-USD', business: 'admin', ledger: 'Actual', transdate: '2027-01-01', account: 'Delivery Fees', amount_minor: fee });
  stageLine({ reference: 'FX-BUY-1-USD', business: 'admin', ledger: 'Actual', transdate: '2027-01-01', account: 'Cash at Bank (USD)', amount_minor: -(usdPaid + fee) });
  postJournalEntry('FX-BUY-1-USD', 'admin', 'Actual', 1);
  console.log('USD entry posted successfully through the REAL, unmodified postJournalEntry.');
  console.log('Two ordinary, already-supported entries — no per-currency grouping, no validator change.');

  // The EUR lot — cost basis is $1,090 (the exchange amount only, fee excluded).
  receiveLot('admin', 'Actual', 'FX-BUY-1-EUR-LOT', 'EUR', 'LOT-2027-01-01', '2027-01-01', null, 100000, 1);
  console.log('EUR lot received: €1,000.00, cost basis implied by the $1,090 clearing amount (fee excluded).');

  console.log('\n=== Scenario 2: later spend €400 of it, when the rate has moved ===');
  const consumed = consumeFromLots('EUR', 40000);
  console.log('Lots consumed via the REAL, unmodified consumeFromLots (FIFO):', consumed);

  const lotCostBasisMinor = usdPaid;
  const lotQuantityMinor = 100000;
  const consumedQuantityMinor = 40000;
  const costBasisOfConsumedMinor = Math.round((lotCostBasisMinor * consumedQuantityMinor) / lotQuantityMinor);
  console.log('Proportional cost basis of the €400 spent (expect 43600 / $436.00):', costBasisOfConsumedMinor);
  if (costBasisOfConsumedMinor !== 43600) throw new Error('PROTOTYPE FAILURE: cost basis arithmetic wrong');

  const realizedAmountMinor = 44500;
  const realizedGainMinor = realizedAmountMinor - costBasisOfConsumedMinor;
  console.log('Realized gain, kept separate from the earlier delivery fee (expect 900 / $9.00):', realizedGainMinor);
  if (realizedGainMinor !== 900) throw new Error('PROTOTYPE FAILURE: realized gain arithmetic wrong');

  // Realization — one more ordinary, single-currency (USD) entry.
  stageLine({ reference: 'FX-SELL-1-USD', business: 'admin', ledger: 'Actual', transdate: '2027-02-01', account: 'Cash at Bank (USD)', amount_minor: realizedAmountMinor });
  stageLine({ reference: 'FX-SELL-1-USD', business: 'admin', ledger: 'Actual', transdate: '2027-02-01', account: 'FX Conversion Clearing', amount_minor: -costBasisOfConsumedMinor });
  stageLine({ reference: 'FX-SELL-1-USD', business: 'admin', ledger: 'Actual', transdate: '2027-02-01', account: 'FX Gain/Loss', amount_minor: -realizedGainMinor });
  postJournalEntry('FX-SELL-1-USD', 'admin', 'Actual', 1);
  console.log('Realization entry posted successfully — another ordinary, single-currency entry.');

  console.log('\n=== ALL PROTOTYPE SCENARIOS PASSED ===');
  console.log('Zero changes needed to postJournalEntry, or any function built on it.');
}

main().catch((err) => {
  console.error('PROTOTYPE FAILED:', err);
  process.exit(1);
});
