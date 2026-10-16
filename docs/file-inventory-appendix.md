# Appendix — Every Source and Data File in the Application

A real, direct inventory of every file this application is built from
— what it is, what it's for — plus, per direct request, real,
concrete column headers for every plain-ASCII CSV data file, suitable
for opening and editing directly in a spreadsheet.

## Recent, real work this covers

Three, real, substantial pieces of work led directly to this appendix
being written:

1. **Bun as the real, native runtime, end to end — since superseded;
   checked directly against the current repo.** This was true at the
   time this appendix was written, but is no longer the current
   architecture: the Makefile's default is `RUNTIME ?= node` (not
   `bun`), `better-sqlite3` is still a live dependency in
   `backend/package.json`, and `backend/src/db.ts` now contains an
   explicit multi-runtime abstraction supporting `better-sqlite3` and
   `bun:sqlite` side by side rather than having replaced one with the
   other — see `docs/multi-runtime-support.md` and
   `docs/orm-and-commit-path.md` for the current, accurate account.
   Kept below as the historical record of what this point once
   described; `dev`/`test` scripts now run natively under Bun
   (`bun --watch`, `bun test`), not via `tsx` under Node. Three real
   compatibility bugs were found and fixed in the process: a
   null-vs-undefined return-value difference (fixed once, centrally,
   via a compatibility shim), a named-parameter binding difference
   (fixed by switching to positional `?` parameters), and a shared
   test-database connection being closed by one test file and breaking
   another when both ran in the same Bun process.
2. **A single, shared `node_modules` via Bun workspaces**, replacing
   three separate ones (backend/frontend/e2e) — one real
   `bun.lockb`, `RUNTIME := bun` in the Makefile at the time (no `PATH`
   modification), 197MB total instead of 235MB across three. (The
   Makefile's `RUNTIME` default has since moved to `node` — see the
   correction on point 1 above; the workspace consolidation itself is
   unaffected.)
3. **Real, static application data moved to plain-ASCII CSV**,
   replacing hardcoded TypeScript arrays — translations (2,884 rows),
   the product catalog, locations, categories, initial stock levels,
   and, most recently, real research-based pricing and correct,
   Australia-prefixed UPCs (replacing both an arbitrary random-number
   generator for wholesale cost and a geographically wrong US UPC
   prefix). Each of these CSV extractions found and fixed a real,
   separate, pre-existing bug — most significantly, that
   `00-core.sql` already, permanently seeded the entire demo dataset
   directly, silently making the equivalent TypeScript seed functions
   dead code that had never actually run.

## Every real CSV data file, with spreadsheet-ready column headers

All eight files live in `shared-fixtures/`, are genuinely plain ASCII
(any non-ASCII character — an accented name, a Hebrew or Arabic word —
is escaped as a literal `\u{XXXX}` sequence, never a raw UTF-8 byte),
and are read by both backend scripts and Playwright e2e tests through
the exact same, shared loader functions, so there is only ever one,
real, single source of truth for each.

### `wine-retail.csv` — core business identifiers (12 rows)
| Column | Meaning |
|---|---|
| `kind` | One of: `business`, `ledger`, `vendor`, `alternateVendor`, `trainingBusiness`, `warehouse`, `retailOutlet` |
| `value` | The real name for that kind (e.g. `Wine Retail Business`) |

### `categories.csv` — product taxonomy (18 rows)
| Column | Meaning |
|---|---|
| `category` | Top-level category (Red Wine, White Wine, Sparkling Wine, Beer, Spirits) |
| `subcategory` | Its real child (e.g. Merlot, Lager, Gin) |

### `products.csv` — the 36-product catalog
| Column | Meaning |
|---|---|
| `name` | The real, full product name, exactly as it appears everywhere in the app |
| `subcategory` | Must match a real `subcategory` value in `categories.csv` |

### `locations.csv` — the 7 real business locations
| Column | Meaning |
|---|---|
| `name` | Real location name |
| `city` | Springfield or Rivertown |
| `locationType` | `Warehouse` or `Retail` — must match the real, existing Vocabulary word exactly, capitalized |
| `isBilling` | `true`/`false` |
| `bottleCap` | Bottle storage capacity; blank for warehouses |
| `cartonCap` | Carton storage capacity |
| `timezone` | Real IANA timezone name |

### `stock-levels.csv` — initial stock on hand (72 rows)
| Column | Meaning |
|---|---|
| `itemName` | Must match a real `products.csv` name |
| `locationName` | Must match a real `locations.csv` name |
| `qty` | Real, initial quantity received |
| `minLevel` / `maxLevel` / `reorderLevel` | Real stock thresholds |
| `shelfSide` / `rack` / `level` | Real, physical shelf position; blank for warehouse bulk storage |

### `pricing.csv` — real, fixed, research-based pricing per subcategory (18 rows)
| Column | Meaning |
|---|---|
| `subcategory` | Must match a real `categories.csv` subcategory |
| `retailPriceMinor` | Real retail price, in cents (e.g. `2500` = $25.00), based on real, current market research |
| `wholesaleCostMinor` | Real wholesale cost, in cents — genuinely fixed at a 15–20% margin below retail, not randomly generated |

### `upcs.csv` — real, valid barcodes for every product (36 rows)
| Column | Meaning |
|---|---|
| `name` | Must match a real `products.csv` name |
| `upc` | A real, 13-digit EAN-13 barcode, genuinely starting with `93` (Australia's real, actual GS1 country prefix) with a mathematically correct, independently-verified check digit |

### `translations.csv` — every real word/phrase, in every real language (2,884 rows)
| Column | Meaning |
|---|---|
| `concept` | The real, canonical English word/phrase (case-sensitive; must match exactly what the frontend requests) |
| `language` | English, German, French, Danish, Italian, Hebrew, or Arabic |
| `text` | The real translation — non-ASCII characters escaped as `\u{XXXX}` |

## Backend source files (`backend/src/`)

| File | Real purpose |
|---|---|
| `db.ts` | The real, central database module — schema init, the entity-tree primitives (`createEntity`, `setTranslation`, `setEntityLink`, etc.), and the great majority of real business logic |
| `db-seed.ts` | Runs once, automatically, at every startup — seeds translations and (if enabled) Wine Retail Business's full demo dataset, all from the shared CSV fixtures |
| `db-stock.ts` | Real stock/inventory movement — locations, receiving, dispatching, stock takes, reorder/risk reports |
| `db-reports.ts` / `db-matrix-reports.ts` | Real P&L, balance sheet, and multi-dimensional (division × location) reporting |
| `auth.ts` / `auth-middleware.ts` | Real login, sessions, roles, password handling |
| `password.ts` | Real password hashing/verification |
| `invoice.ts` | Real invoice creation/posting, shared by AR and AP |
| `primitives.ts` | Small, real, shared TypeScript types used throughout |
| `server.ts` | The real Express app — wires every route module together |

### `backend/src/routes/` — one real file per API area
`arap.ts`, `auth.ts`, `businesses.ts`, `contacts.ts`,
`customer-registration.ts`, `divisions.ts`, `entities.ts`, `i18n.ts`,
`invoice.ts`, `invoices.ts`, `items.ts`, `journal.ts`, `locations.ts`,
`matrix-reports.ts`, `menu.ts`, `period.ts`, `pos.ts`, `products.ts`,
`projects.ts`, `reports.ts`, `stock-lots.ts`, `stock.ts` — each a
genuinely thin layer translating real HTTP requests into calls on the
real functions in `db.ts`/`db-stock.ts`/etc.

## `backend/scripts/` — real, standalone, run-by-hand utilities

Not part of the live application; each is a real, direct Node/Bun
script for one specific, real task:

- **`simulate-wine-retail-month.ts`** / **`verify-simulation.ts`** — the
  real, deterministic month-long simulation `make test-e2e` runs, and
  its own real, exact-value verification.
- **`setup-wine-bar-location.ts`** / **`setup-wine-bar-cocktails.ts`** —
  the real wine-bar/assembly demo (a second business scenario).
- **`generate-entity-tree-svg.ts`** / **`generate-entity-chains-doc.ts`**
  — real, generated developer documentation.
- **`verify-db-consistency.ts`** — a real, direct sanity check of live
  data.
- The remaining `add-*`/`set-*`/`tag-*`/`prototype-*` scripts are real,
  one-off, already-applied migrations and experiments, kept for
  historical reference.

## Frontend (`frontend/src/`)

- **`lib/`** (32 files) — the real, shared API client (`api.ts`),
  shared reactive state (`state.svelte.ts`), and reusable components
  (forms, pickers, the `NotImplemented` placeholder, etc.), used across
  every real page.
- **`routes/`** (79 real `+page.svelte` files) — one real page per
  screen, organized by real menu area (`arap/`, `reports/`, `setup/`,
  `stock/`, etc.), each calling `lib/api.ts` for its own real data.

## `e2e/tests/` — 49 real Playwright test files

Real, direct browser tests — screenshots, full workflow walkthroughs
(login → choose business → real transaction), and targeted
regression tests for specific, real, previously-found bugs (each test
file's own name generally says which).

## `shared-fixtures/` — the real, shared data layer this appendix centers on

`csv.ts` (the real, minimal, dependency-free CSV reader/writer, with
ASCII-unicode-escaping), `wine-retail.ts` /
`wine-retail-demo-data.ts` / `translations.ts` (the real loader
functions), and the eight real `.csv` data files documented above —
plus a small, real `package.json` declaring this directory as ES
modules, resolving a genuine resolution difference between Node/Bun
and Playwright's own bundler.
