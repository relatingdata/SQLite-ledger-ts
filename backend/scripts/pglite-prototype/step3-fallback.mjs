import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
await db.exec(`
  CREATE TABLE entity_ids (id SERIAL PRIMARY KEY);
  CREATE TABLE entities (
    row_id SERIAL PRIMARY KEY, entity_id INTEGER NOT NULL, name TEXT NOT NULL,
    parent_id INTEGER, deleted_at TIMESTAMPTZ
  );
  CREATE UNIQUE INDEX entities_name_current ON entities(parent_id, name) WHERE deleted_at IS NULL;

  INSERT INTO entity_ids DEFAULT VALUES; INSERT INTO entities VALUES (1,1,'Items',NULL,NULL);
  INSERT INTO entity_ids DEFAULT VALUES; INSERT INTO entities VALUES (2,2,'Beer',1,NULL);
  INSERT INTO entity_ids DEFAULT VALUES; INSERT INTO entities VALUES (3,3,'Amber',2,NULL);

  CREATE MATERIALIZED VIEW item_hierarchy AS
    WITH RECURSIVE tree AS (
      SELECT entity_id AS id, name, parent_id, name AS category
      FROM entities WHERE deleted_at IS NULL AND name = 'Items'
      UNION ALL
      SELECT e.entity_id, e.name, e.parent_id, t.category
      FROM entities e JOIN tree t ON e.parent_id = t.id
      WHERE e.deleted_at IS NULL
    )
    SELECT id, name, category FROM tree WHERE name != 'Items';
`);
const before = await db.query('SELECT * FROM item_hierarchy ORDER BY id');
console.log('Materialized view before new insert:', JSON.stringify(before.rows));

await db.exec(`
  INSERT INTO entity_ids DEFAULT VALUES;
  INSERT INTO entities VALUES (4,4,'Stout',2,NULL);
`);
const stale = await db.query('SELECT * FROM item_hierarchy ORDER BY id');
console.log('Materialized view BEFORE refresh (expected stale - new Stout row missing):', JSON.stringify(stale.rows));

await db.exec('REFRESH MATERIALIZED VIEW item_hierarchy;');
const fresh = await db.query('SELECT * FROM item_hierarchy ORDER BY id');
console.log('Materialized view AFTER explicit refresh (expected: Stout now present):', JSON.stringify(fresh.rows));
