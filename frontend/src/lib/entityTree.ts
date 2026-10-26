// Filtering the entity tree down to real products — see
// docs/pm-frontend-reference.md for the full design of each function
// below.

import type { EntityNode } from './api';

// See docs/pm-frontend-reference.md.
export function isDescendantOf(entity: EntityNode, ancestorName: string, allEntities: EntityNode[], matchSuffix = false): boolean {
  const byId = new Map(allEntities.map((e) => [e.id, e]));
  let current: EntityNode | undefined = entity;
  const seen = new Set<number>();
  while (current && current.parent_id != null) {
    if (seen.has(current.id)) return false; // guard against a malformed/cyclic tree, never loop forever
    seen.add(current.id);
    const parent = byId.get(current.parent_id);
    if (!parent) return false;
    if (matchSuffix ? (parent.name === ancestorName || parent.name.endsWith(' ' + ancestorName)) : parent.name === ancestorName) return true;
    current = parent;
  }
  return false;
}

// See docs/pm-frontend-reference.md.
const INTERNAL_ITEM_RECORD_NAMES = new Set(['On Order', 'Units Sold', 'Count Adjustment', 'Write-off', 'Item Source']);

// See docs/pm-frontend-reference.md.
function looksLikeSourceRecordName(name: string): boolean {
  return name.includes(' — Source — ');
}

// setEntityLink (backend/src/db.ts) names every link record
// "{entityName} — {linkType}" as a direct child of entityName — the
// same mechanism setHierarchyParent uses to tag an item with a
// Category (or any other Hierarchy) value. Category is the first
// Hierarchy that routinely tags Items themselves (Division has always
// tagged Locations instead), so a tagged item now genuinely has a
// real "{item} — Hierarchy: Category" child of its own; without
// recognizing it here, filterToItems's own leaf check below wrongly
// stopped treating a tagged item as a leaf at all, silently vanishing
// it from every item picker built from a real, confirmed regression.
function looksLikeHierarchyLinkRecordName(name: string): boolean {
  return name.includes(' — Hierarchy: ');
}

// See docs/pm-frontend-reference.md.
function isInternalItemRecord(entity: EntityNode, allEntities: EntityNode[]): boolean {
  const byId = new Map(allEntities.map((e) => [e.id, e]));
  let current: EntityNode | undefined = entity;
  const seen = new Set<number>();
  while (current) {
    if (seen.has(current.id)) return false; // guard against a malformed/cyclic tree
    seen.add(current.id);
    if (INTERNAL_ITEM_RECORD_NAMES.has(current.name) || looksLikeSourceRecordName(current.name) || looksLikeHierarchyLinkRecordName(current.name)) return true;
    if (current.name === 'Items') return false; // reached the real catalog root without finding an internal marker
    current = current.parent_id != null ? byId.get(current.parent_id) : undefined;
  }
  return false;
}

// See docs/pm-frontend-reference.md.
export function filterToItems(entities: EntityNode[]): EntityNode[] {
  return entities.filter((e) => {
    if (isInternalItemRecord(e, entities)) return false;
    const children = entities.filter((c) => c.parent_id === e.id);
    const isLeaf = children.length === 0 || children.every((c) => isInternalItemRecord(c, entities));
    return isLeaf && isDescendantOf(e, 'Items', entities, true);
  });
}
