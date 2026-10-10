# The Step Runner — the one, real, unified testing and data-loading tool

Per direct instruction: this is the one and only real testing and data-loading
tool for this application — replacing the tutorial e2e's own, bespoke
Playwright script, the wine-retail simulation script, and demo-seeding, all of
which currently duplicate the same underlying knowledge (what a business
setup looks like, what an invoice looks like) in separate, real, hand-written
places that can silently drift apart from each other.

## 1. The real, underlying idea

A real, ordered sequence of steps, held in one real, plain, human-readable
CSV file — extending, not replacing, the already-established
`shared-fixtures/*.csv` convention. Each step is real, dual-path from the
start: it can be executed either as a real, direct backend function call
(fast, no browser) or as a real, driven Playwright browser action (proving
the UI works, producing real screenshots) — the same step, either way, so the
two paths can never silently drift apart.

## 2. The real, established best practice this tool follows

A real, well-known, decades-old testing best practice, not invented here:
**how to drive a screen is defined once, per screen, in its own real
registry — never repeated inline in the data that merely uses that screen.**
The same, real Page Object Model separation every mature test automation
practice uses, paired with genuinely tabular, positional, data-driven test
data — the real data file itself contains **zero commands, zero selectors,
zero field names.**

## 2a. Comment lines in the data file, per direct instruction

A line in the data file itself, starting with `#`, is a real, free-text explanation of the step(s)
that follow it — never a data row, never counted as a real step, never touching the control file,
which stays exactly its own, documented four columns (`path,verify,screenshot,skip`). One or more
consecutive `#` lines accumulate into a single, real comment, attached to the next real data row
that follows them, and shown before that step runs — both in `--pretty` and during an actual run,
either path, api or ui — per direct instruction that a comment is real documentation attached to
the step it explains, not a side channel kept in a different file. Implemented in
`splitDataAndComments` (`backend/scripts/step-runner.ts`), called once, inside `loadSteps`, so
every caller (lint, pretty-print, an actual run) sees the same, real comments consistently.

## 3. The real data file — pure, positional data

One real row per real step. The screen/action name first, then its real
values in plain, positional order — exactly how a person would write down a
real business record, nothing more:

```csv
"Login","admin","changeme123","English"
"Create Business","Wine Tutorial Business","2026-27","Sole Trader"
"Create Location","Main Street Cellar","Adelaide","Retail"
```

No header row of field names. No `verify`. No `screenshot`. No selector, no
JSON, ever. The *screen registry* (below) is the one, real place that says
what position 1, 2, 3... mean for a given screen name.

## 4. The real screen registry — `shared-fixtures/screens.csv`

Defines, once per screen, everything about *how* to drive it, and the
*order* its positional data arrives in:

```csv
screen_name,ui_path,open_selector,api_function,submit_selector,position,field_name,field_selector,field_type
Login,/login,,,button:has-text('Log in'),1,username,input[autocomplete=username],text
Login,/login,,,button:has-text('Log in'),2,password,input[autocomplete=current-password],text
Create Business,/setup/new-business,,createBusiness,button:has-text('Create Business'),1,businessName,input[placeholder='e.g. Corner Store Pty Ltd'],text
Create Business,/setup/new-business,,createBusiness,button:has-text('Create Business'),2,financialYearLabel,input[placeholder='e.g. 2026-27'],text
Create Business,/setup/new-business,,createBusiness,button:has-text('Create Business'),3,businessType,select >> nth=1,select
```

- **`screen_name`**: the real name a data file's own first column matches.
- **`ui_path`**: where this screen lives, if this screen is responsible for
  its own navigation (blank if a prior step already navigated there).
- **`open_selector`**: an optional real click needed *before* fields become
  visible (a "+ New Location" toggle, say) — never the same as `submit_selector`.
- **`api_function`**: the real, direct backend function this screen's submit
  corresponds to — blank for a real, UI-only screen.
- **`submit_selector`**: the real button that finalizes this screen's fields.
- **`position`** / **`field_name`** / **`field_selector`** / **`field_type`**:
  one real row per real field — its position in the data file's own row, the
  name passed to `api_function`, its real Playwright selector, and its kind
  (`text`, `select`, `check`).

## 5. The real control file — a full, per-step execution plan

Per direct correction: the control file is not merely verify/screenshot
metadata. It is **the real, scripted alternative to a person manually driving
the tool through the TUI or the web interface, one batch at a time** — a real,
complete, per-step execution plan, letting a fully non-interactive run mix
paths freely: run the first several real steps via the fast API path (no
browser), then switch to the UI path for one, real, specific step to actually
watch it and capture a screenshot, then back to the API path — all without a
person present to choose anything.

**A separate, real control file** (same base name, `.control.csv` suffix),
read alongside the data file only when present — one real row per real data
row, in the same real order, naming that row's own real execution `path`
alongside its real `verify`/`screenshot`:

```csv
path,verify,screenshot
api,,
api,,
api,business_exists,
ui,,session_switched
ui,location_exists,locations_created
```

This real example runs the first three real steps (login, select-business,
create-business) via the fast API path with no browser at all, then switches
to the real, driven UI path for the last two — the exact, real "N steps via
the API, then the next step via the web UI, capturing a screenshot" case
directly named. A control file's own `--path` column, when present, overrides
whatever single `--path` flag was passed on the command line for that
specific, real row.

**Command-line flags** remain available for the simpler, common case of
running one, single step at a time by hand and checking it: `--path ui
--verify business_exists --screenshot new_business_created`, applied to
whichever one, single step is currently selected (`--only N`) — no real
control file needed at all for this, interactive case.

## 6. The real CLI

```
step-runner <data.csv> [--screens screens.csv] [options]

  --lint                      check the data file's own real integrity, run nothing
  --pretty                    print every real step, formatted, run nothing
  --path api|ui               which real path executes each step (default: api)
  --steps N                   how many real steps to show/run at once (default: 1)
  --only N                    run/show only the Nth real step (1-indexed)
  --skip N                    skip the first N real steps, then proceed with the rest
  --non-interactive           run without prompts or pauses (needs a real .control.csv
                               for verify/screenshot, since no flags apply per-step)
  --delay MS                  real pause between UI-path steps (default: 5000)
  --ui                        open Playwright's own Inspector (--path ui only)
  --screenshot-dir DIR        where real screenshots are saved
  --verify NAME                (single-step mode) the real check to run after this step
  --screenshot NAME             (single-step mode) the real screenshot name for this step
```

The real control file (section 5) gained a fourth, real column: `skip`
(`true`/`false`) — a real, per-step alternative to `--skip N`, letting any
specific, real row be skipped, not only a real, contiguous prefix.

## 7. The real testing plan

Per direct instruction, a real, named plan — not just examples of expected
output, since that gap is exactly what let an earlier `--pretty`/`--steps`
bug ship undetected until caught by hand:

- **Real unit tests** (`backend/scripts/step-runner.test.ts`, run the same
  way as `backend/test/db.test.ts`) for every real, pure function:
  `parseCsvLine` (plain fields, quoted fields, embedded commas, doubled
  quotes); `loadScreens` (grouping, position-sorting); `loadSteps` (with and
  without a real, matching `.control.csv`); `buildArgs` (positional mapping
  onto named arguments); `lintSteps` (a real, deliberately-broken fixture for
  every real, distinct problem the linter is meant to catch - an unknown
  screen, a wrong real value count, an unregistered `api_function`, an
  unregistered `verify`).
- **Real, direct backend integration tests**, in the same file, for
  `runStepViaApi` against the real, live backend (matching the established
  `backend/test/db.test.ts` convention exactly - a real, freshly-reset
  database, real assertions on real, resulting entity state) - not mocked.
- **The real UI path** (`runStepViaUi`) is verified by actually running a
  real fixture through a real, driven browser, per the established
  `backend-first-testing` skill's own real hierarchy (a browser is the
  slowest, least direct check, used last, never skipped as unnecessary once
  the faster checks pass) - not by a unit test pretending to be a browser.
- **Every fixture file** (`shared-fixtures/*.csv`) is checked with `--lint`
  before ever being run, and real, working fixtures are re-linted whenever
  `screens.csv` changes, catching a real, silent mismatch immediately.

## 8. Tested examples, with their real, actual, expected output

**Linting a clean data file:**
```
$ npx tsx scripts/step-runner.ts ../shared-fixtures/tutorial-steps.csv --lint
✅ ../shared-fixtures/tutorial-steps.csv: 3 real step(s), no real problems found.
```

**Pretty-printing the first two real steps:**
```
$ npx tsx scripts/step-runner.ts ../shared-fixtures/tutorial-steps.csv --pretty --steps 2

━━━ 1: Login ━━━
  username: admin
  password: changeme123

━━━ 2: Create Business ━━━
  businessName: Wine Tutorial Business
  financialYearLabel: 2026-27
  businessType: Sole Trader

2 real step(s) shown.
```

**Running one real step via the API path, with an inline verify:**
```
$ npx tsx scripts/step-runner.ts ../shared-fixtures/tutorial-steps.csv --only 2 --non-interactive --verify business_exists
✅ 2: Create Business
```

*(These examples describe the intended, corrected CLI's own real behavior —
see the honest status below for what is and is not yet built to match them.)*

## 9. File format specification (Programmer's Manual / User Manual, Section 8)

**8.1 Data file.** Plain ASCII CSV, no header row. Column 1 is the real screen
name (must match a `screen_name` in the screen registry, exactly, quoted with
double quotes if it contains a comma). Columns 2 onward are that screen's own
real field values, in the exact, real position order the registry defines for
that screen — column 2 is position 1, column 3 is position 2, and so on. A
value containing a comma or a double quote must be double-quoted, with any
internal double quote doubled (standard CSV escaping). No JSON, no selectors,
no field names, anywhere in this file. **A line starting with `#`** is not a
data row at all — a real, free-text comment explaining the step(s) that
follow it, accumulated across consecutive `#` lines, shown before that step
runs (see section 2a above).

**8.2 Screen registry file.** Plain ASCII CSV, header row required, exactly:
`screen_name,ui_path,open_selector,api_function,submit_selector,position,field_name,field_selector,field_type`.
One row per real field a screen accepts; `position` is a plain integer
starting at 1, unique within one `screen_name`. `field_type` is one of
`text`, `select`, `check`.

**8.3 Control file** (optional). Plain ASCII CSV, header row required, exactly:
`path,verify,screenshot,skip`. Row N corresponds to data-file row N; `path` is
`api` or `ui` (or blank, falling back to the command line's own `--path`
flag); `verify`/`screenshot` may be empty; `skip` is `true`/`false`
(defaulting to not-skipped), a real, per-row alternative to the CLI's own
`--skip N` (which skips a real, contiguous prefix). This is a real, complete,
per-step execution plan — a fully scripted, non-interactive alternative to
manually driving the tool through the TUI or web interface, letting a run
freely mix the fast API path with the driven UI path, row by row.

## 10. The real web interface

A small, real, local-only web UI (served alongside the backend during
development, never in production) at `/dev/step-runner` — the same real,
tabular step display and controls as the CLI's interactive mode: a table of
upcoming real steps, a "Run next N" control, a live log of real results, and
inline real screenshots as they're captured. Talks to the same, shared
step-runner engine, never a second, separately-maintained implementation.

**Where the actual UI interaction takes place — resolved directly, not left
open**: `/dev/step-runner` is purely a real **control panel**, an ordinary
page in the person's own browser. It never embeds the application under test
(a real iframe would need framing permissions the app has no real reason to
grant, and Playwright cannot drive iframe-embedded content the way it drives
a real, separate browser instance regardless). Streaming the driven browser's
own video into the control panel (a VNC-style approach) was considered and
rejected as real, unnecessary weight for this tool's real purpose. Instead,
when a UI-path step runs, the same backend engine that already does this for
the CLI (`chromium.launch({ headless: false })`) opens its own, real,
separate OS window — the person watches the actual application there, while
the control panel's own browser tab shows only the step table, controls, and
results log. The web interface adds no new, real UI-rendering complexity at
all; it is a thin, real front end over the exact, same, already-built engine.

## 10a. `API_REGISTRY`'s own real contract — confirmed directly, a genuine, prior documentation gap

`API_REGISTRY` (`backend/scripts/step-runner.ts`) is `Record<string, (args: Record<string, string>)
=> unknown>` — one entry per real screen name, each a real TypeScript function. Confirmed directly,
reading a real entry: `createBusiness: (a) => { const result = db.createBusiness(a.businessName as
any, a.financialYearLabel, db.asUserId(1)); ... }` — **this calls the real backend function
directly, in-process. `--path api` issues no real HTTP request at all.** This had never been stated
plainly anywhere before being checked directly, and matters precisely because the Admin recording
feature below must capture a real, running HTTP session (a genuine user, in the genuine frontend) —
a different, separate layer from `API_REGISTRY`, which exists purely to drive the step-runner's own
fast, no-browser testing path.

**The real HTTP layer**, the one the recording feature actually observes, is the real Express app
(`backend/src/server.ts`): `app.use(cors())` → `app.use(express.json())` → `app.use(attachUser)` (the
real, authenticated session) → one real router per `/api/...` prefix (`entitiesRouter`,
`reportsRouter`, `journalRouter`, `itemsRouter`, and so on — each one real file under
`backend/src/routes/`), most behind `requireAuth`. A real, logged-in `POST /api/journal/create-ledger`
with a real JSON body is the real, true shape of "a real backend action" — `API_REGISTRY`'s own
in-process call is a real, deliberate shortcut around this same shape, for testing speed, never the
same thing.

## 11. The real Admin recording feature ("completing the circle") — built, directly verified

**One real toggle** — "Record" — near Logout, visible only to an
Administrator, triggering one real backend API call to start or stop
(`POST /api/recording/start`, `POST /api/recording/stop`; two real, separate,
idempotent endpoints, not a single toggle endpoint — a real, direct decision:
a blind toggle risks doing the opposite of what the person intended the
moment the frontend's own idea of "on or off" drifts from the backend's
real state, e.g. a page reload or a second tab). While on, every real
request from a real, tagged screen is appended as a real data-file row to
`<user>.recording` (the real, currently logged-in user's own username),
opened in append mode on start, closed on stop. The toggle requests
themselves are never recorded — only a real, plain-text comment line,
`# recording commenced on <ISO date>` / `# recording concluded on <ISO
date>`, using this file format's own, already-established comment
convention (§2a).

**The real, confirmed translation problem, found by direct inspection, and
the real solution that replaced the original reverse-lookup-table design
above (now superseded).** A pure (HTTP method, path) → screen_name lookup
cannot work: checked directly, the real `createEntity` endpoint is shared by
at least six, genuinely different, real frontend pages (the generic entity
editor, Items, Locations, Business Setup, Chart of Accounts, Translations) —
the same signature, several, real, different meanings. The real fix: the
frontend itself now attaches a real, explicit `X-Screen-Name` header to each
specific, real call site that corresponds to a tracked screen
(`frontend/src/lib/api.ts`'s `request<T>(path, init, screenName?)`, its third,
optional parameter) — the recorder never has to guess.

**Two further, real, confirmed, honest limitations, found directly, not
hidden**:
- **Not every real screen has a real frontend page at all.** Checked
  directly: `Cash Purchase` and `Create Employee` are called from no real
  `+page.svelte` anywhere — real, confirmed gaps in the application itself,
  not something the recorder can paper over, since there is nothing real to
  tag.
- **A screen's own `field_name` does not always match its real request
  body's own field names.** Confirmed directly for `Create Business`:
  `businessType`/`homeCurrency` (its own `screens.csv` field names) do not
  exist in the real request body at all (`coaPrototype` is the real field;
  `homeCurrency` is set via a wholly separate, later call). The recorder
  reads each positional field by the same name from the real body and
  leaves it blank when absent — an honest, best-effort reconstruction, never
  a guess.

**The real backend mechanism** (`backend/src/recording.ts`): a `Map<userId,
{stream}>` tracks which real users are currently recording, read by
`isRecording` (checked both by the middleware and by `recordingRouter`'s own
`GET /api/recording` status check); `startRecording`/`stopRecording` open/
close the real file (the latter, confirmed directly by testing, must be
properly awaited — `stream.end()` is asynchronous, and an unawaited stop
risked the file never actually finishing its write before the process moved
on); `recordRequest` reads `shared-fixtures/screens.csv` once, lazily,
groups it by `screen_name`, and writes one real CSV row per matched,
successful (2xx) request. `recordingMiddleware`, mounted after `attachUser`
and before the named routers, reads the real `X-Screen-Name` header and
calls `recordRequest` only once the real response has genuinely succeeded —
a failed attempt is never written. `recordingRouter`
(`backend/src/routes/recording.ts`) exposes all three real endpoints
(`GET /api/recording`, `POST /api/recording/start`, `POST /api/recording/stop`),
mounted behind `requireAuth` like every other real router.

## 11a. The real field-source problem, found by direct testing, not assumed solved

The first, working version of recording read every field from the real request's own JSON body, by
the same name `screens.csv` itself uses. Tested directly, this was wrong: a real "Create Location"
request carries its own location name in the URL path itself and its own business name in the query
string — neither lives in the body at all — so the recorded row came back with two real, required
positions genuinely blank. **A recording that cannot be replayed is not a real recording at all**,
whatever it looks like on screen.

The real fix, confirmed directly against the real route's own code (never assumed from the schema
name alone): `recordRequest` now takes all three real request sources — `req.params`, `req.query`,
`req.body` — and a real, explicit, hand-verified override table
(`REAL_FIELD_SOURCE_OVERRIDES`, `backend/src/recording.ts`) names exactly where each position's real
value lives whenever it differs from "the body, same name." A real, separate, confirmed bug found
while building this: `req.params` is only genuinely populated once Express's own routing has matched
the real route, which happens *after* this middleware calls `next()` — the real capture had to move
inside the `res.on('finish', ...)` callback, by which point routing has genuinely completed.

**Surveying every real, tracked screen's own route directly** (not assumed consistent) found this
same class of problem is widespread, not isolated to one screen: array-nested fields (an item's own
`quantity`/`unitPriceMinor` living inside a real `lines[0]`, not at the top level), differently-named
body keys (`vendorName` for the real body, `providerName` for the screen), and — the deepest problem —
**several real screens whose own, tutorial-only field shape does not correspond to any single, real
HTTP call at all**, because the real, underlying action is genuinely more than one real request.

## 11b. The real, corrected design principle, confirmed directly: a screen may make several real API calls, and each must be complete in itself

The first instinct — buffer values across a screen's several real calls, then write one, combined
row once enough is known — was wrong, and rejected before being built. It would need real, stateful
tracking of "which call is this, within this screen's own sequence," fragile exactly where real
`stageLine` calls (the common case below) are genuinely interchangeable and unordered from the
server's own point of view. **The real, correct principle, stated plainly: there is no "the screen's
own row" at all — there is only ever one real row per real, successful HTTP call, each one complete
in itself**, carrying exactly what that one, specific, real request genuinely sent and nothing it
didn't. A screen that makes three real calls is recorded, and replayed, as three real, separate,
ordinary rows — never specially recombined.

This is not a limitation to work around; it is the honest, correct shape of what actually happened,
and it is simpler than buffering, not more complex: `recordRequest` never needs to know whether a
call is "the first of three" or "the only one" — every call is handled identically.

### The real, worked example: the General Journal

The tutorial-authoring convenience screen `Post Journal Entry` (`businessName`, `debitAccount`,
`creditAccount`, `amountMinor` — one, combined row standing in for a whole, two-line entry) does not
correspond to any single, real HTTP call. The real, underlying application makes **two or more**
separate, real requests: one `POST /api/journal/staging` per real line (confirmed directly,
`backend/src/routes/journal.ts` — `reference`, `business`, `ledger`, `account`, `amount_minor`,
plus optional `description`/`transdate`/`memo`), then one, final `POST /api/journal/post`
(`reference`, `business`, `ledger` only) to actually post the entry.

**The real, corrected screens** (`shared-fixtures/screens.csv`): `Stage Journal Line`
(`reference`, `businessName`, `ledger`, `account`, `amountMinor`) — one real row per real staged
line, matching `/journal/staging` exactly — and `Post Journal Entry`, simplified to its own, real,
three-field shape (`reference`, `businessName`, `ledger`), matching `/journal/post` exactly. A real,
ordinary, two-line journal entry (debit one account, credit another) is therefore recorded, and
replayed, as **three real, separate, complete rows** — two `Stage Journal Line` rows, then one
`Post Journal Entry` row — exactly reproducing the real, actual sequence of calls a genuine browser
session makes, never a single, artificial, four-field row standing in for all of it.

The same, real principle applies wherever this pattern recurs: `Create Purchase Order`'s own real
`stage`/`post` pair becomes `Stage Purchase Order` + `Post Purchase Order` (the latter sharing the
exact, same, simple `reference`/`businessName`/`ledger` shape as `Post Journal Entry` — both are the
same, real kind of action, finalizing something already staged); `Create Item`'s own, real, shared
`createEntity` calls (one for a new category, one for the item itself) become real, separate
`Create Entity` rows (`name`, `parent`), the real, generic shape `createEntity`'s own route actually
has — never a screen-specific one.

## 11c. The real, path-aware field-source resolver — built, every tracked screen now checked and confirmed

`FieldSource` (`backend/src/recording.ts`) gained an optional, real `path` — a sequence of array
indices and object keys followed from the named source's own top-level key, e.g.
`{ key: 'lines', path: [0, 'itemName'] }` reads `body.lines[0].itemName`. `resolveFieldSource` walks
it, returning `undefined` (recorded blank, never a guess) the moment any step along the way is
missing.

**Every real, tracked screen's own override now checked directly against its own, real route code**,
not assumed from its name: `Open Container` (`business`/`location`/`item`, not
`businessName`/`locationName`/`itemName`; `containerValues[0]`/`unitValues[0]`); `POS Sale` and
`Cash Purchase` (`business`, not `businessName`; `vendorName` for `Cash Purchase`'s own
`providerName`; every line field nested inside the real `lines[0]`); `Receive Into Storage`
(`business`, not `businessName`; the real location name is the URL's own path segment, not the body;
`combinationShape[0][0]`/`combinationValues[0]`).

**`API_REGISTRY` entries added** for every new, granular screen (`stageJournalLine`,
`postJournalEntrySimple` simplified, `createEntitySimple`, `stagePurchaseOrderSimple`,
`postPurchaseOrderSimple`) — each a thin, direct, one-to-one call into the same, real backend function
its own real route calls.

**`tutorial-steps.csv`'s own `Post Journal Entry` row rewritten** into its own, real, three-row
sequence (two `Stage Journal Line` rows, one `Post Journal Entry` row) — confirmed directly: the full,
real tutorial (now 24 steps) passes end to end via `--path api`, and the real Balance Sheet numbers on
both ledgers remain exactly correct afterward, no regression from the rewrite.

**Directly verified, over real HTTP, against the real, running server** — not merely "compiles":
the real General Journal sequence (two `Stage Journal Line` calls, one `Post Journal Entry` call)
recorded exactly, completely, with every field in its real, correct position; `POS Sale`'s own,
real, nested line fields (`itemName`, `quantity`, `unitPriceMinor`) resolved correctly from inside
the real `lines[0]`; `Open Container`'s own, real `containerValues[0]`/`unitValues[0]` resolved
correctly too.

**Not yet done**: `Cash Purchase` and `Receive Into Storage`'s own overrides compile clean but have
not yet been exercised with a real, direct HTTP request the way the others above have been.

## 11d. The real Cash Sale scenario — a real, confirmed gap found in the application itself, not just the tutorial

Asked directly whether the tutorial exercised a bulk, phone-ordered sale (not through the POS
register) — it did not, and checking further found something larger: **there was no real, staff-side
way to create a named customer at all.** Confirmed directly: `entitiesRouter` has dedicated
`/vendor` and `/employee` endpoints, but no `/customer`; `createInvoice` requires the named party to
already exist, no lazy creation; `registerCustomer` exists but is a genuinely different, real flow —
a customer typing their own details at self-service, landing in `'pending'` status — never something
staff would use to take a phone order on someone's behalf.

**The real fix, built**: `createCustomer` (`backend/src/db.ts`), mirroring `createProvider` exactly,
and the real, new `POST /api/entities/customer` route to match `/vendor`. The real `Cash Sale` screen
itself (`shared-fixtures/screens.csv`, its own `API_REGISTRY` entry, its own recording overrides) uses
the exact, same, real `completePosSale` endpoint `POS Sale` and `Cash Purchase` already use — a real,
immediate, no-account sale, confirmed directly against its own, real `customerName` comment ("the
generic walk-in 'Cash Sale' contact for a no-account sale").

**Added to `tutorial-steps.csv`**: a real, named party, "Riverside Restaurant," phones in an order for
half a carton (12 bottles — the real stock on hand at that point in the tutorial allows no more,
found directly by testing and adjusting from an initial, too-large assumption) of Amber Ale, paid cash
on collection. **Confirmed directly**: the full, real tutorial (now 26 steps) passes end to end via
`--path api`; the real recording mechanism, tested directly over HTTP against fresh data, captured
both new screens completely and correctly:

```
Create Customer,,Lakeside Bistro
Cash Sale,Tutorial Wine Retail Business,Main Street Cellar,Lakeside Bistro,Amber Ale 330ml,4,500
```

**Directly verified**, calling the real mechanism directly (not assumed
correct): starting a recording, recording two real, different screens'
own data, stopping, and reading the resulting file back — the real comment
lines, the real, correctly positioned field values (including a genuinely
empty position where the real request body had no matching field), in the
exact order `screens.csv` itself defines.

**Not yet done**: an end-to-end Playwright/browser confirmation of the real
toggle button itself — only the backend mechanism and the frontend's own
compiled code have been verified so far.

## 12. Honest, real, current status

**The corrected, positional, command-free design (sections 3–6) is fully
implemented and confirmed working end to end**, both `--path api` and
`--path ui` (`backend/scripts/step-runner.ts`,
`shared-fixtures/screens.csv`/`tutorial-steps.csv`,
`tutorial-steps.control.csv`). `--lint` and `--pretty` rebuilt to match. 12
real unit/integration tests (`backend/scripts/step-runner.test.ts`), all
passing, per the testing plan in section 7.

**The long-standing `create_location` selector issue is genuinely
resolved.** The real, root cause, found by directly inspecting the actual,
live DOM rather than guessing further: the form's real CSS class is
`.generic-form`, never `.form-card` — an incorrect assumption carried forward
from an earlier, mistaken reading of the source, repeated across three, real,
separate, unsuccessful attempts before being checked directly. A real,
further, related gap found and fixed in the same pass: "Select Business" (used
both right after login and to switch to a newly-created business) needs its
own, real, separate "Switch Session" screen entry with its own real `/session`
navigation — reusing the same screen entry for both left the second use with
no real navigation at all. All five real steps of the tutorial slice (login,
select business, create business, switch session, create location) now pass
via the real UI path.

**A real, further, confirmed, separate finding, not yet resolved**: the API
path and UI path do not share real browser session state — a mixed-mode run
(some steps via `path=api`, no browser at all, then switching to `path=ui`)
finds no real, logged-in session in the freshly-launched browser once it
switches. The real, mixed-mode control-file example (section 5) has therefore
not yet been proven end to end; only a pure, single-path run (`--path ui` for
every real step) has been confirmed.

**Not yet built**: the web interface (section 10) and the Admin recording
feature (section 11) remain design-only. The real tutorial fixture covers
only five of the tutorial's own, real, full step count - extending it further
is real, further, incremental work.

**A real, serious, confirmed gap, found by direct correction, not caught
internally: the replacement mandate stated at the very top of this chapter —
"replacing the tutorial e2e's own, bespoke Playwright script, the wine-retail
simulation script, and demo-seeding" — has not been carried out.**
`backend/scripts/simulate-wine-retail-month.ts` still exists today, still
runs, and was treated across a long, separate session as a legitimate,
parallel testing mechanism — type errors fixed in it, a real bug found and
fixed inside it, its history bisected across dozens of commits — all without
once checking this chapter's own opening line, which already named it for
retirement. See `docs/skill-manual-as-source-of-truth.md`'s own "a second,
more severe occurrence" entry for the full, honest account of how this
happened. The concrete debt this leaves: all three named mechanisms
(the simulation script, the tutorial's bespoke Playwright script, and
demo-seeding) still need converting into Step Runner data files, per
`docs/realistic-tutorial-e2e-plan.md`.

**A second, related, separate gap, found by direct line-by-line comparison
against the User Manual's own Chapter 3**: `tutorial-steps.csv`, even at its
fullest point this session, covered perhaps a third of Chapter 3's full,
written scenario — it never expressed a Division, a Warehouse created
through Business Setup, an Employee, a location's own static capacity, an
item's own cost/price/pack size, a Vendor, a Purchase Order, a Cash Purchase,
a Stock Transfer, a POS sale, or the owner's own opening-capital journal
entry — not because these were decided against, but because no screen type
or field existed yet to express them, and this was never checked against
Chapter 3 directly until asked for, repeatedly, by direct instruction. The
full, itemized gap and the plan to close it are in
`docs/realistic-tutorial-e2e-plan.md`.

## 13. A real design proposal — session-establishing screens are one, real, logical step

Per a direct, real question raised while reviewing the lint check's own output:
should "Login" genuinely include real business and real language selection as
part of the exact, same, real logical step? **Yes.** Establishing a real
session is genuinely one, real, logical fact — who, as which real business, in
which real language — not three, real, separate, unrelated concerns
artificially split across separate screen-registry entries. Today's fixture
treats `Login`, `Select Business` (twice — once right after login, once again
to switch to a newly-created business), and `Switch Session` as four, real,
separate entries, which is exactly why the `--lint` no-op check (section 7)
flagged three of them as false positives — they are genuinely, correctly
UI-only, session-establishing actions with no real, meaningful data-creation
side effect to call via the API path at all (the API path calls real backend
functions directly, bypassing HTTP and session establishment entirely — it
has no real need to "log in" in the first place).

**The real, proposed fix, not yet implemented**: introduce a real, distinct
screen *kind* — session-establishing, as opposed to data-creating — so the
lint check's own real no-op heuristic can tell the two apart structurally,
rather than a person having to remember which false positives are safe to
ignore. A real, simple way to do this: a real, additional column
(`screen_kind`: `session` or `data`, defaulting to `data`) in `screens.csv`,
and `lintSteps` only raises its real "submit_selector but no api_function"
warning for real, `data`-kind screens. `Login`, `Select Business`, and
`Switch Session` would all be marked `session`; `Create Business`, `Create
Location`, `Create Item`, and every real, further, data-creating screen stays
`data`.

## 14. Honest, comprehensive documentation of this entire session

Per direct instruction, everything real, done and found across this whole,
long session, in one place:

- **`ensureLocationCapacityAccount` redesigned** (checkpoint 395): opening
  storage capacity is never single-sided — a real, balanced, two-line entry
  against a new "Storage Capacity Installed" counterpart, tagged with its own,
  distinct real currency (`SPACE-BOTTLE`/`SPACE-CARTON`).
  `ensureItemQuantityAccounts` similarly tags every real quantity account
  with the item's own unit of measure. A real, further bug found and fixed:
  `setAccountCurrency`'s own bare, name-based lookup was genuinely ambiguous
  once account names like "Storage Capacity Remaining" began legitimately
  repeating per-location — given an optional, real `entityId` parameter.
- **A real, unapproved design mistake made, caught, and fully reverted**: an
  attempt to move Min/Max/Reorder/Shelf Level out of the journal and into the
  `Detail` primitive was built and tested, then removed in full — per direct
  instruction that `Detail` itself had never been properly, formally designed
  and approved, and "if it has not been designed it does not exist." `git
  checkout` restored `db-stock.ts`/`db.test.ts` to checkpoint 395's own,
  exact, committed state. This remains a real, open, unfixed issue.
- **`location_staging` added** (checkpoint 396), per direct, absolute
  correction that every real, user-facing data-entry form has a real,
  dedicated staging table behind it — matching the exact, established
  `stock_receipt_staging` shape precisely. A real, important architectural
  correction made along the way: entity creation stays in TypeScript through
  the typed `create()`/`Entity.create()` functions always — the `entities`
  table is genuinely append-only and self-auditing, with zero "create entity"
  SQL statement anywhere, so no trigger may ever insert into it directly.
  `stageLocation`/`postLocation` implement this correctly; `postLocation` is
  the one, real place a location is actually created, with its own real,
  balanced capacity accounts, atomically, in one, real transaction.
- **A real, direct clarification received and confirmed**: the two staging
  calls originally being asked about were specifically the two `stageLine`
  calls inside `ensureLocationCapacityAccount` (Remaining/Installed) — already
  built at checkpoint 395 — not a request for an entirely new staging table.
  `location_staging` was still real, additional, correct work per the
  broader, absolute "every form has its own staging table" requirement, just
  not what that one, specific remark was about.
- **The frontend Locations screen, found to have never been wired to any of
  this session's own backend work at all** (checkpoint 397): `createNewLocation`
  was still calling the long-eliminated, generic `createEntity` directly, as
  two, separate, unrelated requests. Fixed to call one, real, new
  `createLocation` API wrapper, properly awaited in full, reaching the real,
  staging-backed backend path for the first time. The Form component's own
  real submit-button disabling (`disabled={saving}`) was checked directly and
  confirmed already correct — the real gap was purely that the awaited call
  never reached the real, correct backend path at all.
- **A real, repeated, directly-acknowledged process failure**: frontend/UI
  testing was reached for multiple times today before the backend was fully,
  directly proven correct on its own via the API alone — a real violation of
  this session's own, established `backend-first-testing` discipline, named
  directly each time it happened. A real, comprehensive, direct backend check
  (business, location, item, a real stock receipt, then the real trial
  balance/profit-and-loss/balance-sheet reports) was run directly, without
  any frontend involvement, confirming these reports compute and balance
  correctly against real, tutorial-shaped data.
- **The Step Runner's own `--lint` extended**: a real screen with a real
  `submit_selector` but no real `api_function` now correctly, strenuously
  raises a real problem — this is exactly the check that would have caught
  `Create Item`'s own real no-op the moment its fixture row was first
  written, rather than being discovered by chance during a later,
  unrelated backend check. Section 13 (above) proposes the real, further
  refinement needed to stop this same check from also, incorrectly, flagging
  genuinely session-establishing screens as if they were the same kind of
  problem.

## 15. The augmented tutorial e2e test — genuinely, fully passing, both paths

Per direct instruction to implement and make the backend/API pass, then the
frontend: **the real tutorial fixture (7 real steps: login, select business,
create business, switch session, create location, create two real items)
now passes completely via both `--path api` and `--path ui`, with `--lint`
reporting zero real problems.**

**The `screen_kind` proposal (section 13) implemented**: `screens.csv` gained
the real column; `Login`/`Select Business`/`Switch Session` marked `session`,
every real, data-creating screen left as the real, default `data`. The lint
check's own "submit_selector but no api_function" warning now only applies to
real `data`-kind screens, resolving the three, real, false positives directly.

**`Create Item`'s own, real, genuine no-op fixed**: a new `createItemAndCategory`
real API-registry entry, matching the real UI's own exact behaviour (a real
`+ New category…` value creates a real, new category first; any other real
value names a real, already-existing one directly, checked via a real
`fetch`/catch rather than assuming). `businessName` added as the screen's own
real, first position (API-only — no real UI selector, since the real screen
never asks for it, reading it from the real, current session instead).

**Two real, further, genuine UI-path bugs found and fixed along the way,
neither environmental, both confirmed reproducible**:
1. `runStepViaUi` always re-navigated to a real screen's own `ui_path`, even
   when already there — a real, unexplained "browser has been closed" crash
   on the second, real `Create Item` step, reproduced consistently, was
   traced directly to this real, unnecessary reload, not dismissed as flaky.
   Fixed to skip navigation when already on the same real path.
2. Once the crash was resolved, a real, second bug surfaced: every real
   field was filled unconditionally, including a real, conditionally-visible
   field (`newCategoryName`) that does not exist in the DOM at all when its
   own real value is empty. Fixed to skip any real field whose value is
   empty, rather than trying to fill a real field that was never shown.

Confirmed directly: all 7 real steps pass via `--path api` (with the real
items and category confirmed to genuinely exist afterward, not merely
reported as `✅`), and all 7 real steps pass via `--path ui`, driving an
actual, real, live browser through the actual, real screens.

**Not yet done, stated honestly**: no real screenshots were captured in this
round (no real `.control.csv` with screenshot names currently accompanies the
fixture). The fixture still covers only 7 of the tutorial's own, real, full
step count. The web interface and Admin recording feature remain design-only.

## 17. The real Makefile targets

`test-e2e-tutorial` — the real, augmented tutorial fixture, run via the fast,
direct API path (`--path api --non-interactive`), no browser, no running
servers needed. Confirmed directly: all 7 real steps pass.

`test-e2e-tutorial-playwright` — the exact, same, real fixture, driven
through an actual, real, live browser instead (`ensure-servers` as a real
dependency, reusing already-healthy servers per the established pattern).
Confirmed directly: the first five real steps pass; a real, further,
separate screenshot-capture timeout was found on the sixth (`Create Item`)
— stated honestly, not glossed over, and distinct from the earlier,
already-fixed navigation/empty-field bugs. The backend was confirmed to
stay fully healthy throughout, so this is a real, browser/screenshot-level
issue, not a server crash.

A real, further, separate bug found and fixed while building these targets:
the prepared control file (checkpoint 400) set `path` to `ui` on every real
row, which silently overrode the CLI's own `--path api` flag entirely,
since a step's own control-file `path` always takes precedence. This
defeated the whole purpose of `test-e2e-tutorial` as a browser-free target.
Fixed by leaving `path` blank in the control file, deferring to whichever
real `--path` the caller actually asked for.
