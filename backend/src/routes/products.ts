import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth-middleware.js';
import { listProducts, createProduct, setItemProduct, ValidationError, NotFoundError, asUserId } from '../db.js';

export const productsRouter = Router();

productsRouter.get('/', (_req, res) => {
  res.json(listProducts());
});

const createProductSchema = z.object({ name: z.string().min(1), parent: z.string().min(1).default('Items') });

productsRouter.post('/', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    createProduct(parsed.data.name, parsed.data.parent, asUserId(req.user!.id));
    res.status(201).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not create this product.' });
  }
});

const setItemProductSchema = z.object({ itemName: z.string().min(1), productName: z.string().min(1).nullable() });

productsRouter.put('/item-assignment', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = setItemProductSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    setItemProduct(parsed.data.itemName, parsed.data.productName, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not assign this item to that product.' });
  }
});
