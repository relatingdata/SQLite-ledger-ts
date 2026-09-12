import { Router } from 'express';
import { getMenuTree, setMenuOverride, deleteMenuOverride } from '../db.js';

export const menuRouter = Router();

menuRouter.get('/', (req, res) => {
  const businessName = typeof req.query.business === 'string' ? req.query.business : undefined;
  const userId = req.user?.id;
  res.json(getMenuTree({ businessName, userId }));
});

menuRouter.post('/override', (req, res) => {
  const { menuItemKey, scope, scopeId, overrideLabel, hidden } = req.body ?? {};
  if (typeof menuItemKey !== 'string' || (scope !== 'business' && scope !== 'user') || typeof scopeId !== 'number') {
    return res.status(400).json({ error: 'menuItemKey, scope (business|user), and scopeId are required' });
  }
  setMenuOverride(menuItemKey, scope, scopeId, typeof overrideLabel === 'string' ? overrideLabel : null, hidden === true);
  res.json({ ok: true });
});

menuRouter.delete('/override', (req, res) => {
  const { menuItemKey, scope, scopeId } = req.body ?? {};
  if (typeof menuItemKey !== 'string' || (scope !== 'business' && scope !== 'user') || typeof scopeId !== 'number') {
    return res.status(400).json({ error: 'menuItemKey, scope (business|user), and scopeId are required' });
  }
  deleteMenuOverride(menuItemKey, scope, scopeId);
  res.json({ ok: true });
});
