// kaappi-worker.ts — runs inside a worker_thread, owns the Kaappi
// subprocess, and answers synchronous calls from KaappiEntityDriver (the
// main-thread class) via a SharedArrayBuffer + Atomics.wait bridge.
//
// This is almost entirely today's entity-client.ts, moved here unchanged in
// substance (spawn/supervise/FIFO-correlate the subprocess, same crash-loop
// guard, same numbers) — the only real difference is the transport back to
// the caller: entity-client.ts resolved a Promise on the SAME thread that
// made the call; this file runs on a SEPARATE thread and has to hand its
// result back across a thread boundary to a caller that is synchronously
// blocked via Atomics.wait, since EntityDriver itself is a synchronous
// interface (see entity-driver.ts's header comment for why).
//
// Protocol into this worker: `parentPort.postMessage({method, args})`,
// where `method`/`args` are exactly protocol.md's wire method name and
// positional args (e.g. `{method: "entity-create", args: ["X", 5, null, 1]}`)
// — the caller speaks the wire protocol directly rather than through a
// friendlier wrapper, since this worker's only job is to be a transport.
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
const WAL_PATH = process.env.KAAPPI_WAL_PATH ?? path.join(dataDir, 'entities.wal.jsonl');

const MAX_RESTARTS_PER_WINDOW = 30;
const RESTART_WINDOW_MS = 60_000;
const RESTART_DELAY_MS = 500;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

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
    const child = spawn(KAAPPI_BIN, ['--lib-path', ENTITY_MODEL_PATH, '--lib-path', ENTITY_SERVER_PATH, SERVER_SCRIPT, WAL_PATH], {
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

async function main(): Promise<void> {
  try {
    await client.ensureStarted();
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
      const result = await client.call(msg.method, msg.args);
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
