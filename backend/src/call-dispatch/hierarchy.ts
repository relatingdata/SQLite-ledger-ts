// Converted from routes/hierarchy.ts. Mounted (old route) with requireAuth
// for the whole router; POST/DELETE further require Administrator or
// Bookkeeper, replicated per-function here.
import {
  ensureHierarchy,
  ensureHierarchyValue,
  setHierarchyParent,
  getHierarchyParent,
  getHierarchyAssignments,
  deleteHierarchyParent,
  deleteHierarchy,
  deleteHierarchyValue,
  defineProductShape,
  getBusinessHierarchy,
  getBusinessProductShapes,
  ValidationError,
  NotFoundError,
  asBusinessName,
  asUserId,
  resolveBusinessLocationId,
  resolveHierarchyValueId,
  checkHierarchyTag,
  getHierarchyTree,
  listHierarchyPrototypes,
  saveHierarchyPrototype,
  createHierarchyFromPrototype,
  HIERARCHY_KINDS,
  type HierarchyKind,
} from '../db.js';
import { CallError, decodeShape, encodeShape, requireAuth, requireRole, row, sessionBusinessName, table, type BackendCall } from '../call-dispatch.js';

export const hierarchyFunctions: Record<string, BackendCall> = {
  // Positional args: [0] business. Flattens HierarchyWithValues[]
  // (one level of real nesting: a hierarchy name plus its own values[])
  // into one (hierarchy, value) table, with a sentinel row (value='', a
  // real value name is never empty) for a hierarchy that has zero values
  // yet — confirmed needed via grep of setup/hierarchy/+page.svelte,
  // which lists hierarchies themselves independent of their value count,
  // same discipline as departments.ts's getOrgChartStructure.
  getHierarchy: (v, user) => {
    requireAuth(user);
    const [business] = v;
    if (!business) throw new CallError(400, 'business is required.');
    const hierarchies = getBusinessHierarchy(asBusinessName(business));
    const rows: { hierarchy: string; of: string; value: string }[] = [];
    for (const g of hierarchies) {
      const of = g.of ?? '';
      if (g.values.length === 0) rows.push({ hierarchy: g.hierarchy, of, value: '' });
      else for (const value of g.values) rows.push({ hierarchy: g.hierarchy, of, value });
    }
    return table(['hierarchy', 'of', 'value'], rows);
  },
  // Positional args: [0] business. Each real product shape (a real,
  // ordered chain of [dimensionName, hierarchyName] pairs) is encoded via
  // the same real, shared nested-list codec as pos.ts's
  // combinationValues/combinationShape — one row per shape, one column.
  getProductShapes: (v, user) => {
    requireAuth(user);
    const [business] = v;
    if (!business) throw new CallError(400, 'business is required.');
    const shapes = getBusinessProductShapes(asBusinessName(business));
    return table(['shape'], shapes.map((chain) => ({ shape: encodeShape(chain) })));
  },
  // Positional args: [0] business, [1] hierarchyName, [2] of (Items or
  // Locations: what the hierarchy is of).
  createHierarchy: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, hierarchyName, of] = v;
    if (!business || !hierarchyName) throw new CallError(400, 'business and hierarchyName are both required.');
    if (!(HIERARCHY_KINDS as readonly string[]).includes(of ?? '')) throw new CallError(400, `of must be one of ${HIERARCHY_KINDS.join(', ')}.`);
    try {
      const hierarchy = ensureHierarchy(asBusinessName(business), hierarchyName, asUserId(admin.id), of as HierarchyKind);
      return row(hierarchy.name);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] business, [1] hierarchyName, [2] valueName,
  // [3] parentValueName (optional).
  createHierarchyValue: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, hierarchyName, valueName, parentValueName] = v;
    if (!business || !hierarchyName || !valueName) throw new CallError(400, 'business, hierarchyName and valueName are all required.');
    try {
      const value = ensureHierarchyValue(asBusinessName(business), hierarchyName, valueName, asUserId(admin.id));
      if (parentValueName) setHierarchyParent(valueName, hierarchyName, parentValueName, asUserId(admin.id));
      return row(value.name);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      throw err;
    }
  },
  // Positional args: [0] entityName, [1] hierarchyName, [2] parentName.
  setHierarchyTag: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [entityName, hierarchyName, parentName] = v;
    if (!entityName || !hierarchyName || !parentName) throw new CallError(400, 'entityName, hierarchyName and parentName are all required.');
    try {
      // A location is found under the session's business, never as a
      // same-named node elsewhere (docs/pm-domain-reference.md).
      const business = sessionBusinessName();
      // A value is found among the business's own values in the same way.
      const entityId = business ? (resolveBusinessLocationId(business, entityName) ?? resolveHierarchyValueId(business, hierarchyName, entityName)) : undefined;
      const targetId = business ? resolveHierarchyValueId(business, hierarchyName, parentName) : undefined;
      if (business) checkHierarchyTag(business, hierarchyName, entityName, parentName);
      setHierarchyParent(entityName, hierarchyName, parentName, asUserId(admin.id), entityId, targetId);
      return row(entityName, hierarchyName, parentName);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] business, [1] hierarchyName. Every value, then
  // every location or item in one, each with the value it is within
  // ('' at the top).
  getHierarchyTree: (v, user) => {
    requireAuth(user);
    const [business, hierarchyName] = v;
    if (!business || !hierarchyName) throw new CallError(400, 'business and hierarchyName are both required.');
    return table(['name', 'kind', 'parent'], getHierarchyTree(business, hierarchyName).map((n) => ({ ...n, parent: n.parent ?? '' })));
  },
  // No args: every hierarchy prototype, what it is of, and its number of values.
  listHierarchyPrototypes: (_v, user) => {
    requireAuth(user);
    return table(['prototype', 'of', 'values'], listHierarchyPrototypes());
  },
  // Positional args: [0] business, [1] hierarchyName, [2] prototypeName.
  saveHierarchyPrototype: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, hierarchyName, prototypeName] = v;
    if (!business || !hierarchyName || !prototypeName) throw new CallError(400, 'business, hierarchyName and prototypeName are all required.');
    try {
      saveHierarchyPrototype(asBusinessName(business), hierarchyName, prototypeName, asUserId(admin.id));
      return row(prototypeName);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      throw err;
    }
  },
  // Positional args: [0] business, [1] prototypeName, [2] hierarchyName.
  createHierarchyFromPrototype: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, prototypeName, hierarchyName] = v;
    if (!business || !prototypeName || !hierarchyName) throw new CallError(400, 'business, prototypeName and hierarchyName are all required.');
    try {
      createHierarchyFromPrototype(asBusinessName(business), prototypeName, hierarchyName, asUserId(admin.id));
      return row(hierarchyName);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      throw err;
    }
  },
  // Positional args: [0] hierarchyName.
  getHierarchyAssignments: (v, user) => {
    requireAuth(user);
    const [hierarchyName] = v;
    if (!hierarchyName) throw new CallError(400, 'hierarchyName is required.');
    const assignments = getHierarchyAssignments(hierarchyName);
    return table(
      ['entityName', 'parentName'],
      Object.entries(assignments).map(([entityName, parentName]) => ({ entityName, parentName }))
    );
  },
  // Positional args: [0] entityName, [1] hierarchyName.
  getHierarchyTag: (v, user) => {
    requireAuth(user);
    const [entityName, hierarchyName] = v;
    if (!entityName || !hierarchyName) throw new CallError(400, 'entityName and hierarchyName are both required.');
    return row(getHierarchyParent(entityName, hierarchyName) ?? '');
  },
  // Positional args: [0] entityName, [1] hierarchyName.
  deleteHierarchyTag: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [entityName, hierarchyName] = v;
    if (!entityName || !hierarchyName) throw new CallError(400, 'entityName and hierarchyName are both required.');
    try {
      deleteHierarchyParent(entityName, hierarchyName, asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] business, [1] hierarchyName.
  deleteHierarchy: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, hierarchyName] = v;
    if (!business || !hierarchyName) throw new CallError(400, 'business and hierarchyName are both required.');
    try {
      deleteHierarchy(asBusinessName(business), hierarchyName, asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      throw err;
    }
  },
  // Positional args: [0] business, [1] hierarchyName, [2] valueName.
  deleteHierarchyValue: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, hierarchyName, valueName] = v;
    if (!business || !hierarchyName || !valueName) throw new CallError(400, 'business, hierarchyName and valueName are all required.');
    try {
      deleteHierarchyValue(asBusinessName(business), hierarchyName, valueName, asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      throw err;
    }
  },
  // Positional args: [0] business, [1] dimensions (encodeShape-encoded).
  defineProductShape: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, dimensionsEncoded] = v;
    if (!business || !dimensionsEncoded) throw new CallError(400, 'business and dimensions are both required.');
    const dimensions = decodeShape(dimensionsEncoded);
    if (!dimensions || dimensions.length === 0) throw new CallError(400, 'dimensions must contain at least one [dimension, hierarchy] pair.');
    try {
      defineProductShape(asBusinessName(business), dimensions, asUserId(admin.id));
      return row(encodeShape(dimensions));
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
};
