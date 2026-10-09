// The real Admin recording feature ("completing the circle"), per direct
// design (docs/skill-step-runner-design.md §11). Captures real, live HTTP
// requests - the real backend request/response layer, never
// API_REGISTRY's own, separate, in-process shortcut (§10a) - and appends
// them, in the real, same ASCII format the step-runner itself reads, to
// a real file named after the real, currently logged-in user.
//
// A real, honest, known limitation of this first version, stated plainly
// rather than hidden: a real screen's own field_name (shared-fixtures/
// screens.csv) is read directly from the real request body by the same
// name - when the two don't genuinely match (confirmed directly for at
// least one real screen, "Create Business"'s own businessType/
// homeCurrency), the recorded value for that one, specific position is
// left blank rather than guessed. A best-effort reconstruction, not a
// claim of perfect fidelity for every real field of every real screen.

import { createWriteStream, type WriteStream } from 'fs';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENS_CSV_PATH = join(__dirname, '../../shared-fixtures/screens.csv');

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { fields.push(cur); cur = ''; }
    else cur += ch;
  }
  fields.push(cur);
  return fields;
}

function writeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

interface ScreenField {
  position: number;
  fieldName: string;
}

let screenFieldsCache: Map<string, ScreenField[]> | undefined;

/** Every real screen's own, real, positional field list, grouped by
 * screen_name - loaded once, lazily, from the one, real, shared source
 * (shared-fixtures/screens.csv) the step-runner itself reads. */
function screenFields(): Map<string, ScreenField[]> {
  if (screenFieldsCache) return screenFieldsCache;
  const lines = readFileSync(SCREENS_CSV_PATH, 'utf-8').split('\n').filter((l) => l.trim().length > 0);
  const headers = parseCsvLine(lines[0]);
  const screenNameIdx = headers.indexOf('screen_name');
  const positionIdx = headers.indexOf('position');
  const fieldNameIdx = headers.indexOf('field_name');
  const map = new Map<string, ScreenField[]>();
  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    const screenName = values[screenNameIdx];
    const position = Number(values[positionIdx]);
    const fieldName = values[fieldNameIdx];
    if (!screenName || !fieldName || Number.isNaN(position)) continue;
    const existing = map.get(screenName) ?? [];
    existing.push({ position, fieldName });
    map.set(screenName, existing);
  }
  for (const fields of map.values()) fields.sort((a, b) => a.position - b.position);
  screenFieldsCache = map;
  return map;
}

interface RecordingState {
  username: string;
  stream: WriteStream;
}

const activeRecordings = new Map<number, RecordingState>();

export function isRecording(userId: number): boolean {
  return activeRecordings.has(userId);
}

/** Opens <username>.recording in append mode and writes the real,
 * opening comment line. Throws if this user is already recording -
 * callers must not silently restart an already-open stream. */
export function startRecording(userId: number, username: string): void {
  if (activeRecordings.has(userId)) {
    throw new Error(`Recording is already active for "${username}".`);
  }
  const path = join(__dirname, '../../', `${username}.recording`);
  const stream = createWriteStream(path, { flags: 'a' });
  stream.write(`# recording commenced on ${new Date().toISOString()}\n`);
  activeRecordings.set(userId, { username, stream });
}

/** Writes the real, closing comment line and closes the stream. Throws
 * if this user has no active recording - callers must not silently
 * no-op a stop that had nothing to stop. */
export function stopRecording(userId: number): Promise<void> {
  const state = activeRecordings.get(userId);
  if (!state) {
    return Promise.reject(new Error('No active recording for this user.'));
  }
  activeRecordings.delete(userId);
  return new Promise((resolve, reject) => {
    state.stream.write(`# recording concluded on ${new Date().toISOString()}\n`, (err) => {
      if (err) return reject(err);
      state.stream.end(resolve);
    });
  });
}

/** Appends one real, data-file row for a real, matched screen - called
 * only when a real request carries a real, known X-Screen-Name header
 * and this user's own recording is active. Each real, positional field
 * is read from the real request body by its own, real, matching name;
 * a field whose name does not match the real body's own shape is left
 * blank (the stated, honest limitation above), never guessed. */
export function recordRequest(userId: number, screenName: string, body: Record<string, unknown>): void {
  const state = activeRecordings.get(userId);
  if (!state) return;
  const fields = screenFields().get(screenName);
  if (!fields) return;
  const row = [screenName, ...fields.map((f) => {
    const value = body[f.fieldName];
    return value == null ? '' : String(value);
  })];
  state.stream.write(row.map(writeCsvField).join(',') + '\n');
}

/** The real middleware mounted after attachUser and express.json() -
 * every real request's own real X-Screen-Name header (set only by the
 * real, specific frontend call sites tagged for the real, tracked
 * screens; see shared-fixtures/screens.csv) is recorded only once the
 * real response has genuinely succeeded (2xx) - a failed attempt is
 * never written, since it would not be a real, replayable step. The
 * start/stop requests themselves (recordingRouter) carry no real
 * X-Screen-Name and are never recorded by this mechanism - toggling
 * recording is not itself a real, replayable application action. */
export function recordingMiddleware(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction): void {
  const screenName = req.headers['x-screen-name'] as string | undefined;
  const userId = req.user?.id;
  if (!screenName || userId == null || !isRecording(userId)) return next();
  const body = (req.body ?? {}) as Record<string, unknown>;
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      recordRequest(userId, screenName, body);
    }
  });
  next();
}
