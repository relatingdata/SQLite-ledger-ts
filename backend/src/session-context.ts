import { AsyncLocalStorage } from 'node:async_hooks';

/** The one, real, per-connection global context - per direct
 * instruction, holds the real, current user and business for
 * whichever real call chain is running right now (one real HTTP
 * request, or one real test/script run), genuinely isolated from
 * every other, concurrent one by Node's own AsyncLocalStorage - never
 * a plain module-level variable, which would leak one real request's
 * business into another, concurrent one.
 *
 * Honestly incomplete, not assumed finished: this foundation is built
 * and wired into the HTTP middleware (see auth-middleware.ts), but
 * db.ts's own 100+ business-taking functions still take businessName
 * as an explicit parameter today - the further, real conversion of
 * each one to read getCurrentBusiness() instead is a separate,
 * further, not-yet-done piece of real work. */
export interface SessionContext {
  userId: number;
  businessName: string;
}

const storage = new AsyncLocalStorage<SessionContext>();

/** Runs fn within a real, established session context - the one,
 * real, direct entry point every real caller uses: the HTTP
 * middleware, for a real request; a real test or script, for its own
 * real run. Never call getCurrentBusiness()/getCurrentUserId()
 * outside of this. */
export function runInSessionContext<T>(context: SessionContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** Updates the real, current business for whichever real context is
 * already running - used when a person switches business mid-session
 * (see setSessionBusiness in auth.ts, which calls this after updating
 * the real, persistent session record itself). */
export function setCurrentBusiness(businessName: string): void {
  const context = storage.getStore();
  if (!context) throw new Error('setCurrentBusiness called outside a real session context.');
  context.businessName = businessName;
}

export function getCurrentBusiness(): string {
  const context = storage.getStore();
  if (!context) throw new Error('No real, current business - this call happened outside a real session context (see runInSessionContext).');
  return context.businessName;
}

export function getCurrentUserId(): number {
  const context = storage.getStore();
  if (!context) throw new Error('No real, current user - this call happened outside a real session context (see runInSessionContext).');
  return context.userId;
}
