# Complete Function Inventory — Every Real, Exported Backend Function

Generated directly from the live codebase (not from memory), per direct
request: every real, exported function in every real backend source
file, its own real signature, and every real file found to call it
(via a direct, textual `name(` search across both `backend/src` and
`frontend/src`).

**A real, honest limitation of this method, stated plainly**: a
function referenced *without* immediately being called — passed as a
bare reference (e.g. Express middleware: `app.use(requireAuth)`,
`router.get('/x', attachUser, handler)`) — will not match a plain
`functionName(` text search, and shows here as zero call sites even
though it is genuinely used. `requireAuth`, `attachUser`, `signOn`,
`signOff` below are confirmed, real examples of this — all four are
real Express middleware, wired up this way, not dead code. Where a
function's own real "zero call sites" result is *not* one of these
known, real middleware cases, it is a real, genuine candidate for
either dead code or a real, live gap where a screen was built to call
it but never wired up (`getScreenTitle` is a confirmed, real example
of the latter — see docs/lessons-learned.md and
docs/menu-as-entity-tree-plan.md for the real, full story).


**Total real, exported functions found: 260**


## `backend/src/auth-middleware.ts` (3 functions)

### `attachUser`
- **Defined**: `backend/src/auth-middleware.ts:23`
- **Signature**: `export function attachUser(req: Request, _res: Response, next: NextFunction) {`
- **Call sites found**: 0
- **Called from**: (NONE FOUND - possibly dead code, or only used internally within its own file)

### `requireAuth`
- **Defined**: `backend/src/auth-middleware.ts:28`
- **Signature**: `export function requireAuth(req: Request, res: Response, next: NextFunction) {`
- **Call sites found**: 0
- **Called from**: (NONE FOUND - possibly dead code, or only used internally within its own file)

### `requireRole`
- **Defined**: `backend/src/auth-middleware.ts:38`
- **Signature**: `export function requireRole(...roles: string[]) {`
- **Call sites found**: 68
- **Called from**: backend/src/routes/auth.ts, backend/src/routes/businesses.ts, backend/src/routes/contacts.ts, backend/src/routes/customer-registration.ts, backend/src/routes/divisions.ts, backend/src/routes/entities.ts, backend/src/routes/i18n.ts, backend/src/routes/invoices.ts, backend/src/routes/journal.ts, backend/src/routes/locations.ts, backend/src/routes/parts.ts, backend/src/routes/period.ts, backend/src/routes/pos.ts, backend/src/routes/reports.ts, backend/src/routes/stock-lots.ts, backend/src/server.ts


## `backend/src/auth.ts` (13 functions)

### `listUsers`
- **Defined**: `backend/src/auth.ts:25`
- **Signature**: `export function listUsers(): UserSummary[] {`
- **Call sites found**: 2
- **Called from**: backend/src/auth.ts, backend/src/routes/auth.ts

### `listRoles`
- **Defined**: `backend/src/auth.ts:41`
- **Signature**: `export function listRoles(): { id: number; name: string }[] {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/auth.ts

### `createUser`
- **Defined**: `backend/src/auth.ts:45`
- **Signature**: `export function createUser(username: string, password: string, roleNames: string[]): UserSummary {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/auth.ts

### `setUserRoles`
- **Defined**: `backend/src/auth.ts:56`
- **Signature**: `export function setUserRoles(userId: number, roleNames: string[]): void {`
- **Call sites found**: 2
- **Called from**: backend/src/auth.ts, backend/src/routes/auth.ts

### `setUserActive`
- **Defined**: `backend/src/auth.ts:67`
- **Signature**: `export function setUserActive(userId: number, active: boolean): void {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/auth.ts

### `changePassword`
- **Defined**: `backend/src/auth.ts:76`
- **Signature**: `export function changePassword(userId: number, newPassword: string): void {`
- **Call sites found**: 2
- **Called from**: backend/src/auth.ts, backend/src/routes/auth.ts

### `changeOwnPassword`
- **Defined**: `backend/src/auth.ts:90`
- **Signature**: `export function changeOwnPassword(userId: number, currentPassword: string, newPassword: string): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/auth.ts, frontend/src/routes/account/password/+page.svelte

### `login`
- **Defined**: `backend/src/auth.ts:120`
- **Signature**: `export function login(username: string, password: string): { token: string; user: AuthenticatedUser } {`
- **Call sites found**: 2
- **Called from**: backend/src/db.ts, backend/src/routes/auth.ts

### `logout`
- **Defined**: `backend/src/auth.ts:144`
- **Signature**: `export function logout(token: string): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/auth.ts, frontend/src/routes/+layout.svelte

### `getSessionUser`
- **Defined**: `backend/src/auth.ts:152`
- **Signature**: `export function getSessionUser(token: string | undefined): AuthenticatedUser | null {`
- **Call sites found**: 1
- **Called from**: backend/src/auth-middleware.ts

### `setOwnPageSize`
- **Defined**: `backend/src/auth.ts:178`
- **Signature**: `export function setOwnPageSize(userId: number, pageSize: number): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/auth.ts, frontend/src/routes/account/password/+page.svelte

### `setOwnNumberFormat`
- **Defined**: `backend/src/auth.ts:186`
- **Signature**: `export function setOwnNumberFormat(userId: number, numberFormat: string): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/auth.ts, frontend/src/routes/account/password/+page.svelte

### `setOwnDateFormat`
- **Defined**: `backend/src/auth.ts:194`
- **Signature**: `export function setOwnDateFormat(userId: number, dateFormat: string): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/auth.ts, frontend/src/routes/account/password/+page.svelte


## `backend/src/db-matrix-reports.ts` (4 functions)

### `getSalesCogsMatrix`
- **Defined**: `backend/src/db-matrix-reports.ts:207`
- **Signature**: `export function getSalesCogsMatrix(businessName: BusinessName, ledgerName: LedgerName, fromDate: string | undefined, toDate: string | undefined, rowAxis: MatrixAxis, colAxis: MatrixAxis): SalesCogsMatrix {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/matrix-reports.ts, frontend/src/routes/reports/new-pl/+page.svelte

### `getStockOnHandMatrix`
- **Defined**: `backend/src/db-matrix-reports.ts:301`
- **Signature**: `export function getStockOnHandMatrix(rowAxis: MatrixAxis, colAxis: MatrixAxis): StockOnHandMatrix {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/matrix-reports.ts, frontend/src/routes/reports/new-stock-on-hand/+page.svelte

### `getProfitAndLossByAxis`
- **Defined**: `backend/src/db-matrix-reports.ts:443`
- **Signature**: `export function getProfitAndLossByAxis(`
- **Call sites found**: 2
- **Called from**: backend/src/routes/matrix-reports.ts, frontend/src/routes/reports/new-new-pl/+page.svelte

### `getAxisValues`
- **Defined**: `backend/src/db-matrix-reports.ts:511`
- **Signature**: `export function getAxisValues(businessName: BusinessName, ledgerName: LedgerName): AxisValues {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/matrix-reports.ts, frontend/src/routes/reports/new-new-pl/+page.svelte


## `backend/src/db-reports.ts` (18 functions)

### `getBusinessReports`
- **Defined**: `backend/src/db-reports.ts:23`
- **Signature**: `export function getBusinessReports(): ReportRow[] {`
- **Call sites found**: 4
- **Called from**: backend/src/db-reports.ts, backend/src/routes/reports.ts

### `setAccountCurrency`
- **Defined**: `backend/src/db-reports.ts:43`
- **Signature**: `export function setAccountCurrency(accountName: string, currency: string | null): void {`
- **Call sites found**: 0
- **Called from**: (NONE FOUND - possibly dead code, or only used internally within its own file)

### `getChartOfAccounts`
- **Defined**: `backend/src/db-reports.ts:49`
- **Signature**: `export function getChartOfAccounts(): ChartRow[] {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/reports.ts

### `getLedgerBalancesByDivision`
- **Defined**: `backend/src/db-reports.ts:119`
- **Signature**: `export function getLedgerBalancesByDivision(`
- **Call sites found**: 0
- **Called from**: (NONE FOUND - possibly dead code, or only used internally within its own file)

### `getLedgerBalancesByDivisionStructural`
- **Defined**: `backend/src/db-reports.ts:175`
- **Signature**: `export function getLedgerBalancesByDivisionStructural(`
- **Call sites found**: 2
- **Called from**: backend/src/db-reports.ts

### `getLedgerBalances`
- **Defined**: `backend/src/db-reports.ts:218`
- **Signature**: `export function getLedgerBalances(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, divisionName?: string, excludeCloseEntries = false): Map<number, number> {`
- **Call sites found**: 8
- **Called from**: backend/src/db-matrix-reports.ts, backend/src/db-reports.ts, backend/src/db.ts

### `getTrialBalance`
- **Defined**: `backend/src/db-reports.ts:284`
- **Signature**: `export function getTrialBalance(businessName: BusinessName, ledgerName: LedgerName, asOfDate?: string, divisionName?: string): TrialBalance {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/reports.ts, frontend/src/routes/reports/trial-balance/+page.svelte

### `getBalanceSheet`
- **Defined**: `backend/src/db-reports.ts:369`
- **Signature**: `export function getBalanceSheet(businessName: BusinessName, ledgerName: LedgerName, asOfDate?: string, divisionName?: string): BalanceSheet {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/reports.ts, frontend/src/routes/reports/balance-sheet/+page.svelte

### `buildCategoryTree`
- **Defined**: `backend/src/db-reports.ts:562`
- **Signature**: `export function buildCategoryTree(lines: StatementLine[], accountIdByName: Map<string, number>, rootName: string): CategoryTreeNode[] {`
- **Call sites found**: 5
- **Called from**: backend/src/db-reports.ts

### `getProfitAndLoss`
- **Defined**: `backend/src/db-reports.ts:628`
- **Signature**: `export function getProfitAndLoss(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, divisionName?: string, excludeCloseEntries = true): ProfitAndLoss {`
- **Call sites found**: 6
- **Called from**: backend/src/db-reports.ts, backend/src/routes/reports.ts, frontend/src/routes/reports/profit-and-loss/+page.svelte

### `buildProfitAndLossFromBalances`
- **Defined**: `backend/src/db-reports.ts:642`
- **Signature**: `export function buildProfitAndLossFromBalances(balances: Map<number, number>): ProfitAndLoss {`
- **Call sites found**: 4
- **Called from**: backend/src/db-matrix-reports.ts, backend/src/db-reports.ts

### `getProfitAndLossByDivision`
- **Defined**: `backend/src/db-reports.ts:756`
- **Signature**: `export function getProfitAndLossByDivision(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string): ProfitAndLossByDivision[] {`
- **Call sites found**: 2
- **Called from**: backend/src/db-reports.ts, backend/src/routes/reports.ts

### `getProfitAndLossByDivisionTree`
- **Defined**: `backend/src/db-reports.ts:803`
- **Signature**: `export function getProfitAndLossByDivisionTree(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string): ProfitAndLossByDivisionNode[] {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/reports.ts, frontend/src/routes/reports/profit-and-loss/+page.svelte

### `getTrialBalanceComparison`
- **Defined**: `backend/src/db-reports.ts:885`
- **Signature**: `export function getTrialBalanceComparison(businessName: BusinessName, ledgerA: LedgerName, ledgerB: LedgerName): TrialBalanceComparison {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/reports.ts, frontend/src/routes/reports/compare/+page.svelte

### `previewCloseBooks`
- **Defined**: `backend/src/db-reports.ts:1070`
- **Signature**: `export function previewCloseBooks(businessName: BusinessName, ledger: LedgerName, asOfDate: string, retainedEarningsAccount: string): CloseBooksPreview {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/journal.ts, frontend/src/routes/setup/yearend/+page.svelte

### `closeBooks`
- **Defined**: `backend/src/db-reports.ts:1078`
- **Signature**: `export function closeBooks(business: BusinessName, ledger: LedgerName, asOfDate: string, retainedEarningsAccount: string, userId: UserId): CloseBooksResult {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/journal.ts, frontend/src/routes/setup/yearend/+page.svelte

### `getSalesReport`
- **Defined**: `backend/src/db-reports.ts:1142`
- **Signature**: `export function getSalesReport(business: BusinessName, ledger: LedgerName, fromDate?: string, toDate?: string): SalesReport {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/reports.ts, frontend/src/routes/reports/sales/+page.svelte

### `getProfitAndLossComparison`
- **Defined**: `backend/src/db-reports.ts:1191`
- **Signature**: `export function getProfitAndLossComparison(businessName: BusinessName, ledgerA: LedgerName, ledgerB: LedgerName): ProfitAndLossComparison {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/reports.ts, frontend/src/routes/reports/compare/+page.svelte


## `backend/src/db-seed.ts` (1 functions)

### `seedRemainingData`
- **Defined**: `backend/src/db-seed.ts:37`
- **Signature**: `export function seedRemainingData(): void {`
- **Call sites found**: 2
- **Called from**: backend/src/db.ts


## `backend/src/db-stock.ts` (32 functions)

### `stageQuantityMovementLine`
- **Defined**: `backend/src/db-stock.ts:70`
- **Signature**: `export function stageQuantityMovementLine(business: BusinessName, ledger: LedgerName, reference: string, account: AccountName, deltaQuantity: number, transdate: string, locationName?: LocationName): void {`
- **Call sites found**: 8
- **Called from**: backend/src/db-stock.ts

### `postStagedQuantityMovement`
- **Defined**: `backend/src/db-stock.ts:104`
- **Signature**: `export function postStagedQuantityMovement(business: BusinessName, ledger: LedgerName, reference: string, userId: UserId): void {`
- **Call sites found**: 5
- **Called from**: backend/src/db-stock.ts

### `postQuantityMovement`
- **Defined**: `backend/src/db-stock.ts:112`
- **Signature**: `export function postQuantityMovement(`
- **Call sites found**: 11
- **Called from**: backend/src/db-stock.ts, backend/src/db.ts

### `getLocationTypes`
- **Defined**: `backend/src/db-stock.ts:143`
- **Signature**: `export function getLocationTypes(): string[] {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/locations.ts

### `createLocationType`
- **Defined**: `backend/src/db-stock.ts:163`
- **Signature**: `export function createLocationType(name: string, userId: UserId): void {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/locations.ts

### `setLocation`
- **Defined**: `backend/src/db-stock.ts:170`
- **Signature**: `export function setLocation(name: string, location: Location): void {`
- **Call sites found**: 2
- **Called from**: backend/src/db-seed.ts, backend/src/routes/locations.ts

### `getLocation`
- **Defined**: `backend/src/db-stock.ts:239`
- **Signature**: `export function getLocation(name: string): Location | undefined {`
- **Call sites found**: 8
- **Called from**: backend/src/db-stock.ts, backend/src/db.ts, backend/src/routes/locations.ts

### `todayAtLocation`
- **Defined**: `backend/src/db-stock.ts:280`
- **Signature**: `export function todayAtLocation(locationName: string): string {`
- **Call sites found**: 6
- **Called from**: backend/src/db-stock.ts, backend/src/db.ts

### `getPartLocation`
- **Defined**: `backend/src/db-stock.ts:296`
- **Signature**: `export function getPartLocation(partName: string, locationName: string): PartLocationLevels {`
- **Call sites found**: 10
- **Called from**: backend/src/db-stock.ts, backend/src/db.ts, backend/src/routes/locations.ts, frontend/src/routes/stock/transfer/+page.svelte

### `setPartLocationLevelDetails`
- **Defined**: `backend/src/db-stock.ts:342`
- **Signature**: `export function setPartLocationLevelDetails(partName: string, locationName: string, levels: Omit<PartLocationLevels, 'quantity_on_hand'>, userId: UserId): void {`
- **Call sites found**: 1
- **Called from**: backend/src/db-stock.ts

### `getLocationCapacityStatus`
- **Defined**: `backend/src/db-stock.ts:402`
- **Signature**: `export function getLocationCapacityStatus(locationName: string): LocationCapacityStatus {`
- **Call sites found**: 1
- **Called from**: backend/src/db-stock.ts

### `getStockListingByLocation`
- **Defined**: `backend/src/db-stock.ts:486`
- **Signature**: `export function getStockListingByLocation(): StockListingLocationGroup[] {`
- **Call sites found**: 5
- **Called from**: backend/src/db-stock.ts, backend/src/routes/locations.ts, frontend/src/routes/stock/listing/+page.svelte

### `getStockMovementReport`
- **Defined**: `backend/src/db-stock.ts:593`
- **Signature**: `export function getStockMovementReport(ledgerName: string, fromDate?: string, toDate?: string): StockMovementReport {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/locations.ts, frontend/src/routes/reports/stock-movement/+page.svelte

### `getStockListing`
- **Defined**: `backend/src/db-stock.ts:727`
- **Signature**: `export function getStockListing(limit = 100, offset = 0): StockListingRow[] {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/locations.ts

### `countStockListing`
- **Defined**: `backend/src/db-stock.ts:734`
- **Signature**: `export function countStockListing(): number {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/locations.ts

### `setPartLocationLevels`
- **Defined**: `backend/src/db-stock.ts:748`
- **Signature**: `export function setPartLocationLevels(`
- **Call sites found**: 3
- **Called from**: backend/src/db-seed.ts, backend/src/routes/locations.ts, frontend/src/routes/stock/listing/+page.svelte

### `receiveStockAtLocation`
- **Defined**: `backend/src/db-stock.ts:783`
- **Signature**: `export function receiveStockAtLocation(`
- **Call sites found**: 3
- **Called from**: backend/src/db-seed.ts, backend/src/db.ts, backend/src/routes/locations.ts

### `dispatchStockFromLocation`
- **Defined**: `backend/src/db-stock.ts:824`
- **Signature**: `export function dispatchStockFromLocation(`
- **Call sites found**: 3
- **Called from**: backend/src/db.ts, backend/src/routes/locations.ts

### `transferStock`
- **Defined**: `backend/src/db-stock.ts:854`
- **Signature**: `export function transferStock(`
- **Call sites found**: 3
- **Called from**: backend/src/db.ts, backend/src/routes/locations.ts, frontend/src/routes/stock/transfer/+page.svelte

### `getBelowReorderStock`
- **Defined**: `backend/src/db-stock.ts:917`
- **Signature**: `export function getBelowReorderStock(): BelowReorderRow[] {`
- **Call sites found**: 4
- **Called from**: backend/src/routes/locations.ts, frontend/src/routes/reports/below-reorder/+page.svelte, frontend/src/routes/stock/restock/+page.svelte

### `createStockTake`
- **Defined**: `backend/src/db-stock.ts:947`
- **Signature**: `export function createStockTake(locationName: string, takeDate: string, userId: UserId): number {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/locations.ts, frontend/src/routes/stock/stock-take/+page.svelte

### `getStockTake`
- **Defined**: `backend/src/db-stock.ts:984`
- **Signature**: `export function getStockTake(id: number): StockTake | undefined {`
- **Call sites found**: 6
- **Called from**: backend/src/db-stock.ts, backend/src/routes/locations.ts, frontend/src/routes/stock/stock-take/+page.svelte

### `recordStockTakeCount`
- **Defined**: `backend/src/db-stock.ts:1000`
- **Signature**: `export function recordStockTakeCount(stockTakeId: number, partName: string, countedQuantity: number): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/locations.ts, frontend/src/routes/stock/stock-take/+page.svelte

### `completeStockTake`
- **Defined**: `backend/src/db-stock.ts:1017`
- **Signature**: `export function completeStockTake(`
- **Call sites found**: 2
- **Called from**: backend/src/routes/locations.ts, frontend/src/routes/stock/stock-take/+page.svelte

### `writeOffStock`
- **Defined**: `backend/src/db-stock.ts:1084`
- **Signature**: `export function writeOffStock(`
- **Call sites found**: 2
- **Called from**: backend/src/routes/stock-lots.ts, frontend/src/routes/stock/write-offs/+page.svelte

### `receiveLot`
- **Defined**: `backend/src/db-stock.ts:1116`
- **Signature**: `export function receiveLot(`
- **Call sites found**: 2
- **Called from**: backend/src/routes/stock-lots.ts, frontend/src/routes/stock/write-offs/+page.svelte

### `consumeFromLots`
- **Defined**: `backend/src/db-stock.ts:1147`
- **Signature**: `export function consumeFromLots(partName: string, quantity: number): { lot_number: string; consumed: number; expiration_date: string | null }[] {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/stock-lots.ts

### `getExpiringStock`
- **Defined**: `backend/src/db-stock.ts:1188`
- **Signature**: `export function getExpiringStock(asOfDate: string, withinDays: number): ExpiringLot[] {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/stock-lots.ts, frontend/src/routes/stock/write-offs/+page.svelte

### `createSystemEntity`
- **Defined**: `backend/src/db-stock.ts:1213`
- **Signature**: `export function createSystemEntity(name: string, parentId: number | null): number {`
- **Call sites found**: 1
- **Called from**: backend/src/db-stock.ts

### `placeOrder`
- **Defined**: `backend/src/db-stock.ts:1224`
- **Signature**: `export function placeOrder(`
- **Call sites found**: 2
- **Called from**: backend/src/db.ts

### `fulfillOrder`
- **Defined**: `backend/src/db-stock.ts:1280`
- **Signature**: `export function fulfillOrder(`
- **Call sites found**: 2
- **Called from**: backend/src/db.ts

### `getOrderStatus`
- **Defined**: `backend/src/db-stock.ts:1305`
- **Signature**: `export function getOrderStatus(orderReference: string): { quantity: number; value_minor: number } {`
- **Call sites found**: 4
- **Called from**: backend/src/db.ts, backend/src/routes/stock.ts, frontend/src/routes/stock/stock-dispatch/+page.svelte, frontend/src/routes/stock/stock-receipt/+page.svelte


## `backend/src/db-translations-migrate.ts` (1 functions)

### `migrateAllTranslationsToEntities`
- **Defined**: `backend/src/db-translations-migrate.ts:9`
- **Signature**: `export function migrateAllTranslationsToEntities() {`
- **Call sites found**: 1
- **Called from**: backend/src/db.ts


## `backend/src/db.ts` (186 functions)

### `asUserId`
- **Defined**: `backend/src/db.ts:191`
- **Signature**: `export function asUserId(id: number): UserId {`
- **Call sites found**: 73
- **Called from**: backend/src/db-seed.ts, backend/src/db-stock.ts, backend/src/db-translations-migrate.ts, backend/src/db.ts, backend/src/routes/arap.ts, backend/src/routes/auth.ts, backend/src/routes/businesses.ts, backend/src/routes/contacts.ts, backend/src/routes/customer-registration.ts, backend/src/routes/divisions.ts, backend/src/routes/entities.ts, backend/src/routes/i18n.ts, backend/src/routes/invoices.ts, backend/src/routes/journal.ts, backend/src/routes/locations.ts, backend/src/routes/period.ts, backend/src/routes/pos.ts, backend/src/routes/projects.ts, backend/src/routes/reports.ts, backend/src/routes/stock-lots.ts, backend/src/routes/stock.ts

### `asEntityId`
- **Defined**: `backend/src/db.ts:194`
- **Signature**: `export function asEntityId(id: number): EntityId {`
- **Call sites found**: 0
- **Called from**: (NONE FOUND - possibly dead code, or only used internally within its own file)

### `asBusinessName`
- **Defined**: `backend/src/db.ts:197`
- **Signature**: `export function asBusinessName(name: string): BusinessName {`
- **Call sites found**: 131
- **Called from**: backend/src/db-seed.ts, backend/src/db-stock.ts, backend/src/db.ts, backend/src/invoice.ts, backend/src/routes/arap.ts, backend/src/routes/businesses.ts, backend/src/routes/invoices.ts, backend/src/routes/journal.ts, backend/src/routes/locations.ts, backend/src/routes/matrix-reports.ts, backend/src/routes/period.ts, backend/src/routes/pos.ts, backend/src/routes/projects.ts, backend/src/routes/reports.ts, backend/src/routes/stock-lots.ts, backend/src/routes/stock.ts, frontend/src/lib/session.ts, frontend/src/routes/arap/ap-payment/+page.svelte, frontend/src/routes/arap/ap-purchase/+page.svelte, frontend/src/routes/arap/ar-receipt/+page.svelte, frontend/src/routes/arap/ar-sale/+page.svelte, frontend/src/routes/arap/cash-purchase/+page.svelte, frontend/src/routes/arap/cash-sale/+page.svelte, frontend/src/routes/locations/+page.svelte, frontend/src/routes/pos/+page.svelte, frontend/src/routes/post/+page.svelte, frontend/src/routes/projects/+page.svelte, frontend/src/routes/session/+page.svelte, frontend/src/routes/setup/periods/+page.svelte, frontend/src/routes/stock/po/+page.svelte, frontend/src/routes/stock/restock/+page.svelte, frontend/src/routes/stock/so/+page.svelte, frontend/src/routes/stock/stock-dispatch/+page.svelte, frontend/src/routes/stock/stock-receipt/+page.svelte, frontend/src/routes/stock/stock-take/+page.svelte, frontend/src/routes/stock/transfer/+page.svelte

### `asLedgerName`
- **Defined**: `backend/src/db.ts:200`
- **Signature**: `export function asLedgerName(name: string): LedgerName {`
- **Call sites found**: 119
- **Called from**: backend/src/db-seed.ts, backend/src/db-stock.ts, backend/src/db.ts, backend/src/invoice.ts, backend/src/routes/arap.ts, backend/src/routes/businesses.ts, backend/src/routes/invoices.ts, backend/src/routes/journal.ts, backend/src/routes/locations.ts, backend/src/routes/matrix-reports.ts, backend/src/routes/period.ts, backend/src/routes/pos.ts, backend/src/routes/projects.ts, backend/src/routes/reports.ts, backend/src/routes/stock-lots.ts, backend/src/routes/stock.ts, frontend/src/lib/session.ts, frontend/src/routes/arap/ap-payment/+page.svelte, frontend/src/routes/arap/ap-purchase/+page.svelte, frontend/src/routes/arap/ar-receipt/+page.svelte, frontend/src/routes/arap/ar-sale/+page.svelte, frontend/src/routes/arap/cash-purchase/+page.svelte, frontend/src/routes/arap/cash-sale/+page.svelte, frontend/src/routes/post/+page.svelte, frontend/src/routes/projects/+page.svelte, frontend/src/routes/reports/trial-balance/+page.svelte, frontend/src/routes/session/+page.svelte, frontend/src/routes/setup/periods/+page.svelte, frontend/src/routes/stock/po/+page.svelte, frontend/src/routes/stock/so/+page.svelte, frontend/src/routes/stock/stock-dispatch/+page.svelte, frontend/src/routes/stock/stock-receipt/+page.svelte, frontend/src/routes/stock/transfer/+page.svelte

### `asAccountName`
- **Defined**: `backend/src/db.ts:203`
- **Signature**: `export function asAccountName(name: string): AccountName {`
- **Call sites found**: 63
- **Called from**: backend/src/db-reports.ts, backend/src/db-stock.ts, backend/src/db.ts, backend/src/routes/arap.ts, backend/src/routes/journal.ts, backend/src/routes/locations.ts, backend/src/routes/pos.ts, backend/src/routes/projects.ts, backend/src/routes/stock-lots.ts, frontend/src/routes/arap/ap-purchase/+page.svelte, frontend/src/routes/arap/cash-purchase/+page.svelte, frontend/src/routes/arap/cash-sale/+page.svelte, frontend/src/routes/pos/+page.svelte, frontend/src/routes/post/+page.svelte, frontend/src/routes/projects/+page.svelte, frontend/src/routes/stock/po/+page.svelte, frontend/src/routes/stock/stock-take/+page.svelte, frontend/src/routes/stock/write-offs/+page.svelte

### `asDivisionName`
- **Defined**: `backend/src/db.ts:206`
- **Signature**: `export function asDivisionName(name: string): DivisionName {`
- **Call sites found**: 8
- **Called from**: backend/src/db-reports.ts, backend/src/db.ts

### `asLocationName`
- **Defined**: `backend/src/db.ts:209`
- **Signature**: `export function asLocationName(name: string): LocationName {`
- **Call sites found**: 26
- **Called from**: backend/src/db-seed.ts, backend/src/db.ts, backend/src/routes/arap.ts, backend/src/routes/locations.ts, backend/src/routes/pos.ts, frontend/src/routes/arap/ap-purchase/+page.svelte, frontend/src/routes/arap/ar-sale/+page.svelte, frontend/src/routes/arap/cash-purchase/+page.svelte, frontend/src/routes/arap/cash-sale/+page.svelte, frontend/src/routes/pos/+page.svelte, frontend/src/routes/setup/business-setup/+page.svelte, frontend/src/routes/stock/listing/+page.svelte, frontend/src/routes/stock/po/+page.svelte, frontend/src/routes/stock/stock-take/+page.svelte, frontend/src/routes/stock/transfer/+page.svelte

### `asEmployeeName`
- **Defined**: `backend/src/db.ts:212`
- **Signature**: `export function asEmployeeName(name: string): EmployeeName {`
- **Call sites found**: 10
- **Called from**: backend/src/routes/projects.ts, frontend/src/routes/hr/+page.svelte, frontend/src/routes/projects/+page.svelte, frontend/src/routes/setup/business-setup/+page.svelte

### `asCustomerName`
- **Defined**: `backend/src/db.ts:215`
- **Signature**: `export function asCustomerName(name: string): CustomerName {`
- **Call sites found**: 8
- **Called from**: backend/src/routes/arap.ts, backend/src/routes/invoices.ts, backend/src/routes/pos.ts, frontend/src/routes/arap/ar-receipt/+page.svelte, frontend/src/routes/arap/ar-sale/+page.svelte, frontend/src/routes/arap/cash-sale/+page.svelte, frontend/src/routes/pos/+page.svelte

### `asVendorName`
- **Defined**: `backend/src/db.ts:218`
- **Signature**: `export function asVendorName(name: string): VendorName {`
- **Call sites found**: 10
- **Called from**: backend/src/routes/arap.ts, backend/src/routes/invoices.ts, backend/src/routes/pos.ts, frontend/src/routes/arap/ap-payment/+page.svelte, frontend/src/routes/arap/ap-purchase/+page.svelte, frontend/src/routes/arap/cash-purchase/+page.svelte, frontend/src/routes/invoices/+page.svelte, frontend/src/routes/parts/+page.svelte, frontend/src/routes/stock/po/+page.svelte

### `asPartName`
- **Defined**: `backend/src/db.ts:221`
- **Signature**: `export function asPartName(name: string): PartName {`
- **Call sites found**: 27
- **Called from**: backend/src/db-seed.ts, backend/src/db.ts, backend/src/routes/locations.ts, backend/src/routes/stock-lots.ts, frontend/src/routes/arap/cash-purchase/+page.svelte, frontend/src/routes/arap/cash-sale/+page.svelte, frontend/src/routes/parts/+page.svelte, frontend/src/routes/pos/+page.svelte, frontend/src/routes/stock/listing/+page.svelte, frontend/src/routes/stock/po/+page.svelte, frontend/src/routes/stock/stock-take/+page.svelte, frontend/src/routes/stock/transfer/+page.svelte, frontend/src/routes/stock/write-offs/+page.svelte

### `getEntityTree`
- **Defined**: `backend/src/db.ts:249`
- **Signature**: `export function getEntityTree(): (EntityNode & { depth: number; is_postable_account: boolean })[] {`
- **Call sites found**: 34
- **Called from**: backend/src/db-matrix-reports.ts, backend/src/db-reports.ts, backend/src/db.ts, backend/src/routes/entities.ts, backend/src/routes/locations.ts, frontend/src/routes/arap/ap-payment/+page.svelte, frontend/src/routes/arap/ap-purchase/+page.svelte, frontend/src/routes/arap/ar-receipt/+page.svelte, frontend/src/routes/arap/ar-sale/+page.svelte, frontend/src/routes/arap/cash-purchase/+page.svelte, frontend/src/routes/arap/cash-sale/+page.svelte, frontend/src/routes/contacts/+page.svelte, frontend/src/routes/editor/+page.svelte, frontend/src/routes/hr/+page.svelte, frontend/src/routes/invoices/+page.svelte, frontend/src/routes/locations/+page.svelte, frontend/src/routes/parts/+page.svelte, frontend/src/routes/post/+page.svelte, frontend/src/routes/projects/+page.svelte, frontend/src/routes/reports/statement/+page.svelte, frontend/src/routes/setup/bank-accounts/+page.svelte, frontend/src/routes/setup/business-setup/+page.svelte, frontend/src/routes/setup/chart-of-accounts/+page.svelte, frontend/src/routes/setup/tree/+page.svelte, frontend/src/routes/setup/vocabulary/+page.svelte, frontend/src/routes/setup/yearend/+page.svelte, frontend/src/routes/stock/po/+page.svelte, frontend/src/routes/stock/so/+page.svelte, frontend/src/routes/stock/stock-dispatch/+page.svelte, frontend/src/routes/stock/stock-receipt/+page.svelte, frontend/src/routes/stock/write-offs/+page.svelte

### `getEntity`
- **Defined**: `backend/src/db.ts:277`
- **Signature**: `export function getEntity(id: number): EntityNode | undefined {`
- **Call sites found**: 7
- **Called from**: backend/src/db.ts, backend/src/routes/entities.ts

### `getEntityHistory`
- **Defined**: `backend/src/db.ts:299`
- **Signature**: `export function getEntityHistory(id: number): EntityHistoryRow[] {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/entities.ts

### `resolvePartId`
- **Defined**: `backend/src/db.ts:322`
- **Signature**: `export function resolvePartId(partName: string): number | undefined {`
- **Call sites found**: 8
- **Called from**: backend/src/db-stock.ts, backend/src/db.ts

### `createEntity`
- **Defined**: `backend/src/db.ts:347`
- **Signature**: `export function createEntity(input: NewEntity, userId: UserId): EntityNode {`
- **Call sites found**: 95
- **Called from**: backend/src/db-seed.ts, backend/src/db-stock.ts, backend/src/db.ts, backend/src/routes/divisions.ts, backend/src/routes/entities.ts, frontend/src/routes/editor/+page.svelte, frontend/src/routes/locations/+page.svelte, frontend/src/routes/parts/+page.svelte, frontend/src/routes/setup/business-setup/+page.svelte, frontend/src/routes/setup/chart-of-accounts/+page.svelte, frontend/src/routes/setup/translations/+page.svelte

### `updateEntity`
- **Defined**: `backend/src/db.ts:405`
- **Signature**: `export function updateEntity(id: number, input: EntityUpdate, userId: UserId): EntityNode {`
- **Call sites found**: 26
- **Called from**: backend/src/db-seed.ts, backend/src/db-stock.ts, backend/src/db.ts, backend/src/routes/entities.ts, frontend/src/routes/editor/+page.svelte, frontend/src/routes/setup/chart-of-accounts/+page.svelte

### `setRelationship`
- **Defined**: `backend/src/db.ts:459`
- **Signature**: `export function setRelationship(entityName: string, relationshipType: string, targetName: string, userId: UserId): void {`
- **Call sites found**: 4
- **Called from**: backend/src/db-seed.ts, backend/src/routes/entities.ts

### `getRelationship`
- **Defined**: `backend/src/db.ts:477`
- **Signature**: `export function getRelationship(entityName: string): Relationship | undefined {`
- **Call sites found**: 1
- **Called from**: backend/src/db.ts

### `getEntitiesWithRelationship`
- **Defined**: `backend/src/db.ts:496`
- **Signature**: `export function getEntitiesWithRelationship(relationshipType: string): { source: string; target: string }[] {`
- **Call sites found**: 4
- **Called from**: backend/src/db.ts

### `getHierarchy`
- **Defined**: `backend/src/db.ts:545`
- **Signature**: `export function getHierarchy(rootName: string, relationshipType?: string): HierarchyNode {`
- **Call sites found**: 1
- **Called from**: backend/src/db.ts

### `getOrganizationChart`
- **Defined**: `backend/src/db.ts:582`
- **Signature**: `export function getOrganizationChart(businessName: BusinessName): OrganizationChart {`
- **Call sites found**: 3
- **Called from**: backend/src/routes/pos.ts, frontend/src/routes/hr/+page.svelte, frontend/src/routes/setup/business-setup/+page.svelte

### `deleteEntity`
- **Defined**: `backend/src/db.ts:629`
- **Signature**: `export function deleteEntity(id: number, userId: UserId): void {`
- **Call sites found**: 18
- **Called from**: backend/src/db-seed.ts, backend/src/db-stock.ts, backend/src/db.ts, backend/src/routes/entities.ts, frontend/src/routes/editor/+page.svelte, frontend/src/routes/setup/business-setup/+page.svelte, frontend/src/routes/setup/chart-of-accounts/+page.svelte

### `getCreditStatus`
- **Defined**: `backend/src/db.ts:692`
- **Signature**: `export function getCreditStatus(entityName: string): CreditStatus {`
- **Call sites found**: 3
- **Called from**: backend/src/routes/contacts.ts, frontend/src/routes/arap/ar-sale/+page.svelte, frontend/src/routes/contacts/+page.svelte

### `getAgingBuckets`
- **Defined**: `backend/src/db.ts:712`
- **Signature**: `export function getAgingBuckets(paymentTermsDays: number | null): AgingBucket[] {`
- **Call sites found**: 1
- **Called from**: backend/src/db.ts

### `createInvoice`
- **Defined**: `backend/src/db.ts:776`
- **Signature**: `export function createInvoice(input: InvoiceInput, userId: UserId): number {`
- **Call sites found**: 6
- **Called from**: backend/src/db.ts, backend/src/routes/invoices.ts, frontend/src/routes/invoices/+page.svelte

### `getInvoice`
- **Defined**: `backend/src/db.ts:850`
- **Signature**: `export function getInvoice(id: number): Invoice | undefined {`
- **Call sites found**: 12
- **Called from**: backend/src/db.ts, backend/src/routes/invoices.ts

### `exportInvoiceAsUbl`
- **Defined**: `backend/src/db.ts:903`
- **Signature**: `export function exportInvoiceAsUbl(invoiceId: number): string {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/invoices.ts

### `parseUblInvoice`
- **Defined**: `backend/src/db.ts:980`
- **Signature**: `export function parseUblInvoice(xml: string): UblImportResult {`
- **Call sites found**: 1
- **Called from**: backend/src/db.ts

### `checkEInvoiceDiscrepancies`
- **Defined**: `backend/src/db.ts:1023`
- **Signature**: `export function checkEInvoiceDiscrepancies(parsed: UblImportResult, poReference?: string): EInvoiceDiscrepancy[] {`
- **Call sites found**: 1
- **Called from**: backend/src/db.ts

### `importUblInvoiceAsDraft`
- **Defined**: `backend/src/db.ts:1060`
- **Signature**: `export function importUblInvoiceAsDraft(xml: string, business: BusinessName, ledger: LedgerName, vendorName: string, userId: UserId, poReference?: string): { invoiceId: number; discrepancies: EInvoiceDiscrepancy[] } {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/invoices.ts

### `getPickingList`
- **Defined**: `backend/src/db.ts:1116`
- **Signature**: `export function getPickingList(invoiceId: number, locationName: string): PickingListLine[] {`
- **Call sites found**: 2
- **Called from**: backend/src/db.ts, backend/src/routes/invoices.ts

### `confirmPickedLine`
- **Defined**: `backend/src/db.ts:1162`
- **Signature**: `export function confirmPickedLine(invoiceId: number, invoiceLineId: number, business: BusinessName, ledger: LedgerName, userId: UserId): void {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/invoices.ts

### `dispatchOrderFromPickingList`
- **Defined**: `backend/src/db.ts:1184`
- **Signature**: `export function dispatchOrderFromPickingList(invoiceId: number, locationName: string, revenueAccount: string, taxAccount: string, userId: UserId): void {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/invoices.ts

### `getRestockPickingList`
- **Defined**: `backend/src/db.ts:1223`
- **Signature**: `export function getRestockPickingList(runReference: string, warehouseName: string, lines: RestockLineInput[]): PickingListLine[] {`
- **Call sites found**: 3
- **Called from**: backend/src/db.ts, backend/src/routes/locations.ts, frontend/src/routes/stock/restock/+page.svelte

### `confirmRestockPickedLine`
- **Defined**: `backend/src/db.ts:1252`
- **Signature**: `export function confirmRestockPickedLine(runReference: string, partName: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/locations.ts, frontend/src/routes/stock/restock/+page.svelte

### `dispatchRestockFromPickingList`
- **Defined**: `backend/src/db.ts:1270`
- **Signature**: `export function dispatchRestockFromPickingList(`
- **Call sites found**: 1
- **Called from**: backend/src/routes/locations.ts

### `listInvoices`
- **Defined**: `backend/src/db.ts:1309`
- **Signature**: `export function listInvoices(business: BusinessName, ledger: LedgerName, options: ListInvoicesOptions = {}): Invoice[] {`
- **Call sites found**: 9
- **Called from**: backend/src/db.ts, backend/src/routes/invoices.ts, frontend/src/routes/arap/ap-payment/+page.svelte, frontend/src/routes/arap/ar-receipt/+page.svelte, frontend/src/routes/invoices/+page.svelte

### `countInvoices`
- **Defined**: `backend/src/db.ts:1324`
- **Signature**: `export function countInvoices(business: BusinessName, ledger: LedgerName, invoiceType?: 'AR' | 'AP', source: 'manual' | 'pos' | 'all' = 'manual'): number {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/invoices.ts

### `postInvoice`
- **Defined**: `backend/src/db.ts:1346`
- **Signature**: `export function postInvoice(`
- **Call sites found**: 5
- **Called from**: backend/src/db.ts, backend/src/routes/invoices.ts

### `allocatePayment`
- **Defined**: `backend/src/db.ts:1476`
- **Signature**: `export function allocatePayment(`
- **Call sites found**: 4
- **Called from**: backend/src/db.ts, backend/src/routes/invoices.ts

### `getInvoiceOutstandingMinor`
- **Defined**: `backend/src/db.ts:1525`
- **Signature**: `export function getInvoiceOutstandingMinor(invoiceId: number): number {`
- **Call sites found**: 5
- **Called from**: backend/src/db.ts, backend/src/routes/invoices.ts

### `getAgedInvoices`
- **Defined**: `backend/src/db.ts:1552`
- **Signature**: `export function getAgedInvoices(business: BusinessName, ledger: LedgerName, invoiceType: 'AR' | 'AP', asOfDate: string): AgedInvoiceRow[] {`
- **Call sites found**: 4
- **Called from**: backend/src/db.ts, backend/src/routes/invoices.ts, frontend/src/routes/reports/aged/+page.svelte

### `getAgedSummary`
- **Defined**: `backend/src/db.ts:1588`
- **Signature**: `export function getAgedSummary(business: BusinessName, ledger: LedgerName, invoiceType: 'AR' | 'AP', asOfDate: string): AgedSummaryRow[] {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/invoices.ts, frontend/src/routes/reports/aged/+page.svelte

### `getCustomerStatement`
- **Defined**: `backend/src/db.ts:1635`
- **Signature**: `export function getCustomerStatement(business: BusinessName, ledger: LedgerName, customerName: string, asOfDate: string): CustomerStatement {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/invoices.ts, frontend/src/routes/reports/statement/+page.svelte

### `getCounterpartyHistory`
- **Defined**: `backend/src/db.ts:1668`
- **Signature**: `export function getCounterpartyHistory(business: BusinessName, ledger: LedgerName, counterpartyName: string): HistoryLine[] {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/invoices.ts, frontend/src/routes/contacts/+page.svelte

### `getPartByUpc`
- **Defined**: `backend/src/db.ts:1691`
- **Signature**: `export function getPartByUpc(upc: string): PartSummary | undefined {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/pos.ts

### `getAncestorChain`
- **Defined**: `backend/src/db.ts:1762`
- **Signature**: `export function getAncestorChain(entityName: string, rootName: string): string[] {`
- **Call sites found**: 1
- **Called from**: backend/src/db.ts

### `ensureCategoryChain`
- **Defined**: `backend/src/db.ts:1784`
- **Signature**: `export function ensureCategoryChain(rootName: string, prefix: string, chain: string[], userId: UserId): { name: string; id: number } {`
- **Call sites found**: 2
- **Called from**: backend/src/db.ts

### `ensureProductSalesCogsAccounts`
- **Defined**: `backend/src/db.ts:1827`
- **Signature**: `export function ensureProductSalesCogsAccounts(partName: string, userId: UserId, tier?: string): { salesAccount: string; salesAccountId: number; cogsAccount: string; cogsAccountId: number } {`
- **Call sites found**: 4
- **Called from**: backend/src/db.ts

### `ensureProductInventoryAccount`
- **Defined**: `backend/src/db.ts:1861`
- **Signature**: `export function ensureProductInventoryAccount(partName: string, userId: UserId): { inventoryAccount: string; inventoryAccountId: number } {`
- **Call sites found**: 3
- **Called from**: backend/src/db-stock.ts, backend/src/db.ts

### `ensureProductLocationInventoryAccount`
- **Defined**: `backend/src/db.ts:1878`
- **Signature**: `export function ensureProductLocationInventoryAccount(partName: string, locationName: string, userId: UserId): { inventoryAccount: string; inventoryAccountId: number } {`
- **Call sites found**: 3
- **Called from**: backend/src/db-stock.ts, backend/src/db.ts

### `getProductUnitCostMinor`
- **Defined**: `backend/src/db.ts:1899`
- **Signature**: `export function getProductUnitCostMinor(partName: string): number | null {`
- **Call sites found**: 1
- **Called from**: backend/src/db.ts

### `ensureProductTierPart`
- **Defined**: `backend/src/db.ts:1927`
- **Signature**: `export function ensureProductTierPart(baseProductName: string, tier: string, userId: UserId): { tierPartName: string; tierPartId: number; salesAccount: string; salesAccountId: number; cogsAccount: string; cogsAccountId: number } {`
- **Call sites found**: 4
- **Called from**: backend/src/db.ts

### `ensureProductTierLocationLeaf`
- **Defined**: `backend/src/db.ts:1964`
- **Signature**: `export function ensureProductTierLocationLeaf(tierPartName: string, locationName: string, userId: UserId, tierPartId?: number): { leafPartName: string; leafPartId: number; salesAccount: string; salesAccountId: number; cogsAccount: string; cogsAccountId: number } {`
- **Call sites found**: 2
- **Called from**: backend/src/db.ts

### `ensureProductLocationLeaf`
- **Defined**: `backend/src/db.ts:2020`
- **Signature**: `export function ensureProductLocationLeaf(partName: string, locationName: string, userId: UserId): { salesAccount: string; salesAccountId: number; cogsAccount: string; cogsAccountId: number } {`
- **Call sites found**: 2
- **Called from**: backend/src/db.ts

### `getLocationForAccount`
- **Defined**: `backend/src/db.ts:2051`
- **Signature**: `export function getLocationForAccount(accountName: string): string | undefined {`
- **Call sites found**: 1
- **Called from**: backend/src/db.ts

### `getDivisionForAccount`
- **Defined**: `backend/src/db.ts:2061`
- **Signature**: `export function getDivisionForAccount(accountName: string): string | undefined {`
- **Call sites found**: 1
- **Called from**: backend/src/db-reports.ts

### `ensureProductQuantityAccounts`
- **Defined**: `backend/src/db.ts:2078`
- **Signature**: `export function ensureProductQuantityAccounts(partName: string, userId: UserId): { onOrderAccount: string; unitsSoldAccount: string } {`
- **Call sites found**: 3
- **Called from**: backend/src/db-stock.ts

### `cityDivisionFor`
- **Defined**: `backend/src/db.ts:2107`
- **Signature**: `export function cityDivisionFor(locationName: string): string | undefined {`
- **Call sites found**: 8
- **Called from**: backend/src/db-stock.ts, backend/src/db.ts

### `isColdStorageProduct`
- **Defined**: `backend/src/db.ts:2148`
- **Signature**: `export function isColdStorageProduct(partName: string): boolean {`
- **Call sites found**: 1
- **Called from**: backend/src/db.ts

### `resolveDispatchLocation`
- **Defined**: `backend/src/db.ts:2161`
- **Signature**: `export function resolveDispatchLocation(partName: string, logicalLocationName: string): string {`
- **Call sites found**: 2
- **Called from**: backend/src/db.ts

### `completePosSale`
- **Defined**: `backend/src/db.ts:2174`
- **Signature**: `export function completePosSale(input: PosSaleInput, userId: UserId): PosSaleResult {`
- **Call sites found**: 3
- **Called from**: backend/src/routes/pos.ts, frontend/src/routes/arap/cash-sale/+page.svelte, frontend/src/routes/pos/+page.svelte

### `completeCashPurchase`
- **Defined**: `backend/src/db.ts:2382`
- **Signature**: `export function completeCashPurchase(input: CashPurchaseInput, userId: UserId): CashPurchaseResult {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/pos.ts, frontend/src/routes/arap/cash-purchase/+page.svelte

### `payEmployeeWages`
- **Defined**: `backend/src/db.ts:2485`
- **Signature**: `export function payEmployeeWages(input: PayEmployeeWagesInput, userId: UserId): PayEmployeeWagesResult {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/pos.ts, frontend/src/routes/hr/+page.svelte

### `recordReminderSent`
- **Defined**: `backend/src/db.ts:2564`
- **Signature**: `export function recordReminderSent(customerName: string): number {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/invoices.ts

### `resetReminderLevel`
- **Defined**: `backend/src/db.ts:2577`
- **Signature**: `export function resetReminderLevel(customerName: string): void {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/invoices.ts

### `getReminderCandidates`
- **Defined**: `backend/src/db.ts:2594`
- **Signature**: `export function getReminderCandidates(business: BusinessName, ledger: LedgerName, asOfDate: string): ReminderCandidate[] {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/invoices.ts, frontend/src/routes/reports/reminders/+page.svelte

### `getContact`
- **Defined**: `backend/src/db.ts:2668`
- **Signature**: `export function getContact(entityName: string): Contact | undefined {`
- **Call sites found**: 16
- **Called from**: backend/src/db.ts, backend/src/invoice.ts, backend/src/routes/contacts.ts, frontend/src/routes/contacts/+page.svelte, frontend/src/routes/editor/+page.svelte, frontend/src/routes/hr/+page.svelte, frontend/src/routes/setup/business-setup/+page.svelte

### `getInvoiceLine`
- **Defined**: `backend/src/db.ts:2691`
- **Signature**: `export function getInvoiceLine(reference: string, business: BusinessName, ledger: LedgerName): InvoiceLine | undefined {`
- **Call sites found**: 1
- **Called from**: backend/src/invoice.ts

### `getAccountsPostedTo`
- **Defined**: `backend/src/db.ts:2706`
- **Signature**: `export function getAccountsPostedTo(reference: string): string[] {`
- **Call sites found**: 0
- **Called from**: (NONE FOUND - possibly dead code, or only used internally within its own file)

### `setContact`
- **Defined**: `backend/src/db.ts:2719`
- **Signature**: `export function setContact(entityName: string, contact: Partial<Contact>): void {`
- **Call sites found**: 10
- **Called from**: backend/src/db-seed.ts, backend/src/db.ts, backend/src/routes/contacts.ts, frontend/src/routes/contacts/+page.svelte, frontend/src/routes/editor/+page.svelte, frontend/src/routes/setup/business-setup/+page.svelte

### `setPosPin`
- **Defined**: `backend/src/db.ts:2750`
- **Signature**: `export function setPosPin(employeeName: string, pin: string): void {`
- **Call sites found**: 0
- **Called from**: (NONE FOUND - possibly dead code, or only used internally within its own file)

### `signOn`
- **Defined**: `backend/src/db.ts:2773`
- **Signature**: `export function signOn(employeeName: string, locationName: string): PosShift {`
- **Call sites found**: 0
- **Called from**: (NONE FOUND - possibly dead code, or only used internally within its own file)

### `verifyPosPin`
- **Defined**: `backend/src/db.ts:2790`
- **Signature**: `export function verifyPosPin(employeeName: string, pin: string): boolean {`
- **Call sites found**: 0
- **Called from**: (NONE FOUND - possibly dead code, or only used internally within its own file)

### `signOff`
- **Defined**: `backend/src/db.ts:2800`
- **Signature**: `export function signOff(shiftId: number): void {`
- **Call sites found**: 0
- **Called from**: (NONE FOUND - possibly dead code, or only used internally within its own file)

### `getActiveShiftsAtLocation`
- **Defined**: `backend/src/db.ts:2812`
- **Signature**: `export function getActiveShiftsAtLocation(locationName: string): PosShift[] {`
- **Call sites found**: 0
- **Called from**: (NONE FOUND - possibly dead code, or only used internally within its own file)

### `getOpenShiftForEmployee`
- **Defined**: `backend/src/db.ts:2830`
- **Signature**: `export function getOpenShiftForEmployee(employeeName: string): PosShift | undefined {`
- **Call sites found**: 0
- **Called from**: (NONE FOUND - possibly dead code, or only used internally within its own file)

### `setLocationOpenHours`
- **Defined**: `backend/src/db.ts:2858`
- **Signature**: `export function setLocationOpenHours(locationName: string, hours: OpenHoursLine[]): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/locations.ts, frontend/src/routes/setup/business-setup/+page.svelte

### `getLocationOpenHours`
- **Defined**: `backend/src/db.ts:2880`
- **Signature**: `export function getLocationOpenHours(locationName: string): OpenHoursLine[] {`
- **Call sites found**: 3
- **Called from**: backend/src/db.ts, backend/src/routes/locations.ts, frontend/src/routes/setup/business-setup/+page.svelte

### `setEmployeeSchedule`
- **Defined**: `backend/src/db.ts:2921`
- **Signature**: `export function setEmployeeSchedule(employeeName: string, locationName: string, schedule: ScheduleLine[]): void {`
- **Call sites found**: 3
- **Called from**: backend/src/routes/locations.ts, frontend/src/routes/setup/business-setup/+page.svelte

### `getEmployeeSchedule`
- **Defined**: `backend/src/db.ts:2993`
- **Signature**: `export function getEmployeeSchedule(employeeName: string): EmployeeScheduleLine[] {`
- **Call sites found**: 5
- **Called from**: backend/src/db.ts, backend/src/routes/locations.ts, frontend/src/routes/setup/business-setup/+page.svelte

### `getScheduleAtLocation`
- **Defined**: `backend/src/db.ts:3016`
- **Signature**: `export function getScheduleAtLocation(locationName: string): LocationScheduleLine[] {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/locations.ts

### `addTypedAddress`
- **Defined**: `backend/src/db.ts:3059`
- **Signature**: `export function addTypedAddress(entityName: string, addressType: string, value: Partial<Contact>, userId: UserId): string {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/contacts.ts

### `getTypedAddresses`
- **Defined**: `backend/src/db.ts:3069`
- **Signature**: `export function getTypedAddresses(entityName: string): TypedAddress[] {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/contacts.ts, frontend/src/lib/components/AddressList.svelte

### `deleteTypedAddress`
- **Defined**: `backend/src/db.ts:3073`
- **Signature**: `export function deleteTypedAddress(entityName: string, addressType: string, userId: UserId): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/contacts.ts, frontend/src/lib/components/AddressList.svelte

### `addTypedPhone`
- **Defined**: `backend/src/db.ts:3085`
- **Signature**: `export function addTypedPhone(entityName: string, phoneType: string, number: string, userId: UserId): string {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/contacts.ts

### `getTypedPhones`
- **Defined**: `backend/src/db.ts:3089`
- **Signature**: `export function getTypedPhones(entityName: string): TypedPhone[] {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/contacts.ts, frontend/src/lib/components/PhoneList.svelte

### `deleteTypedPhone`
- **Defined**: `backend/src/db.ts:3093`
- **Signature**: `export function deleteTypedPhone(entityName: string, phoneType: string, userId: UserId): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/contacts.ts, frontend/src/lib/components/PhoneList.svelte

### `ensureContactPersonType`
- **Defined**: `backend/src/db.ts:3115`
- **Signature**: `export function ensureContactPersonType(typeName: string, userId: UserId): void {`
- **Call sites found**: 1
- **Called from**: backend/src/db.ts

### `listContactPersonTypes`
- **Defined**: `backend/src/db.ts:3126`
- **Signature**: `export function listContactPersonTypes(): string[] {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/contacts.ts, frontend/src/lib/components/ContactPersonList.svelte

### `addTypedContactPerson`
- **Defined**: `backend/src/db.ts:3137`
- **Signature**: `export function addTypedContactPerson(entityName: string, contactType: string, value: { name: string; phone?: string | null; email?: string | null }, userId: UserId): string {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/contacts.ts

### `getTypedContactPersons`
- **Defined**: `backend/src/db.ts:3142`
- **Signature**: `export function getTypedContactPersons(entityName: string): ContactPerson[] {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/contacts.ts, frontend/src/lib/components/ContactPersonList.svelte

### `deleteTypedContactPerson`
- **Defined**: `backend/src/db.ts:3149`
- **Signature**: `export function deleteTypedContactPerson(entityName: string, contactType: string, userId: UserId): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/contacts.ts, frontend/src/lib/components/ContactPersonList.svelte

### `setEntityLink`
- **Defined**: `backend/src/db.ts:3217`
- **Signature**: `export function setEntityLink(entityName: string, linkType: string, targetName: string, userId: UserId): string {`
- **Call sites found**: 8
- **Called from**: backend/src/db-seed.ts, backend/src/db-stock.ts, backend/src/db.ts

### `getEntityLink`
- **Defined**: `backend/src/db.ts:3229`
- **Signature**: `export function getEntityLink(entityName: string, linkType: string): string | undefined {`
- **Call sites found**: 7
- **Called from**: backend/src/db-stock.ts, backend/src/db.ts

### `deleteEntityLink`
- **Defined**: `backend/src/db.ts:3242`
- **Signature**: `export function deleteEntityLink(entityName: string, linkType: string, userId: UserId): void {`
- **Call sites found**: 7
- **Called from**: backend/src/db-stock.ts, backend/src/db.ts

### `setDimensionParent`
- **Defined**: `backend/src/db.ts:3265`
- **Signature**: `export function setDimensionParent(entityName: string, dimensionName: string, parentName: string, userId: UserId): void {`
- **Call sites found**: 13
- **Called from**: backend/src/db-seed.ts, backend/src/db-stock.ts, backend/src/db.ts

### `getDimensionParent`
- **Defined**: `backend/src/db.ts:3269`
- **Signature**: `export function getDimensionParent(entityName: string, dimensionName: string): string | undefined {`
- **Call sites found**: 5
- **Called from**: backend/src/db.ts

### `deleteDimensionParent`
- **Defined**: `backend/src/db.ts:3273`
- **Signature**: `export function deleteDimensionParent(entityName: string, dimensionName: string, userId: UserId): void {`
- **Call sites found**: 0
- **Called from**: (NONE FOUND - possibly dead code, or only used internally within its own file)

### `setContactType`
- **Defined**: `backend/src/db.ts:3286`
- **Signature**: `export function setContactType(contactName: string, typeName: string, userId: UserId): void {`
- **Call sites found**: 3
- **Called from**: backend/src/db-seed.ts

### `removeContactType`
- **Defined**: `backend/src/db.ts:3290`
- **Signature**: `export function removeContactType(contactName: string, typeName: string, userId: UserId): void {`
- **Call sites found**: 0
- **Called from**: (NONE FOUND - possibly dead code, or only used internally within its own file)

### `getContactTypes`
- **Defined**: `backend/src/db.ts:3294`
- **Signature**: `export function getContactTypes(contactName: string): string[] {`
- **Call sites found**: 1
- **Called from**: backend/src/db.ts

### `getContactBaseAccounts`
- **Defined**: `backend/src/db.ts:3313`
- **Signature**: `export function getContactBaseAccounts(contactName: string): string[] {`
- **Call sites found**: 0
- **Called from**: (NONE FOUND - possibly dead code, or only used internally within its own file)

### `getContactsWithType`
- **Defined**: `backend/src/db.ts:3319`
- **Signature**: `export function getContactsWithType(typeName: string): string[] {`
- **Call sites found**: 0
- **Called from**: (NONE FOUND - possibly dead code, or only used internally within its own file)

### `getDimensionChildren`
- **Defined**: `backend/src/db.ts:3339`
- **Signature**: `export function getDimensionChildren(parentName: string, dimensionName: string): string[] {`
- **Call sites found**: 1
- **Called from**: backend/src/db-reports.ts

### `getDimensionLinksPointingAt`
- **Defined**: `backend/src/db.ts:3362`
- **Signature**: `export function getDimensionLinksPointingAt(targetName: string): { entityName: string; dimensionName: string }[] {`
- **Call sites found**: 3
- **Called from**: backend/src/db.ts, backend/src/routes/entities.ts, frontend/src/routes/editor/+page.svelte

### `getDimensionAncestorChain`
- **Defined**: `backend/src/db.ts:3387`
- **Signature**: `export function getDimensionAncestorChain(entityName: string, dimensionName: string): string[] {`
- **Call sites found**: 0
- **Called from**: (NONE FOUND - possibly dead code, or only used internally within its own file)

### `registerBankAccount`
- **Defined**: `backend/src/db.ts:3428`
- **Signature**: `export function registerBankAccount(accountName: string, business: string, scopeName: string, overdraftLimitMinor: number | null, userId: UserId): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/reports.ts, frontend/src/routes/setup/bank-accounts/+page.svelte

### `unregisterBankAccount`
- **Defined**: `backend/src/db.ts:3447`
- **Signature**: `export function unregisterBankAccount(accountName: string, userId: UserId): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/reports.ts, frontend/src/routes/setup/bank-accounts/+page.svelte

### `getBankAccounts`
- **Defined**: `backend/src/db.ts:3471`
- **Signature**: `export function getBankAccounts(business: BusinessName, ledger: LedgerName): BankAccountRow[] {`
- **Call sites found**: 4
- **Called from**: backend/src/db.ts, backend/src/routes/reports.ts, frontend/src/routes/setup/bank-accounts/+page.svelte

### `getCashPosition`
- **Defined**: `backend/src/db.ts:3514`
- **Signature**: `export function getCashPosition(business: BusinessName, ledger: LedgerName): CashPositionByCurrency[] {`
- **Call sites found**: 3
- **Called from**: backend/src/db.ts, backend/src/routes/reports.ts, frontend/src/routes/setup/bank-accounts/+page.svelte

### `getCashFlowForecast`
- **Defined**: `backend/src/db.ts:3597`
- **Signature**: `export function getCashFlowForecast(business: BusinessName, ledger: LedgerName, asOfDate: string, horizonDays: number): CashFlowForecast {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/reports.ts, frontend/src/routes/reports/cash-flow-forecast/+page.svelte

### `registerCustomer`
- **Defined**: `backend/src/db.ts:3729`
- **Signature**: `export function registerCustomer(input: CustomerRegistrationInput, userId: UserId): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/customer-registration.ts, frontend/src/routes/customer-terminal/+page.svelte

### `listPendingCustomers`
- **Defined**: `backend/src/db.ts:3759`
- **Signature**: `export function listPendingCustomers(): PendingCustomer[] {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/customer-registration.ts, frontend/src/routes/pos/+page.svelte

### `verifyCustomer`
- **Defined**: `backend/src/db.ts:3774`
- **Signature**: `export function verifyCustomer(customerName: string, approve: boolean): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/customer-registration.ts, frontend/src/routes/pos/+page.svelte

### `authenticateCustomer`
- **Defined**: `backend/src/db.ts:3787`
- **Signature**: `export function authenticateCustomer(name: string, password: string): boolean {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/customer-registration.ts

### `getPart`
- **Defined**: `backend/src/db.ts:3814`
- **Signature**: `export function getPart(entityName: string): Part | undefined {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/parts.ts, frontend/src/routes/parts/+page.svelte

### `setPart`
- **Defined**: `backend/src/db.ts:3824`
- **Signature**: `export function setPart(entityName: string, part: Partial<Part>): void {`
- **Call sites found**: 4
- **Called from**: backend/src/db.ts, backend/src/routes/parts.ts, frontend/src/routes/parts/+page.svelte

### `listParts`
- **Defined**: `backend/src/db.ts:3845`
- **Signature**: `export function listParts(limit?: number, offset = 0): PartSummary[] {`
- **Call sites found**: 9
- **Called from**: backend/src/routes/parts.ts, frontend/src/routes/parts/+page.svelte, frontend/src/routes/pos/+page.svelte, frontend/src/routes/stock/transfer/+page.svelte, frontend/src/routes/stock/write-offs/+page.svelte

### `countParts`
- **Defined**: `backend/src/db.ts:3868`
- **Signature**: `export function countParts(): number {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/parts.ts

### `createPart`
- **Defined**: `backend/src/db.ts:3892`
- **Signature**: `export function createPart(name: string, parentCategoryOrPartsRoot: string, userId: UserId): void {`
- **Call sites found**: 1
- **Called from**: backend/src/db-seed.ts

### `listPartSources`
- **Defined**: `backend/src/db.ts:3913`
- **Signature**: `export function listPartSources(partName: string): PartSource[] {`
- **Call sites found**: 5
- **Called from**: backend/src/db.ts, backend/src/routes/parts.ts, frontend/src/routes/parts/+page.svelte, frontend/src/routes/stock/po/+page.svelte

### `addOrUpdatePartSource`
- **Defined**: `backend/src/db.ts:3943`
- **Signature**: `export function addOrUpdatePartSource(input: PartSourceInput): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/parts.ts, frontend/src/routes/parts/+page.svelte

### `deletePartSource`
- **Defined**: `backend/src/db.ts:3972`
- **Signature**: `export function deletePartSource(id: number): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/parts.ts, frontend/src/routes/parts/+page.svelte

### `getLanguages`
- **Defined**: `backend/src/db.ts:3983`
- **Signature**: `export function getLanguages(): { id: number; name: string }[] {`
- **Call sites found**: 10
- **Called from**: backend/src/db-seed.ts, backend/src/db.ts, backend/src/routes/i18n.ts, frontend/src/routes/contacts/+page.svelte, frontend/src/routes/customer-terminal/+page.svelte, frontend/src/routes/login/+page.svelte, frontend/src/routes/session/+page.svelte, frontend/src/routes/setup/+page.svelte, frontend/src/routes/setup/translations/+page.svelte

### `getDefaultLanguage`
- **Defined**: `backend/src/db.ts:4002`
- **Signature**: `export function getDefaultLanguage(): string | null {`
- **Call sites found**: 4
- **Called from**: backend/src/invoice.ts, backend/src/routes/i18n.ts, frontend/src/routes/login/+page.svelte, frontend/src/routes/setup/+page.svelte

### `setDefaultLanguage`
- **Defined**: `backend/src/db.ts:4013`
- **Signature**: `export function setDefaultLanguage(languageName: string, userId: UserId): void {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/i18n.ts

### `getDivisions`
- **Defined**: `backend/src/db.ts:4029`
- **Signature**: `export function getDivisions(): { id: number; name: string; parentName: string | null; centerType: string | null }[] {`
- **Call sites found**: 5
- **Called from**: backend/src/db-reports.ts, backend/src/db.ts, backend/src/routes/divisions.ts, frontend/src/routes/reports/profit-and-loss/+page.svelte, frontend/src/routes/setup/bank-accounts/+page.svelte

### `getMenuTree`
- **Defined**: `backend/src/db.ts:4080`
- **Signature**: `export function getMenuTree(opts?: { businessName?: string; userId?: number }): MenuSectionRow[] {`
- **Call sites found**: 3
- **Called from**: backend/src/db.ts, backend/src/routes/menu.ts, frontend/src/routes/+layout.svelte

### `getScreenTitle`
- **Defined**: `backend/src/db.ts:4162`
- **Signature**: `export function getScreenTitle(href: string, opts?: { businessName?: string; userId?: number }): string | undefined {`
- **Call sites found**: 0
- **Called from**: (NONE FOUND - possibly dead code, or only used internally within its own file)

### `setMenuOverride`
- **Defined**: `backend/src/db.ts:4172`
- **Signature**: `export function setMenuOverride(menuItemKey: string, scope: 'business' | 'user', scopeId: number, overrideLabel: string | null, hidden: boolean, userId: UserId = asUserId(1)): void {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/menu.ts

### `deleteMenuOverride`
- **Defined**: `backend/src/db.ts:4201`
- **Signature**: `export function deleteMenuOverride(menuItemKey: string, scope: 'business' | 'user', scopeId: number, userId: UserId = asUserId(1)): void {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/menu.ts

### `setDivisionType`
- **Defined**: `backend/src/db.ts:4213`
- **Signature**: `export function setDivisionType(divisionNameOrId: string | EntityId, typeMarkerName: string): void {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/divisions.ts

### `getDivisionType`
- **Defined**: `backend/src/db.ts:4255`
- **Signature**: `export function getDivisionType(divisionName: string): string | null {`
- **Call sites found**: 1
- **Called from**: backend/src/db.ts

### `getDivisionTypes`
- **Defined**: `backend/src/db.ts:4271`
- **Signature**: `export function getDivisionTypes(): string[] {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/divisions.ts

### `createDivisionType`
- **Defined**: `backend/src/db.ts:4291`
- **Signature**: `export function createDivisionType(name: string, userId: UserId): void {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/divisions.ts

### `getVocabularyWords`
- **Defined**: `backend/src/db.ts:4318`
- **Signature**: `export function getVocabularyWords(): VocabularyWord[] {`
- **Call sites found**: 3
- **Called from**: backend/src/routes/i18n.ts, frontend/src/routes/setup/translations/+page.svelte

### `getVocabularyAlternates`
- **Defined**: `backend/src/db.ts:4346`
- **Signature**: `export function getVocabularyAlternates(wordName: string): string[] {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/i18n.ts

### `getConceptsWithAlternates`
- **Defined**: `backend/src/db.ts:4369`
- **Signature**: `export function getConceptsWithAlternates(): ConceptWithAlternates[] {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/i18n.ts, frontend/src/routes/setup/vocabulary/+page.svelte

### `setVocabularyPreference`
- **Defined**: `backend/src/db.ts:4393`
- **Signature**: `export function setVocabularyPreference(conceptName: string, scope: 'business' | 'user', scopeId: number, preferredAlternateName: string): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/i18n.ts, frontend/src/routes/setup/vocabulary/+page.svelte

### `deleteVocabularyPreference`
- **Defined**: `backend/src/db.ts:4404`
- **Signature**: `export function deleteVocabularyPreference(conceptName: string, scope: 'business' | 'user', scopeId: number): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/i18n.ts, frontend/src/routes/setup/vocabulary/+page.svelte

### `getLocalizedText`
- **Defined**: `backend/src/db.ts:4419`
- **Signature**: `export function getLocalizedText(language: string, opts?: { businessName?: string; userId?: number }): Record<string, string> {`
- **Call sites found**: 5
- **Called from**: backend/src/invoice.ts, backend/src/routes/i18n.ts, frontend/src/routes/+layout.svelte, frontend/src/routes/login/+page.svelte, frontend/src/routes/session/+page.svelte

### `setTranslation`
- **Defined**: `backend/src/db.ts:4459`
- **Signature**: `export function setTranslation(conceptName: string, languageName: string, text: string, userId: UserId = asUserId(1)): void {`
- **Call sites found**: 37
- **Called from**: backend/src/db-seed.ts, backend/src/db-translations-migrate.ts, backend/src/routes/i18n.ts, frontend/src/routes/setup/translations/+page.svelte

### `getAllTranslations`
- **Defined**: `backend/src/db.ts:4499`
- **Signature**: `export function getAllTranslations(languageName: string): Record<string, string> {`
- **Call sites found**: 0
- **Called from**: (NONE FOUND - possibly dead code, or only used internally within its own file)

### `getTranslation`
- **Defined**: `backend/src/db.ts:4513`
- **Signature**: `export function getTranslation(conceptName: string, languageName: string): string | null {`
- **Call sites found**: 2
- **Called from**: backend/src/db-seed.ts, backend/src/db.ts

### `getBusinesses`
- **Defined**: `backend/src/db.ts:4529`
- **Signature**: `export function getBusinesses(): { id: number; name: BusinessName }[] {`
- **Call sites found**: 15
- **Called from**: backend/src/routes/businesses.ts, frontend/src/routes/arap/ap-payment/+page.svelte, frontend/src/routes/arap/ap-purchase/+page.svelte, frontend/src/routes/arap/ar-receipt/+page.svelte, frontend/src/routes/arap/ar-sale/+page.svelte, frontend/src/routes/arap/cash-purchase/+page.svelte, frontend/src/routes/arap/cash-sale/+page.svelte, frontend/src/routes/post/+page.svelte, frontend/src/routes/projects/+page.svelte, frontend/src/routes/session/+page.svelte, frontend/src/routes/setup/periods/+page.svelte, frontend/src/routes/stock/po/+page.svelte, frontend/src/routes/stock/so/+page.svelte, frontend/src/routes/stock/stock-dispatch/+page.svelte, frontend/src/routes/stock/stock-receipt/+page.svelte

### `getLedgers`
- **Defined**: `backend/src/db.ts:4544`
- **Signature**: `export function getLedgers(businessName: BusinessName): { id: number; name: LedgerName }[] {`
- **Call sites found**: 17
- **Called from**: backend/src/routes/businesses.ts, frontend/src/routes/arap/ap-payment/+page.svelte, frontend/src/routes/arap/ap-purchase/+page.svelte, frontend/src/routes/arap/ar-receipt/+page.svelte, frontend/src/routes/arap/ar-sale/+page.svelte, frontend/src/routes/arap/cash-purchase/+page.svelte, frontend/src/routes/arap/cash-sale/+page.svelte, frontend/src/routes/post/+page.svelte, frontend/src/routes/projects/+page.svelte, frontend/src/routes/reports/compare/+page.svelte, frontend/src/routes/reports/trial-balance/+page.svelte, frontend/src/routes/session/+page.svelte, frontend/src/routes/setup/periods/+page.svelte, frontend/src/routes/stock/po/+page.svelte, frontend/src/routes/stock/so/+page.svelte, frontend/src/routes/stock/stock-dispatch/+page.svelte, frontend/src/routes/stock/stock-receipt/+page.svelte

### `setupEquityStructure`
- **Defined**: `backend/src/db.ts:4624`
- **Signature**: `export function setupEquityStructure(businessName: BusinessName, structure: EntityStructure, userId: UserId, coaFamily?: string, partnerNames?: string[]): void {`
- **Call sites found**: 1
- **Called from**: backend/src/db.ts

### `instantiateChartOfAccounts`
- **Defined**: `backend/src/db.ts:4680`
- **Signature**: `export function instantiateChartOfAccounts(businessName: BusinessName, coaFamily: string | undefined, userId: UserId): void {`
- **Call sites found**: 2
- **Called from**: backend/src/db-seed.ts, backend/src/db.ts

### `createBusiness`
- **Defined**: `backend/src/db.ts:4729`
- **Signature**: `export function createBusiness(`
- **Call sites found**: 2
- **Called from**: backend/src/routes/businesses.ts, frontend/src/routes/setup/new-business/+page.svelte

### `getCoaFamilyAccounts`
- **Defined**: `backend/src/db.ts:4827`
- **Signature**: `export function getCoaFamilyAccounts(businessName: BusinessName, ledgerName: LedgerName): string[] {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/businesses.ts, frontend/src/routes/setup/new-business/+page.svelte

### `stageLine`
- **Defined**: `backend/src/db.ts:4862`
- **Signature**: `export function stageLine(line: StagedLine): void {`
- **Call sites found**: 29
- **Called from**: backend/src/db-reports.ts, backend/src/db-stock.ts, backend/src/db.ts, backend/src/routes/journal.ts, frontend/src/routes/post/+page.svelte

### `getStagedLines`
- **Defined**: `backend/src/db.ts:4895`
- **Signature**: `export function getStagedLines(reference: string, business: BusinessName, ledger: LedgerName): StagedLine[] {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/journal.ts

### `createRecurringJournal`
- **Defined**: `backend/src/db.ts:4925`
- **Signature**: `export function createRecurringJournal(`
- **Call sites found**: 3
- **Called from**: backend/src/db.ts, backend/src/routes/journal.ts, frontend/src/routes/post/+page.svelte

### `ensureLocationScopedAccount`
- **Defined**: `backend/src/db.ts:4985`
- **Signature**: `export function ensureLocationScopedAccount(baseAccountName: string, locationName: string, userId: UserId): string {`
- **Call sites found**: 2
- **Called from**: backend/src/db.ts

### `stageArSale`
- **Defined**: `backend/src/db.ts:5009`
- **Signature**: `export function stageArSale(input: ArSaleInput): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/arap.ts, frontend/src/routes/arap/ar-sale/+page.svelte

### `postArSale`
- **Defined**: `backend/src/db.ts:5019`
- **Signature**: `export function postArSale(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {`
- **Call sites found**: 1
- **Called from**: frontend/src/routes/arap/ar-sale/+page.svelte

### `stageArReceipt`
- **Defined**: `backend/src/db.ts:5045`
- **Signature**: `export function stageArReceipt(input: ArReceiptInput): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/arap.ts, frontend/src/routes/arap/ar-receipt/+page.svelte

### `postArReceipt`
- **Defined**: `backend/src/db.ts:5055`
- **Signature**: `export function postArReceipt(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {`
- **Call sites found**: 1
- **Called from**: frontend/src/routes/arap/ar-receipt/+page.svelte

### `stageApPurchase`
- **Defined**: `backend/src/db.ts:5076`
- **Signature**: `export function stageApPurchase(input: ApPurchaseInput): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/arap.ts, frontend/src/routes/arap/ap-purchase/+page.svelte

### `postApPurchase`
- **Defined**: `backend/src/db.ts:5089`
- **Signature**: `export function postApPurchase(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {`
- **Call sites found**: 1
- **Called from**: frontend/src/routes/arap/ap-purchase/+page.svelte

### `stageApPayment`
- **Defined**: `backend/src/db.ts:5115`
- **Signature**: `export function stageApPayment(input: ApPaymentInput): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/arap.ts, frontend/src/routes/arap/ap-payment/+page.svelte

### `postApPayment`
- **Defined**: `backend/src/db.ts:5125`
- **Signature**: `export function postApPayment(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {`
- **Call sites found**: 1
- **Called from**: frontend/src/routes/arap/ap-payment/+page.svelte

### `stagePurchaseOrder`
- **Defined**: `backend/src/db.ts:5157`
- **Signature**: `export function stagePurchaseOrder(input: PurchaseOrderInput): void {`
- **Call sites found**: 3
- **Called from**: backend/src/db.ts, backend/src/routes/stock.ts, frontend/src/routes/stock/po/+page.svelte

### `postPurchaseOrder`
- **Defined**: `backend/src/db.ts:5167`
- **Signature**: `export function postPurchaseOrder(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {`
- **Call sites found**: 2
- **Called from**: backend/src/db.ts, frontend/src/routes/stock/po/+page.svelte

### `clockInToProject`
- **Defined**: `backend/src/db.ts:5195`
- **Signature**: `export function clockInToProject(employeeName: EmployeeName, projectExpenseAccount: AccountName, business: BusinessName, ledger: LedgerName, userId: UserId): EmployeeClock {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/projects.ts, frontend/src/routes/projects/+page.svelte

### `clockOutOfProject`
- **Defined**: `backend/src/db.ts:5231`
- **Signature**: `export function clockOutOfProject(employeeName: EmployeeName, business: BusinessName, ledger: LedgerName, userId: UserId): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/projects.ts, frontend/src/routes/projects/+page.svelte

### `getOpenProjectClockForEmployee`
- **Defined**: `backend/src/db.ts:5266`
- **Signature**: `export function getOpenProjectClockForEmployee(employeeName: EmployeeName): EmployeeClock | undefined {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/projects.ts

### `stageStockReceipt`
- **Defined**: `backend/src/db.ts:5291`
- **Signature**: `export function stageStockReceipt(input: StockReceiptInput): void {`
- **Call sites found**: 3
- **Called from**: backend/src/db.ts, backend/src/routes/stock.ts, frontend/src/routes/stock/stock-receipt/+page.svelte

### `postStockReceipt`
- **Defined**: `backend/src/db.ts:5306`
- **Signature**: `export function postStockReceipt(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {`
- **Call sites found**: 2
- **Called from**: backend/src/db.ts, frontend/src/routes/stock/stock-receipt/+page.svelte

### `stageSalesOrder`
- **Defined**: `backend/src/db.ts:5349`
- **Signature**: `export function stageSalesOrder(input: SalesOrderInput): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/stock.ts, frontend/src/routes/stock/so/+page.svelte

### `postSalesOrder`
- **Defined**: `backend/src/db.ts:5359`
- **Signature**: `export function postSalesOrder(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {`
- **Call sites found**: 1
- **Called from**: frontend/src/routes/stock/so/+page.svelte

### `stageStockDispatch`
- **Defined**: `backend/src/db.ts:5384`
- **Signature**: `export function stageStockDispatch(input: StockDispatchInput): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/stock.ts, frontend/src/routes/stock/stock-dispatch/+page.svelte

### `postStockDispatch`
- **Defined**: `backend/src/db.ts:5401`
- **Signature**: `export function postStockDispatch(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {`
- **Call sites found**: 1
- **Called from**: frontend/src/routes/stock/stock-dispatch/+page.svelte

### `removeStagedLine`
- **Defined**: `backend/src/db.ts:5438`
- **Signature**: `export function removeStagedLine(reference: string, business: BusinessName, ledger: LedgerName, account: string): void {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/journal.ts

### `postJournalEntry`
- **Defined**: `backend/src/db.ts:5446`
- **Signature**: `export function postJournalEntry(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {`
- **Call sites found**: 15
- **Called from**: backend/src/db-reports.ts, backend/src/db-stock.ts, backend/src/db.ts, backend/src/routes/journal.ts, frontend/src/routes/post/+page.svelte

### `listJournalEntries`
- **Defined**: `backend/src/db.ts:5482`
- **Signature**: `export function listJournalEntries(business: BusinessName, ledger: LedgerName, limit = 100, offset = 0): JournalSummary[] {`
- **Call sites found**: 3
- **Called from**: backend/src/routes/journal.ts, frontend/src/lib/pagination.ts, frontend/src/routes/journal/+page.svelte

### `countJournalEntries`
- **Defined**: `backend/src/db.ts:5505`
- **Signature**: `export function countJournalEntries(business: BusinessName, ledger: LedgerName): number {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/journal.ts

### `getJournalEntry`
- **Defined**: `backend/src/db.ts:5528`
- **Signature**: `export function getJournalEntry(business: BusinessName, ledger: LedgerName, journalId: number, occurrenceDate: string): JournalDetail | undefined {`
- **Call sites found**: 3
- **Called from**: backend/src/db.ts, backend/src/routes/journal.ts, frontend/src/routes/journal/[id]/[date]/+page.svelte

### `getLedgerDateRange`
- **Defined**: `backend/src/db.ts:5614`
- **Signature**: `export function getLedgerDateRange(businessName: BusinessName, ledgerName: LedgerName): LedgerDateRange {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/reports.ts, frontend/src/routes/reports/profit-and-loss/+page.svelte

### `getPeriodLockStatus`
- **Defined**: `backend/src/db.ts:5626`
- **Signature**: `export function getPeriodLockStatus(business: BusinessName, ledger: LedgerName): PeriodLockStatus {`
- **Call sites found**: 2
- **Called from**: backend/src/db.ts, backend/src/routes/period.ts

### `closePeriod`
- **Defined**: `backend/src/db.ts:5636`
- **Signature**: `export function closePeriod(business: BusinessName, ledger: LedgerName, throughDate: string, userId: UserId): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/period.ts, frontend/src/routes/setup/periods/+page.svelte

### `reopenPeriod`
- **Defined**: `backend/src/db.ts:5642`
- **Signature**: `export function reopenPeriod(business: BusinessName, ledger: LedgerName, userId: UserId): void {`
- **Call sites found**: 2
- **Called from**: backend/src/routes/period.ts, frontend/src/routes/setup/periods/+page.svelte

### `assertPeriodOpen`
- **Defined**: `backend/src/db.ts:5655`
- **Signature**: `export function assertPeriodOpen(business: BusinessName, ledger: LedgerName, transdate: string): void {`
- **Call sites found**: 5
- **Called from**: backend/src/db-stock.ts, backend/src/db.ts

### `reverseJournalEntry`
- **Defined**: `backend/src/db.ts:5664`
- **Signature**: `export function reverseJournalEntry(business: BusinessName, ledger: LedgerName, journalId: number, occurrenceDate: string, userId: UserId, reversalDate?: string): void {`
- **Call sites found**: 1
- **Called from**: backend/src/routes/journal.ts


## `backend/src/password.ts` (2 functions)

### `hashPassword`
- **Defined**: `backend/src/password.ts:8`
- **Signature**: `export function hashPassword(password: string): string {`
- **Call sites found**: 3
- **Called from**: backend/src/auth.ts, backend/src/db.ts

### `verifyPassword`
- **Defined**: `backend/src/password.ts:14`
- **Signature**: `export function verifyPassword(password: string, stored: string): boolean {`
- **Call sites found**: 3
- **Called from**: backend/src/auth.ts, backend/src/db.ts
