# Multi-Currency Design

Status: partially built, confirmed directly, not the blanket "not yet
implemented" this document previously claimed. Real, already-built:
`account.currency` (the schema column), `setAccountCurrency` (sets
it), the core validator itself (`post_journal_entry_insert`
already groups by `COALESCE(account.currency, '')` and requires each
group to independently balance to zero — the single most important
piece of this whole design), and, as of the exchange-rate work below,
each real currency pair's own, independently-configured buy and sell
rate (`ensureCurrencyPair`, `setCurrencyExchangeRate`,
`getCurrencyExchangeRate`, `listCurrencyPairs`, all in
`backend/src/db.ts`). Genuinely still not built: a `business`
extension table for `home_currency`/`country` (no such table exists),
and both realized and unrealized gain/loss on an actual currency
purchase/sale transaction (the prototype below proves the arithmetic;
no production function yet posts a real currency purchase or
realization entry end to end). This document remains the single source
of truth for the *remaining* design; the prototype
(`backend/scripts/prototype-multicurrency.ts`) tests the not-yet-built
parts against real numbers before any further schema/migration work.

## Exchange rates are a cartesian product, not one rate per currency

Per direct instruction, confirmed and built directly: with N real,
distinct currencies genuinely in use, there are N*N real, ordered
(From, To) pairs - N of them trivial self-pairs (a currency's own rate
against itself, always, definitionally 1), leaving N*(N-1) real,
distinct, independently-configurable rates. Three currencies spanning
a real US/Canada/Europe-trading business (USD, CAD, EUR) means 9 total
pairs, 3 trivial, 6 real ones - each with its own, real, independently
set buy and sell price, never derived from its reverse pair or from
some other pair's rate.

Built by directly reusing the exact, same Hierarchy/Product cartesian
mechanism already proven for wine combinations (see
`docs/cartesian-account-linking-plan.md`): a currency pair is a real
Product Instance whose own two dimensions ("From Currency," "To
Currency") both point at the exact, same real "Currency" Hierarchy
grouping - `defineProductShape` already supported this without any
change at all. Buy and sell prices per pair reuse `item_source`
directly (two real, standing vendor rows, "FX Market (Buy)" and "FX
Market (Sell)," keyed by the pair's own real `product_instance_id`) -
the exact, same mechanism any other item's own, independently-priced
sources already use, per the core, direct instruction this whole
document is built on: buying or selling a currency is no different
from buying or selling any other item.

See `ensureCurrencyPair`, `setCurrencyExchangeRate`,
`getCurrencyExchangeRate`, and `listCurrencyPairs`, all in
`backend/src/db.ts`, and the real, direct test proving all of the
above (6 real, distinct, independent rates; 3 real, trivial self-pairs;
a rejected attempt to configure a self-pair) in `backend/test/db.test.ts`.

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
  `receiveLot`, with the lot's own, real, new `cost_basis_minor` column
  (added directly for this — NULL and unused for every existing, real
  wine/item lot, whose own value already lives in the real Inventory
  account's own balance, never per-lot) holding what was actually paid
  to acquire it (a real transaction amount, never a synthetic
  mid-market rate).
- Spending or converting foreign currency consumes lots via the
  existing `consumeFromLots` — genuine, deterministic FIFO by real
  acquisition order (`id ASC`, added directly as a real, needed
  tiebreaker: wine's own FIFO is by expiration date, which a currency
  lot never has, so every currency lot ties on a NULL expiration_date
  and needs its own, real, distinct ordering to mean anything).
  `consumeFromLots` returns each consumed lot's own, real, proportional
  share of `cost_basis_minor` directly, the one, real number an actual
  FIFO gain/loss calculation on a real currency sale needs — still not
  wired into a real, production purchase/sale posting function end to
  end (see the Status line above).

## Where currency lives, and precedence

*Corrected against the real, current schema: this section originally described `division`/`business`/`contact` as separate extension tables, following what was, at the time, an established pattern. That pattern no longer exists --- this codebase now has exactly 4 permanent tables (`entities`, `account`, `journal`, `journal_line`; see `check-schema-table-count.ts`), and every 1:1 extension (`contact`, `item_source`, `stock_lot`, and others) lives in `entities.detail_json`, read through a compatibility view. Anything below following the old "separate extension table" language needs the same treatment.*

Real, operational currency facts exist at exactly two levels, checked in this order for any given journal line — **Division and Category are deliberately absent from this list**: both are pure reporting rollups (see below), never operational units, and never nominate a currency of their own.

1. **Location** — the real, operational unit. A location's own `detail_json` (the same, established mechanism `contact` already uses) carries a real **set** of currencies it actually trades in, not a single value — nearly every location's set is just its business's own home currency; a location genuinely near a national border, or one that otherwise takes real cash in another currency, adds that currency explicitly, alongside the home one, via `nominateLocationCurrency` (read back with `getLocationCurrencies`). A specific sale (through a specific POS terminal, or otherwise) resolves to one of this set. Every real, named POS terminal a location has, each with its own real, resolved currency, is listed with `listPosTerminals`.
2. **Business** — a real `home_currency` in the business entity's own `detail_json`, set with `setBusinessHomeCurrency` and read with `getBusinessHomeCurrency`. The default/reporting currency, and the fallback whenever nothing more specific applies.

**Account** and **Contact** currency (a `currency` column on `account`, matching a debtor/creditor's own currency on `contact`) remain real, existing, useful facts in their own right --- an account inherently foreign-currency regardless of location (a USD bank account an otherwise-AUD business happens to hold), or a debtor whose own currency is worth recording even when booked through a home-currency location --- but they are not part of the *sale-currency resolution chain* above; that chain resolves what currency a given transaction happens in, which then determines which of an account's own real, currency-tagged siblings (below) it actually posts to.

**Division and Category are real, pure reporting rollups, never operational units, and never nominate a currency of their own** --- exactly parallel to each other: Division sits over Location the same structural way Category sits over Item/Product. A Division's own currency exposure, wherever a report shows one, is simply the aggregate of whatever its real, child Locations actually did; a Category's is the aggregate of whatever its real, child Items actually did. Neither is asked to nominate anything at setup time.

**Buying and selling in a foreign currency are two separate, independent facts for the same item or category.** A category (or item) can be genuinely multi-currency on the *purchasing* side --- sourced from an overseas vendor, invoiced in a real, foreign currency, via that item's own `item_source` row --- without being multi-currency on the *selling* side at all, if every location that sells it only ever nominated the home currency. Neither implies or requires the other; they are read from two, real, separate places (`item_source.currency` for purchasing, a location's own nominated set for selling), never derived from one another.

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
- **Retained Earnings** — confirmed, per direct instruction: year-end
  close (`closeBooks`) must zero a real, foreign-currency Income/
  Expense account into its own, real, currency-tagged Retained
  Earnings sibling (e.g. `Owner's Equity (USD)`), never the plain,
  home-currency one — the exact, same, real reason every other
  currency-touched account already needs this. Converting a real,
  accumulated foreign-currency Retained Earnings balance into the home
  currency is never automatic, and never happens as part of closing
  the books — it is a real, later, deliberate, manual journal entry,
  at whatever real rate the business operator actually achieves,
  realizing a genuine foreign-currency trading gain or loss at that
  moment (the exact, same, real "operator discretion, not automatic
  conversion" principle already established for banked foreign cash
  above), posted through the exact, same, real FX Gain/Loss mechanism
  this section already describes.

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
the old, currency-blind combined sum.

**Correction, found directly, the hard way: the validator alone does not make a caller correct.** An earlier version of this section claimed every function built on top of the validator (`postInvoice`, `completePosSale`, stock takes, recurring journals) "inherits this automatically... they don't need individual updates" — this is wrong, and a confirmed, real naming mismatch was direct, live evidence of exactly why: business setup (`setup/new-business`) correctly created real, currency-tagged `"Cash at Bank ({currency})"` accounts, per the design below, but `completePosSale` originally posted every real sale to a plain `"Cash and Bank"` instead — a different, real, existing account name that the currency-tagged accounts were never wired to at all. **Fixed directly**: `completePosSale` now resolves every real, foreign-currency payment through `ensureCurrencyAccount` (a real, direct, currency-specific sibling of any given base account, resolved by the base account's own real id — never by name alone, since this system's own scoped-uniqueness design allows the same name at genuinely different parent levels), using `ensureCashAtBankAccount` to create `"Cash at Bank"` itself the first time it's genuinely needed (matching `createBusiness`'s own, already-established secondary-currency pattern exactly). What remains a real, open question, not resolved here: whether `"Cash and Bank"` in the real, live Chart of Accounts data is meant to be `"Cash at Bank"`'s own home-currency child, or a genuinely separate, pre-existing account needing its own reconciliation — it touches real, live financial data across every country's own CoA family, not just this one business, and is not something to rename unilaterally. What is settled: the validator only *rejects* an entry that doesn't balance per currency once a caller has *chosen* which accounts to post to; it does nothing to make that choice correct in the first place. A caller genuinely posting a foreign-currency transaction must itself resolve every touched account (Revenue, Tax, COGS, Cash — not the cash leg alone) to its own real, currency-tagged sibling, consistently, or the entry either fails to balance (if only some legs are tagged) or silently, wrongly posts as if it were home-currency (if none are).

## "Cash at Bank" is a real header, not one flat account — currency, and where relevant bank, are real, further dimensions underneath it

Per direct correction: `"Cash at Bank"` genuinely may or may not be a postable account by itself. In the ordinary, single-currency, single-bank case, it can be one, plain, postable account, same as any other. The moment a business holds more than one real currency, or banks with more than one real institution (common the moment more than one jurisdiction is involved), it becomes a real **header** — a parent, non-postable category — with the real, postable accounts living underneath it as a cartesian product, exactly the same, established structural pattern this codebase already uses for Product × Tier and (see below) Location × StorageType:

```
Cash at Bank (header)
├── AUD                              — one currency, one bank: a plain child
├── EUR
├── CAD
└── (if banking with more than one institution per currency)
    Westpac (AUD)
    Westpac (USD)
    HSBC (EUR)
    HSBC (GBP)
```

A business with one bank and one currency needs none of this — `"Cash at Bank"` stays a single, plain, postable account, exactly as today. The header/cartesian shape only actually materializes once a second currency or a second bank is genuinely added, following the same "don't build structure nobody asked for yet" principle the rest of this codebase's cartesian mechanisms (currency pairs, product combinations) already follow.

### The setup flow this drives, and where each real fact is stored

Per direct instruction, business creation asks, in order, right after home currency: how many real banks (one bank name/BSB-or-equivalent/account-number per real account, however many are nominated); how many real currencies; then presents the real bank-accounts × currencies grid so only the real, genuinely-held combinations get ticked, not the full cartesian product blindly. Each real bank account's own name, routing identifier (BSB in Australia; the country-appropriate equivalent elsewhere — sort code, routing number, IBAN), and account number live in that bank-account entity's own `detail_json`, the same, established, real mechanism `contact`/`item_source` already use — never a new table. A ticked cell in the grid is what actually creates the real, postable `"Cash at Bank"` cartesian child for that one, specific bank-account/currency combination; an unticked cell creates nothing.

**The exact, same real mechanism applies to each partner's own drawing account**, for a business structured as a partnership — a partner can genuinely be paid out through more than one real bank account or in more than one real currency exactly as the business itself can, so each partner's own drawing account gets its own real bank-accounts × currencies grid, ticked independently of the business's own.

## A fully worked example — Item creation through Trial Balance to Profit and Loss

Per direct instruction: the exact, concrete chain, real account names and real amounts throughout, not description in the abstract.

**Setup, once:**
- Business `Wine Retail Business`, home currency `AUD`.
- Location `Riverside Cellars` nominates `USD` as a further trading currency, alongside its own home `AUD` (a real, border-town outlet).
- A real POS terminal, `Border Store USD Till`, at `Riverside Cellars`, resolves to `USD` (`setTerminalCurrency`).
- Item `Amber Ale 330ml`, sold as a real `Bottle` tier. Two, real, independent `item_source` rows exist for it — its ordinary, domestic vendor cost in the home currency (`AUD`, $3.00/bottle), and a further, separately-registered `USD` cost ($2.00/bottle) for this location's own USD-denominated reporting — per "buying and selling are two separate, independent facts," neither derived from the other.
- Its own USD selling price, in `item_source` too, is $5.00/bottle; tax is $0.50.

**One real sale, through `Border Store USD Till`, one bottle:**

```
Real accounts touched, every one of them a real, currency-tagged
sibling of its own, ordinary, home-currency counterpart — never the
plain, un-tagged account, and never converted:

Debit  Cash at Bank (USD)                              $5.50
Credit Amber Ale 330ml (Bottle) — Riverside Cellars (USD)      $5.00   [Sales Revenue]
Credit Sales Tax Payable (USD)                                 $0.50

Debit  Amber Ale 330ml — Riverside Cellars (USD)        $2.00        [Cost of Goods Sold]
Credit Amber Ale 330ml — Riverside Cellars Inventory (USD)      $2.00
```

Both real legs — the sale itself, and its own COGS/Inventory counterpart — are separate, real journal entries (matching this codebase's own, existing, established two-entry pattern for a POS sale), and each one, independently, balances entirely within its own real `USD` group: $5.50 = $5.00 + $0.50 in the first; $2.00 = $2.00 in the second. Nothing here touches, mixes with, or converts to the plain, home-currency `AUD` accounts for this same item at this same location — those stay exactly as they were, genuinely untouched by this one, real, foreign-currency sale.

**On the Trial Balance**, as of the date of this sale, `Riverside Cellars`'s own real accounts show two, separate, genuinely unconverted currency groups, each independently balanced — `AUD` (everything else this location has ever done) and `USD` (this sale, and any other real USD activity), never combined, never converted, exactly per "the Trial Balance never converts anything" above.

**On the Profit and Loss statement**, this same $5.00 of USD revenue and $2.00 of USD COGS appears three different ways depending on which of the three real views (above, under "Reporting across more than one currency") is chosen: as its own, real, native `USD` column-pair alongside a converted total; as an already-converted `USD`-into-`AUD` column-pair (at whatever spot rate is in effect when the report is generated) alongside a total; or folded, already converted, into one single, combined column-pair with no per-currency breakdown at all. In every one of the three, the $5.00/$2.00 figures used for conversion are these same, real, native `USD` amounts — never a re-derived or re-estimated number.

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
