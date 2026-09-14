# Border Business: Two POS Terminals, Two Currencies, One Location

Per direct request: a real business operating on a border, one
location with two real POS terminals — one transacting in CAD, one in
USD — and real sale/cost prices expressed in both currencies.
Documented and planned here, extending the existing, real
`docs/multicurrency-design.md` (status: design complete, not yet
implemented), before any execution — per direct instruction, once the
manual review round was done, and per `design-driven-development`.

## 1. Confirm reality first

- `docs/multicurrency-design.md` already, directly supports a
  **Division** having its own real `currency` column (a 1:1
  extension, the same real pattern as `contact`/`account`) — the
  closest existing concept to "this terminal transacts in this
  currency."
- Confirmed directly, earlier this session: **no real "POS Terminal"
  entity exists at all** — the `/pos` screen is a generic screen
  usable by anyone permitted to sell from a given location, not a
  named, individually-registered piece of hardware or till.
- `completePosSale` takes a real `locationName`, not a terminal
  identifier — currency, today, could only be resolved at the
  Division/Business/Account/Contact level the existing design
  describes, none of which is "which physical till this sale happened
  at."
- Multi-currency itself remains, honestly, entirely unbuilt — the
  prototype (`backend/scripts/prototype-multicurrency.ts`) proves the
  real, intended mechanism against numbers, but no schema/migration
  work exists yet.

## 2. The real, honest scope, stated plainly

This request needs **two, real, separate pieces of new work**, not
one:

1. **The base multicurrency mechanism itself** (`docs/multicurrency-design.md`)
   — genuinely has to exist first; a terminal "transacting in USD" is
   meaningless without the underlying currency-as-commodity machinery
   already working.
2. **A new, real concept this document adds**: a POS terminal as its
   own, real, currency-scoped entity — extending "currency lives on a
   Division" to cover "currency lives on a terminal, at a specific
   location," since two terminals at the *same* location need two
   *different* currencies simultaneously, which Division alone (one
   real currency per division) cannot express if both terminals sit
   under the same, real division.

## 3. Real design decisions, per `no-new-tables`

- **A real POS Terminal entity** (`createPosTerminal`), parented under
  its real location
  (`{location} Terminals` → `{terminal name}`), the same real,
  established pattern as every other structural grouping in this
  codebase (Locations, Employees, Items) — not a new, bespoke table.
- **Currency on the terminal**, via `setTerminalCurrency` — reusing
  the exact same `account.currency` column and `setAccountCurrency`
  function the base multicurrency design already built for real
  accounts, not a new mechanism invented for terminals specifically.
- **Currency precedence, extended**: `getEffectiveSaleCurrency`
  resolves a terminal's own currency first (new, most specific),
  falling through to the existing Division → Business → Account →
  Contact chain when no terminal is given or the terminal has none set
  — a real, direct, minimal extension of the existing precedence list,
  not a redesign of it. **Built and directly tested** (Slice 2,
  complete): `createPosTerminal`/`setTerminalCurrency`/
  `getEffectiveSaleCurrency` all exist and are proven correct via a
  real, direct backend test - two real terminals at the exact same,
  real, shared location, each correctly resolving its own, different
  currency.
- **`completePosSale` gains a real, optional `terminalName`
  parameter**, resolving the sale's effective currency from it when
  present — every existing caller that doesn't pass one keeps today's
  exact behavior, a genuinely non-breaking change.

## 4. Dual-currency pricing — a real, separate, additional requirement

Sale and cost prices "in two currencies" is **not** the same fact as
"which currency did this specific sale happen in" — a product needs
two, real, independently-set prices (one CAD, one USD), not a single
price converted live by an exchange rate at sale time (a real,
different, riskier design — exchange-rate-converted pricing drifts
with the market; a business operating on a border typically posts
real, fixed, round-number prices in each currency instead, e.g. "$10
USD or $13 CAD," not "$10 USD, times whatever today's rate is").

Real, minimal design: `item_source` (already the real home of
per-vendor pricing) gains a real, optional `currency` column — a
product can have **two real `item_source` rows for the same vendor**,
one tagged CAD, one USD, each with its own real, independently-set
price. `getItemPriceForCurrency` resolves which one applies, falling
back to the business's own home-currency row when no row exists for
the specific currency asked for. **Built and directly tested** (Slice
3, complete) — including a real, direct bug found and fixed along the
way: SQLite's `UNIQUE` constraint treats `NULL` as distinct from
`NULL`, so the ordinary, single-currency case (no currency specified)
needed a real, empty-string convention instead of `NULL`, or two
calls with no currency would silently create a duplicate row instead
of updating the first — caught immediately when it broke a real,
pre-existing test, not assumed away.

## 5. Real, concrete example, for the eventual test

One real location on the border. Two real terminals: "Front Till
(USD)" and "Front Till (CAD)". One real product, "Bottled Water",
with two real `item_source` rows: $1.50 USD, $2.00 CAD. A sale at the
USD terminal posts in USD, at $1.50; the same product, same location,
sold seconds later at the CAD terminal, posts in CAD, at $2.00 — two,
real, independent, correctly-currencied transactions, at one, real,
shared physical place.

## 6. Sequencing, stated honestly

This is large. Building it in one pass, untested until the end, would
violate `backend-first-testing`/`test-driven-development` directly.
Real, minimal, sequential slices:

1. Build the base multicurrency mechanism first (schema, `account`
   currency, the grouped-balance validator) — proven, first, against
   the existing prototype script, with real, direct backend tests,
   before any terminal-specific work begins.
2. Add the real POS Terminal entity and its own currency extension,
   with a real, direct backend test proving precedence (terminal wins
   over division wins over business).
3. Add dual-currency `item_source` pricing, with a real, direct test
   proving the correct price is selected for each terminal.
4. Only then, the real, minimal e2e scenario from §5 - two terminals,
   one product, two currencies, one location - as the DDD-style test
   requested, built last, proving the whole, real, assembled slice
   end to end.

Not started in this same response — this is the real, honest plan,
per direct instruction, execution to follow.
