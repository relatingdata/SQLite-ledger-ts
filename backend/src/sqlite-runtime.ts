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
  // @ts-expect-error - bun:sqlite resolves only under bun; tsc can't see its types.
  const { Database } = await import('bun:sqlite');
  DatabaseClass = Database as unknown as new (path: string) => RuntimeDatabase;
} else {
  const { default: BetterSqlite3 } = await import('better-sqlite3');
  DatabaseClass = BetterSqlite3 as unknown as new (path: string) => RuntimeDatabase;
}

export const Database = DatabaseClass;
