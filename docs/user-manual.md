```{=latex}
\begin{titlepage}
\centering
\vspace*{2cm}
{\Huge\bfseries Better~Brighter~Multi-Ledger\par}
\vspace{0.5cm}
{\Large User Reference and Configuration Manual\par}
\vspace{0.3cm}
{\large Version 0.0.0\par}
\vspace{2cm}
{\normalsize
Chapter 0 --- How It Started\par
Chapter 1 --- Introduction\par
Chapter 2 --- Configuration\par
}
\vspace{3cm}
{\small\itshape
This is the English edition of this manual. Also planned, not yet\\
available: German, French, Danish, and Italian editions --- the same,\\
real application every one of them documents already, genuinely\\
supports all five languages live, today.\\
\par}
\vspace{1cm}
{\footnotesize\itshape
Every screenshot in this manual was captured directly from the running\\
application --- the real Wine Retail Business example business, with\\
real, live simulation data --- not invented or mocked up.\par}
\end{titlepage}

\pagenumbering{roman}
\setcounter{page}{1}
\tableofcontents
\clearpage
\listoffigures
\clearpage
\pagenumbering{arabic}
\setcounter{page}{1}
```

# Chapter 0 --- How It Started

Wine Retail Business didn't start as a company at all. It started as one shop.

Eight years ago, a couple — we'll call them Lars and Mette, though their real names don't matter — left Denmark and England behind and moved to Switzerland, to Brig, a small town in the canton of Valais where the Rhône valley narrows toward the Simplon Pass. It's a genuinely, officially bilingual town, French and German both, and a short train ride from the Italian-speaking valleys on the far side of the pass — the kind of place where a shop's own till receipt might reasonably need to speak three languages before lunch. Lars had spent a decade working for a wine importer back in Denmark and knew the trade; Mette, English, had a background in retail management and ran the shop floor. Between them they knew wine and they knew customers. What neither of them had much appetite for was the paperwork — and Valais, it turned out, had no shortage of that either: Swiss bookkeeping conventions to learn, a real, genuine multilingual environment to trade in from day one, and a supplier list that, almost immediately, spanned three of the country's four national languages.

For the first couple of years, that was fine. One shop, a modest supplier list, an accountant who visited quarterly, and a shoebox — figuratively, then literally, an actual folder — of delivery notes, invoices, and bank statements that Mette reconciled by hand on Sunday evenings, some in French, some in German, one memorable batch entirely in Italian from a small producer near Locarno. It was tedious, but it was manageable.

It stopped being manageable somewhere around year three. The shop was doing well — well enough that Lars started buying from more suppliers, in bigger and more varied orders, to keep up with what customers were asking for. More suppliers meant more delivery notes to check against what actually arrived. More delivery notes meant more invoices to check against the delivery notes. More invoices meant more statements to check against the invoices, every one of them a chance for a supplier's admin error, a shop's own recording error, or a genuine short delivery to slip through unnoticed if nobody checked. Most of this correspondence was already electronic by then — PDF invoices, emailed statements — which helped less than you'd think, since electronic paperwork still has to be read, checked, and reconciled by an actual person, and there was simply more of it than one person's Sunday evenings could absorb, in any of the three languages it might arrive in.

Mette got sick of it. Not sick of the business — the business was working — sick specifically of being the one who had to catch every mismatch between what a supplier said they'd delivered, what a supplier said they'd invoiced, and what a supplier said the shop owed, using nothing more than a folder and a calculator, and increasingly, a mental translation exercise on top of it. She said so, more than once, and it became the thing that finally pushed the two of them to take bookkeeping seriously as its own real job, not something squeezed in around closing time.

That's the moment this kind of software earns its place in the story — not as a nice-to-have, but as the direct answer to a real person's real complaint. A **Purchase Order** recorded what was actually ordered. A **Stock Receipt** recorded what actually arrived, matched line by line against that order. An **AP Purchase**, or more often the invoice itself, recorded what the supplier said was owed — and if a delivery, a receipt, and an invoice ever disagreed with each other, that disagreement was visible immediately, in the system, instead of discovered three weeks later staring at a folder — in whichever of the three languages that folder happened to be written in.

The business kept growing. A second shop opened in nearby Visp two years later, run day-to-day by their first real employee, with Mette overseeing both from what had become, by then, a genuine back office. Two years after that, they expanded again — this time south, through the Simplon, to a shop in the Italian-speaking valley on the other side, far enough away that "popping in to check the till" stopped being realistic and a real, computerised system stopped being optional. Somewhere around this point, on their accountant's advice, they incorporated: what had been a sole trader's shop became a real, limited company, with its own real Chart of Accounts, its own real fiscal year, and its own real obligations to file accounts properly — in a canton where "properly" genuinely means being ready to produce them in more than one official language — rather than reconstruct them from memory and a folder each year.

That company is Wine Retail Business as it exists in this application today — three real retail outlets and a warehouse, spanning a German-speaking outlet, a French-speaking one, and an Italian-speaking one within a single canton's own real, genuine linguistic reach; real vendors (some local, some importing from France, Germany, and Italy); real customers; and real books that close cleanly at year end, regardless of which of Valais's own languages a given day's paperwork arrived in.

Lars and Mette still have expansion plans. A wine bar — pouring glasses, not just selling bottles, with a cocktail list besides — is the nearest one, tucked away for "next year, maybe." Further out, and admittedly more of a dream than a plan right now, is the idea of growing their own grapes on the steep, terraced slopes above the valley and eventually producing a wine of their own, rather than only importing and reselling other people's; Lars has mentioned, more than once and usually after a glass of something good, that a small microbrewery wouldn't be a bad idea either. None of that exists yet. But everything this application is built to do — real entities that can be reparented and regrouped as a business's real shape changes, real product categories that can grow a manufacturing arm without redesigning the database, real divisions that can separate a wine bar's or a winery's own profit-and-loss from the retail business it grew out of, and a real, genuine ability to let three, real, different languages coexist honestly rather than forcing one, single, "official" version of every word — is there specifically so that when Lars and Mette are ready, the software won't be the thing standing in their way.

## This application's approach to a true multilingual application

There's a real, honest wrinkle in the story above worth pausing on, because it shapes how this whole application is built underneath, not just how its menus look. Valais itself made this impossible to ignore from day one — a canton where French and German are both, genuinely, officially the law of the land, with Italian a short train ride away, is not a place where "just pick one language" was ever a real option.

When Mette first sat down with a supplier's invoice and this software's own vocabulary, she found herself asking a question that seemed, at first, almost too simple to matter: is the business she buys wine from a "vendor," or a "supplier"? Her accountant used one word. The software's own English labels, at the time, used the other. Neither was wrong — they meant the exact, same real thing — but the mismatch nagged at her every time she opened the Purchasing screen.

It would be easy to treat that as a translation problem — the same kind of problem as English "Customers" needing a German word and a French word. But it isn't, quite. "Vendor" and "Supplier" are both already English. The real difference between them isn't language at all; it's *which real business, in which real context, is looking at the word*. A wine importer selling cases to Wine Retail Business might, in one document, be called a vendor; in another, a supplier; in a third — if Wine Retail Business were ever the one selling wholesale to a restaurant, rather than buying — the exact, same kind of relationship, looked at from the other side, might reasonably be called a customer's own account instead. Manufacturing, wholesale, and retail businesses, it turns out, don't all draw these lines in the exact, same place, and a business-to-business relationship carries a genuinely different shape of meaning than a business-to-consumer one, even when the underlying software concept — "an entity we transact with" — is the same.

So this software's own real answer, worked out carefully rather than assumed, is this: a *word* — "Vendor," "Supplier," "Kunden" — is never, itself, the real, underlying thing. It's one, real, named path to a *concept* — a genuine, structural piece of the business (Accounts Payable, say) that the word is only ever pointing at. The same, real concept can have more than one, real, valid English name, the same way it can have a German name and a French name; which one a given business, or even a given user, sees is a genuine, real choice, not a fixed, single truth baked into the software.

This is still, honestly, a real work in progress. Getting this exactly right — capturing not just "Vendor means Supplier" but *when* it does, and when a business-to-business context actually calls for a genuinely different concept rather than just a different word for the same one — is real, careful, ongoing work, not a box that's been ticked. But the underlying architecture is already built to make that work possible: nothing in this application ever *requires* a single, fixed English word to mean one, single, forever thing.

## Overview: what the real glossary review actually found

Reviewing "Vendor/Supplier" carefully, as promised above, meant reviewing the whole glossary carefully alongside it — every language's own, not just English's — rather than fixing one, isolated case and assuming the rest were fine.

The real, direct finding: this app's own English glossary already, honestly documents six real pairs where two different English words mean the exact, same real thing:

| English term | Also called | The real, underlying concept |
|---|---|---|
| Accounts Payable | Creditors | What this business owes |
| Accounts Receivable | Debtors | What's owed to this business |
| Income Statement | Profit and Loss | The report of income against expense |
| POS Terminal | Cash Register | Where a real, in-person sale is rung up |
| Product | Part | A real, sellable or purchasable item |
| Supplier | Vendor | An entity this business buys from |

: The ambiguity of English words

Worth a real, direct aside here too: "Part" and "Product" aren't the only, real, nearby words a business might reach for. A manufacturer talks about a **raw product** (bought in, not yet changed) becoming a **finished product** (through **assembly**, or some other real, direct transformation) before it's ever sold; a retailer more often just says **sales product**, or plainer still, **sales merchandise** — stock bought specifically to be sold on, not transformed at all. None of these are separate, real concepts in this application's own, underlying structure — a real product category, and a real Chart of Accounts prototype, already accommodate every one of these real, different business shapes without needing a separate word baked in for each — but a glossary that only ever said "Part = Product" would leave a genuinely manufacturing-minded reader wondering where their own, familiar vocabulary fits.

Checking German, French, Danish, and Italian directly, one at a time, against this same list: none of the other four languages carry this same, real problem. Each already has one, single, standard word for each of these concepts — German's own "Lieferant," French's own "Fournisseur," Danish's own "Leverandør," Italian's own "Fornitore," with no real, competing second term the way English genuinely has "Vendor" *and* "Supplier." The real synonym problem, it turns out, is specifically an English one — a useful, honest thing to know, since it means the real work ahead is narrower than "review every language equally," and can focus where the real ambiguity actually lives.

"Income Statement" versus "Profit and Loss" is no longer just a glossary entry, either — it's a real, working example already, today: a business can genuinely choose to see "Income Statement" everywhere the software would otherwise say "Profit and Loss," in its own real menu and on the report itself, from one, single, real setting. "Vendor" versus "Supplier" doesn't have that same, real, live choice built yet — the glossary documents the concept is shared, but the application doesn't yet let a business actually pick which real word it prefers, the way it now can for the P&L. That gap is the real, next, concrete piece of work.

*(Continued in later sections: how the first vendor, the first product, and the first sale actually get entered — see `docs/glossary.md` for any term used here you don't recognize.)*

\clearpage

# Chapter 1 --- Introduction

## What this application is

Better Brighter Multi-Ledger is a double-entry accounting and retail operations application, built around one, simple, central idea: everything in it --- every account, every business, every division, every location, every product, every employee, even every menu label --- is genuinely the same kind of thing underneath: an *entity*, sitting in one, single, shared tree. There is no separate "customers table" or "products table" living apart from everything else --- a customer, a product, and a bank account are all real rows in the same, one, underlying structure, each simply positioned differently within it.

This manual walks through the application as it actually exists today, using the bundled example business --- Wine Retail Business, a small, multi-location wine and spirits retailer --- to show every real screen with real, live data on it.

## Logging in

Every real session starts with a real, direct login --- a real username and password, checked against the application's own, real, established login screen.

![The Login screen, showing the same, real, established panel-frame title every other screen in the application uses.](manual-images/m_login.png)

## Businesses, ledgers, and language

After logging in, before you reach any real screen, you choose three things: which real **business** you're working in (a company or entity you're keeping books for), which real **ledger** within it --- "Actual" is always the real books; anything else, such as a Budget ledger, is a completely separate, isolated scenario that never affects the real one --- and which **language** the interface displays its labels in.

![The business/ledger/language choice screen, immediately after logging in.](manual-images/m_choose_business.png)

## The main screen, once you're in

Once a business, ledger, and language are chosen, you land on the main screen. The top bar shows every real, major section of the application --- General Ledger, Accounts Receivable, Accounts Payable, Cash, and more --- with a real, contextual sidebar on the left showing every screen within whichever section is currently selected.

![The main screen, General Ledger section selected, showing its full, real sidebar.](manual-images/m_home.png)

## How the menu is organized

The top-level sections are organized around real, everyday workflows rather than abstract categories: **Accounts Receivable (Debtors / Sales)** holds everything related to selling and being paid; **Accounts Payable (Creditors / Purchasing)** holds everything related to buying and paying; **Cash** holds immediate, no-account transactions and the POS register; **General Ledger** holds the core accounting reports and the year-end close; and **Configuration** --- covered in full in Chapter 2 --- holds everything an administrator uses to set the business up in the first place.

A screen shown in italics in the sidebar (such as Reconciliation or FX Adjustment) is a real, acknowledged gap --- a planned screen that doesn't exist yet --- shown honestly rather than hidden, so it's clear what's genuinely available today versus what's still ahead.

## Navigating with the keyboard

The top bar and sidebar both, genuinely, respond to the keyboard, not just the mouse. With a real, top-bar section already focused, the Left/Right arrow keys move between sections, the same, real order they're shown in --- General Ledger, Accounts Receivable, and onward. With a real, sidebar link already focused, Up/Down does the same within that section's own, current list of links.

Pressing **Esc** while working in the main panel returns focus straight to the sidebar's own, currently-active link --- a quick way back to the menu without reaching for the mouse. If the panel has a real, genuine, unsaved edit pending, Esc asks first, rather than silently discarding it: confirm to discard and return to the menu, or cancel to keep working. This is still being extended, screen by screen, across the application; the Structured Editor (Configuration) is the first, real, working example of it today.

\clearpage

# Chapter 2 --- Configuration

## The Configuration landing page

Everything an administrator needs to set a business up lives under **Configuration** in the top bar. The landing page itself gives real, direct shortcuts into the most common, real administrative tasks --- the Entity Tree (the whole application, walked from its one, real root, in hierarchy order), the Structured Editor (create, rename, re-parent, or delete any real entity directly), Users, and Accounting Periods.

![The Configuration landing page.](manual-images/m_configuration_landing.png)

## Creating a new business

**New Business** creates a brand-new business and its first real ledger, ready to actually transact in immediately --- both a real Actual ledger for ongoing transactions and a real Budget ledger for the same financial year, since a new business genuinely needs both from day one. Only the five, top-level report categories (Asset/Liability/Equity/Income/Expense) are genuinely shared across every business in the application --- the real, named accounts underneath them are country-specific prototypes that already exist. Choosing which existing prototype most closely matches a new business's own country or jurisdiction doesn't create anything new; it simply shows which real accounts already exist to post to.

The Chart of Accounts is designed to provide the best and most insightful business reports into the financial state of your business, and deserves careful design and expert advice matched to your own, real business and its own, real future plans --- choosing the right starting prototype now is worth genuine thought, not a box ticked in passing.

A brief note on naming, since the two are easy to conflate: the **Chart of Accounts** (never "Charts of Accounts" --- always singular, one real chart) is the real, structural home for every real account a business posts to. **Business Reports** is a separate, real, genuinely different thing --- the real, shared list of report *kinds* themselves (Balance Sheet, Profit and Loss Statement, Trial Balance, and this business's own Notes to the Financial Statements), never the accounts underneath them.

Every business nominates one real **home currency** at creation --- the currency its own consolidated reports (Balance Sheet, Profit and Loss) are expressed in, and the currency assumed for any account, division, or location that hasn't nominated anything different for itself.

Setup then walks through the business's own real banking arrangement, in order:

1. **Does the business bank at one bank, or more than one?** Most businesses answer one; a business already banking at more than one real institution (common the moment more than one jurisdiction is involved) says so here.
2. **Nominate each real bank account** --- a real bank name, its own real routing detail (a BSB in Australia; the equivalent identifier elsewhere --- a sort code, routing number, or IBAN, depending on the business's own country), and its own real account number. One bank account is nominated for a single-bank business; as many as needed otherwise.
3. **Does the business trade in one currency, or more than one?** Nearly every business answers one --- its own home currency. A business genuinely near a national border, or one that otherwise takes real cash in another currency, nominates each further real currency it actually uses.
4. **A real bank-accounts-by-currencies grid** is then shown --- every nominated bank account down the side, every nominated currency across the top --- and a checkbox at each real intersection marks which combinations actually exist. A single-bank, single-currency business sees a 1×1 grid and ticks its one, obvious box; a business with two banks and two currencies sees a 2×2 grid and ticks only the real, genuine combinations it actually holds (rarely all four --- a business banking with Westpac in AUD and HSBC in USD, say, ticks two of the four possible cells, not all of them).

**The exact, same real bank-accounts-by-currencies nomination applies to each real partner's own drawing account**, for a business structured as a partnership --- each partner's own drawing account is set up the same way, bank(s) and currenc(y/ies) ticked the same way, since a partner can genuinely be paid out through more than one real bank account or in more than one real currency exactly as the business itself can.

![Creating a new business, with a real Chart of Accounts prototype selected for reuse.](manual-images/m_new_business.png)

## Business Setup --- divisions, locations, employees

**Business Setup** is the one, real, single place to set up and amend a business's whole, real structure at once --- its divisions, each division's own real locations (with address, phone, and real weekly open hours), and each location's own real staff (with address, phone, wage/salary, and a real weekly schedule validated against that location's own open hours). A division is a real profit or cost center --- it can be as simple as "Retail" and "Wholesale", or genuinely nested --- and it's purely a reporting mechanism: it exists to group a business's own real transactions for the P&L (Trial Balance, Balance Sheet, and P&L all accept a real division filter), and Year End Close correctly rolls each division's own net income into its own real Retained Earnings line, never blended together with any other division's own activity. There is no separate, dedicated "Divisions" screen --- division setup lives here, directly alongside locations and staff, since the two are so closely related in everyday, real use.

This whole tree works entirely by keyboard, the same real Insert/Delete pattern used for addresses and phone numbers elsewhere in this application: select a division, location, or employee, then press **Insert** to add something new within it --- a division selected adds a location; a location selected adds an employee. Press **Delete** to remove whatever's currently selected. There are no separate "Add" buttons scattered through the tree at all --- the hint at the bottom always states exactly what Insert and Delete will do for the current selection.

![Business Setup, showing every real division, location, and staff member together, in one, single tree.](manual-images/m_business_setup.png)

### Working at more than one location

A real employee can genuinely work a real, scheduled shift at more than one, real location --- someone splitting their week between two, real, nearby stores, for instance. Their own, primary weekly schedule (the location they're filed under in the tree) sits at the top of their own detail panel; **Additional locations**, right below it, lists every other real location they already have a real schedule at, each with its own, separate weekly grid, and a real "+ Add a location" link for a genuinely new one.

A real, single shift is capped at 12 hours, and a real, combined week --- added up across every real location together, not just one --- is capped at 48 hours; both are checked the moment a schedule is saved. The same, real person genuinely cannot be scheduled at two, real, different locations at an overlapping time on the same day either --- caught and rejected the same way. A real shift is no longer required to fall within a location's own open hours at all: real, ordinary work like cleaning or receiving a delivery routinely happens before the doors open or after they close.

![A second, real location's own weekly schedule (Harbourside Bottle Shop), alongside this employee's own primary one (Eastside Cellar Door).](manual-images/m_multi_location_schedule.png)

## Locations, in more detail

Locations are real retail outlets and warehouses --- each has a real street address and phone number, a real city (locations in the same city can transfer stock between each other), and real, physical capacity. A real retail outlet tracks both shelving (bottles) and floor area (cartons), and, separately, real cold storage --- genuinely smaller, distinct real estate, not a subdivision of the same shelf space. A warehouse deals in full cartons only.

**Storage capacity is a real combination of location and storage type** (room-temperature, refrigerated) --- the same, structural kind of combination a product's own bottle/six-pack/carton tiers already are, not two separate, independently-managed locations linked only by name. *(Design stated here; today's actual, built mechanism still models refrigerated storage as a second, name-linked location entity rather than a genuine second facet of the one location --- this section describes the intended, corrected shape, not yet the current, live behavior.)*

**Item size within a storage section is a real, further constraint, not yet resolved to one specific design here** --- a shelf or fridge section built for 330ml cans or bottles has a fixed physical height a 750ml bottle simply cannot fit into, independent of how much numeric space is nominally left. Whether this is modeled as a size-class compatibility check alongside the existing count, or as capacity measured in a real physical unit each item consumes proportionally, is still an open design decision.

**Each location nominates the real set of currencies it actually trades in.** Nearly every location trades only in its business's own home currency; a location genuinely near a national border, or one that otherwise takes real cash in another currency, nominates that currency explicitly, alongside the home one. A Division is a real, pure reporting rollup over its own locations, never a location itself --- it has no currency of its own to nominate; its own currency exposure, when a report shows one, is simply the sum of whatever its real locations actually did.

![The Locations screen, listing every real, existing retail outlet and warehouse.](manual-images/m_locations.png)

## Items, categories, and product hierarchies for reporting

The **Items Catalog**, under Accounts Payable, is where real inventory items are created and organized (this used to be called "Parts" throughout the application — the term has changed everywhere, but the screen's own real behavior is unchanged). An item's own real, canonical details are kept separate from who actually supplies it --- the same, real item is routinely available from more than one real manufacturer or vendor, at different real prices and package sizes, and one real source can be marked preferred over the others. A new, real category can be created directly, inline, at the moment a new item needs one --- there is no need to visit a separate screen first.

![The Items Catalog, with "+ New category..." selected, ready to create a real, new category inline.](manual-images/m_parts_cropped.png)

Every business now gets its own, real, separate items catalog --- selecting Wine Retail Business shows only Wine Retail Business's own real items, never another business's. This mirrors the same fix already made for warehouse/retail locations: each business's own catalog lives under its own real "{Business Name} Items" home, rather than one, single, shared list every business used to see.

### A deeper hierarchy for real reporting: category, product, and item

Beyond a flat category, a real item can sit several real levels deep --- a broad category (**Beer**), a real product underneath it (**Amber**, the conceptual/brand thing a customer would actually ask for by name), and then the real, concrete, sellable item beneath that --- a specific combination of size, packaging, container material, and (for anything needing refrigeration) cold-versus-shelf storage. For example:

```
Items → Beer → Amber → Amber Ale 330ml Aluminum Can (Cold)
```

Each parenthesized detail in the item's own real name --- (Ale), (330ml), (Aluminum Can), (Cold) --- names one real, independent dimension the actual, sellable item is a genuine combination of. This is deliberately not yet a rigid, structured field for each dimension; today it's real, plain naming convention, readable by a person and consistent enough for reports (below) to group by. A later, more structured version of this same idea, where each dimension is a real, separate, independently-managed set of values, is real, planned, but not yet built --- see the Programmer's Manual for the design.

### Storage Origin: the one dimension already made explicit

Of those parenthesized dimensions, one --- whether an item needs to be kept refrigerated (**Cold**) or lives on an ordinary shelf (**Hot**) --- is already a real, explicit setting on the item itself, not just a word in its own name. Setting this correctly matters directly: **Cash Sale**, **Cash Purchase**, **AR Sale**, and **AP Purchase** all show a real "Storage" column next to each line item, tagging it Cold or Hot the moment its own real name is typed in --- a genuine, live check against the item's own setting, the same one used to automatically route a dispatch to the correct real refrigerated location behind the scenes.

![An item correctly tagged Cold, and another correctly tagged Hot, shown live while typing a real Cash Sale.](manual-images/storage_origin_verified.png)

### The Profit & Loss report walks this hierarchy automatically

Whatever real hierarchy exists under a category --- however many real levels deep --- the Profit & Loss report already reflects it correctly, with no separate setup step. Creating "Amber" under "Beer", and the real, sellable item under "Amber", automatically creates matching Sales Revenue and Cost of Goods Sold lines in the same real shape (Sales Revenue → Beer → Amber → the real item), the moment the first real sale posts --- so a category rolled up in the P&L always mirrors the real item structure it was built from, not a separately hand-maintained list a person has to keep in sync by hand. A Category, exactly like a Division, is a real, pure reporting rollup, never an operational unit of its own --- it nominates nothing itself; what a report shows for it is simply the sum of whatever its real items actually did.

### Buying and selling in a foreign currency are two separate, independent facts

A category or item being genuinely multi-currency on the *purchasing* side --- "Imported Beer," say, bought from an overseas brewery and invoiced in EUR --- says nothing about whether it's multi-currency on the *selling* side. The same imported beer might be sold to every domestic customer purely in the home currency, with the EUR fact confined entirely to the vendor relationship and its own real Cost of Goods Sold. Each real vendor source an item has already carries its own real currency (an item can genuinely be sourced from more than one vendor, in more than one currency, at once); a real, independently-set selling price, in a currency a location has actually nominated, is a separate, further fact --- never assumed from, or converted out of, the purchasing side's own currency.

## Purchase Order --- matching a vendor to what's actually being bought

Choosing which real item to order on a **Purchase Order** narrows the vendor list down to that item's own, real, known suppliers --- the ones already on record in the Parts Catalog --- with the preferred one selected automatically and its own known price filled in. Picking a different, real, known alternate instead follows that source's own price too. If a genuinely new supplier is needed --- one this item has never been bought from before --- "Show all vendors" opens the full list; nothing is ever silently blocked, known suppliers are simply the sensible default.

**A single Purchase Order assumes one, single currency for every line on it.** A vendor that itself operates across a currency border, supplying from warehouses on either side, is ordered from twice --- one real, separate order per currency --- never one order mixing them.

![Purchase Order, with "Amber Ale 330ml" selected --- the vendor list narrowed to its own two, real, known suppliers, the preferred one already chosen.](manual-images/m_po_supplier_matching.png)

## The Balance Sheet

Assets, Liabilities, and Equity each sit in their own, real, bordered box, with the two boxes on the right --- Liabilities above Equity --- always bottom-aligned against the single box on the left, so **Total Assets** and **Total Liabilities + Equity** land on the same, real, horizontal line whichever side happens to be taller. Every real total lands under the correct column too --- Debit for Assets, Credit for Liabilities and Equity --- exactly matching the individual lines above it, with a genuine deficit (an unusual, contra balance) correctly shown parenthesized on the opposite side rather than as a misleading, bare negative number.

Any real line with a small disclosure triangle next to it --- Accounts Receivable, Accounts Payable, and now Inventory --- expands to show its own, real detail underneath: every individual customer or vendor behind an AR/AP balance, or every real product behind the Inventory total, each with its own real dollar figure.

![The Balance Sheet, Assets/Liabilities/Equity each in their own box, Accounts Receivable and Inventory both expanded to show their own real detail underneath.](manual-images/m_balance_sheet.png)

## Reporting across more than one currency

*Design stated here, ahead of the mechanism it describes --- see the Programmer's Manual for what's actually built today versus what this section specifies.*

The Trial Balance, the Profit and Loss statement, and the Balance Sheet each treat a business trading in more than one currency differently, on purpose:

**The Trial Balance never converts anything.** Each real currency present shows its own, real, unconverted debit and credit columns, and each currency's own columns must independently balance --- the report's whole purpose is to prove the books are genuinely correct, currency by currency, so folding in an assumed exchange rate would hide the one thing it exists to check.

**The Profit and Loss statement and the Balance Sheet offer a choice of three views**, since these reports exist to show a single, readable picture of the business, and a reader reasonably wants to see that picture in more than one way:

1. **Native, per-currency, plus a converted total.** Every real currency actually present gets its own column-pair, in its own real, unconverted amounts --- plus one further column-pair at the end, everything converted to the business's own home currency at the exchange rate in effect at the moment the report is generated, and summed.
2. **Converted, per-currency, plus a total.** The same one-column-pair-per-currency layout as above, but each currency's own column-pair is shown already converted into home-currency terms --- so a reader sees, directly, "what the USD activity was worth, in AUD" as its own column --- plus a total, the sum of those already-converted columns.
3. **One combined column-pair only.** No per-currency breakdown at all --- just the total, itself correctly computed by converting each currency's real activity to the home currency first and summing, never a currency-blind sum across raw, un-converted, incompatible numbers.

In every one of the three, the exchange rate used for conversion is the one in effect when the report is actually generated --- a live, assumed figure, stated as such, never written back into the ledger and never treated as a realized, historical fact the way an actual, completed currency conversion is.

## Vendors, Employees, and Customers are real, typed views of one, shared idea

*Design stated here, ahead of the mechanism it describes --- see the Programmer's Manual, `contact-types-and-translations.md`, for what's actually built and what still needs wiring up.*

Nothing labeled plainly "Contacts" is ever shown --- and that's deliberate, the same way a typed address or phone number (below) is never shown as a generic, undifferentiated entry either. Picking **Billing** for an address, or **Mobile** for a phone number, never first shows a plain, unlabeled "Address" or "Phone Number" concept --- the type comes first, always. A vendor, an employee, and a customer work the exact, same way: each is really the same, one, underlying kind of real, named party, seen through a real, specific lens. The same real person or company can genuinely be more than one at once --- a supplier who is also, separately, a paying customer; an employee who is also owed money as a genuine, further creditor --- without ever being forced to pick just one.

Creating "a new vendor" on the Vendors screen means, underneath: a real, named party is created, then tagged as a real **Vendor** --- never shown or asked about directly, the same way choosing "Billing" for an address never asks about the word "Address" first. The same real party, tagged as a real **Employee** too, would then genuinely appear on both real screens, its own real, shared name, address, and phone number never duplicated or re-entered.

**A real, open, genuinely unresolved question**: two real, different employees --- housemates, a couple --- can genuinely share one real home address, or one real home phone number. Today, each real employee's own address or phone number is its own, real, entirely independent record, even when the values happen to be identical --- there's no real way, yet, for two, separate people to genuinely share one, single record. Whether that's genuinely fine (most real-world systems already work this way) or whether a real, further sharing mechanism is actually needed is a real decision still to be made, not yet resolved.

## Contacts --- a real, named person, under a real, direct role

Beyond a party's own address and phone number, a real, named person can be attached too --- under a real, direct role like Credit Manager, Sales Clerk, Dispatch, Store Man, or Emergency Contact. This isn't a fixed list: typing a genuinely new role that doesn't exist yet creates it on the spot, and it's immediately offered again everywhere else afterward. A contact person can be attached to a vendor, a customer, an employee, or any other real entity at all --- the same, real Insert/Delete pattern as addresses and phone numbers, with a name and, optionally, a phone number and email.

![A real "Credit Manager" contact attached to a real vendor, with name, phone, and email all shown together.](manual-images/m_contact_persons.png)

## Making your reports insightful and more useful with Hierarchies

A **Hierarchy** is a real, business-defined way of grouping things for reporting --- separate from what a product is actually called. Two are set up for you from the start: **Division** (grouping locations --- a region, a city, however the business is structured) and **Category** (grouping products --- Red Wine, White Wine, and so on). Neither is special or fixed: they're simply the two most businesses need on day one. A business is free to rename them, remove them, or add real, further ones of its own --- Storage temperature, glass size, a seasonal range, anything that's actually useful to see broken out on a report.

**The one rule that makes hierarchies genuinely useful: keep it out of the product's own name.** If a lager is sold both cold and at room temperature, and cold pours for more, the temptation is to create two separate products --- "Lager" and "Cold Lager." Don't. Keep one real product, "Lager," and add a real **Storage** hierarchy with values like "Cold" and "Ambient." The same goes for a wine bar pouring beer by the glass in two sizes --- one product, "Lager," with a real **Glass Size** hierarchy ("Small," "Large"), not two differently-named products that happen to be the same beer.

Why this matters, concretely: the moment temperature or size is baked into the product's own name, there is no longer any single report that can show "total Lager sold, broken down by temperature" or "total Lager sold, broken down by size" --- the sales are scattered across differently-named products with no shared thread connecting them. Keep the product name to the one, real thing being sold, and let a Hierarchy carry every fact that's genuinely a variant of it. Every one of these facts can carry its own, real, different price too --- a cold pour costs more than a warm one, a large glass costs more than a small one --- exactly as it should, without ever touching the product's own identity.

A hierarchy only needs to be set up where it's actually relevant --- Glass Size makes sense at a wine bar, not at a warehouse that never pours a single drink. Set up only the hierarchies a given location genuinely needs, and every report that groups by that hierarchy will only ever show it where it was actually recorded.

**Setting this up**: under **Setup → Hierarchies & Products**, add a real grouping (e.g. "Storage") and its real values (e.g. "Cold," "Ambient"), then define a real Product shape --- the ordered list of dimensions (Location, Item, Storage, and so on) a specific combination will follow.

A real, honest note on where this stands today: the setup screen above is real and working --- a business can define its own Hierarchies and Product shapes through it right now. Recording a real sale *against* one of these combinations works too, but only through **a real, registered barcode** --- when a real product barcode is registered against a specific combination (a cold beer's own, distinct barcode, different from a warm one's), scanning it at the register automatically finds the correct, exact combination and its own, real price, with nothing to pick manually. There is not yet a screen for choosing a combination by hand, or for tagging stock received without scanning --- that's real, planned, future work.

\clearpage
# Chapter 3 --- Tutorial: Building a Real Wine Retail Business, Start to Finish

This chapter walks through one, single, real, worked exercise --- setting a brand-new wine retail business up entirely through this application's own real interface, from the very first login through its first real posted transaction, checking the real, live figures at each step along the way. Every screenshot below is real and current, captured directly from a live run of this exact tutorial; a step whose own screenshot was not yet available at the time of this printing is marked plainly below, rather than shown with a stale or substitute image.

## Logging in and choosing a business

Every session starts by logging in, then choosing which real business to work within --- the same account can genuinely work across more than one, real, separate business, each with its own, entirely independent books.

![The login screen.](manual-images/t01_login_landing.png)

## Creating the new business

**New Business**, under Configuration, is where this tutorial's own business is created --- a real name, a real financial year, which existing Chart of Accounts prototype most closely matches this business's own real country or jurisdiction, and its own real home currency (the currency its reports are expressed in --- this tutorial's own business trades only in its home currency throughout, so nothing further is nominated here; a business that also needs to bank or trade in a further currency is covered separately, at the end of this chapter).

![The New Business form, filled in for this tutorial's own business.](manual-images/t02_new_business_form.png)

Creating it produces both a real Actual ledger and a real Budget ledger for the financial year, immediately ready to post to --- and points to exactly what to do next: post the owner's own capital contribution, then set up real locations and staff.

![The new business created, with its own real, immediate next-steps guidance shown directly on screen.](manual-images/t03_new_business_created.png)

## Creating the first location

Switching the active session into the new business, **Locations** is where a real retail outlet or warehouse is created --- starting empty, for a genuinely new business.

![Locations, empty, for a genuinely new business with nothing set up yet.](manual-images/t04_locations_empty.png)

**+ New Location** opens a real, inline form --- a name, a real city (locations sharing a city can transfer stock directly between each other), and a real, user-extensible type (Retail and Warehouse exist from the start; a business can add its own, further real kinds directly from this same form --- a wine bar, a pop-up stall, whatever a real business actually needs, never a fixed, closed list).

![The new-location form, filled in for this tutorial's own first retail outlet.](manual-images/t05_locations_new_form.png)

## Setting the location's own real shelf capacity

Immediately after creation, the location's own real shelf capacity (bottles) and carton capacity are set directly on the same screen, then saved — ready for the location's own real stock levels to be tracked against once product arrives. This tutorial's own outlet needs only ordinary, room-temperature shelving at first; a retail outlet that also needs its own real refrigerated section (most warehouses genuinely don't — a warehouse is bulk, room-temperature storage as a rule; refrigeration is a real, further need specific to a retail outlet actually displaying chilled stock for sale) adds that as its own, further real facet of the same location, covered later in this chapter, once this tutorial's own outlet actually needs it.

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

The owner's own real capital contribution is posted directly through the **General Journal**: a debit to the real cash/bank account matching the chosen Chart of Accounts prototype, credited to the matching real equity account. This is the same, real journal every other manual transaction in this application posts through.

![The General Journal, empty, ready for this tutorial's own first transaction.](manual-images/t14_general_journal_empty.png)

![The General Journal, filled in — cash debited, Owner's Equity credited.](manual-images/t15_general_journal_filled.png)

![The transaction posted.](manual-images/t16_general_journal_posted.png)

Immediately afterwards, the Trial Balance shows exactly this: the real cash account and the real equity account, each for the same amount, genuinely balanced.

![The Trial Balance, showing the owner's own real capital contribution, balanced.](manual-images/t17_trial_balance_after_first_transaction.png)

## Creating the first supplier

Vendors is where a real supplier is created, the same, direct way a customer or employee is: a real name, and, optionally, a real address, phone number, and named contact person. This tutorial's own first supplier, **Highland Brewing Co**, is created with just its name — enough to place a real order against straight away; the further, optional details can always be added later, once there's a real reason to (a delivery address, a named account manager).

![The new vendor created.](manual-images/t19_vendor_created.png)

## Purchase order, receiving stock, and paying the invoice

**An important, real detail, easy to get wrong**: a real order placed with a vendor is always for a whole number of real cartons — never a raw, arbitrary bottle or can count. A real supplier sells "4 cartons of Amber Ale," never "96 bottles of Amber Ale," even though the two describe the identical, real quantity once each carton's own real size (24 cans, in this tutorial's own case) is known. This tutorial's own Purchase Order for **Amber Ale 330ml** is placed as 4 real cartons, at $84.00 per carton — the same, real $3.50-per-bottle cost as before, just expressed the way an actual invoice from a real vendor would state it.

![The Purchase Order, filled in as 4 real cartons.](manual-images/t20_purchase_order_filled.png)

![The Purchase Order placed.](manual-images/t21_purchase_order_placed.png)

Receiving it at the warehouse — through **Cash Purchase**, since this tutorial's own business pays on the spot rather than carrying a real, outstanding vendor balance — brings the real, physical stock onto the books at cost, converted back to its own real, individual bottle count (96) the moment it's actually receipted, since every other real screen (Stock Transfer, POS, the Trial Balance itself) tracks real, physical stock in real, individual units throughout, never in cartons. The resulting Purchase Invoice is paid in full at the same time, reducing the real cash/bank balance directly.

![Receiving the order.](manual-images/t22_purchase_received_filled.png)

![The purchase received and paid.](manual-images/t23_purchase_received_done.png)

## Transferring stock from the warehouse to the retail outlet

A real, partial stock transfer moves a portion of what the warehouse received through to the retail outlet, ready to actually sell — the same, real quantity leaving the warehouse's own stock and arriving at the outlet's own stock, never duplicated or lost in transit. This tutorial's own transfer moves 24 real bottles (one whole, real carton's worth) of the 96 just received, leaving 72 still at the warehouse.

![The transfer, filled in.](manual-images/t26_transfer_to_main_street_filled.png)

![The transfer completed.](manual-images/t27_transfer_to_main_street_done.png)

## Selling at the retail outlet

A real retail sale, run more than once, sells real stock at the retail outlet's own real selling price. Selling price and cost move together throughout this tutorial's own worked numbers: a real cost of \$3.50 per bottle marked up to a real selling price of \$5.00 per bottle --- the real, live Trial Balance continues to balance after every one of these postings, and the real, live Profit \& Loss shows a genuine profit once the retail markup has actually been sold through.

![A sale in progress at the POS terminal.](manual-images/t34_pos_sale_filled.png)

![The sale completed.](manual-images/t35_pos_sale_done.png)

## Reviewing the real, live figures

At any point in this tutorial --- and especially after the final sale --- the same, real reports already described elsewhere in this manual show this business's own real, current position: the General Journal for every individual posting made along the way, the Chart of Accounts for the real Sales/COGS/Inventory accounts the new product brought into existence, the Trial Balance to confirm debits and credits still genuinely balance, the Balance Sheet and Profit \& Loss Statement for the business's own real financial position, and the Stock on Hand report for exactly how much real, physical stock remains at the warehouse versus the retail outlet after the transfer and sales above.

## A further location, trading in a real, further currency

*Design stated here, ahead of the mechanism it describes --- see the Programmer's Manual, `multicurrency-design.md`, for what's actually built today.*

A business genuinely near a national border --- or one that otherwise expects real cash in another currency --- nominates that further currency on its own real Location, alongside its own home currency, rather than on the business as a whole. Continuing this tutorial's own worked numbers: a further, real outlet, `Riverside Cellars`, nominates `USD` alongside its own home `AUD`; a real POS terminal at that outlet, `Border Store USD Till`, is set to transact in `USD`. This tutorial's own `Amber Ale 330ml`, already stocked and sold in the home currency earlier in this chapter, gets a further, separate, independently-set `USD` selling price and `USD` cost for this one outlet --- a real, further fact, never derived or converted from its own home-currency price and cost.

A real sale through `Border Store USD Till` posts entirely within its own real `USD` group --- Sales Revenue, Sales Tax, Cost of Goods Sold, and Cash all as `USD`-tagged siblings of their own, ordinary, home-currency counterparts --- and the Trial Balance, checked immediately after, shows this outlet's own real `AUD` and `USD` activity as two, separate, genuinely unconverted currency groups, each independently balancing on its own. The Profit and Loss statement, reviewed next, offers a choice: this same `USD` activity shown in its own real, native column, an already-converted column, or folded into one, single, converted total --- see "Reporting across more than one currency" in Chapter 2 for the full, worked account names and amounts.

\clearpage
# Appendix --- Every Screen in the Application

A real, complete reference of every real screen this application has a route for, grouped by the same, real top-level section the menu itself uses --- whether that screen is genuinely working today, or still a real, honestly-labeled gap. A screen marked "Not yet implemented" shows a real, direct placeholder in the running application (with its own description of what it would do), rather than being hidden from the menu entirely --- so the full, real shape of the application is always visible, not just the parts already built.

## POS Terminal

| Screen | Status |
|---|---|
| POS Terminal (retail register) | Implemented |
| Customer self-registration terminal | Implemented |

![The POS Terminal — barcode-scan retail sale, with a live running cart.](manual-images/pos_terminal.png)

## General Ledger

| Screen | Status |
|---|---|
| Journal Entries | Implemented |
| General Journal | Implemented |
| Reconciliation | Not yet implemented |
| FX Adjustment | Not yet implemented |
| Trial Balance | Implemented |
| Balance Sheet | Implemented |
| Profit and Loss | Implemented |
| Compare Ledgers | Implemented |
| Accounting Periods | Implemented |
| Year End Close | Implemented |

![The General Journal — free-form, multi-line manual posting.](manual-images/general_journal.png)

## Accounts Receivable (Debtors / Sales)

| Screen | Status |
|---|---|
| AR Sale | Implemented |
| AR Receipt | Implemented |
| Sales Invoices | Implemented |
| Sales Order | Implemented |
| Quotations | Not yet implemented |
| Stock Dispatch | Implemented |
| Generate Sales Invoices | Not yet implemented |
| Reminders | Implemented |
| Customers | Implemented |
| Sales Report | Implemented |
| Aged Receivables | Implemented |
| Customer Statement | Implemented |

![The AR Sale screen — a sale to a customer on credit.](manual-images/ar_sale.png)

![The AR Receipt screen — a customer paying down their outstanding balance.](manual-images/ar_receipt.png)

![The Sales Order screen — a real, standing commitment to a customer, to be fulfilled later.](manual-images/sales_order.png)

![The Stock Dispatch screen — fulfilling a real Sales Order (in full or in part).](manual-images/stock_dispatch.png)

## Accounts Payable (Creditors / Purchasing)

| Screen | Status |
|---|---|
| AP Purchase | Implemented |
| AP Payment | Implemented |
| Purchase Invoices | Implemented |
| Purchase Order | Implemented |
| RFQ (Request for Quotation) | Not yet implemented |
| Stock Receipt | Implemented |
| Generate Purchase Orders | Not yet implemented |
| Vendors | Implemented |
| Manufacturers | Implemented |
| Parts Catalog | Implemented |
| Stock Listing | Implemented |
| Locations | Implemented |
| Stock Take | Implemented |
| Write-offs & Expiration | Implemented |
| Aged Payables | Implemented |

![The AP Purchase screen — a purchase from a vendor on credit.](manual-images/ap_purchase.png)

![The AP Payment screen — paying down a vendor's outstanding balance.](manual-images/ap_payment.png)

![The Purchase Order screen — placing a real, standing order with a vendor.](manual-images/purchase_order.png)

![The Stock Receipt screen — fulfilling a real Purchase Order (in full or in part).](manual-images/stock_receipt.png)

![The Stock Take screen — reconciling counted, physical inventory against the system's own recorded quantity.](manual-images/stock_take.png)

![The Write-offs screen — recording real breakage, spoilage, or expired stock, and receiving new, real, dated lots.](manual-images/write_offs.png)

## Cash

| Screen | Status |
|---|---|
| Cash Sale | Implemented |
| Cash Purchase | Implemented |

![The Cash Sale screen — an immediate, no-account retail sale.](manual-images/cash_sale.png)

![The Cash Purchase screen — an immediate, no-account purchase.](manual-images/cash_purchase.png)

## Vouchers

| Screen | Status |
|---|---|
| Payment Batch | Not yet implemented |
| Payable Batch | Not yet implemented |
| General Ledger Batch | Not yet implemented |

## HR

| Screen | Status |
|---|---|
| Employees (via Business Setup) | Implemented |
| Payroll (wage payment) | Implemented |

![The HR screen — paying a real employee's wages, hourly or salaried.](manual-images/hr_wages.png)

## Logistics

| Screen | Status |
|---|---|
| Stock Transfer | Implemented |
| Restock | Implemented |
| Below Reorder Point | Implemented |
| Stock Movement | Implemented |
| Assembly BOM Transfer | Not yet implemented |

![The Stock Transfer screen — moving real, physical stock between two locations in the same city.](manual-images/stock_transfer.png)

## Shipping

| Screen | Status |
|---|---|
| Shipping | Not yet implemented |

## Projects & Jobs

| Screen | Status |
|---|---|
| Projects (clock-in/clock-out) | Implemented |
| Jobs | Not yet implemented |

![The Projects screen — an employee clocking in and out against a real project.](manual-images/projects.png)

## Recurring Transactions

| Screen | Status |
|---|---|
| Recurring Transactions | Not yet implemented |

## Configuration

| Screen | Status |
|---|---|
| Entity Tree | Implemented |
| Structured Editor | Implemented |
| Chart of Accounts (dedicated screen) | Not yet implemented |
| New Business | Implemented |
| Business Setup | Implemented |
| Users | Implemented |
| Warehouses (via Locations) | Implemented |
| Bank Accounts | Implemented |
| Taxes | Not yet implemented |
| Currencies | Not yet implemented |
| Exchange Rates | Not yet implemented |
| Goods & Services (dedicated catalog) | Not yet implemented |
| Vocabulary | Implemented |
| Translations | Implemented |

## Reports (cross-cutting)

| Screen | Status |
|---|---|
| Cash Flow Forecast | Implemented |
| New P&L / New New P&L (in-progress redesigns) | Implemented |
| New Stock on Hand | Implemented |

## Account / Session

| Screen | Status |
|---|---|
| Log in | Implemented |
| Choose business, ledger, language | Implemented |
| Change password | Implemented |

\clearpage
# Appendix: The Step Runner

The Step Runner is the application's own tool for setting up test data and
walking through a scripted sequence of actions — creating a business, adding
locations, receiving stock, and so on — one step at a time or all at once.

## What it's for

If you want to load a known set of sample data into the application, or walk
through a sequence of steps to try something out or prepare for a
demonstration, the Step Runner reads a plain, readable file of steps and
carries them out for you, either instantly through the application's own
backend or, if you'd like to watch, by driving the actual screens the way a
person would.

## Running it

From a terminal, in the project's own `backend` folder:

```
npx tsx scripts/step-runner.ts <data-file.csv>
```

By default, it shows you the next step and asks whether to go ahead. Answer
`y` (or press Enter) to run it, or `n` to stop. To check a file without
running anything, use `--lint` (reports any problems) or `--pretty` (prints
every step in a readable form).

## Section 8: File Formats

**8.1 The data file.** A plain text file, one line per step, with no column
titles. The first item on each line is the name of the screen or action (for
example, `Login` or `Create Business`), and every item after that is one
piece of information for that screen, in the same order every time — the
same order you'd write down when filling in a paper form for that screen. If
any piece of information itself contains a comma, put quotation marks around
it. For example:

```
"Login","admin","changeme123","English"
"Create Business","Wine Tutorial Business","2026-27","Sole Trader"
```

**8.2 The screen file** (`screens.csv`). This is a separate file, maintained
alongside the data file, that tells the Step Runner what each screen's own
pieces of information mean and how to find them on the actual screen. You
won't normally need to edit this yourself — it's set up once per screen, by
whoever builds a new fixture, and every data file that uses that screen
simply refers to it by name.

**8.3 The control file** (optional). This is how you script a run without
sitting at the tool yourself — instead of manually choosing, batch by batch,
whether to run the fast way or watch it happen, this file says so in advance
for every step. For example: the first few steps run instantly through the
backend, then the next step switches to actually driving the screen and
taking a picture of it, then back to instant again — all without anyone
watching. This information goes in a second, small file alongside the data
file, never mixed into the data file itself.

## What's here today, and what's still to come

Right now, the Step Runner's design has been finalized and written up in
full, and its earlier, working parts (checking a file for problems, showing
it in a readable form) exist for an older version of the file format. Bringing
those, and the part that actually drives the screens, up to date with the
format described above is in progress.
# Glossary

*Also available in [German](glossary.de.md) · [French](glossary.fr.md) · [Danish](glossary.da.md) · [Italian](glossary.it.md).*

Real terms this app actually uses — where two words mean exactly the same real thing in this app, that's stated directly, not left for you to guess.

This is a living document, built alongside a real consistency audit of the app's own screens — terms get added here as they're actually encountered, not invented in advance.

---

### Account

A real, ordinary **entity** (see below) that can hold a **balance** — a running total in minor units (cents). Not a separate kind of thing in the database; any entity can become an account the moment something is posted to it. See `docs/entity-model.md`.

### Accounts Payable (AP) = Creditors

The real heading/subtotal account under which every real **vendor** lives, and the side of the books that tracks what this business owes. "Accounts Payable" and "Creditors" are the exact same real thing — this app's own menu labels both, side by side, since different people and different accounting traditions use one term or the other.

### Accounts Receivable (AR) = Debtors

The mirror of Accounts Payable — the real heading under which every real **customer** lives, tracking what customers owe this business. "Accounts Receivable" and "Debtors" are the same real thing.

### Assets

Everything a business genuinely owns or is owed — cash, stock on hand, and real, outstanding Accounts Receivable balances are all real assets. One of the five universal top-level Chart of Accounts categories (see below).

### Audit Trail

The real, unbroken record of who changed what and when — the concrete reason this app's own entities are append-only (`entities.deleted_at`, never an in-place edit) and journal entries are only ever reversed, never deleted or rewritten. Not a stylistic choice: "verifiability" — a clear, traceable path back to the origin of every real figure — is one of the standard, real qualitative characteristics a set of financial statements is expected to have. A closed period, a reversed entry, and a renamed-but-never-deleted entity are all this app's own, concrete answers to that same, real requirement.

### Balance Sheet

A real report: everything the business owns (**Assets**) must equal everything it owes plus what the owners have put in or earned (**Liabilities** + **Equity**), as of one specific date. If it doesn't balance, something is genuinely wrong.

### Business

A real, top-level entity representing one company or organization — has its own real Chart of Accounts leaves (see **CoA prototype**), its own **ledgers**, and its own **locations**.

### Category (product category)

Any real entity under "Parts" that has at least one real child (whether that child is another, deeper category or an actual product) — e.g. "Beer" is a category, "Ale" is a sub-category under it. Genuinely user-configurable: create, rename, or nest categories through the Parts page or Structured Editor, with zero code changes, and the real Sales/COGS accounts on the GL side automatically mirror whatever shape the category tree actually has.

### Chart of Accounts (CoA)

The real tree of every account a business can post to — Asset, Liability, Equity, Income, and Expense are the five, genuinely universal top-level categories every real business (in any country) groups its accounts into.

### CoA prototype

A real, country-specific set of leaf accounts under the Chart of Accounts — confirmed directly, not assumed, that these are genuinely different entities, not just different display names: "Cash and Bank" (English/generic), "Bankkontokorrent" (German), "Banca c/c" (Italian), "Kasse" (Swiss) are all real, distinct accounts. A new business picks which real prototype to reuse rather than inventing a new one.

### Closed period

A real date range a business has locked — no new postings or edits are allowed on or before the closed-through date. See **Year End Close**.

### COGS (Cost of Goods Sold)

The real expense account tracking what a product actually cost the business, recognized at the moment it's sold — not when it was bought. Tagged via **relation** so **Gross Profit** calculations pick it up correctly. See also **Cost of Goods** below, the broader term this app's own COGS accounts are one real example of.

### Contact

The real address, phone, email, and payment-terms details attached to any entity — a customer, vendor, employee, manufacturer, or location can all have contact details, using the exact same mechanism. A real, named person can be attached too, under a real, direct, genuinely user-definable role — Credit Manager, Sales Clerk, Emergency Contact, or a brand-new one typed on the spot.

### Cost of Goods

The real, direct cost of whatever a business actually sold — material and, where relevant, labor, spent to produce or acquire the specific thing that moved. Distinct from **Operating Expenses**, which keep the business running generally rather than being tied to one specific sale. This app's own COGS accounts are the concrete, per-product implementation of this general concept.

### Customer = a real Accounts Receivable account

A customer isn't a separate kind of record — it's a real entity that happens to live under Accounts Receivable. The same entity could, in principle, also be a vendor or an employee if it were also parented elsewhere (though today each role is a separate, real entity).

### Division

A real, ordinary entity under "Divisions" representing a profit or cost center — can itself be nested (e.g. "Retail" → "Retail North"), the same real hierarchy a product category can have. A **profit center** can post to Income or Expense; a **cost center** is restricted to Expense only. Year End Close correctly rolls each division's own net income into its own real Retained Earnings line, not one blended figure.

### Double-entry accounting

The real, foundational rule every posting in this app already enforces, not an optional convention: every real transaction is an exchange, and both sides of that exchange must carry the same real value — a debit somewhere is only ever valid alongside an equal, real credit somewhere else. `postJournalEntry` rejects anything that doesn't balance, per currency, before it can ever reach the books. See **Trial Balance**, the report that exists specifically to prove this held true across every real account at once.

### Entity

The one, real, universal building block this entire app is made of — every business, ledger, account, customer, vendor, product, location, and division is the same underlying kind of record (a name, a real parent for hierarchy, an optional lateral **relation**), just used in a different part of the tree. See `docs/entity-model.md` for the full reasoning.

### Entity Tree Editor / Structured Editor

The one, generic screen that can create, rename, reparent, or change the relation of any entity directly — the "escape hatch" that works even where a dedicated screen doesn't exist yet. Several dedicated screens (product categories, divisions) now avoid needing this for their own, common case.

### Equity

What would genuinely be left for the owners if every real asset were converted to cash and every real liability paid off — the business's own real net worth. One of the five universal top-level Chart of Accounts categories.

### Expense

Real money spent to operate the business generally. See **Cost of Goods** and **Operating Expenses** for the two real kinds this app distinguishes. One of the five universal top-level Chart of Accounts categories.

### Financial year

The one-year period a business's Budget ledger is prepared for (e.g. "2026-27") — free text, not computed from today's date, since a real fiscal year start genuinely varies by country.

### Gross Profit

Real Sales Revenue minus real COGS, for a given period — what a business made on what it sold, before other operating expenses.

### Income Statement = Profit and Loss

The exact same real report, two different names for it — "Income Statement" is the more common term in some countries and accounting traditions; this app's own menu calls it "Profit and Loss." Summarizes real income earned and real expense incurred over a period, resulting in real net income (or net loss).

### Journal

The real, first point of entry for a **posting** — a transaction is entered into the General Journal before it's ever reflected in any account's own real balance. This app's own General Journal screen (see the "General Ledger" menu section) is a direct, literal implementation of this real accounting concept, not a looser or metaphorical use of the word.

### Ledger

A real, named set of transactions under one business — "Actual" for the real, ongoing books; a Budget ledger is a real, separate ledger holding a plan to compare Actual against, using the exact same mechanism (post transactions, run the same reports) as real bookkeeping. Worth noting directly: this is a different, real use of the word "ledger" than the traditional accounting distinction between a chronological Journal and an account-ordered Ledger — this app's own "Ledger" is closer to what some systems call a book or a scenario (Actual vs. a proposed Budget), not a second, derived view of the same Journal. Both real uses of the word are legitimate; this app's own usage is simply worth being explicit about, since the same word means something genuinely different depending on which accounting tradition you learned it in.

### Liabilities

Real debts the business genuinely owes — a bank loan, an unpaid bill, a real, outstanding Accounts Payable balance. One of the five universal top-level Chart of Accounts categories.

### Location

A real, physical place stock lives — a warehouse or a retail outlet. Scoped per business (each business has its own real "{business} Locations" parent). Tracks real bottle/carton capacity, split into shelf and refrigerated storage where relevant.

### Manufacturer

A real entity representing who actually makes a product — distinct from **vendor** (who a business buys from), since the two aren't always the same company.

### Operating Expenses

Real expenses that keep the business running generally — rent, wages, utilities — rather than being tied to any one, specific sale the way **Cost of Goods** is. The P&L's own "Less Other Direct Operating Expenses" section is this real category, made concrete.

### POS Terminal = Cash Register

The same real thing, two different names for it — the real, staff-facing screen for ringing up an in-person sale (scan or search a product, take cash or card, print a receipt). "Cash register" is the older, still very common term for this exact same function, especially in everyday speech; this app calls the screen "POS Terminal" but the two terms are interchangeable.

### Part = Product

Interchangeable in this app — a real, sellable/purchasable item, living under a real **category**.

### Part Source

The real link between a product and a vendor/manufacturer who supplies it — carries the vendor-specific SKU, price, and package size, since these genuinely vary by who you buy from.

### Reference

The real, human-chosen identifier for one journal entry (e.g. "GJ-1001", "PO-4021") — required on every real posting.

### Relation

The one, real, optional lateral pointer every entity can have, separate from its real parent — used for things like tagging an account as belonging to a report category, or a COGS marker. Different from **parent**, which is the real hierarchy position.

### Retained Earnings

The real equity account that accumulates a business's net income (or loss) over time, across every period it has ever closed.

### Revenue

Real income earned from actually doing business — selling goods or services. One of the five universal top-level Chart of Accounts categories (labeled "Income" in this app's own Chart of Accounts, the same real thing).

### Trial Balance

A real report listing every account's own real balance, split into its debit or credit side — the most basic real check that the books are internally consistent (total debits must equal total credits).

### Vendor = Supplier = a real Accounts Payable account

The exact same real thing, three different words for it. A vendor is created by creating an entity under "Accounts Payable" — there's no separate "supplier" record type.

### Year End Close

A real posting that zeroes every real Income and Expense account and transfers the net difference into Retained Earnings — the standard, real way a business "closes the books" for a period. Correctly handles multiple real divisions, rolling each one's own net income into its own real Retained Earnings line.

\clearpage

# Contributors

This application, and this manual, are the real, direct product of a genuine, ongoing collaboration between a human reviewer and Claude, an AI assistant made by Anthropic --- every real design decision, every real correction, and every real piece of this project's own, honest documentation of its own mistakes reflects that direct, back-and-forth process, not a single, one-shot generation.

A real, formal list of every real, individual contributor is intentionally left blank here for now --- add your own name, and anyone else's, directly to this section in a future, real edit.

\clearpage

# Suggestions

Found something in this manual, or in the real, live application it describes, that's wrong, missing, or could be clearer? A real, direct way to say so belongs here.

For now: use this application's own, existing feedback channel (ask your administrator, or the team maintaining this project, where that is for you) --- a real, dedicated, in-application suggestions form is a planned, not yet built, piece of this application (see `docs/TODO.md`).

\clearpage

# Notes

```{=latex}
\notespage
\notespage
```
