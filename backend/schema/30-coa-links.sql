-- Relates the English chart's leaves and the Cash Sale customer to the
-- English CoA prototype. Loaded after
-- 00-core.sql, whose entities it names.
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Bank Account (DKK)'), 'Bank Account (DKK)', 'Asset', 'English CoA', 1);
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Bank Account (EUR)'), 'Bank Account (EUR)', 'Asset', 'English CoA', 1);
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Cash Sale'), 'Cash Sale', 'Customers', 'English CoA', 1);
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Cash and Bank'), 'Cash and Bank', 'Asset', 'English CoA', 1);
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Fixed Assets'), 'Fixed Assets', 'Asset', 'English CoA', 1);
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Gas'), 'Gas', 'Utilities', 'English CoA', 1);
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Internet'), 'Internet', 'Utilities', 'English CoA', 1);
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Inventory'), 'Inventory', 'Asset', 'English CoA', 1);
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Lighting & General'), 'Lighting & General', 'Electricity', 'English CoA', 1);
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Loans Payable'), 'Loans Payable', 'Liability', 'English CoA', 1);
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Miscellaneous'), 'Miscellaneous', 'Expense', 'English CoA', 1);
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Office'), 'Office', 'Expense', 'English CoA', 1);
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Other Income'), 'Other Income', 'Income', 'English CoA', 1);
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Owner''s Equity'), 'Owner''s Equity', 'Equity', 'English CoA', 1);
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Purchases Tax Claimed'), 'Purchases Tax Claimed', 'Asset', 'English CoA', 1);
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Refrigeration'), 'Refrigeration', 'Electricity', 'English CoA', 1);
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Rent'), 'Rent', 'Expense', 'English CoA', 1);
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Retained Earnings'), 'Retained Earnings', 'Equity', 'English CoA', 1);
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Sales Discounts'), 'Sales Discounts', 'Income', 'English CoA', 1);
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Sales Revenue'), 'Sales Revenue', 'Income', 'English CoA', 1);
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Sales Tax Payable'), 'Sales Tax Payable', 'Liability', 'English CoA', 1);
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Telephone'), 'Telephone', 'Utilities', 'English CoA', 1);
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Wages'), 'Wages', 'Expense', 'English CoA', 1);
INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES ((SELECT id FROM current_entities WHERE name = 'Water'), 'Water', 'Utilities', 'English CoA', 1);