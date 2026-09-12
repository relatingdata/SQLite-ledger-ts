# Receipts and payments in foreign currencies

*A sanity-check pass, adapted from the structure of LedgerSMB's own book
("Running your business with LedgerSMB development", §42.8) for this
project's own, different architecture — not a copy of its text. Where
this app's design genuinely differs from LedgerSMB's, that's called out
directly rather than glossed over. This is currently a design document,
not a description of finished, shipped functionality — see "What's
built, what isn't" at the end.*

## Why this needs its own section at all

A domestic receipt or payment is simple: the amount that leaves a
customer's account is exactly the amount that lands in yours, in the
same currency, and the two real journal lines (the bank account, the
customer's real balance) always net to zero.

A foreign-currency receipt or payment breaks that symmetry. Wine Retail
Company invoices its local Danish beer suppliers in DKK, but pays its
French and German wine suppliers in EUR — and its own home currency for
reporting purposes is neither. Between the day an invoice is entered and
the day it's actually paid, the real exchange rate moves. The amount
that leaves the bank account, converted back to the business's own home
currency, is almost never exactly the amount the original invoice was
worth. That real difference has to go *somewhere* in the books, or the
fundamental accounting identity (debit = credit) breaks.

## Exchange rates

Every account in this app already carries a real, optional currency
(`account.currency`, `NULL` meaning "this account's own home currency" —
see `backend/schema.sql`'s own comment on the column, which is explicit
that this is never inferred from a locale code, only ever set directly).
Wine Retail Company's own Bank Account (DKK) and Bank Account (EUR) are
real, live examples of this already in the demo data.

What doesn't exist yet is a real place to *store* an exchange rate. The
real, honest gap: there's no `exchange_rate` table, and nothing converts
a DKK or EUR amount into the business's own home currency for reporting.
The `minor_units` convention this app already uses everywhere (an
integer count of cents, never a floating-point dollar amount) extends
naturally to this: a real exchange rate should be stored as a real,
fixed-precision rational number (e.g. `rate_numerator`/`rate_denominator`
as integers, not a float), tied to a real date, matching how this app
already refuses to let currency amounts drift through floating-point
arithmetic anywhere else.

## Exchange rate classes

LedgerSMB supports multiple named *classes* of exchange rate for the
same currency pair on the same day — a "spot" rate for actual cash
transactions and a different, officially-published rate for statutory
reporting, for example, since a real business's bank rarely trades at
the exact rate its tax authority publishes.

This app doesn't have that distinction yet, and for a business the size
of Wine Retail Company, one real, single rate per currency pair per day
is a reasonable, honest starting point — but the design should leave
room for it: a real `exchange_rate` table keyed by `(currency, date,
class)` rather than just `(currency, date)`, with `class` defaulting to
a single, real "Spot" value, costs nothing now and avoids a real,
disruptive schema change later if a business genuinely needs a second,
statutory rate.

## Foreign exchange gain and loss

When a foreign-currency invoice is finally paid, the real difference
between what the invoice was worth at the rate on its own date and what
actually moved through the bank account at the rate on payment date is
a real, realized gain or loss — not an error, not something to plug or
hide, a genuine economic fact about currency risk the business actually
carried between those two dates.

This app's Chart of Accounts doesn't yet have real "Foreign Exchange
Gain"/"Foreign Exchange Loss" leaves under Income/Expense — matching
LedgerSMB's own two-account convention (one for gains, one for losses,
so a report reader can see the direction of currency risk at a glance,
not just its net effect) is the right shape to add. Both would be real,
ordinary Chart of Accounts leaves, postable through the exact same
`stageLine`/`postJournalEntry` mechanism every other real transaction in
this app already uses — no special-cased posting path needed.

## User workflow (proposed)

Concretely, for Wine Retail Company paying a real French wine supplier
in EUR:

1. The AP Purchase invoice is entered against the vendor in EUR, using
   the real exchange rate on the invoice's own date to also compute and
   store its home-currency-equivalent value (needed so Accounts Payable
   itself, and every report that summarizes it, stays in one real,
   consistent currency).
2. On payment, the amount actually sent — genuinely 500.00 EUR, say —
   is looked up against Bank Account (EUR) directly; no conversion
   needed there, since that account's own currency already matches.
3. The vendor's own AP balance, which is tracked in the business's home
   currency, is reduced by the invoice's original home-currency-
   equivalent value from step 1 — not by re-converting the payment at
   today's rate, since the vendor was never owed a moving target.
4. Any real difference between the invoice's original home-currency
   value and what the payment, converted at *its own* real date's rate,
   was actually worth — is posted to Foreign Exchange Gain or Loss,
   whichever direction it falls, as a small, extra pair of real journal
   lines within the same posting, keeping the whole entry balanced.

This keeps every existing piece of this app's real architecture intact:
minor units throughout, no floating-point currency math, real
`division` tagging still applies to a foreign-currency payment exactly
the way it already does to a domestic one (a EUR wine purchase received
at a specific warehouse is still taggable with that warehouse's own real
division), and the posting still goes through the same, single,
already-tested `postJournalEntry` path as everything else.

## What's built, what isn't

Honestly, as of this writing:

- **Built**: per-account currency (`account.currency`,
  `setAccountCurrency`), and two real, demonstrative accounts (Bank
  Account (DKK), Bank Account (EUR)) using it.
- **Not built**: exchange rate storage of any kind, the Foreign Exchange
  Gain/Loss accounts, any UI for entering a foreign-currency invoice or
  payment, and the actual conversion/gain-loss-posting logic described
  above. The General Journal now *shows* an account's currency (a
  previous round's fix) but nothing yet lets a person actually post a
  balanced, multi-currency entry through the UI with automatic
  conversion.

This document describes the intended shape of that still-unbuilt work,
not a finished feature — a real design to build against next, not a
retroactive description of something already shipped.
