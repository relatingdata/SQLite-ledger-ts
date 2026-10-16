import { Router } from 'express';
import { getMenuTree, setMenuOverride, deleteMenuOverride } from '../db.js';
import { requireRole } from '../auth-middleware.js';

export const menuRouter = Router();

menuRouter.get('/', (req, res) => {
  const businessName = typeof req.query.business === 'string' ? req.query.business : undefined;
  const userId = req.user?.id;
  res.json(getMenuTree({ businessName, userId }));
});

// A real, confirmed gap found while auditing every screen's own
// requireRole coverage: these two mutate menu visibility/labels for
// ANY given business or user id, with no role check at all — any
// authenticated user, down to Read-Only, could hide or relabel menu
// items for someone else's account or a whole business. Reads (GET
// '/' above) stay open to any authenticated user, exactly as before.
menuRouter.post('/override', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const { menuItemKey, scope, scopeId, overrideLabel, hidden } = req.body ?? {};
  if (typeof menuItemKey !== 'string' || (scope !== 'business' && scope !== 'user') || typeof scopeId !== 'number') {
    return res.status(400).json({ error: 'menuItemKey, scope (business|user), and scopeId are required' });
  }
  setMenuOverride(menuItemKey, scope, scopeId, typeof overrideLabel === 'string' ? overrideLabel : null, hidden === true);
  res.json({ ok: true });
});

menuRouter.delete('/override', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const { menuItemKey, scope, scopeId } = req.body ?? {};
  if (typeof menuItemKey !== 'string' || (scope !== 'business' && scope !== 'user') || typeof scopeId !== 'number') {
    return res.status(400).json({ error: 'menuItemKey, scope (business|user), and scopeId are required' });
  }
  deleteMenuOverride(menuItemKey, scope, scopeId);
  res.json({ ok: true });
});
