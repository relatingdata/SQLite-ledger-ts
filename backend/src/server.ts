import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { callRouter } from './routes/call.js';
import { recordingRouter } from './routes/recording.js';
import { recordingMiddleware } from './recording.js';
import { attachUser, requireAuth } from './auth-middleware.js';

const app = express();
app.use(cors());
app.use(attachUser);
app.use(recordingMiddleware);

const __dirname = dirname(fileURLToPath(import.meta.url));
function getAppVersion(): string {
  return readFileSync(join(__dirname, '../../VERSION'), 'utf-8').trim();
}
function getDbVersion(): string {
  return (db.prepare('SELECT version FROM db_version WHERE id = 1').get() as { version: string }).version;
}

// Every real screen now goes through the one ASCII-CSV call protocol
// below (see routes/call.ts, call-dispatch.ts) — the per-path JSON
// Express routers this backend used to mount (entities/reports/menu/
// i18n/businesses/journal/contacts/items/products/invoices/stock-lots/
// locations/hierarchy/departments/pos/arap/quotations/
// customer-registration/auth/stock/invoice/period/projects, 24 files in
// all) are deleted, per task #239/#245 — their last endpoints
// (locations.ts's getLocationTypes/createLocationType/
// openStorageContainer, matrix-reports.ts's getProfitAndLossByAxis,
// invoice.ts's /pdf) were confirmed converted and verified live
// immediately before this deletion. express.json() goes with them: the
// only two things still mounted that take a request body at all are
// /api/call (its own express.text(), never JSON) and the recording
// start/stop endpoints below, which take no body either. health and
// recording stay on their own small routes — infrastructure/tooling,
// not business "screens", so never in scope for this protocol.
app.get('/api/health', (_req, res) => res.json({ ok: true, appVersion: getAppVersion(), dbVersion: getDbVersion() }));
app.use('/api/recording', requireAuth, recordingRouter);
// Deliberately NOT mounted with requireAuth: some real functions
// (customer self-registration/login at a self-service terminal) must
// stay public, same as the old authRouter/i18nRouter mixed public and
// gated routes on one mount. attachUser (above) still sets req.user
// whenever a valid token is present; every function that needs one
// calls requireAuth/requireRole/requireGlobalRole itself
// (call-dispatch.ts), the same checks the old per-path middleware made,
// just explicit per call instead of implicit per mount.
app.use('/api/call', express.text({ type: () => true }), callRouter);

const PORT = 3001;
const server = app.listen(PORT, () => {
  console.log(`Entities backend listening on http://localhost:${PORT}`);
});
// A real, cross-platform (pure Node net API, no OS-specific tool)
// clear error on port conflict - Node's own default behavior here is
// already to fail loudly (an unhandled 'error' event throws), never a
// silent fallback like Vite's own default; this only makes the real
// cause immediately, unambiguously clear rather than a generic stack
// trace, matching the same principle now applied to the frontend
// (see frontend/vite.config.ts's own strictPort).
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use by another real process - stop it first (this backend never falls back to a different port).`);
    process.exit(1);
  }
  throw err;
});
