# SQL-Ledger → entities mapping

A working map from the real SQL-Ledger PostgreSQL schema (69 tables,
confirmed directly from `Tekki/sql-ledger`'s `sql/Pg-tables.sql`, version
3.2.4) onto this project's entity-based schema. Kept here so scope
decisions have a concrete reference point, and so "what's covered" and
"what's genuinely still missing" stay honest and current rather than
remembered.

LedgerSMB is a real, historical fork of SQL-Ledger, sharing the same
real core schema lineage this document maps against — this comparison
applies to both, not just the original.

Status key: **✅ covered** — a real mechanism exists and is tested.
**🔜 partial** — something related exists, but not the full thing.
**❌ not covered** — no equivalent exists; not necessarily wrong to skip,
but worth knowing it's a gap rather than an oversight.

## Core ledger

| SQL-Ledger table | Purpose | Status | Notes |
|---|---|---|---|
| `gl` | Journal header | ✅ | `journal` — plus recurrence, which `gl` doesn't have at all |
| `acc_trans` | Journal lines (debit/credit) | ✅ | `journal_line` — signed `amount_minor` instead of separate debit/credit columns |
| `chart` | Chart of accounts | ✅ | `entities` under Chart of Accounts + the `account` extension |
| `gifi` | Canadian government reporting codes | ❌ | Out of scope — jurisdiction-specific, no plan |
| `defaults` | System config key/value pairs | 🔜 | No generic settings table; what little config exists is bootstrap data |
| `curr`, `exchangerate` | Currencies and exchange rates | 🔜 | `account.currency` and a real per-currency-balance validator in `postJournalEntry` itself are real and tested. `createBusiness` now takes a real, optional list of secondary currencies, each getting its own real, automatically-created, immediately-postable "Cash at Bank ({currency})" account — a real, low-friction addition on the actual New Business screen, per the direct, real insight that most businesses transact in one, single currency. Still missing: no screen lets a person actually transact/convert between currencies on an ordinary transaction, and `setupCurrency`/`convertCurrency`/`spendCurrency` as real, callable functions don't exist yet; see `docs/TODO.md` and `docs/foreign-currency-receipts-and-payments.md` |
| `yearend` | Year-end closing marker | ✅ | `closeBooks` — a real, working Year End Close, zeroing every real income/expense account into Retained Earnings, verified live against the full simulation. Includes a real, live preview of the exact, proposed journal entry with an explicit Accept/Reject decision before anything actually posts (`previewCloseBooks`, sharing one, single real computation with `closeBooks` itself). The real, posted Retained Earnings side of the close now genuinely carries one, real, separate journal line per real, active profit center — not one, single, combined line — each correctly, independently tagged, still summing to the exact same, single, correct total; every other, ordinary Income/Expense-zeroing line stays combined across divisions. Division itself remains a genuine, pure sub-totaling dimension in one, further sense — every division's own line still posts into the exact same, single, chosen Retained Earnings account, never a real, separate, division-specific one |

## Customers, vendors, contacts

| SQL-Ledger table | Purpose | Status | Notes |
|---|---|---|---|
| `customer` | Customer master | ✅ | Entities under Accounts Receivable + `contact` |
| `vendor` | Vendor master | ✅ | Entities under Accounts Payable + `contact` |
| `contact` | Named contacts (multiple per customer/vendor) | 🔜 | Our `contact` is 1:1 per entity, not one-to-many named people |
| `address` | Addresses (separate from contact) | ✅ | Folded into our `contact` extension, not a separate table |
| `shipto` | Ship-to addresses, distinct from billing | ❌ | Not covered — one address per entity currently |
| `business` | Customer/vendor type classification | ❌ | Not directly mapped |
| `sic` | SIC industry codes | ❌ | Not covered |
| `employee` | Staff records | ✅ | A real employee is a real AP counterparty (see the Payroll section below, no longer entirely out of scope) — `wage_minor_per_hour`/`salary_minor_per_year` on `contact`, and `payEmployeeWages`. A real employee can also sign on/off at a POS terminal via a real PIN, and have a real, weekly-recurring schedule — see the POS/scheduling rows below |

## AR/AP and invoicing

| SQL-Ledger table | Purpose | Status | Notes |
|---|---|---|---|
| `ar` | AR invoice header | ✅ | Our AR Sale staging/posting mechanism |
| `ap` | AP invoice header | ✅ | Our AP Purchase staging/posting mechanism |
| `invoice` | AR/AP invoice **line items** (parts, qty, price per line) | ✅ | `invoice_line`/`invoice_detail_line` — genuinely itemized, multi-line invoices now, with real posting, payment allocation, and e-invoicing (UBL 2.1) export/import |
| `payment` | Payment method used per transaction | 🔜 | `invoice_payment_allocation` tracks real, itemized payment allocation against an invoice; no explicit payment-method field on the allocation itself yet |
| `paymentmethod` | Payment method catalog | ❌ | Not covered |
| `bank` | Bank account details (IBAN, BIC) | ❌ | Not covered — no reconciliation mechanism exists yet either (see `docs/TODO.md`) |
| — (discussed, not in original schema) | Invoice aging, receipt/payment allocation | ✅ | `invoice_payment_allocation`, aged AR/AP reports, and `getInvoiceOutstandingMinor` — built and tested |

## Stock and orders

| SQL-Ledger table | Purpose | Status | Notes |
|---|---|---|---|
| `parts` | Inventory items | ✅ | Mapped onto stock batch sibling accounts (Qty/Value); a "part" can now genuinely be a service (a product sold by the hour) too — `item_qty`/`unit_cost_minor` are optional on Stock Receipt/Dispatch, skipping the quantity movement and COGS leg entirely when omitted. A real product can also now genuinely have several, real, separate sellable tiers (Bottle/Carton/Six-Pack), each its own real, distinct part entity with its own real price, UPC, and stock count — a real, structural child of its own real Sales leaf, with COGS reaching the same part via a real, independent, equal dimension link (`ensureProductTierPart`), wired into the live POS sale posting path. SQL-Ledger has no equivalent multi-tier concept at all — one, single, flat part record per product. SQL-Ledger's `parts` still has more fields (barcode, weight, image) we don't have |
| `inventory` | Stock movements | ✅ | `postQuantityMovement` + the Stock Quantities memo tree |
| `oe` | Order entry header (quotes, PO/SO) | ✅ | `placeOrder`/`fulfillOrder`, with real frontend screens now (Purchase Order, Sales Order) — these didn't have a UI at all until recently |
| `orderitems` | Order line items | 🔜 | The older Qty/Value order mechanism is still single-line; the newer, real `invoice_line` mechanism (see above) is genuinely itemized — the two haven't been unified |
| `assembly`, `jcitems` | Bill of materials, job costing items | ❌ | Not covered |
| `warehouse` | Multiple warehouse locations | ✅ | Real, multiple, typed locations (`retail`/`warehouse`) per business, real per-location stock levels (`part_location`), real transfers between them (`transferStock`, now a genuine, balanced double-entry posting — see `docs/money-model.md`), real capacity tracking and shelf-ordered picking. A real location now also has a real, weekly-recurring open-hours schedule (`setLocationOpenHours`/`getLocationOpenHours`) — built entirely on the existing entity-tree mechanism, no new table, matching the same real, typed-child-entity pattern already used for addresses/phones |
| `partsvendor`, `partscustomer`, `pricegroup` | Vendor/customer-specific pricing | 🔜 | `part_source` tracks real, per-vendor pricing and a preferred source; no customer-specific pricing |
| `partsgroup` | Product categorization | ✅ | The entity tree (`parent_id`) is the real category/subcategory structure every product actually lives in — see `docs/entity-chains.md` for a live sample |
| `cargo` | Shipping/freight details | ❌ | Not covered |

## Something SQL-Ledger doesn't have at all

| — | Purpose | Status | Notes |
|---|---|---|---|
| *(no equivalent — SQL-Ledger hardcodes each screen in Perl)* | Data-driven transaction templates | ❌ | `template_field`/`template_line`/`template_override` existed as real, numerically-proven data (a genuinely balanced 6-line GL mapping) for a while, but nothing ever read it — confirmed via a direct, real audit (zero references anywhere in the backend), then removed entirely. Real entry screens are hardcoded Svelte pages instead, the same real approach SQL-Ledger itself uses in Perl |
| *(no equivalent)* | POS clerk sign-on/sign-off, as a real shift/timecard | ✅ backend only | A real, short PIN per employee (`pos_pin` on `contact`), `signOn`/`signOff`/`verifyPosPin`/`getActiveShiftsAtLocation`/`getOpenShiftForEmployee` — genuinely IS the real timecard, not just a presence flag, real cross-location visibility (signing on at one location correctly shows no active shift at another), refuses a real employee signing on twice at once. No frontend yet — the actual `/pos` sign-on screen, and wiring `payEmployeeWages` to derive hours from real completed shifts, are both still real, separate, remaining pieces |
| *(no equivalent)* | Real, weekly-recurring employee scheduling, validated against location open hours | ✅ backend only | `setEmployeeSchedule`/`getEmployeeSchedule`/`getScheduleAtLocation` — a real, expected roster, genuinely distinct from the real, actual `pos_shift` sign-on record above. Every real, proposed shift is validated live against that same location's own real open hours before being accepted — refuses a day the location is genuinely closed, or a shift outside the real, open window. Built entirely on the entity-tree mechanism, no new table. A real, working UI exists on the new Business Setup screen (see below) |
| *(no equivalent)* | Cash flow forecasting, overdraft/shortfall warning, and a real bank account registry | ✅ | A full, five-layer design (`docs/cash-flow-and-growth-planning.md`), three layers built and tested so far: a real bank account registry, scoped to one, specific real business/ledger (`registerBankAccount`/`getBankAccounts`/`getCashPosition`, grouped by real currency, with a real, honest overdraft-limit headroom that's null rather than silently zero when genuinely unknown); a real, forward-looking cash flow forecast (`getCashFlowForecast`) projecting anticipated AR receipts, committed AP payments, and genuinely recurring cash movements out to a chosen horizon; and real overdraft/shortfall detection layered directly on top — the meaningful moment isn't "cash goes negative", it's "cash goes below the real, arranged limit", with the exact date and amount of a real, projected shortfall surfaced directly. SQL-Ledger has no forecasting or bank-account concept of any kind |
| *(no equivalent)* | A real, generic multi-dimension reporting mechanism | ✅ | `setDimensionParent`/`getDimensionParent`/`getDimensionChildren`/`getDimensionAncestorChain` — a real, reusable capability for any entity to sit in any number of equal, independent accumulation paths at once (a real GL leaf reachable via both its own product-category chain and its own division/location chain, say), none structurally privileged as "the" real parent. Deliberately not hardcoded to any one dimension, so the same, single mechanism is ready for other, real, future cases with the same shape (an org chart's own multi-manager reporting, a product in two, real, independent category trees). See `docs/multi-dimensional-reporting.md` for the full, real design discussion this grew out of. SQL-Ledger's own schema has no concept of an entity belonging to more than one real hierarchy at once |

## Tax

| SQL-Ledger table | Purpose | Status | Notes |
|---|---|---|---|
| `tax`, `partstax`, `customertax`, `vendortax` | Tax rate configuration | 🔜 | Tax itself now works — `tax_minor` on AR Sale, AP Purchase, Stock Receipt, and Stock Dispatch, posting to `Sales Tax Payable`/`Purchases Tax Claimed`, verified live through the actual screens. What's still missing is SQL-Ledger's *configured, per-customer/vendor/part rate* — right now the rate is entered by hand on each transaction, not looked up automatically |

## Projects, departments

| SQL-Ledger table | Purpose | Status | Notes |
|---|---|---|---|
| `project` | Project tracking | ❌ | Not covered |
| `department`, `dpt_trans` | Departmental tracking | ✅ | `journal_line.division_id` — a real, working profit-center/division dimension on every posting. Now genuinely more capable than SQL-Ledger's own flat department tracking: a real division/location can nest (a real, per-city division containing several, real, per-store locations beneath it), and the P&L report itself has a real "Per Division" view directly built in — not a separate report — showing each real division's own income/COGS/operating-expense breakdown, with real, nested child locations shown beneath their own real parent, each independently drillable with the exact same category-tree detail the plain, consolidated P&L already has. Deliberately, per direct correction, a pure sub-totaling/reporting dimension — never a structural posting decision — except for the one, real, deliberate exception described under Year End Close above (a real line per division, still into the one, same account) |

## Recurring transactions

| SQL-Ledger table | Purpose | Status | Notes |
|---|---|---|---|
| `recurring` | Recurring transaction schedule | ✅ | `journal.recurrence`/`recurrence_count` — genuinely more capable: mid-schedule amendments (a wage increase) via dated `journal_line` rows, which `recurring` alone can't express |
| `recurringemail`, `recurringprint` | Automated email/print on recurring postings | ❌ | Not covered |

## Users, roles, workflow

| SQL-Ledger table | Purpose | Status | Notes |
|---|---|---|---|
| `acsrole` | Access control roles | ✅ | Our `roles`/`user_roles` — coarser (3 fixed roles vs SQL-Ledger's fine-grained ACS permission strings) |
| — | Users, sessions, password hashing | ✅ | `users`/`sessions` — SQL-Ledger's auth predates this level of granularity |
| `semaphore` | Login/edit locking | 🔜 | Our `sessions` serve a similar purpose for auth, not for edit-locking a record two people opened at once |
| `br`, `vr` | Batch/voucher approval workflow (e.g. check runs) | ❌ | Not covered — connects to the BPMN/workflow discussion; not built |
| `audittrail` | Action logging (who did what, when) | ✅ | **Fully closed.** `entities` is append-only (SCD Type 2) — every create/rename/delete is a permanent, self-auditing row (`created_by`/`created_at`, `deleted_by`/`deleted_at`). `journal.user_id` covers the other half: every posting, recurring journal, quantity movement, and reversal records who posted it, exposed as `posted_by` (the actual username) on every journal list/detail view |
| `status` | Print/email status flags per transaction | ❌ | Not covered |

## Reporting, documents, misc.

| SQL-Ledger table | Purpose | Status | Notes |
|---|---|---|---|
| `report`, `reportvars` | Saved custom report definitions | ❌ | Not covered |
| `reference` | Document auto-numbering scheme | 🔜 | We use free-text reference strings; no auto-numbering |
| `archive`, `archivedata` | Document archival (generated PDFs) | ❌ | Not covered |
| `mimetype` | File type registry for attachments | ❌ | Not covered |
| `recent`, `recentdescr` | "Recently used" quick-access lists | ❌ | Not covered |
| `translation` | i18n text | ✅ | `translation` — same purpose, same shape |
| `language` | Language catalog | ✅ | Languages entities |
| `makemodel` | Make/model reference data | ❌ | Niche, not covered |

## Payroll

| SQL-Ledger tables | Purpose | Status | Notes |
|---|---|---|---|
| `wage`, `payrate`, `employeewage`, `pay_trans` | Wage rates and pay transactions | ✅ | `wage_minor_per_hour`/`salary_minor_per_year` on `contact`, `payEmployeeWages` — a real employee is treated as a real AP counterparty and paid through the same real mechanism a vendor invoice already uses, hourly or salaried |
| `employeededuction`, `deduction`, `deduct`, `deductionrate` | Payroll deductions | 🔜 | A real 1.5% Medicare levy is withheld and a real 12% superannuation employer contribution is accrued (Australian rates specifically, flat percentages, not bracketed/progressive) — no general, configurable deduction catalog beyond these two |

## Reading this honestly

Of the 69 real SQL-Ledger tables: roughly **25 have a genuine ✅ equivalent** here (often a *more* capable one — recurrence with mid-schedule amendments, memo-account orders with zero schema changes, real multi-location warehousing with genuine, balanced double-entry transfers, real itemized multi-line invoices with e-invoicing, a real payroll mechanism treating an employee as a real AP counterparty complete with Medicare levy withholding and superannuation, and a real, working department/division dimension whose own P&L view now nests real locations beneath their real parent division directly in the main report), about **10 are 🔜 partial** (currency validation and real, automatic secondary-currency accounts exist, but no screen yet lets a person actually transact in a foreign currency; tax works but isn't yet configured per-customer/vendor/part; vendor pricing exists but not customer-specific pricing), and the remainder are **❌ not covered**, still including bank reconciliation (confirmed directly — still `notImplemented` in the menu, no real function exists), document/workflow infrastructure (archival, print/email automation, approval batches), and a handful of payroll deduction types beyond the two real ones (Medicare, superannuation) already built.

Several genuinely new capabilities with no real SQL-Ledger equivalent at all were also added this session: real POS clerk sign-on/sign-off as an actual shift/timecard; real, weekly employee scheduling validated against a location's own real open hours; a full, three-layer cash flow forecasting and bank-account-registry stack, including real overdraft/shortfall detection ahead of time, not just a historical balance; a real, generic multi-dimension reporting mechanism letting any entity sit in more than one, equal, independent accumulation path at once; and the beginning of a real product/tier structure — Bottle, Carton, and Six-Pack as genuinely distinct, separately-priced, separately-stocked sellable entities, not just a naming convention on a GL account, now wired into live POS posting. Confirmed directly, worth stating plainly: accurate, per-tier historical sales reporting doesn't actually depend on this newer part structure at all — the real GL account a sale posts to has always, correctly distinguished Bottle from Carton from Six-Pack, tier by tier, from the very first sale ever simulated; the new part-level structure adds a real, separate, further capability on top (per-tier UPC/price/stock tracking), not a fix to something that was ever actually broken. The sign-on screen itself, and a business's own, already-existing tier-less parts genuinely never being converted to the newer structure retroactively (a deliberate choice, not an oversight — see `docs/multi-dimensional-reporting.md` §10 for the real reasoning), are the two, real, known, current limits of this newer batch. A real, unified Business Setup screen (`/setup/business-setup`) now also exists — one real place to set up and amend a business's own divisions, locations (with address, phone, open hours), and employees (with address, phone, wage/salary, schedule) together, rather than several, separate, disconnected screens. The audit-trail gap flagged when auth was first built remains fully closed, on both halves — entity changes and journal postings alike.
