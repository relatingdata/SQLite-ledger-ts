// Converted from routes/quotations.ts. Mounted (old route) with
// requireAuth + requireRole('Administrator','Bookkeeper') for the whole
// router — replicated per-function here. createQuotation/createRfq also
// take recurrence/recurrenceCount params in db-quotations.ts, but neither
// the old route's own schema nor the frontend ever passed them — not
// ported here either, matching real prior behavior exactly.
import { createQuotation, createRfq, getQuotation, listQuotations, markQuotationSent, acceptQuotation, rejectQuotation, asBusinessName, asLedgerName, asUserId, PostingError, ValidationError, NotFoundError, type QuotationDirection } from '../db.js';
import { CallError, requireRole, row, table, type BackendCall } from '../call-dispatch.js';

const QUOTATION_HEADER: (keyof import('../db.js').QuotationRecord)[] = ['reference', 'direction', 'status', 'business', 'ledger', 'customer', 'vendor', 'item', 'quantity', 'price_minor', 'location', 'transdate', 'description', 'expiryDate'];

export const quotationsFunctions: Record<string, BackendCall> = {
  // Positional args: [0] business, [1] ledger, [2] direction ('AR'|'AP'|'').
  listQuotations: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, ledger, directionRaw] = v;
    if (!business || !ledger) throw new CallError(400, 'business and ledger are both required.');
    const direction = directionRaw === 'AR' || directionRaw === 'AP' ? (directionRaw as QuotationDirection) : undefined;
    return table(QUOTATION_HEADER, listQuotations(asBusinessName(business), asLedgerName(ledger), direction));
  },
  // Positional args: [0] reference.
  getQuotation: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference] = v;
    if (!reference) throw new CallError(400, 'reference is required.');
    const quotation = getQuotation(reference);
    if (!quotation) throw new CallError(404, `No real quotation/RFQ named "${reference}".`);
    return table(QUOTATION_HEADER, [quotation]);
  },
  // Positional args: [0] reference, [1] business, [2] ledger, [3] customer,
  // [4] item, [5] quantity, [6] price_minor, [7] location, [8] transdate,
  // [9] description, [10] expiryDate.
  createQuotation: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference, business, ledger, customer, item, quantityRaw, priceMinorRaw, location, transdate, description, expiryDate] = v;
    if (!reference || !business || !ledger || !customer || !item || !quantityRaw || !priceMinorRaw) {
      throw new CallError(400, 'reference, business, ledger, customer, item, quantity and price_minor are all required.');
    }
    createQuotation(
      {
        reference,
        business,
        ledger,
        customer,
        item,
        quantity: Number(quantityRaw),
        price_minor: Number(priceMinorRaw),
        location: location || undefined,
        transdate: transdate || new Date().toISOString().slice(0, 10),
        description: description || undefined,
      },
      asUserId(admin.id),
      expiryDate || null
    );
    return row();
  },
  // Positional args: [0] reference, [1] business, [2] ledger, [3] vendor,
  // [4] item, [5] quantity, [6] price_minor, [7] location, [8] transdate,
  // [9] description, [10] expiryDate.
  createRfq: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference, business, ledger, vendor, item, quantityRaw, priceMinorRaw, location, transdate, description, expiryDate] = v;
    if (!reference || !business || !ledger || !vendor || !item || !quantityRaw || !priceMinorRaw) {
      throw new CallError(400, 'reference, business, ledger, vendor, item, quantity and price_minor are all required.');
    }
    createRfq(
      {
        reference,
        business,
        ledger,
        vendor,
        item,
        quantity: Number(quantityRaw),
        price_minor: Number(priceMinorRaw),
        location: location || undefined,
        transdate: transdate || new Date().toISOString().slice(0, 10),
        description: description || undefined,
      },
      asUserId(admin.id),
      expiryDate || null
    );
    return row();
  },
  // Positional args: [0] reference.
  markQuotationSent: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference] = v;
    if (!reference) throw new CallError(400, 'reference is required.');
    try {
      markQuotationSent(reference, asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      throw err;
    }
  },
  // Positional args: [0] reference.
  acceptQuotation: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference] = v;
    if (!reference) throw new CallError(400, 'reference is required.');
    try {
      acceptQuotation(reference, asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      if (err instanceof PostingError || err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] reference.
  rejectQuotation: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference] = v;
    if (!reference) throw new CallError(400, 'reference is required.');
    try {
      rejectQuotation(reference, asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
};
