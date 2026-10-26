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
- `backend/src/auth-middleware.ts` imports: `./auth.js`, `./db.js`, `./session-context.js`, `./db.js`
- `backend/src/auth.ts` imports: `./db.js`, `./primitives.js`, `./password.js`
- `backend/src/db-journal.ts` imports: `./db.js`, `./primitives.js`, `./db.js`, `./db-stock.js`
- `backend/src/db-matrix-reports.ts` imports: `./db.js`, `./db.js`, `./db-reports.js`, `./db.js`
- `backend/src/db-reports.ts` imports: `./db.js`, `./primitives.js`, `./db.js`, `./primitives.js`
- `backend/src/db-seed.ts` imports: `./db.js`, `./db.js`
- `backend/src/db-stock.ts` imports: `./db.js`, `./db.js`, `./primitives.js`, `./session-context.js`, `./db.js`
- `backend/src/db.ts` imports: `./sqlite-runtime.js`, `./password.js`, `./primitives.js`, `./db-reports.js`, `./db-seed.js`, `./db-reports.js`, `./db-journal.js`, `./db-journal.js`, `./db-stock.js`, `./db-stock.js`
- `backend/src/invoice.ts` imports: `./db.js`
- `backend/src/primitives.ts` imports: `./db.js`, `./db.js`
- `backend/src/server.ts` imports: `./db.js`, `./routes/entities.js`, `./routes/reports.js`, `./routes/matrix-reports.js`, `./routes/menu.js`, `./routes/i18n.js`, `./routes/businesses.js`, `./routes/journal.js`, `./routes/contacts.js`, `./routes/items.js`, `./routes/products.js`, `./routes/invoices.js`, `./routes/stock-lots.js`, `./routes/locations.js`, `./routes/hierarchy.js`, `./routes/departments.js`, `./routes/pos.js`, `./routes/arap.js`, `./routes/customer-registration.js`, `./routes/auth.js`, `./routes/stock.js`, `./routes/invoice.js`, `./routes/period.js`, `./routes/projects.js`, `./routes/recording.js`, `./recording.js`, `./auth-middleware.js`
- `frontend/src/lib/api.ts` imports: `./state.svelte`
- `frontend/src/lib/canned-journal.ts` imports: `./api`
- `frontend/src/lib/entityTree.ts` imports: `./api`
- `frontend/src/lib/menu.ts` imports: `./state.svelte`
- `frontend/src/lib/pagination.ts` imports: `./state.svelte`
- `frontend/src/lib/session.ts` imports: `./api`
- `frontend/src/lib/state.svelte.ts` imports: `./api`, `./api`
- `frontend/src/lib/treeAdapter.ts` imports: `./api`

## Call Graph Summary (real, direct invocation counts — see `make call-graph` for the complete, standalone report)

Top 15 most-referenced functions across these 40 real, core files:
- `create`: 158
- `requireEntity`: 110
- `asAccountName`: 88
- `asAccountName`: 88
- `stageLine`: 66
- `asUserId`: 61
- `asBusinessName`: 53
- `asBusinessName`: 53
- `asLedgerName`: 48
- `asLedgerName`: 48
- `supersedeEntity`: 42
- `asItemName`: 39
- `asItemName`: 39
- `setTranslation`: 34
- `setAccountCurrency`: 33

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
requireGlobalRole(...roles: string[]): void
```

### `backend/src/auth.ts`

**Functions**:

```ts
listUsers(): UserSummary[]
listRoles(): 
createUser(username: string, password: string, roleNames: string[]): UserSummary
setUserRoles(userId: number, roleNames: string[]): void
getUserRoleMatrix(businessName: BusinessName): UserRoleMatrix
setUserRoleInBusiness(businessName: BusinessName, username: string, roleName: string, userId: UserId): void
unsetUserRoleInBusiness(businessName: BusinessName, username: string, roleName: string, userId: UserId): void
userHasBusinessAdminRole(businessName: BusinessName, username: string): boolean
provisionBusinessAdminUser(businessName: BusinessName, createdBy: UserId): 
canUserPostToLedger(business: BusinessName, ledger: LedgerName, user: { username: string; roles: string[] }): boolean
setUserActive(userId: number, active: boolean): void
changePassword(userId: number, newPassword: string): void
changeOwnPassword(userId: number, currentPassword: string, newPassword: string): void
login(username: string, password: string): 
logout(token: string): void
setSessionBusiness(token: string, businessName: string): void
getSessionBusiness(token: string): string | null
setSessionProfitCenter(token: string, profitCenterName: string | null): void
getSessionProfitCenter(token: string): string | null
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
interface UserRoleMatrix {
  users: string[];
  roles: string[];
  assignments: { user: string; role: string }[];
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

**Exported variables**:

- `BUSINESS_ADMIN_ROLE`

### `backend/src/db-journal.ts`

**Functions**:

```ts
stageLine(line: StagedLine): void
getStagedLines(reference: string, business: BusinessName, ledger: LedgerName): StagedLine[]
createRecurringJournal(business: BusinessName, ledger: LedgerName, reference: string, startDate: string, recurrence: Recurrence, lines: RecurringJournalLine[], userId: UserId, description?: string, recurrenceCount?: number): void
ensureLocationScopedAccount(baseAccountName: string, locationName: string, userId: UserId): string
stageARReceipt(input: ARReceiptInput): void
postARReceipt(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
stageAPPayment(input: APPaymentInput): void
postAPPayment(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
stagePurchaseOrder(input: PurchaseOrderInput): void
postPurchaseOrder(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
clockInToProject(employeeName: EmployeeName, projectExpenseAccount: AccountName, business: BusinessName, ledger: LedgerName, userId: UserId): EmployeeClock
clockOutOfProject(employeeName: EmployeeName, business: BusinessName, ledger: LedgerName, userId: UserId): void
getOpenProjectClockForEmployee(employeeName: EmployeeName): EmployeeClock | undefined
stageOrderReceipt(input: OrderReceiptInput): void
postOrderReceipt(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
stageLocation(input: LocationStagingInput): void
postLocation(reference: string, business: BusinessName, userId: UserId): TypedNode<'LocationEntityName'>
stageSalesOrder(input: SalesOrderInput): void
postSalesOrder(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
stageOrderDispatch(input: OrderDispatchInput): void
postOrderDispatch(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void
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
  bankReference?: string;
}
interface RecurringJournalLine {
  account: string;
  amount_minor: number;
  memo?: string;
  effective_date?: string;
}
interface ARReceiptInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  customer: CustomerName;
  amount_minor: number;
  transdate?: string;
  description?: string;
}
interface APPaymentInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  vendor: ProviderName;
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
  location?: string;
  transdate?: string;
  description?: string;
}
interface EmployeeClock {
  employee: string;
  po_reference: string;
  project_expense_account: string;
  clocked_in_at: string;
}
interface OrderReceiptInput {
  reference: string;
  business: string;
  ledger: string;
  po_reference: string;
  item: string;
  item_qty?: string | null;
  vendor: string;
  quantity: number;
  value_minor: number;
  tax_minor?: number;
  transdate?: string;
  description?: string;
}
interface LocationStagingInput {
  reference: string;
  business: BusinessName;
  location_name: string;
  city: string;
  location_type: string;
  bottle_capacity?: number | null;
  carton_capacity?: number | null;
  timezone: string;
}
interface SalesOrderInput {
  reference: string;
  business: string;
  ledger: string;
  customer: string;
  item: string;
  quantity: number;
  price_minor: number;
  location?: string;
  transdate?: string;
  description?: string;
}
interface OrderDispatchInput {
  reference: string;
  business: string;
  ledger: string;
  so_reference: string;
  item?: string | null;
  item_qty?: string | null;
  customer: string;
  quantity: number;
  unit_cost_minor?: number | null;
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
  currency: string | null;
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
type Recurrence = 'once' | 'weekly' | 'monthly' | 'yearly';
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
  Item: string[];
  Category: string[];
  Location: string[];
  [hierarchyName: string]: string[];
}
type MatrixAxis = 'Item' | 'Location' | 'Consolidated' | (string & {});
```

### `backend/src/db-reports.ts`

**Functions**:

```ts
getBusinessReports(business: string): ReportRow[]
setAccountCurrency(accountName: string, currency: string | null, entityId?: number): void
ensureCurrencyAccount(baseAccountId: number, currency: string, userId: UserId): 
ensureProfitCenterRetainedEarningsAccount(baseAccountId: number, profitCenterName: string, userId: UserId): 
resolveCashAtBankAccount(business: BusinessName, currency: string | undefined, userId: UserId): 
getChartOfAccounts(business: string): ChartRow[]
getLedgerBalancesByHierarchyStructural(businessName: BusinessName, ledgerName: LedgerName, hierarchyPath: string[], fromDate?: string, toDate?: string, excludeCloseEntries = false): Map<number, Map<string | null, number>>
getLedgerBalancesByLocationStructural(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, excludeCloseEntries = false): Map<number, Map<string | null, number>>
getLedgerBalances(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, excludeCloseEntries = false): Map<number, number>
getTrialBalance(businessName: BusinessName, ledgerName: LedgerName, asOfDate?: string): TrialBalance
getBalanceSheet(businessName: BusinessName, ledgerName: LedgerName, asOfDate?: string): BalanceSheet
buildCategoryTree(lines: StatementLine[], accountIdByName: Map<string, number>, rootName: string, normalSide: 'debit' | 'credit' = 'debit', knownRootId?: number): CategoryTreeNode[]
getProfitAndLoss(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, excludeCloseEntries = true): ProfitAndLoss
buildProfitAndLossFromBalances(business: string, balances: Map<number, number>): ProfitAndLoss
getProfitAndLossByHierarchy(businessName: BusinessName, ledgerName: LedgerName, hierarchyPath: string[], fromDate?: string, toDate?: string): ProfitAndLossByGroup[]
getProfitAndLossForHierarchyGroup(businessName: BusinessName, ledgerName: LedgerName, hierarchyPath: string[], groups: { name: string; parentName: string | null }[], groupName: string, fromDate?: string, toDate?: string): ProfitAndLoss
getProfitAndLossByHierarchyTree(businessName: BusinessName, ledgerName: LedgerName, hierarchyPath: string[], hierarchyName: string, fromDate?: string, toDate?: string): ProfitAndLossByGroupNode[]
getTrialBalanceComparison(businessName: BusinessName, ledgerA: LedgerName, ledgerB: LedgerName): TrialBalanceComparison
previewCloseBooks(businessName: BusinessName, ledger: LedgerName, asOfDate: string, retainedEarningsAccount: string, hierarchyPath: string[] = []): CloseBooksPreview
closeBooks(business: BusinessName, ledger: LedgerName, asOfDate: string, retainedEarningsAccount: string, userId: UserId, hierarchyPath: string[] = []): CloseBooksResult
resolveRolloverLines(business: BusinessName, oldLedger: LedgerName, newLedger: LedgerName, asOfDate: string, userId: UserId): ResolvedRollover
rolloverToNewPeriod(business: BusinessName, oldLedger: LedgerName, newLedger: LedgerName, asOfDate: string, userId: UserId): RolloverResult
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
interface ProfitAndLossByGroup {
  group: string | null;
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
  groupBreakdown: { group: string | null; netIncomeMinor: number }[];
  profitCenterBreakdown: { profitCenter: string | null; netIncomeMinor: number }[];
}
interface CloseBooksLine {
  account: string;
  accountId?: number;
  amount_minor: number;
}
interface CloseBooksPreview {
  lines: CloseBooksLine[];
  netIncomeMinor: number;
  accountsZeroed: number;
  groupBreakdown: { group: string | null; netIncomeMinor: number }[];
  profitCenterBreakdown: { profitCenter: string | null; netIncomeMinor: number }[];
}
interface RolloverResult {
  newLedger: LedgerName;
  accountsCarriedForward: number;
  openingBalanceReference: string;
}
interface RolloverLine {
  account: string;
  amount_minor: number;
}
interface ResolvedRollover {
  reference: string;
  lines: RolloverLine[];
  accountsCarriedForward: number;
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
stageQuantityMovementLine(business: BusinessName, ledger: LedgerName, reference: string, account: AccountName, deltaQuantity: number, transdate: string, accountId?: number): void
postStagedQuantityMovement(business: BusinessName, ledger: LedgerName, reference: string, userId: UserId): void
postQuantityMovement(business: BusinessName, ledger: LedgerName, reference: string, account: AccountName, deltaQuantity: number, userId: UserId, transdate?: string, locationName?: LocationName, accountId?: number): void
getLocationTypes(): string[]
createLocationType(name: string, userId: UserId): void
setLocation(name: string, location: Location, business?: BusinessName): void
getLocation(name: string, business?: BusinessName): Location | undefined
todayAtLocation(locationName: LocationName): string
getItemLocation(itemName: ItemName, locationName: LocationName): ItemLocationLevels
setItemLocationLevelDetails(itemName: ItemName, locationName: LocationName, levels: Omit<ItemLocationLevels, 'quantity_on_hand'>, business?: BusinessName, ledger?: LedgerName, userId?: UserId): void
getLocationCapacityStatus(locationName: LocationName): LocationCapacityStatus
createPosTerminal(terminalName: string, locationName: LocationName, userId: UserId): void
listPosTerminals(locationName: string): 
setTerminalCurrency(terminalName: string, currency: string | null): void
getEffectiveSaleCurrency(terminalName: string | undefined): string | null
ensureLocationCapacityAccount(business: BusinessName, ledger: LedgerName, locationName: LocationName, userId: UserId): 
adjustLocationCapacity(business: BusinessName, ledger: LedgerName, locationName: LocationName, itemName: ItemName, itemQuantityDelta: number, transdate: string, userId: UserId, referenceSuffix: string): void
getStorageSpaceReport(): StorageSpaceLocationGroup[]
getInventoryListingByLocation(business?: BusinessName, hierarchyName?: string): InventoryListingLocationGroup[]
getStockMovementReport(business: string, ledgerName: string, fromDate?: string, toDate?: string, hierarchyName?: string): StockMovementReport
getInventoryListing(limit = 100, offset = 0): InventoryListingRow[]
countInventoryListing(): number
setItemLocationLevels(itemName: ItemName, locationName: LocationName, levels: {
    minLevel?: number | null;
    maxLevel?: number | null;
    reorderLevel?: number | null;
    shelfSide?: string | null;
    rack?: string | null;
    level?: number | null;
  }, business?: BusinessName, ledger?: LedgerName, userId?: UserId): void
ensureUnitsTrackingBaseAccounts(business: BusinessName, userId: UserId): 
receiveItems(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, locationName: LocationName, quantity: number, userId: UserId, transdate?: string, combinationValues?: string[], combinationShape?: [string, string][]): void
receiveStockPhysical(input: ReceiveStockPhysicalInput, userId: UserId): void
resolveReceiveAccounts(business: BusinessName, itemName: ItemName, combinationShape: [string, string][] | undefined, combinationValues: string[] | undefined, userId: UserId): ResolvedReceiveAccounts | null
dispatchItems(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, locationName: LocationName, quantity: number, userId: UserId, transdate?: string, combinationValues?: string[], combinationShape?: [string, string][]): void
transferItems(business: BusinessName, ledger: LedgerName, itemName: ItemName, fromLocationName: LocationName, toLocationName: LocationName, quantity: number, reference: string, userId = 1, transdate?: string, combinationShape?: [string, string][], combinationValuesAfterLocation?: string[]): void
transferStock(input: TransferStockInput, userId: UserId): void
getBelowReorderStock(): BelowReorderRow[]
setItemSourceLeadTime(itemName: ItemName, vendorName: ProviderName, days: number, userId: UserId): void
getItemLeadTimes(itemName: ItemName): 
getStockOutRiskReport(windowDays: number = 2): StockOutRiskRow[]
createStockTake(locationName: LocationName, takeDate: string, userId: UserId, business?: BusinessName): number
getStockTake(id: number): StockTake | undefined
recordStockTakeCount(stockTakeId: number, itemName: ItemName, countedQuantity: number): void
completeStockTake(stockTakeId: number, business: BusinessName, ledger: LedgerName, varianceExpenseAccount: AccountName, /** @deprecated See docs/stock-api-reference.md § Stock takes. */
  inventoryAccount: string, unitCostMinorByItem: Record<string, number>, userId: UserId): void
writeOffItems(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, quantity: number, unitCostMinor: number, writeOffExpenseAccount: AccountName, /** @deprecated See docs/storage-space-as-currency-design.md § 24, D8 (write-off). */
  inventoryAccount: string, reason: string, userId: UserId, transdate?: string, locationName?: LocationName, combinationValues?: string[], combinationShape?: [string, string][]): void
receiveLot(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, lotNumber: string, receivedDate: string, expirationDate: string | null, quantity: number, userId: UserId, costBasisMinor?: number): void
consumeFromLots(itemName: ItemName, quantity: number): 
getExpiringStock(asOfDate: string, withinDays: number): ExpiringLot[]
createSystemEntity(name: string, parentId: number | null): number
placeOrder(orderReference: string, business: BusinessName, ledger: LedgerName, quantity: number, priceMinor: number, userId: UserId, transdate?: string, vendor?: ProviderName, item?: ItemName, location?: LocationName): void
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
interface InventoryListingRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  min_level: number | null;
  max_level: number | null;
  reorder_level: number | null;
}
interface InventoryListingLocationGroup {
  location: string;
  city: string | null;
  group: string | null;
  rows: InventoryListingRow[];
  total_on_hand: number;
  capacity: LocationCapacityStatus;
}
interface StorageSpaceRow {
  location: string;
  currency: string;
  kind: 'Installed' | 'Occupied' | 'Remaining';
  balance_minor: number;
}
interface StorageSpaceLocationGroup {
  location: string;
  currencies: { currency: string; installed_minor: number; occupied_minor: number; remaining_minor: number; balanced: boolean }[];
}
interface StockMovementRow {
  item: string;
  category: string | null;
  quantity: number;
  date: string;
}
interface StockMovementReport {
  receipts: OrderReceiptRow[];
  transfers: StockTransferRow[];
  sales: StockSaleRow[];
}
interface ReceiveStockPhysicalInput {
  business: BusinessName;
  ledger: LedgerName;
  reference: string;
  itemName: ItemName;
  locationName: LocationName;
  quantity: number;
  transdate?: string;
  combinationValues?: string[];
  combinationShape?: [string, string][];
}
interface ResolvedReceiveAccounts {
  inventoryAccount: string;
  payableAccount: string;
  unitCostMinor: number | null;
}
interface TransferStockInput {
  business: BusinessName;
  ledger: LedgerName;
  itemName: ItemName;
  fromLocationName: LocationName;
  toLocationName: LocationName;
  quantity: number;
  reference: string;
  transdate?: string;
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
asLocationName(name: string): LocationName
asEmployeeName(name: string): EmployeeName
asCustomerName(name: string): CustomerName
asProviderName(name: string): ProviderName
asItemName(name: string): ItemName
getEntityTree(businessName?: string): (EntityNode &
getEntity(id: number): EntityNode | undefined
getEntityHistory(id: number): EntityHistoryRow[]
resolveItemId(itemName: ItemName): number | undefined
requireGlobalCoaCategory(categoryName: string): TypedNode<'RootName'>
isGenuineCategoryOrItemsRoot(name: string): boolean
createEntityRaw(input: NewEntity, userId: UserId): EntityNode
supersedeEntity(id: number, input: EntityUpdate, userId: UserId): EntityNode
listLineTypes(): string[]
setLineType(entityName: string, lineType: string | null, userId: UserId): void
setItemStorageOrigin(itemName: ItemName, origin: 'Hot' | 'Cold' | null, userId: UserId): void
getItemStorageOrigin(itemName: ItemName): 'Hot' | 'Cold' | undefined
setLanguageDirection(languageName: string, direction: 'LTR' | 'RTL' | null, userId: UserId): void
getLanguageDirection(languageName: string): 'LTR' | 'RTL' | undefined
reorderSiblings(entityId: EntityId, direction: 'up' | 'down', userId: UserId): void
reorderSiblingsBulk(entityIds: number[], direction: 'up' | 'down', userId: UserId): void
setRelationship(entityName: string, relationshipType: string, targetName: string, userId: UserId): void
getRelationship(entityName: string): Relationship | undefined
getEntitiesWithRelationship(relationshipType: string): 
getHierarchy(rootName: string, relationshipType?: string, knownRootId?: number): HierarchyNode
resolveBusinessLocationsRootId(businessName: string): number | undefined
getOrganizationChart(businessName: BusinessName): OrganizationChart
revokeEntity(id: number, userId: UserId): void
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
  revenueOrExpenseAccount: string | { name: string; id: number } | ((line: InvoiceLineInput & { id: number }) => string | { name: string; id: number }), taxAccount: string, userId: UserId, restockInventory = false, counterpartyAccountOverride?: string): void
allocatePayment(invoiceId: number, paymentReference: string, allocatedMinor: number, allocationDate: string, paymentAccount: string, userId: UserId, skipJournalPosting = false): void
getInvoiceOutstandingMinor(invoiceId: number): number
getAgedInvoices(business: BusinessName, ledger: LedgerName, invoiceType: 'AR' | 'AP', asOfDate: string): AgedInvoiceRow[]
getAgedSummary(business: BusinessName, ledger: LedgerName, invoiceType: 'AR' | 'AP', asOfDate: string): AgedSummaryRow[]
getCustomerStatement(business: BusinessName, ledger: LedgerName, customerName: string, asOfDate: string): CustomerStatement
getCounterpartyHistory(business: BusinessName, ledger: LedgerName, counterpartyName: string): HistoryLine[]
getItemByUpc(upc: string): ItemSummary | undefined
isDescendantOf(entityName: string, rootName: string): boolean
getHierarchyChain(leafName: ItemName | LocationName): HierarchyChainNode[]
ensureItemSalesCogsAccounts(itemName: ItemName, userId: UserId, tier?: string, business?: BusinessName, profitCenter?: string): 
ensureItemInventoryAccount(itemName: ItemName, userId: UserId, tier?: string, business?: BusinessName, profitCenter?: string): 
ensureItemLocationInventoryAccount(itemName: ItemName, locationName: LocationName, userId: UserId, tier?: string, business?: BusinessName, profitCenter?: string): 
ensureItemLocationQuantityAccount(itemName: ItemName, locationName: LocationName, userId: UserId, tier?: string, business?: BusinessName): 
resolveItemLocationQuantityAccountId(itemName: ItemName, locationName: LocationName, tier?: string): number | undefined
ensureHierarchyGrouping(businessName: BusinessName, groupingName: string, userId: UserId): 
ensureHierarchyValue(businessName: BusinessName, groupingName: string, valueName: string, userId: UserId): 
deleteHierarchyValue(businessName: BusinessName, groupingName: string, valueName: string, userId: UserId): void
deleteHierarchyGrouping(businessName: BusinessName, groupingName: string, userId: UserId): void
createProfitCenter(businessName: BusinessName, profitCenterName: string, userId: UserId): 
getProfitCenters(businessName: BusinessName): 
getAccountProfitCenter(accountId: number): string | null
defineProductShape(businessName: BusinessName, dimensions: [string, string][], userId: UserId): 
ensureProductInstance(businessName: BusinessName, definitionDimensions: [string, string][], values: string[], userId: UserId): 
getCombinationDisplayName(entityId: number): string
climbInstanceTree(instanceId: number): 
getCombinationByUpc(upc: string): 
resolveBusinessCoaAccountId(businessName: BusinessName, accountName: string): number
ensureCombinationAccountLeaf(baseAccountName: string, instanceTopNode: { id: number; name: string }, userId: UserId, baseAccountId?: number): 
ensureLocationStorageRoot(business: BusinessName, locationName: string, userId: UserId): 
ensureStorageCapacityStructure(parentEntity: { id: number; name: string }, userId: UserId): 
convertStorageSpace(business: BusinessName, ledger: LedgerName, itemName: ItemName, definitionDimensions: [string, string][], fromValues: string[], toValues: string[], quantity: number, userId: UserId, reference?: string): void
openStorageContainer(business: BusinessName, ledger: LedgerName, locationName: LocationName, itemName: ItemName, definitionDimensions: [string, string][], containerValues: string[], cartonsOpened: number, unitValues: string[], unitsProduced: number, userId: UserId, reference?: string): void
resolveOpenContainerAccounts(business: BusinessName, locationName: LocationName, itemName: ItemName, definitionDimensions: [string, string][], containerValues: string[], unitValues: string[], userId: UserId): ResolvedOpenContainerAccounts
getBusinessHierarchy(businessName: BusinessName): HierarchyGroupingWithValues[]
getBusinessProductShapes(businessName: BusinessName): [string, string][][]
getItemUnitCostMinor(itemName: ItemName): number | null
ensureItemTier(baseProductName: ItemName, tier: string, userId: UserId, business?: BusinessName): 
ensureItemTierLocationLeaf(tierItemName: string, locationName: LocationName, userId: UserId, tierItemId?: number): 
ensureItemLocationLeaf(itemName: ItemName, locationName: LocationName, userId: UserId, business?: BusinessName): 
getLocationForAccount(accountName: AccountName): string | undefined
getHierarchyGroupForAccount(accountName: AccountName, hierarchyName: string): string | undefined
getQualifiedDisplayName(entityId: number): string
ensureItemQuantityAccounts(itemName: ItemName, userId: UserId): 
getHierarchyGroupForLocation(locationName: string, hierarchyName: string): string | undefined
resolveDispatchLocation(itemName: ItemName, logicalLocationName: LocationName): LocationName
completePosSale(input: PosSaleInput, userId: UserId): PosSaleResult
resolveTransferAccounts(business: BusinessName, itemName: ItemName, fromLocationName: LocationName, toLocationName: LocationName, userId: UserId): ResolvedTransferAccounts
completeCashPurchase(input: CashPurchaseInput, userId: UserId): CashPurchaseResult
payEmployeeWages(input: PayEmployeeWagesInput, userId: UserId): PayEmployeeWagesResult
recordReminderSent(customerName: string): number
resetReminderLevel(customerName: string): void
getReminderCandidates(business: BusinessName, ledger: LedgerName, asOfDate: string): ReminderCandidate[]
getContact(entityName: string): Contact | undefined
recordInvoiceLine(reference: string, business: string, ledger: string, description: string, quantity: number | null, unitPriceMinor: number | null, amountMinor: number, taxMinor: number): void
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
setHierarchyParent(entityName: string, hierarchyName: string, parentName: string, userId: UserId, entityId?: number, targetId?: number): void
getHierarchyParent(entityName: string, hierarchyName: string): string | undefined
deleteHierarchyParent(entityName: string, hierarchyName: string, userId: UserId): void
setContactType(contactName: string, typeName: string, userId: UserId): void
getContactTypes(contactName: string): string[]
getContactBaseAccounts(contactName: string): string[]
createProvider(name: string, userId: UserId): 
createCustomer(name: string, userId: UserId): 
createEmployee(name: string, placeOfEmployment: string, userId: UserId): 
getHierarchyChildren(parentName: string, hierarchyName: string): string[]
getHierarchyAssignments(hierarchyName: string): Record<string, string>
getEntityLinksPointingAt(targetName: string): 
getEntitiesWithLink(linkType: string): 
getHierarchyLinksPointingAt(targetName: string): 
getHierarchyGroups(hierarchyName: string): 
getHierarchyAncestorChain(entityName: string, hierarchyName: string): string[]
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
setItemProduct(itemName: string, productName: string | null, userId: UserId): void
getItem(entityName: string): Item | undefined
setItem(entityName: string, item: Partial<Item>): void
listItems(businessName: BusinessName, limit?: number, offset = 0): ItemSummary[]
countItems(businessName: BusinessName): number
createItem(name: string, parentCategoryOrItemsRoot: string, userId: UserId, businessName?: BusinessName): void
listItemSources(itemName: string): ItemSource[]
addOrUpdateItemSource(input: ItemSourceInput): void
getItemPriceForCurrency(itemName: string, currency: string | null, productInstanceId?: number): number | null
setBusinessHomeCurrency(businessName: string, currencyCode: string, userId: UserId): void
getBusinessHomeCurrency(businessName: string): string | null
setBusinessReportingPeriod(businessName: string, financialYearStart: string, frequency: ReportingFrequency, userId: UserId): void
getBusinessReportingPeriod(businessName: string): 
getReportingPeriods(businessName: string, asOfDate?: string): ReportingPeriod[]
nominateLocationCurrency(locationName: string, currencyCode: string, userId: UserId, business?: BusinessName): void
getLocationCurrencies(locationName: string, business?: BusinessName): string[]
ensureCurrencyPair(businessName: BusinessName, fromCurrency: string, toCurrency: string, userId: UserId): 
setCurrencyExchangeRate(businessName: BusinessName, fromCurrency: string, toCurrency: string, userId: UserId, buyRateMinor?: number, sellRateMinor?: number): void
getCurrencyExchangeRate(businessName: BusinessName, fromCurrency: string, toCurrency: string, side: 'buy' | 'sell'): number | null
listCurrencyPairs(currencies: string[]): 
deleteItemSource(id: number): void
getLanguages(): 
getDefaultLanguage(): string | null
setDefaultLanguage(languageName: string, userId: UserId): void
getMenuTree(opts?: { businessName?: string; userId?: number }): MenuSectionRow[]
setMenuOverride(menuItemKey: string, scope: 'business' | 'user', scopeId: number, overrideLabel: string | null, hidden: boolean, userId: UserId = asUserId(1)): void
deleteMenuOverride(menuItemKey: string, scope: 'business' | 'user', scopeId: number, userId: UserId = asUserId(1)): void
getVocabularyWords(): VocabularyWord[]
getVocabularyAlternates(wordName: string): string[]
getConceptsWithAlternates(): ConceptWithAlternates[]
ensureVocabularyAlternate(conceptName: string, desiredText: string, businessName: string, userId: UserId): string
setVocabularyPreference(conceptName: string, scope: 'business' | 'user', scopeId: number, preferredAlternateName: string): void
deleteVocabularyPreference(conceptName: string, scope: 'business' | 'user', scopeId: number): void
getLocalizedText(language: string, opts?: { businessName?: string; userId?: number }): Record<string, string>
setTranslation(conceptName: string, languageName: string, text: string, userId: UserId = asUserId(1)): void
getTranslationsReferencing(conceptName: string): 
deleteTranslationConcept(conceptName: string, userId: UserId): void
getTranslation(conceptName: string, languageName: string): string | null
getBusinesses(): 
getLedgers(businessName: BusinessName): 
setActiveLedger(businessName: BusinessName, ledgerName: LedgerName, userId: UserId): void
getActiveLedger(businessName: BusinessName): LedgerName | null
addFinancialStatementNote(businessName: BusinessName, noteText: string, userId: UserId): 
getFinancialStatementNotes(businessName: BusinessName): 
createLocation(businessName: BusinessName, locationName: string, userId: UserId): TypedNode<'LocationEntityName'>
createAndConfigureLocation(businessName: BusinessName, locationName: string, location: StockLocation, userId: UserId, group?: string, groupingName?: string): TypedNode<'LocationEntityName'>
deleteLocation(businessName: BusinessName, locationName: string, userId: UserId): void
ensureDepartmentsRoot(businessName: BusinessName, userId: UserId): 
createDepartment(businessName: BusinessName, departmentName: string, userId: UserId): TypedNode<'DepartmentEntityName'>
ensureDepartmentAccounts(businessName: BusinessName, departmentName: string, userId: UserId): 
createAndConfigureDepartment(businessName: BusinessName, departmentName: string, userId: UserId): TypedNode<'DepartmentEntityName'>
deleteDepartment(businessName: BusinessName, departmentName: string, userId: UserId): void
listDepartments(businessName: BusinessName): 
setEmployeeDepartment(employeeName: string, departmentName: string, userId: UserId, employeeId?: number, departmentId?: number): void
getEmployeeDepartment(employeeName: string): string | undefined
deleteEmployeeDepartment(employeeName: string, userId: UserId): void
getEmployeeManager(employeeName: string): string | undefined
setEmployeeManager(employeeName: string, managerName: string, userId: UserId, employeeId?: number, managerId?: number): void
deleteEmployeeManager(employeeName: string, userId: UserId): void
getOrgChartStructure(businessName: BusinessName): OrgChartStructure
nominateBankAccount(businessName: BusinessName, bankAccountName: string, routingDetail: string, accountNumber: string, userId: UserId): 
getNominatedBankAccounts(businessName: BusinessName): 
getBusinessConfigurationReport(businessName: BusinessName): BusinessConfigurationReport
setupEquityStructure(businessName: BusinessName, structure: EntityStructure, userId: UserId, coaPrototype?: string, partnerNames?: string[]): void
getBusinessTypes(): BusinessTypeInfo[]
saveBusinessTypeAnswers(businessName: BusinessName, answers: Record<string, string>, userId: UserId): void
copyChartOfAccountsInto(business: TypedNode<string>, destRoot: TypedNode<string>, coaPrototype: string | undefined, userId: UserId): void
instantiateChartOfAccounts(businessName: BusinessName, coaPrototype: string | undefined, userId: UserId): void
createBusiness(businessName: BusinessName, financialYearLabel: string, userId: UserId, coaPrototype?: string, secondaryCurrencies?: string[], entityStructure?: EntityStructure, partnerNames?: string[], financialYearStart?: string, reportingFrequency?: ReportingFrequency): 
createLedger(businessName: BusinessName, ledgerName: LedgerName, userId: UserId): void
getChartOfAccountsPrototype(language: string): string[]
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
interface OrgChartGroup {
  group: string;
  locations: { location: string; employees: string[] }[];
}
interface OrganizationChart {
  business: string;
  companyWideEmployees: string[]; // "Place of Employment" points straight at the business itself
  groups: OrgChartGroup[];
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
interface ResolvedOpenContainerAccounts {
  containerSpaceAccount: string;
  containerOccupiedAccount: string;
  unitSpaceAccount: string;
  unitOccupiedAccount: string;
  containerSpaceAccountId: number;
  containerOccupiedAccountId: number;
  unitSpaceAccountId: number;
  unitOccupiedAccountId: number;
  inventoryFromAccount: string;
  inventoryToAccount: string;
  inventoryFromAccountId: number;
  inventoryToAccountId: number;
  unitCostMinor: number | null;
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
  tier?: string;
}
interface CashPurchaseInput {
  business: BusinessName;
  ledger: LedgerName;
  locationName: LocationName;
  vendorName: ProviderName;
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
interface ResolvedTransferAccounts {
  fromInventoryAccount: string;
  toInventoryAccount: string;
  unitCostMinor: number | null;
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
  currency: string | null;
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
interface ReportingPeriod {
  label: string;
  startDate: string;
  endDate: string;
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
interface OrgChartDepartment {
  name: string;
  employees: { name: string; location: string | null; managerName: string | null }[];
}
interface OrgChartStructure {
  business: string;
  departments: OrgChartDepartment[];
  unassignedEmployees: { name: string; location: string | null; managerName: string | null }[];
}
interface BusinessConfigurationReport {
  businessName: string;
  addresses: TypedAddress[];
  phones: TypedPhone[];
  ownerOrPartners: string[];
  bankAccounts: { name: string; routingDetail: string; accountNumber: string }[];
  homeCurrency: string | null;
  secondaryCurrencies: string[];
  hierarchies: HierarchyGroupingWithValues[];
  locations: { name: string; city: string; locationType: string }[];
  categories: string[];
  chartOfAccountsPrototype: string | null;
  notes: { name: string; text: string }[];
}
interface BusinessTypeInfo {
  name: string;
  questions: string[];
}
type BusinessName = string & { readonly __brand: 'BusinessName' };
type LedgerName = string & { readonly __brand: 'LedgerName' };
type AccountName = string & { readonly __brand: 'AccountName' };
type LocationName = string & { readonly __brand: 'LocationName' };
type EmployeeName = string & { readonly __brand: 'EmployeeName' };
type CustomerName = string & { readonly __brand: 'CustomerName' };
type ProviderName = string & { readonly __brand: 'ProviderName' };
type ItemName = string & { readonly __brand: 'ItemName' };
type UserId = number & { readonly __brand: 'UserId' };
type EntityId = number & { readonly __brand: 'EntityId' };
type ReportingFrequency = 'annual' | 'biannual' | 'quarterly' | 'monthly';
type EntityStructure = 'sole_trader' | 'partnership' | 'llc' | 'unlimited_liability' | 'publicly_traded';
```

**Exported variables**:

- `db`
- `typeBusinessName`
- `typeEmployeeName`
- `typeProviderName`
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
- `typeDepartmentEntityName`
- `typeExpenseCategoryName`
- `typeMenuSectionName`
- `typeMenuLinkName`
- `typeMenuLinkFlagName`
- `typeBusinessTypeName`
- `typeBusinessTypeQuestionsRootName`
- `typeBusinessTypeQuestionName`
- `PERIOD_MONTHS`
- `PER_BUSINESS_ROOTS`

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

### `backend/src/recording.ts`

**Functions**:

```ts
isRecording(userId: number): boolean
startRecording(userId: number, username: string): void
stopRecording(userId: number): Promise<void>
recordRequest(userId: number, screenName: string, sources: RequestSources): void
recordingMiddleware(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction): void
```

**Types**:

```ts
interface RequestSources {
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  body: Record<string, unknown>;
}
```

### `backend/src/server.ts`

### `backend/src/session-context.ts`

**Types**:

```ts
interface RealBusinessNode {
  readonly id: number;
  readonly name: string;
}
interface SessionContext {
  userId: number;
  business: RealBusinessNode;
  ledger: string;
}
```

**Exported variables**:

- `Session`

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
asLocationName(name: string): LocationName
asEmployeeName(name: string): EmployeeName
asCustomerName(name: string): CustomerName
asProviderName(name: string): ProviderName
asItemName(name: string): ItemName
compareVersions(a: string, b: string): number
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
interface HierarchyLinkPointingAt {
  entityName: string;
  hierarchyName: string;
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
interface ProfitAndLossByGroup {
  group: HierarchyGroupName | null;
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
interface HierarchyGroupRecord {
  name: string;
  parentName: string | null;
}
interface HierarchyGroupingWithValues {
  grouping: string;
  values: string[];
}
interface ReportingPeriod {
  label: string; startDate: string; endDate: string; }
  export const getReportingPeriods = (businessName: string, asOf?: string) =>
  request<ReportingPeriod[]>(`/businesses/${encodeURIComponent(businessName)}/reporting-periods${asOf ? `?asOf=${encodeURIComponent(asOf)}` : ''}`);
  export const nominateBankAccount = (businessName: string, bankAccountName: string, routingDetail: string, accountNumber: string) =>
  request<{ id: number }>(`/businesses/${encodeURIComponent(businessName)}/bank-accounts`, { method: 'POST', body: JSON.stringify({ bankAccountName, routingDetail, accountNumber }) });
  export interface BusinessConfigurationReport {
  businessName: string;
  addresses: { address_type: string; address1?: string; city?: string; [key: string]: unknown }[];
  phones: { phone_type: string; phone?: string; [key: string]: unknown }[];
  ownerOrPartners: string[];
  bankAccounts: { name: string; routingDetail: string; accountNumber: string }[];
  homeCurrency: string | null;
  secondaryCurrencies: string[];
  hierarchies: HierarchyGroupingWithValues[];
  locations: { name: string; city: string; locationType: string }[];
  categories: string[];
  chartOfAccountsPrototype: string | null;
  notes: { name: string; text: string }[];
}
interface StagedLine {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  description?: string;
  transdate?: string;
  account: AccountName;
  accountId?: number; // resolves name collisions — see docs/pm-frontend-reference.md
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
interface ARAPBaseInput {
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
interface UserRoleMatrix {
  users: string[];
  roles: string[];
  assignments: { user: string; role: string }[];
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
interface OrderReceiptInput {
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
interface OrderDispatchInput {
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
  combinationValues?: string[]; // set when a scanned barcode matches a specific combination — see docs/pm-frontend-reference.md
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
  currency: string | null;
  package_quantity: number | null;
  is_preferred: boolean;
  preference_notes: string | null;
}
interface ItemSourceInput {
  manufacturerName?: string | null;
  vendorName: ProviderName;
  vendorSku?: string | null;
  vendorUpc?: string | null;
  priceMinor?: number | null;
  currency?: string | null; // null = home currency; non-null = a separate priced row, never a conversion — see docs/pm-frontend-reference.md
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
  timezone: string; // IANA identifier, required — see docs/pm-frontend-reference.md
}
interface EmployeeClock {
  employee: string;
  po_reference: string;
  project_expense_account: string;
  clocked_in_at: string;
}
interface DepartmentRecord {
  id: number;
  name: string;
}
interface OrgChartEmployee {
  name: string;
  location: string | null;
  managerName: string | null;
}
interface OrgChartDepartment {
  name: string;
  employees: OrgChartEmployee[];
}
interface OrgChartStructure {
  business: string;
  departments: OrgChartDepartment[];
  unassignedEmployees: OrgChartEmployee[];
}
interface ResolvedOpenContainerAccounts {
  containerSpaceAccount: string;
  containerOccupiedAccount: string;
  unitSpaceAccount: string;
  unitOccupiedAccount: string;
  containerSpaceAccountId: number;
  containerOccupiedAccountId: number;
  unitSpaceAccountId: number;
  unitOccupiedAccountId: number;
  inventoryFromAccount: string;
  inventoryToAccount: string;
  inventoryFromAccountId: number;
  inventoryToAccountId: number;
  unitCostMinor: number | null;
}
interface PosTerminalRecord {
  name: string;
  currency: string | null;
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
interface ResolvedReceiveAccounts {
  inventoryAccount: string;
  payableAccount: string;
  unitCostMinor: number | null;
}
interface ResolvedTransferAccounts {
  fromInventoryAccount: string;
  toInventoryAccount: string;
  unitCostMinor: number | null;
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
  combinationValues?: string[]; // set when a scanned barcode matches a specific combination — see docs/pm-frontend-reference.md
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
  groups: { group: HierarchyGroupName; locations: { location: string; employees: string[] }[] }[];
}
interface CloseBooksResult {
  reference: string;
  netIncomeMinor: number;
  accountsZeroed: number;
  groupBreakdown: { group: HierarchyGroupName | null; netIncomeMinor: number }[];
  profitCenterBreakdown: { profitCenter: string | null; netIncomeMinor: number }[]; // per Profit Center, mirroring groupBreakdown
}
interface CloseBooksPreview {
  lines: {
  account: AccountName;
  accountId?: number; // resolves name collisions, same as StagedLine.accountId — see docs/pm-frontend-reference.md
  amount_minor: number;
  }[];
  netIncomeMinor: number;
  accountsZeroed: number;
  groupBreakdown: { group: HierarchyGroupName | null; netIncomeMinor: number }[];
  profitCenterBreakdown: { profitCenter: string | null; netIncomeMinor: number }[];
}
interface ResolvedRollover {
  reference: string;
  lines: { account: AccountName; amount_minor: number }[];
  accountsCarriedForward: number;
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
interface InventoryListingRow {
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
interface InventoryListingLocationGroup {
  location: string;
  city: string | null;
  group: HierarchyGroupName | null;
  rows: InventoryListingRow[];
  total_on_hand: number;
  capacity: LocationCapacityStatus;
}
interface StorageSpaceCurrencyRow {
  currency: string;
  installed_minor: number;
  occupied_minor: number;
  remaining_minor: number;
  balanced: boolean;
}
interface StorageSpaceLocationGroup {
  location: string;
  currencies: StorageSpaceCurrencyRow[];
}
interface StockMovementRow {
  item: string;
  category: string | null;
  quantity: number;
  date: string;
}
interface StockMovementReport {
  receipts: OrderReceiptRow[];
  transfers: StockTransferRow[];
  sales: StockSaleRow[];
}
type BusinessName = string & { readonly __brand: 'BusinessName' };
type LedgerName = string & { readonly __brand: 'LedgerName' };
type AccountName = string & { readonly __brand: 'AccountName' };
type HierarchyGroupName = string & { readonly __brand: 'HierarchyGroupName' };
type LocationName = string & { readonly __brand: 'LocationName' };
type EmployeeName = string & { readonly __brand: 'EmployeeName' };
type CustomerName = string & { readonly __brand: 'CustomerName' };
type ProviderName = string & { readonly __brand: 'ProviderName' };
type ItemName = string & { readonly __brand: 'ItemName' };
type ReportingFrequency = 'annual' | 'biannual' | 'quarterly' | 'monthly';
type BomComponent = { component: string;
```

**Exported variables**:

- `getEntityTree`
- `getHierarchyLinksPointingAt`
- `createEntity`
- `setEntityRelationship`
- `createProvider`
- `createCustomer`
- `createEmployeeContact`
- `supersedeEntity`
- `revokeEntity`
- `getBankAccounts`
- `getCashPosition`
- `getCashFlowForecast`
- `registerBankAccount`
- `unregisterBankAccount`
- `getTrialBalance`
- `getSalesReport`
- `getMenuTree`
- `getBalanceSheet`
- `getProfitAndLoss`
- `getProfitAndLossByHierarchy`
- `getProfitAndLossByHierarchyTree`
- `getLedgerDateRange`
- `getLanguages`
- `getLanguageDirection`
- `setLanguageDirection`
- `getDefaultLanguage`
- `setDefaultLanguage`
- `getLocalizedText`
- `getConceptsWithAlternates`
- `getVocabularyWords`
- `deleteVocabularyWord`
- `setVocabularyPreference`
- `deleteVocabularyPreference`
- `setTranslation`
- `getHierarchyGroups`
- `getHierarchy`
- `getProductShapes`
- `createHierarchyGrouping`
- `createHierarchyValue`
- `defineProductShape`
- `deleteHierarchyGrouping`
- `deleteHierarchyValue`
- `setHierarchyTag`
- `getHierarchyTag`
- `deleteHierarchyTag`
- `getHierarchyAssignments`
- `getBusinesses`
- `getBusinessTypes`
- `saveBusinessTypeAnswers`
- `getLedgers`
- `getActiveLedger`
- `getProfitCenters`
- `createProfitCenter`
- `setSessionProfitCenter`
- `createBusiness`
- `getCoaPrototypeAccounts`
- `getReportingPeriods`
- `nominateBankAccount`
- `getBusinessConfigurationReport`
- `buildBankCurrencyStructure`
- `stageLine`
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
- `stageARReceipt`
- `postARReceipt`
- `stageAPPayment`
- `postAPPayment`
- `apiLogin`
- `apiLogout`
- `getUsers`
- `getRoles`
- `createUserAccount`
- `setUserRolesApi`
- `setUserActiveApi`
- `changeUserPassword`
- `getUserRoleMatrix`
- `setUserRoleInBusiness`
- `unsetUserRoleInBusiness`
- `reverseJournalEntry`
- `stagePurchaseOrder`
- `postPurchaseOrder`
- `stageOrderReceipt`
- `postOrderReceipt`
- `stageSalesOrder`
- `postSalesOrder`
- `stageOrderDispatch`
- `postOrderDispatch`
- `getOrderStatus`
- `getPeriodStatus`
- `closePeriod`
- `reopenPeriod`
- `changeOwnPassword`
- `getRecordingStatus`
- `startRecording`
- `stopRecording`
- `setOwnPageSize`
- `setOwnNumberFormat`
- `setOwnDateFormat`
- `getBomComponents`
- `setBomComponent`
- `deleteBomComponent`
- `listItems`
- `getItem`
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
- `writeOffItems`
- `receiveLot`
- `getExpiringStock`
- `listLocations`
- `clockInToProject`
- `clockOutOfProject`
- `getOpenProjectClock`
- `getLocationByName`
- `saveLocation`
- `createLocation`
- `deleteLocation`
- `listDepartments`
- `createDepartment`
- `deleteDepartment`
- `getOrgChartStructure`
- `setEmployeeDepartment`
- `deleteEmployeeDepartment`
- `setEmployeeManager`
- `deleteEmployeeManager`
- `convertStorageSpace`
- `openStorageContainer`
- `resolveOpenContainerAccounts`
- `getLocationCurrencies`
- `nominateLocationCurrency`
- `getPosTerminals`
- `createPosTerminal`
- `getLocationOpenHours`
- `setLocationOpenHours`
- `getEmployeeSchedule`
- `setEmployeeSchedule`
- `getItemLocation`
- `setItemLocationLevels`
- `receiveItems`
- `receiveIntoStorageStock`
- `resolveReceiveAccounts`
- `transferItems`
- `transferStock`
- `resolveTransferAccounts`
- `getBelowReorderStock`
- `getStockOutRiskReport`
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
- `receiveStock`
- `dispatchStock`
- `payEmployeeWages`
- `getOrganizationChart`
- `closeBooks`
- `previewCloseBooks`
- `resolveRolloverLines`
- `createLedger`
- `registerCustomer`
- `listPendingCustomers`
- `verifyCustomer`
- `getInventoryListingByLocation`
- `getStorageSpaceReport`
- `getStockMovementReport`

### `frontend/src/lib/auth.ts`

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

### `frontend/src/lib/canned-journal.ts`

**Functions**:

```ts
transferLines(input: {
  quantity: number;
  fromInventoryAccount: string;
  toInventoryAccount: string;
  unitCostMinor: number | null;
}): CannedLine[]
openContainerLines(input: {
  cartonsOpened: number;
  unitsProduced: number;
  containerSpaceAccount: string;
  containerOccupiedAccount: string;
  unitSpaceAccount: string;
  unitOccupiedAccount: string;
  containerSpaceAccountId: number;
  containerOccupiedAccountId: number;
  unitSpaceAccountId: number;
  unitOccupiedAccountId: number;
  inventoryFromAccount: string;
  inventoryToAccount: string;
  inventoryFromAccountId: number;
  inventoryToAccountId: number;
  unitCostMinor: number | null;
}): 
receiveIntoStorageLines(input: {
  quantity: number;
  resolved: { inventoryAccount: string; payableAccount: string; unitCostMinor: number | null } | null;
}): CannedLine[]
freshReference(prefix: string): string
```

**Types**:

```ts
interface CannedLine {
  account: string;
  accountId?: number; // resolves name collisions — see docs/pm-frontend-reference.md
  amount_minor: number;
}
interface CannedEntry {
  reference: string;
  lines: CannedLine[];
}
```

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
  Item: string[];
  Category: string[];
  Location: string[];
  [hierarchyName: string]: string[];
}
type MatrixAxis = 'Item' | 'Category' | 'Location' | 'Consolidated' | (string & {});
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

### `frontend/src/lib/org-chart-layout.ts`

**Functions**:

```ts
layoutOrgChart(nodes: OrgChartBoxInput[]): OrgChartLayout
```

**Types**:

```ts
interface OrgChartBoxInput {
  id: string;
  parentId: string | null;
  label: string;
  kind: OrgChartBoxKind;
  managerId?: string | null;
}
interface LayoutConnector {
  fromId: string;
  toId: string;
  dashed: boolean;
}
interface OrgChartLayout {
  boxes: LayoutBox[];
  connectors: LayoutConnector[];
  width: number;
  height: number;
}
type OrgChartBoxKind = 'division' | 'location' | 'department' | 'employee' | 'unassigned';
```

**Exported variables**:

- `BOX_WIDTH`
- `BOX_HEIGHT`
- `H_GAP`
- `V_GAP`

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
  number_format: string; // see docs/pm-frontend-reference.md and $lib/format
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
  profitCenterId?: number;
  profitCenterName?: string;
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

- `backend/src/db-seed.ts`: `Menu Section: ${newSectionLabel
- `backend/src/db.ts`: TypedNode<TParentBrand>; string; productName ?? 'Items'
- `backend/src/primitives.ts`: string | number; string

### Real `relation:` usages (lateral — "this entity refers to / is a translation of that one")

- `backend/src/auth.ts`: role.name; username
- `backend/src/db-seed.ts`: 'COGS'; section.label; link.label
- `backend/src/db-stock.ts`: location.location_type; 'Billing Address'; p.item_name; vendor; item
- `backend/src/db.ts`: targetName; recordName; input.counterpartyName; line.itemName; locationName; h.day; null; s.day; type; targetName; input.vendorName; languageName; preferredAlternateName; coaPrototype; coaPrototype; coaPrototype
- `backend/src/primitives.ts`: target

## Reference Index

Generated directly by `scripts/source-reference.ts` (run via `make source-reference`). For each real, exported type and function across the files this reference covers, this script scans every one of those same, real files for a genuine, textual reference to that exact name, excluding the file that defines it, to build the real "Referenced in" list below - a real, direct, confirmed fact about which files mention the name, never a claim about actual runtime call order or invocation count (see the real Call Graph Summary above for that).

### Types (287, alphabetical)

| Name | Defined in | Referenced in | Declaration |
|---|---|---|---|
| `AccountName` | `backend/src/db.ts` | `backend/src/db-journal.ts`, `backend/src/db-stock.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/canned-journal.ts` | `type AccountName = string & { readonly __brand: 'AccountName' };` |
| `AccountName` | `frontend/src/lib/api.ts` | `backend/src/db-journal.ts`, `backend/src/db-stock.ts`, `backend/src/db.ts`, `frontend/src/lib/canned-journal.ts` | `type AccountName = string & { readonly __brand: 'AccountName' };` |
| `AgedInvoiceRow` | `backend/src/db.ts` | (none) | `interface AgedInvoiceRow {   invoice_id: number;   reference: string;   counterparty: string;   invoice_date: string;   due_date: string \| null;   outstanding_minor: number;   days_overdue: number;   bucket: string; }` |
| `AgedRow` | `frontend/src/lib/api.ts` | (none) | `interface AgedRow {   invoice_id: number;   reference: string;   counterparty: string;   invoice_date: string;   due_date: string \| null;   outstanding_minor: number;   days_overdue: number;   bucket: string; }` |
| `AgedSummaryRow` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface AgedSummaryRow {   counterparty: string;   outstanding_minor: number;   oldest_days_overdue: number; }` |
| `AgedSummaryRow` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface AgedSummaryRow {   counterparty: string;   outstanding_minor: number;   oldest_days_overdue: number; }` |
| `AgingBucket` | `backend/src/db.ts` | (none) | `interface AgingBucket {   label: string;   through_days: number; }` |
| `APPaymentInput` | `backend/src/db-journal.ts` | (none) | `interface APPaymentInput {   reference: string;   business: BusinessName;   ledger: LedgerName;   vendor: ProviderName;   amount_minor: number;   transdate?: string;   description?: string; }` |
| `ARAPBaseInput` | `frontend/src/lib/api.ts` | (none) | `interface ARAPBaseInput {   reference: string;   business: BusinessName;   ledger: LedgerName;   amount_minor: number;   tax_minor?: number;   location?: string;   transdate?: string;   description?: string; }` |
| `ARReceiptInput` | `backend/src/db-journal.ts` | (none) | `interface ARReceiptInput {   reference: string;   business: BusinessName;   ledger: LedgerName;   customer: CustomerName;   amount_minor: number;   transdate?: string;   description?: string; }` |
| `AuthenticatedUser` | `backend/src/auth.ts` | `backend/src/auth-middleware.ts` | `interface AuthenticatedUser {   id: number;   username: string;   roles: string[];   page_size: number;   number_format: string;   date_format: string; }` |
| `AuthState` | `frontend/src/lib/auth.ts` | `frontend/src/lib/state.svelte.ts` | `interface AuthState {   token: string;   user: AuthUser; }` |
| `AuthState` | `frontend/src/lib/state.svelte.ts` | `frontend/src/lib/auth.ts` | `interface AuthState {   token: string;   user: AuthUser; }` |
| `AuthUser` | `frontend/src/lib/auth.ts` | `frontend/src/lib/state.svelte.ts` | `interface AuthUser {   id: number;   username: string;   roles: string[];   page_size: number;   number_format: string;   date_format: string; }` |
| `AuthUser` | `frontend/src/lib/state.svelte.ts` | `frontend/src/lib/auth.ts` | `interface AuthUser {   id: number;   username: string;   roles: string[];   page_size: number;   number_format: string; // see docs/pm-frontend-reference.md and $lib/format   date_format: string; }` |
| `AxisValues` | `backend/src/db-matrix-reports.ts` | `frontend/src/lib/matrix-api.ts` | `interface AxisValues {   Item: string[];   Category: string[];   Location: string[];   [hierarchyName: string]: string[]; }` |
| `AxisValues` | `frontend/src/lib/matrix-api.ts` | `backend/src/db-matrix-reports.ts` | `interface AxisValues {   Item: string[];   Category: string[];   Location: string[];   [hierarchyName: string]: string[]; }` |
| `BalanceSheet` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface BalanceSheet {   assets: StatementLine[];   liabilities: StatementLine[];   equity: StatementLine[];   assets_tree: CategoryTreeNode[];   liabilities_tree: CategoryTreeNode[];   equity_tree: CategoryTreeNode[];   total_assets_minor: number;   total_liabilities_minor: number;   total_equity_minor: number;   balanced: boolean; }` |
| `BalanceSheet` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface BalanceSheet {   assets: StatementLine[];   liabilities: StatementLine[];   equity: StatementLine[];   assets_tree: CategoryTreeNode[];   liabilities_tree: CategoryTreeNode[];   equity_tree: CategoryTreeNode[];   total_assets_minor: number;   total_liabilities_minor: number;   total_equity_minor: number;   balanced: boolean; }` |
| `BankAccountRow` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface BankAccountRow {   name: string;   accountnumber: string \| null;   balance_minor: number;   currency: string \| null;   overdraft_limit_minor: number \| null;   scope: string; }` |
| `BankAccountRow` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface BankAccountRow {   name: string;   accountnumber: string \| null;   balance_minor: number;   currency: string \| null;   overdraft_limit_minor: number \| null;   scope: string; }` |
| `BelowReorderRow` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface BelowReorderRow {   item: string;   location: string;   quantity_on_hand: number;   reorder_level: number;   min_level: number \| null;   max_level: number \| null; }` |
| `BelowReorderRow` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface BelowReorderRow {   item: string;   location: string;   quantity_on_hand: number;   reorder_level: number;   min_level: number \| null;   max_level: number \| null; }` |
| `BomComponent` | `frontend/src/lib/api.ts` | (none) | `type BomComponent = { component: string;` |
| `BusinessConfigurationReport` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface BusinessConfigurationReport {   businessName: string;   addresses: TypedAddress[];   phones: TypedPhone[];   ownerOrPartners: string[];   bankAccounts: { name: string; routingDetail: string; accountNumber: string }[];   homeCurrency: string \| null;   secondaryCurrencies: string[];   hierarchies: HierarchyGroupingWithValues[];   locations: { name: string; city: string; locationType: string }[];   categories: string[];   chartOfAccountsPrototype: string \| null;   notes: { name: string; text: string }[]; }` |
| `BusinessName` | `backend/src/db.ts` | `backend/src/auth.ts`, `backend/src/db-journal.ts`, `backend/src/db-matrix-reports.ts`, `backend/src/db-reports.ts`, `backend/src/db-stock.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/canned-journal.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts` | `type BusinessName = string & { readonly __brand: 'BusinessName' };` |
| `BusinessName` | `frontend/src/lib/api.ts` | `backend/src/auth.ts`, `backend/src/db-journal.ts`, `backend/src/db-matrix-reports.ts`, `backend/src/db-reports.ts`, `backend/src/db-stock.ts`, `backend/src/db.ts`, `frontend/src/lib/canned-journal.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts` | `type BusinessName = string & { readonly __brand: 'BusinessName' };` |
| `BusinessTypeInfo` | `backend/src/db.ts` | (none) | `interface BusinessTypeInfo {   name: string;   questions: string[]; }` |
| `CannedEntry` | `frontend/src/lib/canned-journal.ts` | (none) | `interface CannedEntry {   reference: string;   lines: CannedLine[]; }` |
| `CannedLine` | `frontend/src/lib/canned-journal.ts` | (none) | `interface CannedLine {   account: string;   accountId?: number; // resolves name collisions — see docs/pm-frontend-reference.md   amount_minor: number; }` |
| `CashFlowForecast` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface CashFlowForecast {   as_of_date: string;   horizon_end_date: string;   starting_cash_minor: number;   overdraft_limit_minor: number \| null;   lines: ForecastLine[];   ending_cash_minor: number;   lowest_projected_balance_minor: number;   lowest_balance_date: string;   first_shortfall_date: string \| null;   first_shortfall_amount_minor: number \| null; }` |
| `CashFlowForecast` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface CashFlowForecast {   as_of_date: string;   horizon_end_date: string;   starting_cash_minor: number;   overdraft_limit_minor: number \| null;   lines: ForecastLine[];   ending_cash_minor: number;   lowest_projected_balance_minor: number;   lowest_balance_date: string;   first_shortfall_date: string \| null;   first_shortfall_amount_minor: number \| null; }` |
| `CashPositionByCurrency` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface CashPositionByCurrency {   currency: string \| null;   total_balance_minor: number;   total_overdraft_limit_minor: number \| null;   headroom_minor: number \| null; }` |
| `CashPositionByCurrency` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface CashPositionByCurrency {   currency: string \| null;   total_balance_minor: number;   total_overdraft_limit_minor: number \| null;   headroom_minor: number \| null; }` |
| `CashPurchaseInput` | `backend/src/db.ts` | (none) | `interface CashPurchaseInput {   business: BusinessName;   ledger: LedgerName;   locationName: LocationName;   vendorName: ProviderName;   lines: CashPurchaseLineInput[];   taxAccount: AccountName;   paymentMethod?: string;   transdate?: string; }` |
| `CashPurchaseLineInput` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface CashPurchaseLineInput {   itemName: string;   quantity: number;   unitPriceMinor: number;   taxMinor: number;   tier?: string; }` |
| `CashPurchaseLineInput` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface CashPurchaseLineInput {   itemName: ItemName;   quantity: number;   unitPriceMinor: number;   taxMinor: number; }` |
| `CashPurchaseResult` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface CashPurchaseResult {   invoiceId: number;   reference: string;   totalMinor: number; }` |
| `CashPurchaseResult` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface CashPurchaseResult {   invoiceId: number;   reference: string;   totalMinor: number; }` |
| `CategoryTreeNode` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface CategoryTreeNode {   name: string;   accountnumber: string \| null;   is_leaf: boolean;   debit_minor: number;   credit_minor: number;   is_contra: boolean;   children: CategoryTreeNode[]; }` |
| `CategoryTreeNode` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface CategoryTreeNode {   name: string;   accountnumber: string \| null;   is_leaf: boolean;   debit_minor: number;   credit_minor: number;   is_contra: boolean;   children: CategoryTreeNode[]; }` |
| `ChartRow` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface ChartRow {   id: number;   name: string;   depth: number;   path: string;   accountnumber: string \| null;   balance_minor: number \| null; }` |
| `ChartRow` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface ChartRow {   id: number;   name: string;   depth: number;   path: string;   accountnumber: string \| null;   balance_minor: number \| null; }` |
| `CloseBooksLine` | `backend/src/db-reports.ts` | (none) | `interface CloseBooksLine {   account: string;   accountId?: number;   amount_minor: number; }` |
| `CloseBooksPreview` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface CloseBooksPreview {   lines: CloseBooksLine[];   netIncomeMinor: number;   accountsZeroed: number;   groupBreakdown: { group: string \| null; netIncomeMinor: number }[];   profitCenterBreakdown: { profitCenter: string \| null; netIncomeMinor: number }[]; }` |
| `CloseBooksPreview` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface CloseBooksPreview {   lines: {   account: AccountName;   accountId?: number; // resolves name collisions, same as StagedLine.accountId — see docs/pm-frontend-reference.md   amount_minor: number;   }[];   netIncomeMinor: number;   accountsZeroed: number;   groupBreakdown: { group: HierarchyGroupName \| null; netIncomeMinor: number }[];   profitCenterBreakdown: { profitCenter: string \| null; netIncomeMinor: number }[]; }` |
| `CloseBooksResult` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface CloseBooksResult {   reference: string;   netIncomeMinor: number;   accountsZeroed: number;   groupBreakdown: { group: string \| null; netIncomeMinor: number }[];   profitCenterBreakdown: { profitCenter: string \| null; netIncomeMinor: number }[]; }` |
| `CloseBooksResult` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface CloseBooksResult {   reference: string;   netIncomeMinor: number;   accountsZeroed: number;   groupBreakdown: { group: HierarchyGroupName \| null; netIncomeMinor: number }[];   profitCenterBreakdown: { profitCenter: string \| null; netIncomeMinor: number }[]; // per Profit Center, mirroring groupBreakdown }` |
| `ConceptWithAlternates` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface ConceptWithAlternates {   headerAccountName: string;   alternates: string[];   defaultAlternate: string; }` |
| `ConceptWithAlternates` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface ConceptWithAlternates {   headerAccountName: string;   alternates: string[];   defaultAlternate: string; }` |
| `Contact` | `backend/src/db.ts` | `backend/src/db-reports.ts`, `backend/src/db-seed.ts`, `frontend/src/lib/api.ts` | `interface Contact {   person_name: string \| null;   phone: string \| null;   email: string \| null;   address_line1: string \| null;   address_line2: string \| null;   city: string \| null;   region: string \| null;   postal_code: string \| null;   country: string \| null;   payment_terms_days: number \| null;   credit_limit_minor: number \| null;   wage_minor_per_hour: number \| null;   salary_minor_per_year: number \| null;   reminder_level: number;   preferred_language: string \| null;   verification_status: 'pending' \| 'active' \| 'rejected' \| null;   card_label: string \| null;   pos_pin: string \| null; }` |
| `Contact` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts`, `backend/src/db-seed.ts`, `backend/src/db.ts` | `interface Contact {   phone: string \| null;   email: string \| null;   address_line1: string \| null;   address_line2: string \| null;   city: string \| null;   region: string \| null;   postal_code: string \| null;   country: string \| null;   payment_terms_days: number \| null;   credit_limit_minor: number \| null;   wage_minor_per_hour: number \| null;   salary_minor_per_year: number \| null;   reminder_level: number;   preferred_language: string \| null; }` |
| `ContactPerson` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface ContactPerson {   contact_type: string;   record_name: string;   name: string \| null;   phone: string \| null;   email: string \| null; }` |
| `ContactPerson` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface ContactPerson {   contact_type: string;   record_name: string;   name: string \| null;   phone: string \| null;   email: string \| null; }` |
| `CreditStatus` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface CreditStatus {   balanceMinor: number;   limitMinor: number \| null;   overLimit: boolean;   remainingMinor: number \| null; }` |
| `CreditStatus` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface CreditStatus {   balanceMinor: number;   limitMinor: number \| null;   overLimit: boolean;   remainingMinor: number \| null; }` |
| `CustomerName` | `backend/src/db.ts` | `backend/src/db-journal.ts`, `frontend/src/lib/api.ts` | `type CustomerName = string & { readonly __brand: 'CustomerName' };` |
| `CustomerName` | `frontend/src/lib/api.ts` | `backend/src/db-journal.ts`, `backend/src/db.ts` | `type CustomerName = string & { readonly __brand: 'CustomerName' };` |
| `CustomerRegistrationInput` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface CustomerRegistrationInput {   name: string;   email: string;   phone?: string \| null;   address_line1?: string \| null;   address_line2?: string \| null;   city?: string \| null;   region?: string \| null;   postal_code?: string \| null;   country?: string \| null;   preferred_language?: string \| null;   password: string;   card_label?: string \| null; }` |
| `CustomerRegistrationInput` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface CustomerRegistrationInput {   name: string;   email: string;   phone?: string \| null;   address_line1?: string \| null;   address_line2?: string \| null;   city?: string \| null;   region?: string \| null;   postal_code?: string \| null;   country?: string \| null;   preferred_language?: string \| null;   password: string;   card_label?: string \| null; }` |
| `CustomerStatement` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface CustomerStatement {   customer: string;   as_of_date: string;   lines: StatementLine[];   total_outstanding_minor: number; }` |
| `CustomerStatement` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface CustomerStatement {   customer: string;   as_of_date: string;   lines: StatementLine[];   total_outstanding_minor: number; }` |
| `DemoCategory` | `shared-fixtures/wine-retail-demo-data.ts` | (none) | `interface DemoCategory {   category: string;   subcategory: string; }` |
| `DemoLocation` | `shared-fixtures/wine-retail-demo-data.ts` | (none) | `interface DemoLocation {   name: string;   city: string;   locationType: 'Retail' \| 'Warehouse';   isBilling: boolean;   bottleCap: number \| null;   cartonCap: number \| null;   timezone: string; }` |
| `DemoProduct` | `shared-fixtures/wine-retail-demo-data.ts` | (none) | `interface DemoProduct {   name: string;   subcategory: string; }` |
| `DemoStockLevel` | `shared-fixtures/wine-retail-demo-data.ts` | (none) | `interface DemoStockLevel {   itemName: string;   locationName: string;   qty: number;   minLevel: number;   maxLevel: number;   reorderLevel: number;   shelfSide: string \| null;   rack: string \| null;   level: number \| null; }` |
| `DemoUpc` | `shared-fixtures/wine-retail-demo-data.ts` | (none) | `interface DemoUpc {   name: string;   upc: string; }` |
| `DepartmentRecord` | `frontend/src/lib/api.ts` | (none) | `interface DepartmentRecord {   id: number;   name: string; }` |
| `EInvoiceDiscrepancy` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface EInvoiceDiscrepancy {   field: string;   poValue: string;   invoiceValue: string; }` |
| `EInvoiceDiscrepancy` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface EInvoiceDiscrepancy {   field: string;   poValue: string;   invoiceValue: string; }` |
| `EmployeeClock` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `interface EmployeeClock {   employee: string;   po_reference: string;   project_expense_account: string;   clocked_in_at: string; }` |
| `EmployeeClock` | `frontend/src/lib/api.ts` | `backend/src/db-journal.ts` | `interface EmployeeClock {   employee: string;   po_reference: string;   project_expense_account: string;   clocked_in_at: string; }` |
| `EmployeeName` | `backend/src/db.ts` | `backend/src/db-journal.ts`, `frontend/src/lib/api.ts` | `type EmployeeName = string & { readonly __brand: 'EmployeeName' };` |
| `EmployeeName` | `frontend/src/lib/api.ts` | `backend/src/db-journal.ts`, `backend/src/db.ts` | `type EmployeeName = string & { readonly __brand: 'EmployeeName' };` |
| `EntityHistoryRow` | `backend/src/db.ts` | (none) | `interface EntityHistoryRow {   name: string;   parent_id: number \| null;   relation_id: number \| null;   created_at: string;   created_by: number; }` |
| `EntityId` | `backend/src/db.ts` | (none) | `type EntityId = number & { readonly __brand: 'EntityId' };` |
| `EntityNode` | `backend/src/db.ts` | `backend/src/primitives.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/entityTree.ts`, `frontend/src/lib/treeAdapter.ts` | `interface EntityNode {   id: number;   name: string;   parent_id: number \| null;   relation_id: number \| null;   accountnumber: string \| null;   balance_minor: number \| null;   currency: string \| null; }` |
| `EntityNode` | `frontend/src/lib/api.ts` | `backend/src/db.ts`, `backend/src/primitives.ts`, `frontend/src/lib/entityTree.ts`, `frontend/src/lib/treeAdapter.ts` | `interface EntityNode {   id: number;   name: string;   parent_id: number \| null;   relation_id: number \| null;   accountnumber: string \| null;   balance_minor: number \| null;   currency: string \| null;   depth: number;   is_postable_account: boolean; }` |
| `EntityStructure` | `backend/src/db.ts` | (none) | `type EntityStructure = 'sole_trader' \| 'partnership' \| 'llc' \| 'unlimited_liability' \| 'publicly_traded';` |
| `EntityUpdate` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `interface EntityUpdate {   name?: string;   parent?: string \| null;   relation?: string \| null;   relationId?: number;   accountnumber?: string \| null; }` |
| `ExpiringLot` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface ExpiringLot {   item: string;   lot_number: string;   expiration_date: string;   quantity_on_hand: number;   days_until_expiration: number; }` |
| `ExpiringLot` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface ExpiringLot {   item: string;   lot_number: string;   expiration_date: string;   quantity_on_hand: number;   days_until_expiration: number; }` |
| `ForecastLine` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface ForecastLine {   date: string;   description: string;   amount_minor: number; // positive = real, anticipated cash in; negative = real, anticipated cash out   source: 'AR' \| 'AP' \| 'recurring'; }` |
| `ForecastLine` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface ForecastLine {   date: string;   description: string;   amount_minor: number;   source: 'AR' \| 'AP' \| 'recurring'; }` |
| `HierarchyChainNode` | `backend/src/db.ts` | (none) | `interface HierarchyChainNode {   readonly id: EntityId;   readonly name: string; }` |
| `HierarchyGroupingWithValues` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface HierarchyGroupingWithValues {   grouping: string;   values: string[]; }` |
| `HierarchyGroupingWithValues` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface HierarchyGroupingWithValues {   grouping: string;   values: string[]; }` |
| `HierarchyGroupName` | `frontend/src/lib/api.ts` | (none) | `type HierarchyGroupName = string & { readonly __brand: 'HierarchyGroupName' };` |
| `HierarchyGroupRecord` | `frontend/src/lib/api.ts` | (none) | `interface HierarchyGroupRecord {   name: string;   parentName: string \| null; }` |
| `HierarchyLinkPointingAt` | `frontend/src/lib/api.ts` | (none) | `interface HierarchyLinkPointingAt {   entityName: string;   hierarchyName: string; }` |
| `HierarchyNode` | `backend/src/db.ts` | (none) | `interface HierarchyNode {   id: number;   name: string;   children: HierarchyNode[]; }` |
| `HierarchyTreeNode` | `backend/src/primitives.ts` | `backend/src/db-reports.ts` | `interface HierarchyTreeNode {   name: string;   accountId: number \| null;   own: Record<string, number>;   total: Record<string, number>;   children: HierarchyTreeNode[]; }` |
| `HistoryLine` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface HistoryLine {   invoice_reference: string;   invoice_date: string;   document_type: 'invoice' \| 'credit_note' \| 'debit_memo';   description: string;   quantity: number \| null;   unit_price_minor: number \| null;   amount_minor: number; }` |
| `HistoryLine` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface HistoryLine {   invoice_reference: string;   invoice_date: string;   document_type: 'invoice' \| 'credit_note' \| 'debit_memo';   description: string;   quantity: number \| null;   unit_price_minor: number \| null;   amount_minor: number; }` |
| `ImportEInvoiceResult` | `frontend/src/lib/api.ts` | (none) | `interface ImportEInvoiceResult {   invoiceId: number;   discrepancies: EInvoiceDiscrepancy[]; }` |
| `InventoryListingLocationGroup` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface InventoryListingLocationGroup {   location: string;   city: string \| null;   group: string \| null;   rows: InventoryListingRow[];   total_on_hand: number;   capacity: LocationCapacityStatus; }` |
| `InventoryListingLocationGroup` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface InventoryListingLocationGroup {   location: string;   city: string \| null;   group: HierarchyGroupName \| null;   rows: InventoryListingRow[];   total_on_hand: number;   capacity: LocationCapacityStatus; }` |
| `InventoryListingRow` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface InventoryListingRow {   item: string;   location: string;   quantity_on_hand: number;   min_level: number \| null;   max_level: number \| null;   reorder_level: number \| null; }` |
| `InventoryListingRow` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface InventoryListingRow {   item: string;   location: string;   quantity_on_hand: number;   min_level: number \| null;   max_level: number \| null;   reorder_level: number \| null; }` |
| `Invoice` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `backend/src/invoice.ts`, `frontend/src/lib/api.ts` | `interface Invoice {   id: number;   invoice_type: 'AR' \| 'AP';   document_type: 'invoice' \| 'credit_note' \| 'debit_memo';   references_invoice_id: number \| null;   business: string;   ledger: string;   reference: string;   counterparty: string;   invoice_date: string;   due_date: string \| null;   description: string;   status: 'draft' \| 'posted' \| 'void';   posted_by: string \| null;   source: 'manual' \| 'pos';   lines: (InvoiceLineInput & { id: number })[];   total_amount_minor: number;   total_tax_minor: number; }` |
| `Invoice` | `frontend/src/lib/api.ts` | `backend/src/db-seed.ts`, `backend/src/db.ts`, `backend/src/invoice.ts` | `interface Invoice {   id: number;   invoice_type: 'AR' \| 'AP';   document_type: 'invoice' \| 'credit_note' \| 'debit_memo';   references_invoice_id: number \| null;   business: BusinessName;   ledger: LedgerName;   reference: string;   counterparty: string;   invoice_date: string;   due_date: string \| null;   description: string;   status: 'draft' \| 'posted' \| 'void';   posted_by: string \| null;   source: 'manual' \| 'pos';   lines: (InvoiceLine & { id: number })[];   total_amount_minor: number;   total_tax_minor: number; }` |
| `InvoiceInput` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface InvoiceInput {   invoiceType: 'AR' \| 'AP';   documentType?: 'invoice' \| 'credit_note' \| 'debit_memo';   referencesInvoiceId?: number \| null;   business: string;   ledger: string;   reference: string;   counterpartyName: string;   invoiceDate: string;   description?: string;   lines: InvoiceLineInput[];   source?: 'manual' \| 'pos'; }` |
| `InvoiceInput` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface InvoiceInput {   invoiceType: 'AR' \| 'AP';   documentType?: 'invoice' \| 'credit_note' \| 'debit_memo';   referencesInvoiceId?: number \| null;   business: BusinessName;   ledger: LedgerName;   reference: string;   counterpartyName: string;   invoiceDate: string;   description?: string;   lines: InvoiceLine[]; }` |
| `InvoiceLine` | `backend/src/db.ts` | `backend/src/invoice.ts`, `frontend/src/lib/api.ts` | `interface InvoiceLine {   reference: string;   description: string;   quantity: number \| null;   unit_price_minor: number \| null;   amount_minor: number;   tax_minor: number; }` |
| `InvoiceLine` | `frontend/src/lib/api.ts` | `backend/src/db.ts`, `backend/src/invoice.ts` | `interface InvoiceLine {   id?: number;   description: string;   quantity?: number \| null;   unitPriceMinor?: number \| null;   amountMinor: number;   taxMinor?: number;   itemName?: string \| null;   dispatchReference?: string \| null; }` |
| `InvoiceLineInput` | `backend/src/db.ts` | (none) | `interface InvoiceLineInput {   description: string;   quantity?: number \| null;   unitPriceMinor?: number \| null;   amountMinor: number;   taxMinor?: number;   itemName?: string \| null;   dispatchReference?: string \| null; }` |
| `InvoiceOptions` | `backend/src/invoice.ts` | (none) | `interface InvoiceOptions {   invoiceReference: string; // the display reference for the whole document   customerName: string;   date: string;   postedBy: string;   lineReferences: string[]; // the underlying posting references that make up this invoice   business: string;   ledger: string; }` |
| `Item` | `backend/src/db.ts` | `backend/src/db-matrix-reports.ts`, `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/entityTree.ts`, `frontend/src/lib/matrix-api.ts` | `interface Item {   description: string \| null;   unit_of_measure: string \| null;   upc: string \| null;   retail_price_minor: number \| null; }` |
| `Item` | `frontend/src/lib/api.ts` | `backend/src/db-matrix-reports.ts`, `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/db.ts`, `frontend/src/lib/entityTree.ts`, `frontend/src/lib/matrix-api.ts` | `interface Item {   description: string \| null;   unit_of_measure: string \| null;   upc: string \| null; }` |
| `ItemLocationLevels` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface ItemLocationLevels {   quantity_on_hand: number;   min_level: number \| null;   max_level: number \| null;   reorder_level: number \| null;   shelf_side: string \| null;   rack: string \| null;   level: number \| null; }` |
| `ItemLocationLevels` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface ItemLocationLevels {   quantity_on_hand: number;   min_level: number \| null;   max_level: number \| null;   reorder_level: number \| null;   shelf_side: string \| null;   rack: string \| null;   level: number \| null; }` |
| `ItemName` | `backend/src/db.ts` | `backend/src/db-stock.ts`, `frontend/src/lib/api.ts` | `type ItemName = string & { readonly __brand: 'ItemName' };` |
| `ItemName` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts`, `backend/src/db.ts` | `type ItemName = string & { readonly __brand: 'ItemName' };` |
| `ItemSource` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface ItemSource {   id: number;   item_id: number;   item_name: string;   manufacturer_id: number \| null;   manufacturer_name: string \| null;   vendor_id: number;   vendor_name: string;   vendor_sku: string \| null;   vendor_upc: string \| null;   price_minor: number \| null;   currency: string \| null;   package_quantity: number \| null;   is_preferred: boolean;   preference_notes: string \| null; }` |
| `ItemSource` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface ItemSource {   id: number;   item_id: number;   item_name: string;   manufacturer_id: number \| null;   manufacturer_name: string \| null;   vendor_id: number;   vendor_name: string;   vendor_sku: string \| null;   vendor_upc: string \| null;   price_minor: number \| null;   currency: string \| null;   package_quantity: number \| null;   is_preferred: boolean;   preference_notes: string \| null; }` |
| `ItemSourceInput` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface ItemSourceInput {   itemName: string;   manufacturerName?: string \| null;   vendorName: string;   vendorSku?: string \| null;   vendorUpc?: string \| null;   priceMinor?: number \| null;   packageQuantity?: number \| null;   isPreferred?: boolean;   preferenceNotes?: string \| null;   currency?: string \| null;   productInstanceId?: number; }` |
| `ItemSourceInput` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface ItemSourceInput {   manufacturerName?: string \| null;   vendorName: ProviderName;   vendorSku?: string \| null;   vendorUpc?: string \| null;   priceMinor?: number \| null;   currency?: string \| null; // null = home currency; non-null = a separate priced row, never a conversion — see docs/pm-frontend-reference.md   packageQuantity?: number \| null;   isPreferred?: boolean;   preferenceNotes?: string \| null; }` |
| `ItemSummary` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface ItemSummary {   name: string;   description: string \| null;   unit_of_measure: string \| null;   upc: string \| null;   retail_price_minor: number \| null;   source_count: number;   storage_origin: 'Hot' \| 'Cold' \| null;   product: string \| null; }` |
| `ItemSummary` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface ItemSummary {   name: string;   description: string \| null;   unit_of_measure: string \| null;   upc: string \| null;   retail_price_minor: number \| null;   source_count: number;   storage_origin: 'Hot' \| 'Cold' \| null;   product: string \| null;   combinationValues?: string[]; // set when a scanned barcode matches a specific combination — see docs/pm-frontend-reference.md   combinationShape?: [string, string][]; }` |
| `JournalSummary` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `interface JournalSummary {   journal_id: number;   occurrence_date: string \| null;   reference: string;   description: string;   business: string;   ledger: string;   recurrence: string;   posted_by: string;   total_debit_minor: number;   total_credit_minor: number;   currency: string \| null; }` |
| `JournalSummary` | `frontend/src/lib/api.ts` | `backend/src/db-journal.ts` | `interface JournalSummary {   journal_id: number;   occurrence_date: string \| null;   reference: string;   description: string;   business: BusinessName;   ledger: LedgerName;   recurrence: string;   total_debit_minor: number;   total_credit_minor: number; }` |
| `LayoutConnector` | `frontend/src/lib/org-chart-layout.ts` | (none) | `interface LayoutConnector {   fromId: string;   toId: string;   dashed: boolean; }` |
| `LedgerDateRange` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `interface LedgerDateRange {   earliest: string \| null;   latest: string \| null; }` |
| `LedgerDateRange` | `frontend/src/lib/api.ts` | `backend/src/db-journal.ts` | `interface LedgerDateRange {   earliest: string \| null;   latest: string \| null; }` |
| `LedgerName` | `backend/src/db.ts` | `backend/src/auth.ts`, `backend/src/db-journal.ts`, `backend/src/db-matrix-reports.ts`, `backend/src/db-reports.ts`, `backend/src/db-stock.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/canned-journal.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts` | `type LedgerName = string & { readonly __brand: 'LedgerName' };` |
| `LedgerName` | `frontend/src/lib/api.ts` | `backend/src/auth.ts`, `backend/src/db-journal.ts`, `backend/src/db-matrix-reports.ts`, `backend/src/db-reports.ts`, `backend/src/db-stock.ts`, `backend/src/db.ts`, `frontend/src/lib/canned-journal.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts` | `type LedgerName = string & { readonly __brand: 'LedgerName' };` |
| `ListInvoicesOptions` | `backend/src/db.ts` | (none) | `interface ListInvoicesOptions {   invoiceType?: 'AR' \| 'AP';   source?: 'manual' \| 'pos' \| 'all';   limit?: number;   offset?: number; }` |
| `Location` | `backend/src/db-stock.ts` | `backend/src/db-journal.ts`, `backend/src/db-matrix-reports.ts`, `backend/src/db-reports.ts`, `backend/src/db-seed.ts`, `backend/src/db.ts`, `backend/src/recording.ts`, `frontend/src/lib/matrix-api.ts` | `interface Location {   city: string;   location_type: string;   is_billing_address: boolean;   bottle_capacity: number \| null;   carton_capacity: number \| null;   timezone: string; }` |
| `LocationCapacityStatus` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface LocationCapacityStatus {   bottleQuantity: number;   bottleCapacity: number \| null;   bottleOverCapacity: boolean;   cartonQuantity: number;   cartonCapacity: number \| null;   cartonOverCapacity: boolean; }` |
| `LocationCapacityStatus` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface LocationCapacityStatus {   bottleQuantity: number;   bottleCapacity: number \| null;   bottleOverCapacity: boolean;   cartonQuantity: number;   cartonCapacity: number \| null;   cartonOverCapacity: boolean; }` |
| `LocationInput` | `frontend/src/lib/api.ts` | (none) | `interface LocationInput {   city: string;   location_type: string;   is_billing_address: boolean;   bottle_capacity?: number \| null;   carton_capacity?: number \| null;   timezone: string; // IANA identifier, required — see docs/pm-frontend-reference.md }` |
| `LocationName` | `backend/src/db.ts` | `backend/src/db-stock.ts`, `frontend/src/lib/api.ts` | `type LocationName = string & { readonly __brand: 'LocationName' };` |
| `LocationName` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts`, `backend/src/db.ts` | `type LocationName = string & { readonly __brand: 'LocationName' };` |
| `LocationStagingInput` | `backend/src/db-journal.ts` | (none) | `interface LocationStagingInput {   reference: string;   business: BusinessName;   location_name: string;   city: string;   location_type: string;   bottle_capacity?: number \| null;   carton_capacity?: number \| null;   timezone: string; }` |
| `LoginResponse` | `frontend/src/lib/api.ts` | (none) | `interface LoginResponse {   token: string;   user: { id: number; username: string; roles: string[]; page_size: number; number_format: string; date_format: string }; }` |
| `MatrixAxis` | `backend/src/db-matrix-reports.ts` | `frontend/src/lib/matrix-api.ts` | `type MatrixAxis = 'Item' \| 'Location' \| 'Consolidated' \| (string & {});` |
| `MatrixAxis` | `frontend/src/lib/matrix-api.ts` | `backend/src/db-matrix-reports.ts` | `type MatrixAxis = 'Item' \| 'Category' \| 'Location' \| 'Consolidated' \| (string & {});` |
| `MatrixCell` | `backend/src/db-matrix-reports.ts` | `frontend/src/lib/matrix-api.ts` | `interface MatrixCell {   rowKey: string;   colKey: string;   salesMinor: number;   cogsMinor: number; }` |
| `MatrixCell` | `frontend/src/lib/matrix-api.ts` | `backend/src/db-matrix-reports.ts` | `interface MatrixCell {   rowKey: string;   colKey: string;   salesMinor: number;   cogsMinor: number; }` |
| `MenuLinkRow` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface MenuLinkRow {   key: string;   href: string;   label: string;   notImplemented: boolean;   isSubheading: boolean;   requiredRoles: string[] \| null;   hidden: boolean; }` |
| `MenuLinkRow` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface MenuLinkRow {   key: string;   href: string;   label: string;   notImplemented: boolean;   isSubheading: boolean;   requiredRoles: string[] \| null; }` |
| `MenuSectionRow` | `backend/src/db.ts` | `frontend/src/lib/api.ts`, `frontend/src/lib/state.svelte.ts` | `interface MenuSectionRow {   key: string;   label: string;   hidden: boolean;   links: MenuLinkRow[]; }` |
| `MenuSectionRow` | `frontend/src/lib/api.ts` | `backend/src/db.ts`, `frontend/src/lib/state.svelte.ts` | `interface MenuSectionRow {   key: string;   label: string;   links: MenuLinkRow[]; }` |
| `NewEntity` | `backend/src/db.ts` | (none) | `interface NewEntity {   name: string;   parent?: string \| null;   parentId?: number \| null;   relation?: string \| null;   accountnumber?: string \| null; }` |
| `OpenHoursLine` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface OpenHoursLine {   day: string;   opens_at: string;   closes_at: string; }` |
| `OpenHoursLine` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface OpenHoursLine {   day: string;   opens_at: string;   closes_at: string; }` |
| `OrderDispatchInput` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `interface OrderDispatchInput {   reference: string;   business: string;   ledger: string;   so_reference: string;   item?: string \| null;   item_qty?: string \| null;   customer: string;   quantity: number;   unit_cost_minor?: number \| null;   sale_price_minor: number;   tax_minor?: number;   transdate?: string;   description?: string; }` |
| `OrderDispatchInput` | `frontend/src/lib/api.ts` | `backend/src/db-journal.ts` | `interface OrderDispatchInput {   reference: string;   business: BusinessName;   ledger: LedgerName;   so_reference: string;   item?: string;   item_qty?: string;   customer: string;   quantity: number;   unit_cost_minor?: number;   sale_price_minor: number;   tax_minor?: number;   transdate?: string;   description?: string; }` |
| `OrderReceiptInput` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `interface OrderReceiptInput {   reference: string;   business: string;   ledger: string;   po_reference: string;   item: string;   item_qty?: string \| null;   vendor: string;   quantity: number;   value_minor: number;   tax_minor?: number;   transdate?: string;   description?: string; }` |
| `OrderReceiptInput` | `frontend/src/lib/api.ts` | `backend/src/db-journal.ts` | `interface OrderReceiptInput {   reference: string;   business: BusinessName;   ledger: LedgerName;   po_reference: string;   item: string;   item_qty?: string;   vendor: string;   quantity: number;   value_minor: number;   tax_minor?: number;   transdate?: string;   description?: string; }` |
| `OrganizationChart` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface OrganizationChart {   business: string;   companyWideEmployees: string[]; // "Place of Employment" points straight at the business itself   groups: OrgChartGroup[]; }` |
| `OrganizationChart` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface OrganizationChart {   business: BusinessName;   companyWideEmployees: string[];   groups: { group: HierarchyGroupName; locations: { location: string; employees: string[] }[] }[]; }` |
| `OrgChartBoxInput` | `frontend/src/lib/org-chart-layout.ts` | (none) | `interface OrgChartBoxInput {   id: string;   parentId: string \| null;   label: string;   kind: OrgChartBoxKind;   managerId?: string \| null; }` |
| `OrgChartBoxKind` | `frontend/src/lib/org-chart-layout.ts` | (none) | `type OrgChartBoxKind = 'division' \| 'location' \| 'department' \| 'employee' \| 'unassigned';` |
| `OrgChartDepartment` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface OrgChartDepartment {   name: string;   employees: { name: string; location: string \| null; managerName: string \| null }[]; }` |
| `OrgChartDepartment` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface OrgChartDepartment {   name: string;   employees: OrgChartEmployee[]; }` |
| `OrgChartEmployee` | `frontend/src/lib/api.ts` | (none) | `interface OrgChartEmployee {   name: string;   location: string \| null;   managerName: string \| null; }` |
| `OrgChartGroup` | `backend/src/db.ts` | (none) | `interface OrgChartGroup {   group: string;   locations: { location: string; employees: string[] }[]; }` |
| `OrgChartLayout` | `frontend/src/lib/org-chart-layout.ts` | (none) | `interface OrgChartLayout {   boxes: LayoutBox[];   connectors: LayoutConnector[];   width: number;   height: number; }` |
| `OrgChartStructure` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface OrgChartStructure {   business: string;   departments: OrgChartDepartment[];   unassignedEmployees: { name: string; location: string \| null; managerName: string \| null }[]; }` |
| `OrgChartStructure` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface OrgChartStructure {   business: string;   departments: OrgChartDepartment[];   unassignedEmployees: OrgChartEmployee[]; }` |
| `PayEmployeeWagesInput` | `backend/src/db.ts` | (none) | `interface PayEmployeeWagesInput {   business: string;   ledger: string;   employeeName: string;   hours?: number;   wagesExpenseAccount?: string;   paymentMethod?: string;   transdate?: string; }` |
| `PayEmployeeWagesResult` | `backend/src/db.ts` | (none) | `interface PayEmployeeWagesResult {   invoiceId: number;   reference: string;   grossMinor: number;   medicareLevyMinor: number;   superannuationMinor: number;   netMinor: number; }` |
| `PayWagesResult` | `frontend/src/lib/api.ts` | (none) | `interface PayWagesResult {   invoiceId: number;   reference: string;   grossMinor: number;   medicareLevyMinor: number;   superannuationMinor: number;   netMinor: number; }` |
| `PendingCustomer` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface PendingCustomer {   name: string;   email: string \| null;   phone: string \| null;   card_label: string \| null; }` |
| `PendingCustomer` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface PendingCustomer {   name: string;   email: string \| null;   phone: string \| null;   card_label: string \| null; }` |
| `PeriodLockStatus` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `interface PeriodLockStatus {   locked_through_date: string \| null;   changed_by: number \| null;   changed_at: string \| null; }` |
| `PeriodLockStatus` | `frontend/src/lib/api.ts` | `backend/src/db-journal.ts` | `interface PeriodLockStatus {   locked_through_date: string \| null;   changed_by: number \| null;   changed_at: string \| null; }` |
| `PickingListLine` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface PickingListLine {   invoiceLineId: number;   item: string;   quantity: number;   shelfSide: string \| null;   rack: string \| null;   level: number \| null;   picked: boolean; }` |
| `PickingListLine` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface PickingListLine {   invoiceLineId: number;   item: string;   quantity: number;   shelfSide: string \| null;   rack: string \| null;   level: number \| null;   picked: boolean; }` |
| `PosSaleInput` | `backend/src/db.ts` | (none) | `interface PosSaleInput {   business: BusinessName;   ledger: LedgerName;   locationName: LocationName;   customerName: CustomerName;   lines: PosSaleLineInput[];   revenueAccount?: AccountName;   taxAccount: AccountName;   paymentMethod?: string;   cashTenderedMinor?: number;   transdate?: string;   terminalName?: string; }` |
| `PosSaleLineInput` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface PosSaleLineInput {   itemName: string;   quantity: number;   unitPriceMinor?: number;   taxMinor: number;   tier?: string;   combinationValues?: string[];   combinationShape?: [string, string][]; }` |
| `PosSaleLineInput` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface PosSaleLineInput {   itemName: ItemName;   quantity: number;   unitPriceMinor?: number;   taxMinor: number;   tier?: string;   combinationValues?: string[]; // set when a scanned barcode matches a specific combination — see docs/pm-frontend-reference.md   combinationShape?: [string, string][]; }` |
| `PosSaleResult` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface PosSaleResult {   invoiceId: number;   reference: string;   totalMinor: number;   changeDueMinor: number; }` |
| `PosSaleResult` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface PosSaleResult {   invoiceId: number;   reference: string;   totalMinor: number;   changeDueMinor: number; }` |
| `PosShift` | `backend/src/db.ts` | (none) | `interface PosShift {   id: number;   employee: string;   location: string;   signed_on_at: string;   signed_off_at: string \| null; }` |
| `PosTerminalRecord` | `frontend/src/lib/api.ts` | (none) | `interface PosTerminalRecord {   name: string;   currency: string \| null; }` |
| `ProductSummary` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface ProductSummary {   name: string;   itemCount: number; }` |
| `ProductSummary` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface ProductSummary {   name: string;   itemCount: number; }` |
| `ProfitAndLoss` | `backend/src/db-reports.ts` | `backend/src/db-matrix-reports.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/matrix-api.ts` | `interface ProfitAndLoss {   income: StatementLine[];   expenses: StatementLine[];   cogs_expenses: StatementLine[];   operating_expenses: StatementLine[];   income_tree: CategoryTreeNode[];   cogs_tree: CategoryTreeNode[];   operating_expenses_tree: CategoryTreeNode[];   total_income_minor: number;   total_expenses_minor: number;   gross_profit_minor: number;   net_income_minor: number; }` |
| `ProfitAndLoss` | `frontend/src/lib/api.ts` | `backend/src/db-matrix-reports.ts`, `backend/src/db-reports.ts`, `frontend/src/lib/matrix-api.ts` | `interface ProfitAndLoss {   income: StatementLine[];   expenses: StatementLine[];   cogs_expenses: StatementLine[];   operating_expenses: StatementLine[];   income_tree: CategoryTreeNode[];   cogs_tree: CategoryTreeNode[];   operating_expenses_tree: CategoryTreeNode[];   total_income_minor: number;   total_expenses_minor: number;   gross_profit_minor: number;   net_income_minor: number; }` |
| `ProfitAndLossByAxisNode` | `backend/src/db-matrix-reports.ts` | `frontend/src/lib/matrix-api.ts` | `interface ProfitAndLossByAxisNode {   key: string;   profitAndLoss: ProfitAndLoss;   children: ProfitAndLossByAxisNode[]; }` |
| `ProfitAndLossByAxisNode` | `frontend/src/lib/matrix-api.ts` | `backend/src/db-matrix-reports.ts` | `interface ProfitAndLossByAxisNode {   key: string;   profitAndLoss: ProfitAndLoss;   children: ProfitAndLossByAxisNode[]; }` |
| `ProfitAndLossByGroup` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface ProfitAndLossByGroup {   group: string \| null;   profitAndLoss: ProfitAndLoss; }` |
| `ProfitAndLossByGroup` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface ProfitAndLossByGroup {   group: HierarchyGroupName \| null;   profitAndLoss: ProfitAndLoss; }` |
| `ProfitAndLossComparison` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface ProfitAndLossComparison {   ledgerA: LedgerName;   ledgerB: LedgerName;   income: ProfitAndLossComparisonLine[];   expenses: ProfitAndLossComparisonLine[];   a_total_income_minor: number;   b_total_income_minor: number;   a_total_expenses_minor: number;   b_total_expenses_minor: number;   a_net_income_minor: number;   b_net_income_minor: number;   net_income_variance_minor: number; }` |
| `ProfitAndLossComparison` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface ProfitAndLossComparison {   ledgerA: string;   ledgerB: string;   income: ProfitAndLossComparisonLine[];   expenses: ProfitAndLossComparisonLine[];   a_total_income_minor: number;   b_total_income_minor: number;   a_total_expenses_minor: number;   b_total_expenses_minor: number;   a_net_income_minor: number;   b_net_income_minor: number;   net_income_variance_minor: number; }` |
| `ProfitAndLossComparisonLine` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface ProfitAndLossComparisonLine {   name: string;   accountnumber: string \| null;   a_minor: number;   b_minor: number;   variance_minor: number; }` |
| `ProfitAndLossComparisonLine` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface ProfitAndLossComparisonLine {   name: string;   accountnumber: string \| null;   a_minor: number;   b_minor: number;   variance_minor: number; }` |
| `ProviderName` | `backend/src/db.ts` | `backend/src/db-journal.ts`, `backend/src/db-stock.ts`, `frontend/src/lib/api.ts` | `type ProviderName = string & { readonly __brand: 'ProviderName' };` |
| `ProviderName` | `frontend/src/lib/api.ts` | `backend/src/db-journal.ts`, `backend/src/db-stock.ts`, `backend/src/db.ts` | `type ProviderName = string & { readonly __brand: 'ProviderName' };` |
| `PurchaseOrderInput` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `interface PurchaseOrderInput {   reference: string;   business: string;   ledger: string;   vendor: string;   item: string;   quantity: number;   price_minor: number;   location?: string;   transdate?: string;   description?: string; }` |
| `PurchaseOrderInput` | `frontend/src/lib/api.ts` | `backend/src/db-journal.ts` | `interface PurchaseOrderInput {   reference: string;   business: BusinessName;   ledger: LedgerName;   vendor: string;   item: string;   quantity: number;   price_minor: number;   location?: string;   transdate?: string;   description?: string; }` |
| `RealBusinessNode` | `backend/src/session-context.ts` | (none) | `interface RealBusinessNode {   readonly id: number;   readonly name: string; }` |
| `ReceiveStockPhysicalInput` | `backend/src/db-stock.ts` | (none) | `interface ReceiveStockPhysicalInput {   business: BusinessName;   ledger: LedgerName;   reference: string;   itemName: ItemName;   locationName: LocationName;   quantity: number;   transdate?: string;   combinationValues?: string[];   combinationShape?: [string, string][]; }` |
| `Recurrence` | `backend/src/db-journal.ts` | `shared-fixtures/add-journal-translations.ts`, `backend/src/db-seed.ts` | `type Recurrence = 'once' \| 'weekly' \| 'monthly' \| 'yearly';` |
| `RecurringJournalLine` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `interface RecurringJournalLine {   account: string;   amount_minor: number;   memo?: string;   effective_date?: string; }` |
| `RecurringJournalLine` | `frontend/src/lib/api.ts` | `backend/src/db-journal.ts` | `interface RecurringJournalLine {   account: AccountName;   amount_minor: number;   memo?: string;   effective_date?: string; }` |
| `Relationship` | `backend/src/db.ts` | (none) | `interface Relationship {   type: string;   target: string; }` |
| `ReminderCandidate` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface ReminderCandidate {   counterparty: string;   current_level: number;   next_level: number;   outstanding_minor: number;   oldest_days_overdue: number; }` |
| `ReminderCandidate` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface ReminderCandidate {   counterparty: string;   current_level: number;   next_level: number;   outstanding_minor: number;   oldest_days_overdue: number; }` |
| `ReportingFrequency` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `type ReportingFrequency = 'annual' \| 'biannual' \| 'quarterly' \| 'monthly';` |
| `ReportingFrequency` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `type ReportingFrequency = 'annual' \| 'biannual' \| 'quarterly' \| 'monthly';` |
| `ReportingPeriod` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface ReportingPeriod {   label: string;   startDate: string;   endDate: string; }` |
| `ReportingPeriod` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface ReportingPeriod {   label: string; startDate: string; endDate: string; }   export const getReportingPeriods = (businessName: string, asOf?: string) =>   request<ReportingPeriod[]>(`/businesses/${encodeURIComponent(businessName)}/reporting-periods${asOf ? `?asOf=${encodeURIComponent(asOf)}` : ''}`);   export const nominateBankAccount = (businessName: string, bankAccountName: string, routingDetail: string, accountNumber: string) =>   request<{ id: number }>(`/businesses/${encodeURIComponent(businessName)}/bank-accounts`, { method: 'POST', body: JSON.stringify({ bankAccountName, routingDetail, accountNumber }) });   export interface BusinessConfigurationReport {   businessName: string;   addresses: { address_type: string; address1?: string; city?: string; [key: string]: unknown }[];   phones: { phone_type: string; phone?: string; [key: string]: unknown }[];   ownerOrPartners: string[];   bankAccounts: { name: string; routingDetail: string; accountNumber: string }[];   homeCurrency: string \| null;   secondaryCurrencies: string[];   hierarchies: HierarchyGroupingWithValues[];   locations: { name: string; city: string; locationType: string }[];   categories: string[];   chartOfAccountsPrototype: string \| null;   notes: { name: string; text: string }[]; }` |
| `ReportRow` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface ReportRow {   report: string;   category: string;   account: string;   account_id: number;   depth: number;   combination_ids: string \| null;   accountnumber: string \| null;   balance_minor: number \| null; }` |
| `ReportRow` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface ReportRow {   report: string;   category: string;   account: AccountName;   depth: number;   accountnumber: string \| null;   balance_minor: number \| null; }` |
| `RequestSources` | `backend/src/recording.ts` | (none) | `interface RequestSources {   params: Record<string, unknown>;   query: Record<string, unknown>;   body: Record<string, unknown>; }` |
| `ResolvedOpenContainerAccounts` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface ResolvedOpenContainerAccounts {   containerSpaceAccount: string;   containerOccupiedAccount: string;   unitSpaceAccount: string;   unitOccupiedAccount: string;   containerSpaceAccountId: number;   containerOccupiedAccountId: number;   unitSpaceAccountId: number;   unitOccupiedAccountId: number;   inventoryFromAccount: string;   inventoryToAccount: string;   inventoryFromAccountId: number;   inventoryToAccountId: number;   unitCostMinor: number \| null; }` |
| `ResolvedOpenContainerAccounts` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface ResolvedOpenContainerAccounts {   containerSpaceAccount: string;   containerOccupiedAccount: string;   unitSpaceAccount: string;   unitOccupiedAccount: string;   containerSpaceAccountId: number;   containerOccupiedAccountId: number;   unitSpaceAccountId: number;   unitOccupiedAccountId: number;   inventoryFromAccount: string;   inventoryToAccount: string;   inventoryFromAccountId: number;   inventoryToAccountId: number;   unitCostMinor: number \| null; }` |
| `ResolvedReceiveAccounts` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface ResolvedReceiveAccounts {   inventoryAccount: string;   payableAccount: string;   unitCostMinor: number \| null; }` |
| `ResolvedReceiveAccounts` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface ResolvedReceiveAccounts {   inventoryAccount: string;   payableAccount: string;   unitCostMinor: number \| null; }` |
| `ResolvedRollover` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface ResolvedRollover {   reference: string;   lines: RolloverLine[];   accountsCarriedForward: number; }` |
| `ResolvedRollover` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface ResolvedRollover {   reference: string;   lines: { account: AccountName; amount_minor: number }[];   accountsCarriedForward: number; }` |
| `ResolvedTransferAccounts` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface ResolvedTransferAccounts {   fromInventoryAccount: string;   toInventoryAccount: string;   unitCostMinor: number \| null; }` |
| `ResolvedTransferAccounts` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface ResolvedTransferAccounts {   fromInventoryAccount: string;   toInventoryAccount: string;   unitCostMinor: number \| null; }` |
| `RestockLineInput` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface RestockLineInput {   item: string;   quantity: number; }` |
| `RestockLineInput` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface RestockLineInput {   item: string;   quantity: number; }` |
| `RolloverLine` | `backend/src/db-reports.ts` | (none) | `interface RolloverLine {   account: string;   amount_minor: number; }` |
| `RolloverResult` | `backend/src/db-reports.ts` | (none) | `interface RolloverResult {   newLedger: LedgerName;   accountsCarriedForward: number;   openingBalanceReference: string; }` |
| `Row` | `frontend/src/lib/journalGrid.ts` | (none) | `interface Row {   account: string;   debit: string; // kept as the raw text the person typed, not a number,   credit: string; // so "12.5" vs "12.50" vs an empty field are distinct   memo: string; }` |
| `RuntimeDatabase` | `backend/src/sqlite-runtime.ts` | (none) | `interface RuntimeDatabase {   exec(sql: string): void;   prepare(sql: string): RuntimeStatement;   transaction<T extends (...args: never[]) => unknown>(fn: T): (...args: Parameters<T>) => ReturnType<T>;   close(): void; }` |
| `RuntimeStatement` | `backend/src/sqlite-runtime.ts` | (none) | `interface RuntimeStatement {   get(...params: unknown[]): unknown;   all(...params: unknown[]): unknown[];   run(...params: unknown[]): { changes: number \| bigint; lastInsertRowid: number \| bigint }; }` |
| `SalesCategorySummary` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface SalesCategorySummary {   category: string;   quantity: number;   amount_minor: number; }` |
| `SalesCategorySummary` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface SalesCategorySummary {   category: string;   quantity: number;   amount_minor: number; }` |
| `SalesCogsMatrix` | `backend/src/db-matrix-reports.ts` | `frontend/src/lib/matrix-api.ts` | `interface SalesCogsMatrix {   rowAxis: MatrixAxis;   colAxis: MatrixAxis;   cells: MatrixCell[];   totalSalesMinor: number;   totalCogsMinor: number; }` |
| `SalesCogsMatrix` | `frontend/src/lib/matrix-api.ts` | `backend/src/db-matrix-reports.ts` | `interface SalesCogsMatrix {   rowAxis: MatrixAxis;   colAxis: MatrixAxis;   cells: MatrixCell[];   totalSalesMinor: number;   totalCogsMinor: number; }` |
| `SalesOrderInput` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `interface SalesOrderInput {   reference: string;   business: string;   ledger: string;   customer: string;   item: string;   quantity: number;   price_minor: number;   location?: string;   transdate?: string;   description?: string; }` |
| `SalesOrderInput` | `frontend/src/lib/api.ts` | `backend/src/db-journal.ts` | `interface SalesOrderInput {   reference: string;   business: BusinessName;   ledger: LedgerName;   customer: string;   item: string;   quantity: number;   price_minor: number;   location?: string;   transdate?: string;   description?: string; }` |
| `SalesReport` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface SalesReport {   detailed: SalesReportLine[];   category_summary: SalesCategorySummary[];   total_quantity: number;   total_amount_minor: number; }` |
| `SalesReport` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface SalesReport {   detailed: SalesReportLine[];   category_summary: SalesCategorySummary[];   total_quantity: number;   total_amount_minor: number; }` |
| `SalesReportLine` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface SalesReportLine {   invoice_date: string;   reference: string;   item_name: string \| null;   description: string;   quantity: number \| null;   unit_price_minor: number \| null;   amount_minor: number; }` |
| `SalesReportLine` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface SalesReportLine {   invoice_date: string;   reference: string;   item_name: string \| null;   description: string;   quantity: number \| null;   unit_price_minor: number \| null;   amount_minor: number; }` |
| `ScheduleLine` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface ScheduleLine {   day: string;   starts_at: string;   ends_at: string; }` |
| `ScheduleLine` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface ScheduleLine {   day: string;   starts_at: string;   ends_at: string; }` |
| `SessionContext` | `backend/src/session-context.ts` | `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts` | `interface SessionContext {   userId: number;   business: RealBusinessNode;   ledger: string; }` |
| `SessionContext` | `frontend/src/lib/session.ts` | `backend/src/session-context.ts`, `frontend/src/lib/state.svelte.ts` | `interface SessionContext {   businessId: number;   businessName: BusinessName;   ledgerId: number;   ledgerName: LedgerName;   languageId: number;   languageName: string; }` |
| `SessionContext` | `frontend/src/lib/state.svelte.ts` | `backend/src/session-context.ts`, `frontend/src/lib/session.ts` | `interface SessionContext {   businessId: number;   businessName: BusinessName;   ledgerId: number;   ledgerName: LedgerName;   languageId: number;   languageName: string;   profitCenterId?: number;   profitCenterName?: string; }` |
| `StagedLine` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `interface StagedLine {   reference: string;   business: BusinessName;   ledger: LedgerName;   description?: string;   transdate?: string;   account: AccountName;   accountId?: number;   amount_minor: number;   memo?: string;   bankReference?: string; }` |
| `StagedLine` | `frontend/src/lib/api.ts` | `backend/src/db-journal.ts` | `interface StagedLine {   reference: string;   business: BusinessName;   ledger: LedgerName;   description?: string;   transdate?: string;   account: AccountName;   accountId?: number; // resolves name collisions — see docs/pm-frontend-reference.md   amount_minor: number;   memo?: string; }` |
| `StatementLine` | `backend/src/db-reports.ts` | `backend/src/db.ts`, `frontend/src/lib/api.ts` | `interface StatementLine {   name: string;   accountnumber: string \| null;   debit_minor: number;   credit_minor: number;   is_contra: boolean; }` |
| `StatementLine` | `backend/src/db.ts` | `backend/src/db-reports.ts`, `frontend/src/lib/api.ts` | `interface StatementLine {   invoice_id: number;   reference: string;   invoice_date: string;   due_date: string \| null;   total_minor: number;   paid_minor: number;   outstanding_minor: number;   status: 'Paid' \| 'Outstanding' \| 'Partially paid'; }` |
| `StatementLine` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts`, `backend/src/db.ts` | `interface StatementLine {   name: string;   accountnumber: string \| null;   debit_minor: number;   credit_minor: number;   is_contra: boolean; }` |
| `StatementLine` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts`, `backend/src/db.ts` | `interface StatementLine {   invoice_id: number;   reference: string;   invoice_date: string;   due_date: string \| null;   total_minor: number;   paid_minor: number;   outstanding_minor: number;   status: 'Paid' \| 'Outstanding' \| 'Partially paid'; }` |
| `StockMovementReport` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface StockMovementReport {   receipts: OrderReceiptRow[];   transfers: StockTransferRow[];   sales: StockSaleRow[]; }` |
| `StockMovementReport` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface StockMovementReport {   receipts: OrderReceiptRow[];   transfers: StockTransferRow[];   sales: StockSaleRow[]; }` |
| `StockMovementRow` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface StockMovementRow {   item: string;   category: string \| null;   quantity: number;   date: string; }` |
| `StockMovementRow` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface StockMovementRow {   item: string;   category: string \| null;   quantity: number;   date: string; }` |
| `StockOnHandCell` | `backend/src/db-matrix-reports.ts` | `frontend/src/lib/matrix-api.ts` | `interface StockOnHandCell {   rowKey: string;   colKey: string;   quantityBottles: number;   valueAtCostMinor: number;   lastCostMinor: number \| null;   averageCostMinor: number \| null;   realizableValueMinor: number; }` |
| `StockOnHandCell` | `frontend/src/lib/matrix-api.ts` | `backend/src/db-matrix-reports.ts` | `interface StockOnHandCell {   rowKey: string;   colKey: string;   quantityBottles: number;   valueAtCostMinor: number;   lastCostMinor: number \| null;   averageCostMinor: number \| null;   realizableValueMinor: number; }` |
| `StockOnHandMatrix` | `backend/src/db-matrix-reports.ts` | `frontend/src/lib/matrix-api.ts` | `interface StockOnHandMatrix {   rowAxis: MatrixAxis;   colAxis: MatrixAxis;   cells: StockOnHandCell[];   totalValueAtCostMinor: number;   totalRealizableValueMinor: number; }` |
| `StockOnHandMatrix` | `frontend/src/lib/matrix-api.ts` | `backend/src/db-matrix-reports.ts` | `interface StockOnHandMatrix {   rowAxis: MatrixAxis;   colAxis: MatrixAxis;   cells: StockOnHandCell[];   totalValueAtCostMinor: number;   totalRealizableValueMinor: number; }` |
| `StockOutRiskRow` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface StockOutRiskRow {   item: string;   location: string;   quantity_on_hand: number;   daily_consumption_rate: number;   days_until_stockout: number \| null;   shortest_lead_time_days: number \| null;   at_risk: boolean; }` |
| `StockOutRiskRow` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface StockOutRiskRow {   item: string;   location: string;   quantity_on_hand: number;   daily_consumption_rate: number;   days_until_stockout: number \| null;   shortest_lead_time_days: number \| null;   at_risk: boolean; }` |
| `StockTake` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface StockTake {   id: number;   location: string;   take_date: string;   status: 'draft' \| 'completed';   lines: StockTakeLine[]; }` |
| `StockTake` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface StockTake {   id: number;   location: string;   take_date: string;   status: 'draft' \| 'completed';   lines: StockTakeLine[]; }` |
| `StockTakeLine` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface StockTakeLine {   id: number;   item: string;   shelf_side: string \| null;   rack: string \| null;   level: number \| null;   expected_quantity: number;   counted_quantity: number \| null; }` |
| `StockTakeLine` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface StockTakeLine {   id: number;   item: string;   shelf_side: string \| null;   rack: string \| null;   level: number \| null;   expected_quantity: number;   counted_quantity: number \| null; }` |
| `StorageSpaceCurrencyRow` | `frontend/src/lib/api.ts` | (none) | `interface StorageSpaceCurrencyRow {   currency: string;   installed_minor: number;   occupied_minor: number;   remaining_minor: number;   balanced: boolean; }` |
| `StorageSpaceLocationGroup` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `interface StorageSpaceLocationGroup {   location: string;   currencies: { currency: string; installed_minor: number; occupied_minor: number; remaining_minor: number; balanced: boolean }[]; }` |
| `StorageSpaceLocationGroup` | `frontend/src/lib/api.ts` | `backend/src/db-stock.ts` | `interface StorageSpaceLocationGroup {   location: string;   currencies: StorageSpaceCurrencyRow[]; }` |
| `StorageSpaceRow` | `backend/src/db-stock.ts` | (none) | `interface StorageSpaceRow {   location: string;   currency: string;   kind: 'Installed' \| 'Occupied' \| 'Remaining';   balance_minor: number; }` |
| `TransferStockInput` | `backend/src/db-stock.ts` | (none) | `interface TransferStockInput {   business: BusinessName;   ledger: LedgerName;   itemName: ItemName;   fromLocationName: LocationName;   toLocationName: LocationName;   quantity: number;   reference: string;   transdate?: string; }` |
| `TranslationRow` | `shared-fixtures/translations.ts` | (none) | `interface TranslationRow {   concept: string;   language: string;   text: string; }` |
| `TreeItem` | `frontend/src/lib/treeAdapter.ts` | (none) | `interface TreeItem {   path: string;   id: number;   name: string;   accountnumber: string \| null;   balance_minor: number \| null; }` |
| `TrialBalance` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface TrialBalance {   rows: TrialBalanceRow[];   total_debit_minor: number;   total_credit_minor: number;   by_currency: TrialBalanceCurrencySubtotal[]; }` |
| `TrialBalance` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface TrialBalance {   rows: TrialBalanceRow[];   total_debit_minor: number;   total_credit_minor: number;   by_currency: TrialBalanceCurrencySubtotal[]; }` |
| `TrialBalanceComparison` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface TrialBalanceComparison {   ledgerA: LedgerName;   ledgerB: LedgerName;   rows: TrialBalanceComparisonRow[]; }` |
| `TrialBalanceComparison` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface TrialBalanceComparison {   ledgerA: string;   ledgerB: string;   rows: TrialBalanceComparisonRow[]; }` |
| `TrialBalanceComparisonRow` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface TrialBalanceComparisonRow {   id: number;   name: string;   accountnumber: string \| null;   a_debit_minor: number;   a_credit_minor: number;   b_debit_minor: number;   b_credit_minor: number; }` |
| `TrialBalanceComparisonRow` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface TrialBalanceComparisonRow {   id: number;   name: string;   accountnumber: string \| null;   a_debit_minor: number;   a_credit_minor: number;   b_debit_minor: number;   b_credit_minor: number; }` |
| `TrialBalanceCurrencySubtotal` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface TrialBalanceCurrencySubtotal {   currency: string \| null;   total_debit_minor: number;   total_credit_minor: number;   balanced: boolean; }` |
| `TrialBalanceCurrencySubtotal` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface TrialBalanceCurrencySubtotal {   currency: string \| null;   total_debit_minor: number;   total_credit_minor: number;   balanced: boolean; }` |
| `TrialBalanceRow` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `interface TrialBalanceRow {   id: number;   name: string;   accountnumber: string \| null;   debit_minor: number;   credit_minor: number;   currency: string \| null;   has_quantity_postings: boolean; }` |
| `TrialBalanceRow` | `frontend/src/lib/api.ts` | `backend/src/db-reports.ts` | `interface TrialBalanceRow {   id: number;   name: string;   accountnumber: string \| null;   debit_minor: number;   credit_minor: number;   currency: string \| null;   has_quantity_postings: boolean; }` |
| `TypedAddress` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface TypedAddress {   address_type: string;   record_name: string;   address_line1: string \| null;   address_line2: string \| null;   city: string \| null;   region: string \| null;   postal_code: string \| null;   country: string \| null; }` |
| `TypedPhone` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface TypedPhone {   phone_type: string;   record_name: string;   phone: string \| null; }` |
| `TypedPhone` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface TypedPhone {   phone_type: string;   record_name: string;   phone: string \| null; }` |
| `UblImportLine` | `backend/src/db.ts` | (none) | `interface UblImportLine {   description: string;   quantity: number;   unitPriceMinor: number;   amountMinor: number; }` |
| `UblImportResult` | `backend/src/db.ts` | (none) | `interface UblImportResult {   reference: string;   issueDate: string;   supplierName: string;   totalMinor: number;   taxMinor: number;   lines: UblImportLine[]; }` |
| `UserId` | `backend/src/db.ts` | `backend/src/auth.ts`, `backend/src/db-journal.ts`, `backend/src/db-reports.ts`, `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/primitives.ts`, `backend/src/session-context.ts` | `type UserId = number & { readonly __brand: 'UserId' };` |
| `UserRoleMatrix` | `backend/src/auth.ts` | `frontend/src/lib/api.ts` | `interface UserRoleMatrix {   users: string[];   roles: string[];   assignments: { user: string; role: string }[]; }` |
| `UserRoleMatrix` | `frontend/src/lib/api.ts` | `backend/src/auth.ts` | `interface UserRoleMatrix {   users: string[];   roles: string[];   assignments: { user: string; role: string }[]; }` |
| `UserSummary` | `backend/src/auth.ts` | `frontend/src/lib/api.ts` | `interface UserSummary {   id: number;   username: string;   active: boolean;   roles: string[]; }` |
| `UserSummary` | `frontend/src/lib/api.ts` | `backend/src/auth.ts` | `interface UserSummary {   id: number;   username: string;   active: boolean;   roles: string[]; }` |
| `VocabularyWord` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `interface VocabularyWord {   name: string;   translations: Record<string, string>; }` |
| `VocabularyWord` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `interface VocabularyWord {   name: string;   translations: Record<string, string>; }` |

### Functions (434, alphabetical)

| Name | Defined in | Referenced in | Prototype |
|---|---|---|---|
| `activeRows` | `frontend/src/lib/journalGrid.ts` | (none) | `activeRows(rows: Row[]): Row[]` |
| `addFinancialStatementNote` | `backend/src/db.ts` | (none) | `addFinancialStatementNote(businessName: BusinessName, noteText: string, userId: UserId): ` |
| `addOrUpdateItemSource` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `addOrUpdateItemSource(input: ItemSourceInput): void` |
| `addRow` | `frontend/src/lib/journalGrid.ts` | (none) | `addRow(rows: Row[]): Row[]` |
| `addTaskDependency` | `backend/src/db.ts` | (none) | `addTaskDependency(dependentTask: string, predecessorTask: string, dependencyType: 'finish_to_start' \| 'start_to_start' \| 'finish_to_finish' \| 'start_to_finish', userId: UserId): void` |
| `addTypedAddress` | `backend/src/db.ts` | (none) | `addTypedAddress(entityName: string, addressType: string, value: Partial<Contact>, userId: UserId): string` |
| `addTypedContactPerson` | `backend/src/db.ts` | (none) | `addTypedContactPerson(entityName: string, contactType: string, value: { name: string; phone?: string \| null; email?: string \| null }, userId: UserId): string` |
| `addTypedPhone` | `backend/src/db.ts` | (none) | `addTypedPhone(entityName: string, phoneType: string, number: string, userId: UserId): string` |
| `adjustLocationCapacity` | `backend/src/db-stock.ts` | (none) | `adjustLocationCapacity(business: BusinessName, ledger: LedgerName, locationName: LocationName, itemName: ItemName, itemQuantityDelta: number, transdate: string, userId: UserId, referenceSuffix: string): void` |
| `allocatePayment` | `backend/src/db.ts` | (none) | `allocatePayment(invoiceId: number, paymentReference: string, allocatedMinor: number, allocationDate: string, paymentAccount: string, userId: UserId, skipJournalPosting = false): void` |
| `asAccountName` | `backend/src/db.ts` | `backend/src/db-journal.ts`, `backend/src/db-reports.ts`, `backend/src/db-stock.ts`, `backend/src/primitives.ts`, `frontend/src/lib/api.ts` | `asAccountName(name: string): AccountName` |
| `asAccountName` | `frontend/src/lib/api.ts` | `backend/src/db-journal.ts`, `backend/src/db-reports.ts`, `backend/src/db-stock.ts`, `backend/src/db.ts`, `backend/src/primitives.ts` | `asAccountName(name: string): AccountName` |
| `asBusinessName` | `backend/src/db.ts` | `backend/src/auth-middleware.ts`, `backend/src/db-journal.ts`, `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/invoice.ts`, `backend/src/primitives.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts` | `asBusinessName(name: string): BusinessName` |
| `asBusinessName` | `frontend/src/lib/api.ts` | `backend/src/auth-middleware.ts`, `backend/src/db-journal.ts`, `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/db.ts`, `backend/src/invoice.ts`, `backend/src/primitives.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts` | `asBusinessName(name: string): BusinessName` |
| `asCustomerName` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `asCustomerName(name: string): CustomerName` |
| `asCustomerName` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `asCustomerName(name: string): CustomerName` |
| `asEmployeeName` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `asEmployeeName(name: string): EmployeeName` |
| `asEmployeeName` | `frontend/src/lib/api.ts` | `backend/src/db.ts` | `asEmployeeName(name: string): EmployeeName` |
| `asEntityId` | `backend/src/db.ts` | (none) | `asEntityId(id: number): EntityId` |
| `asItemName` | `backend/src/db.ts` | `backend/src/db-journal.ts`, `backend/src/db-stock.ts`, `frontend/src/lib/api.ts` | `asItemName(name: string): ItemName` |
| `asItemName` | `frontend/src/lib/api.ts` | `backend/src/db-journal.ts`, `backend/src/db-stock.ts`, `backend/src/db.ts` | `asItemName(name: string): ItemName` |
| `asLedgerName` | `backend/src/db.ts` | `backend/src/db-journal.ts`, `backend/src/db-stock.ts`, `backend/src/invoice.ts`, `backend/src/primitives.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts` | `asLedgerName(name: string): LedgerName` |
| `asLedgerName` | `frontend/src/lib/api.ts` | `backend/src/db-journal.ts`, `backend/src/db-stock.ts`, `backend/src/db.ts`, `backend/src/invoice.ts`, `backend/src/primitives.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts` | `asLedgerName(name: string): LedgerName` |
| `asLocationName` | `backend/src/db.ts` | `backend/src/db-journal.ts`, `backend/src/db-stock.ts`, `frontend/src/lib/api.ts` | `asLocationName(name: string): LocationName` |
| `asLocationName` | `frontend/src/lib/api.ts` | `backend/src/db-journal.ts`, `backend/src/db-stock.ts`, `backend/src/db.ts` | `asLocationName(name: string): LocationName` |
| `asProviderName` | `backend/src/db.ts` | `backend/src/db-journal.ts`, `frontend/src/lib/api.ts` | `asProviderName(name: string): ProviderName` |
| `asProviderName` | `frontend/src/lib/api.ts` | `backend/src/db-journal.ts`, `backend/src/db.ts` | `asProviderName(name: string): ProviderName` |
| `assertPeriodOpen` | `backend/src/db-journal.ts` | `backend/src/db-stock.ts` | `assertPeriodOpen(business: BusinessName, ledger: LedgerName, transdate: string): void` |
| `asUserId` | `backend/src/db.ts` | `backend/src/db-journal.ts`, `backend/src/db-seed.ts`, `backend/src/db-stock.ts` | `asUserId(id: number): UserId` |
| `attachUser` | `backend/src/auth-middleware.ts` | `backend/src/recording.ts`, `backend/src/server.ts` | `attachUser(req: Request, _res: Response, next: NextFunction): void` |
| `authenticateCustomer` | `backend/src/db.ts` | (none) | `authenticateCustomer(name: string, password: string): boolean` |
| `autoBalanceTrailingRow` | `frontend/src/lib/journalGrid.ts` | (none) | `autoBalanceTrailingRow(rows: Row[], changedIndex: number): Row[]` |
| `autoExpandIfTrailingRowFilled` | `frontend/src/lib/journalGrid.ts` | (none) | `autoExpandIfTrailingRowFilled(rows: Row[]): Row[]` |
| `buildCategoryTree` | `backend/src/db-reports.ts` | (none) | `buildCategoryTree(lines: StatementLine[], accountIdByName: Map<string, number>, rootName: string, normalSide: 'debit' \| 'credit' = 'debit', knownRootId?: number): CategoryTreeNode[]` |
| `buildProfitAndLossFromBalances` | `backend/src/db-reports.ts` | `backend/src/db-matrix-reports.ts` | `buildProfitAndLossFromBalances(business: string, balances: Map<number, number>): ProfitAndLoss` |
| `canSave` | `frontend/src/lib/journalGrid.ts` | (none) | `canSave(rows: Row[]): boolean` |
| `canUserPostToLedger` | `backend/src/auth.ts` | (none) | `canUserPostToLedger(business: BusinessName, ledger: LedgerName, user: { username: string; roles: string[] }): boolean` |
| `changeOwnPassword` | `backend/src/auth.ts` | `frontend/src/lib/api.ts` | `changeOwnPassword(userId: number, currentPassword: string, newPassword: string): void` |
| `changePassword` | `backend/src/auth.ts` | (none) | `changePassword(userId: number, newPassword: string): void` |
| `checkEInvoiceDiscrepancies` | `backend/src/db.ts` | (none) | `checkEInvoiceDiscrepancies(parsed: UblImportResult, poReference?: string): EInvoiceDiscrepancy[]` |
| `climbInstanceTree` | `backend/src/db.ts` | (none) | `climbInstanceTree(instanceId: number): ` |
| `clockInToProject` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `clockInToProject(employeeName: EmployeeName, projectExpenseAccount: AccountName, business: BusinessName, ledger: LedgerName, userId: UserId): EmployeeClock` |
| `clockOutOfProject` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `clockOutOfProject(employeeName: EmployeeName, business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `closeBooks` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `closeBooks(business: BusinessName, ledger: LedgerName, asOfDate: string, retainedEarningsAccount: string, userId: UserId, hierarchyPath: string[] = []): CloseBooksResult` |
| `closePeriod` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `closePeriod(business: BusinessName, ledger: LedgerName, throughDate: string, userId: UserId): void` |
| `compareVersions` | `frontend/src/lib/api.ts` | (none) | `compareVersions(a: string, b: string): number` |
| `completeCashPurchase` | `backend/src/db.ts` | `frontend/src/lib/api.ts`, `frontend/src/lib/canned-journal.ts` | `completeCashPurchase(input: CashPurchaseInput, userId: UserId): CashPurchaseResult` |
| `completePosSale` | `backend/src/db.ts` | `frontend/src/lib/api.ts`, `frontend/src/lib/canned-journal.ts` | `completePosSale(input: PosSaleInput, userId: UserId): PosSaleResult` |
| `completeStockTake` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `completeStockTake(stockTakeId: number, business: BusinessName, ledger: LedgerName, varianceExpenseAccount: AccountName, /** @deprecated See docs/stock-api-reference.md § Stock takes. */   inventoryAccount: string, unitCostMinorByItem: Record<string, number>, userId: UserId): void` |
| `computeSuggestedFill` | `frontend/src/lib/journalGrid.ts` | (none) | `computeSuggestedFill(rows: Row[], trailingIndex: number): number \| null` |
| `confirmPickedLine` | `backend/src/db.ts` | (none) | `confirmPickedLine(invoiceId: number, invoiceLineId: number, business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `confirmRestockPickedLine` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `confirmRestockPickedLine(runReference: string, itemName: string, business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `consumeFromLots` | `backend/src/db-stock.ts` | (none) | `consumeFromLots(itemName: ItemName, quantity: number): ` |
| `convertStorageSpace` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `convertStorageSpace(business: BusinessName, ledger: LedgerName, itemName: ItemName, definitionDimensions: [string, string][], fromValues: string[], toValues: string[], quantity: number, userId: UserId, reference?: string): void` |
| `copyChartOfAccountsInto` | `backend/src/db.ts` | `backend/src/db-reports.ts`, `backend/src/db-seed.ts` | `copyChartOfAccountsInto(business: TypedNode<string>, destRoot: TypedNode<string>, coaPrototype: string \| undefined, userId: UserId): void` |
| `countInventoryListing` | `backend/src/db-stock.ts` | (none) | `countInventoryListing(): number` |
| `countInvoices` | `backend/src/db.ts` | (none) | `countInvoices(business: BusinessName, ledger: LedgerName, invoiceType?: 'AR' \| 'AP', source: 'manual' \| 'pos' \| 'all' = 'manual'): number` |
| `countItems` | `backend/src/db.ts` | (none) | `countItems(businessName: BusinessName): number` |
| `countJournalEntries` | `backend/src/db-journal.ts` | (none) | `countJournalEntries(business: BusinessName, ledger: LedgerName): number` |
| `createAndConfigureDepartment` | `backend/src/db.ts` | (none) | `createAndConfigureDepartment(businessName: BusinessName, departmentName: string, userId: UserId): TypedNode<'DepartmentEntityName'>` |
| `createAndConfigureLocation` | `backend/src/db.ts` | `backend/src/db-journal.ts` | `createAndConfigureLocation(businessName: BusinessName, locationName: string, location: StockLocation, userId: UserId, group?: string, groupingName?: string): TypedNode<'LocationEntityName'>` |
| `createBusiness` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `frontend/src/lib/api.ts` | `createBusiness(businessName: BusinessName, financialYearLabel: string, userId: UserId, coaPrototype?: string, secondaryCurrencies?: string[], entityStructure?: EntityStructure, partnerNames?: string[], financialYearStart?: string, reportingFrequency?: ReportingFrequency): ` |
| `createCustomer` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `createCustomer(name: string, userId: UserId): ` |
| `createDepartment` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `createDepartment(businessName: BusinessName, departmentName: string, userId: UserId): TypedNode<'DepartmentEntityName'>` |
| `createEmployee` | `backend/src/db.ts` | (none) | `createEmployee(name: string, placeOfEmployment: string, userId: UserId): ` |
| `createEntityRaw` | `backend/src/db.ts` | `backend/src/primitives.ts` | `createEntityRaw(input: NewEntity, userId: UserId): EntityNode` |
| `createInvoice` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `createInvoice(input: InvoiceInput, userId: UserId): number` |
| `createItem` | `backend/src/db.ts` | (none) | `createItem(name: string, parentCategoryOrItemsRoot: string, userId: UserId, businessName?: BusinessName): void` |
| `createLedger` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `createLedger(businessName: BusinessName, ledgerName: LedgerName, userId: UserId): void` |
| `createLocation` | `backend/src/db.ts` | `backend/src/db-journal.ts`, `frontend/src/lib/api.ts` | `createLocation(businessName: BusinessName, locationName: string, userId: UserId): TypedNode<'LocationEntityName'>` |
| `createLocationType` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `createLocationType(name: string, userId: UserId): void` |
| `createPosTerminal` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `createPosTerminal(terminalName: string, locationName: LocationName, userId: UserId): void` |
| `createProduct` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `createProduct(name: string, parent: string, userId: UserId): void` |
| `createProfitCenter` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `createProfitCenter(businessName: BusinessName, profitCenterName: string, userId: UserId): ` |
| `createProjectTask` | `backend/src/db.ts` | (none) | `createProjectTask(projectName: string, taskName: string, plannedStart: string, plannedEnd: string, userId: UserId): void` |
| `createProvider` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `createProvider(name: string, userId: UserId): ` |
| `createRecurringJournal` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `createRecurringJournal(business: BusinessName, ledger: LedgerName, reference: string, startDate: string, recurrence: Recurrence, lines: RecurringJournalLine[], userId: UserId, description?: string, recurrenceCount?: number): void` |
| `createStockTake` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `createStockTake(locationName: LocationName, takeDate: string, userId: UserId, business?: BusinessName): number` |
| `createSystemEntity` | `backend/src/db-stock.ts` | (none) | `createSystemEntity(name: string, parentId: number \| null): number` |
| `createUser` | `backend/src/auth.ts` | (none) | `createUser(username: string, password: string, roleNames: string[]): UserSummary` |
| `creditTotalMinor` | `frontend/src/lib/journalGrid.ts` | (none) | `creditTotalMinor(rows: Row[]): number` |
| `debitTotalMinor` | `frontend/src/lib/journalGrid.ts` | (none) | `debitTotalMinor(rows: Row[]): number` |
| `decimalPlacesFor` | `frontend/src/lib/format.ts` | (none) | `decimalPlacesFor(unitCode: string \| undefined): number` |
| `defineProductShape` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `defineProductShape(businessName: BusinessName, dimensions: [string, string][], userId: UserId): ` |
| `deleteBomComponent` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `deleteBomComponent(assemblyItem: string, componentItem: string, userId: UserId): void` |
| `deleteDepartment` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `deleteDepartment(businessName: BusinessName, departmentName: string, userId: UserId): void` |
| `deleteEmployeeDepartment` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `deleteEmployeeDepartment(employeeName: string, userId: UserId): void` |
| `deleteEmployeeManager` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `deleteEmployeeManager(employeeName: string, userId: UserId): void` |
| `deleteEntityLink` | `backend/src/db.ts` | `backend/src/primitives.ts` | `deleteEntityLink(entityName: string, linkType: string, userId: UserId): void` |
| `deleteHierarchyGrouping` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `deleteHierarchyGrouping(businessName: BusinessName, groupingName: string, userId: UserId): void` |
| `deleteHierarchyParent` | `backend/src/db.ts` | (none) | `deleteHierarchyParent(entityName: string, hierarchyName: string, userId: UserId): void` |
| `deleteHierarchyValue` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `deleteHierarchyValue(businessName: BusinessName, groupingName: string, valueName: string, userId: UserId): void` |
| `deleteItemSource` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `deleteItemSource(id: number): void` |
| `deleteLocation` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `deleteLocation(businessName: BusinessName, locationName: string, userId: UserId): void` |
| `deleteMenuOverride` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `deleteMenuOverride(menuItemKey: string, scope: 'business' \| 'user', scopeId: number, userId: UserId = asUserId(1)): void` |
| `deleteTranslationConcept` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `deleteTranslationConcept(conceptName: string, userId: UserId): void` |
| `deleteTypedAddress` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `deleteTypedAddress(entityName: string, addressType: string, userId: UserId): void` |
| `deleteTypedContactPerson` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `deleteTypedContactPerson(entityName: string, contactType: string, userId: UserId): void` |
| `deleteTypedPhone` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `deleteTypedPhone(entityName: string, phoneType: string, userId: UserId): void` |
| `deleteVocabularyPreference` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `deleteVocabularyPreference(conceptName: string, scope: 'business' \| 'user', scopeId: number): void` |
| `differenceMinor` | `frontend/src/lib/journalGrid.ts` | (none) | `differenceMinor(rows: Row[]): number` |
| `dispatchItems` | `backend/src/db-stock.ts` | `backend/src/db.ts`, `frontend/src/lib/api.ts` | `dispatchItems(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, locationName: LocationName, quantity: number, userId: UserId, transdate?: string, combinationValues?: string[], combinationShape?: [string, string][]): void` |
| `dispatchOrderFromPickingList` | `backend/src/db.ts` | (none) | `dispatchOrderFromPickingList(invoiceId: number, locationName: LocationName, revenueAccount: string, taxAccount: string, userId: UserId): void` |
| `dispatchRestockFromPickingList` | `backend/src/db.ts` | (none) | `dispatchRestockFromPickingList(runReference: string, business: BusinessName, ledger: LedgerName, warehouseName: LocationName, retailOutletName: LocationName, lines: RestockLineInput[], userId: UserId, transdate?: string): void` |
| `emptyRow` | `frontend/src/lib/journalGrid.ts` | (none) | `emptyRow(): Row` |
| `ensureAddressType` | `backend/src/db.ts` | (none) | `ensureAddressType(typeName: string, userId: UserId): void` |
| `ensureAtLeastOneRow` | `frontend/src/lib/journalGrid.ts` | (none) | `ensureAtLeastOneRow(rows: Row[]): Row[]` |
| `ensureCombinationAccountLeaf` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `ensureCombinationAccountLeaf(baseAccountName: string, instanceTopNode: { id: number; name: string }, userId: UserId, baseAccountId?: number): ` |
| `ensureContactPersonType` | `backend/src/db.ts` | (none) | `ensureContactPersonType(typeName: string, userId: UserId): void` |
| `ensureCurrencyAccount` | `backend/src/db-reports.ts` | `backend/src/db.ts` | `ensureCurrencyAccount(baseAccountId: number, currency: string, userId: UserId): ` |
| `ensureCurrencyPair` | `backend/src/db.ts` | (none) | `ensureCurrencyPair(businessName: BusinessName, fromCurrency: string, toCurrency: string, userId: UserId): ` |
| `ensureDepartmentAccounts` | `backend/src/db.ts` | (none) | `ensureDepartmentAccounts(businessName: BusinessName, departmentName: string, userId: UserId): ` |
| `ensureDepartmentsRoot` | `backend/src/db.ts` | (none) | `ensureDepartmentsRoot(businessName: BusinessName, userId: UserId): ` |
| `ensureHierarchyGrouping` | `backend/src/db.ts` | (none) | `ensureHierarchyGrouping(businessName: BusinessName, groupingName: string, userId: UserId): ` |
| `ensureHierarchyValue` | `backend/src/db.ts` | (none) | `ensureHierarchyValue(businessName: BusinessName, groupingName: string, valueName: string, userId: UserId): ` |
| `ensureItemInventoryAccount` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `ensureItemInventoryAccount(itemName: ItemName, userId: UserId, tier?: string, business?: BusinessName, profitCenter?: string): ` |
| `ensureItemLocationInventoryAccount` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `ensureItemLocationInventoryAccount(itemName: ItemName, locationName: LocationName, userId: UserId, tier?: string, business?: BusinessName, profitCenter?: string): ` |
| `ensureItemLocationLeaf` | `backend/src/db.ts` | (none) | `ensureItemLocationLeaf(itemName: ItemName, locationName: LocationName, userId: UserId, business?: BusinessName): ` |
| `ensureItemLocationQuantityAccount` | `backend/src/db.ts` | `backend/src/db-matrix-reports.ts`, `backend/src/db-stock.ts` | `ensureItemLocationQuantityAccount(itemName: ItemName, locationName: LocationName, userId: UserId, tier?: string, business?: BusinessName): ` |
| `ensureItemQuantityAccounts` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `ensureItemQuantityAccounts(itemName: ItemName, userId: UserId): ` |
| `ensureItemSalesCogsAccounts` | `backend/src/db.ts` | (none) | `ensureItemSalesCogsAccounts(itemName: ItemName, userId: UserId, tier?: string, business?: BusinessName, profitCenter?: string): ` |
| `ensureItemTier` | `backend/src/db.ts` | (none) | `ensureItemTier(baseProductName: ItemName, tier: string, userId: UserId, business?: BusinessName): ` |
| `ensureItemTierLocationLeaf` | `backend/src/db.ts` | (none) | `ensureItemTierLocationLeaf(tierItemName: string, locationName: LocationName, userId: UserId, tierItemId?: number): ` |
| `ensureLocationCapacityAccount` | `backend/src/db-stock.ts` | `backend/src/db-journal.ts`, `backend/src/db.ts` | `ensureLocationCapacityAccount(business: BusinessName, ledger: LedgerName, locationName: LocationName, userId: UserId): ` |
| `ensureLocationScopedAccount` | `backend/src/db-journal.ts` | (none) | `ensureLocationScopedAccount(baseAccountName: string, locationName: string, userId: UserId): string` |
| `ensureLocationStorageRoot` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `ensureLocationStorageRoot(business: BusinessName, locationName: string, userId: UserId): ` |
| `ensurePhoneType` | `backend/src/db.ts` | (none) | `ensurePhoneType(typeName: string, userId: UserId): void` |
| `ensureProductInstance` | `backend/src/db.ts` | `backend/src/auth.ts`, `backend/src/db-stock.ts` | `ensureProductInstance(businessName: BusinessName, definitionDimensions: [string, string][], values: string[], userId: UserId): ` |
| `ensureProfitCenterRetainedEarningsAccount` | `backend/src/db-reports.ts` | (none) | `ensureProfitCenterRetainedEarningsAccount(baseAccountId: number, profitCenterName: string, userId: UserId): ` |
| `ensureStorageCapacityStructure` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `ensureStorageCapacityStructure(parentEntity: { id: number; name: string }, userId: UserId): ` |
| `ensureUnitsTrackingBaseAccounts` | `backend/src/db-stock.ts` | (none) | `ensureUnitsTrackingBaseAccounts(business: BusinessName, userId: UserId): ` |
| `ensureVocabularyAlternate` | `backend/src/db.ts` | (none) | `ensureVocabularyAlternate(conceptName: string, desiredText: string, businessName: string, userId: UserId): string` |
| `escapeAscii` | `shared-fixtures/csv.ts` | (none) | `escapeAscii(text: string): string` |
| `exportInvoiceAsUbl` | `backend/src/db.ts` | (none) | `exportInvoiceAsUbl(invoiceId: number): string` |
| `filterToItems` | `frontend/src/lib/entityTree.ts` | (none) | `filterToItems(entities: EntityNode[]): EntityNode[]` |
| `formatAmount` | `frontend/src/lib/format.ts` | (none) | `formatAmount(smallestUnits: number, numberFormat: string, unitCode?: string): string` |
| `formatDate` | `frontend/src/lib/format.ts` | (none) | `formatDate(isoDate: string \| null \| undefined, dateFormat: string): string` |
| `freshReference` | `frontend/src/lib/canned-journal.ts` | (none) | `freshReference(prefix: string): string` |
| `fulfillOrder` | `backend/src/db-stock.ts` | `backend/src/db-journal.ts` | `fulfillOrder(orderReference: string, fulfillingReference: string, business: BusinessName, ledger: LedgerName, quantityFulfilled: number, valueFulfilledMinor: number, userId: UserId, transdate?: string): void` |
| `getAccountProfitCenter` | `backend/src/db.ts` | `backend/src/db-reports.ts` | `getAccountProfitCenter(accountId: number): string \| null` |
| `getAccountsPostedTo` | `backend/src/db.ts` | (none) | `getAccountsPostedTo(reference: string): string[]` |
| `getActiveLedger` | `backend/src/db.ts` | `backend/src/auth.ts`, `backend/src/db-journal.ts`, `frontend/src/lib/api.ts` | `getActiveLedger(businessName: BusinessName): LedgerName \| null` |
| `getActiveShiftsAtLocation` | `backend/src/db.ts` | (none) | `getActiveShiftsAtLocation(locationName: string): PosShift[]` |
| `getAgedInvoices` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getAgedInvoices(business: BusinessName, ledger: LedgerName, invoiceType: 'AR' \| 'AP', asOfDate: string): AgedInvoiceRow[]` |
| `getAgedSummary` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getAgedSummary(business: BusinessName, ledger: LedgerName, invoiceType: 'AR' \| 'AP', asOfDate: string): AgedSummaryRow[]` |
| `getAgingBuckets` | `backend/src/db.ts` | (none) | `getAgingBuckets(paymentTermsDays: number \| null): AgingBucket[]` |
| `getAxisValues` | `backend/src/db-matrix-reports.ts` | `frontend/src/lib/matrix-api.ts` | `getAxisValues(businessName: BusinessName, ledgerName: LedgerName): AxisValues` |
| `getBalanceSheet` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `getBalanceSheet(businessName: BusinessName, ledgerName: LedgerName, asOfDate?: string): BalanceSheet` |
| `getBankAccounts` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getBankAccounts(business: BusinessName, ledger: LedgerName): BankAccountRow[]` |
| `getBelowReorderStock` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `getBelowReorderStock(): BelowReorderRow[]` |
| `getBomComponents` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getBomComponents(assemblyItem: string): ` |
| `getBusinessConfigurationReport` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getBusinessConfigurationReport(businessName: BusinessName): BusinessConfigurationReport` |
| `getBusinesses` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getBusinesses(): ` |
| `getBusinessHierarchy` | `backend/src/db.ts` | `backend/src/db-matrix-reports.ts` | `getBusinessHierarchy(businessName: BusinessName): HierarchyGroupingWithValues[]` |
| `getBusinessHomeCurrency` | `backend/src/db.ts` | `backend/src/db-reports.ts` | `getBusinessHomeCurrency(businessName: string): string \| null` |
| `getBusinessProductShapes` | `backend/src/db.ts` | (none) | `getBusinessProductShapes(businessName: BusinessName): [string, string][][]` |
| `getBusinessReportingPeriod` | `backend/src/db.ts` | (none) | `getBusinessReportingPeriod(businessName: string): ` |
| `getBusinessReports` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `getBusinessReports(business: string): ReportRow[]` |
| `getBusinessTypes` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getBusinessTypes(): BusinessTypeInfo[]` |
| `getCashFlowForecast` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getCashFlowForecast(business: BusinessName, ledger: LedgerName, asOfDate: string, horizonDays: number): CashFlowForecast` |
| `getCashPosition` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getCashPosition(business: BusinessName, ledger: LedgerName): CashPositionByCurrency[]` |
| `getChartOfAccounts` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `getChartOfAccounts(business: string): ChartRow[]` |
| `getChartOfAccountsPrototype` | `backend/src/db.ts` | (none) | `getChartOfAccountsPrototype(language: string): string[]` |
| `getCombinationByUpc` | `backend/src/db.ts` | (none) | `getCombinationByUpc(upc: string): ` |
| `getCombinationDisplayName` | `backend/src/db.ts` | `backend/src/db-reports.ts` | `getCombinationDisplayName(entityId: number): string` |
| `getConceptsWithAlternates` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getConceptsWithAlternates(): ConceptWithAlternates[]` |
| `getContact` | `backend/src/db.ts` | `backend/src/db-journal.ts`, `backend/src/invoice.ts`, `frontend/src/lib/api.ts` | `getContact(entityName: string): Contact \| undefined` |
| `getContactBaseAccounts` | `backend/src/db.ts` | (none) | `getContactBaseAccounts(contactName: string): string[]` |
| `getContactTypes` | `backend/src/db.ts` | (none) | `getContactTypes(contactName: string): string[]` |
| `getCounterpartyHistory` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getCounterpartyHistory(business: BusinessName, ledger: LedgerName, counterpartyName: string): HistoryLine[]` |
| `getCreditStatus` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getCreditStatus(entityName: string): CreditStatus` |
| `getCurrencyExchangeRate` | `backend/src/db.ts` | (none) | `getCurrencyExchangeRate(businessName: BusinessName, fromCurrency: string, toCurrency: string, side: 'buy' \| 'sell'): number \| null` |
| `getCustomerStatement` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getCustomerStatement(business: BusinessName, ledger: LedgerName, customerName: string, asOfDate: string): CustomerStatement` |
| `getDefaultLanguage` | `backend/src/db.ts` | `backend/src/invoice.ts`, `frontend/src/lib/api.ts` | `getDefaultLanguage(): string \| null` |
| `getEffectiveSaleCurrency` | `backend/src/db-stock.ts` | `backend/src/db.ts` | `getEffectiveSaleCurrency(terminalName: string \| undefined): string \| null` |
| `getEmployeeDepartment` | `backend/src/db.ts` | (none) | `getEmployeeDepartment(employeeName: string): string \| undefined` |
| `getEmployeeManager` | `backend/src/db.ts` | (none) | `getEmployeeManager(employeeName: string): string \| undefined` |
| `getEmployeeSchedule` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getEmployeeSchedule(employeeName: string): EmployeeScheduleLine[]` |
| `getEntitiesWithLink` | `backend/src/db.ts` | (none) | `getEntitiesWithLink(linkType: string): ` |
| `getEntitiesWithRelationship` | `backend/src/db.ts` | (none) | `getEntitiesWithRelationship(relationshipType: string): ` |
| `getEntity` | `backend/src/db.ts` | `backend/src/primitives.ts` | `getEntity(id: number): EntityNode \| undefined` |
| `getEntityHistory` | `backend/src/db.ts` | (none) | `getEntityHistory(id: number): EntityHistoryRow[]` |
| `getEntityLink` | `backend/src/db.ts` | `backend/src/primitives.ts` | `getEntityLink(entityName: string, linkType: string): string \| undefined` |
| `getEntityLinksPointingAt` | `backend/src/db.ts` | (none) | `getEntityLinksPointingAt(targetName: string): ` |
| `getEntityTree` | `backend/src/db.ts` | `backend/src/db-reports.ts`, `frontend/src/lib/api.ts` | `getEntityTree(businessName?: string): (EntityNode &` |
| `getExpiringStock` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `getExpiringStock(asOfDate: string, withinDays: number): ExpiringLot[]` |
| `getFinancialStatementNotes` | `backend/src/db.ts` | (none) | `getFinancialStatementNotes(businessName: BusinessName): ` |
| `getHierarchy` | `backend/src/db.ts` | `backend/src/primitives.ts`, `frontend/src/lib/api.ts` | `getHierarchy(rootName: string, relationshipType?: string, knownRootId?: number): HierarchyNode` |
| `getHierarchyAncestorChain` | `backend/src/db.ts` | (none) | `getHierarchyAncestorChain(entityName: string, hierarchyName: string): string[]` |
| `getHierarchyAssignments` | `backend/src/db.ts` | `backend/src/db-stock.ts`, `frontend/src/lib/api.ts` | `getHierarchyAssignments(hierarchyName: string): Record<string, string>` |
| `getHierarchyChain` | `backend/src/db.ts` | (none) | `getHierarchyChain(leafName: ItemName \| LocationName): HierarchyChainNode[]` |
| `getHierarchyChildren` | `backend/src/db.ts` | `backend/src/db-reports.ts` | `getHierarchyChildren(parentName: string, hierarchyName: string): string[]` |
| `getHierarchyGroupForAccount` | `backend/src/db.ts` | (none) | `getHierarchyGroupForAccount(accountName: AccountName, hierarchyName: string): string \| undefined` |
| `getHierarchyGroupForLocation` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `getHierarchyGroupForLocation(locationName: string, hierarchyName: string): string \| undefined` |
| `getHierarchyGroups` | `backend/src/db.ts` | `backend/src/db-reports.ts`, `frontend/src/lib/api.ts` | `getHierarchyGroups(hierarchyName: string): ` |
| `getHierarchyLinksPointingAt` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getHierarchyLinksPointingAt(targetName: string): ` |
| `getHierarchyParent` | `backend/src/db.ts` | `backend/src/db-matrix-reports.ts`, `backend/src/db-reports.ts`, `backend/src/db-stock.ts` | `getHierarchyParent(entityName: string, hierarchyName: string): string \| undefined` |
| `getInventoryListing` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `getInventoryListing(limit = 100, offset = 0): InventoryListingRow[]` |
| `getInventoryListingByLocation` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `getInventoryListingByLocation(business?: BusinessName, hierarchyName?: string): InventoryListingLocationGroup[]` |
| `getInvoice` | `backend/src/db.ts` | (none) | `getInvoice(id: number): Invoice \| undefined` |
| `getInvoiceLine` | `backend/src/db.ts` | `backend/src/invoice.ts` | `getInvoiceLine(reference: string, business: BusinessName, ledger: LedgerName): InvoiceLine \| undefined` |
| `getInvoiceOutstandingMinor` | `backend/src/db.ts` | (none) | `getInvoiceOutstandingMinor(invoiceId: number): number` |
| `getItem` | `backend/src/db.ts` | `frontend/src/lib/api.ts`, `frontend/src/lib/auth.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts` | `getItem(entityName: string): Item \| undefined` |
| `getItemByUpc` | `backend/src/db.ts` | (none) | `getItemByUpc(upc: string): ItemSummary \| undefined` |
| `getItemLeadTimes` | `backend/src/db-stock.ts` | (none) | `getItemLeadTimes(itemName: ItemName): ` |
| `getItemLocation` | `backend/src/db-stock.ts` | `backend/src/db.ts`, `frontend/src/lib/api.ts` | `getItemLocation(itemName: ItemName, locationName: LocationName): ItemLocationLevels` |
| `getItemPriceForCurrency` | `backend/src/db.ts` | (none) | `getItemPriceForCurrency(itemName: string, currency: string \| null, productInstanceId?: number): number \| null` |
| `getItemStorageOrigin` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getItemStorageOrigin(itemName: ItemName): 'Hot' \| 'Cold' \| undefined` |
| `getItemUnitCostMinor` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `getItemUnitCostMinor(itemName: ItemName): number \| null` |
| `getJournalEntry` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `getJournalEntry(business: BusinessName, ledger: LedgerName, journalId: number, occurrenceDate: string): JournalDetail \| undefined` |
| `getLanguageDirection` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getLanguageDirection(languageName: string): 'LTR' \| 'RTL' \| undefined` |
| `getLanguages` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getLanguages(): ` |
| `getLedgerBalances` | `backend/src/db-reports.ts` | `backend/src/db-matrix-reports.ts`, `backend/src/db.ts` | `getLedgerBalances(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, excludeCloseEntries = false): Map<number, number>` |
| `getLedgerBalancesByHierarchyStructural` | `backend/src/db-reports.ts` | (none) | `getLedgerBalancesByHierarchyStructural(businessName: BusinessName, ledgerName: LedgerName, hierarchyPath: string[], fromDate?: string, toDate?: string, excludeCloseEntries = false): Map<number, Map<string \| null, number>>` |
| `getLedgerBalancesByLocationStructural` | `backend/src/db-reports.ts` | (none) | `getLedgerBalancesByLocationStructural(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, excludeCloseEntries = false): Map<number, Map<string \| null, number>>` |
| `getLedgerDateRange` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `getLedgerDateRange(businessName: BusinessName, ledgerName: LedgerName): LedgerDateRange` |
| `getLedgers` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getLedgers(businessName: BusinessName): ` |
| `getLocalizedText` | `backend/src/db.ts` | `backend/src/invoice.ts`, `frontend/src/lib/api.ts` | `getLocalizedText(language: string, opts?: { businessName?: string; userId?: number }): Record<string, string>` |
| `getLocation` | `backend/src/db-stock.ts` | `backend/src/db.ts` | `getLocation(name: string, business?: BusinessName): Location \| undefined` |
| `getLocationCapacityStatus` | `backend/src/db-stock.ts` | (none) | `getLocationCapacityStatus(locationName: LocationName): LocationCapacityStatus` |
| `getLocationCurrencies` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getLocationCurrencies(locationName: string, business?: BusinessName): string[]` |
| `getLocationForAccount` | `backend/src/db.ts` | (none) | `getLocationForAccount(accountName: AccountName): string \| undefined` |
| `getLocationOpenHours` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getLocationOpenHours(locationName: string): OpenHoursLine[]` |
| `getLocationTypes` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `getLocationTypes(): string[]` |
| `getMenuTree` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `frontend/src/lib/api.ts` | `getMenuTree(opts?: { businessName?: string; userId?: number }): MenuSectionRow[]` |
| `getNominatedBankAccounts` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getNominatedBankAccounts(businessName: BusinessName): ` |
| `getOpenProjectClockForEmployee` | `backend/src/db-journal.ts` | (none) | `getOpenProjectClockForEmployee(employeeName: EmployeeName): EmployeeClock \| undefined` |
| `getOpenShiftForEmployee` | `backend/src/db.ts` | (none) | `getOpenShiftForEmployee(employeeName: string): PosShift \| undefined` |
| `getOrderStatus` | `backend/src/db-stock.ts` | `backend/src/db.ts`, `frontend/src/lib/api.ts` | `getOrderStatus(orderReference: string): ` |
| `getOrganizationChart` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getOrganizationChart(businessName: BusinessName): OrganizationChart` |
| `getOrgChartStructure` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getOrgChartStructure(businessName: BusinessName): OrgChartStructure` |
| `getPeriodLockStatus` | `backend/src/db-journal.ts` | (none) | `getPeriodLockStatus(business: BusinessName, ledger: LedgerName): PeriodLockStatus` |
| `getPickingList` | `backend/src/db.ts` | (none) | `getPickingList(invoiceId: number, locationName: LocationName): PickingListLine[]` |
| `getProfitAndLoss` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `getProfitAndLoss(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, excludeCloseEntries = true): ProfitAndLoss` |
| `getProfitAndLossByAxis` | `backend/src/db-matrix-reports.ts` | `frontend/src/lib/matrix-api.ts` | `getProfitAndLossByAxis(businessName: BusinessName, ledgerName: LedgerName, fromDate: string \| undefined, toDate: string \| undefined, outerAxis: MatrixAxis, innerAxis: MatrixAxis, outerFilter?: string, innerFilter?: string): ProfitAndLossByAxisNode[]` |
| `getProfitAndLossByHierarchy` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `getProfitAndLossByHierarchy(businessName: BusinessName, ledgerName: LedgerName, hierarchyPath: string[], fromDate?: string, toDate?: string): ProfitAndLossByGroup[]` |
| `getProfitAndLossByHierarchyTree` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `getProfitAndLossByHierarchyTree(businessName: BusinessName, ledgerName: LedgerName, hierarchyPath: string[], hierarchyName: string, fromDate?: string, toDate?: string): ProfitAndLossByGroupNode[]` |
| `getProfitAndLossComparison` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `getProfitAndLossComparison(businessName: BusinessName, ledgerA: LedgerName, ledgerB: LedgerName): ProfitAndLossComparison` |
| `getProfitAndLossForHierarchyGroup` | `backend/src/db-reports.ts` | (none) | `getProfitAndLossForHierarchyGroup(businessName: BusinessName, ledgerName: LedgerName, hierarchyPath: string[], groups: { name: string; parentName: string \| null }[], groupName: string, fromDate?: string, toDate?: string): ProfitAndLoss` |
| `getProfitCenters` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getProfitCenters(businessName: BusinessName): ` |
| `getProjectTasks` | `backend/src/db.ts` | (none) | `getProjectTasks(projectName: string): ` |
| `getQualifiedDisplayName` | `backend/src/db.ts` | `backend/src/db-reports.ts` | `getQualifiedDisplayName(entityId: number): string` |
| `getRelationship` | `backend/src/db.ts` | (none) | `getRelationship(entityName: string): Relationship \| undefined` |
| `getReminderCandidates` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getReminderCandidates(business: BusinessName, ledger: LedgerName, asOfDate: string): ReminderCandidate[]` |
| `getReportingPeriods` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getReportingPeriods(businessName: string, asOfDate?: string): ReportingPeriod[]` |
| `getRestockPickingList` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getRestockPickingList(runReference: string, warehouseName: LocationName, lines: RestockLineInput[]): PickingListLine[]` |
| `getSalesCogsMatrix` | `backend/src/db-matrix-reports.ts` | `frontend/src/lib/matrix-api.ts` | `getSalesCogsMatrix(businessName: BusinessName, ledgerName: LedgerName, fromDate: string \| undefined, toDate: string \| undefined, rowAxis: MatrixAxis, colAxis: MatrixAxis): SalesCogsMatrix` |
| `getSalesReport` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `getSalesReport(business: BusinessName, ledger: LedgerName, fromDate?: string, toDate?: string): SalesReport` |
| `getScheduleAtLocation` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getScheduleAtLocation(locationName: string): LocationScheduleLine[]` |
| `getSessionBusiness` | `backend/src/auth.ts` | `backend/src/auth-middleware.ts` | `getSessionBusiness(token: string): string \| null` |
| `getSessionProfitCenter` | `backend/src/auth.ts` | `backend/src/auth-middleware.ts` | `getSessionProfitCenter(token: string): string \| null` |
| `getSessionUser` | `backend/src/auth.ts` | `backend/src/auth-middleware.ts` | `getSessionUser(token: string \| undefined): AuthenticatedUser \| null` |
| `getStagedLines` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `getStagedLines(reference: string, business: BusinessName, ledger: LedgerName): StagedLine[]` |
| `getStockMovementReport` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `getStockMovementReport(business: string, ledgerName: string, fromDate?: string, toDate?: string, hierarchyName?: string): StockMovementReport` |
| `getStockOnHandMatrix` | `backend/src/db-matrix-reports.ts` | `frontend/src/lib/matrix-api.ts` | `getStockOnHandMatrix(rowAxis: MatrixAxis, colAxis: MatrixAxis): StockOnHandMatrix` |
| `getStockOutRiskReport` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `getStockOutRiskReport(windowDays: number = 2): StockOutRiskRow[]` |
| `getStockTake` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `getStockTake(id: number): StockTake \| undefined` |
| `getStorageSpaceReport` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `getStorageSpaceReport(): StorageSpaceLocationGroup[]` |
| `getTaskDependencies` | `backend/src/db.ts` | (none) | `getTaskDependencies(dependentTask: string): ` |
| `getTranslation` | `backend/src/db.ts` | (none) | `getTranslation(conceptName: string, languageName: string): string \| null` |
| `getTranslationsReferencing` | `backend/src/db.ts` | (none) | `getTranslationsReferencing(conceptName: string): ` |
| `getTrialBalance` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `getTrialBalance(businessName: BusinessName, ledgerName: LedgerName, asOfDate?: string): TrialBalance` |
| `getTrialBalanceComparison` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `getTrialBalanceComparison(businessName: BusinessName, ledgerA: LedgerName, ledgerB: LedgerName): TrialBalanceComparison` |
| `getTypedAddresses` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getTypedAddresses(entityName: string): TypedAddress[]` |
| `getTypedContactPersons` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getTypedContactPersons(entityName: string): ContactPerson[]` |
| `getTypedPhones` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getTypedPhones(entityName: string): TypedPhone[]` |
| `getUserRoleMatrix` | `backend/src/auth.ts` | `frontend/src/lib/api.ts` | `getUserRoleMatrix(businessName: BusinessName): UserRoleMatrix` |
| `getVocabularyAlternates` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getVocabularyAlternates(wordName: string): string[]` |
| `getVocabularyWords` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `getVocabularyWords(): VocabularyWord[]` |
| `hashPassword` | `backend/src/password.ts` | `backend/src/auth.ts`, `backend/src/db.ts` | `hashPassword(password: string): string` |
| `hasRole` | `frontend/src/lib/state.svelte.ts` | `frontend/src/lib/auth.ts` | `hasRole(state: AuthState \| null, ...roles: string[]): boolean` |
| `importUblInvoiceAsDraft` | `backend/src/db.ts` | (none) | `importUblInvoiceAsDraft(xml: string, business: BusinessName, ledger: LedgerName, vendorName: string, userId: UserId, poReference?: string): ` |
| `instantiateChartOfAccounts` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `instantiateChartOfAccounts(businessName: BusinessName, coaPrototype: string \| undefined, userId: UserId): void` |
| `isBalanced` | `frontend/src/lib/journalGrid.ts` | (none) | `isBalanced(rows: Row[]): boolean` |
| `isDescendantOf` | `backend/src/db.ts` | `frontend/src/lib/entityTree.ts` | `isDescendantOf(entityName: string, rootName: string): boolean` |
| `isDescendantOf` | `frontend/src/lib/entityTree.ts` | `backend/src/db.ts` | `isDescendantOf(entity: EntityNode, ancestorName: string, allEntities: EntityNode[], matchSuffix = false): boolean` |
| `isGenuineCategoryOrItemsRoot` | `backend/src/db.ts` | (none) | `isGenuineCategoryOrItemsRoot(name: string): boolean` |
| `isRecording` | `backend/src/recording.ts` | (none) | `isRecording(userId: number): boolean` |
| `isRowEmpty` | `frontend/src/lib/journalGrid.ts` | (none) | `isRowEmpty(row: Row): boolean` |
| `isRowFilled` | `frontend/src/lib/journalGrid.ts` | (none) | `isRowFilled(row: Row): boolean` |
| `layoutOrgChart` | `frontend/src/lib/org-chart-layout.ts` | (none) | `layoutOrgChart(nodes: OrgChartBoxInput[]): OrgChartLayout` |
| `listAddressTypes` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `listAddressTypes(): string[]` |
| `listContactPersonTypes` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `listContactPersonTypes(): string[]` |
| `listCurrencyPairs` | `backend/src/db.ts` | (none) | `listCurrencyPairs(currencies: string[]): ` |
| `listDepartments` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `listDepartments(businessName: BusinessName): ` |
| `listInvoices` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `listInvoices(business: BusinessName, ledger: LedgerName, options: ListInvoicesOptions = {}): Invoice[]` |
| `listItems` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `listItems(businessName: BusinessName, limit?: number, offset = 0): ItemSummary[]` |
| `listItemSources` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `listItemSources(itemName: string): ItemSource[]` |
| `listJournalEntries` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `listJournalEntries(business: BusinessName, ledger: LedgerName, limit = 100, offset = 0): JournalSummary[]` |
| `listLineTypes` | `backend/src/db.ts` | (none) | `listLineTypes(): string[]` |
| `listPendingCustomers` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `listPendingCustomers(): PendingCustomer[]` |
| `listPhoneTypes` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `listPhoneTypes(): string[]` |
| `listPosTerminals` | `backend/src/db-stock.ts` | (none) | `listPosTerminals(locationName: string): ` |
| `listProducts` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `listProducts(): ProductSummary[]` |
| `listRoles` | `backend/src/auth.ts` | (none) | `listRoles(): ` |
| `listUsers` | `backend/src/auth.ts` | (none) | `listUsers(): UserSummary[]` |
| `loadAllTranslations` | `shared-fixtures/translations.ts` | (none) | `loadAllTranslations(): TranslationRow[]` |
| `loadDemoCategories` | `shared-fixtures/wine-retail-demo-data.ts` | (none) | `loadDemoCategories(): DemoCategory[]` |
| `loadDemoLocations` | `shared-fixtures/wine-retail-demo-data.ts` | (none) | `loadDemoLocations(): DemoLocation[]` |
| `loadDemoProducts` | `shared-fixtures/wine-retail-demo-data.ts` | (none) | `loadDemoProducts(): DemoProduct[]` |
| `loadDemoStockLevels` | `shared-fixtures/wine-retail-demo-data.ts` | (none) | `loadDemoStockLevels(): DemoStockLevel[]` |
| `loadDemoUpcs` | `shared-fixtures/wine-retail-demo-data.ts` | (none) | `loadDemoUpcs(): DemoUpc[]` |
| `login` | `backend/src/auth.ts` | `backend/src/db-reports.ts`, `backend/src/server.ts`, `frontend/src/lib/api.ts` | `login(username: string, password: string): ` |
| `logout` | `backend/src/auth.ts` | `frontend/src/lib/api.ts` | `logout(token: string): void` |
| `mergeContactDetail` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `backend/src/db-stock.ts` | `mergeContactDetail(entityId: number, fields: Record<string, unknown>): void` |
| `nominateBankAccount` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `nominateBankAccount(businessName: BusinessName, bankAccountName: string, routingDetail: string, accountNumber: string, userId: UserId): ` |
| `nominateLocationCurrency` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `nominateLocationCurrency(locationName: string, currencyCode: string, userId: UserId, business?: BusinessName): void` |
| `openContainerLines` | `frontend/src/lib/canned-journal.ts` | (none) | `openContainerLines(input: {   cartonsOpened: number;   unitsProduced: number;   containerSpaceAccount: string;   containerOccupiedAccount: string;   unitSpaceAccount: string;   unitOccupiedAccount: string;   containerSpaceAccountId: number;   containerOccupiedAccountId: number;   unitSpaceAccountId: number;   unitOccupiedAccountId: number;   inventoryFromAccount: string;   inventoryToAccount: string;   inventoryFromAccountId: number;   inventoryToAccountId: number;   unitCostMinor: number \| null; }): ` |
| `openStorageContainer` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `openStorageContainer(business: BusinessName, ledger: LedgerName, locationName: LocationName, itemName: ItemName, definitionDimensions: [string, string][], containerValues: string[], cartonsOpened: number, unitValues: string[], unitsProduced: number, userId: UserId, reference?: string): void` |
| `parseMinorUnits` | `frontend/src/lib/money.ts` | (none) | `parseMinorUnits(text: string): number` |
| `parseQuantity` | `frontend/src/lib/money.ts` | (none) | `parseQuantity(text: string): number` |
| `parseUblInvoice` | `backend/src/db.ts` | (none) | `parseUblInvoice(xml: string): UblImportResult` |
| `payEmployeeWages` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `payEmployeeWages(input: PayEmployeeWagesInput, userId: UserId): PayEmployeeWagesResult` |
| `placeOrder` | `backend/src/db-stock.ts` | `backend/src/db-journal.ts` | `placeOrder(orderReference: string, business: BusinessName, ledger: LedgerName, quantity: number, priceMinor: number, userId: UserId, transdate?: string, vendor?: ProviderName, item?: ItemName, location?: LocationName): void` |
| `postAPPayment` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `postAPPayment(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `postARReceipt` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `postARReceipt(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `postBomComponents` | `backend/src/db.ts` | (none) | `postBomComponents(assemblyItem: string, business: string, userId: UserId): void` |
| `postInvoice` | `backend/src/db.ts` | (none) | `postInvoice(id: number,   revenueOrExpenseAccount: string \| { name: string; id: number } \| ((line: InvoiceLineInput & { id: number }) => string \| { name: string; id: number }), taxAccount: string, userId: UserId, restockInventory = false, counterpartyAccountOverride?: string): void` |
| `postJournalEntry` | `backend/src/db-journal.ts` | `backend/src/db-reports.ts`, `backend/src/db-stock.ts`, `backend/src/db.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/canned-journal.ts` | `postJournalEntry(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `postLocation` | `backend/src/db-journal.ts` | (none) | `postLocation(reference: string, business: BusinessName, userId: UserId): TypedNode<'LocationEntityName'>` |
| `postOrderDispatch` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `postOrderDispatch(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `postOrderReceipt` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `postOrderReceipt(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `postPurchaseOrder` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `postPurchaseOrder(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `postQuantityMovement` | `backend/src/db-stock.ts` | `backend/src/db-journal.ts`, `backend/src/db.ts` | `postQuantityMovement(business: BusinessName, ledger: LedgerName, reference: string, account: AccountName, deltaQuantity: number, userId: UserId, transdate?: string, locationName?: LocationName, accountId?: number): void` |
| `postSalesOrder` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `postSalesOrder(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `postStagedQuantityMovement` | `backend/src/db-stock.ts` | (none) | `postStagedQuantityMovement(business: BusinessName, ledger: LedgerName, reference: string, userId: UserId): void` |
| `previewCloseBooks` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `previewCloseBooks(businessName: BusinessName, ledger: LedgerName, asOfDate: string, retainedEarningsAccount: string, hierarchyPath: string[] = []): CloseBooksPreview` |
| `provisionBusinessAdminUser` | `backend/src/auth.ts` | (none) | `provisionBusinessAdminUser(businessName: BusinessName, createdBy: UserId): ` |
| `readCsv` | `shared-fixtures/csv.ts` | `shared-fixtures/add-brand-translation.ts`, `shared-fixtures/add-header-translations.ts`, `shared-fixtures/add-journal-remaining-translations.ts`, `shared-fixtures/add-journal-translations.ts`, `shared-fixtures/add-menu-translations.ts`, `shared-fixtures/translations.ts`, `shared-fixtures/wine-retail-demo-data.ts`, `shared-fixtures/wine-retail.ts` | `readCsv(text: string): Record<string, string>[]` |
| `receiveIntoStorageLines` | `frontend/src/lib/canned-journal.ts` | (none) | `receiveIntoStorageLines(input: {   quantity: number;   resolved: { inventoryAccount: string; payableAccount: string; unitCostMinor: number \| null } \| null; }): CannedLine[]` |
| `receiveItems` | `backend/src/db-stock.ts` | `backend/src/db.ts`, `frontend/src/lib/api.ts` | `receiveItems(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, locationName: LocationName, quantity: number, userId: UserId, transdate?: string, combinationValues?: string[], combinationShape?: [string, string][]): void` |
| `receiveLot` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `receiveLot(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, lotNumber: string, receivedDate: string, expirationDate: string \| null, quantity: number, userId: UserId, costBasisMinor?: number): void` |
| `receiveStockPhysical` | `backend/src/db-stock.ts` | (none) | `receiveStockPhysical(input: ReceiveStockPhysicalInput, userId: UserId): void` |
| `recordingMiddleware` | `backend/src/recording.ts` | `backend/src/server.ts` | `recordingMiddleware(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction): void` |
| `recordInvoiceLine` | `backend/src/db.ts` | `backend/src/db-journal.ts` | `recordInvoiceLine(reference: string, business: string, ledger: string, description: string, quantity: number \| null, unitPriceMinor: number \| null, amountMinor: number, taxMinor: number): void` |
| `recordReminderSent` | `backend/src/db.ts` | (none) | `recordReminderSent(customerName: string): number` |
| `recordRequest` | `backend/src/recording.ts` | (none) | `recordRequest(userId: number, screenName: string, sources: RequestSources): void` |
| `recordStockTakeCount` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `recordStockTakeCount(stockTakeId: number, itemName: ItemName, countedQuantity: number): void` |
| `registerBankAccount` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `registerBankAccount(accountName: string, business: string, scopeName: string, overdraftLimitMinor: number \| null, userId: UserId): void` |
| `registerCustomer` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `registerCustomer(input: CustomerRegistrationInput, userId: UserId): void` |
| `removeRowAt` | `frontend/src/lib/journalGrid.ts` | (none) | `removeRowAt(rows: Row[], index: number): Row[]` |
| `removeStagedLine` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `removeStagedLine(reference: string, business: BusinessName, ledger: LedgerName, account: string): void` |
| `reopenPeriod` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `reopenPeriod(business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `reorderSiblings` | `backend/src/db.ts` | (none) | `reorderSiblings(entityId: EntityId, direction: 'up' \| 'down', userId: UserId): void` |
| `reorderSiblingsBulk` | `backend/src/db.ts` | (none) | `reorderSiblingsBulk(entityIds: number[], direction: 'up' \| 'down', userId: UserId): void` |
| `requireAuth` | `backend/src/auth-middleware.ts` | `backend/src/server.ts` | `requireAuth(req: Request, res: Response, next: NextFunction): void` |
| `requireGlobalCoaCategory` | `backend/src/db.ts` | (none) | `requireGlobalCoaCategory(categoryName: string): TypedNode<'RootName'>` |
| `requireGlobalRole` | `backend/src/auth-middleware.ts` | (none) | `requireGlobalRole(...roles: string[]): void` |
| `requireRole` | `backend/src/auth-middleware.ts` | `backend/src/server.ts` | `requireRole(...roles: string[]): void` |
| `resetReminderLevel` | `backend/src/db.ts` | (none) | `resetReminderLevel(customerName: string): void` |
| `resolveBusinessCoaAccountId` | `backend/src/db.ts` | `backend/src/db-journal.ts`, `backend/src/db-reports.ts`, `backend/src/db-stock.ts` | `resolveBusinessCoaAccountId(businessName: BusinessName, accountName: string): number` |
| `resolveBusinessLocationsRootId` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `resolveBusinessLocationsRootId(businessName: string): number \| undefined` |
| `resolveCashAtBankAccount` | `backend/src/db-reports.ts` | `backend/src/db.ts` | `resolveCashAtBankAccount(business: BusinessName, currency: string \| undefined, userId: UserId): ` |
| `resolveDispatchLocation` | `backend/src/db.ts` | (none) | `resolveDispatchLocation(itemName: ItemName, logicalLocationName: LocationName): LocationName` |
| `resolveItemId` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `resolveItemId(itemName: ItemName): number \| undefined` |
| `resolveItemLocationQuantityAccountId` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `resolveItemLocationQuantityAccountId(itemName: ItemName, locationName: LocationName, tier?: string): number \| undefined` |
| `resolveOpenContainerAccounts` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `resolveOpenContainerAccounts(business: BusinessName, locationName: LocationName, itemName: ItemName, definitionDimensions: [string, string][], containerValues: string[], unitValues: string[], userId: UserId): ResolvedOpenContainerAccounts` |
| `resolveReceiveAccounts` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `resolveReceiveAccounts(business: BusinessName, itemName: ItemName, combinationShape: [string, string][] \| undefined, combinationValues: string[] \| undefined, userId: UserId): ResolvedReceiveAccounts \| null` |
| `resolveRolloverLines` | `backend/src/db-reports.ts` | `frontend/src/lib/api.ts` | `resolveRolloverLines(business: BusinessName, oldLedger: LedgerName, newLedger: LedgerName, asOfDate: string, userId: UserId): ResolvedRollover` |
| `resolveTransferAccounts` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `resolveTransferAccounts(business: BusinessName, itemName: ItemName, fromLocationName: LocationName, toLocationName: LocationName, userId: UserId): ResolvedTransferAccounts` |
| `reverseJournalEntry` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `reverseJournalEntry(business: BusinessName, ledger: LedgerName, journalId: number, occurrenceDate: string, userId: UserId, reversalDate?: string): void` |
| `revokeEntity` | `backend/src/db.ts` | `backend/src/auth.ts`, `backend/src/primitives.ts`, `frontend/src/lib/api.ts` | `revokeEntity(id: number, userId: UserId): void` |
| `rolloverToNewPeriod` | `backend/src/db-reports.ts` | (none) | `rolloverToNewPeriod(business: BusinessName, oldLedger: LedgerName, newLedger: LedgerName, asOfDate: string, userId: UserId): RolloverResult` |
| `saveBusinessTypeAnswers` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `saveBusinessTypeAnswers(businessName: BusinessName, answers: Record<string, string>, userId: UserId): void` |
| `screenTitle` | `frontend/src/lib/state.svelte.ts` | `frontend/src/lib/menu.ts` | `screenTitle(href: string): string \| undefined` |
| `seedRemainingData` | `backend/src/db-seed.ts` | `backend/src/db.ts` | `seedRemainingData(): void` |
| `setAccountCurrency` | `backend/src/db-reports.ts` | `backend/src/db-stock.ts`, `backend/src/db.ts` | `setAccountCurrency(accountName: string, currency: string \| null, entityId?: number): void` |
| `setActiveLedger` | `backend/src/db.ts` | `backend/src/db-reports.ts` | `setActiveLedger(businessName: BusinessName, ledgerName: LedgerName, userId: UserId): void` |
| `setBusinessHomeCurrency` | `backend/src/db.ts` | (none) | `setBusinessHomeCurrency(businessName: string, currencyCode: string, userId: UserId): void` |
| `setBusinessReportingPeriod` | `backend/src/db.ts` | (none) | `setBusinessReportingPeriod(businessName: string, financialYearStart: string, frequency: ReportingFrequency, userId: UserId): void` |
| `setContact` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `setContact(entityName: string, contact: Partial<Contact>): void` |
| `setContactType` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `setContactType(contactName: string, typeName: string, userId: UserId): void` |
| `setCurrencyExchangeRate` | `backend/src/db.ts` | (none) | `setCurrencyExchangeRate(businessName: BusinessName, fromCurrency: string, toCurrency: string, userId: UserId, buyRateMinor?: number, sellRateMinor?: number): void` |
| `setDefaultLanguage` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `setDefaultLanguage(languageName: string, userId: UserId): void` |
| `setEmployeeDepartment` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `setEmployeeDepartment(employeeName: string, departmentName: string, userId: UserId, employeeId?: number, departmentId?: number): void` |
| `setEmployeeManager` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `setEmployeeManager(employeeName: string, managerName: string, userId: UserId, employeeId?: number, managerId?: number): void` |
| `setEmployeeSchedule` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `setEmployeeSchedule(employeeName: string, locationName: string, schedule: ScheduleLine[]): void` |
| `setEntityLink` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/primitives.ts`, `frontend/src/lib/entityTree.ts` | `setEntityLink(entityName: string, linkType: string, targetName: string, userId: UserId, entityId?: number, targetId?: number): string` |
| `setHierarchyParent` | `backend/src/db.ts` | `backend/src/db-journal.ts`, `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `frontend/src/lib/entityTree.ts` | `setHierarchyParent(entityName: string, hierarchyName: string, parentName: string, userId: UserId, entityId?: number, targetId?: number): void` |
| `setItem` | `backend/src/db.ts` | `frontend/src/lib/api.ts`, `frontend/src/lib/auth.ts`, `frontend/src/lib/session.ts`, `frontend/src/lib/state.svelte.ts` | `setItem(entityName: string, item: Partial<Item>): void` |
| `setItemLocationLevelDetails` | `backend/src/db-stock.ts` | (none) | `setItemLocationLevelDetails(itemName: ItemName, locationName: LocationName, levels: Omit<ItemLocationLevels, 'quantity_on_hand'>, business?: BusinessName, ledger?: LedgerName, userId?: UserId): void` |
| `setItemLocationLevels` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `setItemLocationLevels(itemName: ItemName, locationName: LocationName, levels: {     minLevel?: number \| null;     maxLevel?: number \| null;     reorderLevel?: number \| null;     shelfSide?: string \| null;     rack?: string \| null;     level?: number \| null;   }, business?: BusinessName, ledger?: LedgerName, userId?: UserId): void` |
| `setItemProduct` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `setItemProduct(itemName: string, productName: string \| null, userId: UserId): void` |
| `setItemSourceLeadTime` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `setItemSourceLeadTime(itemName: ItemName, vendorName: ProviderName, days: number, userId: UserId): void` |
| `setItemStorageOrigin` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `setItemStorageOrigin(itemName: ItemName, origin: 'Hot' \| 'Cold' \| null, userId: UserId): void` |
| `setLanguageDirection` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `setLanguageDirection(languageName: string, direction: 'LTR' \| 'RTL' \| null, userId: UserId): void` |
| `setLineType` | `backend/src/db.ts` | (none) | `setLineType(entityName: string, lineType: string \| null, userId: UserId): void` |
| `setLocation` | `backend/src/db-stock.ts` | `backend/src/db-journal.ts`, `backend/src/db.ts` | `setLocation(name: string, location: Location, business?: BusinessName): void` |
| `setLocationOpenHours` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `setLocationOpenHours(locationName: string, hours: OpenHoursLine[]): void` |
| `setMenuOverride` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `setMenuOverride(menuItemKey: string, scope: 'business' \| 'user', scopeId: number, overrideLabel: string \| null, hidden: boolean, userId: UserId = asUserId(1)): void` |
| `setOwnDateFormat` | `backend/src/auth.ts` | `frontend/src/lib/api.ts` | `setOwnDateFormat(userId: number, dateFormat: string): void` |
| `setOwnNumberFormat` | `backend/src/auth.ts` | `frontend/src/lib/api.ts` | `setOwnNumberFormat(userId: number, numberFormat: string): void` |
| `setOwnPageSize` | `backend/src/auth.ts` | `frontend/src/lib/api.ts` | `setOwnPageSize(userId: number, pageSize: number): void` |
| `setPosPin` | `backend/src/db.ts` | (none) | `setPosPin(employeeName: string, pin: string): void` |
| `setRelationship` | `backend/src/db.ts` | `backend/src/db-journal.ts` | `setRelationship(entityName: string, relationshipType: string, targetName: string, userId: UserId): void` |
| `setSessionBusiness` | `backend/src/auth.ts` | (none) | `setSessionBusiness(token: string, businessName: string): void` |
| `setSessionProfitCenter` | `backend/src/auth.ts` | `frontend/src/lib/api.ts` | `setSessionProfitCenter(token: string, profitCenterName: string \| null): void` |
| `setTerminalCurrency` | `backend/src/db-stock.ts` | (none) | `setTerminalCurrency(terminalName: string, currency: string \| null): void` |
| `setTranslation` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `frontend/src/lib/api.ts` | `setTranslation(conceptName: string, languageName: string, text: string, userId: UserId = asUserId(1)): void` |
| `setupEquityStructure` | `backend/src/db.ts` | (none) | `setupEquityStructure(businessName: BusinessName, structure: EntityStructure, userId: UserId, coaPrototype?: string, partnerNames?: string[]): void` |
| `setUserActive` | `backend/src/auth.ts` | (none) | `setUserActive(userId: number, active: boolean): void` |
| `setUserRoleInBusiness` | `backend/src/auth.ts` | `frontend/src/lib/api.ts` | `setUserRoleInBusiness(businessName: BusinessName, username: string, roleName: string, userId: UserId): void` |
| `setUserRoles` | `backend/src/auth.ts` | (none) | `setUserRoles(userId: number, roleNames: string[]): void` |
| `setVocabularyPreference` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `setVocabularyPreference(conceptName: string, scope: 'business' \| 'user', scopeId: number, preferredAlternateName: string): void` |
| `signOff` | `backend/src/db.ts` | (none) | `signOff(shiftId: number): void` |
| `signOn` | `backend/src/db.ts` | (none) | `signOn(employeeName: string, locationName: string): PosShift` |
| `stageAPPayment` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `stageAPPayment(input: APPaymentInput): void` |
| `stageARReceipt` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `stageARReceipt(input: ARReceiptInput): void` |
| `stageBomComponent` | `backend/src/db.ts` | (none) | `stageBomComponent(input: {   assemblyItem: string; business: string; componentItem: string; quantity: number; unit: string; }): void` |
| `stageLine` | `backend/src/db-journal.ts` | `backend/src/db-reports.ts`, `backend/src/db-stock.ts`, `backend/src/db.ts`, `backend/src/primitives.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/canned-journal.ts` | `stageLine(line: StagedLine): void` |
| `stageLocation` | `backend/src/db-journal.ts` | (none) | `stageLocation(input: LocationStagingInput): void` |
| `stageOrderDispatch` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `stageOrderDispatch(input: OrderDispatchInput): void` |
| `stageOrderReceipt` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `stageOrderReceipt(input: OrderReceiptInput): void` |
| `stagePurchaseOrder` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `stagePurchaseOrder(input: PurchaseOrderInput): void` |
| `stageQuantityMovementLine` | `backend/src/db-stock.ts` | (none) | `stageQuantityMovementLine(business: BusinessName, ledger: LedgerName, reference: string, account: AccountName, deltaQuantity: number, transdate: string, accountId?: number): void` |
| `stageSalesOrder` | `backend/src/db-journal.ts` | `frontend/src/lib/api.ts` | `stageSalesOrder(input: SalesOrderInput): void` |
| `startRecording` | `backend/src/recording.ts` | `frontend/src/lib/api.ts` | `startRecording(userId: number, username: string): void` |
| `stopRecording` | `backend/src/recording.ts` | `frontend/src/lib/api.ts` | `stopRecording(userId: number): Promise<void>` |
| `supersedeEntity` | `backend/src/db.ts` | `backend/src/auth.ts`, `backend/src/db-journal.ts`, `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/primitives.ts`, `frontend/src/lib/api.ts` | `supersedeEntity(id: number, input: EntityUpdate, userId: UserId): EntityNode` |
| `todayAtLocation` | `backend/src/db-stock.ts` | `backend/src/db.ts` | `todayAtLocation(locationName: LocationName): string` |
| `todayIsoDate` | `frontend/src/lib/format.ts` | (none) | `todayIsoDate(): string` |
| `toTreePaths` | `frontend/src/lib/treeAdapter.ts` | (none) | `toTreePaths(entities: EntityNode[]): TreeItem[]` |
| `transferItems` | `backend/src/db-stock.ts` | `backend/src/db.ts`, `frontend/src/lib/api.ts` | `transferItems(business: BusinessName, ledger: LedgerName, itemName: ItemName, fromLocationName: LocationName, toLocationName: LocationName, quantity: number, reference: string, userId = 1, transdate?: string, combinationShape?: [string, string][], combinationValuesAfterLocation?: string[]): void` |
| `transferLines` | `frontend/src/lib/canned-journal.ts` | (none) | `transferLines(input: {   quantity: number;   fromInventoryAccount: string;   toInventoryAccount: string;   unitCostMinor: number \| null; }): CannedLine[]` |
| `transferStock` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `transferStock(input: TransferStockInput, userId: UserId): void` |
| `unescapeAscii` | `shared-fixtures/csv.ts` | (none) | `unescapeAscii(text: string): string` |
| `unregisterBankAccount` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `unregisterBankAccount(accountName: string, userId: UserId): void` |
| `unsetUserRoleInBusiness` | `backend/src/auth.ts` | `frontend/src/lib/api.ts` | `unsetUserRoleInBusiness(businessName: BusinessName, username: string, roleName: string, userId: UserId): void` |
| `userHasBusinessAdminRole` | `backend/src/auth.ts` | `backend/src/auth-middleware.ts` | `userHasBusinessAdminRole(businessName: BusinessName, username: string): boolean` |
| `verifyCustomer` | `backend/src/db.ts` | `frontend/src/lib/api.ts` | `verifyCustomer(customerName: string, approve: boolean): void` |
| `verifyPassword` | `backend/src/password.ts` | `backend/src/auth.ts`, `backend/src/db.ts` | `verifyPassword(password: string, stored: string): boolean` |
| `verifyPosPin` | `backend/src/db.ts` | (none) | `verifyPosPin(employeeName: string, pin: string): boolean` |
| `writeCsv` | `shared-fixtures/csv.ts` | `shared-fixtures/add-brand-translation.ts`, `shared-fixtures/add-header-translations.ts`, `shared-fixtures/add-journal-remaining-translations.ts`, `shared-fixtures/add-journal-translations.ts`, `shared-fixtures/add-menu-translations.ts` | `writeCsv(rows: Record<string, string>[], headers: string[]): string` |
| `writeOffItems` | `backend/src/db-stock.ts` | `frontend/src/lib/api.ts` | `writeOffItems(business: BusinessName, ledger: LedgerName, reference: string, itemName: ItemName, quantity: number, unitCostMinor: number, writeOffExpenseAccount: AccountName, /** @deprecated See docs/storage-space-as-currency-design.md § 24, D8 (write-off). */   inventoryAccount: string, reason: string, userId: UserId, transdate?: string, locationName?: LocationName, combinationValues?: string[], combinationShape?: [string, string][]): void` |

721 real, indexed names (287 types, 434 functions) across 40 real, core files.
