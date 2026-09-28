import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth-middleware.js';
import { getBusinesses, getLedgers, createBusiness, getChartOfAccountsPrototype, getBusinessTypes, saveBusinessTypeAnswers, asBusinessName, ValidationError,
  asUserId, nominateBankAccount, getNominatedBankAccounts, buildBankCurrencyStructure, typeAssetAccountName, typeEquityAccountName, getBusinessConfigurationReport,
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

// Real accounts a given Chart of Accounts "prototype" (English/German/
// French/Italian/Swiss, etc.) actually means - read directly from the
// one, real, shared template, so a person setting up a new business
// can see exactly what a prototype looks like before choosing, with no
// existing, real, exemplar business required.
businessesRouter.get('/coa-prototype/:language', (req, res) => {
  res.json(getChartOfAccountsPrototype(req.params.language));
});

const createBusinessSchema = z.object({
  businessName: z.string().min(1),
  financialYearLabel: z.string().min(1),
  coaPrototype: z.string().min(1).optional(),
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
      parsed.data.coaPrototype,
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

const nominateBankAccountSchema = z.object({ bankAccountName: z.string().min(1), routingDetail: z.string(), accountNumber: z.string() });
businessesRouter.post('/:name/bank-accounts', requireRole('Administrator'), (req, res) => {
  const parsed = nominateBankAccountSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const result = nominateBankAccount(asBusinessName(req.params.name), parsed.data.bankAccountName, parsed.data.routingDetail, parsed.data.accountNumber, asUserId(req.user!.id));
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not nominate bank account.' });
  }
});

businessesRouter.get('/:name/bank-accounts', requireRole('Administrator'), (req, res) => {
  res.json(getNominatedBankAccounts(asBusinessName(req.params.name)));
});

// Everything a real business's own setup actually captured, per
// direct instruction - deliberately never Item Details.
businessesRouter.get('/:name/configuration-report', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  try {
    res.json(getBusinessConfigurationReport(asBusinessName(req.params.name)));
  } catch (err) {
    if (err instanceof ValidationError) return res.status(404).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not build the real business configuration report.' });
  }
});

const buildBankCurrencyStructureSchema = z.object({
  headerName: z.string().min(1),
  leafKind: z.enum(['asset', 'equity']),
  selections: z.array(z.object({ bankAccountName: z.string().min(1), currency: z.string().min(1) })).min(1),
});
businessesRouter.post('/:name/bank-currency-structure', requireRole('Administrator'), (req, res) => {
  const parsed = buildBankCurrencyStructureSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const leafType = parsed.data.leafKind === 'asset' ? typeAssetAccountName : typeEquityAccountName;
    buildBankCurrencyStructure(asBusinessName(req.params.name), parsed.data.headerName, leafType, parsed.data.selections, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not build the real bank/currency structure.' });
  }
});
