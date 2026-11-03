// Converted from routes/hierarchy.ts. Mounted (old route) with requireAuth
// for the whole router; POST/DELETE further require Administrator or
// Bookkeeper, replicated per-function here.
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
import { CallError, decodeShape, encodeShape, requireAuth, requireRole, row, table, type BackendCall } from '../call-dispatch.js';

export const hierarchyFunctions: Record<string, BackendCall> = {
  // Positional args: [0] business. Flattens HierarchyGroupingWithValues[]
  // (one level of real nesting: a grouping name plus its own values[])
  // into one (grouping, value) table, with a sentinel row (value='', a
  // real value name is never empty) for a grouping that has zero values
  // yet — confirmed needed via grep of setup/hierarchy/+page.svelte,
  // which lists groupings themselves independent of their value count,
  // same discipline as departments.ts's getOrgChartStructure.
  getHierarchy: (v, user) => {
    requireAuth(user);
    const [business] = v;
    if (!business) throw new CallError(400, 'business is required.');
    const groupings = getBusinessHierarchy(asBusinessName(business));
    const rows: { grouping: string; value: string }[] = [];
    for (const g of groupings) {
      if (g.values.length === 0) rows.push({ grouping: g.grouping, value: '' });
      else for (const value of g.values) rows.push({ grouping: g.grouping, value });
    }
    return table(['grouping', 'value'], rows);
  },
  // Positional args: [0] hierarchyName.
  getHierarchyGroups: (v, user) => {
    requireAuth(user);
    const [hierarchyName] = v;
    if (!hierarchyName) throw new CallError(400, 'hierarchyName (name) is required.');
    return table(['name', 'parentName'], getHierarchyGroups(hierarchyName));
  },
  // Positional args: [0] business. Each real product shape (a real,
  // ordered chain of [dimensionName, groupingName] pairs) is encoded via
  // the same real, shared nested-list codec as pos.ts's
  // combinationValues/combinationShape — one row per shape, one column.
  getProductShapes: (v, user) => {
    requireAuth(user);
    const [business] = v;
    if (!business) throw new CallError(400, 'business is required.');
    const shapes = getBusinessProductShapes(asBusinessName(business));
    return table(['shape'], shapes.map((chain) => ({ shape: encodeShape(chain) })));
  },
  // Positional args: [0] business, [1] groupingName.
  createHierarchyGrouping: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, groupingName] = v;
    if (!business || !groupingName) throw new CallError(400, 'business and groupingName are both required.');
    try {
      const grouping = ensureHierarchyGrouping(asBusinessName(business), groupingName, asUserId(admin.id));
      return row(grouping.name);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] business, [1] groupingName, [2] valueName,
  // [3] parentValueName (optional).
  createHierarchyValue: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, groupingName, valueName, parentValueName] = v;
    if (!business || !groupingName || !valueName) throw new CallError(400, 'business, groupingName and valueName are all required.');
    try {
      const value = ensureHierarchyValue(asBusinessName(business), groupingName, valueName, asUserId(admin.id));
      if (parentValueName) setHierarchyParent(valueName, groupingName, parentValueName, asUserId(admin.id));
      return row(value.name);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] entityName, [1] hierarchyName, [2] parentName.
  setHierarchyTag: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [entityName, hierarchyName, parentName] = v;
    if (!entityName || !hierarchyName || !parentName) throw new CallError(400, 'entityName, hierarchyName and parentName are all required.');
    try {
      setHierarchyParent(entityName, hierarchyName, parentName, asUserId(admin.id));
      return row(entityName, hierarchyName, parentName);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
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
  // Positional args: [0] business, [1] groupingName.
  deleteHierarchyGrouping: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, groupingName] = v;
    if (!business || !groupingName) throw new CallError(400, 'business and groupingName are both required.');
    try {
      deleteHierarchyGrouping(asBusinessName(business), groupingName, asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      throw err;
    }
  },
  // Positional args: [0] business, [1] groupingName, [2] valueName.
  deleteHierarchyValue: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, groupingName, valueName] = v;
    if (!business || !groupingName || !valueName) throw new CallError(400, 'business, groupingName and valueName are all required.');
    try {
      deleteHierarchyValue(asBusinessName(business), groupingName, valueName, asUserId(admin.id));
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
    if (!dimensions || dimensions.length === 0) throw new CallError(400, 'dimensions must contain at least one [dimension, grouping] pair.');
    try {
      defineProductShape(asBusinessName(business), dimensions, asUserId(admin.id));
      return row(encodeShape(dimensions));
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
};
