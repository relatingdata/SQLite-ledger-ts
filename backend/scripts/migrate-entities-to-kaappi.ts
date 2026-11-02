// migrate-entities-to-kaappi.ts — one-time bootstrap: replays the real
// `entities` table's full history into the SAME database's `kaappi_wal`
// table, as a JSON array of ops, so a Kaappi entity-server started against
// that database (ENTITY_DRIVER=kaappi) replays into the exact same entity
// tree the SQLite-backed system has today.
//
// Originally part of Phase 1 of
// /root/.claude/plans/stateful-snacking-adleman.md ("Route all entity
// storage through a Kaappi (Scheme) process"); this file's job changed in
// that plan's Stage B ("move the Kaappi WAL into SQLite") from writing a
// flat Scheme-literal WAL file to writing JSON ops straight into
// `kaappi_wal.ops_json` in the database it reads `entities` from — source
// and destination are now the SAME file, since that's where the WAL lives
// now. Still run ONCE, BY HAND, against a COPY of a dev database — still
// NOT wired into `make reset-db`, and still refuses to run against the
// live default db path (backend/data/entities.sqlite) without an explicit,
// deliberate override, below. The operator decides separately whether (and
// when) to promote that copy into the live path.
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
// database the operator has explicitly pointed it at, reading `entities`
// and writing only to `kaappi_wal` — never touching any other table.
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
// relation together), which this script represents as multiple WAL
// entries for that one source row; order among the three doesn't matter,
// since entity-rename!/entity-reparent!/entity-relate! each touch exactly
// one field and have no other side effects (confirmed by reading
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
// everything else, emitting a plain `relate ... null` op.
//
// Op format: each op is a JSON array `[opName, ...positionalArgs]`,
// exactly what kaappi-worker.ts's own MUTATORS table builds for a live
// call and what server.scm's json-args->op converts back for apply-wal-op!
// — see protocol.md's replay-op row. The whole op log is one JSON array
// of these, stored in kaappi_wal's single row.
//
// Usage:
//   tsx backend/scripts/migrate-entities-to-kaappi.ts <path-to-db-copy>
//
//   cp backend/data/entities.sqlite /tmp/entities-copy.sqlite
//   tsx backend/scripts/migrate-entities-to-kaappi.ts /tmp/entities-copy.sqlite

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

type JsonValue = string | number | boolean | null;
type JsonOp = JsonValue[];

function main(): void {
  const [, , dbPathArg] = process.argv;
  if (!dbPathArg) {
    console.error('usage: tsx migrate-entities-to-kaappi.ts <path-to-db-copy>');
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
        `against the live file directly — this script still only reads 'entities' and\n` +
        `writes 'kaappi_wal', nothing else.)`
    );
    process.exit(1);
  }
  if (!fs.existsSync(dbPath)) {
    console.error(`no database file at ${dbPath}`);
    process.exit(1);
  }

  // Not readonly: this script's whole job, now that the WAL lives in
  // SQLite, is to read `entities` from this file and write the resulting
  // op log into this SAME file's `kaappi_wal` table (see this file's
  // header for why source and destination are the same file now).
  const db = new Database(dbPath, { fileMustExist: true });

  const existingWal = db.prepare(`SELECT ops_json FROM kaappi_wal WHERE id = 1`).get() as { ops_json: string } | undefined;
  if (existingWal && existingWal.ops_json !== '[]' && !process.env.MIGRATE_ALLOW_OVERWRITE) {
    console.error(`refusing to overwrite a non-empty kaappi_wal (${JSON.parse(existingWal.ops_json).length} ops already stored) in ${dbPath} (set MIGRATE_ALLOW_OVERWRITE=1 to replace it).`);
    db.close();
    process.exit(1);
  }

  const rows = db
    .prepare(`SELECT row_id, entity_id, name, parent_id, relation_id, created_by FROM entities ORDER BY row_id`)
    .all() as EntityRow[];

  if (rows.length === 0) {
    console.error(`no rows found in entities table at ${dbPath} — nothing to migrate.`);
    db.close();
    process.exit(1);
  }

  const ops: JsonOp[] = [];
  const lastSeen = new Map<number, { name: string; parent_id: number | null; relation_id: number | null }>();
  let createCount = 0;
  let renameCount = 0;
  let reparentCount = 0;
  let relateCount = 0;

  for (const row of rows) {
    const prev = lastSeen.get(row.entity_id);
    if (!prev) {
      ops.push(['create', row.entity_id, row.name, row.parent_id, row.relation_id, row.created_by]);
      createCount++;
    } else {
      if (row.name !== prev.name) {
        ops.push(['rename', row.entity_id, row.name, row.created_by]);
        renameCount++;
      }
      if (row.parent_id !== prev.parent_id) {
        ops.push(['reparent', row.entity_id, row.parent_id, row.created_by]);
        reparentCount++;
      }
      if (row.relation_id !== prev.relation_id) {
        ops.push(['relate', row.entity_id, row.relation_id, row.created_by]);
        relateCount++;
      }
    }
    lastSeen.set(row.entity_id, { name: row.name, parent_id: row.parent_id, relation_id: row.relation_id });
  }

  db.prepare(`UPDATE kaappi_wal SET ops_json = ? WHERE id = 1`).run(JSON.stringify(ops));
  db.close();

  console.log(`read ${rows.length} rows covering ${lastSeen.size} entities from ${dbPath}`);
  console.log(`wrote ${ops.length} ops to kaappi_wal in ${dbPath}: ${createCount} create, ${renameCount} rename, ${reparentCount} reparent, ${relateCount} relate`);
  console.log(`next: start a Kaappi entity-server against this same database (ENTITY_DRIVER=kaappi, DB_PATH=${dbPath}) and confirm it replays cleanly.`);
}

main();
