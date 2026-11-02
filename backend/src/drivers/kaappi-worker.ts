// kaappi-worker.ts — runs inside a worker_thread, owns the Kaappi
// subprocess AND (per Stage B of
// /root/.claude/plans/stateful-snacking-adleman.md, "move the Kaappi WAL
// into SQLite") the WAL itself, and answers synchronous calls from
// KaappiEntityDriver (the main-thread class) via a SharedArrayBuffer +
// Atomics.wait bridge.
//
// The subprocess-management half (spawn/supervise/FIFO-correlate, same
// crash-loop guard, same numbers) is today's old entity-client.ts, moved
// here unchanged in substance — the real difference is the transport back
// to the caller: entity-client.ts resolved a Promise on the SAME thread
// that made the call; this file runs on a SEPARATE thread and hands its
// result back across a thread boundary to a caller synchronously blocked
// via Atomics.wait, since EntityDriver itself is a synchronous interface
// (see entity-driver.ts's header comment for why).
//
// The WAL half is new this stage: this worker opens its OWN SQLite
// connection to the SAME entities.sqlite file db.ts uses (never the main
// thread's connection object itself — that can't cross a thread boundary —
// but the same underlying file, in WAL journal mode, so both connections
// see each other's committed writes). On startup, before taking any live
// traffic, it reads kaappi_wal's stored op log and replays it into the
// freshly-spawned, empty Kaappi process via `replay-op`. On every live
// mutating call, it appends that call's own op to the SAME log, AFTER the
// live Kaappi response comes back but BEFORE telling the blocked caller it
// succeeded — see the ordering note on handleMessage below for why that
// order is load-bearing, not incidental.
//
// Protocol into this worker: `parentPort.postMessage({method, args})`,
// where `method`/`args` are exactly protocol.md's wire method name and
// positional args (e.g. `{method: "entity-create", args: ["X", 5, null, 1]}`)
// — the caller speaks the wire protocol directly rather than through a
// friendlier wrapper, since this worker's only job is to be a transport
// (plus, now, the WAL bookkeeping that transport implies).
//
// Protocol out of this worker: write the JSON-encoded result (or error
// message) into the shared payload buffer, record its byte length in
// `control[LENGTH]`, then `Atomics.store(control, STATUS, <code>)` +
// `Atomics.notify(control, STATUS)` to wake the blocked caller.
import { parentPort, workerData } from 'node:worker_threads';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import readline from 'node:readline';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { RuntimeDatabase } from '../sqlite-runtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- shared-memory control protocol (must match kaappi-entity-driver.ts) ----

const STATUS = 0;
const LENGTH = 1;
const READY = 1;
const START_FAILED = 2;
const CALL_OK = 1;
const CALL_ERROR = 2;

const { controlSab, payloadSab, payloadCapacity } = workerData as {
  controlSab: SharedArrayBuffer;
  payloadSab: SharedArrayBuffer;
  payloadCapacity: number;
};
const control = new Int32Array(controlSab);
const payload = new Uint8Array(payloadSab);

function writePayload(text: string): boolean {
  const bytes = new TextEncoder().encode(text);
  const fits = bytes.length <= payloadCapacity;
  const len = Math.min(bytes.length, payloadCapacity);
  payload.set(bytes.subarray(0, len));
  Atomics.store(control, LENGTH, len);
  return fits;
}

// ---- configuration (same env vars, same defaults, as today's entity-client.ts) ----

const KAAPPI_BIN = process.env.KAAPPI_BIN ?? '/home/claude/kaappi-experiment/kaappi/zig-out/bin/kaappi';
const ENTITY_MODEL_PATH = process.env.KAAPPI_ENTITY_MODEL_PATH ?? '/home/claude/kaappi-experiment/entity-model';
const ENTITY_SERVER_PATH = process.env.KAAPPI_ENTITY_SERVER_PATH ?? '/home/claude/kaappi-experiment/entity-server';
const SERVER_SCRIPT = path.join(ENTITY_SERVER_PATH, 'server.scm');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Duplicated from db.ts's own dbPath resolution (same env var, same
// default relative path) rather than imported from it — importing db.ts's
// VALUE exports here would reach back across a real circular-import
// hazard (db.ts -> primitives.ts -> entity-driver-select.ts -> this
// worker's spawning code, all evaluated before db.ts's own top-level
// `dbPath` assignment runs) for no real benefit, since this worker needs
// only the path string, not db.ts's wrapped connection.
const DB_PATH = process.env.DB_PATH ?? path.join(dataDir, 'entities.sqlite');

const MAX_RESTARTS_PER_WINDOW = 30;
const RESTART_WINDOW_MS = 60_000;
const RESTART_DELAY_MS = 500;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonOp = JsonValue[]; // [opName, ...positionalArgs] — see protocol.md's replay-op row

interface PendingCall {
  resolve: (v: JsonValue) => void;
  reject: (e: Error) => void;
}

class EntityClient {
  private child: ChildProcessWithoutNullStreams | undefined;
  private rl: readline.Interface | undefined;
  private nextId = 1;
  private queue: PendingCall[] = [];
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
      throw new Error(`kaappi-worker: kaappi binary not found at ${KAAPPI_BIN} (set KAAPPI_BIN to override)`);
    }
    // No WAL-file argument any more — server.scm takes none (Stage B moved
    // durability out of the Kaappi process entirely; see this file's header).
    const child = spawn(KAAPPI_BIN, ['--lib-path', ENTITY_MODEL_PATH, '--lib-path', ENTITY_SERVER_PATH, SERVER_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child = child;
    this.rl = readline.createInterface({ input: child.stdout });
    this.rl.on('line', (line) => this.handleLine(line));
    child.stderr.on('data', (chunk) => {
      process.stderr.write(`[entity-server stderr] ${chunk}`);
    });
    child.on('exit', (code, signal) => this.handleExit(code, signal));

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
      process.stderr.write(`[kaappi-worker] unexpected response line with no pending call: ${line}\n`);
      return;
    }
    let msg: { id: number; ok: boolean; result?: JsonValue; error?: string };
    try {
      msg = JSON.parse(line);
    } catch (e) {
      pending.reject(new Error(`kaappi-worker: malformed response line: ${line}`));
      return;
    }
    if (msg.ok) pending.resolve(msg.result ?? null);
    else pending.reject(new Error(msg.error ?? 'entity-server: unknown error'));
  }

  private handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    for (const pending of this.queue) {
      pending.reject(new Error(`entity-server died mid-request (code=${code}, signal=${signal})`));
    }
    this.queue = [];
    this.child = undefined;
    this.rl?.close();
    this.rl = undefined;

    if (this.stopped) return;

    process.stderr.write(`[kaappi-worker] entity-server exited (code=${code}, signal=${signal}); `);
    const now = Date.now();
    this.restartTimestamps = this.restartTimestamps.filter((t) => now - t < RESTART_WINDOW_MS);
    this.restartTimestamps.push(now);
    if (this.restartTimestamps.length > MAX_RESTARTS_PER_WINDOW) {
      process.stderr.write(`giving up: more than ${MAX_RESTARTS_PER_WINDOW} restarts in the last ${RESTART_WINDOW_MS / 1000}s.\n`);
      return;
    }
    process.stderr.write(`restarting in ${RESTART_DELAY_MS}ms.\n`);
    setTimeout(() => {
      if (!this.stopped) this.spawnChild().catch((e) => process.stderr.write(`[kaappi-worker] restart failed: ${e}\n`));
    }, RESTART_DELAY_MS);
  }

  async call(method: string, args: JsonValue[]): Promise<JsonValue> {
    await this.ensureStarted();
    if (!this.child) throw new Error('kaappi-worker: entity-server is not running (restart budget exhausted or still starting)');
    const id = this.nextId++;
    const line = JSON.stringify({ id, method, args });
    return new Promise<JsonValue>((resolve, reject) => {
      this.queue.push({ resolve, reject });
      this.child!.stdin.write(line + '\n', (err) => {
        if (err) {
          const idx = this.queue.findIndex((p) => p.resolve === resolve);
          if (idx !== -1) this.queue.splice(idx, 1);
          reject(err);
        }
      });
    });
  }
}

const client = new EntityClient();

// ---- the WAL itself, now owned here instead of a Kaappi-side flat file ----
// One singleton row (same discipline as db.ts's own db_version table),
// holding the whole op log as one JSON array. Every write reads, appends
// to, and rewrites the ENTIRE array — an explicit, accepted trade-off (see
// the plan's "2. The WAL-in-SQLite redesign"), not a hidden one.

let walDb: RuntimeDatabase;

function ensureWalTable(): void {
  // CREATE TABLE IF NOT EXISTS / INSERT OR IGNORE, not a second definition
  // of this table: 00-core.sql (schema/00-core.sql) is still the one real,
  // approved schema source. This exists only so this worker doesn't race
  // db.ts's own schema-init code — which lives in db.ts's top-level body,
  // AFTER its imports (primitives.ts -> entity-driver-select.ts -> this
  // worker's spawn) have already run when ENTITY_DRIVER=kaappi. Idempotent
  // either way: a database db.ts already initialized is left untouched.
  walDb.exec(`CREATE TABLE IF NOT EXISTS kaappi_wal (id INTEGER PRIMARY KEY CHECK (id = 1), ops_json TEXT NOT NULL DEFAULT '[]')`);
  walDb.exec(`INSERT OR IGNORE INTO kaappi_wal (id, ops_json) VALUES (1, '[]')`);
}

function readWalOps(): JsonOp[] {
  const row = walDb.prepare('SELECT ops_json FROM kaappi_wal WHERE id = 1').get() as { ops_json: string } | undefined;
  if (!row) throw new Error('kaappi-worker: kaappi_wal has no row with id = 1 after ensureWalTable — should be unreachable.');
  return JSON.parse(row.ops_json) as JsonOp[];
}

function appendWalOp(op: JsonOp): void {
  const ops = readWalOps();
  ops.push(op);
  walDb.prepare('UPDATE kaappi_wal SET ops_json = ? WHERE id = 1').run(JSON.stringify(ops));
}

// Builds the op to log for a mutating wire method, from that call's own
// request args — everything apply-wal-op! (server.scm) needs is already
// present in the args every one of these methods already takes, so no
// extra round trip is needed for any of them. `entity-create` is the one
// case that also needs the RESULT (the freshly-assigned ext-id). Deliberately
// excludes `entity-ensure-under`, which only SOMETIMES creates and needs its
// own pre-check — see that special case in handleMessage below — and every
// read-only method, which never appears in this table at all.
const MUTATORS: Record<string, (args: JsonValue[], result: JsonValue) => JsonOp> = {
  'entity-create': (args, result) => ['create', result, args[0], args[1], args[2], args[3]],
  'entity-rename': (args) => ['rename', args[0], args[1], args[2]],
  'entity-reparent': (args) => ['reparent', args[0], args[1], args[2]],
  'entity-relate': (args) => ['relate', args[0], args[1], args[2]],
  'entity-revoke': (args) => ['revoke', args[0], args[1], args[2]],
  'entity-tag': (args) => ['tag', args[0], args[1], args[2], args[3]],
  'entity-untag': (args) => ['untag', args[0], args[1], args[2]],
  'entity-set-attr': (args) => ['set-attr', args[0], args[1], args[2], args[3]],
  'entity-clear-attr': (args) => ['clear-attr', args[0], args[1], args[2], args[3]],
  'link-set': (args) => ['link-set', args[0], args[1], args[2], args[3], args[4]],
  'link-delete': (args) => ['link-delete', args[0], args[1], args[2]],
  'link-mark': (args) => ['link-mark', args[0], args[1], args[2], args[3]],
  'link-unmark': (args) => ['link-unmark', args[0], args[1], args[2]],
  'detail-set': (args) => ['detail-set', args[0], args[1], args[2], args[3], args[4]],
  'detail-delete': (args) => ['detail-delete', args[0], args[1], args[2], args[3]],
};

async function main(): Promise<void> {
  try {
    // A dynamic import with an explicitly-chosen extension, not the static
    // `import ... from '../sqlite-runtime.js'` form used everywhere else in
    // this codebase: confirmed directly (a minimal worker + `--import
    // tsx/esm` repro) that tsx's loader does NOT apply its usual .js->.ts
    // sibling remapping to a worker thread's own relative imports the way
    // it does for ordinary module graphs — a static `.js` import inside a
    // worker resolves against the literal, uncompiled dev tree and fails
    // with ERR_MODULE_NOT_FOUND. Building the URL with the right real
    // extension ourselves (the same selfIsTs trick already used for this
    // worker's own file path, in kaappi-entity-driver.ts) sidesteps the
    // remapping entirely rather than depending on it.
    const selfIsTs = import.meta.url.endsWith('.ts');
    const sqliteRuntimeUrl = new URL(selfIsTs ? '../sqlite-runtime.ts' : '../sqlite-runtime.js', import.meta.url);
    const { Database } = (await import(sqliteRuntimeUrl.href)) as typeof import('../sqlite-runtime.js');

    walDb = new Database(DB_PATH);
    ensureWalTable();
    await client.ensureStarted();
    // Replay, sequentially, BEFORE any live traffic — this worker's own
    // one-op-at-a-time discipline, extended to cover startup the same way
    // protocol.md's "Startup" section now documents.
    for (const op of readWalOps()) {
      await client.call('replay-op', [op]);
    }
  } catch (e) {
    writePayload(e instanceof Error ? e.message : String(e));
    Atomics.store(control, STATUS, START_FAILED);
    Atomics.notify(control, STATUS);
    return;
  }
  Atomics.store(control, STATUS, READY);
  Atomics.notify(control, STATUS);

  parentPort!.on('message', async (msg: { method: string; args: JsonValue[] }) => {
    let status: number;
    try {
      let result: JsonValue;
      if (msg.method === 'entity-ensure-under') {
        // The one mutator that only SOMETIMES mutates: log a `create` op
        // only if this call is the one that actually created the entity,
        // exactly like the handler's own pre-existing check used to, before
        // that check moved from server.scm to here.
        const [name, parentId, userId] = msg.args;
        const preExisting = await client.call('entity-get-under', [name, parentId]);
        result = await client.call('entity-ensure-under', msg.args);
        if (preExisting == null) appendWalOp(['create', result, name, parentId, null, userId]);
      } else {
        result = await client.call(msg.method, msg.args);
        const buildOp = MUTATORS[msg.method];
        // Ordering here is load-bearing: the live Kaappi call has already
        // succeeded (awaited above) and the WAL write below has already
        // completed by the time `status`/`notify` tell the blocked caller
        // anything — so a caller is never told "success" for a mutation
        // this process can't also recover on its next restart. A failure
        // in the WAL write itself (the `catch` below) is reported as an
        // error, same as any other failure — even though the live Kaappi
        // mutation already happened — which is the SAFE direction to fail
        // in: replay-on-start only ever trusts this table, never a
        // process's live memory, so an unlogged mutation is simply gone on
        // restart, matching what the caller was actually told.
        if (buildOp) appendWalOp(buildOp(msg.args, result));
      }
      const json = JSON.stringify(result ?? null);
      const fits = writePayload(json);
      status = fits ? CALL_OK : CALL_ERROR;
      if (!fits) writePayload(`kaappi-worker: result too large for the sync bridge buffer (${json.length} chars > ${payloadCapacity} bytes)`);
    } catch (e) {
      writePayload(e instanceof Error ? e.message : String(e));
      status = CALL_ERROR;
    }
    Atomics.store(control, STATUS, status);
    Atomics.notify(control, STATUS);
  });
}

main();
