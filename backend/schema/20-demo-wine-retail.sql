-- Wine Retail Business — the application's own, primary, default
-- demo business (English/Australian). Split out from
-- 20-demo-bmw-peugeot.sql on direct request: it was previously mixed
-- into that same file, meaning it shared BMW/Peugeot's own gate
-- (seedDemoBusinesses / SEED_FOREIGN_BUSINESSES) and could not be
-- loaded on its own as the application's actual initial/default
-- data. Loaded unconditionally whenever any demo data is seeded at
-- all (the existing SEED_DEMO_BUSINESSES flag, default true — see
-- db.ts), independent of whether the foreign demo businesses
-- (BMW M GmbH, Peugeot Citroën Sochaux SNC, Ditta Italiana Srl,
-- Schweizer KMU AG — now each gated separately behind
-- SEED_FOREIGN_BUSINESSES, default false) are loaded.

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
