// primitives.ts — the real, minimal, generic operation set this
// entire application should be built from. Per direct correction:
// almost everything here is one of five kinds of fact about an
// entity — its structural position, a named link to another entity,
// a posted money/quantity balance, a contact detail, or a hierarchy
// walk — and 260 separately-named functions existed because each new
// screen got its own new name for what is structurally the same
// operation on a different entity name, instead of composing these
// five primitives. This module is additive: existing functions are
// being migrated to call through these, not deleted (per direct
// "delete nothing" instruction) — see db.ts's own real call sites as
// they're converted, one at a time, verified against the full e2e
// test after each real step.
import { db } from './db.js';
import {
  createEntityRaw as _createEntity,
  supersedeEntity as _supersedeEntity,
  revokeEntity as _revokeEntity,
  getEntity as _getEntity,
  setEntityLink,
  getEntityLink,
  deleteEntityLink,
  stageLine,
  getHierarchy,
  asAccountName,
  asBusinessName,
  asLedgerName,
  type UserId,
  type EntityNode,
} from './db.js';

// ===========================================================================
// Entity — the one real node type everything else is built from.
// ===========================================================================
export const Entity = {
  /** Creates a real, new entity — scoped-unique by (parent, name),
   * never globally unique, matching this schema's own established
   * (parent_id, name) index. */
  create(name: string, parent: string | number, userId: UserId): EntityNode {
    return typeof parent === 'number' ? _createEntity({ name, parentId: parent }, userId) : _createEntity({ name, parent }, userId);
  },

  /** A real entity, by id, or by (name, parent) — the real, correct,
   * scoped lookup, never a bare, global, ambiguous by-name lookup on
   * its own. */
  get(idOrName: number | string, parent?: string): { id: number; name: string; parent_id: number | null; relation_id: number | null } | undefined {
    if (typeof idOrName === 'number') return _getEntity(idOrName) ?? undefined;
    if (parent === undefined) {
      // A real, bare by-name lookup — only safe when the real name is
      // already known to be globally unique (Vocabulary, a business
      // name, a language) — every other real caller must pass parent.
      return db.prepare(`SELECT id, name, parent_id, relation_id FROM current_entities WHERE name = ?`).get(idOrName) as any;
    }
    return db
      .prepare(`SELECT id, name, parent_id, relation_id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ?)`)
      .get(idOrName, parent) as any;
  },

  /** Finds a real, scoped child by name under a real, known parent id
   * — the real, correct, scoped lookup by id rather than by a real,
   * ambiguous parent name. */
  getUnder(name: string, parentId: number): { id: number; name: string } | undefined {
    return db.prepare(`SELECT id, name FROM current_entities WHERE name = ? AND parent_id = ?`).get(name, parentId) as any;
  },

  /** Finds-or-creates a real, scoped child by name under a real,
   * known parent id — the single, real, correct way to "ensure this
   * exists" that every ensureXxx function was hand-rolling
   * separately. */
  ensureUnder(name: string, parentId: number, userId: UserId): { id: number; name: string } {
    return Entity.getUnder(name, parentId) ?? { id: _createEntity({ name, parentId }, userId).id, name };
  },

  rename(id: number, name: string, userId: UserId): void {
    _supersedeEntity(id, { name }, userId);
  },
  reparent(id: number, parent: string, userId: UserId): void {
    _supersedeEntity(id, { parent }, userId);
  },
  relate(id: number, target: string | null, userId: UserId, targetId?: number): void {
    _supersedeEntity(id, targetId !== undefined ? { relationId: targetId } : { relation: target }, userId);
  },
  revoke(id: number, userId: UserId): void {
    _revokeEntity(id, userId);
  },
  children(parentId: number): { id: number; name: string }[] {
    return db.prepare(`SELECT id, name FROM current_entities WHERE parent_id = ?`).all(parentId) as any;
  },
  /** Per direct instruction: no JSON of any kind. A real fact about
   * an entity (a lead time in days, a BOM quantity, a dependency
   * type, which of several real kinds a child is) is itself a real,
   * named child entity, found by a real, exact (parent, name)
   * lookup, never a name pattern and never a JSON field. tag/hasTag:
   * a real, presence-only marker, found by exact name under this one
   * entity. setAttr/getAttr: one real, single-valued fact (a
   * quantity, a date, a status) as its own, real, single child under
   * a real, named type-grouping, replaced in place whenever it
   * changes rather than accumulated. */
  tag(id: number, tagName: string, userId: UserId): void {
    const tagNode = Entity.ensureUnder(tagName, id, userId);
    Entity.relate(tagNode.id, 'Active', userId);
  },
  /** Supersedes the tag's own current value so its relation_id becomes
   * NULL - the real, settled replacement for removing a tag. The tag
   * entity itself is never removed; its history (once active, now
   * not) stays in this one table forever. */
  untag(id: number, tagName: string, userId: UserId): void {
    const tagNode = Entity.getUnder(tagName, id);
    if (tagNode) Entity.relate(tagNode.id, null, userId);
  },
  hasTag(id: number, tagName: string): boolean {
    const row = db.prepare(`SELECT relation_id FROM current_entities WHERE parent_id = ? AND name = ?`).get(id, tagName) as { relation_id: number | null } | undefined;
    return row?.relation_id != null;
  },
  setAttr(id: number, attrType: string, value: string, userId: UserId): void {
    const typeNode = Entity.ensureUnder(attrType, id, userId);
    const existing = Entity.children(typeNode.id)[0];
    if (existing) Entity.rename(existing.id, value, userId);
    else Entity.create(value, typeNode.id, userId);
  },
  getAttr(id: number, attrType: string): string | undefined {
    const typeNode = Entity.getUnder(attrType, id);
    if (!typeNode) return undefined;
    return Entity.children(typeNode.id)[0]?.name;
  },
  /** Per direct instruction: entities permits only INSERT and SELECT.
   * These three wrap the real, insert-only mechanisms
   * (entity_set_detail/entity_merge_detail/entity_set_relation/
   * entity_set_combination_ids, backend/schema/00-core.sql) that
   * replace every direct "UPDATE entities SET ..." call site. */
  setDetailJson(id: number, detailJson: string): void {
    db.prepare(`INSERT INTO entity_set_detail (entity_id, detail_json) VALUES (?, ?)`).run(id, detailJson);
  },
  mergeDetailJson(id: number, patchJson: string): void {
    db.prepare(`INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (?, ?)`).run(id, patchJson);
  },
  setRelationId(id: number, relationId: number | null): void {
    db.prepare(`INSERT INTO entity_set_relation (entity_id, relation_id) VALUES (?, ?)`).run(id, relationId);
  },
  setCombinationIds(id: number, combinationIdsJson: string): void {
    db.prepare(`INSERT INTO entity_set_combination_ids (entity_id, combination_ids) VALUES (?, ?)`).run(id, combinationIdsJson);
  },
};

// ===========================================================================
// Link — a named relationship between two entities. Replaces
// setDimensionParent/setContactType/setMenuOverride/Route/Label/
// Hidden-marker/setRelationship-style one-off functions — all of them
// were this one, real operation under a different name.
// ===========================================================================
export const Link = {
  set(entityName: string, linkType: string, target: string, userId: UserId): void {
    setEntityLink(entityName, linkType, target, userId);
  },
  get(entityName: string, linkType: string): string | undefined {
    return getEntityLink(entityName, linkType);
  },
  delete(entityName: string, linkType: string, userId: UserId): void {
    deleteEntityLink(entityName, linkType, userId);
  },
  /** A real, presence-only marker — existence itself is the real,
   * true value (a CoA prototype tag, "Not Implemented", "Is
   * Subheading", "Hidden" — all the same, real shape). */
  mark(entityName: string, markType: string, userId: UserId): void {
    const name = `${entityName} — ${markType}`;
    const row = Entity.get(name) ?? Entity.create(name, entityName, userId);
    Entity.relate(row.id, 'Active', userId);
  },
  unmark(entityName: string, markType: string, userId: UserId): void {
    const row = Entity.get(`${entityName} — ${markType}`);
    if (row) Entity.relate(row.id, null, userId);
  },
  isMarked(entityName: string, markType: string): boolean {
    const row = db.prepare(`SELECT relation_id FROM current_entities WHERE name = ?`).get(`${entityName} — ${markType}`) as { relation_id: number | null } | undefined;
    return row?.relation_id != null;
  },
  /** Every real entity name genuinely linked to a real target, under
   * a real linkType — replaces getContactsWithType/
   * getEntitiesWithRelationship-style scans. No filter of any kind,
   * and no JSON: the real link-type is a real, named tag-child
   * entity of the link record itself, matched exactly by (parent,
   * name) — the same, real mechanism Entity.tag already provides. */
  withTarget(linkType: string, target: string): string[] {
    return (
      db
        .prepare(
          `SELECT parent.name AS owner
           FROM current_entities rec
           JOIN current_entities parent ON parent.id = rec.parent_id
           JOIN current_entities tag ON tag.parent_id = rec.id AND tag.name = ? AND tag.relation_id IS NOT NULL
           WHERE rec.relation_id = (SELECT id FROM current_entities WHERE name = ?)`
        )
        .all(linkType, target) as { owner: string }[]
    ).map((r) => r.owner);
  },
};

// ===========================================================================
// Balance — a posted figure on an account. Replaces
// postQuantityMovement/postItemLevelFigure and every hand-rolled
// get*Balance*/getCashPosition-style reader: dollars and units are
// the exact, same, real primitive, differing only in which real
// account they post against — this is the real generalization of
// "buying/selling price and a unit conversion are both $/unit
// exchange rates."
// ===========================================================================
export const Balance = {
  /** Posts a real, single, append-only movement against one real
   * account — the real replacement for every direct, mutating
   * UPDATE. Genuinely not always a balanced, double-entry
   * transaction (a quantity movement or a capacity figure has no
   * real, meaningful counteritem) — callers needing real double-entry
   * post two of these, to two real accounts, under the same real
   * reference. */
  post(business: string, ledger: string, reference: string, accountName: string, accountId: number, delta: number, userId: UserId, transdate?: string): void {
    stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), transdate, account: asAccountName(accountName), accountId, amount_minor: delta });
    db.prepare(`INSERT INTO post_quantity_movement (reference, business, ledger, user_id) VALUES (?, ?, ?, ?)`).run(reference, business, ledger, userId);
  },
  /** The real, current, live balance on one real account — 0 if
   * nothing has ever posted, never null (there's no such thing as
   * "unknown," only "none yet"). */
  get(accountId: number): number {
    const row = db.prepare(`SELECT balance_minor FROM account WHERE entity_id = ?`).get(accountId) as { balance_minor: number } | undefined;
    return row?.balance_minor ?? 0;
  },
  /** The real, current, live balance scoped to one real dimension
   * (e.g. one real location) — the real replacement for every
   * hand-rolled "SUM(journal_line...) WHERE ... AND location_id = ?"
   * query scattered across get* functions. */
  getScoped(accountName: string, dimensionColumn: 'location_id', dimensionName: string): number {
    const row = db
      .prepare(
        `SELECT SUM(jl.amount_minor) AS total
         FROM journal_line jl
         JOIN current_entities a ON a.id = jl.account_id
         JOIN current_entities d ON d.id = jl.${dimensionColumn}
         WHERE a.name = ? AND d.name = ?`
      )
      .get(accountName, dimensionName) as { total: number | null } | undefined;
    return row?.total ?? 0;
  },
};

// ===========================================================================
// Hierarchy — a walk from any real root (getHierarchy itself already
// covers the plain, name-only tree). buildTree below is the one, real,
// general drill-down primitive: given a root, walk it, pull any real
// set of named numeric properties off each real leaf (balance, price,
// quantity — whatever properties the caller names), and sum each one
// independently at every real level. Never a function named for one
// specific kind of category (no buildCategoryTree, no
// buildDivisionTree) — the same, one, real function serves a P&L
// drill-down, an Inventory drill-down, or (passing more than one real
// property at once) a real, combined view showing several real
// figures side by side per row, all from the exact, same, real walk.
// ===========================================================================
export const Hierarchy = {
  /** Walks rootName's own real hierarchy and attaches a real set of
   * named numeric properties to every real node, summed recursively
   * at every real level — a genuine vector sum per property, not a
   * single flat number. getProperties(entityName, entityId) returns a
   * real map of property name to that leaf's own real, direct value
   * (e.g. `{ balance: ..., price: ... }`) — 0/undefined properties are
   * fine, a pure category node with no account of its own simply
   * contributes nothing of its own to the sum. The returned tree
   * carries each real node's own direct values (`own`) and its own
   * real recursive subtotal per property (`total`) — enough for any
   * real drill-down display to render directly, and general enough
   * that a later, real cartesian-product walk across more than one
   * hierarchy at once (e.g. product x location) can reuse it exactly
   * as-is, one real leaf-name pair at a time. */
  buildTree(rootName: string, getProperties: (entityName: string, entityId: number | null) => Record<string, number>, relationshipType?: string): HierarchyTreeNode {
    const root = getHierarchy(rootName, relationshipType);
    function build(n: { id: number; name: string; children: unknown[] }): HierarchyTreeNode {
      const own = getProperties(n.name, n.id);
      const children = (n.children as { id: number; name: string; children: unknown[] }[]).map((c) => build(c));
      const total: Record<string, number> = { ...own };
      for (const child of children) {
        for (const [key, value] of Object.entries(child.total)) {
          total[key] = (total[key] ?? 0) + value;
        }
      }
      return { name: n.name, accountId: n.id, own, total, children };
    }
    return build(root);
  },
};

export interface HierarchyTreeNode {
  name: string;
  accountId: number | null;
  /** This exact node's own real, direct property values — empty for
   * a real, pure category node with no account of its own. */
  own: Record<string, number>;
  /** The real, recursive sum of this node's own values plus every
   * real descendant's own values, one real vector sum per property
   * name — the real total a drill-down display's own parent row
   * shows. */
  total: Record<string, number>;
  children: HierarchyTreeNode[];
}

// ===========================================================================
// Detail — a real contact fact (address/phone/email/web page/
// anything user-expandable). One real shape for every kind, per
// direct instruction — never a hardcoded, dedicated field.
// ===========================================================================
export const Currency = {
  /** The one, real output method for a signed currency amount — every
   * report in this system uses this, never its own, separate,
   * hand-rolled `x > 0 ? x : 0` / `x < 0 ? -x : 0` split. normalSide
   * says which column this amount is genuinely expected to land in
   * for its own real section (Asset/Expense are normal-debit;
   * Liability/Equity/Income are normal-credit) — is_contra flags a
   * real amount that landed in the opposite column from what's
   * normal, worth showing distinctly rather than as an ordinary
   * positive number the way a raw signed amount would. */
  toDebitCredit(amountMinor: number, normalSide: 'debit' | 'credit' = 'debit'): { debit_minor: number; credit_minor: number; is_contra: boolean } {
    const debit_minor = amountMinor > 0 ? amountMinor : 0;
    const credit_minor = amountMinor < 0 ? -amountMinor : 0;
    return { debit_minor, credit_minor, is_contra: normalSide === 'debit' ? credit_minor > 0 : debit_minor > 0 };
  },
  /** The one, real input method — the exact, same, real class, the
   * other direction. The General Journal and every lines-entry table
   * (AR sale, AP purchase, POS, stock receipt/dispatch — every real
   * screen with a currency amount) ultimately produce a real,
   * signed amount_minor this way before it ever reaches
   * post_journal_entry, so every real posting in this system, however
   * it originated, becomes the exact, same, one, real, signed class. */
  fromDebitCredit(debitMinor: number, creditMinor: number): number {
    return debitMinor - creditMinor;
  },
};

export const Detail = {
  set(entityName: string, detailType: string, value: string, userId: UserId): void {
    const owner = Entity.get(entityName);
    if (!owner) throw new Error(`No entity named "${entityName}".`);
    const typeNode = Entity.ensureUnder(detailType, owner.id, userId);
    const row = Entity.getUnder(value, typeNode.id) ?? Entity.create(value, typeNode.id, userId);
    Entity.relate(row.id, 'Active', userId);
  },
  list(entityName: string, detailType?: string): string[] {
    const owner = Entity.get(entityName);
    if (!owner) return [];
    const activeChildren = (parentId: number) => db.prepare(`SELECT name FROM current_entities WHERE parent_id = ? AND relation_id IS NOT NULL`).all(parentId) as { name: string }[];
    if (detailType) {
      const typeNode = Entity.getUnder(detailType, owner.id);
      return typeNode ? activeChildren(typeNode.id).map((c) => c.name) : [];
    }
    return Entity.children(owner.id).flatMap((typeNode) => activeChildren(typeNode.id).map((c) => c.name));
  },
  delete(entityName: string, detailType: string, value: string, userId: UserId): void {
    const owner = Entity.get(entityName);
    const typeNode = owner && Entity.getUnder(detailType, owner.id);
    const row = typeNode && Entity.getUnder(value, typeNode.id);
    if (row) Entity.relate(row.id, null, userId);
  },
};
