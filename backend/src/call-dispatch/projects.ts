// Converted from routes/projects.ts, plus (new, not converted from any
// old route) the Live Project/Milestone/scheduling-engine functions for
// the Project Builder tutorial — db-projects.ts.
import { asBusinessName, asLedgerName, asEmployeeName, asAccountName, ValidationError, NotFoundError, asUserId } from '../db.js';
import { clockInToProject, clockOutOfProject, getOpenProjectClockForEmployee } from '../db-journal.js';
import {
  createLiveProject,
  getLiveProject,
  listLiveProjects,
  createMilestone,
  getMilestones,
  getResourceBookings,
  scheduleProjectRecipeLines,
  checkMilestoneAchievability,
  provisionProjectProfitCenter,
  getProjectCostReport,
  type MilestoneType,
} from '../db-projects.js';
import { CallError, requireAuth, requireRole, row, table, type BackendCall } from '../call-dispatch.js';

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
  // Positional args: [0] name, [1] business, [2] client, [3] requestedStart, [4] targetCompletionDate.
  createLiveProject: (v, user) => {
    const u = requireRole(user, 'Administrator', 'Bookkeeper');
    const [name, business, client, requestedStart, targetCompletionDate] = v;
    if (!name || !business || !client || !requestedStart || !targetCompletionDate) {
      throw new CallError(400, 'name, business, client, requestedStart and targetCompletionDate are all required.');
    }
    try {
      createLiveProject(name, asBusinessName(business), client, requestedStart, targetCompletionDate, asUserId(u.id));
      return row();
    } catch (e) {
      if (e instanceof ValidationError) throw new CallError(400, e.message);
      throw e;
    }
  },
  // Positional args: [0] name. Empty row means "no such Live Project".
  getLiveProject: (v, user) => {
    requireAuth(user);
    const [name] = v;
    if (!name) throw new CallError(400, 'name is required.');
    const project = getLiveProject(name);
    if (!project) return row();
    return row(project.name, project.client, project.requestedStart, project.targetCompletionDate, project.scheduleRisk ?? '', project.profitCenter ?? '', project.projectExpenseAccount ?? '');
  },
  // Positional args: [0] projectName, [1] business. Provisions a real,
  // dedicated Profit Center + Expense account for this project — called
  // automatically by acceptQuotation when a Project Proposal has lines,
  // exposed here too for a project created directly (e.g. by the
  // Project Builder tutorial's own seed steps, not via a Proposal).
  provisionProjectProfitCenter: (v, user) => {
    const u = requireRole(user, 'Administrator', 'Bookkeeper');
    const [projectName, business] = v;
    if (!projectName || !business) throw new CallError(400, 'projectName and business are both required.');
    try {
      const result = provisionProjectProfitCenter(projectName, asBusinessName(business), asUserId(u.id));
      return row(result.profitCenterName, result.expenseAccountName);
    } catch (e) {
      if (e instanceof ValidationError) throw new CallError(409, e.message);
      throw e;
    }
  },
  // Positional args: [0] projectName. The real, quoted-vs-actual margin —
  // quoted from the Recipe lines' own priceMinor, actual from the real,
  // live balance of the project's own Profit-Center-scoped Expense
  // account (Stage 5).
  getProjectCostReport: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [projectName] = v;
    if (!projectName) throw new CallError(400, 'projectName is required.');
    try {
      const report = getProjectCostReport(projectName);
      return row(String(report.quotedTotalMinor), String(report.actualCostMinor), String(report.marginMinor));
    } catch (e) {
      if (e instanceof ValidationError) throw new CallError(404, e.message);
      throw e;
    }
  },
  // Positional args: [0] business.
  listLiveProjects: (v, user) => {
    requireAuth(user);
    const [business] = v;
    if (!business) throw new CallError(400, 'business is required.');
    return table(['name'], listLiveProjects(asBusinessName(business)).map((name) => ({ name })));
  },
  // Positional args: [0] projectName, [1] milestoneType ('Plans Submission'|'Inspection'|'Invoicing'),
  // [2] dueDate, [3] label?.
  createMilestone: (v, user) => {
    const u = requireRole(user, 'Administrator', 'Bookkeeper');
    const [projectName, milestoneTypeRaw, dueDate, label] = v;
    if (!projectName || !milestoneTypeRaw || !dueDate) throw new CallError(400, 'projectName, milestoneType and dueDate are all required.');
    if (milestoneTypeRaw !== 'Plans Submission' && milestoneTypeRaw !== 'Inspection' && milestoneTypeRaw !== 'Invoicing') {
      throw new CallError(400, `milestoneType must be "Plans Submission", "Inspection" or "Invoicing" — got "${milestoneTypeRaw}".`);
    }
    try {
      createMilestone(projectName, milestoneTypeRaw as MilestoneType, dueDate, asUserId(u.id), label || undefined);
      return row();
    } catch (e) {
      if (e instanceof ValidationError) throw new CallError(400, e.message);
      throw e;
    }
  },
  // Positional args: [0] projectName.
  getMilestones: (v, user) => {
    requireAuth(user);
    const [projectName] = v;
    if (!projectName) throw new CallError(400, 'projectName is required.');
    return table(['name', 'milestoneType', 'dueDate', 'scheduleRisk'], getMilestones(projectName).map((m) => ({ ...m, scheduleRisk: m.scheduleRisk ?? '' })));
  },
  // Positional args: [0] resourceName, [1] business, [2] excludeProject?.
  getResourceBookings: (v, user) => {
    requireAuth(user);
    const [resourceName, business, excludeProject] = v;
    if (!resourceName || !business) throw new CallError(400, 'resourceName and business are both required.');
    return table(['project', 'start', 'end'], getResourceBookings(resourceName, asBusinessName(business), excludeProject || undefined));
  },
  // Positional args: [0] projectName, [1] business. Resolves every real
  // Labour/Plant line's desired window into its actual, contention-
  // checked one (never blocking — pushing forward on a real conflict),
  // then flags (never blocks) a real Schedule Risk if the resulting
  // completion date now falls after the client's own wanted date.
  scheduleProjectRecipeLines: (v, user) => {
    const u = requireRole(user, 'Administrator', 'Bookkeeper');
    const [projectName, business] = v;
    if (!projectName || !business) throw new CallError(400, 'projectName and business are both required.');
    try {
      const lines = scheduleProjectRecipeLines(projectName, asBusinessName(business), asUserId(u.id));
      const achievability = checkMilestoneAchievability(projectName, asUserId(u.id));
      return table(
        ['component', 'kind', 'scheduledStart', 'scheduledEnd', 'pushedOut', 'conflictingProject', 'achievable', 'completionDate', 'targetCompletionDate'],
        lines.map((l) => ({
          component: l.component,
          kind: l.kind,
          scheduledStart: l.scheduledStart ?? '',
          scheduledEnd: l.scheduledEnd ?? '',
          pushedOut: String(l.pushedOut),
          conflictingProject: l.conflictingProject ?? '',
          achievable: String(achievability.achievable),
          completionDate: achievability.completionDate,
          targetCompletionDate: achievability.targetCompletionDate,
        }))
      );
    } catch (e) {
      if (e instanceof ValidationError || e instanceof NotFoundError) throw new CallError(400, e.message);
      throw e;
    }
  },
};
