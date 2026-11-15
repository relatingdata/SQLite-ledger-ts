# The Core Middleware

`backend/src/core/` is the simplified middleware: the layer that turns a
form into rows in two stores, using four calls. It serves the three
tutorial fixtures through the API path and is the design the rest of the
backend is being moved onto. The original `db.ts` family is still what the
running server and the web frontend use.

## The design in one page

**Two stores, and nothing else** (`store.ts`, `CORE_SCHEMA`, class `Store`):

- `entities` holds every thing and every relation of a thing: an id, a
  name, a parent, an optional relation to another entity, who wrote the
  row and when. It is append-only; a change is a newer row for the same id.
- The journal holds every amount. The header (`journal`) has the entry and
  its date. Each line (`journal_line`) has the entry, the account and the
  amount. Business, ledger, reference, description, user, reversal and
  recurrence are not columns: they are entities, or relations of entities.

The current row of every entity is also kept in memory so that walking the
tree costs no queries. SQLite remains the only record; the index is rebuilt
on open and after any failed transaction.

**Three globals.** `Core.open(user, business, ledger)` returns an
`Instance`. The user, the business and the ledger are fixed for its life
and are never passed to a call. Every row written is stamped with the user;
every name is looked up inside the business; every account and entry lives
inside the ledger.

**One rule for relations.** Everything recorded about a thing is a
relation: a child of the thing, named after the relation, whose relation
column holds its target. The `Target` is a value (a child of the relation
whose name is the value), another entity, or the entity `Active` for yes.

**Four calls** on an `Instance`: `create(name, parent)`,
`relate(thing, relation, target)`, `copy(prototype, under)` and
`post(reference, lines, options)`. `post` refuses an entry in the Global
Business, on or before the ledger's `Locked Through` date, naming an
account outside the instance's ledger, or whose lines do not add up to zero
within each unit. Refusals are `Refused`; a missing name is `NotFound`.

**Global first, local on first use.** `Application` sits beside
`Businesses` and holds the prototypes and defaults: vocabulary, menus,
roles, contact types, location types, hierarchies and the chart of
accounts. A lookup (`Instance.lookup`, `label`) tries the business first
and then Application, and creates nothing. The first write makes a local
instance related `Instance Of` to the global one (`Instance.localise`,
`chartAccount`). Renaming is renaming the local instance, so a business can
show "Income Statement" for "Profit and Loss Statement".

**The Global Business** (`GLOBAL_BUSINESS`) exists from installation with
its own `admin` user and Administrator role. It is the only place a
business can be created from, it has no ledger, and it never trades.
Users and roles belong to a business; there is none above the businesses.

**Mandatory headers and the minimal Cartesian product.** Four header
accounts (`HEADERS`) are mandatory in every business: Sales Revenue, Cost
of Goods Sold, Inventory and Write-offs. The posting accounts under each
are the Cartesian product Location × Item (`Product`,
`Instance.productAccount`). A dimension the business does not use drops
out: with neither, the null product is one simple posting account,
`General`; with items only there is one account per item; with both, one
per item at each location. An account of the product is created by the
first posting that needs it. Quantities live beside the money under
`Quantities` (`Instance.quantityAccount`), in the item's own unit, and
commitments under `Memorandum` (`Instance.memoAccount`); neither appears on
a statement. `ACCOUNT_TYPES` names the five statement types.

## Files

| File | What it holds |
|---|---|
| `store.ts` | `CORE_SCHEMA`, `Store`, `Node`, `Line`, `DateRange`: the two stores and the in-memory index. |
| `core.ts` | `Core` (installation, entity helpers, `open`), `Instance` (the globals, the four calls, lookups, accounts), `Refused`, `NotFound`, `Target`, `Product`, `PostOptions`, `today`. |
| `ops.ts` | What the business does, written only in terms of the four calls. |
| `reports.ts` | `trialBalance`, `profitAndLoss`, `balanceSheet`, `profitAndLossByAxis`, `inventoryListing` and their result types `TrialBalance`, `ProfitAndLoss`, `BalanceSheet`, `AxisNode`, `InventoryGroup`. |
| `api.ts` | The frontend API: `CORE_CALLS` (every function a form or report calls, with its positional `params`), `callCore` (one request of the protocol in, a `CoreReply` out), token sessions, `openCore`, `resetCore`, `CORE_DB_PATH`. |

Outside `core/`: `backend/src/routes/core-call.ts` (`coreCallRouter`) serves `callCore` over HTTP, and `backend/scripts/core-api-client.ts` (`CoreApiClient`, `ApiReply`, `CORE_API_VERIFY`, `runStepViaFrontendApi`) is the step runner's client of it.

## Operations (`ops.ts`)

Configuration records things and their relations:

- Businesses and users: `createBusiness` (`NewBusiness`), `createUser`,
  `userRoles`, `setUserRoles`.
- Banking: `nominateBankAccount`, `buildBankCurrencyStructure`.
- Things: `createLocation` (`NewLocation`), `createItem`, `isStorable`,
  `createContact`, `createEmployee`, `setEmployeeManager`, `createPlant`,
  `ensureSkill`, `tagSkill`, `setItemSource`, `itemSource`.
- Hierarchy: `setGroup`, `groupOf`, `createDepartment`, `deleteDepartment`,
  `setEmployeeDepartment`, `renameByName`.
- Recipes (bills of materials, prototypes, proposals, projects):
  `RecipeLine`, `setLine`, `getLines`, `recipeOwner`, `createPrototype`,
  `instantiateProposal`, `acceptProposal`, `scheduleRisk`, `projectMargin`.

Each transaction posts one entry: one event, however many lines, with money
and every quantity unit each adding up to zero on their own.

- Trading: `purchase` and `sell` take a `Trade`. Only the item, the
  quantity and the unit amount are required. With no counterparty the trade
  is for cash; with no location the business does not distinguish its
  places; tax and the order delivered are optional. `payment` settles a
  contact's account.
- Orders: `placePurchaseOrder` posts only to counter accounts, so an order
  changes nothing the business reports; `onOrder` reads what remains.
- Stock: `receiveStock`, `dispatchStock`, `transferStock`, `writeOff`,
  `stockTake`, `openContainer`. A service item (Storable = no) is refused
  by all of them.
- Cost of stock leaving (a sale's cost of goods sold, a transfer, a
  write-off, stock missing at a count) is first in, first out, per item and
  location. Nothing extra is stored: the layers are read back from the
  journal, each entry that brings a quantity into On Hand with value into
  Inventory being one layer at the cost it was bought at. A transfer arrives
  at its destination as the very layers that left the source. Stock found
  at a count during the year is valued at the latest layer's unit cost.
  Value posted with no quantity stays with the newest layer, so the layers
  always add up to the Inventory account.
- The year-end stock take (`stockTake` with `StockTakeOptions.yearEnd`) is
  the count the year's accounts rest on. It is recorded even when it agrees
  with the books (with the count as its `Counted` relation, and marked
  `Year End Count`), values any difference at the average cost held, and
  merges the item's layers at that location into one at their average
  cost.
- The year-end count is per item per location. `stockTakeSheet` lists
  each item at each location (`CountLine`: what the books hold and any
  count confirmed for the date) for a point-of-sale terminal or a phone
  app; `confirmCount` confirms one line, with the number counted or, left
  empty, the books' quantity; `completeYearEndStockTake` is the automatic
  option, confirming every line not yet confirmed at the books' quantity.
  Over the frontend API these are `getStockTakeSheet`, `confirmStockCount`
  and `completeYearEndStockTake`.
- The business trades on in the new ledger while the count is done. A
  year-end count confirmed after the old year was closed and rolled over
  corrects both ledgers: in the old one, the write-off (or write-on) dated
  at the year end, closed to Retained Earnings by a further closing entry
  if the year's books were already closed; in the new one, the same
  quantity and value in its opening stock, dated its opening date, against
  Retained Earnings and the quantity brought forward, so the new year's
  profit is untouched. `rollover` records the link: the old ledger's
  `Carried Forward To` relation and the new ledger's `Opened On`.
- People and plant: `clockInToProject`, `clockOutOfProject`, `clockPlantIn`,
  `clockPlantOut`, and `payWages` (returning a `Payslip`). The Medicare levy
  and superannuation rates are relations of the business, defaulting to the
  statutory figures.
- Corrections and period end: `reverseEntry`, `lockLedger`, `closeBooks`,
  `createLedger`, `rollover`. Each ledger has its own accounts; `rollover`
  carries balances forward as the new ledger's opening entry, in which each
  item's stock at each location arrives as one layer at its average cost:
  the cost the year-end stock take established.

The legacy helper `ensureServiceItem` in `db.ts` has the same purpose as the
core's own lazily created `Labour` and `Plant Hire` service items.

## The frontend API

The core is reached through one endpoint and the same plain-text protocol
the frontends already speak to `/api/call`:

```
request   functionName,value1,value2,...     one CSV line, positional
reply     ok,value1,value2,...               a single result
          ok\n<CSV table with header row>    a list
          error,message                      400 refused, 401 not signed in,
                                             404 not found, 500 anything else
```

`login,username,password` replies `ok,<token>`; every other call sends
`Authorization: Bearer <token>`. The token's session holds the user, the
business and the ledger: the three globals of the instance that serves each
call, so an operation never receives them. `selectBusiness` and
`switchSession` change them; `whoAmI` reports them; `logout` ends the
session. A form that still carries a business or ledger field uses it only
to choose which of the user's instances serves that one call; left empty,
the session's are used.

Each entry of `CORE_CALLS` lists its `params` in the order of its screen's
fields in `shared-fixtures/screens.csv` (checked by a unit test). Reads
(`exists`, `getTrialBalance`, `getProfitAndLoss`, `getBalanceSheet`,
`getProfitAndLossByAxis`, `getInventoryListing`, `getUserRoles`,
`getRecipeLines`, `getProject`, `getEntry`, `getItemSource`, `getGroup`,
`getTranslation`) are calls like any other.

The server always mounts it at `/api/core/call`; started with
`MIDDLEWARE=core` it also serves `/api/call`, otherwise `/api/call` stays
on the original middleware. `PORT` sets the server's port (default 3001).

## Running it

The step runner drives every core step through the frontend API, exactly
as a frontend would: session screens become `login`, `selectBusiness` and
`switchSession`; data screens call their `api_function` with the step's
values; every verify (`CORE_API_VERIFY`) is answered by API reads. By
default the calls go to `callCore` in-process; with `STEP_RUNNER_API_URL`
set they go over HTTP to a running server.

- `make test-e2e-tutorials` runs the Retail, Manufacturing and Project
  Builder fixtures on the core through the in-process API. This is the
  default for `test-e2e-tutorial`, `test-e2e-manufacturing-tutorial` and
  `test-e2e-project-builder-tutorial`.
- `make test-e2e-tutorials-http` starts the backend with `MIDDLEWARE=core`
  on `CORE_HTTP_PORT` (default 3101), runs the same fixtures over HTTP, and
  stops the server.
- `MIDDLEWARE=legacy` runs the fixtures on the original middleware, which
  also needs the storage engine server started by `ensure-storage-engine`.
- `make test-storage-engine` runs the Gleam storage engine's own tests.

The core keeps its own database, `backend/data/core.sqlite`, removed by
`make reset-db`. A run with any failed step exits non-zero.

## The storage engine

The Gleam storage engine lives in the repository at `storage_engine/`
(build output, its databases and `deps/` are ignored by git). Its Gleam
dependencies are cloned at pinned commits into `storage_engine/deps/` by
`storage_engine/fetch_deps.sh`, which `make storage-engine-deps` runs before
`test-storage-engine` and `ensure-storage-engine`. It holds the same
two-store schema and the four calls (`storage_engine/src/core_schema.gleam`,
`storage_engine/src/core.gleam`), and serves the original middleware's
entity driver.

## What is not yet served by the core

- The web and text frontends still call `/api/call` on the original
  middleware unless the server is started with `MIDDLEWARE=core`; the
  browser-path tutorial targets therefore still run on the original.
- The core runs on an in-process SQLite store, not through the Gleam
  storage engine.
- Menu access by role, recurring entries, and translations beyond a single
  relation per language.

## Unit tests (`backend/test/core.test.ts`)

- "the ice trader: a business, one item, and two entries"
- "the null product is one simple posting account under a header"
- "using locations adds the second dimension, and nothing else changes"
- "the Global Business creates businesses and never trades"
- "users and roles belong to a business"
- "lookup is local first; renaming is renaming the local instance"
- "a relation holds a value, another entity, or yes; setting one touches no other"
- "an entry must add up to zero within each unit, and a refused entry leaves nothing behind"
- "the journal holds only the entry and its date, the account and the amount"
- "an entry cannot name an account of another business or ledger"
- "a locked ledger refuses dates on or before the lock"
- "a service item is ordered and sold, never stocked"
- "buying and selling on credit, tax, and payment"
- "an order is a commitment; a delivery related to it releases it"
- "write-off, stock-take and reversal"
- "stock leaves first in, first out, at the cost each receipt was bought at"
- "the year-end stock take averages the cost of what is held, and the new ledger starts from it"
- "the year-end count is per item per location, confirmed by hand or automatically"
- "a count confirmed after the new year opened corrects both ledgers"
- "wages: hourly or salaried, with the two rates as relations of the business"
- "closing the books, then a new ledger with its own accounts"
- "copy makes an independent instance of a prototype"
- "reopening the store rebuilds the same state from the two tables"

## Unit tests (`backend/test/core-api.test.ts`)

- "the frontend API refuses a call without a session, an unknown function, and a wrong password"
- "the session holds the user, the business and the ledger; a form never has to send them"
- "every function's values are in the order of its screen's fields in screens.csv"
