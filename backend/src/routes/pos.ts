import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth-middleware.js';
import { getItemByUpc, getCombinationByUpc, completePosSale, completeCashPurchase, payEmployeeWages, getOrganizationChart, asBusinessName, asLedgerName, asLocationName, asCustomerName, asVendorName, asAccountName, ValidationError, NotFoundError,
  asUserId,
} from '../db.js';

export const posRouter = Router();

posRouter.get('/lookup/:upc', (req, res) => {
  const item = getItemByUpc(req.params.upc);
  if (!item) return res.status(404).json({ error: 'No item with that UPC.' });
  // Per direct instruction: "the POS terminal uses the barcode and
  // then looks up the product name climbing the Instance tree" - a
  // real, scanned barcode registered against a specific combination
  // (via item_source's own vendor_upc + productInstanceId) is
  // included here directly, so the register never needs a real,
  // separate round-trip, and a cashier never has to manually pick
  // Storage/Size/Container one at a time.
  const combination = getCombinationByUpc(req.params.upc);
  res.json(combination ? { ...item, combinationValues: combination.combinationValues, combinationShape: combination.combinationShape } : item);
});

const saleLineSchema = z.object({
  itemName: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPriceMinor: z.number().int().nonnegative(),
  taxMinor: z.number().int().nonnegative(),
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
        vendorName: asVendorName(parsed.data.vendorName),
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
