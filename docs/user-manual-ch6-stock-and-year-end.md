# Chapter 6 --- Stock, Its Cost, and the Year-End Stock Take

This chapter describes how the application works out what your stock cost
you, and how the stock take at the end of the financial year corrects the
books. It applies to the new middleware (see "Which middleware runs" at the
end of this chapter); the tutorials in Chapters 3 to 5 run on both.

## Start small: one item, one place

The smallest business this application serves is a sole trader who buys
ice and sells it for cash. He needs one item, `Ice`, and nothing else: no
locations, no categories, no customers. Buying 50 bags at $1.00 and selling
40 at $2.00 gives him one Sales account, one Cost of Goods Sold account and
one Inventory account, each simply called `Ice`, and a profit of $40.00.

Even so, he should set up two locations — **Home** and **Stall**, say —
as soon as he keeps stock in both. The application then keeps a separate
count and a separate value for each place, so he can see what is left at
the stall at the end of the day and what is still in the freezer at home,
and a stock take can be checked place by place. Nothing else changes: the
same purchase and sale screens simply ask which location.

## What stock costs: first in, first out

Every time stock arrives with a price — a cash purchase, a purchase on
credit, a delivery against a purchase order — that delivery is kept as a
**layer**: so many units at so much each, at that location.

When stock leaves — a sale, a transfer to another location, a write-off —
it is taken from the **oldest** layer first, at the price that layer was
bought at. This is called *first in, first out* (FIFO).

> **Example.** The stall buys 10 bags at $1.00, then 10 more at $1.30, and
> sells 12. The cost of those 12 is 10 × $1.00 + 2 × $1.30 = $12.60. The 8
> bags left are valued at $1.30 each, $10.40 in all.

- **Transfers** between locations carry their layers with them. If 9 bags
  leave Home — 8 bought at $1.30 and 1 at $1.60 — they arrive at the Stall
  as those same two layers, not as 9 bags at a blended price.
- **Write-offs** (broken, lost or expired stock) are costed the same way:
  oldest first.
- **Stock found** at a count during the year is valued at the price of the
  most recent delivery.
- Nothing extra is stored for any of this. The layers are read back from
  the journal itself, so they always agree with the Inventory account.

## The year-end stock take

At the end of each financial year the business counts what it actually
holds. The books are only as true as that count, so it matters.

The count is taken **item by item, location by location**. For each line
the application shows what the books say is there and lets you confirm the
real figure.

At the year-end stock take:

- **Every line is recorded**, even when the count agrees with the books.
- **A difference is valued at the average cost** of what was held at that
  location — not at the oldest price. Missing stock is written off; extra
  stock found is written on.
- **From the count onwards, the stock is held at one average cost.**
  For example, 5 bags left at $1.00 and 10 at $1.60 become 15 bags at $1.40.
  The new year starts from that figure.

### Three ways to confirm the count

1. **At the point of sale.** A terminal at each location lists that
   location's lines; staff enter the number counted for each item.
2. **On a phone.** Someone walking the shelves confirms each line in the
   same way. Leaving the number empty confirms what the books say.
3. **Automatically.** Every line not yet confirmed by hand is confirmed at
   the books' quantity in one go. This suits a sole trader whose stock
   barely changes, or the slow-moving lines of a larger business.

You can mix the three: count the busy lines at the terminal, a few on the
phone, and confirm the rest automatically. A line counted twice keeps the
later count.

> **Does a small business have to count at all?** In Australia, a small
> business may not need a formal stocktake if it estimates, in good faith
> and in a way it can explain to the ATO, that the value of its stock
> changed by $5,000 or less over the year (see the ATO's *simplified
> trading stock rules*). The automatic option records that estimate as the
> count. Check with your accountant before relying on it.

### Trading carries on while you count

Businesses rarely stop trading to count. The application lets you open
the new financial year straight away — the new ledger starts with the
quantities and values the books held — and keep selling in it while the
count is finished.

When a count confirmed later differs from the books, **both years are
corrected**:

- **The old year** gets the write-off (or write-on), dated at the year end,
  so its profit and its closing stock are right. If its books were already
  closed, the difference is closed into Retained Earnings as well, so the
  old year still balances.
- **The new year** gets the same correction to its *opening* stock —
  quantity and value — against Retained Earnings, not against this year's
  profit. Sales already made in the new year are not changed.

> **Example.** The books held 15 bags worth $21.00 (an average of $1.40)
> when the new year opened, and 3 have been sold since. The count, as at
> the year end, finds 13. The old year writes off 2 bags at $1.40: its
> profit falls by $2.80. The new year's opening stock falls by the same 2
> bags and $2.80, against Retained Earnings; its own profit is untouched,
> and it now holds 10 bags.

Count as at the year-end date. If the count is taken a few days later,
allow for what was sold or received in between before confirming it.

## Which middleware runs

The rules above belong to the new middleware: the business rules that turn
what you enter on a form into journal entries and records. Today the step
runner, and the backend started with `MIDDLEWARE=core`, use it; the web
and terminal screens otherwise still use the original middleware, whose
cost rules differ (it costs a sale at the item's registered unit cost).
The year-end count is available through the new middleware's calls —
`getStockTakeSheet`, `confirmStockCount` and `completeYearEndStockTake` —
ready for a terminal or phone screen; those screens are still to be built.

\clearpage

