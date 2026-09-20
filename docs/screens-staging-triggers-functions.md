## Every real data-entry screen: its own screenshot, staging table, trigger, and backend function

A complete, visual, code-level reference: for every real screen that
posts a transaction, this section shows what the screen actually looks
like, the exact, real staging table it writes to, the trigger (or
TypeScript function, where the posting logic is too involved for a
single SQL trigger) that turns staged rows into a posted journal
entry, and the exact, real backend function prototype the screen
calls — matching the branded types documented earlier in this Part.

### The two, shared, core mechanisms every screen ultimately relies on

Two real triggers do all of the actual posting work in this
application. Every screen below either calls one of these two
directly, or stages into its own, real, screen-specific table whose
own trigger then calls into `journal_entry_staging` in turn — there is
never a third, separate posting mechanism anywhere in the system.

**`post_journal_entry_insert`** — the real, balanced, double-entry
posting trigger. Every real financial transaction (a debit here, a
credit there, always summing to zero) goes through this one trigger,
regardless of which screen staged it:

```sql
CREATE TRIGGER post_journal_entry_insert INSTEAD OF INSERT ON post_journal_entry
BEGIN
  SELECT RAISE(ABORT, 'entry does not balance (per currency)')
  WHERE EXISTS (
    SELECT 1 FROM (
      SELECT COALESCE(a.currency, '') AS grp, SUM(s.amount_minor) AS grp_sum
      FROM journal_entry_staging s
      LEFT JOIN account a
        ON a.entity_id = COALESCE(s.account_id,
             (SELECT id FROM current_entities WHERE name = s.account))
      WHERE s.reference = NEW.reference AND s.business = NEW.business AND s.ledger = NEW.ledger
      GROUP BY COALESCE(a.currency, '')
    )
    WHERE grp_sum != 0
  );
  -- Auto-creates a real `account` row the first time an entity is
  -- ever posted to, resolves the ledger by both name AND its own
  -- known business (never a bare, unscoped lookup — see the earlier
  -- section on why), inserts the real journal header and every real
  -- journal_line, updates each real account's own running balance,
  -- then clears the staging rows this reference used. Full text in
  -- backend/schema/00-core.sql.
END;
```

**`post_quantity_movement_insert`** — the real, single-line quantity
trigger. A stock movement (received, dispatched, transferred, written
off) is genuinely **not** a balanced, double-entry transaction — it's
one, real line against one product's own quantity-tracking account.
Requiring it to sum to zero would force inventing a fake, meaningless
offsetting account just to satisfy a check that doesn't apply here:

```sql
CREATE TRIGGER post_quantity_movement_insert INSTEAD OF INSERT ON post_quantity_movement
BEGIN
  -- The exact, same real resolution pattern as post_journal_entry_insert
  -- above (COALESCE(account_id, name-lookup), ledger scoped by its own
  -- known business) — but no balance check at all, since a real
  -- quantity movement is genuinely one-sided by design. Full text in
  -- backend/schema/00-core.sql.
END;
```

\clearpage

### AR Sale

![The AR Sale screen — a sale to a customer on credit.](manual-images/ar_sale.png)

A sale to a customer on credit — debits Accounts Receivable, credits
Sales Revenue (and Sales Tax Payable, if any). Stages into its own,
real, screen-specific table first, whose own trigger then builds the
real, balanced entry into `journal_entry_staging`:

```sql
CREATE TABLE ar_sale_staging (
  reference TEXT NOT NULL, business TEXT NOT NULL, ledger TEXT NOT NULL,
  customer TEXT NOT NULL, amount_minor INTEGER NOT NULL,
  tax_minor INTEGER NOT NULL DEFAULT 0,
  location TEXT, -- real, direct, per-invoice location — not per line
  transdate TEXT, description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (reference, business, ledger)
);
CREATE TRIGGER ar_sale_post_insert INSTEAD OF INSERT ON ar_sale_post
BEGIN
  -- Stages a debit to the customer's own AR balance, a credit to
  -- Sales Revenue (or "Sales Revenue — {location}" when a real
  -- location was given), a credit to Sales Tax Payable if any tax was
  -- charged, then inserts into post_journal_entry — the exact, same,
  -- shared trigger documented above. Full text in
  -- backend/schema/00-core.sql.
END;
```

Backend prototype (architecture: a real, direct interface per screen,
never a generic "account/amount" pair — see Part II, "The pattern
every real data-entry screen now follows"):

```typescript
export function stageArSale(input: ArSaleInput): void
export function postArSale(
  reference: string, business: BusinessName, ledger: LedgerName, userId: number
): void
```

\clearpage

### AR Receipt

![The AR Receipt screen — a customer paying down their outstanding balance.](manual-images/ar_receipt.png)

A real customer payment, reducing their own AR balance — debits Cash
and Bank, credits the customer directly. The simplest of the four
AR/AP screens, since no tax or location dimension applies to a receipt
of cash itself:

```sql
CREATE TABLE ar_receipt_staging (
  reference TEXT NOT NULL, business TEXT NOT NULL, ledger TEXT NOT NULL,
  customer TEXT NOT NULL, amount_minor INTEGER NOT NULL,
  transdate TEXT, description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (reference, business, ledger)
);
CREATE TRIGGER ar_receipt_post_insert INSTEAD OF INSERT ON ar_receipt_post
BEGIN
  -- Debits Cash and Bank, credits the customer directly, then inserts
  -- into post_journal_entry. Full text in backend/schema/00-core.sql.
END;
```

```typescript
export function stageArReceipt(input: ArReceiptInput): void
export function postArReceipt(
  reference: string, business: BusinessName, ledger: LedgerName, userId: number
): void
```

\clearpage

### AP Purchase

![The AP Purchase screen — a purchase from a vendor on credit.](manual-images/ap_purchase.png)

The real, direct mirror of AR Sale on the purchasing side — debits a
real, chosen expense/asset account, credits the vendor's own AP
balance:

```sql
CREATE TABLE ap_purchase_staging (
  reference TEXT NOT NULL, business TEXT NOT NULL, ledger TEXT NOT NULL,
  vendor TEXT NOT NULL, expense_account TEXT NOT NULL,
  amount_minor INTEGER NOT NULL, tax_minor INTEGER NOT NULL DEFAULT 0,
  location TEXT, transdate TEXT, description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (reference, business, ledger)
);
CREATE TRIGGER ap_purchase_post_insert INSTEAD OF INSERT ON ap_purchase_post
BEGIN
  -- Debits the chosen expense_account (or "{account} — {location}"
  -- when given), debits Purchases Tax Claimed if any, credits the
  -- vendor for the full amount including tax, then inserts into
  -- post_journal_entry. Full text in backend/schema/00-core.sql.
END;
```

```typescript
export function stageApPurchase(input: ApPurchaseInput): void
export function postApPurchase(
  reference: string, business: BusinessName, ledger: LedgerName, userId: number
): void
```

\clearpage

### AP Payment

![The AP Payment screen — paying down a vendor's outstanding balance.](manual-images/ap_payment.png)

The direct mirror of AR Receipt — debits the vendor (reducing the real
liability), credits Cash and Bank:

```sql
CREATE TABLE ap_payment_staging (
  reference TEXT NOT NULL, business TEXT NOT NULL, ledger TEXT NOT NULL,
  vendor TEXT NOT NULL, amount_minor INTEGER NOT NULL,
  transdate TEXT, description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (reference, business, ledger)
);
CREATE TRIGGER ap_payment_post_insert INSTEAD OF INSERT ON ap_payment_post
BEGIN
  -- Debits the vendor, credits Cash and Bank, then inserts into
  -- post_journal_entry. Full text in backend/schema/00-core.sql.
END;
```

```typescript
export function stageApPayment(input: ApPaymentInput): void
export function postApPayment(
  reference: string, business: BusinessName, ledger: LedgerName, userId: number
): void
```

\clearpage

### Cash Sale and Cash Purchase

![The Cash Sale screen — an immediate, no-account retail sale.](manual-images/cash_sale.png)

![The Cash Purchase screen — an immediate, no-account purchase.](manual-images/cash_purchase.png)

Both are real, direct callers of the exact, same functions POS and AP
Purchase use underneath (`completePosSale` with no real location, and
`completeCashPurchase`) — not a separate, third posting path. The
real, architectural reason: "why go through the AR/AP system at all
for a payment that settles immediately?" — a real, immediate cash
transaction has no genuine receivable or payable, even momentarily, so
these skip straight to the real Sales/COGS or expense accounts,
bypassing Accounts Receivable/Payable entirely (see
`counterpartyAccountOverride` in Part II).

**A real, confirmed, live, user-facing bug, found directly while
debugging a persistently-failing e2e test, not a test artifact**:
`CashTransaction.svelte` (the one, real, shared component behind both
of these screens) sent every real line to the server on submit,
including the always-present, auto-added, trailing blank line (the
same "type here to add another" convention already used elsewhere in
this codebase). The real, live backend correctly rejected this
(`lines: String must contain at least 1 character(s)`), silently
failing every real Cash Purchase or Cash Sale that reached this
point — the person would see an unhelpful, generic error with no
indication the actual cause was an invisible, empty fourth line they
never touched. Checked directly whether the two sibling forms
(`ap-purchase`, `ar-sale`) shared this same flaw; they did not,
already filtering blank lines correctly before submitting — confirming
`CashTransaction.svelte` was the one, specific place missing it.
Fixed by filtering blank lines out before submitting, matching the
already-correct sibling pattern.

```typescript
export function completePosSale(input: PosSaleInput, userId: number): PosSaleResult
export function completeCashPurchase(input: CashPurchaseInput, userId: number): CashPurchaseResult
```

\clearpage

### POS Terminal

![The POS Terminal — barcode-scan retail sale, with a live running cart.](manual-images/pos_terminal.png)

The real, live retail register — each cart line posts to that
product's own, real, per-product Sales/COGS account (lazily created by
`ensureProductSalesCogsAccounts`, per the location-scoped recording
grid documented in Part II), not one shared, aggregate revenue
account. Every line stages directly into `journal_entry_staging`
through `stageLine`, then `postJournalEntry` commits the whole,
balanced entry atomically:

```typescript
export function completePosSale(input: PosSaleInput, userId: number): PosSaleResult
export interface StagedLine {
  reference: string; business: BusinessName; ledger: LedgerName;
  account: AccountName; accountId?: number; amount_minor: number;
  division?: DivisionName; memo?: string; description?: string;
  transdate?: string; bankReference?: string;
}
export function stageLine(line: StagedLine): void
export function postJournalEntry(
  reference: string, business: BusinessName, ledger: LedgerName, userId: number
): void
```

\clearpage

### General Journal

![The General Journal — free-form, multi-line manual posting.](manual-images/general_journal.png)

The one, real, direct escape hatch for anything the purpose-built
screens don't cover — a person enters any number of real, balanced
lines by hand. Calls `stageLine`/`postJournalEntry` directly, the exact
same pair POS uses underneath, with no intermediate, screen-specific
staging table at all (there's nothing to shape — the screen already
collects exactly what `StagedLine` needs).

```typescript
export function stageLine(line: StagedLine): void
export function postJournalEntry(
  reference: string, business: BusinessName, ledger: LedgerName, userId: number
): void
export function createRecurringJournal(
  business: BusinessName, ledger: LedgerName, reference: string, startDate: string,
  recurrence: Recurrence, lines: RecurringJournalLine[], userId: number,
  description?: string, recurrenceCount?: number
): void
```

\clearpage

### Purchase Order and Sales Order

![The Purchase Order screen — placing a real, standing order with a vendor.](manual-images/purchase_order.png)

![The Sales Order screen — a real, standing commitment to a customer, to be fulfilled later.](manual-images/sales_order.png)

Placing an order is a real commitment, but not yet a completed,
balanced transaction — no cash or inventory has genuinely moved yet.
Per the architecture documented in Part II (stock control's own
staging tables), the "post" step here is a real TypeScript function,
not a SQL trigger — creating an order's own Qty/Value entities the
first time it's used needs more than a trigger can safely, atomically
do:

```sql
CREATE TABLE po_staging (
  reference TEXT NOT NULL, business TEXT NOT NULL, ledger TEXT NOT NULL,
  vendor TEXT NOT NULL, item TEXT NOT NULL, quantity INTEGER NOT NULL,
  price_minor INTEGER NOT NULL, location TEXT, -- real delivery instructions
  transdate TEXT, description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (reference, business, ledger)
);
CREATE TABLE so_staging (
  reference TEXT NOT NULL, business TEXT NOT NULL, ledger TEXT NOT NULL,
  customer TEXT NOT NULL, item TEXT NOT NULL, quantity INTEGER NOT NULL,
  price_minor INTEGER NOT NULL, location TEXT, -- real dispatch instructions
  transdate TEXT, description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (reference, business, ledger)
);
```

```typescript
export function stagePurchaseOrder(input: PurchaseOrderInput): void
export function postPurchaseOrder(
  reference: string, business: BusinessName, ledger: LedgerName, userId: number
): void
export function stageSalesOrder(input: SalesOrderInput): void
export function postSalesOrder(
  reference: string, business: BusinessName, ledger: LedgerName, userId: number
): void
```

\clearpage

### Stock Receipt and Stock Dispatch

![The Stock Receipt screen — fulfilling a real Purchase Order (in full or in part).](manual-images/stock_receipt.png)

![The Stock Dispatch screen — fulfilling a real Sales Order (in full or in part).](manual-images/stock_dispatch.png)

The real, actual fulfillment of an order — where the balanced,
double-entry posting genuinely happens, alongside the real quantity
movement. Both `item`/`item_qty` are genuinely nullable: a real
service (labor, freight) has nothing physical to receive or ship, so
it skips the quantity leg entirely rather than inventing a fake unit
just to satisfy a NOT NULL constraint:

```sql
CREATE TABLE stock_receipt_staging (
  reference TEXT NOT NULL, business TEXT NOT NULL, ledger TEXT NOT NULL,
  po_reference TEXT NOT NULL, item TEXT NOT NULL, -- the monetary-side account
  item_qty TEXT, -- the batch's Qty account — NULL for a service
  vendor TEXT NOT NULL, quantity INTEGER NOT NULL, value_minor INTEGER NOT NULL,
  tax_minor INTEGER NOT NULL DEFAULT 0, transdate TEXT, description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (reference, business, ledger)
);
CREATE TABLE stock_dispatch_staging (
  reference TEXT NOT NULL, business TEXT NOT NULL, ledger TEXT NOT NULL,
  so_reference TEXT NOT NULL, item TEXT, -- the batch's Value account — NULL for a service
  item_qty TEXT, customer TEXT NOT NULL, quantity INTEGER NOT NULL,
  unit_cost_minor INTEGER, sale_price_minor INTEGER NOT NULL,
  tax_minor INTEGER NOT NULL DEFAULT 0, transdate TEXT, description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (reference, business, ledger)
);
```

```typescript
export function stageStockReceipt(input: StockReceiptInput): void
export function postStockReceipt(
  reference: string, business: BusinessName, ledger: LedgerName, userId: number
): void
export function stageStockDispatch(input: StockDispatchInput): void
export function postStockDispatch(
  reference: string, business: BusinessName, ledger: LedgerName, userId: number
): void
```

\clearpage

### Stock Transfer

![The Stock Transfer screen — moving real, physical stock between two locations in the same city.](manual-images/stock_transfer.png)

A genuine, real, two-line quantity movement against the exact, same
product's own account, at two different, real locations — the one,
deliberate case `journal_entry_staging`'s own `location` column exists
to allow (see the primary key's own comment in Part II). Calls
`postQuantityMovement` directly, twice — no separate staging table of
its own, since a transfer's own real shape is already exactly what
that function's own parameters express:

```typescript
export function transferStock(
  business: BusinessName, ledger: LedgerName, partName: PartName,
  fromLocationName: LocationName, toLocationName: LocationName,
  quantity: number, reference: string, userId?: number, transdate?: string
): void
```

\clearpage

### Stock Take

![The Stock Take screen — reconciling counted, physical inventory against the system's own recorded quantity.](manual-images/stock_take.png)

A genuine, dual-effect transaction — completing a stock take both
corrects the real, physical quantity on hand *and* recognizes the real
gain or loss in the GL, since a shrinkage/overage genuinely has a real
dollar cost or benefit, not just a quantity correction with no
accounting consequence. This is the one, real screen that posts
through *both* core triggers for the same, real event:

```typescript
export function completeStockTake(
  stockTakeId: number, business: BusinessName, ledger: LedgerName,
  varianceExpenseAccount: AccountName,
  /** @deprecated No longer used */ inventoryAccount: string,
  unitCostMinorByPart: Record<string, number>, userId: number
): StockTakeCompletionResult
```

\clearpage

### Write-offs & Expiration

![The Write-offs screen — recording real breakage, spoilage, or expired stock, and receiving new, real, dated lots.](manual-images/write_offs.png)

The same, real dual-effect pattern as Stock Take — a write-off is a
genuine, real business event with both a quantity consequence (less
stock on hand) and a financial one (a recognized real loss), never
just one or the other:

```typescript
export function writeOffStock(
  business: BusinessName, ledger: LedgerName, reference: string, partName: PartName,
  quantity: number, unitCostMinor: number, writeOffExpenseAccount: AccountName,
  /** @deprecated No longer used */ inventoryAccount: string,
  reason: string, userId: number, transdate?: string
): void
export function receiveLot(
  business: BusinessName, ledger: LedgerName, reference: string, partName: PartName,
  lotNumber: string, receivedDate: string, expirationDate: string | null,
  quantity: number, userId: number
): void
```

\clearpage

### HR wage payment

![The HR screen — paying a real employee's wages, hourly or salaried.](manual-images/hr_wages.png)

Genuinely, structurally an invoice under the hood — `payEmployeeWages`
calls the exact, same `postInvoice` mechanism used throughout AR/AP,
treating an employee as a real, direct AP counterparty (see Part II,
"Every real staff member... as real AP counterparties"), not a
bespoke, separate payroll posting path.

```typescript
export function payEmployeeWages(
  input: PayEmployeeWagesInput, userId: number
): PayEmployeeWagesResult
```

\clearpage

### Projects & Jobs — clock-in/clock-out

![The Projects screen — an employee clocking in and out against a real project.](manual-images/projects.png)

Per direct, explicit, non-negotiable principle (see the Lessons
Learned appendix): an employee is a real supplier of their own
product — their time, at their own real price per hour. Clocking in
is genuinely placing a real, standing Purchase Order for that product;
clocking out is genuinely completing its real delivery. Both moments
go entirely through the exact, same, proven, staged, triggered
PO/receiving mechanism documented above for Purchase Order and Stock
Receipt — not a bespoke time-tracking posting mechanism of its own:

```typescript
export function clockInToProject(
  employeeName: EmployeeName, projectExpenseAccount: AccountName,
  business: BusinessName, ledger: LedgerName, userId: number
): EmployeeClock
export function clockOutOfProject(
  employeeName: EmployeeName, business: BusinessName, ledger: LedgerName, userId: number
): void
```
