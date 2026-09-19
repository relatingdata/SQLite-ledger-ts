# Real Source Reference — Common, Backend, Frontend

## Include Graph (real, direct, relative imports between these files)

- `shared-fixtures/add-brand-translation.ts` imports: `./csv.js`
- `shared-fixtures/add-header-translations.ts` imports: `./csv.js`
- `shared-fixtures/add-journal-remaining-translations.ts` imports: `./csv.js`
- `shared-fixtures/add-journal-translations.ts` imports: `./csv.js`
- `shared-fixtures/add-menu-translations.ts` imports: `./csv.js`
- `shared-fixtures/translations.ts` imports: `./csv.js`
- `shared-fixtures/wine-retail-demo-data.ts` imports: `./csv.js`
- `shared-fixtures/wine-retail.ts` imports: `./csv.js`
- `backend/src/auth-middleware.ts` imports: `./auth.js`
- `backend/src/auth.ts` imports: `./db.js`, `./primitives.js`, `./password.js`
- `backend/src/db-matrix-reports.ts` imports: `./db.js`, `./db.js`, `./db-reports.js`, `./db.js`
- `backend/src/db-reports.ts` imports: `./db.js`, `./primitives.js`, `./db.js`
- `backend/src/db-seed.ts` imports: `./db.js`, `./db.js`, `../../shared-fixtures/translations.js`, `../../shared-fixtures/wine-retail-demo-data.js`
- `backend/src/db-stock.ts` imports: `./db.js`, `./primitives.js`, `./db.js`
- `backend/src/db.ts` imports: `./sqlite-runtime.js`, `./password.js`, `./primitives.js`, `./db-reports.js`, `./db-seed.js`, `./db-reports.js`, `./db-stock.js`, `./db-stock.js`
- `backend/src/invoice.ts` imports: `./db.js`
- `backend/src/primitives.ts` imports: `./db.js`, `./db.js`
- `backend/src/server.ts` imports: `./routes/entities.js`, `./routes/reports.js`, `./routes/matrix-reports.js`, `./routes/menu.js`, `./routes/i18n.js`, `./routes/businesses.js`, `./routes/journal.js`, `./routes/contacts.js`, `./routes/items.js`, `./routes/products.js`, `./routes/invoices.js`, `./routes/stock-lots.js`, `./routes/locations.js`, `./routes/divisions.js`, `./routes/hierarchy.js`, `./routes/pos.js`, `./routes/customer-registration.js`, `./routes/arap.js`, `./routes/auth.js`, `./routes/stock.js`, `./routes/invoice.js`, `./routes/period.js`, `./routes/projects.js`, `./auth-middleware.js`
- `frontend/src/lib/api.ts` imports: `./state.svelte`
- `frontend/src/lib/entityTree.ts` imports: `./api`
- `frontend/src/lib/menu.ts` imports: `./state.svelte`
- `frontend/src/lib/pagination.ts` imports: `./state.svelte`
- `frontend/src/lib/session.ts` imports: `./api`
- `frontend/src/lib/state.svelte.ts` imports: `./api`, `./api`
- `frontend/src/lib/treeAdapter.ts` imports: `./api`

## Call Graph Summary (real, direct invocation counts — see `make call-graph` for the complete, standalone report)

Top 15 most-referenced functions across these 35 real, core files:
- `create`: 137
- `fetch`: 72
- `asAccountName`: 56
- `asAccountName`: 56
- `asLedgerName`: 49
- `asLedgerName`: 49
- `asBusinessName`: 48
- `asBusinessName`: 48
- `asUserId`: 47
- `updateEntity`: 42
- `asItemName`: 39
- `asItemName`: 39
- `stageLine`: 37
- `setEntityLink`: 36
- `requireAuth`: 33

## Common Files

### `shared-fixtures/add-brand-translation.ts`

### `shared-fixtures/add-header-translations.ts`

### `shared-fixtures/add-journal-remaining-translations.ts`

### `shared-fixtures/add-journal-translations.ts`

### `shared-fixtures/add-menu-translations.ts`

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

### `shared-fixtures/wine-retail.ts`

**Exported variables**:

- `fixtures`


## Backend Files

### `backend/src/auth-middleware.ts`

**Functions**:

```ts
attachUser(req: Request, _res: Response, next: NextFunction): void
requireAuth(req: Request, res: Response, next: NextFunction): void
requireRole(...roles: string[]): void
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

### `backend/src/db-seed.ts`

**Functions**:

```ts
seedRemainingData(): void
```

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
mergeContactDetail(entityId: number, fields: Record<string, unknown>): void
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

### `backend/src/password.ts`

**Functions**:

```ts
hashPassword(password: string): string
verifyPassword(password: string, stored: string): boolean
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

### `backend/src/server.ts`

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


## Frontend Files

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

### `frontend/src/lib/dirty-state.ts`

**Exported variables**:

- `hasUnsavedEdit`

### `frontend/src/lib/entityTree.ts`

**Functions**:

```ts
isDescendantOf(entity: EntityNode, ancestorName: string, allEntities: EntityNode[], matchSuffix = false): boolean
filterToItems(entities: EntityNode[]): EntityNode[]
```

### `frontend/src/lib/format.ts`

**Functions**:

```ts
todayIsoDate(): string
decimalPlacesFor(unitCode: string | undefined): number
formatAmount(smallestUnits: number, numberFormat: string, unitCode?: string): string
formatDate(isoDate: string | null | undefined, dateFormat: string): string
```

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

### `frontend/src/lib/menu.ts`

### `frontend/src/lib/money.ts`

**Functions**:

```ts
parseMinorUnits(text: string): number
parseQuantity(text: string): number
```

### `frontend/src/lib/pagination.ts`

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

### `frontend/src/lib/translations.ts`

**Exported variables**:

- `translations`

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


## Parent Link / Sibling (Relation) Link Index

See `docs/naming-conventions-and-entity-glossary.md` for what these two, real, distinct link kinds mean.

### Real `parent:` usages (structural — "this entity lives under that one")

- `backend/src/db.ts`: TypedNode<TParentBrand>; string; productName ?? 'Items'; 'Vendors'; // 'Equity'
- `backend/src/primitives.ts`: string | number; string
- `frontend/src/lib/api.ts`: string | null

### Real `relation:` usages (lateral — "this entity refers to / is a translation of that one")

- `backend/src/auth.ts`: role.name; username
- `backend/src/db-seed.ts`: 'COGS'; section.label; link.label
- `backend/src/db-stock.ts`: location.location_type; 'Billing Address'; p.item_name; vendor; item
- `backend/src/db.ts`: targetName; recordName; input.counterpartyName; line.itemName; locationName; h.day; s.day; type; prototypeName; targetName; input.vendorName; languageName; preferredAlternateName; preferredAlternateName; // conceptName; coaFamily; child.name; coaFamily; coaFamily
- `backend/src/primitives.ts`: target

## Reference Index

Generated directly by `scripts/source-reference.ts` (run via `make source-reference`). For each real, exported type and function across the files this reference covers, this script scans every one of those same, real files for a genuine, textual reference to that exact name, excluding the file that defines it, to build the real "Referenced in" list below - a real, direct, confirmed fact about which files mention the name, never a claim about actual runtime call order or invocation count (see the real Call Graph Summary above for that).

### Types (249, alphabetical)

| Name | Defined in | Referenced in | Declaration |
|---|---|---|---|
| `AccountName` | `backend/src/db.ts` | `backend/src/db-stock.ts`, `frontend/src/lib/api.ts` | `type AccountName = string & { readonly __brand: 'AccountName' };` |
| `AccountName` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts`, `backend/src/db.ts` | `type AccountName = string & { readonly __brand: 'AccountName' };` |
| `AgedInvoiceRow` | `backend/src/db.ts` | (none) | `interface AgedInvoiceRow {   invoice_id: number;   reference: string;   counterparty: string;   invoice_date: string;   due_date: string \| null;   outstanding_minor: number;   days_overdue: number;   bucket: string; }` |
| `AgedRow` | `frontend/src/lib/api.ts` | (none) | `interface AgedRow {   invoice_id: number;   reference: string;   counterparty: string;   invoice_date: string;   due_date: string \| null;   outstanding_minor: number;   days_overdue: number;   bucket: string; }` |
| `AgedSummaryRow` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface AgedSummaryRow {   counterparty: string;   outstanding_minor: number;   oldest_days_overdue: number; }` |
| `AgedSummaryRow` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface AgedSummaryRow {   counterparty: string;   outstanding_minor: number;   oldest_days_overdue: number; }` |
| `AgingBucket` | `backend/src/db.ts` | (none) | `interface AgingBucket {   label: string;   through_days: number; }` |
| `ApPaymentInput` | `backend/src/db.ts` | (none) | `interface ApPaymentInput {   reference: string;   business: BusinessName;   ledger: LedgerName;   vendor: VendorName;   amount_minor: number;   transdate?: string;   description?: string; }` |
| `ApPurchaseInput` | `backend/src/db.ts` | (none) | `interface ApPurchaseInput {   reference: string;   business: BusinessName;   ledger: LedgerName;   vendor: VendorName;   expense_account: AccountName;   amount_minor: number;   tax_minor?: number;   location?: LocationName; // real, direct, per-invoice location — not per line   transdate?: string;   description?: string; }` |
| `ArApBaseInput` | `frontend/src/lib/api.ts` | (none) | `interface ArApBaseInput {   reference: string;   business: BusinessName;   ledger: LedgerName;   amount_minor: number;   tax_minor?: number;   location?: string;   transdate?: string;   description?: string; }` |
| `ArReceiptInput` | `backend/src/db.ts` | (none) | `interface ArReceiptInput {   reference: string;   business: BusinessName;   ledger: LedgerName;   customer: CustomerName;   amount_minor: number;   transdate?: string;   description?: string; }` |
| `ArSaleInput` | `backend/src/db.ts` | (none) | `interface ArSaleInput {   reference: string;   business: BusinessName;   ledger: LedgerName;   customer: CustomerName;   amount_minor: number;   tax_minor?: number;   location?: LocationName; // real, direct, per-invoice location — not per line   transdate?: string;   description?: string; }` |
| `AuthenticatedUser` | `backend/src/auth.ts` | `backend/src/auth-middleware.ts` | `interface AuthenticatedUser {   id: number;   username: string;   roles: string[];   page_size: number;   number_format: string;   date_format: string; }` |
| `AuthState` | `frontend/src/lib/auth.ts` | `frontend/src/lib/state.svelte.ts` | `interface AuthState {   token: string;   user: AuthUser; }` |
| `AuthState` | `frontend/src/lib/state.svelte.ts` | `frontend/src/lib/auth.ts` | `interface AuthState {   token: string;   user: AuthUser; }` |
| `AuthUser` | `frontend/src/lib/auth.ts` | `frontend/src/lib/state.svelte.ts` | `interface AuthUser {   id: number;   username: string;   roles: string[];   page_size: number;   number_format: string;   date_format: string; }` |
| `AuthUser` | `frontend/src/lib/state.svelte.ts` | `frontend/src/lib/auth.ts` | `interface AuthUser {   id: number;   username: string;   roles: string[];   page_size: number;   number_format: string;   date_format: string; }` |
| `AxisValues` | `backend/src/db-matrix-reports.ts` | `frontend/src/lib/matrix-api.ts` | `interface AxisValues {   Product: string[];   Category: string[];   Location: string[];   Division: string[]; }` |
| `AxisValues` | `frontend/src/lib/matrix-api.ts` | `backend/src/db-matrix-reports.ts` | `interface AxisValues {   Product: string[];   Category: string[];   Location: string[];   Division: string[]; }` |
| `BalanceSheet` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface BalanceSheet {   assets: StatementLine[];   liabilities: StatementLine[];   equity: StatementLine[];   assets_tree: CategoryTreeNode[];   liabilities_tree: CategoryTreeNode[];   equity_tree: CategoryTreeNode[];   total_assets_minor: number;   total_liabilities_minor: number;   total_equity_minor: number;   balanced: boolean; }` |
| `BalanceSheet` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface BalanceSheet {   assets: StatementLine[];   liabilities: StatementLine[];   equity: StatementLine[];   assets_tree: CategoryTreeNode[];   liabilities_tree: CategoryTreeNode[];   equity_tree: CategoryTreeNode[];   total_assets_minor: number;   total_liabilities_minor: number;   total_equity_minor: number;   balanced: boolean; }` |
| `BankAccountRow` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface BankAccountRow {   name: string;   accountnumber: string \| null;   balance_minor: number;   currency: string \| null;   overdraft_limit_minor: number \| null;   scope: string; }` |
| `BankAccountRow` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface BankAccountRow {   name: string;   accountnumber: string \| null;   balance_minor: number;   currency: string \| null;   overdraft_limit_minor: number \| null;   scope: string; }` |
| `BelowReorderRow` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface BelowReorderRow {   item: string;   location: string;   quantity_on_hand: number;   reorder_level: number;   min_level: number \| null;   max_level: number \| null; }` |
| `BelowReorderRow` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface BelowReorderRow {   item: string;   location: string;   quantity_on_hand: number;   reorder_level: number;   min_level: number \| null;   max_level: number \| null; }` |
| `BomComponent` | `frontend/src/lib/api.ts` | (none) | `type BomComponent = { component: string;` |
| `BusinessName` | `backend/src/db.ts` | `backend/src/db-matrix-reports.ts`, `backend/src/db-reports.ts`, `backend/src/db-stock.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts` | `type BusinessName = string & { readonly __brand: 'BusinessName' };` |
| `BusinessName` | `frontend/src/lib/api.ts` | `backend/src/db-matrix-reports.ts`, `backend/src/db-reports.ts`, `backend/src/db-stock.ts`, `backend/src/db.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts` | `type BusinessName = string & { readonly __brand: 'BusinessName' };` |
| `BusinessTypeInfo` | `backend/src/db.ts` | (none) | `interface BusinessTypeInfo {   name: string;   questions: string[]; }` |
| `CashFlowForecast` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface CashFlowForecast {   as_of_date: string;   horizon_end_date: string;   starting_cash_minor: number;   overdraft_limit_minor: number \| null;   lines: ForecastLine[];   ending_cash_minor: number;   lowest_projected_balance_minor: number;   lowest_balance_date: string;   first_shortfall_date: string \| null;   first_shortfall_amount_minor: number \| null; }` |
| `CashFlowForecast` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface CashFlowForecast {   as_of_date: string;   horizon_end_date: string;   starting_cash_minor: number;   overdraft_limit_minor: number \| null;   lines: ForecastLine[];   ending_cash_minor: number;   lowest_projected_balance_minor: number;   lowest_balance_date: string;   first_shortfall_date: string \| null;   first_shortfall_amount_minor: number \| null; }` |
| `CashPositionByCurrency` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface CashPositionByCurrency {   currency: string \| null;   total_balance_minor: number;   total_overdraft_limit_minor: number \| null;   headroom_minor: number \| null; }` |
| `CashPositionByCurrency` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface CashPositionByCurrency {   currency: string \| null;   total_balance_minor: number;   total_overdraft_limit_minor: number \| null;   headroom_minor: number \| null; }` |
| `CashPurchaseInput` | `backend/src/db.ts` | (none) | `interface CashPurchaseInput {   business: BusinessName;   ledger: LedgerName;   locationName: LocationName;   vendorName: VendorName;   lines: CashPurchaseLineInput[];   taxAccount: AccountName;   paymentMethod?: string;   transdate?: string; }` |
| `CashPurchaseLineInput` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface CashPurchaseLineInput {   itemName: string;   quantity: number;   unitPriceMinor: number;   taxMinor: number; }` |
| `CashPurchaseLineInput` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface CashPurchaseLineInput {   itemName: ItemName;   quantity: number;   unitPriceMinor: number;   taxMinor: number; }` |
| `CashPurchaseResult` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface CashPurchaseResult {   invoiceId: number;   reference: string;   totalMinor: number; }` |
| `CashPurchaseResult` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface CashPurchaseResult {   invoiceId: number;   reference: string;   totalMinor: number; }` |
| `CategoryTreeNode` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface CategoryTreeNode {   name: string;   accountnumber: string \| null;   is_leaf: boolean;   debit_minor: number;   credit_minor: number;   is_contra: boolean;   children: CategoryTreeNode[]; }` |
| `CategoryTreeNode` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface CategoryTreeNode {   name: string;   accountnumber: string \| null;   is_leaf: boolean;   debit_minor: number;   credit_minor: number;   is_contra: boolean;   children: CategoryTreeNode[]; }` |
| `ChartRow` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface ChartRow {   id: number;   name: string;   depth: number;   path: string;   accountnumber: string \| null;   balance_minor: number \| null; }` |
| `ChartRow` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface ChartRow {   id: number;   name: string;   depth: number;   path: string;   accountnumber: string \| null;   balance_minor: number \| null; }` |
| `CloseBooksLine` | `backend/src/db-reports.ts` | (none) | `interface CloseBooksLine {   account: string;   accountId?: number;   amount_minor: number;   division?: string; }` |
| `CloseBooksPreview` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface CloseBooksPreview {   lines: CloseBooksLine[];   netIncomeMinor: number;   accountsZeroed: number;   divisionBreakdown: { division: string \| null; netIncomeMinor: number }[]; }` |
| `CloseBooksPreview` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface CloseBooksPreview {   lines: { account: AccountName; amount_minor: number; division?: string }[];   netIncomeMinor: number;   accountsZeroed: number;   divisionBreakdown: { division: DivisionName \| null; netIncomeMinor: number }[]; }` |
| `CloseBooksResult` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface CloseBooksResult {   reference: string;   netIncomeMinor: number;   accountsZeroed: number;   divisionBreakdown: { division: string \| null; netIncomeMinor: number }[]; }` |
| `CloseBooksResult` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface CloseBooksResult {   reference: string;   netIncomeMinor: number;   accountsZeroed: number;   divisionBreakdown: { division: DivisionName \| null; netIncomeMinor: number }[]; }` |
| `ConceptWithAlternates` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface ConceptWithAlternates {   headerAccountName: string;   alternates: string[];   defaultAlternate: string; }` |
| `ConceptWithAlternates` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface ConceptWithAlternates {   headerAccountName: string;   alternates: string[];   defaultAlternate: string; }` |
| `Contact` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `frontend/src/lib/api.ts` | `interface Contact {   person_name: string \| null;   phone: string \| null;   email: string \| null;   address_line1: string \| null;   address_line2: string \| null;   city: string \| null;   region: string \| null;   postal_code: string \| null;   country: string \| null;   payment_terms_days: number \| null;   credit_limit_minor: number \| null;   wage_minor_per_hour: number \| null;   salary_minor_per_year: number \| null;   reminder_level: number;   preferred_language: string \| null;   verification_status: 'pending' \| 'active' \| 'rejected' \| null;   card_label: string \| null;   pos_pin: string \| null; }` |
| `Contact` | `frontend/src/lib/api.ts` | `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/db.ts` | `interface Contact {   phone: string \| null;   email: string \| null;   address_line1: string \| null;   address_line2: string \| null;   city: string \| null;   region: string \| null;   postal_code: string \| null;   country: string \| null;   payment_terms_days: number \| null;   credit_limit_minor: number \| null;   wage_minor_per_hour: number \| null;   salary_minor_per_year: number \| null;   reminder_level: number;   preferred_language: string \| null; }` |
| `ContactPerson` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface ContactPerson {   contact_type: string;   record_name: string;   name: string \| null;   phone: string \| null;   email: string \| null; }` |
| `ContactPerson` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface ContactPerson {   contact_type: string;   record_name: string;   name: string \| null;   phone: string \| null;   email: string \| null; }` |
| `CreditStatus` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface CreditStatus {   balanceMinor: number;   limitMinor: number \| null;   overLimit: boolean;   remainingMinor: number \| null; }` |
| `CreditStatus` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface CreditStatus {   balanceMinor: number;   limitMinor: number \| null;   overLimit: boolean;   remainingMinor: number \| null; }` |
| `CustomerName` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `type CustomerName = string & { readonly __brand: 'CustomerName' };` |
| `CustomerName` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `type CustomerName = string & { readonly __brand: 'CustomerName' };` |
| `CustomerRegistrationInput` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface CustomerRegistrationInput {   name: string;   email: string;   phone?: string \| null;   address_line1?: string \| null;   address_line2?: string \| null;   city?: string \| null;   region?: string \| null;   postal_code?: string \| null;   country?: string \| null;   preferred_language?: string \| null;   password: string;   card_label?: string \| null; }` |
| `CustomerRegistrationInput` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface CustomerRegistrationInput {   name: string;   email: string;   phone?: string \| null;   address_line1?: string \| null;   address_line2?: string \| null;   city?: string \| null;   region?: string \| null;   postal_code?: string \| null;   country?: string \| null;   preferred_language?: string \| null;   password: string;   card_label?: string \| null; }` |
| `CustomerStatement` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface CustomerStatement {   customer: string;   as_of_date: string;   lines: StatementLine[];   total_outstanding_minor: number; }` |
| `CustomerStatement` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface CustomerStatement {   customer: string;   as_of_date: string;   lines: StatementLine[];   total_outstanding_minor: number; }` |
| `DemoCategory` | `shared-fixtures/wine-retail-demo-data.ts` | (none) | `interface DemoCategory {   category: string;   subcategory: string; }` |
| `DemoLocation` | `shared-fixtures/wine-retail-demo-data.ts` | (none) | `interface DemoLocation {   name: string;   city: string;   locationType: 'Retail' \| 'Warehouse';   isBilling: boolean;   bottleCap: number \| null;   cartonCap: number \| null;   timezone: string; }` |
| `DemoProduct` | `shared-fixtures/wine-retail-demo-data.ts` | (none) | `interface DemoProduct {   name: string;   subcategory: string; }` |
| `DemoStockLevel` | `shared-fixtures/wine-retail-demo-data.ts` | (none) | `interface DemoStockLevel {   itemName: string;   locationName: string;   qty: number;   minLevel: number;   maxLevel: number;   reorderLevel: number;   shelfSide: string \| null;   rack: string \| null;   level: number \| null; }` |
| `DemoUpc` | `shared-fixtures/wine-retail-demo-data.ts` | (none) | `interface DemoUpc {   name: string;   upc: string; }` |
| `DimensionLinkPointingAt` | `frontend/src/lib/api.ts` | (none) | `interface DimensionLinkPointingAt {   entityName: string;   dimensionName: string; }` |
| `DivisionName` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `type DivisionName = string & { readonly __brand: 'DivisionName' };` |
| `DivisionName` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `type DivisionName = string & { readonly __brand: 'DivisionName' };` |
| `DivisionRecord` | `frontend/src/lib/api.ts` | (none) | `interface DivisionRecord {   id: number;   name: string;   parentName: string \| null;   centerType: string \| null; }` |
| `EInvoiceDiscrepancy` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface EInvoiceDiscrepancy {   field: string;   poValue: string;   invoiceValue: string; }` |
| `EInvoiceDiscrepancy` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface EInvoiceDiscrepancy {   field: string;   poValue: string;   invoiceValue: string; }` |
| `EmployeeClock` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface EmployeeClock {   employee: string;   po_reference: string;   project_expense_account: string;   clocked_in_at: string; }` |
| `EmployeeClock` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface EmployeeClock {   employee: string;   po_reference: string;   project_expense_account: string;   clocked_in_at: string; }` |
| `EmployeeName` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `type EmployeeName = string & { readonly __brand: 'EmployeeName' };` |
| `EmployeeName` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `type EmployeeName = string & { readonly __brand: 'EmployeeName' };` |
| `EntityHistoryRow` | `backend/src/db.ts` | (none) | `interface EntityHistoryRow {   name: string;   parent_id: number \| null;   relation_id: number \| null;   created_at: string;   created_by: number;   deleted_at: string \| null;   deleted_by: number \| null; }` |
| `EntityId` | `backend/src/db.ts` | (none) | `type EntityId = number & { readonly __brand: 'EntityId' };` |
| `EntityNode` | `backend/src/db.ts` | `backend/src/primitives.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/entityTree.ts`, `frontend/src/lib/treeAdapter.ts` | `interface EntityNode {   id: number;   name: string;   parent_id: number \| null;   relation_id: number \| null;   accountnumber: string \| null;   balance_minor: number \| null;   currency: string \| null; }` |
| `EntityNode` | `frontend/src/lib/api.ts` | `backend/src/db.ts`, `backend/src/primitives.ts`, `frontend/src/lib/entityTree.ts`, `frontend/src/lib/treeAdapter.ts` | `interface EntityNode {   id: number;   name: string;   parent_id: number \| null;   relation_id: number \| null;   accountnumber: string \| null;   balance_minor: number \| null;   currency: string \| null;   depth: number;   is_postable_account: boolean; }` |
| `EntityStructure` | `backend/src/db.ts` | (none) | `type EntityStructure = 'sole_trader' \| 'partnership' \| 'llc' \| 'unlimited_liability' \| 'publicly_traded';` |
| `EntityUpdate` | `backend/src/db.ts` | (none) | `interface EntityUpdate {   name?: string;   parent?: string \| null;   relation?: string \| null;   relationId?: number;   accountnumber?: string \| null; }` |
| `ExpiringLot` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface ExpiringLot {   item: string;   lot_number: string;   expiration_date: string;   quantity_on_hand: number;   days_until_expiration: number; }` |
| `ExpiringLot` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface ExpiringLot {   item: string;   lot_number: string;   expiration_date: string;   quantity_on_hand: number;   days_until_expiration: number; }` |
| `ForecastLine` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface ForecastLine {   date: string;   description: string;   amount_minor: number; // positive = real, anticipated cash in; negative = real, anticipated cash out   source: 'AR' \| 'AP' \| 'recurring'; }` |
| `ForecastLine` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface ForecastLine {   date: string;   description: string;   amount_minor: number;   source: 'AR' \| 'AP' \| 'recurring'; }` |
| `HierarchyChainNode` | `backend/src/db.ts` | (none) | `interface HierarchyChainNode {   readonly id: EntityId;   readonly name: string; }` |
| `HierarchyGroupingWithValues` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface HierarchyGroupingWithValues {   grouping: string;   values: string[]; }` |
| `HierarchyGroupingWithValues` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface HierarchyGroupingWithValues {   grouping: string;   values: string[]; }` |
| `HierarchyNode` | `backend/src/db.ts` | (none) | `interface HierarchyNode {   id: number;   name: string;   children: HierarchyNode[]; }` |
| `HierarchyTreeNode` | `backend/src/primitives.ts` | `backend/src/db-reports.ts` | `interface HierarchyTreeNode {   name: string;   accountId: number \| null;   own: Record<string, number>;   total: Record<string, number>;   children: HierarchyTreeNode[]; }` |
| `HistoryLine` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface HistoryLine {   invoice_reference: string;   invoice_date: string;   document_type: 'invoice' \| 'credit_note' \| 'debit_memo';   description: string;   quantity: number \| null;   unit_price_minor: number \| null;   amount_minor: number; }` |
| `HistoryLine` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface HistoryLine {   invoice_reference: string;   invoice_date: string;   document_type: 'invoice' \| 'credit_note' \| 'debit_memo';   description: string;   quantity: number \| null;   unit_price_minor: number \| null;   amount_minor: number; }` |
| `ImportEInvoiceResult` | `frontend/src/lib/api.ts` | (none) | `interface ImportEInvoiceResult {   invoiceId: number;   discrepancies: EInvoiceDiscrepancy[]; }` |
| `Invoice` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `backend/src/invoice.ts`, `frontend/src/lib/api.ts` | `interface Invoice {   id: number;   invoice_type: 'AR' \| 'AP';   document_type: 'invoice' \| 'credit_note' \| 'debit_memo';   references_invoice_id: number \| null;   business: string;   ledger: string;   reference: string;   counterparty: string;   invoice_date: string;   due_date: string \| null;   description: string;   status: 'draft' \| 'posted' \| 'void';   posted_by: string \| null;   source: 'manual' \| 'pos';   lines: (InvoiceLineInput & { id: number })[];   total_amount_minor: number;   total_tax_minor: number; }` |
| `Invoice` | `frontend/src/lib/api.ts` | `backend/src/db-seed.ts`, `backend/src/db.ts`, `backend/src/invoice.ts` | `interface Invoice {   id: number;   invoice_type: 'AR' \| 'AP';   document_type: 'invoice' \| 'credit_note' \| 'debit_memo';   references_invoice_id: number \| null;   business: BusinessName;   ledger: LedgerName;   reference: string;   counterparty: string;   invoice_date: string;   due_date: string \| null;   description: string;   status: 'draft' \| 'posted' \| 'void';   posted_by: string \| null;   source: 'manual' \| 'pos';   lines: (InvoiceLine & { id: number })[];   total_amount_minor: number;   total_tax_minor: number; }` |
| `InvoiceInput` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface InvoiceInput {   invoiceType: 'AR' \| 'AP';   documentType?: 'invoice' \| 'credit_note' \| 'debit_memo';   referencesInvoiceId?: number \| null;   business: string;   ledger: string;   reference: string;   counterpartyName: string;   invoiceDate: string;   description?: string;   lines: InvoiceLineInput[];   source?: 'manual' \| 'pos'; }` |
| `InvoiceInput` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface InvoiceInput {   invoiceType: 'AR' \| 'AP';   documentType?: 'invoice' \| 'credit_note' \| 'debit_memo';   referencesInvoiceId?: number \| null;   business: BusinessName;   ledger: LedgerName;   reference: string;   counterpartyName: string;   invoiceDate: string;   description?: string;   lines: InvoiceLine[]; }` |
| `InvoiceLine` | `backend/src/db.ts` | `backend/src/invoice.ts`, `frontend/src/lib/api.ts` | `interface InvoiceLine {   reference: string;   description: string;   quantity: number \| null;   unit_price_minor: number \| null;   amount_minor: number;   tax_minor: number; }` |
| `InvoiceLine` | `frontend/src/lib/api.ts` | `backend/src/db.ts`, `backend/src/invoice.ts` | `interface InvoiceLine {   id?: number;   description: string;   quantity?: number \| null;   unitPriceMinor?: number \| null;   amountMinor: number;   taxMinor?: number;   itemName?: string \| null;   dispatchReference?: string \| null; }` |
| `InvoiceLineInput` | `backend/src/db.ts` | (none) | `interface InvoiceLineInput {   description: string;   quantity?: number \| null;   unitPriceMinor?: number \| null;   amountMinor: number;   taxMinor?: number;   itemName?: string \| null;   dispatchReference?: string \| null; }` |
| `InvoiceOptions` | `backend/src/invoice.ts` | (none) | `interface InvoiceOptions {   invoiceReference: string; // the display reference for the whole document   customerName: string;   date: string;   postedBy: string;   lineReferences: string[]; // the underlying posting references that make up this invoice   business: string;   ledger: string; }` |
| `Item` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/entityTree.ts` | `interface Item {   description: string \| null;   unit_of_measure: string \| null;   upc: string \| null;   retail_price_minor: number \| null; }` |
| `Item` | `frontend/src/lib/api.ts` | `backend/src/db-seed.ts`, `backend/src/db.ts`, `frontend/src/lib/entityTree.ts` | `interface Item {   description: string \| null;   unit_of_measure: string \| null;   upc: string \| null; }` |
| `ItemLocationLevels` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface ItemLocationLevels {   quantity_on_hand: number;   min_level: number \| null;   max_level: number \| null;   reorder_level: number \| null;   shelf_side: string \| null;   rack: string \| null;   level: number \| null; }` |
| `ItemLocationLevels` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface ItemLocationLevels {   quantity_on_hand: number;   min_level: number \| null;   max_level: number \| null;   reorder_level: number \| null;   shelf_side: string \| null;   rack: string \| null;   level: number \| null; }` |
| `ItemName` | `backend/src/db.ts` | `backend/src/db-stock.ts`, `frontend/src/lib/api.ts` | `type ItemName = string & { readonly __brand: 'ItemName' };` |
| `ItemName` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts`, `backend/src/db.ts` | `type ItemName = string & { readonly __brand: 'ItemName' };` |
| `ItemSource` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface ItemSource {   id: number;   item_id: number;   item_name: string;   manufacturer_id: number \| null;   manufacturer_name: string \| null;   vendor_id: number;   vendor_name: string;   vendor_sku: string \| null;   vendor_upc: string \| null;   price_minor: number \| null;   package_quantity: number \| null;   is_preferred: boolean;   preference_notes: string \| null; }` |
| `ItemSource` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface ItemSource {   id: number;   item_id: number;   item_name: string;   manufacturer_id: number \| null;   manufacturer_name: string \| null;   vendor_id: number;   vendor_name: string;   vendor_sku: string \| null;   vendor_upc: string \| null;   price_minor: number \| null;   package_quantity: number \| null;   is_preferred: boolean;   preference_notes: string \| null; }` |
| `ItemSourceInput` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface ItemSourceInput {   itemName: string;   manufacturerName?: string \| null;   vendorName: string;   vendorSku?: string \| null;   vendorUpc?: string \| null;   priceMinor?: number \| null;   packageQuantity?: number \| null;   isPreferred?: boolean;   preferenceNotes?: string \| null;   currency?: string \| null;   productInstanceId?: number; }` |
| `ItemSourceInput` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface ItemSourceInput {   manufacturerName?: string \| null;   vendorName: VendorName;   vendorSku?: string \| null;   vendorUpc?: string \| null;   priceMinor?: number \| null;   packageQuantity?: number \| null;   isPreferred?: boolean;   preferenceNotes?: string \| null; }` |
| `ItemSummary` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface ItemSummary {   name: string;   description: string \| null;   unit_of_measure: string \| null;   upc: string \| null;   retail_price_minor: number \| null;   source_count: number;   storage_origin: 'Hot' \| 'Cold' \| null;   product: string \| null; }` |
| `ItemSummary` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface ItemSummary {   name: string;   description: string \| null;   unit_of_measure: string \| null;   upc: string \| null;   retail_price_minor: number \| null;   source_count: number;   storage_origin: 'Hot' \| 'Cold' \| null;   product: string \| null;   combinationValues?: string[];   combinationShape?: [string, string][]; }` |
| `JournalSummary` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface JournalSummary {   journal_id: number;   occurrence_date: string \| null;   reference: string;   description: string;   business: string;   ledger: string;   recurrence: string;   posted_by: string;   total_debit_minor: number;   total_credit_minor: number; }` |
| `JournalSummary` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface JournalSummary {   journal_id: number;   occurrence_date: string \| null;   reference: string;   description: string;   business: BusinessName;   ledger: LedgerName;   recurrence: string;   total_debit_minor: number;   total_credit_minor: number; }` |
| `LedgerDateRange` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface LedgerDateRange {   earliest: string \| null;   latest: string \| null; }` |
| `LedgerDateRange` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface LedgerDateRange {   earliest: string \| null;   latest: string \| null; }` |
| `LedgerName` | `backend/src/db.ts` | `backend/src/db-matrix-reports.ts`, `backend/src/db-reports.ts`, `backend/src/db-stock.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts` | `type LedgerName = string & { readonly __brand: 'LedgerName' };` |
| `LedgerName` | `frontend/src/lib/api.ts` | `backend/src/db-matrix-reports.ts`, `backend/src/db-reports.ts`, `backend/src/db-stock.ts`, `backend/src/db.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts` | `type LedgerName = string & { readonly __brand: 'LedgerName' };` |
| `ListInvoicesOptions` | `backend/src/db.ts` | (none) | `interface ListInvoicesOptions {   invoiceType?: 'AR' \| 'AP';   source?: 'manual' \| 'pos' \| 'all';   limit?: number;   offset?: number; }` |
| `Location` | `backend/src/db-stock.ts` | `backend/src/db-matrix-reports.ts`, `backend/src/db-reports.ts`, `backend/src/db-seed.ts`, `backend/src/db.ts`, `frontend/src/lib/matrix-api.ts` | `interface Location {   city: string;   location_type: string;   is_billing_address: boolean;   bottle_capacity: number \| null;   carton_capacity: number \| null;   timezone: string; }` |
| `LocationCapacityStatus` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface LocationCapacityStatus {   bottleQuantity: number;   bottleCapacity: number \| null;   bottleOverCapacity: boolean;   cartonQuantity: number;   cartonCapacity: number \| null;   cartonOverCapacity: boolean; }` |
| `LocationCapacityStatus` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface LocationCapacityStatus {   bottleQuantity: number;   bottleCapacity: number \| null;   bottleOverCapacity: boolean;   cartonQuantity: number;   cartonCapacity: number \| null;   cartonOverCapacity: boolean; }` |
| `LocationInput` | `frontend/src/lib/api.ts` | (none) | `interface LocationInput {   city: string;   location_type: string;   is_billing_address: boolean;   bottle_capacity?: number \| null;   carton_capacity?: number \| null;   timezone: string; }` |
| `LocationName` | `backend/src/db.ts` | `backend/src/db-matrix-reports.ts`, `backend/src/db-stock.ts`, `frontend/src/lib/api.ts` | `type LocationName = string & { readonly __brand: 'LocationName' };` |
| `LocationName` | `frontend/src/lib/api.ts` | `backend/src/db-matrix-reports.ts`, `backend/src/db-stock.ts`, `backend/src/db.ts` | `type LocationName = string & { readonly __brand: 'LocationName' };` |
| `LoginResponse` | `frontend/src/lib/api.ts` | (none) | `interface LoginResponse {   token: string;   user: { id: number; username: string; roles: string[]; page_size: number; number_format: string; date_format: string }; }` |
| `MatrixAxis` | `backend/src/db-matrix-reports.ts` | `frontend/src/lib/matrix-api.ts` | `type MatrixAxis = 'Product' \| 'Category' \| 'Location' \| 'Division' \| 'Consolidated' \| (string & {});` |
| `MatrixAxis` | `frontend/src/lib/matrix-api.ts` | `backend/src/db-matrix-reports.ts` | `type MatrixAxis = 'Product' \| 'Category' \| 'Location' \| 'Division' \| 'Consolidated';` |
| `MatrixCell` | `backend/src/db-matrix-reports.ts` | `frontend/src/lib/matrix-api.ts` | `interface MatrixCell {   rowKey: string;   colKey: string;   salesMinor: number;   cogsMinor: number; }` |
| `MatrixCell` | `frontend/src/lib/matrix-api.ts` | `backend/src/db-matrix-reports.ts` | `interface MatrixCell {   rowKey: string;   colKey: string;   salesMinor: number;   cogsMinor: number; }` |
| `MenuLinkRow` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface MenuLinkRow {   key: string;   href: string;   label: string;   notImplemented: boolean;   isSubheading: boolean;   requiredRoles: string[] \| null;   hidden: boolean; }` |
| `MenuLinkRow` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface MenuLinkRow {   key: string;   href: string;   label: string;   notImplemented: boolean;   isSubheading: boolean;   requiredRoles: string[] \| null; }` |
| `MenuSectionRow` | `backend/src/db.ts` | `frontend/src/lib/api.ts`, `frontend/src/lib/state.svelte.ts` | `interface MenuSectionRow {   key: string;   label: string;   hidden: boolean;   links: MenuLinkRow[]; }` |
| `MenuSectionRow` | `frontend/src/lib/api.ts` | `backend/src/db.ts`, `frontend/src/lib/state.svelte.ts` | `interface MenuSectionRow {   key: string;   label: string;   links: MenuLinkRow[]; }` |
| `NewEntity` | `backend/src/db.ts` | (none) | `interface NewEntity {   name: string;   parent?: string \| null;   parentId?: number \| null;   relation?: string \| null;   accountnumber?: string \| null; }` |
| `OpenHoursLine` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface OpenHoursLine {   day: string;   opens_at: string;   closes_at: string; }` |
| `OpenHoursLine` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface OpenHoursLine {   day: string;   opens_at: string;   closes_at: string; }` |
| `OrganizationChart` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface OrganizationChart {   business: string;   companyWideEmployees: string[]; // "Place of Employment" points straight at the business itself   divisions: OrgChartDivision[]; }` |
| `OrganizationChart` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface OrganizationChart {   business: BusinessName;   companyWideEmployees: string[];   divisions: { division: DivisionName; locations: { location: string; employees: string[] }[] }[]; }` |
| `OrgChartDivision` | `backend/src/db.ts` | (none) | `interface OrgChartDivision {   division: string;   locations: { location: string; employees: string[] }[]; }` |
| `PayEmployeeWagesInput` | `backend/src/db.ts` | (none) | `interface PayEmployeeWagesInput {   business: string;   ledger: string;   employeeName: string;   hours?: number;   wagesExpenseAccount?: string;   paymentMethod?: string;   transdate?: string; }` |
| `PayEmployeeWagesResult` | `backend/src/db.ts` | (none) | `interface PayEmployeeWagesResult {   invoiceId: number;   reference: string;   grossMinor: number;   medicareLevyMinor: number;   superannuationMinor: number;   netMinor: number; }` |
| `PayWagesResult` | `frontend/src/lib/api.ts` | (none) | `interface PayWagesResult {   invoiceId: number;   reference: string;   grossMinor: number;   medicareLevyMinor: number;   superannuationMinor: number;   netMinor: number; }` |
| `PendingCustomer` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface PendingCustomer {   name: string;   email: string \| null;   phone: string \| null;   card_label: string \| null; }` |
| `PendingCustomer` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface PendingCustomer {   name: string;   email: string \| null;   phone: string \| null;   card_label: string \| null; }` |
| `PeriodLockStatus` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface PeriodLockStatus {   locked_through_date: string \| null;   changed_by: number \| null;   changed_at: string \| null; }` |
| `PeriodLockStatus` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface PeriodLockStatus {   locked_through_date: string \| null;   changed_by: number \| null;   changed_at: string \| null; }` |
| `PickingListLine` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface PickingListLine {   invoiceLineId: number;   item: string;   quantity: number;   shelfSide: string \| null;   rack: string \| null;   level: number \| null;   picked: boolean; }` |
| `PickingListLine` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface PickingListLine {   invoiceLineId: number;   item: string;   quantity: number;   shelfSide: string \| null;   rack: string \| null;   level: number \| null;   picked: boolean; }` |
| `PosSaleInput` | `backend/src/db.ts` | (none) | `interface PosSaleInput {   business: BusinessName;   ledger: LedgerName;   locationName: LocationName;   customerName: CustomerName;   lines: PosSaleLineInput[];   revenueAccount?: AccountName;   taxAccount: AccountName;   paymentMethod?: string;   cashTenderedMinor?: number;   transdate?: string;   terminalName?: string; }` |
| `PosSaleLineInput` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface PosSaleLineInput {   itemName: string;   quantity: number;   unitPriceMinor?: number;   taxMinor: number;   tier?: string;   combinationValues?: string[];   combinationShape?: [string, string][]; }` |
| `PosSaleLineInput` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface PosSaleLineInput {   itemName: ItemName;   quantity: number;   unitPriceMinor?: number;   taxMinor: number;   tier?: string;   combinationValues?: string[];   combinationShape?: [string, string][]; }` |
| `PosSaleResult` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface PosSaleResult {   invoiceId: number;   reference: string;   totalMinor: number;   changeDueMinor: number; }` |
| `PosSaleResult` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface PosSaleResult {   invoiceId: number;   reference: string;   totalMinor: number;   changeDueMinor: number; }` |
| `PosShift` | `backend/src/db.ts` | (none) | `interface PosShift {   id: number;   employee: string;   location: string;   signed_on_at: string;   signed_off_at: string \| null; }` |
| `ProductSummary` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface ProductSummary {   name: string;   itemCount: number; }` |
| `ProductSummary` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface ProductSummary {   name: string;   itemCount: number; }` |
| `ProfitAndLoss` | `backend/src/db-reports.ts` | `backend/src/db-matrix-reports.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/matrix-api.ts` | `interface ProfitAndLoss {   income: StatementLine[];   expenses: StatementLine[];   cogs_expenses: StatementLine[];   operating_expenses: StatementLine[];   income_tree: CategoryTreeNode[];   cogs_tree: CategoryTreeNode[];   operating_expenses_tree: CategoryTreeNode[];   total_income_minor: number;   total_expenses_minor: number;   gross_profit_minor: number;   net_income_minor: number; }` |
| `ProfitAndLoss` | `frontend/src/lib/api.ts` | `backend/src/db-matrix-reports.ts`, `backend/src/db-reports.ts`, `frontend/src/lib/matrix-api.ts` | `interface ProfitAndLoss {   income: StatementLine[];   expenses: StatementLine[];   cogs_expenses: StatementLine[];   operating_expenses: StatementLine[];   income_tree: CategoryTreeNode[];   cogs_tree: CategoryTreeNode[];   operating_expenses_tree: CategoryTreeNode[];   total_income_minor: number;   total_expenses_minor: number;   gross_profit_minor: number;   net_income_minor: number; }` |
| `ProfitAndLossByAxisNode` | `backend/src/db-matrix-reports.ts` | `frontend/src/lib/matrix-api.ts` | `interface ProfitAndLossByAxisNode {   key: string;   profitAndLoss: ProfitAndLoss;   children: ProfitAndLossByAxisNode[]; }` |
| `ProfitAndLossByAxisNode` | `frontend/src/lib/matrix-api.ts` | `backend/src/db-matrix-reports.ts` | `interface ProfitAndLossByAxisNode {   key: string;   profitAndLoss: ProfitAndLoss;   children: ProfitAndLossByAxisNode[]; }` |
| `ProfitAndLossByDivision` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface ProfitAndLossByDivision {   division: string \| null;   profitAndLoss: ProfitAndLoss; }` |
| `ProfitAndLossByDivision` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface ProfitAndLossByDivision {   division: DivisionName \| null;   profitAndLoss: ProfitAndLoss; }` |
| `ProfitAndLossComparison` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface ProfitAndLossComparison {   ledgerA: LedgerName;   ledgerB: LedgerName;   income: ProfitAndLossComparisonLine[];   expenses: ProfitAndLossComparisonLine[];   a_total_income_minor: number;   b_total_income_minor: number;   a_total_expenses_minor: number;   b_total_expenses_minor: number;   a_net_income_minor: number;   b_net_income_minor: number;   net_income_variance_minor: number; }` |
| `ProfitAndLossComparison` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface ProfitAndLossComparison {   ledgerA: string;   ledgerB: string;   income: ProfitAndLossComparisonLine[];   expenses: ProfitAndLossComparisonLine[];   a_total_income_minor: number;   b_total_income_minor: number;   a_total_expenses_minor: number;   b_total_expenses_minor: number;   a_net_income_minor: number;   b_net_income_minor: number;   net_income_variance_minor: number; }` |
| `ProfitAndLossComparisonLine` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface ProfitAndLossComparisonLine {   name: string;   accountnumber: string \| null;   a_minor: number;   b_minor: number;   variance_minor: number; }` |
| `ProfitAndLossComparisonLine` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface ProfitAndLossComparisonLine {   name: string;   accountnumber: string \| null;   a_minor: number;   b_minor: number;   variance_minor: number; }` |
| `PurchaseOrderInput` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface PurchaseOrderInput {   reference: string;   business: string;   ledger: string;   vendor: string;   item: string;   quantity: number;   price_minor: number;   location?: string; // real, direct delivery instructions: where this order should arrive   transdate?: string;   description?: string; }` |
| `PurchaseOrderInput` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface PurchaseOrderInput {   reference: string;   business: BusinessName;   ledger: LedgerName;   vendor: string;   item: string;   quantity: number;   price_minor: number;   location?: string;   transdate?: string;   description?: string; }` |
| `Recurrence` | `backend/src/db.ts` | `shared-fixtures/add-journal-translations.ts`, `backend/src/db-seed.ts` | `type Recurrence = 'once' \| 'weekly' \| 'monthly' \| 'yearly';` |
| `RecurringJournalLine` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface RecurringJournalLine {   account: string;   amount_minor: number; // positive = debit, negative = credit   memo?: string;   effective_date?: string; // defaults to the journal's own start date if omitted }` |
| `RecurringJournalLine` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface RecurringJournalLine {   account: AccountName;   amount_minor: number;   memo?: string;   effective_date?: string; }` |
| `Relationship` | `backend/src/db.ts` | (none) | `interface Relationship {   type: string;   target: string; }` |
| `ReminderCandidate` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface ReminderCandidate {   counterparty: string;   current_level: number;   next_level: number;   outstanding_minor: number;   oldest_days_overdue: number; }` |
| `ReminderCandidate` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface ReminderCandidate {   counterparty: string;   current_level: number;   next_level: number;   outstanding_minor: number;   oldest_days_overdue: number; }` |
| `ReportRow` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface ReportRow {   report: string;   category: string;   account: string;   account_id: number;   depth: number;   combination_ids: string \| null;   accountnumber: string \| null;   balance_minor: number \| null; }` |
| `ReportRow` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface ReportRow {   report: string;   category: string;   account: AccountName;   depth: number;   accountnumber: string \| null;   balance_minor: number \| null; }` |
| `RestockLineInput` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface RestockLineInput {   item: string;   quantity: number; }` |
| `RestockLineInput` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface RestockLineInput {   item: string;   quantity: number; }` |
| `Row` | `frontend/src/lib/journalGrid.ts` | (none) | `interface Row {   account: string;   debit: string; // kept as the raw text the person typed, not a number,   credit: string; // so "12.5" vs "12.50" vs an empty field are distinct   memo: string; }` |
| `RuntimeDatabase` | `backend/src/sqlite-runtime.ts` | (none) | `interface RuntimeDatabase {   exec(sql: string): void;   prepare(sql: string): RuntimeStatement;   transaction<T extends (...args: never[]) => unknown>(fn: T): (...args: Parameters<T>) => ReturnType<T>;   close(): void; }` |
| `RuntimeStatement` | `backend/src/sqlite-runtime.ts` | (none) | `interface RuntimeStatement {   get(...params: unknown[]): unknown;   all(...params: unknown[]): unknown[];   run(...params: unknown[]): { changes: number \| bigint; lastInsertRowid: number \| bigint }; }` |
| `SalesCategorySummary` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface SalesCategorySummary {   category: string;   quantity: number;   amount_minor: number; }` |
| `SalesCategorySummary` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface SalesCategorySummary {   category: string;   quantity: number;   amount_minor: number; }` |
| `SalesCogsMatrix` | `backend/src/db-matrix-reports.ts` | `frontend/src/lib/matrix-api.ts` | `interface SalesCogsMatrix {   rowAxis: MatrixAxis;   colAxis: MatrixAxis;   cells: MatrixCell[];   totalSalesMinor: number;   totalCogsMinor: number; }` |
| `SalesCogsMatrix` | `frontend/src/lib/matrix-api.ts` | `backend/src/db-matrix-reports.ts` | `interface SalesCogsMatrix {   rowAxis: MatrixAxis;   colAxis: MatrixAxis;   cells: MatrixCell[];   totalSalesMinor: number;   totalCogsMinor: number; }` |
| `SalesOrderInput` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface SalesOrderInput {   reference: string;   business: string;   ledger: string;   customer: string;   item: string;   quantity: number;   price_minor: number;   location?: string; // real, direct dispatch instructions: where this order should ship from   transdate?: string;   description?: string; }` |
| `SalesOrderInput` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface SalesOrderInput {   reference: string;   business: BusinessName;   ledger: LedgerName;   customer: string;   item: string;   quantity: number;   price_minor: number;   location?: string;   transdate?: string;   description?: string; }` |
| `SalesReport` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface SalesReport {   detailed: SalesReportLine[];   category_summary: SalesCategorySummary[];   total_quantity: number;   total_amount_minor: number; }` |
| `SalesReport` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface SalesReport {   detailed: SalesReportLine[];   category_summary: SalesCategorySummary[];   total_quantity: number;   total_amount_minor: number; }` |
| `SalesReportLine` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface SalesReportLine {   invoice_date: string;   reference: string;   item_name: string \| null;   description: string;   quantity: number \| null;   unit_price_minor: number \| null;   amount_minor: number; }` |
| `SalesReportLine` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface SalesReportLine {   invoice_date: string;   reference: string;   item_name: string \| null;   description: string;   quantity: number \| null;   unit_price_minor: number \| null;   amount_minor: number; }` |
| `ScheduleLine` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface ScheduleLine {   day: string;   starts_at: string;   ends_at: string; }` |
| `ScheduleLine` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface ScheduleLine {   day: string;   starts_at: string;   ends_at: string; }` |
| `SessionContext` | `frontend/src/lib/session.ts` | `frontend/src/lib/state.svelte.ts` | `interface SessionContext {   businessId: number;   businessName: BusinessName;   ledgerId: number;   ledgerName: LedgerName;   languageId: number;   languageName: string; }` |
| `SessionContext` | `frontend/src/lib/state.svelte.ts` | `frontend/src/lib/session.ts` | `interface SessionContext {   businessId: number;   businessName: BusinessName;   ledgerId: number;   ledgerName: LedgerName;   languageId: number;   languageName: string; }` |
| `StagedLine` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface StagedLine {   reference: string;   business: BusinessName;   ledger: LedgerName;   description?: string;   transdate?: string;   account: AccountName;   accountId?: number;   amount_minor: number;   memo?: string;   division?: DivisionName;   bankReference?: string; }` |
| `StagedLine` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface StagedLine {   reference: string;   business: BusinessName;   ledger: LedgerName;   description?: string;   transdate?: string;   account: AccountName;   amount_minor: number;   memo?: string; }` |
| `StatementLine` | `backend/src/db-reports.ts` | `backend/src/db.ts`, `frontend/src/lib/api.ts` | `interface StatementLine {   name: string;   accountnumber: string \| null;   debit_minor: number;   credit_minor: number;   is_contra: boolean; }` |
| `StatementLine` | `backend/src/db.ts` | `backend/src/db-reports.ts`, `frontend/src/lib/api.ts` | `interface StatementLine {   invoice_id: number;   reference: string;   invoice_date: string;   due_date: string \| null;   total_minor: number;   paid_minor: number;   outstanding_minor: number;   status: 'Paid' \| 'Outstanding' \| 'Partially paid'; }` |
| `StatementLine` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts`, `backend/src/db.ts` | `interface StatementLine {   name: string;   accountnumber: string \| null;   debit_minor: number;   credit_minor: number;   is_contra: boolean; }` |
| `StatementLine` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts`, `backend/src/db.ts` | `interface StatementLine {   invoice_id: number;   reference: string;   invoice_date: string;   due_date: string \| null;   total_minor: number;   paid_minor: number;   outstanding_minor: number;   status: 'Paid' \| 'Outstanding' \| 'Partially paid'; }` |
| `StockDispatchInput` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface StockDispatchInput {   reference: string;   business: string;   ledger: string;   so_reference: string;   item?: string \| null; // the batch's Value account (cost side) — omit for a service (no COGS leg)   item_qty?: string \| null; // the batch's Qty account — omit for a service (nothing physical shipped)   customer: string;   quantity: number;   unit_cost_minor?: number \| null; // omit for a service — there is no batch cost to recognize   sale_price_minor: number;   tax_minor?: number;   transdate?: string;   description?: string; }` |
| `StockDispatchInput` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface StockDispatchInput {   reference: string;   business: BusinessName;   ledger: LedgerName;   so_reference: string;   item?: string;   item_qty?: string;   customer: string;   quantity: number;   unit_cost_minor?: number;   sale_price_minor: number;   tax_minor?: number;   transdate?: string;   description?: string; }` |
| `StockListingLocationGroup` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface StockListingLocationGroup {   location: string;   city: string \| null;   division: string \| null;   rows: StockListingRow[];   total_on_hand: number;   capacity: LocationCapacityStatus; }` |
| `StockListingLocationGroup` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface StockListingLocationGroup {   location: string;   city: string \| null;   division: DivisionName \| null;   rows: StockListingRow[];   total_on_hand: number;   capacity: LocationCapacityStatus; }` |
| `StockListingRow` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface StockListingRow {   item: string;   location: string;   quantity_on_hand: number;   min_level: number \| null;   max_level: number \| null;   reorder_level: number \| null; }` |
| `StockListingRow` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface StockListingRow {   item: string;   location: string;   quantity_on_hand: number;   min_level: number \| null;   max_level: number \| null;   reorder_level: number \| null; }` |
| `StockMovementReport` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface StockMovementReport {   receipts: StockReceiptRow[];   transfers: StockTransferRow[];   sales: StockSaleRow[]; }` |
| `StockMovementReport` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface StockMovementReport {   receipts: StockReceiptRow[];   transfers: StockTransferRow[];   sales: StockSaleRow[]; }` |
| `StockMovementRow` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface StockMovementRow {   item: string;   category: string \| null;   quantity: number;   date: string; }` |
| `StockMovementRow` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface StockMovementRow {   item: string;   category: string \| null;   quantity: number;   date: string; }` |
| `StockOnHandCell` | `backend/src/db-matrix-reports.ts` | `frontend/src/lib/matrix-api.ts` | `interface StockOnHandCell {   rowKey: string;   colKey: string;   quantityBottles: number;   valueAtCostMinor: number;   lastCostMinor: number \| null;   averageCostMinor: number \| null;   realizableValueMinor: number; }` |
| `StockOnHandCell` | `frontend/src/lib/matrix-api.ts` | `backend/src/db-matrix-reports.ts` | `interface StockOnHandCell {   rowKey: string;   colKey: string;   quantityBottles: number;   valueAtCostMinor: number;   lastCostMinor: number \| null;   averageCostMinor: number \| null;   realizableValueMinor: number; }` |
| `StockOnHandMatrix` | `backend/src/db-matrix-reports.ts` | `frontend/src/lib/matrix-api.ts` | `interface StockOnHandMatrix {   rowAxis: MatrixAxis;   colAxis: MatrixAxis;   cells: StockOnHandCell[];   totalValueAtCostMinor: number;   totalRealizableValueMinor: number; }` |
| `StockOnHandMatrix` | `frontend/src/lib/matrix-api.ts` | `backend/src/db-matrix-reports.ts` | `interface StockOnHandMatrix {   rowAxis: MatrixAxis;   colAxis: MatrixAxis;   cells: StockOnHandCell[];   totalValueAtCostMinor: number;   totalRealizableValueMinor: number; }` |
| `StockOutRiskRow` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface StockOutRiskRow {   item: string;   location: string;   quantity_on_hand: number;   daily_consumption_rate: number;   days_until_stockout: number \| null;   shortest_lead_time_days: number \| null;   at_risk: boolean; }` |
| `StockOutRiskRow` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface StockOutRiskRow {   item: string;   location: string;   quantity_on_hand: number;   daily_consumption_rate: number;   days_until_stockout: number \| null;   shortest_lead_time_days: number \| null;   at_risk: boolean; }` |
| `StockReceiptInput` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface StockReceiptInput {   reference: string;   business: string;   ledger: string;   po_reference: string;   item: string; // the monetary-side account — a batch's Value account for stock, or any ordinary expense account for a service   item_qty?: string \| null; // the batch's Qty account — omit for a service (nothing physical received)   vendor: string;   quantity: number;   value_minor: number;   tax_minor?: number;   transdate?: string;   description?: string; }` |
| `StockReceiptInput` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface StockReceiptInput {   reference: string;   business: BusinessName;   ledger: LedgerName;   po_reference: string;   item: string;   item_qty?: string;   vendor: string;   quantity: number;   value_minor: number;   tax_minor?: number;   transdate?: string;   description?: string; }` |
| `StockTake` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface StockTake {   id: number;   location: string;   take_date: string;   status: 'draft' \| 'completed';   lines: StockTakeLine[]; }` |
| `StockTake` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface StockTake {   id: number;   location: string;   take_date: string;   status: 'draft' \| 'completed';   lines: StockTakeLine[]; }` |
| `StockTakeLine` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface StockTakeLine {   id: number;   item: string;   shelf_side: string \| null;   rack: string \| null;   level: number \| null;   expected_quantity: number;   counted_quantity: number \| null; }` |
| `StockTakeLine` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface StockTakeLine {   id: number;   item: string;   shelf_side: string \| null;   rack: string \| null;   level: number \| null;   expected_quantity: number;   counted_quantity: number \| null; }` |
| `TranslationRow` | `shared-fixtures/translations.ts` | (none) | `interface TranslationRow {   concept: string;   language: string;   text: string; }` |
| `TreeItem` | `frontend/src/lib/treeAdapter.ts` | (none) | `interface TreeItem {   path: string;   id: number;   name: string;   accountnumber: string \| null;   balance_minor: number \| null; }` |
| `TrialBalance` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface TrialBalance {   rows: TrialBalanceRow[];   total_debit_minor: number;   total_credit_minor: number;   by_currency: TrialBalanceCurrencySubtotal[]; }` |
| `TrialBalance` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface TrialBalance {   rows: TrialBalanceRow[];   total_debit_minor: number;   total_credit_minor: number; }` |
| `TrialBalanceComparison` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface TrialBalanceComparison {   ledgerA: LedgerName;   ledgerB: LedgerName;   rows: TrialBalanceComparisonRow[]; }` |
| `TrialBalanceComparison` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface TrialBalanceComparison {   ledgerA: string;   ledgerB: string;   rows: TrialBalanceComparisonRow[]; }` |
| `TrialBalanceComparisonRow` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface TrialBalanceComparisonRow {   id: number;   name: string;   accountnumber: string \| null;   a_debit_minor: number;   a_credit_minor: number;   b_debit_minor: number;   b_credit_minor: number; }` |
| `TrialBalanceComparisonRow` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface TrialBalanceComparisonRow {   id: number;   name: string;   accountnumber: string \| null;   a_debit_minor: number;   a_credit_minor: number;   b_debit_minor: number;   b_credit_minor: number; }` |
| `TrialBalanceCurrencySubtotal` | `backend/src/db-reports.ts` | (none) | `interface TrialBalanceCurrencySubtotal {   currency: string \| null;   total_debit_minor: number;   total_credit_minor: number;   balanced: boolean; }` |
| `TrialBalanceRow` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface TrialBalanceRow {   id: number;   name: string;   accountnumber: string \| null;   debit_minor: number;   credit_minor: number;   currency: string \| null;   has_quantity_postings: boolean; }` |
| `TrialBalanceRow` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface TrialBalanceRow {   id: number;   name: string;   accountnumber: string \| null;   debit_minor: number;   credit_minor: number; }` |
| `TypedAddress` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface TypedAddress {   address_type: string;   record_name: string;   address_line1: string \| null;   address_line2: string \| null;   city: string \| null;   region: string \| null;   postal_code: string \| null;   country: string \| null; }` |
| `TypedPhone` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface TypedPhone {   phone_type: string;   record_name: string;   phone: string \| null; }` |
| `TypedPhone` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface TypedPhone {   phone_type: string;   record_name: string;   phone: string \| null; }` |
| `UblImportLine` | `backend/src/db.ts` | (none) | `interface UblImportLine {   description: string;   quantity: number;   unitPriceMinor: number;   amountMinor: number; }` |
| `UblImportResult` | `backend/src/db.ts` | (none) | `interface UblImportResult {   reference: string;   issueDate: string;   supplierName: string;   totalMinor: number;   taxMinor: number;   lines: UblImportLine[]; }` |
| `UserId` | `backend/src/db.ts` | `backend/src/db-reports.ts`, `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/primitives.ts` | `type UserId = number & { readonly __brand: 'UserId' };` |
| `UserSummary` | `backend/src/auth.ts` | `frontend/src/lib/api.ts` | `interface UserSummary {   id: number;   username: string;   active: boolean;   roles: string[]; }` |
| `UserSummary` | `frontend/src/lib/api.ts` | `backend/src/auth.ts` | `interface UserSummary {   id: number;   username: string;   active: boolean;   roles: string[]; }` |
| `VendorName` | `backend/src/db.ts` | `backend/src/db-stock.ts`, `frontend/src/lib/api.ts` | `type VendorName = string & { readonly __brand: 'VendorName' };` |
| `VendorName` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts`, `backend/src/db.ts` | `type VendorName = string & { readonly __brand: 'VendorName' };` |
| `VocabularyWord` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface VocabularyWord {   name: string;   translations: Record<string, string>; }` |
| `VocabularyWord` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface VocabularyWord {   name: string;   translations: Record<string, string>; }` |

### Functions (363, alphabetical)

| Name | Defined in | Referenced in | Prototype |
|---|---|---|---|
| `activeRows` | `frontend/src/lib/journalGrid.ts` | (none) | `activeRows(rows: Row[]): Row[]` |
| `addOrUpdateItemSource` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `addOrUpdateItemSource(input: ItemSourceInput): void` |
| `addRow` | `frontend/src/lib/journalGrid.ts` | (none) | `addRow(rows: Row[]): Row[]` |
| `addTaskDependency` | `backend/src/db.ts` | (none) | `addTaskDependency(dependentTask: string, predecessorTask: string, dependencyType: 'finish_to_start' \| 'start_to_start' \| 'finish_to_finish' \| 'start_to_finish', userId: UserId): void` |
| `addTypedAddress` | `backend/src/db.ts` | (none) | `addTypedAddress(entityName: string, addressType: string, value: Partial<Contact>, userId: UserId): string` |
| `addTypedContactPerson` | `backend/src/db.ts` | (none) | `addTypedContactPerson(entityName: string, contactType: string, value: { name: string; phone?: string \| null; email?: string \| null }, userId: UserId): string` |
| `addTypedPhone` | `backend/src/db.ts` | (none) | `addTypedPhone(entityName: string, phoneType: string, number: string, userId: UserId): string` |
| `adjustLocationCapacity` | `backend/src/db-stock.ts` | (none) | `adjustLocationCapacity(business: BusinessName, ledger: LedgerName, locationName: LocationName, itemName: ItemName, itemQuantityDelta: number, transdate: string, userId: UserId, referenceSuffix: string): void` |
| `allocatePayment` | `backend/src/db.ts` | (none) | `allocatePayment(invoiceId: number, paymentReference: string, allocatedMinor: number, allocationDate: string, paymentAccount: string, userId: UserId, skipJournalPosting = false): void` |
| `asAccountName` | `backend/src/db.ts` | `backend/src/db-reports.ts`, `backend/src/db-stock.ts`, `backend/src/primitives.ts`, `frontend/src/lib/api.ts` | `asAccountName(name: string): AccountName` |
| `asAccountName` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts`, `backend/src/db-stock.ts`, `backend/src/db.ts`, `backend/src/primitives.ts` | `asAccountName(name: string): AccountName` |
| `asBusinessName` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/invoice.ts`, `backend/src/primitives.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts` | `asBusinessName(name: string): BusinessName` |
| `asBusinessName` | `frontend/src/lib/api.ts` | `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/db.ts`, `backend/src/invoice.ts`, `backend/src/primitives.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts` | `asBusinessName(name: string): BusinessName` |
| `asCustomerName` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `asCustomerName(name: string): CustomerName` |
| `asCustomerName` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `asCustomerName(name: string): CustomerName` |
| `asDivisionName` | `backend/src/db.ts` | `backend/src/db-reports.ts`, `frontend/src/lib/api.ts` | `asDivisionName(name: string): DivisionName` |
| `asDivisionName` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts`, `backend/src/db.ts` | `asDivisionName(name: string): DivisionName` |
| `asEmployeeName` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `asEmployeeName(name: string): EmployeeName` |
| `asEmployeeName` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `asEmployeeName(name: string): EmployeeName` |
| `asEntityId` | `backend/src/db.ts` | (none) | `asEntityId(id: number): EntityId` |
| `asItemName` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `frontend/src/lib/api.ts` | `asItemName(name: string): ItemName` |
| `asItemName` | `frontend/src/lib/api.ts` | `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/db.ts` | `asItemName(name: string): ItemName` |
| `asLedgerName` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/invoice.ts`, `backend/src/primitives.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts` | `asLedgerName(name: string): LedgerName` |
| `asLedgerName` | `frontend/src/lib/api.ts` | `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/db.ts`, `backend/src/invoice.ts`, `backend/src/primitives.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts` | `asLedgerName(name: string): LedgerName` |
| `asLocationName` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `frontend/src/lib/api.ts` | `asLocationName(name: string): LocationName` |
| `asLocationName` | `frontend/src/lib/api.ts` | `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/db.ts` | `asLocationName(name: string): LocationName` |
| `assertPeriodOpen` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `assertPeriodOpen(business: BusinessName, ledger: LedgerName, transdate: string): void` |
| `asUserId` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `backend/src/db-stock.ts` | `asUserId(id: number): UserId` |
| `asVendorName` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `asVendorName(name: string): VendorName` |
| `asVendorName` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `asVendorName(name: string): VendorName` |
| `attachUser` | `backend/src/auth-middleware.ts` | `backend/src/server.ts` | `attachUser(req: Request, _res: Response, next: NextFunction): void` |
| `authenticateCustomer` | `backend/src/db.ts` | (none) | `authenticateCustomer(name: string, password: string): boolean` |
| `autoBalanceTrailingRow` | `frontend/src/lib/journalGrid.ts` | (none) | `autoBalanceTrailingRow(rows: Row[], changedIndex: number): Row[]` |
| `autoExpandIfTrailingRowFilled` | `frontend/src/lib/journalGrid.ts` | (none) | `autoExpandIfTrailingRowFilled(rows: Row[]): Row[]` |
| `buildCategoryTree` | `backend/src/db-reports.ts` | `backend/src/db-matrix-reports.ts`, `backend/src/primitives.ts` | `buildCategoryTree(lines: StatementLine[], accountIdByName: Map<string, number>, rootName: string, normalSide: 'debit' \| 'credit' = 'debit'): CategoryTreeNode[]` |
| `buildProfitAndLossFromBalances` | `backend/src/db-reports.ts` | `backend/src/db-matrix-reports.ts` | `buildProfitAndLossFromBalances(balances: Map<number, number>): ProfitAndLoss` |
| `canSave` | `frontend/src/lib/journalGrid.ts` | (none) | `canSave(rows: Row[]): boolean` |
| `changeOwnPassword` | `backend/src/auth.ts` | `frontend/src/lib/api.ts` | `changeOwnPassword(userId: number, currentPassword: string, newPassword: string): void` |
| `changePassword` | `backend/src/auth.ts` | (none) | `changePassword(userId: number, newPassword: string): void` |
| `checkEInvoiceDiscrepancies` | `backend/src/db.ts` | (none) | `checkEInvoiceDiscrepancies(parsed: UblImportResult, poReference?: string): EInvoiceDiscrepancy[]` |
| `cityDivisionFor` | `backend/src/db.ts` | `backend/src/db-matrix-reports.ts`, `backend/src/db-stock.ts` | `cityDivisionFor(locationName: string): string \| undefined` |
| `climbInstanceTree` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `climbInstanceTree(instanceId: number): ` |
| `clockInToProject` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `clockInToProject(employeeName: EmployeeName, projectExpenseAccount: AccountName, business: BusinessName, ledger: LedgerName, userId: UserId): EmployeeClock` |
| `clockOutOfProject` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `clockOutOfProject(employeeName: EmployeeName, business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `closeBooks` | `backend/src/db-reports.ts` | `backend/src/db-seed.ts`, `frontend/src/lib/api.ts` | `closeBooks(business: BusinessName, ledger: LedgerName, asOfDate: string, retainedEarningsAccount: string, userId: UserId): CloseBooksResult` |
| `closePeriod` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `closePeriod(business: BusinessName, ledger: LedgerName, throughDate: string, userId: UserId): void` |
| `completeCashPurchase` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `completeCashPurchase(input: CashPurchaseInput, userId: UserId): CashPurchaseResult` |
| `completePosSale` | `backend/src/db.ts` | `backend/src/db-reports.ts`, `frontend/src/lib/api.ts` | `completePosSale(input: PosSaleInput, userId: UserId): PosSaleResult` |
| `completeStockTake` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `completeStockTake(stockTakeId: number, business: BusinessName, ledger: LedgerName, varianceExpenseAccount: AccountName, /** @deprecated No longer used — each line now resolves its own, * real, per-product Inventory account directly, the same, real, * structural fix already applied to Purchases and Sales/COGS.    * Kept only so existing callers (the real, live Stock Take UI, the    * simulation) don't need a breaking API change to keep working. */   inventoryAccount: string, unitCostMinorByItem: Record<string, number>, userId: UserId): void` |
| `computeSuggestedFill` | `frontend/src/lib/journalGrid.ts` | (none) | `computeSuggestedFill(rows: Row[], trailingIndex: number): number \| null` |
| `confirmPickedLine` | `backend/src/db.ts` | (none) | `confirmPickedLine(invoiceId: number, invoiceLineId: number, business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `confirmRestockPickedLine` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `confirmRestockPickedLine(runReference: string, itemName: string, business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `consumeFromLots` | `backend/src/db-stock.ts` | (none) | `consumeFromLots(itemName: ItemName, quantity: number): ` |
| `copyChartOfAccountsInto` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `copyChartOfAccountsInto(destRootName: string, coaFamily: string \| undefined, userId: UserId): void` |
| `countInvoices` | `backend/src/db.ts` | (none) | `countInvoices(business: BusinessName, ledger: LedgerName, invoiceType?: 'AR' \| 'AP', source: 'manual' \| 'pos' \| 'all' = 'manual'): number` |
| `countItems` | `backend/src/db.ts` | (none) | `countItems(): number` |
| `countJournalEntries` | `backend/src/db.ts` | (none) | `countJournalEntries(business: BusinessName, ledger: LedgerName): number` |
| `countStockListing` | `backend/src/db-stock.ts` | (none) | `countStockListing(): number` |
| `createBusiness` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `frontend/src/lib/api.ts` | `createBusiness(businessName: BusinessName, financialYearLabel: string, userId: UserId, coaFamily?: string, secondaryCurrencies?: string[], entityStructure?: EntityStructure, partnerNames?: string[]): ` |
| `createDivisionType` | `backend/src/db.ts` | (none) | `createDivisionType(name: string, userId: UserId): void` |
| `createEntity` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/primitives.ts`, `frontend/src/lib/api.ts` | `createEntity(input: NewEntity, userId: UserId): EntityNode` |
| `createInvoice` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `createInvoice(input: InvoiceInput, userId: UserId): number` |
| `createItem` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `createItem(name: string, parentCategoryOrItemsRoot: string, userId: UserId): void` |
| `createLocationType` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `createLocationType(name: string, userId: UserId): void` |
| `createPosTerminal` | `backend/src/db-stock.ts` | (none) | `createPosTerminal(terminalName: string, locationName: LocationName, userId: UserId): void` |
| `createProduct` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `createProduct(name: string, parent: string, userId: UserId): void` |
| `createProjectTask` | `backend/src/db.ts` | (none) | `createProjectTask(projectName: string, taskName: string, plannedStart: string, plannedEnd: string, userId: UserId): void` |
| `createRecurringJournal` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `createRecurringJournal(business: BusinessName, ledger: LedgerName, reference: string, startDate: string, recurrence: Recurrence, lines: RecurringJournalLine[], userId: UserId, description?: string, recurrenceCount?: number): void` |
| `createStockTake` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `createStockTake(locationName: LocationName, takeDate: string, userId: UserId): number` |
| `createSystemEntity` | `backend/src/db-stock.ts` | (none) | `createSystemEntity(name: string, parentId: number \| null): number` |
| `createUser` | `backend/src/auth.ts` | (none) | `createUser(username: string, password: string, roleNames: string[]): UserSummary` |
| `creditTotalMinor` | `frontend/src/lib/journalGrid.ts` | (none) | `creditTotalMinor(rows: Row[]): number` |
| `debitTotalMinor` | `frontend/src/lib/journalGrid.ts` | (none) | `debitTotalMinor(rows: Row[]): number` |
| `decimalPlacesFor` | `frontend/src/lib/format.ts` | `frontend/src/lib/money.ts` | `decimalPlacesFor(unitCode: string \| undefined): number` |
| `defineProductShape` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `defineProductShape(businessName: BusinessName, dimensions: [string, string][], userId: UserId): ` |
| `deleteBomComponent` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `deleteBomComponent(assemblyItem: string, componentItem: string, userId: UserId): void` |
| `deleteDimensionParent` | `backend/src/db.ts` | (none) | `deleteDimensionParent(entityName: string, dimensionName: string, userId: UserId): void` |
| `deleteEntity` | `backend/src/db.ts` | `backend/src/auth.ts`, `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/primitives.ts`, `frontend/src/lib/api.ts` | `deleteEntity(id: number, userId: UserId): void` |
| `deleteEntityLink` | `backend/src/db.ts` | `backend/src/db-stock.ts`, `backend/src/primitives.ts` | `deleteEntityLink(entityName: string, linkType: string, userId: UserId): void` |
| `deleteItemSource` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `deleteItemSource(id: number): void` |
| `deleteMenuOverride` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `deleteMenuOverride(menuItemKey: string, scope: 'business' \| 'user', scopeId: number, userId: UserId = asUserId(1)): void` |
| `deleteTypedAddress` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `deleteTypedAddress(entityName: string, addressType: string, userId: UserId): void` |
| `deleteTypedContactPerson` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `deleteTypedContactPerson(entityName: string, contactType: string, userId: UserId): void` |
| `deleteTypedPhone` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `deleteTypedPhone(entityName: string, phoneType: string, userId: UserId): void` |
| `deleteVocabularyPreference` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `deleteVocabularyPreference(conceptName: string, scope: 'business' \| 'user', scopeId: number): void` |
| `differenceMinor` | `frontend/src/lib/journalGrid.ts` | (none) | `differenceMinor(rows: Row[]): number` |
| `dispatchOrderFromPickingList` | `backend/src/db.ts` | (none) | `dispatchOrderFromPickingList(invoiceId: number, locationName: LocationName, revenueAccount: string, taxAccount: string, userId: UserId): void` |
| `dispatchRestockFromPickingList` | `backend/src/db.ts` | (none) | `dispatchRestockFromPickingList(runReference: string, business: BusinessName, ledger: LedgerName, warehouseName: LocationName, retailOutletName: LocationName, lines: RestockLineInput[], userId: UserId, transdate?: string): void` |
| `dispatchStockFromLocation` | `backend/src/db-stock.ts` | `backend/src/db.ts`, `frontend/src/lib/api.ts` | `dispatchStockFromLocation(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, locationName: LocationName, quantity: number, userId: UserId, transdate?: string): void` |
| `emptyRow` | `frontend/src/lib/journalGrid.ts` | (none) | `emptyRow(): Row` |
| `ensureAddressType` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `ensureAddressType(typeName: string, userId: UserId): void` |
| `ensureAtLeastOneRow` | `frontend/src/lib/journalGrid.ts` | (none) | `ensureAtLeastOneRow(rows: Row[]): Row[]` |
| `ensureCategoryChain` | `backend/src/db.ts` | (none) | `ensureCategoryChain(rootName: string, prefix: string, chain: string[], userId: UserId): ` |
| `ensureCombinationAccountLeaf` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `ensureCombinationAccountLeaf(baseAccountName: string, instanceTopNode: { id: number; name: string }, userId: UserId): ` |
| `ensureContactPersonType` | `backend/src/db.ts` | (none) | `ensureContactPersonType(typeName: string, userId: UserId): void` |
| `ensureCurrencyPair` | `backend/src/db.ts` | (none) | `ensureCurrencyPair(businessName: BusinessName, fromCurrency: string, toCurrency: string, userId: UserId): ` |
| `ensureHierarchyGrouping` | `backend/src/db.ts` | (none) | `ensureHierarchyGrouping(businessName: BusinessName, groupingName: string, userId: UserId): ` |
| `ensureHierarchyValue` | `backend/src/db.ts` | (none) | `ensureHierarchyValue(businessName: BusinessName, groupingName: string, valueName: string, userId: UserId): ` |
| `ensureLocationCapacityAccount` | `backend/src/db-stock.ts` | (none) | `ensureLocationCapacityAccount(business: BusinessName, ledger: LedgerName, locationName: LocationName, userId: UserId): ` |
| `ensureLocationScopedAccount` | `backend/src/db.ts` | (none) | `ensureLocationScopedAccount(baseAccountName: string, locationName: string, userId: UserId): string` |
| `ensurePhoneType` | `backend/src/db.ts` | (none) | `ensurePhoneType(typeName: string, userId: UserId): void` |
| `ensureProductInstance` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `ensureProductInstance(businessName: BusinessName, definitionDimensions: [string, string][], values: string[], userId: UserId): ` |
| `ensureProductInventoryAccount` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `ensureProductInventoryAccount(itemName: ItemName, userId: UserId): ` |
| `ensureProductLocationInventoryAccount` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `ensureProductLocationInventoryAccount(itemName: ItemName, locationName: LocationName, userId: UserId): ` |
| `ensureProductLocationLeaf` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `ensureProductLocationLeaf(itemName: ItemName, locationName: LocationName, userId: UserId): ` |
| `ensureProductQuantityAccounts` | `backend/src/db.ts` | `backend/src/db-stock.ts`, `frontend/src/lib/entityTree.ts` | `ensureProductQuantityAccounts(itemName: ItemName, userId: UserId): ` |
| `ensureProductSalesCogsAccounts` | `backend/src/db.ts` | `backend/src/db-reports.ts` | `ensureProductSalesCogsAccounts(itemName: ItemName, userId: UserId, tier?: string): ` |
| `ensureProductTierItem` | `backend/src/db.ts` | (none) | `ensureProductTierItem(baseProductName: ItemName, tier: string, userId: UserId): ` |
| `ensureProductTierLocationLeaf` | `backend/src/db.ts` | `backend/src/db-matrix-reports.ts` | `ensureProductTierLocationLeaf(tierItemName: string, locationName: LocationName, userId: UserId, tierItemId?: number): ` |
| `escapeAscii` | `shared-fixtures/csv.ts` | (none) | `escapeAscii(text: string): string` |
| `exportInvoiceAsUbl` | `backend/src/db.ts` | (none) | `exportInvoiceAsUbl(invoiceId: number): string` |
| `filterToItems` | `frontend/src/lib/entityTree.ts` | (none) | `filterToItems(entities: EntityNode[]): EntityNode[]` |
| `formatAmount` | `frontend/src/lib/format.ts` | (none) | `formatAmount(smallestUnits: number, numberFormat: string, unitCode?: string): string` |
| `formatDate` | `frontend/src/lib/format.ts` | (none) | `formatDate(isoDate: string \| null \| undefined, dateFormat: string): string` |
| `fulfillOrder` | `backend/src/db-stock.ts` | `backend/src/db.ts` | `fulfillOrder(orderReference: string, fulfillingReference: string, business: BusinessName, ledger: LedgerName, quantityFulfilled: number, valueFulfilledMinor: number, userId: UserId, transdate?: string): void` |
| `getAccountsPostedTo` | `backend/src/db.ts` | (none) | `getAccountsPostedTo(reference: string): string[]` |
| `getActiveShiftsAtLocation` | `backend/src/db.ts` | (none) | `getActiveShiftsAtLocation(locationName: string): PosShift[]` |
| `getAgedInvoices` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getAgedInvoices(business: BusinessName, ledger: LedgerName, invoiceType: 'AR' \| 'AP', asOfDate: string): AgedInvoiceRow[]` |
| `getAgedSummary` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getAgedSummary(business: BusinessName, ledger: LedgerName, invoiceType: 'AR' \| 'AP', asOfDate: string): AgedSummaryRow[]` |
| `getAgingBuckets` | `backend/src/db.ts` | (none) | `getAgingBuckets(paymentTermsDays: number \| null): AgingBucket[]` |
| `getAllTranslations` | `backend/src/db.ts` | (none) | `getAllTranslations(languageName: string): Record<string, string>` |
| `getAncestorChain` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `getAncestorChain(entityName: string, rootName: string): string[]` |
| `getAxisValues` | `backend/src/db-matrix-reports.ts` | `frontend/src/lib/matrix-api.ts` | `getAxisValues(businessName: BusinessName, ledgerName: LedgerName): AxisValues` |
| `getBalanceSheet` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `getBalanceSheet(businessName: BusinessName, ledgerName: LedgerName, asOfDate?: string, divisionName?: string): BalanceSheet` |
| `getBankAccounts` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getBankAccounts(business: BusinessName, ledger: LedgerName): BankAccountRow[]` |
| `getBelowReorderStock` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `getBelowReorderStock(): BelowReorderRow[]` |
| `getBomComponents` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getBomComponents(assemblyItem: string): ` |
| `getBusinesses` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getBusinesses(): ` |
| `getBusinessHierarchy` | `backend/src/db.ts` | (none) | `getBusinessHierarchy(businessName: BusinessName): HierarchyGroupingWithValues[]` |
| `getBusinessProductShapes` | `backend/src/db.ts` | (none) | `getBusinessProductShapes(businessName: BusinessName): [string, string][][]` |
| `getBusinessReports` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `getBusinessReports(): ReportRow[]` |
| `getBusinessTypes` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getBusinessTypes(): BusinessTypeInfo[]` |
| `getCashFlowForecast` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getCashFlowForecast(business: BusinessName, ledger: LedgerName, asOfDate: string, horizonDays: number): CashFlowForecast` |
| `getCashPosition` | `backend/src/db.ts` | `backend/src/primitives.ts`, `frontend/src/lib/api.ts` | `getCashPosition(business: BusinessName, ledger: LedgerName): CashPositionByCurrency[]` |
| `getChartOfAccounts` | `backend/src/db-reports.ts` | `backend/src/db.ts`, `frontend/src/lib/api.ts` | `getChartOfAccounts(): ChartRow[]` |
| `getCoaFamilyAccounts` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getCoaFamilyAccounts(businessName: BusinessName, ledgerName: LedgerName): string[]` |
| `getCombinationByUpc` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getCombinationByUpc(upc: string): ` |
| `getCombinationDisplayName` | `backend/src/db.ts` | `backend/src/db-reports.ts` | `getCombinationDisplayName(entityId: number): string` |
| `getConceptsWithAlternates` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getConceptsWithAlternates(): ConceptWithAlternates[]` |
| `getContact` | `backend/src/db.ts` | `backend/src/invoice.ts`, `frontend/src/lib/api.ts` | `getContact(entityName: string): Contact \| undefined` |
| `getContactBaseAccounts` | `backend/src/db.ts` | (none) | `getContactBaseAccounts(contactName: string): string[]` |
| `getContactsWithType` | `backend/src/db.ts` | `backend/src/primitives.ts` | `getContactsWithType(typeName: string): string[]` |
| `getContactTypes` | `backend/src/db.ts` | (none) | `getContactTypes(contactName: string): string[]` |
| `getCounterpartyHistory` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getCounterpartyHistory(business: BusinessName, ledger: LedgerName, counterpartyName: string): HistoryLine[]` |
| `getCreditStatus` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getCreditStatus(entityName: string): CreditStatus` |
| `getCurrencyExchangeRate` | `backend/src/db.ts` | (none) | `getCurrencyExchangeRate(businessName: BusinessName, fromCurrency: string, toCurrency: string, side: 'buy' \| 'sell'): number \| null` |
| `getCustomerStatement` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getCustomerStatement(business: BusinessName, ledger: LedgerName, customerName: string, asOfDate: string): CustomerStatement` |
| `getDefaultLanguage` | `backend/src/db.ts` | `backend/src/invoice.ts`, `frontend/src/lib/api.ts` | `getDefaultLanguage(): string \| null` |
| `getDimensionAncestorChain` | `backend/src/db.ts` | (none) | `getDimensionAncestorChain(entityName: string, dimensionName: string): string[]` |
| `getDimensionChildren` | `backend/src/db.ts` | `backend/src/db-reports.ts` | `getDimensionChildren(parentName: string, dimensionName: string): string[]` |
| `getDimensionLinksPointingAt` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getDimensionLinksPointingAt(targetName: string): ` |
| `getDimensionParent` | `backend/src/db.ts` | `backend/src/db-matrix-reports.ts` | `getDimensionParent(entityName: string, dimensionName: string): string \| undefined` |
| `getDivisionForAccount` | `backend/src/db.ts` | `backend/src/db-reports.ts` | `getDivisionForAccount(accountName: AccountName): string \| undefined` |
| `getDivisions` | `backend/src/db.ts` | `backend/src/db-reports.ts`, `backend/src/db-seed.ts`, `frontend/src/lib/api.ts` | `getDivisions(): ` |
| `getDivisionType` | `backend/src/db.ts` | (none) | `getDivisionType(divisionName: string): string \| null` |
| `getDivisionTypes` | `backend/src/db.ts` | (none) | `getDivisionTypes(): string[]` |
| `getEffectiveSaleCurrency` | `backend/src/db-stock.ts` | `backend/src/db.ts` | `getEffectiveSaleCurrency(terminalName: string \| undefined): string \| null` |
| `getEmployeeSchedule` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getEmployeeSchedule(employeeName: string): EmployeeScheduleLine[]` |
| `getEntitiesWithRelationship` | `backend/src/db.ts` | `backend/src/primitives.ts` | `getEntitiesWithRelationship(relationshipType: string): ` |
| `getEntity` | `backend/src/db.ts` | `backend/src/primitives.ts` | `getEntity(id: number): EntityNode \| undefined` |
| `getEntityHistory` | `backend/src/db.ts` | (none) | `getEntityHistory(id: number): EntityHistoryRow[]` |
| `getEntityLink` | `backend/src/db.ts` | `backend/src/db-stock.ts`, `backend/src/primitives.ts` | `getEntityLink(entityName: string, linkType: string): string \| undefined` |
| `getEntityTree` | `backend/src/db.ts` | `backend/src/db-matrix-reports.ts`, `backend/src/db-reports.ts`, `frontend/src/lib/api.ts` | `getEntityTree(): (EntityNode &` |
| `getExpiringStock` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `getExpiringStock(asOfDate: string, withinDays: number): ExpiringLot[]` |
| `getHierarchy` | `backend/src/db.ts` | `backend/src/primitives.ts`, `frontend/src/lib/api.ts` | `getHierarchy(rootName: string, relationshipType?: string): HierarchyNode` |
| `getHierarchyChain` | `backend/src/db.ts` | (none) | `getHierarchyChain(leafName: ItemName \| LocationName): HierarchyChainNode[]` |
| `getInvoice` | `backend/src/db.ts` | (none) | `getInvoice(id: number): Invoice \| undefined` |
| `getInvoiceLine` | `backend/src/db.ts` | `backend/src/invoice.ts` | `getInvoiceLine(reference: string, business: BusinessName, ledger: LedgerName): InvoiceLine \| undefined` |
| `getInvoiceOutstandingMinor` | `backend/src/db.ts` | (none) | `getInvoiceOutstandingMinor(invoiceId: number): number` |
| `getItem` | `backend/src/db.ts` | `frontend/src/lib/api.ts`, `frontend/src/lib/auth.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts` | `getItem(entityName: string): Item \| undefined` |
| `getItemByUpc` | `backend/src/db.ts` | (none) | `getItemByUpc(upc: string): ItemSummary \| undefined` |
| `getItemLeadTimes` | `backend/src/db-stock.ts` | (none) | `getItemLeadTimes(itemName: ItemName): ` |
| `getItemLocation` | `backend/src/db-stock.ts` | `backend/src/db.ts`, `frontend/src/lib/api.ts` | `getItemLocation(itemName: ItemName, locationName: LocationName): ItemLocationLevels` |
| `getItemPriceForCurrency` | `backend/src/db.ts` | (none) | `getItemPriceForCurrency(itemName: string, currency: string \| null, productInstanceId?: number): number \| null` |
| `getItemProduct` | `backend/src/db.ts` | (none) | `getItemProduct(itemName: string): string \| null` |
| `getItemStorageOrigin` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getItemStorageOrigin(itemName: ItemName): 'Hot' \| 'Cold' \| undefined` |
| `getJournalEntry` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getJournalEntry(business: BusinessName, ledger: LedgerName, journalId: number, occurrenceDate: string): JournalDetail \| undefined` |
| `getLanguageDirection` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getLanguageDirection(languageName: string): 'LTR' \| 'RTL' \| undefined` |
| `getLanguages` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `frontend/src/lib/api.ts` | `getLanguages(): ` |
| `getLedgerBalances` | `backend/src/db-reports.ts` | `backend/src/db-matrix-reports.ts`, `backend/src/db.ts` | `getLedgerBalances(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, divisionName?: string, excludeCloseEntries = false): Map<number, number>` |
| `getLedgerBalancesByDivision` | `backend/src/db-reports.ts` | (none) | `getLedgerBalancesByDivision(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, excludeCloseEntries = false): Map<number, Map<string \| null, number>>` |
| `getLedgerBalancesByDivisionStructural` | `backend/src/db-reports.ts` | (none) | `getLedgerBalancesByDivisionStructural(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, excludeCloseEntries = false): Map<number, Map<string \| null, number>>` |
| `getLedgerDateRange` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getLedgerDateRange(businessName: BusinessName, ledgerName: LedgerName): LedgerDateRange` |
| `getLedgers` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getLedgers(businessName: BusinessName): ` |
| `getLineType` | `backend/src/db.ts` | (none) | `getLineType(entityName: string): string \| undefined` |
| `getLocalizedText` | `backend/src/db.ts` | `backend/src/invoice.ts`, `frontend/src/lib/api.ts` | `getLocalizedText(language: string, opts?: { businessName?: string; userId?: number }): Record<string, string>` |
| `getLocation` | `backend/src/db-stock.ts` | `backend/src/db.ts` | `getLocation(name: string): Location \| undefined` |
| `getLocationCapacityStatus` | `backend/src/db-stock.ts` | (none) | `getLocationCapacityStatus(locationName: LocationName): LocationCapacityStatus` |
| `getLocationForAccount` | `backend/src/db.ts` | `backend/src/db-matrix-reports.ts` | `getLocationForAccount(accountName: AccountName): string \| undefined` |
| `getLocationOpenHours` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getLocationOpenHours(locationName: string): OpenHoursLine[]` |
| `getLocationTypes` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `getLocationTypes(): string[]` |
| `getMenuTree` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getMenuTree(opts?: { businessName?: string; userId?: number }): MenuSectionRow[]` |
| `getOpenProjectClockForEmployee` | `backend/src/db.ts` | (none) | `getOpenProjectClockForEmployee(employeeName: EmployeeName): EmployeeClock \| undefined` |
| `getOpenShiftForEmployee` | `backend/src/db.ts` | (none) | `getOpenShiftForEmployee(employeeName: string): PosShift \| undefined` |
| `getOrderStatus` | `backend/src/db-stock.ts` | `backend/src/db.ts`, `frontend/src/lib/api.ts` | `getOrderStatus(orderReference: string): ` |
| `getOrganizationChart` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getOrganizationChart(businessName: BusinessName): OrganizationChart` |
| `getPeriodLockStatus` | `backend/src/db.ts` | (none) | `getPeriodLockStatus(business: BusinessName, ledger: LedgerName): PeriodLockStatus` |
| `getPickingList` | `backend/src/db.ts` | (none) | `getPickingList(invoiceId: number, locationName: LocationName): PickingListLine[]` |
| `getProductUnitCostMinor` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `getProductUnitCostMinor(itemName: ItemName): number \| null` |
| `getProfitAndLoss` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `getProfitAndLoss(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, divisionName?: string, excludeCloseEntries = true): ProfitAndLoss` |
| `getProfitAndLossByAxis` | `backend/src/db-matrix-reports.ts` | `frontend/src/lib/matrix-api.ts` | `getProfitAndLossByAxis(businessName: BusinessName, ledgerName: LedgerName, fromDate: string \| undefined, toDate: string \| undefined, outerAxis: MatrixAxis, innerAxis: MatrixAxis, outerFilter?: string, innerFilter?: string): ProfitAndLossByAxisNode[]` |
| `getProfitAndLossByDivision` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `getProfitAndLossByDivision(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string): ProfitAndLossByDivision[]` |
| `getProfitAndLossByDivisionTree` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `getProfitAndLossByDivisionTree(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string): ProfitAndLossByDivisionNode[]` |
| `getProfitAndLossComparison` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `getProfitAndLossComparison(businessName: BusinessName, ledgerA: LedgerName, ledgerB: LedgerName): ProfitAndLossComparison` |
| `getProjectTasks` | `backend/src/db.ts` | (none) | `getProjectTasks(projectName: string): ` |
| `getPrototypeOf` | `backend/src/db.ts` | (none) | `getPrototypeOf(entityName: string): string \| undefined` |
| `getQualifiedDisplayName` | `backend/src/db.ts` | `backend/src/db-reports.ts` | `getQualifiedDisplayName(entityId: number): string` |
| `getRelationship` | `backend/src/db.ts` | (none) | `getRelationship(entityName: string): Relationship \| undefined` |
| `getReminderCandidates` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getReminderCandidates(business: BusinessName, ledger: LedgerName, asOfDate: string): ReminderCandidate[]` |
| `getRestockPickingList` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getRestockPickingList(runReference: string, warehouseName: LocationName, lines: RestockLineInput[]): PickingListLine[]` |
| `getSalesCogsMatrix` | `backend/src/db-matrix-reports.ts` | `frontend/src/lib/matrix-api.ts` | `getSalesCogsMatrix(businessName: BusinessName, ledgerName: LedgerName, fromDate: string \| undefined, toDate: string \| undefined, rowAxis: MatrixAxis, colAxis: MatrixAxis): SalesCogsMatrix` |
| `getSalesReport` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `getSalesReport(business: BusinessName, ledger: LedgerName, fromDate?: string, toDate?: string): SalesReport` |
| `getScheduleAtLocation` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getScheduleAtLocation(locationName: string): LocationScheduleLine[]` |
| `getScreenTitle` | `backend/src/db.ts` | (none) | `getScreenTitle(href: string, opts?: { businessName?: string; userId?: number }): string \| undefined` |
| `getSessionUser` | `backend/src/auth.ts` | `backend/src/auth-middleware.ts` | `getSessionUser(token: string \| undefined): AuthenticatedUser \| null` |
| `getStagedLines` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getStagedLines(reference: string, business: BusinessName, ledger: LedgerName): StagedLine[]` |
| `getStockListing` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `getStockListing(limit = 100, offset = 0): StockListingRow[]` |
| `getStockListingByLocation` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `getStockListingByLocation(): StockListingLocationGroup[]` |
| `getStockMovementReport` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `getStockMovementReport(ledgerName: string, fromDate?: string, toDate?: string): StockMovementReport` |
| `getStockOnHandMatrix` | `backend/src/db-matrix-reports.ts` | `frontend/src/lib/matrix-api.ts` | `getStockOnHandMatrix(rowAxis: MatrixAxis, colAxis: MatrixAxis): StockOnHandMatrix` |
| `getStockOutRiskReport` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `getStockOutRiskReport(windowDays: number = 2): StockOutRiskRow[]` |
| `getStockTake` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `getStockTake(id: number): StockTake \| undefined` |
| `getTaskDependencies` | `backend/src/db.ts` | (none) | `getTaskDependencies(dependentTask: string): ` |
| `getTranslation` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `getTranslation(conceptName: string, languageName: string): string \| null` |
| `getTrialBalance` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `getTrialBalance(businessName: BusinessName, ledgerName: LedgerName, asOfDate?: string, divisionName?: string): TrialBalance` |
| `getTrialBalanceComparison` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `getTrialBalanceComparison(businessName: BusinessName, ledgerA: LedgerName, ledgerB: LedgerName): TrialBalanceComparison` |
| `getTypedAddresses` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getTypedAddresses(entityName: string): TypedAddress[]` |
| `getTypedContactPersons` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getTypedContactPersons(entityName: string): ContactPerson[]` |
| `getTypedPhones` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getTypedPhones(entityName: string): TypedPhone[]` |
| `getVocabularyAlternates` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getVocabularyAlternates(wordName: string): string[]` |
| `getVocabularyWords` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getVocabularyWords(): VocabularyWord[]` |
| `hashPassword` | `backend/src/password.ts` | `backend/src/auth.ts`, `backend/src/db.ts` | `hashPassword(password: string): string` |
| `hasRole` | `frontend/src/lib/auth.ts` | `frontend/src/lib/state.svelte.ts` | `hasRole(state: AuthState \| null, ...roles: string[]): boolean` |
| `hasRole` | `frontend/src/lib/state.svelte.ts` | `frontend/src/lib/auth.ts` | `hasRole(state: AuthState \| null, ...roles: string[]): boolean` |
| `importUblInvoiceAsDraft` | `backend/src/db.ts` | (none) | `importUblInvoiceAsDraft(xml: string, business: BusinessName, ledger: LedgerName, vendorName: string, userId: UserId, poReference?: string): ` |
| `instantiateChartOfAccounts` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `instantiateChartOfAccounts(businessName: BusinessName, coaFamily: string \| undefined, userId: UserId): void` |
| `isBalanced` | `frontend/src/lib/journalGrid.ts` | (none) | `isBalanced(rows: Row[]): boolean` |
| `isDescendantOf` | `backend/src/db.ts` | `frontend/src/lib/entityTree.ts` | `isDescendantOf(entityName: string, rootName: string): boolean` |
| `isDescendantOf` | `frontend/src/lib/entityTree.ts` | `backend/src/db.ts` | `isDescendantOf(entity: EntityNode, ancestorName: string, allEntities: EntityNode[], matchSuffix = false): boolean` |
| `isGenuineCategoryOrItemsRoot` | `backend/src/db.ts` | (none) | `isGenuineCategoryOrItemsRoot(name: string): boolean` |
| `isRowEmpty` | `frontend/src/lib/journalGrid.ts` | (none) | `isRowEmpty(row: Row): boolean` |
| `isRowFilled` | `frontend/src/lib/journalGrid.ts` | (none) | `isRowFilled(row: Row): boolean` |
| `listAddressTypes` | `backend/src/db.ts` | `backend/src/db-stock.ts`, `frontend/src/lib/api.ts` | `listAddressTypes(): string[]` |
| `listContactPersonTypes` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `listContactPersonTypes(): string[]` |
| `listCurrencyPairs` | `backend/src/db.ts` | (none) | `listCurrencyPairs(currencies: string[]): ` |
| `listInvoices` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `listInvoices(business: BusinessName, ledger: LedgerName, options: ListInvoicesOptions = {}): Invoice[]` |
| `listItems` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `listItems(limit?: number, offset = 0): ItemSummary[]` |
| `listItemSources` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `listItemSources(itemName: string): ItemSource[]` |
| `listJournalEntries` | `backend/src/db.ts` | `frontend/src/lib/api.ts`, `frontend/src/lib/pagination.ts` | `listJournalEntries(business: BusinessName, ledger: LedgerName, limit = 100, offset = 0): JournalSummary[]` |
| `listLineTypes` | `backend/src/db.ts` | (none) | `listLineTypes(): string[]` |
| `listPendingCustomers` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `listPendingCustomers(): PendingCustomer[]` |
| `listPhoneTypes` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `listPhoneTypes(): string[]` |
| `listProducts` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `listProducts(): ProductSummary[]` |
| `listRoles` | `backend/src/auth.ts` | (none) | `listRoles(): ` |
| `listUsers` | `backend/src/auth.ts` | (none) | `listUsers(): UserSummary[]` |
| `loadAllTranslations` | `shared-fixtures/translations.ts` | `backend/src/db-seed.ts` | `loadAllTranslations(): TranslationRow[]` |
| `loadDemoCategories` | `shared-fixtures/wine-retail-demo-data.ts` | `backend/src/db-seed.ts` | `loadDemoCategories(): DemoCategory[]` |
| `loadDemoLocations` | `shared-fixtures/wine-retail-demo-data.ts` | `backend/src/db-seed.ts` | `loadDemoLocations(): DemoLocation[]` |
| `loadDemoProducts` | `shared-fixtures/wine-retail-demo-data.ts` | `backend/src/db-seed.ts` | `loadDemoProducts(): DemoProduct[]` |
| `loadDemoStockLevels` | `shared-fixtures/wine-retail-demo-data.ts` | `backend/src/db-seed.ts` | `loadDemoStockLevels(): DemoStockLevel[]` |
| `loadDemoUpcs` | `shared-fixtures/wine-retail-demo-data.ts` | `backend/src/db-seed.ts` | `loadDemoUpcs(): DemoUpc[]` |
| `login` | `backend/src/auth.ts` | `backend/src/auth-middleware.ts`, `backend/src/db.ts`, `backend/src/server.ts`, `frontend/src/lib/api.ts` | `login(username: string, password: string): ` |
| `logout` | `backend/src/auth.ts` | `frontend/src/lib/api.ts` | `logout(token: string): void` |
| `mergeContactDetail` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `backend/src/db-stock.ts` | `mergeContactDetail(entityId: number, fields: Record<string, unknown>): void` |
| `parseMinorUnits` | `frontend/src/lib/money.ts` | (none) | `parseMinorUnits(text: string): number` |
| `parseQuantity` | `frontend/src/lib/money.ts` | (none) | `parseQuantity(text: string): number` |
| `parseUblInvoice` | `backend/src/db.ts` | (none) | `parseUblInvoice(xml: string): UblImportResult` |
| `payEmployeeWages` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `payEmployeeWages(input: PayEmployeeWagesInput, userId: UserId): PayEmployeeWagesResult` |
| `placeOrder` | `backend/src/db-stock.ts` | `backend/src/db.ts` | `placeOrder(orderReference: string, business: BusinessName, ledger: LedgerName, quantity: number, priceMinor: number, userId: UserId, transdate?: string, vendor?: VendorName, item?: ItemName, location?: LocationName): void` |
| `postApPayment` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `postApPayment(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `postApPurchase` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `postApPurchase(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `postArReceipt` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `postArReceipt(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `postArSale` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `postArSale(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `postBomComponents` | `backend/src/db.ts` | (none) | `postBomComponents(assemblyItem: string, business: string, userId: UserId): void` |
| `postInvoice` | `backend/src/db.ts` | (none) | `postInvoice(id: number,   revenueOrExpenseAccount: string \| { name: string; id: number } \| ((line: InvoiceLineInput & { id: number }) => string \| { name: string; id: number }), taxAccount: string, userId: UserId, restockInventory = false, divisionName?: string, counterpartyAccountOverride?: string): void` |
| `postJournalEntry` | `backend/src/db.ts` | `backend/src/db-reports.ts`, `backend/src/db-stock.ts`, `frontend/src/lib/api.ts` | `postJournalEntry(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `postPurchaseOrder` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `postPurchaseOrder(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `postQuantityMovement` | `backend/src/db-stock.ts` | `backend/src/db.ts`, `backend/src/primitives.ts` | `postQuantityMovement(business: BusinessName, ledger: LedgerName, reference: string, account: AccountName, deltaQuantity: number, userId: UserId, transdate?: string, locationName?: LocationName, accountId?: number): void` |
| `postSalesOrder` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `postSalesOrder(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `postStagedQuantityMovement` | `backend/src/db-stock.ts` | (none) | `postStagedQuantityMovement(business: BusinessName, ledger: LedgerName, reference: string, userId: UserId): void` |
| `postStockDispatch` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `postStockDispatch(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `postStockReceipt` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `postStockReceipt(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `previewCloseBooks` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `previewCloseBooks(businessName: BusinessName, ledger: LedgerName, asOfDate: string, retainedEarningsAccount: string): CloseBooksPreview` |
| `readCsv` | `shared-fixtures/csv.ts` | `shared-fixtures/add-brand-translation.ts`, `shared-fixtures/add-header-translations.ts`, `shared-fixtures/add-journal-remaining-translations.ts`, `shared-fixtures/add-journal-translations.ts`, `shared-fixtures/add-menu-translations.ts`, `shared-fixtures/translations.ts`, `shared-fixtures/wine-retail-demo-data.ts`, `shared-fixtures/wine-retail.ts` | `readCsv(text: string): Record<string, string>[]` |
| `receiveLot` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `receiveLot(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, lotNumber: string, receivedDate: string, expirationDate: string \| null, quantity: number, userId: UserId, costBasisMinor?: number): void` |
| `receiveStockAtLocation` | `backend/src/db-stock.ts` | `backend/src/db-seed.ts`, `backend/src/db.ts`, `frontend/src/lib/api.ts` | `receiveStockAtLocation(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, locationName: LocationName, quantity: number, userId: UserId, transdate?: string, combinationValues?: string[], combinationShape?: [string, string][]): void` |
| `recordReminderSent` | `backend/src/db.ts` | (none) | `recordReminderSent(customerName: string): number` |
| `recordStockTakeCount` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `recordStockTakeCount(stockTakeId: number, itemName: ItemName, countedQuantity: number): void` |
| `registerBankAccount` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `registerBankAccount(accountName: string, business: string, scopeName: string, overdraftLimitMinor: number \| null, userId: UserId): void` |
| `registerCustomer` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `registerCustomer(input: CustomerRegistrationInput, userId: UserId): void` |
| `removeContactType` | `backend/src/db.ts` | (none) | `removeContactType(contactName: string, typeName: string, userId: UserId): void` |
| `removeRowAt` | `frontend/src/lib/journalGrid.ts` | (none) | `removeRowAt(rows: Row[], index: number): Row[]` |
| `removeStagedLine` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `removeStagedLine(reference: string, business: BusinessName, ledger: LedgerName, account: string): void` |
| `reopenPeriod` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `reopenPeriod(business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `reorderSiblings` | `backend/src/db.ts` | (none) | `reorderSiblings(entityId: EntityId, direction: 'up' \| 'down', userId: UserId): void` |
| `reorderSiblingsBulk` | `backend/src/db.ts` | (none) | `reorderSiblingsBulk(entityIds: number[], direction: 'up' \| 'down', userId: UserId): void` |
| `requireAuth` | `backend/src/auth-middleware.ts` | `backend/src/server.ts` | `requireAuth(req: Request, res: Response, next: NextFunction): void` |
| `requireRole` | `backend/src/auth-middleware.ts` | `backend/src/server.ts` | `requireRole(...roles: string[]): void` |
| `resetReminderLevel` | `backend/src/db.ts` | (none) | `resetReminderLevel(customerName: string): void` |
| `resolveDispatchLocation` | `backend/src/db.ts` | (none) | `resolveDispatchLocation(itemName: ItemName, logicalLocationName: LocationName): LocationName` |
| `resolveItemId` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `resolveItemId(itemName: ItemName): number \| undefined` |
| `reverseJournalEntry` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `reverseJournalEntry(business: BusinessName, ledger: LedgerName, journalId: number, occurrenceDate: string, userId: UserId, reversalDate?: string): void` |
| `saveBusinessTypeAnswers` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `saveBusinessTypeAnswers(businessName: BusinessName, answers: Record<string, string>, userId: UserId): void` |
| `screenTitle` | `frontend/src/lib/state.svelte.ts` | `frontend/src/lib/menu.ts` | `screenTitle(href: string): string \| undefined` |
| `seedDefaultHierarchyPrototypes` | `backend/src/db.ts` | (none) | `seedDefaultHierarchyPrototypes(business: TypedNode<'BusinessName'>, userId: UserId): void` |
| `seedRemainingData` | `backend/src/db-seed.ts` | `backend/src/db.ts` | `seedRemainingData(): void` |
| `setAccountCurrency` | `backend/src/db-reports.ts` | `backend/src/db-stock.ts`, `backend/src/db.ts` | `setAccountCurrency(accountName: string, currency: string \| null): void` |
| `setContact` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `frontend/src/lib/api.ts` | `setContact(entityName: string, contact: Partial<Contact>): void` |
| `setContactType` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `backend/src/primitives.ts` | `setContactType(contactName: string, typeName: string, userId: UserId): void` |
| `setCurrencyExchangeRate` | `backend/src/db.ts` | (none) | `setCurrencyExchangeRate(businessName: BusinessName, fromCurrency: string, toCurrency: string, userId: UserId, buyRateMinor?: number, sellRateMinor?: number): void` |
| `setDefaultLanguage` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `setDefaultLanguage(languageName: string, userId: UserId): void` |
| `setDimensionParent` | `backend/src/db.ts` | `backend/src/db-matrix-reports.ts`, `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/primitives.ts` | `setDimensionParent(entityName: string, dimensionName: string, parentName: string, userId: UserId, entityId?: number, targetId?: number): void` |
| `setDivisionType` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `setDivisionType(divisionNameOrId: string \| EntityId, typeMarkerName: string): void` |
| `setEmployeeSchedule` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `setEmployeeSchedule(employeeName: string, locationName: string, schedule: ScheduleLine[]): void` |
| `setEntityLink` | `backend/src/db.ts` | `backend/src/db-matrix-reports.ts`, `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/primitives.ts` | `setEntityLink(entityName: string, linkType: string, targetName: string, userId: UserId, entityId?: number, targetId?: number): string` |
| `setItem` | `backend/src/db.ts` | `frontend/src/lib/api.ts`, `frontend/src/lib/auth.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts` | `setItem(entityName: string, item: Partial<Item>): void` |
| `setItemLocationLevelDetails` | `backend/src/db-stock.ts` | (none) | `setItemLocationLevelDetails(itemName: ItemName, locationName: LocationName, levels: Omit<ItemLocationLevels, 'quantity_on_hand'>, userId: UserId): void` |
| `setItemLocationLevels` | `backend/src/db-stock.ts` | `backend/src/db-seed.ts`, `frontend/src/lib/api.ts` | `setItemLocationLevels(itemName: ItemName, locationName: LocationName, levels: {     minLevel?: number \| null;     maxLevel?: number \| null;     reorderLevel?: number \| null;     shelfSide?: string \| null;     rack?: string \| null;     level?: number \| null;   }): void` |
| `setItemProduct` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `setItemProduct(itemName: string, productName: string \| null, userId: UserId): void` |
| `setItemSourceLeadTime` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `setItemSourceLeadTime(itemName: ItemName, vendorName: VendorName, days: number, userId: UserId): void` |
| `setItemStorageOrigin` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `setItemStorageOrigin(itemName: ItemName, origin: 'Hot' \| 'Cold' \| null, userId: UserId): void` |
| `setLanguageDirection` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `setLanguageDirection(languageName: string, direction: 'LTR' \| 'RTL' \| null, userId: UserId): void` |
| `setLineType` | `backend/src/db.ts` | (none) | `setLineType(entityName: string, lineType: string \| null, userId: UserId): void` |
| `setLocation` | `backend/src/db-stock.ts` | `backend/src/db-seed.ts`, `backend/src/db.ts` | `setLocation(name: string, location: Location): void` |
| `setLocationOpenHours` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `setLocationOpenHours(locationName: string, hours: OpenHoursLine[]): void` |
| `setMenuOverride` | `backend/src/db.ts` | `backend/src/primitives.ts`, `frontend/src/lib/api.ts` | `setMenuOverride(menuItemKey: string, scope: 'business' \| 'user', scopeId: number, overrideLabel: string \| null, hidden: boolean, userId: UserId = asUserId(1)): void` |
| `setOwnDateFormat` | `backend/src/auth.ts` | `frontend/src/lib/api.ts` | `setOwnDateFormat(userId: number, dateFormat: string): void` |
| `setOwnNumberFormat` | `backend/src/auth.ts` | `frontend/src/lib/api.ts` | `setOwnNumberFormat(userId: number, numberFormat: string): void` |
| `setOwnPageSize` | `backend/src/auth.ts` | `frontend/src/lib/api.ts` | `setOwnPageSize(userId: number, pageSize: number): void` |
| `setPosPin` | `backend/src/db.ts` | (none) | `setPosPin(employeeName: string, pin: string): void` |
| `setPrototype` | `backend/src/db.ts` | (none) | `setPrototype(entityName: string, prototypeName: string, userId: UserId): void` |
| `setRelationship` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `backend/src/primitives.ts` | `setRelationship(entityName: string, relationshipType: string, targetName: string, userId: UserId): void` |
| `setTerminalCurrency` | `backend/src/db-stock.ts` | (none) | `setTerminalCurrency(terminalName: string, currency: string \| null): void` |
| `setTranslation` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `frontend/src/lib/api.ts` | `setTranslation(conceptName: string, languageName: string, text: string, userId: UserId = asUserId(1)): void` |
| `setupEquityStructure` | `backend/src/db.ts` | (none) | `setupEquityStructure(businessName: BusinessName, structure: EntityStructure, userId: UserId, coaFamily?: string, partnerNames?: string[]): void` |
| `setUserActive` | `backend/src/auth.ts` | (none) | `setUserActive(userId: number, active: boolean): void` |
| `setUserRoles` | `backend/src/auth.ts` | (none) | `setUserRoles(userId: number, roleNames: string[]): void` |
| `setVocabularyPreference` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `setVocabularyPreference(conceptName: string, scope: 'business' \| 'user', scopeId: number, preferredAlternateName: string): void` |
| `signOff` | `backend/src/db.ts` | (none) | `signOff(shiftId: number): void` |
| `signOn` | `backend/src/db.ts` | (none) | `signOn(employeeName: string, locationName: string): PosShift` |
| `stageApPayment` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `stageApPayment(input: ApPaymentInput): void` |
| `stageApPurchase` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `stageApPurchase(input: ApPurchaseInput): void` |
| `stageArReceipt` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `stageArReceipt(input: ArReceiptInput): void` |
| `stageArSale` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `stageArSale(input: ArSaleInput): void` |
| `stageBomComponent` | `backend/src/db.ts` | (none) | `stageBomComponent(input: {   assemblyItem: string; business: string; componentItem: string; quantity: number; unit: string; }): void` |
| `stageLine` | `backend/src/db.ts` | `backend/src/db-reports.ts`, `backend/src/db-stock.ts`, `backend/src/primitives.ts`, `frontend/src/lib/api.ts` | `stageLine(line: StagedLine): void` |
| `stagePurchaseOrder` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `stagePurchaseOrder(input: PurchaseOrderInput): void` |
| `stageQuantityMovementLine` | `backend/src/db-stock.ts` | (none) | `stageQuantityMovementLine(business: BusinessName, ledger: LedgerName, reference: string, account: AccountName, deltaQuantity: number, transdate: string, locationName?: LocationName, accountId?: number): void` |
| `stageSalesOrder` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `stageSalesOrder(input: SalesOrderInput): void` |
| `stageStockDispatch` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `stageStockDispatch(input: StockDispatchInput): void` |
| `stageStockReceipt` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `stageStockReceipt(input: StockReceiptInput): void` |
| `todayAtLocation` | `backend/src/db-stock.ts` | `backend/src/db.ts` | `todayAtLocation(locationName: LocationName): string` |
| `todayIsoDate` | `frontend/src/lib/format.ts` | (none) | `todayIsoDate(): string` |
| `toTreePaths` | `frontend/src/lib/treeAdapter.ts` | (none) | `toTreePaths(entities: EntityNode[]): TreeItem[]` |
| `transferStock` | `backend/src/db-stock.ts` | `backend/src/db.ts`, `frontend/src/lib/api.ts` | `transferStock(business: BusinessName, ledger: LedgerName, itemName: ItemName, fromLocationName: LocationName, toLocationName: LocationName, quantity: number, reference: string, userId = 1, transdate?: string, combinationShape?: [string, string][], combinationValuesAfterLocation?: string[]): void` |
| `unescapeAscii` | `shared-fixtures/csv.ts` | (none) | `unescapeAscii(text: string): string` |
| `unregisterBankAccount` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `unregisterBankAccount(accountName: string, userId: UserId): void` |
| `updateEntity` | `backend/src/db.ts` | `backend/src/auth.ts`, `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/primitives.ts`, `frontend/src/lib/api.ts` | `updateEntity(id: number, input: EntityUpdate, userId: UserId): EntityNode` |
| `verifyCustomer` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `verifyCustomer(customerName: string, approve: boolean): void` |
| `verifyPassword` | `backend/src/password.ts` | `backend/src/auth.ts`, `backend/src/db.ts` | `verifyPassword(password: string, stored: string): boolean` |
| `verifyPosPin` | `backend/src/db.ts` | (none) | `verifyPosPin(employeeName: string, pin: string): boolean` |
| `writeCsv` | `shared-fixtures/csv.ts` | `shared-fixtures/add-brand-translation.ts`, `shared-fixtures/add-header-translations.ts`, `shared-fixtures/add-journal-remaining-translations.ts`, `shared-fixtures/add-journal-translations.ts`, `shared-fixtures/add-menu-translations.ts` | `writeCsv(rows: Record<string, string>[], headers: string[]): string` |
| `writeOffStock` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `writeOffStock(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, quantity: number, unitCostMinor: number, writeOffExpenseAccount: AccountName, /** @deprecated No longer used — resolves to that same, real    * product's own, real Inventory sub-account directly. Kept only so    * existing callers don't need a breaking API change. */   inventoryAccount: string, reason: string, userId: UserId, transdate?: string, locationName?: LocationName): void` |

612 real, indexed names (249 types, 363 functions) across 35 real, core files.
