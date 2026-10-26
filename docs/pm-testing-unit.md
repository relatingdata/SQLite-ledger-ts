# Testing: Unit, Sanity, and Compile-Level

Two genuinely different kinds of testing exist in this project. This
chapter covers everything below the browser: the testing pyramid's
lower levels, the unit-test suite, its fixture framework, and the
compile/type/lint checks. The test-runner, the Tutorial fixture, and
the full-volume/full-year simulation are covered in the next chapter.

## The testing pyramid — pick the lowest level that can prove it

Before reaching for Playwright/browser testing, always ask whether the
thing being tested is provably backend-only. If so, reproduce and
verify it at the lowest possible level:

1. **Database level.** Raw SQL directly against the real schema —
   `INSERT`/`UPDATE` statements hitting real tables, checking that
   views and triggers produce the right result. No TypeScript. The
   fastest, most isolated layer.
2. **Backend function level.** Calling `db.ts`/`db-stock.ts` functions
   directly — no HTTP, no browser. Milliseconds, not minutes.
3. **HTTP/API level.** Real requests against the real Express routes.
4. **Browser/E2E level (Playwright).** Reserved for what is genuinely,
   irreducibly about the UI itself — layout, RTL mirroring, translation
   rendering, interactive widgets.

**Shared ASCII fixtures across every level.** When one scenario needs
testing at more than one level, every level reads the exact same,
small, named ASCII fixture (`shared-fixtures/*.csv`, read identically
by backend scripts and Playwright tests) — never a separate, per-level
copy of "similar enough" test data.

## The one non-negotiable check every transaction must pass

Every transaction in this application — however entered, whatever
screen or script produced it — must end up posted in the General
Journal, and from there be fully inspectable via the Trial Balance.
This is the single, unifying correctness check for the whole
double-entry design:

- Any action that changes money, stock quantity, or any other
  ledger-tracked fact must post through the established journal
  mechanism (`stageLine`/`postJournalEntry`, or the quantity-movement
  equivalent) — never a silent, direct table mutation that never
  reaches a journal line.
- After any transaction, the General Journal must show it, and the
  Trial Balance, run for the relevant ledger/date range, must still
  balance (debits equal credits) and correctly reflect the new
  figures.
- This is the first thing to check when a screen's own "success"
  message is suspected of being misleading — open the General Journal
  and the Trial Balance directly, rather than trusting the originating
  screen's own account of what happened.

## Unit tests — `make test`

```
make test
```

Runs the backend (`cd backend && npm test`, Node's own built-in test
runner) and frontend (`cd frontend && npm test`) suites. Fast (a few
seconds), exercises individual functions against small, synthetic
scenarios constructed to prove one thing at a time — e.g. "a
multi-currency entry must balance independently per currency," or
"`allocatePayment` must actually move Cash and Bank, not just record
that a payment happened."

**Current count**: 231 backend tests (`test/db.test.ts`: 200,
`test/auth.test.ts`: 17, `scripts/step-runner.test.ts`: 14), 24
frontend tests, all passing. Re-run `make test` rather than trusting
this count going forward.

Unit tests are the right tool for proving a specific mechanism is
correct in isolation. They are the *wrong* tool for catching a bug
that only shows up once large-scale, interrelated data exists — see
the next chapter for why the full simulation exists as a separate,
necessary check.

## The fixture framework — `backend/test/fixtures.ts`

`test/db.test.ts` is the application's single backend unit-test file.
Every test creates its own, uniquely-named, real business, then
layers on only the specific fixtures it needs — the one absolute
rule: **no test anywhere in this suite reads or writes the shared
`'admin'` business, or any other globally-seeded business or
account.**

### Why real fixtures, not fakes

Every helper in `fixtures.ts` is a thin, named wrapper around a real
`db.ts` production function — never a cut-down, test-only substitute:

- **`freshBusiness(hint, opts?)`** calls the real `createBusiness` —
  the exact function the setup wizard itself calls — and returns the
  real `{ business, actualLedger, budgetLedger }` it creates. `hint`
  becomes a readable name prefix (`'Equity'`, `'Tier/Leaf Test'`); the
  final name carries a collision-free suffix (a counter plus a few
  random characters), so two tests run in any order, or concurrently,
  can never collide on the same business name.
- **`freshLocation`**, **`freshItem`**, **`freshHierarchyValue`** are
  the same pattern one level down: each calls the real
  `createAndConfigureLocation`, `createItem`, or
  `ensureHierarchyGrouping`/`ensureHierarchyValue`, pre-filled with
  sensible, overridable defaults (a location defaults to an ordinary
  retail outlet in Adelaide; `freshItem` always creates the item flat,
  directly under the business's `Items` root — the same, real,
  category-free path `createItem` always uses — since Category is a
  separate, optional `Hierarchy` tag now, never a required real
  position in the Items catalog tree; a test that specifically needs a
  tagged category calls `freshHierarchyValue(business, 'Category',
  hint)` and tags the item itself with `setHierarchyParent`).
- **`getAccountBalance`**, **`findChild`**, **`findByName`**,
  **`coaCategoryRoot`** are read-side helpers — thin wrappers around
  one repeated query shape (walk `Businesses → <business> → Chart of
  Accounts → <category>`, or find one named child in a
  `getEntityTree()` result).
- **`withBusinessSession(biz, fn)`** runs `fn` with `biz` as the
  current session context, for the small number of functions
  (`setItemLocationLevels` and similar) that read
  `Session.Business`/`Session.UserId`/`Session.Ledger` directly rather
  than taking them as explicit parameters.

### The one isolation hazard: the Chart-of-Accounts prototype fallback

A business created **without** a `coaPrototype` gets a genuinely empty
Chart of Accounts. A prototype-tagged account name like `'Cash and
Bank'` or `'Sales Revenue'` then falls back, by a documented
`COALESCE` in `post_journal_entry`'s own trigger (`schema/00-core.sql`
and `copyChartOfAccountsInto`'s comments in `db.ts`), to the **one,
single, global template copy** — shared across every other business
that also omitted a prototype. A fixture business that will stage or
post to any such named account must pass `coaPrototype: 'English CoA'`
(the built-in prototype every demo business already uses) for true
per-test isolation. `freshBusiness` defaults to `'English CoA'` for
exactly this reason; a test passes `coaPrototype: undefined` only when
it exercises nothing but bare entity-tree/structural mechanics, with
no named financial account anywhere in it.

### The database-connection ordering hazard

`fixtures.ts` never imports `db.ts` at its own top level. `db.test.ts`
sets `process.env.DB_PATH` to a fresh, per-run temp file *before*
dynamically `import()`-ing `db.ts`, so that module's own module-level
SQLite connection opens against the right, isolated file:

```ts
const tmpDbPath = path.join(os.tmpdir(), `sql-ledger-ts-test-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = tmpDbPath;
process.env.SEED_DEMO_BUSINESSES = 'false';

const db = await import('../src/db.ts');
const fx = makeFixtures(db);
```

A static, eager `import { ... } from '../src/db.ts'` at the top of
`fixtures.ts` itself would race that assignment and silently reconnect
to the wrong database (or none), depending on module-resolution
timing — so `fixtures.ts` instead takes the already-imported module in
as a plain argument (`DbModule = typeof import('../src/db.ts')`), and
every test file repeats the same `DB_PATH`-then-dynamic-import
sequence for its own, independent temp database. `after(() => ...)`
deletes the temp `.sqlite`/`-wal`/`-shm` files once the file's tests
finish.

### A worked example

```ts
test('a business can genuinely be named "Equity" ... ', () => {
  const biz = fx.freshBusiness('Equity');
  const loc = fx.freshLocation(biz.business, 'Main Store');
  const { itemName } = fx.freshItem(biz.business, 'Widget');
  // ... exercise receiving/posting against biz/loc/itemName ...
  const entities = db.getEntityTree();
  const coaRoot = fx.coaCategoryRoot(biz.business, 'Asset');
  const cash = fx.findChild(entities, coaRoot.id, 'Cash and Bank');
  assert.equal(cash?.balance_minor, /* expected */ 0);
});
```

Nothing here is shared with any other test in the file: the business,
location, and item names are all freshly suffixed, so this test can
run first, last, or concurrently with every other test and never
observe — or cause — a collision.

## Compile-level and sanity checks

```
make check-backend-types     # tsc --noEmit over backend/
make check-frontend          # svelte-check over frontend/
make check-unused            # knip — unused exports/files/deps
make check-e2e-types         # tsc --noEmit over e2e/
make check-db-consistency    # verify-db-consistency.ts — balanced entries, no orphans, referential integrity
make check-function-inventory
make check-docs-coverage
make check-no-python
make check-cycles            # import-cycle check
make check-schema-table-count
```

These are the project's current compile-time/structural safety net —
no runtime data involved, fast, and run before any slower suite. None
of them require a database, a browser, or a running server.