import { AsyncLocalStorage } from 'node:async_hooks';

// Documented in docs/pm-domain-reference.md, "Session-scoped business
// context" - this file carries no further multiline comments.
export interface RealBusinessNode {
  readonly id: number;
  readonly name: string;
}

export interface SessionContext {
  userId: number;
  business: RealBusinessNode;
  ledger: string;
}

const storage = new AsyncLocalStorage<SessionContext>();

export function runInSessionContext<T>(context: SessionContext, fn: () => T): T {
  return storage.run(context, fn);
}

// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export function setCurrentBusiness(business: RealBusinessNode): void {
//   const context = storage.getStore();
//   if (!context) throw new Error('setCurrentBusiness called outside a real session context.');
//   context.business = business;
// }

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
  get Ledger(): string {
    const context = storage.getStore();
    if (!context) throw new Error('No real, current ledger - this was read outside a real session context (see runInSessionContext).');
    return context.ledger;
  },
};
