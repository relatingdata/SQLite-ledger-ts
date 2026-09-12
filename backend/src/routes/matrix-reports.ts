import { Router } from 'express';
import { getSalesCogsMatrix, getStockOnHandMatrix, getProfitAndLossByAxis, getAxisValues, type MatrixAxis } from '../db-matrix-reports.js';
import { asBusinessName, asLedgerName } from '../db.js';

export const matrixReportsRouter = Router();

const VALID_AXES: MatrixAxis[] = ['Product', 'Category', 'Location', 'Division', 'Consolidated'];

function parseAxis(value: unknown): MatrixAxis | null {
  return typeof value === 'string' && (VALID_AXES as string[]).includes(value) ? (value as MatrixAxis) : null;
}

matrixReportsRouter.get('/sales-cogs-matrix', (req, res) => {
  const business = typeof req.query.business === 'string' ? req.query.business : null;
  const ledger = typeof req.query.ledger === 'string' ? req.query.ledger : null;
  if (!business || !ledger) return res.status(400).json({ error: 'business and ledger are both required' });
  const rowAxis = parseAxis(req.query.rowAxis);
  const colAxis = parseAxis(req.query.colAxis);
  if (!rowAxis || !colAxis) return res.status(400).json({ error: 'rowAxis and colAxis must each be one of Product, Category, Location, Division, Consolidated' });
  const fromDate = typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined;
  const toDate = typeof req.query.toDate === 'string' ? req.query.toDate : undefined;
  res.json(getSalesCogsMatrix(asBusinessName(business), asLedgerName(ledger), fromDate, toDate, rowAxis, colAxis));
});

matrixReportsRouter.get('/stock-on-hand-matrix', (req, res) => {
  const rowAxis = parseAxis(req.query.rowAxis);
  const colAxis = parseAxis(req.query.colAxis);
  if (!rowAxis || !colAxis) return res.status(400).json({ error: 'rowAxis and colAxis must each be one of Product, Category, Location, Division, Consolidated' });
  res.json(getStockOnHandMatrix(rowAxis, colAxis));
});

matrixReportsRouter.get('/profit-and-loss-by-axis', (req, res) => {
  const business = typeof req.query.business === 'string' ? req.query.business : null;
  const ledger = typeof req.query.ledger === 'string' ? req.query.ledger : null;
  if (!business || !ledger) return res.status(400).json({ error: 'business and ledger are both required' });
  const outerAxis = parseAxis(req.query.outerAxis);
  const innerAxis = parseAxis(req.query.innerAxis);
  if (!outerAxis || !innerAxis) return res.status(400).json({ error: 'outerAxis and innerAxis must each be one of Product, Category, Location, Division, Consolidated' });
  const fromDate = typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined;
  const toDate = typeof req.query.toDate === 'string' ? req.query.toDate : undefined;
  const outerFilter = typeof req.query.outerFilter === 'string' && req.query.outerFilter ? req.query.outerFilter : undefined;
  const innerFilter = typeof req.query.innerFilter === 'string' && req.query.innerFilter ? req.query.innerFilter : undefined;
  res.json(getProfitAndLossByAxis(asBusinessName(business), asLedgerName(ledger), fromDate, toDate, outerAxis, innerAxis, outerFilter, innerFilter));
});

matrixReportsRouter.get('/axis-values', (req, res) => {
  const business = typeof req.query.business === 'string' ? req.query.business : null;
  const ledger = typeof req.query.ledger === 'string' ? req.query.ledger : null;
  if (!business || !ledger) return res.status(400).json({ error: 'business and ledger are both required' });
  res.json(getAxisValues(asBusinessName(business), asLedgerName(ledger)));
});
