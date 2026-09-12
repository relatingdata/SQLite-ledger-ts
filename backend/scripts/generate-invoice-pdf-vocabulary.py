"""Translations for the invoice PDF's labels not already covered by existing vocabulary."""

invoice_pdf_vocab = {
    'Qty': {'German': 'Menge', 'French': 'Qté', 'Danish': 'Antal'},
    'Amount': {'German': 'Betrag', 'French': 'Montant', 'Danish': 'Beløb'},
    'Tax': {'German': 'Steuer', 'French': 'Taxe', 'Danish': 'Moms'},
    'Invoice': {'German': 'Rechnung', 'French': 'Facture', 'Danish': 'Faktura'},
    'Posted by': {'German': 'Gebucht von', 'French': 'Enregistré par', 'Danish': 'Bogført af'},
    'Bill to': {'German': 'Rechnung an', 'French': 'Facturé à', 'Danish': 'Faktureres til'},
    'Subtotal': {'German': 'Zwischensumme', 'French': 'Sous-total', 'Danish': 'Subtotal'},
    'Total due': {'German': 'Fälliger Betrag', 'French': 'Total dû', 'Danish': 'Skyldigt beløb'},
}

if __name__ == '__main__':
    with open('/tmp/invoice_pdf_vocab_schema.sql', 'w', encoding='utf-8') as f:
        for word, langs in invoice_pdf_vocab.items():
            we = word.replace("'", "''")
            for lang, text in langs.items():
                te = text.replace("'", "''")
                f.write(f"INSERT INTO translation_entry (entity, language, text) VALUES ('{we}', '{lang}', '{te}');\n")
    print("total:", sum(len(v) for v in invoice_pdf_vocab.values()))
