import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth-middleware.js';
import { registerCustomer, listPendingCustomers, verifyCustomer, authenticateCustomer, asUserId, ValidationError } from '../db.js';

// Public — a customer typing their own details at a self-service
// terminal has no staff login at all yet.
export const customerRegistrationRouter = Router();

const registrationSchema = z.object({
  name: z.string().min(1),
  email: z.string().min(1),
  phone: z.string().nullable().optional(),
  address_line1: z.string().nullable().optional(),
  address_line2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  preferred_language: z.string().nullable().optional(),
  password: z.string().min(1),
  card_label: z.string().nullable().optional(),
});

customerRegistrationRouter.post('/register', (req, res) => {
  const parsed = registrationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    registerCustomer(parsed.data, asUserId(1)); // registered by the system itself, via the self-service terminal
    res.status(201).json({ status: 'pending' });
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not register.' });
  }
});

const loginSchema = z.object({ name: z.string().min(1), password: z.string().min(1) });
customerRegistrationRouter.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const ok = authenticateCustomer(parsed.data.name, parsed.data.password);
  if (!ok) return res.status(401).json({ error: 'Incorrect name or password.' });
  res.status(204).end();
});

// Staff-only — the verification queue.
export const customerVerificationRouter = Router();

customerVerificationRouter.get('/pending', requireRole('Administrator', 'Bookkeeper'), (_req, res) => {
  res.json(listPendingCustomers());
});

const verifySchema = z.object({ approve: z.boolean() });
customerVerificationRouter.post('/:name/verify', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    verifyCustomer(req.params.name, parsed.data.approve);
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not verify.' });
  }
});
