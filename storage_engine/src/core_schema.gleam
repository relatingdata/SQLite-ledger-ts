// The whole on-disk shape of the simplified design (see core.gleam):
// two stores and nothing else.
//
//   entities      every thing and every relation of a thing
//   journal       one header row per entry: the entry and its date
//   journal_line  one row per amount: the entry, the account, the amount
//
// Business, ledger, reference, description, user, reversal, recurrence
// are not columns anywhere: they are entities, or relations of entities.

pub const sql: String = "
CREATE TABLE IF NOT EXISTS entities (
  row_id      INTEGER PRIMARY KEY,
  entity_id   INTEGER NOT NULL,
  name        TEXT NOT NULL,
  parent_id   INTEGER,
  relation_id INTEGER,
  created_by  INTEGER NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS entities_by_entity ON entities(entity_id, row_id);
CREATE INDEX IF NOT EXISTS entities_by_parent ON entities(parent_id);

CREATE VIEW IF NOT EXISTS current_entities AS
  SELECT entity_id AS id, name, parent_id, relation_id, created_by, created_at
  FROM entities e
  WHERE row_id = (SELECT MAX(row_id) FROM entities e2 WHERE e2.entity_id = e.entity_id);

CREATE TRIGGER IF NOT EXISTS entities_name_unique BEFORE INSERT ON entities
WHEN EXISTS (
  SELECT 1 FROM current_entities
  WHERE parent_id IS NEW.parent_id AND name = NEW.name AND id != NEW.entity_id
)
BEGIN
  SELECT RAISE(ABORT, 'entities: another entity already has this name under this parent');
END;
CREATE TRIGGER IF NOT EXISTS entities_no_update BEFORE UPDATE ON entities
BEGIN SELECT RAISE(ABORT, 'entities is append-only'); END;
CREATE TRIGGER IF NOT EXISTS entities_no_delete BEFORE DELETE ON entities
BEGIN SELECT RAISE(ABORT, 'entities is append-only'); END;

CREATE TABLE IF NOT EXISTS journal (
  entry_id INTEGER PRIMARY KEY,
  date     TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS journal_line (
  id         INTEGER PRIMARY KEY,
  entry_id   INTEGER NOT NULL REFERENCES journal(entry_id),
  account_id INTEGER NOT NULL,
  amount     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS journal_line_by_account ON journal_line(account_id);
CREATE INDEX IF NOT EXISTS journal_line_by_entry ON journal_line(entry_id);

CREATE TRIGGER IF NOT EXISTS journal_no_update BEFORE UPDATE ON journal
BEGIN SELECT RAISE(ABORT, 'journal is append-only'); END;
CREATE TRIGGER IF NOT EXISTS journal_no_delete BEFORE DELETE ON journal
BEGIN SELECT RAISE(ABORT, 'journal is append-only'); END;
CREATE TRIGGER IF NOT EXISTS journal_line_no_update BEFORE UPDATE ON journal_line
BEGIN SELECT RAISE(ABORT, 'journal_line is append-only'); END;
CREATE TRIGGER IF NOT EXISTS journal_line_no_delete BEFORE DELETE ON journal_line
BEGIN SELECT RAISE(ABORT, 'journal_line is append-only'); END;
"
