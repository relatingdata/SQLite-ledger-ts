// gleam-worker.ts — runs inside a worker_thread, proxying HTTP calls to
// the already-running storage_engine Gleam/BEAM HTTP server, and answers
// synchronous calls from GleamEntityDriver (the main-thread class) via a
// SharedArrayBuffer + Atomics.wait bridge — the exact same transport
// pattern kaappi-worker.ts uses for its own subprocess, but far simpler
// here: there is no subprocess to spawn/supervise/replay-WAL-into (per
// storage_engine's own design, the ledger actor's mailbox IS the lock,
// and the Makefile starts/stops the server's own process directly,
// alongside backend/frontend) — this worker only ever needs to make one
// real `fetch` per call and hand the raw {status, text} back across the
// thread boundary.
//
// Protocol into this worker: `parentPort.postMessage({method, path, body})`
// where `method` is "GET"|"POST", `path` is the HTTP path (e.g.
// "/entities/42/children"), and `body`, if present, is JSON-serialized
// and sent with a `content-type: application/json` header.
//
// Protocol out of this worker: write `JSON.stringify({status, text})` into
// the shared payload buffer (status is the real HTTP status code; text is
// the raw response body, itself still JSON in almost every case — decoding
// it is GleamEntityDriver's job, not this worker's), record its byte
// length, then signal CALL_OK (or CALL_ERROR, with a plain error message
// as the payload, if the request itself failed — e.g. storage_engine is
// not reachable at all).
import { parentPort, workerData } from 'node:worker_threads';

const STATUS_IDX = 0;
const LENGTH_IDX = 1;
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
  Atomics.store(control, LENGTH_IDX, len);
  return fits;
}

// Same default storage_engine.gleam itself falls back to when
// STORAGE_ENGINE_PORT isn't set; STORAGE_ENGINE_URL overrides the whole
// base URL (host+port) in one go for anything other than plain localhost.
const BASE_URL = process.env.STORAGE_ENGINE_URL ?? `http://localhost:${process.env.STORAGE_ENGINE_PORT ?? '8090'}`;

interface CallMessage {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
}

async function doFetch(msg: CallMessage): Promise<{ status: number; text: string }> {
  const res = await fetch(BASE_URL + msg.path, {
    method: msg.method,
    headers: msg.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: msg.body !== undefined ? JSON.stringify(msg.body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, text };
}

async function handleMessage(msg: CallMessage): Promise<void> {
  try {
    const result = await doFetch(msg);
    const fits = writePayload(JSON.stringify(result));
    Atomics.store(control, STATUS_IDX, fits ? CALL_OK : CALL_ERROR);
    Atomics.notify(control, STATUS_IDX);
  } catch (err) {
    writePayload(`gleam-worker: request to storage_engine failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    Atomics.store(control, STATUS_IDX, CALL_ERROR);
    Atomics.notify(control, STATUS_IDX);
  }
}

async function waitForServer(): Promise<boolean> {
  // storage_engine is started independently (by the Makefile, alongside
  // backend/frontend) — this worker doesn't own its lifecycle, only
  // waits a bounded time for it to be reachable, same spirit as
  // kaappi-worker's own bounded startup wait, just without a spawn.
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/entities`);
      if (res.ok || res.status === 404) return true; // reachable at all is enough
      await res.text();
    } catch {
      // not up yet — fall through to retry
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

waitForServer().then((ok) => {
  if (!ok) {
    writePayload(`gleam-worker: storage_engine not reachable at ${BASE_URL} after 10s — is it running (make ensure-servers)?`);
    Atomics.store(control, STATUS_IDX, START_FAILED);
    Atomics.notify(control, STATUS_IDX);
    return;
  }
  Atomics.store(control, STATUS_IDX, READY);
  Atomics.notify(control, STATUS_IDX);
  parentPort?.on('message', (msg: CallMessage) => {
    void handleMessage(msg);
  });
});
