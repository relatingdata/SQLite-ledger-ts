import type { Request, Response, NextFunction } from 'express';
import { getSessionUser, getSessionBusiness, getSessionProfitCenter, userHasBusinessAdminRole, type AuthenticatedUser } from './auth.js';
import { asBusinessName } from './db.js';
import { runInSessionContext } from './session-context.js';
import { requireEntity as fetchEntity, typeBusinessName, typeRootName } from './db.js';

// Documented in docs/pm-domain-reference.md, "The HTTP middleware
// layer" and "Access control: roles, Business Admin, and the
// per-business matrix" - this file carries no further multiline
// comments.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      profitCenter?: string | null;
      businessName?: string | null;
    }
  }
}

function tokenFrom(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
  return undefined;
}

export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const token = tokenFrom(req);
  req.user = getSessionUser(token) ?? undefined;
  if (req.user) {
    req.profitCenter = getSessionProfitCenter(token!);
    const businessName = getSessionBusiness(token!);
    req.businessName = businessName;
    if (businessName) {
      try {
        const business = fetchEntity(businessName, typeBusinessName, fetchEntity('Businesses', typeRootName));
        runInSessionContext({ userId: req.user.id, business, ledger: 'Actual' }, next);
        return;
      } catch {
        // stored business name no longer resolves (deleted) - fall through with no session context
      }
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Not logged in.' });
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in.' });
    if (req.user.roles.some((r) => roles.includes(r))) return next();
    if (req.businessName && userHasBusinessAdminRole(asBusinessName(req.businessName), req.user.username)) return next();
    return res.status(403).json({ error: `Requires one of: ${roles.join(', ')}.` });
  };
}

export function requireGlobalRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in.' });
    if (!req.user.roles.some((r) => roles.includes(r))) {
      return res.status(403).json({ error: `Requires one of: ${roles.join(', ')} (globally).` });
    }
    next();
  };
}
