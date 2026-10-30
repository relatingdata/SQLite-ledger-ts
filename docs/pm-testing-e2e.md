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
  --screenshot-dir DIR        where screenshots are saved (default: '../docs/manual-images-tutorial',
                               relative to the Makefile's `cd backend &&` cwd — i.e. the repo-root
                               docs/manual-images-tutorial/ that the User Manual itself references)
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
(clicked), `key:Name` (a key press), `select:<selector>::<value>`
(choosing a fixed `<option>` that is itself a precondition for the
rest of the form to render, e.g. Open Container's own Grouping
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

`--verify-via-recording`'s own HTTP calls (start/stop recording) use an
absolute `http://localhost:3001/...` URL rather than a relative one: the
browser context's `baseURL` is the frontend's own origin (`:5173`, which
proxies nothing — `frontend/vite.config.ts` has no proxy), and
`page.request` does not throw on a non-2xx response, so the response
status is checked explicitly rather than trusted.

### `runStepViaUi` fails loudly when a screen has no UI wiring

If `screens.csv` gives a screen no UI wiring at all for the step it's
running (no `ui_path`/`open_selector`/`submit_selector`, and no field with
a `field_selector` — only `api_function` is set), `runStepViaUi` returns
`ok: false` rather than falling through every `if` untouched and reporting
success. A UI path that silently does nothing is a worse failure mode than
an honest error, since `--fallback-to-api` and plain runs need the truth
to react to.

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
- **`createItemAndCategory`** creates the item flat, directly under
  the business's own `Items` root (`createItem`), then tags it into
  the named category (`setHierarchyParent(itemName, 'Category',
  categoryName, userId)`) — a `"+ New category…"` value is resolved to
  the newly-typed name before tagging; any other value names an
  already-existing category directly. Category is a real, optional
  Hierarchy tag here, exactly like Division — never a real position in
  the Items catalog tree. See `docs/pm-frontend-reference.md`.

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
- A confirmed application gap, surfaced by `e2e/tests/tutorial-walkthrough.spec.ts`:
  no screen sets a persistent retail price on an item, so a POS sale with none ever
  set defaults to $0.00; the only way to get a non-zero price today is typing it
  directly into the cart line every time. The same gap applies per-currency: the
  cart's default price doesn't distinguish currency even with a foreign-currency
  terminal active, so a USD sale needs its own manually-typed price too.

### Known gap: "Wine Retail Business"'s legacy Locations root

The "Wine Retail Business" demo fixture seeds its locations under a
legacy, combined-name root (`"Wine Retail Business Locations"`, one
entity) predating the modern per-business root convention
(`PER_BUSINESS_ROOTS`: a plain `"Locations"` child of the business).
`getOrganizationChart`'s `businessLocationNames` lookup and
`setLocation`/`createEntity`'s "Locations child of this business"
lookup both only recognize the modern shape, so for this one business
the Business Setup tree shows no groups/locations at all, and
creating or saving a location against it fails outright. Not fixed —
migrating this large, pre-existing demo dataset is its own, separate,
riskier undertaking. `e2e/tests/business-setup.spec.ts` therefore only
covers what's genuinely functional against this business (company-wide
staff display, group/division creation via `createHierarchyValue`/
`setEntityRelationship` — neither touches the Locations root); full
location/employee/open-hours/schedule coverage for Business Setup runs
instead against a freshly-created business (`make test-e2e-tutorial-browser`).

### Known gap: `e2e/tests/tutorial-walkthrough.spec.ts`'s Items-section-onward is already stale

While retrofitting the Insert/Enter/Escape/Delete keyboard idiom (see
"Insert/Enter/Escape/Delete" in docs/pm-frontend-reference.md), the
Business Setup portion of this spec (division/location/employee
creation, lines ~84-116) genuinely broke — it filled the same inputs
as before but then clicked the now-removed Add buttons to confirm —
and was fixed in place to press Enter instead, same as every other
converted screen. Investigating further turned up a second, unrelated,
pre-existing gap: from the "Create the first product category and
product" section onward (`/items`'s own `select`-based "+ New
category…" flow, a single "+ Add" button, and more further down), this
spec describes an items screen shape that predates the current
tree-based `items/+page.svelte` entirely — `items/+page.svelte` has no
top-level `<select>` or "+ New category…" option at all any more. This
is not a regression from this plan's own changes (confirmed by reading
the current screen's markup, which never matched what this spec
assumes) and is not fixed here — rewriting the rest of this long,
screenshot-generating spec to match the real, current UI for every
screen it drives (items, General Journal, Purchase Order, Cash
Purchase, Locations, Stock Transfer, Stock Take, POS) is its own,
separate, much larger undertaking, out of scope for a keyboard-idiom
retrofit. `make e2e-spec-tutorial`/`e2e-spec-all` will still fail from
that point on until someone takes that on directly.

### Known gap: a bare-selector click in `open_selector` targets the center of its element, not a safe empty spot

The Insert/Enter/Escape/Delete idiom's toolbar shell — both the
hand-rolled `.card.list` div in `routes/editor/+page.svelte` and
`SelectableListEditor.svelte`'s own `role="toolbar"` div — wraps its
*rows*, not just its own empty chrome: `<div role="toolbar"
tabindex="0" ...><table>...rows...</table></div>`. `runActionSequence`
(`backend/scripts/step-runner.ts`) resolves a bare CSS selector (no
`key:`/`select:`/`maybe-click:` prefix) as `page.locator(action).click()`
— a real Playwright click at the *center of that element's bounding
box*, not a `.focus()`. While the list behind the toolbar is empty or
short, that center lands on blank padding (or the legend/hint text),
which isn't itself clickable, so focus still lands on the toolbar div
(the nearest focusable ancestor) exactly as intended, and Insert fires
on the right handler. Once the list is long enough that the click
center falls on an actual data row, the row's own `onclick` fires
instead — in `editor/+page.svelte` this silently selects a real entity,
which (since `selectedId != null`) mounts the Edit panel's own `Parent`/
`Relation` `<select>` elements *ahead of* the New-entity form's, so a
page-wide selector like `select >> nth=0` for a `screens.csv` field
starts resolving to the wrong element entirely.

This is exactly what broke `Create Provider`/`Create Customer`
(`shared-fixtures/screens.csv`, `/editor`) the first time they were
converted: by the point those two steps run in `tutorial-steps.csv`
(deep into the tutorial, with the full entity tree already built),
`[role="toolbar"][aria-keyshortcuts];;key:Insert` reliably clicked an
existing row (observed: "Business Type") instead of empty space. With
the wrong `Parent` select filled, `newParent` on the real New-entity
form stayed empty, so `createNew()` fell through to plain
`createEntity()` (`POST /api/entities`) instead of `createProvider()`/
`createCustomer()` (`POST /api/entities/contact`) — silently creating a
plain entity that never shows up as a provider, which only surfaced
several steps later as an unrelated-looking `selectOption` timeout on
`/items`' own provider dropdown. Fixed by pointing the `open_selector`
at a genuinely non-interactive, stable spot instead —
`.card.list th:first-child;;key:Insert` (a table header cell; clicking
it still focuses the toolbar div via nearest-focusable-ancestor, but it
can never be an actual data row).

The same underlying fragility exists in principle wherever
`SelectableListEditor`'s own `[role="toolbar"]` div is targeted by a
bare-selector click in an `open_selector` while its list is non-empty —
`hierarchy`/`translations`/`users`/`bank-accounts` never hit it only
because every `screens.csv` row exercising their Insert forms happens
while that particular list is still empty or short enough that the
center-click lands clear of a row, not because the component itself is
immune. A future fixture addition against one of those screens, once
its list has real rows, should either reuse this same
`<container> <non-interactive-child>` pattern (a legend, a header, or
similar) instead of the bare toolbar selector, or scope the click to an
element guaranteed to stay outside the row area.

### Known gap (fixed): an inline Enter/Escape panel needs real focus on its own field, not whatever element opened it

`StructureTreeNode.svelte`'s inline "Move…" picker (a sibling `<div
class="move-panel">`, rendered only while `movingKey === node.key`, not
a child of the `.node` div containing the "Move…" button that opens it)
originally relied on keyboard focus already being somewhere inside the
panel by the time Enter/Escape was pressed — it never moved focus there
itself. In practice, after clicking "Move…", focus stays on that button
(a real DOM sibling of the panel, so an Enter/Escape keydown bubbling
from it can never reach the panel's own `onkeydown` handler at all); the
event bubbles instead through `.node`'s own
`onkeydown={(e) => { if (e.key === 'Enter') onSelect(node); }}`, so
Enter was silently treated as "select this node" rather than "confirm
the move." This reproduced identically for a real user clicking
"Move…", selecting a destination from the dropdown with a mouse, and
pressing Enter without an intervening Tab/click into the `<select>` —
not a test-only artifact. Confirmed live (both via a standalone
Playwright repro script against the dev servers and via the "Move Main
Street Cellar To Division (ui)"/"Move Head Office To Division (ui)"
`tutorial-steps.csv` steps, both of which failed with zero
`/api/hierarchy/parent` network calls logged) that `document.activeElement`
stayed the "Move…" `<button>` even after `selectOption()` set the
`<select>`'s value. Fixed by giving the `<select>` a `bind:this` and
adding an `$effect` that calls `.focus()` on it whenever
`movingKey === node.key` becomes true — the same "auto-focus a freshly
opened form's field" pattern used elsewhere, which both correctly
improves the real-keyboard-user experience (the idiom's whole premise)
and makes the panel's own `onMovePanelKeydown` the thing that actually
receives Enter/Escape, regardless of exactly where the opening click
left focus. The general lesson for any future Insert/Enter/Escape panel
that isn't a strict DOM descendant of whatever button opens it: moving
focus into the panel on open is not optional UX polish, it is what
makes the panel's own keydown handler reachable at all.

## Tutorial / minimal — `tutorial-steps.csv`

The Tutorial fixture (`shared-fixtures/tutorial-steps.csv` +
`tutorial-steps.control.csv`) drives a complete, from-scratch business
lifecycle through the step runner — 62 steps at present, matching
`docs/user-manual-ch3-tutorial.md`'s own chapter exactly. It genuinely
runs across *two* real ledgers, not one: a single-item "Ice" stall
trades for its first two months (one location, no divisions, **no
category at all** — not even a "General" catch-all, via the real
"Create Item No Category" screen/`addUncategorizedItem`, proving the
system can genuinely operate with zero hierarchy), posts a real rent
expense, then genuinely closes its books — visiting all three of its
real Trial Balance/Profit and Loss/Balance Sheet report screens
afterward, captured as real screenshots (`ice_trial_balance_after_close`,
`ice_profit_and_loss_after_close`, `ice_balance_sheet_after_close`),
not just API-level checks — and rolls over into a new ledger
(`Actual 2027-28`) before a further capital injection funds growing
into the full, multi-location wine retailer (via the Business
Structure popup, now a step-by-step wizard — see
`pm-frontend-reference.md`) — Head Office, an employee, two further
items, a provider, a Purchase Order, a Cash Purchase, a Stock
Transfer, two POS sales, a phoned-in Cash Sale to a named customer,
and Storage/Container stock movements, all now posted into
`Actual 2027-28`. It creates its own "Tutorial Wine Retail Business"
from scratch and does not depend on, or interact with, any other demo
business.

**`Check Balance Sheet Balanced`** (`balance_sheet_balanced` in
`VERIFY_REGISTRY`) is the newest verify — a thin wrapper on
`getBalanceSheet`'s own `balanced` flag, mirroring
`trial_balance_balanced`'s shape, added specifically so a real
Balance Sheet screenshot could exist in the manual (it never did
before this).

**A real, confirmed regression found and fixed while adding the above**:
`screens.csv`'s "Create Item" browser wiring (`select >> nth=0` for
category) was stale against `items/+page.svelte`'s current tree-based
UI, which has had no category `<select>` at all since that page's
rewrite — any UI-path run of this step would genuinely hang. Confirmed
directly by running it against a live browser session, not assumed.
"Create Item No Category"'s own wiring was built and verified the same
way (a real, live, isolated browser-driven check, not just the API
path) before being trusted. The old, single "Create Item" (with a
category) screen no longer exists at all: `items/+page.svelte`'s tree
UI has no combined "new category + item in it" action any more, so
creating a brand-new category is now its own real, separate screen
(**`Create Category`** — Insert with nothing selected, via the shared
`[role="toolbar"][aria-keyshortcuts]` selector, disambiguated from the
top nav's own, unrelated `[role="toolbar"]` — see below) followed by
**`Create Item Under <X> Category`** (select the category's own tree
node by name, then Insert). Both are now real, live, browser-verified,
and exercise Amber Ale (Beer) and Highland Single Malt (Whiskey, the
category the Business Structure popup created a step earlier) in the
fixture.

**A second, deeper, real regression found while getting a genuinely
clean browser-path run** (not merely assumed clean from an earlier
session's commit message — the Makefile passes no
`--fallback-to-api`, so a UI failure hard-fails rather than masking,
and this run had in fact not been exercised cleanly in some time):
business-scoping `GET /entities` (`getEntityTree(businessName)`,
`backend/src/db.ts`) looked a business up via
`WHERE name = ? AND parent_id IS NULL` — but no real business entity
is ever a top-level, `parent_id IS NULL` row; every one sits under the
real `"Businesses"` entity (the same, established pattern every other
business lookup in `db.ts` already uses:
`parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')`).
The scoped query therefore matched no business, ever, and silently
returned `[]` for every real business — confirmed directly via a live
browser session reading its own fetched entities, not assumed. Fixed
in `getEntityTree` itself, with a new regression test
(`backend/test/db.test.ts`, "getEntityTree(businessName): scoped to
one business's own subtree"). This had a second, real consequence:
`items/+page.svelte`'s manufacturers/providers pickers derive from the
same `entities` array the category/item tree uses — but manufacturers
and providers are genuinely **global** entities (vendors live once,
system-wide, never nested under any one business — see
`api.ts`'s `createProvider`/`createCustomer`), so scoping `entities`
to the business silently emptied both dropdowns. Fixed by fetching a
second, separate, unscoped `globalEntities` alongside the business-
scoped `entities`, used only for the manufacturers/providers filters.

**Two further, real, pre-existing selector regressions found by the
same clean-run effort**, both from earlier, unrelated session work
that shifted a page's own `<select>` DOM order without updating
`screens.csv`'s positional selectors: Close Books'
`retainedEarningsAccount` (`select >> nth=0` → `nth=1`, after
`setup/yearend/+page.svelte` gained its own "Reporting period"
`<select>` ahead of it), and Set Item Cost and Pack Size's
`providerName` (`select >> nth=2` → `nth=1`, once accounted for
correctly against `items/+page.svelte`'s real, always-rendered
"Add a source" form).

**A real, live-state bug in `/pos` itself**, not a selector problem:
after a successful sale, the page shows a "Sale complete" receipt
view in place of the register form (including its location `<select>`)
until "New sale" is clicked — which silently blocked the fixture's own
second, back-to-back POS Sale step. Fixed with a new, small
`runActionSequence` primitive, `maybe-click:<selector>` (clicks only
if the element is visible within a short, real wait, otherwise a true
no-op — never fails a step when the element genuinely isn't there),
wired into POS Sale's own `open_selector`.

**`Create Ledger` has no real UI wiring, by design, not by omission**:
no standalone "create a ledger" screen exists anywhere in the app —
the only place a new ledger is ever created is inline, inside the
Rollover screen's own flow (`setup/yearend/+page.svelte`'s
`resolveRollover` calls `createLedger` itself when "new ledger" is
chosen). The API path still needs this step on its own first (the
API-only `rolloverToNewPeriodSimple` doesn't create the ledger
itself); `tutorial-steps.control.csv` pins this one row's own `path`
column to `api`, overriding `--path ui` for just this step, rather
than inventing UI wiring for a screen that doesn't and shouldn't
exist.

**Genuinely trading in a second ledger, both paths**: every ordinary
trading screen (Cash Purchase, Cash Sale, POS Sale, Transfer Items,
Create Purchase Order, Receive Into Storage, Open Container) now takes
an explicit `ledger` field in `screens.csv`/the data file — on the API
path this is simply passed straight through (`a.ledger || 'Actual'`,
the same fallback already used throughout `step-runner.ts`'s
`API_REGISTRY`); on the UI path, these screens have no ledger
field/selector of their own at all (blank `field_selector`) because
the real screens themselves always read `session.current.ledgerName`
directly. The fixture instead submits the real **Switch Session**
screen a *second* time, right after the rollover — not a no-op: the
real `/session` page defaults its ledger `<select>` to
`getActiveLedger(business)`, which the rollover itself just moved to
the new ledger, so re-submitting this one real screen is what
genuinely points every later UI-driven trading screen at
`Actual 2027-28` instead of `Actual`. `screens.csv`'s own "Switch
Session" row now has an explicit second field (`ledger`, its own
`select >> nth=1`) so this choice is driven deliberately rather than
left to the page's own async default and a fixed timing margin — found
directly: without it, a race between the dropdown's own
`getActiveLedger` network call and the step runner's next click could
leave the session pointed at the old ledger.

**A real screenshot-capture bug, found by actually looking at the
rendered manual, not just at the step runner's own ✅**: the three
post-close report screenshots (`ice_trial_balance_after_close`,
`ice_profit_and_loss_after_close`, `ice_balance_sheet_after_close`)
were, for a time, genuinely capturing the app's own bootstrap/loading
splash (the "Better Brighter Multi-Ledger" screen with its spinner),
not the report — the Profit and Loss and Balance Sheet pages fetch and
render reactively after the last field change, with no submit button
to wait on, and `runStepViaUi`'s existing 200ms-per-field margin
wasn't always enough for that fetch-and-render to finish before the
screenshot fired. Found only by rendering the rebuilt PDF to images
and reading every page — the step runner's own ✅ never notices a
screenshot is wrong, only that the step didn't throw. Fixed by adding
a real `page.waitForLoadState('networkidle', { timeout: 5000 })`
immediately before any screenshot of a `screen_kind: 'data'` screen
that has no `submit_selector` (`runStepViaUi`, `step-runner.ts`) —
scoped to exactly that case so ordinary submit-driven screens (which
already have their own 2000ms post-submit margin) aren't slowed down.

**A second, genuinely unbalanced Balance Sheet, caught the same way**:
once the screenshot bug above was fixed, the real, rendered Balance
Sheet screenshot showed **"Assets ≠ Liabilities + Equity"** in red —
not a display bug, a real, correct report telling the truth about a
fixture mistake. `tutorial-steps.csv`'s "Check Trial Balance Balanced"
and "Check Balance Sheet Balanced" rows (right after Close Books) both
left their `asOfDate` field blank, so the UI's `<input type=date>`
fell back to its own default, the real wall-clock date the fixture
happened to run on (e.g. `2026-10-25`) — which sits *before* this
business's own fictional close date, `2027-06-30`. Queried as of a
date before the close, the Balance Sheet correctly excludes the
future-dated Close Books entry and its Retained Earnings line
entirely, so Equity understates Assets by exactly the period's net
income. The automated `balance_sheet_balanced`/`trial_balance_balanced`
verifies never caught this because they pass `a.asOfDate || undefined`
straight to `getBalanceSheet`/`getTrialBalance` — `undefined` means
"no cutoff, all time," which *does* legitimately include the close
entry regardless of today's real date, so the verify and the UI
screenshot were silently checking two different things. Fixed by
giving both rows an explicit `"2027-06-30"` `asOfDate` in
`tutorial-steps.csv`, so the screenshot shows the same, real, as-of
state the narrative describes (Trial Balance now also genuinely shows
a closed **Retained Earnings** line instead of the still-open Sales/
Rent accounts).

**A real, invented-number documentation bug, found while explaining
the (now-correct) screenshots**: the manual's own prose claimed a
"$1,000.00 gross profit… $900.00 net income" for the Ice stall — but
the real, live Profit and Loss has always said **$1,900.00** net
income (a real $2,000.00 in Ice sales, less $100.00 of rent). The
$900 figure assumed Ice's $1,000.00 purchase cost was expensed as
Cost of Goods Sold; it genuinely isn't — `completeCashPurchase`
(`backend/src/db.ts`) books a cash purchase straight to the item's own
Inventory account (an asset), and `completePosSale`'s own COGS leg
(`getItemUnitCostMinor`) is skipped entirely whenever an item has no
registered unit cost, which Ice deliberately never gets (see "Opening
with one location and one item" above). So Ice's $1,000.00 sits
unexpensed in Inventory on the Balance Sheet for this whole first
year, and the real net income is pure Sales less Rent. The prose (and
the Close Books/post-close paragraphs around it) now says $1,900.00
and explains why, rather than asserting an unverified number.

```
make test-e2e-tutorial            # fast — API path only, no browser
make test-e2e-tutorial-browser    # same fixture, driven through a real browser
make test-e2e-tutorial-docs       # both of the above, plus every manual they feed, rebuilt
```

The first two reset the database first (`reset-db`), since the
fixture always starts from a clean slate. `test-e2e-tutorial-browser`
depends on `ensure-servers` (reuses already-healthy backend/frontend
dev servers, starting whichever one isn't already up).
`test-e2e-tutorial-docs` is the one, real composition of three,
already-existing targets — `test-e2e-tutorial` (the fast API path),
`tutorial-section-user-manual` (which itself depends on
`test-e2e-tutorial-browser`, then rebuilds the Chapter 3 PDF from the
screenshots that run just captured), and `check-docs-coverage` (which
regenerates `docs/programmer-manual.md` before checking it) — so the
one target that runs the Tutorial is also the one that brings every
manual it feeds back up to date from that exact, same, fresh run,
never a separate, easy-to-forget manual step afterward. Chapter 3 of
the user manual says its own screenshots are "real and current,
captured directly from a live, passing run of this exact tutorial" —
true only once this target (or its two underlying pieces) actually
runs.

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