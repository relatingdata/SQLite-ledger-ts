import { AsyncLocalStorage } from 'node:async_hooks';

/** The one, real, per-connection global context - per direct
 * instruction, genuinely isolated from every other, concurrent one by
 * Node's own AsyncLocalStorage under the hood (a real, genuinely
 * plain, reassignable module-level variable would leak one real
 * request's own business into another, concurrent one - confirmed,
 * not a style preference), but exposed to every real caller as a
 * real, plain-looking property - `Session.Business`, `Session.UserId`
 * - never a function call, per direct correction. A JavaScript getter
 * accessor is what makes both real things true at once: the syntax
 * reads like a plain variable, the real value underneath is still
 * safely, separately resolved per real, concurrent request.
 *
 * `Business` is the real business node itself - the real top of that
 * business's own tree (its own real `id` and `name`), not a bare
 * string, so it points directly at the real entity, ready to `fetch`/
 * `create` straight under it with no further lookup.
 *
 * Honestly incomplete, not assumed finished: this foundation is built
 * and wired into the HTTP middleware (see auth-middleware.ts), but
 * db.ts's own 100+ business-taking functions still take businessName
 * as an explicit parameter today - the further, real conversion of
 * each one to read `Session.Business` instead is a separate, further,
 * not-yet-done piece of real work. */
export interface RealBusinessNode {
  readonly id: number;
  readonly name: string;
}

export interface SessionContext {
  userId: number;
  business: RealBusinessNode;
}

const storage = new AsyncLocalStorage<SessionContext>();

/** Runs fn within a real, established session context - the one,
 * real, direct entry point every real caller uses: the HTTP
 * middleware, for a real request; a real test or script, for its own
 * real run. Never read `Session.Business`/`Session.UserId` outside of
 * this. */
export function runInSessionContext<T>(context: SessionContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** Updates the real, current business for whichever real context is
 * already running - used when a person switches business mid-session
 * (see setSessionBusiness in auth.ts, which calls this after updating
 * the real, persistent session record itself). */
export function setCurrentBusiness(business: RealBusinessNode): void {
  const context = storage.getStore();
  if (!context) throw new Error('setCurrentBusiness called outside a real session context.');
  context.business = business;
}

/** The one, real, per-connection global - reads like a plain
 * property (`Session.Business`, `Session.UserId`), per direct
 * correction, never a function call, while staying genuinely safe
 * across real, concurrent requests underneath (see the module's own
 * doc comment above). */
export const Session = {
  get Business(): RealBusinessNode {
    const context = storage.getStore();
    if (!context) throw new Error('No real, current business - this was read outside a real session context (see runInSessionContext).');
    return context.business;
  },
  get UserId(): number {
    const context = storage.getStore();
    if (!context) throw new Error('No real, current user - this was read outside a real session context (see runInSessionContext).');
    return context.userId;
  },
};
