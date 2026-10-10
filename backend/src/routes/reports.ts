import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth-middleware.js';
import { Balance, Hierarchy } from '../primitives.js';
import {
  getBusinessReports,
  getChartOfAccounts,
  getTrialBalance,
  getBalanceSheet,
  getProfitAndLoss,
  getProfitAndLossByDivision,
  getProfitAndLossByDivisionTree,
  getTrialBalanceComparison,
  getProfitAndLossComparison,
  getSalesReport,
  getLedgerDateRange,
  registerBankAccount,
  unregisterBankAccount,
  getBankAccounts,
  getCashPosition,
  getCashFlowForecast,
  asBusinessName,
  asLedgerName,
  type BusinessName,
  type LedgerName,
  ValidationError,
  asUserId,
} from '../db.js';

export const reportsRouter = Router();

reportsRouter.get('/business-reports', (req, res) => {
  const business = req.query.business as string;
  if (!business) return res.status(400).json({ error: 'business query parameter is required.' });
  res.json(getBusinessReports(business));
});

reportsRouter.get('/chart-of-accounts', (req, res) => {
  const business = req.query.business as string;
  if (!business) return res.status(400).json({ error: 'business query parameter is required.' });
  res.json(getChartOfAccounts(business));
});

function requireBusinessLedger(req: import('express').Request, res: import('express').Response): { business: BusinessName; ledger: LedgerName } | null {
  const business = req.query.business as string;
  const ledger = req.query.ledger as string;
  if (!business || !ledger) {
    res.status(400).json({ error: 'business and ledger query parameters are required.' });
    return null;
  }
  return { business: asBusinessName(business), ledger: asLedgerName(ledger) };
}

reportsRouter.get('/bank-accounts', (req, res) => {
  const scope = requireBusinessLedger(req, res);
  if (!scope) return;
  res.json(getBankAccounts(scope.business, scope.ledger));
});

reportsRouter.get('/cash-position', (req, res) => {
  const scope = requireBusinessLedger(req, res);
  if (!scope) return;
  res.json(getCashPosition(scope.business, scope.ledger));
});

reportsRouter.get('/cash-flow-forecast', (req, res) => {
  const business = req.query.business as string;
  const ledger = req.query.ledger as string;
  const asOfDate = (req.query.asOfDate as string) || new Date().toISOString().slice(0, 10);
  const horizonDays = req.query.horizonDays ? Number(req.query.horizonDays) : 90;
  if (!business || !ledger) return res.status(400).json({ error: 'business and ledger are required.' });
  if (!Number.isFinite(horizonDays) || horizonDays <= 0 || horizonDays > 365) return res.status(400).json({ error: 'horizonDays must be a real number between 1 and 365.' });
  res.json(getCashFlowForecast(asBusinessName(business), asLedgerName(ledger), asOfDate, horizonDays));
});

const registerBankAccountSchema = z.object({
  business: z.string().min(1),
  scopeName: z.string().min(1),
  overdraftLimitMinor: z.number().int().nonnegative().nullable().optional(),
});
reportsRouter.put('/bank-accounts/:accountName', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = registerBankAccountSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    registerBankAccount(req.params.accountName, parsed.data.business, parsed.data.scopeName, parsed.data.overdraftLimitMinor ?? null, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not register this bank account.' });
  }
});
reportsRouter.delete('/bank-accounts/:accountName', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  try {
    unregisterBankAccount(req.params.accountName, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not unregister this bank account.' });
  }
});

function requireLedger(req: import('express').Request, res: import('express').Response): { business: BusinessName; ledger: LedgerName } | null {
  const business = req.query.business;
  const ledger = req.query.ledger;
  if (typeof business !== 'string' || !business || typeof ledger !== 'string' || !ledger) {
    res.status(400).json({ error: 'Both business and ledger query parameters are required — financial statements are always scoped to one business\'s own ledger.' });
    return null;
  }
  return { business: asBusinessName(business), ledger: asLedgerName(ledger) };
}

reportsRouter.get('/sales', (req, res) => {
  const business = req.query.business;
  const ledger = req.query.ledger;
  if (typeof business !== 'string' || !business || typeof ledger !== 'string' || !ledger) {
    return res.status(400).json({ error: 'business and ledger query parameters are both required.' });
  }
  const fromDate = typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined;
  const toDate = typeof req.query.toDate === 'string' ? req.query.toDate : undefined;
  res.json(getSalesReport(asBusinessName(business), asLedgerName(ledger), fromDate, toDate));
});

reportsRouter.get('/trial-balance', (req, res) => {
  const scope = requireLedger(req, res);
  if (scope === null) return;
  const asOfDate = typeof req.query.asOfDate === 'string' ? req.query.asOfDate : undefined;
  res.json(getTrialBalance(scope.business, scope.ledger, asOfDate));
});

reportsRouter.get('/balance-sheet', (req, res) => {
  const scope = requireLedger(req, res);
  if (scope === null) return;
  const asOfDate = typeof req.query.asOfDate === 'string' ? req.query.asOfDate : undefined;
  res.json(getBalanceSheet(scope.business, scope.ledger, asOfDate));
});

reportsRouter.get('/ledger-date-range', (req, res) => {
  const scope = requireLedger(req, res);
  if (scope === null) return;
  res.json(getLedgerDateRange(scope.business, scope.ledger));
});

reportsRouter.get('/profit-and-loss', (req, res) => {
  const scope = requireLedger(req, res);
  if (scope === null) return;
  const fromDate = typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined;
  const toDate = typeof req.query.toDate === 'string' ? req.query.toDate : undefined;
  const division = typeof req.query.division === 'string' ? req.query.division : undefined;
  res.json(getProfitAndLoss(scope.business, scope.ledger, fromDate, toDate, division));
});

/** A real, full drill-down tree for any real hierarchy root — every
 * real node's own direct property values, its own real recursive
 * subtree totals, and its own real children, in one real response.
 * Drives both a real P&L category drill-down (root=Income or
 * root=Expense) and a real Inventory location/product drill-down
 * (root=Inventory) from the one, real, general Hierarchy.buildTree
 * primitive — not a separate, hand-rolled query per screen. Additive
 * alongside the existing /profit-and-loss and /balance-sheet
 * endpoints (which stay as the real, established, ledger-scoped
 * source for their own totals/checks) — this is the real, new source
 * for an interactive, expandable display.
 *
 * Uses Balance.get per leaf (account.balance_minor — a real, live
 * figure, but a single running total across every real ledger a
 * business has, not yet ledger-specific here). */
reportsRouter.get('/drill-down', (req, res) => {
  const root = typeof req.query.root === 'string' ? req.query.root : undefined;
  if (!root) return res.status(400).json({ error: 'root is required (e.g. Income, Expense, Inventory).' });
  res.json(Hierarchy.buildTree(root, (name, id) => ({ balance: id != null ? Balance.get(id) : 0 })));
});

reportsRouter.get('/profit-and-loss-by-division', (req, res) => {
  const scope = requireLedger(req, res);
  if (scope === null) return;
  const fromDate = typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined;
  const toDate = typeof req.query.toDate === 'string' ? req.query.toDate : undefined;
  res.json(getProfitAndLossByDivision(scope.business, scope.ledger, fromDate, toDate));
});

reportsRouter.get('/profit-and-loss-by-division-tree', (req, res) => {
  const scope = requireLedger(req, res);
  if (scope === null) return;
  const fromDate = typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined;
  const toDate = typeof req.query.toDate === 'string' ? req.query.toDate : undefined;
  res.json(getProfitAndLossByDivisionTree(scope.business, scope.ledger, fromDate, toDate));
});

function requireTwoLedgers(
  req: import('express').Request,
  res: import('express').Response
): { business: BusinessName; a: LedgerName; b: LedgerName } | null {
  const { business, a, b } = req.query;
  if (typeof business !== 'string' || !business || typeof a !== 'string' || typeof b !== 'string' || !a || !b) {
    res.status(400).json({ error: 'A business, and both "a" and "b" ledger query parameters (both belonging to that same business), are required for a comparison.' });
    return null;
  }
  return { business: asBusinessName(business), a: asLedgerName(a), b: asLedgerName(b) };
}

reportsRouter.get('/trial-balance-comparison', (req, res) => {
  const ledgers = requireTwoLedgers(req, res);
  if (ledgers === null) return;
  res.json(getTrialBalanceComparison(ledgers.business, ledgers.a, ledgers.b));
});

reportsRouter.get('/profit-and-loss-comparison', (req, res) => {
  const ledgers = requireTwoLedgers(req, res);
  if (ledgers === null) return;
  res.json(getProfitAndLossComparison(ledgers.business, ledgers.a, ledgers.b));
});
