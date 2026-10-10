// Real, live routes used by PaymentReceipt.svelte only. The ar-sale and
// ap-purchase routes that used to live here were removed entirely
// (docs/canned-journal-to-frontend-design.md) — confirmed dead on both
// ends (frontend/src/lib/api.ts's own calls into them were commented
// out). These two pairs stay, unchanged, because they are genuinely live.
import { Router } from 'express';
import { z } from 'zod';
import {
  stageARReceipt,
  postARReceipt,
  stageAPPayment,
  postAPPayment,
  PostingError,
  asBusinessName,
  asLedgerName,
  asCustomerName,
  asProviderName,
  asUserId,
} from '../db.js';

export const arAPRouter = Router();

const receiptStageSchema = z.object({
  reference: z.string().min(1),
  business: z.string().min(1),
  ledger: z.string().min(1),
  customer: z.string().min(1),
  amount_minor: z.number().int(),
  transdate: z.string().optional(),
  description: z.string().optional(),
});

arAPRouter.post('/ar-receipt/stage', (req, res) => {
  const parsed = receiptStageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    stageARReceipt({
      ...parsed.data,
      business: asBusinessName(parsed.data.business),
      ledger: asLedgerName(parsed.data.ledger),
      customer: asCustomerName(parsed.data.customer),
    });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not stage receipt.' });
  }
});

const postSchema = z.object({
  reference: z.string().min(1),
  business: z.string().min(1),
  ledger: z.string().min(1),
});

arAPRouter.post('/ar-receipt/post', (req, res) => {
  const parsed = postSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    postARReceipt(parsed.data.reference, asBusinessName(parsed.data.business), asLedgerName(parsed.data.ledger), asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof PostingError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not post receipt.' });
  }
});

const paymentStageSchema = z.object({
  reference: z.string().min(1),
  business: z.string().min(1),
  ledger: z.string().min(1),
  vendor: z.string().min(1),
  amount_minor: z.number().int(),
  transdate: z.string().optional(),
  description: z.string().optional(),
});

arAPRouter.post('/ap-payment/stage', (req, res) => {
  const parsed = paymentStageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    stageAPPayment({
      ...parsed.data,
      business: asBusinessName(parsed.data.business),
      ledger: asLedgerName(parsed.data.ledger),
      vendor: asProviderName(parsed.data.vendor),
    });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not stage payment.' });
  }
});

arAPRouter.post('/ap-payment/post', (req, res) => {
  const parsed = postSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    postAPPayment(parsed.data.reference, asBusinessName(parsed.data.business), asLedgerName(parsed.data.ledger), asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof PostingError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not post payment.' });
  }
});
