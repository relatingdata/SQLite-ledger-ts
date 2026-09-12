import type { Request, Response, NextFunction } from 'express';
import { getSessionUser, type AuthenticatedUser } from './auth.js';

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
 * other route uses requireAuth below, which does reject. */
export function attachUser(req: Request, _res: Response, next: NextFunction) {
  req.user = getSessionUser(tokenFrom(req)) ?? undefined;
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
