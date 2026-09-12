lines = []
next_id = 188

def entity(name, parent_expr, is_id=False):
    global next_id
    eid = next_id
    next_id += 1
    parent = str(parent_expr) if is_id else f"(SELECT id FROM current_entities WHERE name = '{parent_expr}')"
    lines.append(f"INSERT INTO entity_ids (id) VALUES ({eid});")
    lines.append(f"INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES ({eid}, {eid}, '{name}', {parent}, '2026-01-01', 1);")
    return eid

lines.append("-- BMW M GmbH: a real, published 2020 HGB balance sheet and P&L,")
lines.append("-- reproduced exactly (see the German comparison work) — proves the")
lines.append("-- concept with real data, not a synthetic example, and now lives here")
lines.append("-- so it is actually visible in the running application, not just in tests.")
biz = entity('BMW M GmbH', 'Businesses')
led = entity('BMW M GmbH Actual', 'BMW M GmbH')

bmw_accounts = [
    ('Immaterielle Vermögensgegenstände', 'Asset'),
    ('Sachanlagen', 'Asset'),
    ('Vorräte', 'Asset'),
    ('Forderungen und sonstige Vermögensgegenstände', 'Asset'),
    ('Kassenbestand und Bankguthaben', 'Asset'),
    ('Rechnungsabgrenzungsposten (Aktiva)', 'Asset'),
    ('Gezeichnetes Kapital', 'Equity'),
    ('Gewinnrücklagen', 'Equity'),
    ('Rückstellungen', 'Liability'),
    ('Erhaltene Anzahlungen', 'Liability'),
    ('Verbindlichkeiten aus Lieferungen und Leistungen', 'Liability'),
    ('Verbindlichkeiten gegenüber verbundenen Unternehmen', 'Liability'),
    ('Sonstige Verbindlichkeiten', 'Liability'),
    ('Umsatzerlöse', 'Income'),
    ('Sonstige betriebliche Erträge', 'Income'),
    ('Herstellungskosten', 'Expense'),
    ('Vertriebskosten', 'Expense'),
    ('Allgemeine Verwaltungskosten', 'Expense'),
    ('Sonstige betriebliche Aufwendungen', 'Expense'),
    ('Zinsergebnis', 'Expense'),
    ('Steuern vom Einkommen und Ertrag', 'Expense'),
    ('Sonstige Steuern', 'Expense'),
    ('Gewinnabführung', 'Expense'),
]
for name, cat in bmw_accounts:
    entity(name, cat)

with open('/tmp/bmw_pcs_entities.sql', 'w') as f:
    f.write("\n".join(lines))
print("BMW entities done, next_id =", next_id)

lines2 = []
lines2.append("")
lines2.append("-- Peugeot Citroën Sochaux SNC: a real, filed 2020 French (PCG) balance")
lines2.append("-- sheet and P&L, reproduced exactly (see the French comparison work).")
biz2 = entity('Peugeot Citroën Sochaux SNC', 'Businesses')
led2 = entity('PCS Actual', 'Peugeot Citroën Sochaux SNC')

pcs_accounts = [
    ('Stocks et en-cours', 'Asset'),
    ('Créances clients et comptes rattachés', 'Asset'),
    ('Autres créances', 'Asset'),
    ('Disponibilités', 'Asset'),
    ('Capital', 'Equity'),
    ('Report à nouveau', 'Equity'),
    ('Provisions pour risques', 'Liability'),
    ('Emprunts et dettes financières divers', 'Liability'),
    ('Dettes fournisseurs et comptes rattachés', 'Liability'),
    ('Dettes fiscales et sociales', 'Liability'),
    ('Autres dettes', 'Liability'),
    ('Ventes de marchandises', 'Income'),
    ('Production vendue - Biens', 'Income'),
    ('Production vendue - Services', 'Income'),
    ('Reprises sur provisions et transferts de charges', 'Income'),
    ('Autres produits', 'Income'),
    ('Produits financiers', 'Income'),
    ('Production stockée (variation)', 'Expense'),
    ('Achats de marchandises', 'Expense'),
    ('Achats de matières premières et autres approvisionnements', 'Expense'),
    ('Variation des stocks de matières premières', 'Expense'),
    ('Autres achats et charges externes', 'Expense'),
    ('Impôts, taxes et versements assimilés', 'Expense'),
    ('Dotations aux provisions sur actif circulant', 'Expense'),
    ('Dotations aux provisions pour risques et charges', 'Expense'),
    ('Autres charges', 'Expense'),
    ('Charges financières', 'Expense'),
    ('Charges exceptionnelles', 'Expense'),
    ('Impôts sur les bénéfices', 'Expense'),
]
for name, cat in pcs_accounts:
    entity(name, cat)

with open('/tmp/pcs_entities.sql', 'w') as f:
    f.write("\n".join(lines[len(lines)-0:]))  # placeholder, will just re-dump full lines below

with open('/tmp/all_bmw_pcs_entities.sql', 'w') as f:
    f.write("\n".join(lines))
print("total entities done, next_id =", next_id)
