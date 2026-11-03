// Converted from routes/journal.ts. Mounted (old route) with requireAuth
// for the whole router; POST/DELETE further require Administrator or
// Bookkeeper, replicated per-function here. canPostToLedger (the one,
// real enforcement point for "one active ledger per business, but the
// old one stays postable for real corrections") is replicated exactly
// as the old route's own local helper did it.
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
import { canUserPostToLedger, type AuthenticatedUser } from '../auth.js';
import { CallError, decodeStringList, encodeRecordList, requireAuth, requireRole, row, table, type BackendCall } from '../call-dispatch.js';

const NOT_ACTIVE_LEDGER_ERROR = (ledger: string) =>
  `"${ledger}" is not this business's current active ledger — posting there requires Administrator, Accountant, or this business's own Business Admin.`;

function requirePostableLedger(user: AuthenticatedUser, business: string, ledger: string): void {
  if (!canUserPostToLedger(asBusinessName(business), asLedgerName(ledger), user)) {
    throw new CallError(403, NOT_ACTIVE_LEDGER_ERROR(ledger));
  }
}

export const journalFunctions: Record<string, BackendCall> = {
  // Positional args: [0] business, [1] ledger, [2] limit, [3] offset.
  // {rows, totalCount} uses the denormalized-totals+sentinel-row pattern
  // (reference is never empty) — same technique as items.ts's listItems.
  listJournalEntries: (v, user) => {
    requireAuth(user);
    const [business, ledger, limitRaw, offsetRaw] = v;
    if (!business || !ledger) throw new CallError(400, 'business and ledger are required.');
    const limit = limitRaw ? Number(limitRaw) : 100;
    const offset = offsetRaw ? Number(offsetRaw) : 0;
    const rows = listJournalEntries(asBusinessName(business), asLedgerName(ledger), limit, offset);
    const totalCount = String(countJournalEntries(asBusinessName(business), asLedgerName(ledger)));
    interface JournalEntryRow {
      journal_id: string;
      occurrence_date: string;
      reference: string;
      description: string;
      business: string;
      ledger: string;
      recurrence: string;
      posted_by: string;
      total_debit_minor: string;
      total_credit_minor: string;
      currency: string;
      totalCount: string;
    }
    const header: (keyof JournalEntryRow)[] = ['journal_id', 'occurrence_date', 'reference', 'description', 'business', 'ledger', 'recurrence', 'posted_by', 'total_debit_minor', 'total_credit_minor', 'currency', 'totalCount'];
    if (rows.length === 0) {
      return table<JournalEntryRow>(header, [{ journal_id: '', occurrence_date: '', reference: '', description: '', business: '', ledger: '', recurrence: '', posted_by: '', total_debit_minor: '', total_credit_minor: '', currency: '', totalCount }]);
    }
    return table<JournalEntryRow>(
      header,
      rows.map((r) => ({
        journal_id: String(r.journal_id),
        occurrence_date: r.occurrence_date ?? '',
        reference: r.reference,
        description: r.description,
        business: r.business,
        ledger: r.ledger,
        recurrence: r.recurrence,
        posted_by: r.posted_by,
        total_debit_minor: String(r.total_debit_minor),
        total_credit_minor: String(r.total_credit_minor),
        currency: r.currency ?? '',
        totalCount,
      }))
    );
  },
  // Positional args: [0] business, [1] ledger, [2] journalId, [3] date.
  // Row: header fields, then lines encoded via encodeRecordList.
  getJournalEntry: (v, user) => {
    requireAuth(user);
    const [business, ledger, journalIdRaw, date] = v;
    if (!business || !ledger || !journalIdRaw || !date) throw new CallError(400, 'business, ledger, journalId and date are all required.');
    const entry = getJournalEntry(asBusinessName(business), asLedgerName(ledger), Number(journalIdRaw), date);
    if (!entry) throw new CallError(404, 'Not found.');
    return row(
      entry.journal_id,
      entry.occurrence_date,
      entry.reference,
      entry.description,
      entry.business,
      entry.ledger,
      entry.recurrence,
      entry.posted_by,
      entry.total_debit_minor,
      entry.total_credit_minor,
      entry.currency,
      encodeRecordList(['account', 'accountnumber', 'amount_minor', 'memo'], entry.lines)
    );
  },
  // Positional args: [0] reference, [1] business, [2] ledger, [3] description,
  // [4] transdate, [5] account, [6] accountId, [7] amount_minor, [8] memo.
  stageLine: (v, user) => {
    const u = requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference, business, ledger, description, transdate, account, accountIdRaw, amountMinorRaw, memo] = v;
    if (!reference || !business || !ledger || !account || !amountMinorRaw) {
      throw new CallError(400, 'reference, business, ledger, account and amount_minor are all required.');
    }
    requirePostableLedger(u, business, ledger);
    try {
      stageLine({
        reference,
        business: asBusinessName(business),
        ledger: asLedgerName(ledger),
        description: description || undefined,
        transdate: transdate || undefined,
        account: asAccountName(account),
        accountId: accountIdRaw ? Number(accountIdRaw) : undefined,
        amount_minor: Number(amountMinorRaw),
        memo: memo || undefined,
      });
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] reference, [1] business, [2] ledger. No live
  // frontend caller (already commented out as unused in api.ts) — built
  // anyway for a complete backend surface.
  getStagedLines: (v, user) => {
    requireAuth(user);
    const [reference, business, ledger] = v;
    if (!reference || !business || !ledger) throw new CallError(400, 'reference, business and ledger are all required.');
    return table(['reference', 'business', 'ledger', 'description', 'transdate', 'account', 'amount_minor', 'memo', 'bankReference'], getStagedLines(reference, asBusinessName(business), asLedgerName(ledger)));
  },
  // Positional args: [0] reference, [1] business, [2] ledger, [3] account.
  // No live frontend caller.
  removeStagedLine: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference, business, ledger, account] = v;
    if (!reference || !business || !ledger || !account) throw new CallError(400, 'reference, business, ledger and account are all required.');
    removeStagedLine(reference, asBusinessName(business), asLedgerName(ledger), asAccountName(account));
    return row();
  },
  // Positional args: [0] reference, [1] business, [2] ledger.
  postJournalEntry: (v, user) => {
    const u = requireRole(user, 'Administrator', 'Bookkeeper');
    const [reference, business, ledger] = v;
    if (!reference || !business || !ledger) throw new CallError(400, 'reference, business and ledger are all required.');
    requirePostableLedger(u, business, ledger);
    try {
      postJournalEntry(reference, asBusinessName(business), asLedgerName(ledger), asUserId(u.id));
      return row();
    } catch (err) {
      if (err instanceof PostingError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional scalar args: [0] business, [1] ledger, [2] reference,
  // [3] startDate, [4] recurrence, [5] description, [6] recurrenceCount.
  // lineItems: each row is one real journal line — [account, amount_minor,
  // memo, effective_date] — the genuine, caller-variable-length array
  // this function's real input has (an entry needs at least two lines),
  // same lineItems protocol extension as pos.ts's completePosSale.
  createRecurringJournal: (v, user, lineItems) => {
    const u = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, ledger, reference, startDate, recurrence, description, recurrenceCountRaw] = v;
    if (!business || !ledger || !reference || !startDate) throw new CallError(400, 'business, ledger, reference and startDate are all required.');
    if (recurrence !== 'once' && recurrence !== 'weekly' && recurrence !== 'monthly' && recurrence !== 'yearly') {
      throw new CallError(400, 'recurrence must be once, weekly, monthly or yearly.');
    }
    if (lineItems.length < 2) throw new CallError(400, 'An entry needs at least two lines.');
    const lines = lineItems.map(([account, amountMinorRaw, memo, effective_date]) => {
      if (!account || !amountMinorRaw) throw new CallError(400, 'Every line needs an account and an amount_minor.');
      return { account, amount_minor: Number(amountMinorRaw), memo: memo || undefined, effective_date: effective_date || undefined };
    });
    try {
      createRecurringJournal(
        asBusinessName(business),
        asLedgerName(ledger),
        reference,
        startDate,
        recurrence,
        lines,
        asUserId(u.id),
        description || undefined,
        recurrenceCountRaw ? Number(recurrenceCountRaw) : undefined
      );
      return row();
    } catch (err) {
      if (err instanceof PostingError || err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] business, [1] ledger, [2] journalId, [3] date,
  // [4] reversalDate.
  reverseJournalEntry: (v, user) => {
    const u = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, ledger, journalIdRaw, date, reversalDate] = v;
    if (!business || !ledger || !journalIdRaw || !date) throw new CallError(400, 'business, ledger, journalId and date are all required.');
    try {
      reverseJournalEntry(asBusinessName(business), asLedgerName(ledger), Number(journalIdRaw), date, asUserId(u.id), reversalDate || undefined);
      return row();
    } catch (err) {
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      if (err instanceof PostingError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] business, [1] ledger, [2] asOfDate,
  // [3] retainedEarningsAccount, [4] hierarchyPath (encodeStringList-encoded).
  // Row: lines (encodeRecordList), netIncomeMinor, accountsZeroed,
  // groupBreakdown (encodeRecordList), profitCenterBreakdown (encodeRecordList).
  previewCloseBooks: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, ledger, asOfDate, retainedEarningsAccount, hierarchyPathEncoded] = v;
    if (!business || !ledger || !asOfDate || !retainedEarningsAccount) throw new CallError(400, 'business, ledger, asOfDate and retainedEarningsAccount are all required.');
    try {
      const preview = previewCloseBooks(asBusinessName(business), asLedgerName(ledger), asOfDate, retainedEarningsAccount, hierarchyPathEncoded ? decodeStringList(hierarchyPathEncoded) : []);
      return row(
        encodeRecordList(['account', 'accountId', 'amount_minor'], preview.lines),
        preview.netIncomeMinor,
        preview.accountsZeroed,
        encodeRecordList(['group', 'netIncomeMinor'], preview.groupBreakdown),
        encodeRecordList(['profitCenter', 'netIncomeMinor'], preview.profitCenterBreakdown)
      );
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: same as previewCloseBooks. Row: reference,
  // netIncomeMinor, accountsZeroed, groupBreakdown, profitCenterBreakdown.
  closeBooks: (v, user) => {
    const u = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, ledger, asOfDate, retainedEarningsAccount, hierarchyPathEncoded] = v;
    if (!business || !ledger || !asOfDate || !retainedEarningsAccount) throw new CallError(400, 'business, ledger, asOfDate and retainedEarningsAccount are all required.');
    try {
      const result = closeBooks(asBusinessName(business), asLedgerName(ledger), asOfDate, retainedEarningsAccount, asUserId(u.id), hierarchyPathEncoded ? decodeStringList(hierarchyPathEncoded) : []);
      return row(
        result.reference,
        result.netIncomeMinor,
        result.accountsZeroed,
        encodeRecordList(['group', 'netIncomeMinor'], result.groupBreakdown),
        encodeRecordList(['profitCenter', 'netIncomeMinor'], result.profitCenterBreakdown)
      );
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] business, [1] ledger.
  createLedger: (v, user) => {
    const u = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, ledger] = v;
    if (!business || !ledger) throw new CallError(400, 'business and ledger are both required.');
    try {
      createLedger(asBusinessName(business), asLedgerName(ledger), asUserId(u.id));
      return row(ledger);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] business, [1] oldLedger, [2] newLedger,
  // [3] asOfDate. No live frontend caller — superseded by
  // resolveRolloverLines + the generic stageLine/postJournalEntry pair
  // (see the canned-journal-to-frontend Phase 2 comment in the old
  // route), but built anyway for a complete backend surface.
  rolloverToNewPeriod: (v, user) => {
    const u = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, oldLedger, newLedger, asOfDate] = v;
    if (!business || !oldLedger || !newLedger || !asOfDate) throw new CallError(400, 'business, oldLedger, newLedger and asOfDate are all required.');
    try {
      const result = rolloverToNewPeriod(asBusinessName(business), asLedgerName(oldLedger), asLedgerName(newLedger), asOfDate, asUserId(u.id));
      return row(result.newLedger, result.accountsCarriedForward, result.openingBalanceReference);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] business, [1] oldLedger, [2] newLedger,
  // [3] asOfDate. Row: reference, lines (encodeRecordList), accountsCarriedForward.
  resolveRolloverLines: (v, user) => {
    const u = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, oldLedger, newLedger, asOfDate] = v;
    if (!business || !oldLedger || !newLedger || !asOfDate) throw new CallError(400, 'business, oldLedger, newLedger and asOfDate are all required.');
    try {
      const resolved = resolveRolloverLines(asBusinessName(business), asLedgerName(oldLedger), asLedgerName(newLedger), asOfDate, asUserId(u.id));
      return row(resolved.reference, encodeRecordList(['account', 'amount_minor'], resolved.lines), resolved.accountsCarriedForward);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
};

