# Chapter 3 --- Tutorial: Building a Real Wine Retail Business, Start to Finish

This chapter walks through one, single, real, worked exercise --- setting a brand-new wine retail business up entirely through this application's own real interface, from the very first login through its first real posted transactions, checking the real, live figures at each step along the way. Every numbered step below is exercised, end to end, by this project's own automated Tutorial test (`make test-e2e-tutorial-browser`, driven by `shared-fixtures/tutorial-steps.csv`) --- the same, real, data-driven test-runner described in the Programmer's Manual, never a separate, hand-maintained script. Every screenshot below is real and current, captured directly from a live, passing run of this exact tutorial. A step whose own screenshot is not shown is marked plainly: most run through the real UI the same as every other step, simply with no screenshot yet configured for them; exactly one (creating a new ledger at rollover) has no UI screen at all, by design --- the only place a new ledger is ever created is inline, as part of the Rollover screen's own flow, so that one step runs at the API layer directly.

This tutorial's own business trades in a home currency (AUD) but, at creation, also nominates a further currency (NZD) it is willing to accept --- a real, further note on multi-currency follows at the end of this chapter. It also, deliberately, starts from as little real structure as a business can have --- one location, one item, no divisions, no categories --- trades like that for real, for the last two months of its very first financial year, then genuinely closes its books and rolls over into a new one, before growing into a proper multi-location wine retailer, through the real **Business Structure** popup, rather than arriving already fully built.

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

## Posting the owner's initial cash deposit

Before any real trading, the owner's own real capital contribution --- $5,000.00 --- is posted directly through the **General Journal**, the same, real journal every other manual transaction in this application posts through. A real, live browser session stages each line of a balanced entry separately, then posts the whole, balanced entry in one, final, separate step --- never one, combined, artificial call: a debit to **Cash and Bank**, a credit to **Owner's Equity**, each staged in turn, then posted together under the reference `JE-OWNER-CAPITAL`. A real business needs cash on hand before it can buy anything, so this now genuinely comes first --- ahead of any location, any employee, any item.

![The first line staged — Cash and Bank debited $5,000.00.](manual-images-tutorial/journal_line_1_staged.png)

![The second line staged — Owner's Equity credited $5,000.00.](manual-images-tutorial/journal_line_2_staged.png)

![The balanced entry posted.](manual-images-tutorial/journal_entry_posted.png)

## Opening with one location and one item

A business starts with one location selling one item --- not a fully-built org chart. **Locations** creates **Main Street Cellar**, a retail outlet in Adelaide, with its own real 120-bottle shelf capacity and 10-carton capacity, set directly on the same screen at creation. It has no division at all yet --- the division field is simply left blank --- since this business genuinely has no further structure to put it in.

![The retail outlet, Main Street Cellar, created with its own real shelf and carton capacity, no division yet.](manual-images-tutorial/retail_created.png)

The **Items Catalog** then creates the simplest possible item: a block of **Ice**, with genuinely no category at all --- not even a "General" catch-all. The system itself must be able to operate with zero hierarchy (no categories, divisions, or profit centers), and this is the real, live proof: the "+ Item (no category)" action adds Ice directly under the Items root, no category ever created or selected.

![Ice created, with no category at all.](manual-images-tutorial/item_ice_created.png)

The owner runs this single-item Ice stall for real, for the last two months of this first financial year, before building anything further. **Cash Purchase** brings in 1,000 bags of Ice at $1.00 each ($1,000.00 total), paid cash on the spot --- booked straight to Ice's own real Inventory account, an asset, since Ice has never been given a registered unit cost (that comes later, for Amber Ale and Highland Single Malt) and so earns no automatic Cost of Goods Sold leg here. **Cash Sale** then sells all 1,000 bags straight back out at $2.00 each ($2,000.00 total), recognized as pure Sales revenue --- the first real revenue this business has ever recorded, before it has grown into anything more than a single location and a single item.

![The Ice stock purchased for cash, 1,000 bags at $1.00 each.](manual-images-tutorial/cash_purchase_ice_done.png)

![The Ice sold for cash, 1,000 bags at $2.00 each.](manual-images-tutorial/cash_sale_ice_done.png)

There is one further real cost for these same two months, posted the same way the owner's own capital was: $100.00 of rent, through the **General Journal** --- a debit to **Rent**, a credit to **Cash and Bank**, staged in turn and posted together under the reference `JE-ICE-RENT`. This is the stall's first real expense that isn't simply the cost of what it sold.

![The rent expense staged and posted.](manual-images-tutorial/rent_expense_posted.png)

## Closing the books on the Ice business's own first year

Before growing any further, the owner stops and genuinely closes the books on these first two months of trading --- the real year/period rollover procedure, exercised here, right after the business's own first real stretch of trading, not held off until the very end of this chapter.

First, the real, live Trial Balance and Profit and Loss for the still-open `Actual` ledger are checked --- a real, structural confirmation (balanced), and a real, recorded net income figure, kept so that the same checks just after Close Books below can prove closing the books never changes the P&L already reported for this same, real period.

While the figures are already open, the same business's own **New New P&L** screen --- Reports → New New P&L --- shows the same, real Profit and Loss grouped two ways at once: an **Outer grouping** and an **Inner grouping**, each independently set to Item, Category, Location, or any further hierarchy the business has configured, or left **Consolidated** to fold that side into a single row. With nothing configured yet beyond the Ice stall itself --- no Category, no Division, nothing --- grouping by **Item** still resolves every real account to its own row: Ice's own, genuinely positive $2,000.00, and Rent's own real $(100.00), summing to exactly the $1,900.00 net income already recorded above. Item itself only becomes a real choice for Outer once Inner is set to something on the opposite side of the "Hierarchy redundancy guard" described in the Programmer's Manual --- here, simply switching Inner to **Consolidated** first.

![Grouped by Item against Consolidated --- Ice and Rent, each its own real row, summing to the Ice business's own recorded net income.](manual-images-tutorial/pl_by_item_single_row.png)

**Close Books** then closes `Actual`'s own Income and Expense accounts --- Sales and this one Rent expense --- into **Retained Earnings**, as of `2027-06-30`, the end of this business's first real financial year. Ice's own $1,000.00 purchase cost stays exactly where it was booked, in its Inventory account on the Balance Sheet, unexpensed --- Close Books never touches a real asset account.

![The Ice business's own books, closed as of 2027-06-30.](manual-images-tutorial/ice_phase_books_closed.png)

The owner's real review follows immediately --- all three of the business's own real reports, checked and captured fresh right after closing, not merely checked at the API layer: the Trial Balance, still genuinely balanced; the Profit and Loss for these same two months, its net income figure exactly unchanged from what was recorded just before closing --- a real $2,000.00 in Ice sales, less $100.00 of rent, for a real $1,900.00 net income, the whole of this business's own first year (Ice's $1,000.00 purchase cost sits unexpensed in Inventory, so it never reaches this report at all); and the Balance Sheet it underlies, its own real Assets and Liabilities-plus-Equity genuinely equal.

![The Trial Balance, still balanced, right after closing.](manual-images-tutorial/ice_trial_balance_after_close.png)

![The Profit and Loss for the Ice business's own first year, net income unchanged by closing.](manual-images-tutorial/ice_profit_and_loss_after_close.png)

![The Balance Sheet, genuinely balanced, right after closing.](manual-images-tutorial/ice_balance_sheet_after_close.png)

A new ledger, `Actual 2027-28`, is then created structurally, before any posting into it, and **Rollover To New Period** posts the real, final, balanced opening entry into it --- the new period never references or posts against the old one. The new ledger's own opening Trial Balance is checked balanced, and its own Profit and Loss checked genuinely zero: Income and Expense are never carried forward across a rollover, only the real, "used" Balance Sheet accounts are. This old ledger's own trial balance total is recorded one final time here too, so that the very last check in this chapter can prove nothing that follows ever touches it again.

![The rollover to Actual 2027-28 complete.](manual-images-tutorial/rollover_to_new_period_done.png)

## A further capital investment, to build out the full wine retailer

The session now switches back into Tutorial Wine Retail Business a second time --- the exact, same real screen as before, re-submitted. This is not a no-op: the real session now genuinely points at `Actual 2027-28`, the newly rolled-over ledger, which every ordinary trading screen from here on (Cash Purchase, Cash Sale, POS Sale, Transfer, Purchase Order) reads directly from the real, live session.

![The session switched a second time, now onto Actual 2027-28.](manual-images-tutorial/session_switched_to_new_ledger.png)

With a single Ice stall's first year closed out, the owner puts in a further, real $20,000.00 of capital --- the same, real General Journal mechanism as before, a debit to **Cash and Bank**, a credit to **Owner's Equity**, staged and posted together under the reference `JE-OWNER-CAPITAL-2` --- this time into `Actual 2027-28`, not `Actual`. This is the real money that funds everything below: a second location, a full wine catalog, and real stock on hand at more than one site.

![The further capital investment staged and posted, into Actual 2027-28.](manual-images-tutorial/second_capital_investment_posted.png)

## Growing the business, through the Business Structure popup

Everything from here on is genuine growth, carried out entirely through the real **Business Structure** popup --- reachable either from **Configuration → Business Structure**, at any time, or straight from the **Set up your business structure** button shown right after creating a business. It is a graphical, editable view over a business's Locations, Divisions, and Item Categories, built from the exact, same screens and backend calls as the dedicated Locations, Hierarchies & Products, and Inventory Catalog pages it fronts --- never a separate, parallel mechanism of its own. See the Programmer's Manual for the full design.

![The Business Structure popup, opened over Tutorial Wine Retail Business.](manual-images-tutorial/structure_popup_location_added.png)

A second location first: **Head Office**, a warehouse in Adelaide, added via the popup's own "+ New Location" form, on its "Locations & Divisions" tab. Unlike the dedicated Locations screen, the popup's own quick-add form has no capacity fields of its own --- a warehouse added this way can still have its real carton capacity set afterwards, directly on the Locations page.

A division this business did not have a moment ago comes next: **Adelaide Metro**, created with the popup's own "+ New Division" action --- one click, which itself creates the Division grouping (not yet in existence at all until now) and its first value, together.

![A new division, Adelaide Metro, created from inside the popup.](manual-images-tutorial/structure_popup_division_added.png)

Then the real growing-up moment: **Main Street Cellar**, which already existed with no division at all, is tagged into Adelaide Metro using the popup's "Move…" action on its own tree node --- this is a *repositioning*, not a structural move; the location's own real record never changes, only which division it now reports under. Head Office joins the same division the same way, right after.

![Main Street Cellar, repositioned into the Adelaide Metro division.](manual-images-tutorial/structure_popup_move_msc.png)

![Head Office joining the same division.](manual-images-tutorial/structure_popup_move_ho.png)

One further growth step, on the popup's "Item Categories" tab: a **Whiskey** category, created ahead of time with "+ New top-level category" --- so that Highland Single Malt's own creation, later in this chapter, can simply select it from the dropdown rather than typing a brand-new category name inline.

![A Whiskey category, pre-created from the popup, ready for Highland Single Malt to select directly.](manual-images-tutorial/structure_popup_category_added.png)

## Creating the first employee

**Business Setup** is where the business's own first, real employee, **Jordan Lee**, is created, based at Head Office --- ready to receive incoming stock and later staff the retail counter.

![The business's own first, real employee created.](manual-images-tutorial/employee_created.png)

## Creating the next items

The **Items Catalog** creates two further items. Unlike Ice, both get a real category --- but creating a brand-new category is now its own, separate, real step: with nothing selected in the tree, Insert opens a plain "new top-level category" form, used here to create **Beer**.

![A new Beer category, created on its own, before any item sits inside it.](manual-images-tutorial/category_beer_created.png)

**Amber Ale 330ml** is then added under it --- the category selected in the tree, then Insert again, this time adding an item within it. **Highland Single Malt 700ml** goes under **Whiskey** instead --- already sitting there in the tree, exactly as the Business Structure popup left it earlier in this chapter, so no further category needs creating here. Neither screen sets a cost or selling price yet --- no cost/price field exists here; that is set separately below, once a real supplier exists for the item to be costed against.

![Amber Ale 330ml added under the new Beer category.](manual-images-tutorial/item_amber_ale_created.png)

![Highland Single Malt 700ml added under the already-existing Whiskey category.](manual-images-tutorial/item_highland_single_malt_created.png)

**A real, confirmed performance note**: at the time of this printing, creating an item on a business with a large, real chart-of-accounts/vocabulary tree could take tens of real seconds on this one screen, even though every real backend call involved returns in well under half a second --- a genuine client-side rendering defect, found and fixed during this same tutorial's own development (see the Programmer's Manual for the full, real root cause and fix).

## Creating the first supplier

**Vendors** is where a real supplier is created the same, direct way a customer or employee is. This tutorial's own first supplier, **Highland Brewing Co**, is created under the **Accounts Payable** parent, with just its name --- enough to place a real order against straight away.

![The new supplier, Highland Brewing Co, created.](manual-images-tutorial/provider_created.png)

## Setting the item's real cost and pack size

Amber Ale's real cost and real pack size are registered against this specific supplier --- $84.00 per carton, 24 bottles per carton --- before a Purchase Order can be placed against it. No generic, supplier-independent cost mechanism exists: the same item can genuinely cost a different amount from a different supplier, and each is tracked separately.

![Amber Ale's real cost and pack size, registered against Highland Brewing Co.](manual-images-tutorial/item_cost_set.png)

## Placing the Purchase Order

**An important, real detail, easy to get wrong**: a real order placed with a supplier is always for a whole number of real cartons --- never a raw, arbitrary bottle count. This tutorial's own Purchase Order for Amber Ale 330ml, reference `PO-AMBER-1`, is placed as 4 real cartons at $84.00 per carton --- the same, real $3.50-per-bottle cost as registered above, just expressed the way an actual invoice from a real supplier would state it.

![The Purchase Order placed, 4 cartons at $84.00 each.](manual-images-tutorial/purchase_order_placed.png)

## Receiving and paying for the stock

Receiving the order at Head Office --- through **Cash Purchase**, since this tutorial's own business pays on the spot rather than carrying an outstanding supplier balance --- brings the real, physical stock onto the books at cost, converted back to its own real, individual bottle count (96 bottles, at $3.50 each) the moment it is actually receipted, since every other real screen (Stock Transfer, POS, the Trial Balance itself) tracks real, physical stock in real, individual units throughout, never in cartons. Cash Purchase always posts to the business's own "Cash" provider --- a real, genuine Purchase Invoice is created and the Accounts Payable balance briefly opens, the same as an ordinary on-account purchase, before being paid off in full the same instant, reducing the real cash/bank balance directly.

![The cash purchase received and paid — 96 bottles at $3.50 each.](manual-images-tutorial/cash_purchase_done.png)

## Transferring stock from the warehouse to the retail outlet

A real stock transfer moves part of what Head Office received through to Main Street Cellar, ready to actually sell --- the same, real quantity leaving the warehouse's own stock and arriving at the outlet's own stock, never duplicated or lost in transit. This tutorial's own transfer moves 24 real bottles (one whole carton's worth) of the 96 just received, leaving 72 still at Head Office, under the reference `TRANSFER-AMBER-1`.

![The transfer completed — 24 bottles moved to Main Street Cellar.](manual-images-tutorial/transfer_done.png)

**A real, confirmed bug, found and fixed during this same tutorial's development**: the real `/stock/transfer` screen requires a non-blank Reference field even though the underlying transfer function does not itself need one (it auto-generates its own if called directly). The automated test now supplies one explicitly; see the Programmer's Manual for the full, real detail.

## Selling at the retail outlet

*Screenshot not shown --- this step is exercised end to end through the real UI by the automated Tutorial test, with no screenshot yet configured.*

A real POS sale, run twice, sells 2 bottles of Amber Ale 330ml at a time at $5.00 per bottle --- a real cost of $3.50 marked up to a real selling price of $5.00, so the live Profit & Loss shows a genuine profit once this retail markup is actually sold through. The second sale reuses the exact, same real register screen right after the first --- its own "Sale complete" receipt view, shown after any sale, is dismissed with "New sale" before the second sale's own fields are filled in.

## Creating a named customer and recording a cash sale

*Screenshot not shown --- this step is exercised end to end through the real UI by the automated Tutorial test, with no screenshot yet configured for either screen.*

Not every real sale goes through the POS register. A local restaurant, **Riverside Restaurant**, phones in an order for half a carton (12 bottles) of Amber Ale, to be paid cash on the spot when collected. Staff still creates the real, named customer account under the **Customers** parent, for the business's own records --- but since Cash Sale always posts to the business's own "Cash" customer, the sale itself is recorded there, the same real, immediate screen Cash Purchase's own counterpart: a genuine Sales Invoice to "Cash", Accounts Receivable briefly open, paid off in full the same instant. Invoicing a sale directly to Riverside Restaurant's own account --- for a business that extends it real, ongoing credit --- would instead use **AR Sale**, Chapter 1's on-account screen.

## Receiving sealed stock directly at retail, then opening a carton

*Screenshots not shown --- both steps are exercised end to end through the real UI by the automated Tutorial test, with no screenshot yet configured for either.*

Highland Single Malt 700ml is received sealed directly at Main Street Cellar --- 1 carton, 24 bottles --- stored under a **Secure** storage grouping. **Open Container** then converts that one sealed carton into 24 individual, sellable bottles on the shelf --- a real, ordinary internal stock movement between the item's own "Carton" and "Bottle" forms, mirrored against the location's own storage-space accounts, with no contra accounting involved.

## Reviewing the full wine retailer's own figures

With the wine retailer now fully built out and trading --- still entirely within `Actual 2027-28`, the ledger created by the rollover above --- its own real Trial Balance is checked balanced one final time, and its own Profit and Loss checked genuinely positive, covering everything from the second capital investment through every sale made above.

The same **New New P&L** screen now shows this fuller business. Left at its own default **Outer grouping**, **Location**, and switched to **Category** for the **Inner grouping**, Main Street Cellar's own real row appears --- carrying the Beer category's own real Sales and Cost of Goods Sold activity, Amber Ale 330ml tagged into it earlier in this chapter. Rows start collapsed; clicking one opens its own real Inner breakdown underneath. A genuine Category-outer/Item-inner crossing --- Beer's own row opening directly onto Amber Ale's --- is never offered by this screen at all: Category and Item are the same hierarchy (Item Categorization) at two levels of grain, the same way Location and Division are, and the screen's own "Hierarchy redundancy guard" refuses to cross either one against itself as a second, independent dimension, rather than silently showing something redundant. See the Programmer's Manual for the full design. That same Category→Item relationship is still real, and still proven --- just one level below this screen, by `getHierarchyParent`'s own generic lookup resolving Amber Ale directly under Beer, exactly the same mechanism a Division resolves a Location's own further groupings by.

![Grouped by Location against Category --- Main Street Cellar's own row, carrying Beer's real activity.](manual-images-tutorial/pl_by_category_detailed.png)

A further, real grouping --- **Division** --- exists once the Business Structure popup has created one, as this chapter's own `Adelaide Metro` was, earlier. Grouped by **Division** against **Consolidated** --- reached by setting Inner to Consolidated first, the one, always-selectable value on either side, which is what actually lets Division appear as a real Outer choice at all --- Adelaide Metro's own single, real row covers both of this business's own locations at once, and its own total matches this same section's Profit and Loss above exactly: no matter which real hierarchy a report slices this business by, summing every one of its own outer rows always comes back to the same, one, real, whole-business net income.

![Grouped by Division against Consolidated --- Adelaide Metro's own single row, covering the whole business.](manual-images-tutorial/pl_by_division_consolidated.png)

One last, real proof closes this chapter out: `Actual`'s own trial balance total, recorded right after the rollover, is checked once more here, at the very end --- exactly unchanged. None of this full wine-retail build-out, however much of it there genuinely is, ever once touches the Ice business's own, already-closed first year.

## Reviewing the real, live figures

At any point in this tutorial --- and especially after the final sale --- the same, real reports already described elsewhere in this manual show this business's own real, current position: the General Journal for every individual posting made along the way, the Chart of Accounts for the real Sales/COGS/Inventory accounts the new products brought into existence, the Trial Balance to confirm debits and credits still genuinely balance, the Balance Sheet and Profit & Loss Statement for the business's own real financial position, and the Stock on Hand report for exactly how much real, physical stock remains at Head Office versus Main Street Cellar after the transfer and sales above.

## A further currency, nominated at business creation

This tutorial's own business, **Tutorial Wine Retail Business**, nominated a further currency --- `NZD` --- as an additional currency it is willing to accept, directly during the **Create Business** step earlier in this chapter, alongside its own home currency (`AUD`). This tutorial does not go on to actually bank or trade in that further currency --- its one real bank account and real Cash at Bank structure, built immediately afterwards, are built for `AUD` only --- but the acceptance itself is real and already exercised by this exact tutorial, not merely designed.

*The fuller mechanism --- a real Location nominating a further currency alongside the business's own home currency, and a POS terminal actually transacting in it --- is design stated here, ahead of what today's automated Tutorial test exercises; see the Programmer's Manual, `multicurrency-design.md`, for what is actually built today.* Continuing this tutorial's own worked numbers as a worked example: a further, real outlet, `Riverside Cellars`, nominates `USD` alongside its own home `AUD`; a real POS terminal at that outlet, `Border Store USD Till`, is set to transact in `USD`. This tutorial's own `Amber Ale 330ml`, already stocked and sold in the home currency earlier in this chapter, gets a further, separate, independently-set `USD` selling price and `USD` cost for this one outlet --- a real, further fact, never derived or converted from its own home-currency price and cost.

A real sale through `Border Store USD Till` posts entirely within its own real `USD` group --- Sales Revenue, Sales Tax, Cost of Goods Sold, and Cash all as `USD`-tagged siblings of their own, ordinary, home-currency counterparts --- and the Trial Balance, checked immediately after, shows this outlet's own real `AUD` and `USD` activity as two, separate, genuinely unconverted currency groups, each independently balancing on its own. The Profit and Loss statement, reviewed next, offers a choice: this same `USD` activity shown in its own real, native column, an already-converted column, or folded into one, single, converted total --- see "Reporting across more than one currency" in Chapter 2 for the full, worked account names and amounts.

\clearpage
