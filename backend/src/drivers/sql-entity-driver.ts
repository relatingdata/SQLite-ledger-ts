// sql-entity-driver.ts — EntityDriver backed by the real SQLite
// `entities`/`current_entities` tables, via db.ts. Part of Stage A of
// /root/.claude/plans/stateful-snacking-adleman.md.
//
// The "existing shape" methods below are, deliberately, not reimplemented
// SQL — they delegate straight to db.ts's existing, already-tested
// createEntityRaw/supersedeEntity/revokeEntity/getEntity functions (the
// exact functions primitives.ts's Entity object already called before this
// refactor), or reproduce the handful of one-line `db.prepare(...)` queries
// that used to live directly in primitives.ts. This is what makes Stage A a
// genuine zero-behavior-change refactor: nothing about how an entity op
// resolves to SQL actually changes, only where the call originates.
//
// The Stage-C-category methods (resolveAncestor, descendantsWithDepth,
// ancestorChain, getMany, findAll, findByNameContaining) ARE implemented
// here for real, lifted from db.ts's resolveItemId / getEntityTree's `walk`
// CTE / the `WHERE id IN (...)` bulk-fetch pattern — but nothing calls them
// yet (Stage A only wires primitives.ts and routes/i18n.ts). They're not
// exercised by the real test suite until Stage C migrates a real call site
// to use them.
import { db, createEntityRaw, supersedeEntity, revokeEntity, getEntity, type UserId } from '../db.js';
import type { EntityDriver, EntityNode } from '../entity-driver.js';

function toNode(row: { id: number; name: string; parent_id: number | null; relation_id: number | null }): EntityNode {
  // db.ts's own EntityNode carries extra (accountnumber/balance_minor/
  // currency) fields on some queries; narrowing here keeps the driver's
  // public contract exactly the one entity-driver.ts declares.
  return { id: row.id, name: row.name, parent_id: row.parent_id, relation_id: row.relation_id };
}

export class SqlEntityDriver implements EntityDriver {
  create(name: string, parent: string | number, userId: UserId): EntityNode {
    const raw = typeof parent === 'number' ? createEntityRaw({ name, parentId: parent }, userId) : createEntityRaw({ name, parent }, userId);
    return toNode(raw);
  }

  get(idOrName: number | string, parent?: string): EntityNode | undefined {
    if (typeof idOrName === 'number') {
      const row = getEntity(idOrName);
      return row ? toNode(row) : undefined;
    }
    if (parent === undefined) {
      const row = db.prepare(`SELECT id, name, parent_id, relation_id FROM current_entities WHERE name = ?`).get(idOrName) as EntityNode | undefined;
      return row ? toNode(row) : undefined;
    }
    const row = db
      .prepare(`SELECT id, name, parent_id, relation_id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ?)`)
      .get(idOrName, parent) as EntityNode | undefined;
    return row ? toNode(row) : undefined;
  }

  getByName(name: string, parent?: string): EntityNode | undefined {
    return this.get(name, parent);
  }

  getUnder(name: string, parentId: number): EntityNode | undefined {
    const row = db.prepare(`SELECT id, name, parent_id, relation_id FROM current_entities WHERE name = ? AND parent_id = ?`).get(name, parentId) as EntityNode | undefined;
    return row ? toNode(row) : undefined;
  }

  rename(id: number, name: string, userId: UserId): void {
    supersedeEntity(id, { name }, userId);
  }

  reparent(id: number, parent: string, userId: UserId): void {
    supersedeEntity(id, { parent }, userId);
  }

  relate(id: number, target: string | null, userId: UserId, targetId?: number): void {
    supersedeEntity(id, targetId !== undefined ? { relationId: targetId } : { relation: target }, userId);
  }

  revoke(id: number, userId: UserId): void {
    revokeEntity(id, userId);
  }

  children(parentId: number): EntityNode[] {
    const rows = db.prepare(`SELECT id, name, parent_id, relation_id FROM current_entities WHERE parent_id = ?`).all(parentId) as EntityNode[];
    return rows.map(toNode);
  }

  hasTag(id: number, tagName: string): boolean {
    const row = db.prepare(`SELECT relation_id FROM current_entities WHERE parent_id = ? AND name = ?`).get(id, tagName) as { relation_id: number | null } | undefined;
    return row?.relation_id != null;
  }

  setAttr(id: number, attrType: string, value: string, userId: UserId): void {
    const typeNode = this.getUnder(attrType, id) ?? this.create(attrType, id, userId);
    const existing = this.children(typeNode.id)[0];
    if (existing) this.rename(existing.id, value, userId);
    else this.create(value, typeNode.id, userId);
  }

  getAttr(id: number, attrType: string): string | undefined {
    const typeNode = this.getUnder(attrType, id);
    if (!typeNode) return undefined;
    return this.children(typeNode.id)[0]?.name;
  }

  // ---- Stage C categories — implemented for real, unused until Stage C ----

  resolveAncestor(startId: number, stopAt: (name: string) => boolean): EntityNode | undefined {
    let current = this.get(startId);
    const seen = new Set<number>();
    while (current) {
      if (stopAt(current.name)) return current;
      if (current.parent_id == null || seen.has(current.parent_id)) return undefined;
      seen.add(current.parent_id);
      current = this.get(current.parent_id);
    }
    return undefined;
  }

  descendantsWithDepth(rootId: number | null): (EntityNode & { depth: number })[] {
    const rows = db
      .prepare(
        `WITH RECURSIVE walk(id, depth) AS (
           SELECT id, 0 FROM current_entities WHERE ${rootId == null ? 'parent_id IS NULL' : 'id = ?'}
           UNION ALL
           SELECT e.id, w.depth + 1 FROM current_entities e JOIN walk w ON e.parent_id = w.id
         )
         SELECT e.id, e.name, e.parent_id, e.relation_id, w.depth
         FROM walk w JOIN current_entities e ON e.id = w.id
         ORDER BY w.depth, e.name`
      )
      .all(...(rootId == null ? [] : [rootId])) as (EntityNode & { depth: number })[];
    return rows.map((r) => ({ ...toNode(r), depth: r.depth }));
  }

  ancestorChain(id: number): EntityNode[] {
    const chain: EntityNode[] = [];
    let current = this.get(id);
    const seen = new Set<number>();
    while (current) {
      chain.push(current);
      if (current.parent_id == null || seen.has(current.parent_id)) break;
      seen.add(current.parent_id);
      current = this.get(current.parent_id);
    }
    return chain;
  }

  getMany(ids: number[]): EntityNode[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = db.prepare(`SELECT id, name, parent_id, relation_id FROM current_entities WHERE id IN (${placeholders})`).all(...ids) as EntityNode[];
    return rows.map(toNode);
  }

  findAll(filter: { relationId?: number | null; nameSuffix?: string; underTagNamed?: string }): EntityNode[] {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter.relationId !== undefined) {
      if (filter.relationId === null) clauses.push('relation_id IS NULL');
      else {
        clauses.push('relation_id = ?');
        params.push(filter.relationId);
      }
    }
    if (filter.nameSuffix !== undefined) {
      clauses.push('name LIKE ?');
      params.push(`%${filter.nameSuffix}`);
    }
    if (filter.underTagNamed !== undefined) {
      clauses.push('parent_id IN (SELECT id FROM current_entities WHERE name = ?)');
      params.push(filter.underTagNamed);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db.prepare(`SELECT id, name, parent_id, relation_id FROM current_entities ${where}`).all(...params) as EntityNode[];
    return rows.map(toNode);
  }

  findByNameContaining(fragment: string, parentId?: number): EntityNode[] {
    const rows =
      parentId !== undefined
        ? (db.prepare(`SELECT id, name, parent_id, relation_id FROM current_entities WHERE name LIKE ? AND parent_id = ?`).all(`%${fragment}%`, parentId) as EntityNode[])
        : (db.prepare(`SELECT id, name, parent_id, relation_id FROM current_entities WHERE name LIKE ?`).all(`%${fragment}%`) as EntityNode[]);
    return rows.map(toNode);
  }
}
