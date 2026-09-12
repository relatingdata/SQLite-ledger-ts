"""
Generates Danish translations for every vocabulary word in this
project. 47 of these come directly (or lightly adapted from a singular
form) from LedgerSMB's real, human-translated Danish locale file
(locale/po/da.po, translator Mikkel Hoegh, 2016) - LedgerSMB being the
active fork of the original Perl SQL-Ledger this project draws its
concepts from. IMPORTANT CORRECTION: LedgerSMB (and SQL-Ledger before
it) are GPL-2.0-or-later licensed, not public domain. What's used here
is individual short word/phrase translation pairs (e.g. "Account" ->
"Konto") - factual, non-creative data comparable to dictionary entries,
not copied prose, code, or structure. The remaining ~64 words (not
present in that file) are original translations for this project.

Source file for the sourced portion:
https://github.com/ledgersmb/LedgerSMB/blob/master/locale/po/da.po
"""

# word -> (Danish, source)
# source: 'ledgersmb' (found in da.po, used directly or adapted from a
# singular/related form) or 'original' (this project's own translation)
danish = {
    'Account': ('Konto', 'ledgersmb'),
    'Account Number': ('Kontonummer', 'ledgersmb'),
    'Accounts Payable': ('Kreditor', 'ledgersmb'),
    'Accounts Receivable': ('Debitor', 'ledgersmb'),
    'Add': ('Tilføj', 'ledgersmb'),
    'Aged Payables': ('Forfaldne kreditorer', 'original'),
    'Aged Receivables': ('Forfaldne debitorer', 'original'),
    'Assets': ('Aktiver', 'ledgersmb'),  # adapted from da.po's 'Asset' -> 'Aktiv'
    'Balance': ('Balance', 'ledgersmb'),
    'Balance Sheet': ('Status', 'ledgersmb'),
    'Below Reorder': ('Under genbestillingsniveau', 'original'),
    'Billing Address': ('Faktureringsadresse', 'original'),
    'Bought': ('Købt', 'original'),
    'Business': ('Forretning', 'ledgersmb'),
    'Cancel': ('Annulér', 'ledgersmb'),
    'Category': ('Kategori', 'ledgersmb'),
    'Change Password': ('Skift adgangskode', 'original'),
    'City': ('By', 'ledgersmb'),
    'Compare Ledgers': ('Sammenlign bøger', 'original'),
    'Complete': ('Afslut', 'original'),
    'Confirm New Password': ('Bekræft ny adgangskode', 'original'),
    'Continue': ('Fortsæt', 'ledgersmb'),
    'Could Not Log In': ('Kunne ikke logge ind', 'original'),
    'Counted': ('Talt', 'original'),
    'Credit': ('Kredit', 'ledgersmb'),
    'Current Password': ('Nuværende adgangskode', 'original'),
    'Current Year Earnings': ('Årets resultat', 'original'),
    'Customers': ('Kunder', 'ledgersmb'),  # adapted from da.po's 'Customer' -> 'Kunde'
    'Date': ('Dato', 'ledgersmb'),
    'Debit': ('Debet', 'ledgersmb'),
    'Delete': ('Fjern', 'ledgersmb'),
    'Description': ('Beskrivelse', 'ledgersmb'),
    'Draft': ('Kladde', 'original'),
    'Edit': ('Redigér', 'ledgersmb'),
    'Email': ('E-mail', 'original'),
    'Entity Tree': ('Enhedstræ', 'original'),
    'Equity': ('Egenkapital', 'ledgersmb'),
    'Expected': ('Forventet', 'ledgersmb'),
    'Expenses': ('Udgifter', 'ledgersmb'),  # adapted from da.po's 'Expense' -> 'Udgift'
    'Expiration Date': ('Udløbsdato', 'original'),
    'Expiring Stock': ('Udløbende lager', 'original'),
    'From': ('Fra', 'ledgersmb'),
    'General Journal': ('Finanskladde', 'original'),
    'History': ('Historik', 'original'),
    'Income': ('Indtægt', 'ledgersmb'),
    'Journal Entries': ('Journalposteringer', 'original'),
    'Language': ('Sprog', 'ledgersmb'),
    'Ledger': ('Hovedbog', 'original'),
    'Level': ('Niveau', 'original'),
    'Liabilities': ('Passiver', 'ledgersmb'),  # adapted from da.po's 'Liability' -> 'Passiv'
    'Log In': ('Log på', 'ledgersmb'),  # adapted from da.po's 'Login' -> 'Log på'
    'Log Out': ('Log af', 'ledgersmb'),  # adapted from da.po's 'Logout' -> 'Log af'
    'Logging In': ('Logger ind', 'original'),
    'Lot Number': ('Partinummer', 'original'),
    'Memo': ('Note', 'ledgersmb'),
    'Name': ('Navn', 'ledgersmb'),
    'Net Income': ('Nettooverskud', 'original'),
    'Net Loss': ('Nettotab', 'original'),
    'New': ('Ny', 'original'),
    'New Password': ('Ny adgangskode', 'original'),
    'No Entries Yet': ('Endnu ingen posteringer', 'original'),
    'On Hand': ('På lager', 'ledgersmb'),
    'Outstanding': ('Udestående', 'ledgersmb'),
    'Parent': ('Overordnet', 'original'),
    'Password': ('Adgangskode', 'ledgersmb'),
    'Password Changed': ('Adgangskode ændret', 'original'),
    'Payment': ('Betaling', 'ledgersmb'),
    'Phone': ('Tel.', 'ledgersmb'),
    'Profit and Loss Statement': ('Resultatopgørelse', 'original'),
    'Purchase': ('Indkøb', 'original'),
    'Purchase Invoices': ('Købsfakturaer', 'original'),
    'Rack': ('Reol', 'original'),
    'Reason': ('Årsag', 'original'),
    'Receipt': ('Kvittering', 'ledgersmb'),
    'Received Date': ('Modtagelsesdato', 'original'),
    'Record The First One': ('Registrer den første', 'original'),
    'Reference': ('Reference', 'ledgersmb'),
    'Reminders': ('Rykkere', 'original'),
    'Reorder Level': ('Genbestillingsniveau', 'original'),
    'Reports': ('Rapporter', 'ledgersmb'),
    'Reset': ('Nulstil', 'original'),
    'Retail': ('Detailhandel', 'original'),
    'Sale': ('Salg', 'ledgersmb'),
    'Sales Invoices': ('Salgsfakturaer', 'original'),
    'Save': ('Gem', 'ledgersmb'),
    'Send': ('Send', 'original'),
    'Setup': ('Opsætning', 'original'),
    'Shelf Side': ('Hyldeside', 'original'),
    'Sibling': ('Søskende', 'original'),
    'Sold': ('Solgt', 'ledgersmb'),
    'Status': ('Status', 'original'),
    'Stock Take': ('Lagertælling', 'original'),
    'Stock Transfer': ('Lageroverførsel', 'original'),
    'Structured Editor': ('Struktureret editor', 'original'),
    'Switch': ('Skift', 'original'),
    'To': ('til', 'ledgersmb'),
    'Total': ('I alt', 'ledgersmb'),
    'Total Assets': ('Aktiver i alt', 'original'),
    'Total Equity': ('Egenkapital i alt', 'original'),
    'Total Expenses': ('Udgifter i alt', 'original'),
    'Total Income': ('Indtægter i alt', 'original'),
    'Total Liabilities': ('Passiver i alt', 'original'),
    'Trial Balance': ('Foreløbig status', 'ledgersmb'),
    'Type': ('Type', 'original'),
    'Unit Cost': ('Enhedspris', 'original'),
    'Username': ('Brugernavn', 'original'),
    'Username And Password Required': ('Brugernavn og adgangskode er påkrævet', 'original'),
    'Variance': ('Afvigelse', 'original'),
    'Vendors': ('Leverandører', 'ledgersmb'),  # adapted from da.po's 'Vendor' -> 'Leverandør'
    'Warehouse': ('Lager', 'ledgersmb'),
    'Write-offs & Expiration': ('Nedskrivninger og udløb', 'original'),
}

if __name__ == '__main__':
    with open('/tmp/all_current_vocab.txt', encoding='utf-8') as f:
        all_words = [w.strip() for w in f if w.strip()]
    missing = [w for w in all_words if w not in danish]
    extra = [w for w in danish if w not in all_words]
    print("words in vocabulary but missing from Danish dict:", missing)
    print("words in Danish dict but not in vocabulary:", extra)
    print("total words covered:", len(danish))
    sourced = sum(1 for _, src in danish.values() if src == 'ledgersmb')
    print("sourced from LedgerSMB's da.po:", sourced)

    with open('/tmp/danish_schema.sql', 'w', encoding='utf-8') as f:
        for word, (da, src) in danish.items():
            we = word.replace("'", "''")
            de = da.replace("'", "''")
            f.write(f"INSERT INTO translation_entry (entity, language, text) VALUES ('{we}', 'Danish', '{de}');\n")

    with open('/tmp/migration_danish.ts', 'w', encoding='utf-8') as f:
        f.write("const danishVocab: [string, string][] = [\n")
        for word, (da, src) in danish.items():
            w = word.replace("'", "\\'")
            d = da.replace("'", "\\'")
            f.write(f"    ['{w}', '{d}'],\n")
        f.write("  ];\n")
