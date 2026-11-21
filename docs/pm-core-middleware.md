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
`getTranslation`, `getStockTakeSheet`) are calls like any other. The
year-end count is confirmed with `confirmStockCount` (an empty count
confirms the books' quantity) and `completeYearEndStockTake` (the
automatic option).

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
(build output, its databases and `deps/` are ignored by git). It is Gleam
compiled to Erlang and runs on the BEAM, as an HTTP service on port 8090
(`make ensure-storage-engine`). It writes SQLite through the `sqlite3`
command-line program (`sqlite_cli.gleam`, `sqlite_cli_ffi.erl`), and one
actor per database file serialises every call (`ledger.gleam`). Its Gleam
dependencies are cloned at pinned commits into `storage_engine/deps/` by
`storage_engine/fetch_deps.sh`, which `make storage-engine-deps` runs
before `test-storage-engine` and `ensure-storage-engine`.

It holds two schemas:

- **The original middleware's schema** (`priv/schema.sql`, embedded as
  `schema_sql.gleam`). This has the same tables and the same guard
  triggers as `backend/schema/00-core.sql`, on the same file,
  `backend/data/entities.sqlite`. It serves the entity driver
  (`/entities...`) and has its own posting calls (`POST /journal`,
  `POST /journal/<id>/reverse`, `GET /accounts/<id>/balance`).
- **The core's two-store schema and four calls**
  (`storage_engine/src/core_schema.gleam`, `storage_engine/src/core.gleam`).

### Its rules, and where each is enforced

| Rule | Enforced by | So it holds for |
|---|---|---|
| `entities` is append-only: no UPDATE or DELETE; a rename or move is a new row for the same `entity_id`, and the old row stays | SQLite triggers `entities_no_update`, `entities_no_delete` | every writer of the file |
| A live name is unique under its parent | trigger `entities_name_unique` | every writer |
| `journal` and `journal_line` are append-only; a mistake is corrected by reversing the entry | triggers `journal_no_update`, `journal_no_delete`, `journal_line_no_update`, `journal_line_no_delete` | every writer |
| The one permitted change to a posted entry: `journal.reversal_of`, set once | trigger `journal_reversal_of_write_once` | every writer |
| A reference is posted once | `journal.reference UNIQUE` | every writer |
| An entry has lines, and each currency in it adds up to zero (one currency never absorbs another's difference) | code, before any SQL is run: the engine's `accounting.validate_balanced` (and, in the core, per unit in `core.post`); the backend's `db-journal.ts` | posts through that code. SQLite cannot check a whole entry inside a trigger, so a raw INSERT bypassing both would not be refused |
| An entry is written whole or not at all | one transaction per post (`storage.post_journal_entry`, `core.post`) | posts through that code |
| The core: no posting in the Global Business, on or before `Locked Through`, or to an account outside the ledger | `core.post` | the core's posts |

`account.balance_minor` is a running total kept beside the journal (it is
updated on every post), not part of the append-only record; the journal
lines are the record it is checked against.

**Tests** (`make test-storage-engine`, 38 tests):
- `accounting_test`: the per-currency balance rule.
- `ledger_test`: posting, reversal and renaming through the actor.
- `core_test`: the four calls and the core's refusals.
- `constraints_test`: against the file itself. Raw UPDATE and DELETE of
  entities, journal headers and journal lines are refused by the triggers
  and change nothing, in both schemas. A rename keeps the old row. A
  reference posts once. `reversal_of` is set once. An entry whose euro
  lines do not balance writes nothing, even though its home-currency
  lines do.
- `entities_test`: a live name is unique under its parent, a rename to its own name is allowed, a rename onto another entity's live name is refused. `storage_engine_test` is the runner (`main`).

Tests:
- "a_balanced_pair_is_ok_test" (`storage_engine/test/accounting_test.gleam`)
- "an_unbalanced_pair_is_rejected_with_the_real_shortfall_test" (`storage_engine/test/accounting_test.gleam`)
- "no_lines_at_all_is_rejected_test" (`storage_engine/test/accounting_test.gleam`)
- "each_currency_must_independently_balance_test" (`storage_engine/test/accounting_test.gleam`)
- "balance_deltas_sum_per_account_test" (`storage_engine/test/accounting_test.gleam`)
- "reversing_lines_negates_every_amount_and_keeps_the_same_accounts_test" (`storage_engine/test/accounting_test.gleam`)
- "reversing_an_already_balanced_entry_is_itself_always_balanced_test" (`storage_engine/test/accounting_test.gleam`)
- "an_entity_row_can_never_be_updated_or_deleted_test" (`storage_engine/test/constraints_test.gleam`)
- "a_rename_is_a_new_version_and_the_old_one_stays_test" (`storage_engine/test/constraints_test.gleam`)
- "a_posted_entry_can_never_be_edited_or_deleted_test" (`storage_engine/test/constraints_test.gleam`)
- "a_reference_is_posted_once_test" (`storage_engine/test/constraints_test.gleam`)
- "a_reversal_is_stamped_once_and_only_on_reversal_of_test" (`storage_engine/test/constraints_test.gleam`)
- "an_unbalanced_entry_in_any_currency_writes_nothing_test" (`storage_engine/test/constraints_test.gleam`)
- "the_core_stores_refuse_every_update_and_delete_test" (`storage_engine/test/constraints_test.gleam`)
- "the_ice_trader_needs_only_a_business_and_two_postings_test" (`storage_engine/test/core_test.gleam`)
- "the_global_business_never_trades_test" (`storage_engine/test/core_test.gleam`)
- "only_the_global_business_creates_businesses_test" (`storage_engine/test/core_test.gleam`)
- "a_user_of_one_business_cannot_open_another_test" (`storage_engine/test/core_test.gleam`)
- "an_entry_that_does_not_balance_writes_nothing_test" (`storage_engine/test/core_test.gleam`)
- "a_reference_is_unique_within_a_ledger_not_across_businesses_test" (`storage_engine/test/core_test.gleam`)
- "a_locked_ledger_refuses_dates_on_or_before_the_lock_test" (`storage_engine/test/core_test.gleam`)
- "a_relation_holds_a_value_another_entity_or_yes_test" (`storage_engine/test/core_test.gleam`)
- "a_business_renames_its_own_instance_and_nobody_elses_test" (`storage_engine/test/core_test.gleam`)
- "a_renamed_account_is_still_the_same_account_test" (`storage_engine/test/core_test.gleam`)
- "money_and_quantities_balance_separately_in_one_entry_test" (`storage_engine/test/core_test.gleam`)
- "an_entry_carries_its_own_relations_test" (`storage_engine/test/core_test.gleam`)
- "copy_makes_an_independent_instance_of_a_prototype_test" (`storage_engine/test/core_test.gleam`)
- "create_with_free_name_is_ok_test" (`storage_engine/test/entities_test.gleam`)
- "create_with_taken_name_under_same_parent_is_rejected_test" (`storage_engine/test/entities_test.gleam`)
- "same_name_is_fine_under_a_different_parent_test" (`storage_engine/test/entities_test.gleam`)
- "renaming_an_entity_to_its_own_current_name_never_collides_with_itself_test" (`storage_engine/test/entities_test.gleam`)
- "renaming_onto_a_different_entitys_live_name_is_rejected_test" (`storage_engine/test/entities_test.gleam`)
- "create_and_list_entities_test" (`storage_engine/test/ledger_test.gleam`)
- "creating_a_duplicate_name_under_the_same_parent_is_rejected_test" (`storage_engine/test/ledger_test.gleam`)
- "renaming_carries_the_same_entity_id_forward_test" (`storage_engine/test/ledger_test.gleam`)
- "posting_a_balanced_entry_vivifies_accounts_and_updates_balances_test" (`storage_engine/test/ledger_test.gleam`)
- "posting_an_unbalanced_entry_writes_nothing_test" (`storage_engine/test/ledger_test.gleam`)
- "reversing_a_posted_entry_undoes_its_balances_and_is_write_once_test" (`storage_engine/test/ledger_test.gleam`)

### The backend on the engine (`ENTITY_DRIVER=gleam`)

Under `ENTITY_DRIVER=gleam`, only the backend's **entity** reads and
writes go to the engine. Its **accounting** (journal headers, lines and
account balances) is still written by the backend's own better-sqlite3
connection to the same file. That accounting is held by the triggers
above and by `db-journal.ts`'s balance check, not by the engine's posting
calls, which the backend does not use.

The default is `sql` (`backend/src/entity-driver-select.ts`) because the
two clients deadlock. Several backend functions write accounting rows
inside one better-sqlite3 transaction and then write an entity through
the engine. With the database in WAL mode, there is one writer at a
time: the transaction holds the write lock while the engine waits for
it, until SQLite's busy timeout gives up with "database is locked".

Measured on 21 November 2026 (`ENTITY_DRIVER=gleam make
test-e2e-tutorial MIDDLEWARE=legacy`):
- 18 of the Retail tutorial's 75 steps fail.
- 7 of them fail on the lock: Create Business, Create Location, Cash
  Purchase (twice), Add Location and Delete Department through the
  structure popup, and Receive Into Storage.
- The other 11 follow from those: stock that was never received, so P&L
  checks that cannot pass.
- The commit before that day's work (`6cde7b4`) fails the same 18 steps.

The way out is to restructure each such function so its entity writes
happen before its transaction opens, or to route the backend's posting
through the engine as well. Neither is done yet.

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
