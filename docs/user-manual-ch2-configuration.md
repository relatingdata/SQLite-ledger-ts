# Chapter 2 --- Configuration

## The Configuration landing page

Everything an administrator needs to set a business up lives under **Configuration** in the top bar. The landing page itself gives real, direct shortcuts into the most common, real administrative tasks --- the Entity Tree (the whole application, walked from its one, real root, in hierarchy order), the Structured Editor (create, rename, re-parent, or delete any real entity directly), Users, and Accounting Periods.

![The Configuration landing page.](manual-images/m_configuration_landing.png)

## Creating a new business

**New Business** creates a brand-new business and its first real ledger, ready to actually transact in immediately --- both a real Actual ledger for ongoing transactions and a real Budget ledger for the same financial year, since a new business genuinely needs both from day one. Only the five, top-level report categories (Asset/Liability/Equity/Income/Expense) are genuinely shared across every business in the application --- the real, named accounts underneath them are country-specific families that already exist. Choosing which existing family most closely matches a new business's own country or jurisdiction doesn't create anything new; it simply shows which real accounts already exist to post to.

Every business nominates one real **home currency** at creation --- the currency its own consolidated reports (Balance Sheet, Profit and Loss) are expressed in, and the currency assumed for any account, division, or location that hasn't nominated anything different for itself.

Setup then walks through the business's own real banking arrangement, in order:

1. **Does the business bank at one bank, or more than one?** Most businesses answer one; a business already banking at more than one real institution (common the moment more than one jurisdiction is involved) says so here.
2. **Nominate each real bank account** --- a real bank name, its own real routing detail (a BSB in Australia; the equivalent identifier elsewhere --- a sort code, routing number, or IBAN, depending on the business's own country), and its own real account number. One bank account is nominated for a single-bank business; as many as needed otherwise.
3. **Does the business trade in one currency, or more than one?** Nearly every business answers one --- its own home currency. A business genuinely near a national border, or one that otherwise takes real cash in another currency, nominates each further real currency it actually uses.
4. **A real bank-accounts-by-currencies grid** is then shown --- every nominated bank account down the side, every nominated currency across the top --- and a checkbox at each real intersection marks which combinations actually exist. A single-bank, single-currency business sees a 1×1 grid and ticks its one, obvious box; a business with two banks and two currencies sees a 2×2 grid and ticks only the real, genuine combinations it actually holds (rarely all four --- a business banking with Westpac in AUD and HSBC in USD, say, ticks two of the four possible cells, not all of them).

**The exact, same real bank-accounts-by-currencies nomination applies to each real partner's own drawing account**, for a business structured as a partnership --- each partner's own drawing account is set up the same way, bank(s) and currenc(y/ies) ticked the same way, since a partner can genuinely be paid out through more than one real bank account or in more than one real currency exactly as the business itself can.

![Creating a new business, with a real Chart of Accounts family selected for reuse.](manual-images/m_new_business.png)

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
