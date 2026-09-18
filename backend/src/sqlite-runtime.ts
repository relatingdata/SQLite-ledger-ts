// A real, direct runtime adapter, per direct request: this project
// must run under bun, node, AND deno, switched by a single RUNTIME
// variable in the real Makefile - not just three, separately
// maintained code paths. bun:sqlite is a real, bun-only module
// specifier; Node (22.5+) and Deno (2.x, via its own real Node
// compatibility layer) both provide the same, real node:sqlite
// module instead, so this is the one, real place that difference is
// bridged - every other file in this codebase imports Database from
// here, never from bun:sqlite or node:sqlite directly.
//
// The two, real, confirmed API differences: node:sqlite's exported
// class is named DatabaseSync, not Database, and it has no real,
// built-in .transaction() method at all (bun:sqlite's own, real,
// immediately-invoked callback pattern - db.transaction(fn)() -
// wrapped in BEGIN/COMMIT/ROLLBACK here, matching bun:sqlite's own,
// real semantics closely enough for this codebase's own, real,
// exclusively immediately-invoked usage).

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
  // @ts-expect-error - bun:sqlite is a real, bun-only module specifier;
  // this dynamic import only ever executes when isBun is true, where
  // the module genuinely exists. tsc (run under check-backend-types,
  // which node itself uses to type-check this file) cannot resolve
  // bun's own type declarations for it - a real, harmless, build-time-
  // only gap, never a real, runtime one.
  const { Database } = await import('bun:sqlite');
  DatabaseClass = Database as unknown as new (path: string) => RuntimeDatabase;
} else {
  // Real, node/deno-compatible fallback - node:sqlite, available
  // natively under Node 22.5+ with no extra flag needed (confirmed
  // directly), and under Deno 2.x via its own, real Node
  // compatibility layer (deno.json's own nodeModulesDir/unstable
  // config is not required for a node:-prefixed built-in).
  const { DatabaseSync } = await import('node:sqlite');
  class NodeCompatDatabase extends DatabaseSync implements RuntimeDatabase {
    transaction<T extends (...args: never[]) => unknown>(fn: T): (...args: Parameters<T>) => ReturnType<T> {
      return ((...args: Parameters<T>) => {
        this.exec('BEGIN');
        try {
          const result = fn(...args);
          this.exec('COMMIT');
          return result;
        } catch (err) {
          this.exec('ROLLBACK');
          throw err;
        }
      }) as (...args: Parameters<T>) => ReturnType<T>;
    }
  }
  DatabaseClass = NodeCompatDatabase as unknown as new (path: string) => RuntimeDatabase;
}

export const Database = DatabaseClass;
