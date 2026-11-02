// migrate-entities-to-kaappi.ts — one-time bootstrap: replays the real
// `entities` table's full history into a fresh Kaappi write-ahead log
// (entities.wal.jsonl), so an entity-server started against that WAL has
// the exact same entity tree the SQLite-backed system has today.
//
// Part of Phase 1 of /root/.claude/plans/stateful-snacking-adleman.md
// ("Route all entity storage through a Kaappi (Scheme) process"). Per that
// plan, this is run ONCE, BY HAND, against a COPY of a dev database — it
// is explicitly NOT wired into `make reset-db`, and this script refuses to
// run against the live default db path (backend/data/entities.sqlite)
// without an explicit, deliberate override, below.
//
// This also keeps faith with this whole engagement's standing rule for
// developing the Kaappi/Scheme side of things ("never query/connect to/
// dump data from the real, live SQLite database as part of developing the
// Scheme experiment — all reference data must come from reading SQL
// source files directly"): every op this script emits, and the exact
// shape of `entities`/`current_entities`/`entity_revoke`, was worked out
// by reading backend/schema/00-core.sql directly, not by poking a live
// db. This script itself is mainline integration code (it ships in
// backend/scripts/, not kaappi-experiment/), and it only ever opens a
// database the operator has explicitly pointed it at, read-only, below.
//
// Scope, per the plan: entity_id, name, parent_id, relation_id, created_by
// only. `combination_ids` and `detail_json` are the two approved JSON
// exceptions and stay SQL-only (setDetailJson/mergeDetailJson/
// setCombinationIds are explicitly out of scope for the whole Kaappi
// integration) — this script does not read or migrate either column.
//
// Algorithm: every row in `entities` (not just current_entities — the
// FULL history) is one version of some entity_id, in insertion order via
// row_id. Replaying strictly in row_id order, globally across every
// entity_id (not grouped entity-by-entity), is what guarantees every
// parent_id/relation_id a row references is already a known entity by the
// time that row is replayed: the real system itself could only ever have
// inserted a row referencing a parent/relation that already existed, so
// row_id order already IS a valid dependency order. (Grouping by entity_id
// instead was considered and rejected — it breaks the moment an entity is
// later reparented under an entity created AFTER it, which does happen in
// this schema, e.g. chart-of-accounts restructuring.)
//
// For each entity_id's first row encountered: emit a `create` op (using
// entity-create-raw!'s exact ext-id, not a fresh allocation — see
// server.scm's apply-wal-op!). For each later row of the same entity_id:
// diff it against the LAST row seen for that entity_id and emit one op
// per changed field (rename/reparent/relate) — a real supersedeEntity
// call can change more than one field in a single row (e.g. name AND
// relation together), which this script represents as multiple WAL lines
// for that one source row; order among the three doesn't matter, since
// entity-rename!/entity-reparent!/entity-relate! each touch exactly one
// field and have no other side effects (confirmed by reading
// entity-model/entities.sld directly).
//
// A note on `entity_revoke`: reading 00-core.sql's entity_revoke_insert
// trigger directly (not the entity-model's own entity-revoke!, which has
// different, stricter semantics — reparenting into a "revoked bucket" and
// refusing if the entity still has children/incoming links) shows the
// REAL system's revoke is just an ordinary new row with relation_id set to
// NULL and everything else unchanged. That's structurally identical to
// any other relation_id change, so this script does not special-case it
// at all — it falls out of the same name/parent/relation diff as
// everything else, emitting a plain `relate ... null` line. Using the
// entity-model's own, stricter entity-revoke! here would be wrong (it
// does more than the real system's revoke ever did) and isn't attempted.
//
// Output format: one Scheme-readable s-expression per line, exactly what
// wal.sld's `wal-replay!` reads back with plain `read`. The file is named
// "entities.wal.jsonl" only because that's the name entity-client.ts
// already defaults to and protocol.md already established — the ".jsonl"
// in that name is a pre-existing minor misnomer (the per-mutation ops on
// the wire ARE JSON; the ops THIS file stores are Scheme literals, per
// wal.sld's own design), flagged here rather than silently relied on.
//
// Usage:
//   tsx backend/scripts/migrate-entities-to-kaappi.ts <path-to-db-copy> [output-wal-path]
//
//   tsx backend/scripts/migrate-entities-to-kaappi.ts /tmp/entities-copy.sqlite
//   tsx backend/scripts/migrate-entities-to-kaappi.ts /tmp/entities-copy.sqlite backend/data/entities.wal.jsonl

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface EntityRow {
  row_id: number;
  entity_id: number;
  name: string;
  parent_id: number | null;
  relation_id: number | null;
  created_by: number;
}

function schemeString(s: string): string {
  // Scheme string-literal escaping: backslash and double-quote only need
  // escaping for the names actually seen in this schema (plain UI label
  // text) — newline/control characters are not expected in an entity
  // name, so handling only these two keeps this readable without
  // speculatively covering cases the real data has never shown.
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function schemeExtId(id: number | null): string {
  return id === null ? 'null' : String(id);
}

function main(): void {
  const [, , dbPathArg, outPathArg] = process.argv;
  if (!dbPathArg) {
    console.error('usage: tsx migrate-entities-to-kaappi.ts <path-to-db-copy> [output-wal-path]');
    process.exit(1);
  }
  const dbPath = path.resolve(dbPathArg);

  const liveDefaultPath = path.resolve(__dirname, '..', 'data', 'entities.sqlite');
  if (dbPath === liveDefaultPath && !process.env.MIGRATE_ALLOW_LIVE_DB) {
    console.error(
      `refusing to run against the live default database path (${liveDefaultPath}).\n` +
        `This script is for a COPY of a dev database only (see this file's own header\n` +
        `comment and the approved plan). Copy the file first, e.g.:\n` +
        `  cp ${liveDefaultPath} /tmp/entities-copy.sqlite\n` +
        `  tsx backend/scripts/migrate-entities-to-kaappi.ts /tmp/entities-copy.sqlite\n` +
        `(Set MIGRATE_ALLOW_LIVE_DB=1 only if you have deliberately decided to run this\n` +
        `against the live file directly — this script still only reads it.)`
    );
    process.exit(1);
  }
  if (!fs.existsSync(dbPath)) {
    console.error(`no database file at ${dbPath}`);
    process.exit(1);
  }

  const outPath = outPathArg ? path.resolve(outPathArg) : path.resolve(__dirname, '..', 'data', 'entities.wal.jsonl');
  if (fs.existsSync(outPath) && !process.env.MIGRATE_ALLOW_OVERWRITE) {
    console.error(`refusing to overwrite an existing WAL file at ${outPath} (set MIGRATE_ALLOW_OVERWRITE=1 to replace it).`);
    process.exit(1);
  }

  // readonly + fileMustExist: this script must not be able to write to
  // the source database even by accident, and must not silently create a
  // fresh empty one if the path is wrong.
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  const rows = db
    .prepare(`SELECT row_id, entity_id, name, parent_id, relation_id, created_by FROM entities ORDER BY row_id`)
    .all() as EntityRow[];
  db.close();

  if (rows.length === 0) {
    console.error(`no rows found in entities table at ${dbPath} — nothing to migrate.`);
    process.exit(1);
  }

  const lines: string[] = [];
  const lastSeen = new Map<number, { name: string; parent_id: number | null; relation_id: number | null }>();
  let createCount = 0;
  let renameCount = 0;
  let reparentCount = 0;
  let relateCount = 0;

  for (const row of rows) {
    const prev = lastSeen.get(row.entity_id);
    if (!prev) {
      lines.push(`(create ${row.entity_id} ${schemeString(row.name)} ${schemeExtId(row.parent_id)} ${schemeExtId(row.relation_id)} ${row.created_by})`);
      createCount++;
    } else {
      if (row.name !== prev.name) {
        lines.push(`(rename ${row.entity_id} ${schemeString(row.name)} ${row.created_by})`);
        renameCount++;
      }
      if (row.parent_id !== prev.parent_id) {
        lines.push(`(reparent ${row.entity_id} ${schemeExtId(row.parent_id)} ${row.created_by})`);
        reparentCount++;
      }
      if (row.relation_id !== prev.relation_id) {
        lines.push(`(relate ${row.entity_id} ${schemeExtId(row.relation_id)} ${row.created_by})`);
        relateCount++;
      }
    }
    lastSeen.set(row.entity_id, { name: row.name, parent_id: row.parent_id, relation_id: row.relation_id });
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n') + '\n');

  console.log(`read ${rows.length} rows covering ${lastSeen.size} entities from ${dbPath}`);
  console.log(`wrote ${lines.length} ops to ${outPath}: ${createCount} create, ${renameCount} rename, ${reparentCount} reparent, ${relateCount} relate`);
  console.log(`next: point an entity-server at this WAL (KAAPPI_WAL_PATH=${outPath}) and confirm it replays cleanly.`);
}

main();
