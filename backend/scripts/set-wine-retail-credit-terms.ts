/**
 * Real, varied payment terms and credit limits for Wine Retail
 * Company's vendors and customers — per direct request: "maybe half
 * the suppliers are payment on delivery and the other half seven day
 * account... we need to consider credit limits and terms for both
 * vendors and customers."
 *
 * Wine Retail Business only ever had one real vendor (Boutique Wine
 * Importers Pty Ltd) and the one, shared "Cash Sale" POS customer —
 * this adds a second, real vendor (COD terms) and two real, named B2B
 * account customers with real credit limits, so the "half and half"
 * scenario is genuinely demonstrable, not just described.
 */
import { createEntityRaw, create, requireEntity, typeRootName, setContact, getCreditStatus, asUserId } from '../src/db.ts';

async function main() {
  console.log('=== Wine Retail Business: real, varied payment terms and credit limits ===\n');

  // Existing vendor: real, 7-day account terms (matches the real
  // 7-21 day payment scheduling the simulation itself already uses).
  setContact('Boutique Wine Importers Pty Ltd', { payment_terms_days: 7 });
  console.log('Boutique Wine Importers Pty Ltd: 7-day account (unchanged from real simulation behavior).');

  // A second, real vendor — cash on delivery, no credit extended at all.
  create(requireEntity('Accounts Payable', typeRootName), typeRootName, 'Riverside Cellar Direct', asUserId(1));
  setContact('Riverside Cellar Direct', { payment_terms_days: 0 });
  console.log('Riverside Cellar Direct: real, new vendor — payment on delivery (0-day terms).');

  // Two real, named B2B account customers — genuinely different from
  // the shared "Cash Sale" POS customer, since a real credit limit
  // only means something for an account that's actually meant to
  // carry a balance.
  create(requireEntity('Accounts Receivable', typeRootName), typeRootName, 'The Grand Hotel Springfield', asUserId(1));
  setContact('The Grand Hotel Springfield', { payment_terms_days: 30, credit_limit_minor: 1000000 }); // $10,000
  console.log('The Grand Hotel Springfield: real B2B account customer — 30-day terms, $10,000 credit limit.');

  create(requireEntity('Accounts Receivable', typeRootName), typeRootName, 'Rivertown Function Centre', asUserId(1));
  setContact('Rivertown Function Centre', { payment_terms_days: 14, credit_limit_minor: 500000 }); // $5,000
  console.log('Rivertown Function Centre: real B2B account customer — 14-day terms, $5,000 credit limit.');

  console.log('\nReal credit status for each:');
  for (const name of ['Boutique Wine Importers Pty Ltd', 'Riverside Cellar Direct', 'The Grand Hotel Springfield', 'Rivertown Function Centre']) {
    console.log(` ${name}:`, getCreditStatus(name));
  }
}

main();
