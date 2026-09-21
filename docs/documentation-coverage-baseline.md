# Documentation Coverage Baseline

A real, honest, tracked list of every name `make check-docs-coverage`
found genuinely undocumented the day this check was introduced. Per
`documentation-coverage-enforcement`, this is not a permanent
exemption list — it is expected to shrink, over real, separate
documentation work, never to grow. A name should only ever be added
here for a genuine, deliberate, temporary reason, stated directly next
to it — never as a routine way to make the check pass.

Per direct request: the flat, undifferentiated bullet list below is
what `check-docs-coverage.ts` itself directly parses (each real,
tracked name, on its own line, as `` `name` ``) and must stay exactly
in this shape for that script to keep working — but for a genuinely
readable, structured view of these same names, separated into real,
distinct, alphabetical groups (`TypeDescriptor` constants, Express
router constants, and real, substantial functions), each with its own
real file of definition, its own real, full declaration (a function's
own, real parameters and return type; a const's own, real
initializing expression), and every other real, core backend file
that references it — see `docs/documentation-baseline-report.md`,
generated directly by `scripts/documentation-baseline-report.ts` (run
via `make documentation-baseline-report`).

Several of these are small, self-explanatory type-branding helpers
(`asUserId`, `asEntityId`, etc.) genuinely low priority to write prose
about; many others are real, substantial, undocumented functions and
should be prioritized first.

The `typeXxxName` `TypeDescriptor` constants listed below follow the
exact, single, documented pattern in `docs/entity-model.md`'s own
`create<T>`/`fetch<T>` section (a representative sample is named
there directly) - real, but not individually described in prose to
avoid an unreadable, repetitive list; the complete, current set is
always available via `make source-reference`. Every `xxxRouter`
constant is a real, standard Express router instance, one per real
route file - structurally identical, self-explanatory from its own
file name, and not a business concept worth prose on its own.

- `typeVendorName`
- `typeCustomerName`
- `typeItemName`
- `typeRootName`
- `typeLedgerName`
- `typeBusinessLocationsRootName`
- `typeBusinessItemsRootName`
- `typeBusinessContactsRootName`
- `typeLineTypeMarkerName`
- `typeStorageOriginMarkerName`
- `typeTextDirectionMarkerName`
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
- `typeExpenseCategoryName`
- `typeMenuSectionName`
- `typeMenuLinkName`
- `typeMenuLinkFlagName`
- `typeBusinessTypeName`
- `typeBusinessTypeQuestionsRootName`
- `typeBusinessTypeQuestionName`
- `periodRouter`
- `projectsRouter`
- `businessesRouter`
- `posRouter`
- `itemsRouter`
- `matrixReportsRouter`
- `authRouter`
- `i18nRouter`
- `divisionsRouter`
- `invoiceRouter`
- `entitiesRouter`
- `locationsRouter`
- `belowReorderRouter`
- `stockOutRiskRouter`
- `stockListingRouter`
- `stockTakesRouter`
- `arApRouter`
- `stockRouter`
- `productsRouter`
- `invoicesRouter`
- `agedRouter`
- `statementRouter`
- `historyRouter`
- `remindersRouter`
- `reportsRouter`
- `stockLotsRouter`
- `journalRouter`
- `customerRegistrationRouter`
- `customerVerificationRouter`
- `contactsRouter`
- `menuRouter`

- `getLocationTypes`
- `createLocationType`
- `todayAtLocation`
- `getItemLocation`
- `setItemLocationLevelDetails`
- `getLocationCapacityStatus`
- `ensureLocationCapacityAccount`
- `adjustLocationCapacity`
- `getStockListingByLocation`
- `getStockMovementReport`
- `countStockListing`
- `setItemLocationLevels`
- `setItemSourceLeadTime`
- `getItemLeadTimes`
- `getStockOutRiskReport`
- `getStockTake`
- `getExpiringStock`
- `createSystemEntity`
- `getChartOfAccounts`
- `getLedgerBalancesByDivision`
- `getLedgerBalancesByDivisionStructural`
- `buildProfitAndLossFromBalances`
- `getProfitAndLossByDivision`
- `getProfitAndLossByDivisionTree`
- `previewCloseBooks`
- `getSalesReport`
- `listUsers`
- `listRoles`
- `setUserRoles`
- `setUserActive`
- `changePassword`
- `changeOwnPassword`
- `logout`
- `getSessionUser`
- `setOwnPageSize`
- `setOwnNumberFormat`
- `setOwnDateFormat`
- `asUserId`
- `asEntityId`
- `asDivisionName`
- `asLocationName`
- `asEmployeeName`
- `asCustomerName`
- `asVendorName`
- `asItemName`
- `getCreditStatus`
- `getAgingBuckets`
- `exportInvoiceAsUbl`
- `parseUblInvoice`
- `checkEInvoiceDiscrepancies`
- `getPickingList`
- `dispatchOrderFromPickingList`
- `getInvoiceOutstandingMinor`
- `getItemByUpc`
- `getProductUnitCostMinor`
- `ensureProductTierItem`
- `recordReminderSent`
- `resetReminderLevel`
- `getAccountsPostedTo`
- `setPosPin`
- `signOn`
- `verifyPosPin`
- `signOff`
- `getActiveShiftsAtLocation`
- `getOpenShiftForEmployee`
- `setLocationOpenHours`
- `getLocationOpenHours`
- `setEmployeeSchedule`
- `getEmployeeSchedule`
- `getScheduleAtLocation`
- `ensureAddressType`
- `listAddressTypes`
- `addTypedAddress`
- `deleteTypedAddress`
- `ensurePhoneType`
- `listPhoneTypes`
- `addTypedPhone`
- `deleteTypedPhone`
- `ensureContactPersonType`
- `listContactPersonTypes`
- `addTypedContactPerson`
- `deleteTypedContactPerson`
- `deleteBomComponent`
- `deleteDimensionParent`
- `removeContactType`
- `getDimensionLinksPointingAt`
- `getDimensionAncestorChain`
- `registerBankAccount`
- `unregisterBankAccount`
- `getBankAccounts`
- `getCashFlowForecast`
- `registerCustomer`
- `listPendingCustomers`
- `verifyCustomer`
- `authenticateCustomer`
- `createProduct`
- `getItemProduct`
- `setItemProduct`
- `listItemSources`
- `addOrUpdateItemSource`
- `deleteItemSource`
- `getLanguages`
- `getDivisions`
- `getMenuTree`
- `getScreenTitle`
- `setMenuOverride`
- `deleteMenuOverride`
- `setDivisionType`
- `getDivisionType`
- `getDivisionTypes`
- `createDivisionType`
- `getVocabularyAlternates`
- `getConceptsWithAlternates`
- `setVocabularyPreference`
- `deleteVocabularyPreference`
- `getLocalizedText`
- `getAllTranslations`
- `getBusinesses`
- `getLedgers`
- `getLedgerDateRange`
- `getSalesCogsMatrix`
- `getStockOnHandMatrix`
- `getProfitAndLossByAxis`
- `getAxisValues`
- `attachUser`
- `requireAuth`
- `hashPassword`
- `verifyPassword`
- `backend-verbose`
- `proof-year-end`
- `test-e2e-playwright`
- `playwright-one`
- `verify-fresh`
- `check-docs-coverage`
- `list-menu-labels`
- `add-menu-translations`
- `add-journal-translations`
- `add-journal-remaining-translations`
- `add-header-translations`
- `add-brand-translation`
- `check-frontend`
- `check-backend-types`
- `check-e2e-types`
- `/reports/stock-out-risk`
