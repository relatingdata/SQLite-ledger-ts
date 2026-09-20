# Chapter 3 --- Tutorial: Building a Real Wine Retail Business, Start to Finish

This chapter walks through one, single, real, worked exercise --- setting a brand-new wine retail business up entirely through this application's own real interface, from the very first login through its first real posted transaction, checking the real, live figures at each step along the way. Every screenshot below is real and current, captured directly from a live run of this exact tutorial; a step whose own screenshot was not yet available at the time of this printing is marked plainly below, rather than shown with a stale or substitute image.

## Logging in and choosing a business

Every session starts by logging in, then choosing which real business to work within --- the same account can genuinely work across more than one, real, separate business, each with its own, entirely independent books.

![The login screen.](manual-images/t01_login_landing.png)

## Creating the new business

**New Business**, under Configuration, is where this tutorial's own business is created --- a real name, a real financial year, which existing Chart of Accounts family most closely matches this business's own real country or jurisdiction, and its own real home currency (the currency its reports are expressed in --- this tutorial's own business trades only in its home currency throughout, so nothing further is nominated here; a business that also needs to bank or trade in a further currency is covered separately, at the end of this chapter).

![The New Business form, filled in for this tutorial's own business.](manual-images/t02_new_business_form.png)

Creating it produces both a real Actual ledger and a real Budget ledger for the financial year, immediately ready to post to --- and points to exactly what to do next: post the owner's own capital contribution, then set up real locations and staff.

![The new business created, with its own real, immediate next-steps guidance shown directly on screen.](manual-images/t03_new_business_created.png)

## Creating the first location

Switching the active session into the new business, **Locations** is where a real retail outlet or warehouse is created --- starting empty, for a genuinely new business.

![Locations, empty, for a genuinely new business with nothing set up yet.](manual-images/t04_locations_empty.png)

**+ New Location** opens a real, inline form --- a name, a real city (locations sharing a city can transfer stock directly between each other), and a real, user-extensible type (Retail and Warehouse exist from the start; a business can add its own, further real kinds directly from this same form --- a wine bar, a pop-up stall, whatever a real business actually needs, never a fixed, closed list).

![The new-location form, filled in for this tutorial's own first retail outlet.](manual-images/t05_locations_new_form.png)

## Setting the location's own real shelf capacity

Immediately after creation, the location's own real shelf capacity (bottles) and carton capacity are set directly on the same screen, then saved — ready for the location's own real stock levels to be tracked against once product arrives. This tutorial's own outlet needs only ordinary, room-temperature shelving; a location that also needs real, separate refrigerated capacity adds that as its own, further real facet of the same location, covered separately, later in this chapter.

![The new location created, with its own real shelf and carton capacity now set.](manual-images/t06_locations_created.png)

## A real location can have more than one real address

The same, real, typed-address mechanism already used for a customer or vendor (Chapter 2) applies directly to a location too --- genuinely useful the moment a shop's own, real, physical layout is more than a single front door. Take a real, common case: a retail premises with its own real street address for customers out front, and a separate, real rear "store room" whose own back door opens onto a lane with a genuinely different address --- exactly where a delivery driver actually needs to be sent, not the shop's own, public-facing front address.

Selecting the location and adding a second, real address here --- one tagged **Registered Office** (or simply left as the location's own, primary address) for the shop front, a second, real one tagged **Delivery** for the lane-facing store room --- means staff, and a real delivery driver told which address to use, have the correct, physical door recorded directly against this location, not just the one customers walk through. Nothing here is location-specific plumbing built just for this case: it is the identical, real mechanism (`addTypedAddress`) already covering customers, vendors, and employees, applied to one more real, structural kind of entity. A real, honest note: no order-entry screen currently reads this typed address automatically to pre-fill a delivery instruction --- recording it here is real and available today; wiring a purchase order to pull it in directly is real, separate, future work.

## Creating the first division, warehouse, and employee

**Business Setup** is where a business's whole, real structure is set up in one place: a division (a real profit or cost center, purely a reporting grouping), a warehouse location within it, and the business's own first, real employee, all through the same, real Insert/Delete keyboard pattern described in Chapter 2.

![Business Setup, ready for this tutorial's own business structure.](manual-images/t07_business_setup_landing.png)

![The first division created.](manual-images/t08_first_division_created.png)

![The first warehouse created within that division.](manual-images/t09_first_warehouse_created.png)

![The business's own first, real employee created.](manual-images/t10_first_employee_created.png)

## Creating the first item category and item

The **Items Catalog** is where a genuinely new category is created inline, and where the first real item itself is created — starting empty, for a genuinely new business's own real, separate catalog.

![The Items Catalog, empty, for a genuinely new business with no items yet.](manual-images/t11_items_empty.png)

Creating a new category and the first real item happens on the same screen — the category exists the moment it's typed and confirmed, with the item created directly underneath it. A category isn't limited to one, single level either — a deeper structure (a broad category, a real product underneath it, then the actual sellable item beneath that) is just as valid, and reporting (see Chapter 2) walks whatever real depth genuinely exists.

![The new-category and new-item form, filled in for this tutorial's own first item.](manual-images/t12_new_category_and_product_form.png)

Setting a real cost and a real selling price here doesn't itself create any Sales/COGS/Inventory account yet — those are genuinely created lazily, the first time a real transaction (a purchase, a sale, a stock movement) actually needs one, mirroring the item's own real category structure automatically at that point. Nothing further needs setting up separately before the item can actually be bought, stocked, and sold — the accounts simply appear, correctly placed, exactly when they're genuinely needed.

![The first item created.](manual-images/t13_first_product_created.png)

## Posting the owner's initial cash deposit

The owner's own real capital contribution is posted directly through the **General Journal**: a debit to the real cash/bank account matching the chosen Chart of Accounts family, credited to the matching real equity account. This is the same, real journal every other manual transaction in this application posts through.

![The General Journal, empty, ready for this tutorial's own first transaction.](manual-images/t14_general_journal_empty.png)

![The General Journal, filled in — cash debited, Owner's Equity credited.](manual-images/t15_general_journal_filled.png)

![The transaction posted.](manual-images/t16_general_journal_posted.png)

Immediately afterwards, the Trial Balance shows exactly this: the real cash account and the real equity account, each for the same amount, genuinely balanced.

![The Trial Balance, showing the owner's own real capital contribution, balanced.](manual-images/t17_trial_balance_after_first_transaction.png)

## Creating the first supplier

*[Screenshot not yet captured for this printing --- Vendors is where a real supplier is created, the same way a customer or employee is: a name, and, optionally, a real address, phone number, and named contact person.]*

## Purchase order, receiving stock, and paying the invoice

*[Screenshot not yet captured for this printing --- a real Purchase Order is raised against the new supplier for the new product; receiving it at the warehouse brings real, physical stock onto the books at cost; the resulting Purchase Invoice is then paid in full, reducing both the real cash/bank balance and the real, outstanding vendor balance together.]*

## Transferring stock from the warehouse to the retail outlet

*[Screenshot not yet captured for this printing --- a real, partial stock transfer moves a portion of what the warehouse received through to the retail outlet, ready to actually sell --- the same, real quantity leaving the warehouse's own stock and arriving at the outlet's own stock, never duplicated or lost in transit.]*

## Selling at the retail outlet

*[Screenshot not yet captured for this printing --- a real retail sale, run more than once, sells real stock at the retail outlet's own real selling price. Selling price and cost move together throughout this tutorial's own worked numbers: a real cost of \$8.80 per bottle marked up 25\% gives a real selling price of \$11.00 per bottle --- the real, live Trial Balance continues to balance after every one of these postings, and the real, live Profit \& Loss shows a genuine profit once the retail markup has actually been sold through.]*

## Reviewing the real, live figures

At any point in this tutorial --- and especially after the final sale --- the same, real reports already described elsewhere in this manual show this business's own real, current position: the General Journal for every individual posting made along the way, the Chart of Accounts for the real Sales/COGS/Inventory accounts the new product brought into existence, the Trial Balance to confirm debits and credits still genuinely balance, the Balance Sheet and Profit \& Loss Statement for the business's own real financial position, and the Stock on Hand report for exactly how much real, physical stock remains at the warehouse versus the retail outlet after the transfer and sales above.

## A further location, trading in a real, further currency

*Design stated here, ahead of the mechanism it describes --- see the Programmer's Manual, `multicurrency-design.md`, for what's actually built today.*

A business genuinely near a national border --- or one that otherwise expects real cash in another currency --- nominates that further currency on its own real Location, alongside its own home currency, rather than on the business as a whole. Continuing this tutorial's own worked numbers: a further, real outlet, `Riverside Cellars`, nominates `USD` alongside its own home `AUD`; a real POS terminal at that outlet, `Border Store USD Till`, is set to transact in `USD`. This tutorial's own `Amber Ale 330ml`, already stocked and sold in the home currency earlier in this chapter, gets a further, separate, independently-set `USD` selling price and `USD` cost for this one outlet --- a real, further fact, never derived or converted from its own home-currency price and cost.

A real sale through `Border Store USD Till` posts entirely within its own real `USD` group --- Sales Revenue, Sales Tax, Cost of Goods Sold, and Cash all as `USD`-tagged siblings of their own, ordinary, home-currency counterparts --- and the Trial Balance, checked immediately after, shows this outlet's own real `AUD` and `USD` activity as two, separate, genuinely unconverted currency groups, each independently balancing on its own. The Profit and Loss statement, reviewed next, offers a choice: this same `USD` activity shown in its own real, native column, an already-converted column, or folded into one, single, converted total --- see "Reporting across more than one currency" in Chapter 2 for the full, worked account names and amounts.

\clearpage
