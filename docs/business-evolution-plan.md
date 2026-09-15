# Plan: Wine Retail Business's legal evolution — sole trader → partnership → incorporated company

*Not yet built. A real plan, written to be picked up directly by a
local Claude Code session — grounded in real accounting consequences
at each stage, mapped against this app's own, existing architecture
and its real, currently-known gaps (see `docs/TODO.md`). The explicit
goal, in the requester's own words: this arc "should eventually
exercise all aspects of the application" — so each stage is chosen
specifically because it forces a different, real part of the app into
use, not for narrative color alone.*

## Why this is a genuinely different undertaking from the existing simulation

`docs/simulation-prompt.md` and `simulate-wine-retail-month.ts`
describe *one month* of steady-state trading for an already-existing,
already-incorporated company. This plan describes the *years before
that* — the real, structural journey from a single person with a cash
box to the multi-location company the existing simulation already
assumes. It's a prequel, not a replacement, and the two should
eventually connect: the incorporated company this arc ends with should
be recognizably the same Wine Retail Business `docs/user-manual.md`
already tells the origin story of (Lars and Mette, one shop in
Springfield).

## Stage 1 — Sole trader

**The real accounting difference**: no legal separation between the
owner and the business at all. There is no "Owner's Equity" account in
the sense this app already uses it for a real company — draws aren't
wages (no payroll, no PAYG/PAYE withholding), and profit is simply
whatever's left; the sole trader personally, not the business, is
taxed on it.

**What this exercises that today's simulation doesn't**:
- A genuinely tiny Chart of Accounts — this is the moment to prove the
  CoA-family mechanism (see `docs/glossary.md`'s "CoA family" entry)
  scales *down* as well as up: a sole trader needs perhaps 15 real
  accounts, not the 150+ Wine Retail Business already has.
- Real "Drawings" as its own, distinct equity-contra account, not
  conflated with a wage expense — a real, common bookkeeping mistake
  worth the app actively distinguishing correctly.
- The very first real purchase, sale, and bank reconciliation for a
  business with *no history at all* — a genuine test of the guided
  new-business setup flow's cold-start experience.

## Stage 2 — Partnership

**The real trigger**: Mette's spouse (or a second, real, named
partner) buys into the business — a real capital injection, and a real
change in how profit gets divided going forward, not backdated.

**The real accounting difference**: each partner needs their own real
**Capital account** (their own permanent stake) and their own real
**Current account** (drawings and their own share of profit,
settled/reconciled periodically) — two real accounts per partner, not
one. Profit-sharing is a real, agreed ratio (not necessarily 50/50 —
a genuine opportunity to make it uneven and defensible, e.g. weighted
by original capital contributed).

**What this exercises**:
- A real, second **division**-like concept, but for *people* rather
  than locations — this app's existing division mechanism (see
  `docs/glossary.md`) is general enough to represent this directly:
  a "Partners" grouping with each partner as a real, nested profit
  center, reusing the exact hierarchical division filter already built
  for per-location P&L rather than inventing a parallel mechanism.
- Year End Close's own, already-tested "roll each division's own net
  income into its own real Retained Earnings line" behavior — but
  applied to partner capital accounts instead of geographic ones,
  a genuine, different real use of the same, already-correct code.
- The moment the business needs its **first real employee** who isn't
  an owner — a real payroll gap this app doesn't have yet (see
  `docs/TODO.md`), and a natural, motivated reason to build it now
  rather than in the abstract.

## Stage 3 — Incorporation

**The real trigger**: the second shop (Riverside Cellars, per
`docs/user-manual.md`'s own origin story) and the real, growing
liability exposure of two physical locations makes limited liability
worth the real, added compliance cost — a real, defensible business
reason, not just "because the story needs it."

**The real accounting difference**: partner Capital/Current accounts
are formally converted into **Share Capital** (a real, one-time
transaction — the partnership's own real net assets become the
company's opening balance sheet) plus, going forward, real
**Retained Earnings** — this app's Chart of Accounts already has both
concepts, but they've never actually been *reached* by walking a real
business through the transition that creates them for the first time.
Owners' pay changes character too: a director's **salary** is now a
real payroll expense (distinct from a dividend/drawing), taxed and
reported differently — the same real distinction Stage 1's "Drawings
vs. wages" gap already flagged, now mattering for real, different
reasons.

**What this exercises**:
- The real **Structured Editor**'s reparenting capability, used for
  something it's never actually been exercised for yet: converting a
  live, populated set of partner-capital entities into a genuinely
  different real structure (Share Capital + Retained Earnings) without
  losing any of their real, historical balance — a real test of
  whether "any entity can be renamed/reparented without breaking
  anything" (a core, stated design principle of this app) actually
  holds under a real, structural rewrite, not just a rename.
- **Fixed asset accounting** — incorporation is naturally the moment a
  real business starts owning things outright (the warehouse's
  refrigeration equipment, a delivery vehicle, POS hardware) rather
  than treating everything as an immediate expense. This app doesn't
  have fixed-asset/depreciation tracking yet (a real, known,
  unaddressed gap) — this is a natural, motivated place to build it,
  not an arbitrary one.
- The full, real Year End Close and Balance Sheet correctness this
  session's own work already hardened (the real double-counting bug
  found and fixed a few rounds ago) — now under genuinely harder,
  real conditions: a mid-year legal-structure change, not just a
  routine period close.

## What this arc deliberately doesn't try to cover in one pass

Being honest about scope: multi-currency (DKK/EUR, already
partially real per `docs/foreign-currency-receipts-and-payments.md`)
and the stock-movement/vendor/category reporting already built this
session both belong naturally *inside* this arc once the company
exists — but they're already real, working, separately-delivered
pieces, not things this particular plan needs to re-invent. This plan
is specifically about the parts of "exercising all aspects of the
application" that current tooling *doesn't* yet cover: the legal-
structure transitions themselves, partner/director equity mechanics,
payroll, and fixed assets.

## Suggested order of real, concrete work

1. A new, real, standalone simulation script (parallel to
   `simulate-wine-retail-month.ts`, not a modification of it) covering
   Stage 1 only — deliberately small, provably correct on its own
   before Stage 2 builds on it.
2. Real payroll — `setPartLocationLevels`-style, i.e. a real, tested,
   reusable function (`payEmployee`/`runPayroll` or similar), not a
   one-off script hack — needed by Stage 2 onward.
3. Real fixed-asset accounting — acquisition, straight-line
   depreciation at minimum (the standard LedgerSMB's own book
   discusses in its Chapter 3 FIFO/LIFO section is a reasonable,
   comparable reference point for the *inventory* side; fixed assets
   are a genuinely separate concept worth its own real design pass).
4. The Stage 2 → Stage 3 conversion itself, as a real, tested,
   reusable function — not a one-off script — since a real business
   might need to do this more than once (a sole trader converting
   straight to a company, skipping the partnership stage entirely, is
   at least as common in practice as the full three-stage path).
