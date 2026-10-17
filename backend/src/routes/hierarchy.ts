import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth-middleware.js';
import {
  ensureHierarchyGrouping,
  ensureHierarchyValue,
  setHierarchyParent,
  defineProductShape,
  getBusinessHierarchy,
  getBusinessProductShapes,
  getHierarchyGroups,
  ValidationError,
  asBusinessName,
  asUserId,
} from '../db.js';

export const hierarchyRouter = Router();

hierarchyRouter.get('/', (req, res) => {
  const business = req.query.business as string;
  if (!business) return res.status(400).json({ error: 'business query parameter is required — a Hierarchy is scoped per business.' });
  res.json(getBusinessHierarchy(asBusinessName(business)));
});

/** Every real group that exists under one named hierarchy (e.g.
 * "Division," or any other real, business-chosen hierarchy name) —
 * the generic replacement for the former, privileged /api/divisions
 * endpoint. name is a required query parameter, since no hierarchy
 * name is ever hardcoded or defaulted here. */
hierarchyRouter.get('/groups', (req, res) => {
  const name = req.query.name as string;
  if (!name) return res.status(400).json({ error: 'name query parameter is required — e.g. ?name=Division.' });
  res.json(getHierarchyGroups(name));
});

hierarchyRouter.get('/shapes', (req, res) => {
  const business = req.query.business as string;
  if (!business) return res.status(400).json({ error: 'business query parameter is required — a Product shape is scoped per business.' });
  res.json(getBusinessProductShapes(asBusinessName(business)));
});

const createGroupingSchema = z.object({ business: z.string().min(1), groupingName: z.string().min(1) });

hierarchyRouter.post('/groupings', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = createGroupingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const grouping = ensureHierarchyGrouping(asBusinessName(parsed.data.business), parsed.data.groupingName, asUserId(req.user!.id));
    res.status(201).json({ name: grouping.name });
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not create hierarchy grouping.' });
  }
});

const createValueSchema = z.object({ business: z.string().min(1), groupingName: z.string().min(1), valueName: z.string().min(1), parentValueName: z.string().min(1).nullable().optional() });

/** Creates a real value under a real hierarchy grouping (e.g. "Retail"
 * under "Division") — optionally nested under a real, already-existing
 * parent value of the exact same grouping (e.g. "Retail North" under
 * "Retail"), via the exact same, already-generic hierarchy-link
 * mechanism (setHierarchyParent) a location's own group tag uses. This
 * is the one, generic replacement for the former, privileged
 * /api/divisions POST — a business's own named hierarchy can nest its
 * own values as many real levels deep as it needs, with zero
 * hardcoded grouping name. */
hierarchyRouter.post('/values', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = createValueSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const userId = asUserId(req.user!.id);
    const business = asBusinessName(parsed.data.business);
    const value = ensureHierarchyValue(business, parsed.data.groupingName, parsed.data.valueName, userId);
    if (parsed.data.parentValueName) {
      setHierarchyParent(parsed.data.valueName, parsed.data.groupingName, parsed.data.parentValueName, userId);
    }
    res.status(201).json({ name: value.name });
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not create hierarchy value.' });
  }
});

const defineShapeSchema = z.object({
  business: z.string().min(1),
  dimensions: z.array(z.tuple([z.string().min(1), z.string().min(1)])).min(1),
});

hierarchyRouter.post('/shapes', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = defineShapeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    defineProductShape(asBusinessName(parsed.data.business), parsed.data.dimensions as [string, string][], asUserId(req.user!.id));
    res.status(201).json({ dimensions: parsed.data.dimensions });
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not define product shape.' });
  }
});
