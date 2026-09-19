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
- `backend/src/db.ts` imports: `./sqlite-runtime.js`, `./password.js`, `./primitives.js`, `./db-reports.js`, `./db-seed.js`, `./db-reports.js`, `./db-stock.js`, `./db-stock.js`
- `backend/src/server.ts` imports: `./routes/entities.js`, `./routes/reports.js`, `./routes/matrix-reports.js`, `./routes/menu.js`, `./routes/i18n.js`, `./routes/businesses.js`, `./routes/journal.js`, `./routes/contacts.js`, `./routes/items.js`, `./routes/products.js`, `./routes/invoices.js`, `./routes/stock-lots.js`, `./routes/locations.js`, `./routes/divisions.js`, `./routes/hierarchy.js`, `./routes/pos.js`, `./routes/customer-registration.js`, `./routes/arap.js`, `./routes/auth.js`, `./routes/stock.js`, `./routes/invoice.js`, `./routes/period.js`, `./routes/projects.js`, `./auth-middleware.js`
- `backend/src/db-matrix-reports.ts` imports: `./db.js`, `./db.js`, `./db-reports.js`, `./db.js`
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

Top 15 most-referenced functions across these 35 real, core files:
- `create`: 119
- `fetch`: 72
- `asAccountName`: 56
- `asAccountName`: 56
- `asLedgerName`: 49
- `asLedgerName`: 49
- `asBusinessName`: 48
- `asBusinessName`: 48
- `asItemName`: 39
- `asItemName`: 39
- `stageLine`: 37
- `setEntityLink`: 36
- `requireAuth`: 33
- `setTranslation`: 32
- `asUserId`: 31

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

### `backend/src/sqlite-runtime.ts`

**Types**:

```ts
interface RuntimeDatabase {
  exec(sql: string): void;
  prepare(sql: string): RuntimeStatement;
  transaction<T extends (...args: never[]) => unknown>(fn: T): (...args: Parameters<T>) => ReturnType<T>;
  close(): void;
}
interface RuntimeStatement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}
```

**Exported variables**:

- `Database`

### `backend/src/db-stock.ts`

**Functions**:

```ts
stageQuantityMovementLine(business: BusinessName, ledger: LedgerName, reference: string, account: AccountName, deltaQuantity: number, transdate: string, locationName?: LocationName, accountId?: number): void
postStagedQuantityMovement(business: BusinessName, ledger: LedgerName, reference: string, userId: UserId): void
postQuantityMovement(business: BusinessName, ledger: LedgerName, reference: string, account: AccountName, deltaQuantity: number, userId: UserId, transdate?: string, locationName?: LocationName, accountId?: number): void
getLocationTypes(): string[]
createLocationType(name: string, userId: UserId): void
setLocation(name: string, location: Location): void
getLocation(name: string): Location | undefined
todayAtLocation(locationName: LocationName): string
getItemLocation(itemName: ItemName, locationName: LocationName): ItemLocationLevels
setItemLocationLevelDetails(itemName: ItemName, locationName: LocationName, levels: Omit<ItemLocationLevels, 'quantity_on_hand'>, userId: UserId): void
getLocationCapacityStatus(locationName: LocationName): LocationCapacityStatus
createPosTerminal(terminalName: string, locationName: LocationName, userId: UserId): void
setTerminalCurrency(terminalName: string, currency: string | null): void
getEffectiveSaleCurrency(terminalName: string | undefined): string | null
ensureLocationCapacityAccount(business: BusinessName, ledger: LedgerName, locationName: LocationName, userId: UserId): 
adjustLocationCapacity(business: BusinessName, ledger: LedgerName, locationName: LocationName, itemName: ItemName, itemQuantityDelta: number, transdate: string, userId: UserId, referenceSuffix: string): void
getStockListingByLocation(): StockListingLocationGroup[]
getStockMovementReport(ledgerName: string, fromDate?: string, toDate?: string): StockMovementReport
getStockListing(limit = 100, offset = 0): StockListingRow[]
countStockListing(): number
setItemLocationLevels(itemName: ItemName, locationName: LocationName, levels: {
    minLevel?: number | null;
    maxLevel?: number | null;
    reorderLevel?: number | null;
    shelfSide?: string | null;
    rack?: string | null;
    level?: number | null;
  }): void
receiveStockAtLocation(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, locationName: LocationName, quantity: number, userId: UserId, transdate?: string, combinationValues?: string[], combinationShape?: [string, string][]): void
dispatchStockFromLocation(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, locationName: LocationName, quantity: number, userId: UserId, transdate?: string): void
transferStock(business: BusinessName, ledger: LedgerName, itemName: ItemName, fromLocationName: LocationName, toLocationName: LocationName, quantity: number, reference: string, userId = 1, transdate?: string, combinationShape?: [string, string][], combinationValuesAfterLocation?: string[]): void
getBelowReorderStock(): BelowReorderRow[]
setItemSourceLeadTime(itemName: ItemName, vendorName: VendorName, days: number, userId: UserId): void
getItemLeadTimes(itemName: ItemName): 
getStockOutRiskReport(windowDays: number = 2): StockOutRiskRow[]
createStockTake(locationName: LocationName, takeDate: string, userId: UserId): number
getStockTake(id: number): StockTake | undefined
recordStockTakeCount(stockTakeId: number, itemName: ItemName, countedQuantity: number): void
completeStockTake(stockTakeId: number, business: BusinessName, ledger: LedgerName, varianceExpenseAccount: AccountName, /** @deprecated No longer used — each line now resolves its own, * real, per-product Inventory account directly, the same, real, * structural fix already applied to Purchases and Sales/COGS.
   * Kept only so existing callers (the real, live Stock Take UI, the
   * simulation) don't need a breaking API change to keep working. */
  inventoryAccount: string, unitCostMinorByItem: Record<string, number>, userId: UserId): void
writeOffStock(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, quantity: number, unitCostMinor: number, writeOffExpenseAccount: AccountName, /** @deprecated No longer used — resolves to that same, real
   * product's own, real Inventory sub-account directly. Kept only so
   * existing callers don't need a breaking API change. */
  inventoryAccount: string, reason: string, userId: UserId, transdate?: string, locationName?: LocationName): void
receiveLot(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, lotNumber: string, receivedDate: string, expirationDate: string | null, quantity: number, userId: UserId, costBasisMinor?: number): void
consumeFromLots(itemName: ItemName, quantity: number): 
getExpiringStock(asOfDate: string, withinDays: number): ExpiringLot[]
createSystemEntity(name: string, parentId: number | null): number
placeOrder(orderReference: string, business: BusinessName, ledger: LedgerName, quantity: number, priceMinor: number, userId: UserId, transdate?: string, vendor?: VendorName, item?: ItemName, location?: LocationName): void
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
  combination_ids: string | null;
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
  currency: string | null;
  has_quantity_postings: boolean;
}
interface TrialBalanceCurrencySubtotal {
  currency: string | null;
  total_debit_minor: number;
  total_credit_minor: number;
  balanced: boolean;
}
interface TrialBalance {
  rows: TrialBalanceRow[];
  total_debit_minor: number;
  total_credit_minor: number;
  by_currency: TrialBalanceCurrencySubtotal[];
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
resolveItemId(itemName: ItemName): number | undefined
isGenuineCategoryOrItemsRoot(name: string): boolean
createEntity(input: NewEntity, userId: UserId): EntityNode
updateEntity(id: number, input: EntityUpdate, userId: UserId): EntityNode
listLineTypes(): string[]
setLineType(entityName: string, lineType: string | null, userId: UserId): void
getLineType(entityName: string): string | undefined
setItemStorageOrigin(itemName: ItemName, origin: 'Hot' | 'Cold' | null, userId: UserId): void
getItemStorageOrigin(itemName: ItemName): 'Hot' | 'Cold' | undefined
setLanguageDirection(languageName: string, direction: 'LTR' | 'RTL' | null, userId: UserId): void
getLanguageDirection(languageName: string): 'LTR' | 'RTL' | undefined
reorderSiblings(entityId: EntityId, direction: 'up' | 'down', userId: UserId): void
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
getPickingList(invoiceId: number, locationName: LocationName): PickingListLine[]
confirmPickedLine(invoiceId: number, invoiceLineId: number, business: BusinessName, ledger: LedgerName, userId: UserId): void
dispatchOrderFromPickingList(invoiceId: number, locationName: LocationName, revenueAccount: string, taxAccount: string, userId: UserId): void
getRestockPickingList(runReference: string, warehouseName: LocationName, lines: RestockLineInput[]): PickingListLine[]
confirmRestockPickedLine(runReference: string, itemName: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
dispatchRestockFromPickingList(runReference: string, business: BusinessName, ledger: LedgerName, warehouseName: LocationName, retailOutletName: LocationName, lines: RestockLineInput[], userId: UserId, transdate?: string): void
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
isDescendantOf(entityName: string, rootName: string): boolean
getHierarchyChain(leafName: ItemName | LocationName): HierarchyChainNode[]
getAncestorChain(entityName: string, rootName: string): string[]
ensureCategoryChain(rootName: string, prefix: string, chain: string[], userId: UserId): 
ensureProductSalesCogsAccounts(itemName: ItemName, userId: UserId, tier?: string): 
ensureProductInventoryAccount(itemName: ItemName, userId: UserId): 
ensureProductLocationInventoryAccount(itemName: ItemName, locationName: LocationName, userId: UserId): 
ensureHierarchyGrouping(businessName: BusinessName, groupingName: string, userId: UserId): 
ensureHierarchyValue(businessName: BusinessName, groupingName: string, valueName: string, userId: UserId): 
defineProductShape(businessName: BusinessName, dimensions: [string, string][], userId: UserId): 
ensureProductInstance(businessName: BusinessName, definitionDimensions: [string, string][], values: string[], userId: UserId): 
getCombinationDisplayName(entityId: number): string
climbInstanceTree(instanceId: number): 
getCombinationByUpc(upc: string): 
ensureCombinationAccountLeaf(baseAccountName: string, instanceTopNode: { id: number; name: string }, userId: UserId): 
getBusinessHierarchy(businessName: BusinessName): HierarchyGroupingWithValues[]
getBusinessProductShapes(businessName: BusinessName): [string, string][][]
getProductUnitCostMinor(itemName: ItemName): number | null
ensureProductTierItem(baseProductName: ItemName, tier: string, userId: UserId): 
ensureProductTierLocationLeaf(tierItemName: string, locationName: LocationName, userId: UserId, tierItemId?: number): 
ensureProductLocationLeaf(itemName: ItemName, locationName: LocationName, userId: UserId): 
getLocationForAccount(accountName: AccountName): string | undefined
getDivisionForAccount(accountName: AccountName): string | undefined
getQualifiedDisplayName(entityId: number): string
ensureProductQuantityAccounts(itemName: ItemName, userId: UserId): 
cityDivisionFor(locationName: string): string | undefined
resolveDispatchLocation(itemName: ItemName, logicalLocationName: LocationName): LocationName
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
getPrototypeOf(entityName: string): string | undefined
setPrototype(entityName: string, prototypeName: string, userId: UserId): void
seedDefaultHierarchyPrototypes(business: TypedNode<'BusinessName'>, userId: UserId): void
setEntityLink(entityName: string, linkType: string, targetName: string, userId: UserId, entityId?: number, targetId?: number): string
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
setDimensionParent(entityName: string, dimensionName: string, parentName: string, userId: UserId, entityId?: number, targetId?: number): void
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
getItemPriceForCurrency(itemName: string, currency: string | null, productInstanceId?: number): number | null
ensureCurrencyPair(businessName: BusinessName, fromCurrency: string, toCurrency: string, userId: UserId): 
setCurrencyExchangeRate(businessName: BusinessName, fromCurrency: string, toCurrency: string, userId: UserId, buyRateMinor?: number, sellRateMinor?: number): void
getCurrencyExchangeRate(businessName: BusinessName, fromCurrency: string, toCurrency: string, side: 'buy' | 'sell'): number | null
listCurrencyPairs(currencies: string[]): 
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
  relationId?: number;
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
  combinationValues?: string[];
  combinationShape?: [string, string][];
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
interface HierarchyChainNode {
  readonly id: EntityId;
  readonly name: string;
}
interface HierarchyGroupingWithValues {
  grouping: string;
  values: string[];
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
  productInstanceId?: number;
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
- `typeBusinessName`
- `typeEmployeeName`
- `typeVendorName`
- `typeCustomerName`
- `typeCategoryOrItemsRootName`
- `typeItemName`
- `typeRootName`
- `typeLedgerName`
- `typeBusinessLocationsRootName`
- `typeBusinessItemsRootName`
- `typeBusinessContactsRootName`
- `typeLineTypeMarkerName`
- `typeStorageOriginMarkerName`
- `typeTextDirectionMarkerName`
- `typeVocabularyWordName`
- `typeRelationshipRecordName`
- `typeOpenHoursRecordName`
- `typeScheduleRecordName`
- `typeEntityLinkRecordName`
- `typeProjectTaskName`
- `typeMenuOverrideName`
- `typeHiddenMarkerName`
- `typeTranslationConceptName`
- `typeEquityAccountName`
- `typeAssetAccountName`
- `typeChartOfAccountsNodeName`
- `typeChartOfAccountsRootName`
- `typeLocationTypeMarkerName`
- `typeIsBillingAddressMarkerName`
- `typeLocationEntityName`
- `typeExpenseCategoryName`
- `typeMenuSectionName`
- `typeMenuLinkName`
- `typeMenuLinkFlagName`
- `typeBusinessTypeName`
- `typeBusinessTypeQuestionsRootName`
- `typeBusinessTypeQuestionName`
- `typeDivisionName`

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
type MatrixAxis = 'Product' | 'Category' | 'Location' | 'Division' | 'Consolidated' | (string & {});
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
interface HierarchyGroupingWithValues {
  grouping: string;
  values: string[];
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
  combinationValues?: string[];
  combinationShape?: [string, string][];
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
  unitPriceMinor?: number;
  taxMinor: number;
  tier?: string;
  combinationValues?: string[];
  combinationShape?: [string, string][];
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
- `getHierarchy`
- `getProductShapes`
- `createHierarchyGrouping`
- `createHierarchyValue`
- `defineProductShape`
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

- `backend/src/db.ts`: TypedNode<TParentBrand>; string; productName ?? 'Items'; 'Vendors'; // 'Equity'
- `backend/src/primitives.ts`: string | number; string
- `frontend/src/lib/api.ts`: string | null

### Real `relation:` usages (lateral — "this entity refers to / is a translation of that one")

- `backend/src/db-stock.ts`: location.location_type; 'Billing Address'; vendor; item
- `backend/src/db.ts`: targetName; recordName; h.day; s.day; type; prototypeName; targetName; languageName; // conceptName; coaFamily; child.name; coaFamily; coaFamily
- `backend/src/db-seed.ts`: 'COGS'; section.label; link.label
- `backend/src/primitives.ts`: target

## Reference Index

Generated directly by `scripts/source-reference.ts` (run via `make source-reference`). For each real, exported type and function across the files this reference covers, this script scans every one of those same, real files for a genuine, textual reference to that exact name, excluding the file that defines it, to build the real "Referenced in" list below - a real, direct, confirmed fact about which files mention the name, never a claim about actual runtime call order or invocation count (see the real Call Graph Summary above for that).

### Types (249, alphabetical)

#### `AccountName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `frontend/src/lib/api.ts`

```ts
type AccountName = string & { readonly __brand: 'AccountName' };
```

#### `AccountName`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db.ts`

```ts
type AccountName = string & { readonly __brand: 'AccountName' };
```

#### `AgedInvoiceRow`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
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
```

#### `AgedRow`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
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
```

#### `AgedSummaryRow`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface AgedSummaryRow {
  counterparty: string;
  outstanding_minor: number;
  oldest_days_overdue: number;
}
```

#### `AgedSummaryRow`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface AgedSummaryRow {
  counterparty: string;
  outstanding_minor: number;
  oldest_days_overdue: number;
}
```

#### `AgingBucket`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface AgingBucket {
  label: string;
  through_days: number;
}
```

#### `ApPaymentInput`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface ApPaymentInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  vendor: VendorName;
  amount_minor: number;
  transdate?: string;
  description?: string;
}
```

#### `ApPurchaseInput`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
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
```

#### `ArApBaseInput`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
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
```

#### `ArReceiptInput`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface ArReceiptInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  customer: CustomerName;
  amount_minor: number;
  transdate?: string;
  description?: string;
}
```

#### `ArSaleInput`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
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
```

#### `AuthenticatedUser`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: `backend/src/auth-middleware.ts`

```ts
interface AuthenticatedUser {
  id: number;
  username: string;
  roles: string[];
  page_size: number;
  number_format: string;
  date_format: string;
}
```

#### `AuthState`

- **Defined in**: `frontend/src/lib/auth.ts`
- **Referenced in**: `frontend/src/lib/state.svelte.ts`

```ts
interface AuthState {
  token: string;
  user: AuthUser;
}
```

#### `AuthState`

- **Defined in**: `frontend/src/lib/state.svelte.ts`
- **Referenced in**: `frontend/src/lib/auth.ts`

```ts
interface AuthState {
  token: string;
  user: AuthUser;
}
```

#### `AuthUser`

- **Defined in**: `frontend/src/lib/auth.ts`
- **Referenced in**: `frontend/src/lib/state.svelte.ts`

```ts
interface AuthUser {
  id: number;
  username: string;
  roles: string[];
  page_size: number;
  number_format: string;
  date_format: string;
}
```

#### `AuthUser`

- **Defined in**: `frontend/src/lib/state.svelte.ts`
- **Referenced in**: `frontend/src/lib/auth.ts`

```ts
interface AuthUser {
  id: number;
  username: string;
  roles: string[];
  page_size: number;
  number_format: string;
  date_format: string;
}
```

#### `AxisValues`

- **Defined in**: `backend/src/db-matrix-reports.ts`
- **Referenced in**: `frontend/src/lib/matrix-api.ts`

```ts
interface AxisValues {
  Product: string[];
  Category: string[];
  Location: string[];
  Division: string[];
}
```

#### `AxisValues`

- **Defined in**: `frontend/src/lib/matrix-api.ts`
- **Referenced in**: `backend/src/db-matrix-reports.ts`

```ts
interface AxisValues {
  Product: string[];
  Category: string[];
  Location: string[];
  Division: string[];
}
```

#### `BalanceSheet`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
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
```

#### `BalanceSheet`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-reports.ts`

```ts
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
```

#### `BankAccountRow`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface BankAccountRow {
  name: string;
  accountnumber: string | null;
  balance_minor: number;
  currency: string | null;
  overdraft_limit_minor: number | null;
  scope: string;
}
```

#### `BankAccountRow`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface BankAccountRow {
  name: string;
  accountnumber: string | null;
  balance_minor: number;
  currency: string | null;
  overdraft_limit_minor: number | null;
  scope: string;
}
```

#### `BelowReorderRow`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface BelowReorderRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  reorder_level: number;
  min_level: number | null;
  max_level: number | null;
}
```

#### `BelowReorderRow`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
interface BelowReorderRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  reorder_level: number;
  min_level: number | null;
  max_level: number | null;
}
```

#### `BomComponent`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
type BomComponent = { component: string;
```

#### `BusinessName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-reports.ts`, `backend/src/db-matrix-reports.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts`

```ts
type BusinessName = string & { readonly __brand: 'BusinessName' };
```

#### `BusinessName`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-reports.ts`, `backend/src/db.ts`, `backend/src/db-matrix-reports.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts`

```ts
type BusinessName = string & { readonly __brand: 'BusinessName' };
```

#### `BusinessTypeInfo`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface BusinessTypeInfo {
  name: string;
  questions: string[];
}
```

#### `CashFlowForecast`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
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
```

#### `CashFlowForecast`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
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
```

#### `CashPositionByCurrency`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface CashPositionByCurrency {
  currency: string | null;
  total_balance_minor: number;
  total_overdraft_limit_minor: number | null;
  headroom_minor: number | null;
}
```

#### `CashPositionByCurrency`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface CashPositionByCurrency {
  currency: string | null;
  total_balance_minor: number;
  total_overdraft_limit_minor: number | null;
  headroom_minor: number | null;
}
```

#### `CashPurchaseInput`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
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
```

#### `CashPurchaseLineInput`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface CashPurchaseLineInput {
  itemName: string;
  quantity: number;
  unitPriceMinor: number;
  taxMinor: number;
}
```

#### `CashPurchaseLineInput`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface CashPurchaseLineInput {
  itemName: ItemName;
  quantity: number;
  unitPriceMinor: number;
  taxMinor: number;
}
```

#### `CashPurchaseResult`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface CashPurchaseResult {
  invoiceId: number;
  reference: string;
  totalMinor: number;
}
```

#### `CashPurchaseResult`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface CashPurchaseResult {
  invoiceId: number;
  reference: string;
  totalMinor: number;
}
```

#### `CategoryTreeNode`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface CategoryTreeNode {
  name: string;
  accountnumber: string | null;
  is_leaf: boolean;
  debit_minor: number;
  credit_minor: number;
  is_contra: boolean;
  children: CategoryTreeNode[];
}
```

#### `CategoryTreeNode`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-reports.ts`

```ts
interface CategoryTreeNode {
  name: string;
  accountnumber: string | null;
  is_leaf: boolean;
  debit_minor: number;
  credit_minor: number;
  is_contra: boolean;
  children: CategoryTreeNode[];
}
```

#### `ChartRow`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface ChartRow {
  id: number;
  name: string;
  depth: number;
  path: string;
  accountnumber: string | null;
  balance_minor: number | null;
}
```

#### `ChartRow`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-reports.ts`

```ts
interface ChartRow {
  id: number;
  name: string;
  depth: number;
  path: string;
  accountnumber: string | null;
  balance_minor: number | null;
}
```

#### `CloseBooksLine`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface CloseBooksLine {
  account: string;
  accountId?: number;
  amount_minor: number;
  division?: string;
}
```

#### `CloseBooksPreview`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface CloseBooksPreview {
  lines: CloseBooksLine[];
  netIncomeMinor: number;
  accountsZeroed: number;
  divisionBreakdown: { division: string | null; netIncomeMinor: number }[];
}
```

#### `CloseBooksPreview`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-reports.ts`

```ts
interface CloseBooksPreview {
  lines: { account: AccountName; amount_minor: number; division?: string }[];
  netIncomeMinor: number;
  accountsZeroed: number;
  divisionBreakdown: { division: DivisionName | null; netIncomeMinor: number }[];
}
```

#### `CloseBooksResult`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface CloseBooksResult {
  reference: string;
  netIncomeMinor: number;
  accountsZeroed: number;
  divisionBreakdown: { division: string | null; netIncomeMinor: number }[];
}
```

#### `CloseBooksResult`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-reports.ts`

```ts
interface CloseBooksResult {
  reference: string;
  netIncomeMinor: number;
  accountsZeroed: number;
  divisionBreakdown: { division: DivisionName | null; netIncomeMinor: number }[];
}
```

#### `ConceptWithAlternates`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface ConceptWithAlternates {
  headerAccountName: string;
  alternates: string[];
  defaultAlternate: string;
}
```

#### `ConceptWithAlternates`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface ConceptWithAlternates {
  headerAccountName: string;
  alternates: string[];
  defaultAlternate: string;
}
```

#### `Contact`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-seed.ts`, `frontend/src/lib/api.ts`

```ts
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
```

#### `Contact`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db.ts`, `backend/src/db-seed.ts`

```ts
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
```

#### `ContactPerson`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface ContactPerson {
  contact_type: string;
  record_name: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}
```

#### `ContactPerson`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface ContactPerson {
  contact_type: string;
  record_name: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}
```

#### `CreditStatus`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface CreditStatus {
  balanceMinor: number;
  limitMinor: number | null;
  overLimit: boolean;
  remainingMinor: number | null;
}
```

#### `CreditStatus`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface CreditStatus {
  balanceMinor: number;
  limitMinor: number | null;
  overLimit: boolean;
  remainingMinor: number | null;
}
```

#### `CustomerName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
type CustomerName = string & { readonly __brand: 'CustomerName' };
```

#### `CustomerName`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
type CustomerName = string & { readonly __brand: 'CustomerName' };
```

#### `CustomerRegistrationInput`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
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
```

#### `CustomerRegistrationInput`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
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
```

#### `CustomerStatement`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface CustomerStatement {
  customer: string;
  as_of_date: string;
  lines: StatementLine[];
  total_outstanding_minor: number;
}
```

#### `CustomerStatement`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface CustomerStatement {
  customer: string;
  as_of_date: string;
  lines: StatementLine[];
  total_outstanding_minor: number;
}
```

#### `DemoCategory`

- **Defined in**: `shared-fixtures/wine-retail-demo-data.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface DemoCategory {
  category: string;
  subcategory: string;
}
```

#### `DemoLocation`

- **Defined in**: `shared-fixtures/wine-retail-demo-data.ts`
- **Referenced in**: (no other real, core file references this directly)

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
```

#### `DemoProduct`

- **Defined in**: `shared-fixtures/wine-retail-demo-data.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface DemoProduct {
  name: string;
  subcategory: string;
}
```

#### `DemoStockLevel`

- **Defined in**: `shared-fixtures/wine-retail-demo-data.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
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

#### `DemoUpc`

- **Defined in**: `shared-fixtures/wine-retail-demo-data.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface DemoUpc {
  name: string;
  upc: string;
}
```

#### `DimensionLinkPointingAt`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface DimensionLinkPointingAt {
  entityName: string;
  dimensionName: string;
}
```

#### `DivisionName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
type DivisionName = string & { readonly __brand: 'DivisionName' };
```

#### `DivisionName`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
type DivisionName = string & { readonly __brand: 'DivisionName' };
```

#### `DivisionRecord`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface DivisionRecord {
  id: number;
  name: string;
  parentName: string | null;
  centerType: string | null;
}
```

#### `EInvoiceDiscrepancy`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface EInvoiceDiscrepancy {
  field: string;
  poValue: string;
  invoiceValue: string;
}
```

#### `EInvoiceDiscrepancy`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface EInvoiceDiscrepancy {
  field: string;
  poValue: string;
  invoiceValue: string;
}
```

#### `EmployeeClock`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface EmployeeClock {
  employee: string;
  po_reference: string;
  project_expense_account: string;
  clocked_in_at: string;
}
```

#### `EmployeeClock`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface EmployeeClock {
  employee: string;
  po_reference: string;
  project_expense_account: string;
  clocked_in_at: string;
}
```

#### `EmployeeName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
type EmployeeName = string & { readonly __brand: 'EmployeeName' };
```

#### `EmployeeName`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
type EmployeeName = string & { readonly __brand: 'EmployeeName' };
```

#### `EntityHistoryRow`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface EntityHistoryRow {
  name: string;
  parent_id: number | null;
  relation_id: number | null;
  created_at: string;
  created_by: number;
  deleted_at: string | null;
  deleted_by: number | null;
}
```

#### `EntityId`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
type EntityId = number & { readonly __brand: 'EntityId' };
```

#### `EntityNode`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/primitives.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/entityTree.ts`, `frontend/src/lib/treeAdapter.ts`

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
```

#### `EntityNode`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`, `backend/src/primitives.ts`, `frontend/src/lib/entityTree.ts`, `frontend/src/lib/treeAdapter.ts`

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
```

#### `EntityStructure`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
type EntityStructure = 'sole_trader' | 'partnership' | 'llc' | 'unlimited_liability' | 'publicly_traded';
```

#### `EntityUpdate`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface EntityUpdate {
  name?: string;
  parent?: string | null;
  relation?: string | null;
  relationId?: number;
  accountnumber?: string | null;
}
```

#### `ExpiringLot`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface ExpiringLot {
  item: string;
  lot_number: string;
  expiration_date: string;
  quantity_on_hand: number;
  days_until_expiration: number;
}
```

#### `ExpiringLot`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
interface ExpiringLot {
  item: string;
  lot_number: string;
  expiration_date: string;
  quantity_on_hand: number;
  days_until_expiration: number;
}
```

#### `ForecastLine`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface ForecastLine {
  date: string;
  description: string;
  amount_minor: number; // positive = real, anticipated cash in; negative = real, anticipated cash out
  source: 'AR' | 'AP' | 'recurring';
}
```

#### `ForecastLine`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface ForecastLine {
  date: string;
  description: string;
  amount_minor: number;
  source: 'AR' | 'AP' | 'recurring';
}
```

#### `HierarchyChainNode`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface HierarchyChainNode {
  readonly id: EntityId;
  readonly name: string;
}
```

#### `HierarchyGroupingWithValues`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface HierarchyGroupingWithValues {
  grouping: string;
  values: string[];
}
```

#### `HierarchyGroupingWithValues`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface HierarchyGroupingWithValues {
  grouping: string;
  values: string[];
}
```

#### `HierarchyNode`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface HierarchyNode {
  id: number;
  name: string;
  children: HierarchyNode[];
}
```

#### `HierarchyTreeNode`

- **Defined in**: `backend/src/primitives.ts`
- **Referenced in**: `backend/src/db-reports.ts`

```ts
interface HierarchyTreeNode {
  name: string;
  accountId: number | null;
  own: Record<string, number>;
  total: Record<string, number>;
  children: HierarchyTreeNode[];
}
```

#### `HistoryLine`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface HistoryLine {
  invoice_reference: string;
  invoice_date: string;
  document_type: 'invoice' | 'credit_note' | 'debit_memo';
  description: string;
  quantity: number | null;
  unit_price_minor: number | null;
  amount_minor: number;
}
```

#### `HistoryLine`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface HistoryLine {
  invoice_reference: string;
  invoice_date: string;
  document_type: 'invoice' | 'credit_note' | 'debit_memo';
  description: string;
  quantity: number | null;
  unit_price_minor: number | null;
  amount_minor: number;
}
```

#### `ImportEInvoiceResult`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface ImportEInvoiceResult {
  invoiceId: number;
  discrepancies: EInvoiceDiscrepancy[];
}
```

#### `Invoice`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/invoice.ts`, `backend/src/db-seed.ts`, `frontend/src/lib/api.ts`

```ts
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
```

#### `Invoice`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`, `backend/src/invoice.ts`, `backend/src/db-seed.ts`

```ts
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
```

#### `InvoiceInput`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
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
```

#### `InvoiceInput`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
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
```

#### `InvoiceLine`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/invoice.ts`, `frontend/src/lib/api.ts`

```ts
interface InvoiceLine {
  reference: string;
  description: string;
  quantity: number | null;
  unit_price_minor: number | null;
  amount_minor: number;
  tax_minor: number;
}
```

#### `InvoiceLine`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`, `backend/src/invoice.ts`

```ts
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
```

#### `InvoiceLineInput`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface InvoiceLineInput {
  description: string;
  quantity?: number | null;
  unitPriceMinor?: number | null;
  amountMinor: number;
  taxMinor?: number;
  itemName?: string | null;
  dispatchReference?: string | null;
}
```

#### `InvoiceOptions`

- **Defined in**: `backend/src/invoice.ts`
- **Referenced in**: (no other real, core file references this directly)

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

#### `Item`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/entityTree.ts`

```ts
interface Item {
  description: string | null;
  unit_of_measure: string | null;
  upc: string | null;
  retail_price_minor: number | null;
}
```

#### `Item`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`, `backend/src/db-seed.ts`, `frontend/src/lib/entityTree.ts`

```ts
interface Item {
  description: string | null;
  unit_of_measure: string | null;
  upc: string | null;
}
```

#### `ItemLocationLevels`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface ItemLocationLevels {
  quantity_on_hand: number;
  min_level: number | null;
  max_level: number | null;
  reorder_level: number | null;
  shelf_side: string | null;
  rack: string | null;
  level: number | null;
}
```

#### `ItemLocationLevels`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
interface ItemLocationLevels {
  quantity_on_hand: number;
  min_level: number | null;
  max_level: number | null;
  reorder_level: number | null;
  shelf_side: string | null;
  rack: string | null;
  level: number | null;
}
```

#### `ItemName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `frontend/src/lib/api.ts`

```ts
type ItemName = string & { readonly __brand: 'ItemName' };
```

#### `ItemName`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db.ts`

```ts
type ItemName = string & { readonly __brand: 'ItemName' };
```

#### `ItemSource`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
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
```

#### `ItemSource`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
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
```

#### `ItemSourceInput`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
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
  productInstanceId?: number;
}
```

#### `ItemSourceInput`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
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
```

#### `ItemSummary`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
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
```

#### `ItemSummary`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface ItemSummary {
  name: string;
  description: string | null;
  unit_of_measure: string | null;
  upc: string | null;
  retail_price_minor: number | null;
  source_count: number;
  storage_origin: 'Hot' | 'Cold' | null;
  product: string | null;
  combinationValues?: string[];
  combinationShape?: [string, string][];
}
```

#### `JournalSummary`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
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
```

#### `JournalSummary`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
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
```

#### `LedgerDateRange`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface LedgerDateRange {
  earliest: string | null;
  latest: string | null;
}
```

#### `LedgerDateRange`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface LedgerDateRange {
  earliest: string | null;
  latest: string | null;
}
```

#### `LedgerName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-reports.ts`, `backend/src/db-matrix-reports.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts`

```ts
type LedgerName = string & { readonly __brand: 'LedgerName' };
```

#### `LedgerName`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-reports.ts`, `backend/src/db.ts`, `backend/src/db-matrix-reports.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts`

```ts
type LedgerName = string & { readonly __brand: 'LedgerName' };
```

#### `ListInvoicesOptions`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface ListInvoicesOptions {
  invoiceType?: 'AR' | 'AP';
  source?: 'manual' | 'pos' | 'all';
  limit?: number;
  offset?: number;
}
```

#### `Location`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/db-reports.ts`, `backend/src/db.ts`, `backend/src/db-matrix-reports.ts`, `backend/src/db-seed.ts`, `frontend/src/lib/matrix-api.ts`

```ts
interface Location {
  city: string;
  location_type: string;
  is_billing_address: boolean;
  bottle_capacity: number | null;
  carton_capacity: number | null;
  timezone: string;
}
```

#### `LocationCapacityStatus`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface LocationCapacityStatus {
  bottleQuantity: number;
  bottleCapacity: number | null;
  bottleOverCapacity: boolean;
  cartonQuantity: number;
  cartonCapacity: number | null;
  cartonOverCapacity: boolean;
}
```

#### `LocationCapacityStatus`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
interface LocationCapacityStatus {
  bottleQuantity: number;
  bottleCapacity: number | null;
  bottleOverCapacity: boolean;
  cartonQuantity: number;
  cartonCapacity: number | null;
  cartonOverCapacity: boolean;
}
```

#### `LocationInput`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface LocationInput {
  city: string;
  location_type: string;
  is_billing_address: boolean;
  bottle_capacity?: number | null;
  carton_capacity?: number | null;
  timezone: string;
}
```

#### `LocationName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-matrix-reports.ts`, `frontend/src/lib/api.ts`

```ts
type LocationName = string & { readonly __brand: 'LocationName' };
```

#### `LocationName`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db.ts`, `backend/src/db-matrix-reports.ts`

```ts
type LocationName = string & { readonly __brand: 'LocationName' };
```

#### `LoginResponse`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface LoginResponse {
  token: string;
  user: { id: number; username: string; roles: string[]; page_size: number; number_format: string; date_format: string };
}
```

#### `MatrixAxis`

- **Defined in**: `backend/src/db-matrix-reports.ts`
- **Referenced in**: `frontend/src/lib/matrix-api.ts`

```ts
type MatrixAxis = 'Product' | 'Category' | 'Location' | 'Division' | 'Consolidated' | (string & {});
```

#### `MatrixAxis`

- **Defined in**: `frontend/src/lib/matrix-api.ts`
- **Referenced in**: `backend/src/db-matrix-reports.ts`

```ts
type MatrixAxis = 'Product' | 'Category' | 'Location' | 'Division' | 'Consolidated';
```

#### `MatrixCell`

- **Defined in**: `backend/src/db-matrix-reports.ts`
- **Referenced in**: `frontend/src/lib/matrix-api.ts`

```ts
interface MatrixCell {
  rowKey: string;
  colKey: string;
  salesMinor: number;
  cogsMinor: number;
}
```

#### `MatrixCell`

- **Defined in**: `frontend/src/lib/matrix-api.ts`
- **Referenced in**: `backend/src/db-matrix-reports.ts`

```ts
interface MatrixCell {
  rowKey: string;
  colKey: string;
  salesMinor: number;
  cogsMinor: number;
}
```

#### `MenuLinkRow`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface MenuLinkRow {
  key: string;
  href: string;
  label: string;
  notImplemented: boolean;
  isSubheading: boolean;
  requiredRoles: string[] | null;
  hidden: boolean;
}
```

#### `MenuLinkRow`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface MenuLinkRow {
  key: string;
  href: string;
  label: string;
  notImplemented: boolean;
  isSubheading: boolean;
  requiredRoles: string[] | null;
}
```

#### `MenuSectionRow`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`, `frontend/src/lib/state.svelte.ts`

```ts
interface MenuSectionRow {
  key: string;
  label: string;
  hidden: boolean;
  links: MenuLinkRow[];
}
```

#### `MenuSectionRow`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`, `frontend/src/lib/state.svelte.ts`

```ts
interface MenuSectionRow {
  key: string;
  label: string;
  links: MenuLinkRow[];
}
```

#### `NewEntity`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface NewEntity {
  name: string;
  parent?: string | null;
  parentId?: number | null;
  relation?: string | null;
  accountnumber?: string | null;
}
```

#### `OpenHoursLine`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface OpenHoursLine {
  day: string;
  opens_at: string;
  closes_at: string;
}
```

#### `OpenHoursLine`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface OpenHoursLine {
  day: string;
  opens_at: string;
  closes_at: string;
}
```

#### `OrganizationChart`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface OrganizationChart {
  business: string;
  companyWideEmployees: string[]; // "Place of Employment" points straight at the business itself
  divisions: OrgChartDivision[];
}
```

#### `OrganizationChart`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface OrganizationChart {
  business: BusinessName;
  companyWideEmployees: string[];
  divisions: { division: DivisionName; locations: { location: string; employees: string[] }[] }[];
}
```

#### `OrgChartDivision`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface OrgChartDivision {
  division: string;
  locations: { location: string; employees: string[] }[];
}
```

#### `PayEmployeeWagesInput`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface PayEmployeeWagesInput {
  business: string;
  ledger: string;
  employeeName: string;
  hours?: number;
  wagesExpenseAccount?: string;
  paymentMethod?: string;
  transdate?: string;
}
```

#### `PayEmployeeWagesResult`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface PayEmployeeWagesResult {
  invoiceId: number;
  reference: string;
  grossMinor: number;
  medicareLevyMinor: number;
  superannuationMinor: number;
  netMinor: number;
}
```

#### `PayWagesResult`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface PayWagesResult {
  invoiceId: number;
  reference: string;
  grossMinor: number;
  medicareLevyMinor: number;
  superannuationMinor: number;
  netMinor: number;
}
```

#### `PendingCustomer`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface PendingCustomer {
  name: string;
  email: string | null;
  phone: string | null;
  card_label: string | null;
}
```

#### `PendingCustomer`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface PendingCustomer {
  name: string;
  email: string | null;
  phone: string | null;
  card_label: string | null;
}
```

#### `PeriodLockStatus`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface PeriodLockStatus {
  locked_through_date: string | null;
  changed_by: number | null;
  changed_at: string | null;
}
```

#### `PeriodLockStatus`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface PeriodLockStatus {
  locked_through_date: string | null;
  changed_by: number | null;
  changed_at: string | null;
}
```

#### `PickingListLine`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface PickingListLine {
  invoiceLineId: number;
  item: string;
  quantity: number;
  shelfSide: string | null;
  rack: string | null;
  level: number | null;
  picked: boolean;
}
```

#### `PickingListLine`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface PickingListLine {
  invoiceLineId: number;
  item: string;
  quantity: number;
  shelfSide: string | null;
  rack: string | null;
  level: number | null;
  picked: boolean;
}
```

#### `PosSaleInput`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
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
```

#### `PosSaleLineInput`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface PosSaleLineInput {
  itemName: string;
  quantity: number;
  unitPriceMinor?: number;
  taxMinor: number;
  tier?: string;
  combinationValues?: string[];
  combinationShape?: [string, string][];
}
```

#### `PosSaleLineInput`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface PosSaleLineInput {
  itemName: ItemName;
  quantity: number;
  unitPriceMinor?: number;
  taxMinor: number;
  tier?: string;
  combinationValues?: string[];
  combinationShape?: [string, string][];
}
```

#### `PosSaleResult`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface PosSaleResult {
  invoiceId: number;
  reference: string;
  totalMinor: number;
  changeDueMinor: number;
}
```

#### `PosSaleResult`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface PosSaleResult {
  invoiceId: number;
  reference: string;
  totalMinor: number;
  changeDueMinor: number;
}
```

#### `PosShift`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface PosShift {
  id: number;
  employee: string;
  location: string;
  signed_on_at: string;
  signed_off_at: string | null;
}
```

#### `ProductSummary`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface ProductSummary {
  name: string;
  itemCount: number;
}
```

#### `ProductSummary`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface ProductSummary {
  name: string;
  itemCount: number;
}
```

#### `ProfitAndLoss`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `backend/src/db-matrix-reports.ts`, `frontend/src/lib/matrix-api.ts`, `frontend/src/lib/api.ts`

```ts
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
```

#### `ProfitAndLoss`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-reports.ts`, `backend/src/db-matrix-reports.ts`, `frontend/src/lib/matrix-api.ts`

```ts
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
```

#### `ProfitAndLossByAxisNode`

- **Defined in**: `backend/src/db-matrix-reports.ts`
- **Referenced in**: `frontend/src/lib/matrix-api.ts`

```ts
interface ProfitAndLossByAxisNode {
  key: string;
  profitAndLoss: ProfitAndLoss;
  children: ProfitAndLossByAxisNode[];
}
```

#### `ProfitAndLossByAxisNode`

- **Defined in**: `frontend/src/lib/matrix-api.ts`
- **Referenced in**: `backend/src/db-matrix-reports.ts`

```ts
interface ProfitAndLossByAxisNode {
  key: string;
  profitAndLoss: ProfitAndLoss;
  children: ProfitAndLossByAxisNode[];
}
```

#### `ProfitAndLossByDivision`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface ProfitAndLossByDivision {
  division: string | null;
  profitAndLoss: ProfitAndLoss;
}
```

#### `ProfitAndLossByDivision`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-reports.ts`

```ts
interface ProfitAndLossByDivision {
  division: DivisionName | null;
  profitAndLoss: ProfitAndLoss;
}
```

#### `ProfitAndLossComparison`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
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
```

#### `ProfitAndLossComparison`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-reports.ts`

```ts
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
```

#### `ProfitAndLossComparisonLine`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface ProfitAndLossComparisonLine {
  name: string;
  accountnumber: string | null;
  a_minor: number;
  b_minor: number;
  variance_minor: number;
}
```

#### `ProfitAndLossComparisonLine`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-reports.ts`

```ts
interface ProfitAndLossComparisonLine {
  name: string;
  accountnumber: string | null;
  a_minor: number;
  b_minor: number;
  variance_minor: number;
}
```

#### `PurchaseOrderInput`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
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
```

#### `PurchaseOrderInput`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
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
```

#### `Recurrence`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `shared-fixtures/add-journal-translations.ts`, `backend/src/db-seed.ts`

```ts
type Recurrence = 'once' | 'weekly' | 'monthly' | 'yearly';
```

#### `RecurringJournalLine`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface RecurringJournalLine {
  account: string;
  amount_minor: number; // positive = debit, negative = credit
  memo?: string;
  effective_date?: string; // defaults to the journal's own start date if omitted
}
```

#### `RecurringJournalLine`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface RecurringJournalLine {
  account: AccountName;
  amount_minor: number;
  memo?: string;
  effective_date?: string;
}
```

#### `Relationship`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface Relationship {
  type: string;
  target: string;
}
```

#### `ReminderCandidate`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface ReminderCandidate {
  counterparty: string;
  current_level: number;
  next_level: number;
  outstanding_minor: number;
  oldest_days_overdue: number;
}
```

#### `ReminderCandidate`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface ReminderCandidate {
  counterparty: string;
  current_level: number;
  next_level: number;
  outstanding_minor: number;
  oldest_days_overdue: number;
}
```

#### `ReportRow`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface ReportRow {
  report: string;
  category: string;
  account: string;
  account_id: number;
  depth: number;
  combination_ids: string | null;
  accountnumber: string | null;
  balance_minor: number | null;
}
```

#### `ReportRow`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-reports.ts`

```ts
interface ReportRow {
  report: string;
  category: string;
  account: AccountName;
  depth: number;
  accountnumber: string | null;
  balance_minor: number | null;
}
```

#### `RestockLineInput`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface RestockLineInput {
  item: string;
  quantity: number;
}
```

#### `RestockLineInput`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface RestockLineInput {
  item: string;
  quantity: number;
}
```

#### `Row`

- **Defined in**: `frontend/src/lib/journalGrid.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface Row {
  account: string;
  debit: string; // kept as the raw text the person typed, not a number,
  credit: string; // so "12.5" vs "12.50" vs an empty field are distinct
  memo: string;
}
```

#### `RuntimeDatabase`

- **Defined in**: `backend/src/sqlite-runtime.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface RuntimeDatabase {
  exec(sql: string): void;
  prepare(sql: string): RuntimeStatement;
  transaction<T extends (...args: never[]) => unknown>(fn: T): (...args: Parameters<T>) => ReturnType<T>;
  close(): void;
}
```

#### `RuntimeStatement`

- **Defined in**: `backend/src/sqlite-runtime.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface RuntimeStatement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}
```

#### `SalesCategorySummary`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface SalesCategorySummary {
  category: string;
  quantity: number;
  amount_minor: number;
}
```

#### `SalesCategorySummary`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-reports.ts`

```ts
interface SalesCategorySummary {
  category: string;
  quantity: number;
  amount_minor: number;
}
```

#### `SalesCogsMatrix`

- **Defined in**: `backend/src/db-matrix-reports.ts`
- **Referenced in**: `frontend/src/lib/matrix-api.ts`

```ts
interface SalesCogsMatrix {
  rowAxis: MatrixAxis;
  colAxis: MatrixAxis;
  cells: MatrixCell[];
  totalSalesMinor: number;
  totalCogsMinor: number;
}
```

#### `SalesCogsMatrix`

- **Defined in**: `frontend/src/lib/matrix-api.ts`
- **Referenced in**: `backend/src/db-matrix-reports.ts`

```ts
interface SalesCogsMatrix {
  rowAxis: MatrixAxis;
  colAxis: MatrixAxis;
  cells: MatrixCell[];
  totalSalesMinor: number;
  totalCogsMinor: number;
}
```

#### `SalesOrderInput`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
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
```

#### `SalesOrderInput`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
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
```

#### `SalesReport`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface SalesReport {
  detailed: SalesReportLine[];
  category_summary: SalesCategorySummary[];
  total_quantity: number;
  total_amount_minor: number;
}
```

#### `SalesReport`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-reports.ts`

```ts
interface SalesReport {
  detailed: SalesReportLine[];
  category_summary: SalesCategorySummary[];
  total_quantity: number;
  total_amount_minor: number;
}
```

#### `SalesReportLine`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface SalesReportLine {
  invoice_date: string;
  reference: string;
  item_name: string | null;
  description: string;
  quantity: number | null;
  unit_price_minor: number | null;
  amount_minor: number;
}
```

#### `SalesReportLine`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-reports.ts`

```ts
interface SalesReportLine {
  invoice_date: string;
  reference: string;
  item_name: string | null;
  description: string;
  quantity: number | null;
  unit_price_minor: number | null;
  amount_minor: number;
}
```

#### `ScheduleLine`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface ScheduleLine {
  day: string;
  starts_at: string;
  ends_at: string;
}
```

#### `ScheduleLine`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface ScheduleLine {
  day: string;
  starts_at: string;
  ends_at: string;
}
```

#### `SessionContext`

- **Defined in**: `frontend/src/lib/session.ts`
- **Referenced in**: `frontend/src/lib/state.svelte.ts`

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

#### `SessionContext`

- **Defined in**: `frontend/src/lib/state.svelte.ts`
- **Referenced in**: `frontend/src/lib/session.ts`

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

#### `StagedLine`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
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
```

#### `StagedLine`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
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
```

#### `StatementLine`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `backend/src/db.ts`, `frontend/src/lib/api.ts`

```ts
interface StatementLine {
  name: string;
  accountnumber: string | null;
  debit_minor: number;
  credit_minor: number;
  is_contra: boolean;
}
```

#### `StatementLine`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-reports.ts`, `frontend/src/lib/api.ts`

```ts
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
```

#### `StatementLine`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-reports.ts`, `backend/src/db.ts`

```ts
interface StatementLine {
  name: string;
  accountnumber: string | null;
  debit_minor: number;
  credit_minor: number;
  is_contra: boolean;
}
```

#### `StatementLine`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-reports.ts`, `backend/src/db.ts`

```ts
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
```

#### `StockDispatchInput`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
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
```

#### `StockDispatchInput`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
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
```

#### `StockListingLocationGroup`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface StockListingLocationGroup {
  location: string;
  city: string | null;
  division: string | null;
  rows: StockListingRow[];
  total_on_hand: number;
  capacity: LocationCapacityStatus;
}
```

#### `StockListingLocationGroup`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
interface StockListingLocationGroup {
  location: string;
  city: string | null;
  division: DivisionName | null;
  rows: StockListingRow[];
  total_on_hand: number;
  capacity: LocationCapacityStatus;
}
```

#### `StockListingRow`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface StockListingRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  min_level: number | null;
  max_level: number | null;
  reorder_level: number | null;
}
```

#### `StockListingRow`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
interface StockListingRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  min_level: number | null;
  max_level: number | null;
  reorder_level: number | null;
}
```

#### `StockMovementReport`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface StockMovementReport {
  receipts: StockReceiptRow[];
  transfers: StockTransferRow[];
  sales: StockSaleRow[];
}
```

#### `StockMovementReport`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
interface StockMovementReport {
  receipts: StockReceiptRow[];
  transfers: StockTransferRow[];
  sales: StockSaleRow[];
}
```

#### `StockMovementRow`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface StockMovementRow {
  item: string;
  category: string | null;
  quantity: number;
  date: string;
}
```

#### `StockMovementRow`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
interface StockMovementRow {
  item: string;
  category: string | null;
  quantity: number;
  date: string;
}
```

#### `StockOnHandCell`

- **Defined in**: `backend/src/db-matrix-reports.ts`
- **Referenced in**: `frontend/src/lib/matrix-api.ts`

```ts
interface StockOnHandCell {
  rowKey: string;
  colKey: string;
  quantityBottles: number;
  valueAtCostMinor: number;
  lastCostMinor: number | null;
  averageCostMinor: number | null;
  realizableValueMinor: number;
}
```

#### `StockOnHandCell`

- **Defined in**: `frontend/src/lib/matrix-api.ts`
- **Referenced in**: `backend/src/db-matrix-reports.ts`

```ts
interface StockOnHandCell {
  rowKey: string;
  colKey: string;
  quantityBottles: number;
  valueAtCostMinor: number;
  lastCostMinor: number | null;
  averageCostMinor: number | null;
  realizableValueMinor: number;
}
```

#### `StockOnHandMatrix`

- **Defined in**: `backend/src/db-matrix-reports.ts`
- **Referenced in**: `frontend/src/lib/matrix-api.ts`

```ts
interface StockOnHandMatrix {
  rowAxis: MatrixAxis;
  colAxis: MatrixAxis;
  cells: StockOnHandCell[];
  totalValueAtCostMinor: number;
  totalRealizableValueMinor: number;
}
```

#### `StockOnHandMatrix`

- **Defined in**: `frontend/src/lib/matrix-api.ts`
- **Referenced in**: `backend/src/db-matrix-reports.ts`

```ts
interface StockOnHandMatrix {
  rowAxis: MatrixAxis;
  colAxis: MatrixAxis;
  cells: StockOnHandCell[];
  totalValueAtCostMinor: number;
  totalRealizableValueMinor: number;
}
```

#### `StockOutRiskRow`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface StockOutRiskRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  daily_consumption_rate: number;
  days_until_stockout: number | null;
  shortest_lead_time_days: number | null;
  at_risk: boolean;
}
```

#### `StockOutRiskRow`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
interface StockOutRiskRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  daily_consumption_rate: number;
  days_until_stockout: number | null;
  shortest_lead_time_days: number | null;
  at_risk: boolean;
}
```

#### `StockReceiptInput`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
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
```

#### `StockReceiptInput`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
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
```

#### `StockTake`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface StockTake {
  id: number;
  location: string;
  take_date: string;
  status: 'draft' | 'completed';
  lines: StockTakeLine[];
}
```

#### `StockTake`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
interface StockTake {
  id: number;
  location: string;
  take_date: string;
  status: 'draft' | 'completed';
  lines: StockTakeLine[];
}
```

#### `StockTakeLine`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface StockTakeLine {
  id: number;
  item: string;
  shelf_side: string | null;
  rack: string | null;
  level: number | null;
  expected_quantity: number;
  counted_quantity: number | null;
}
```

#### `StockTakeLine`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
interface StockTakeLine {
  id: number;
  item: string;
  shelf_side: string | null;
  rack: string | null;
  level: number | null;
  expected_quantity: number;
  counted_quantity: number | null;
}
```

#### `TranslationRow`

- **Defined in**: `shared-fixtures/translations.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface TranslationRow {
  concept: string;
  language: string;
  text: string;
}
```

#### `TreeItem`

- **Defined in**: `frontend/src/lib/treeAdapter.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface TreeItem {
  path: string;
  id: number;
  name: string;
  accountnumber: string | null;
  balance_minor: number | null;
}
```

#### `TrialBalance`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface TrialBalance {
  rows: TrialBalanceRow[];
  total_debit_minor: number;
  total_credit_minor: number;
  by_currency: TrialBalanceCurrencySubtotal[];
}
```

#### `TrialBalance`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-reports.ts`

```ts
interface TrialBalance {
  rows: TrialBalanceRow[];
  total_debit_minor: number;
  total_credit_minor: number;
}
```

#### `TrialBalanceComparison`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface TrialBalanceComparison {
  ledgerA: LedgerName;
  ledgerB: LedgerName;
  rows: TrialBalanceComparisonRow[];
}
```

#### `TrialBalanceComparison`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-reports.ts`

```ts
interface TrialBalanceComparison {
  ledgerA: string;
  ledgerB: string;
  rows: TrialBalanceComparisonRow[];
}
```

#### `TrialBalanceComparisonRow`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface TrialBalanceComparisonRow {
  id: number;
  name: string;
  accountnumber: string | null;
  a_debit_minor: number;
  a_credit_minor: number;
  b_debit_minor: number;
  b_credit_minor: number;
}
```

#### `TrialBalanceComparisonRow`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-reports.ts`

```ts
interface TrialBalanceComparisonRow {
  id: number;
  name: string;
  accountnumber: string | null;
  a_debit_minor: number;
  a_credit_minor: number;
  b_debit_minor: number;
  b_credit_minor: number;
}
```

#### `TrialBalanceCurrencySubtotal`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface TrialBalanceCurrencySubtotal {
  currency: string | null;
  total_debit_minor: number;
  total_credit_minor: number;
  balanced: boolean;
}
```

#### `TrialBalanceRow`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface TrialBalanceRow {
  id: number;
  name: string;
  accountnumber: string | null;
  debit_minor: number;
  credit_minor: number;
  currency: string | null;
  has_quantity_postings: boolean;
}
```

#### `TrialBalanceRow`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-reports.ts`

```ts
interface TrialBalanceRow {
  id: number;
  name: string;
  accountnumber: string | null;
  debit_minor: number;
  credit_minor: number;
}
```

#### `TypedAddress`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
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
```

#### `TypedPhone`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface TypedPhone {
  phone_type: string;
  record_name: string;
  phone: string | null;
}
```

#### `TypedPhone`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface TypedPhone {
  phone_type: string;
  record_name: string;
  phone: string | null;
}
```

#### `UblImportLine`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface UblImportLine {
  description: string;
  quantity: number;
  unitPriceMinor: number;
  amountMinor: number;
}
```

#### `UblImportResult`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
interface UblImportResult {
  reference: string;
  issueDate: string;
  supplierName: string;
  totalMinor: number;
  taxMinor: number;
  lines: UblImportLine[];
}
```

#### `UserId`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-reports.ts`, `backend/src/db-seed.ts`, `backend/src/primitives.ts`

```ts
type UserId = number & { readonly __brand: 'UserId' };
```

#### `UserSummary`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface UserSummary {
  id: number;
  username: string;
  active: boolean;
  roles: string[];
}
```

#### `UserSummary`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/auth.ts`

```ts
interface UserSummary {
  id: number;
  username: string;
  active: boolean;
  roles: string[];
}
```

#### `VendorName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `frontend/src/lib/api.ts`

```ts
type VendorName = string & { readonly __brand: 'VendorName' };
```

#### `VendorName`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db.ts`

```ts
type VendorName = string & { readonly __brand: 'VendorName' };
```

#### `VocabularyWord`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
interface VocabularyWord {
  name: string;
  translations: Record<string, string>;
}
```

#### `VocabularyWord`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
interface VocabularyWord {
  name: string;
  translations: Record<string, string>;
}
```

### Functions (362, alphabetical)

#### `activeRows`

- **Defined in**: `frontend/src/lib/journalGrid.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
activeRows(rows: Row[]): Row[]
```

#### `addOrUpdateItemSource`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
addOrUpdateItemSource(input: ItemSourceInput): void
```

#### `addRow`

- **Defined in**: `frontend/src/lib/journalGrid.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
addRow(rows: Row[]): Row[]
```

#### `addTaskDependency`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
addTaskDependency(dependentTask: string, predecessorTask: string, dependencyType: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish', userId: UserId): void
```

#### `addTypedAddress`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
addTypedAddress(entityName: string, addressType: string, value: Partial<Contact>, userId: UserId): string
```

#### `addTypedContactPerson`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
addTypedContactPerson(entityName: string, contactType: string, value: { name: string; phone?: string | null; email?: string | null }, userId: UserId): string
```

#### `addTypedPhone`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
addTypedPhone(entityName: string, phoneType: string, number: string, userId: UserId): string
```

#### `adjustLocationCapacity`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
adjustLocationCapacity(business: BusinessName, ledger: LedgerName, locationName: LocationName, itemName: ItemName, itemQuantityDelta: number, transdate: string, userId: UserId, referenceSuffix: string): void
```

#### `allocatePayment`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
allocatePayment(invoiceId: number, paymentReference: string, allocatedMinor: number, allocationDate: string, paymentAccount: string, userId: UserId, skipJournalPosting = false): void
```

#### `asAccountName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-reports.ts`, `backend/src/primitives.ts`, `frontend/src/lib/api.ts`

```ts
asAccountName(name: string): AccountName
```

#### `asAccountName`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-reports.ts`, `backend/src/db.ts`, `backend/src/primitives.ts`

```ts
asAccountName(name: string): AccountName
```

#### `asBusinessName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/invoice.ts`, `backend/src/db-seed.ts`, `backend/src/primitives.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts`

```ts
asBusinessName(name: string): BusinessName
```

#### `asBusinessName`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db.ts`, `backend/src/invoice.ts`, `backend/src/db-seed.ts`, `backend/src/primitives.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts`

```ts
asBusinessName(name: string): BusinessName
```

#### `asCustomerName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
asCustomerName(name: string): CustomerName
```

#### `asCustomerName`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
asCustomerName(name: string): CustomerName
```

#### `asDivisionName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-reports.ts`, `frontend/src/lib/api.ts`

```ts
asDivisionName(name: string): DivisionName
```

#### `asDivisionName`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-reports.ts`, `backend/src/db.ts`

```ts
asDivisionName(name: string): DivisionName
```

#### `asEmployeeName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
asEmployeeName(name: string): EmployeeName
```

#### `asEmployeeName`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
asEmployeeName(name: string): EmployeeName
```

#### `asEntityId`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
asEntityId(id: number): EntityId
```

#### `asItemName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-seed.ts`, `frontend/src/lib/api.ts`

```ts
asItemName(name: string): ItemName
```

#### `asItemName`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db.ts`, `backend/src/db-seed.ts`

```ts
asItemName(name: string): ItemName
```

#### `asLedgerName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/invoice.ts`, `backend/src/db-seed.ts`, `backend/src/primitives.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts`

```ts
asLedgerName(name: string): LedgerName
```

#### `asLedgerName`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db.ts`, `backend/src/invoice.ts`, `backend/src/db-seed.ts`, `backend/src/primitives.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts`

```ts
asLedgerName(name: string): LedgerName
```

#### `asLocationName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-seed.ts`, `frontend/src/lib/api.ts`

```ts
asLocationName(name: string): LocationName
```

#### `asLocationName`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db.ts`, `backend/src/db-seed.ts`

```ts
asLocationName(name: string): LocationName
```

#### `assertPeriodOpen`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
assertPeriodOpen(business: BusinessName, ledger: LedgerName, transdate: string): void
```

#### `asUserId`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-seed.ts`

```ts
asUserId(id: number): UserId
```

#### `asVendorName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
asVendorName(name: string): VendorName
```

#### `asVendorName`

- **Defined in**: `frontend/src/lib/api.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
asVendorName(name: string): VendorName
```

#### `attachUser`

- **Defined in**: `backend/src/auth-middleware.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
attachUser(req: Request, _res: Response, next: NextFunction): void
```

#### `authenticateCustomer`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
authenticateCustomer(name: string, password: string): boolean
```

#### `autoBalanceTrailingRow`

- **Defined in**: `frontend/src/lib/journalGrid.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
autoBalanceTrailingRow(rows: Row[], changedIndex: number): Row[]
```

#### `autoExpandIfTrailingRowFilled`

- **Defined in**: `frontend/src/lib/journalGrid.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
autoExpandIfTrailingRowFilled(rows: Row[]): Row[]
```

#### `buildCategoryTree`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `backend/src/db-matrix-reports.ts`, `backend/src/primitives.ts`

```ts
buildCategoryTree(lines: StatementLine[], accountIdByName: Map<string, number>, rootName: string, normalSide: 'debit' | 'credit' = 'debit'): CategoryTreeNode[]
```

#### `buildProfitAndLossFromBalances`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `backend/src/db-matrix-reports.ts`

```ts
buildProfitAndLossFromBalances(balances: Map<number, number>): ProfitAndLoss
```

#### `canSave`

- **Defined in**: `frontend/src/lib/journalGrid.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
canSave(rows: Row[]): boolean
```

#### `changeOwnPassword`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
changeOwnPassword(userId: number, currentPassword: string, newPassword: string): void
```

#### `changePassword`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
changePassword(userId: number, newPassword: string): void
```

#### `checkEInvoiceDiscrepancies`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
checkEInvoiceDiscrepancies(parsed: UblImportResult, poReference?: string): EInvoiceDiscrepancy[]
```

#### `cityDivisionFor`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-matrix-reports.ts`

```ts
cityDivisionFor(locationName: string): string | undefined
```

#### `climbInstanceTree`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
climbInstanceTree(instanceId: number): 
```

#### `clockInToProject`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
clockInToProject(employeeName: EmployeeName, projectExpenseAccount: AccountName, business: BusinessName, ledger: LedgerName, userId: UserId): EmployeeClock
```

#### `clockOutOfProject`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
clockOutOfProject(employeeName: EmployeeName, business: BusinessName, ledger: LedgerName, userId: UserId): void
```

#### `closeBooks`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `backend/src/db-seed.ts`, `frontend/src/lib/api.ts`

```ts
closeBooks(business: BusinessName, ledger: LedgerName, asOfDate: string, retainedEarningsAccount: string, userId: UserId): CloseBooksResult
```

#### `closePeriod`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
closePeriod(business: BusinessName, ledger: LedgerName, throughDate: string, userId: UserId): void
```

#### `completeCashPurchase`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
completeCashPurchase(input: CashPurchaseInput, userId: UserId): CashPurchaseResult
```

#### `completePosSale`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-reports.ts`, `frontend/src/lib/api.ts`

```ts
completePosSale(input: PosSaleInput, userId: UserId): PosSaleResult
```

#### `completeStockTake`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
completeStockTake(stockTakeId: number, business: BusinessName, ledger: LedgerName, varianceExpenseAccount: AccountName, /** @deprecated No longer used — each line now resolves its own, * real, per-product Inventory account directly, the same, real, * structural fix already applied to Purchases and Sales/COGS.
   * Kept only so existing callers (the real, live Stock Take UI, the
   * simulation) don't need a breaking API change to keep working. */
  inventoryAccount: string, unitCostMinorByItem: Record<string, number>, userId: UserId): void
```

#### `computeSuggestedFill`

- **Defined in**: `frontend/src/lib/journalGrid.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
computeSuggestedFill(rows: Row[], trailingIndex: number): number | null
```

#### `confirmPickedLine`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
confirmPickedLine(invoiceId: number, invoiceLineId: number, business: BusinessName, ledger: LedgerName, userId: UserId): void
```

#### `confirmRestockPickedLine`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
confirmRestockPickedLine(runReference: string, itemName: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
```

#### `consumeFromLots`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
consumeFromLots(itemName: ItemName, quantity: number): 
```

#### `copyChartOfAccountsInto`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`

```ts
copyChartOfAccountsInto(destRootName: string, coaFamily: string | undefined, userId: UserId): void
```

#### `countInvoices`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
countInvoices(business: BusinessName, ledger: LedgerName, invoiceType?: 'AR' | 'AP', source: 'manual' | 'pos' | 'all' = 'manual'): number
```

#### `countItems`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
countItems(): number
```

#### `countJournalEntries`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
countJournalEntries(business: BusinessName, ledger: LedgerName): number
```

#### `countStockListing`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
countStockListing(): number
```

#### `createBusiness`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`, `frontend/src/lib/api.ts`

```ts
createBusiness(businessName: BusinessName, financialYearLabel: string, userId: UserId, coaFamily?: string, secondaryCurrencies?: string[], entityStructure?: EntityStructure, partnerNames?: string[]): 
```

#### `createDivisionType`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
createDivisionType(name: string, userId: UserId): void
```

#### `createEntity`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-seed.ts`, `backend/src/primitives.ts`, `frontend/src/lib/api.ts`

```ts
createEntity(input: NewEntity, userId: UserId): EntityNode
```

#### `createInvoice`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
createInvoice(input: InvoiceInput, userId: UserId): number
```

#### `createItem`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`

```ts
createItem(name: string, parentCategoryOrItemsRoot: string, userId: UserId): void
```

#### `createLocationType`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
createLocationType(name: string, userId: UserId): void
```

#### `createPosTerminal`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
createPosTerminal(terminalName: string, locationName: LocationName, userId: UserId): void
```

#### `createProduct`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
createProduct(name: string, parent: string, userId: UserId): void
```

#### `createProjectTask`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
createProjectTask(projectName: string, taskName: string, plannedStart: string, plannedEnd: string, userId: UserId): void
```

#### `createRecurringJournal`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
createRecurringJournal(business: BusinessName, ledger: LedgerName, reference: string, startDate: string, recurrence: Recurrence, lines: RecurringJournalLine[], userId: UserId, description?: string, recurrenceCount?: number): void
```

#### `createStockTake`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
createStockTake(locationName: LocationName, takeDate: string, userId: UserId): number
```

#### `createSystemEntity`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
createSystemEntity(name: string, parentId: number | null): number
```

#### `createUser`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
createUser(username: string, password: string, roleNames: string[]): UserSummary
```

#### `creditTotalMinor`

- **Defined in**: `frontend/src/lib/journalGrid.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
creditTotalMinor(rows: Row[]): number
```

#### `debitTotalMinor`

- **Defined in**: `frontend/src/lib/journalGrid.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
debitTotalMinor(rows: Row[]): number
```

#### `decimalPlacesFor`

- **Defined in**: `frontend/src/lib/format.ts`
- **Referenced in**: `frontend/src/lib/money.ts`

```ts
decimalPlacesFor(unitCode: string | undefined): number
```

#### `defineProductShape`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
defineProductShape(businessName: BusinessName, dimensions: [string, string][], userId: UserId): 
```

#### `deleteBomComponent`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
deleteBomComponent(assemblyItem: string, componentItem: string, userId: UserId): void
```

#### `deleteDimensionParent`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
deleteDimensionParent(entityName: string, dimensionName: string, userId: UserId): void
```

#### `deleteEntity`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-seed.ts`, `backend/src/primitives.ts`, `frontend/src/lib/api.ts`

```ts
deleteEntity(id: number, userId: UserId): void
```

#### `deleteEntityLink`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/primitives.ts`

```ts
deleteEntityLink(entityName: string, linkType: string, userId: UserId): void
```

#### `deleteItemSource`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
deleteItemSource(id: number): void
```

#### `deleteMenuOverride`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
deleteMenuOverride(menuItemKey: string, scope: 'business' | 'user', scopeId: number, userId: UserId = asUserId(1)): void
```

#### `deleteTypedAddress`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
deleteTypedAddress(entityName: string, addressType: string, userId: UserId): void
```

#### `deleteTypedContactPerson`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
deleteTypedContactPerson(entityName: string, contactType: string, userId: UserId): void
```

#### `deleteTypedPhone`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
deleteTypedPhone(entityName: string, phoneType: string, userId: UserId): void
```

#### `deleteVocabularyPreference`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
deleteVocabularyPreference(conceptName: string, scope: 'business' | 'user', scopeId: number): void
```

#### `differenceMinor`

- **Defined in**: `frontend/src/lib/journalGrid.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
differenceMinor(rows: Row[]): number
```

#### `dispatchOrderFromPickingList`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
dispatchOrderFromPickingList(invoiceId: number, locationName: LocationName, revenueAccount: string, taxAccount: string, userId: UserId): void
```

#### `dispatchRestockFromPickingList`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
dispatchRestockFromPickingList(runReference: string, business: BusinessName, ledger: LedgerName, warehouseName: LocationName, retailOutletName: LocationName, lines: RestockLineInput[], userId: UserId, transdate?: string): void
```

#### `dispatchStockFromLocation`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/db.ts`, `frontend/src/lib/api.ts`

```ts
dispatchStockFromLocation(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, locationName: LocationName, quantity: number, userId: UserId, transdate?: string): void
```

#### `emptyRow`

- **Defined in**: `frontend/src/lib/journalGrid.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
emptyRow(): Row
```

#### `ensureAddressType`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
ensureAddressType(typeName: string, userId: UserId): void
```

#### `ensureAtLeastOneRow`

- **Defined in**: `frontend/src/lib/journalGrid.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
ensureAtLeastOneRow(rows: Row[]): Row[]
```

#### `ensureCategoryChain`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
ensureCategoryChain(rootName: string, prefix: string, chain: string[], userId: UserId): 
```

#### `ensureCombinationAccountLeaf`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
ensureCombinationAccountLeaf(baseAccountName: string, instanceTopNode: { id: number; name: string }, userId: UserId): 
```

#### `ensureContactPersonType`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
ensureContactPersonType(typeName: string, userId: UserId): void
```

#### `ensureCurrencyPair`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
ensureCurrencyPair(businessName: BusinessName, fromCurrency: string, toCurrency: string, userId: UserId): 
```

#### `ensureHierarchyGrouping`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
ensureHierarchyGrouping(businessName: BusinessName, groupingName: string, userId: UserId): 
```

#### `ensureHierarchyValue`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
ensureHierarchyValue(businessName: BusinessName, groupingName: string, valueName: string, userId: UserId): 
```

#### `ensureLocationCapacityAccount`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
ensureLocationCapacityAccount(business: BusinessName, ledger: LedgerName, locationName: LocationName, userId: UserId): 
```

#### `ensureLocationScopedAccount`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
ensureLocationScopedAccount(baseAccountName: string, locationName: string, userId: UserId): string
```

#### `ensurePhoneType`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
ensurePhoneType(typeName: string, userId: UserId): void
```

#### `ensureProductInstance`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
ensureProductInstance(businessName: BusinessName, definitionDimensions: [string, string][], values: string[], userId: UserId): 
```

#### `ensureProductInventoryAccount`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
ensureProductInventoryAccount(itemName: ItemName, userId: UserId): 
```

#### `ensureProductLocationInventoryAccount`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
ensureProductLocationInventoryAccount(itemName: ItemName, locationName: LocationName, userId: UserId): 
```

#### `ensureProductLocationLeaf`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
ensureProductLocationLeaf(itemName: ItemName, locationName: LocationName, userId: UserId): 
```

#### `ensureProductQuantityAccounts`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `frontend/src/lib/entityTree.ts`

```ts
ensureProductQuantityAccounts(itemName: ItemName, userId: UserId): 
```

#### `ensureProductSalesCogsAccounts`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-reports.ts`

```ts
ensureProductSalesCogsAccounts(itemName: ItemName, userId: UserId, tier?: string): 
```

#### `ensureProductTierItem`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
ensureProductTierItem(baseProductName: ItemName, tier: string, userId: UserId): 
```

#### `ensureProductTierLocationLeaf`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-matrix-reports.ts`

```ts
ensureProductTierLocationLeaf(tierItemName: string, locationName: LocationName, userId: UserId, tierItemId?: number): 
```

#### `escapeAscii`

- **Defined in**: `shared-fixtures/csv.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
escapeAscii(text: string): string
```

#### `exportInvoiceAsUbl`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
exportInvoiceAsUbl(invoiceId: number): string
```

#### `filterToItems`

- **Defined in**: `frontend/src/lib/entityTree.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
filterToItems(entities: EntityNode[]): EntityNode[]
```

#### `formatAmount`

- **Defined in**: `frontend/src/lib/format.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
formatAmount(smallestUnits: number, numberFormat: string, unitCode?: string): string
```

#### `formatDate`

- **Defined in**: `frontend/src/lib/format.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
formatDate(isoDate: string | null | undefined, dateFormat: string): string
```

#### `fulfillOrder`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
fulfillOrder(orderReference: string, fulfillingReference: string, business: BusinessName, ledger: LedgerName, quantityFulfilled: number, valueFulfilledMinor: number, userId: UserId, transdate?: string): void
```

#### `getAccountsPostedTo`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getAccountsPostedTo(reference: string): string[]
```

#### `getActiveShiftsAtLocation`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getActiveShiftsAtLocation(locationName: string): PosShift[]
```

#### `getAgedInvoices`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getAgedInvoices(business: BusinessName, ledger: LedgerName, invoiceType: 'AR' | 'AP', asOfDate: string): AgedInvoiceRow[]
```

#### `getAgedSummary`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getAgedSummary(business: BusinessName, ledger: LedgerName, invoiceType: 'AR' | 'AP', asOfDate: string): AgedSummaryRow[]
```

#### `getAgingBuckets`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getAgingBuckets(paymentTermsDays: number | null): AgingBucket[]
```

#### `getAllTranslations`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getAllTranslations(languageName: string): Record<string, string>
```

#### `getAncestorChain`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`

```ts
getAncestorChain(entityName: string, rootName: string): string[]
```

#### `getAxisValues`

- **Defined in**: `backend/src/db-matrix-reports.ts`
- **Referenced in**: `frontend/src/lib/matrix-api.ts`

```ts
getAxisValues(businessName: BusinessName, ledgerName: LedgerName): AxisValues
```

#### `getBalanceSheet`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getBalanceSheet(businessName: BusinessName, ledgerName: LedgerName, asOfDate?: string, divisionName?: string): BalanceSheet
```

#### `getBankAccounts`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getBankAccounts(business: BusinessName, ledger: LedgerName): BankAccountRow[]
```

#### `getBelowReorderStock`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getBelowReorderStock(): BelowReorderRow[]
```

#### `getBomComponents`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getBomComponents(assemblyItem: string): 
```

#### `getBusinesses`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getBusinesses(): 
```

#### `getBusinessHierarchy`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getBusinessHierarchy(businessName: BusinessName): HierarchyGroupingWithValues[]
```

#### `getBusinessProductShapes`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getBusinessProductShapes(businessName: BusinessName): [string, string][][]
```

#### `getBusinessReports`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getBusinessReports(): ReportRow[]
```

#### `getBusinessTypes`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getBusinessTypes(): BusinessTypeInfo[]
```

#### `getCashFlowForecast`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getCashFlowForecast(business: BusinessName, ledger: LedgerName, asOfDate: string, horizonDays: number): CashFlowForecast
```

#### `getCashPosition`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/primitives.ts`, `frontend/src/lib/api.ts`

```ts
getCashPosition(business: BusinessName, ledger: LedgerName): CashPositionByCurrency[]
```

#### `getChartOfAccounts`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `backend/src/db.ts`, `frontend/src/lib/api.ts`

```ts
getChartOfAccounts(): ChartRow[]
```

#### `getCoaFamilyAccounts`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getCoaFamilyAccounts(businessName: BusinessName, ledgerName: LedgerName): string[]
```

#### `getCombinationByUpc`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getCombinationByUpc(upc: string): 
```

#### `getCombinationDisplayName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-reports.ts`

```ts
getCombinationDisplayName(entityId: number): string
```

#### `getConceptsWithAlternates`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getConceptsWithAlternates(): ConceptWithAlternates[]
```

#### `getContact`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/invoice.ts`, `frontend/src/lib/api.ts`

```ts
getContact(entityName: string): Contact | undefined
```

#### `getContactBaseAccounts`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getContactBaseAccounts(contactName: string): string[]
```

#### `getContactsWithType`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/primitives.ts`

```ts
getContactsWithType(typeName: string): string[]
```

#### `getContactTypes`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getContactTypes(contactName: string): string[]
```

#### `getCounterpartyHistory`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getCounterpartyHistory(business: BusinessName, ledger: LedgerName, counterpartyName: string): HistoryLine[]
```

#### `getCreditStatus`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getCreditStatus(entityName: string): CreditStatus
```

#### `getCurrencyExchangeRate`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getCurrencyExchangeRate(businessName: BusinessName, fromCurrency: string, toCurrency: string, side: 'buy' | 'sell'): number | null
```

#### `getCustomerStatement`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getCustomerStatement(business: BusinessName, ledger: LedgerName, customerName: string, asOfDate: string): CustomerStatement
```

#### `getDefaultLanguage`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/invoice.ts`, `frontend/src/lib/api.ts`

```ts
getDefaultLanguage(): string | null
```

#### `getDimensionAncestorChain`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getDimensionAncestorChain(entityName: string, dimensionName: string): string[]
```

#### `getDimensionChildren`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-reports.ts`

```ts
getDimensionChildren(parentName: string, dimensionName: string): string[]
```

#### `getDimensionLinksPointingAt`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getDimensionLinksPointingAt(targetName: string): 
```

#### `getDimensionParent`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-matrix-reports.ts`

```ts
getDimensionParent(entityName: string, dimensionName: string): string | undefined
```

#### `getDivisionForAccount`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-reports.ts`

```ts
getDivisionForAccount(accountName: AccountName): string | undefined
```

#### `getDivisions`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-reports.ts`, `backend/src/db-seed.ts`, `frontend/src/lib/api.ts`

```ts
getDivisions(): 
```

#### `getDivisionType`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getDivisionType(divisionName: string): string | null
```

#### `getDivisionTypes`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getDivisionTypes(): string[]
```

#### `getEffectiveSaleCurrency`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
getEffectiveSaleCurrency(terminalName: string | undefined): string | null
```

#### `getEmployeeSchedule`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getEmployeeSchedule(employeeName: string): EmployeeScheduleLine[]
```

#### `getEntitiesWithRelationship`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/primitives.ts`

```ts
getEntitiesWithRelationship(relationshipType: string): 
```

#### `getEntity`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/primitives.ts`

```ts
getEntity(id: number): EntityNode | undefined
```

#### `getEntityHistory`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getEntityHistory(id: number): EntityHistoryRow[]
```

#### `getEntityLink`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/primitives.ts`

```ts
getEntityLink(entityName: string, linkType: string): string | undefined
```

#### `getEntityTree`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-reports.ts`, `backend/src/db-matrix-reports.ts`, `frontend/src/lib/api.ts`

```ts
getEntityTree(): (EntityNode &
```

#### `getExpiringStock`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getExpiringStock(asOfDate: string, withinDays: number): ExpiringLot[]
```

#### `getHierarchy`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/primitives.ts`, `frontend/src/lib/api.ts`

```ts
getHierarchy(rootName: string, relationshipType?: string): HierarchyNode
```

#### `getHierarchyChain`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getHierarchyChain(leafName: ItemName | LocationName): HierarchyChainNode[]
```

#### `getInvoice`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getInvoice(id: number): Invoice | undefined
```

#### `getInvoiceLine`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/invoice.ts`

```ts
getInvoiceLine(reference: string, business: BusinessName, ledger: LedgerName): InvoiceLine | undefined
```

#### `getInvoiceOutstandingMinor`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getInvoiceOutstandingMinor(invoiceId: number): number
```

#### `getItem`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/auth.ts`, `frontend/src/lib/state.svelte.ts`

```ts
getItem(entityName: string): Item | undefined
```

#### `getItemByUpc`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getItemByUpc(upc: string): ItemSummary | undefined
```

#### `getItemLeadTimes`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getItemLeadTimes(itemName: ItemName): 
```

#### `getItemLocation`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/db.ts`, `frontend/src/lib/api.ts`

```ts
getItemLocation(itemName: ItemName, locationName: LocationName): ItemLocationLevels
```

#### `getItemPriceForCurrency`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getItemPriceForCurrency(itemName: string, currency: string | null, productInstanceId?: number): number | null
```

#### `getItemProduct`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getItemProduct(itemName: string): string | null
```

#### `getItemStorageOrigin`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getItemStorageOrigin(itemName: ItemName): 'Hot' | 'Cold' | undefined
```

#### `getJournalEntry`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getJournalEntry(business: BusinessName, ledger: LedgerName, journalId: number, occurrenceDate: string): JournalDetail | undefined
```

#### `getLanguageDirection`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getLanguageDirection(languageName: string): 'LTR' | 'RTL' | undefined
```

#### `getLanguages`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`, `frontend/src/lib/api.ts`

```ts
getLanguages(): 
```

#### `getLedgerBalances`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `backend/src/db.ts`, `backend/src/db-matrix-reports.ts`

```ts
getLedgerBalances(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, divisionName?: string, excludeCloseEntries = false): Map<number, number>
```

#### `getLedgerBalancesByDivision`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getLedgerBalancesByDivision(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, excludeCloseEntries = false): Map<number, Map<string | null, number>>
```

#### `getLedgerBalancesByDivisionStructural`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getLedgerBalancesByDivisionStructural(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, excludeCloseEntries = false): Map<number, Map<string | null, number>>
```

#### `getLedgerDateRange`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getLedgerDateRange(businessName: BusinessName, ledgerName: LedgerName): LedgerDateRange
```

#### `getLedgers`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getLedgers(businessName: BusinessName): 
```

#### `getLineType`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getLineType(entityName: string): string | undefined
```

#### `getLocalizedText`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/invoice.ts`, `frontend/src/lib/api.ts`

```ts
getLocalizedText(language: string, opts?: { businessName?: string; userId?: number }): Record<string, string>
```

#### `getLocation`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
getLocation(name: string): Location | undefined
```

#### `getLocationCapacityStatus`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getLocationCapacityStatus(locationName: LocationName): LocationCapacityStatus
```

#### `getLocationForAccount`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-matrix-reports.ts`

```ts
getLocationForAccount(accountName: AccountName): string | undefined
```

#### `getLocationOpenHours`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getLocationOpenHours(locationName: string): OpenHoursLine[]
```

#### `getLocationTypes`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getLocationTypes(): string[]
```

#### `getMenuTree`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getMenuTree(opts?: { businessName?: string; userId?: number }): MenuSectionRow[]
```

#### `getOpenProjectClockForEmployee`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getOpenProjectClockForEmployee(employeeName: EmployeeName): EmployeeClock | undefined
```

#### `getOpenShiftForEmployee`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getOpenShiftForEmployee(employeeName: string): PosShift | undefined
```

#### `getOrderStatus`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/db.ts`, `frontend/src/lib/api.ts`

```ts
getOrderStatus(orderReference: string): 
```

#### `getOrganizationChart`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getOrganizationChart(businessName: BusinessName): OrganizationChart
```

#### `getPeriodLockStatus`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getPeriodLockStatus(business: BusinessName, ledger: LedgerName): PeriodLockStatus
```

#### `getPickingList`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getPickingList(invoiceId: number, locationName: LocationName): PickingListLine[]
```

#### `getProductUnitCostMinor`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
getProductUnitCostMinor(itemName: ItemName): number | null
```

#### `getProfitAndLoss`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getProfitAndLoss(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, divisionName?: string, excludeCloseEntries = true): ProfitAndLoss
```

#### `getProfitAndLossByAxis`

- **Defined in**: `backend/src/db-matrix-reports.ts`
- **Referenced in**: `frontend/src/lib/matrix-api.ts`

```ts
getProfitAndLossByAxis(businessName: BusinessName, ledgerName: LedgerName, fromDate: string | undefined, toDate: string | undefined, outerAxis: MatrixAxis, innerAxis: MatrixAxis, outerFilter?: string, innerFilter?: string): ProfitAndLossByAxisNode[]
```

#### `getProfitAndLossByDivision`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getProfitAndLossByDivision(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string): ProfitAndLossByDivision[]
```

#### `getProfitAndLossByDivisionTree`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getProfitAndLossByDivisionTree(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string): ProfitAndLossByDivisionNode[]
```

#### `getProfitAndLossComparison`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getProfitAndLossComparison(businessName: BusinessName, ledgerA: LedgerName, ledgerB: LedgerName): ProfitAndLossComparison
```

#### `getProjectTasks`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getProjectTasks(projectName: string): 
```

#### `getPrototypeOf`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getPrototypeOf(entityName: string): string | undefined
```

#### `getQualifiedDisplayName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-reports.ts`

```ts
getQualifiedDisplayName(entityId: number): string
```

#### `getRelationship`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getRelationship(entityName: string): Relationship | undefined
```

#### `getReminderCandidates`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getReminderCandidates(business: BusinessName, ledger: LedgerName, asOfDate: string): ReminderCandidate[]
```

#### `getRestockPickingList`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getRestockPickingList(runReference: string, warehouseName: LocationName, lines: RestockLineInput[]): PickingListLine[]
```

#### `getSalesCogsMatrix`

- **Defined in**: `backend/src/db-matrix-reports.ts`
- **Referenced in**: `frontend/src/lib/matrix-api.ts`

```ts
getSalesCogsMatrix(businessName: BusinessName, ledgerName: LedgerName, fromDate: string | undefined, toDate: string | undefined, rowAxis: MatrixAxis, colAxis: MatrixAxis): SalesCogsMatrix
```

#### `getSalesReport`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getSalesReport(business: BusinessName, ledger: LedgerName, fromDate?: string, toDate?: string): SalesReport
```

#### `getScheduleAtLocation`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getScheduleAtLocation(locationName: string): LocationScheduleLine[]
```

#### `getScreenTitle`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getScreenTitle(href: string, opts?: { businessName?: string; userId?: number }): string | undefined
```

#### `getSessionUser`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: `backend/src/auth-middleware.ts`

```ts
getSessionUser(token: string | undefined): AuthenticatedUser | null
```

#### `getStagedLines`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getStagedLines(reference: string, business: BusinessName, ledger: LedgerName): StagedLine[]
```

#### `getStockListing`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getStockListing(limit = 100, offset = 0): StockListingRow[]
```

#### `getStockListingByLocation`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getStockListingByLocation(): StockListingLocationGroup[]
```

#### `getStockMovementReport`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getStockMovementReport(ledgerName: string, fromDate?: string, toDate?: string): StockMovementReport
```

#### `getStockOnHandMatrix`

- **Defined in**: `backend/src/db-matrix-reports.ts`
- **Referenced in**: `frontend/src/lib/matrix-api.ts`

```ts
getStockOnHandMatrix(rowAxis: MatrixAxis, colAxis: MatrixAxis): StockOnHandMatrix
```

#### `getStockOutRiskReport`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getStockOutRiskReport(windowDays: number = 2): StockOutRiskRow[]
```

#### `getStockTake`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getStockTake(id: number): StockTake | undefined
```

#### `getTaskDependencies`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
getTaskDependencies(dependentTask: string): 
```

#### `getTranslation`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`

```ts
getTranslation(conceptName: string, languageName: string): string | null
```

#### `getTrialBalance`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getTrialBalance(businessName: BusinessName, ledgerName: LedgerName, asOfDate?: string, divisionName?: string): TrialBalance
```

#### `getTrialBalanceComparison`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getTrialBalanceComparison(businessName: BusinessName, ledgerA: LedgerName, ledgerB: LedgerName): TrialBalanceComparison
```

#### `getTypedAddresses`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getTypedAddresses(entityName: string): TypedAddress[]
```

#### `getTypedContactPersons`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getTypedContactPersons(entityName: string): ContactPerson[]
```

#### `getTypedPhones`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getTypedPhones(entityName: string): TypedPhone[]
```

#### `getVocabularyAlternates`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getVocabularyAlternates(wordName: string): string[]
```

#### `getVocabularyWords`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
getVocabularyWords(): VocabularyWord[]
```

#### `hashPassword`

- **Defined in**: `backend/src/password.ts`
- **Referenced in**: `backend/src/auth.ts`, `backend/src/db.ts`

```ts
hashPassword(password: string): string
```

#### `hasRole`

- **Defined in**: `frontend/src/lib/auth.ts`
- **Referenced in**: `frontend/src/lib/state.svelte.ts`

```ts
hasRole(state: AuthState | null, ...roles: string[]): boolean
```

#### `hasRole`

- **Defined in**: `frontend/src/lib/state.svelte.ts`
- **Referenced in**: `frontend/src/lib/auth.ts`

```ts
hasRole(state: AuthState | null, ...roles: string[]): boolean
```

#### `importUblInvoiceAsDraft`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
importUblInvoiceAsDraft(xml: string, business: BusinessName, ledger: LedgerName, vendorName: string, userId: UserId, poReference?: string): 
```

#### `instantiateChartOfAccounts`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`

```ts
instantiateChartOfAccounts(businessName: BusinessName, coaFamily: string | undefined, userId: UserId): void
```

#### `isBalanced`

- **Defined in**: `frontend/src/lib/journalGrid.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
isBalanced(rows: Row[]): boolean
```

#### `isDescendantOf`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/entityTree.ts`

```ts
isDescendantOf(entityName: string, rootName: string): boolean
```

#### `isDescendantOf`

- **Defined in**: `frontend/src/lib/entityTree.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
isDescendantOf(entity: EntityNode, ancestorName: string, allEntities: EntityNode[], matchSuffix = false): boolean
```

#### `isGenuineCategoryOrItemsRoot`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
isGenuineCategoryOrItemsRoot(name: string): boolean
```

#### `isRowEmpty`

- **Defined in**: `frontend/src/lib/journalGrid.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
isRowEmpty(row: Row): boolean
```

#### `isRowFilled`

- **Defined in**: `frontend/src/lib/journalGrid.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
isRowFilled(row: Row): boolean
```

#### `listAddressTypes`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `frontend/src/lib/api.ts`

```ts
listAddressTypes(): string[]
```

#### `listContactPersonTypes`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
listContactPersonTypes(): string[]
```

#### `listCurrencyPairs`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
listCurrencyPairs(currencies: string[]): 
```

#### `listInvoices`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
listInvoices(business: BusinessName, ledger: LedgerName, options: ListInvoicesOptions = {}): Invoice[]
```

#### `listItems`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
listItems(limit?: number, offset = 0): ItemSummary[]
```

#### `listItemSources`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
listItemSources(itemName: string): ItemSource[]
```

#### `listJournalEntries`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`, `frontend/src/lib/pagination.ts`

```ts
listJournalEntries(business: BusinessName, ledger: LedgerName, limit = 100, offset = 0): JournalSummary[]
```

#### `listLineTypes`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
listLineTypes(): string[]
```

#### `listPendingCustomers`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
listPendingCustomers(): PendingCustomer[]
```

#### `listPhoneTypes`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
listPhoneTypes(): string[]
```

#### `listProducts`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
listProducts(): ProductSummary[]
```

#### `listRoles`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
listRoles(): 
```

#### `listUsers`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
listUsers(): UserSummary[]
```

#### `loadAllTranslations`

- **Defined in**: `shared-fixtures/translations.ts`
- **Referenced in**: `backend/src/db-seed.ts`

```ts
loadAllTranslations(): TranslationRow[]
```

#### `loadDemoCategories`

- **Defined in**: `shared-fixtures/wine-retail-demo-data.ts`
- **Referenced in**: `backend/src/db-seed.ts`

```ts
loadDemoCategories(): DemoCategory[]
```

#### `loadDemoLocations`

- **Defined in**: `shared-fixtures/wine-retail-demo-data.ts`
- **Referenced in**: `backend/src/db-seed.ts`

```ts
loadDemoLocations(): DemoLocation[]
```

#### `loadDemoProducts`

- **Defined in**: `shared-fixtures/wine-retail-demo-data.ts`
- **Referenced in**: `backend/src/db-seed.ts`

```ts
loadDemoProducts(): DemoProduct[]
```

#### `loadDemoStockLevels`

- **Defined in**: `shared-fixtures/wine-retail-demo-data.ts`
- **Referenced in**: `backend/src/db-seed.ts`

```ts
loadDemoStockLevels(): DemoStockLevel[]
```

#### `loadDemoUpcs`

- **Defined in**: `shared-fixtures/wine-retail-demo-data.ts`
- **Referenced in**: `backend/src/db-seed.ts`

```ts
loadDemoUpcs(): DemoUpc[]
```

#### `login`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: `backend/src/db.ts`, `backend/src/server.ts`, `backend/src/auth-middleware.ts`, `frontend/src/lib/api.ts`

```ts
login(username: string, password: string): 
```

#### `logout`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
logout(token: string): void
```

#### `parseMinorUnits`

- **Defined in**: `frontend/src/lib/money.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
parseMinorUnits(text: string): number
```

#### `parseQuantity`

- **Defined in**: `frontend/src/lib/money.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
parseQuantity(text: string): number
```

#### `parseUblInvoice`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
parseUblInvoice(xml: string): UblImportResult
```

#### `payEmployeeWages`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
payEmployeeWages(input: PayEmployeeWagesInput, userId: UserId): PayEmployeeWagesResult
```

#### `placeOrder`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
placeOrder(orderReference: string, business: BusinessName, ledger: LedgerName, quantity: number, priceMinor: number, userId: UserId, transdate?: string, vendor?: VendorName, item?: ItemName, location?: LocationName): void
```

#### `postApPayment`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
postApPayment(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
```

#### `postApPurchase`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
postApPurchase(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
```

#### `postArReceipt`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
postArReceipt(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
```

#### `postArSale`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
postArSale(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
```

#### `postBomComponents`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
postBomComponents(assemblyItem: string, business: string, userId: UserId): void
```

#### `postInvoice`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
postInvoice(id: number,
  revenueOrExpenseAccount: string | { name: string; id: number } | ((line: InvoiceLineInput & { id: number }) => string | { name: string; id: number }), taxAccount: string, userId: UserId, restockInventory = false, divisionName?: string, counterpartyAccountOverride?: string): void
```

#### `postJournalEntry`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-reports.ts`, `frontend/src/lib/api.ts`

```ts
postJournalEntry(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
```

#### `postPurchaseOrder`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
postPurchaseOrder(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
```

#### `postQuantityMovement`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/db.ts`, `backend/src/primitives.ts`

```ts
postQuantityMovement(business: BusinessName, ledger: LedgerName, reference: string, account: AccountName, deltaQuantity: number, userId: UserId, transdate?: string, locationName?: LocationName, accountId?: number): void
```

#### `postSalesOrder`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
postSalesOrder(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
```

#### `postStagedQuantityMovement`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
postStagedQuantityMovement(business: BusinessName, ledger: LedgerName, reference: string, userId: UserId): void
```

#### `postStockDispatch`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
postStockDispatch(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
```

#### `postStockReceipt`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
postStockReceipt(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
```

#### `previewCloseBooks`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
previewCloseBooks(businessName: BusinessName, ledger: LedgerName, asOfDate: string, retainedEarningsAccount: string): CloseBooksPreview
```

#### `readCsv`

- **Defined in**: `shared-fixtures/csv.ts`
- **Referenced in**: `shared-fixtures/wine-retail.ts`, `shared-fixtures/add-brand-translation.ts`, `shared-fixtures/translations.ts`, `shared-fixtures/add-journal-translations.ts`, `shared-fixtures/add-header-translations.ts`, `shared-fixtures/add-menu-translations.ts`, `shared-fixtures/wine-retail-demo-data.ts`, `shared-fixtures/add-journal-remaining-translations.ts`

```ts
readCsv(text: string): Record<string, string>[]
```

#### `receiveLot`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
receiveLot(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, lotNumber: string, receivedDate: string, expirationDate: string | null, quantity: number, userId: UserId, costBasisMinor?: number): void
```

#### `receiveStockAtLocation`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/db.ts`, `backend/src/db-seed.ts`, `frontend/src/lib/api.ts`

```ts
receiveStockAtLocation(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, locationName: LocationName, quantity: number, userId: UserId, transdate?: string, combinationValues?: string[], combinationShape?: [string, string][]): void
```

#### `recordReminderSent`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
recordReminderSent(customerName: string): number
```

#### `recordStockTakeCount`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
recordStockTakeCount(stockTakeId: number, itemName: ItemName, countedQuantity: number): void
```

#### `registerBankAccount`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
registerBankAccount(accountName: string, business: string, scopeName: string, overdraftLimitMinor: number | null, userId: UserId): void
```

#### `registerCustomer`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
registerCustomer(input: CustomerRegistrationInput, userId: UserId): void
```

#### `removeContactType`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
removeContactType(contactName: string, typeName: string, userId: UserId): void
```

#### `removeRowAt`

- **Defined in**: `frontend/src/lib/journalGrid.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
removeRowAt(rows: Row[], index: number): Row[]
```

#### `removeStagedLine`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
removeStagedLine(reference: string, business: BusinessName, ledger: LedgerName, account: string): void
```

#### `reopenPeriod`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
reopenPeriod(business: BusinessName, ledger: LedgerName, userId: UserId): void
```

#### `reorderSiblings`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
reorderSiblings(entityId: EntityId, direction: 'up' | 'down', userId: UserId): void
```

#### `reorderSiblingsBulk`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
reorderSiblingsBulk(entityIds: number[], direction: 'up' | 'down', userId: UserId): void
```

#### `requireAuth`

- **Defined in**: `backend/src/auth-middleware.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
requireAuth(req: Request, res: Response, next: NextFunction): void
```

#### `requireRole`

- **Defined in**: `backend/src/auth-middleware.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
requireRole(...roles: string[]): void
```

#### `resetReminderLevel`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
resetReminderLevel(customerName: string): void
```

#### `resolveDispatchLocation`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
resolveDispatchLocation(itemName: ItemName, logicalLocationName: LocationName): LocationName
```

#### `resolveItemId`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
resolveItemId(itemName: ItemName): number | undefined
```

#### `reverseJournalEntry`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
reverseJournalEntry(business: BusinessName, ledger: LedgerName, journalId: number, occurrenceDate: string, userId: UserId, reversalDate?: string): void
```

#### `saveBusinessTypeAnswers`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
saveBusinessTypeAnswers(businessName: BusinessName, answers: Record<string, string>, userId: UserId): void
```

#### `screenTitle`

- **Defined in**: `frontend/src/lib/state.svelte.ts`
- **Referenced in**: `frontend/src/lib/menu.ts`

```ts
screenTitle(href: string): string | undefined
```

#### `seedDefaultHierarchyPrototypes`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
seedDefaultHierarchyPrototypes(business: TypedNode<'BusinessName'>, userId: UserId): void
```

#### `seedRemainingData`

- **Defined in**: `backend/src/db-seed.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
seedRemainingData(): void
```

#### `setAccountCurrency`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db.ts`

```ts
setAccountCurrency(accountName: string, currency: string | null): void
```

#### `setContact`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`, `frontend/src/lib/api.ts`

```ts
setContact(entityName: string, contact: Partial<Contact>): void
```

#### `setContactType`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`, `backend/src/primitives.ts`

```ts
setContactType(contactName: string, typeName: string, userId: UserId): void
```

#### `setCurrencyExchangeRate`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
setCurrencyExchangeRate(businessName: BusinessName, fromCurrency: string, toCurrency: string, userId: UserId, buyRateMinor?: number, sellRateMinor?: number): void
```

#### `setDefaultLanguage`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
setDefaultLanguage(languageName: string, userId: UserId): void
```

#### `setDimensionParent`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-matrix-reports.ts`, `backend/src/db-seed.ts`, `backend/src/primitives.ts`

```ts
setDimensionParent(entityName: string, dimensionName: string, parentName: string, userId: UserId, entityId?: number, targetId?: number): void
```

#### `setDivisionType`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
setDivisionType(divisionNameOrId: string | EntityId, typeMarkerName: string): void
```

#### `setEmployeeSchedule`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
setEmployeeSchedule(employeeName: string, locationName: string, schedule: ScheduleLine[]): void
```

#### `setEntityLink`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-matrix-reports.ts`, `backend/src/db-seed.ts`, `backend/src/primitives.ts`

```ts
setEntityLink(entityName: string, linkType: string, targetName: string, userId: UserId, entityId?: number, targetId?: number): string
```

#### `setItem`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/auth.ts`, `frontend/src/lib/state.svelte.ts`

```ts
setItem(entityName: string, item: Partial<Item>): void
```

#### `setItemLocationLevelDetails`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
setItemLocationLevelDetails(itemName: ItemName, locationName: LocationName, levels: Omit<ItemLocationLevels, 'quantity_on_hand'>, userId: UserId): void
```

#### `setItemLocationLevels`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/db-seed.ts`, `frontend/src/lib/api.ts`

```ts
setItemLocationLevels(itemName: ItemName, locationName: LocationName, levels: {
    minLevel?: number | null;
    maxLevel?: number | null;
    reorderLevel?: number | null;
    shelfSide?: string | null;
    rack?: string | null;
    level?: number | null;
  }): void
```

#### `setItemProduct`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
setItemProduct(itemName: string, productName: string | null, userId: UserId): void
```

#### `setItemSourceLeadTime`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
setItemSourceLeadTime(itemName: ItemName, vendorName: VendorName, days: number, userId: UserId): void
```

#### `setItemStorageOrigin`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
setItemStorageOrigin(itemName: ItemName, origin: 'Hot' | 'Cold' | null, userId: UserId): void
```

#### `setLanguageDirection`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
setLanguageDirection(languageName: string, direction: 'LTR' | 'RTL' | null, userId: UserId): void
```

#### `setLineType`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
setLineType(entityName: string, lineType: string | null, userId: UserId): void
```

#### `setLocation`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/db.ts`, `backend/src/db-seed.ts`

```ts
setLocation(name: string, location: Location): void
```

#### `setLocationOpenHours`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
setLocationOpenHours(locationName: string, hours: OpenHoursLine[]): void
```

#### `setMenuOverride`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/primitives.ts`, `frontend/src/lib/api.ts`

```ts
setMenuOverride(menuItemKey: string, scope: 'business' | 'user', scopeId: number, overrideLabel: string | null, hidden: boolean, userId: UserId = asUserId(1)): void
```

#### `setOwnDateFormat`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
setOwnDateFormat(userId: number, dateFormat: string): void
```

#### `setOwnNumberFormat`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
setOwnNumberFormat(userId: number, numberFormat: string): void
```

#### `setOwnPageSize`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
setOwnPageSize(userId: number, pageSize: number): void
```

#### `setPosPin`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
setPosPin(employeeName: string, pin: string): void
```

#### `setPrototype`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
setPrototype(entityName: string, prototypeName: string, userId: UserId): void
```

#### `setRelationship`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`, `backend/src/primitives.ts`

```ts
setRelationship(entityName: string, relationshipType: string, targetName: string, userId: UserId): void
```

#### `setTerminalCurrency`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
setTerminalCurrency(terminalName: string, currency: string | null): void
```

#### `setTranslation`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`, `frontend/src/lib/api.ts`

```ts
setTranslation(conceptName: string, languageName: string, text: string, userId: UserId = asUserId(1)): void
```

#### `setupEquityStructure`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
setupEquityStructure(businessName: BusinessName, structure: EntityStructure, userId: UserId, coaFamily?: string, partnerNames?: string[]): void
```

#### `setUserActive`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
setUserActive(userId: number, active: boolean): void
```

#### `setUserRoles`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
setUserRoles(userId: number, roleNames: string[]): void
```

#### `setVocabularyPreference`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
setVocabularyPreference(conceptName: string, scope: 'business' | 'user', scopeId: number, preferredAlternateName: string): void
```

#### `signOff`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
signOff(shiftId: number): void
```

#### `signOn`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
signOn(employeeName: string, locationName: string): PosShift
```

#### `stageApPayment`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
stageApPayment(input: ApPaymentInput): void
```

#### `stageApPurchase`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
stageApPurchase(input: ApPurchaseInput): void
```

#### `stageArReceipt`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
stageArReceipt(input: ArReceiptInput): void
```

#### `stageArSale`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
stageArSale(input: ArSaleInput): void
```

#### `stageBomComponent`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
stageBomComponent(input: {
  assemblyItem: string; business: string; componentItem: string; quantity: number; unit: string;
}): void
```

#### `stageLine`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-reports.ts`, `backend/src/primitives.ts`, `frontend/src/lib/api.ts`

```ts
stageLine(line: StagedLine): void
```

#### `stagePurchaseOrder`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
stagePurchaseOrder(input: PurchaseOrderInput): void
```

#### `stageQuantityMovementLine`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
stageQuantityMovementLine(business: BusinessName, ledger: LedgerName, reference: string, account: AccountName, deltaQuantity: number, transdate: string, locationName?: LocationName, accountId?: number): void
```

#### `stageSalesOrder`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
stageSalesOrder(input: SalesOrderInput): void
```

#### `stageStockDispatch`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
stageStockDispatch(input: StockDispatchInput): void
```

#### `stageStockReceipt`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
stageStockReceipt(input: StockReceiptInput): void
```

#### `todayAtLocation`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
todayAtLocation(locationName: LocationName): string
```

#### `todayIsoDate`

- **Defined in**: `frontend/src/lib/format.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
todayIsoDate(): string
```

#### `toTreePaths`

- **Defined in**: `frontend/src/lib/treeAdapter.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
toTreePaths(entities: EntityNode[]): TreeItem[]
```

#### `transferStock`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/db.ts`, `frontend/src/lib/api.ts`

```ts
transferStock(business: BusinessName, ledger: LedgerName, itemName: ItemName, fromLocationName: LocationName, toLocationName: LocationName, quantity: number, reference: string, userId = 1, transdate?: string, combinationShape?: [string, string][], combinationValuesAfterLocation?: string[]): void
```

#### `unescapeAscii`

- **Defined in**: `shared-fixtures/csv.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
unescapeAscii(text: string): string
```

#### `unregisterBankAccount`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
unregisterBankAccount(accountName: string, userId: UserId): void
```

#### `updateEntity`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-seed.ts`, `backend/src/primitives.ts`, `frontend/src/lib/api.ts`

```ts
updateEntity(id: number, input: EntityUpdate, userId: UserId): EntityNode
```

#### `verifyCustomer`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
verifyCustomer(customerName: string, approve: boolean): void
```

#### `verifyPassword`

- **Defined in**: `backend/src/password.ts`
- **Referenced in**: `backend/src/auth.ts`, `backend/src/db.ts`

```ts
verifyPassword(password: string, stored: string): boolean
```

#### `verifyPosPin`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core file references this directly)

```ts
verifyPosPin(employeeName: string, pin: string): boolean
```

#### `writeCsv`

- **Defined in**: `shared-fixtures/csv.ts`
- **Referenced in**: `shared-fixtures/add-brand-translation.ts`, `shared-fixtures/add-journal-translations.ts`, `shared-fixtures/add-header-translations.ts`, `shared-fixtures/add-menu-translations.ts`, `shared-fixtures/add-journal-remaining-translations.ts`

```ts
writeCsv(rows: Record<string, string>[], headers: string[]): string
```

#### `writeOffStock`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `frontend/src/lib/api.ts`

```ts
writeOffStock(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, quantity: number, unitCostMinor: number, writeOffExpenseAccount: AccountName, /** @deprecated No longer used — resolves to that same, real
   * product's own, real Inventory sub-account directly. Kept only so
   * existing callers don't need a breaking API change. */
  inventoryAccount: string, reason: string, userId: UserId, transdate?: string, locationName?: LocationName): void
```

611 real, indexed names (249 types, 362 functions) across 35 real, core files.
