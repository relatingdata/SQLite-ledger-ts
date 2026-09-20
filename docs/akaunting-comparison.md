## Comparison against Akaunting

A direct, honest comparison against Akaunting — a real, popular, open-source
accounting application (Laravel/VueJS/Tailwind, ~10k GitHub stars) — covering
both its real, published database schema (found directly in its own GitHub
repository) and its real, published feature set (from its own website).
Structured the same way as `sql-ledger-comparison.md`: what this application
already covers, where the architectures genuinely differ by design, and what's
genuinely missing here.

### Real, confirmed findings on Akaunting's own schema, from its own GitHub repository

Found directly (`github.com/akaunting/akaunting`, `database/` directory) —
Akaunting is built on Laravel, and stores its schema the conventional Laravel
way: one migration file per table (or per version's batch of changes), not a
single, hand-written SQL file. Confirmed, real, original 2017 table set (from
`database/migrations`, file names beginning `2017_09_01_000000_create_*`):

`accounts`, `bills`, `categories`, `companies`, `currencies`, `customers`,
`invoices`, `items`, `jobs`, `modules`, `notifications`, `password_resets`,
`payments`, `revenues`, `roles`, `sessions`, `settings`, `taxes` — eighteen
real, separate, permanent tables for the base application alone, before any
of its optional apps are installed, each with its own real, independent
structure (auto-incrementing bigint id, `$table->timestamps()`, real foreign
keys with cascading deletes where one table references another).

This is the direct, opposite architecture from this application's own,
real, deliberate 4-permanent-table design (`entities`, `account`, `journal`,
`journal_line` — see `entity-model.md`). Akaunting adds a real, new table for
every real, new kind of thing (an invoice, a bill, a customer); this
application adds a real, new *entity* under an existing table, tagged with a
type via the same, real, generic mechanism used for everything else. Neither
is simply "better" — Akaunting's own approach is the direct, familiar,
default Laravel/Eloquent pattern, easy for any Laravel developer to read at a
glance; this application's own approach trades that immediate familiarity for
a genuinely uniform way to add a new concept without a schema migration at
all (see `skill-no-new-tables.md`).

**Real, confirmed multi-tenancy pattern**: Akaunting adds a `company_id`
column to (almost) every table directly — one, real, shared set of tables,
partitioned per row by which company a row belongs to. This application's own
multi-tenancy is structural instead: an entire, real, separate entity subtree
per business (`"${businessName} Locations"`, `"${businessName} Contacts"`,
etc. — see `entity-model.md`), not a shared table with a company-id filter.
A real, confirmed wrinkle found directly in Akaunting's own commit history:
`company_id` was deliberately *dropped* from some tables (e.g. `user_roles`)
in a later version (`2022_06_28_000000_core_v304`) — its own multi-tenancy
boundary moved around over time, not fixed from day one.

**A real, modular "apps" ecosystem**: beyond its own core tables, Akaunting
ships a `Module` package (a real, separate, `akaunting/module` GitHub
repository) so a purchased or installed app can add its own tables via its
own migrations folder (`modules/<AppName>/Database/Migrations`), scoped
entirely outside the core schema. This is the real, structural reason its
own feature list (below) is so broad — much of it is optional, paid,
separately-installed apps, not the base, free, on-premise product.

### Real, confirmed feature set, from Akaunting's own site (`akaunting.com/features`, `/apps`)

**Already built and working here, matching or exceeding Akaunting's own base feature**:

| Akaunting feature | This application |
|---|---|
| Bank Accounts (unlimited, opening/current balance) | Chart of Accounts, real bank/cash accounts, Cash at Bank (per-currency where nominated) |
| Multi Company | Real, structural per-business entity subtree — every business genuinely isolated |
| Powerful Reporting | Trial Balance, Balance Sheet, P&L (two-axis), Sales Report, Stock Movement Report, Compare Ledgers |
| Recur Everything (recurring invoices/bills/payments) | A real route exists (`/recurring`) — see `sql-ledger-comparison.md`'s own note, currently a stub |
| Various Payments (non-billable expenses as payments) | Cash Purchase / Cash Sale (bypass AR/AP entirely for immediate settlement) |
| Tax Rates (named, per-product) | Real, per-line tax handling throughout AR/AP/POS |
| Multi-Currency (invoices/expenses in any currency, converted to home) | This application's own, deliberately different design — see below |
| Discount | Not yet a first-class, named concept — handled today only via a direct, manual price adjustment |
| Unlimited Attachments | Not yet implemented |
| Transaction Categories (income/expense/item categories) | The real Category → Product → Item hierarchy (see `user-manual-ch2-configuration.md`) — more structured than a flat category tag |
| Bulk Actions (enable/disable/export/delete in batch) | Not yet implemented as a general, cross-screen mechanism |
| Dashboards & Widgets | Not yet implemented |
| Vendor Management | Vendors (via the real Contact-type mechanism — see `contact-types-and-translations.md`) |
| Customer Management, Customer Summary | Customers (same mechanism); a dedicated "profile at a glance" summary screen is not yet built |
| Client Portal (share invoices, accept bulk online payment) | Not yet implemented — no self-service client-facing portal exists |
| Deposits & Transfers between accounts | Stock Transfer exists for inventory; a dedicated cash-account-to-cash-account transfer screen does not yet exist separately from a manual journal entry |

**A real, deliberate design difference, not a gap**: Akaunting's own
Multi-Currency feature converts a foreign-currency invoice/expense into the
business's home currency automatically, at entry time. This application's
own, deliberate, opposite design (see `multicurrency-design.md`) keeps a
foreign-currency transaction in its own, real, foreign currency all the way
through to a currency-tagged Trial Balance group — conversion to home
currency happens only later, as its own, real, deliberate, manual journal
entry realizing an actual gain or loss at whatever rate was actually
achieved. Akaunting's approach is simpler for a business that only
occasionally touches a foreign currency; this application's own approach is
more accurate for a business that genuinely holds foreign-currency balances
for a real period of time.

**Genuinely missing here, confirmed directly from Akaunting's real feature list and app-category breadth** (Akaunting's own App Store lists 16 real categories: Accounting, CRM, eCommerce, Help Desk, HR, Import Export, Inventory, Notification, Operation, Payment Method, Point of Sale, Project Management, Regulation, Report, Time Tracking, Widget):

- **CRM** — lead/pipeline tracking (a real, separate, paid Akaunting app; this application has Contacts but no sales-pipeline concept)
- **Client Portal** — a real, separate, customer-facing login where a customer sees their own invoices and pays online
- **Payroll as a dedicated app** — this application has direct wage payment; Akaunting's own Payroll app adds pay calendars and print-ready payslips as a distinct, further concept
- **Projects/Time Tracking** — Projects & Jobs exists here as a menu section (see `user-manual-appendix-screens.md`) but is not yet built out to Akaunting's own "organize tasks, work with teams, track time" depth
- **Expense Claims** (employee submits, manager approves, on the go) — not yet a distinct workflow here
- **Bank Feeds** (automatic transaction import from a connected real bank) — not yet implemented
- **A real App Store / plugin ecosystem** — this application has no equivalent extensibility mechanism; every feature is built directly into the one, real codebase

### What this comparison does not cover

Akaunting's own Point of Sale, eCommerce, and Import/Export app categories
were not individually explored in this pass — each is its own, further,
separately-installed app on Akaunting's side, and a fair, real comparison
against this application's own, already-built POS Terminal and stock-receipt
mechanisms would need its own, dedicated, further review.
