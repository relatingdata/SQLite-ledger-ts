/**
 * A real Budget ledger for Wine Retail Business, covering the same
 * period as the real simulation (March 2027) — "Budget is just
 * another ledger," the same proven pattern admin's own
 * "Proposed Growth Budget 2026-27" already uses.
 *
 * Posted at the aggregate level (Sales Revenue, Cost of Goods Sold,
 * Breakage & Spoilage) deliberately, not per-product-per-tier —
 * budgeting each of ~159 individual accounts a real business
 * wouldn't set a target for separately isn't a realistic budget, it's
 * noise. The comparison against Actual then uses the same top-level
 * totals getProfitAndLoss already computes (total_income_minor,
 * total_expenses_minor, gross_profit_minor, net_income_minor) rather
 * than per-account name matching, since Actual's real activity is
 * genuinely spread across many more, differently-named accounts.
 *
 * Run with: node --import tsx backend/scripts/generate-wine-retail-budget.ts
 */
import { createEntityRaw, create, requireEntity, typeRootName, stageLine, postJournalEntry, getProfitAndLoss } from '../src/db.js';

const BUSINESS = 'Wine Retail Business';
const LEDGER = 'Budget March 2027';

async function main() {
  console.log('=== Setting up the Budget ledger ===');
  try {
    create(requireEntity(BUSINESS, typeRootName), typeRootName, LEDGER, 1);
  } catch {
    console.log('Ledger already exists — continuing.');
  }

  // A realistic target: modest growth over what actually happened,
  // not a copy of the real result — a real budget is set in advance
  // and should show a real variance once compared, not a perfect
  // match.
  const actual = getProfitAndLoss('Actual', '2027-03-01', '2027-03-28');
  const budgetedRevenueMinor = Math.round(actual.total_income_minor * 1.05); // targeted 5% above what was actually achieved
  const budgetedCogsMinor = Math.round(actual.total_income_minor * 1.05 * 0.55); // a target 55% COGS ratio (45% gross margin), a real planning assumption
  const budgetedBreakageMinor = Math.round(actual.total_income_minor * 0.0005); // a small, planned allowance

  console.log(`Budgeted revenue: $${(budgetedRevenueMinor / 100).toFixed(2)}`);
  console.log(`Budgeted COGS: $${(budgetedCogsMinor / 100).toFixed(2)} (target 45% gross margin)`);
  console.log(`Budgeted breakage allowance: $${(budgetedBreakageMinor / 100).toFixed(2)}`);

  const ref = 'BUDGET-MAR-2027';
  const revenueLine = -budgetedRevenueMinor;
  const cogsLine = budgetedCogsMinor;
  const breakageLine = budgetedBreakageMinor;
  // The balancing side — a real budget still has to balance like any
  // other journal entry. Computed directly as the negation of the
  // other three lines' actual sum, not re-derived from "net income"
  // separately, which is exactly where a sign error could (and did,
  // on the first attempt — caught by postJournalEntry itself
  // correctly rejecting an unbalanced entry) creep back in.
  const retainedEarningsLine = -(revenueLine + cogsLine + breakageLine);

  stageLine({ reference: ref, business: BUSINESS, ledger: LEDGER, transdate: '2027-03-01', account: 'Sales Revenue', amount_minor: revenueLine });
  stageLine({ reference: ref, business: BUSINESS, ledger: LEDGER, transdate: '2027-03-01', account: 'Cost of Goods Sold', amount_minor: cogsLine });
  stageLine({ reference: ref, business: BUSINESS, ledger: LEDGER, transdate: '2027-03-01', account: 'Breakage & Spoilage', amount_minor: breakageLine });
  stageLine({ reference: ref, business: BUSINESS, ledger: LEDGER, transdate: '2027-03-01', account: 'Retained Earnings', amount_minor: retainedEarningsLine });
  postJournalEntry(ref, BUSINESS, LEDGER, 1);
  console.log('Budget journal posted — one real, balanced entry.');

  console.log('\n=== Budget vs. Actual, using the same top-level totals ===');
  const budget = getProfitAndLoss(LEDGER, '2027-03-01', '2027-03-28');
  console.log('Metric'.padEnd(20), 'Budget'.padStart(14), 'Actual'.padStart(14), 'Variance'.padStart(14));
  const row = (label: string, b: number, a: number) => {
    console.log(label.padEnd(20), ('$' + (b / 100).toFixed(2)).padStart(14), ('$' + (a / 100).toFixed(2)).padStart(14), ('$' + ((a - b) / 100).toFixed(2)).padStart(14));
  };
  row('Revenue', budget.total_income_minor, actual.total_income_minor);
  row('COGS', budget.cogs_expenses.reduce((s, l) => s + l.debit_minor, 0), actual.cogs_expenses.reduce((s, l) => s + l.debit_minor, 0));
  row('Gross Profit', budget.gross_profit_minor, actual.gross_profit_minor);
  row('Net Income', budget.net_income_minor, actual.net_income_minor);
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
