// Converted from routes/quotations.ts. Mounted (old route) with
// requireAuth + requireRole('Administrator','Bookkeeper') for the whole
// router — replicated per-function here. createQuotation/createRfq also
// take recurrence/recurrenceCount params in db-quotations.ts, but neither
// the old route's own schema nor the frontend ever passed them — not
// ported here either, matching real prior behavior exactly.
import {
  createQuotation,
  createRfq,
  getQuotation,
  listQuotations,
  markQuotationSent,
  acceptQuotation,
  rejectQuotation,
  addQuotationLine,
  getQuotationLines,
  asBusinessName,
  asLedgerName,
  asUserId,
  PostingError,
  ValidationError,
  NotFoundError,
  type QuotationDirection,
  type BomLineKind,
} from '../db.js';
import { CallError, requireRole, row, table, type BackendCall } from '../call-dispatch.js';

const QUOTATION_HEADER: (keyof import('../db.js').QuotationRecord)[] = ['reference', 'direction', 'status', 'business', 'ledger', 'customer', 'vendor', 'item', 'quantity', 'price_minor', 'location', 'transdate', 'description', 'expiryDate', 'targetCompletionDate'];
const QUOTATION_LINE_HEADER: (keyof import('../db.js').BomComponentLine)[] = ['component', 'quantity', 'unit', 'kind', 'durationHours', 'scheduledStart', 'scheduledEnd', 'priceMinor'];

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
  // [9] description, [10] expiryDate, [11] targetCompletionDate? (Stage-4
  // widening — only meaningful once Recipe lines are attached via
  // addQuotationLine, below; every pre-existing caller omits it).
  createQuotation: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference, business, ledger, customer, item, quantityRaw, priceMinorRaw, location, transdate, description, expiryDate, targetCompletionDate] = v;
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
        targetCompletionDate: targetCompletionDate || undefined,
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
  // Positional args: [0] reference, [1] kind ('Material'|'Labour'|'Plant'),
  // [2] resourceOrItemName, [3] quantity, [4] unit, [5] priceMinor,
  // [6] durationHours?, [7] scheduledStart? (Labour/Plant lines only).
  // Stages then immediately posts, then returns the full, updated line
  // list — same two-step-collapsed-into-one shape as items.ts's own
  // setBomComponent, which this calls through to under the hood.
  addQuotationLine: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference, kindRaw, resourceOrItemName, quantityRaw, unit, priceMinorRaw, durationRaw, scheduledStart] = v;
    if (!reference || !kindRaw || !resourceOrItemName || !quantityRaw || !unit || !priceMinorRaw) {
      throw new CallError(400, 'reference, kind, resourceOrItemName, quantity, unit and priceMinor are all required.');
    }
    if (kindRaw !== 'Material' && kindRaw !== 'Labour' && kindRaw !== 'Plant') {
      throw new CallError(400, `kind must be Material, Labour or Plant — got "${kindRaw}".`);
    }
    try {
      addQuotationLine(
        reference,
        kindRaw as BomLineKind,
        resourceOrItemName,
        Number(quantityRaw),
        unit,
        Number(priceMinorRaw),
        asUserId(admin.id),
        durationRaw ? Number(durationRaw) : undefined,
        scheduledStart || undefined
      );
      return table(
        QUOTATION_LINE_HEADER,
        getQuotationLines(reference).map((l) => ({ ...l, durationHours: l.durationHours ?? '', scheduledStart: l.scheduledStart ?? '', scheduledEnd: l.scheduledEnd ?? '', priceMinor: l.priceMinor ?? '' }))
      );
    } catch (err) {
      if (err instanceof ValidationError || err instanceof NotFoundError) throw new CallError(404, err.message);
      throw err;
    }
  },
  // Positional args: [0] reference.
  getQuotationLines: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference] = v;
    if (!reference) throw new CallError(400, 'reference is required.');
    return table(
      QUOTATION_LINE_HEADER,
      getQuotationLines(reference).map((l) => ({ ...l, durationHours: l.durationHours ?? '', scheduledStart: l.scheduledStart ?? '', scheduledEnd: l.scheduledEnd ?? '', priceMinor: l.priceMinor ?? '' }))
    );
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
  // Positional args: [0] reference, [1] projectName? (Stage-4 widening —
  // when given with [2], and the quotation carries real Recipe lines,
  // also creates the real Live Project + Invoicing Milestone and
  // schedules every Labour/Plant line; omitted by every pre-existing
  // caller, which is unaffected), [2] targetCompletionDate?.
  acceptQuotation: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference, projectName, targetCompletionDate] = v;
    if (!reference) throw new CallError(400, 'reference is required.');
    try {
      acceptQuotation(reference, asUserId(admin.id), projectName && targetCompletionDate ? { projectName, targetCompletionDate } : undefined);
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
