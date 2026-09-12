import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth-middleware.js';
import { getBusinesses, getLedgers, createBusiness, getCoaFamilyAccounts, getBusinessTypes, saveBusinessTypeAnswers, asBusinessName, asLedgerName, ValidationError,
  asUserId,
} from '../db.js';

export const businessesRouter = Router();

businessesRouter.get('/', (_req, res) => {
  res.json(getBusinesses());
});

// Every real business type (Sole Trader/Partnership/Pty Ltd Company/
// Incorporated Company) with its own real questions — the real,
// database-driven source for the new-business form's own type
// selector.
businessesRouter.get('/types', (_req, res) => {
  res.json(getBusinessTypes());
});

businessesRouter.get('/:name/ledgers', (req, res) => {
  res.json(getLedgers(asBusinessName(req.params.name)));
});

// Real accounts an existing ledger has actually posted to — lets a
// person setting up a new business see what a similar, real business's
// Chart of Accounts "family" (English/German/French/Italian/Swiss,
// etc.) actually looks like before choosing.
businessesRouter.get('/coa-family/:businessName/:ledgerName', (req, res) => {
  res.json(getCoaFamilyAccounts(asBusinessName(req.params.businessName), asLedgerName(req.params.ledgerName)));
});

const createBusinessSchema = z.object({
  businessName: z.string().min(1),
  financialYearLabel: z.string().min(1),
  coaFamily: z.string().min(1).optional(),
  secondaryCurrencies: z.array(z.string().min(1)).optional(),
  entityStructure: z.enum(['sole_trader', 'partnership', 'llc', 'unlimited_liability', 'publicly_traded']).optional(),
  partnerNames: z.array(z.string().min(1)).optional(),
});

businessesRouter.post('/', requireRole('Administrator'), (req, res) => {
  const parsed = createBusinessSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const result = createBusiness(
      asBusinessName(parsed.data.businessName),
      parsed.data.financialYearLabel,
      asUserId(req.user!.id),
      parsed.data.coaFamily,
      parsed.data.secondaryCurrencies,
      parsed.data.entityStructure,
      parsed.data.partnerNames
    );
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not create business.' });
  }
});

const answersSchema = z.object({ answers: z.record(z.string()) });
businessesRouter.post('/:name/business-type-answers', requireRole('Administrator'), (req, res) => {
  const parsed = answersSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  saveBusinessTypeAnswers(asBusinessName(req.params.name), parsed.data.answers, asUserId(req.user!.id));
  res.status(204).end();
});
