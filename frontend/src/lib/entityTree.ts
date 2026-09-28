import type { EntityNode } from './api';

/**
 * Walks an entity's parent_id chain to determine whether it descends
 * from a named ancestor (e.g. "Items"). The real bug this exists to
 * prevent: "is this a postable leaf?" is true for every leaf GL
 * account (Cash and Bank, Sales Revenue, everything) just as much as
 * for an actual product — postable-ness says nothing about which
 * branch of the tree something lives in. A dropdown meant to offer
 * "which product" must filter by ancestry, not by postable-leaf-ness
 * alone.
 */
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

/** A real, direct, structural check for a real product's own two,
 * internal quantity sub-accounts (see ensureItemQuantityAccounts
 * in db.ts) — anchored to the real, established naming convention
 * that function itself already uses (`${itemName} — On Order`), and
 * to the real parent relationship (a genuine quantity sub-account's
 * own, direct parent is always the real product itself), rather than
 * a generic, standalone name-pattern guess that could, in principle,
 * also match a real product's own name coincidentally. */
function isQuantitySubAccount(entity: EntityNode, allEntities: EntityNode[]): boolean {
  if (entity.parent_id == null) return false;
  const parent = allEntities.find((e) => e.id === entity.parent_id);
  return !!parent && (entity.name === `${parent.name} — On Order` || entity.name === `${parent.name} — Units Sold`);
}

/** The specific, common case: leaf entities that are genuinely
 * descendants of "Items" — real products. Deliberately does NOT
 * require is_postable_account: a real product never has that flag set
 * at all (it posts via a wholly different mechanism — direct quantity
 * movement against the item's own entity, never the `account` table),
 * so requiring it would exclude every real product, not just the
 * wrong non-product accounts. Ancestry and leaf-ness are what actually
 * define "this is a sellable product," not postable-account-ness.
 *
 * A real, significant, pre-existing bug fixed here, found live: every
 * real product's own, real, internal "— On Order"/"— Units Sold"
 * quantity sub-accounts are also leaf-level descendants of Items —
 * meaning, before this fix, this function excluded the real product
 * itself (since it has real children, it isn't a "leaf" at all) and
 * returned only its own, internal sub-accounts instead. Confirmed
 * directly, live: the Purchase Order page's own Item dropdown never
 * actually offered a real product name at all, only its own two,
 * internal quantity accounts. Fixed by treating a product with only
 * quantity sub-accounts as its own, real, direct leaf too. */
export function filterToItems(entities: EntityNode[]): EntityNode[] {
  return entities.filter((e) => {
    if (isQuantitySubAccount(e, entities)) return false;
    const children = entities.filter((c) => c.parent_id === e.id);
    const isLeaf = children.length === 0 || children.every((c) => isQuantitySubAccount(c, entities));
    return isLeaf && isDescendantOf(e, 'Items', entities, true);
  });
}
