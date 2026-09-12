import { PGlite } from '@electric-sql/pglite';
import { pg_ivm } from '@electric-sql/pglite-pg_ivm';

const db = new PGlite({ extensions: { pg_ivm } });
await db.exec(`
  CREATE EXTENSION IF NOT EXISTS pg_ivm;
  CREATE TABLE plain_entities (id SERIAL PRIMARY KEY, name TEXT, parent_id INTEGER, deleted_at TIMESTAMPTZ);
  INSERT INTO plain_entities (name, parent_id, deleted_at) VALUES
    ('Items', NULL, NULL), ('Beer', 1, NULL), ('Amber', 2, NULL);
`);
try {
  const res = await db.query(`SELECT pgivm.create_immv('flat_from_table', 'SELECT id, name, parent_id FROM plain_entities WHERE deleted_at IS NULL');`);
  console.log('PASS querying a base table directly:', JSON.stringify(res.rows));
  const rows = await db.query('SELECT * FROM flat_from_table');
  console.log('Contents:', JSON.stringify(rows.rows));
} catch (err) {
  console.log('FAIL querying a base table directly:', err.message);
}
