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

/** The known, bare names of a real product's own internal, per-item
 * records — every kind of entity that `createItemAndCategory`'s own
 * later helpers hang directly off a real product (quantity tracking
 * via `ensureItemQuantityAccounts`, cost/source tracking via
 * `addOrUpdateItemSource`) — plus the literal marker name
 * (`'Item Source'`) that the source-record helper nests one level
 * deeper still, under its own generated record. This list is
 * necessarily a whack-a-mole of exact names, which is why
 * `isInternalItemRecord` below does NOT rely on this list alone: it
 * also recognizes the generated, structural `" — Source — "` naming
 * pattern itself, and — critically — recurses up the ancestor chain,
 * so any node ANYWHERE beneath a recognized internal record (not just
 * the record's own immediate children) is excluded too. */
const INTERNAL_ITEM_RECORD_NAMES = new Set(['On Order', 'Units Sold', 'Count Adjustment', 'Write-off', 'Item Source']);

/** Structural marker for an auto-generated item-source record (see
 * `addOrUpdateItemSource` in `backend/src/db.ts`), which names the
 * entity it creates `${itemName} — Source — mfr:... — vendor:... —
 * ccy:... — pi:...`. Matched by substring rather than anchoring to the
 * item's own name, since at the point this is checked we may not yet
 * know which ancestor is the real item. */
function looksLikeSourceRecordName(name: string): boolean {
  return name.includes(' — Source — ');
}

/** A real, structural check for whether an entity is — or lives
 * beneath — one of a real product's own internal, per-item records
 * (quantity sub-accounts, source/cost records, and anything nested
 * under those), as opposed to being a real, user-named catalog item or
 * category itself.
 *
 * A real, significant, confirmed bug fixed here, found live by
 * directly inspecting `/stock/po`'s own real Item `<select>` via
 * discover-selectors.ts, in two separate, successive occurrences:
 * first, once a real product (e.g. Amber Ale 330ml) has any real stock
 * movement against it, it gains four real, bare-named quantity
 * sub-accounts as direct children; second, once a real item source is
 * registered (`addOrUpdateItemSource`), it additionally gains a
 * generated `"<name> — Source — ..."` child, which itself has its OWN
 * child literally named `'Item Source'`. A version of this check that
 * only recognized a product's own DIRECT children (by exact bare name)
 * caught the first occurrence but not the second: "Item Source" sits
 * two levels below the real product, not one, so a one-level check
 * never saw it, `filterToItems`'s `isLeaf` test on the real product
 * kept failing (the product has a non-whitelisted child, the source
 * record), and the source record's own child ("Item Source") — itself
 * a leaf and itself a descendant of "Items" via the product — wrongly
 * appeared in the dropdown in the product's place.
 *
 * Fixed generally, not just for this one extra level, by walking from
 * the entity itself UP through every ancestor (stopping at "Items",
 * the real catalog root) and checking EACH one along the way against
 * the known internal-record names and the generated source-record
 * naming pattern — so any future per-item internal record nested at
 * any depth beneath a real product is excluded the same way, without
 * needing a fresh fix each time a new kind of internal record is
 * added. */
function isInternalItemRecord(entity: EntityNode, allEntities: EntityNode[]): boolean {
  const byId = new Map(allEntities.map((e) => [e.id, e]));
  let current: EntityNode | undefined = entity;
  const seen = new Set<number>();
  while (current) {
    if (seen.has(current.id)) return false; // guard against a malformed/cyclic tree
    seen.add(current.id);
    if (INTERNAL_ITEM_RECORD_NAMES.has(current.name) || looksLikeSourceRecordName(current.name)) return true;
    if (current.name === 'Items') return false; // reached the real catalog root without finding an internal marker
    current = current.parent_id != null ? byId.get(current.parent_id) : undefined;
  }
  return false;
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
    if (isInternalItemRecord(e, entities)) return false;
    const children = entities.filter((c) => c.parent_id === e.id);
    const isLeaf = children.length === 0 || children.every((c) => isInternalItemRecord(c, entities));
    return isLeaf && isDescendantOf(e, 'Items', entities, true);
  });
}
