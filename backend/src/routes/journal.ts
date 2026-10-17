import { Router, type Request } from 'express';
import { requireRole } from '../auth-middleware.js';
import { canUserPostToLedger } from '../auth.js';
import { z } from 'zod';
import {
  stageLine,
  getStagedLines,
  removeStagedLine,
  postJournalEntry,
  createRecurringJournal,
  reverseJournalEntry,
  closeBooks,
  createLedger,
  rolloverToNewPeriod,
  resolveRolloverLines,
  previewCloseBooks,
  listJournalEntries,
  countJournalEntries,
  getJournalEntry,
  PostingError,
  ValidationError,
  NotFoundError,
  asBusinessName,
  asLedgerName,
  asAccountName,
  asUserId,
} from '../db.js';

export const journalRouter = Router();

// Per docs/active-ledger-design.md and direct instruction: the one,
// real enforcement point for "one active ledger per business, but
// the old one stays postable for real corrections".
function canPostToLedger(req: Request, business: string, ledger: string): boolean {
  if (!req.user) return false;
  return canUserPostToLedger(asBusinessName(business), asLedgerName(ledger), req.user);
}

const NOT_ACTIVE_LEDGER_ERROR = (ledger: string) =>
  `"${ledger}" is not this business's current active ledger — posting there requires Administrator, Accountant, or this business's own Business Admin.`;

journalRouter.get('/', (req, res) => {
  const business = req.query.business as string;
  const ledger = req.query.ledger as string;
  if (!business || !ledger) return res.status(400).json({ error: 'business and ledger are required.' });
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  res.json({ rows: listJournalEntries(asBusinessName(business), asLedgerName(ledger), limit, offset), totalCount: countJournalEntries(asBusinessName(business), asLedgerName(ledger)) });
});

journalRouter.get('/:id/:date', (req, res) => {
  const business = req.query.business as string;
  const ledger = req.query.ledger as string;
  if (!business || !ledger) return res.status(400).json({ error: 'business and ledger are required.' });
  const entry = getJournalEntry(asBusinessName(business), asLedgerName(ledger), Number(req.params.id), req.params.date);
  if (!entry) return res.status(404).json({ error: 'Not found.' });
  res.json(entry);
});

const stageLineSchema = z.object({
  reference: z.string().min(1),
  business: z.string().min(1),
  ledger: z.string().min(1),
  description: z.string().optional(),
  transdate: z.string().optional(),
  account: z.string().min(1),
  // Per a real, confirmed bug found and fixed directly while
  // verifying Phase 1 against a real, live browser: this generic
  // staging endpoint never accepted a real accountId at all, so a
  // caller staging by bare account name alone has no way to
  // disambiguate two real, different accounts (different parent,
  // different id) that happen to share the exact, same literal name
  // - Open Container's own "Remaining"/"Occupied" leaves do, for
  // instance. Optional, since most real callers' account names are
  // already unique and need nothing further.
  accountId: z.number().int().optional(),
  amount_minor: z.number().int(),
  memo: z.string().optional(),
});

journalRouter.post('/staging', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = stageLineSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (!canPostToLedger(req, parsed.data.business, parsed.data.ledger)) {
    return res.status(403).json({ error: NOT_ACTIVE_LEDGER_ERROR(parsed.data.ledger) });
  }
  try {
    stageLine({
      ...parsed.data,
      business: asBusinessName(parsed.data.business),
      ledger: asLedgerName(parsed.data.ledger),
      account: asAccountName(parsed.data.account),
    });
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not stage line.' });
  }
});

journalRouter.get('/staging/:reference/:business/:ledger', (req, res) => {
  res.json(getStagedLines(req.params.reference, asBusinessName(req.params.business), asLedgerName(req.params.ledger)));
});

journalRouter.delete('/staging/:reference/:business/:ledger/:account', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  removeStagedLine(req.params.reference, asBusinessName(req.params.business), asLedgerName(req.params.ledger), asAccountName(req.params.account));
  res.status(204).end();
});

const postSchema = z.object({
  reference: z.string().min(1),
  business: z.string().min(1),
  ledger: z.string().min(1),
});

journalRouter.post('/post', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = postSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (!canPostToLedger(req, parsed.data.business, parsed.data.ledger)) {
    return res.status(403).json({ error: NOT_ACTIVE_LEDGER_ERROR(parsed.data.ledger) });
  }
  try {
    postJournalEntry(parsed.data.reference, asBusinessName(parsed.data.business), asLedgerName(parsed.data.ledger), asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof PostingError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not post entry.' });
  }
});

const recurringJournalSchema = z.object({
  business: z.string().min(1),
  ledger: z.string().min(1),
  reference: z.string().min(1),
  startDate: z.string().min(1),
  recurrence: z.enum(['once', 'weekly', 'monthly', 'yearly']),
  description: z.string().optional(),
  recurrenceCount: z.number().int().positive().nullable().optional(),
  lines: z
    .array(
      z.object({
        account: z.string().min(1),
        amount_minor: z.number().int(),
        memo: z.string().optional(),
        effective_date: z.string().optional(),
      })
    )
    .min(2, 'An entry needs at least two lines.'),
});

journalRouter.post('/recurring', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = recurringJournalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    createRecurringJournal(
      asBusinessName(parsed.data.business),
      asLedgerName(parsed.data.ledger),
      parsed.data.reference,
      parsed.data.startDate,
      parsed.data.recurrence,
      parsed.data.lines,
      asUserId(req.user!.id),
      parsed.data.description,
      parsed.data.recurrenceCount ?? undefined
    );
    res.status(204).end();
  } catch (err) {
    if (err instanceof PostingError || err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not create recurring entry.' });
  }
});

const reverseSchema = z.object({
  business: z.string().min(1),
  ledger: z.string().min(1),
  reversalDate: z.string().optional(),
});

journalRouter.post('/:id/:date/reverse', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = reverseSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    reverseJournalEntry(asBusinessName(parsed.data.business), asLedgerName(parsed.data.ledger), Number(req.params.id), req.params.date, asUserId(req.user!.id), parsed.data.reversalDate);
    res.status(204).end();
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    if (err instanceof PostingError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not reverse entry.' });
  }
});

const closeBooksSchema = z.object({
  business: z.string().min(1),
  ledger: z.string().min(1),
  asOfDate: z.string().min(1),
  retainedEarningsAccount: z.string().min(1),
});
const previewCloseBooksSchema = z.object({
  business: z.string().min(1),
  ledger: z.string().min(1),
  asOfDate: z.string().min(1),
  retainedEarningsAccount: z.string().min(1),
});
journalRouter.post('/preview-close-books', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = previewCloseBooksSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const preview = previewCloseBooks(asBusinessName(parsed.data.business), asLedgerName(parsed.data.ledger), parsed.data.asOfDate, parsed.data.retainedEarningsAccount);
    res.json(preview);
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not preview the close.' });
  }
});
journalRouter.post('/close-books', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = closeBooksSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const result = closeBooks(asBusinessName(parsed.data.business), asLedgerName(parsed.data.ledger), parsed.data.asOfDate, parsed.data.retainedEarningsAccount, asUserId(req.user!.id));
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not close books.' });
  }
});
const createLedgerSchema = z.object({
  business: z.string().min(1),
  ledger: z.string().min(1),
});
journalRouter.post('/create-ledger', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = createLedgerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    createLedger(asBusinessName(parsed.data.business), asLedgerName(parsed.data.ledger), asUserId(req.user!.id));
    res.status(201).json({ ledger: parsed.data.ledger });
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not create the new ledger.' });
  }
});
const rolloverSchema = z.object({
  business: z.string().min(1),
  oldLedger: z.string().min(1),
  newLedger: z.string().min(1),
  asOfDate: z.string().min(1),
});
journalRouter.post('/rollover-to-new-period', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = rolloverSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const result = rolloverToNewPeriod(
      asBusinessName(parsed.data.business),
      asLedgerName(parsed.data.oldLedger),
      asLedgerName(parsed.data.newLedger),
      parsed.data.asOfDate,
      asUserId(req.user!.id)
    );
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not roll over to the new period.' });
  }
});

// Per the canned-journal-to-frontend migration's Phase 2 (see
// docs/canned-journal-to-frontend-design.md): the genuinely stateful
// half of rollover (creating each carried-forward account's own node
// under the new ledger) stays here, server-side; the frontend then
// posts the returned, already-computed opening-balance lines itself
// via the exact, same generic /journal/staging + /journal/post calls
// every other canned screen already uses — the same split already
// proven safe for Close Books (previewCloseBooks / computeCloseLines).
journalRouter.post('/resolve-rollover-lines', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = rolloverSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const resolved = resolveRolloverLines(
      asBusinessName(parsed.data.business),
      asLedgerName(parsed.data.oldLedger),
      asLedgerName(parsed.data.newLedger),
      parsed.data.asOfDate,
      asUserId(req.user!.id)
    );
    res.json(resolved);
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not resolve the rollover lines.' });
  }
});
