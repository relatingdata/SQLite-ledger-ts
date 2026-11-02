// entity-client.ts — the Node-side half of the Kaappi entity-server
// integration (see /root/.claude/plans/stateful-snacking-adleman.md,
// "Route all entity storage through a Kaappi (Scheme) process"). This is
// the ONLY file in the backend that knows the entity store is a Kaappi
// subprocess rather than SQLite; everything above it (eventually
// primitives.ts's Entity/Link/Detail, and for now routes/i18n.ts directly,
// per Phase 1's narrower scope) just calls these functions.
//
// Protocol: kaappi-experiment/entity-server/protocol.md. One JSON object
// per line on the child's stdin, one JSON object per line back on its
// stdout, `id` for correlation. Phase 1 is strictly one-in-flight-at-a-time
// (this client never writes a second request before the first's response
// arrives), so correlation here is a plain FIFO queue, not a map — matching
// protocol.md's own stated Phase 1 scope exactly, not implementing more
// than what's proven.
//
// Supervision: the Node-native equivalent of session-persistence/supervisor.sh
// (built earlier this engagement for a standalone Kaappi process). Built
// into this client instead of a separate shell script because here Node
// already owns the parent process's lifecycle, and a request arriving while
// the child is mid-restart needs to wait for it rather than silently
// going nowhere — a plain shell supervisor watching a pipe can't do that.
//
// Durability: every mutation the Kaappi process accepts is fsync'd to
// entities.wal.jsonl (via wal.sld) BEFORE its response line is written, so
// once a call here resolves successfully, the mutation is durable even if
// the subprocess is SIGKILLed the instant after. A call that fails because
// the child died mid-request has an genuinely unknown outcome (the request
// may or may not have reached the WAL before the kill) and is surfaced as
// a rejected promise — exactly the same "don't guess, ask" interpretation
// `session-persistence.sld`'s earlier crash-safety work settled on.
//
// Cross-repo dependency, by design and not yet resolved: the Kaappi
// runtime, entity-model/, and entity-server/ live in the separate
// /home/claude/kaappi-experiment checkout, not inside this repo, because
// the experiment predates this integration. The paths below are therefore
// environment-configurable rather than hardcoded relative paths, and
// moving (or vendoring) kaappi-experiment under this repo is flagged as
// follow-on work, not attempted here.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import readline from 'node:readline';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- configuration --------------------------------------------------------

const KAAPPI_BIN = process.env.KAAPPI_BIN ?? '/home/claude/kaappi-experiment/kaappi/zig-out/bin/kaappi';
const ENTITY_MODEL_PATH = process.env.KAAPPI_ENTITY_MODEL_PATH ?? '/home/claude/kaappi-experiment/entity-model';
const ENTITY_SERVER_PATH = process.env.KAAPPI_ENTITY_SERVER_PATH ?? '/home/claude/kaappi-experiment/entity-server';
const SERVER_SCRIPT = path.join(ENTITY_SERVER_PATH, 'server.scm');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const WAL_PATH = process.env.KAAPPI_WAL_PATH ?? path.join(dataDir, 'entities.wal.jsonl');

// Crash-loop guard, same numbers and same rationale as supervisor.sh: a
// Kaappi process that keeps dying within a second of starting (a bad
// library, a corrupt WAL line that somehow got past wal-replay!'s own
// per-line guard, ...) should stop being restarted rather than spin the
// CPU and spam the log forever.
const MAX_RESTARTS_PER_WINDOW = 30;
const RESTART_WINDOW_MS = 60_000;
const RESTART_DELAY_MS = 500;

// ---- wire types -------------------------------------------------------

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

interface PendingCall {
  resolve: (v: JsonValue) => void;
  reject: (e: Error) => void;
}

// ---- the subprocess manager ------------------------------------------

class EntityClient {
  private child: ChildProcessWithoutNullStreams | undefined;
  private rl: readline.Interface | undefined;
  private nextId = 1;
  private queue: PendingCall[] = []; // FIFO; response order matches request order (one-in-flight)
  private restartTimestamps: number[] = [];
  private stopped = false;
  private starting: Promise<void> | undefined;

  async ensureStarted(): Promise<void> {
    if (this.child) return;
    if (this.starting) return this.starting;
    this.starting = this.spawnChild();
    try {
      await this.starting;
    } finally {
      this.starting = undefined;
    }
  }

  private async spawnChild(): Promise<void> {
    if (!fs.existsSync(KAAPPI_BIN)) {
      throw new Error(`entity-client: kaappi binary not found at ${KAAPPI_BIN} (set KAAPPI_BIN to override)`);
    }
    const child = spawn(KAAPPI_BIN, ['--lib-path', ENTITY_MODEL_PATH, '--lib-path', ENTITY_SERVER_PATH, SERVER_SCRIPT, WAL_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child = child;
    this.rl = readline.createInterface({ input: child.stdout });
    this.rl.on('line', (line) => this.handleLine(line));
    child.stderr.on('data', (chunk) => {
      // Kaappi-side errors that never made it into a JSON response (a
      // malformed request line, a crash during JSON parsing itself) land
      // here; surfaced rather than swallowed, same spirit as
      // supervisor.sh's own crash logging.
      process.stderr.write(`[entity-server stderr] ${chunk}`);
    });
    child.on('exit', (code, signal) => this.handleExit(code, signal));

    // Give the process a moment to fail fast (e.g. a library that doesn't
    // compile) before declaring it started; a clean, long-running process
    // never resolves this race against its own exit event either way.
    await new Promise<void>((resolve, reject) => {
      const onExit = (code: number | null) => reject(new Error(`entity-server exited immediately (code ${code}) during startup`));
      child.once('exit', onExit);
      setTimeout(() => {
        child.removeListener('exit', onExit);
        resolve();
      }, 150);
    });
  }

  private handleLine(line: string): void {
    const pending = this.queue.shift();
    if (!pending) {
      process.stderr.write(`[entity-client] unexpected response line with no pending call: ${line}\n`);
      return;
    }
    let msg: { id: number; ok: boolean; result?: JsonValue; error?: string };
    try {
      msg = JSON.parse(line);
    } catch (e) {
      pending.reject(new Error(`entity-client: malformed response line: ${line}`));
      return;
    }
    if (msg.ok) pending.resolve(msg.result ?? null);
    else pending.reject(new Error(msg.error ?? 'entity-server: unknown error'));
  }

  private handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    const wasQueueNonEmpty = this.queue.length > 0;
    // Every call that was in flight when the child died has a genuinely
    // unknown outcome -- reject rather than guess, per this file's header.
    for (const pending of this.queue) {
      pending.reject(new Error(`entity-server died mid-request (code=${code}, signal=${signal})`));
    }
    this.queue = [];
    this.child = undefined;
    this.rl?.close();
    this.rl = undefined;

    if (this.stopped) return;

    process.stderr.write(`[entity-client] entity-server exited (code=${code}, signal=${signal})${wasQueueNonEmpty ? ' with requests in flight' : ''}; `);
    const now = Date.now();
    this.restartTimestamps = this.restartTimestamps.filter((t) => now - t < RESTART_WINDOW_MS);
    this.restartTimestamps.push(now);
    if (this.restartTimestamps.length > MAX_RESTARTS_PER_WINDOW) {
      process.stderr.write(`giving up: more than ${MAX_RESTARTS_PER_WINDOW} restarts in the last ${RESTART_WINDOW_MS / 1000}s.\n`);
      return;
    }
    process.stderr.write(`restarting in ${RESTART_DELAY_MS}ms.\n`);
    setTimeout(() => {
      if (!this.stopped) this.spawnChild().catch((e) => process.stderr.write(`[entity-client] restart failed: ${e}\n`));
    }, RESTART_DELAY_MS);
  }

  async call(method: string, args: JsonValue[]): Promise<JsonValue> {
    await this.ensureStarted();
    if (!this.child) throw new Error('entity-client: entity-server is not running (restart budget exhausted or still starting)');
    const id = this.nextId++;
    const line = JSON.stringify({ id, method, args });
    return new Promise<JsonValue>((resolve, reject) => {
      this.queue.push({ resolve, reject });
      this.child!.stdin.write(line + '\n', (err) => {
        if (err) {
          // Writing failed synchronously-ish (e.g. EPIPE because the child
          // just died) -- the entry we just pushed will otherwise sit
          // forever since no response line is coming for it; handleExit's
          // own sweep normally covers this, but pull it out defensively in
          // case the write error fires before the exit event does.
          const idx = this.queue.findIndex((p) => p.resolve === resolve);
          if (idx !== -1) this.queue.splice(idx, 1);
          reject(err);
        }
      });
    });
  }

  stop(): void {
    this.stopped = true;
    if (this.child) {
      this.child.kill('SIGTERM');
    }
  }

  pid(): number | undefined {
    return this.child?.pid;
  }
}

const client = new EntityClient();

// Exposed for server startup/shutdown and for tests that need a clean
// subprocess lifecycle rather than relying on lazy-start-on-first-call.
export function startEntityServer(): Promise<void> {
  return client.ensureStarted();
}
export function stopEntityServer(): void {
  client.stop();
}
// Exposed for ops visibility and for crash-recovery tests that need to
// signal the exact live subprocess rather than pattern-matching `ps`
// output (which can collide with unrelated processes sharing the same
// command line, e.g. another entity-server instance in a parallel test run).
export function entityServerPid(): number | undefined {
  return client.pid();
}

// ---- JSON <-> TS value conventions -------------------------------------
// Mirrors server.scm's own convention exactly: an absent entity reference
// is JSON null on the wire in both directions.

type ExtId = number;
const n = (v: ExtId | null | undefined): JsonValue => (v == null ? null : v);

export interface EntityRef {
  id: ExtId;
  name: string;
}

// ---- Entity --------------------------------------------------------------
// Names and positional args below follow protocol.md's dispatch table,
// which in turn follows entity-model/entities.sld. Kept as flat,
// individually-named functions (getById/getByName/getUnder) rather than
// reproducing primitives.ts's single overloaded `Entity.get(idOrName,
// parent?)`, since nothing yet calls through this client via primitives.ts
// itself (that composition is Phase 2+, per the plan) -- collapsing them
// into one overload now, before a real caller exists to prove the right
// shape, would be guessing rather than building what's needed.

export const Entity = {
  async create(name: string, parentId: ExtId | null, relationId: ExtId | null, userId: number): Promise<ExtId> {
    return (await client.call('entity-create', [name, n(parentId), n(relationId), userId])) as ExtId;
  },
  async getById(id: ExtId): Promise<ExtId | null> {
    return (await client.call('entity-get', [id])) as ExtId | null;
  },
  async getName(id: ExtId): Promise<string | null> {
    return (await client.call('entity-get-name', [id])) as string | null;
  },
  async getByName(name: string): Promise<ExtId | null> {
    return (await client.call('entity-get-by-name', [name])) as ExtId | null;
  },
  async getUnder(name: string, parentId: ExtId): Promise<ExtId | null> {
    return (await client.call('entity-get-under', [name, parentId])) as ExtId | null;
  },
  async ensureUnder(name: string, parentId: ExtId, userId: number): Promise<ExtId> {
    return (await client.call('entity-ensure-under', [name, parentId, userId])) as ExtId;
  },
  async rename(id: ExtId, newName: string, userId: number): Promise<void> {
    await client.call('entity-rename', [id, newName, userId]);
  },
  async reparent(id: ExtId, newParentId: ExtId, userId: number): Promise<void> {
    await client.call('entity-reparent', [id, newParentId, userId]);
  },
  async relate(id: ExtId, newRelationId: ExtId | null, userId: number): Promise<void> {
    await client.call('entity-relate', [id, n(newRelationId), userId]);
  },
  async revoke(id: ExtId, revokedBucketId: ExtId, userId: number): Promise<void> {
    await client.call('entity-revoke', [id, revokedBucketId, userId]);
  },
  async children(parentId: ExtId): Promise<ExtId[]> {
    return (await client.call('entity-children', [parentId])) as ExtId[];
  },
  async ancestorChain(id: ExtId): Promise<ExtId[]> {
    return (await client.call('entity-ancestor-chain', [id])) as ExtId[];
  },
  async descendants(parentId: ExtId): Promise<ExtId[]> {
    return (await client.call('entity-descendants', [parentId])) as ExtId[];
  },
  async linksPointingAt(id: ExtId): Promise<ExtId[]> {
    return (await client.call('entity-links-pointing-at', [id])) as ExtId[];
  },
  async tag(id: ExtId, tagName: string, activeMarkerId: ExtId | null, userId: number): Promise<void> {
    await client.call('entity-tag', [id, tagName, n(activeMarkerId), userId]);
  },
  async untag(id: ExtId, tagName: string, userId: number): Promise<void> {
    await client.call('entity-untag', [id, tagName, userId]);
  },
  async hasTag(id: ExtId, tagName: string): Promise<boolean> {
    return (await client.call('entity-has-tag', [id, tagName])) as boolean;
  },
  async setAttr(id: ExtId, attrType: string, value: string, userId: number): Promise<void> {
    await client.call('entity-set-attr', [id, attrType, value, userId]);
  },
  async getAttr(id: ExtId, attrType: string): Promise<string | null> {
    return (await client.call('entity-get-attr', [id, attrType])) as string | null;
  },
  async clearAttr(id: ExtId, attrType: string, revokedBucketId: ExtId, userId: number): Promise<void> {
    await client.call('entity-clear-attr', [id, attrType, revokedBucketId, userId]);
  },
};

// ---- Link ------------------------------------------------------------

export const Link = {
  async set(ownerName: string, linkType: string, targetName: string, activeMarkerId: ExtId | null, userId: number): Promise<void> {
    await client.call('link-set', [ownerName, linkType, targetName, n(activeMarkerId), userId]);
  },
  async get(ownerName: string, linkType: string): Promise<string | null> {
    return (await client.call('link-get', [ownerName, linkType])) as string | null;
  },
  async delete(ownerName: string, linkType: string, userId: number): Promise<void> {
    await client.call('link-delete', [ownerName, linkType, userId]);
  },
  async mark(ownerName: string, markType: string, activeMarkerId: ExtId | null, userId: number): Promise<void> {
    await client.call('link-mark', [ownerName, markType, n(activeMarkerId), userId]);
  },
  async unmark(ownerName: string, markType: string, userId: number): Promise<void> {
    await client.call('link-unmark', [ownerName, markType, userId]);
  },
  async isMarked(ownerName: string, markType: string): Promise<boolean> {
    return (await client.call('link-marked', [ownerName, markType])) as boolean;
  },
  async withTarget(linkType: string, targetName: string): Promise<string[]> {
    return (await client.call('link-with-target', [linkType, targetName])) as string[];
  },
};

// ---- Detail ------------------------------------------------------------

export const Detail = {
  async set(ownerName: string, detailType: string, value: string, activeMarkerId: ExtId | null, userId: number): Promise<void> {
    await client.call('detail-set', [ownerName, detailType, value, n(activeMarkerId), userId]);
  },
  async list(ownerName: string, detailType?: string): Promise<string[]> {
    return (await client.call('detail-list', [ownerName, detailType ?? null])) as string[];
  },
  async delete(ownerName: string, detailType: string, value: string, userId: number): Promise<void> {
    await client.call('detail-delete', [ownerName, detailType, value, userId]);
  },
};
