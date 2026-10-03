## Foreign businesses (BMW M GmbH, Peugeot Citroën Sochaux SNC) — removed, preserved here

**Removed per direct instruction**: the two foreign, real-worked-example businesses
(BMW M GmbH's real, published 2020 HGB balance sheet/P&L; Peugeot Citroën Sochaux
SNC's real, filed 2020 French PCG balance sheet/P&L) are no longer part of the
initial, loaded data or the active test suite. They were previously created ad hoc
(directly under `Application`, via a bare `create(fetch('Application', typeRootName),
...)`), never through the real, proper `createBusiness` mechanism — no real CoA
prototype prototype, no real Chart of Accounts of their own, no real Vocabulary. That
ad-hoc shape is exactly what caused the collisions found and fixed tonight (a bare
`fetch(name, typeBusinessName)` unable to tell an ad-hoc "business" from a genuine
one).

**Per direct instruction, these are to be properly resurrected later**: each needs
its own, real, dedicated Chart of Accounts prototype prototype (an HGB-shaped one for
BMW, a French PCG-shaped one for Peugeot), and each is to be built entirely through
a real Playwright script — the same rigor as the Wine Retail Business tutorial —
never hand-constructed directly in a test file again.

**The real, exact, worked figures, preserved verbatim below, for that later
reconstruction:**

```typescript
test('proves the concept: BMW M GmbH\'s real, published 2020 HGB balance sheet and P&L reproduce exactly through this system', () => {
  const B = 'BMW M GmbH Proof', L = 'BMW M GmbH Proof Actual';
  create(fetch('Application', typeRootName), typeRootName, B, asUserId(1));
  create(fetch(B, typeRootName), typeRootName, L, asUserId(1));

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
  for (const [name, category] of accounts) create(requireGlobalCoaCategory(category), typeRootName, name, asUserId(1));

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
  for (const [account, amount_minor] of bsLines) stageLine({ reference: 'PROOF-BMW-BS', business: asBusinessName(B), ledger: asLedgerName(L), transdate: '2020-12-31', account: asAccountName(account), amount_minor });
  postJournalEntry('PROOF-BMW-BS', asBusinessName(B), asLedgerName(L), asUserId(1));

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
  for (const [account, amount_minor] of plLines) stageLine({ reference: 'PROOF-BMW-PL', business: asBusinessName(B), ledger: asLedgerName(L), transdate: '2020-12-31', account: asAccountName(account), amount_minor });
  postJournalEntry('PROOF-BMW-PL', asBusinessName(B), asLedgerName(L), asUserId(1));

  const bs = getBalanceSheet(asBusinessName(B), asLedgerName(L));
  const pl = getProfitAndLoss(asBusinessName(B), asLedgerName(L));

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
  create(fetch('Application', typeRootName), typeRootName, B, asUserId(1));
  create(fetch(B, typeRootName), typeRootName, L, asUserId(1));
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
  for (const [name, category] of accounts) create(requireGlobalCoaCategory(category), typeRootName, name, asUserId(1));

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
  for (const [account, amount_minor] of lines) stageLine({ reference: 'PROOF-PCS', business: asBusinessName(B), ledger: asLedgerName(L), transdate: '2020-12-31', account: asAccountName(account), amount_minor });
  postJournalEntry('PROOF-PCS', asBusinessName(B), asLedgerName(L), asUserId(1));

  const bs = getBalanceSheet(asBusinessName(B), asLedgerName(L));
  const pl = getProfitAndLoss(asBusinessName(B), asLedgerName(L));

  // Peugeot Citroën Sochaux SNC's actual, filed figures for FY2020 (EUR).
  assert.equal(bs.total_assets_minor, c(695288909.61));
  assert.equal(bs.total_liabilities_minor, c(1138293826.40));
  assert.equal(bs.total_equity_minor, -c(443004916.79));
  assert.equal(bs.balanced, true);
  assert.equal(pl.net_income_minor, c(6668304.09));
});

```
