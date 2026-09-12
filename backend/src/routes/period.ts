import { Router } from 'express';
import { z } from 'zod';
import { getPeriodLockStatus, closePeriod, reopenPeriod, asBusinessName, asLedgerName,
  asUserId,
} from '../db.js';
import { requireRole } from '../auth-middleware.js';

export const periodRouter = Router();

periodRouter.get('/status', (req, res) => {
  const { business, ledger } = req.query;
  if (typeof business !== 'string' || typeof ledger !== 'string' || !business || !ledger) {
    return res.status(400).json({ error: 'business and ledger query parameters are both required.' });
  }
  res.json(getPeriodLockStatus(asBusinessName(business), asLedgerName(ledger)));
});

const closeSchema = z.object({
  business: z.string().min(1),
  ledger: z.string().min(1),
  throughDate: z.string().min(1),
});

// Administrator only — closing/reopening a period is a control over
// what everyone else can post, not an everyday bookkeeping action.
periodRouter.post('/close', requireRole('Administrator'), (req, res) => {
  const parsed = closeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  closePeriod(asBusinessName(parsed.data.business), asLedgerName(parsed.data.ledger), parsed.data.throughDate, asUserId(req.user!.id));
  res.status(204).end();
});

const reopenSchema = z.object({
  business: z.string().min(1),
  ledger: z.string().min(1),
});

periodRouter.post('/reopen', requireRole('Administrator'), (req, res) => {
  const parsed = reopenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  reopenPeriod(asBusinessName(parsed.data.business), asLedgerName(parsed.data.ledger), asUserId(req.user!.id));
  res.status(204).end();
});
