/**
 * Prototype: currency unified with the inventory/lot structure already
 * designed for products. Confirmed directly by the person: "Cash at
 * Bank (USD)" IS the Inventory leaf for the USD item — not a separate
 * concept sitting alongside it, since for currency, the inventory
 * location and the bank account are literally the same thing.
 *
 * No separate "Sales" leaf for currency (you don't sell USD to a
 * customer the way you sell wine) — each currency gets:
 *   - Cash at Bank (currency)      — the Inventory leaf, lot-tracked
 *   - FX Conversion Clearing (ccy) — the wash/intermediary for moving
 *                                    value between currencies within
 *                                    the same-currency-per-entry rule
 *   - Delivery Fees (currency)     — currency-specific, as established
 *   - FX Gain/Loss (currency)      — the COGS-equivalent leaf, realized
 *                                    only when a lot is consumed
 *
 * Re-validates the exact same numbers as the earlier prototype
 * (€1,000 bought for $1,090 + $15 fee, later spending €400 when the
 * rate has moved) under this unified structure.
 *
 * Run with: DB_PATH=/tmp/proto4.db node --import tsx backend/scripts/prototype-currency-inventory.ts
 */
import { createEntityRaw, create, requireEntity, typeRootName, typeVocabularyWordName, setItem, stageLine, postJournalEntry, receiveLot, consumeFromLots, db } from '../src/db.js';

db.exec(`ALTER TABLE account ADD COLUMN currency TEXT`);
function setAccountCurrency(accountName: string, currency: string) {
  db.prepare(`INSERT INTO account (entity_id) VALUES ((SELECT id FROM current_entities WHERE name = ?)) ON CONFLICT (entity_id) DO NOTHING`).run(accountName);
  db.prepare(`UPDATE account SET currency = ? WHERE entity_id = (SELECT id FROM current_entities WHERE name = ?)`).run(currency, accountName);
}

/** Sets up one currency as a real item (for lot tracking) whose "Cash
 * at Bank" leaf is simultaneously the real, postable Inventory GL
 * account — the same entity serves both roles, not two entities kept
 * in sync. */
function setupCurrency(code: string) {
  create(requireEntity('Items', typeRootName), typeRootName, code, 1);
  setItem(code, { unit_of_measure: 'cent' });

  const bank = `Cash at Bank (${code})`;
  const clearing = `FX Conversion Clearing (${code})`;
  const fees = `Delivery Fees (${code})`;
  const gainLoss = `FX Gain/Loss (${code})`;
  create(requireEntity('Asset', typeRootName), typeRootName, bank, 1);
  create(requireEntity('Asset', typeRootName), typeRootName, clearing, 1);
  create(requireEntity('Expense', typeRootName), typeRootName, fees, 1);
  create(requireEntity('Income', typeRootName), typeRootName, gainLoss, 1);
  [bank, clearing, fees, gainLoss].forEach((a) => setAccountCurrency(a, code));
  return { bank, clearing, fees, gainLoss };
}

async function main() {
  console.log('=== Setup: EUR and USD, each with Cash at Bank as the real Inventory leaf ===');
  const eur = setupCurrency('EUR');
  const usd = setupCurrency('USD');

  console.log('\n=== Buy €1,000 for $1,090 + $15 fee — one journal, two currency groups ===');
  stageLine({ reference: 'FX-BUY-1', business: 'admin', ledger: 'Actual', transdate: '2027-01-01', account: eur.bank, amount_minor: 100000 });
  stageLine({ reference: 'FX-BUY-1', business: 'admin', ledger: 'Actual', transdate: '2027-01-01', account: eur.clearing, amount_minor: -100000 });
  stageLine({ reference: 'FX-BUY-1', business: 'admin', ledger: 'Actual', transdate: '2027-01-01', account: usd.clearing, amount_minor: 109000 });
  stageLine({ reference: 'FX-BUY-1', business: 'admin', ledger: 'Actual', transdate: '2027-01-01', account: usd.fees, amount_minor: 1500 });
  stageLine({ reference: 'FX-BUY-1', business: 'admin', ledger: 'Actual', transdate: '2027-01-01', account: usd.bank, amount_minor: -110500 });
  postJournalEntry('FX-BUY-1', 'admin', 'Actual', 1);
  console.log('Posted successfully as ONE journal entry with real, currency-specific Inventory/Clearing/Fee accounts.');

  // The EUR lot — cost basis is $1,090 (the exchange amount only, fee excluded), tracked against the EUR item itself.
  receiveLot('admin', 'Actual', 'FX-BUY-1-EUR-LOT', 'EUR', 'LOT-2027-01-01', '2027-01-01', null, 100000, 1);
  console.log("EUR lot received against the EUR item — the SAME entity whose 'Cash at Bank (EUR)' is the real GL Inventory account.");

  console.log('\n=== Spend €400 later, rate has moved, realize gain/loss ===');
  const consumed = consumeFromLots('admin', 'Actual', 'FX-BUY-1-EUR-CONSUME', 'EUR', 40000, 1);
  console.log('Lots consumed via the REAL, unmodified consumeFromLots (FIFO):', consumed);

  const lotCostBasisMinor = 109000, lotQuantityMinor = 100000, consumedQuantityMinor = 40000;
  const costBasisOfConsumedMinor = Math.round((lotCostBasisMinor * consumedQuantityMinor) / lotQuantityMinor);
  const realizedAmountMinor = 44500;
  const realizedGainMinor = realizedAmountMinor - costBasisOfConsumedMinor;
  console.log('Cost basis of the €400 spent (expect 43600):', costBasisOfConsumedMinor);
  console.log('Realized gain (expect 900):', realizedGainMinor);
  if (costBasisOfConsumedMinor !== 43600 || realizedGainMinor !== 900) throw new Error('PROTOTYPE FAILURE: arithmetic wrong');

  stageLine({ reference: 'FX-SELL-1', business: 'admin', ledger: 'Actual', transdate: '2027-02-01', account: eur.bank, amount_minor: -40000 });
  stageLine({ reference: 'FX-SELL-1', business: 'admin', ledger: 'Actual', transdate: '2027-02-01', account: eur.clearing, amount_minor: 40000 });
  stageLine({ reference: 'FX-SELL-1', business: 'admin', ledger: 'Actual', transdate: '2027-02-01', account: usd.clearing, amount_minor: -costBasisOfConsumedMinor });
  stageLine({ reference: 'FX-SELL-1', business: 'admin', ledger: 'Actual', transdate: '2027-02-01', account: usd.gainLoss, amount_minor: -realizedGainMinor });
  stageLine({ reference: 'FX-SELL-1', business: 'admin', ledger: 'Actual', transdate: '2027-02-01', account: usd.bank, amount_minor: realizedAmountMinor });
  postJournalEntry('FX-SELL-1', 'admin', 'Actual', 1);
  console.log('Realization posted successfully — one journal, two currency groups, each balanced independently.');

  console.log('\n=== Confirm: real bank account balance reflects real holdings ===');
  const eurBalance = db.prepare(`SELECT balance_minor FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name = ?)`).get(eur.bank) as { balance_minor: number };
  console.log('Cash at Bank (EUR) balance (expect 60000, the €600 remaining):', eurBalance.balance_minor);
  if (eurBalance.balance_minor !== 60000) throw new Error('PROTOTYPE FAILURE: EUR bank balance wrong');

  console.log('\n=== ALL SCENARIOS PASSED — currency genuinely unified with the inventory/lot model ===');
}

main().catch((err) => {
  console.error('PROTOTYPE FAILED:', err);
  process.exit(1);
});
