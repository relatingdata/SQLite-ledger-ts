// Converted from routes/period.ts.
import { asBusinessName, asLedgerName, asUserId } from '../db.js';
import { getPeriodLockStatus, closePeriod, reopenPeriod } from '../db-journal.js';
import { CallError, requireRole, row, type BackendCall } from '../call-dispatch.js';

export const periodFunctions: Record<string, BackendCall> = {
  // Positional args: [0] business, [1] ledger.
  getPeriodStatus: (v) => {
    const [business, ledger] = v;
    if (!business || !ledger) throw new CallError(400, 'business and ledger are both required.');
    const status = getPeriodLockStatus(asBusinessName(business), asLedgerName(ledger));
    return row(status.locked_through_date, status.changed_by, status.changed_at);
  },
  // Positional args: [0] business, [1] ledger, [2] throughDate. Administrator
  // only - closing/reopening a period controls what everyone else can post.
  closePeriod: (v, user) => {
    const admin = requireRole(user, 'Administrator');
    const [business, ledger, throughDate] = v;
    if (!business || !ledger || !throughDate) throw new CallError(400, 'business, ledger and throughDate are all required.');
    closePeriod(asBusinessName(business), asLedgerName(ledger), throughDate, asUserId(admin.id));
    return row();
  },
  reopenPeriod: (v, user) => {
    const admin = requireRole(user, 'Administrator');
    const [business, ledger] = v;
    if (!business || !ledger) throw new CallError(400, 'business and ledger are both required.');
    reopenPeriod(asBusinessName(business), asLedgerName(ledger), asUserId(admin.id));
    return row();
  },
};
