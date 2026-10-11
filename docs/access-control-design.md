## Access control — roles (what), grants (where), and the real gap between them

Per direct instruction: designed and documented fully here before any code changes,
the same discipline `docs/session-business-context.md` and
`docs/profit-centers-design.md` already followed.

### Two separate, orthogonal questions, confirmed as genuinely separate in this codebase

"Access control" is really two different questions, and this codebase currently
answers only one of them:

1. **What can this user do?** — a functional permission (post a journal entry, close
   the books, administer other users). This already exists today: `requireRole`
   (`backend/src/auth-middleware.ts` 61-69) checks plain role-name membership;
   exactly four roles exist (`Administrator`, `Bookkeeper`, `Read-Only`, `Developer`,
   `backend/schema/00-core.sql` 329-332); a user's roles are real child entities under
   them (`setUserRoles`/`getUserRoleNames`, `backend/src/auth.ts` 86-100, 42-48), not a
   flag. Every route decides its own required role(s) individually, at its own
   `requireRole(...)` call — there is no central role-to-route table. Deliberately, by
   existing convention, `Administrator` is never implicitly included — a route that
   wants it says so explicitly.

2. **Where can this user do it?** — which business, ledger, profit center, or
   location a user may act within at all. **This does not exist anywhere today.**
   Checked directly, not assumed: `getBusinesses()` (`backend/src/db.ts` 6841-6845)
   returns every business in the system to every logged-in user, no user argument at
   all; `getLedgers()`/`getDivisions()` are the same shape, scoped only by business,
   never by user. The closest-looking existing mechanism — `'Place of Employment'`
   (employee → business/location) and `'Belongs To Division'` (location → division),
   both built on the generic named-relationship primitive (`setRelationship`/
   `getRelationship`/`getEntitiesWithRelationship`) — is **descriptive, not
   enforced**: nothing reads either relationship to reject an action; they exist
   purely for the org chart and for auto-tagging a transaction's division on reports.
   There is no real precedent in this codebase today of "entity A may only *act*
   within entity B," only of "entity A is *associated with* entity B for display."

Role (what) and grant (where) are independent dimensions and should stay that way —
a Bookkeeper's permissions don't change depending on which business they're
scoped to; which businesses they're scoped to doesn't change what a Bookkeeper is
allowed to do within one of them.

### The real mechanism this proposes: Grants, built on the same relationship primitive already proven for Place of Employment

A **Grant** is a real relationship, recorded exactly the way `'Place of Employment'`
already is — a named relationship from the user entity to the scope entity — except
this one is actually read at the enforcement boundary, not just for display:

- `'Can Access Business'` — user → business. No grant at all for a given business
  means that business is invisible and unusable to that user, full stop.
- `'Can Access Profit Center'` — user → profit center (see
  `docs/profit-centers-design.md`). **Absent** for a business the user already holds
  a Business grant for, this means "every Profit Center in that business" — a narrower
  grant exists only to *restrict* a user to a subset, never to add access a Business
  grant didn't already imply. This directly matches what was asked for: "accounting
  staff may have access to a number or all of them" costs nothing extra for the
  all-of-them case, and only the subset case needs real, extra grant rows.
  `'Can Access Location'` follows the identical shape, independently, for any route
  that needs location-level restriction later.

This is additive and reuses a mechanism already proven correct in this codebase —
no new table, no new storage model, just the same relationship primitive pointed at a
new purpose, with one real difference from `Place of Employment`: this one is
actually checked.

### Where enforcement actually lives — the same, one real seam `session-business-context.md` already identified

Per that document's own, already-settled principle: the real, correct boundary for
"ambient, per-session fact" is the HTTP layer, never re-threaded through `db.ts`'s own
pure, explicit, directly-testable functions. Grants follow the identical seam:

- **The picker itself** gets honest: `getBusinesses()`/`getLedgers()`/a future
  profit-center picker all gain a real, user-scoped variant (`getBusinessesFor(userId)`,
  filtered by `'Can Access Business'`) — so a restricted user is never shown a choice
  they'd be rejected for making a moment later. `Administrator` seeing "all of them" is
  then just the honest, direct result of Administrator holding a Business grant for
  every business — not a special case baked into the filter.
- **The one, real place a choice is actually set** — `setSessionBusiness` (and its
  future profit-center sibling), already the single call site `/api/session/business`
  goes through — is where the grant is actually checked: reject the switch outright if
  the user holds no `'Can Access Business'` grant for that name, the same shape
  `requireRole` already uses (`req.user.roles.some(...)` becomes
  `userHasGrant(req.user.id, 'Can Access Business', businessName)`).
- **A new `requireScope(kind)` middleware**, deliberately the same shape as
  `requireRole`, for any route that reads a scope directly from its own request rather
  than through the session context (some routes still do, per
  `session-business-context.md`'s own "not yet done" admission) — checked once the
  scope is known, rejecting with the same 403 shape `requireRole` already uses.

`db.ts`'s own business/ledger/location-taking functions stay exactly as they are —
explicit parameters, no grant-checking inside them, directly testable with no session
or user involved, exactly the same deliberate boundary `session-business-context.md`
already drew for business context generally. A grant is checked once, at the HTTP
edge, never re-checked deeper in a call chain that already trusts its own caller.

### Four real decisions this document deliberately leaves open, rather than silently assuming

1. **Default for a user with zero grants of any kind**: nothing (locked out of every
   business until explicitly granted) is the real, correct, safe default — but it is
   a genuine behavior change for every already-seeded user (including the demo
   `admin` account) the moment enforcement switches on, unless a one-time migration
   grants every existing user access to every business that exists today. Needs a
   direct decision before Phase 2 (enforcement) ships, not an assumption baked in.
2. **Does `Administrator` bypass grants automatically, or must even an Administrator
   hold an explicit grant per business?** The existing, established convention for
   roles is the opposite of auto-inclusion — `requireRole` never implies
   Administrator automatically, each route opts in. Grants could follow that same,
   consistent principle (explicit, even for Administrator) or deliberately break from
   it for this one dimension (an Administrator role implies every grant, since
   "administers everything" is close to what the role name already promises). Either
   is defensible; this document doesn't pick for you.
3. **Granularity below Business**: Profit Center and Location grants as independent,
   parallel relationships (as sketched above) is the proposal, but it's worth
   confirming that's the real shape wanted before building both, rather than just one.
4. **A dedicated "Manage access" screen** (grant/revoke a user's Business/Profit
   Center/Location access) vs. managing grants ad hoc through direct API calls or a
   script for now, the same way role assignment itself (`setUserRoles`) already has a
   real admin screen but a brand-new grant type wouldn't, day one.

### Phased plan

- **Phase 1 — data model and read-side only (buildable now, zero behavior change)**:
  the `'Can Access Business'`/`'Can Access Profit Center'`/`'Can Access Location'`
  relationship types; `userHasGrant`/`grantAccess`/`revokeAccess` functions in
  `auth.ts`, mirroring `setUserRoles`'s own shape; the user-scoped picker variants.
  Nothing enforces anything yet — existing behavior is provably unchanged until a
  route is switched over.
- **Phase 2 — enforcement at the one, real seam**: `setSessionBusiness` (and its
  profit-center sibling, once Phase C of the Profit Centers doc lands) start
  rejecting a switch to an ungranted scope; `requireScope` added to routes that still
  read a scope directly from the request. This is the phase that actually changes
  behavior, and needs decision (1) above settled first — almost certainly via a
  one-time migration that grants every pre-existing user access to every
  already-existing business, so nobody already using the system is locked out by a
  change they didn't ask for.
- **Phase 3 — a real admin screen** for granting/revoking access, once there's more
  than one business/profit-center combination actually worth restricting in practice.

Per direct instruction: this, too, provides a real method, not a policy — a business
with one user and one business/profit center is entirely unaffected; the grant
mechanism only does anything once a second business, profit center, or restricted
staff member actually exists.
