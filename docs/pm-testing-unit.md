# Testing: Unit, Sanity, and Compile-Level

This chapter covers the tests below the browser: the unit tests, their
fixtures, and the compile and structural checks. The step runner, the
tutorials and the simulations are in *Testing: The Test-Runner*.

## The testing pyramid — pick the lowest level that can prove it

Test a behaviour at the lowest level that can show it:

1. **Database**: SQL against the schema, checking what its views and
   `INSTEAD OF` triggers produce.
2. **Backend function**: calling `db.ts`, `db-stock.ts` and the other
   modules directly, with no HTTP (milliseconds a test).
3. **HTTP**: requests to the Express server (`backend/src/server.ts`),
   as the step runner's `api` path makes them.
4. **Browser**: the step runner's `ui` path, which drives the pages with
   Playwright, for what only the screen can show (layout, right-to-left
   mirroring, translations, interactive widgets). There are no
   hand-written Playwright specs (`check-step-tests`).

A scenario tested at more than one level uses the same data: the step
runner's CSV files in `shared-fixtures/` run unchanged on every path.

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

## Running the tests

Every chapter lists the tests of what it describes, under "Tests":
each line is a test's title and its file. `make check-test-docs` keeps
those lists true: every test is listed somewhere, and every listed test
exists. What kind of test a line names is told by its file, and so is
how to run it:

| File | Kind | Run by |
|---|---|---|
| `backend/test/*.test.ts`, `backend/scripts/*.test.ts` | backend unit tests, Node's built-in test runner | `make test` |
| `frontend/test/*.test.ts` | frontend unit tests (logic, not rendered components) | `make test` |
| `storage_engine/test/*_test.gleam` | the storage engine's own Gleam tests | `make test-storage-engine` |
| `shared-fixtures/tests/*.csv` | standalone step-runner tests, each on a fresh database | `make test-steps` (in `make test`), `make test-steps-browser`; see *Testing: The Test-Runner*, "Standalone tests" |

`make test` runs the backend and frontend unit tests, then the
standalone tests without a browser, then `make check-manual` (*Build,
Run & Tooling*, "Gates"). It prints how many tests passed. `make test-one TEST="part of a
title"` runs only the backend tests whose titles hold it.

Unit tests prove one mechanism at a time, against small scenarios built
for it: "a multi-currency entry must balance independently per
currency", "`allocatePayment` must move Cash and Bank, not just record
a payment". They cannot catch a bug that shows only once a large,
interrelated set of data exists: that is what the full simulation is
for (next chapter).

## The fixture framework — `backend/test/fixtures.ts`

The backend unit tests are `backend/test/*.test.ts`: `db.test.ts` (most
of the backend), `cube.test.ts`, `call-dispatch.test.ts`, `auth.test.ts`,
`application-config.test.ts`, `core.test.ts` and `core-api.test.ts` (the
core middleware), and `memory-entity-driver.test.ts`; the step runner's
own tests are `backend/scripts/step-runner.test.ts`. Each test makes
its own uniquely named business with the fixtures below and reads or
writes nothing it did not create. No business is seeded, so there is no
shared business to touch.

### Why real fixtures, not fakes

Every helper in `fixtures.ts` calls the production function itself,
never a test-only substitute:

- **`freshBusiness(hint, opts?)`** calls `createBusiness`, as the New
  Business screen does, and returns `{ business, actualLedger,
  budgetLedger }`. The name is `hint` plus a unique suffix
  (`uniqueName`), so tests never collide in any order.
- **`freshLocation`**, **`freshDepartment`**, **`freshEmployee`**,
  **`freshItem`**, **`freshHierarchyValue`** call
  `createAndConfigureLocation` (a retail outlet in Adelaide unless
  overridden), `createAndConfigureDepartment`, `createEmployee`,
  `createItem` (directly under the business's `Items` root), and
  `ensureHierarchyGrouping`/`ensureHierarchyValue`. A test that needs a
  categorised item makes a `Category` value with `freshHierarchyValue`
  and tags the item with `setHierarchyParent`.
- **`getAccountBalance`**, **`findChild`**, **`findByName`**,
  **`coaCategoryRoot`** read: an account's `balance_minor` and currency,
  a named child in a `getEntityTree()` result, and a business's chart
  category (`Businesses` › business › `Chart of Accounts` › category).
- **`withBusinessSession(biz, fn)`** runs `fn` inside a session context
  for `biz` (`runInSessionContext`), for functions that read
  `Session.Business`, such as `setItemLocationLevels` and
  `createStockTake`.

### Shared accounts

A business's chart copies its groups and its prototype's leaves, but
universal leaves such as `Cash and Bank` are one entity shared by every
business (*The Entity Model*, "Chart of Accounts"). Their postings are
kept apart by business and ledger, but their `account.balance_minor`
is the sum over all businesses. So a test checks a shared account
through a ledger-scoped read (`getTrialBalance`, `getBalanceSheet`,
`getLedgerBalances`), and uses `getAccountBalance` only for an account
of its own business. `freshBusiness` uses the `English CoA` prototype
unless `coaPrototype` is given; `coaPrototype: undefined` gives a chart
of groups and universal leaves only.

### The database-connection ordering hazard

`fixtures.ts` never imports `db.ts` at its own top level. `db.test.ts`
sets `process.env.DB_PATH` to a fresh, per-run temp file *before*
dynamically `import()`-ing `db.ts`, so that module's own module-level
SQLite connection opens against the right, isolated file:

```ts
const tmpDbPath = path.join(os.tmpdir(), `sql-ledger-ts-test-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = tmpDbPath;

const db = await import('../src/db.ts');
const fx = makeFixtures(db);
```

Static imports run before any statement, so an `import` of `db.ts` at
the top of a test file or of `fixtures.ts` would open the default
database. `fixtures.ts` therefore takes the module as an argument
(`DbModule = typeof import('../src/db.ts')`), and every test file sets
`DB_PATH` and then imports dynamically, each with its own temporary
database; any other module that opens the database (`primitives.ts`,
`auth.ts`) is imported the same way. `after(() => ...)` deletes the
`.sqlite`, `-wal` and `-shm` files.

### A worked example

```ts
test('a business can be named "Equity" ...', () => {
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

The business, location and item are this test's own, so it can run in
any order with the others. (`Cash and Bank` is shared, so a real test
would read it through a ledger-scoped report; see "Shared accounts".)

## Compile-level and sanity checks

```
make check-backend-types     # tsc over backend/src and every backend script
make check-frontend          # svelte-check over frontend/
make check-unused            # tsc noUnusedLocals over src/, test/ and the step runner
make check-db-consistency    # verify-db-consistency.ts against a database
make check-function-inventory
make check-docs-coverage
make check-no-python
make check-cycles            # import cycles are exactly the listed ones
make check-schema-table-count
make knip                    # backend exports nothing imports, files nothing reaches
```

All but `check-db-consistency`, which reads a database, need no
database, browser or server. `knip` is a report, not a gate: it exits
non-zero while it finds anything. `make check-manual` runs the ones that
are manual gates (*Build, Run & Tooling*, "Gates").
