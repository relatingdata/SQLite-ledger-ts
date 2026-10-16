# Documentation Coverage Baseline — Structured Report

Generated directly by `scripts/documentation-baseline-report.ts` (run via `make documentation-baseline-report`). Reads the exact, same, real, tracked names from `docs/documentation-coverage-baseline.md` that `check-docs-coverage.ts` itself uses, then, for each real name still genuinely present in the live source, finds its own real file of definition, its own real, full declaration (a function's own, real, full parameter list and return type; a const's own, real, full initializing expression), and every other real, core backend file that genuinely, textually references it. Separated into real, distinct, alphabetical groups - never one, single, undifferentiated list - since these are genuinely different kinds of things: `typeXxxName` `TypeDescriptor` constants, `xxxRouter` Express router constants, and real, substantial, ordinary functions.

## TypeDescriptor Constants (32, alphabetical)

| Name | Defined in | Referenced in | Declaration |
|---|---|---|---|
| `typeAssetAccountName` | `backend/src/db.ts` | `backend/src/routes/businesses.ts` | `const typeAssetAccountName = { brand: 'AssetAccountName' };` |
| `typeBusinessContactsRootName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeBusinessContactsRootName = { brand: 'BusinessContactsRootName' };` |
| `typeBusinessItemsRootName` | `backend/src/db.ts` | (none) | `const typeBusinessItemsRootName = { brand: 'BusinessItemsRootName' };` |
| `typeBusinessLocationsRootName` | `backend/src/db.ts` | (none) | `const typeBusinessLocationsRootName = { brand: 'BusinessLocationsRootName' };` |
| `typeBusinessTypeName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeBusinessTypeName = { brand: 'BusinessTypeName' };` |
| `typeBusinessTypeQuestionName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeBusinessTypeQuestionName = { brand: 'BusinessTypeQuestionName' };` |
| `typeBusinessTypeQuestionsRootName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeBusinessTypeQuestionsRootName = { brand: 'BusinessTypeQuestionsRootName' };` |
| `typeChartOfAccountsNodeName` | `backend/src/db.ts` | (none) | `const typeChartOfAccountsNodeName = { brand: 'ChartOfAccountsNodeName' };` |
| `typeChartOfAccountsRootName` | `backend/src/db.ts` | `backend/src/db-reports.ts`, `backend/src/db-seed.ts` | `const typeChartOfAccountsRootName = { brand: 'ChartOfAccountsRootName' };` |
| `typeCustomerName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeCustomerName = { brand: 'CustomerName' };` |
| `typeEntityLinkRecordName` | `backend/src/db.ts` | (none) | `const typeEntityLinkRecordName = { brand: 'EntityLinkRecordName' };` |
| `typeEquityAccountName` | `backend/src/db.ts` | `backend/src/routes/businesses.ts` | `const typeEquityAccountName = { brand: 'EquityAccountName' };` |
| `typeExpenseCategoryName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeExpenseCategoryName = { brand: 'ExpenseCategoryName' };` |
| `typeHiddenMarkerName` | `backend/src/db.ts` | (none) | `const typeHiddenMarkerName = { brand: 'HiddenMarkerName' };` |
| `typeIsBillingAddressMarkerName` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `const typeIsBillingAddressMarkerName = { brand: 'IsBillingAddressMarkerName' };` |
| `typeItemName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeItemName = { brand: 'ItemName' };` |
| `typeLedgerName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeLedgerName = { brand: 'LedgerName' };` |
| `typeLineTypeMarkerName` | `backend/src/db.ts` | (none) | `const typeLineTypeMarkerName = { brand: 'LineTypeMarkerName' };` |
| `typeLocationTypeMarkerName` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `const typeLocationTypeMarkerName = { brand: 'LocationTypeMarkerName' };` |
| `typeMenuLinkFlagName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeMenuLinkFlagName = { brand: 'MenuLinkFlagName' };` |
| `typeMenuLinkName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeMenuLinkName = { brand: 'MenuLinkName' };` |
| `typeMenuOverrideName` | `backend/src/db.ts` | (none) | `const typeMenuOverrideName = { brand: 'MenuOverrideName' };` |
| `typeMenuSectionName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeMenuSectionName = { brand: 'MenuSectionName' };` |
| `typeOpenHoursRecordName` | `backend/src/db.ts` | (none) | `const typeOpenHoursRecordName = { brand: 'OpenHoursRecordName' };` |
| `typeProjectTaskName` | `backend/src/db.ts` | (none) | `const typeProjectTaskName = { brand: 'ProjectTaskName' };` |
| `typeProviderName` | `backend/src/db.ts` | (none) | `const typeProviderName = { brand: 'ProviderName' };` |
| `typeRelationshipRecordName` | `backend/src/db.ts` | (none) | `const typeRelationshipRecordName = { brand: 'RelationshipRecordName' };` |
| `typeRootName` | `backend/src/db.ts` | `backend/src/auth-middleware.ts`, `backend/src/db-reports.ts`, `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/routes/divisions.ts` | `const typeRootName = { brand: 'RootName' };` |
| `typeScheduleRecordName` | `backend/src/db.ts` | (none) | `const typeScheduleRecordName = { brand: 'ScheduleRecordName' };` |
| `typeStorageOriginMarkerName` | `backend/src/db.ts` | (none) | `const typeStorageOriginMarkerName = { brand: 'StorageOriginMarkerName' };` |
| `typeTextDirectionMarkerName` | `backend/src/db.ts` | (none) | `const typeTextDirectionMarkerName = { brand: 'TextDirectionMarkerName' };` |
| `typeTranslationConceptName` | `backend/src/db.ts` | (none) | `const typeTranslationConceptName = { brand: 'TranslationConceptName' };` |

## Router Constants (31, alphabetical)

| Name | Defined in | Referenced in | Declaration |
|---|---|---|---|
| `agedRouter` | `backend/src/routes/invoices.ts` | `backend/src/server.ts` | `const agedRouter = Router();` |
| `arAPRouter` | `backend/src/routes/arap.ts` | `backend/src/server.ts` | `const arAPRouter = Router();` |
| `authRouter` | `backend/src/routes/auth.ts` | `backend/src/server.ts` | `const authRouter = Router();` |
| `belowReorderRouter` | `backend/src/routes/locations.ts` | `backend/src/server.ts` | `const belowReorderRouter = Router();` |
| `businessesRouter` | `backend/src/routes/businesses.ts` | `backend/src/server.ts` | `const businessesRouter = Router();` |
| `contactsRouter` | `backend/src/routes/contacts.ts` | `backend/src/server.ts` | `const contactsRouter = Router();` |
| `customerRegistrationRouter` | `backend/src/routes/customer-registration.ts` | `backend/src/server.ts` | `const customerRegistrationRouter = Router();` |
| `customerVerificationRouter` | `backend/src/routes/customer-registration.ts` | `backend/src/server.ts` | `const customerVerificationRouter = Router();` |
| `divisionsRouter` | `backend/src/routes/divisions.ts` | `backend/src/server.ts` | `const divisionsRouter = Router();` |
| `entitiesRouter` | `backend/src/routes/entities.ts` | `backend/src/server.ts` | `const entitiesRouter = Router();` |
| `historyRouter` | `backend/src/routes/invoices.ts` | `backend/src/server.ts` | `const historyRouter = Router();` |
| `i18nRouter` | `backend/src/routes/i18n.ts` | `backend/src/server.ts` | `const i18nRouter = Router();` |
| `invoiceRouter` | `backend/src/routes/invoice.ts` | `backend/src/server.ts` | `const invoiceRouter = Router();` |
| `invoicesRouter` | `backend/src/routes/invoices.ts` | `backend/src/server.ts` | `const invoicesRouter = Router();` |
| `itemsRouter` | `backend/src/routes/items.ts` | `backend/src/server.ts` | `const itemsRouter = Router();` |
| `journalRouter` | `backend/src/routes/journal.ts` | `backend/src/server.ts` | `const journalRouter = Router();` |
| `locationsRouter` | `backend/src/routes/locations.ts` | `backend/src/server.ts` | `const locationsRouter = Router();` |
| `matrixReportsRouter` | `backend/src/routes/matrix-reports.ts` | `backend/src/server.ts` | `const matrixReportsRouter = Router();` |
| `menuRouter` | `backend/src/routes/menu.ts` | `backend/src/server.ts` | `const menuRouter = Router();` |
| `periodRouter` | `backend/src/routes/period.ts` | `backend/src/server.ts` | `const periodRouter = Router();` |
| `posRouter` | `backend/src/routes/pos.ts` | `backend/src/server.ts` | `const posRouter = Router();` |
| `productsRouter` | `backend/src/routes/products.ts` | `backend/src/server.ts` | `const productsRouter = Router();` |
| `projectsRouter` | `backend/src/routes/projects.ts` | `backend/src/server.ts` | `const projectsRouter = Router();` |
| `remindersRouter` | `backend/src/routes/invoices.ts` | `backend/src/server.ts` | `const remindersRouter = Router();` |
| `reportsRouter` | `backend/src/routes/reports.ts` | `backend/src/server.ts` | `const reportsRouter = Router();` |
| `statementRouter` | `backend/src/routes/invoices.ts` | `backend/src/server.ts` | `const statementRouter = Router();` |
| `stockListingRouter` | `backend/src/routes/locations.ts` | `backend/src/server.ts` | `const stockListingRouter = Router();` |
| `stockLotsRouter` | `backend/src/routes/stock-lots.ts` | `backend/src/server.ts` | `const stockLotsRouter = Router();` |
| `stockOutRiskRouter` | `backend/src/routes/locations.ts` | `backend/src/server.ts` | `const stockOutRiskRouter = Router();` |
| `stockRouter` | `backend/src/routes/stock.ts` | `backend/src/server.ts` | `const stockRouter = Router();` |
| `stockTakesRouter` | `backend/src/routes/locations.ts` | `backend/src/server.ts` | `const stockTakesRouter = Router();` |

## Functions (116, alphabetical)

| Name | Defined in | Referenced in | Declaration |
|---|---|---|---|
| `addOrUpdateItemSource` | `backend/src/db.ts` | `backend/src/routes/items.ts` | `function addOrUpdateItemSource(input: ItemSourceInput): void` |
| `addTypedAddress` | `backend/src/db.ts` | `backend/src/routes/contacts.ts`, `backend/src/routes/entities.ts` | `function addTypedAddress(entityName: string, addressType: string, value: Partial<Contact>, userId: UserId): string` |
| `addTypedContactPerson` | `backend/src/db.ts` | `backend/src/routes/contacts.ts` | `function addTypedContactPerson(entityName: string, contactType: string, value: { name: string; phone?: string \| null; email?: string \| null }, userId: UserId): string` |
| `addTypedPhone` | `backend/src/db.ts` | `backend/src/routes/contacts.ts`, `backend/src/routes/entities.ts` | `function addTypedPhone(entityName: string, phoneType: string, number: string, userId: UserId): string` |
| `adjustLocationCapacity` | `backend/src/db-stock.ts` | `backend/src/db.ts` | `function adjustLocationCapacity(business: BusinessName, ledger: LedgerName, locationName: LocationName, itemName: ItemName, itemQuantityDelta: number, transdate: string, userId: UserId, referenceSuffix: string): void` |
| `asCustomerName` | `backend/src/db.ts` | `backend/src/routes/arap.ts`, `backend/src/routes/invoices.ts`, `backend/src/routes/pos.ts` | `function asCustomerName(name: string): CustomerName` |
| `asEmployeeName` | `backend/src/db.ts` | `backend/src/routes/projects.ts` | `function asEmployeeName(name: string): EmployeeName` |
| `asEntityId` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `backend/src/routes/entities.ts` | `function asEntityId(id: number): EntityId` |
| `asItemName` | `backend/src/db.ts` | `backend/src/db-journal.ts`, `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/routes/items.ts`, `backend/src/routes/locations.ts`, `backend/src/routes/pos.ts`, `backend/src/routes/stock-lots.ts` | `function asItemName(name: string): ItemName` |
| `asLocationName` | `backend/src/db.ts` | `backend/src/db-journal.ts`, `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/routes/invoices.ts`, `backend/src/routes/locations.ts`, `backend/src/routes/pos.ts` | `function asLocationName(name: string): LocationName` |
| `asProviderName` | `backend/src/db.ts` | `backend/src/db-journal.ts`, `backend/src/routes/arap.ts`, `backend/src/routes/invoices.ts`, `backend/src/routes/locations.ts`, `backend/src/routes/pos.ts` | `function asProviderName(name: string): ProviderName` |
| `asUserId` | `backend/src/db.ts` | `backend/src/db-journal.ts`, `backend/src/db-seed.ts`, `backend/src/db-stock.ts`, `backend/src/routes/arap.ts`, `backend/src/routes/auth.ts`, `backend/src/routes/businesses.ts`, `backend/src/routes/contacts.ts`, `backend/src/routes/customer-registration.ts`, `backend/src/routes/divisions.ts`, `backend/src/routes/entities.ts`, `backend/src/routes/hierarchy.ts`, `backend/src/routes/i18n.ts`, `backend/src/routes/invoices.ts`, `backend/src/routes/items.ts`, `backend/src/routes/journal.ts`, `backend/src/routes/locations.ts`, `backend/src/routes/period.ts`, `backend/src/routes/pos.ts`, `backend/src/routes/products.ts`, `backend/src/routes/projects.ts`, `backend/src/routes/reports.ts`, `backend/src/routes/stock-lots.ts`, `backend/src/routes/stock.ts` | `function asUserId(id: number): UserId` |
| `attachUser` | `backend/src/auth-middleware.ts` | `backend/src/recording.ts`, `backend/src/server.ts` | `function attachUser(req: Request, _res: Response, next: NextFunction): void` |
| `authenticateCustomer` | `backend/src/db.ts` | `backend/src/routes/customer-registration.ts` | `function authenticateCustomer(name: string, password: string): boolean` |
| `buildProfitAndLossFromBalances` | `backend/src/db-reports.ts` | `backend/src/db-matrix-reports.ts` | `function buildProfitAndLossFromBalances(business: string, balances: Map<number, number>): ProfitAndLoss` |
| `changeOwnPassword` | `backend/src/auth.ts` | `backend/src/routes/auth.ts` | `function changeOwnPassword(userId: number, currentPassword: string, newPassword: string): void` |
| `changePassword` | `backend/src/auth.ts` | `backend/src/routes/auth.ts` | `function changePassword(userId: number, newPassword: string): void` |
| `checkEInvoiceDiscrepancies` | `backend/src/db.ts` | (none) | `function checkEInvoiceDiscrepancies(parsed: UblImportResult, poReference?: string): EInvoiceDiscrepancy[]` |
| `createLocationType` | `backend/src/db-stock.ts` | `backend/src/routes/locations.ts` | `function createLocationType(name: string, userId: UserId): void` |
| `createProduct` | `backend/src/db.ts` | `backend/src/routes/products.ts` | `function createProduct(name: string, parent: string, userId: UserId): void` |
| `createSystemEntity` | `backend/src/db-stock.ts` | (none) | `function createSystemEntity(name: string, parentId: number \| null): number` |
| `deleteBomComponent` | `backend/src/db.ts` | `backend/src/routes/items.ts` | `function deleteBomComponent(assemblyItem: string, componentItem: string, userId: UserId): void` |
| `deleteDimensionParent` | `backend/src/db.ts` | (none) | `function deleteDimensionParent(entityName: string, dimensionName: string, userId: UserId): void` |
| `deleteItemSource` | `backend/src/db.ts` | `backend/src/routes/items.ts` | `function deleteItemSource(id: number): void` |
| `deleteMenuOverride` | `backend/src/db.ts` | `backend/src/routes/menu.ts` | `function deleteMenuOverride(menuItemKey: string, scope: 'business' \| 'user', scopeId: number, userId: UserId = asUserId(1)): void` |
| `deleteTypedAddress` | `backend/src/db.ts` | `backend/src/routes/contacts.ts` | `function deleteTypedAddress(entityName: string, addressType: string, userId: UserId): void` |
| `deleteTypedContactPerson` | `backend/src/db.ts` | `backend/src/routes/contacts.ts` | `function deleteTypedContactPerson(entityName: string, contactType: string, userId: UserId): void` |
| `deleteTypedPhone` | `backend/src/db.ts` | `backend/src/routes/contacts.ts` | `function deleteTypedPhone(entityName: string, phoneType: string, userId: UserId): void` |
| `deleteVocabularyPreference` | `backend/src/db.ts` | `backend/src/routes/i18n.ts` | `function deleteVocabularyPreference(conceptName: string, scope: 'business' \| 'user', scopeId: number): void` |
| `dispatchOrderFromPickingList` | `backend/src/db.ts` | `backend/src/routes/invoices.ts` | `function dispatchOrderFromPickingList(invoiceId: number, locationName: LocationName, revenueAccount: string, taxAccount: string, userId: UserId): void` |
| `ensureAddressType` | `backend/src/db.ts` | (none) | `function ensureAddressType(typeName: string, userId: UserId): void` |
| `ensureContactPersonType` | `backend/src/db.ts` | (none) | `function ensureContactPersonType(typeName: string, userId: UserId): void` |
| `ensureItemTier` | `backend/src/db.ts` | (none) | `function ensureItemTier(baseProductName: ItemName, tier: string, userId: UserId, business?: BusinessName): ` |
| `ensureLocationCapacityAccount` | `backend/src/db-stock.ts` | `backend/src/db-journal.ts`, `backend/src/db-seed.ts`, `backend/src/db.ts` | `function ensureLocationCapacityAccount(business: BusinessName, ledger: LedgerName, locationName: LocationName, userId: UserId): ` |
| `ensurePhoneType` | `backend/src/db.ts` | (none) | `function ensurePhoneType(typeName: string, userId: UserId): void` |
| `exportInvoiceAsUbl` | `backend/src/db.ts` | `backend/src/routes/invoices.ts` | `function exportInvoiceAsUbl(invoiceId: number): string` |
| `getAccountsPostedTo` | `backend/src/db.ts` | (none) | `function getAccountsPostedTo(reference: string): string[]` |
| `getActiveShiftsAtLocation` | `backend/src/db.ts` | (none) | `function getActiveShiftsAtLocation(locationName: string): PosShift[]` |
| `getAgingBuckets` | `backend/src/db.ts` | (none) | `function getAgingBuckets(paymentTermsDays: number \| null): AgingBucket[]` |
| `getAxisValues` | `backend/src/db-matrix-reports.ts` | `backend/src/routes/matrix-reports.ts` | `function getAxisValues(businessName: BusinessName, ledgerName: LedgerName): AxisValues` |
| `getBankAccounts` | `backend/src/db.ts` | `backend/src/routes/reports.ts` | `function getBankAccounts(business: BusinessName, ledger: LedgerName): BankAccountRow[]` |
| `getBusinesses` | `backend/src/db.ts` | `backend/src/routes/businesses.ts` | `function getBusinesses(): ` |
| `getCashFlowForecast` | `backend/src/db.ts` | `backend/src/routes/reports.ts` | `function getCashFlowForecast(business: BusinessName, ledger: LedgerName, asOfDate: string, horizonDays: number): CashFlowForecast` |
| `getChartOfAccounts` | `backend/src/db-reports.ts` | `backend/src/routes/reports.ts` | `function getChartOfAccounts(business: string): ChartRow[]` |
| `getConceptsWithAlternates` | `backend/src/db.ts` | `backend/src/routes/i18n.ts` | `function getConceptsWithAlternates(): ConceptWithAlternates[]` |
| `getCreditStatus` | `backend/src/db.ts` | `backend/src/routes/contacts.ts` | `function getCreditStatus(entityName: string): CreditStatus` |
| `getDimensionAncestorChain` | `backend/src/db.ts` | (none) | `function getDimensionAncestorChain(entityName: string, dimensionName: string): string[]` |
| `getDimensionLinksPointingAt` | `backend/src/db.ts` | `backend/src/routes/entities.ts` | `function getDimensionLinksPointingAt(targetName: string): ` |
| `getDivisions` | `backend/src/db.ts` | `backend/src/db-reports.ts`, `backend/src/db-seed.ts`, `backend/src/routes/divisions.ts` | `function getDivisions(): ` |
| `getEmployeeSchedule` | `backend/src/db.ts` | `backend/src/routes/locations.ts` | `function getEmployeeSchedule(employeeName: string): EmployeeScheduleLine[]` |
| `getExpiringStock` | `backend/src/db-stock.ts` | `backend/src/routes/stock-lots.ts` | `function getExpiringStock(asOfDate: string, withinDays: number): ExpiringLot[]` |
| `getInvoiceOutstandingMinor` | `backend/src/db.ts` | `backend/src/routes/invoices.ts` | `function getInvoiceOutstandingMinor(invoiceId: number): number` |
| `getItemByUpc` | `backend/src/db.ts` | `backend/src/routes/pos.ts` | `function getItemByUpc(upc: string): ItemSummary \| undefined` |
| `getItemLeadTimes` | `backend/src/db-stock.ts` | (none) | `function getItemLeadTimes(itemName: ItemName): ` |
| `getItemLocation` | `backend/src/db-stock.ts` | `backend/src/db.ts`, `backend/src/routes/locations.ts` | `function getItemLocation(itemName: ItemName, locationName: LocationName): ItemLocationLevels` |
| `getItemUnitCostMinor` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `function getItemUnitCostMinor(itemName: ItemName): number \| null` |
| `getLanguages` | `backend/src/db.ts` | `backend/src/db-seed.ts`, `backend/src/routes/i18n.ts` | `function getLanguages(): ` |
| `getLedgerBalancesByDivisionStructural` | `backend/src/db-reports.ts` | (none) | `function getLedgerBalancesByDivisionStructural(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, excludeCloseEntries = false): Map<number, Map<string \| null, number>>` |
| `getLedgerDateRange` | `backend/src/db-journal.ts` | `backend/src/routes/reports.ts` | `function getLedgerDateRange(businessName: BusinessName, ledgerName: LedgerName): LedgerDateRange` |
| `getLedgers` | `backend/src/db.ts` | `backend/src/routes/businesses.ts` | `function getLedgers(businessName: BusinessName): ` |
| `getLocalizedText` | `backend/src/db.ts` | `backend/src/invoice.ts`, `backend/src/routes/i18n.ts` | `function getLocalizedText(language: string, opts?: { businessName?: string; userId?: number }): Record<string, string>` |
| `getLocationCapacityStatus` | `backend/src/db-stock.ts` | (none) | `function getLocationCapacityStatus(locationName: LocationName): LocationCapacityStatus` |
| `getLocationOpenHours` | `backend/src/db.ts` | `backend/src/routes/locations.ts` | `function getLocationOpenHours(locationName: string): OpenHoursLine[]` |
| `getLocationTypes` | `backend/src/db-stock.ts` | `backend/src/routes/locations.ts` | `function getLocationTypes(): string[]` |
| `getMenuTree` | `backend/src/db.ts` | `backend/src/routes/menu.ts` | `function getMenuTree(opts?: { businessName?: string; userId?: number }): MenuSectionRow[]` |
| `getOpenShiftForEmployee` | `backend/src/db.ts` | (none) | `function getOpenShiftForEmployee(employeeName: string): PosShift \| undefined` |
| `getPickingList` | `backend/src/db.ts` | `backend/src/routes/invoices.ts` | `function getPickingList(invoiceId: number, locationName: LocationName): PickingListLine[]` |
| `getProfitAndLossByAxis` | `backend/src/db-matrix-reports.ts` | `backend/src/routes/matrix-reports.ts` | `function getProfitAndLossByAxis(businessName: BusinessName, ledgerName: LedgerName, fromDate: string \| undefined, toDate: string \| undefined, outerAxis: MatrixAxis, innerAxis: MatrixAxis, outerFilter?: string, innerFilter?: string): ProfitAndLossByAxisNode[]` |
| `getProfitAndLossByDivision` | `backend/src/db-reports.ts` | `backend/src/routes/reports.ts` | `function getProfitAndLossByDivision(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string): ProfitAndLossByDivision[]` |
| `getProfitAndLossByDivisionTree` | `backend/src/db-reports.ts` | `backend/src/routes/reports.ts` | `function getProfitAndLossByDivisionTree(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string): ProfitAndLossByDivisionNode[]` |
| `getSalesCogsMatrix` | `backend/src/db-matrix-reports.ts` | `backend/src/routes/matrix-reports.ts` | `function getSalesCogsMatrix(businessName: BusinessName, ledgerName: LedgerName, fromDate: string \| undefined, toDate: string \| undefined, rowAxis: MatrixAxis, colAxis: MatrixAxis): SalesCogsMatrix` |
| `getSalesReport` | `backend/src/db-reports.ts` | `backend/src/routes/reports.ts` | `function getSalesReport(business: BusinessName, ledger: LedgerName, fromDate?: string, toDate?: string): SalesReport` |
| `getScheduleAtLocation` | `backend/src/db.ts` | `backend/src/routes/locations.ts` | `function getScheduleAtLocation(locationName: string): LocationScheduleLine[]` |
| `getSessionUser` | `backend/src/auth.ts` | `backend/src/auth-middleware.ts` | `function getSessionUser(token: string \| undefined): AuthenticatedUser \| null` |
| `getStockMovementReport` | `backend/src/db-stock.ts` | `backend/src/routes/locations.ts` | `function getStockMovementReport(business: string, ledgerName: string, fromDate?: string, toDate?: string): StockMovementReport` |
| `getStockOnHandMatrix` | `backend/src/db-matrix-reports.ts` | `backend/src/routes/matrix-reports.ts` | `function getStockOnHandMatrix(rowAxis: MatrixAxis, colAxis: MatrixAxis): StockOnHandMatrix` |
| `getStockOutRiskReport` | `backend/src/db-stock.ts` | `backend/src/routes/locations.ts` | `function getStockOutRiskReport(windowDays: number = 2): StockOutRiskRow[]` |
| `getStockTake` | `backend/src/db-stock.ts` | `backend/src/routes/locations.ts` | `function getStockTake(id: number): StockTake \| undefined` |
| `getVocabularyAlternates` | `backend/src/db.ts` | `backend/src/routes/i18n.ts` | `function getVocabularyAlternates(wordName: string): string[]` |
| `hashPassword` | `backend/src/password.ts` | `backend/src/auth.ts`, `backend/src/db.ts` | `function hashPassword(password: string): string` |
| `listAddressTypes` | `backend/src/db.ts` | `backend/src/routes/contacts.ts` | `function listAddressTypes(): string[]` |
| `listContactPersonTypes` | `backend/src/db.ts` | `backend/src/routes/contacts.ts` | `function listContactPersonTypes(): string[]` |
| `listItemSources` | `backend/src/db.ts` | `backend/src/routes/items.ts` | `function listItemSources(itemName: string): ItemSource[]` |
| `listPendingCustomers` | `backend/src/db.ts` | `backend/src/routes/customer-registration.ts` | `function listPendingCustomers(): PendingCustomer[]` |
| `listPhoneTypes` | `backend/src/db.ts` | `backend/src/routes/contacts.ts` | `function listPhoneTypes(): string[]` |
| `listRoles` | `backend/src/auth.ts` | `backend/src/routes/auth.ts` | `function listRoles(): ` |
| `listUsers` | `backend/src/auth.ts` | `backend/src/routes/auth.ts` | `function listUsers(): UserSummary[]` |
| `logout` | `backend/src/auth.ts` | `backend/src/routes/auth.ts` | `function logout(token: string): void` |
| `parseUblInvoice` | `backend/src/db.ts` | (none) | `function parseUblInvoice(xml: string): UblImportResult` |
| `previewCloseBooks` | `backend/src/db-reports.ts` | `backend/src/routes/journal.ts` | `function previewCloseBooks(businessName: BusinessName, ledger: LedgerName, asOfDate: string, retainedEarningsAccount: string): CloseBooksPreview` |
| `recordReminderSent` | `backend/src/db.ts` | `backend/src/routes/invoices.ts` | `function recordReminderSent(customerName: string): number` |
| `registerBankAccount` | `backend/src/db.ts` | `backend/src/routes/reports.ts` | `function registerBankAccount(accountName: string, business: string, scopeName: string, overdraftLimitMinor: number \| null, userId: UserId): void` |
| `registerCustomer` | `backend/src/db.ts` | `backend/src/routes/customer-registration.ts` | `function registerCustomer(input: CustomerRegistrationInput, userId: UserId): void` |
| `requireAuth` | `backend/src/auth-middleware.ts` | `backend/src/routes/auth.ts`, `backend/src/routes/i18n.ts`, `backend/src/server.ts` | `function requireAuth(req: Request, res: Response, next: NextFunction): void` |
| `resetReminderLevel` | `backend/src/db.ts` | `backend/src/routes/invoices.ts` | `function resetReminderLevel(customerName: string): void` |
| `setEmployeeSchedule` | `backend/src/db.ts` | `backend/src/routes/locations.ts` | `function setEmployeeSchedule(employeeName: string, locationName: string, schedule: ScheduleLine[]): void` |
| `setItemLocationLevelDetails` | `backend/src/db-stock.ts` | `backend/src/routes/locations.ts` | `function setItemLocationLevelDetails(itemName: ItemName, locationName: LocationName, levels: Omit<ItemLocationLevels, 'quantity_on_hand'>, business?: BusinessName, ledger?: LedgerName, userId?: UserId): void` |
| `setItemLocationLevels` | `backend/src/db-stock.ts` | `backend/src/db-seed.ts`, `backend/src/routes/locations.ts` | `function setItemLocationLevels(itemName: ItemName, locationName: LocationName, levels: {     minLevel?: number \| null;     maxLevel?: number \| null;     reorderLevel?: number \| null;     shelfSide?: string \| null;     rack?: string \| null;     level?: number \| null;   }, business?: BusinessName, ledger?: LedgerName, userId?: UserId): void` |
| `setItemProduct` | `backend/src/db.ts` | `backend/src/routes/products.ts` | `function setItemProduct(itemName: string, productName: string \| null, userId: UserId): void` |
| `setItemSourceLeadTime` | `backend/src/db-stock.ts` | `backend/src/routes/locations.ts` | `function setItemSourceLeadTime(itemName: ItemName, vendorName: ProviderName, days: number, userId: UserId): void` |
| `setLocationOpenHours` | `backend/src/db.ts` | `backend/src/routes/locations.ts` | `function setLocationOpenHours(locationName: string, hours: OpenHoursLine[]): void` |
| `setMenuOverride` | `backend/src/db.ts` | `backend/src/primitives.ts`, `backend/src/routes/menu.ts` | `function setMenuOverride(menuItemKey: string, scope: 'business' \| 'user', scopeId: number, overrideLabel: string \| null, hidden: boolean, userId: UserId = asUserId(1)): void` |
| `setOwnDateFormat` | `backend/src/auth.ts` | `backend/src/routes/auth.ts` | `function setOwnDateFormat(userId: number, dateFormat: string): void` |
| `setOwnNumberFormat` | `backend/src/auth.ts` | `backend/src/routes/auth.ts` | `function setOwnNumberFormat(userId: number, numberFormat: string): void` |
| `setOwnPageSize` | `backend/src/auth.ts` | `backend/src/routes/auth.ts` | `function setOwnPageSize(userId: number, pageSize: number): void` |
| `setPosPin` | `backend/src/db.ts` | (none) | `function setPosPin(employeeName: string, pin: string): void` |
| `setUserActive` | `backend/src/auth.ts` | `backend/src/routes/auth.ts` | `function setUserActive(userId: number, active: boolean): void` |
| `setUserRoles` | `backend/src/auth.ts` | `backend/src/routes/auth.ts` | `function setUserRoles(userId: number, roleNames: string[]): void` |
| `setVocabularyPreference` | `backend/src/db.ts` | `backend/src/routes/i18n.ts` | `function setVocabularyPreference(conceptName: string, scope: 'business' \| 'user', scopeId: number, preferredAlternateName: string): void` |
| `signOff` | `backend/src/db.ts` | (none) | `function signOff(shiftId: number): void` |
| `signOn` | `backend/src/db.ts` | (none) | `function signOn(employeeName: string, locationName: string): PosShift` |
| `todayAtLocation` | `backend/src/db-stock.ts` | `backend/src/db.ts` | `function todayAtLocation(locationName: LocationName): string` |
| `unregisterBankAccount` | `backend/src/db.ts` | `backend/src/routes/reports.ts` | `function unregisterBankAccount(accountName: string, userId: UserId): void` |
| `verifyCustomer` | `backend/src/db.ts` | `backend/src/routes/customer-registration.ts` | `function verifyCustomer(customerName: string, approve: boolean): void` |
| `verifyPassword` | `backend/src/password.ts` | `backend/src/auth.ts`, `backend/src/db.ts` | `function verifyPassword(password: string, stored: string): boolean` |
| `verifyPosPin` | `backend/src/db.ts` | (none) | `function verifyPosPin(employeeName: string, pin: string): boolean` |

179 real, tracked baseline names reported (32 TypeDescriptor constants, 31 router constants, 116 functions, 0 other constants) out of 207 total names in the baseline file.
