# Role × Call Matrix

Every real `BACKEND_FUNCTIONS` entry guarded by `requireRole(...)`/`requireGlobalRole(...)`, grouped by the real role(s) that may call it — read directly from source, never hand-maintained. This is the real, enforced half of "screens v roles": a "screens v roles" matrix does not exist anywhere in this project (no screens.csv column, no doc table, no code) and is not a small, honest thing to fabricate here — one real screen often calls several, independently role-gated backend functions, and most report screens call none at all. "Roles v users" already exists, fully built: a real, per-business User × Role Cartesian Product (see `docs/user-business-role-matrix-design.md`), edited through a real checkbox grid on the Users screen. Generated directly from source by `scripts/generate-role-routes-matrix.ts` (`make role-routes-matrix`) — never hand-edited.

Every real call goes through one generic endpoint (`POST /api/call`, see `backend/src/routes/call.ts`) — there is no per-call Express route or middleware chain to read a guard off of. Instead, every real guard is an explicit `requireAuth(user)`/`requireRole(user, ...)`/`requireGlobalRole(user, ...)` call as the first real statement of the call's own entry in `backend/src/call-dispatch/*.ts` — this table reads that first call directly. "Global" roles are checked across the whole account (`requireGlobalRole`); "Business" roles are checked against the caller's role in their currently selected business (`requireRole`, the per-business role matrix).

## Administrator

| Call | Scope | Source File | Also requires |
|---|---|---|---|
| acceptQuotation | Business | backend/src/call-dispatch/quotations.ts | Bookkeeper |
| addOrUpdateItemSource | Business | backend/src/call-dispatch/items.ts | Bookkeeper |
| allocatePaymentToInvoice | Business | backend/src/call-dispatch/invoices.ts | Bookkeeper |
| buildBankCurrencyStructure | Business | backend/src/call-dispatch/businesses.ts | — |
| changeUserPassword | Global | backend/src/call-dispatch/auth.ts | — |
| closeBooks | Business | backend/src/call-dispatch/journal.ts | Bookkeeper |
| closePeriod | Business | backend/src/call-dispatch/period.ts | — |
| completeCashPurchase | Business | backend/src/call-dispatch/pos.ts | Bookkeeper |
| completePosSale | Business | backend/src/call-dispatch/pos.ts | Bookkeeper |
| completeStockTake | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| confirmPickedLine | Business | backend/src/call-dispatch/invoices.ts | Bookkeeper |
| confirmRestockPickedLine | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| consumeFromLots | Business | backend/src/call-dispatch/stock-lots.ts | Bookkeeper |
| convertStorageSpace | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| createCustomer | Business | backend/src/call-dispatch/entities.ts | Bookkeeper |
| createDepartment | Business | backend/src/call-dispatch/departments.ts | Bookkeeper |
| createEmployeeContact | Business | backend/src/call-dispatch/entities.ts | Bookkeeper |
| createEntity | Business | backend/src/call-dispatch/entities.ts | Bookkeeper |
| createHierarchyGrouping | Business | backend/src/call-dispatch/hierarchy.ts | Bookkeeper |
| createHierarchyValue | Business | backend/src/call-dispatch/hierarchy.ts | Bookkeeper |
| createInvoice | Business | backend/src/call-dispatch/invoices.ts | Bookkeeper |
| createLedger | Business | backend/src/call-dispatch/journal.ts | Bookkeeper |
| createLocation | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| createLocationType | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| createPosTerminal | Business | backend/src/call-dispatch/pos.ts | Bookkeeper |
| createProduct | Business | backend/src/call-dispatch/products.ts | Bookkeeper |
| createProfitCenter | Business | backend/src/call-dispatch/businesses.ts | Bookkeeper |
| createProvider | Business | backend/src/call-dispatch/entities.ts | Bookkeeper |
| createQuotation | Business | backend/src/call-dispatch/quotations.ts | Bookkeeper |
| createRecurringJournal | Business | backend/src/call-dispatch/journal.ts | Bookkeeper |
| createRfq | Business | backend/src/call-dispatch/quotations.ts | Bookkeeper |
| createStockTake | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| createUser | Global | backend/src/call-dispatch/auth.ts | — |
| defineProductShape | Business | backend/src/call-dispatch/hierarchy.ts | Bookkeeper |
| deleteBomComponent | Business | backend/src/call-dispatch/items.ts | Bookkeeper |
| deleteDepartment | Business | backend/src/call-dispatch/departments.ts | Bookkeeper |
| deleteEmployeeDepartment | Business | backend/src/call-dispatch/departments.ts | Bookkeeper |
| deleteEmployeeManager | Business | backend/src/call-dispatch/departments.ts | Bookkeeper |
| deleteHierarchyGrouping | Business | backend/src/call-dispatch/hierarchy.ts | Bookkeeper |
| deleteHierarchyTag | Business | backend/src/call-dispatch/hierarchy.ts | Bookkeeper |
| deleteHierarchyValue | Business | backend/src/call-dispatch/hierarchy.ts | Bookkeeper |
| deleteItemSource | Business | backend/src/call-dispatch/items.ts | Bookkeeper |
| deleteLocation | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| deleteMenuOverride | Business | backend/src/call-dispatch/menu.ts | Bookkeeper |
| deleteTypedAddress | Business | backend/src/call-dispatch/contacts.ts | Bookkeeper |
| deleteTypedContactPerson | Business | backend/src/call-dispatch/contacts.ts | Bookkeeper |
| deleteTypedPhone | Business | backend/src/call-dispatch/contacts.ts | Bookkeeper |
| deleteVocabularyWord | Business | backend/src/call-dispatch/i18n.ts | Bookkeeper |
| dispatchItems | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| dispatchOrderFromPickingList | Business | backend/src/call-dispatch/invoices.ts | Bookkeeper |
| dispatchRestockRun | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| dispatchStock | Business | backend/src/call-dispatch/pos.ts | Bookkeeper |
| exportInvoicePdf | Business | backend/src/call-dispatch/invoices.ts | Bookkeeper |
| getBusinessConfigurationReport | Business | backend/src/call-dispatch/businesses.ts | Bookkeeper |
| getNominatedBankAccounts | Business | backend/src/call-dispatch/businesses.ts | — |
| getOrderStatus | Business | backend/src/call-dispatch/stock.ts | Bookkeeper |
| getOrganizationChart | Business | backend/src/call-dispatch/pos.ts | Bookkeeper |
| getQuotation | Business | backend/src/call-dispatch/quotations.ts | Bookkeeper |
| getRoles | Global | backend/src/call-dispatch/auth.ts | — |
| getUserRoleMatrix | Global | backend/src/call-dispatch/auth.ts | — |
| getUsers | Global | backend/src/call-dispatch/auth.ts | — |
| importEInvoice | Business | backend/src/call-dispatch/invoices.ts | Bookkeeper |
| listPendingCustomers | Business | backend/src/call-dispatch/customer-registration.ts | Bookkeeper |
| listQuotations | Business | backend/src/call-dispatch/quotations.ts | Bookkeeper |
| markQuotationSent | Business | backend/src/call-dispatch/quotations.ts | Bookkeeper |
| nominateBankAccount | Business | backend/src/call-dispatch/businesses.ts | — |
| nominateLocationCurrency | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| openStorageContainer | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| payEmployeeWages | Business | backend/src/call-dispatch/pos.ts | Bookkeeper |
| postAPPayment | Business | backend/src/call-dispatch/arap.ts | Bookkeeper |
| postARReceipt | Business | backend/src/call-dispatch/arap.ts | Bookkeeper |
| postInvoiceById | Business | backend/src/call-dispatch/invoices.ts | Bookkeeper |
| postJournalEntry | Business | backend/src/call-dispatch/journal.ts | Bookkeeper |
| postOrderDispatch | Business | backend/src/call-dispatch/stock.ts | Bookkeeper |
| postOrderReceipt | Business | backend/src/call-dispatch/stock.ts | Bookkeeper |
| postPurchaseOrder | Business | backend/src/call-dispatch/stock.ts | Bookkeeper |
| postSalesOrder | Business | backend/src/call-dispatch/stock.ts | Bookkeeper |
| previewCloseBooks | Business | backend/src/call-dispatch/journal.ts | Bookkeeper |
| receiveIntoStorageStock | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| receiveItems | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| receiveLot | Business | backend/src/call-dispatch/stock-lots.ts | Bookkeeper |
| receiveStock | Business | backend/src/call-dispatch/pos.ts | Bookkeeper |
| recordStockTakeCount | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| registerBankAccount | Business | backend/src/call-dispatch/reports.ts | Bookkeeper |
| rejectQuotation | Business | backend/src/call-dispatch/quotations.ts | Bookkeeper |
| removeStagedLine | Business | backend/src/call-dispatch/journal.ts | Bookkeeper |
| reopenPeriod | Business | backend/src/call-dispatch/period.ts | — |
| reorderEntities | Business | backend/src/call-dispatch/entities.ts | Bookkeeper |
| resetReminder | Business | backend/src/call-dispatch/invoices.ts | Bookkeeper |
| resolveOpenContainerAccounts | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| resolveReceiveAccounts | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| resolveRolloverLines | Business | backend/src/call-dispatch/journal.ts | Bookkeeper |
| resolveTransferAccounts | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| reverseJournalEntry | Business | backend/src/call-dispatch/journal.ts | Bookkeeper |
| revokeEntity | Business | backend/src/call-dispatch/entities.ts | — |
| rolloverToNewPeriod | Business | backend/src/call-dispatch/journal.ts | Bookkeeper |
| saveBusinessTypeAnswers | Business | backend/src/call-dispatch/businesses.ts | — |
| saveLocation | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| sendReminder | Business | backend/src/call-dispatch/invoices.ts | Bookkeeper |
| setBomComponent | Business | backend/src/call-dispatch/items.ts | Bookkeeper |
| setContact | Business | backend/src/call-dispatch/contacts.ts | Bookkeeper |
| setDefaultLanguage | Business | backend/src/call-dispatch/i18n.ts | — |
| setEmployeeDepartment | Business | backend/src/call-dispatch/departments.ts | Bookkeeper |
| setEmployeeManager | Business | backend/src/call-dispatch/departments.ts | Bookkeeper |
| setEmployeeSchedule | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| setEntityRelationship | Business | backend/src/call-dispatch/entities.ts | Bookkeeper |
| setHierarchyTag | Business | backend/src/call-dispatch/hierarchy.ts | Bookkeeper |
| setItem | Business | backend/src/call-dispatch/items.ts | Bookkeeper |
| setItemLocationLevels | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| setItemProduct | Business | backend/src/call-dispatch/products.ts | Bookkeeper |
| setItemSourceLeadTime | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| setItemStorageOrigin | Business | backend/src/call-dispatch/items.ts | Bookkeeper |
| setLanguageDirection | Business | backend/src/call-dispatch/i18n.ts | — |
| setLineType | Business | backend/src/call-dispatch/entities.ts | Bookkeeper |
| setLocationOpenHours | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| setMenuOverride | Business | backend/src/call-dispatch/menu.ts | Bookkeeper |
| setTypedAddress | Business | backend/src/call-dispatch/contacts.ts | Bookkeeper |
| setTypedContactPerson | Business | backend/src/call-dispatch/contacts.ts | Bookkeeper |
| setTypedPhone | Business | backend/src/call-dispatch/contacts.ts | Bookkeeper |
| setUserActiveApi | Global | backend/src/call-dispatch/auth.ts | — |
| setUserRoleInBusiness | Global | backend/src/call-dispatch/auth.ts | — |
| setUserRolesApi | Global | backend/src/call-dispatch/auth.ts | — |
| stageAPPayment | Business | backend/src/call-dispatch/arap.ts | Bookkeeper |
| stageARReceipt | Business | backend/src/call-dispatch/arap.ts | Bookkeeper |
| stageLine | Business | backend/src/call-dispatch/journal.ts | Bookkeeper |
| stageOrderDispatch | Business | backend/src/call-dispatch/stock.ts | Bookkeeper |
| stageOrderReceipt | Business | backend/src/call-dispatch/stock.ts | Bookkeeper |
| stagePurchaseOrder | Business | backend/src/call-dispatch/stock.ts | Bookkeeper |
| stageSalesOrder | Business | backend/src/call-dispatch/stock.ts | Bookkeeper |
| supersedeEntity | Business | backend/src/call-dispatch/entities.ts | Bookkeeper |
| transferItems | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| transferStock | Business | backend/src/call-dispatch/locations.ts | Bookkeeper |
| unregisterBankAccount | Business | backend/src/call-dispatch/reports.ts | Bookkeeper |
| unsetUserRoleInBusiness | Global | backend/src/call-dispatch/auth.ts | — |
| verifyCustomer | Business | backend/src/call-dispatch/customer-registration.ts | Bookkeeper |
| writeOffItems | Business | backend/src/call-dispatch/stock-lots.ts | Bookkeeper |

## Bookkeeper

| Call | Scope | Source File | Also requires |
|---|---|---|---|
| acceptQuotation | Business | backend/src/call-dispatch/quotations.ts | Administrator |
| addOrUpdateItemSource | Business | backend/src/call-dispatch/items.ts | Administrator |
| allocatePaymentToInvoice | Business | backend/src/call-dispatch/invoices.ts | Administrator |
| closeBooks | Business | backend/src/call-dispatch/journal.ts | Administrator |
| completeCashPurchase | Business | backend/src/call-dispatch/pos.ts | Administrator |
| completePosSale | Business | backend/src/call-dispatch/pos.ts | Administrator |
| completeStockTake | Business | backend/src/call-dispatch/locations.ts | Administrator |
| confirmPickedLine | Business | backend/src/call-dispatch/invoices.ts | Administrator |
| confirmRestockPickedLine | Business | backend/src/call-dispatch/locations.ts | Administrator |
| consumeFromLots | Business | backend/src/call-dispatch/stock-lots.ts | Administrator |
| convertStorageSpace | Business | backend/src/call-dispatch/locations.ts | Administrator |
| createCustomer | Business | backend/src/call-dispatch/entities.ts | Administrator |
| createDepartment | Business | backend/src/call-dispatch/departments.ts | Administrator |
| createEmployeeContact | Business | backend/src/call-dispatch/entities.ts | Administrator |
| createEntity | Business | backend/src/call-dispatch/entities.ts | Administrator |
| createHierarchyGrouping | Business | backend/src/call-dispatch/hierarchy.ts | Administrator |
| createHierarchyValue | Business | backend/src/call-dispatch/hierarchy.ts | Administrator |
| createInvoice | Business | backend/src/call-dispatch/invoices.ts | Administrator |
| createLedger | Business | backend/src/call-dispatch/journal.ts | Administrator |
| createLocation | Business | backend/src/call-dispatch/locations.ts | Administrator |
| createLocationType | Business | backend/src/call-dispatch/locations.ts | Administrator |
| createPosTerminal | Business | backend/src/call-dispatch/pos.ts | Administrator |
| createProduct | Business | backend/src/call-dispatch/products.ts | Administrator |
| createProfitCenter | Business | backend/src/call-dispatch/businesses.ts | Administrator |
| createProvider | Business | backend/src/call-dispatch/entities.ts | Administrator |
| createQuotation | Business | backend/src/call-dispatch/quotations.ts | Administrator |
| createRecurringJournal | Business | backend/src/call-dispatch/journal.ts | Administrator |
| createRfq | Business | backend/src/call-dispatch/quotations.ts | Administrator |
| createStockTake | Business | backend/src/call-dispatch/locations.ts | Administrator |
| defineProductShape | Business | backend/src/call-dispatch/hierarchy.ts | Administrator |
| deleteBomComponent | Business | backend/src/call-dispatch/items.ts | Administrator |
| deleteDepartment | Business | backend/src/call-dispatch/departments.ts | Administrator |
| deleteEmployeeDepartment | Business | backend/src/call-dispatch/departments.ts | Administrator |
| deleteEmployeeManager | Business | backend/src/call-dispatch/departments.ts | Administrator |
| deleteHierarchyGrouping | Business | backend/src/call-dispatch/hierarchy.ts | Administrator |
| deleteHierarchyTag | Business | backend/src/call-dispatch/hierarchy.ts | Administrator |
| deleteHierarchyValue | Business | backend/src/call-dispatch/hierarchy.ts | Administrator |
| deleteItemSource | Business | backend/src/call-dispatch/items.ts | Administrator |
| deleteLocation | Business | backend/src/call-dispatch/locations.ts | Administrator |
| deleteMenuOverride | Business | backend/src/call-dispatch/menu.ts | Administrator |
| deleteTypedAddress | Business | backend/src/call-dispatch/contacts.ts | Administrator |
| deleteTypedContactPerson | Business | backend/src/call-dispatch/contacts.ts | Administrator |
| deleteTypedPhone | Business | backend/src/call-dispatch/contacts.ts | Administrator |
| deleteVocabularyWord | Business | backend/src/call-dispatch/i18n.ts | Administrator |
| dispatchItems | Business | backend/src/call-dispatch/locations.ts | Administrator |
| dispatchOrderFromPickingList | Business | backend/src/call-dispatch/invoices.ts | Administrator |
| dispatchRestockRun | Business | backend/src/call-dispatch/locations.ts | Administrator |
| dispatchStock | Business | backend/src/call-dispatch/pos.ts | Administrator |
| exportInvoicePdf | Business | backend/src/call-dispatch/invoices.ts | Administrator |
| getBusinessConfigurationReport | Business | backend/src/call-dispatch/businesses.ts | Administrator |
| getOrderStatus | Business | backend/src/call-dispatch/stock.ts | Administrator |
| getOrganizationChart | Business | backend/src/call-dispatch/pos.ts | Administrator |
| getQuotation | Business | backend/src/call-dispatch/quotations.ts | Administrator |
| importEInvoice | Business | backend/src/call-dispatch/invoices.ts | Administrator |
| listPendingCustomers | Business | backend/src/call-dispatch/customer-registration.ts | Administrator |
| listQuotations | Business | backend/src/call-dispatch/quotations.ts | Administrator |
| markQuotationSent | Business | backend/src/call-dispatch/quotations.ts | Administrator |
| nominateLocationCurrency | Business | backend/src/call-dispatch/locations.ts | Administrator |
| openStorageContainer | Business | backend/src/call-dispatch/locations.ts | Administrator |
| payEmployeeWages | Business | backend/src/call-dispatch/pos.ts | Administrator |
| postAPPayment | Business | backend/src/call-dispatch/arap.ts | Administrator |
| postARReceipt | Business | backend/src/call-dispatch/arap.ts | Administrator |
| postInvoiceById | Business | backend/src/call-dispatch/invoices.ts | Administrator |
| postJournalEntry | Business | backend/src/call-dispatch/journal.ts | Administrator |
| postOrderDispatch | Business | backend/src/call-dispatch/stock.ts | Administrator |
| postOrderReceipt | Business | backend/src/call-dispatch/stock.ts | Administrator |
| postPurchaseOrder | Business | backend/src/call-dispatch/stock.ts | Administrator |
| postSalesOrder | Business | backend/src/call-dispatch/stock.ts | Administrator |
| previewCloseBooks | Business | backend/src/call-dispatch/journal.ts | Administrator |
| receiveIntoStorageStock | Business | backend/src/call-dispatch/locations.ts | Administrator |
| receiveItems | Business | backend/src/call-dispatch/locations.ts | Administrator |
| receiveLot | Business | backend/src/call-dispatch/stock-lots.ts | Administrator |
| receiveStock | Business | backend/src/call-dispatch/pos.ts | Administrator |
| recordStockTakeCount | Business | backend/src/call-dispatch/locations.ts | Administrator |
| registerBankAccount | Business | backend/src/call-dispatch/reports.ts | Administrator |
| rejectQuotation | Business | backend/src/call-dispatch/quotations.ts | Administrator |
| removeStagedLine | Business | backend/src/call-dispatch/journal.ts | Administrator |
| reorderEntities | Business | backend/src/call-dispatch/entities.ts | Administrator |
| resetReminder | Business | backend/src/call-dispatch/invoices.ts | Administrator |
| resolveOpenContainerAccounts | Business | backend/src/call-dispatch/locations.ts | Administrator |
| resolveReceiveAccounts | Business | backend/src/call-dispatch/locations.ts | Administrator |
| resolveRolloverLines | Business | backend/src/call-dispatch/journal.ts | Administrator |
| resolveTransferAccounts | Business | backend/src/call-dispatch/locations.ts | Administrator |
| reverseJournalEntry | Business | backend/src/call-dispatch/journal.ts | Administrator |
| rolloverToNewPeriod | Business | backend/src/call-dispatch/journal.ts | Administrator |
| saveLocation | Business | backend/src/call-dispatch/locations.ts | Administrator |
| sendReminder | Business | backend/src/call-dispatch/invoices.ts | Administrator |
| setBomComponent | Business | backend/src/call-dispatch/items.ts | Administrator |
| setContact | Business | backend/src/call-dispatch/contacts.ts | Administrator |
| setEmployeeDepartment | Business | backend/src/call-dispatch/departments.ts | Administrator |
| setEmployeeManager | Business | backend/src/call-dispatch/departments.ts | Administrator |
| setEmployeeSchedule | Business | backend/src/call-dispatch/locations.ts | Administrator |
| setEntityRelationship | Business | backend/src/call-dispatch/entities.ts | Administrator |
| setHierarchyTag | Business | backend/src/call-dispatch/hierarchy.ts | Administrator |
| setItem | Business | backend/src/call-dispatch/items.ts | Administrator |
| setItemLocationLevels | Business | backend/src/call-dispatch/locations.ts | Administrator |
| setItemProduct | Business | backend/src/call-dispatch/products.ts | Administrator |
| setItemSourceLeadTime | Business | backend/src/call-dispatch/locations.ts | Administrator |
| setItemStorageOrigin | Business | backend/src/call-dispatch/items.ts | Administrator |
| setLineType | Business | backend/src/call-dispatch/entities.ts | Administrator |
| setLocationOpenHours | Business | backend/src/call-dispatch/locations.ts | Administrator |
| setMenuOverride | Business | backend/src/call-dispatch/menu.ts | Administrator |
| setTypedAddress | Business | backend/src/call-dispatch/contacts.ts | Administrator |
| setTypedContactPerson | Business | backend/src/call-dispatch/contacts.ts | Administrator |
| setTypedPhone | Business | backend/src/call-dispatch/contacts.ts | Administrator |
| stageAPPayment | Business | backend/src/call-dispatch/arap.ts | Administrator |
| stageARReceipt | Business | backend/src/call-dispatch/arap.ts | Administrator |
| stageLine | Business | backend/src/call-dispatch/journal.ts | Administrator |
| stageOrderDispatch | Business | backend/src/call-dispatch/stock.ts | Administrator |
| stageOrderReceipt | Business | backend/src/call-dispatch/stock.ts | Administrator |
| stagePurchaseOrder | Business | backend/src/call-dispatch/stock.ts | Administrator |
| stageSalesOrder | Business | backend/src/call-dispatch/stock.ts | Administrator |
| supersedeEntity | Business | backend/src/call-dispatch/entities.ts | Administrator |
| transferItems | Business | backend/src/call-dispatch/locations.ts | Administrator |
| transferStock | Business | backend/src/call-dispatch/locations.ts | Administrator |
| unregisterBankAccount | Business | backend/src/call-dispatch/reports.ts | Administrator |
| verifyCustomer | Business | backend/src/call-dispatch/customer-registration.ts | Administrator |
| writeOffItems | Business | backend/src/call-dispatch/stock-lots.ts | Administrator |

## Every real call with no role guard, only `requireAuth` (open to any logged-in caller)

| Call | Source File |
|---|---|
| changeOwnPassword | backend/src/call-dispatch/auth.ts |
| clockInToProject | backend/src/call-dispatch/projects.ts |
| clockOutOfProject | backend/src/call-dispatch/projects.ts |
| deleteVocabularyPreference | backend/src/call-dispatch/i18n.ts |
| exportInvoiceAsEInvoice | backend/src/call-dispatch/invoices.ts |
| getActiveLedger | backend/src/call-dispatch/businesses.ts |
| getAgedInvoices | backend/src/call-dispatch/invoices.ts |
| getAgedSummary | backend/src/call-dispatch/invoices.ts |
| getAxisValues | backend/src/call-dispatch/matrix-reports.ts |
| getBalanceSheet | backend/src/call-dispatch/reports.ts |
| getBankAccounts | backend/src/call-dispatch/reports.ts |
| getBelowReorderStock | backend/src/call-dispatch/locations.ts |
| getBomComponents | backend/src/call-dispatch/items.ts |
| getBusinessReports | backend/src/call-dispatch/reports.ts |
| getBusinessTypes | backend/src/call-dispatch/businesses.ts |
| getBusinesses | backend/src/call-dispatch/businesses.ts |
| getCashFlowForecast | backend/src/call-dispatch/reports.ts |
| getCashPosition | backend/src/call-dispatch/reports.ts |
| getChartOfAccounts | backend/src/call-dispatch/reports.ts |
| getCoaPrototypeAccounts | backend/src/call-dispatch/businesses.ts |
| getConceptsWithAlternates | backend/src/call-dispatch/i18n.ts |
| getContact | backend/src/call-dispatch/contacts.ts |
| getCounterpartyHistory | backend/src/call-dispatch/invoices.ts |
| getCreditStatus | backend/src/call-dispatch/contacts.ts |
| getCustomerStatement | backend/src/call-dispatch/invoices.ts |
| getDrillDown | backend/src/call-dispatch/reports.ts |
| getEmployeeSchedule | backend/src/call-dispatch/locations.ts |
| getEntity | backend/src/call-dispatch/entities.ts |
| getEntityHistory | backend/src/call-dispatch/entities.ts |
| getEntityTree | backend/src/call-dispatch/entities.ts |
| getExpiringStock | backend/src/call-dispatch/stock-lots.ts |
| getHierarchy | backend/src/call-dispatch/hierarchy.ts |
| getHierarchyAssignments | backend/src/call-dispatch/hierarchy.ts |
| getHierarchyGroups | backend/src/call-dispatch/hierarchy.ts |
| getHierarchyLinksPointingAt | backend/src/call-dispatch/entities.ts |
| getHierarchyTag | backend/src/call-dispatch/hierarchy.ts |
| getInventoryListing | backend/src/call-dispatch/locations.ts |
| getInventoryListingByLocation | backend/src/call-dispatch/locations.ts |
| getInvoiceById | backend/src/call-dispatch/invoices.ts |
| getInvoiceOutstanding | backend/src/call-dispatch/invoices.ts |
| getItem | backend/src/call-dispatch/items.ts |
| getItemLocation | backend/src/call-dispatch/locations.ts |
| getItemStorageOrigin | backend/src/call-dispatch/items.ts |
| getJournalEntry | backend/src/call-dispatch/journal.ts |
| getLedgerDateRange | backend/src/call-dispatch/reports.ts |
| getLedgers | backend/src/call-dispatch/businesses.ts |
| getLocationByName | backend/src/call-dispatch/locations.ts |
| getLocationCurrencies | backend/src/call-dispatch/locations.ts |
| getLocationOpenHours | backend/src/call-dispatch/locations.ts |
| getLocationTypes | backend/src/call-dispatch/locations.ts |
| getMe | backend/src/call-dispatch/auth.ts |
| getOpenProjectClock | backend/src/call-dispatch/projects.ts |
| getOrgChartStructure | backend/src/call-dispatch/departments.ts |
| getPickingList | backend/src/call-dispatch/invoices.ts |
| getPosTerminals | backend/src/call-dispatch/pos.ts |
| getProductShapes | backend/src/call-dispatch/hierarchy.ts |
| getProfitAndLoss | backend/src/call-dispatch/reports.ts |
| getProfitAndLossByAxis | backend/src/call-dispatch/matrix-reports.ts |
| getProfitAndLossByHierarchy | backend/src/call-dispatch/reports.ts |
| getProfitAndLossByHierarchyTree | backend/src/call-dispatch/reports.ts |
| getProfitAndLossComparison | backend/src/call-dispatch/reports.ts |
| getProfitCenters | backend/src/call-dispatch/businesses.ts |
| getReminderCandidates | backend/src/call-dispatch/invoices.ts |
| getReportingPeriods | backend/src/call-dispatch/businesses.ts |
| getRestockPickingList | backend/src/call-dispatch/locations.ts |
| getSalesCogsMatrix | backend/src/call-dispatch/matrix-reports.ts |
| getSalesReport | backend/src/call-dispatch/reports.ts |
| getScheduleAtLocation | backend/src/call-dispatch/locations.ts |
| getStagedLines | backend/src/call-dispatch/journal.ts |
| getStockMovementReport | backend/src/call-dispatch/locations.ts |
| getStockOnHandMatrix | backend/src/call-dispatch/matrix-reports.ts |
| getStockOutRiskReport | backend/src/call-dispatch/locations.ts |
| getStockTake | backend/src/call-dispatch/locations.ts |
| getStorageSpaceReport | backend/src/call-dispatch/locations.ts |
| getTrialBalance | backend/src/call-dispatch/reports.ts |
| getTrialBalanceComparison | backend/src/call-dispatch/reports.ts |
| getTypedAddresses | backend/src/call-dispatch/contacts.ts |
| getTypedContactPersons | backend/src/call-dispatch/contacts.ts |
| getTypedPhones | backend/src/call-dispatch/contacts.ts |
| getVocabularyWords | backend/src/call-dispatch/i18n.ts |
| listAddressTypes | backend/src/call-dispatch/contacts.ts |
| listContactPersonTypes | backend/src/call-dispatch/contacts.ts |
| listDepartments | backend/src/call-dispatch/departments.ts |
| listInvoices | backend/src/call-dispatch/invoices.ts |
| listItemSources | backend/src/call-dispatch/items.ts |
| listItems | backend/src/call-dispatch/items.ts |
| listJournalEntries | backend/src/call-dispatch/journal.ts |
| listLineTypes | backend/src/call-dispatch/entities.ts |
| listLocations | backend/src/call-dispatch/locations.ts |
| listPhoneTypes | backend/src/call-dispatch/contacts.ts |
| logout | backend/src/call-dispatch/auth.ts |
| lookupByUpc | backend/src/call-dispatch/pos.ts |
| setOwnDateFormat | backend/src/call-dispatch/auth.ts |
| setOwnNumberFormat | backend/src/call-dispatch/auth.ts |
| setOwnPageSize | backend/src/call-dispatch/auth.ts |
| setSessionBusiness | backend/src/call-dispatch/auth.ts |
| setSessionProfitCenter | backend/src/call-dispatch/auth.ts |
| setTranslation | backend/src/call-dispatch/i18n.ts |
| setVocabularyPreference | backend/src/call-dispatch/i18n.ts |

## Every real call with no auth check at all (genuinely public — e.g. login, customer self-registration, pre-login translations)

| Call | Source File |
|---|---|
| authenticateCustomer | backend/src/call-dispatch/customer-registration.ts |
| getDefaultLanguage | backend/src/call-dispatch/i18n.ts |
| getLanguageDirection | backend/src/call-dispatch/i18n.ts |
| getLanguages | backend/src/call-dispatch/i18n.ts |
| getLocalizedText | backend/src/call-dispatch/i18n.ts |
| getMenuTree | backend/src/call-dispatch/menu.ts |
| getPeriodStatus | backend/src/call-dispatch/period.ts |
| getVocabularyAlternates | backend/src/call-dispatch/i18n.ts |
| listProducts | backend/src/call-dispatch/products.ts |
| login | backend/src/call-dispatch/auth.ts |
| registerCustomer | backend/src/call-dispatch/customer-registration.ts |

**136 real, role-guarded call(s)** across 2 real role(s); **99 call(s)** requiring only a logged-in user; **11 fully public call(s)**.
