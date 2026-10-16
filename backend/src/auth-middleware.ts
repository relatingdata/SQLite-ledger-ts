import type { Request, Response, NextFunction } from 'express';
import { getSessionUser, getSessionBusiness, getSessionProfitCenter, userHasBusinessAdminRole, type AuthenticatedUser } from './auth.js';
import { asBusinessName } from './db.js';
import { runInSessionContext } from './session-context.js';
import { requireEntity as fetchEntity, typeBusinessName, typeRootName } from './db.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      // Per docs/profit-centers-design.md's Phase C: the real,
      // currently-selected Profit Center for this one, real,
      // connected session - the exact, same real shape as
      // getSessionBusiness/businessName above, set by attachUser
      // whenever a session has one chosen. null/undefined both mean
      // "none chosen" - a business with zero Profit Centers, or a
      // user who hasn't picked one yet, are the exact same, real
      // case: every route works exactly as it always has.
      profitCenter?: string | null;
      // The real, currently-selected business for this session, the
      // exact same name getSessionBusiness/attachUser already resolve
      // below — set once, here, so requireRole's own fallback (see
      // below) never has to re-read the session token itself.
      businessName?: string | null;
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
    req.profitCenter = getSessionProfitCenter(token!);
    const businessName = getSessionBusiness(token!);
    req.businessName = businessName;
    if (businessName) {
      try {
        const business = fetchEntity(businessName, typeBusinessName, fetchEntity('Businesses', typeRootName));
        runInSessionContext({ userId: req.user.id, business, ledger: 'Actual' }, next);
        return;
      } catch {
        // A real, stored business name that no longer resolves (deleted
        // since) - fall through to running with no real session context.
      }
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Not logged in.' });
  next();
}

/** Requires the current user to have at least one of the given roles,
 * either globally (setUserRoles — unchanged, real, original behavior)
 * or, per docs/business-admin-role-and-enforcement-design.md, by
 * holding the real, per-business "Business Admin" role (the matrix;
 * see auth.ts) in the CURRENT session's business specifically — a
 * genuine, scoped stand-in for "full access within this one business"
 * that this check accepts regardless of which specific role was
 * named, since that is exactly what Business Admin means. A session
 * with no business selected, or a username not in that business's own
 * matrix, is "no" — this never widens access beyond one business.
 * Administrator is not implicitly included in every check — a route
 * that means "Bookkeeper or Administrator" says so explicitly, since an
 * Administrator-only route (user management) must NOT be reachable by a
 * Bookkeeper just because Administrator is "higher". A route that must
 * stay out of Business Admin's reach entirely (creating a business,
 * managing the global user/role list) uses requireGlobalRole instead. */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in.' });
    if (req.user.roles.some((r) => roles.includes(r))) return next();
    if (req.businessName && userHasBusinessAdminRole(asBusinessName(req.businessName), req.user.username)) return next();
    return res.status(403).json({ error: `Requires one of: ${roles.join(', ')}.` });
  };
}

/** The real, narrower check for a route Business Admin must never
 * satisfy however it's phrased — creating a new business, or managing
 * the global user/role list itself (docs/business-admin-role-and-enforcement-design.md).
 * Identical to the pre-existing requireRole behavior before this
 * session's change: only a user's real, global roles count, never the
 * per-business matrix. */
export function requireGlobalRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in.' });
    if (!req.user.roles.some((r) => roles.includes(r))) {
      return res.status(403).json({ error: `Requires one of: ${roles.join(', ')} (globally).` });
    }
    next();
  };
}
