// Converted from routes/departments.ts. The frontend calls the create
// function `createDepartment` (api.ts) even though the real backing
// function is `createAndConfigureDepartment` (db.ts) — this entry is
// keyed by the frontend's own call name, same as 'Create Business' was
// keyed by its screen name rather than any literal db.ts function name.
import { createAndConfigureDepartment, deleteDepartment, listDepartments, getOrgChartStructure, setEmployeeDepartment, deleteEmployeeDepartment, setEmployeeManager, deleteEmployeeManager, asBusinessName, asUserId, ValidationError, NotFoundError } from '../db.js';
import { CallError, requireAuth, requireRole, row, table, type BackendCall } from '../call-dispatch.js';

export const departmentsFunctions: Record<string, BackendCall> = {
  // Positional args: [0] business. No role gate in the old route (just
  // requireAuth on the whole mount) - replicated here as requireAuth only.
  listDepartments: (v, user) => {
    requireAuth(user);
    const [business] = v;
    if (!business) throw new CallError(400, 'business is required.');
    return table(['id', 'name'], listDepartments(asBusinessName(business)).map((d) => ({ id: String(d.id), name: d.name })));
  },
  // Positional args: [0] business, [1] name.
  createDepartment: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, name] = v;
    if (!business || !name) throw new CallError(400, 'business and name are both required.');
    try {
      const entity = createAndConfigureDepartment(asBusinessName(business), name, asUserId(admin.id));
      return row(entity.id, entity.name);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] name, [1] business.
  deleteDepartment: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [name, business] = v;
    if (!name || !business) throw new CallError(400, 'name and business are both required.');
    try {
      deleteDepartment(asBusinessName(business), name, asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      throw err;
    }
  },
  // Positional args: [0] business.
  // Table columns: section ('department'|'unassigned'), department,
  // employeeName, location, managerName. A department with zero
  // employees still needs to survive the round trip as a known
  // department (the org chart renders an empty box for it) - carried as
  // one row with employeeName='' (a real employee name is never the
  // empty string, confirmed by createEmployee's own validation).
  // Zero unassigned employees need no placeholder row - "unassigned" is
  // a derived grouping, not a named thing the frontend needs to remember
  // across an empty list. OrgChartStructure.business is dropped entirely
  // - confirmed via grep that the frontend never reads it back (it
  // already knows which business it asked about).
  // No role gate in the old route (just requireAuth on the whole mount).
  getOrgChartStructure: (v, user) => {
    requireAuth(user);
    const [business] = v;
    if (!business) throw new CallError(400, 'business is required.');
    const structure = getOrgChartStructure(asBusinessName(business));
    const rows: { section: string; department: string; employeeName: string; location: string; managerName: string }[] = [];
    for (const d of structure.departments) {
      if (d.employees.length === 0) {
        rows.push({ section: 'department', department: d.name, employeeName: '', location: '', managerName: '' });
      } else {
        for (const e of d.employees) rows.push({ section: 'department', department: d.name, employeeName: e.name, location: e.location ?? '', managerName: e.managerName ?? '' });
      }
    }
    for (const e of structure.unassignedEmployees) rows.push({ section: 'unassigned', department: '', employeeName: e.name, location: e.location ?? '', managerName: e.managerName ?? '' });
    return table(['section', 'department', 'employeeName', 'location', 'managerName'], rows);
  },
  // Positional args: [0] employeeName, [1] departmentName.
  setEmployeeDepartment: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [employeeName, departmentName] = v;
    if (!employeeName || !departmentName) throw new CallError(400, 'employeeName and departmentName are both required.');
    try {
      setEmployeeDepartment(employeeName, departmentName, asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] employeeName.
  deleteEmployeeDepartment: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [employeeName] = v;
    if (!employeeName) throw new CallError(400, 'employeeName is required.');
    try {
      deleteEmployeeDepartment(employeeName, asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] employeeName, [1] managerName.
  setEmployeeManager: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [employeeName, managerName] = v;
    if (!employeeName || !managerName) throw new CallError(400, 'employeeName and managerName are both required.');
    try {
      setEmployeeManager(employeeName, managerName, asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] employeeName.
  deleteEmployeeManager: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [employeeName] = v;
    if (!employeeName) throw new CallError(400, 'employeeName is required.');
    try {
      deleteEmployeeManager(employeeName, asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
};
