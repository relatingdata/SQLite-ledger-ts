import type { Request, Response, NextFunction } from 'express';
import { getSessionUser, getSessionBusiness, type AuthenticatedUser } from './auth.js';
import { runInSessionContext } from './session-context.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

function tokenFrom(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
  return undefined;
}

/** Attaches req.user if a valid session token is present, but does not
 * itself reject the request — routes that must be reachable without
 * login (just the login route itself) skip requireAuth entirely; every
 * other route uses requireAuth below, which does reject. Also runs
 * every further, real, downstream request handler inside the one,
 * real, per-connection session context (see session-context.ts) - the
 * real user and real, current business this exact same real session
 * already knows, so every db.ts function called from here on can read
 * getCurrentBusiness()/getCurrentUserId() directly, with no explicit
 * parameter re-threaded through every real route and every real
 * function call in between. */
export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const token = tokenFrom(req);
  req.user = getSessionUser(token) ?? undefined;
  if (req.user) {
    const businessName = getSessionBusiness(token!);
    if (businessName) {
      runInSessionContext({ userId: req.user.id, businessName }, next);
      return;
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Not logged in.' });
  next();
}

/** Requires the current user to have at least one of the given roles.
 * Administrator is not implicitly included in every check — a route
 * that means "Bookkeeper or Administrator" says so explicitly, since an
 * Administrator-only route (user management) must NOT be reachable by a
 * Bookkeeper just because Administrator is "higher". */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in.' });
    if (!req.user.roles.some((r) => roles.includes(r))) {
      return res.status(403).json({ error: `Requires one of: ${roles.join(', ')}.` });
    }
    next();
  };
}
