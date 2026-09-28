## Entity identity resolution: name vs. id

An entity's `name` column does two, genuinely different jobs at once:
it is the technical key some code resolves by, and the human-readable
label a real person sees and might reasonably reuse. Scoped uniqueness
(see the previous section) makes the second job's flexibility fully
correct — the same word can genuinely mean different things at
different levels. Any code that still resolves an entity by a bare,
unscoped name (`SELECT id FROM current_entities WHERE name = ?`,
with no `parent_id` qualifier) cannot tell two, real, different
entities of the same name apart.

### The structural fix: an optional, direct id alongside the name

`journal_entry_staging` carries a real, optional `account_id` column
alongside `account` (the name). `post_journal_entry_insert` and
`post_quantity_movement_insert` both resolve via
`COALESCE(account_id, (SELECT id FROM current_entities WHERE name = account))`
— preferring the direct id when a caller provides one, falling back to
the name lookup when a caller only has a name (an ordinary, user-typed
account on a form). `entity_entry` and `entity_update` carry the same,
direct `parent_id`/`relation_id` columns for entity creation and
relation-tagging.

Every one of `createEntity`, `ensureCategoryChain`,
`ensureProductSalesCogsAccounts`, `ensureProductTierPart`,
`ensureProductLocationLeaf`, `ensureProductTierLocationLeaf`,
`ensureProductInventoryAccount`, and `ensureProductLocationInventoryAccount`
resolves and returns a real id alongside the name, so a caller can
propagate an unambiguous reference all the way to the actual posting.
`resolvePartId` (exported from `db.ts`) is the shared, reliable way to
resolve a real product's own entity id specifically — walking its own
real ancestor chain to confirm it reaches Parts, which a same-named
Sales/COGS/Inventory account never does.

### Where a bare-name lookup remains, and why it's low risk

A number of bare-name lookups remain, both in the backend (structurally
singular anchors like `Chart of Accounts`, `Vocabulary`, `Income`,
`Expense`, `Divisions`) and the frontend (filtering by a parent's name,
most commonly `Accounts Receivable`/`Accounts Payable`). These are
genuinely singular, structural anchors an ordinary business would not
independently duplicate — low risk in practice, not fixed structurally,
since doing so for every remaining case would mean reaching all
27+6 backend and 31 frontend call sites for marginal benefit.

### Future direction: a genuine, separate display-name relationship

The remaining, structural option — not yet built — is a real, separate
"display name" relationship for any reserved marker: the marker keeps
a stable, system-chosen technical name, and points, via the same
`relation_id`/`setDimensionParent` mechanism already used for Location
and COGS Product, at a real, separate Vocabulary entry that supplies
its own human-facing label. This would make every remaining bare-name
lookup for a reserved marker immune to a colliding, ordinary business
name permanently, rather than relying on those names staying
structurally singular in practice.

### Branded types: catching a swapped business/ledger/account at compile time, not runtime

Everything above — `account_id`, `resolvePartId`, structural
ancestor-chain checks — fixes ambiguity at the *database* layer: two
real entities that happen to share a name. There's a separate, real
risk one level up, at the *TypeScript* layer: `BusinessName`,
`LedgerName`, `AccountName`, and every other entity-derived string a
function accepts are all, structurally, just `string` to the
compiler. Nothing stops a caller from silently passing a ledger name
where a business name belongs, or an account name where a division
name belongs — two `string` parameters are indistinguishable to
TypeScript's own structural type system, no matter how clearly they're
named in the function signature.

**The fix: real, branded (nominal) types.** Each one is a plain
`string` intersected with a unique, private brand tag:

```typescript
export type BusinessName = string & { readonly __brand: 'BusinessName' };
export type LedgerName = string & { readonly __brand: 'LedgerName' };
export type AccountName = string & { readonly __brand: 'AccountName' };
export type DivisionName = string & { readonly __brand: 'DivisionName' };
export type LocationName = string & { readonly __brand: 'LocationName' };
export type EmployeeName = string & { readonly __brand: 'EmployeeName' };
export type CustomerName = string & { readonly __brand: 'CustomerName' };
export type VendorName = string & { readonly __brand: 'VendorName' };
export type PartName = string & { readonly __brand: 'PartName' };
```

A real, ordinary `string` is never directly assignable to any of
these — TypeScript treats each brand as a genuinely distinct type,
exactly the "nominal typing" TypeScript itself doesn't provide by
default, simulated correctly via intersection. A matching
`asBusinessName`/`asLedgerName`/`asAccountName`/etc. constructor
function exists for each — the one, explicit, real boundary where an
ordinary string genuinely becomes branded:

```typescript
export function asBusinessName(name: string): BusinessName {
  return name as BusinessName;
}
```

### Where casting happens, and where it doesn't

**Two real kinds of boundary exist.** A database read (a SQL query
result, always genuinely just `string` at the SQLite level — SQLite
itself has no concept of TypeScript's branded types) needs a real,
explicit cast at the point it's read back, since the database can't
carry the brand through a round trip. An HTTP request body (parsed by
zod, also always genuinely `string` at that boundary) needs the exact,
same real cast, for the exact, same reason. Both are cast exactly
once, at the boundary — every real function downstream of that point
carries the correct, branded type automatically, with no further casts
needed, because a `BusinessName` genuinely already is a `BusinessName`
once created.

### What this actually applies to

Applied system-wide, in four real, successive passes, each verified
compile-clean before the next began:

**Wave 1 — the core posting boundary.** The foundational `StagedLine`
interface every real transaction ultimately funnels through
(`business`, `ledger`, `account`, `division` fields), every real AR/AP
interface and function pair (`ARSaleInput`/`postARSale`,
`ARReceiptInput`/`postARReceipt`, `APPurchaseInput`/`postAPPurchase`,
`APPaymentInput`/`postAPPayment`), `PosSaleInput`/`completePosSale`,
`closeBooks`/`reverseJournalEntry`'s own account/division fields, and
the backend routes accepting these as request-body strings
(`routes/arap.ts`, `routes/pos.ts`, `routes/journal.ts`,
`routes/reports.ts`, `routes/matrix-reports.ts`,
`routes/businesses.ts`).

**Wave 2 — the single most widely-used function, and stock movement.**
`postJournalEntry` itself — called from more places than any other
function in the system — plus `reverseJournalEntry`,
`completeStockTake`, `writeOffStock`, `postStockReceipt`,
`postStockDispatch`, and the real employee-clock functions
(`clockInToProject`, `clockOutOfProject`,
`getOpenProjectClockForEmployee`).

**Wave 3 — the full remaining reporting and order surface.** A batch
of 22 more functions in one pass: every invoice listing/aging/
statement/history function (`listInvoices`, `countInvoices`,
`getAgedInvoices`, `getAgedSummary`, `getCustomerStatement`,
`getCounterpartyHistory`, `getReminderCandidates`,
`getInvoiceLine`), the picking-list confirmation functions
(`confirmPickedLine`, `confirmRestockPickedLine`), the e-invoice
import path (`importUblInvoiceAsDraft`), the staging/journal-listing
functions (`getStagedLines`, `removeStagedLine`, `listJournalEntries`,
`countJournalEntries`, `getJournalEntry`), the period-lock functions
(`getPeriodLockStatus`, `closePeriod`, `reopenPeriod`,
`assertPeriodOpen`), and the order functions (`postPurchaseOrder`,
`postSalesOrder`) — followed immediately by the remaining core stock
functions (`postQuantityMovement`, `receiveStockAtLocation`,
`dispatchStockFromLocation`, `transferStock`, `placeOrder`,
`fulfillOrder`, `dispatchRestockFromPickingList`, `receiveLot`,
`createRecurringJournal`) and `CashPurchaseInput`.

**Wave 4 — the final two, confirming completeness.**
`stageQuantityMovementLine` and `postStagedQuantityMovement` — found
only by an exhaustive, direct grep across the entire backend for any
remaining `(business: string, ledger: string)` pair after wave 3,
which confirmed these were the last two. That same grep, re-run after
fixing them, returned zero results — the entire backend's
business/ledger/account/division/location/employee/customer/vendor/
part parameter surface is now branded, confirmed exhaustively rather
than assumed complete.

### A real, genuine distinction found while completing the sweep: PartName is not AccountName

A real product's own name and its own quantity-tracking account name
often share the identical string value — a direct, deliberate
consequence of the earlier "Sales - "/"COGS - " prefix removal (see
the previous section). But they are not the same *kind* of thing:
`ensureProductQuantityAccounts`'s own `onOrderAccount`/
`unitsSoldAccount` return values, and a plain product name used
directly as a quantity account, are both genuinely `AccountName` —
not `PartName` — the moment they're used as a posting target rather
than as a reference to the product itself. `writeOffStock`,
`receiveLot`, `receiveStockAtLocation`, `dispatchStockFromLocation`,
and `transferStock` all take a real `PartName`, then cast it to
`AccountName` explicitly at the exact point it's staged as a posting
line — a real, deliberate, visible cast, not a type merged away to
avoid writing it.

### A real, confirmed example of this catching a genuine bug

While applying this system-wide, `getBalanceSheet`'s own internal call
to `getProfitAndLoss` was passing `ledgerName` as the first argument —
where `businessName` belongs — a real, silent, easy-to-write mistake
given both were, until branding, plain, interchangeable `string`
values. TypeScript rejected it immediately, at compile time, with a
clear `Type 'LedgerName' is not assignable to type 'BusinessName'`
error — exactly the class of bug this system exists to catch, caught
in the codebase itself, not merely in theory.


