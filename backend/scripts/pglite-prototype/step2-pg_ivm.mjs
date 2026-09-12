import { PGlite } from '@electric-sql/pglite';
import { pg_ivm } from '@electric-sql/pglite-pg_ivm';

const db = new PGlite({ extensions: { pg_ivm } });

console.log('=== Rebuilding the same real schema from Step 1 ===');
await db.exec(`
  CREATE TABLE entity_ids (id SERIAL PRIMARY KEY);
  CREATE TABLE entities (
    row_id SERIAL PRIMARY KEY,
    entity_id INTEGER NOT NULL REFERENCES entity_ids(id),
    name TEXT NOT NULL,
    parent_id INTEGER REFERENCES entity_ids(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
  );
  CREATE UNIQUE INDEX entities_name_current ON entities(parent_id, name) WHERE deleted_at IS NULL;
  CREATE VIEW current_entities AS
    SELECT entity_id AS id, name, parent_id FROM entities WHERE deleted_at IS NULL;

  CREATE VIEW entity_entry AS
    SELECT NULL::text AS name, NULL::text AS parent WHERE false;
  CREATE OR REPLACE FUNCTION entity_entry_insert() RETURNS TRIGGER AS $$
  DECLARE new_id INTEGER; parent_id INTEGER;
  BEGIN
    INSERT INTO entity_ids DEFAULT VALUES RETURNING id INTO new_id;
    parent_id := (SELECT id FROM current_entities WHERE name = NEW.parent);
    INSERT INTO entities (entity_id, name, parent_id) VALUES (new_id, NEW.name, parent_id);
    RETURN NEW;
  END; $$ LANGUAGE plpgsql;
  CREATE TRIGGER entity_entry_insert_trigger INSTEAD OF INSERT ON entity_entry
  FOR EACH ROW EXECUTE FUNCTION entity_entry_insert();

  INSERT INTO entity_entry (name, parent) VALUES ('Items', NULL);
  INSERT INTO entity_entry (name, parent) VALUES ('Beer', 'Items');
  INSERT INTO entity_entry (name, parent) VALUES ('Amber', 'Beer');
  INSERT INTO entity_entry (name, parent) VALUES ('Amber Ale 330ml', 'Amber');
`);
console.log('Schema + test data ready.');

console.log('');
console.log('=== Enabling pg_ivm extension ===');
try {
  await db.exec(`CREATE EXTENSION IF NOT EXISTS pg_ivm;`);
  console.log('pg_ivm extension enabled successfully.');
} catch (err) {
  console.log('FAILED to enable pg_ivm:', err.message);
  process.exit(1);
}

console.log('');
console.log('=== Attempting create_immv on a FLAT view (baseline, should work) ===');
try {
  await db.exec(`
    CREATE VIEW flat_test AS SELECT id, name, parent_id FROM current_entities;
  `);
  const res = await db.query(`SELECT pgivm.create_immv('flat_immv', 'SELECT id, name, parent_id FROM current_entities');`);
  console.log('PASS: flat create_immv succeeded:', JSON.stringify(res.rows));
} catch (err) {
  console.log('FAIL: flat create_immv failed:', err.message);
}

console.log('');
console.log('=== Attempting create_immv on a RECURSIVE CTE view (the real, open question) ===');
try {
  const res = await db.query(`
    SELECT pgivm.create_immv('recursive_immv', $q$
      WITH RECURSIVE tree AS (
        SELECT id, name, parent_id, name AS category FROM current_entities WHERE name = 'Items'
        UNION ALL
        SELECT e.id, e.name, e.parent_id, t.category FROM current_entities e JOIN tree t ON e.parent_id = t.id
      )
      SELECT id, name, category FROM tree
    $q$);
  `);
  console.log('PASS: recursive create_immv succeeded:', JSON.stringify(res.rows));
  const contents = await db.query('SELECT * FROM recursive_immv ORDER BY id');
  console.log('Contents:', JSON.stringify(contents.rows));
} catch (err) {
  console.log('FAIL: recursive create_immv failed:', err.message);
}
