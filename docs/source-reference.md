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

**Exported variables**: `fixtures`

### `shared-fixtures/add-brand-translation.ts`


### `shared-fixtures/csv.ts`

**Functions**: `escapeAscii`, `unescapeAscii`, `readCsv`, `writeCsv`

### `shared-fixtures/translations.ts`

**Functions**: `loadAllTranslations`
**Types**: `TranslationRow`

### `shared-fixtures/add-journal-translations.ts`


### `shared-fixtures/add-header-translations.ts`


### `shared-fixtures/add-menu-translations.ts`


### `shared-fixtures/wine-retail-demo-data.ts`

**Functions**: `loadDemoLocations`, `loadDemoUpcs`, `loadDemoCategories`, `loadDemoProducts`, `loadDemoStockLevels`
**Types**: `DemoLocation`, `DemoUpc`, `DemoCategory`, `DemoProduct`, `DemoStockLevel`

### `shared-fixtures/add-journal-remaining-translations.ts`



## Backend Files

### `backend/src/db-stock.ts`

**Functions**: `stageQuantityMovementLine`, `postStagedQuantityMovement`, `postQuantityMovement`, `getLocationTypes`, `createLocationType`, `setLocation`, `getLocation`, `todayAtLocation`, `getItemLocation`, `setItemLocationLevelDetails`, `getLocationCapacityStatus`, `createPosTerminal`, `setTerminalCurrency`, `getEffectiveSaleCurrency`, `ensureLocationCapacityAccount`, `adjustLocationCapacity`, `getStockListingByLocation`, `getStockMovementReport`, `getStockListing`, `countStockListing`, `setItemLocationLevels`, `receiveStockAtLocation`, `dispatchStockFromLocation`, `transferStock`, `getBelowReorderStock`, `setItemSourceLeadTime`, `getItemLeadTimes`, `getStockOutRiskReport`, `createStockTake`, `getStockTake`, `recordStockTakeCount`, `completeStockTake`, `writeOffStock`, `receiveLot`, `consumeFromLots`, `getExpiringStock`, `createSystemEntity`, `placeOrder`, `fulfillOrder`, `getOrderStatus`
**Types**: `Location`, `ItemLocationLevels`, `LocationCapacityStatus`, `StockListingRow`, `StockListingLocationGroup`, `StockMovementRow`, `StockReceiptRow`, `StockTransferRow`, `StockSaleRow`, `StockMovementReport`, `BelowReorderRow`, `StockOutRiskRow`, `StockTakeLine`, `StockTake`, `ExpiringLot`

### `backend/src/db-reports.ts`

**Functions**: `getBusinessReports`, `setAccountCurrency`, `getChartOfAccounts`, `getLedgerBalancesByDivision`, `getLedgerBalancesByDivisionStructural`, `getLedgerBalances`, `getTrialBalance`, `getBalanceSheet`, `buildCategoryTree`, `getProfitAndLoss`, `buildProfitAndLossFromBalances`, `getProfitAndLossByDivision`, `getProfitAndLossByDivisionTree`, `getTrialBalanceComparison`, `previewCloseBooks`, `closeBooks`, `getSalesReport`, `getProfitAndLossComparison`
**Types**: `ReportRow`, `ChartRow`, `TrialBalanceRow`, `TrialBalance`, `StatementLine`, `BalanceSheet`, `ProfitAndLoss`, `CategoryTreeNode`, `ProfitAndLossByDivision`, `ProfitAndLossByDivisionNode`, `TrialBalanceComparisonRow`, `TrialBalanceComparison`, `ProfitAndLossComparisonLine`, `ProfitAndLossComparison`, `CloseBooksResult`, `CloseBooksLine`, `CloseBooksPreview`, `SalesReportLine`, `SalesCategorySummary`, `SalesReport`

### `backend/src/auth.ts`

**Functions**: `listUsers`, `listRoles`, `createUser`, `setUserRoles`, `setUserActive`, `changePassword`, `changeOwnPassword`, `login`, `logout`, `getSessionUser`, `setOwnPageSize`, `setOwnNumberFormat`, `setOwnDateFormat`
**Types**: `UserSummary`, `AuthenticatedUser`

### `backend/src/db.ts`

**Functions**: `asUserId`, `asEntityId`, `asBusinessName`, `asLedgerName`, `asAccountName`, `asDivisionName`, `asLocationName`, `asEmployeeName`, `asCustomerName`, `asVendorName`, `asItemName`, `getEntityTree`, `getEntity`, `getEntityHistory`, `resolveItemId`, `createEntity`, `updateEntity`, `listLineTypes`, `setLineType`, `getLineType`, `setItemStorageOrigin`, `getItemStorageOrigin`, `setLanguageDirection`, `getLanguageDirection`, `reorderSiblings`, `reorderSiblingsBulk`, `setRelationship`, `getRelationship`, `getEntitiesWithRelationship`, `getHierarchy`, `getOrganizationChart`, `deleteEntity`, `getCreditStatus`, `getAgingBuckets`, `createInvoice`, `getInvoice`, `exportInvoiceAsUbl`, `parseUblInvoice`, `checkEInvoiceDiscrepancies`, `importUblInvoiceAsDraft`, `getPickingList`, `confirmPickedLine`, `dispatchOrderFromPickingList`, `getRestockPickingList`, `confirmRestockPickedLine`, `dispatchRestockFromPickingList`, `listInvoices`, `countInvoices`, `postInvoice`, `allocatePayment`, `getInvoiceOutstandingMinor`, `getAgedInvoices`, `getAgedSummary`, `getCustomerStatement`, `getCounterpartyHistory`, `getItemByUpc`, `getAncestorChain`, `ensureCategoryChain`, `ensureProductSalesCogsAccounts`, `ensureProductInventoryAccount`, `ensureProductLocationInventoryAccount`, `getProductUnitCostMinor`, `ensureProductTierItem`, `ensureProductTierLocationLeaf`, `ensureProductLocationLeaf`, `getLocationForAccount`, `getDivisionForAccount`, `ensureProductQuantityAccounts`, `cityDivisionFor`, `resolveDispatchLocation`, `completePosSale`, `completeCashPurchase`, `payEmployeeWages`, `recordReminderSent`, `resetReminderLevel`, `getReminderCandidates`, `getContact`, `getInvoiceLine`, `getAccountsPostedTo`, `setContact`, `setPosPin`, `signOn`, `verifyPosPin`, `signOff`, `getActiveShiftsAtLocation`, `getOpenShiftForEmployee`, `setLocationOpenHours`, `getLocationOpenHours`, `setEmployeeSchedule`, `getEmployeeSchedule`, `getScheduleAtLocation`, `ensureAddressType`, `listAddressTypes`, `addTypedAddress`, `getTypedAddresses`, `deleteTypedAddress`, `ensurePhoneType`, `listPhoneTypes`, `addTypedPhone`, `getTypedPhones`, `deleteTypedPhone`, `ensureContactPersonType`, `listContactPersonTypes`, `addTypedContactPerson`, `getTypedContactPersons`, `deleteTypedContactPerson`, `setEntityLink`, `getEntityLink`, `deleteEntityLink`, `stageBomComponent`, `postBomComponents`, `deleteBomComponent`, `getBomComponents`, `createProjectTask`, `getProjectTasks`, `addTaskDependency`, `getTaskDependencies`, `setDimensionParent`, `getDimensionParent`, `deleteDimensionParent`, `setContactType`, `removeContactType`, `getContactTypes`, `getContactBaseAccounts`, `getContactsWithType`, `getDimensionChildren`, `getDimensionLinksPointingAt`, `getDimensionAncestorChain`, `registerBankAccount`, `unregisterBankAccount`, `getBankAccounts`, `getCashPosition`, `getCashFlowForecast`, `registerCustomer`, `listPendingCustomers`, `verifyCustomer`, `authenticateCustomer`, `listProducts`, `createProduct`, `getItemProduct`, `setItemProduct`, `getItem`, `setItem`, `listItems`, `countItems`, `createItem`, `listItemSources`, `addOrUpdateItemSource`, `getItemPriceForCurrency`, `deleteItemSource`, `getLanguages`, `getDefaultLanguage`, `setDefaultLanguage`, `getDivisions`, `getMenuTree`, `getScreenTitle`, `setMenuOverride`, `deleteMenuOverride`, `setDivisionType`, `getDivisionType`, `getDivisionTypes`, `createDivisionType`, `getVocabularyWords`, `getVocabularyAlternates`, `getConceptsWithAlternates`, `setVocabularyPreference`, `deleteVocabularyPreference`, `getLocalizedText`, `setTranslation`, `getAllTranslations`, `getTranslation`, `getBusinesses`, `getLedgers`, `setupEquityStructure`, `getBusinessTypes`, `saveBusinessTypeAnswers`, `copyChartOfAccountsInto`, `instantiateChartOfAccounts`, `createBusiness`, `getCoaFamilyAccounts`, `stageLine`, `getStagedLines`, `createRecurringJournal`, `ensureLocationScopedAccount`, `stageArSale`, `postArSale`, `stageArReceipt`, `postArReceipt`, `stageApPurchase`, `postApPurchase`, `stageApPayment`, `postApPayment`, `stagePurchaseOrder`, `postPurchaseOrder`, `clockInToProject`, `clockOutOfProject`, `getOpenProjectClockForEmployee`, `stageStockReceipt`, `postStockReceipt`, `stageSalesOrder`, `postSalesOrder`, `stageStockDispatch`, `postStockDispatch`, `removeStagedLine`, `postJournalEntry`, `listJournalEntries`, `countJournalEntries`, `getJournalEntry`, `getLedgerDateRange`, `getPeriodLockStatus`, `closePeriod`, `reopenPeriod`, `assertPeriodOpen`, `reverseJournalEntry`
**Types**: `EntityNode`, `EntityHistoryRow`, `NewEntity`, `EntityUpdate`, `Relationship`, `OrgChartDivision`, `OrganizationChart`, `HierarchyNode`, `AgingBucket`, `CreditStatus`, `InvoiceLineInput`, `InvoiceInput`, `Invoice`, `UblImportLine`, `UblImportResult`, `EInvoiceDiscrepancy`, `PickingListLine`, `RestockLineInput`, `ListInvoicesOptions`, `AgedInvoiceRow`, `AgedSummaryRow`, `StatementLine`, `CustomerStatement`, `HistoryLine`, `PosSaleLineInput`, `PosSaleInput`, `PosSaleResult`, `CashPurchaseLineInput`, `CashPurchaseInput`, `CashPurchaseResult`, `PayEmployeeWagesInput`, `PayEmployeeWagesResult`, `ReminderCandidate`, `Contact`, `InvoiceLine`, `PosShift`, `OpenHoursLine`, `ScheduleLine`, `EmployeeScheduleLine`, `LocationScheduleLine`, `TypedAddress`, `TypedPhone`, `ContactPerson`, `BankAccountRow`, `CashPositionByCurrency`, `ForecastLine`, `CashFlowForecast`, `CustomerRegistrationInput`, `PendingCustomer`, `ProductSummary`, `Item`, `ItemSummary`, `ItemSource`, `ItemSourceInput`, `MenuLinkRow`, `MenuSectionRow`, `VocabularyWord`, `ConceptWithAlternates`, `BusinessTypeInfo`, `StagedLine`, `RecurringJournalLine`, `ArSaleInput`, `ArReceiptInput`, `ApPurchaseInput`, `ApPaymentInput`, `PurchaseOrderInput`, `EmployeeClock`, `StockReceiptInput`, `SalesOrderInput`, `StockDispatchInput`, `JournalSummary`, `JournalDetail`, `PeriodLockStatus`, `LedgerDateRange`, `BusinessName`, `LedgerName`, `AccountName`, `DivisionName`, `LocationName`, `EmployeeName`, `CustomerName`, `VendorName`, `ItemName`, `UserId`, `EntityId`, `EntityStructure`, `Recurrence`
**Exported variables**: `db`

### `backend/src/server.ts`


### `backend/src/db-matrix-reports.ts`

**Functions**: `getSalesCogsMatrix`, `getStockOnHandMatrix`, `getProfitAndLossByAxis`, `getAxisValues`
**Types**: `MatrixCell`, `SalesCogsMatrix`, `StockOnHandCell`, `StockOnHandMatrix`, `ProfitAndLossByAxisNode`, `AxisValues`, `MatrixAxis`

### `backend/src/invoice.ts`

**Types**: `InvoiceOptions`

### `backend/src/auth-middleware.ts`

**Functions**: `attachUser`, `requireAuth`, `requireRole`

### `backend/src/password.ts`

**Functions**: `hashPassword`, `verifyPassword`

### `backend/src/db-seed.ts`

**Functions**: `seedRemainingData`

### `backend/src/primitives.ts`

**Types**: `HierarchyTreeNode`
**Exported variables**: `Entity`, `Link`, `Balance`, `Hierarchy`, `Currency`, `Detail`


## Frontend Files

### `frontend/src/lib/matrix-api.ts`

**Types**: `MatrixCell`, `SalesCogsMatrix`, `StockOnHandCell`, `StockOnHandMatrix`, `ProfitAndLossByAxisNode`, `AxisValues`, `MatrixAxis`
**Exported variables**: `getSalesCogsMatrix`, `getStockOnHandMatrix`, `getProfitAndLossByAxis`, `getAxisValues`

### `frontend/src/lib/api.ts`

**Functions**: `asBusinessName`, `asLedgerName`, `asAccountName`, `asDivisionName`, `asLocationName`, `asEmployeeName`, `asCustomerName`, `asVendorName`, `asItemName`
**Types**: `EntityNode`, `DimensionLinkPointingAt`, `ReportRow`, `ChartRow`, `BankAccountRow`, `CashPositionByCurrency`, `ForecastLine`, `CashFlowForecast`, `TrialBalanceRow`, `TrialBalance`, `SalesReportLine`, `SalesCategorySummary`, `SalesReport`, `StatementLine`, `BalanceSheet`, `MenuLinkRow`, `MenuSectionRow`, `CategoryTreeNode`, `ProfitAndLoss`, `ProfitAndLossByDivision`, `ProfitAndLossByDivisionNode`, `LedgerDateRange`, `ConceptWithAlternates`, `VocabularyWord`, `DivisionRecord`, `StagedLine`, `JournalSummary`, `JournalDetail`, `TrialBalanceComparisonRow`, `TrialBalanceComparison`, `ProfitAndLossComparisonLine`, `ProfitAndLossComparison`, `Contact`, `CreditStatus`, `TypedAddress`, `TypedPhone`, `ContactPerson`, `RecurringJournalLine`, `ArApBaseInput`, `LoginResponse`, `UserSummary`, `PurchaseOrderInput`, `StockReceiptInput`, `SalesOrderInput`, `StockDispatchInput`, `PeriodLockStatus`, `Item`, `ItemSummary`, `ItemSource`, `ItemSourceInput`, `ProductSummary`, `InvoiceLine`, `InvoiceInput`, `Invoice`, `EInvoiceDiscrepancy`, `ImportEInvoiceResult`, `AgedRow`, `AgedSummaryRow`, `StatementLine`, `CustomerStatement`, `HistoryLine`, `ReminderCandidate`, `ExpiringLot`, `LocationInput`, `LocationRecord`, `EmployeeClock`, `OpenHoursLine`, `ScheduleLine`, `EmployeeScheduleLine`, `LocationScheduleLine`, `ItemLocationLevels`, `BelowReorderRow`, `StockOutRiskRow`, `PickingListLine`, `RestockLineInput`, `StockTakeLine`, `StockTake`, `PosSaleLineInput`, `PosSaleResult`, `CashPurchaseLineInput`, `CashPurchaseResult`, `PayWagesResult`, `OrganizationChart`, `CloseBooksResult`, `CloseBooksPreview`, `CustomerRegistrationInput`, `PendingCustomer`, `StockListingRow`, `LocationCapacityStatus`, `StockListingLocationGroup`, `StockMovementRow`, `StockReceiptRow`, `StockTransferRow`, `StockSaleRow`, `StockMovementReport`, `BusinessName`, `LedgerName`, `AccountName`, `DivisionName`, `LocationName`, `EmployeeName`, `CustomerName`, `VendorName`, `ItemName`, `BomComponent`
**Exported variables**: `getEntityTree`, `getDimensionLinksPointingAt`, `createEntity`, `setEntityRelationship`, `updateEntity`, `deleteEntity`, `getBusinessReports`, `getChartOfAccounts`, `getBankAccounts`, `getCashPosition`, `getCashFlowForecast`, `registerBankAccount`, `unregisterBankAccount`, `getTrialBalance`, `getSalesReport`, `getMenuTree`, `setMenuOverride`, `deleteMenuOverride`, `getBalanceSheet`, `getProfitAndLoss`, `getProfitAndLossByDivision`, `getProfitAndLossByDivisionTree`, `getLedgerDateRange`, `getLanguages`, `getLanguageDirection`, `setLanguageDirection`, `getDefaultLanguage`, `setDefaultLanguage`, `getLocalizedText`, `getVocabularyAlternates`, `getConceptsWithAlternates`, `getVocabularyWords`, `setVocabularyPreference`, `deleteVocabularyPreference`, `setTranslation`, `getDivisions`, `createDivision`, `getBusinesses`, `getBusinessTypes`, `saveBusinessTypeAnswers`, `getLedgers`, `createBusiness`, `getCoaFamilyAccounts`, `stageLine`, `getStagedLines`, `removeStagedLine`, `postJournalEntry`, `listJournalEntries`, `getJournalEntry`, `getTrialBalanceComparison`, `getProfitAndLossComparison`, `getContact`, `setContact`, `getCreditStatus`, `getTypedAddresses`, `setTypedAddress`, `deleteTypedAddress`, `getTypedPhones`, `setTypedPhone`, `deleteTypedPhone`, `listContactPersonTypes`, `listAddressTypes`, `getLocationTypes`, `createLocationType`, `listPhoneTypes`, `getTypedContactPersons`, `setTypedContactPerson`, `deleteTypedContactPerson`, `createRecurringJournal`, `stageArSale`, `postArSale`, `stageArReceipt`, `postArReceipt`, `stageApPurchase`, `postApPurchase`, `stageApPayment`, `postApPayment`, `apiLogin`, `apiLogout`, `getUsers`, `getRoles`, `createUserAccount`, `setUserRolesApi`, `setUserActiveApi`, `changeUserPassword`, `reverseJournalEntry`, `stagePurchaseOrder`, `postPurchaseOrder`, `stageStockReceipt`, `postStockReceipt`, `stageSalesOrder`, `postSalesOrder`, `stageStockDispatch`, `postStockDispatch`, `getOrderStatus`, `getPeriodStatus`, `closePeriod`, `reopenPeriod`, `changeOwnPassword`, `setOwnPageSize`, `setOwnNumberFormat`, `setOwnDateFormat`, `getItemStorageOrigin`, `setItemStorageOrigin`, `getBomComponents`, `setBomComponent`, `deleteBomComponent`, `listItems`, `getItem`, `listProducts`, `createProduct`, `setItemProduct`, `setItem`, `listItemSources`, `addOrUpdateItemSource`, `deleteItemSource`, `listInvoices`, `getInvoiceById`, `createInvoice`, `postInvoiceById`, `getInvoiceOutstanding`, `allocatePaymentToInvoice`, `importEInvoice`, `getAgedInvoices`, `getAgedSummary`, `getCustomerStatement`, `getCounterpartyHistory`, `getReminderCandidates`, `sendReminder`, `resetReminder`, `writeOffStock`, `receiveLot`, `getExpiringStock`, `listLocations`, `clockInToProject`, `clockOutOfProject`, `getOpenProjectClock`, `getLocationByName`, `saveLocation`, `getLocationOpenHours`, `setLocationOpenHours`, `getScheduleAtLocation`, `getEmployeeSchedule`, `setEmployeeSchedule`, `getItemLocation`, `setItemLocationLevels`, `receiveStockAtLocation`, `dispatchStockFromLocation`, `transferStock`, `getBelowReorderStock`, `getStockOutRiskReport`, `setItemSourceLeadTime`, `getRestockPickingList`, `confirmRestockPickedLine`, `dispatchRestockRun`, `createStockTake`, `getStockTake`, `recordStockTakeCount`, `completeStockTake`, `lookupItemByUpc`, `completePosSale`, `completeCashPurchase`, `payEmployeeWages`, `getOrganizationChart`, `closeBooks`, `previewCloseBooks`, `registerCustomer`, `listPendingCustomers`, `verifyCustomer`, `getStockListing`, `getStockListingByLocation`, `getStockMovementReport`

### `frontend/src/lib/session.ts`

**Types**: `SessionContext`
**Exported variables**: `session`

### `frontend/src/lib/format.ts`

**Functions**: `todayIsoDate`, `decimalPlacesFor`, `formatAmount`, `formatDate`

### `frontend/src/lib/pagination.ts`

**Functions**: `createPaginator`
**Types**: `PaginatedState`, `Paginator`, `FetchPageResult`

### `frontend/src/lib/entityTree.ts`

**Functions**: `isDescendantOf`, `filterToItems`

### `frontend/src/lib/auth.ts`

**Functions**: `hasRole`
**Types**: `AuthUser`, `AuthState`
**Exported variables**: `auth`

### `frontend/src/lib/translations.ts`

**Exported variables**: `translations`

### `frontend/src/lib/money.ts`

**Functions**: `parseMinorUnits`, `parseQuantity`

### `frontend/src/lib/treeAdapter.ts`

**Functions**: `toTreePaths`
**Types**: `TreeItem`

### `frontend/src/lib/state.svelte.ts`

**Functions**: `hasRole`, `screenTitle`
**Types**: `AuthUser`, `AuthState`, `SessionContext`
**Exported variables**: `auth`, `hasUnsavedEdit`, `menuTree`, `session`, `translations`

### `frontend/src/lib/journalGrid.ts`

**Functions**: `emptyRow`, `isRowEmpty`, `isRowFilled`, `activeRows`, `debitTotalMinor`, `creditTotalMinor`, `differenceMinor`, `isBalanced`, `canSave`, `ensureAtLeastOneRow`, `addRow`, `removeRowAt`, `computeSuggestedFill`, `autoBalanceTrailingRow`, `autoExpandIfTrailingRowFilled`
**Types**: `Row`

### `frontend/src/lib/dirty-state.ts`

**Exported variables**: `hasUnsavedEdit`

### `frontend/src/lib/menu.ts`



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
