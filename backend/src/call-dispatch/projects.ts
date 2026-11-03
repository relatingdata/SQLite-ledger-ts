// Converted from routes/projects.ts.
import { asBusinessName, asLedgerName, asEmployeeName, asAccountName, ValidationError, asUserId } from '../db.js';
import { clockInToProject, clockOutOfProject, getOpenProjectClockForEmployee } from '../db-journal.js';
import { CallError, requireAuth, row, type BackendCall } from '../call-dispatch.js';

export const projectsFunctions: Record<string, BackendCall> = {
  // Positional args: [0] employeeName, [1] projectExpenseAccount, [2] business, [3] ledger.
  clockInToProject: (v, user) => {
    const u = requireAuth(user);
    const [employeeName, projectExpenseAccount, business, ledger] = v;
    if (!employeeName || !projectExpenseAccount || !business || !ledger) throw new CallError(400, 'employeeName, projectExpenseAccount, business and ledger are all required.');
    try {
      const result = clockInToProject(asEmployeeName(employeeName), asAccountName(projectExpenseAccount), asBusinessName(business), asLedgerName(ledger), asUserId(u.id));
      return row(result.employee, result.po_reference, result.project_expense_account, result.clocked_in_at);
    } catch (e) {
      if (e instanceof ValidationError) throw new CallError(400, e.message);
      throw e;
    }
  },
  // Positional args: [0] employeeName, [1] business, [2] ledger.
  clockOutOfProject: (v, user) => {
    const u = requireAuth(user);
    const [employeeName, business, ledger] = v;
    if (!employeeName || !business || !ledger) throw new CallError(400, 'employeeName, business and ledger are all required.');
    try {
      clockOutOfProject(asEmployeeName(employeeName), asBusinessName(business), asLedgerName(ledger), asUserId(u.id));
      return row();
    } catch (e) {
      if (e instanceof ValidationError) throw new CallError(400, e.message);
      throw e;
    }
  },
  // Positional args: [0] employeeName. Empty row (all '') means "no open clock" - distinguished
  // from a real clock by an empty employee field, which a real clock can never have.
  getOpenProjectClock: (v, user) => {
    requireAuth(user);
    const [employeeName] = v;
    if (!employeeName) throw new CallError(400, 'employeeName is required');
    const result = getOpenProjectClockForEmployee(asEmployeeName(employeeName));
    if (!result) return row();
    return row(result.employee, result.po_reference, result.project_expense_account, result.clocked_in_at);
  },
};
