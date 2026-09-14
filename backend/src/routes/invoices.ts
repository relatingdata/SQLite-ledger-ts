import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth-middleware.js';
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
  asAccountName,
  asLocationName,
  asCustomerName,
  asVendorName,
  ValidationError,
  NotFoundError,
  asUserId,
} from '../db.js';

export const invoicesRouter = Router();

invoicesRouter.get('/', (req, res) => {
  const business = req.query.business as string;
  const ledger = req.query.ledger as string;
  const invoiceType = req.query.type as 'AR' | 'AP' | undefined;
  const source = (req.query.source as 'manual' | 'pos' | 'all' | undefined) ?? 'manual';
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  if (!business || !ledger) return res.status(400).json({ error: 'business and ledger are required.' });
  res.json({
    rows: listInvoices(asBusinessName(business), asLedgerName(ledger), { invoiceType, source, limit, offset }),
    totalCount: countInvoices(asBusinessName(business), asLedgerName(ledger), invoiceType, source),
  });
});

invoicesRouter.get('/:id', (req, res) => {
  const invoice = getInvoice(Number(req.params.id));
  if (!invoice) return res.status(404).json({ error: 'No such invoice.' });
  res.json(invoice);
});

const lineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().nullable().optional(),
  unitPriceMinor: z.number().int().nullable().optional(),
  amountMinor: z.number().int(),
  taxMinor: z.number().int().nonnegative().optional(),
  itemName: z.string().nullable().optional(),
  dispatchReference: z.string().nullable().optional(),
});

const invoiceSchema = z.object({
  invoiceType: z.enum(['AR', 'AP']),
  business: z.string().min(1),
  ledger: z.string().min(1),
  reference: z.string().min(1),
  counterpartyName: z.string().min(1),
  invoiceDate: z.string().min(1),
  description: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});

invoicesRouter.post('/', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const id = createInvoice(parsed.data, asUserId(req.user!.id));
    res.status(201).json({ id });
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not create invoice.' });
  }
});

const postSchema = z.object({ revenueOrExpenseAccount: z.string().min(1), taxAccount: z.string().min(1), restockInventory: z.boolean().optional() });

invoicesRouter.post('/:id/post', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = postSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    postInvoice(Number(req.params.id), parsed.data.revenueOrExpenseAccount, parsed.data.taxAccount, asUserId(req.user!.id), parsed.data.restockInventory ?? false);
    res.status(204).end();
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not post invoice.' });
  }
});

invoicesRouter.get('/:id/outstanding', (req, res) => {
  try {
    res.json({ outstanding_minor: getInvoiceOutstandingMinor(Number(req.params.id)) });
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    throw err;
  }
});

const allocateSchema = z.object({
  paymentReference: z.string().min(1),
  allocatedMinor: z.number().int().positive(),
  allocationDate: z.string().min(1),
  paymentAccount: z.string().min(1),
});

invoicesRouter.post('/:id/allocate', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = allocateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    allocatePayment(Number(req.params.id), parsed.data.paymentReference, parsed.data.allocatedMinor, parsed.data.allocationDate, parsed.data.paymentAccount, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not allocate payment.' });
  }
});

// A real, exported UBL 2.1 XML document — served as a real, downloadable file.
invoicesRouter.get('/:id/e-invoice', (req, res) => {
  try {
    const xml = exportInvoiceAsUbl(Number(req.params.id));
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${req.params.id}.xml"`);
    res.send(xml);
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not export this invoice as a real e-invoice.' });
  }
});

const importEInvoiceSchema = z.object({
  xml: z.string().min(1),
  business: z.string().min(1),
  ledger: z.string().min(1),
  vendorName: z.string().min(1),
  poReference: z.string().optional(),
});
invoicesRouter.post('/import-e-invoice', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = importEInvoiceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const d = parsed.data;
    const result = importUblInvoiceAsDraft(d.xml, asBusinessName(d.business), asLedgerName(d.ledger), asVendorName(d.vendorName), asUserId(req.user!.id), d.poReference);
    res.json(result);
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not import this e-invoice.' });
  }
});

invoicesRouter.get('/:id/picking-list', (req, res) => {
  const locationName = req.query.location as string;
  if (!locationName) return res.status(400).json({ error: 'location is required.' });
  try {
    res.json(getPickingList(Number(req.params.id), asLocationName(locationName)));
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not load the real picking list.' });
  }
});

const confirmPickedSchema = z.object({ invoiceLineId: z.number().int(), business: z.string().min(1), ledger: z.string().min(1) });
invoicesRouter.post('/:id/confirm-picked', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = confirmPickedSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const d = parsed.data;
    confirmPickedLine(Number(req.params.id), d.invoiceLineId, asBusinessName(d.business), asLedgerName(d.ledger), asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not confirm this line as picked.' });
  }
});

const dispatchOrderSchema = z.object({ locationName: z.string().min(1), revenueAccount: z.string().min(1), taxAccount: z.string().min(1) });
invoicesRouter.post('/:id/dispatch-order', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = dispatchOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const d = parsed.data;
    dispatchOrderFromPickingList(Number(req.params.id), asLocationName(d.locationName), d.revenueAccount, d.taxAccount, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not dispatch this order.' });
  }
});

export const agedRouter = Router();
agedRouter.get('/', (req, res) => {
  const business = req.query.business as string;
  const ledger = req.query.ledger as string;
  const invoiceType = req.query.type as 'AR' | 'AP';
  const asOfDate = (req.query.asOfDate as string) || new Date().toISOString().slice(0, 10);
  if (!business || !ledger || !invoiceType) return res.status(400).json({ error: 'business, ledger, and type are required.' });
  res.json(getAgedInvoices(asBusinessName(business), asLedgerName(ledger), invoiceType, asOfDate));
});
agedRouter.get('/summary', (req, res) => {
  const business = req.query.business as string;
  const ledger = req.query.ledger as string;
  const invoiceType = req.query.type as 'AR' | 'AP';
  const asOfDate = (req.query.asOfDate as string) || new Date().toISOString().slice(0, 10);
  if (!business || !ledger || !invoiceType) return res.status(400).json({ error: 'business, ledger, and type are required.' });
  res.json(getAgedSummary(asBusinessName(business), asLedgerName(ledger), invoiceType, asOfDate));
});

export const statementRouter = Router();
statementRouter.get('/', (req, res) => {
  const business = req.query.business as string;
  const ledger = req.query.ledger as string;
  const customer = req.query.customer as string;
  const asOfDate = (req.query.asOfDate as string) || new Date().toISOString().slice(0, 10);
  if (!business || !ledger || !customer) return res.status(400).json({ error: 'business, ledger, and customer are required.' });
  res.json(getCustomerStatement(asBusinessName(business), asLedgerName(ledger), asCustomerName(customer), asOfDate));
});

export const historyRouter = Router();
historyRouter.get('/', (req, res) => {
  const business = req.query.business as string;
  const ledger = req.query.ledger as string;
  const counterparty = req.query.counterparty as string;
  if (!business || !ledger || !counterparty) return res.status(400).json({ error: 'business, ledger, and counterparty are required.' });
  res.json(getCounterpartyHistory(asBusinessName(business), asLedgerName(ledger), counterparty));
});

export const remindersRouter = Router();
remindersRouter.get('/', (req, res) => {
  const business = req.query.business as string;
  const ledger = req.query.ledger as string;
  const asOfDate = (req.query.asOfDate as string) || new Date().toISOString().slice(0, 10);
  if (!business || !ledger) return res.status(400).json({ error: 'business and ledger are required.' });
  res.json(getReminderCandidates(asBusinessName(business), asLedgerName(ledger), asOfDate));
});
remindersRouter.post('/:counterparty/send', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  try {
    const newLevel = recordReminderSent(req.params.counterparty);
    res.json({ new_level: newLevel });
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    throw err;
  }
});
remindersRouter.post('/:counterparty/reset', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  try {
    resetReminderLevel(req.params.counterparty);
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    throw err;
  }
});
