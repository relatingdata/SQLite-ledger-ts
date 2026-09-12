"""
Generates schema.sql bootstrap SQL for two new demo businesses:
- Ditta Italiana Srl (a real, representative subset of Tekki's
  Italy-UTF8_General-chart.sql)
- Schweizer KMU AG (a real, representative subset shared between
  Tekki's Swiss French/Italian charts, which use identical account
  numbers — proving the translation mechanism directly, not three
  disconnected businesses)

Adapted from Tekki's SQL-Ledger fork (GPLv3):
https://github.com/Tekki/sql-ledger — see NOTICE.md for provenance.
GIFI codes are a public standard; the specific chart structures and
wording are Tekki's/DWS's own work.
"""

CAT_MAP = {'A': 'Asset', 'L': 'Liability', 'Q': 'Equity', 'I': 'Income', 'E': 'Expense'}

# id 311 = Italian language; 312 = Ditta Italiana Srl business;
# 313 = its Actual ledger; 314+ = its accounts;
# 340 = Schweizer KMU AG business; 341 = its Actual ledger; 342+ = its accounts.
NEXT_ID = 311

def next_id():
    global NEXT_ID
    v = NEXT_ID
    NEXT_ID += 1
    return v

lines = []

def entity(name, parent_name_or_id, eid=None):
    eid = eid or next_id()
    parent_expr = f"(SELECT id FROM current_entities WHERE name = '{esc(parent_name_or_id)}')" if isinstance(parent_name_or_id, str) else str(parent_name_or_id)
    lines.append(f"INSERT INTO entity_ids (id) VALUES ({eid});")
    lines.append(f"INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES ({eid}, {eid}, '{esc(name)}', {parent_expr}, '2026-01-01', 1);")
    return eid

def esc(s):
    return s.replace("'", "''")

def account_entry(name, accountnumber, category, sibling_report):
    lines.append(f"INSERT INTO account_entry (name, accountnumber) VALUES ('{esc(name)}', '{esc(accountnumber)}');")

def translation(entity_name, language, text):
    lines.append(f"INSERT INTO translation_entry (entity, language, text) VALUES ('{esc(entity_name)}', '{language}', '{esc(text)}');")

# --- Italian language ---
italian_id = entity('Italian', 'Languages')
CORE_VOCAB_IT = {
    'Account': 'Conto', 'Account Number': 'Numero di conto', 'Accounts Payable': 'Debitori',
    'Accounts Receivable': 'Crediti', 'Amount': 'Importo', 'Assets': 'Attivi', 'Balance': 'Saldo',
    'Balance Sheet': 'Bilancio', 'Business': 'Azienda', 'Cash and Bank': 'Cassa e banca',
    'Credit': 'Avere', 'Customers': 'Clienti', 'Date': 'Data', 'Debit': 'Dare',
    'Description': 'Descrizione', 'Email': 'E-mail', 'Equity': 'Capitale proprio', 'Expenses': 'Spese',
    'Income': 'Ricavo', 'Invoice': 'Fattura', 'Journal Entries': 'Registrazioni contabili',
    'Language': 'Lingua', 'Ledger': 'Registro', 'Liabilities': 'Passivi',
    'Net Income': 'Utile netto', 'Net Loss': 'Perdita netta', 'Page': 'Pagina',
    'Password': 'Password', 'Phone': 'Telefono', 'Posted by': 'Registrato da',
    'Profit and Loss Statement': 'Conto economico', 'Reference': 'Riferimento', 'Reports': 'Rapporti',
    'Sales Invoices': 'Fatture di vendita', 'Sales Revenue': 'Ricavi delle vendite',
    'Sales Tax Payable': 'IVA da versare', 'Total': 'Totale', 'Total Assets': 'Totale attivi',
    'Total Equity': 'Totale capitale proprio', 'Total Expenses': 'Totale spese',
    'Total Income': 'Totale ricavi', 'Total Liabilities': 'Totale passivi',
    'Trial Balance': 'Bilancio di verifica', 'Username': 'Nome utente', 'Vendors': 'Fornitori',
}
for en, it_text in CORE_VOCAB_IT.items():
    translation(en, 'Italian', it_text)

# --- Ditta Italiana Srl ---
italy_biz = entity('Ditta Italiana Srl', 'Businesses')
italy_ledger = entity('Ditta Italiana Srl Actual', italy_biz)

# A real, representative subset from Tekki's Italy-UTF8_General-chart.sql
ITALY_ACCOUNTS = [
    ('4480105', 'Banca c/c', 'A', 'AR_paid:AP_paid'),
    ('4480500', 'Cassa e valori', 'A', 'AR_paid:AP_paid'),
    ('4001001', 'Crediti verso clienti per fatture emesse', 'A', 'AR'),
    ('3020005', 'Rimanenze prodotti finiti', 'A', 'IC'),
    ('2255025', 'Autovetture', 'A', ''),
    ('6435005', 'Banca di ... c/c', 'L', ''),
    ('5005005', 'Capitale sociale', 'Q', ''),
    ('5020005', 'Riserva legale', 'Q', ''),
    ('5080005', 'Utili esercizi precedenti', 'Q', ''),
    ('8005005', 'Ricavi cessione beni', 'I', 'AR_amount:IC_sale'),
    ('8015005', 'Ricavi per prestazioni a terzi', 'I', 'AR_amount:IC_income'),
    ('7005005', 'Materie prime', 'E', 'AP_amount:IC_cogs:IC_expense'),
    ('7005015', 'Merci destinate alla rivendita', 'E', 'AP_amount:IC_cogs'),
    ('7025005', 'Energia elettrica', 'E', 'AP_amount'),
    ('7025015', 'Spese telefoniche', 'E', 'AP_amount'),
    ('7025030', 'Spese di assicurazione', 'E', 'AP_amount'),
]
IT_EN_GLOSS = {
    'Banca c/c': 'Bank Current Account', 'Cassa e valori': 'Cash and Valuables',
    'Crediti verso clienti per fatture emesse': 'Trade Receivables', 'Rimanenze prodotti finiti': 'Finished Goods Inventory',
    'Autovetture': 'Motor Vehicles', 'Banca di ... c/c': 'Bank Overdraft',
    'Capitale sociale': 'Share Capital', 'Riserva legale': 'Legal Reserve',
    'Utili esercizi precedenti': 'Retained Earnings', 'Ricavi cessione beni': 'Sales of Goods',
    'Ricavi per prestazioni a terzi': 'Service Revenue', 'Materie prime': 'Raw Materials',
    'Merci destinate alla rivendita': 'Goods for Resale', 'Energia elettrica': 'Electricity',
    'Spese telefoniche': 'Telephone Expenses', 'Spese di assicurazione': 'Insurance Expense',
}
IT_DE_GLOSS = {
    'Banca c/c': 'Bankkonto', 'Cassa e valori': 'Kasse und Wertsachen',
    'Crediti verso clienti per fatture emesse': 'Forderungen aus Lieferungen', 'Rimanenze prodotti finiti': 'Fertigerzeugnisse',
    'Autovetture': 'Fahrzeuge', 'Banca di ... c/c': 'Bankkontokorrent',
    'Capitale sociale': 'Grundkapital', 'Riserva legale': 'Gesetzliche Rücklage',
    'Utili esercizi precedenti': 'Gewinnvortrag', 'Ricavi cessione beni': 'Warenverkaufserlöse',
    'Ricavi per prestazioni a terzi': 'Dienstleistungserlöse', 'Materie prime': 'Rohstoffe',
    'Merci destinate alla rivendita': 'Handelswaren', 'Energia elettrica': 'Stromkosten',
    'Spese telefoniche': 'Telefonkosten', 'Spese di assicurazione': 'Versicherungsaufwand',
}
IT_FR_GLOSS = {
    'Banca c/c': 'Compte bancaire', 'Cassa e valori': 'Caisse et valeurs',
    'Crediti verso clienti per fatture emesse': 'Créances clients', 'Rimanenze prodotti finiti': 'Produits finis',
    'Autovetture': 'Véhicules', 'Banca di ... c/c': 'Découvert bancaire',
    'Capitale sociale': 'Capital social', 'Riserva legale': 'Réserve légale',
    'Utili esercizi precedenti': 'Bénéfices reportés', 'Ricavi cessione beni': 'Ventes de marchandises',
    'Ricavi per prestazioni a terzi': "Produits des prestations", 'Materie prime': 'Matières premières',
    'Merci destinate alla rivendita': 'Marchandises destinées à la revente', 'Energia elettrica': 'Électricité',
    'Spese telefoniche': 'Frais téléphoniques', 'Spese di assicurazione': "Frais d'assurance",
}

for accno, desc, cat, link in ITALY_ACCOUNTS:
    aid = entity(desc, CAT_MAP[cat])
    account_entry(desc, accno, cat, None)
    translation(desc, 'English', IT_EN_GLOSS[desc])
    translation(desc, 'German', IT_DE_GLOSS[desc])
    translation(desc, 'French', IT_FR_GLOSS[desc])

# --- Schweizer KMU AG — German account names as primary, real French/Italian translations from Tekki's own parallel charts ---
swiss_biz = entity('Schweizer KMU AG', 'Businesses')
swiss_ledger = entity('Schweizer KMU AG Actual', swiss_biz)

# (accno, German name, category, French translation, Italian translation, English gloss)
SWISS_ACCOUNTS = [
    ('1000', 'Kasse', 'A', 'Caisse', 'Cassa', 'Cash on Hand'),
    ('1020', 'Bank', 'A', 'Banque', 'Banca', 'Bank'),
    ('1100', 'Debitoren', 'A', 'Débiteurs', 'Debitori', 'Accounts Receivable'),
    ('1200', 'Handelswaren', 'A', 'Marchandises commerciales', 'Merci commerciali', 'Merchandise Inventory'),
    ('1210', 'Rohstoffe', 'A', 'Matières premières', 'Materie prime', 'Raw Materials'),
    ('1520', 'Büromaschinen, Informatik', 'A', 'Machines de bureau, installations informatiques', 'Informatici', 'Office & IT Equipment'),
    ('2000', 'Kreditoren', 'L', 'Créanciers', 'Creditori', 'Accounts Payable'),
    ('2030', 'Anzahlungen von Kunden', 'L', 'Paiements antinicpés des clients', 'Pagamenti in anticipo di clienti', 'Customer Advances'),
    ('2100', 'Bankkontokorrent', 'L', 'Banque compte courant', 'Banca conto corrente', 'Bank Overdraft'),
    ('2800', 'Aktienkapital', 'Q', 'Capital-actions', 'Capitale azionario', 'Share Capital'),
    ('3200', 'Warenertrag', 'I', 'Rendement de la marchandise', 'Profitto da merci', 'Merchandise Revenue'),
    ('3400', 'Dienstleistungsertrag', 'I', 'Rendement des services', 'Profitto da servizi', 'Service Revenue'),
    ('4200', 'Warenaufwand', 'E', 'Charges de marchandises', 'Spese di merci', 'Cost of Merchandise'),
    ('4400', 'Aufwand für Dienstleistungen', 'E', 'Dépenses pour services', 'Spese per servizi', 'Cost of Services'),
    ('6500', 'Verwaltungsaufwand', 'E', 'Frais de gestion', 'Spese amministrative e IT', 'Administrative Expenses'),
    ('6800', 'Finanzaufwand', 'E', "Charges d'intérêts financières", 'Spese per interessi o oneri finanziari', 'Financial Expenses'),
    ('8900', 'Steuern', 'I', 'Impôts', 'Imposte', 'Taxes'),
]

for accno, name, cat, fr_name, it_name, en_gloss in SWISS_ACCOUNTS:
    aid = entity(name, CAT_MAP[cat])
    account_entry(name, f'CH-{accno}', cat, None)
    translation(name, 'French', fr_name)
    translation(name, 'Italian', it_name)
    translation(name, 'English', en_gloss)

with open('/tmp/italy_swiss_bootstrap.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

print(f"Generated {len(lines)} SQL statements, next free id would be {NEXT_ID}")
