import { Router } from 'express';
import { z } from 'zod';
import { getEntityTree, getEntity, getEntityHistory, createEntityRaw, supersedeEntity, revokeEntity, setRelationship, getDimensionLinksPointingAt, setLineType, listLineTypes, reorderSiblings, reorderSiblingsBulk, asEntityId, ValidationError, NotFoundError,
  asUserId,
  createProvider,
  createCustomer,
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
// way a new vendor, customer, or employee is created - genuinely
// tagged with its own real Contact Type, never left to structural
// parent alone. One, real, generic route - confirmed directly, the
// three, real, separate contact-type-creation functions behind this
// were nearly identical, the exact, same kind of duplication
// addTypedAddress/addTypedPhone already solved for address/phone
// types - never three, separate, near-duplicate routes.
const contactSchema = z.object({
  type: z.enum(['vendor', 'customer', 'employee']),
  name: z.string().min(1),
  placeOfEmployment: z.string().min(1).optional(),
});
entitiesRouter.post('/contact', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { type, name } = parsed.data;
  if (type === 'employee' && !parsed.data.placeOfEmployment) {
    return res.status(400).json({ error: 'placeOfEmployment is required for a real employee.' });
  }
  try {
    const userId = asUserId(req.user!.id);
    const entity =
      type === 'vendor' ? createProvider(name, userId) :
      type === 'customer' ? createCustomer(name, userId) :
      createEmployee(name, parsed.data.placeOfEmployment as string, userId);
    res.status(201).json(entity);
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: `Could not create that ${type}.` });
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

const supersedeEntitySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  parent: z.string().nullable().optional(),
  relation: z.string().nullable().optional(),
  accountnumber: z.string().nullable().optional(),
});

entitiesRouter.patch('/:id', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = supersedeEntitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.json(supersedeEntity(Number(req.params.id), parsed.data, asUserId(req.user!.id)));
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
    revokeEntity(Number(req.params.id), asUserId(req.user!.id));
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
