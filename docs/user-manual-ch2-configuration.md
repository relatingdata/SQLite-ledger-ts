# Chapter 2 --- Configuration

## The Configuration landing page

Everything an administrator needs to set a business up lives under **Configuration** in the top bar. The landing page itself gives real, direct shortcuts into the most common, real administrative tasks --- the Entity Tree (the whole application, walked from its one, real root, in hierarchy order), the Structured Editor (create, rename, re-parent, or delete any real entity directly), Users, and Accounting Periods.

![The Configuration landing page.](manual-images/m_configuration_landing.png)

## Creating a new business

**New Business** creates a brand-new business and its first real ledger, ready to actually transact in immediately --- both a real Actual ledger for ongoing transactions and a real Budget ledger for the same financial year, since a new business genuinely needs both from day one. Only the five, top-level report categories (Asset/Liability/Equity/Income/Expense) are genuinely shared across every business in the application --- the real, named accounts underneath them are country-specific families that already exist. Choosing which existing family most closely matches a new business's own country or jurisdiction doesn't create anything new; it simply shows which real accounts already exist to post to.

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

![The Locations screen, listing every real, existing retail outlet and warehouse.](manual-images/m_locations.png)

## Items, categories, and product hierarchies for reporting

The **Items Catalog**, under Accounts Payable, is where real inventory items are created and organized (this used to be called "Parts" throughout the application — the term has changed everywhere, but the screen's own real behavior is unchanged). An item's own real, canonical details are kept separate from who actually supplies it --- the same, real item is routinely available from more than one real manufacturer or vendor, at different real prices and package sizes, and one real source can be marked preferred over the others. A new, real category can be created directly, inline, at the moment a new item needs one --- there is no need to visit a separate screen first.

![The Items Catalog, with "+ New category..." selected, ready to create a real, new category inline.](manual-images/m_parts_cropped.png)

Every business now gets its own, real, separate items catalog --- selecting Wine Retail Company shows only Wine Retail Company's own real items, never another business's. This mirrors the same fix already made for warehouse/retail locations: each business's own catalog lives under its own real "{Business Name} Items" home, rather than one, single, shared list every business used to see.

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

Whatever real hierarchy exists under a category --- however many real levels deep --- the Profit & Loss report already reflects it correctly, with no separate setup step. Creating "Amber" under "Beer", and the real, sellable item under "Amber", automatically creates matching Sales Revenue and Cost of Goods Sold lines in the same real shape (Sales Revenue → Beer → Amber → the real item), the moment the first real sale posts --- so a category rolled up in the P&L always mirrors the real item structure it was built from, not a separately hand-maintained list a person has to keep in sync by hand.

## Purchase Order --- matching a vendor to what's actually being bought

Choosing which real item to order on a **Purchase Order** narrows the vendor list down to that item's own, real, known suppliers --- the ones already on record in the Parts Catalog --- with the preferred one selected automatically and its own known price filled in. Picking a different, real, known alternate instead follows that source's own price too. If a genuinely new supplier is needed --- one this item has never been bought from before --- "Show all vendors" opens the full list; nothing is ever silently blocked, known suppliers are simply the sensible default.

![Purchase Order, with "Amber Ale 330ml" selected --- the vendor list narrowed to its own two, real, known suppliers, the preferred one already chosen.](manual-images/m_po_supplier_matching.png)

## The Balance Sheet

Assets, Liabilities, and Equity each sit in their own, real, bordered box, with the two boxes on the right --- Liabilities above Equity --- always bottom-aligned against the single box on the left, so **Total Assets** and **Total Liabilities + Equity** land on the same, real, horizontal line whichever side happens to be taller. Every real total lands under the correct column too --- Debit for Assets, Credit for Liabilities and Equity --- exactly matching the individual lines above it, with a genuine deficit (an unusual, contra balance) correctly shown parenthesized on the opposite side rather than as a misleading, bare negative number.

Any real line with a small disclosure triangle next to it --- Accounts Receivable, Accounts Payable, and now Inventory --- expands to show its own, real detail underneath: every individual customer or vendor behind an AR/AP balance, or every real product behind the Inventory total, each with its own real dollar figure.

![The Balance Sheet, Assets/Liabilities/Equity each in their own box, Accounts Receivable and Inventory both expanded to show their own real detail underneath.](manual-images/m_balance_sheet.png)

## Contacts --- a real, named person, under a real, direct role

Beyond a party's own address and phone number, a real, named person can be attached too --- under a real, direct role like Credit Manager, Sales Clerk, Dispatch, Store Man, or Emergency Contact. This isn't a fixed list: typing a genuinely new role that doesn't exist yet creates it on the spot, and it's immediately offered again everywhere else afterward. A contact person can be attached to a vendor, a customer, an employee, or any other real entity at all --- the same, real Insert/Delete pattern as addresses and phone numbers, with a name and, optionally, a phone number and email.

![A real "Credit Manager" contact attached to a real vendor, with name, phone, and email all shown together.](manual-images/m_contact_persons.png)

\clearpage
