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
  --non-interactive           run without prompts or pauses (needs a real .control.csv
                               for verify/screenshot, since no flags apply per-step)
  --delay MS                  real pause between UI-path steps (default: 5000)
  --ui                        open Playwright's own Inspector (--path ui only)
  --screenshot-dir DIR        where real screenshots are saved
  --verify NAME                (single-step mode) the real check to run after this step
  --screenshot NAME             (single-step mode) the real screenshot name for this step
```

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
`path,verify,screenshot`. Row N corresponds to data-file row N; `path` is
`api` or `ui` (or blank, falling back to the command line's own `--path`
flag); `verify`/`screenshot` may be empty. This is a real, complete,
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

**Documented in full above, per direct instruction, for review** — this is
the corrected, approved design. **Not yet implemented to match it**: the
existing `backend/scripts/step-runner.ts` and `shared-fixtures/screens.csv`/
`tutorial-steps.csv` still reflect an earlier, superseded design (long-format
`field_name`/`field_value` rows, `verify`/`screenshot` embedded in the data
file) — none of it yet matches the positional, command-free design in
sections 3–6 above. The web interface (section 9) and the Admin recording
feature (section 10) are design-only, nothing built. No automated tests exist
yet for the CLI's own behavior (`--lint`, `--pretty`, `--steps`, etc.) — the
gap that let an earlier `--pretty`/`--steps` bug ship undetected until caught
by hand.
