## The active ledger: one real default per business, not a hard lock

Per direct instruction, following the user's own, explicit, settled answers to three questions
raised while extending the tutorial e2e fixture with pre/post year-end reports:

1. **Does the old ledger stay postable after rollover, or does it lock?** → stays postable, "but
   probably requires an accountant role to be able to select the 'old' ledger to post 'corrections'
   to it." Keeps `docs/ledger-scoped-accounts-and-rollover.md`'s own, already-settled design (late
   adjustments must still post), adding a real, narrower role gate on top, never replacing it.
2. **Forced logout + mandatory re-login at rollover, or a soft switch?** → soft switch, "if it is
   easy and practicable" — confirmed practicable (see below): no session-kill mechanism of any
   kind exists in this codebase today, and none was built for this.
3. **Does rollover restart the backend?** → no. Everything here runs in-process, exactly like every
   other real database write this application already makes.

### The real, new, per-business fact: "active ledger"

`getActiveLedger(businessName)`/`setActiveLedger(businessName, ledgerName, userId)` (`backend/src/db.ts`)
record one real fact per business: which of its own ledgers ordinary trading posts into right now.
Stored as a real, dedicated `"Active Ledger"` marker entity, a direct child of the business itself
— never reusing the business entity's own `relation_id`, which `createBusiness` already uses for
the CoA prototype tag. The marker's own `relation_id` points at the real ledger entity **by id**,
via `supersedeEntity`'s `relationId` field — never by bare name. A ledger's own name (`"Actual"`) is
deliberately not globally unique (every business has one), so the general-purpose
`setRelationship`/`getRelationship` helpers (which resolve a target by bare name) would silently
resolve to some *other* business's own `"Actual"` the moment more than one real business exists —
checked directly before building this, not assumed safe.

Set twice, both times by code that already runs today:

- `createBusiness` sets it to the brand-new business's own, first `"Actual"` ledger.
- `rolloverToNewPeriod` sets it to the new ledger, right after its own opening entry posts — the
  exact, real moment "the business continues trading in the new ledger immediately" (step 6 of the
  rollover procedure) actually becomes true.

A business created before this concept existed simply has no marker — `getActiveLedger` returns
`null`, and every real caller below treats that as "no real guidance, nothing restricted," never as
an error.

### The real gate: `canUserPostToLedger`

`canUserPostToLedger(business, ledger, user)` (`backend/src/auth.ts`) is the one, real, shared
answer to "may this user post into this specific ledger, for this specific business right now":

- **True, unconditionally**, when `ledger` already is the business's own active ledger (ordinary
  trading — a plain Bookkeeper, completely unaffected), or when this business has no active-ledger
  pointer at all.
- **Otherwise** (a real posting into an already-rolled-over, non-active ledger — a genuine
  correction/adjustment, never ordinary trading), true only for a user holding `Administrator` or
  `Accountant` globally, or `Business Admin` in this one, specific business (the matrix,
  `userHasBusinessAdminRole`) — the exact, same three roles `requireRole`'s own fallback already
  treats as "full access within this business" everywhere else.

`Accountant` is a real, sixth global role (`backend/schema/00-core.sql`, id 910), alongside
`Administrator`/`Bookkeeper`/`Read-Only`/`Developer`/`Business Admin` — grantable globally
(`setUserRoles`) or per business (the matrix, `setUserRoleInBusiness`), the exact same way every
other role already is; no new mechanism.

Wired into the one, real, correct enforcement point: `routes/journal.ts`'s `POST /staging` and
`POST /post` — a real correction is a journal entry, posted through the General Journal, exactly
matching `ledger-scoped-accounts-and-rollover.md`'s own described use case ("a late-discovered
adjustment ... still posts entirely within the old ledger"). Deliberately **not** wired into every
other ledger-accepting route (POS sale, cash purchase, stock receive/dispatch, ...) — those are
real, ongoing operational trading, which has genuinely moved to the new ledger; the moment someone
needs to touch the old period again, that is a bookkeeping act (a journal entry), not a continued
sale.

### The real, soft switch — no forced logout, no backend restart

Nothing kills a session, and nothing restarts the backend. The only real change on rollover is the
one, real `setActiveLedger` call above. Every already-open browser tab keeps whatever ledger it last
picked (`frontend/src/lib/state.svelte.ts`'s own, client-side `session` state) until that person next
visits the Session screen — at which point `getLedgers`'s own default now prefers the real, current
active ledger (`getActiveLedger`, read by `frontend/src/routes/session/+page.svelte`) over whatever
was previously remembered. A plain Bookkeeper who keeps posting into a now-stale, non-active ledger
without ever revisiting that screen simply gets a real, clear 403 from `POST /post`/`POST /staging`
the moment they try — naturally guiding them back to the Session screen to pick up the new default,
with nothing invasive needed to force that along.

### What this does not do, honestly

This is not a hard lock — nothing stops `stageLine`/`postJournalEntry` from writing into a
non-active ledger at the database layer; the restriction is purely at the one, real route gate
above, for the one, real path (the General Journal) a genuine correction realistically takes. A
direct script/test call bypasses it entirely, exactly as every other route-level `requireRole` check
already does. Widening this gate to further routes, if a real need for it turns up, is a real,
separate, later, additive step.
