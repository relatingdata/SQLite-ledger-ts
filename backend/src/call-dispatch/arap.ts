// Converted from routes/arap.ts. Mounted (old route) with requireAuth +
// requireRole('Administrator','Bookkeeper') - replicated per-function here.
// Note: the frontend's ARAPBaseInput carries tax_minor/location fields
// that stageARReceipt/stageAPPayment (db-journal.ts) never actually read
// or insert (confirmed directly) - not carried over here either, same
// real behavior as the old JSON route.
import { asBusinessName, asLedgerName, asCustomerName, asProviderName, asUserId, PostingError } from '../db.js';
import { stageARReceipt, postARReceipt, stageAPPayment, postAPPayment } from '../db-journal.js';
import { CallError, requireRole, row, type BackendCall } from '../call-dispatch.js';

export const arapFunctions: Record<string, BackendCall> = {
  // Positional args: [0] reference, [1] business, [2] ledger, [3] customer, [4] amount_minor, [5] transdate, [6] description.
  stageARReceipt: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference, business, ledger, customer, amountMinorRaw, transdate, description] = v;
    if (!reference || !business || !ledger || !customer || !amountMinorRaw) throw new CallError(400, 'reference, business, ledger, customer and amount_minor are all required.');
    stageARReceipt({
      reference,
      business: asBusinessName(business),
      ledger: asLedgerName(ledger),
      customer: asCustomerName(customer),
      amount_minor: Number(amountMinorRaw),
      transdate: transdate || undefined,
      description: description || undefined,
    });
    return row();
  },
  // Positional args: [0] reference, [1] business, [2] ledger.
  postARReceipt: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference, business, ledger] = v;
    if (!reference || !business || !ledger) throw new CallError(400, 'reference, business and ledger are all required.');
    try {
      postARReceipt(reference, asBusinessName(business), asLedgerName(ledger), asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof PostingError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] reference, [1] business, [2] ledger, [3] vendor, [4] amount_minor, [5] transdate, [6] description.
  stageAPPayment: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference, business, ledger, vendor, amountMinorRaw, transdate, description] = v;
    if (!reference || !business || !ledger || !vendor || !amountMinorRaw) throw new CallError(400, 'reference, business, ledger, vendor and amount_minor are all required.');
    stageAPPayment({
      reference,
      business: asBusinessName(business),
      ledger: asLedgerName(ledger),
      vendor: asProviderName(vendor),
      amount_minor: Number(amountMinorRaw),
      transdate: transdate || undefined,
      description: description || undefined,
    });
    return row();
  },
  // Positional args: [0] reference, [1] business, [2] ledger.
  postAPPayment: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference, business, ledger] = v;
    if (!reference || !business || !ledger) throw new CallError(400, 'reference, business and ledger are all required.');
    try {
      postAPPayment(reference, asBusinessName(business), asLedgerName(ledger), asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof PostingError) throw new CallError(409, err.message);
      throw err;
    }
  },
};
