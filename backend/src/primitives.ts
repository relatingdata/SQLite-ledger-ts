// Documented in docs/pm-entity-model.md, "The primitive set" and
// "Primitive implementation notes" - this file carries no further
// multiline comments.
import { db } from './db.js';
import {
  setEntityLink,
  getEntityLink,
  deleteEntityLink,
  stageLine,
  getHierarchy,
  asAccountName,
  asBusinessName,
  asLedgerName,
  type UserId,
} from './db.js';
import { entityDriver } from './entity-driver-select.js';
import type { EntityNode } from './entity-driver.js';

// Every method below that used to be inline SQL (or a direct db.ts call) is
// now a one-line delegation to entityDriver — the ONE place that knows
// which concrete storage (SQL today, Kaappi, anything else later) actually
// backs "entities". See /root/.claude/plans/stateful-snacking-adleman.md.
// ensureUnder/tag/untag/clearAttr stay exactly as they were: pure
// compositions over the other Entity methods, not raw storage access, so
// they need no driver involvement of their own.
export const Entity = {
  create(name: string, parent: string | number, userId: UserId): EntityNode {
    return entityDriver.create(name, parent, userId);
  },

  get(idOrName: number | string, parent?: string): EntityNode | undefined {
    return entityDriver.get(idOrName, parent);
  },

  getUnder(name: string, parentId: number): EntityNode | undefined {
    return entityDriver.getUnder(name, parentId);
  },

  ensureUnder(name: string, parentId: number, userId: UserId): EntityNode {
    return Entity.getUnder(name, parentId) ?? Entity.create(name, parentId, userId);
  },

  rename(id: number, name: string, userId: UserId): void {
    entityDriver.rename(id, name, userId);
  },
  reparent(id: number, parent: string, userId: UserId): void {
    entityDriver.reparent(id, parent, userId);
  },
  relate(id: number, target: string | null, userId: UserId, targetId?: number): void {
    entityDriver.relate(id, target, userId, targetId);
  },
  revoke(id: number, userId: UserId): void {
    entityDriver.revoke(id, userId);
  },
  children(parentId: number): EntityNode[] {
    return entityDriver.children(parentId);
  },
  tag(id: number, tagName: string, userId: UserId): void {
    const tagNode = Entity.ensureUnder(tagName, id, userId);
    Entity.relate(tagNode.id, 'Active', userId);
  },
  untag(id: number, tagName: string, userId: UserId): void {
    const tagNode = Entity.getUnder(tagName, id);
    if (tagNode) Entity.relate(tagNode.id, null, userId);
  },
  hasTag(id: number, tagName: string): boolean {
    return entityDriver.hasTag(id, tagName);
  },
  setAttr(id: number, attrType: string, value: string, userId: UserId): void {
    entityDriver.setAttr(id, attrType, value, userId);
  },
  getAttr(id: number, attrType: string): string | undefined {
    return entityDriver.getAttr(id, attrType);
  },
  clearAttr(id: number, attrType: string, userId: UserId): void {
    const typeNode = Entity.getUnder(attrType, id);
    if (!typeNode) return;
    const existing = Entity.children(typeNode.id)[0];
    if (existing) Entity.revoke(existing.id, userId);
  },
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
  // Stage C category methods — exposed here one at a time, as real call
  // sites in the ~470-site sweep actually need them (per the approved
  // plan's own stated discipline), not all at once speculatively.
  findAll(filter: { relationId?: number | null; nameSuffix?: string; underTagNamed?: string }): EntityNode[] {
    return entityDriver.findAll(filter);
  },
};

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

export const Balance = {
  post(business: string, ledger: string, reference: string, accountName: string, accountId: number, delta: number, userId: UserId, transdate?: string): void {
    stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), transdate, account: asAccountName(accountName), accountId, amount_minor: delta });
    db.prepare(`INSERT INTO post_quantity_movement (reference, business, ledger, user_id) VALUES (?, ?, ?, ?)`).run(reference, business, ledger, userId);
  },
  get(accountId: number): number {
    const row = db.prepare(`SELECT balance_minor FROM account WHERE entity_id = ?`).get(accountId) as { balance_minor: number } | undefined;
    return row?.balance_minor ?? 0;
  },
};

export const Hierarchy = {
  buildTree(rootName: string, getProperties: (entityName: string, entityId: number | null) => Record<string, number>, relationshipType?: string, knownRootId?: number): HierarchyTreeNode {
    const root = getHierarchy(rootName, relationshipType, knownRootId);
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
  own: Record<string, number>;
  total: Record<string, number>;
  children: HierarchyTreeNode[];
}

export const Currency = {
  toDebitCredit(amountMinor: number, normalSide: 'debit' | 'credit' = 'debit'): { debit_minor: number; credit_minor: number; is_contra: boolean } {
    const debit_minor = amountMinor > 0 ? amountMinor : 0;
    const credit_minor = amountMinor < 0 ? -amountMinor : 0;
    return { debit_minor, credit_minor, is_contra: normalSide === 'debit' ? credit_minor > 0 : debit_minor > 0 };
  },
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
