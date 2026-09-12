lines = []

def eur_cents(t_eur):
    return round(t_eur * 100)

def stage(ref, biz, led, account, cents, transdate='2020-12-31'):
    lines.append(f"INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_cents)")
    lines.append(f"VALUES ('{ref}', '{biz}', '{led}', '{transdate}', '{account}', {cents});")

# --- BMW M GmbH: balance sheet + P&L in ONE combined transaction ---
# (independent BS+P&L only worked because BMW's net income is exactly
# zero — reusing the exact same approach already proven correct)
lines.append("-- BMW M GmbH FY2020 balance sheet")
BIZ, LED = 'BMW M GmbH', 'BMW M GmbH Actual'
def teur(t): return round(t * 1000 * 100)

bs = [
    ('Immaterielle Vermögensgegenstände', teur(372)),
    ('Sachanlagen', teur(26013)),
    ('Vorräte', teur(1445)),
    ('Forderungen und sonstige Vermögensgegenstände', teur(68244)),
    ('Kassenbestand und Bankguthaben', teur(221)),
    ('Rechnungsabgrenzungsposten (Aktiva)', teur(553)),
    ('Gezeichnetes Kapital', -teur(26)),
    ('Gewinnrücklagen', -teur(391)),
    ('Rückstellungen', -teur(32969)),
    ('Erhaltene Anzahlungen', -teur(50751)),
    ('Verbindlichkeiten aus Lieferungen und Leistungen', -teur(12601)),
    ('Verbindlichkeiten gegenüber verbundenen Unternehmen', -teur(76)),
    ('Sonstige Verbindlichkeiten', -teur(34)),
]
for acct, cents in bs:
    stage('BMW-BS-2020', BIZ, LED, acct, cents)

pl = [
    ('Umsatzerlöse', -teur(436058)),
    ('Sonstige betriebliche Erträge', -teur(3661)),
    ('Herstellungskosten', teur(283275)),
    ('Vertriebskosten', teur(35842)),
    ('Allgemeine Verwaltungskosten', teur(22690)),
    ('Sonstige betriebliche Aufwendungen', teur(314)),
    ('Zinsergebnis', teur(1129)),
    ('Steuern vom Einkommen und Ertrag', teur(21)),
    ('Sonstige Steuern', teur(3)),
    ('Gewinnabführung', teur(96445)),
]
for acct, cents in pl:
    stage('BMW-PL-2020', BIZ, LED, acct, cents)

lines.append("")
lines.append("INSERT INTO post_journal_entry (reference, business, ledger, user_id) VALUES ('BMW-BS-2020', 'BMW M GmbH', 'BMW M GmbH Actual', 1);")
lines.append("INSERT INTO post_journal_entry (reference, business, ledger, user_id) VALUES ('BMW-PL-2020', 'BMW M GmbH', 'BMW M GmbH Actual', 1);")

# --- Peugeot Citroën Sochaux SNC: ONE combined transaction (BS+P&L together) ---
lines.append("")
lines.append("-- Peugeot Citroën Sochaux SNC FY2020 — balance sheet and P&L combined")
lines.append("-- into one genuinely balanced transaction (a non-zero net income")
lines.append("-- means these cannot be two independent postings — see the French")
lines.append("-- comparison work for why).")
BIZ2, LED2 = 'Peugeot Citroën Sochaux SNC', 'PCS Actual'
def c(eur): return round(eur * 100)

pcs_lines = [
    ('Stocks et en-cours', c(87405871.03)),
    ('Créances clients et comptes rattachés', c(592920454.84)),
    ('Autres créances', c(14962484.95)),
    ('Disponibilités', c(98.79)),
    ('Capital', -c(40000000.00)),
    ('Report à nouveau', c(489673220.88)),
    ('Provisions pour risques', -c(396796.00)),
    ('Emprunts et dettes financières divers', -c(525992682.76)),
    ('Dettes fournisseurs et comptes rattachés', -c(600722338.25)),
    ('Dettes fiscales et sociales', -c(3834150.86)),
    ('Autres dettes', -c(7347858.53)),
    ('Ventes de marchandises', -c(3105459.78)),
    ('Production vendue - Biens', -c(4568360419.09)),
    ('Production vendue - Services', -c(36790878.93)),
    ('Reprises sur provisions et transferts de charges', -c(6486139.10)),
    ('Autres produits', -c(4014786.25)),
    ('Produits financiers', -c(843557.36)),
    ('Production stockée (variation)', c(15963620.93)),
    ('Achats de marchandises', c(304712.46)),
    ('Achats de matières premières et autres approvisionnements', c(4100665453.06)),
    ('Variation des stocks de matières premières', -c(1061094.58)),
    ('Autres achats et charges externes', c(478280283.63)),
    ('Impôts, taxes et versements assimilés', c(6452417.31)),
    ('Dotations aux provisions sur actif circulant', c(5716459.43)),
    ('Dotations aux provisions pour risques et charges', c(391318.00)),
    ('Autres charges', c(196.57)),
    ('Charges financières', c(4581579.61)),
    ('Charges exceptionnelles', c(25715.00)),
    ('Impôts sur les bénéfices', c(1612275.00)),
]
for acct, cents in pcs_lines:
    stage('PCS-2020', BIZ2, LED2, acct, cents)

lines.append("")
lines.append("INSERT INTO post_journal_entry (reference, business, ledger, user_id) VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'PCS Actual', 1);")

with open('/tmp/bmw_pcs_postings.sql', 'w') as f:
    f.write("\n".join(lines))
print("done, total lines:", len(lines))
