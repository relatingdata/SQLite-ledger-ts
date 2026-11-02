// kaappi-entity-driver.ts — EntityDriver backed by a Kaappi (Scheme)
// subprocess, reached synchronously via a worker thread + Atomics.wait
// bridge (see kaappi-worker.ts's header for the transport, and
// entity-driver.ts's header for why this needed to be synchronous at all).
//
// What this class owns: translating EntityDriver's method calls into
// protocol.md's wire method names + positional args, sending them to the
// worker, blocking until the worker signals a result, and decoding it back
// into an EntityNode / primitive value. It owns nothing about the
// subprocess itself (spawn/supervise/WAL-replay) — that's entirely
// kaappi-worker.ts's job, running on its own thread.
//
// Known, disclosed gaps versus the SQL driver (not silently absorbed):
//  - Most wire methods return only an ext-id or a scalar, not a full
//    {id, name, parent_id, relation_id} record. `getMany`/`findAll`/
//    `findByNameContaining` are the exception (see below) — everything
//    else still returns a bare ext-id/scalar, and where this driver can't
//    derive parent_id/relation_id from the call's own arguments or from a
//    chain walk, it returns `null` for that field rather than guessing.
//  - `revoke` throws: Kaappi's own `entity-revoke!` requires a
//    revoked-bucket id and has stricter semantics (refuses to revoke an
//    entity with live children/incoming links) than the SQL system's own
//    revoke (an ordinary new row with relation_id set to NULL) — see
//    migrate-entities-to-kaappi.ts's header comment, which traced this
//    exact mismatch earlier in this engagement. Reconciling the two is
//    deliberately left as real, visible unfinished work rather than papered
//    over with a lossy translation.
//  - `create`'s historical "Vocabulary" global-root special case
//    (`createEntityRaw`'s `isGlobalVocabularyWord` branch, which resolves
//    to the one canonical Vocabulary root under Application rather than
//    any entity merely named "Vocabulary") is NOT replicated here — this
//    driver resolves a string parent by plain by-name lookup. Not exercised
//    by anything running under ENTITY_DRIVER=kaappi today (db-stock.ts's
//    two call sites that rely on it are Stage C work), but flagged here so
//    it isn't rediscovered the hard way when that file migrates.
//  - `getMany`/`findAll`/`findByNameContaining` are now implemented for
//    real, backed by three new protocol.md wire methods (entity-get-many,
//    entity-find-all, entity-find-by-name-containing) added to server.scm
//    specifically for this — unlike the rest of this dispatch table, these
//    three return a full JSON array of {id, name, parent_id, relation_id}
//    objects per call, so no extra per-result round trip is needed. See
//    entities.sld's entity-find-all/entity-find-by-name-containing for the
//    underlying full-scan primitives, and protocol.md for the (hasX, x)
//    pair convention used to carry a three-way-optional filter argument
//    over JSON.
import { Worker } from 'node:worker_threads';
import type { EntityDriver, EntityNode } from '../entity-driver.js';
import type { UserId } from '../db.js';

const CONTROL_INTS = 3; // [status, payload length in bytes, reserved]
const STATUS_IDX = 0;
const LENGTH_IDX = 1;
const IDLE = 0;
const READY = 1;
const START_FAILED = 2;
const CALL_OK = 1;
const CALL_ERROR = 2;

// 4 MB is generous for anything this driver currently returns (single
// records, short id/name lists) — a real overflow is surfaced as an error
// by kaappi-worker.ts rather than silently truncated.
const PAYLOAD_CAPACITY = 4 * 1024 * 1024;

type WireValue = string | number | boolean | null | WireValue[];

const n = (v: number | null | undefined): WireValue => (v == null ? null : v);

export class KaappiEntityDriver implements EntityDriver {
  private worker: Worker;
  private control: Int32Array;
  private payload: Uint8Array;

  constructor() {
    const controlSab = new SharedArrayBuffer(CONTROL_INTS * 4);
    const payloadSab = new SharedArrayBuffer(PAYLOAD_CAPACITY);
    this.control = new Int32Array(controlSab);
    this.payload = new Uint8Array(payloadSab);

    // Under `tsx` (dev/test), this module's own URL ends in `.ts` and the
    // worker needs the tsx ESM loader to run its TypeScript source
    // directly; under a `tsc` build (`npm run build` / `node dist/...`),
    // this module's URL ends in `.js` and so does the worker's, with no
    // loader needed. Picking the sibling file by extension, rather than
    // hardcoding one, is what keeps both `npm run dev` and `npm run build`
    // working without separate configuration.
    const selfIsTs = import.meta.url.endsWith('.ts');
    const workerUrl = new URL(selfIsTs ? 'kaappi-worker.ts' : 'kaappi-worker.js', import.meta.url);
    this.worker = new Worker(workerUrl, {
      workerData: { controlSab, payloadSab, payloadCapacity: PAYLOAD_CAPACITY },
      execArgv: selfIsTs ? ['--import', 'tsx/esm'] : [],
    });
    this.worker.on('error', (err) => {
      process.stderr.write(`[kaappi-entity-driver] worker thread error: ${err instanceof Error ? (err.stack ?? err.message) : err}\n`);
    });
    this.worker.unref(); // don't keep the process alive on this worker alone

    // Block synchronously until the worker has started the Kaappi
    // subprocess (or failed to) — a one-time, bounded wait at construction,
    // not per call. A FINITE timeout here (and on every callSync below)
    // is load-bearing, not cosmetic: if the worker thread dies before it
    // ever reaches a point that calls Atomics.notify — e.g. an uncaught
    // error during its own module load, confirmed directly to be possible
    // this stage (tsx's loader not remapping a relative import inside a
    // worker thread the way it does elsewhere) — an untimed Atomics.wait
    // blocks this thread FOREVER: the worker's 'error' event fires, but
    // this thread can't act on it while synchronously parked in the wait.
    const startupTimedOut = Atomics.wait(this.control, STATUS_IDX, IDLE, 30_000) === 'timed-out';
    if (startupTimedOut) {
      throw new Error('KaappiEntityDriver: timed out waiting for kaappi-worker to start (30s) — it may have died before reporting why; check stderr.');
    }
    const outcome = Atomics.load(this.control, STATUS_IDX);
    if (outcome === START_FAILED) {
      throw new Error(`KaappiEntityDriver: entity-server failed to start: ${this.readPayload()}`);
    }
    if (outcome !== READY) {
      throw new Error(`KaappiEntityDriver: unexpected startup status ${outcome} from kaappi-worker.`);
    }
  }

  private readPayload(): string {
    const len = Atomics.load(this.control, LENGTH_IDX);
    return new TextDecoder().decode(this.payload.subarray(0, len));
  }

  private callSync(method: string, args: WireValue[]): unknown {
    Atomics.store(this.control, STATUS_IDX, IDLE);
    this.worker.postMessage({ method, args });
    // Same reasoning as the constructor's wait: a finite timeout so a dead
    // or wedged worker surfaces as a clear error instead of hanging this
    // thread forever.
    const timedOut = Atomics.wait(this.control, STATUS_IDX, IDLE, 30_000) === 'timed-out';
    if (timedOut) {
      throw new Error(`KaappiEntityDriver: call to "${method}" timed out after 30s waiting for kaappi-worker.`);
    }
    const status = Atomics.load(this.control, STATUS_IDX);
    const text = this.readPayload();
    if (status === CALL_ERROR) throw new Error(text);
    if (status !== CALL_OK) throw new Error(`KaappiEntityDriver: unexpected call status ${status} for method "${method}".`);
    return JSON.parse(text);
  }

  // ---- existing shape ----

  create(name: string, parent: string | number, userId: UserId): EntityNode {
    const parentId = typeof parent === 'number' ? parent : this.mustResolveByName(parent);
    const id = this.callSync('entity-create', [name, n(parentId), null, userId]) as number;
    return { id, name, parent_id: parentId, relation_id: null };
  }

  get(idOrName: number | string, parent?: string): EntityNode | undefined {
    if (typeof idOrName === 'number') {
      const name = this.callSync('entity-get-name', [idOrName]) as string | null;
      return name == null ? undefined : { id: idOrName, name, parent_id: null, relation_id: null };
    }
    return this.getByName(idOrName, parent);
  }

  getByName(name: string, parent?: string): EntityNode | undefined {
    if (parent === undefined) {
      const id = this.callSync('entity-get-by-name', [name]) as number | null;
      return id == null ? undefined : { id, name, parent_id: null, relation_id: null };
    }
    const parentId = this.callSync('entity-get-by-name', [parent]) as number | null;
    if (parentId == null) return undefined;
    const id = this.callSync('entity-get-under', [name, parentId]) as number | null;
    return id == null ? undefined : { id, name, parent_id: parentId, relation_id: null };
  }

  getUnder(name: string, parentId: number): EntityNode | undefined {
    const id = this.callSync('entity-get-under', [name, parentId]) as number | null;
    return id == null ? undefined : { id, name, parent_id: parentId, relation_id: null };
  }

  rename(id: number, name: string, userId: UserId): void {
    this.callSync('entity-rename', [id, name, userId]);
  }

  reparent(id: number, parent: string, userId: UserId): void {
    const parentId = this.mustResolveByName(parent);
    this.callSync('entity-reparent', [id, parentId, userId]);
  }

  relate(id: number, target: string | null, userId: UserId, targetId?: number): void {
    const resolved = targetId !== undefined ? targetId : target === null ? null : this.mustResolveByName(target);
    this.callSync('entity-relate', [id, n(resolved), userId]);
  }

  revoke(_id: number, _userId: UserId): void {
    throw new Error(
      'KaappiEntityDriver.revoke: not implemented — Kaappi\'s entity-revoke! has stricter, ' +
        'different semantics (a revoked-bucket id, refuses live children/incoming links) than ' +
        "the SQL system's plain relation_id-to-NULL revoke; reconciling the two is real, undone work."
    );
  }

  children(parentId: number): EntityNode[] {
    const ids = this.callSync('entity-children', [parentId]) as number[];
    return ids.map((id) => ({ id, name: this.mustGetName(id), parent_id: parentId, relation_id: null }));
  }

  hasTag(id: number, tagName: string): boolean {
    return this.callSync('entity-has-tag', [id, tagName]) as boolean;
  }

  setAttr(id: number, attrType: string, value: string, userId: UserId): void {
    this.callSync('entity-set-attr', [id, attrType, value, userId]);
  }

  getAttr(id: number, attrType: string): string | undefined {
    const value = this.callSync('entity-get-attr', [id, attrType]) as string | null;
    return value ?? undefined;
  }

  // ---- Stage C categories ----

  resolveAncestor(startId: number, stopAt: (name: string) => boolean): EntityNode | undefined {
    return this.ancestorChain(startId).find((node) => stopAt(node.name));
  }

  ancestorChain(id: number): EntityNode[] {
    // Nearest-first INCLUDING the entity itself, matching SqlEntityDriver's
    // convention — not independently re-verified against entities.sld's own
    // entity-ancestor-chain ordering in this pass; worth a direct check
    // before Stage C relies on this for a real call site.
    const ids = this.callSync('entity-ancestor-chain', [id]) as number[];
    return ids.map((entId, i) => ({
      id: entId,
      name: this.mustGetName(entId),
      parent_id: i + 1 < ids.length ? ids[i + 1] : null,
      relation_id: null,
    }));
  }

  descendantsWithDepth(rootId: number | null): (EntityNode & { depth: number })[] {
    if (rootId == null) {
      throw new Error('KaappiEntityDriver.descendantsWithDepth: whole-tree walk (rootId=null) is not supported — Kaappi has no global "root" to start from.');
    }
    // Includes the root itself at depth 0 — confirmed, not assumed, to match
    // SqlEntityDriver's own CTE (`SELECT id, 0 FROM current_entities WHERE id
    // = ?` as the walk's base case), once db-journal.ts's resolveStagedAccountId
    // became the first real call site relying on that exact parity (its own
    // biz_coa CTE includes the Chart-of-Accounts root the same way). This
    // driver's own earlier version left the root out — previously just a
    // flagged, unverified assumption with nothing depending on it either way.
    const result: (EntityNode & { depth: number })[] = [{ id: rootId, name: this.mustGetName(rootId), parent_id: null, relation_id: null, depth: 0 }];
    const seen = new Set<number>([rootId]);
    let frontier = [rootId];
    let depth = 0;
    while (frontier.length > 0) {
      const nextFrontier: number[] = [];
      for (const parentId of frontier) {
        for (const child of this.children(parentId)) {
          if (seen.has(child.id)) continue;
          seen.add(child.id);
          result.push({ ...child, depth: depth + 1 });
          nextFrontier.push(child.id);
        }
      }
      frontier = nextFrontier;
      depth += 1;
    }
    return result;
  }

  getMany(ids: number[]): EntityNode[] {
    if (ids.length === 0) return [];
    // entity-get-many silently drops ids that don't currently exist — same
    // semantics as SqlEntityDriver.getMany's own `WHERE id IN (...)`.
    return this.callSync('entity-get-many', [ids]) as EntityNode[];
  }

  findAll(filter: { relationId?: number | null; nameSuffix?: string; underTagNamed?: string }): EntityNode[] {
    // Each filter field is sent as its own (hasX, x) pair — see
    // protocol.md's note on why a bare JSON null can't carry "this filter
    // is absent" vs. "this filter is present with value null" on its own.
    const hasRelationId = filter.relationId !== undefined;
    const hasNameSuffix = filter.nameSuffix !== undefined;
    const hasUnderTagNamed = filter.underTagNamed !== undefined;
    return this.callSync('entity-find-all', [
      hasRelationId,
      hasRelationId ? n(filter.relationId!) : null,
      hasNameSuffix,
      hasNameSuffix ? filter.nameSuffix! : null,
      hasUnderTagNamed,
      hasUnderTagNamed ? filter.underTagNamed! : null,
    ]) as EntityNode[];
  }

  findByNameContaining(fragment: string, parentId?: number): EntityNode[] {
    const hasParentId = parentId !== undefined;
    return this.callSync('entity-find-by-name-containing', [fragment, hasParentId, hasParentId ? parentId! : null]) as EntityNode[];
  }

  // ---- helpers ----

  private mustResolveByName(name: string): number {
    const id = this.callSync('entity-get-by-name', [name]) as number | null;
    if (id == null) throw new Error(`No entity named "${name}".`);
    return id;
  }

  private mustGetName(id: number): string {
    const name = this.callSync('entity-get-name', [id]) as string | null;
    if (name == null) throw new Error(`entity ${id} vanished mid-call (no name found).`);
    return name;
  }
}
