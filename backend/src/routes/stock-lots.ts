import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth-middleware.js';
import { writeOffStock, receiveLot, consumeFromLots, getExpiringStock, asBusinessName, asLedgerName, asItemName, asAccountName, ValidationError,
  asUserId,
} from '../db.js';

export const stockLotsRouter = Router();

const writeOffSchema = z.object({
  business: z.string().min(1),
  ledger: z.string().min(1),
  reference: z.string().min(1),
  itemName: z.string().min(1),
  quantity: z.number().int().positive(),
  unitCostMinor: z.number().int().nonnegative(),
  writeOffExpenseAccount: z.string().min(1),
  inventoryAccount: z.string().min(1),
  reason: z.string().min(1),
  transdate: z.string().optional(),
});

stockLotsRouter.post('/write-off', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = writeOffSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const d = parsed.data;
    writeOffStock(asBusinessName(d.business), asLedgerName(d.ledger), d.reference, asItemName(d.itemName), d.quantity, d.unitCostMinor, asAccountName(d.writeOffExpenseAccount), d.inventoryAccount, d.reason, asUserId(req.user!.id), d.transdate);
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not write off stock.' });
  }
});

const receiveLotSchema = z.object({
  business: z.string().min(1),
  ledger: z.string().min(1),
  reference: z.string().min(1),
  itemName: z.string().min(1),
  lotNumber: z.string().min(1),
  receivedDate: z.string().min(1),
  expirationDate: z.string().nullable().optional(),
  quantity: z.number().int().positive(),
});

stockLotsRouter.post('/lots', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = receiveLotSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const d = parsed.data;
    receiveLot(asBusinessName(d.business), asLedgerName(d.ledger), d.reference, asItemName(d.itemName), d.lotNumber, d.receivedDate, d.expirationDate ?? null, d.quantity, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not receive lot.' });
  }
});

const consumeSchema = z.object({ itemName: z.string().min(1), quantity: z.number().int().positive() });

stockLotsRouter.post('/lots/consume', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = consumeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.json(consumeFromLots(parsed.data.itemName, parsed.data.quantity));
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not consume from lots.' });
  }
});

stockLotsRouter.get('/lots/expiring', (req, res) => {
  const asOfDate = (req.query.asOfDate as string) || new Date().toISOString().slice(0, 10);
  const withinDays = req.query.withinDays ? Number(req.query.withinDays) : 30;
  res.json(getExpiringStock(asOfDate, withinDays));
});
