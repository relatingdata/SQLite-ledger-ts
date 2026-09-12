"""
Translates the four language names themselves (English, German,
French, Danish) into each other — so the language dropdown on the
login and session/choose-business pages shows "Tysk" for German when
displaying in Danish, "Allemand" in French, etc., rather than always
showing the raw English name regardless of the current display
language.
"""

language_names = {
    'English': {'German': 'Englisch', 'French': 'Anglais', 'Danish': 'Engelsk'},
    'German': {'English': 'German', 'French': 'Allemand', 'Danish': 'Tysk', 'German': 'Deutsch'},
    'French': {'English': 'French', 'German': 'Französisch', 'Danish': 'Fransk', 'French': 'Français'},
    'Danish': {'English': 'Danish', 'German': 'Dänisch', 'French': 'Danois', 'Danish': 'Dansk'},
}

if __name__ == '__main__':
    with open('/tmp/language_names_schema.sql', 'w', encoding='utf-8') as f:
        for word, langs in language_names.items():
            we = word.replace("'", "''")
            for lang, text in langs.items():
                te = text.replace("'", "''")
                f.write(f"INSERT INTO translation_entry (entity, language, text) VALUES ('{we}', '{lang}', '{te}');\n")
    total = sum(len(v) for v in language_names.values())
    print("total entries:", total)
