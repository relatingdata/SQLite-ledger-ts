# sql-ledger-ts

A small application over a deliberately minimal schema: **one entities
table**, one `account` extension, one `translation` extension, and a
journal/journal_line/staging trio for postings. See `backend/schema.sql`
for the full design notes — every structural decision is explained there,
in comments, next to the SQL it applies to.

**New to this app?** See [`USER_GUIDE.md`](./USER_GUIDE.md) — a
walkthrough for actually using it, with a real, verified sample business
(its own Actual and Budget ledgers, real transactions posted to each,
real report numbers). This README is the developer/schema reference.
For the story behind why a business ends up needing this kind of
software, and each screen introduced in the order a real business
would actually need it, see [`docs/user-manual.md`](./docs/user-manual.md).
For a real design (not yet built) on how a foreign-currency receipt or
payment should work in this app's own architecture, see
[`docs/foreign-currency-receipts-and-payments.md`](./docs/foreign-currency-receipts-and-payments.md).
For a real, staged plan (not yet built) taking Wine Retail Company from
a sole trader through a partnership to an incorporated company —
written specifically to exercise the parts of this app a routine month
of trading doesn't reach — see
[`docs/business-evolution-plan.md`](./docs/business-evolution-plan.md).

## Quick start

```bash
make install
make dev      # backend :3001, frontend :5173, together
```

### If `make install` warns about blocked install scripts

Newer npm versions (11.16+, and the default from npm 12 onward — this
could already be your version) block a dependency's own install
scripts unless explicitly approved, a real, recent supply-chain-safety
feature (npm RFC #868). `esbuild` (a real dependency of Vite, used by
the frontend) needs its own postinstall script to download its native
binary — if npm blocks it, the frontend dev server can fail later with
a confusing "missing binary" error, not at install time. Fix:

```bash
cd frontend && npm approve-scripts --allow-scripts-pending && npm install
```

(Older npm versions won't show this warning at all — nothing to do.)

### If `make dev`/`make backend` fails with `SqliteError: database disk image is malformed`

`backend/data/entities.sqlite` is real, per-install runtime data —
deliberately not committed to git (see `.gitignore`) — regenerated
fresh from `schema.sql` automatically the first time the backend
starts. If a previous run was interrupted mid-write (a killed process,
a full disk, a crash), the leftover file can be left corrupt, and
since `make install` never touches this file, a corrupt one will
silently persist across reinstalls. Fix — delete it and let the
backend recreate a fresh one:

```bash
make reset-db
make dev
```

Open http://localhost:5173 — you'll land on a login screen. The default
account is **username `admin`, password `changeme123`** — this is
intentionally not a secret (it's in this README and in `schema.sql` in
plain sight), it exists only so the first login works at all. **Change
it immediately** via Setup → Users, or create your own Administrator
account and deactivate this one.

Or manually, in two terminals:

```bash
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

Open http://localhost:5173.

## What's here

- **Choose business, ledger, and language** (`/session`) — the actual
  startup choice screen: every other page redirects here first if
  nothing's been chosen yet, persisted via localStorage (fine here —
  this is a real standalone app, not a Claude artifact). The chosen
  language drives `translations` (`src/lib/translations.ts`), read
  through `Save`/`Delete`/`Debit`/`Credit`/etc. wherever those vocabulary
  words appear in the UI (the Structured Editor's buttons, the Post
  Journal Entry form's field labels) — falling back to English for
  anything not yet translated in the chosen language, same as the
  backend's `localized_text` view does.
- **Entity Tree Report** (`/`) — the whole entity table, walked from its
  one root, in hierarchy order, rendered with `@keenmate/svelte-treeview`.
- **Structured Editor** (`/editor`) — create, rename, reparent, change the relation of,
  or delete any entity; assign account numbers.
- **Journal Entries** (`/journal`, `/journal/[id]`) — list and full detail
  of every posted transaction.
- **Post Journal Entry** (`/post`) — stage lines one at a time, then post
  atomically: the whole entry is validated to sum to zero and moved to
  the real tables, or none of it is, staging left untouched either way.
  Defaults to the business/ledger chosen at the picker.
- **Reports** (`/reports`):
  - **Trial Balance** — every posted account, debit or credit.
  - **Balance Sheet** — Assets, Liabilities, Equity, with a real
    Assets = Liabilities + Equity check, including a synthetic *Current
    Year Earnings* line for any net income not yet formally closed to
    Retained Earnings (without it the equation only holds at the instant
    books are closed — a real bug an early test caught: `62345 != 0`).
  - **Profit and Loss Statement** — Income, Expenses, and Net Income.
  - **Compare Ledgers** — Actual vs. a budget or scenario, side by side
    (Trial Balance and P&L both), with a variance column.

## Schema highlights (see `backend/schema.sql` for the full story)

- `entities(id, name, parent_id, relation_id)` — no `entity_type_id`, no
  type/instance distinction. A category, a business, a customer, a piece
  of UI vocabulary are all just rows here.
- `account` and `translation` are genuine *extensions* of specific
  entities (not competing concepts) — `account` 1:1 via shared primary
  key, `translation` 1:many, both looked up by name through their own
  views (`account_entry`, `translation_entry`).
- Money is always integer minor units (`amount_minor`, `balance_minor`), never
  a float.
- Posting a transaction is one atomic operation (`post_journal_entry`) —
  it validates, vivifies any not-yet-seen account, moves staged lines to
  the permanent tables, updates balances, and clears staging, or none of
  that happens at all.
- i18n: `Save`/`Cancel`/etc. exist as single, global vocabulary entities;
  translating one is one row in `translation`, read back through
  `localized_text` with automatic fallback to the canonical (English)
  name for anything not yet translated. Three languages are seeded:
  English (canonical, needs no translation row), German (15 of the 16
  vocabulary words translated, including `Soll`/`Haben` — the actual
  standard German accounting terms for Debit/Credit, not a literal
  word-for-word guess), and Klingon (`Save` → `choq`, real attested
  vocabulary from *The Klingon Dictionary* — everything else falls back
  to English, same mechanism as any partially-translated language, no
  special-casing).

## Frontend stack

Svelte 5 + SvelteKit 2. The Entity Tree Report page uses
[`@keenmate/svelte-treeview`](https://github.com/KeenMate/svelte-treeview)
for the actual tree rendering — real entity data is converted from the
flat `parent_id` structure into the library's dot-separated path format
via `src/lib/treeAdapter.ts`.

## Current state (for someone reviewing this as a snapshot)

See `SQL_LEDGER_MAPPING.md` for a table-by-table comparison against the
real SQL-Ledger PostgreSQL schema — what's covered, what's partial, and
what's an honest, named gap (payroll and audit trail specifically).

**Fully built, tested, wired into the UI:** entities/account/translation/
journal/staging schema; atomic posting with genuine per-ledger isolation;
business reports via `relation_id`; trial balance, balance sheet, P&L,
and Actual-vs-another-ledger comparison; the session picker; the full
vocabulary sweep (every nav label, heading, column header sourced from
`Vocabulary`, not hardcoded); Setup/Structured Editor; **contacts**
(phone/address, a 1:1 extension exactly like `account`, wired into the
editor, with a documented full-replace-not-merge upsert behavior).

**Schema built and numerically proven, no execution engine or UI yet:**
transaction templates (`template_field`/`template_line`/
`template_override`) — a "Credit Sale" template exists as real data,
with fields and a GL mapping that computes to a genuinely balanced
6-line entry (verified against the actual schema, not just a prototype).
What's missing: the backend function that takes user-entered field
values, evaluates the formulas, and posts through `post_journal_entry`;
the master/override resolution wired to routes; any entry-screen UI.

**Discussed, designed in direction, not started:** AP/AR entry screens,
stock control, profit centers, business legal structure and recursive
ownership, per-division default language, a scoped-down BPMN-like
workflow engine (sequential/parallel/exclusive flow, user tasks tied to
roles, durable per-instance state) — the natural next step once
authentication and roles exist, since routing rules need someone to
route to.

**Now built:** authentication and role-based authorization —
`users`/`roles`/`user_roles`/`sessions` as dedicated tables (not
entities, deliberately — auth is infrastructure, not accounting domain
data), scrypt-hashed passwords, session tokens, and three roles
(Administrator, Bookkeeper, Read-Only) enforced on every route. Verified
live: a Read-Only user can read the journal but is correctly blocked
(403) from posting. **Not yet built:** an audit trail of who did what,
and self-service password changes for non-administrators (currently
only an Administrator can reset a password, including their own).

## Testing

`backend/test/` — 54 backend tests across four files, plus 10 frontend
tests, all via Node's built-in test runner (`node:test`). Run with
`make test`.

- `db.test.ts` — entity CRUD, financial statements, i18n, staging/posting
  (including atomicity and the isolation bug that was once real, proven
  fixed), recurring journals (including the exact wage-increase
  amendment scenario), and the realistic transaction set (cash
  purchase/sale, AR sale/receipt, AP purchase/payment) checked through
  every statement.
- `auth.test.ts` — password hashing, login/logout, session validation
  and expiry, role assignment, deactivation killing live sessions
  immediately, and duplicate-username/short-password rejection.
- `frontend/test/journalGrid.test.ts` — the General Journal grid's pure
  logic (auto-balancing trailing row, the feedback-loop bug from before,
  proven fixed).

**A real, deliberate policy, not an oversight**: this app no longer
supports upgrading an existing database in place. Every real schema
change lives only in `schema.sql` itself — a new column, table, or
trigger is a direct edit there, applied fresh via `make reset-db`,
never a separate, conditional "does this old database have the new
column yet?" migration function. `db-seed.ts` still runs real, pure
data-seeding logic at startup (real entities, translations, and demo
data that's genuinely easier to generate programmatically than as
static SQL) — but it's no longer framed as migrating anything, and
never does schema surgery.
