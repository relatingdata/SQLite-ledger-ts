# Documentation Coverage Baseline — Structured Report

Generated directly by `scripts/documentation-baseline-report.ts` (run via `make documentation-baseline-report`). Reads the exact, same, real, tracked names from `docs/documentation-coverage-baseline.md` that `check-docs-coverage.ts` itself uses, then, for each real name still genuinely present in the live source, finds its own real file of definition, its own real, full declaration (a function's own, real, full parameter list and return type; a const's own, real, full initializing expression), and every other real, core backend file that genuinely, textually references it. Separated into real, distinct, alphabetical groups - never one, single, undifferentiated list - since these are genuinely different kinds of things: `typeXxxName` `TypeDescriptor` constants, `xxxRouter` Express router constants, and real, substantial, ordinary functions.

## TypeDescriptor Constants (34, alphabetical)

| Name | Defined in | Referenced in | Declaration |
|---|---|---|---|
| `typeAssetAccountName` | `backend/src/db.ts` | `backend/src/call-dispatch/businesses.ts` | `const typeAssetAccountName = { brand: 'AssetAccountName' };` |
| `typeBusinessContactsRootName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeBusinessContactsRootName = { brand: 'BusinessContactsRootName' };` |
| `typeBusinessItemsRootName` | `backend/src/db.ts` | (none) | `const typeBusinessItemsRootName = { brand: 'BusinessItemsRootName' };` |
| `typeBusinessLocationsRootName` | `backend/src/db.ts` | (none) | `const typeBusinessLocationsRootName = { brand: 'BusinessLocationsRootName' };` |
| `typeBusinessTypeName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeBusinessTypeName = { brand: 'BusinessTypeName' };` |
| `typeBusinessTypeQuestionName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeBusinessTypeQuestionName = { brand: 'BusinessTypeQuestionName' };` |
| `typeBusinessTypeQuestionsRootName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeBusinessTypeQuestionsRootName = { brand: 'BusinessTypeQuestionsRootName' };` |
| `typeChartOfAccountsNodeName` | `backend/src/db.ts` | (none) | `const typeChartOfAccountsNodeName = { brand: 'ChartOfAccountsNodeName' };` |
| `typeChartOfAccountsRootName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeChartOfAccountsRootName = { brand: 'ChartOfAccountsRootName' };` |
| `typeCustomerName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeCustomerName = { brand: 'CustomerName' };` |
| `typeDepartmentEntityName` | `backend/src/db.ts` | (none) | `const typeDepartmentEntityName = { brand: 'DepartmentEntityName' };` |
| `typeEmployeeName` | `backend/src/db.ts` | (none) | `const typeEmployeeName = { brand: 'EmployeeName' };` |
| `typeEntityLinkRecordName` | `backend/src/db.ts` | (none) | `const typeEntityLinkRecordName = { brand: 'EntityLinkRecordName' };` |
| `typeEquityAccountName` | `backend/src/db.ts` | `backend/src/call-dispatch/businesses.ts` | `const typeEquityAccountName = { brand: 'EquityAccountName' };` |
| `typeExpenseCategoryName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeExpenseCategoryName = { brand: 'ExpenseCategoryName' };` |
| `typeHiddenMarkerName` | `backend/src/db.ts` | (none) | `const typeHiddenMarkerName = { brand: 'HiddenMarkerName' };` |
| `typeIsBillingAddressMarkerName` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `const typeIsBillingAddressMarkerName = { brand: 'IsBillingAddressMarkerName' };` |
| `typeItemName` | `backend/src/db.ts` | (none) | `const typeItemName = { brand: 'ItemName' };` |
| `typeLedgerName` | `backend/src/db.ts` | (none) | `const typeLedgerName = { brand: 'LedgerName' };` |
| `typeLineTypeMarkerName` | `backend/src/db.ts` | (none) | `const typeLineTypeMarkerName = { brand: 'LineTypeMarkerName' };` |
| `typeLocationTypeMarkerName` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `const typeLocationTypeMarkerName = { brand: 'LocationTypeMarkerName' };` |
| `typeMenuLinkFlagName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeMenuLinkFlagName = { brand: 'MenuLinkFlagName' };` |
| `typeMenuLinkName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeMenuLinkName = { brand: 'MenuLinkName' };` |
| `typeMenuOverrideName` | `backend/src/db.ts` | (none) | `const typeMenuOverrideName = { brand: 'MenuOverrideName' };` |
| `typeMenuSectionName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeMenuSectionName = { brand: 'MenuSectionName' };` |
| `typeOpenHoursRecordName` | `backend/src/db.ts` | (none) | `const typeOpenHoursRecordName = { brand: 'OpenHoursRecordName' };` |
| `typeProjectTaskName` | `backend/src/db.ts` | (none) | `const typeProjectTaskName = { brand: 'ProjectTaskName' };` |
| `typeProviderName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeProviderName = { brand: 'ProviderName' };` |
| `typeRelationshipRecordName` | `backend/src/db.ts` | (none) | `const typeRelationshipRecordName = { brand: 'RelationshipRecordName' };` |
| `typeRootName` | `backend/src/db.ts` | `backend/src/auth-middleware.ts`, `backend/src/db-reports.ts`, `backend/src/db-seed.ts`, `backend/src/db-stock.ts` | `const typeRootName = { brand: 'RootName' };` |
| `typeScheduleRecordName` | `backend/src/db.ts` | (none) | `const typeScheduleRecordName = { brand: 'ScheduleRecordName' };` |
| `typeStorageOriginMarkerName` | `backend/src/db.ts` | (none) | `const typeStorageOriginMarkerName = { brand: 'StorageOriginMarkerName' };` |
| `typeTextDirectionMarkerName` | `backend/src/db.ts` | (none) | `const typeTextDirectionMarkerName = { brand: 'TextDirectionMarkerName' };` |
| `typeTranslationConceptName` | `backend/src/db.ts` | (none) | `const typeTranslationConceptName = { brand: 'TranslationConceptName' };` |

## Router Constants (1, alphabetical)

| Name | Defined in | Referenced in | Declaration |
|---|---|---|---|
| `recordingRouter` | `backend/src/routes/recording.ts` | `backend/src/recording.ts`, `backend/src/server.ts` | `const recordingRouter = Router();` |

## Functions (154, alphabetical)

| Name | Defined in | Referenced in | Declaration |
|---|---|---|---|
| `addOrUpdateItemSource` | `backend/src/db.ts` | `backend/src/call-dispatch/items.ts` | `function addOrUpdateItemSource(input: ItemSourceInput): void` |
| `addTaskDependency` | `backend/src/db.ts` | (none) | `function addTaskDependency(dependentTask: string, predecessorTask: string, dependencyType: 'finish_to_start' \| 'start_to_start' \| 'finish_to_finish' \| 'start_to_finish', userId: UserId): void` |
| `addTypedAddress` | `backend/src/db.ts` | `backend/src/call-dispatch/contacts.ts` | `function addTypedAddress(entityName: string, addressType: string, value: Partial<Contact>, userId: UserId): string` |
| `addTypedContactPerson` | `backend/src/db.ts` | `backend/src/call-dispatch/contacts.ts` | `function addTypedContactPerson(entityName: string, contactType: string, value: { name: string; phone?: string \| null; email?: string \| null }, userId: UserId): string` |
| `addTypedPhone` | `backend/src/db.ts` | `backend/src/call-dispatch/contacts.ts` | `function addTypedPhone(entityName: string, phoneType: string, number: string, userId: UserId, businessName?: string \| null): string` |
| `adjustLocationCapacity` | `backend/src/db-stock.ts` | (none) | `function adjustLocationCapacity(business: BusinessName, ledger: LedgerName, locationName: LocationName, itemName: ItemName, itemQuantityDelta: number, transdate: string, userId: UserId, referenceSuffix: string): void` |
| `asAccountName` | `backend/src/db.ts` | `backend/src/call-dispatch/journal.ts`, `backend/src/call-dispatch/locations.ts`, `backend/src/call-dispatch/pos.ts`, `backend/src/call-dispatch/projects.ts`, `backend/src/call-dispatch/stock-lots.ts`, `backend/src/db-journal.ts`, `backend/src/db-quotations.ts`, `backend/src/db-reports.ts`, `backend/src/db-stock.ts`, `backend/src/primitives.ts` | `function asAccountName(name: string): AccountName` |
| `asCustomerName` | `backend/src/db.ts` | `backend/src/call-dispatch/arap.ts`, `backend/src/call-dispatch/invoices.ts`, `backend/src/call-dispatch/pos.ts` | `function asCustomerName(name: string): CustomerName` |
| `asEmployeeName` | `backend/src/db.ts` | `backend/src/call-dispatch/projects.ts` | `function asEmployeeName(name: string): EmployeeName` |
| `asEntityId` | `backend/src/db.ts` | `backend/src/call-dispatch/entities.ts` | `function asEntityId(id: number): EntityId` |
| `asItemName` | `backend/src/db.ts` | `backend/src/call-dispatch/items.ts`, `backend/src/call-dispatch/locations.ts`, `backend/src/call-dispatch/pos.ts`, `backend/src/call-dispatch/stock-lots.ts`, `backend/src/db-journal.ts`, `backend/src/db-quotations.ts`, `backend/src/db-stock.ts` | `function asItemName(name: string): ItemName` |
| `asLocationName` | `backend/src/db.ts` | `backend/src/call-dispatch/invoices.ts`, `backend/src/call-dispatch/locations.ts`, `backend/src/call-dispatch/pos.ts`, `backend/src/db-journal.ts`, `backend/src/db-quotations.ts`, `backend/src/db-stock.ts` | `function asLocationName(name: string): LocationName` |
| `asProviderName` | `backend/src/db.ts` | `backend/src/call-dispatch/arap.ts`, `backend/src/call-dispatch/invoices.ts`, `backend/src/call-dispatch/locations.ts`, `backend/src/call-dispatch/pos.ts`, `backend/src/db-journal.ts` | `function asProviderName(name: string): ProviderName` |
| `asUserId` | `backend/src/db.ts` | `backend/src/call-dispatch/arap.ts`, `backend/src/call-dispatch/auth.ts`, `backend/src/call-dispatch/businesses.ts`, `backend/src/call-dispatch/contacts.ts`, `backend/src/call-dispatch/customer-registration.ts`, `backend/src/call-dispatch/departments.ts`, `backend/src/call-dispatch/entities.ts`, `backend/src/call-dispatch/hierarchy.ts`, `backend/src/call-dispatch/i18n.ts`, `backend/src/call-dispatch/invoices.ts`, `backend/src/call-dispatch/items.ts`, `backend/src/call-dispatch/journal.ts`, `backend/src/call-dispatch/locations.ts`, `backend/src/call-dispatch/period.ts`, `backend/src/call-dispatch/pos.ts`, `backend/src/call-dispatch/products.ts`, `backend/src/call-dispatch/projects.ts`, `backend/src/call-dispatch/quotations.ts`, `backend/src/call-dispatch/reports.ts`, `backend/src/call-dispatch/stock-lots.ts`, `backend/src/call-dispatch/stock.ts`, `backend/src/db-journal.ts`, `backend/src/db-seed.ts`, `backend/src/db-stock.ts` | `function asUserId(id: number): UserId` |
| `attachUser` | `backend/src/auth-middleware.ts` | `backend/src/recording.ts`, `backend/src/server.ts` | `function attachUser(req: Request, _res: Response, next: NextFunction): void` |
| `authenticateCustomer` | `backend/src/db.ts` | `backend/src/call-dispatch/customer-registration.ts` | `function authenticateCustomer(name: string, password: string): boolean` |
| `buildProfitAndLossFromBalances` | `backend/src/db-reports.ts` | `backend/src/db-matrix-reports.ts` | `function buildProfitAndLossFromBalances(business: string, balances: Map<number, number>): ProfitAndLoss` |
| `changeOwnPassword` | `backend/src/auth.ts` | `backend/src/call-dispatch/auth.ts` | `function changeOwnPassword(userId: number, currentPassword: string, newPassword: string): void` |
| `changePassword` | `backend/src/auth.ts` | `backend/src/call-dispatch/auth.ts` | `function changePassword(userId: number, newPassword: string): void` |
| `checkEInvoiceDiscrepancies` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `function checkEInvoiceDiscrepancies(parsed: UblImportResult, poReference?: string): EInvoiceDiscrepancy[]` |
| `countInvoices` | `backend/src/db.ts` | `backend/src/call-dispatch/invoices.ts` | `function countInvoices(business: BusinessName, ledger: LedgerName, invoiceType?: 'AR' \| 'AP', source: 'manual' \| 'pos' \| 'all' = 'manual'): number` |
| `countItems` | `backend/src/db.ts` | `backend/src/call-dispatch/items.ts` | `function countItems(businessName: BusinessName): number` |
| `createLocationType` | `backend/src/db-stock.ts` | `backend/src/call-dispatch/locations.ts`, `backend/src/server.ts` | `function createLocationType(name: string, userId: UserId): void` |
| `createPosTerminal` | `backend/src/db-stock.ts` | `backend/src/call-dispatch/pos.ts` | `function createPosTerminal(terminalName: string, locationName: LocationName, userId: UserId): void` |
| `createProduct` | `backend/src/db.ts` | `backend/src/call-dispatch/products.ts` | `function createProduct(name: string, parent: string, userId: UserId): void` |
| `createProjectTask` | `backend/src/db.ts` | (none) | `function createProjectTask(projectName: string, taskName: string, plannedStart: string, plannedEnd: string, userId: UserId): void` |
| `createSystemEntity` | `backend/src/db-stock.ts` | `backend/src/db-quotations.ts` | `function createSystemEntity(name: string, parentId: number \| null): number` |
| `createUser` | `backend/src/auth.ts` | `backend/src/call-dispatch/auth.ts` | `function createUser(username: string, password: string, roleNames: string[]): UserSummary` |
| `deleteBomComponent` | `backend/src/db.ts` | `backend/src/call-dispatch/items.ts` | `function deleteBomComponent(assemblyItem: string, componentItem: string, userId: UserId): void` |
| `deleteHierarchyParent` | `backend/src/db.ts` | `backend/src/call-dispatch/hierarchy.ts` | `function deleteHierarchyParent(entityName: string, hierarchyName: string, userId: UserId): void` |
| `deleteItemSource` | `backend/src/db.ts` | `backend/src/call-dispatch/items.ts` | `function deleteItemSource(id: number): void` |
| `deleteMenuOverride` | `backend/src/db.ts` | `backend/src/call-dispatch/menu.ts` | `function deleteMenuOverride(menuItemKey: string, scope: 'business' \| 'user', scopeId: number, userId: UserId = asUserId(1)): void` |
| `deleteTypedAddress` | `backend/src/db.ts` | `backend/src/call-dispatch/contacts.ts` | `function deleteTypedAddress(entityName: string, addressType: string, userId: UserId): void` |
| `deleteTypedContactPerson` | `backend/src/db.ts` | `backend/src/call-dispatch/contacts.ts` | `function deleteTypedContactPerson(entityName: string, contactType: string, userId: UserId): void` |
| `deleteTypedPhone` | `backend/src/db.ts` | `backend/src/call-dispatch/contacts.ts` | `function deleteTypedPhone(entityName: string, phoneType: string, userId: UserId): void` |
| `deleteVocabularyPreference` | `backend/src/db.ts` | `backend/src/call-dispatch/i18n.ts` | `function deleteVocabularyPreference(conceptName: string, scope: 'business' \| 'user', scopeId: number): void` |
| `dispatchOrderFromPickingList` | `backend/src/db.ts` | `backend/src/call-dispatch/invoices.ts` | `function dispatchOrderFromPickingList(invoiceId: number, locationName: LocationName, revenueAccount: string, taxAccount: string, userId: UserId): void` |
| `ensureAddressType` | `backend/src/db.ts` | (none) | `function ensureAddressType(typeName: string, userId: UserId): void` |
| `ensureContactPersonType` | `backend/src/db.ts` | (none) | `function ensureContactPersonType(typeName: string, userId: UserId): void` |
| `ensureCurrencyPair` | `backend/src/db.ts` | (none) | `function ensureCurrencyPair(businessName: BusinessName, fromCurrency: string, toCurrency: string, userId: UserId): ` |
| `ensureItemTier` | `backend/src/db.ts` | (none) | `function ensureItemTier(baseProductName: ItemName, tier: string, userId: UserId, business?: BusinessName): ` |
| `ensureLocationCapacityAccount` | `backend/src/db-stock.ts` | `backend/src/db-journal.ts`, `backend/src/db.ts` | `function ensureLocationCapacityAccount(business: BusinessName, ledger: LedgerName, locationName: LocationName, userId: UserId): ` |
| `ensureLocationStorageRoot` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `function ensureLocationStorageRoot(business: BusinessName, locationName: string, userId: UserId): ` |
| `ensurePhoneType` | `backend/src/db.ts` | (none) | `function ensurePhoneType(typeName: string, userId: UserId): void` |
| `ensureStorageCapacityStructure` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `function ensureStorageCapacityStructure(parentEntity: { id: number; name: string }, userId: UserId): ` |
| `exportInvoiceAsUbl` | `backend/src/db.ts` | `backend/src/call-dispatch/invoices.ts` | `function exportInvoiceAsUbl(invoiceId: number): string` |
| `getAccountsPostedTo` | `backend/src/db.ts` | (none) | `function getAccountsPostedTo(reference: string): string[]` |
| `getActiveShiftsAtLocation` | `backend/src/db.ts` | (none) | `function getActiveShiftsAtLocation(locationName: string): PosShift[]` |
| `getAgingBuckets` | `backend/src/db.ts` | (none) | `function getAgingBuckets(paymentTermsDays: number \| null): AgingBucket[]` |
| `getAxisValues` | `backend/src/db-matrix-reports.ts` | `backend/src/call-dispatch/matrix-reports.ts` | `function getAxisValues(businessName: BusinessName, ledgerName: LedgerName): AxisValues` |
| `getBankAccounts` | `backend/src/db.ts` | `backend/src/call-dispatch/reports.ts` | `function getBankAccounts(business: BusinessName, ledger: LedgerName): BankAccountRow[]` |
| `getBomComponents` | `backend/src/db.ts` | `backend/src/call-dispatch/items.ts` | `function getBomComponents(assemblyItem: string): ` |
| `getBusinesses` | `backend/src/db.ts` | `backend/src/call-dispatch/businesses.ts` | `function getBusinesses(): ` |
| `getBusinessHomeCurrency` | `backend/src/db.ts` | `backend/src/db-reports.ts` | `function getBusinessHomeCurrency(businessName: string): string \| null` |
| `getBusinessProductShapes` | `backend/src/db.ts` | `backend/src/call-dispatch/hierarchy.ts` | `function getBusinessProductShapes(businessName: BusinessName): [string, string][][]` |
| `getBusinessTypes` | `backend/src/db.ts` | `backend/src/call-dispatch/businesses.ts` | `function getBusinessTypes(): BusinessTypeInfo[]` |
| `getCashFlowForecast` | `backend/src/db.ts` | `backend/src/call-dispatch/reports.ts` | `function getCashFlowForecast(business: BusinessName, ledger: LedgerName, asOfDate: string, horizonDays: number): CashFlowForecast` |
| `getChartOfAccounts` | `backend/src/db-reports.ts` | `backend/src/call-dispatch/reports.ts` | `function getChartOfAccounts(business: string): ChartRow[]` |
| `getChartOfAccountsPrototype` | `backend/src/db.ts` | `backend/src/call-dispatch/businesses.ts` | `function getChartOfAccountsPrototype(language: string): string[]` |
| `getConceptsWithAlternates` | `backend/src/db.ts` | `backend/src/call-dispatch/i18n.ts` | `function getConceptsWithAlternates(): ConceptWithAlternates[]` |
| `getCounterpartyHistory` | `backend/src/db.ts` | `backend/src/call-dispatch/invoices.ts` | `function getCounterpartyHistory(business: BusinessName, ledger: LedgerName, counterpartyName: string): HistoryLine[]` |
| `getCreditStatus` | `backend/src/db.ts` | `backend/src/call-dispatch/contacts.ts` | `function getCreditStatus(entityName: string): CreditStatus` |
| `getCurrencyExchangeRate` | `backend/src/db.ts` | (none) | `function getCurrencyExchangeRate(businessName: BusinessName, fromCurrency: string, toCurrency: string, side: 'buy' \| 'sell'): number \| null` |
| `getEmployeeSchedule` | `backend/src/db.ts` | `backend/src/call-dispatch/locations.ts` | `function getEmployeeSchedule(employeeName: string): EmployeeScheduleLine[]` |
| `getEntitiesWithLink` | `backend/src/db.ts` | (none) | `function getEntitiesWithLink(linkType: string): ` |
| `getExpiringStock` | `backend/src/db-stock.ts` | `backend/src/call-dispatch/stock-lots.ts` | `function getExpiringStock(asOfDate: string, withinDays: number): ExpiringLot[]` |
| `getHierarchyAncestorChain` | `backend/src/db.ts` | (none) | `function getHierarchyAncestorChain(entityName: string, hierarchyName: string): string[]` |
| `getHierarchyChain` | `backend/src/db.ts` | (none) | `function getHierarchyChain(leafName: ItemName \| LocationName): HierarchyChainNode[]` |
| `getHierarchyLinksPointingAt` | `backend/src/db.ts` | `backend/src/call-dispatch/entities.ts` | `function getHierarchyLinksPointingAt(targetName: string): ` |
| `getInvoiceLine` | `backend/src/db.ts` | `backend/src/invoice.ts` | `function getInvoiceLine(reference: string, business: BusinessName, ledger: LedgerName): InvoiceLine \| undefined` |
| `getInvoiceOutstandingMinor` | `backend/src/db.ts` | `backend/src/call-dispatch/invoices.ts` | `function getInvoiceOutstandingMinor(invoiceId: number): number` |
| `getItemByUpc` | `backend/src/db.ts` | `backend/src/call-dispatch/pos.ts` | `function getItemByUpc(upc: string): ItemSummary \| undefined` |
| `getItemLeadTimes` | `backend/src/db-stock.ts` | (none) | `function getItemLeadTimes(itemName: ItemName): ` |
| `getItemLocation` | `backend/src/db-stock.ts` | `backend/src/call-dispatch/locations.ts`, `backend/src/db.ts` | `function getItemLocation(itemName: ItemName, locationName: LocationName): ItemLocationLevels` |
| `getItemUnitCostMinor` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `function getItemUnitCostMinor(itemName: ItemName): number \| null` |
| `getLanguages` | `backend/src/db.ts` | `backend/src/call-dispatch/i18n.ts` | `function getLanguages(): ` |
| `getLedgerBalancesByLocationStructural` | `backend/src/db-reports.ts` | (none) | `function getLedgerBalancesByLocationStructural(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, excludeCloseEntries = false): Map<number, Map<string \| null, number>>` |
| `getLedgerDateRange` | `backend/src/db-journal.ts` | `backend/src/call-dispatch/reports.ts` | `function getLedgerDateRange(businessName: BusinessName, ledgerName: LedgerName): LedgerDateRange` |
| `getLedgers` | `backend/src/db.ts` | `backend/src/call-dispatch/businesses.ts` | `function getLedgers(businessName: BusinessName): ` |
| `getLocalizedText` | `backend/src/db.ts` | `backend/src/call-dispatch/businesses.ts`, `backend/src/call-dispatch/i18n.ts`, `backend/src/call-dispatch.ts`, `backend/src/invoice.ts` | `function getLocalizedText(language: string, opts?: { businessName?: string; userId?: number }): Record<string, string>` |
| `getLocationCapacityStatus` | `backend/src/db-stock.ts` | (none) | `function getLocationCapacityStatus(locationName: LocationName): LocationCapacityStatus` |
| `getLocationOpenHours` | `backend/src/db.ts` | `backend/src/call-dispatch/locations.ts` | `function getLocationOpenHours(locationName: string): OpenHoursLine[]` |
| `getLocationTypes` | `backend/src/db-stock.ts` | `backend/src/call-dispatch/locations.ts`, `backend/src/server.ts` | `function getLocationTypes(): string[]` |
| `getMenuTree` | `backend/src/db.ts` | `backend/src/call-dispatch/menu.ts`, `backend/src/db-seed.ts` | `function getMenuTree(opts?: { businessName?: string; userId?: number }): MenuSectionRow[]` |
| `getOpenShiftForEmployee` | `backend/src/db.ts` | (none) | `function getOpenShiftForEmployee(employeeName: string): PosShift \| undefined` |
| `getPickingList` | `backend/src/db.ts` | `backend/src/call-dispatch/invoices.ts` | `function getPickingList(invoiceId: number, locationName: LocationName): PickingListLine[]` |
| `getProfitAndLossByAxis` | `backend/src/db-matrix-reports.ts` | `backend/src/call-dispatch/matrix-reports.ts`, `backend/src/call-dispatch/reports.ts`, `backend/src/call-dispatch.ts`, `backend/src/server.ts` | `function getProfitAndLossByAxis(businessName: BusinessName, ledgerName: LedgerName, fromDate: string \| undefined, toDate: string \| undefined, outerAxis: MatrixAxis, innerAxis: MatrixAxis, outerFilter?: string, innerFilter?: string): ProfitAndLossByAxisNode[]` |
| `getProjectTasks` | `backend/src/db.ts` | (none) | `function getProjectTasks(projectName: string): ` |
| `getReminderCandidates` | `backend/src/db.ts` | `backend/src/call-dispatch/invoices.ts` | `function getReminderCandidates(business: BusinessName, ledger: LedgerName, asOfDate: string): ReminderCandidate[]` |
| `getSalesCogsMatrix` | `backend/src/db-matrix-reports.ts` | `backend/src/call-dispatch/matrix-reports.ts` | `function getSalesCogsMatrix(businessName: BusinessName, ledgerName: LedgerName, fromDate: string \| undefined, toDate: string \| undefined, rowAxis: MatrixAxis, colAxis: MatrixAxis): SalesCogsMatrix` |
| `getSalesReport` | `backend/src/db-reports.ts` | `backend/src/call-dispatch/reports.ts` | `function getSalesReport(business: BusinessName, ledger: LedgerName, fromDate?: string, toDate?: string): SalesReport` |
| `getScheduleAtLocation` | `backend/src/db.ts` | `backend/src/call-dispatch/locations.ts` | `function getScheduleAtLocation(locationName: string): LocationScheduleLine[]` |
| `getSessionUser` | `backend/src/auth.ts` | `backend/src/auth-middleware.ts` | `function getSessionUser(token: string \| undefined): AuthenticatedUser \| null` |
| `getStockMovementReport` | `backend/src/db-stock.ts` | `backend/src/call-dispatch/locations.ts` | `function getStockMovementReport(business: string, ledgerName: string, fromDate?: string, toDate?: string, hierarchyName?: string): StockMovementReport` |
| `getStockOnHandMatrix` | `backend/src/db-matrix-reports.ts` | `backend/src/call-dispatch/matrix-reports.ts`, `backend/src/db-stock.ts` | `function getStockOnHandMatrix(rowAxis: MatrixAxis, colAxis: MatrixAxis): StockOnHandMatrix` |
| `getStockOutRiskReport` | `backend/src/db-stock.ts` | `backend/src/call-dispatch/locations.ts` | `function getStockOutRiskReport(windowDays: number = 2): StockOutRiskRow[]` |
| `getStockTake` | `backend/src/db-stock.ts` | `backend/src/call-dispatch/locations.ts` | `function getStockTake(id: number): StockTake \| undefined` |
| `getTaskDependencies` | `backend/src/db.ts` | (none) | `function getTaskDependencies(dependentTask: string): ` |
| `getTypedContactPersons` | `backend/src/db.ts` | `backend/src/call-dispatch/contacts.ts` | `function getTypedContactPersons(entityName: string): ContactPerson[]` |
| `getVocabularyAlternates` | `backend/src/db.ts` | `backend/src/call-dispatch/i18n.ts` | `function getVocabularyAlternates(wordName: string): string[]` |
| `hashPassword` | `backend/src/password.ts` | `backend/src/auth.ts`, `backend/src/db.ts` | `function hashPassword(password: string): string` |
| `isGenuineCategoryOrItemsRoot` | `backend/src/db.ts` | (none) | `function isGenuineCategoryOrItemsRoot(name: string): boolean` |
| `isRecording` | `backend/src/recording.ts` | `backend/src/routes/recording.ts` | `function isRecording(userId: number): boolean` |
| `listAddressTypes` | `backend/src/db.ts` | `backend/src/call-dispatch/contacts.ts` | `function listAddressTypes(): string[]` |
| `listContactPersonTypes` | `backend/src/db.ts` | `backend/src/call-dispatch/contacts.ts` | `function listContactPersonTypes(): string[]` |
| `listCurrencyPairs` | `backend/src/db.ts` | (none) | `function listCurrencyPairs(currencies: string[]): ` |
| `listInvoices` | `backend/src/db.ts` | `backend/src/call-dispatch/invoices.ts` | `function listInvoices(business: BusinessName, ledger: LedgerName, options: ListInvoicesOptions = {}): Invoice[]` |
| `listItemSources` | `backend/src/db.ts` | `backend/src/call-dispatch/items.ts` | `function listItemSources(itemName: string): ItemSource[]` |
| `listLineTypes` | `backend/src/db.ts` | `backend/src/call-dispatch/entities.ts` | `function listLineTypes(): string[]` |
| `listPendingCustomers` | `backend/src/db.ts` | `backend/src/call-dispatch/customer-registration.ts` | `function listPendingCustomers(): PendingCustomer[]` |
| `listPhoneTypes` | `backend/src/db.ts` | `backend/src/call-dispatch/contacts.ts` | `function listPhoneTypes(): string[]` |
| `listRoles` | `backend/src/auth.ts` | `backend/src/call-dispatch/auth.ts` | `function listRoles(): ` |
| `listUsers` | `backend/src/auth.ts` | `backend/src/call-dispatch/auth.ts` | `function listUsers(): UserSummary[]` |
| `logout` | `backend/src/auth.ts` | `backend/src/call-dispatch/auth.ts`, `backend/src/call-dispatch.ts` | `function logout(token: string): void` |
| `parseUblInvoice` | `backend/src/db.ts` | (none) | `function parseUblInvoice(xml: string): UblImportResult` |
| `postBomComponents` | `backend/src/db.ts` | `backend/src/call-dispatch/items.ts` | `function postBomComponents(assemblyItem: string, business: string, userId: UserId): void` |
| `previewCloseBooks` | `backend/src/db-reports.ts` | `backend/src/call-dispatch/journal.ts`, `backend/src/call-dispatch/locations.ts`, `backend/src/call-dispatch.ts` | `function previewCloseBooks(businessName: BusinessName, ledger: LedgerName, asOfDate: string, retainedEarningsAccount: string, hierarchyPath: string[] = []): CloseBooksPreview` |
| `recordingMiddleware` | `backend/src/recording.ts` | `backend/src/server.ts` | `function recordingMiddleware(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction): void` |
| `recordReminderSent` | `backend/src/db.ts` | `backend/src/call-dispatch/invoices.ts` | `function recordReminderSent(customerName: string): number` |
| `recordStockTakeCount` | `backend/src/db-stock.ts` | `backend/src/call-dispatch/locations.ts` | `function recordStockTakeCount(stockTakeId: number, itemName: ItemName, countedQuantity: number): void` |
| `registerBankAccount` | `backend/src/db.ts` | `backend/src/call-dispatch/reports.ts` | `function registerBankAccount(accountName: string, business: string, scopeName: string, overdraftLimitMinor: number \| null, userId: UserId): void` |
| `registerCustomer` | `backend/src/db.ts` | `backend/src/call-dispatch/customer-registration.ts` | `function registerCustomer(input: CustomerRegistrationInput, userId: UserId): void` |
| `requireAuth` | `backend/src/auth-middleware.ts` | `backend/src/call-dispatch/arap.ts`, `backend/src/call-dispatch/auth.ts`, `backend/src/call-dispatch/businesses.ts`, `backend/src/call-dispatch/contacts.ts`, `backend/src/call-dispatch/customer-registration.ts`, `backend/src/call-dispatch/departments.ts`, `backend/src/call-dispatch/entities.ts`, `backend/src/call-dispatch/hierarchy.ts`, `backend/src/call-dispatch/i18n.ts`, `backend/src/call-dispatch/invoices.ts`, `backend/src/call-dispatch/items.ts`, `backend/src/call-dispatch/journal.ts`, `backend/src/call-dispatch/locations.ts`, `backend/src/call-dispatch/matrix-reports.ts`, `backend/src/call-dispatch/pos.ts`, `backend/src/call-dispatch/projects.ts`, `backend/src/call-dispatch/quotations.ts`, `backend/src/call-dispatch/reports.ts`, `backend/src/call-dispatch/stock-lots.ts`, `backend/src/call-dispatch/stock.ts`, `backend/src/call-dispatch.ts`, `backend/src/server.ts` | `function requireAuth(req: Request, res: Response, next: NextFunction): void` |
| `resetReminderLevel` | `backend/src/db.ts` | `backend/src/call-dispatch/invoices.ts` | `function resetReminderLevel(customerName: string): void` |
| `resolveDispatchLocation` | `backend/src/db.ts` | `backend/src/call-dispatch/pos.ts` | `function resolveDispatchLocation(itemName: ItemName, logicalLocationName: LocationName): LocationName` |
| `resolveItemId` | `backend/src/db.ts` | `backend/src/db-stock.ts`, `backend/src/drivers/sql-entity-driver.ts`, `backend/src/entity-driver.ts` | `function resolveItemId(itemName: ItemName): number \| undefined` |
| `saveBusinessTypeAnswers` | `backend/src/db.ts` | `backend/src/call-dispatch/businesses.ts` | `function saveBusinessTypeAnswers(businessName: BusinessName, answers: Record<string, string>, userId: UserId): void` |
| `seedRemainingData` | `backend/src/db-seed.ts` | `backend/src/db.ts` | `function seedRemainingData(): void` |
| `setEmployeeSchedule` | `backend/src/db.ts` | `backend/src/call-dispatch/locations.ts` | `function setEmployeeSchedule(employeeName: string, locationName: string, schedule: ScheduleLine[]): void` |
| `setItemLocationLevelDetails` | `backend/src/db-stock.ts` | (none) | `function setItemLocationLevelDetails(itemName: ItemName, locationName: LocationName, levels: Omit<ItemLocationLevels, 'quantity_on_hand'>, business?: BusinessName, ledger?: LedgerName, userId?: UserId): void` |
| `setItemLocationLevels` | `backend/src/db-stock.ts` | `backend/src/call-dispatch/locations.ts` | `function setItemLocationLevels(itemName: ItemName, locationName: LocationName, levels: {     minLevel?: number \| null;     maxLevel?: number \| null;     reorderLevel?: number \| null;     shelfSide?: string \| null;     rack?: string \| null;     level?: number \| null;   }, business?: BusinessName, ledger?: LedgerName, userId?: UserId): void` |
| `setItemProduct` | `backend/src/db.ts` | `backend/src/call-dispatch/products.ts` | `function setItemProduct(itemName: string, productName: string \| null, userId: UserId): void` |
| `setItemSourceLeadTime` | `backend/src/db-stock.ts` | `backend/src/call-dispatch/locations.ts` | `function setItemSourceLeadTime(itemName: ItemName, vendorName: ProviderName, days: number, userId: UserId): void` |
| `setLineType` | `backend/src/db.ts` | `backend/src/call-dispatch/entities.ts` | `function setLineType(entityName: string, lineType: string \| null, userId: UserId): void` |
| `setLocationOpenHours` | `backend/src/db.ts` | `backend/src/call-dispatch/locations.ts` | `function setLocationOpenHours(locationName: string, hours: OpenHoursLine[]): void` |
| `setMenuOverride` | `backend/src/db.ts` | `backend/src/call-dispatch/menu.ts` | `function setMenuOverride(menuItemKey: string, scope: 'business' \| 'user', scopeId: number, overrideLabel: string \| null, hidden: boolean, userId: UserId = asUserId(1)): void` |
| `setOwnDateFormat` | `backend/src/auth.ts` | `backend/src/call-dispatch/auth.ts` | `function setOwnDateFormat(userId: number, dateFormat: string): void` |
| `setOwnNumberFormat` | `backend/src/auth.ts` | `backend/src/call-dispatch/auth.ts` | `function setOwnNumberFormat(userId: number, numberFormat: string): void` |
| `setOwnPageSize` | `backend/src/auth.ts` | `backend/src/call-dispatch/auth.ts` | `function setOwnPageSize(userId: number, pageSize: number): void` |
| `setPosPin` | `backend/src/db.ts` | (none) | `function setPosPin(employeeName: string, pin: string): void` |
| `setTerminalCurrency` | `backend/src/db-stock.ts` | `backend/src/call-dispatch/pos.ts` | `function setTerminalCurrency(terminalName: string, currency: string \| null): void` |
| `setUserActive` | `backend/src/auth.ts` | `backend/src/call-dispatch/auth.ts` | `function setUserActive(userId: number, active: boolean): void` |
| `setUserRoles` | `backend/src/auth.ts` | `backend/src/call-dispatch/auth.ts` | `function setUserRoles(userId: number, roleNames: string[]): void` |
| `setVocabularyPreference` | `backend/src/db.ts` | `backend/src/call-dispatch/i18n.ts` | `function setVocabularyPreference(conceptName: string, scope: 'business' \| 'user', scopeId: number, preferredAlternateName: string): void` |
| `signOff` | `backend/src/db.ts` | (none) | `function signOff(shiftId: number): void` |
| `signOn` | `backend/src/db.ts` | (none) | `function signOn(employeeName: string, locationName: string): PosShift` |
| `stageBomComponent` | `backend/src/db.ts` | `backend/src/call-dispatch/items.ts` | `function stageBomComponent(input: {   assemblyItem: string; business: string; componentItem: string; quantity: number; unit: string; }): void` |
| `startRecording` | `backend/src/recording.ts` | `backend/src/routes/recording.ts` | `function startRecording(userId: number, username: string): void` |
| `stopRecording` | `backend/src/recording.ts` | `backend/src/routes/recording.ts` | `function stopRecording(userId: number): Promise<void>` |
| `todayAtLocation` | `backend/src/db-stock.ts` | `backend/src/db.ts` | `function todayAtLocation(locationName: LocationName): string` |
| `unregisterBankAccount` | `backend/src/db.ts` | `backend/src/call-dispatch/reports.ts` | `function unregisterBankAccount(accountName: string, userId: UserId): void` |
| `verifyCustomer` | `backend/src/db.ts` | `backend/src/call-dispatch/customer-registration.ts` | `function verifyCustomer(customerName: string, approve: boolean): void` |
| `verifyPassword` | `backend/src/password.ts` | `backend/src/auth.ts`, `backend/src/db.ts` | `function verifyPassword(password: string, stored: string): boolean` |
| `verifyPosPin` | `backend/src/db.ts` | (none) | `function verifyPosPin(employeeName: string, pin: string): boolean` |

## Other Constants (1, alphabetical)

| Name | Defined in | Referenced in | Declaration |
|---|---|---|---|
| `BUSINESS_ADMIN_ROLE` | `backend/src/auth.ts` | (none) | `const BUSINESS_ADMIN_ROLE = 'Business Admin';` |

190 real, tracked baseline names reported (34 TypeDescriptor constants, 1 router constants, 154 functions, 1 other constants) out of 287 total names in the baseline file.
