// The two stores of the simplified design, and nothing else.
//
//   entities      every thing and every relation of a thing
//   journal       one header row per entry: the entry and its date
//   journal_line  one row per amount: the entry, the account, the amount
//
// Business, ledger, reference, description, user, reversal and recurrence
// are not columns anywhere: they are entities, or relations of entities.
// The same schema is implemented by the Gleam storage engine
// (storage_engine/src/core_schema.gleam).
//
// The current version of every entity is also held in memory, so that
// walking the tree costs no queries. SQLite remains the only record: the
// index is rebuilt from it on open and after any failed transaction.

import { Database, type RuntimeDatabase } from '../sqlite-runtime.js';

export const CORE_SCHEMA = `
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
`;

export interface Node {
  id: number;
  name: string;
  parent: number | null;
  relation: number | null;
}

export interface Line {
  account: number;
  amount: number;
}

export interface DateRange {
  /** Inclusive lower bound on the entry date. */
  from?: string;
  /** Inclusive upper bound on the entry date. */
  to?: string;
}

const ROOT_KEY = 0;

export class Store {
  readonly db: RuntimeDatabase;
  private nodes = new Map<number, Node>();
  private byParent = new Map<number, Map<string, number>>();
  private nextRow = 1;
  private depth = 0;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.exec(CORE_SCHEMA);
    this.load();
  }

  close(): void {
    this.db.close();
  }

  /** Rebuilds the in-memory index from the entities table. */
  load(): void {
    this.nodes.clear();
    this.byParent.clear();
    const rows = this.db
      .prepare(`SELECT id, name, parent_id AS parent, relation_id AS relation FROM current_entities ORDER BY id`)
      .all() as Node[];
    for (const row of rows) this.index(row);
    const max = this.db.prepare(`SELECT COALESCE(MAX(row_id), 0) AS n FROM entities`).get() as { n: number };
    this.nextRow = max.n + 1;
  }

  private index(node: Node): void {
    this.nodes.set(node.id, node);
    const key = node.parent ?? ROOT_KEY;
    let siblings = this.byParent.get(key);
    if (!siblings) this.byParent.set(key, (siblings = new Map()));
    siblings.set(node.name, node.id);
  }

  /** Runs `fn` as one database transaction. If it throws, nothing it wrote
   * remains, in the database or in the index. */
  tx<T>(fn: () => T): T {
    if (this.depth > 0) return fn();
    this.depth += 1;
    try {
      return this.db.transaction(fn)();
    } catch (err) {
      this.load();
      throw err;
    } finally {
      this.depth -= 1;
    }
  }

  // --- entities -----------------------------------------------------------

  get(id: number): Node {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`No entity ${id}.`);
    return node;
  }

  child(parent: number | null, name: string): Node | undefined {
    const id = this.byParent.get(parent ?? ROOT_KEY)?.get(name);
    return id === undefined ? undefined : this.nodes.get(id);
  }

  children(parent: number): Node[] {
    const siblings = this.byParent.get(parent);
    if (!siblings) return [];
    return [...siblings.values()].sort((a, b) => a - b).map((id) => this.nodes.get(id)!);
  }

  create(name: string, parent: number | null, by: number): Node {
    if (this.child(parent, name)) throw new Error(`"${name}" already exists under that parent.`);
    const id = this.nextRow++;
    this.db
      .prepare(
        `INSERT INTO entities (row_id, entity_id, name, parent_id, relation_id, created_by, created_at)
         VALUES (?, ?, ?, ?, NULL, ?, datetime('now'))`
      )
      .run(id, id, name, parent, by);
    const node: Node = { id, name, parent, relation: null };
    this.index(node);
    return node;
  }

  /** A new version row for an existing entity. */
  private version(node: Node, name: string, relation: number | null, by: number): void {
    const row = this.nextRow++;
    this.db
      .prepare(
        `INSERT INTO entities (row_id, entity_id, name, parent_id, relation_id, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(row, node.id, name, node.parent, relation, by);
    if (name !== node.name) {
      const siblings = this.byParent.get(node.parent ?? ROOT_KEY)!;
      siblings.delete(node.name);
      siblings.set(name, node.id);
    }
    node.name = name;
    node.relation = relation;
  }

  point(id: number, target: number | null, by: number): void {
    const node = this.get(id);
    if (node.relation === target) return;
    this.version(node, node.name, target, by);
  }

  rename(id: number, name: string, by: number): void {
    const node = this.get(id);
    if (node.name === name) return;
    if (this.child(node.parent, name)) throw new Error(`"${name}" already exists under that parent.`);
    this.version(node, name, node.relation, by);
  }

  /** Whether `id` is `ancestor` or sits anywhere beneath it. */
  within(id: number, ancestor: number): boolean {
    let at: number | null = id;
    while (at !== null) {
      if (at === ancestor) return true;
      at = this.nodes.get(at)?.parent ?? null;
    }
    return false;
  }

  // --- journal ------------------------------------------------------------

  insertEntry(entry: number, date: string, lines: Line[]): void {
    this.db.prepare(`INSERT INTO journal (entry_id, date) VALUES (?, ?)`).run(entry, date);
    const insert = this.db.prepare(`INSERT INTO journal_line (entry_id, account_id, amount) VALUES (?, ?, ?)`);
    for (const line of lines) insert.run(entry, line.account, line.amount);
  }

  entryDate(entry: number): string | undefined {
    return (this.db.prepare(`SELECT date FROM journal WHERE entry_id = ?`).get(entry) as { date: string } | undefined)?.date;
  }

  entryLines(entry: number): Line[] {
    return this.db.prepare(`SELECT account_id AS account, amount FROM journal_line WHERE entry_id = ? ORDER BY id`).all(entry) as Line[];
  }

  balance(account: number): number {
    return (this.db.prepare(`SELECT COALESCE(SUM(amount), 0) AS n FROM journal_line WHERE account_id = ?`).get(account) as { n: number }).n;
  }

  hasLines(account: number): boolean {
    return this.db.prepare(`SELECT 1 FROM journal_line WHERE account_id = ? LIMIT 1`).get(account) !== undefined;
  }

  /** The sum posted to every account, optionally within a date range and
   * leaving out some entries. Keyed by account id. */
  sums(range: DateRange = {}, excludeEntries: number[] = []): Map<number, number> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (range.from) {
      where.push(`j.date >= ?`);
      params.push(range.from);
    }
    if (range.to) {
      where.push(`j.date <= ?`);
      params.push(range.to);
    }
    if (excludeEntries.length > 0) where.push(`l.entry_id NOT IN (${excludeEntries.join(',')})`);
    const rows = this.db
      .prepare(
        `SELECT l.account_id AS account, SUM(l.amount) AS amount
         FROM journal_line l JOIN journal j ON j.entry_id = l.entry_id
         ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
         GROUP BY l.account_id`
      )
      .all(...params) as Line[];
    return new Map(rows.map((r) => [r.account, r.amount]));
  }
}
