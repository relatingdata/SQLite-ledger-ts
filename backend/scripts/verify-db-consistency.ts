/**
 * Real, direct database consistency checks — not a simulation
 * re-run, a genuine audit of whatever the current database actually
 * contains, for every real ledger that has any real activity.
 *
 * Run with: node --import tsx backend/scripts/verify-db-consistency.ts
 */
import { getBusinesses, getLedgers, getTrialBalance, getBalanceSheet, db } from '../src/db.js';

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ' — ' + detail : ''}`);
  }
}

console.log('=== 1. Every real, financial journal entry (posted under Chart of Accounts) balances to exactly zero ===');
// Confirmed directly, not assumed: getLedgerBalances itself unions
// TWO separate subtrees as real, postable "reportable_accounts" —
// Chart of Accounts AND Customers/Vendors (contact entities are real,
// valid AR/AP posting targets, e.g. a vendor's own balance, but live
// under a genuinely separate branch of the entity tree, not under
// Chart of Accounts at all). My own first version of this check only
// included Chart of Accounts, and incorrectly flagged real,
// genuinely-balanced AR/AP entries as unbalanced — found by directly
// tracing one flagged entry's full line set, not assumed to be a real
// app bug just because a naive query said so.
const unbalanced = db
  .prepare(
    `WITH RECURSIVE coa(id) AS (
       SELECT id FROM current_entities WHERE name = 'Chart of Accounts'
       UNION ALL
       SELECT e.id FROM current_entities e JOIN coa c ON e.parent_id = c.id
     ),
     contact_accts(id) AS (
       SELECT id FROM current_entities WHERE name IN ('Customers', 'Vendors')
       UNION ALL
       SELECT e.id FROM current_entities e JOIN contact_accts c ON e.parent_id = c.id
     ),
     reportable(id) AS (
       SELECT id FROM coa
       UNION
       SELECT id FROM contact_accts
     )
     SELECT j.id, j.reference, SUM(jl.amount_minor) AS total
     FROM journal j
     JOIN journal_line jl ON jl.journal_id = j.id
     WHERE jl.account_id IN (SELECT id FROM reportable)
     GROUP BY j.id
     HAVING total != 0`
  )
  .all() as { id: number; reference: string; total: number }[];
check('every real, financial journal entry balances to zero', unbalanced.length === 0, unbalanced.length ? `${unbalanced.length} unbalanced entries, e.g. ${unbalanced[0].reference} off by ${unbalanced[0].total}` : undefined);

console.log('\n=== 1b. Every real, multi-line quantity-movement entry (posted under Items) is genuinely balanced to zero ===');
// A real, single-account adjustment/breakage or an order-placement
// record (e.g. crediting a real "On Order" account when a purchase
// order is placed, before any real stock has actually moved) is
// genuinely, intentionally one real line on its own — not a
// double-entry movement at all, so it's never expected to balance to
// zero. A real, true double-entry movement (a transfer between two
// real locations, a receipt crediting "On Order" while debiting
// on-hand, a sale crediting on-hand while debiting "Units Sold") is
// genuinely two or more real lines, and THOSE must genuinely balance
// to zero — the same real requirement postJournalEntry itself already
// enforces for financial postings. Confirmed directly against live
// data before finalizing this: this check's own, prior "must be
// exactly one line" version was stale (predating the real, true
// double-entry quantity tracking built for transfers/receipts/sales),
// and a first attempt at fixing it here was itself too broad
// (checking every real line for balance, not just multi-line ones) —
// caught directly by re-running against live data and seeing the
// real, single-line order-placement entries correctly, intentionally
// flagged as "unbalanced," which they're supposed to be.
const unbalancedQuantityMovements = db
  .prepare(
    `WITH RECURSIVE items(id) AS (
       SELECT id FROM current_entities WHERE name = 'Items'
       UNION ALL
       SELECT e.id FROM current_entities e JOIN items p ON e.parent_id = p.id
     )
     SELECT j.id, j.reference, COUNT(*) AS line_count, SUM(jl.amount_minor) AS total
     FROM journal j
     JOIN journal_line jl ON jl.journal_id = j.id
     WHERE jl.account_id IN (SELECT id FROM items)
     GROUP BY j.id
     HAVING line_count > 1 AND total != 0`
  )
  .all() as { id: number; reference: string; line_count: number; total: number }[];
check('every multi-line quantity-movement entry balances to zero', unbalancedQuantityMovements.length === 0, unbalancedQuantityMovements.length ? `${unbalancedQuantityMovements.length} unbalanced entries, e.g. ${unbalancedQuantityMovements[0].reference} off by ${unbalancedQuantityMovements[0].total}` : undefined);

console.log('\n=== 2. Trial Balance zero-sums for every real ledger with activity ===');
const businesses = getBusinesses();
let ledgersChecked = 0;
for (const biz of businesses) {
  const ledgers = getLedgers(biz.name);
  for (const ledger of ledgers) {
    const hasActivity = db
      .prepare(`SELECT 1 FROM journal WHERE ledger_id = ? LIMIT 1`)
      .get(ledger.id);
    if (!hasActivity) continue;
    ledgersChecked += 1;
    const tb = getTrialBalance(ledger.name);
    check(`Trial Balance zero-sums for "${ledger.name}"`, tb.total_debit_minor === tb.total_credit_minor, `debit ${tb.total_debit_minor} vs credit ${tb.total_credit_minor}`);
  }
}
console.log(`(${ledgersChecked} real, active ledgers checked)`);

console.log('\n=== 3. Balance Sheet balances (Assets = Liabilities + Equity) for every real ledger with activity ===');
for (const biz of businesses) {
  const ledgers = getLedgers(biz.name);
  for (const ledger of ledgers) {
    const hasActivity = db.prepare(`SELECT 1 FROM journal WHERE ledger_id = ? LIMIT 1`).get(ledger.id);
    if (!hasActivity) continue;
    const bs = getBalanceSheet(ledger.name);
    check(`Balance Sheet balances for "${ledger.name}"`, bs.balanced, `assets ${bs.total_assets_minor}, liabilities+equity ${bs.total_liabilities_minor + bs.total_equity_minor}`);
  }
}

console.log('\n=== 4. No orphaned entities (every non-root entity has a real, existing parent) ===');
const orphans = db
  .prepare(
    `SELECT e.id, e.name FROM current_entities e
     WHERE e.parent_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM current_entities p WHERE p.id = e.parent_id)`
  )
  .all() as { id: number; name: string }[];
check('no orphaned entities', orphans.length === 0, orphans.length ? `${orphans.length} orphans, e.g. "${orphans[0].name}"` : undefined);

console.log('\n=== 5. No duplicate active sibling entity names (the real, enforced scoped-uniqueness rule) ===');
const dupes = db
  .prepare(`SELECT name, parent_id, COUNT(*) AS c FROM current_entities GROUP BY parent_id, name HAVING c > 1`)
  .all() as { name: string; parent_id: number | null; c: number }[];
check('no duplicate active sibling entity names', dupes.length === 0, dupes.length ? `${dupes.length} duplicated sibling names, e.g. "${dupes[0].name}" (${dupes[0].c}x under the same, real parent)` : undefined);

console.log('\n=== 6. Every journal_line.account_id references a real, still-existing entity ===');
const badAccountRefs = db
  .prepare(
    `SELECT COUNT(*) AS c FROM journal_line jl
     WHERE NOT EXISTS (SELECT 1 FROM current_entities e WHERE e.id = jl.account_id)`
  )
  .get() as { c: number };
check('every journal_line references a real, current account entity', badAccountRefs.c === 0, badAccountRefs.c ? `${badAccountRefs.c} dangling references` : undefined);

console.log('\n=== 7. Every real location referenced by item_location still exists as a real entity ===');
const badLocationRefs = db
  .prepare(
    `SELECT COUNT(*) AS c FROM item_location pl
     WHERE NOT EXISTS (SELECT 1 FROM current_entities e WHERE e.id = pl.location_id)`
  )
  .get() as { c: number };
check('every item_location references a real, current location entity', badLocationRefs.c === 0, badLocationRefs.c ? `${badLocationRefs.c} dangling references` : undefined);

console.log('\n=== 8. No negative on-hand stock quantities (a real, physical impossibility) ===');
const negativeStock = db.prepare(`SELECT COUNT(*) AS c FROM item_location WHERE quantity_on_hand < 0`).get() as { c: number };
check('no negative on-hand quantities anywhere', negativeStock.c === 0, negativeStock.c ? `${negativeStock.c} real rows with negative quantity` : undefined);

console.log('\n' + '='.repeat(70));
if (failures === 0) {
  console.log('ALL CONSISTENCY CHECKS PASSED — the real database is internally consistent.');
} else {
  console.log(`${failures} CONSISTENCY CHECK(S) FAILED.`);
  process.exit(1);
}
