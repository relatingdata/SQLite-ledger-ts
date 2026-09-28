import { Router } from 'express';
import { z } from 'zod';
import {
  stageARSale,
  postARSale,
  stageARReceipt,
  postARReceipt,
  stageAPPurchase,
  postAPPurchase,
  stageAPPayment,
  postAPPayment,
  asBusinessName,
  asLedgerName,
  asCustomerName,
  asVendorName,
  asAccountName,
  asLocationName,
  PostingError,
  type BusinessName,
  type LedgerName,
  type UserId,
  asUserId,
} from '../db.js';

export const arAPRouter = Router();

const baseSchema = {
  reference: z.string().min(1),
  business: z.string().min(1),
  ledger: z.string().min(1),
  amount_minor: z.number().int().positive(),
  transdate: z.string().optional(),
  description: z.string().optional(),
};

function handlePost(fn: (reference: string, business: BusinessName, ledger: LedgerName, userId: UserId) => void) {
  return (req: import('express').Request, res: import('express').Response) => {
    const { reference, business, ledger } = req.body;
    try {
      fn(reference, asBusinessName(business), asLedgerName(ledger), asUserId(req.user!.id));
      res.status(204).end();
    } catch (err) {
      if (err instanceof PostingError) return res.status(409).json({ error: err.message });
      console.error(err);
      res.status(500).json({ error: 'Could not post entry.' });
    }
  };
}

const arSaleSchema = z.object({ ...baseSchema, customer: z.string().min(1), tax_minor: z.number().int().nonnegative().optional(), location: z.string().min(1).optional() });
arAPRouter.post('/ar-sale/stage', (req, res) => {
  const parsed = arSaleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  stageARSale({
    ...parsed.data,
    business: asBusinessName(parsed.data.business),
    ledger: asLedgerName(parsed.data.ledger),
    customer: asCustomerName(parsed.data.customer),
    location: parsed.data.location ? asLocationName(parsed.data.location) : undefined,
  });
  res.status(204).end();
});
arAPRouter.post('/ar-sale/post', handlePost(postARSale));

const arReceiptSchema = z.object({ ...baseSchema, customer: z.string().min(1) });
arAPRouter.post('/ar-receipt/stage', (req, res) => {
  const parsed = arReceiptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  stageARReceipt({
    ...parsed.data,
    business: asBusinessName(parsed.data.business),
    ledger: asLedgerName(parsed.data.ledger),
    customer: asCustomerName(parsed.data.customer),
  });
  res.status(204).end();
});
arAPRouter.post('/ar-receipt/post', handlePost(postARReceipt));

const apPurchaseSchema = z.object({ ...baseSchema, vendor: z.string().min(1), expense_account: z.string().min(1), tax_minor: z.number().int().nonnegative().optional(), location: z.string().min(1).optional() });
arAPRouter.post('/ap-purchase/stage', (req, res) => {
  const parsed = apPurchaseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  stageAPPurchase({
    ...parsed.data,
    business: asBusinessName(parsed.data.business),
    ledger: asLedgerName(parsed.data.ledger),
    vendor: asVendorName(parsed.data.vendor),
    expense_account: asAccountName(parsed.data.expense_account),
    location: parsed.data.location ? asLocationName(parsed.data.location) : undefined,
  });
  res.status(204).end();
});
arAPRouter.post('/ap-purchase/post', handlePost(postAPPurchase));

const apPaymentSchema = z.object({ ...baseSchema, vendor: z.string().min(1) });
arAPRouter.post('/ap-payment/stage', (req, res) => {
  const parsed = apPaymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  stageAPPayment({
    ...parsed.data,
    business: asBusinessName(parsed.data.business),
    ledger: asLedgerName(parsed.data.ledger),
    vendor: asVendorName(parsed.data.vendor),
  });
  res.status(204).end();
});
arAPRouter.post('/ap-payment/post', handlePost(postAPPayment));
