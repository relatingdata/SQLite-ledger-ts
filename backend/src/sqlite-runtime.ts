// Documented in docs/pm-build-and-tooling.md, "Multi-Runtime Support" -
// this file carries no further multiline comments.

const isBun = typeof (globalThis as unknown as { Bun?: unknown }).Bun !== 'undefined';

export interface RuntimeDatabase {
  exec(sql: string): void;
  prepare(sql: string): RuntimeStatement;
  transaction<T extends (...args: never[]) => unknown>(fn: T): (...args: Parameters<T>) => ReturnType<T>;
  close(): void;
}

export interface RuntimeStatement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}

let DatabaseClass: new (path: string) => RuntimeDatabase;

if (isBun) {
  // A variable specifier: bun:sqlite exists only under bun, and tsc must not
  // depend on whether bun's types happen to be installed.
  const bunSqlite = 'bun:sqlite';
  const { Database } = (await import(bunSqlite)) as { Database: unknown };
  DatabaseClass = Database as unknown as new (path: string) => RuntimeDatabase;
} else {
  const { default: BetterSqlite3 } = await import('better-sqlite3');
  DatabaseClass = BetterSqlite3 as unknown as new (path: string) => RuntimeDatabase;
}

export const Database = DatabaseClass;
