import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth-middleware.js';
import { getItemByUpc, getCombinationByUpc, completePosSale, completeCashPurchase, payEmployeeWages, getOrganizationChart, asBusinessName, asLedgerName, asLocationName, asCustomerName, asProviderName, asAccountName, ValidationError, NotFoundError,
  asUserId,
} from '../db.js';
import { createPosTerminal, listPosTerminals, setTerminalCurrency } from '../db-stock.js';

export const posRouter = Router();

posRouter.get('/lookup/:upc', (req, res) => {
  // Per direct instruction: "the POS terminal uses the barcode and
  // then looks up the product name climbing the Instance tree" - a
  // real, combination-specific barcode (registered via item_source's
  // own vendor_upc, not the base item's own item_upc) is genuinely
  // more specific, so it's checked first - a cashier scanning a cold
  // beer's own, distinct barcode should never fall back to the base
  // item's plain price by accident.
  const combination = getCombinationByUpc(req.params.upc);
  if (combination) {
    const item = getItemByUpc(req.params.upc) ?? { name: combination.itemName, description: null, unit_of_measure: null, upc: req.params.upc, retail_price_minor: null, source_count: 0, storage_origin: null, product: null };
    return res.json({ ...item, name: combination.itemName, combinationValues: combination.combinationValues, combinationShape: combination.combinationShape });
  }
  const item = getItemByUpc(req.params.upc);
  if (!item) return res.status(404).json({ error: 'No item with that UPC.' });
  res.json(item);
});

const saleLineSchema = z.object({
  itemName: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPriceMinor: z.number().int().nonnegative().optional(),
  taxMinor: z.number().int().nonnegative(),
  tier: z.string().min(1).optional(),
  combinationValues: z.array(z.string().min(1)).optional(),
  combinationShape: z.array(z.tuple([z.string().min(1), z.string().min(1)])).optional(),
});

const saleSchema = z.object({
  business: z.string().min(1),
  ledger: z.string().min(1),
  locationName: z.string().min(1),
  customerName: z.string().min(1),
  lines: z.array(saleLineSchema).min(1),
  revenueAccount: z.string().min(1).optional(),
  taxAccount: z.string().min(1),
  paymentMethod: z.string().optional(),
  cashTenderedMinor: z.number().int().nonnegative().optional(),
  transdate: z.string().optional(),
  // Per docs/multicurrency-design.md, Slice 4: a real, specific
  // terminal resolves its own real currency for this one sale -
  // omitted entirely for the real, ordinary, ubiquitous case (a sale
  // in the business's own home currency).
  terminalName: z.string().min(1).optional(),
});

posRouter.post('/complete-sale', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = saleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const result = completePosSale(
      {
        ...parsed.data,
        business: asBusinessName(parsed.data.business),
        ledger: asLedgerName(parsed.data.ledger),
        locationName: asLocationName(parsed.data.locationName),
        customerName: asCustomerName(parsed.data.customerName),
        revenueAccount: parsed.data.revenueAccount ? asAccountName(parsed.data.revenueAccount) : undefined,
        taxAccount: asAccountName(parsed.data.taxAccount),
      },
      asUserId(req.user!.id)
    );
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not complete sale.' });
  }
});

const purchaseLineSchema = z.object({
  itemName: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPriceMinor: z.number().int().nonnegative(),
  taxMinor: z.number().int().nonnegative(),
});

const purchaseSchema = z.object({
  business: z.string().min(1),
  ledger: z.string().min(1),
  locationName: z.string().min(1),
  vendorName: z.string().min(1),
  lines: z.array(purchaseLineSchema).min(1),
  taxAccount: z.string().min(1),
  paymentMethod: z.string().optional(),
  transdate: z.string().optional(),
});

posRouter.post('/complete-cash-purchase', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = purchaseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const result = completeCashPurchase(
      {
        ...parsed.data,
        business: asBusinessName(parsed.data.business),
        ledger: asLedgerName(parsed.data.ledger),
        locationName: asLocationName(parsed.data.locationName),
        vendorName: asProviderName(parsed.data.vendorName),
        taxAccount: asAccountName(parsed.data.taxAccount),
      },
      asUserId(req.user!.id)
    );
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not complete purchase.' });
  }
});

const wagesSchema = z.object({
  business: z.string().min(1),
  ledger: z.string().min(1),
  employeeName: z.string().min(1),
  hours: z.number().positive().optional(),
  wagesExpenseAccount: z.string().min(1).optional(),
  paymentMethod: z.string().optional(),
  transdate: z.string().optional(),
});

posRouter.post('/pay-wages', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = wagesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const result = payEmployeeWages(parsed.data, asUserId(req.user!.id));
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not pay wages.' });
  }
});

posRouter.get('/org-chart/:businessName', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  try {
    const chart = getOrganizationChart(asBusinessName(req.params.businessName));
    res.json(chart);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load the organization chart.' });
  }
});

// Per docs/multicurrency-design.md, Slice 4: a real, specific POS
// terminal, at a real location, resolving its own real, further
// currency. Every real, ordinary business has none of these at all.
posRouter.get('/terminals/:locationName', (req, res) => {
  try {
    res.json(listPosTerminals(req.params.locationName));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not list terminals.' });
  }
});

const terminalSchema = z.object({ terminalName: z.string().min(1), currency: z.string().min(1).max(6).optional() });

posRouter.post('/terminals/:locationName', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = terminalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    createPosTerminal(parsed.data.terminalName, asLocationName(req.params.locationName), asUserId(req.user!.id));
    if (parsed.data.currency) setTerminalCurrency(parsed.data.terminalName, parsed.data.currency);
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not create that terminal.' });
  }
});
