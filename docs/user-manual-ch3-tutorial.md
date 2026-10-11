# Chapter 3 --- Tutorial: Building a Real Wine Retail Business, Start to Finish

This chapter walks through one, single, real, worked exercise --- setting a brand-new wine retail business up entirely through this application's own real interface, from the very first login through its first real posted transactions, checking the real, live figures at each step along the way. Every numbered step below is exercised, end to end, by this project's own automated Tutorial test (`make test-e2e-tutorial-browser`, driven by `shared-fixtures/tutorial-steps.csv`) --- the same, real, data-driven test-runner described in the Programmer's Manual, never a separate, hand-maintained script. Every screenshot below is real and current, captured directly from a live, passing run of this exact tutorial. A step whose own screenhot is not shown is marked plainly, with the real reason --- either its UI path has not yet been wired into the automated test (it is still exercised at the API layer only), or a real, confirmed application bug currently blocks that one screen --- rather than shown with a stale or substitute image.

This tutorial's own business trades in a home currency (AUD) but, at creation, also nominates a further currency (NZD) it is willing to accept --- a real, further note on multi-currency follows at the end of this chapter.

## Logging in and choosing a business

Every session starts by logging in, then choosing which real business to work within --- the same account can genuinely work across more than one, real, separate business, each with its own, entirely independent books. Before this tutorial's own business exists, the current business is simply left at its default.

![The login screen.](manual-images-tutorial/login_landing.png)

## Creating the new business

**New Business**, under Configuration, is where this tutorial's own business, **Tutorial Wine Retail Business**, is created in one step: its name, the financial year (`2026-27`), its legal structure (`Sole Trader`), which Chart of Accounts prototype most closely matches its own real country or jurisdiction (`English / generic`, kept at the default throughout this tutorial, since switching it would rename every account used below), its own real home currency (`AUD`), and, optionally, any further currency it is also willing to accept cash in --- this tutorial's own business nominates `NZD` here, a real, further detail returned to at the end of this chapter.

Creating it produces both a real Actual ledger and a real Budget ledger for the financial year, immediately ready to post to, and moves directly into the same screen's own, real, post-creation banking wizard --- nominating the business's one real bank account (**Westpac Business Cheque**, BSB `032-001`, account `123456`), then building the real **Cash at Bank** structure for the one bank/currency combination this tutorial actually banks in (`AUD`).

![The business created, its banking wizard reached on the same screen.](manual-images-tutorial/new_business_created.png)

![The bank account nominated.](manual-images-tutorial/bank_account_nominated.png)

![The real Cash at Bank account structure, built for AUD.](manual-images-tutorial/bank_currency_structure_built.png)

## Switching into the new business

The session then moves into the new business --- every further step in this tutorial operates within it.

![The session switched into Tutorial Wine Retail Business.](manual-images-tutorial/session_switched.png)

## Creating the first locations

**Locations** is where a real retail outlet or warehouse is created. This tutorial's own business creates two: **Head Office**, a warehouse in Adelaide, within the Adelaide Metro division, with a 40-carton capacity and no bottle (shelf) capacity --- a warehouse genuinely tracks carton space only, never bottle space --- and **Main Street Cellar**, a retail outlet in the same city and division, with both a 120-bottle shelf capacity and a 10-carton capacity, since a real retail outlet genuinely holds both sealed cartons and loose bottles at once. Both capacities are set directly on the same screen at creation, not as a separate, later step --- the location's own opening entry posts atomically at creation, before any later step could run.

![The warehouse, Head Office, created with its own real carton capacity.](manual-images-tutorial/warehouse_created.png)

![The retail outlet, Main Street Cellar, created with its own real shelf and carton capacity.](manual-images-tutorial/retail_created.png)

## Creating the first employee

**Business Setup** is where the business's own first, real employee, **Jordan Lee**, is created, based at Head Office --- ready to receive incoming stock and later staff the retail counter.

![The business's own first, real employee created.](manual-images-tutorial/employee_created.png)

## Creating the first items and their categories

The **Items Catalog** is where a genuinely new category is created inline, and where the item itself is created on the same screen --- the category exists the moment it is typed and confirmed, with the item created directly underneath it. This tutorial's own business creates two: **Amber Ale 330ml**, under a new **Beer** category, and **Highland Single Malt 700ml**, under a new **Whiskey** category. Neither screen sets a cost or selling price yet --- no cost/price field exists here; that is set separately below, once a real supplier exists for the item to be costed against.

![Amber Ale 330ml created, under a new Beer category.](manual-images-tutorial/item_amber_ale_created.png)

![Highland Single Malt 700ml created, under a new Whiskey category.](manual-images-tutorial/item_highland_single_malt_created.png)

**A real, confirmed performance note**: at the time of this printing, creating an item on a business with a large, real chart-of-accounts/vocabulary tree could take tens of real seconds on this one screen, even though every real backend call involved returns in well under half a second --- a genuine client-side rendering defect, found and fixed during this same tutorial's own development (see the Programmer's Manual for the full, real root cause and fix).

## Posting the owner's initial cash deposit

The owner's own real capital contribution --- $5,000.00 --- is posted directly through the **General Journal**, the same, real journal every other manual transaction in this application posts through. A real, live browser session stages each line of a balanced entry separately, then posts the whole, balanced entry in one, final, separate step --- never one, combined, artificial call: a debit to **Cash and Bank**, a credit to **Owner's Equity**, each staged in turn, then posted together under the reference `JE-OWNER-CAPITAL`.

![The first line staged — Cash and Bank debited $5,000.00.](manual-images-tutorial/journal_line_1_staged.png)

![The second line staged — Owner's Equity credited $5,000.00.](manual-images-tutorial/journal_line_2_staged.png)

![The balanced entry posted.](manual-images-tutorial/journal_entry_posted.png)

## Creating the first supplier

**Vendors** is where a real supplier is created the same, direct way a customer or employee is. This tutorial's own first supplier, **Highland Brewing Co**, is created under the **Accounts Payable** parent, with just its name --- enough to place a real order against straight away.

![The new supplier, Highland Brewing Co, created.](manual-images-tutorial/provider_created.png)

## Setting the item's real cost and pack size

*Screenshot not shown --- this screen's UI path has not yet been wired into the automated Tutorial test; this step is currently exercised at the API layer only.*

Amber Ale's real cost and real pack size are registered against this specific supplier --- $84.00 per carton, 24 bottles per carton --- before a Purchase Order can be placed against it. No generic, supplier-independent cost mechanism exists: the same item can genuinely cost a different amount from a different supplier, and each is tracked separately.

## Placing the Purchase Order

*Screenshot not shown --- this screen's UI path has not yet been wired into the automated Tutorial test; this step is currently exercised at the API layer only.*

**An important, real detail, easy to get wrong**: a real order placed with a supplier is always for a whole number of real cartons --- never a raw, arbitrary bottle count. This tutorial's own Purchase Order for Amber Ale 330ml, reference `PO-AMBER-1`, is placed as 4 real cartons at $84.00 per carton --- the same, real $3.50-per-bottle cost as registered above, just expressed the way an actual invoice from a real supplier would state it.

## Receiving and paying for the stock

Receiving the order at Head Office --- through **Cash Purchase**, since this tutorial's own business pays on the spot rather than carrying an outstanding supplier balance --- brings the real, physical stock onto the books at cost, converted back to its own real, individual bottle count (96 bottles, at $3.50 each) the moment it is actually receipted, since every other real screen (Stock Transfer, POS, the Trial Balance itself) tracks real, physical stock in real, individual units throughout, never in cartons. The resulting Purchase Invoice is paid in full at the same time, reducing the real cash/bank balance directly.

![The cash purchase received and paid — 96 bottles at $3.50 each.](manual-images-tutorial/cash_purchase_done.png)

## Transferring stock from the warehouse to the retail outlet

A real stock transfer moves part of what Head Office received through to Main Street Cellar, ready to actually sell --- the same, real quantity leaving the warehouse's own stock and arriving at the outlet's own stock, never duplicated or lost in transit. This tutorial's own transfer moves 24 real bottles (one whole carton's worth) of the 96 just received, leaving 72 still at Head Office, under the reference `TRANSFER-AMBER-1`.

![The transfer completed — 24 bottles moved to Main Street Cellar.](manual-images-tutorial/transfer_done.png)

**A real, confirmed bug, found and fixed during this same tutorial's development**: the real `/stock/transfer` screen requires a non-blank Reference field even though the underlying transfer function does not itself need one (it auto-generates its own if called directly). The automated test now supplies one explicitly; see the Programmer's Manual for the full, real detail.

## Selling at the retail outlet

*Screenshot not shown --- this screen's UI path has not yet been wired into the automated Tutorial test; this step is currently exercised at the API layer only.*

A real POS sale, run twice, sells 2 bottles of Amber Ale 330ml at a time at $5.00 per bottle --- a real cost of $3.50 marked up to a real selling price of $5.00, so the live Profit & Loss shows a genuine profit once this retail markup is actually sold through.

## Creating a named customer and recording a cash sale

*Screenshot not shown --- a real, confirmed application bug currently blocks this screen's UI path (see below); this step is currently exercised at the API layer only.*

Not every real sale goes through the POS register. A local restaurant, **Riverside Restaurant**, phones in an order for half a carton (12 bottles) of Amber Ale, to be paid cash on the spot when collected. Staff takes the order directly, first creating the real, named customer account under the **Customers** parent, then recording the sale itself as a real **Cash Sale** --- the same, immediate, no-account-balance screen Cash Purchase's own counterpart.

**A real, confirmed bug, reported, not yet fixed**: the real dropdown used to choose a new entity's parent (here, `Customers`) does not always show the plain name it should. A translation/label lookup can resolve `Customers` to a long, decorated menu-help string instead of leaving it as the plain word `Customers`, which currently prevents this one step from completing through the real UI. See the Programmer's Manual for the full, real detail.

## Receiving sealed stock directly at retail, then opening a carton

*Screenshots not shown --- these screens' UI paths have not yet been wired into the automated Tutorial test; both steps are currently exercised at the API layer only.*

Highland Single Malt 700ml is received sealed directly at Main Street Cellar --- 1 carton, 24 bottles --- stored under a **Secure** storage grouping. **Open Container** then converts that one sealed carton into 24 individual, sellable bottles on the shelf --- a real, ordinary internal stock movement between the item's own "Carton" and "Bottle" forms, mirrored against the location's own storage-space accounts, with no contra accounting involved.

## Closing the books and rolling over to a new period

*Screenshots not shown --- these screens' UI paths have not yet been wired into the automated Tutorial test; all three steps are currently exercised at the API layer only.*

At financial year end, **Close Books** closes the old period's Income and Expense accounts into **Retained Earnings**, entirely within the `Actual` ledger. A new ledger, `Actual 2027-28`, is then created structurally, before any posting into it. **Rollover To New Period** then posts the real, final, balanced opening entry into the new ledger only --- the new period never references or posts against the old one.

## Reviewing the real, live figures

At any point in this tutorial --- and especially after the final sale --- the same, real reports already described elsewhere in this manual show this business's own real, current position: the General Journal for every individual posting made along the way, the Chart of Accounts for the real Sales/COGS/Inventory accounts the new products brought into existence, the Trial Balance to confirm debits and credits still genuinely balance, the Balance Sheet and Profit & Loss Statement for the business's own real financial position, and the Stock on Hand report for exactly how much real, physical stock remains at Head Office versus Main Street Cellar after the transfer and sales above.

## A further currency, nominated at business creation

This tutorial's own business, **Tutorial Wine Retail Business**, nominated a further currency --- `NZD` --- as an additional currency it is willing to accept, directly during the **Create Business** step earlier in this chapter, alongside its own home currency (`AUD`). This tutorial does not go on to actually bank or trade in that further currency --- its one real bank account and real Cash at Bank structure, built immediately afterwards, are built for `AUD` only --- but the acceptance itself is real and already exercised by this exact tutorial, not merely designed.

*The fuller mechanism --- a real Location nominating a further currency alongside the business's own home currency, and a POS terminal actually transacting in it --- is design stated here, ahead of what today's automated Tutorial test exercises; see the Programmer's Manual, `multicurrency-design.md`, for what is actually built today.* Continuing this tutorial's own worked numbers as a worked example: a further, real outlet, `Riverside Cellars`, nominates `USD` alongside its own home `AUD`; a real POS terminal at that outlet, `Border Store USD Till`, is set to transact in `USD`. This tutorial's own `Amber Ale 330ml`, already stocked and sold in the home currency earlier in this chapter, gets a further, separate, independently-set `USD` selling price and `USD` cost for this one outlet --- a real, further fact, never derived or converted from its own home-currency price and cost.

A real sale through `Border Store USD Till` posts entirely within its own real `USD` group --- Sales Revenue, Sales Tax, Cost of Goods Sold, and Cash all as `USD`-tagged siblings of their own, ordinary, home-currency counterparts --- and the Trial Balance, checked immediately after, shows this outlet's own real `AUD` and `USD` activity as two, separate, genuinely unconverted currency groups, each independently balancing on its own. The Profit and Loss statement, reviewed next, offers a choice: this same `USD` activity shown in its own real, native column, an already-converted column, or folded into one, single, converted total --- see "Reporting across more than one currency" in Chapter 2 for the full, worked account names and amounts.

\clearpage
