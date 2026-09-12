"""
Translates the new Utilities sub-account hierarchy (Electricity, split
into Refrigeration and Lighting & General since they're genuinely
different tariffs with potentially different suppliers, plus Gas,
Water, Internet, Telephone) into German, French, and Danish.
"""

utilities_subaccounts = {
    'Electricity': {'German': 'Strom', 'French': 'Électricité', 'Danish': 'Elektricitet'},
    'Refrigeration': {'German': 'Kühlung', 'French': 'Réfrigération', 'Danish': 'Køling'},
    'Lighting & General': {'German': 'Beleuchtung & Allgemein', 'French': 'Éclairage et général', 'Danish': 'Belysning og generelt'},
    'Gas': {'German': 'Gas', 'French': 'Gaz', 'Danish': 'Gas'},
    'Water': {'German': 'Wasser', 'French': 'Eau', 'Danish': 'Vand'},
    'Internet': {'German': 'Internet', 'French': 'Internet', 'Danish': 'Internet'},
    'Telephone': {'German': 'Telefon', 'French': 'Téléphone', 'Danish': 'Telefon'},
}

if __name__ == '__main__':
    with open('/tmp/utilities_subaccounts_schema.sql', 'w', encoding='utf-8') as f:
        for word, langs in utilities_subaccounts.items():
            we = word.replace("'", "''")
            for lang, text in langs.items():
                te = text.replace("'", "''")
                f.write(f"INSERT INTO translation_entry (entity, language, text) VALUES ('{we}', '{lang}', '{te}');\n")
    total = sum(len(v) for v in utilities_subaccounts.values())
    print("total entries:", total)
