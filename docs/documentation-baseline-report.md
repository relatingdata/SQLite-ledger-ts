# Documentation Coverage Baseline — Structured Report

Generated directly by `scripts/documentation-baseline-report.ts` (run via `make documentation-baseline-report`). Reads the exact, same, real, tracked names from `docs/documentation-coverage-baseline.md` that `check-docs-coverage.ts` itself uses, then, for each real name still genuinely present in the live source, finds its own real file of definition, its own real, full declaration (a function's own, real, full parameter list and return type; a const's own, real, full initializing expression), and every other real, core backend file that genuinely, textually references it. Separated into real, distinct, alphabetical groups - never one, single, undifferentiated list - since these are genuinely different kinds of things: `typeXxxName` `TypeDescriptor` constants, `xxxRouter` Express router constants, and real, substantial, ordinary functions.

## TypeDescriptor Constants (41, alphabetical)

| Name | Defined in | Referenced in | Declaration |
|---|---|---|---|
| `typeAssetAccountName` | `backend/src/db.ts` | `backend/src/call-dispatch/businesses.ts` | `const typeAssetAccountName = { brand: 'AssetAccountName' };` |
| `typeBusinessContactsRootName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeBusinessContactsRootName = { brand: 'BusinessContactsRootName' };` |
| `typeBusinessItemsRootName` | `backend/src/db.ts` | (none) | `const typeBusinessItemsRootName = { brand: 'BusinessItemsRootName' };` |
| `typeBusinessLiveProjectsRootName` | `backend/src/db.ts` | `backend/src/db-projects.ts`, `backend/src/db-quotations.ts` | `const typeBusinessLiveProjectsRootName = { brand: 'BusinessLiveProjectsRootName' };` |
| `typeBusinessLocationsRootName` | `backend/src/db.ts` | (none) | `const typeBusinessLocationsRootName = { brand: 'BusinessLocationsRootName' };` |
| `typeBusinessPlantRootName` | `backend/src/db.ts` | (none) | `const typeBusinessPlantRootName = { brand: 'BusinessPlantRootName' };` |
| `typeBusinessPrototypeRootName` | `backend/src/db.ts` | `backend/src/db-prototypes.ts` | `const typeBusinessPrototypeRootName = { brand: 'BusinessPrototypeRootName' };` |
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
| `typeLiveProjectName` | `backend/src/db.ts` | `backend/src/db-projects.ts` | `const typeLiveProjectName = { brand: 'LiveProjectName' };` |
| `typeLocationTypeMarkerName` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `const typeLocationTypeMarkerName = { brand: 'LocationTypeMarkerName' };` |
| `typeMenuLinkFlagName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeMenuLinkFlagName = { brand: 'MenuLinkFlagName' };` |
| `typeMenuLinkName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeMenuLinkName = { brand: 'MenuLinkName' };` |
| `typeMenuOverrideName` | `backend/src/db.ts` | (none) | `const typeMenuOverrideName = { brand: 'MenuOverrideName' };` |
| `typeMenuSectionName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeMenuSectionName = { brand: 'MenuSectionName' };` |
| `typeMilestoneName` | `backend/src/db.ts` | `backend/src/db-projects.ts` | `const typeMilestoneName = { brand: 'MilestoneName' };` |
| `typeOpenHoursRecordName` | `backend/src/db.ts` | (none) | `const typeOpenHoursRecordName = { brand: 'OpenHoursRecordName' };` |
| `typePlantItemName` | `backend/src/db.ts` | (none) | `const typePlantItemName = { brand: 'PlantItemName' };` |
| `typeProjectTaskName` | `backend/src/db.ts` | (none) | `const typeProjectTaskName = { brand: 'ProjectTaskName' };` |
| `typePrototypeName` | `backend/src/db.ts` | `backend/src/db-prototypes.ts` | `const typePrototypeName = { brand: 'PrototypeName' };` |
| `typeProviderName` | `backend/src/db.ts` | `backend/src/db-seed.ts` | `const typeProviderName = { brand: 'ProviderName' };` |
| `typeRelationshipRecordName` | `backend/src/db.ts` | (none) | `const typeRelationshipRecordName = { brand: 'RelationshipRecordName' };` |
| `typeRootName` | `backend/src/db.ts` | `backend/src/auth-middleware.ts`, `backend/src/db-projects.ts`, `backend/src/db-prototypes.ts`, `backend/src/db-reports.ts`, `backend/src/db-seed.ts`, `backend/src/db-stock.ts` | `const typeRootName = { brand: 'RootName' };` |
| `typeScheduleRecordName` | `backend/src/db.ts` | (none) | `const typeScheduleRecordName = { brand: 'ScheduleRecordName' };` |
| `typeStorageOriginMarkerName` | `backend/src/db.ts` | (none) | `const typeStorageOriginMarkerName = { brand: 'StorageOriginMarkerName' };` |
| `typeTextDirectionMarkerName` | `backend/src/db.ts` | (none) | `const typeTextDirectionMarkerName = { brand: 'TextDirectionMarkerName' };` |
| `typeTranslationConceptName` | `backend/src/db.ts` | (none) | `const typeTranslationConceptName = { brand: 'TranslationConceptName' };` |

## Router Constants (2, alphabetical)

| Name | Defined in | Referenced in | Declaration |
|---|---|---|---|
| `callRouter` | `backend/src/routes/call.ts` | `backend/src/server.ts` | `const callRouter = Router();` |
| `recordingRouter` | `backend/src/routes/recording.ts` | `backend/src/recording.ts`, `backend/src/server.ts` | `const recordingRouter = Router();` |

## Functions (198, alphabetical)

| Name | Defined in | Referenced in | Declaration |
|---|---|---|---|
| `addOrUpdateItemSource` | `backend/src/db.ts` | `backend/src/call-dispatch/items.ts` | `function addOrUpdateItemSource(input: ItemSourceInput): void` |
| `addPrototypeLine` | `backend/src/db-prototypes.ts` | `backend/src/call-dispatch/prototypes.ts` | `function addPrototypeLine(prototypeName: string, business: BusinessName, kind: BomLineKind, resourceOrItemName: string, quantity: number, unit: string, priceMinor: number, userId: UserId, durationHours?: number, scheduledStart?: string): void` |
| `addQuotationLine` | `backend/src/db-quotations.ts` | `backend/src/call-dispatch/prototypes.ts`, `backend/src/call-dispatch/quotations.ts`, `backend/src/db-prototypes.ts`, `backend/src/db.ts` | `function addQuotationLine(reference: string, kind: BomLineKind, resourceOrItemName: string, quantity: number, unit: string, priceMinor: number, userId: UserId, durationHours?: number, scheduledStart?: string): void` |
| `addTaskDependency` | `backend/src/db.ts` | (none) | `function addTaskDependency(dependentTask: string, predecessorTask: string, dependencyType: 'finish_to_start' \| 'start_to_start' \| 'finish_to_finish' \| 'start_to_finish', userId: UserId): void` |
| `addTypedAddress` | `backend/src/db.ts` | `backend/src/call-dispatch/contacts.ts` | `function addTypedAddress(entityName: string, addressType: string, value: Partial<Contact>, userId: UserId): string` |
| `addTypedContactPerson` | `backend/src/db.ts` | `backend/src/call-dispatch/contacts.ts` | `function addTypedContactPerson(entityName: string, contactType: string, value: { name: string; phone?: string \| null; email?: string \| null }, userId: UserId): string` |
| `addTypedPhone` | `backend/src/db.ts` | `backend/src/call-dispatch/contacts.ts` | `function addTypedPhone(entityName: string, phoneType: string, number: string, userId: UserId, businessName?: string \| null): string` |
| `adjustLocationCapacity` | `backend/src/db-stock.ts` | (none) | `function adjustLocationCapacity(business: BusinessName, ledger: LedgerName, locationName: LocationName, itemName: ItemName, itemQuantityDelta: number, transdate: string, userId: UserId, referenceSuffix: string): void` |
| `allQtyLocationAccounts` | `backend/src/db-stock.ts` | `backend/src/db-matrix-reports.ts` | `function allQtyLocationAccounts(): QtyLocationAccountRow[]` |
| `asAccountName` | `backend/src/db.ts` | `backend/src/call-dispatch/journal.ts`, `backend/src/call-dispatch/locations.ts`, `backend/src/call-dispatch/plant.ts`, `backend/src/call-dispatch/pos.ts`, `backend/src/call-dispatch/projects.ts`, `backend/src/call-dispatch/stock-lots.ts`, `backend/src/db-journal.ts`, `backend/src/db-projects.ts`, `backend/src/db-quotations.ts`, `backend/src/db-reports.ts`, `backend/src/db-stock.ts`, `backend/src/primitives.ts` | `function asAccountName(name: string): AccountName` |
| `asCustomerName` | `backend/src/db.ts` | `backend/src/call-dispatch/arap.ts`, `backend/src/call-dispatch/invoices.ts`, `backend/src/call-dispatch/pos.ts` | `function asCustomerName(name: string): CustomerName` |
| `asEmployeeName` | `backend/src/db.ts` | `backend/src/call-dispatch/projects.ts` | `function asEmployeeName(name: string): EmployeeName` |
| `asEntityId` | `backend/src/db.ts` | `backend/src/call-dispatch/entities.ts` | `function asEntityId(id: number): EntityId` |
| `asItemName` | `backend/src/db.ts` | `backend/src/call-dispatch/items.ts`, `backend/src/call-dispatch/locations.ts`, `backend/src/call-dispatch/pos.ts`, `backend/src/call-dispatch/stock-lots.ts`, `backend/src/db-journal.ts`, `backend/src/db-quotations.ts`, `backend/src/db-stock.ts` | `function asItemName(name: string): ItemName` |
| `asLocationName` | `backend/src/db.ts` | `backend/src/call-dispatch/invoices.ts`, `backend/src/call-dispatch/locations.ts`, `backend/src/call-dispatch/pos.ts`, `backend/src/db-journal.ts`, `backend/src/db-quotations.ts`, `backend/src/db-stock.ts` | `function asLocationName(name: string): LocationName` |
| `asProviderName` | `backend/src/db.ts` | `backend/src/call-dispatch/arap.ts`, `backend/src/call-dispatch/invoices.ts`, `backend/src/call-dispatch/locations.ts`, `backend/src/call-dispatch/pos.ts`, `backend/src/db-journal.ts` | `function asProviderName(name: string): ProviderName` |
| `asUserId` | `backend/src/db.ts` | `backend/src/call-dispatch/arap.ts`, `backend/src/call-dispatch/auth.ts`, `backend/src/call-dispatch/businesses.ts`, `backend/src/call-dispatch/contacts.ts`, `backend/src/call-dispatch/customer-registration.ts`, `backend/src/call-dispatch/departments.ts`, `backend/src/call-dispatch/entities.ts`, `backend/src/call-dispatch/hierarchy.ts`, `backend/src/call-dispatch/i18n.ts`, `backend/src/call-dispatch/invoices.ts`, `backend/src/call-dispatch/items.ts`, `backend/src/call-dispatch/journal.ts`, `backend/src/call-dispatch/locations.ts`, `backend/src/call-dispatch/period.ts`, `backend/src/call-dispatch/plant.ts`, `backend/src/call-dispatch/pos.ts`, `backend/src/call-dispatch/products.ts`, `backend/src/call-dispatch/projects.ts`, `backend/src/call-dispatch/prototypes.ts`, `backend/src/call-dispatch/quotations.ts`, `backend/src/call-dispatch/reports.ts`, `backend/src/call-dispatch/stock-lots.ts`, `backend/src/call-dispatch/stock.ts`, `backend/src/db-journal.ts`, `backend/src/db-seed.ts`, `backend/src/db-stock.ts` | `function asUserId(id: number): UserId` |
| `attachUser` | `backend/src/auth-middleware.ts` | `backend/src/call-dispatch.ts`, `backend/src/recording.ts`, `backend/src/server.ts` | `function attachUser(req: Request, _res: Response, next: NextFunction): void` |
| `authenticateCustomer` | `backend/src/db.ts` | `backend/src/call-dispatch/customer-registration.ts` | `function authenticateCustomer(name: string, password: string): boolean` |
| `buildProfitAndLossFromBalances` | `backend/src/db-reports.ts` | `backend/src/db-matrix-reports.ts` | `function buildProfitAndLossFromBalances(business: string, balances: Map<number, number>): ProfitAndLoss` |
| `callBackendFunction` | `backend/src/call-dispatch.ts` | `backend/src/routes/call.ts` | `function callBackendFunction(name: string, values: string[], user: AuthenticatedUser \| undefined, lineItems: string[][] = [], token: string \| undefined = undefined): CallResult \| Promise<CallResult>` |
| `changeOwnPassword` | `backend/src/auth.ts` | `backend/src/call-dispatch/auth.ts` | `function changeOwnPassword(userId: number, currentPassword: string, newPassword: string): void` |
| `changePassword` | `backend/src/auth.ts` | `backend/src/call-dispatch/auth.ts` | `function changePassword(userId: number, newPassword: string): void` |
| `checkEInvoiceDiscrepancies` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `function checkEInvoiceDiscrepancies(parsed: UblImportResult, poReference?: string): EInvoiceDiscrepancy[]` |
| `checkMilestoneAchievability` | `backend/src/db-projects.ts` | `backend/src/call-dispatch/projects.ts`, `backend/src/db-quotations.ts` | `function checkMilestoneAchievability(projectName: string, userId: UserId): ` |
| `clockPlantIn` | `backend/src/db-journal.ts` | `backend/src/call-dispatch/plant.ts`, `backend/src/db-projects.ts`, `backend/src/db.ts` | `function clockPlantIn(plantName: string, projectExpenseAccount: AccountName, business: BusinessName, ledger: LedgerName, userId: UserId): PlantClock` |
| `clockPlantOut` | `backend/src/db-journal.ts` | `backend/src/call-dispatch/plant.ts`, `backend/src/db-projects.ts`, `backend/src/db.ts` | `function clockPlantOut(plantName: string, business: BusinessName, ledger: LedgerName, userId: UserId): void` |
| `countInvoices` | `backend/src/db.ts` | `backend/src/call-dispatch/invoices.ts` | `function countInvoices(business: BusinessName, ledger: LedgerName, invoiceType?: 'AR' \| 'AP', source: 'manual' \| 'pos' \| 'all' = 'manual'): number` |
| `countItems` | `backend/src/db.ts` | `backend/src/call-dispatch/items.ts` | `function countItems(businessName: BusinessName): number` |
| `createLiveProject` | `backend/src/db-projects.ts` | `backend/src/call-dispatch/projects.ts`, `backend/src/db-quotations.ts` | `function createLiveProject(name: string, business: BusinessName, client: string, requestedStart: string, targetCompletionDate: string, userId: UserId): ` |
| `createLocationType` | `backend/src/db-stock.ts` | `backend/src/auth.ts`, `backend/src/call-dispatch/locations.ts`, `backend/src/call-dispatch.ts`, `backend/src/server.ts` | `function createLocationType(name: string, userId: UserId): void` |
| `createMilestone` | `backend/src/db-projects.ts` | `backend/src/call-dispatch/projects.ts`, `backend/src/db-quotations.ts` | `function createMilestone(projectName: string, milestoneType: MilestoneType, dueDate: string, userId: UserId, label?: string): ` |
| `createPlantItem` | `backend/src/db.ts` | `backend/src/call-dispatch/plant.ts` | `function createPlantItem(name: string, business: BusinessName, hourlyRateMinor: number, ownedOrHired: 'Owned' \| 'Hired', userId: UserId, hireVendor?: string): ` |
| `createPosTerminal` | `backend/src/db-stock.ts` | `backend/src/call-dispatch/pos.ts` | `function createPosTerminal(terminalName: string, locationName: LocationName, userId: UserId): void` |
| `createProduct` | `backend/src/db.ts` | `backend/src/call-dispatch/products.ts` | `function createProduct(name: string, parent: string, userId: UserId): void` |
| `createProjectTask` | `backend/src/db.ts` | (none) | `function createProjectTask(projectName: string, taskName: string, plannedStart: string, plannedEnd: string, userId: UserId): void` |
| `createPrototype` | `backend/src/db-prototypes.ts` | `backend/src/call-dispatch/prototypes.ts` | `function createPrototype(name: string, business: BusinessName, userId: UserId): ` |
| `createSystemEntity` | `backend/src/db-stock.ts` | `backend/src/db-quotations.ts`, `backend/src/db.ts` | `function createSystemEntity(name: string, parentId: number \| null): number` |
| `createUser` | `backend/src/auth.ts` | `backend/src/call-dispatch/auth.ts` | `function createUser(username: string, password: string, roleNames: string[]): UserSummary` |
| `decodeCategoryTree` | `backend/src/call-dispatch.ts` | (none) | `function decodeCategoryTree(encoded: string): WireCategoryTreeNode[]` |
| `decodeGenericTree` | `backend/src/call-dispatch.ts` | (none) | `function decodeGenericTree(encoded: string): WireGenericTreeNode[]` |
| `decodeRecordList` | `backend/src/call-dispatch.ts` | `backend/src/call-dispatch/businesses.ts`, `backend/src/call-dispatch/locations.ts` | `function decodeRecordList(fields: string[], encoded: string): Record<string, string>[]` |
| `decodeShape` | `backend/src/call-dispatch.ts` | `backend/src/call-dispatch/hierarchy.ts`, `backend/src/call-dispatch/locations.ts`, `backend/src/call-dispatch/pos.ts` | `function decodeShape(encoded: string): [string, string][] \| undefined` |
| `decodeStringList` | `backend/src/call-dispatch.ts` | `backend/src/call-dispatch/auth.ts`, `backend/src/call-dispatch/entities.ts`, `backend/src/call-dispatch/i18n.ts`, `backend/src/call-dispatch/invoices.ts`, `backend/src/call-dispatch/journal.ts`, `backend/src/call-dispatch/locations.ts`, `backend/src/call-dispatch/pos.ts` | `function decodeStringList(encoded: string): string[]` |
| `deleteBomComponent` | `backend/src/db.ts` | `backend/src/call-dispatch/items.ts` | `function deleteBomComponent(assemblyItem: string, componentItem: string, userId: UserId): void` |
| `deleteHierarchyParent` | `backend/src/db.ts` | `backend/src/call-dispatch/hierarchy.ts` | `function deleteHierarchyParent(entityName: string, hierarchyName: string, userId: UserId): void` |
| `deleteItemSource` | `backend/src/db.ts` | `backend/src/call-dispatch/items.ts` | `function deleteItemSource(id: number): void` |
| `deleteMenuOverride` | `backend/src/db.ts` | `backend/src/call-dispatch/menu.ts` | `function deleteMenuOverride(menuItemKey: string, scope: 'business' \| 'user', scopeId: number, userId: UserId = asUserId(1)): void` |
| `deleteTypedAddress` | `backend/src/db.ts` | `backend/src/call-dispatch/contacts.ts` | `function deleteTypedAddress(entityName: string, addressType: string, userId: UserId): void` |
| `deleteTypedContactPerson` | `backend/src/db.ts` | `backend/src/call-dispatch/contacts.ts` | `function deleteTypedContactPerson(entityName: string, contactType: string, userId: UserId): void` |
| `deleteTypedPhone` | `backend/src/db.ts` | `backend/src/call-dispatch/contacts.ts` | `function deleteTypedPhone(entityName: string, phoneType: string, userId: UserId): void` |
| `deleteVocabularyPreference` | `backend/src/db.ts` | `backend/src/call-dispatch/i18n.ts` | `function deleteVocabularyPreference(conceptName: string, scope: 'business' \| 'user', scopeId: number): void` |
| `dispatchOrderFromPickingList` | `backend/src/db.ts` | `backend/src/call-dispatch/invoices.ts` | `function dispatchOrderFromPickingList(invoiceId: number, locationName: LocationName, revenueAccount: string, taxAccount: string, userId: UserId): void` |
| `encodeCategoryTree` | `backend/src/call-dispatch.ts` | `backend/src/call-dispatch/reports.ts` | `function encodeCategoryTree(nodes: WireCategoryTreeNode[]): string` |
| `encodeGenericTree` | `backend/src/call-dispatch.ts` | `backend/src/call-dispatch/reports.ts` | `function encodeGenericTree(nodes: WireGenericTreeNode[]): string` |
| `encodeProfitAndLoss` | `backend/src/call-dispatch/reports.ts` | `backend/src/call-dispatch/invoices.ts`, `backend/src/call-dispatch/matrix-reports.ts` | `function encodeProfitAndLoss(pl: ProfitAndLoss): string` |
| `encodeShape` | `backend/src/call-dispatch.ts` | `backend/src/call-dispatch/hierarchy.ts`, `backend/src/call-dispatch/pos.ts` | `function encodeShape(shape: [string, string][] \| undefined): string` |
| `encodeStringList` | `backend/src/call-dispatch.ts` | `backend/src/call-dispatch/auth.ts`, `backend/src/call-dispatch/businesses.ts`, `backend/src/call-dispatch/entities.ts`, `backend/src/call-dispatch/i18n.ts`, `backend/src/call-dispatch/invoices.ts`, `backend/src/call-dispatch/journal.ts`, `backend/src/call-dispatch/locations.ts`, `backend/src/call-dispatch/matrix-reports.ts`, `backend/src/call-dispatch/pos.ts`, `backend/src/call-dispatch/reports.ts` | `function encodeStringList(values: string[] \| undefined): string` |
| `ensureAddressType` | `backend/src/db.ts` | (none) | `function ensureAddressType(typeName: string, userId: UserId): void` |
| `ensureContactPersonType` | `backend/src/db.ts` | (none) | `function ensureContactPersonType(typeName: string, userId: UserId): void` |
| `ensureCurrencyPair` | `backend/src/db.ts` | (none) | `function ensureCurrencyPair(businessName: BusinessName, fromCurrency: string, toCurrency: string, userId: UserId): ` |
| `ensureItemTier` | `backend/src/db.ts` | (none) | `function ensureItemTier(baseProductName: ItemName, tier: string, userId: UserId, business?: BusinessName): ` |
| `ensureLocationCapacityAccount` | `backend/src/db-stock.ts` | `backend/src/db-journal.ts`, `backend/src/db.ts` | `function ensureLocationCapacityAccount(business: BusinessName, ledger: LedgerName, locationName: LocationName, userId: UserId): ` |
| `ensureLocationStorageRoot` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `function ensureLocationStorageRoot(business: BusinessName, locationName: string, userId: UserId): ` |
| `ensurePhoneType` | `backend/src/db.ts` | (none) | `function ensurePhoneType(typeName: string, userId: UserId): void` |
| `ensureSkill` | `backend/src/db.ts` | `backend/src/call-dispatch/plant.ts` | `function ensureSkill(name: string, userId: UserId): ` |
| `ensureStorageCapacityStructure` | `backend/src/db.ts` | `backend/src/db-stock.ts` | `function ensureStorageCapacityStructure(parentEntity: { id: number; name: string }, userId: UserId): ` |
| `exportInvoiceAsUbl` | `backend/src/db.ts` | `backend/src/call-dispatch/invoices.ts` | `function exportInvoiceAsUbl(invoiceId: number): string` |
| `findNextAvailableWindow` | `backend/src/db-projects.ts` | (none) | `function findNextAvailableWindow(resourceName: string, business: BusinessName, desiredStart: string, durationDays: number, excludeProject?: string): ScheduleResolution` |
| `getAccountBalanceMinor` | `backend/src/db.ts` | `backend/src/db-projects.ts` | `function getAccountBalanceMinor(accountName: string): number` |
| `getAccountsPostedTo` | `backend/src/db.ts` | (none) | `function getAccountsPostedTo(reference: string): string[]` |
| `getActiveShiftsAtLocation` | `backend/src/db.ts` | (none) | `function getActiveShiftsAtLocation(locationName: string): PosShift[]` |
| `getAgingBuckets` | `backend/src/db.ts` | (none) | `function getAgingBuckets(paymentTermsDays: number \| null): AgingBucket[]` |
| `getAxisValues` | `backend/src/db-matrix-reports.ts` | `backend/src/call-dispatch/matrix-reports.ts` | `function getAxisValues(businessName: BusinessName, ledgerName: LedgerName): AxisValues` |
| `getBankAccounts` | `backend/src/db.ts` | `backend/src/call-dispatch/reports.ts` | `function getBankAccounts(business: BusinessName, ledger: LedgerName): BankAccountRow[]` |
| `getBomComponents` | `backend/src/db.ts` | `backend/src/call-dispatch/items.ts`, `backend/src/db-projects.ts`, `backend/src/db-prototypes.ts`, `backend/src/db-quotations.ts` | `function getBomComponents(assemblyItem: string): BomComponentLine[]` |
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
| `getLiveProject` | `backend/src/db-projects.ts` | `backend/src/call-dispatch/projects.ts` | `function getLiveProject(name: string): LiveProjectRecord \| undefined` |
| `getLocalizedText` | `backend/src/db.ts` | `backend/src/call-dispatch/businesses.ts`, `backend/src/call-dispatch/i18n.ts`, `backend/src/call-dispatch.ts`, `backend/src/invoice.ts` | `function getLocalizedText(language: string, opts?: { businessName?: string; userId?: number }): Record<string, string>` |
| `getLocationCapacityStatus` | `backend/src/db-stock.ts` | (none) | `function getLocationCapacityStatus(locationName: LocationName): LocationCapacityStatus` |
| `getLocationOpenHours` | `backend/src/db.ts` | `backend/src/call-dispatch/locations.ts` | `function getLocationOpenHours(locationName: string): OpenHoursLine[]` |
| `getLocationTypes` | `backend/src/db-stock.ts` | `backend/src/call-dispatch/locations.ts`, `backend/src/server.ts` | `function getLocationTypes(): string[]` |
| `getMenuTree` | `backend/src/db.ts` | `backend/src/call-dispatch/menu.ts`, `backend/src/db-seed.ts` | `function getMenuTree(opts?: { businessName?: string; userId?: number }): MenuSectionRow[]` |
| `getMilestones` | `backend/src/db-projects.ts` | `backend/src/call-dispatch/projects.ts` | `function getMilestones(projectName: string): MilestoneRecord[]` |
| `getOpenPlantClock` | `backend/src/db-journal.ts` | `backend/src/call-dispatch/plant.ts` | `function getOpenPlantClock(plantName: string): PlantClock \| undefined` |
| `getOpenShiftForEmployee` | `backend/src/db.ts` | (none) | `function getOpenShiftForEmployee(employeeName: string): PosShift \| undefined` |
| `getPickingList` | `backend/src/db.ts` | `backend/src/call-dispatch/invoices.ts` | `function getPickingList(invoiceId: number, locationName: LocationName): PickingListLine[]` |
| `getPlantItem` | `backend/src/db.ts` | `backend/src/call-dispatch/plant.ts`, `backend/src/db-journal.ts` | `function getPlantItem(name: string): PlantItemRecord \| undefined` |
| `getProfitAndLossByAxis` | `backend/src/db-matrix-reports.ts` | `backend/src/call-dispatch/matrix-reports.ts`, `backend/src/call-dispatch/reports.ts`, `backend/src/call-dispatch.ts`, `backend/src/server.ts` | `function getProfitAndLossByAxis(businessName: BusinessName, ledgerName: LedgerName, fromDate: string \| undefined, toDate: string \| undefined, outerAxis: MatrixAxis, innerAxis: MatrixAxis, outerFilter?: string, innerFilter?: string): ProfitAndLossByAxisNode[]` |
| `getProjectCostReport` | `backend/src/db-projects.ts` | `backend/src/call-dispatch/projects.ts`, `backend/src/db.ts` | `function getProjectCostReport(projectName: string): ProjectCostReport` |
| `getProjectTasks` | `backend/src/db.ts` | (none) | `function getProjectTasks(projectName: string): ` |
| `getPrototypeLines` | `backend/src/db-prototypes.ts` | `backend/src/call-dispatch/prototypes.ts` | `function getPrototypeLines(prototypeName: string): BomComponentLine[]` |
| `getQuotationLines` | `backend/src/db-quotations.ts` | `backend/src/call-dispatch/quotations.ts` | `function getQuotationLines(reference: string): BomComponentLine[]` |
| `getReminderCandidates` | `backend/src/db.ts` | `backend/src/call-dispatch/invoices.ts` | `function getReminderCandidates(business: BusinessName, ledger: LedgerName, asOfDate: string): ReminderCandidate[]` |
| `getResourceBookings` | `backend/src/db-projects.ts` | `backend/src/call-dispatch/projects.ts` | `function getResourceBookings(resourceName: string, business: BusinessName, excludeProject?: string): ResourceBooking[]` |
| `getSalesCogsMatrix` | `backend/src/db-matrix-reports.ts` | `backend/src/call-dispatch/matrix-reports.ts` | `function getSalesCogsMatrix(businessName: BusinessName, ledgerName: LedgerName, fromDate: string \| undefined, toDate: string \| undefined, rowAxis: MatrixAxis, colAxis: MatrixAxis): SalesCogsMatrix` |
| `getSalesReport` | `backend/src/db-reports.ts` | `backend/src/call-dispatch/reports.ts` | `function getSalesReport(business: BusinessName, ledger: LedgerName, fromDate?: string, toDate?: string): SalesReport` |
| `getScheduleAtLocation` | `backend/src/db.ts` | `backend/src/call-dispatch/locations.ts` | `function getScheduleAtLocation(locationName: string): LocationScheduleLine[]` |
| `getSessionUser` | `backend/src/auth.ts` | `backend/src/auth-middleware.ts` | `function getSessionUser(token: string \| undefined): AuthenticatedUser \| null` |
| `getSkills` | `backend/src/db.ts` | `backend/src/call-dispatch/plant.ts` | `function getSkills(contactName: string): SkillAssignment[]` |
| `getStockMovementReport` | `backend/src/db-stock.ts` | `backend/src/call-dispatch/locations.ts` | `function getStockMovementReport(business: string, ledgerName: string, fromDate?: string, toDate?: string, hierarchyName?: string): StockMovementReport` |
| `getStockOnHandMatrix` | `backend/src/db-matrix-reports.ts` | `backend/src/call-dispatch/matrix-reports.ts`, `backend/src/db-stock.ts` | `function getStockOnHandMatrix(rowAxis: MatrixAxis, colAxis: MatrixAxis): StockOnHandMatrix` |
| `getStockOutRiskReport` | `backend/src/db-stock.ts` | `backend/src/call-dispatch/locations.ts` | `function getStockOutRiskReport(windowDays: number = 2): StockOutRiskRow[]` |
| `getStockTake` | `backend/src/db-stock.ts` | `backend/src/call-dispatch/locations.ts` | `function getStockTake(id: number): StockTake \| undefined` |
| `getTaskDependencies` | `backend/src/db.ts` | (none) | `function getTaskDependencies(dependentTask: string): ` |
| `getTypedContactPersons` | `backend/src/db.ts` | `backend/src/call-dispatch/contacts.ts` | `function getTypedContactPersons(entityName: string): ContactPerson[]` |
| `getVocabularyAlternates` | `backend/src/db.ts` | `backend/src/call-dispatch/i18n.ts` | `function getVocabularyAlternates(wordName: string): string[]` |
| `hashPassword` | `backend/src/password.ts` | `backend/src/auth.ts`, `backend/src/db.ts` | `function hashPassword(password: string): string` |
| `instantiateProjectProposal` | `backend/src/db-prototypes.ts` | `backend/src/call-dispatch/prototypes.ts` | `function instantiateProjectProposal(prototypeName: string, reference: string, client: string, business: BusinessName, ledger: string, headerItem: string, transdate: string, userId: UserId, targetCompletionDate?: string): void` |
| `isGenuineCategoryOrItemsRoot` | `backend/src/db.ts` | (none) | `function isGenuineCategoryOrItemsRoot(name: string): boolean` |
| `isRecording` | `backend/src/recording.ts` | `backend/src/routes/recording.ts` | `function isRecording(userId: number): boolean` |
| `listAddressTypes` | `backend/src/db.ts` | `backend/src/call-dispatch/contacts.ts` | `function listAddressTypes(): string[]` |
| `listContactPersonTypes` | `backend/src/db.ts` | `backend/src/call-dispatch/contacts.ts` | `function listContactPersonTypes(): string[]` |
| `listCurrencyPairs` | `backend/src/db.ts` | (none) | `function listCurrencyPairs(currencies: string[]): ` |
| `listInvoices` | `backend/src/db.ts` | `backend/src/call-dispatch/invoices.ts` | `function listInvoices(business: BusinessName, ledger: LedgerName, options: ListInvoicesOptions = {}): Invoice[]` |
| `listItemSources` | `backend/src/db.ts` | `backend/src/call-dispatch/items.ts` | `function listItemSources(itemName: string): ItemSource[]` |
| `listLineTypes` | `backend/src/db.ts` | `backend/src/call-dispatch/entities.ts` | `function listLineTypes(): string[]` |
| `listLiveProjects` | `backend/src/db-projects.ts` | `backend/src/call-dispatch/projects.ts` | `function listLiveProjects(business: BusinessName): string[]` |
| `listPendingCustomers` | `backend/src/db.ts` | `backend/src/call-dispatch/customer-registration.ts` | `function listPendingCustomers(): PendingCustomer[]` |
| `listPhoneTypes` | `backend/src/db.ts` | `backend/src/call-dispatch/contacts.ts` | `function listPhoneTypes(): string[]` |
| `listPlant` | `backend/src/db.ts` | `backend/src/call-dispatch/plant.ts` | `function listPlant(business: BusinessName): string[]` |
| `listPrototypes` | `backend/src/db-prototypes.ts` | `backend/src/call-dispatch/prototypes.ts` | `function listPrototypes(business: BusinessName): string[]` |
| `listRoles` | `backend/src/auth.ts` | `backend/src/call-dispatch/auth.ts` | `function listRoles(): ` |
| `listSkills` | `backend/src/db.ts` | `backend/src/call-dispatch/plant.ts` | `function listSkills(): string[]` |
| `listUsers` | `backend/src/auth.ts` | `backend/src/call-dispatch/auth.ts` | `function listUsers(): UserSummary[]` |
| `logout` | `backend/src/auth.ts` | `backend/src/call-dispatch/auth.ts`, `backend/src/call-dispatch.ts` | `function logout(token: string): void` |
| `parseUblInvoice` | `backend/src/db.ts` | (none) | `function parseUblInvoice(xml: string): UblImportResult` |
| `postBomComponents` | `backend/src/db.ts` | `backend/src/call-dispatch/items.ts`, `backend/src/db-projects.ts`, `backend/src/db-prototypes.ts`, `backend/src/db-quotations.ts` | `function postBomComponents(assemblyItem: string, business: string, userId: UserId): void` |
| `previewCloseBooks` | `backend/src/db-reports.ts` | `backend/src/call-dispatch/journal.ts`, `backend/src/call-dispatch/locations.ts`, `backend/src/call-dispatch.ts` | `function previewCloseBooks(businessName: BusinessName, ledger: LedgerName, asOfDate: string, retainedEarningsAccount: string, hierarchyPath: string[] = []): CloseBooksPreview` |
| `provisionProjectProfitCenter` | `backend/src/db-projects.ts` | `backend/src/call-dispatch/projects.ts`, `backend/src/db-journal.ts`, `backend/src/db-quotations.ts`, `backend/src/db.ts` | `function provisionProjectProfitCenter(projectName: string, business: BusinessName, userId: UserId): ` |
| `recordingMiddleware` | `backend/src/recording.ts` | `backend/src/server.ts` | `function recordingMiddleware(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction): void` |
| `recordReminderSent` | `backend/src/db.ts` | `backend/src/call-dispatch/invoices.ts` | `function recordReminderSent(customerName: string): number` |
| `recordStockTakeCount` | `backend/src/db-stock.ts` | `backend/src/call-dispatch/locations.ts` | `function recordStockTakeCount(stockTakeId: number, itemName: ItemName, countedQuantity: number): void` |
| `registerBankAccount` | `backend/src/db.ts` | `backend/src/call-dispatch/reports.ts` | `function registerBankAccount(accountName: string, business: string, scopeName: string, overdraftLimitMinor: number \| null, userId: UserId): void` |
| `registerCustomer` | `backend/src/db.ts` | `backend/src/call-dispatch/customer-registration.ts` | `function registerCustomer(input: CustomerRegistrationInput, userId: UserId): void` |
| `requireAuth` | `backend/src/auth-middleware.ts` | `backend/src/call-dispatch/arap.ts`, `backend/src/call-dispatch/auth.ts`, `backend/src/call-dispatch/businesses.ts`, `backend/src/call-dispatch/contacts.ts`, `backend/src/call-dispatch/customer-registration.ts`, `backend/src/call-dispatch/departments.ts`, `backend/src/call-dispatch/entities.ts`, `backend/src/call-dispatch/hierarchy.ts`, `backend/src/call-dispatch/i18n.ts`, `backend/src/call-dispatch/invoices.ts`, `backend/src/call-dispatch/items.ts`, `backend/src/call-dispatch/journal.ts`, `backend/src/call-dispatch/locations.ts`, `backend/src/call-dispatch/matrix-reports.ts`, `backend/src/call-dispatch/plant.ts`, `backend/src/call-dispatch/pos.ts`, `backend/src/call-dispatch/projects.ts`, `backend/src/call-dispatch/quotations.ts`, `backend/src/call-dispatch/reports.ts`, `backend/src/call-dispatch/stock-lots.ts`, `backend/src/call-dispatch/stock.ts`, `backend/src/call-dispatch.ts`, `backend/src/server.ts` | `function requireAuth(req: Request, res: Response, next: NextFunction): void` |
| `resetReminderLevel` | `backend/src/db.ts` | `backend/src/call-dispatch/invoices.ts` | `function resetReminderLevel(customerName: string): void` |
| `resolveDispatchLocation` | `backend/src/db.ts` | `backend/src/call-dispatch/pos.ts` | `function resolveDispatchLocation(itemName: ItemName, logicalLocationName: LocationName): LocationName` |
| `resolveItemId` | `backend/src/db.ts` | `backend/src/db-stock.ts`, `backend/src/drivers/sql-entity-driver.ts`, `backend/src/entity-driver.ts` | `function resolveItemId(itemName: ItemName): number \| undefined` |
| `saveBusinessTypeAnswers` | `backend/src/db.ts` | `backend/src/call-dispatch/businesses.ts` | `function saveBusinessTypeAnswers(businessName: BusinessName, answers: Record<string, string>, userId: UserId): void` |
| `scheduleProjectRecipeLines` | `backend/src/db-projects.ts` | `backend/src/call-dispatch/projects.ts`, `backend/src/db-quotations.ts` | `function scheduleProjectRecipeLines(projectName: string, business: BusinessName, userId: UserId): ScheduledLine[]` |
| `seedRemainingData` | `backend/src/db-seed.ts` | `backend/src/db.ts` | `function seedRemainingData(): void` |
| `setEmployeeSchedule` | `backend/src/db.ts` | `backend/src/call-dispatch/locations.ts`, `backend/src/db-projects.ts` | `function setEmployeeSchedule(employeeName: string, locationName: string, schedule: ScheduleLine[]): void` |
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
| `stageBomComponent` | `backend/src/db.ts` | `backend/src/call-dispatch/items.ts`, `backend/src/db-projects.ts`, `backend/src/db-prototypes.ts`, `backend/src/db-quotations.ts` | `function stageBomComponent(input: BomComponentInput): void` |
| `startRecording` | `backend/src/recording.ts` | `backend/src/routes/recording.ts` | `function startRecording(userId: number, username: string): void` |
| `stopRecording` | `backend/src/recording.ts` | `backend/src/routes/recording.ts` | `function stopRecording(userId: number): Promise<void>` |
| `tagSkill` | `backend/src/db.ts` | `backend/src/call-dispatch/plant.ts` | `function tagSkill(contactName: string, skillName: string, rateMinorPerHour: number, userId: UserId): void` |
| `todayAtLocation` | `backend/src/db-stock.ts` | `backend/src/db.ts` | `function todayAtLocation(locationName: LocationName): string` |
| `unregisterBankAccount` | `backend/src/db.ts` | `backend/src/call-dispatch/reports.ts` | `function unregisterBankAccount(accountName: string, userId: UserId): void` |
| `untagSkill` | `backend/src/db.ts` | `backend/src/call-dispatch/plant.ts` | `function untagSkill(contactName: string, skillName: string, userId: UserId): void` |
| `updatePrototypeLine` | `backend/src/db-prototypes.ts` | `backend/src/call-dispatch/prototypes.ts`, `backend/src/db.ts` | `function updatePrototypeLine(prototypeName: string, business: BusinessName, resourceOrItemName: string, userId: UserId, newDurationHours?: number, newPriceMinor?: number): void` |
| `userMayActAsRole` | `backend/src/auth.ts` | `backend/src/auth-middleware.ts`, `backend/src/call-dispatch.ts` | `function userMayActAsRole(user: AuthenticatedUser, roles: string[], businessName: BusinessName \| null \| undefined): boolean` |
| `verifyCustomer` | `backend/src/db.ts` | `backend/src/call-dispatch/customer-registration.ts` | `function verifyCustomer(customerName: string, approve: boolean): void` |
| `verifyPassword` | `backend/src/password.ts` | `backend/src/auth.ts`, `backend/src/db.ts` | `function verifyPassword(password: string, stored: string): boolean` |
| `verifyPosPin` | `backend/src/db.ts` | (none) | `function verifyPosPin(employeeName: string, pin: string): boolean` |

## Other Constants (26, alphabetical)

| Name | Defined in | Referenced in | Declaration |
|---|---|---|---|
| `arapFunctions` | `backend/src/call-dispatch/arap.ts` | `backend/src/call-dispatch.ts` | `const arapFunctions = {   // Positional args: [0] reference, [1] business, [2] ledger, [3] customer, [4] amount_minor, [5] transdate, [6] description.   stageARReceipt: (v, user) => {     requireRole(user, 'Administrator', 'Bookkeeper');` |
| `authFunctions` | `backend/src/call-dispatch/auth.ts` | `backend/src/call-dispatch.ts` | `const authFunctions = {   login: (v) => {     const [username, password] = v;` |
| `BUSINESS_ADMIN_ROLE` | `backend/src/auth.ts` | (none) | `const BUSINESS_ADMIN_ROLE = 'Business Admin';` |
| `businessesFunctions` | `backend/src/call-dispatch/businesses.ts` | `backend/src/call-dispatch.ts` | `const businessesFunctions = {   // Positional args: [0] businessName, [1] financialYearLabel, [2]   // coaPrototype, [3] secondaryCurrencies ('\|'-joined), [4]   // entityStructure, [5] partnerNames ('\|'-joined), [6]   // financialYearStart, [7] reportingFrequency. Any trailing arg may be   // '' for "not provided".   //   // Creating a business is the one, real, deliberately narrow operation   // Business Admin must never reach - see   // docs/business-admin-role-and-enforcement-design.md - hence   // requireGlobalRole, not an ordinary per-business role check.   'Create Business': (v, user) => {     const admin = requireGlobalRole(user, 'Administrator');` |
| `contactsFunctions` | `backend/src/call-dispatch/contacts.ts` | `backend/src/call-dispatch.ts` | `const contactsFunctions = {   // No args.   listContactPersonTypes: (v, user) => {     requireAuth(user);` |
| `customerRegistrationFunctions` | `backend/src/call-dispatch/customer-registration.ts` | `backend/src/call-dispatch.ts` | `const customerRegistrationFunctions = {   // Positional args, in CustomerRegistrationInput's own field order:   // [0] name, [1] email, [2] phone, [3] address_line1, [4] address_line2,   // [5] city, [6] region, [7] postal_code, [8] country, [9]   // preferred_language, [10] password, [11] card_label. Public.   registerCustomer: (v) => {     const [name, email, phone, address_line1, address_line2, city, region, postal_code, country, preferred_language, password, card_label] = v;` |
| `departmentsFunctions` | `backend/src/call-dispatch/departments.ts` | `backend/src/call-dispatch.ts` | `const departmentsFunctions = {   // Positional args: [0] business. No role gate in the old route (just   // requireAuth on the whole mount) - replicated here as requireAuth only.   listDepartments: (v, user) => {     requireAuth(user);` |
| `entitiesFunctions` | `backend/src/call-dispatch/entities.ts` | `backend/src/call-dispatch.ts` | `const entitiesFunctions = {   // Positional args: [0] business (optional). Despite the name, the real   // result is already a FLAT, depth-annotated array (see db.ts's own   // comment on getEntityTree) — no tree-flattening problem here at all,   // unlike the arbitrary-depth CategoryTreeNode[] deferred in   // matrix-reports.ts/reports.ts.   getEntityTree: (v, user) => {     requireAuth(user);` |
| `hierarchyFunctions` | `backend/src/call-dispatch/hierarchy.ts` | `backend/src/call-dispatch.ts` | `const hierarchyFunctions = {   // Positional args: [0] business. Flattens HierarchyGroupingWithValues[]   // (one level of real nesting: a grouping name plus its own values[])   // into one (grouping, value) table, with a sentinel row (value='', a   // real value name is never empty) for a grouping that has zero values   // yet — confirmed needed via grep of setup/hierarchy/+page.svelte,   // which lists groupings themselves independent of their value count,   // same discipline as departments.ts's getOrgChartStructure.   getHierarchy: (v, user) => {     requireAuth(user);` |
| `i18nFunctions` | `backend/src/call-dispatch/i18n.ts` | `backend/src/call-dispatch.ts` | `const i18nFunctions = {   // No args. Public.   getLanguages: () => table(['id', 'name'], getLanguages()),   // Positional args: [0] language. Public.   getLanguageDirection: (v) => {     const [language] = v;` |
| `invoicesFunctions` | `backend/src/call-dispatch/invoices.ts` | `backend/src/call-dispatch.ts` | `const invoicesFunctions = {   // Combines the old route's own listInvoices+countInvoices (one JSON   // response, {rows, totalCount}) into one dispatch entry the same way.   listInvoices: (v, user) => {     requireAuth(user);` |
| `itemsFunctions` | `backend/src/call-dispatch/items.ts` | `backend/src/call-dispatch.ts` | `const itemsFunctions = {   // Positional args: [0] business, [1] limit, [2] offset. The real result   // (rows + a separate totalCount) is denormalized onto every row (see   // matrix-reports.ts's own precedent) with one sentinel row (name='',   // a real item's name is never empty) carrying totalCount when there   // are zero real rows to denormalize onto.   listItems: (v, user) => {     requireAuth(user);` |
| `journalFunctions` | `backend/src/call-dispatch/journal.ts` | `backend/src/call-dispatch.ts` | `const journalFunctions = {   // Positional args: [0] business, [1] ledger, [2] limit, [3] offset.   // {rows, totalCount} uses the denormalized-totals+sentinel-row pattern   // (reference is never empty) — same technique as items.ts's listItems.   listJournalEntries: (v, user) => {     requireAuth(user);` |
| `locationsFunctions` | `backend/src/call-dispatch/locations.ts` | `backend/src/call-dispatch.ts` | `const locationsFunctions = {   // GET / — business query param is required (locations are scoped per   // business);` |
| `matrixReportsFunctions` | `backend/src/call-dispatch/matrix-reports.ts` | `backend/src/call-dispatch.ts` | `const matrixReportsFunctions = {   // Positional args: [0] business, [1] ledger, [2] rowAxis, [3] colAxis, [4] fromDate, [5] toDate.   // Table columns: rowKey,colKey,salesMinor,cogsMinor,totalSalesMinor,totalCogsMinor   // (totals denormalized onto every row — read from any row). Zero cells ->   // one sentinel row with rowKey='',colKey='' (resolveKey never returns   // an empty string for a real key) carrying totals (always 0 then).   getSalesCogsMatrix: (v, user) => {     requireAuth(user);` |
| `menuFunctions` | `backend/src/call-dispatch/menu.ts` | `backend/src/call-dispatch.ts` | `const menuFunctions = {   // Positional args: [0] businessName ('' = none). userId comes from the   // authenticated user (req.user.id), never a positional arg - reads   // stay open to any authenticated user, exactly as the old route did.   getMenuTree: (v, user) => {     const businessName = v[0] \|\| undefined;` |
| `periodFunctions` | `backend/src/call-dispatch/period.ts` | `backend/src/call-dispatch.ts` | `const periodFunctions = {   // Positional args: [0] business, [1] ledger.   getPeriodStatus: (v) => {     const [business, ledger] = v;` |
| `plantFunctions` | `backend/src/call-dispatch/plant.ts` | `backend/src/call-dispatch.ts` | `const plantFunctions = {   // Positional args: [0] name, [1] business, [2] hourlyRateMinor,   // [3] ownedOrHired ('Owned'\|'Hired'), [4] hireVendor?.   createPlantItem: (v, user) => {     const u = requireRole(user, 'Administrator', 'Bookkeeper');` |
| `posFunctions` | `backend/src/call-dispatch/pos.ts` | `backend/src/call-dispatch.ts` | `const posFunctions = {   // Positional args: [0] upc. No role gate (just requireAuth on the   // whole mount, same as the old route).   lookupByUpc: (v, user) => {     requireAuth(user);` |
| `productsFunctions` | `backend/src/call-dispatch/products.ts` | `backend/src/call-dispatch.ts` | `const productsFunctions = {   listProducts: () => table(['name', 'itemCount'], listProducts()),   // Positional args: [0] name, [1] parent ('' defaults to 'Items').   createProduct: (v, user) => {     const admin = requireRole(user, 'Administrator', 'Bookkeeper');` |
| `projectsFunctions` | `backend/src/call-dispatch/projects.ts` | `backend/src/call-dispatch.ts` | `const projectsFunctions = {   // Positional args: [0] employeeName, [1] projectExpenseAccount, [2] business, [3] ledger.   clockInToProject: (v, user) => {     const u = requireAuth(user);` |
| `prototypesFunctions` | `backend/src/call-dispatch/prototypes.ts` | `backend/src/call-dispatch.ts` | `const prototypesFunctions = {   // Positional args: [0] name, [1] business.   createPrototype: (v, user) => {     const u = requireRole(user, 'Administrator', 'Bookkeeper');` |
| `quotationsFunctions` | `backend/src/call-dispatch/quotations.ts` | `backend/src/call-dispatch.ts` | `const quotationsFunctions = {   // Positional args: [0] business, [1] ledger, [2] direction ('AR'\|'AP'\|'').   listQuotations: (v, user) => {     requireRole(user, 'Administrator', 'Bookkeeper');` |
| `reportsFunctions` | `backend/src/call-dispatch/reports.ts` | `backend/src/call-dispatch.ts` | `const reportsFunctions = {   // Positional args: [0] business. No live frontend caller (already   // commented out as unused in api.ts) — built anyway for a complete   // backend surface. combination_ids is the one other approved JSON   // exception — carried through as a plain, un-decoded string field,   // same as everywhere else it appears.   getBusinessReports: (v, user) => {     requireAuth(user);` |
| `stockFunctions` | `backend/src/call-dispatch/stock.ts` | `backend/src/call-dispatch.ts` | `const stockFunctions = {   // Positional args: [0] reference, [1] business, [2] ledger, [3] vendor,   // [4] item, [5] quantity, [6] price_minor, [7] location, [8] transdate,   // [9] description.   stagePurchaseOrder: (v, user) => {     requireRole(user, 'Administrator', 'Bookkeeper');` |
| `stockLotsFunctions` | `backend/src/call-dispatch/stock-lots.ts` | `backend/src/call-dispatch.ts` | `const stockLotsFunctions = {   // Positional args: [0] business, [1] ledger, [2] reference, [3] itemName,   // [4] quantity, [5] unitCostMinor, [6] writeOffExpenseAccount,   // [7] inventoryAccount, [8] reason, [9] transdate.   // (writeOffItems also takes locationName/combinationValues/   // combinationShape, but the old route's own schema never carried   // those either — not ported here, matching real prior behavior.)   writeOffItems: (v, user) => {     const admin = requireRole(user, 'Administrator', 'Bookkeeper');` |

267 real, tracked baseline names reported (41 TypeDescriptor constants, 2 router constants, 198 functions, 26 other constants) out of 365 total names in the baseline file.
