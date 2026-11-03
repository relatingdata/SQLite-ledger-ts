// Converted from routes/entities.ts. GET endpoints require only
// requireAuth (old router had no auth middleware of its own, but the
// whole router is mounted with requireAuth in server.ts); POST/PATCH/PUT
// require Administrator or Bookkeeper; DELETE (revokeEntity) requires
// Administrator only — replicated exactly, not loosened to match the
// others.
import {
  getEntityTree,
  getEntity,
  getEntityHistory,
  createEntityRaw,
  supersedeEntity,
  revokeEntity,
  setRelationship,
  getHierarchyLinksPointingAt,
  setLineType,
  listLineTypes,
  reorderSiblings,
  reorderSiblingsBulk,
  asEntityId,
  ValidationError,
  NotFoundError,
  asUserId,
  createProvider,
  createCustomer,
  createEmployee,
  type EntityNode,
} from '../db.js';
import { CallError, decodeStringList, requireAuth, requireRole, row, table, type BackendCall } from '../call-dispatch.js';

function entityNodeRow(e: EntityNode) {
  return row(e.id, e.name, e.parent_id, e.relation_id, e.accountnumber, e.balance_minor, e.currency);
}

export const entitiesFunctions: Record<string, BackendCall> = {
  // Positional args: [0] business (optional). Despite the name, the real
  // result is already a FLAT, depth-annotated array (see db.ts's own
  // comment on getEntityTree) — no tree-flattening problem here at all,
  // unlike the arbitrary-depth CategoryTreeNode[] deferred in
  // matrix-reports.ts/reports.ts.
  getEntityTree: (v, user) => {
    requireAuth(user);
    const [business] = v;
    const rows = getEntityTree(business || undefined);
    return table(
      ['id', 'name', 'parent_id', 'relation_id', 'accountnumber', 'balance_minor', 'currency', 'depth', 'is_postable_account', 'line_type'],
      rows
    );
  },
  // Positional args: [0] id. No live frontend caller (db.ts's own
  // comment: this IS SqlEntityDriver.get's backing implementation, not a
  // call site) — built anyway for a complete backend surface. Row:
  // [0] exists ('1'/'0'), then the EntityNode fields.
  getEntity: (v, user) => {
    requireAuth(user);
    const [idRaw] = v;
    if (!idRaw) throw new CallError(400, 'id is required.');
    const entity = getEntity(Number(idRaw));
    if (!entity) return row('0');
    return row('1', entity.id, entity.name, entity.parent_id, entity.relation_id, entity.accountnumber, entity.balance_minor, entity.currency);
  },
  // Positional args: [0] id. No live frontend caller.
  getEntityHistory: (v, user) => {
    requireAuth(user);
    const [idRaw] = v;
    if (!idRaw) throw new CallError(400, 'id is required.');
    return table(['name', 'parent_id', 'relation_id', 'created_at', 'created_by'], getEntityHistory(Number(idRaw)));
  },
  // Positional args: [0] entityId.
  getHierarchyLinksPointingAt: (v, user) => {
    requireAuth(user);
    const [entityIdRaw] = v;
    if (!entityIdRaw) throw new CallError(400, 'entityId is required.');
    const entity = getEntity(Number(entityIdRaw));
    if (!entity) throw new CallError(404, 'Not found.');
    return table(['entityName', 'hierarchyName'], getHierarchyLinksPointingAt(entity.name));
  },
  // Positional args: [0] type ('vendor'/'customer'/'employee'), [1] name.
  // The old route's single, real, generic POST /contact collapsed into
  // three frontend-facing call names, matching the frontend's own three
  // exported functions (createProvider/createCustomer rarely need a
  // 3rd arg; createEmployeeContact does) — same precedent as
  // departments.ts's createDepartment keyed by frontend name.
  createProvider: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [name] = v;
    if (!name) throw new CallError(400, 'name is required.');
    try {
      const entity = createProvider(name, asUserId(admin.id));
      return row(entity.id);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  createCustomer: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [name] = v;
    if (!name) throw new CallError(400, 'name is required.');
    try {
      const entity = createCustomer(name, asUserId(admin.id));
      return row(entity.id);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  createEmployeeContact: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [name, placeOfEmployment] = v;
    if (!name || !placeOfEmployment) throw new CallError(400, 'name and placeOfEmployment are both required for a real employee.');
    try {
      const entity = createEmployee(name, placeOfEmployment, asUserId(admin.id));
      return row(entity.id);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] name, [1] parent, [2] parentId, [3] relation,
  // [4] accountnumber. The Entity Tree Editor's own genuinely generic
  // "create anything, anywhere" endpoint — see db.ts's own comment on
  // createEntityRaw.
  createEntity: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [name, parent, parentIdRaw, relation, accountnumber] = v;
    if (!name) throw new CallError(400, 'name is required.');
    try {
      const entity = createEntityRaw(
        { name, parent: parent || null, parentId: parentIdRaw ? Number(parentIdRaw) : undefined, relation: relation || null, accountnumber: accountnumber || null },
        asUserId(admin.id)
      );
      return entityNodeRow(entity);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] id, [1] name, [2] parent, [3] relation,
  // [4] accountnumber. A field left as the empty string on the wire is
  // indistinguishable from "not provided" — same limitation already
  // accepted elsewhere in this protocol (e.g. items.ts's setItem).
  supersedeEntity: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [idRaw, name, parent, relation, accountnumber] = v;
    if (!idRaw) throw new CallError(400, 'id is required.');
    try {
      const entity = supersedeEntity(
        Number(idRaw),
        { name: name || undefined, parent: parent || null, relation: relation || null, accountnumber: accountnumber || null },
        asUserId(admin.id)
      );
      return entityNodeRow(entity);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      throw err;
    }
  },
  // Positional args: [0] entityName, [1] lineType ('' clears it).
  // No live frontend caller.
  setLineType: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [entityName, lineType] = v;
    if (!entityName) throw new CallError(400, 'entityName is required.');
    try {
      setLineType(entityName, lineType || null, asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // No args. No live frontend caller.
  listLineTypes: (v, user) => {
    requireAuth(user);
    return table(['name'], listLineTypes().map((name) => ({ name })));
  },
  // Positional args: [0] ids (encodeStringList-encoded list of numeric
  // ids), [1] direction ('up'/'down'). No live frontend caller.
  reorderEntities: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [idsEncoded, direction] = v;
    if (!idsEncoded || (direction !== 'up' && direction !== 'down')) throw new CallError(400, 'ids and a real direction (up/down) are both required.');
    const ids = decodeStringList(idsEncoded).map(Number);
    if (ids.length === 0) throw new CallError(400, 'ids must contain at least one id.');
    try {
      if (ids.length === 1) {
        reorderSiblings(asEntityId(ids[0]), direction, asUserId(admin.id));
      } else {
        reorderSiblingsBulk(ids, direction, asUserId(admin.id));
      }
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      throw err;
    }
  },
  // Positional args: [0] id. Administrator only — NOT Bookkeeper, matching
  // the old route's own, deliberately narrower gate on deletion.
  revokeEntity: (v, user) => {
    const admin = requireRole(user, 'Administrator');
    const [idRaw] = v;
    if (!idRaw) throw new CallError(400, 'id is required.');
    try {
      revokeEntity(Number(idRaw), asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      throw err;
    }
  },
  // Positional args: [0] entityName, [1] relationshipType, [2] targetName.
  setEntityRelationship: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [entityName, relationshipType, targetName] = v;
    if (!entityName || !relationshipType || !targetName) throw new CallError(400, 'entityName, relationshipType and targetName are all required.');
    try {
      setRelationship(entityName, relationshipType, targetName, asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      throw err;
    }
  },
};
