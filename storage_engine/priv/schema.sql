-- The minimal, real, on-disk schema for the 4 tables this engine
-- owns: entities, account, journal, journal_line. Reproduces the
-- exact same shape and the exact same guard triggers as
-- sqlite-ledger-ts's own backend/schema/00-core.sql (entities.db
-- is the one real source of truth for this design) — this file is
-- not a reinterpretation, it is the same rules, applied by the same
-- engine, just driven from Gleam instead of better-sqlite3.
--
-- entities: append-only. A row is one version of one real-world
-- entity (grouped by entity_id); a rename/reparent is a new row,
-- never an UPDATE of an old one. current_entities (below) is always
-- the one, real way to read "what this entity is right now".
CREATE TABLE IF NOT EXISTS entities (
  row_id     INTEGER PRIMARY KEY,
  entity_id  INTEGER NOT NULL,
  name       TEXT NOT NULL,
  parent_id  INTEGER,
  -- Mirrors the real backend/schema/00-core.sql exactly: relation_id
  -- is the one-parent-but-also-tagged/linked-to-something-else slot
  -- (hasTag/relate/revoke all read or write this column);
  -- combination_ids/detail_json are opaque, caller-owned JSON blobs
  -- this engine never parses — it stores and returns them verbatim,
  -- same as every other column here.
  relation_id INTEGER,
  combination_ids TEXT,
  detail_json TEXT,
  created_at TEXT NOT NULL,
  created_by INTEGER NOT NULL
);

CREATE VIEW IF NOT EXISTS current_entities AS
  SELECT entity_id AS id, name, parent_id, relation_id, combination_ids, detail_json, created_at, created_by
  FROM entities e
  WHERE row_id = (
    SELECT row_id FROM entities e2 WHERE e2.entity_id = e.entity_id
    ORDER BY created_at DESC, row_id DESC LIMIT 1
  );

-- Uniqueness among LIVE rows only — an old, superseded version of a
-- renamed entity keeps its old name forever, so a plain UNIQUE would
-- break the instant anything was ever renamed.
CREATE TRIGGER IF NOT EXISTS entities_name_unique BEFORE INSERT ON entities
WHEN EXISTS (
  SELECT 1 FROM current_entities WHERE parent_id IS NEW.parent_id AND name = NEW.name AND id != NEW.entity_id
)
BEGIN
  SELECT RAISE(ABORT, 'entities: a different, live entity already has this name under this parent');
END;

CREATE TRIGGER IF NOT EXISTS entities_no_update BEFORE UPDATE ON entities
BEGIN
  SELECT RAISE(ABORT, 'entities is append-only: UPDATE is never permitted, only INSERT and SELECT.');
END;

CREATE TRIGGER IF NOT EXISTS entities_no_delete BEFORE DELETE ON entities
BEGIN
  SELECT RAISE(ABORT, 'entities is append-only: DELETE is never permitted, only INSERT and SELECT.');
END;

-- account: a 1:1 extension of an entity. Lazily vivified — any
-- entity can be posted against as an account the first time with no
-- separate "create account" step (INSERT OR IGNORE, same as
-- db-journal.ts). NULL currency means the ledger's own home/
-- reporting currency, never inferred from a locale.
CREATE TABLE IF NOT EXISTS account (
  entity_id     INTEGER PRIMARY KEY,
  balance_minor INTEGER NOT NULL DEFAULT 0,
  currency      TEXT
);

-- journal: a posted entry's header. Append-only, with exactly one,
-- narrow, named exception — reversal_of, write-once, stamped on the
-- new reversing entry to point back at the one it reverses.
CREATE TABLE IF NOT EXISTS journal (
  id          INTEGER PRIMARY KEY,
  reference   TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  transdate   TEXT NOT NULL,
  user_id     INTEGER NOT NULL,
  reversal_of INTEGER REFERENCES journal(id)
);

CREATE TRIGGER IF NOT EXISTS journal_no_delete BEFORE DELETE ON journal
BEGIN
  SELECT RAISE(ABORT, 'journal is append-only: DELETE is never permitted. Reverse the entry instead.');
END;

CREATE TRIGGER IF NOT EXISTS journal_no_update BEFORE UPDATE OF
  id, reference, description, transdate, user_id
ON journal
BEGIN
  SELECT RAISE(ABORT, 'journal is append-only: only reversal_of may ever be set, and only once. Reverse the entry instead of editing it.');
END;

CREATE TRIGGER IF NOT EXISTS journal_reversal_of_write_once BEFORE UPDATE OF reversal_of ON journal
WHEN OLD.reversal_of IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'journal.reversal_of is write-once: this entry has already been stamped as a reversal.');
END;

-- journal_line: one line of a posted entry. Append-only, no
-- exception at all — correcting a posted line means reversing the
-- whole entry and posting a new one, never touching the original.
CREATE TABLE IF NOT EXISTS journal_line (
  id           INTEGER PRIMARY KEY,
  journal_id   INTEGER NOT NULL REFERENCES journal(id),
  account_id   INTEGER NOT NULL REFERENCES account(entity_id),
  amount_minor INTEGER NOT NULL, -- positive = debit, negative = credit
  memo         TEXT NOT NULL DEFAULT ''
);

CREATE TRIGGER IF NOT EXISTS journal_line_no_update BEFORE UPDATE ON journal_line
BEGIN
  SELECT RAISE(ABORT, 'journal_line is append-only: UPDATE is never permitted. Reverse the entry instead.');
END;

CREATE TRIGGER IF NOT EXISTS journal_line_no_delete BEFORE DELETE ON journal_line
BEGIN
  SELECT RAISE(ABORT, 'journal_line is append-only: DELETE is never permitted. Reverse the entry instead.');
END;
