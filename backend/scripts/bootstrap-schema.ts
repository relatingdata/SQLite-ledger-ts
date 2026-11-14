// bootstrap-schema.ts — run once, right after `make reset-db` deletes
// backend/data/entities.sqlite, to force db.ts's own one-time schema +
// seed logic (00-core.sql, 30-coa-links.sql, db-seed.ts's
// seedRemainingData) to run against the fresh file BEFORE anything else
// ever touches it.
//
// This matters now specifically because of storage_engine: it applies
// its own small schema (`CREATE TABLE IF NOT EXISTS entities ...`,
// covering only the 4 tables it owns) the moment IT starts, completely
// independently of db.ts. If storage_engine's own process were the
// first thing to touch a freshly-reset file, db.ts would later see an
// `entities` table already present and wrongly conclude the whole,
// real schema (every OTHER table — business, translation, roles,
// users, sessions, the chart of accounts links, ...) is already set up
// too, and skip initializing it entirely — a silently half-initialized
// database. Forcing db.ts to run first, right here, as its own
// deliberate step in `reset-db`, makes that ordering a guarantee rather
// than an accident of which Makefile target happens to start which
// process first.
//
// ENTITY_DRIVER is forced to `sql` here regardless of the app's own
// default (`gleam`) — this script's only job is the real schema/seed
// SQL, which db.ts always runs via plain `db.exec`/`db.prepare`, never
// through an EntityDriver at all; forcing `sql` just avoids this one,
// one-off script needing storage_engine to be running yet (it never
// isn't, at this point — storage_engine starts strictly AFTER this).
process.env.ENTITY_DRIVER = 'sql';

await import('../src/db.js');
console.log('bootstrap-schema: real schema + seed data initialized.');
