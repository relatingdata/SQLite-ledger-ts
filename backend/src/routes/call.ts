// The one, generic endpoint for the new ASCII-CSV call protocol (see
// call-dispatch.ts). Mounted on its own path with a plain-text body
// parser - deliberately not express.json() - since this path carries no
// JSON at all, in either direction.
//
// Request body: a first CSV line, `screenName,value1,value2,...` - plain
// positional values, in the exact order the matching BACKEND_FUNCTIONS
// entry expects them (documented at each entry in call-dispatch.ts).
// Deliberately NOT shared-fixtures/screens.csv's own field list in
// general: screens.csv describes a screen's real DOM fields for
// UI-driven test automation, which for several real screens (confirmed
// directly, e.g. "Create Business") is a different, narrower set than
// the real backend function's own full parameter list this protocol has
// to carry. This protocol defines its own positional order per function
// instead, documented at each BACKEND_FUNCTIONS entry.
//
// Some real functions (completePosSale, completeCashPurchase, and
// others with a genuine, caller-variable-length array-of-records input -
// a shopping cart's lines, a journal's lines, an invoice's lines) can't
// fit that one scalar line alone. For these, every body line AFTER the
// first is one more record of that array, in the exact column order that
// BACKEND_FUNCTIONS entry documents for its own line-items - the same
// "extra lines are more rows" idea the table RESPONSE already uses,
// applied to the request side. A function that takes no such array
// simply never reads the lineItems parameter, and zero extra lines is
// exactly "no records" - not an error.
//
// Response body, two shapes, both built by the BACKEND_FUNCTIONS entry
// itself (call-dispatch.ts's CallResult), never guessed here:
//   - a scalar result: one line, "ok,value1,value2,...".
//   - a tabular/list result (anything that's really an array of
//     records - most GETs): line 1 is bare "ok", line 2 is the header
//     row, lines 3+ are one data row each (possibly zero). Line count
//     alone disambiguates the two: a scalar result is always exactly
//     one line; a table result is always at least two.
// On error: one line, "error,message" - the real HTTP status code
// (401/403/404/409/500) carries the actual status, same as the old
// JSON routes.
import { Router } from 'express';
import { splitCsvLine, csvField, unescapeAscii, writeCsv } from '../../../shared-fixtures/csv.js';
import { callBackendFunction, CallError } from '../call-dispatch.js';

export const callRouter = Router();

callRouter.post('/', (req, res) => {
  const body = typeof req.body === 'string' ? req.body : '';
  const bodyLines = body.split('\n').filter((l) => l.length > 0);
  const line = bodyLines[0] ?? '';
  const parts = splitCsvLine(line).map(unescapeAscii);
  const screenName = parts[0];
  if (!screenName) {
    res.status(400).type('text/csv').send('error,' + csvField('Request body must be at least one CSV line: screenName,value1,value2,...'));
    return;
  }
  const lineItems = bodyLines.slice(1).map((l) => splitCsvLine(l).map(unescapeAscii));
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
  try {
    const result = callBackendFunction(screenName, parts.slice(1), req.user, lineItems, token);
    if (result.kind === 'row') {
      res.type('text/csv').send('ok,' + result.values.map(csvField).join(','));
    } else {
      const rows = result.rows.map((r) => Object.fromEntries(result.header.map((h, i) => [h, r[i] ?? ''])));
      res.type('text/csv').send('ok\n' + writeCsv(rows, result.header));
    }
  } catch (err) {
    if (err instanceof CallError) {
      res.status(err.status).type('text/csv').send('error,' + csvField(err.message));
      return;
    }
    console.error(err);
    res.status(500).type('text/csv').send('error,' + csvField('Internal error.'));
  }
});
