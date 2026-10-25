import { Router } from 'express';
import { z } from 'zod';
import { requireRole, requireGlobalRole } from '../auth-middleware.js';
import { provisionBusinessAdminUser } from '../auth.js';
import { getBusinesses, getLedgers, getActiveLedger, createBusiness, getChartOfAccountsPrototype, getBusinessTypes, saveBusinessTypeAnswers, asBusinessName, ValidationError,
  asUserId, nominateBankAccount, getNominatedBankAccounts, buildBankCurrencyStructure, typeAssetAccountName, typeEquityAccountName, getBusinessConfigurationReport,
  createProfitCenter, getProfitCenters, getReportingPeriods,
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

// Per docs/active-ledger-design.md: the real, current "active"
// ledger for this business - null for a business created before
// this concept existed. The Session screen reads this to default a
// person's own ledger pick onto wherever a real rollover just moved
// ordinary trading to (a real, soft switch, no forced logout).
businessesRouter.get('/:name/active-ledger', (req, res) => {
  res.json({ activeLedger: getActiveLedger(asBusinessName(req.params.name)) });
});

// Per docs/profit-centers-design.md's Phase A: every real Profit
// Center for one business — empty for a business that has never
// created one, which is every business today, since this is purely
// additive.
businessesRouter.get('/:name/profit-centers', (req, res) => {
  res.json(getProfitCenters(asBusinessName(req.params.name)));
});

const createProfitCenterSchema = z.object({
  profitCenterName: z.string().min(1),
});
businessesRouter.post('/:name/profit-centers', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = createProfitCenterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const result = createProfitCenter(asBusinessName(req.params.name), parsed.data.profitCenterName, asUserId(req.user!.id));
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not create the Profit Center.' });
  }
});

// Real accounts a given Chart of Accounts "prototype" (English/German/
// French/Italian/Swiss, etc.) actually means - read directly from the
// one, real, shared template, so a person setting up a new business
// can see exactly what a prototype looks like before choosing, with no
// existing, real, exemplar business required.
businessesRouter.get('/coa-prototype/:language', (req, res) => {
  res.json(getChartOfAccountsPrototype(req.params.language));
});

// Real period boundaries from this business's stored financial-year start/frequency, through the
// one in progress as of ?asOf (today, by default) — [] for a business with no stored reporting
// period (created before this feature, or via a legacy caller). Drives Close Books/Rollover's
// suggested date and ledger name — see docs/pm-domain-reference.md ("Reporting periods").
businessesRouter.get('/:businessName/reporting-periods', (req, res) => {
  const asOf = typeof req.query.asOf === 'string' ? req.query.asOf : undefined;
  res.json(getReportingPeriods(req.params.businessName, asOf));
});

const createBusinessSchema = z.object({
  businessName: z.string().min(1),
  financialYearLabel: z.string().min(1),
  coaPrototype: z.string().min(1).optional(),
  secondaryCurrencies: z.array(z.string().min(1)).optional(),
  entityStructure: z.enum(['sole_trader', 'partnership', 'llc', 'unlimited_liability', 'publicly_traded']).optional(),
  partnerNames: z.array(z.string().min(1)).optional(),
  // Real reporting-period data (see docs/pm-domain-reference.md) — both optional so a business can
  // still be created exactly as before, with just the free-text financialYearLabel.
  financialYearStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reportingFrequency: z.enum(['annual', 'biannual', 'quarterly', 'monthly']).optional(),
});

// Creating a business is the one, real, deliberately narrow operation
// Business Admin must never reach, however it holds any role — hence
// requireGlobalRole, not requireRole (see
// docs/business-admin-role-and-enforcement-design.md). Only a real,
// global Administrator may create one.
businessesRouter.post('/', requireGlobalRole('Administrator'), (req, res) => {
  const parsed = createBusinessSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const businessName = asBusinessName(parsed.data.businessName);
    const result = createBusiness(
      businessName,
      parsed.data.financialYearLabel,
      asUserId(req.user!.id),
      parsed.data.coaPrototype,
      parsed.data.secondaryCurrencies,
      parsed.data.entityStructure,
      parsed.data.partnerNames,
      parsed.data.financialYearStart,
      parsed.data.reportingFrequency
    );
    // Per direct instruction: every real, new business gets its own,
    // real, dedicated admin user — full, real access within this one
    // business (via the real Business Admin role, granted through the
    // matrix), never the ability to create another business. The
    // generated password is returned exactly once, here, in plain
    // text, the same real, show-once way any generated credential
    // must be surfaced — it is never otherwise recoverable.
    const businessAdmin = provisionBusinessAdminUser(businessName, asUserId(req.user!.id));
    res.status(201).json({ ...result, businessAdmin });
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
  // The real currency this business actually trades/reports in by
  // default - recorded here, the one real place a business's home
  // currency is first ever nominated (see buildBankCurrencyStructure's
  // own doc comment for why this is required, not optional).
  homeCurrency: z.string().min(1),
});
businessesRouter.post('/:name/bank-currency-structure', requireRole('Administrator'), (req, res) => {
  const parsed = buildBankCurrencyStructureSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const leafType = parsed.data.leafKind === 'asset' ? typeAssetAccountName : typeEquityAccountName;
    buildBankCurrencyStructure(asBusinessName(req.params.name), parsed.data.headerName, leafType, parsed.data.selections, asUserId(req.user!.id), parsed.data.homeCurrency);
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not build the real bank/currency structure.' });
  }
});
