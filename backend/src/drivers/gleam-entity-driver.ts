// gleam-entity-driver.ts — EntityDriver backed by storage_engine (the
// Gleam/BEAM storage engine at /home/claude/storage_engine), reached
// synchronously via a worker thread + Atomics.wait bridge over real HTTP
// calls (see gleam-worker.ts's header for the transport, and
// entity-driver.ts's header for why this needed to be synchronous at
// all — the exact same constraint KaappiEntityDriver already works
// under).
//
// Unlike Kaappi's wire protocol (bare ids/scalars for most calls), every
// storage_engine entity endpoint this driver uses returns a full
// {id, name, parent_id, relation_id} record, so most methods here cost
// exactly one HTTP round trip — no separate name-lookup call needed the
// way Kaappi's `mustGetName` pattern requires.
//
// Known, disclosed gap, by deliberate design (not an oversight): `revoke`
// below does NOT call storage_engine at all. db.ts's own `revokeEntity`
// is already the whole, correctly-guarded application-level operation
// (rejects live children, journal postings, dangling incoming links) and
// its one real mutation is `Entity.reparent(id, 'Revoked', userId)` —
// which routes back through whichever EntityDriver is active, this one
// included. Reimplementing those guards a second time in Gleam would be
// real, undone, duplicated work with no behavior this driver needs that
// db.ts doesn't already provide — see storage.gleam's `relate_entity` doc
// comment for the matching half of this reasoning on the Gleam side.
//
// Stage-C-category methods (resolveAncestor, descendantsWithDepth,
// ancestorChain, getMany, findAll, findByNameContaining) throw "not
// implemented", same treatment as KaappiEntityDriver — nothing calls them
// yet (Stage A only wires primitives.ts/routes/i18n.ts); building them
// honestly against real Stage-C call sites, rather than speculatively,
// is the same choice already made for Kaappi.
import { Worker } from 'node:worker_threads';
import type { EntityDriver, EntityNode } from '../entity-driver.js';
import { db, revokeEntity, type UserId } from '../db.js';
// Static import, exactly like SqlEntityDriver's own (sql-entity-driver.ts
// already imports db.ts the same way). Confirmed directly: the real,
// pre-existing requirement is that db.ts itself must be the first module
// touched by any entry point (server.ts, the test files, every script
// under backend/scripts all do this already) — db.ts's own top-level
// schema-bootstrap/seed code reaches back into primitives.ts's `Entity`
// before that module instance fully initializes if something instead
// enters the graph through primitives.ts FIRST, regardless of which
// EntityDriver is selected or which driver files happen to be in the
// static import graph. That's an existing, orthogonal constraint on
// entry order, not something this file's own import of db.ts changes.

const CONTROL_INTS = 3; // [status, payload length in bytes, reserved]
const STATUS_IDX = 0;
const LENGTH_IDX = 1;
const IDLE = 0;
const READY = 1;
const START_FAILED = 2;
const CALL_OK = 1;
const CALL_ERROR = 2;

// Generous for anything this driver returns (single records, short
// id/name/children lists) — a real overflow surfaces as an error from
// gleam-worker.ts rather than silently truncating.
const PAYLOAD_CAPACITY = 4 * 1024 * 1024;

interface GleamNode {
  id: number;
  name: string;
  parent_id: number | null;
  relation_id: number | null;
}

export class GleamEntityDriver implements EntityDriver {
  private worker: Worker;
  private control: Int32Array;
  private payload: Uint8Array;

  constructor() {
    const controlSab = new SharedArrayBuffer(CONTROL_INTS * 4);
    const payloadSab = new SharedArrayBuffer(PAYLOAD_CAPACITY);
    this.control = new Int32Array(controlSab);
    this.payload = new Uint8Array(payloadSab);

    // Same tsx-vs-tsc extension-matching trick KaappiEntityDriver already
    // uses, for the same reason: this module's own URL tells us which
    // loader the worker needs too.
    const selfIsTs = import.meta.url.endsWith('.ts');
    const workerUrl = new URL(selfIsTs ? 'gleam-worker.ts' : 'gleam-worker.js', import.meta.url);
    this.worker = new Worker(workerUrl, {
      workerData: { controlSab, payloadSab, payloadCapacity: PAYLOAD_CAPACITY },
      execArgv: selfIsTs ? ['--import', 'tsx/esm'] : [],
    });
    this.worker.on('error', (err) => {
      process.stderr.write(`[gleam-entity-driver] worker thread error: ${err instanceof Error ? (err.stack ?? err.message) : err}\n`);
    });
    this.worker.unref();

    // Same reasoning as KaappiEntityDriver's constructor: a FINITE wait,
    // not an untimed one, so a worker that dies before ever reaching an
    // Atomics.notify doesn't park this thread forever.
    const startupTimedOut = Atomics.wait(this.control, STATUS_IDX, IDLE, 30_000) === 'timed-out';
    if (startupTimedOut) {
      throw new Error('GleamEntityDriver: timed out waiting for gleam-worker to start (30s) — it may have died before reporting why; check stderr.');
    }
    const outcome = Atomics.load(this.control, STATUS_IDX);
    if (outcome === START_FAILED) {
      throw new Error(`GleamEntityDriver: storage_engine not reachable: ${this.readPayload()}`);
    }
    if (outcome !== READY) {
      throw new Error(`GleamEntityDriver: unexpected startup status ${outcome} from gleam-worker.`);
    }
  }

  private readPayload(): string {
    const len = Atomics.load(this.control, LENGTH_IDX);
    return new TextDecoder().decode(this.payload.subarray(0, len));
  }

  private callSync(method: 'GET' | 'POST', path: string, body?: unknown): { status: number; text: string } {
    Atomics.store(this.control, STATUS_IDX, IDLE);
    this.worker.postMessage({ method, path, body });
    // 40s — comfortably above ledger.gleam's own 25s process.call
    // timeout (itself comfortably above storage_engine's own 20s
    // sqlite busy-wait), so under real write contention the INNERMOST
    // timeout is always the one that fires first and explains itself,
    // never an outer one timing out first on a call that was actually
    // still progressing underneath.
    const timedOut = Atomics.wait(this.control, STATUS_IDX, IDLE, 40_000) === 'timed-out';
    if (timedOut) {
      throw new Error(`GleamEntityDriver: ${method} ${path} timed out after 40s waiting for gleam-worker.`);
    }
    const status = Atomics.load(this.control, STATUS_IDX);
    const text = this.readPayload();
    if (status === CALL_ERROR) throw new Error(`GleamEntityDriver: ${method} ${path} failed: ${text}`);
    if (status !== CALL_OK) throw new Error(`GleamEntityDriver: unexpected call status ${status} for ${method} ${path}.`);
    return JSON.parse(text) as { status: number; text: string };
  }

  /** One HTTP round trip, decoded. `json` is `null` for an empty (204) body. */
  private request(method: 'GET' | 'POST', path: string, body?: unknown): { status: number; json: unknown } {
    const { status, text } = this.callSync(method, path, body);
    return { status, json: text.length > 0 ? JSON.parse(text) : null };
  }

  private toNode(row: GleamNode): EntityNode {
    return { id: row.id, name: row.name, parent_id: row.parent_id, relation_id: row.relation_id };
  }

  private lookupGlobal(name: string): EntityNode[] {
    const { json } = this.request('POST', '/entities/lookup', { name, scope: 'global' });
    return (json as GleamNode[]).map((r) => this.toNode(r));
  }

  private mustResolveByName(name: string): number {
    const node = this.lookupGlobal(name)[0];
    if (!node) throw new Error(`GleamEntityDriver: no entity named "${name}" found (global lookup).`);
    return node.id;
  }

  // ---- existing shape — direct ports of SqlEntityDriver's/primitives.ts's bodies ----

  create(name: string, parent: string | number, userId: UserId): EntityNode {
    const parentId = typeof parent === 'number' ? parent : this.mustResolveByName(parent);
    const { status, json } = this.request('POST', '/entities', { name, parent_id: parentId, created_by: userId });
    if (status !== 201) throw new Error(`GleamEntityDriver.create: ${JSON.stringify(json)}`);
    const id = (json as { id: number }).id;
    return { id, name, parent_id: parentId, relation_id: null };
  }

  get(idOrName: number | string, parent?: string): EntityNode | undefined {
    if (typeof idOrName === 'number') {
      const { status, json } = this.request('GET', `/entities/${idOrName}`);
      return status === 200 ? this.toNode(json as GleamNode) : undefined;
    }
    return this.getByName(idOrName, parent);
  }

  getByName(name: string, parent?: string): EntityNode | undefined {
    if (parent === undefined) return this.lookupGlobal(name)[0];
    const parentId = this.mustResolveByName(parent);
    return this.getUnder(name, parentId);
  }

  getUnder(name: string, parentId: number): EntityNode | undefined {
    const { status, json } = this.request('POST', '/entities/lookup', { name, scope: 'under', parent_id: parentId });
    return status === 200 ? this.toNode(json as GleamNode) : undefined;
  }

  rename(id: number, name: string, userId: UserId): void {
    const current = this.get(id);
    if (!current) throw new Error(`GleamEntityDriver.rename: no current entity with id ${id}.`);
    const { status, json } = this.request('POST', `/entities/${id}/rename`, { name, parent_id: current.parent_id, created_by: userId });
    if (status !== 204) throw new Error(`GleamEntityDriver.rename: ${JSON.stringify(json)}`);
  }

  reparent(id: number, parent: string, userId: UserId): void {
    const current = this.get(id);
    if (!current) throw new Error(`GleamEntityDriver.reparent: no current entity with id ${id}.`);
    const parentId = this.mustResolveByName(parent);
    const { status, json } = this.request('POST', `/entities/${id}/rename`, { name: current.name, parent_id: parentId, created_by: userId });
    if (status !== 204) throw new Error(`GleamEntityDriver.reparent: ${JSON.stringify(json)}`);
  }

  relate(id: number, target: string | null, userId: UserId, targetId?: number): void {
    const resolved = targetId !== undefined ? targetId : target === null ? null : this.mustResolveByName(target);
    const { status, json } = this.request('POST', `/entities/${id}/relate`, { target_id: resolved, created_by: userId });
    if (status !== 204) throw new Error(`GleamEntityDriver.relate: ${JSON.stringify(json)}`);
  }

  revoke(id: number, userId: UserId): void {
    revokeEntity(id, userId);
  }

  children(parentId: number): EntityNode[] {
    const { json } = this.request('GET', `/entities/${parentId}/children`);
    return (json as GleamNode[]).map((r) => this.toNode(r));
  }

  hasTag(id: number, tagName: string): boolean {
    return this.getUnder(tagName, id)?.relation_id != null;
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

  // ---- Stage C categories ----
  //
  // Found directly, the hard way, running the real tutorial e2e suite
  // under this driver as the live default: unlike KaappiEntityDriver
  // (whose Stage C methods really are "not called by anyone yet," per
  // entity-driver.ts's own header comment at the time that was written),
  // real call sites for getMany/descendantsWithDepth/findAll already
  // exist today (db-stock.ts/db-reports.ts) and fire on ordinary
  // tutorial steps — so "throw, build honestly later" was never
  // available here the way it was for Kaappi.
  //
  // Implemented as plain SQL against `db` (db.ts's own connection to the
  // exact same, real entities.sqlite file storage_engine itself writes
  // to), not as new storage_engine HTTP endpoints — identical, verbatim
  // queries to SqlEntityDriver's own (same recursive CTE, same bulk
  // `WHERE id IN (...)`), which is safe specifically BECAUSE these are
  // all pure reads: WAL mode (already turned on by db.ts) lets this
  // process's connection see every write storage_engine's own sqlite3
  // CLI subprocess has committed, with no risk to the single-writer
  // guarantee storage_engine's actor mailbox provides for WRITES, which
  // this file never bypasses.

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
      .all(...(rootId == null ? [] : [rootId])) as (GleamNode & { depth: number })[];
    return rows.map((r) => ({ ...this.toNode(r), depth: r.depth }));
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
    const rows = db.prepare(`SELECT id, name, parent_id, relation_id FROM current_entities WHERE id IN (${placeholders})`).all(...ids) as GleamNode[];
    return rows.map((r) => this.toNode(r));
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
    const rows = db.prepare(`SELECT id, name, parent_id, relation_id FROM current_entities ${where}`).all(...params) as GleamNode[];
    return rows.map((r) => this.toNode(r));
  }

  findByNameContaining(fragment: string, parentId?: number): EntityNode[] {
    const rows =
      parentId !== undefined
        ? (db.prepare(`SELECT id, name, parent_id, relation_id FROM current_entities WHERE name LIKE ? AND parent_id = ?`).all(`%${fragment}%`, parentId) as GleamNode[])
        : (db.prepare(`SELECT id, name, parent_id, relation_id FROM current_entities WHERE name LIKE ?`).all(`%${fragment}%`) as GleamNode[]);
    return rows.map((r) => this.toNode(r));
  }
}
