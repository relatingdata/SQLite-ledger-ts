// Converted from routes/stock.ts. Mounted (old route) with requireAuth +
// requireRole('Administrator','Bookkeeper') for the whole router —
// replicated per-function here. Every stage*/post* pair here is a
// plain stage-then-post flow (PO/SO stock receipt/dispatch staging),
// flat positional args throughout, no line-items array.
import {
  stagePurchaseOrder,
  postPurchaseOrder,
  stageOrderReceipt,
  postOrderReceipt,
  stageSalesOrder,
  postSalesOrder,
  stageOrderDispatch,
  postOrderDispatch,
  PostingError,
} from '../db-journal.js';
import { getOrderStatus } from '../db-stock.js';
import { asBusinessName, asLedgerName, ValidationError, NotFoundError, asUserId } from '../db.js';
import { CallError, requireRole, row, type BackendCall } from '../call-dispatch.js';

export const stockFunctions: Record<string, BackendCall> = {
  // Positional args: [0] reference, [1] business, [2] ledger, [3] vendor,
  // [4] item, [5] quantity, [6] price_minor, [7] location, [8] transdate,
  // [9] description.
  stagePurchaseOrder: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference, business, ledger, vendor, item, quantityRaw, priceMinorRaw, location, transdate, description] = v;
    if (!reference || !business || !ledger || !vendor || !item || !quantityRaw || !priceMinorRaw) {
      throw new CallError(400, 'reference, business, ledger, vendor, item, quantity and price_minor are all required.');
    }
    stagePurchaseOrder({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), vendor, item, quantity: Number(quantityRaw), price_minor: Number(priceMinorRaw), location: location || undefined, transdate: transdate || undefined, description: description || undefined });
    return row();
  },
  // Positional args: [0] reference, [1] business, [2] ledger.
  postPurchaseOrder: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference, business, ledger] = v;
    if (!reference || !business || !ledger) throw new CallError(400, 'reference, business and ledger are all required.');
    try {
      postPurchaseOrder(reference, asBusinessName(business), asLedgerName(ledger), asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      if (err instanceof PostingError || err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] reference.
  getOrderStatus: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference] = v;
    if (!reference) throw new CallError(400, 'reference is required.');
    const status = getOrderStatus(reference);
    return row(status.quantity, status.value_minor);
  },
  // Positional args: [0] reference, [1] business, [2] ledger,
  // [3] po_reference, [4] item, [5] item_qty, [6] vendor, [7] quantity,
  // [8] value_minor, [9] tax_minor, [10] transdate, [11] description.
  stageOrderReceipt: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference, business, ledger, po_reference, item, item_qty, vendor, quantityRaw, valueMinorRaw, taxMinorRaw, transdate, description] = v;
    if (!reference || !business || !ledger || !po_reference || !item || !vendor || !quantityRaw || !valueMinorRaw) {
      throw new CallError(400, 'reference, business, ledger, po_reference, item, vendor, quantity and value_minor are all required.');
    }
    stageOrderReceipt({
      reference,
      business: asBusinessName(business),
      ledger: asLedgerName(ledger),
      po_reference,
      item,
      item_qty: item_qty || undefined,
      vendor,
      quantity: Number(quantityRaw),
      value_minor: Number(valueMinorRaw),
      tax_minor: taxMinorRaw ? Number(taxMinorRaw) : undefined,
      transdate: transdate || undefined,
      description: description || undefined,
    });
    return row();
  },
  // Positional args: [0] reference, [1] business, [2] ledger.
  postOrderReceipt: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference, business, ledger] = v;
    if (!reference || !business || !ledger) throw new CallError(400, 'reference, business and ledger are all required.');
    try {
      postOrderReceipt(reference, asBusinessName(business), asLedgerName(ledger), asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      if (err instanceof PostingError || err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] reference, [1] business, [2] ledger,
  // [3] customer, [4] item, [5] quantity, [6] price_minor, [7] location,
  // [8] transdate, [9] description.
  stageSalesOrder: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference, business, ledger, customer, item, quantityRaw, priceMinorRaw, location, transdate, description] = v;
    if (!reference || !business || !ledger || !customer || !item || !quantityRaw || !priceMinorRaw) {
      throw new CallError(400, 'reference, business, ledger, customer, item, quantity and price_minor are all required.');
    }
    stageSalesOrder({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), customer, item, quantity: Number(quantityRaw), price_minor: Number(priceMinorRaw), location: location || undefined, transdate: transdate || undefined, description: description || undefined });
    return row();
  },
  // Positional args: [0] reference, [1] business, [2] ledger.
  postSalesOrder: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference, business, ledger] = v;
    if (!reference || !business || !ledger) throw new CallError(400, 'reference, business and ledger are all required.');
    try {
      postSalesOrder(reference, asBusinessName(business), asLedgerName(ledger), asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      if (err instanceof PostingError || err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] reference, [1] business, [2] ledger,
  // [3] so_reference, [4] item, [5] item_qty, [6] customer,
  // [7] quantity, [8] unit_cost_minor, [9] sale_price_minor,
  // [10] tax_minor, [11] transdate, [12] description.
  stageOrderDispatch: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference, business, ledger, so_reference, item, item_qty, customer, quantityRaw, unitCostMinorRaw, salePriceMinorRaw, taxMinorRaw, transdate, description] = v;
    if (!reference || !business || !ledger || !so_reference || !customer || !quantityRaw || !salePriceMinorRaw) {
      throw new CallError(400, 'reference, business, ledger, so_reference, customer, quantity and sale_price_minor are all required.');
    }
    stageOrderDispatch({
      reference,
      business: asBusinessName(business),
      ledger: asLedgerName(ledger),
      so_reference,
      item: item || undefined,
      item_qty: item_qty || undefined,
      customer,
      quantity: Number(quantityRaw),
      unit_cost_minor: unitCostMinorRaw ? Number(unitCostMinorRaw) : undefined,
      sale_price_minor: Number(salePriceMinorRaw),
      tax_minor: taxMinorRaw ? Number(taxMinorRaw) : undefined,
      transdate: transdate || undefined,
      description: description || undefined,
    });
    return row();
  },
  // Positional args: [0] reference, [1] business, [2] ledger.
  postOrderDispatch: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference, business, ledger] = v;
    if (!reference || !business || !ledger) throw new CallError(400, 'reference, business and ledger are all required.');
    try {
      postOrderDispatch(reference, asBusinessName(business), asLedgerName(ledger), asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      if (err instanceof PostingError || err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
};
