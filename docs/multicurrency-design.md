# Multi-Currency Design

Status: design complete, not yet implemented. This document is the
single source of truth for the design worked out iteratively; the
prototype (`backend/scripts/prototype-multicurrency.ts`) tests it
against real numbers before any schema/migration work begins.

## The core principle

"Credit = debit" — the only business rule this whole system enforces —
becomes: **a single journal entry (one reference) can genuinely involve
multiple currencies, but each currency present must independently
balance to zero among its own lines.** Not one blended sum across
mismatched currencies, and not a requirement to split into separate
journal entries either — one real transaction stays one journal entry,
its lines simply decompose into independent per-currency balance
checks. Since every account's currency is fixed via the Chart of
Accounts, this decomposition is trivial: group an entry's lines by
each line's account's currency, and require every resulting group to
sum to zero.

This does require a real, direct change to `postJournalEntry` (see
"The actual validation rule" below) — an earlier version of this
document concluded no validator change was needed at all, treating a
multi-currency transaction as several separate single-currency
entries linked only by reference naming. That was an over-correction,
directly corrected: a journal is allowed to genuinely span currencies,
it just can't blend them when checking balance.

## Currency as a commodity, not a number format

Foreign currency held in a bank account is inventory of that currency,
using the exact mechanism already built for wine lots — not a new
concept:

- Each non-home currency is a real `part` (e.g. "EUR", "USD").
- Acquiring foreign currency creates a `stock_lot` via the existing
  `receiveLot`, with the lot's cost basis being what was actually paid
  to acquire it (a real transaction amount, never a synthetic
  mid-market rate).
- Spending or converting foreign currency consumes lots FIFO via the
  existing `consumeFromLots` — already built, already tested for wine,
  reused unchanged.

## Where currency lives, and precedence

Four places can specify a currency, checked in this order for any given
journal line:

1. **Division** (cost/profit center) — a `currency` column on the
   existing `division` extension. A US profit center transacting
   primarily in USD, a European one in EUR, within the same business.
2. **Business** — a `home_currency` (and `country`, for the
   jurisdiction) on a new `business` extension table (following the
   same 1:1-entity-extension pattern `contact`/`division`/`account`
   already use — not a new bespoke concept). The default/reporting
   currency and the fallback when a line isn't tagged with a division.
3. **Account** — a `currency` column on the existing `account`
   extension, for an account that's inherently foreign-currency
   regardless of division (e.g. a USD bank account held by an
   otherwise-AUD business).
4. **Contact** — a `currency` column on the existing `contact`
   extension, so a debtor/creditor's own currency is explicit even when
   the transaction is booked through a home-currency division.

A journal line's effective currency is the most specific of these that's
actually set, falling back toward the business's home currency.

## The actual validation rule: group by account currency, each group balances independently

Since every account's currency is fixed via the Chart of Accounts, the
grouping needed is trivial — no per-line "effective currency"
precedence lookup required, just each line's account's own, fixed
currency. `postJournalEntry` groups an entry's lines by that currency
and requires every group to independently sum to zero, rejecting the
entry outright if any group doesn't — not summed together, and not
rejected merely for containing more than one currency; a real
transaction is allowed to genuinely span currencies within one entry.

The example from earlier is one journal entry, two currency groups:

```
FX-BUY-1 (one entry, one reference — two currency groups, each independently balanced):

EUR group:
Debit  Cash at Bank (EUR)           €1,000
Credit FX Conversion Clearing (EUR)         €1,000

USD group:
Debit  FX Conversion Clearing (USD) $1,090
Debit  Delivery Fees (USD)          $15
Credit Cash at Bank (USD)                    $1,105
```

## Canned general journals — reusable transaction templates

Generalizing "bank fee" into what it actually is: a **delivery/handling
fee**, applicable to any commodity purchase (currency, wine, anything
shipped), not something bespoke to currency. A reusable template, not
new schema — computed from data that already exists:

```
fee = max(perUnitRate * cartons, minimumFee)
cartons = ceil(orderQuantityBaseUnits / partSource.package_quantity)
```

Using the *existing* `part_source.package_quantity` (already tracks
"how many base units per package, per vendor") to convert an order's
base-unit quantity into a carton/shipping-unit count — no new field.
How a carton is internally structured (12 loose bottles, 4 six-packs, 6
quads) is a separate, downstream retail-packaging concern already
handled by `package_quantity` varying per vendor/product; the fee
calculation only needs the resulting carton count, not that internal
structure.

The formula is `max(...)`, not `+`: the minimum is a floor that applies
to small orders, not a surcharge added on top of every order regardless
of size — confirmed as the correct interpretation before building
either the currency fee template or generalizing it to other
commodities.

## Two real corrections this surfaced, still valid under the corrected rule

Both proven by prototype, and both remain correct regardless of
whether currency groups live within one entry or across several — they
follow from "every account has exactly one fixed currency," not from
how entries are split:

- **The FX Conversion Clearing account cannot be one shared account
  used for both currency halves of a conversion** — it must be two
  separate accounts (`FX Conversion Clearing (EUR)`, `FX Conversion
  Clearing (USD)`), the same pattern as `Cash at Bank (EUR)`/`(USD)`.
- **Any fee/expense account touched by more than one currency's
  transactions needs a currency-specific variant for each currency** —
  `Delivery Fees` becomes `Delivery Fees (USD)`, `Delivery Fees (EUR)`,
  etc., not one shared account.

Also confirmed: a deliberately bad entry (crediting real EUR cash
against debiting an AUD-denominated Sales Revenue for the same raw
minor units, as if €1,000 and $1,000 AUD were equal) is correctly rejected —
its EUR group and AUD group each fail to balance independently, which
is the actual mechanism catching it (not a blanket "more than one
currency present" rejection).

Stock quantities need no equivalent check: `postQuantityMovement`
already takes exactly one part/account per call, so a quantity
movement is already inherently single-unit by construction — nothing
to add there.

## The conversion transaction itself

Buying €1,000 using $1,090, with a separate, explicit delivery/handling
fee (banks that don't itemize a fee separately are a real, acknowledged
limitation — a fee is only extractable when the transaction record
actually states it; otherwise it's genuinely indistinguishable from the
market rate and must not be guessed at) — see the worked example under
"The actual validation rule" above for the exact one entry, two
currency groups this becomes.

The clearing account's two halves (€1,000 out, $1,090 in), one entry's
two independently-balanced currency groups, are the same economic event
seen from each currency's side — the implied rate (1.09) becomes the
new EUR lot's cost basis via `receiveLot`, *excluding* the fee, which
is a separate, deductible expense, not part of the commodity's cost.

## Realized gain/loss, on consumption only

When a lot is later spent or converted again, `consumeFromLots`
determines which lot's cost basis applies (FIFO). The difference between
that cost basis and what's actually realized at settlement is the
realized FX gain/loss — genuinely separate from the bank fee, arising at
a different time, taxed differently (income/gain vs. deductible
expense), posted to its own **FX Gain/Loss** account. Spending €400 of a
€1,000/$1,090 lot has a proportional cost basis of $436 (1,090 × 400 ⁄
1,000); if that €400 realizes $445, the $9 difference is the gain —
never merged with any fee.

## Three dedicated account types this requires — each currency-specific where touched by more than one currency

- **FX Conversion Clearing** — a wash; always nets to zero once both
  currency-side halves of a conversion post. Needs one variant per
  currency involved (e.g. `(EUR)`, `(USD)`), never one shared account.
- **Delivery/handling fees** — expense, deductible, posted at the time
  of conversion (or any commodity purchase). Needs a currency-specific
  variant for each currency it's actually paid in, for the same reason.
- **FX Gain/Loss** — income/loss, realized only when a lot is actually
  consumed, not at acquisition. Realized gain/loss is itself always
  expressed in the currency being settled *into* (see the worked
  example above), so this one also needs a currency-specific variant
  per settlement currency.

## Explicitly out of scope for this work

Multi-jurisdiction tax treatment (a business paying tax in more than one
country, treaty relief, etc.) is a real, separate concern about tax
*obligations*, not currency mechanics — noted for a future, dedicated
piece of work, not folded in here.

## The validation change required

`postJournalEntry`'s existing check ("sum of all lines in this entry
equals zero") becomes: join each line to its account's fixed currency,
group by that currency, and require every group to independently sum
to zero — the entry is rejected if any single group doesn't, not by
the old, currency-blind combined sum. Every function built on top of
it (`postInvoice`, `completePosSale`, stock takes, recurring journals)
inherits this automatically once the core validator changes, since they
all funnel through the same posting mechanism — they don't need
individual updates.

## UI implications

- Each journal line displays its account's currency.
- The totals block becomes one row per currency present in the entry,
  each independently showing debit/credit/balanced-or-not — not one
  combined total that would be meaningless across currencies.

## Period-end revaluation — unrealized FX gain/loss, genuinely distinct from realized

Per direct request to elaborate: everything above ("Realized gain/loss,
on consumption only") covers what happens when foreign currency is
actually spent or converted — a real cash event, locked in at that
moment. This section covers the other half, which nothing above
touches: what a business is still *holding*.

**The real accounting requirement** (IAS 21 / the equivalent under
GAAP): at each real reporting date, every real, foreign-currency
monetary balance still held (a bank account, but also real outstanding
AR/AP denominated in a foreign currency) must be revalued to the
*current, real, spot exchange rate* — not the rate it was originally
booked at. The difference between the account's own real, existing
balance (at its original, historical rate) and its value at today's
real rate is a real, genuine **unrealized** FX gain or loss, posted to
its own real "Unrealized FX Gain/Loss" line (deliberately distinct from
the realized "FX Gain/Loss" account above — different real accounts,
since most jurisdictions tax them differently, and conflating the two
would make that impossible to report correctly later).

**Why this genuinely differs from the realized mechanism, not just in
degree**:
- It's real and recurring — recomputed fresh at *every* reporting date
  (month-end, year-end, whatever the real, chosen frequency is), not a
  one-time event tied to a real transaction.
- It's real and reversing — the standard, correct practice is to
  reverse the prior period's own revaluation entry before posting a
  new one each time, so a foreign account's own, real, underlying
  balance_minor is never permanently altered by a revaluation that
  isn't a real, economic event — only the reporting-currency
  *presentation* of that balance changes.
- It applies to more than bank accounts — real, outstanding AR/AP in a
  foreign currency needs the same real treatment, not just cash. Out
  of scope for a real, first version of this (see below), but worth
  naming honestly now rather than discovering it as a gap later.

**What this genuinely needs, not yet built anywhere**:
- A real, known spot rate as of the real reporting date — connects
  directly to `curr`/`exchangerate` in `SQL_LEDGER_MAPPING.md`,
  already flagged there as 🔜 partial (validation exists, no real rate
  storage/lookup mechanism yet).
- A real "Unrealized FX Gain/Loss" account, currency-specific where
  touched by more than one currency, the same real pattern as FX
  Conversion Clearing/Delivery Fees above.
- A real, explicit *reversal* of the prior period's own entry before
  posting a new one — this is a real, genuine, correctness-critical
  detail, not an optional nicety; skipping it would silently,
  permanently distort the real account's own reported balance over
  time.

**Recommended real scope for a first version, not yet built**: bank/cash
accounts only (the real, direct question that prompted this), not yet
outstanding foreign-currency AR/AP — a smaller, real, genuinely
complete piece rather than a partial attempt at the full, real
standard. Explicitly connects to Layer 1 of
`docs/cash-flow-and-growth-planning.md` (the real bank-account
registry) — a foreign-currency bank account is exactly the kind of
account that registry needs to know about, for this reason as well as
the cash-position reason that document was written for.
