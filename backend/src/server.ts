import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { entitiesRouter } from './routes/entities.js';
import { reportsRouter } from './routes/reports.js';
import { matrixReportsRouter } from './routes/matrix-reports.js';
import { menuRouter } from './routes/menu.js';
import { i18nRouter } from './routes/i18n.js';
import { businessesRouter } from './routes/businesses.js';
import { journalRouter } from './routes/journal.js';
import { contactsRouter } from './routes/contacts.js';
import { itemsRouter } from './routes/items.js';
import { productsRouter } from './routes/products.js';
import { invoicesRouter, agedRouter, historyRouter, remindersRouter, statementRouter } from './routes/invoices.js';
import { stockLotsRouter } from './routes/stock-lots.js';
import { locationsRouter, belowReorderRouter, stockOutRiskRouter, stockListingRouter, stockTakesRouter } from './routes/locations.js';
import { divisionsRouter } from './routes/divisions.js';
import { hierarchyRouter } from './routes/hierarchy.js';
import { posRouter } from './routes/pos.js';
import { customerRegistrationRouter, customerVerificationRouter } from './routes/customer-registration.js';
import { arAPRouter } from './routes/arap.js';
import { authRouter } from './routes/auth.js';
import { stockRouter } from './routes/stock.js';
import { invoiceRouter } from './routes/invoice.js';
import { periodRouter } from './routes/period.js';
import { projectsRouter } from './routes/projects.js';
import { recordingRouter } from './routes/recording.js';
import { recordingMiddleware } from './recording.js';
import { attachUser, requireAuth, requireRole } from './auth-middleware.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(attachUser);
app.use(recordingMiddleware);

const __dirname = dirname(fileURLToPath(import.meta.url));
function getAppVersion(): string {
  return readFileSync(join(__dirname, '../../VERSION'), 'utf-8').trim();
}
function getDbVersion(): string {
  return (db.prepare('SELECT version FROM db_version WHERE id = 1').get() as { version: string }).version;
}

app.get('/api/health', (_req, res) => res.json({ ok: true, appVersion: getAppVersion(), dbVersion: getDbVersion() }));
app.use('/api/auth', authRouter); // has its own per-route requireAuth — /login must stay public
app.use('/api/recording', requireAuth, recordingRouter);
app.use('/api/entities', requireAuth, entitiesRouter);
app.use('/api/reports', requireAuth, reportsRouter);
app.use('/api/reports/matrix', requireAuth, matrixReportsRouter);
app.use('/api/menu', requireAuth, menuRouter);
app.use('/api/i18n', i18nRouter);
app.use('/api/businesses', requireAuth, businessesRouter);
app.use('/api/journal', requireAuth, journalRouter);
app.use('/api/contacts', requireAuth, contactsRouter);
app.use('/api/items', requireAuth, itemsRouter);
app.use('/api/products', requireAuth, productsRouter);
app.use('/api/invoices', requireAuth, invoicesRouter);
app.use('/api/reports/aged', requireAuth, agedRouter);
app.use('/api/reports/statement', requireAuth, statementRouter);
app.use('/api/reports/history', requireAuth, historyRouter);
app.use('/api/reminders', requireAuth, remindersRouter);
app.use('/api/stock-lots', requireAuth, stockLotsRouter);
app.use('/api/locations', requireAuth, locationsRouter);
app.use('/api/reports/below-reorder', requireAuth, belowReorderRouter);
app.use('/api/reports/stock-out-risk', requireAuth, stockOutRiskRouter);
app.use('/api/stock-listing', requireAuth, stockListingRouter);
app.use('/api/stock-takes', requireAuth, stockTakesRouter);
app.use('/api/pos', requireAuth, posRouter);
app.use('/api/customers', customerRegistrationRouter); // public — self-service terminal, no staff login
app.use('/api/customer-verification', requireAuth, customerVerificationRouter);
app.use('/api/arap', requireAuth, requireRole('Administrator', 'Bookkeeper'), arAPRouter);
app.use('/api/projects', requireAuth, projectsRouter);
app.use('/api/stock', requireAuth, requireRole('Administrator', 'Bookkeeper'), stockRouter);
app.use('/api/invoice', requireAuth, requireRole('Administrator', 'Bookkeeper'), invoiceRouter);
app.use('/api/period', requireAuth, periodRouter);
app.use('/api/divisions', requireAuth, divisionsRouter);
app.use('/api/hierarchy', requireAuth, hierarchyRouter);

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
