// The one, generic endpoint for the new ASCII-CSV call protocol (see
// call-dispatch.ts). Mounted on its own path with a plain-text body
// parser - deliberately not express.json() - since this path carries no
// JSON at all, in either direction.
//
// Request body: one CSV line, `screenName,value1,value2,...` - plain
// positional values, in the exact order the matching BACKEND_FUNCTIONS
// entry expects them (documented at each entry in call-dispatch.ts).
// Deliberately NOT shared-fixtures/screens.csv's own field list:
// screens.csv describes a screen's real DOM fields for UI-driven test
// automation, which for "Create Business" is a different, narrower set
// (businessType/homeCurrency, no entityStructure/partnerNames/
// financialYearStart/reportingFrequency) than the real backend
// function's own full parameter list this protocol has to carry -
// confirmed by direct inspection, not assumed. Reusing it here would
// silently drop real parameters, so this protocol defines its own
// positional order per screen instead.
//
// Response body: one CSV line. First field is "ok" or "error". On
// success, the remaining fields are the result's own values in a
// screen-specific, fixed order (today: Create Business only, documented
// inline below). On error, field 2 is the error message and the HTTP
// status code carries the real status (401/403/404/409/500), same as
// the JSON routes already do.
import { Router } from 'express';
import { splitCsvLine, csvField, unescapeAscii } from '../../../shared-fixtures/csv.js';
import { callBackendFunction, CallError } from '../call-dispatch.js';

export const callRouter = Router();

callRouter.post('/', (req, res) => {
  const body = typeof req.body === 'string' ? req.body : '';
  const line = body.split('\n')[0] ?? '';
  const parts = splitCsvLine(line).map(unescapeAscii);
  const screenName = parts[0];
  if (!screenName) {
    res.status(400).type('text/csv').send('error,' + csvField('Request body must be one CSV line: screenName,value1,value2,...'));
    return;
  }
  try {
    const result = callBackendFunction(screenName, parts.slice(1), req.user);
    res.type('text/csv').send('ok,' + resultToCsvFields(screenName, result).map(csvField).join(','));
  } catch (err) {
    if (err instanceof CallError) {
      res.status(err.status).type('text/csv').send('error,' + csvField(err.message));
      return;
    }
    console.error(err);
    res.status(500).type('text/csv').send('error,' + csvField('Internal error.'));
  }
});

// Per-screen result shape - a plain, fixed field order, same spirit as
// screens.csv's own field order for requests. Only "Create Business" is
// converted so far; extend this alongside BACKEND_FUNCTIONS as further
// screens move onto this protocol.
function resultToCsvFields(screenName: string, result: unknown): string[] {
  if (screenName === 'Create Business') {
    const r = result as { business: string; actualLedger: string; budgetLedger: string; businessAdmin: { username: string; password: string } };
    return [r.business, r.actualLedger, r.budgetLedger, r.businessAdmin.username, r.businessAdmin.password];
  }
  return [];
}
