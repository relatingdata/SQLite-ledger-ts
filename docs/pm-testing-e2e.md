# Testing: The Test-Runner, the Tutorial Fixture, and Full-Volume Simulation

This chapter covers everything above the unit-test level: the Step
Runner (the one real testing *and* data-loading tool for this
application), the Tutorial/minimal fixture built on it, and the
Full/volume simulation with its full-year data-generation extension.

## The Step Runner — the one, unified testing and data-loading tool

This is the one and only testing and data-loading tool for this
application, replacing any bespoke, one-off Playwright script or
hand-written seeding script. Per the project's own standing rule, no
`.ts` or raw Playwright script outside this mechanism is used to load
data — everything goes through the step runner.

### The underlying idea

An ordered sequence of steps, held in one plain, human-readable CSV
file, extending the established `shared-fixtures/*.csv` convention.
Each step is dual-path from the start: it can run either as a direct
backend function call (`--path api`, fast, no browser) or as a driven
Playwright browser action (`--path ui`, proving the UI works,
producing screenshots) — the same step either way, so the two paths
can never silently drift apart.

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

### The screen registry — `shared-fixtures/screens.csv`

Header row: `screen_name,ui_path,open_selector,api_function,
submit_selector,position,field_name,field_selector,field_type`. One
row per field a screen accepts:

- **`screen_name`**: matches a data file's first column.
- **`ui_path`**: where this screen lives (blank if a prior step
  already navigated there).
- **`open_selector`**: an optional click needed before fields become
  visible.
- **`api_function`**: the direct backend function this screen's
  submit corresponds to (blank for a UI-only screen).
- **`submit_selector`**: the button that finalizes the screen.
- **`position`/`field_name`/`field_selector`/`field_type`**: one row
  per field — its position in the data row, the name passed to
  `api_function`, its Playwright selector, and its kind (`text`,
  `select`, `check`).
- **`screen_kind`**: `session` (Login, Select Business, Switch
  Session — UI-only, no data-creation side effect to call via the API
  path) or `data` (default — everything else). The lint check's
  "submit_selector but no api_function" warning only applies to
  `data`-kind screens.

### The control file — a full, per-step execution plan

An optional, same-base-name `.control.csv` file, header
`path,verify,screenshot,skip`, one row per data row in the same order
— a complete, scripted alternative to manually driving the tool, able
to mix the fast API path and the driven UI path freely within one
non-interactive run. A row's own `path` column, when present,
overrides the command line's `--path` flag for that row; `skip`
(`true`/`false`) skips any specific row, not only a contiguous prefix
(which the CLI's `--skip N` still covers).

### The CLI

```
step-runner <data.csv> [--screens screens.csv] [options]

  --lint                      check the data file's integrity, run nothing
  --pretty                    print every step, formatted, run nothing
  --path api|ui               which path executes each step (default: api)
  --steps N                   how many steps to show/run at once (default: 1)
  --only N                    run/show only the Nth step (1-indexed)
  --skip N                    skip the first N steps, then proceed
  --non-interactive           run without prompts (needs a .control.csv for verify/screenshot)
  --delay MS                  pause between UI-path steps (default: 5000)
  --ui                        open Playwright's own Inspector (--path ui only)
  --fallback-to-api           when a --path ui step fails, retry it via the API call
                               in the same database; the fallback's own outcome is
                               reported as a distinct line, never folded into the UI result
  --screenshot-dir DIR        where screenshots are saved
  --verify NAME               (single-step mode) the check to run after this step
  --screenshot NAME           (single-step mode) the screenshot name for this step
  --verify-via-recording      start the Admin recording feature right after a UI-path Login
                               step, compare every later UI-path, data-kind step's values
                               against what the backend actually recorded, report mismatches
  --timing-file FILE          write one CSV row per step (index, screen, path, ms, ok, error)
                               so a slow step can be found from a file, not by eye in scrolling
                               console output
```

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
(clicked), `key:Name` (a key press), or — the one case a plain click
can't cover — `select:<selector>::<value>` (choosing a fixed
`<option>` that is itself a precondition for the rest of the form to
render, e.g. Open Container's own Grouping dropdown must already read
"Container" before its Container-value/Unit-value selects exist at
all).

### `API_REGISTRY` and the real HTTP layer

`API_REGISTRY` (`backend/scripts/step-runner.ts`) is `Record<string,
(args) => unknown>` — one entry per screen name, each calling the real
backend function directly, in-process. **`--path api` issues no real
HTTP request at all** — it is a deliberate shortcut around the real
HTTP shape, for testing speed.

The real HTTP layer (what a genuine browser session, or the Admin
recording feature, actually produces) is the Express app
(`backend/src/server.ts`): `cors()` → `express.json()` →
`attachUser` → one router per `/api/...` prefix, most behind
`requireAuth`. A logged-in `POST /api/journal/create-ledger` with a
JSON body is the true shape of "a backend action."

### The two paths test genuinely different surfaces — and must assert differently

A critical, settled design point: `--path api` and `--path ui` are not
two ways of testing the same moments.

- **`--path api` (direct HTTP replay)**: every row IS independently
  real. A `Stage Journal Line` row really sends its own
  `POST /journal/staging`, and the server really holds it durably the
  moment that call returns — valid to assert mid-sequence server state
  here (`GET /journal/staging/:reference/:business/:ledger`).
- **`--path ui` (driving the live browser)**: nothing is real, and
  nothing should be asserted, until the one final "Save" click. The
  real General Journal page holds every line being built only in
  client-side state — the server receives *zero* calls for an
  unbalanced, incomplete entry, and all of `POST /journal/staging` ×N
  + `POST /journal/post` fire together, back to back, only on Save.
  Any `Stage Journal Line` row's UI action is "fill the builder row,
  press insert" (no submit, no network call expected); only the final
  `Post Journal Entry` row carries a `submit_selector`.
- **Both paths must converge on one thing**: the final, posted result
  — the entry exists, is balanced, and its lines hit the correct
  accounts for the correct amounts.

### The Admin recording feature — self-verification via the real backend

One toggle, "Record," visible only to an Administrator:
`POST /api/recording/start` / `POST /api/recording/stop` (two separate,
idempotent endpoints). While on, every request from a frontend call
site tagged with an explicit `X-Screen-Name` header
(`frontend/src/lib/api.ts`'s `request<T>(path, init, screenName?)`) is
appended as a data-file row to `<user>.recording`. A screen may make
several real API calls; there is no "the screen's own row" — only one
row per successful HTTP call, each complete in itself (e.g. the
General Journal is `Stage Journal Line` ×N + `Post Journal Entry`, not
one combined row).

`recordRequest` (`backend/src/recording.ts`) reads each field from
whichever of `req.params`/`req.query`/`req.body` actually carries it,
via an explicit, hand-verified override table
(`REAL_FIELD_SOURCE_OVERRIDES`) for every screen whose field names or
locations differ from "the body, same name." A position with no
matching field in the real route (e.g. `Create Business`'s own
`homeCurrency`, `Create Location`'s own `division`) is expected to
come back blank — an honest gap, not a bug in the recorder.

`--path ui` runs can use this mechanism as their own verification
oracle: start recording right after Login, run the steps, stop, then
compare the recorded file's rows (in order, for every step that ran
via the real UI, is `data`-kind, and reported `ok: true`) against each
step's own original values, position for position. A mismatch, or a
UI step with no matching recorded row, is an independently-confirmed
failure — stronger than "the click didn't throw."

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
- **`createItemAndCategory`** matches the real UI's own behavior: a
  `"+ New category…"` value creates the category first, under the
  business's own `Items` root, before creating the item under it; any
  other value names an already-existing category directly.

### Honest, current status

- Positional, command-free design (data/screen-registry/control
  files, `--lint`, `--pretty`) is fully implemented and working, both
  paths. 14 unit/integration tests
  (`backend/scripts/step-runner.test.ts`), all passing.
- `runStepViaUi` fails honestly (rather than silently reporting
  success) when a screen has none of the four UI columns set — only a
  subset of the tutorial's screen types currently have real UI wiring
  (`ui_path`/`open_selector`/`field_selector`/`submit_selector`); the
  rest are API-only today. `--fallback-to-api` covers this gap for
  automated runs.
- A known, confirmed UI bug (not a selector problem): creating two
  locations back-to-back can leave the "+ New Location" button
  unresponsive for ~30s after the first creation; the API-path
  fallback correctly refuses to duplicate the already-created location
  rather than making it worse, but does not repair the location's own
  possibly-incomplete capacity structure.
- `runStepViaUi` cannot yet distinguish a submission the browser
  aborted client-side (`net::ERR_ABORTED`) from one that still left
  correct server-side state — both have been observed to leave correct
  state, but the function can't currently tell the difference itself.
- The web interface (`/dev/step-runner`) and full UI wiring for every
  screen type remain future work.
- The mixed-mode control file example (switching `--path` mid-run) is
  not yet proven end to end — the API and UI paths do not currently
  share browser session state, so a run that starts `api` and
  switches to `ui` mid-sequence finds no logged-in session in the
  freshly-launched browser.

## Tutorial / minimal — `tutorial-steps.csv`

The Tutorial fixture (`shared-fixtures/tutorial-steps.csv` +
`tutorial-steps.control.csv`) drives a complete, small, from-scratch
business lifecycle through the step runner: login, select/switch
business, create a business, create a location, create items and a
category, place and receive a purchase order, a cash purchase, a
stock transfer, a POS sale, a phoned-in Cash Sale to a named customer,
and a General Journal entry for the owner's opening capital — 26
steps at present. It creates its own "Tutorial Wine Retail Business"
from scratch and does not depend on, or interact with, any other demo
business.

```
make test-e2e-tutorial            # fast — API path only, no browser
make test-e2e-tutorial-browser    # same fixture, driven through a real browser
```

Both reset the database first (`reset-db`), since the fixture always
starts from a clean slate. `test-e2e-tutorial-browser` depends on
`ensure-servers` (reuses already-healthy backend/frontend dev servers,
starting whichever one isn't already up).

A separate, real browser spec covers the same ground from an entirely
independent, hand-written Playwright test rather than the step-runner
engine:

```
make e2e-spec-tutorial   # e2e/tests/tutorial-walkthrough.spec.ts, via browser-run
```

This drives an actual running app (the browser-test runner starts the
dev servers itself if needed) through the same login-through-first-
General-Journal-entry walkthrough, independently of the step runner.

**Known gap**: the Tutorial fixture still covers only a fraction of
the User Manual's own Chapter 3 walkthrough — a Division, a Warehouse
created through Business Setup, an Employee, a location's own static
capacity, an item's own cost/price/pack size, a Purchase Order's own
full lifecycle, and the owner's opening-capital entry are either
partially or not yet expressed, mostly because no screen type or field
existed yet to express them. See `docs/realistic-tutorial-e2e-plan.md`
for the itemized remaining gap.

## Full / volume — the Wine Retail Business simulation

```
make test-e2e
```

This is the answer to "does the whole system actually work together
correctly against large-scale data" — not a smoke test, a correctness
check against **exact, deterministic expected results**.

### Why exact numbers, not ranges

The simulation (`backend/scripts/simulate-wine-retail-month.ts`) uses
a seeded pseudo-random number generator, never `Math.random()`. Given
the same code, it produces exactly the same purchases, sales,
breakages, and returns, every run, on any machine — so its output is
a precise, reproducible fact that can be checked exactly, the same way
a unit test checks an exact expected value.

`make test-e2e` runs, in order:

1. `make reset-db` — a clean, empty database, reinitialized from
   `schema.sql`.
2. The simulation — a full month of real trading for Wine Retail
   Business, posted through the same functions the real frontend
   calls (never raw SQL). See `docs/simulation-prompt.md` for the full
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
| Total debit | $826,836.12 |
| Total credit | $826,836.12 (must equal debit) |
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
| Per-product income accounts | 72 |
| Per-product-per-tier COGS accounts | 78 |
| **Cash movement** | |
| Cash and Bank balance (ledger-scoped) | $188,614.90 |
| Vendor (Boutique Wine Importers) balance | -$961,482.00 (partially paid, not zero, not never-paid) |
| **Sales Report, 2027-03-01 to 2027-03-28** | |
| Detailed line count | 3,598 |
| Category count | 18 |
| Total quantity | 13,382 units |
| Total amount | $812,646.50 |

If `make test-e2e` reports every one of these as `PASS`, the system's
core accounting behavior — per-product revenue and COGS recognition,
cash movement on both the sales and vendor-payment sides, a genuinely
balancing Trial Balance and Balance Sheet, and a correct sales report
— is all working together correctly against substantial data.

The ledger-scoped figures above (Cash and Bank, in particular) must be
read via `getTrialBalance`, not `account.balance_minor` directly —
that column is an intentionally cross-business running total
(documented at `getBusinessReports` in `db.ts`), since `Cash and Bank`
is one shared entity across every business in the app, not one per
business.

### If a check fails

- **An unintentional regression**: investigate directly — query the
  current data, don't assume either the old or new number is right
  without checking.
- **A deliberate change**: re-run `make test-e2e`, read off the new
  values, and update **both** `verify-simulation.ts` and this table
  together. A verification script checked against stale expected
  values is worse than no verification, since it gives false
  confidence.

### Full-year simulation data generation — `make demo-full-year`

```
make demo-full-year
```

Builds on the same month-long simulation to produce a fuller, year-
shaped demo dataset, run in order:

1. `reset-db`.
2. The same one-month simulation (`simulate-wine-retail-month.ts`).
3. `add-wine-retail-budget-and-year.ts` — adds a 12-month Budget and
   11 more summary-level Actual months either side of the simulated
   one, so a full year's Budget-vs-Actual comparison exists.
4. `set-wine-retail-credit-terms.ts` — sets varied, realistic payment
   terms and credit limits.
5. `verify-db-consistency.ts` — checks balanced entries, no orphans,
   referential integrity.

Kept as its own target, deliberately separate from `test-e2e` — it
changes the exact figures `verify-simulation.ts` checks against. Run
it when a fuller dataset is wanted to explore or demo against, not as
part of routine verification.

### Language/i18n testing demo businesses

Four additional demo businesses exist specifically to exercise the
application's translation mechanism against non-English sample data,
separately from the core vocabulary-vs-sample-data architecture (see
the Domain Reference chapter) — each one's own account and product
names are genuinely written in its own language:

| Demo business | Modeled language/country |
|---|---|
| BMW M GmbH | German — Germany |
| Peugeot Citroën Sochaux SNC | French — France |
| Ditta Italiana Srl | Italian — Italy |
| Schweizer KMU AG | German — Switzerland |

`language-parameterized.spec.ts` and `coa-prototype-filtering.spec.ts`
exercise these. Current gap: their sample data isn't yet cleanly
separated at the file level the way vocabulary translations are — all
four currently live together in
`backend/schema/20-demo-bmw-peugeot.sql` and `00-core.sql`.

```
make test-e2e-browser-languages   # runs the month simulation, then verifies every language against it in a real browser
```

### A minimal, backend-only business-lifecycle proof

```
make proof-year-end
```

A minimal, fast, backend-only proof of a complete business lifecycle:
locations of each type, staff, an assembly, a full
order→receive→transfer→sell→stocktake→year-end-close cycle. No
browser — this is the right level to prove a lifecycle like this at.

## The full browser test suite

```
make e2e-spec-all          # every real .spec.ts file in e2e/tests — several minutes
make e2e-spec-smoke        # every route visited once, checking only that it loads without error
make e2e-spec-one TEST=<name>   # one named spec, against whatever is already running (no reset)
```

`e2e-spec-all` and `e2e-spec-tutorial` both reset the database first.
`e2e-spec-smoke` and `e2e-spec-one` do not — the former is a fast,
minimal layer (every route, checked only for a clean load, no deep
assertions), the latter a targeted, repeatable check against live,
already-present data.

## Running everything, in CI or before delivering a change

```
make test && make test-e2e
```

Unit tests first (fast — fail fast on an isolated, easy-to-diagnose
bug), then the full end-to-end check (slower — the integrated proof).