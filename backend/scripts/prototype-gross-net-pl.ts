/**
 * Prototype: Gross Profit / Net Profit subtotal on the P&L, via the
 * same relation_id mechanism business_reports already uses (Asset/
 * Liability/Equity -> "Balance Sheet"; Income/Expense -> "P&L
 * Statement") - reused one level deeper, tagging specific COGS-type
 * expense leaves rather than a whole top-level category. No new
 * mechanism, no new schema - "Cost of Goods Sold" already exists as a
 * single, named leaf account with an unused relation_id slot.
 *
 * Run with: DB_PATH=/tmp/proto5.db node --import tsx backend/scripts/prototype-gross-net-pl.ts
 */
import { createEntityRaw, create, fetch, typeRootName, typeVocabularyWordName, updateEntity, stageLine, postJournalEntry, getProfitAndLoss, db } from '../src/db.js';

async function main() {
  console.log('=== Setup: tag Cost of Goods Sold as COGS-type, via its own unused relation_id ===');
  create(fetch('Vocabulary', typeRootName), typeVocabularyWordName, 'COGS', 1); // a marker entity, same pattern as "Balance Sheet"/"P&L Statement"
  const cogsAccount = db.prepare(`SELECT id FROM current_entities WHERE name = 'Cost of Goods Sold'`).get() as { id: number };
  updateEntity(cogsAccount.id, { relation: 'COGS' }, 1);

  console.log('\n=== Post real revenue, COGS, and an ordinary operating expense ===');
  create(fetch('My Business', typeRootName), typeRootName, 'GNTest Ledger', 1);

  stageLine({ reference: 'GNTEST-1', business: 'My Business', ledger: 'GNTest Ledger', transdate: '2027-01-01', account: 'Sales Revenue', amount_minor: -100000 }); // $1,000 revenue
  stageLine({ reference: 'GNTEST-1', business: 'My Business', ledger: 'GNTest Ledger', transdate: '2027-01-01', account: 'Cash and Bank', amount_minor: 100000 });
  postJournalEntry('GNTEST-1', 'My Business', 'GNTest Ledger', 1);

  stageLine({ reference: 'GNTEST-2', business: 'My Business', ledger: 'GNTest Ledger', transdate: '2027-01-02', account: 'Cost of Goods Sold', amount_minor: 40000 }); // $400 COGS
  stageLine({ reference: 'GNTEST-2', business: 'My Business', ledger: 'GNTest Ledger', transdate: '2027-01-02', account: 'Cash and Bank', amount_minor: -40000 });
  postJournalEntry('GNTEST-2', 'My Business', 'GNTest Ledger', 1);

  stageLine({ reference: 'GNTEST-3', business: 'My Business', ledger: 'GNTest Ledger', transdate: '2027-01-03', account: 'Rent', amount_minor: 20000 }); // $200 rent (ordinary operating expense)
  stageLine({ reference: 'GNTEST-3', business: 'My Business', ledger: 'GNTest Ledger', transdate: '2027-01-03', account: 'Cash and Bank', amount_minor: -20000 });
  postJournalEntry('GNTEST-3', 'My Business', 'GNTest Ledger', 1);

  console.log('\n=== Compute Gross Profit / Net Profit directly from the tag ===');
  const pl = getProfitAndLoss('GNTest Ledger');
  console.log('Total income (expect 100000):', pl.total_income_minor);
  console.log('Total expenses (expect 60000):', pl.total_expenses_minor);
  console.log('Net income (expect 40000):', pl.net_income_minor);

  // The actual new logic: split expenses by their relation_id tag.
  const rows = db
    .prepare(
      `SELECT e.name, a.balance_minor, e.relation_id AS cogs_tag
       FROM account a JOIN current_entities e ON e.id = a.entity_id
       WHERE e.name IN ('Cost of Goods Sold', 'Rent')`
    )
    .all() as { name: string; balance_minor: number; cogs_tag: number | null }[];
  console.log('Rows with COGS tag check:', rows);

  const cogsMinor = rows.filter((r) => r.cogs_tag != null).reduce((s, r) => s + r.balance_minor, 0);
  const operatingMinor = rows.filter((r) => r.cogs_tag == null).reduce((s, r) => s + r.balance_minor, 0);
  const grossProfitMinor = pl.total_income_minor - cogsMinor;
  const netProfitMinor = grossProfitMinor - operatingMinor;

  console.log('\nCOGS-tagged total (expect 40000):', cogsMinor);
  console.log('Operating (non-COGS) total (expect 20000):', operatingMinor);
  console.log('Gross Profit (expect 60000, i.e. $600):', grossProfitMinor);
  console.log('Net Profit (expect 40000, i.e. $400):', netProfitMinor);

  if (cogsMinor !== 40000) throw new Error('PROTOTYPE FAILURE: COGS total wrong');
  if (operatingMinor !== 20000) throw new Error('PROTOTYPE FAILURE: operating total wrong');
  if (grossProfitMinor !== 60000) throw new Error('PROTOTYPE FAILURE: gross profit wrong');
  if (netProfitMinor !== 40000) throw new Error('PROTOTYPE FAILURE: net profit wrong');
  if (netProfitMinor !== pl.net_income_minor) throw new Error('PROTOTYPE FAILURE: net profit must match the existing net_income_minor exactly — same bottom line, just with a new subtotal inserted above it');

  console.log('\n=== ALL SCENARIOS PASSED — Gross/Net split computed correctly from the existing relation_id mechanism ===');
}

main().catch((err) => {
  console.error('PROTOTYPE FAILED:', err);
  process.exit(1);
});
