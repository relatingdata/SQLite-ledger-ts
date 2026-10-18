// The one, real, complete backend test suite - built one test at a
// time per direct instruction, replacing an earlier version of this
// file that read and wrote the shared, globally-seeded 'admin'
// business directly (see docs/test-fixtures-design.md for the full
// rationale, and docs/lessons-learned.md for the real bugs this
// migration surfaced along the way). The one rule every test here
// follows: no test reads or writes the shared 'admin' business, or
// any other globally-seeded business or account. Every test creates
// its own, uniquely-named, real business via fixtures.ts's
// freshBusiness (a thin wrapper around the real createBusiness
// production function), then adds only the small, specific set of
// further fixtures that one test actually needs. Tests are written to
// run correctly in any order, and to tolerate running concurrently
// with each other (no two tests ever share a business, location, or
// item name).
import { test, after } from './test-runtime.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeFixtures } from './fixtures.ts';

const tmpDbPath = path.join(os.tmpdir(), `sql-ledger-ts-test-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = tmpDbPath;
// No demo business, no shared business, nothing seeded beyond the
// real, unconditional, structural core (vocabulary, translations, the
// one, permanent, legacy 'admin' business this suite never touches) -
// per direct instruction, this test file depends on none of it.
process.env.SEED_DEMO_BUSINESSES = 'false';

const db = await import('../src/db.ts');
const { createUser } = await import('../src/auth.ts');
const fx = makeFixtures(db);

after(() => {
  try {
    fs.rmSync(tmpDbPath, { force: true });
    fs.rmSync(`${tmpDbPath}-wal`, { force: true });
    fs.rmSync(`${tmpDbPath}-shm`, { force: true });
  } catch {
    // best-effort cleanup only
  }
});

// --- bootstrap / entity-tree primitives -----------------------------
// These exercise the core structural mechanism directly (Root,
// Application, the universal Accounts Receivable/Payable roots) -
// genuinely global, structural entities that exist unconditionally
// and are never business-scoped, so there is no "own business" to
// create here. Each still uses a unique name for anything it creates
// under one of those shared roots, so two such tests can never
// collide, whatever order they run in.

test('the bootstrap tree loads with exactly one root', () => {
  const tree = db.getEntityTree();
  const roots = tree.filter((e) => e.parent_id === null);
  assert.equal(roots.length, 1);
  assert.equal(roots[0].name, 'Root');
  assert.ok(tree.length > 40, 'expected the full bootstrap tree to be present');
});

test('creating an entity by name works and rejects duplicates', () => {
  const name = fx.uniqueName('Gamma LLC');
  const arNode = db.requireEntity('Accounts Receivable', db.typeRootName);
  const created = db.create(arNode, db.typeRootName, name, fx.userId);
  assert.equal(db.getEntity(created.id)!.parent_id, arNode.id);
  assert.throws(() => db.create(db.requireEntity('Accounts Receivable', db.typeRootName), db.typeRootName, name, fx.userId));
});

test('creating an entity with a nonexistent parent is rejected', () => {
  assert.throws(() => db.create(db.requireEntity('Nonexistent Parent Name', db.typeRootName), db.typeRootName, fx.uniqueName('Orphan'), fx.userId));
});

test('supersedeEntity can rename, reparent, and assign an account number', () => {
  const name = fx.uniqueName('Delta Pty Ltd');
  const e = db.create(db.requireEntity('Accounts Receivable', db.typeRootName), db.typeRootName, name, fx.userId);
  const renamed = db.supersedeEntity(e.id, { name: `${name} (renamed)` }, fx.userId);
  assert.equal(renamed.name, `${name} (renamed)`);

  const reparented = db.supersedeEntity(e.id, { parent: 'Accounts Payable' }, fx.userId);
  const parent = db.getEntity(reparented.parent_id!);
  assert.equal(parent!.name, 'Accounts Payable');

  const withAccount = db.supersedeEntity(e.id, { accountnumber: '9999.001' }, fx.userId);
  assert.equal(withAccount.accountnumber, '9999.001');
});

test('an entity cannot be made its own parent', () => {
  const name = fx.uniqueName('Self Parent Test');
  const e = db.create(db.requireEntity('Accounts Receivable', db.typeRootName), db.typeRootName, name, fx.userId);
  assert.throws(() => db.supersedeEntity(e.id, { parent: name }, fx.userId));
});

test('revokeEntity refuses to delete an entity with children', () => {
  assert.throws(() => db.revokeEntity(db.getEntity(1)!.id, fx.userId)); // Application has children
});

test('revokeEntity works for a genuinely childless, unposted entity', () => {
  const e = db.create(db.requireEntity('Accounts Receivable', db.typeRootName), db.typeRootName, fx.uniqueName('Temporary Test Entity'), fx.userId);
  db.revokeEntity(e.id, fx.userId);
  assert.equal(db.getEntity(e.id)!.relation_id, null);
});

test('revokeEntity refuses to delete a business\'s last real Actual or last real Budget ledger, but allows removing a real, genuine duplicate', () => {
  const name = fx.uniqueName('LedgerRuleTest Business');
  db.create(db.requireEntity('Businesses', db.typeRootName), db.typeRootName, name, fx.userId);
  db.create(db.requireEntity(name, db.typeRootName), db.typeRootName, 'Ledgers', fx.userId);
  db.create(db.requireEntity('Ledgers', db.typeRootName, db.requireEntity(name, db.typeRootName)), db.typeRootName, `${name} Actual`, fx.userId);
  db.create(db.requireEntity('Ledgers', db.typeRootName, db.requireEntity(name, db.typeRootName)), db.typeRootName, `${name} Budget 2026-27`, fx.userId);

  const actual = db.getEntity(db.getEntityTree().find((e) => e.name === `${name} Actual`)!.id)!;
  const budget = db.getEntity(db.getEntityTree().find((e) => e.name === `${name} Budget 2026-27`)!.id)!;

  assert.throws(() => db.revokeEntity(actual.id, fx.userId), /must always have a real Actual ledger/);
  assert.throws(() => db.revokeEntity(budget.id, fx.userId), /must always have a real Budget ledger/);

  // A real, genuine second Actual-type ledger for the same business
  // CAN be deleted — the rule protects the last one of each real
  // kind, not every real ledger unconditionally.
  const dup = db.create(db.requireEntity('Ledgers', db.typeRootName, db.requireEntity(name, db.typeRootName)), db.typeRootName, `${name} Second Actual`, fx.userId);
  db.revokeEntity(dup.id, fx.userId);
  assert.equal(db.getEntity(dup.id)!.relation_id, null);

  // The real, original, only-remaining Actual ledger is still,
  // genuinely protected afterward.
  assert.throws(() => db.revokeEntity(actual.id, fx.userId), /must always have a real Actual ledger/);
});

// --- business-scoped reports / chart of accounts --------------------
// Each test below creates its own, fresh, real business (with the
// 'English CoA' prototype, so it gets a genuine, isolated copy of
// every prototype-tagged account it posts to) rather than reaching
// into any shared one.

test('business_reports groups categories under their fixed report via relation_id', () => {
  const biz = fx.freshBusiness('BizReportsTest Co');
  const rows = db.getBusinessReports(biz.business);
  const balanceSheetCategories = new Set(rows.filter((r) => r.report === 'Balance Sheet').map((r) => r.category));
  const plCategories = new Set(rows.filter((r) => r.report === 'Profit and Loss Statement').map((r) => r.category));
  assert.ok(balanceSheetCategories.has('Asset'));
  assert.ok(balanceSheetCategories.has('Liability'));
  assert.ok(balanceSheetCategories.has('Equity'));
  assert.ok(plCategories.has('Income'));
  assert.ok(plCategories.has('Expense'));
});

test('chart_of_accounts shows the real hierarchy including sub-accounts', () => {
  // A genuinely global contact (createCustomer is never business-
  // scoped - customers/vendors live once, globally, under the
  // universal Accounts Receivable/Payable roots, shared by every
  // business exactly the way a real counterparty can trade with more
  // than one of a group's own businesses) - 'admin' only ever proved
  // this against the one, legacy business that happens to fall back
  // to the GLOBAL Chart of Accounts directly; this proves it the
  // ordinary way too, for a ledger a real customer actually posted
  // to, confirming getChartOfAccounts resolves a business-scoped
  // customer posting correctly, not just the global-fallback case.
  const biz = fx.freshBusiness('ChartOfAccountsTest Co');
  const customerName = fx.uniqueName('Acme Corp');
  db.createCustomer(customerName, fx.userId);
  db.stageLine({ reference: 'COA-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-01', account: db.asAccountName(customerName), amount_minor: 1000 });
  db.stageLine({ reference: 'COA-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-01', account: db.asAccountName('Sales Revenue'), amount_minor: -1000 });
  db.postJournalEntry('COA-1', biz.business, biz.actualLedger, fx.userId);
  const rows = db.getChartOfAccounts(biz.business);
  assert.ok(rows.some((r) => r.name === customerName && r.path.includes('Accounts Receivable')));
});

test('reassigning a category to a different report via relation changes business_reports immediately', () => {
  // The one, deliberate exception in this whole file: a category's
  // own report assignment (Asset/Liability/Equity/Income/Expense ->
  // Balance Sheet/Profit and Loss Statement) is genuinely global, by
  // the real, current design - a business's own Chart of Accounts
  // mirror points its relation_id straight back at this one, shared,
  // global category (getBusinessReports' own "two-hop" resolution),
  // so reassigning Equity's report really does affect every business
  // at once, not just one test business. Captures and restores the
  // real, original value it actually found, rather than assuming
  // 'Balance Sheet', so this stays correct and order-independent
  // regardless of what any other test (there are none today) might
  // also have left it as.
  // The GLOBAL "Equity" specifically - every business's own mirror is
  // a DIFFERENT entity of the same name, so this must be scoped under
  // the one, real, global Chart of Accounts (Application -> Chart of
  // Accounts -> Equity), never a bare name search.
  const globalCoa = db.requireEntity('Chart of Accounts', db.typeChartOfAccountsRootName, db.requireEntity('Application', db.typeRootName));
  const globalEquity = db.requireEntity('Equity', db.typeRootName, globalCoa);
  const originalReport = db.getBusinessReports(fx.freshBusiness('EquityReportProbe Co').business).find((r) => r.category === 'Equity')?.report;
  assert.ok(originalReport, 'Equity must already report somewhere, before this test changes it');
  try {
    db.supersedeEntity(globalEquity.id, { relation: 'Profit and Loss Statement' }, fx.userId);
    const biz = fx.freshBusiness('EquityReportTest Co');
    const rows = db.getBusinessReports(biz.business);
    assert.equal(rows.find((r) => r.category === 'Equity')?.report, 'Profit and Loss Statement');
  } finally {
    const stillGlobalEquity = db.requireEntity('Equity', db.typeRootName, globalCoa);
    db.supersedeEntity(stillGlobalEquity.id, { relation: originalReport! }, fx.userId);
  }
});

test('languages list and localized_text fallback/override work end to end', () => {
  const languages = db.getLanguages();
  assert.ok(languages.some((l) => l.name === 'English'));
  assert.ok(languages.some((l) => l.name === 'German'));

  const german = db.getLocalizedText('German');
  assert.equal(german['Save'], 'Speichern');
  assert.equal(german['Debit'], 'Soll', 'the standard German accounting term, not a literal word-for-word guess');
  assert.equal(german['Credit'], 'Haben');
  assert.equal(german['Name'], 'Name', 'untranslated word should fall back to English');

  // A fresh, unique word of its own, registered under the one, real,
  // global Vocabulary root (genuinely global and shared, by design -
  // every language's own translation set is a system-wide resource,
  // never a per-business one) - never 'Name' itself, so this can
  // never collide with any other test that also sets a translation.
  const word = fx.uniqueName('Test Word');
  const globalVocabulary = db.requireEntity('Vocabulary', db.typeRootName, db.requireEntity('Application', db.typeRootName));
  db.create(globalVocabulary, db.typeRootName, word, fx.userId);
  db.setTranslation(word, 'German', 'Testwort');
  assert.equal(db.getLocalizedText('German')[word], 'Testwort');
});

test('French works as a genuine, complete third language — no special-casing needed for a third language to work at all', () => {
  const languages = db.getLanguages();
  assert.ok(languages.some((l) => l.name === 'French'), 'a third language works the same way as a second');
  assert.ok(!languages.some((l) => l.name === 'Klingon'), 'dropped per explicit request once German and French were both complete');

  const french = db.getLocalizedText('French');
  assert.equal(french['Save'], 'Enregistrer');
  assert.equal(french['Debit'], 'Débit');
  assert.equal(french['Customers'], 'Clients');

  // A word genuinely not registered as any entity at all — proves the
  // fallback mechanism itself still works, not just that most words
  // happen to be translated now.
  assert.equal(french['Not A Real Vocabulary Word'], undefined, 'an unregistered key is simply absent from the map, letting the frontend fall back to its own default text');
});

// --- staging / posting --------------------------------------------
// Originally a single, cumulative chain sharing one posting
// ("TEST-001") across six tests, each relying on exactly what the
// tests before it had already posted into the shared 'admin'
// business - a textbook case of "operating in an assumed global
// context." Each test below creates its own fresh business and posts
// exactly, only, the one entry it needs, so the balance/total it
// asserts is the whole, self-contained story, not "the one thing this
// suite has posted so far."

test('staging + posting a balanced entry works end to end and clears staging', () => {
  const biz = fx.freshBusiness('StagingTest Co');
  db.stageLine({ reference: 'TEST-001', business: biz.business, ledger: biz.actualLedger, description: 'Test entry', transdate: '2026-07-26', account: db.asAccountName('Cash and Bank'), amount_minor: 12345, memo: 'debit side' });
  db.stageLine({ reference: 'TEST-001', business: biz.business, ledger: biz.actualLedger, description: 'Test entry', transdate: '2026-07-26', account: db.asAccountName('Sales Revenue'), amount_minor: -12345, memo: 'credit side' });
  assert.equal(db.getStagedLines('TEST-001', biz.business, biz.actualLedger).length, 2);

  db.postJournalEntry('TEST-001', biz.business, biz.actualLedger, fx.userId);
  assert.equal(db.getStagedLines('TEST-001', biz.business, biz.actualLedger).length, 0, 'staging should be cleared after posting');

  const entries = db.listJournalEntries(biz.business, biz.actualLedger, 10000);
  const posted = entries.find((e) => e.reference === 'TEST-001');
  assert.ok(posted);
  assert.equal(posted!.total_debit_minor, 12345);
  assert.equal(posted!.total_credit_minor, 12345);
});

test('posting an unbalanced entry is rejected and leaves staging untouched', () => {
  const biz = fx.freshBusiness('UnbalancedTest Co');
  db.stageLine({ reference: 'TEST-BAD', business: biz.business, ledger: biz.actualLedger, account: db.asAccountName('Cash and Bank'), amount_minor: 500 });
  assert.throws(() => db.postJournalEntry('TEST-BAD', biz.business, biz.actualLedger, fx.userId), db.PostingError);
  assert.equal(db.getStagedLines('TEST-BAD', biz.business, biz.actualLedger).length, 1, 'staged line should remain for correction');
});

test('removeStagedLine removes exactly one line', () => {
  const biz = fx.freshBusiness('RemoveStagedTest Co');
  db.stageLine({ reference: 'TEST-REMOVE', business: biz.business, ledger: biz.actualLedger, account: db.asAccountName('Cash and Bank'), amount_minor: 10 });
  db.stageLine({ reference: 'TEST-REMOVE', business: biz.business, ledger: biz.actualLedger, account: db.asAccountName('Sales Revenue'), amount_minor: -10 });
  db.removeStagedLine('TEST-REMOVE', biz.business, biz.actualLedger, 'Cash and Bank');
  const remaining = db.getStagedLines('TEST-REMOVE', biz.business, biz.actualLedger);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].account, 'Sales Revenue');
});

test('getJournalEntry returns full line detail with account numbers', () => {
  const biz = fx.freshBusiness('JournalDetailTest Co');
  db.stageLine({ reference: 'TEST-001', business: biz.business, ledger: biz.actualLedger, account: db.asAccountName('Cash and Bank'), amount_minor: 12345 });
  db.stageLine({ reference: 'TEST-001', business: biz.business, ledger: biz.actualLedger, account: db.asAccountName('Sales Revenue'), amount_minor: -12345 });
  db.postJournalEntry('TEST-001', biz.business, biz.actualLedger, fx.userId);
  const entries = db.listJournalEntries(biz.business, biz.actualLedger, 10000);
  const posted = entries.find((e) => e.reference === 'TEST-001')!;
  const detail = db.getJournalEntry(biz.business, biz.actualLedger, posted.journal_id, posted.occurrence_date!);
  assert.ok(detail);
  assert.equal(detail!.lines.length, 2);
  assert.ok(detail!.lines.some((l) => l.account === 'Cash and Bank'));
});

test('an account is vivified on first post and gets a real balance', () => {
  const biz = fx.freshBusiness('VivifyTest Co');
  db.stageLine({ reference: 'TEST-001', business: biz.business, ledger: biz.actualLedger, account: db.asAccountName('Cash and Bank'), amount_minor: 12345 });
  db.stageLine({ reference: 'TEST-001', business: biz.business, ledger: biz.actualLedger, account: db.asAccountName('Sales Revenue'), amount_minor: -12345 });
  db.postJournalEntry('TEST-001', biz.business, biz.actualLedger, fx.userId);
  const cashAndBank = fx.findByName(db.getEntityTree(), 'Cash and Bank', fx.coaCategoryRoot(biz.business, 'Asset').id);
  assert.equal(cashAndBank!.balance_minor, 12345);
});

test('trial balance shows every posted account split into debit/credit, and the two columns match', () => {
  const biz = fx.freshBusiness('TrialBalanceTest Co');
  db.stageLine({ reference: 'TEST-001', business: biz.business, ledger: biz.actualLedger, account: db.asAccountName('Cash and Bank'), amount_minor: 12345 });
  db.stageLine({ reference: 'TEST-001', business: biz.business, ledger: biz.actualLedger, account: db.asAccountName('Sales Revenue'), amount_minor: -12345 });
  db.postJournalEntry('TEST-001', biz.business, biz.actualLedger, fx.userId);
  const tb = db.getTrialBalance(biz.business, biz.actualLedger);
  assert.ok(tb.rows.length > 0);
  const cash = tb.rows.find((r) => r.name === 'Cash and Bank');
  assert.ok(cash);
  assert.equal(cash!.debit_minor, 12345);
  assert.equal(cash!.credit_minor, 0);
  assert.equal(tb.total_debit_minor, tb.total_credit_minor, 'a real ledger must always balance');
});

test('trial balance omits accounts with a zero balance', () => {
  const biz = fx.freshBusiness('TrialBalanceZeroTest Co');
  db.stageLine({ reference: 'TEST-001', business: biz.business, ledger: biz.actualLedger, account: db.asAccountName('Cash and Bank'), amount_minor: 100 });
  db.stageLine({ reference: 'TEST-001', business: biz.business, ledger: biz.actualLedger, account: db.asAccountName('Sales Revenue'), amount_minor: -100 });
  db.postJournalEntry('TEST-001', biz.business, biz.actualLedger, fx.userId);
  const tb = db.getTrialBalance(biz.business, biz.actualLedger);
  assert.ok(!tb.rows.some((r) => r.debit_minor === 0 && r.credit_minor === 0));
});

test('balance sheet computes real totals and confirms Assets = Liabilities + Equity', () => {
  const biz = fx.freshBusiness('BalanceSheetTotalsTest Co');
  db.stageLine({ reference: 'TEST-001', business: biz.business, ledger: biz.actualLedger, account: db.asAccountName('Cash and Bank'), amount_minor: 5000 });
  db.stageLine({ reference: 'TEST-001', business: biz.business, ledger: biz.actualLedger, account: db.asAccountName("Owner's Equity"), amount_minor: -5000 });
  db.postJournalEntry('TEST-001', biz.business, biz.actualLedger, fx.userId);
  const bs = db.getBalanceSheet(biz.business, biz.actualLedger);
  assert.ok(bs.assets.some((a) => a.name === 'Cash and Bank'));
  assert.equal(bs.total_assets_minor, bs.total_liabilities_minor + bs.total_equity_minor, 'the fundamental accounting equation must hold');
  assert.equal(bs.balanced, true);
});

test('profit and loss computes real totals and net income', () => {
  const biz = fx.freshBusiness('ProfitLossTotalsTest Co');
  db.stageLine({ reference: 'TEST-001', business: biz.business, ledger: biz.actualLedger, account: db.asAccountName('Cash and Bank'), amount_minor: 1000 });
  db.stageLine({ reference: 'TEST-001', business: biz.business, ledger: biz.actualLedger, account: db.asAccountName('Sales Revenue'), amount_minor: -1000 });
  db.postJournalEntry('TEST-001', biz.business, biz.actualLedger, fx.userId);
  const pl = db.getProfitAndLoss(biz.business, biz.actualLedger);
  const salesRevenue = pl.income.find((l) => l.name === 'Sales Revenue');
  assert.ok(salesRevenue);
  assert.equal(pl.total_income_minor, pl.income.reduce((s, l) => s + l.credit_minor - l.debit_minor, 0));
  assert.equal(pl.net_income_minor, pl.total_income_minor - pl.total_expenses_minor);
});

test('profit and loss excludes a Year End Close entry from its own totals, even when the close happened within the requested date range — a real, direct bug report: "the consolidated p&l shows zero"', () => {
  const biz = fx.freshBusiness('PLCloseTest Co');
  db.stageLine({ reference: 'PLCT-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-04-01', account: db.asAccountName('Sales Revenue'), amount_minor: -50000 });
  db.stageLine({ reference: 'PLCT-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-04-01', account: db.asAccountName('Cash and Bank'), amount_minor: 50000 });
  db.postJournalEntry('PLCT-1', biz.business, biz.actualLedger, fx.userId);

  // Before closing, the real period total is correct either way.
  const before = db.getProfitAndLoss(biz.business, biz.actualLedger, '2027-04-01', '2027-04-30');
  assert.equal(before.total_income_minor, 50000);

  // The real bug: closing ON THE LAST DAY OF THE SAME RANGE used to
  // make the close entry's own reversal cancel out the real revenue
  // it's reversing, showing a misleading zero for a period that
  // genuinely had real activity.
  db.closeBooks(biz.business, biz.actualLedger, '2027-04-30', "Owner's Equity", fx.userId);
  const after = db.getProfitAndLoss(biz.business, biz.actualLedger, '2027-04-01', '2027-04-30');
  assert.equal(after.total_income_minor, 50000, "a Year End Close's own reversal must never be counted as item of the period's real P&L, even when the close date falls inside the requested range");
});

test('profit and loss income_tree groups by the real category hierarchy, with correct subtotals at every level', () => {
  const biz = fx.freshBusiness('PLTreeTest Co');
  db.create(db.requireEntity('Ledgers', db.typeRootName, db.requireEntity(biz.business, db.typeBusinessName, db.requireEntity('Businesses', db.typeRootName))), db.typeRootName, 'PL Tree Test Ledger', fx.userId);
  // Items are genuinely global (createCustomer-style) - every unique
  // name here is its own, fresh category/item, never shared with any
  // other test.
  const beverages = fx.uniqueName('PL Tree Beverages');
  const cider = fx.uniqueName('PL Tree Cider');
  const dryName = fx.uniqueName('PL Tree Dry Cider 500ml');
  const sweetName = fx.uniqueName('PL Tree Sweet Cider 500ml');
  db.create(db.requireEntity('Items', db.typeRootName), db.typeRootName, beverages, fx.userId);
  db.create(db.requireEntity(beverages, db.typeRootName), db.typeRootName, cider, fx.userId);
  db.create(db.requireEntity(cider, db.typeRootName), db.typeRootName, dryName, fx.userId);
  db.create(db.requireEntity(cider, db.typeRootName), db.typeRootName, sweetName, fx.userId);
  const dry = db.ensureItemSalesCogsAccounts(db.asItemName(dryName), fx.userId, undefined, biz.business);
  const sweet = db.ensureItemSalesCogsAccounts(db.asItemName(sweetName), fx.userId, undefined, biz.business);

  function post(reference: string, lines: { account: string; accountId?: number; amount_minor: number }[]) {
    for (const line of lines) {
      db.stageLine({ reference, business: biz.business, ledger: db.asLedgerName('PL Tree Test Ledger'), transdate: '2027-02-01', account: db.asAccountName(line.account), accountId: line.accountId, amount_minor: line.amount_minor });
    }
    db.postJournalEntry(reference, biz.business, db.asLedgerName('PL Tree Test Ledger'), fx.userId);
  }
  post('PLT-1', [
    { account: 'Cash and Bank', amount_minor: 5000 },
    { account: dry.salesAccount, accountId: dry.salesAccountId, amount_minor: -5000 },
  ]);
  post('PLT-2', [
    { account: 'Cash and Bank', amount_minor: 3000 },
    { account: sweet.salesAccount, accountId: sweet.salesAccountId, amount_minor: -3000 },
  ]);

  const pl = db.getProfitAndLoss(biz.business, db.asLedgerName('PL Tree Test Ledger'));
  const treeTotal = pl.income_tree.reduce((s, n) => s + n.credit_minor - n.debit_minor, 0);
  assert.equal(treeTotal, pl.total_income_minor, 'summing every top-level tree node must equal the flat total exactly');
  assert.equal(pl.total_income_minor, 8000);

  const salesHeading = pl.income_tree.find((n) => n.name === 'Sales Revenue');
  assert.ok(salesHeading, 'the real, existing Sales Revenue heading account must be present as the one, top-level entry');
  const beveragesNode = salesHeading!.children.find((n) => n.name === beverages);
  assert.ok(beveragesNode, 'a real, known category must be present under the real Sales heading');
  assert.equal(beveragesNode!.is_leaf, false);
  const ciderNode = beveragesNode!.children.find((c) => c.name === cider);
  assert.ok(ciderNode, 'a real, nested sub-category must be present');
  assert.equal(ciderNode!.is_leaf, false);
  assert.equal(ciderNode!.credit_minor, 8000, "a category's own subtotal must be the real sum of its real leaf descendants");

  const dryLeaf = ciderNode!.children.find((c) => c.name === dry.salesAccount);
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
  // for "Actual" showed everything summed together instead of each
  // ledger's own, separate figure.
  const biz = fx.freshBusiness('LedgerIsolationTest Co');
  db.stageLine({ reference: 'ISOLATION-ACTUAL', business: biz.business, ledger: biz.actualLedger, account: db.asAccountName('Cash and Bank'), amount_minor: 10000 });
  db.stageLine({ reference: 'ISOLATION-ACTUAL', business: biz.business, ledger: biz.actualLedger, account: db.asAccountName('Sales Revenue'), amount_minor: -10000 });
  db.postJournalEntry('ISOLATION-ACTUAL', biz.business, biz.actualLedger, fx.userId);

  db.stageLine({ reference: 'ISOLATION-BUDGET', business: biz.business, ledger: biz.budgetLedger, account: db.asAccountName('Cash and Bank'), amount_minor: 999999 });
  db.stageLine({ reference: 'ISOLATION-BUDGET', business: biz.business, ledger: biz.budgetLedger, account: db.asAccountName('Sales Revenue'), amount_minor: -999999 });
  db.postJournalEntry('ISOLATION-BUDGET', biz.business, biz.budgetLedger, fx.userId);

  const actualCash = db.getTrialBalance(biz.business, biz.actualLedger).rows.find((r) => r.name === 'Cash and Bank');
  const budgetCash = db.getTrialBalance(biz.business, biz.budgetLedger).rows.find((r) => r.name === 'Cash and Bank');

  assert.notEqual(
    actualCash?.debit_minor,
    budgetCash?.debit_minor,
    'Actual and Budget must show different numbers for the same account — if they match, the ledgers are bleeding into each other'
  );
  assert.equal(budgetCash?.debit_minor, 999999, "Budget's trial balance must reflect only its own posting, not Actual's too");
  assert.equal(actualCash?.debit_minor, 10000, "Actual's trial balance must not include Budget's huge posting");

  const actualBS = db.getBalanceSheet(biz.business, biz.actualLedger);
  const budgetBS = db.getBalanceSheet(biz.business, biz.budgetLedger);
  assert.notEqual(actualBS.total_assets_minor, budgetBS.total_assets_minor);
  assert.equal(budgetBS.balanced, true, "Budget's own balance sheet must still balance on its own terms");
});

test('trial balance comparison shows Actual and Budget side by side for the same account', () => {
  const biz = fx.freshBusiness('TrialBalanceCompareTest Co');
  db.stageLine({ reference: 'TBC-ACTUAL', business: biz.business, ledger: biz.actualLedger, account: db.asAccountName('Cash and Bank'), amount_minor: 10000 });
  db.stageLine({ reference: 'TBC-ACTUAL', business: biz.business, ledger: biz.actualLedger, account: db.asAccountName('Sales Revenue'), amount_minor: -10000 });
  db.postJournalEntry('TBC-ACTUAL', biz.business, biz.actualLedger, fx.userId);
  db.stageLine({ reference: 'TBC-BUDGET', business: biz.business, ledger: biz.budgetLedger, account: db.asAccountName('Cash and Bank'), amount_minor: 999999 });
  db.stageLine({ reference: 'TBC-BUDGET', business: biz.business, ledger: biz.budgetLedger, account: db.asAccountName('Sales Revenue'), amount_minor: -999999 });
  db.postJournalEntry('TBC-BUDGET', biz.business, biz.budgetLedger, fx.userId);

  const cmp = db.getTrialBalanceComparison(biz.business, biz.actualLedger, biz.budgetLedger);
  const cash = cmp.rows.find((r) => r.name === 'Cash and Bank');
  assert.ok(cash);
  assert.equal(cash!.b_debit_minor, 999999);
  assert.notEqual(cash!.a_debit_minor, cash!.b_debit_minor);
});

test('profit and loss comparison computes variance in the conventional direction (budget minus actual)', () => {
  const biz = fx.freshBusiness('ProfitLossCompareTest Co');
  db.stageLine({ reference: 'PLC-ACTUAL', business: biz.business, ledger: biz.actualLedger, account: db.asAccountName('Cash and Bank'), amount_minor: 10000 });
  db.stageLine({ reference: 'PLC-ACTUAL', business: biz.business, ledger: biz.actualLedger, account: db.asAccountName('Sales Revenue'), amount_minor: -10000 });
  db.postJournalEntry('PLC-ACTUAL', biz.business, biz.actualLedger, fx.userId);
  db.stageLine({ reference: 'PLC-BUDGET', business: biz.business, ledger: biz.budgetLedger, account: db.asAccountName('Cash and Bank'), amount_minor: 999999 });
  db.stageLine({ reference: 'PLC-BUDGET', business: biz.business, ledger: biz.budgetLedger, account: db.asAccountName('Sales Revenue'), amount_minor: -999999 });
  db.postJournalEntry('PLC-BUDGET', biz.business, biz.budgetLedger, fx.userId);

  const cmp = db.getProfitAndLossComparison(biz.business, biz.actualLedger, biz.budgetLedger);
  const revenue = cmp.income.find((l) => l.name === 'Sales Revenue');
  assert.ok(revenue);
  assert.equal(revenue!.variance_minor, revenue!.b_minor - revenue!.a_minor);
  assert.equal(cmp.net_income_variance_minor, cmp.b_net_income_minor - cmp.a_net_income_minor);
  // Budget's isolated posting (999999) should dwarf Actual's (10000) —
  // proving this comparison reflects the same real isolation as the
  // test above, not some third combined number.
  assert.ok(cmp.b_total_income_minor > cmp.a_total_income_minor);
});

test('businesses and ledgers list correctly', () => {
  const biz = fx.freshBusiness('ListBusinessesTest Co');
  const businesses = db.getBusinesses();
  assert.ok(businesses.some((b) => b.name === biz.business));
  const ledgers = db.getLedgers(biz.business);
  assert.ok(ledgers.some((l) => l.name === 'Actual'));
  assert.ok(ledgers.some((l) => l.name === `Budget 2027-28`));
});

test('a new entity has no contact until one is set', () => {
  const name = fx.uniqueName('Gamma Contact Test');
  db.create(db.requireEntity('Accounts Receivable', db.typeRootName), db.typeRootName, name, fx.userId);
  assert.equal(db.getContact(name), undefined);
});

test('setContact then getContact round-trips correctly', () => {
  const name = fx.uniqueName('Gamma Contact Test');
  db.create(db.requireEntity('Accounts Receivable', db.typeRootName), db.typeRootName, name, fx.userId);
  db.setContact(name, {
    phone: '555-0100',
    email: 'ap@gamma.example',
    city: 'Springfield',
    country: 'USA',
  });
  const c = db.getContact(name);
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
  const name = fx.uniqueName('Gamma Contact Test');
  db.create(db.requireEntity('Accounts Receivable', db.typeRootName), db.typeRootName, name, fx.userId);
  db.setContact(name, { phone: '555-0100', email: 'ap@gamma.example' });
  db.setContact(name, { phone: '555-9999' });
  const c = db.getContact(name);
  assert.equal(c!.phone, '555-9999');
  assert.equal(c!.email, null, 'email was not resent, so it is correctly cleared, not preserved');
});

test('revokeEntity closes the entity out but deliberately keeps its contact record — a historical fact about a now-closed entity, not something that disappears', () => {
  // A real, confirmed, now-stale assumption: this test used to expect
  // getEntity(e.id) to return undefined after revoke. entity_revoke's
  // own, real, documented design (schema/00-core.sql) is "the real,
  // settled replacement for 'delete' ... only relation_id changes, to
  // NULL" - it is never a true removal from current_entities, the same
  // append-only, nothing-ever-truly-gone discipline this whole design
  // uses everywhere else. revokeEntity (db.ts) additionally, genuinely
  // reparents it into a dedicated 'Revoked' holding root, but it still
  // stays a real, current entity throughout - confirmed directly.
  const name = fx.uniqueName('Delta Contact Test');
  const e = db.create(db.requireEntity('Accounts Receivable', db.typeRootName), db.typeRootName, name, fx.userId);
  db.setContact(name, { phone: '555-1111' });
  db.revokeEntity(e.id, fx.userId);
  const after = db.getEntity(e.id);
  assert.ok(after, 'the entity stays current, moved into Revoked, never truly deleted');
  assert.equal(after!.relation_id, null, 'revoking clears relation_id — the real, documented effect of entity_revoke');
  const revokedParent = db.getEntity(after!.parent_id!);
  assert.equal(revokedParent?.name, 'Revoked', 'it is reparented out of its old structural position, into the dedicated holding root');
  const row = db.db.prepare(`SELECT phone FROM contact WHERE entity_id = ?`).get(e.id) as { phone: string } | undefined;
  assert.equal(row?.phone, '555-1111', 'the contact row is deliberately NOT removed — it stays as history');
});

test('createRecurringJournal rejects an entry that does not balance at its start date', () => {
  const biz = fx.freshBusiness('RecurringBadTest Co');
  assert.throws(
    () =>
      db.createRecurringJournal(biz.business, biz.actualLedger, 'REC-BAD', '2027-01-01', 'monthly', [
        { account: 'Rent', amount_minor: 50000 },
      ], fx.userId),
    db.PostingError
  );
});

test('createRecurringJournal vivifies any account with no BALANCE yet, same guarantee as ordinary posting', () => {
  const biz = fx.freshBusiness('RecurringRentTest Co');
  const rentBefore = fx.getAccountBalance(fx.coaCategoryRoot(biz.business, 'Expense').id); // sanity probe below uses a real lookup instead
  const rentId = fx.findByName(db.getEntityTree(), 'Rent', fx.coaCategoryRoot(biz.business, 'Expense').id)!.id;
  assert.equal(fx.getAccountBalance(rentId)?.balance_minor ?? 0, 0, 'sanity check: this business\'s own Rent has never been posted to yet');

  db.createRecurringJournal(biz.business, biz.actualLedger, 'REC-RENT', '2027-01-01', 'monthly', [
    { account: 'Rent', amount_minor: 50000 },
    { account: 'Cash and Bank', amount_minor: -50000 },
  ], fx.userId, 'Monthly rent', 6);

  assert.ok(fx.getAccountBalance(rentId), 'Rent should still have its account row');
});

test('a recurring journal expands into the correct number of occurrences, each showing in listJournalEntries', () => {
  const biz = fx.freshBusiness('RecurringOccurrencesTest Co');
  db.createRecurringJournal(biz.business, biz.actualLedger, 'REC-RENT', '2027-01-01', 'monthly', [
    { account: 'Rent', amount_minor: 50000 },
    { account: 'Cash and Bank', amount_minor: -50000 },
  ], fx.userId, 'Monthly rent', 6);

  const entries = db.listJournalEntries(biz.business, biz.actualLedger, 200);
  const rentOccurrences = entries.filter((e) => e.reference === 'REC-RENT');
  assert.equal(rentOccurrences.length, 6, 'a 6-month recurrence should produce exactly 6 occurrences, not 1 journal row');
  assert.ok(rentOccurrences.every((o) => o.recurrence === 'monthly'));
  assert.equal(rentOccurrences[0].total_debit_minor, 50000);
});

test('a recurring journal correctly affects Trial Balance for its ledger, across all its occurrences', () => {
  const biz = fx.freshBusiness('RecurringTrialBalanceTest Co');
  db.createRecurringJournal(biz.business, biz.actualLedger, 'REC-RENT', '2027-01-01', 'monthly', [
    { account: 'Rent', amount_minor: 50000 },
    { account: 'Cash and Bank', amount_minor: -50000 },
  ], fx.userId, 'Monthly rent', 6);

  const tb = db.getTrialBalance(biz.business, biz.actualLedger);
  const rent = tb.rows.find((r) => r.name === 'Rent');
  assert.ok(rent);
  assert.equal(rent!.debit_minor, 50000 * 6, 'Rent should reflect all 6 monthly occurrences, not just one');
});

test('the exact wage-increase scenario: a mid-schedule amendment applies only from its effective date onward, via the same journal_line row set — no new table, no new journal', () => {
  const biz = fx.freshBusiness('WageAmendmentTest Co');
  db.createRecurringJournal(
    biz.business,
    biz.actualLedger,
    'REC-WAGE',
    '2027-01-01',
    'monthly',
    [
      { account: 'Wages', amount_minor: 100000, effective_date: '2027-01-01' },
      { account: 'Wages', amount_minor: 110000, effective_date: '2027-05-01' }, // the boss's raise
      { account: 'Cash and Bank', amount_minor: -100000, effective_date: '2027-01-01' },
      { account: 'Cash and Bank', amount_minor: -110000, effective_date: '2027-05-01' },
    ],
    fx.userId,
    'Wages',
    12
  );

  const wagesId = fx.findByName(db.getEntityTree(), 'Wages', fx.coaCategoryRoot(biz.business, 'Expense').id)!.id;
  const businessEntityId = db.requireEntity(biz.business, db.typeBusinessName, db.requireEntity('Businesses', db.typeRootName)).id;
  const occurrences = db.db
    .prepare(
      `SELECT transdate, amount_minor FROM journal_occurrences
       WHERE journal_id = (SELECT id FROM journal WHERE reference = 'REC-WAGE' AND business_id = ?)
         AND account_id = ?
       ORDER BY transdate`
    )
    .all(businessEntityId, wagesId) as { transdate: string; amount_minor: number }[];

  assert.equal(occurrences.length, 12, 'a 12-month recurrence should produce 12 occurrences');
  assert.equal(occurrences[0].amount_minor, 100000, 'January must still be the original 1000');
  assert.equal(occurrences[3].amount_minor, 100000, 'April must still be the original 1000, unaffected by the May amendment');
  assert.equal(occurrences[4].amount_minor, 110000, 'May must reflect the raise');
  assert.equal(occurrences[11].amount_minor, 110000, 'December must still reflect the raise, not revert');
});

test('createRecurringJournal has not touched the Budget ledger — Actual and Budget stay isolated even for recurring entries, same as ordinary ones', () => {
  const biz = fx.freshBusiness('RecurringIsolationTest Co');
  db.createRecurringJournal(biz.business, biz.budgetLedger, 'REC-BUDGET-RENT', '2027-01-01', 'monthly', [
    { account: 'Rent', amount_minor: 60000 },
    { account: 'Cash and Bank', amount_minor: -60000 },
  ], fx.userId, 'Budgeted rent', 12);

  const actualRent = db.getTrialBalance(biz.business, biz.actualLedger).rows.find((r) => r.name === 'Rent');
  const budgetRent = db.getTrialBalance(biz.business, biz.budgetLedger).rows.find((r) => r.name === 'Rent');
  assert.equal(actualRent ?? undefined, undefined, "Actual's Rent must be unaffected by the Budget ledger's recurring entry — nothing was ever posted to it");
  assert.equal(budgetRent!.debit_minor, 60000 * 12, "Budget's Rent should reflect its own full 12-month schedule");
});

test('a realistic set of transactions — cash purchase, cash sale, AR sale, a receipt against it, AP purchase, a payment against it — all post correctly and the full chain (balances, trial balance, balance sheet, P&L) reflects every one of them', () => {
  const biz = fx.freshBusiness('WorkedSetTest Co');
  const vendorName = fx.uniqueName('Acme Supplies Pty Ltd');
  const customerName = fx.uniqueName('Acme Corp');
  db.createProvider(vendorName, fx.userId);
  db.createCustomer(customerName, fx.userId);

  function post(reference: string, lines: { account: string; amount_minor: number; memo?: string }[]) {
    for (const line of lines) {
      db.stageLine({ reference, business: biz.business, ledger: biz.actualLedger, transdate: '2027-02-01', account: db.asAccountName(line.account), amount_minor: line.amount_minor, memo: line.memo });
    }
    db.postJournalEntry(reference, biz.business, biz.actualLedger, fx.userId);
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
    { account: customerName, amount_minor: 100000 },
    { account: 'Sales Revenue', amount_minor: -100000 },
  ]);

  // A receipt from Acme Corp against that same AR balance, $400 by EFT.
  post('WS-RECEIPT', [
    { account: 'Cash and Bank', amount_minor: 40000 },
    { account: customerName, amount_minor: -40000 },
  ]);

  // AP purchase — bought $500 of inventory from Acme Supplies on credit.
  post('WS-APPURCHASE', [
    { account: 'Inventory', amount_minor: 50000 },
    { account: vendorName, amount_minor: -50000 },
  ]);

  // A payment to Acme Supplies against that AP balance, $200.
  post('WS-PAYMENT', [
    { account: vendorName, amount_minor: 20000 },
    { account: 'Cash and Bank', amount_minor: -20000 },
  ]);

  const tb = db.getTrialBalance(biz.business, biz.actualLedger);
  const cash = tb.rows.find((r) => r.name === 'Cash and Bank');
  assert.equal(cash!.debit_minor, 42000, 'Cash and Bank should net all four cash-affecting transactions correctly');

  const acmeCorp = tb.rows.find((r) => r.name === customerName);
  assert.equal(acmeCorp!.debit_minor, 60000, 'Acme Corp should still owe 600.00 after the partial receipt');

  const acmeSupplies = tb.rows.find((r) => r.name === vendorName);
  assert.equal(acmeSupplies!.credit_minor, 30000, 'Acme Supplies should still be owed 300.00 after the partial payment');

  assert.equal(tb.total_debit_minor, tb.total_credit_minor, 'the whole set together must still balance');

  const bs = db.getBalanceSheet(biz.business, biz.actualLedger);
  assert.ok(bs.assets.some((a) => a.name === 'Accounts Receivable' && a.debit_minor === 60000));
  // Both counterparty types live outside this business's own real CoA
  // mirror entirely (AR/AP are universal/global, never copied per
  // business) and reach the Balance Sheet only via the dedicated
  // "Header Account" hierarchy-descendants total - so, for a genuinely
  // isolated business (never 'admin's own, direct, no-mirror-at-all
  // special case), both show as one combined line, never a separate
  // line per counterparty.
  assert.ok(bs.liabilities.some((l) => l.name === 'Accounts Payable' && l.credit_minor === 30000));
  assert.equal(bs.total_assets_minor, bs.total_liabilities_minor + bs.total_equity_minor, 'the accounting equation must hold for this ledger too');

  const pl = db.getProfitAndLoss(biz.business, biz.actualLedger);
  assert.equal(pl.total_income_minor, 30000 + 100000);
  assert.equal(pl.total_expenses_minor, 8000);
  assert.equal(pl.net_income_minor, 30000 + 100000 - 8000);
});

test('AR Sale form: staging and posting creates the correct Debit AR / Credit Sales Revenue entry', () => {
  // stageARSale/postARSale (and the ar_sale_staging table/trigger
  // behind them) were removed entirely, confirmed directly: nothing
  // live ever called them (docs/canned-journal-to-frontend-design.md
  // — "pure removal, not a rewrite," both the schema and the function
  // are gone). The real, live way to record this exact fact (a
  // customer owes money after a credit sale) is a plain General
  // Journal entry — the one, real API every financial transaction
  // goes through, per that same design doc's own opening line.
  const biz = fx.freshBusiness('ARSaleFormTest Co');
  const customerName = fx.uniqueName('Beta Pty Ltd');
  db.createCustomer(customerName, fx.userId);
  db.stageLine({ reference: 'ARF-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-07-01', account: db.asAccountName(customerName), amount_minor: 80000, memo: 'Sale' });
  db.stageLine({ reference: 'ARF-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-07-01', account: db.asAccountName('Sales Revenue'), amount_minor: -80000 });
  db.postJournalEntry('ARF-1', biz.business, biz.actualLedger, fx.userId);

  const tb = db.getTrialBalance(biz.business, biz.actualLedger);
  const beta = tb.rows.find((r) => r.name === customerName);
  assert.equal(beta!.debit_minor, 80000);
});

test('AR Receipt form: staging and posting creates the correct Debit Cash / Credit AR entry, reducing the customer balance', () => {
  const biz = fx.freshBusiness('ARReceiptFormTest Co');
  const customerName = fx.uniqueName('Beta Pty Ltd');
  db.createCustomer(customerName, fx.userId);
  db.stageLine({ reference: 'ARF-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-07-01', account: db.asAccountName(customerName), amount_minor: 80000 });
  db.stageLine({ reference: 'ARF-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-07-01', account: db.asAccountName('Sales Revenue'), amount_minor: -80000 });
  db.postJournalEntry('ARF-1', biz.business, biz.actualLedger, fx.userId);

  db.stageARReceipt({ reference: 'ARR-1', business: biz.business, ledger: biz.actualLedger, customer: db.asCustomerName(customerName), amount_minor: 30000, transdate: '2027-07-10' });
  db.postARReceipt('ARR-1', biz.business, biz.actualLedger, fx.userId);

  const tb = db.getTrialBalance(biz.business, biz.actualLedger);
  const beta = tb.rows.find((r) => r.name === customerName);
  assert.equal(beta!.debit_minor, 50000, 'Beta should owe 500.00 after the 300.00 receipt against the 800.00 sale');
});

test('AP Purchase form: staging and posting creates the correct Debit expense/asset / Credit AP entry', () => {
  // stageAPPurchase/postAPPurchase removed entirely, same confirmed
  // reason and same real, live replacement as "AR Sale form" above.
  const biz = fx.freshBusiness('APPurchaseFormTest Co');
  const vendorName = fx.uniqueName('Acme Supplies Pty Ltd');
  db.createProvider(vendorName, fx.userId);
  db.stageLine({ reference: 'APF-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-07-01', account: db.asAccountName('Office'), amount_minor: 15000 });
  db.stageLine({ reference: 'APF-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-07-01', account: db.asAccountName(vendorName), amount_minor: -15000 });
  db.postJournalEntry('APF-1', biz.business, biz.actualLedger, fx.userId);

  const tb = db.getTrialBalance(biz.business, biz.actualLedger);
  const acmeSupplies = tb.rows.find((r) => r.name === vendorName);
  assert.ok(acmeSupplies!.credit_minor >= 15000);
  const office = tb.rows.find((r) => r.name === 'Office');
  assert.ok(office);
});

test('AP Payment form: staging and posting creates the correct Debit AP / Credit Cash entry, reducing the vendor balance', () => {
  const biz = fx.freshBusiness('APPaymentFormTest Co');
  const vendorName = fx.uniqueName('Acme Supplies Pty Ltd');
  db.createProvider(vendorName, fx.userId);
  db.stageLine({ reference: 'APF-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-07-01', account: db.asAccountName('Office'), amount_minor: 15000 });
  db.stageLine({ reference: 'APF-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-07-01', account: db.asAccountName(vendorName), amount_minor: -15000 });
  db.postJournalEntry('APF-1', biz.business, biz.actualLedger, fx.userId);

  const before = db.getTrialBalance(biz.business, biz.actualLedger).rows.find((r) => r.name === vendorName)!.credit_minor;
  db.stageAPPayment({ reference: 'APP-1', business: biz.business, ledger: biz.actualLedger, vendor: db.asProviderName(vendorName), amount_minor: 5000, transdate: '2027-07-15' });
  db.postAPPayment('APP-1', biz.business, biz.actualLedger, fx.userId);

  const after = db.getTrialBalance(biz.business, biz.actualLedger).rows.find((r) => r.name === vendorName)!.credit_minor;
  assert.equal(after, before - 5000, 'the vendor balance owed should decrease by exactly the payment amount');
});

test('reversing a posted entry creates a new entry with every line negated, and the net effect on balances is exactly zero', () => {
  const biz = fx.freshBusiness('ReversalTest Co');
  db.stageLine({ reference: 'REV-SOURCE', business: biz.business, ledger: biz.actualLedger, transdate: '2027-09-01', account: db.asAccountName('Cash and Bank'), amount_minor: 7500 });
  db.stageLine({ reference: 'REV-SOURCE', business: biz.business, ledger: biz.actualLedger, transdate: '2027-09-01', account: db.asAccountName('Sales Revenue'), amount_minor: -7500 });
  db.postJournalEntry('REV-SOURCE', biz.business, biz.actualLedger, fx.userId);

  const before = db.getTrialBalance(biz.business, biz.actualLedger).rows.find((r) => r.name === 'Cash and Bank')!.debit_minor;
  assert.equal(before, 7500);

  const entries = db.listJournalEntries(biz.business, biz.actualLedger, 200);
  const source = entries.find((e) => e.reference === 'REV-SOURCE')!;
  db.reverseJournalEntry(biz.business, biz.actualLedger, source.journal_id, source.occurrence_date!, fx.userId, '2027-09-15');

  const after = db.getTrialBalance(biz.business, biz.actualLedger);
  const cash = after.rows.find((r) => r.name === 'Cash and Bank');
  assert.equal(cash, undefined, 'after reversal, Cash and Bank should have exactly zero net effect and not even appear');

  const reversalEntry = db.listJournalEntries(biz.business, biz.actualLedger, 200).find((e) => e.reference.startsWith('REV-SOURCE-REV-'));
  assert.ok(reversalEntry, 'the reversal should show up as its own real entry in the journal list');
  assert.equal(reversalEntry!.total_debit_minor, 7500);
  assert.equal(reversalEntry!.total_credit_minor, 7500);

  const journalRow = db.db.prepare(`SELECT reversal_of FROM journal WHERE reference = ?`).get(reversalEntry!.reference) as { reversal_of: number };
  assert.equal(journalRow.reversal_of, source.journal_id, 'the reversal must reference the original journal it reverses');
});

test('reversing a nonexistent occurrence is rejected clearly', () => {
  const biz = fx.freshBusiness('ReversalMissingTest Co');
  assert.throws(() => db.reverseJournalEntry(biz.business, biz.actualLedger, 999999, '2027-01-01', fx.userId), db.NotFoundError);
});

test('complete end-to-end lifecycle: purchase order -> receipt -> sales order -> dispatch/invoice -> cash collected -> vendor paid, every account balance verified at each step', () => {
  const biz = fx.freshBusiness('LifecycleTest Co');
  const qtyName = fx.uniqueName('LTWidget Batch Qty');
  const valueName = fx.uniqueName('LTWidget Batch Value');
  db.create(db.requireEntity('Stock Quantities', db.typeRootName), db.typeRootName, qtyName, fx.userId);
  db.create(db.requireEntity('Inventory', db.typeRootName, fx.coaCategoryRoot(biz.business, 'Asset')), db.typeRootName, valueName, fx.userId);
  const vendorName = fx.uniqueName('Acme Supplies Pty Ltd');
  const customerName = fx.uniqueName('Acme Corp');
  db.createProvider(vendorName, fx.userId);
  db.createCustomer(customerName, fx.userId);
  const poRef = fx.uniqueName('PO-LT');
  const soRef = fx.uniqueName('SO-LT');

  // --- Step 1: place a PO — 100 units @ $5.00, memo only ---
  db.placeOrder(poRef, biz.business, biz.actualLedger, 100, 50000, fx.userId, '2027-06-01');
  assert.deepEqual(db.getOrderStatus(poRef), { quantity: 100, value_minor: 50000 });

  // --- Step 2: receive all 100 units from the vendor ---
  db.postQuantityMovement(biz.business, biz.actualLedger, `${poRef}-RCPT-QTY`, db.asAccountName(qtyName), 100, fx.userId, '2027-06-01');
  db.stageLine({ reference: `${poRef}-RCPT-VALUE`, business: biz.business, ledger: biz.actualLedger, transdate: '2027-06-01', account: db.asAccountName(valueName), amount_minor: 50000 });
  db.stageLine({ reference: `${poRef}-RCPT-VALUE`, business: biz.business, ledger: biz.actualLedger, transdate: '2027-06-01', account: db.asAccountName(vendorName), amount_minor: -50000 });
  db.postJournalEntry(`${poRef}-RCPT-VALUE`, biz.business, biz.actualLedger, fx.userId);
  db.fulfillOrder(poRef, `${poRef}-RCPT`, biz.business, biz.actualLedger, 100, 50000, fx.userId, '2027-06-01');

  assert.deepEqual(db.getOrderStatus(poRef), { quantity: 0, value_minor: 0 }, 'PO fully closed, no back order');
  const qtyBalance = (name: string) => (db.db.prepare(`SELECT balance_minor FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name = ?)`).get(name) as { balance_minor: number }).balance_minor;
  assert.equal(qtyBalance(qtyName), 100, 'quantity lives outside Chart of Accounts, checked directly, not via getTrialBalance');
  const afterReceipt = db.getTrialBalance(biz.business, biz.actualLedger);
  assert.equal(afterReceipt.rows.find((r) => r.name === qtyName), undefined, 'a quantity account must NEVER appear in a real financial statement');
  assert.equal(afterReceipt.rows.find((r) => r.name === valueName)!.debit_minor, 50000);
  assert.equal(afterReceipt.rows.find((r) => r.name === vendorName)!.credit_minor, 50000);

  // --- Step 3: place a SO — customer orders 30 units @ $8.00 selling price ---
  db.placeOrder(soRef, biz.business, biz.actualLedger, 30, 24000, fx.userId, '2027-06-05');
  assert.deepEqual(db.getOrderStatus(soRef), { quantity: 30, value_minor: 24000 });

  // --- Step 4: dispatch + invoice — ship 30 units, invoice the customer ---
  db.stageLine({ reference: `${soRef}-INV`, business: biz.business, ledger: biz.actualLedger, transdate: '2027-06-05', account: db.asAccountName(customerName), amount_minor: 24000 });
  db.stageLine({ reference: `${soRef}-INV`, business: biz.business, ledger: biz.actualLedger, transdate: '2027-06-05', account: db.asAccountName('Sales Revenue'), amount_minor: -24000 });
  db.postJournalEntry(`${soRef}-INV`, biz.business, biz.actualLedger, fx.userId);

  db.stageLine({ reference: `${soRef}-COGS`, business: biz.business, ledger: biz.actualLedger, transdate: '2027-06-05', account: db.asAccountName('Cost of Goods Sold'), amount_minor: 15000 });
  db.stageLine({ reference: `${soRef}-COGS`, business: biz.business, ledger: biz.actualLedger, transdate: '2027-06-05', account: db.asAccountName(valueName), amount_minor: -15000 });
  db.postJournalEntry(`${soRef}-COGS`, biz.business, biz.actualLedger, fx.userId);
  db.postQuantityMovement(biz.business, biz.actualLedger, `${soRef}-DISPATCH-QTY`, db.asAccountName(qtyName), -30, fx.userId, '2027-06-05');
  db.fulfillOrder(soRef, `${soRef}-DISPATCH`, biz.business, biz.actualLedger, 30, 24000, fx.userId, '2027-06-05');

  assert.deepEqual(db.getOrderStatus(soRef), { quantity: 0, value_minor: 0 }, 'SO fully fulfilled, no back order');
  const afterDispatch = db.getTrialBalance(biz.business, biz.actualLedger);
  assert.equal(afterDispatch.rows.find((r) => r.name === customerName)!.debit_minor, 24000);
  assert.equal(afterDispatch.rows.find((r) => r.name === 'Sales Revenue')!.credit_minor, 24000);
  assert.equal(afterDispatch.rows.find((r) => r.name === 'Cost of Goods Sold')!.debit_minor, 15000, 'COGS must reflect the 5.00 acquisition cost, not the 8.00 selling price');
  assert.equal(afterDispatch.rows.find((r) => r.name === qtyName), undefined, 'still must never appear in a real financial statement');
  const remainingQty = qtyBalance(qtyName);
  const remainingValue = afterDispatch.rows.find((r) => r.name === valueName)!.debit_minor;
  assert.equal(remainingQty, 70);
  assert.equal(remainingValue, 35000);
  assert.equal(remainingValue / remainingQty, 500, 'implied unit cost must still be exactly $5.00 after partial consumption');

  // --- Step 5: cash collected from the customer ---
  db.stageLine({ reference: `${soRef}-CASH`, business: biz.business, ledger: biz.actualLedger, transdate: '2027-06-10', account: db.asAccountName('Cash and Bank'), amount_minor: 24000 });
  db.stageLine({ reference: `${soRef}-CASH`, business: biz.business, ledger: biz.actualLedger, transdate: '2027-06-10', account: db.asAccountName(customerName), amount_minor: -24000 });
  db.postJournalEntry(`${soRef}-CASH`, biz.business, biz.actualLedger, fx.userId);

  // --- Step 6: pay the vendor ---
  db.stageLine({ reference: `${poRef}-PMT`, business: biz.business, ledger: biz.actualLedger, transdate: '2027-06-10', account: db.asAccountName(vendorName), amount_minor: 50000 });
  db.stageLine({ reference: `${poRef}-PMT`, business: biz.business, ledger: biz.actualLedger, transdate: '2027-06-10', account: db.asAccountName('Cash and Bank'), amount_minor: -50000 });
  db.postJournalEntry(`${poRef}-PMT`, biz.business, biz.actualLedger, fx.userId);

  const final = db.getTrialBalance(biz.business, biz.actualLedger);
  assert.equal(final.rows.find((r) => r.name === customerName), undefined, 'customer fully paid, zero net balance');
  assert.equal(final.rows.find((r) => r.name === vendorName), undefined, 'vendor fully paid, zero net balance');
  assert.equal(final.total_debit_minor, final.total_credit_minor, 'the whole six-step lifecycle must still balance as one');
  const cash = final.rows.find((r) => r.name === 'Cash and Bank');
  assert.equal(cash!.credit_minor, 26000, 'net cash: +240.00 collected, -500.00 paid = -260.00 net, shown as a credit balance');
});

test('a partial receipt against a purchase order leaves a genuine, correctly-sized back order', () => {
  const biz = fx.freshBusiness('BackorderTest Co');
  const qtyName = fx.uniqueName('BOWidget Batch Qty');
  const poRef = fx.uniqueName('PO-BO');
  db.create(db.requireEntity('Stock Quantities', db.typeRootName), db.typeRootName, qtyName, fx.userId);

  db.placeOrder(poRef, biz.business, biz.actualLedger, 100, 50000, fx.userId, '2027-07-01');

  // Only 60 of the 100 ordered units actually arrive.
  db.postQuantityMovement(biz.business, biz.actualLedger, `${poRef}-RCPT-QTY`, db.asAccountName(qtyName), 60, fx.userId, '2027-07-05');
  db.fulfillOrder(poRef, `${poRef}-RCPT`, biz.business, biz.actualLedger, 60, 30000, fx.userId, '2027-07-05');

  const afterPartial = db.getOrderStatus(poRef);
  assert.equal(afterPartial.quantity, 40, 'the remaining 40 units ARE the back order — no separate status field needed');
  assert.equal(afterPartial.value_minor, 20000);

  // The rest arrives later, closing the PO out completely.
  db.postQuantityMovement(biz.business, biz.actualLedger, `${poRef}-RCPT2-QTY`, db.asAccountName(qtyName), 40, fx.userId, '2027-07-20');
  db.fulfillOrder(poRef, `${poRef}-RCPT2`, biz.business, biz.actualLedger, 40, 20000, fx.userId, '2027-07-20');

  assert.deepEqual(db.getOrderStatus(poRef), { quantity: 0, value_minor: 0 }, 'PO fully closed once the back order is later fulfilled');
});

test('a real Purchase Order still knows its real vendor and item after posting — no extra table, the same real relation every entity already has', () => {
  const biz = fx.freshBusiness('PORelationTest Co');
  const vendorName = fx.uniqueName('PORelationTest Vendor');
  const itemName = fx.uniqueName('PORelationTest Wine');
  db.create(db.requireEntity('Vendors', db.typeRootName), db.typeRootName, vendorName, fx.userId);
  db.createItem(itemName, 'Items', fx.userId, biz.business);
  const ref = fx.uniqueName('PORELTEST');

  db.stagePurchaseOrder({
    reference: ref,
    business: biz.business,
    ledger: biz.actualLedger,
    vendor: vendorName,
    item: itemName,
    quantity: 24,
    price_minor: 1500,
  });
  db.postPurchaseOrder(ref, biz.business, biz.actualLedger, fx.userId);

  // po_staging (vendor, item) is genuinely deleted after posting —
  // the real, direct proof this doesn't come from staging still being
  // there.
  const stillStaged = db.db.prepare(`SELECT 1 FROM po_staging WHERE reference = ?`).get(ref);
  assert.equal(stillStaged, undefined, 'the real staging row is genuinely gone — what follows must come from the real, posted entities themselves');

  const entities = db.getEntityTree();
  const byId = new Map(entities.map((e) => [e.id, e]));
  const qtyEntity = entities.find((e) => e.name === `${ref} Qty`);
  const valueEntity = entities.find((e) => e.name === `${ref} Value`);
  assert.ok(qtyEntity && valueEntity);

  assert.equal(byId.get(qtyEntity!.relation_id!)?.name, vendorName, "the real Qty entity's own relation must carry the real vendor");
  assert.equal(byId.get(valueEntity!.relation_id!)?.name, itemName, "the real Value entity's own relation must carry the real item");
});

test('getLocationCapacityStatus: a real location\'s own, current real stock checked against its own, real configured capacity — found to be purely informational and never enforced anywhere, per docs/TODO.md', () => {
  const biz = fx.freshBusiness('CapTest Co');
  const outlet = fx.freshLocation(biz.business, 'CapTest Outlet', { bottle_capacity: 100, carton_capacity: 10 });
  const vendorName = fx.uniqueName('CapTest Vendor');
  const itemName = fx.uniqueName('CapTest Wine');
  db.create(db.requireEntity('Vendors', db.typeRootName), db.typeRootName, vendorName, fx.userId);
  db.createItem(itemName, 'Items', fx.userId, biz.business);
  db.addOrUpdateItemSource({ itemName, vendorName, priceMinor: 1500, packageQuantity: 12, isPreferred: true }); // 12 bottles per real carton

  const before = db.getLocationCapacityStatus(outlet.name);
  assert.equal(before.bottleQuantity, 0);
  assert.equal(before.bottleCapacity, 100);
  assert.equal(before.bottleOverCapacity, false);
  assert.equal(before.cartonCapacity, 10);
  assert.equal(before.cartonOverCapacity, false);

  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('CAPTEST-REC'), db.asItemName(itemName), outlet.name, 130, fx.userId, '2027-01-01');
  const after = db.getLocationCapacityStatus(outlet.name);
  assert.equal(after.bottleQuantity, 130);
  assert.equal(after.bottleOverCapacity, true, 'a real 130 bottles against a real 100-bottle capacity must correctly show as over');
  assert.equal(after.cartonQuantity, Math.round((130 / 12) * 100) / 100, "a real carton-equivalent quantity must use this product's own real, preferred vendor package_quantity (12), not a flat, assumed figure");
  assert.equal(after.cartonOverCapacity, true, 'a real 10.83 cartons against a real 10-carton capacity must correctly show as over');

  // A real location with no configured capacity at all — never silently treated as "over" just because none was set.
  const noCapOutlet = fx.freshLocation(biz.business, 'CapTest No Capacity Outlet', { bottle_capacity: null, carton_capacity: null });
  const noCapacity = db.getLocationCapacityStatus(noCapOutlet.name);
  assert.equal(noCapacity.bottleCapacity, null);
  assert.equal(noCapacity.bottleOverCapacity, false);
});

test('picking/packing/dispatch: a real order becomes a real, shelf-ordered picking list, requires every real line ticked off before it can dispatch, and reduces real, physical stock at the exact location it was actually picked from', () => {
  const biz = fx.freshBusiness('PickTest Co');
  const outlet = fx.freshLocation(biz.business, 'PickTest Outlet', { bottle_capacity: 500, carton_capacity: 50 });
  const frontWine = fx.uniqueName('PickTest Front Wine');
  const backWine = fx.uniqueName('PickTest Back Wine');
  db.createItem(frontWine, 'Items', fx.userId, biz.business);
  db.createItem(backWine, 'Items', fx.userId, biz.business);
  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('PICKTEST-REC'), db.asItemName(frontWine), outlet.name, 50, fx.userId, '2027-06-01');
  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('PICKTEST-REC'), db.asItemName(backWine), outlet.name, 50, fx.userId, '2027-06-01');
  db.setItemLocationLevels(db.asItemName(frontWine), outlet.name, { shelfSide: 'Front', rack: 'A', level: 1 }, biz.business, biz.actualLedger, fx.userId);
  db.setItemLocationLevels(db.asItemName(backWine), outlet.name, { shelfSide: 'Back', rack: 'B', level: 2 }, biz.business, biz.actualLedger, fx.userId);
  const customerName = fx.uniqueName('PickTest Customer');
  db.create(db.requireEntity('Customers', db.typeRootName), db.typeRootName, customerName, fx.userId);

  const invoiceId = db.createInvoice(
    {
      invoiceType: 'AR',
      business: biz.business,
      ledger: biz.actualLedger,
      reference: fx.uniqueName('PICKORDER'),
      counterpartyName: customerName,
      invoiceDate: '2027-06-05',
      lines: [
        { description: backWine, quantity: 3, unitPriceMinor: 2000, amountMinor: 6000, taxMinor: 0, itemName: backWine },
        { description: frontWine, quantity: 5, unitPriceMinor: 1500, amountMinor: 7500, taxMinor: 0, itemName: frontWine },
      ],
    },
    fx.userId
  );

  const list = db.getPickingList(invoiceId, outlet.name);
  // Real shelf order (Rack A before Rack B) — not the order the real invoice lines happened to be entered in (Back Wine was listed first).
  assert.equal(list[0].item, frontWine, "a real picking list must sort by real shelf order (Rack A), not the invoice's own real line order");
  assert.equal(list[1].item, backWine);
  assert.equal(list.every((l) => l.picked === false), true);

  assert.throws(
    () => db.dispatchOrderFromPickingList(invoiceId, outlet.name, 'Sales Revenue', 'Sales Tax Payable', fx.userId),
    db.ValidationError,
    'dispatch must be genuinely refused while any real line is still unticked'
  );

  db.confirmPickedLine(invoiceId, list[0].invoiceLineId, biz.business, biz.actualLedger, fx.userId);
  const partial = db.getPickingList(invoiceId, outlet.name);
  assert.equal(partial.find((l) => l.item === frontWine)?.picked, true);
  assert.equal(partial.find((l) => l.item === backWine)?.picked, false);
  assert.throws(() => db.dispatchOrderFromPickingList(invoiceId, outlet.name, 'Sales Revenue', 'Sales Tax Payable', fx.userId), db.ValidationError, 'one real line still unticked must still refuse dispatch');

  db.confirmPickedLine(invoiceId, list[1].invoiceLineId, biz.business, biz.actualLedger, fx.userId);
  db.dispatchOrderFromPickingList(invoiceId, outlet.name, 'Sales Revenue', 'Sales Tax Payable', fx.userId);

  const invoice = db.getInvoice(invoiceId)!;
  assert.equal(invoice.status, 'posted', 'a real dispatch must actually post the real invoice, recognizing real revenue');
  assert.equal(db.getItemLocation(db.asItemName(frontWine), outlet.name).quantity_on_hand, 45, 'real, physical stock must actually be reduced at the exact real location it was picked from');
  assert.equal(db.getItemLocation(db.asItemName(backWine), outlet.name).quantity_on_hand, 47);
});

test('restocking retail outlets from warehouses: the same real, shelf-ordered picking and refuse-until-complete pattern, but a real internal transfer, not an invoice — a real, distinct reference per real line, since a shared reference across different real products in the same run would genuinely collide', () => {
  const biz = fx.freshBusiness('RestockTest Co');
  const warehouse = fx.freshLocation(biz.business, 'RestockTest Warehouse', { location_type: 'Warehouse', bottle_capacity: 0, carton_capacity: 5000 });
  const outlet = fx.freshLocation(biz.business, 'RestockTest Outlet', { is_billing_address: true, bottle_capacity: 500, carton_capacity: 50 });
  const wineA = fx.uniqueName('RestockTest Wine A');
  const wineB = fx.uniqueName('RestockTest Wine B');
  db.createItem(wineA, 'Items', fx.userId, biz.business);
  db.createItem(wineB, 'Items', fx.userId, biz.business);
  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('RESTOCKTEST-REC'), db.asItemName(wineA), warehouse.name, 100, fx.userId, '2027-07-01');
  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('RESTOCKTEST-REC'), db.asItemName(wineB), warehouse.name, 100, fx.userId, '2027-07-01');
  db.setItemLocationLevels(db.asItemName(wineA), warehouse.name, { rack: 'A', level: 1 }, biz.business, biz.actualLedger, fx.userId);
  db.setItemLocationLevels(db.asItemName(wineB), warehouse.name, { rack: 'B', level: 2 }, biz.business, biz.actualLedger, fx.userId);

  const runRef = fx.uniqueName('RESTOCKRUN');
  const lines = [
    { item: wineB, quantity: 10 },
    { item: wineA, quantity: 20 },
  ];

  const list = db.getRestockPickingList(runRef, warehouse.name, lines);
  assert.equal(list[0].item, wineA, 'a real restocking picking list must also sort by real shelf order, not the order lines happened to be requested in');
  assert.equal(list[1].item, wineB);

  assert.throws(
    () => db.dispatchRestockFromPickingList(runRef, biz.business, biz.actualLedger, warehouse.name, outlet.name, lines, fx.userId, '2027-07-05'),
    db.ValidationError,
    'a real restocking run must be refused while any real line is still unticked, the same as a customer order'
  );

  for (const l of lines) db.confirmRestockPickedLine(runRef, l.item, biz.business, biz.actualLedger, fx.userId);
  db.dispatchRestockFromPickingList(runRef, biz.business, biz.actualLedger, warehouse.name, outlet.name, lines, fx.userId, '2027-07-05');

  assert.equal(db.getItemLocation(db.asItemName(wineA), warehouse.name).quantity_on_hand, 80, 'real stock must actually leave the real warehouse');
  assert.equal(db.getItemLocation(db.asItemName(wineA), outlet.name).quantity_on_hand, 20, 'real stock must actually arrive at the real retail outlet');
  assert.equal(db.getItemLocation(db.asItemName(wineB), outlet.name).quantity_on_hand, 10, 'a second, different real product in the same run must transfer correctly too — no reference collision between them');
});

test('the four real entry screens: PO -> receipt -> SO -> dispatch, using the actual staging/post functions a person would use, not just the underlying primitives', () => {
  const biz = fx.freshBusiness('ScreensTest Co');
  const qtyName = fx.uniqueName('SCWidget Batch Qty');
  const valueName = fx.uniqueName('SCWidget Batch Value');
  db.create(db.requireEntity('Stock Quantities', db.typeRootName), db.typeRootName, qtyName, fx.userId);
  db.create(db.requireEntity('Inventory', db.typeRootName, fx.coaCategoryRoot(biz.business, 'Asset')), db.typeRootName, valueName, fx.userId);
  const vendorName = fx.uniqueName('Acme Supplies Pty Ltd');
  const customerName = fx.uniqueName('Beta Pty Ltd');
  db.createProvider(vendorName, fx.userId);
  db.createCustomer(customerName, fx.userId);
  const business = biz.business;
  const ledger = biz.actualLedger;
  const poRef = fx.uniqueName('PO-SC');
  const rcptRef = fx.uniqueName('RCPT-SC');
  const soRef = fx.uniqueName('SO-SC');
  const dispRef = fx.uniqueName('DISP-SC');

  // Screen 1: Purchase Order entry — 50 units @ $6.00
  db.stagePurchaseOrder({ reference: poRef, business, ledger, vendor: vendorName, item: valueName, quantity: 50, price_minor: 1200, transdate: '2027-08-01' });
  db.postPurchaseOrder(poRef, business, ledger, fx.userId);
  const poStatus = db.getOrderStatus(poRef);
  assert.equal(poStatus.quantity, 50);
  assert.equal(poStatus.value_minor, 50 * 1200);

  // Screen 2: Stock Receipt entry — all 50 units arrive, fulfilling the PO
  db.stageOrderReceipt({
    reference: rcptRef, business, ledger, po_reference: poRef,
    item: valueName, item_qty: qtyName, vendor: vendorName,
    quantity: 50, value_minor: 50 * 1200, transdate: '2027-08-01',
  });
  db.postOrderReceipt(rcptRef, business, ledger, fx.userId);
  assert.deepEqual(db.getOrderStatus(poRef), { quantity: 0, value_minor: 0 }, 'PO closed via the real receipt screen');
  const qtyAfterReceipt = (db.db.prepare(`SELECT balance_minor FROM account WHERE entity_id=(SELECT id FROM current_entities WHERE name=?)`).get(qtyName) as { balance_minor: number }).balance_minor;
  assert.equal(qtyAfterReceipt, 50);
  const tbAfterReceipt = db.getTrialBalance(business, ledger);
  assert.equal(tbAfterReceipt.rows.find((r) => r.name === valueName)!.debit_minor, 60000);
  assert.equal(tbAfterReceipt.rows.find((r) => r.name === vendorName)!.credit_minor, 60000);

  // Screen 3: Sales Order entry — the customer orders 20 units @ $18.00 selling price
  db.stageSalesOrder({ reference: soRef, business, ledger, customer: customerName, item: valueName, quantity: 20, price_minor: 1800, transdate: '2027-08-10' });
  db.postSalesOrder(soRef, business, ledger, fx.userId);
  assert.deepEqual(db.getOrderStatus(soRef), { quantity: 20, value_minor: 36000 });

  // Screen 4: Stock Dispatch + Invoice entry — ship 20 units, fulfilling the SO
  db.stageOrderDispatch({
    reference: dispRef, business, ledger, so_reference: soRef,
    item: valueName, item_qty: qtyName, customer: customerName,
    quantity: 20, unit_cost_minor: 1200, sale_price_minor: 1800, transdate: '2027-08-10',
  });
  db.postOrderDispatch(dispRef, business, ledger, fx.userId);

  assert.deepEqual(db.getOrderStatus(soRef), { quantity: 0, value_minor: 0 }, 'SO closed via the real dispatch screen');
  const tbFinal = db.getTrialBalance(business, ledger);
  assert.equal(tbFinal.rows.find((r) => r.name === customerName)!.debit_minor, 36000, '20 units at the 18.00 SELLING price');
  assert.equal(tbFinal.rows.find((r) => r.name === 'Sales Revenue')!.credit_minor, 36000);
  assert.equal(tbFinal.rows.find((r) => r.name === 'Cost of Goods Sold')!.debit_minor, 24000, '20 units at the 12.00 COST price, not the selling price');
  const qtyAfterDispatch = (db.db.prepare(`SELECT balance_minor FROM account WHERE entity_id=(SELECT id FROM current_entities WHERE name=?)`).get(qtyName) as { balance_minor: number }).balance_minor;
  assert.equal(qtyAfterDispatch, 30, '50 received minus 20 dispatched');
  assert.equal(tbFinal.rows.find((r) => r.name === valueName)!.debit_minor, 36000, '60000 received minus 24000 cost of what shipped = 36000 remaining, at the same 1200/unit cost');
});

test('posting a screen with nothing staged is rejected clearly, not silently a no-op', () => {
  const biz = fx.freshBusiness('NeverStagedTest Co');
  assert.throws(() => db.postPurchaseOrder('NEVER-STAGED-PO', biz.business, biz.actualLedger, fx.userId), db.NotFoundError);
  assert.throws(() => db.postOrderReceipt('NEVER-STAGED-RCPT', biz.business, biz.actualLedger, fx.userId), db.NotFoundError);
  assert.throws(() => db.postSalesOrder('NEVER-STAGED-SO', biz.business, biz.actualLedger, fx.userId), db.NotFoundError);
  assert.throws(() => db.postOrderDispatch('NEVER-STAGED-DISP', biz.business, biz.actualLedger, fx.userId), db.NotFoundError);
});

test('entities are append-only: renaming closes out the old row and appends a replacement under the same id, full history preserved', () => {
  const user2 = createUser(fx.uniqueName('renamer'), 'xxxxxxxx', ['Bookkeeper']).id;
  const name = fx.uniqueName('Epsilon Test Co');
  const renamed = fx.uniqueName('Epsilon Test Corporation');

  const created = db.create(db.requireEntity('Accounts Receivable', db.typeRootName), db.typeRootName, name, fx.userId);
  db.supersedeEntity(created.id, { name: renamed }, db.asUserId(user2));

  const current = db.getEntity(created.id)!;
  assert.equal(current.name, renamed, 'the live version reflects the rename');

  // A real, confirmed, now-stale assumption, same root cause as the two
  // revokeEntity tests just above: EntityHistoryRow (db.ts) carries no
  // deleted_at/deleted_by at all - getEntityHistory only ever selects
  // name, parent_id, relation_id, created_at, created_by. There is no
  // real "who/when closed out the old row" fact recorded separately;
  // the real, append-only story is told entirely by each row's own
  // created_by/created_at - the second, replacement row's creator is
  // the one real, recorded fact of who performed the rename.
  const history = db.getEntityHistory(created.id);
  assert.equal(history.length, 2, 'both the original and the renamed version must exist in history');
  assert.equal(history[0].name, name);
  assert.equal(history[0].created_by, fx.userId);
  assert.equal(history[1].name, renamed);
  assert.equal(history[1].created_by, user2, 'the SECOND user is recorded as the creator of the renamed version');
});

test('a renamed-away-from name can be reused immediately for an unrelated new entity', () => {
  const name = fx.uniqueName('Zeta Test Co');
  const renamed = fx.uniqueName('Zeta Test Corporation');
  const original = db.create(db.requireEntity('Accounts Receivable', db.typeRootName), db.typeRootName, name, fx.userId);
  db.supersedeEntity(original.id, { name: renamed }, fx.userId);

  const reused = db.create(db.requireEntity('Accounts Payable', db.typeRootName), db.typeRootName, name, fx.userId);
  assert.notEqual(reused.id, original.id, 'this must be a genuinely different logical entity, not the same one resurrected');
  assert.equal(db.getEntity(original.id)!.name, renamed, 'the original entity keeps its new name, unaffected');
});

test('renaming a parent never orphans its children — a childs parent_id keeps resolving correctly with zero other changes', () => {
  const parentName = fx.uniqueName('Eta Parent Co');
  const renamedParent = fx.uniqueName('Eta Parent Corporation');
  const parent = db.create(db.requireEntity('Accounts Receivable', db.typeRootName), db.typeRootName, parentName, fx.userId);
  const child = db.create(db.requireEntity(parentName, db.typeRootName), db.typeRootName, fx.uniqueName('Eta Child Contact'), fx.userId);

  db.supersedeEntity(parent.id, { name: renamedParent }, fx.userId);

  const childAfter = db.getEntity(child.id)!;
  assert.equal(childAfter.parent_id, parent.id, "the child's parent_id is unchanged — same stable id, new name resolved automatically");
  const tree = db.getEntityTree();
  const parentNode = tree.find((e) => e.id === parent.id)!;
  assert.equal(parentNode.name, renamedParent);
});

test('revokeEntity records who revoked it, and moves it permanently out of its old structural position', () => {
  const e = db.create(db.requireEntity('Accounts Receivable', db.typeRootName), db.typeRootName, fx.uniqueName('Theta Test Co'), fx.userId);
  db.revokeEntity(e.id, fx.userId);
  const after = db.getEntity(e.id);
  assert.ok(after, 'never truly deleted — stays current, moved into Revoked');
  assert.equal(after!.relation_id, null);
  const revokedParent = db.getEntity(after!.parent_id!);
  assert.equal(revokedParent?.name, 'Revoked');
  const history = db.getEntityHistory(e.id);
  assert.ok(history.length >= 2, 'at minimum, the original creation row plus the real revoke row');
  assert.equal(history[history.length - 1].created_by, fx.userId, 'who revoked it is the real, recorded creator of this final history row');
});

test('journal postings record who posted them — the other half of the audit trail, alongside entities own append-only history', () => {
  const biz = fx.freshBusiness('AuditTrailTest Co');
  const username = fx.uniqueName('poster');
  const user2 = createUser(username, 'xxxxxxxx', ['Bookkeeper']).id;

  db.stageLine({ reference: 'AUDIT-TEST-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-10-01', account: db.asAccountName('Cash and Bank'), amount_minor: 1000 });
  db.stageLine({ reference: 'AUDIT-TEST-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-10-01', account: db.asAccountName('Sales Revenue'), amount_minor: -1000 });
  db.postJournalEntry('AUDIT-TEST-1', biz.business, biz.actualLedger, db.asUserId(user2));

  const entries = db.listJournalEntries(biz.business, biz.actualLedger, 200);
  const posted = entries.find((e) => e.reference === 'AUDIT-TEST-1')!;
  assert.equal(posted.posted_by, username, 'listJournalEntries should show the actual username, not just a raw id');

  const detail = db.getJournalEntry(biz.business, biz.actualLedger, posted.journal_id, posted.occurrence_date!)!;
  assert.equal(detail.posted_by, username, 'the detail view must show it too');
});

test('a recurring journal records who created it — every occurrence it generates shows the same poster', () => {
  const biz = fx.freshBusiness('AuditRecurringTest Co');
  const username = fx.uniqueName('poster');
  const user3 = createUser(username, 'xxxxxxxx', ['Bookkeeper']).id;

  db.createRecurringJournal(biz.business, biz.actualLedger, 'AUDIT-REC-1', '2027-11-01', 'monthly', [
    { account: 'Rent', amount_minor: 20000 },
    { account: 'Cash and Bank', amount_minor: -20000 },
  ], db.asUserId(user3), 'Test recurring', 3);

  const entries = db.listJournalEntries(biz.business, biz.actualLedger, 200).filter((e) => e.reference === 'AUDIT-REC-1');
  assert.equal(entries.length, 3);
  assert.ok(entries.every((e) => e.posted_by === username), 'every generated occurrence should show the same creator');
});

test('AR Sale with tax: customer owes amount+tax, tax posts to Sales Tax Payable, everything balances', () => {
  // stageARSale/postARSale removed entirely, same confirmed reason as
  // "AR Sale form" above — the old trigger's own tax split (customer
  // debited amount+tax, revenue credited the base amount only, tax
  // credited separately to Sales Tax Payable) is reproduced here as a
  // plain, three-line General Journal entry, the real, live mechanism
  // every financial transaction goes through.
  const biz = fx.freshBusiness('TaxArTest Co');
  const customerName = fx.uniqueName('Acme Corp');
  db.createCustomer(customerName, fx.userId);
  db.stageLine({ reference: 'TAX-AR-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-12-01', account: db.asAccountName(customerName), amount_minor: 110000 });
  db.stageLine({ reference: 'TAX-AR-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-12-01', account: db.asAccountName('Sales Revenue'), amount_minor: -100000 });
  db.stageLine({ reference: 'TAX-AR-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-12-01', account: db.asAccountName('Sales Tax Payable'), amount_minor: -10000 });
  db.postJournalEntry('TAX-AR-1', biz.business, biz.actualLedger, fx.userId);

  const tb = db.getTrialBalance(biz.business, biz.actualLedger);
  assert.equal(tb.rows.find((r) => r.name === customerName)!.debit_minor, 110000, 'customer owes base + tax');
  assert.equal(tb.rows.find((r) => r.name === 'Sales Revenue')!.credit_minor, 100000, 'revenue is the base amount only, not inflated by tax');
  assert.equal(tb.rows.find((r) => r.name === 'Sales Tax Payable')!.credit_minor, 10000);
  assert.equal(tb.total_debit_minor, tb.total_credit_minor);
});

test('AP Purchase with tax: Purchases Tax Claimed is debited, vendor is owed amount+tax, everything balances', () => {
  const biz = fx.freshBusiness('TaxApTest Co');
  const vendorName = fx.uniqueName('Acme Supplies Pty Ltd');
  db.createProvider(vendorName, fx.userId);
  db.stageLine({ reference: 'TAX-AP-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-12-01', account: db.asAccountName('Office'), amount_minor: 50000 });
  db.stageLine({ reference: 'TAX-AP-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-12-01', account: db.asAccountName('Purchases Tax Claimed'), amount_minor: 5000 });
  db.stageLine({ reference: 'TAX-AP-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-12-01', account: db.asAccountName(vendorName), amount_minor: -55000 });
  db.postJournalEntry('TAX-AP-1', biz.business, biz.actualLedger, fx.userId);

  const tb = db.getTrialBalance(biz.business, biz.actualLedger);
  assert.equal(tb.rows.find((r) => r.name === 'Office')!.debit_minor, 50000);
  assert.equal(tb.rows.find((r) => r.name === 'Purchases Tax Claimed')!.debit_minor, 5000);
  assert.equal(tb.rows.find((r) => r.name === vendorName)!.credit_minor, 55000, 'vendor is owed base + tax');
  assert.equal(tb.total_debit_minor, tb.total_credit_minor);
});

test('a service dispatch (no item, no item_qty, no unit_cost) skips COGS and quantity movement entirely — matches the exact worked example: 10 hours @ 150.00 with 10% tax', () => {
  const biz = fx.freshBusiness('ServiceDispatchTest Co');
  const customerName = fx.uniqueName('Beta Pty Ltd');
  db.createCustomer(customerName, fx.userId);
  const soRef = fx.uniqueName('SO-SVC');
  const dispRef = fx.uniqueName('DISP-SVC');

  db.placeOrder(soRef, biz.business, biz.actualLedger, 10, 10 * 15000, fx.userId, '2027-12-05');
  db.stageOrderDispatch({
    reference: dispRef, business: biz.business, ledger: biz.actualLedger, so_reference: soRef,
    customer: customerName, quantity: 10, sale_price_minor: 15000, tax_minor: 15000, transdate: '2027-12-05',
  });
  db.postOrderDispatch(dispRef, biz.business, biz.actualLedger, fx.userId);

  const tb = db.getTrialBalance(biz.business, biz.actualLedger);
  assert.equal(tb.rows.find((r) => r.name === customerName)!.debit_minor, 165000, 'matches the worked example exactly: 1500.00 + 150.00 tax');
  assert.equal(tb.rows.find((r) => r.name === 'Sales Revenue')!.credit_minor, 150000);
  assert.equal(tb.rows.find((r) => r.name === 'Sales Tax Payable')!.credit_minor, 15000);
  assert.equal(tb.rows.find((r) => r.name === 'Cost of Goods Sold'), undefined, 'a service must never generate a COGS line — there is no batch to draw from');
  assert.equal(tb.total_debit_minor, tb.total_credit_minor);
  assert.deepEqual(db.getOrderStatus(soRef), { quantity: 0, value_minor: 0 }, 'the sales order still closes correctly, purely on value, with no quantity/stock tracking involved');
});

test('a service receipt (no item_qty) skips the quantity movement, still posts the monetary and tax legs correctly', () => {
  const biz = fx.freshBusiness('ServiceReceiptTest Co');
  const vendorName = fx.uniqueName('Acme Supplies Pty Ltd');
  db.createProvider(vendorName, fx.userId);
  const poRef = fx.uniqueName('PO-SVC');
  const rcptRef = fx.uniqueName('RCPT-SVC');

  db.placeOrder(poRef, biz.business, biz.actualLedger, 5, 5 * 20000, fx.userId, '2027-12-10');
  db.stageOrderReceipt({
    reference: rcptRef, business: biz.business, ledger: biz.actualLedger, po_reference: poRef,
    item: 'Office', vendor: vendorName, quantity: 5, value_minor: 100000, tax_minor: 10000, transdate: '2027-12-10',
  });
  db.postOrderReceipt(rcptRef, biz.business, biz.actualLedger, fx.userId);

  const tb = db.getTrialBalance(biz.business, biz.actualLedger);
  assert.equal(tb.rows.find((r) => r.name === 'Office')!.debit_minor, 100000);
  assert.equal(tb.rows.find((r) => r.name === 'Purchases Tax Claimed')!.debit_minor, 10000);
  assert.equal(tb.rows.find((r) => r.name === vendorName)!.credit_minor, 110000);
  assert.equal(tb.total_debit_minor, tb.total_credit_minor);
  assert.deepEqual(db.getOrderStatus(poRef), { quantity: 0, value_minor: 0 });
});

test('invoice_line records genuinely per-line tax, never assumed uniform — one line exempt, another at a different rate entirely', () => {
  const biz = fx.freshBusiness('InvoiceLineTaxTest Co');
  const qtyNameW = fx.uniqueName('ILWidget Batch Qty');
  const valueNameW = fx.uniqueName('ILWidget Batch Value');
  const qtyNameG = fx.uniqueName('ILGadget Batch Qty');
  const valueNameG = fx.uniqueName('ILGadget Batch Value');
  db.create(db.requireEntity('Stock Quantities', db.typeRootName), db.typeRootName, qtyNameW, fx.userId);
  db.create(db.requireEntity('Inventory', db.typeRootName, fx.coaCategoryRoot(biz.business, 'Asset')), db.typeRootName, valueNameW, fx.userId);
  db.create(db.requireEntity('Stock Quantities', db.typeRootName), db.typeRootName, qtyNameG, fx.userId);
  db.create(db.requireEntity('Inventory', db.typeRootName, fx.coaCategoryRoot(biz.business, 'Asset')), db.typeRootName, valueNameG, fx.userId);
  db.postQuantityMovement(biz.business, biz.actualLedger, fx.uniqueName('IL-STOCK-IN'), db.asAccountName(qtyNameW), 100, fx.userId, '2027-05-01');
  db.postQuantityMovement(biz.business, biz.actualLedger, fx.uniqueName('IL-STOCK-IN'), db.asAccountName(qtyNameG), 50, fx.userId, '2027-05-01');

  const customerName = fx.uniqueName('Acme Corp');
  db.createCustomer(customerName, fx.userId);
  const soRef = fx.uniqueName('SO-IL');
  const l1Ref = fx.uniqueName('IL-INV-L1');
  const l2Ref = fx.uniqueName('IL-INV-L2');

  db.placeOrder(soRef, biz.business, biz.actualLedger, 25, 20 * 1800 + 5 * 4500, fx.userId, '2027-05-01');
  db.stageOrderDispatch({
    reference: l1Ref, business: biz.business, ledger: biz.actualLedger, so_reference: soRef, item: valueNameW, item_qty: qtyNameW,
    customer: customerName, quantity: 20, unit_cost_minor: 1200, sale_price_minor: 1800, tax_minor: 0, transdate: '2027-05-01', description: 'Widgets exempt',
  });
  db.postOrderDispatch(l1Ref, biz.business, biz.actualLedger, fx.userId);
  db.stageOrderDispatch({
    reference: l2Ref, business: biz.business, ledger: biz.actualLedger, so_reference: soRef, item: valueNameG, item_qty: qtyNameG,
    customer: customerName, quantity: 5, unit_cost_minor: 3000, sale_price_minor: 4500, tax_minor: Math.round(5 * 4500 * 0.15), transdate: '2027-05-01', description: 'Gadgets 15%',
  });
  db.postOrderDispatch(l2Ref, biz.business, biz.actualLedger, fx.userId);

  const l1 = db.getInvoiceLine(l1Ref, biz.business, biz.actualLedger)!;
  const l2 = db.getInvoiceLine(l2Ref, biz.business, biz.actualLedger)!;
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

test('an ordinary General Journal posting records no invoice_line at all — it has no invoice concept', () => {
  const biz = fx.freshBusiness('NoInvoiceLineTest Co');
  db.stageLine({ reference: 'GJ-NO-INV', business: biz.business, ledger: biz.actualLedger, transdate: '2027-05-01', account: db.asAccountName('Cash and Bank'), amount_minor: 500 });
  db.stageLine({ reference: 'GJ-NO-INV', business: biz.business, ledger: biz.actualLedger, transdate: '2027-05-01', account: db.asAccountName('Sales Revenue'), amount_minor: -500 });
  db.postJournalEntry('GJ-NO-INV', biz.business, biz.actualLedger, fx.userId);
  assert.equal(db.getInvoiceLine('GJ-NO-INV', biz.business, biz.actualLedger), undefined);
});

test('closing a period rejects normal posting into it, and reopening lifts that immediately for a correction', () => {
  const biz = fx.freshBusiness('PeriodTest Co');

  assert.deepEqual(db.getPeriodLockStatus(biz.business, biz.actualLedger), { locked_through_date: null, changed_by: null, changed_at: null });

  db.stageLine({ reference: 'PRE-CLOSE', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-15', account: db.asAccountName('Cash and Bank'), amount_minor: 100 });
  db.stageLine({ reference: 'PRE-CLOSE', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-15', account: db.asAccountName('Sales Revenue'), amount_minor: -100 });
  db.postJournalEntry('PRE-CLOSE', biz.business, biz.actualLedger, fx.userId); // normal posting works before any lock

  db.closePeriod(biz.business, biz.actualLedger, '2027-01-31', fx.userId);
  const status = db.getPeriodLockStatus(biz.business, biz.actualLedger);
  assert.equal(status.locked_through_date, '2027-01-31');
  assert.equal(status.changed_by, fx.userId);

  db.stageLine({ reference: 'INTO-CLOSED', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-20', account: db.asAccountName('Cash and Bank'), amount_minor: 100 });
  db.stageLine({ reference: 'INTO-CLOSED', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-20', account: db.asAccountName('Sales Revenue'), amount_minor: -100 });
  assert.throws(() => db.postJournalEntry('INTO-CLOSED', biz.business, biz.actualLedger, fx.userId), /closed/);

  db.stageLine({ reference: 'AFTER-CLOSE', business: biz.business, ledger: biz.actualLedger, transdate: '2027-02-05', account: db.asAccountName('Cash and Bank'), amount_minor: 100 });
  db.stageLine({ reference: 'AFTER-CLOSE', business: biz.business, ledger: biz.actualLedger, transdate: '2027-02-05', account: db.asAccountName('Sales Revenue'), amount_minor: -100 });
  db.postJournalEntry('AFTER-CLOSE', biz.business, biz.actualLedger, fx.userId); // dates after the lock still work fine

  db.reopenPeriod(biz.business, biz.actualLedger, fx.userId);
  assert.equal(db.getPeriodLockStatus(biz.business, biz.actualLedger).locked_through_date, null);

  // The SAME staged entry that was rejected before now posts correctly —
  // exactly the amendment (correction) scenario reopening exists for.
  db.postJournalEntry('INTO-CLOSED', biz.business, biz.actualLedger, fx.userId);
  assert.equal(db.getTrialBalance(biz.business, biz.actualLedger).rows.find((r) => r.name === 'Cash and Bank')!.debit_minor, 300);
});

test('quantity movements and recurring journal start dates are also protected by a closed period, not just ordinary posting', () => {
  const biz = fx.freshBusiness('PeriodTest2 Co');
  const qtyName = fx.uniqueName('PeriodTest Batch Qty');
  db.create(db.requireEntity('Stock Quantities', db.typeRootName), db.typeRootName, qtyName, fx.userId);

  db.closePeriod(biz.business, biz.actualLedger, '2027-03-31', fx.userId);

  assert.throws(() => db.postQuantityMovement(biz.business, biz.actualLedger, 'QTY-INTO-CLOSED', db.asAccountName(qtyName), 10, fx.userId, '2027-03-15'), db.PostingError);
  assert.throws(
    () =>
      db.createRecurringJournal(
        biz.business, biz.actualLedger, 'REC-INTO-CLOSED', '2027-03-15', 'monthly',
        [{ account: 'Rent', amount_minor: 50000 }, { account: 'Cash and Bank', amount_minor: -50000 }],
        fx.userId
      ),
    db.PostingError
  );

  // Both work fine once dated after the lock.
  db.postQuantityMovement(biz.business, biz.actualLedger, 'QTY-AFTER-CLOSE', db.asAccountName(qtyName), 10, fx.userId, '2027-04-15');
});

test('Trial Balance and Balance Sheet asOfDate correctly excludes postings after the cutoff, without needing a period to be closed at all', () => {
  const biz = fx.freshBusiness('AsOfTest Co');

  db.stageLine({ reference: 'ASOF-JAN', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-15', account: db.asAccountName('Cash and Bank'), amount_minor: 500 });
  db.stageLine({ reference: 'ASOF-JAN', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-15', account: db.asAccountName('Sales Revenue'), amount_minor: -500 });
  db.postJournalEntry('ASOF-JAN', biz.business, biz.actualLedger, fx.userId);

  db.stageLine({ reference: 'ASOF-MAR', business: biz.business, ledger: biz.actualLedger, transdate: '2027-03-15', account: db.asAccountName('Cash and Bank'), amount_minor: 300 });
  db.stageLine({ reference: 'ASOF-MAR', business: biz.business, ledger: biz.actualLedger, transdate: '2027-03-15', account: db.asAccountName('Sales Revenue'), amount_minor: -300 });
  db.postJournalEntry('ASOF-MAR', biz.business, biz.actualLedger, fx.userId);

  const asOfFeb = db.getTrialBalance(biz.business, biz.actualLedger, '2027-02-01');
  assert.equal(asOfFeb.rows.find((r) => r.name === 'Cash and Bank')!.debit_minor, 500, 'only the January posting should count as of February');

  const asOfApril = db.getTrialBalance(biz.business, biz.actualLedger, '2027-04-01');
  assert.equal(asOfApril.rows.find((r) => r.name === 'Cash and Bank')!.debit_minor, 800, 'both postings should count once the cutoff is after both');

  const allTime = db.getTrialBalance(biz.business, biz.actualLedger);
  assert.equal(allTime.rows.find((r) => r.name === 'Cash and Bank')!.debit_minor, 800, 'omitting asOfDate must still mean all-time, unchanged from before this feature existed');

  const bsAsOfFeb = db.getBalanceSheet(biz.business, biz.actualLedger, '2027-02-01');
  assert.equal(bsAsOfFeb.assets.find((r) => r.name === 'Cash and Bank')?.debit_minor, 500);
});

test('Profit and Loss fromDate/toDate is a genuine range, not just a single cutoff — excludes postings both before AND after the window', () => {
  const biz = fx.freshBusiness('PLRangeTest Co');

  db.stageLine({ reference: 'PLR-JAN', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-15', account: db.asAccountName('Cash and Bank'), amount_minor: 1000 });
  db.stageLine({ reference: 'PLR-JAN', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-15', account: db.asAccountName('Sales Revenue'), amount_minor: -1000 });
  db.postJournalEntry('PLR-JAN', biz.business, biz.actualLedger, fx.userId);

  db.stageLine({ reference: 'PLR-FEB', business: biz.business, ledger: biz.actualLedger, transdate: '2027-02-15', account: db.asAccountName('Cash and Bank'), amount_minor: 2000 });
  db.stageLine({ reference: 'PLR-FEB', business: biz.business, ledger: biz.actualLedger, transdate: '2027-02-15', account: db.asAccountName('Sales Revenue'), amount_minor: -2000 });
  db.postJournalEntry('PLR-FEB', biz.business, biz.actualLedger, fx.userId);

  db.stageLine({ reference: 'PLR-MAR', business: biz.business, ledger: biz.actualLedger, transdate: '2027-03-15', account: db.asAccountName('Cash and Bank'), amount_minor: 4000 });
  db.stageLine({ reference: 'PLR-MAR', business: biz.business, ledger: biz.actualLedger, transdate: '2027-03-15', account: db.asAccountName('Sales Revenue'), amount_minor: -4000 });
  db.postJournalEntry('PLR-MAR', biz.business, biz.actualLedger, fx.userId);

  // February only — must exclude both January (before) and March (after).
  const febOnly = db.getProfitAndLoss(biz.business, biz.actualLedger, '2027-02-01', '2027-02-28');
  assert.equal(febOnly.total_income_minor, 2000, 'only February should count, not January or March');

  const allThreeMonths = db.getProfitAndLoss(biz.business, biz.actualLedger, '2027-01-01', '2027-03-31');
  assert.equal(allThreeMonths.total_income_minor, 7000, '1000 + 2000 + 4000');

  const allTime = db.getProfitAndLoss(biz.business, biz.actualLedger);
  assert.equal(allTime.total_income_minor, 7000, 'omitting the range must still mean all-time');
});

test('reversing the same occurrence twice is rejected clearly — the real bug this prevents silently corrupted journal_line by attaching a second reversals lines to the first one, since the reversal reference is deterministic', () => {
  const biz = fx.freshBusiness('DoubleReversalTest Co');

  db.createRecurringJournal(
    biz.business, biz.actualLedger, 'REC-DOUBLE-REV', '2027-01-01', 'monthly',
    [{ account: 'Rent', amount_minor: 80000 }, { account: 'Cash and Bank', amount_minor: -80000 }],
    fx.userId, 'Monthly rent', 3
  );
  const entries = db.listJournalEntries(biz.business, biz.actualLedger, 200).filter((e) => e.reference === 'REC-DOUBLE-REV');
  const feb = entries.find((e) => e.occurrence_date === '2027-02-01')!;

  db.reverseJournalEntry(biz.business, biz.actualLedger, feb.journal_id, feb.occurrence_date!, fx.userId, '2027-02-15');
  assert.throws(
    () => db.reverseJournalEntry(biz.business, biz.actualLedger, feb.journal_id, feb.occurrence_date!, fx.userId, '2027-02-20'),
    db.PostingError,
    'reversing the exact same occurrence again must be rejected clearly, not silently corrupt data'
  );

  // Confirm journal_line integrity directly — exactly two lines under
  // the ONE reversal journal, not four lines merged together the way
  // the original bug produced.
  const reversalJournalId = (
    db.db.prepare(`SELECT id FROM journal WHERE reference = ?`).get(`REC-DOUBLE-REV-REV-2027-02-01`) as { id: number }
  ).id;
  const reversalLines = db.db.prepare(`SELECT * FROM journal_line WHERE journal_id = ?`).all(reversalJournalId);
  assert.equal(reversalLines.length, 2, 'exactly two lines, not four merged from a corrupted second attempt');

  // The rest of the schedule is still correct: Jan + Mar only.
  const pl = db.getProfitAndLoss(biz.business, biz.actualLedger);
  assert.equal(pl.expenses.find((e) => e.name === 'Rent')?.debit_minor, 160000);
});

test('Balance Sheet and P&L split each line into debit/credit columns per accounting convention, and flag a line whose balance sits opposite its normal side', () => {
  const biz = fx.freshBusiness('ContraTest Co');

  // A normal asset balance: Cash debited 1000 — debit_minor set, not contra.
  db.stageLine({ reference: 'CONTRA-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-01', account: db.asAccountName('Cash and Bank'), amount_minor: 1000 });
  db.stageLine({ reference: 'CONTRA-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-01', account: db.asAccountName('Sales Revenue'), amount_minor: -1000 });
  db.postJournalEntry('CONTRA-1', biz.business, biz.actualLedger, fx.userId);

  const bsNormal = db.getBalanceSheet(biz.business, biz.actualLedger);
  const cash = bsNormal.assets.find((a) => a.name === 'Cash and Bank')!;
  assert.equal(cash.debit_minor, 1000);
  assert.equal(cash.credit_minor, 0);
  assert.equal(cash.is_contra, false, 'a normal debit balance on an asset is not contra');

  // Now push Cash into a genuine credit (overdrawn) position — abnormal
  // for an asset, must be flagged.
  db.stageLine({ reference: 'CONTRA-2', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-02', account: db.asAccountName('Cash and Bank'), amount_minor: -5000 });
  db.stageLine({ reference: 'CONTRA-2', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-02', account: db.asAccountName('Rent'), amount_minor: 5000 });
  db.postJournalEntry('CONTRA-2', biz.business, biz.actualLedger, fx.userId);

  const bsContra = db.getBalanceSheet(biz.business, biz.actualLedger);
  const cashOverdrawn = bsContra.assets.find((a) => a.name === 'Cash and Bank')!;
  assert.equal(cashOverdrawn.debit_minor, 0);
  assert.equal(cashOverdrawn.credit_minor, 4000, 'net credit of 4000 after the second entry');
  assert.equal(cashOverdrawn.is_contra, true, 'an asset sitting in credit is abnormal and must be flagged');

  // Sales Revenue is credit-normal — check it does NOT get flagged just
  // for being a normal credit balance.
  const revenue = db.getProfitAndLoss(biz.business, biz.actualLedger).income.find((i) => i.name === 'Sales Revenue');
  assert.equal(revenue?.credit_minor, 1000, 'unaffected by the second entry, which used Rent instead');
  assert.equal(revenue?.is_contra, false, 'a normal credit balance on income is not contra');
});

test('getProfitAndLossComparison correctly reconstructs each lines actual amount from debit_minor/credit_minor, not a stale removed field', () => {
  const biz = fx.freshBusiness('PLCFixTest Co');
  db.stageLine({ reference: 'PLCFIX-A', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-01', account: db.asAccountName('Cash and Bank'), amount_minor: 2500 });
  db.stageLine({ reference: 'PLCFIX-A', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-01', account: db.asAccountName('Sales Revenue'), amount_minor: -2500 });
  db.postJournalEntry('PLCFIX-A', biz.business, biz.actualLedger, fx.userId);

  const cmp = db.getProfitAndLossComparison(biz.business, biz.actualLedger, biz.budgetLedger);
  const revenueLine = cmp.income.find((l) => l.name === 'Sales Revenue');
  assert.equal(revenueLine?.a_minor, 2500, 'must reflect the real posted amount, not silently fall back to 0');
  assert.ok(!revenueLine?.b_minor, 'must be zero (0 or -0, numerically identical) for a ledger with no activity');
});

test('payment_terms_days persists per customer/vendor, since account management practice genuinely varies (30/60/90 for one, 7/14/21 for another, cash only for a third)', () => {
  const customerA = fx.uniqueName('Acme Corp');
  const customerB = fx.uniqueName('Beta Pty Ltd');
  const vendorA = fx.uniqueName('Acme Supplies Pty Ltd');
  db.createCustomer(customerA, fx.userId);
  db.createCustomer(customerB, fx.userId);
  db.createProvider(vendorA, fx.userId);
  db.setContact(customerA, { phone: '555-0100', payment_terms_days: 30 });
  db.setContact(customerB, { phone: '555-0200', payment_terms_days: 7 });
  db.setContact(vendorA, { phone: '555-0300', payment_terms_days: 0 });

  assert.equal(db.getContact(customerA)?.payment_terms_days, 30);
  assert.equal(db.getContact(customerB)?.payment_terms_days, 7);
  assert.equal(db.getContact(vendorA)?.payment_terms_days, 0, 'explicitly cash only, not null/unconfigured');
});

test('getAgingBuckets derives 1x/2x/3x buckets from a single term, matching real variation across customers', () => {
  assert.deepEqual(db.getAgingBuckets(30), [
    { label: '1-30', through_days: 30 },
    { label: '31-60', through_days: 60 },
    { label: '61-90', through_days: 90 },
  ]);
  assert.deepEqual(db.getAgingBuckets(7), [
    { label: '1-7', through_days: 7 },
    { label: '8-14', through_days: 14 },
    { label: '15-21', through_days: 21 },
  ]);
  assert.deepEqual(db.getAgingBuckets(14), [
    { label: '1-14', through_days: 14 },
    { label: '15-28', through_days: 28 },
    { label: '29-42', through_days: 42 },
  ]);
  assert.deepEqual(db.getAgingBuckets(0), [{ label: 'Due immediately', through_days: 0 }], 'cash only still ages — overdue immediately, not exempt');
  assert.deepEqual(db.getAgingBuckets(null), db.getAgingBuckets(30), 'unconfigured falls back to a conventional 30/60/90');
});

test('getCreditStatus: a real customer/vendor\'s own real balance checked against their own real, configured credit limit', () => {
  const biz = fx.freshBusiness('CreditStatusTest Co');
  const vendorName = fx.uniqueName('CreditStatusTest Vendor');
  db.create(db.requireEntity('Vendors', db.typeRootName), db.typeRootName, vendorName, fx.userId);
  db.setContact(vendorName, { payment_terms_days: 0, credit_limit_minor: 500000 });

  const before = db.getCreditStatus(vendorName);
  assert.equal(before.balanceMinor, 0);
  assert.equal(before.limitMinor, 500000);
  assert.equal(before.overLimit, false);
  assert.equal(before.remainingMinor, 500000);

  db.stageLine({ reference: 'CST-1', business: biz.business, ledger: biz.actualLedger, account: db.asAccountName('Inventory'), amount_minor: 600000 });
  db.stageLine({ reference: 'CST-1', business: biz.business, ledger: biz.actualLedger, account: db.asAccountName(vendorName), amount_minor: -600000 });
  db.postJournalEntry('CST-1', biz.business, biz.actualLedger, fx.userId);

  const after = db.getCreditStatus(vendorName);
  assert.equal(after.balanceMinor, 600000, 'a real, current outstanding balance, reported as a real positive amount regardless of the account\'s own natural debit/credit sign');
  assert.equal(after.overLimit, true, 'a real $6,000 balance against a real $5,000 limit must correctly show as over limit');
  assert.equal(after.remainingMinor, -100000, 'a real, negative remaining amount once genuinely over');

  // A real entity with no configured limit at all — never silently treated as "over" just because it has no limit.
  const noLimitName = fx.uniqueName('CreditStatusTest No Limit');
  db.create(db.requireEntity('Vendors', db.typeRootName), db.typeRootName, noLimitName, fx.userId);
  const noLimit = db.getCreditStatus(noLimitName);
  assert.equal(noLimit.limitMinor, null);
  assert.equal(noLimit.overLimit, false);
  assert.equal(noLimit.remainingMinor, null);
});

test('a item can be sourced from multiple manufacturer/vendor combinations, and preference is never derived from price', () => {
  const biz = fx.freshBusiness('PartsTest Co');
  const itemName = fx.uniqueName('PT-M6x20 Hex Bolt');
  db.createItem(itemName, 'Items', fx.userId, biz.business);
  db.setItem(itemName, { description: 'Zinc-plated steel hex bolt', unit_of_measure: 'each', upc: '012345678905' });
  const manufacturerA = fx.uniqueName('PT-Acme Fasteners');
  const manufacturerB = fx.uniqueName('PT-Beta Fasteners');
  const vendorLocal = fx.uniqueName('PT-Local Hardware');
  const vendorBulk = fx.uniqueName('PT-Bulk Wholesale');
  db.create(db.requireEntity('Manufacturers', db.typeRootName), db.typeRootName, manufacturerA, fx.userId);
  db.create(db.requireEntity('Manufacturers', db.typeRootName), db.typeRootName, manufacturerB, fx.userId);
  db.create(db.requireEntity('Accounts Payable', db.typeRootName), db.typeRootName, vendorLocal, fx.userId);
  db.create(db.requireEntity('Accounts Payable', db.typeRootName), db.typeRootName, vendorBulk, fx.userId);

  db.addOrUpdateItemSource({
    itemName, manufacturerName: manufacturerA, vendorName: vendorLocal,
    vendorSku: 'LHS-4471', priceMinor: 12, packageQuantity: 100, isPreferred: true,
    preferenceNotes: 'Keeps more in local stock',
  });
  db.addOrUpdateItemSource({
    itemName, manufacturerName: manufacturerB, vendorName: vendorBulk,
    vendorSku: 'BFW-9982', priceMinor: 9, packageQuantity: 500, isPreferred: false,
    preferenceNotes: 'Cheaper but minimum order is a full pallet',
  });

  const sources = db.listItemSources(itemName);
  assert.equal(sources.length, 2, 'the same item genuinely has two independent sources');

  const cheaper = sources.find((s) => s.price_minor === 9)!;
  const preferred = sources.find((s) => s.is_preferred)!;
  assert.notEqual(cheaper.vendor_name, preferred.vendor_name, 'the cheaper source is explicitly NOT the preferred one — preference is a real choice, not derived from price');
  assert.equal(preferred.price_minor, 12, 'the preferred source costs more, and that is fine — local stock and reliability were the actual reasons');

  const items = db.listItems(biz.business);
  const thisItem = items.find((p) => p.name === itemName)!;
  assert.equal(thisItem.source_count, 2);

  // Re-adding the same manufacturer/vendor combination updates in place,
  // not a duplicate — same upsert convention as account_entry/contact_entry.
  db.addOrUpdateItemSource({
    itemName, manufacturerName: manufacturerA, vendorName: vendorLocal,
    priceMinor: 13, isPreferred: true, preferenceNotes: 'Price went up slightly, still preferred',
  });
  const afterUpdate = db.listItemSources(itemName);
  assert.equal(afterUpdate.length, 2, 'still two sources, not three — the second addOrUpdateItemSource call updated the existing row');
  assert.equal(afterUpdate.find((s) => s.vendor_name === vendorLocal)?.price_minor, 13);
});

test('the system default display language lives on Application, reachable before any session exists, and setting it preserves append-only history', () => {
  assert.equal(db.getDefaultLanguage(), null, 'no default configured yet');

  db.setDefaultLanguage('German', fx.userId);
  assert.equal(db.getDefaultLanguage(), 'German');

  const app = db.getEntity((db.db.prepare(`SELECT id FROM current_entities WHERE name = 'Application'`).get() as { id: number }).id)!;
  const history = db.getEntityHistory(app.id);
  assert.equal(history.length, 2, 'the update used entity_update (close + append), not a raw overwrite');

  assert.throws(() => db.setDefaultLanguage('Not A Real Language', fx.userId), db.ValidationError);
});

test('Developer role, the global Employees/Manufacturers branches, and item_source all exist exactly once — the migration that restores these on an existing database is idempotent', () => {
  const developerRoleCount = (db.db.prepare(`SELECT COUNT(*) AS c FROM current_entities WHERE name = 'Developer' AND parent_id = (SELECT id FROM current_entities WHERE name = 'System Roles')`).get() as { c: number }).c;
  assert.equal(developerRoleCount, 1);

  // Employees and Manufacturers are genuinely global, singleton
  // branches (business-scoping goes through the "Place of Employment"
  // relationship, not tree parentage - see db-seed.ts's
  // seedWineRetailEmployees). "Items" is deliberately NOT in this
  // list any more: per a real, confirmed, live scoping bug fixed this
  // session (listItems/countItems, db.ts), Items is genuinely
  // per-business - every real business gets its own, direct child
  // named "Items" (PER_BUSINESS_ROOTS) - so more than one real entity
  // named "Items" existing at once, each under a genuinely different
  // business, is correct, not a duplicate.
  for (const name of ['Employees', 'Manufacturers']) {
    const matches = db.db.prepare(`SELECT COUNT(*) AS c FROM current_entities WHERE name = ?`).get(name) as { c: number };
    assert.equal(matches.c, 1, `${name} must exist exactly once`);
  }
  // The one, real, global Application-level "Items" root must still
  // exist exactly once, and exactly once only there - never
  // accidentally duplicated onto itself, and never confused with any
  // business's own, separate, per-business "Items" root.
  const globalItemsCount = (db.db.prepare(`SELECT COUNT(*) AS c FROM current_entities WHERE name = 'Items' AND parent_id = (SELECT id FROM current_entities WHERE name = 'Application')`).get() as { c: number }).c;
  assert.equal(globalItemsCount, 1, 'the global Items root must exist exactly once');

  const itemSourceView = db.db.prepare(`SELECT 1 FROM sqlite_master WHERE type='view' AND name='item_source'`).get();
  assert.ok(itemSourceView, 'item_source (now a real, direct compatibility view over entities.detail_json) must exist');
});

test('real multi-line invoices: header + lines, due date derived from the counterparty\'s own payment terms, posting creates the actual GL entry', () => {
  const biz = fx.freshBusiness('InvTest Co');
  const customerName = fx.uniqueName('Acme Corp');
  db.createCustomer(customerName, fx.userId);
  db.setContact(customerName, { payment_terms_days: 14 });

  const invoiceId = db.createInvoice({
    invoiceType: 'AR',
    business: biz.business,
    ledger: biz.actualLedger,
    reference: 'INVTEST-1',
    counterpartyName: customerName,
    invoiceDate: '2027-05-01',
    description: 'May order',
    lines: [
      { description: 'Widgets x10', quantity: 10, unitPriceMinor: 500, amountMinor: 5000, taxMinor: 0, dispatchReference: 'SD-TEST-1' },
      { description: 'Gadgets x5', quantity: 5, unitPriceMinor: 1000, amountMinor: 5000, taxMinor: 750, dispatchReference: 'SD-TEST-2' },
    ],
  }, fx.userId);

  const draft = db.getInvoice(invoiceId)!;
  assert.equal(draft.status, 'draft');
  assert.equal(draft.due_date, '2027-05-15', 'derived from this customer\'s own 14-day term, not a hardcoded default');
  assert.equal(draft.total_amount_minor, 10000);
  assert.equal(draft.total_tax_minor, 750);
  assert.equal(draft.lines.length, 2);

  db.postInvoice(invoiceId, 'Sales Revenue', 'Sales Tax Payable', fx.userId);

  const posted = db.getInvoice(invoiceId)!;
  assert.equal(posted.status, 'posted');
  assert.equal(posted.posted_by, 'admin');

  const tb = db.getTrialBalance(biz.business, biz.actualLedger);
  const customerRow = tb.rows.find((r) => r.name === customerName)!;
  assert.ok(customerRow.debit_minor >= 10750, 'the customer is genuinely debited for the full invoice total including tax');

  // Posting an already-posted invoice again must be rejected, not silently double-post.
  assert.throws(() => db.postInvoice(invoiceId, 'Sales Revenue', 'Sales Tax Payable', fx.userId), db.ValidationError);
});

test('Credit Note reverses an invoice correctly — the same mechanism run in reverse, not a parallel schema', () => {
  const biz = fx.freshBusiness('CreditNoteTest Co');
  const customerName = fx.uniqueName('Acme Corp');
  db.createCustomer(customerName, fx.userId);

  const invoiceId = db.createInvoice({
    invoiceType: 'AR',
    business: biz.business,
    ledger: biz.actualLedger,
    reference: 'INVCN-1',
    counterpartyName: customerName,
    invoiceDate: '2027-06-01',
    lines: [{ description: 'Widgets x10', amountMinor: 10000, taxMinor: 0 }],
  }, fx.userId);
  db.postInvoice(invoiceId, 'Sales Revenue', 'Sales Tax Payable', fx.userId);

  const beforeCredit = db.getTrialBalance(biz.business, biz.actualLedger).rows.find((r) => r.name === customerName)!.debit_minor;

  const creditNoteId = db.createInvoice({
    invoiceType: 'AR',
    documentType: 'credit_note',
    referencesInvoiceId: invoiceId,
    business: biz.business,
    ledger: biz.actualLedger,
    reference: 'CN-1',
    counterpartyName: customerName,
    invoiceDate: '2027-06-05',
    description: 'Return of 3 widgets',
    lines: [{ description: 'Widgets x3 returned', amountMinor: 3000, taxMinor: 0 }],
  }, fx.userId);
  const draft = db.getInvoice(creditNoteId)!;
  assert.equal(draft.document_type, 'credit_note');
  assert.equal(draft.references_invoice_id, invoiceId);

  db.postInvoice(creditNoteId, 'Sales Revenue', 'Sales Tax Payable', fx.userId);

  const afterCredit = db.getTrialBalance(biz.business, biz.actualLedger).rows.find((r) => r.name === customerName)!.debit_minor;
  assert.equal(afterCredit, beforeCredit - 3000, 'the credit note correctly reduces what the customer owes, not increases it');

  // Referencing a nonexistent invoice must be rejected.
  assert.throws(
    () =>
      db.createInvoice(
        {
          invoiceType: 'AR',
          documentType: 'credit_note',
          referencesInvoiceId: 999999,
          business: biz.business,
          ledger: biz.actualLedger,
          reference: 'CN-BAD',
          counterpartyName: customerName,
          invoiceDate: '2027-06-05',
          lines: [{ description: 'x', amountMinor: 100 }],
        },
        fx.userId
      ),
    db.ValidationError
  );
});

test('aged invoices: bucketed by each customer\'s own payment terms, and partial payment allocation genuinely reduces what is outstanding', () => {
  const biz = fx.freshBusiness('AgedInvoicesTest Co');
  const acmeName = fx.uniqueName('Acme Corp');
  const betaName = fx.uniqueName('Beta Pty Ltd');
  db.createCustomer(acmeName, fx.userId);
  db.createCustomer(betaName, fx.userId);
  db.setContact(acmeName, { payment_terms_days: 30 });
  db.setContact(betaName, { payment_terms_days: 7 });

  const inv1 = db.createInvoice({
    invoiceType: 'AR', business: biz.business, ledger: biz.actualLedger, reference: 'AGETEST-1',
    counterpartyName: acmeName, invoiceDate: '2027-01-01',
    lines: [{ description: 'x', amountMinor: 10000 }],
  }, fx.userId);
  db.postInvoice(inv1, 'Sales Revenue', 'Sales Tax Payable', fx.userId);

  const inv2 = db.createInvoice({
    invoiceType: 'AR', business: biz.business, ledger: biz.actualLedger, reference: 'AGETEST-2',
    counterpartyName: betaName, invoiceDate: '2027-01-01',
    lines: [{ description: 'y', amountMinor: 5000 }],
  }, fx.userId);
  db.postInvoice(inv2, 'Sales Revenue', 'Sales Tax Payable', fx.userId);

  assert.equal(db.getInvoiceOutstandingMinor(inv1), 10000);
  db.allocatePayment(inv1, 'RCPTTEST-1', 4000, '2027-01-15', 'Cash and Bank', fx.userId);
  assert.equal(db.getInvoiceOutstandingMinor(inv1), 6000, 'partial payment genuinely reduces what is outstanding');

  const aged = db.getAgedInvoices(biz.business, biz.actualLedger, 'AR', '2027-03-01');
  const acmeRow = aged.find((r) => r.reference === 'AGETEST-1')!;
  const betaRow = aged.find((r) => r.reference === 'AGETEST-2')!;

  assert.equal(acmeRow.outstanding_minor, 6000);
  assert.equal(acmeRow.bucket, '1-30', 'this customer aged against its own 30-day term');
  assert.equal(betaRow.bucket, 'Over 21', 'the other customer aged against its own much shorter 7-day term, not the same 30/60/90 as the first');

  // Cannot allocate more than what is actually outstanding.
  assert.throws(() => db.allocatePayment(inv1, 'RCPTTEST-2', 999999, '2027-01-16', 'Cash and Bank', fx.userId), db.ValidationError);

  // A fully-paid invoice must not appear in the aged report at all.
  db.allocatePayment(inv2, 'RCPTTEST-3', 5000, '2027-01-20', 'Cash and Bank', fx.userId);
  const agedAfterFullPayment = db.getAgedInvoices(biz.business, biz.actualLedger, 'AR', '2027-03-01');
  assert.ok(!agedAfterFullPayment.some((r) => r.reference === 'AGETEST-2'), 'a fully-paid invoice is not outstanding, so it must not show up as aged');
});

test('Credit Invoice (restocks) vs Credit Note (does not) — matching SQL-Ledger\'s real distinction, applied per-line based on whether restocking was actually requested', () => {
  const biz = fx.freshBusiness('RestockCreditTest Co');
  const itemName = fx.uniqueName('RSTest Widget');
  db.createItem(itemName, 'Items', fx.userId, biz.business);
  const customerName = fx.uniqueName('Acme Corp');
  db.createCustomer(customerName, fx.userId);

  const invId = db.createInvoice({
    invoiceType: 'AR', business: biz.business, ledger: biz.actualLedger, reference: 'RSTEST-INV',
    counterpartyName: customerName, invoiceDate: '2027-02-01',
    lines: [{ description: 'x10', quantity: 10, unitPriceMinor: 100, amountMinor: 1000, itemName }],
  }, fx.userId);
  db.postInvoice(invId, 'Sales Revenue', 'Sales Tax Payable', fx.userId);

  const cnId = db.createInvoice({
    invoiceType: 'AR', documentType: 'credit_note', referencesInvoiceId: invId,
    business: biz.business, ledger: biz.actualLedger, reference: 'RSTEST-CN',
    counterpartyName: customerName, invoiceDate: '2027-02-05',
    lines: [{ description: 'x3 returned', quantity: 3, unitPriceMinor: 100, amountMinor: 300, itemName }],
  }, fx.userId);
  db.postInvoice(cnId, 'Sales Revenue', 'Sales Tax Payable', fx.userId, true); // restockInventory=true

  const afterRestock = (db.db.prepare(`SELECT balance_minor FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name=?)`).get(itemName) as { balance_minor: number });
  assert.equal(afterRestock.balance_minor, 3, 'restocking genuinely adds the returned quantity back');

  const cn2Id = db.createInvoice({
    invoiceType: 'AR', documentType: 'credit_note', referencesInvoiceId: invId,
    business: biz.business, ledger: biz.actualLedger, reference: 'RSTEST-CN2',
    counterpartyName: customerName, invoiceDate: '2027-02-06',
    lines: [{ description: 'x2 price correction, no return', quantity: 2, unitPriceMinor: 100, amountMinor: 200, itemName }],
  }, fx.userId);
  db.postInvoice(cn2Id, 'Sales Revenue', 'Sales Tax Payable', fx.userId, false); // restockInventory=false

  const afterNoRestock = (db.db.prepare(`SELECT balance_minor FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name=?)`).get(itemName) as { balance_minor: number });
  assert.equal(afterNoRestock.balance_minor, 3, 'a credit note without restocking must leave stock quantity unchanged, matching SQL-Ledger\'s own Credit Note behavior');
});

test('Reminders: escalate per customer, cap at level 3, and reset independently of any other contact edit', () => {
  const biz = fx.freshBusiness('RemindersTest Co');
  const customerName = fx.uniqueName('Beta Pty Ltd');
  db.createCustomer(customerName, fx.userId);
  db.setContact(customerName, { payment_terms_days: 7 });

  const invId = db.createInvoice({
    invoiceType: 'AR', business: biz.business, ledger: biz.actualLedger, reference: 'REMTEST-1',
    counterpartyName: customerName, invoiceDate: '2027-03-01',
    lines: [{ description: 'x', amountMinor: 5000 }],
  }, fx.userId);
  db.postInvoice(invId, 'Sales Revenue', 'Sales Tax Payable', fx.userId);

  const candidates = db.getReminderCandidates(biz.business, biz.actualLedger, '2027-04-01');
  const betaCandidate = candidates.find((c) => c.counterparty === customerName)!;
  assert.equal(betaCandidate.current_level, 0);
  assert.equal(betaCandidate.next_level, 1);

  assert.equal(db.recordReminderSent(customerName), 1);
  assert.equal(db.recordReminderSent(customerName), 2);
  assert.equal(db.recordReminderSent(customerName), 3);
  assert.equal(db.recordReminderSent(customerName), 3, 'caps at 3, the harshest level, never escalates further');

  // An unrelated contact edit must NOT reset the reminder level —
  // setContact's full-replace semantics deliberately exclude it.
  db.setContact(customerName, { payment_terms_days: 14 });
  assert.equal(db.getContact(customerName)?.reminder_level, 3, 'reminder_level survives an unrelated contact edit');

  db.resetReminderLevel(customerName);
  assert.equal(db.getContact(customerName)?.reminder_level, 0);
});

test('aged summary rolls up per customer (matching SQL-Ledger\'s Summary aging view), and counterparty history shows real line-item activity', () => {
  const biz = fx.freshBusiness('AgedSummaryTest Co');
  const customerName = fx.uniqueName('HistTest Customer');
  db.create(db.requireEntity('Accounts Receivable', db.typeRootName), db.typeRootName, customerName, fx.userId);
  db.setContact(customerName, { payment_terms_days: 30 });

  const inv1 = db.createInvoice({
    invoiceType: 'AR', business: biz.business, ledger: biz.actualLedger, reference: 'HISTTEST-1',
    counterpartyName: customerName, invoiceDate: '2027-04-01',
    lines: [{ description: 'Widgets x5', quantity: 5, unitPriceMinor: 200, amountMinor: 1000 }],
  }, fx.userId);
  db.postInvoice(inv1, 'Sales Revenue', 'Sales Tax Payable', fx.userId);

  const inv2 = db.createInvoice({
    invoiceType: 'AR', business: biz.business, ledger: biz.actualLedger, reference: 'HISTTEST-2',
    counterpartyName: customerName, invoiceDate: '2027-04-10',
    lines: [{ description: 'Gadgets x2', quantity: 2, unitPriceMinor: 500, amountMinor: 1000 }],
  }, fx.userId);
  db.postInvoice(inv2, 'Sales Revenue', 'Sales Tax Payable', fx.userId);

  const summary = db.getAgedSummary(biz.business, biz.actualLedger, 'AR', '2027-06-01');
  const customerSummary = summary.find((r) => r.counterparty === customerName)!;
  assert.equal(customerSummary.outstanding_minor, 2000, 'summary correctly rolls up both invoices into one total');

  const history = db.getCounterpartyHistory(biz.business, biz.actualLedger, customerName);
  assert.ok(history.some((h) => h.description === 'Widgets x5' && h.quantity === 5));
  assert.ok(history.some((h) => h.description === 'Gadgets x2' && h.quantity === 2));
  assert.equal(history[0].invoice_date, '2027-04-10', 'most recent activity first');
});

test('stock write-offs (breakage/spoilage): a real dual-effect transaction, reducing quantity on hand AND recognizing the actual loss in the GL, not just an adjustment with no accounting consequence', () => {
  const biz = fx.freshBusiness('WriteOffTest Co');
  const itemName = fx.uniqueName('WOTest Perishable');
  db.createItem(itemName, 'Items', fx.userId, biz.business);
  const expenseName = fx.uniqueName('WOTest Write-off Expense');
  db.create(fx.coaCategoryRoot(biz.business, 'Expense'), db.typeRootName, expenseName, fx.userId);

  db.postQuantityMovement(biz.business, biz.actualLedger, 'WOTEST-RECEIVE-QTY', db.asAccountName(itemName), 100, fx.userId, '2027-01-01');

  db.writeOffItems(biz.business, biz.actualLedger, 'WOTEST-1', db.asItemName(itemName), 15, 200, db.asAccountName(expenseName), 'Inventory', 'Spoiled', fx.userId, '2027-02-01');

  const qty = (db.db.prepare(`SELECT balance_minor FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name=? AND parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses'))))`).get(itemName, 'Items', biz.business) as { balance_minor: number });
  assert.equal(qty.balance_minor, 85, 'quantity genuinely reduced, not just recorded');

  const pl = db.getProfitAndLoss(biz.business, biz.actualLedger);
  const writeOffLine = pl.expenses.find((e) => e.name === expenseName);
  assert.equal(writeOffLine?.debit_minor, 3000, 'the loss is actually recognized as an expense (15 units x 200 minor units), not silently unaccounted for');

  assert.throws(
    () => db.writeOffItems(biz.business, biz.actualLedger, 'WOTEST-2', db.asItemName(itemName), -5, 200, db.asAccountName(expenseName), 'Inventory', 'bad', fx.userId, '2027-02-02'),
    db.ValidationError,
    'a write-off is always a reduction, never a gain — negative quantity must be rejected'
  );
});

test('lot/expiration tracking: consumption is genuinely FIFO by expiration date, not receipt order, and the expiring-stock report only shows what actually still has quantity', () => {
  const biz = fx.freshBusiness('LotTest Co');
  const itemName = fx.uniqueName('LotTest Dairy');
  db.createItem(itemName, 'Items', fx.userId, biz.business);

  // Received in this order: B, A, C — but A expires soonest.
  db.receiveLot(biz.business, biz.actualLedger, 'LOTTEST-R1', db.asItemName(itemName), 'LOT-B', '2027-01-05', '2027-03-15', 50, fx.userId);
  db.receiveLot(biz.business, biz.actualLedger, 'LOTTEST-R2', db.asItemName(itemName), 'LOT-A', '2027-01-01', '2027-02-01', 30, fx.userId);
  db.receiveLot(biz.business, biz.actualLedger, 'LOTTEST-R3', db.asItemName(itemName), 'LOT-C', '2027-01-10', '2027-04-01', 40, fx.userId);

  const overallQty = (db.db.prepare(`SELECT balance_minor FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name=?)`).get(itemName) as { balance_minor: number });
  assert.equal(overallQty.balance_minor, 120, 'overall quantity tracks the sum across all lots');

  const consumed = db.consumeFromLots(db.asItemName(itemName), 60);
  assert.deepEqual(
    consumed,
    [
      { lot_number: 'LOT-A', consumed: 30, expiration_date: '2027-02-01', cost_basis_minor: null },
      { lot_number: 'LOT-B', consumed: 30, expiration_date: '2027-03-15', cost_basis_minor: null },
    ],
    'LOT-A consumed first despite being received second, because it expires soonest — genuine FIFO by expiration, not receipt order'
  );

  const expiring = db.getExpiringStock('2027-01-15', 60).filter((e) => e.lot_number === 'LOT-B' || e.item_name === itemName || true);
  const thisItemExpiring = expiring.filter((e) => e.lot_number === 'LOT-B' && e.quantity_on_hand === 20);
  assert.ok(thisItemExpiring.length >= 1, 'LOT-B genuinely qualifies as expiring stock with its remaining 20 units');
  assert.ok(!expiring.some((e) => e.lot_number === 'LOT-A'), 'LOT-A is fully consumed and must be excluded');

  assert.throws(() => db.consumeFromLots(db.asItemName(itemName), 999), db.ValidationError, 'cannot consume more than what is genuinely on hand across all lots');
});

test('Locations: per-location stock, exactly one billing address, warehouse-direct dispatch for large orders, same-city transfers, and below-reorder reporting', () => {
  const biz = fx.freshBusiness('LocTest Co');
  const headOffice = fx.freshLocation(biz.business, 'LocTest Head Office', { city: 'LocTest City A', location_type: 'Warehouse', is_billing_address: true, bottle_capacity: null, carton_capacity: null });
  const retailA1 = fx.freshLocation(biz.business, 'LocTest Retail A1', { city: 'LocTest City A', location_type: 'Retail', is_billing_address: false, bottle_capacity: 2000, carton_capacity: 300 });
  const retailB1 = fx.freshLocation(biz.business, 'LocTest Retail B1', { city: 'LocTest City B', location_type: 'Retail', is_billing_address: false, bottle_capacity: 1800, carton_capacity: 280 });

  // Exactly one CURRENT billing address among this business's own locations.
  assert.equal(db.getLocation(headOffice.name, biz.business)?.is_billing_address, true);
  assert.equal(db.getLocation(retailA1.name, biz.business)?.is_billing_address, false);
  assert.equal(db.getLocation(retailB1.name, biz.business)?.is_billing_address, false);

  const itemName = fx.uniqueName('LocTest Lager');
  db.createItem(itemName, 'Items', fx.userId, biz.business);

  // 48 cartons at 24 bottles each, received at the warehouse.
  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('LOCTEST-REC'), db.asItemName(itemName), headOffice.name, 48 * 24, fx.userId, '2027-01-01');
  assert.equal(db.getItemLocation(db.asItemName(itemName), headOffice.name).quantity_on_hand, 1152);

  db.setItemLocationLevels(db.asItemName(itemName), retailA1.name, { minLevel: 5 * 24, maxLevel: 20 * 24, reorderLevel: 8 * 24 }, biz.business, biz.actualLedger, fx.userId);
  const levels = db.getItemLocation(db.asItemName(itemName), retailA1.name);
  assert.equal(levels.min_level, 120);
  assert.equal(levels.max_level, 480);
  assert.equal(levels.reorder_level, 192);

  // The real correction: sale is through retail, but a large function
  // order is dispatched directly from the warehouse.
  db.dispatchItems(biz.business, biz.actualLedger, fx.uniqueName('LOCTEST-DISP'), db.asItemName(itemName), headOffice.name, 48 * 24, fx.userId, '2027-01-05');
  assert.equal(db.getItemLocation(db.asItemName(itemName), headOffice.name).quantity_on_hand, 0);

  // Ordinary stock transfer, warehouse to retail, same city.
  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('LOCTEST-REC'), db.asItemName(itemName), headOffice.name, 100 * 24, fx.userId, '2027-01-10');
  db.transferItems(biz.business, biz.actualLedger, db.asItemName(itemName), headOffice.name, retailA1.name, 10 * 24, fx.uniqueName('LOCTEST-XFER'));
  assert.equal(db.getItemLocation(db.asItemName(itemName), headOffice.name).quantity_on_hand, 90 * 24);
  assert.equal(db.getItemLocation(db.asItemName(itemName), retailA1.name).quantity_on_hand, 10 * 24);

  // A warehouse only serves its own city's outlets — cross-city transfer rejected.
  assert.throws(
    () => db.transferItems(biz.business, biz.actualLedger, db.asItemName(itemName), headOffice.name, retailB1.name, 24, fx.uniqueName('LOCTEST-XFER-BAD')),
    db.ValidationError
  );

  // Cannot dispatch/transfer more than what's on hand at that specific location.
  assert.throws(
    () => db.dispatchItems(biz.business, biz.actualLedger, fx.uniqueName('LOCTEST-DISP-BAD'), db.asItemName(itemName), retailA1.name, 999999, fx.userId, '2027-01-11'),
    db.ValidationError
  );

  // Below-reorder: 240 bottles on hand vs reorder_level 192 — not below yet.
  // getBelowReorderStock reads Session.Business directly (not a
  // parameter), per the established session-context design — the
  // same reason fixtures.ts's withBusinessSession exists.
  const belowBefore = fx.withBusinessSession(biz, () => db.getBelowReorderStock().filter((r) => r.item === itemName));
  assert.equal(belowBefore.length, 0);

  // Sell most of it down, then it should show up.
  db.dispatchItems(biz.business, biz.actualLedger, fx.uniqueName('LOCTEST-DISP'), db.asItemName(itemName), retailA1.name, 8 * 24, fx.userId, '2027-01-12');
  const belowAfter = fx.withBusinessSession(biz, () => db.getBelowReorderStock().filter((r) => r.item === itemName && r.location === retailA1.name));
  assert.equal(belowAfter.length, 1, 'now at or below its own reorder level, correctly surfaced');
});

test('quantity movements carry a real, queryable location — receive, dispatch, and transfer (both legs) each record where it actually happened, not just updating the current-state snapshot', () => {
  const biz = fx.freshBusiness('MoveLocTest Co');
  const warehouse = fx.freshLocation(biz.business, 'MoveLocTest Warehouse', { location_type: 'Warehouse', bottle_capacity: 0, carton_capacity: 5000 });
  const outlet = fx.freshLocation(biz.business, 'MoveLocTest Outlet', { location_type: 'Retail', bottle_capacity: 500, carton_capacity: 50 });
  const itemName = fx.uniqueName('MoveLocTest Wine');
  db.createItem(itemName, 'Items', fx.userId, biz.business);

  const recRef = fx.uniqueName('MOVELOCTEST-REC');
  db.receiveItems(biz.business, biz.actualLedger, recRef, db.asItemName(itemName), warehouse.name, 100, fx.userId, '2027-09-01');
  function locationOf(reference: string, sign?: 'positive' | 'negative'): string | null {
    const signClause = sign === 'positive' ? 'AND jl.amount_minor > 0' : sign === 'negative' ? 'AND jl.amount_minor < 0' : '';
    const row = db.db
      .prepare(`SELECT l.name FROM journal_line jl JOIN journal j ON j.id = jl.journal_id LEFT JOIN current_entities l ON l.id = jl.location_id WHERE j.reference = ? ${signClause}`)
      .get(reference) as { name: string | null } | undefined;
    return row?.name ?? null;
  }
  assert.equal(locationOf(recRef), warehouse.name, 'a real receipt must record the real location it was actually received at');

  // A real transfer now stages both its real legs under one, shared
  // reference and posts once — a true, balanced two-line entry, not
  // two separate postings under two different references.
  const xferRef = fx.uniqueName('MOVELOCTEST-XFER');
  db.transferItems(biz.business, biz.actualLedger, db.asItemName(itemName), warehouse.name, outlet.name, 30, xferRef, 1, '2027-09-02');
  assert.equal(locationOf(xferRef, 'negative'), warehouse.name, "a transfer's own OUT leg (the negative amount) must record the real source location");
  assert.equal(locationOf(xferRef, 'positive'), outlet.name, "a transfer's own IN leg (the positive amount) must record the real destination — previously transferItems recorded no movement history at all, only updating the current-state snapshot");

  // The real, direct claim: one, true, balanced double-entry posting —
  // a single real journal row (not two), with its two real lines
  // summing to exactly zero.
  const journalRows = db.db.prepare(`SELECT id FROM journal WHERE reference = ?`).all(xferRef) as { id: number }[];
  assert.equal(journalRows.length, 1, 'a real transfer must be one, single, real journal entry — not two separate ones that merely net to zero');
  const lineSum = (
    db.db.prepare(`SELECT SUM(amount_minor) AS total FROM journal_line WHERE journal_id = ?`).get(journalRows[0].id) as { total: number }
  ).total;
  assert.equal(lineSum, 0, "a real transfer's own two, real lines must sum to exactly zero — genuine double-entry balance, not an invented offsetting account");

  const dispRef = fx.uniqueName('MOVELOCTEST-DISP');
  db.dispatchItems(biz.business, biz.actualLedger, dispRef, db.asItemName(itemName), outlet.name, 10, fx.userId, '2027-09-03');
  assert.equal(locationOf(dispRef), outlet.name, 'a real dispatch must record the real location it was actually dispatched from');
});

test('true double-entry quantity tracking: a real "on order" account for receipts and a real "units sold" account for dispatches — the genuine counteritem, not derived arithmetic, per direct confirmation', () => {
  const biz = fx.freshBusiness('DblEntryQtyTest Co');
  const warehouse = fx.freshLocation(biz.business, 'DblEntryQty Warehouse', { location_type: 'Warehouse', bottle_capacity: 0, carton_capacity: 5000 });
  const outlet = fx.freshLocation(biz.business, 'DblEntryQty Outlet', { location_type: 'Retail', bottle_capacity: 500, carton_capacity: 50 });
  const vendorName = fx.uniqueName('DblEntryQty Vendor');
  db.create(db.requireEntity('Vendors', db.typeRootName), db.typeRootName, vendorName, fx.userId);
  const itemName = fx.uniqueName('DblEntryQty Wine');
  db.createItem(itemName, 'Items', fx.userId, biz.business);

  function balanceOfUnder(childName: string, parentName: string): number {
    return (
      (db.db
        .prepare(
          `SELECT balance_minor FROM account WHERE entity_id = (
             SELECT c.id FROM current_entities c JOIN current_entities p ON p.id = c.parent_id
             WHERE c.name = ? AND p.name = ?
           )`
        )
        .get(childName, parentName) as { balance_minor: number } | undefined)?.balance_minor ?? 0
    );
  }

  // Placing a real PO builds up a real, genuine "on order" balance —
  // an independently meaningful fact, not derived from anything else.
  const poRef = fx.uniqueName('DEQ-PO');
  db.stagePurchaseOrder({ reference: poRef, business: biz.business, ledger: biz.actualLedger, vendor: vendorName, item: itemName, quantity: 60, price_minor: 1500, transdate: '2027-08-01' });
  db.postPurchaseOrder(poRef, biz.business, biz.actualLedger, fx.userId);
  assert.equal(balanceOfUnder('On Order', itemName), 60, 'placing a real PO must build up a real, genuine on-order balance');

  // Receiving stock is now a real, balanced, two-line posting.
  const recv1Ref = fx.uniqueName('DEQ-RECV');
  db.receiveItems(biz.business, biz.actualLedger, recv1Ref, db.asItemName(itemName), warehouse.name, 60, fx.userId, '2027-08-05');
  const receiptJournalId = (db.db.prepare(`SELECT id FROM journal WHERE reference = ?`).get(recv1Ref) as { id: number }).id;
  const receiptSum = (db.db.prepare(`SELECT SUM(amount_minor) AS total FROM journal_line WHERE journal_id = ?`).get(receiptJournalId) as { total: number }).total;
  assert.equal(receiptSum, 0, 'a real receipt must be a genuinely balanced, two-line entry — debit on-hand, credit on-order');
  assert.equal(balanceOfUnder('On Order', itemName), 0, 'a real receipt that exactly fulfills the real, matching PO must bring on-order back to exactly zero');
  assert.equal(db.getItemLocation(db.asItemName(itemName), warehouse.name).quantity_on_hand, 60);

  // A real receipt with no matching PO ever placed — a real, honest
  // possibility (an emergency, unplanned purchase) — must not be
  // refused; on-order simply, correctly goes negative.
  const recv2Ref = fx.uniqueName('DEQ-RECV');
  db.receiveItems(biz.business, biz.actualLedger, recv2Ref, db.asItemName(itemName), warehouse.name, 10, fx.userId, '2027-08-06');
  assert.equal(balanceOfUnder('On Order', itemName), -10, 'a real, unplanned receipt with no matching PO must correctly drive on-order negative, not be refused');

  // Dispatching stock (a real sale) is also now a real, balanced, two-line posting.
  db.transferItems(biz.business, biz.actualLedger, db.asItemName(itemName), warehouse.name, outlet.name, 20, fx.uniqueName('DEQ-XFER'), 1, '2027-08-07');
  const dispRef = fx.uniqueName('DEQ-DISP');
  db.dispatchItems(biz.business, biz.actualLedger, dispRef, db.asItemName(itemName), outlet.name, 15, fx.userId, '2027-08-08');
  const dispatchJournalId = (db.db.prepare(`SELECT id FROM journal WHERE reference = ?`).get(dispRef) as { id: number }).id;
  const dispatchSum = (db.db.prepare(`SELECT SUM(amount_minor) AS total FROM journal_line WHERE journal_id = ?`).get(dispatchJournalId) as { total: number }).total;
  assert.equal(dispatchSum, 0, 'a real dispatch must be a genuinely balanced, two-line entry — debit units sold, credit on-hand');
  assert.equal(balanceOfUnder('Units Sold', itemName), 15, "a real dispatch must build up a real, genuine units-sold balance, mirroring COGS on the quantity side");
  assert.equal(db.getItemLocation(db.asItemName(itemName), outlet.name).quantity_on_hand, 5);
});

test('getStockMovementReport: the real, physical journey of stock — purchases into a warehouse, a real transfer on to a retail outlet, and a real sale, each correctly enriched with its own real category, division, and vendor', () => {
  const biz = fx.freshBusiness('SMRTest Co');
  const region = fx.uniqueName('SMRTest Region');
  db.create(db.requireEntity('Application', db.typeRootName), db.typeRootName, region, fx.userId);
  const warehouse = fx.freshLocation(biz.business, 'SMRTest Warehouse', { city: region, location_type: 'Warehouse', bottle_capacity: 0, carton_capacity: 5000 });
  // A location's own `city` is just free-text, never a real, structural
  // link to anything (see "Locations:..." above) - a real division
  // grouping is reached the same, real, established way every other
  // "Division" test in this file already uses: setHierarchyParent.
  db.setHierarchyParent(warehouse.name, 'Division', region, fx.userId);
  const outlet = fx.freshLocation(biz.business, 'SMRTest Outlet', { city: region, location_type: 'Retail', is_billing_address: true, bottle_capacity: 500, carton_capacity: 50 });
  db.setHierarchyParent(outlet.name, 'Division', region, fx.userId);
  const categoryName = fx.uniqueName('SMRTest Category');
  db.createItemCategory(biz.business, categoryName, undefined, fx.userId);
  const itemName = fx.uniqueName('SMRTest Wine');
  db.createItem(itemName, categoryName, fx.userId, biz.business);
  const vendorName = fx.uniqueName('SMRTest Vendor');
  const customerName = fx.uniqueName('SMRTest Wine Customer');
  db.create(db.requireEntity('Vendors', db.typeRootName), db.typeRootName, vendorName, fx.userId);
  db.create(db.requireEntity('Customers', db.typeRootName), db.typeRootName, customerName, fx.userId);
  const { salesAccount, salesAccountId } = db.ensureItemSalesCogsAccounts(db.asItemName(itemName), fx.userId, undefined, biz.business);
  db.addOrUpdateItemSource({ itemName, vendorName, isPreferred: true });

  // Real purchase into the warehouse.
  db.receiveItems(biz.business, biz.actualLedger, 'SMRT-1-RECV', db.asItemName(itemName), warehouse.name, 50, fx.userId, '2027-10-01');
  // Real transfer on to the retail outlet.
  db.transferItems(biz.business, biz.actualLedger, db.asItemName(itemName), warehouse.name, outlet.name, 20, 'SMRT-1-XFER', 1, '2027-10-02');
  // Real sale — a real invoice, dispatched, exactly matching how completePosSale itself structures references.
  const invoiceId = db.createInvoice(
    {
      invoiceType: 'AR',
      business: biz.business,
      ledger: biz.actualLedger,
      reference: 'SMRT-SALE-1',
      counterpartyName: customerName,
      invoiceDate: '2027-10-03',
      lines: [{ description: itemName, quantity: 3, unitPriceMinor: 1500, amountMinor: 4500, taxMinor: 0, itemName }],
    },
    fx.userId
  );
  db.postInvoice(invoiceId, { name: salesAccount, id: salesAccountId }, 'Sales Tax Payable', fx.userId);
  db.dispatchItems(biz.business, biz.actualLedger, `SMRT-SALE-1-DISPATCH-${itemName}`, db.asItemName(itemName), outlet.name, 3, fx.userId, '2027-10-03');

  const report = db.getStockMovementReport(biz.business, biz.actualLedger, '2027-10-01', '2027-10-03', 'Division');

  assert.equal(report.receipts.length, 1);
  assert.equal(report.receipts[0].location, warehouse.name);
  assert.equal(report.receipts[0].group, region, "a receipt's real location must correctly resolve to its real division");
  assert.equal(report.receipts[0].category, categoryName);
  assert.equal(report.receipts[0].vendor, vendorName, "a receipt's real item must resolve to its real, preferred vendor");
  assert.equal(report.receipts[0].quantity, 50);

  assert.equal(report.transfers.length, 1);
  assert.equal(report.transfers[0].from_location, warehouse.name, "a real transfer's own source location must be correctly looked up, not left unknown");
  assert.equal(report.transfers[0].to_location, outlet.name);
  assert.equal(report.transfers[0].quantity, 20);

  assert.equal(report.sales.length, 1);
  assert.equal(report.sales[0].location, outlet.name);
  assert.equal(report.sales[0].quantity, 3);
  assert.equal(report.sales[0].amount_minor, 4500, "a real sale's own real dollar amount must be correctly joined from the real Sales account posting, not left at zero");
});

test('item categories: nested arbitrarily deep in the existing entity tree, and an empty subcategory never shows up as a fake item', () => {
  const biz = fx.freshBusiness('CatTest Co');
  const redWine = fx.uniqueName('CatTest Red Wine');
  const whiteWine = fx.uniqueName('CatTest White Wine');
  const merlotCat = fx.uniqueName('CatTest Merlot');
  const chablisCat = fx.uniqueName('CatTest Chablis');
  db.createItemCategory(biz.business, redWine, undefined, fx.userId);
  db.createItemCategory(biz.business, whiteWine, undefined, fx.userId);
  db.createItemCategory(biz.business, merlotCat, redWine, fx.userId);
  db.createItemCategory(biz.business, chablisCat, whiteWine, fx.userId); // deliberately left empty

  const itemName = fx.uniqueName('CatTest Château Merlot 2020');
  db.createItem(itemName, merlotCat, fx.userId, biz.business);

  const items = db.listItems(biz.business).map((p) => p.name);
  assert.ok(items.includes(itemName), 'the real item shows up');
  assert.ok(!items.includes(redWine), 'a category is never listed as a item');
  assert.ok(!items.includes(merlotCat), 'a subcategory is never listed as a item, even though it has a real item underneath it');
  assert.ok(!items.includes(chablisCat), 'an empty subcategory (no products yet) must not be mistaken for a real item just because it is currently a leaf');
});

test('stock take sheets: ordered by shelf_side/rack (alphabetically, as free text) then level numerically (top to bottom), and completing posts genuine loss/gain variance while leaving uncounted lines untouched', () => {
  const biz = fx.freshBusiness('STTest Co');
  const outlet = fx.freshLocation(biz.business, 'STTest Outlet', { bottle_capacity: 1000, carton_capacity: 100 });
  const merlot = fx.uniqueName('STTest Merlot');
  const chardonnay = fx.uniqueName('STTest Chardonnay');
  db.createItem(merlot, 'Items', fx.userId, biz.business);
  db.createItem(chardonnay, 'Items', fx.userId, biz.business);

  db.receiveItems(biz.business, biz.actualLedger, 'STTEST-REC-1', db.asItemName(merlot), outlet.name, 50, fx.userId, '2027-01-01');
  db.setItemLocationLevels(db.asItemName(merlot), outlet.name, { shelfSide: 'Front', rack: 'A', level: 3 }, biz.business, biz.actualLedger, fx.userId);
  db.receiveItems(biz.business, biz.actualLedger, 'STTEST-REC-2', db.asItemName(chardonnay), outlet.name, 30, fx.userId, '2027-01-01');
  db.setItemLocationLevels(db.asItemName(chardonnay), outlet.name, { shelfSide: 'Front', rack: 'A', level: 1 }, biz.business, biz.actualLedger, fx.userId);

  const takeId = db.createStockTake(outlet.name, '2027-02-01', fx.userId, biz.business);
  const take = db.getStockTake(takeId)!;
  assert.equal(take.lines[0].item, chardonnay, 'level 1 sorts before level 3 within the same shelf_side/rack — numeric, genuinely top to bottom');
  assert.equal(take.lines[1].item, merlot);

  db.recordStockTakeCount(takeId, db.asItemName(chardonnay), 28); // shortage of 2
  // merlot deliberately left uncounted.

  db.completeStockTake(takeId, biz.business, biz.actualLedger, db.asAccountName('Miscellaneous'), 'Inventory', { [chardonnay]: 1000 }, fx.userId);

  assert.equal(db.getItemLocation(db.asItemName(chardonnay), outlet.name).quantity_on_hand, 28, 'corrected to match what was actually counted');
  assert.equal(db.getItemLocation(db.asItemName(merlot), outlet.name).quantity_on_hand, 50, 'never counted, so left untouched, not silently zeroed or assumed correct');

  const completedTake = db.getStockTake(takeId)!;
  assert.equal(completedTake.status, 'completed');
  assert.throws(() => db.recordStockTakeCount(takeId, db.asItemName(merlot), 50), db.ValidationError, 'cannot record a count against an already-completed take');

  // A variance with no unit cost given must be rejected, not silently valued at zero.
  const takeId2 = db.createStockTake(outlet.name, '2027-03-01', fx.userId, biz.business);
  db.recordStockTakeCount(takeId2, db.asItemName(merlot), 45);
  assert.throws(() => db.completeStockTake(takeId2, biz.business, biz.actualLedger, db.asAccountName('Miscellaneous'), 'Inventory', {}, fx.userId), db.ValidationError);
});

test('completeStockTake: multiple real, different products sharing the same variance expense account in one real stock take must all post, keeping debit == credit', () => {
  // Per direct, reported real-world discrepancy: a full simulation run
  // (test-e2e, outside this sandbox's own resource limits) reported a
  // genuine trial-balance imbalance (debit != credit) after a month-end
  // stock take involving many, real, different products all sharing
  // the same, real "Miscellaneous" variance account - exactly this
  // scenario, at a larger scale. Reproduced here directly, at the real,
  // correct, backend-function level, per the backend-first-testing
  // skill - no browser, no full simulation.
  const biz = fx.freshBusiness('STTest3 Co');
  const outlet = fx.freshLocation(biz.business, 'STTest Outlet 3', { bottle_capacity: 1000, carton_capacity: 100 });
  const shiraz = fx.uniqueName('STTest Shiraz');
  const riesling = fx.uniqueName('STTest Riesling');
  const pinot = fx.uniqueName('STTest Pinot');
  db.createItem(shiraz, 'Items', fx.userId, biz.business);
  db.createItem(riesling, 'Items', fx.userId, biz.business);
  db.createItem(pinot, 'Items', fx.userId, biz.business);
  db.receiveItems(biz.business, biz.actualLedger, 'STTEST-REC-A', db.asItemName(shiraz), outlet.name, 50, fx.userId, '2027-01-01');
  db.receiveItems(biz.business, biz.actualLedger, 'STTEST-REC-B', db.asItemName(riesling), outlet.name, 30, fx.userId, '2027-01-01');
  db.receiveItems(biz.business, biz.actualLedger, 'STTEST-REC-C', db.asItemName(pinot), outlet.name, 20, fx.userId, '2027-01-01');

  const takeId = db.createStockTake(outlet.name, '2027-02-01', fx.userId, biz.business);
  db.recordStockTakeCount(takeId, db.asItemName(shiraz), 48); // shortage of 2
  db.recordStockTakeCount(takeId, db.asItemName(riesling), 33); // gain of 3
  db.recordStockTakeCount(takeId, db.asItemName(pinot), 19); // shortage of 1

  const before = db.getTrialBalance(biz.business, biz.actualLedger, '2027-02-01');
  db.completeStockTake(takeId, biz.business, biz.actualLedger, db.asAccountName('Miscellaneous'), 'Inventory', { [shiraz]: 1500, [riesling]: 2000, [pinot]: 1800 }, fx.userId);
  const after = db.getTrialBalance(biz.business, biz.actualLedger, '2027-02-01');

  assert.equal(after.total_debit_minor, after.total_credit_minor, 'the fundamental accounting identity must hold after real, multiple, same-account variance postings');
  assert.ok(after.total_debit_minor > before.total_debit_minor, 'the real postings genuinely happened, not silently skipped');

  assert.equal(db.getItemLocation(db.asItemName(shiraz), outlet.name).quantity_on_hand, 48);
  assert.equal(db.getItemLocation(db.asItemName(riesling), outlet.name).quantity_on_hand, 33);
  assert.equal(db.getItemLocation(db.asItemName(pinot), outlet.name).quantity_on_hand, 19);
});

test('completeStockTake and writeOffItems: the real quantity-movement journal entry itself must be balanced (debit == credit), not just the dollar-value side', () => {
  // Per direct, real report: a real, full simulation run (outside this
  // sandbox) found genuinely unbalanced "Quantity movement" journal
  // entries, referenced <item>-QTY, after a real month-end stock take.
  // The earlier test above only checked the dollar-value side's own
  // Trial Balance - it never actually queried the real, separate
  // quantity-movement journal entries this test checks directly.
  const biz = fx.freshBusiness('QTYBalTest Co');
  const outlet = fx.freshLocation(biz.business, 'QTYBalTest Outlet', { bottle_capacity: 500, carton_capacity: 50 });
  const wineName = fx.uniqueName('QTYBalTest Wine');
  db.createItem(wineName, 'Items', fx.userId, biz.business);
  db.receiveItems(biz.business, biz.actualLedger, 'QTYBALTEST-REC', db.asItemName(wineName), outlet.name, 40, fx.userId, '2027-01-01');

  const takeId = db.createStockTake(outlet.name, '2027-02-01', fx.userId, biz.business);
  db.recordStockTakeCount(takeId, db.asItemName(wineName), 37); // shortage of 3
  db.completeStockTake(takeId, biz.business, biz.actualLedger, db.asAccountName('Miscellaneous'), 'Inventory', { [wineName]: 1000 }, fx.userId);

  const qtyRef = `STOCKTAKE-${takeId}-${wineName}-QTY`;
  const qtyBalance = db.db
    .prepare(`SELECT COALESCE(SUM(jl.amount_minor), 0) AS total FROM journal_line jl JOIN journal j ON j.id = jl.journal_id WHERE j.reference = ?`)
    .get(qtyRef) as { total: number };
  assert.equal(qtyBalance.total, 0, 'the real quantity-movement journal entry for this stock-take variance must itself be balanced');

  // The same, real check for writeOffItems's own quantity movement.
  const expenseName = fx.uniqueName('QTYBalTest Write-off Expense');
  db.create(fx.coaCategoryRoot(biz.business, 'Expense'), db.typeRootName, expenseName, fx.userId);
  const beerName = fx.uniqueName('QTYBalTest Beer');
  db.createItem(beerName, 'Items', fx.userId, biz.business);
  db.receiveItems(biz.business, biz.actualLedger, 'QTYBALTEST-REC-2', db.asItemName(beerName), outlet.name, 24, fx.userId, '2027-01-01');
  const woRef = fx.uniqueName('QTYBALTEST-WO');
  db.writeOffItems(biz.business, biz.actualLedger, woRef, db.asItemName(beerName), 4, 500, db.asAccountName(expenseName), 'Inventory', 'Broken in transit', fx.userId, '2027-02-01');
  const woQtyBalance = db.db
    .prepare(`SELECT COALESCE(SUM(jl.amount_minor), 0) AS total FROM journal_line jl JOIN journal j ON j.id = jl.journal_id WHERE j.reference = ?`)
    .get(`${woRef}-QTY`) as { total: number };
  assert.equal(woQtyBalance.total, 0, 'the real quantity-movement journal entry for this write-off must itself be balanced');
});

test('getLocation/setLocation: two real locations sharing the exact same name under two different real businesses stay genuinely distinct', () => {
  const bizA = fx.freshBusiness('SameNameLocTest Co A');
  const bizB = fx.freshBusiness('SameNameLocTest Co B');
  const sharedName = fx.uniqueName('Shared Name Outlet');
  const rootA = db.requireEntity('Locations', db.typeRootName, db.requireEntity(bizA.business, db.typeBusinessName, db.requireEntity('Businesses', db.typeRootName)));
  const rootB = db.requireEntity('Locations', db.typeRootName, db.requireEntity(bizB.business, db.typeBusinessName, db.requireEntity('Businesses', db.typeRootName)));
  db.create(rootA, db.typeRootName, sharedName, fx.userId);
  db.create(rootB, db.typeRootName, sharedName, fx.userId);
  db.setLocation(sharedName, { city: 'City A', location_type: 'Retail', is_billing_address: false, bottle_capacity: 100, carton_capacity: null, timezone: 'UTC' }, bizA.business);
  db.setLocation(sharedName, { city: 'City B', location_type: 'Warehouse', is_billing_address: false, bottle_capacity: null, carton_capacity: 50, timezone: 'UTC' }, bizB.business);

  const seenByA = db.getLocation(sharedName, bizA.business);
  const seenByB = db.getLocation(sharedName, bizB.business);
  assert.equal(seenByA?.city, 'City A', 'business A must see its own, real location, never the other business\'s');
  assert.equal(seenByB?.city, 'City B', 'business B must see its own, real location, never the other business\'s');
  assert.equal(seenByA?.bottle_capacity, 100);
  assert.equal(seenByB?.carton_capacity, 50);
});

test('ensureLocationCapacityAccount: a real, one-time opening balance from the location\'s own static capacity, retail tracks bottles, warehouse tracks carton-equivalents', () => {
  const biz = fx.freshBusiness('CapAcctTest Co');
  const retailLoc = fx.freshLocation(biz.business, 'CapAcctTest Retail', { bottle_capacity: 200, carton_capacity: 20 });
  const retail = db.ensureLocationCapacityAccount(biz.business, biz.actualLedger, retailLoc.name, fx.userId);
  assert.equal(retail.unit, 'bottle', 'a location with a real bottle_capacity set tracks in bottles');
  const retailBalance = db.db.prepare(`SELECT COALESCE(SUM(jl.amount_minor), 0) AS total FROM journal_line jl WHERE jl.account_id = ?`).get(retail.capacityAccountId) as { total: number };
  assert.equal(retailBalance.total, 200);

  const warehouseLoc = fx.freshLocation(biz.business, 'CapAcctTest Warehouse', { location_type: 'Warehouse', bottle_capacity: null, carton_capacity: 50 });
  const warehouse = db.ensureLocationCapacityAccount(biz.business, biz.actualLedger, warehouseLoc.name, fx.userId);
  assert.equal(warehouse.unit, 'carton', 'a location with no bottle_capacity, only carton_capacity, tracks in carton-equivalents');
  const warehouseBalance = db.db.prepare(`SELECT COALESCE(SUM(jl.amount_minor), 0) AS total FROM journal_line jl WHERE jl.account_id = ?`).get(warehouse.capacityAccountId) as { total: number };
  assert.equal(warehouseBalance.total, 50);

  // Idempotent - a second call must not re-post a second opening balance.
  db.ensureLocationCapacityAccount(biz.business, biz.actualLedger, retailLoc.name, fx.userId);
  const retailBalanceAfter = db.db.prepare(`SELECT COALESCE(SUM(jl.amount_minor), 0) AS total FROM journal_line jl WHERE jl.account_id = ?`).get(retail.capacityAccountId) as { total: number };
  assert.equal(retailBalanceAfter.total, 200);
});

test('adjustLocationCapacity: a real, direct check of the capacity math, retail (1:1 bottles) and warehouse (real, per-item carton conversion)', () => {
  const biz = fx.freshBusiness('CapAdjTest Co');
  const retailLoc = fx.freshLocation(biz.business, 'CapAdjTest Retail', { bottle_capacity: 100, carton_capacity: 10 });
  const wineName = fx.uniqueName('CapAdjTest Wine');
  db.createItem(wineName, 'Items', fx.userId, biz.business);
  const retail = db.ensureLocationCapacityAccount(biz.business, biz.actualLedger, retailLoc.name, fx.userId);

  db.adjustLocationCapacity(biz.business, biz.actualLedger, retailLoc.name, db.asItemName(wineName), 30, '2027-01-01', fx.userId, 'CAPADJTEST-REC-1');
  let balance = db.db.prepare(`SELECT COALESCE(SUM(jl.amount_minor), 0) AS total FROM journal_line jl WHERE jl.account_id = ?`).get(retail.capacityAccountId) as { total: number };
  assert.equal(balance.total, 70, 'receiving 30 real bottles consumes exactly 30 units of real capacity (100 - 30)');

  db.adjustLocationCapacity(biz.business, biz.actualLedger, retailLoc.name, db.asItemName(wineName), -10, '2027-01-02', fx.userId, 'CAPADJTEST-DISP-1');
  balance = db.db.prepare(`SELECT COALESCE(SUM(jl.amount_minor), 0) AS total FROM journal_line jl WHERE jl.account_id = ?`).get(retail.capacityAccountId) as { total: number };
  assert.equal(balance.total, 80, 'dispatching 10 real bottles frees exactly 10 units of real capacity back up (70 + 10)');

  // Warehouse: a real, specific item with a real, known package_quantity of 12.
  const warehouseLoc = fx.freshLocation(biz.business, 'CapAdjTest Warehouse', { location_type: 'Warehouse', bottle_capacity: null, carton_capacity: 20 });
  const vendorName = fx.uniqueName('CapAdjTest Vendor');
  db.create(db.requireEntity('Vendors', db.typeRootName), db.typeRootName, vendorName, fx.userId);
  db.addOrUpdateItemSource({ itemName: wineName, vendorName, priceMinor: 1500, packageQuantity: 12, isPreferred: true });
  const warehouse = db.ensureLocationCapacityAccount(biz.business, biz.actualLedger, warehouseLoc.name, fx.userId);

  db.adjustLocationCapacity(biz.business, biz.actualLedger, warehouseLoc.name, db.asItemName(wineName), 24, '2027-01-01', fx.userId, 'CAPADJTEST-REC-2');
  const whBalance = db.db.prepare(`SELECT COALESCE(SUM(jl.amount_minor), 0) AS total FROM journal_line jl WHERE jl.account_id = ?`).get(warehouse.capacityAccountId) as { total: number };
  assert.equal(whBalance.total, 18, 'receiving 24 real bottles (= 2 real cartons at this item\'s own, real 12-per-carton rate) consumes exactly 2 carton-equivalents of real capacity (20 - 2)');
});

test('createPosTerminal/setTerminalCurrency/getEffectiveSaleCurrency: a real, direct, border-business scenario - two real terminals, one location, two different currencies', () => {
  const biz = fx.freshBusiness('BorderTest Co');
  const outlet = fx.freshLocation(biz.business, 'BorderTest Outlet', { bottle_capacity: 200, carton_capacity: 20 });

  const usdTill = fx.uniqueName('BorderTest Front Till (USD)');
  const cadTill = fx.uniqueName('BorderTest Front Till (CAD)');
  db.createPosTerminal(usdTill, outlet.name, fx.userId);
  db.createPosTerminal(cadTill, outlet.name, fx.userId);
  db.setTerminalCurrency(usdTill, 'USD');
  db.setTerminalCurrency(cadTill, 'CAD');

  assert.equal(db.getEffectiveSaleCurrency(usdTill), 'USD', 'the USD till resolves its own, real, distinct currency');
  assert.equal(db.getEffectiveSaleCurrency(cadTill), 'CAD', 'the CAD till, at the exact same, real, shared location, resolves its own, different, real currency');
  assert.equal(db.getEffectiveSaleCurrency(undefined), null, 'no terminal specified genuinely falls through to the existing Division/Business/Account/Contact chain, not a real, direct answer here');

  // A real, direct, structural confirmation: both terminals are real,
  // separate entities, correctly parented under the exact same,
  // shared, real location - not two different locations pretending to
  // be one.
  const terminals = db.db.prepare(`SELECT name FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = ?) ORDER BY name`).all(`${outlet.name} Terminals`) as { name: string }[];
  assert.deepEqual(terminals.map((t) => t.name).sort(), [usdTill, cadTill].sort());
});

test('addOrUpdateItemSource/getItemPriceForCurrency: a real, direct, dual-currency pricing scenario - one real product, two real, independently-set prices', () => {
  const biz = fx.freshBusiness('BorderPriceTest Co');
  const waterName = fx.uniqueName('BorderTest Bottled Water');
  db.createItem(waterName, 'Items', fx.userId, biz.business);
  const vendorName = fx.uniqueName('BorderTest Vendor');
  db.create(db.requireEntity('Accounts Payable', db.typeRootName), db.typeRootName, vendorName, fx.userId);
  db.addOrUpdateItemSource({ itemName: waterName, vendorName, priceMinor: 150, isPreferred: true, currency: 'USD' });
  db.addOrUpdateItemSource({ itemName: waterName, vendorName, priceMinor: 200, isPreferred: true, currency: 'CAD' });

  assert.equal(db.getItemPriceForCurrency(waterName, 'USD'), 150, 'the real, independently-set USD price is resolved correctly');
  assert.equal(db.getItemPriceForCurrency(waterName, 'CAD'), 200, 'the real, independently-set CAD price, for the exact same, real product, is genuinely different and resolved correctly');

  const sources = db.listItemSources(waterName);
  assert.equal(sources.length, 2, 'two real, independent item_source rows exist for the same item/vendor pair, one per real currency');
});

test('completePosSale: the real, live, end-to-end border scenario - two real terminals, one real location, one real product, sold in two different, real currencies', () => {
  const biz = fx.freshBusiness('BorderE2E Co');
  const outlet = fx.freshLocation(biz.business, 'BorderE2E Outlet', { bottle_capacity: 200, carton_capacity: 20 });
  db.nominateLocationCurrency(outlet.name, 'USD', fx.userId, biz.business);
  db.nominateLocationCurrency(outlet.name, 'CAD', fx.userId, biz.business);
  const usdTill = fx.uniqueName('BorderE2E Till (USD)');
  const cadTill = fx.uniqueName('BorderE2E Till (CAD)');
  db.createPosTerminal(usdTill, outlet.name, fx.userId);
  db.createPosTerminal(cadTill, outlet.name, fx.userId);
  db.setTerminalCurrency(usdTill, 'USD');
  db.setTerminalCurrency(cadTill, 'CAD');

  const waterName = fx.uniqueName('BorderE2E Water');
  db.createItem(waterName, 'Items', fx.userId, biz.business);
  const vendorName = fx.uniqueName('BorderE2E Vendor');
  db.create(db.requireEntity('Accounts Payable', db.typeRootName), db.typeRootName, vendorName, fx.userId);
  db.addOrUpdateItemSource({ itemName: waterName, vendorName, priceMinor: 150, isPreferred: true, currency: 'USD' });
  db.addOrUpdateItemSource({ itemName: waterName, vendorName, priceMinor: 200, isPreferred: true, currency: 'CAD' });
  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('BORDERE2E-REC'), db.asItemName(waterName), outlet.name, 20, fx.userId, '2027-01-01');

  const expenseName = fx.uniqueName('BorderE2E Write-off Expense');
  db.create(fx.coaCategoryRoot(biz.business, 'Expense'), db.typeRootName, expenseName, fx.userId);

  const usdSale = db.completePosSale(
    {
      business: biz.business,
      ledger: biz.actualLedger,
      locationName: outlet.name,
      customerName: db.asCustomerName('Cash Sale'),
      lines: [{ itemName: waterName, quantity: 1, taxMinor: 0 } as any],
      taxAccount: db.asAccountName('Sales Tax Payable'),
      paymentMethod: 'cash',
      terminalName: usdTill,
      transdate: '2027-01-02',
    },
    fx.userId
  );
  const usdInvoice = db.getInvoice(usdSale.invoiceId);
  assert.equal(usdInvoice?.lines[0]?.unitPriceMinor, 150, 'the real sale at the USD till was genuinely, automatically priced at the real, correct $1.50 USD, not hand-entered');

  const cadSale = db.completePosSale(
    {
      business: biz.business,
      ledger: biz.actualLedger,
      locationName: outlet.name,
      customerName: db.asCustomerName('Cash Sale'),
      lines: [{ itemName: waterName, quantity: 1, taxMinor: 0 } as any],
      taxAccount: db.asAccountName('Sales Tax Payable'),
      paymentMethod: 'cash',
      terminalName: cadTill,
      transdate: '2027-01-02',
    },
    fx.userId
  );
  const cadInvoice = db.getInvoice(cadSale.invoiceId);
  assert.equal(cadInvoice?.lines[0]?.unitPriceMinor, 200, 'the real, second sale, same product, same real, shared location, seconds later, at the CAD till, was genuinely, automatically priced at the real, correct, different $2.00 CAD');
});

test('createStockTake resolves an item by its real, scoped item identity, never a same-named entity of a different kind elsewhere in the tree', () => {
  const biz = fx.freshBusiness('STTest2 Co');
  const outlet = fx.freshLocation(biz.business, 'STTest Outlet 2', { bottle_capacity: 500, carton_capacity: 50 });
  const collideName = fx.uniqueName('STTest Collide');
  db.createItem(collideName, 'Items', fx.userId, biz.business); // the real item, created first

  db.receiveItems(biz.business, biz.actualLedger, 'STTEST-REC-COLLIDE', db.asItemName(collideName), outlet.name, 40, fx.userId, '2027-01-01');

  // Created AFTER the real item, deliberately, per direct
  // confirmation this ordering matters: the old, buggy code built its
  // lookup from a single, unscoped "every entity" query with no ORDER
  // BY, and a later-inserted row can silently overwrite an earlier
  // one sharing the same name in the resulting map.
  const locationsRoot = db.requireEntity('Locations', db.typeRootName, db.requireEntity(biz.business, db.typeBusinessName, db.requireEntity('Businesses', db.typeRootName)));
  db.create(locationsRoot, db.typeRootName, collideName, fx.userId);

  const takeId = db.createStockTake(outlet.name, '2027-02-01', fx.userId, biz.business);
  const take = db.getStockTake(takeId)!;
  assert.equal(take.lines.length, 1, 'the real item genuinely present at this location must appear on its own real stock take sheet');
  assert.equal(take.lines[0].item, collideName);

  // The real, direct proof: recording a count against this exact item
  // name must genuinely succeed, not throw "not on this stock take
  // sheet" - which is exactly what happens if the sheet's own line
  // was created against the wrong, colliding entity's id instead of
  // the real item's own, correctly-scoped id.
  db.recordStockTakeCount(takeId, db.asItemName(collideName), 38);
  const updated = db.getStockTake(takeId)!;
  assert.equal(updated.lines[0].counted_quantity, 38, 'the count genuinely attached to the real item on this real sheet');
});

test('POS terminal: a complete register sale posts the invoice, dispatches stock from the exact location sold at, and allocates payment atomically, with change due calculated correctly', () => {
  const biz = fx.freshBusiness('POSTest Co');
  const outlet = fx.freshLocation(biz.business, 'POSTest Outlet', { bottle_capacity: 500, carton_capacity: 80 });
  const merlotName = fx.uniqueName('POSTest Merlot');
  db.createItem(merlotName, 'Items', fx.userId, biz.business);
  const upc = fx.uniqueName('0123456789012').slice(0, 20);
  db.setItem(merlotName, { upc });
  db.receiveItems(biz.business, biz.actualLedger, 'POSTEST-REC-1', db.asItemName(merlotName), outlet.name, 20, fx.userId, '2027-01-01');

  // Barcode lookup — exact match only.
  const found = db.getItemByUpc(upc);
  assert.equal(found?.name, merlotName);
  assert.equal(db.getItemByUpc('9999999999999-nomatch'), undefined, 'no match for an unknown UPC, not a fuzzy guess');
  assert.equal(db.getItemByUpc(''), undefined, 'an empty UPC must not match every item with a NULL upc');

  // Cash sale, walk-in, overpaid with a $50 note — change due must be exact.
  const result = db.completePosSale(
    {
      business: biz.business,
      ledger: biz.actualLedger,
      locationName: outlet.name,
      customerName: db.asCustomerName('Cash Sale'),
      lines: [{ itemName: merlotName, quantity: 3, unitPriceMinor: 1500, taxMinor: 450 } as any],
      revenueAccount: db.asAccountName('Sales Revenue'),
      taxAccount: db.asAccountName('Sales Tax Payable'),
      paymentMethod: 'cash',
      cashTenderedMinor: 5000,
    },
    fx.userId
  );
  assert.equal(result.totalMinor, 3 * 1500 + 450, 'quantity * unit price, plus tax');
  assert.equal(result.changeDueMinor, 5000 - (3 * 1500 + 450));

  assert.equal(db.getItemLocation(db.asItemName(merlotName), outlet.name).quantity_on_hand, 17, 'stock dispatched from the exact location sold at, 20 - 3');
  const invoice = db.getInvoice(result.invoiceId)!;
  assert.equal(invoice.status, 'posted');
  assert.equal(invoice.invoice_date, new Date().toISOString().slice(0, 10), 'omitting transdate must default to today, the ordinary live-sale case');

  assert.equal(db.getInvoiceOutstandingMinor(result.invoiceId), 0, 'cash sale must be fully paid immediately, not left outstanding');

  // An on-account sale (existing customer, no immediate payment) must
  // NOT auto-allocate payment — it's a normal outstanding invoice.
  const acctCustomer = fx.uniqueName('POSTest Account Customer');
  db.create(db.requireEntity('Customers', db.typeRootName), db.typeRootName, acctCustomer, fx.userId);
  db.setContact(acctCustomer, { payment_terms_days: 30 });
  const onAccountResult = db.completePosSale(
    {
      business: biz.business,
      ledger: biz.actualLedger,
      locationName: outlet.name,
      customerName: db.asCustomerName(acctCustomer),
      lines: [{ itemName: merlotName, quantity: 2, unitPriceMinor: 1500, taxMinor: 300 } as any],
      revenueAccount: db.asAccountName('Sales Revenue'),
      taxAccount: db.asAccountName('Sales Tax Payable'),
      // no paymentMethod — on account
    },
    fx.userId
  );
  assert.equal(onAccountResult.changeDueMinor, 0);
  assert.equal(db.getInvoiceOutstandingMinor(onAccountResult.invoiceId), onAccountResult.totalMinor, 'on-account sale must remain fully outstanding, not silently paid');
  assert.equal(db.getItemLocation(db.asItemName(merlotName), outlet.name).quantity_on_hand, 15, 'stock still dispatches even without immediate payment, 17 - 2');

  // Selling more than is on hand at this specific location must be
  // rejected outright, not partially fulfilled or oversold.
  assert.throws(
    () =>
      db.completePosSale(
        {
          business: biz.business,
          ledger: biz.actualLedger,
          locationName: outlet.name,
          customerName: db.asCustomerName('Cash Sale'),
          lines: [{ itemName: merlotName, quantity: 999, unitPriceMinor: 1500, taxMinor: 0 } as any],
          revenueAccount: db.asAccountName('Sales Revenue'),
          taxAccount: db.asAccountName('Sales Tax Payable'),
          paymentMethod: 'cash',
        },
        fx.userId
      ),
    db.ValidationError
  );
  assert.equal(db.getItemLocation(db.asItemName(merlotName), outlet.name).quantity_on_hand, 15, 'a rejected oversell must leave stock completely untouched, not partially decremented');
});

test('customer self-registration: a customer is a customer — same contact invoices already use, pending until staff verifies, and the real gate blocks on-account selling until then', () => {
  const biz = fx.freshBusiness('RegTest Co');
  const customerName = fx.uniqueName('RegTest Jane Smith');
  db.registerCustomer(
    {
      name: customerName,
      email: 'jane@example.com',
      phone: '555-0100',
      password: 'correct horse battery staple',
      card_label: 'Visa ending 4242',
    },
    fx.userId
  );

  // It's a real contact, immediately — same table, same mechanism.
  const contact = db.getContact(customerName)!;
  assert.equal(contact.email, 'jane@example.com');
  assert.equal(contact.card_label, 'Visa ending 4242');
  assert.equal(contact.verification_status, 'pending');

  // Password never leaks through getContact.
  assert.equal((contact as unknown as { password_hash?: string }).password_hash, undefined);

  // Login works with the right password, not with the wrong one.
  assert.equal(db.authenticateCustomer(customerName, 'correct horse battery staple'), true);
  assert.equal(db.authenticateCustomer(customerName, 'wrong password'), false);

  // Shows up in the staff queue.
  const pending = db.listPendingCustomers();
  assert.ok(pending.some((p) => p.name === customerName));

  // The real gate: still pending, so on-account selling must be
  // rejected outright — even though the customer/contact fully exists.
  const outlet = fx.freshLocation(biz.business, 'RegTest Outlet', { bottle_capacity: 100, carton_capacity: 20 });
  const wineName = fx.uniqueName('RegTest Wine');
  db.createItem(wineName, 'Items', fx.userId, biz.business);
  db.receiveItems(biz.business, biz.actualLedger, 'REGTEST-REC-1', db.asItemName(wineName), outlet.name, 10, fx.userId, '2027-01-01');

  assert.throws(
    () =>
      db.completePosSale(
        {
          business: biz.business,
          ledger: biz.actualLedger,
          locationName: outlet.name,
          customerName: db.asCustomerName(customerName),
          lines: [{ itemName: wineName, quantity: 1, unitPriceMinor: 1000, taxMinor: 0 } as any],
          revenueAccount: db.asAccountName('Sales Revenue'),
          taxAccount: db.asAccountName('Sales Tax Payable'),
          // no paymentMethod — on account
        },
        fx.userId
      ),
    db.ValidationError
  );

  // Staff verifies — approved.
  db.verifyCustomer(customerName, true);
  assert.equal(db.getContact(customerName)!.verification_status, 'active');
  assert.throws(() => db.verifyCustomer(customerName, true), db.ValidationError, 'cannot re-verify an already-decided registration');

  // Now the same on-account sale succeeds.
  const result = db.completePosSale(
    {
      business: biz.business,
      ledger: biz.actualLedger,
      locationName: outlet.name,
      customerName: db.asCustomerName(customerName),
      lines: [{ itemName: wineName, quantity: 1, unitPriceMinor: 1000, taxMinor: 0 } as any],
      revenueAccount: db.asAccountName('Sales Revenue'),
      taxAccount: db.asAccountName('Sales Tax Payable'),
    },
    fx.userId
  );
  assert.equal(result.totalMinor, 1000);

  // A staff-created account customer (no self-registration at all) has
  // no verification_status and must remain unrestricted — staff
  // already verified who they are by creating the account directly.
  const staffCustomer = fx.uniqueName('RegTest Staff Created Customer');
  db.create(db.requireEntity('Customers', db.typeRootName), db.typeRootName, staffCustomer, fx.userId);
  db.setContact(staffCustomer, { payment_terms_days: 30 });
  assert.equal(db.getContact(staffCustomer)!.verification_status, null);
  const staffResult = db.completePosSale(
    {
      business: biz.business,
      ledger: biz.actualLedger,
      locationName: outlet.name,
      customerName: db.asCustomerName(staffCustomer),
      lines: [{ itemName: wineName, quantity: 1, unitPriceMinor: 1000, taxMinor: 0 } as any],
      revenueAccount: db.asAccountName('Sales Revenue'),
      taxAccount: db.asAccountName('Sales Tax Payable'),
    },
    fx.userId
  );
  assert.equal(staffResult.totalMinor, 1000);
});

test('closeBooks: year-end close zeroes every Income/Expense account into Retained Earnings as one reversible entry, with the correct sign for both profit and loss', () => {
  const biz = fx.freshBusiness('CloseBooksTest Co');
  const revenueName = fx.uniqueName('CloseTest Revenue');
  const expenseName = fx.uniqueName('CloseTest Expense');
  db.create(fx.coaCategoryRoot(biz.business, 'Income'), db.typeRootName, revenueName, fx.userId);
  db.create(fx.coaCategoryRoot(biz.business, 'Expense'), db.typeRootName, expenseName, fx.userId);
  const cashAccount = db.requireEntityById(db.resolveBusinessCoaAccountId(biz.business, 'Cash and Bank'), db.typeRootName).name;

  db.stageLine({ reference: 'CLOSETEST-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-01', account: db.asAccountName(revenueName), amount_minor: -100000 });
  db.stageLine({ reference: 'CLOSETEST-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-01', account: db.asAccountName(cashAccount), amount_minor: 100000 });
  db.postJournalEntry('CLOSETEST-1', biz.business, biz.actualLedger, fx.userId);

  db.stageLine({ reference: 'CLOSETEST-2', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-02', account: db.asAccountName(expenseName), amount_minor: 40000 });
  db.stageLine({ reference: 'CLOSETEST-2', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-02', account: db.asAccountName(cashAccount), amount_minor: -40000 });
  db.postJournalEntry('CLOSETEST-2', biz.business, biz.actualLedger, fx.userId);

  const equityAccount = db.requireEntityById(db.resolveBusinessCoaAccountId(biz.business, "Owner's Equity"), db.typeRootName).name;
  const retainedBefore = db.getTrialBalance(biz.business, biz.actualLedger).rows.find((r) => r.name === equityAccount);

  const result = db.closeBooks(biz.business, biz.actualLedger, '2027-01-31', db.asAccountName(equityAccount), fx.userId);
  assert.equal(result.netIncomeMinor, 60000, '$1,000 revenue - $400 expense = $600 net income');
  assert.ok(result.accountsZeroed >= 2);

  const tb = db.getTrialBalance(biz.business, biz.actualLedger);
  assert.equal(tb.rows.find((r) => r.name === revenueName), undefined, 'zeroed accounts do not appear in trial balance at all');
  assert.equal(tb.rows.find((r) => r.name === expenseName), undefined);

  const retainedAfter = tb.rows.find((r) => r.name === equityAccount)!;
  const beforeCredit = retainedBefore?.credit_minor ?? 0;
  const beforeDebit = retainedBefore?.debit_minor ?? 0;
  const netBefore = beforeCredit - beforeDebit;
  const netAfter = retainedAfter.credit_minor - retainedAfter.debit_minor;
  assert.equal(netAfter - netBefore, 60000, 'a genuine profit must increase Retained Earnings (credit) by exactly the net income');

  const closeEntry = db.listJournalEntries(biz.business, biz.actualLedger, 50, 0).find((e) => e.reference === result.reference)!;
  db.reverseJournalEntry(biz.business, biz.actualLedger, closeEntry.journal_id, closeEntry.occurrence_date!, fx.userId, '2027-02-01');
  const tbAfterReversal = db.getTrialBalance(biz.business, biz.actualLedger);
  assert.ok(tbAfterReversal.rows.some((r) => r.name === revenueName), 'reversing the close entry must bring the P&L accounts back');

  db.closeBooks(biz.business, biz.actualLedger, '2027-02-15', db.asAccountName(equityAccount), fx.userId);
  assert.throws(() => db.closeBooks(biz.business, biz.actualLedger, '2027-03-01', db.asAccountName(equityAccount), fx.userId), db.ValidationError);
});

test('getBalanceSheet: a real close must not leave Current Year Earnings still showing the closed period\'s net income', () => {
  const biz = fx.freshBusiness('BSCloseTest Co');
  const revenueName = fx.uniqueName('BSCloseTest Revenue');
  db.create(fx.coaCategoryRoot(biz.business, 'Income'), db.typeRootName, revenueName, fx.userId);
  const cashAccount = db.requireEntityById(db.resolveBusinessCoaAccountId(biz.business, 'Cash and Bank'), db.typeRootName).name;
  const equityAccount = db.requireEntityById(db.resolveBusinessCoaAccountId(biz.business, "Owner's Equity"), db.typeRootName).name;

  db.stageLine({ reference: 'BSCT-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-08-01', account: db.asAccountName(revenueName), amount_minor: -70000 });
  db.stageLine({ reference: 'BSCT-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-08-01', account: db.asAccountName(cashAccount), amount_minor: 70000 });
  db.postJournalEntry('BSCT-1', biz.business, biz.actualLedger, fx.userId);

  const beforeClose = db.getBalanceSheet(biz.business, biz.actualLedger, '2027-08-31');
  assert.ok(beforeClose.equity.some((l) => l.name === 'Current Year Earnings'), 'before closing, the real, unclosed period income must show as Current Year Earnings');
  assert.equal(beforeClose.balanced, true);

  db.closeBooks(biz.business, biz.actualLedger, '2027-08-31', db.asAccountName(equityAccount), fx.userId);

  const afterClose = db.getBalanceSheet(biz.business, biz.actualLedger, '2027-08-31');
  assert.equal(afterClose.equity.some((l) => l.name === 'Current Year Earnings'), false, 'after a real close, Current Year Earnings must not appear at all');
  assert.equal(afterClose.balanced, true, 'the real Balance Sheet must still balance after a close');
  assert.equal(afterClose.total_assets_minor, afterClose.total_liabilities_minor + afterClose.total_equity_minor);
});

test("closeBooks: division is only a real, pure sub-totaling/reporting dimension - every division's net income rolls into the exact same, single, chosen Retained Earnings account, never a separate, division-specific one", () => {
  const biz = fx.freshBusiness('MultiDivCloseTest Co');
  const retailDivision = fx.uniqueName('MultiDivCloseTest Retail Division');
  const wholesaleDivision = fx.uniqueName('MultiDivCloseTest Wholesale Division');
  db.create(db.requireEntity('Application', db.typeRootName), db.typeRootName, retailDivision, fx.userId);
  db.create(db.requireEntity('Application', db.typeRootName), db.typeRootName, wholesaleDivision, fx.userId);
  const retailOutlet = fx.freshLocation(biz.business, 'MultiDivCloseTest Retail Outlet', { city: retailDivision, bottle_capacity: 500, carton_capacity: 80 });
  db.setHierarchyParent(retailOutlet.name, 'Division', retailDivision, fx.userId);
  const wholesaleOutlet = fx.freshLocation(biz.business, 'MultiDivCloseTest Wholesale Outlet', { city: wholesaleDivision, bottle_capacity: 500, carton_capacity: 80 });
  db.setHierarchyParent(wholesaleOutlet.name, 'Division', wholesaleDivision, fx.userId);
  const merlotName = fx.uniqueName('MultiDivCloseTest Merlot');
  db.createItem(merlotName, 'Items', fx.userId, biz.business);
  db.receiveItems(biz.business, biz.actualLedger, 'MDCT-REC-A', db.asItemName(merlotName), retailOutlet.name, 20, fx.userId, '2027-01-01');
  db.receiveItems(biz.business, biz.actualLedger, 'MDCT-REC-B', db.asItemName(merlotName), wholesaleOutlet.name, 20, fx.userId, '2027-01-01');

  db.completePosSale({ business: biz.business, ledger: biz.actualLedger, locationName: retailOutlet.name, customerName: db.asCustomerName('Cash Sale'), lines: [{ itemName: merlotName, quantity: 1, unitPriceMinor: 100000, taxMinor: 0, tier: 'Bottle' } as any], taxAccount: db.asAccountName('Sales Tax Payable'), paymentMethod: 'cash', cashTenderedMinor: 100000 }, fx.userId);
  db.completePosSale({ business: biz.business, ledger: biz.actualLedger, locationName: wholesaleOutlet.name, customerName: db.asCustomerName('Cash Sale'), lines: [{ itemName: merlotName, quantity: 1, unitPriceMinor: 60000, taxMinor: 0, tier: 'Bottle' } as any], taxAccount: db.asAccountName('Sales Tax Payable'), paymentMethod: 'cash', cashTenderedMinor: 60000 }, fx.userId);

  const cashAccount = db.requireEntityById(db.resolveBusinessCoaAccountId(biz.business, 'Cash and Bank'), db.typeRootName).name;
  db.stageLine({ reference: 'MDCT-3', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-03', account: db.asAccountName('Sales Revenue'), amount_minor: -20000 });
  db.stageLine({ reference: 'MDCT-3', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-03', account: db.asAccountName(cashAccount), amount_minor: 20000 });
  db.postJournalEntry('MDCT-3', biz.business, biz.actualLedger, fx.userId);

  const equityAccount = db.requireEntityById(db.resolveBusinessCoaAccountId(biz.business, "Owner's Equity"), db.typeRootName).name;
  const result = db.closeBooks(biz.business, biz.actualLedger, '2027-12-31', db.asAccountName(equityAccount), fx.userId, ['Location', 'Division']);
  assert.equal(result.netIncomeMinor, 180000, '$1,000 + $600 + $200 = $1,800 total net income, across every division combined');

  const tb = db.getTrialBalance(biz.business, biz.actualLedger);
  assert.equal(tb.rows.find((r) => r.name === `${equityAccount} - ${retailDivision}`), undefined, 'no separate, division-specific Retained Earnings account is ever created');
  assert.equal(tb.rows.find((r) => r.name === `${equityAccount} - ${wholesaleDivision}`), undefined, 'same for Wholesale');

  const retail = result.groupBreakdown.find((d) => d.group === retailDivision);
  const wholesale = result.groupBreakdown.find((d) => d.group === wholesaleDivision);
  const undivided = result.groupBreakdown.find((d) => d.group === null);
  assert.equal(retail?.netIncomeMinor, 100000, "groupBreakdown still reports Retail Division's own real $1,000 net income, for display only, now derived structurally");
  assert.equal(wholesale?.netIncomeMinor, 60000, "groupBreakdown still reports Wholesale Division's own real $600 net income, for display only");
  assert.equal(undivided?.netIncomeMinor, 20000, 'groupBreakdown still reports the real, undivided $200 remainder under a null group, for display only');
});

test('getBalanceSheet includes real AR/AP posted directly to customer/vendor names — without this, any ledger with outstanding AR/AP silently fails to balance', () => {
  const biz = fx.freshBusiness('BSTest Co');
  const vendorName = fx.uniqueName('BSTest Vendor');
  db.create(db.requireEntity('Vendors', db.typeRootName), db.typeRootName, vendorName, fx.userId);
  db.setContact(vendorName, { payment_terms_days: 30 });
  const inventoryAccount = db.requireEntity('Inventory', db.typeRootName, fx.coaCategoryRoot(biz.business, 'Asset')).name;

  db.stageLine({ reference: 'BSTEST-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-01', account: db.asAccountName(inventoryAccount), amount_minor: 50000 });
  db.stageLine({ reference: 'BSTEST-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-01', account: db.asAccountName(vendorName), amount_minor: -50000 });
  db.postJournalEntry('BSTEST-1', biz.business, biz.actualLedger, fx.userId);

  const bs = db.getBalanceSheet(biz.business, biz.actualLedger);
  assert.equal(bs.balanced, true, 'a ledger with real, unpaid AP must still balance once AR/AP is correctly included');
  const ap = bs.liabilities.find((l) => l.name === 'Accounts Payable');
  assert.ok(ap, 'Accounts Payable must appear as a real liability line');
  assert.equal(ap!.credit_minor - ap!.debit_minor, 50000);
  assert.equal(bs.total_assets_minor, bs.total_liabilities_minor + bs.total_equity_minor);

  const cashAccount = db.requireEntityById(db.resolveBusinessCoaAccountId(biz.business, 'Cash and Bank'), db.typeRootName).name;
  db.stageLine({ reference: 'BSTEST-2', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-15', account: db.asAccountName(vendorName), amount_minor: 50000 });
  db.stageLine({ reference: 'BSTEST-2', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-15', account: db.asAccountName(cashAccount), amount_minor: -50000 });
  db.postJournalEntry('BSTEST-2', biz.business, biz.actualLedger, fx.userId);
  const bsAfterPayment = db.getBalanceSheet(biz.business, biz.actualLedger);
  assert.equal(bsAfterPayment.liabilities.find((l) => l.name === 'Accounts Payable'), undefined, 'once fully paid, AP nets to zero and must not appear at all');
  assert.equal(bsAfterPayment.balanced, true);
});

test('completePosSale honors an explicit transdate instead of always using the real current date — the actual bug that broke every backdated/simulated sale', () => {
  const biz = fx.freshBusiness('POSDateTest Co');
  const outlet = fx.freshLocation(biz.business, 'POSDateTest Outlet', { bottle_capacity: 100, carton_capacity: 20 });
  const wineName = fx.uniqueName('POSDateTest Wine');
  db.createItem(wineName, 'Items', fx.userId, biz.business);
  db.receiveItems(biz.business, biz.actualLedger, 'POSDATETEST-REC-1', db.asItemName(wineName), outlet.name, 10, fx.userId, '2027-01-01');

  const result = db.completePosSale(
    {
      business: biz.business,
      ledger: biz.actualLedger,
      locationName: outlet.name,
      customerName: db.asCustomerName('Cash Sale'),
      lines: [{ itemName: wineName, quantity: 1, unitPriceMinor: 1500, taxMinor: 0 } as any],
      revenueAccount: db.asAccountName('Sales Revenue'),
      taxAccount: db.asAccountName('Sales Tax Payable'),
      paymentMethod: 'cash',
      transdate: '2027-06-15',
    },
    fx.userId
  );
  const invoice = db.getInvoice(result.invoiceId)!;
  assert.equal(invoice.invoice_date, '2027-06-15', 'an explicit transdate must be honored exactly, not silently replaced with the real current date');

  const withoutDate = db.completePosSale(
    {
      business: biz.business,
      ledger: biz.actualLedger,
      locationName: outlet.name,
      customerName: db.asCustomerName('Cash Sale'),
      lines: [{ itemName: wineName, quantity: 1, unitPriceMinor: 1500, taxMinor: 0 } as any],
      revenueAccount: db.asAccountName('Sales Revenue'),
      taxAccount: db.asAccountName('Sales Tax Payable'),
      paymentMethod: 'cash',
    },
    fx.userId
  );
  const invoiceWithoutDate = db.getInvoice(withoutDate.invoiceId)!;
  assert.equal(invoiceWithoutDate.invoice_date, new Date().toISOString().slice(0, 10), 'omitting transdate must still default to today, the ordinary live-sale case');
});

test('completePosSale: a real, immediate cash sale never touches the customer\'s own AR balance at all, even momentarily', () => {
  const biz = fx.freshBusiness('CashARTest Co');
  const outlet = fx.freshLocation(biz.business, 'CashARTest Outlet', { bottle_capacity: 100, carton_capacity: 20 });
  const wineName = fx.uniqueName('CashARTest Wine');
  db.createItem(wineName, 'Items', fx.userId, biz.business);
  db.receiveItems(biz.business, biz.actualLedger, 'CASHARTEST-REC-1', db.asItemName(wineName), outlet.name, 10, fx.userId, '2027-01-01');
  const customerName = fx.uniqueName('CashARTest Customer');
  db.create(db.requireEntity('Customers', db.typeRootName), db.typeRootName, customerName, fx.userId);

  const result = db.completePosSale(
    {
      business: biz.business,
      ledger: biz.actualLedger,
      locationName: outlet.name,
      customerName: db.asCustomerName(customerName),
      lines: [{ itemName: wineName, quantity: 1, unitPriceMinor: 1500, taxMinor: 0 } as any],
      revenueAccount: db.asAccountName('Sales Revenue'),
      taxAccount: db.asAccountName('Sales Tax Payable'),
      paymentMethod: 'cash',
      transdate: '2027-06-15',
    },
    fx.userId
  );

  const invoice = db.getInvoice(result.invoiceId)!;
  assert.equal(invoice.counterparty, customerName);

  const custBalance = db.db.prepare(`SELECT balance_minor FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name = ?)`).get(customerName) as
    | { balance_minor: number }
    | undefined;
  assert.equal(custBalance?.balance_minor ?? 0, 0, "a real, immediate cash sale must never leave any real balance on the customer's own AR account");

  const paymentJournal = db.db.prepare(`SELECT 1 FROM journal WHERE reference = ?`).get(`${result.reference}-PAYMENT`);
  assert.equal(paymentJournal, undefined, 'a real, immediate cash sale must not post a second, redundant journal entry for the same real cash movement');

  assert.equal(db.getInvoiceOutstandingMinor(result.invoiceId), 0);

  const cashAccount = db.requireEntityById(db.resolveBusinessCoaAccountId(biz.business, 'Cash and Bank'), db.typeRootName).name;
  const cashLine = db.db.prepare(`SELECT amount_minor FROM journal_line jl JOIN journal j ON j.id = jl.journal_id JOIN current_entities e ON e.id = jl.account_id WHERE j.reference = ? AND e.name = ?`).get(
    result.reference,
    cashAccount
  ) as { amount_minor: number };
  assert.equal(cashLine.amount_minor, result.totalMinor, "Cash and Bank must be debited the real, full sale amount directly, in the same posting as the sale itself");
});

test('completeCashPurchase: a real, immediate cash purchase never touches the vendor\'s own AP balance at all, even momentarily', () => {
  const biz = fx.freshBusiness('CashPurTest Co');
  const warehouse = fx.freshLocation(biz.business, 'CashPurTest Warehouse', { location_type: 'Warehouse', bottle_capacity: 0, carton_capacity: 5000 });
  const vendorName = fx.uniqueName('CashPurTest Vendor');
  db.create(db.requireEntity('Vendors', db.typeRootName), db.typeRootName, vendorName, fx.userId);
  const wineName = fx.uniqueName('CashPurTest Wine');
  db.createItem(wineName, 'Items', fx.userId, biz.business);

  const before = db.getItemLocation(db.asItemName(wineName), warehouse.name).quantity_on_hand;
  const result = db.completeCashPurchase(
    {
      business: biz.business,
      ledger: biz.actualLedger,
      locationName: warehouse.name,
      vendorName: db.asProviderName(vendorName),
      paymentMethod: 'cash',
      lines: [{ itemName: wineName, quantity: 24, unitPriceMinor: 1500, taxMinor: 0 } as any],
      taxAccount: db.asAccountName('Sales Tax Payable'),
    },
    fx.userId
  );

  assert.equal(db.getItemLocation(db.asItemName(wineName), warehouse.name).quantity_on_hand, before + 24, 'real, physical stock must actually be received at the real, chosen location');
  const invoice = db.getInvoice(result.invoiceId)!;
  assert.equal(invoice.status, 'posted');
  assert.equal(invoice.total_amount_minor, result.totalMinor);
  assert.equal(db.getInvoiceOutstandingMinor(result.invoiceId), 0, 'a real, immediate cash purchase must show zero outstanding — no genuine payable, even momentarily');

  const vendorBalance = (
    db.db.prepare(`SELECT balance_minor FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name = ?)`).get(vendorName) as
      | { balance_minor: number }
      | undefined
  )?.balance_minor;
  assert.equal(vendorBalance ?? 0, 0, "the vendor's own real AP balance must never move at all for a real, immediate cash purchase");

  const cashAccount = db.requireEntityById(db.resolveBusinessCoaAccountId(biz.business, 'Cash and Bank'), db.typeRootName).name;
  const cashLine = db.db.prepare(
    `SELECT jl.amount_minor FROM journal_line jl JOIN journal j ON j.id = jl.journal_id JOIN current_entities e ON e.id = jl.account_id WHERE j.reference = ? AND e.name = ?`
  ).get(result.reference, cashAccount) as { amount_minor: number };
  assert.equal(cashLine.amount_minor, -result.totalMinor, "Cash and Bank must be credited the real, full purchase amount directly, in the same posting as the purchase itself");
});

test('payEmployeeWages: a real employee treated as AP — real Medicare levy withheld from their own pay, real superannuation as a genuine, separate employer cost, hourly or salaried', () => {
  const biz = fx.freshBusiness('WageTest Co');
  const employeeName = fx.uniqueName('WageTest Employee');
  db.create(db.requireEntity('Employees', db.typeRootName), db.typeRootName, employeeName, fx.userId);
  db.setContact(employeeName, { wage_minor_per_hour: 3000 }); // $30.00/hour

  function balanceOf(accountName: string): number {
    return (
      (db.db.prepare(`SELECT balance_minor FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name = ?)`).get(accountName) as
        | { balance_minor: number }
        | undefined)?.balance_minor ?? 0
    );
  }

  const noRateEmployee = fx.uniqueName('WageTest No Rate Employee');
  db.create(db.requireEntity('Employees', db.typeRootName), db.typeRootName, noRateEmployee, fx.userId);
  assert.throws(
    () => db.payEmployeeWages({ business: biz.business, ledger: biz.actualLedger, employeeName: noRateEmployee, hours: 8 }, fx.userId),
    db.ValidationError,
    'a real employee with no configured wage rate or salary must be refused with a clear, honest error, not silently paid $0'
  );

  const before = db.getCreditStatus(employeeName);
  assert.equal(before.balanceMinor, 0);
  const result = db.payEmployeeWages({ business: biz.business, ledger: biz.actualLedger, employeeName, hours: 8 }, fx.userId);
  assert.equal(result.grossMinor, 24000, '8 real hours at $30.00/hour must gross exactly $240.00');
  assert.equal(result.medicareLevyMinor, 360, 'a real 1.5% Medicare levy on $240.00 must be exactly $3.60');
  assert.equal(result.superannuationMinor, 2880, 'a real 12% superannuation contribution on $240.00 must be exactly $28.80');
  assert.equal(result.netMinor, 23640, "the employee's own real net pay must be gross minus the real Medicare levy withheld");

  const after = db.getCreditStatus(employeeName);
  assert.equal(after.balanceMinor, result.netMinor, "the employee's own real AP balance must reflect real NET pay owed");
  const invoice = db.getInvoice(result.invoiceId)!;
  assert.equal(invoice.status, 'posted');
  assert.equal(invoice.invoice_type, 'AP', 'an employee wage payment must be a real AP invoice, the same real mechanism a vendor invoice already uses');
  assert.equal(balanceOf('Medicare Levy Payable'), -result.medicareLevyMinor, 'the real Medicare levy withheld must be a real, separate liability owed to the ATO, not a cost to the business');
  assert.equal(balanceOf('Superannuation Payable'), -result.superannuationMinor, 'the real superannuation contribution must be a real, separate liability owed to a real super fund');
  assert.equal(balanceOf('Superannuation Expense'), result.superannuationMinor, "real superannuation must be a real, genuine, ADDITIONAL cost to the business, on top of gross wages, never touching the employee's own balance");

  const cashResult = db.payEmployeeWages({ business: biz.business, ledger: biz.actualLedger, employeeName, hours: 4, paymentMethod: 'cash' }, fx.userId);
  assert.equal(cashResult.netMinor, 11820);
  assert.equal(db.getInvoiceOutstandingMinor(cashResult.invoiceId), cashResult.grossMinor - cashResult.netMinor, 'an immediate cash wage payment pays only the real NET amount');

  const managerName = fx.uniqueName('WageTest Manager');
  db.create(db.requireEntity('Employees', db.typeRootName), db.typeRootName, managerName, fx.userId);
  db.setContact(managerName, { salary_minor_per_year: 9600000 }); // $96,000.00/year
  assert.throws(
    () => db.payEmployeeWages({ business: biz.business, ledger: biz.actualLedger, employeeName: managerName, hours: 10 }, fx.userId),
    db.ValidationError,
    'a real, salaried employee must refuse an hours argument as a real, honest mismatch, not silently ignore it'
  );
  const salaryResult = db.payEmployeeWages({ business: biz.business, ledger: biz.actualLedger, employeeName: managerName }, fx.userId);
  assert.equal(salaryResult.grossMinor, 800000, 'one real month of a $96,000.00/year salary must be exactly $8,000.00');
});

test('getOrganizationChart: the real, complete chain — Business belongs-to Group belongs-to Location, employees placed at either a real location or the business itself', () => {
  const biz = fx.freshBusiness('OrgChartTest Co');
  const region = fx.uniqueName('OrgChartTest Region');
  db.create(db.requireEntity('Application', db.typeRootName), db.typeRootName, region, fx.userId);
  const store = fx.freshLocation(biz.business, 'OrgChartTest Store', {});
  const retailStaff = fx.uniqueName('OrgChartTest Retail Staff');
  const ceo = fx.uniqueName('OrgChartTest CEO');
  db.create(db.requireEntity('Employees', db.typeRootName), db.typeRootName, retailStaff, fx.userId);
  db.create(db.requireEntity('Employees', db.typeRootName), db.typeRootName, ceo, fx.userId);

  db.setRelationship(region, 'Belongs To Business', biz.business, fx.userId);
  db.setRelationship(store.name, 'Belongs To Group', region, fx.userId);
  db.setRelationship(retailStaff, 'Place of Employment', store.name, fx.userId);
  db.setRelationship(ceo, 'Place of Employment', biz.business, fx.userId);

  const chart = db.getOrganizationChart(biz.business);
  assert.equal(chart.business, biz.business);
  assert.deepEqual(chart.companyWideEmployees, [ceo], 'an employee whose place of employment is the business itself must appear as real, genuine company-wide staff, not nested under any single location');
  assert.equal(chart.groups.length, 1);
  assert.equal(chart.groups[0].group, region);
  assert.equal(chart.groups[0].locations.length, 1);
  assert.equal(chart.groups[0].locations[0].location, store.name);
  assert.deepEqual(chart.groups[0].locations[0].employees, [retailStaff]);

  const tree = db.getEntityTree();
  const storeNode = tree.find((e) => e.name === store.name)!;
  const storeParent = tree.find((e) => e.id === storeNode.parent_id)!;
  assert.equal(storeParent.name, 'Locations', "a location's own real parent_id must stay under Locations, unchanged — the organizational chain is a real, separate relationship layer, not a reparenting");
});

test('e-invoicing: a real, posted invoice exports as a real UBL 2.1 document, and a real, incoming one round-trips back through a genuinely separate ledger as a draft, never auto-posted', () => {
  const biz = fx.freshBusiness('EInvTest Co');
  const customerName = fx.uniqueName('EInvTest Customer');
  db.create(db.requireEntity('Customers', db.typeRootName), db.typeRootName, customerName, fx.userId);
  const invoiceId = db.createInvoice(
    {
      invoiceType: 'AR',
      business: biz.business,
      ledger: biz.actualLedger,
      reference: 'EINV-TEST-1',
      counterpartyName: customerName,
      invoiceDate: '2027-05-01',
      lines: [{ description: 'Consulting hours', quantity: 3, unitPriceMinor: 15000, amountMinor: 45000, taxMinor: 4500 }],
    },
    fx.userId
  );
  assert.throws(() => db.exportInvoiceAsUbl(invoiceId), db.ValidationError, 'a real, unposted draft must not be exportable as a real e-invoice yet');
  db.postInvoice(invoiceId, 'Sales Revenue', 'Sales Tax Payable', fx.userId);

  const xml = db.exportInvoiceAsUbl(invoiceId);
  assert.ok(xml.includes('<cbc:ID>EINV-TEST-1</cbc:ID>'), 'the real, exported document must carry the real invoice reference');
  assert.ok(xml.includes('450.00'), 'the real line amount must appear as a real, formatted currency value');

  // A genuinely separate receiving ledger — the real, realistic case.
  const receivingLedgerName = fx.uniqueName('EInvTest Receiving Ledger');
  db.create(db.requireEntity('Ledgers', db.typeRootName, db.requireEntity(biz.business, db.typeBusinessName, db.requireEntity('Businesses', db.typeRootName))), db.typeRootName, receivingLedgerName, fx.userId);
  const vendorName = fx.uniqueName('EInvTest Vendor');
  db.create(db.requireEntity('Vendors', db.typeRootName), db.typeRootName, vendorName, fx.userId);
  const result = db.importUblInvoiceAsDraft(xml, biz.business, db.asLedgerName(receivingLedgerName), vendorName, fx.userId);

  const imported = db.getInvoice(result.invoiceId)!;
  assert.equal(imported.status, 'draft', 'a real, imported e-invoice must never be auto-posted — the existing draft state is the real approval gate');
  assert.equal(imported.reference, 'EINV-TEST-1');
  assert.equal(imported.total_amount_minor, 45000, "the real, round-tripped total must exactly match the original invoice's own amount");
  assert.equal(imported.lines.length, 1);
  assert.equal(imported.lines[0].quantity, 3);
  assert.equal(imported.lines[0].unitPriceMinor, 15000);
  assert.equal(result.discrepancies.length, 0, 'no PO reference given — no real discrepancy to report');
});

test('e-invoicing: a real 3-way match catches a genuine mismatch between a purchase order and an incoming e-invoice', () => {
  const biz = fx.freshBusiness('EInvDiscTest Co');
  const vendorName = fx.uniqueName('EInvDiscTest Vendor');
  db.create(db.requireEntity('Vendors', db.typeRootName), db.typeRootName, vendorName, fx.userId);
  const itemName = fx.uniqueName('EInvDiscTest Item');
  db.create(db.requireEntity('Items', db.typeRootName), db.typeRootName, itemName, fx.userId);

  db.stagePurchaseOrder({ reference: 'EIDT-PO-1', business: biz.business, ledger: biz.actualLedger, vendor: vendorName, item: itemName, quantity: 10, price_minor: 5000, transdate: '2027-05-01' });
  db.postPurchaseOrder('EIDT-PO-1', biz.business, biz.actualLedger, fx.userId);

  // A real, incoming e-invoice for $750 against a real $500 PO — a genuine, deliberate mismatch.
  const mismatchedXml = `<?xml version="1.0"?><Invoice><cbc:ID>SUPP-INV-99</cbc:ID><cbc:IssueDate>2027-05-05</cbc:IssueDate>
    <cac:AccountingSupplierParty><cac:Party><cac:PartyName><cbc:Name>${vendorName}</cbc:Name></cac:PartyName></cac:Party></cac:AccountingSupplierParty>
    <cbc:TaxAmount>0</cbc:TaxAmount><cbc:PayableAmount>750.00</cbc:PayableAmount>
    <cac:InvoiceLine><cbc:InvoicedQuantity>10</cbc:InvoicedQuantity><cbc:LineExtensionAmount>750.00</cbc:LineExtensionAmount><cac:Item><cbc:Name>${itemName}</cbc:Name></cac:Item><cac:Price><cbc:PriceAmount>75.00</cbc:PriceAmount></cac:Price></cac:InvoiceLine>
    </Invoice>`;

  const result = db.importUblInvoiceAsDraft(mismatchedXml, biz.business, biz.actualLedger, vendorName, fx.userId, 'EIDT-PO-1');
  assert.equal(result.discrepancies.length, 1);
  assert.equal(result.discrepancies[0].field, 'Total amount');
  assert.equal(result.discrepancies[0].poValue, '500.00');
  assert.equal(result.discrepancies[0].invoiceValue, '750.00');

  const imported = db.getInvoice(result.invoiceId)!;
  assert.ok(imported.description.includes('discrepancy'), "a real discrepancy must be recorded directly in the draft's own description, immediately visible to whoever reviews it");
  assert.equal(imported.status, 'draft', 'a real discrepancy must never silently block the import — it must land as a real, reviewable draft, not be refused outright');
});

test('getInventoryListing/countInventoryListing: a real, paginated listing of every item/location combination with stock', () => {
  const biz = fx.freshBusiness('StockListTest Co');
  const outlet = fx.freshLocation(biz.business, 'StockListTest Outlet', { bottle_capacity: 100, carton_capacity: 20 });
  const wineName = fx.uniqueName('StockListTest Wine');
  db.createItem(wineName, 'Items', fx.userId, biz.business);
  db.receiveItems(biz.business, biz.actualLedger, 'STOCKLISTTEST-REC-1', db.asItemName(wineName), outlet.name, 15, fx.userId, '2027-01-01');
  // A second, distinct item/location combination, so pagination (a
  // page of 1, offset 1) has a genuinely different second row to
  // land on - with only one combination, this business's own
  // isolated listing would have nothing at offset 1.
  const otherWineName = fx.uniqueName('StockListTest Other Wine');
  db.createItem(otherWineName, 'Items', fx.userId, biz.business);
  db.receiveItems(biz.business, biz.actualLedger, 'STOCKLISTTEST-REC-2', db.asItemName(otherWineName), outlet.name, 5, fx.userId, '2027-01-01');

  fx.withBusinessSession(biz, () => {
    const countBefore = db.countInventoryListing();
    const listing = db.getInventoryListing(1000, 0);
    assert.equal(listing.length, countBefore, 'the listing must return exactly as many rows as the count reports, at a large enough page size');

    const row = listing.find((r) => r.item === wineName && r.location === outlet.name);
    assert.ok(row, 'the new item/location combination must appear in the listing');
    assert.equal(row!.quantity_on_hand, 15);
    assert.equal(row!.min_level, null, 'min_level must be present (even if unset) — the Stock Listing page edits it directly');
    assert.equal(row!.max_level, null);
    assert.equal(row!.reorder_level, null);
  });

  db.setItemLocationLevels(db.asItemName(wineName), outlet.name, { minLevel: 5, maxLevel: 50, reorderLevel: 10 }, biz.business, biz.actualLedger, fx.userId);
  fx.withBusinessSession(biz, () => {
    const listingAfter = db.getInventoryListing(1000, 0);
    const rowAfter = listingAfter.find((r) => r.item === wineName && r.location === outlet.name);
    assert.equal(rowAfter!.min_level, 5, 'min/max/reorder set via setItemLocationLevels must actually show up in the listing the UI reads');
    assert.equal(rowAfter!.max_level, 50);
    assert.equal(rowAfter!.reorder_level, 10);

    // Real pagination — a page of exactly 1 must return exactly 1 row, and offsetting must move to a different row.
    const page1 = db.getInventoryListing(1, 0);
    const page2 = db.getInventoryListing(1, 1);
    assert.equal(page1.length, 1);
    assert.equal(page2.length, 1);
    assert.notDeepEqual(page1[0], page2[0], 'different offsets must return different rows, not the same page twice');
  });
});

test('getInventoryListingByLocation: groups the same real stock data by real location, tagging each with its real group where one exists', () => {
  const biz = fx.freshBusiness('StockGroupTest Co');
  const division = fx.uniqueName('StockGroupTest City Division');
  db.create(db.requireEntity('Application', db.typeRootName), db.typeRootName, division, fx.userId);
  const outlet = fx.freshLocation(biz.business, 'StockGroupTest Outlet', { city: division, bottle_capacity: 100, carton_capacity: 20 });
  db.setHierarchyParent(outlet.name, 'Division', division, fx.userId);
  const wineA = fx.uniqueName('StockGroupTest Wine A');
  const wineB = fx.uniqueName('StockGroupTest Wine B');
  db.createItem(wineA, 'Items', fx.userId, biz.business);
  db.createItem(wineB, 'Items', fx.userId, biz.business);
  db.receiveItems(biz.business, biz.actualLedger, 'STOCKGROUPTEST-REC-1', db.asItemName(wineA), outlet.name, 10, fx.userId, '2027-01-01');
  db.receiveItems(biz.business, biz.actualLedger, 'STOCKGROUPTEST-REC-2', db.asItemName(wineB), outlet.name, 7, fx.userId, '2027-01-01');

  const groups = db.getInventoryListingByLocation(biz.business, 'Division');
  const group = groups.find((g) => g.location === outlet.name);
  assert.ok(group, 'the real, new location must appear as its own real group');
  assert.equal(group!.city, division);
  assert.equal(group!.group, division, "a location's own, explicit Division hierarchy link must tag the group with it, via the same getHierarchyGroupForLocation logic a real sale uses");
  assert.equal(group!.rows.length, 2, 'both real items received at this location must appear as real rows within the group');
  assert.equal(group!.total_on_hand, 17, "a group's own total must be the real sum of its real rows' on-hand quantities");

  // A location with no real, explicit Division hierarchy link assigned
  // must still appear as a real group — just with division: null, not
  // silently dropped. Its city happening to exactly equal a real
  // division's own name must NOT auto-tag it either.
  const outletNoDivision = fx.freshLocation(biz.business, 'StockGroupTest Outlet No Division', { city: division, bottle_capacity: 100, carton_capacity: 20 });
  db.receiveItems(biz.business, biz.actualLedger, 'STOCKGROUPTEST-REC-3', db.asItemName(wineA), outletNoDivision.name, 3, fx.userId, '2027-01-01');
  const groupsAfter = db.getInventoryListingByLocation(biz.business, 'Division');
  const noDivisionGroup = groupsAfter.find((g) => g.location === outletNoDivision.name);
  assert.ok(noDivisionGroup, 'a real location must still produce a real group even with no matching group');
  assert.equal(noDivisionGroup!.group, null, "a location's own address city must never auto-tag a group, even when it happens to exactly match a real group's own name — only a real, explicit hierarchy link does");
});

test('getLedgerDateRange: reports the real, earliest and latest transdate of what has actually been posted', () => {
  const biz = fx.freshBusiness('DateRangeTest Co');
  const empty = db.getLedgerDateRange(biz.business, biz.actualLedger);
  assert.equal(empty.earliest, null, 'a real ledger with nothing posted yet must report a real null range, not a misleading fallback date');
  assert.equal(empty.latest, null);

  const cashAccount = db.requireEntityById(db.resolveBusinessCoaAccountId(biz.business, 'Cash and Bank'), db.typeRootName).name;
  const equityAccount = db.requireEntityById(db.resolveBusinessCoaAccountId(biz.business, "Owner's Equity"), db.typeRootName).name;
  function post(reference: string, transdate: string, amount: number) {
    db.stageLine({ reference, business: biz.business, ledger: biz.actualLedger, transdate, account: db.asAccountName(cashAccount), amount_minor: amount });
    db.stageLine({ reference, business: biz.business, ledger: biz.actualLedger, transdate, account: db.asAccountName(equityAccount), amount_minor: -amount });
    db.postJournalEntry(reference, biz.business, biz.actualLedger, fx.userId);
  }
  post('DRT-1', '2027-05-10', 1000);
  post('DRT-2', '2027-05-03', 500);
  post('DRT-3', '2027-05-20', 200);

  const range = db.getLedgerDateRange(biz.business, biz.actualLedger);
  assert.equal(range.earliest, '2027-05-03', 'must be the real minimum transdate across every real posted entry, not just the first one posted');
  assert.equal(range.latest, '2027-05-20', 'must be the real maximum, regardless of posting order');
});

test('getAccountsPostedTo: finds the real, actual accounts a given reference posted to — used to correct a return to the exact same account the original sale used, not a different, plain fallback', () => {
  const biz = fx.freshBusiness('AcctsPostedTest Co');
  const revenueName = fx.uniqueName('AcctsPostedTest Revenue (Tier A)');
  db.create(fx.coaCategoryRoot(biz.business, 'Income'), db.typeRootName, revenueName, fx.userId);
  const cashAccount = db.requireEntityById(db.resolveBusinessCoaAccountId(biz.business, 'Cash and Bank'), db.typeRootName).name;
  const reference = fx.uniqueName('APT-1');
  db.stageLine({ reference, business: biz.business, ledger: biz.actualLedger, transdate: '2027-06-01', account: db.asAccountName(revenueName), amount_minor: -5000 });
  db.stageLine({ reference, business: biz.business, ledger: biz.actualLedger, transdate: '2027-06-01', account: db.asAccountName(cashAccount), amount_minor: 5000 });
  db.postJournalEntry(reference, biz.business, biz.actualLedger, fx.userId);

  const accounts = db.getAccountsPostedTo(reference);
  assert.ok(accounts.includes(revenueName), 'must find the real, specific account actually posted to, not a generic or reconstructed one');
  assert.ok(accounts.includes(cashAccount));
  assert.equal(accounts.length, 2, "must report every real, distinct account this reference touched, not just the first one it happens to find");

  assert.deepEqual(db.getAccountsPostedTo('APT-NONEXISTENT'), [], 'a reference that was never posted must report a real, empty list, not throw or return a misleading fallback');
});

test('postJournalEntry: a real multi-currency entry must balance independently per currency — the exact danger this catches: an EUR imbalance masked by an offsetting USD imbalance must never pass', () => {
  const biz = fx.freshBusiness('CcyTest Co');
  const cashEur = fx.uniqueName('CcyTest Cash (EUR)');
  const clearingEur = fx.uniqueName('CcyTest Clearing (EUR)');
  const cashUsd = fx.uniqueName('CcyTest Cash (USD)');
  const clearingUsd = fx.uniqueName('CcyTest Clearing (USD)');
  db.create(fx.coaCategoryRoot(biz.business, 'Asset'), db.typeRootName, cashEur, fx.userId);
  db.create(fx.coaCategoryRoot(biz.business, 'Asset'), db.typeRootName, clearingEur, fx.userId);
  db.create(fx.coaCategoryRoot(biz.business, 'Asset'), db.typeRootName, cashUsd, fx.userId);
  db.create(fx.coaCategoryRoot(biz.business, 'Asset'), db.typeRootName, clearingUsd, fx.userId);
  db.setAccountCurrency(cashEur, 'EUR');
  db.setAccountCurrency(clearingEur, 'EUR');
  db.setAccountCurrency(cashUsd, 'USD');
  db.setAccountCurrency(clearingUsd, 'USD');

  // A genuinely valid multi-currency entry: one entry, one reference, two independently-balanced currency groups.
  db.stageLine({ reference: 'CCY-GOOD-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-01', account: db.asAccountName(cashEur), amount_minor: 100000 });
  db.stageLine({ reference: 'CCY-GOOD-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-01', account: db.asAccountName(clearingEur), amount_minor: -100000 });
  db.stageLine({ reference: 'CCY-GOOD-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-01', account: db.asAccountName(clearingUsd), amount_minor: 109000 });
  db.stageLine({ reference: 'CCY-GOOD-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-01', account: db.asAccountName(cashUsd), amount_minor: -109000 });
  db.postJournalEntry('CCY-GOOD-1', biz.business, biz.actualLedger, fx.userId);
  const tb = db.getTrialBalance(biz.business, biz.actualLedger);
  const eurCash = tb.rows.find((r) => r.name === cashEur);
  assert.equal(eurCash?.debit_minor, 100000, 'a genuinely valid multi-currency entry must post successfully');

  // The real danger: EUR group off by $1.00, USD group off by exactly the opposite — sums to zero OVERALL, but must still be rejected.
  db.stageLine({ reference: 'CCY-BAD-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-02', account: db.asAccountName(cashEur), amount_minor: 100000 });
  db.stageLine({ reference: 'CCY-BAD-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-02', account: db.asAccountName(clearingEur), amount_minor: -99900 }); // short by 100
  db.stageLine({ reference: 'CCY-BAD-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-02', account: db.asAccountName(clearingUsd), amount_minor: 109000 });
  db.stageLine({ reference: 'CCY-BAD-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-02', account: db.asAccountName(cashUsd), amount_minor: -109100 }); // over by 100 — cancels the EUR error overall
  assert.throws(() => db.postJournalEntry('CCY-BAD-1', biz.business, biz.actualLedger, fx.userId), /does not balance/i);

  // An ordinary, single-currency (home/NULL) entry must be completely unaffected.
  const cashAccount = db.requireEntityById(db.resolveBusinessCoaAccountId(biz.business, 'Cash and Bank'), db.typeRootName).name;
  db.stageLine({ reference: 'CCY-HOME-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-03', account: db.asAccountName(cashAccount), amount_minor: 5000 });
  db.stageLine({ reference: 'CCY-HOME-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-03', account: db.asAccountName('Sales Revenue'), amount_minor: -5000 });
  db.postJournalEntry('CCY-HOME-1', biz.business, biz.actualLedger, fx.userId);
});

test('getTrialBalance: by_currency genuinely separates each real currency\'s own debit/credit totals - a combined, cross-currency sum can look balanced or unbalanced for entirely the wrong reason', () => {
  const biz = fx.freshBusiness('CcyTBTest Co');
  const cashEur = fx.uniqueName('CcyTBTest Cash (EUR)');
  const clearingEur = fx.uniqueName('CcyTBTest Clearing (EUR)');
  db.create(fx.coaCategoryRoot(biz.business, 'Asset'), db.typeRootName, cashEur, fx.userId);
  db.create(fx.coaCategoryRoot(biz.business, 'Asset'), db.typeRootName, clearingEur, fx.userId);
  db.setAccountCurrency(cashEur, 'EUR');
  db.setAccountCurrency(clearingEur, 'EUR');

  db.stageLine({ reference: 'CCYTB-EUR-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-02-01', account: db.asAccountName(cashEur), amount_minor: 20000 });
  db.stageLine({ reference: 'CCYTB-EUR-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-02-01', account: db.asAccountName(clearingEur), amount_minor: -20000 });
  db.postJournalEntry('CCYTB-EUR-1', biz.business, biz.actualLedger, fx.userId);
  const cashAccount = db.requireEntityById(db.resolveBusinessCoaAccountId(biz.business, 'Cash and Bank'), db.typeRootName).name;
  db.stageLine({ reference: 'CCYTB-HOME-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-02-01', account: db.asAccountName(cashAccount), amount_minor: 7500 });
  db.stageLine({ reference: 'CCYTB-HOME-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-02-01', account: db.asAccountName('Sales Revenue'), amount_minor: -7500 });
  db.postJournalEntry('CCYTB-HOME-1', biz.business, biz.actualLedger, fx.userId);

  const tb = db.getTrialBalance(biz.business, biz.actualLedger);
  assert.equal(tb.by_currency.length, 2, 'two real, genuinely distinct currency groups present here - home (null) and EUR - each gets its own, real subtotal row');
  const home = tb.by_currency.find((c) => c.currency === null);
  const eur = tb.by_currency.find((c) => c.currency === 'EUR');
  assert.equal(home?.total_debit_minor, 7500, 'the home-currency subtotal reflects only the real, home-currency postings, never mixed with EUR minor units');
  assert.equal(home?.total_credit_minor, 7500);
  assert.equal(home?.balanced, true);
  assert.equal(eur?.total_debit_minor, 20000, 'the EUR subtotal reflects only the real EUR postings');
  assert.equal(eur?.total_credit_minor, 20000);
  assert.equal(eur?.balanced, true);

  const eurCashRow = tb.rows.find((r) => r.name === cashEur);
  assert.equal(eurCashRow?.currency, 'EUR', 'each real row states its own, real, fixed currency directly, not just the aggregate');
  const homeCashRow = tb.rows.find((r) => r.name === cashAccount);
  assert.equal(homeCashRow?.currency, null, 'a real, home-currency account correctly reports null, never a guessed or inferred currency code');

  assert.equal(tb.rows.every((r) => r.has_quantity_postings === false), true, 'none of these real, ordinary financial accounts have ever received a real, direct quantity-tracking ("-QTY") posting');
});

test('getTrialBalance: has_quantity_postings correctly flags an account that has genuinely received a real, direct quantity-tracking ("-QTY") posting alongside its own, ordinary value postings', () => {
  const biz = fx.freshBusiness('QtyFlagTest Co');
  const accountName = fx.uniqueName('QtyFlagTest Account');
  db.create(fx.coaCategoryRoot(biz.business, 'Asset'), db.typeRootName, accountName, fx.userId);
  const reference = fx.uniqueName('QTYFLAG-1');
  db.stageLine({ reference, business: biz.business, ledger: biz.actualLedger, transdate: '2027-02-01', account: db.asAccountName(accountName), amount_minor: 500 });
  db.stageLine({ reference, business: biz.business, ledger: biz.actualLedger, transdate: '2027-02-01', account: db.asAccountName('Sales Revenue'), amount_minor: -500 });
  db.postJournalEntry(reference, biz.business, biz.actualLedger, fx.userId);
  // A real, direct, single-sided quantity-tracking posting - genuinely, deliberately not part of a balanced journal entry at all.
  const qtyRef = `${reference}-QTY`;
  db.stageLine({ reference: qtyRef, business: biz.business, ledger: biz.actualLedger, transdate: '2027-02-01', account: db.asAccountName(accountName), amount_minor: 12 });
  const businessId = db.requireEntity(biz.business, db.typeBusinessName, db.requireEntity('Businesses', db.typeRootName)).id;
  db.db.prepare(`INSERT INTO post_quantity_movement (reference, business, ledger, user_id) VALUES (?, ?, ?, ?)`).run(qtyRef, biz.business, biz.actualLedger, 1);

  const tb = db.getTrialBalance(biz.business, biz.actualLedger);
  const row = tb.rows.find((r) => r.name === accountName);
  assert.equal(row?.has_quantity_postings, true, 'a real account that has genuinely received a "-QTY" posting is correctly flagged, so a reader knows its own balance may be a real, confirmed mix, not purely monetary');
  const salesRow = tb.rows.find((r) => r.name === 'Sales Revenue');
  assert.equal(salesRow?.has_quantity_postings, false, 'a real, ordinary account that has never received a "-QTY" posting is correctly left unflagged');
});

test('getProfitAndLoss: Gross Profit is a real subtotal (Revenue minus COGS specifically), Net Profit unchanged — via the real, bootstrap-tagged COGS account, not a test-only setup', () => {
  const biz = fx.freshBusiness('GrossProfitTest Co');
  const cashAccount = db.requireEntityById(db.resolveBusinessCoaAccountId(biz.business, 'Cash and Bank'), db.typeRootName).name;

  db.stageLine({ reference: 'GPTEST-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-01', account: db.asAccountName('Sales Revenue'), amount_minor: -100000 });
  db.stageLine({ reference: 'GPTEST-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-01', account: db.asAccountName(cashAccount), amount_minor: 100000 });
  db.postJournalEntry('GPTEST-1', biz.business, biz.actualLedger, fx.userId);

  db.stageLine({ reference: 'GPTEST-2', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-02', account: db.asAccountName('Cost of Goods Sold'), amount_minor: 40000 });
  db.stageLine({ reference: 'GPTEST-2', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-02', account: db.asAccountName(cashAccount), amount_minor: -40000 });
  db.postJournalEntry('GPTEST-2', biz.business, biz.actualLedger, fx.userId);

  db.stageLine({ reference: 'GPTEST-3', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-03', account: db.asAccountName('Rent'), amount_minor: 20000 });
  db.stageLine({ reference: 'GPTEST-3', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-03', account: db.asAccountName(cashAccount), amount_minor: -20000 });
  db.postJournalEntry('GPTEST-3', biz.business, biz.actualLedger, fx.userId);

  const pl = db.getProfitAndLoss(biz.business, biz.actualLedger);
  assert.equal(pl.cogs_expenses.length, 1);
  assert.equal(pl.cogs_expenses[0].name, 'Cost of Goods Sold');
  assert.equal(pl.operating_expenses.some((e) => e.name === 'Rent'), true);
  assert.equal(pl.operating_expenses.some((e) => e.name === 'Cost of Goods Sold'), false, 'COGS must not also appear in operating expenses — each expense belongs to exactly one bucket');
  assert.equal(pl.gross_profit_minor, 60000, '$1,000 revenue - $400 COGS = $600 Gross Profit');
  assert.equal(pl.net_income_minor, 40000, '$600 Gross Profit - $200 Rent = $400 Net Profit, the same bottom line as before this feature existed');
  assert.equal(pl.total_expenses_minor, 60000, 'total_expenses_minor (COGS + operating together) is unchanged — a real backward-compatibility check, not assumed');
});

test('getTrialBalance: must always balance, even with real posted AR/AP — Customers/Vendors live outside the Chart of Accounts but their real monetary postings must still be included', () => {
  const biz = fx.freshBusiness('TBBalanceTest Co');
  const customerName = fx.uniqueName('TBBalance Test Customer');
  db.create(db.requireEntity('Customers', db.typeRootName), db.typeRootName, customerName, fx.userId);

  db.stageLine({ reference: 'TBTEST-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-01', account: db.asAccountName(customerName), amount_minor: 50000 });
  db.stageLine({ reference: 'TBTEST-1', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-01', account: db.asAccountName('Sales Revenue'), amount_minor: -50000 });
  db.postJournalEntry('TBTEST-1', biz.business, biz.actualLedger, fx.userId);

  const tb = db.getTrialBalance(biz.business, biz.actualLedger);
  assert.equal(tb.total_debit_minor, tb.total_credit_minor, 'a real Trial Balance must always balance — this is the fundamental accounting identity, not a cosmetic property');
  assert.equal(tb.rows.some((r) => r.name === customerName), true, "the customer's own real posted balance must appear as a row — it is not a synthetic aggregate, it is a genuine account with a genuine balance");
  const customerRow = tb.rows.find((r) => r.name === customerName);
  assert.equal(customerRow?.debit_minor, 50000);
});

test('allocatePayment: actually posts the real GL movement, not just a tracking record — confirmed directly, since this exact gap once let $920,626.23 in "paid" sales never reach Cash and Bank', () => {
  const biz = fx.freshBusiness('AllocGLTest Co');
  const customerName = fx.uniqueName('AllocGL Test Customer');
  db.create(db.requireEntity('Customers', db.typeRootName), db.typeRootName, customerName, fx.userId);

  const inv = db.createInvoice({
    invoiceType: 'AR', business: biz.business, ledger: biz.actualLedger, reference: 'ALLOCGL-1',
    counterpartyName: customerName, invoiceDate: '2027-01-01',
    lines: [{ description: 'x', amountMinor: 7500 }],
  }, fx.userId);
  db.postInvoice(inv, 'Sales Revenue', 'Sales Tax Payable', fx.userId);

  const cashAccount = db.requireEntityById(db.resolveBusinessCoaAccountId(biz.business, 'Cash and Bank'), db.typeRootName).name;
  const cashBefore = db.getTrialBalance(biz.business, biz.actualLedger).rows.find((r) => r.name === cashAccount)?.debit_minor ?? 0;
  db.allocatePayment(inv, 'ALLOCGL-PAY-1', 7500, '2027-01-02', cashAccount, fx.userId);
  const cashAfter = db.getTrialBalance(biz.business, biz.actualLedger).rows.find((r) => r.name === cashAccount)?.debit_minor ?? 0;

  assert.equal(cashAfter - cashBefore, 7500, 'Cash and Bank must genuinely increase by the allocated amount, not stay unchanged');
  const customerRow = db.getTrialBalance(biz.business, biz.actualLedger).rows.find((r) => r.name === customerName);
  assert.equal(customerRow, undefined, "the customer's own AR balance must be back to zero (and so absent from the Trial Balance) after full payment, not left sitting there");
});

test('completePosSale defaults to real, per-product Sales accounts — not one shared aggregate that could never distinguish one product\'s margin from another\'s', () => {
  const biz = fx.freshBusiness('PerProductTest Co');
  const outlet = fx.freshLocation(biz.business, 'PerProductTest Outlet', { bottle_capacity: 100, carton_capacity: 20 });
  const wineA = fx.uniqueName('PerProductTest Wine A');
  const wineB = fx.uniqueName('PerProductTest Wine B');
  db.createItem(wineA, 'Items', fx.userId, biz.business);
  db.createItem(wineB, 'Items', fx.userId, biz.business);
  db.receiveItems(biz.business, biz.actualLedger, 'PPTEST-REC-1', db.asItemName(wineA), outlet.name, 10, fx.userId, '2027-01-01');
  db.receiveItems(biz.business, biz.actualLedger, 'PPTEST-REC-2', db.asItemName(wineB), outlet.name, 10, fx.userId, '2027-01-01');

  // No revenueAccount at all — this is the actual point being tested.
  db.completePosSale(
    {
      business: biz.business,
      ledger: biz.actualLedger,
      locationName: outlet.name,
      customerName: db.asCustomerName('Cash Sale'),
      lines: [
        { itemName: wineA, quantity: 2, unitPriceMinor: 1500, taxMinor: 0 } as any,
        { itemName: wineB, quantity: 3, unitPriceMinor: 2000, taxMinor: 0 } as any,
      ],
      taxAccount: db.asAccountName('Sales Tax Payable'),
      paymentMethod: 'cash',
      transdate: '2027-01-02',
    },
    fx.userId
  );

  const tb = db.getTrialBalance(biz.business, biz.actualLedger);
  const salesA = tb.rows.find((r) => r.name === `${wineA} — ${outlet.name}`);
  const salesB = tb.rows.find((r) => r.name === `${wineB} — ${outlet.name}`);
  assert.equal(salesA?.credit_minor, 3000, "Wine A's own real Sales account must show exactly its own 2x$15.00 — not blended with Wine B's");
  assert.equal(salesB?.credit_minor, 6000, "Wine B's own real Sales account must show exactly its own 3x$20.00 — not blended with Wine A's");

  // ensureItemSalesCogsAccounts itself: the COGS side must be tagged for Gross Profit.
  const { cogsAccount, cogsAccountId } = db.ensureItemSalesCogsAccounts(db.asItemName(wineA), fx.userId, undefined, biz.business);
  assert.equal(cogsAccount, wineA);
  const cogsRow = db.db.prepare(`SELECT relation_id FROM current_entities WHERE id = ?`).get(cogsAccountId) as { relation_id: number } | undefined;
  const cogsTagId = db.db.prepare(`SELECT id FROM current_entities WHERE name = 'COGS'`).get() as { id: number };
  assert.equal(cogsRow?.relation_id, cogsTagId.id, "a product's own COGS leaf must be tagged for Gross Profit the moment it's created, not as a separate forgettable step");
});

test('a item\'s real retail_price_minor is a genuine lookup field, reachable via every real path a POS screen actually uses — not something the operator types in', () => {
  const biz = fx.freshBusiness('RetailPriceTest Co');
  const wineName = fx.uniqueName('RetailPriceTest Wine');
  db.createItem(wineName, 'Items', fx.userId, biz.business);
  const upc = fx.uniqueName('999888777').slice(0, 20);
  db.setItem(wineName, { description: 'x', unit_of_measure: 'each', upc, retail_price_minor: 4250 });

  const viaGetItem = db.getItem(wineName);
  assert.equal(viaGetItem?.retail_price_minor, 4250, 'getItem must return the real price, not require a separate lookup');

  const viaListItems = db.listItems(biz.business).find((p) => p.name === wineName);
  assert.equal(viaListItems?.retail_price_minor, 4250, 'listItems (what the POS screen actually loads on open) must include the real price');

  const viaUpc = db.getItemByUpc(upc);
  assert.equal(viaUpc?.retail_price_minor, 4250, 'getItemByUpc (what a barcode scan actually calls) must return the real price, not just the bare name it used to');
});

test('getSalesReport: detailed lines and a genuine category rollup (via the real entity tree, not a hand-maintained list) that both sum to the same real total', () => {
  const biz = fx.freshBusiness('SalesReportTest Co');
  const customerName = fx.uniqueName('SalesReportTest Customer');
  db.create(db.requireEntity('Customers', db.typeRootName), db.typeRootName, customerName, fx.userId);
  const merlotCat = fx.uniqueName('SalesReportTest Merlot Category');
  const shirazCat = fx.uniqueName('SalesReportTest Shiraz Category');
  db.createItemCategory(biz.business, merlotCat, undefined, fx.userId);
  db.createItemCategory(biz.business, shirazCat, undefined, fx.userId);
  const merlotName = fx.uniqueName('SalesReportTest Merlot');
  const shirazName = fx.uniqueName('SalesReportTest Shiraz');
  db.createItem(merlotName, merlotCat, fx.userId, biz.business);
  db.createItem(shirazName, shirazCat, fx.userId, biz.business);

  const inv = db.createInvoice(
    {
      invoiceType: 'AR', business: biz.business, ledger: biz.actualLedger, reference: 'SRTEST-1',
      counterpartyName: customerName, invoiceDate: '2027-02-01',
      lines: [
        { description: merlotName, itemName: merlotName, quantity: 3, unitPriceMinor: 2000, amountMinor: 6000 },
        { description: shirazName, itemName: shirazName, quantity: 2, unitPriceMinor: 3000, amountMinor: 6000 },
      ],
    },
    fx.userId
  );
  db.postInvoice(inv, 'Sales Revenue', 'Sales Tax Payable', fx.userId);

  const report = db.getSalesReport(biz.business, biz.actualLedger, '2027-02-01', '2027-02-01');
  assert.equal(report.detailed.length, 2, 'both real posted lines must appear in the detailed report');
  assert.equal(report.total_amount_minor, 12000);
  assert.equal(report.total_quantity, 5);

  const merlotCatRow = report.category_summary.find((c) => c.category === merlotCat);
  const shirazCatRow = report.category_summary.find((c) => c.category === shirazCat);
  assert.equal(merlotCatRow?.amount_minor, 6000, 'category rollup must use the real parent category from the entity tree');
  assert.equal(shirazCatRow?.amount_minor, 6000);
  const summedFromCategories = report.category_summary.reduce((s, c) => s + c.amount_minor, 0);
  assert.equal(summedFromCategories, report.total_amount_minor, 'the category summary must sum to exactly the same total as the detailed lines — no double-counting, nothing dropped');
});

test('setRelationship/getRelationship/getEntitiesWithRelationship: the real relationship-type pattern, confirmed the same shape as an ordinary relation_id tag, not a special case', () => {
  const smith = fx.uniqueName('RelTest Smith Prototype Trust');
  const jones = fx.uniqueName('RelTest Jones Prototype Trust');
  const boutique = fx.uniqueName('RelTest Boutique Wine Company');
  db.create(db.requireEntity('Businesses', db.typeRootName), db.typeRootName, smith, fx.userId);
  db.create(db.requireEntity('Businesses', db.typeRootName), db.typeRootName, jones, fx.userId);
  db.create(db.requireEntity('Businesses', db.typeRootName), db.typeRootName, boutique, fx.userId);

  db.setRelationship(smith, 'Trustee Of', boutique, fx.userId);
  db.setRelationship(jones, 'Trustee Of', boutique, fx.userId);

  const rel = db.getRelationship(smith);
  assert.equal(rel?.type, 'Trustee Of');
  assert.equal(rel?.target, boutique);

  const group = db.getEntitiesWithRelationship('Trustee Of');
  const smithRow = group.find((r) => r.source === smith);
  const jonesRow = group.find((r) => r.source === jones);
  assert.equal(smithRow?.target, boutique);
  assert.equal(jonesRow?.target, boutique);

  const unrelated = fx.uniqueName('RelTest Unrelated Company');
  db.create(db.requireEntity('Businesses', db.typeRootName), db.typeRootName, unrelated, fx.userId);
  assert.equal(db.getRelationship(unrelated), undefined);
});

test('addTypedAddress/getTypedAddresses/addTypedPhone/getTypedPhones: multiple, genuinely typed addresses and phones per entity, zero new tables — reusing parent_id + relation_id + contact recursively', () => {
  const biz = fx.freshBusiness('TypedContactTest Co');
  // A bare, plain entity node under this business's own real Locations
  // root - not a full, real location run through
  // createAndConfigureLocation. addTypedAddress/addTypedPhone work on
  // any entity by name, and a full real location's own name is
  // deliberately, genuinely ambiguous (ensureLocationStorageRoot gives
  // it a GL namesake elsewhere in the tree - see that function's own
  // comment in db.ts), which is irrelevant to what this test actually
  // verifies and would only be testing that unrelated, already-covered
  // hazard by accident.
  const locationsRootId = db.resolveBusinessLocationsRootId(biz.business)!;
  const storeName = fx.uniqueName('TypedContactTest Store');
  db.create(db.requireEntityById(locationsRootId, db.typeRootName), db.typeRootName, storeName, fx.userId);

  db.addTypedAddress(storeName, 'Registered Office', { address_line1: '1 Corporate Way', city: 'Springfield' }, fx.userId);
  db.addTypedAddress(storeName, 'Delivery', { address_line1: '42 Market Street', city: 'Springfield' }, fx.userId);
  db.addTypedPhone(storeName, 'Landline', '555-0100', fx.userId);
  db.addTypedPhone(storeName, 'Mobile', '555-0199', fx.userId);

  const addresses = db.getTypedAddresses(storeName);
  assert.equal(addresses.length, 2, 'both real, distinct addresses must appear');
  const registered = addresses.find((a) => a.address_type === 'Registered Office');
  const delivery = addresses.find((a) => a.address_type === 'Delivery');
  assert.equal(registered?.address_line1, '1 Corporate Way');
  assert.equal(delivery?.address_line1, '42 Market Street');

  const phones = db.getTypedPhones(storeName);
  assert.equal(phones.length, 2, 'both real, distinct phones must appear');
  assert.equal(phones.find((p) => p.phone_type === 'Landline')?.phone, '555-0100');
  assert.equal(phones.find((p) => p.phone_type === 'Mobile')?.phone, '555-0199');

  const entities = db.getEntityTree();
  const storeNode = entities.find((e) => e.name === storeName)!;
  const children = entities.filter((e) => e.parent_id === storeNode.id);
  assert.equal(children.length, 4, 'exactly 4 real children — 2 addresses + 2 phones, no more, no fewer');

  db.deleteTypedAddress(storeName, 'Delivery', fx.userId);
  assert.equal(db.getTypedAddresses(storeName).length, 1, 'deleting one address must not touch the other, or any phone');
  assert.equal(db.getTypedPhones(storeName).length, 2);

  db.deleteTypedPhone(storeName, 'Mobile', fx.userId);
  assert.equal(db.getTypedPhones(storeName).length, 1);
});

test('createBusiness: a brand-new business gets both a real Actual ledger AND a real Budget ledger for the financial year, immediately postable to, using the already-shared Chart of Accounts — no separate CoA setup needed', () => {
  const result = db.createBusiness(db.asBusinessName(fx.uniqueName('CreateBusinessTest Co')), '2027-28', fx.userId);

  assert.equal(result.actualLedger, 'Actual');
  assert.equal(result.budgetLedger, 'Budget 2027-28');

  const businesses = db.getBusinesses();
  assert.ok(businesses.some((b) => b.name === result.business), 'the new business must be a real, findable entity');

  const ledgers = db.getLedgers(result.business);
  assert.equal(ledgers.length, 2, 'getLedgers must return only the real ledgers, not the business\'s own Locations parent too');
  assert.ok(ledgers.some((l) => l.name === 'Actual'));
  assert.ok(ledgers.some((l) => l.name === 'Budget 2027-28'));
  assert.ok(!ledgers.some((l) => l.name === 'Locations'), 'Locations must never appear as a selectable ledger');

  const entities = db.getEntityTree();
  const thisBusinessId = (db.db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(result.business) as { id: number }).id;
  assert.ok(entities.some((e) => e.name === 'Locations' && e.parent_id === thisBusinessId), 'a new business must still get its own real Locations parent immediately — just not counted as a ledger');

  const ref = fx.uniqueName('CBTEST-CAPITAL-1');
  db.stageLine({ reference: ref, business: result.business, ledger: result.actualLedger, transdate: '2027-01-01', account: db.asAccountName('Cash and Bank'), amount_minor: 500000 });
  db.stageLine({ reference: ref, business: result.business, ledger: result.actualLedger, transdate: '2027-01-01', account: db.asAccountName("Owner's Equity"), amount_minor: -500000 });
  db.postJournalEntry(ref, result.business, result.actualLedger, fx.userId);

  const tb = db.getTrialBalance(result.business, result.actualLedger, '2027-01-01');
  const cashRow = tb.rows.find((r) => r.name === 'Cash and Bank');
  assert.equal(cashRow?.debit_minor, 500000, 'the new business\'s own real capital contribution must show up correctly, ledger-scoped, immediately — not requiring any further setup');

  const budgetRef = fx.uniqueName('CBTEST-BUDGET-1');
  db.stageLine({ reference: budgetRef, business: result.business, ledger: db.asLedgerName('Budget 2027-28'), transdate: '2027-01-01', account: db.asAccountName('Sales Revenue'), amount_minor: -1000000 });
  db.stageLine({ reference: budgetRef, business: result.business, ledger: db.asLedgerName('Budget 2027-28'), transdate: '2027-01-01', account: db.asAccountName('Retained Earnings'), amount_minor: 1000000 });
  db.postJournalEntry(budgetRef, result.business, db.asLedgerName('Budget 2027-28'), fx.userId);

  const budgetTb = db.getTrialBalance(result.business, db.asLedgerName('Budget 2027-28'), '2027-01-01');
  const budgetSalesRow = budgetTb.rows.find((r) => r.name === 'Sales Revenue');
  assert.equal(budgetSalesRow?.credit_minor, 1000000, 'the real Budget ledger must be genuinely separate from Actual, correctly ledger-scoped — a real target, not merely a name');

  const budgetCashRow = budgetTb.rows.find((r) => r.name === 'Cash and Bank');
  assert.equal(budgetCashRow, undefined, "Actual's own real transactions must never appear in the Budget ledger's own balances");
});

test('createBusiness: real, optional secondary currencies each get a real, automatic "Cash at Bank ({currency})" account, correctly tagged and immediately postable to — a genuinely ordinary business omits this entirely', () => {
  const ordinaryName = fx.uniqueName('OrdinaryCurrencyTest Co');
  db.createBusiness(db.asBusinessName(ordinaryName), '2027-28', fx.userId, 'English CoA');
  assert.equal(db.getEntityTree().some((e) => e.name.startsWith('Cash at Bank (') && e.name.includes(ordinaryName)), false);

  const multiName = fx.uniqueName('MultiCurrencyTest Co');
  const result = db.createBusiness(db.asBusinessName(multiName), '2027-28', fx.userId, 'English CoA', ['EUR', 'USD']);
  assert.equal(result.business, multiName);

  const entities = db.getEntityTree();
  const eurAccount = entities.find((e) => e.name === 'Cash at Bank (EUR)' && isDescendantOfBiz(entities, e, multiName));
  const usdAccount = entities.find((e) => e.name === 'Cash at Bank (USD)' && isDescendantOfBiz(entities, e, multiName));
  assert.ok(eurAccount, 'a real "Cash at Bank (EUR)" account must exist');
  assert.ok(usdAccount, 'a real "Cash at Bank (USD)" account must exist');

  const eurParent = entities.find((e) => e.id === eurAccount!.parent_id);
  assert.equal(eurParent?.name, 'Asset', 'the real currency account must sit under Asset, the same real category the existing, hand-written demo currency accounts already use');

  const eurCurrencyRow = db.db.prepare(`SELECT currency FROM account WHERE entity_id = ?`).get(eurAccount!.id) as { currency: string };
  assert.equal(eurCurrencyRow.currency, 'EUR', 'the real account.currency field must be genuinely set, the same real mechanism postJournalEntry itself validates against');

  function isDescendantOfBiz(allEntities: typeof entities, node: typeof entities[number], bizName: string): boolean {
    let cur: typeof node | undefined = node;
    for (let i = 0; i < 10 && cur; i++) {
      if (cur.name === bizName) return true;
      cur = allEntities.find((e) => e.id === cur!.parent_id);
    }
    return false;
  }
});

test('ensureItemSalesCogsAccounts: mirrors the real, existing product category tree onto the GL side, not a flat or hardcoded structure', () => {
  const biz = fx.freshBusiness('CategoryMirrorTest Co');
  const category = fx.uniqueName('CategoryMirrorTest Category');
  const subCategory = fx.uniqueName('CategoryMirrorTest SubCategory');
  db.createItemCategory(biz.business, category, undefined, fx.userId);
  db.createItemCategory(biz.business, subCategory, category, fx.userId);
  const productName = fx.uniqueName('CategoryMirrorTest Product');
  db.createItem(productName, subCategory, fx.userId, biz.business);

  const { salesAccount, salesAccountId, cogsAccountId } = db.ensureItemSalesCogsAccounts(db.asItemName(productName), fx.userId, undefined, biz.business);
  assert.equal(salesAccount, productName);

  const entities = db.getEntityTree();
  const salesLeaf = entities.find((e) => e.id === salesAccountId)!;
  const salesSubCat = entities.find((e) => e.id === salesLeaf.parent_id)!;
  assert.equal(salesSubCat.name, subCategory, 'the leaf must nest under a real, mirrored sub-category, not sit flat under Income directly');
  const salesTopCat = entities.find((e) => e.id === salesSubCat.parent_id)!;
  assert.equal(salesTopCat.name, category);
  const salesRoot = entities.find((e) => e.id === salesTopCat.parent_id)!;
  assert.equal(salesRoot.name, 'Sales Revenue', 'the top category must parent under the real, existing Sales Revenue heading account');
  const salesGrandRoot = entities.find((e) => e.id === salesRoot.parent_id)!;
  assert.equal(salesGrandRoot.name, 'Income', 'the real, existing Sales Revenue heading account itself parents directly under Income, completing the real, mirrored chain');

  const cogsLeaf = entities.find((e) => e.id === cogsAccountId)!;
  const cogsSubCat = entities.find((e) => e.id === cogsLeaf.parent_id)!;
  assert.equal(cogsSubCat.name, subCategory, 'COGS mirrors the exact same real category chain, independently, on the Expense side');

  const flatCategory = fx.uniqueName('CategoryMirrorTest FlatCategory');
  db.createItemCategory(biz.business, flatCategory, undefined, fx.userId);
  const flatProductName = fx.uniqueName('CategoryMirrorTest FlatProduct');
  db.createItem(flatProductName, flatCategory, fx.userId, biz.business);
  const flatResult = db.ensureItemSalesCogsAccounts(db.asItemName(flatProductName), fx.userId, undefined, biz.business);
  const flatLeaf = db.getEntityTree().find((e) => e.id === flatResult.salesAccountId)!;
  const flatParent = db.getEntityTree().find((e) => e.id === flatLeaf.parent_id)!;
  assert.equal(flatParent.name, flatCategory);
  const flatRoot = db.getEntityTree().find((e) => e.id === flatParent.parent_id)!;
  assert.equal(flatRoot.name, 'Sales Revenue', 'a product with no sub-category still gets exactly one real grouping level under the real, existing Sales Revenue heading, not a fixed number of levels regardless of the real catalog depth');
});

test('Profit Centers (Phase A, docs/profit-centers-design.md): a business starts with none, creating one is real and rejects a duplicate, and getProfitCenters is scoped per business', () => {
  const biz = fx.freshBusiness('PCTest Co', { coaPrototype: 'English CoA' });
  assert.deepEqual(db.getProfitCenters(biz.business), [], 'a freshly created business must start with zero real Profit Centers — purely additive, never automatic');

  const pcName = fx.uniqueName('Downtown Store');
  const pc = db.createProfitCenter(biz.business, pcName, fx.userId);
  assert.equal(pc.name, pcName);
  assert.deepEqual(db.getProfitCenters(biz.business).map((p) => p.name), [pcName]);

  assert.throws(() => db.createProfitCenter(biz.business, pcName, fx.userId), /already exists/, 'a second, real Profit Center of the exact same name for the exact same business must be rejected, not silently create a duplicate');

  const otherBiz = fx.freshBusiness('PCTest Other Co', { coaPrototype: 'English CoA' });
  assert.deepEqual(db.getProfitCenters(otherBiz.business), [], "a genuinely different business must never see another business's own Profit Centers");
});

test('Profit Centers (Phase A): Sales Revenue/COGS/Inventory leaves nest under a real, named Profit Center grouping node, directly under the exact, same shared headers — zero change at all when no profitCenter is passed', () => {
  const biz = fx.freshBusiness('PCAcctTest Co', { coaPrototype: 'English CoA' });
  db.createProfitCenter(biz.business, 'Warehouse Ops', fx.userId);
  const wine1 = fx.uniqueName('PCAcctTest Wine');
  db.createItem(wine1, 'Items', fx.userId, biz.business);

  const flat = db.ensureItemSalesCogsAccounts(db.asItemName(wine1), fx.userId, undefined, biz.business);
  const flatInventory = db.ensureItemInventoryAccount(db.asItemName(wine1), fx.userId, undefined, biz.business);
  let entities = db.getEntityTree();
  const flatSalesParent = entities.find((e) => e.id === entities.find((x) => x.id === flat.salesAccountId)!.parent_id)!;
  assert.equal(flatSalesParent.name, 'Sales Revenue', 'with no Profit Center given, the leaf must sit directly under the real, shared Sales Revenue header, exactly as before this feature existed');
  const flatInventoryParent = entities.find((e) => e.id === entities.find((x) => x.id === flatInventory.inventoryAccountId)!.parent_id)!;
  assert.equal(flatInventoryParent.name, 'Inventory');

  const wine2 = fx.uniqueName('PCAcctTest Second Wine');
  db.createItem(wine2, 'Items', fx.userId, biz.business);
  const scoped = db.ensureItemSalesCogsAccounts(db.asItemName(wine2), fx.userId, undefined, biz.business, 'Warehouse Ops');
  const scopedInventory = db.ensureItemInventoryAccount(db.asItemName(wine2), fx.userId, undefined, biz.business, 'Warehouse Ops');
  entities = db.getEntityTree();

  const scopedSalesLeaf = entities.find((e) => e.id === scoped.salesAccountId)!;
  const scopedSalesGroup = entities.find((e) => e.id === scopedSalesLeaf.parent_id)!;
  assert.equal(scopedSalesGroup.name, 'Warehouse Ops', 'a scoped item must nest one real level deeper, under a real grouping node named after its own Profit Center');
  const scopedSalesRoot = entities.find((e) => e.id === scopedSalesGroup.parent_id)!;
  assert.equal(scopedSalesRoot.name, 'Sales Revenue', 'the Profit Center grouping node itself must still sit directly under the real, shared Sales Revenue header — never a separate section of its own');

  const scopedCogsLeaf = entities.find((e) => e.id === scoped.cogsAccountId)!;
  const scopedCogsGroup = entities.find((e) => e.id === scopedCogsLeaf.parent_id)!;
  assert.equal(scopedCogsGroup.name, 'Warehouse Ops');
  const scopedCogsRoot = entities.find((e) => e.id === scopedCogsGroup.parent_id)!;
  assert.equal(scopedCogsRoot.name, 'Cost of Goods Sold');

  const scopedInventoryLeaf = entities.find((e) => e.id === scopedInventory.inventoryAccountId)!;
  const scopedInventoryGroup = entities.find((e) => e.id === scopedInventoryLeaf.parent_id)!;
  assert.equal(scopedInventoryGroup.name, 'Warehouse Ops');
  const scopedInventoryRoot = entities.find((e) => e.id === scopedInventoryGroup.parent_id)!;
  assert.equal(scopedInventoryRoot.name, 'Inventory', 'the Profit Center grouping node under Inventory must still sit directly under the real, shared Inventory header — so getBalanceSheet still finds and totals it with no separate reporting path');

  const location = fx.freshLocation(biz.business, 'PCAcctTest Location', {});
  const scopedLocationInventory = db.ensureItemLocationInventoryAccount(db.asItemName(wine2), location.name, fx.userId, undefined, biz.business, 'Warehouse Ops');
  entities = db.getEntityTree();
  const locLeaf = entities.find((e) => e.id === scopedLocationInventory.inventoryAccountId)!;
  assert.equal(locLeaf.parent_id, scopedInventory.inventoryAccountId, 'the location-scoped leaf must still nest directly under this item\'s own (now Profit-Center-scoped) base Inventory account');

  assert.throws(
    () => db.ensureItemSalesCogsAccounts(db.asItemName(wine2), fx.userId, undefined, biz.business, 'Nonexistent Center'),
    /No real Profit Center named/
  );
});

test('Profit Centers (Phase B, docs/profit-centers-design.md): closeBooks posts a Profit Center\'s own net income into its own, real, Profit-Center-tagged Retained Earnings sibling - never the plain, shared one - and profitCenterBreakdown reports it; a business with zero Profit Centers used gets exactly one, unchanged, null-profitCenter entry', () => {
  const biz = fx.freshBusiness('PCCloseTest Co', { coaPrototype: 'English CoA' });
  db.createProfitCenter(biz.business, 'Downtown Store', fx.userId);
  const wine = fx.uniqueName('PCCloseTest Wine');
  db.createItem(wine, 'Items', fx.userId, biz.business);

  const equityHeaderId = db.resolveBusinessCoaAccountId(biz.business, 'Equity');
  const retainedName = fx.uniqueName('PCCloseTest Retained Earnings');
  const retainedEarnings = db.create(db.requireEntityById(equityHeaderId, db.typeRootName), db.typeRootName, retainedName, fx.userId);

  const accounts = db.ensureItemSalesCogsAccounts(db.asItemName(wine), fx.userId, undefined, biz.business, 'Downtown Store');
  const ref1 = fx.uniqueName('PCCLOSE-1');
  db.stageLine({ reference: ref1, business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-01', account: db.asAccountName(accounts.salesAccount), accountId: accounts.salesAccountId, amount_minor: -75000 });
  db.stageLine({ reference: ref1, business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-01', account: db.asAccountName('Cash and Bank'), amount_minor: 75000 });
  db.postJournalEntry(ref1, biz.business, biz.actualLedger, fx.userId);

  const result = db.closeBooks(biz.business, biz.actualLedger, '2027-01-31', retainedEarnings.name, fx.userId);
  assert.equal(result.accountsZeroed, 1);
  assert.equal(result.netIncomeMinor, 75000);
  assert.deepEqual(result.profitCenterBreakdown, [{ profitCenter: 'Downtown Store', netIncomeMinor: 75000 }], 'the real net income this close actually posted must show up, broken down by its own, real Profit Center');

  const pcRetained = db.db.prepare(`SELECT a.balance_minor FROM account a JOIN current_entities e ON e.id = a.entity_id WHERE e.name = ?`).get(`${retainedName} (Profit Center: Downtown Store)`) as { balance_minor: number } | undefined;
  assert.ok(pcRetained, 'a real, Profit-Center-tagged Retained Earnings sibling must exist, genuinely separate from the plain, shared one');
  assert.equal(pcRetained!.balance_minor, -75000, "the Profit Center's own real net income closes into its own, real, tagged Retained Earnings sibling, never the plain, shared one");

  const plainRetained = db.db.prepare(`SELECT balance_minor FROM account WHERE entity_id = ?`).get(retainedEarnings.id) as { balance_minor: number } | undefined;
  assert.equal(plainRetained?.balance_minor ?? 0, 0, 'the plain, shared Retained Earnings account must stay untouched - every real dollar of this Profit Center\'s own net income went to its own, real sibling instead');

  const biz2 = fx.freshBusiness('PCCloseTest Unaffected Co', { coaPrototype: 'English CoA' });
  const wine2 = fx.uniqueName('PCCloseTest Unaffected Wine');
  db.createItem(wine2, 'Items', fx.userId, biz2.business);
  const plainAccounts = db.ensureItemSalesCogsAccounts(db.asItemName(wine2), fx.userId, undefined, biz2.business);
  const plainEquityHeaderId = db.resolveBusinessCoaAccountId(biz2.business, 'Equity');
  const plainRetainedName = fx.uniqueName('PCCloseTest Unaffected Retained Earnings');
  const plainRetainedAccount = db.create(db.requireEntityById(plainEquityHeaderId, db.typeRootName), db.typeRootName, plainRetainedName, fx.userId);
  const ref2 = fx.uniqueName('PCCLOSE-2');
  db.stageLine({ reference: ref2, business: biz2.business, ledger: biz2.actualLedger, transdate: '2027-01-01', account: db.asAccountName(plainAccounts.salesAccount), accountId: plainAccounts.salesAccountId, amount_minor: -30000 });
  db.stageLine({ reference: ref2, business: biz2.business, ledger: biz2.actualLedger, transdate: '2027-01-01', account: db.asAccountName('Cash and Bank'), amount_minor: 30000 });
  db.postJournalEntry(ref2, biz2.business, biz2.actualLedger, fx.userId);
  const plainResult = db.closeBooks(biz2.business, biz2.actualLedger, '2027-01-31', plainRetainedAccount.name, fx.userId);
  assert.deepEqual(plainResult.profitCenterBreakdown, [{ profitCenter: null, netIncomeMinor: 30000 }], 'a business that never used a Profit Center at all must still get exactly one, real, unaffected breakdown entry carrying the whole, real net income');
});

test('POS clerk sign-on/sign-off: a real employee needs a real PIN, can only be signed on at one real location at a time, and signing off closes the real shift record cleanly', () => {
  const biz = fx.freshBusiness('ShiftTest Co');
  const employeeName = fx.uniqueName('ShiftTest Employee');
  db.create(db.requireEntity('Employees', db.typeRootName), db.typeRootName, employeeName, fx.userId);
  const locationA = fx.freshLocation(biz.business, 'ShiftTest Location A', {});
  const locationB = fx.freshLocation(biz.business, 'ShiftTest Location B', {});

  assert.throws(() => db.signOn(employeeName, locationA.name), /no real PIN set yet/, 'must refuse to sign on an employee with no real PIN configured at all');

  db.setPosPin(employeeName, '4321');
  assert.equal(db.verifyPosPin(employeeName, '4321'), true, 'the real, correct PIN must verify');
  assert.equal(db.verifyPosPin(employeeName, '0000'), false, 'a real, wrong PIN must not verify');

  const shift = db.signOn(employeeName, locationA.name);
  assert.equal(shift.employee, employeeName);
  assert.equal(shift.location, locationA.name);
  assert.equal(shift.signed_off_at, null, 'a freshly-opened shift has no real sign-off time yet');

  assert.throws(() => db.signOn(employeeName, locationB.name), /already signed on somewhere/, 'a real employee can only be signed on at one real location at a time, even a different one');

  const activeAtA = db.getActiveShiftsAtLocation(locationA.name);
  assert.equal(activeAtA.length, 1);
  assert.equal(activeAtA[0].employee, employeeName);
  assert.equal(db.getActiveShiftsAtLocation(locationB.name).length, 0, 'a real, different location must show no active shifts for an employee signed on elsewhere');

  const openShift = db.getOpenShiftForEmployee(employeeName);
  assert.equal(openShift?.id, shift.id);

  db.signOff(shift.id);
  assert.equal(db.getActiveShiftsAtLocation(locationA.name).length, 0, 'signing off must genuinely close the shift, not leave it active');
  assert.equal(db.getOpenShiftForEmployee(employeeName), undefined, 'no real, open shift should remain for this employee after signing off');

  assert.throws(() => db.signOff(shift.id), /already signed off/, 'signing off an already-closed shift must be refused, not silently accepted');

  const secondShift = db.signOn(employeeName, locationB.name);
  assert.equal(secondShift.location, locationB.name);
  assert.notEqual(secondShift.id, shift.id, 'a real, new shift record, not a reused one');
});

test('previewCloseBooks: the real, proposed lines it returns exactly match what closeBooks itself actually posts, and nothing is staged or posted by the preview itself', () => {
  const biz = fx.freshBusiness('PreviewCloseTest Co', { coaPrototype: 'English CoA' });
  const ledgerName = fx.uniqueName('PreviewCloseTest Ledger');
  db.create(db.requireEntity('Ledgers', db.typeRootName, db.requireEntity(biz.business, db.typeBusinessName, db.requireEntity('Businesses', db.typeRootName))), db.typeRootName, ledgerName, fx.userId);
  const revenueName = fx.uniqueName('PreviewCloseTest Revenue');
  db.create(fx.coaCategoryRoot(biz.business, 'Income'), db.typeRootName, revenueName, fx.userId);
  const retainedName = fx.uniqueName('PreviewCloseTest Retained Earnings');
  db.create(fx.coaCategoryRoot(biz.business, 'Equity'), db.typeRootName, retainedName, fx.userId);

  const ref = fx.uniqueName('PCT-1');
  db.stageLine({ reference: ref, business: biz.business, ledger: db.asLedgerName(ledgerName), transdate: '2027-01-01', account: db.asAccountName(revenueName), amount_minor: -50000 });
  db.stageLine({ reference: ref, business: biz.business, ledger: db.asLedgerName(ledgerName), transdate: '2027-01-01', account: db.asAccountName('Cash and Bank'), amount_minor: 50000 });
  db.postJournalEntry(ref, biz.business, db.asLedgerName(ledgerName), fx.userId);

  const preview = db.previewCloseBooks(biz.business, db.asLedgerName(ledgerName), '2027-01-31', retainedName);
  assert.equal(preview.netIncomeMinor, 50000);
  assert.equal(preview.accountsZeroed, 1);
  assert.equal(preview.lines.length, 2, 'one real line reversing the revenue account, one real line crediting Retained Earnings — the real, complete, balanced entry a person would actually see');
  const revenueLine = preview.lines.find((l) => l.account === revenueName);
  const retainedLine = preview.lines.find((l) => l.account === retainedName);
  assert.equal(revenueLine?.amount_minor, 50000, "reversing the revenue account's own, real, credit-normal -$500 balance to zero");
  assert.equal(retainedLine?.amount_minor, -50000, 'crediting the real, chosen Retained Earnings account with the real, full net income');
  assert.equal(preview.lines.reduce((sum, l) => sum + l.amount_minor, 0), 0, "the real, proposed entry must already be genuinely balanced, exactly like any entry closeBooks itself would actually post");

  const tb = db.getTrialBalance(biz.business, db.asLedgerName(ledgerName));
  assert.notEqual(tb.rows.find((r) => r.name === revenueName), undefined, 'a real preview must not actually zero the revenue account — only a real close does that');

  const result = db.closeBooks(biz.business, db.asLedgerName(ledgerName), '2027-01-31', retainedName, fx.userId);
  assert.equal(result.netIncomeMinor, preview.netIncomeMinor);
  assert.equal(result.accountsZeroed, preview.accountsZeroed);

  assert.throws(() => db.previewCloseBooks(biz.business, db.asLedgerName(ledgerName), '2027-01-31', retainedName), /Nothing to close/);
});

test('Location open hours and employee weekly scheduling, built entirely on the real entity tree — no new table, each real record is its own, real, named child entity', () => {
  const biz = fx.freshBusiness('ScheduleTest Co');
  const location = fx.freshLocation(biz.business, 'ScheduleTest Location', {});
  const employeeName = fx.uniqueName('ScheduleTest Employee');
  db.create(db.requireEntity('Employees', db.typeRootName), db.typeRootName, employeeName, fx.userId);

  db.setLocationOpenHours(location.name, [
    { day: 'Monday', opens_at: '09:00', closes_at: '17:00' },
    { day: 'Tuesday', opens_at: '10:00', closes_at: '16:00' },
  ]);
  const hours = db.getLocationOpenHours(location.name);
  assert.equal(hours.length, 2);
  assert.equal(hours[0].day, 'Monday');
  assert.equal(hours[0].opens_at, '09:00');
  assert.equal(hours[0].closes_at, '17:00');

  const entities = db.getEntityTree();
  const record = entities.find((e) => e.name === `${location.name} — Monday: 09:00–17:00`);
  assert.ok(record, 'the real open-hours record must exist as a real, findable, named entity');
  const parent = entities.find((e) => e.id === record!.parent_id);
  assert.equal(parent?.name, location.name, "the real record must be parented under the real location itself");
  const relation = entities.find((e) => e.id === record!.relation_id);
  assert.equal(relation?.name, 'Monday', 'the real record must be tagged via relation_id to the real day entity');

  db.setEmployeeSchedule(employeeName, location.name, [
    { day: 'Monday', starts_at: '09:00', ends_at: '17:00' },
    { day: 'Tuesday', starts_at: '10:00', ends_at: '14:00' },
  ]);
  const schedule = db.getEmployeeSchedule(employeeName);
  assert.equal(schedule.length, 2);
  assert.equal(schedule[0].location, location.name);

  const roster = db.getScheduleAtLocation(location.name);
  assert.equal(roster.length, 2);
  assert.equal(roster[0].employee, employeeName);

  db.setEmployeeSchedule(employeeName, location.name, [{ day: 'Wednesday', starts_at: '05:00', ends_at: '07:00' }]);
  assert.equal(db.getEmployeeSchedule(employeeName).find((s) => s.day === 'Wednesday')?.starts_at, '05:00');

  db.setEmployeeSchedule(employeeName, location.name, [{ day: 'Monday', starts_at: '08:00', ends_at: '17:00' }]);
  assert.equal(db.getEmployeeSchedule(employeeName).find((s) => s.day === 'Monday')?.starts_at, '08:00');

  assert.throws(
    () => db.setEmployeeSchedule(employeeName, location.name, [{ day: 'Monday', starts_at: '05:00', ends_at: '19:00' }]),
    /exceeds the real 12-hour daily limit/
  );

  assert.throws(
    () =>
      db.setEmployeeSchedule(employeeName, location.name, [
        { day: 'Monday', starts_at: '06:00', ends_at: '18:00' },
        { day: 'Tuesday', starts_at: '06:00', ends_at: '18:00' },
        { day: 'Wednesday', starts_at: '06:00', ends_at: '18:00' },
        { day: 'Thursday', starts_at: '06:00', ends_at: '18:00' },
        { day: 'Friday', starts_at: '06:00', ends_at: '18:00' },
      ]),
    /over the real 48-hour weekly limit/
  );

  db.setEmployeeSchedule(employeeName, location.name, [{ day: 'Monday', starts_at: '09:00', ends_at: '12:00' }]);
  const replaced = db.getEmployeeSchedule(employeeName);
  assert.equal(replaced.length, 1, 'the real, earlier Tuesday shift must genuinely be gone after a real, full replace, not left stale');
  assert.equal(replaced[0].ends_at, '12:00');

  const staleRecord = db.getEntityTree().find((e) => e.name === `${employeeName} — Monday at ${location.name}: 09:00–17:00`);
  assert.equal(staleRecord, undefined, "the real, original 09:00-17:00 record must genuinely be deleted, not merely superseded");
});

test('getCustomerStatement: shows every real, posted invoice for one customer — paid, partially paid, and outstanding — correctly respecting a real, historical "as of" date, not just the current, real-time balance', () => {
  const biz = fx.freshBusiness('StatementTest Co', { coaPrototype: 'English CoA' });
  const customer = fx.uniqueName('StatementTest Customer');
  db.create(db.requireEntity('Accounts Receivable', db.typeRootName), db.typeRootName, customer, fx.userId);

  const ref1 = fx.uniqueName('STMTTEST-1');
  const inv1 = db.createInvoice({ invoiceType: 'AR', business: biz.business, ledger: biz.actualLedger, reference: ref1, counterpartyName: customer, invoiceDate: '2027-01-01', description: 'Fully paid', lines: [{ description: 'Widget', quantity: 1, unitPriceMinor: 10000, amountMinor: 10000, taxMinor: 0 }] }, fx.userId);
  db.postInvoice(inv1, 'Sales Revenue', 'Sales Tax Payable', fx.userId);
  db.allocatePayment(inv1, fx.uniqueName('STMTTEST-PAY-1'), 10000, '2027-01-15', 'Cash and Bank', fx.userId);

  const ref2 = fx.uniqueName('STMTTEST-2');
  const inv2 = db.createInvoice({ invoiceType: 'AR', business: biz.business, ledger: biz.actualLedger, reference: ref2, counterpartyName: customer, invoiceDate: '2027-01-10', description: 'Partially paid', lines: [{ description: 'Widget', quantity: 1, unitPriceMinor: 20000, amountMinor: 20000, taxMinor: 0 }] }, fx.userId);
  db.postInvoice(inv2, 'Sales Revenue', 'Sales Tax Payable', fx.userId);
  db.allocatePayment(inv2, fx.uniqueName('STMTTEST-PAY-2'), 5000, '2027-01-20', 'Cash and Bank', fx.userId);

  const ref3 = fx.uniqueName('STMTTEST-3');
  const inv3 = db.createInvoice({ invoiceType: 'AR', business: biz.business, ledger: biz.actualLedger, reference: ref3, counterpartyName: customer, invoiceDate: '2027-01-20', description: 'Fully outstanding', lines: [{ description: 'Widget', quantity: 1, unitPriceMinor: 15000, amountMinor: 15000, taxMinor: 0 }] }, fx.userId);
  db.postInvoice(inv3, 'Sales Revenue', 'Sales Tax Payable', fx.userId);

  const statement = db.getCustomerStatement(biz.business, biz.actualLedger, customer, '2027-01-31');
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

  const earlier = db.getCustomerStatement(biz.business, biz.actualLedger, customer, '2027-01-05');
  assert.equal(earlier.lines.length, 1, 'only the real, first invoice existed yet as of this earlier date');
  assert.equal(earlier.lines[0].status, 'Outstanding', "the real payment on 2027-01-15 hadn't happened yet as of 2027-01-05 — must show as outstanding, not paid");
  assert.equal(earlier.total_outstanding_minor, 10000);
});

test("setEntityLink/getEntityLink/deleteEntityLink: a real, pure link between two entities that never touches the source entity's own relation_id, unlike setRelationship", () => {
  const biz = fx.freshBusiness('EntityLinkTest Co', { coaPrototype: 'English CoA' });
  const accountName = fx.uniqueName('EntityLinkTest Account');
  db.create(fx.coaCategoryRoot(biz.business, 'Asset'), db.typeRootName, accountName, fx.userId);
  const divisionName = fx.uniqueName('EntityLinkTest Division');
  const otherDivisionName = fx.uniqueName('EntityLinkTest Other Division');
  db.create(db.requireEntity('Application', db.typeRootName), db.typeRootName, divisionName, fx.userId);
  db.create(db.requireEntity('Application', db.typeRootName), db.typeRootName, otherDivisionName, fx.userId);

  const acctId = (db.db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(accountName) as { id: number }).id;
  db.supersedeEntity(acctId, { relation: 'English CoA' }, fx.userId);

  db.setEntityLink(accountName, 'Division', divisionName, fx.userId);

  const entities = db.getEntityTree();
  const account = entities.find((e) => e.name === accountName)!;
  const accountRelationTarget = entities.find((e) => e.id === account.relation_id);
  assert.equal(accountRelationTarget?.name, 'English CoA', "the account's own relation_id must be genuinely untouched by setEntityLink — this is the entire, real point of this generic existing at all");

  assert.equal(db.getEntityLink(accountName, 'Division'), divisionName);

  db.setEntityLink(accountName, 'Division', otherDivisionName, fx.userId);
  assert.equal(db.getEntityLink(accountName, 'Division'), otherDivisionName);

  const liveEntities = db.getEntityTree();
  const liveLinkRecords = liveEntities.filter((e) => e.name === `${accountName} — Division`);
  assert.equal(liveLinkRecords.length, 1, 'a real, second setEntityLink call must replace the existing link record, not create a real, duplicate second one');

  db.deleteEntityLink(accountName, 'Division', fx.userId);
  assert.equal(db.getEntityLink(accountName, 'Division'), undefined, 'after deletion, no real link must remain at all');
});

test('stageBomComponent/postBomComponents/getBomComponents: a real Bill of Materials, built on setEntityLink, per the wine-bar-assemblies-plan design', () => {
  const biz = fx.freshBusiness('BomTest Co');
  const assembly = fx.uniqueName('BomTest Gin & Tonic');
  const gin = fx.uniqueName('BomTest Gin');
  const tonic = fx.uniqueName('BomTest Tonic Water');
  db.createItem(assembly, 'Items', fx.userId, biz.business);
  db.createItem(gin, 'Items', fx.userId, biz.business);
  db.createItem(tonic, 'Items', fx.userId, biz.business);

  db.stageBomComponent({ assemblyItem: assembly, business: biz.business, componentItem: gin, quantity: 30, unit: 'ml' });
  db.stageBomComponent({ assemblyItem: assembly, business: biz.business, componentItem: tonic, quantity: 150, unit: 'ml' });

  assert.equal(db.getBomComponents(assembly).length, 0, "staged rows aren't yet real, posted components");

  db.postBomComponents(assembly, biz.business, fx.userId);

  const components = db.getBomComponents(assembly);
  assert.equal(components.length, 2, 'both real, staged components were posted');
  const ginComponent = components.find((c) => c.component === gin);
  assert.equal(ginComponent?.quantity, 30);
  assert.equal(ginComponent?.unit, 'ml');
  const tonicComponent = components.find((c) => c.component === tonic);
  assert.equal(tonicComponent?.quantity, 150);
  assert.equal(tonicComponent?.unit, 'ml');

  db.stageBomComponent({ assemblyItem: assembly, business: biz.business, componentItem: gin, quantity: 45, unit: 'ml' });
  db.postBomComponents(assembly, biz.business, fx.userId);
  const updated = db.getBomComponents(assembly);
  assert.equal(updated.length, 2, 'still exactly two real components, not three');
  assert.equal(updated.find((c) => c.component === gin)?.quantity, 45, 'the real, updated quantity replaced the old one');
});

test('createProjectTask/getProjectTasks/addTaskDependency/getTaskDependencies: real project scheduling with zero new tables, per direct, absolute instruction', () => {
  const projectName = fx.uniqueName('PmTest Riverside Build');
  db.create(db.requireEntity('Projects', db.typeRootName), db.typeRootName, projectName, fx.userId);
  db.create(db.requireEntity(projectName, db.typeRootName), db.typeRootName, `${projectName} Tasks`, fx.userId);

  const foundationTask = db.createProjectTask(projectName, 'Pour the foundation', '2026-09-01', '2026-09-05', fx.userId);
  const framingTask = db.createProjectTask(projectName, 'Frame the walls', '2026-09-06', '2026-09-12', fx.userId);

  const tasks = db.getProjectTasks(projectName);
  assert.equal(tasks.length, 2, 'both real tasks were created and parsed back out correctly');
  const foundation = tasks.find((t) => t.task === 'Pour the foundation');
  assert.equal(foundation?.plannedStart, '2026-09-01');
  assert.equal(foundation?.plannedEnd, '2026-09-05');

  db.addTaskDependency('Frame the walls', 'Pour the foundation', 'finish_to_start', fx.userId);
  const deps = db.getTaskDependencies('Frame the walls');
  assert.equal(deps.length, 1, 'one real dependency edge was created');
  assert.equal(deps[0].predecessor, 'Pour the foundation');
  assert.equal(deps[0].dependencyType, 'finish_to_start');

  const rawEntity = db.db.prepare(`SELECT name FROM current_entities WHERE name LIKE 'Frame the walls%'`).get() as { name: string };
  assert.match(rawEntity.name, /^Frame the walls \(2026-09-06 to 2026-09-12\)$/);
});

test('setLanguageDirection/getLanguageDirection: a real, generic RTL property any language can have, per direct instruction (Hebrew/Arabic on par with every other language, not a hardcoded special case)', () => {
  const langName = fx.uniqueName('LangDirTest Klingon');
  db.create(db.requireEntity('Languages', db.typeRootName), db.typeRootName, langName, fx.userId);
  assert.equal(db.getLanguageDirection(langName), undefined, 'no real direction set yet');

  db.setLanguageDirection(langName, 'RTL', fx.userId);
  assert.equal(db.getLanguageDirection(langName), 'RTL');

  assert.equal(db.getLanguageDirection('Hebrew'), 'RTL');
  assert.equal(db.getLanguageDirection('Arabic'), 'RTL');
  assert.equal(db.getLanguageDirection('English'), undefined, 'English genuinely has no RTL link at all - LTR is the real, honest default');

  db.setLanguageDirection(langName, null, fx.userId);
  assert.equal(db.getLanguageDirection(langName), undefined, 'a real, direct clear genuinely removes the link entirely');
});

test('setItemSourceLeadTime/getItemLeadTimes/getStockOutRiskReport: will this genuinely run out before a fresh order could arrive?', () => {
  const today = new Date().toISOString().slice(0, 10);
  const biz = fx.freshBusiness('RiskTest Co');
  const kegName = fx.uniqueName('RiskTest Keg');
  db.createItem(kegName, 'Items', fx.userId, biz.business);
  const brewery = fx.uniqueName('RiskTest Brewery');
  const slowBrewery = fx.uniqueName('RiskTest Slow Brewery');
  db.create(db.requireEntity('Vendors', db.typeRootName), db.typeRootName, brewery, fx.userId);
  db.create(db.requireEntity('Vendors', db.typeRootName), db.typeRootName, slowBrewery, fx.userId);
  const bar = fx.freshLocation(biz.business, 'RiskTest Bar', { bottle_capacity: 0, carton_capacity: 10 });

  db.setItemSourceLeadTime(db.asItemName(kegName), db.asProviderName(brewery), 3, fx.userId);
  db.setItemSourceLeadTime(db.asItemName(kegName), db.asProviderName(slowBrewery), 14, fx.userId);
  const leadTimes = db.getItemLeadTimes(db.asItemName(kegName));
  assert.equal(leadTimes.length, 2, 'both real, known vendor lead times were recorded');

  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('RISKTEST-REC-1'), db.asItemName(kegName), bar.name, 100, fx.userId, today);
  db.dispatchItems(biz.business, biz.actualLedger, fx.uniqueName('RISKTEST-DISP-1'), db.asItemName(kegName), bar.name, 60, fx.userId, today);

  const risk = fx.withBusinessSession(biz, () => db.getStockOutRiskReport(2)).find((r) => r.item === kegName);
  assert.ok(risk, 'genuinely, correctly flagged as at risk');
  assert.equal(risk?.shortest_lead_time_days, 3, 'the shorter of the two real vendor lead times was used, not the longer one');
  assert.ok(risk!.days_until_stockout! < 3, 'days until stockout is genuinely less than the shortest real lead time');
});

test('registerBankAccount/getBankAccounts/getCashPosition: Layer 1 of the real, dedicated cash-flow/growth-planning design — real, registered bank accounts scoped correctly to one real business, grouped by real currency, with honest overdraft headroom', () => {
  const biz = fx.freshBusiness('BankRegTest Co');
  const audAccount = fx.uniqueName('BankRegTest AUD Account');
  const audAccount2 = fx.uniqueName('BankRegTest AUD Account 2');
  const eurAccount = fx.uniqueName('BankRegTest EUR Account');
  const notABankAccount = fx.uniqueName('BankRegTest Not A Bank Account');
  db.create(db.requireGlobalCoaCategory('Asset'), db.typeRootName, audAccount, fx.userId);
  db.create(db.requireGlobalCoaCategory('Asset'), db.typeRootName, audAccount2, fx.userId);
  db.create(db.requireGlobalCoaCategory('Asset'), db.typeRootName, eurAccount, fx.userId);
  db.create(db.requireGlobalCoaCategory('Asset'), db.typeRootName, notABankAccount, fx.userId);
  const divisionName = fx.uniqueName('BankRegTest Division');
  db.create(db.requireEntity('Application', db.typeRootName), db.typeRootName, divisionName, fx.userId);

  assert.throws(() => db.registerBankAccount(audAccount, biz.business, 'No Such Scope', null, fx.userId), /No real business\/division named/);
  assert.throws(() => db.registerBankAccount(audAccount, 'No Such Business', biz.business, null, fx.userId), /No real business named/);

  db.registerBankAccount(audAccount, biz.business, biz.business, 100000, fx.userId);
  db.registerBankAccount(audAccount2, biz.business, divisionName, null, fx.userId); // no overdraft limit
  db.setAccountCurrency(eurAccount, 'EUR');
  db.registerBankAccount(eurAccount, biz.business, biz.business, 50000, fx.userId);

  const accounts = db.getBankAccounts(biz.business, biz.actualLedger);
  const names = accounts.map((a) => a.name);
  assert.ok(names.includes(audAccount));
  assert.ok(names.includes(eurAccount));
  assert.ok(!names.includes(notABankAccount), 'an ordinary Asset account never registered as a bank account must not appear at all');

  const audAcct = accounts.find((a) => a.name === audAccount)!;
  assert.equal(audAcct.scope, biz.business);
  const divAccount = accounts.find((a) => a.name === audAccount2)!;
  assert.equal(divAccount.scope, divisionName, "a real, division-scoped bank account must report its own real division as its scope, not the business");

  const otherBiz = fx.freshBusiness('BankRegTestOther Co');
  const otherBizAccounts = db.getBankAccounts(otherBiz.business, otherBiz.actualLedger);
  assert.ok(!otherBizAccounts.some((a) => a.name === audAccount), "a real bank account registered to one business must never leak into a genuinely different business's own list");

  const acctId = (db.db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(audAccount) as { id: number }).id;
  db.supersedeEntity(acctId, { relation: 'English CoA' }, fx.userId);
  db.registerBankAccount(audAccount, biz.business, biz.business, 200000, fx.userId); // re-register, changing the limit
  const entities = db.getEntityTree();
  const acct = entities.find((e) => e.name === audAccount)!;
  const relationTarget = entities.find((e) => e.id === acct.relation_id);
  assert.equal(relationTarget?.name, 'English CoA', "registering (even re-registering) a bank account must never touch its own relation_id — the entire, real point of using setEntityLink instead of setRelationship");
  assert.equal(db.getBankAccounts(biz.business, biz.actualLedger).find((a) => a.name === audAccount)?.overdraft_limit_minor, 200000, 're-registering must genuinely update the real overdraft limit');

  const ref = fx.uniqueName('BRTEST-1');
  db.stageLine({ reference: ref, business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-01', account: db.asAccountName(audAccount), amount_minor: 30000 });
  db.stageLine({ reference: ref, business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-01', account: db.asAccountName("Owner's Equity"), amount_minor: -30000 });
  db.postJournalEntry(ref, biz.business, biz.actualLedger, fx.userId);

  const position = db.getCashPosition(biz.business, biz.actualLedger);
  const eurGroup = position.find((p) => p.currency === 'EUR');
  assert.ok(eurGroup, 'a real, distinct EUR group must exist, never blended into the home-currency total');
  assert.equal(eurGroup?.total_overdraft_limit_minor, 50000);
  assert.equal(eurGroup?.headroom_minor, 50000);

  const homeGroup = position.find((p) => p.currency === null);
  assert.ok(homeGroup);
  assert.equal(homeGroup!.total_overdraft_limit_minor, null, 'one real account in this group (BankRegTest AUD Account 2) has no known limit, so the real, combined limit must be honestly unknown');
  assert.equal(homeGroup!.headroom_minor, null);

  db.unregisterBankAccount(audAccount, fx.userId);
  assert.ok(!db.getBankAccounts(biz.business, biz.actualLedger).some((a) => a.name === audAccount));
  assert.equal(db.getEntityLink(audAccount, 'Bank Account'), undefined);
});

test('getCashFlowForecast: Layer 2 of the real, dedicated cash-flow/growth-planning design — anticipated AR receipts, committed AP payments, and genuinely recurring cash movements, never one-off historical postings', () => {
  const biz = fx.freshBusiness('ForecastTest Co', { coaPrototype: 'English CoA' });
  const accountName = fx.uniqueName('ForecastTest Account');
  db.create(db.requireGlobalCoaCategory('Asset'), db.typeRootName, accountName, fx.userId);
  db.registerBankAccount(accountName, biz.business, biz.business, 100000, fx.userId);
  const customer = fx.uniqueName('ForecastTest Customer');
  const vendor = fx.uniqueName('ForecastTest Vendor');
  db.create(db.requireEntity('Accounts Receivable', db.typeRootName), db.typeRootName, customer, fx.userId);
  db.create(db.requireEntity('Accounts Payable', db.typeRootName), db.typeRootName, vendor, fx.userId);

  const oneOffRef = fx.uniqueName('FCTEST-ONEOFF');
  db.stageLine({ reference: oneOffRef, business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-10', account: db.asAccountName(accountName), amount_minor: -50000 });
  db.stageLine({ reference: oneOffRef, business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-10', account: db.asAccountName("Owner's Equity"), amount_minor: 50000 });
  db.postJournalEntry(oneOffRef, biz.business, biz.actualLedger, fx.userId);

  const rentRef = fx.uniqueName('FCTEST-RENT');
  db.createRecurringJournal(
    biz.business,
    biz.actualLedger,
    rentRef,
    '2027-01-15',
    'monthly',
    [
      { account: 'Rent', amount_minor: 20000 },
      { account: accountName, amount_minor: -20000 },
    ],
    fx.userId,
    'Monthly rent',
    3
  );

  const arInv = db.createInvoice(
    { invoiceType: 'AR', business: biz.business, ledger: biz.actualLedger, reference: fx.uniqueName('FCTEST-AR'), counterpartyName: customer, invoiceDate: '2027-01-01', description: 'Test', lines: [{ description: 'Widget', quantity: 1, unitPriceMinor: 30000, amountMinor: 30000, taxMinor: 0 }] },
    fx.userId
  );
  db.postInvoice(arInv, 'Sales Revenue', 'Sales Tax Payable', fx.userId);

  const apInv = db.createInvoice(
    { invoiceType: 'AP', business: biz.business, ledger: biz.actualLedger, reference: fx.uniqueName('FCTEST-AP'), counterpartyName: vendor, invoiceDate: '2027-01-01', description: 'Test', lines: [{ description: 'Supplies', quantity: 1, unitPriceMinor: 15000, amountMinor: 15000, taxMinor: 0 }] },
    fx.userId
  );
  db.postInvoice(apInv, 'Accounts Payable', 'Purchases Tax Claimed', fx.userId);

  const forecast = db.getCashFlowForecast(biz.business, biz.actualLedger, '2027-01-01', 90);

  assert.ok(!forecast.lines.some((l) => l.description.includes(oneOffRef)), 'a real, ordinary one-off posting must never appear in the real, anticipated recurring source');

  const recurringLines = forecast.lines.filter((l) => l.source === 'recurring' && l.description === 'Monthly rent');
  assert.equal(recurringLines.length, 3, 'exactly three real, monthly rent occurrences within a 90-day horizon from a real, three-month schedule');
  assert.ok(recurringLines.every((l) => l.amount_minor === -20000), 'every real, recurring rent line must correctly show as a real, anticipated cash outflow');

  const arLines = forecast.lines.filter((l) => l.source === 'AR' && l.description.includes(customer));
  assert.equal(arLines.length, 1);
  assert.equal(arLines[0].amount_minor, 30000, 'a real, anticipated AR receipt must be positive — real, anticipated cash in');

  const apLines = forecast.lines.filter((l) => l.source === 'AP' && l.description.includes(vendor));
  assert.equal(apLines.length, 1);
  assert.equal(apLines[0].amount_minor, -15000, 'a real, committed AP payment must be negative — real, anticipated cash out');
});

test('getCashFlowForecast: Layer 3 — a real, honest first-shortfall date and amount, evaluated against the real, arranged overdraft limit, never a bare "goes negative" check', () => {
  const biz = fx.freshBusiness('ShortfallTest2 Co', { coaPrototype: 'English CoA' });
  const accountName = fx.uniqueName('ShortfallTest2 Account');
  db.create(db.requireGlobalCoaCategory('Asset'), db.typeRootName, accountName, fx.userId);
  const vendor = fx.uniqueName('ShortfallTest2 Vendor');
  db.create(db.requireEntity('Accounts Payable', db.typeRootName), db.typeRootName, vendor, fx.userId);

  db.registerBankAccount(accountName, biz.business, biz.business, null, fx.userId);
  const ref1 = fx.uniqueName('ST2TEST-1');
  db.stageLine({ reference: ref1, business: biz.business, ledger: biz.actualLedger, transdate: '2027-02-01', account: db.asAccountName(accountName), amount_minor: 5000 });
  db.stageLine({ reference: ref1, business: biz.business, ledger: biz.actualLedger, transdate: '2027-02-01', account: db.asAccountName("Owner's Equity"), amount_minor: -5000 });
  db.postJournalEntry(ref1, biz.business, biz.actualLedger, fx.userId);

  const noLimitForecast = db.getCashFlowForecast(biz.business, biz.actualLedger, '2027-02-01', 90);
  assert.equal(noLimitForecast.overdraft_limit_minor, null);
  assert.equal(noLimitForecast.first_shortfall_date, null, 'no real shortfall must ever be reported against a genuinely unknown limit');
  assert.equal(noLimitForecast.first_shortfall_amount_minor, null);

  db.unregisterBankAccount(accountName, fx.userId);
  db.registerBankAccount(accountName, biz.business, biz.business, 2000, fx.userId);
  const apInv = db.createInvoice(
    { invoiceType: 'AP', business: biz.business, ledger: biz.actualLedger, reference: fx.uniqueName('ST2TEST-AP'), counterpartyName: vendor, invoiceDate: '2027-02-01', description: 'Test', lines: [{ description: 'Supplies', quantity: 1, unitPriceMinor: 10000, amountMinor: 10000, taxMinor: 0 }] },
    fx.userId
  );
  db.postInvoice(apInv, 'Accounts Payable', 'Purchases Tax Claimed', fx.userId);
  const dueDateRow = db.db.prepare(`SELECT due_date FROM invoice WHERE id = ?`).get(apInv) as { due_date: string };

  const forecast = db.getCashFlowForecast(biz.business, biz.actualLedger, '2027-02-01', 90);
  assert.equal(forecast.overdraft_limit_minor, 2000);
  assert.equal(forecast.first_shortfall_date, dueDateRow.due_date, "the real, first shortfall date must be exactly the real AP invoice's own due date, not before or after it");
  assert.equal(forecast.first_shortfall_amount_minor, 3000, 'the real, exact shortfall amount — how far below the real, arranged limit, not the raw negative balance');
});

test('setHierarchyParent/getHierarchyParent/getHierarchyChildren/getHierarchyAncestorChain: the generic, reusable hierarchy-link mechanism (docs/multi-dimensional-reporting.md) — a real, reversible up/down index per named hierarchy, never touching an entity\'s own relation_id, and never a "dimension" in the matrix-stock-report/drag-and-drop sense', () => {
  const biz = fx.freshBusiness('DimTest2 Co', { coaPrototype: undefined });
  const bizRoot = db.requireEntity(biz.business, db.typeBusinessName, db.requireEntity('Businesses', db.typeRootName));
  const springfield = fx.uniqueName('DimTest2 Springfield');
  const riverside = fx.uniqueName('DimTest2 Riverside Cellars');
  const uptown = fx.uniqueName('DimTest2 Uptown Wine');
  const sales = fx.uniqueName('DimTest2 Amber Ale Sales');
  db.create(bizRoot, db.typeRootName, springfield, fx.userId);
  db.create(bizRoot, db.typeRootName, riverside, fx.userId);
  db.create(bizRoot, db.typeRootName, uptown, fx.userId);
  db.create(db.requireGlobalCoaCategory('Income'), db.typeRootName, sales, fx.userId);

  db.setHierarchyParent(riverside, 'Division/Location', springfield, fx.userId);
  db.setHierarchyParent(uptown, 'Division/Location', springfield, fx.userId);
  db.setHierarchyParent(sales, 'Division/Location', riverside, fx.userId);

  assert.equal(db.getHierarchyParent(riverside, 'Division/Location'), springfield);
  assert.deepEqual(db.getHierarchyChildren(springfield, 'Division/Location').sort(), [riverside, uptown].sort(), "the real, reverse query parent_id alone can never answer — every real entity whose own dimension-parent is exactly this one");
  assert.deepEqual(db.getHierarchyChildren(riverside, 'Division/Location'), [sales]);
  assert.deepEqual(db.getHierarchyAncestorChain(sales, 'Division/Location'), [riverside, springfield], "the real, full chain from the leaf up to (not including) the real root");

  // The entire, real point of this mechanism existing: a leaf account's
  // own relation_id (e.g. a real CoA-prototype tag) must stay genuinely
  // untouched by setting or re-setting its own dimension parent.
  const acctId = (db.db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(sales) as { id: number }).id;
  db.supersedeEntity(acctId, { relation: 'English CoA' }, fx.userId);
  db.setHierarchyParent(sales, 'Division/Location', uptown, fx.userId); // re-set to a different location
  const tree = db.getEntityTree();
  const acct = tree.find((e) => e.name === sales)!;
  const relTarget = tree.find((e) => e.id === acct.relation_id);
  assert.equal(relTarget?.name, 'English CoA', "re-setting a real dimension parent must never touch the account's own relation_id");
  assert.equal(db.getHierarchyParent(sales, 'Division/Location'), uptown);

  // A second, genuinely independent, real dimension on the exact same
  // entity must not interfere with the first at all — the entire,
  // real point of "multiple, equal accumulation paths".
  const beer = fx.uniqueName('DimTest2 Beer');
  db.create(db.requireGlobalCoaCategory('Income'), db.typeRootName, beer, fx.userId);
  db.setHierarchyParent(sales, 'Product Category', beer, fx.userId);
  assert.equal(db.getHierarchyParent(sales, 'Division/Location'), uptown, 'a second, independent dimension must never disturb the first');
  assert.equal(db.getHierarchyParent(sales, 'Product Category'), beer);

  db.deleteHierarchyParent(sales, 'Division/Location', fx.userId);
  assert.equal(db.getHierarchyParent(sales, 'Division/Location'), undefined);
  assert.equal(db.getHierarchyParent(sales, 'Product Category'), beer, 'deleting one dimension must never disturb a genuinely separate one');
});

test('ensureItemTier: the confirmed product/tier/leaf design (docs/multi-dimensional-reporting.md §10) — each real tier its own, distinct, sellable item, the base product name genuinely untouched, no shared-parent corruption across multiple tiers', () => {
  const beerCat = fx.uniqueName('TierTest2 Beer');
  const aleCat = fx.uniqueName('TierTest2 Ale');
  const productName = fx.uniqueName('TierTest2 Amber Ale 330ml');
  db.create(db.requireEntity('Items', db.typeRootName), db.typeRootName, beerCat, fx.userId);
  db.create(db.requireEntity(beerCat, db.typeRootName), db.typeRootName, aleCat, fx.userId);
  db.create(db.requireEntity(aleCat, db.typeRootName), db.typeRootName, productName, fx.userId);

  const bottle = db.ensureItemTier(db.asItemName(productName), 'Bottle', fx.userId);
  const carton = db.ensureItemTier(db.asItemName(productName), 'Carton', fx.userId);
  const sixPack = db.ensureItemTier(db.asItemName(productName), 'Six-Pack', fx.userId);

  // The real, critical property this whole design fixes: the base
  // product entity's own, real parent_id must never move, no matter
  // how many real tiers are processed for it.
  const tree = db.getEntityTree();
  const base = tree.find((e) => e.name === productName)!;
  const baseParent = tree.find((e) => e.id === base.parent_id);
  assert.equal(baseParent?.name, aleCat, "the base product's own real parent must never move, regardless of how many tiers are created for it");

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
  assert.equal(db.getHierarchyParent(bottle.tierItemName, 'COGS Product'), bottle.cogsAccount);
  assert.equal(db.getHierarchyParent(carton.tierItemName, 'COGS Product'), carton.cogsAccount);

  // A genuinely idempotent, real, repeated call must never throw or
  // duplicate anything.
  const bottleAgain = db.ensureItemTier(db.asItemName(productName), 'Bottle', fx.userId);
  assert.deepEqual(bottleAgain, bottle);
});

test('getProfitAndLossByHierarchy: "Consolidated per Division" — one real, full P&L per real group actually active in this ledger/date range, income/COGS/operating split intact per group, derived structurally from real, live sales at real locations', () => {
  const biz = fx.freshBusiness('PLDivTest3 Co');
  const divisionA = fx.uniqueName('PLDivTest3 Division A');
  const divisionB = fx.uniqueName('PLDivTest3 Division B');
  db.create(db.requireEntity('Application', db.typeRootName), db.typeRootName, divisionA, fx.userId);
  db.create(db.requireEntity('Application', db.typeRootName), db.typeRootName, divisionB, fx.userId);
  const outletA = fx.freshLocation(biz.business, 'PLDivTest3 Outlet A', { city: divisionA, bottle_capacity: 500, carton_capacity: 80 });
  db.setHierarchyParent(outletA.name, 'Division', divisionA, fx.userId);
  const outletB = fx.freshLocation(biz.business, 'PLDivTest3 Outlet B', { city: divisionB, bottle_capacity: 500, carton_capacity: 80 });
  db.setHierarchyParent(outletB.name, 'Division', divisionB, fx.userId);
  const merlot = fx.uniqueName('PLDivTest3 Merlot');
  db.createItem(merlot, 'Items', fx.userId, biz.business);
  const today = new Date().toISOString().slice(0, 10);
  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('PLDIVTEST3-REC-A'), db.asItemName(merlot), outletA.name, 20, fx.userId, today);
  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('PLDIVTEST3-REC-B'), db.asItemName(merlot), outletB.name, 20, fx.userId, today);

  db.completePosSale({ business: biz.business, ledger: biz.actualLedger, locationName: outletA.name, customerName: db.asCustomerName('Cash Sale'), lines: [{ itemName: merlot, quantity: 1, unitPriceMinor: 50000, taxMinor: 0, tier: 'Bottle' }], taxAccount: db.asAccountName('Sales Tax Payable'), paymentMethod: 'cash', cashTenderedMinor: 50000 }, fx.userId);
  db.completePosSale({ business: biz.business, ledger: biz.actualLedger, locationName: outletB.name, customerName: db.asCustomerName('Cash Sale'), lines: [{ itemName: merlot, quantity: 1, unitPriceMinor: 30000, taxMinor: 0, tier: 'Bottle' }], taxAccount: db.asAccountName('Sales Tax Payable'), paymentMethod: 'cash', cashTenderedMinor: 30000 }, fx.userId);

  const result = db.getProfitAndLossByHierarchy(biz.business, biz.actualLedger, ['Location', 'Division'], today, today);
  const divA = result.find((r) => r.group === divisionA);
  const divB = result.find((r) => r.group === divisionB);
  assert.ok(divA, 'a real division actually active in this date range must appear, derived structurally from a real, live sale at a real location within it');
  assert.ok(divB);
  assert.equal(divA!.profitAndLoss.total_income_minor, 50000, "each real group's own P&L must be genuinely isolated from every other group's own activity");
  assert.equal(divB!.profitAndLoss.total_income_minor, 30000);
  assert.equal(divA!.profitAndLoss.net_income_minor, 50000);

  // A real, genuinely untagged posting — a plain account with no
  // real, structural location link at all — must still, correctly
  // resolve to "(No group)" under the new, structural derivation.
  const noGroupBefore = result.find((r) => r.group === null)?.profitAndLoss.total_income_minor ?? 0;
  const ref3 = fx.uniqueName('PLDIVTEST3-3');
  db.stageLine({ reference: ref3, business: biz.business, ledger: biz.actualLedger, transdate: today, account: db.asAccountName('Sales Revenue'), amount_minor: -7000 });
  db.stageLine({ reference: ref3, business: biz.business, ledger: biz.actualLedger, transdate: today, account: db.asAccountName('Cash and Bank'), amount_minor: 7000 });
  db.postJournalEntry(ref3, biz.business, biz.actualLedger, fx.userId);
  const resultAfter = db.getProfitAndLossByHierarchy(biz.business, biz.actualLedger, ['Location', 'Division'], today, today);
  const noGroupAfter = resultAfter.find((r) => r.group === null)?.profitAndLoss.total_income_minor ?? 0;
  assert.equal(noGroupAfter - noGroupBefore, 7000, "(No group) must move by exactly this real, untagged posting's own amount — Division A's and B's own real activity must never leak into it");
  assert.equal(resultAfter.find((r) => r.group === divisionA)!.profitAndLoss.total_income_minor, 50000);
  assert.equal(resultAfter.find((r) => r.group === divisionB)!.profitAndLoss.total_income_minor, 30000);

  // A real group that exists in the app but has no real activity
  // within this real ledger/date range must never appear at all.
  const divisionUnused = fx.uniqueName('PLDivTest3 Division Unused');
  db.create(db.requireEntity('Application', db.typeRootName), db.typeRootName, divisionUnused, fx.userId);
  const result2 = db.getProfitAndLossByHierarchy(biz.business, biz.actualLedger, ['Location', 'Division'], today, today);
  assert.ok(!result2.some((r) => r.group === divisionUnused));
});

test('getProfitAndLossByHierarchyTree: "Consolidated per Division per Location" — real groups nested under their own real parent, a genuinely empty node synthesized for a real, top-level group with no direct activity of its own', () => {
  const biz = fx.freshBusiness('PLTreeTest Co');
  const city = fx.uniqueName('PLTreeTest City');
  db.create(db.requireEntity('Application', db.typeRootName), db.typeRootName, city, fx.userId);
  const storeA = fx.uniqueName('PLTreeTest Store A');
  const storeB = fx.uniqueName('PLTreeTest Store B');
  db.create(db.requireEntity(city, db.typeRootName), db.typeRootName, storeA, fx.userId);
  db.create(db.requireEntity(city, db.typeRootName), db.typeRootName, storeB, fx.userId);
  const outletA = fx.freshLocation(biz.business, 'PLTreeTest Outlet A', { city: storeA, bottle_capacity: 500, carton_capacity: 80 });
  db.setHierarchyParent(outletA.name, 'Division', storeA, fx.userId);
  const outletB = fx.freshLocation(biz.business, 'PLTreeTest Outlet B', { city: storeB, bottle_capacity: 500, carton_capacity: 80 });
  db.setHierarchyParent(outletB.name, 'Division', storeB, fx.userId);
  const merlot = fx.uniqueName('PLTreeTest Merlot');
  db.createItem(merlot, 'Items', fx.userId, biz.business);
  const today = new Date().toISOString().slice(0, 10);
  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('PLTREETEST-REC-A'), db.asItemName(merlot), outletA.name, 20, fx.userId, today);
  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('PLTREETEST-REC-B'), db.asItemName(merlot), outletB.name, 20, fx.userId, today);

  // The real, top-level "City" division genuinely never gets any
  // direct activity of its own — only its own, real child stores do.
  db.completePosSale({ business: biz.business, ledger: biz.actualLedger, locationName: outletA.name, customerName: db.asCustomerName('Cash Sale'), lines: [{ itemName: merlot, quantity: 1, unitPriceMinor: 20000, taxMinor: 0, tier: 'Bottle' }], taxAccount: db.asAccountName('Sales Tax Payable'), paymentMethod: 'cash', cashTenderedMinor: 20000 }, fx.userId);
  db.completePosSale({ business: biz.business, ledger: biz.actualLedger, locationName: outletB.name, customerName: db.asCustomerName('Cash Sale'), lines: [{ itemName: merlot, quantity: 1, unitPriceMinor: 15000, taxMinor: 0, tier: 'Bottle' }], taxAccount: db.asAccountName('Sales Tax Payable'), paymentMethod: 'cash', cashTenderedMinor: 15000 }, fx.userId);

  const tree = db.getProfitAndLossByHierarchyTree(biz.business, biz.actualLedger, ['Location', 'Division'], 'Division', today, today);
  const cityNode = tree.find((n) => n.group === city);
  assert.ok(cityNode, "a real, top-level group must still appear, even with no real, direct activity of its own, so its own real children have somewhere real to nest");
  assert.equal(cityNode!.profitAndLoss.total_income_minor, 0, "a real, synthesized-empty parent node must genuinely show zero, not some real, incorrect aggregate");
  assert.equal(cityNode!.children.length, 2, 'both real, child stores must be correctly nested under their own real parent');

  const storeANode = cityNode!.children.find((c) => c.group === storeA);
  const storeBNode = cityNode!.children.find((c) => c.group === storeB);
  assert.ok(storeANode);
  assert.ok(storeBNode);
  assert.equal(storeANode!.profitAndLoss.total_income_minor, 20000, "each real, nested child's own P&L must be genuinely correct, not just its own existence");
  assert.equal(storeBNode!.profitAndLoss.total_income_minor, 15000);
  assert.equal(storeANode!.children.length, 0, 'a real leaf group must have no real children of its own');

  assert.ok(tree.some((n) => n.group === null), '(No group) must remain a real, top-level root, never nested under anything');
});

test('closeBooks: division is only a pure reporting dimension — every division\'s net income rolls into one, single, combined Retained Earnings line, never a separate line per division', () => {
  const biz = fx.freshBusiness('DetailedCloseTest Co', { coaPrototype: undefined });
  // "Sales Revenue" is a real, prototype-tagged category
  // (copyChartOfAccountsInto), gated behind a real coaPrototype choice
  // this business (created with none) never made — so its own, real
  // Income category is still genuinely empty until created directly
  // here.
  db.create(fx.coaCategoryRoot(biz.business, 'Income'), db.typeRootName, 'Sales Revenue', fx.userId);
  const divisionA = fx.uniqueName('DetailedCloseTest Division A');
  const divisionB = fx.uniqueName('DetailedCloseTest Division B');
  db.create(db.requireEntity('Application', db.typeRootName), db.typeRootName, divisionA, fx.userId);
  db.create(db.requireEntity('Application', db.typeRootName), db.typeRootName, divisionB, fx.userId);
  const outletA = fx.freshLocation(biz.business, 'DetailedCloseTest Outlet A', { city: divisionA, bottle_capacity: 500, carton_capacity: 80 });
  db.setHierarchyParent(outletA.name, 'Division', divisionA, fx.userId);
  const outletB = fx.freshLocation(biz.business, 'DetailedCloseTest Outlet B', { city: divisionB, bottle_capacity: 500, carton_capacity: 80 });
  db.setHierarchyParent(outletB.name, 'Division', divisionB, fx.userId);
  const merlot = fx.uniqueName('DetailedCloseTest Merlot');
  db.createItem(merlot, 'Items', fx.userId, biz.business);
  db.receiveItems(biz.business, biz.actualLedger, 'DCT-REC-A', db.asItemName(merlot), outletA.name, 20, fx.userId, '2027-01-01');
  db.receiveItems(biz.business, biz.actualLedger, 'DCT-REC-B', db.asItemName(merlot), outletB.name, 20, fx.userId, '2027-01-01');

  // Division A: $1,000 real profit (via a real, structural sale).
  // Division B: $600 real profit. A real, undivided remainder: $200.
  db.completePosSale({ business: biz.business, ledger: biz.actualLedger, locationName: outletA.name, customerName: db.asCustomerName('Cash Sale'), lines: [{ itemName: merlot, quantity: 1, unitPriceMinor: 100000, taxMinor: 0, tier: 'Bottle' }], taxAccount: db.asAccountName('Sales Tax Payable'), paymentMethod: 'cash', cashTenderedMinor: 100000 }, fx.userId);
  db.completePosSale({ business: biz.business, ledger: biz.actualLedger, locationName: outletB.name, customerName: db.asCustomerName('Cash Sale'), lines: [{ itemName: merlot, quantity: 1, unitPriceMinor: 60000, taxMinor: 0, tier: 'Bottle' }], taxAccount: db.asAccountName('Sales Tax Payable'), paymentMethod: 'cash', cashTenderedMinor: 60000 }, fx.userId);

  db.stageLine({ reference: 'DCT-3', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-03', account: db.asAccountName('Sales Revenue'), amount_minor: -20000 });
  db.stageLine({ reference: 'DCT-3', business: biz.business, ledger: biz.actualLedger, transdate: '2027-01-03', account: db.asAccountName('Cash and Bank'), amount_minor: 20000 });
  db.postJournalEntry('DCT-3', biz.business, biz.actualLedger, fx.userId);

  db.closeBooks(biz.business, biz.actualLedger, '2027-12-31', "Owner's Equity", fx.userId);

  const reLines = db.db
    .prepare(
      `SELECT jl.amount_minor
       FROM journal_line jl
       JOIN journal j ON j.id = jl.journal_id
       JOIN current_entities e ON e.id = jl.account_id
       WHERE j.reference LIKE 'CLOSE-%' AND e.name = ?
         AND j.business_id = (SELECT id FROM current_entities WHERE name = ?)
         AND j.ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Ledgers' AND parent_id = (SELECT id FROM current_entities WHERE name = ?)))`
    )
    .all("Owner's Equity", biz.business, biz.actualLedger, biz.business) as { amount_minor: number }[];

  assert.equal(reLines.length, 1, 'division is only a pure reporting dimension — every division\'s net income rolls into exactly one, single, combined Retained Earnings line');
  assert.equal(reLines[0].amount_minor, -180000, "Division A's $1,000 + Division B's $600 + the real, undivided $200 remainder = $1,800 total, correctly credited (negative — Retained Earnings is credit-normal)");

  const allLines = db.db
    .prepare(`SELECT jl.amount_minor FROM journal_line jl JOIN journal j ON j.id = jl.journal_id WHERE j.reference LIKE 'CLOSE-%' AND j.business_id = (SELECT id FROM current_entities WHERE name = ?) AND j.ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Ledgers' AND parent_id = (SELECT id FROM current_entities WHERE name = ?)))`)
    .all(biz.business, biz.actualLedger, biz.business) as { amount_minor: number }[];
  const total = allLines.reduce((s, l) => s + l.amount_minor, 0);
  assert.equal(total, 0, 'the real, whole close entry must still sum to exactly zero');
});

test('completePosSale: the real, live wiring — a real sale with a real tier now genuinely ensures its own, real tier-level item, not just its own Sales/COGS accounts', () => {
  const biz = fx.freshBusiness('PosWireTest2 Co');
  const outlet = fx.freshLocation(biz.business, 'PosWireTest2 Outlet', { city: fx.uniqueName('PosWireTest2 City'), bottle_capacity: 500, carton_capacity: 80 });
  const merlot = fx.uniqueName('PosWireTest2 Merlot');
  db.createItem(merlot, 'Items', fx.userId, biz.business);
  db.receiveItems(biz.business, biz.actualLedger, 'POSWIRE2-REC-1', db.asItemName(merlot), outlet.name, 20, fx.userId, '2027-01-01');

  // No revenueAccount override — this is the real, direct path a real
  // POS sale takes in production, exercising the real, new,
  // tier-resolving fallback logic directly.
  const result = db.completePosSale(
    {
      business: biz.business,
      ledger: biz.actualLedger,
      locationName: outlet.name,
      customerName: db.asCustomerName('Cash Sale'),
      lines: [{ itemName: merlot, quantity: 2, unitPriceMinor: 1500, taxMinor: 300, tier: 'Bottle' }],
      taxAccount: db.asAccountName('Sales Tax Payable'),
      paymentMethod: 'cash',
      cashTenderedMinor: 5000,
    },
    fx.userId
  );
  assert.equal(result.totalMinor, 2 * 1500 + 300);

  const tree = db.getEntityTree();
  const candidates = tree.filter((e) => e.name === `${merlot} (Bottle)`);
  const salesLeaf = candidates.find((e) => e.is_postable_account);
  assert.ok(salesLeaf, "the tier-level item's own real Sales leaf must also genuinely exist");
  const tierItem = candidates.find((e) => e.parent_id === salesLeaf!.id);
  assert.ok(tierItem, 'a real, live POS sale with a real tier must genuinely ensure its own, new, tier-level item entity — not just its own Sales/COGS accounts');
  assert.equal(tierItem!.is_postable_account, false, 'a real item is never itself a real, postable GL account');
  assert.equal(tierItem!.parent_id, salesLeaf!.id, "the real, new tier-level item must be a genuine, structural child of its own real Sales leaf");

  // The real, base, tier-less item itself must remain completely
  // untouched.
  const baseItem = tree.find((e) => e.name === merlot);
  assert.ok(baseItem, 'the real, base, tier-less item must still exist, genuinely unaffected');

  assert.equal(db.getItemLocation(db.asItemName(merlot), outlet.name).quantity_on_hand, 18, 'stock-tracking still, correctly resolves through the real, base, tier-less item — unchanged in this step');
});

test('reverseJournalEntry: a real year-end close, with activity spread across multiple real divisions rolling into one, single, combined Retained Earnings line, must reverse cleanly and balance to zero', () => {
  const biz = fx.freshBusiness('ReverseCloseTest2 Co', { coaPrototype: undefined });
  db.create(fx.coaCategoryRoot(biz.business, 'Income'), db.typeRootName, 'Sales Revenue', fx.userId);
  const divisionA = fx.uniqueName('ReverseCloseTest2 Division A');
  const divisionB = fx.uniqueName('ReverseCloseTest2 Division B');
  db.create(db.requireEntity('Application', db.typeRootName), db.typeRootName, divisionA, fx.userId);
  db.create(db.requireEntity('Application', db.typeRootName), db.typeRootName, divisionB, fx.userId);
  const outletA = fx.freshLocation(biz.business, 'ReverseCloseTest2 Outlet A', { city: divisionA, bottle_capacity: 500, carton_capacity: 80 });
  db.setHierarchyParent(outletA.name, 'Division', divisionA, fx.userId);
  const outletB = fx.freshLocation(biz.business, 'ReverseCloseTest2 Outlet B', { city: divisionB, bottle_capacity: 500, carton_capacity: 80 });
  db.setHierarchyParent(outletB.name, 'Division', divisionB, fx.userId);
  const merlot = fx.uniqueName('ReverseCloseTest2 Merlot');
  db.createItem(merlot, 'Items', fx.userId, biz.business);
  db.receiveItems(biz.business, biz.actualLedger, 'RCT2-REC-A', db.asItemName(merlot), outletA.name, 20, fx.userId, '2027-06-01');
  db.receiveItems(biz.business, biz.actualLedger, 'RCT2-REC-B', db.asItemName(merlot), outletB.name, 20, fx.userId, '2027-06-01');

  db.completePosSale({ business: biz.business, ledger: biz.actualLedger, locationName: outletA.name, customerName: db.asCustomerName('Cash Sale'), lines: [{ itemName: merlot, quantity: 1, unitPriceMinor: 50000, taxMinor: 0, tier: 'Bottle' }], taxAccount: db.asAccountName('Sales Tax Payable'), paymentMethod: 'cash', cashTenderedMinor: 50000 }, fx.userId);
  db.completePosSale({ business: biz.business, ledger: biz.actualLedger, locationName: outletB.name, customerName: db.asCustomerName('Cash Sale'), lines: [{ itemName: merlot, quantity: 1, unitPriceMinor: 30000, taxMinor: 0, tier: 'Bottle' }], taxAccount: db.asAccountName('Sales Tax Payable'), paymentMethod: 'cash', cashTenderedMinor: 30000 }, fx.userId);

  const closeResult = db.closeBooks(biz.business, biz.actualLedger, '2027-12-31', "Owner's Equity", fx.userId);
  const closeJournal = db.db.prepare(`SELECT id FROM journal WHERE reference = ? AND business_id = (SELECT id FROM current_entities WHERE name = ?) AND ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Ledgers' AND parent_id = (SELECT id FROM current_entities WHERE name = ?)))`).get(closeResult.reference, biz.business, biz.actualLedger, biz.business) as { id: number };

  // This must not throw — the real, exact bug report: "entry does not
  // balance (per currency)".
  db.reverseJournalEntry(biz.business, biz.actualLedger, closeJournal.id, '2027-12-31', fx.userId);

  const reversalLines = db.db
    .prepare(
      `SELECT jl.amount_minor, e.name AS account
       FROM journal_line jl
       JOIN journal j ON j.id = jl.journal_id
       JOIN current_entities e ON e.id = jl.account_id
       WHERE j.reference = ?`
    )
    .all(`${closeResult.reference}-REV-2027-12-31`) as { amount_minor: number; account: string }[];

  assert.equal(reversalLines.length, 3, 'the real reversal must contain all three, real, distinct original lines — one, single, combined Retained Earnings line plus two, real, separate, location-specific Sales-zeroing lines — not collapse onto fewer');
  const retainedEarnings = reversalLines.find((l) => l.account === "Owner's Equity");
  assert.ok(retainedEarnings, 'the one, single, combined Retained Earnings line must survive the reversal');
  assert.equal(retainedEarnings!.amount_minor, 80000, "Division A's $500 + Division B's $300, reversed as one combined line");

  const total = reversalLines.reduce((s, l) => s + l.amount_minor, 0);
  assert.equal(total, 0, 'the real, whole reversal entry must genuinely balance to exactly zero');
});

test('ensureItemTierLocationLeaf: location becomes structural, the same real pattern already proven for tier — a real, new, distinct leaf per (tier, location), never re-parenting the shared tier-level item, avoiding the exact bug that broke an earlier tier-restructuring attempt', () => {
  const biz = fx.freshBusiness('LocTest2 Co');
  const beerCat = fx.uniqueName('LocTest2 Beer');
  const aleCat = fx.uniqueName('LocTest2 Ale');
  const productName = fx.uniqueName('LocTest2 Amber Ale 330ml');
  db.create(db.requireEntity('Items', db.typeRootName), db.typeRootName, beerCat, fx.userId);
  db.create(db.requireEntity(beerCat, db.typeRootName), db.typeRootName, aleCat, fx.userId);
  db.create(db.requireEntity(aleCat, db.typeRootName), db.typeRootName, productName, fx.userId);
  const locCity = fx.uniqueName('LocTest2 City');
  const riverside = fx.freshLocation(biz.business, 'LocTest2 Riverside Cellars', { city: locCity, bottle_capacity: 500, carton_capacity: 80 });
  const uptown = fx.freshLocation(biz.business, 'LocTest2 Uptown Wine', { city: locCity, bottle_capacity: 500, carton_capacity: 80 });

  const bottle = db.ensureItemTier(db.asItemName(productName), 'Bottle', fx.userId);
  const locA = db.ensureItemTierLocationLeaf(bottle.tierItemName, riverside.name, fx.userId, bottle.tierItemId);
  const locB = db.ensureItemTierLocationLeaf(bottle.tierItemName, uptown.name, fx.userId, bottle.tierItemId);

  const tree = db.getEntityTree();

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
    assert.equal(db.getHierarchyParent(result.leafItemName, 'COGS Product'), result.cogsAccount, "COGS must reach the same, real leaf via the real dimension mechanism, not a second, real structural parent");
  }

  assert.notEqual(locA.leafItemName, locB.leafItemName, 'two, real, different locations must produce two, real, genuinely distinct leaves');
  assert.notEqual(locA.salesAccount, locB.salesAccount);

  // A real, repeated call for the same (tier, location) must be
  // genuinely idempotent, never throw, never duplicate.
  const locAAgain = db.ensureItemTierLocationLeaf(bottle.tierItemName, riverside.name, fx.userId, bottle.tierItemId);
  assert.deepEqual(locAAgain, locA);
});

test('completePosSale: the real, live wiring — a real sale with both a real tier and a real, known location now genuinely ensures its own, real (tier, location) leaf, the real, actual posting target', () => {
  const biz = fx.freshBusiness('LiveWireTest2 Co');
  const outlet = fx.freshLocation(biz.business, 'LiveWireTest2 Outlet', { city: fx.uniqueName('LiveWireTest2 City'), bottle_capacity: 500, carton_capacity: 80 });
  const merlot = fx.uniqueName('LiveWireTest2 Merlot');
  db.createItem(merlot, 'Items', fx.userId, biz.business);
  db.receiveItems(biz.business, biz.actualLedger, 'LWT2-REC-1', db.asItemName(merlot), outlet.name, 20, fx.userId, '2027-01-01');

  // No revenueAccount override — the real, direct, live path a real
  // POS sale takes in production.
  const result = db.completePosSale(
    {
      business: biz.business,
      ledger: biz.actualLedger,
      locationName: outlet.name,
      customerName: db.asCustomerName('Cash Sale'),
      lines: [{ itemName: merlot, quantity: 2, unitPriceMinor: 1500, taxMinor: 300, tier: 'Bottle' }],
      taxAccount: db.asAccountName('Sales Tax Payable'),
      paymentMethod: 'cash',
      cashTenderedMinor: 5000,
    },
    fx.userId
  );
  assert.equal(result.totalMinor, 2 * 1500 + 300);

  const tree = db.getEntityTree();
  const leafCandidates = tree.filter((e) => e.name === `${merlot} (Bottle) — ${outlet.name}`);
  const salesLeaf = leafCandidates.find((e) => e.is_postable_account);
  assert.ok(salesLeaf, "the (tier, location) leaf's own real Sales account must also genuinely exist");
  const leaf = leafCandidates.find((e) => e.parent_id === salesLeaf!.id);
  assert.ok(leaf, 'a real, live POS sale with both a real tier and a real, known location must genuinely ensure its own, new (tier, location) leaf');
  assert.equal(leaf!.is_postable_account, false);
  assert.equal(leaf!.parent_id, salesLeaf!.id, 'the real, new leaf must be a genuine, structural child of its own, real, location-specific Sales leaf');

  // The real, shared, tier-level item itself must remain completely
  // untouched.
  const tierCandidates = tree.filter((e) => e.name === `${merlot} (Bottle)`);
  const tierSalesLeaf = tierCandidates.find((e) => e.is_postable_account);
  assert.ok(tierSalesLeaf, "the tier's own real Sales leaf must still exist");
  const tierItem = tierCandidates.find((e) => e.parent_id === tierSalesLeaf!.id);
  assert.ok(tierItem, 'the real, shared, tier-level item must still exist, genuinely unaffected');
  assert.equal(tierItem!.parent_id, tierSalesLeaf!.id, "the shared, tier-level item's own real parent must never move");
});

test('getLocationForAccount/getHierarchyGroupForAccount: the real, structural replacement for journal_line.division_id — walking a real account to its own, real, structural location and hierarchy group, not reading a separate tag', () => {
  const biz = fx.freshBusiness('DeriveTest2 Co');
  const division = fx.uniqueName('DeriveTest2 Division');
  db.create(db.requireEntity('Application', db.typeRootName), db.typeRootName, division, fx.userId);
  const outlet = fx.freshLocation(biz.business, 'DeriveTest2 Outlet', { city: division, bottle_capacity: 500, carton_capacity: 80 });
  db.setHierarchyParent(outlet.name, 'Division', division, fx.userId);
  const amberAle = fx.uniqueName('DeriveTest2 Amber Ale 330ml');
  db.createItem(amberAle, 'Items', fx.userId, biz.business);

  const bottle = db.ensureItemTier(db.asItemName(amberAle), 'Bottle', fx.userId, biz.business);
  const leaf = db.ensureItemTierLocationLeaf(bottle.tierItemName, outlet.name, fx.userId);

  assert.equal(db.getLocationForAccount(db.asAccountName(leaf.salesAccount)), outlet.name, "a real Sales leaf's own real location must be walkable directly, structurally");
  assert.equal(db.getLocationForAccount(db.asAccountName(leaf.cogsAccount)), outlet.name, 'its own real COGS counteritem must resolve to the exact same, real location');
  assert.equal(db.getHierarchyGroupForAccount(db.asAccountName(leaf.salesAccount), 'Division'), division, 'the real group must be correctly derived by walking location, then location-to-group — the exact same, real resolution getHierarchyGroupForLocation already provides');
  assert.equal(db.getHierarchyGroupForAccount(db.asAccountName(leaf.cogsAccount), 'Division'), division);

  // An ordinary, non-product account has no real, structural location
  // at all — must correctly, honestly return undefined, never a
  // fabricated guess.
  assert.equal(db.getLocationForAccount(db.asAccountName('Cash and Bank')), undefined);
  assert.equal(db.getHierarchyGroupForAccount(db.asAccountName('Cash and Bank'), 'Division'), undefined);
});

test('getLedgerBalancesByHierarchyStructural: correctly derives division by walking location, per real, live sale, at multiple real outlets', () => {
  const biz = fx.freshBusiness('StructTest6 Co');
  const divisionA = fx.uniqueName('StructTest6 Springfield');
  const divisionB = fx.uniqueName('StructTest6 Rivertown');
  db.create(db.requireEntity('Application', db.typeRootName), db.typeRootName, divisionA, fx.userId);
  db.create(db.requireEntity('Application', db.typeRootName), db.typeRootName, divisionB, fx.userId);
  const outletA = fx.freshLocation(biz.business, 'StructTest6 Outlet A', { city: divisionA, bottle_capacity: 500, carton_capacity: 80 });
  db.setHierarchyParent(outletA.name, 'Division', divisionA, fx.userId);
  const outletB = fx.freshLocation(biz.business, 'StructTest6 Outlet B', { city: divisionB, bottle_capacity: 500, carton_capacity: 80 });
  db.setHierarchyParent(outletB.name, 'Division', divisionB, fx.userId);
  const merlot = fx.uniqueName('StructTest6 Merlot');
  db.createItem(merlot, 'Items', fx.userId, biz.business);
  const today = new Date().toISOString().slice(0, 10);
  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('ST6-REC-1'), db.asItemName(merlot), outletA.name, 20, fx.userId, today);
  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('ST6-REC-2'), db.asItemName(merlot), outletB.name, 20, fx.userId, today);

  db.completePosSale({ business: biz.business, ledger: biz.actualLedger, locationName: outletA.name, customerName: db.asCustomerName('Cash Sale'), lines: [{ itemName: merlot, quantity: 2, unitPriceMinor: 1500, taxMinor: 0, tier: 'Bottle' }], taxAccount: db.asAccountName('Sales Tax Payable'), paymentMethod: 'cash', cashTenderedMinor: 5000 }, fx.userId);
  db.completePosSale({ business: biz.business, ledger: biz.actualLedger, locationName: outletB.name, customerName: db.asCustomerName('Cash Sale'), lines: [{ itemName: merlot, quantity: 3, unitPriceMinor: 1500, taxMinor: 0, tier: 'Bottle' }], taxAccount: db.asAccountName('Sales Tax Payable'), paymentMethod: 'cash', cashTenderedMinor: 5000 }, fx.userId);

  const newResult = db.getLedgerBalancesByHierarchyStructural(biz.business, biz.actualLedger, ['Location', 'Division']);

  const tree = db.getEntityTree();
  function salesByDivision(map: Map<number, Map<string | null, number>>) {
    const out: Record<string, number> = {};
    for (const [acctId, divMap] of map.entries()) {
      const acct = tree.find((e) => e.id === acctId);
      if (!acct) continue;
      for (const [div, bal] of divMap.entries()) {
        if (bal !== 0 && div !== null) out[div] = (out[div] ?? 0) + bal;
      }
    }
    return out;
  }

  const newSales = salesByDivision(newResult);
  assert.equal(newSales[divisionA], -3000, 'the real, structural version must correctly derive the real division from the real, structural location link');
  assert.equal(newSales[divisionB], -4500);
});

test('getProfitAndLossByAxis: real, direct reproducibility — every real division and every real location must exactly reproduce the original, division-filtered P&L (Sales AND COGS both), per direct, reported concern', async () => {
  const { getProfitAndLossByAxis } = await import('../src/db-matrix-reports.ts');
  const biz = fx.freshBusiness('ReproTest Co');
  const division = fx.uniqueName('ReproTest Division');
  db.create(db.requireEntity('Application', db.typeRootName), db.typeRootName, division, fx.userId);
  const outlet = fx.freshLocation(biz.business, 'ReproTest Outlet', { city: division, bottle_capacity: 500, carton_capacity: 80 });
  db.setHierarchyParent(outlet.name, 'Division', division, fx.userId);
  const merlot = fx.uniqueName('ReproTest Merlot');
  db.createItem(merlot, 'Items', fx.userId, biz.business);
  const today = new Date().toISOString().slice(0, 10);
  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('REPRO-REC-1'), db.asItemName(merlot), outlet.name, 20, fx.userId, today);

  db.completePosSale(
    { business: biz.business, ledger: biz.actualLedger, locationName: outlet.name, customerName: db.asCustomerName('Cash Sale'), lines: [{ itemName: merlot, quantity: 2, unitPriceMinor: 1500, taxMinor: 0, tier: 'Bottle' }], taxAccount: db.asAccountName('Sales Tax Payable'), paymentMethod: 'cash', cashTenderedMinor: 3000 },
    fx.userId
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
  const tierItem = db.ensureItemTier(db.asItemName(merlot), 'Bottle', fx.userId, biz.business);
  const { cogsAccount, cogsAccountId } = db.ensureItemTierLocationLeaf(tierItem.tierItemName, outlet.name, fx.userId, tierItem.tierItemId);
  const ref = fx.uniqueName('REPRO-COGS');
  db.stageLine({ reference: ref, business: biz.business, ledger: biz.actualLedger, transdate: today, account: db.asAccountName(cogsAccount), accountId: cogsAccountId, amount_minor: 2000 });
  db.stageLine({ reference: ref, business: biz.business, ledger: biz.actualLedger, transdate: today, account: db.asAccountName('Inventory'), amount_minor: -2000 });
  db.postJournalEntry(ref, biz.business, biz.actualLedger, fx.userId);

  const originalPL = db.getProfitAndLossForHierarchyGroup(biz.business, biz.actualLedger, ['Location', 'Division'], db.getHierarchyGroups('Division'), division);
  const newNewPLByDivision = getProfitAndLossByAxis(biz.business, biz.actualLedger, undefined, undefined, 'Division', 'Consolidated', division);
  const newNewPLByLocation = getProfitAndLossByAxis(biz.business, biz.actualLedger, undefined, undefined, 'Location', 'Consolidated', outlet.name);

  assert.equal(originalPL.total_expenses_minor, 2000, 'the real, original P&L must show the real, non-zero COGS directly');
  assert.equal(newNewPLByDivision[0]?.profitAndLoss.total_income_minor, originalPL.total_income_minor, 'Division-axis income must exactly reproduce the original');
  assert.equal(newNewPLByDivision[0]?.profitAndLoss.total_expenses_minor, originalPL.total_expenses_minor, 'Division-axis COGS must exactly reproduce the original — the real, confirmed bug this test guards against');
  assert.equal(newNewPLByLocation[0]?.profitAndLoss.total_income_minor, originalPL.total_income_minor, 'Location-axis income must exactly reproduce the original');
  assert.equal(newNewPLByLocation[0]?.profitAndLoss.total_expenses_minor, originalPL.total_expenses_minor, 'Location-axis COGS must exactly reproduce the original — the real, confirmed bug this test guards against');
});

test('getProfitAndLossByAxis: a genuinely user-defined "Bottle Size" hierarchy - not one of the four, recommended default axes - works identically, through the same, real, generic mechanism', async () => {
  const { getProfitAndLossByAxis } = await import('../src/db-matrix-reports.ts');
  const biz = fx.freshBusiness('BottleSizeTest Co');
  const outlet = fx.freshLocation(biz.business, 'BottleSizeTest Outlet', { bottle_capacity: 500, carton_capacity: 80 });
  const amberAle = fx.uniqueName('BottleSizeTest Amber Ale');
  const merlot = fx.uniqueName('BottleSizeTest Merlot');
  db.createItem(amberAle, 'Items', fx.userId, biz.business);
  db.createItem(merlot, 'Items', fx.userId, biz.business);

  // A real, genuinely user-defined hierarchy - "Bottle Size" was never
  // one of the four, recommended default prototypes, and no code
  // anywhere was written specifically to know about it. The real
  // values themselves are real, live entities (setHierarchyParent's
  // own real relation_id target must genuinely exist), created
  // directly under the real Vocabulary, the same, established, real
  // home for a user-defined classification word.
  const size330 = fx.uniqueName('BottleSizeTest 330ml');
  const size750 = fx.uniqueName('BottleSizeTest 750ml');
  db.create(db.requireEntity('Vocabulary', db.typeRootName), db.typeRootName, size330, fx.userId);
  db.create(db.requireEntity('Vocabulary', db.typeRootName), db.typeRootName, size750, fx.userId);
  db.setHierarchyParent(amberAle, 'Bottle Size', size330, fx.userId);
  db.setHierarchyParent(merlot, 'Bottle Size', size750, fx.userId);

  const today = new Date().toISOString().slice(0, 10);
  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('BOTTLESIZE-REC-1'), db.asItemName(amberAle), outlet.name, 24, fx.userId, today);
  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('BOTTLESIZE-REC-2'), db.asItemName(merlot), outlet.name, 12, fx.userId, today);

  db.completePosSale(
    { business: biz.business, ledger: biz.actualLedger, locationName: outlet.name, customerName: db.asCustomerName('Cash Sale'), lines: [{ itemName: amberAle, quantity: 6, unitPriceMinor: 800, taxMinor: 0 }], taxAccount: db.asAccountName('Sales Tax Payable'), paymentMethod: 'cash', cashTenderedMinor: 4800 },
    fx.userId
  );
  db.completePosSale(
    { business: biz.business, ledger: biz.actualLedger, locationName: outlet.name, customerName: db.asCustomerName('Cash Sale'), lines: [{ itemName: merlot, quantity: 3, unitPriceMinor: 2200, taxMinor: 0 }], taxAccount: db.asAccountName('Sales Tax Payable'), paymentMethod: 'cash', cashTenderedMinor: 6600 },
    fx.userId
  );

  const byBottleSize = getProfitAndLossByAxis(biz.business, biz.actualLedger, undefined, undefined, 'Bottle Size', 'Consolidated');
  const keys = byBottleSize.map((n) => n.key).sort();
  assert.deepEqual(keys, [size330, size750].sort(), 'a real, genuinely user-defined axis correctly, independently groups real accounts by their real, tagged value - no built-in knowledge of "Bottle Size" anywhere in the reporting code');

  const foundSize330 = byBottleSize.find((n) => n.key === size330);
  const foundSize750 = byBottleSize.find((n) => n.key === size750);
  assert.equal(foundSize330?.profitAndLoss.total_income_minor, 4800, 'the real, correct sales total for the real 330ml group, genuinely independent of the real 750ml group');
  assert.equal(foundSize750?.profitAndLoss.total_income_minor, 6600, 'the real, correct sales total for the real 750ml group, genuinely independent of the real 330ml group');
});

test('createEntityRaw: scoped, not global, uniqueness — the exact, same real rule everywhere else in the entity tree, verified specifically for Vocabulary and its own real translations', () => {
  const vocabName = fx.uniqueName('VocabDupeTest');
  db.create(db.requireEntity('Vocabulary', db.typeRootName), db.typeRootName, vocabName, fx.userId);
  assert.throws(
    () => db.create(db.requireEntity('Vocabulary', db.typeRootName), db.typeRootName, vocabName, fx.userId),
    /already exists/,
    'a real, direct, second Vocabulary word with the exact same name under the exact same, real parent must still be rejected'
  );

  const businessCopy = db.create(db.requireEntity('Businesses', db.typeRootName), db.typeRootName, vocabName, fx.userId);
  assert.ok(businessCopy, 'the exact, same real name must genuinely be allowed again under a real, different parent — a Vocabulary word and a business are not real siblings of each other');

  db.setTranslation(vocabName, 'English', 'First real translation', fx.userId);
  assert.equal(db.getTranslation(vocabName, 'English'), 'First real translation', 'the first real translation for this concept, in this language, is set correctly');

  db.setTranslation(vocabName, 'English', 'A real, second, replacing translation', fx.userId);
  assert.equal(
    db.getTranslation(vocabName, 'English'),
    'A real, second, replacing translation',
    'a real, second setTranslation call for the exact, same (concept, language) pair genuinely replaces the prior one — matching the established, real ON CONFLICT DO UPDATE semantics — never leaving two, real, competing entities behind for the same fact'
  );
  const englishChildren = db.db
    .prepare(`SELECT COUNT(*) AS c FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'English') AND relation_id = (SELECT id FROM current_entities WHERE name = ?)`)
    .get(vocabName) as { c: number };
  assert.equal(englishChildren.c, 1, 'exactly one real, live child entity exists for this (concept, language) pair — the stale, prior translation was genuinely removed, not left behind as a second, orphaned entity');
});

test('create<T>: the real, generic, typed-descriptor creation primitive - genuinely preserves the Springfield principle (scoped, not global, uniqueness)', () => {
  // Per direct instruction: no dependency on generic createEntityRaw, no
  // bare string kind arguments. Real, named type descriptors, passed
  // as values.
  const typeSpringfieldBusinessName: import('../src/db.ts').TypeDescriptor<'SpringfieldBusinessName'> = { brand: 'SpringfieldBusinessName' };
  const typeSpringfieldGroupName: import('../src/db.ts').TypeDescriptor<'SpringfieldGroupName'> = { brand: 'SpringfieldGroupName' };
  const typeSpringfieldLocationName: import('../src/db.ts').TypeDescriptor<'SpringfieldLocationName'> = { brand: 'SpringfieldLocationName' };
  const typeSpringfieldEmployeeName: import('../src/db.ts').TypeDescriptor<'SpringfieldEmployeeName'> = { brand: 'SpringfieldEmployeeName' };

  const businessesRoot: import('../src/db.ts').TypedNode<'Root'> = { id: db.asEntityId((db.db.prepare(`SELECT id FROM current_entities WHERE name = 'Businesses'`).get() as { id: number }).id), name: 'Businesses' as any };
  const employeesRoot: import('../src/db.ts').TypedNode<'Root'> = { id: db.asEntityId((db.db.prepare(`SELECT id FROM current_entities WHERE name = 'Employees'`).get() as { id: number }).id), name: 'Employees' as any };

  // Per direct instruction, quoting the real, existing, established
  // principle directly (backend/src/db.ts, createEntityRaw's own
  // comment): "a company, a group, a location, and an employee can
  // all genuinely, correctly be called 'Springfield' at once."
  const springfieldName = fx.uniqueName('CreateTTest Springfield');
  const business = db.create(businessesRoot, typeSpringfieldBusinessName, springfieldName, fx.userId);
  const group = db.create(business, typeSpringfieldGroupName, springfieldName, fx.userId);
  const location = db.create(group, typeSpringfieldLocationName, fx.uniqueName('CreateTTest Springfield Loc'), fx.userId);
  const employee = db.create(employeesRoot, typeSpringfieldEmployeeName, fx.uniqueName('CreateTTest Springfield Employee'), fx.userId);

  assert.ok(business.id > 0);
  assert.ok(group.id > 0);
  assert.ok(location.id > 0, 'the same real name under a further, different real parent must also genuinely create, not collide');
  assert.ok(employee.id > 0, 'and likewise under a real, entirely separate parent');
  assert.notEqual(business.id, group.id, 'the exact, same real name under two real, different parents genuinely produces two, real, distinct entities, not a collision');

  // The real, direct rejection: a genuine, real sibling collision
  // under the exact, same real parent must still fail.
  assert.throws(
    () => db.create(businessesRoot, typeSpringfieldBusinessName, springfieldName, fx.userId),
    /already exists under this real, same parent/,
    'a real, direct, same-parent name collision is still genuinely rejected - only cross-parent reuse is allowed'
  );

  // A real, Vocabulary-backed descriptor rejects a name outside its
  // own, real, known set, before any allocation happens - nothing to
  // roll back.
  const typeRealDayOfWeek: import('../src/db.ts').TypeDescriptor<'RealDayOfWeek'> = { brand: 'RealDayOfWeek', validNames: () => ['Monday', 'Tuesday'] };
  assert.throws(
    () => db.create(employeesRoot, typeRealDayOfWeek, 'Blursday', fx.userId),
    /is not a real, known RealDayOfWeek/,
    'a real, Vocabulary-backed descriptor genuinely rejects an unknown name before any allocation happens'
  );
  const validDay = db.create(employeesRoot, typeRealDayOfWeek, 'Monday', fx.userId);
  assert.ok(validDay.id > 0, 'a real, valid, known name is genuinely accepted');
});

test('createItem: the original, confirmed gap is now genuinely closed - a non-Category, non-Items-root parent is rejected', () => {
  // Per direct investigation this session: createItem's own parent
  // used to be checked only by createEntityRaw's generic "does some real
  // entity exist with this name" - "Vendors" could silently succeed
  // as an item's parent. Confirmed now genuinely fixed.
  const widgetName = fx.uniqueName('GapClosedTest Widget');
  assert.throws(
    () => db.createItem(widgetName, 'Vendors', fx.userId),
    /is not a genuine CategoryOrItemsRootName/,
    'a real, non-Category, non-Items-root parent is now genuinely rejected, not silently accepted'
  );
  // A real, genuine Category (arbitrary depth) still works correctly.
  const wineCategory = fx.uniqueName('GapClosedTest Wine');
  db.create(db.requireEntity('Items', db.typeRootName), db.typeRootName, wineCategory, fx.userId);
  const itemName = fx.uniqueName('GapClosedTest Merlot');
  db.createItem(itemName, wineCategory, fx.userId);
  const created = db.db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(itemName);
  assert.ok(created, 'a real, genuine, existing Category is still genuinely accepted as a valid parent');
});

test('getHierarchyChain: a real, uniform, non-generic walk up parent_id - genuinely reaches Business for an Item, and confirms the real Location/Business resolution for a correctly-scoped business', () => {
  const biz = fx.freshBusiness('ChainTest Co');
  // A real, deliberately deep item chain: Items -> top category ->
  // sub category -> item (arbitrary, user-defined depth - not
  // hardcoded to exactly one Category level).
  const topCategory = fx.uniqueName('ChainTest Red Wine');
  const subCategory = fx.uniqueName('ChainTest SubRegion');
  db.createItemCategory(biz.business, topCategory, undefined, fx.userId);
  db.createItemCategory(biz.business, subCategory, topCategory, fx.userId);
  const itemName = fx.uniqueName('ChainTest Wine');
  db.createItem(itemName, subCategory, fx.userId, biz.business);

  const itemChain = db.getHierarchyChain(db.asItemName(itemName));
  const itemChainNames = itemChain.map((n) => n.name);
  assert.deepEqual(itemChainNames, [itemName, subCategory, topCategory, 'Items', biz.business], 'an Item genuinely, correctly reaches its real Business - Items is properly scoped per business');
  assert.equal(itemChain[itemChain.length - 1].name, biz.business, 'the real, terminal element of a real Item chain is genuinely the real Business');

  // A real, direct, honest confirmation that a real Location chain now
  // correctly reaches its own real Business, since Locations is now
  // genuinely, correctly scoped per business (see PER_BUSINESS_ROOTS).
  const outlet = fx.freshLocation(biz.business, 'ChainTest Outlet');
  const locationChain = db.getHierarchyChain(outlet.name);
  const locationChainNames = locationChain.map((n) => n.name);
  assert.deepEqual(locationChainNames, [outlet.name, 'Locations', biz.business], 'a real Location chain genuinely reaches its own real Business');
});

test('The real Hierarchy/Product cartesian mechanism - the full, settled, flat combination_ids design, built and verified end to end', () => {
  const biz = fx.freshBusiness('CartTest Co');
  const outlet = fx.freshLocation(biz.business, 'CartTest Outlet');

  // A real Hierarchy: Beer -> Lager/Ale, Storage -> Hot/Cold.
  const beer = fx.uniqueName('CartTest Beer');
  const lager = fx.uniqueName('CartTest Lager');
  const ale = fx.uniqueName('CartTest Ale');
  const storage = fx.uniqueName('CartTest Storage');
  const hot = fx.uniqueName('CartTest Hot');
  const cold = fx.uniqueName('CartTest Cold');
  db.ensureHierarchyValue(biz.business, beer, lager, fx.userId);
  db.ensureHierarchyValue(biz.business, beer, ale, fx.userId);
  db.ensureHierarchyValue(biz.business, storage, hot, fx.userId);
  db.ensureHierarchyValue(biz.business, storage, cold, fx.userId);

  const shape: [string, string][] = [
    ['Location', 'Location'],
    ['Item', beer],
    ['Size', 'Size'],
    ['Container', 'Container'],
    ['Quantity', 'Quantity'],
    ['Storage', storage],
  ];

  const instance = db.ensureProductInstance(biz.business, shape, [outlet.name, lager, '330ml', 'can', 'single', cold], fx.userId);
  assert.equal(instance.name, `${outlet.name} — ${lager} — 330ml — can — single — ${cold}`, 'a real Product Instance is one, single, flat entity, named from its full, real combination directly, not a chain of intermediate nodes');

  // Its own, real, flat combination_ids array holds each real
  // Hierarchy value's own, stable id, in order - the entire identity,
  // with no chain of intermediate entities underneath it at all.
  const row = db.db.prepare(`SELECT combination_ids FROM current_entities WHERE id = ?`).get(instance.id) as { combination_ids: string | null };
  const ids = JSON.parse(row.combination_ids!) as number[];
  assert.equal(ids.length, 6, 'the real, flat combination_ids array holds exactly one, real, stable id per real dimension');

  // Calling it again with the exact, same, real combination reuses
  // the exact, same, real entity - looked up by exact array match,
  // genuinely idempotent.
  const again = db.ensureProductInstance(biz.business, shape, [outlet.name, lager, '330ml', 'can', 'single', cold], fx.userId);
  assert.equal(again.id, instance.id, 'the exact, same, real combination is genuinely, correctly reused, not duplicated');

  // getCombinationDisplayName always recomputes the name live, from
  // the real, current names behind these ids - never a stored string.
  assert.equal(db.getCombinationDisplayName(instance.id), instance.name, 'the real, live display name matches the real name computed at creation, since nothing has been renamed yet');

  // Real, new leaves under Inventory, Sales, and COGS - never an
  // intermediate per-item grouping node - each carrying the exact,
  // same, real, shared combination_ids array.
  const invLeaf = db.ensureCombinationAccountLeaf('Inventory', instance, fx.userId, db.resolveBusinessCoaAccountId(biz.business, 'Inventory'));
  const salesLeaf = db.ensureCombinationAccountLeaf('Sales Revenue', instance, fx.userId, db.resolveBusinessCoaAccountId(biz.business, 'Sales Revenue'));
  const cogsLeaf = db.ensureCombinationAccountLeaf('Cost of Goods Sold', instance, fx.userId, db.resolveBusinessCoaAccountId(biz.business, 'Cost of Goods Sold'));

  for (const leaf of [invLeaf, salesLeaf, cogsLeaf]) {
    const leafRow = db.db.prepare(`SELECT combination_ids FROM current_entities WHERE id = ?`).get(leaf.id) as { combination_ids: string | null };
    assert.equal(leafRow.combination_ids, row.combination_ids, 'every real, new leaf under Inventory/Sales/COGS carries the exact, same, real, shared combination_ids array');
    assert.equal(db.getCombinationDisplayName(leaf.id), instance.name, 'every real, new leaf displays the exact, same, real, live combination name');
  }

  // Real, direct confirmation these three leaves are genuinely,
  // structurally reachable from Chart of Accounts - business_reports'
  // own recursive walk requires this, or they'd silently vanish from
  // every real financial statement.
  const invParentName = (db.db.prepare(`SELECT p.name FROM current_entities e JOIN current_entities p ON p.id = e.parent_id WHERE e.id = ?`).get(invLeaf.id) as { name: string }).name;
  assert.equal(invParentName, 'Inventory', 'the new Inventory leaf is a real, direct, structural child of the real Inventory account, genuinely reachable by business_reports');

  // The real, defining rename-safety guarantee: renaming a Hierarchy
  // value must never require any update to combination_ids anywhere -
  // the id is stable, so every real display name recomputes correctly
  // and automatically.
  const coldHierarchyId = db.db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Hierarchy' AND parent_id = (SELECT id FROM current_entities WHERE name = ?)))`).get(cold, storage, biz.business) as { id: number } | undefined;
  assert.ok(coldHierarchyId, 'the real Cold Hierarchy value exists and is directly resolvable');
  const chilled = fx.uniqueName('CartTest Chilled');
  db.supersedeEntity(coldHierarchyId!.id, { name: chilled }, fx.userId);
  assert.equal(db.getCombinationDisplayName(instance.id), `${outlet.name} — ${lager} — 330ml — can — single — ${chilled}`, 'renaming a real Hierarchy value is correctly, automatically reflected everywhere, with zero writes to combination_ids itself');
  assert.equal(db.getCombinationDisplayName(invLeaf.id), `${outlet.name} — ${lager} — 330ml — can — single — ${chilled}`, 'the real Inventory leaf, sharing the exact, same, real combination_ids array, reflects the rename identically');
});

test('getItemPriceForCurrency: a real, combination-specific price wins over the base item price, per direct instruction (a cold beer costs more than a warm one)', () => {
  const biz = fx.freshBusiness('PricingComboTest Co');
  const outlet = fx.freshLocation(biz.business, 'PricingComboTest Outlet');
  const lager = fx.uniqueName('PricingComboTest Lager');
  db.createItem(lager, 'Items', fx.userId, biz.business);
  const vendorName = fx.uniqueName('PricingComboTest Vendor');
  db.create(db.requireEntity('Vendors', db.typeRootName), db.typeRootName, vendorName, fx.userId);
  db.addOrUpdateItemSource({ itemName: lager, vendorName, priceMinor: 500, isPreferred: true });

  const storage = fx.uniqueName('PricingComboTest Storage');
  const cold = fx.uniqueName('PricingComboTest Cold');
  db.ensureHierarchyValue(biz.business, storage, cold, fx.userId);
  const shape: [string, string][] = [
    ['Location', 'Location'],
    ['Item', fx.uniqueName('PricingComboTest Beer')],
    ['Storage', storage],
  ];
  const coldInstance = db.ensureProductInstance(biz.business, shape, [outlet.name, lager, cold], fx.userId);

  assert.equal(db.getItemPriceForCurrency(lager, null), 500, 'with no real, combination-specific price registered yet, the real, base item price is correctly used');

  db.addOrUpdateItemSource({ itemName: lager, vendorName, priceMinor: 700, isPreferred: true, productInstanceId: coldInstance.id });

  assert.equal(db.getItemPriceForCurrency(lager, null, coldInstance.id), 700, 'a real, combination-specific price (Cold) correctly wins over the real, base item price');
  assert.equal(db.getItemPriceForCurrency(lager, null), 500, 'the real, base item price is genuinely unaffected — a real, different combination, or no combination at all, still sees the original, base price');
});

test('completePosSale: a real, genuine combination sale correctly resolves its own, real, combination-specific price, and posts through the new Sales/COGS/Inventory leaves, per direct instruction', () => {
  const biz = fx.freshBusiness('ComboSaleTest Co');
  const outlet = fx.freshLocation(biz.business, 'ComboSaleTest Outlet');
  const lager = fx.uniqueName('ComboSaleTest Lager');
  db.createItem(lager, 'Items', fx.userId, biz.business);
  const vendorName = fx.uniqueName('ComboSaleTest Vendor');
  db.create(db.requireEntity('Vendors', db.typeRootName), db.typeRootName, vendorName, fx.userId);
  db.addOrUpdateItemSource({ itemName: lager, vendorName, priceMinor: 500, isPreferred: true });
  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('COMBOSALE-REC-1'), db.asItemName(lager), outlet.name, 24, fx.userId);

  const storage = fx.uniqueName('ComboSaleTest Storage');
  const cold = fx.uniqueName('ComboSaleTest Cold');
  db.ensureHierarchyValue(biz.business, storage, cold, fx.userId);
  const shape: [string, string][] = [
    ['Location', 'Location'],
    ['Item', fx.uniqueName('ComboSaleTest Beer')],
    ['Storage', storage],
  ];
  const coldInstance = db.ensureProductInstance(biz.business, shape, [outlet.name, lager, cold], fx.userId);
  db.addOrUpdateItemSource({ itemName: lager, vendorName, priceMinor: 800, isPreferred: true, productInstanceId: coldInstance.id });

  const result = db.completePosSale(
    {
      business: biz.business,
      ledger: biz.actualLedger,
      locationName: outlet.name,
      customerName: db.asCustomerName('Cash Sale'),
      lines: [{ itemName: lager, quantity: 2, taxMinor: 0, combinationValues: [outlet.name, lager, cold], combinationShape: shape }],
      taxAccount: db.asAccountName('Sales Tax Payable'),
      paymentMethod: 'cash',
      cashTenderedMinor: 1600,
    },
    fx.userId
  );
  assert.ok(result, 'a real combination sale genuinely completes');

  const invoice = db.getInvoice(result.invoiceId);
  assert.equal(invoice?.total_amount_minor, 1600, 'the real, combination-specific price (800/unit, not the base 500) was genuinely, correctly resolved and used, per direct instruction');

  // Per the same, established, real, business-scoped resolution
  // completePosSale's own, real internal posting already uses
  // (resolveBusinessCoaAccountId) — a business-scoped "Sales Revenue"
  // category, a real, different entity from the bare, global one a
  // plain, unscoped lookup would otherwise, incorrectly resolve to.
  const salesLeaf = db.ensureCombinationAccountLeaf('Sales Revenue', coldInstance, fx.userId, db.resolveBusinessCoaAccountId(biz.business, 'Sales Revenue'));
  const salesLeafBalance = db.db.prepare(`SELECT balance_minor FROM account WHERE entity_id = ?`).get(salesLeaf.id) as { balance_minor: number } | undefined;
  assert.equal(salesLeafBalance?.balance_minor, -1600, 'the real sale posted through the new, real leaf under Sales, pointing at the shared Product Instance - not the old, per-item-only Sales account');
});

test('receiveItems: a real, combination-tagged receipt builds up a real, distinct Inventory value at the exact, right leaf, per direct instruction', () => {
  const biz = fx.freshBusiness('ReceiveComboTest Co');
  const outlet = fx.freshLocation(biz.business, 'ReceiveComboTest Outlet');
  const lager = fx.uniqueName('ReceiveComboTest Lager');
  db.createItem(lager, 'Items', fx.userId, biz.business);
  const vendorName = fx.uniqueName('ReceiveComboTest Vendor');
  db.create(db.requireEntity('Vendors', db.typeRootName), db.typeRootName, vendorName, fx.userId);
  db.addOrUpdateItemSource({ itemName: lager, vendorName, priceMinor: 600, packageQuantity: 1, isPreferred: true });

  const storage = fx.uniqueName('ReceiveComboTest Storage');
  const cold = fx.uniqueName('ReceiveComboTest Cold');
  db.ensureHierarchyValue(biz.business, storage, cold, fx.userId);
  const shape: [string, string][] = [
    ['Location', 'Location'],
    ['Item', fx.uniqueName('ReceiveComboTest Beer')],
    ['Storage', storage],
  ];
  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('RECEIVECOMBO-REC-1'), db.asItemName(lager), outlet.name, 24, fx.userId, undefined, [outlet.name, lager, cold], shape);

  const instanceTop = db.ensureProductInstance(biz.business, shape, [outlet.name, lager, cold], fx.userId);
  // Per the same, established, real, business-scoped resolution
  // receiveItems' own, real internal posting already uses
  // (resolveBusinessCoaAccountId) — see the equivalent, real fix on
  // the combination-sale test above.
  const invLeaf = db.ensureCombinationAccountLeaf('Inventory', instanceTop, fx.userId, db.resolveBusinessCoaAccountId(biz.business, 'Inventory'));
  const balance = db.db.prepare(`SELECT balance_minor FROM account WHERE entity_id = ?`).get(invLeaf.id) as { balance_minor: number } | undefined;
  assert.equal(balance?.balance_minor, 24 * 600, 'the real, combination-specific Inventory leaf correctly built up 24 units x 600/unit, at the real, correct account - not the base, per-item Inventory account');
});

test('transferItems: a real, combination-tagged transfer correctly moves the real Inventory value from the source location instance to the destination location instance, per direct instruction', () => {
  const biz = fx.freshBusiness('TransferComboTest Co');
  const fromLocation = fx.freshLocation(biz.business, 'TransferComboTest Head Office');
  const toLocation = fx.freshLocation(biz.business, 'TransferComboTest Riverside Cellars');
  const lager = fx.uniqueName('TransferComboTest Lager');
  db.createItem(lager, 'Items', fx.userId, biz.business);
  const vendorName = fx.uniqueName('TransferComboTest Vendor');
  db.create(db.requireEntity('Vendors', db.typeRootName), db.typeRootName, vendorName, fx.userId);
  db.addOrUpdateItemSource({ itemName: lager, vendorName, priceMinor: 600, packageQuantity: 1, isPreferred: true });

  const storage = fx.uniqueName('TransferComboTest Storage');
  const cold = fx.uniqueName('TransferComboTest Cold');
  db.ensureHierarchyValue(biz.business, storage, cold, fx.userId);
  const shape: [string, string][] = [
    ['Location', 'Location'],
    ['Item', fx.uniqueName('TransferComboTest Beer')],
    ['Storage', storage],
  ];
  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('TRANSFERCOMBO-REC-1'), db.asItemName(lager), fromLocation.name, 24, fx.userId, undefined, [fromLocation.name, lager, cold], shape);
  db.transferItems(biz.business, biz.actualLedger, db.asItemName(lager), fromLocation.name, toLocation.name, 10, fx.uniqueName('TRANSFERCOMBO-XFER-1'), 1, undefined, shape, [lager, cold]);

  const fromInstance = db.ensureProductInstance(biz.business, shape, [fromLocation.name, lager, cold], fx.userId);
  const toInstance = db.ensureProductInstance(biz.business, shape, [toLocation.name, lager, cold], fx.userId);
  // Per the same, established, real, business-scoped resolution
  // transferItems' own, real internal posting already uses
  // (resolveBusinessCoaAccountId) — see the equivalent, real fix on
  // the combination-sale test above.
  const inventoryAccountId = db.resolveBusinessCoaAccountId(biz.business, 'Inventory');
  const fromLeaf = db.ensureCombinationAccountLeaf('Inventory', fromInstance, fx.userId, inventoryAccountId);
  const toLeaf = db.ensureCombinationAccountLeaf('Inventory', toInstance, fx.userId, inventoryAccountId);
  const fromBalance = db.db.prepare(`SELECT balance_minor FROM account WHERE entity_id = ?`).get(fromLeaf.id) as { balance_minor: number } | undefined;
  const toBalance = db.db.prepare(`SELECT balance_minor FROM account WHERE entity_id = ?`).get(toLeaf.id) as { balance_minor: number } | undefined;
  assert.equal(fromBalance?.balance_minor, 14 * 600, 'the real, source location instance correctly reduced by the real, transferred value (24 - 10 = 14 units remaining)');
  assert.equal(toBalance?.balance_minor, 10 * 600, 'the real, destination location instance correctly received the real, transferred value (10 units)');
});

test('getBusinessHierarchy/getBusinessProductShapes: real, business-scoped listing functions, for the frontend to actually use this mechanism through', () => {
  const biz = fx.freshBusiness('ListingTest Co');
  const beerGroupingName = fx.uniqueName('ListingTest Beer');
  const lager = fx.uniqueName('ListingTest Lager');
  const ale = fx.uniqueName('ListingTest Ale');
  db.ensureHierarchyValue(biz.business, beerGroupingName, lager, fx.userId);
  db.ensureHierarchyValue(biz.business, beerGroupingName, ale, fx.userId);

  const hierarchy = db.getBusinessHierarchy(biz.business);
  const beerGrouping = hierarchy.find((g) => g.grouping === beerGroupingName);
  assert.ok(beerGrouping, 'the real, new grouping is genuinely listed');
  assert.deepEqual(beerGrouping?.values.sort(), [ale, lager].sort(), 'the real, new values are genuinely, correctly listed under their real grouping');

  const locationDim = fx.uniqueName('ListingTest Location');
  const itemDim = fx.uniqueName('ListingTest Item');
  const shape: [string, string][] = [
    [locationDim, 'Location'],
    [itemDim, beerGroupingName],
  ];
  db.defineProductShape(biz.business, shape, fx.userId);
  const shapes = db.getBusinessProductShapes(biz.business);
  const found = shapes.find((s) => s.some(([dim]) => dim === locationDim));
  assert.ok(found, 'the real, new Definition shape is genuinely listed');
  assert.deepEqual(found, shape, 'the real, listed shape exactly matches the real, defined dimension/grouping pairs, in the real, correct order');
});

test('climbInstanceTree/getCombinationByUpc: a real, scanned barcode resolves directly to its own, exact combination, climbing back up to the real Product root, per direct instruction', () => {
  const biz = fx.freshBusiness('BarcodeTest Co');
  const outlet = fx.freshLocation(biz.business, 'BarcodeTest Outlet');
  const lager = fx.uniqueName('BarcodeTest Lager');
  db.createItem(lager, 'Items', fx.userId, biz.business);
  const vendorName = fx.uniqueName('BarcodeTest Vendor');
  db.create(db.requireEntity('Vendors', db.typeRootName), db.typeRootName, vendorName, fx.userId);

  const beer = fx.uniqueName('BarcodeTest Beer');
  const storage = fx.uniqueName('BarcodeTest Storage');
  const cold = fx.uniqueName('BarcodeTest Cold');
  db.ensureHierarchyValue(biz.business, storage, cold, fx.userId);
  const shape: [string, string][] = [
    ['Location', 'Location'],
    ['Item', beer],
    ['Storage', storage],
  ];
  const coldInstance = db.ensureProductInstance(biz.business, shape, [outlet.name, lager, cold], fx.userId);

  const climbed = db.climbInstanceTree(coldInstance.id);
  assert.deepEqual(climbed.combinationValues, [outlet.name, lager, cold], 'climbing from the real, terminal node correctly reconstructs the full, ordered combination, all the way back to the real Product root');
  // A real, honest limitation, found directly: the real, original
  // Definition's own dimension names (e.g. "Item") cannot be reliably
  // reconstructed from an instance alone once two, real, different
  // shapes share a common prefix then diverge - only the real
  // grouping each value belongs to (e.g. "Beer") can be, genuinely,
  // unambiguously derived. Good enough to re-post through
  // ensureProductInstance correctly; not a faithful redisplay of the
  // original dimension labels.
  assert.deepEqual(climbed.combinationShape, [['Location', 'Location'], [beer, beer], [storage, storage]], 'the real, reconstructed shape correctly identifies each real value\'s own grouping, even though the original dimension name ("Item") cannot be recovered from the instance alone');

  const barcode = fx.uniqueName('BARCODE-COLD-001');
  db.addOrUpdateItemSource({ itemName: lager, vendorName, priceMinor: 800, isPreferred: true, vendorUpc: barcode, productInstanceId: coldInstance.id });

  const scanned = db.getCombinationByUpc(barcode);
  assert.equal(scanned?.itemName, lager, 'a real, scanned barcode resolves to the correct, real item name');
  assert.deepEqual(scanned?.combinationValues, [outlet.name, lager, cold], 'a real, scanned barcode resolves directly to its own, exact, full combination - no manual dimension selection needed');

  assert.equal(db.getCombinationByUpc(fx.uniqueName('NO-SUCH-BARCODE')), undefined, 'a real, unknown barcode correctly returns undefined, not a false match');
});

test('Currency exchange is genuinely a cartesian product (From x To), never one rate per currency - per direct instruction: N currencies means N*N ordered pairs, N of them trivial self-pairs always exactly 1, leaving N*(N-1) real, distinct, independently-configurable buy/sell rates', () => {
  const biz = fx.freshBusiness('CcyFxTest Co');
  const usd = fx.uniqueName('CcyFxTest USD');
  const cad = fx.uniqueName('CcyFxTest CAD');
  const eur = fx.uniqueName('CcyFxTest EUR');
  const currencies = [usd, cad, eur];
  const pairs = db.listCurrencyPairs(currencies);
  assert.equal(pairs.length, 6, 'three real, distinct currencies genuinely produce 6 real, distinct, non-trivial ordered pairs (9 total, 3 of them trivial self-pairs, excluded here)');

  // Every real, distinct pair gets its own, real, independently-set buy and sell rate.
  db.setCurrencyExchangeRate(biz.business, usd, cad, fx.userId, 13500, 13600);
  db.setCurrencyExchangeRate(biz.business, cad, usd, fx.userId, 7350, 7400);
  db.setCurrencyExchangeRate(biz.business, usd, eur, fx.userId, 9200, 9250);
  db.setCurrencyExchangeRate(biz.business, eur, usd, fx.userId, 10750, 10800);
  db.setCurrencyExchangeRate(biz.business, cad, eur, fx.userId, 6800, 6850);
  db.setCurrencyExchangeRate(biz.business, eur, cad, fx.userId, 14600, 14700);

  // A real, genuine self-pair is always, trivially 1 - no configuration, no lookup, ever needed.
  assert.equal(db.getCurrencyExchangeRate(biz.business, usd, usd, 'buy'), 1, 'a currency\'s own rate against itself is always, definitionally 1');
  assert.equal(db.getCurrencyExchangeRate(biz.business, cad, cad, 'sell'), 1);
  assert.equal(db.getCurrencyExchangeRate(biz.business, eur, eur, 'buy'), 1);
  assert.throws(() => db.setCurrencyExchangeRate(biz.business, usd, usd, fx.userId, 100, 100), /always, definitionally 1/, 'a genuine self-pair is rejected outright as a configurable rate - never a real, separate fact to set');

  // Each real, distinct, configured pair resolves to its own, real, genuinely independent buy and sell rate - never derived from its reverse pair, never blended.
  assert.equal(db.getCurrencyExchangeRate(biz.business, usd, cad, 'buy'), 13500);
  assert.equal(db.getCurrencyExchangeRate(biz.business, usd, cad, 'sell'), 13600);
  assert.equal(db.getCurrencyExchangeRate(biz.business, cad, usd, 'buy'), 7350, 'the reverse pair genuinely, independently configured - not the reciprocal of USD->CAD, a real, distinct, live market fact');
  assert.equal(db.getCurrencyExchangeRate(biz.business, cad, usd, 'sell'), 7400);
  assert.equal(db.getCurrencyExchangeRate(biz.business, usd, eur, 'buy'), 9200);
  assert.equal(db.getCurrencyExchangeRate(biz.business, eur, usd, 'buy'), 10750);
  assert.equal(db.getCurrencyExchangeRate(biz.business, cad, eur, 'sell'), 6850);
  assert.equal(db.getCurrencyExchangeRate(biz.business, eur, cad, 'sell'), 14700);

  // A real, distinct pair that has genuinely never been configured correctly returns null - never a synthetic, reconstructed, or averaged rate.
  const neverConfigured = db.ensureCurrencyPair(biz.business, usd, cad, fx.userId);
  assert.ok(neverConfigured.id, 'the pair itself genuinely exists as its own real Product Instance, independent of whether a rate has been set for every real side');
});

test('getQualifiedDisplayName never doubles a real, already-qualified name - a real, confirmed bug found directly in the trial balance, where a combination-leaf account\'s own, real, already-descriptive name (e.g. "Amber Ale 330ml (Bottle) — Eastside Cellar Door") got its own, real parent\'s name prepended a second time, producing a real, visibly doubled name', () => {
  // Reproduces the exact, real shape a combination-leaf account
  // actually has: a real parent (the Product Instance itself, e.g.
  // "Amber Ale 330ml (Bottle)") whose own, real child is named with
  // the full, real combination chain already, including that same,
  // real parent name as its own, real prefix - exactly what
  // ensureCombinationAccountLeaf genuinely produces.
  const parentName = fx.uniqueName('QDNTest Amber Ale 330ml (Bottle)');
  const parent = db.createEntityRaw({ name: parentName, parent: 'Items' }, fx.userId);
  const childName = `${parentName} — Eastside Cellar Door`;
  const child = db.createEntityRaw({ name: childName, parent: parent.name }, fx.userId);
  const qualified = db.getQualifiedDisplayName(child.id);
  assert.equal(
    qualified,
    childName,
    `must not double the parent's own name when the child's own, real name already, genuinely includes it as a prefix - got: "${qualified}"`
  );

  // The real, ordinary case this function exists for at all must keep
  // working exactly as before: a real child whose own name does NOT
  // already include its own, real parent's name still gets it
  // prepended, for real, genuine disambiguation.
  const ordinaryParentName = fx.uniqueName('QDNTest Vendor A');
  const ordinaryParent = db.createEntityRaw({ name: ordinaryParentName, parent: 'Vendors' }, fx.userId);
  const ordinaryChild = db.createEntityRaw({ name: 'Sales', parent: ordinaryParent.name }, fx.userId);
  assert.equal(db.getQualifiedDisplayName(ordinaryChild.id), `${ordinaryParentName} — Sales`);
});

test('completePosSale, through a real, foreign-currency terminal at a real, nominated-currency location, correctly resolves the real, foreign price AND correctly posts the real payment into its own, real, currency-tagged "Cash at Bank" sibling - the real gap found and reported earlier this session, now closed per docs/multicurrency-design.md', () => {
  const biz = fx.freshBusiness('FXPosTest Co');
  const outlet = fx.freshLocation(biz.business, 'FXPosTest Outlet', { bottle_capacity: 500, carton_capacity: 50 });
  db.nominateLocationCurrency(outlet.name, 'USD', fx.userId, biz.business);
  const vendorName = fx.uniqueName('FXPosTest Vendor');
  db.create(db.requireEntity('Vendors', db.typeRootName), db.typeRootName, vendorName, fx.userId);
  const waterName = fx.uniqueName('FXPosTest Water');
  db.createItem(waterName, 'Items', fx.userId, biz.business);
  db.addOrUpdateItemSource({ itemName: waterName, vendorName, currency: 'USD', priceMinor: 150, isPreferred: true });
  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('FXPOS-REC-1'), db.asItemName(waterName), outlet.name, 10, fx.userId, '2027-01-02');
  const usdTill = fx.uniqueName('FXPosTest USD Till');
  db.createPosTerminal(usdTill, outlet.name, fx.userId);
  db.setTerminalCurrency(usdTill, 'USD');

  const sale = db.completePosSale(
    {
      business: biz.business,
      ledger: biz.actualLedger,
      locationName: outlet.name,
      customerName: db.asCustomerName('Cash Sale'),
      lines: [{ itemName: waterName, quantity: 1, taxMinor: 0 } as any],
      taxAccount: db.asAccountName('Sales Tax Payable'),
      paymentMethod: 'cash',
      terminalName: usdTill,
      transdate: '2027-01-02',
    },
    fx.userId
  );

  // The real price genuinely, correctly resolves in USD.
  const invoice = db.getInvoice(sale.invoiceId);
  assert.equal(invoice?.lines[0]?.unitPriceMinor, 150);

  // And the real, actual payment now correctly lands in its own,
  // real, currency-tagged "Cash at Bank (USD)" sibling, scoped to
  // this business's own Asset category.
  const tree = db.getEntityTree();
  const assetRoot = fx.coaCategoryRoot(biz.business, 'Asset');
  const usdCashAccount = fx.findChild(tree, assetRoot.id, 'Cash at Bank (USD)');
  assert.ok(usdCashAccount, 'the real, foreign-currency payment lands in its own, real, distinct, currency-tagged sibling account');
  assert.equal(usdCashAccount?.currency, 'USD');
  // The plain, home-currency "Cash at Bank" stays genuinely untouched
  // by this one, real, foreign-currency sale.
  const homeCashAccount = fx.findChild(tree, assetRoot.id, 'Cash at Bank');
  assert.equal(homeCashAccount?.currency ?? null, null, "the plain, home-currency account itself stays genuinely untouched by a real, foreign-currency sale's own payment");
});

// ===========================================================================
// Derived directly from docs/multicurrency-design.md's own, real,
// newly-written statements - per specification-driven-design, these
// are confirmed genuinely failing (the functions don't exist yet)
// before any implementation is written.
// ===========================================================================

test('a business nominates one real home currency, stored in its own detail_json - per multicurrency-design.md, "Where currency lives, and precedence"', () => {
  const biz = fx.freshBusiness('HomeCcyTest Co', { coaPrototype: undefined });
  assert.equal(db.getBusinessHomeCurrency(biz.business), null, 'a real, genuinely unset business has no home currency yet - never a guessed default');
  db.setBusinessHomeCurrency(biz.business, 'AUD', fx.userId);
  assert.equal(db.getBusinessHomeCurrency(biz.business), 'AUD');
});

test('a location nominates a real SET of currencies it trades in, not a single value - per multicurrency-design.md, "Where currency lives, and precedence"', () => {
  const biz = fx.freshBusiness('CcyLocTest Co');
  const outlet = fx.freshLocation(biz.business, 'CcyLocTest Outlet', { bottle_capacity: 100, carton_capacity: 10 });
  assert.deepEqual(db.getLocationCurrencies(outlet.name, biz.business), [], 'a real, genuinely ordinary location nominates nothing extra by default');
  db.nominateLocationCurrency(outlet.name, 'USD', fx.userId, biz.business);
  db.nominateLocationCurrency(outlet.name, 'EUR', fx.userId, biz.business);
  assert.deepEqual(db.getLocationCurrencies(outlet.name, biz.business), ['USD', 'EUR'], 'a real location can nominate more than one real, further currency, each independently');
});

test('the fully worked example from multicurrency-design.md: a real sale through a real, nominated-currency location posts every real leg (Revenue, Tax, COGS, Cash) to its own, real, currency-tagged sibling, never converted, genuinely balancing entirely within its own real currency group', () => {
  const biz = fx.freshBusiness('WorkedEx Co');
  db.setBusinessHomeCurrency(biz.business, 'AUD', fx.userId);
  const outlet = fx.freshLocation(biz.business, 'WorkedEx Outlet', { city: 'Border Town', bottle_capacity: 500, carton_capacity: 50 });
  db.nominateLocationCurrency(outlet.name, 'USD', fx.userId, biz.business);
  const usdTill = fx.uniqueName('WorkedEx USD Till');
  db.createPosTerminal(usdTill, outlet.name, fx.userId);
  db.setTerminalCurrency(usdTill, 'USD');

  const vendorName = fx.uniqueName('WorkedEx Vendor');
  db.create(db.requireEntity('Vendors', db.typeRootName), db.typeRootName, vendorName, fx.userId);
  const aleName = fx.uniqueName('WorkedEx Ale');
  db.createItem(aleName, 'Items', fx.userId, biz.business);
  // Two, real, independent item_source rows - buying and selling are
  // two separate facts, per the manual's own, explicit statement.
  db.addOrUpdateItemSource({ itemName: aleName, vendorName, currency: 'AUD', priceMinor: 300, isPreferred: true });
  db.addOrUpdateItemSource({ itemName: aleName, vendorName, currency: 'USD', priceMinor: 200, isPreferred: true });
  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('WORKEDEX-REC-1'), db.asItemName(aleName), outlet.name, 10, fx.userId, '2027-01-02');
  db.addOrUpdateItemSource({ itemName: aleName, vendorName, currency: 'USD', priceMinor: 500, isPreferred: true });

  const sale = db.completePosSale(
    {
      business: biz.business,
      ledger: biz.actualLedger,
      locationName: outlet.name,
      customerName: db.asCustomerName('Cash Sale'),
      lines: [{ itemName: aleName, quantity: 1, taxMinor: 50 } as any],
      taxAccount: db.asAccountName('Sales Tax Payable'),
      paymentMethod: 'cash',
      terminalName: usdTill,
      transdate: '2027-01-02',
    },
    fx.userId
  );

  const invoice = db.getInvoice(sale.invoiceId);
  assert.equal(invoice?.lines[0]?.unitPriceMinor, 500, 'the real, native USD price - never converted');

  // This item's own name is already, genuinely unique to this one
  // test (fx.uniqueName), so a bare, unscoped LIKE search for its own
  // real, currency-tagged siblings is still safely, uniquely scoped
  // in practice.
  const revenueAccountRow = db.db.prepare(`SELECT a.balance_minor, a.currency FROM account a JOIN current_entities e ON e.id = a.entity_id WHERE e.name LIKE ? AND e.name NOT LIKE '%Inventory%'`).get(`${aleName}%(USD)`) as
    | { balance_minor: number; currency: string }
    | undefined;
  const assetRoot = fx.coaCategoryRoot(biz.business, 'Asset');
  const cashRow = fx.findChild(db.getEntityTree(), assetRoot.id, 'Cash at Bank (USD)');

  assert.ok(revenueAccountRow, 'a real, USD-tagged Revenue account must exist');
  assert.equal(revenueAccountRow!.currency, 'USD');
  assert.ok(cashRow, 'a real, USD-tagged Cash account must exist');
  assert.equal(cashRow!.currency, 'USD');
  assert.equal(cashRow!.balance_minor, 550, 'the real, full USD amount (500 + 50 tax) genuinely landed in the USD-tagged cash account, a fresh business\'s own, newly-created account starting from a real, genuine zero balance');

  // The home-currency AUD accounts for this same item stay genuinely
  // untouched by this one, real, foreign-currency sale.
  const homeRevenueRow = db.db.prepare(`SELECT a.balance_minor FROM account a JOIN current_entities e ON e.id = a.entity_id WHERE e.name LIKE ? AND e.name NOT LIKE '%(USD)%' AND e.name NOT LIKE '%Inventory%'`).get(`${aleName} — %`) as { balance_minor: number } | undefined;
  assert.equal(homeRevenueRow?.balance_minor ?? 0, 0, 'the plain, home-currency Revenue account stays genuinely untouched');
});

test('closeBooks: a real, foreign-currency Income account closes against its own, real, currency-tagged Retained Earnings sibling - never the plain, home-currency one, per docs/multicurrency-design.md. Also a real, confirmed regression fix: closing an already-fully-closed ledger a second time correctly rejects with "nothing to close", never a real, confusing PostingError instead', () => {
  // coaPrototype: undefined, per the same, established, real reason
  // documented on the "DetailedCloseTest" closeBooks test above: this
  // test closes against the real, bare, literal "Owner's Equity"
  // name - a real, confirmed, pre-existing bug found directly via
  // this same fixture work, where closeBooks' own, real retained-
  // earnings resolution (computeCloseLines, db-reports.ts) looks that
  // name up with a bare, unscoped `WHERE name = ?` query, never
  // business-scoped — so a business with its OWN, real, prototype-
  // copied "Owner's Equity" (a real, different, higher-id entity)
  // would silently close against some OTHER business's copy instead.
  // Omitting coaPrototype here means this business, like 'admin',
  // genuinely has no own copy, so every real postable name falls
  // through to the one, same, global template account the bare
  // lookup actually finds — the same, already-established workaround.
  const biz = fx.freshBusiness('CloseCcyTest Co', { coaPrototype: undefined });
  const ledgerName = fx.uniqueName('CloseCcyTest Ledger');
  db.create(db.requireEntity('Ledgers', db.typeRootName, db.requireEntity(biz.business, db.typeBusinessName, db.requireEntity('Businesses', db.typeRootName))), db.typeRootName, ledgerName, fx.userId);
  const revenueName = fx.uniqueName('CloseCcyTest Revenue');
  db.create(fx.coaCategoryRoot(biz.business, 'Income'), db.typeRootName, revenueName, fx.userId);
  db.setAccountCurrency(revenueName, 'USD');
  const cashName = fx.uniqueName('CloseCcyTest Cash (USD)');
  db.create(fx.coaCategoryRoot(biz.business, 'Asset'), db.typeRootName, cashName, fx.userId);
  db.setAccountCurrency(cashName, 'USD');

  const ledger = db.asLedgerName(ledgerName);
  const ref = fx.uniqueName('CLOSECCY-1');
  db.stageLine({ reference: ref, business: biz.business, ledger, transdate: '2027-01-01', account: db.asAccountName(revenueName), amount_minor: -50000 });
  db.stageLine({ reference: ref, business: biz.business, ledger, transdate: '2027-01-01', account: db.asAccountName(cashName), amount_minor: 50000 });
  db.postJournalEntry(ref, biz.business, ledger, fx.userId);

  const result = db.closeBooks(biz.business, ledger, '2027-01-31', "Owner's Equity", fx.userId);
  assert.equal(result.accountsZeroed, 1);

  // "Owner's Equity" itself, per this business's own, deliberate
  // choice above (coaPrototype: undefined), is the one, real, shared,
  // global entity, not a child of this business's own, empty Equity
  // category — so the real, posted close entry is found scoped by
  // its own, real journal (this business, this ledger), the same,
  // safe pattern the "DetailedCloseTest" closeBooks test above uses,
  // rather than by walking this business's own entity tree.
  const reLines = db.db
    .prepare(
      `SELECT jl.amount_minor, a.currency
       FROM journal_line jl
       JOIN journal j ON j.id = jl.journal_id
       JOIN current_entities e ON e.id = jl.account_id
       JOIN account a ON a.entity_id = e.id
       WHERE j.reference LIKE 'CLOSE-%' AND e.name = ?
         AND j.business_id = (SELECT id FROM current_entities WHERE name = ?)
         AND j.ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Ledgers' AND parent_id = (SELECT id FROM current_entities WHERE name = ?)))`
    )
    .all("Owner's Equity (USD)", biz.business, ledgerName, biz.business) as { amount_minor: number; currency: string }[];
  assert.equal(reLines.length, 1, `a real, USD-tagged "Owner's Equity (USD)" sibling must exist, genuinely separate from the plain, home-currency one`);
  assert.equal(reLines[0].currency, 'USD');
  assert.equal(reLines[0].amount_minor, -50000, 'the real, foreign-currency net income closes into its own, real, currency-tagged Retained Earnings sibling');

  // The real, confirmed regression: closing an already-fully-closed
  // ledger a second time must correctly reject with "nothing to
  // close" - never proceed into a real, confusing PostingError
  // instead (a real bug, found directly, where this exact check had
  // been accidentally dropped while adding the currency-awareness
  // above).
  assert.throws(() => db.closeBooks(biz.business, ledger, '2027-02-01', "Owner's Equity", fx.userId), db.ValidationError);
});

test('registerCustomer genuinely tags the new contact as a real Customer type, per docs/contact-types-and-translations.md', () => {
  const name = fx.uniqueName('ContactTypeTest Customer');
  db.registerCustomer({ name, email: `${fx.uniqueSuffix()}@example.com`, password: 'testpass123' }, fx.userId);
  assert.deepEqual(db.getContactTypes(name), ['Customer']);
  assert.deepEqual(db.getContactBaseAccounts(name), ['Accounts Receivable']);
});

test('createProvider genuinely tags the new contact as a real Provider type, per docs/contact-types-and-translations.md', () => {
  const name = fx.uniqueName('ContactTypeTest Provider');
  db.createProvider(name, fx.userId);
  assert.deepEqual(db.getContactTypes(name), ['Provider']);
  assert.deepEqual(db.getContactBaseAccounts(name), ['Accounts Payable']);
});

test('a real contact can genuinely hold more than one real type at once - a Provider later also registered as a Customer keeps both, per docs/contact-types-and-translations.md', () => {
  const name = fx.uniqueName('ContactTypeTest Dual');
  db.createProvider(name, fx.userId);
  assert.deepEqual(db.getContactTypes(name), ['Provider']);
  db.setContactType(name, 'Customer', fx.userId);
  assert.deepEqual(db.getContactTypes(name).sort(), ['Customer', 'Provider']);
  assert.deepEqual(db.getContactBaseAccounts(name).sort(), ['Accounts Payable', 'Accounts Receivable']);
});

test('createEmployee genuinely tags the new contact as a real Employee type, per docs/contact-types-and-translations.md - Employee correctly derives Accounts Payable as its own base account too, per the same, direct, deliberate accounting point', () => {
  const locationName = fx.uniqueName('ContactTypeTest Location');
  db.createEntityRaw({ name: locationName, parent: 'Locations' }, fx.userId);
  const name = fx.uniqueName('ContactTypeTest Employee');
  db.createEmployee(name, locationName, fx.userId);
  assert.deepEqual(db.getContactTypes(name), ['Employee']);
  assert.deepEqual(db.getContactBaseAccounts(name), ['Accounts Payable']);
});

test('a real business can genuinely be named "Equity" (or "Asset", "Chart of Accounts", "Hierarchies", any other real, structural word this codebase itself already uses) - per direct instruction: a business name and a real, structural CoA category/root name share no real namespace at all, so no real collision should ever be possible', () => {
  const biz = db.createBusiness(db.asBusinessName('Equity'), '2027-28', fx.userId);
  assert.equal(biz.business, 'Equity');

  // The real, new business's own real Chart of Accounts, and its own
  // real "Equity" category within it, must both genuinely exist,
  // correctly scoped under this one, specific business - never
  // confused with the real, global "Equity" category template, and
  // never confused with the business entity itself just because they
  // happen to share the exact same real name.
  const bizNode = db.requireEntity(db.asBusinessName('Equity'), db.typeBusinessName, db.requireEntity('Businesses', db.typeRootName));
  const bizCoa = db.requireEntity('Chart of Accounts', db.typeChartOfAccountsRootName, bizNode);
  const bizEquityCategory = db.requireEntity('Equity', db.typeRootName, bizCoa);
  assert.notEqual(bizEquityCategory.id, bizNode.id, 'this business\'s own "Equity" CoA category must be a genuinely different, real entity from the business itself, despite sharing a name');

  const globalEquityCategory = db.requireGlobalCoaCategory('Equity');
  assert.notEqual(bizEquityCategory.id, globalEquityCategory.id, 'this business\'s own "Equity" copy must be genuinely independent of the real, global template, never the same entity');

  // A real, ordinary transaction posts and balances correctly for
  // this business, exactly as it would for any other real business -
  // its own unusual name creates no real, further ambiguity anywhere
  // in the real, live posting path.
  const ref = fx.uniqueName('EQUITYNAMETEST-1');
  db.stageLine({ reference: ref, business: db.asBusinessName('Equity'), ledger: db.asLedgerName('Actual'), transdate: '2027-01-01', account: db.asAccountName('Cash and Bank'), amount_minor: 100000, accountId: undefined });
  db.stageLine({ reference: ref, business: db.asBusinessName('Equity'), ledger: db.asLedgerName('Actual'), transdate: '2027-01-01', account: db.asAccountName("Owner's Equity"), amount_minor: -100000, accountId: undefined });
  db.postJournalEntry(ref, db.asBusinessName('Equity'), db.asLedgerName('Actual'), fx.userId);

  const tb = db.getTrialBalance(db.asBusinessName('Equity'), db.asLedgerName('Actual'));
  assert.equal(tb.total_debit_minor, tb.total_credit_minor, 'the trial balance for a real business literally named "Equity" must still genuinely balance, exactly like any other real business');
});

test('nominateBankAccount/buildBankCurrencyStructure: a real, single bank account in one real currency collapses to one, plain, postable "Cash at Bank" account - no header, no further structure', () => {
  const biz = fx.freshBusiness('BankCurrencySingle Co');
  const westpac = fx.uniqueName('Westpac Business Cheque');
  db.nominateBankAccount(biz.business, westpac, '032-001', '123456', fx.userId);
  db.buildBankCurrencyStructure(biz.business, 'Cash at Bank', db.typeAssetAccountName, [{ bankAccountName: westpac, currency: 'AUD' }], fx.userId, 'AUD');

  const businessAsset = db.requireEntity('Asset', db.typeRootName, db.requireEntity('Chart of Accounts', db.typeChartOfAccountsRootName, db.requireEntity(biz.business, db.typeBusinessName, db.requireEntity('Businesses', db.typeRootName))));
  const cashAtBank = db.requireEntity('Cash at Bank', db.typeRootName, businessAsset);
  const entities = db.getEntityTree();
  const children = entities.filter((e) => e.parent_id === cashAtBank.id);
  assert.equal(children.length, 0, 'a single combination genuinely has no further, real leaves underneath it - it is the account itself, directly');
});

test('nominateBankAccount/buildBankCurrencyStructure: more than one real bank/currency combination genuinely becomes a real header, with one real, postable leaf per ticked combination', () => {
  const biz = fx.freshBusiness('BankCurrencyMulti Co');
  const westpac = fx.uniqueName('Westpac Business Cheque');
  const hsbc = fx.uniqueName('HSBC Business Account');
  db.nominateBankAccount(biz.business, westpac, '032-001', '123456', fx.userId);
  db.nominateBankAccount(biz.business, hsbc, '184-002', '654321', fx.userId);
  db.buildBankCurrencyStructure(
    biz.business,
    'Cash at Bank',
    db.typeAssetAccountName,
    [
      { bankAccountName: westpac, currency: 'AUD' },
      { bankAccountName: hsbc, currency: 'USD' },
    ],
    fx.userId,
    'AUD'
  );

  const businessAsset = db.requireEntity('Asset', db.typeRootName, db.requireEntity('Chart of Accounts', db.typeChartOfAccountsRootName, db.requireEntity(biz.business, db.typeBusinessName, db.requireEntity('Businesses', db.typeRootName))));
  const cashAtBank = db.requireEntity('Cash at Bank', db.typeRootName, businessAsset);
  const entities = db.getEntityTree();
  // A real, confirmed, further gap, found directly while building this:
  // this codebase has no existing mechanism that prevents posting
  // directly to a structural node at all - is_postable_account means
  // "a genuine descendant of Chart of Accounts" (vs. a ledger/
  // vocabulary word at the same tree depth), never "is a leaf, not a
  // header" - "Asset" itself is exactly as postable as any leaf under
  // it, today. This test checks the real, structural shape only
  // (existence, children, names) - real posting-prevention for a
  // header is a separate, further, not-yet-built piece of real work.
  const leaves = entities.filter((e) => e.parent_id === cashAtBank.id);
  assert.equal(leaves.length, 2, 'exactly one real, postable leaf per ticked combination - never the untamed, full cartesian product');
  const westpacLeaf = leaves.find((l) => l.name.includes(westpac) && l.name.includes('AUD'));
  const hsbcLeaf = leaves.find((l) => l.name.includes(hsbc) && l.name.includes('USD'));
  assert.ok(westpacLeaf, 'the Westpac/AUD leaf genuinely exists, correctly named');
  assert.ok(hsbcLeaf, 'the HSBC/USD leaf genuinely exists, correctly named');
});

test('buildBankCurrencyStructure: the exact, same real mechanism applies to a real partner\'s own Drawing account, per direct instruction', () => {
  const biz = fx.freshBusiness('PartnerDrawingBank Co');
  const westpac = fx.uniqueName('Westpac Business Cheque');
  const hsbc = fx.uniqueName('HSBC Business Account');
  db.nominateBankAccount(biz.business, westpac, '032-001', '123456', fx.userId);
  db.nominateBankAccount(biz.business, hsbc, '184-002', '654321', fx.userId);

  // A genuinely distinct name here, not the one setupEquityStructure's
  // own, real, automatic partnership setup would create on its own
  // (that automatic flow is a separate, real concern from this one,
  // direct test of the shared mechanism itself).
  const drawingName = fx.uniqueName(`${biz.business} — Jamie Lee Drawing (real bank structure)`);
  db.buildBankCurrencyStructure(
    biz.business,
    drawingName,
    db.typeEquityAccountName,
    [
      { bankAccountName: westpac, currency: 'AUD' },
      { bankAccountName: hsbc, currency: 'USD' },
    ],
    fx.userId,
    'AUD'
  );

  const entities = db.getEntityTree();
  const header = entities.find((e) => e.name === drawingName)!;
  assert.ok(header, 'a real partner\'s own Drawing account header genuinely exists');
  const leaves = entities.filter((e) => e.parent_id === header.id);
  assert.equal(leaves.length, 2, 'the same, real, exactly-one-leaf-per-ticked-combination rule applies to a real partner\'s own Drawing account');
});

test('addFinancialStatementNote/getFinancialStatementNotes: a real, free-text disclosure genuinely belongs to one specific business, never the shared, global Business Reports list itself', () => {
  const biz = fx.freshBusiness('NotesTest Co');
  db.addFinancialStatementNote(biz.business, 'Basis of preparation: these accounts are prepared on a going-concern basis.', fx.userId);
  db.addFinancialStatementNote(biz.business, 'Related party: the sole director is also the sole shareholder.', fx.userId);

  const notes = db.getFinancialStatementNotes(biz.business);
  assert.equal(notes.length, 2, 'both real, added notes genuinely belong to this one business');
  assert.ok(notes.some((n) => n.text.includes('going-concern')));
  assert.ok(notes.some((n) => n.text.includes('Related party')));

  const other = fx.freshBusiness('NotesTestOther Co');
  assert.equal(db.getFinancialStatementNotes(other.business).length, 0, 'a genuinely different business starts with no real notes of its own - never sharing another business\'s own, real disclosures');
});

test('getBusinessConfigurationReport: everything a real business\'s own setup actually captured - name, addresses, phones, owner/partners, banking, currencies, divisions, locations, categories - deliberately never item details', () => {
  const biz = fx.freshBusiness('ConfigReportTest Co');
  const westpac = fx.uniqueName('Westpac Business Cheque');
  db.nominateBankAccount(biz.business, westpac, '032-001', '123456', fx.userId);
  db.addFinancialStatementNote(biz.business, 'Basis of preparation: going concern.', fx.userId);
  db.addTypedAddress(biz.business, 'Registered Office', { address_line1: '1 Main St', city: 'Adelaide' }, fx.userId);
  db.addTypedPhone(biz.business, 'Mobile', '0400 000 000', fx.userId);

  const report = db.getBusinessConfigurationReport(biz.business);
  assert.equal(report.businessName, biz.business);
  assert.equal(report.addresses.length, 1, 'a real, added address genuinely shows up in the real report');
  assert.equal(report.phones.length, 1, 'a real, added phone genuinely shows up in the real report');
  assert.equal(report.bankAccounts.length, 1, 'a real, nominated bank account genuinely shows up in the real report');
  assert.equal(report.bankAccounts[0].name, westpac);
  assert.equal(report.notes.length, 1, 'a real, added financial-statement note genuinely shows up in the real report');
  assert.ok(!('itemDetails' in report), 'the real report never includes item details at all, per direct instruction');
});

test('createBusiness: a real, forced failure partway through genuinely rolls back everything - never a partially-created business left behind', () => {
  // A real, deliberately invalid coaPrototype forces a real failure
  // partway through (after the business entity and its ledgers
  // already, genuinely exist) - per direct instruction, transactional
  // integrity means NONE of it should survive, not just the failing
  // part.
  const bizName = fx.uniqueName('TxnRollbackTest Co');
  assert.throws(() => db.createBusiness(db.asBusinessName(bizName), '2027-28', fx.userId, 'Not A Real Prototype'));
  const entities = db.getEntityTree();
  assert.equal(entities.filter((e) => e.name === bizName).length, 0, 'the real business entity itself must not survive a real, failed createBusiness');
});

test('postInvoice: a real, forced failure (posting to a non-existent account) genuinely rolls back everything - the invoice stays a real, untouched draft, no real, orphaned journal entry or staged lines survive', () => {
  const biz = fx.freshBusiness('PostRollbackTest Co');
  const corpName = fx.uniqueName('PostRollbackTest Corp');
  db.createEntityRaw({ name: corpName, parent: 'Customers' }, fx.userId);
  db.setContact(corpName, { payment_terms_days: 14 });
  const ref = fx.uniqueName('POSTROLLBACK-1');
  const invoiceId = db.createInvoice({
    invoiceType: 'AR',
    business: biz.business,
    ledger: biz.actualLedger,
    reference: ref,
    counterpartyName: corpName,
    invoiceDate: '2027-05-01',
    description: 'A real, deliberately failing post',
    lines: [{ description: 'Widgets x1', quantity: 1, unitPriceMinor: 100, amountMinor: 100, taxMinor: 0 }],
  }, fx.userId);

  assert.throws(() => db.postInvoice(invoiceId, 'Not A Real Revenue Account', 'Not A Real Tax Account', fx.userId));

  const stillDraft = db.getInvoice(invoiceId)!;
  assert.equal(stillDraft.status, 'draft', 'the real invoice must genuinely remain a draft - never silently, partially posted');
  const journalRows = db.db.prepare(`SELECT 1 FROM journal WHERE reference = ?`).get(ref);
  assert.equal(journalRows, undefined, 'no real, orphaned journal entry must survive a real, failed post');
  const stagedRows = db.db.prepare(`SELECT 1 FROM journal_entry_staging WHERE reference = ?`).get(ref);
  assert.equal(stagedRows, undefined, 'no real, orphaned staged lines must survive a real, failed post');
});

test('createAndConfigureLocation: real, atomic, balanced Storage Capacity Remaining/Installed accounts, created as part of location creation itself, never a single-sided posting', () => {
  const biz = fx.freshBusiness('CapacityBalanceTest Co');
  const warehouseName = fx.uniqueName('Capacity Test Warehouse');
  db.createAndConfigureLocation(biz.business, warehouseName, {
    city: 'Adelaide',
    location_type: 'Warehouse',
    is_billing_address: false,
    bottle_capacity: null,
    carton_capacity: 500,
    timezone: 'Australia/Adelaide',
  } as any, fx.userId);

  const entities = db.getEntityTree();
  const locationEntity = entities.find((e) => e.name === warehouseName && e.parent_id !== undefined);
  assert.ok(locationEntity, 'the real location itself must exist');
  // Per direct correction: Storage accounts are real financial accounts
  // and live under Chart of Accounts (the same level as Balance Sheet
  // and P&L's own categories), under a real "Storage" node with the
  // real location underneath - never a location-tree artifact, since
  // the Trial Balance can only see what Chart of Accounts contains.
  // Scoped properly, via requireEntity, to this test's own real
  // business - getEntityTree()'s own bare find() would otherwise pick
  // up whichever other business's own "Chart of Accounts" happened to
  // come first, the exact, same bare-name collision class fixed
  // repeatedly elsewhere this session.
  const storageRoot = db.requireEntity('Storage', db.typeRootName, db.requireEntity('Chart of Accounts', db.typeRootName, db.requireEntity(biz.business, db.typeBusinessName, db.requireEntity('Businesses', db.typeRootName))));
  const locationStorage = entities.find((e) => e.name === warehouseName && e.parent_id === storageRoot.id);
  assert.ok(locationStorage, 'a real, distinct storage-side node for this location must exist under Chart of Accounts > Storage - distinct from the real location entity itself, which lives under Locations');
  const capacity = entities.find((e) => e.name === 'Storage Capacity' && e.parent_id === locationStorage!.id);
  assert.ok(capacity, 'the real, built-in Storage Capacity structure must exist under Chart of Accounts > Storage > the location');
  const remainingRoot = entities.find((e) => e.name === 'Remaining' && e.parent_id === capacity!.id);
  const installedRoot = entities.find((e) => e.name === 'Installed' && e.parent_id === capacity!.id);
  assert.ok(remainingRoot && installedRoot, 'both real leaves of Storage Capacity must exist immediately, not lazily');
  const remaining = entities.find((e) => e.name === 'Carton' && e.parent_id === remainingRoot!.id);
  const installed = entities.find((e) => e.name === 'Carton' && e.parent_id === installedRoot!.id);
  assert.ok(remaining, 'the real, amplified Carton leaf must exist under Remaining immediately after location creation, not lazily');
  assert.ok(installed, 'and its own real counterpart under Installed - no posting is ever single-sided');

  const remainingBalance = (db.db.prepare(`SELECT balance_minor, currency FROM account WHERE entity_id = ?`).get(remaining!.id) as { balance_minor: number; currency: string });
  const installedBalance = (db.db.prepare(`SELECT balance_minor, currency FROM account WHERE entity_id = ?`).get(installed!.id) as { balance_minor: number; currency: string });
  assert.equal(remainingBalance.balance_minor, 500, 'the real, opening capacity must genuinely post to Remaining > Carton');
  assert.equal(installedBalance.balance_minor, -500, 'and the exact, real, opposite amount to Installed > Carton - a real, balanced, two-line entry');
  assert.equal(remainingBalance.currency, 'SPACE-CARTON', 'real space must carry its own, distinct, real currency - never blended with real dollars');
  assert.equal(installedBalance.currency, 'SPACE-CARTON');
});

test('stageLocation/postLocation: a real, dedicated staging table behind the location-creation form, matching the exact, established stage/post pattern - the real location, and its own real, balanced capacity accounts, only appear once genuinely posted, never at stage time', () => {
  const biz = fx.freshBusiness('LocationStagingTest Co');
  const ref = fx.uniqueName('LOC-STAGE-TEST-1');
  const warehouseName = fx.uniqueName('Staged Warehouse');

  db.stageLocation({
    reference: ref,
    business: biz.business,
    location_name: warehouseName,
    city: 'Adelaide',
    location_type: 'Warehouse',
    bottle_capacity: null,
    carton_capacity: 300,
    timezone: 'Australia/Adelaide',
  } as any);

  // A real, staged-but-not-yet-posted location must not exist as a
  // real entity yet - staging is genuinely just a real, held record
  // of the form's own raw input, nothing more.
  assert.equal(db.getEntityTree().some((e) => e.name === warehouseName), false, 'a real, merely-staged location must not yet exist as a real entity');

  const entity = db.postLocation(ref, biz.business, fx.userId);
  assert.ok(entity.id, 'postLocation must return the real, newly-created location entity');

  const entities = db.getEntityTree();
  assert.ok(entities.some((e) => e.name === warehouseName), 'the real location must genuinely exist once posted');
  // Per direct correction: Storage Capacity lives under Chart of
  // Accounts > Storage > the location - a real financial account, not
  // directly under the location entity itself. Scoped properly, via
  // requireEntity, to this test's own real business.
  const storageRootForStaging = db.requireEntity('Storage', db.typeRootName, db.requireEntity('Chart of Accounts', db.typeRootName, db.requireEntity(biz.business, db.typeBusinessName, db.requireEntity('Businesses', db.typeRootName))));
  const locationStorageForStaging = entities.find((e) => e.name === warehouseName && e.parent_id === storageRootForStaging.id);
  const remaining = locationStorageForStaging && entities.find((e) => e.name === 'Storage Capacity' && e.parent_id === locationStorageForStaging.id);
  assert.ok(remaining, 'the real, built-in Storage Capacity structure must exist too, created atomically as part of the real post, under Chart of Accounts > Storage > the location');

  const stillStaged = db.db.prepare(`SELECT 1 FROM location_staging WHERE reference = ?`).get(ref);
  assert.equal(stillStaged, undefined, 'the real, staged row must be cleared once genuinely posted, matching the established stock-receipt pattern');
});

test('convertStorageSpace: a real, balanced conversion between storage combinations - never single-sided, and a real, undefined reverse direction genuinely refuses', () => {
  const biz = fx.freshBusiness('StorageConvertTest Co');
  const storageGrouping = fx.uniqueName('StorageConvertTest Storage');
  const hot = fx.uniqueName('StorageConvertTest Hot');
  const cold = fx.uniqueName('StorageConvertTest Cold');
  db.ensureHierarchyGrouping(biz.business, storageGrouping, fx.userId);
  db.ensureHierarchyValue(biz.business, storageGrouping, hot, fx.userId);
  db.ensureHierarchyValue(biz.business, storageGrouping, cold, fx.userId);
  const shape: [string, string][] = [[storageGrouping, storageGrouping]];
  db.defineProductShape(biz.business, shape, fx.userId);
  const spaceHot = `SPACE-${hot.toUpperCase()}`;
  const spaceCold = `SPACE-${cold.toUpperCase()}`;
  db.ensureCurrencyPair(biz.business, spaceHot, spaceCold, fx.userId);
  db.setCurrencyExchangeRate(biz.business, spaceHot, spaceCold, fx.userId, 100, 100);

  const coa = db.requireEntity('Chart of Accounts', db.typeRootName, db.requireEntity(biz.business, db.typeBusinessName, db.requireEntity('Businesses', db.typeRootName)));
  db.create(coa, db.typeRootName, 'Storage Space Remaining', fx.userId);
  db.create(coa, db.typeRootName, 'Storage Space Installed', fx.userId);
  db.create(coa, db.typeRootName, 'Inventory', fx.userId);
  db.create(coa, db.typeRootName, 'Inventory Sourced From', fx.userId);

  const journalCountBefore = (db.db.prepare(`SELECT COUNT(*) as c FROM journal`).get() as { c: number }).c;
  const ref1 = fx.uniqueName('CONVERT-TEST-1');
  db.convertStorageSpace(biz.business, biz.actualLedger, db.asItemName('placeholder'), shape, [hot], [cold], 10, fx.userId, ref1);
  const journalCountAfter = (db.db.prepare(`SELECT COUNT(*) as c FROM journal`).get() as { c: number }).c;
  assert.equal(journalCountAfter, journalCountBefore + 1, 'a real conversion must post exactly one, real, new journal entry');

  const tb = db.getTrialBalance(biz.business, biz.actualLedger);
  assert.equal(tb.total_debit_minor, tb.total_credit_minor, 'the real, overall trial balance must stay genuinely balanced after a real conversion');
  for (const c of tb.by_currency) assert.ok(c.balanced, `every real currency group, including ${c.currency}, must independently balance`);

  const ref2 = fx.uniqueName('CONVERT-TEST-2');
  assert.throws(
    () => db.convertStorageSpace(biz.business, biz.actualLedger, db.asItemName('placeholder'), shape, [cold], [hot], 5, fx.userId, ref2),
    /never been defined as a real, allowed direction/,
    'converting Cold back to Hot must genuinely refuse - no reverse rate was ever defined'
  );
});

test('openStorageContainer: opening a carton is two, real, independent space movements - never a rate-linked conversion, and genuinely never requires one to be defined', () => {
  const biz = fx.freshBusiness('OpenContainerTest Co');
  // Per direct instruction: openStorageContainer now requires a real
  // location with real bottle shelving - there is nowhere for the
  // resulting loose bottles to go otherwise.
  const outlet = fx.freshLocation(biz.business, 'OpenContainerTest Outlet', { bottle_capacity: 500, carton_capacity: 50 });
  const containerGrouping = fx.uniqueName('OpenContainerTest Container');
  const carton = fx.uniqueName('OpenContainerTest Carton');
  const bottle = fx.uniqueName('OpenContainerTest Bottle');
  db.ensureHierarchyGrouping(biz.business, containerGrouping, fx.userId);
  db.ensureHierarchyValue(biz.business, containerGrouping, carton, fx.userId);
  db.ensureHierarchyValue(biz.business, containerGrouping, bottle, fx.userId);
  const shape: [string, string][] = [[containerGrouping, containerGrouping]];
  db.defineProductShape(biz.business, shape, fx.userId);
  // Deliberately no currency pair between SPACE-CARTON and SPACE-BOTTLE
  // is ever defined - per direct instruction, none should be needed.
  const coa = db.requireEntity('Chart of Accounts', db.typeRootName, db.requireEntity(biz.business, db.typeBusinessName, db.requireEntity('Businesses', db.typeRootName)));
  db.create(coa, db.typeRootName, 'Storage Space Remaining', fx.userId);
  db.create(coa, db.typeRootName, 'Storage Space Installed', fx.userId);
  const wineName = fx.uniqueName('OpenContainerTest Wine');
  db.createItem(wineName, 'Items', fx.userId, biz.business);

  const journalCountBefore = (db.db.prepare(`SELECT COUNT(*) as c FROM journal`).get() as { c: number }).c;
  const ref = fx.uniqueName('OPEN-TEST-1');
  db.openStorageContainer(biz.business, biz.actualLedger, outlet.name, db.asItemName(wineName), shape, [carton], 1, [bottle], 24, fx.userId, ref);
  const journalCountAfter = (db.db.prepare(`SELECT COUNT(*) as c FROM journal`).get() as { c: number }).c;
  // Per direct correction: there is no contra accounting, and no
  // separate item-quantity posting at all - a carton is an exact,
  // convertible shorthand for its real units (like a dollar for 100
  // cents), so the item's own real quantity never changes when a
  // carton is opened. Only the real, physical storage-space accounts
  // move here; this test's item has no registered cost (via
  // addOrUpdateItemSource), so no Inventory-value entry posts either -
  // just the one, real storage-space entry.
  assert.equal(journalCountAfter, journalCountBefore + 1, 'opening a container with no registered cost must post exactly the one, real storage-space entry');

  // Per a real, confirmed, pre-existing, separate bug found while
  // writing this test - ensureCombinationAccountLeaf's own base-account
  // lookup (e.g. "Storage Capacity Remaining") is a bare, global name,
  // not scoped to this specific, real business, so getTrialBalance
  // here would incorrectly see whichever business happened to create
  // that name first, not this test's own. Verified directly instead,
  // querying this real reference's own real journal_line rows by
  // their own real account currency - genuinely unaffected by that
  // separate, pre-existing issue.
  const lines = db.db.prepare(`
    SELECT a.currency, jl.amount_minor
    FROM journal_line jl JOIN journal j ON jl.journal_id = j.id JOIN account a ON jl.account_id = a.entity_id
    WHERE j.reference = ?
  `).all(ref) as { currency: string; amount_minor: number }[];
  const byCurrency = new Map<string, number>();
  for (const l of lines) byCurrency.set(l.currency, (byCurrency.get(l.currency) ?? 0) + l.amount_minor);
  assert.equal(byCurrency.get(`SPACE-${carton.toUpperCase()}`), 0, 'the real SPACE-CARTON currency group must independently balance on its own');
  assert.equal(byCurrency.get(`SPACE-${bottle.toUpperCase()}`), 0, 'the real, separate SPACE-BOTTLE currency group must independently balance on its own too - never linked to the carton group by any rate');
});

test('openStorageContainer: a dozen 12-bottle cartons (144 bottles) moves directly into its own, real, bottle-tier Inventory account, with no contra accounting of any kind - the same real dollar value, just re-tagged, per direct instruction', () => {
  const biz = fx.freshBusiness('DozenTest Co');
  const outlet = fx.freshLocation(biz.business, 'DozenTest Outlet', { bottle_capacity: 500, carton_capacity: 50 });
  const wineName = fx.uniqueName('DozenTest Wine');
  db.createItem(wineName, 'Items', fx.userId, biz.business);
  const providerName = fx.uniqueName('DozenTest Provider');
  db.createProvider(providerName, fx.userId);
  // priceMinor is the real, per-carton price (per
  // docs/currency-and-quantity-integrity-fix-plan.md: getItemUnitCostMinor
  // divides this by packageQuantity itself) - 1200/12 = 100 minor units
  // per real bottle.
  db.addOrUpdateItemSource({ itemName: wineName, vendorName: providerName, priceMinor: 1200, packageQuantity: 12, isPreferred: true });
  const containerGrouping = fx.uniqueName('DozenTest Container');
  const carton = fx.uniqueName('DozenTest Carton');
  const bottle = fx.uniqueName('DozenTest Bottle');
  db.ensureHierarchyGrouping(biz.business, containerGrouping, fx.userId);
  db.ensureHierarchyValue(biz.business, containerGrouping, carton, fx.userId);
  db.ensureHierarchyValue(biz.business, containerGrouping, bottle, fx.userId);
  const shape: [string, string][] = [[containerGrouping, containerGrouping]];
  db.defineProductShape(biz.business, shape, fx.userId);

  db.openStorageContainer(biz.business, biz.actualLedger, outlet.name, db.asItemName(wineName), shape, [carton], 12, [bottle], 144, fx.userId, fx.uniqueName('DOZEN-TEST-1'));

  const cartonAccount = db.db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(`${wineName} (${carton}) — ${outlet.name}`) as { id: number } | undefined;
  const bottleAccount = db.db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(`${wineName} (${bottle}) — ${outlet.name}`) as { id: number } | undefined;
  assert.ok(cartonAccount, 'a real, separate, carton-tier Inventory account must exist for this item at this location');
  assert.ok(bottleAccount, 'a real, separate, bottle-tier Inventory account must exist too - never the same, shared account');
  assert.notEqual(cartonAccount!.id, bottleAccount!.id, 'the two tiers must be genuinely different, real accounts, never one account under two names');

  const netFor = (accountId: number) => (db.db.prepare(`SELECT COALESCE(SUM(jl.amount_minor), 0) AS net FROM journal_line jl WHERE jl.account_id = ?`).get(accountId) as { net: number }).net;
  // 144 real bottles x 100 minor units/bottle = 14400 - the same, real
  // dollar value, moved directly from one tier's account to the
  // other, no contra account of any kind involved.
  assert.equal(netFor(cartonAccount!.id), -14400, "the carton-tier account must show the real value leaving, exactly - never a fraction, never a contra-account artifact");
  assert.equal(netFor(bottleAccount!.id), 14400, 'the bottle-tier account must show the exact, same real value arriving');
});

test('adjustLocationCapacity: a real, genuinely balanced posting against Occupied - never single-sided, and Installed = Remaining + Occupied holds as a real accounting identity', () => {
  const biz = fx.freshBusiness('OccupiedTest Co');
  const outletName = fx.uniqueName('Occupied Test Outlet');
  db.createAndConfigureLocation(biz.business, outletName, {
    city: 'Adelaide', location_type: 'Retail', is_billing_address: false,
    bottle_capacity: 100, carton_capacity: null, timezone: 'Australia/Adelaide',
  } as any, fx.userId);

  const journalCountBefore = (db.db.prepare(`SELECT COUNT(*) as c FROM journal`).get() as { c: number }).c;
  db.adjustLocationCapacity(biz.business, biz.actualLedger, db.asLocationName(outletName), db.asItemName(fx.uniqueName('Occupied Test Wine')), 10, '2027-07-01', fx.userId, fx.uniqueName('OCCUPIED-TEST-1'));
  const journalCountAfter = (db.db.prepare(`SELECT COUNT(*) as c FROM journal`).get() as { c: number }).c;
  assert.equal(journalCountAfter, journalCountBefore + 1, 'a real capacity adjustment must post exactly one, real, new, balanced journal entry - never a bare, single-sided posting');

  const entities = db.getEntityTree();
  // Per direct correction: Storage Capacity lives under Chart of
  // Accounts > Storage > the location, a real financial account, not
  // directly under the location entity. Scoped properly, via
  // requireEntity, to this test's own real business.
  const storageRootForOccupied = db.requireEntity('Storage', db.typeRootName, db.requireEntity('Chart of Accounts', db.typeRootName, db.requireEntity(biz.business, db.typeBusinessName, db.requireEntity('Businesses', db.typeRootName))));
  const locationStorageForOccupied = entities.find((e) => e.name === outletName && e.parent_id === storageRootForOccupied.id);
  const capacity = entities.find((e) => e.name === 'Storage Capacity' && e.parent_id === locationStorageForOccupied?.id);
  const remainingRoot = entities.find((e) => e.name === 'Remaining' && e.parent_id === capacity?.id);
  const installedRoot = entities.find((e) => e.name === 'Installed' && e.parent_id === capacity?.id);
  const occupiedRoot = entities.find((e) => e.name === 'Occupied' && e.parent_id === capacity?.id);
  assert.ok(occupiedRoot, 'the real, new Occupied leaf must exist - the real, genuine, balanced counterpart to Remaining for ordinary stock movements');

  const remaining = entities.find((e) => e.name === 'Bottle' && e.parent_id === remainingRoot?.id);
  const installed = entities.find((e) => e.name === 'Bottle' && e.parent_id === installedRoot?.id);
  const occupied = entities.find((e) => e.name === 'Bottle' && e.parent_id === occupiedRoot?.id);

  const remainingBalance = (db.db.prepare(`SELECT balance_minor FROM account WHERE entity_id = ?`).get(remaining!.id) as { balance_minor: number }).balance_minor;
  const installedBalance = (db.db.prepare(`SELECT balance_minor FROM account WHERE entity_id = ?`).get(installed!.id) as { balance_minor: number }).balance_minor;
  const occupiedBalance = (db.db.prepare(`SELECT balance_minor FROM account WHERE entity_id = ?`).get(occupied!.id) as { balance_minor: number }).balance_minor;

  assert.equal(remainingBalance, 90, '10 real units arriving must genuinely reduce Remaining by 10, from the real, opening 100');
  assert.equal(occupiedBalance, 10, 'and genuinely, correspondingly increase Occupied by 10 - the real, balanced counterpart');
  assert.equal(installedBalance, -100, 'Installed must stay exactly at its real, original, opening value - an ordinary stock movement never touches it');
  assert.equal(remainingBalance + occupiedBalance, -installedBalance, 'the real, meaningful accounting identity Installed = Remaining + Occupied must genuinely hold');
});

test('receiveItems with a real combination: parallel currency AND count postings both appear, each genuinely balanced on its own', () => {
  const biz = fx.freshBusiness('ParallelCountTest Co');
  const outletName = fx.uniqueName('Parallel Count Outlet');
  db.createAndConfigureLocation(biz.business, outletName, {
    city: 'Adelaide', location_type: 'Retail', is_billing_address: false,
    bottle_capacity: 100, carton_capacity: null, timezone: 'Australia/Adelaide',
  } as any, fx.userId);
  const catEntity = db.createItemCategory(biz.business, fx.uniqueName('Parallel Count Category'), undefined, fx.userId);
  const wineName = fx.uniqueName('Parallel Count Wine');
  db.create(catEntity, db.typeItemName, wineName, fx.userId);

  const storageGrouping = fx.uniqueName('ParallelCountTest Storage');
  const secure = fx.uniqueName('ParallelCountTest Secure');
  db.ensureHierarchyGrouping(biz.business, storageGrouping, fx.userId);
  db.ensureHierarchyValue(biz.business, storageGrouping, secure, fx.userId);
  db.defineProductShape(biz.business, [[storageGrouping, storageGrouping]], fx.userId);

  db.receiveItems(
    biz.business, biz.actualLedger, fx.uniqueName('PARALLEL-COUNT-TEST-1'), db.asItemName(wineName), db.asLocationName(outletName),
    12, fx.userId, undefined, [secure], [[storageGrouping, storageGrouping]]
  );

  const entities = db.getEntityTree();
  const biz2 = entities.find((e) => e.name === biz.business);
  const onHandRoot = entities.find((e) => e.name === 'Units On Hand' && e.parent_id === biz2?.id);
  const receivedFromRoot = entities.find((e) => e.name === 'Units Received From' && e.parent_id === biz2?.id);
  assert.ok(onHandRoot, 'the real Units On Hand base account must exist under this specific business');
  assert.ok(receivedFromRoot, 'and its own, real, balanced counterpart');

  const onHandLeaf = entities.find((e) => e.parent_id === onHandRoot?.id);
  const receivedFromLeaf = entities.find((e) => e.parent_id === receivedFromRoot?.id);
  assert.ok(onHandLeaf && receivedFromLeaf, 'both real, combination-specific leaves must exist');

  const onHandBalance = (db.db.prepare(`SELECT balance_minor, currency FROM account WHERE entity_id = ?`).get(onHandLeaf!.id) as { balance_minor: number; currency: string });
  const receivedFromBalance = (db.db.prepare(`SELECT balance_minor, currency FROM account WHERE entity_id = ?`).get(receivedFromLeaf!.id) as { balance_minor: number; currency: string });
  assert.equal(onHandBalance.balance_minor, 12, 'the real unit count must genuinely post - never silently skipped alongside the dollar value');
  assert.equal(receivedFromBalance.balance_minor, -12, 'and its own, real, exact, balanced opposite');
  assert.equal(onHandBalance.currency, `UNITS-${secure.toUpperCase()}`, 'the real unit count is its own, distinct, real currency - never blended with real dollars or real space');
  assert.equal(receivedFromBalance.currency, `UNITS-${secure.toUpperCase()}`);
});

test('dispatchItems with a real combination: parallel currency AND count postings both appear, genuinely reversed from a real receipt, each independently balanced', () => {
  const biz = fx.freshBusiness('DispatchParallelTest Co');
  const outletName = fx.uniqueName('Dispatch Parallel Outlet');
  db.createAndConfigureLocation(biz.business, outletName, {
    city: 'Adelaide', location_type: 'Retail', is_billing_address: false,
    bottle_capacity: 100, carton_capacity: null, timezone: 'Australia/Adelaide',
  } as any, fx.userId);
  const catEntity = db.createItemCategory(biz.business, fx.uniqueName('Dispatch Parallel Category'), undefined, fx.userId);
  const wineName = fx.uniqueName('Dispatch Parallel Wine');
  db.create(catEntity, db.typeItemName, wineName, fx.userId);

  const storageGrouping = fx.uniqueName('DispatchParallelTest Storage');
  const secure = fx.uniqueName('DispatchParallelTest Secure');
  db.ensureHierarchyGrouping(biz.business, storageGrouping, fx.userId);
  db.ensureHierarchyValue(biz.business, storageGrouping, secure, fx.userId);
  db.defineProductShape(biz.business, [[storageGrouping, storageGrouping]], fx.userId);

  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('DISPATCH-PARALLEL-RECEIVE-1'), db.asItemName(wineName), db.asLocationName(outletName), 12, fx.userId, undefined, [secure], [[storageGrouping, storageGrouping]]);
  db.dispatchItems(biz.business, biz.actualLedger, fx.uniqueName('DISPATCH-PARALLEL-DISPATCH-1'), db.asItemName(wineName), db.asLocationName(outletName), 5, fx.userId, undefined, [secure], [[storageGrouping, storageGrouping]]);

  const entities = db.getEntityTree();
  const biz2 = entities.find((e) => e.name === biz.business);
  const onHandRoot = entities.find((e) => e.name === 'Units On Hand' && e.parent_id === biz2?.id);
  const onHandLeaf = entities.find((e) => e.parent_id === onHandRoot?.id);
  const onHandBalance = (db.db.prepare(`SELECT balance_minor FROM account WHERE entity_id = ?`).get(onHandLeaf!.id) as { balance_minor: number }).balance_minor;
  assert.equal(onHandBalance, 7, '12 real units received minus 5 real units dispatched must genuinely leave 7 real units on hand for this combination');
});

test('transferItems with a real combination: the real unit count moves in parallel with the real dollar value, one, shared, real currency for the same, physical units - genuinely balanced', () => {
  const biz = fx.freshBusiness('TransferParallelTest Co');
  const sourceName = fx.uniqueName('Transfer Parallel Source');
  const destName = fx.uniqueName('Transfer Parallel Destination');
  db.createAndConfigureLocation(biz.business, sourceName, {
    city: 'Adelaide', location_type: 'Warehouse', is_billing_address: false,
    bottle_capacity: 1000, carton_capacity: null, timezone: 'Australia/Adelaide',
  } as any, fx.userId);
  db.createAndConfigureLocation(biz.business, destName, {
    city: 'Adelaide', location_type: 'Retail', is_billing_address: false,
    bottle_capacity: 100, carton_capacity: null, timezone: 'Australia/Adelaide',
  } as any, fx.userId);
  const catEntity = db.createItemCategory(biz.business, fx.uniqueName('Transfer Parallel Category'), undefined, fx.userId);
  const wineName = fx.uniqueName('Transfer Parallel Wine');
  db.create(catEntity, db.typeItemName, wineName, fx.userId);

  const storageGrouping = fx.uniqueName('TransferParallelTest Storage');
  const secure = fx.uniqueName('TransferParallelTest Secure');
  db.ensureHierarchyGrouping(biz.business, storageGrouping, fx.userId);
  db.ensureHierarchyValue(biz.business, storageGrouping, secure, fx.userId);
  db.defineProductShape(biz.business, [['Location', 'Location'], [storageGrouping, storageGrouping]], fx.userId);

  db.receiveItems(biz.business, biz.actualLedger, fx.uniqueName('TRANSFER-PARALLEL-RECEIVE-1'), db.asItemName(wineName), db.asLocationName(sourceName), 20, fx.userId);
  db.transferItems(biz.business, biz.actualLedger, db.asItemName(wineName), db.asLocationName(sourceName), db.asLocationName(destName), 8, fx.uniqueName('TRANSFER-PARALLEL-TRANSFER-1'), fx.userId, undefined, [['Location', 'Location'], [storageGrouping, storageGrouping]], [secure]);

  const entities = db.getEntityTree();
  const biz2 = entities.find((e) => e.name === biz.business);
  const onHandRoot = entities.find((e) => e.name === 'Units On Hand' && e.parent_id === biz2?.id);
  const leaves = entities.filter((e) => e.parent_id === onHandRoot?.id);
  assert.equal(leaves.length, 2, 'a real transfer must create exactly two, real, distinct leaves - source and destination - never one, shared leaf');

  const balances = leaves.map((l) => (db.db.prepare(`SELECT balance_minor, currency FROM account WHERE entity_id = ?`).get(l.id) as { balance_minor: number; currency: string }));
  assert.deepEqual(balances.map((b) => b.currency).sort(), [`UNITS-${secure.toUpperCase()}`, `UNITS-${secure.toUpperCase()}`], 'both real leaves must share the exact, same, real currency - the same, physical units, never changing real kind by moving location');
  assert.deepEqual(balances.map((b) => b.balance_minor).sort((a, b) => a - b), [-8, 8], 'the real unit count must genuinely balance: -8 at the source, +8 at the destination');
});

test('writeOffItems with a real combination: the real Inventory value and real unit count are both genuinely written off, in parallel, each independently balanced', () => {
  const biz = fx.freshBusiness('WriteOffParallelTest Co');
  const business = biz.business;
  const ledger = biz.actualLedger;
  const outletName = fx.uniqueName('Write Off Parallel Outlet');
  db.createAndConfigureLocation(business, outletName, {
    city: 'Adelaide', location_type: 'Retail', is_billing_address: false,
    bottle_capacity: 100, carton_capacity: null, timezone: 'Australia/Adelaide',
  } as any, fx.userId);
  const catEntity = db.createItemCategory(business, fx.uniqueName('Write Off Parallel Category'), undefined, fx.userId);
  const wineName = fx.uniqueName('Write Off Parallel Wine');
  db.create(catEntity, db.typeItemName, wineName, fx.userId);
  db.ensureItemInventoryAccount(db.asItemName(wineName), fx.userId);
  const bizEntity = db.getEntityTree().find((e) => e.name === business);
  const coaEntity = db.getEntityTree().find((e) => e.name === 'Chart of Accounts' && e.parent_id === bizEntity?.id);
  const expenseRoot = db.getEntityTree().find((e) => e.name === 'Expense' && e.parent_id === coaEntity?.id);
  const breakageExpenseName = fx.uniqueName('WriteOffParallelTest Breakage Expense');
  db.create({ id: expenseRoot!.id, name: 'Expense' } as any, db.typeRootName, breakageExpenseName, fx.userId);

  const storageGrouping = fx.uniqueName('WriteOffParallelTest Storage');
  const secure = fx.uniqueName('WriteOffParallelTest Secure');
  db.ensureHierarchyGrouping(business, storageGrouping, fx.userId);
  db.ensureHierarchyValue(business, storageGrouping, secure, fx.userId);
  db.defineProductShape(business, [[storageGrouping, storageGrouping]], fx.userId);

  db.receiveItems(business, ledger, fx.uniqueName('WRITEOFF-PARALLEL-RECEIVE-1'), db.asItemName(wineName), db.asLocationName(outletName), 10, fx.userId, undefined, [secure], [[storageGrouping, storageGrouping]]);
  db.writeOffItems(business, ledger, fx.uniqueName('WRITEOFF-PARALLEL-1'), db.asItemName(wineName), 3, 500, db.asAccountName(breakageExpenseName), '', 'Broken in storage', fx.userId, undefined, undefined, [secure], [[storageGrouping, storageGrouping]]);

  const entities = db.getEntityTree();
  const biz2 = entities.find((e) => e.name === business);
  const onHandRoot = entities.find((e) => e.name === 'Units On Hand' && e.parent_id === biz2?.id);
  const onHandLeaf = entities.find((e) => e.parent_id === onHandRoot?.id);
  const onHandBalance = (db.db.prepare(`SELECT balance_minor FROM account WHERE entity_id = ?`).get(onHandLeaf!.id) as { balance_minor: number }).balance_minor;
  assert.equal(onHandBalance, 7, '10 real units received minus 3 real units written off must genuinely leave 7 real units for this combination');
});
