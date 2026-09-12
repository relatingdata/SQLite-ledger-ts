import { test, beforeAll as before, afterAll as after } from 'bun:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDbPath = path.join(os.tmpdir(), `sql-ledger-ts-test-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = tmpDbPath;

const {
  getEntityTree,
  getEntity,
  getEntityHistory,
  getInvoiceLine,
  getPeriodLockStatus,
  getLedgerDateRange,
  getAccountsPostedTo,
  closePeriod,
  reopenPeriod,
  createEntity,
  updateEntity,
  setRelationship,
  setEntityLink,
  getEntityLink,
  deleteEntityLink,
  stageBomComponent,
  postBomComponents,
  getBomComponents,
  createProjectTask,
  getProjectTasks,
  addTaskDependency,
  getTaskDependencies,
  getLanguageDirection,
  setLanguageDirection,
  setItemSourceLeadTime,
  getItemLeadTimes,
  getStockOutRiskReport,
  setDimensionParent,
  ensureProductTierItem,
  ensureProductTierLocationLeaf,
  getDimensionParent,
  getLocationForAccount,
  getDivisionForAccount,
  deleteDimensionParent,
  getDimensionChildren,
  getDimensionAncestorChain,
  registerBankAccount,
  unregisterBankAccount,
  getBankAccounts,
  getCashPosition,
  getCashFlowForecast,
  getRelationship,
  getEntitiesWithRelationship,
  deleteEntity,
  getBusinessReports,
  getChartOfAccounts,
  getTrialBalance,
  getBalanceSheet,
  getProfitAndLoss,
  getProfitAndLossByDivision,
  getProfitAndLossByDivisionTree,
  getTrialBalanceComparison,
  getProfitAndLossComparison,
  getSalesReport,
  getLanguages,
  getLocalizedText,
  setTranslation,
  getTranslation,
  getBusinesses,
  getLedgers,
  createBusiness,
  stageLine,
  getStagedLines,
  removeStagedLine,
  postJournalEntry,
  listJournalEntries,
  getJournalEntry,
  createRecurringJournal,
  reverseJournalEntry,
  postQuantityMovement,
  placeOrder,
  fulfillOrder,
  getOrderStatus,
  stagePurchaseOrder,
  postPurchaseOrder,
  stageStockReceipt,
  postStockReceipt,
  stageSalesOrder,
  postSalesOrder,
  stageStockDispatch,
  postStockDispatch,
  stageArSale,
  postArSale,
  stageArReceipt,
  postArReceipt,
  stageApPurchase,
  postApPurchase,
  stageApPayment,
  postApPayment,
  getContact,
  addTypedAddress,
  getTypedAddresses,
  deleteTypedAddress,
  addTypedPhone,
  getTypedPhones,
  deleteTypedPhone,
  getAgingBuckets,
  getCreditStatus,
  exportInvoiceAsUbl,
  importUblInvoiceAsDraft,
  setContact,
  setPosPin,
  signOn,
  signOff,
  verifyPosPin,
  getActiveShiftsAtLocation,
  getOpenShiftForEmployee,
  setLocationOpenHours,
  getLocationOpenHours,
  setEmployeeSchedule,
  getEmployeeSchedule,
  getScheduleAtLocation,
  setItem,
  getItem,
  listItemSources,
  addOrUpdateItemSource,
  getLocationCapacityStatus,
  listItems,
  getDefaultLanguage,
  setDefaultLanguage,
  createInvoice,
  getInvoice,
  postInvoice,
  allocatePayment,
  getInvoiceOutstandingMinor,
  getAgedInvoices,
  setDivisionType,
  getDivisionType,
  recordReminderSent,
  resetReminderLevel,
  getReminderCandidates,
  getAgedSummary,
  getCustomerStatement,
  getCounterpartyHistory,
  writeOffStock,
  receiveLot,
  consumeFromLots,
  getExpiringStock,
  setLocation,
  getLocation,
  getItemLocation,
  getStockListing,
  getStockListingByLocation,
  getStockMovementReport,
  countStockListing,
  setAccountCurrency,
  setItemLocationLevels,
  getPickingList,
  confirmPickedLine,
  dispatchOrderFromPickingList,
  getRestockPickingList,
  confirmRestockPickedLine,
  dispatchRestockFromPickingList,
  receiveStockAtLocation,
  getLedgerBalancesByDivision,
  getLedgerBalancesByDivisionStructural,
  dispatchStockFromLocation,
  transferStock,
  getBelowReorderStock,
  createItem,
  createStockTake,
  getStockTake,
  recordStockTakeCount,
  completeStockTake,
  completePosSale,
  completeCashPurchase,
  payEmployeeWages,
  getOrganizationChart,
  ensureProductSalesCogsAccounts,
  getItemByUpc,
  registerCustomer,
  listPendingCustomers,
  verifyCustomer,
  authenticateCustomer,
  closeBooks,
  previewCloseBooks,
  ValidationError,
  NotFoundError,
  PostingError,
  db,
} = await import('../src/db.ts');

after(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.unlinkSync(tmpDbPath + suffix);
    } catch {
      /* fine if already gone */
    }
  }
});

test('the bootstrap tree loads with exactly one root', () => {
  const tree = getEntityTree();
  const roots = tree.filter((e) => e.parent_id === null);
  assert.equal(roots.length, 1);
  assert.equal(roots[0].name, 'Application');
  assert.ok(tree.length > 40, 'expected the full bootstrap tree to be present');
});

test('creating an entity by name works and rejects duplicates', () => {
  const created = createEntity({ name: 'Gamma LLC', parent: 'Accounts Receivable' }, 1);
  assert.equal(created.parent_id, getEntity(created.id)!.parent_id);
  assert.throws(() => createEntity({ name: 'Gamma LLC', parent: 'Accounts Receivable' }, 1));
});

test('creating an entity with a nonexistent parent is rejected', () => {
  assert.throws(() => createEntity({ name: 'Orphan', parent: 'Nonexistent Parent Name' }, 1));
});

test('updateEntity can rename, reparent, and assign an account number', () => {
  const e = createEntity({ name: 'Delta Pty Ltd', parent: 'Accounts Receivable' }, 1);
  const renamed = updateEntity(e.id, { name: 'Delta Pty Ltd (renamed)' }, 1);
  assert.equal(renamed.name, 'Delta Pty Ltd (renamed)');

  const reparented = updateEntity(e.id, { parent: 'Accounts Payable' }, 1);
  const parent = getEntity(reparented.parent_id!);
  assert.equal(parent!.name, 'Accounts Payable');

  const withAccount = updateEntity(e.id, { accountnumber: '9999.001' }, 1);
  assert.equal(withAccount.accountnumber, '9999.001');
});

test('an entity cannot be made its own parent', () => {
  const e = createEntity({ name: 'Self Parent Test', parent: 'Accounts Receivable' }, 1);
  assert.throws(() => updateEntity(e.id, { parent: 'Self Parent Test' }, 1));
});

test('deleteEntity refuses to delete an entity with children', () => {
  assert.throws(() => deleteEntity(getEntity(1)!.id, 1)); // Application has children
});

test('deleteEntity works for a genuinely childless, unposted entity', () => {
  const e = createEntity({ name: 'Temporary Test Entity', parent: 'Accounts Receivable' }, 1);
  deleteEntity(e.id, 1);
  assert.equal(getEntity(e.id), undefined);
});

test('deleteEntity refuses to delete a business\'s last real Actual or last real Budget ledger, but allows removing a real, genuine duplicate', () => {
  createEntity({ name: 'LedgerRuleTest Business', parent: 'Businesses' }, 1);
  createEntity({ name: 'LedgerRuleTest Business Actual', parent: 'LedgerRuleTest Business' }, 1);
  createEntity({ name: 'LedgerRuleTest Business Budget 2026-27', parent: 'LedgerRuleTest Business' }, 1);

  const actual = getEntity(getEntityTree().find((e) => e.name === 'LedgerRuleTest Business Actual')!.id)!;
  const budget = getEntity(getEntityTree().find((e) => e.name === 'LedgerRuleTest Business Budget 2026-27')!.id)!;

  assert.throws(() => deleteEntity(actual.id, 1), /must always have a real Actual ledger/);
  assert.throws(() => deleteEntity(budget.id, 1), /must always have a real Budget ledger/);

  // A real, genuine second Actual-type ledger for the same business
  // CAN be deleted — the rule protects the last one of each real
  // kind, not every real ledger unconditionally.
  const dup = createEntity({ name: 'LedgerRuleTest Business Second Actual', parent: 'LedgerRuleTest Business' }, 1);
  deleteEntity(dup.id, 1);
  assert.equal(getEntity(dup.id), undefined);

  // The real, original, only-remaining Actual ledger is still,
  // genuinely protected afterward.
  assert.throws(() => deleteEntity(actual.id, 1), /must always have a real Actual ledger/);
});

test('business_reports groups categories under their fixed report via relation_id', () => {
  const rows = getBusinessReports();
  const balanceSheetCategories = new Set(rows.filter((r) => r.report === 'Balance Sheet').map((r) => r.category));
  const plCategories = new Set(rows.filter((r) => r.report === 'Profit and Loss Statement').map((r) => r.category));
  assert.ok(balanceSheetCategories.has('Asset'));
  assert.ok(balanceSheetCategories.has('Liability'));
  assert.ok(balanceSheetCategories.has('Equity'));
  assert.ok(plCategories.has('Income'));
  assert.ok(plCategories.has('Expense'));
});

test('chart_of_accounts shows the real hierarchy including sub-accounts', () => {
  const rows = getChartOfAccounts();
  assert.ok(rows.some((r) => r.name === 'Acme Corp' && r.path.includes('Accounts Receivable')));
});

test('reassigning a category to a different report via relation changes business_reports immediately', () => {
  updateEntity(getEntity(getEntityTree().find((e) => e.name === 'Equity')!.id)!.id, {
    relation: 'Profit and Loss Statement',
  }, 1);
  let rows = getBusinessReports();
  assert.equal(rows.find((r) => r.category === 'Equity')?.report, 'Profit and Loss Statement');

  // put it back for later tests
  updateEntity(getEntityTree().find((e) => e.name === 'Equity')!.id, { relation: 'Balance Sheet' }, 1);
  rows = getBusinessReports();
  assert.equal(rows.find((r) => r.category === 'Equity')?.report, 'Balance Sheet');
});

test('languages list and localized_text fallback/override work end to end', () => {
  const languages = getLanguages();
  assert.ok(languages.some((l) => l.name === 'English'));
  assert.ok(languages.some((l) => l.name === 'German'));

  const german = getLocalizedText('German');
  assert.equal(german['Save'], 'Speichern');
  assert.equal(german['Debit'], 'Soll', 'the standard German accounting term, not a literal word-for-word guess');
  assert.equal(german['Credit'], 'Haben');
  assert.equal(german['Name'], 'Name', 'untranslated word should fall back to English');

  setTranslation('Name', 'German', 'Bezeichnung');
  assert.equal(getLocalizedText('German')['Name'], 'Bezeichnung');
});

test('French works as a genuine, complete third language — no special-casing needed for a third language to work at all', () => {
  const languages = getLanguages();
  assert.ok(languages.some((l) => l.name === 'French'), 'a third language works the same way as a second');
  assert.ok(!languages.some((l) => l.name === 'Klingon'), 'dropped per explicit request once German and French were both complete');

  const french = getLocalizedText('French');
  assert.equal(french['Save'], 'Enregistrer');
  assert.equal(french['Debit'], 'Débit');
  assert.equal(french['Customers'], 'Clients');

  // A word genuinely not registered as any entity at all — proves the
  // fallback mechanism itself still works, not just that most words
  // happen to be translated now.
  assert.equal(french['Not A Real Vocabulary Word'], undefined, 'an unregistered key is simply absent from the map, letting the frontend fall back to its own default text');
});

test('businesses and ledgers list correctly', () => {
  const businesses = getBusinesses();
  assert.ok(businesses.some((b) => b.name === 'My Business'));
  const ledgers = getLedgers('My Business');
  assert.ok(ledgers.some((l) => l.name === 'Actual'));
  assert.ok(ledgers.some((l) => l.name === 'Proposed Growth Budget 2026-27'));
});

test('staging + posting a balanced entry works end to end and clears staging', () => {
  stageLine({
    reference: 'TEST-001',
    business: 'My Business',
    ledger: 'Actual',
    description: 'Test entry',
    transdate: '2026-07-26',
    account: 'Cash and Bank',
    amount_minor: 12345,
    memo: 'debit side',
  });
  stageLine({
    reference: 'TEST-001',
    business: 'My Business',
    ledger: 'Actual',
    description: 'Test entry',
    transdate: '2026-07-26',
    account: 'Sales Revenue',
    amount_minor: -12345,
    memo: 'credit side',
  });
  assert.equal(getStagedLines('TEST-001', 'My Business', 'Actual').length, 2);

  postJournalEntry('TEST-001', 'My Business', 'Actual', 1);
  assert.equal(getStagedLines('TEST-001', 'My Business', 'Actual').length, 0, 'staging should be cleared after posting');

  const entries = listJournalEntries('My Business', 'Actual');
  const posted = entries.find((e) => e.reference === 'TEST-001');
  assert.ok(posted);
  assert.equal(posted!.total_debit_minor, 12345);
  assert.equal(posted!.total_credit_minor, 12345);
});

test('posting an unbalanced entry is rejected and leaves staging untouched', () => {
  stageLine({
    reference: 'TEST-BAD',
    business: 'My Business',
    ledger: 'Actual',
    account: 'Cash and Bank',
    amount_minor: 500,
  });
  assert.throws(() => postJournalEntry('TEST-BAD', 'My Business', 'Actual', 1), PostingError);
  assert.equal(getStagedLines('TEST-BAD', 'My Business', 'Actual').length, 1, 'staged line should remain for correction');
});

test('removeStagedLine removes exactly one line', () => {
  stageLine({ reference: 'TEST-REMOVE', business: 'My Business', ledger: 'Actual', account: 'Cash and Bank', amount_minor: 10 });
  stageLine({ reference: 'TEST-REMOVE', business: 'My Business', ledger: 'Actual', account: 'Sales Revenue', amount_minor: -10 });
  removeStagedLine('TEST-REMOVE', 'My Business', 'Actual', 'Cash and Bank');
  const remaining = getStagedLines('TEST-REMOVE', 'My Business', 'Actual');
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].account, 'Sales Revenue');
});

test('getJournalEntry returns full line detail with account numbers', () => {
  const entries = listJournalEntries('My Business', 'Actual');
  const posted = entries.find((e) => e.reference === 'TEST-001')!;
  const detail = getJournalEntry('My Business', 'Actual', posted.journal_id, posted.occurrence_date!);
  assert.ok(detail);
  assert.equal(detail!.lines.length, 2);
  assert.ok(detail!.lines.some((l) => l.account === 'Cash and Bank'));
});

test('an account is vivified on first post and gets a real balance', () => {
  // The schema's own bootstrap already posts a real 50000-cent worked
  // transaction to Cash and Bank (see schema.sql's CS-1001 demo) before
  // any of these tests run — so after this suite's own +12345 posting to
  // the same account, the correct total is 50000 + 12345, not 12345 in
  // isolation. (An earlier version of this test assumed the latter and
  // failed — a test-authoring mistake, not a product bug, but exactly
  // the kind of thing worth getting right rather than silently loosening
  // the assertion.)
  const cashAndBank = getEntity(getEntityTree().find((e) => e.name === 'Cash and Bank')!.id);
  assert.equal(cashAndBank!.balance_minor, 50000 + 12345);
});

test('trial balance shows every posted account split into debit/credit, and the two columns match', () => {
  const tb = getTrialBalance('My Business', 'Actual');
  assert.ok(tb.rows.length > 0);
  const cash = tb.rows.find((r) => r.name === 'Cash and Bank');
  assert.ok(cash);
  assert.equal(cash!.debit_minor, 50000 + 12345);
  assert.equal(cash!.credit_minor, 0);
  assert.equal(tb.total_debit_minor, tb.total_credit_minor, 'a real ledger must always balance');
});

test('trial balance omits accounts with a zero balance', () => {
  const tb = getTrialBalance('My Business', 'Actual');
  assert.ok(!tb.rows.some((r) => r.debit_minor === 0 && r.credit_minor === 0));
});

test('balance sheet computes real totals and confirms Assets = Liabilities + Equity', () => {
  const bs = getBalanceSheet('My Business', 'Actual');
  assert.ok(bs.assets.some((a) => a.name === 'Cash and Bank'));
  assert.equal(bs.total_assets_minor, bs.total_liabilities_minor + bs.total_equity_minor, 'the fundamental accounting equation must hold');
  assert.equal(bs.balanced, true);
});

test('profit and loss computes real totals and net income', () => {
  const pl = getProfitAndLoss('My Business', 'Actual');
  const salesRevenue = pl.income.find((l) => l.name === 'Sales Revenue');
  assert.ok(salesRevenue);
  assert.equal(pl.total_income_minor, pl.income.reduce((s, l) => s + l.credit_minor - l.debit_minor, 0));
  assert.equal(pl.net_income_minor, pl.total_income_minor - pl.total_expenses_minor);
});

test('profit and loss excludes a Year End Close entry from its own totals, even when the close happened within the requested date range — a real, direct bug report: "the consolidated p&l shows zero"', () => {
  createEntity({ name: 'PLCloseTest Ledger', parent: 'My Business' }, 1);
  createEntity({ name: 'PLCloseTest Revenue', parent: 'Income' }, 1);

  stageLine({ reference: 'PLCT-1', business: 'My Business', ledger: 'PLCloseTest Ledger', transdate: '2027-04-01', account: 'PLCloseTest Revenue', amount_minor: -50000 });
  stageLine({ reference: 'PLCT-1', business: 'My Business', ledger: 'PLCloseTest Ledger', transdate: '2027-04-01', account: 'Cash and Bank', amount_minor: 50000 });
  postJournalEntry('PLCT-1', 'My Business', 'PLCloseTest Ledger', 1);

  // Before closing, the real period total is correct either way.
  const before = getProfitAndLoss('My Business', 'PLCloseTest Ledger', '2027-04-01', '2027-04-30');
  assert.equal(before.total_income_minor, 50000);

  // The real bug: closing ON THE LAST DAY OF THE SAME RANGE used to
  // make the close entry's own reversal cancel out the real revenue
  // it's reversing, showing a misleading zero for a period that
  // genuinely had real activity.
  closeBooks('My Business', 'PLCloseTest Ledger', '2027-04-30', "Owner's Equity", 1);
  const after = getProfitAndLoss('My Business', 'PLCloseTest Ledger', '2027-04-01', '2027-04-30');
  assert.equal(after.total_income_minor, 50000, "a Year End Close's own reversal must never be counted as item of the period's real P&L, even when the close date falls inside the requested range");
});

test('profit and loss income_tree groups by the real category hierarchy, with correct subtotals at every level', () => {
  // Self-contained, not dependent on the wine simulation ever having
  // been run — creates its own real, two-level category chain, its
  // own real products under it, and posts real sales directly.
  createEntity({ name: 'PL Tree Test Ledger', parent: 'My Business' }, 1);
  createEntity({ name: 'PL Tree Beverages', parent: 'Items' }, 1);
  createEntity({ name: 'PL Tree Cider', parent: 'PL Tree Beverages' }, 1);
  createEntity({ name: 'PL Tree Dry Cider 500ml', parent: 'PL Tree Cider' }, 1);
  createEntity({ name: 'PL Tree Sweet Cider 500ml', parent: 'PL Tree Cider' }, 1);
  const dry = ensureProductSalesCogsAccounts('PL Tree Dry Cider 500ml', 1);
  const sweet = ensureProductSalesCogsAccounts('PL Tree Sweet Cider 500ml', 1);

  function post(reference: string, lines: { account: string; accountId?: number; amount_minor: number }[]) {
    for (const line of lines) {
      stageLine({ reference, business: 'My Business', ledger: 'PL Tree Test Ledger', transdate: '2027-02-01', account: line.account, accountId: line.accountId, amount_minor: line.amount_minor });
    }
    postJournalEntry(reference, 'My Business', 'PL Tree Test Ledger', 1);
  }
  post('PLT-1', [
    { account: 'Cash and Bank', amount_minor: 5000 },
    { account: dry.salesAccount, accountId: dry.salesAccountId, amount_minor: -5000 },
  ]);
  post('PLT-2', [
    { account: 'Cash and Bank', amount_minor: 3000 },
    { account: sweet.salesAccount, accountId: sweet.salesAccountId, amount_minor: -3000 },
  ]);

  const pl = getProfitAndLoss('My Business', 'PL Tree Test Ledger');
  const treeTotal = pl.income_tree.reduce((s, n) => s + n.credit_minor - n.debit_minor, 0);
  assert.equal(treeTotal, pl.total_income_minor, 'summing every top-level tree node must equal the flat total exactly');
  assert.equal(pl.total_income_minor, 8000);

  const salesHeading = pl.income_tree.find((n) => n.name === 'Sales Revenue');
  assert.ok(salesHeading, 'the real, existing Sales Revenue heading account must be present as the one, top-level entry');
  const beverages = salesHeading!.children.find((n) => n.name === 'PL Tree Beverages');
  assert.ok(beverages, 'a real, known category must be present under the real Sales heading');
  assert.equal(beverages!.is_leaf, false);
  const cider = beverages!.children.find((c) => c.name === 'PL Tree Cider');
  assert.ok(cider, 'a real, nested sub-category must be present');
  assert.equal(cider!.is_leaf, false);
  assert.equal(cider!.credit_minor, 8000, "a category's own subtotal must be the real sum of its real leaf descendants");

  const dryLeaf = cider!.children.find((c) => c.name === dry.salesAccount);
  assert.ok(dryLeaf, 'a real, known leaf account must be present at the deepest level');
  assert.equal(dryLeaf!.is_leaf, true);
  assert.equal(dryLeaf!.children.length, 0);
  assert.equal(dryLeaf!.credit_minor, 5000);
});

test('Actual and a budget ledger are genuinely isolated in every financial statement — this is the whole point of having separate ledgers, and it was actually broken once', () => {
  // Reproduces the exact bug found while writing a training guide that
  // needed to demonstrate Actual vs Budget: posting to one ledger was
  // silently affecting the other's reports, because account.balance_minor
  // is a single running total shared across all ledgers. Trial balance
  // for "Actual" showed 110000 (50000 bootstrap + 10000 Actual posting +
  // 50000 Budget posting all summed together) instead of 60000.
  stageLine({
    reference: 'ISOLATION-ACTUAL',
    business: 'My Business',
    ledger: 'Actual',
    account: 'Cash and Bank',
    amount_minor: 10000,
  });
  stageLine({
    reference: 'ISOLATION-ACTUAL',
    business: 'My Business',
    ledger: 'Actual',
    account: 'Sales Revenue',
    amount_minor: -10000,
  });
  postJournalEntry('ISOLATION-ACTUAL', 'My Business', 'Actual', 1);

  stageLine({
    reference: 'ISOLATION-BUDGET',
    business: 'My Business',
    ledger: 'Proposed Growth Budget 2026-27',
    account: 'Cash and Bank',
    amount_minor: 999999,
  });
  stageLine({
    reference: 'ISOLATION-BUDGET',
    business: 'My Business',
    ledger: 'Proposed Growth Budget 2026-27',
    account: 'Sales Revenue',
    amount_minor: -999999,
  });
  postJournalEntry('ISOLATION-BUDGET', 'My Business', 'Proposed Growth Budget 2026-27', 1);

  const actualCash = getTrialBalance('My Business', 'Actual').rows.find((r) => r.name === 'Cash and Bank');
  const budgetCash = getTrialBalance('My Business', 'Proposed Growth Budget 2026-27').rows.find((r) => r.name === 'Cash and Bank');

  assert.notEqual(
    actualCash?.debit_minor,
    budgetCash?.debit_minor,
    'Actual and Budget must show different numbers for the same account — if they match, the ledgers are bleeding into each other'
  );
  assert.equal(budgetCash?.debit_minor, 999999, "Budget's trial balance must reflect only its own posting, not Actual's too");
  assert.ok((actualCash?.debit_minor ?? 0) < 999999, "Actual's trial balance must not include Budget's huge posting");

  const actualBS = getBalanceSheet('My Business', 'Actual');
  const budgetBS = getBalanceSheet('My Business', 'Proposed Growth Budget 2026-27');
  assert.notEqual(actualBS.total_assets_minor, budgetBS.total_assets_minor);
  assert.equal(budgetBS.balanced, true, "Budget's own balance sheet must still balance on its own terms");
});

test('trial balance comparison shows Actual and Budget side by side for the same account', () => {
  // Reuses the postings from the isolation test above: Actual has 10000
  // debited to Cash and Bank, Budget has 999999.
  const cmp = getTrialBalanceComparison('My Business', 'Actual', 'Proposed Growth Budget 2026-27');
  const cash = cmp.rows.find((r) => r.name === 'Cash and Bank');
  assert.ok(cash);
  assert.equal(cash!.b_debit_minor, 999999);
  assert.notEqual(cash!.a_debit_minor, cash!.b_debit_minor);
});

test('profit and loss comparison computes variance in the conventional direction (budget minus actual)', () => {
  const cmp = getProfitAndLossComparison('My Business', 'Actual', 'Proposed Growth Budget 2026-27');
  const revenue = cmp.income.find((l) => l.name === 'Sales Revenue');
  assert.ok(revenue);
  assert.equal(revenue!.variance_minor, revenue!.b_minor - revenue!.a_minor);
  assert.equal(cmp.net_income_variance_minor, cmp.b_net_income_minor - cmp.a_net_income_minor);
  // Budget's isolated posting (999999) should dwarf Actual's (10000) —
  // proving this comparison reflects the same real isolation as the
  // test above, not some third combined number.
  assert.ok(cmp.b_total_income_minor > cmp.a_total_income_minor);
});

test('a new entity has no contact until one is set', () => {
  createEntity({ name: 'Gamma Contact Test', parent: 'Accounts Receivable' }, 1);
  assert.equal(getContact('Gamma Contact Test'), undefined);
});

test('setContact then getContact round-trips correctly', () => {
  setContact('Gamma Contact Test', {
    phone: '555-0100',
    email: 'ap@gamma.example',
    city: 'Springfield',
    country: 'USA',
  });
  const c = getContact('Gamma Contact Test');
  assert.equal(c!.phone, '555-0100');
  assert.equal(c!.email, 'ap@gamma.example');
  assert.equal(c!.city, 'Springfield');
  assert.equal(c!.address_line1, null, 'fields not provided should be null, not undefined or an error');
});

test('setContact is a full replace, not a partial merge — calling it again with fewer fields clears the rest', () => {
  // This is a real, deliberate behavior (see the note in schema.sql) —
  // documented here as a test so it's an explicit contract, not an
  // accident someone discovers later. Callers (the frontend) must always
  // send the complete current record.
  setContact('Gamma Contact Test', { phone: '555-9999' });
  const c = getContact('Gamma Contact Test');
  assert.equal(c!.phone, '555-9999');
  assert.equal(c!.email, null, 'email was not resent, so it is correctly cleared, not preserved');
});

test('deleteEntity closes the entity out but deliberately keeps its contact record — a historical fact about a now-closed entity, not something that disappears', () => {
  const e = createEntity({ name: 'Delta Contact Test', parent: 'Accounts Receivable' }, 1);
  setContact('Delta Contact Test', { phone: '555-1111' });
  deleteEntity(e.id, 1);
  assert.equal(getEntity(e.id), undefined, 'the entity itself is closed out — no longer current');
  const row = db.prepare(`SELECT phone FROM contact WHERE entity_id = ?`).get(e.id) as { phone: string } | undefined;
  assert.equal(row?.phone, '555-1111', 'the contact row is deliberately NOT removed — it stays as history');
});

test('createRecurringJournal rejects an entry that does not balance at its start date', () => {
  assert.throws(
    () =>
      createRecurringJournal('My Business', 'Actual', 'REC-BAD', '2027-01-01', 'monthly', [
        { account: 'Rent', amount_minor: 50000 },
      ], 1),
    PostingError
  );
});

test('createRecurringJournal vivifies any account with no BALANCE yet, same guarantee as ordinary posting', () => {
  // Rent already has an account row from bootstrap (it has a real
  // account number, 6000) — vivification here means "has it ever
  // actually been posted to," checked via balance, not "does the row
  // exist at all," which every numbered bootstrap account already
  // satisfies from the start now.
  const rentBefore = db.prepare(`SELECT balance_minor FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name='Rent')`).get() as { balance_minor: number };
  assert.equal(rentBefore.balance_minor, 0, 'sanity check: Rent has never been posted to in this test run yet');

  createRecurringJournal('My Business', 'Actual', 'REC-RENT', '2027-01-01', 'monthly', [
    { account: 'Rent', amount_minor: 50000 },
    { account: 'Cash and Bank', amount_minor: -50000 },
  ], 1, 'Monthly rent', 6);

  const rentAfter = db.prepare(`SELECT 1 FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name='Rent')`).get();
  assert.ok(rentAfter, 'Rent should still have its account row');
});

test('a recurring journal expands into the correct number of occurrences, each showing in listJournalEntries', () => {
  const entries = listJournalEntries('My Business', 'Actual', 200);
  const rentOccurrences = entries.filter((e) => e.reference === 'REC-RENT');
  assert.equal(rentOccurrences.length, 6, 'a 6-month recurrence should produce exactly 6 occurrences, not 1 journal row');
  assert.ok(rentOccurrences.every((o) => o.recurrence === 'monthly'));
  assert.equal(rentOccurrences[0].total_debit_minor, 50000);
});

test('a recurring journal correctly affects Trial Balance for its ledger, across all its occurrences', () => {
  const tb = getTrialBalance('My Business', 'Actual');
  const rent = tb.rows.find((r) => r.name === 'Rent');
  assert.ok(rent);
  assert.equal(rent!.debit_minor, 50000 * 6, 'Rent should reflect all 6 monthly occurrences, not just one');
});

test('the exact wage-increase scenario: a mid-schedule amendment applies only from its effective date onward, via the same journal_line row set — no new table, no new journal', () => {
  createRecurringJournal(
    'My Business',
    'Actual',
    'REC-WAGE',
    '2027-01-01',
    'monthly',
    [
      { account: 'Wages', amount_minor: 100000, effective_date: '2027-01-01' },
      { account: 'Wages', amount_minor: 110000, effective_date: '2027-05-01' }, // the boss's raise
      { account: 'Cash and Bank', amount_minor: -100000, effective_date: '2027-01-01' },
      { account: 'Cash and Bank', amount_minor: -110000, effective_date: '2027-05-01' },
    ],
    1,
    'Wages',
    12
  );

  const occurrences = db
    .prepare(
      `SELECT transdate, amount_minor FROM journal_occurrences
       WHERE journal_id = (SELECT id FROM journal WHERE reference = 'REC-WAGE')
         AND account_id = (SELECT id FROM current_entities WHERE name = 'Wages')
       ORDER BY transdate`
    )
    .all() as { transdate: string; amount_minor: number }[];

  assert.equal(occurrences.length, 12, 'a 12-month recurrence should produce 12 occurrences');
  assert.equal(occurrences[0].amount_minor, 100000, 'January must still be the original 1000');
  assert.equal(occurrences[3].amount_minor, 100000, 'April must still be the original 1000, unaffected by the May amendment');
  assert.equal(occurrences[4].amount_minor, 110000, 'May must reflect the raise');
  assert.equal(occurrences[11].amount_minor, 110000, 'December must still reflect the raise, not revert');
});

test('createRecurringJournal has not touched the Budget ledger — Actual and Budget stay isolated even for recurring entries, same as ordinary ones', () => {
  createRecurringJournal('My Business', 'Proposed Growth Budget 2026-27', 'REC-BUDGET-RENT', '2027-01-01', 'monthly', [
    { account: 'Rent', amount_minor: 60000 },
    { account: 'Cash and Bank', amount_minor: -60000 },
  ], 1, 'Budgeted rent', 12);

  const actualRent = getTrialBalance('My Business', 'Actual').rows.find((r) => r.name === 'Rent');
  const budgetRent = getTrialBalance('My Business', 'Proposed Growth Budget 2026-27').rows.find((r) => r.name === 'Rent');
  assert.equal(actualRent!.debit_minor, 300000, "Actual's Rent must be unaffected by the Budget ledger's recurring entry");
  assert.equal(budgetRent!.debit_minor, 60000 * 12, "Budget's Rent should reflect its own full 12-month schedule");
});

test('a realistic set of transactions — cash purchase, cash sale, AR sale, a receipt against it, AP purchase, a payment against it — all post correctly and the full chain (balances, trial balance, balance sheet, P&L) reflects every one of them', () => {
  // A fresh, dedicated ledger for this test so its numbers are easy to
  // reason about in isolation from everything else already posted
  // elsewhere in this test run.
  createEntity({ name: 'Worked Set Ledger', parent: 'My Business' }, 1);

  function post(reference: string, lines: { account: string; amount_minor: number; memo?: string }[]) {
    for (const line of lines) {
      stageLine({ reference, business: 'My Business', ledger: 'Worked Set Ledger', transdate: '2027-02-01', account: line.account, amount_minor: line.amount_minor, memo: line.memo });
    }
    postJournalEntry(reference, 'My Business', 'Worked Set Ledger', 1);
  }

  // Cash purchase — bought office supplies outright, $80.
  post('WS-CASHPURCHASE', [
    { account: 'Office', amount_minor: 8000 },
    { account: 'Cash and Bank', amount_minor: -8000 },
  ]);

  // Cash sale — a walk-in customer paid $300 on the spot.
  post('WS-CASHSALE', [
    { account: 'Cash and Bank', amount_minor: 30000 },
    { account: 'Sales Revenue', amount_minor: -30000 },
  ]);

  // AR sale — sold $1,000 of goods to Acme Corp on credit.
  post('WS-ARSALE', [
    { account: 'Acme Corp', amount_minor: 100000 },
    { account: 'Sales Revenue', amount_minor: -100000 },
  ]);

  // A receipt from Acme Corp against that same AR balance, $400 by EFT.
  post('WS-RECEIPT', [
    { account: 'Cash and Bank', amount_minor: 40000 },
    { account: 'Acme Corp', amount_minor: -40000 },
  ]);

  // AP purchase — bought $500 of inventory from Acme Supplies on credit.
  post('WS-APPURCHASE', [
    { account: 'Inventory', amount_minor: 50000 },
    { account: 'Acme Supplies Pty Ltd', amount_minor: -50000 },
  ]);

  // A payment to Acme Supplies against that AP balance, $200.
  post('WS-PAYMENT', [
    { account: 'Acme Supplies Pty Ltd', amount_minor: 20000 },
    { account: 'Cash and Bank', amount_minor: -20000 },
  ]);

  // Cash and Bank: -8000 (purchase) +30000 (cash sale) +40000 (receipt) -20000 (payment) = 42000
  const tb = getTrialBalance('My Business', 'Worked Set Ledger');
  const cash = tb.rows.find((r) => r.name === 'Cash and Bank');
  assert.equal(cash!.debit_minor, 42000, 'Cash and Bank should net all four cash-affecting transactions correctly');

  // Acme Corp (AR): +100000 (sale) - 40000 (receipt) = 60000 still owed
  const acmeCorp = tb.rows.find((r) => r.name === 'Acme Corp');
  assert.equal(acmeCorp!.debit_minor, 60000, 'Acme Corp should still owe 600.00 after the partial receipt');

  // Acme Supplies (AP): -50000 (purchase) + 20000 (payment) = -30000 still owed to them
  const acmeSupplies = tb.rows.find((r) => r.name === 'Acme Supplies Pty Ltd');
  assert.equal(acmeSupplies!.credit_minor, 30000, 'Acme Supplies should still be owed 300.00 after the partial payment');

  assert.equal(tb.total_debit_minor, tb.total_credit_minor, 'the whole set together must still balance');

  // Balance Sheet: Acme Corp (AR) and Acme Supplies (AP) should show up
  // as real asset/liability balances, not just in the trial balance.
  const bs = getBalanceSheet('My Business', 'Worked Set Ledger');
  assert.ok(bs.assets.some((a) => a.name === 'Acme Corp' && a.debit_minor === 60000));
  assert.ok(bs.liabilities.some((l) => l.name === 'Acme Supplies Pty Ltd' && l.credit_minor === 30000));
  assert.equal(bs.total_assets_minor, bs.total_liabilities_minor + bs.total_equity_minor, 'the accounting equation must hold for this ledger too');

  // P&L: 300 (cash sale) + 1000 (AR sale) = 1300 revenue; 80 (office) expense.
  const pl = getProfitAndLoss('My Business', 'Worked Set Ledger');
  assert.equal(pl.total_income_minor, 30000 + 100000);
  assert.equal(pl.total_expenses_minor, 8000);
  assert.equal(pl.net_income_minor, 30000 + 100000 - 8000);
});

test('AR Sale form: staging and posting creates the correct Debit AR / Credit Sales Revenue entry', () => {
  stageArSale({ reference: 'ARF-1', business: 'My Business', ledger: 'Actual', customer: 'Beta Pty Ltd', amount_minor: 80000, transdate: '2027-07-01', description: 'Sale' });
  postArSale('ARF-1', 'My Business', 'Actual', 1);

  const detail = db.prepare(`SELECT count(*) c FROM ar_sale_staging`).get() as { c: number };
  assert.equal(detail.c, 0, 'staging should be cleared after posting');

  const tb = getTrialBalance('My Business', 'Actual');
  const beta = tb.rows.find((r) => r.name === 'Beta Pty Ltd');
  assert.equal(beta!.debit_minor, 80000);
});

test('AR Receipt form: staging and posting creates the correct Debit Cash / Credit AR entry, reducing the customer balance', () => {
  stageArReceipt({ reference: 'ARR-1', business: 'My Business', ledger: 'Actual', customer: 'Beta Pty Ltd', amount_minor: 30000, transdate: '2027-07-10' });
  postArReceipt('ARR-1', 'My Business', 'Actual', 1);

  const tb = getTrialBalance('My Business', 'Actual');
  const beta = tb.rows.find((r) => r.name === 'Beta Pty Ltd');
  assert.equal(beta!.debit_minor, 50000, 'Beta should owe 500.00 after the 300.00 receipt against the 800.00 sale');
});

test('AP Purchase form: staging and posting creates the correct Debit expense/asset / Credit AP entry', () => {
  stageApPurchase({ reference: 'APF-1', business: 'My Business', ledger: 'Actual', vendor: 'Acme Supplies Pty Ltd', expense_account: 'Office', amount_minor: 15000, transdate: '2027-07-01' });
  postApPurchase('APF-1', 'My Business', 'Actual', 1);

  const tb = getTrialBalance('My Business', 'Actual');
  const acmeSupplies = tb.rows.find((r) => r.name === 'Acme Supplies Pty Ltd');
  assert.ok(acmeSupplies!.credit_minor >= 15000);
  const office = tb.rows.find((r) => r.name === 'Office');
  assert.ok(office);
});

test('AP Payment form: staging and posting creates the correct Debit AP / Credit Cash entry, reducing the vendor balance', () => {
  const before = getTrialBalance('My Business', 'Actual').rows.find((r) => r.name === 'Acme Supplies Pty Ltd')!.credit_minor;
  stageApPayment({ reference: 'APP-1', business: 'My Business', ledger: 'Actual', vendor: 'Acme Supplies Pty Ltd', amount_minor: 5000, transdate: '2027-07-15' });
  postApPayment('APP-1', 'My Business', 'Actual', 1);

  const after = getTrialBalance('My Business', 'Actual').rows.find((r) => r.name === 'Acme Supplies Pty Ltd')!.credit_minor;
  assert.equal(after, before - 5000, 'the vendor balance owed should decrease by exactly the payment amount');
});

test('AR/AP forms reuse the same atomic posting mechanism — an unbalanced-by-construction scenario is not reachable, but a bad reference is rejected clearly, consistent with every other post* function', () => {
  assert.throws(() => postArSale('NEVER-STAGED', 'My Business', 'Actual', 1), NotFoundError);
});

test('reversing a posted entry creates a new entry with every line negated, and the net effect on balances is exactly zero', () => {
  createEntity({ name: 'Reversal Test Ledger', parent: 'My Business' }, 1);
  stageLine({ reference: 'REV-SOURCE', business: 'My Business', ledger: 'Reversal Test Ledger', transdate: '2027-09-01', account: 'Cash and Bank', amount_minor: 7500 });
  stageLine({ reference: 'REV-SOURCE', business: 'My Business', ledger: 'Reversal Test Ledger', transdate: '2027-09-01', account: 'Sales Revenue', amount_minor: -7500 });
  postJournalEntry('REV-SOURCE', 'My Business', 'Reversal Test Ledger', 1);

  const before = getTrialBalance('My Business', 'Reversal Test Ledger').rows.find((r) => r.name === 'Cash and Bank')!.debit_minor;
  assert.equal(before, 7500);

  const entries = listJournalEntries('My Business', 'Reversal Test Ledger', 200);
  const source = entries.find((e) => e.reference === 'REV-SOURCE')!;
  reverseJournalEntry('My Business', 'Reversal Test Ledger', source.journal_id, source.occurrence_date!, 1, '2027-09-15');

  const after = getTrialBalance('My Business', 'Reversal Test Ledger');
  const cash = after.rows.find((r) => r.name === 'Cash and Bank');
  assert.equal(cash, undefined, 'after reversal, Cash and Bank should have exactly zero net effect and not even appear');

  const reversalEntry = listJournalEntries('My Business', 'Reversal Test Ledger', 200).find((e) => e.reference.startsWith('REV-SOURCE-REV-'));
  assert.ok(reversalEntry, 'the reversal should show up as its own real entry in the journal list');
  assert.equal(reversalEntry!.total_debit_minor, 7500);
  assert.equal(reversalEntry!.total_credit_minor, 7500);

  const journalRow = db.prepare(`SELECT reversal_of FROM journal WHERE reference = ?`).get(reversalEntry!.reference) as { reversal_of: number };
  assert.equal(journalRow.reversal_of, source.journal_id, 'the reversal must reference the original journal it reverses');
});

test('reversing a nonexistent occurrence is rejected clearly', () => {
  assert.throws(() => reverseJournalEntry('My Business', 'Actual', 999999, '2027-01-01', 1), NotFoundError);
});

test('complete end-to-end lifecycle: purchase order -> receipt -> sales order -> dispatch/invoice -> cash collected -> vendor paid, every account balance verified at each step', () => {
  // A fresh, dedicated ledger and a fresh batch of Widget accounts, so
  // this test's numbers are easy to verify in isolation from anything
  // else posted elsewhere in this test run.
  createEntity({ name: 'Lifecycle Test Ledger', parent: 'My Business' }, 1);
  createEntity({ name: 'LTWidget Batch Qty', parent: 'Stock Quantities' }, 1);
  createEntity({ name: 'LTWidget Batch Value', parent: 'Inventory' }, 1);
  const business = 'My Business';
  const ledger = 'Lifecycle Test Ledger';

  // --- Step 1: place PO-LT01 — 100 units @ $5.00, memo only ---
  placeOrder('PO-LT01', business, ledger, 100, 50000, 1, '2027-06-01');
  assert.deepEqual(getOrderStatus('PO-LT01'), { quantity: 100, value_minor: 50000 });

  // --- Step 2: receive all 100 units from Acme Supplies ---
  postQuantityMovement(business, ledger, 'RCPT-LT01-QTY', 'LTWidget Batch Qty', 100, 1, '2027-06-01');
  stageLine({ reference: 'RCPT-LT01-VALUE', business, ledger, transdate: '2027-06-01', account: 'LTWidget Batch Value', amount_minor: 50000 });
  stageLine({ reference: 'RCPT-LT01-VALUE', business, ledger, transdate: '2027-06-01', account: 'Acme Supplies Pty Ltd', amount_minor: -50000 });
  postJournalEntry('RCPT-LT01-VALUE', business, ledger, 1);
  fulfillOrder('PO-LT01', 'RCPT-LT01', business, ledger, 100, 50000, 1, '2027-06-01');

  assert.deepEqual(getOrderStatus('PO-LT01'), { quantity: 0, value_minor: 0 }, 'PO fully closed, no back order');
  const qtyBalance = (name: string) =>
    (db.prepare(`SELECT balance_minor FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name = ?)`).get(name) as { balance_minor: number }).balance_minor;
  assert.equal(qtyBalance('LTWidget Batch Qty'), 100, 'quantity lives outside Chart of Accounts, checked directly, not via getTrialBalance');
  const afterReceipt = getTrialBalance(business, ledger);
  assert.equal(afterReceipt.rows.find((r) => r.name === 'LTWidget Batch Qty'), undefined, 'a quantity account must NEVER appear in a real financial statement');
  assert.equal(afterReceipt.rows.find((r) => r.name === 'LTWidget Batch Value')!.debit_minor, 50000);
  assert.equal(afterReceipt.rows.find((r) => r.name === 'Acme Supplies Pty Ltd')!.credit_minor, 50000);

  // --- Step 3: place SO-LT01 — Acme Corp orders 30 units @ $8.00 selling price ---
  placeOrder('SO-LT01', business, ledger, 30, 24000, 1, '2027-06-05');
  assert.deepEqual(getOrderStatus('SO-LT01'), { quantity: 30, value_minor: 24000 });

  // --- Step 4: dispatch + invoice — ship 30 units, invoice Acme Corp ---
  stageLine({ reference: 'INV-LT01', business, ledger, transdate: '2027-06-05', account: 'Acme Corp', amount_minor: 24000 });
  stageLine({ reference: 'INV-LT01', business, ledger, transdate: '2027-06-05', account: 'Sales Revenue', amount_minor: -24000 });
  postJournalEntry('INV-LT01', business, ledger, 1);

  stageLine({ reference: 'COGS-LT01', business, ledger, transdate: '2027-06-05', account: 'Cost of Goods Sold', amount_minor: 15000 });
  stageLine({ reference: 'COGS-LT01', business, ledger, transdate: '2027-06-05', account: 'LTWidget Batch Value', amount_minor: -15000 });
  postJournalEntry('COGS-LT01', business, ledger, 1);
  postQuantityMovement(business, ledger, 'DISPATCH-LT01-QTY', 'LTWidget Batch Qty', -30, 1, '2027-06-05');
  fulfillOrder('SO-LT01', 'DISPATCH-LT01', business, ledger, 30, 24000, 1, '2027-06-05');

  assert.deepEqual(getOrderStatus('SO-LT01'), { quantity: 0, value_minor: 0 }, 'SO fully fulfilled, no back order');
  const afterDispatch = getTrialBalance(business, ledger);
  assert.equal(afterDispatch.rows.find((r) => r.name === 'Acme Corp')!.debit_minor, 24000);
  assert.equal(afterDispatch.rows.find((r) => r.name === 'Sales Revenue')!.credit_minor, 24000);
  assert.equal(afterDispatch.rows.find((r) => r.name === 'Cost of Goods Sold')!.debit_minor, 15000, 'COGS must reflect the 5.00 acquisition cost, not the 8.00 selling price');
  assert.equal(afterDispatch.rows.find((r) => r.name === 'LTWidget Batch Qty'), undefined, 'still must never appear in a real financial statement');
  const remainingQty = qtyBalance('LTWidget Batch Qty');
  const remainingValue = afterDispatch.rows.find((r) => r.name === 'LTWidget Batch Value')!.debit_minor;
  assert.equal(remainingQty, 70);
  assert.equal(remainingValue, 35000);
  assert.equal(remainingValue / remainingQty, 500, 'implied unit cost must still be exactly $5.00 after partial consumption');

  // --- Step 5: cash collected from Acme Corp ---
  stageLine({ reference: 'RCPT-LT01-CASH', business, ledger, transdate: '2027-06-10', account: 'Cash and Bank', amount_minor: 24000 });
  stageLine({ reference: 'RCPT-LT01-CASH', business, ledger, transdate: '2027-06-10', account: 'Acme Corp', amount_minor: -24000 });
  postJournalEntry('RCPT-LT01-CASH', business, ledger, 1);

  // --- Step 6: pay Acme Supplies ---
  stageLine({ reference: 'PMT-LT01', business, ledger, transdate: '2027-06-10', account: 'Acme Supplies Pty Ltd', amount_minor: 50000 });
  stageLine({ reference: 'PMT-LT01', business, ledger, transdate: '2027-06-10', account: 'Cash and Bank', amount_minor: -50000 });
  postJournalEntry('PMT-LT01', business, ledger, 1);

  const final = getTrialBalance(business, ledger);
  assert.equal(final.rows.find((r) => r.name === 'Acme Corp'), undefined, 'Acme Corp fully paid, zero net balance');
  assert.equal(final.rows.find((r) => r.name === 'Acme Supplies Pty Ltd'), undefined, 'Acme Supplies fully paid, zero net balance');
  assert.equal(final.total_debit_minor, final.total_credit_minor, 'the whole six-step lifecycle must still balance as one');
  const cash = final.rows.find((r) => r.name === 'Cash and Bank');
  assert.equal(cash!.credit_minor, 26000, 'net cash: +240.00 collected, -500.00 paid = -260.00 net, shown as a credit balance');
});

test('a partial receipt against a purchase order leaves a genuine, correctly-sized back order', () => {
  createEntity({ name: 'Backorder Test Ledger', parent: 'My Business' }, 1);
  createEntity({ name: 'BOWidget Batch Qty', parent: 'Stock Quantities' }, 1);
  createEntity({ name: 'BOWidget Batch Value', parent: 'Inventory' }, 1);
  const business = 'My Business';
  const ledger = 'Backorder Test Ledger';

  placeOrder('PO-BO01', business, ledger, 100, 50000, 1, '2027-07-01');

  // Only 60 of the 100 ordered units actually arrive.
  postQuantityMovement(business, ledger, 'RCPT-BO01-QTY', 'BOWidget Batch Qty', 60, 1, '2027-07-05');
  fulfillOrder('PO-BO01', 'RCPT-BO01', business, ledger, 60, 30000, 1, '2027-07-05');

  const afterPartial = getOrderStatus('PO-BO01');
  assert.equal(afterPartial.quantity, 40, 'the remaining 40 units ARE the back order — no separate status field needed');
  assert.equal(afterPartial.value_minor, 20000);

  // The rest arrives later, closing the PO out completely.
  postQuantityMovement(business, ledger, 'RCPT-BO01B-QTY', 'BOWidget Batch Qty', 40, 1, '2027-07-20');
  fulfillOrder('PO-BO01', 'RCPT-BO01B', business, ledger, 40, 20000, 1, '2027-07-20');

  assert.deepEqual(getOrderStatus('PO-BO01'), { quantity: 0, value_minor: 0 }, 'PO fully closed once the back order is later fulfilled');
});

test('a real Purchase Order still knows its real vendor and item after posting — no extra table, the same real relation every entity already has', () => {
  createEntity({ name: 'PORelationTest Ledger', parent: 'My Business' }, 1);
  createEntity({ name: 'PORelationTest Vendor', parent: 'Vendors' }, 1);
  createItem('PORelationTest Wine', 'Items', 1);

  stagePurchaseOrder({
    reference: 'PORELTEST-1',
    business: 'My Business',
    ledger: 'PORelationTest Ledger',
    vendor: 'PORelationTest Vendor',
    item: 'PORelationTest Wine',
    quantity: 24,
    price_minor: 1500,
  });
  postPurchaseOrder('PORELTEST-1', 'My Business', 'PORelationTest Ledger', 1);

  // po_staging (vendor, item) is genuinely deleted after posting —
  // the real, direct proof this doesn't come from staging still being
  // there.
  const stillStaged = db.prepare(`SELECT 1 FROM po_staging WHERE reference = ?`).get('PORELTEST-1');
  assert.equal(stillStaged, undefined, 'the real staging row is genuinely gone — what follows must come from the real, posted entities themselves');

  const entities = getEntityTree();
  const byId = new Map(entities.map((e) => [e.id, e]));
  const qtyEntity = entities.find((e) => e.name === 'PORELTEST-1 Qty');
  const valueEntity = entities.find((e) => e.name === 'PORELTEST-1 Value');
  assert.ok(qtyEntity && valueEntity);

  assert.equal(byId.get(qtyEntity!.relation_id!)?.name, 'PORelationTest Vendor', "the real Qty entity's own relation must carry the real vendor");
  assert.equal(byId.get(valueEntity!.relation_id!)?.name, 'PORelationTest Wine', "the real Value entity's own relation must carry the real item");
});

test('getLocationCapacityStatus: a real location\'s own, current real stock checked against its own, real configured capacity — found to be purely informational and never enforced anywhere, per docs/TODO.md', () => {
  createEntity({ name: 'CapTest Outlet', parent: 'Locations' }, 1);
  setLocation('CapTest Outlet', { city: 'CapTest City', location_type: 'Retail', is_billing_address: false, bottle_capacity: 100, carton_capacity: 10 , timezone: 'UTC'});
  createEntity({ name: 'CapTest Vendor', parent: 'Vendors' }, 1);
  createItem('CapTest Wine', 'Items', 1);
  addOrUpdateItemSource({ itemName: 'CapTest Wine', vendorName: 'CapTest Vendor', priceMinor: 1500, packageQuantity: 12, isPreferred: true }); // 12 bottles per real carton

  const before = getLocationCapacityStatus('CapTest Outlet');
  assert.equal(before.bottleQuantity, 0);
  assert.equal(before.bottleCapacity, 100);
  assert.equal(before.bottleOverCapacity, false);
  assert.equal(before.cartonCapacity, 10);
  assert.equal(before.cartonOverCapacity, false);

  receiveStockAtLocation('My Business', 'Actual', 'CAPTEST-REC-1', 'CapTest Wine', 'CapTest Outlet', 130, 1, '2027-01-01');
  const after = getLocationCapacityStatus('CapTest Outlet');
  assert.equal(after.bottleQuantity, 130);
  assert.equal(after.bottleOverCapacity, true, 'a real 130 bottles against a real 100-bottle capacity must correctly show as over');
  assert.equal(after.cartonQuantity, Math.round((130 / 12) * 100) / 100, "a real carton-equivalent quantity must use this product's own real, preferred vendor package_quantity (12), not a flat, assumed figure");
  assert.equal(after.cartonOverCapacity, true, 'a real 10.83 cartons against a real 10-carton capacity must correctly show as over');

  // A real location with no configured capacity at all — never silently treated as "over" just because none was set.
  createEntity({ name: 'CapTest No Capacity Outlet', parent: 'Locations' }, 1);
  setLocation('CapTest No Capacity Outlet', { city: 'CapTest City', location_type: 'Retail', is_billing_address: false, bottle_capacity: null, carton_capacity: null , timezone: 'UTC'});
  const noCapacity = getLocationCapacityStatus('CapTest No Capacity Outlet');
  assert.equal(noCapacity.bottleCapacity, null);
  assert.equal(noCapacity.bottleOverCapacity, false);
});

test('picking/packing/dispatch: a real order becomes a real, shelf-ordered picking list, requires every real line ticked off before it can dispatch, and reduces real, physical stock at the exact location it was actually picked from', () => {
  createEntity({ name: 'PickTest Ledger', parent: 'My Business' }, 1);
  createEntity({ name: 'PickTest Outlet', parent: 'Locations' }, 1);
  setLocation('PickTest Outlet', { city: 'PickTest City', location_type: 'Retail', is_billing_address: false, bottle_capacity: 500, carton_capacity: 50 , timezone: 'UTC'});
  createItem('PickTest Front Wine', 'Items', 1);
  createItem('PickTest Back Wine', 'Items', 1);
  receiveStockAtLocation('My Business', 'PickTest Ledger', 'PICKTEST-REC-1', 'PickTest Front Wine', 'PickTest Outlet', 50, 1, '2027-06-01');
  receiveStockAtLocation('My Business', 'PickTest Ledger', 'PICKTEST-REC-2', 'PickTest Back Wine', 'PickTest Outlet', 50, 1, '2027-06-01');
  setItemLocationLevels('PickTest Front Wine', 'PickTest Outlet', { shelfSide: 'Front', rack: 'A', level: 1 });
  setItemLocationLevels('PickTest Back Wine', 'PickTest Outlet', { shelfSide: 'Back', rack: 'B', level: 2 });
  createEntity({ name: 'PickTest Customer', parent: 'Customers' }, 1);

  const invoiceId = createInvoice(
    {
      invoiceType: 'AR',
      business: 'My Business',
      ledger: 'PickTest Ledger',
      reference: 'PICKORDER-1',
      counterpartyName: 'PickTest Customer',
      invoiceDate: '2027-06-05',
      lines: [
        { description: 'PickTest Back Wine', quantity: 3, unitPriceMinor: 2000, amountMinor: 6000, taxMinor: 0, itemName: 'PickTest Back Wine' },
        { description: 'PickTest Front Wine', quantity: 5, unitPriceMinor: 1500, amountMinor: 7500, taxMinor: 0, itemName: 'PickTest Front Wine' },
      ],
    },
    1
  );

  const list = getPickingList(invoiceId, 'PickTest Outlet');
  // Real shelf order (Rack A before Rack B) — not the order the real invoice lines happened to be entered in (Back Wine was listed first).
  assert.equal(list[0].item, 'PickTest Front Wine', "a real picking list must sort by real shelf order (Rack A), not the invoice's own real line order");
  assert.equal(list[1].item, 'PickTest Back Wine');
  assert.equal(list.every((l) => l.picked === false), true);

  assert.throws(
    () => dispatchOrderFromPickingList(invoiceId, 'PickTest Outlet', 'Sales Revenue', 'Sales Tax Payable', 1),
    ValidationError,
    'dispatch must be genuinely refused while any real line is still unticked'
  );

  confirmPickedLine(invoiceId, list[0].invoiceLineId, 'My Business', 'PickTest Ledger', 1);
  const partial = getPickingList(invoiceId, 'PickTest Outlet');
  assert.equal(partial.find((l) => l.item === 'PickTest Front Wine')?.picked, true);
  assert.equal(partial.find((l) => l.item === 'PickTest Back Wine')?.picked, false);
  assert.throws(() => dispatchOrderFromPickingList(invoiceId, 'PickTest Outlet', 'Sales Revenue', 'Sales Tax Payable', 1), ValidationError, 'one real line still unticked must still refuse dispatch');

  confirmPickedLine(invoiceId, list[1].invoiceLineId, 'My Business', 'PickTest Ledger', 1);
  dispatchOrderFromPickingList(invoiceId, 'PickTest Outlet', 'Sales Revenue', 'Sales Tax Payable', 1);

  const invoice = getInvoice(invoiceId)!;
  assert.equal(invoice.status, 'posted', 'a real dispatch must actually post the real invoice, recognizing real revenue');
  assert.equal(getItemLocation('PickTest Front Wine', 'PickTest Outlet').quantity_on_hand, 45, 'real, physical stock must actually be reduced at the exact real location it was picked from');
  assert.equal(getItemLocation('PickTest Back Wine', 'PickTest Outlet').quantity_on_hand, 47);
});

test('restocking retail outlets from warehouses: the same real, shelf-ordered picking and refuse-until-complete pattern, but a real internal transfer, not an invoice — a real, distinct reference per real line, since a shared reference across different real products in the same run would genuinely collide', () => {
  createEntity({ name: 'RestockTest Ledger', parent: 'My Business' }, 1);
  createEntity({ name: 'RestockTest Warehouse', parent: 'Locations' }, 1);
  setLocation('RestockTest Warehouse', { city: 'RestockTest City', location_type: 'Warehouse', is_billing_address: false, bottle_capacity: 0, carton_capacity: 5000 , timezone: 'UTC'});
  createEntity({ name: 'RestockTest Outlet', parent: 'Locations' }, 1);
  setLocation('RestockTest Outlet', { city: 'RestockTest City', location_type: 'Retail', is_billing_address: true, bottle_capacity: 500, carton_capacity: 50 , timezone: 'UTC'});
  createItem('RestockTest Wine A', 'Items', 1);
  createItem('RestockTest Wine B', 'Items', 1);
  receiveStockAtLocation('My Business', 'RestockTest Ledger', 'RESTOCKTEST-REC-1', 'RestockTest Wine A', 'RestockTest Warehouse', 100, 1, '2027-07-01');
  receiveStockAtLocation('My Business', 'RestockTest Ledger', 'RESTOCKTEST-REC-2', 'RestockTest Wine B', 'RestockTest Warehouse', 100, 1, '2027-07-01');
  setItemLocationLevels('RestockTest Wine A', 'RestockTest Warehouse', { rack: 'A', level: 1 });
  setItemLocationLevels('RestockTest Wine B', 'RestockTest Warehouse', { rack: 'B', level: 2 });

  const runRef = 'RESTOCKRUN-1';
  const lines = [
    { item: 'RestockTest Wine B', quantity: 10 },
    { item: 'RestockTest Wine A', quantity: 20 },
  ];

  const list = getRestockPickingList(runRef, 'RestockTest Warehouse', lines);
  assert.equal(list[0].item, 'RestockTest Wine A', 'a real restocking picking list must also sort by real shelf order, not the order lines happened to be requested in');
  assert.equal(list[1].item, 'RestockTest Wine B');

  assert.throws(
    () => dispatchRestockFromPickingList(runRef, 'My Business', 'RestockTest Ledger', 'RestockTest Warehouse', 'RestockTest Outlet', lines, 1, '2027-07-05'),
    ValidationError,
    'a real restocking run must be refused while any real line is still unticked, the same as a customer order'
  );

  for (const l of lines) confirmRestockPickedLine(runRef, l.item, 'My Business', 'RestockTest Ledger', 1);
  dispatchRestockFromPickingList(runRef, 'My Business', 'RestockTest Ledger', 'RestockTest Warehouse', 'RestockTest Outlet', lines, 1, '2027-07-05');

  assert.equal(getItemLocation('RestockTest Wine A', 'RestockTest Warehouse').quantity_on_hand, 80, 'real stock must actually leave the real warehouse');
  assert.equal(getItemLocation('RestockTest Wine A', 'RestockTest Outlet').quantity_on_hand, 20, 'real stock must actually arrive at the real retail outlet');
  assert.equal(getItemLocation('RestockTest Wine B', 'RestockTest Outlet').quantity_on_hand, 10, 'a second, different real product in the same run must transfer correctly too — no reference collision between them');
});

test('the four real entry screens: PO -> receipt -> SO -> dispatch, using the actual staging/post functions a person would use, not just the underlying primitives', () => {
  createEntity({ name: 'Screens Test Ledger', parent: 'My Business' }, 1);
  const inventoryId = (db.prepare(`SELECT id FROM current_entities WHERE name='Inventory'`).get() as { id: number }).id;
  const stockQtyId = (db.prepare(`SELECT id FROM current_entities WHERE name='Stock Quantities'`).get() as { id: number }).id;
  createEntity({ name: 'SCWidget Batch Qty', parent: 'Stock Quantities' }, 1);
  createEntity({ name: 'SCWidget Batch Value', parent: 'Inventory' }, 1);
  const business = 'My Business';
  const ledger = 'Screens Test Ledger';

  // Screen 1: Purchase Order entry — 50 units @ $6.00
  stagePurchaseOrder({ reference: 'PO-SC01', business, ledger, vendor: 'Acme Supplies Pty Ltd', item: 'SCWidget Batch Value', quantity: 50, price_minor: 1200, transdate: '2027-08-01' });
  postPurchaseOrder('PO-SC01', business, ledger, 1);
  const poStatus = getOrderStatus('PO-SC01');
  assert.equal(poStatus.quantity, 50);
  assert.equal(poStatus.value_minor, 50 * 1200);

  // Screen 2: Stock Receipt entry — all 50 units arrive, fulfilling PO-SC01
  stageStockReceipt({
    reference: 'RCPT-SC01', business, ledger, po_reference: 'PO-SC01',
    item: 'SCWidget Batch Value', item_qty: 'SCWidget Batch Qty', vendor: 'Acme Supplies Pty Ltd',
    quantity: 50, value_minor: 50 * 1200, transdate: '2027-08-01',
  });
  postStockReceipt('RCPT-SC01', business, ledger, 1);
  assert.deepEqual(getOrderStatus('PO-SC01'), { quantity: 0, value_minor: 0 }, 'PO closed via the real receipt screen');
  const qtyAfterReceipt = (db.prepare(`SELECT balance_minor FROM account WHERE entity_id=(SELECT id FROM current_entities WHERE name='SCWidget Batch Qty')`).get() as { balance_minor: number }).balance_minor;
  assert.equal(qtyAfterReceipt, 50);
  const tbAfterReceipt = getTrialBalance(business, ledger);
  assert.equal(tbAfterReceipt.rows.find((r) => r.name === 'SCWidget Batch Value')!.debit_minor, 60000);
  assert.equal(tbAfterReceipt.rows.find((r) => r.name === 'Acme Supplies Pty Ltd')!.credit_minor, 60000);

  // Screen 3: Sales Order entry — Beta Pty Ltd orders 20 units @ $18.00 selling price
  stageSalesOrder({ reference: 'SO-SC01', business, ledger, customer: 'Beta Pty Ltd', item: 'SCWidget Batch Value', quantity: 20, price_minor: 1800, transdate: '2027-08-10' });
  postSalesOrder('SO-SC01', business, ledger, 1);
  assert.deepEqual(getOrderStatus('SO-SC01'), { quantity: 20, value_minor: 36000 });

  // Screen 4: Stock Dispatch + Invoice entry — ship 20 units, fulfilling SO-SC01
  stageStockDispatch({
    reference: 'DISP-SC01', business, ledger, so_reference: 'SO-SC01',
    item: 'SCWidget Batch Value', item_qty: 'SCWidget Batch Qty', customer: 'Beta Pty Ltd',
    quantity: 20, unit_cost_minor: 1200, sale_price_minor: 1800, transdate: '2027-08-10',
  });
  postStockDispatch('DISP-SC01', business, ledger, 1);

  assert.deepEqual(getOrderStatus('SO-SC01'), { quantity: 0, value_minor: 0 }, 'SO closed via the real dispatch screen');
  const tbFinal = getTrialBalance(business, ledger);
  assert.equal(tbFinal.rows.find((r) => r.name === 'Beta Pty Ltd')!.debit_minor, 36000, '20 units at the 18.00 SELLING price');
  assert.equal(tbFinal.rows.find((r) => r.name === 'Sales Revenue')!.credit_minor, 36000);
  assert.equal(tbFinal.rows.find((r) => r.name === 'Cost of Goods Sold')!.debit_minor, 24000, '20 units at the 12.00 COST price, not the selling price');
  const qtyAfterDispatch = (db.prepare(`SELECT balance_minor FROM account WHERE entity_id=(SELECT id FROM current_entities WHERE name='SCWidget Batch Qty')`).get() as { balance_minor: number }).balance_minor;
  assert.equal(qtyAfterDispatch, 30, '50 received minus 20 dispatched');
  assert.equal(tbFinal.rows.find((r) => r.name === 'SCWidget Batch Value')!.debit_minor, 36000, '60000 received minus 24000 cost of what shipped = 36000 remaining, at the same 1200/unit cost');
});

test('posting a screen with nothing staged is rejected clearly, not silently a no-op', () => {
  assert.throws(() => postPurchaseOrder('NEVER-STAGED-PO', 'My Business', 'Actual', 1), NotFoundError);
  assert.throws(() => postStockReceipt('NEVER-STAGED-RCPT', 'My Business', 'Actual', 1), NotFoundError);
  assert.throws(() => postSalesOrder('NEVER-STAGED-SO', 'My Business', 'Actual', 1), NotFoundError);
  assert.throws(() => postStockDispatch('NEVER-STAGED-DISP', 'My Business', 'Actual', 1), NotFoundError);
});

test('entities are append-only: renaming closes out the old row and appends a replacement under the same id, full history preserved', () => {
  db.prepare(`INSERT INTO users (username, password_hash) VALUES ('renamer1', 'x:y')`).run();
  const user2 = (db.prepare(`SELECT id FROM users WHERE username='renamer1'`).get() as { id: number }).id;

  const created = createEntity({ name: 'Epsilon Test Co', parent: 'Accounts Receivable' }, 1);
  updateEntity(created.id, { name: 'Epsilon Test Corporation' }, user2);

  const current = getEntity(created.id)!;
  assert.equal(current.name, 'Epsilon Test Corporation', 'the live version reflects the rename');

  const history = getEntityHistory(created.id);
  assert.equal(history.length, 2, 'both the original and the renamed version must exist in history');
  assert.equal(history[0].name, 'Epsilon Test Co');
  assert.equal(history[0].created_by, 1);
  assert.equal(history[0].deleted_by, user2, 'the SECOND user closed out the first version, by renaming it');
  assert.ok(history[0].deleted_at, 'the closed-out row must have a deletion timestamp');
  assert.equal(history[1].name, 'Epsilon Test Corporation');
  assert.equal(history[1].created_by, user2);
  assert.equal(history[1].deleted_at, null, 'the current version has no deletion timestamp');
});

test('a renamed-away-from name can be reused immediately for an unrelated new entity', () => {
  const original = createEntity({ name: 'Zeta Test Co', parent: 'Accounts Receivable' }, 1);
  updateEntity(original.id, { name: 'Zeta Test Corporation' }, 1);

  const reused = createEntity({ name: 'Zeta Test Co', parent: 'Accounts Payable' }, 1);
  assert.notEqual(reused.id, original.id, 'this must be a genuinely different logical entity, not the same one resurrected');
  assert.equal(getEntity(original.id)!.name, 'Zeta Test Corporation', 'the original entity keeps its new name, unaffected');
});

test('renaming a parent never orphans its children — a childs parent_id keeps resolving correctly with zero other changes', () => {
  const parent = createEntity({ name: 'Eta Parent Co', parent: 'Accounts Receivable' }, 1);
  const child = createEntity({ name: 'Eta Child Contact', parent: 'Eta Parent Co' }, 1);

  updateEntity(parent.id, { name: 'Eta Parent Corporation' }, 1);

  const childAfter = getEntity(child.id)!;
  assert.equal(childAfter.parent_id, parent.id, "the child's parent_id is unchanged — same stable id, new name resolved automatically");
  const tree = getEntityTree();
  const parentNode = tree.find((e) => e.id === parent.id)!;
  assert.equal(parentNode.name, 'Eta Parent Corporation');
});

test('deleteEntity closes out the entity permanently, with who and when recorded — it never reappears, even in history queries as "current"', () => {
  const e = createEntity({ name: 'Theta Test Co', parent: 'Accounts Receivable' }, 1);
  deleteEntity(e.id, 1);
  assert.equal(getEntity(e.id), undefined);
  const history = getEntityHistory(e.id);
  assert.equal(history.length, 1, 'a straight delete with no prior rename is just one closed-out row');
  assert.ok(history[0].deleted_at);
  assert.equal(history[0].deleted_by, 1);
});

test('journal postings record who posted them — the other half of the audit trail, alongside entities own append-only history', () => {
  db.prepare(`INSERT INTO users (username, password_hash) VALUES ('poster1', 'x:y')`).run();
  const user2 = (db.prepare(`SELECT id FROM users WHERE username='poster1'`).get() as { id: number }).id;

  stageLine({ reference: 'AUDIT-TEST-1', business: 'My Business', ledger: 'Actual', transdate: '2027-10-01', account: 'Cash and Bank', amount_minor: 1000 });
  stageLine({ reference: 'AUDIT-TEST-1', business: 'My Business', ledger: 'Actual', transdate: '2027-10-01', account: 'Sales Revenue', amount_minor: -1000 });
  postJournalEntry('AUDIT-TEST-1', 'My Business', 'Actual', user2);

  const entries = listJournalEntries('My Business', 'Actual', 200);
  const posted = entries.find((e) => e.reference === 'AUDIT-TEST-1')!;
  assert.equal(posted.posted_by, 'poster1', 'listJournalEntries should show the actual username, not just a raw id');

  const detail = getJournalEntry('My Business', 'Actual', posted.journal_id, posted.occurrence_date!)!;
  assert.equal(detail.posted_by, 'poster1', 'the detail view must show it too');
});

test('a recurring journal records who created it — every occurrence it generates shows the same poster', () => {
  db.prepare(`INSERT INTO users (username, password_hash) VALUES ('poster2', 'x:y')`).run();
  const user3 = (db.prepare(`SELECT id FROM users WHERE username='poster2'`).get() as { id: number }).id;

  createRecurringJournal('My Business', 'Actual', 'AUDIT-REC-1', '2027-11-01', 'monthly', [
    { account: 'Rent', amount_minor: 20000 },
    { account: 'Cash and Bank', amount_minor: -20000 },
  ], user3, 'Test recurring', 3);

  const entries = listJournalEntries('My Business', 'Actual', 200).filter((e) => e.reference === 'AUDIT-REC-1');
  assert.equal(entries.length, 3);
  assert.ok(entries.every((e) => e.posted_by === 'poster2'), 'every generated occurrence should show the same creator');
});

test('AR Sale with tax: customer owes amount+tax, tax posts to Sales Tax Payable, everything balances', () => {
  createEntity({ name: 'Tax Test Ledger AR', parent: 'My Business' }, 1);
  stageArSale({ reference: 'TAX-AR-1', business: 'My Business', ledger: 'Tax Test Ledger AR', customer: 'Acme Corp', amount_minor: 100000, tax_minor: 10000, transdate: '2027-12-01' });
  postArSale('TAX-AR-1', 'My Business', 'Tax Test Ledger AR', 1);

  const tb = getTrialBalance('My Business', 'Tax Test Ledger AR');
  assert.equal(tb.rows.find((r) => r.name === 'Acme Corp')!.debit_minor, 110000, 'customer owes base + tax');
  assert.equal(tb.rows.find((r) => r.name === 'Sales Revenue')!.credit_minor, 100000, 'revenue is the base amount only, not inflated by tax');
  assert.equal(tb.rows.find((r) => r.name === 'Sales Tax Payable')!.credit_minor, 10000);
  assert.equal(tb.total_debit_minor, tb.total_credit_minor);
});

test('AP Purchase with tax: Purchases Tax Claimed is debited, vendor is owed amount+tax, everything balances', () => {
  createEntity({ name: 'Tax Test Ledger AP', parent: 'My Business' }, 1);
  stageApPurchase({ reference: 'TAX-AP-1', business: 'My Business', ledger: 'Tax Test Ledger AP', vendor: 'Acme Supplies Pty Ltd', expense_account: 'Office', amount_minor: 50000, tax_minor: 5000, transdate: '2027-12-01' });
  postApPurchase('TAX-AP-1', 'My Business', 'Tax Test Ledger AP', 1);

  const tb = getTrialBalance('My Business', 'Tax Test Ledger AP');
  assert.equal(tb.rows.find((r) => r.name === 'Office')!.debit_minor, 50000);
  assert.equal(tb.rows.find((r) => r.name === 'Purchases Tax Claimed')!.debit_minor, 5000);
  assert.equal(tb.rows.find((r) => r.name === 'Acme Supplies Pty Ltd')!.credit_minor, 55000, 'vendor is owed base + tax');
  assert.equal(tb.total_debit_minor, tb.total_credit_minor);
});

test('a service dispatch (no item, no item_qty, no unit_cost) skips COGS and quantity movement entirely — matches the exact worked example: 10 hours @ 150.00 with 10% tax', () => {
  createEntity({ name: 'Service Test Ledger', parent: 'My Business' }, 1);
  const business = 'My Business';
  const ledger = 'Service Test Ledger';

  placeOrder('SO-SVC01', business, ledger, 10, 10 * 15000, 1, '2027-12-05');
  stageStockDispatch({
    reference: 'DISP-SVC01', business, ledger, so_reference: 'SO-SVC01',
    customer: 'Beta Pty Ltd', quantity: 10, sale_price_minor: 15000, tax_minor: 15000, transdate: '2027-12-05',
  });
  postStockDispatch('DISP-SVC01', business, ledger, 1);

  const tb = getTrialBalance(business, ledger);
  assert.equal(tb.rows.find((r) => r.name === 'Beta Pty Ltd')!.debit_minor, 165000, 'matches the worked example exactly: 1500.00 + 150.00 tax');
  assert.equal(tb.rows.find((r) => r.name === 'Sales Revenue')!.credit_minor, 150000);
  assert.equal(tb.rows.find((r) => r.name === 'Sales Tax Payable')!.credit_minor, 15000);
  assert.equal(tb.rows.find((r) => r.name === 'Cost of Goods Sold'), undefined, 'a service must never generate a COGS line — there is no batch to draw from');
  assert.equal(tb.total_debit_minor, tb.total_credit_minor);
  assert.deepEqual(getOrderStatus('SO-SVC01'), { quantity: 0, value_minor: 0 }, 'the sales order still closes correctly, purely on value, with no quantity/stock tracking involved');
});

test('a service receipt (no item_qty) skips the quantity movement, still posts the monetary and tax legs correctly', () => {
  createEntity({ name: 'Service Receipt Ledger', parent: 'My Business' }, 1);
  const business = 'My Business';
  const ledger = 'Service Receipt Ledger';

  placeOrder('PO-SVC01', business, ledger, 5, 5 * 20000, 1, '2027-12-10');
  stageStockReceipt({
    reference: 'RCPT-SVC01', business, ledger, po_reference: 'PO-SVC01',
    item: 'Office', vendor: 'Acme Supplies Pty Ltd', quantity: 5, value_minor: 100000, tax_minor: 10000, transdate: '2027-12-10',
  });
  postStockReceipt('RCPT-SVC01', business, ledger, 1);

  const tb = getTrialBalance(business, ledger);
  assert.equal(tb.rows.find((r) => r.name === 'Office')!.debit_minor, 100000);
  assert.equal(tb.rows.find((r) => r.name === 'Purchases Tax Claimed')!.debit_minor, 10000);
  assert.equal(tb.rows.find((r) => r.name === 'Acme Supplies Pty Ltd')!.credit_minor, 110000);
  assert.equal(tb.total_debit_minor, tb.total_credit_minor);
  assert.deepEqual(getOrderStatus('PO-SVC01'), { quantity: 0, value_minor: 0 });
});

test('invoice_line records genuinely per-line tax, never assumed uniform — one line exempt, another at a different rate entirely', () => {
  createEntity({ name: 'Invoice Line Test Ledger', parent: 'My Business' }, 1);
  const business = 'My Business';
  const ledger = 'Invoice Line Test Ledger';
  createEntity({ name: 'ILWidget Batch Qty', parent: 'Stock Quantities' }, 1);
  createEntity({ name: 'ILWidget Batch Value', parent: 'Inventory' }, 1);
  createEntity({ name: 'ILGadget Batch Qty', parent: 'Stock Quantities' }, 1);
  createEntity({ name: 'ILGadget Batch Value', parent: 'Inventory' }, 1);
  postQuantityMovement(business, ledger, 'IL-STOCK-IN-1', 'ILWidget Batch Qty', 100, 1, '2027-05-01');
  postQuantityMovement(business, ledger, 'IL-STOCK-IN-2', 'ILGadget Batch Qty', 50, 1, '2027-05-01');

  placeOrder('SO-IL01', business, ledger, 25, 20 * 1800 + 5 * 4500, 1, '2027-05-01');
  stageStockDispatch({
    reference: 'IL-INV-L1', business, ledger, so_reference: 'SO-IL01', item: 'ILWidget Batch Value', item_qty: 'ILWidget Batch Qty',
    customer: 'Acme Corp', quantity: 20, unit_cost_minor: 1200, sale_price_minor: 1800, tax_minor: 0, transdate: '2027-05-01', description: 'Widgets exempt',
  });
  postStockDispatch('IL-INV-L1', business, ledger, 1);
  stageStockDispatch({
    reference: 'IL-INV-L2', business, ledger, so_reference: 'SO-IL01', item: 'ILGadget Batch Value', item_qty: 'ILGadget Batch Qty',
    customer: 'Acme Corp', quantity: 5, unit_cost_minor: 3000, sale_price_minor: 4500, tax_minor: Math.round(5 * 4500 * 0.15), transdate: '2027-05-01', description: 'Gadgets 15%',
  });
  postStockDispatch('IL-INV-L2', business, ledger, 1);

  const l1 = getInvoiceLine('IL-INV-L1', business, ledger)!;
  const l2 = getInvoiceLine('IL-INV-L2', business, ledger)!;
  assert.equal(l1.tax_minor, 0, 'the exempt line must show zero tax, not a blindly-applied rate');
  assert.equal(l1.amount_minor, 36000);
  assert.equal(l2.tax_minor, 3375, '15% of 225.00, not 15% of the whole invoice');
  assert.equal(l2.amount_minor, 22500);

  // Prove a naive "apply one rate to the subtotal" approach would have
  // been wrong: 15% of the combined 585.00 subtotal is 87.75, nowhere
  // close to the correct combined tax of 33.75.
  const naiveWrongTotal = Math.round((l1.amount_minor + l2.amount_minor) * 0.15);
  const actualCorrectTotal = l1.tax_minor + l2.tax_minor;
  assert.notEqual(naiveWrongTotal, actualCorrectTotal);
  assert.equal(actualCorrectTotal, 3375);
});

test('AR Sale and AP Purchase also record an invoice_line, with no quantity/unit price concept at all (both null)', () => {
  createEntity({ name: 'Invoice Line Flat Ledger', parent: 'My Business' }, 1);
  const business = 'My Business';
  const ledger = 'Invoice Line Flat Ledger';
  stageArSale({ reference: 'IL-FLAT-AR', business, ledger, customer: 'Acme Corp', amount_minor: 10000, tax_minor: 1000, transdate: '2027-05-01', description: 'Flat sale' });
  postArSale('IL-FLAT-AR', business, ledger, 1);
  const line = getInvoiceLine('IL-FLAT-AR', business, ledger)!;
  assert.equal(line.quantity, null);
  assert.equal(line.unit_price_minor, null);
  assert.equal(line.amount_minor, 10000);
  assert.equal(line.tax_minor, 1000);
});

test('an ordinary General Journal posting records no invoice_line at all — it has no invoice concept', () => {
  createEntity({ name: 'No Invoice Line Ledger', parent: 'My Business' }, 1);
  const business = 'My Business';
  const ledger = 'No Invoice Line Ledger';
  stageLine({ reference: 'GJ-NO-INV', business, ledger, transdate: '2027-05-01', account: 'Cash and Bank', amount_minor: 500 });
  stageLine({ reference: 'GJ-NO-INV', business, ledger, transdate: '2027-05-01', account: 'Sales Revenue', amount_minor: -500 });
  postJournalEntry('GJ-NO-INV', business, ledger, 1);
  assert.equal(getInvoiceLine('GJ-NO-INV', business, ledger), undefined);
});

test('closing a period rejects normal posting into it, and reopening lifts that immediately for a correction', () => {
  createEntity({ name: 'Period Test Ledger', parent: 'My Business' }, 1);
  const business = 'My Business';
  const ledger = 'Period Test Ledger';

  assert.deepEqual(getPeriodLockStatus(business, ledger), { locked_through_date: null, changed_by: null, changed_at: null });

  stageLine({ reference: 'PRE-CLOSE', business, ledger, transdate: '2027-01-15', account: 'Cash and Bank', amount_minor: 100 });
  stageLine({ reference: 'PRE-CLOSE', business, ledger, transdate: '2027-01-15', account: 'Sales Revenue', amount_minor: -100 });
  postJournalEntry('PRE-CLOSE', business, ledger, 1); // normal posting works before any lock

  closePeriod(business, ledger, '2027-01-31', 1);
  const status = getPeriodLockStatus(business, ledger);
  assert.equal(status.locked_through_date, '2027-01-31');
  assert.equal(status.changed_by, 1);

  stageLine({ reference: 'INTO-CLOSED', business, ledger, transdate: '2027-01-20', account: 'Cash and Bank', amount_minor: 100 });
  stageLine({ reference: 'INTO-CLOSED', business, ledger, transdate: '2027-01-20', account: 'Sales Revenue', amount_minor: -100 });
  assert.throws(() => postJournalEntry('INTO-CLOSED', business, ledger, 1), /closed/);

  stageLine({ reference: 'AFTER-CLOSE', business, ledger, transdate: '2027-02-05', account: 'Cash and Bank', amount_minor: 100 });
  stageLine({ reference: 'AFTER-CLOSE', business, ledger, transdate: '2027-02-05', account: 'Sales Revenue', amount_minor: -100 });
  postJournalEntry('AFTER-CLOSE', business, ledger, 1); // dates after the lock still work fine

  reopenPeriod(business, ledger, 1);
  assert.equal(getPeriodLockStatus(business, ledger).locked_through_date, null);

  // The SAME staged entry that was rejected before now posts correctly —
  // exactly the amendment (correction) scenario reopening exists for.
  postJournalEntry('INTO-CLOSED', business, ledger, 1);
  assert.equal(getTrialBalance(business, ledger).rows.find((r) => r.name === 'Cash and Bank')!.debit_minor, 300);
});

test('quantity movements and recurring journal start dates are also protected by a closed period, not just ordinary posting', () => {
  createEntity({ name: 'Period Test Ledger 2', parent: 'My Business' }, 1);
  const business = 'My Business';
  const ledger = 'Period Test Ledger 2';
  createEntity({ name: 'PeriodTest Batch Qty', parent: 'Stock Quantities' }, 1);

  closePeriod(business, ledger, '2027-03-31', 1);

  assert.throws(() => postQuantityMovement(business, ledger, 'QTY-INTO-CLOSED', 'PeriodTest Batch Qty', 10, 1, '2027-03-15'), PostingError);
  assert.throws(
    () =>
      createRecurringJournal(
        business, ledger, 'REC-INTO-CLOSED', '2027-03-15', 'monthly',
        [{ account: 'Rent', amount_minor: 50000 }, { account: 'Cash and Bank', amount_minor: -50000 }],
        1
      ),
    PostingError
  );

  // Both work fine once dated after the lock.
  postQuantityMovement(business, ledger, 'QTY-AFTER-CLOSE', 'PeriodTest Batch Qty', 10, 1, '2027-04-15');
});

test('Trial Balance and Balance Sheet asOfDate correctly excludes postings after the cutoff, without needing a period to be closed at all', () => {
  createEntity({ name: 'AsOf Test Ledger', parent: 'My Business' }, 1);
  const business = 'My Business';
  const ledger = 'AsOf Test Ledger';

  stageLine({ reference: 'ASOF-JAN', business, ledger, transdate: '2027-01-15', account: 'Cash and Bank', amount_minor: 500 });
  stageLine({ reference: 'ASOF-JAN', business, ledger, transdate: '2027-01-15', account: 'Sales Revenue', amount_minor: -500 });
  postJournalEntry('ASOF-JAN', business, ledger, 1);

  stageLine({ reference: 'ASOF-MAR', business, ledger, transdate: '2027-03-15', account: 'Cash and Bank', amount_minor: 300 });
  stageLine({ reference: 'ASOF-MAR', business, ledger, transdate: '2027-03-15', account: 'Sales Revenue', amount_minor: -300 });
  postJournalEntry('ASOF-MAR', business, ledger, 1);

  const asOfFeb = getTrialBalance(business, ledger, '2027-02-01');
  assert.equal(asOfFeb.rows.find((r) => r.name === 'Cash and Bank')!.debit_minor, 500, 'only the January posting should count as of February');

  const asOfApril = getTrialBalance(business, ledger, '2027-04-01');
  assert.equal(asOfApril.rows.find((r) => r.name === 'Cash and Bank')!.debit_minor, 800, 'both postings should count once the cutoff is after both');

  const allTime = getTrialBalance(business, ledger);
  assert.equal(allTime.rows.find((r) => r.name === 'Cash and Bank')!.debit_minor, 800, 'omitting asOfDate must still mean all-time, unchanged from before this feature existed');

  const bsAsOfFeb = getBalanceSheet(business, ledger, '2027-02-01');
  assert.equal(bsAsOfFeb.assets.find((r) => r.name === 'Cash and Bank')?.debit_minor, 500);
});

test('Profit and Loss fromDate/toDate is a genuine range, not just a single cutoff — excludes postings both before AND after the window', () => {
  createEntity({ name: 'PL Range Test Ledger', parent: 'My Business' }, 1);
  const business = 'My Business';
  const ledger = 'PL Range Test Ledger';

  stageLine({ reference: 'PLR-JAN', business, ledger, transdate: '2027-01-15', account: 'Cash and Bank', amount_minor: 1000 });
  stageLine({ reference: 'PLR-JAN', business, ledger, transdate: '2027-01-15', account: 'Sales Revenue', amount_minor: -1000 });
  postJournalEntry('PLR-JAN', business, ledger, 1);

  stageLine({ reference: 'PLR-FEB', business, ledger, transdate: '2027-02-15', account: 'Cash and Bank', amount_minor: 2000 });
  stageLine({ reference: 'PLR-FEB', business, ledger, transdate: '2027-02-15', account: 'Sales Revenue', amount_minor: -2000 });
  postJournalEntry('PLR-FEB', business, ledger, 1);

  stageLine({ reference: 'PLR-MAR', business, ledger, transdate: '2027-03-15', account: 'Cash and Bank', amount_minor: 4000 });
  stageLine({ reference: 'PLR-MAR', business, ledger, transdate: '2027-03-15', account: 'Sales Revenue', amount_minor: -4000 });
  postJournalEntry('PLR-MAR', business, ledger, 1);

  // February only — must exclude both January (before) and March (after).
  const febOnly = getProfitAndLoss(business, ledger, '2027-02-01', '2027-02-28');
  assert.equal(febOnly.total_income_minor, 2000, 'only February should count, not January or March');

  const allThreeMonths = getProfitAndLoss(business, ledger, '2027-01-01', '2027-03-31');
  assert.equal(allThreeMonths.total_income_minor, 7000, '1000 + 2000 + 4000');

  const allTime = getProfitAndLoss(business, ledger);
  assert.equal(allTime.total_income_minor, 7000, 'omitting the range must still mean all-time');
});

test('reversing the same occurrence twice is rejected clearly — the real bug this prevents silently corrupted journal_line by attaching a second reversals lines to the first one, since the reversal reference is deterministic', () => {
  createEntity({ name: 'Double Reversal Test Ledger', parent: 'My Business' }, 1);
  const business = 'My Business';
  const ledger = 'Double Reversal Test Ledger';

  createRecurringJournal(
    business, ledger, 'REC-DOUBLE-REV', '2027-01-01', 'monthly',
    [{ account: 'Rent', amount_minor: 80000 }, { account: 'Cash and Bank', amount_minor: -80000 }],
    1, 'Monthly rent', 3
  );
  const entries = listJournalEntries('My Business', 'Double Reversal Test Ledger', 200).filter((e) => e.reference === 'REC-DOUBLE-REV');
  const feb = entries.find((e) => e.occurrence_date === '2027-02-01')!;

  reverseJournalEntry('My Business', 'Double Reversal Test Ledger', feb.journal_id, feb.occurrence_date, 1, '2027-02-15');
  assert.throws(
    () => reverseJournalEntry('My Business', 'Double Reversal Test Ledger', feb.journal_id, feb.occurrence_date, 1, '2027-02-20'),
    PostingError,
    'reversing the exact same occurrence again must be rejected clearly, not silently corrupt data'
  );

  // Confirm journal_line integrity directly — exactly two lines under
  // the ONE reversal journal, not four lines merged together the way
  // the original bug produced.
  const reversalJournalId = (
    db.prepare(`SELECT id FROM journal WHERE reference = ?`).get(`REC-DOUBLE-REV-REV-2027-02-01`) as { id: number }
  ).id;
  const reversalLines = db.prepare(`SELECT * FROM journal_line WHERE journal_id = ?`).all(reversalJournalId);
  assert.equal(reversalLines.length, 2, 'exactly two lines, not four merged from a corrupted second attempt');

  // The rest of the schedule is still correct: Jan + Mar only.
  const pl = getProfitAndLoss(business, ledger);
  assert.equal(pl.expenses.find((e) => e.name === 'Rent')?.debit_minor, 160000);
});

test('Balance Sheet and P&L split each line into debit/credit columns per accounting convention, and flag a line whose balance sits opposite its normal side', () => {
  createEntity({ name: 'Contra Test Ledger', parent: 'My Business' }, 1);
  const business = 'My Business';
  const ledger = 'Contra Test Ledger';

  // A normal asset balance: Cash debited 1000 — debit_minor set, not contra.
  stageLine({ reference: 'CONTRA-1', business, ledger, transdate: '2027-01-01', account: 'Cash and Bank', amount_minor: 1000 });
  stageLine({ reference: 'CONTRA-1', business, ledger, transdate: '2027-01-01', account: 'Sales Revenue', amount_minor: -1000 });
  postJournalEntry('CONTRA-1', business, ledger, 1);

  const bsNormal = getBalanceSheet(business, ledger);
  const cash = bsNormal.assets.find((a) => a.name === 'Cash and Bank')!;
  assert.equal(cash.debit_minor, 1000);
  assert.equal(cash.credit_minor, 0);
  assert.equal(cash.is_contra, false, 'a normal debit balance on an asset is not contra');

  // Now push Cash into a genuine credit (overdrawn) position — abnormal
  // for an asset, must be flagged.
  stageLine({ reference: 'CONTRA-2', business, ledger, transdate: '2027-01-02', account: 'Cash and Bank', amount_minor: -5000 });
  stageLine({ reference: 'CONTRA-2', business, ledger, transdate: '2027-01-02', account: 'Rent', amount_minor: 5000 });
  postJournalEntry('CONTRA-2', business, ledger, 1);

  const bsContra = getBalanceSheet(business, ledger);
  const cashOverdrawn = bsContra.assets.find((a) => a.name === 'Cash and Bank')!;
  assert.equal(cashOverdrawn.debit_minor, 0);
  assert.equal(cashOverdrawn.credit_minor, 4000, 'net credit of 4000 after the second entry');
  assert.equal(cashOverdrawn.is_contra, true, 'an asset sitting in credit is abnormal and must be flagged');

  // Sales Revenue is credit-normal — check it does NOT get flagged just
  // for being a normal credit balance.
  const revenue = getProfitAndLoss(business, ledger).income.find((i) => i.name === 'Sales Revenue');
  assert.equal(revenue?.credit_minor, 1000, 'unaffected by the second entry, which used Rent instead');
  assert.equal(revenue?.is_contra, false, 'a normal credit balance on income is not contra');
});

test('getProfitAndLossComparison correctly reconstructs each lines actual amount from debit_minor/credit_minor, not a stale removed field', () => {
  createEntity({ name: 'PLC Fix Test A', parent: 'My Business' }, 1);
  createEntity({ name: 'PLC Fix Test B', parent: 'My Business' }, 1);
  stageLine({ reference: 'PLCFIX-A', business: 'My Business', ledger: 'PLC Fix Test A', transdate: '2027-01-01', account: 'Cash and Bank', amount_minor: 2500 });
  stageLine({ reference: 'PLCFIX-A', business: 'My Business', ledger: 'PLC Fix Test A', transdate: '2027-01-01', account: 'Sales Revenue', amount_minor: -2500 });
  postJournalEntry('PLCFIX-A', 'My Business', 'PLC Fix Test A', 1);

  const cmp = getProfitAndLossComparison('My Business', 'PLC Fix Test A', 'PLC Fix Test B');
  const revenueLine = cmp.income.find((l) => l.name === 'Sales Revenue');
  assert.equal(revenueLine?.a_minor, 2500, 'must reflect the real posted amount, not silently fall back to 0');
  assert.ok(!revenueLine?.b_minor, 'must be zero (0 or -0, numerically identical) for a ledger with no activity');
});

test('payment_terms_days persists per customer/vendor, since account management practice genuinely varies (30/60/90 for one, 7/14/21 for another, cash only for a third)', () => {
  setContact('Acme Corp', { phone: '555-0100', payment_terms_days: 30 });
  setContact('Beta Pty Ltd', { phone: '555-0200', payment_terms_days: 7 });
  setContact('Acme Supplies Pty Ltd', { phone: '555-0300', payment_terms_days: 0 });

  assert.equal(getContact('Acme Corp')?.payment_terms_days, 30);
  assert.equal(getContact('Beta Pty Ltd')?.payment_terms_days, 7);
  assert.equal(getContact('Acme Supplies Pty Ltd')?.payment_terms_days, 0, 'explicitly cash only, not null/unconfigured');
});

test('getAgingBuckets derives 1x/2x/3x buckets from a single term, matching real variation across customers', () => {
  assert.deepEqual(getAgingBuckets(30), [
    { label: '1-30', through_days: 30 },
    { label: '31-60', through_days: 60 },
    { label: '61-90', through_days: 90 },
  ]);
  assert.deepEqual(getAgingBuckets(7), [
    { label: '1-7', through_days: 7 },
    { label: '8-14', through_days: 14 },
    { label: '15-21', through_days: 21 },
  ]);
  assert.deepEqual(getAgingBuckets(14), [
    { label: '1-14', through_days: 14 },
    { label: '15-28', through_days: 28 },
    { label: '29-42', through_days: 42 },
  ]);
  assert.deepEqual(getAgingBuckets(0), [{ label: 'Due immediately', through_days: 0 }], 'cash only still ages — overdue immediately, not exempt');
  assert.deepEqual(getAgingBuckets(null), getAgingBuckets(30), 'unconfigured falls back to a conventional 30/60/90');
});

test('getCreditStatus: a real customer/vendor\'s own real balance checked against their own real, configured credit limit', () => {
  createEntity({ name: 'CreditStatusTest Vendor', parent: 'Vendors' }, 1);
  setContact('CreditStatusTest Vendor', { payment_terms_days: 0, credit_limit_minor: 500000 });

  const before = getCreditStatus('CreditStatusTest Vendor');
  assert.equal(before.balanceMinor, 0);
  assert.equal(before.limitMinor, 500000);
  assert.equal(before.overLimit, false);
  assert.equal(before.remainingMinor, 500000);

  createEntity({ name: 'CreditStatusTest Ledger', parent: 'My Business' }, 1);
  stageLine({ reference: 'CST-1', business: 'My Business', ledger: 'CreditStatusTest Ledger', account: 'Inventory', amount_minor: 600000 });
  stageLine({ reference: 'CST-1', business: 'My Business', ledger: 'CreditStatusTest Ledger', account: 'CreditStatusTest Vendor', amount_minor: -600000 });
  postJournalEntry('CST-1', 'My Business', 'CreditStatusTest Ledger', 1);

  const after = getCreditStatus('CreditStatusTest Vendor');
  assert.equal(after.balanceMinor, 600000, 'a real, current outstanding balance, reported as a real positive amount regardless of the account\'s own natural debit/credit sign');
  assert.equal(after.overLimit, true, 'a real $6,000 balance against a real $5,000 limit must correctly show as over limit');
  assert.equal(after.remainingMinor, -100000, 'a real, negative remaining amount once genuinely over');

  // A real entity with no configured limit at all — never silently treated as "over" just because it has no limit.
  createEntity({ name: 'CreditStatusTest No Limit', parent: 'Vendors' }, 1);
  const noLimit = getCreditStatus('CreditStatusTest No Limit');
  assert.equal(noLimit.limitMinor, null);
  assert.equal(noLimit.overLimit, false);
  assert.equal(noLimit.remainingMinor, null);
});

test('a item can be sourced from multiple manufacturer/vendor combinations, and preference is never derived from price', () => {
  createEntity({ name: 'PT-M6x20 Hex Bolt', parent: 'Items' }, 1);
  setItem('PT-M6x20 Hex Bolt', { description: 'Zinc-plated steel hex bolt', unit_of_measure: 'each', upc: '012345678905' });
  createEntity({ name: 'PT-Acme Fasteners', parent: 'Manufacturers' }, 1);
  createEntity({ name: 'PT-Beta Fasteners', parent: 'Manufacturers' }, 1);
  createEntity({ name: 'PT-Local Hardware', parent: 'Accounts Payable' }, 1);
  createEntity({ name: 'PT-Bulk Wholesale', parent: 'Accounts Payable' }, 1);

  addOrUpdateItemSource({
    itemName: 'PT-M6x20 Hex Bolt', manufacturerName: 'PT-Acme Fasteners', vendorName: 'PT-Local Hardware',
    vendorSku: 'LHS-4471', priceMinor: 12, packageQuantity: 100, isPreferred: true,
    preferenceNotes: 'Keeps more in local stock',
  });
  addOrUpdateItemSource({
    itemName: 'PT-M6x20 Hex Bolt', manufacturerName: 'PT-Beta Fasteners', vendorName: 'PT-Bulk Wholesale',
    vendorSku: 'BFW-9982', priceMinor: 9, packageQuantity: 500, isPreferred: false,
    preferenceNotes: 'Cheaper but minimum order is a full pallet',
  });

  const sources = listItemSources('PT-M6x20 Hex Bolt');
  assert.equal(sources.length, 2, 'the same item genuinely has two independent sources');

  const cheaper = sources.find((s) => s.price_minor === 9)!;
  const preferred = sources.find((s) => s.is_preferred)!;
  assert.notEqual(cheaper.vendor_name, preferred.vendor_name, 'the cheaper source is explicitly NOT the preferred one — preference is a real choice, not derived from price');
  assert.equal(preferred.price_minor, 12, 'the preferred source costs more, and that is fine — local stock and reliability were the actual reasons');

  const items = listItems();
  const thisItem = items.find((p) => p.name === 'PT-M6x20 Hex Bolt')!;
  assert.equal(thisItem.source_count, 2);

  // Re-adding the same manufacturer/vendor combination updates in place,
  // not a duplicate — same upsert convention as account_entry/contact_entry.
  addOrUpdateItemSource({
    itemName: 'PT-M6x20 Hex Bolt', manufacturerName: 'PT-Acme Fasteners', vendorName: 'PT-Local Hardware',
    priceMinor: 13, isPreferred: true, preferenceNotes: 'Price went up slightly, still preferred',
  });
  const afterUpdate = listItemSources('PT-M6x20 Hex Bolt');
  assert.equal(afterUpdate.length, 2, 'still two sources, not three — the second addOrUpdateItemSource call updated the existing row');
  assert.equal(afterUpdate.find((s) => s.vendor_name === 'PT-Local Hardware')?.price_minor, 13);
});

test('the system default display language lives on Application, reachable before any session exists, and setting it preserves append-only history', () => {
  assert.equal(getDefaultLanguage(), null, 'no default configured yet');

  setDefaultLanguage('German', 1);
  assert.equal(getDefaultLanguage(), 'German');

  const app = getEntity((db.prepare(`SELECT id FROM current_entities WHERE name = 'Application'`).get() as { id: number }).id)!;
  const history = getEntityHistory(app.id);
  assert.equal(history.length, 2, 'the update used entity_update (close + append), not a raw overwrite');

  assert.throws(() => setDefaultLanguage('Not A Real Language', 1), ValidationError);
});

test('Developer role, Employees/Manufacturers/Items branches, and item/item_source tables all exist exactly once — the migration that restores these on an existing database is idempotent', () => {
  const developerRoleCount = (db.prepare(`SELECT COUNT(*) AS c FROM roles WHERE name = 'Developer'`).get() as { c: number }).c;
  assert.equal(developerRoleCount, 1);

  for (const name of ['Employees', 'Manufacturers', 'Items']) {
    const matches = db.prepare(`SELECT COUNT(*) AS c FROM current_entities WHERE name = ?`).get(name) as { c: number };
    assert.equal(matches.c, 1, `${name} must exist exactly once`);
  }

  const itemSourceTable = db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='item_source'`).get();
  assert.ok(itemSourceTable, 'item_source table must exist');
});

test('divisions/profit centers: the same account can be posted to by multiple divisions, and reports can filter to just one', () => {
  createEntity({ name: 'DivTest Manufacturing', parent: 'Divisions' }, 1);
  createEntity({ name: 'DivTest Services', parent: 'Divisions' }, 1);
  createEntity({ name: 'DivTest Ledger', parent: 'My Business' }, 1);

  stageLine({ reference: 'DIVT-1', business: 'My Business', ledger: 'DivTest Ledger', transdate: '2027-01-01', account: 'Cash and Bank', amount_minor: 1000, division: 'DivTest Manufacturing' });
  stageLine({ reference: 'DIVT-1', business: 'My Business', ledger: 'DivTest Ledger', transdate: '2027-01-01', account: 'Sales Revenue', amount_minor: -1000, division: 'DivTest Manufacturing' });
  postJournalEntry('DIVT-1', 'My Business', 'DivTest Ledger', 1);

  stageLine({ reference: 'DIVT-2', business: 'My Business', ledger: 'DivTest Ledger', transdate: '2027-01-01', account: 'Cash and Bank', amount_minor: 500, division: 'DivTest Services' });
  stageLine({ reference: 'DIVT-2', business: 'My Business', ledger: 'DivTest Ledger', transdate: '2027-01-01', account: 'Sales Revenue', amount_minor: -500, division: 'DivTest Services' });
  postJournalEntry('DIVT-2', 'My Business', 'DivTest Ledger', 1);

  const combined = getProfitAndLoss('My Business', 'DivTest Ledger');
  const mfg = getProfitAndLoss('My Business', 'DivTest Ledger', undefined, undefined, 'DivTest Manufacturing');
  const svc = getProfitAndLoss('My Business', 'DivTest Ledger', undefined, undefined, 'DivTest Services');

  assert.equal(combined.total_income_minor, 1500, 'combined reflects both divisions posting to the same account');
  assert.equal(mfg.total_income_minor, 1000, 'filtered to exactly the Manufacturing division');
  assert.equal(svc.total_income_minor, 500, 'filtered to exactly the Services division');
});

test('proves the concept: BMW M GmbH\'s real, published 2020 HGB balance sheet and P&L reproduce exactly through this system', () => {
  const B = 'BMW M GmbH Proof', L = 'BMW M GmbH Proof Actual';
  createEntity({ name: B, parent: 'Application' }, 1);
  createEntity({ name: L, parent: B }, 1);

  const eur = (t: number) => Math.round(t * 1000 * 100);

  const accounts: [string, string][] = [
    ['Proof: Immaterielle Vermögensgegenstände', 'Asset'],
    ['Proof: Sachanlagen', 'Asset'],
    ['Proof: Vorräte', 'Asset'],
    ['Proof: Forderungen und sonstige Vermögensgegenstände', 'Asset'],
    ['Proof: Kassenbestand und Bankguthaben', 'Asset'],
    ['Proof: Rechnungsabgrenzungsposten (Aktiva)', 'Asset'],
    ['Proof: Gezeichnetes Kapital', 'Equity'],
    ['Proof: Gewinnrücklagen', 'Equity'],
    ['Proof: Rückstellungen', 'Liability'],
    ['Proof: Erhaltene Anzahlungen', 'Liability'],
    ['Proof: Verbindlichkeiten aus Lieferungen und Leistungen', 'Liability'],
    ['Proof: Verbindlichkeiten gegenüber verbundenen Unternehmen', 'Liability'],
    ['Proof: Sonstige Verbindlichkeiten', 'Liability'],
    ['Proof: Umsatzerlöse', 'Income'],
    ['Proof: Sonstige betriebliche Erträge', 'Income'],
    ['Proof: Herstellungskosten', 'Expense'],
    ['Proof: Vertriebskosten', 'Expense'],
    ['Proof: Allgemeine Verwaltungskosten', 'Expense'],
    ['Proof: Sonstige betriebliche Aufwendungen', 'Expense'],
    ['Proof: Zinsergebnis', 'Expense'],
    ['Proof: Steuern vom Einkommen und Ertrag', 'Expense'],
    ['Proof: Sonstige Steuern', 'Expense'],
    ['Proof: Gewinnabführung', 'Expense'],
  ];
  for (const [name, category] of accounts) createEntity({ name, parent: category }, 1);

  const bsLines: [string, number][] = [
    ['Proof: Immaterielle Vermögensgegenstände', eur(372)],
    ['Proof: Sachanlagen', eur(26013)],
    ['Proof: Vorräte', eur(1445)],
    ['Proof: Forderungen und sonstige Vermögensgegenstände', eur(68244)],
    ['Proof: Kassenbestand und Bankguthaben', eur(221)],
    ['Proof: Rechnungsabgrenzungsposten (Aktiva)', eur(553)],
    ['Proof: Gezeichnetes Kapital', -eur(26)],
    ['Proof: Gewinnrücklagen', -eur(391)],
    ['Proof: Rückstellungen', -eur(32969)],
    ['Proof: Erhaltene Anzahlungen', -eur(50751)],
    ['Proof: Verbindlichkeiten aus Lieferungen und Leistungen', -eur(12601)],
    ['Proof: Verbindlichkeiten gegenüber verbundenen Unternehmen', -eur(76)],
    ['Proof: Sonstige Verbindlichkeiten', -eur(34)],
  ];
  for (const [account, amount_minor] of bsLines) stageLine({ reference: 'PROOF-BMW-BS', business: B, ledger: L, transdate: '2020-12-31', account, amount_minor });
  postJournalEntry('PROOF-BMW-BS', B, L, 1);

  const plLines: [string, number][] = [
    ['Proof: Umsatzerlöse', -eur(436058)],
    ['Proof: Sonstige betriebliche Erträge', -eur(3661)],
    ['Proof: Herstellungskosten', eur(283275)],
    ['Proof: Vertriebskosten', eur(35842)],
    ['Proof: Allgemeine Verwaltungskosten', eur(22690)],
    ['Proof: Sonstige betriebliche Aufwendungen', eur(314)],
    ['Proof: Zinsergebnis', eur(1129)],
    ['Proof: Steuern vom Einkommen und Ertrag', eur(21)],
    ['Proof: Sonstige Steuern', eur(3)],
    ['Proof: Gewinnabführung', eur(96445)],
  ];
  for (const [account, amount_minor] of plLines) stageLine({ reference: 'PROOF-BMW-PL', business: B, ledger: L, transdate: '2020-12-31', account, amount_minor });
  postJournalEntry('PROOF-BMW-PL', B, L, 1);

  const bs = getBalanceSheet(B, L);
  const pl = getProfitAndLoss(B, L);

  // BMW M GmbH's actual, published figures for FY2020 (in T€), from
  // its real Annual Financial Statements.
  assert.equal(bs.total_assets_minor, eur(96848));
  assert.equal(bs.total_liabilities_minor, eur(96431));
  assert.equal(bs.total_equity_minor, eur(417));
  assert.equal(bs.balanced, true);
  assert.equal(pl.total_income_minor, eur(439719));
  assert.equal(pl.total_expenses_minor, eur(439719));
  assert.equal(pl.net_income_minor, 0, 'BMW M GmbH transfers all profit to its parent under a profit-and-loss transfer agreement, so its own net result is always zero');
});

test('proves the concept: Peugeot Citroën Sochaux SNC\'s real, filed 2020 French (PCG) balance sheet and P&L reproduce exactly, as one genuinely balanced transaction', () => {
  const B = 'PCS Proof', L = 'PCS Proof Actual';
  createEntity({ name: B, parent: 'Application' }, 1);
  createEntity({ name: L, parent: B }, 1);
  const c = (eur: number) => Math.round(eur * 100);

  const accounts: [string, string][] = [
    ['Proof: Stocks et en-cours', 'Asset'], ['Proof: Créances clients et comptes rattachés', 'Asset'],
    ['Proof: Autres créances', 'Asset'], ['Proof: Disponibilités', 'Asset'],
    ['Proof: Capital', 'Equity'], ['Proof: Report à nouveau', 'Equity'],
    ['Proof: Provisions pour risques', 'Liability'], ['Proof: Emprunts et dettes financières divers', 'Liability'],
    ['Proof: Dettes fournisseurs et comptes rattachés', 'Liability'], ['Proof: Dettes fiscales et sociales', 'Liability'],
    ['Proof: Autres dettes', 'Liability'],
    ['Proof: Ventes de marchandises', 'Income'], ['Proof: Production vendue - Biens', 'Income'],
    ['Proof: Production vendue - Services', 'Income'], ['Proof: Reprises sur provisions', 'Income'],
    ['Proof: Autres produits', 'Income'], ['Proof: Produits financiers', 'Income'],
    ['Proof: Production stockée', 'Expense'], ['Proof: Achats de marchandises', 'Expense'],
    ['Proof: Achats de matières premières', 'Expense'], ['Proof: Variation des stocks', 'Expense'],
    ['Proof: Autres achats et charges externes', 'Expense'], ['Proof: Impôts et taxes', 'Expense'],
    ['Proof: Dotations provisions actif circulant', 'Expense'], ['Proof: Dotations provisions risques', 'Expense'],
    ['Proof: Autres charges', 'Expense'], ['Proof: Charges financières', 'Expense'],
    ['Proof: Charges exceptionnelles', 'Expense'], ['Proof: Impôts sur les bénéfices', 'Expense'],
  ];
  for (const [name, category] of accounts) createEntity({ name, parent: category }, 1);

  const lines: [string, number][] = [
    ['Proof: Stocks et en-cours', c(87405871.03)],
    ['Proof: Créances clients et comptes rattachés', c(592920454.84)],
    ['Proof: Autres créances', c(14962484.95)],
    ['Proof: Disponibilités', c(98.79)],
    ['Proof: Capital', -c(40000000.00)],
    ['Proof: Report à nouveau', c(489673220.88)],
    ['Proof: Provisions pour risques', -c(396796.00)],
    ['Proof: Emprunts et dettes financières divers', -c(525992682.76)],
    ['Proof: Dettes fournisseurs et comptes rattachés', -c(600722338.25)],
    ['Proof: Dettes fiscales et sociales', -c(3834150.86)],
    ['Proof: Autres dettes', -c(7347858.53)],
    ['Proof: Ventes de marchandises', -c(3105459.78)],
    ['Proof: Production vendue - Biens', -c(4568360419.09)],
    ['Proof: Production vendue - Services', -c(36790878.93)],
    ['Proof: Reprises sur provisions', -c(6486139.10)],
    ['Proof: Autres produits', -c(4014786.25)],
    ['Proof: Produits financiers', -c(843557.36)],
    ['Proof: Production stockée', c(15963620.93)],
    ['Proof: Achats de marchandises', c(304712.46)],
    ['Proof: Achats de matières premières', c(4100665453.06)],
    ['Proof: Variation des stocks', -c(1061094.58)],
    ['Proof: Autres achats et charges externes', c(478280283.63)],
    ['Proof: Impôts et taxes', c(6452417.31)],
    ['Proof: Dotations provisions actif circulant', c(5716459.43)],
    ['Proof: Dotations provisions risques', c(391318.00)],
    ['Proof: Autres charges', c(196.57)],
    ['Proof: Charges financières', c(4581579.61)],
    ['Proof: Charges exceptionnelles', c(25715.00)],
    ['Proof: Impôts sur les bénéfices', c(1612275.00)],
  ];
  for (const [account, amount_minor] of lines) stageLine({ reference: 'PROOF-PCS', business: B, ledger: L, transdate: '2020-12-31', account, amount_minor });
  postJournalEntry('PROOF-PCS', B, L, 1);

  const bs = getBalanceSheet(B, L);
  const pl = getProfitAndLoss(B, L);

  // Peugeot Citroën Sochaux SNC's actual, filed figures for FY2020 (EUR).
  assert.equal(bs.total_assets_minor, c(695288909.61));
  assert.equal(bs.total_liabilities_minor, c(1138293826.40));
  assert.equal(bs.total_equity_minor, -c(443004916.79));
  assert.equal(bs.balanced, true);
  assert.equal(pl.net_income_minor, c(6668304.09));
});

test('real multi-line invoices: header + lines, due date derived from the counterparty\'s own payment terms, posting creates the actual GL entry', () => {
  setContact('Acme Corp', { payment_terms_days: 14 });

  const invoiceId = createInvoice({
    invoiceType: 'AR',
    business: 'My Business',
    ledger: 'Actual',
    reference: 'INVTEST-1',
    counterpartyName: 'Acme Corp',
    invoiceDate: '2027-05-01',
    description: 'May order',
    lines: [
      { description: 'Widgets x10', quantity: 10, unitPriceMinor: 500, amountMinor: 5000, taxMinor: 0, dispatchReference: 'SD-TEST-1' },
      { description: 'Gadgets x5', quantity: 5, unitPriceMinor: 1000, amountMinor: 5000, taxMinor: 750, dispatchReference: 'SD-TEST-2' },
    ],
  }, 1);

  const draft = getInvoice(invoiceId)!;
  assert.equal(draft.status, 'draft');
  assert.equal(draft.due_date, '2027-05-15', 'derived from Acme Corp\'s own 14-day term, not a hardcoded default');
  assert.equal(draft.total_amount_minor, 10000);
  assert.equal(draft.total_tax_minor, 750);
  assert.equal(draft.lines.length, 2);

  postInvoice(invoiceId, 'Sales Revenue', 'Sales Tax Payable', 1);

  const posted = getInvoice(invoiceId)!;
  assert.equal(posted.status, 'posted');
  assert.equal(posted.posted_by, 'admin');

  const tb = getTrialBalance('My Business', 'Actual');
  const acme = tb.rows.find((r) => r.name === 'Acme Corp')!;
  assert.ok(acme.debit_minor >= 10750, 'Acme Corp genuinely debited for the full invoice total including tax');

  // Posting an already-posted invoice again must be rejected, not silently double-post.
  assert.throws(() => postInvoice(invoiceId, 'Sales Revenue', 'Sales Tax Payable', 1), ValidationError);
});

test('Credit Note reverses an invoice correctly — the same mechanism run in reverse, not a parallel schema', () => {
  const invoiceId = createInvoice({
    invoiceType: 'AR',
    business: 'My Business',
    ledger: 'Actual',
    reference: 'INVCN-1',
    counterpartyName: 'Acme Corp',
    invoiceDate: '2027-06-01',
    lines: [{ description: 'Widgets x10', amountMinor: 10000, taxMinor: 0 }],
  }, 1);
  postInvoice(invoiceId, 'Sales Revenue', 'Sales Tax Payable', 1);

  const beforeCredit = getTrialBalance('My Business', 'Actual').rows.find((r) => r.name === 'Acme Corp')!.debit_minor;

  const creditNoteId = createInvoice({
    invoiceType: 'AR',
    documentType: 'credit_note',
    referencesInvoiceId: invoiceId,
    business: 'My Business',
    ledger: 'Actual',
    reference: 'CN-1',
    counterpartyName: 'Acme Corp',
    invoiceDate: '2027-06-05',
    description: 'Return of 3 widgets',
    lines: [{ description: 'Widgets x3 returned', amountMinor: 3000, taxMinor: 0 }],
  }, 1);
  const draft = getInvoice(creditNoteId)!;
  assert.equal(draft.document_type, 'credit_note');
  assert.equal(draft.references_invoice_id, invoiceId);

  postInvoice(creditNoteId, 'Sales Revenue', 'Sales Tax Payable', 1);

  const afterCredit = getTrialBalance('My Business', 'Actual').rows.find((r) => r.name === 'Acme Corp')!.debit_minor;
  assert.equal(afterCredit, beforeCredit - 3000, 'the credit note correctly reduces what Acme Corp owes, not increases it');

  // Referencing a nonexistent invoice must be rejected.
  assert.throws(
    () =>
      createInvoice(
        {
          invoiceType: 'AR',
          documentType: 'credit_note',
          referencesInvoiceId: 999999,
          business: 'My Business',
          ledger: 'Actual',
          reference: 'CN-BAD',
          counterpartyName: 'Acme Corp',
          invoiceDate: '2027-06-05',
          lines: [{ description: 'x', amountMinor: 100 }],
        },
        1
      ),
    ValidationError
  );
});

test('aged invoices: bucketed by each customer\'s own payment terms, and partial payment allocation genuinely reduces what is outstanding', () => {
  setContact('Acme Corp', { payment_terms_days: 30 });
  setContact('Beta Pty Ltd', { payment_terms_days: 7 });

  const inv1 = createInvoice({
    invoiceType: 'AR', business: 'My Business', ledger: 'Actual', reference: 'AGETEST-1',
    counterpartyName: 'Acme Corp', invoiceDate: '2027-01-01',
    lines: [{ description: 'x', amountMinor: 10000 }],
  }, 1);
  postInvoice(inv1, 'Sales Revenue', 'Sales Tax Payable', 1);

  const inv2 = createInvoice({
    invoiceType: 'AR', business: 'My Business', ledger: 'Actual', reference: 'AGETEST-2',
    counterpartyName: 'Beta Pty Ltd', invoiceDate: '2027-01-01',
    lines: [{ description: 'y', amountMinor: 5000 }],
  }, 1);
  postInvoice(inv2, 'Sales Revenue', 'Sales Tax Payable', 1);

  assert.equal(getInvoiceOutstandingMinor(inv1), 10000);
  allocatePayment(inv1, 'RCPTTEST-1', 4000, '2027-01-15', 'Cash and Bank', 1);
  assert.equal(getInvoiceOutstandingMinor(inv1), 6000, 'partial payment genuinely reduces what is outstanding');

  const aged = getAgedInvoices('My Business', 'Actual', 'AR', '2027-03-01');
  const acmeRow = aged.find((r) => r.reference === 'AGETEST-1')!;
  const betaRow = aged.find((r) => r.reference === 'AGETEST-2')!;

  assert.equal(acmeRow.outstanding_minor, 6000);
  assert.equal(acmeRow.bucket, '1-30', 'Acme Corp aged against its own 30-day term');
  assert.equal(betaRow.bucket, 'Over 21', 'Beta Pty Ltd aged against its own much shorter 7-day term, not the same 30/60/90 as Acme');

  // Cannot allocate more than what is actually outstanding.
  assert.throws(() => allocatePayment(inv1, 'RCPTTEST-2', 999999, '2027-01-16', 'Cash and Bank', 1), ValidationError);

  // A fully-paid invoice must not appear in the aged report at all.
  allocatePayment(inv2, 'RCPTTEST-3', 5000, '2027-01-20', 'Cash and Bank', 1);
  const agedAfterFullPayment = getAgedInvoices('My Business', 'Actual', 'AR', '2027-03-01');
  assert.ok(!agedAfterFullPayment.some((r) => r.reference === 'AGETEST-2'), 'a fully-paid invoice is not outstanding, so it must not show up as aged');
});

test('Cost Centers apply to purchasing only, Profit Centers apply to both — matching SQL-Ledger\'s actual Department distinction, not a generic undifferentiated division', () => {
  createEntity({ name: 'CPTest Factory Floor', parent: 'Divisions' }, 1);
  setDivisionType('CPTest Factory Floor', 'Cost Center');
  createEntity({ name: 'CPTest Product Sales', parent: 'Divisions' }, 1);
  setDivisionType('CPTest Product Sales', 'Profit Center');

  assert.equal(getDivisionType('CPTest Factory Floor'), 'Cost Center');
  assert.equal(getDivisionType('CPTest Product Sales'), 'Profit Center');

  // A Cost Center on an expense account is fine — that's its purpose.
  stageLine({ reference: 'CPT-1', business: 'My Business', ledger: 'Actual', transdate: '2027-01-01', account: 'Rent', amount_minor: 1000, division: 'CPTest Factory Floor' });

  // A Cost Center on an income account must be rejected — Cost Centers
  // apply to purchasing only, never sales.
  assert.throws(
    () => stageLine({ reference: 'CPT-2', business: 'My Business', ledger: 'Actual', transdate: '2027-01-01', account: 'Sales Revenue', amount_minor: -1000, division: 'CPTest Factory Floor' }),
    ValidationError
  );

  // A Profit Center on an income account is fine — Profit Centers apply to both.
  stageLine({ reference: 'CPT-3', business: 'My Business', ledger: 'Actual', transdate: '2027-01-01', account: 'Sales Revenue', amount_minor: -1000, division: 'CPTest Product Sales' });
});

test('Credit Invoice (restocks) vs Credit Note (does not) — matching SQL-Ledger\'s real distinction, applied per-line based on whether restocking was actually requested', () => {
  createEntity({ name: 'RSTest Widget', parent: 'Items' }, 1);

  const invId = createInvoice({
    invoiceType: 'AR', business: 'My Business', ledger: 'Actual', reference: 'RSTEST-INV',
    counterpartyName: 'Acme Corp', invoiceDate: '2027-02-01',
    lines: [{ description: 'x10', quantity: 10, unitPriceMinor: 100, amountMinor: 1000, itemName: 'RSTest Widget' }],
  }, 1);
  postInvoice(invId, 'Sales Revenue', 'Sales Tax Payable', 1);

  const cnId = createInvoice({
    invoiceType: 'AR', documentType: 'credit_note', referencesInvoiceId: invId,
    business: 'My Business', ledger: 'Actual', reference: 'RSTEST-CN',
    counterpartyName: 'Acme Corp', invoiceDate: '2027-02-05',
    lines: [{ description: 'x3 returned', quantity: 3, unitPriceMinor: 100, amountMinor: 300, itemName: 'RSTest Widget' }],
  }, 1);
  postInvoice(cnId, 'Sales Revenue', 'Sales Tax Payable', 1, true); // restockInventory=true

  const afterRestock = (db.prepare(`SELECT balance_minor FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name='RSTest Widget')`).get() as { balance_minor: number });
  assert.equal(afterRestock.balance_minor, 3, 'restocking genuinely adds the returned quantity back');

  const cn2Id = createInvoice({
    invoiceType: 'AR', documentType: 'credit_note', referencesInvoiceId: invId,
    business: 'My Business', ledger: 'Actual', reference: 'RSTEST-CN2',
    counterpartyName: 'Acme Corp', invoiceDate: '2027-02-06',
    lines: [{ description: 'x2 price correction, no return', quantity: 2, unitPriceMinor: 100, amountMinor: 200, itemName: 'RSTest Widget' }],
  }, 1);
  postInvoice(cn2Id, 'Sales Revenue', 'Sales Tax Payable', 1, false); // restockInventory=false

  const afterNoRestock = (db.prepare(`SELECT balance_minor FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name='RSTest Widget')`).get() as { balance_minor: number });
  assert.equal(afterNoRestock.balance_minor, 3, 'a credit note without restocking must leave stock quantity unchanged, matching SQL-Ledger\'s own Credit Note behavior');
});

test('Reminders: escalate per customer, cap at level 3, and reset independently of any other contact edit', () => {
  setContact('Beta Pty Ltd', { payment_terms_days: 7 });

  const invId = createInvoice({
    invoiceType: 'AR', business: 'My Business', ledger: 'Actual', reference: 'REMTEST-1',
    counterpartyName: 'Beta Pty Ltd', invoiceDate: '2027-03-01',
    lines: [{ description: 'x', amountMinor: 5000 }],
  }, 1);
  postInvoice(invId, 'Sales Revenue', 'Sales Tax Payable', 1);

  const candidates = getReminderCandidates('My Business', 'Actual', '2027-04-01');
  const betaCandidate = candidates.find((c) => c.counterparty === 'Beta Pty Ltd')!;
  assert.equal(betaCandidate.current_level, 0);
  assert.equal(betaCandidate.next_level, 1);

  assert.equal(recordReminderSent('Beta Pty Ltd'), 1);
  assert.equal(recordReminderSent('Beta Pty Ltd'), 2);
  assert.equal(recordReminderSent('Beta Pty Ltd'), 3);
  assert.equal(recordReminderSent('Beta Pty Ltd'), 3, 'caps at 3, the harshest level, never escalates further');

  // An unrelated contact edit must NOT reset the reminder level —
  // setContact's full-replace semantics deliberately exclude it.
  setContact('Beta Pty Ltd', { payment_terms_days: 14 });
  assert.equal(getContact('Beta Pty Ltd')?.reminder_level, 3, 'reminder_level survives an unrelated contact edit');

  resetReminderLevel('Beta Pty Ltd');
  assert.equal(getContact('Beta Pty Ltd')?.reminder_level, 0);
});

test('aged summary rolls up per customer (matching SQL-Ledger\'s Summary aging view), and counterparty history shows real line-item activity', () => {
  createEntity({ name: 'HistTest Customer', parent: 'Accounts Receivable' }, 1);
  setContact('HistTest Customer', { payment_terms_days: 30 });

  const inv1 = createInvoice({
    invoiceType: 'AR', business: 'My Business', ledger: 'Actual', reference: 'HISTTEST-1',
    counterpartyName: 'HistTest Customer', invoiceDate: '2027-04-01',
    lines: [{ description: 'Widgets x5', quantity: 5, unitPriceMinor: 200, amountMinor: 1000 }],
  }, 1);
  postInvoice(inv1, 'Sales Revenue', 'Sales Tax Payable', 1);

  const inv2 = createInvoice({
    invoiceType: 'AR', business: 'My Business', ledger: 'Actual', reference: 'HISTTEST-2',
    counterpartyName: 'HistTest Customer', invoiceDate: '2027-04-10',
    lines: [{ description: 'Gadgets x2', quantity: 2, unitPriceMinor: 500, amountMinor: 1000 }],
  }, 1);
  postInvoice(inv2, 'Sales Revenue', 'Sales Tax Payable', 1);

  const summary = getAgedSummary('My Business', 'Actual', 'AR', '2027-06-01');
  const customerSummary = summary.find((r) => r.counterparty === 'HistTest Customer')!;
  assert.equal(customerSummary.outstanding_minor, 2000, 'summary correctly rolls up both invoices into one total');

  const history = getCounterpartyHistory('My Business', 'Actual', 'HistTest Customer');
  assert.ok(history.some((h) => h.description === 'Widgets x5' && h.quantity === 5));
  assert.ok(history.some((h) => h.description === 'Gadgets x2' && h.quantity === 2));
  assert.equal(history[0].invoice_date, '2027-04-10', 'most recent activity first');
});

test('stock write-offs (breakage/spoilage): a real dual-effect transaction, reducing quantity on hand AND recognizing the actual loss in the GL, not just an adjustment with no accounting consequence', () => {
  createEntity({ name: 'WOTest Perishable', parent: 'Items' }, 1);
  createEntity({ name: 'WOTest Write-off Expense', parent: 'Expense' }, 1);

  postQuantityMovement('My Business', 'Actual', 'WOTEST-RECEIVE-QTY', 'WOTest Perishable', 100, 1, '2027-01-01');

  writeOffStock('My Business', 'Actual', 'WOTEST-1', 'WOTest Perishable', 15, 200, 'WOTest Write-off Expense', 'Inventory', 'Spoiled', 1, '2027-02-01');

  const qty = (db.prepare(`SELECT balance_minor FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name='WOTest Perishable' AND parent_id = (SELECT id FROM current_entities WHERE name = 'Items'))`).get() as { balance_minor: number });
  assert.equal(qty.balance_minor, 85, 'quantity genuinely reduced, not just recorded');

  const pl = getProfitAndLoss('My Business', 'Actual');
  const writeOffLine = pl.expenses.find((e) => e.name === 'WOTest Write-off Expense');
  assert.equal(writeOffLine?.debit_minor, 3000, 'the loss is actually recognized as an expense (15 units x 200 minor units), not silently unaccounted for');

  assert.throws(
    () => writeOffStock('My Business', 'Actual', 'WOTEST-2', 'WOTest Perishable', -5, 200, 'WOTest Write-off Expense', 'Inventory', 'bad', 1, '2027-02-02'),
    ValidationError,
    'a write-off is always a reduction, never a gain — negative quantity must be rejected'
  );
});

test('lot/expiration tracking: consumption is genuinely FIFO by expiration date, not receipt order, and the expiring-stock report only shows what actually still has quantity', () => {
  createEntity({ name: 'LotTest Dairy', parent: 'Items' }, 1);

  // Received in this order: B, A, C — but A expires soonest.
  receiveLot('My Business', 'Actual', 'LOTTEST-R1', 'LotTest Dairy', 'LOT-B', '2027-01-05', '2027-03-15', 50, 1);
  receiveLot('My Business', 'Actual', 'LOTTEST-R2', 'LotTest Dairy', 'LOT-A', '2027-01-01', '2027-02-01', 30, 1);
  receiveLot('My Business', 'Actual', 'LOTTEST-R3', 'LotTest Dairy', 'LOT-C', '2027-01-10', '2027-04-01', 40, 1);

  const overallQty = (db.prepare(`SELECT balance_minor FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name='LotTest Dairy')`).get() as { balance_minor: number });
  assert.equal(overallQty.balance_minor, 120, 'overall quantity tracks the sum across all lots');

  const consumed = consumeFromLots('LotTest Dairy', 60);
  assert.deepEqual(
    consumed,
    [
      { lot_number: 'LOT-A', consumed: 30, expiration_date: '2027-02-01' },
      { lot_number: 'LOT-B', consumed: 30, expiration_date: '2027-03-15' },
    ],
    'LOT-A consumed first despite being received second, because it expires soonest — genuine FIFO by expiration, not receipt order'
  );

  const expiring = getExpiringStock('2027-01-15', 60);
  assert.equal(expiring.length, 1, 'LOT-A is fully consumed (excluded) and LOT-C is too far out (excluded) — only LOT-B genuinely qualifies');
  assert.equal(expiring[0].lot_number, 'LOT-B');
  assert.equal(expiring[0].quantity_on_hand, 20);

  assert.throws(() => consumeFromLots('LotTest Dairy', 999), ValidationError, 'cannot consume more than what is genuinely on hand across all lots');
});

test('Locations: per-location stock, exactly one billing address, warehouse-direct dispatch for large orders, same-city transfers, and below-reorder reporting', () => {
  createEntity({ name: 'LocTest Head Office', parent: 'Locations' }, 1);
  setLocation('LocTest Head Office', { city: 'LocTest City A', location_type: 'Warehouse', is_billing_address: true, bottle_capacity: null, carton_capacity: null , timezone: 'UTC'});

  createEntity({ name: 'LocTest Retail A1', parent: 'Locations' }, 1);
  setLocation('LocTest Retail A1', { city: 'LocTest City A', location_type: 'Retail', is_billing_address: false, bottle_capacity: 2000, carton_capacity: 300 , timezone: 'UTC'});

  createEntity({ name: 'LocTest Retail B1', parent: 'Locations' }, 1);
  setLocation('LocTest Retail B1', { city: 'LocTest City B', location_type: 'Retail', is_billing_address: false, bottle_capacity: 1800, carton_capacity: 280 , timezone: 'UTC'});

  const billingCount = (
    db.prepare(`SELECT COUNT(*) AS c FROM current_entities e JOIN current_entities rel_type ON rel_type.id = e.parent_id AND rel_type.name = 'Is Billing Address'`).get() as { c: number }
  ).c;
  assert.equal(billingCount, 1, 'exactly one billing address, even with multiple locations defined');

  createEntity({ name: 'LocTest Lager', parent: 'Items' }, 1);

  // 48 cartons at 24 bottles each, received at the warehouse.
  receiveStockAtLocation('My Business', 'Actual', 'LOCTEST-REC-1', 'LocTest Lager', 'LocTest Head Office', 48 * 24, 1, '2027-01-01');
  assert.equal(getItemLocation('LocTest Lager', 'LocTest Head Office').quantity_on_hand, 1152);

  setItemLocationLevels('LocTest Lager', 'LocTest Retail A1', { minLevel: 5 * 24, maxLevel: 20 * 24, reorderLevel: 8 * 24 });
  const levels = getItemLocation('LocTest Lager', 'LocTest Retail A1');
  assert.equal(levels.min_level, 120);
  assert.equal(levels.max_level, 480);
  assert.equal(levels.reorder_level, 192);

  // The real correction: sale is through retail, but a large function
  // order is dispatched directly from the warehouse.
  dispatchStockFromLocation('My Business', 'Actual', 'LOCTEST-DISP-1', 'LocTest Lager', 'LocTest Head Office', 48 * 24, 1, '2027-01-05');
  assert.equal(getItemLocation('LocTest Lager', 'LocTest Head Office').quantity_on_hand, 0);

  // Ordinary stock transfer, warehouse to retail, same city.
  receiveStockAtLocation('My Business', 'Actual', 'LOCTEST-REC-2', 'LocTest Lager', 'LocTest Head Office', 100 * 24, 1, '2027-01-10');
  transferStock('My Business', 'Actual', 'LocTest Lager', 'LocTest Head Office', 'LocTest Retail A1', 10 * 24, 'LOCTEST-XFER-1');
  assert.equal(getItemLocation('LocTest Lager', 'LocTest Head Office').quantity_on_hand, 90 * 24);
  assert.equal(getItemLocation('LocTest Lager', 'LocTest Retail A1').quantity_on_hand, 10 * 24);

  // A warehouse only serves its own city's outlets — cross-city transfer rejected.
  assert.throws(
    () => transferStock('My Business', 'Actual', 'LocTest Lager', 'LocTest Head Office', 'LocTest Retail B1', 24, 'LOCTEST-XFER-BAD'),
    ValidationError
  );

  // Cannot dispatch/transfer more than what's on hand at that specific location.
  assert.throws(
    () => dispatchStockFromLocation('My Business', 'Actual', 'LOCTEST-DISP-BAD', 'LocTest Lager', 'LocTest Retail A1', 999999, 1, '2027-01-11'),
    ValidationError
  );

  // Below-reorder: 240 bottles on hand vs reorder_level 192 — not below yet.
  const belowBefore = getBelowReorderStock().filter((r) => r.item === 'LocTest Lager');
  assert.equal(belowBefore.length, 0);

  // Sell most of it down, then it should show up.
  dispatchStockFromLocation('My Business', 'Actual', 'LOCTEST-DISP-2', 'LocTest Lager', 'LocTest Retail A1', 8 * 24, 1, '2027-01-12');
  const belowAfter = getBelowReorderStock().filter((r) => r.item === 'LocTest Lager' && r.location === 'LocTest Retail A1');
  assert.equal(belowAfter.length, 1, 'now at or below its own reorder level, correctly surfaced');
});

test('quantity movements carry a real, queryable location — receive, dispatch, and transfer (both legs) each record where it actually happened, not just updating the current-state snapshot', () => {
  createEntity({ name: 'MoveLocTest Warehouse', parent: 'Locations' }, 1);
  setLocation('MoveLocTest Warehouse', { city: 'MoveLocTest City', location_type: 'Warehouse', is_billing_address: false, bottle_capacity: 0, carton_capacity: 5000 , timezone: 'UTC'});
  createEntity({ name: 'MoveLocTest Outlet', parent: 'Locations' }, 1);
  setLocation('MoveLocTest Outlet', { city: 'MoveLocTest City', location_type: 'Retail', is_billing_address: false, bottle_capacity: 500, carton_capacity: 50 , timezone: 'UTC'});
  createItem('MoveLocTest Wine', 'Items', 1);

  receiveStockAtLocation('My Business', 'Actual', 'MOVELOCTEST-REC', 'MoveLocTest Wine', 'MoveLocTest Warehouse', 100, 1, '2027-09-01');
  function locationOf(reference: string, sign?: 'positive' | 'negative'): string | null {
    const signClause = sign === 'positive' ? 'AND jl.amount_minor > 0' : sign === 'negative' ? 'AND jl.amount_minor < 0' : '';
    const row = db
      .prepare(`SELECT l.name FROM journal_line jl JOIN journal j ON j.id = jl.journal_id LEFT JOIN current_entities l ON l.id = jl.location_id WHERE j.reference = ? ${signClause}`)
      .get(reference) as { name: string | null } | undefined;
    return row?.name ?? null;
  }
  assert.equal(locationOf('MOVELOCTEST-REC'), 'MoveLocTest Warehouse', 'a real receipt must record the real location it was actually received at');

  // A real transfer now stages both its real legs under one, shared
  // reference and posts once — a true, balanced two-line entry, not
  // two separate postings under two different references.
  transferStock('My Business', 'Actual', 'MoveLocTest Wine', 'MoveLocTest Warehouse', 'MoveLocTest Outlet', 30, 'MOVELOCTEST-XFER', 1, '2027-09-02');
  assert.equal(locationOf('MOVELOCTEST-XFER', 'negative'), 'MoveLocTest Warehouse', "a transfer's own OUT leg (the negative amount) must record the real source location");
  assert.equal(locationOf('MOVELOCTEST-XFER', 'positive'), 'MoveLocTest Outlet', "a transfer's own IN leg (the positive amount) must record the real destination — previously transferStock recorded no movement history at all, only updating the current-state snapshot");

  // The real, direct claim: one, true, balanced double-entry posting —
  // a single real journal row (not two), with its two real lines
  // summing to exactly zero.
  const journalRows = db.prepare(`SELECT id FROM journal WHERE reference = 'MOVELOCTEST-XFER'`).all() as { id: number }[];
  assert.equal(journalRows.length, 1, 'a real transfer must be one, single, real journal entry — not two separate ones that merely net to zero');
  const lineSum = (
    db.prepare(`SELECT SUM(amount_minor) AS total FROM journal_line WHERE journal_id = ?`).get(journalRows[0].id) as { total: number }
  ).total;
  assert.equal(lineSum, 0, "a real transfer's own two, real lines must sum to exactly zero — genuine double-entry balance, not an invented offsetting account");

  dispatchStockFromLocation('My Business', 'Actual', 'MOVELOCTEST-DISP', 'MoveLocTest Wine', 'MoveLocTest Outlet', 10, 1, '2027-09-03');
  assert.equal(locationOf('MOVELOCTEST-DISP'), 'MoveLocTest Outlet', 'a real dispatch must record the real location it was actually dispatched from');
});

test('true double-entry quantity tracking: a real "on order" account for receipts and a real "units sold" account for dispatches — the genuine counteritem, not derived arithmetic, per direct confirmation', () => {
  createEntity({ name: 'DblEntryQty Ledger', parent: 'My Business' }, 1);
  createEntity({ name: 'DblEntryQty Warehouse', parent: 'Locations' }, 1);
  setLocation('DblEntryQty Warehouse', { city: 'DblEntryQty City', location_type: 'Warehouse', is_billing_address: false, bottle_capacity: 0, carton_capacity: 5000 , timezone: 'UTC'});
  createEntity({ name: 'DblEntryQty Outlet', parent: 'Locations' }, 1);
  setLocation('DblEntryQty Outlet', { city: 'DblEntryQty City', location_type: 'Retail', is_billing_address: false, bottle_capacity: 500, carton_capacity: 50 , timezone: 'UTC'});
  createEntity({ name: 'DblEntryQty Vendor', parent: 'Vendors' }, 1);
  createItem('DblEntryQty Wine', 'Items', 1);

  function balanceOf(accountName: string): number {
    return (
      (db.prepare(`SELECT balance_minor FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name = ?)`).get(accountName) as
        | { balance_minor: number }
        | undefined)?.balance_minor ?? 0
    );
  }

  // Placing a real PO builds up a real, genuine "on order" balance —
  // an independently meaningful fact, not derived from anything else.
  stagePurchaseOrder({ reference: 'DEQ-PO-1', business: 'My Business', ledger: 'DblEntryQty Ledger', vendor: 'DblEntryQty Vendor', item: 'DblEntryQty Wine', quantity: 60, price_minor: 1500, transdate: '2027-08-01' });
  postPurchaseOrder('DEQ-PO-1', 'My Business', 'DblEntryQty Ledger', 1);
  assert.equal(balanceOf('DblEntryQty Wine — On Order'), 60, 'placing a real PO must build up a real, genuine on-order balance');

  // Receiving stock is now a real, balanced, two-line posting.
  receiveStockAtLocation('My Business', 'DblEntryQty Ledger', 'DEQ-RECV-1', 'DblEntryQty Wine', 'DblEntryQty Warehouse', 60, 1, '2027-08-05');
  const receiptJournalId = (db.prepare(`SELECT id FROM journal WHERE reference = 'DEQ-RECV-1'`).get() as { id: number }).id;
  const receiptSum = (db.prepare(`SELECT SUM(amount_minor) AS total FROM journal_line WHERE journal_id = ?`).get(receiptJournalId) as { total: number }).total;
  assert.equal(receiptSum, 0, 'a real receipt must be a genuinely balanced, two-line entry — debit on-hand, credit on-order');
  assert.equal(balanceOf('DblEntryQty Wine — On Order'), 0, 'a real receipt that exactly fulfills the real, matching PO must bring on-order back to exactly zero');
  assert.equal(getItemLocation('DblEntryQty Wine', 'DblEntryQty Warehouse').quantity_on_hand, 60);

  // A real receipt with no matching PO ever placed — a real, honest
  // possibility (an emergency, unplanned purchase) — must not be
  // refused; on-order simply, correctly goes negative.
  receiveStockAtLocation('My Business', 'DblEntryQty Ledger', 'DEQ-RECV-2', 'DblEntryQty Wine', 'DblEntryQty Warehouse', 10, 1, '2027-08-06');
  assert.equal(balanceOf('DblEntryQty Wine — On Order'), -10, 'a real, unplanned receipt with no matching PO must correctly drive on-order negative, not be refused');

  // Dispatching stock (a real sale) is also now a real, balanced, two-line posting.
  transferStock('My Business', 'DblEntryQty Ledger', 'DblEntryQty Wine', 'DblEntryQty Warehouse', 'DblEntryQty Outlet', 20, 'DEQ-XFER-1', 1, '2027-08-07');
  dispatchStockFromLocation('My Business', 'DblEntryQty Ledger', 'DEQ-DISP-1', 'DblEntryQty Wine', 'DblEntryQty Outlet', 15, 1, '2027-08-08');
  const dispatchJournalId = (db.prepare(`SELECT id FROM journal WHERE reference = 'DEQ-DISP-1'`).get() as { id: number }).id;
  const dispatchSum = (db.prepare(`SELECT SUM(amount_minor) AS total FROM journal_line WHERE journal_id = ?`).get(dispatchJournalId) as { total: number }).total;
  assert.equal(dispatchSum, 0, 'a real dispatch must be a genuinely balanced, two-line entry — debit units sold, credit on-hand');
  assert.equal(balanceOf('DblEntryQty Wine — Units Sold'), 15, "a real dispatch must build up a real, genuine units-sold balance, mirroring COGS on the quantity side");
  assert.equal(getItemLocation('DblEntryQty Wine', 'DblEntryQty Outlet').quantity_on_hand, 5);
});

test('getStockMovementReport: the real, physical journey of stock — purchases into a warehouse, a real transfer on to a retail outlet, and a real sale, each correctly enriched with its own real category, division, and vendor', () => {
  createEntity({ name: 'SMRTest Ledger', parent: 'My Business' }, 1);
  createEntity({ name: 'SMRTest Region', parent: 'Divisions' }, 1);
  setDivisionType('SMRTest Region', 'Profit Center');
  createEntity({ name: 'SMRTest Warehouse', parent: 'Locations' }, 1);
  setLocation('SMRTest Warehouse', { city: 'SMRTest Region', location_type: 'Warehouse', is_billing_address: false, bottle_capacity: 0, carton_capacity: 5000 , timezone: 'UTC'});
  createEntity({ name: 'SMRTest Outlet', parent: 'Locations' }, 1);
  setLocation('SMRTest Outlet', { city: 'SMRTest Region', location_type: 'Retail', is_billing_address: true, bottle_capacity: 500, carton_capacity: 50 , timezone: 'UTC'});
  createEntity({ name: 'SMRTest Category', parent: 'Items' }, 1);
  createItem('SMRTest Wine', 'SMRTest Category', 1);
  createEntity({ name: 'SMRTest Vendor', parent: 'Vendors' }, 1);
  createEntity({ name: 'SMRTest Wine Customer', parent: 'Customers' }, 1);
  const { salesAccount, salesAccountId } = ensureProductSalesCogsAccounts('SMRTest Wine', 1);
  db.prepare(`INSERT INTO item_source (item_id, vendor_id, is_preferred) VALUES ((SELECT id FROM current_entities WHERE name = 'SMRTest Wine'), (SELECT id FROM current_entities WHERE name = 'SMRTest Vendor'), 1)`).run();

  // Real purchase into the warehouse.
  receiveStockAtLocation('My Business', 'SMRTest Ledger', 'SMRT-1-RECV', 'SMRTest Wine', 'SMRTest Warehouse', 50, 1, '2027-10-01');
  // Real transfer on to the retail outlet.
  transferStock('My Business', 'SMRTest Ledger', 'SMRTest Wine', 'SMRTest Warehouse', 'SMRTest Outlet', 20, 'SMRT-1-XFER', 1, '2027-10-02');
  // Real sale — a real invoice, dispatched, exactly matching how completePosSale itself structures references.
  const invoiceId = createInvoice(
    {
      invoiceType: 'AR',
      business: 'My Business',
      ledger: 'SMRTest Ledger',
      reference: 'SMRT-SALE-1',
      counterpartyName: 'SMRTest Wine Customer',
      invoiceDate: '2027-10-03',
      lines: [{ description: 'SMRTest Wine', quantity: 3, unitPriceMinor: 1500, amountMinor: 4500, taxMinor: 0, itemName: 'SMRTest Wine' }],
    },
    1
  );
  postInvoice(invoiceId, { name: salesAccount, id: salesAccountId }, 'Sales Tax Payable', 1);
  dispatchStockFromLocation('My Business', 'SMRTest Ledger', 'SMRT-SALE-1-DISPATCH-SMRTest Wine', 'SMRTest Wine', 'SMRTest Outlet', 3, 1, '2027-10-03');

  const report = getStockMovementReport('SMRTest Ledger', '2027-10-01', '2027-10-03');

  assert.equal(report.receipts.length, 1);
  assert.equal(report.receipts[0].location, 'SMRTest Warehouse');
  assert.equal(report.receipts[0].division, 'SMRTest Region', "a receipt's real location must correctly resolve to its real division");
  assert.equal(report.receipts[0].category, 'SMRTest Category');
  assert.equal(report.receipts[0].vendor, 'SMRTest Vendor', "a receipt's real item must resolve to its real, preferred vendor");
  assert.equal(report.receipts[0].quantity, 50);

  assert.equal(report.transfers.length, 1);
  assert.equal(report.transfers[0].from_location, 'SMRTest Warehouse', "a real transfer's own source location must be correctly looked up, not left unknown");
  assert.equal(report.transfers[0].to_location, 'SMRTest Outlet');
  assert.equal(report.transfers[0].quantity, 20);

  assert.equal(report.sales.length, 1);
  assert.equal(report.sales[0].location, 'SMRTest Outlet');
  assert.equal(report.sales[0].quantity, 3);
  assert.equal(report.sales[0].amount_minor, 4500, "a real sale's own real dollar amount must be correctly joined from the real Sales account posting, not left at zero");
});

test('item categories: nested arbitrarily deep in the existing entity tree, and an empty subcategory never shows up as a fake item', () => {
  createEntity({ name: 'CatTest Red Wine', parent: 'Items' }, 1);
  createEntity({ name: 'CatTest White Wine', parent: 'Items' }, 1);
  createEntity({ name: 'CatTest Merlot', parent: 'CatTest Red Wine' }, 1);
  createEntity({ name: 'CatTest Chablis', parent: 'CatTest White Wine' }, 1); // deliberately left empty

  createItem('CatTest Château Merlot 2020', 'CatTest Merlot', 1);

  const items = listItems().map((p) => p.name);
  assert.ok(items.includes('CatTest Château Merlot 2020'), 'the real item shows up');
  assert.ok(!items.includes('CatTest Red Wine'), 'a category is never listed as a item');
  assert.ok(!items.includes('CatTest Merlot'), 'a subcategory is never listed as a item, even though it has a real item underneath it');
  assert.ok(!items.includes('CatTest Chablis'), 'an empty subcategory (no products yet) must not be mistaken for a real item just because it is currently a leaf');
});

test('stock take sheets: ordered by shelf_side/rack (alphabetically, as free text) then level numerically (top to bottom), and completing posts genuine loss/gain variance while leaving uncounted lines untouched', () => {
  createEntity({ name: 'STTest Outlet', parent: 'Locations' }, 1);
  setLocation('STTest Outlet', { city: 'STTest City', location_type: 'Retail', is_billing_address: false, bottle_capacity: 1000, carton_capacity: 100 , timezone: 'UTC'});

  createItem('STTest Merlot', 'Items', 1);
  createItem('STTest Chardonnay', 'Items', 1);

  receiveStockAtLocation('My Business', 'Actual', 'STTEST-REC-1', 'STTest Merlot', 'STTest Outlet', 50, 1, '2027-01-01');
  setItemLocationLevels('STTest Merlot', 'STTest Outlet', { shelfSide: 'Front', rack: 'A', level: 3 });
  receiveStockAtLocation('My Business', 'Actual', 'STTEST-REC-2', 'STTest Chardonnay', 'STTest Outlet', 30, 1, '2027-01-01');
  setItemLocationLevels('STTest Chardonnay', 'STTest Outlet', { shelfSide: 'Front', rack: 'A', level: 1 });

  const takeId = createStockTake('STTest Outlet', '2027-02-01', 1);
  const take = getStockTake(takeId)!;
  assert.equal(take.lines[0].item, 'STTest Chardonnay', 'level 1 sorts before level 3 within the same shelf_side/rack — numeric, genuinely top to bottom');
  assert.equal(take.lines[1].item, 'STTest Merlot');

  recordStockTakeCount(takeId, 'STTest Chardonnay', 28); // shortage of 2
  // STTest Merlot deliberately left uncounted.

  completeStockTake(takeId, 'My Business', 'Actual', 'Miscellaneous', 'Inventory', { 'STTest Chardonnay': 1000 }, 1);

  assert.equal(getItemLocation('STTest Chardonnay', 'STTest Outlet').quantity_on_hand, 28, 'corrected to match what was actually counted');
  assert.equal(getItemLocation('STTest Merlot', 'STTest Outlet').quantity_on_hand, 50, 'never counted, so left untouched, not silently zeroed or assumed correct');

  const completedTake = getStockTake(takeId)!;
  assert.equal(completedTake.status, 'completed');
  assert.throws(() => recordStockTakeCount(takeId, 'STTest Merlot', 50), ValidationError, 'cannot record a count against an already-completed take');

  // A variance with no unit cost given must be rejected, not silently valued at zero.
  const takeId2 = createStockTake('STTest Outlet', '2027-03-01', 1);
  recordStockTakeCount(takeId2, 'STTest Merlot', 45);
  assert.throws(() => completeStockTake(takeId2, 'My Business', 'Actual', 'Miscellaneous', 'Inventory', {}, 1), ValidationError);
});

test('POS terminal: a complete register sale posts the invoice, dispatches stock from the exact location sold at, and allocates payment atomically, with change due calculated correctly', () => {
  createEntity({ name: 'POSTest Outlet', parent: 'Locations' }, 1);
  setLocation('POSTest Outlet', { city: 'POSTest City', location_type: 'Retail', is_billing_address: false, bottle_capacity: 500, carton_capacity: 80 , timezone: 'UTC'});
  createItem('POSTest Merlot', 'Items', 1);
  setItem('POSTest Merlot', { upc: '0123456789012' });
  receiveStockAtLocation('My Business', 'Actual', 'POSTEST-REC-1', 'POSTest Merlot', 'POSTest Outlet', 20, 1, '2027-01-01');

  // Barcode lookup — exact match only.
  const found = getItemByUpc('0123456789012');
  assert.equal(found?.name, 'POSTest Merlot');
  assert.equal(getItemByUpc('9999999999999'), undefined, 'no match for an unknown UPC, not a fuzzy guess');
  assert.equal(getItemByUpc(''), undefined, 'an empty UPC must not match every item with a NULL upc');

  // Cash sale, walk-in, overpaid with a $50 note — change due must be exact.
  const result = completePosSale(
    {
      business: 'My Business',
      ledger: 'Actual',
      locationName: 'POSTest Outlet',
      customerName: 'Cash Sale',
      lines: [{ itemName: 'POSTest Merlot', quantity: 3, unitPriceMinor: 1500, taxMinor: 450 }],
      revenueAccount: 'Sales Revenue',
      taxAccount: 'Sales Tax Payable',
      paymentMethod: 'cash',
      cashTenderedMinor: 5000,
    },
    1
  );
  assert.equal(result.totalMinor, 3 * 1500 + 450, 'quantity * unit price, plus tax');
  assert.equal(result.changeDueMinor, 5000 - (3 * 1500 + 450));

  assert.equal(getItemLocation('POSTest Merlot', 'POSTest Outlet').quantity_on_hand, 17, 'stock dispatched from the exact location sold at, 20 - 3');
  const invoice = getInvoice(result.invoiceId)!;
  assert.equal(invoice.status, 'posted');
  assert.equal(invoice.invoice_date, new Date().toISOString().slice(0, 10), 'omitting transdate must default to today, the ordinary live-sale case');

  assert.equal(getInvoiceOutstandingMinor(result.invoiceId), 0, 'cash sale must be fully paid immediately, not left outstanding');

  // An on-account sale (existing customer, no immediate payment) must
  // NOT auto-allocate payment — it's a normal outstanding invoice.
  createEntity({ name: 'POSTest Account Customer', parent: 'Customers' }, 1);
  setContact('POSTest Account Customer', { payment_terms_days: 30 });
  const onAccountResult = completePosSale(
    {
      business: 'My Business',
      ledger: 'Actual',
      locationName: 'POSTest Outlet',
      customerName: 'POSTest Account Customer',
      lines: [{ itemName: 'POSTest Merlot', quantity: 2, unitPriceMinor: 1500, taxMinor: 300 }],
      revenueAccount: 'Sales Revenue',
      taxAccount: 'Sales Tax Payable',
      // no paymentMethod — on account
    },
    1
  );
  assert.equal(onAccountResult.changeDueMinor, 0);
  assert.equal(getInvoiceOutstandingMinor(onAccountResult.invoiceId), onAccountResult.totalMinor, 'on-account sale must remain fully outstanding, not silently paid');
  assert.equal(getItemLocation('POSTest Merlot', 'POSTest Outlet').quantity_on_hand, 15, 'stock still dispatches even without immediate payment, 17 - 2');

  // Selling more than is on hand at this specific location must be
  // rejected outright, not partially fulfilled or oversold.
  assert.throws(
    () =>
      completePosSale(
        {
          business: 'My Business',
          ledger: 'Actual',
          locationName: 'POSTest Outlet',
          customerName: 'Cash Sale',
          lines: [{ itemName: 'POSTest Merlot', quantity: 999, unitPriceMinor: 1500, taxMinor: 0 }],
          revenueAccount: 'Sales Revenue',
          taxAccount: 'Sales Tax Payable',
          paymentMethod: 'cash',
        },
        1
      ),
    ValidationError
  );
  assert.equal(getItemLocation('POSTest Merlot', 'POSTest Outlet').quantity_on_hand, 15, 'a rejected oversell must leave stock completely untouched, not partially decremented');
});

test('customer self-registration: a customer is a customer — same contact invoices already use, pending until staff verifies, and the real gate blocks on-account selling until then', () => {
  registerCustomer(
    {
      name: 'RegTest Jane Smith',
      email: 'jane@example.com',
      phone: '555-0100',
      password: 'correct horse battery staple',
      card_label: 'Visa ending 4242',
    },
    1
  );

  // It's a real contact, immediately — same table, same mechanism.
  const contact = getContact('RegTest Jane Smith')!;
  assert.equal(contact.email, 'jane@example.com');
  assert.equal(contact.card_label, 'Visa ending 4242');
  assert.equal(contact.verification_status, 'pending');

  // Password never leaks through getContact.
  assert.equal((contact as unknown as { password_hash?: string }).password_hash, undefined);

  // Login works with the right password, not with the wrong one.
  assert.equal(authenticateCustomer('RegTest Jane Smith', 'correct horse battery staple'), true);
  assert.equal(authenticateCustomer('RegTest Jane Smith', 'wrong password'), false);

  // Shows up in the staff queue.
  const pending = listPendingCustomers();
  assert.ok(pending.some((p) => p.name === 'RegTest Jane Smith'));

  // The real gate: still pending, so on-account selling must be
  // rejected outright — even though the customer/contact fully exists.
  createEntity({ name: 'RegTest Outlet', parent: 'Locations' }, 1);
  setLocation('RegTest Outlet', { city: 'RegTest City', location_type: 'Retail', is_billing_address: false, bottle_capacity: 100, carton_capacity: 20 , timezone: 'UTC'});
  createItem('RegTest Wine', 'Items', 1);
  receiveStockAtLocation('My Business', 'Actual', 'REGTEST-REC-1', 'RegTest Wine', 'RegTest Outlet', 10, 1, '2027-01-01');

  assert.throws(
    () =>
      completePosSale(
        {
          business: 'My Business',
          ledger: 'Actual',
          locationName: 'RegTest Outlet',
          customerName: 'RegTest Jane Smith',
          lines: [{ itemName: 'RegTest Wine', quantity: 1, unitPriceMinor: 1000, taxMinor: 0 }],
          revenueAccount: 'Sales Revenue',
          taxAccount: 'Sales Tax Payable',
          // no paymentMethod — on account
        },
        1
      ),
    ValidationError
  );

  // Staff verifies — approved.
  verifyCustomer('RegTest Jane Smith', true);
  assert.equal(getContact('RegTest Jane Smith')!.verification_status, 'active');
  assert.throws(() => verifyCustomer('RegTest Jane Smith', true), ValidationError, 'cannot re-verify an already-decided registration');

  // Now the same on-account sale succeeds.
  const result = completePosSale(
    {
      business: 'My Business',
      ledger: 'Actual',
      locationName: 'RegTest Outlet',
      customerName: 'RegTest Jane Smith',
      lines: [{ itemName: 'RegTest Wine', quantity: 1, unitPriceMinor: 1000, taxMinor: 0 }],
      revenueAccount: 'Sales Revenue',
      taxAccount: 'Sales Tax Payable',
    },
    1
  );
  assert.equal(result.totalMinor, 1000);

  // A staff-created account customer (no self-registration at all) has
  // no verification_status and must remain unrestricted — staff
  // already verified who they are by creating the account directly.
  createEntity({ name: 'RegTest Staff Created Customer', parent: 'Customers' }, 1);
  setContact('RegTest Staff Created Customer', { payment_terms_days: 30 });
  assert.equal(getContact('RegTest Staff Created Customer')!.verification_status, null);
  const staffResult = completePosSale(
    {
      business: 'My Business',
      ledger: 'Actual',
      locationName: 'RegTest Outlet',
      customerName: 'RegTest Staff Created Customer',
      lines: [{ itemName: 'RegTest Wine', quantity: 1, unitPriceMinor: 1000, taxMinor: 0 }],
      revenueAccount: 'Sales Revenue',
      taxAccount: 'Sales Tax Payable',
    },
    1
  );
  assert.equal(staffResult.totalMinor, 1000, 'a staff-created customer with no verification_status must sell on account without any gate');

  // Rejection is a real, distinct outcome too.
  registerCustomer({ name: 'RegTest Rejected Customer', email: 'r@example.com', password: 'x' }, 1);
  verifyCustomer('RegTest Rejected Customer', false);
  assert.equal(getContact('RegTest Rejected Customer')!.verification_status, 'rejected');
  assert.throws(
    () =>
      completePosSale(
        {
          business: 'My Business',
          ledger: 'Actual',
          locationName: 'RegTest Outlet',
          customerName: 'RegTest Rejected Customer',
          lines: [{ itemName: 'RegTest Wine', quantity: 1, unitPriceMinor: 1000, taxMinor: 0 }],
          revenueAccount: 'Sales Revenue',
          taxAccount: 'Sales Tax Payable',
        },
        1
      ),
    ValidationError
  );

  // Registering under a name that already exists must be rejected, not
  // silently overwrite an existing contact.
  assert.throws(() => registerCustomer({ name: 'RegTest Jane Smith', email: 'x@example.com', password: 'x' }, 1), ValidationError);
});

test('closeBooks: year-end close zeroes every Income/Expense account into Retained Earnings as one reversible entry, with the correct sign for both profit and loss', () => {
  createEntity({ name: 'CloseBooks Test Ledger', parent: 'My Business' }, 1);
  createEntity({ name: 'CloseTest Revenue', parent: 'Income' }, 1);
  createEntity({ name: 'CloseTest Expense', parent: 'Expense' }, 1);

  stageLine({ reference: 'CLOSETEST-1', business: 'My Business', ledger: 'CloseBooks Test Ledger', transdate: '2027-01-01', account: 'CloseTest Revenue', amount_minor: -100000 }); // $1,000 revenue
  stageLine({ reference: 'CLOSETEST-1', business: 'My Business', ledger: 'CloseBooks Test Ledger', transdate: '2027-01-01', account: 'Cash and Bank', amount_minor: 100000 });
  postJournalEntry('CLOSETEST-1', 'My Business', 'CloseBooks Test Ledger', 1);

  stageLine({ reference: 'CLOSETEST-2', business: 'My Business', ledger: 'CloseBooks Test Ledger', transdate: '2027-01-02', account: 'CloseTest Expense', amount_minor: 40000 }); // $400 expense
  stageLine({ reference: 'CLOSETEST-2', business: 'My Business', ledger: 'CloseBooks Test Ledger', transdate: '2027-01-02', account: 'Cash and Bank', amount_minor: -40000 });
  postJournalEntry('CLOSETEST-2', 'My Business', 'CloseBooks Test Ledger', 1);

  const retainedBefore = getTrialBalance('My Business', 'CloseBooks Test Ledger').rows.find((r) => r.name === "Owner's Equity");

  const result = closeBooks('My Business', 'CloseBooks Test Ledger', '2027-01-31', "Owner's Equity", 1);
  assert.equal(result.netIncomeMinor, 60000, '$1,000 revenue - $400 expense = $600 net income');
  assert.ok(result.accountsZeroed >= 2);

  const tb = getTrialBalance('My Business', 'CloseBooks Test Ledger');
  assert.equal(tb.rows.find((r) => r.name === 'CloseTest Revenue'), undefined, 'zeroed accounts do not appear in trial balance at all');
  assert.equal(tb.rows.find((r) => r.name === 'CloseTest Expense'), undefined);

  const retainedAfter = tb.rows.find((r) => r.name === "Owner's Equity")!;
  const beforeCredit = retainedBefore?.credit_minor ?? 0;
  const beforeDebit = retainedBefore?.debit_minor ?? 0;
  const netBefore = beforeCredit - beforeDebit;
  const netAfter = retainedAfter.credit_minor - retainedAfter.debit_minor;
  assert.equal(netAfter - netBefore, 60000, 'a genuine profit must increase Retained Earnings (credit) by exactly the net income');

  // Just an ordinary, reversible journal entry — no special mechanism.
  const closeEntry = listJournalEntries('My Business', 'CloseBooks Test Ledger', 50, 0).find((e) => e.reference === result.reference)!;
  reverseJournalEntry('My Business', 'CloseBooks Test Ledger', closeEntry.journal_id, closeEntry.occurrence_date!, 1, '2027-02-01');
  const tbAfterReversal = getTrialBalance('My Business', 'CloseBooks Test Ledger');
  assert.ok(tbAfterReversal.rows.some((r) => r.name === 'CloseTest Revenue'), 'reversing the close entry must bring the P&L accounts back');

  // A period with nothing to close must be rejected, not silently post an empty/meaningless entry.
  closeBooks('My Business', 'CloseBooks Test Ledger', '2027-02-15', "Owner's Equity", 1);
  assert.throws(() => closeBooks('My Business', 'CloseBooks Test Ledger', '2027-03-01', "Owner's Equity", 1), ValidationError);
});

test('getBalanceSheet: a real close must not leave Current Year Earnings still showing the closed period\'s net income — a real, direct regression: the Balance Sheet stopped balancing after excludeCloseEntries was added to getProfitAndLoss for report pages', () => {
  createEntity({ name: 'BSCloseTest Ledger', parent: 'My Business' }, 1);
  createEntity({ name: 'BSCloseTest Revenue', parent: 'Income' }, 1);

  stageLine({ reference: 'BSCT-1', business: 'My Business', ledger: 'BSCloseTest Ledger', transdate: '2027-08-01', account: 'BSCloseTest Revenue', amount_minor: -70000 });
  stageLine({ reference: 'BSCT-1', business: 'My Business', ledger: 'BSCloseTest Ledger', transdate: '2027-08-01', account: 'Cash and Bank', amount_minor: 70000 });
  postJournalEntry('BSCT-1', 'My Business', 'BSCloseTest Ledger', 1);

  const beforeClose = getBalanceSheet('My Business', 'BSCloseTest Ledger', '2027-08-31');
  assert.ok(beforeClose.equity.some((l) => l.name === 'Current Year Earnings'), 'before closing, the real, unclosed period income must show as Current Year Earnings');
  assert.equal(beforeClose.balanced, true);

  closeBooks('My Business', 'BSCloseTest Ledger', '2027-08-31', "Owner's Equity", 1);

  const afterClose = getBalanceSheet('My Business', 'BSCloseTest Ledger', '2027-08-31');
  assert.equal(
    afterClose.equity.some((l) => l.name === 'Current Year Earnings'),
    false,
    "after a real close, there is genuinely nothing left open — Current Year Earnings must not appear at all, not still show the now-closed period's income"
  );
  assert.equal(afterClose.balanced, true, 'the real Balance Sheet must still balance after a close, not double-count net income between Current Year Earnings and the real, already-closed equity line');
  assert.equal(afterClose.total_assets_minor, afterClose.total_liabilities_minor + afterClose.total_equity_minor);
});

test("closeBooks: per direct correction, division is only a real, pure sub-totaling/reporting dimension - every division's net income rolls into the exact same, single, chosen Retained Earnings account, never a separate, division-specific one", () => {
  const biz = createBusiness('MultiDivCloseTest Co', '2027-28', 1);
  createEntity({ name: 'MultiDivCloseTest Retail Division', parent: 'Divisions' }, 1);
  createEntity({ name: 'MultiDivCloseTest Wholesale Division', parent: 'Divisions' }, 1);
  setDivisionType('MultiDivCloseTest Retail Division', 'Profit Center');
  setDivisionType('MultiDivCloseTest Wholesale Division', 'Profit Center');
  createEntity({ name: 'MultiDivCloseTest Retail Outlet', parent: 'Locations' }, 1);
  setLocation('MultiDivCloseTest Retail Outlet', { city: 'MultiDivCloseTest Retail Division', location_type: 'Retail', is_billing_address: false, bottle_capacity: 500, carton_capacity: 80 , timezone: 'UTC'});
  createEntity({ name: 'MultiDivCloseTest Wholesale Outlet', parent: 'Locations' }, 1);
  setLocation('MultiDivCloseTest Wholesale Outlet', { city: 'MultiDivCloseTest Wholesale Division', location_type: 'Retail', is_billing_address: false, bottle_capacity: 500, carton_capacity: 80 , timezone: 'UTC'});
  createItem('MultiDivCloseTest Merlot', 'Items', 1);
  receiveStockAtLocation(biz.business, biz.actualLedger, 'MDCT-REC-A', 'MultiDivCloseTest Merlot', 'MultiDivCloseTest Retail Outlet', 20, 1, '2027-01-01');
  receiveStockAtLocation(biz.business, biz.actualLedger, 'MDCT-REC-B', 'MultiDivCloseTest Merlot', 'MultiDivCloseTest Wholesale Outlet', 20, 1, '2027-01-01');

  // Retail Division: $1,000 revenue (via a real, structural sale).
  // Wholesale Division: $600 revenue. A third line with NO real,
  // structural location at all: $200 revenue.
  completePosSale({ business: biz.business, ledger: biz.actualLedger, locationName: 'MultiDivCloseTest Retail Outlet', customerName: 'Cash Sale', lines: [{ itemName: 'MultiDivCloseTest Merlot', quantity: 1, unitPriceMinor: 100000, taxMinor: 0, tier: 'Bottle' }], taxAccount: 'Sales Tax Payable', paymentMethod: 'cash', cashTenderedMinor: 100000 }, 1);
  completePosSale({ business: biz.business, ledger: biz.actualLedger, locationName: 'MultiDivCloseTest Wholesale Outlet', customerName: 'Cash Sale', lines: [{ itemName: 'MultiDivCloseTest Merlot', quantity: 1, unitPriceMinor: 60000, taxMinor: 0, tier: 'Bottle' }], taxAccount: 'Sales Tax Payable', paymentMethod: 'cash', cashTenderedMinor: 60000 }, 1);

  stageLine({ reference: 'MDCT-3', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-03', account: 'Sales Revenue', amount_minor: -20000 });
  stageLine({ reference: 'MDCT-3', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-03', account: 'Cash and Bank', amount_minor: 20000 });
  postJournalEntry('MDCT-3', biz.business, biz.actualLedger, 1);

  const result = closeBooks(biz.business, biz.actualLedger, '2027-12-31', "Owner's Equity", 1);
  assert.equal(result.netIncomeMinor, 180000, '$1,000 + $600 + $200 = $1,800 total net income, across every division combined');

  const tb = getTrialBalance(biz.business, biz.actualLedger);

  // Per direct correction: no separate, division-specific Retained
  // Earnings account is ever created — every division's own net
  // income, and the undivided remainder, all land in the exact same,
  // single, chosen account.
  assert.equal(tb.rows.find((r) => r.name === "Owner's Equity - MultiDivCloseTest Retail Division"), undefined, 'no separate, division-specific Retained Earnings account is ever created — division is a real, pure reporting dimension, not a structural posting decision');
  assert.equal(tb.rows.find((r) => r.name === "Owner's Equity - MultiDivCloseTest Wholesale Division"), undefined, 'same for Wholesale — nothing division-specific is ever created on the GL side');

  // divisionBreakdown remains a real, purely informational summary —
  // still correctly split for display, just never driving where
  // anything actually posts.
  const retail = result.divisionBreakdown.find((d) => d.division === 'MultiDivCloseTest Retail Division');
  const wholesale = result.divisionBreakdown.find((d) => d.division === 'MultiDivCloseTest Wholesale Division');
  const undivided = result.divisionBreakdown.find((d) => d.division === null);
  assert.equal(retail?.netIncomeMinor, 100000, "divisionBreakdown still reports Retail Division's own real $1,000 net income, for display only, now derived structurally");
  assert.equal(wholesale?.netIncomeMinor, 60000, "divisionBreakdown still reports Wholesale Division's own real $600 net income, for display only");
  assert.equal(undivided?.netIncomeMinor, 20000, 'divisionBreakdown still reports the real, undivided $200 remainder under a null division, for display only');
});

test('getBalanceSheet includes real AR/AP posted directly to customer/vendor names — without this, any ledger with outstanding AR/AP silently fails to balance', () => {
  createEntity({ name: 'BSTest Ledger', parent: 'My Business' }, 1);
  createEntity({ name: 'BSTest Vendor', parent: 'Vendors' }, 1);
  setContact('BSTest Vendor', { payment_terms_days: 30 });

  stageLine({ reference: 'BSTEST-1', business: 'My Business', ledger: 'BSTest Ledger', transdate: '2027-01-01', account: 'Inventory', amount_minor: 50000 });
  stageLine({ reference: 'BSTEST-1', business: 'My Business', ledger: 'BSTest Ledger', transdate: '2027-01-01', account: 'BSTest Vendor', amount_minor: -50000 });
  postJournalEntry('BSTEST-1', 'My Business', 'BSTest Ledger', 1);

  const bs = getBalanceSheet('My Business', 'BSTest Ledger');
  assert.equal(bs.balanced, true, 'a ledger with real, unpaid AP must still balance once AR/AP is correctly included');
  const ap = bs.liabilities.find((l) => l.name === 'Accounts Payable');
  assert.ok(ap, 'Accounts Payable must appear as a real liability line');
  assert.equal(ap!.credit_minor - ap!.debit_minor, 50000);
  assert.equal(bs.total_assets_minor, bs.total_liabilities_minor + bs.total_equity_minor);

  // Once paid, Accounts Payable must disappear (net zero), not linger.
  stageLine({ reference: 'BSTEST-2', business: 'My Business', ledger: 'BSTest Ledger', transdate: '2027-01-15', account: 'BSTest Vendor', amount_minor: 50000 });
  stageLine({ reference: 'BSTEST-2', business: 'My Business', ledger: 'BSTest Ledger', transdate: '2027-01-15', account: 'Cash and Bank', amount_minor: -50000 });
  postJournalEntry('BSTEST-2', 'My Business', 'BSTest Ledger', 1);
  const bsAfterPayment = getBalanceSheet('My Business', 'BSTest Ledger');
  assert.equal(bsAfterPayment.liabilities.find((l) => l.name === 'Accounts Payable'), undefined, 'once fully paid, AP nets to zero and must not appear at all');
  assert.equal(bsAfterPayment.balanced, true);
});

test('completePosSale honors an explicit transdate instead of always using the real current date — the actual bug that broke every backdated/simulated sale', () => {
  createEntity({ name: 'POSDateTest Outlet', parent: 'Locations' }, 1);
  setLocation('POSDateTest Outlet', { city: 'POSDateTest City', location_type: 'Retail', is_billing_address: false, bottle_capacity: 100, carton_capacity: 20 , timezone: 'UTC'});
  createItem('POSDateTest Wine', 'Items', 1);
  receiveStockAtLocation('My Business', 'Actual', 'POSDATETEST-REC-1', 'POSDateTest Wine', 'POSDateTest Outlet', 10, 1, '2027-01-01');

  const result = completePosSale(
    {
      business: 'My Business',
      ledger: 'Actual',
      locationName: 'POSDateTest Outlet',
      customerName: 'Cash Sale',
      lines: [{ itemName: 'POSDateTest Wine', quantity: 1, unitPriceMinor: 1500, taxMinor: 0 }],
      revenueAccount: 'Sales Revenue',
      taxAccount: 'Sales Tax Payable',
      paymentMethod: 'cash',
      transdate: '2027-06-15',
    },
    1
  );
  const invoice = getInvoice(result.invoiceId)!;
  assert.equal(invoice.invoice_date, '2027-06-15', 'an explicit transdate must be honored exactly, not silently replaced with the real current date');

  const withoutDate = completePosSale(
    {
      business: 'My Business',
      ledger: 'Actual',
      locationName: 'POSDateTest Outlet',
      customerName: 'Cash Sale',
      lines: [{ itemName: 'POSDateTest Wine', quantity: 1, unitPriceMinor: 1500, taxMinor: 0 }],
      revenueAccount: 'Sales Revenue',
      taxAccount: 'Sales Tax Payable',
      paymentMethod: 'cash',
    },
    1
  );
  const invoiceWithoutDate = getInvoice(withoutDate.invoiceId)!;
  assert.equal(invoiceWithoutDate.invoice_date, new Date().toISOString().slice(0, 10), 'omitting transdate must still default to today, the ordinary live-sale case');
});

test('completePosSale: a real, immediate cash sale never touches the customer\'s own AR balance at all, even momentarily — the exact question directly asked and confirmed: "why are cash sales going through the AR system in any way?"', () => {
  createEntity({ name: 'CashARTest Outlet', parent: 'Locations' }, 1);
  setLocation('CashARTest Outlet', { city: 'CashARTest City', location_type: 'Retail', is_billing_address: false, bottle_capacity: 100, carton_capacity: 20 , timezone: 'UTC'});
  createItem('CashARTest Wine', 'Items', 1);
  receiveStockAtLocation('My Business', 'Actual', 'CASHARTEST-REC-1', 'CashARTest Wine', 'CashARTest Outlet', 10, 1, '2027-01-01');
  createEntity({ name: 'CashARTest Customer', parent: 'Customers' }, 1);

  const result = completePosSale(
    {
      business: 'My Business',
      ledger: 'Actual',
      locationName: 'CashARTest Outlet',
      customerName: 'CashARTest Customer',
      lines: [{ itemName: 'CashARTest Wine', quantity: 1, unitPriceMinor: 1500, taxMinor: 0 }],
      revenueAccount: 'Sales Revenue',
      taxAccount: 'Sales Tax Payable',
      paymentMethod: 'cash',
      transdate: '2027-06-15',
    },
    1
  );

  // The real invoice record itself still correctly names the real customer — only the GL posting changed.
  const invoice = getInvoice(result.invoiceId)!;
  assert.equal(invoice.counterparty, 'CashARTest Customer');

  // The real, direct proof: the customer's own AR account balance must be exactly zero — never genuinely held a balance, not even momentarily.
  const custBalance = db.prepare(`SELECT balance_minor FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name = 'CashARTest Customer')`).get() as
    | { balance_minor: number }
    | undefined;
  assert.equal(custBalance?.balance_minor ?? 0, 0, "a real, immediate cash sale must never leave any real balance on the customer's own AR account");

  // No separate, redundant -PAYMENT journal entry either — the cash posting happened once, directly.
  const paymentJournal = db.prepare(`SELECT 1 FROM journal WHERE reference = ?`).get(`${result.reference}-PAYMENT`);
  assert.equal(paymentJournal, undefined, 'a real, immediate cash sale must not post a second, redundant journal entry for the same real cash movement');

  // Outstanding must still correctly show zero — the allocation record itself is still real, just without a second journal posting.
  assert.equal(getInvoiceOutstandingMinor(result.invoiceId), 0);

  // Cash and Bank must show the real, full sale amount, posted directly.
  const cashLine = db.prepare(`SELECT amount_minor FROM journal_line jl JOIN journal j ON j.id = jl.journal_id JOIN current_entities e ON e.id = jl.account_id WHERE j.reference = ? AND e.name = 'Cash and Bank'`).get(
    result.reference
  ) as { amount_minor: number };
  assert.equal(cashLine.amount_minor, result.totalMinor, "Cash and Bank must be debited the real, full sale amount directly, in the same posting as the sale itself");
});

test('completeCashPurchase: a real, immediate cash purchase never touches the vendor\'s own AP balance at all, even momentarily — the direct counteritem to completePosSale, for a real, immediate purchase', () => {
  createEntity({ name: 'CashPurTest Warehouse', parent: 'Locations' }, 1);
  setLocation('CashPurTest Warehouse', { city: 'CashPurTest City', location_type: 'Warehouse', is_billing_address: false, bottle_capacity: 0, carton_capacity: 5000 , timezone: 'UTC'});
  createEntity({ name: 'CashPurTest Vendor', parent: 'Vendors' }, 1);
  createItem('CashPurTest Wine', 'Items', 1);

  const before = getItemLocation('CashPurTest Wine', 'CashPurTest Warehouse').quantity_on_hand;
  const result = completeCashPurchase(
    {
      business: 'My Business',
      ledger: 'Actual',
      locationName: 'CashPurTest Warehouse',
      vendorName: 'CashPurTest Vendor',
      paymentMethod: 'cash',
      lines: [{ itemName: 'CashPurTest Wine', quantity: 24, unitPriceMinor: 1500, taxMinor: 0 }],
      taxAccount: 'Sales Tax Payable',
    },
    1
  );

  assert.equal(getItemLocation('CashPurTest Wine', 'CashPurTest Warehouse').quantity_on_hand, before + 24, 'real, physical stock must actually be received at the real, chosen location');
  const invoice = getInvoice(result.invoiceId)!;
  assert.equal(invoice.status, 'posted');
  assert.equal(invoice.total_amount_minor, result.totalMinor);
  assert.equal(getInvoiceOutstandingMinor(result.invoiceId), 0, 'a real, immediate cash purchase must show zero outstanding — no genuine payable, even momentarily');

  const vendorBalance = (
    db.prepare(`SELECT balance_minor FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name = 'CashPurTest Vendor')`).get() as
      | { balance_minor: number }
      | undefined
  )?.balance_minor;
  assert.equal(vendorBalance ?? 0, 0, "the vendor's own real AP balance must never move at all for a real, immediate cash purchase");

  const cashLine = db.prepare(
    `SELECT jl.amount_minor FROM journal_line jl JOIN journal j ON j.id = jl.journal_id JOIN current_entities e ON e.id = jl.account_id WHERE j.reference = ? AND e.name = 'Cash and Bank'`
  ).get(result.reference) as { amount_minor: number };
  assert.equal(cashLine.amount_minor, -result.totalMinor, "Cash and Bank must be credited the real, full purchase amount directly, in the same posting as the purchase itself");
});

test('payEmployeeWages: a real employee treated as AP — real Medicare levy withheld from their own pay, real superannuation as a genuine, separate employer cost, hourly or salaried', () => {
  createEntity({ name: 'WageTest Employee', parent: 'Employees' }, 1);
  setContact('WageTest Employee', { wage_minor_per_hour: 3000 }); // $30.00/hour

  function balanceOf(accountName: string): number {
    return (
      (db.prepare(`SELECT balance_minor FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name = ?)`).get(accountName) as
        | { balance_minor: number }
        | undefined)?.balance_minor ?? 0
    );
  }

  // No real wage or salary configured yet — a real, clear error, not a silent $0.
  createEntity({ name: 'WageTest No Rate Employee', parent: 'Employees' }, 1);
  assert.throws(
    () => payEmployeeWages({ business: 'My Business', ledger: 'Actual', employeeName: 'WageTest No Rate Employee', hours: 8 }, 1),
    ValidationError,
    'a real employee with no configured wage rate or salary must be refused with a clear, honest error, not silently paid $0'
  );

  // Hourly, on-account — real Medicare levy withheld, real super as a separate employer cost.
  const before = getCreditStatus('WageTest Employee');
  assert.equal(before.balanceMinor, 0);
  const result = payEmployeeWages({ business: 'My Business', ledger: 'Actual', employeeName: 'WageTest Employee', hours: 8 }, 1);
  assert.equal(result.grossMinor, 24000, '8 real hours at $30.00/hour must gross exactly $240.00');
  assert.equal(result.medicareLevyMinor, 360, 'a real 1.5% Medicare levy on $240.00 must be exactly $3.60');
  assert.equal(result.superannuationMinor, 2880, 'a real 12% superannuation contribution on $240.00 must be exactly $28.80');
  assert.equal(result.netMinor, 23640, "the employee's own real net pay must be gross minus the real Medicare levy withheld");

  const after = getCreditStatus('WageTest Employee');
  assert.equal(after.balanceMinor, result.netMinor, "the employee's own real AP balance must reflect real NET pay owed — gross posted, then the real Medicare levy immediately withheld back out");
  const invoice = getInvoice(result.invoiceId)!;
  assert.equal(invoice.status, 'posted');
  assert.equal(invoice.invoice_type, 'AP', 'an employee wage payment must be a real AP invoice, the same real mechanism a vendor invoice already uses');
  assert.equal(balanceOf('Medicare Levy Payable'), -result.medicareLevyMinor, 'the real Medicare levy withheld must be a real, separate liability owed to the ATO, not a cost to the business');
  assert.equal(balanceOf('Superannuation Payable'), -result.superannuationMinor, 'the real superannuation contribution must be a real, separate liability owed to a real super fund');
  assert.equal(balanceOf('Superannuation Expense'), result.superannuationMinor, 'real superannuation must be a real, genuine, ADDITIONAL cost to the business, on top of gross wages, never touching the employee\'s own balance');

  // Immediate cash/EFT payment — pays the real NET amount, not gross, since Medicare was already withheld.
  const cashResult = payEmployeeWages({ business: 'My Business', ledger: 'Actual', employeeName: 'WageTest Employee', hours: 4, paymentMethod: 'cash' }, 1);
  assert.equal(cashResult.netMinor, 11820);
  assert.equal(getInvoiceOutstandingMinor(cashResult.invoiceId), cashResult.grossMinor - cashResult.netMinor, 'an immediate cash wage payment pays only the real NET amount — the invoice itself still shows the real Medicare levy portion as its own, separate, already-settled reduction, not literally zero');

  // A real, salaried manager — no hours, a real, fixed monthly amount instead.
  createEntity({ name: 'WageTest Manager', parent: 'Employees' }, 1);
  setContact('WageTest Manager', { salary_minor_per_year: 9600000 }); // $96,000.00/year
  assert.throws(
    () => payEmployeeWages({ business: 'My Business', ledger: 'Actual', employeeName: 'WageTest Manager', hours: 10 }, 1),
    ValidationError,
    'a real, salaried employee must refuse an hours argument as a real, honest mismatch, not silently ignore it'
  );
  const salaryResult = payEmployeeWages({ business: 'My Business', ledger: 'Actual', employeeName: 'WageTest Manager' }, 1);
  assert.equal(salaryResult.grossMinor, 800000, 'one real month of a $96,000.00/year salary must be exactly $8,000.00');
});

test('getOrganizationChart: the real, complete chain — Business belongs-to Division belongs-to Location, employees placed at either a real location or the business itself', () => {
  createEntity({ name: 'OrgChartTest Co', parent: 'Businesses' }, 1);
  createEntity({ name: 'OrgChartTest Region', parent: 'Divisions' }, 1);
  createEntity({ name: 'OrgChartTest Store', parent: 'Locations' }, 1);
  createEntity({ name: 'OrgChartTest Retail Staff', parent: 'Employees' }, 1);
  createEntity({ name: 'OrgChartTest CEO', parent: 'Employees' }, 1);

  setRelationship('OrgChartTest Region', 'Belongs To Business', 'OrgChartTest Co', 1);
  setRelationship('OrgChartTest Store', 'Belongs To Division', 'OrgChartTest Region', 1);
  setRelationship('OrgChartTest Retail Staff', 'Place of Employment', 'OrgChartTest Store', 1);
  setRelationship('OrgChartTest CEO', 'Place of Employment', 'OrgChartTest Co', 1);

  const chart = getOrganizationChart('OrgChartTest Co');
  assert.equal(chart.business, 'OrgChartTest Co');
  assert.deepEqual(chart.companyWideEmployees, ['OrgChartTest CEO'], "an employee whose place of employment is the business itself must appear as real, genuine company-wide staff, not nested under any single location");
  assert.equal(chart.divisions.length, 1);
  assert.equal(chart.divisions[0].division, 'OrgChartTest Region');
  assert.equal(chart.divisions[0].locations.length, 1);
  assert.equal(chart.divisions[0].locations[0].location, 'OrgChartTest Store');
  assert.deepEqual(chart.divisions[0].locations[0].employees, ['OrgChartTest Retail Staff']);

  // A real, direct confirmation of the underlying design: none of
  // this real relationship structure ever touched anyone's own real
  // parent_id — every entity above is still exactly where its own
  // real category put it.
  const tree = getEntityTree();
  const store = tree.find((e) => e.name === 'OrgChartTest Store')!;
  const storeParent = tree.find((e) => e.id === store.parent_id)!;
  assert.equal(storeParent.name, 'Locations', "a location's own real parent_id must stay under Locations, unchanged — the organizational chain is a real, separate relationship layer, not a reparenting");
});


test('e-invoicing: a real, posted invoice exports as a real UBL 2.1 document, and a real, incoming one round-trips back through a genuinely separate ledger as a draft, never auto-posted', () => {
  createEntity({ name: 'EInvTest Ledger', parent: 'My Business' }, 1);
  createEntity({ name: 'EInvTest Customer', parent: 'Customers' }, 1);
  const invoiceId = createInvoice(
    {
      invoiceType: 'AR',
      business: 'My Business',
      ledger: 'EInvTest Ledger',
      reference: 'EINV-TEST-1',
      counterpartyName: 'EInvTest Customer',
      invoiceDate: '2027-05-01',
      lines: [{ description: 'Consulting hours', quantity: 3, unitPriceMinor: 15000, amountMinor: 45000, taxMinor: 4500 }],
    },
    1
  );
  assert.throws(() => exportInvoiceAsUbl(invoiceId), ValidationError, 'a real, unposted draft must not be exportable as a real e-invoice yet');
  postInvoice(invoiceId, 'Sales Revenue', 'Sales Tax Payable', 1);

  const xml = exportInvoiceAsUbl(invoiceId);
  assert.ok(xml.includes('<cbc:ID>EINV-TEST-1</cbc:ID>'), 'the real, exported document must carry the real invoice reference');
  assert.ok(xml.includes('450.00'), 'the real line amount must appear as a real, formatted currency value');

  // A genuinely separate receiving ledger — the real, realistic case, not importing back into the same books it came from.
  createEntity({ name: 'EInvTest Receiving Ledger', parent: 'My Business' }, 1);
  createEntity({ name: 'EInvTest Vendor', parent: 'Vendors' }, 1);
  const result = importUblInvoiceAsDraft(xml, 'My Business', 'EInvTest Receiving Ledger', 'EInvTest Vendor', 1);

  const imported = getInvoice(result.invoiceId)!;
  assert.equal(imported.status, 'draft', 'a real, imported e-invoice must never be auto-posted — the existing draft state is the real approval gate');
  assert.equal(imported.reference, 'EINV-TEST-1');
  assert.equal(imported.total_amount_minor, 45000, "the real, round-tripped total must exactly match the original invoice's own amount");
  assert.equal(imported.lines.length, 1);
  assert.equal(imported.lines[0].quantity, 3);
  assert.equal(imported.lines[0].unitPriceMinor, 15000);
  assert.equal(result.discrepancies.length, 0, 'no PO reference given — no real discrepancy to report');
});

test('e-invoicing: a real 3-way match catches a genuine mismatch between a purchase order and an incoming e-invoice', () => {
  createEntity({ name: 'EInvDiscTest Ledger', parent: 'My Business' }, 1);
  createEntity({ name: 'EInvDiscTest Vendor', parent: 'Vendors' }, 1);
  createEntity({ name: 'EInvDiscTest Item', parent: 'Items' }, 1);

  stagePurchaseOrder({ reference: 'EIDT-PO-1', business: 'My Business', ledger: 'EInvDiscTest Ledger', vendor: 'EInvDiscTest Vendor', item: 'EInvDiscTest Item', quantity: 10, price_minor: 5000, transdate: '2027-05-01' });
  postPurchaseOrder('EIDT-PO-1', 'My Business', 'EInvDiscTest Ledger', 1);

  // A real, incoming e-invoice for $750 against a real $500 PO — a genuine, deliberate mismatch.
  const mismatchedXml = `<?xml version="1.0"?><Invoice><cbc:ID>SUPP-INV-99</cbc:ID><cbc:IssueDate>2027-05-05</cbc:IssueDate>
    <cac:AccountingSupplierParty><cac:Party><cac:PartyName><cbc:Name>EInvDiscTest Vendor</cbc:Name></cac:PartyName></cac:Party></cac:AccountingSupplierParty>
    <cbc:TaxAmount>0</cbc:TaxAmount><cbc:PayableAmount>750.00</cbc:PayableAmount>
    <cac:InvoiceLine><cbc:InvoicedQuantity>10</cbc:InvoicedQuantity><cbc:LineExtensionAmount>750.00</cbc:LineExtensionAmount><cac:Item><cbc:Name>EInvDiscTest Item</cbc:Name></cac:Item><cac:Price><cbc:PriceAmount>75.00</cbc:PriceAmount></cac:Price></cac:InvoiceLine>
    </Invoice>`;

  const result = importUblInvoiceAsDraft(mismatchedXml, 'My Business', 'EInvDiscTest Ledger', 'EInvDiscTest Vendor', 1, 'EIDT-PO-1');
  assert.equal(result.discrepancies.length, 1);
  assert.equal(result.discrepancies[0].field, 'Total amount');
  assert.equal(result.discrepancies[0].poValue, '500.00');
  assert.equal(result.discrepancies[0].invoiceValue, '750.00');

  const imported = getInvoice(result.invoiceId)!;
  assert.ok(imported.description.includes('discrepancy'), "a real discrepancy must be recorded directly in the draft's own description, immediately visible to whoever reviews it");
  assert.equal(imported.status, 'draft', 'a real discrepancy must never silently block the import — it must land as a real, reviewable draft, not be refused outright');
});

test('getStockListing/countStockListing: a real, paginated listing of every item/location combination with stock', () => {
  createEntity({ name: 'StockListTest Outlet', parent: 'Locations' }, 1);
  setLocation('StockListTest Outlet', { city: 'StockListTest City', location_type: 'Retail', is_billing_address: false, bottle_capacity: 100, carton_capacity: 20 , timezone: 'UTC'});
  createItem('StockListTest Wine', 'Items', 1);
  receiveStockAtLocation('My Business', 'Actual', 'STOCKLISTTEST-REC-1', 'StockListTest Wine', 'StockListTest Outlet', 15, 1, '2027-01-01');

  const countBefore = countStockListing();
  const listing = getStockListing(1000, 0);
  assert.equal(listing.length, countBefore, 'the listing must return exactly as many rows as the count reports, at a large enough page size');

  const row = listing.find((r) => r.item === 'StockListTest Wine' && r.location === 'StockListTest Outlet');
  assert.ok(row, 'the new item/location combination must appear in the listing');
  assert.equal(row!.quantity_on_hand, 15);
  assert.equal(row!.min_level, null, 'min_level must be present (even if unset) — the Stock Listing page edits it directly');
  assert.equal(row!.max_level, null);
  assert.equal(row!.reorder_level, null);

  setItemLocationLevels('StockListTest Wine', 'StockListTest Outlet', { minLevel: 5, maxLevel: 50, reorderLevel: 10 });
  const listingAfter = getStockListing(1000, 0);
  const rowAfter = listingAfter.find((r) => r.item === 'StockListTest Wine' && r.location === 'StockListTest Outlet');
  assert.equal(rowAfter!.min_level, 5, 'min/max/reorder set via setItemLocationLevels must actually show up in the listing the UI reads');
  assert.equal(rowAfter!.max_level, 50);
  assert.equal(rowAfter!.reorder_level, 10);

  // Real pagination — a page of exactly 1 must return exactly 1 row, and offsetting must move to a different row.
  const page1 = getStockListing(1, 0);
  const page2 = getStockListing(1, 1);
  assert.equal(page1.length, 1);
  assert.equal(page2.length, 1);
  assert.notDeepEqual(page1[0], page2[0], 'different offsets must return different rows, not the same page twice');
});

test('getStockListingByLocation: groups the same real stock data by real location, tagging each with its real division where one exists', () => {
  createEntity({ name: 'StockGroupTest City Division', parent: 'Divisions' }, 1);
  setDivisionType('StockGroupTest City Division', 'Profit Center');
  createEntity({ name: 'StockGroupTest Outlet', parent: 'Locations' }, 1);
  setLocation('StockGroupTest Outlet', { city: 'StockGroupTest City Division', location_type: 'Retail', is_billing_address: false, bottle_capacity: 100, carton_capacity: 20 , timezone: 'UTC'});
  createItem('StockGroupTest Wine A', 'Items', 1);
  createItem('StockGroupTest Wine B', 'Items', 1);
  receiveStockAtLocation('My Business', 'Actual', 'STOCKGROUPTEST-REC-1', 'StockGroupTest Wine A', 'StockGroupTest Outlet', 10, 1, '2027-01-01');
  receiveStockAtLocation('My Business', 'Actual', 'STOCKGROUPTEST-REC-2', 'StockGroupTest Wine B', 'StockGroupTest Outlet', 7, 1, '2027-01-01');

  const groups = getStockListingByLocation();
  const group = groups.find((g) => g.location === 'StockGroupTest Outlet');
  assert.ok(group, 'the real, new location must appear as its own real group');
  assert.equal(group!.city, 'StockGroupTest City Division');
  // Real division tagging: the location's city exactly matches a real division's own name, so it must be tagged with it — not left null just because no code path explicitly wired the two together.
  assert.equal(group!.division, 'StockGroupTest City Division', "a location's real city matching a real division's name must tag the group with it, via the same cityDivisionFor logic a real sale uses");
  assert.equal(group!.rows.length, 2, 'both real items received at this location must appear as real rows within the group');
  assert.equal(group!.total_on_hand, 17, "a group's own total must be the real sum of its real rows' on-hand quantities");

  // A location whose city has no matching real division must still appear as a real group — just with division: null, not silently dropped.
  createEntity({ name: 'StockGroupTest Outlet No Division', parent: 'Locations' }, 1);
  setLocation('StockGroupTest Outlet No Division', { city: 'A City With No Real Division', location_type: 'Retail', is_billing_address: false, bottle_capacity: 100, carton_capacity: 20 , timezone: 'UTC'});
  receiveStockAtLocation('My Business', 'Actual', 'STOCKGROUPTEST-REC-3', 'StockGroupTest Wine A', 'StockGroupTest Outlet No Division', 3, 1, '2027-01-01');
  const groupsAfter = getStockListingByLocation();
  const noDivisionGroup = groupsAfter.find((g) => g.location === 'StockGroupTest Outlet No Division');
  assert.ok(noDivisionGroup, 'a real location must still produce a real group even with no matching division');
  assert.equal(noDivisionGroup!.division, null);
});

test('getLedgerDateRange: reports the real, earliest and latest transdate of what has actually been posted', () => {
  createEntity({ name: 'DateRangeTest Ledger', parent: 'My Business' }, 1);
  const empty = getLedgerDateRange('My Business', 'DateRangeTest Ledger');
  assert.equal(empty.earliest, null, 'a real ledger with nothing posted yet must report a real null range, not a misleading fallback date');
  assert.equal(empty.latest, null);

  function post(reference: string, transdate: string, lines: { account: string; amount_minor: number }[]) {
    for (const line of lines) {
      stageLine({ reference, business: 'My Business', ledger: 'DateRangeTest Ledger', transdate, account: line.account, amount_minor: line.amount_minor });
    }
    postJournalEntry(reference, 'My Business', 'DateRangeTest Ledger', 1);
  }
  post('DRT-1', '2027-05-10', [
    { account: 'Cash and Bank', amount_minor: 1000 },
    { account: "Owner's Equity", amount_minor: -1000 },
  ]);
  post('DRT-2', '2027-05-03', [
    { account: 'Cash and Bank', amount_minor: 500 },
    { account: "Owner's Equity", amount_minor: -500 },
  ]);
  post('DRT-3', '2027-05-20', [
    { account: 'Cash and Bank', amount_minor: 200 },
    { account: "Owner's Equity", amount_minor: -200 },
  ]);

  const range = getLedgerDateRange('My Business', 'DateRangeTest Ledger');
  assert.equal(range.earliest, '2027-05-03', 'must be the real minimum transdate across every real posted entry, not just the first one posted');
  assert.equal(range.latest, '2027-05-20', 'must be the real maximum, regardless of posting order');
});

test('getAccountsPostedTo: finds the real, actual accounts a given reference posted to — used to correct a return to the exact same account the original sale used, not a different, plain fallback', () => {
  createEntity({ name: 'AcctsPostedTest Ledger', parent: 'My Business' }, 1);
  createEntity({ name: 'AcctsPostedTest Revenue (Tier A)', parent: 'Income' }, 1);
  stageLine({ reference: 'APT-1', business: 'My Business', ledger: 'AcctsPostedTest Ledger', transdate: '2027-06-01', account: 'AcctsPostedTest Revenue (Tier A)', amount_minor: -5000 });
  stageLine({ reference: 'APT-1', business: 'My Business', ledger: 'AcctsPostedTest Ledger', transdate: '2027-06-01', account: 'Cash and Bank', amount_minor: 5000 });
  postJournalEntry('APT-1', 'My Business', 'AcctsPostedTest Ledger', 1);

  const accounts = getAccountsPostedTo('APT-1');
  assert.ok(accounts.includes('AcctsPostedTest Revenue (Tier A)'), 'must find the real, specific account actually posted to, not a generic or reconstructed one');
  assert.ok(accounts.includes('Cash and Bank'));
  assert.equal(accounts.length, 2, "must report every real, distinct account this reference touched, not just the first one it happens to find");

  assert.deepEqual(getAccountsPostedTo('APT-NONEXISTENT'), [], 'a reference that was never posted must report a real, empty list, not throw or return a misleading fallback');
});

test('a real, nested division hierarchy: filtering a report by a coarser division must include a finer, nested division\'s own real activity too, not just an exact division_id match', () => {
  createEntity({ name: 'HierarchyTest Ledger', parent: 'My Business' }, 1);
  createEntity({ name: 'HierarchyTest Region', parent: 'Divisions' }, 1);
  setDivisionType('HierarchyTest Region', 'Profit Center');
  createEntity({ name: 'HierarchyTest Outlet', parent: 'HierarchyTest Region' }, 1);
  setDivisionType('HierarchyTest Outlet', 'Profit Center');
  createEntity({ name: 'HierarchyTest Revenue', parent: 'Income' }, 1);

  function post(reference: string, division: string, amount: number) {
    stageLine({ reference, business: 'My Business', ledger: 'HierarchyTest Ledger', transdate: '2027-07-01', account: 'HierarchyTest Revenue', amount_minor: -amount, division });
    stageLine({ reference, business: 'My Business', ledger: 'HierarchyTest Ledger', transdate: '2027-07-01', account: 'Cash and Bank', amount_minor: amount, division });
    postJournalEntry(reference, 'My Business', 'HierarchyTest Ledger', 1);
  }
  post('HT-1', 'HierarchyTest Outlet', 30000); // the finer, nested division
  post('HT-2', 'HierarchyTest Region', 5000); // real activity tagged directly at the coarser level too (e.g. a region-wide adjustment)

  const outletOnly = getProfitAndLoss('My Business', 'HierarchyTest Ledger', undefined, undefined, 'HierarchyTest Outlet');
  assert.equal(outletOnly.total_income_minor, 30000, 'filtering by the finer division must show only its own real activity');

  const regionAll = getProfitAndLoss('My Business', 'HierarchyTest Ledger', undefined, undefined, 'HierarchyTest Region');
  assert.equal(regionAll.total_income_minor, 35000, "filtering by the coarser division must include BOTH its own direct activity AND its real, nested division's activity — the exact hierarchical behavior per-location P&L depends on");
});

test('postJournalEntry: a real multi-currency entry must balance independently per currency — the exact danger this catches: an EUR imbalance masked by an offsetting USD imbalance must never pass', () => {
  createEntity({ name: 'CcyTest Ledger', parent: 'My Business' }, 1);
  createEntity({ name: 'CcyTest Cash (EUR)', parent: 'Asset' }, 1);
  createEntity({ name: 'CcyTest Clearing (EUR)', parent: 'Asset' }, 1);
  createEntity({ name: 'CcyTest Cash (USD)', parent: 'Asset' }, 1);
  createEntity({ name: 'CcyTest Clearing (USD)', parent: 'Asset' }, 1);
  setAccountCurrency('CcyTest Cash (EUR)', 'EUR');
  setAccountCurrency('CcyTest Clearing (EUR)', 'EUR');
  setAccountCurrency('CcyTest Cash (USD)', 'USD');
  setAccountCurrency('CcyTest Clearing (USD)', 'USD');

  // A genuinely valid multi-currency entry: one entry, one reference, two independently-balanced currency groups.
  stageLine({ reference: 'CCY-GOOD-1', business: 'My Business', ledger: 'CcyTest Ledger', transdate: '2027-01-01', account: 'CcyTest Cash (EUR)', amount_minor: 100000 });
  stageLine({ reference: 'CCY-GOOD-1', business: 'My Business', ledger: 'CcyTest Ledger', transdate: '2027-01-01', account: 'CcyTest Clearing (EUR)', amount_minor: -100000 });
  stageLine({ reference: 'CCY-GOOD-1', business: 'My Business', ledger: 'CcyTest Ledger', transdate: '2027-01-01', account: 'CcyTest Clearing (USD)', amount_minor: 109000 });
  stageLine({ reference: 'CCY-GOOD-1', business: 'My Business', ledger: 'CcyTest Ledger', transdate: '2027-01-01', account: 'CcyTest Cash (USD)', amount_minor: -109000 });
  postJournalEntry('CCY-GOOD-1', 'My Business', 'CcyTest Ledger', 1);
  const tb = getTrialBalance('My Business', 'CcyTest Ledger');
  const eurCash = tb.rows.find((r) => r.name === 'CcyTest Cash (EUR)');
  assert.equal(eurCash?.debit_minor, 100000, 'a genuinely valid multi-currency entry must post successfully');

  // The real danger: EUR group off by $1.00, USD group off by exactly the opposite — sums to zero OVERALL, but must still be rejected.
  stageLine({ reference: 'CCY-BAD-1', business: 'My Business', ledger: 'CcyTest Ledger', transdate: '2027-01-02', account: 'CcyTest Cash (EUR)', amount_minor: 100000 });
  stageLine({ reference: 'CCY-BAD-1', business: 'My Business', ledger: 'CcyTest Ledger', transdate: '2027-01-02', account: 'CcyTest Clearing (EUR)', amount_minor: -99900 }); // short by 100
  stageLine({ reference: 'CCY-BAD-1', business: 'My Business', ledger: 'CcyTest Ledger', transdate: '2027-01-02', account: 'CcyTest Clearing (USD)', amount_minor: 109000 });
  stageLine({ reference: 'CCY-BAD-1', business: 'My Business', ledger: 'CcyTest Ledger', transdate: '2027-01-02', account: 'CcyTest Cash (USD)', amount_minor: -109100 }); // over by 100 — cancels the EUR error overall
  assert.throws(() => postJournalEntry('CCY-BAD-1', 'My Business', 'CcyTest Ledger', 1), /does not balance/i);

  // An ordinary, single-currency (home/NULL) entry must be completely unaffected.
  stageLine({ reference: 'CCY-HOME-1', business: 'My Business', ledger: 'CcyTest Ledger', transdate: '2027-01-03', account: 'Cash and Bank', amount_minor: 5000 });
  stageLine({ reference: 'CCY-HOME-1', business: 'My Business', ledger: 'CcyTest Ledger', transdate: '2027-01-03', account: 'Sales Revenue', amount_minor: -5000 });
  postJournalEntry('CCY-HOME-1', 'My Business', 'CcyTest Ledger', 1);
});

test('getProfitAndLoss: Gross Profit is a real subtotal (Revenue minus COGS specifically), Net Profit unchanged — via the real, bootstrap-tagged COGS account, not a test-only setup', () => {
  createEntity({ name: 'GrossProfit Test Ledger', parent: 'My Business' }, 1);

  stageLine({ reference: 'GPTEST-1', business: 'My Business', ledger: 'GrossProfit Test Ledger', transdate: '2027-01-01', account: 'Sales Revenue', amount_minor: -100000 });
  stageLine({ reference: 'GPTEST-1', business: 'My Business', ledger: 'GrossProfit Test Ledger', transdate: '2027-01-01', account: 'Cash and Bank', amount_minor: 100000 });
  postJournalEntry('GPTEST-1', 'My Business', 'GrossProfit Test Ledger', 1);

  stageLine({ reference: 'GPTEST-2', business: 'My Business', ledger: 'GrossProfit Test Ledger', transdate: '2027-01-02', account: 'Cost of Goods Sold', amount_minor: 40000 });
  stageLine({ reference: 'GPTEST-2', business: 'My Business', ledger: 'GrossProfit Test Ledger', transdate: '2027-01-02', account: 'Cash and Bank', amount_minor: -40000 });
  postJournalEntry('GPTEST-2', 'My Business', 'GrossProfit Test Ledger', 1);

  stageLine({ reference: 'GPTEST-3', business: 'My Business', ledger: 'GrossProfit Test Ledger', transdate: '2027-01-03', account: 'Rent', amount_minor: 20000 });
  stageLine({ reference: 'GPTEST-3', business: 'My Business', ledger: 'GrossProfit Test Ledger', transdate: '2027-01-03', account: 'Cash and Bank', amount_minor: -20000 });
  postJournalEntry('GPTEST-3', 'My Business', 'GrossProfit Test Ledger', 1);

  const pl = getProfitAndLoss('My Business', 'GrossProfit Test Ledger');
  assert.equal(pl.cogs_expenses.length, 1);
  assert.equal(pl.cogs_expenses[0].name, 'Cost of Goods Sold');
  assert.equal(pl.operating_expenses.some((e) => e.name === 'Rent'), true);
  assert.equal(pl.operating_expenses.some((e) => e.name === 'Cost of Goods Sold'), false, 'COGS must not also appear in operating expenses — each expense belongs to exactly one bucket');
  assert.equal(pl.gross_profit_minor, 60000, '$1,000 revenue - $400 COGS = $600 Gross Profit');
  assert.equal(pl.net_income_minor, 40000, '$600 Gross Profit - $200 Rent = $400 Net Profit, the same bottom line as before this feature existed');
  assert.equal(pl.total_expenses_minor, 60000, 'total_expenses_minor (COGS + operating together) is unchanged — a real backward-compatibility check, not assumed');
});

test('getTrialBalance: must always balance, even with real posted AR/AP — Customers/Vendors live outside the Chart of Accounts but their real monetary postings must still be included', () => {
  createEntity({ name: 'TBBalance Test Ledger', parent: 'My Business' }, 1);
  createEntity({ name: 'TBBalance Test Customer', parent: 'Customers' }, 1);

  // A real AR-style posting: Accounts Receivable debited, Sales Revenue
  // credited, but the AR side posts to the customer's own name directly
  // (the established pattern), not a generic "Accounts Receivable" GL line.
  stageLine({ reference: 'TBTEST-1', business: 'My Business', ledger: 'TBBalance Test Ledger', transdate: '2027-01-01', account: 'TBBalance Test Customer', amount_minor: 50000 });
  stageLine({ reference: 'TBTEST-1', business: 'My Business', ledger: 'TBBalance Test Ledger', transdate: '2027-01-01', account: 'Sales Revenue', amount_minor: -50000 });
  postJournalEntry('TBTEST-1', 'My Business', 'TBBalance Test Ledger', 1);

  const tb = getTrialBalance('My Business', 'TBBalance Test Ledger');
  assert.equal(tb.total_debit_minor, tb.total_credit_minor, 'a real Trial Balance must always balance — this is the fundamental accounting identity, not a cosmetic property');
  assert.equal(tb.rows.some((r) => r.name === 'TBBalance Test Customer'), true, 'the customer\'s own real posted balance must appear as a row — it is not a synthetic aggregate, it is a genuine account with a genuine balance');
  const customerRow = tb.rows.find((r) => r.name === 'TBBalance Test Customer');
  assert.equal(customerRow?.debit_minor, 50000);
});

test('allocatePayment: actually posts the real GL movement, not just a tracking record — confirmed directly, since this exact gap once let $920,626.23 in "paid" sales never reach Cash and Bank', () => {
  createEntity({ name: 'AllocGL Test Ledger', parent: 'My Business' }, 1);
  createEntity({ name: 'AllocGL Test Customer', parent: 'Customers' }, 1);

  const inv = createInvoice({
    invoiceType: 'AR', business: 'My Business', ledger: 'AllocGL Test Ledger', reference: 'ALLOCGL-1',
    counterpartyName: 'AllocGL Test Customer', invoiceDate: '2027-01-01',
    lines: [{ description: 'x', amountMinor: 7500 }],
  }, 1);
  postInvoice(inv, 'Sales Revenue', 'Sales Tax Payable', 1);

  const cashBefore = getTrialBalance('My Business', 'AllocGL Test Ledger').rows.find((r) => r.name === 'Cash and Bank')?.debit_minor ?? 0;
  allocatePayment(inv, 'ALLOCGL-PAY-1', 7500, '2027-01-02', 'Cash and Bank', 1);
  const cashAfter = getTrialBalance('My Business', 'AllocGL Test Ledger').rows.find((r) => r.name === 'Cash and Bank')?.debit_minor ?? 0;

  assert.equal(cashAfter - cashBefore, 7500, 'Cash and Bank must genuinely increase by the allocated amount, not stay unchanged');
  const customerRow = getTrialBalance('My Business', 'AllocGL Test Ledger').rows.find((r) => r.name === 'AllocGL Test Customer');
  assert.equal(customerRow, undefined, "the customer's own AR balance must be back to zero (and so absent from the Trial Balance) after full payment, not left sitting there");
});

test('completePosSale defaults to real, per-product Sales accounts — not one shared aggregate that could never distinguish one product\'s margin from another\'s', () => {
  createEntity({ name: 'PerProductTest Outlet', parent: 'Locations' }, 1);
  setLocation('PerProductTest Outlet', { city: 'PerProductTest City', location_type: 'Retail', is_billing_address: false, bottle_capacity: 100, carton_capacity: 20 , timezone: 'UTC'});
  createItem('PerProductTest Wine A', 'Items', 1);
  createItem('PerProductTest Wine B', 'Items', 1);
  receiveStockAtLocation('My Business', 'Actual', 'PPTEST-REC-1', 'PerProductTest Wine A', 'PerProductTest Outlet', 10, 1, '2027-01-01');
  receiveStockAtLocation('My Business', 'Actual', 'PPTEST-REC-2', 'PerProductTest Wine B', 'PerProductTest Outlet', 10, 1, '2027-01-01');

  // No revenueAccount at all — this is the actual point being tested.
  completePosSale(
    {
      business: 'My Business',
      ledger: 'Actual',
      locationName: 'PerProductTest Outlet',
      customerName: 'Cash Sale',
      lines: [
        { itemName: 'PerProductTest Wine A', quantity: 2, unitPriceMinor: 1500, taxMinor: 0 },
        { itemName: 'PerProductTest Wine B', quantity: 3, unitPriceMinor: 2000, taxMinor: 0 },
      ],
      taxAccount: 'Sales Tax Payable',
      paymentMethod: 'cash',
      transdate: '2027-01-02',
    },
    1
  );

  const tb = getTrialBalance('My Business', 'Actual');
  const salesA = tb.rows.find((r) => r.name === 'PerProductTest Wine A — PerProductTest Outlet');
  const salesB = tb.rows.find((r) => r.name === 'PerProductTest Wine B — PerProductTest Outlet');
  assert.equal(salesA?.credit_minor, 3000, "Wine A's own real Sales account must show exactly its own 2x$15.00 — not blended with Wine B's");
  assert.equal(salesB?.credit_minor, 6000, "Wine B's own real Sales account must show exactly its own 3x$20.00 — not blended with Wine A's");

  // ensureProductSalesCogsAccounts itself: the COGS side must be tagged for Gross Profit.
  const { cogsAccount, cogsAccountId } = ensureProductSalesCogsAccounts('PerProductTest Wine A', 1);
  assert.equal(cogsAccount, 'PerProductTest Wine A');
  const cogsRow = db.prepare(`SELECT relation_id FROM current_entities WHERE id = ?`).get(cogsAccountId) as { relation_id: number } | undefined;
  const cogsTagId = db.prepare(`SELECT id FROM current_entities WHERE name = 'COGS'`).get() as { id: number };
  assert.equal(cogsRow?.relation_id, cogsTagId.id, "a product's own COGS leaf must be tagged for Gross Profit the moment it's created, not as a separate forgettable step");
});

test('a item\'s real retail_price_minor is a genuine lookup field, reachable via every real path a POS screen actually uses — not something the operator types in', () => {
  createItem('RetailPriceTest Wine', 'Items', 1);
  setItem('RetailPriceTest Wine', { description: 'x', unit_of_measure: 'each', upc: '999888777', retail_price_minor: 4250 });

  const viaGetItem = getItem('RetailPriceTest Wine');
  assert.equal(viaGetItem?.retail_price_minor, 4250, 'getItem must return the real price, not require a separate lookup');

  const viaListItems = listItems().find((p) => p.name === 'RetailPriceTest Wine');
  assert.equal(viaListItems?.retail_price_minor, 4250, 'listItems (what the POS screen actually loads on open) must include the real price');

  const viaUpc = getItemByUpc('999888777');
  assert.equal(viaUpc?.retail_price_minor, 4250, 'getItemByUpc (what a barcode scan actually calls) must return the real price, not just the bare name it used to');
});

test('getSalesReport: detailed lines and a genuine category rollup (via the real entity tree, not a hand-maintained list) that both sum to the same real total', () => {
  createEntity({ name: 'SalesReportTest Ledger', parent: 'My Business' }, 1);
  createEntity({ name: 'SalesReportTest Customer', parent: 'Customers' }, 1);
  createItem('SalesReportTest Merlot', 'Merlot', 1);
  createItem('SalesReportTest Shiraz', 'Shiraz', 1);

  const inv = createInvoice(
    {
      invoiceType: 'AR', business: 'My Business', ledger: 'SalesReportTest Ledger', reference: 'SRTEST-1',
      counterpartyName: 'SalesReportTest Customer', invoiceDate: '2027-02-01',
      lines: [
        { description: 'SalesReportTest Merlot', itemName: 'SalesReportTest Merlot', quantity: 3, unitPriceMinor: 2000, amountMinor: 6000 },
        { description: 'SalesReportTest Shiraz', itemName: 'SalesReportTest Shiraz', quantity: 2, unitPriceMinor: 3000, amountMinor: 6000 },
      ],
    },
    1
  );
  postInvoice(inv, 'Sales Revenue', 'Sales Tax Payable', 1);

  const report = getSalesReport('My Business', 'SalesReportTest Ledger', '2027-02-01', '2027-02-01');
  assert.equal(report.detailed.length, 2, 'both real posted lines must appear in the detailed report');
  assert.equal(report.total_amount_minor, 12000);
  assert.equal(report.total_quantity, 5);

  const merlotCat = report.category_summary.find((c) => c.category === 'Merlot');
  const shirazCat = report.category_summary.find((c) => c.category === 'Shiraz');
  assert.equal(merlotCat?.amount_minor, 6000, 'category rollup must use the real parent category from the entity tree');
  assert.equal(shirazCat?.amount_minor, 6000);
  const summedFromCategories = report.category_summary.reduce((s, c) => s + c.amount_minor, 0);
  assert.equal(summedFromCategories, report.total_amount_minor, 'the category summary must sum to exactly the same total as the detailed lines — no double-counting, nothing dropped');
});

test('setRelationship/getRelationship/getEntitiesWithRelationship: the real relationship-type pattern, confirmed the same shape as an ordinary relation_id tag, not a special case', () => {
  createEntity({ name: 'RelTest Smith Family Trust', parent: 'Businesses' }, 1);
  createEntity({ name: 'RelTest Jones Family Trust', parent: 'Businesses' }, 1);
  createEntity({ name: 'RelTest Boutique Wine Company', parent: 'Businesses' }, 1);

  setRelationship('RelTest Smith Family Trust', 'Trustee Of', 'RelTest Boutique Wine Company', 1);
  setRelationship('RelTest Jones Family Trust', 'Trustee Of', 'RelTest Boutique Wine Company', 1);

  const rel = getRelationship('RelTest Smith Family Trust');
  assert.equal(rel?.type, 'Trustee Of');
  assert.equal(rel?.target, 'RelTest Boutique Wine Company');

  const group = getEntitiesWithRelationship('Trustee Of');
  const smithRow = group.find((r) => r.source === 'RelTest Smith Family Trust');
  const jonesRow = group.find((r) => r.source === 'RelTest Jones Family Trust');
  assert.equal(smithRow?.target, 'RelTest Boutique Wine Company');
  assert.equal(jonesRow?.target, 'RelTest Boutique Wine Company');

  // An entity with no relationship set must genuinely return undefined, not a false match.
  createEntity({ name: 'RelTest Unrelated Company', parent: 'Businesses' }, 1);
  assert.equal(getRelationship('RelTest Unrelated Company'), undefined);
});

test('addTypedAddress/getTypedAddresses/addTypedPhone/getTypedPhones: multiple, genuinely typed addresses and phones per entity, zero new tables — reusing parent_id + relation_id + contact recursively', () => {
  createEntity({ name: 'TypedContactTest Store', parent: 'Locations' }, 1);

  addTypedAddress('TypedContactTest Store', 'Registered Office', { address_line1: '1 Corporate Way', city: 'Springfield' }, 1);
  addTypedAddress('TypedContactTest Store', 'Delivery', { address_line1: '42 Market Street', city: 'Springfield' }, 1);
  addTypedPhone('TypedContactTest Store', 'Landline', '555-0100', 1);
  addTypedPhone('TypedContactTest Store', 'Mobile', '555-0199', 1);

  const addresses = getTypedAddresses('TypedContactTest Store');
  assert.equal(addresses.length, 2, 'both real, distinct addresses must appear');
  const registered = addresses.find((a) => a.address_type === 'Registered Office');
  const delivery = addresses.find((a) => a.address_type === 'Delivery');
  assert.equal(registered?.address_line1, '1 Corporate Way');
  assert.equal(delivery?.address_line1, '42 Market Street');

  const phones = getTypedPhones('TypedContactTest Store');
  assert.equal(phones.length, 2, 'both real, distinct phones must appear');
  assert.equal(phones.find((p) => p.phone_type === 'Landline')?.phone, '555-0100');
  assert.equal(phones.find((p) => p.phone_type === 'Mobile')?.phone, '555-0199');

  // Addresses and phones must never bleed into each other, despite using the exact same underlying shape.
  const entities = getEntityTree();
  const store = entities.find((e) => e.name === 'TypedContactTest Store')!;
  const children = entities.filter((e) => e.parent_id === store.id);
  assert.equal(children.length, 4, 'exactly 4 real children — 2 addresses + 2 phones, no more, no fewer');

  deleteTypedAddress('TypedContactTest Store', 'Delivery', 1);
  assert.equal(getTypedAddresses('TypedContactTest Store').length, 1, 'deleting one address must not touch the other, or any phone');
  assert.equal(getTypedPhones('TypedContactTest Store').length, 2);

  deleteTypedPhone('TypedContactTest Store', 'Mobile', 1);
  assert.equal(getTypedPhones('TypedContactTest Store').length, 1);
});

test('createBusiness: a brand-new business gets both a real Actual ledger AND a real Budget ledger for the financial year, immediately postable to, using the already-shared Chart of Accounts — no separate CoA setup needed', () => {
  const result = createBusiness('CreateBusinessTest Co', '2027-28', 1);

  // Per direct correction: ledger names no longer carry a business
  // prefix — scoped uniqueness (unique among real, direct siblings
  // under the same real parent, not globally) already, correctly
  // allows every business to have its own "Actual"/"Budget {year}"
  // ledger without collision, now that the bare-lookup risk this
  // exposed (post_journal_entry_insert, post_quantity_movement_insert,
  // getCoaFamilyAccounts) has been fixed to scope by the real,
  // known business first.
  assert.equal(result.business, 'CreateBusinessTest Co');
  assert.equal(result.actualLedger, 'Actual');
  assert.equal(result.budgetLedger, 'Budget 2027-28');

  const businesses = getBusinesses();
  assert.ok(businesses.some((b) => b.name === 'CreateBusinessTest Co'), 'the new business must be a real, findable entity');

  const ledgers = getLedgers('CreateBusinessTest Co');
  // getLedgers deliberately excludes "{business} Locations" — a real
  // bug found and fixed while testing live: it used to show up as a
  // selectable "ledger" in every real ledger dropdown throughout the
  // app (Trial Balance, General Journal, every report), right next to
  // the real Actual/Budget ledgers, even though it isn't one.
  assert.equal(ledgers.length, 2, 'getLedgers must return only the real ledgers, not the business\'s own Locations parent too');
  assert.ok(ledgers.some((l) => l.name === 'Actual'));
  assert.ok(ledgers.some((l) => l.name === 'Budget 2027-28'));
  assert.ok(!ledgers.some((l) => l.name === 'CreateBusinessTest Co Locations'), 'Locations must never appear as a selectable ledger');

  // The Locations parent is still real and still created immediately — just correctly excluded from getLedgers specifically.
  const entities = getEntityTree();
  assert.ok(entities.some((e) => e.name === 'CreateBusinessTest Co Locations'), 'a new business must still get its own real Locations parent immediately — just not counted as a ledger');

  // Immediately postable — a real owner's capital contribution, using
  // the already-shared Chart of Accounts, with zero setup beyond
  // creating the business and its two ledgers.
  const ref = 'CBTEST-CAPITAL-1';
  stageLine({ reference: ref, business: 'CreateBusinessTest Co', ledger: 'Actual', transdate: '2027-01-01', account: 'Cash and Bank', amount_minor: 500000 });
  stageLine({ reference: ref, business: 'CreateBusinessTest Co', ledger: 'Actual', transdate: '2027-01-01', account: "Owner's Equity", amount_minor: -500000 });
  postJournalEntry(ref, 'CreateBusinessTest Co', 'Actual', 1);

  const tb = getTrialBalance('CreateBusinessTest Co', 'Actual', '2027-01-01');
  const cashRow = tb.rows.find((r) => r.name === 'Cash and Bank');
  assert.equal(cashRow?.debit_minor, 500000, 'the new business\'s own real capital contribution must show up correctly, ledger-scoped, immediately — not requiring any further setup');

  // The real Budget ledger is also immediately real and postable to —
  // proving it's not just a placeholder name with no actual function.
  const budgetRef = 'CBTEST-BUDGET-1';
  stageLine({ reference: budgetRef, business: 'CreateBusinessTest Co', ledger: 'Budget 2027-28', transdate: '2027-01-01', account: 'Sales Revenue', amount_minor: -1000000 });
  stageLine({ reference: budgetRef, business: 'CreateBusinessTest Co', ledger: 'Budget 2027-28', transdate: '2027-01-01', account: 'Retained Earnings', amount_minor: 1000000 });
  postJournalEntry(budgetRef, 'CreateBusinessTest Co', 'Budget 2027-28', 1);

  const budgetTb = getTrialBalance('CreateBusinessTest Co', 'Budget 2027-28', '2027-01-01');
  const budgetSalesRow = budgetTb.rows.find((r) => r.name === 'Sales Revenue');
  assert.equal(budgetSalesRow?.credit_minor, 1000000, 'the real Budget ledger must be genuinely separate from Actual, correctly ledger-scoped — a real target, not merely a name');

  // Confirm the two ledgers never bleed into each other — Actual's real capital contribution must not appear in Budget's balances, or vice versa.
  const budgetCashRow = budgetTb.rows.find((r) => r.name === 'Cash and Bank');
  assert.equal(budgetCashRow, undefined, 'Actual\'s own real transactions must never appear in the Budget ledger\'s own balances');
});

test('createBusiness: real, optional secondary currencies each get a real, automatic "Cash at Bank ({currency})" account, correctly tagged and immediately postable to — a genuinely ordinary business omits this entirely', () => {
  // The ordinary case first: no secondaryCurrencies at all must
  // create nothing extra — most real businesses transact in one,
  // single, home currency, and this must stay a real, low-friction,
  // optional addition, never a mandatory step.
  createBusiness('OrdinaryCurrencyTest Co', '2027-28', 1, 'English CoA');
  assert.equal(getEntityTree().some((e) => e.name.startsWith('Cash at Bank (') && e.name.includes('OrdinaryCurrencyTest')), false);

  const result = createBusiness('MultiCurrencyTest Co', '2027-28', 1, 'English CoA', ['EUR', 'USD']);
  assert.equal(result.business, 'MultiCurrencyTest Co');

  const entities = getEntityTree();
  const eurAccount = entities.find((e) => e.name === 'Cash at Bank (EUR)');
  const usdAccount = entities.find((e) => e.name === 'Cash at Bank (USD)');
  assert.ok(eurAccount, 'a real "Cash at Bank (EUR)" account must exist');
  assert.ok(usdAccount, 'a real "Cash at Bank (USD)" account must exist');

  const eurParent = entities.find((e) => e.id === eurAccount!.parent_id);
  assert.equal(eurParent?.name, 'Asset', 'the real currency account must sit under Asset, the same real category the existing, hand-written demo currency accounts already use');

  const eurCurrencyRow = db.prepare(`SELECT currency FROM account WHERE entity_id = ?`).get(eurAccount!.id) as { currency: string };
  assert.equal(eurCurrencyRow.currency, 'EUR', 'the real account.currency field must be genuinely set, the same real mechanism postJournalEntry itself validates against');
});

test('ensureProductSalesCogsAccounts: mirrors the real, existing product category tree onto the GL side, not a flat or hardcoded structure', () => {
  createEntity({ name: 'CategoryMirrorTest Category', parent: 'Items' }, 1);
  createEntity({ name: 'CategoryMirrorTest SubCategory', parent: 'CategoryMirrorTest Category' }, 1);
  createItem('CategoryMirrorTest Product', 'CategoryMirrorTest SubCategory', 1);

  const { salesAccount, salesAccountId, cogsAccount, cogsAccountId } = ensureProductSalesCogsAccounts('CategoryMirrorTest Product', 1);
  assert.equal(salesAccount, 'CategoryMirrorTest Product');
  assert.equal(cogsAccount, 'CategoryMirrorTest Product');

  const entities = getEntityTree();
  const salesLeaf = entities.find((e) => e.id === salesAccountId)!;
  const salesSubCat = entities.find((e) => e.id === salesLeaf.parent_id)!;
  assert.equal(salesSubCat.name, 'CategoryMirrorTest SubCategory', 'the leaf must nest under a real, mirrored sub-category, not sit flat under Income directly');
  const salesTopCat = entities.find((e) => e.id === salesSubCat.parent_id)!;
  assert.equal(salesTopCat.name, 'CategoryMirrorTest Category');
  const salesRoot = entities.find((e) => e.id === salesTopCat.parent_id)!;
  assert.equal(salesRoot.name, 'Sales Revenue', 'the top category must parent under the real, existing Sales Revenue heading account');
  const salesGrandRoot = entities.find((e) => e.id === salesRoot.parent_id)!;
  assert.equal(salesGrandRoot.name, 'Income', 'the real, existing Sales Revenue heading account itself parents directly under Income, completing the real, mirrored chain');

  const cogsLeaf = entities.find((e) => e.id === cogsAccountId)!;
  const cogsSubCat = entities.find((e) => e.id === cogsLeaf.parent_id)!;
  assert.equal(cogsSubCat.name, 'CategoryMirrorTest SubCategory', 'COGS mirrors the exact same real category chain, independently, on the Expense side');

  // A product with NO sub-category (flat, one level only) must still work correctly — proving this isn't hardcoded to a fixed depth.
  createEntity({ name: 'CategoryMirrorTest FlatCategory', parent: 'Items' }, 1);
  createItem('CategoryMirrorTest FlatProduct', 'CategoryMirrorTest FlatCategory', 1);
  const flatResult = ensureProductSalesCogsAccounts('CategoryMirrorTest FlatProduct', 1);
  const flatLeaf = getEntityTree().find((e) => e.id === flatResult.salesAccountId)!;
  const flatParent = getEntityTree().find((e) => e.id === flatLeaf.parent_id)!;
  assert.equal(flatParent.name, 'CategoryMirrorTest FlatCategory');
  const flatRoot = getEntityTree().find((e) => e.id === flatParent.parent_id)!;
  assert.equal(flatRoot.name, 'Sales Revenue', 'a product with no sub-category still gets exactly one real grouping level under the real, existing Sales Revenue heading, not a fixed number of levels regardless of the real catalog depth');
});

test('POS clerk sign-on/sign-off: a real employee needs a real PIN, can only be signed on at one real location at a time, and signing off closes the real shift record cleanly', () => {
  createEntity({ name: 'ShiftTest Employee', parent: 'Employees' }, 1);
  createEntity({ name: 'ShiftTest Location A', parent: 'Locations' }, 1);
  createEntity({ name: 'ShiftTest Location B', parent: 'Locations' }, 1);

  assert.throws(() => signOn('ShiftTest Employee', 'ShiftTest Location A'), /no real PIN set yet/, 'must refuse to sign on an employee with no real PIN configured at all');

  setPosPin('ShiftTest Employee', '4321');
  assert.equal(verifyPosPin('ShiftTest Employee', '4321'), true, 'the real, correct PIN must verify');
  assert.equal(verifyPosPin('ShiftTest Employee', '0000'), false, 'a real, wrong PIN must not verify');

  const shift = signOn('ShiftTest Employee', 'ShiftTest Location A');
  assert.equal(shift.employee, 'ShiftTest Employee');
  assert.equal(shift.location, 'ShiftTest Location A');
  assert.equal(shift.signed_off_at, null, 'a freshly-opened shift has no real sign-off time yet');

  assert.throws(() => signOn('ShiftTest Employee', 'ShiftTest Location B'), /already signed on somewhere/, 'a real employee can only be signed on at one real location at a time, even a different one');

  const activeAtA = getActiveShiftsAtLocation('ShiftTest Location A');
  assert.equal(activeAtA.length, 1);
  assert.equal(activeAtA[0].employee, 'ShiftTest Employee');
  assert.equal(getActiveShiftsAtLocation('ShiftTest Location B').length, 0, 'a real, different location must show no active shifts for an employee signed on elsewhere');

  const openShift = getOpenShiftForEmployee('ShiftTest Employee');
  assert.equal(openShift?.id, shift.id);

  signOff(shift.id);
  assert.equal(getActiveShiftsAtLocation('ShiftTest Location A').length, 0, 'signing off must genuinely close the shift, not leave it active');
  assert.equal(getOpenShiftForEmployee('ShiftTest Employee'), undefined, 'no real, open shift should remain for this employee after signing off');

  assert.throws(() => signOff(shift.id), /already signed off/, 'signing off an already-closed shift must be refused, not silently accepted');

  // Once signed off, the same real employee can sign on again — at
  // either location, including a genuinely different one.
  const secondShift = signOn('ShiftTest Employee', 'ShiftTest Location B');
  assert.equal(secondShift.location, 'ShiftTest Location B');
  assert.notEqual(secondShift.id, shift.id, 'a real, new shift record, not a reused one');
});

test('previewCloseBooks: the real, proposed lines it returns exactly match what closeBooks itself actually posts, and nothing is staged or posted by the preview itself', () => {
  createEntity({ name: 'PreviewCloseTest Ledger', parent: 'My Business' }, 1);
  createEntity({ name: 'PreviewCloseTest Revenue', parent: 'Income' }, 1);
  createEntity({ name: 'PreviewCloseTest Retained Earnings', parent: 'Equity' }, 1);

  stageLine({ reference: 'PCT-1', business: 'My Business', ledger: 'PreviewCloseTest Ledger', transdate: '2027-01-01', account: 'PreviewCloseTest Revenue', amount_minor: -50000 });
  stageLine({ reference: 'PCT-1', business: 'My Business', ledger: 'PreviewCloseTest Ledger', transdate: '2027-01-01', account: 'Cash and Bank', amount_minor: 50000 });
  postJournalEntry('PCT-1', 'My Business', 'PreviewCloseTest Ledger', 1);

  const preview = previewCloseBooks('My Business', 'PreviewCloseTest Ledger', '2027-01-31', 'PreviewCloseTest Retained Earnings');
  assert.equal(preview.netIncomeMinor, 50000);
  assert.equal(preview.accountsZeroed, 1);
  assert.equal(preview.lines.length, 2, 'one real line reversing the revenue account, one real line crediting Retained Earnings — the real, complete, balanced entry a person would actually see');
  const revenueLine = preview.lines.find((l) => l.account === 'PreviewCloseTest Revenue');
  const retainedLine = preview.lines.find((l) => l.account === 'PreviewCloseTest Retained Earnings');
  assert.equal(revenueLine?.amount_minor, 50000, "reversing the revenue account's own, real, credit-normal -$500 balance to zero");
  assert.equal(retainedLine?.amount_minor, -50000, 'crediting the real, chosen Retained Earnings account with the real, full net income');
  assert.equal(preview.lines.reduce((sum, l) => sum + l.amount_minor, 0), 0, "the real, proposed entry must already be genuinely balanced, exactly like any entry closeBooks itself would actually post");

  // The preview itself must not have staged or posted anything at all.
  const tb = getTrialBalance('My Business', 'PreviewCloseTest Ledger');
  assert.notEqual(tb.rows.find((r) => r.name === 'PreviewCloseTest Revenue'), undefined, 'a real preview must not actually zero the revenue account — only a real close does that');

  // Now actually close, and confirm the real result matches the preview exactly.
  const result = closeBooks('My Business', 'PreviewCloseTest Ledger', '2027-01-31', 'PreviewCloseTest Retained Earnings', 1);
  assert.equal(result.netIncomeMinor, preview.netIncomeMinor);
  assert.equal(result.accountsZeroed, preview.accountsZeroed);

  // Previewing again on the same, already-closed date must refuse,
  // the same real, honest error closeBooks itself would give.
  assert.throws(() => previewCloseBooks('My Business', 'PreviewCloseTest Ledger', '2027-01-31', 'PreviewCloseTest Retained Earnings'), /Nothing to close/);
});

test('Location open hours and employee weekly scheduling, built entirely on the real entity tree — no new table, each real record is its own, real, named child entity', () => {
  createEntity({ name: 'ScheduleTest Location', parent: 'Locations' }, 1);
  createEntity({ name: 'ScheduleTest Employee', parent: 'Employees' }, 1);

  setLocationOpenHours('ScheduleTest Location', [
    { day: 'Monday', opens_at: '09:00', closes_at: '17:00' },
    { day: 'Tuesday', opens_at: '10:00', closes_at: '16:00' },
  ]);
  const hours = getLocationOpenHours('ScheduleTest Location');
  assert.equal(hours.length, 2);
  assert.equal(hours[0].day, 'Monday');
  assert.equal(hours[0].opens_at, '09:00');
  assert.equal(hours[0].closes_at, '17:00');

  // Confirmed as a real, live entity, not a row in some new table —
  // its own real name IS the data, tagged via relation_id to the
  // real "Monday" entity under Days of Week.
  const entities = getEntityTree();
  const record = entities.find((e) => e.name === 'ScheduleTest Location — Monday: 09:00–17:00');
  assert.ok(record, 'the real open-hours record must exist as a real, findable, named entity');
  const parent = entities.find((e) => e.id === record!.parent_id);
  assert.equal(parent?.name, 'ScheduleTest Location', "the real record must be parented under the real location itself");
  const relation = entities.find((e) => e.id === record!.relation_id);
  assert.equal(relation?.name, 'Monday', 'the real record must be tagged via relation_id to the real day entity');

  // A real, valid schedule — genuinely within the real open hours.
  setEmployeeSchedule('ScheduleTest Employee', 'ScheduleTest Location', [
    { day: 'Monday', starts_at: '09:00', ends_at: '17:00' },
    { day: 'Tuesday', starts_at: '10:00', ends_at: '14:00' },
  ]);
  const schedule = getEmployeeSchedule('ScheduleTest Employee');
  assert.equal(schedule.length, 2);
  assert.equal(schedule[0].location, 'ScheduleTest Location');

  const roster = getScheduleAtLocation('ScheduleTest Location');
  assert.equal(roster.length, 2);
  assert.equal(roster[0].employee, 'ScheduleTest Employee');

  // A real employee can genuinely work a real shift outside the
  // location's own open hours now (cleaning, stocking, a delivery
  // before the doors open) — including on a real day the location has
  // no open-hours record for at all. No longer rejected.
  setEmployeeSchedule('ScheduleTest Employee', 'ScheduleTest Location', [{ day: 'Wednesday', starts_at: '05:00', ends_at: '07:00' }]);
  assert.equal(getEmployeeSchedule('ScheduleTest Employee').find((s) => s.day === 'Wednesday')?.starts_at, '05:00');

  setEmployeeSchedule('ScheduleTest Employee', 'ScheduleTest Location', [{ day: 'Monday', starts_at: '08:00', ends_at: '17:00' }]);
  assert.equal(getEmployeeSchedule('ScheduleTest Employee').find((s) => s.day === 'Monday')?.starts_at, '08:00');

  // A real, single shift longer than the real daily cap.
  assert.throws(
    () => setEmployeeSchedule('ScheduleTest Employee', 'ScheduleTest Location', [{ day: 'Monday', starts_at: '05:00', ends_at: '19:00' }]),
    /exceeds the real 12-hour daily limit/
  );

  // A real, combined week (across every real location) over the real weekly cap.
  assert.throws(
    () =>
      setEmployeeSchedule('ScheduleTest Employee', 'ScheduleTest Location', [
        { day: 'Monday', starts_at: '06:00', ends_at: '18:00' },
        { day: 'Tuesday', starts_at: '06:00', ends_at: '18:00' },
        { day: 'Wednesday', starts_at: '06:00', ends_at: '18:00' },
        { day: 'Thursday', starts_at: '06:00', ends_at: '18:00' },
        { day: 'Friday', starts_at: '06:00', ends_at: '18:00' },
      ]),
    /over the real 48-hour weekly limit/
  );

  // setEmployeeSchedule is a real, full replace, not additive — a
  // second, real call with fewer real days must genuinely remove the
  // ones no longer included, not just add to the old set.
  setEmployeeSchedule('ScheduleTest Employee', 'ScheduleTest Location', [{ day: 'Monday', starts_at: '09:00', ends_at: '12:00' }]);
  const replaced = getEmployeeSchedule('ScheduleTest Employee');
  assert.equal(replaced.length, 1, 'the real, earlier Tuesday shift must genuinely be gone after a real, full replace, not left stale');
  assert.equal(replaced[0].ends_at, '12:00');

  // Confirmed the old, now-replaced Monday record's own entity is
  // genuinely gone too, not just excluded from the read — a real
  // delete, not a soft, orphaned leftover.
  const staleRecord = getEntityTree().find((e) => e.name === 'ScheduleTest Employee — Monday at ScheduleTest Location: 09:00–17:00');
  assert.equal(staleRecord, undefined, "the real, original 09:00-17:00 record must genuinely be deleted, not merely superseded");
});

test('getCustomerStatement: shows every real, posted invoice for one customer — paid, partially paid, and outstanding — correctly respecting a real, historical "as of" date, not just the current, real-time balance', () => {
  createEntity({ name: 'StatementTest Customer', parent: 'Accounts Receivable' }, 1);

  const inv1 = createInvoice({ invoiceType: 'AR', business: 'My Business', ledger: 'Actual', reference: 'STMTTEST-1', counterpartyName: 'StatementTest Customer', invoiceDate: '2027-01-01', description: 'Fully paid', lines: [{ description: 'Widget', quantity: 1, unitPriceMinor: 10000, amountMinor: 10000, taxMinor: 0 }] }, 1);
  postInvoice(inv1, 'Sales Revenue', 'Sales Tax Payable', 1);
  allocatePayment(inv1, 'STMTTEST-PAY-1', 10000, '2027-01-15', 'Cash and Bank', 1);

  const inv2 = createInvoice({ invoiceType: 'AR', business: 'My Business', ledger: 'Actual', reference: 'STMTTEST-2', counterpartyName: 'StatementTest Customer', invoiceDate: '2027-01-10', description: 'Partially paid', lines: [{ description: 'Widget', quantity: 1, unitPriceMinor: 20000, amountMinor: 20000, taxMinor: 0 }] }, 1);
  postInvoice(inv2, 'Sales Revenue', 'Sales Tax Payable', 1);
  allocatePayment(inv2, 'STMTTEST-PAY-2', 5000, '2027-01-20', 'Cash and Bank', 1);

  const inv3 = createInvoice({ invoiceType: 'AR', business: 'My Business', ledger: 'Actual', reference: 'STMTTEST-3', counterpartyName: 'StatementTest Customer', invoiceDate: '2027-01-20', description: 'Fully outstanding', lines: [{ description: 'Widget', quantity: 1, unitPriceMinor: 15000, amountMinor: 15000, taxMinor: 0 }] }, 1);
  postInvoice(inv3, 'Sales Revenue', 'Sales Tax Payable', 1);

  const statement = getCustomerStatement('My Business', 'Actual', 'StatementTest Customer', '2027-01-31');
  assert.equal(statement.lines.length, 3);
  assert.equal(statement.lines[0].status, 'Paid');
  assert.equal(statement.lines[0].outstanding_minor, 0);
  assert.equal(statement.lines[1].status, 'Partially paid');
  assert.equal(statement.lines[1].paid_minor, 5000);
  assert.equal(statement.lines[1].outstanding_minor, 15000);
  assert.equal(statement.lines[2].status, 'Outstanding');
  assert.equal(statement.lines[2].paid_minor, 0);
  assert.equal(statement.lines[2].outstanding_minor, 15000);
  assert.equal(statement.total_outstanding_minor, 30000, "the real, total outstanding must be the sum of every real, still-owed invoice, not just one");

  // A real, historical "as of" date, before the second and third
  // invoices even existed, and before the first payment was actually
  // allocated — the real point of this feature: an accurate, real
  // snapshot of a real, past moment, not always today's own balance.
  const earlier = getCustomerStatement('My Business', 'Actual', 'StatementTest Customer', '2027-01-05');
  assert.equal(earlier.lines.length, 1, 'only the real, first invoice existed yet as of this earlier date');
  assert.equal(earlier.lines[0].status, 'Outstanding', "the real payment on 2027-01-15 hadn't happened yet as of 2027-01-05 — must show as outstanding, not paid");
  assert.equal(earlier.total_outstanding_minor, 10000);
});

test("setEntityLink/getEntityLink/deleteEntityLink: a real, pure link between two entities that never touches the source entity's own relation_id, unlike setRelationship", () => {
  createEntity({ name: 'EntityLinkTest Account', parent: 'Asset' }, 1);
  createEntity({ name: 'EntityLinkTest Division', parent: 'Divisions' }, 1);
  createEntity({ name: 'EntityLinkTest Other Division', parent: 'Divisions' }, 1);

  // Confirm the real, critical property directly: tag the account's
  // own relation_id first (the same real way createBusiness tags a
  // real CoA family), then confirm setEntityLink leaves it genuinely
  // untouched.
  const acctId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get('EntityLinkTest Account') as { id: number }).id;
  updateEntity(acctId, { relation: 'English CoA' }, 1);

  setEntityLink('EntityLinkTest Account', 'Division', 'EntityLinkTest Division', 1);

  const entities = getEntityTree();
  const account = entities.find((e) => e.name === 'EntityLinkTest Account')!;
  const accountRelationTarget = entities.find((e) => e.id === account.relation_id);
  assert.equal(accountRelationTarget?.name, 'English CoA', "the account's own relation_id must be genuinely untouched by setEntityLink — this is the entire, real point of this generic existing at all");

  assert.equal(getEntityLink('EntityLinkTest Account', 'Division'), 'EntityLinkTest Division');

  // A real, second call with a different target must genuinely
  // replace the link, not create a second, duplicate one.
  setEntityLink('EntityLinkTest Account', 'Division', 'EntityLinkTest Other Division', 1);
  assert.equal(getEntityLink('EntityLinkTest Account', 'Division'), 'EntityLinkTest Other Division');

  const stillOneRecord = entities.filter((e) => e.name === 'EntityLinkTest Account — Division');
  // (entities was captured before the second call; re-fetch for a real, live check)
  const liveEntities = getEntityTree();
  const liveLinkRecords = liveEntities.filter((e) => e.name === 'EntityLinkTest Account — Division');
  assert.equal(liveLinkRecords.length, 1, 'a real, second setEntityLink call must replace the existing link record, not create a real, duplicate second one');

  deleteEntityLink('EntityLinkTest Account', 'Division', 1);
  assert.equal(getEntityLink('EntityLinkTest Account', 'Division'), undefined, 'after deletion, no real link must remain at all');
});

test('stageBomComponent/postBomComponents/getBomComponents: a real Bill of Materials, built on setEntityLink, per the wine-bar-assemblies-plan design', () => {
  createEntity({ name: 'BomTest Gin & Tonic', parent: 'Items' }, 1);
  createEntity({ name: 'BomTest Gin', parent: 'Items' }, 1);
  createEntity({ name: 'BomTest Tonic Water', parent: 'Items' }, 1);

  stageBomComponent({ assemblyItem: 'BomTest Gin & Tonic', business: 'My Business', componentItem: 'BomTest Gin', quantity: 30, unit: 'ml' });
  stageBomComponent({ assemblyItem: 'BomTest Gin & Tonic', business: 'My Business', componentItem: 'BomTest Tonic Water', quantity: 150, unit: 'ml' });

  // Nothing real posted yet - staging is genuinely separate from the
  // real, live entity tree, matching every other staged screen.
  assert.equal(getBomComponents('BomTest Gin & Tonic').length, 0, "staged rows aren't yet real, posted components");

  postBomComponents('BomTest Gin & Tonic', 'My Business', 1);

  const components = getBomComponents('BomTest Gin & Tonic');
  assert.equal(components.length, 2, 'both real, staged components were posted');
  const gin = components.find((c) => c.component === 'BomTest Gin');
  assert.equal(gin?.quantity, 30);
  assert.equal(gin?.unit, 'ml');
  const tonic = components.find((c) => c.component === 'BomTest Tonic Water');
  assert.equal(tonic?.quantity, 150);
  assert.equal(tonic?.unit, 'ml');

  // A real, second stage+post for the same component must genuinely
  // update the quantity, not create a real, duplicate second link -
  // matching setEntityLink's own, already-proven replace behavior.
  stageBomComponent({ assemblyItem: 'BomTest Gin & Tonic', business: 'My Business', componentItem: 'BomTest Gin', quantity: 45, unit: 'ml' });
  postBomComponents('BomTest Gin & Tonic', 'My Business', 1);
  const updated = getBomComponents('BomTest Gin & Tonic');
  assert.equal(updated.length, 2, 'still exactly two real components, not three');
  assert.equal(updated.find((c) => c.component === 'BomTest Gin')?.quantity, 45, 'the real, updated quantity replaced the old one');
});

test('createProjectTask/getProjectTasks/addTaskDependency/getTaskDependencies: real project scheduling with zero new tables, per direct, absolute instruction', () => {
  createEntity({ name: 'PmTest Riverside Build', parent: 'Projects' }, 1);
  createEntity({ name: 'PmTest Riverside Build Tasks', parent: 'PmTest Riverside Build' }, 1);

  createProjectTask('PmTest Riverside Build', 'Pour the foundation', '2026-09-01', '2026-09-05', 1);
  createProjectTask('PmTest Riverside Build', 'Frame the walls', '2026-09-06', '2026-09-12', 1);

  const tasks = getProjectTasks('PmTest Riverside Build');
  assert.equal(tasks.length, 2, 'both real tasks were created and parsed back out correctly');
  const foundation = tasks.find((t) => t.task === 'Pour the foundation');
  assert.equal(foundation?.plannedStart, '2026-09-01');
  assert.equal(foundation?.plannedEnd, '2026-09-05');

  addTaskDependency('Frame the walls', 'Pour the foundation', 'finish_to_start', 1);
  const deps = getTaskDependencies('Frame the walls');
  assert.equal(deps.length, 1, 'one real dependency edge was created');
  assert.equal(deps[0].predecessor, 'Pour the foundation');
  assert.equal(deps[0].dependencyType, 'finish_to_start');

  // A real, direct, empirical confirmation that this genuinely used
  // zero new tables: every one of these real values lives entirely
  // inside ordinary entity names, found via the exact, same
  // current_entities/parent_id/relation_id mechanism already proven
  // for Bill of Materials - no schema change of any kind was needed.
  const rawEntity = db.prepare(`SELECT name FROM current_entities WHERE name LIKE 'Frame the walls%'`).get() as { name: string };
  assert.match(rawEntity.name, /^Frame the walls \(2026-09-06 to 2026-09-12\)$/);
});

test('setLanguageDirection/getLanguageDirection: a real, generic RTL property any language can have, per direct instruction (Hebrew/Arabic on par with every other language, not a hardcoded special case)', () => {
  createEntity({ name: 'LangDirTest Klingon', parent: 'Languages' }, 1);
  assert.equal(getLanguageDirection('LangDirTest Klingon'), undefined, 'no real direction set yet');

  setLanguageDirection('LangDirTest Klingon', 'RTL', 1);
  assert.equal(getLanguageDirection('LangDirTest Klingon'), 'RTL');

  // Confirmed directly: the real, seeded Hebrew/Arabic languages (per
  // direct instruction, permanently on par with every other language,
  // not a one-off experiment) are genuinely RTL out of the box.
  assert.equal(getLanguageDirection('Hebrew'), 'RTL');
  assert.equal(getLanguageDirection('Arabic'), 'RTL');
  assert.equal(getLanguageDirection('English'), undefined, 'English genuinely has no RTL link at all - LTR is the real, honest default');

  setLanguageDirection('LangDirTest Klingon', null, 1);
  assert.equal(getLanguageDirection('LangDirTest Klingon'), undefined, 'a real, direct clear genuinely removes the link entirely');
});

test('setItemSourceLeadTime/getItemLeadTimes/getStockOutRiskReport: will this genuinely run out before a fresh order could arrive?', () => {
  const today = new Date().toISOString().slice(0, 10);

  createEntity({ name: 'RiskTest Keg', parent: 'Items' }, 1);
  createEntity({ name: 'RiskTest Brewery', parent: 'Vendors' }, 1);
  createEntity({ name: 'RiskTest Slow Brewery', parent: 'Vendors' }, 1);
  createEntity({ name: 'RiskTest Bar', parent: 'Locations' }, 1);
  setLocation('RiskTest Bar', { city: 'RiskTest City', location_type: 'Retail', is_billing_address: false, bottle_capacity: 0, carton_capacity: 10, timezone: 'UTC' });

  // Two real, known vendors for the same item - the risk calculation
  // must use the SHORTER one, per direct instruction.
  setItemSourceLeadTime('RiskTest Keg', 'RiskTest Brewery', 3, 1);
  setItemSourceLeadTime('RiskTest Keg', 'RiskTest Slow Brewery', 14, 1);
  const leadTimes = getItemLeadTimes('RiskTest Keg');
  assert.equal(leadTimes.length, 2, 'both real, known vendor lead times were recorded');

  // 100 real units on hand, genuinely consuming 60/day (yesterday) -
  // at that real rate, this runs out in under 2 real days, well
  // inside even the SHORTER 3-day lead time - genuinely at risk.
  receiveStockAtLocation('My Business', 'Actual', 'RISKTEST-REC-1', 'RiskTest Keg', 'RiskTest Bar', 100, 1, today);
  dispatchStockFromLocation('My Business', 'Actual', 'RISKTEST-DISP-1', 'RiskTest Keg', 'RiskTest Bar', 60, 1, today);

  const risk = getStockOutRiskReport(2).find((r) => r.item === 'RiskTest Keg');
  assert.ok(risk, 'genuinely, correctly flagged as at risk');
  assert.equal(risk?.shortest_lead_time_days, 3, 'the shorter of the two real vendor lead times was used, not the longer one');
  assert.ok(risk!.days_until_stockout! < 3, 'days until stockout is genuinely less than the shortest real lead time');
});

test('registerBankAccount/getBankAccounts/getCashPosition: Layer 1 of the real, dedicated cash-flow/growth-planning design — real, registered bank accounts scoped correctly to one real business, grouped by real currency, with honest overdraft headroom', () => {
  createEntity({ name: 'BankRegTest AUD Account', parent: 'Asset' }, 1);
  createEntity({ name: 'BankRegTest AUD Account 2', parent: 'Asset' }, 1);
  createEntity({ name: 'BankRegTest EUR Account', parent: 'Asset' }, 1);
  createEntity({ name: 'BankRegTest Not A Bank Account', parent: 'Asset' }, 1);
  createEntity({ name: 'BankRegTest Division', parent: 'Divisions' }, 1);

  // A real, required scope — no free-floating bank account without one.
  assert.throws(() => registerBankAccount('BankRegTest AUD Account', 'My Business', 'No Such Scope', null, 1), /No real business\/division named/);
  assert.throws(() => registerBankAccount('BankRegTest AUD Account', 'No Such Business', 'My Business', null, 1), /No real business named/);

  registerBankAccount('BankRegTest AUD Account', 'My Business', 'My Business', 100000, 1);
  registerBankAccount('BankRegTest AUD Account 2', 'My Business', 'BankRegTest Division', null, 1); // no overdraft limit
  setAccountCurrency('BankRegTest EUR Account', 'EUR');
  registerBankAccount('BankRegTest EUR Account', 'My Business', 'My Business', 50000, 1);

  const accounts = getBankAccounts('My Business', 'Actual');
  const names = accounts.map((a) => a.name);
  assert.ok(names.includes('BankRegTest AUD Account'));
  assert.ok(names.includes('BankRegTest EUR Account'));
  assert.ok(!names.includes('BankRegTest Not A Bank Account'), 'an ordinary Asset account never registered as a bank account must not appear at all');

  const audAccount = accounts.find((a) => a.name === 'BankRegTest AUD Account')!;
  assert.equal(audAccount.scope, 'My Business');
  const divAccount = accounts.find((a) => a.name === 'BankRegTest AUD Account 2')!;
  assert.equal(divAccount.scope, 'BankRegTest Division', "a real, division-scoped bank account must report its own real division as its scope, not the business");

  // The real, critical bug this whole function was rewritten to fix,
  // confirmed directly: a bank account registered to one real
  // business must never appear when querying a genuinely different
  // real business, even though the underlying GL account itself is
  // shared across the whole app.
  const otherBiz = createBusiness('BankRegTestOther Co', '2027-28', 1);
  const otherBizAccounts = getBankAccounts(otherBiz.business, otherBiz.actualLedger);
  assert.ok(!otherBizAccounts.some((a) => a.name === 'BankRegTest AUD Account'), "a real bank account registered to 'My Business' must never leak into a genuinely different business's own list");

  // The critical, real property: registering never touches the
  // account's own relation_id, confirmed directly by tagging it with
  // a real CoA family first, matching how createBusiness actually
  // does this, and confirming it's genuinely untouched afterward.
  const acctId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get('BankRegTest AUD Account') as { id: number }).id;
  updateEntity(acctId, { relation: 'English CoA' }, 1);
  registerBankAccount('BankRegTest AUD Account', 'My Business', 'My Business', 200000, 1); // re-register, changing the limit
  const entities = getEntityTree();
  const acct = entities.find((e) => e.name === 'BankRegTest AUD Account')!;
  const relationTarget = entities.find((e) => e.id === acct.relation_id);
  assert.equal(relationTarget?.name, 'English CoA', "registering (even re-registering) a bank account must never touch its own relation_id — the entire, real point of using setEntityLink instead of setRelationship");
  assert.equal(getBankAccounts('My Business', 'Actual').find((a) => a.name === 'BankRegTest AUD Account')?.overdraft_limit_minor, 200000, 're-registering must genuinely update the real overdraft limit');

  // Post a real balance to confirm the real, shared Chart of Accounts
  // balance is what's reported, not a separately-tracked figure.
  stageLine({ reference: 'BRTEST-1', business: 'My Business', ledger: 'Actual', transdate: '2027-01-01', account: 'BankRegTest AUD Account', amount_minor: 30000 });
  stageLine({ reference: 'BRTEST-1', business: 'My Business', ledger: 'Actual', transdate: '2027-01-01', account: "Owner's Equity", amount_minor: -30000 });
  postJournalEntry('BRTEST-1', 'My Business', 'Actual', 1);

  const position = getCashPosition('My Business', 'Actual');
  const eurGroup = position.find((p) => p.currency === 'EUR');
  assert.ok(eurGroup, 'a real, distinct EUR group must exist, never blended into the home-currency total');
  assert.equal(eurGroup?.total_overdraft_limit_minor, 50000);
  assert.equal(eurGroup?.headroom_minor, 50000);

  // The real, null-currency (home currency) group combines both real
  // AUD-ish accounts — one with a real, known limit, one without. Per
  // direct design: headroom must be null (genuinely unknown) if ANY
  // real account in that currency group has no real, arranged
  // facility at all, not silently treated as zero.
  const homeGroup = position.find((p) => p.currency === null);
  assert.ok(homeGroup);
  assert.equal(homeGroup!.total_overdraft_limit_minor, null, 'one real account in this group (BankRegTest AUD Account 2) has no known limit, so the real, combined limit must be honestly unknown');
  assert.equal(homeGroup!.headroom_minor, null);

  // Unregistering must genuinely remove both the real link and the
  // real overdraft limit, not just hide the account from the list.
  unregisterBankAccount('BankRegTest AUD Account', 1);
  assert.ok(!getBankAccounts('My Business', 'Actual').some((a) => a.name === 'BankRegTest AUD Account'));
  assert.equal(getEntityLink('BankRegTest AUD Account', 'Bank Account'), undefined);
});

test('getCashFlowForecast: Layer 2 of the real, dedicated cash-flow/growth-planning design — anticipated AR receipts, committed AP payments, and genuinely recurring cash movements, never one-off historical postings', () => {
  createEntity({ name: 'ForecastTest Account', parent: 'Asset' }, 1);
  registerBankAccount('ForecastTest Account', 'My Business', 'My Business', 100000, 1);
  createEntity({ name: 'ForecastTest Customer', parent: 'Accounts Receivable' }, 1);
  createEntity({ name: 'ForecastTest Vendor', parent: 'Accounts Payable' }, 1);

  // A real, ordinary, one-off ('once') posting touching this same
  // real bank account — must NEVER appear in the forecast's own
  // "recurring" source. This is the exact, real bug found live: an
  // earlier version had no real filter for this at all, and every
  // real, historical posting flooded in.
  stageLine({ reference: 'FCTEST-ONEOFF', business: 'My Business', ledger: 'Actual', transdate: '2027-01-10', account: 'ForecastTest Account', amount_minor: -50000 });
  stageLine({ reference: 'FCTEST-ONEOFF', business: 'My Business', ledger: 'Actual', transdate: '2027-01-10', account: "Owner's Equity", amount_minor: 50000 });
  postJournalEntry('FCTEST-ONEOFF', 'My Business', 'Actual', 1);

  // A real, genuinely recurring monthly rent payment.
  createRecurringJournal(
    'My Business',
    'Actual',
    'FCTEST-RENT',
    '2027-01-15',
    'monthly',
    [
      { account: 'Rent', amount_minor: 20000 },
      { account: 'ForecastTest Account', amount_minor: -20000 },
    ],
    1,
    'Monthly rent',
    3
  );

  // A real, outstanding AR invoice, due within the horizon.
  const arInv = createInvoice(
    { invoiceType: 'AR', business: 'My Business', ledger: 'Actual', reference: 'FCTEST-AR', counterpartyName: 'ForecastTest Customer', invoiceDate: '2027-01-01', description: 'Test', lines: [{ description: 'Widget', quantity: 1, unitPriceMinor: 30000, amountMinor: 30000, taxMinor: 0 }] },
    1
  );
  postInvoice(arInv, 'Sales Revenue', 'Sales Tax Payable', 1);

  // A real, outstanding AP invoice, due within the horizon.
  const apInv = createInvoice(
    { invoiceType: 'AP', business: 'My Business', ledger: 'Actual', reference: 'FCTEST-AP', counterpartyName: 'ForecastTest Vendor', invoiceDate: '2027-01-01', description: 'Test', lines: [{ description: 'Supplies', quantity: 1, unitPriceMinor: 15000, amountMinor: 15000, taxMinor: 0 }] },
    1
  );
  postInvoice(apInv, 'Accounts Payable', 'Purchases Tax Claimed', 1);

  const forecast = getCashFlowForecast('My Business', 'Actual', '2027-01-01', 90);

  // The real, critical property: the one-off posting must never appear.
  assert.ok(!forecast.lines.some((l) => l.description.includes('FCTEST-ONEOFF')), 'a real, ordinary one-off posting must never appear in the real, anticipated recurring source');

  const recurringLines = forecast.lines.filter((l) => l.source === 'recurring' && l.description === 'Monthly rent');
  assert.equal(recurringLines.length, 3, 'exactly three real, monthly rent occurrences within a 90-day horizon from a real, three-month schedule');
  assert.ok(recurringLines.every((l) => l.amount_minor === -20000), 'every real, recurring rent line must correctly show as a real, anticipated cash outflow');

  const arLines = forecast.lines.filter((l) => l.source === 'AR' && l.description.includes('ForecastTest Customer'));
  assert.equal(arLines.length, 1);
  assert.equal(arLines[0].amount_minor, 30000, 'a real, anticipated AR receipt must be positive — real, anticipated cash in');

  const apLines = forecast.lines.filter((l) => l.source === 'AP' && l.description.includes('ForecastTest Vendor'));
  assert.equal(apLines.length, 1);
  assert.equal(apLines[0].amount_minor, -15000, 'a real, committed AP payment must be negative — real, anticipated cash out');
});

test('getCashFlowForecast: Layer 3 — a real, honest first-shortfall date and amount, evaluated against the real, arranged overdraft limit, never a bare "goes negative" check', () => {
  const biz = createBusiness('ShortfallTest2 Co', '2027-28', 1);
  createEntity({ name: 'ShortfallTest2 Account', parent: 'Asset' }, 1);
  createEntity({ name: 'ShortfallTest2 Vendor', parent: 'Accounts Payable' }, 1);

  // No real, known overdraft limit at all — a real shortfall can
  // never be honestly reported against an unknown limit.
  registerBankAccount('ShortfallTest2 Account', biz.business, biz.business, null, 1);
  stageLine({ reference: 'ST2TEST-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-02-01', account: 'ShortfallTest2 Account', amount_minor: 5000 });
  stageLine({ reference: 'ST2TEST-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-02-01', account: "Owner's Equity", amount_minor: -5000 });
  postJournalEntry('ST2TEST-1', biz.business, biz.actualLedger, 1);

  const noLimitForecast = getCashFlowForecast(biz.business, biz.actualLedger, '2027-02-01', 90);
  assert.equal(noLimitForecast.overdraft_limit_minor, null);
  assert.equal(noLimitForecast.first_shortfall_date, null, 'no real shortfall must ever be reported against a genuinely unknown limit');
  assert.equal(noLimitForecast.first_shortfall_amount_minor, null);

  // Now give it a real, known, small limit, and a real AP payment due
  // that pushes the real, projected balance below it.
  unregisterBankAccount('ShortfallTest2 Account', 1);
  registerBankAccount('ShortfallTest2 Account', biz.business, biz.business, 2000, 1);
  const apInv = createInvoice(
    { invoiceType: 'AP', business: biz.business, ledger: biz.actualLedger, reference: 'ST2TEST-AP', counterpartyName: 'ShortfallTest2 Vendor', invoiceDate: '2027-02-01', description: 'Test', lines: [{ description: 'Supplies', quantity: 1, unitPriceMinor: 10000, amountMinor: 10000, taxMinor: 0 }] },
    1
  );
  postInvoice(apInv, 'Accounts Payable', 'Purchases Tax Claimed', 1);
  const dueDateRow = db.prepare(`SELECT due_date FROM invoice WHERE id = ?`).get(apInv) as { due_date: string };

  const forecast = getCashFlowForecast(biz.business, biz.actualLedger, '2027-02-01', 90);
  // Starting cash 5000, limit 2000 -> headroom 7000, no shortfall yet.
  // After the real AP payment (-10000): running = -5000, headroom = -5000+2000 = -3000 -> a real shortfall of 3000.
  assert.equal(forecast.overdraft_limit_minor, 2000);
  assert.equal(forecast.first_shortfall_date, dueDateRow.due_date, "the real, first shortfall date must be exactly the real AP invoice's own due date, not before or after it");
  assert.equal(forecast.first_shortfall_amount_minor, 3000, 'the real, exact shortfall amount — how far below the real, arranged limit, not the raw negative balance');
});

test("setDimensionParent/getDimensionParent/getDimensionChildren/getDimensionAncestorChain: the generic, reusable multi-dimension mechanism (docs/multi-dimensional-reporting.md) — a real, reversible up/down index per named dimension, never touching an entity's own relation_id", () => {
  createEntity({ name: 'DimTest2 Springfield', parent: 'My Business' }, 1);
  createEntity({ name: 'DimTest2 Riverside Cellars', parent: 'My Business' }, 1);
  createEntity({ name: 'DimTest2 Uptown Wine', parent: 'My Business' }, 1);
  createEntity({ name: 'DimTest2 Amber Ale Sales', parent: 'Income' }, 1);

  setDimensionParent('DimTest2 Riverside Cellars', 'Division/Location', 'DimTest2 Springfield', 1);
  setDimensionParent('DimTest2 Uptown Wine', 'Division/Location', 'DimTest2 Springfield', 1);
  setDimensionParent('DimTest2 Amber Ale Sales', 'Division/Location', 'DimTest2 Riverside Cellars', 1);

  assert.equal(getDimensionParent('DimTest2 Riverside Cellars', 'Division/Location'), 'DimTest2 Springfield');
  assert.deepEqual(getDimensionChildren('DimTest2 Springfield', 'Division/Location').sort(), ['DimTest2 Riverside Cellars', 'DimTest2 Uptown Wine'], "the real, reverse query parent_id alone can never answer — every real entity whose own dimension-parent is exactly this one");
  assert.deepEqual(getDimensionChildren('DimTest2 Riverside Cellars', 'Division/Location'), ['DimTest2 Amber Ale Sales']);
  assert.deepEqual(getDimensionAncestorChain('DimTest2 Amber Ale Sales', 'Division/Location'), ['DimTest2 Riverside Cellars', 'DimTest2 Springfield'], "the real, full chain from the leaf up to (not including) the real root");

  // The entire, real point of this mechanism existing: a leaf account's
  // own relation_id (e.g. a real CoA-family tag) must stay genuinely
  // untouched by setting or re-setting its own dimension parent.
  const acctId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get('DimTest2 Amber Ale Sales') as { id: number }).id;
  updateEntity(acctId, { relation: 'English CoA' }, 1);
  setDimensionParent('DimTest2 Amber Ale Sales', 'Division/Location', 'DimTest2 Uptown Wine', 1); // re-set to a different location
  const tree = getEntityTree();
  const acct = tree.find((e) => e.name === 'DimTest2 Amber Ale Sales')!;
  const relTarget = tree.find((e) => e.id === acct.relation_id);
  assert.equal(relTarget?.name, 'English CoA', "re-setting a real dimension parent must never touch the account's own relation_id");
  assert.equal(getDimensionParent('DimTest2 Amber Ale Sales', 'Division/Location'), 'DimTest2 Uptown Wine');

  // A second, genuinely independent, real dimension on the exact same
  // entity must not interfere with the first at all — the entire,
  // real point of "multiple, equal accumulation paths".
  createEntity({ name: 'DimTest2 Beer', parent: 'Income' }, 1);
  setDimensionParent('DimTest2 Amber Ale Sales', 'Product Category', 'DimTest2 Beer', 1);
  assert.equal(getDimensionParent('DimTest2 Amber Ale Sales', 'Division/Location'), 'DimTest2 Uptown Wine', 'a second, independent dimension must never disturb the first');
  assert.equal(getDimensionParent('DimTest2 Amber Ale Sales', 'Product Category'), 'DimTest2 Beer');

  deleteDimensionParent('DimTest2 Amber Ale Sales', 'Division/Location', 1);
  assert.equal(getDimensionParent('DimTest2 Amber Ale Sales', 'Division/Location'), undefined);
  assert.equal(getDimensionParent('DimTest2 Amber Ale Sales', 'Product Category'), 'DimTest2 Beer', 'deleting one dimension must never disturb a genuinely separate one');
});

test('ensureProductTierItem: the confirmed product/tier/leaf design (docs/multi-dimensional-reporting.md §10) — each real tier its own, distinct, sellable item, the base product name genuinely untouched, no shared-parent corruption across multiple tiers', () => {
  createEntity({ name: 'TierTest2 Beer', parent: 'Items' }, 1);
  createEntity({ name: 'TierTest2 Ale', parent: 'TierTest2 Beer' }, 1);
  createEntity({ name: 'TierTest2 Amber Ale 330ml', parent: 'TierTest2 Ale' }, 1);

  const bottle = ensureProductTierItem('TierTest2 Amber Ale 330ml', 'Bottle', 1);
  const carton = ensureProductTierItem('TierTest2 Amber Ale 330ml', 'Carton', 1);
  const sixPack = ensureProductTierItem('TierTest2 Amber Ale 330ml', 'Six-Pack', 1);

  // The real, critical property this whole design fixes: the base
  // product entity's own, real parent_id must never move, no matter
  // how many real tiers are processed for it.
  const tree = getEntityTree();
  const base = tree.find((e) => e.name === 'TierTest2 Amber Ale 330ml')!;
  const baseParent = tree.find((e) => e.id === base.parent_id);
  assert.equal(baseParent?.name, 'TierTest2 Ale', "the base product's own real parent must never move, regardless of how many tiers are created for it");

  // Each real tier is its own, genuinely distinct item, correctly
  // structured under its own real Sales leaf.
  for (const [tier, result] of [
    ['Bottle', bottle],
    ['Carton', carton],
    ['Six-Pack', sixPack],
  ] as const) {
    const e = tree.find((x) => x.id === result.tierItemId)!;
    const parent = tree.find((x) => x.id === e.parent_id);
    assert.equal(parent?.name, result.salesAccount, `the real ${tier} tier's own item must be a genuine, structural child of its own real Sales leaf`);
    assert.equal(e.is_postable_account, false, 'a real item is never itself a real, postable GL account, even structurally nested under one');
  }

  // COGS reaches the same real item via the dimension mechanism, not
  // as a second, real structural parent.
  assert.equal(getDimensionParent(bottle.tierItemName, 'COGS Product'), bottle.cogsAccount);
  assert.equal(getDimensionParent(carton.tierItemName, 'COGS Product'), carton.cogsAccount);

  // A genuinely idempotent, real, repeated call must never throw or
  // duplicate anything.
  const bottleAgain = ensureProductTierItem('TierTest2 Amber Ale 330ml', 'Bottle', 1);
  assert.deepEqual(bottleAgain, bottle);
});

test('getProfitAndLossByDivision: "Consolidated per Division" — one real, full P&L per real division actually active in this ledger/date range, income/COGS/operating split intact per division, derived structurally from real, live sales at real locations', () => {
  createEntity({ name: 'PLDivTest3 Division A', parent: 'Divisions' }, 1);
  createEntity({ name: 'PLDivTest3 Division B', parent: 'Divisions' }, 1);
  createEntity({ name: 'PLDivTest3 Outlet A', parent: 'Locations' }, 1);
  setLocation('PLDivTest3 Outlet A', { city: 'PLDivTest3 Division A', location_type: 'Retail', is_billing_address: false, bottle_capacity: 500, carton_capacity: 80 , timezone: 'UTC'});
  createEntity({ name: 'PLDivTest3 Outlet B', parent: 'Locations' }, 1);
  setLocation('PLDivTest3 Outlet B', { city: 'PLDivTest3 Division B', location_type: 'Retail', is_billing_address: false, bottle_capacity: 500, carton_capacity: 80 , timezone: 'UTC'});
  createItem('PLDivTest3 Merlot', 'Items', 1);
  const today = new Date().toISOString().slice(0, 10);
  receiveStockAtLocation('My Business', 'Actual', 'PLDIVTEST3-REC-A', 'PLDivTest3 Merlot', 'PLDivTest3 Outlet A', 20, 1, today);
  receiveStockAtLocation('My Business', 'Actual', 'PLDIVTEST3-REC-B', 'PLDivTest3 Merlot', 'PLDivTest3 Outlet B', 20, 1, today);

  completePosSale({ business: 'My Business', ledger: 'Actual', locationName: 'PLDivTest3 Outlet A', customerName: 'Cash Sale', lines: [{ itemName: 'PLDivTest3 Merlot', quantity: 1, unitPriceMinor: 50000, taxMinor: 0, tier: 'Bottle' }], taxAccount: 'Sales Tax Payable', paymentMethod: 'cash', cashTenderedMinor: 50000 }, 1);
  completePosSale({ business: 'My Business', ledger: 'Actual', locationName: 'PLDivTest3 Outlet B', customerName: 'Cash Sale', lines: [{ itemName: 'PLDivTest3 Merlot', quantity: 1, unitPriceMinor: 30000, taxMinor: 0, tier: 'Bottle' }], taxAccount: 'Sales Tax Payable', paymentMethod: 'cash', cashTenderedMinor: 30000 }, 1);

  const result = getProfitAndLossByDivision('My Business', 'Actual', today, today);
  const divA = result.find((r) => r.division === 'PLDivTest3 Division A');
  const divB = result.find((r) => r.division === 'PLDivTest3 Division B');
  assert.ok(divA, 'a real division actually active in this date range must appear, derived structurally from a real, live sale at a real location within it');
  assert.ok(divB);
  assert.equal(divA!.profitAndLoss.total_income_minor, 50000, "each real division's own P&L must be genuinely isolated from every other division's own activity");
  assert.equal(divB!.profitAndLoss.total_income_minor, 30000);
  assert.equal(divA!.profitAndLoss.net_income_minor, 50000);

  // A real, genuinely untagged posting — a plain account with no
  // real, structural location link at all — must still, correctly
  // resolve to "(No division)" under the new, structural derivation,
  // exactly as it did under the old, tag-based one. Checked as a real
  // delta, not an absolute value, since the shared test database may
  // already carry other, earlier tests' own real, genuinely untagged
  // activity too.
  const noDivisionBefore = result.find((r) => r.division === null)?.profitAndLoss.total_income_minor ?? 0;
  stageLine({ reference: 'PLDIVTEST3-3', business: 'My Business', ledger: 'Actual', transdate: today, account: 'Sales Revenue', amount_minor: -7000 });
  stageLine({ reference: 'PLDIVTEST3-3', business: 'My Business', ledger: 'Actual', transdate: today, account: 'Cash and Bank', amount_minor: 7000 });
  postJournalEntry('PLDIVTEST3-3', 'My Business', 'Actual', 1);
  const resultAfter = getProfitAndLossByDivision('My Business', 'Actual', today, today);
  const noDivisionAfter = resultAfter.find((r) => r.division === null)?.profitAndLoss.total_income_minor ?? 0;
  assert.equal(noDivisionAfter - noDivisionBefore, 7000, "(No division) must move by exactly this real, untagged posting's own amount — Division A's and B's own real activity must never leak into it");
  // Division A/B's own real totals must also stay exactly where they
  // were — the real, untagged posting above must never bleed into them.
  assert.equal(resultAfter.find((r) => r.division === 'PLDivTest3 Division A')!.profitAndLoss.total_income_minor, 50000);
  assert.equal(resultAfter.find((r) => r.division === 'PLDivTest3 Division B')!.profitAndLoss.total_income_minor, 30000);

  // A real division that exists in the app but has no real activity
  // within this real ledger/date range must never appear at all — an
  // empty, meaningless report is worse than no report.
  createEntity({ name: 'PLDivTest3 Division Unused', parent: 'Divisions' }, 1);
  const result2 = getProfitAndLossByDivision('My Business', 'Actual', today, today);
  assert.ok(!result2.some((r) => r.division === 'PLDivTest3 Division Unused'));
});

test('getProfitAndLossByDivisionTree: "Consolidated per Division per Location" — real divisions nested under their own real parent, a genuinely empty node synthesized for a real, top-level division with no direct activity of its own', () => {
  createEntity({ name: 'PLTreeTest City', parent: 'Divisions' }, 1);
  createEntity({ name: 'PLTreeTest Store A', parent: 'PLTreeTest City' }, 1);
  createEntity({ name: 'PLTreeTest Store B', parent: 'PLTreeTest City' }, 1);
  createEntity({ name: 'PLTreeTest Outlet A', parent: 'Locations' }, 1);
  setLocation('PLTreeTest Outlet A', { city: 'PLTreeTest Store A', location_type: 'Retail', is_billing_address: false, bottle_capacity: 500, carton_capacity: 80 , timezone: 'UTC'});
  createEntity({ name: 'PLTreeTest Outlet B', parent: 'Locations' }, 1);
  setLocation('PLTreeTest Outlet B', { city: 'PLTreeTest Store B', location_type: 'Retail', is_billing_address: false, bottle_capacity: 500, carton_capacity: 80 , timezone: 'UTC'});
  createItem('PLTreeTest Merlot', 'Items', 1);
  const today = new Date().toISOString().slice(0, 10);
  receiveStockAtLocation('My Business', 'Actual', 'PLTREETEST-REC-A', 'PLTreeTest Merlot', 'PLTreeTest Outlet A', 20, 1, today);
  receiveStockAtLocation('My Business', 'Actual', 'PLTREETEST-REC-B', 'PLTreeTest Merlot', 'PLTreeTest Outlet B', 20, 1, today);

  // The real, top-level "City" division genuinely never gets any
  // direct activity of its own — only its own, real child stores do.
  completePosSale({ business: 'My Business', ledger: 'Actual', locationName: 'PLTreeTest Outlet A', customerName: 'Cash Sale', lines: [{ itemName: 'PLTreeTest Merlot', quantity: 1, unitPriceMinor: 20000, taxMinor: 0, tier: 'Bottle' }], taxAccount: 'Sales Tax Payable', paymentMethod: 'cash', cashTenderedMinor: 20000 }, 1);
  completePosSale({ business: 'My Business', ledger: 'Actual', locationName: 'PLTreeTest Outlet B', customerName: 'Cash Sale', lines: [{ itemName: 'PLTreeTest Merlot', quantity: 1, unitPriceMinor: 15000, taxMinor: 0, tier: 'Bottle' }], taxAccount: 'Sales Tax Payable', paymentMethod: 'cash', cashTenderedMinor: 15000 }, 1);

  const tree = getProfitAndLossByDivisionTree('My Business', 'Actual', today, today);
  const city = tree.find((n) => n.division === 'PLTreeTest City');
  assert.ok(city, "a real, top-level division must still appear, even with no real, direct activity of its own, so its own real children have somewhere real to nest");
  assert.equal(city!.profitAndLoss.total_income_minor, 0, "a real, synthesized-empty parent node must genuinely show zero, not some real, incorrect aggregate");
  assert.equal(city!.children.length, 2, 'both real, child stores must be correctly nested under their own real parent');

  const storeA = city!.children.find((c) => c.division === 'PLTreeTest Store A');
  const storeB = city!.children.find((c) => c.division === 'PLTreeTest Store B');
  assert.ok(storeA);
  assert.ok(storeB);
  assert.equal(storeA!.profitAndLoss.total_income_minor, 20000, "each real, nested child's own P&L must be genuinely correct, not just its own existence");
  assert.equal(storeB!.profitAndLoss.total_income_minor, 15000);
  assert.equal(storeA!.children.length, 0, 'a real leaf division must have no real children of its own');

  // "(No division)" must always be its own, separate, real root — it
  // has no real, meaningful parent to nest under at all.
  assert.ok(tree.some((n) => n.division === null), '(No division) must remain a real, top-level root, never nested under anything');
});

test('closeBooks: "the whole point of the restructuring" — Retained Earnings itself now carries a real, detailed journal line per real, active profit center, each correctly, independently tagged, still summing to the exact same, single, correct total', () => {
  const biz = createBusiness('DetailedCloseTest Co', '2027-28', 1);
  createEntity({ name: 'DetailedCloseTest Division A', parent: 'Divisions' }, 1);
  createEntity({ name: 'DetailedCloseTest Division B', parent: 'Divisions' }, 1);
  setDivisionType('DetailedCloseTest Division A', 'Profit Center');
  setDivisionType('DetailedCloseTest Division B', 'Profit Center');
  createEntity({ name: 'DetailedCloseTest Outlet A', parent: 'Locations' }, 1);
  setLocation('DetailedCloseTest Outlet A', { city: 'DetailedCloseTest Division A', location_type: 'Retail', is_billing_address: false, bottle_capacity: 500, carton_capacity: 80 , timezone: 'UTC'});
  createEntity({ name: 'DetailedCloseTest Outlet B', parent: 'Locations' }, 1);
  setLocation('DetailedCloseTest Outlet B', { city: 'DetailedCloseTest Division B', location_type: 'Retail', is_billing_address: false, bottle_capacity: 500, carton_capacity: 80 , timezone: 'UTC'});
  createItem('DetailedCloseTest Merlot', 'Items', 1);
  receiveStockAtLocation(biz.business, biz.actualLedger, 'DCT-REC-A', 'DetailedCloseTest Merlot', 'DetailedCloseTest Outlet A', 20, 1, '2027-01-01');
  receiveStockAtLocation(biz.business, biz.actualLedger, 'DCT-REC-B', 'DetailedCloseTest Merlot', 'DetailedCloseTest Outlet B', 20, 1, '2027-01-01');

  // Division A: $1,000 real profit (via a real, structural sale).
  // Division B: $600 real profit. A real, undivided remainder: $200.
  completePosSale({ business: biz.business, ledger: biz.actualLedger, locationName: 'DetailedCloseTest Outlet A', customerName: 'Cash Sale', lines: [{ itemName: 'DetailedCloseTest Merlot', quantity: 1, unitPriceMinor: 100000, taxMinor: 0, tier: 'Bottle' }], taxAccount: 'Sales Tax Payable', paymentMethod: 'cash', cashTenderedMinor: 100000 }, 1);
  completePosSale({ business: biz.business, ledger: biz.actualLedger, locationName: 'DetailedCloseTest Outlet B', customerName: 'Cash Sale', lines: [{ itemName: 'DetailedCloseTest Merlot', quantity: 1, unitPriceMinor: 60000, taxMinor: 0, tier: 'Bottle' }], taxAccount: 'Sales Tax Payable', paymentMethod: 'cash', cashTenderedMinor: 60000 }, 1);

  stageLine({ reference: 'DCT-3', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-03', account: 'Sales Revenue', amount_minor: -20000 });
  stageLine({ reference: 'DCT-3', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-03', account: 'Cash and Bank', amount_minor: 20000 });
  postJournalEntry('DCT-3', biz.business, biz.actualLedger, 1);

  closeBooks(biz.business, biz.actualLedger, '2027-12-31', "Owner's Equity", 1);

  const reLines = db
    .prepare(
      `SELECT jl.amount_minor, d.name AS division
       FROM journal_line jl
       JOIN journal j ON j.id = jl.journal_id
       JOIN current_entities e ON e.id = jl.account_id
       LEFT JOIN current_entities d ON d.id = jl.division_id
       WHERE j.reference LIKE 'CLOSE-%' AND e.name = ?
         AND j.business_id = (SELECT id FROM current_entities WHERE name = ?)
         AND j.ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ?))`
    )
    .all("Owner's Equity", biz.business, biz.actualLedger, biz.business) as { amount_minor: number; division: string | null }[];

  assert.equal(reLines.length, 3, 'the whole point of the restructuring — a real, separate, detailed line per real, active profit center, not one, single, combined line');

  const divA = reLines.find((l) => l.division === 'DetailedCloseTest Division A');
  const divB = reLines.find((l) => l.division === 'DetailedCloseTest Division B');
  const undivided = reLines.find((l) => l.division === null);
  assert.ok(divA && divB && undivided, 'all three real, distinct lines must be present — two real divisions plus the real, undivided remainder');
  assert.equal(divA!.amount_minor, -100000, "Division A's own real $1,000 profit, correctly credited (negative — Retained Earnings is credit-normal)");
  assert.equal(divB!.amount_minor, -60000, "Division B's own real $600 profit, correctly credited");
  assert.equal(undivided!.amount_minor, -20000, 'the real, undivided $200 remainder, correctly credited under no division at all');

  // The real, whole entry must still, genuinely balance overall — a
  // real, detailed breakdown on one side must never come at the cost
  // of the fundamental double-entry guarantee.
  const allLines = db
    .prepare(`SELECT jl.amount_minor FROM journal_line jl JOIN journal j ON j.id = jl.journal_id WHERE j.reference LIKE 'CLOSE-%' AND j.business_id = (SELECT id FROM current_entities WHERE name = ?) AND j.ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ?))`)
    .all(biz.business, biz.actualLedger, biz.business) as { amount_minor: number }[];
  const total = allLines.reduce((s, l) => s + l.amount_minor, 0);
  assert.equal(total, 0, 'the real, whole close entry must still sum to exactly zero, regardless of how many real, separate Retained Earnings lines it now contains');
});

test('completePosSale: the real, live wiring — a real sale with a real tier now genuinely ensures its own, real tier-level item, not just its own Sales/COGS accounts', () => {
  createEntity({ name: 'PosWireTest2 Outlet', parent: 'Locations' }, 1);
  setLocation('PosWireTest2 Outlet', { city: 'PosWireTest2 City', location_type: 'Retail', is_billing_address: false, bottle_capacity: 500, carton_capacity: 80 , timezone: 'UTC'});
  createItem('PosWireTest2 Merlot', 'Items', 1);
  receiveStockAtLocation('My Business', 'Actual', 'POSWIRE2-REC-1', 'PosWireTest2 Merlot', 'PosWireTest2 Outlet', 20, 1, '2027-01-01');

  // No revenueAccount override — this is the real, direct path a real
  // POS sale takes in production, exercising the real, new,
  // tier-resolving fallback logic directly.
  const result = completePosSale(
    {
      business: 'My Business',
      ledger: 'Actual',
      locationName: 'PosWireTest2 Outlet',
      customerName: 'Cash Sale',
      lines: [{ itemName: 'PosWireTest2 Merlot', quantity: 2, unitPriceMinor: 1500, taxMinor: 300, tier: 'Bottle' }],
      taxAccount: 'Sales Tax Payable',
      paymentMethod: 'cash',
      cashTenderedMinor: 5000,
    },
    1
  );
  assert.equal(result.totalMinor, 2 * 1500 + 300);

  const tree = getEntityTree();
  const candidates = tree.filter((e) => e.name === 'PosWireTest2 Merlot (Bottle)');
  const salesLeaf = candidates.find((e) => e.is_postable_account);
  assert.ok(salesLeaf, "the tier-level item's own real Sales leaf must also genuinely exist");
  const tierItem = candidates.find((e) => e.parent_id === salesLeaf!.id);
  assert.ok(tierItem, 'a real, live POS sale with a real tier must genuinely ensure its own, new, tier-level item entity — not just its own Sales/COGS accounts');
  assert.equal(tierItem!.is_postable_account, false, 'a real item is never itself a real, postable GL account');
  assert.equal(tierItem!.parent_id, salesLeaf!.id, "the real, new tier-level item must be a genuine, structural child of its own real Sales leaf");

  // The real, base, tier-less item itself must remain completely
  // untouched — stock-tracking and invoice-line itemName references
  // are a real, deliberately separate, later step, not item of this
  // same change.
  const baseItem = tree.find((e) => e.name === 'PosWireTest2 Merlot');
  assert.ok(baseItem, 'the real, base, tier-less item must still exist, genuinely unaffected');

  assert.equal(getItemLocation('PosWireTest2 Merlot', 'PosWireTest2 Outlet').quantity_on_hand, 18, 'stock-tracking still, correctly resolves through the real, base, tier-less item — unchanged in this step');
});

test('reverseJournalEntry: a real, confirmed bug fix — reversing a year-end close with multiple, real, division-tagged Retained Earnings lines must genuinely reverse ALL of them, not silently collapse onto just the last one', () => {
  const biz = createBusiness('ReverseCloseTest2 Co', '2027-28', 1);
  createEntity({ name: 'ReverseCloseTest2 Division A', parent: 'Divisions' }, 1);
  createEntity({ name: 'ReverseCloseTest2 Division B', parent: 'Divisions' }, 1);
  createEntity({ name: 'ReverseCloseTest2 Outlet A', parent: 'Locations' }, 1);
  setLocation('ReverseCloseTest2 Outlet A', { city: 'ReverseCloseTest2 Division A', location_type: 'Retail', is_billing_address: false, bottle_capacity: 500, carton_capacity: 80 , timezone: 'UTC'});
  createEntity({ name: 'ReverseCloseTest2 Outlet B', parent: 'Locations' }, 1);
  setLocation('ReverseCloseTest2 Outlet B', { city: 'ReverseCloseTest2 Division B', location_type: 'Retail', is_billing_address: false, bottle_capacity: 500, carton_capacity: 80 , timezone: 'UTC'});
  createItem('ReverseCloseTest2 Merlot', 'Items', 1);
  receiveStockAtLocation(biz.business, biz.actualLedger, 'RCT2-REC-A', 'ReverseCloseTest2 Merlot', 'ReverseCloseTest2 Outlet A', 20, 1, '2027-06-01');
  receiveStockAtLocation(biz.business, biz.actualLedger, 'RCT2-REC-B', 'ReverseCloseTest2 Merlot', 'ReverseCloseTest2 Outlet B', 20, 1, '2027-06-01');

  completePosSale({ business: biz.business, ledger: biz.actualLedger, locationName: 'ReverseCloseTest2 Outlet A', customerName: 'Cash Sale', lines: [{ itemName: 'ReverseCloseTest2 Merlot', quantity: 1, unitPriceMinor: 50000, taxMinor: 0, tier: 'Bottle' }], taxAccount: 'Sales Tax Payable', paymentMethod: 'cash', cashTenderedMinor: 50000 }, 1);
  completePosSale({ business: biz.business, ledger: biz.actualLedger, locationName: 'ReverseCloseTest2 Outlet B', customerName: 'Cash Sale', lines: [{ itemName: 'ReverseCloseTest2 Merlot', quantity: 1, unitPriceMinor: 30000, taxMinor: 0, tier: 'Bottle' }], taxAccount: 'Sales Tax Payable', paymentMethod: 'cash', cashTenderedMinor: 30000 }, 1);

  const closeResult = closeBooks(biz.business, biz.actualLedger, '2027-12-31', "Owner's Equity", 1);
  const closeJournal = db.prepare(`SELECT id FROM journal WHERE reference = ? AND business_id = (SELECT id FROM current_entities WHERE name = ?) AND ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ?))`).get(closeResult.reference, biz.business, biz.actualLedger, biz.business) as { id: number };

  // This must not throw — the real, exact bug report: "entry does not
  // balance (per currency)".
  reverseJournalEntry(biz.business, biz.actualLedger, closeJournal.id, '2027-12-31', 1);

  const reversalLines = db
    .prepare(
      `SELECT jl.amount_minor, d.name AS division, e.name AS account
       FROM journal_line jl
       JOIN journal j ON j.id = jl.journal_id
       JOIN current_entities e ON e.id = jl.account_id
       LEFT JOIN current_entities d ON d.id = jl.division_id
       WHERE j.reference = ?`
    )
    .all(`${closeResult.reference}-REV-2027-12-31`) as { amount_minor: number; division: string | null; account: string }[];

  assert.equal(reversalLines.length, 4, 'the real reversal must contain all four, real, distinct original lines — two real, division-tagged Retained Earnings lines plus two, real, separate, location-specific Sales-zeroing lines — not collapse onto fewer');
  const revDivA = reversalLines.find((l) => l.division === 'ReverseCloseTest2 Division A');
  const revDivB = reversalLines.find((l) => l.division === 'ReverseCloseTest2 Division B');
  assert.ok(revDivA && revDivB, "both real, division-tagged Retained Earnings lines must survive the reversal independently, each with their own real division intact");
  assert.equal(revDivA!.amount_minor, 50000);
  assert.equal(revDivB!.amount_minor, 30000);

  const total = reversalLines.reduce((s, l) => s + l.amount_minor, 0);
  assert.equal(total, 0, 'the real, whole reversal entry must genuinely balance to exactly zero');
});

test('ensureProductTierLocationLeaf: location becomes structural, the same real pattern already proven for tier — a real, new, distinct leaf per (tier, location), never re-parenting the shared tier-level item, avoiding the exact bug that broke an earlier tier-restructuring attempt', () => {
  createEntity({ name: 'LocTest2 Beer', parent: 'Items' }, 1);
  createEntity({ name: 'LocTest2 Ale', parent: 'LocTest2 Beer' }, 1);
  createEntity({ name: 'LocTest2 Amber Ale 330ml', parent: 'LocTest2 Ale' }, 1);
  createEntity({ name: 'LocTest2 Riverside Cellars', parent: 'Locations' }, 1);
  setLocation('LocTest2 Riverside Cellars', { city: 'LocTest2 City', location_type: 'Retail', is_billing_address: false, bottle_capacity: 500, carton_capacity: 80 , timezone: 'UTC'});
  createEntity({ name: 'LocTest2 Uptown Wine', parent: 'Locations' }, 1);
  setLocation('LocTest2 Uptown Wine', { city: 'LocTest2 City', location_type: 'Retail', is_billing_address: false, bottle_capacity: 500, carton_capacity: 80 , timezone: 'UTC'});

  const bottle = ensureProductTierItem('LocTest2 Amber Ale 330ml', 'Bottle', 1);
  const locA = ensureProductTierLocationLeaf(bottle.tierItemName, 'LocTest2 Riverside Cellars', 1, bottle.tierItemId);
  const locB = ensureProductTierLocationLeaf(bottle.tierItemName, 'LocTest2 Uptown Wine', 1, bottle.tierItemId);

  const tree = getEntityTree();

  // The real, critical property this whole design fixes: the shared,
  // tier-level item's own real parent must never move, no matter how
  // many real locations are processed for it.
  const tierItem = tree.find((e) => e.id === bottle.tierItemId)!;
  const tierItemParent = tree.find((e) => e.id === tierItem.parent_id);
  assert.equal(tierItemParent?.name, bottle.salesAccount, "the shared, tier-level item's own real parent must never move, regardless of how many locations are created for it");

  for (const result of [locA, locB]) {
    const leaf = tree.find((e) => e.id === result.leafItemId)!;
    const leafParent = tree.find((e) => e.id === leaf.parent_id);
    assert.equal(leafParent?.name, result.salesAccount, "each real location's own leaf must be a genuine, structural child of its own, real, new, location-specific Sales leaf");
    assert.equal(leaf.is_postable_account, false, 'a real item is never itself a real, postable GL account');
    assert.equal(getDimensionParent(result.leafItemName, 'COGS Product'), result.cogsAccount, "COGS must reach the same, real leaf via the real dimension mechanism, not a second, real structural parent");
  }

  assert.notEqual(locA.leafItemName, locB.leafItemName, 'two, real, different locations must produce two, real, genuinely distinct leaves');
  assert.notEqual(locA.salesAccount, locB.salesAccount);

  // A real, repeated call for the same (tier, location) must be
  // genuinely idempotent, never throw, never duplicate.
  const locAAgain = ensureProductTierLocationLeaf(bottle.tierItemName, 'LocTest2 Riverside Cellars', 1, bottle.tierItemId);
  assert.deepEqual(locAAgain, locA);
});

test('completePosSale: the real, live wiring — a real sale with both a real tier and a real, known location now genuinely ensures its own, real (tier, location) leaf, the real, actual posting target', () => {
  createEntity({ name: 'LiveWireTest2 Outlet', parent: 'Locations' }, 1);
  setLocation('LiveWireTest2 Outlet', { city: 'LiveWireTest2 City', location_type: 'Retail', is_billing_address: false, bottle_capacity: 500, carton_capacity: 80 , timezone: 'UTC'});
  createItem('LiveWireTest2 Merlot', 'Items', 1);
  receiveStockAtLocation('My Business', 'Actual', 'LWT2-REC-1', 'LiveWireTest2 Merlot', 'LiveWireTest2 Outlet', 20, 1, '2027-01-01');

  // No revenueAccount override — the real, direct, live path a real
  // POS sale takes in production.
  const result = completePosSale(
    {
      business: 'My Business',
      ledger: 'Actual',
      locationName: 'LiveWireTest2 Outlet',
      customerName: 'Cash Sale',
      lines: [{ itemName: 'LiveWireTest2 Merlot', quantity: 2, unitPriceMinor: 1500, taxMinor: 300, tier: 'Bottle' }],
      taxAccount: 'Sales Tax Payable',
      paymentMethod: 'cash',
      cashTenderedMinor: 5000,
    },
    1
  );
  assert.equal(result.totalMinor, 2 * 1500 + 300);

  const tree = getEntityTree();
  const leafCandidates = tree.filter((e) => e.name === 'LiveWireTest2 Merlot (Bottle) — LiveWireTest2 Outlet');
  const salesLeaf = leafCandidates.find((e) => e.is_postable_account);
  assert.ok(salesLeaf, "the (tier, location) leaf's own real Sales account must also genuinely exist");
  const leaf = leafCandidates.find((e) => e.parent_id === salesLeaf!.id);
  assert.ok(leaf, 'a real, live POS sale with both a real tier and a real, known location must genuinely ensure its own, new (tier, location) leaf');
  assert.equal(leaf!.is_postable_account, false);
  assert.equal(leaf!.parent_id, salesLeaf!.id, 'the real, new leaf must be a genuine, structural child of its own, real, location-specific Sales leaf');

  // The real, shared, tier-level item itself must remain completely
  // untouched.
  const tierCandidates = tree.filter((e) => e.name === 'LiveWireTest2 Merlot (Bottle)');
  const tierSalesLeaf = tierCandidates.find((e) => e.is_postable_account);
  assert.ok(tierSalesLeaf, "the tier's own real Sales leaf must still exist");
  const tierItem = tierCandidates.find((e) => e.parent_id === tierSalesLeaf!.id);
  assert.ok(tierItem, 'the real, shared, tier-level item must still exist, genuinely unaffected');
  assert.equal(tierItem!.parent_id, tierSalesLeaf!.id, "the shared, tier-level item's own real parent must never move");
});

test('getLocationForAccount/getDivisionForAccount: the real, structural replacement for journal_line.division_id — walking a real account to its own, real, structural location and division, not reading a separate tag', () => {
  createEntity({ name: 'DeriveTest2 Springfield', parent: 'Divisions' }, 1);
  createEntity({ name: 'DeriveTest2 Outlet', parent: 'Locations' }, 1);
  setLocation('DeriveTest2 Outlet', { city: 'DeriveTest2 Springfield', location_type: 'Retail', is_billing_address: false, bottle_capacity: 500, carton_capacity: 80 , timezone: 'UTC'});
  createEntity({ name: 'DeriveTest2 Beer', parent: 'Items' }, 1);
  createEntity({ name: 'DeriveTest2 Ale', parent: 'DeriveTest2 Beer' }, 1);
  createEntity({ name: 'DeriveTest2 Amber Ale 330ml', parent: 'DeriveTest2 Ale' }, 1);

  const bottle = ensureProductTierItem('DeriveTest2 Amber Ale 330ml', 'Bottle', 1);
  const leaf = ensureProductTierLocationLeaf(bottle.tierItemName, 'DeriveTest2 Outlet', 1);

  assert.equal(getLocationForAccount(leaf.salesAccount), 'DeriveTest2 Outlet', "a real Sales leaf's own real location must be walkable directly, structurally");
  assert.equal(getLocationForAccount(leaf.cogsAccount), 'DeriveTest2 Outlet', "its own real COGS counteritem must resolve to the exact same, real location");
  assert.equal(getDivisionForAccount(leaf.salesAccount), 'DeriveTest2 Springfield', "the real division must be correctly derived by walking location, then location-to-division — the exact same, real resolution cityDivisionFor already provides");
  assert.equal(getDivisionForAccount(leaf.cogsAccount), 'DeriveTest2 Springfield');

  // An ordinary, non-product account has no real, structural location
  // at all — must correctly, honestly return undefined, never a
  // fabricated guess.
  assert.equal(getLocationForAccount('Cash and Bank'), undefined);
  assert.equal(getDivisionForAccount('Cash and Bank'), undefined);
});

test('getLedgerBalancesByDivisionStructural: the real, new, structural version must agree exactly with the existing, tag-based one on real, live sales that carry both', () => {
  const biz = createBusiness('StructTest6 Co', '2027-28', 1);
  createEntity({ name: 'StructTest6 Springfield', parent: 'Divisions' }, 1);
  createEntity({ name: 'StructTest6 Rivertown', parent: 'Divisions' }, 1);
  createEntity({ name: 'StructTest6 Outlet A', parent: 'Locations' }, 1);
  setLocation('StructTest6 Outlet A', { city: 'StructTest6 Springfield', location_type: 'Retail', is_billing_address: false, bottle_capacity: 500, carton_capacity: 80 , timezone: 'UTC'});
  createEntity({ name: 'StructTest6 Outlet B', parent: 'Locations' }, 1);
  setLocation('StructTest6 Outlet B', { city: 'StructTest6 Rivertown', location_type: 'Retail', is_billing_address: false, bottle_capacity: 500, carton_capacity: 80 , timezone: 'UTC'});
  createItem('StructTest6 Merlot', 'Items', 1);
  const today = new Date().toISOString().slice(0, 10);
  receiveStockAtLocation(biz.business, biz.actualLedger, 'ST6-REC-1', 'StructTest6 Merlot', 'StructTest6 Outlet A', 20, 1, today);
  receiveStockAtLocation(biz.business, biz.actualLedger, 'ST6-REC-2', 'StructTest6 Merlot', 'StructTest6 Outlet B', 20, 1, today);

  completePosSale({ business: biz.business, ledger: biz.actualLedger, locationName: 'StructTest6 Outlet A', customerName: 'Cash Sale', lines: [{ itemName: 'StructTest6 Merlot', quantity: 2, unitPriceMinor: 1500, taxMinor: 0, tier: 'Bottle' }], taxAccount: 'Sales Tax Payable', paymentMethod: 'cash', cashTenderedMinor: 5000 }, 1);
  completePosSale({ business: biz.business, ledger: biz.actualLedger, locationName: 'StructTest6 Outlet B', customerName: 'Cash Sale', lines: [{ itemName: 'StructTest6 Merlot', quantity: 3, unitPriceMinor: 1500, taxMinor: 0, tier: 'Bottle' }], taxAccount: 'Sales Tax Payable', paymentMethod: 'cash', cashTenderedMinor: 5000 }, 1);

  const oldResult = getLedgerBalancesByDivision(biz.business, biz.actualLedger);
  const newResult = getLedgerBalancesByDivisionStructural(biz.business, biz.actualLedger);

  const tree = getEntityTree();
  function salesByDivision(map: Map<number, Map<string | null, number>>) {
    const out: Record<string, number> = {};
    for (const [acctId, divMap] of map.entries()) {
      const acct = tree.find((e) => e.id === acctId);
      if (!acct || !acct.name.startsWith('StructTest6')) continue;
      for (const [div, bal] of divMap.entries()) {
        if (bal !== 0 && div !== null) out[div] = (out[div] ?? 0) + bal;
      }
    }
    return out;
  }

  const oldSales = salesByDivision(oldResult);
  const newSales = salesByDivision(newResult);
  assert.equal(newSales['StructTest6 Springfield'], -3000, 'the real, new, structural version must correctly derive the real division from the real, structural location link');
  assert.equal(newSales['StructTest6 Rivertown'], -4500);
  assert.deepEqual(newSales, oldSales, 'the real, new, structural version must agree exactly with the real, existing, tag-based one on the exact same, real, live data');
});

test('getProfitAndLossByAxis: real, direct reproducibility — every real division and every real location must exactly reproduce the original, division-filtered P&L (Sales AND COGS both), per direct, reported concern', async () => {
  const { getProfitAndLossByAxis } = await import('../src/db-matrix-reports.ts');
  const biz = createBusiness('ReproTest Co', '2027-28', 1);
  createEntity({ name: 'ReproTest Division', parent: 'Divisions' }, 1);
  createEntity({ name: 'ReproTest Outlet', parent: 'Locations' }, 1);
  setLocation('ReproTest Outlet', { city: 'ReproTest Division', location_type: 'Retail', is_billing_address: false, bottle_capacity: 500, carton_capacity: 80 , timezone: 'UTC'});
  createItem('ReproTest Merlot', 'Items', 1);
  const today = new Date().toISOString().slice(0, 10);
  receiveStockAtLocation(biz.business, biz.actualLedger, 'REPRO-REC-1', 'ReproTest Merlot', 'ReproTest Outlet', 20, 1, today);

  completePosSale(
    { business: biz.business, ledger: biz.actualLedger, locationName: 'ReproTest Outlet', customerName: 'Cash Sale', lines: [{ itemName: 'ReproTest Merlot', quantity: 2, unitPriceMinor: 1500, taxMinor: 0, tier: 'Bottle' }], taxAccount: 'Sales Tax Payable', paymentMethod: 'cash', cashTenderedMinor: 3000 },
    1
  );

  // A real, confirmed bug (found via a direct, reported concern):
  // completePosSale's own COGS recognition (in the simulation script,
  // and mirrored here directly since this unit test posts its own
  // COGS the same, real way) must reach the real, structural,
  // location-specific leaf too, not just the real, plain, tier-level
  // account — otherwise a real, structural, location-driven report
  // shows real Sales but zero real COGS, while the original,
  // division-tag-driven P&L still looks correct only because it
  // reads a real, different, older mechanism.
  const tierItem = ensureProductTierItem('ReproTest Merlot', 'Bottle', 1);
  const { cogsAccount, cogsAccountId } = ensureProductTierLocationLeaf(tierItem.tierItemName, 'ReproTest Outlet', 1, tierItem.tierItemId);
  stageLine({ reference: 'REPRO-COGS', business: biz.business, ledger: biz.actualLedger, transdate: today, account: cogsAccount, accountId: cogsAccountId, amount_minor: 2000, division: 'ReproTest Division' });
  stageLine({ reference: 'REPRO-COGS', business: biz.business, ledger: biz.actualLedger, transdate: today, account: 'Inventory', amount_minor: -2000, division: 'ReproTest Division' });
  postJournalEntry('REPRO-COGS', biz.business, biz.actualLedger, 1);

  const originalPL = getProfitAndLoss(biz.business, biz.actualLedger, undefined, undefined, 'ReproTest Division');
  const newNewPLByDivision = getProfitAndLossByAxis(biz.business, biz.actualLedger, undefined, undefined, 'Division', 'Consolidated', 'ReproTest Division');
  const newNewPLByLocation = getProfitAndLossByAxis(biz.business, biz.actualLedger, undefined, undefined, 'Location', 'Consolidated', 'ReproTest Outlet');

  assert.equal(originalPL.total_expenses_minor, 2000, 'the real, original P&L must show the real, non-zero COGS directly');
  assert.equal(newNewPLByDivision[0]?.profitAndLoss.total_income_minor, originalPL.total_income_minor, 'Division-axis income must exactly reproduce the original');
  assert.equal(newNewPLByDivision[0]?.profitAndLoss.total_expenses_minor, originalPL.total_expenses_minor, 'Division-axis COGS must exactly reproduce the original — the real, confirmed bug this test guards against');
  assert.equal(newNewPLByLocation[0]?.profitAndLoss.total_income_minor, originalPL.total_income_minor, 'Location-axis income must exactly reproduce the original');
  assert.equal(newNewPLByLocation[0]?.profitAndLoss.total_expenses_minor, originalPL.total_expenses_minor, 'Location-axis COGS must exactly reproduce the original — the real, confirmed bug this test guards against');
});

test('createEntity: scoped, not global, uniqueness — the exact, same real rule everywhere else in the entity tree, verified specifically for Vocabulary and its own real translations', () => {
  createEntity({ name: 'VocabDupeTest', parent: 'Vocabulary' }, 1);
  assert.throws(
    () => createEntity({ name: 'VocabDupeTest', parent: 'Vocabulary' }, 1),
    /already exists/,
    'a real, direct, second Vocabulary word with the exact same name under the exact same, real parent must still be rejected'
  );

  const businessCopy = createEntity({ name: 'VocabDupeTest', parent: 'Businesses' }, 1);
  assert.ok(businessCopy, 'the exact, same real name must genuinely be allowed again under a real, different parent — a Vocabulary word and a business are not real siblings of each other');

  setTranslation('VocabDupeTest', 'English', 'First real translation', 1);
  assert.equal(getTranslation('VocabDupeTest', 'English'), 'First real translation', 'the first real translation for this concept, in this language, is set correctly');

  setTranslation('VocabDupeTest', 'English', 'A real, second, replacing translation', 1);
  assert.equal(
    getTranslation('VocabDupeTest', 'English'),
    'A real, second, replacing translation',
    'a real, second setTranslation call for the exact, same (concept, language) pair genuinely replaces the prior one — matching the established, real ON CONFLICT DO UPDATE semantics — never leaving two, real, competing entities behind for the same fact'
  );
  const englishChildren = db
    .prepare(`SELECT COUNT(*) AS c FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'English') AND relation_id = (SELECT id FROM current_entities WHERE name = 'VocabDupeTest')`)
    .get() as { c: number };
  assert.equal(englishChildren.c, 1, 'exactly one real, live child entity exists for this (concept, language) pair — the stale, prior translation was genuinely removed, not left behind as a second, orphaned entity');
});
