# Real Source Reference — Common, Backend, Frontend

## Include Graph (real, direct, relative imports between these files)

- `shared-fixtures/wine-retail.ts` imports: `./csv.js`
- `shared-fixtures/add-brand-translation.ts` imports: `./csv.js`
- `shared-fixtures/translations.ts` imports: `./csv.js`
- `shared-fixtures/add-journal-translations.ts` imports: `./csv.js`
- `shared-fixtures/add-header-translations.ts` imports: `./csv.js`
- `shared-fixtures/add-menu-translations.ts` imports: `./csv.js`
- `shared-fixtures/wine-retail-demo-data.ts` imports: `./csv.js`
- `shared-fixtures/add-journal-remaining-translations.ts` imports: `./csv.js`
- `backend/src/db-stock.ts` imports: `./db.js`, `./primitives.js`, `./db.js`
- `backend/src/db-reports.ts` imports: `./db.js`, `./primitives.js`, `./db.js`
- `backend/src/auth.ts` imports: `./db.js`, `./password.js`
- `backend/src/db.ts` imports: `./password.js`, `./primitives.js`, `./db-reports.js`, `./db-seed.js`, `./db-reports.js`, `./db-stock.js`, `./db-stock.js`
- `backend/src/server.ts` imports: `./routes/entities.js`, `./routes/reports.js`, `./routes/matrix-reports.js`, `./routes/menu.js`, `./routes/i18n.js`, `./routes/businesses.js`, `./routes/journal.js`, `./routes/contacts.js`, `./routes/items.js`, `./routes/products.js`, `./routes/invoices.js`, `./routes/stock-lots.js`, `./routes/locations.js`, `./routes/divisions.js`, `./routes/pos.js`, `./routes/customer-registration.js`, `./routes/arap.js`, `./routes/auth.js`, `./routes/stock.js`, `./routes/invoice.js`, `./routes/period.js`, `./routes/projects.js`, `./auth-middleware.js`
- `backend/src/db-matrix-reports.ts` imports: `./db.js`, `./db-reports.js`, `./db.js`
- `backend/src/invoice.ts` imports: `./db.js`
- `backend/src/auth-middleware.ts` imports: `./auth.js`
- `backend/src/db-seed.ts` imports: `./db.js`, `./db.js`, `../../shared-fixtures/translations.js`, `../../shared-fixtures/wine-retail-demo-data.js`
- `backend/src/primitives.ts` imports: `./db.js`, `./db.js`
- `frontend/src/lib/api.ts` imports: `./state.svelte`
- `frontend/src/lib/session.ts` imports: `./api`
- `frontend/src/lib/pagination.ts` imports: `./state.svelte`
- `frontend/src/lib/entityTree.ts` imports: `./api`
- `frontend/src/lib/treeAdapter.ts` imports: `./api`
- `frontend/src/lib/state.svelte.ts` imports: `./api`, `./api`
- `frontend/src/lib/menu.ts` imports: `./state.svelte`

## Call Graph Summary (real, direct invocation counts — see `make call-graph` for the complete, standalone report)

Top 15 most-referenced functions across these 34 real, core files:
- `createEntity`: 82
- `asAccountName`: 51
- `asAccountName`: 51
- `asLedgerName`: 49
- `asLedgerName`: 49
- `asBusinessName`: 48
- `asBusinessName`: 48
- `setEntityLink`: 35
- `stageLine`: 33
- `setTranslation`: 32
- `requireAuth`: 32
- `asUserId`: 26
- `updateEntity`: 26
- `readCsv`: 20
- `postQuantityMovement`: 17

## Common Files

### `shared-fixtures/wine-retail.ts`

**Exported variables**:

- `fixtures`

### `shared-fixtures/add-brand-translation.ts`

### `shared-fixtures/csv.ts`

**Functions**:

```ts
escapeAscii(text: string): string
unescapeAscii(text: string): string
readCsv(text: string): Record<string, string>[]
writeCsv(rows: Record<string, string>[], headers: string[]): string
```

### `shared-fixtures/translations.ts`

**Functions**:

```ts
loadAllTranslations(): TranslationRow[]
```

**Types**:

```ts
interface TranslationRow {
  concept: string;
  language: string;
  text: string;
}
```

### `shared-fixtures/add-journal-translations.ts`

### `shared-fixtures/add-header-translations.ts`

### `shared-fixtures/add-menu-translations.ts`

### `shared-fixtures/wine-retail-demo-data.ts`

**Functions**:

```ts
loadDemoLocations(): DemoLocation[]
loadDemoUpcs(): DemoUpc[]
loadDemoCategories(): DemoCategory[]
loadDemoProducts(): DemoProduct[]
loadDemoStockLevels(): DemoStockLevel[]
```

**Types**:

```ts
interface DemoLocation {
  name: string;
  city: string;
  locationType: 'Retail' | 'Warehouse';
  isBilling: boolean;
  bottleCap: number | null;
  cartonCap: number | null;
  timezone: string;
}
interface DemoUpc {
  name: string;
  upc: string;
}
interface DemoCategory {
  category: string;
  subcategory: string;
}
interface DemoProduct {
  name: string;
  subcategory: string;
}
interface DemoStockLevel {
  itemName: string;
  locationName: string;
  qty: number;
  minLevel: number;
  maxLevel: number;
  reorderLevel: number;
  shelfSide: string | null;
  rack: string | null;
  level: number | null;
}
```

### `shared-fixtures/add-journal-remaining-translations.ts`


## Backend Files

### `backend/src/db-stock.ts`

**Functions**:

```ts
stageQuantityMovementLine(business: BusinessName, ledger: LedgerName, reference: string, account: AccountName, deltaQuantity: number, transdate: string, locationName?: LocationName): void
postStagedQuantityMovement(business: BusinessName, ledger: LedgerName, reference: string, userId: UserId): void
postQuantityMovement(business: BusinessName, ledger: LedgerName, reference: string, account: AccountName, deltaQuantity: number, userId: UserId, transdate?: string, locationName?: LocationName): void
getLocationTypes(): string[]
createLocationType(name: string, userId: UserId): void
setLocation(name: string, location: Location): void
getLocation(name: string): Location | undefined
todayAtLocation(locationName: string): string
getItemLocation(itemName: string, locationName: string): ItemLocationLevels
setItemLocationLevelDetails(itemName: string, locationName: string, levels: Omit<ItemLocationLevels, 'quantity_on_hand'>, userId: UserId): void
getLocationCapacityStatus(locationName: string): LocationCapacityStatus
createPosTerminal(terminalName: string, locationName: string, userId: UserId): void
setTerminalCurrency(terminalName: string, currency: string | null): void
getEffectiveSaleCurrency(terminalName: string | undefined): string | null
ensureLocationCapacityAccount(business: string, ledger: string, locationName: string, userId: UserId): 
adjustLocationCapacity(business: string, ledger: string, locationName: string, itemName: string, itemQuantityDelta: number, transdate: string, userId: UserId, referenceSuffix: string): void
getStockListingByLocation(): StockListingLocationGroup[]
getStockMovementReport(ledgerName: string, fromDate?: string, toDate?: string): StockMovementReport
getStockListing(limit = 100, offset = 0): StockListingRow[]
countStockListing(): number
setItemLocationLevels(itemName: string, locationName: string, levels: {
    minLevel?: number | null;
    maxLevel?: number | null;
    reorderLevel?: number | null;
    shelfSide?: string | null;
    rack?: string | null;
    level?: number | null;
  }): void
receiveStockAtLocation(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, locationName: LocationName, quantity: number, userId: UserId, transdate?: string): void
dispatchStockFromLocation(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, locationName: LocationName, quantity: number, userId: UserId, transdate?: string): void
transferStock(business: BusinessName, ledger: LedgerName, itemName: ItemName, fromLocationName: LocationName, toLocationName: LocationName, quantity: number, reference: string, userId = 1, transdate?: string): void
getBelowReorderStock(): BelowReorderRow[]
setItemSourceLeadTime(itemName: string, vendorName: string, days: number, userId: UserId): void
getItemLeadTimes(itemName: string): 
getStockOutRiskReport(windowDays: number = 2): StockOutRiskRow[]
createStockTake(locationName: string, takeDate: string, userId: UserId): number
getStockTake(id: number): StockTake | undefined
recordStockTakeCount(stockTakeId: number, itemName: string, countedQuantity: number): void
completeStockTake(stockTakeId: number, business: BusinessName, ledger: LedgerName, varianceExpenseAccount: AccountName, /** @deprecated No longer used — each line now resolves its own, * real, per-product Inventory account directly, the same, real, * structural fix already applied to Purchases and Sales/COGS.
   * Kept only so existing callers (the real, live Stock Take UI, the
   * simulation) don't need a breaking API change to keep working. */
  inventoryAccount: string, unitCostMinorByItem: Record<string, number>, userId: UserId): void
writeOffStock(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, quantity: number, unitCostMinor: number, writeOffExpenseAccount: AccountName, /** @deprecated No longer used — resolves to that same, real
   * product's own, real Inventory sub-account directly. Kept only so
   * existing callers don't need a breaking API change. */
  inventoryAccount: string, reason: string, userId: UserId, transdate?: string, locationName?: LocationName): void
receiveLot(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, lotNumber: string, receivedDate: string, expirationDate: string | null, quantity: number, userId: UserId): void
consumeFromLots(itemName: string, quantity: number): 
getExpiringStock(asOfDate: string, withinDays: number): ExpiringLot[]
createSystemEntity(name: string, parentId: number | null): number
placeOrder(orderReference: string, business: BusinessName, ledger: LedgerName, quantity: number, priceMinor: number, userId: UserId, transdate?: string, vendor?: string, item?: string, location?: string): void
fulfillOrder(orderReference: string, fulfillingReference: string, business: BusinessName, ledger: LedgerName, quantityFulfilled: number, valueFulfilledMinor: number, userId: UserId, transdate?: string): void
getOrderStatus(orderReference: string): 
```

**Types**:

```ts
interface Location {
  city: string;
  location_type: string;
  is_billing_address: boolean;
  bottle_capacity: number | null;
  carton_capacity: number | null;
  timezone: string;
}
interface ItemLocationLevels {
  quantity_on_hand: number;
  min_level: number | null;
  max_level: number | null;
  reorder_level: number | null;
  shelf_side: string | null;
  rack: string | null;
  level: number | null;
}
interface LocationCapacityStatus {
  bottleQuantity: number;
  bottleCapacity: number | null;
  bottleOverCapacity: boolean;
  cartonQuantity: number;
  cartonCapacity: number | null;
  cartonOverCapacity: boolean;
}
interface StockListingRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  min_level: number | null;
  max_level: number | null;
  reorder_level: number | null;
}
interface StockListingLocationGroup {
  location: string;
  city: string | null;
  division: string | null;
  rows: StockListingRow[];
  total_on_hand: number;
  capacity: LocationCapacityStatus;
}
interface StockMovementRow {
  item: string;
  category: string | null;
  quantity: number;
  date: string;
}
interface StockMovementReport {
  receipts: StockReceiptRow[];
  transfers: StockTransferRow[];
  sales: StockSaleRow[];
}
interface BelowReorderRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  reorder_level: number;
  min_level: number | null;
  max_level: number | null;
}
interface StockOutRiskRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  daily_consumption_rate: number;
  days_until_stockout: number | null;
  shortest_lead_time_days: number | null;
  at_risk: boolean;
}
interface StockTakeLine {
  id: number;
  item: string;
  shelf_side: string | null;
  rack: string | null;
  level: number | null;
  expected_quantity: number;
  counted_quantity: number | null;
}
interface StockTake {
  id: number;
  location: string;
  take_date: string;
  status: 'draft' | 'completed';
  lines: StockTakeLine[];
}
interface ExpiringLot {
  item: string;
  lot_number: string;
  expiration_date: string;
  quantity_on_hand: number;
  days_until_expiration: number;
}
```

### `backend/src/db-reports.ts`

**Functions**:

```ts
getBusinessReports(): ReportRow[]
setAccountCurrency(accountName: string, currency: string | null): void
getChartOfAccounts(): ChartRow[]
getLedgerBalancesByDivision(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, excludeCloseEntries = false): Map<number, Map<string | null, number>>
getLedgerBalancesByDivisionStructural(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, excludeCloseEntries = false): Map<number, Map<string | null, number>>
getLedgerBalances(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, divisionName?: string, excludeCloseEntries = false): Map<number, number>
getTrialBalance(businessName: BusinessName, ledgerName: LedgerName, asOfDate?: string, divisionName?: string): TrialBalance
getBalanceSheet(businessName: BusinessName, ledgerName: LedgerName, asOfDate?: string, divisionName?: string): BalanceSheet
buildCategoryTree(lines: StatementLine[], accountIdByName: Map<string, number>, rootName: string, normalSide: 'debit' | 'credit' = 'debit'): CategoryTreeNode[]
getProfitAndLoss(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, divisionName?: string, excludeCloseEntries = true): ProfitAndLoss
buildProfitAndLossFromBalances(balances: Map<number, number>): ProfitAndLoss
getProfitAndLossByDivision(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string): ProfitAndLossByDivision[]
getProfitAndLossByDivisionTree(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string): ProfitAndLossByDivisionNode[]
getTrialBalanceComparison(businessName: BusinessName, ledgerA: LedgerName, ledgerB: LedgerName): TrialBalanceComparison
previewCloseBooks(businessName: BusinessName, ledger: LedgerName, asOfDate: string, retainedEarningsAccount: string): CloseBooksPreview
closeBooks(business: BusinessName, ledger: LedgerName, asOfDate: string, retainedEarningsAccount: string, userId: UserId): CloseBooksResult
getSalesReport(business: BusinessName, ledger: LedgerName, fromDate?: string, toDate?: string): SalesReport
getProfitAndLossComparison(businessName: BusinessName, ledgerA: LedgerName, ledgerB: LedgerName): ProfitAndLossComparison
```

**Types**:

```ts
interface ReportRow {
  report: string;
  category: string;
  account: string;
  account_id: number;
  depth: number;
  accountnumber: string | null;
  balance_minor: number | null;
}
interface ChartRow {
  id: number;
  name: string;
  depth: number;
  path: string;
  accountnumber: string | null;
  balance_minor: number | null;
}
interface TrialBalanceRow {
  id: number;
  name: string;
  accountnumber: string | null;
  debit_minor: number;
  credit_minor: number;
}
interface TrialBalance {
  rows: TrialBalanceRow[];
  total_debit_minor: number;
  total_credit_minor: number;
}
interface StatementLine {
  name: string;
  accountnumber: string | null;
  debit_minor: number;
  credit_minor: number;
  is_contra: boolean;
}
interface BalanceSheet {
  assets: StatementLine[];
  liabilities: StatementLine[];
  equity: StatementLine[];
  assets_tree: CategoryTreeNode[];
  liabilities_tree: CategoryTreeNode[];
  equity_tree: CategoryTreeNode[];
  total_assets_minor: number;
  total_liabilities_minor: number;
  total_equity_minor: number;
  balanced: boolean;
}
interface ProfitAndLoss {
  income: StatementLine[];
  expenses: StatementLine[];
  cogs_expenses: StatementLine[];
  operating_expenses: StatementLine[];
  income_tree: CategoryTreeNode[];
  cogs_tree: CategoryTreeNode[];
  operating_expenses_tree: CategoryTreeNode[];
  total_income_minor: number;
  total_expenses_minor: number;
  gross_profit_minor: number;
  net_income_minor: number;
}
interface CategoryTreeNode {
  name: string;
  accountnumber: string | null;
  is_leaf: boolean;
  debit_minor: number;
  credit_minor: number;
  is_contra: boolean;
  children: CategoryTreeNode[];
}
interface ProfitAndLossByDivision {
  division: string | null;
  profitAndLoss: ProfitAndLoss;
}
interface TrialBalanceComparisonRow {
  id: number;
  name: string;
  accountnumber: string | null;
  a_debit_minor: number;
  a_credit_minor: number;
  b_debit_minor: number;
  b_credit_minor: number;
}
interface TrialBalanceComparison {
  ledgerA: LedgerName;
  ledgerB: LedgerName;
  rows: TrialBalanceComparisonRow[];
}
interface ProfitAndLossComparisonLine {
  name: string;
  accountnumber: string | null;
  a_minor: number;
  b_minor: number;
  variance_minor: number;
}
interface ProfitAndLossComparison {
  ledgerA: LedgerName;
  ledgerB: LedgerName;
  income: ProfitAndLossComparisonLine[];
  expenses: ProfitAndLossComparisonLine[];
  a_total_income_minor: number;
  b_total_income_minor: number;
  a_total_expenses_minor: number;
  b_total_expenses_minor: number;
  a_net_income_minor: number;
  b_net_income_minor: number;
  net_income_variance_minor: number;
}
interface CloseBooksResult {
  reference: string;
  netIncomeMinor: number;
  accountsZeroed: number;
  divisionBreakdown: { division: string | null; netIncomeMinor: number }[];
}
interface CloseBooksLine {
  account: string;
  accountId?: number;
  amount_minor: number;
  division?: string;
}
interface CloseBooksPreview {
  lines: CloseBooksLine[];
  netIncomeMinor: number;
  accountsZeroed: number;
  divisionBreakdown: { division: string | null; netIncomeMinor: number }[];
}
interface SalesReportLine {
  invoice_date: string;
  reference: string;
  item_name: string | null;
  description: string;
  quantity: number | null;
  unit_price_minor: number | null;
  amount_minor: number;
}
interface SalesCategorySummary {
  category: string;
  quantity: number;
  amount_minor: number;
}
interface SalesReport {
  detailed: SalesReportLine[];
  category_summary: SalesCategorySummary[];
  total_quantity: number;
  total_amount_minor: number;
}
```

### `backend/src/auth.ts`

**Functions**:

```ts
listUsers(): UserSummary[]
listRoles(): 
createUser(username: string, password: string, roleNames: string[]): UserSummary
setUserRoles(userId: number, roleNames: string[]): void
setUserActive(userId: number, active: boolean): void
changePassword(userId: number, newPassword: string): void
changeOwnPassword(userId: number, currentPassword: string, newPassword: string): void
login(username: string, password: string): 
logout(token: string): void
getSessionUser(token: string | undefined): AuthenticatedUser | null
setOwnPageSize(userId: number, pageSize: number): void
setOwnNumberFormat(userId: number, numberFormat: string): void
setOwnDateFormat(userId: number, dateFormat: string): void
```

**Types**:

```ts
interface UserSummary {
  id: number;
  username: string;
  active: boolean;
  roles: string[];
}
interface AuthenticatedUser {
  id: number;
  username: string;
  roles: string[];
  page_size: number;
  number_format: string;
  date_format: string;
}
```

### `backend/src/db.ts`

**Functions**:

```ts
asUserId(id: number): UserId
asEntityId(id: number): EntityId
asBusinessName(name: string): BusinessName
asLedgerName(name: string): LedgerName
asAccountName(name: string): AccountName
asDivisionName(name: string): DivisionName
asLocationName(name: string): LocationName
asEmployeeName(name: string): EmployeeName
asCustomerName(name: string): CustomerName
asVendorName(name: string): VendorName
asItemName(name: string): ItemName
getEntityTree(): (EntityNode &
getEntity(id: number): EntityNode | undefined
getEntityHistory(id: number): EntityHistoryRow[]
resolveItemId(itemName: string): number | undefined
createEntity(input: NewEntity, userId: UserId): EntityNode
updateEntity(id: number, input: EntityUpdate, userId: UserId): EntityNode
listLineTypes(): string[]
setLineType(entityName: string, lineType: string | null, userId: UserId): void
getLineType(entityName: string): string | undefined
setItemStorageOrigin(itemName: string, origin: 'Hot' | 'Cold' | null, userId: UserId): void
getItemStorageOrigin(itemName: string): 'Hot' | 'Cold' | undefined
setLanguageDirection(languageName: string, direction: 'LTR' | 'RTL' | null, userId: UserId): void
getLanguageDirection(languageName: string): 'LTR' | 'RTL' | undefined
reorderSiblings(entityId: number, direction: 'up' | 'down', userId: UserId): void
reorderSiblingsBulk(entityIds: number[], direction: 'up' | 'down', userId: UserId): void
setRelationship(entityName: string, relationshipType: string, targetName: string, userId: UserId): void
getRelationship(entityName: string): Relationship | undefined
getEntitiesWithRelationship(relationshipType: string): 
getHierarchy(rootName: string, relationshipType?: string): HierarchyNode
getOrganizationChart(businessName: BusinessName): OrganizationChart
deleteEntity(id: number, userId: UserId): void
getCreditStatus(entityName: string): CreditStatus
getAgingBuckets(paymentTermsDays: number | null): AgingBucket[]
createInvoice(input: InvoiceInput, userId: UserId): number
getInvoice(id: number): Invoice | undefined
exportInvoiceAsUbl(invoiceId: number): string
parseUblInvoice(xml: string): UblImportResult
checkEInvoiceDiscrepancies(parsed: UblImportResult, poReference?: string): EInvoiceDiscrepancy[]
importUblInvoiceAsDraft(xml: string, business: BusinessName, ledger: LedgerName, vendorName: string, userId: UserId, poReference?: string): 
getPickingList(invoiceId: number, locationName: string): PickingListLine[]
confirmPickedLine(invoiceId: number, invoiceLineId: number, business: BusinessName, ledger: LedgerName, userId: UserId): void
dispatchOrderFromPickingList(invoiceId: number, locationName: string, revenueAccount: string, taxAccount: string, userId: UserId): void
getRestockPickingList(runReference: string, warehouseName: string, lines: RestockLineInput[]): PickingListLine[]
confirmRestockPickedLine(runReference: string, itemName: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
dispatchRestockFromPickingList(runReference: string, business: BusinessName, ledger: LedgerName, warehouseName: string, retailOutletName: string, lines: RestockLineInput[], userId: UserId, transdate?: string): void
listInvoices(business: BusinessName, ledger: LedgerName, options: ListInvoicesOptions = {}): Invoice[]
countInvoices(business: BusinessName, ledger: LedgerName, invoiceType?: 'AR' | 'AP', source: 'manual' | 'pos' | 'all' = 'manual'): number
postInvoice(id: number,
  revenueOrExpenseAccount: string | { name: string; id: number } | ((line: InvoiceLineInput & { id: number }) => string | { name: string; id: number }), taxAccount: string, userId: UserId, restockInventory = false, divisionName?: string, counterpartyAccountOverride?: string): void
allocatePayment(invoiceId: number, paymentReference: string, allocatedMinor: number, allocationDate: string, paymentAccount: string, userId: UserId, skipJournalPosting = false): void
getInvoiceOutstandingMinor(invoiceId: number): number
getAgedInvoices(business: BusinessName, ledger: LedgerName, invoiceType: 'AR' | 'AP', asOfDate: string): AgedInvoiceRow[]
getAgedSummary(business: BusinessName, ledger: LedgerName, invoiceType: 'AR' | 'AP', asOfDate: string): AgedSummaryRow[]
getCustomerStatement(business: BusinessName, ledger: LedgerName, customerName: string, asOfDate: string): CustomerStatement
getCounterpartyHistory(business: BusinessName, ledger: LedgerName, counterpartyName: string): HistoryLine[]
getItemByUpc(upc: string): ItemSummary | undefined
getAncestorChain(entityName: string, rootName: string): string[]
ensureCategoryChain(rootName: string, prefix: string, chain: string[], userId: UserId): 
ensureProductSalesCogsAccounts(itemName: string, userId: UserId, tier?: string): 
ensureProductInventoryAccount(itemName: string, userId: UserId): 
ensureProductLocationInventoryAccount(itemName: string, locationName: string, userId: UserId): 
getProductUnitCostMinor(itemName: string): number | null
ensureProductTierItem(baseProductName: string, tier: string, userId: UserId): 
ensureProductTierLocationLeaf(tierItemName: string, locationName: string, userId: UserId, tierItemId?: number): 
ensureProductLocationLeaf(itemName: string, locationName: string, userId: UserId): 
getLocationForAccount(accountName: string): string | undefined
getDivisionForAccount(accountName: string): string | undefined
ensureProductQuantityAccounts(itemName: string, userId: UserId): 
cityDivisionFor(locationName: string): string | undefined
resolveDispatchLocation(itemName: string, logicalLocationName: string): string
completePosSale(input: PosSaleInput, userId: UserId): PosSaleResult
completeCashPurchase(input: CashPurchaseInput, userId: UserId): CashPurchaseResult
payEmployeeWages(input: PayEmployeeWagesInput, userId: UserId): PayEmployeeWagesResult
recordReminderSent(customerName: string): number
resetReminderLevel(customerName: string): void
getReminderCandidates(business: BusinessName, ledger: LedgerName, asOfDate: string): ReminderCandidate[]
getContact(entityName: string): Contact | undefined
getInvoiceLine(reference: string, business: BusinessName, ledger: LedgerName): InvoiceLine | undefined
getAccountsPostedTo(reference: string): string[]
setContact(entityName: string, contact: Partial<Contact>): void
setPosPin(employeeName: string, pin: string): void
signOn(employeeName: string, locationName: string): PosShift
verifyPosPin(employeeName: string, pin: string): boolean
signOff(shiftId: number): void
getActiveShiftsAtLocation(locationName: string): PosShift[]
getOpenShiftForEmployee(employeeName: string): PosShift | undefined
setLocationOpenHours(locationName: string, hours: OpenHoursLine[]): void
getLocationOpenHours(locationName: string): OpenHoursLine[]
setEmployeeSchedule(employeeName: string, locationName: string, schedule: ScheduleLine[]): void
getEmployeeSchedule(employeeName: string): EmployeeScheduleLine[]
getScheduleAtLocation(locationName: string): LocationScheduleLine[]
ensureAddressType(typeName: string, userId: UserId): void
listAddressTypes(): string[]
addTypedAddress(entityName: string, addressType: string, value: Partial<Contact>, userId: UserId): string
getTypedAddresses(entityName: string): TypedAddress[]
deleteTypedAddress(entityName: string, addressType: string, userId: UserId): void
ensurePhoneType(typeName: string, userId: UserId): void
listPhoneTypes(): string[]
addTypedPhone(entityName: string, phoneType: string, number: string, userId: UserId): string
getTypedPhones(entityName: string): TypedPhone[]
deleteTypedPhone(entityName: string, phoneType: string, userId: UserId): void
ensureContactPersonType(typeName: string, userId: UserId): void
listContactPersonTypes(): string[]
addTypedContactPerson(entityName: string, contactType: string, value: { name: string; phone?: string | null; email?: string | null }, userId: UserId): string
getTypedContactPersons(entityName: string): ContactPerson[]
deleteTypedContactPerson(entityName: string, contactType: string, userId: UserId): void
setEntityLink(entityName: string, linkType: string, targetName: string, userId: UserId): string
getEntityLink(entityName: string, linkType: string): string | undefined
deleteEntityLink(entityName: string, linkType: string, userId: UserId): void
stageBomComponent(input: {
  assemblyItem: string; business: string; componentItem: string; quantity: number; unit: string;
}): void
postBomComponents(assemblyItem: string, business: string, userId: UserId): void
deleteBomComponent(assemblyItem: string, componentItem: string, userId: UserId): void
getBomComponents(assemblyItem: string): 
createProjectTask(projectName: string, taskName: string, plannedStart: string, plannedEnd: string, userId: UserId): void
getProjectTasks(projectName: string): 
addTaskDependency(dependentTask: string, predecessorTask: string, dependencyType: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish', userId: UserId): void
getTaskDependencies(dependentTask: string): 
setDimensionParent(entityName: string, dimensionName: string, parentName: string, userId: UserId): void
getDimensionParent(entityName: string, dimensionName: string): string | undefined
deleteDimensionParent(entityName: string, dimensionName: string, userId: UserId): void
setContactType(contactName: string, typeName: string, userId: UserId): void
removeContactType(contactName: string, typeName: string, userId: UserId): void
getContactTypes(contactName: string): string[]
getContactBaseAccounts(contactName: string): string[]
getContactsWithType(typeName: string): string[]
getDimensionChildren(parentName: string, dimensionName: string): string[]
getDimensionLinksPointingAt(targetName: string): 
getDimensionAncestorChain(entityName: string, dimensionName: string): string[]
registerBankAccount(accountName: string, business: string, scopeName: string, overdraftLimitMinor: number | null, userId: UserId): void
unregisterBankAccount(accountName: string, userId: UserId): void
getBankAccounts(business: BusinessName, ledger: LedgerName): BankAccountRow[]
getCashPosition(business: BusinessName, ledger: LedgerName): CashPositionByCurrency[]
getCashFlowForecast(business: BusinessName, ledger: LedgerName, asOfDate: string, horizonDays: number): CashFlowForecast
registerCustomer(input: CustomerRegistrationInput, userId: UserId): void
listPendingCustomers(): PendingCustomer[]
verifyCustomer(customerName: string, approve: boolean): void
authenticateCustomer(name: string, password: string): boolean
listProducts(): ProductSummary[]
createProduct(name: string, parent: string, userId: UserId): void
getItemProduct(itemName: string): string | null
setItemProduct(itemName: string, productName: string | null, userId: UserId): void
getItem(entityName: string): Item | undefined
setItem(entityName: string, item: Partial<Item>): void
listItems(limit?: number, offset = 0): ItemSummary[]
countItems(): number
createItem(name: string, parentCategoryOrItemsRoot: string, userId: UserId): void
listItemSources(itemName: string): ItemSource[]
addOrUpdateItemSource(input: ItemSourceInput): void
getItemPriceForCurrency(itemName: string, currency: string | null): number | null
deleteItemSource(id: number): void
getLanguages(): 
getDefaultLanguage(): string | null
setDefaultLanguage(languageName: string, userId: UserId): void
getDivisions(): 
getMenuTree(opts?: { businessName?: string; userId?: number }): MenuSectionRow[]
getScreenTitle(href: string, opts?: { businessName?: string; userId?: number }): string | undefined
setMenuOverride(menuItemKey: string, scope: 'business' | 'user', scopeId: number, overrideLabel: string | null, hidden: boolean, userId: UserId = asUserId(1)): void
deleteMenuOverride(menuItemKey: string, scope: 'business' | 'user', scopeId: number, userId: UserId = asUserId(1)): void
setDivisionType(divisionNameOrId: string | EntityId, typeMarkerName: string): void
getDivisionType(divisionName: string): string | null
getDivisionTypes(): string[]
createDivisionType(name: string, userId: UserId): void
getVocabularyWords(): VocabularyWord[]
getVocabularyAlternates(wordName: string): string[]
getConceptsWithAlternates(): ConceptWithAlternates[]
setVocabularyPreference(conceptName: string, scope: 'business' | 'user', scopeId: number, preferredAlternateName: string): void
deleteVocabularyPreference(conceptName: string, scope: 'business' | 'user', scopeId: number): void
getLocalizedText(language: string, opts?: { businessName?: string; userId?: number }): Record<string, string>
setTranslation(conceptName: string, languageName: string, text: string, userId: UserId = asUserId(1)): void
getAllTranslations(languageName: string): Record<string, string>
getTranslation(conceptName: string, languageName: string): string | null
getBusinesses(): 
getLedgers(businessName: BusinessName): 
setupEquityStructure(businessName: BusinessName, structure: EntityStructure, userId: UserId, coaFamily?: string, partnerNames?: string[]): void
getBusinessTypes(): BusinessTypeInfo[]
saveBusinessTypeAnswers(businessName: BusinessName, answers: Record<string, string>, userId: UserId): void
copyChartOfAccountsInto(destRootName: string, coaFamily: string | undefined, userId: UserId): void
instantiateChartOfAccounts(businessName: BusinessName, coaFamily: string | undefined, userId: UserId): void
createBusiness(businessName: BusinessName, financialYearLabel: string, userId: UserId, coaFamily?: string, secondaryCurrencies?: string[], entityStructure?: EntityStructure, partnerNames?: string[]): 
getCoaFamilyAccounts(businessName: BusinessName, ledgerName: LedgerName): string[]
stageLine(line: StagedLine): void
getStagedLines(reference: string, business: BusinessName, ledger: LedgerName): StagedLine[]
createRecurringJournal(business: BusinessName, ledger: LedgerName, reference: string, startDate: string, recurrence: Recurrence, lines: RecurringJournalLine[], userId: UserId, description?: string, recurrenceCount?: number): void
ensureLocationScopedAccount(baseAccountName: string, locationName: string, userId: UserId): string
stageArSale(input: ArSaleInput): void
postArSale(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
stageArReceipt(input: ArReceiptInput): void
postArReceipt(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
stageApPurchase(input: ApPurchaseInput): void
postApPurchase(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
stageApPayment(input: ApPaymentInput): void
postApPayment(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
stagePurchaseOrder(input: PurchaseOrderInput): void
postPurchaseOrder(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
clockInToProject(employeeName: EmployeeName, projectExpenseAccount: AccountName, business: BusinessName, ledger: LedgerName, userId: UserId): EmployeeClock
clockOutOfProject(employeeName: EmployeeName, business: BusinessName, ledger: LedgerName, userId: UserId): void
getOpenProjectClockForEmployee(employeeName: EmployeeName): EmployeeClock | undefined
stageStockReceipt(input: StockReceiptInput): void
postStockReceipt(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
stageSalesOrder(input: SalesOrderInput): void
postSalesOrder(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
stageStockDispatch(input: StockDispatchInput): void
postStockDispatch(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
removeStagedLine(reference: string, business: BusinessName, ledger: LedgerName, account: string): void
postJournalEntry(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
listJournalEntries(business: BusinessName, ledger: LedgerName, limit = 100, offset = 0): JournalSummary[]
countJournalEntries(business: BusinessName, ledger: LedgerName): number
getJournalEntry(business: BusinessName, ledger: LedgerName, journalId: number, occurrenceDate: string): JournalDetail | undefined
getLedgerDateRange(businessName: BusinessName, ledgerName: LedgerName): LedgerDateRange
getPeriodLockStatus(business: BusinessName, ledger: LedgerName): PeriodLockStatus
closePeriod(business: BusinessName, ledger: LedgerName, throughDate: string, userId: UserId): void
reopenPeriod(business: BusinessName, ledger: LedgerName, userId: UserId): void
assertPeriodOpen(business: BusinessName, ledger: LedgerName, transdate: string): void
reverseJournalEntry(business: BusinessName, ledger: LedgerName, journalId: number, occurrenceDate: string, userId: UserId, reversalDate?: string): void
```

**Types**:

```ts
interface EntityNode {
  id: number;
  name: string;
  parent_id: number | null;
  relation_id: number | null;
  accountnumber: string | null;
  balance_minor: number | null;
  currency: string | null;
}
interface EntityHistoryRow {
  name: string;
  parent_id: number | null;
  relation_id: number | null;
  created_at: string;
  created_by: number;
  deleted_at: string | null;
  deleted_by: number | null;
}
interface NewEntity {
  name: string;
  parent?: string | null;
  parentId?: number | null;
  relation?: string | null;
  accountnumber?: string | null;
}
interface EntityUpdate {
  name?: string;
  parent?: string | null;
  relation?: string | null;
  accountnumber?: string | null;
}
interface Relationship {
  type: string;
  target: string;
}
interface OrgChartDivision {
  division: string;
  locations: { location: string; employees: string[] }[];
}
interface OrganizationChart {
  business: string;
  companyWideEmployees: string[]; // "Place of Employment" points straight at the business itself
  divisions: OrgChartDivision[];
}
interface HierarchyNode {
  id: number;
  name: string;
  children: HierarchyNode[];
}
interface AgingBucket {
  label: string;
  through_days: number;
}
interface CreditStatus {
  balanceMinor: number;
  limitMinor: number | null;
  overLimit: boolean;
  remainingMinor: number | null;
}
interface InvoiceLineInput {
  description: string;
  quantity?: number | null;
  unitPriceMinor?: number | null;
  amountMinor: number;
  taxMinor?: number;
  itemName?: string | null;
  dispatchReference?: string | null;
}
interface InvoiceInput {
  invoiceType: 'AR' | 'AP';
  documentType?: 'invoice' | 'credit_note' | 'debit_memo';
  referencesInvoiceId?: number | null;
  business: string;
  ledger: string;
  reference: string;
  counterpartyName: string;
  invoiceDate: string;
  description?: string;
  lines: InvoiceLineInput[];
  source?: 'manual' | 'pos';
}
interface Invoice {
  id: number;
  invoice_type: 'AR' | 'AP';
  document_type: 'invoice' | 'credit_note' | 'debit_memo';
  references_invoice_id: number | null;
  business: string;
  ledger: string;
  reference: string;
  counterparty: string;
  invoice_date: string;
  due_date: string | null;
  description: string;
  status: 'draft' | 'posted' | 'void';
  posted_by: string | null;
  source: 'manual' | 'pos';
  lines: (InvoiceLineInput & { id: number })[];
  total_amount_minor: number;
  total_tax_minor: number;
}
interface UblImportLine {
  description: string;
  quantity: number;
  unitPriceMinor: number;
  amountMinor: number;
}
interface UblImportResult {
  reference: string;
  issueDate: string;
  supplierName: string;
  totalMinor: number;
  taxMinor: number;
  lines: UblImportLine[];
}
interface EInvoiceDiscrepancy {
  field: string;
  poValue: string;
  invoiceValue: string;
}
interface PickingListLine {
  invoiceLineId: number;
  item: string;
  quantity: number;
  shelfSide: string | null;
  rack: string | null;
  level: number | null;
  picked: boolean;
}
interface RestockLineInput {
  item: string;
  quantity: number;
}
interface ListInvoicesOptions {
  invoiceType?: 'AR' | 'AP';
  source?: 'manual' | 'pos' | 'all';
  limit?: number;
  offset?: number;
}
interface AgedInvoiceRow {
  invoice_id: number;
  reference: string;
  counterparty: string;
  invoice_date: string;
  due_date: string | null;
  outstanding_minor: number;
  days_overdue: number;
  bucket: string;
}
interface AgedSummaryRow {
  counterparty: string;
  outstanding_minor: number;
  oldest_days_overdue: number;
}
interface StatementLine {
  invoice_id: number;
  reference: string;
  invoice_date: string;
  due_date: string | null;
  total_minor: number;
  paid_minor: number;
  outstanding_minor: number;
  status: 'Paid' | 'Outstanding' | 'Partially paid';
}
interface CustomerStatement {
  customer: string;
  as_of_date: string;
  lines: StatementLine[];
  total_outstanding_minor: number;
}
interface HistoryLine {
  invoice_reference: string;
  invoice_date: string;
  document_type: 'invoice' | 'credit_note' | 'debit_memo';
  description: string;
  quantity: number | null;
  unit_price_minor: number | null;
  amount_minor: number;
}
interface PosSaleLineInput {
  itemName: string;
  quantity: number;
  unitPriceMinor?: number;
  taxMinor: number;
  tier?: string;
}
interface PosSaleInput {
  business: BusinessName;
  ledger: LedgerName;
  locationName: LocationName;
  customerName: CustomerName;
  lines: PosSaleLineInput[];
  revenueAccount?: AccountName;
  taxAccount: AccountName;
  paymentMethod?: string;
  cashTenderedMinor?: number;
  transdate?: string;
  terminalName?: string;
}
interface PosSaleResult {
  invoiceId: number;
  reference: string;
  totalMinor: number;
  changeDueMinor: number;
}
interface CashPurchaseLineInput {
  itemName: string;
  quantity: number;
  unitPriceMinor: number;
  taxMinor: number;
}
interface CashPurchaseInput {
  business: BusinessName;
  ledger: LedgerName;
  locationName: LocationName;
  vendorName: VendorName;
  lines: CashPurchaseLineInput[];
  taxAccount: AccountName;
  paymentMethod?: string;
  transdate?: string;
}
interface CashPurchaseResult {
  invoiceId: number;
  reference: string;
  totalMinor: number;
}
interface PayEmployeeWagesInput {
  business: string;
  ledger: string;
  employeeName: string;
  hours?: number;
  wagesExpenseAccount?: string;
  paymentMethod?: string;
  transdate?: string;
}
interface PayEmployeeWagesResult {
  invoiceId: number;
  reference: string;
  grossMinor: number;
  medicareLevyMinor: number;
  superannuationMinor: number;
  netMinor: number;
}
interface ReminderCandidate {
  counterparty: string;
  current_level: number;
  next_level: number;
  outstanding_minor: number;
  oldest_days_overdue: number;
}
interface Contact {
  person_name: string | null;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  payment_terms_days: number | null;
  credit_limit_minor: number | null;
  wage_minor_per_hour: number | null;
  salary_minor_per_year: number | null;
  reminder_level: number;
  preferred_language: string | null;
  verification_status: 'pending' | 'active' | 'rejected' | null;
  card_label: string | null;
  pos_pin: string | null;
}
interface InvoiceLine {
  reference: string;
  description: string;
  quantity: number | null;
  unit_price_minor: number | null;
  amount_minor: number;
  tax_minor: number;
}
interface PosShift {
  id: number;
  employee: string;
  location: string;
  signed_on_at: string;
  signed_off_at: string | null;
}
interface OpenHoursLine {
  day: string;
  opens_at: string;
  closes_at: string;
}
interface ScheduleLine {
  day: string;
  starts_at: string;
  ends_at: string;
}
interface TypedPhone {
  phone_type: string;
  record_name: string;
  phone: string | null;
}
interface ContactPerson {
  contact_type: string;
  record_name: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}
interface BankAccountRow {
  name: string;
  accountnumber: string | null;
  balance_minor: number;
  currency: string | null;
  overdraft_limit_minor: number | null;
  scope: string;
}
interface CashPositionByCurrency {
  currency: string | null;
  total_balance_minor: number;
  total_overdraft_limit_minor: number | null;
  headroom_minor: number | null;
}
interface ForecastLine {
  date: string;
  description: string;
  amount_minor: number; // positive = real, anticipated cash in; negative = real, anticipated cash out
  source: 'AR' | 'AP' | 'recurring';
}
interface CashFlowForecast {
  as_of_date: string;
  horizon_end_date: string;
  starting_cash_minor: number;
  overdraft_limit_minor: number | null;
  lines: ForecastLine[];
  ending_cash_minor: number;
  lowest_projected_balance_minor: number;
  lowest_balance_date: string;
  first_shortfall_date: string | null;
  first_shortfall_amount_minor: number | null;
}
interface CustomerRegistrationInput {
  name: string;
  email: string;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
  country?: string | null;
  preferred_language?: string | null;
  password: string;
  card_label?: string | null;
}
interface PendingCustomer {
  name: string;
  email: string | null;
  phone: string | null;
  card_label: string | null;
}
interface ProductSummary {
  name: string;
  itemCount: number;
}
interface Item {
  description: string | null;
  unit_of_measure: string | null;
  upc: string | null;
  retail_price_minor: number | null;
}
interface ItemSummary {
  name: string;
  description: string | null;
  unit_of_measure: string | null;
  upc: string | null;
  retail_price_minor: number | null;
  source_count: number;
  storage_origin: 'Hot' | 'Cold' | null;
  product: string | null;
}
interface ItemSource {
  id: number;
  item_id: number;
  item_name: string;
  manufacturer_id: number | null;
  manufacturer_name: string | null;
  vendor_id: number;
  vendor_name: string;
  vendor_sku: string | null;
  vendor_upc: string | null;
  price_minor: number | null;
  package_quantity: number | null;
  is_preferred: boolean;
  preference_notes: string | null;
}
interface ItemSourceInput {
  itemName: string;
  manufacturerName?: string | null;
  vendorName: string;
  vendorSku?: string | null;
  vendorUpc?: string | null;
  priceMinor?: number | null;
  packageQuantity?: number | null;
  isPreferred?: boolean;
  preferenceNotes?: string | null;
  currency?: string | null;
}
interface MenuLinkRow {
  key: string;
  href: string;
  label: string;
  notImplemented: boolean;
  isSubheading: boolean;
  requiredRoles: string[] | null;
  hidden: boolean;
}
interface MenuSectionRow {
  key: string;
  label: string;
  hidden: boolean;
  links: MenuLinkRow[];
}
interface VocabularyWord {
  name: string;
  translations: Record<string, string>;
}
interface ConceptWithAlternates {
  headerAccountName: string;
  alternates: string[];
  defaultAlternate: string;
}
interface BusinessTypeInfo {
  name: string;
  questions: string[];
}
interface StagedLine {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  description?: string;
  transdate?: string;
  account: AccountName;
  accountId?: number;
  amount_minor: number;
  memo?: string;
  division?: DivisionName;
  bankReference?: string;
}
interface RecurringJournalLine {
  account: string;
  amount_minor: number; // positive = debit, negative = credit
  memo?: string;
  effective_date?: string; // defaults to the journal's own start date if omitted
}
interface ArSaleInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  customer: CustomerName;
  amount_minor: number;
  tax_minor?: number;
  location?: LocationName; // real, direct, per-invoice location — not per line
  transdate?: string;
  description?: string;
}
interface ArReceiptInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  customer: CustomerName;
  amount_minor: number;
  transdate?: string;
  description?: string;
}
interface ApPurchaseInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  vendor: VendorName;
  expense_account: AccountName;
  amount_minor: number;
  tax_minor?: number;
  location?: LocationName; // real, direct, per-invoice location — not per line
  transdate?: string;
  description?: string;
}
interface ApPaymentInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  vendor: VendorName;
  amount_minor: number;
  transdate?: string;
  description?: string;
}
interface PurchaseOrderInput {
  reference: string;
  business: string;
  ledger: string;
  vendor: string;
  item: string;
  quantity: number;
  price_minor: number;
  location?: string; // real, direct delivery instructions: where this order should arrive
  transdate?: string;
  description?: string;
}
interface EmployeeClock {
  employee: string;
  po_reference: string;
  project_expense_account: string;
  clocked_in_at: string;
}
interface StockReceiptInput {
  reference: string;
  business: string;
  ledger: string;
  po_reference: string;
  item: string; // the monetary-side account — a batch's Value account for stock, or any ordinary expense account for a service
  item_qty?: string | null; // the batch's Qty account — omit for a service (nothing physical received)
  vendor: string;
  quantity: number;
  value_minor: number;
  tax_minor?: number;
  transdate?: string;
  description?: string;
}
interface SalesOrderInput {
  reference: string;
  business: string;
  ledger: string;
  customer: string;
  item: string;
  quantity: number;
  price_minor: number;
  location?: string; // real, direct dispatch instructions: where this order should ship from
  transdate?: string;
  description?: string;
}
interface StockDispatchInput {
  reference: string;
  business: string;
  ledger: string;
  so_reference: string;
  item?: string | null; // the batch's Value account (cost side) — omit for a service (no COGS leg)
  item_qty?: string | null; // the batch's Qty account — omit for a service (nothing physical shipped)
  customer: string;
  quantity: number;
  unit_cost_minor?: number | null; // omit for a service — there is no batch cost to recognize
  sale_price_minor: number;
  tax_minor?: number;
  transdate?: string;
  description?: string;
}
interface JournalSummary {
  journal_id: number;
  occurrence_date: string | null;
  reference: string;
  description: string;
  business: string;
  ledger: string;
  recurrence: string;
  posted_by: string;
  total_debit_minor: number;
  total_credit_minor: number;
}
interface PeriodLockStatus {
  locked_through_date: string | null;
  changed_by: number | null;
  changed_at: string | null;
}
interface LedgerDateRange {
  earliest: string | null;
  latest: string | null;
}
type BusinessName = string & { readonly __brand: 'BusinessName' };
type LedgerName = string & { readonly __brand: 'LedgerName' };
type AccountName = string & { readonly __brand: 'AccountName' };
type DivisionName = string & { readonly __brand: 'DivisionName' };
type LocationName = string & { readonly __brand: 'LocationName' };
type EmployeeName = string & { readonly __brand: 'EmployeeName' };
type CustomerName = string & { readonly __brand: 'CustomerName' };
type VendorName = string & { readonly __brand: 'VendorName' };
type ItemName = string & { readonly __brand: 'ItemName' };
type UserId = number & { readonly __brand: 'UserId' };
type EntityId = number & { readonly __brand: 'EntityId' };
type EntityStructure = 'sole_trader' | 'partnership' | 'llc' | 'unlimited_liability' | 'publicly_traded';
type Recurrence = 'once' | 'weekly' | 'monthly' | 'yearly';
```

**Exported variables**:

- `db`

### `backend/src/server.ts`

### `backend/src/db-matrix-reports.ts`

**Functions**:

```ts
getSalesCogsMatrix(businessName: BusinessName, ledgerName: LedgerName, fromDate: string | undefined, toDate: string | undefined, rowAxis: MatrixAxis, colAxis: MatrixAxis): SalesCogsMatrix
getStockOnHandMatrix(rowAxis: MatrixAxis, colAxis: MatrixAxis): StockOnHandMatrix
getProfitAndLossByAxis(businessName: BusinessName, ledgerName: LedgerName, fromDate: string | undefined, toDate: string | undefined, outerAxis: MatrixAxis, innerAxis: MatrixAxis, outerFilter?: string, innerFilter?: string): ProfitAndLossByAxisNode[]
getAxisValues(businessName: BusinessName, ledgerName: LedgerName): AxisValues
```

**Types**:

```ts
interface MatrixCell {
  rowKey: string;
  colKey: string;
  salesMinor: number;
  cogsMinor: number;
}
interface SalesCogsMatrix {
  rowAxis: MatrixAxis;
  colAxis: MatrixAxis;
  cells: MatrixCell[];
  totalSalesMinor: number;
  totalCogsMinor: number;
}
interface StockOnHandCell {
  rowKey: string;
  colKey: string;
  quantityBottles: number;
  valueAtCostMinor: number;
  lastCostMinor: number | null;
  averageCostMinor: number | null;
  realizableValueMinor: number;
}
interface StockOnHandMatrix {
  rowAxis: MatrixAxis;
  colAxis: MatrixAxis;
  cells: StockOnHandCell[];
  totalValueAtCostMinor: number;
  totalRealizableValueMinor: number;
}
interface ProfitAndLossByAxisNode {
  key: string;
  profitAndLoss: ProfitAndLoss;
  children: ProfitAndLossByAxisNode[];
}
interface AxisValues {
  Product: string[];
  Category: string[];
  Location: string[];
  Division: string[];
}
type MatrixAxis = 'Product' | 'Category' | 'Location' | 'Division' | 'Consolidated';
```

### `backend/src/invoice.ts`

**Types**:

```ts
interface InvoiceOptions {
  invoiceReference: string; // the display reference for the whole document
  customerName: string;
  date: string;
  postedBy: string;
  lineReferences: string[]; // the underlying posting references that make up this invoice
  business: string;
  ledger: string;
}
```

### `backend/src/auth-middleware.ts`

**Functions**:

```ts
attachUser(req: Request, _res: Response, next: NextFunction): void
requireAuth(req: Request, res: Response, next: NextFunction): void
requireRole(...roles: string[]): void
```

### `backend/src/password.ts`

**Functions**:

```ts
hashPassword(password: string): string
verifyPassword(password: string, stored: string): boolean
```

### `backend/src/db-seed.ts`

**Functions**:

```ts
seedRemainingData(): void
```

### `backend/src/primitives.ts`

**Types**:

```ts
interface HierarchyTreeNode {
  name: string;
  accountId: number | null;
  own: Record<string, number>;
  total: Record<string, number>;
  children: HierarchyTreeNode[];
}
```

**Exported variables**:

- `Entity`
- `Link`
- `Balance`
- `Hierarchy`
- `Currency`
- `Detail`


## Frontend Files

### `frontend/src/lib/matrix-api.ts`

**Types**:

```ts
interface MatrixCell {
  rowKey: string;
  colKey: string;
  salesMinor: number;
  cogsMinor: number;
}
interface SalesCogsMatrix {
  rowAxis: MatrixAxis;
  colAxis: MatrixAxis;
  cells: MatrixCell[];
  totalSalesMinor: number;
  totalCogsMinor: number;
}
interface StockOnHandCell {
  rowKey: string;
  colKey: string;
  quantityBottles: number;
  valueAtCostMinor: number;
  lastCostMinor: number | null;
  averageCostMinor: number | null;
  realizableValueMinor: number;
}
interface StockOnHandMatrix {
  rowAxis: MatrixAxis;
  colAxis: MatrixAxis;
  cells: StockOnHandCell[];
  totalValueAtCostMinor: number;
  totalRealizableValueMinor: number;
}
interface ProfitAndLossByAxisNode {
  key: string;
  profitAndLoss: ProfitAndLoss;
  children: ProfitAndLossByAxisNode[];
}
interface AxisValues {
  Product: string[];
  Category: string[];
  Location: string[];
  Division: string[];
}
type MatrixAxis = 'Product' | 'Category' | 'Location' | 'Division' | 'Consolidated';
```

**Exported variables**:

- `getSalesCogsMatrix`
- `getStockOnHandMatrix`
- `getProfitAndLossByAxis`
- `getAxisValues`

### `frontend/src/lib/api.ts`

**Functions**:

```ts
asBusinessName(name: string): BusinessName
asLedgerName(name: string): LedgerName
asAccountName(name: string): AccountName
asDivisionName(name: string): DivisionName
asLocationName(name: string): LocationName
asEmployeeName(name: string): EmployeeName
asCustomerName(name: string): CustomerName
asVendorName(name: string): VendorName
asItemName(name: string): ItemName
```

**Types**:

```ts
interface EntityNode {
  id: number;
  name: string;
  parent_id: number | null;
  relation_id: number | null;
  accountnumber: string | null;
  balance_minor: number | null;
  currency: string | null;
  depth: number;
  is_postable_account: boolean;
}
interface DimensionLinkPointingAt {
  entityName: string;
  dimensionName: string;
}
interface ReportRow {
  report: string;
  category: string;
  account: AccountName;
  depth: number;
  accountnumber: string | null;
  balance_minor: number | null;
}
interface ChartRow {
  id: number;
  name: string;
  depth: number;
  path: string;
  accountnumber: string | null;
  balance_minor: number | null;
}
interface BankAccountRow {
  name: string;
  accountnumber: string | null;
  balance_minor: number;
  currency: string | null;
  overdraft_limit_minor: number | null;
  scope: string;
}
interface CashPositionByCurrency {
  currency: string | null;
  total_balance_minor: number;
  total_overdraft_limit_minor: number | null;
  headroom_minor: number | null;
}
interface ForecastLine {
  date: string;
  description: string;
  amount_minor: number;
  source: 'AR' | 'AP' | 'recurring';
}
interface CashFlowForecast {
  as_of_date: string;
  horizon_end_date: string;
  starting_cash_minor: number;
  overdraft_limit_minor: number | null;
  lines: ForecastLine[];
  ending_cash_minor: number;
  lowest_projected_balance_minor: number;
  lowest_balance_date: string;
  first_shortfall_date: string | null;
  first_shortfall_amount_minor: number | null;
}
interface TrialBalanceRow {
  id: number;
  name: string;
  accountnumber: string | null;
  debit_minor: number;
  credit_minor: number;
}
interface TrialBalance {
  rows: TrialBalanceRow[];
  total_debit_minor: number;
  total_credit_minor: number;
}
interface SalesReportLine {
  invoice_date: string;
  reference: string;
  item_name: string | null;
  description: string;
  quantity: number | null;
  unit_price_minor: number | null;
  amount_minor: number;
}
interface SalesCategorySummary {
  category: string;
  quantity: number;
  amount_minor: number;
}
interface SalesReport {
  detailed: SalesReportLine[];
  category_summary: SalesCategorySummary[];
  total_quantity: number;
  total_amount_minor: number;
}
interface StatementLine {
  name: string;
  accountnumber: string | null;
  debit_minor: number;
  credit_minor: number;
  is_contra: boolean;
}
interface BalanceSheet {
  assets: StatementLine[];
  liabilities: StatementLine[];
  equity: StatementLine[];
  assets_tree: CategoryTreeNode[];
  liabilities_tree: CategoryTreeNode[];
  equity_tree: CategoryTreeNode[];
  total_assets_minor: number;
  total_liabilities_minor: number;
  total_equity_minor: number;
  balanced: boolean;
}
interface MenuLinkRow {
  key: string;
  href: string;
  label: string;
  notImplemented: boolean;
  isSubheading: boolean;
  requiredRoles: string[] | null;
}
interface MenuSectionRow {
  key: string;
  label: string;
  links: MenuLinkRow[];
}
interface CategoryTreeNode {
  name: string;
  accountnumber: string | null;
  is_leaf: boolean;
  debit_minor: number;
  credit_minor: number;
  is_contra: boolean;
  children: CategoryTreeNode[];
}
interface ProfitAndLoss {
  income: StatementLine[];
  expenses: StatementLine[];
  cogs_expenses: StatementLine[];
  operating_expenses: StatementLine[];
  income_tree: CategoryTreeNode[];
  cogs_tree: CategoryTreeNode[];
  operating_expenses_tree: CategoryTreeNode[];
  total_income_minor: number;
  total_expenses_minor: number;
  gross_profit_minor: number;
  net_income_minor: number;
}
interface ProfitAndLossByDivision {
  division: DivisionName | null;
  profitAndLoss: ProfitAndLoss;
}
interface LedgerDateRange {
  earliest: string | null;
  latest: string | null;
}
interface ConceptWithAlternates {
  headerAccountName: string;
  alternates: string[];
  defaultAlternate: string;
}
interface VocabularyWord {
  name: string;
  translations: Record<string, string>;
}
interface DivisionRecord {
  id: number;
  name: string;
  parentName: string | null;
  centerType: string | null;
}
interface StagedLine {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  description?: string;
  transdate?: string;
  account: AccountName;
  amount_minor: number;
  memo?: string;
}
interface JournalSummary {
  journal_id: number;
  occurrence_date: string | null;
  reference: string;
  description: string;
  business: BusinessName;
  ledger: LedgerName;
  recurrence: string;
  total_debit_minor: number;
  total_credit_minor: number;
}
interface TrialBalanceComparisonRow {
  id: number;
  name: string;
  accountnumber: string | null;
  a_debit_minor: number;
  a_credit_minor: number;
  b_debit_minor: number;
  b_credit_minor: number;
}
interface TrialBalanceComparison {
  ledgerA: string;
  ledgerB: string;
  rows: TrialBalanceComparisonRow[];
}
interface ProfitAndLossComparisonLine {
  name: string;
  accountnumber: string | null;
  a_minor: number;
  b_minor: number;
  variance_minor: number;
}
interface ProfitAndLossComparison {
  ledgerA: string;
  ledgerB: string;
  income: ProfitAndLossComparisonLine[];
  expenses: ProfitAndLossComparisonLine[];
  a_total_income_minor: number;
  b_total_income_minor: number;
  a_total_expenses_minor: number;
  b_total_expenses_minor: number;
  a_net_income_minor: number;
  b_net_income_minor: number;
  net_income_variance_minor: number;
}
interface Contact {
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  payment_terms_days: number | null;
  credit_limit_minor: number | null;
  wage_minor_per_hour: number | null;
  salary_minor_per_year: number | null;
  reminder_level: number;
  preferred_language: string | null;
}
interface CreditStatus {
  balanceMinor: number;
  limitMinor: number | null;
  overLimit: boolean;
  remainingMinor: number | null;
}
interface TypedAddress {
  address_type: string;
  record_name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
}
interface TypedPhone {
  phone_type: string;
  record_name: string;
  phone: string | null;
}
interface ContactPerson {
  contact_type: string;
  record_name: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}
interface RecurringJournalLine {
  account: AccountName;
  amount_minor: number;
  memo?: string;
  effective_date?: string;
}
interface ArApBaseInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  amount_minor: number;
  tax_minor?: number;
  location?: string;
  transdate?: string;
  description?: string;
}
interface LoginResponse {
  token: string;
  user: { id: number; username: string; roles: string[]; page_size: number; number_format: string; date_format: string };
}
interface UserSummary {
  id: number;
  username: string;
  active: boolean;
  roles: string[];
}
interface PurchaseOrderInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  vendor: string;
  item: string;
  quantity: number;
  price_minor: number;
  location?: string;
  transdate?: string;
  description?: string;
}
interface StockReceiptInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  po_reference: string;
  item: string;
  item_qty?: string;
  vendor: string;
  quantity: number;
  value_minor: number;
  tax_minor?: number;
  transdate?: string;
  description?: string;
}
interface SalesOrderInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  customer: string;
  item: string;
  quantity: number;
  price_minor: number;
  location?: string;
  transdate?: string;
  description?: string;
}
interface StockDispatchInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  so_reference: string;
  item?: string;
  item_qty?: string;
  customer: string;
  quantity: number;
  unit_cost_minor?: number;
  sale_price_minor: number;
  tax_minor?: number;
  transdate?: string;
  description?: string;
}
interface PeriodLockStatus {
  locked_through_date: string | null;
  changed_by: number | null;
  changed_at: string | null;
}
interface Item {
  description: string | null;
  unit_of_measure: string | null;
  upc: string | null;
}
interface ItemSummary {
  name: string;
  description: string | null;
  unit_of_measure: string | null;
  upc: string | null;
  retail_price_minor: number | null;
  source_count: number;
  storage_origin: 'Hot' | 'Cold' | null;
  product: string | null;
}
interface ItemSource {
  id: number;
  item_id: number;
  item_name: string;
  manufacturer_id: number | null;
  manufacturer_name: string | null;
  vendor_id: number;
  vendor_name: string;
  vendor_sku: string | null;
  vendor_upc: string | null;
  price_minor: number | null;
  package_quantity: number | null;
  is_preferred: boolean;
  preference_notes: string | null;
}
interface ItemSourceInput {
  manufacturerName?: string | null;
  vendorName: VendorName;
  vendorSku?: string | null;
  vendorUpc?: string | null;
  priceMinor?: number | null;
  packageQuantity?: number | null;
  isPreferred?: boolean;
  preferenceNotes?: string | null;
}
interface ProductSummary {
  name: string;
  itemCount: number;
}
interface InvoiceLine {
  id?: number;
  description: string;
  quantity?: number | null;
  unitPriceMinor?: number | null;
  amountMinor: number;
  taxMinor?: number;
  itemName?: string | null;
  dispatchReference?: string | null;
}
interface InvoiceInput {
  invoiceType: 'AR' | 'AP';
  documentType?: 'invoice' | 'credit_note' | 'debit_memo';
  referencesInvoiceId?: number | null;
  business: BusinessName;
  ledger: LedgerName;
  reference: string;
  counterpartyName: string;
  invoiceDate: string;
  description?: string;
  lines: InvoiceLine[];
}
interface Invoice {
  id: number;
  invoice_type: 'AR' | 'AP';
  document_type: 'invoice' | 'credit_note' | 'debit_memo';
  references_invoice_id: number | null;
  business: BusinessName;
  ledger: LedgerName;
  reference: string;
  counterparty: string;
  invoice_date: string;
  due_date: string | null;
  description: string;
  status: 'draft' | 'posted' | 'void';
  posted_by: string | null;
  source: 'manual' | 'pos';
  lines: (InvoiceLine & { id: number })[];
  total_amount_minor: number;
  total_tax_minor: number;
}
interface EInvoiceDiscrepancy {
  field: string;
  poValue: string;
  invoiceValue: string;
}
interface ImportEInvoiceResult {
  invoiceId: number;
  discrepancies: EInvoiceDiscrepancy[];
}
interface AgedRow {
  invoice_id: number;
  reference: string;
  counterparty: string;
  invoice_date: string;
  due_date: string | null;
  outstanding_minor: number;
  days_overdue: number;
  bucket: string;
}
interface AgedSummaryRow {
  counterparty: string;
  outstanding_minor: number;
  oldest_days_overdue: number;
}
interface StatementLine {
  invoice_id: number;
  reference: string;
  invoice_date: string;
  due_date: string | null;
  total_minor: number;
  paid_minor: number;
  outstanding_minor: number;
  status: 'Paid' | 'Outstanding' | 'Partially paid';
}
interface CustomerStatement {
  customer: string;
  as_of_date: string;
  lines: StatementLine[];
  total_outstanding_minor: number;
}
interface HistoryLine {
  invoice_reference: string;
  invoice_date: string;
  document_type: 'invoice' | 'credit_note' | 'debit_memo';
  description: string;
  quantity: number | null;
  unit_price_minor: number | null;
  amount_minor: number;
}
interface ReminderCandidate {
  counterparty: string;
  current_level: number;
  next_level: number;
  outstanding_minor: number;
  oldest_days_overdue: number;
}
interface ExpiringLot {
  item: string;
  lot_number: string;
  expiration_date: string;
  quantity_on_hand: number;
  days_until_expiration: number;
}
interface LocationInput {
  city: string;
  location_type: string;
  is_billing_address: boolean;
  bottle_capacity?: number | null;
  carton_capacity?: number | null;
  timezone: string;
}
interface EmployeeClock {
  employee: string;
  po_reference: string;
  project_expense_account: string;
  clocked_in_at: string;
}
interface OpenHoursLine {
  day: string;
  opens_at: string;
  closes_at: string;
}
interface ScheduleLine {
  day: string;
  starts_at: string;
  ends_at: string;
}
interface ItemLocationLevels {
  quantity_on_hand: number;
  min_level: number | null;
  max_level: number | null;
  reorder_level: number | null;
  shelf_side: string | null;
  rack: string | null;
  level: number | null;
}
interface BelowReorderRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  reorder_level: number;
  min_level: number | null;
  max_level: number | null;
}
interface StockOutRiskRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  daily_consumption_rate: number;
  days_until_stockout: number | null;
  shortest_lead_time_days: number | null;
  at_risk: boolean;
}
interface PickingListLine {
  invoiceLineId: number;
  item: string;
  quantity: number;
  shelfSide: string | null;
  rack: string | null;
  level: number | null;
  picked: boolean;
}
interface RestockLineInput {
  item: string;
  quantity: number;
}
interface StockTakeLine {
  id: number;
  item: string;
  shelf_side: string | null;
  rack: string | null;
  level: number | null;
  expected_quantity: number;
  counted_quantity: number | null;
}
interface StockTake {
  id: number;
  location: string;
  take_date: string;
  status: 'draft' | 'completed';
  lines: StockTakeLine[];
}
interface PosSaleLineInput {
  itemName: ItemName;
  quantity: number;
  unitPriceMinor: number;
  taxMinor: number;
}
interface PosSaleResult {
  invoiceId: number;
  reference: string;
  totalMinor: number;
  changeDueMinor: number;
}
interface CashPurchaseLineInput {
  itemName: ItemName;
  quantity: number;
  unitPriceMinor: number;
  taxMinor: number;
}
interface CashPurchaseResult {
  invoiceId: number;
  reference: string;
  totalMinor: number;
}
interface PayWagesResult {
  invoiceId: number;
  reference: string;
  grossMinor: number;
  medicareLevyMinor: number;
  superannuationMinor: number;
  netMinor: number;
}
interface OrganizationChart {
  business: BusinessName;
  companyWideEmployees: string[];
  divisions: { division: DivisionName; locations: { location: string; employees: string[] }[] }[];
}
interface CloseBooksResult {
  reference: string;
  netIncomeMinor: number;
  accountsZeroed: number;
  divisionBreakdown: { division: DivisionName | null; netIncomeMinor: number }[];
}
interface CloseBooksPreview {
  lines: { account: AccountName; amount_minor: number; division?: string }[];
  netIncomeMinor: number;
  accountsZeroed: number;
  divisionBreakdown: { division: DivisionName | null; netIncomeMinor: number }[];
}
interface CustomerRegistrationInput {
  name: string;
  email: string;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
  country?: string | null;
  preferred_language?: string | null;
  password: string;
  card_label?: string | null;
}
interface PendingCustomer {
  name: string;
  email: string | null;
  phone: string | null;
  card_label: string | null;
}
interface StockListingRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  min_level: number | null;
  max_level: number | null;
  reorder_level: number | null;
}
interface LocationCapacityStatus {
  bottleQuantity: number;
  bottleCapacity: number | null;
  bottleOverCapacity: boolean;
  cartonQuantity: number;
  cartonCapacity: number | null;
  cartonOverCapacity: boolean;
}
interface StockListingLocationGroup {
  location: string;
  city: string | null;
  division: DivisionName | null;
  rows: StockListingRow[];
  total_on_hand: number;
  capacity: LocationCapacityStatus;
}
interface StockMovementRow {
  item: string;
  category: string | null;
  quantity: number;
  date: string;
}
interface StockMovementReport {
  receipts: StockReceiptRow[];
  transfers: StockTransferRow[];
  sales: StockSaleRow[];
}
type BusinessName = string & { readonly __brand: 'BusinessName' };
type LedgerName = string & { readonly __brand: 'LedgerName' };
type AccountName = string & { readonly __brand: 'AccountName' };
type DivisionName = string & { readonly __brand: 'DivisionName' };
type LocationName = string & { readonly __brand: 'LocationName' };
type EmployeeName = string & { readonly __brand: 'EmployeeName' };
type CustomerName = string & { readonly __brand: 'CustomerName' };
type VendorName = string & { readonly __brand: 'VendorName' };
type ItemName = string & { readonly __brand: 'ItemName' };
type BomComponent = { component: string;
```

**Exported variables**:

- `getEntityTree`
- `getDimensionLinksPointingAt`
- `createEntity`
- `setEntityRelationship`
- `updateEntity`
- `deleteEntity`
- `getBusinessReports`
- `getChartOfAccounts`
- `getBankAccounts`
- `getCashPosition`
- `getCashFlowForecast`
- `registerBankAccount`
- `unregisterBankAccount`
- `getTrialBalance`
- `getSalesReport`
- `getMenuTree`
- `setMenuOverride`
- `deleteMenuOverride`
- `getBalanceSheet`
- `getProfitAndLoss`
- `getProfitAndLossByDivision`
- `getProfitAndLossByDivisionTree`
- `getLedgerDateRange`
- `getLanguages`
- `getLanguageDirection`
- `setLanguageDirection`
- `getDefaultLanguage`
- `setDefaultLanguage`
- `getLocalizedText`
- `getVocabularyAlternates`
- `getConceptsWithAlternates`
- `getVocabularyWords`
- `setVocabularyPreference`
- `deleteVocabularyPreference`
- `setTranslation`
- `getDivisions`
- `createDivision`
- `getBusinesses`
- `getBusinessTypes`
- `saveBusinessTypeAnswers`
- `getLedgers`
- `createBusiness`
- `getCoaFamilyAccounts`
- `stageLine`
- `getStagedLines`
- `removeStagedLine`
- `postJournalEntry`
- `listJournalEntries`
- `getJournalEntry`
- `getTrialBalanceComparison`
- `getProfitAndLossComparison`
- `getContact`
- `setContact`
- `getCreditStatus`
- `getTypedAddresses`
- `setTypedAddress`
- `deleteTypedAddress`
- `getTypedPhones`
- `setTypedPhone`
- `deleteTypedPhone`
- `listContactPersonTypes`
- `listAddressTypes`
- `getLocationTypes`
- `createLocationType`
- `listPhoneTypes`
- `getTypedContactPersons`
- `setTypedContactPerson`
- `deleteTypedContactPerson`
- `createRecurringJournal`
- `stageArSale`
- `postArSale`
- `stageArReceipt`
- `postArReceipt`
- `stageApPurchase`
- `postApPurchase`
- `stageApPayment`
- `postApPayment`
- `apiLogin`
- `apiLogout`
- `getUsers`
- `getRoles`
- `createUserAccount`
- `setUserRolesApi`
- `setUserActiveApi`
- `changeUserPassword`
- `reverseJournalEntry`
- `stagePurchaseOrder`
- `postPurchaseOrder`
- `stageStockReceipt`
- `postStockReceipt`
- `stageSalesOrder`
- `postSalesOrder`
- `stageStockDispatch`
- `postStockDispatch`
- `getOrderStatus`
- `getPeriodStatus`
- `closePeriod`
- `reopenPeriod`
- `changeOwnPassword`
- `setOwnPageSize`
- `setOwnNumberFormat`
- `setOwnDateFormat`
- `getItemStorageOrigin`
- `setItemStorageOrigin`
- `getBomComponents`
- `setBomComponent`
- `deleteBomComponent`
- `listItems`
- `getItem`
- `listProducts`
- `createProduct`
- `setItemProduct`
- `setItem`
- `listItemSources`
- `addOrUpdateItemSource`
- `deleteItemSource`
- `listInvoices`
- `getInvoiceById`
- `createInvoice`
- `postInvoiceById`
- `getInvoiceOutstanding`
- `allocatePaymentToInvoice`
- `importEInvoice`
- `getAgedInvoices`
- `getAgedSummary`
- `getCustomerStatement`
- `getCounterpartyHistory`
- `getReminderCandidates`
- `sendReminder`
- `resetReminder`
- `writeOffStock`
- `receiveLot`
- `getExpiringStock`
- `listLocations`
- `clockInToProject`
- `clockOutOfProject`
- `getOpenProjectClock`
- `getLocationByName`
- `saveLocation`
- `getLocationOpenHours`
- `setLocationOpenHours`
- `getScheduleAtLocation`
- `getEmployeeSchedule`
- `setEmployeeSchedule`
- `getItemLocation`
- `setItemLocationLevels`
- `receiveStockAtLocation`
- `dispatchStockFromLocation`
- `transferStock`
- `getBelowReorderStock`
- `getStockOutRiskReport`
- `setItemSourceLeadTime`
- `getRestockPickingList`
- `confirmRestockPickedLine`
- `dispatchRestockRun`
- `createStockTake`
- `getStockTake`
- `recordStockTakeCount`
- `completeStockTake`
- `lookupItemByUpc`
- `completePosSale`
- `completeCashPurchase`
- `payEmployeeWages`
- `getOrganizationChart`
- `closeBooks`
- `previewCloseBooks`
- `registerCustomer`
- `listPendingCustomers`
- `verifyCustomer`
- `getStockListing`
- `getStockListingByLocation`
- `getStockMovementReport`

### `frontend/src/lib/session.ts`

**Types**:

```ts
interface SessionContext {
  businessId: number;
  businessName: BusinessName;
  ledgerId: number;
  ledgerName: LedgerName;
  languageId: number;
  languageName: string;
}
```

**Exported variables**:

- `session`

### `frontend/src/lib/format.ts`

**Functions**:

```ts
todayIsoDate(): string
decimalPlacesFor(unitCode: string | undefined): number
formatAmount(smallestUnits: number, numberFormat: string, unitCode?: string): string
formatDate(isoDate: string | null | undefined, dateFormat: string): string
```

### `frontend/src/lib/pagination.ts`

### `frontend/src/lib/entityTree.ts`

**Functions**:

```ts
isDescendantOf(entity: EntityNode, ancestorName: string, allEntities: EntityNode[], matchSuffix = false): boolean
filterToItems(entities: EntityNode[]): EntityNode[]
```

### `frontend/src/lib/auth.ts`

**Functions**:

```ts
hasRole(state: AuthState | null, ...roles: string[]): boolean
```

**Types**:

```ts
interface AuthUser {
  id: number;
  username: string;
  roles: string[];
  page_size: number;
  number_format: string;
  date_format: string;
}
interface AuthState {
  token: string;
  user: AuthUser;
}
```

**Exported variables**:

- `auth`

### `frontend/src/lib/translations.ts`

**Exported variables**:

- `translations`

### `frontend/src/lib/money.ts`

**Functions**:

```ts
parseMinorUnits(text: string): number
parseQuantity(text: string): number
```

### `frontend/src/lib/treeAdapter.ts`

**Functions**:

```ts
toTreePaths(entities: EntityNode[]): TreeItem[]
```

**Types**:

```ts
interface TreeItem {
  path: string;
  id: number;
  name: string;
  accountnumber: string | null;
  balance_minor: number | null;
}
```

### `frontend/src/lib/state.svelte.ts`

**Functions**:

```ts
hasRole(state: AuthState | null, ...roles: string[]): boolean
screenTitle(href: string): string | undefined
```

**Types**:

```ts
interface AuthUser {
  id: number;
  username: string;
  roles: string[];
  page_size: number;
  number_format: string;
  date_format: string;
}
interface AuthState {
  token: string;
  user: AuthUser;
}
interface SessionContext {
  businessId: number;
  businessName: BusinessName;
  ledgerId: number;
  ledgerName: LedgerName;
  languageId: number;
  languageName: string;
}
```

**Exported variables**:

- `auth`
- `hasUnsavedEdit`
- `menuTree`
- `session`
- `translations`

### `frontend/src/lib/journalGrid.ts`

**Functions**:

```ts
emptyRow(): Row
isRowEmpty(row: Row): boolean
isRowFilled(row: Row): boolean
activeRows(rows: Row[]): Row[]
debitTotalMinor(rows: Row[]): number
creditTotalMinor(rows: Row[]): number
differenceMinor(rows: Row[]): number
isBalanced(rows: Row[]): boolean
canSave(rows: Row[]): boolean
ensureAtLeastOneRow(rows: Row[]): Row[]
addRow(rows: Row[]): Row[]
removeRowAt(rows: Row[], index: number): Row[]
computeSuggestedFill(rows: Row[], trailingIndex: number): number | null
autoBalanceTrailingRow(rows: Row[], changedIndex: number): Row[]
autoExpandIfTrailingRowFilled(rows: Row[]): Row[]
```

**Types**:

```ts
interface Row {
  account: string;
  debit: string; // kept as the raw text the person typed, not a number,
  credit: string; // so "12.5" vs "12.50" vs an empty field are distinct
  memo: string;
}
```

### `frontend/src/lib/dirty-state.ts`

**Exported variables**:

- `hasUnsavedEdit`

### `frontend/src/lib/menu.ts`


## Parent Link / Sibling (Relation) Link Index

See `docs/naming-conventions-and-entity-glossary.md` for what these two, real, distinct link kinds mean.

### Real `parent:` usages (structural — "this entity lives under that one")

- `backend/src/db-stock.ts`: 'Location Type'; 'Is Billing Address'
- `backend/src/db.ts`: 'Chart of Accounts Line Types'; 'Storage Origin Types'; 'Text Direction Types'; relationshipType; locationName; employeeName; entityName; entityName; `${projectName; 'Customers'; string; productName ?? 'Items'; parentCategoryOrItemsRoot; 'Vocabulary'; overrideName; 'Vocabulary'; 'Equity'; // 'Equity'; businessName; 'Businesses'; businessName; businessName; businessName; businessName; businessName; 'Asset'
- `backend/src/db-seed.ts`: 'Vocabulary'; 'Items'; category; 'Locations'; 'Utilities'; 'Electricity'; 'Electricity'; 'Utilities'; 'Utilities'; 'Utilities'; 'Utilities'; 'Businesses'; 'Wine Retail Company'; 'Employees'; 'Vocabulary'; 'Vocabulary'; 'Vocabulary'; 'Vocabulary'; 'Vocabulary'; 'Vocabulary'; 'Business Reports'; 'Customers'; 'Application'; 'Menu'; sectionName; 'Application'; 'Routes'; 'Vocabulary'; 'Vocabulary'; 'Vocabulary'; 'Vocabulary'; b.name; 'Application'; 'Business Type'; bt.name; bt.name; 'Vocabulary'
- `backend/src/primitives.ts`: string | number; string
- `frontend/src/lib/api.ts`: string | null

### Real `relation:` usages (lateral — "this entity refers to / is a translation of that one")

- `backend/src/db-stock.ts`: location.location_type; 'Billing Address'; vendor; item
- `backend/src/db.ts`: targetName; recordName; h.day; s.day; type; targetName; languageName; // conceptName; coaFamily; child.name; coaFamily; coaFamily
- `backend/src/db-seed.ts`: 'COGS'; section.label; link.label
- `backend/src/primitives.ts`: target

## Index (alphabetical — every real function, type, and exported variable, with its file)

- `AccountName` (type) — `backend/src/db.ts`
- `AccountName` (type) — `frontend/src/lib/api.ts`
- `activeRows` (function) — `frontend/src/lib/journalGrid.ts`
- `addOrUpdateItemSource` (function) — `backend/src/db.ts`
- `addOrUpdateItemSource` (variable) — `frontend/src/lib/api.ts`
- `addRow` (function) — `frontend/src/lib/journalGrid.ts`
- `addTaskDependency` (function) — `backend/src/db.ts`
- `addTypedAddress` (function) — `backend/src/db.ts`
- `addTypedContactPerson` (function) — `backend/src/db.ts`
- `addTypedPhone` (function) — `backend/src/db.ts`
- `adjustLocationCapacity` (function) — `backend/src/db-stock.ts`
- `AgedInvoiceRow` (type) — `backend/src/db.ts`
- `AgedRow` (type) — `frontend/src/lib/api.ts`
- `AgedSummaryRow` (type) — `backend/src/db.ts`
- `AgedSummaryRow` (type) — `frontend/src/lib/api.ts`
- `AgingBucket` (type) — `backend/src/db.ts`
- `allocatePayment` (function) — `backend/src/db.ts`
- `allocatePaymentToInvoice` (variable) — `frontend/src/lib/api.ts`
- `apiLogin` (variable) — `frontend/src/lib/api.ts`
- `apiLogout` (variable) — `frontend/src/lib/api.ts`
- `ApPaymentInput` (type) — `backend/src/db.ts`
- `ApPurchaseInput` (type) — `backend/src/db.ts`
- `ArApBaseInput` (type) — `frontend/src/lib/api.ts`
- `ArReceiptInput` (type) — `backend/src/db.ts`
- `ArSaleInput` (type) — `backend/src/db.ts`
- `asAccountName` (function) — `backend/src/db.ts`
- `asAccountName` (function) — `frontend/src/lib/api.ts`
- `asBusinessName` (function) — `backend/src/db.ts`
- `asBusinessName` (function) — `frontend/src/lib/api.ts`
- `asCustomerName` (function) — `backend/src/db.ts`
- `asCustomerName` (function) — `frontend/src/lib/api.ts`
- `asDivisionName` (function) — `backend/src/db.ts`
- `asDivisionName` (function) — `frontend/src/lib/api.ts`
- `asEmployeeName` (function) — `backend/src/db.ts`
- `asEmployeeName` (function) — `frontend/src/lib/api.ts`
- `asEntityId` (function) — `backend/src/db.ts`
- `asItemName` (function) — `backend/src/db.ts`
- `asItemName` (function) — `frontend/src/lib/api.ts`
- `asLedgerName` (function) — `backend/src/db.ts`
- `asLedgerName` (function) — `frontend/src/lib/api.ts`
- `asLocationName` (function) — `backend/src/db.ts`
- `asLocationName` (function) — `frontend/src/lib/api.ts`
- `assertPeriodOpen` (function) — `backend/src/db.ts`
- `asUserId` (function) — `backend/src/db.ts`
- `asVendorName` (function) — `backend/src/db.ts`
- `asVendorName` (function) — `frontend/src/lib/api.ts`
- `attachUser` (function) — `backend/src/auth-middleware.ts`
- `auth` (variable) — `frontend/src/lib/auth.ts`
- `auth` (variable) — `frontend/src/lib/state.svelte.ts`
- `authenticateCustomer` (function) — `backend/src/db.ts`
- `AuthenticatedUser` (type) — `backend/src/auth.ts`
- `AuthState` (type) — `frontend/src/lib/auth.ts`
- `AuthState` (type) — `frontend/src/lib/state.svelte.ts`
- `AuthUser` (type) — `frontend/src/lib/auth.ts`
- `AuthUser` (type) — `frontend/src/lib/state.svelte.ts`
- `autoBalanceTrailingRow` (function) — `frontend/src/lib/journalGrid.ts`
- `autoExpandIfTrailingRowFilled` (function) — `frontend/src/lib/journalGrid.ts`
- `AxisValues` (type) — `backend/src/db-matrix-reports.ts`
- `AxisValues` (type) — `frontend/src/lib/matrix-api.ts`
- `Balance` (variable) — `backend/src/primitives.ts`
- `BalanceSheet` (type) — `backend/src/db-reports.ts`
- `BalanceSheet` (type) — `frontend/src/lib/api.ts`
- `BankAccountRow` (type) — `backend/src/db.ts`
- `BankAccountRow` (type) — `frontend/src/lib/api.ts`
- `BelowReorderRow` (type) — `backend/src/db-stock.ts`
- `BelowReorderRow` (type) — `frontend/src/lib/api.ts`
- `BomComponent` (type) — `frontend/src/lib/api.ts`
- `buildCategoryTree` (function) — `backend/src/db-reports.ts`
- `buildProfitAndLossFromBalances` (function) — `backend/src/db-reports.ts`
- `BusinessName` (type) — `backend/src/db.ts`
- `BusinessName` (type) — `frontend/src/lib/api.ts`
- `BusinessTypeInfo` (type) — `backend/src/db.ts`
- `canSave` (function) — `frontend/src/lib/journalGrid.ts`
- `CashFlowForecast` (type) — `backend/src/db.ts`
- `CashFlowForecast` (type) — `frontend/src/lib/api.ts`
- `CashPositionByCurrency` (type) — `backend/src/db.ts`
- `CashPositionByCurrency` (type) — `frontend/src/lib/api.ts`
- `CashPurchaseInput` (type) — `backend/src/db.ts`
- `CashPurchaseLineInput` (type) — `backend/src/db.ts`
- `CashPurchaseLineInput` (type) — `frontend/src/lib/api.ts`
- `CashPurchaseResult` (type) — `backend/src/db.ts`
- `CashPurchaseResult` (type) — `frontend/src/lib/api.ts`
- `CategoryTreeNode` (type) — `backend/src/db-reports.ts`
- `CategoryTreeNode` (type) — `frontend/src/lib/api.ts`
- `changeOwnPassword` (function) — `backend/src/auth.ts`
- `changeOwnPassword` (variable) — `frontend/src/lib/api.ts`
- `changePassword` (function) — `backend/src/auth.ts`
- `changeUserPassword` (variable) — `frontend/src/lib/api.ts`
- `ChartRow` (type) — `backend/src/db-reports.ts`
- `ChartRow` (type) — `frontend/src/lib/api.ts`
- `checkEInvoiceDiscrepancies` (function) — `backend/src/db.ts`
- `cityDivisionFor` (function) — `backend/src/db.ts`
- `clockInToProject` (function) — `backend/src/db.ts`
- `clockInToProject` (variable) — `frontend/src/lib/api.ts`
- `clockOutOfProject` (function) — `backend/src/db.ts`
- `clockOutOfProject` (variable) — `frontend/src/lib/api.ts`
- `closeBooks` (function) — `backend/src/db-reports.ts`
- `closeBooks` (variable) — `frontend/src/lib/api.ts`
- `CloseBooksLine` (type) — `backend/src/db-reports.ts`
- `CloseBooksPreview` (type) — `backend/src/db-reports.ts`
- `CloseBooksPreview` (type) — `frontend/src/lib/api.ts`
- `CloseBooksResult` (type) — `backend/src/db-reports.ts`
- `CloseBooksResult` (type) — `frontend/src/lib/api.ts`
- `closePeriod` (function) — `backend/src/db.ts`
- `closePeriod` (variable) — `frontend/src/lib/api.ts`
- `completeCashPurchase` (function) — `backend/src/db.ts`
- `completeCashPurchase` (variable) — `frontend/src/lib/api.ts`
- `completePosSale` (function) — `backend/src/db.ts`
- `completePosSale` (variable) — `frontend/src/lib/api.ts`
- `completeStockTake` (function) — `backend/src/db-stock.ts`
- `completeStockTake` (variable) — `frontend/src/lib/api.ts`
- `computeSuggestedFill` (function) — `frontend/src/lib/journalGrid.ts`
- `ConceptWithAlternates` (type) — `backend/src/db.ts`
- `ConceptWithAlternates` (type) — `frontend/src/lib/api.ts`
- `confirmPickedLine` (function) — `backend/src/db.ts`
- `confirmRestockPickedLine` (function) — `backend/src/db.ts`
- `confirmRestockPickedLine` (variable) — `frontend/src/lib/api.ts`
- `consumeFromLots` (function) — `backend/src/db-stock.ts`
- `Contact` (type) — `backend/src/db.ts`
- `Contact` (type) — `frontend/src/lib/api.ts`
- `ContactPerson` (type) — `backend/src/db.ts`
- `ContactPerson` (type) — `frontend/src/lib/api.ts`
- `copyChartOfAccountsInto` (function) — `backend/src/db.ts`
- `countInvoices` (function) — `backend/src/db.ts`
- `countItems` (function) — `backend/src/db.ts`
- `countJournalEntries` (function) — `backend/src/db.ts`
- `countStockListing` (function) — `backend/src/db-stock.ts`
- `createBusiness` (function) — `backend/src/db.ts`
- `createBusiness` (variable) — `frontend/src/lib/api.ts`
- `createDivision` (variable) — `frontend/src/lib/api.ts`
- `createDivisionType` (function) — `backend/src/db.ts`
- `createEntity` (function) — `backend/src/db.ts`
- `createEntity` (variable) — `frontend/src/lib/api.ts`
- `createInvoice` (function) — `backend/src/db.ts`
- `createInvoice` (variable) — `frontend/src/lib/api.ts`
- `createItem` (function) — `backend/src/db.ts`
- `createLocationType` (function) — `backend/src/db-stock.ts`
- `createLocationType` (variable) — `frontend/src/lib/api.ts`
- `createPaginator` (function) — `frontend/src/lib/pagination.ts`
- `createPosTerminal` (function) — `backend/src/db-stock.ts`
- `createProduct` (function) — `backend/src/db.ts`
- `createProduct` (variable) — `frontend/src/lib/api.ts`
- `createProjectTask` (function) — `backend/src/db.ts`
- `createRecurringJournal` (function) — `backend/src/db.ts`
- `createRecurringJournal` (variable) — `frontend/src/lib/api.ts`
- `createStockTake` (function) — `backend/src/db-stock.ts`
- `createStockTake` (variable) — `frontend/src/lib/api.ts`
- `createSystemEntity` (function) — `backend/src/db-stock.ts`
- `createUser` (function) — `backend/src/auth.ts`
- `createUserAccount` (variable) — `frontend/src/lib/api.ts`
- `CreditStatus` (type) — `backend/src/db.ts`
- `CreditStatus` (type) — `frontend/src/lib/api.ts`
- `creditTotalMinor` (function) — `frontend/src/lib/journalGrid.ts`
- `Currency` (variable) — `backend/src/primitives.ts`
- `CustomerName` (type) — `backend/src/db.ts`
- `CustomerName` (type) — `frontend/src/lib/api.ts`
- `CustomerRegistrationInput` (type) — `backend/src/db.ts`
- `CustomerRegistrationInput` (type) — `frontend/src/lib/api.ts`
- `CustomerStatement` (type) — `backend/src/db.ts`
- `CustomerStatement` (type) — `frontend/src/lib/api.ts`
- `db` (variable) — `backend/src/db.ts`
- `debitTotalMinor` (function) — `frontend/src/lib/journalGrid.ts`
- `decimalPlacesFor` (function) — `frontend/src/lib/format.ts`
- `deleteBomComponent` (function) — `backend/src/db.ts`
- `deleteBomComponent` (variable) — `frontend/src/lib/api.ts`
- `deleteDimensionParent` (function) — `backend/src/db.ts`
- `deleteEntity` (function) — `backend/src/db.ts`
- `deleteEntity` (variable) — `frontend/src/lib/api.ts`
- `deleteEntityLink` (function) — `backend/src/db.ts`
- `deleteItemSource` (function) — `backend/src/db.ts`
- `deleteItemSource` (variable) — `frontend/src/lib/api.ts`
- `deleteMenuOverride` (function) — `backend/src/db.ts`
- `deleteMenuOverride` (variable) — `frontend/src/lib/api.ts`
- `deleteTypedAddress` (function) — `backend/src/db.ts`
- `deleteTypedAddress` (variable) — `frontend/src/lib/api.ts`
- `deleteTypedContactPerson` (function) — `backend/src/db.ts`
- `deleteTypedContactPerson` (variable) — `frontend/src/lib/api.ts`
- `deleteTypedPhone` (function) — `backend/src/db.ts`
- `deleteTypedPhone` (variable) — `frontend/src/lib/api.ts`
- `deleteVocabularyPreference` (function) — `backend/src/db.ts`
- `deleteVocabularyPreference` (variable) — `frontend/src/lib/api.ts`
- `DemoCategory` (type) — `shared-fixtures/wine-retail-demo-data.ts`
- `DemoLocation` (type) — `shared-fixtures/wine-retail-demo-data.ts`
- `DemoProduct` (type) — `shared-fixtures/wine-retail-demo-data.ts`
- `DemoStockLevel` (type) — `shared-fixtures/wine-retail-demo-data.ts`
- `DemoUpc` (type) — `shared-fixtures/wine-retail-demo-data.ts`
- `Detail` (variable) — `backend/src/primitives.ts`
- `differenceMinor` (function) — `frontend/src/lib/journalGrid.ts`
- `DimensionLinkPointingAt` (type) — `frontend/src/lib/api.ts`
- `dispatchOrderFromPickingList` (function) — `backend/src/db.ts`
- `dispatchRestockFromPickingList` (function) — `backend/src/db.ts`
- `dispatchRestockRun` (variable) — `frontend/src/lib/api.ts`
- `dispatchStockFromLocation` (function) — `backend/src/db-stock.ts`
- `dispatchStockFromLocation` (variable) — `frontend/src/lib/api.ts`
- `DivisionName` (type) — `backend/src/db.ts`
- `DivisionName` (type) — `frontend/src/lib/api.ts`
- `DivisionRecord` (type) — `frontend/src/lib/api.ts`
- `EInvoiceDiscrepancy` (type) — `backend/src/db.ts`
- `EInvoiceDiscrepancy` (type) — `frontend/src/lib/api.ts`
- `EmployeeClock` (type) — `backend/src/db.ts`
- `EmployeeClock` (type) — `frontend/src/lib/api.ts`
- `EmployeeName` (type) — `backend/src/db.ts`
- `EmployeeName` (type) — `frontend/src/lib/api.ts`
- `EmployeeScheduleLine` (type) — `backend/src/db.ts`
- `EmployeeScheduleLine` (type) — `frontend/src/lib/api.ts`
- `emptyRow` (function) — `frontend/src/lib/journalGrid.ts`
- `ensureAddressType` (function) — `backend/src/db.ts`
- `ensureAtLeastOneRow` (function) — `frontend/src/lib/journalGrid.ts`
- `ensureCategoryChain` (function) — `backend/src/db.ts`
- `ensureContactPersonType` (function) — `backend/src/db.ts`
- `ensureLocationCapacityAccount` (function) — `backend/src/db-stock.ts`
- `ensureLocationScopedAccount` (function) — `backend/src/db.ts`
- `ensurePhoneType` (function) — `backend/src/db.ts`
- `ensureProductInventoryAccount` (function) — `backend/src/db.ts`
- `ensureProductLocationInventoryAccount` (function) — `backend/src/db.ts`
- `ensureProductLocationLeaf` (function) — `backend/src/db.ts`
- `ensureProductQuantityAccounts` (function) — `backend/src/db.ts`
- `ensureProductSalesCogsAccounts` (function) — `backend/src/db.ts`
- `ensureProductTierItem` (function) — `backend/src/db.ts`
- `ensureProductTierLocationLeaf` (function) — `backend/src/db.ts`
- `Entity` (variable) — `backend/src/primitives.ts`
- `EntityHistoryRow` (type) — `backend/src/db.ts`
- `EntityId` (type) — `backend/src/db.ts`
- `EntityNode` (type) — `backend/src/db.ts`
- `EntityNode` (type) — `frontend/src/lib/api.ts`
- `EntityStructure` (type) — `backend/src/db.ts`
- `EntityUpdate` (type) — `backend/src/db.ts`
- `escapeAscii` (function) — `shared-fixtures/csv.ts`
- `ExpiringLot` (type) — `backend/src/db-stock.ts`
- `ExpiringLot` (type) — `frontend/src/lib/api.ts`
- `exportInvoiceAsUbl` (function) — `backend/src/db.ts`
- `FetchPageResult` (type) — `frontend/src/lib/pagination.ts`
- `filterToItems` (function) — `frontend/src/lib/entityTree.ts`
- `fixtures` (variable) — `shared-fixtures/wine-retail.ts`
- `ForecastLine` (type) — `backend/src/db.ts`
- `ForecastLine` (type) — `frontend/src/lib/api.ts`
- `formatAmount` (function) — `frontend/src/lib/format.ts`
- `formatDate` (function) — `frontend/src/lib/format.ts`
- `fulfillOrder` (function) — `backend/src/db-stock.ts`
- `getAccountsPostedTo` (function) — `backend/src/db.ts`
- `getActiveShiftsAtLocation` (function) — `backend/src/db.ts`
- `getAgedInvoices` (function) — `backend/src/db.ts`
- `getAgedInvoices` (variable) — `frontend/src/lib/api.ts`
- `getAgedSummary` (function) — `backend/src/db.ts`
- `getAgedSummary` (variable) — `frontend/src/lib/api.ts`
- `getAgingBuckets` (function) — `backend/src/db.ts`
- `getAllTranslations` (function) — `backend/src/db.ts`
- `getAncestorChain` (function) — `backend/src/db.ts`
- `getAxisValues` (function) — `backend/src/db-matrix-reports.ts`
- `getAxisValues` (variable) — `frontend/src/lib/matrix-api.ts`
- `getBalanceSheet` (function) — `backend/src/db-reports.ts`
- `getBalanceSheet` (variable) — `frontend/src/lib/api.ts`
- `getBankAccounts` (function) — `backend/src/db.ts`
- `getBankAccounts` (variable) — `frontend/src/lib/api.ts`
- `getBelowReorderStock` (function) — `backend/src/db-stock.ts`
- `getBelowReorderStock` (variable) — `frontend/src/lib/api.ts`
- `getBomComponents` (function) — `backend/src/db.ts`
- `getBomComponents` (variable) — `frontend/src/lib/api.ts`
- `getBusinesses` (function) — `backend/src/db.ts`
- `getBusinesses` (variable) — `frontend/src/lib/api.ts`
- `getBusinessReports` (function) — `backend/src/db-reports.ts`
- `getBusinessReports` (variable) — `frontend/src/lib/api.ts`
- `getBusinessTypes` (function) — `backend/src/db.ts`
- `getBusinessTypes` (variable) — `frontend/src/lib/api.ts`
- `getCashFlowForecast` (function) — `backend/src/db.ts`
- `getCashFlowForecast` (variable) — `frontend/src/lib/api.ts`
- `getCashPosition` (function) — `backend/src/db.ts`
- `getCashPosition` (variable) — `frontend/src/lib/api.ts`
- `getChartOfAccounts` (function) — `backend/src/db-reports.ts`
- `getChartOfAccounts` (variable) — `frontend/src/lib/api.ts`
- `getCoaFamilyAccounts` (function) — `backend/src/db.ts`
- `getCoaFamilyAccounts` (variable) — `frontend/src/lib/api.ts`
- `getConceptsWithAlternates` (function) — `backend/src/db.ts`
- `getConceptsWithAlternates` (variable) — `frontend/src/lib/api.ts`
- `getContact` (function) — `backend/src/db.ts`
- `getContact` (variable) — `frontend/src/lib/api.ts`
- `getContactBaseAccounts` (function) — `backend/src/db.ts`
- `getContactsWithType` (function) — `backend/src/db.ts`
- `getContactTypes` (function) — `backend/src/db.ts`
- `getCounterpartyHistory` (function) — `backend/src/db.ts`
- `getCounterpartyHistory` (variable) — `frontend/src/lib/api.ts`
- `getCreditStatus` (function) — `backend/src/db.ts`
- `getCreditStatus` (variable) — `frontend/src/lib/api.ts`
- `getCustomerStatement` (function) — `backend/src/db.ts`
- `getCustomerStatement` (variable) — `frontend/src/lib/api.ts`
- `getDefaultLanguage` (function) — `backend/src/db.ts`
- `getDefaultLanguage` (variable) — `frontend/src/lib/api.ts`
- `getDimensionAncestorChain` (function) — `backend/src/db.ts`
- `getDimensionChildren` (function) — `backend/src/db.ts`
- `getDimensionLinksPointingAt` (function) — `backend/src/db.ts`
- `getDimensionLinksPointingAt` (variable) — `frontend/src/lib/api.ts`
- `getDimensionParent` (function) — `backend/src/db.ts`
- `getDivisionForAccount` (function) — `backend/src/db.ts`
- `getDivisions` (function) — `backend/src/db.ts`
- `getDivisions` (variable) — `frontend/src/lib/api.ts`
- `getDivisionType` (function) — `backend/src/db.ts`
- `getDivisionTypes` (function) — `backend/src/db.ts`
- `getEffectiveSaleCurrency` (function) — `backend/src/db-stock.ts`
- `getEmployeeSchedule` (function) — `backend/src/db.ts`
- `getEmployeeSchedule` (variable) — `frontend/src/lib/api.ts`
- `getEntitiesWithRelationship` (function) — `backend/src/db.ts`
- `getEntity` (function) — `backend/src/db.ts`
- `getEntityHistory` (function) — `backend/src/db.ts`
- `getEntityLink` (function) — `backend/src/db.ts`
- `getEntityTree` (function) — `backend/src/db.ts`
- `getEntityTree` (variable) — `frontend/src/lib/api.ts`
- `getExpiringStock` (function) — `backend/src/db-stock.ts`
- `getExpiringStock` (variable) — `frontend/src/lib/api.ts`
- `getHierarchy` (function) — `backend/src/db.ts`
- `getInvoice` (function) — `backend/src/db.ts`
- `getInvoiceById` (variable) — `frontend/src/lib/api.ts`
- `getInvoiceLine` (function) — `backend/src/db.ts`
- `getInvoiceOutstanding` (variable) — `frontend/src/lib/api.ts`
- `getInvoiceOutstandingMinor` (function) — `backend/src/db.ts`
- `getItem` (function) — `backend/src/db.ts`
- `getItem` (variable) — `frontend/src/lib/api.ts`
- `getItemByUpc` (function) — `backend/src/db.ts`
- `getItemLeadTimes` (function) — `backend/src/db-stock.ts`
- `getItemLocation` (function) — `backend/src/db-stock.ts`
- `getItemLocation` (variable) — `frontend/src/lib/api.ts`
- `getItemPriceForCurrency` (function) — `backend/src/db.ts`
- `getItemProduct` (function) — `backend/src/db.ts`
- `getItemStorageOrigin` (function) — `backend/src/db.ts`
- `getItemStorageOrigin` (variable) — `frontend/src/lib/api.ts`
- `getJournalEntry` (function) — `backend/src/db.ts`
- `getJournalEntry` (variable) — `frontend/src/lib/api.ts`
- `getLanguageDirection` (function) — `backend/src/db.ts`
- `getLanguageDirection` (variable) — `frontend/src/lib/api.ts`
- `getLanguages` (function) — `backend/src/db.ts`
- `getLanguages` (variable) — `frontend/src/lib/api.ts`
- `getLedgerBalances` (function) — `backend/src/db-reports.ts`
- `getLedgerBalancesByDivision` (function) — `backend/src/db-reports.ts`
- `getLedgerBalancesByDivisionStructural` (function) — `backend/src/db-reports.ts`
- `getLedgerDateRange` (function) — `backend/src/db.ts`
- `getLedgerDateRange` (variable) — `frontend/src/lib/api.ts`
- `getLedgers` (function) — `backend/src/db.ts`
- `getLedgers` (variable) — `frontend/src/lib/api.ts`
- `getLineType` (function) — `backend/src/db.ts`
- `getLocalizedText` (function) — `backend/src/db.ts`
- `getLocalizedText` (variable) — `frontend/src/lib/api.ts`
- `getLocation` (function) — `backend/src/db-stock.ts`
- `getLocationByName` (variable) — `frontend/src/lib/api.ts`
- `getLocationCapacityStatus` (function) — `backend/src/db-stock.ts`
- `getLocationForAccount` (function) — `backend/src/db.ts`
- `getLocationOpenHours` (function) — `backend/src/db.ts`
- `getLocationOpenHours` (variable) — `frontend/src/lib/api.ts`
- `getLocationTypes` (function) — `backend/src/db-stock.ts`
- `getLocationTypes` (variable) — `frontend/src/lib/api.ts`
- `getMenuTree` (function) — `backend/src/db.ts`
- `getMenuTree` (variable) — `frontend/src/lib/api.ts`
- `getOpenProjectClock` (variable) — `frontend/src/lib/api.ts`
- `getOpenProjectClockForEmployee` (function) — `backend/src/db.ts`
- `getOpenShiftForEmployee` (function) — `backend/src/db.ts`
- `getOrderStatus` (function) — `backend/src/db-stock.ts`
- `getOrderStatus` (variable) — `frontend/src/lib/api.ts`
- `getOrganizationChart` (function) — `backend/src/db.ts`
- `getOrganizationChart` (variable) — `frontend/src/lib/api.ts`
- `getPeriodLockStatus` (function) — `backend/src/db.ts`
- `getPeriodStatus` (variable) — `frontend/src/lib/api.ts`
- `getPickingList` (function) — `backend/src/db.ts`
- `getProductUnitCostMinor` (function) — `backend/src/db.ts`
- `getProfitAndLoss` (function) — `backend/src/db-reports.ts`
- `getProfitAndLoss` (variable) — `frontend/src/lib/api.ts`
- `getProfitAndLossByAxis` (function) — `backend/src/db-matrix-reports.ts`
- `getProfitAndLossByAxis` (variable) — `frontend/src/lib/matrix-api.ts`
- `getProfitAndLossByDivision` (function) — `backend/src/db-reports.ts`
- `getProfitAndLossByDivision` (variable) — `frontend/src/lib/api.ts`
- `getProfitAndLossByDivisionTree` (function) — `backend/src/db-reports.ts`
- `getProfitAndLossByDivisionTree` (variable) — `frontend/src/lib/api.ts`
- `getProfitAndLossComparison` (function) — `backend/src/db-reports.ts`
- `getProfitAndLossComparison` (variable) — `frontend/src/lib/api.ts`
- `getProjectTasks` (function) — `backend/src/db.ts`
- `getRelationship` (function) — `backend/src/db.ts`
- `getReminderCandidates` (function) — `backend/src/db.ts`
- `getReminderCandidates` (variable) — `frontend/src/lib/api.ts`
- `getRestockPickingList` (function) — `backend/src/db.ts`
- `getRestockPickingList` (variable) — `frontend/src/lib/api.ts`
- `getRoles` (variable) — `frontend/src/lib/api.ts`
- `getSalesCogsMatrix` (function) — `backend/src/db-matrix-reports.ts`
- `getSalesCogsMatrix` (variable) — `frontend/src/lib/matrix-api.ts`
- `getSalesReport` (function) — `backend/src/db-reports.ts`
- `getSalesReport` (variable) — `frontend/src/lib/api.ts`
- `getScheduleAtLocation` (function) — `backend/src/db.ts`
- `getScheduleAtLocation` (variable) — `frontend/src/lib/api.ts`
- `getScreenTitle` (function) — `backend/src/db.ts`
- `getSessionUser` (function) — `backend/src/auth.ts`
- `getStagedLines` (function) — `backend/src/db.ts`
- `getStagedLines` (variable) — `frontend/src/lib/api.ts`
- `getStockListing` (function) — `backend/src/db-stock.ts`
- `getStockListing` (variable) — `frontend/src/lib/api.ts`
- `getStockListingByLocation` (function) — `backend/src/db-stock.ts`
- `getStockListingByLocation` (variable) — `frontend/src/lib/api.ts`
- `getStockMovementReport` (function) — `backend/src/db-stock.ts`
- `getStockMovementReport` (variable) — `frontend/src/lib/api.ts`
- `getStockOnHandMatrix` (function) — `backend/src/db-matrix-reports.ts`
- `getStockOnHandMatrix` (variable) — `frontend/src/lib/matrix-api.ts`
- `getStockOutRiskReport` (function) — `backend/src/db-stock.ts`
- `getStockOutRiskReport` (variable) — `frontend/src/lib/api.ts`
- `getStockTake` (function) — `backend/src/db-stock.ts`
- `getStockTake` (variable) — `frontend/src/lib/api.ts`
- `getTaskDependencies` (function) — `backend/src/db.ts`
- `getTranslation` (function) — `backend/src/db.ts`
- `getTrialBalance` (function) — `backend/src/db-reports.ts`
- `getTrialBalance` (variable) — `frontend/src/lib/api.ts`
- `getTrialBalanceComparison` (function) — `backend/src/db-reports.ts`
- `getTrialBalanceComparison` (variable) — `frontend/src/lib/api.ts`
- `getTypedAddresses` (function) — `backend/src/db.ts`
- `getTypedAddresses` (variable) — `frontend/src/lib/api.ts`
- `getTypedContactPersons` (function) — `backend/src/db.ts`
- `getTypedContactPersons` (variable) — `frontend/src/lib/api.ts`
- `getTypedPhones` (function) — `backend/src/db.ts`
- `getTypedPhones` (variable) — `frontend/src/lib/api.ts`
- `getUsers` (variable) — `frontend/src/lib/api.ts`
- `getVocabularyAlternates` (function) — `backend/src/db.ts`
- `getVocabularyAlternates` (variable) — `frontend/src/lib/api.ts`
- `getVocabularyWords` (function) — `backend/src/db.ts`
- `getVocabularyWords` (variable) — `frontend/src/lib/api.ts`
- `hashPassword` (function) — `backend/src/password.ts`
- `hasRole` (function) — `frontend/src/lib/auth.ts`
- `hasRole` (function) — `frontend/src/lib/state.svelte.ts`
- `hasUnsavedEdit` (variable) — `frontend/src/lib/state.svelte.ts`
- `hasUnsavedEdit` (variable) — `frontend/src/lib/dirty-state.ts`
- `Hierarchy` (variable) — `backend/src/primitives.ts`
- `HierarchyNode` (type) — `backend/src/db.ts`
- `HierarchyTreeNode` (type) — `backend/src/primitives.ts`
- `HistoryLine` (type) — `backend/src/db.ts`
- `HistoryLine` (type) — `frontend/src/lib/api.ts`
- `importEInvoice` (variable) — `frontend/src/lib/api.ts`
- `ImportEInvoiceResult` (type) — `frontend/src/lib/api.ts`
- `importUblInvoiceAsDraft` (function) — `backend/src/db.ts`
- `instantiateChartOfAccounts` (function) — `backend/src/db.ts`
- `Invoice` (type) — `backend/src/db.ts`
- `Invoice` (type) — `frontend/src/lib/api.ts`
- `InvoiceInput` (type) — `backend/src/db.ts`
- `InvoiceInput` (type) — `frontend/src/lib/api.ts`
- `InvoiceLine` (type) — `backend/src/db.ts`
- `InvoiceLine` (type) — `frontend/src/lib/api.ts`
- `InvoiceLineInput` (type) — `backend/src/db.ts`
- `InvoiceOptions` (type) — `backend/src/invoice.ts`
- `isBalanced` (function) — `frontend/src/lib/journalGrid.ts`
- `isDescendantOf` (function) — `frontend/src/lib/entityTree.ts`
- `isRowEmpty` (function) — `frontend/src/lib/journalGrid.ts`
- `isRowFilled` (function) — `frontend/src/lib/journalGrid.ts`
- `Item` (type) — `backend/src/db.ts`
- `Item` (type) — `frontend/src/lib/api.ts`
- `ItemLocationLevels` (type) — `backend/src/db-stock.ts`
- `ItemLocationLevels` (type) — `frontend/src/lib/api.ts`
- `ItemName` (type) — `backend/src/db.ts`
- `ItemName` (type) — `frontend/src/lib/api.ts`
- `ItemSource` (type) — `backend/src/db.ts`
- `ItemSource` (type) — `frontend/src/lib/api.ts`
- `ItemSourceInput` (type) — `backend/src/db.ts`
- `ItemSourceInput` (type) — `frontend/src/lib/api.ts`
- `ItemSummary` (type) — `backend/src/db.ts`
- `ItemSummary` (type) — `frontend/src/lib/api.ts`
- `JournalDetail` (type) — `backend/src/db.ts`
- `JournalDetail` (type) — `frontend/src/lib/api.ts`
- `JournalSummary` (type) — `backend/src/db.ts`
- `JournalSummary` (type) — `frontend/src/lib/api.ts`
- `LedgerDateRange` (type) — `backend/src/db.ts`
- `LedgerDateRange` (type) — `frontend/src/lib/api.ts`
- `LedgerName` (type) — `backend/src/db.ts`
- `LedgerName` (type) — `frontend/src/lib/api.ts`
- `Link` (variable) — `backend/src/primitives.ts`
- `listAddressTypes` (function) — `backend/src/db.ts`
- `listAddressTypes` (variable) — `frontend/src/lib/api.ts`
- `listContactPersonTypes` (function) — `backend/src/db.ts`
- `listContactPersonTypes` (variable) — `frontend/src/lib/api.ts`
- `listInvoices` (function) — `backend/src/db.ts`
- `listInvoices` (variable) — `frontend/src/lib/api.ts`
- `ListInvoicesOptions` (type) — `backend/src/db.ts`
- `listItems` (function) — `backend/src/db.ts`
- `listItems` (variable) — `frontend/src/lib/api.ts`
- `listItemSources` (function) — `backend/src/db.ts`
- `listItemSources` (variable) — `frontend/src/lib/api.ts`
- `listJournalEntries` (function) — `backend/src/db.ts`
- `listJournalEntries` (variable) — `frontend/src/lib/api.ts`
- `listLineTypes` (function) — `backend/src/db.ts`
- `listLocations` (variable) — `frontend/src/lib/api.ts`
- `listPendingCustomers` (function) — `backend/src/db.ts`
- `listPendingCustomers` (variable) — `frontend/src/lib/api.ts`
- `listPhoneTypes` (function) — `backend/src/db.ts`
- `listPhoneTypes` (variable) — `frontend/src/lib/api.ts`
- `listProducts` (function) — `backend/src/db.ts`
- `listProducts` (variable) — `frontend/src/lib/api.ts`
- `listRoles` (function) — `backend/src/auth.ts`
- `listUsers` (function) — `backend/src/auth.ts`
- `loadAllTranslations` (function) — `shared-fixtures/translations.ts`
- `loadDemoCategories` (function) — `shared-fixtures/wine-retail-demo-data.ts`
- `loadDemoLocations` (function) — `shared-fixtures/wine-retail-demo-data.ts`
- `loadDemoProducts` (function) — `shared-fixtures/wine-retail-demo-data.ts`
- `loadDemoStockLevels` (function) — `shared-fixtures/wine-retail-demo-data.ts`
- `loadDemoUpcs` (function) — `shared-fixtures/wine-retail-demo-data.ts`
- `Location` (type) — `backend/src/db-stock.ts`
- `LocationCapacityStatus` (type) — `backend/src/db-stock.ts`
- `LocationCapacityStatus` (type) — `frontend/src/lib/api.ts`
- `LocationInput` (type) — `frontend/src/lib/api.ts`
- `LocationName` (type) — `backend/src/db.ts`
- `LocationName` (type) — `frontend/src/lib/api.ts`
- `LocationRecord` (type) — `frontend/src/lib/api.ts`
- `LocationScheduleLine` (type) — `backend/src/db.ts`
- `LocationScheduleLine` (type) — `frontend/src/lib/api.ts`
- `login` (function) — `backend/src/auth.ts`
- `LoginResponse` (type) — `frontend/src/lib/api.ts`
- `logout` (function) — `backend/src/auth.ts`
- `lookupItemByUpc` (variable) — `frontend/src/lib/api.ts`
- `MatrixAxis` (type) — `backend/src/db-matrix-reports.ts`
- `MatrixAxis` (type) — `frontend/src/lib/matrix-api.ts`
- `MatrixCell` (type) — `backend/src/db-matrix-reports.ts`
- `MatrixCell` (type) — `frontend/src/lib/matrix-api.ts`
- `MenuLinkRow` (type) — `backend/src/db.ts`
- `MenuLinkRow` (type) — `frontend/src/lib/api.ts`
- `MenuSectionRow` (type) — `backend/src/db.ts`
- `MenuSectionRow` (type) — `frontend/src/lib/api.ts`
- `menuTree` (variable) — `frontend/src/lib/state.svelte.ts`
- `NewEntity` (type) — `backend/src/db.ts`
- `OpenHoursLine` (type) — `backend/src/db.ts`
- `OpenHoursLine` (type) — `frontend/src/lib/api.ts`
- `OrganizationChart` (type) — `backend/src/db.ts`
- `OrganizationChart` (type) — `frontend/src/lib/api.ts`
- `OrgChartDivision` (type) — `backend/src/db.ts`
- `PaginatedState` (type) — `frontend/src/lib/pagination.ts`
- `Paginator` (type) — `frontend/src/lib/pagination.ts`
- `parseMinorUnits` (function) — `frontend/src/lib/money.ts`
- `parseQuantity` (function) — `frontend/src/lib/money.ts`
- `parseUblInvoice` (function) — `backend/src/db.ts`
- `payEmployeeWages` (function) — `backend/src/db.ts`
- `payEmployeeWages` (variable) — `frontend/src/lib/api.ts`
- `PayEmployeeWagesInput` (type) — `backend/src/db.ts`
- `PayEmployeeWagesResult` (type) — `backend/src/db.ts`
- `PayWagesResult` (type) — `frontend/src/lib/api.ts`
- `PendingCustomer` (type) — `backend/src/db.ts`
- `PendingCustomer` (type) — `frontend/src/lib/api.ts`
- `PeriodLockStatus` (type) — `backend/src/db.ts`
- `PeriodLockStatus` (type) — `frontend/src/lib/api.ts`
- `PickingListLine` (type) — `backend/src/db.ts`
- `PickingListLine` (type) — `frontend/src/lib/api.ts`
- `placeOrder` (function) — `backend/src/db-stock.ts`
- `PosSaleInput` (type) — `backend/src/db.ts`
- `PosSaleLineInput` (type) — `backend/src/db.ts`
- `PosSaleLineInput` (type) — `frontend/src/lib/api.ts`
- `PosSaleResult` (type) — `backend/src/db.ts`
- `PosSaleResult` (type) — `frontend/src/lib/api.ts`
- `PosShift` (type) — `backend/src/db.ts`
- `postApPayment` (function) — `backend/src/db.ts`
- `postApPayment` (variable) — `frontend/src/lib/api.ts`
- `postApPurchase` (function) — `backend/src/db.ts`
- `postApPurchase` (variable) — `frontend/src/lib/api.ts`
- `postArReceipt` (function) — `backend/src/db.ts`
- `postArReceipt` (variable) — `frontend/src/lib/api.ts`
- `postArSale` (function) — `backend/src/db.ts`
- `postArSale` (variable) — `frontend/src/lib/api.ts`
- `postBomComponents` (function) — `backend/src/db.ts`
- `postInvoice` (function) — `backend/src/db.ts`
- `postInvoiceById` (variable) — `frontend/src/lib/api.ts`
- `postJournalEntry` (function) — `backend/src/db.ts`
- `postJournalEntry` (variable) — `frontend/src/lib/api.ts`
- `postPurchaseOrder` (function) — `backend/src/db.ts`
- `postPurchaseOrder` (variable) — `frontend/src/lib/api.ts`
- `postQuantityMovement` (function) — `backend/src/db-stock.ts`
- `postSalesOrder` (function) — `backend/src/db.ts`
- `postSalesOrder` (variable) — `frontend/src/lib/api.ts`
- `postStagedQuantityMovement` (function) — `backend/src/db-stock.ts`
- `postStockDispatch` (function) — `backend/src/db.ts`
- `postStockDispatch` (variable) — `frontend/src/lib/api.ts`
- `postStockReceipt` (function) — `backend/src/db.ts`
- `postStockReceipt` (variable) — `frontend/src/lib/api.ts`
- `previewCloseBooks` (function) — `backend/src/db-reports.ts`
- `previewCloseBooks` (variable) — `frontend/src/lib/api.ts`
- `ProductSummary` (type) — `backend/src/db.ts`
- `ProductSummary` (type) — `frontend/src/lib/api.ts`
- `ProfitAndLoss` (type) — `backend/src/db-reports.ts`
- `ProfitAndLoss` (type) — `frontend/src/lib/api.ts`
- `ProfitAndLossByAxisNode` (type) — `backend/src/db-matrix-reports.ts`
- `ProfitAndLossByAxisNode` (type) — `frontend/src/lib/matrix-api.ts`
- `ProfitAndLossByDivision` (type) — `backend/src/db-reports.ts`
- `ProfitAndLossByDivision` (type) — `frontend/src/lib/api.ts`
- `ProfitAndLossByDivisionNode` (type) — `backend/src/db-reports.ts`
- `ProfitAndLossByDivisionNode` (type) — `frontend/src/lib/api.ts`
- `ProfitAndLossComparison` (type) — `backend/src/db-reports.ts`
- `ProfitAndLossComparison` (type) — `frontend/src/lib/api.ts`
- `ProfitAndLossComparisonLine` (type) — `backend/src/db-reports.ts`
- `ProfitAndLossComparisonLine` (type) — `frontend/src/lib/api.ts`
- `PurchaseOrderInput` (type) — `backend/src/db.ts`
- `PurchaseOrderInput` (type) — `frontend/src/lib/api.ts`
- `readCsv` (function) — `shared-fixtures/csv.ts`
- `receiveLot` (function) — `backend/src/db-stock.ts`
- `receiveLot` (variable) — `frontend/src/lib/api.ts`
- `receiveStockAtLocation` (function) — `backend/src/db-stock.ts`
- `receiveStockAtLocation` (variable) — `frontend/src/lib/api.ts`
- `recordReminderSent` (function) — `backend/src/db.ts`
- `recordStockTakeCount` (function) — `backend/src/db-stock.ts`
- `recordStockTakeCount` (variable) — `frontend/src/lib/api.ts`
- `Recurrence` (type) — `backend/src/db.ts`
- `RecurringJournalLine` (type) — `backend/src/db.ts`
- `RecurringJournalLine` (type) — `frontend/src/lib/api.ts`
- `registerBankAccount` (function) — `backend/src/db.ts`
- `registerBankAccount` (variable) — `frontend/src/lib/api.ts`
- `registerCustomer` (function) — `backend/src/db.ts`
- `registerCustomer` (variable) — `frontend/src/lib/api.ts`
- `Relationship` (type) — `backend/src/db.ts`
- `ReminderCandidate` (type) — `backend/src/db.ts`
- `ReminderCandidate` (type) — `frontend/src/lib/api.ts`
- `removeContactType` (function) — `backend/src/db.ts`
- `removeRowAt` (function) — `frontend/src/lib/journalGrid.ts`
- `removeStagedLine` (function) — `backend/src/db.ts`
- `removeStagedLine` (variable) — `frontend/src/lib/api.ts`
- `reopenPeriod` (function) — `backend/src/db.ts`
- `reopenPeriod` (variable) — `frontend/src/lib/api.ts`
- `reorderSiblings` (function) — `backend/src/db.ts`
- `reorderSiblingsBulk` (function) — `backend/src/db.ts`
- `ReportRow` (type) — `backend/src/db-reports.ts`
- `ReportRow` (type) — `frontend/src/lib/api.ts`
- `requireAuth` (function) — `backend/src/auth-middleware.ts`
- `requireRole` (function) — `backend/src/auth-middleware.ts`
- `resetReminder` (variable) — `frontend/src/lib/api.ts`
- `resetReminderLevel` (function) — `backend/src/db.ts`
- `resolveDispatchLocation` (function) — `backend/src/db.ts`
- `resolveItemId` (function) — `backend/src/db.ts`
- `RestockLineInput` (type) — `backend/src/db.ts`
- `RestockLineInput` (type) — `frontend/src/lib/api.ts`
- `reverseJournalEntry` (function) — `backend/src/db.ts`
- `reverseJournalEntry` (variable) — `frontend/src/lib/api.ts`
- `Row` (type) — `frontend/src/lib/journalGrid.ts`
- `SalesCategorySummary` (type) — `backend/src/db-reports.ts`
- `SalesCategorySummary` (type) — `frontend/src/lib/api.ts`
- `SalesCogsMatrix` (type) — `backend/src/db-matrix-reports.ts`
- `SalesCogsMatrix` (type) — `frontend/src/lib/matrix-api.ts`
- `SalesOrderInput` (type) — `backend/src/db.ts`
- `SalesOrderInput` (type) — `frontend/src/lib/api.ts`
- `SalesReport` (type) — `backend/src/db-reports.ts`
- `SalesReport` (type) — `frontend/src/lib/api.ts`
- `SalesReportLine` (type) — `backend/src/db-reports.ts`
- `SalesReportLine` (type) — `frontend/src/lib/api.ts`
- `saveBusinessTypeAnswers` (function) — `backend/src/db.ts`
- `saveBusinessTypeAnswers` (variable) — `frontend/src/lib/api.ts`
- `saveLocation` (variable) — `frontend/src/lib/api.ts`
- `ScheduleLine` (type) — `backend/src/db.ts`
- `ScheduleLine` (type) — `frontend/src/lib/api.ts`
- `screenTitle` (function) — `frontend/src/lib/state.svelte.ts`
- `seedRemainingData` (function) — `backend/src/db-seed.ts`
- `sendReminder` (variable) — `frontend/src/lib/api.ts`
- `session` (variable) — `frontend/src/lib/session.ts`
- `session` (variable) — `frontend/src/lib/state.svelte.ts`
- `SessionContext` (type) — `frontend/src/lib/session.ts`
- `SessionContext` (type) — `frontend/src/lib/state.svelte.ts`
- `setAccountCurrency` (function) — `backend/src/db-reports.ts`
- `setBomComponent` (variable) — `frontend/src/lib/api.ts`
- `setContact` (function) — `backend/src/db.ts`
- `setContact` (variable) — `frontend/src/lib/api.ts`
- `setContactType` (function) — `backend/src/db.ts`
- `setDefaultLanguage` (function) — `backend/src/db.ts`
- `setDefaultLanguage` (variable) — `frontend/src/lib/api.ts`
- `setDimensionParent` (function) — `backend/src/db.ts`
- `setDivisionType` (function) — `backend/src/db.ts`
- `setEmployeeSchedule` (function) — `backend/src/db.ts`
- `setEmployeeSchedule` (variable) — `frontend/src/lib/api.ts`
- `setEntityLink` (function) — `backend/src/db.ts`
- `setEntityRelationship` (variable) — `frontend/src/lib/api.ts`
- `setItem` (function) — `backend/src/db.ts`
- `setItem` (variable) — `frontend/src/lib/api.ts`
- `setItemLocationLevelDetails` (function) — `backend/src/db-stock.ts`
- `setItemLocationLevels` (function) — `backend/src/db-stock.ts`
- `setItemLocationLevels` (variable) — `frontend/src/lib/api.ts`
- `setItemProduct` (function) — `backend/src/db.ts`
- `setItemProduct` (variable) — `frontend/src/lib/api.ts`
- `setItemSourceLeadTime` (function) — `backend/src/db-stock.ts`
- `setItemSourceLeadTime` (variable) — `frontend/src/lib/api.ts`
- `setItemStorageOrigin` (function) — `backend/src/db.ts`
- `setItemStorageOrigin` (variable) — `frontend/src/lib/api.ts`
- `setLanguageDirection` (function) — `backend/src/db.ts`
- `setLanguageDirection` (variable) — `frontend/src/lib/api.ts`
- `setLineType` (function) — `backend/src/db.ts`
- `setLocation` (function) — `backend/src/db-stock.ts`
- `setLocationOpenHours` (function) — `backend/src/db.ts`
- `setLocationOpenHours` (variable) — `frontend/src/lib/api.ts`
- `setMenuOverride` (function) — `backend/src/db.ts`
- `setMenuOverride` (variable) — `frontend/src/lib/api.ts`
- `setOwnDateFormat` (function) — `backend/src/auth.ts`
- `setOwnDateFormat` (variable) — `frontend/src/lib/api.ts`
- `setOwnNumberFormat` (function) — `backend/src/auth.ts`
- `setOwnNumberFormat` (variable) — `frontend/src/lib/api.ts`
- `setOwnPageSize` (function) — `backend/src/auth.ts`
- `setOwnPageSize` (variable) — `frontend/src/lib/api.ts`
- `setPosPin` (function) — `backend/src/db.ts`
- `setRelationship` (function) — `backend/src/db.ts`
- `setTerminalCurrency` (function) — `backend/src/db-stock.ts`
- `setTranslation` (function) — `backend/src/db.ts`
- `setTranslation` (variable) — `frontend/src/lib/api.ts`
- `setTypedAddress` (variable) — `frontend/src/lib/api.ts`
- `setTypedContactPerson` (variable) — `frontend/src/lib/api.ts`
- `setTypedPhone` (variable) — `frontend/src/lib/api.ts`
- `setupEquityStructure` (function) — `backend/src/db.ts`
- `setUserActive` (function) — `backend/src/auth.ts`
- `setUserActiveApi` (variable) — `frontend/src/lib/api.ts`
- `setUserRoles` (function) — `backend/src/auth.ts`
- `setUserRolesApi` (variable) — `frontend/src/lib/api.ts`
- `setVocabularyPreference` (function) — `backend/src/db.ts`
- `setVocabularyPreference` (variable) — `frontend/src/lib/api.ts`
- `signOff` (function) — `backend/src/db.ts`
- `signOn` (function) — `backend/src/db.ts`
- `stageApPayment` (function) — `backend/src/db.ts`
- `stageApPayment` (variable) — `frontend/src/lib/api.ts`
- `stageApPurchase` (function) — `backend/src/db.ts`
- `stageApPurchase` (variable) — `frontend/src/lib/api.ts`
- `stageArReceipt` (function) — `backend/src/db.ts`
- `stageArReceipt` (variable) — `frontend/src/lib/api.ts`
- `stageArSale` (function) — `backend/src/db.ts`
- `stageArSale` (variable) — `frontend/src/lib/api.ts`
- `stageBomComponent` (function) — `backend/src/db.ts`
- `StagedLine` (type) — `backend/src/db.ts`
- `StagedLine` (type) — `frontend/src/lib/api.ts`
- `stageLine` (function) — `backend/src/db.ts`
- `stageLine` (variable) — `frontend/src/lib/api.ts`
- `stagePurchaseOrder` (function) — `backend/src/db.ts`
- `stagePurchaseOrder` (variable) — `frontend/src/lib/api.ts`
- `stageQuantityMovementLine` (function) — `backend/src/db-stock.ts`
- `stageSalesOrder` (function) — `backend/src/db.ts`
- `stageSalesOrder` (variable) — `frontend/src/lib/api.ts`
- `stageStockDispatch` (function) — `backend/src/db.ts`
- `stageStockDispatch` (variable) — `frontend/src/lib/api.ts`
- `stageStockReceipt` (function) — `backend/src/db.ts`
- `stageStockReceipt` (variable) — `frontend/src/lib/api.ts`
- `StatementLine` (type) — `backend/src/db-reports.ts`
- `StatementLine` (type) — `backend/src/db.ts`
- `StatementLine` (type) — `frontend/src/lib/api.ts`
- `StatementLine` (type) — `frontend/src/lib/api.ts`
- `StockDispatchInput` (type) — `backend/src/db.ts`
- `StockDispatchInput` (type) — `frontend/src/lib/api.ts`
- `StockListingLocationGroup` (type) — `backend/src/db-stock.ts`
- `StockListingLocationGroup` (type) — `frontend/src/lib/api.ts`
- `StockListingRow` (type) — `backend/src/db-stock.ts`
- `StockListingRow` (type) — `frontend/src/lib/api.ts`
- `StockMovementReport` (type) — `backend/src/db-stock.ts`
- `StockMovementReport` (type) — `frontend/src/lib/api.ts`
- `StockMovementRow` (type) — `backend/src/db-stock.ts`
- `StockMovementRow` (type) — `frontend/src/lib/api.ts`
- `StockOnHandCell` (type) — `backend/src/db-matrix-reports.ts`
- `StockOnHandCell` (type) — `frontend/src/lib/matrix-api.ts`
- `StockOnHandMatrix` (type) — `backend/src/db-matrix-reports.ts`
- `StockOnHandMatrix` (type) — `frontend/src/lib/matrix-api.ts`
- `StockOutRiskRow` (type) — `backend/src/db-stock.ts`
- `StockOutRiskRow` (type) — `frontend/src/lib/api.ts`
- `StockReceiptInput` (type) — `backend/src/db.ts`
- `StockReceiptInput` (type) — `frontend/src/lib/api.ts`
- `StockReceiptRow` (type) — `backend/src/db-stock.ts`
- `StockReceiptRow` (type) — `frontend/src/lib/api.ts`
- `StockSaleRow` (type) — `backend/src/db-stock.ts`
- `StockSaleRow` (type) — `frontend/src/lib/api.ts`
- `StockTake` (type) — `backend/src/db-stock.ts`
- `StockTake` (type) — `frontend/src/lib/api.ts`
- `StockTakeLine` (type) — `backend/src/db-stock.ts`
- `StockTakeLine` (type) — `frontend/src/lib/api.ts`
- `StockTransferRow` (type) — `backend/src/db-stock.ts`
- `StockTransferRow` (type) — `frontend/src/lib/api.ts`
- `todayAtLocation` (function) — `backend/src/db-stock.ts`
- `todayIsoDate` (function) — `frontend/src/lib/format.ts`
- `toTreePaths` (function) — `frontend/src/lib/treeAdapter.ts`
- `transferStock` (function) — `backend/src/db-stock.ts`
- `transferStock` (variable) — `frontend/src/lib/api.ts`
- `TranslationRow` (type) — `shared-fixtures/translations.ts`
- `translations` (variable) — `frontend/src/lib/translations.ts`
- `translations` (variable) — `frontend/src/lib/state.svelte.ts`
- `TreeItem` (type) — `frontend/src/lib/treeAdapter.ts`
- `TrialBalance` (type) — `backend/src/db-reports.ts`
- `TrialBalance` (type) — `frontend/src/lib/api.ts`
- `TrialBalanceComparison` (type) — `backend/src/db-reports.ts`
- `TrialBalanceComparison` (type) — `frontend/src/lib/api.ts`
- `TrialBalanceComparisonRow` (type) — `backend/src/db-reports.ts`
- `TrialBalanceComparisonRow` (type) — `frontend/src/lib/api.ts`
- `TrialBalanceRow` (type) — `backend/src/db-reports.ts`
- `TrialBalanceRow` (type) — `frontend/src/lib/api.ts`
- `TypedAddress` (type) — `backend/src/db.ts`
- `TypedAddress` (type) — `frontend/src/lib/api.ts`
- `TypedPhone` (type) — `backend/src/db.ts`
- `TypedPhone` (type) — `frontend/src/lib/api.ts`
- `UblImportLine` (type) — `backend/src/db.ts`
- `UblImportResult` (type) — `backend/src/db.ts`
- `unescapeAscii` (function) — `shared-fixtures/csv.ts`
- `unregisterBankAccount` (function) — `backend/src/db.ts`
- `unregisterBankAccount` (variable) — `frontend/src/lib/api.ts`
- `updateEntity` (function) — `backend/src/db.ts`
- `updateEntity` (variable) — `frontend/src/lib/api.ts`
- `UserId` (type) — `backend/src/db.ts`
- `UserSummary` (type) — `backend/src/auth.ts`
- `UserSummary` (type) — `frontend/src/lib/api.ts`
- `VendorName` (type) — `backend/src/db.ts`
- `VendorName` (type) — `frontend/src/lib/api.ts`
- `verifyCustomer` (function) — `backend/src/db.ts`
- `verifyCustomer` (variable) — `frontend/src/lib/api.ts`
- `verifyPassword` (function) — `backend/src/password.ts`
- `verifyPosPin` (function) — `backend/src/db.ts`
- `VocabularyWord` (type) — `backend/src/db.ts`
- `VocabularyWord` (type) — `frontend/src/lib/api.ts`
- `writeCsv` (function) — `shared-fixtures/csv.ts`
- `writeOffStock` (function) — `backend/src/db-stock.ts`
- `writeOffStock` (variable) — `frontend/src/lib/api.ts`

797 real, indexed names across 34 real, core files.
