// Converted from routes/invoices.ts (and its four sibling routers -
// agedRouter/statementRouter/historyRouter/remindersRouter, all defined
// in the same file). Every one of these five routers was mounted behind
// its own blanket requireAuth in server.ts; the mutating endpoints
// further require Administrator or Bookkeeper, replicated per-function
// here, same as every other file in this rollout.
import {
  createInvoice,
  getInvoice,
  listInvoices,
  countInvoices,
  postInvoice,
  allocatePayment,
  getInvoiceOutstandingMinor,
  getAgedInvoices,
  getAgedSummary,
  getCustomerStatement,
  getCounterpartyHistory,
  recordReminderSent,
  resetReminderLevel,
  getReminderCandidates,
  exportInvoiceAsUbl,
  importUblInvoiceAsDraft,
  getPickingList,
  confirmPickedLine,
  dispatchOrderFromPickingList,
  asBusinessName,
  asLedgerName,
  asLocationName,
  asCustomerName,
  asProviderName,
  ValidationError,
  NotFoundError,
  asUserId,
  type Invoice,
} from '../db.js';
import { CallError, encodeRecordList, encodeStringList, requireAuth, requireRole, row, table, type BackendCall } from '../call-dispatch.js';

const INVOICE_LINE_FIELDS: ('id' | 'description' | 'quantity' | 'unitPriceMinor' | 'amountMinor' | 'taxMinor' | 'itemName' | 'dispatchReference')[] = [
  'id',
  'description',
  'quantity',
  'unitPriceMinor',
  'amountMinor',
  'taxMinor',
  'itemName',
  'dispatchReference',
];

// Shared by getInvoiceById (one invoice) and listInvoices (an array of
// them) - encoded once, reused both ways, same discipline as reports.ts's
// own encodeProfitAndLoss.
function encodeInvoice(inv: Invoice): string {
  return encodeStringList([
    String(inv.id),
    inv.invoice_type,
    inv.document_type,
    inv.references_invoice_id == null ? '' : String(inv.references_invoice_id),
    inv.business,
    inv.ledger,
    inv.reference,
    inv.counterparty,
    inv.invoice_date,
    inv.due_date ?? '',
    inv.description,
    inv.status,
    inv.posted_by ?? '',
    inv.source,
    encodeRecordList(
      INVOICE_LINE_FIELDS,
      inv.lines.map((l) => ({
        id: String(l.id),
        description: l.description,
        quantity: l.quantity == null ? '' : String(l.quantity),
        unitPriceMinor: l.unitPriceMinor == null ? '' : String(l.unitPriceMinor),
        amountMinor: String(l.amountMinor),
        taxMinor: String(l.taxMinor ?? 0),
        itemName: l.itemName ?? '',
        dispatchReference: l.dispatchReference ?? '',
      }))
    ),
    String(inv.total_amount_minor),
    String(inv.total_tax_minor),
  ]);
}

export const invoicesFunctions: Record<string, BackendCall> = {
  // Combines the old route's own listInvoices+countInvoices (one JSON
  // response, {rows, totalCount}) into one dispatch entry the same way.
  listInvoices: (v, user) => {
    requireAuth(user);
    const [business, ledger, invoiceTypeRaw, sourceRaw, limitRaw, offsetRaw] = v;
    if (!business || !ledger) throw new CallError(400, 'business and ledger are required.');
    const invoiceType = (invoiceTypeRaw || undefined) as 'AR' | 'AP' | undefined;
    const source = (sourceRaw || 'manual') as 'manual' | 'pos' | 'all';
    const limit = limitRaw ? Number(limitRaw) : 50;
    const offset = offsetRaw ? Number(offsetRaw) : 0;
    const rows = listInvoices(asBusinessName(business), asLedgerName(ledger), { invoiceType, source, limit, offset });
    const totalCount = countInvoices(asBusinessName(business), asLedgerName(ledger), invoiceType, source);
    return row(String(totalCount), encodeStringList(rows.map(encodeInvoice)));
  },

  getInvoiceById: (v, user) => {
    requireAuth(user);
    const [id] = v;
    if (!id) throw new CallError(400, 'id is required.');
    const invoice = getInvoice(Number(id));
    return row(invoice ? '1' : '0', invoice ? encodeInvoice(invoice) : '');
  },

  createInvoice: (v, user, lineItems) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [invoiceType, business, ledger, reference, counterpartyName, invoiceDate, description] = v;
    if (!invoiceType || !business || !ledger || !reference || !counterpartyName || !invoiceDate) {
      throw new CallError(400, 'invoiceType, business, ledger, reference, counterpartyName and invoiceDate are all required.');
    }
    if (lineItems.length === 0) throw new CallError(400, 'At least one invoice line is required.');
    const lines = lineItems.map(([desc, quantity, unitPriceMinor, amountMinor, taxMinor, itemName, dispatchReference]) => ({
      description: desc,
      quantity: quantity ? Number(quantity) : null,
      unitPriceMinor: unitPriceMinor ? Number(unitPriceMinor) : null,
      amountMinor: Number(amountMinor),
      taxMinor: taxMinor ? Number(taxMinor) : 0,
      itemName: itemName || null,
      dispatchReference: dispatchReference || null,
    }));
    try {
      const id = createInvoice({ invoiceType: invoiceType as 'AR' | 'AP', business, ledger, reference, counterpartyName, invoiceDate, description, lines }, asUserId(admin.id));
      return row(String(id));
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not create invoice.');
    }
  },

  postInvoiceById: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [id, revenueOrExpenseAccount, taxAccount, restockInventoryRaw] = v;
    if (!id || !revenueOrExpenseAccount || !taxAccount) throw new CallError(400, 'id, revenueOrExpenseAccount and taxAccount are all required.');
    try {
      postInvoice(Number(id), revenueOrExpenseAccount, taxAccount, asUserId(admin.id), restockInventoryRaw === 'true');
      return row();
    } catch (err) {
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not post invoice.');
    }
  },

  // Matches the old route's own exact behavior - no generic catch-all at
  // all, only NotFoundError is translated; anything else propagates
  // uncaught, same as the old route's own `throw err`.
  getInvoiceOutstanding: (v, user) => {
    requireAuth(user);
    const [id] = v;
    if (!id) throw new CallError(400, 'id is required.');
    try {
      return row(String(getInvoiceOutstandingMinor(Number(id))));
    } catch (err) {
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      throw err;
    }
  },

  allocatePaymentToInvoice: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [id, paymentReference, allocatedMinor, allocationDate, paymentAccount] = v;
    if (!id || !paymentReference || !allocatedMinor || !allocationDate || !paymentAccount) {
      throw new CallError(400, 'id, paymentReference, allocatedMinor, allocationDate and paymentAccount are all required.');
    }
    try {
      allocatePayment(Number(id), paymentReference, Number(allocatedMinor), allocationDate, paymentAccount, asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not allocate payment.');
    }
  },

  // A real, exported UBL 2.1 XML document. The old route served it as a
  // downloadable file (Content-Disposition: attachment) - but the one
  // live frontend caller (invoices/+page.svelte's downloadEInvoice)
  // already builds its own Blob/download link client-side from the raw
  // text, never relying on that header, so carrying the XML back as one
  // ordinary csvField-escaped row value (which handles embedded commas/
  // quotes/newlines exactly like any other string) loses nothing real.
  exportInvoiceAsEInvoice: (v, user) => {
    requireAuth(user);
    const [id] = v;
    if (!id) throw new CallError(400, 'id is required.');
    try {
      return row(exportInvoiceAsUbl(Number(id)));
    } catch (err) {
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not export this invoice as a real e-invoice.');
    }
  },

  importEInvoice: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [xml, business, ledger, vendorName, poReference] = v;
    if (!xml || !business || !ledger || !vendorName) throw new CallError(400, 'xml, business, ledger and vendorName are all required.');
    try {
      const result = importUblInvoiceAsDraft(xml, asBusinessName(business), asLedgerName(ledger), asProviderName(vendorName), asUserId(admin.id), poReference || undefined);
      return row(String(result.invoiceId), encodeRecordList(['field', 'poValue', 'invoiceValue'], result.discrepancies));
    } catch (err) {
      // Matches the old route's own deliberately narrower gate here -
      // 400, not the usual 409, for a ValidationError.
      if (err instanceof ValidationError) throw new CallError(400, err.message);
      console.error(err);
      throw new CallError(500, 'Could not import this e-invoice.');
    }
  },

  // No live frontend caller anywhere (grep-confirmed - this whole sales-
  // order-picking-fulfillment path is dead on the frontend today, unlike
  // the unrelated, differently-shaped restock picking list in
  // locations.ts) - built anyway for a complete backend surface.
  getPickingList: (v, user) => {
    requireAuth(user);
    const [invoiceId, locationName] = v;
    if (!invoiceId || !locationName) throw new CallError(400, 'invoiceId and locationName are both required.');
    try {
      return table(
        ['invoiceLineId', 'item', 'quantity', 'shelfSide', 'rack', 'level', 'picked'],
        getPickingList(Number(invoiceId), asLocationName(locationName)).map((l) => ({
          invoiceLineId: String(l.invoiceLineId),
          item: l.item,
          quantity: String(l.quantity),
          shelfSide: l.shelfSide ?? '',
          rack: l.rack ?? '',
          level: l.level == null ? '' : String(l.level),
          picked: String(l.picked),
        }))
      );
    } catch (err) {
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not load the real picking list.');
    }
  },

  // No live frontend caller anywhere (grep-confirmed) - built anyway.
  confirmPickedLine: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [invoiceId, invoiceLineId, business, ledger] = v;
    if (!invoiceId || !invoiceLineId || !business || !ledger) throw new CallError(400, 'invoiceId, invoiceLineId, business and ledger are all required.');
    try {
      confirmPickedLine(Number(invoiceId), Number(invoiceLineId), asBusinessName(business), asLedgerName(ledger), asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      console.error(err);
      throw new CallError(500, 'Could not confirm this line as picked.');
    }
  },

  // No live frontend caller anywhere (grep-confirmed) - built anyway.
  dispatchOrderFromPickingList: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [invoiceId, locationName, revenueAccount, taxAccount] = v;
    if (!invoiceId || !locationName || !revenueAccount || !taxAccount) throw new CallError(400, 'invoiceId, locationName, revenueAccount and taxAccount are all required.');
    try {
      dispatchOrderFromPickingList(Number(invoiceId), asLocationName(locationName), revenueAccount, taxAccount, asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not dispatch this order.');
    }
  },

  getAgedInvoices: (v, user) => {
    requireAuth(user);
    const [business, ledger, invoiceType, asOfDateRaw] = v;
    if (!business || !ledger || !invoiceType) throw new CallError(400, 'business, ledger, and type are required.');
    const asOfDate = asOfDateRaw || new Date().toISOString().slice(0, 10);
    return table(
      ['invoice_id', 'reference', 'counterparty', 'invoice_date', 'due_date', 'outstanding_minor', 'days_overdue', 'bucket'],
      getAgedInvoices(asBusinessName(business), asLedgerName(ledger), invoiceType as 'AR' | 'AP', asOfDate).map((r) => ({
        invoice_id: String(r.invoice_id),
        reference: r.reference,
        counterparty: r.counterparty,
        invoice_date: r.invoice_date,
        due_date: r.due_date ?? '',
        outstanding_minor: String(r.outstanding_minor),
        days_overdue: String(r.days_overdue),
        bucket: r.bucket,
      }))
    );
  },

  getAgedSummary: (v, user) => {
    requireAuth(user);
    const [business, ledger, invoiceType, asOfDateRaw] = v;
    if (!business || !ledger || !invoiceType) throw new CallError(400, 'business, ledger, and type are required.');
    const asOfDate = asOfDateRaw || new Date().toISOString().slice(0, 10);
    return table(
      ['counterparty', 'outstanding_minor', 'oldest_days_overdue'],
      getAgedSummary(asBusinessName(business), asLedgerName(ledger), invoiceType as 'AR' | 'AP', asOfDate).map((r) => ({
        counterparty: r.counterparty,
        outstanding_minor: String(r.outstanding_minor),
        oldest_days_overdue: String(r.oldest_days_overdue),
      }))
    );
  },

  getCustomerStatement: (v, user) => {
    requireAuth(user);
    const [business, ledger, customer, asOfDateRaw] = v;
    if (!business || !ledger || !customer) throw new CallError(400, 'business, ledger, and customer are required.');
    const asOfDate = asOfDateRaw || new Date().toISOString().slice(0, 10);
    const statement = getCustomerStatement(asBusinessName(business), asLedgerName(ledger), asCustomerName(customer), asOfDate);
    return row(
      statement.customer,
      statement.as_of_date,
      encodeRecordList(
        ['invoice_id', 'reference', 'invoice_date', 'due_date', 'total_minor', 'paid_minor', 'outstanding_minor', 'status'],
        statement.lines.map((l) => ({
          invoice_id: String(l.invoice_id),
          reference: l.reference,
          invoice_date: l.invoice_date,
          due_date: l.due_date ?? '',
          total_minor: String(l.total_minor),
          paid_minor: String(l.paid_minor),
          outstanding_minor: String(l.outstanding_minor),
          status: l.status,
        }))
      ),
      String(statement.total_outstanding_minor)
    );
  },

  getCounterpartyHistory: (v, user) => {
    requireAuth(user);
    const [business, ledger, counterparty] = v;
    if (!business || !ledger || !counterparty) throw new CallError(400, 'business, ledger, and counterparty are required.');
    return table(
      ['invoice_reference', 'invoice_date', 'document_type', 'description', 'quantity', 'unit_price_minor', 'amount_minor'],
      getCounterpartyHistory(asBusinessName(business), asLedgerName(ledger), counterparty).map((l) => ({
        invoice_reference: l.invoice_reference,
        invoice_date: l.invoice_date,
        document_type: l.document_type,
        description: l.description,
        quantity: l.quantity == null ? '' : String(l.quantity),
        unit_price_minor: l.unit_price_minor == null ? '' : String(l.unit_price_minor),
        amount_minor: String(l.amount_minor),
      }))
    );
  },

  getReminderCandidates: (v, user) => {
    requireAuth(user);
    const [business, ledger, asOfDateRaw] = v;
    if (!business || !ledger) throw new CallError(400, 'business and ledger are required.');
    const asOfDate = asOfDateRaw || new Date().toISOString().slice(0, 10);
    return table(
      ['counterparty', 'current_level', 'next_level', 'outstanding_minor', 'oldest_days_overdue'],
      getReminderCandidates(asBusinessName(business), asLedgerName(ledger), asOfDate).map((r) => ({
        counterparty: r.counterparty,
        current_level: String(r.current_level),
        next_level: String(r.next_level),
        outstanding_minor: String(r.outstanding_minor),
        oldest_days_overdue: String(r.oldest_days_overdue),
      }))
    );
  },

  // Matches the old route's own exact behavior - only ValidationError is
  // translated; anything else propagates uncaught (old route's own
  // `throw err`).
  sendReminder: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [counterparty] = v;
    if (!counterparty) throw new CallError(400, 'counterparty is required.');
    try {
      return row(String(recordReminderSent(counterparty)));
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },

  resetReminder: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [counterparty] = v;
    if (!counterparty) throw new CallError(400, 'counterparty is required.');
    try {
      resetReminderLevel(counterparty);
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
};
