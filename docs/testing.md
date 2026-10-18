# Testing

Two genuinely different kinds of testing exist in this project, and
they catch genuinely different kinds of bugs. Both matter; neither
substitutes for the other.

## -1. The real testing pyramid — pick the lowest level that can prove it

Per direct, absolute instruction, confirmed by a real, own mistake in
this project's history: before reaching for Playwright/browser
testing, always ask whether the thing being tested is provably
backend-only. If so, reproduce and verify it at the lowest possible
level first:

1. **Database level.** Raw SQL directly against the real schema -
   `INSERT`/`UPDATE` statements hitting real tables, checking that
   views and triggers produce the right result. No TypeScript at all.
   The fastest, most isolated layer - and exactly where several real
   bugs in this project's own history actually lived (the
   `localized_text` view's own name-collision bugs, `createStockTake`
   silently resolving to the wrong entity).
2. **Backend function level.** Calling real `db.ts`/`db-stock.ts`
   functions directly - no HTTP, no browser. Milliseconds, not
   minutes.
3. **HTTP/API level.** Real requests against the real Express routes.
4. **Browser/E2E level (Playwright).** Reserved for what is genuinely,
   irreducibly about the UI itself - layout, RTL mirroring, translation
   rendering, interactive widgets. Confirmed, directly, a real mistake
   in this project's own history: a pure backend validation-error bug
   (a name-collision bug inside `createStockTake`) was first, wrongly,
   investigated via a Playwright browser test - adding a real login
   flow, real DOM selectors, real dev-server timing, and real
   duplicate-process risk, none of it relevant to a bug a single,
   direct function call could have exposed instantly.

**Shared ASCII fixtures across every level.** When one scenario needs
testing at more than one level, every level reads the exact same,
small, named, ASCII fixture - the same real discipline already
established for this project's seed data
(`shared-fixtures/*.csv`, read identically by backend scripts and
Playwright tests). Never let each test level invent its own, separate
copy of "similar enough" test data.

## 0. The one, real, non-negotiable check every transaction must pass

Per direct instruction: every real transaction in this application —
however it was entered, whatever screen or script produced it — must
end up posted in the real General Journal, and from there be fully
inspectable and checkable via the real Trial Balance. This is not
optional or screen-specific; it is the real, single, unifying
correctness check for the entire, real double-entry design:

- If a real action changes money, stock quantity, or any other real,
  ledger-tracked fact, it must post through the real, established
  journal mechanism (`stageLine`/`postJournalEntry`, or the real
  quantity-movement equivalent) — never a silent, direct table
  mutation that never reaches a real journal line at all.
- After any real transaction, the real General Journal must show it,
  and the real Trial Balance, run for the relevant real ledger/date
  range, must still balance (debits equal credits) and correctly
  reflect the real, new figures. A transaction that "looks" like it
  worked in its own screen but doesn't show up here, or throws the
  Trial Balance out of balance, is a genuine, real bug — regardless of
  what the screen itself reported.
- This is the real, first thing to check when a screen's own "success"
  message is suspected of being misleading (confirmed, directly, this
  session: a real receipt screen reported success while the
  underlying quantity update silently never happened at all) — open
  the General Journal and the Trial Balance directly, rather than
  trusting the originating screen's own account of what happened.

## 1. Unit tests — `make test`

```
make test
```

Runs the backend (`cd backend && npm test`, Node's own built-in test
runner) and frontend (`cd frontend && npm test`) suites. Fast (a few
seconds), exercises individual functions against small, synthetic
scenarios constructed specifically to prove one thing at a time —
e.g. "a genuine multi-currency entry must balance independently per
currency," or "allocatePayment must actually move Cash and Bank, not
just record that a payment happened."

**Current count**: 231 backend tests (`test/db.test.ts`: 200,
`test/auth.test.ts`: 17, `scripts/step-runner.test.ts`: 14), 24
frontend tests, all passing.

Unit tests are the right tool for proving a specific mechanism is
correct in isolation. They are the *wrong* tool for catching a bug
that only shows up once real, large-scale, interrelated data exists
— several of the real bugs found this project (the Trial Balance not
actually balancing once real AR/AP existed; `allocatePayment` never
reaching Cash and Bank; a sale's line items silently unable to mix
cold and warm stock) were only found by running the real simulation
and checking whether the numbers it produced were actually true, not
by any unit test.

## 1a. The fixture framework — `backend/test/fixtures.ts`

`test/db.test.ts` is the application's real, single backend unit-test
file, and until this project's own test-migration work it had a real,
hidden problem: every one of its 200-odd tests shared one, single,
globally-seeded business — `'admin'` — reading and writing its
accounts, locations, and items directly. Two tests could silently
interfere with each other through that shared state, and a test's own
"success" sometimes depended on exactly which other tests had already
run and left the `admin` business in a particular shape. Removing the
old file (once every test had been ported off it) dropped the
backend's own, full-suite failure count from 27 to 2 — real, direct
proof that most of those 27 "pre-existing" failures were never
independent bugs at all, only cross-test contamination from one file's
own shared, mutable state.

The fix is `backend/test/fixtures.ts`: a small, deliberately minimal
library (`makeFixtures(db)`) built around one, absolute rule — **no
test anywhere in this suite reads or writes the shared `'admin'`
business, or any other globally-seeded business or account.** Every
test creates its own, uniquely-named, genuinely real business, then
layers onto it only the small, specific set of further fixtures that
one test actually needs.

### Why real fixtures, not fakes

Every helper in `fixtures.ts` is a thin, named wrapper around a real
`db.ts` production function — never a cut-down, test-only substitute
of it:

- **`freshBusiness(hint, opts?)`** calls the real `createBusiness` —
  the exact same function the setup wizard itself calls — and returns
  the real `{ business, actualLedger, budgetLedger }` it creates.
  `hint` becomes a readable name prefix (`'Equity'`,
  `'Tier/Leaf Test'`); the real, final name also carries a
  collision-free suffix (a counter plus a few random characters), so
  two tests — run in any order, or genuinely concurrently — can never
  collide on the same business name even when they start from the
  same hint.
- **`freshLocation`**, **`freshItem`**, **`freshHierarchyValue`** are
  the same pattern one level down: each calls the real
  `createAndConfigureLocation`, `createItemCategory`/`create`, or
  `ensureHierarchyGrouping`/`ensureHierarchyValue`, pre-filled with
  sensible, overridable defaults (a location defaults to an ordinary
  retail outlet in Adelaide; an item is always created under a fresh
  category of its own, never directly under the bare `Items` root,
  since that shape is deliberately rejected elsewhere — see
  `isGenuineCategoryOrItemsRoot`).
- **`getAccountBalance`**, **`findChild`**, **`findByName`**,
  **`coaCategoryRoot`** are read-side helpers — thin wrappers around
  one repeated query shape (walk `Businesses → <business> →
  Chart of Accounts → <category>`, or find one named child in a
  `getEntityTree()` result) that nearly every test needed and had
  previously hand-written itself, now named once.
- **`withBusinessSession(biz, fn)`** runs `fn` with `biz` as the real,
  current session context, for the small number of functions
  (`setItemLocationLevels` and similar) that read
  `Session.Business`/`Session.UserId`/`Session.Ledger` directly rather
  than taking them as explicit parameters — it replaces the old
  file-wide `withMyBusinessSession(admin)` helper the previous test
  file shared across every test; each test now opens its own session
  against its own, fresh business instead.

### The one, real isolation hazard: the Chart-of-Accounts prototype fallback

A business created **without** a `coaPrototype` gets a genuinely empty
Chart of Accounts of its own. A prototype-tagged account name like
`'Cash and Bank'` or `'Sales Revenue'` then falls back, by a real,
documented `COALESCE` in `post_journal_entry`'s own trigger (see
`schema/00-core.sql` and `copyChartOfAccountsInto`'s own comments in
`db.ts`), to the **one, single, global template copy** — genuinely
shared across every other business that also omitted a prototype. A
fixture business that will stage or post to any such named account
must pass `coaPrototype: 'English CoA'` (the real, built-in prototype
every demo business already uses) so it gets its own, separate, real
copy — true per-test isolation, not an assumption. `freshBusiness`
defaults to `'English CoA'` for exactly this reason; a test passes
`coaPrototype: undefined` explicitly only when it genuinely exercises
nothing but bare entity-tree/structural mechanics, with no named
financial account anywhere in it.

### The database-connection ordering hazard

`fixtures.ts` never imports `db.ts` at its own top level. `db.test.ts`
sets `process.env.DB_PATH` to a fresh, per-run temp file *before*
dynamically `import()`-ing `db.ts`, so that module's own
module-level SQLite connection opens against the right, isolated
file:

```ts
const tmpDbPath = path.join(os.tmpdir(), `sql-ledger-ts-test-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = tmpDbPath;
process.env.SEED_DEMO_BUSINESSES = 'false';

const db = await import('../src/db.ts');
const fx = makeFixtures(db);
```

A static, eager `import { ... } from '../src/db.ts'` at the top of
`fixtures.ts` itself would race that assignment and silently reconnect
to the wrong database (or none) depending on module-resolution timing
— so `fixtures.ts` instead takes the already-imported module in as a
plain argument (`DbModule = typeof import('../src/db.ts')`), and every
test file that uses it repeats the same `DB_PATH`-then-dynamic-import
sequence for its own, independent temp database. `after(() => ...)`
deletes the temp `.sqlite`/`-wal`/`-shm` files once the whole file's
tests finish.

### A worked example

```ts
test('a real business can genuinely be named "Equity" ... ', () => {
  const biz = fx.freshBusiness('Equity');
  const loc = fx.freshLocation(biz.business, 'Main Store');
  const { itemName } = fx.freshItem(biz.business, 'Widget');
  // ... exercise real receiving/posting against biz/loc/itemName ...
  const entities = db.getEntityTree();
  const coaRoot = fx.coaCategoryRoot(biz.business, 'Asset');
  const cash = fx.findChild(entities, coaRoot.id, 'Cash and Bank');
  assert.equal(cash?.balance_minor, /* expected */ 0);
});
```

Nothing here is shared with any other test in the file: the business
name, the location name, and the item name are all freshly suffixed,
so this test can run first, last, or concurrently with every other
test in the suite and never observe — or cause — a collision.

### What this bought, concretely

Porting all 200 tests off the shared `admin` business surfaced real
bugs that the old, shared-state file had been quietly masking or
never exercising cleanly in the first place — the same
unscoped/ambiguous-entity-name bug class documented throughout this
manual, found again in `ensureCurrencyAccount` (`db-reports.ts`) and
`buildBankCurrencyStructure` (`db.ts`), both of which discarded a
freshly-created entity's own id and re-resolved it by bare name
instead, and both of which only broke once a test created an account
name that collided with one belonging to a different, real business —
exactly the scenario per-test fixtures are designed to make routine,
not rare. See `docs/lessons-learned.md` for the full account of these
and the other bugs this migration found.

## 2. End-to-end verification — `make test-e2e`

```
make test-e2e
```

This is the real answer to "does the whole system actually work
together correctly against real, large-scale data" — not a smoke
test, a genuine correctness check against **exact, deterministic
expected results**.

### Language/i18n testing demo businesses

Four additional demo businesses exist specifically to exercise the
application's own real translation mechanism against real,
non-English sample data at once, not as part of the core
vocabulary-vs-sample-data architecture (see Part II) — each one's own
account and product names are genuinely written in its own real
language, since that's what that business would actually use, not a
translated version of Wine Retail Business's own English data:

Table: The 4 additional demo businesses used for language/i18n testing, and their own modeled language/country

| Demo business | Its own, real, modeled language/country |
|---|---|
| BMW M GmbH | German — Germany |
| Peugeot Citroën Sochaux SNC | French — France |
| Ditta Italiana Srl | Italian — Italy |
| Schweizer KMU AG | German — Switzerland |

`language-parameterized.spec.ts` and `coa-prototype-filtering.spec.ts`
are the real, direct e2e tests exercising these. A real, honest,
current gap: their own sample data isn't yet cleanly separated at the
file level the way the vocabulary translations are — BMW, Peugeot,
Ditta Italiana, and Schweizer KMU currently all live together in
`backend/schema/20-demo-bmw-peugeot.sql` and `00-core.sql`, not each
in its own, clearly-named file.

### Why exact numbers, not ranges

The Wine Retail Business simulation
(`backend/scripts/simulate-wine-retail-month.ts`) uses a seeded
pseudo-random number generator — never `Math.random()`. Given the
same code, it produces **exactly** the same purchases, sales,
breakages, and returns, every single run, on any machine. This means
the simulation's output isn't just "plausible" — it's a precise,
reproducible fact that can be checked exactly, the same way a unit
test checks an exact expected value.

`make test-e2e` runs, in order:

1. `make reset-db` — a clean, empty database, reinitialized from
   `schema.sql`.
2. The real simulation (`simulate-wine-retail-month.ts`) — a full
   month of real trading for Wine Retail Business, posted through the
   exact same functions the real frontend calls (never raw SQL). See
   `docs/simulation-prompt.md` for the full, detailed specification
   of what it does.
3. `verify-simulation.ts` — checks the resulting database against the
   exact expected values below, failing loudly (non-zero exit code)
   if any of them differ.

### The exact expected results

These are the real, current, correct numbers for Wine Retail Business
after the simulation runs — not estimates, the literal values the
verification script checks:

Table: The exact, current expected values verify-simulation.ts checks after a full simulation run

| Check | Expected value |
|---|---|
| **Trial Balance @ 2027-03-28** | |
| Total debit | $826,836.12 |
| Total credit | $826,836.12 (must equal debit — the fundamental accounting identity) |
| Row count | 151 |
| **Balance Sheet (all time)** | |
| Total assets | $604,183.32 |
| Total liabilities | $394,565.22 |
| Total equity | $209,618.10 |
| Balanced | true |
| **Profit & Loss, 2027-03-01 to 2027-03-28** | |
| Total income | $274,016.21 |
| Total expenses | $164,425.92 |
| Gross profit | $109,840.19 |
| Net income | $109,590.29 |
| Real per-product income accounts | 72 |
| Real per-product-per-tier COGS accounts | 78 |
| **Cash movement** | |
| Cash and Bank balance (ledger-scoped) | $188,614.90 |
| Vendor (Boutique Wine Importers) balance | -$961,482.00 (partially, realistically paid — not zero, not never-paid) |
| **Sales Report, 2027-03-01 to 2027-03-28** | |
| Detailed line count | 3,598 |
| Real category count | 18 |
| Total quantity | 13,382 units |
| Total amount | $812,646.50 |

If `make test-e2e` reports every one of these as `PASS`, the system's
core accounting behavior — real per-product revenue and COGS
recognition, real cash movement on both the sales and vendor-payment
sides, a genuinely balancing Trial Balance and Balance Sheet, and a
correct sales report — is all working together correctly against
real, substantial data, not just in isolated unit tests.

### A real correction to this table's own history

The Cash and Bank check originally read `account.balance_minor`
directly. That column is a genuine, intentionally cross-business
running total (documented at `getBusinessReports` in `db.ts`: "fine
for browsing the hierarchy, not meant for financial statements") —
`Cash and Bank` is one real, shared entity across every business in
this app, not one per business, and My Business's own real $500
bootstrap sale into the same account was silently included in what
this check called "Wine Retail Business's" cash movement. Found by
directly tracing every `journal_line` ever posted to that entity,
grouped by business, not assumed correct because the number happened
to match. Fixed to use `getTrialBalance` (correctly ledger-scoped,
exactly like every real financial report already does) instead — the
genuinely correct, Wine-Retail-Business-only figure is $188,614.90, not
the previously-recorded $189,114.90.

### If a check fails

A failure means the simulation's real behavior has changed since
these values were recorded. Two possibilities, and they call for
different responses:

- **An unintentional regression** — something broke. Investigate
  directly (the same discipline used throughout this project:
  query the real, current data, don't assume either the old or new
  number is right without checking).
- **A deliberate change** — the simulation or the underlying logic
  was intentionally extended or corrected. Re-run `make test-e2e`,
  read off the new real values, and update **both**
  `verify-simulation.ts` and this table together. They must never be
  allowed to silently drift apart — a verification script checking
  against stale expected values is worse than no verification at
  all, since it gives false confidence.

## Both together, in CI or before delivering a change

```
make test && make test-e2e
```

Unit tests first (fast — fail fast on an isolated, easy-to-diagnose
bug), then the full end-to-end check (slower — the real, integrated
proof).
