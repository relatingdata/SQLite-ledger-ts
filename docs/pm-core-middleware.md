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
| `screens.ts` | `CORE_API_REGISTRY` and `CORE_VERIFY_REGISTRY`: the screens of `shared-fixtures/screens.csv` served by the core; `openCore`, `resetCore`, `coreSessionStep`, `CORE_DB_PATH`. |

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
- People and plant: `clockInToProject`, `clockOutOfProject`, `clockPlantIn`,
  `clockPlantOut`, and `payWages` (returning a `Payslip`). The Medicare levy
  and superannuation rates are relations of the business, defaulting to the
  statutory figures.
- Corrections and period end: `reverseEntry`, `lockLedger`, `closeBooks`,
  `createLedger`, `rollover`. Each ledger has its own accounts; `rollover`
  carries balances forward as the new ledger's opening entry.

The legacy helper `ensureServiceItem` in `db.ts` has the same purpose as the
core's own lazily created `Labour` and `Plant Hire` service items.

## Running it

`make test-e2e-tutorials` runs the Retail, Manufacturing and Project Builder
fixtures through the API path on the core, which is the default for
`test-e2e-tutorial`, `test-e2e-manufacturing-tutorial` and
`test-e2e-project-builder-tutorial`. `MIDDLEWARE=legacy` runs the same
fixtures on the original middleware, which also needs the storage engine
server started by `ensure-storage-engine`. The core keeps its own database,
`backend/data/core.sqlite`, removed by `make reset-db`. A run with any
failed step now exits non-zero.

## What is not yet served by the core

- The running backend server, `/api/call`, and the web and text frontends.
  The browser-path tutorial targets therefore still run on the original.
- The Gleam storage engine holds the same two-store schema and the four
  calls in `storage_engine/src/core.gleam`, but the core here runs on an
  in-process SQLite store, not through that engine.
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
- "wages: hourly or salaried, with the two rates as relations of the business"
- "closing the books, then a new ledger with its own accounts"
- "copy makes an independent instance of a prototype"
- "reopening the store rebuilds the same state from the two tables"
