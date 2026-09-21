# Cash flow, budgeting, and growth planning — a full exploration

Per direct statement: "cash flow and budgeting and planning for growth without running out of cash or overdraft is fundamental to any real ERP effort and should definitely be fully explored and planned for." This document takes that seriously — a real, thorough pass, not a few more bullet points. Nothing here is built yet; this is the plan the building should follow.

## Why this is genuinely foundational, not just another report

A business can be genuinely profitable on paper — real revenue exceeding real expenses, quarter after quarter — and still fail, specifically because it ran out of actual cash on a specific day. A real sale on 30-day terms is real income the moment it's invoiced, but it isn't real cash until the customer actually pays; a real wage bill or a real supplier payment doesn't wait for that. Growth makes this worse before it makes it better: a genuinely growing business typically needs to spend real cash *ahead* of receiving it — more stock, more staff, more rent — while its own customers are, if anything, taking longer to pay as volume grows. This is precisely why "profitable but insolvent" is a real, common, well-documented way real businesses fail, and precisely why this deserves to be treated as foundational rather than a nice-to-have report bolted on later.

## Real, existing foundations this can build on

Investigated directly, not assumed, before proposing anything below:

- **`invoice.due_date`** on every real AR/AP invoice — already real, queryable data, already used by `getAgedInvoices`, `getAgedSummary`, and `getCustomerStatement` (built this session).
- **Recurring journal entries** (`journal.recurrence` — `weekly`/`monthly`/`yearly`, `recurrence_count`) — already real and postable, carrying everything needed to project a real, known-recurring expense (rent, a fixed wage) forward in time.
- **Budget ledgers** — every real business already gets both a real Actual ledger and a real Budget ledger from day one (`createBusiness`). `getProfitAndLossComparison`/`getTrialBalanceComparison` already compute a real, per-account variance between any two real ledgers.
- **`account.currency`** — a real per-account currency, already validated in `postJournalEntry` itself; relevant to a real, multi-currency cash position, not just a single number.
- **`contact.payment_terms_days`/`credit_limit_minor`** — already real, per-customer/vendor data.

## Real, genuine gaps, confirmed directly rather than assumed

- **No real bank account registry at all.** `/setup/bank-accounts` is a real, honest 8-line stub (`NotImplemented`) — its own, stated purpose ("registering which real accounts represent actual bank accounts specifically... distinct from the broader Chart of Accounts") is exactly the real foundation a cash position needs, and it doesn't exist yet.
- **No reconciliation.** `/reconciliation` is the same real, honest stub. A real cash-flow forecast's own starting point — "how much real cash do we actually, currently have" — is weakened without real reconciliation confirming the book balance matches the real, actual bank balance.
- **No overdraft/credit-facility concept anywhere** — confirmed via a real, direct search, zero matches. Without this, there's no real way to know when a projected shortfall is actually a real crisis (below zero, no facility) versus genuinely fine (below zero, but within a real, arranged overdraft limit).
- **No tax remittance schedule** — the running `Sales Tax Payable` balance exists, but nothing knows *when* it's actually due (see the cash-flow-forecast entry above this one in `docs/TODO.md`).
- **No multi-period trend** — `getProfitAndLossComparison` is a real, point-in-time, two-ledger comparison, not a real sequence across several periods.

## A proposed, layered build — each layer real and useful on its own

Not a single, monolithic feature. Each layer below should stand alone as something genuinely useful before the next is attempted, so the whole effort doesn't have to land at once to be worth doing.

**Layer 1 — A real, current cash position.** Requires the real bank-account registry above to actually exist first: which real GL accounts are genuinely cash/bank accounts (as opposed to Inventory, Accounts Receivable, or anything else that happens to sit under Asset), each with its own real, current balance, and — critically for the "without running out of cash or overdraft" framing — a real, optional overdraft/facility limit per account. This is the real, necessary starting point every later layer depends on; building the forecast before this exists means forecasting from a number that isn't actually verified as "cash."

**Layer 2 — The forward-looking cash flow forecast itself** (already captured above, in the entry this document extends): anticipated AR receipts and AP commitments from real invoice due dates, anticipated recurring expenses from real recurring journal entries, on a real, chosen weekly or daily horizon. Produces a real, day-by-day or week-by-week *projected running balance*, not just a list of anticipated movements in isolation.

**Layer 3 — Real overdraft/shortfall warning.** Directly needs Layer 1's real overdraft limit and Layer 2's real projected running balance together: the real, meaningful moment isn't "cash goes negative," it's "cash goes below the real, arranged facility limit." A real, honest first version: highlight the real, specific date a projected shortfall first occurs, and by how much, rather than just a pass/fail indicator for the whole horizon.

**Layer 4 — Budget-revision suggestions** (already captured above): once a real, multi-period trend view exists (a real, new capability — today's comparison is two ledgers, not a sequence), a real, transparent, rule-based suggestion ("Actual has exceeded Budget by roughly this much for N consecutive periods") is achievable without AI at all. A real, AI-assisted version is a genuinely separate, later choice, not a prerequisite for a first, useful version.

**Layer 5 — Real growth-scenario modeling.** The layer that actually answers the question in your own words — "planning for growth without running out of cash." A real, separate, alternative scenario (structurally: another real Budget-shaped ledger, or a real, explicit variant of one) where a person can express "sales grow by X%" and see the real, downstream effect ripple through: more stock purchases (and their own real payment timing), more wages if headcount scales with volume, and — the actual point — whether Layer 2/3's own real, projected cash position still stays above the real overdraft limit under that scenario. This is real, genuine "what-if" territory, and the most open-ended layer of the five; it deliberately isn't scoped further here beyond naming it, since it depends on every layer below it actually existing first.

## Real, honest sequencing proposal

Layers 1 through 4 are each independently real and valuable, and roughly ordered by real dependency (each genuinely needs the one before it to mean anything). Layer 5 is the real, ultimate goal implied by "planning for growth," but attempting it before Layers 1–4 exist would mean building a growth scenario on top of a forecast that itself has no real foundation yet.

**Proposed real starting point**: Layer 1 (the bank-account registry) — it's the smallest, most contained, most clearly-scoped piece, it directly finishes an already-stubbed screen rather than starting from nothing, and every other layer genuinely depends on it existing.

## Explicitly not decided here

This document deliberately stops short of choosing implementation details (exact schema, exact UI, exact horizon lengths, exact suggestion algorithm) — per the same real lesson from earlier this session (the location-open-hours table mistake): a plan this size deserves confirmation on direction before code gets written, not a guess dressed up as a decision.

## A real, concrete design conflict found by playing devil's advocate on the "relationship, not columns" recommendation

Per direct invitation to genuinely discuss, disagree, and pressure-test before building — this is exactly that, and it surfaced something real, not hypothetical.

The recommendation was: associate a real bank account with its own real division/location using `setEntityRelationship`, the same real mechanism already proven this session for Belongs To Division/Place of Employment — no new columns. Checked directly before accepting that recommendation, rather than assuming it: `setRelationship` itself writes directly to the entity's own `relation_id` (`updateEntity(entity.id, { relation: recordName }, userId)`).

That's a real, genuine problem specifically for a GL account, and only for a GL account: `createBusiness` already uses a GL account's own `relation_id` for something else entirely — tagging it with its real CoA prototype (`English CoA`, `German CoA`...), which the actual General Journal account dropdown filters by directly. A real, secondary-currency bank account (`Cash at Bank (EUR)`, built earlier this session) already carries this real tag today. Using `setRelationship` on that same account to also tag it to a division would silently overwrite the CoA-prototype tag with the division link — an entity only has one real `relation_id` slot, not two — quietly breaking the account's own visibility in the General Journal dropdown, discovered probably much later, likely as a real, confusing "why can't I post to this account anymore" bug.

This didn't come up for divisions, locations, or employees earlier this session because none of *those* entities' own `relation_id` slots were already spoken for — the mechanism is genuinely sound in general, it just has a real, specific collision here.

**The corrected, real approach, matching the address/phone pattern instead of the plain-relationship one**: don't touch the bank account's own `relation_id` at all. Create a real, separate, new child entity representing the link itself (the exact same real shape `addTyped<T>` already uses for addresses/phones this session) — e.g. a real entity named `"{account} — Division"`, parented under the account, with *that* new entity's own `relation_id` pointing at the real division. The account's own `relation_id` stays untouched, free to keep doing its real, existing CoA-prototype job.

**Still an open, real question, not resolved here**: whether this warrants a real, small, third generic alongside `addTyped<T>`/`getTyped<T>` (since the underlying shape — a real, named child entity, `relation_id`-tagged, distinct from any 1:1 property already living on the parent) is genuinely the same one more time — or whether one real, division-specific pair of functions is honestly simpler for what's currently just one real use case. Not decided; worth talking through rather than guessing.
