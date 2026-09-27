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
no field names, anywhere in this file.

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

## 11. The real Admin recording feature ("completing the circle")

Near the Logout control, an Administrator sees two, real toggles — "Record
Frontend" and "Record Backend." While either is on, every real action (a
frontend click/fill/navigation, or a backend request) is logged as a real
data-file row plus its matching control-file row, in the exact, real format
above. Stopping writes `shared-fixtures/recorded-{sessionId}.csv` (and its
matching `.control.csv`) — directly loadable by the step-runner itself,
closing the circle from a real, live session back into a real, replayable
fixture.

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
  `ensureProductQuantityAccounts` similarly tags every real quantity account
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
