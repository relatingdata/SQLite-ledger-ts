import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth-middleware.js';
import { getDivisions, setDivisionType, createEntity, create, fetch, typeRootName, typeDivisionName, ValidationError,
  asUserId, type EntityId, getDivisionTypes, createDivisionType,
} from '../db.js';

export const divisionsRouter = Router();

divisionsRouter.get('/', (_req, res) => {
  res.json(getDivisions());
});

divisionsRouter.get('/types', (_req, res) => {
  res.json(getDivisionTypes());
});

const createDivisionTypeSchema = z.object({ name: z.string().min(1) });

divisionsRouter.post('/types', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = createDivisionTypeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    createDivisionType(parsed.data.name, asUserId(req.user!.id));
    res.status(201).json({ name: parsed.data.name });
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not create division type.' });
  }
});

const createDivisionSchema = z.object({
  name: z.string().min(1),
  parent: z.string().min(1).nullable(),
  centerType: z.string().min(1),
});

divisionsRouter.post('/', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = createDivisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const entity = create(fetch(parsed.data.parent ?? 'Divisions', typeRootName), typeDivisionName, parsed.data.name, asUserId(req.user!.id));
    setDivisionType(entity.id as EntityId, parsed.data.centerType);
    res.status(201).json({ name: parsed.data.name });
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not create division.' });
  }
});
