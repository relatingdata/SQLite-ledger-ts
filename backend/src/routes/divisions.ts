import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth-middleware.js';
import { getDivisions, create, requireEntity, typeRootName, typeDivisionName, ValidationError,
  asUserId,
} from '../db.js';

export const divisionsRouter = Router();

divisionsRouter.get('/', (_req, res) => {
  res.json(getDivisions());
});

const createDivisionSchema = z.object({
  name: z.string().min(1),
  parent: z.string().min(1).nullable(),
});

divisionsRouter.post('/', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = createDivisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    create(requireEntity(parsed.data.parent ?? 'Divisions', typeRootName), typeDivisionName, parsed.data.name, asUserId(req.user!.id));
    res.status(201).json({ name: parsed.data.name });
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not create division.' });
  }
});
