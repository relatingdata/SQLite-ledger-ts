-- Demo businesses: Ditta Italiana Srl (Italian CoA) and Schweizer
-- KMU AG (Swiss German CoA) - moved out of 00-core.sql, per direct,
-- standing instruction, alongside 20-demo-bmw-peugeot.sql: gated as
-- a whole, separate, self-contained file (never a content-pattern
-- filter over 00-core.sql's own text), so SEED_DEMO_BUSINESSES=false
-- genuinely yields zero business/demo data of any kind - the
-- original, line-pattern-based filter in db.ts left these two
-- businesses' own, real Actual/Budget ledger entities behind as
-- confirmed, real dangling parent_id rows (the business row itself
-- was filtered out by its name appearing literally in that line;
-- its child ledgers, referencing it only by bare numeric parent_id,
-- were not), caught directly by a real integrity check.

-- Italian and Swiss (German/French/Italian) chart of accounts —
-- adapted from Tekki's real SQL-Ledger fork (GPLv3, see NOTICE.md
-- for provenance). Schweizer KMU AG demonstrates the translation
-- mechanism directly: real French/Italian names for the same real
-- accounts, sourced from Tekki's own parallel Swiss French/Italian
-- charts, which share identical account numbers.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (312, 312, 'Ditta Italiana Srl', (SELECT id FROM current_entities WHERE name = 'Businesses'), '2026-01-01', 1);
-- A real, confirmed bug fixed here, the same real fix applied in
-- 20-demo-bmw-peugeot.sql (see its own, fuller comment): every real
-- business's own ledgers must live under a real, dedicated "Ledgers"
-- container entity (confirmed against both `createBusiness`, db.ts,
-- and `My Business`'s own correct seed data in 00-core.sql), never
-- directly under the business itself - this file's own two
-- businesses skipped it, which the real `post_journal_entry_insert`
-- trigger's own `ledger_id` lookup could never resolve, leaving it
-- NULL (`NOT NULL constraint failed: journal.ledger_id`).
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (700004, 700004, 'Ledgers', 312, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (313, 313, 'Actual', 700004, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (552, 552, 'Ditta Italiana Srl Budget 2026-27', 700004, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (314, 314, 'Banca c/c', (SELECT id FROM current_entities WHERE name = 'Asset'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Banca c/c', '4480105');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (315, 315, 'Cassa e valori', (SELECT id FROM current_entities WHERE name = 'Asset'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Cassa e valori', '4480500');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (316, 316, 'Crediti verso clienti per fatture emesse', (SELECT id FROM current_entities WHERE name = 'Asset'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Crediti verso clienti per fatture emesse', '4001001');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (317, 317, 'Rimanenze prodotti finiti', (SELECT id FROM current_entities WHERE name = 'Asset'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Rimanenze prodotti finiti', '3020005');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (318, 318, 'Autovetture', (SELECT id FROM current_entities WHERE name = 'Asset'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Autovetture', '2255025');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (319, 319, 'Banca di ... c/c', (SELECT id FROM current_entities WHERE name = 'Liability'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Banca di ... c/c', '6435005');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (320, 320, 'Capitale sociale', (SELECT id FROM current_entities WHERE name = 'Equity'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Capitale sociale', '5005005');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (321, 321, 'Riserva legale', (SELECT id FROM current_entities WHERE name = 'Equity'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Riserva legale', '5020005');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (322, 322, 'Utili esercizi precedenti', (SELECT id FROM current_entities WHERE name = 'Equity'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Utili esercizi precedenti', '5080005');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (323, 323, 'Ricavi cessione beni', (SELECT id FROM current_entities WHERE name = 'Income'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Ricavi cessione beni', '8005005');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (324, 324, 'Ricavi per prestazioni a terzi', (SELECT id FROM current_entities WHERE name = 'Income'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Ricavi per prestazioni a terzi', '8015005');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (325, 325, 'Materie prime', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Materie prime', '7005005');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (326, 326, 'Merci destinate alla rivendita', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Merci destinate alla rivendita', '7005015');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (327, 327, 'Energia elettrica', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Energia elettrica', '7025005');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (328, 328, 'Spese telefoniche', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Spese telefoniche', '7025015');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (329, 329, 'Spese di assicurazione', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Spese di assicurazione', '7025030');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (330, 330, 'Schweizer KMU AG', (SELECT id FROM current_entities WHERE name = 'Businesses'), '2026-01-01', 1);
-- Same real fix as Ditta Italiana Srl's own "Ledgers" container above.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (700005, 700005, 'Ledgers', 330, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (331, 331, 'Actual', 700005, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (553, 553, 'Schweizer KMU AG Budget 2026-27', 700005, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (332, 332, 'Kasse', (SELECT id FROM current_entities WHERE name = 'Asset'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Kasse', 'CH-1000');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (333, 333, 'Bank', (SELECT id FROM current_entities WHERE name = 'Asset'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Bank', 'CH-1020');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (334, 334, 'Debitoren', (SELECT id FROM current_entities WHERE name = 'Asset'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Debitoren', 'CH-1100');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (335, 335, 'Handelswaren', (SELECT id FROM current_entities WHERE name = 'Asset'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Handelswaren', 'CH-1200');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (336, 336, 'Rohstoffe', (SELECT id FROM current_entities WHERE name = 'Asset'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Rohstoffe', 'CH-1210');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (337, 337, 'Büromaschinen, Informatik', (SELECT id FROM current_entities WHERE name = 'Asset'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Büromaschinen, Informatik', 'CH-1520');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (338, 338, 'Kreditoren', (SELECT id FROM current_entities WHERE name = 'Liability'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Kreditoren', 'CH-2000');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (339, 339, 'Anzahlungen von Kunden', (SELECT id FROM current_entities WHERE name = 'Liability'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Anzahlungen von Kunden', 'CH-2030');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (340, 340, 'Bankkontokorrent', (SELECT id FROM current_entities WHERE name = 'Liability'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Bankkontokorrent', 'CH-2100');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (341, 341, 'Aktienkapital', (SELECT id FROM current_entities WHERE name = 'Equity'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Aktienkapital', 'CH-2800');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (342, 342, 'Warenertrag', (SELECT id FROM current_entities WHERE name = 'Income'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Warenertrag', 'CH-3200');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (343, 343, 'Dienstleistungsertrag', (SELECT id FROM current_entities WHERE name = 'Income'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Dienstleistungsertrag', 'CH-3400');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (344, 344, 'Warenaufwand', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Warenaufwand', 'CH-4200');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (345, 345, 'Aufwand für Dienstleistungen', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Aufwand für Dienstleistungen', 'CH-4400');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (346, 346, 'Verwaltungsaufwand', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Verwaltungsaufwand', 'CH-6500');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (347, 347, 'Finanzaufwand', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Finanzaufwand', 'CH-6800');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (348, 348, 'Steuern', (SELECT id FROM current_entities WHERE name = 'Income'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber) VALUES ('Steuern', 'CH-8900');
