import { Router } from 'express';
import { z } from 'zod';
import {
  login,
  logout,
  listUsers,
  listRoles,
  createUser,
  setUserRoles,
  setUserActive,
  changePassword,
  changeOwnPassword,
  setOwnPageSize,
  setOwnNumberFormat,
  setOwnDateFormat,
  setSessionBusiness,
  setSessionProfitCenter,
  getUserRoleMatrix,
  setUserRoleInBusiness,
  unsetUserRoleInBusiness,
  AuthError,
} from '../auth.js';
import { ValidationError, NotFoundError,
  asUserId,
  asBusinessName,
} from '../db.js';
import { requireAuth, requireGlobalRole } from '../auth-middleware.js';

export const authRouter = Router();

const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });

authRouter.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const { token, user } = login(parsed.data.username, parsed.data.password);
    res.json({ token, user });
  } catch (err) {
    if (err instanceof AuthError) return res.status(401).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not log in.' });
  }
});

authRouter.post('/logout', requireAuth, (req, res) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  if (token) logout(token);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

const sessionBusinessSchema = z.object({ businessName: z.string().min(1) });

// Per docs/session-business-context.md - the one, real, direct way a
// person's own real business choice reaches this session, called
// once, when a business is selected or newly established, never
// repeated on every further real request afterward.
authRouter.post('/session/business', requireAuth, (req, res) => {
  const parsed = sessionBusinessSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  if (!token) return res.status(401).json({ error: 'Not logged in.' });
  try {
    setSessionBusiness(token, parsed.data.businessName);
    res.status(204).end();
  } catch (err) {
    if (err instanceof AuthError) return res.status(401).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not set the current business.' });
  }
});

const sessionProfitCenterSchema = z.object({ profitCenterName: z.string().min(1).nullable() });

// Per docs/profit-centers-design.md's Phase C: the exact, same real
// mechanism as /session/business above, for the real, current Profit
// Center instead. null explicitly clears it (switching back to "no
// Profit Center chosen"), the same real, honest trust-model-only gap
// /session/business itself already has — nothing here is enforced
// against what this user may actually pick.
authRouter.post('/session/profit-center', requireAuth, (req, res) => {
  const parsed = sessionProfitCenterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  if (!token) return res.status(401).json({ error: 'Not logged in.' });
  try {
    setSessionProfitCenter(token, parsed.data.profitCenterName);
    res.status(204).end();
  } catch (err) {
    if (err instanceof AuthError) return res.status(401).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not set the current Profit Center.' });
  }
});

// Everything below is Administrator-only user management.
authRouter.get('/users', requireAuth, requireGlobalRole('Administrator'), (_req, res) => {
  res.json(listUsers());
});

authRouter.get('/roles', requireAuth, requireGlobalRole('Administrator'), (_req, res) => {
  res.json(listRoles());
});

const createUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(8),
  roles: z.array(z.string()).min(1),
});

authRouter.post('/users', requireAuth, requireGlobalRole('Administrator'), (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.status(201).json(createUser(parsed.data.username, parsed.data.password, parsed.data.roles));
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not create user.' });
  }
});

const rolesSchema = z.object({ roles: z.array(z.string()) });

authRouter.put('/users/:id/roles', requireAuth, requireGlobalRole('Administrator'), (req, res) => {
  const parsed = rolesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    setUserRoles(Number(req.params.id), parsed.data.roles);
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not update roles.' });
  }
});

const activeSchema = z.object({ active: z.boolean() });

authRouter.put('/users/:id/active', requireAuth, requireGlobalRole('Administrator'), (req, res) => {
  const parsed = activeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    setUserActive(Number(req.params.id), parsed.data.active);
    res.status(204).end();
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not update user.' });
  }
});

const passwordSchema = z.object({ password: z.string().min(8) });

authRouter.put('/users/:id/password', requireAuth, requireGlobalRole('Administrator'), (req, res) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    changePassword(Number(req.params.id), parsed.data.password);
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError || err instanceof NotFoundError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not change password.' });
  }
});

const ownPasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });

// Any authenticated user, changing their OWN password — requires
// proving the current one first (see changeOwnPassword for why that's
// not just a redundant extra step).
authRouter.put('/me/password', requireAuth, (req, res) => {
  const parsed = ownPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    changeOwnPassword(asUserId(req.user!.id), parsed.data.currentPassword, parsed.data.newPassword);
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError || err instanceof NotFoundError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not change password.' });
  }
});

const pageSizeSchema = z.object({ pageSize: z.number().int() });
authRouter.put('/me/page-size', requireAuth, (req, res) => {
  const parsed = pageSizeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    setOwnPageSize(asUserId(req.user!.id), parsed.data.pageSize);
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not update page size.' });
  }
});

const numberFormatSchema = z.object({ numberFormat: z.string().min(1) });
authRouter.put('/me/number-format', requireAuth, (req, res) => {
  const parsed = numberFormatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    setOwnNumberFormat(asUserId(req.user!.id), parsed.data.numberFormat);
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not update number format.' });
  }
});

// Per docs/user-business-role-matrix-design.md: the real, per-business
// User × Role matrix - a genuine Cartesian Product, scoped per
// business, additive alongside the existing, global setUserRoles
// above (which stays exactly as it was).
authRouter.get('/businesses/:business/role-matrix', requireAuth, requireGlobalRole('Administrator'), (req, res) => {
  try {
    res.json(getUserRoleMatrix(asBusinessName(req.params.business)));
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not load the role matrix.' });
  }
});

authRouter.put('/businesses/:business/role-matrix/:user/:role', requireAuth, requireGlobalRole('Administrator'), (req, res) => {
  try {
    setUserRoleInBusiness(asBusinessName(req.params.business), req.params.user, req.params.role, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError || err instanceof NotFoundError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not set this cell of the role matrix.' });
  }
});

authRouter.delete('/businesses/:business/role-matrix/:user/:role', requireAuth, requireGlobalRole('Administrator'), (req, res) => {
  try {
    unsetUserRoleInBusiness(asBusinessName(req.params.business), req.params.user, req.params.role, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not clear this cell of the role matrix.' });
  }
});

const dateFormatSchema = z.object({ dateFormat: z.string().min(1) });
authRouter.put('/me/date-format', requireAuth, (req, res) => {
  const parsed = dateFormatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    setOwnDateFormat(asUserId(req.user!.id), parsed.data.dateFormat);
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not update date format.' });
  }
});
