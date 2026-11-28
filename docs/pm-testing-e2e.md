# Testing: The Test-Runner, the Tutorial Fixture, and Full-Volume Simulation

This chapter covers everything above the unit-test level: the step
runner, the tutorials built on it, the simulations, and the standalone
tests.

## The Step Runner

The step runner (`backend/scripts/step-runner.ts`) is the one tool for
both end-to-end testing and loading data: no other Playwright script or
seeding script exists.

### The underlying idea

An ordered sequence of steps, held in one plain, human-readable CSV
file, extending the established `shared-fixtures/*.csv` convention.
Each step can run three ways: a direct backend function call
(`--path api`, fast, no browser), a driven Playwright browser action
(`--path ui`, proving the web UI works, producing screenshots), or a
driven `@microsoft/tui-test` terminal action (`--path text`, the
terminal UI in `tui/`; see "`--path text` — driving the terminal UI"
for its state). The step is the same on every path.

**The core separation (Page Object Model + data-driven tests)**: how
to drive a screen is defined once, per screen, in a registry — never
repeated inline in the data that merely uses that screen. The data
file itself contains zero commands, zero selectors, zero field names.

### The data file — pure, positional data

One row per step. The screen/action name first, then its values in
plain, positional order:

```csv
"Login","admin","changeme123","English"
"Create Business","Wine Tutorial Business","2026-27","Sole Trader"
"Create Location","Main Street Cellar","Adelaide","Retail"
```

No header row, no selector, no JSON, ever — the screen registry (next)
says what position 1, 2, 3... mean for a given screen name. A line
starting with `#` is a free-text comment attached to the next data
row, shown before that step runs, in `--pretty` or any actual run.

Three directives are not steps; they shape the steps around them:

- **`"Include","common/x.csv"`** puts every step of that file (and of
  its own control file) here, the path relative to the including file.
  A file that includes itself, directly or through another, is an
  error.
- **`"Set","name","value"`** sets a variable for every row after it,
  included files too.
- **`"Default","name","value"`** sets it only when it is not set yet,
  so a shared file names its own defaults and the including file
  overrides them.

`${name}` in any value, and in any control row, is the variable's
value; a variable never set is an error naming the file and line. A
directive's own control row is ignored. Steps are numbered 1 to n in
the order they run, includes expanded.

```csv
"Set","business","Supplier Co"
"Include","../common/business.csv"
"Create Sales Invoice","${business}","${customer}","INV-100","12500","manual"
```

### The screen registry — `shared-fixtures/screens.csv`

Header row: `screen_name,screen_kind,ui_path,open_selector,
api_function,submit_selector,position,field_name,field_selector,
field_type`. One row per field a screen accepts. A data file beside
its own `screens.csv` uses that one; any other uses
`shared-fixtures/screens.csv`.

- **`screen_name`**: matches a data file's first column.
- **`ui_path`**: where this screen lives (blank if a prior step
  already navigated there).
- **`open_selector`**: an optional click needed before fields become
  visible. `{{field}}` in it is that field's value, so one screen
  serves every name (`Set Bom Component` opens the assembly it names).
- **`api_function`**: the direct backend function this screen's
  submit corresponds to (blank for a UI-only screen).
- **`submit_selector`**: the button that finalizes the screen.
- **`position`/`field_name`/`field_selector`/`field_type`**: one row
  per field — its position in the data row, the name passed to
  `api_function`, its Playwright selector, and its kind (`text`,
  `select`, `check`).
- **`screen_kind`**:
  - `data` (the default): a form the browser fills and submits, or
    the `api_function` the API path calls.
  - `session`: Login, Select Business, Switch Session; browser only,
    nothing to create through the API.
  - `api`: setup no screen has a form for (a translation, a location's
    capacity, an item's known supplier) or a check of stored data. It
    calls its `api_function` on every path, the browser's too.
  - `ui`: a browser-only gesture or check ("Browser-only steps",
    below). It runs only on the `ui` path and is skipped, and said to
    be, on the others.

  The lint check's "submit_selector but no api_function" warning only
  applies to `data`-kind screens, and it flags a `ui`-kind screen with
  no browser action.

### The control file — a full, per-step execution plan

An optional, same-base-name `.control.csv` file, header
`path,verify,screenshot,skip`, one row per data row in the same order
— a complete, scripted alternative to manually driving the tool, able
to mix the fast API path and the driven UI path freely within one
non-interactive run. A row's own `path` column, when present,
overrides the command line's `--path` flag for that row; `ui-only`
runs the row only on the `ui` path (a check the API path has already
made another way). `skip` (`true`/`false`) skips any specific row,
not only a contiguous prefix (which the CLI's `--skip N` still
covers). A `screenshot` name with a `/` in it is relative to `docs/`
(`manual-images/m_login`, a picture for the manuals); a bare name goes
to `--screenshot-dir`.

`skip` applies to every path: a row cannot be skipped on `--path text`
only, which is one reason `make test-e2e-tutorial-text` runs only the
steps the terminal UI can already take (`--until 15`).

### The CLI

```
step-runner <data.csv> [--screens screens.csv] [options]

  --lint                      check the data file's integrity, run nothing
  --pretty                    print every step, formatted, run nothing
  --path api|ui|text          which path executes each step (default: api)
  --steps N                   how many steps to show/run at once (default: 1)
  --only N                    run/show only the Nth step (1-indexed)
  --skip N                    skip the first N steps, then proceed
  --until N                   run/show no step after the Nth
  --non-interactive           run without prompts (needs a .control.csv for verify/screenshot)
  --delay MS                  pause between UI-path steps (default: 5000)
  --ui                        open Playwright's own Inspector (--path ui only)
  --fallback-to-api           when a --path ui step fails, retry it via the API call
                               in the same database; the fallback's own outcome is
                               reported as a distinct line, never folded into the UI result
  --screenshot-dir DIR        where screenshots are saved (default: '../docs/manual-images-tutorial',
                               relative to the Makefile's `cd backend &&` cwd — i.e. the repo-root
                               docs/manual-images-tutorial/ that the User Manual itself references)
  --verify NAME               (single-step mode) the check to run after this step
  --screenshot NAME           (single-step mode) the screenshot name for this step
  --verify-via-recording      start recording right after a UI-path Login
                               step, compare every later UI-path, data-kind step's values
                               against what the backend actually recorded, report mismatches
  --timing-file FILE          write one CSV row per step (index, screen, path, ms, ok, error)
                               so a slow step can be found from a file, not by eye in scrolling
                               console output
  --list-screenshots          print "data file<TAB>picture" for every screenshot the .csv
                               arguments' control files take, run nothing
```

When a step fails on the `ui` path, the runner saves what the browser
showed: `<n>.png` and `<n>.txt` (the address and the page's text) in
`/tmp/step-runner-failures/<file>/`, `<file>` being the data file the
step came from and `<n>` its number (`STEP_RUNNER_FAILURE_DIR` moves
it). A dialog the page opens (a confirm before a delete) is accepted.


### The step runner's own functions

`backend/scripts/step-runner.ts` exports the pieces its tests check:

- `parseCsvLine(line)` splits one CSV line: plain fields, quoted fields
  holding commas, and doubled quotes inside a quoted field.
- `loadScreens(path)` reads `screens.csv` into one entry per screen,
  its fields sorted by position.
- `loadSteps(dataPath)` reads a positional data file (no header row),
  and its `.control.csv` when one exists, row for row, including the
  `skip` column, and expands its directives (`Include`, `Set`,
  `Default`, `${name}`).
- `lintSteps(steps, screens)` lists every problem it finds: a screen
  name with no registry entry, a value count that differs from the
  registry, an `api_function` with no `API_REGISTRY` entry, and a
  data-submitting screen with no `api_function` at all (it would do
  nothing). A correct fixture has none.
- `runStepViaApi(step, screens)` runs one step in-process, through its
  `API_REGISTRY` entry, and reports failure when its verify does not
  hold.

Tests (*Testing: Unit*, "Running the tests"):
- "parseCsvLine: plain fields" (`backend/scripts/step-runner.test.ts`)
- "parseCsvLine: quoted fields with embedded commas" (`backend/scripts/step-runner.test.ts`)
- "parseCsvLine: doubled quotes inside a quoted field" (`backend/scripts/step-runner.test.ts`)
- "loadScreens: groups fields by screen and sorts by position" (`backend/scripts/step-runner.test.ts`)
- "loadSteps: reads a purely positional data file with no header row" (`backend/scripts/step-runner.test.ts`)
- "loadSteps: reads a matching .control.csv when present, aligned by row" (`backend/scripts/step-runner.test.ts`)
- "loadSteps: reads the real skip column from a matching .control.csv" (`backend/scripts/step-runner.test.ts`)
- "loadSteps: Include, Set and Default expand in order, ${name} in values and control rows, a directive's own control row ignored" (`backend/scripts/step-runner.test.ts`)
- "loadSteps: an unset ${name} and a file that includes itself are errors" (`backend/scripts/step-runner.test.ts`)
- "lintSteps: flags a screen_name with no real registry entry" (`backend/scripts/step-runner.test.ts`)
- "lintSteps: flags a real value-count mismatch against the registry" (`backend/scripts/step-runner.test.ts`)
- "lintSteps: flags an api_function with no real API_REGISTRY entry" (`backend/scripts/step-runner.test.ts`)
- "lintSteps: a genuinely correct fixture reports zero real problems" (`backend/scripts/step-runner.test.ts`)
- "lintSteps: flags a real, data-submitting screen with no real api_function as a real, silent no-op waiting to happen" (`backend/scripts/step-runner.test.ts`)
- "runStepViaApi: a real createBusiness step, run through the real, live backend, genuinely creates the business" (`backend/scripts/step-runner.test.ts`)
- "runStepViaApi: a real, deliberately-wrong verify correctly reports failure, not a false pass" (`backend/scripts/step-runner.test.ts`)

### Field types and action sequences

`field_type` (in `screens.csv`) tells `runStepViaUi` *how* to apply a
value to its `field_selector`, the same generic "tell the runner how
to apply this value" contract for every type below — never a
per-screen special case:

| `field_type` | Meaning |
|---|---|
| `text` (default) | `fill(value)` |
| `select` | `selectOption({ label: value })` — matches the visible option text |
| `select_value` | `selectOption({ value })` — matches the option's `value` attribute, for screens whose visible label is more decorated than the data file's plain name (e.g. "Main Street Cellar (Springfield)") |
| `check` | checks or unchecks a checkbox, from `value === 'true'` |
| `check_by_text` | for a generic multiselect-by-checkbox widget with no stable per-option selector: checks each comma-separated name within the container by its own visible `<label>` text |
| `money` | converts a minor-units value (matching the API exactly, e.g. `350`) to the UI's whole-currency decimal display (`"3.50"`) before filling |
| `signed_money` | for a debit/credit grid: `field_selector` carries both locators as `"<debit>|<credit>"`; a positive value fills the debit input, negative fills credit, zero is skipped |
| `search_and_select` | fills a search input, then clicks the one visible list item whose text is an exact (anchored-regex) match — not Playwright's own substring `hasText`, which was found to silently select the wrong row (e.g. "Account" matching "Bank Account") |
| `text_enter` | fills the field, then presses Enter — for a field that only commits on Enter, not on a separate submit click |

`field_selector` and `submit_selector` can reference a sibling
field's own value by name, `"{{fieldName}}"`, resolved from the
step's own already-built args before being handed to Playwright — for
a screen whose selector genuinely depends on another field's value
(e.g. `/setup/translations`: which per-language Save button to use
depends on that row's own `language` value).

`open_selector` and `submit_selector` are each a `;;`-separated
sequence of actions, run in order: a plain Playwright selector
(clicked), `key:Name` (a key press), `select:<selector>::<value>`
(choosing a fixed `<option>` that is itself a precondition for the
rest of the form to render, e.g. Open Container's own Hierarchy
dropdown must already read "Container" before its Container-value/
Unit-value selects exist at all), or `maybe-click:<selector>` (clicks
only if the element is visible within a short, real wait, otherwise a
true no-op, never failing the step) — for a screen reused across
several, real, same-page steps in a row, where an earlier run's own
live UI state would otherwise block a later run's own fields (e.g.
POS Sale, run twice per `tutorial-steps.csv`: `/pos`'s own post-sale
"Sale complete" receipt view replaces the register form, including its
location `<select>`, until "New sale" is clicked).

### `API_REGISTRY` and the real HTTP layer

`API_REGISTRY` (`backend/scripts/step-runner.ts`) is `Record<string,
(args) => unknown>` — one entry per screen name, each calling the real
backend function directly, in-process. **`--path api` issues no real
HTTP request at all** — it is a deliberate shortcut around the real
HTTP shape, for testing speed.

The HTTP layer, which a browser session uses, is the Express app
(`backend/src/server.ts`): `cors()` → `attachUser` →
`recordingMiddleware`, then `POST /api/call` (`backend/src/routes/call.ts`)
with a plain-text body parser; there is no JSON body parser. The body
is one CSV line, `functionName,value1,value2,...`, followed by more
lines for a variable-length argument (line items). The dispatcher looks
the name up in `BACKEND_FUNCTIONS` (`backend/src/call-dispatch/*.ts`,
one file per domain) and calls it with the positional values; each
function makes its own auth and role check (`requireAuth`,
`requireRole`, `requireGlobalRole` from `call-dispatch.ts`), since the
mount itself blocks nothing (customer self-registration is public). The
other mounts are `/api/core/call` (the core middleware, below),
`/api/recording` (`routes/recording.ts`) and `/api/health`. A logged-in
`POST /api/call` with body `createLedger,Wine Retail Business,Budget 2027`
is what a backend action looks like.

### The core middleware path: the frontend API

On the core middleware (`MIDDLEWARE=core`, the default for
`make test-e2e-tutorials`) the API path does **not** use
`API_REGISTRY`. Every step goes through the core's frontend API, the same
plain-text protocol a frontend speaks: `runStepViaFrontendApi`
(`backend/scripts/core-api-client.ts`) turns the Login, Select Business
and Switch Session screens into `login`, `selectBusiness` and
`switchSession`, and every other screen into a call of its
`api_function` with the step's values in `screens.csv` field order.
Every verify is answered by API reads (`CORE_API_VERIFY`), never by
reading the database directly. `CoreApiClient` sends the calls to
`callCore` in-process by default, or over HTTP to
`<STEP_RUNNER_API_URL>/api/core/call` when that variable is set
(`make test-e2e-tutorials-http`). So on the core, `--path api` tests the
real request shape after all.

### The api and ui paths assert at different moments

- **`--path api`**: every row is a call that stands alone. A
  `Stage Journal Line` row calls `stageJournalLine` (its `API_REGISTRY`
  entry), and the staged line is stored when it returns, so a check
  between rows can read it (`getStagedLines`).
- **`--path ui`**: the General Journal page (`/post`) keeps the lines
  in the page until Save; the server gets no call for an unbalanced
  entry. On Save the page calls `stageLine` once a line and then
  `postJournalEntry`. So a `Stage Journal Line` row on this path only
  fills the builder row and inserts it (no `submit_selector`), and
  nothing is checked before the `Post Journal Entry` row, which clicks
  Save.
- Both end with the same posted entry: present, balanced, its lines on
  the right accounts for the right amounts.

### The recording feature records nothing today

`recordingRouter` (`routes/recording.ts`, behind `requireAuth`):
`GET /api/recording` answers `{ recording: isRecording(user) }`;
`POST /api/recording/start` calls `startRecording(user, username)`,
which opens `<username>.recording` for appending and writes an opening
comment line (409 when that user is already recording);
`POST /api/recording/stop` calls `stopRecording(user)`, which writes a
closing comment line and closes the file (409 when nothing was being
recorded).

While a user is recording, `recordingMiddleware` (`recording.ts`)
appends one row per successful (2xx) request that carries an
`X-Screen-Name` header: the screen name, then each of that screen's
`screens.csv` fields, read by `recordRequest` from the request's
params, query or JSON body (`REAL_FIELD_SOURCE_OVERRIDES` names the
exceptions), blank when absent.

The frontend sends `X-Screen-Name` only from `request(path, init,
screenName)` (`frontend/src/lib/api.ts`), which only `/health` uses,
and no call passes a screen name; every screen uses `POST /api/call`,
whose body is CSV, not JSON. So a recording holds only its two comment
lines, and `--verify-via-recording` (`step-runner.ts`) reports every UI
step as unmatched. Making it work needs the call functions to send the
screen name and `recordRequest` to read the call's positional values.

### `runStepViaUi` fails loudly when a screen has no UI wiring

A screen with none of `ui_path`, `open_selector`, `submit_selector` or a
field's `field_selector` (only `api_function` set) makes `runStepViaUi`
return `ok: false`, rather than doing nothing and reporting success, so
`--fallback-to-api` and plain runs see it.

### `--path text` — driving the terminal UI

`runStepViaText` (`backend/scripts/step-runner.ts`) drives the terminal
UI as a separate process through `@microsoft/tui-test`'s `TuiTest`
client, as `--path ui` drives the browser. `ensureTextTerminal` starts
one process for the whole run, the built TUI (`bun --conditions
browser dist/src/cli.mjs` in `tui/`, built by `tui/sveltui-build`),
and fails unless its Log in panel appears.

There is no per-screen driver code. `runStepViaText` uses the same
`screen_name` and positional fields as the other paths, and only the
presence of two web columns:

- A field with a blank `field_selector` is skipped, as on the `ui` path.
- A screen with no `submit_selector` adds one line: `i` opens the line
  form and Enter on its last field adds the line. A screen whose web form
  opens with an `open_selector` (Insert on a list, a "+ Item" button)
  opens it with `i` too.
- A `submit_selector` of the form `button:has-text('X')` that the TUI
  shows as a list row X below its form: after the fields, Enter moves
  past the form's remaining fields (left blank, as on the web) until a
  row is highlighted, and X is chosen. A form with no such row submitted
  on its last field's Enter. A SelectList shows its highlight only while
  it has focus, which is what marks the moment.
- A `money` field is typed in dollars (`500000` as `5000.00`), as on the
  `ui` path. A `signed_money` field is the TUI's two inputs, debit then
  credit: a positive amount is typed in the debit and the credit left
  blank, a negative one the other way round. A screen with a
  `submit_selector` and no fields of its own (`Post Journal Entry`) is
  one Enter.
- `select`, `select_value` and `search_and_select` fields are chosen by
  moving down to a highlighted line containing the value
  (`findItemByText`, `backend/scripts/text-driver-helpers.ts`).

`openScreenGenerically` (same module) opens a screen by its menu label:
the label of the one menu link (`getMenuTree`) whose href is the
screen's `ui_path`, or `screen_name` when there is no such link. It
first waits, for up to five seconds, until the screen stops changing
and shows no "…" progress text. Then, on a screen other than the Menu
that lists the label as an item (Choose a business lists "New
Business"), it selects that item; otherwise it presses Escape, up to
five times, until the Menu's top level shows, and
`navigateMenuGenerically` searches each top-level Menu section for an
item matching the label, and throws when none does. A `select` field's
value is looked for over up to 200 rows. When two menu links share the
screen's `ui_path` (Locations and Warehouses both open `/locations`),
the first is used.

A data step with an `api_function` must change the database: the runner
counts entities, journal entries, journal lines and staged lines before
the step and, for up to five seconds, after it, and fails the step when
nothing changed ("the terminal UI did not carry it out"). Without this a
step whose keys a screen ignored passed. A step fails when the screen shows the TUI's
runtime-error banner.

`make test-e2e-tutorial-text` removes the TUI's saved session, starts
the servers (`ensure-servers`, since `reset-db` stops the backend),
builds the TUI and runs the tutorial's steps 1 to 8 (`--until 8`): Log
in, Create Business (from Choose a business, through the TUI's New
Business wizard), Switch Session (the wizard's "Work in …", then the
ledger), the two API steps that set up the bank account, the owner's
capital entry (two Stage Journal Line steps and Post Journal Entry,
through the TUI's General Journal), Create Location (the TUI's
Locations), Create Item No Category (Inventory Catalog's I), Cash
Purchase, Cash Sale, and the rent entry. It is in
no gate and not in CI.

The TUI runs on the Svelte the workspace installs (5.56.8) through a
start-up workaround for `@rlabs-inc/sveltui` 0.1.7, its latest release
(`docs/tui-design.md`, "Running on Svelte 5.56").

Past step 15, `screens.csv` (written against the web screens) does not
match the TUI's screens:

- Step 16, `Check Trial Balance Balanced`, has no TUI screen: the TUI
  has no Trial Balance report to pick a ledger in.
- `Select Business` picks a business only; the TUI's `ChooseBusiness`
  picks a business and a ledger (`onChosen(businessName, ledgerName)`).
- `Create Purchase Order` is one call (`createPurchaseOrderInCartons`);
  the TUI's `PurchaseOrder.svelte` stages and then posts
  (`stagePurchaseOrder`, `postPurchaseOrder`).
- The driver's `TOP_LEVEL_SECTION_COUNT` (12) is more than the Menu
  shows to a business's administrator, so a screen in no section is
  looked for past the end of the list.

Closing this is a change to the fixture rows or to the TUI screens, not
to the driver.

### Structural verification, not golden figures — the ledger-isolation checks

The Tutorial fixture's own `VERIFY_REGISTRY` (`backend/scripts/step-runner.ts`)
includes a set of checks against pre/post year-end reports, read from
both the old and a brand-new ledger after a rollover, that assert
*structural* truths rather than a hand-computed expected figure that
would go stale the moment an earlier step's own numbers change: a
trial balance must always balance; closing the books must never
change the P&L already reported for that same period
(`closeBooks`'s own closing entry is deliberately excluded from this
read, via `excludeCloseEntries`); a brand-new ledger's own P&L is
genuinely zero until something is posted into it (Income/Expense are
never carried forward across a rollover — see the Domain Reference
chapter's ledger-scoping section); and the OLD ledger's own trial
balance total must stay identical after a sale posts into the NEW
ledger — "nothing ever posts across ledgers" is meaningless unless
something checks it stays true. Two small in-memory maps
(`recordedTrialBalanceTotals`, `recordedNetIncome`) hold the
"before" figure within one run, for the "after" step to compare
against — never persisted, never meant to be.

### Ad hoc entity-tree diagnosis — `backend/scripts/inspect-entities.ts`

`VERIFY_REGISTRY`'s own entity-tree checks (`business_exists`,
`location_exists`, `entity_named_exists`, ...) are narrow, one-shot
assertions baked into a fixture run — not a tool for exploring *why*
a check failed. `inspect-entities.ts` is a separate, small, read-only
CLI for exactly that: `tree`/`search`/`show` subcommands over the
same, real `db.getEntityTree()`/`getEntityLinksPointingAt()`
primitives, useful standalone against any seeded database (`tsx
scripts/inspect-entities.ts show "Riverside Restaurant"`), not tied
to a step-runner run at all. See `docs/tui-design.md`'s "Entity-tree
inspection" section for the full rationale and usage.

### `API_REGISTRY` — notable, non-obvious mappings

A handful of `API_REGISTRY` entries (`backend/scripts/step-runner.ts`)
mirror frontend mapping logic that would otherwise go unexercised by
the API path, rather than calling a backend function 1:1:

- **`createBusiness`** maps the data file's plain-text
  `coaPrototype`/`businessType` labels (`"German"`, `"Sole Trader"`)
  to the backend's own prototype names and `entityStructure` values,
  the same mapping the real new-business page applies
  (`frontend/src/routes/setup/new-business/+page.svelte`). Without a
  `coaPrototype`, `copyChartOfAccountsInto` copies no universal
  CoA-tagged leaves at all, so this step must mirror the frontend's
  default exactly, not take an API shortcut.
- **`createAndConfigureLocation`** passes capacity at creation time,
  atomically, rather than as a later, separate step — the real
  `createAndConfigureLocation` design calls
  `ensureLocationCapacityAccount` immediately so the opening balance
  is known and posted at creation, never lazily.
- **`createItemInGroup`** creates the item flat, directly under the
  business's own `Items` root (`createItem`), then tags it with a
  value of the item hierarchy the step names
  (`setHierarchyParent(itemName, hierarchyName, valueName, userId)`).
  No step names a hierarchy itself: each fixture creates the hierarchies
  it uses ("Create Hierarchy", or the Business Structure
  popup's "Create Location Hierarchy Via Structure Popup" / "Create Item
  Hierarchy Via Structure Popup"), saying what each is of, and passes
  the hierarchy's name to every step that uses it (*Core Domain
  Reference*, "No hierarchy name is in the code").

### Current limits

- Every screen the tutorials and standalone tests drive in the browser
  has UI wiring; a screen without it fails (above) unless
  `--fallback-to-api` is given.
- A control file that switches `--path` mid-run does not carry the
  login across: the `api` path and the browser do not share a session,
  so a run that starts `api` and switches to `ui` finds the browser
  logged out.
- No screen sets an item's retail price (`retail_price_minor`), so a
  POS sale of an item defaults to 0.00 unless a price is typed into the
  cart line, in every currency.

### Selectors: click a header, not a toolbar that holds rows

A bare CSS selector in an action sequence (no `key:`, `select:` or
`maybe-click:` prefix) is `page.locator(action).click()`
(`runActionSequence`), a click at the centre of the element. The
Insert/Enter/Escape/Delete toolbar (`.card.list` in
`routes/editor/+page.svelte`, `role="toolbar"` in
`SelectableListEditor.svelte`) contains its rows, so once the list is
long the centre is a row: the click selects that row, and on `/editor`
the Edit panel's selects then come before the New form's, so
`select >> nth=0` fills the wrong one. So an `open_selector` that only
needs focus clicks a non-interactive child, such as
`.card.list th:first-child;;key:Insert` (`Create Provider`,
`Create Customer`): the header focuses the toolbar and is never a row.

An inline panel opened by a button that is not its ancestor must move
focus into itself on opening, or Enter and Escape go to the button's
handlers instead. `StructureTreeNode.svelte`'s Move panel focuses its
`<select>` when it opens (`moveSelectEl?.focus()`).

## Tutorial / minimal — `tutorial-steps.csv`

The Tutorial fixture (`shared-fixtures/tutorial-steps.csv` and
`tutorial-steps.control.csv`) builds one business from nothing, "Tutorial
Wine Retail Business", in the order of the User Manual's Chapter 3
(`docs/user-manual-ch3-tutorial.md`). It includes `common/business.csv`
and `common/bank-account.csv` and then runs in two ledgers:

1. **`Actual`**: a one-item Ice stall at one location, with no
   category and no division (`Create Item No Category`), so the system
   is shown working with no hierarchy at all. It records the owner's
   capital, trades, pays rent, closes its books (`Close Books`) and
   shows the Trial Balance, Profit and Loss and Balance Sheet after the
   close (`ice_trial_balance_after_close`,
   `ice_profit_and_loss_after_close`, `ice_balance_sheet_after_close`).
2. **`Actual 2027-28`**, after `Create Ledger` and `Rollover To New
   Period`: the business grows into a wine retailer through the
   Business Structure popup (Head Office, divisions, departments,
   employees, categories) and trades: items, a provider and a customer,
   a purchase order, cash purchases and sales, a transfer, two POS
   sales, and Storage and Container movements.

Its checks are structural (next section) plus the P&L by item,
division and category.

Rules the fixture follows, each for a reason found on the `ui` path:

- **`Create Ledger` is an `api`-kind screen.** No screen creates a
  ledger on its own: the year-end page's rollover creates it
  (`resolveRollover`). The API path needs the ledger first, so the
  step calls `createLedgerSimple` on every path.
- **`Switch Session` runs again after the rollover, with its `ledger`
  field.** The trading screens have no ledger field (blank
  `field_selector`; they read `session.current.ledgerName`), so the
  session must point at `Actual 2027-28`. Choosing the ledger
  explicitly (`select >> nth=1`) avoids racing the page's own default.
- **A report checked as of a date gives that date.** The checks after
  Close Books give `asOfDate` `2027-06-30`: a blank date is "all time"
  for the verify but today's date in the page's date input, and a
  Balance Sheet before the close date leaves out the closing entry.
- **A screenshot of a screen with no `submit_selector` waits for the
  network to be idle** (`runStepViaUi`), since such a report renders
  after its last field changes, with nothing to wait on.
- **`maybe-click:`** clears a state an earlier step left: after a POS
  sale `/pos` shows the receipt until "New sale" is clicked, so `POS
  Sale`'s `open_selector` starts with `maybe-click:` on that button.

The Ice stall's net income is $1,900.00 ($2,000.00 of sales less
$100.00 rent): `completeCashPurchase` books the purchase to the item's
Inventory account, and `completePosSale` posts no cost of sales for an
item with no unit cost, which Ice never has. Its $1,000.00 stays in
Inventory.

```
make test-e2e-tutorial            # fast — API path only, no browser
make test-e2e-tutorial-browser    # same fixture, driven through a real browser
make test-e2e-tutorial-docs       # both of the above, plus every manual they feed, rebuilt
```

The first two reset the database first (`reset-db`).
`test-e2e-tutorial-browser` also needs the servers (`ensure-servers`
reuses healthy ones and starts the others). `test-e2e-tutorial-docs`
runs `test-e2e-tutorial`, then `tutorial-section-user-manual` (which
runs `test-e2e-tutorial-browser` and rebuilds the Chapter 3 PDF from
its screenshots), then `check-docs-coverage` (which regenerates
`docs/programmer-manual.md`), so the manual's screenshots come from the
run.

Chapter 3 describes more than the fixture does: no step sets a
location's capacity, creates a warehouse through Business Setup, or
receives a purchase order (`docs/realistic-tutorial-e2e-plan.md`).

## Full / volume — the Wine Retail Business simulation

```
make test-e2e
```

The month-long simulation checks the whole system against exact,
deterministic figures.

### Why exact numbers, not ranges

The simulation (`backend/scripts/simulate-wine-retail-month.ts`) uses
a seeded pseudo-random number generator, never `Math.random()`. Given
the same code, it produces exactly the same purchases, sales,
breakages, and returns, every run, on any machine — so its output is
a precise, reproducible fact that can be checked exactly, the same way
a unit test checks an exact expected value.

`make test-e2e` runs, in order:

1. `make reset-db`: a new database from `backend/schema/00-core.sql`
   and `30-coa-links.sql` plus `seedRemainingData()` (`db-seed.ts`),
   with no business.
2. The simulation: it creates Wine Retail Business and trades for a
   month through the functions the frontend calls (never raw SQL). See `docs/simulation-prompt.md` for the full
   specification of what it models (realistic carton-based purchasing
   with per-category carton sizes, cold-chain routing for sparkling
   wine and lager/stout beer, vendor bills actually paid on net terms,
   breakages, several thousand retail sales a month across
   bottle/six-pack/carton tiers with per-product-per-tier Sales and
   COGS accounts, customer returns, a month-end stocktake, and a real
   year-end close zeroing every non-zero Income/Expense account in one
   balanced entry).
3. `verify-simulation.ts` — checks the resulting database against the
   exact expected values below, failing loudly (non-zero exit code)
   on any difference.

### The exact expected results

| Check | Expected value |
|---|---|
| **Trial Balance @ 2027-03-28** | |
| Total debit | $397,932.04 |
| Total credit | $397,932.04 (must equal debit) |
| Row count | 601 |
| **Balance Sheet (all time)** | |
| Total assets | $314,644.73 |
| Total liabilities | $153,848.08 |
| Total equity | $160,796.65 |
| Balanced | true |
| **Profit & Loss, 2027-03-01 to 2027-03-28** | |
| Total income | $131,123.69 |
| Total expenses | $70,333.44 |
| Gross profit | $60,838.05 |
| Net income | $60,790.25 |
| Per-product income accounts | 212 |
| Per-product-per-tier COGS accounts | 209 |
| **Cash movement** | |
| Cash and Bank balance (ledger-scoped) | $75,922.54 |
| Vendor (Boutique Wine Importers) balance | -$141,181.20 (partially paid, not zero, not never-paid) |
| **Sales Report, 2027-03-01 to 2027-03-28** | |
| Detailed line count | 1,385 |
| Category count | 9 |
| Total quantity | 4,986 units |
| Total amount | $131,219.26 |

Cost of goods sold is first in, first out (*The Stock API*, "The cost of
stock leaving"). The opening stock is received as a quantity with no
value, so the first sales from it cost nothing; three products sold only
from opening stock have no COGS account, hence 209 against 212. The
three customer returns are credit notes that reverse the original sale's
own Sales account, which is why income is below the sales report's total.

Cash and Bank is read through `getTrialBalance` for the ledger, not
from `account.balance_minor`, which sums the account's postings in
every ledger (*Reports*, "The core rule").

### If a check fails

- **Not intended**: find the cause in the data; neither the old nor
  the new figure is right until explained.
- **Intended**: run `make test-e2e`, and update `verify-simulation.ts`
  and this table together with the new figures.

### Full-year simulation data generation — `make demo-full-year`

```
make demo-full-year
```

A fuller demo dataset, built in order:

1. `reset-db`.
2. The same one-month simulation (`simulate-wine-retail-month.ts`).
3. `add-wine-retail-budget-and-year.ts` — adds a 12-month Budget and
   11 more summary-level Actual months either side of the simulated
   one, so a full year's Budget-vs-Actual comparison exists.
4. `set-wine-retail-credit-terms.ts` — sets varied, realistic payment
   terms and credit limits.
5. `verify-db-consistency.ts` — checks balanced entries, no orphans,
   referential integrity.

It is not part of `test-e2e`: it changes the figures
`verify-simulation.ts` checks.

### A minimal, backend-only business-lifecycle proof

```
make proof-year-end
```

`backend/scripts/proof-year-end-lifecycle.ts`, backend only: locations
of each type, staff, an assembly, and order, receive, transfer, sell,
stock take and year-end close.

## Manufacturing tutorial — a second, real business

A second business, "Tutorial Window & Door Manufacturing", run by the
same step runner, exercising the bill of materials
(`stageBomComponent`, `postBomComponents`, `getBomComponents`). The
User Manual narrates it in `docs/user-manual-ch4-manufacturing-tutorial.md`.

```
make test-e2e-manufacturing-tutorial          # fast — API path only, no browser
make test-e2e-manufacturing-tutorial-browser  # same fixture, driven through a real browser
make test-e2e-manufacturing-full              # the "full" tier — see below
```

Fixture: `shared-fixtures/manufacturing-tutorial-steps.csv` and its
control file. Its `API_REGISTRY` entries: `ensureItemInventoryAccountSimple`,
`setBomComponentSimple` (the `stageBomComponent`/`postBomComponents`
pair the Items page's Bill of Materials card calls), and
`receiveStockQuantitySimple`/`dispatchStockQuantitySimple`
(`receiveItems`/`dispatchItems`, one line at a time). Its verifies:
`bom_components_recorded`, `stock_on_hand_nonnegative`.

Assembly is a dispatch of raw materials from "Raw Materials Store" and a
receipt of finished assemblies into "Finished Goods Store", with a
journal entry per assembly moving the BOM cost from the materials'
accounts to the assembly's (an item is a postable account,
`asAccountName(staged.item)`, as in `postOrderReceipt` and
`postOrderDispatch`). There is no separate assemble action.

Each item gets its Inventory account (`ensureItemInventoryAccount(itemName,
userId, undefined, business)`) right after it is created and before
anything is posted to it. A line posted to an item with no account
parent still balances the Trial Balance, but the item is not under the
business's Inventory, so the Balance Sheet stops balancing; calling it
afterwards makes a second entity of the same name rather than fixing
the first. The fixture and `simulate-manufacturing-cycles.ts` both call
it first.

### Full / volume — the Manufacturing cycle simulation

`backend/scripts/simulate-manufacturing-cycles.ts` runs three
purchase, assemble and sell cycles on one new database and checks
computed invariants, not fixed figures: the Trial Balance balances; no on-hand
quantity anywhere ever goes negative; each raw material's own real
leftover buffer stock, after 3 cycles, exactly matches
`(purchased − consumed) × cycles`, computed from the same, real BOM
ratios the fixture itself uses; every assembly produced across all 3
cycles was also sold, so Finished Goods Store holds none of it
afterward; net income is positive. Run via `make test-e2e-manufacturing-
full` (which resets the database first) or directly via `node --import
tsx backend/scripts/simulate-manufacturing-cycles.ts`.

## Project Builder tutorial — a third, real business

A third business, "Tutorial Dwelling Construction", exercising
recipes, plant, skills, prototypes, live projects, milestones and
scheduling (*Project Builder*). The User Manual narrates it in
`docs/user-manual-ch5-project-builder-tutorial.md`.

```
make test-e2e-project-builder-tutorial          # fast — API path only, no browser
make test-e2e-project-builder-tutorial-browser  # same fixture, driven through a real browser
make test-e2e-project-builder-full              # the "full" tier — see below
```

Fixture: `shared-fixtures/project-builder-tutorial-steps.csv` and its
control file (87 steps). Its `API_REGISTRY` entries: `createPlantItemSimple`/
`ensureSkillSimple`/`tagSkillSimple`/`setEmployeeWageSimple` (Plant and
Skill setup); `createPrototypeSimple`/`addPrototypeLineSimple`/
`updatePrototypeLineSimple` (the Prototype library); `instantiateProjectProposalSimple`/
`acceptProjectProposalSimple` (turning a Prototype into a real, accepted
Live Project); `clockInToProjectSimple`/`clockOutOfProjectSimple`/
`clockPlantInSimple`/`clockPlantOutSimple` (real labour/plant cost posted
against a project). New `VERIFY_REGISTRY` entries: `schedule_risk_absent`/
`schedule_risk_flagged` (the real, computed Schedule Risk check),
`project_margin_sign` (a project's quoted-vs-actual cost comparison),
`prototype_line_updated` (confirms a bounded, explicit prototype revision
took effect).

The fixture's own narrative deliberately instantiates two Live Projects
("123 Oak St", "456 River Road") from the SAME Medium Dwelling prototype,
with overlapping dates on the same shared Labour/Plant resources — Project
A is accepted first (no real conflict yet, resolves exactly as requested,
`schedule_risk_absent`), and Project B, accepted second against a
deliberately tighter client-wanted date, gets every colliding Labour/Plant
line genuinely pushed into the future by the real scheduling engine,
missing its own client's wanted date and raising a real, computed
`schedule_risk_flagged`. Direct cost-simulation journal entries then give
Project A a positive margin and Project B a negative one
(`project_margin_sign`), and a final `Update Prototype Line` call on the
Medium Dwelling template's own Tower Crane line is confirmed via
`prototype_line_updated`.

### Full / volume — the Project Builder cycle simulation

`backend/scripts/simulate-project-builder-cycles.ts` runs three cycles
of an overlapping pair of projects, each cycle in its own two-year
window, on one new database, and checks computed invariants: the
Trial Balance balances; every Profit Center's own totals reconcile to its
own project's postings only; a real Schedule Risk is raised exactly where
a real resource double-booking was engineered in that cycle, and nowhere
else; every accepted Project Proposal has at least its own real Invoicing
Milestone; net income across all 3 cycles is positive. Run via `make
test-e2e-project-builder-full` (which resets the database first) or
directly via `node --import tsx
backend/scripts/simulate-project-builder-cycles.ts`.

## Standalone tests (`shared-fixtures/tests/`)

Every test of the running app is a data file the step runner runs.
There are no Playwright specs: the step runner's own browser driver,
the `playwright` library (a dependency of `backend/`), is the one way
into the browser, and `make check-step-tests` fails on any `*.spec.ts`
file or any use of `@playwright/test`.

A standalone test is one data file in `shared-fixtures/tests/`, with a
control file beside it when a row needs a path, a verify or a
screenshot. Each one:

- starts from a fresh database and relies on no other test and on no
  demo business: it builds the smallest business that shows what it
  checks;
- opens with comment lines saying what it checks; the file's name is
  the test's title, and the manual lists it under the code it
  exercises (`check-test-docs` counts them with the unit tests);
- takes its common steps from `shared-fixtures/common/`, each file
  there saying what it builds, what it needs first, and which
  variables it reads, with a `Default` for each.

`scripts/run-step-tests.ts` runs them, each by name:

```
make test-steps                 # every test, API path, a new database file each (MIDDLEWARE=legacy)
make test-steps-browser         # every test in the browser, `make reset-db ensure-servers` before each
make test-steps TEST=a,b        # only those
```

`make test` runs `make test-steps`. On the API path the browser-only
steps are skipped, so a test still builds and checks its data there.

### The common steps (`shared-fixtures/common/`)

- `login.csv` logs in as the administrator, the one user every new
  database has. A new database has no business, so it chooses no
  session; `business.csv` does, after creating one.
- `business.csv` logs in, creates the business `${business}` ("Test
  Business", 2026-27, a sole trader in `${currency}`, AUD) and switches
  the session to it; its control file verifies it exists.
- `bank-account.csv` nominates the bank account `${bank}` and builds
  its currency structure.
- `location.csv` creates the location `${location}` (`${locationType}`,
  Retail, in `${city}`), with storage space, through the API: the
  Locations form has no capacity fields.
- `division-hierarchy.csv`, `division.csv` and
  `two-locations-in-divisions.csv` give the business its Division
  hierarchy, put `${location}` in the division `${division}`, and build
  Head Office and Warehouse B, each in a division of its own.
- `item.csv`, `item-in-category.csv`, `provider.csv` and
  `customer.csv` create one item (in the category `${category}`), one
  provider and one customer.
- `buy-move-sell.csv` takes `${item}` through stock's whole journey:
  bought into Head Office, moved to Warehouse B, sold there.
- `journal-rent.csv` posts the general journal entry `${reference}`:
  rent paid from Cash and Bank.
- `language.csv` reopens the session screen and continues in
  `${language}`.
- `add-to-list-by-keyboard.csv`, `add-address-by-keyboard.csv`,
  `add-phone-by-keyboard.csv` and `no-add-remove-buttons.csv` work the
  shared address, phone and contact lists with the keyboard alone.
- `add-item-by-insert.csv`, `add-subcategory.csv`,
  `inline-add-on-items-page.csv` and `delete-on-items-page.csv` work
  the Items page's tree.

### Browser-only steps

A `ui`-kind screen is a gesture or a check made in the browser, its
values the screen's fields in order. Each check waits up to ten seconds
for the page to agree, then fails saying what it waited for.

| Step | Values | Does |
|---|---|---|
| `Open Page` | route | goes to the route and waits for the network to settle |
| `Page Opens Cleanly` | route | goes to the route; fails on HTTP 500 or more, or on a script error the page throws (a minute to load: the dev server builds a page on its first visit) |
| `Click`, `Focus` | selector | clicks, or focuses, the first match |
| `Fill` | selector, value | types the value into the first match |
| `Select Option` | selector, label | chooses the option with that label |
| `Press Key` | key | presses the key (`Insert`, `Enter`, `Delete`, `Tab`) |
| `Page Shows` | selector, text | the matches' text (as written, before CSS changes its case) holds the text |
| `Page Lacks` | selector, text | it does not; with no text, there is no match at all |
| `Page Count` | selector, count | there are that many matches |
| `Page Value` | selector, value | the first match's input holds the value |
| `Page Enabled` | selector, `true`/`false` | the first match is enabled, or disabled |
| `Page Has Option` | selector, label, `true`/`false` | the first match, a select, has (or has not) that option |
| `Page Focused` | selector | the first match has the keyboard focus |
| `Download` | selector, file | clicks the match and keeps the file the page hands over under that name |
| `Upload` | selector, file | gives the file kept under that name to the match, a file input |
| `File Contains` | file, text | the kept file holds the text |

Downloaded files are kept in `STEP_RUNNER_FILES_DIR`, or
`step-runner-files` in the system's temporary directory.

### The `api`-kind screens a test uses for its setup

`Create Sales Invoice` (a draft, one line, today, source `manual` or
`pos`, so a test of POS invoices needs no stock), `Post Sales Invoice`
(revenue to Sales Revenue, tax to Sales Tax Payable), `Add Item
Source` (a known supplier of an item, at a price, preferred or not),
`Set Item Location Levels` (the stock listing's minimum, maximum and
reorder levels), `Set Item Storage Origin` and `Set Employee Salary`.
Each calls the `API_REGISTRY` function of its name in camel case with
`Simple` on the end (`createSalesInvoiceSimple`), configured in
`application/application.entities` like every call the runner makes.
`Check Entity Exists` calls nothing: it carries a name for its control
row's verify, `entity_named_exists`.

### The tests

Tests (*Testing: Unit*, "Running the tests"):
- "business-setup-divisions" (`shared-fixtures/tests/business-setup-divisions.csv`)
- "hierarchy-prototype" (`shared-fixtures/tests/hierarchy-prototype.csv`)
- "cash-sale-storage-origin" (`shared-fixtures/tests/cash-sale-storage-origin.csv`)
- "contact-addresses-by-keyboard" (`shared-fixtures/tests/contact-addresses-by-keyboard.csv`)
- "contact-persons" (`shared-fixtures/tests/contact-persons.csv`)
- "contacts-focus" (`shared-fixtures/tests/contacts-focus.csv`)
- "e-invoice-export-and-import" (`shared-fixtures/tests/e-invoice-export-and-import.csv`)
- "employee-second-location-schedule" (`shared-fixtures/tests/employee-second-location-schedule.csv`)
- "every-page-opens" (`shared-fixtures/tests/every-page-opens.csv`)
- "general-journal-account-currency" (`shared-fixtures/tests/general-journal-account-currency.csv`)
- "general-journal-one-side-per-line" (`shared-fixtures/tests/general-journal-one-side-per-line.csv`)
- "general-journal-own-chart-of-accounts" (`shared-fixtures/tests/general-journal-own-chart-of-accounts.csv`)
- "help-text-in-german" (`shared-fixtures/tests/help-text-in-german.csv`)
- "hr-pay-hourly-and-salaried" (`shared-fixtures/tests/hr-pay-hourly-and-salaried.csv`)
- "installation-check" (`shared-fixtures/tests/installation-check.csv`)
- "invoices-source-filter-and-pages" (`shared-fixtures/tests/invoices-source-filter-and-pages.csv`)
- "items-categories-insert-delete" (`shared-fixtures/tests/items-categories-insert-delete.csv`)
- "location-addresses-by-keyboard" (`shared-fixtures/tests/location-addresses-by-keyboard.csv`)
- "location-type-added-on-the-fly" (`shared-fixtures/tests/location-type-added-on-the-fly.csv`)
- "profit-and-loss-by-division-and-category" (`shared-fixtures/tests/profit-and-loss-by-division-and-category.csv`)
- "purchase-order-known-suppliers" (`shared-fixtures/tests/purchase-order-known-suppliers.csv`)
- "restock-retail-outlet" (`shared-fixtures/tests/restock-retail-outlet.csv`)
- "stock-listing-by-division" (`shared-fixtures/tests/stock-listing-by-division.csv`)
- "stock-listing-over-capacity" (`shared-fixtures/tests/stock-listing-over-capacity.csv`)
- "stock-movement-by-hierarchy" (`shared-fixtures/tests/stock-movement-by-hierarchy.csv`)
- "user-manual-pictures" (`shared-fixtures/tests/user-manual-pictures.csv`)
- "year-end-close-and-rollover" (`shared-fixtures/tests/year-end-close-and-rollover.csv`)

`every-page-opens` opens every page of the app. `make
check-step-tests` fails when a page (each `+page.svelte` under
`frontend/src/routes` with no parameter in its path, the generated
ones too) has no `Page Opens Cleanly` row there, or a row names a page
that is gone; the one page with parameters, a journal entry, is opened
by its link on the journal list.

## Pictures for the manuals

Every picture a chapter shows (`manual-images/…png`,
`manual-images-tutorial/…png`) is taken by a test or a tutorial: the
step's control row names it in the screenshot column, and the file's
steps build what it shows. `user-manual-pictures` takes the everyday
screens; a picture of one feature at work (`m_contact_persons`,
`m_po_supplier_matching`, `m_multi_location_schedule`,
`storage_origin_verified`) is taken by that feature's own test; the
tutorials take the tutorial chapter's.

`scripts/manual-pictures.ts` reads them all through the step runner's
`--list-screenshots`:

```
make check-manual-pictures                  # every picture shown is taken by a test (a gate)
make docs/manual-images/m_login.png         # takes one: runs the test that takes it, in the browser
```

`make docs/manual-images/x.png` runs `manual-pictures.ts take`, which
runs that test through `run-step-tests.ts ui` (a tutorial's picture,
through the tutorial's browser target). The pictures are not tracked;
`make manual` takes any that are missing.

## Running everything, in CI or before delivering a change

```
make test && make test-e2e && make test-steps-browser && make test-e2e-tutorials
```

`make test` runs the unit tests, the standalone tests on the API path
and every gate. `make test-e2e` is the full simulation's exact
figures. `make test-steps-browser` runs the standalone tests in the
browser, and `make test-e2e-tutorials` the three tutorials (each also
has a `-browser` target).