"""
Translates all three real Charts of Accounts used in this project into
each language they don't already have: the default CoA (English
canonical, used by "My Business") into German/French/Danish; BMW M
GmbH's CoA (German canonical, real HGB statutory terms) into
English/French/Danish; Peugeot Citroen Sochaux SNC's CoA (French
canonical, real PCG statutory terms) into English/German/Danish.

Where genuinely useful, the default CoA's translations draw on real
terms found in LedgerSMB's national Chart of Accounts templates
(locale/coa/de, locale/coa/fr, locale/coa/dk — cloned from
github.com/ledgersmb/LedgerSMB, GPL-2.0-or-later, not public domain,
same license note as generate-danish-vocabulary.py) - these are
standard, generic accounting concepts (cash, bank, rent, wages) that
map well onto that kind of operational template. BMW's and PCS's own
CoAs use specific statutory balance-sheet terminology (HGB Sec.266, PCG)
that a standard operational CoA template doesn't contain - those
translations are this project's own, direct work, not sourced.
"""

# --- The default CoA (English canonical) -> German, French, Danish ---
# marked 'lsmb' where a term is drawn from LedgerSMB's national CoA
# templates, 'original' where it's this project's own translation.
default_coa = {
    'Cash and Bank': {
        'German': ('Kasse und Bank', 'lsmb'),       # Kasse, Bank both found in locale/coa/de
        'French': ('Caisse et banque', 'original'),
        'Danish': ('Kasse og bank', 'lsmb'),         # Kasse, Bank both found in locale/coa/dk
    },
    'Cost of Goods Sold': {
        'German': ('Wareneinsatz', 'lsmb'),          # locale/coa/de gifi K0
        'French': ('Coût des marchandises vendues', 'original'),
        'Danish': ('Vareforbrug', 'original'),
    },
    'Fixed Assets': {
        'German': ('Anlagevermögen', 'lsmb'),        # locale/coa/de gifi A0
        'French': ('Immobilisations', 'original'),
        'Danish': ('Anlægsaktiver', 'original'),
    },
    'Inventory': {
        'German': ('Warenbestand', 'lsmb'),          # locale/coa/de account 1140
        'French': ('Stock', 'original'),
        'Danish': ('Lager', 'lsmb'),                 # locale/coa/dk accounts 1520-1550
    },
    'Loans Payable': {
        'German': ('Darlehensverbindlichkeiten', 'lsmb'),  # based on locale/coa/de "Darlehen"/"Bankdarlehen"
        'French': ('Emprunts', 'lsmb'),              # locale/coa/fr
        'Danish': ('Lån', 'original'),
    },
    'Miscellaneous': {
        'German': ('Sonstiges', 'lsmb'),             # based on locale/coa/de "Sonstige Kosten"
        'French': ('Divers', 'original'),
        'Danish': ('Diverse', 'original'),
    },
    'Office': {
        'German': ('Büro', 'original'),
        'French': ('Bureau', 'original'),
        'Danish': ('Kontor', 'original'),
    },
    'Other Income': {
        'German': ('Sonstige Erträge', 'original'),
        'French': ('Autres produits', 'original'),
        'Danish': ('Andre indtægter', 'original'),
    },
    "Owner's Equity": {
        'German': ('Eigenkapital', 'lsmb'),          # locale/coa/de "Eigenkapital"
        'French': ('Capital', 'lsmb'),               # locale/coa/fr
        'Danish': ('Egenkapital', 'lsmb'),            # locale/coa/dk "EGENKAPITAL"
    },
    'Purchases Tax Claimed': {
        'German': ('Vorsteuer', 'lsmb'),             # locale/coa/de "Anrechenbare Vorsteuer"
        'French': ('TVA déductible', 'original'),
        'Danish': ('Købsmoms', 'lsmb'),              # locale/coa/dk "Moms indgående"
    },
    'Rent': {
        'German': ('Miete', 'lsmb'),                 # locale/coa/de
        'French': ('Loyer', 'original'),
        'Danish': ('Husleje', 'lsmb'),               # locale/coa/dk
    },
    'Retained Earnings': {
        'German': ('Gewinnvortrag', 'lsmb'),         # locale/coa/de "Gewinnvortrag vor Verwendung"
        'French': ('Bénéfices non distribués', 'original'),
        'Danish': ('Overført resultat', 'original'),
    },
    'Sales Discounts': {
        'German': ('Erlösschmälerungen', 'original'),
        'French': ('Remises sur ventes', 'original'),
        'Danish': ('Salgsrabatter', 'original'),
    },
    'Sales Revenue': {
        'German': ('Umsatzerlöse', 'lsmb'),          # locale/coa/de "Erlöse..." prototype; matches BMW's own term
        'French': ("Chiffre d'affaires", 'original'),
        'Danish': ('Salgsindtægter', 'lsmb'),        # locale/coa/dk "SALGSINDTÆGT"
    },
    'Sales Tax Payable': {
        'German': ('Umsatzsteuer', 'lsmb'),          # locale/coa/de
        'French': ('TVA collectée', 'original'),
        'Danish': ('Salgsmoms', 'original'),
    },
    'Utilities': {
        'German': ('Nebenkosten', 'original'),
        'French': ('Charges locatives', 'original'),
        'Danish': ('Forsyning', 'original'),
    },
    'Wages': {
        'German': ('Löhne und Gehälter', 'lsmb'),    # locale/coa/de "Verbindlichkeiten Löhne und Gehälter"
        'French': ('Salaires', 'original'),
        'Danish': ('Lønninger', 'lsmb'),             # locale/coa/dk "Lønninger og honorarer"
    },
}

# --- BMW M GmbH's CoA (German canonical, real HGB statutory terms)
# -> English, French, Danish. This project's own direct translation -
# no standard operational CoA template contains statutory balance-sheet
# category names like these.
bmw_coa = {
    'Immaterielle Vermögensgegenstände': {'English': 'Intangible assets', 'French': 'Immobilisations incorporelles', 'Danish': 'Immaterielle anlægsaktiver'},
    'Sachanlagen': {'English': 'Property, plant and equipment', 'French': 'Immobilisations corporelles', 'Danish': 'Materielle anlægsaktiver'},
    'Vorräte': {'English': 'Inventories', 'French': 'Stocks', 'Danish': 'Varebeholdninger'},
    'Forderungen und sonstige Vermögensgegenstände': {'English': 'Receivables and other assets', 'French': 'Créances et autres actifs', 'Danish': 'Tilgodehavender og andre aktiver'},
    'Kassenbestand und Bankguthaben': {'English': 'Cash on hand and bank balances', 'French': 'Caisse et avoirs bancaires', 'Danish': 'Kontante beholdninger og bankindeståender'},
    'Rechnungsabgrenzungsposten (Aktiva)': {'English': 'Prepaid expenses', 'French': 'Charges constatées d\u2019avance', 'Danish': 'Periodeafgrænsningsposter (aktiver)'},
    'Gezeichnetes Kapital': {'English': 'Subscribed capital', 'French': 'Capital souscrit', 'Danish': 'Selskabskapital'},
    'Gewinnrücklagen': {'English': 'Retained earnings', 'French': 'Réserves', 'Danish': 'Overført resultat'},
    'Rückstellungen': {'English': 'Provisions', 'French': 'Provisions', 'Danish': 'Hensættelser'},
    'Erhaltene Anzahlungen': {'English': 'Advance payments received', 'French': 'Avances et acomptes reçus', 'Danish': 'Modtagne forudbetalinger'},
    'Verbindlichkeiten aus Lieferungen und Leistungen': {'English': 'Trade payables', 'French': 'Dettes fournisseurs', 'Danish': 'Leverandørgæld'},
    'Verbindlichkeiten gegenüber verbundenen Unternehmen': {'English': 'Amounts owed to affiliated companies', 'French': 'Dettes envers des entreprises liées', 'Danish': 'Gæld til tilknyttede virksomheder'},
    'Sonstige Verbindlichkeiten': {'English': 'Other liabilities', 'French': 'Autres dettes', 'Danish': 'Anden gæld'},
    'Umsatzerlöse': {'English': 'Revenues', 'French': "Chiffre d'affaires", 'Danish': 'Omsætning'},
    'Sonstige betriebliche Erträge': {'English': 'Other operating income', 'French': "Autres produits d'exploitation", 'Danish': 'Andre driftsindtægter'},
    'Herstellungskosten': {'English': 'Production costs', 'French': 'Coûts de production', 'Danish': 'Produktionsomkostninger'},
    'Vertriebskosten': {'English': 'Distribution costs', 'French': 'Frais de distribution', 'Danish': 'Distributionsomkostninger'},
    'Allgemeine Verwaltungskosten': {'English': 'General administrative expenses', 'French': 'Frais administratifs généraux', 'Danish': 'Generelle administrationsomkostninger'},
    'Sonstige betriebliche Aufwendungen': {'English': 'Other operating expenses', 'French': "Autres charges d'exploitation", 'Danish': 'Andre driftsomkostninger'},
    'Zinsergebnis': {'English': 'Interest result', 'French': 'Résultat financier', 'Danish': 'Finansielle poster'},
    'Steuern vom Einkommen und Ertrag': {'English': 'Taxes on income', 'French': 'Impôts sur le résultat', 'Danish': 'Skat af årets resultat'},
    'Sonstige Steuern': {'English': 'Other taxes', 'French': 'Autres impôts', 'Danish': 'Andre skatter og afgifter'},
    'Gewinnabführung': {'English': 'Profit transferred under profit-and-loss transfer agreement', 'French': 'Transfert de bénéfice', 'Danish': 'Overført resultat til moderselskab'},
}

# --- Peugeot Citroen Sochaux SNC's CoA (French canonical, real PCG
# statutory terms) -> English, German, Danish.
pcs_coa = {
    'Stocks et en-cours': {'English': 'Inventory and work in progress', 'German': 'Vorräte und unfertige Erzeugnisse', 'Danish': 'Varebeholdninger og igangværende arbejder'},
    'Créances clients et comptes rattachés': {'English': 'Trade receivables', 'German': 'Forderungen aus Lieferungen und Leistungen', 'Danish': 'Tilgodehavender fra salg'},
    'Autres créances': {'English': 'Other receivables', 'German': 'Sonstige Forderungen', 'Danish': 'Andre tilgodehavender'},
    'Disponibilités': {'English': 'Cash at bank and in hand', 'German': 'Kassenbestand und Bankguthaben', 'Danish': 'Likvide beholdninger'},
    'Capital': {'English': 'Share capital', 'German': 'Gezeichnetes Kapital', 'Danish': 'Selskabskapital'},
    'Report à nouveau': {'English': 'Retained earnings brought forward', 'German': 'Gewinnvortrag', 'Danish': 'Overført resultat fra tidligere år'},
    'Provisions pour risques': {'English': 'Provisions for risks', 'German': 'Rückstellungen für Risiken', 'Danish': 'Hensættelser til risici'},
    'Emprunts et dettes financières divers': {'English': 'Borrowings and miscellaneous financial debt', 'German': 'Finanzverbindlichkeiten', 'Danish': 'Lån og anden finansiel gæld'},
    'Dettes fournisseurs et comptes rattachés': {'English': 'Trade payables', 'German': 'Verbindlichkeiten aus Lieferungen und Leistungen', 'Danish': 'Leverandørgæld'},
    'Dettes fiscales et sociales': {'English': 'Tax and social security liabilities', 'German': 'Steuer- und Sozialverbindlichkeiten', 'Danish': 'Skyldig skat og sociale bidrag'},
    'Autres dettes': {'English': 'Other liabilities', 'German': 'Sonstige Verbindlichkeiten', 'Danish': 'Anden gæld'},
    'Ventes de marchandises': {'English': 'Sales of goods', 'German': 'Warenverkäufe', 'Danish': 'Varesalg'},
    'Production vendue - Biens': {'English': 'Sales of manufactured goods', 'German': 'Umsatzerlöse aus Erzeugnissen', 'Danish': 'Salg af producerede varer'},
    'Production vendue - Services': {'English': 'Sales of services', 'German': 'Umsatzerlöse aus Dienstleistungen', 'Danish': 'Salg af tjenesteydelser'},
    'Reprises sur provisions et transferts de charges': {'English': 'Reversals of provisions and expense transfers', 'German': 'Auflösung von Rückstellungen', 'Danish': 'Tilbageførsel af hensættelser'},
    'Autres produits': {'English': 'Other income', 'German': 'Sonstige Erträge', 'Danish': 'Andre indtægter'},
    'Produits financiers': {'English': 'Financial income', 'German': 'Finanzerträge', 'Danish': 'Finansielle indtægter'},
    'Production stockée (variation)': {'English': 'Change in inventory of finished goods', 'German': 'Bestandsveränderung fertiger Erzeugnisse', 'Danish': 'Ændring i varebeholdning'},
    'Achats de marchandises': {'English': 'Purchases of goods', 'German': 'Wareneinkäufe', 'Danish': 'Varekøb'},
    'Achats de matières premières et autres approvisionnements': {'English': 'Purchases of raw materials and supplies', 'German': 'Materialaufwand', 'Danish': 'Køb af råvarer'},
    'Variation des stocks de matières premières': {'English': 'Change in raw material inventory', 'German': 'Bestandsveränderung Rohstoffe', 'Danish': 'Ændring i råvarelager'},
    'Autres achats et charges externes': {'English': 'Other purchases and external expenses', 'German': 'Sonstige betriebliche Aufwendungen', 'Danish': 'Andre eksterne omkostninger'},
    'Impôts, taxes et versements assimilés': {'English': 'Taxes and similar payments', 'German': 'Steuern und Abgaben', 'Danish': 'Skatter og afgifter'},
    'Dotations aux provisions sur actif circulant': {'English': 'Provisions on current assets', 'German': 'Zuführung Wertberichtigungen Umlaufvermögen', 'Danish': 'Hensættelser vedr. omsætningsaktiver'},
    'Dotations aux provisions pour risques et charges': {'English': 'Provisions for risks and charges', 'German': 'Zuführung Rückstellungen', 'Danish': 'Hensættelser til risici og forpligtelser'},
    'Autres charges': {'English': 'Other expenses', 'German': 'Sonstige Aufwendungen', 'Danish': 'Andre omkostninger'},
    'Charges financières': {'English': 'Financial expenses', 'German': 'Finanzaufwendungen', 'Danish': 'Finansielle omkostninger'},
    'Charges exceptionnelles': {'English': 'Exceptional expenses', 'German': 'Außerordentliche Aufwendungen', 'Danish': 'Ekstraordinære omkostninger'},
    'Impôts sur les bénéfices': {'English': 'Income tax', 'German': 'Ertragsteuern', 'Danish': 'Selskabsskat'},
}

if __name__ == '__main__':
    print("Default CoA:", len(default_coa), "accounts x 3 languages =", len(default_coa) * 3)
    print("BMW CoA:", len(bmw_coa), "accounts x 3 languages =", len(bmw_coa) * 3)
    print("PCS CoA:", len(pcs_coa), "accounts x 3 languages =", len(pcs_coa) * 3)
    total = len(default_coa) * 3 + len(bmw_coa) * 3 + len(pcs_coa) * 3
    print("Total translation entries:", total)

    with open('/tmp/coa_translations_schema.sql', 'w', encoding='utf-8') as f:
        for word, langs in default_coa.items():
            we = word.replace("'", "''")
            for lang, (text, src) in langs.items():
                te = text.replace("'", "''")
                f.write(f"INSERT INTO translation_entry (entity, language, text) VALUES ('{we}', '{lang}', '{te}');\n")
        for word, langs in bmw_coa.items():
            we = word.replace("'", "''")
            for lang, text in langs.items():
                te = text.replace("'", "''")
                f.write(f"INSERT INTO translation_entry (entity, language, text) VALUES ('{we}', '{lang}', '{te}');\n")
        for word, langs in pcs_coa.items():
            we = word.replace("'", "''")
            for lang, text in langs.items():
                te = text.replace("'", "''")
                f.write(f"INSERT INTO translation_entry (entity, language, text) VALUES ('{we}', '{lang}', '{te}');\n")
    print("SQL written to /tmp/coa_translations_schema.sql")
