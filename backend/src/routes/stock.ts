import { Router } from 'express';
import { z } from 'zod';
import {
  stagePurchaseOrder,
  postPurchaseOrder,
  stageOrderReceipt,
  postOrderReceipt,
  stageSalesOrder,
  postSalesOrder,
  stageOrderDispatch,
  postOrderDispatch,
  getOrderStatus,
  asBusinessName,
  asLedgerName,
  PostingError,
  ValidationError,
  NotFoundError,
  type BusinessName,
  type LedgerName,
  type UserId,
  asUserId,
} from '../db.js';

export const stockRouter = Router();

function handlePost(fn: (reference: string, business: BusinessName, ledger: LedgerName, userId: UserId) => void) {
  return (req: import('express').Request, res: import('express').Response) => {
    const { reference, business, ledger } = req.body;
    try {
      fn(reference, asBusinessName(business), asLedgerName(ledger), asUserId(req.user!.id));
      res.status(204).end();
    } catch (err) {
      if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
      if (err instanceof PostingError || err instanceof ValidationError) return res.status(409).json({ error: err.message });
      console.error(err);
      res.status(500).json({ error: 'Could not post entry.' });
    }
  };
}

const base = {
  reference: z.string().min(1),
  business: z.string().min(1),
  ledger: z.string().min(1),
  quantity: z.number().int().positive(),
  transdate: z.string().optional(),
  description: z.string().optional(),
};

const poSchema = z.object({ ...base, vendor: z.string().min(1), item: z.string().min(1), price_minor: z.number().int().positive(), location: z.string().optional() });
stockRouter.post('/po/stage', (req, res) => {
  const parsed = poSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  stagePurchaseOrder(parsed.data);
  res.status(204).end();
});
stockRouter.post('/po/post', handlePost(postPurchaseOrder));
stockRouter.get('/order-status/:reference', (req, res) => res.json(getOrderStatus(req.params.reference)));

const receiptSchema = z.object({
  ...base,
  po_reference: z.string().min(1),
  item: z.string().min(1),
  item_qty: z.string().min(1).optional(),
  vendor: z.string().min(1),
  value_minor: z.number().int().positive(),
  tax_minor: z.number().int().nonnegative().optional(),
});
stockRouter.post('/stock-receipt/stage', (req, res) => {
  const parsed = receiptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  stageOrderReceipt(parsed.data);
  res.status(204).end();
});
stockRouter.post('/stock-receipt/post', handlePost(postOrderReceipt));

const soSchema = z.object({ ...base, customer: z.string().min(1), item: z.string().min(1), price_minor: z.number().int().positive(), location: z.string().optional() });
stockRouter.post('/so/stage', (req, res) => {
  const parsed = soSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  stageSalesOrder(parsed.data);
  res.status(204).end();
});
stockRouter.post('/so/post', handlePost(postSalesOrder));

const dispatchSchema = z.object({
  ...base,
  so_reference: z.string().min(1),
  item: z.string().min(1).optional(),
  item_qty: z.string().min(1).optional(),
  customer: z.string().min(1),
  unit_cost_minor: z.number().int().nonnegative().optional(),
  sale_price_minor: z.number().int().positive(),
  tax_minor: z.number().int().nonnegative().optional(),
});
stockRouter.post('/stock-dispatch/stage', (req, res) => {
  const parsed = dispatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  stageOrderDispatch(parsed.data);
  res.status(204).end();
});
stockRouter.post('/stock-dispatch/post', handlePost(postOrderDispatch));
