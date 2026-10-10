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

/** `key` is the top-level key in the named source; `path`, when given,
 * is followed from there - a real, nested route through arrays
 * (numeric indices) and objects (string keys) together, e.g.
 * `{ key: 'lines', path: [0, 'itemName'] }` reads `body.lines[0].itemName`. */
type FieldSource = { from: 'params' | 'query' | 'body'; key: string; path?: (string | number)[] };

function resolveFieldSource(sources: RequestSources, source: FieldSource): unknown {
  let value: unknown = sources[source.from][source.key];
  for (const step of source.path ?? []) {
    if (value == null) return undefined;
    value = (value as Record<string | number, unknown>)[step];
  }
  return value;
}

/** Real, hand-verified, per-screen overrides for where a position's real
 * value actually lives, checked directly against each real route's own
 * code - never assumed to be "the body, same name as screens.csv". A
 * screen/field_name pair with no entry here falls back to the body, same
 * name (REAL_FIELD_SOURCES' own default, below). */
const REAL_FIELD_SOURCE_OVERRIDES: Record<string, Record<string, FieldSource>> = {
  'Create Business': {
    // Confirmed directly (backend/src/routes/businesses.ts): the real
    // request body's own key is coaPrototype, not businessType.
    businessType: { from: 'body', key: 'coaPrototype' },
    // Confirmed directly: no real route sets this today - the real
    // frontend page (setup/new-business) has no real homeCurrency field
    // at all, only secondaryCurrencies, a separate, different concept.
    // Left with no override - this position can never be captured from
    // a real request, and is always recorded blank; a real, honest,
    // structural gap in the application itself, not this mechanism.
  },
  'Create Location': {
    // Confirmed directly (backend/src/routes/locations.ts): the real
    // business name is a query parameter, never the body.
    businessName: { from: 'query', key: 'business' },
    // Confirmed directly: the real location name is the URL's own path
    // segment (POST /locations/:name), never the body.
    locationName: { from: 'params', key: 'name' },
    // Confirmed directly: the real body key is location_type, not
    // locationType.
    locationType: { from: 'body', key: 'location_type' },
    // Confirmed directly: no real route sets a real Division for a new
    // location today - the real frontend page has no such field at all.
    // Left with no override, always recorded blank, same, honest reason
    // as Create Business's own homeCurrency, above.
    bottleCapacity: { from: 'body', key: 'bottle_capacity' },
    cartonCapacity: { from: 'body', key: 'carton_capacity' },
  },
  'Stage Journal Line': {
    // Confirmed directly (backend/src/routes/journal.ts, stageLineSchema):
    // the real body keys are business and amount_minor.
    businessName: { from: 'body', key: 'business' },
    amountMinor: { from: 'body', key: 'amount_minor' },
  },
  'Post Journal Entry': {
    // Confirmed directly (backend/src/routes/journal.ts, postSchema).
    businessName: { from: 'body', key: 'business' },
  },
  'Post Purchase Order': {
    // Confirmed directly (backend/src/routes/stock.ts, handlePost) -
    // the exact, same, real shape as Post Journal Entry, above - both
    // are the same, real kind of action, finalizing something already
    // staged.
    businessName: { from: 'body', key: 'business' },
  },
  'Stage Purchase Order': {
    // Confirmed directly (backend/src/routes/stock.ts, base + poSchema).
    businessName: { from: 'body', key: 'business' },
    priceMinor: { from: 'body', key: 'price_minor' },
  },
  // 'Create Entity': no overrides needed - name/parent match the real
  // body (backend/src/routes/entities.ts) exactly.
  'Open Container': {
    // Confirmed directly (backend/src/routes/locations.ts,
    // openContainerSchema): business/location/item, not
    // businessName/locationName/itemName; containerValue/unitValue are
    // each the real array's own first (and, for this tutorial, only)
    // element.
    businessName: { from: 'body', key: 'business' },
    locationName: { from: 'body', key: 'location' },
    itemName: { from: 'body', key: 'item' },
    containerValue: { from: 'body', key: 'containerValues', path: [0] },
    unitValue: { from: 'body', key: 'unitValues', path: [0] },
  },
  'POS Sale': {
    // Confirmed directly (backend/src/routes/pos.ts, saleSchema +
    // saleLineSchema): business, not businessName; the real line
    // fields live inside the real lines array's own, single, first
    // element - this tutorial's own screen only ever records one line.
    businessName: { from: 'body', key: 'business' },
    itemName: { from: 'body', key: 'lines', path: [0, 'itemName'] },
    quantity: { from: 'body', key: 'lines', path: [0, 'quantity'] },
    unitPriceMinor: { from: 'body', key: 'lines', path: [0, 'unitPriceMinor'] },
  },
  'Cash Purchase': {
    // Confirmed directly (backend/src/routes/pos.ts, purchaseSchema +
    // purchaseLineSchema): business/vendorName, not
    // businessName/providerName; same, real, nested line shape as POS
    // Sale, above.
    businessName: { from: 'body', key: 'business' },
    locationName: { from: 'body', key: 'locationName' },
    providerName: { from: 'body', key: 'vendorName' },
    itemName: { from: 'body', key: 'lines', path: [0, 'itemName'] },
    quantity: { from: 'body', key: 'lines', path: [0, 'quantity'] },
    unitCostMinor: { from: 'body', key: 'lines', path: [0, 'unitPriceMinor'] },
  },
  'Create Provider': {
    // A real, confirmed, pre-existing gap, found while reviewing the
    // consolidated /entities/contact route: providerName never
    // matched the real body's own name key.
    providerName: { from: 'body', key: 'name' },
  },
  'Create Customer': {
    // Confirmed directly (backend/src/routes/entities.ts, customerSchema):
    // the real body is just { name } - no real business field at all,
    // same, honest, structural reason as Create Provider's own
    // businessName.
    customerName: { from: 'body', key: 'name' },
  },
  'Cash Sale': {
    // Confirmed directly (backend/src/routes/pos.ts, saleSchema +
    // saleLineSchema) - the exact, same, real, shared endpoint POS
    // Sale itself uses.
    businessName: { from: 'body', key: 'business' },
    customerName: { from: 'body', key: 'customerName' },
    itemName: { from: 'body', key: 'lines', path: [0, 'itemName'] },
    quantity: { from: 'body', key: 'lines', path: [0, 'quantity'] },
    unitPriceMinor: { from: 'body', key: 'lines', path: [0, 'unitPriceMinor'] },
  },
  'Receive Into Storage': {
    // Confirmed directly (backend/src/routes/locations.ts,
    // movementSchema + the real /:name/receive route): business, not
    // businessName; the real location name is the URL's own path
    // segment; groupingName/storageValue are each the real, nested
    // combination arrays' own first element.
    businessName: { from: 'body', key: 'business' },
    locationName: { from: 'params', key: 'name' },
    groupingName: { from: 'body', key: 'combinationShape', path: [0, 0] },
    storageValue: { from: 'body', key: 'combinationValues', path: [0] },
  },
};

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
export interface RequestSources {
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  body: Record<string, unknown>;
}

export function recordRequest(userId: number, screenName: string, sources: RequestSources): void {
  const state = activeRecordings.get(userId);
  if (!state) return;
  const fields = screenFields().get(screenName);
  if (!fields) return;
  const overrides = REAL_FIELD_SOURCE_OVERRIDES[screenName] ?? {};
  const row = [screenName, ...fields.map((f) => {
    const override = overrides[f.fieldName];
    const value = override ? resolveFieldSource(sources, override) : sources.body[f.fieldName];
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
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // req.params is only genuinely populated once Express's own
      // routing has matched the real, specific route - true by now,
      // since the real response has already finished.
      const sources: RequestSources = {
        params: (req.params ?? {}) as Record<string, unknown>,
        query: (req.query ?? {}) as Record<string, unknown>,
        body: (req.body ?? {}) as Record<string, unknown>,
      };
      recordRequest(userId, screenName, sources);
    }
  });
  next();
}
