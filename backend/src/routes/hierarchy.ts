import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth-middleware.js';
import {
  ensureHierarchyGrouping,
  ensureHierarchyValue,
  setHierarchyParent,
  getHierarchyParent,
  getHierarchyAssignments,
  deleteHierarchyParent,
  deleteHierarchyGrouping,
  deleteHierarchyValue,
  defineProductShape,
  getBusinessHierarchy,
  getBusinessProductShapes,
  getHierarchyGroups,
  ValidationError,
  NotFoundError,
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

const setParentSchema = z.object({ entityName: z.string().min(1), hierarchyName: z.string().min(1), parentName: z.string().min(1) });

/** Generically tags any already-existing real entity (a Location, an
 * Item, or any further hierarchy value) with the value it belongs to,
 * for a named hierarchy — the same, real setHierarchyParent mechanism
 * every hierarchy value's own optional nesting already uses (POST
 * /values' parentValueName), now exposed directly so a real entity
 * that already exists (most commonly a Location, tagged for a
 * *further* hierarchy dimension beyond its primary grouping) can be
 * tagged or re-tagged at any time, not only at creation. Never
 * hardcodes a hierarchy or entity kind. */
hierarchyRouter.post('/parent', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = setParentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    setHierarchyParent(parsed.data.entityName, parsed.data.hierarchyName, parsed.data.parentName, asUserId(req.user!.id));
    res.status(200).json({ entityName: parsed.data.entityName, hierarchyName: parsed.data.hierarchyName, parentName: parsed.data.parentName });
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not set hierarchy tag.' });
  }
});

/** Every real, direct tag for one named hierarchy, in one call - entity
 * name -> the value it's tagged with. Lets a screen build a real display
 * tree (e.g. the Items catalog's Category grouping, or a Division
 * assignment view) for any hierarchy without one request per item or
 * per value. Never defaulted to any particular hierarchy name. */
hierarchyRouter.get('/assignments', (req, res) => {
  const hierarchyName = req.query.hierarchyName as string;
  if (!hierarchyName) return res.status(400).json({ error: 'hierarchyName query parameter is required.' });
  res.json(getHierarchyAssignments(hierarchyName));
});

/** Real, direct lookup: what value (if any) a real entity is currently
 * tagged with, for one named hierarchy. Both query parameters are
 * required — never defaulted to any particular hierarchy name. */
hierarchyRouter.get('/parent', (req, res) => {
  const entityName = req.query.entityName as string;
  const hierarchyName = req.query.hierarchyName as string;
  if (!entityName || !hierarchyName) return res.status(400).json({ error: 'entityName and hierarchyName query parameters are both required.' });
  res.json({ parentName: getHierarchyParent(entityName, hierarchyName) ?? null });
});

/** Removes a real entity's own tag for one named hierarchy, leaving
 * the entity itself, and every other hierarchy it may be tagged
 * under, untouched. */
hierarchyRouter.delete('/parent', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const entityName = req.query.entityName as string;
  const hierarchyName = req.query.hierarchyName as string;
  if (!entityName || !hierarchyName) return res.status(400).json({ error: 'entityName and hierarchyName query parameters are both required.' });
  try {
    deleteHierarchyParent(entityName, hierarchyName, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not remove hierarchy tag.' });
  }
});

/** Removes a real, named grouping (e.g. "Division") under a business's own
 * Hierarchy root — the name-based wrapper the Hierarchy screen's own
 * groupings/values lists need, since getBusinessHierarchy's own
 * HierarchyGroupingWithValues shape carries no entity ids at all. Reuses
 * revokeEntity's own guards unchanged: a grouping with live values still
 * refuses, exactly as deleting that entity directly already would. */
hierarchyRouter.delete('/groupings', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const business = req.query.business as string;
  const groupingName = req.query.groupingName as string;
  if (!business || !groupingName) return res.status(400).json({ error: 'business and groupingName query parameters are both required.' });
  try {
    deleteHierarchyGrouping(asBusinessName(business), groupingName, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not delete hierarchy grouping.' });
  }
});

/** Removes a real, named value (e.g. "Retail") under a real grouping — see
 * /groupings above for why this is name-based. revokeEntity's own
 * incoming-links guard refuses a value some entity (most commonly a
 * Location) is still actually tagged with. */
hierarchyRouter.delete('/values', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const business = req.query.business as string;
  const groupingName = req.query.groupingName as string;
  const valueName = req.query.valueName as string;
  if (!business || !groupingName || !valueName) return res.status(400).json({ error: 'business, groupingName, and valueName query parameters are all required.' });
  try {
    deleteHierarchyValue(asBusinessName(business), groupingName, valueName, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not delete hierarchy value.' });
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
