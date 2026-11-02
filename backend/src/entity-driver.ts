// entity-driver.ts — the EntityDriver interface. Part of
// /root/.claude/plans/stateful-snacking-adleman.md ("Isolate entity storage
// behind one driver interface; move the Kaappi WAL into SQLite").
//
// This is the ONE seam every entity operation in the backend is meant to go
// through, so that which concrete storage backs "entities" (SQLite today,
// Kaappi, or — per the user's stated long-term goal — a non-SQL or even
// Prolog backend later) is a decision made in exactly one place
// (entity-driver-select.ts), never scattered across call sites.
//
// Pure types only. Imports nothing from db.ts's implementation or from
// entity-client.ts, by design — a driver file is allowed to depend on this
// file, never the other way around.
//
// A note on fidelity vs. the plan's illustrative sketch: the plan's example
// interface simplified a few signatures for readability (e.g. `create`'s
// parent as `parentId: number | null`). This file instead matches today's
// real, exact signatures of primitives.ts's Entity object for the methods
// in the "existing shape" category below (parent as `string | number`,
// `get` as a number/string overload, etc.) — Stage A's own stated goal is
// "zero behavior change," and primitives.ts's Entity is called synchronously
// today by six other files (db.ts, auth.ts, db-journal.ts, db-quotations.ts,
// db-reports.ts, db-stock.ts), not just the one route being migrated, so
// preserving its exact contract here (rather than the sketch's simplified
// one) is what actually keeps Stage A's behavior unchanged. This is a
// deliberate, disclosed deviation from the plan's illustrative code block,
// not a silent one.
//
// A second, more consequential deviation, resolved by explicit user
// decision during implementation (not assumed): every method below is
// SYNCHRONOUS, including on KaappiEntityDriver. SqlEntityDriver is
// naturally synchronous (better-sqlite3 is sync); Kaappi's entity-server is
// a subprocess reached over async line-delimited JSON IPC, which is NOT
// naturally synchronous. Making this interface async instead would have
// forced every current synchronous caller of primitives.ts's Entity object
// (the six files above) to become async immediately, in Stage A — a much
// larger, un-reviewed scope increase. Instead, KaappiEntityDriver bridges
// the async subprocess IPC to a synchronous call via a worker thread plus
// Atomics.wait (see drivers/kaappi-entity-driver.ts and
// drivers/kaappi-worker.ts) — real, nontrivial plumbing, but entirely
// contained inside that one driver file.
import type { UserId } from './db.js';

export interface EntityNode {
  id: number;
  name: string;
  parent_id: number | null;
  relation_id: number | null;
}

export interface EntityDriver {
  // ---- existing shape — direct ports of today's primitives.ts Entity bodies ----
  create(name: string, parent: string | number, userId: UserId): EntityNode;
  get(idOrName: number | string, parent?: string): EntityNode | undefined;
  getByName(name: string, parent?: string): EntityNode | undefined;
  getUnder(name: string, parentId: number): EntityNode | undefined;
  rename(id: number, name: string, userId: UserId): void;
  reparent(id: number, parent: string, userId: UserId): void;
  relate(id: number, target: string | null, userId: UserId, targetId?: number): void;
  revoke(id: number, userId: UserId): void;
  children(parentId: number): EntityNode[];
  hasTag(id: number, tagName: string): boolean;
  setAttr(id: number, attrType: string, value: string, userId: UserId): void;
  getAttr(id: number, attrType: string): string | undefined;

  // ---- Stage C categories, from this engagement's ~470-call-site survey ----
  // Not called by anyone yet (primitives.ts/routes/i18n.ts don't need them).
  // Declared now so both drivers' shape is settled; SqlEntityDriver
  // implements them for real (they're simple, already-understood SQL,
  // lifted from db.ts), KaappiEntityDriver throws "not implemented" until
  // Stage C's real call sites motivate building the Kaappi side honestly
  // rather than speculatively, per the approved plan.

  // category 1 — throwing name-to-id resolution via an ancestor walk,
  // generalizing db.ts's resolveId (direct-parent only) and resolveItemId
  // (walk-until-predicate). Throwing itself stays a caller concern.
  resolveAncestor(startId: number, stopAt: (name: string) => boolean): EntityNode | undefined;

  // category 2 — pure entity-graph recursion.
  descendantsWithDepth(rootId: number | null): (EntityNode & { depth: number })[];
  ancestorChain(id: number): EntityNode[]; // nearest-first, full breadcrumb

  // category 3 — bulk fetch, replacing `WHERE id IN (...)` call sites.
  getMany(ids: number[]): EntityNode[];

  // category 5 — global/unscoped search. A small closed filter shape, not
  // a query-builder escape hatch.
  findAll(filter: { relationId?: number | null; nameSuffix?: string; underTagNamed?: string }): EntityNode[];

  // category 6 — genuine substring search only.
  findByNameContaining(fragment: string, parentId?: number): EntityNode[];
}
