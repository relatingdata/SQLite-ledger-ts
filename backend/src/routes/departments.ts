// Department CRUD, plus Employee ↔ Department and Employee ↔ Manager
// assignment — see /root/.claude/plans/stateful-snacking-adleman.md.
// Mirrors backend/src/routes/locations.ts's own conventions (Zod-
// validated body/query, ValidationError → 409, NotFoundError → 404,
// 204 with no body for "nothing to return" — a 201 with an empty body
// is a real, previously-confirmed bug in this codebase; see
// locations.ts's own POST /:name comment).
import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth-middleware.js';
import {
  createAndConfigureDepartment,
  deleteDepartment,
  listDepartments,
  getOrgChartStructure,
  setEmployeeDepartment,
  deleteEmployeeDepartment,
  setEmployeeManager,
  deleteEmployeeManager,
  asBusinessName,
  asUserId,
  ValidationError,
  NotFoundError,
} from '../db.js';

export const departmentsRouter = Router();

function requireBusinessQuery(req: { query: Record<string, unknown> }): string | undefined {
  const business = req.query.business;
  return typeof business === 'string' && business.length > 0 ? business : undefined;
}

departmentsRouter.get('/', (req, res) => {
  const business = requireBusinessQuery(req);
  if (!business) return res.status(400).json({ error: 'business query parameter is required.' });
  res.json(listDepartments(asBusinessName(business)));
});

departmentsRouter.get('/org-chart', (req, res) => {
  const business = requireBusinessQuery(req);
  if (!business) return res.status(400).json({ error: 'business query parameter is required.' });
  res.json(getOrgChartStructure(asBusinessName(business)));
});

const createDepartmentSchema = z.object({ business: z.string().min(1), name: z.string().min(1) });
departmentsRouter.post('/', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = createDepartmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const entity = createAndConfigureDepartment(asBusinessName(parsed.data.business), parsed.data.name, asUserId(req.user!.id));
    res.status(201).json(entity);
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not create department.' });
  }
});

departmentsRouter.delete('/:name', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const business = requireBusinessQuery(req);
  if (!business) return res.status(400).json({ error: 'business query parameter is required.' });
  try {
    deleteDepartment(asBusinessName(business), req.params.name, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not delete department.' });
  }
});

const setDepartmentSchema = z.object({ departmentName: z.string().min(1) });
const setManagerSchema = z.object({ managerName: z.string().min(1) });

departmentsRouter.put('/employees/:employeeName/department', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = setDepartmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    setEmployeeDepartment(req.params.employeeName, parsed.data.departmentName, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not assign that department.' });
  }
});

departmentsRouter.delete('/employees/:employeeName/department', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  try {
    deleteEmployeeDepartment(req.params.employeeName, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not remove that department assignment.' });
  }
});

departmentsRouter.put('/employees/:employeeName/manager', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = setManagerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    setEmployeeManager(req.params.employeeName, parsed.data.managerName, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not assign that manager.' });
  }
});

departmentsRouter.delete('/employees/:employeeName/manager', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  try {
    deleteEmployeeManager(req.params.employeeName, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not remove that manager assignment.' });
  }
});
