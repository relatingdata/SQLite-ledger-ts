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
fourteen screens (the seventh — Business Structure — has three real
steps of its own), not a full port of every route the web frontend has:

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
7. **Business Structure** — `BusinessStructure.tsx`, a thin step-switcher
   over the real three steps the web popup's own `STEPS` array has
   (`BusinessStructurePopup.svelte`), ←/→ moving between them (every other
   arrow key is already claimed by ↑/↓ list movement). Escape on a step's
   own top-level view moves back one step, exactly like the web wizard's
   "Back"; on the first step it leaves the screen entirely, back to the
   menu.
   - **7a. Org Chart** (`OrgChart.tsx`) — the full real data behind the
     web step of the same name: Locations, Divisions, Departments, and
     Employees together (`GET /locations`, `POST`/`DELETE
     /locations/:name`, `GET /hierarchy`, `POST /hierarchy/groupings`,
     `POST`/`DELETE /hierarchy/values`, `POST`/`DELETE
     /hierarchy/parent`, `GET /departments/org-chart`,
     `POST /departments`, `DELETE /departments/:name`, `PUT`/`DELETE
     .../employees/:name/department` and `.../manager`). The web app
     draws all four together as a typed-box diagram with connector lines
     (`OrgChartNode.svelte`); a terminal can't usefully draw that, so
     this screen keeps the same real data and operations as a drill-down
     list instead — Divisions (plus an "Unassigned (no division)"
     bucket) and Departments (plus an "Unassigned (no department)"
     bucket) at the top, each Division bucket's Locations or each
     Department bucket's Employees underneath. A Location is a real,
     postable CoA account and deletes/moves (between Divisions)
     directly; a Division is a pure Hierarchy reporting tag with no
     account of its own, same distinction the web app's own code keeps;
     each Employee's own independent Department and Manager assignments
     sit one level further in, under the Department side.
   - **7b. Item Categories** (`ItemCategories.tsx`) — the real, optional,
     recursively-nestable Category Hierarchy (`GET /hierarchy`,
     `GET /hierarchy/assignments`, `POST /hierarchy/groupings`,
     `POST`/`DELETE /hierarchy/values`) the web renders as an indented
     tree (`StructureTreeNode.svelte`); the TUI version is a drill-down
     list instead — each level shows the categories directly under the
     current one, Enter walks one level deeper, Escape climbs back out.
     Moving a category to a different parent ("Move…" on the web) is not
     yet built here — create/browse/delete are real, re-parenting isn't.
   - **7c. Other Hierarchies** (`OtherHierarchies.tsx`) — any further
     Hierarchy grouping besides Division/Category, each a flat (never
     nested) list of values (`GET /hierarchy`, `POST
     /hierarchy/groupings`, `POST`/`DELETE /hierarchy/values`,
     `DELETE /hierarchy/groupings`). Most businesses never need this.
8. **Purchase** (`Purchase.tsx`) — the real AP Purchase flow
   (`frontend/src/routes/arap/ap-purchase/+page.svelte`): a purchase from
   a provider on credit, via the real, shared AR/AP invoice mechanism
   (`createInvoice` with `invoiceType: 'AP'`, then `postInvoiceById`). A
   line naming a real catalog item is received into stock alongside the
   invoice (`receiveStock`, only for lines that match a real item), the
   same conditional behavior the web screen has. Provider and Account are
   free-text fields, the same stated v1 simplification the General
   Journal's own Account field already makes; Location uses a real
   `SelectInput` picker, since it's a small, bounded, per-business list.
9. **Cash Purchase** (`CashPurchase.tsx`) — the real Cash Purchase flow
   (`frontend/src/lib/components/CashTransaction.svelte`, direction
   `'purchase'`): a purchase from the one real `'Cash'` provider, posted
   and paid off in full the same instant, via one atomic backend call
   (`completeCashPurchase` — invoice-post, stock-receive, and immediate
   full payment together). Location uses a real picker; Item is
   free-text, same simplification as Purchase above.
10. **Payment** (`Payment.tsx`) — the real AP Payment flow
    (`frontend/src/lib/components/PaymentReceipt.svelte`, direction
    `'payment'`): a payment to a provider, debiting their Accounts
    Payable balance and crediting Cash and Bank (`stageAPPayment`, then
    `postAPPayment`, the same two-step stage-then-post shape the General
    Journal already uses). Provider is free-text. Deliberately out of
    scope for this v1 screen: allocating the payment against specific
    outstanding invoices (the web screen's own optional "Allocate to
    outstanding invoices" table) — the payment itself is real and fully
    posted either way, just not tied to a particular invoice yet.
11. **Purchase Order** (`PurchaseOrder.tsx`) — the real Purchase Order
    flow (`frontend/src/routes/stock/po/+page.svelte`): commits to buying
    one item from a provider; memo-only when placed, with no real ledger
    effect until a Stock Receipt later fulfills it (`stagePurchaseOrder`,
    then `postPurchaseOrder`, again the same stage-then-post shape). The
    web screen is itself single-item (no line list), so this screen is a
    short linear wizard — reference, item, provider, quantity, price,
    delivery location, description, then a review step requiring an
    explicit `S` to place the order. Provider/Item are free-text; Location
    uses a real picker, with a `'Not yet known'` option first (the one
    difference from Purchase/Cash Purchase's own location pickers, which
    have no such option since every one of their lines receives stock
    immediately).

12. **AR Sale** (`ARSale.tsx`) — the real AR Sale flow
    (`frontend/src/routes/arap/ar-sale/+page.svelte`): a sale to a
    customer on credit, via the same shared invoice mechanism as
    Purchase (`createInvoice` with `invoiceType: 'AR'`, then
    `postInvoiceById`, fixed to `'Sales Revenue'`/`'Sales Tax Payable'`
    — unlike Purchase, the web screen itself has no separate Account
    field, so neither does this one). A line naming a real catalog item
    is dispatched from stock alongside the invoice (`dispatchStock`,
    the Sale-side counterpart of `receiveStock`). Customer is free-text,
    same stated v1 simplification as every other counterparty field in
    this TUI — and, confirmed live, the named customer must already be
    a real, existing contact; `createInvoice` resolves it by an exact
    name match and does not create one on the fly.
13. **Cash Sale** (`CashSale.tsx`) — the real Cash Sale flow
    (`frontend/src/lib/components/CashTransaction.svelte`, direction
    `'sale'`): a sale to the one real `'Cash'` customer, posted and paid
    off in full the same instant, via `completePosSale` — the same real
    endpoint the POS terminal itself uses (a Cash Sale is "the same
    real mechanism for a larger, non-register sale", per that
    component's own comment). Location uses a real picker, with no
    `'Not yet known'` option (every line dispatches immediately); Item
    is free-text.
14. **Customers** (`Customers.tsx`) — the real Customers screen
    (`frontend/src/routes/contacts/+page.svelte`, `focus=customers`):
    browse existing customer contacts and edit their email, payment
    terms, credit limit, and reminder level (`getContact`/`setContact`,
    plus a read-only credit-status line from `getCreditStatus`).
    Customer contacts aren't scoped to one business — confirmed live,
    they're direct children of the one, real, global entity literally
    named `"Customers"` — so this screen reads the unscoped entity tree
    (`getEntityTree()`, no business argument) rather than
    `getEntityTree(businessName)` the way every other screen in this
    TUI does, and filters out the generic link/tag child records
    (`setEntityLink`'s own `"<entity> — <linkType>"` convention) that
    also live under that same container. Customers aren't created from
    this screen (or anywhere else in this TUI yet) — matching the real
    state of the web app itself, where creating one also isn't wired to
    any screen despite its own intro text's claim.

15. **POS Terminal** (`POS.tsx`) — the real POS Terminal flow
    (`frontend/src/routes/pos/+page.svelte`): the everyday retail
    register — pick a real, Retail-type location, build a cart (typing
    an item name shows a live hint when it matches a real catalog item,
    along with that item's own retail price — blank price falls back to
    it), then either pay now (cash, with change due, or card) or sell on
    account to a real, named customer, same `completePosSale` endpoint
    Cash Sale itself calls (CashSale.tsx). Unlike the web screen's own
    checkbox, "on account" here isn't a separate toggle — typing any
    customer name other than `'Cash'` (or leaving the field blank, which
    means `'Cash'`) at the customer step means on account, skipping
    payment entirely, the same real distinction the web screen's own
    `onAccount` flag makes.

Everything else the web frontend has (AR Receipt, Quotations, RFQs,
Stock Receipt/Dispatch, and every other report) is explicitly out of
scope for this test implementation — the screens above are chosen
because together they already exercise every *kind* of screen this app
has (a simple form, a navigable tree, a stage/post transactional flow, a
read-only report, a multi-step wizard, a drill-down CRUD screen, a
procure-to-pay sequence, its order-to-cash mirror, and now the
real-time register both of those on-account flows feed into), so the
same pattern extends to any further screen later without a new
architectural decision.

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
      BusinessStructure.tsx # ←/→ step-switcher over the three real steps below
      OrgChart.tsx          # step 1: Locations/Divisions + Departments/Employees drill-down (the Business Structure popup's unified Org Chart step, as a list)
      ItemCategories.tsx    # step 2: recursively-nestable Category Hierarchy, as a drill-down list
      OtherHierarchies.tsx  # step 3: any further, flat Hierarchy grouping besides Division/Category
      Purchase.tsx          # AP Purchase — on-account, createInvoice + optional receiveStock + postInvoiceById
      CashPurchase.tsx      # Cash Purchase — one atomic completeCashPurchase call
      Payment.tsx           # AP Payment — stageAPPayment + postAPPayment
      PurchaseOrder.tsx     # Purchase Order — memo-only, stagePurchaseOrder + postPurchaseOrder
      ARSale.tsx            # AR Sale — on-account, createInvoice + optional dispatchStock + postInvoiceById
      CashSale.tsx          # Cash Sale — one atomic completePosSale call, to the one real 'Cash' customer
      Customers.tsx         # browse + edit real customer contacts (unscoped entity tree)
      POS.tsx               # POS Terminal — the retail register, completePosSale cash or on-account
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
Business creation, all three Business Structure steps — Org Chart
department/division/location creation (including moving the new Location
into the new Division), Item Categories (a top-level category, a nested
child under it, stepped into and back out of), and Other Hierarchies (a
new grouping and a new value under it) — all four Purchasing
screens — an AP Purchase (provider `'Cash'`, account `'Inventory'`, one
real-item line received into stock and posted on account), a Cash
Purchase (one line, paid off immediately), an AP Payment to `'Cash'`,
and a Purchase Order (placed, memo-only) — all three Sales
screens — an AR Sale (customer `'Riverside Restaurant'`, one real-item
line dispatched from stock and posted on account), a Cash Sale (one
line, paid off immediately), and Customers (opening the real, seeded
`'Cash'` customer and saving an edited email/terms/limit/reminder
level) — and the POS Terminal, both ways — a cash sale (one real line,
cash tendered, a real change-due amount) and an on-account sale to
`'Riverside Restaurant'` (no change due) — exactly the way a person
would.

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
- **POS, AR Receipt, Quotations, RFQs, Stock Receipt/Dispatch, and every
  other remaining screen** are out of scope for this pass, per the
  stated v1 scope above — the architecture (typed API port,
  Panel/MoneyText components, the Insert/Enter/Escape/Delete idiom) is
  meant to make adding each of them later a repetition of an established
  pattern, not a new design decision each time. Purchasing (Purchase,
  Cash Purchase, Purchase Order, Payment) and Sales (AR Sale, Cash Sale,
  Customers) are the first full-sized proof of that claim, each built
  after the screens before it rather than alongside them.
- **An AP Payment's own optional "allocate to a specific outstanding
  invoice" step isn't built** — the payment itself is still real and
  fully posted, just not tied to a particular invoice yet (see item 10
  above).
- **Purchase Order's own review step requires a real catalog item and
  provider typed by exact name**, no live picker — same free-text
  simplification as Purchase/Cash Purchase/Payment/AR Sale's
  Provider/Customer/Item fields, for the same stated reason.
- **AR Sale's own non-blocking over-credit-limit warning isn't built**
  — the web screen's own `getCreditStatus` check before a sale that
  would exceed a customer's credit limit; the sale itself still posts
  exactly the same whether or not this screen warns about it first.
  Customers.tsx does still show a customer's current balance and limit,
  once opened, via the same real `getCreditStatus` call.
- **Customers has no "create a new customer" step** — matching the real
  state of the web app's own Customers screen today (its own intro text
  claims new customers appear automatically "the first time one is used
  on an AR Sale," but confirmed live, `createInvoice` does not create
  one on the fly) — a real, existing gap in the web app itself, not a
  TUI-side simplification. A real customer exists today only via the
  Structured Editor or an API-side fixture step (`createCustomer`).
  Address/phone management and counterparty transaction history
  (`AddressList.svelte`/`PhoneList.svelte`/`ContactList.svelte`,
  `getCounterpartyHistory`) are real, optional extras on the web screen
  this v1 port skips, same stated reason as the rest of this TUI's own
  simplifications.
- **POS has no barcode/UPC scanning** (`lookupItemByUpc`) — a real
  scanner isn't something a terminal session can exercise; an item is
  found by typing its name instead. It also has no per-location,
  per-currency terminal selection (`getPosTerminals`/`createPosTerminal`,
  a real, optional multi-currency feature) and no pending-customer
  self-registration review (`listPendingCustomers`/`verifyCustomer`, a
  real, separate, customer-facing screen on the web app, not part of
  completing a sale). Every sale here posts in the business's own home
  currency, with no terminal chosen.
- **Item Categories has no "Move…" (re-parent an existing category)** —
  create/browse/delete are real; moving one to a different parent, the
  way the web's own `StructureTreeNode.svelte` allows, isn't built yet.
- **The New Business wizard's optional business-type Q&A
  (`saveBusinessTypeAnswers`) and the live CoA-prototype account preview**
  are both real, optional extras on the web screen that this v1 port
  skips — neither is required to create a working business, and both are
  the next, real increment for that screen if ever picked up.
- **The Org Chart screen assigns Department/Manager by typing an exact,
  existing name**, not a live, filtered picker — the same, stated
  simplification the General Journal's Account field already makes, for
  the same reason (one picker pattern, proven once, reused everywhere
  later rather than hand-built per screen now). Moving a Location between
  Divisions, by contrast, already uses a real `SelectInput` picker over
  the business's own, small, bounded Division list — the same difference
  in list size (every employee vs. a handful of divisions) the web app's
  own "Move…" controls reflect.
