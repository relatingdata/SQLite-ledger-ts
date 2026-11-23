// Hierarchy prototypes: a hierarchy's tree of values, without any
// business's own items or locations, saved under Application ›
// Hierarchy Prototypes for any business to start a hierarchy from, as a
// business starts from a Chart of Accounts prototype
// (docs/pm-domain-reference.md, "Hierarchy prototypes").
//
// A prototype records what its hierarchy is of (a "Hierarchy Of"
// relation to the global Items or Locations root) and keeps each value
// under its parent as a real child: a prototype has no tags.
import { Entity } from './primitives.js';
import {
  db,
  ValidationError,
  NotFoundError,
  ensureHierarchy,
  ensureHierarchyValue,
  getHierarchyGroups,
  getBusinessHierarchy,
  setHierarchyParent,
  resolveHierarchyValueId,
  HIERARCHY_RELATIONS,
  type HierarchyKind,
  type BusinessName,
  type UserId,
} from './db.js';

const ROOT = 'Hierarchy Prototypes';
const KIND = 'Hierarchy Of';

function prototypesRoot(userId?: UserId): { id: number } | undefined {
  const application = Entity.get('Application');
  if (!application) throw new Error('No Application root.');
  return Entity.getUnder(ROOT, application.id) ?? (userId !== undefined ? Entity.create(ROOT, application.id, userId) : undefined);
}

function kindOf(prototypeId: number): HierarchyKind | undefined {
  const record = Entity.getUnder(KIND, prototypeId);
  const target = record?.relation_id != null ? Entity.get(record.relation_id) : undefined;
  return target?.name === 'Items' || target?.name === 'Locations' ? target.name : undefined;
}

export interface HierarchyPrototype {
  prototype: string;
  of: HierarchyKind;
  values: number;
}

/** Every hierarchy prototype, with what it is of and how many values it has. */
export function listHierarchyPrototypes(): HierarchyPrototype[] {
  const root = prototypesRoot();
  if (!root) return [];
  const out: HierarchyPrototype[] = [];
  for (const p of Entity.children(root.id)) {
    const of = kindOf(p.id);
    if (!of) continue;
    let values = 0;
    const count = (id: number) => {
      for (const c of Entity.children(id)) {
        if (HIERARCHY_RELATIONS.has(c.name)) continue;
        values++;
        count(c.id);
      }
    };
    count(p.id);
    out.push({ prototype: p.name, of, values });
  }
  return out.sort((a, b) => a.prototype.localeCompare(b.prototype));
}

/** Saves the business's hierarchy's tree of values as a new prototype. */
export function saveHierarchyPrototype(businessName: BusinessName, hierarchyName: string, prototypeName: string, userId: UserId): void {
  const hierarchy = getBusinessHierarchy(businessName).find((h) => h.hierarchy === hierarchyName);
  if (!hierarchy) throw new NotFoundError(`"${businessName}" has no hierarchy named "${hierarchyName}".`);
  const of = hierarchy.of;
  if (!of) throw new ValidationError(`"${hierarchyName}" is one of the application's own hierarchies, not a reporting hierarchy of the business.`);
  if (!prototypeName.trim()) throw new ValidationError('A prototype needs a name.');
  db.transaction(() => {
    const root = prototypesRoot(userId)!;
    if (Entity.getUnder(prototypeName, root.id)) throw new ValidationError(`A hierarchy prototype named "${prototypeName}" already exists.`);
    const prototype = Entity.create(prototypeName, root.id, userId);
    const kindRecord = Entity.create(KIND, prototype.id, userId);
    Entity.relate(kindRecord.id, null, userId, Entity.get(of, 'Application')!.id);
    const values = getHierarchyGroups(businessName, hierarchyName);
    const childrenOf = (parent: string | null) => values.filter((v) => v.parentName === parent).map((v) => v.name).sort();
    const copy = (parent: string | null, destId: number) => {
      for (const name of childrenOf(parent)) copy(name, Entity.create(name, destId, userId).id);
    };
    copy(null, prototype.id);
  })();
}

/** Creates the business's hierarchy from a prototype: every value, each
 * tagged under its parent; the business adds its own items or locations. */
export function createHierarchyFromPrototype(businessName: BusinessName, prototypeName: string, hierarchyName: string, userId: UserId): void {
  const root = prototypesRoot();
  const prototype = root ? Entity.getUnder(prototypeName, root.id) : undefined;
  const of = prototype ? kindOf(prototype.id) : undefined;
  if (!prototype || !of) throw new NotFoundError(`No hierarchy prototype named "${prototypeName}".`);
  if (getBusinessHierarchy(businessName).some((h) => h.hierarchy === hierarchyName)) {
    throw new ValidationError(`"${businessName}" already has a hierarchy named "${hierarchyName}".`);
  }
  db.transaction(() => {
    ensureHierarchy(businessName, hierarchyName, userId, of);
    const copy = (sourceId: number, parent: string | null) => {
      for (const c of Entity.children(sourceId)) {
        if (HIERARCHY_RELATIONS.has(c.name)) continue;
        const value = ensureHierarchyValue(businessName, hierarchyName, c.name, userId);
        if (parent !== null) setHierarchyParent(c.name, hierarchyName, parent, userId, value.id, resolveHierarchyValueId(businessName, hierarchyName, parent));
        copy(c.id, c.name);
      }
    };
    copy(prototype.id, null);
  })();
}
