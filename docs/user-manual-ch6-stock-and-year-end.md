# Chapter 6 --- Stock, Its Cost, and the Year-End Stock Take

This chapter describes how the application works out what your stock cost
you, and how the stock take at the end of the financial year corrects the
books, how the room your stock takes up is kept, and where to see all of
it. "Which middleware runs", at the end, says which rules apply where; the
tutorials in Chapters 3 to 5 run on both.

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

The prices you pay change: the same bag of ice costs $1.00 in March and
$1.30 in April. When you sell a bag, the application has to decide which
price it cost you, because that is the sale's cost of goods sold and it
decides your profit. It uses **first in, first out** (FIFO): stock is
assumed to leave in the order it arrived, so the oldest stock goes first,
at the price it was bought at.

### Layers

Every delivery that arrives with a price (a cash purchase, a purchase on
credit, a delivery against a purchase order) is kept as a **layer**: so
many units at so much each, at that location. A location's stock of an
item is its layers, oldest first. Stock leaving (a sale, a transfer, a
write-off) is taken from the oldest layer until it is used up, then from
the next.

> **Example: one location, three events.**
>
> | Event | Layers afterwards (oldest first) | Cost of what left |
> |---|---|---|
> | Buy 10 bags at $1.00 | 10 at $1.00 | |
> | Buy 10 bags at $1.30 | 10 at $1.00; 10 at $1.30 | |
> | Sell 12 bags | 8 at $1.30 | 10 × $1.00 + 2 × $1.30 = **$12.60** |
>
> The sale's cost of goods sold is $12.60, not 12 × the latest price
> ($15.60) and not 12 × the average price ($13.80). The 8 bags left are
> worth $10.40, and that is exactly the balance of the location's
> Inventory account.

### Transfers carry their layers

Each location has its own layers. A transfer takes stock from the oldest
layers where it leaves, and it arrives as those **same layers**, at the
same prices, not as one batch at a blended price. So the oldest stock is
still the first to go at its new home too.

> **Example: the stall restocks from home.** Home holds 8 bags at $1.30
> and then buys 5 more at $1.60. It sends 9 to the Stall: the 8 at $1.30
> and 1 at $1.60, $12.00 in all. Home keeps 4 at $1.60 ($6.40). The Stall
> now holds two layers, 8 at $1.30 and 1 at $1.60, so when it sells 8 the
> cost is 8 × $1.30 = $10.40, and its last bag is still worth $1.60.

The value moves with the stock: the transfer posts $12.00 out of Home's
Inventory account and into the Stall's, so each location's books show
what its own shelves hold. A transfer is never income: no sale, no
profit, just stock and its cost changing places.

### Part of a layer

When only part of a layer leaves, it takes its share of that layer's
cost, rounded to the cent; the units left behind carry the rest, so the
last unit out takes any rounding and the layer comes to exactly what was
paid for it.

> 3 bags cost $1.00 together. Selling 2 costs $0.67; the last bag then
> costs $0.33, and $0.67 + $0.33 = $1.00.

### Write-offs and stock found

- **Write-offs** (broken, lost or expired stock) are costed the same way,
  oldest first.
- **Stock found** at a count during the year, that the books did not
  hold, is valued at the price of the most recent delivery.

### Stock with no cost recorded

Stock can arrive with no price on it: a delivery recorded as a quantity
only, or stock whose cost was entered separately as a general journal
entry against the item's Inventory account. Such a layer holds the units
but no value.

- In the **original middleware** (the screens), when none of a location's
  layers holds any value, a sale is costed at the item's registered unit
  cost (its preferred provider's price, see Chapter 2) instead; with no
  registered cost either, the sale has no cost of goods sold. A transfer
  of such stock moves no value.
- In the **new middleware**, stock with no cost recorded leaves at no
  cost.

So record the price with the delivery (a purchase, or a receipt against a
purchase order) whenever you can: the layers are then right from the
start, at every location.

### Where you see it

- **Cost of goods sold** on the Profit and Loss, and *Margin* in *Sales
  and Margin*, are the first-in, first-out cost of the units sold, at the
  location they left, so the margin is right per location.
- **What it cost** in *General Ledger → New Stock on Hand* is the value of
  the layers each location still holds.
- **The Inventory account** of an item at a location always equals the
  value of its layers there. Nothing extra is stored: the layers are read
  back from the journal itself, so they cannot drift from the books.

### At the year end

The year-end stock take replaces the layers with one average cost, as
described in "The year-end stock take" below. From then on, stock
received later forms new layers on top of that one.

> **Why first in, first out?** It matches how most businesses sell (the
> oldest stock first, before it dates or spoils), it leaves the stock you
> still hold valued at your most recent prices, and every cost can be
> traced back to the delivery it came from. FIFO is one of the usual ways
> of working out the cost of trading stock; check with your accountant
> how your business must value its stock for tax.

## Storage space: how much room is left

Each location's physical storage space is kept too, as a count of its own,
never as money: it never appears on the Trial Balance or any financial
report.

- A location is measured in **bottles** when its *bottle capacity* is set
  (a shop), and otherwise in **cartons** from its *carton capacity* (a
  warehouse). Each location has one unit, set by which capacity you gave it.
- When the location is first used, its capacity is **Installed** and all
  of it is **Remaining**.
- Every unit received there moves space from Remaining to **Occupied**,
  and every unit sold, transferred out or written off moves it back. In a
  carton location, bottles are converted with the item's own carton size
  (its preferred provider's package quantity: 12 for wine, 24 for beer).
- Installed always equals Occupied plus Remaining; the report's
  *Balanced?* column checks it.
- Nothing stops a delivery that would overfill a location: Remaining then
  goes below zero, which is how you see it.

> **Example.** Riverside is set up with a bottle capacity of 1,000. After
> receiving 360 bottles and selling 115, it shows Installed 1,000,
> Occupied 245, Remaining 755.

**Where to see it:** *Inventory → Inventory and Storage* (also a tile on
the Reports page) shows each location's Installed, Occupied and Remaining
space. *General Ledger → New Stock on Hand* shows the stock itself:
quantity, what it cost, and its value at retail.

## Seeing stock and margins by item and location

*New Stock on Hand* (General Ledger menu) and *Sales and Margin*
(Accounts Receivable menu) break
their figures down by any two of Item, Category, Location and your own
hierarchies (such as Division). Drag a field into **Rows** or **Columns**,
or click it; drag it back, or click it, to remove it. An empty zone means
"all together". The ⇄ button swaps rows and columns, and the list under
each zone narrows it to one value.

Each row is shaded from red (its weakest cell) to green (its strongest),
so an item's under-performing and excellent locations stand out; swap the
axes to see each location's best and worst items. Click a column heading
(Sales, Margin %, Qty, ...) to shade by that figure instead. Two fields of
the same kind, such as Item and Category, cannot be crossed: the one you
drop bounces back.

Cost of goods sold in *Sales and Margin* is the first-in, first-out cost
of the units sold at that location, so margin is shown per location.

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

The middleware is the set of business rules that turns what you enter on
a form into journal entries and records. There are two. The new one is
used by the step runner and by a backend started with `MIDDLEWARE=core`;
the web and terminal screens otherwise still use the original one.

Both cost stock first in, first out, and in both a transfer carries its
layers to the location it arrives at. In the original middleware this
covers point-of-sale sales (cash sales included) and transfers between
locations. Write-offs, deliveries against sales orders, and sales of items
set up in sizes or other variants still use the item's registered unit
cost (its preferred provider's price), and so does stock that arrived
with no cost recorded ("Stock with no cost recorded", above).
The year-end count is available through the new middleware's calls —
`getStockTakeSheet`, `confirmStockCount` and `completeYearEndStockTake` —
ready for a terminal or phone screen; those screens are still to be built.

\clearpage

