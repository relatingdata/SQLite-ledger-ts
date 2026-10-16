/**
 * Prototype: the actual, corrected multi-currency validation rule —
 * one journal entry (one reference) can genuinely span multiple
 * currencies, but each currency present must independently balance to
 * zero among its own lines. Direct correction of an earlier version of
 * this prototype, which incorrectly modeled a multi-currency
 * transaction as several separate journal entries.
 *
 * The real danger this proves out: a genuinely bad entry, where one
 * currency's lines don't actually balance, can still sum to zero
 * overall if a DIFFERENT currency's imbalance happens to cancel it out
 * — the old, currency-blind check would wrongly accept this. The
 * grouped check must not.
 *
 * account.currency doesn't exist in the real schema yet — added
 * directly to this scratch database via raw SQL, the shape the real
 * migration will add later.
 *
 * Run with: DB_PATH=/tmp/proto3.db node --import tsx backend/scripts/prototype-currency-reports.ts
 */
import { db, createEntityRaw, create, requireEntity, typeRootName, typeVocabularyWordName, stageLine, listJournalEntries } from '../src/db.js';

db.exec(`ALTER TABLE account ADD COLUMN currency TEXT`);

function setAccountCurrency(accountName: string, currency: string) {
  db.prepare(`INSERT INTO account (entity_id) VALUES ((SELECT id FROM current_entities WHERE name = ?)) ON CONFLICT (entity_id) DO NOTHING`).run(accountName);
  const result = db.prepare(`UPDATE account SET currency = ? WHERE entity_id = (SELECT id FROM current_entities WHERE name = ?)`).run(currency, accountName);
  if (result.changes !== 1) throw new Error(`setAccountCurrency: expected to update exactly 1 row for "${accountName}", updated ${result.changes}`);
}

/** The actual new rule, prototyped standalone (this is what
 * postJournalEntry's real implementation needs to become): group a
 * candidate entry's lines by each line's account's own, fixed
 * currency, and require every group to independently sum to zero. */
function validateGroupedByCurrency(lines: { account: string; amount_minor: number }[]): { ok: boolean; groups: Record<string, number>; oldBlindSumWouldHaveAccepted: boolean } {
  const groups: Record<string, number> = {};
  for (const line of lines) {
    const row = db.prepare(`SELECT currency FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name = ?)`).get(line.account) as
      | { currency: string | null }
      | undefined;
    const currency = row?.currency ?? 'AUD';
    groups[currency] = (groups[currency] ?? 0) + line.amount_minor;
  }
  const ok = Object.values(groups).every((sum) => sum === 0);
  const oldBlindSum = lines.reduce((s, l) => s + l.amount_minor, 0);
  return { ok, groups, oldBlindSumWouldHaveAccepted: oldBlindSum === 0 };
}

async function main() {
  console.log('=== Setup: real, currency-specific accounts ===');
  create(requireEntity('Asset', typeRootName), typeRootName, 'Cash at Bank (EUR)', 1);
  create(requireEntity('Asset', typeRootName), typeRootName, 'Cash at Bank (USD)', 1);
  create(requireEntity('Asset', typeRootName), typeRootName, 'FX Conversion Clearing (EUR)', 1);
  create(requireEntity('Asset', typeRootName), typeRootName, 'FX Conversion Clearing (USD)', 1);
  create(requireEntity('Expense', typeRootName), typeRootName, 'Delivery Fees (USD)', 1);
  setAccountCurrency('Cash at Bank (EUR)', 'EUR');
  setAccountCurrency('Cash at Bank (USD)', 'USD');
  setAccountCurrency('FX Conversion Clearing (EUR)', 'EUR');
  setAccountCurrency('FX Conversion Clearing (USD)', 'USD');
  setAccountCurrency('Delivery Fees (USD)', 'USD');

  console.log('\n=== A genuinely valid multi-currency entry: ONE entry, ONE reference, two currency groups ===');
  const validLines = [
    { account: 'Cash at Bank (EUR)', amount_minor: 100000 },
    { account: 'FX Conversion Clearing (EUR)', amount_minor: -100000 },
    { account: 'FX Conversion Clearing (USD)', amount_minor: 109000 },
    { account: 'Delivery Fees (USD)', amount_minor: 1500 },
    { account: 'Cash at Bank (USD)', amount_minor: -110500 },
  ];
  const validCheck = validateGroupedByCurrency(validLines);
  console.log('Groups:', validCheck.groups);
  console.log('Grouped check ok (expect true):', validCheck.ok);
  if (!validCheck.ok) throw new Error('PROTOTYPE FAILURE: a genuinely valid multi-currency entry must pass');

  // Post it for real, as ONE entry, through the real (currently
  // currency-blind) postJournalEntry — proving the real function
  // currently accepts it, which is correct here since it's genuinely
  // valid, but not yet doing the real currency-aware check itself
  // (that's the actual implementation work still to come).
  for (const line of validLines) {
    stageLine({ reference: 'FX-BUY-1', business: 'admin', ledger: 'Actual', transdate: '2027-01-01', account: line.account, amount_minor: line.amount_minor });
  }
  const { postJournalEntry } = await import('../src/db.js');
  postJournalEntry('FX-BUY-1', 'admin', 'Actual', 1);
  console.log('Posted successfully as ONE journal entry with one reference — confirmed via journal listing:');
  const posted = listJournalEntries('admin', 'Actual', 50, 0).find((e) => e.reference === 'FX-BUY-1');
  console.log('  Entry found:', posted ? `reference=${posted.reference}, one row, not split` : 'NOT FOUND');
  if (!posted) throw new Error('PROTOTYPE FAILURE: expected exactly one journal entry for FX-BUY-1');

  console.log('\n=== The real danger: a genuinely bad entry that the OLD blind-sum check would wrongly accept ===');
  // EUR group is short by 100 (imbalanced) — but USD group is over by
  // exactly 100, so the OVERALL blind sum still comes out to zero.
  // This is exactly the kind of real error the old check could never
  // catch: one currency genuinely wrong, masked by an unrelated
  // currency's opposite error.
  const badLines = [
    { account: 'Cash at Bank (EUR)', amount_minor: 100000 },
    { account: 'FX Conversion Clearing (EUR)', amount_minor: -99900 }, // short by 100 — a real EUR imbalance
    { account: 'FX Conversion Clearing (USD)', amount_minor: 109000 },
    { account: 'Cash at Bank (USD)', amount_minor: -109100 }, // over by 100 — happens to cancel the EUR error overall
  ];
  const badCheck = validateGroupedByCurrency(badLines);
  console.log('Groups:', badCheck.groups);
  console.log('Grouped check ok (expect false — EUR group is off by 100):', badCheck.ok);
  console.log('Old blind-sum check would have accepted this (expect true — the errors cancel overall):', badCheck.oldBlindSumWouldHaveAccepted);
  if (badCheck.ok) throw new Error('PROTOTYPE FAILURE: should have detected the EUR group imbalance');
  if (!badCheck.oldBlindSumWouldHaveAccepted) throw new Error('PROTOTYPE FAILURE: this specific case should demonstrate the old check failing to catch it');
  console.log('CONFIRMED: this is exactly why per-currency grouping matters — a real error in one');
  console.log('currency can be invisible to a currency-blind sum if another currency happens to be');
  console.log('off by the same amount in the opposite direction. The grouped check catches it; the');
  console.log('old check, currently still in the real postJournalEntry, would not have.');

  console.log('\n=== ALL PROTOTYPE SCENARIOS PASSED ===');
}

main().catch((err) => {
  console.error('PROTOTYPE FAILED:', err);
  process.exit(1);
});
