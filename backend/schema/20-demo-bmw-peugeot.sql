-- German BMW / French Peugeot demo ledger data, split out per direct request.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (188, 188, 'BMW M GmbH', (SELECT id FROM current_entities WHERE name = 'Businesses'), '2026-01-01', 1);
-- A real, confirmed bug fixed here, found live via a real, repeated
-- crash starting the backend with demo businesses seeded
-- (`SqliteError: NOT NULL constraint failed: journal.ledger_id`,
-- thrown from the real `post_journal_entry_insert` trigger in
-- 00-core.sql while seeding this very file): every real business's
-- own ledgers genuinely live under a real, dedicated "Ledgers"
-- container entity, never directly under the business itself -
-- confirmed directly against both `createBusiness` (db.ts) and
-- `My Business`'s own, real, correct seed data a few lines up in
-- 00-core.sql (`'Ledgers', ... 'Actual', 999000, ...`). This file's
-- own "Actual"/Budget lines, for every one of its three real
-- businesses, skipped that real container and parented them directly
-- under the business instead - the real, structural gap the post-
-- journal trigger's own `ledger_id` lookup (which requires exactly
-- that "Ledgers" parent) could never resolve, leaving `ledger_id`
-- NULL. Fixed by giving each business its own, real "Ledgers"
-- container here too, and reparenting its existing "Actual"/Budget
-- entities under it - never renamed, so nothing that already
-- references their own, real, existing names elsewhere is affected.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (700001, 700001, 'Ledgers', (SELECT id FROM current_entities WHERE name = 'BMW M GmbH'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (189, 189, 'Actual', 700001, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (550, 550, 'BMW M GmbH Budget 2026-27', 700001, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (190, 190, 'Immaterielle Vermögensgegenstände', (SELECT id FROM current_entities WHERE name = 'Asset'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (191, 191, 'Sachanlagen', (SELECT id FROM current_entities WHERE name = 'Asset'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (192, 192, 'Vorräte', (SELECT id FROM current_entities WHERE name = 'Asset'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (193, 193, 'Forderungen und sonstige Vermögensgegenstände', (SELECT id FROM current_entities WHERE name = 'Asset'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (194, 194, 'Kassenbestand und Bankguthaben', (SELECT id FROM current_entities WHERE name = 'Asset'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (195, 195, 'Rechnungsabgrenzungsposten (Aktiva)', (SELECT id FROM current_entities WHERE name = 'Asset'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (196, 196, 'Gezeichnetes Kapital', (SELECT id FROM current_entities WHERE name = 'Equity'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (197, 197, 'Gewinnrücklagen', (SELECT id FROM current_entities WHERE name = 'Equity'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (198, 198, 'Rückstellungen', (SELECT id FROM current_entities WHERE name = 'Liability'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (199, 199, 'Erhaltene Anzahlungen', (SELECT id FROM current_entities WHERE name = 'Liability'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (200, 200, 'Verbindlichkeiten aus Lieferungen und Leistungen', (SELECT id FROM current_entities WHERE name = 'Liability'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (201, 201, 'Verbindlichkeiten gegenüber verbundenen Unternehmen', (SELECT id FROM current_entities WHERE name = 'Liability'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (202, 202, 'Sonstige Verbindlichkeiten', (SELECT id FROM current_entities WHERE name = 'Liability'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (203, 203, 'Umsatzerlöse', (SELECT id FROM current_entities WHERE name = 'Income'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (204, 204, 'Sonstige betriebliche Erträge', (SELECT id FROM current_entities WHERE name = 'Income'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (205, 205, 'Herstellungskosten', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (206, 206, 'Vertriebskosten', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (207, 207, 'Allgemeine Verwaltungskosten', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (208, 208, 'Sonstige betriebliche Aufwendungen', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (209, 209, 'Zinsergebnis', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (210, 210, 'Steuern vom Einkommen und Ertrag', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (211, 211, 'Sonstige Steuern', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (212, 212, 'Gewinnabführung', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (213, 213, 'Peugeot Citroën Sochaux SNC', (SELECT id FROM current_entities WHERE name = 'Businesses'), '2026-01-01', 1);
-- Same real fix as BMW M GmbH's own "Ledgers" container just above.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (700002, 700002, 'Ledgers', (SELECT id FROM current_entities WHERE name = 'Peugeot Citroën Sochaux SNC'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (214, 214, 'Actual', 700002, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (551, 551, 'Peugeot Citroën Sochaux SNC Budget 2026-27', 700002, '2026-01-01', 1);

-- Wine Retail Business — a real, selectable business (not just the
-- global Locations/Items data, which stays accessible via its own
-- dedicated screens regardless of which business is selected) so
-- there's an actual home to post invoices and other transactions
-- against for the wine/beer/spirits scenario, same as BMW/PCS.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (296, 296, 'Wine Retail Business', (SELECT id FROM current_entities WHERE name = 'Businesses'), '2026-01-01', 1);

-- Real per-business Locations, not the one, global "Locations" node
-- every business used to share (a real, confirmed bug: selecting a
-- different business's session still showed Wine Retail Business's
-- own locations, since they were never actually scoped to it).
-- Re-parented via new history rows for the same real entity_id, not a
-- destructive UPDATE — the exact same append-only mechanism
-- supersedeEntity uses at runtime, just written directly here since this
-- is bootstrap data. The original creation rows above (entity_id
-- 122-128) are deliberately left alone — item_location and other
-- bootstrap data reference them by entity_id directly and need them
-- to exist at that point in the script; only their real, current
-- parent changes, exactly as a real re-parent through the UI would.
-- A real, confirmed bug, found directly while verifying a later
-- migration against a genuinely fresh database (not an already-
-- running, already-seeded one): this block used to run
-- `UPDATE entities SET deleted_at = ..., deleted_by = ... WHERE
-- entity_id = ...` immediately before each INSERT below, left over
-- from this project's earlier, rejected "close out the old row"
-- design. The entities table has had no deleted_at/deleted_by column
-- at all since the real, settled "no delete, only supersede" design
-- (current_entities already resolves to the latest row per entity_id
-- on its own) — so every one of those UPDATEs broke the entire
-- demo-seeded startup outright (`no such column: deleted_at`), and
-- was removed outright, not patched to use some other, equivalent
-- column. The bare re-parenting INSERT below was always sufficient
-- by itself.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (363, 363, 'Wine Retail Business Locations', (SELECT id FROM current_entities WHERE name = 'Wine Retail Business'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (364, 122, 'Head Office', (SELECT id FROM current_entities WHERE name = 'Wine Retail Business Locations'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (365, 123, 'Riverside Cellars', (SELECT id FROM current_entities WHERE name = 'Wine Retail Business Locations'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (366, 124, 'Uptown Wine & Spirits', (SELECT id FROM current_entities WHERE name = 'Wine Retail Business Locations'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (367, 125, 'Warehouse B', (SELECT id FROM current_entities WHERE name = 'Wine Retail Business Locations'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (368, 126, 'Harbourside Bottle Shop', (SELECT id FROM current_entities WHERE name = 'Wine Retail Business Locations'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (369, 127, 'Market Square Liquor', (SELECT id FROM current_entities WHERE name = 'Wine Retail Business Locations'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (370, 128, 'Eastside Cellar Door', (SELECT id FROM current_entities WHERE name = 'Wine Retail Business Locations'), '2026-01-01', 1);

-- The same real fix, applied to Items: per direct instruction, this
-- data has to be per-business too, nothing to do with the shared,
-- global Application catalogue. Re-parented via new history rows for
-- the same real entity_id, the exact same append-only mechanism
-- already used for Locations above - the original category rows
-- (entity_id 129-133) are left alone; only their real, current parent
-- changes. Every sub-category and Item underneath (entity_id
-- 134-187) needs no change at all here - their own parent_id already
-- points at one of these 5 categories, which now itself lives under
-- Wine Retail Business Items, so the whole real tree moves with them.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (50813, 813, 'Wine Retail Business Items', (SELECT id FROM current_entities WHERE name = 'Wine Retail Business'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (50814, 129, 'Red Wine', (SELECT id FROM current_entities WHERE name = 'Wine Retail Business Items'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (50815, 130, 'White Wine', (SELECT id FROM current_entities WHERE name = 'Wine Retail Business Items'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (50816, 131, 'Sparkling Wine', (SELECT id FROM current_entities WHERE name = 'Wine Retail Business Items'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (50817, 132, 'Beer', (SELECT id FROM current_entities WHERE name = 'Wine Retail Business Items'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (50818, 133, 'Spirits', (SELECT id FROM current_entities WHERE name = 'Wine Retail Business Items'), '2026-01-01', 1);
-- Same real fix as BMW M GmbH's own "Ledgers" container above.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (700003, 700003, 'Ledgers', (SELECT id FROM current_entities WHERE name = 'Wine Retail Business'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (297, 297, 'Actual', 700003, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (215, 215, 'Stocks et en-cours', (SELECT id FROM current_entities WHERE name = 'Asset'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (216, 216, 'Créances clients et comptes rattachés', (SELECT id FROM current_entities WHERE name = 'Asset'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (217, 217, 'Autres créances', (SELECT id FROM current_entities WHERE name = 'Asset'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (218, 218, 'Disponibilités', (SELECT id FROM current_entities WHERE name = 'Asset'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (219, 219, 'Capital', (SELECT id FROM current_entities WHERE name = 'Equity'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (220, 220, 'Report à nouveau', (SELECT id FROM current_entities WHERE name = 'Equity'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (221, 221, 'Provisions pour risques', (SELECT id FROM current_entities WHERE name = 'Liability'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (222, 222, 'Emprunts et dettes financières divers', (SELECT id FROM current_entities WHERE name = 'Liability'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (223, 223, 'Dettes fournisseurs et comptes rattachés', (SELECT id FROM current_entities WHERE name = 'Liability'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (224, 224, 'Dettes fiscales et sociales', (SELECT id FROM current_entities WHERE name = 'Liability'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (225, 225, 'Autres dettes', (SELECT id FROM current_entities WHERE name = 'Liability'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (226, 226, 'Ventes de marchandises', (SELECT id FROM current_entities WHERE name = 'Income'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (227, 227, 'Production vendue - Biens', (SELECT id FROM current_entities WHERE name = 'Income'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (228, 228, 'Production vendue - Services', (SELECT id FROM current_entities WHERE name = 'Income'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (229, 229, 'Reprises sur provisions et transferts de charges', (SELECT id FROM current_entities WHERE name = 'Income'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (230, 230, 'Autres produits', (SELECT id FROM current_entities WHERE name = 'Income'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (231, 231, 'Produits financiers', (SELECT id FROM current_entities WHERE name = 'Income'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (232, 232, 'Production stockée (variation)', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (233, 233, 'Achats de marchandises', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (234, 234, 'Achats de matières premières et autres approvisionnements', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (235, 235, 'Variation des stocks de matières premières', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (236, 236, 'Autres achats et charges externes', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (237, 237, 'Impôts, taxes et versements assimilés', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (238, 238, 'Dotations aux provisions sur actif circulant', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (239, 239, 'Dotations aux provisions pour risques et charges', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (240, 240, 'Autres charges', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (241, 241, 'Charges financières', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (242, 242, 'Charges exceptionnelles', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (243, 243, 'Impôts sur les bénéfices', (SELECT id FROM current_entities WHERE name = 'Expense'), '2026-01-01', 1);-- BMW M GmbH FY2020 balance sheet
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('BMW-BS-2020', 'BMW M GmbH', 'Actual', '2020-12-31', 'Immaterielle Vermögensgegenstände', 37200000);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('BMW-BS-2020', 'BMW M GmbH', 'Actual', '2020-12-31', 'Sachanlagen', 2601300000);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('BMW-BS-2020', 'BMW M GmbH', 'Actual', '2020-12-31', 'Vorräte', 144500000);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('BMW-BS-2020', 'BMW M GmbH', 'Actual', '2020-12-31', 'Forderungen und sonstige Vermögensgegenstände', 6824400000);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('BMW-BS-2020', 'BMW M GmbH', 'Actual', '2020-12-31', 'Kassenbestand und Bankguthaben', 22100000);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('BMW-BS-2020', 'BMW M GmbH', 'Actual', '2020-12-31', 'Rechnungsabgrenzungsposten (Aktiva)', 55300000);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('BMW-BS-2020', 'BMW M GmbH', 'Actual', '2020-12-31', 'Gezeichnetes Kapital', -2600000);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('BMW-BS-2020', 'BMW M GmbH', 'Actual', '2020-12-31', 'Gewinnrücklagen', -39100000);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('BMW-BS-2020', 'BMW M GmbH', 'Actual', '2020-12-31', 'Rückstellungen', -3296900000);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('BMW-BS-2020', 'BMW M GmbH', 'Actual', '2020-12-31', 'Erhaltene Anzahlungen', -5075100000);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('BMW-BS-2020', 'BMW M GmbH', 'Actual', '2020-12-31', 'Verbindlichkeiten aus Lieferungen und Leistungen', -1260100000);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('BMW-BS-2020', 'BMW M GmbH', 'Actual', '2020-12-31', 'Verbindlichkeiten gegenüber verbundenen Unternehmen', -7600000);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('BMW-BS-2020', 'BMW M GmbH', 'Actual', '2020-12-31', 'Sonstige Verbindlichkeiten', -3400000);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('BMW-PL-2020', 'BMW M GmbH', 'Actual', '2020-12-31', 'Umsatzerlöse', -43605800000);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('BMW-PL-2020', 'BMW M GmbH', 'Actual', '2020-12-31', 'Sonstige betriebliche Erträge', -366100000);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('BMW-PL-2020', 'BMW M GmbH', 'Actual', '2020-12-31', 'Herstellungskosten', 28327500000);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('BMW-PL-2020', 'BMW M GmbH', 'Actual', '2020-12-31', 'Vertriebskosten', 3584200000);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('BMW-PL-2020', 'BMW M GmbH', 'Actual', '2020-12-31', 'Allgemeine Verwaltungskosten', 2269000000);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('BMW-PL-2020', 'BMW M GmbH', 'Actual', '2020-12-31', 'Sonstige betriebliche Aufwendungen', 31400000);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('BMW-PL-2020', 'BMW M GmbH', 'Actual', '2020-12-31', 'Zinsergebnis', 112900000);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('BMW-PL-2020', 'BMW M GmbH', 'Actual', '2020-12-31', 'Steuern vom Einkommen und Ertrag', 2100000);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('BMW-PL-2020', 'BMW M GmbH', 'Actual', '2020-12-31', 'Sonstige Steuern', 300000);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('BMW-PL-2020', 'BMW M GmbH', 'Actual', '2020-12-31', 'Gewinnabführung', 9644500000);

INSERT INTO post_journal_entry (reference, business, ledger, user_id) VALUES ('BMW-BS-2020', 'BMW M GmbH', 'Actual', 1);
INSERT INTO post_journal_entry (reference, business, ledger, user_id) VALUES ('BMW-PL-2020', 'BMW M GmbH', 'Actual', 1);

-- Peugeot Citroën Sochaux SNC FY2020 — balance sheet and P&L combined
-- into one genuinely balanced transaction (a non-zero net income
-- means these cannot be two independent postings — see the French
-- comparison work for why).
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Stocks et en-cours', 8740587103);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Créances clients et comptes rattachés', 59292045484);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Autres créances', 1496248495);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Disponibilités', 9879);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Capital', -4000000000);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Report à nouveau', 48967322088);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Provisions pour risques', -39679600);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Emprunts et dettes financières divers', -52599268276);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Dettes fournisseurs et comptes rattachés', -60072233825);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Dettes fiscales et sociales', -383415086);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Autres dettes', -734785853);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Ventes de marchandises', -310545978);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Production vendue - Biens', -456836041909);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Production vendue - Services', -3679087893);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Reprises sur provisions et transferts de charges', -648613910);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Autres produits', -401478625);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Produits financiers', -84355736);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Production stockée (variation)', 1596362093);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Achats de marchandises', 30471246);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Achats de matières premières et autres approvisionnements', 410066545306);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Variation des stocks de matières premières', -106109458);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Autres achats et charges externes', 47828028363);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Impôts, taxes et versements assimilés', 645241731);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Dotations aux provisions sur actif circulant', 571645943);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Dotations aux provisions pour risques et charges', 39131800);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Autres charges', 19657);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Charges financières', 458157961);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Charges exceptionnelles', 2571500);
INSERT INTO journal_entry_staging (reference, business, ledger, transdate, account, amount_minor)
VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', '2020-12-31', 'Impôts sur les bénéfices', 161227500);

INSERT INTO post_journal_entry (reference, business, ledger, user_id) VALUES ('PCS-2020', 'Peugeot Citroën Sochaux SNC', 'Actual', 1);-- Vocabulary words for the screens built across the wine/beer/spirits