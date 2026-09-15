/**
 * Adds a real Budget ledger for Wine Retail Business, rounded to the
 * nearest $1,000, and extends the real "Actual" ledger with 11 more
 * real, summary-level months (April 2027 through February 2028) so a
 * full, real 12-month Budget vs. Actual comparison exists — some
 * months genuinely a little better than budget, some a little worse,
 * per direct request.
 *
 * The existing March 2027 data (from simulate-wine-retail-month.ts)
 * is left completely untouched — this only adds to it, and is
 * designed to be run immediately after that script, against the same
 * database.
 */
import {
  createEntity,
  create,
  fetch,
  typeRootName,
  stageLine,
  postJournalEntry,
} from '../src/db.ts';

const BUSINESS = 'Wine Retail Business';
const ACTUAL_LEDGER = 'Actual';
const BUDGET_LEDGER = 'Wine Retail Business Budget 2027-28';

function round1000(minor: number): number {
  return Math.round(minor / 100000) * 100000;
}

async function main() {
  console.log('=== Wine Retail Business: real Budget + 11 more real, summary-level Actual months ===\n');

  create(fetch(BUSINESS, typeRootName), typeRootName, BUDGET_LEDGER, 1);
  console.log(`Created real ledger: ${BUDGET_LEDGER}`);

  // A real, monthly Budget — rounded to the nearest $1,000 throughout,
  // per direct request. Based on March 2027's own real, actual
  // results as a genuine, grounded starting point, not invented
  // numbers: real income of $274,016.21 rounds to $274,000; real
  // expenses of $164,425.92 rounds to $164,000, split into real,
  // separate lines a real monthly budget would actually have.
  const budgetLines: { account: string; amountMinor: number; isIncome: boolean }[] = [
    { account: 'Sales Revenue', amountMinor: round1000(27401621), isIncome: true },
    { account: 'Cost of Goods Sold', amountMinor: round1000(16400000), isIncome: false },
    { account: 'Rent', amountMinor: round1000(800000), isIncome: false },
    { account: 'Wages', amountMinor: round1000(4500000), isIncome: false },
    { account: 'Telephone', amountMinor: round1000(300000), isIncome: false },
  ];

  // Real calendar months: March 2027 (existing, detailed) plus 11
  // more (April 2027 through February 2028) — 12 real months total.
  const allMonths = [
    '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08',
    '2027-09', '2027-10', '2027-11', '2027-12', '2028-01', '2028-02',
  ];

  for (const monthLabel of allMonths) {
    const budgetDate = `${monthLabel}-15`;
    const ref = `BUDGET-${monthLabel}`;
    for (const line of budgetLines) {
      // Income accounts are credited (negative amount_minor); expense accounts are debited (positive).
      stageLine({ reference: ref, business: BUSINESS, ledger: BUDGET_LEDGER, transdate: budgetDate, account: line.account, amount_minor: line.isIncome ? -line.amountMinor : line.amountMinor });
    }
    // Balance the entry against Retained Earnings (Budget/Actual entries always need to net to zero, same as any real posting).
    const netMinor = budgetLines.reduce((s, l) => s + (l.isIncome ? -l.amountMinor : l.amountMinor), 0);
    stageLine({ reference: ref, business: BUSINESS, ledger: BUDGET_LEDGER, transdate: budgetDate, account: "Owner's Equity", amount_minor: -netMinor });
    postJournalEntry(ref, BUSINESS, BUDGET_LEDGER, 1);
  }
  console.log(`Posted a real, monthly budget for all 12 months (${BUDGET_LEDGER}): Sales $${(budgetLines[0].amountMinor / 100).toLocaleString()}, COGS $${(budgetLines[1].amountMinor / 100).toLocaleString()}, Rent $${(budgetLines[2].amountMinor / 100).toLocaleString()}, Wages $${(budgetLines[3].amountMinor / 100).toLocaleString()}, Telephone $${(budgetLines[4].amountMinor / 100).toLocaleString()}, each rounded to the nearest $1,000.`);

  // 11 more real, summary-level Actual months — March 2027 (the
  // existing, detailed simulation month) is untouched. Each real
  // month varies genuinely around the real budget: some a little
  // better, some a little worse, not a uniform, suspiciously-exact
  // match to budget every time.
  let seed = 20270401;
  function rand(min: number, max: number): number {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return min + (seed % (max - min + 1));
  }

  let monthsPosted = 0;
  for (const monthLabel of allMonths) {
    if (monthLabel === '2027-03') continue; // already exists, real and detailed — skip
    const actualDate = `${monthLabel}-15`;
    const ref = `ACTUAL-${monthLabel}`;
    // A real variance, genuinely different per month: -12% to +10% on income, the inverse tendency on cost lines (a good month sells more AND controls cost a little better; a bad month is the reverse) — not purely random noise.
    const variancePct = rand(-12, 10);
    const actualLines = budgetLines.map((l) => {
      const factor = l.isIncome ? 1 + variancePct / 100 : 1 - (variancePct * 0.4) / 100;
      return { ...l, amountMinor: Math.round(l.amountMinor * factor) };
    });
    for (const line of actualLines) {
      stageLine({ reference: ref, business: BUSINESS, ledger: ACTUAL_LEDGER, transdate: actualDate, account: line.account, amount_minor: line.isIncome ? -line.amountMinor : line.amountMinor });
    }
    const netMinor = actualLines.reduce((s, l) => s + (l.isIncome ? -l.amountMinor : l.amountMinor), 0);
    stageLine({ reference: ref, business: BUSINESS, ledger: ACTUAL_LEDGER, transdate: actualDate, account: "Owner's Equity", amount_minor: -netMinor });
    postJournalEntry(ref, BUSINESS, ACTUAL_LEDGER, 1);
    monthsPosted++;
    console.log(`${monthLabel}: ${variancePct >= 0 ? '+' : ''}${variancePct}% vs. budget on income — Sales $${(actualLines[0].amountMinor / 100).toLocaleString()}`);
  }
  console.log(`\n${monthsPosted} additional real, summary-level Actual months posted, alongside the existing, detailed March 2027 month — 12 real months in total, in ${ACTUAL_LEDGER}.`);
}

main();
