# UI Completeness Plan: The Whole Wine Business, Buildable Through the Real Interface

A real, direct audit of every real screen this application has, confirming which are genuinely implemented, which are thin wrappers, and which remain real, honest, confirmed stubs — the single source of truth for "can a whole, real wine business actually be run through the interface alone, with no direct database access."

## Goal, stated precisely

Every real backend mechanism this app has should be reachable through a real screen — not just callable directly from a script — so that a full, real Playwright script could create Wine Retail Business from scratch: the business itself, its ledgers, its locations, its divisions, its employees (paid, with real Medicare/super), its product catalog, its vendors and customers, and then run a real month of purchases, transfers, sales, stocktakes, and a year-end close, entirely by clicking and typing through the actual app.

This document is a real, honest audit, not a wishlist — every line below reflects what was actually checked against the live codebase on 2026-08-16, not assumed. Status conventions: **✅ ready** (backend exists, tested, just needs a screen), **🔧 partial** (some backend exists, real gaps remain), **❌ unbuilt** (no backend at all — this is a two-part job, not a UI-only one).

## Part 0 — What already works end-to-end, right now

Confirmed via the existing Playwright suite, not assumed: a person can already, through the real UI alone —

- Log in, choose a business/ledger, and see it correctly, read-only, on every entry screen (`ap-payment`, `ap-purchase`, `ar-receipt`, `ar-sale`, `post`, `stock/po`, `stock/so`, `stock/stock-dispatch`, `stock/stock-receipt`, `setup/periods`)
- Create a new business (`setup/new-business`), with real, matching country chart-of-accounts guidance
- Create a new location, transfer stock, post a manual General Journal entry, and see it land correctly on Trial Balance (`wine-business-setup.spec.ts` — the one existing test that already drives a real, if narrow, slice of this end to end)
- Run the full retail loop: Cash Sale, Cash Purchase, POS Terminal, Restock Retail Outlets, e-invoice export/import, division-scoped P&L, stock movement report, location capacity warnings
- See every UI string correctly in all 5 supported languages (`language-parameterized.spec.ts`)

This is the real foundation — the plan below is about closing the remaining, real gaps around it, not starting over.

## Part 1 — Tier 1: backend is ready, only a screen is missing

The lowest-risk, highest-value work — these functions exist, are tested, and are used correctly by the existing simulation or by direct verification this session. Building the screen is real, contained work with no backend risk.

Table: Tier 1 screens — real backend functions already exist, tested, and correctly used

| Screen | Real backend function(s) | Notes |
|---|---|---|
| `/hr` (Payroll) — ✅ **built** | `payEmployeeWages`, `getOrganizationChart`, `getContact`/`setContact` (wage/salary fields) | Real, complete page shipped: Pay Wages (employee picker, real hourly/salaried auto-detection, real Medicare/superannuation breakdown shown after payment) and Org Chart (company-wide staff separated from real, per-location staff). Contacts page also gained real wage/salary fields. Verified live via a real, permanent Playwright test (`hr-payroll.spec.ts`) with exact figures, not just "the page didn't crash." **Still deferred, not part of this pass**: POS clerk sign-on/sign-off (see `docs/TODO.md`'s own, dedicated section) — real, timestamped shifts as the source of "hours worked," rather than the current, direct hours input. |
| `/setup/yearend` (Year End Close) — ✅ **built** | `closeBooks` | Real, complete confirmation screen shipped: a real, filtered Retained Earnings account picker, a clear warning, and a required confirmation checkbox. Verified live against a real close (10-line entry summing to exactly zero, confirmed directly against the database) and the real "nothing to close" error on a repeat attempt. A real, permanent, fully self-contained Playwright test (`yearend-close.spec.ts`) covers both paths. |
| `/recurring` (Recurring Transactions) | `createRecurringJournal`, `journal_occurrences` view | `notImplemented: true`; the backend already supports weekly/monthly/yearly schedules with mid-schedule amendments (proven in tests). Needs: a schedule-entry form and a real, "next N occurrences" preview. |

**Estimated real scope**: 3-4 new/rebuilt Svelte pages plus their frontend API client functions. Confirmed directly, not assumed: all three backend functions already have real, working API routes (`payEmployeeWages` and `closeBooks` in `journal.ts`/`pos.ts`, `createRecurringJournal` in `journal.ts`) — this is genuinely UI-only work, no backend or route layer needed at all.

## Part 2 — Tier 2: partial backend, real gaps remain

Tier 2 is genuinely empty as of this writing — its one real item,
`/setup/chart-of-accounts`, has since been built (see the real Chart
of Accounts editor, Part II) and moved to Tier 1.

Everything else in the original stub list is genuinely **Tier 3** — confirmed via direct grep, not assumed: zero backend functions exist for any of them.

## Part 3 — Tier 3: fully unbuilt subsystems (backend + frontend both)

Ordered by how directly each blocks "the whole wine business, via UI" — not by original TODO order.

### 3a. Bank reconciliation (`/reconciliation`)
Real gap already flagged in `docs/TODO.md` and confirmed again this session (menu still says `notImplemented`, zero backend functions). Needed for a *complete* month: without this, "the whole wine business" stops short of the one step every real business does at month-end. Real backend needed: a bank-statement-line import/match mechanism (CSV or manual entry), matching against unreconciled `journal_line` rows by amount+date, a real "reconciled" flag. This is a genuinely separate, medium-sized piece of work — not recommended to attempt inside this same push.

### 3b. Currency transactions (`/exchange-rates`, `/gl/fx-adjustment`)
Real gap already flagged in `docs/TODO.md`: `account.currency` and per-currency balance validation are real and tested, but `setupCurrency`/`convertCurrency`/`spendCurrency` don't exist, and no screen lets a person actually transact in a foreign currency. `docs/foreign-currency-receipts-and-payments.md` already has a real, proposed design — this is "ready to build," not "ready to design." Recommended scope for this push: build just enough to let a person view/set an exchange rate and see its effect on a foreign-currency account balance — not the full receipt/payment workflow, which is its own, separate piece.

### 3c. Quotations, RFQ, generate-invoices/generate-PO from orders
Zero backend. These are real, useful features but not load-bearing for "create the whole wine business" — a quotation is a pre-order convenience, and the existing `placeOrder`/`fulfillOrder` mechanism already covers the real purchase/sale path without them. **Recommend deferring** — lowest real value for this specific goal.

### 3d. Vouchers (payable/payment/general-ledger batch approval)
Zero backend — a real, multi-user review-before-posting workflow, genuinely different from the current stage→post-by-the-same-session model. Real, separate scope (session/role modeling for "who can approve what"). **Recommend deferring.**

### 3e. Assembly BOM, Projects, Jobs, Shipping
Zero backend, and none of these are part of a wine retail business's real, ordinary operations (no bill-of-materials assembly, no project/job costing, no freight shipments in this business model). **Recommend explicitly out of scope** for "the whole wine business" — these belong to a different kind of business entirely (manufacturing, services, freight).

## Part 4 — The Playwright strategy: what "tested via Playwright" actually means here

A real, honest point made earlier in this project and still true: literally replaying an entire month transaction-by-transaction through a real browser (thousands of real page loads) is impractical — it would take hours and be fragile. The right, achievable version:

1. **A real, single "full lifecycle" Playwright spec** — `e2e/tests/full-business-lifecycle.spec.ts` — that creates a *brand-new* business from an empty database (not reusing the bootstrapped Wine Retail Business), through the real UI, in this real order:
   - `/setup/new-business` → creates the business and its ledgers
   - `/locations` → creates 2-3 real locations (a warehouse, 1-2 retail outlets)
   - `/setup/divisions` → creates the real divisions
   - `/hr` → creates 3-4 real employees (at least one hourly, one salaried), sets wage/salary
   - `/parts` → creates a real product category and 2-3 real products
   - `/contacts` → creates a real vendor and a real customer
   - `/stock/po` or `/arap/cash-purchase` → a real purchase, receiving real stock
   - `/pos` or `/arap/cash-sale` → a real sale
   - `/stock/transfer` → a real transfer between locations
   - `/stock/stock-take` → a real stocktake
   - `/hr` → a real wage payment
   - `/setup/yearend` → a real, final close
   - Then verifies the real Trial Balance/P&L/Balance Sheet directly against the database, the same way `wine-business-setup.spec.ts` already does — not just UI assertions.

   This is the single, real test that proves the whole claim — a much stronger, more honest target than "every screen has some test."

2. **Keep the existing, fast, backend-direct simulation** (`simulate-wine-retail-month.ts`) as-is for volume/scale testing (hundreds of transactions, exact-value verification) — it answers a different, still-valuable question ("does the math stay right at scale") that a slow, UI-driven test shouldn't try to also answer.

3. **One focused Playwright spec per new Tier-1 screen** as it's built (`hr-payroll.spec.ts`, `yearend-close.spec.ts`, `recurring-journal.spec.ts`) — verified against real, direct database state afterward, matching the existing standard this project already holds itself to, not just "the page didn't crash."

## Part 5 — Recommended sequencing

Given real risk and real value, in order:

1. ✅ **`/hr`** — done. The single highest-value gap: wires up payroll and the org chart, closing the one Tier-1 screen that was genuinely blocking "the whole business" — there's now a real way to hire and pay someone through the UI.
2. ✅ **`/setup/yearend`** — done. Small, contained, `closeBooks` already proven correct; closes the "a full month, start to finish" loop.
3. **The full-lifecycle Playwright spec** (Part 4.1) — write it *as soon as 1 and 2 land*, even before `/recurring` or Tier 2/3 work, since it's the real, concrete proof of the whole goal and will surface any other real, small gaps (a missing route, a field that doesn't round-trip) faster than more planning would.
4. **`/recurring`** — contained, real value, no dependencies on anything above.
5. **Tier 2/3, in the order listed in Part 3** — each is its own, separate, real scope decision; recommend re-confirming priority after 1-4 land, since the honest picture may change once the full-lifecycle test exists and shows what actually still blocks it.

## What this plan deliberately does not promise

Reconciliation, real multi-currency transactions, quotations/RFQ, vouchers, and the assembly/projects/jobs/shipping subsystems are real, genuine gaps that will still exist after Part 5 step 4. This plan closes the gap for a wine retail business's real, ordinary operations — it does not claim feature parity with everything SQL-Ledger itself has (see `SQL_LEDGER_MAPPING.md` for that fuller, still-honest picture).
