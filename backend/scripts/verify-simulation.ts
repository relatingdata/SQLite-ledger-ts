/**
 * End-to-end verification for the Wine Retail Business simulation.
 *
 * The simulation is fully deterministic (a seeded PRNG, never
 * Math.random()) — running it against the same schema always
 * produces exactly the same numbers, not just "a plausible range."
 * This script checks the real, current database against those exact,
 * values (docs/pm-testing-e2e.md). Cost of goods sold is first in, first
 * out: the opening stock is received as a quantity with no value, so the
 * first sales from it cost 0 (docs/pm-stock-api.md, "The cost of stock
 * leaving"); the three returns are posted as credit notes.
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
import { getTrialBalance, getBalanceSheet, getProfitAndLoss, getSalesReport, db, asBusinessName, asLedgerName } from '../src/db.js';

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const pass = actual === expected;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}: expected ${expected}, got ${actual}`);
  if (!pass) failures++;
}

const WINE_RETAIL = asBusinessName('Wine Retail Business');
const ACTUAL = asLedgerName('Actual');

async function main() {
  console.log('=== Verifying the real Wine Retail Business simulation against exact, documented expected results ===\n');

  console.log('--- Trial Balance @ 2027-03-28 ---');
  const tb = getTrialBalance(WINE_RETAIL, ACTUAL, '2027-03-28');
  check('total_debit_minor', tb.total_debit_minor, 39793204);
  check('total_credit_minor', tb.total_credit_minor, 39793204);
  check('debit == credit (the fundamental accounting identity)', tb.total_debit_minor === tb.total_credit_minor, true);
  check('row count', tb.rows.length, 601);

  console.log('\n--- Balance Sheet (all time) ---');
  const bs = getBalanceSheet(WINE_RETAIL, ACTUAL);
  check('total_assets_minor', bs.total_assets_minor, 31464473);
  check('total_liabilities_minor', bs.total_liabilities_minor, 15384808);
  check('total_equity_minor', bs.total_equity_minor, 16079665);
  check('balanced', bs.balanced, true);

  console.log('\n--- Profit & Loss, 2027-03-01 to 2027-03-28 ---');
  const pl = getProfitAndLoss(WINE_RETAIL, ACTUAL, '2027-03-01', '2027-03-28');
  check('total_income_minor', pl.total_income_minor, 13112369);
  check('total_expenses_minor', pl.total_expenses_minor, 7033344);
  check('gross_profit_minor', pl.gross_profit_minor, 6083805);
  check('net_income_minor', pl.net_income_minor, 6079025);
  check('real per-product income accounts', pl.income.length, 212);
  check('real per-product-per-tier COGS accounts', pl.cogs_expenses.length, 209);

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
  const tbForCash = getTrialBalance(WINE_RETAIL, ACTUAL, '2027-03-28');
  const cashRow = tbForCash.rows.find((r) => r.name === 'Cash and Bank');
  const cashBankMinor = cashRow ? cashRow.debit_minor - cashRow.credit_minor : undefined;
  check('Cash and Bank, ledger-scoped (real money genuinely moved, not just tracked)', cashBankMinor, 7592254);

  const vendor = db.prepare(`SELECT balance_minor FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name = 'Boutique Wine Importers Pty Ltd')`).get() as
    | { balance_minor: number }
    | undefined;
  check('Vendor balance_minor (partially, realistically paid — not zero, not never-paid)', vendor?.balance_minor, -14118120);

  console.log('\n--- Sales Report, 2027-03-01 to 2027-03-28 ---');
  const sales = getSalesReport(WINE_RETAIL, ACTUAL, '2027-03-01', '2027-03-28');
  check('detailed line count', sales.detailed.length, 1385);
  check('real category count (every product category actually sold)', sales.category_summary.length, 9);
  check('total_quantity', sales.total_quantity, 4986);
  check('total_amount_minor', sales.total_amount_minor, 13121926);
  const summedFromCategories = sales.category_summary.reduce((s, c) => s + c.amount_minor, 0);
  check('category summary sums to the same total as the detailed lines', summedFromCategories, sales.total_amount_minor);

  console.log(`\n${'='.repeat(70)}`);
  if (failures === 0) {
    console.log('ALL CHECKS PASSED — the real simulation matches its exact, documented expected results.');
  } else {
    console.log(`${failures} CHECK(S) FAILED — the simulation's real behavior has changed. If this is expected`);
    console.log('(a deliberate change to the simulation or the underlying logic), update the expected values');
    console.log('here and say why in the commit.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('VERIFICATION SCRIPT ITSELF FAILED (not a check failure — a real error):', err);
  process.exit(1);
});
