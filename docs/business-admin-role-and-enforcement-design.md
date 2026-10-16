## Business Admin: a real, per-business admin role, and route-level enforcement

Per direct instruction, following on from `docs/user-business-role-matrix-design.md`
(which recorded the real, per-business User × Role fact but deliberately left
every route's enforcement untouched — its own stated Phase 2). This document is
that Phase 2: a real role that reads from the matrix, and real `requireRole`
enforcement built on it.

### The real request

> Not only do we need an admin user "globally" but also an "admin" user per
> business with an "admin" role that gives full access within a business but
> not necessarily the ability to create new businesses. There should be proper
> `requireRole` checks on all screens.

Two real, separate things, both delivered here:

1. A real, per-business admin **role** ("Business Admin") that means "full
   access within this one business", and a real, per-business admin **user**,
   auto-created for every new business, holding exactly that role.
2. An audit of every route's own `requireRole` coverage, and a real fix for
   the one, genuine gap it found.

### Business Admin: a fifth global role, granted only through the matrix

`backend/schema/00-core.sql` gains a fifth role entity under `System Roles`
(entity id 909, the next free id in that deliberately-high 900+ range):
`Business Admin` — its exact, real name is the exported `BUSINESS_ADMIN_ROLE`
constant (`backend/src/auth.ts`), never a second, hand-typed string literal
anywhere this document or the code itself compares against it. It sits alongside `Administrator`/`Bookkeeper`/`Read-Only`/
`Developer` as a real, equal role — `listRoles()`/`setUserRoles()` both already
treat it as just another role, with zero code change required there. The real
difference is never in the role entity itself, only in how it's meant to be
**granted**: never globally (nothing stops `setUserRoles(userId, ['Business
Admin'])`, but that isn't the intended, real use), always through the
per-business matrix (`setUserRoleInBusiness`, `docs/user-business-role-matrix-design.md`)
— one specific business, one specific user, one real cell.

### What "full access within a business" means, concretely: `requireRole`'s real fallback

`requireRole(...roles)` (`backend/src/auth-middleware.ts`) kept its original,
real behavior — a user's own, global roles (`req.user.roles`) — and gained one,
real, additional path: if the user does not hold any of the named roles
globally, but genuinely holds `Business Admin` (via the matrix) in the
**current session's business** (`req.businessName`, set by `attachUser` from
the real, existing `getSessionBusiness`), the check passes anyway — regardless
of which specific role (`Administrator`, `Bookkeeper`, ...) the route actually
asked for. That is the real, honest meaning of "full access within a
business": every route whose own role check is scoped to one business's own
data (items, locations, journal, invoices, contacts, hierarchy, entities,
reports, POS, stock, period-close, divisions, business bank accounts/
configuration) now also accepts a real Business Admin of that business,
without a single one of those ~90 existing `requireRole(...)` call sites
needing to change.

A session with no business selected, or a username the current business's own
matrix doesn't list, is a real, honest "no" — this can never reach across
businesses. `userHasBusinessAdminRole(businessName, username)` (`auth.ts`) is
the real, small, non-throwing check this uses (wraps `getUserRoleMatrix` —
never throws for a stale/unset business, by design).

### What Business Admin must never reach: `requireGlobalRole`

Per the request's own, explicit carve-out — "not necessarily the ability to
create new businesses" — a second, real, narrower middleware,
`requireGlobalRole(...roles)`, is the exact, unmodified, original `requireRole`
behavior: only a user's real, global roles count, the per-business matrix is
never consulted. Two real groups of routes use it, both genuinely global, not
business-scoped, by nature:

- **Creating a business** — `businessesRouter.post('/')`
  (`backend/src/routes/businesses.ts`) — the one, explicitly named carve-out.
- **Managing the global user/role list itself** — every route in
  `backend/src/routes/auth.ts` that lists, creates, or edits *any* user's
  global roles, active flag, or password, and every route that edits the
  per-business matrix of *any* business (`/businesses/:business/role-matrix*`)
  — a Business Admin of one business granting itself (or anyone else) more
  access, in its own or any other business, is exactly the kind of escalation
  "full access within a business" must not mean. (Relaxing this — letting a
  Business Admin manage their own business's own matrix rows — is a real,
  separate, later, additive step, not decided here.)

Every other existing `requireRole('Administrator', ...)` call site in
`backend/src/routes/businesses.ts` (bank accounts, bank currency structure,
business-type answers, the configuration report) stays on `requireRole` —
each one is real, per-business data, exactly the case Business Admin is meant
to reach.

### The real, dedicated admin user every new business gets

`provisionBusinessAdminUser(businessName, createdBy)` (`backend/src/auth.ts`)
is called once, from the business-creation route
(`backend/src/routes/businesses.ts`'s `POST /`) right after `createBusiness`
succeeds — never from `createBusiness` (`backend/src/db.ts`) itself, since
`db.ts` cannot import `auth.ts` without a real, genuine circular import
(`auth.ts` already imports from `db.ts`). It:

1. Builds a real, business-prefixed username (`"${businessName} Admin"`) —
   usernames live under the one, real, global `System Users` root, unlike the
   per-business `Items`/`Locations`/... roots `PER_BUSINESS_ROOTS` gives every
   business, so a plain, unprefixed name would collide across businesses.
2. Generates a real, random password (`crypto.randomBytes`), creates the user
   with **zero global roles** (`createUser(username, password, [])`).
3. Grants it `Business Admin` in exactly this one business, through the
   existing matrix mechanism (`setUserRoleInBusiness`).
4. Returns the plain-text username/password once — never otherwise
   recoverable, since only the hash is ever stored (the exact, same, real
   "shown once" discipline the seeded global `admin`/`changeme123` account
   already documents, just generated rather than hardcoded).

`businessesRouter.post('/')`'s JSON response gained one real field,
`businessAdmin: { username, password }`, and the new-business screen
(`frontend/src/routes/setup/new-business/+page.svelte`) shows it once, right
after the business is created, with an explicit "copy this now" note.

### The real audit: every mutating route checked for `requireRole` coverage

Audited every `router.(get|post|put|patch|delete)(...)` call across
`backend/src/routes/*.ts` against both its own, direct `requireRole`/
`requireAuth` and whatever its router is mounted with in
`backend/src/server.ts` (several routers — `arap`, `stock`, `invoice` — are
gated at the `app.use(...)` mount itself, not per-route; `requireRole` already
403s on a missing `req.user` too, so a route needs no separate `requireAuth`
of its own once it carries a `requireRole`).

One real, confirmed gap found: `menuRouter.post('/override')` and
`menuRouter.delete('/override')` (`backend/src/routes/menu.ts`) — both mutate
menu visibility/labels for any given business or user id, with **no role
check at all** beyond the router's own blanket `requireAuth`, so any
authenticated user, down to `Read-Only`, could hide or relabel menu items for
someone else's account or an entire business. Fixed: both now require
`requireRole('Administrator', 'Bookkeeper')` — reads (`GET /`, used by every
page's own navigation) stay open to any authenticated user, unchanged.

Every other apparent "gap" found by the same audit was checked and confirmed
intentional, not fixed:

- Every `GET` route across the app with no `requireRole` — reading is, by
  design, open to any authenticated user; only mutation is role-gated.
- `projectsRouter`'s `/clock-in`/`/clock-out` and `recordingRouter`'s
  `/start`/`/stop` — basic actions for any logged-in staff member (clocking
  in/out) or an internal dev/e2e tool (session recording), neither a
  privileged, data-mutating business operation in the same sense as the
  routes above; left exactly as they were, as a deliberate, honest choice
  rather than a silent, unrequested scope expansion.
- `customerRegistrationRouter`'s `/register` — a real, explicitly public,
  unauthenticated self-service registration endpoint, already commented as
  such at its mount point in `server.ts`.

### What this does not do, honestly

This does not add a dynamic, editable UI or data model for "which role can
reach which screen" (the `requireRole(...)` list on each route is still a
real, hardcoded, source-level decision, exactly as before — this document
only adds a second, real way to *satisfy* one of those lists, per business).
Building a route↔role mapping with its own editor is a real, separate,
further feature, not this one.
