# New vocabulary words needed for the 8 untranslated screens.
# word -> (German, French)
new_words = {
    'Stock Transfer': ('Lagerumbuchung', 'Transfert de stock'),
    'Below Reorder': ('Unter Meldebestand', 'Sous le seuil de commande'),
    'Stock Take': ('Inventur', 'Inventaire'),
    'City': ('Stadt', 'Ville'),
    'Type': ('Typ', 'Type'),
    'Warehouse': ('Lager', 'Entrepôt'),
    'Retail': ('Einzelhandel', 'Détail'),
    'Billing Address': ('Rechnungsadresse', 'Adresse de facturation'),
    'From': ('Von', 'De'),
    'To': ('Nach', 'À'),
    'On Hand': ('Bestand', 'En stock'),
    'Complete': ('Abschließen', 'Terminer'),
    'Draft': ('Entwurf', 'Brouillon'),
    'Status': ('Status', 'Statut'),
    'Counted': ('Gezählt', 'Compté'),
    'Expected': ('Erwartet', 'Attendu'),
    'Shelf Side': ('Regalseite', 'Côté rayon'),
    'Rack': ('Regal', 'Rayonnage'),
    'Level': ('Ebene', 'Niveau'),
    'Reorder Level': ('Meldebestand', 'Seuil de commande'),
    'Outstanding': ('Offen', 'En attente'),
    'Aged Receivables': ('Offene Forderungen', 'Créances échues'),
    'Aged Payables': ('Offene Verbindlichkeiten', 'Dettes échues'),
    'Reminders': ('Mahnungen', 'Relances'),
    'Sales Invoices': ('Verkaufsrechnungen', 'Factures de vente'),
    'Purchase Invoices': ('Einkaufsrechnungen', "Factures d'achat"),
    'Send': ('Senden', 'Envoyer'),
    'Reset': ('Zurücksetzen', 'Réinitialiser'),
    'Write-offs & Expiration': ('Abschreibungen & Verfall', 'Radiations et péremption'),
    'Reason': ('Grund', 'Raison'),
    'Reference': ('Referenz', 'Référence'),
    'Unit Cost': ('Stückkosten', 'Coût unitaire'),
    'Expiring Stock': ('Ablaufender Bestand', 'Stock arrivant à expiration'),
    'Lot Number': ('Chargennummer', 'Numéro de lot'),
    'Expiration Date': ('Verfallsdatum', "Date d'expiration"),
    'Received Date': ('Eingangsdatum', 'Date de réception'),
    'Sold': ('Verkauft', 'Vendu'),
    'Bought': ('Gekauft', 'Acheté'),
    'History': ('Verlauf', 'Historique'),
}

with open('/tmp/new_vocab_schema.sql', 'w') as f:
    for word, (de, fr) in new_words.items():
        we = word.replace("'", "''")
        f.write(f"INSERT INTO translation_entry (entity, language, text) VALUES ('{we}', 'German', '{de.replace(chr(39), chr(39)+chr(39))}');\n")
    for word, (de, fr) in new_words.items():
        we = word.replace("'", "''")
        f.write(f"INSERT INTO translation_entry (entity, language, text) VALUES ('{we}', 'French', '{fr.replace(chr(39), chr(39)+chr(39))}');\n")

with open('/tmp/new_vocab_names.txt', 'w') as f:
    for word in new_words:
        f.write(word + "\n")

print("words:", len(new_words))
