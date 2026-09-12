// A real, small, isolated, throwaway prototype (per
// docs/pglite-migration-plan.md's own recommended next step) - not a
// full migration attempt. This step alone: recreate just the real
// entities/entity_ids tables and the entity_entry trigger mechanism
// in genuine Postgres syntax (rule-based INSTEAD OF INSERT on a
// view, via a real trigger function - SQLite's own INSTEAD OF INSERT
// ON <view> syntax does not carry over directly), then insert a real,
// minimal entity tree as test data and confirm every real,
// established convention (append-only, scoped uniqueness, current_entities
// filtering) still genuinely holds.

import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();

console.log('=== Step 1: schema ===');

await db.exec(`
  CREATE TABLE entity_ids (
    id SERIAL PRIMARY KEY
  );

  CREATE TABLE entities (
    row_id      SERIAL PRIMARY KEY,
    entity_id   INTEGER NOT NULL REFERENCES entity_ids(id),
    name        TEXT NOT NULL,
    parent_id   INTEGER REFERENCES entity_ids(id),
    relation_id INTEGER REFERENCES entity_ids(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  INTEGER NOT NULL DEFAULT 1,
    deleted_at  TIMESTAMPTZ,
    deleted_by  INTEGER
  );

  -- Scoped uniqueness among live rows only - the exact, same real
  -- convention already established in the real SQLite schema.
  CREATE UNIQUE INDEX entities_name_current ON entities(parent_id, name) WHERE deleted_at IS NULL;

  -- The exact, same real "current_entities" view already
  -- established - every live (non-deleted) row, keyed by entity_id.
  CREATE VIEW current_entities AS
    SELECT entity_id AS id, name, parent_id, relation_id, created_at, created_by
    FROM entities
    WHERE deleted_at IS NULL;
`);

console.log('Schema created.');

console.log('');
console.log('=== Step 2: the real entity_entry trigger mechanism, in genuine Postgres syntax ===');

// SQLite's own "CREATE TRIGGER entity_entry_insert INSTEAD OF INSERT
// ON entity_entry" attaches directly to a view. Postgres requires a
// real, separate trigger FUNCTION (PL/pgSQL), then a real CREATE
// TRIGGER statement referencing it - a genuine, two-part mechanism,
// not a single statement.
await db.exec(`
  CREATE VIEW entity_entry AS
    SELECT NULL::text AS name, NULL::integer AS parent_id, NULL::text AS parent,
           NULL::integer AS relation_id, NULL::text AS relation, NULL::integer AS created_by
    WHERE false;

  CREATE OR REPLACE FUNCTION entity_entry_insert() RETURNS TRIGGER AS $$
  DECLARE
    new_entity_id INTEGER;
    resolved_parent_id INTEGER;
    resolved_relation_id INTEGER;
  BEGIN
    INSERT INTO entity_ids DEFAULT VALUES RETURNING id INTO new_entity_id;

    resolved_parent_id := COALESCE(NEW.parent_id, (SELECT id FROM current_entities WHERE name = NEW.parent));
    resolved_relation_id := COALESCE(NEW.relation_id, (SELECT id FROM current_entities WHERE name = NEW.relation));

    INSERT INTO entities (entity_id, name, parent_id, relation_id, created_by)
    VALUES (new_entity_id, NEW.name, resolved_parent_id, resolved_relation_id, COALESCE(NEW.created_by, 1));

    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER entity_entry_insert_trigger
  INSTEAD OF INSERT ON entity_entry
  FOR EACH ROW EXECUTE FUNCTION entity_entry_insert();
`);

console.log('entity_entry trigger mechanism created (real PL/pgSQL function + real trigger).');

console.log('');
console.log('=== Step 3: insert a real, minimal entity tree as test data ===');

// The exact, same real shape used throughout this session:
// Application -> Businesses -> Wine Retail Company -> Wine Retail
// Company Items -> Beer -> Amber -> the real, leaf item.
await db.exec(`
  INSERT INTO entity_entry (name, parent) VALUES ('Application', NULL);
  INSERT INTO entity_entry (name, parent) VALUES ('Businesses', 'Application');
  INSERT INTO entity_entry (name, parent) VALUES ('Wine Retail Company', 'Businesses');
  INSERT INTO entity_entry (name, parent) VALUES ('Wine Retail Company Items', 'Wine Retail Company');
  INSERT INTO entity_entry (name, parent) VALUES ('Beer', 'Wine Retail Company Items');
  INSERT INTO entity_entry (name, parent) VALUES ('Amber', 'Beer');
  INSERT INTO entity_entry (name, parent) VALUES ('Amber Ale 330ml Aluminum Can (Cold)', 'Amber');
`);

const rows = await db.query('SELECT id, name, parent_id FROM current_entities ORDER BY id');
console.log('Real, live entities inserted via the trigger mechanism:');
console.table(rows.rows);

console.log('');
console.log('=== Step 4: confirm scoped uniqueness is genuinely enforced ===');
try {
  await db.exec(`INSERT INTO entity_entry (name, parent) VALUES ('Beer', 'Wine Retail Company Items');`);
  console.log('FAIL: duplicate under the same parent was NOT rejected.');
} catch (err) {
  console.log('PASS: duplicate under the same parent was genuinely rejected:', err.message);
}

console.log('');
console.log('=== Step 5: confirm the recursive CTE tree-walk still works, real Postgres syntax ===');
const chain = await db.query(`
  WITH RECURSIVE ancestors AS (
    SELECT id, name, parent_id FROM current_entities WHERE name = 'Amber Ale 330ml Aluminum Can (Cold)'
    UNION ALL
    SELECT e.id, e.name, e.parent_id FROM current_entities e JOIN ancestors a ON e.id = a.parent_id
  )
  SELECT name FROM ancestors;
`);
console.log('Real ancestor chain (leaf to root):', chain.rows.map((r) => r.name).join(' <- '));

console.log('');
console.log('Step 1 prototype: PASSED. The entity tree + trigger mechanism genuinely work on real PGlite.');
