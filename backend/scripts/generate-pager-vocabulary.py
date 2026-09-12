"""Translations for the shared Pager component's Newer/Page/Older labels."""

pager_vocab = {
    'Newer': {'German': 'Neuere', 'French': 'Plus récent', 'Danish': 'Nyere'},
    'Older': {'German': 'Ältere', 'French': 'Plus ancien', 'Danish': 'Ældre'},
    'Page': {'German': 'Seite', 'French': 'Page', 'Danish': 'Side'},
}

if __name__ == '__main__':
    with open('/tmp/pager_vocab_schema.sql', 'w', encoding='utf-8') as f:
        for word, langs in pager_vocab.items():
            we = word.replace("'", "''")
            for lang, text in langs.items():
                te = text.replace("'", "''")
                f.write(f"INSERT INTO translation_entry (entity, language, text) VALUES ('{we}', '{lang}', '{te}');\n")
    print("total:", sum(len(v) for v in pager_vocab.values()))
