import { Router } from 'express';
import { z } from 'zod';
import { clockInToProject, clockOutOfProject, getOpenProjectClockForEmployee, asBusinessName, asLedgerName, asEmployeeName, asAccountName, ValidationError,
  asUserId,
} from '../db.js';

export const projectsRouter = Router();

const clockInSchema = z.object({
  employeeName: z.string().min(1),
  projectExpenseAccount: z.string().min(1),
  business: z.string().min(1),
  ledger: z.string().min(1),
});

projectsRouter.post('/clock-in', (req, res) => {
  const parsed = clockInSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const result = clockInToProject(
      asEmployeeName(parsed.data.employeeName),
      asAccountName(parsed.data.projectExpenseAccount),
      asBusinessName(parsed.data.business),
      asLedgerName(parsed.data.ledger),
      asUserId(req.user!.id)
    );
    res.json(result);
  } catch (e) {
    if (e instanceof ValidationError) return res.status(400).json({ error: e.message });
    throw e;
  }
});

const clockOutSchema = z.object({
  employeeName: z.string().min(1),
  business: z.string().min(1),
  ledger: z.string().min(1),
});

projectsRouter.post('/clock-out', (req, res) => {
  const parsed = clockOutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    clockOutOfProject(asEmployeeName(parsed.data.employeeName), asBusinessName(parsed.data.business), asLedgerName(parsed.data.ledger), asUserId(req.user!.id));
    res.status(204).end();
  } catch (e) {
    if (e instanceof ValidationError) return res.status(400).json({ error: e.message });
    throw e;
  }
});

projectsRouter.get('/open-clock', (req, res) => {
  const employeeName = req.query.employeeName as string;
  if (!employeeName) return res.status(400).json({ error: 'employeeName is required' });
  const result = getOpenProjectClockForEmployee(asEmployeeName(employeeName));
  res.json(result ?? null);
});
