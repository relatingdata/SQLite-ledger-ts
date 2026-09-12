## Comparison against SQL-Ledger, LedgerSMB, and (briefly) Odoo

A direct, honest, module-by-module comparison against SQL-Ledger's own
real, documented feature set (per its own user manual's table of
contents and public feature lists), noting for each real item: already
built and working here, a route that exists but is still a real,
confirmed stub, genuinely missing entirely, or a case where this
application already has a real, more modern approach and shouldn't
simply copy SQL-Ledger's own, older design. A real LedgerSMB and Odoo
comparison follows further down, covering the real, new work built
since this document was first written.

### Already built and working here

Table: Every real SQL-Ledger module already built and working here, and its own, real, current equivalent

| SQL-Ledger module | This application |
|---|---|
| AR (customers, invoices, cash receipt, transaction/customer reporting) | AR Sale, AR Receipt, Invoices, Aged Receivables, Customer Statement, Reminders |
| AP (vendors, invoices, cash payment, transaction/vendor reporting) | AP Purchase, AP Payment, Invoices, Aged Payables |
| General Ledger, Chart of Accounts | General Journal, Journal Entries, the real Chart of Accounts editor |
| Inventory Control, "how COGS is tracked" | The real (product × location) Sales/COGS/Inventory grid — genuinely more granular than SQL-Ledger's own, flat, per-part accounts |
| Point of Sale, Sales Screen | POS Terminal |
| Purchase Orders, Receiving | Purchase Order, Stock Receipt |
| Sales Orders, Shipping | Sales Order, Stock Dispatch |
| Shipping Module (warehouse-to-warehouse transfer) | Stock Transfer |
| HR | Wage payment, employee directory, organization chart |
| Translations, multi-language | The real, generic Vocabulary/translation mechanism |
| Reporting (per-module) | Trial Balance, Balance Sheet, P&L (including the New New P&L's own two-axis breakdown), Sales Report, Stock Movement Report, Compare Ledgers |
| Voucher System | General Ledger Voucher, Payable Voucher, Payment Voucher |
| Recurring transactions | A real route exists (`/recurring`) — currently a stub, see below |

### Routes that exist but are still real, confirmed stubs

These are real, present menu items and routes — not missing from the
navigation — but genuinely not yet implemented behind them:

- **Quotations** (`/arap/quotations`) — SQL-Ledger's own "Quotations and Order Management"
- **RFQ** (`/arap/rfq`) — SQL-Ledger's own "Requests for Quotation"
- **Assembly/BOM** (`/logistics/assembly-bom`) — SQL-Ledger's own "Assemblies and Manufacturing"
- **FX Adjustment** (`/gl/fx-adjustment`) — SQL-Ledger's own foreign-currency revaluation
- **Recurring transactions** (`/recurring`) — SQL-Ledger's own "Recurring Invoices"
- **Projects**, **Jobs** — SQL-Ledger's own "Projects" module (project basics, timecards, project-linked invoices)

### Genuinely missing entirely — not even a stub route yet

- **Timecards** — a real, basic form of this already exists: clocking in
  via `/projects` stages a real Purchase Order against a project's
  expense account; clocking out computes real hours worked × the
  employee's own wage rate and posts that as a real, valued cost
  against the project. What's genuinely still missing: multi-project,
  multi-site scheduling, Gantt-style visual planning, and project
  budgets — see `construction-project-management-plan.md`.
- **Check/cheque printing** — SQL-Ledger can print a physical cheque directly from an AP payment. Payments here post correctly but there's no print-a-cheque capability.
- **Price Matrix / Pricegroups** — SQL-Ledger supports different, real selling prices per customer group (e.g. Wholesale vs. Retail tiers). This application's own `part_source` table already covers the *purchase*-side equivalent (different vendors, different prices) — the *sales*-side, per-customer-group pricing tier has no equivalent yet.

### Where this application already has a better, more modern approach — not a gap to close by copying SQL-Ledger

- **The entity tree itself.** SQL-Ledger's own schema is a real, fixed set of separate tables per concept (`ar`, `ap`, `parts`, `customer`, `vendor`, each with its own columns). Everything here — a customer, a division, a location, a vocabulary word, a report name — is one, single, uniform entity tree, walked by `parent_id`, with the same generic relationship/dimension mechanism serving every real, lateral classification (COGS tagging, Location, a product's own region or brewer) rather than a new column or table per concept.
- **Real (product × location) Sales/COGS/Inventory**, not a flat, single account per part — SQL-Ledger's own inventory accounting doesn't distinguish which physical location a sale or COGS entry happened at without a separate, bolted-on mechanism.
- **The New New P&L's own two-axis breakdown** (division and location simultaneously, either as the outer or inner grouping) — genuinely beyond what SQL-Ledger's own, single-axis reports offer.
- **Live, structural division/location derivation** (`getDivisionForAccount`, `getLocationForAccount`) walking the real account's own ancestor chain, rather than a separate, maintained tag column that can silently drift out of sync with the real structure.
- **Scoped, not global, entity-name uniqueness** — a company, a division, a location, and an employee can all genuinely be named "Springfield" at once; SQL-Ledger's own, flatter schema has no equivalent concept to get this right or wrong.

### A concrete, honest recommendation for what to build next

Of the genuine gaps above, **check printing** is the most likely to
matter for a real, live SMB user still paying vendors by physical
check. Price Matrix / Pricegroups is real but more of a nice-to-have
depending on the business type; Quotations, RFQ, and Assembly/BOM are
already flagged, real, present stubs — Assembly/BOM specifically is no
longer a stub as of the real, working wine-bar-assemblies work below.
Timecards, corrected above, already has a real, basic, working
foundation (clock in/out against a project's expense account) — the
genuine, remaining gap is multi-project scheduling, not "no way to log
time at all."

## Real, new work since this document was first written, against LedgerSMB and Odoo directly

### Assembly/BOM — no longer a stub, built on LedgerSMB's own documented concept

LedgerSMB's real, documented "Assembly" (a product manufactured
on-site from parts/services/labor) directly informed the real,
working Bill of Materials mechanism built this session
(`stageBomComponent`/`postBomComponents`/`getBomComponents`,
`docs/wine-bar-assemblies-plan.md`) — including LedgerSMB's own real,
documented workaround for continuously-produced items ("restock the
assembly to 0" rather than pre-batching stock), directly applicable to
a cocktail or a glass of wine. This closes the `/logistics/assembly-bom`
stub genuinely, not just cosmetically — real components, real
quantities, a real, direct, tested posting mechanism.

### Project scheduling — a real, honest first slice, genuinely far short of Odoo's own, mature offering

Real, direct research into Odoo's own Project module confirms a
mature, production-grade feature set this application does not
attempt to match yet: real critical-path-method (CPM) scheduling,
resource-utilization heatmaps, multi-project "Global Gantt" views, and
earned-value budget tracking, sold as a real, distinct, priced
capability. What was actually built here this session
(`createProjectTask`/`addTaskDependency`/`getTaskDependencies`,
`docs/construction-project-management-plan.md`) is a real, honest,
much smaller first slice — tasks with real schedules and real,
individual dependency edges, with the critical-path *algorithm itself*
still only described in the plan document, not yet implemented. This
is stated directly, not glossed over: real progress, genuinely nowhere
near Odoo's own, mature Gantt/CPM feature.

### Multi-language / RTL — a real, working mechanism, modest next to Odoo's own, mature i18n

Odoo genuinely ships broad, mature multi-language support as standard
(Arabic among its own, real, predefined languages in third-party
modules found directly). This application's own real RTL mechanism
(`setLanguageDirection`/`getLanguageDirection`, Hebrew and Arabic
seeded as genuine, permanent, first-class languages) is a real,
working, generic foundation — any future RTL language is a real,
ordinary "Add Language" UI action — but the actual vocabulary (738
real words) is, honestly, translated into only 5 languages so far,
with Hebrew/Arabic's own real translations still to be filled in
incrementally through the existing Translations screen. The
*mechanism* is sound and tested; the *content* is real, live, ongoing
work, not finished.
