# TODO / Future Work

Consolidated from design discussions, comparisons against the real
SQL-Ledger/LedgerSMB, and things raised in passing throughout this
project's history. Not a commitment or a sequence — a real, honest
record of what's known to be open, so it doesn't live only in chat
history.

## Accounting fundamentals still missing (from the original SQL-Ledger comparison)

- **Bank reconciliation** — matching posted transactions against a real bank statement.
- **Fixed assets & depreciation** — an asset register, depreciation schedules, disposal.
- **Multi-jurisdiction tax treatment** — a business paying tax in more than one country, treaty relief. Explicitly separated from currency mechanics.
- **Vouchers / batch approval workflow** — multi-user review before posting, not just draft/posted status.
- **CSV import** for AR/AP batches.
- **Timecards / rostering** — no real mechanism to record hours worked per shift; `payEmployeeWages` (see below) takes hours as a direct input, not derived from a real timesheet.
- **Quotations / RFQ.**
- **Assemblies / BOM** (bill of materials).
- **Tax forms** (1099-style reporting).
- **Price lists** as their own concept (distinct from the packaging-tier pricing below).

## Multi-currency — partially real, meaningfully incomplete

- ✅ Real: `account.currency`, the per-currency-balance validator in `postJournalEntry` itself, tested against the actual production trigger.
- ✅ Real: `formatAmount`/`formatDate` respect each currency's actual ISO 4217 precision (JPY/KRW/etc. have no minor unit at all; BHD/KWD/etc. use three decimal places, not two) — verified against real, searched ISO 4217 data, not assumed. The mechanism generalizes beyond currency to any unit code with its own real precision (proven directly, not just designed, with a non-currency `BOTTLE` example in the same test suite). Purely additive — every existing call site is completely unaffected, since the unit code is optional and defaults to the prior, correct 2-decimal behavior.
- ✅ Designed and prototyped (not built): currency-as-inventory (`Cash at Bank (ccy)` as the Inventory leaf, FX Conversion Clearing, currency-specific Delivery Fees, FX Gain/Loss on lot consumption).
- ❌ Not built: `setupCurrency`/`convertCurrency`/`spendCurrency` as real, callable functions; any route; any UI at all. A user cannot actually transact in a foreign currency today, only post correctly-validated raw journal lines by hand. See `docs/foreign-currency-receipts-and-payments.md` for a real, proposed design of the receipt/payment workflow specifically (exchange rate storage, Foreign Exchange Gain/Loss accounts, the actual posting sequence) — a design, not yet built.
- ❌ **No screen anywhere actually passes a currency code into `formatAmount` yet** — the precision mechanism is real and tested, but every current call site displays home-currency amounts, which were already correct under the old 2-decimal-only behavior. This becomes visibly necessary once `setupCurrency`/`convertCurrency` above are real and a screen actually needs to show a JPY or BHD amount.
- ❌ **`parseMinorUnits` (money.ts) still hardcodes `* 100`** — correct for 2-decimal currencies, wrong for JPY/KRW (should be `* 1`) or BHD/KWD (should be `* 1000`). `decimalPlacesFor(unitCode)` in `format.ts` already has the real, correct per-currency scale; the parse side doesn't yet take a unit code and apply it symmetrically with the format side. See docs/money-model.md.

## Packaging tiers, pricing, and margin (designed this session, not built)

- ✅ **Buying by the carton is real**, via `part_source.package_quantity` (already designed for this, just never actually used until now) — the wine retail simulation genuinely purchases in carton units (wine/spirits: 12/carton, beer: 24/carton) and converts to the real base-unit (bottle) quantity on receipt.
- ✅ **Selling by the six-pack/carton is real for beer** in the simulation (single bottle / six-pack at a discount / full carton), via direct `completePosSale` calls with the right quantity and unit price — genuine, tested behavior, not a placeholder.
- ✅ **Cold storage is real** — a `{Outlet} — Refrigerated` location at every retail outlet (same `location` mechanism as everything else), with sparkling wine and Golden Lager specifically routed there on receipt and transfer.
- ❌ **Still not built**: the more general `relation_id`-tagged "packaging tier as its own entity" design (a Six-Pack "class" reused across every product, each product's own tier as an "instance" child) — what's real today is simulation-level logic using the existing `part_source`/`completePosSale` mechanisms directly, not a persisted, reusable tier concept with its own price history. This still matters for a real UI (letting staff choose "sell as: bottle / six-pack / carton" on a POS screen) and for the price-lot mechanism below, neither of which exist yet.
- **Price-lot mechanism** — mirroring `stock_lot`'s shape (effective-dated values, not posted transactions) for a tier's own selling price history, the same way `stock_lot` already tracks cost history.
- **Target-margin / target-costing report** — set an overall gross margin target, solve for the per-category margin needed given budgeted volume mix (Wine vs. Beer vs. Spirits), and model price-increase scenarios via the existing Budget-is-just-another-ledger mechanism.
- **"Investment grade" classification** — a `relation_id` tag excluding rare/collectible wine and spirits from ordinary margin calculations, since they're held for appreciation, not turnover.

## Payroll — real now, genuinely partial

- ✅ **A real employee is a real AP counterparty** — `wage_minor_per_hour`/`salary_minor_per_year` on `contact`, `payEmployeeWages`, treating pay the same real way a vendor invoice already works (debit an expense, credit the counterparty's own balance).
- ✅ **Real Medicare levy (1.5%) withheld from the employee's own pay**, and **real superannuation (12%) as a genuine, additional employer cost** — a real, three-line posting (gross expense, employee's net balance, two separate real liabilities), not a simple two-sided one. Australian rates specifically, flat percentages.
- ✅ **A real, complete 18-person roster** for Wine Retail Company — two staff per retail outlet, warehouse staff, office staff, and two salaried managers.
- ❌ **No timecards/rostering** — hours are a direct input to `payEmployeeWages`, not derived from any real, recorded shift.
- ❌ **No PAYG income tax withholding** — only the Medicare levy, deliberately, per the original direct request ("not including tax at the moment").
- ❌ **No leave accrual** (annual/sick leave balances) at all.
- ❌ **The wage/salary mechanism isn't wired into the wine-retail simulation** — `payEmployeeWages` exists and is tested directly, but the monthly simulation script doesn't call it, so a full simulation run doesn't currently include any real wage expense.
- ❌ **No UI at all** — no field on the Contacts page to actually set an employee's wage/salary rate, and no "Pay Wages" screen for a person to use this through the real app rather than a direct function call.

## A unified business/division/location setup screen, real HR expansion, and using AI for profitability/compliance — a real, direct brainstorm, captured before any of it is built

Per direct request, a real, wide-ranging set of ideas raised together in one conversation — captured here honestly, organized into real, distinct pieces, not built yet. Several of these are genuinely large, separate features in their own right, not one project.

**1. A real, unified business/division/location setup screen, with addresses and phone numbers.** Today, creating a new business touches three, real, separate, disconnected screens in sequence — `/setup/new-business`, `/setup/divisions`, `/locations` — each with its own real form, none of them aware of the others. A real, guided, single flow (business → its divisions → each division's own locations, with a real address/phone for each location using the same, already-proven AddressList/PhoneList mechanism) would remove a genuine amount of manual back-and-forth. Directly connects to the separate, not-yet-investigated request below (real CoA accounts auto-created per location/profit center) — the natural place to trigger that is exactly this same, unified flow.

**2. Employees folded into the same setup flow, with their own real addresses and phone numbers.** Today an employee is created via the Structured Editor, then given contact details on a separate Contacts page — a real, two-screen detour discovered directly while building the full-lifecycle test earlier this session. The same unified flow could let a person add real staff to a location right as they set it up.

**3. Daily/weekly schedules — a real, separate concept from the POS sign-on/sign-off shifts already designed.** A schedule is the real, *expected* roster (who is meant to work Tuesday's evening shift); a `pos_shift` row (already built this session) is the real, *actual* record of when someone genuinely signed on and off. Not yet designed how these two connect — whether a schedule is just a real, informational calendar, or whether it's checked against actual sign-ons for a real, live "who's late/missing" view.

**4. Paid annual leave — a real, genuine gap, already flagged once in the Payroll section above, raised again directly here.** No leave accrual exists at all currently. A real, minimal version: an accrual rate per employee (e.g. a real number of hours accrued per hours/period worked), a real, running balance, and `payEmployeeWages` gaining a real way to pay out leave taken against that balance, distinct from ordinary wages.

**5. Casual employees, specifically framed around covering sick leave.** A real, third employment type alongside hourly and salaried (`wage_minor_per_hour`/`salary_minor_per_year` today) — a casual works genuinely irregular hours with no ongoing roster commitment, often engaged specifically to cover a real, rostered permanent employee's own real, unplanned absence. Would need its own real pay-rate handling (a casual loading — a real, higher hourly rate in lieu of leave entitlements, is standard practice in several real jurisdictions) and a real, direct link to *why* a specific shift was covered (which real, permanent employee's real absence this covered), for genuine rostering/cost visibility.

**6. Broader HR functions, including mandatory training expense.** A real, direct request for training-record tracking with a real, associated cost — likely a real, new entity type ("training record": employee, course/topic, date completed, real cost, real expiry if the training needs periodic renewal — e.g. a food-handling certificate) with the real cost posting through the same, already-proven AP-style mechanism payroll itself uses. Real, additional HR ideas worth naming, all genuinely separate scopes, none designed in any real detail yet:
   - Real emergency contact details per employee.
   - Real superannuation fund details per employee (super itself is already modeled and withheld — which real, actual fund it's paid into per employee is not tracked at all).
   - Real employment documents (contracts, visas/work permits, certifications) with real expiry tracking, distinct from training records specifically.
   - A real employee transfer history — an employee genuinely moving from one location/division to another over time, with a real, dated record of each move, rather than only ever reflecting their current, single "Place of Employment" relationship.

**7. Using AI to increase profits, lower costs, and ease compliance with legislation/regulations and business permits, across local/state/federal regimes worldwide.** A real, genuinely different *kind* of feature from everything above — not an accounting mechanism, but a real, AI-assisted advisory layer sitting on top of the real data this app already has. Flagged honestly as a real, far-future idea, not scoped in any real detail — a few, real, concrete directions worth naming for when it's revisited:
   - Real, AI-generated insight from data the app already has — e.g. surfacing that a specific location's real margin has genuinely moved versus a prior period, and why, rather than requiring a person to notice it themselves in a report.
   - Real, AI-assisted compliance review — checking a business's own, real, configured setup (payroll withholding rates, tax settings) against a real jurisdiction's own, current requirements, and flagging a genuine mismatch.
   - Real business permit/license expiry tracking with real, proactive reminders — a genuine extension of the same "real document with a real expiry" pattern already named above for training/employment documents, just applied to the business itself rather than an individual employee.
   - Explicitly out of scope for now: this needs real, careful thought about data privacy, real regulatory liability (a wrong, AI-generated compliance suggestion could be a genuinely serious problem, not just an inconvenience), and which real jurisdictions to even attempt to model first — not a "just add it" feature.

## POS clerk sign-on/sign-off — designed this session, not built

A real, direct requirement, captured here before implementation so the design isn't lost to conversation history. Not yet built — schema, backend, and UI are all still open.

**The core requirement**: a real employee must sign on before they can sell anything at a location — this is a mandatory gate, not a convenience. Signing on is separate from the app's own `users`/`roles` login entirely — employees have no login credentials today (they're AP counterparties, not `users` rows), and the plan is to keep it that way: a real, short PIN on `contact` (a new field), not a full user account per employee. Matches how real retail POS terminals actually work — one shared terminal login, individual clerk PINs on top.

**Real, multi-terminal behavior, not per-browser state**: signing on at *any one* terminal in a location must activate that clerk's "sales clerk" button on *every* terminal at that same location — confirmed directly as a requirement, not assumed. This means sign-on state has to live server-side (a real, new table or a real extension of the shift/relationship mechanism), not in `localStorage` or a per-tab Svelte store — multiple, genuinely different browsers/devices at the same location need to see the same, shared "who's currently signed on here" state.

**A separate, per-terminal timeout/lock layer**: possibly needed, distinct from location-wide sign-on — an individual, idle terminal might lock itself after inactivity, requiring a PIN re-entry to unlock *that specific terminal*, without necessarily signing the clerk off from the location entirely. Two real, different concepts: "am I signed on to sell here at all" (location-wide) vs. "is this particular screen currently locked" (per-terminal, more like a screensaver). Not yet designed in detail — flagged as a real, likely-needed piece, not committed to a specific mechanism yet.

**Real timecards, not manual hours entry** — a genuine, direct correction to `payEmployeeWages`'s current design: sign-on/sign-off timestamps should *be* the real timecard, not just identify who's at the register. Sign-on records a real, timestamped shift-start (employee, location, when); sign-off records the real shift-end against that same shift. `payEmployeeWages` needs a real, second calling mode: given an employee and a date range, sum their actual, completed shift durations, rather than requiring hours as a manual number — while keeping the existing manual-hours path too (a real, necessary fallback for a salaried employee who never clocks in/out, or an honest correction when a clerk forgot to sign off — refusing to pay someone over a forgotten sign-off would be a worse outcome than allowing an override).

**Open design questions, not yet resolved**:
- Does signing off require re-confirming location too, or does location persist across a clerk change on the same physical terminal?
- Should a "confirm delivery receipt" screen for clerks reuse the existing Restock Retail Outlets picking-list mechanism, or be a simpler, stripped-down Stock Receipt variant? Either way, clerks should only be able to confirm receipt of *existing* products at their own location — creating a brand-new product or vendor stays an admin task through Parts/Contacts, deliberately not exposed to a clerk.
- Exact mechanism for the per-terminal timeout/lock layer (a client-side idle timer re-prompting for PIN, vs. a real, server-tracked "last activity" per terminal session) — not designed yet.

## Automatic CoA account creation per location/profit center — investigated, a real, open design question, not built

Per direct request: "the accounts necessary should be created in / added to the CoA when a location / profit center is created." Investigated directly before building anything, since guessing at "necessary" and building the wrong thing would be a real, lasting mistake baked into the schema.

**What's already real and correctly shared, not per-location, confirmed directly**: Sales/COGS accounts are per-*product* (`ensureProductSalesCogsAccounts`), not per-location. Inventory is a single, real, global account — the real, physical *quantity* is what's tracked per-location (via a real, direct `journal_line.location_id`-tagged quantity movement, never a dedicated `part_location` table — removed this same session, per direct correction: it was both a dedicated table and mutated in place, violating the entity-only, append-only principle already established everywhere else), while its aggregate *value* correctly stays one real balance-sheet figure, standard accounting practice. Division-tagging (`journal_line.division_id`) is a real, separate, additive dimension on each posting, not a separate account per division — confirmed and simplified this same session, per direct correction ("division is only a sub-totaling mechanism").

**So what would genuinely be new and location-specific?** The one, real, strong candidate: a real, dedicated till/cash-drawer account per location — e.g. "Till — Riverside Cellars" — distinct from the business's own, central "Cash and Bank" account. This isn't a guess without grounding: it's the exact, real account the daily float/deposit cycle (designed earlier this session, still not built) already needs — a real location's own real cash on hand, separate from what's actually been banked. Creating this account automatically the moment a location is created would be the real, natural trigger point.

**Open, unresolved before building anything**:
- Is a real, dedicated till account the *only* real, new thing needed per location, or are there other real candidates not yet considered (e.g. a real, location-specific write-off/shrinkage expense account, if shrinkage is ever tracked per-location rather than in aggregate)?
- Real naming convention for the new account — "Till — {location}" was used above as an illustration, not a confirmed decision.
- Whether this belongs in `createEntity`'s own location-creation path directly, or in a real, separate, explicit step (matching the unified setup-screen idea above, which already names this as its natural trigger point).

## Multi-currency business setup, automatic bank-account routing, and the daily float/deposit cycle — designed this session, not built

A real, direct requirement, captured here before implementation, connecting three real questions raised together: current multi-currency state, automatic currency-to-account routing, and the real, daily cash-handling cycle a retail outlet actually needs. None of this is built — confirmed directly, not assumed, before writing any of this down.

**Current, real state, confirmed by checking directly**: `account.currency` is a real field, and `postJournalEntry` genuinely validates balance per-currency-group, not just overall — that part is real and tested. `createBusiness` has zero currency parameters. No automatic currency-to-account routing exists anywhere (confirmed via a direct, real search — zero matches). The two existing currency accounts ("Bank Account (DKK)", "Bank Account (EUR)") are hand-written demo bootstrap data, not the output of any general, reusable mechanism. See `docs/multicurrency-design.md` for the deeper, already-written design on balance validation and conversion transactions — this section is about setup and cash-handling workflow, a real, different layer on top of that.

**1. Business setup with a main currency and secondary currencies (accepted as cash)**: `createBusiness` would gain a real main-currency parameter and a real list of accepted secondary currencies, automatically creating a real "Cash at Bank ({currency})" account for each — generalizing the existing, hand-written demo pattern rather than inventing a new one.

**2. Automatic bank account selection based on currency**: real and buildable, but genuinely blocked on a real, missing prerequisite — nothing in POS/Cash Sale/Cash Purchase currently lets a person indicate which currency a sale was actually paid in at all; every real payment today is implicitly home-currency only. This isn't just "add routing logic" — it's "add a real currency selector to the payment step, then route based on it."

**3. The daily float/deposit cycle** — the most substantial of the three, and a real, direct extension of the POS clerk sign-on/sign-off design above, not a separate concept.

Per direct, real correction to the design as first written: neither cash nor EFT is genuinely "at bank" the moment a sale completes — both sit in a real, intermediate, unreconciled state until the actual end-of-day/shift banking and reconciliation happens. What a real sale actually credits is a real, distinct "till" or "cash drawer" asset account — genuinely not the business's own real "Cash at Bank" account (or a secondary-currency variant of it, from item 1 above) at all, even though both are real assets. Only a real, later, explicit banking event moves value from the till into the real bank account — the same real distinction a real retail business's own bookkeeping already makes, now correctly reflected here rather than glossed over.

The real, fuller chain, as raised directly: a real sale credits a real till/drawer (not the bank) → the till's real, accumulated takings may first go into a real, physical safe at the location (a real, further intermediate asset, genuinely distinct from both the till and the bank — not every real business has this extra step, but some do) → a real, explicit banking event (producing a real, viewable banking slip/deposit statement) finally moves value from safe-or-till into the real bank account. Each real step is its own real, separate posting, not one, single, collapsed movement — genuinely mirroring how the physical cash (or the EFT settlement) actually moves.

Also raised directly: some real locations may have more than one real till/cash drawer — multiple real POS terminals at a larger retail location, each with its own, real, separate float, not one, single, shared till per location. The real design needs to account for a real till being its own, distinct, individually-tracked thing (most naturally, its own real entity — matching the pattern used throughout this session for other one-to-many concepts), not assumed to be 1:1 with a location.

A real till needs a starting float recorded at trading-start (for giving change), one or more real "bank the takings" deposit events during the day (each producing a real, viewable deposit statement/banking slip and a real journal entry — debit the real, next real asset in the chain (safe or bank directly), credit the till), and a fresh float recorded when trading resumes after each deposit. A real, multi-currency till would need to track float and takings *per currency*, not one aggregate cash figure — directly connecting this section to items 1 and 2 above, not an independent feature.

**Open design questions, not yet resolved**:
- Exact real trigger for a deposit event — a manual "bank now" action a manager takes, a scheduled/expected number of times per day, or both?
- Whether the float itself is tracked as a real, distinct account/balance, or as a real, computed difference between till takings and what's deposited.
- How a genuinely multi-currency float interacts with the real Medicare/superannuation-style withholding pattern already built for payroll — likely unrelated, but not yet confirmed either way.
- Whether the real safe layer is genuinely optional per location (some locations bank directly from the till, some route through a safe first), and if so, how that's configured.
- Whether EFT settlement is modeled with the exact same real till/bank distinction as cash (a real, separate "unsettled EFT" holding state before it actually clears to the bank), or whether EFT's own, real settlement timing is different enough to need its own, separate real design — not yet resolved either way.
- How multiple real tills at one location interact with the real, single "banking event" concept — does each till bank independently, or does one, real, combined banking event sweep every till at a location at once?

## Non-current assets / investments accounting — explicitly its own scope

Ordinary inventory assumes stock is held to be sold, cost flowing through COGS on turnover. Investment-grade assets are a genuinely different accounting regime — held for appreciation, valued/revalued on their own basis, never flowing through COGS. Deliberately not folded into the inventory/margin work above.

## Relationship modeling

- **The "class hierarchy + instance hierarchy" pattern** (confirmed this session, not yet built anywhere): an intermediate, `relation_id`-tagged entity encodes *what kind* of relationship exists between two otherwise-independent entities (e.g. "Trustee Of"), rather than a new column per relationship type. Same mechanism already proven for report-tagging and COGS-tagging — a real, reusable pattern now, but no concrete relationship type has actually been implemented with it yet (trustee-of-a-trust was the motivating example, still just a design).

- **A real, direct ask, not yet attempted: one clear, enumerable, composable set of methods for each of Phone, Address/Location, Person, Employee, Role, etc.** `addTyped<T>`/`getTyped<T>`/`deleteTyped<T>` (this session) is a real, first, concrete step in this direction — Address and Phone now genuinely share one implementation. Honestly scoped, not yet generalized further: confirmed directly this same session that Location, Division, and Category don't share this generic's real, structural shape (plain columns / `parent_id` hierarchy, not `relation_id`-tagged siblings), so they weren't folded in. The real, open question, deliberately not resolved yet: whether "Person," "Employee," and "Role" as their own, real, distinct, composable concepts (rather than Employee being folded into Contact/AP the way it is today, or Role only existing as the fixed, hardcoded `users.role` enum) are a real, separate refactor worth doing, or whether the current, working mechanisms for each already serve the same real purpose under different names. Not attempted without a clearer, real, concrete target the way Address/Phone had — the risk of a wrong generalization here is real, not hypothetical, given how the location-open-hours/employee-schedule table mistake went earlier this same session.

## Reporting & compliance

- **Gross/Net P&L** — ✅ done this session.
- **XBRL / xBRL-JSON export** — discussed at length (xBRL-JSON is the natural target for this stack specifically, being JSON-native already), not built.
- **ASIC/AASB-specific Australian compliance reporting** — noted, not investigated in any depth yet.
- **`getProfitAndLossComparison`** doesn't yet carry the Gross/Net split the main P&L report gained — a real, small, deliberately-deferred gap.
- **Two standard financial statements this app doesn't produce at all yet**, found by reviewing LedgerSMB's own list of the reports a real accounting system is expected to have: a real **Cashflow Statement** (incoming vs. outgoing cash over a period, resulting in Free Cash Flow — genuinely distinct from the accrual-basis P&L this app already has, since a real sale on credit shows up in Income immediately but doesn't move real cash until the customer actually pays) and a real **Statement of Owner's Equity** (the real, itemized changes in Equity over a period — capital contributions, drawings, and net income, not just the single closing Retained Earnings figure this app already tracks). Neither started; genuinely not the same report as anything that already exists.

- **A real, forward-looking cash flow forecast** — genuinely distinct from the historical Cashflow Statement immediately above: not "what happened," but "what's expected," on a real, weekly or daily view over a chosen horizon. Per direct statement that this "is fundamental to any real ERP effort and should definitely be fully explored and planned for," this whole area — the forecast itself, budget-revision suggestions, and real growth-scenario planning — now has its own, dedicated, thorough plan: **`docs/cash-flow-and-growth-planning.md`**. Summary of what it investigated and proposed, kept here too so this section stays a genuine entry point:
  - **Anticipated AR receipts**: every real, outstanding AR invoice's own `due_date` is already real, queryable data (the same real field `getAgedInvoices`/`getCustomerStatement` already use) — a real, honest first version could project each invoice landing on its own due date, with no attempt yet to model a customer's real, historical payment behavior (paying early/late) beyond that.
  - **Committed AP payments**: the same real, existing `due_date` field on outstanding AP invoices.
  - **Anticipated recurring expenses** (wages, electricity, rent): real, existing recurring journal entries (`journal.recurrence`/`recurrence_count`, `weekly`/`monthly`/`yearly`) already carry everything needed to project their own next real occurrence forward — but only for expenses a person has actually set up as a real, recurring entry; a real, one-off or irregular expense (most utility bills, in practice) has no real way to be anticipated at all right now.
  - **GST/sales tax remittance timing**: a real, confirmed gap, not a partial feature — `Sales Tax Payable`/`Purchases Tax Claimed` carry a real, running balance, but there is genuinely no concept anywhere of a tax period or a remittance schedule (monthly/quarterly/annual, jurisdiction-dependent) that would let a forecast know *when* that balance actually needs to be paid, only that it exists.
  - **Extending credit / credit terms to volume customers**: `contact.payment_terms_days`/`credit_limit_minor` already exist per real customer — but nothing currently models a real, proposed *change* to a customer's terms and what effect that change would have on the forecast before actually committing to it; this reads as a real, distinct, "what-if" capability, not just a data gap.

  **Real, open questions, not yet resolved, before building anything**: whether a first, honest version should simply assume on-time payment (every invoice lands on its own due date) rather than attempt to model real payment behavior, which would need real, historical data this app doesn't yet track in an aggregated way; how a tax remittance schedule would actually be configured, and by whom, given it's genuinely jurisdiction-specific; and how deep the "what-if credit terms" idea should go for a first version — a real, separate, later feature, or folded into the same report as a real, adjustable parameter.

  **A real, direct continuation of the same thought, per direct follow-up**: "which leads to budgeting and comparison reports and then suggestion for the revision of budgets to reflect the hopefully current growth in the business rather than a downturn." A real, existing foundation already investigated: `getProfitAndLossComparison` already computes a real, per-account variance between any two real ledgers (Actual vs Budget, the exact real comparison this would build on). What's genuinely missing: that comparison is a single, point-in-time snapshot between exactly two ledgers, not a real, multi-period trend — a genuine budget-revision suggestion ("Actual has exceeded Budget by roughly this much for several consecutive months, consider raising next period's figure") needs to look across a real sequence of periods, not one comparison. Two real, honestly different directions worth naming, not yet chosen between: a real, simple, rule-based heuristic (a fixed, transparent rule — "N consecutive periods over/under by more than X%, suggest revising by that same, real percentage") versus a real, AI-assisted suggestion drawing on the broader "AI for profitability" idea already captured earlier in this document. Either way, a real, genuine design question not yet resolved: whether a "suggestion" should ever be allowed to directly edit the real Budget ledger's own figures, or must always require a real, explicit, human decision to accept it first — given how real, financial numbers ought to be treated, the latter seems like the real, safer default, but this is stated as an open question, not decided here.

## Internationalization — now 5 languages, still real gaps

- ✅ Number/date formatting (explicit fixed-choice patterns, not locale inference) and core application vocabulary translation are both real and working.
- ✅ **Italian added as a supported language, now with full vocabulary coverage** (all 113 real vocabulary words translated, matching German/French/Danish's coverage — filled a real, reported gap where only ~40 core words existed, leaving most of the UI still in English when Italian was selected).
- ✅ **Ditta Italiana Srl** and **Schweizer KMU AG** added as real demo businesses with genuine, representative (not exhaustive) charts of accounts adapted from Tekki's real Italy/Swiss data. Schweizer KMU AG's accounts carry real French and Italian translations sourced directly from Tekki's own parallel Swiss French/Italian charts (which happen to share identical account numbers, confirmed directly before relying on it), demonstrating the `translation_entry` mechanism against genuinely different real-world wording, not placeholder text.
- ❌ Not done: a dedicated Swiss-German-only variant separate from the combined Schweizer KMU AG demo; French Canadian or other locales.
- **RTL layout (Arabic, Hebrew)** — not investigated for this codebase specifically. Real accounting software generally does mirror the full UI (CSS logical properties / `dir="rtl"`, sidebar position, icon direction), while numbers and dates typically stay LTR "islands" within RTL text flow (bidirectional text handling) — this project's actual CSS has never been audited for RTL-readiness.
- **CJK (Japanese, Chinese)** — not an RTL concern (both are LTR in modern usage), but real, separate open questions: font rendering/line-height for CJK glyphs, family-name-first name ordering conventions, and (for Japan specifically) J-GAAP as its own distinct local standard alongside IFRS convergence, the same dual-standard situation already seen elsewhere.

## Project housekeeping

- ✅ **`LICENSE` (GPLv3) and `NOTICE.md` added** — adopted because the Italian and Swiss (German/French/Italian) demo charts of accounts are adapted from Tekki's real SQL-Ledger fork (GPLv3). `NOTICE.md` is honest about provenance: the application itself is original work; specific chart-of-accounts *content* for demo businesses draws on real published national structures.
- Not every list in the app is paginated with the new `Pager`/user-page-size infrastructure yet — Invoices, Contacts, and Parts were flagged early on and never circled back to.

## A real 90-day trading simulation, run purely through the web UI via Playwright — in progress

The end goal: a fully scripted Playwright run through the real, running app — every purchase, transfer, sale,
invoice, and payment clicked and typed through actual screens, not a backend script calling functions directly
(the existing wine-retail simulation does the latter — fast and deterministic, but never touches the real
HTTP API or a browser at all). Starting from an empty shop, a brand-new warehouse, and the owner's capital
contribution.

Software gaps identified and their status:
- ✅ **Min/max/reorder levels are now editable directly on Stock Listing** — the backend function and route
  already existed; only the UI to actually use them was missing. Real test added confirming values round-trip
  through the exact same listing the UI reads.
- ✅ **Warehouse carton capacity** — was `NULL` for both real warehouses (a data gap, not a software one — the
  Locations UI already supported setting it for any location type). Set to real values (6000/5000).
- ✅ **Location address and phone** — reused the existing `contact` mechanism entirely (the same table/route
  customers and vendors already use) rather than adding new schema — a location and a contact both just need
  a street address and phone, so there was no real reason for a second, parallel representation of the same
  kind of data. `location.city` stays the single, canonical source (real transfer-eligibility logic already
  reads it) — deliberately not duplicated into `contact.city`.
  **Update, per direct, later, non-negotiable instruction:** the `location` table itself no longer exists —
  city (along with capacity/timezone) now lives directly on `contact`, the exact "single, canonical source"
  this entry already pointed at, one table earlier than expected. See
  docs/css-styling-and-data-entry.md's own "division, location, and part are genuinely just entities" section.
- ✅ **Multiple, genuinely typed addresses and phones** (Registered Office/Billing/Delivery/Shipping;
  Landline/Mobile/Home/Fax/Toll-Free) — a real second application of the relationship-type pattern (see
  docs/entity-model.md): each address/phone is its own real child entity, `parent_id` for containment,
  `relation_id` for the type tag, `contact_entry` for the value — zero new tables. Wired into the real Locations
  UI, verified live against the real API. Applicable to any entity, not just locations — vendors and customers
  can use the exact same `addTypedAddress`/`addTypedPhone` functions once a UI is built for them.
- ✅ **Guided new-business setup** — `createBusiness(businessName, financialYearLabel, userId)`, a real route, and a
  real UI at `/setup/new-business`. Creates two real ledgers from day one, not one — a real Actual ledger and a
  real Budget ledger for the financial year (Budget is just another ledger, the same proven pattern already
  used for My Business and Wine Retail Company). A genuine correction made along the way, not initially understood
  correctly: the Chart of Accounts is **not** uniformly shared across every business — confirmed directly, not
  assumed. Only the five top-level report categories (Asset/Liability/Equity/Income/Expense) are genuinely
  global; the real, named leaf accounts underneath are country-specific families that already exist as real,
  distinct entities (English/generic for My Business and Wine Retail Company, German for BMW M GmbH, French
  for Peugeot, Italian for Ditta Italiana Srl, Swiss for Schweizer KMU AG — confirmed by entity_id, not just
  different display names). `getCoaFamilyAccounts` surfaces which real accounts an existing ledger actually
  uses, so a person setting up a new business can see and choose a matching family before creating anything,
  rather than silently defaulting to the generic English set regardless of their business's real country. A
  real, honest, remaining limitation: this only works for ledgers with real posted history — Ditta Italiana Srl
  and Schweizer KMU AG have real, distinct accounts bootstrapped but have never had a real transaction posted,
  so they'd show as empty previews today. A genuinely new country not yet represented still needs its own
  leaves built through the Entity Tree Editor.
- ❌ **Guided new-location creation** — same gap as above, one level down: creating a brand-new warehouse or
  outlet still needs the generic editor for the entity itself, then the Locations page for its details.
- ❌ **Auto-generated transfer orders** and **auto-generated purchase orders** — both still placeholder-only
  menu entries. The existing stage→post pattern (already proven throughout this app) is the right shape for
  both; neither has real logic behind it yet.
- ❌ **A real approval step** distinct from stage→post-by-the-same-session — the Vouchers section is the
  placeholder waiting for this.
- ✅ **Realistic shelf/bottle, carton, and refrigerated capacity** — grounded in real physical constraints, not
  arbitrary numbers: retail bottle capacity (~1,100-2,200) reflects a genuine small-to-medium shop's shelf
  space; retail carton (backroom) capacity was corrected down from an unrealistic ~14-15% of bottle capacity
  to ~4-5% (a real backroom is genuinely much smaller than the sales floor, not comparable in scale); warehouse
  carton capacity (5,000-6,000) reflects a real distribution center. Refrigerated-display capacity now scales
  proportionally to each outlet's own size (a real beverage cooler is roughly 8-10% of a shop's total capacity)
  rather than a flat number regardless of shop size.
- ⚠️ **Capacity is now actively, structurally tracked, but still not enforced/blocking.** A real, per-location
  "Storage Capacity Remaining" account (`ensureLocationCapacityAccount`/`adjustLocationCapacity`) is genuinely
  decremented/incremented on every real receipt, transfer, dispatch, write-off, and stock-take variance, reusing
  the existing `item_source.package_quantity` field for real, one-directional carton-to-bottle conversion at
  warehouses. What's still genuinely open: whether exceeding it should warn or block (a real, separate design
  decision, not yet made — see `docs/stock-lifecycle-review-plan.md`), and whether refrigerated-vs-room-temperature
  capacity needs its own, separate, third tracked dimension alongside bottle/carton.
- ✅ **Real per-product Sales/COGS accounts now mirror the real, existing, user-configurable product category
  tree**, not a flat list. Confirmed directly before fixing: `Income` had 97 flat direct children (81 of them
  real per-product Sales accounts), genuinely unusable as a real P&L read. The product catalog already has a
  real, multi-level category tree (`Beer` → `Ale`/`Lager`/`Stout`, `Spirits` → `Gin`/`Rum`/`Vodka`/`Whisky`),
  already editable through the Entity Tree Editor with zero code changes — so this needed no new, separate
  "category system," just mirroring what already exists: `ensureProductSalesCogsAccounts` now walks a
  product's real category chain and lazily creates a matching chain on the GL side (`Sales - Beer` → `Sales -
  Ale` → the real per-product leaf). A category left flat gets one real grouping level; one broken down further
  gets more — genuinely different per location/business without any code change, exactly because it's reading
  the real, current category tree at the moment each account is created, not a hardcoded structure. `Income`
  now has 21 direct children, not 97. Verified the underlying totals are completely unaffected (every exact
  documented `make test-e2e` figure unchanged) — only the organizational structure changed.
- ✅ **The P&L report page renders the real, grouped hierarchy, not a flat list** — confirmed directly, not
  assumed: `getProfitAndLoss` returns real `income_tree`/`cogs_tree`/`operating_expenses_tree` fields, and the
  real P&L page (`reports/profit-and-loss/+page.svelte`) walks them via `CategoryTreeNode`/`flatten`, rendering
  real, collapsible subtotals (`Sales - Beer` expands to `Ale`/`Lager`/`Stout`) rather than a flat account list.
  This TODO item was stale — the work was already done in an earlier round and simply never marked here.
- ❌ **Inventory is still one, single aggregate account**, not per-product or per-category — a real, separate
  question from the Sales/COGS fix above, since per-product inventory *valuation* isn't tracked as its own GL
  fact anywhere yet (only quantity, via a real, direct journal_line quantity movement/`stock_lot`). Not addressed here.
- ❌ **The actual Playwright scripts** — `e2e/` has a real, working config and a login helper (confirmed the
  browser launches correctly in this sandboxed environment via a pre-cached binary), but no real day-by-day
  simulation flow written yet.
- ✅ **Three real bugs found through actually using the General Journal screen, all fixed:**
  - Entering both a debit and a credit on one line silently computed debit-minus-credit as a net amount instead
    of rejecting the invalid input — confirmed directly in the code (`amount_minor: parseMinorUnits(debit) -
    parseMinorUnits(credit)`), not assumed. Fixed by clearing the opposite field the moment the other one is
    typed into, the same behavior standard accounting software uses. Verified live via Playwright, kept as a
    real, permanent test at `e2e/tests/general-journal.spec.ts`.
  - Negative amounts displayed with a leading minus sign (`-1,234.56`) instead of standard accounting
    parentheses (`(1,234.56)`) — fixed at the one, shared `formatAmount` function, so every report is correct
    at once, not patched per page.
  - `closeBooks` (year-end/period close) used to collapse every real profit center's net income into one,
    single Retained Earnings figure, even though the app already has real division infrastructure
    (`journal_line.division_id`, `getProfitAndLoss`'s `divisionName` filter, cost vs. profit center types) —
    confirmed directly this was never actually wired into close. A further, correct architectural point raised
    directly: a division is itself a real, ordinary entity that can be nested (exactly like a product category
    can — `Retail` -> `Retail North`), already genuinely user-configurable through the Entity Tree Editor. Fixed
    by generalizing the same mirroring mechanism `ensureProductSalesCogsAccounts` already uses
    (`getProductCategoryChain` generalized into `getAncestorChain`, reused for both `Parts` and `Divisions`) —
    each real division's own net income now rolls into its own real, correctly-nested
    `"{retainedEarningsAccount} - {division chain}"` leaf, not one collapsed figure. A real bug caught building
    this, not shipped blind: staging one reversal line per (account, division) pair collided with
    `journal_entry_staging`'s intentional same-account upsert behavior (meant for the normal "edit a row" UX),
    silently losing all but the last division's reversal — fixed by combining each account's reversal into one
    staged line (avoiding the collision) while still computing the real per-division split separately for
    Retained Earnings, which uses genuinely distinct account names per division. Two real, permanent tests
    added: one flat multi-division case, one genuinely nested one.
- ✅ **One, single, shared AddressList/PhoneList component, used consistently everywhere** — confirmed a real,
  deeper inconsistency before fixing: Contacts, the Structured Editor, and the customer terminal each had their
  own, duplicated address/phone editing code, and the first two still used the *old*, single `address_line1`
  field model, not even the same address system Locations used. Migrated Locations, Contacts, and the
  Structured Editor's contact-details section to the two real, shared components — confirmed live via
  Playwright for each, not assumed to work from reading the code. Both components own their own Insert/Delete
  keyboard handling internally (attached to their own root element, not the page), so any page using them gets
  correct, consistent, isolated keyboard behavior automatically — nothing left for a new page to reimplement or
  get subtly wrong. No visible Add/Remove buttons at all, per direct instruction — Insert/Delete only.
- ❌ **The customer-terminal self-registration screen deliberately not migrated** — a real, different case, not
  an oversight: it's a one-time sign-up form for a customer entity that doesn't exist yet (via a dedicated
  `registerCustomer` endpoint), while AddressList/PhoneList both require an existing, real `entityName` to load
  and save addresses against. Migrating this would mean a genuinely different, two-step registration flow
  (create the bare customer first, then show the shared components) — a real, separate piece of design work,
  not done here.
- ✅ **A real Playwright script for Wine Retail Company, driven entirely through the actual web UI** — a
  request from earlier in this project that had never actually been fulfilled. `e2e/tests/wine-business-setup.spec.ts`:
  from a completely fresh database, selects the real, already-bootstrapped Wine Retail Company (confirmed
  directly: creating a *new* business with that exact name correctly fails, since it already exists in
  `schema.sql`), creates a real new location through the real `/locations` UI, posts a real $1,000 owner's
  capital contribution through the real `/post` General Journal UI, and confirms it lands correctly on the real
  Trial Balance report. Verified against the real database directly afterward, not just UI assertions.
  A real bug in this test itself caught along the way, not shipped blind: the first attempt silently never
  posted anything (a required `reference` field was left empty), yet the UI still showed a "balanced"
  1,000.00/1,000.00 total — caught by checking the real database directly rather than trusting the UI, not
  assumed correct because the page looked right.
  A second, real, live app bug found and fixed while building this: `getLedgers()` was returning "{business}
  Locations" as if it were a selectable ledger, appearing right next to the real Actual/Budget ledgers in every
  ledger dropdown throughout the app (Trial Balance, General Journal, every report) — fixed to correctly
  exclude a business's own Locations parent, with the existing test (which had asserted the old, buggy
  behavior) corrected to match.
- ✅ **Application-wide translation, short labels and titles** — 40 of 41 real pages now have at least their
  short labels/titles translated into all 4 supported non-English languages (German, French, Danish, Italian),
  up from just the menu structure. Cross-referenced LedgerSMB's own real, published translations
  (github.com/ledgersmb/LedgerSMB/locale/po) where genuinely applicable — only 3 direct matches (this app's
  vocabulary turned out to be mostly more specific, compound phrases LedgerSMB's own simpler entries don't
  cover), the rest translated directly. A real bug in LedgerSMB's own reference data caught and repaired before
  use: a double-encoding artifact corrupting every non-ASCII character. Verified live via Playwright with real
  German screenshots, full Playwright suite passing with no regressions.
- ✅ **All 34 real pages' `.intro` help-text paragraphs now translated**, including the 9 more complex ones
  (embedded `<code>` technical terms, live business/ledger names via a `{NAME}` placeholder token, and the 2
  genuine AR/AP and customer/vendor word-choice branches as full, natural sentence variants). Closes the
  application-wide `.intro` translation thread entirely.
- ❌ **Checkbox labels, input placeholders, and `.hint` paragraphs are a separate, still-open category** —
  confirmed directly, not assumed closed by the `.intro` work above: "Sell on account (existing customer, no
  immediate payment)" (a checkbox label), "Scan barcode or type a name…" (an input placeholder), "Check the
  customer's actual card/ID against what's shown here before approving." (a `.hint` paragraph) are all still
  hardcoded English on the POS screen alone, and likely elsewhere too — not yet audited across all 64 pages the
  way `.intro` was.
- ❌ **customer-terminal still not translated** — the one real page deliberately left out of this pass, for the
  same reason it was excluded from the earlier centering audit: a genuinely different, public self-service
  case (a customer registering themselves, not a staff member navigating the app), not an oversight.

## User Manual (PDF) — real, direct feedback to address next time it's amended

Per direct request, noted here before further work rather than acted
on in haste — all still open:

- ❌ **Table of Illustrations** — a real, second, dedicated list (like
  the Table of Contents) of every real figure/screenshot, with its
  own page number.
- ❌ **A note that this is the English version, with a list of other
  available languages** — the manual doesn't currently say, anywhere,
  which language it's written in, or that others exist/are planned.
- ❌ **An English Glossary and an Index at the back** — `docs/glossary.md`
  already exists as source content; not yet included in the PDF
  itself at all.
- ❌ **"Chapter 0 — Overview" doesn't appear on the front page** — the
  title page currently only lists "Chapter 1 — Introduction" and
  "Chapter 2 — Configuration," even though Chapter 0 is real, and
  first.
- ❌ **No description or illustration of the real login/logon screen
  itself** — the manual's own Figure 1.1 shows the "Choose a
  business, ledger, and language" screen, which comes *after* a real
  login — the real, actual login screen itself isn't shown or
  described anywhere.
- ❌ **A real, live application bug, not a manual bug**: the real
  Login and "Choose a business, ledger, and language" screens don't
  show their own title within a real, established "panel frame" the
  way every other, real screen in the application does (the
  `heading-wrap`/`<h2>` pattern) — confirmed directly worth fixing in
  the real application itself, not just documenting around it.
- ❌ **Widows and orphans** — a real, direct report of at least one
  (section 1.3's own heading, isolated) — the whole manual needs a
  careful, direct pass checking for this throughout, not just the one
  reported instance.
- ❌ **Running headers/footers with the chapter title and page number
  on every real page** — currently only a bare page number in the
  footer, no chapter title, no header at all.
- ❌ **A "Contributors" page**, and a possible, separate "Programmer's
  Manual"** (real, technical documentation for developers, distinct
  from this, real, end-user manual) — not scoped in any detail yet.
- ❌ **A suggestions form in every manual** — not designed yet; real,
  open question whether this means a real, physical, fillable page,
  or a pointer to a real, live feedback channel.
- ❌ **Some real, lined pages with space for notes**, at the back.
- ❌ **Reference an established technical/user manual standard, where
  appropriate** — not yet researched which real, existing standard
  (if any) best fits this application's own real style and audience.

## Translated manuals — real, honest effort estimate, asked directly, not yet built

Per direct question: genuinely substantial, and meaningfully larger
than translating the application's own UI labels (already done, see
above) — a full, translated manual needs the following, each a real,
separate, non-trivial piece of work, not a single, simple pass:

- **Every real screenshot re-captured in that language** — the
  application itself already, genuinely supports every UI language
  live (German, French, Danish, Italian, confirmed working
  throughout this session), so this is mechanically straightforward
  per screenshot (switch language, re-navigate, re-capture) but
  multiplies the real screenshot count by the real number of
  languages — roughly 4x the current, real screenshot work for the
  four already-supported languages.
- **Every real sentence of prose re-written, not machine-translated
  word-for-word** — this manual's own real, distinctive voice (the
  Lars-and-Mette narrative, the direct, repeated "real" emphasis)
  doesn't survive a literal, mechanical translation; a genuine,
  fluent rewrite in each real language is real, separate authorial
  work, not a lookup.
- **Verifying zero untranslated English remains**, per direct,
  emphatic request — every real figure caption, every real table
  header, every real cross-reference needs a direct, deliberate check
  in the finished, real, translated document, not just the body
  prose — a real, genuine risk given how many small, easy-to-miss
  pieces (captions, table headers, the TOC itself) a translation pass
  could otherwise leave in English by accident.

Honest, rough scale: producing one, real, additional, fully
translated manual is a comparable amount of real, direct work to
building this English one from scratch a second time — not a
lightweight, incremental add-on. Four additional languages
(German, French, Danish, Italian) would be four, real, separate,
comparable undertakings.

## Language names — a real, confirmed gap found and fixed, plus one honest, remaining limitation

- ✅ **Every real, existing language's own name now has a real, direct
  translation into every other real, existing language** — per direct
  request to check, not assume. Found and fixed a real, genuine gap:
  Italian had zero real translations of its own, and none of Danish/
  English/French/German had a real Italian translation of themselves
  either. All five now cross-reference completely (confirmed
  directly, not assumed).
- ❌ **Adding a real, new language via the new Translations page
  (Configuration) does not automatically seed its own name's
  translation into every other, existing language, or vice versa** —
  confirmed directly: "Spanish," added live during this session's own
  testing, had zero real translations of its own name at all. The
  administrator would need to add these by hand, the same way any
  other real word's translations are added — not yet a real, guided
  or automated step.

## Splitting schema.sql — real, deliberately back-burnered for now

Per direct request: split schema.sql into the basic, structural
schema; English vocabulary only; each other language's vocabulary
separately; and the German BMW / French Peugeot demo ledger data
separately. Confirmed all three real reasons apply (auditing each
language in isolation, long-term file maintainability, and directly
supporting the round-trip translation workflow) — deliberately
deprioritized for now, per direct instruction, not forgotten.
