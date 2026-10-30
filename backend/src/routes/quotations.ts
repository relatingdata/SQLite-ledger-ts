import { Router } from 'express';
import { z } from 'zod';
import {
  createQuotation,
  createRfq,
  getQuotation,
  listQuotations,
  markQuotationSent,
  acceptQuotation,
  rejectQuotation,
  asBusinessName,
  asLedgerName,
  asUserId,
  PostingError,
  ValidationError,
  NotFoundError,
} from '../db.js';

export const quotationsRouter = Router();

quotationsRouter.get('/', (req, res) => {
  const business = String(req.query.business ?? '');
  const ledger = String(req.query.ledger ?? '');
  if (!business || !ledger) return res.status(400).json({ error: 'business and ledger are both required.' });
  const direction = req.query.direction === 'AR' || req.query.direction === 'AP' ? req.query.direction : undefined;
  res.json(listQuotations(asBusinessName(business), asLedgerName(ledger), direction));
});

quotationsRouter.get('/:reference', (req, res) => {
  const quotation = getQuotation(req.params.reference);
  if (!quotation) return res.status(404).json({ error: `No real quotation/RFQ named "${req.params.reference}".` });
  res.json(quotation);
});

const base = {
  reference: z.string().min(1),
  business: z.string().min(1),
  ledger: z.string().min(1),
  item: z.string().min(1),
  quantity: z.number().int().positive(),
  price_minor: z.number().int().positive(),
  location: z.string().optional(),
  transdate: z.string().optional(),
  description: z.string().optional(),
  expiryDate: z.string().optional(),
};

const quotationSchema = z.object({ ...base, customer: z.string().min(1) });
quotationsRouter.put('/quotation', (req, res) => {
  const parsed = quotationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { expiryDate, transdate, ...input } = parsed.data;
  createQuotation({ ...input, transdate: transdate ?? new Date().toISOString().slice(0, 10) }, asUserId(req.user!.id), expiryDate ?? null);
  res.status(204).end();
});

const rfqSchema = z.object({ ...base, vendor: z.string().min(1) });
quotationsRouter.put('/rfq', (req, res) => {
  const parsed = rfqSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { expiryDate, transdate, ...input } = parsed.data;
  createRfq({ ...input, transdate: transdate ?? new Date().toISOString().slice(0, 10) }, asUserId(req.user!.id), expiryDate ?? null);
  res.status(204).end();
});

quotationsRouter.post('/:reference/sent', (req, res) => {
  try {
    markQuotationSent(req.params.reference, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not mark as sent.' });
  }
});

quotationsRouter.post('/:reference/accept', (req, res) => {
  try {
    acceptQuotation(req.params.reference, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    if (err instanceof PostingError || err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not accept.' });
  }
});

quotationsRouter.post('/:reference/reject', (req, res) => {
  try {
    rejectQuotation(req.params.reference, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not reject.' });
  }
});
