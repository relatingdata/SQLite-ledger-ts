# Documentation Coverage Baseline — Structured Report

Generated directly by `scripts/documentation-baseline-report.ts` (run via `make documentation-baseline-report`). Reads the exact, same, real, tracked names from `docs/documentation-coverage-baseline.md` that `check-docs-coverage.ts` itself uses, then, for each real name still genuinely present in the live source, finds its own real file of definition, its own real, full declaration (a function's own, real, full parameter list and return type; a const's own, real, full initializing expression), and every other real, core backend file that genuinely, textually references it. Separated into real, distinct, alphabetical groups - never one, single, undifferentiated list - since these are genuinely different kinds of things: `typeXxxName` `TypeDescriptor` constants, `xxxRouter` Express router constants, and real, substantial, ordinary functions.

## TypeDescriptor Constants (32, alphabetical)

### `typeAssetAccountName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
const typeAssetAccountName = { brand: 'AssetAccountName' };
```

### `typeBusinessContactsRootName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`

```ts
const typeBusinessContactsRootName = { brand: 'BusinessContactsRootName' };
```

### `typeBusinessItemsRootName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
const typeBusinessItemsRootName = { brand: 'BusinessItemsRootName' };
```

### `typeBusinessLocationsRootName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
const typeBusinessLocationsRootName = { brand: 'BusinessLocationsRootName' };
```

### `typeBusinessTypeName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`

```ts
const typeBusinessTypeName = { brand: 'BusinessTypeName' };
```

### `typeBusinessTypeQuestionName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`

```ts
const typeBusinessTypeQuestionName = { brand: 'BusinessTypeQuestionName' };
```

### `typeBusinessTypeQuestionsRootName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`

```ts
const typeBusinessTypeQuestionsRootName = { brand: 'BusinessTypeQuestionsRootName' };
```

### `typeChartOfAccountsNodeName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
const typeChartOfAccountsNodeName = { brand: 'ChartOfAccountsNodeName' };
```

### `typeChartOfAccountsRootName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`

```ts
const typeChartOfAccountsRootName = { brand: 'ChartOfAccountsRootName' };
```

### `typeCustomerName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`

```ts
const typeCustomerName = { brand: 'CustomerName' };
```

### `typeEntityLinkRecordName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
const typeEntityLinkRecordName = { brand: 'EntityLinkRecordName' };
```

### `typeEquityAccountName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
const typeEquityAccountName = { brand: 'EquityAccountName' };
```

### `typeExpenseCategoryName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`

```ts
const typeExpenseCategoryName = { brand: 'ExpenseCategoryName' };
```

### `typeHiddenMarkerName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
const typeHiddenMarkerName = { brand: 'HiddenMarkerName' };
```

### `typeIsBillingAddressMarkerName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
const typeIsBillingAddressMarkerName = { brand: 'IsBillingAddressMarkerName' };
```

### `typeItemName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
const typeItemName = { brand: 'ItemName' };
```

### `typeLedgerName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`

```ts
const typeLedgerName = { brand: 'LedgerName' };
```

### `typeLineTypeMarkerName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
const typeLineTypeMarkerName = { brand: 'LineTypeMarkerName' };
```

### `typeLocationTypeMarkerName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
const typeLocationTypeMarkerName = { brand: 'LocationTypeMarkerName' };
```

### `typeMenuLinkFlagName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`

```ts
const typeMenuLinkFlagName = { brand: 'MenuLinkFlagName' };
```

### `typeMenuLinkName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`

```ts
const typeMenuLinkName = { brand: 'MenuLinkName' };
```

### `typeMenuOverrideName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
const typeMenuOverrideName = { brand: 'MenuOverrideName' };
```

### `typeMenuSectionName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`

```ts
const typeMenuSectionName = { brand: 'MenuSectionName' };
```

### `typeOpenHoursRecordName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
const typeOpenHoursRecordName = { brand: 'OpenHoursRecordName' };
```

### `typeProjectTaskName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
const typeProjectTaskName = { brand: 'ProjectTaskName' };
```

### `typeRelationshipRecordName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
const typeRelationshipRecordName = { brand: 'RelationshipRecordName' };
```

### `typeRootName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-seed.ts`, `backend/src/routes/divisions.ts`

```ts
const typeRootName = { brand: 'RootName' };
```

### `typeScheduleRecordName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
const typeScheduleRecordName = { brand: 'ScheduleRecordName' };
```

### `typeStorageOriginMarkerName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
const typeStorageOriginMarkerName = { brand: 'StorageOriginMarkerName' };
```

### `typeTextDirectionMarkerName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
const typeTextDirectionMarkerName = { brand: 'TextDirectionMarkerName' };
```

### `typeTranslationConceptName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
const typeTranslationConceptName = { brand: 'TranslationConceptName' };
```

### `typeVendorName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
const typeVendorName = { brand: 'VendorName' };
```

## Router Constants (31, alphabetical)

### `agedRouter`

- **Defined in**: `backend/src/routes/invoices.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const agedRouter = Router();
```

### `arApRouter`

- **Defined in**: `backend/src/routes/arap.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const arApRouter = Router();
```

### `authRouter`

- **Defined in**: `backend/src/routes/auth.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const authRouter = Router();
```

### `belowReorderRouter`

- **Defined in**: `backend/src/routes/locations.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const belowReorderRouter = Router();
```

### `businessesRouter`

- **Defined in**: `backend/src/routes/businesses.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const businessesRouter = Router();
```

### `contactsRouter`

- **Defined in**: `backend/src/routes/contacts.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const contactsRouter = Router();
```

### `customerRegistrationRouter`

- **Defined in**: `backend/src/routes/customer-registration.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const customerRegistrationRouter = Router();
```

### `customerVerificationRouter`

- **Defined in**: `backend/src/routes/customer-registration.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const customerVerificationRouter = Router();
```

### `divisionsRouter`

- **Defined in**: `backend/src/routes/divisions.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const divisionsRouter = Router();
```

### `entitiesRouter`

- **Defined in**: `backend/src/routes/entities.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const entitiesRouter = Router();
```

### `historyRouter`

- **Defined in**: `backend/src/routes/invoices.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const historyRouter = Router();
```

### `i18nRouter`

- **Defined in**: `backend/src/routes/i18n.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const i18nRouter = Router();
```

### `invoiceRouter`

- **Defined in**: `backend/src/routes/invoice.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const invoiceRouter = Router();
```

### `invoicesRouter`

- **Defined in**: `backend/src/routes/invoices.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const invoicesRouter = Router();
```

### `itemsRouter`

- **Defined in**: `backend/src/routes/items.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const itemsRouter = Router();
```

### `journalRouter`

- **Defined in**: `backend/src/routes/journal.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const journalRouter = Router();
```

### `locationsRouter`

- **Defined in**: `backend/src/routes/locations.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const locationsRouter = Router();
```

### `matrixReportsRouter`

- **Defined in**: `backend/src/routes/matrix-reports.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const matrixReportsRouter = Router();
```

### `menuRouter`

- **Defined in**: `backend/src/routes/menu.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const menuRouter = Router();
```

### `periodRouter`

- **Defined in**: `backend/src/routes/period.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const periodRouter = Router();
```

### `posRouter`

- **Defined in**: `backend/src/routes/pos.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const posRouter = Router();
```

### `productsRouter`

- **Defined in**: `backend/src/routes/products.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const productsRouter = Router();
```

### `projectsRouter`

- **Defined in**: `backend/src/routes/projects.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const projectsRouter = Router();
```

### `remindersRouter`

- **Defined in**: `backend/src/routes/invoices.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const remindersRouter = Router();
```

### `reportsRouter`

- **Defined in**: `backend/src/routes/reports.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const reportsRouter = Router();
```

### `statementRouter`

- **Defined in**: `backend/src/routes/invoices.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const statementRouter = Router();
```

### `stockListingRouter`

- **Defined in**: `backend/src/routes/locations.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const stockListingRouter = Router();
```

### `stockLotsRouter`

- **Defined in**: `backend/src/routes/stock-lots.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const stockLotsRouter = Router();
```

### `stockOutRiskRouter`

- **Defined in**: `backend/src/routes/locations.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const stockOutRiskRouter = Router();
```

### `stockRouter`

- **Defined in**: `backend/src/routes/stock.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const stockRouter = Router();
```

### `stockTakesRouter`

- **Defined in**: `backend/src/routes/locations.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
const stockTakesRouter = Router();
```

## Functions (128, alphabetical)

### `addOrUpdateItemSource`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/items.ts`

```ts
function addOrUpdateItemSource(input: ItemSourceInput): void
```

### `addTypedAddress`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/contacts.ts`

```ts
function addTypedAddress(entityName: string, addressType: string, value: Partial<Contact>, userId: UserId): string
```

### `addTypedContactPerson`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/contacts.ts`

```ts
function addTypedContactPerson(entityName: string, contactType: string, value: { name: string; phone?: string | null; email?: string | null }, userId: UserId): string
```

### `addTypedPhone`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/contacts.ts`

```ts
function addTypedPhone(entityName: string, phoneType: string, number: string, userId: UserId): string
```

### `adjustLocationCapacity`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function adjustLocationCapacity(business: BusinessName, ledger: LedgerName, locationName: LocationName, itemName: ItemName, itemQuantityDelta: number, transdate: string, userId: UserId, referenceSuffix: string): void
```

### `asCustomerName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/pos.ts`, `backend/src/routes/arap.ts`, `backend/src/routes/invoices.ts`

```ts
function asCustomerName(name: string): CustomerName
```

### `asDivisionName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-reports.ts`

```ts
function asDivisionName(name: string): DivisionName
```

### `asEmployeeName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/projects.ts`

```ts
function asEmployeeName(name: string): EmployeeName
```

### `asEntityId`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/entities.ts`

```ts
function asEntityId(id: number): EntityId
```

### `asItemName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-seed.ts`, `backend/src/routes/items.ts`, `backend/src/routes/locations.ts`, `backend/src/routes/stock-lots.ts`

```ts
function asItemName(name: string): ItemName
```

### `asLocationName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-seed.ts`, `backend/src/routes/pos.ts`, `backend/src/routes/locations.ts`, `backend/src/routes/arap.ts`, `backend/src/routes/invoices.ts`

```ts
function asLocationName(name: string): LocationName
```

### `asUserId`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/db-seed.ts`, `backend/src/routes/period.ts`, `backend/src/routes/projects.ts`, `backend/src/routes/businesses.ts`, `backend/src/routes/pos.ts`, `backend/src/routes/items.ts`, `backend/src/routes/auth.ts`, `backend/src/routes/i18n.ts`, `backend/src/routes/divisions.ts`, `backend/src/routes/hierarchy.ts`, `backend/src/routes/entities.ts`, `backend/src/routes/locations.ts`, `backend/src/routes/arap.ts`, `backend/src/routes/stock.ts`, `backend/src/routes/products.ts`, `backend/src/routes/invoices.ts`, `backend/src/routes/reports.ts`, `backend/src/routes/stock-lots.ts`, `backend/src/routes/journal.ts`, `backend/src/routes/customer-registration.ts`, `backend/src/routes/contacts.ts`

```ts
function asUserId(id: number): UserId
```

### `asVendorName`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/pos.ts`, `backend/src/routes/locations.ts`, `backend/src/routes/arap.ts`, `backend/src/routes/invoices.ts`

```ts
function asVendorName(name: string): VendorName
```

### `attachUser`

- **Defined in**: `backend/src/auth-middleware.ts`
- **Referenced in**: `backend/src/server.ts`

```ts
function attachUser(req: Request, _res: Response, next: NextFunction): void
```

### `authenticateCustomer`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/customer-registration.ts`

```ts
function authenticateCustomer(name: string, password: string): boolean
```

### `buildProfitAndLossFromBalances`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `backend/src/db-matrix-reports.ts`

```ts
function buildProfitAndLossFromBalances(balances: Map<number, number>): ProfitAndLoss
```

### `changeOwnPassword`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: `backend/src/routes/auth.ts`

```ts
function changeOwnPassword(userId: number, currentPassword: string, newPassword: string): void
```

### `changePassword`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: `backend/src/routes/auth.ts`

```ts
function changePassword(userId: number, newPassword: string): void
```

### `checkEInvoiceDiscrepancies`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function checkEInvoiceDiscrepancies(parsed: UblImportResult, poReference?: string): EInvoiceDiscrepancy[]
```

### `countStockListing`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/routes/locations.ts`

```ts
function countStockListing(): number
```

### `createDivisionType`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/divisions.ts`

```ts
function createDivisionType(name: string, userId: UserId): void
```

### `createLocationType`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/routes/locations.ts`

```ts
function createLocationType(name: string, userId: UserId): void
```

### `createProduct`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/products.ts`

```ts
function createProduct(name: string, parent: string, userId: UserId): void
```

### `createSystemEntity`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function createSystemEntity(name: string, parentId: number | null): number
```

### `deleteBomComponent`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/items.ts`

```ts
function deleteBomComponent(assemblyItem: string, componentItem: string, userId: UserId): void
```

### `deleteDimensionParent`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function deleteDimensionParent(entityName: string, dimensionName: string, userId: UserId): void
```

### `deleteItemSource`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/items.ts`

```ts
function deleteItemSource(id: number): void
```

### `deleteMenuOverride`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/menu.ts`

```ts
function deleteMenuOverride(menuItemKey: string, scope: 'business' | 'user', scopeId: number, userId: UserId = asUserId(1)): void
```

### `deleteTypedAddress`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/contacts.ts`

```ts
function deleteTypedAddress(entityName: string, addressType: string, userId: UserId): void
```

### `deleteTypedContactPerson`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/contacts.ts`

```ts
function deleteTypedContactPerson(entityName: string, contactType: string, userId: UserId): void
```

### `deleteTypedPhone`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/contacts.ts`

```ts
function deleteTypedPhone(entityName: string, phoneType: string, userId: UserId): void
```

### `deleteVocabularyPreference`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/i18n.ts`

```ts
function deleteVocabularyPreference(conceptName: string, scope: 'business' | 'user', scopeId: number): void
```

### `dispatchOrderFromPickingList`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/invoices.ts`

```ts
function dispatchOrderFromPickingList(invoiceId: number, locationName: LocationName, revenueAccount: string, taxAccount: string, userId: UserId): void
```

### `ensureAddressType`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
function ensureAddressType(typeName: string, userId: UserId): void
```

### `ensureContactPersonType`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function ensureContactPersonType(typeName: string, userId: UserId): void
```

### `ensureLocationCapacityAccount`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function ensureLocationCapacityAccount(business: BusinessName, ledger: LedgerName, locationName: LocationName, userId: UserId): 
```

### `ensurePhoneType`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function ensurePhoneType(typeName: string, userId: UserId): void
```

### `ensureProductTierItem`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function ensureProductTierItem(baseProductName: ItemName, tier: string, userId: UserId): 
```

### `exportInvoiceAsUbl`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/invoices.ts`

```ts
function exportInvoiceAsUbl(invoiceId: number): string
```

### `getAccountsPostedTo`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function getAccountsPostedTo(reference: string): string[]
```

### `getActiveShiftsAtLocation`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function getActiveShiftsAtLocation(locationName: string): PosShift[]
```

### `getAgingBuckets`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function getAgingBuckets(paymentTermsDays: number | null): AgingBucket[]
```

### `getAllTranslations`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function getAllTranslations(languageName: string): Record<string, string>
```

### `getAxisValues`

- **Defined in**: `backend/src/db-matrix-reports.ts`
- **Referenced in**: `backend/src/routes/matrix-reports.ts`

```ts
function getAxisValues(businessName: BusinessName, ledgerName: LedgerName): AxisValues
```

### `getBankAccounts`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/reports.ts`

```ts
function getBankAccounts(business: BusinessName, ledger: LedgerName): BankAccountRow[]
```

### `getBusinesses`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/businesses.ts`

```ts
function getBusinesses(): 
```

### `getCashFlowForecast`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/reports.ts`

```ts
function getCashFlowForecast(business: BusinessName, ledger: LedgerName, asOfDate: string, horizonDays: number): CashFlowForecast
```

### `getChartOfAccounts`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `backend/src/db.ts`, `backend/src/routes/reports.ts`

```ts
function getChartOfAccounts(): ChartRow[]
```

### `getConceptsWithAlternates`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/i18n.ts`

```ts
function getConceptsWithAlternates(): ConceptWithAlternates[]
```

### `getCreditStatus`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/contacts.ts`

```ts
function getCreditStatus(entityName: string): CreditStatus
```

### `getDimensionAncestorChain`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function getDimensionAncestorChain(entityName: string, dimensionName: string): string[]
```

### `getDimensionLinksPointingAt`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/entities.ts`

```ts
function getDimensionLinksPointingAt(targetName: string): 
```

### `getDivisions`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-reports.ts`, `backend/src/db-seed.ts`, `backend/src/routes/divisions.ts`

```ts
function getDivisions(): 
```

### `getDivisionType`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function getDivisionType(divisionName: string): string | null
```

### `getDivisionTypes`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/divisions.ts`

```ts
function getDivisionTypes(): string[]
```

### `getEmployeeSchedule`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/locations.ts`

```ts
function getEmployeeSchedule(employeeName: string): EmployeeScheduleLine[]
```

### `getExpiringStock`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/routes/stock-lots.ts`

```ts
function getExpiringStock(asOfDate: string, withinDays: number): ExpiringLot[]
```

### `getInvoiceOutstandingMinor`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/invoices.ts`

```ts
function getInvoiceOutstandingMinor(invoiceId: number): number
```

### `getItemByUpc`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/pos.ts`

```ts
function getItemByUpc(upc: string): ItemSummary | undefined
```

### `getItemLeadTimes`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function getItemLeadTimes(itemName: ItemName): 
```

### `getItemLocation`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/db.ts`, `backend/src/routes/locations.ts`

```ts
function getItemLocation(itemName: ItemName, locationName: LocationName): ItemLocationLevels
```

### `getItemProduct`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function getItemProduct(itemName: string): string | null
```

### `getLanguages`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-seed.ts`, `backend/src/routes/i18n.ts`

```ts
function getLanguages(): 
```

### `getLedgerBalancesByDivision`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function getLedgerBalancesByDivision(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, excludeCloseEntries = false): Map<number, Map<string | null, number>>
```

### `getLedgerBalancesByDivisionStructural`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function getLedgerBalancesByDivisionStructural(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string, excludeCloseEntries = false): Map<number, Map<string | null, number>>
```

### `getLedgerDateRange`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/reports.ts`

```ts
function getLedgerDateRange(businessName: BusinessName, ledgerName: LedgerName): LedgerDateRange
```

### `getLedgers`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/businesses.ts`

```ts
function getLedgers(businessName: BusinessName): 
```

### `getLocalizedText`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/invoice.ts`, `backend/src/routes/i18n.ts`

```ts
function getLocalizedText(language: string, opts?: { businessName?: string; userId?: number }): Record<string, string>
```

### `getLocationCapacityStatus`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function getLocationCapacityStatus(locationName: LocationName): LocationCapacityStatus
```

### `getLocationOpenHours`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/locations.ts`

```ts
function getLocationOpenHours(locationName: string): OpenHoursLine[]
```

### `getLocationTypes`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/routes/locations.ts`

```ts
function getLocationTypes(): string[]
```

### `getMenuTree`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/menu.ts`

```ts
function getMenuTree(opts?: { businessName?: string; userId?: number }): MenuSectionRow[]
```

### `getOpenShiftForEmployee`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function getOpenShiftForEmployee(employeeName: string): PosShift | undefined
```

### `getPickingList`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/invoices.ts`

```ts
function getPickingList(invoiceId: number, locationName: LocationName): PickingListLine[]
```

### `getProductUnitCostMinor`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`

```ts
function getProductUnitCostMinor(itemName: ItemName): number | null
```

### `getProfitAndLossByAxis`

- **Defined in**: `backend/src/db-matrix-reports.ts`
- **Referenced in**: `backend/src/routes/matrix-reports.ts`

```ts
function getProfitAndLossByAxis(businessName: BusinessName, ledgerName: LedgerName, fromDate: string | undefined, toDate: string | undefined, outerAxis: MatrixAxis, innerAxis: MatrixAxis, outerFilter?: string, innerFilter?: string): ProfitAndLossByAxisNode[]
```

### `getProfitAndLossByDivision`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `backend/src/routes/reports.ts`

```ts
function getProfitAndLossByDivision(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string): ProfitAndLossByDivision[]
```

### `getProfitAndLossByDivisionTree`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `backend/src/routes/reports.ts`

```ts
function getProfitAndLossByDivisionTree(businessName: BusinessName, ledgerName: LedgerName, fromDate?: string, toDate?: string): ProfitAndLossByDivisionNode[]
```

### `getSalesCogsMatrix`

- **Defined in**: `backend/src/db-matrix-reports.ts`
- **Referenced in**: `backend/src/routes/matrix-reports.ts`

```ts
function getSalesCogsMatrix(businessName: BusinessName, ledgerName: LedgerName, fromDate: string | undefined, toDate: string | undefined, rowAxis: MatrixAxis, colAxis: MatrixAxis): SalesCogsMatrix
```

### `getSalesReport`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `backend/src/routes/reports.ts`

```ts
function getSalesReport(business: BusinessName, ledger: LedgerName, fromDate?: string, toDate?: string): SalesReport
```

### `getScheduleAtLocation`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/locations.ts`

```ts
function getScheduleAtLocation(locationName: string): LocationScheduleLine[]
```

### `getScreenTitle`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function getScreenTitle(href: string, opts?: { businessName?: string; userId?: number }): string | undefined
```

### `getSessionUser`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: `backend/src/auth-middleware.ts`

```ts
function getSessionUser(token: string | undefined): AuthenticatedUser | null
```

### `getStockListingByLocation`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/routes/locations.ts`

```ts
function getStockListingByLocation(): StockListingLocationGroup[]
```

### `getStockMovementReport`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/routes/locations.ts`

```ts
function getStockMovementReport(ledgerName: string, fromDate?: string, toDate?: string): StockMovementReport
```

### `getStockOnHandMatrix`

- **Defined in**: `backend/src/db-matrix-reports.ts`
- **Referenced in**: `backend/src/routes/matrix-reports.ts`

```ts
function getStockOnHandMatrix(rowAxis: MatrixAxis, colAxis: MatrixAxis): StockOnHandMatrix
```

### `getStockOutRiskReport`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/routes/locations.ts`

```ts
function getStockOutRiskReport(windowDays: number = 2): StockOutRiskRow[]
```

### `getStockTake`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/routes/locations.ts`

```ts
function getStockTake(id: number): StockTake | undefined
```

### `getVocabularyAlternates`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/i18n.ts`

```ts
function getVocabularyAlternates(wordName: string): string[]
```

### `hashPassword`

- **Defined in**: `backend/src/password.ts`
- **Referenced in**: `backend/src/auth.ts`, `backend/src/db.ts`

```ts
function hashPassword(password: string): string
```

### `listAddressTypes`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/routes/contacts.ts`

```ts
function listAddressTypes(): string[]
```

### `listContactPersonTypes`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/contacts.ts`

```ts
function listContactPersonTypes(): string[]
```

### `listItemSources`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/items.ts`

```ts
function listItemSources(itemName: string): ItemSource[]
```

### `listPendingCustomers`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/customer-registration.ts`

```ts
function listPendingCustomers(): PendingCustomer[]
```

### `listPhoneTypes`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/contacts.ts`

```ts
function listPhoneTypes(): string[]
```

### `listRoles`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: `backend/src/routes/auth.ts`

```ts
function listRoles(): 
```

### `listUsers`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: `backend/src/routes/auth.ts`

```ts
function listUsers(): UserSummary[]
```

### `logout`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: `backend/src/routes/auth.ts`

```ts
function logout(token: string): void
```

### `parseUblInvoice`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function parseUblInvoice(xml: string): UblImportResult
```

### `previewCloseBooks`

- **Defined in**: `backend/src/db-reports.ts`
- **Referenced in**: `backend/src/routes/journal.ts`

```ts
function previewCloseBooks(businessName: BusinessName, ledger: LedgerName, asOfDate: string, retainedEarningsAccount: string): CloseBooksPreview
```

### `recordReminderSent`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/invoices.ts`

```ts
function recordReminderSent(customerName: string): number
```

### `registerBankAccount`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/reports.ts`

```ts
function registerBankAccount(accountName: string, business: string, scopeName: string, overdraftLimitMinor: number | null, userId: UserId): void
```

### `registerCustomer`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/customer-registration.ts`

```ts
function registerCustomer(input: CustomerRegistrationInput, userId: UserId): void
```

### `removeContactType`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function removeContactType(contactName: string, typeName: string, userId: UserId): void
```

### `requireAuth`

- **Defined in**: `backend/src/auth-middleware.ts`
- **Referenced in**: `backend/src/server.ts`, `backend/src/routes/auth.ts`, `backend/src/routes/i18n.ts`

```ts
function requireAuth(req: Request, res: Response, next: NextFunction): void
```

### `resetReminderLevel`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/invoices.ts`

```ts
function resetReminderLevel(customerName: string): void
```

### `setDivisionType`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/db-stock.ts`, `backend/src/routes/divisions.ts`

```ts
function setDivisionType(divisionNameOrId: string | EntityId, typeMarkerName: string): void
```

### `setEmployeeSchedule`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/locations.ts`

```ts
function setEmployeeSchedule(employeeName: string, locationName: string, schedule: ScheduleLine[]): void
```

### `setItemLocationLevelDetails`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function setItemLocationLevelDetails(itemName: ItemName, locationName: LocationName, levels: Omit<ItemLocationLevels, 'quantity_on_hand'>, userId: UserId): void
```

### `setItemLocationLevels`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/db-seed.ts`, `backend/src/routes/locations.ts`

```ts
function setItemLocationLevels(itemName: ItemName, locationName: LocationName, levels: {
    minLevel?: number | null;
    maxLevel?: number | null;
    reorderLevel?: number | null;
    shelfSide?: string | null;
    rack?: string | null;
    level?: number | null;
  }): void
```

### `setItemProduct`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/products.ts`

```ts
function setItemProduct(itemName: string, productName: string | null, userId: UserId): void
```

### `setItemSourceLeadTime`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/routes/locations.ts`

```ts
function setItemSourceLeadTime(itemName: ItemName, vendorName: VendorName, days: number, userId: UserId): void
```

### `setLocationOpenHours`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/locations.ts`

```ts
function setLocationOpenHours(locationName: string, hours: OpenHoursLine[]): void
```

### `setMenuOverride`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/menu.ts`, `backend/src/primitives.ts`

```ts
function setMenuOverride(menuItemKey: string, scope: 'business' | 'user', scopeId: number, overrideLabel: string | null, hidden: boolean, userId: UserId = asUserId(1)): void
```

### `setOwnDateFormat`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: `backend/src/routes/auth.ts`

```ts
function setOwnDateFormat(userId: number, dateFormat: string): void
```

### `setOwnNumberFormat`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: `backend/src/routes/auth.ts`

```ts
function setOwnNumberFormat(userId: number, numberFormat: string): void
```

### `setOwnPageSize`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: `backend/src/routes/auth.ts`

```ts
function setOwnPageSize(userId: number, pageSize: number): void
```

### `setPosPin`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function setPosPin(employeeName: string, pin: string): void
```

### `setUserActive`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: `backend/src/routes/auth.ts`

```ts
function setUserActive(userId: number, active: boolean): void
```

### `setUserRoles`

- **Defined in**: `backend/src/auth.ts`
- **Referenced in**: `backend/src/routes/auth.ts`

```ts
function setUserRoles(userId: number, roleNames: string[]): void
```

### `setVocabularyPreference`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/i18n.ts`

```ts
function setVocabularyPreference(conceptName: string, scope: 'business' | 'user', scopeId: number, preferredAlternateName: string): void
```

### `signOff`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function signOff(shiftId: number): void
```

### `signOn`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function signOn(employeeName: string, locationName: string): PosShift
```

### `todayAtLocation`

- **Defined in**: `backend/src/db-stock.ts`
- **Referenced in**: `backend/src/db.ts`

```ts
function todayAtLocation(locationName: LocationName): string
```

### `unregisterBankAccount`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/reports.ts`

```ts
function unregisterBankAccount(accountName: string, userId: UserId): void
```

### `verifyCustomer`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: `backend/src/routes/customer-registration.ts`

```ts
function verifyCustomer(customerName: string, approve: boolean): void
```

### `verifyPassword`

- **Defined in**: `backend/src/password.ts`
- **Referenced in**: `backend/src/auth.ts`, `backend/src/db.ts`

```ts
function verifyPassword(password: string, stored: string): boolean
```

### `verifyPosPin`

- **Defined in**: `backend/src/db.ts`
- **Referenced in**: (no other real, core backend file references this directly)

```ts
function verifyPosPin(employeeName: string, pin: string): boolean
```

191 real, tracked baseline names reported (32 TypeDescriptor constants, 31 router constants, 128 functions, 0 other constants) out of 212 total names in the baseline file.
