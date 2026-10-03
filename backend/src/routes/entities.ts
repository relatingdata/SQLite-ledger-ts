import { Router } from 'express';
import { z } from 'zod';
import { getEntityTree, getEntity, getEntityHistory, createEntityRaw, updateEntity, deleteEntity, setRelationship, getDimensionLinksPointingAt, setLineType, listLineTypes, reorderSiblings, reorderSiblingsBulk, asEntityId, ValidationError, NotFoundError,
  asUserId,
  createProvider,
  createEmployee,
} from '../db.js';
import { requireRole } from '../auth-middleware.js';

export const entitiesRouter = Router();

entitiesRouter.get('/', (_req, res) => {
  res.json(getEntityTree());
});

entitiesRouter.get('/line-types', (_req, res) => {
  res.json(listLineTypes());
});

// Per docs/contact-types-and-translations.md: the one, real, correct
// way a new vendor or employee is created - genuinely tagged with its
// own real Contact Type, never left to structural parent alone.
const vendorSchema = z.object({ name: z.string().min(1) });
entitiesRouter.post('/vendor', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = vendorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const entity = createProvider(parsed.data.name, asUserId(req.user!.id));
    res.status(201).json(entity);
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not create that vendor.' });
  }
});

const employeeSchema = z.object({ name: z.string().min(1), placeOfEmployment: z.string().min(1) });
entitiesRouter.post('/employee', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = employeeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const entity = createEmployee(parsed.data.name, parsed.data.placeOfEmployment, asUserId(req.user!.id));
    res.status(201).json(entity);
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not create that employee.' });
  }
});

entitiesRouter.get('/:id', (req, res) => {
  const entity = getEntity(Number(req.params.id));
  if (!entity) return res.status(404).json({ error: 'Not found.' });
  res.json(entity);
});

entitiesRouter.get('/:id/history', (req, res) => {
  res.json(getEntityHistory(Number(req.params.id)));
});

entitiesRouter.get('/:id/dimension-links', (req, res) => {
  const entity = getEntity(Number(req.params.id));
  if (!entity) return res.status(404).json({ error: 'Not found.' });
  res.json(getDimensionLinksPointingAt(entity.name));
});

const newEntitySchema = z.object({
  name: z.string().min(1).max(200),
  parent: z.string().nullable().optional(),
  parentId: z.number().int().positive().optional(),
  relation: z.string().nullable().optional(),
  accountnumber: z.string().nullable().optional(),
});

entitiesRouter.post('/', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = newEntitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    // A real, deliberate exception to no-generic-functions, per that
    // skill's own rule 4: this is the Entity Tree Editor's own,
    // genuinely generic "create anything, anywhere" endpoint - an
    // administrator using it may be creating a brand-new Vocabulary
    // word, a new custom category, or any other real kind not known
    // in advance. Forcing a specific TypeDescriptor here would defeat
    // this tool's own, real, intended purpose.
    res.status(201).json(createEntityRaw(parsed.data, asUserId(req.user!.id)));
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not create entity.' });
  }
});

const updateEntitySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  parent: z.string().nullable().optional(),
  relation: z.string().nullable().optional(),
  accountnumber: z.string().nullable().optional(),
});

entitiesRouter.patch('/:id', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = updateEntitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.json(updateEntity(Number(req.params.id), parsed.data, asUserId(req.user!.id)));
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not update entity.' });
  }
});

const setLineTypeSchema = z.object({
  entityName: z.string().min(1),
  lineType: z.string().min(1).nullable(),
});

entitiesRouter.put('/line-type', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = setLineTypeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    setLineType(parsed.data.entityName, parsed.data.lineType, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not set line type.' });
  }
});

const reorderSchema = z.object({
  ids: z.array(z.number()).min(1),
  direction: z.enum(['up', 'down']),
});

entitiesRouter.post('/reorder', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    if (parsed.data.ids.length === 1) {
      reorderSiblings(asEntityId(parsed.data.ids[0]), parsed.data.direction, asUserId(req.user!.id));
    } else {
      reorderSiblingsBulk(parsed.data.ids, parsed.data.direction, asUserId(req.user!.id));
    }
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not reorder.' });
  }
});

entitiesRouter.delete('/:id', requireRole('Administrator'), (req, res) => {
  try {
    deleteEntity(Number(req.params.id), asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not delete entity.' });
  }
});

const relationshipSchema = z.object({
  entityName: z.string().min(1),
  relationshipType: z.string().min(1),
  targetName: z.string().min(1),
});
entitiesRouter.post('/relationship', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = relationshipSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    setRelationship(parsed.data.entityName, parsed.data.relationshipType, parsed.data.targetName, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not set this relationship.' });
  }
});
