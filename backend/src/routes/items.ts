import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth-middleware.js';
import { listItems, countItems, getItem, setItem, setItemStorageOrigin, getItemStorageOrigin, listItemSources, addOrUpdateItemSource, deleteItemSource, stageBomComponent, postBomComponents, getBomComponents, deleteBomComponent, ValidationError, NotFoundError, asUserId, asItemName, asBusinessName } from '../db.js';

export const itemsRouter = Router();

itemsRouter.get('/', (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const business = req.query.business as string;
  if (!business) return res.status(400).json({ error: 'business query parameter is required — items are scoped per business.' });
  res.json({ rows: listItems(asBusinessName(business), limit, offset), totalCount: countItems(asBusinessName(business)) });
});

itemsRouter.get('/:name', (req, res) => {
  const item = getItem(req.params.name);
  res.json(item ?? null);
});

const itemSchema = z.object({
  description: z.string().nullable().optional(),
  unit_of_measure: z.string().nullable().optional(),
  upc: z.string().nullable().optional(),
});

itemsRouter.put('/:name', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    setItem(req.params.name, parsed.data);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save item.' });
  }
});

itemsRouter.get('/:name/sources', (req, res) => {
  res.json(listItemSources(req.params.name));
});

const itemSourceSchema = z.object({
  manufacturerName: z.string().min(1).nullable().optional(),
  vendorName: z.string().min(1),
  vendorSku: z.string().nullable().optional(),
  vendorUpc: z.string().nullable().optional(),
  priceMinor: z.number().int().nonnegative().nullable().optional(),
  // Per docs/multicurrency-design.md: NULL means the business's own
  // home currency - a real, different, non-NULL currency here is a
  // real, separate, independently-priced row for the same item/vendor
  // pair, never a converted number.
  currency: z.string().min(1).max(6).nullable().optional(),
  packageQuantity: z.number().int().positive().nullable().optional(),
  isPreferred: z.boolean().optional(),
  preferenceNotes: z.string().nullable().optional(),
});

itemsRouter.post('/:name/sources', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = itemSourceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    addOrUpdateItemSource({ itemName: req.params.name, ...parsed.data });
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not save item source.' });
  }
});

itemsRouter.delete('/sources/:id', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  try {
    deleteItemSource(Number(req.params.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not delete item source.' });
  }
});

itemsRouter.get('/:name/bom', (req, res) => {
  res.json({ components: getBomComponents(req.params.name) });
});

const setBomComponentSchema = z.object({
  business: z.string().min(1),
  componentItem: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.enum(['ml', 'g', 'unit', 'nip', 'glass']),
});

itemsRouter.put('/:name/bom', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = setBomComponentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    stageBomComponent({ assemblyItem: req.params.name, ...parsed.data });
    postBomComponents(req.params.name, parsed.data.business, asUserId(req.user!.id));
    res.json({ components: getBomComponents(req.params.name) });
  } catch (err) {
    if (err instanceof ValidationError || err instanceof NotFoundError) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not save the Bill of Materials component.' });
  }
});

itemsRouter.delete('/:name/bom/:componentItem', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  try {
    deleteBomComponent(req.params.name, req.params.componentItem, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not remove the Bill of Materials component.' });
  }
});

itemsRouter.get('/:name/storage-origin', (req, res) => {
  res.json({ origin: getItemStorageOrigin(asItemName(req.params.name)) ?? null });
});

const setStorageOriginSchema = z.object({ origin: z.enum(['Hot', 'Cold']).nullable() });

itemsRouter.put('/:name/storage-origin', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = setStorageOriginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    setItemStorageOrigin(asItemName(req.params.name), parsed.data.origin, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not set storage origin.' });
  }
});
