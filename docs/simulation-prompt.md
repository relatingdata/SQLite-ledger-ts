# Prompt: Wine Retail Company — Full Month Simulation

This is the single, comprehensive prompt, reconstructed after the fact,
that would have produced `simulate-wine-retail-month.ts` as it stands
today directly — synthesized from a script built incrementally across
many rounds, each correcting or extending real gaps as they were found.
Kept alongside the script itself for reference, and useful later for
explaining the simulation's design in the system manual.

---

Build a complete, realistic one-month trading simulation for "Wine
Retail Company," end to end, using this app's own real functions
(`stageLine`/`postJournalEntry`, `receiveStockAtLocation`,
`transferStock`, `completePosSale`, `createStockTake`, `closeBooks`,
etc.) — never raw SQL. Make it deterministic and re-runnable (a seeded
PRNG, not `Math.random()`), and commit it permanently rather than
treating it as a throwaway script.

**1. Capital.** The owner injects $100,000 on day 1 of the month
(debit Cash and Bank, credit Owner's Equity).

**2. The product catalog is the real one, in full — every product
actually in the seed data (36 products across wine, sparkling wine,
beer, and spirits), not a curated subset.** Classify beer and
sparkling wine *dynamically*, by walking each product's real parent
category in the entity tree (Ale/Lager/Stout → beer;
Champagne/Cava/Prosecco → sparkling), not by hardcoding specific
product names — correct regardless of which exact products this seed
data happens to contain.

**3. Purchasing is genuinely by the carton, not a raw bottle count
dressed up as one.** Register a real `part_source` row per product
(vendor, price-per-carton, package quantity) before any purchase — a
wine/spirits carton is 12 bottles, a beer carton is 24, genuinely
different constants, not a shared one. Each purchase rolls a carton
count (not a bottle count) and multiplies by that product's own real
package quantity before receiving stock. Roughly 12–22 purchases per
day across the month, each received at one of two warehouses, with
~85% of what's received distributed on to a matching-city retail
outlet shortly after (a genuine `transferStock` call, allowed to fail
silently if a concurrent transfer already took the stock — not fatal
to the simulation).

**Cold products route to a real, separate refrigerated location, not
the ordinary shelf.** Every retail outlet gets its own
`{Outlet} — Refrigerated` location (same `location` mechanism as
everything else — no new concept). Sparkling wine is always cold;
beer is cold only for Lager/Stout categories specifically (a real,
defensible distinction — ales traditionally aren't served cold).
Purchases of cold products transfer to the refrigerated location, not
the warehouse-matched ordinary outlet.

**4. Vendor bills actually get paid**, via the real, existing AP
payment mechanism (`stageApPayment`/`postApPayment`) — not simulated,
not skipped. Each purchase schedules a payment 7–21 days later (real
net-terms), posted only if that date genuinely falls within the
simulated month — a late-month purchase legitimately remains
outstanding at month-end, which is correct, not a bug.

**5. A handful of realistic breakages** — a handful of units marked
as spoiled/broken at a random retail outlet, written off against
Breakage & Spoilage with a real reason string (cork failure, dropped
in transit, etc.), skipped gracefully if there's insufficient stock
at that moment.

**6. Several thousand retail sales across the month** (80–160 per
day), 1–3 line items each, from a randomly chosen outlet.

- **Every product sells at least two ways: single bottle(s) and a
  full carton (a real, steeper discount on the carton) — beer
  additionally sells by the six-pack** (a smaller, ~8% discount vs.
  six singles), at roughly 50% bottle / 40% six-pack / 10% carton for
  beer, and 85% bottle / 15% carton for everything else.
- **A sale's line items must stay within one stock category — cold or
  ordinary — determined by whichever product is picked first**, since
  a single POS sale can only draw stock from one location; mixing
  would make a large, unrealistic fraction of multi-line sales simply
  fail rather than genuinely be rare.
- **Each line posts to that specific product's own real Sales
  account, tiered by how it was sold** (e.g. "Amber Ale 330ml
  (Six-Pack)", distinct from "... (Bottle)" and "... (Carton)") — not
  one shared aggregate revenue account. Lazily create these accounts
  on first use.
- **Real COGS matching, per product and per tier, posted separately
  from the sale itself** (since the POS mechanism only posts
  revenue/tax) — each line's own known unit cost moves from Inventory
  to that exact product-and-tier's own COGS leaf, tagged so it's
  correctly included in a real Gross Profit calculation the moment
  it's created.
- **Payment is real, not just tracked** — cash/card sales actually
  post the cash movement to Cash and Bank and reduce the customer's
  own AR-style balance, not merely mark an invoice "paid" while the
  money silently never arrives anywhere.
- Roughly 60% card, 40% cash. Sales that can't be fulfilled (insufficient
  stock at that exact moment) are counted as failures, not fatal.

**7. A few real customer returns**, as credit notes against genuine
prior sales, restocking the returned item and correctly reversing
revenue on that same product's own real Sales account (not the
aggregate).

**8. A month-end stocktake** at every location, with a small amount
of realistic random variance applied only to products that genuinely
had trading activity that month.

**9. A real year-end close** — `closeBooks` must zero *every* real,
non-zero Income/Expense account dynamically (which, given genuinely
per-product-per-tier accounts, means potentially over a hundred
accounts, not two or three aggregates), in one single, balanced
journal entry, with the net difference posted to Retained Earnings.

---

## What no prompt would have caught

Several of the costliest fixes weren't modeling choices a better
prompt could have specified upfront — they were real bugs and
architectural gaps only found by directly querying and testing the
actual posted data, not assumed correct from how the code looked:

- `allocatePayment` only ever recorded that a payment happened; it
  never posted the real GL movement, so "paid" sales never actually
  reached Cash and Bank. Found by directly comparing what should have
  been banked against what the ledger actually showed.
- `getLedgerBalances` silently excluded Customers/Vendors (they live
  outside the Chart of Accounts hierarchy), so the Trial Balance never
  actually balanced whenever real AR/AP existed — which is always.
  Found by checking whether debits equalled credits at several real
  dates, not assumed true because the mechanism looked right.
- `postInvoice` posted one lump-sum line per invoice regardless of how
  many different products were on it — the real, deeper reason
  per-product revenue was impossible anywhere in the app, not a POS-
  specific limitation.
- A sale's line items mixing cold and warm products silently made a
  large fraction of multi-line sales infeasible, since a POS sale can
  only draw from one stock location — measured directly (sales
  completed dropped by nearly half) rather than assumed fine.

None of these were things to specify in advance; they were things to
go find, by running the simulation and checking the real numbers it
produced against what should have been true.
