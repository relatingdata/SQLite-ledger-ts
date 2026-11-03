// The real, live, production dispatch table for the new ASCII-CSV
// frontend<->backend call protocol, per direct instruction: no JSON
// anywhere on this path, no per-screen Express route, no separate
// "api_function" name distinct from the screen/call itself — a call's
// own name IS the backend function. Each entry is a plain function keyed
// by that exact name, looked up with an ordinary object-property read
// (`BACKEND_FUNCTIONS[name]`) — never `eval`: an unrecognized or
// malicious name simply fails the lookup instead of running as code.
//
// Core types/helpers live here; the actual per-domain entries live in
// call-dispatch/*.ts, one file per old route file (same split as
// routes/*.ts), merged into one BACKEND_FUNCTIONS map below - this keeps
// any one domain's conversion independent of every other's, the same way
// the old route files were independent of each other.
import type { AuthenticatedUser } from './auth.js';
import { csvField, splitCsvLine, unescapeAscii } from '../../shared-fixtures/csv.js';
import { arapFunctions } from './call-dispatch/arap.js';
import { businessesFunctions } from './call-dispatch/businesses.js';
import { customerRegistrationFunctions } from './call-dispatch/customer-registration.js';
import { departmentsFunctions } from './call-dispatch/departments.js';
import { entitiesFunctions } from './call-dispatch/entities.js';
import { hierarchyFunctions } from './call-dispatch/hierarchy.js';
import { i18nFunctions } from './call-dispatch/i18n.js';
import { itemsFunctions } from './call-dispatch/items.js';
import { journalFunctions } from './call-dispatch/journal.js';
import { matrixReportsFunctions } from './call-dispatch/matrix-reports.js';
import { menuFunctions } from './call-dispatch/menu.js';
import { periodFunctions } from './call-dispatch/period.js';
import { posFunctions } from './call-dispatch/pos.js';
import { productsFunctions } from './call-dispatch/products.js';
import { projectsFunctions } from './call-dispatch/projects.js';
import { quotationsFunctions } from './call-dispatch/quotations.js';
import { stockFunctions } from './call-dispatch/stock.js';
import { stockLotsFunctions } from './call-dispatch/stock-lots.js';

export class CallError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function requireGlobalRole(user: AuthenticatedUser | undefined, ...roles: string[]): AuthenticatedUser {
  if (!user) throw new CallError(401, 'Not logged in.');
  if (!user.roles.some((r) => roles.includes(r))) throw new CallError(403, `Requires one of: ${roles.join(', ')} (globally).`);
  return user;
}

// Mirrors auth-middleware.ts's requireRole exactly (including the
// Business Admin matrix fallback), just as a plain function instead of
// Express middleware - this protocol has no middleware chain, so every
// per-call role check is made explicitly, the same checks, same places.
export function requireRole(user: AuthenticatedUser | undefined, ...roles: string[]): AuthenticatedUser {
  if (!user) throw new CallError(401, 'Not logged in.');
  if (user.roles.some((r) => roles.includes(r))) return user;
  throw new CallError(403, `Requires one of: ${roles.join(', ')}.`);
}

export function requireAuth(user: AuthenticatedUser | undefined): AuthenticatedUser {
  if (!user) throw new CallError(401, 'Not logged in.');
  return user;
}

// Every BACKEND_FUNCTIONS entry returns one of these, never a bare
// value - 'row' for a single record (exactly one CSV response line),
// 'table' for anything that's really an array of records (most GETs) -
// see routes/call.ts for how each becomes real bytes on the wire.
export type CallResult = { kind: 'row'; values: string[] } | { kind: 'table'; header: string[]; rows: string[][] };
export function row(...values: (string | number | boolean | null | undefined)[]): CallResult {
  return { kind: 'row', values: values.map((v) => (v === null || v === undefined ? '' : String(v))) };
}
export function table<T>(header: (keyof T & string)[], records: T[]): CallResult {
  return { kind: 'table', header, rows: records.map((r) => header.map((h) => (r[h] === null || r[h] === undefined ? '' : String(r[h])))) };
}

// lineItems: for a function whose real input has a genuine, caller-
// variable-length array of records (a shopping cart's lines, a
// journal's lines) - every request body line after the first, each
// already split into fields (see routes/call.ts). Empty for every
// other function, which simply never reads this parameter.
// A handful of real functions carry a genuine nested list inside one
// otherwise-flat record — a scanned product combination's
// combinationValues (string[]) / combinationShape ([string,string][]).
// Rather than invent a new, second escaping convention for this one
// level of nesting, these reuse the SAME real codec recursively: the
// inner list is itself one CSV line (each item already csvField-
// escaped), and that whole line becomes one field of the outer line via
// csvField again — csvField's own quote-wrapping already handles a
// value that itself contains commas correctly, so this is exactly the
// existing codec applied twice, not a new one.
export function encodeStringList(values: string[] | undefined): string {
  if (!values || values.length === 0) return '';
  return values.map(csvField).join(',');
}
export function decodeStringList(encoded: string): string[] {
  if (encoded === '') return [];
  return splitCsvLine(encoded).map(unescapeAscii);
}
export function encodeShape(shape: [string, string][] | undefined): string {
  if (!shape || shape.length === 0) return '';
  return encodeStringList(shape.flat());
}
export function decodeShape(encoded: string): [string, string][] | undefined {
  if (encoded === '') return undefined;
  const flat = decodeStringList(encoded);
  const pairs: [string, string][] = [];
  for (let i = 0; i < flat.length; i += 2) pairs.push([flat[i], flat[i + 1]]);
  return pairs;
}

// A real response can nest a whole, further array of records inside one
// field (journal.ts's previewCloseBooks: lines[]/groupBreakdown[]/
// profitCenterBreakdown[] are three, unrelated arrays in one result - no
// single row-per-record table shape fits all three at once). Rather than
// invent a new encoding, this is exactly encodeStringList applied one
// level deeper, recursively reusing the same real codec again: each
// record becomes one encodeStringList-encoded line (its own fields,
// already csvField-escaped), and that whole set of per-record lines
// becomes one more encodeStringList list (each encoded line csvField-
// wrapped again, since it may itself contain commas).
export function encodeRecordList<T>(fields: (keyof T & string)[], records: T[]): string {
  return encodeStringList(
    records.map((r) => encodeStringList(fields.map((f) => (r[f] === null || r[f] === undefined ? '' : String(r[f])))))
  );
}
export function decodeRecordList(fields: string[], encoded: string): Record<string, string>[] {
  return decodeStringList(encoded).map((lineEncoded) => {
    const values = decodeStringList(lineEncoded);
    return Object.fromEntries(fields.map((f, i) => [f, values[i] ?? '']));
  });
}

export type BackendCall = (values: string[], user: AuthenticatedUser | undefined, lineItems: string[][]) => CallResult;

export const BACKEND_FUNCTIONS: Record<string, BackendCall> = {
  ...arapFunctions,
  ...businessesFunctions,
  ...customerRegistrationFunctions,
  ...departmentsFunctions,
  ...entitiesFunctions,
  ...hierarchyFunctions,
  ...i18nFunctions,
  ...itemsFunctions,
  ...journalFunctions,
  ...matrixReportsFunctions,
  ...menuFunctions,
  ...periodFunctions,
  ...posFunctions,
  ...productsFunctions,
  ...projectsFunctions,
  ...quotationsFunctions,
  ...stockFunctions,
  ...stockLotsFunctions,
};

export function callBackendFunction(name: string, values: string[], user: AuthenticatedUser | undefined, lineItems: string[][] = []): CallResult {
  const fn = BACKEND_FUNCTIONS[name];
  if (!fn) throw new CallError(404, `No real backend function named "${name}".`);
  return fn(values, user, lineItems);
}
