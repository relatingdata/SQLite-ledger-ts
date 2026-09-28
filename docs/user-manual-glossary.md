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

Real income earned from actually doing business — selling items or services. One of the five universal top-level Chart of Accounts categories (labeled "Income" in this app's own Chart of Accounts, the same real thing).

### Trial Balance

A real report listing every account's own real balance, split into its debit or credit side — the most basic real check that the books are internally consistent (total debits must equal total credits).

### Vendor = Supplier = a real Accounts Payable account

The exact same real thing, three different words for it. A vendor is created by creating an entity under "Accounts Payable" — there's no separate "supplier" record type.

### Year End Close

A real posting that zeroes every real Income and Expense account and transfers the net difference into Retained Earnings — the standard, real way a business "closes the books" for a period. Correctly handles multiple real divisions, rolling each one's own net income into its own real Retained Earnings line.

\clearpage

