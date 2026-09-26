## The Step Runner — the one, real, unified testing and data-loading tool

Per direct instruction: this is designed to become **the one and only real testing
and data-loading tool for this application** — replacing the tutorial e2e's own,
bespoke Playwright script, the wine-retail simulation script, and demo-seeding, all
of which currently duplicate the same underlying knowledge (what a business setup
looks like, what an invoice looks like) in three, separate, real, hand-written
places that can silently drift apart from each other — exactly the kind of drift
this whole session kept finding and fixing one instance at a time.

### The real, underlying idea

A real, ordered sequence of steps, held in one real, plain, human-readable CSV file
— extending, not replacing, the already-established `shared-fixtures/*.csv`
convention. Each step is real, dual-path from the start: it can be executed either
as a real, direct backend function call (fast, no browser — for data loading, CI,
and quick iteration) or as a real, driven Playwright browser action (for actually
proving the UI works, and for producing real, documented screenshots) — the same
step, either way, so the two paths can never silently drift the way a separate
"simulation script" and "Playwright script" already had.

### The real CSV schema

One file per real scenario (e.g. `shared-fixtures/tutorial-steps.csv`). Real
comment lines — one or more, directly above the step they describe, never a
comment column — start with `#` and are skipped by the parser, existing purely for
a real person reading the file directly:

```csv
# Log in as the real, default administrator account.
step_id,description,api_function,api_args,ui_screen,ui_actions,verify,screenshot
login,Log in as admin,,,/login,"[{""type"":""fill"",""selector"":""input[autocomplete=username]"",""value"":""admin""},{""type"":""fill"",""selector"":""input[autocomplete=current-password]"",""value"":""changeme123""},{""type"":""click"",""selector"":""button:has-text('Log in')""}]",,login_page

# Create the real business this whole scenario runs against.
create_business,Create the tutorial's own real business,createBusiness,"{""businessName"":""Wine Retail Business"",""financialYearLabel"":""2026-27""}",/setup/new-business,"[{""type"":""fill"",""selector"":""input[placeholder*='Corner Store']"",""value"":""Wine Retail Business""},{""type"":""fill"",""selector"":""input[placeholder*='2026-27']"",""value"":""2026-27""},{""type"":""click"",""selector"":""button:has-text('Create Business')""}]",business_exists,business_created
```

Columns:
- **`step_id`**: a real, unique, stable identifier — used to reference a step from
  the runner's own CLI (`--from step_id`, `--to step_id`, `--only step_id`).
- **`description`**: one, short, real sentence — shown in the interactive mode's
  own tabular display and used as the default screenshot caption.
- **`api_function`** / **`api_args`** (JSON object): the real, direct backend
  function to call, and its real, named arguments, for the API-path execution.
  Blank when a step is genuinely UI-only (a real navigation, a login).
- **`ui_screen`** / **`ui_actions`** (JSON array of `{type, selector, value?}`):
  the real, driven Playwright path — `type` is one of `goto`, `fill`, `click`,
  `select`, `check`, `wait`.
- **`verify`**: an optional, real, named check (from a small, fixed, shared
  registry both paths call identically — `business_exists`, `trial_balance_balances`,
  `stock_level_saved`, etc.) — run after either path, so the same real assertion
  protects both.
- **`screenshot`**: an optional real name — when present, a screenshot is taken
  (UI-path runs only; the API path logs the same name without an image, keeping
  step numbering identical between the two paths).

### The real runner — `backend/scripts/step-runner.ts`

**Interactive mode** (the default): shows the next `N` real steps (default 1) in a
real, tabular display — one real row per step, real columns matching the CSV's own
headers exactly (`step_id`, `description`, `api_function`, `api_args`, ...), so the
person sees exactly the real, real data about to run, not a paraphrase of it. Then
executes them, via `--path api` (default, fast) or `--path ui` (opens a real,
headed Playwright browser, `--ui` for Playwright's own Inspector, with a real,
configurable delay between steps — `--delay 5000`, defaulting to 5000ms — so a
person can actually watch each one).

**Non-interactive mode** (`--non-interactive`): runs a real range of steps
(`--from`/`--to`/`--only`, or the whole file) with no pauses and no prompts — the
real mode CI and data-loading use.

**Screenshot capture**: `--screenshot-dir <dir>` (default
`docs/manual-images-tutorial/`, matching the existing convention) saves every real
step's own named screenshot there; `--screenshot-only step_id[,step_id...]`
captures just the named, real steps' screenshots without running anything else —
the real, direct replacement for hand-maintaining a separate screenshot script.

**CLI summary**:
```
step-runner <fixture.csv> [options]
  --path api|ui              which real path executes each step (default: api)
  --steps N                  how many real steps to show/run at once (default: 1)
  --from / --to / --only     a real step_id range or single step
  --non-interactive          run without prompts or pauses
  --delay MS                 real pause between UI-path steps (default: 5000)
  --ui                       open Playwright's own Inspector (--path ui only)
  --screenshot-dir DIR       where real screenshots are saved
  --screenshot-only IDS      capture only these real steps' screenshots
```

### The real web interface

A small, real, local-only web UI (served alongside the backend during
development, never in production) at `/dev/step-runner` — the same real,
tabular step display and controls as the CLI's interactive mode, in a real
browser tab: a table of upcoming real steps, a "Run next N" control, a live log
of real results, and inline real screenshots as they're captured. Talks to the
same real `step-runner` engine via a small, local-only API, so the CLI and the
web interface are two real views over one real, shared implementation, never two,
separately-maintained ones.

### Honest, real, current status

**Built and confirmed working**: the real CSV parser (`parseStepFile`,
`backend/scripts/step-runner.ts`), handling real, `#`-prefixed comment lines and
real, quoted, JSON-bearing columns; the real, tabular display
(`printStepsTable`), using the fixture file's own real column headers directly,
per direct instruction; the real, API-path execution engine, with its own real
function registry (`API_REGISTRY`) and shared verification registry
(`VERIFY_REGISTRY`); real interactive mode (prompts before each real batch,
stops on a real failure unless told to continue) and real non-interactive mode
(`--non-interactive`). **The real UI-path engine, built and confirmed working
directly, driving an actual, real Playwright browser**: `--path ui` executes
`goto`/`fill`/`click`/`select`/`check`/`wait` actions, captures a real,
named screenshot per step, and honors `--delay`/`--ui`/`--screenshot-dir`.
Confirmed, directly: nine of ten real steps of an expanded tutorial slice
(`shared-fixtures/tutorial-steps.csv`: login, create the real Wine Retail
Business with its own real business-type selection, switch session, view the
freshly-empty real Locations screen, create the first real division/warehouse/
employee via the Entity Tree Editor's own real, keyboard-driven "Insert"
convention, create the first real item and its beer-can variant) run end to
end via the real UI path.

A real, further, general-purpose addition made along the way: `resolveLocator`,
supporting a real `role:role|name|then` selector format (pipe-delimited,
deliberately never JSON-within-a-string, which would need a real, further,
second level of escaping on top of the CSV's own) - for this application's own,
real, dynamically-generated form fields, where a plain CSS selector cannot
reliably target one, specific, real field the way `page.getByRole()` can.

**`--lint`**, per direct instruction: checks a real, proposed fixture file's own
integrity before any real step of it ever runs - a real, duplicate or missing
`step_id`; an `api_function`/`verify` name with no real registry entry; genuinely
invalid JSON in `api_args`/`ui_actions`; an unknown real `ui_action` type; a real
action missing its own required `selector`; a real step that does nothing at all
(no `api_function`, no `ui_screen`/`ui_actions`). Confirmed, directly: the real
tutorial fixture passes with zero real problems.

**`--pretty`**, per direct instruction: real, named, per-step sections, each
step's own real data shown with the fixture's own real column headers - the
same, real display the interactive mode already used, now also available as
its own, standalone, real command for reviewing a fixture without running it.

**Not yet built, stated honestly**: the real web interface (`/dev/step-runner`);
the real, full conversion of the remaining real tutorial steps beyond these
first ten; the Admin recording feature (Phase 6); Phases 3-5 (retiring the old
tutorial test, migrating the wine-retail simulation and demo-seeding,
disabling every other test path). **One real, confirmed, open issue, not yet
resolved despite two real, separate attempts** (a `role:` locator, then a
positional `.form-card fieldset >> nth=N` locator): the tenth step
(`create_location`) still fails to reliably fill this application's own,
real, dynamically-generated location-creation form fields. The real, root
cause has not been found - stated honestly here rather than worked around
or claimed fixed. The `API_REGISTRY`/`VERIFY_REGISTRY` cover only the two
real functions the current fixtures need — extending them as each further,
real fixture is written.
