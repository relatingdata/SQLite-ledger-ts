# A text user interface, faithful to the web frontend's own styling

## Why this is a thin client, not a second frontend

The backend is already a plain, auth-gated REST API on `:3001` — the
SvelteKit frontend is just one client of it, with no privileged access the
TUI can't also have. Nothing in `backend/src/` changes for this. The TUI
(`tui/`) is a second, real client of the exact, same API, built in
TypeScript so it can directly reuse what already exists rather than
re-deriving it:

- **Auth is a bare Bearer token**, not a cookie (`backend/src/routes/auth.ts`'s
  `POST /auth/login` returns `{ token, user }`; every further request sends
  `Authorization: Bearer <token>`). This is the one real reason a Node TUI is
  *easier* to wire up than the browser frontend, not harder — there's no
  cookie jar to manage, no CORS, no `credentials: 'include'`. A token is
  just a string the TUI holds in memory and persists to a small, real,
  per-user session file (`~/.sql-ledger-ts-tui/session.json`) so a second
  run doesn't force a fresh login — the direct terminal equivalent of the
  frontend's own `sessionStorage` (`frontend/src/lib/state.svelte.ts`).
- **The request shapes are already fully typed**, in
  `frontend/src/lib/api.ts` — `StagedLine`, `BalanceSheet`, `MenuSectionRow`,
  `LoginResponse`, and the real functions that call them
  (`apiLogin`, `getMenuTree`, `getBalanceSheet`, `stageLine`,
  `postJournalEntry`). The TUI's own `tui/src/api.ts` is a direct,
  near-verbatim port of this file's request wrapper and the handful of
  functions v1 actually needs — same endpoints, same payload shapes, same
  branded types (`BusinessName`, `LedgerName`, `AccountName`) — not a
  reimplementation against the HTTP routes from scratch.

## Running it

`make backend` starts the one, real, shared backend; `make text-frontend`
starts this TUI against it (its own terminal, since it needs real
stdin/stdout — never bundled into `dev`/`dev-verbose` the way backend+web
are paired there). The browser frontend's own target is now `make
web-frontend` for symmetry, now that there are genuinely two, real,
separate frontends — `make frontend` stays as a working alias to it, so
old muscle memory keeps working. `make test-tui` is this TUI's own,
real, live, end-to-end smoke test (`tui/test/smoke.test.ts`, via
`@microsoft/tui-test` — see below) — it reseeds the database, seeds the
real tutorial fixture via the direct API path, starts a real backend, and
drives the TUI through every screen below exactly the way a person would,
the same real proof `make test-e2e-tutorial-browser` already gives the web
frontend via Playwright.

## Scope: what v1 actually covers

Per direct instruction, v1 is a real, working **test implementation** of
six screens, not a full port of every route the web frontend has:

1. **Login** — username/password, real `POST /auth/login`.
2. **Business and ledger selection** — a real prerequisite the web app also
   has (`GET /businesses`, `GET /businesses/:name/ledgers`,
   `POST /auth/session/business`), since every other screen below is scoped
   to one business and (for Journal/Balance Sheet) one ledger. Folded into
   the login flow as two short extra steps, not a separate menu entry.
3. **Menu / Submenu navigation** — the real, live, server-computed menu
   (`GET /menu?business=...`, the same endpoint
   `BusinessStructurePopup.svelte`'s own host screen reads), not a
   hand-maintained, parallel menu hardcoded into the TUI. Two-level
   navigation (section → links), matching the real shape
   `MenuSectionRow`/`MenuLinkRow` already has.
4. **General Journal** — the real stage-then-post flow
   (`POST /journal/staging` per line, then `POST /journal/post`), mirroring
   the web `General Journal` screen's own two-step mechanism exactly, not a
   simplified, single-call substitute.
5. **Balance Sheet** — read-only, `GET /reports/balance-sheet`, rendered as
   three real sections (Assets / Liabilities / Equity) with their own real
   totals and the real `balanced` flag.
6. **New Business wizard** — the real `POST /businesses` flow
   (`createBusiness`), mirroring
   `frontend/src/routes/setup/new-business/+page.svelte`'s own sequence:
   business basics (name, financial year label/start date, reporting
   frequency, CoA prototype, legal/entity structure with partners where
   needed, home currency, optional secondary currencies) → the generated
   admin credentials shown exactly once → the post-creation bank/currency
   wizard (`nominateBankAccount`, then `buildBankCurrencyStructure`).
7. **Org Chart** — the real Department/Employee data behind the Business
   Structure popup's Org Chart step (`GET /departments/org-chart`,
   `POST /departments`, `DELETE /departments/:name`,
   `PUT`/`DELETE .../employees/:name/department` and `.../manager`). The web
   app draws this as a typed-box diagram with connector lines
   (`OrgChartNode.svelte`); a terminal can't usefully draw that, so this
   screen keeps the same real data and operations as a drill-down list
   instead — Departments plus an "Unassigned" bucket, each bucket's
   Employees underneath, each Employee's own independent Department and
   Manager assignments one level further in.

Everything else the web frontend has (POS, Purchase Orders, Quotations,
every other report, and the Business Structure popup's Locations/
Divisions/Item-Category steps) is explicitly out of scope for this test
implementation — the screens above are chosen because together they
already exercise every *kind* of screen this app has (a simple form, a
navigable tree, a stage/post transactional flow, a read-only report, a
multi-step wizard, and a drill-down CRUD screen), so the same pattern
extends to any further screen later without a new architectural decision.

## Keyboard navigation model

The web app already has one real, established keyboard idiom worth
extending rather than inventing a second one: the Business Structure
popup's own **Insert / Enter / Escape / Delete** convention
(`BusinessStructurePopup.svelte`, `OrgChartNode.svelte`) — Insert starts
adding something new, Enter confirms/drills in, Escape cancels/backs out,
Delete removes the selected thing. The TUI reuses the same four keys for
the same meanings, plus the ordinary terminal-list vocabulary everything
below it already assumes:

| Key | Meaning, consistently across every screen |
|---|---|
| ↑ / ↓ (or j/k) | Move the selection within the current list/menu/table |
| Enter | Drill into a submenu, open the selected screen, or confirm a field |
| Escape | Back out one level (submenu → menu, screen → menu, field → list) |
| Tab / Shift-Tab | Move between fields within a form (Login, a Journal line) |
| I (Insert's own, real idiom — terminals don't reliably deliver a literal Insert keypress to a raw-mode app) | Start a new staged line (General Journal) |
| D (Delete's own idiom, same real reason) | Remove the selected staged line, before posting |
| P | Post the staged entry (General Journal) |
| q (from the top-level Menu only) | Quit |

The Menu screen is a real, two-level tree (section → links), navigated the
same way `StructureTreeNode`'s own indentation already reads on the web —
arrow keys move within the current level, Enter either drills into a
section's links or, on a leaf link, opens that screen, Escape climbs back
up one level (from a section's links back to the section list, then from
the section list — nowhere further; q quits from there).

## Theme: porting the web app's own color tokens

`frontend/src/lib/app.css`'s real, named tokens — not an invented, separate
TUI palette:

| Token | Hex | Web role | TUI role |
|---|---|---|---|
| `--ink` | `#1e2430` | primary text | primary foreground |
| `--ink-soft` | `#5a6472` | secondary text | dim/secondary foreground |
| `--paper` | `#ffffff` | page background | (terminal default background — not forced; see below) |
| `--paper-raised` | `#f7f8fa` | raised panel background | selected-row background (lightest) |
| `--paper-dim` | `#f9f5ec` | subtle warm panel tint | focused-field background |
| `--rule` | `#e2e5ea` | hairline borders | box-drawing borders, inactive |
| `--rule-strong` | `#c7ccd4` | emphasized borders | box-drawing borders, active panel |
| `--brass` | `#a9812f` | the app's own accent (links, active state) | selection highlight, focused-row accent, headings |
| `--brass-dark` | `#8a6a24` | hover/pressed brass | pressed/confirmed state (e.g. "posted") |

`tui/src/theme.ts` exports these as plain hex strings; Ink's `<Text
color="#a9812f">` renders true 24-bit color directly when the terminal
supports it (iTerm2, modern Windows Terminal, most Linux terminals) and
Ink/chalk's own color-level detection quietly degrades to the nearest
ANSI-256/16 color otherwise — no separate fallback palette to maintain by
hand.

One deliberate departure from the literal web palette: the TUI does
**not** force `--paper`'s white as the terminal background. A terminal's
own background (often dark) is the person's own, standing preference,
the same way their OS theme is; forcing white would fight it on every dark
terminal. Foreground colors (ink/brass/rule) carry the app's identity;
background stays whatever the terminal already is, with `--paper-raised`/
`--paper-dim` used only as relative (lighter-than-surrounding) highlight
states, not literal hex fills, so they read correctly on light or dark
terminals alike.

## Architecture

```
tui/
  package.json           # new workspace member, alongside backend/frontend/e2e
  tsconfig.json
  src/
    theme.ts             # the token table above
    session.ts           # token read/write to ~/.sql-ledger-ts-tui/session.json
    api.ts                # ported request() wrapper + the v1 functions
    App.tsx               # top-level screen router (a small state machine)
    screens/
      Login.tsx
      ChooseBusiness.tsx  # business, then ledger
      Menu.tsx
      GeneralJournal.tsx
      BalanceSheet.tsx
      NewBusinessWizard.tsx
      OrgChart.tsx          # Departments + Employees drill-down (the Business Structure popup's Org Chart step, as a list)
    components/
      Panel.tsx           # a bordered box using --rule/--rule-strong, a title bar in --brass
      MoneyText.tsx        # minor-units → "$1,234.56" / "$(100.00)" for negatives, matching StatementLine's own sign convention
```

Built with **Ink** (React for terminals) — chosen in preference to
`blessed`/`terminal-kit` specifically because its component model matches
the one the Svelte components already use conceptually (composable,
re-rendering on state change), so a screen like `GeneralJournal.tsx` reads
the same shape as `GeneralJournal.svelte`'s own stage/post logic, not a
foreign imperative-draw API. `ink-text-input` and `ink-select-input` cover
the Login form and the Menu/business/ledger pickers; the Balance Sheet's
own section tables are small enough to hand-render with `<Box>`/`<Text>`
column alignment rather than pulling in a table library for three columns.

## Testing: a real terminal-emulator engine, not a hand-rolled pty wrapper

`tui/test/smoke.test.ts` is driven through **`@microsoft/tui-test`** —
Microsoft's own terminal-testing framework, built around a genuine
terminal-emulator engine (not a mock), with the same real shape Playwright
gives the browser frontend: a `TuiTest` client, chainable `Locator`s
(`terminal.getByText(...)`), and `expect()`-style assertions that poll
until a condition holds or a real timeout fires. It replaced an earlier,
throwaway set of hand-rolled Python `pty.openpty()` driver scripts used
while building each screen — real and useful for one-off, interactive
verification, but not something to keep maintaining or committing.

Two real, confirmed-live gotchas carried over from that earlier,
hand-rolled driver, and apply equally here:

- **Sending a whole string in one write (or one `submit()`/`type()` call)
  trips Ink's own paste-detection heuristic** — a multi-character chunk
  arriving in a single `data` event is treated as a pasted block, not
  discrete keystrokes, and gets inserted as literal text instead of
  processed key-by-key. `@microsoft/tui-test`'s own `submit()`/`type()`
  convenience methods hit this the same way the naive Python writer did;
  the real fix, confirmed live, is typing one character per
  `keyboard.press()` call (`typeAndEnter()` in the test file).
- **Even one key per `press()` call isn't always paced enough** — a
  `Down`/`Enter` pair fired the instant a list's text first appears can
  still occasionally race the real `ink-select-input` component attaching
  its own stdin listener, landing both keys in the same native-side read.
  A small, explicit delay after every single key press (the `press()`
  wrapper in the test file), confirmed live across repeated runs, is what
  actually makes the suite reliably green rather than intermittently
  flaky.

`make test-tui` reseeds the database, loads the real tutorial fixture via
the direct API path, starts a real backend, and runs this suite against
it — logging in as the real seeded admin user and driving the real
"Tutorial Wine Retail Business" through Login, Menu navigation, a real
staged General Journal entry (posted), the Balance Sheet, a full New
Business creation, and an Org Chart department creation, exactly the way
a person would.

## What this test implementation deliberately does not solve yet

- **Account entry on a Journal line is a free-text field**, not a live,
  filtered picker against the business's real Chart of Accounts the way
  the web app's own dropdown is. A real gap, not papered over — the next,
  real increment for this screen, once the picker pattern (type-ahead
  filtering a fetched list) is proven on one screen, is to reuse it for
  Customers/Providers/Items pickers too, not just Accounts.
- **No offline/retry handling** beyond the same plain error-surfacing
  `request()` already does on the web (`ApiError` with the backend's own
  message) — a dropped connection mid-session shows the error and lets the
  person retry the action, nothing more sophisticated yet.
- **POS, Purchase Orders, Quotations, and every other remaining screen**
  (including the Business Structure popup's Locations/Divisions and Item
  Category/Other Hierarchy steps) are out of scope for this pass, per the
  stated v1 scope above — the architecture (typed API port, Panel/
  MoneyText components, the Insert/Enter/Escape/Delete idiom) is meant to
  make adding each of them later a repetition of an established pattern,
  not a new design decision each time.
- **The New Business wizard's optional business-type Q&A
  (`saveBusinessTypeAnswers`) and the live CoA-prototype account preview**
  are both real, optional extras on the web screen that this v1 port
  skips — neither is required to create a working business, and both are
  the next, real increment for that screen if ever picked up.
- **The Org Chart screen assigns Department/Manager by typing an exact,
  existing name**, not a live, filtered picker — the same, stated
  simplification the General Journal's Account field already makes, for
  the same reason (one picker pattern, proven once, reused everywhere
  later rather than hand-built per screen now).
