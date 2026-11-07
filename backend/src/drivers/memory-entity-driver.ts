// memory-entity-driver.ts — EntityDriver backed by a plain, in-process
// TypeScript box/version model (no SQL table, no subprocess, no IPC of
// any kind) — the "genuinely separate engine" option raised directly
// against KaappiEntityDriver and SqlEntityDriver: same architectural
// family as the Scheme/Kaappi experiment (an append-only box/version
// model, a materialized children list, a name hash index — see
// kaappi-experiment/entity-model/entities.sld, whose design this
// deliberately mirrors field-for-field), but hosted directly in the
// backend's own process and own language, so every call pays zero IPC
// cost (no worker thread, no SharedArrayBuffer, no Atomics.wait, no
// JSON-over-pipe) and zero interpreter overhead (V8's own JIT, not an
// interpreted Scheme VM) — the two axes this whole investigation kept
// separating. See bench-entity-drivers.ts's header and
// /root/.claude/plans/stateful-snacking-adleman.md for the measured
// comparison against the other two.
//
// Durability: reuses the SAME `kaappi_wal` table KaappiEntityDriver
// already owns (already a committed, approved part of
// backend/schema/00-core.sql — no new table or column, per this
// engagement's standing "zero new SQL tables/columns without explicit
// permission" rule) and the SAME op-tuple format
// (`[opName, ...positionalArgs]`, one JSON array in one row) kaappi-
// worker.ts already writes. This is a deliberate choice, not an
// accident: the op format is plain, engine-agnostic data (create/
// rename/reparent/relate, each just ext-ids/names/user-ids), so a
// database bootstrapped once via migrate-entities-to-kaappi.ts can be
// read by EITHER this driver or KaappiEntityDriver interchangeably —
// itself a real, concrete proof that the EntityDriver abstraction's
// stated purpose (one storage boundary, swappable backends) actually
// holds across genuinely different engines, not just in principle.
// This driver interprets exactly the 4 op kinds the real migration data
// and this driver's own writes ever produce (create/rename/reparent/
// relate) — revoke/tag/untag/set-attr/clear-attr/link-*/detail-* are
// Kaappi-native primitives with no equivalent here (hasTag/setAttr/
// getAttr are composed from create/getUnder/rename instead, exactly the
// way SqlEntityDriver already does it, so they only ever produce
// ordinary create/rename ops) — encountering any of those other op
// kinds during replay is a loud, thrown error, never a silent skip.
//
// Runs entirely on the main thread via db.ts's own `db` connection
// (synchronous, like SqlEntityDriver) — no separate connection needed,
// unlike kaappi-worker.ts, which needs its own cross-thread connection
// because it lives on a different thread. This driver doesn't.
//
// Known, disclosed gaps/differences vs. the other two drivers:
//  - `revoke` throws, same disclosed-gap precedent as
//    KaappiEntityDriver.revoke — but for a different reason. SQL's own
//    `revokeEntity` (db.ts) isn't a pure storage primitive at all; it's a
//    business-rule wrapper (no-live-children guard, no-journal-postings
//    guard, no-incoming-links guard, ledger-specific actual/budget rules)
//    layered on top of a plain supersede. Reimplementing all of that
//    independently here would duplicate real business logic outside its
//    one owning module, with a real drift risk — left as honest, visible
//    unfinished work, same as Kaappi's.
//  - Every read returns a FULL {id, name, parent_id, relation_id} record
//    always — unlike KaappiEntityDriver, which returns bare ext-ids/
//    scalars for most wire methods (its own disclosed gap). Since this
//    engine already holds the whole record in memory, there's no cost to
//    returning it in full every time.
//  - `findByNameContaining`'s substring match is ASCII case-insensitive
//    (`toLowerCase().includes(...)`), approximating but not exactly
//    reproducing SQLite's own `LIKE '%...%'` case-folding rules (which
//    are themselves ASCII-only by default) — not expected to differ in
//    practice for this project's real data, but not byte-for-byte
//    verified against SQLite's collation either.
//  - Every write does a full read-modify-write of the ENTIRE `ops_json`
//    blob (JSON.parse the whole array, push, JSON.stringify, UPDATE) —
//    the same explicit, accepted O(log size) trade-off as
//    KaappiEntityDriver's own WAL-in-SQLite design (see the plan's
//    "2. The WAL-in-SQLite redesign"), not a new cost unique to this
//    driver.
import { db, type UserId } from '../db.js';
import type { EntityDriver, EntityNode } from '../entity-driver.js';

type JsonValue = string | number | boolean | null;
type JsonOp = [string, ...JsonValue[]];

interface Version {
  name: string;
  parentId: number | null;
  relationId: number | null;
  createdAt: number;
  createdBy: UserId;
}

interface Box {
  extId: number;
  current: Version;
  historical: Version[];
  children: Box[]; // materialized, current children only — mirrors entities.sld's own `children` field
}

export class MemoryEntityDriver implements EntityDriver {
  private byExtId = new Map<number, Box>();
  // name -> boxes currently holding that name, most-recently-assigned-this-
  // name first — same convention, same documented tie-break ambiguity, as
  // entities.sld's *by-name-index*.
  private byName = new Map<string, Box[]>();
  private nextExtId = 1;

  constructor() {
    this.ensureWalTable();
    for (const op of this.readWalOps()) {
      this.applyReplayOp(op);
    }
    // Real, found-this-session bug fixed here: register()'s incremental
    // children-list linking (push the new box onto its parent's children
    // array at creation time) silently drops the link when the parent
    // box doesn't exist YET — and the real production data genuinely
    // contains such forward references (confirmed directly: entities 249/
    // 250, "Warehouse"/"Retail", are created with parent_id=831 at
    // row_id 249/250, while entity 831 itself, "Location Types", doesn't
    // get its own create op until row_id 831 — a later point in the very
    // same, strictly row_id-ordered replay). `get(id)`/`current.parentId`
    // are still correct either way (those never depended on the
    // children-list link), but `children(parentId)` and everything built
    // on it (descendantsWithDepth, findByNameContaining with a parentId
    // filter) would silently, permanently miss these entities. A full
    // rebuild of every children list, once, right after replay finishes
    // (rather than relying on incremental linking to always land in the
    // right order) is simple and correct regardless of what order the
    // real data's create ops happen to appear in. Live operations
    // (create/reparent) don't need this: the public API only ever lets a
    // caller resolve a parent that already, demonstrably exists, so
    // register()'s incremental linking is sound there — this gap is
    // specific to replaying historical data whose row order predates this
    // driver's own ordering assumption.
    for (const box of this.byExtId.values()) box.children = [];
    for (const box of this.byExtId.values()) {
      if (box.current.parentId != null) {
        const parent = this.byExtId.get(box.current.parentId);
        if (parent) parent.children.push(box);
      }
    }
  }

  // ---- WAL persistence (shared substrate with KaappiEntityDriver) ----

  private ensureWalTable(): void {
    db.exec(`CREATE TABLE IF NOT EXISTS kaappi_wal (id INTEGER PRIMARY KEY CHECK (id = 1), ops_json TEXT NOT NULL DEFAULT '[]')`);
    db.exec(`INSERT OR IGNORE INTO kaappi_wal (id, ops_json) VALUES (1, '[]')`);
  }

  private readWalOps(): JsonOp[] {
    const row = db.prepare('SELECT ops_json FROM kaappi_wal WHERE id = 1').get() as { ops_json: string } | undefined;
    if (!row) throw new Error('MemoryEntityDriver: kaappi_wal has no row with id = 1 after ensureWalTable — should be unreachable.');
    return JSON.parse(row.ops_json) as JsonOp[];
  }

  private appendWalOp(op: JsonOp): void {
    const ops = this.readWalOps();
    ops.push(op);
    db.prepare('UPDATE kaappi_wal SET ops_json = ? WHERE id = 1').run(JSON.stringify(ops));
  }

  private applyReplayOp(op: JsonOp): void {
    const [kind, ...args] = op;
    switch (kind) {
      case 'create': {
        const [extId, name, parentId, relationId, userId] = args as [number, string, number | null, number | null, number];
        this.createInternal(name, parentId, relationId, userId as UserId, extId);
        return;
      }
      case 'rename': {
        const [extId, name, userId] = args as [number, string, number];
        this.renameInternal(this.mustGetBox(extId), name, userId as UserId);
        return;
      }
      case 'reparent': {
        const [extId, newParentId, userId] = args as [number, number, number];
        this.reparentInternal(this.mustGetBox(extId), newParentId, userId as UserId);
        return;
      }
      case 'relate': {
        const [extId, relationId, userId] = args as [number, number | null, number];
        this.relateInternal(this.mustGetBox(extId), relationId, userId as UserId);
        return;
      }
      default:
        throw new Error(
          `MemoryEntityDriver: cannot replay op kind "${kind}" — only create/rename/reparent/relate are supported by this engine ` +
            `(see this file's header for why revoke/tag/set-attr/etc. are out of scope).`
        );
    }
  }

  // ---- internal mutation core (no WAL append — used by both live calls and replay) ----

  private register(box: Box): void {
    this.byExtId.set(box.extId, box);
    this.indexByName(box, box.current.name);
    if (box.current.parentId != null) {
      const parent = this.byExtId.get(box.current.parentId);
      if (parent) parent.children.push(box);
    }
  }

  private indexByName(box: Box, name: string): void {
    this.byName.set(name, [box, ...(this.byName.get(name) ?? [])]);
  }

  private deindexByName(box: Box, name: string): void {
    const bucket = this.byName.get(name);
    if (bucket) this.byName.set(name, bucket.filter((b) => b !== box));
  }

  private rootBoxes(): Box[] {
    // Degenerate case, same as entities.sld's own entity-children fallback:
    // there's no materialized list to hold "every box with no parent" (it
    // isn't any one box's own children field), so this is a real, honest
    // full scan — fine in practice since there's normally exactly one real
    // root.
    return [...this.byExtId.values()].filter((b) => b.current.parentId === null);
  }

  private createInternal(name: string, parentId: number | null, relationId: number | null, userId: UserId, forcedExtId?: number): Box {
    const siblings = parentId != null ? (this.byExtId.get(parentId)?.children ?? []) : this.rootBoxes();
    if (siblings.some((b) => b.current.name === name)) {
      throw new Error(`"${name}" already exists under this real, same parent.`);
    }
    const extId = forcedExtId ?? this.nextExtId;
    if (forcedExtId !== undefined) this.nextExtId = Math.max(this.nextExtId, forcedExtId + 1);
    else this.nextExtId += 1;
    const box: Box = {
      extId,
      current: { name, parentId, relationId, createdAt: Date.now(), createdBy: userId },
      historical: [],
      children: [],
    };
    this.register(box);
    return box;
  }

  private supersede(box: Box, patch: Partial<Pick<Version, 'name' | 'parentId' | 'relationId'>>, userId: UserId): void {
    box.historical.push(box.current);
    box.current = { ...box.current, ...patch, createdAt: Date.now(), createdBy: userId };
  }

  private renameInternal(box: Box, newName: string, userId: UserId): void {
    const oldName = box.current.name;
    this.supersede(box, { name: newName }, userId);
    this.deindexByName(box, oldName);
    this.indexByName(box, newName);
  }

  private reparentInternal(box: Box, newParentId: number, userId: UserId): void {
    const oldParentId = box.current.parentId;
    this.supersede(box, { parentId: newParentId }, userId);
    if (oldParentId != null) {
      const oldParent = this.byExtId.get(oldParentId);
      if (oldParent) oldParent.children = oldParent.children.filter((c) => c !== box);
    }
    const newParent = this.byExtId.get(newParentId);
    if (newParent) newParent.children.push(box);
  }

  private relateInternal(box: Box, relationId: number | null, userId: UserId): void {
    this.supersede(box, { relationId }, userId);
  }

  private mustGetBox(id: number): Box {
    const box = this.byExtId.get(id);
    if (!box) throw new Error(`Entity ${id} not found.`);
    return box;
  }

  private mustResolveByName(name: string): number {
    const node = this.getByName(name);
    if (!node) throw new Error(`No entity named "${name}".`);
    return node.id;
  }

  private toNode(box: Box): EntityNode {
    return { id: box.extId, name: box.current.name, parent_id: box.current.parentId, relation_id: box.current.relationId };
  }

  // ---- existing shape ----

  create(name: string, parent: string | number, userId: UserId): EntityNode {
    const parentId = typeof parent === 'number' ? parent : this.mustResolveByName(parent);
    const box = this.createInternal(name, parentId, null, userId);
    this.appendWalOp(['create', box.extId, name, parentId, null, userId]);
    return this.toNode(box);
  }

  get(idOrName: number | string, parent?: string): EntityNode | undefined {
    if (typeof idOrName === 'number') {
      const box = this.byExtId.get(idOrName);
      return box ? this.toNode(box) : undefined;
    }
    return this.getByName(idOrName, parent);
  }

  getByName(name: string, parent?: string): EntityNode | undefined {
    if (parent === undefined) {
      const bucket = this.byName.get(name);
      return bucket && bucket.length > 0 ? this.toNode(bucket[0]) : undefined;
    }
    const parentNode = this.getByName(parent);
    if (!parentNode) return undefined;
    return this.getUnder(name, parentNode.id);
  }

  getUnder(name: string, parentId: number): EntityNode | undefined {
    const parentBox = this.byExtId.get(parentId);
    if (!parentBox) return undefined;
    const match = parentBox.children.find((c) => c.current.name === name);
    return match ? this.toNode(match) : undefined;
  }

  rename(id: number, name: string, userId: UserId): void {
    const box = this.mustGetBox(id);
    this.renameInternal(box, name, userId);
    this.appendWalOp(['rename', id, name, userId]);
  }

  reparent(id: number, parent: string, userId: UserId): void {
    const box = this.mustGetBox(id);
    const newParentId = this.mustResolveByName(parent);
    if (newParentId === id) throw new Error('An entity cannot be its own parent.');
    this.reparentInternal(box, newParentId, userId);
    this.appendWalOp(['reparent', id, newParentId, userId]);
  }

  relate(id: number, target: string | null, userId: UserId, targetId?: number): void {
    const box = this.mustGetBox(id);
    const resolved = targetId !== undefined ? targetId : target === null ? null : this.mustResolveByName(target);
    this.relateInternal(box, resolved, userId);
    this.appendWalOp(['relate', id, resolved, userId]);
  }

  revoke(_id: number, _userId: UserId): void {
    throw new Error(
      'MemoryEntityDriver.revoke: not implemented — db.ts\'s revokeEntity is a business-rule wrapper (live-children/' +
        'journal-postings/incoming-links/ledger-actual-budget guards), not a pure storage primitive; reimplementing all of ' +
        'that independently here would duplicate real business logic with a real drift risk, same disclosed-gap reasoning ' +
        "as KaappiEntityDriver.revoke (for a different underlying reason)."
    );
  }

  children(parentId: number): EntityNode[] {
    const box = this.byExtId.get(parentId);
    return box ? box.children.map((c) => this.toNode(c)) : [];
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
    // Unlike KaappiEntityDriver (which throws on rootId=null — Kaappi has
    // no global root concept wired up), this engine can support the
    // whole-tree walk directly: every box is already in memory, so
    // "every box with no parent" is a real, cheap thing to compute (see
    // rootBoxes' own comment on why it's a scan, not an index lookup).
    const roots: Box[] = rootId == null ? this.rootBoxes() : [this.mustGetBox(rootId)];
    const result: (EntityNode & { depth: number })[] = [];
    let frontier: { box: Box; depth: number }[] = roots.map((box) => ({ box, depth: 0 }));
    for (const { box, depth } of frontier) result.push({ ...this.toNode(box), depth });
    while (frontier.length > 0) {
      const next: { box: Box; depth: number }[] = [];
      for (const { box, depth } of frontier) {
        for (const child of box.children) {
          result.push({ ...this.toNode(child), depth: depth + 1 });
          next.push({ box: child, depth: depth + 1 });
        }
      }
      frontier = next;
    }
    return result;
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
    const out: EntityNode[] = [];
    for (const id of ids) {
      const box = this.byExtId.get(id);
      if (box) out.push(this.toNode(box));
    }
    return out;
  }

  findAll(filter: { relationId?: number | null; nameSuffix?: string; underTagNamed?: string }): EntityNode[] {
    let underTagId: number | undefined;
    if (filter.underTagNamed !== undefined) {
      underTagId = this.getByName(filter.underTagNamed)?.id;
    }
    const out: EntityNode[] = [];
    for (const box of this.byExtId.values()) {
      if (filter.relationId !== undefined && box.current.relationId !== filter.relationId) continue;
      if (filter.nameSuffix !== undefined && !box.current.name.endsWith(filter.nameSuffix)) continue;
      if (filter.underTagNamed !== undefined && (underTagId === undefined || box.current.parentId !== underTagId)) continue;
      out.push(this.toNode(box));
    }
    return out;
  }

  findByNameContaining(fragment: string, parentId?: number): EntityNode[] {
    const needle = fragment.toLowerCase();
    const out: EntityNode[] = [];
    for (const box of this.byExtId.values()) {
      if (parentId !== undefined && box.current.parentId !== parentId) continue;
      if (box.current.name.toLowerCase().includes(needle)) out.push(this.toNode(box));
    }
    return out;
  }
}
