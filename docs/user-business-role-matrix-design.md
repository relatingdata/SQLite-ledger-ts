## Per-business user roles: a real Cartesian Product, not a new table

Per direct instruction: designed and documented fully here before any code changes,
the same discipline `docs/session-business-context.md`, `docs/profit-centers-design.md`,
and `docs/access-control-design.md` already followed.

### The real gap this closes

Today, `setUserRoles(userId, roleNames)` (`backend/src/auth.ts`) assigns a role
**globally** — a user who is `Administrator` is `Administrator` everywhere, in every
business, with no way to be `Bookkeeper` in one business and `Read-Only` in another.
`docs/access-control-design.md` already named this gap directly ("Where can this user
do it? ... This does not exist anywhere today") and proposed a `Grant` relationship
(`'Can Access Business'`) as the fix. That document's Phase 1 was never built — checked
directly, not assumed (`grep -rn "Can Access Business\|userHasGrant" backend/src/`
returns zero matches).

Per direct instruction, this document replaces that `Grant` proposal with a different,
more exact shape for the "which roles does this user have, in this business"
question specifically: **User × Role, scoped per Business, is a genuine Cartesian
Product** — the same real relationship a container size and a unit size already form
for a Product Instance — not a new, bespoke table or a boolean relationship. Whether a
user may act in a business *at all* (the broader `'Can Access Business'` question) is
a separate, still-open question this document does not re-decide; this document is
scoped to the role-assignment matrix only.

### The real mechanism: `defineProductShape`/`ensureProductInstance`, pointed at Users and Roles

`backend/src/db.ts` already has a real, general, proven Cartesian Product primitive —
`defineProductShape(businessName, dimensions, userId)` and
`ensureProductInstance(businessName, dimensions, values, userId)` — used today for
Container × Unit size, and for `CURRENCY_EXCHANGE_SHAPE` (`['From Currency',
'Currency']`, `['To Currency', 'Currency']`). The same mechanism, pointed at a new
shape:

```typescript
const USER_ROLE_SHAPE: [string, string][] = [
  ['User', 'User'],
  ['Role', 'Role'],
];
```

A real, assigned cell — "this user has this role, in this business" — is one real
Product Instance: `ensureProductInstance(businessName, USER_ROLE_SHAPE, [userName,
roleName], userId)`. The three real, exported functions that put this to work (all
in `backend/src/auth.ts`):

- **`getUserRoleMatrix(businessName)`**: the full, real matrix for one business —
  every row (every real system user) × every column (every real system role), and
  which cells are currently set. Scoped the same, direct way every other business-
  taking function already is.
- **`setUserRoleInBusiness(businessName, username, roleName, userId)`**: sets one
  real cell — idempotent, the same established `ensureProductInstance` semantics.
- **`unsetUserRoleInBusiness(businessName, username, roleName, userId)`**: the real,
  direct inverse. A real, confirmed finding made while building this: `revokeEntity`
  does **not** remove a Product Instance from the matrix at all — per its own real,
  append-only design it only ever supersedes `relation_id` to `NULL`, which a Product
  Instance's own identity (`combination_ids`) never used. The real, correct way to
  clear a cell is to supersede `combination_ids` itself to `NULL`, via the exact, same
  `entity_set_combination_ids` mechanism `ensureProductInstance` uses to set it — the
  cell's own entity row still exists, historically, exactly as this codebase's
  append-only design requires, but no longer matches any real `combination_ids`
  lookup, so `getUserRoleMatrix` correctly stops listing it.

Exposed at `GET/PUT/DELETE /api/auth/businesses/:business/role-matrix[/:user/:role]`
(`backend/src/routes/auth.ts`), and edited through a real, direct checkbox grid added
to the existing Users screen (`frontend/src/routes/setup/users/+page.svelte`) — rows
of users, columns of roles, one checkbox per cell, scoped to a selected business —
the exact, same, standard matrix-editing shape this screen's own existing, global
role table already uses, never a new UI pattern.

The full matrix for a business is a plain existence query against that business's
own `Product` subtree, scoped by `combination_ids`, no new query shape needed.

This is **additive, Phase 1 only**, matching `access-control-design.md`'s own phased
discipline: the existing, global `setUserRoles`/`requireRole` mechanism is untouched.
Nothing about this matrix is read by any route's enforcement yet — building that
("does this user's per-business role allow this action, in this business")
is a real, separate, later phase, exactly as `access-control-design.md` already
flagged for its own `Grant` proposal (Phase 2: enforcement). Recording the real
assignment first, with a real screen to edit it, is useful on its own — an owner can
see and set "who does what, where" today — before any route's behavior changes.

### Why a Cartesian Product, not a relationship

A `Grant`-style relationship (`'Can Access Business'`) answers a yes/no question
("may this user touch this business at all"). The real question asked here —
"**which, of several, roles** does this user hold, **in this business**" — is a
genuine two-dimensional fact, exactly the same shape as "which container size, in
which unit size" already is for a Product Instance. Modelling it as a relationship
would mean a separate relationship *per role* (`'Has Role: Bookkeeper'`,
`'Has Role: Administrator'`, ...) — a real, needless proliferation the Cartesian
Product mechanism avoids by construction, since User and Role are simply the two real
dimensions of one real product.

### The standard, real way to edit a Cartesian Product's cells: a matrix (grid) editor

Per direct instruction: edited the same, standard way any User × Role matrix is
edited — rows down one side, columns across the other, a checkbox (or toggle) at
each intersection, scoped to one selected business at a time. `backend/src/routes/`
gains a small, real, matrix-shaped endpoint:

- `GET /api/businesses/:business/role-matrix` → `{ users: string[], roles: string[],
  assignments: { user: string; role: string }[] }` — enough for a frontend grid to
  render every row × column and mark which cells are already checked.
- `PUT /api/businesses/:business/role-matrix/:user/:role` → sets that one cell
  (`ensureProductInstance`).
- `DELETE /api/businesses/:business/role-matrix/:user/:role` → clears that one cell
  (`revokeEntity`).

A new frontend screen (`/setup/user-roles` or similar), gated the same way the
existing user-management screen already is (`requireRole('Administrator')`), renders
exactly this grid for the currently-selected business — the standard, real way matrix
data is edited everywhere else in this UI (a table of rows and columns, not a
multi-step wizard).

### What this does not do, honestly

This does not change what any route currently enforces — `requireRole('Administrator',
...)` still checks the real, global role from `setUserRoles`, exactly as before. It
does not answer "may this user access this business at all" (`access-control-design.md`'s
own, still-open `Grant` question). It is the real, first, additive step: record the
real per-business role fact, correctly, as a genuine Cartesian Product, with a real
screen to edit it — enforcement is real, separate, later work.
