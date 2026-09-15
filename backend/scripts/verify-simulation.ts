/**
 * End-to-end verification for the Wine Retail Business simulation.
 *
 * The simulation is fully deterministic (a seeded PRNG, never
 * Math.random()) — running it against the same schema always
 * produces exactly the same numbers, not just "a plausible range."
 * This script checks the real, current database against those exact,
 * documented values (see docs/testing.md, which this script and that
 * document are kept in sync with deliberately).
 *
 * This is a genuine correctness check, not a smoke test: it verifies
 * the fundamental accounting identities (Trial Balance and Balance
 * Sheet both actually balance) alongside the specific expected
 * figures, so a real regression — a broken posting path, a bug in
 * closeBooks, a report silently excluding real accounts — fails
 * loudly here rather than being missed by unit tests that only ever
 * exercise small, synthetic scenarios.
 *
 * Run with: node --import tsx backend/scripts/verify-simulation.ts
 * (assumes the simulation has already been run against a fresh
 * database — `make test-e2e` runs both in the right order)
 */
import { getTrialBalance, getBalanceSheet, getProfitAndLoss, getSalesReport, db } from '../src/db.js';

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const pass = actual === expected;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}: expected ${expected}, got ${actual}`);
  if (!pass) failures++;
}

async function main() {
  console.log('=== Verifying the real Wine Retail Business simulation against exact, documented expected results ===\n');

  console.log('--- Trial Balance @ 2027-03-28 ---');
  const tb = getTrialBalance('Wine Retail Business', 'Actual', '2027-03-28');
  check('total_debit_minor', tb.total_debit_minor, 94533593);
  check('total_credit_minor', tb.total_credit_minor, 94533593);
  check('debit == credit (the fundamental accounting identity)', tb.total_debit_minor === tb.total_credit_minor, true);
  check('row count', tb.rows.length, 389);

  console.log('\n--- Balance Sheet (all time) ---');
  const bs = getBalanceSheet('Wine Retail Business', 'Actual');
  check('total_assets_minor', bs.total_assets_minor, 56357648);
  check('total_liabilities_minor', bs.total_liabilities_minor, 38628794);
  check('total_equity_minor', bs.total_equity_minor, 17728854);
  check('balanced', bs.balanced, true);

  console.log('\n--- Profit & Loss, 2027-03-01 to 2027-03-28 ---');
  const pl = getProfitAndLoss('Wine Retail Business', 'Actual', '2027-03-01', '2027-03-28');
  check('total_income_minor', pl.total_income_minor, 19547533);
  check('total_expenses_minor', pl.total_expenses_minor, 11843192);
  check('gross_profit_minor', pl.gross_profit_minor, 7729331);
  check('net_income_minor', pl.net_income_minor, 7704341);
  check('real per-product income accounts', pl.income.length, 146);
  check('real per-product-per-tier COGS accounts', pl.cogs_expenses.length, 139);

  console.log('\n--- Real cash movement (the allocatePayment/vendor-payment fix) ---');
  // Deliberately NOT account.balance_minor directly — that column is a
  // real, intentional cross-business running total (documented at
  // db.ts's getBusinessReports, "fine for browsing the hierarchy, not
  // meant for financial statements"), since Cash and Bank is one real,
  // shared entity across every business in this app, not one per
  // business. Using it directly here would silently verify a
  // contaminated, multi-business figure while looking like it proves
  // something specific to Wine Retail Business. getTrialBalance is
  // correctly ledger-scoped, exactly like every real report does.
  const tbForCash = getTrialBalance('Wine Retail Business', 'Actual', '2027-03-28');
  const cashRow = tbForCash.rows.find((r) => r.name === 'Cash and Bank');
  const cashBankMinor = cashRow ? cashRow.debit_minor - cashRow.credit_minor : undefined;
  check('Cash and Bank, ledger-scoped (real money genuinely moved, not just tracked)', cashBankMinor, -14503285);

  const vendor = db.prepare(`SELECT balance_minor FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name = 'Boutique Wine Importers Pty Ltd')`).get() as
    | { balance_minor: number }
    | undefined;
  check('Vendor balance_minor (partially, realistically paid — not zero, not never-paid)', vendor?.balance_minor, -36715404);

  console.log('\n--- Sales Report, 2027-03-01 to 2027-03-28 ---');
  const sales = getSalesReport('Wine Retail Business', 'Actual', '2027-03-01', '2027-03-28');
  check('detailed line count', sales.detailed.length, 986);
  check('real category count (every product category actually sold)', sales.category_summary.length, 14);
  check('total_quantity', sales.total_quantity, 3726);
  check('total_amount_minor', sales.total_amount_minor, 19547533);
  const summedFromCategories = sales.category_summary.reduce((s, c) => s + c.amount_minor, 0);
  check('category summary sums to the same total as the detailed lines', summedFromCategories, sales.total_amount_minor);

  console.log(`\n${'='.repeat(70)}`);
  if (failures === 0) {
    console.log('ALL CHECKS PASSED — the real simulation matches its exact, documented expected results.');
  } else {
    console.log(`${failures} CHECK(S) FAILED — the simulation's real behavior has changed. If this is expected`);
    console.log('(a deliberate change to the simulation or the underlying logic), update both this script');
    console.log('and docs/testing.md together, not just one — they must never silently drift apart.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('VERIFICATION SCRIPT ITSELF FAILED (not a check failure — a real error):', err);
  process.exit(1);
});
