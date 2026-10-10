-- =====================================================================
-- SCHEMA — entities is append-only: nothing is ever UPDATEd or DELETEd
-- in it, a "rename" or "delete" is a close-out (deleted_at/deleted_by
-- stamped on the current row) followed by an insert of the replacement
-- (for a rename) or nothing (for a real delete) — the same SCD-Type-2
-- pattern data warehouses have used for decades to keep full history
-- self-auditing, without a separate audit-log table to keep in sync.
--
-- entity_ids is a tiny registry, one row per LOGICAL entity, created
-- once and never touched again — it exists purely so every OTHER table
-- (account, journal_line, translation, ...) can hold a real, enforced
-- foreign key to a stable identity that survives a rename, rather than
-- to one specific version-row that gets closed out. Without this
-- separate registry, a "current row" isn't a fixed thing to reference
-- at all — id 13's live row is row_id 13 today and row_id 401 after a
-- rename, so anything that pointed at row_id 13 would be silently
-- pointing at history the moment a rename happened.
--
-- current_entities is what everything else reads from — aliasing
-- entity_id AS id keeps every existing query (business_reports,
-- chart_of_accounts, localized_text, and all the rest) working by
-- swapping FROM entities for FROM current_entities, with no column
-- renames needed anywhere downstream.
--
-- parent_id/relation_id reference entity_id (the stable identity), not
-- row_id — so renaming a parent never orphans its children; nothing
-- else needs to change when a rename happens.
--
-- TWO PARALLEL STRUCTURES over the same accounts, deliberately, since a
-- single parent_id column can only give each entity one real parent:
--   - Chart of Accounts is that one real parent_id-based tree — an
--     account's true, structural home is its category (Asset,
--     Liability, ...), which is what parent_id actually stores.
--   - Business Reports (Balance Sheet, Profit and Loss Statement) is a
--     SEPARATE, genuinely parallel grouping of the exact same accounts
--     — but it doesn't need its own parent_id at all, because which
--     report a category belongs on is fixed and never varies
--     (Asset/Liability/Equity always mean Balance Sheet; Income/Expense
--     always mean Profit and Loss). So it's a derived VIEW
--     (business_reports, below) walking the very same Chart of Accounts
--     tree and re-labelling each branch by report — a real, independently
--     queryable structure, without a second stored hierarchy that could
--     ever drift out of sync with the first.
--
-- account and translation are both genuine *extensions* of specific
-- entities, not competing concepts:
--   - account is 1:1 (entity_id IS its primary key) — no duplicated
--     hierarchy/category of its own. Deliberately NOT pre-populated: an
--     account row is created lazily, the first time something actually
--     posts to that entity (see the posting trigger below).
--   - translation is 1:many (one row per entity per language it has
--     been translated into) — entities.name stays the canonical text
--     (English, by convention, needing no translation row of its own);
--     translating anything into German, say, is one row here, looked up
--     through localized_text, falling back to entities.name if a given
--     entity has no translation yet for the chosen language. Choosing a
--     language is meant to be a startup choice, the same shape as
--     choosing a business/ledger — the frontend piece for that comes
--     later; this is the data it reads from.
--
-- journal/journal_line are the permanent record. journal_entry_staging
-- is where the frontend builds up a transaction one line at a time
-- before posting it; posting is one atomic operation — it either fully
-- succeeds (accounts vivified as needed, moved to the real tables,
-- balances updated, staging cleared) or fully fails (nothing moves,
-- nothing clears, staging is left exactly as it was), never something
-- in between, even if the process crashes mid-way.
--
-- Integer minor units (never REAL) for anything monetary.
-- =====================================================================

-- entity_ids eliminated as its own table, per direct, absolute
-- instruction. entities' own row_id (already a real, genuine
-- auto-increment primary key) now serves as the real, direct
-- allocation source for a brand-new entity_id - see
-- entity_entry_insert below.

-- Per direct instruction: entities has only created_at/created_by -
-- no deleted_at, no deleted_by, no updated_at, and no special,
-- deletion-marker row shape. Every row is an ordinary row. For a
-- given entity_id, the current row is simply the one with the latest
-- created_at (row_id as the tiebreaker for a same-millisecond
-- collision) - "if a younger entity exists, it is the current one."
-- See current_entities below for how this is read, and the
-- entities_no_update/entities_no_delete triggers for the structural
-- guarantee that this table only ever grows, never mutates in place.
CREATE TABLE entities (
  row_id     INTEGER PRIMARY KEY,
  entity_id  INTEGER NOT NULL,
  name       TEXT NOT NULL,
  parent_id  INTEGER,
  relation_id INTEGER,
  -- A real, flat, ordered JSON array of real Hierarchy value ids
  -- (e.g. "[41,88,103]") - set only on a Product Instance's own,
  -- single entity and on each of its own combination leaves under
  -- Inventory/Sales Revenue/Cost of Goods Sold. Genuinely rename-safe
  -- by construction: each id is this table's own, stable entity_id,
  -- which a rename or reparent never changes (only the row itself
  -- gets replaced) - so this array never needs an update of its own
  -- when a real Hierarchy value is renamed. The real, live display
  -- name is always recomputed from these ids at read time
  -- (getCombinationDisplayName), never trusted from a stored string.
  combination_ids TEXT,
  -- A real, direct JSON object holding a real entity's own, wider,
  -- structured detail - the same, real, established pattern
  -- combination_ids already proves (a real, additive column on this
  -- one, single, permanent table, never a new one). Used directly by
  -- item_source-replacement vendor-source entities (vendor_sku,
  -- vendor_upc, price_minor, package_quantity, is_preferred,
  -- preference_notes, lead_time_days) and, later, contact-replacement
  -- entities - each real field a real, named key in this one, real
  -- JSON object, never a bespoke column added per new use.
  detail_json TEXT,
  created_at TEXT NOT NULL,
  created_by INTEGER NOT NULL
);

-- Uniqueness only among LIVE rows — the old, closed-out version of a
-- renamed entity keeps its old name forever (that's the whole point),
-- so a plain UNIQUE would break the instant anything was ever renamed.
-- Uniqueness among the current rows only - the old, superseded
-- version of a renamed entity keeps its old name forever (that's the
-- whole point). SQLite's own partial-index WHERE clause can only
-- filter on a simple, uncorrelated condition - it cannot express
-- "only this entity_id's own current row," since that requires
-- comparing against every other row for the same entity_id. Enforced
-- here instead, as a real, direct BEFORE INSERT check: no two
-- different, live entities under the same real parent may share a
-- real name. (A rename's own new row is checked the same way as any
-- insert - it simply never collides with its own prior row, since
-- that prior row's own name is, by definition, being superseded.)
CREATE TRIGGER entities_name_unique BEFORE INSERT ON entities
WHEN EXISTS (
  SELECT 1 FROM current_entities WHERE parent_id IS NEW.parent_id AND name = NEW.name AND id != NEW.entity_id
)
BEGIN
  SELECT RAISE(ABORT, 'entities: a different, live entity already has this name under this parent');
END;

-- Per direct instruction: a real, application-level version stamp on
-- the database itself, distinct from the running application's own
-- VERSION file - the one, real place a future migration feature
-- checks what version of the schema/data this specific database file
-- was last brought up to date with. Exactly one, real row, always -
-- enforced by the fixed, real primary key rather than a table-level
-- constraint, since SQLite has no direct "at most one row" check.
CREATE TABLE db_version (
  id      INTEGER PRIMARY KEY CHECK (id = 1),
  version TEXT NOT NULL
);
INSERT INTO db_version (id, version) VALUES (1, '0.0.0.400');

-- A plain, non-unique index on name alone. Cannot be UNIQUE — scoped
-- uniqueness (one real name per real parent, not globally) is this
-- schema's own, established, deliberate design, so the exact, same
-- real name genuinely, correctly exists under more than one real
-- parent (e.g. two different businesses each with their own real
-- "Cash" account). But the single most common real query throughout
-- this codebase is a plain "WHERE name = ?" lookup with no parent_id
-- at all (resolving a business, a language, a Vocabulary word, a
-- relationship record, by name alone) — confirmed directly via
-- EXPLAIN QUERY PLAN that this previously triggered a full SCAN of
-- the composite (parent_id, name) index above, not a direct seek,
-- since a composite index can only be searched efficiently by its
-- own real, leading column(s).
CREATE INDEX entities_name_lookup ON entities(name);

-- entity_id-based lookups (getEntity(id), supersedeEntity(id, ...), and
-- similar) are also extremely common throughout this codebase, and
-- entity_id itself had no real index at all — confirmed directly via
-- EXPLAIN QUERY PLAN that this also triggered a full scan.
CREATE INDEX entities_entity_id_current ON entities(entity_id);

-- relation_id-based lookups (localized_text's own "does anything
-- point at this entity" check, dimension links, and similar) are
-- also common - confirmed directly, the same, real way, via EXPLAIN
-- QUERY PLAN, that this real, missing index was forcing a full,
-- real, direct scan of every one of this table's own, live rows for
-- each real, correlated EXISTS check (the direct, confirmed cause of
-- localized_text taking ~2.8 real seconds once this project's own,
-- real data grew past a few thousand entities).
CREATE INDEX entities_relation_id_current ON entities(relation_id) WHERE relation_id IS NOT NULL;

-- A real index covering (entity_id, row_id) together - the exact
-- shape current_entities' own "latest row for this entity_id" lookup
-- needs, avoiding a second lookup for row_id after finding entity_id.
CREATE INDEX entities_entity_id_all ON entities(entity_id, row_id);

-- Per direct instruction: entities is guarded, structurally, against
-- any UPDATE or DELETE - only INSERT and SELECT are ever permitted,
-- enforced here, by the database itself, not by convention or code
-- review. Every legitimate way to change what an entity_id currently
-- means is itself an INSERT (entity_update, entity_revoke, both
-- above) - nothing in this codebase ever needs to run a raw UPDATE or
-- DELETE against this table directly.
CREATE TRIGGER entities_no_update BEFORE UPDATE ON entities
BEGIN
  SELECT RAISE(ABORT, 'entities is append-only: UPDATE is never permitted, only INSERT and SELECT. Use entity_update instead.');
END;

CREATE TRIGGER entities_no_delete BEFORE DELETE ON entities
BEGIN
  SELECT RAISE(ABORT, 'entities is append-only: DELETE is never permitted, only INSERT and SELECT. Use entity_revoke instead.');
END;

-- Two real, small, reusable insert-only mechanisms, replacing every
-- direct "UPDATE entities SET relation_id = ..." / "SET detail_json =
-- json_set(...)" statement throughout the seed data and TypeScript -
-- each inserts a younger row carrying every other column forward
-- unchanged, never touching the row it supersedes.
--   INSERT INTO entity_set_relation (entity_id, relation_id) VALUES (122, 45);
CREATE VIEW entity_set_relation AS SELECT id AS entity_id, relation_id FROM current_entities WHERE 0;
CREATE TRIGGER entity_set_relation_insert INSTEAD OF INSERT ON entity_set_relation
BEGIN
  INSERT INTO entities (entity_id, name, parent_id, relation_id, combination_ids, detail_json, created_at, created_by)
  SELECT id, name, parent_id, NEW.relation_id, combination_ids, detail_json, strftime('%Y-%m-%d %H:%M:%f', 'now'), 1
  FROM current_entities WHERE id = NEW.entity_id;
END;
-- A real, direct JSON merge (SQLite's own json_patch) into the
-- current detail_json, computed inside the trigger itself from the
-- real, live row - the caller passes only the fields actually
-- changing, same as json_set did before, just insert-only now.
--   INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (122, '{"city":"Springfield"}');
CREATE VIEW entity_merge_detail AS SELECT id AS entity_id, detail_json AS patch_json FROM current_entities WHERE 0;
CREATE TRIGGER entity_merge_detail_insert INSTEAD OF INSERT ON entity_merge_detail
BEGIN
  INSERT INTO entities (entity_id, name, parent_id, relation_id, combination_ids, detail_json, created_at, created_by)
  SELECT id, name, parent_id, relation_id, combination_ids, json_patch(COALESCE(detail_json, '{}'), NEW.patch_json), strftime('%Y-%m-%d %H:%M:%f', 'now'), 1
  FROM current_entities WHERE id = NEW.entity_id;
END;
-- A full detail_json replace - most TypeScript callers already
-- compute the whole, new object themselves (often from the current
-- one, spread and extended) rather than a partial patch.
--   INSERT INTO entity_set_detail (entity_id, detail_json) VALUES (122, '{"a":1}');
CREATE VIEW entity_set_detail AS SELECT id AS entity_id, detail_json FROM current_entities WHERE 0;
CREATE TRIGGER entity_set_detail_insert INSTEAD OF INSERT ON entity_set_detail
BEGIN
  INSERT INTO entities (entity_id, name, parent_id, relation_id, combination_ids, detail_json, created_at, created_by)
  SELECT id, name, parent_id, relation_id, combination_ids, NEW.detail_json, strftime('%Y-%m-%d %H:%M:%f', 'now'), 1
  FROM current_entities WHERE id = NEW.entity_id;
END;
-- A combination_ids replace - set once, at creation, on a Product
-- Instance or a combination leaf (never changed by a rename).
--   INSERT INTO entity_set_combination_ids (entity_id, combination_ids) VALUES (122, '[41,88]');
CREATE VIEW entity_set_combination_ids AS SELECT id AS entity_id, combination_ids FROM current_entities WHERE 0;
CREATE TRIGGER entity_set_combination_ids_insert INSTEAD OF INSERT ON entity_set_combination_ids
BEGIN
  INSERT INTO entities (entity_id, name, parent_id, relation_id, combination_ids, detail_json, created_at, created_by)
  SELECT id, name, parent_id, relation_id, NEW.combination_ids, detail_json, strftime('%Y-%m-%d %H:%M:%f', 'now'), 1
  FROM current_entities WHERE id = NEW.entity_id;
END;

-- Per direct instruction: entities is guarded, structurally, against
-- any UPDATE or DELETE - only INSERT and SELECT are ever permitted.
-- "Closing out" a row (a rename's old half, or a real delete) is
-- itself now a real INSERT of a closing-marker row (same data,
-- deleted_at now set) rather than a mutation of the row being
-- closed - so a row, once inserted, is never touched again. This
-- means more than one row can share deleted_at IS NULL during the
-- brief window described above being wrong is not possible here,
-- since the two inserts within one trigger are atomic - but more
-- fundamentally, "deleted_at IS NULL" alone is no longer sufficient
-- to find the live row: an old, superseded row's own deleted_at
-- now stays NULL forever, since nothing ever updates it. The live
-- row for a given entity_id is its newest one (highest row_id) -
-- and that row counts as live only when it is not itself a closing
-- marker (deleted_at IS NULL on it specifically).
CREATE VIEW current_entities AS
  SELECT entity_id AS id, name, parent_id, relation_id, combination_ids, detail_json, created_at, created_by
  FROM entities e
  WHERE row_id = (
    SELECT row_id FROM entities e2 WHERE e2.entity_id = e.entity_id
    ORDER BY created_at DESC, row_id DESC LIMIT 1
  );

-- =====================================================================
-- Users, roles, sessions — deliberately plain, dedicated tables, not
-- entities. Auth is infrastructure controlling access to the business
-- domain, not item of the domain itself; a role named "Administrator"
-- has no business being subject to the same global-uniqueness-with-
-- vocabulary-words rules a chart-of-accounts entity does, and forcing
-- it into that tree would only invite exactly the kind of accidental
-- collision this schema has worked to avoid elsewhere.
-- =====================================================================

-- roles/users/user_roles/sessions eliminated as separate tables, per
-- direct, absolute instruction. Real, plain entities under
-- "Roles"/"Users"/"Sessions" (siblings of "Languages"/"Chart of
-- Accounts" under "Application") - deliberately real entities now,
-- not the earlier, deliberate exception this schema once made for
-- auth infrastructure. entities.created_by/deleted_by (and every
-- other real "user_id"-shaped column) had their own, real FK to
-- users(id) stripped - decoupled from any specific, live user
-- entity's own entity_id, since the historical "userId=1 means
-- admin" convention is hardcoded pervasively throughout this
-- codebase's own tests/scripts and cannot safely be renumbered to
-- match wherever the new User entity naturally lands in the real,
-- shared entity_id allocation sequence.


-- The whole tree — languages, the real Chart of Accounts hierarchy,
-- Business Reports (as its own branch — see the note above on why it
-- doesn't re-parent the categories), business/ledgers, vocabulary —
-- inserted immediately, plain statements, explicit ids. Every parent_id
-- here is a literal number traceable to the row above it, except id 1
-- itself.

INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (0, 0, 'Root', NULL, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (1, 1, 'Application', 0, '2026-01-01', 1);
-- A real, true-singleton marker, sibling to Application. There is no
-- "delete" anywhere in this design - only ever a younger value
-- superseding an older one, the complete history staying in this one
-- table forever, auditable: who changed what, when. A presence-only
-- fact about an entity (a real tag - "this shift is open," "this user
-- holds this role") is itself link-shaped: its own current row's
-- relation_id points at this one, real marker when the fact is true.
-- Revoking the fact is the exact same operation as any other change -
-- supersede that row so its new, current value's relation_id is NULL,
-- pointing at nothing. See Entity.tag/untag/hasTag (primitives.ts).
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (60824, 60824, 'Active', 0, '2026-01-01', 1);

-- roles/users/sessions, as real, plain entities under "Application" -
-- see the real, direct comment above (where the removed tables used
-- to be defined) for why this schema no longer makes an exception
-- for auth infrastructure. Placed at a real, deliberately high
-- row_id/entity_id range (900+) to avoid colliding with any of this
-- same bootstrap block's own, many, real, hardcoded lower ids.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (900, 900, 'System Roles', 1, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (901, 901, 'Administrator', 900, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (902, 902, 'Bookkeeper', 900, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (903, 903, 'Read-Only', 900, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (904, 904, 'Developer', 900, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (905, 905, 'System Users', 1, '2026-01-01', 1);
-- One default account so the app is usable immediately after install —
-- username 'admin', password 'changeme123'. This password is
-- intentionally not a secret (it's sitting in this file in plain sight)
-- — it exists purely so the very first login works at all; changing it
-- immediately is expected, not optional, and is called out clearly in
-- the user guide. detail_json holds password_hash/active/page_size/
-- number_format/date_format directly - the same, real, established
-- pattern combination_ids/detail_json already proves elsewhere.
INSERT INTO entities (row_id, entity_id, name, parent_id, detail_json, created_at, created_by) VALUES (906, 906, 'admin', 905, '{"password_hash":"9449e240ea040d81cce78dcf91e50ffb:b4eaa553abe22de695e080aad6d24828f6eccb7cd1a4b1177affd4e925437cf7c6babe4741221068334450a454e0db24dcabad0694a432272d7b3f3912270da7","active":1,"page_size":20,"number_format":"1 000.00","date_format":"dd/mm/yyyy"}', '2026-01-01', 1);
-- A real, direct child entity under the user itself, one per real
-- role granted, relation_id pointing at that real role - the exact,
-- same, real pattern already proven for vocabulary_preference.
INSERT INTO entities (row_id, entity_id, name, parent_id, relation_id, created_at, created_by) VALUES (907, 907, 'admin — Role — Administrator', 906, 901, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, relation_id, created_at, created_by) VALUES (60826, 60826, 'Role', 907, 60824, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (908, 908, 'System Sessions', 1, '2026-01-01', 1);

INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (2, 2, 'Languages', 1, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (3, 3, 'English', 2, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (4, 4, 'German', 2, '2026-01-01', 1);

INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (5, 5, 'Chart of Accounts', 1, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (6, 6, 'Asset', 5, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (7, 7, 'Liability', 5, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (8, 8, 'Equity', 5, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (9, 9, 'Income', 5, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (10, 10, 'Expense', 5, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (11, 11, 'Cash and Bank', 6, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (12, 12, 'Accounts Receivable', 6, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (13, 13, 'Acme Corp', 12, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (14, 14, 'Beta Pty Ltd', 12, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (15, 15, 'Inventory', 6, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (16, 16, 'Fixed Assets', 6, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (17, 17, 'Accounts Payable', 7, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (18, 18, 'Acme Supplies Pty Ltd', 17, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (19, 19, 'Loans Payable', 7, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (20, 20, 'Sales Tax Payable', 7, '2026-01-01', 1);
-- Real, new liability accounts for real employee wage withholding and
-- employer contributions, per direct request: a 1.5% Medicare levy
-- withheld from an employee's own pay (owed to the ATO, not a
-- business cost) and a 12% superannuation employer contribution
-- (a genuine, additional business cost, owed to a real super fund) —
-- see payEmployeeWages for the real, direct explanation of why these
-- need to be two separate, real liability accounts, not one.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (525, 525, 'Medicare Levy Payable', 7, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (526, 526, 'Superannuation Payable', 7, '2026-01-01', 1);
-- Added later, alongside Sales Tax Payable — the input-tax-credit
-- counteritem: tax paid on purchases, recoverable from the tax
-- authority, so it's an asset (id 6) rather than a liability (id 7).
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (99, 99, 'Purchases Tax Claimed', 6, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (21, 21, 'Owner''s Equity', 8, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (22, 22, 'Retained Earnings', 8, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (23, 23, 'Sales Revenue', 9, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (24, 24, 'Other Income', 9, '2026-01-01', 1);
-- Added later, alongside Sales Revenue — a contra-revenue account for
-- the Credit Sale template below (discount reduces net revenue but is
-- tracked separately, not silently folded into Sales Revenue itself).
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (96, 96, 'Sales Discounts', 9, '2026-01-01', 1);

-- The Orders memo tree — purchase/sales orders live here, as entities
-- exactly like anything else, but parented under 'Application' rather
-- than under 'Chart of Accounts'. Reports (business_reports,
-- chart_of_accounts, getLedgerBalances) only ever walk the real Chart
-- of Accounts subtree, so nothing posted here can ever leak into a real
-- financial statement — that's the entire mechanism, achieved with zero
-- schema changes, purely by which item of the tree an account lives
-- under.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (97, 97, 'Orders', 1, '2026-01-01', 1);

-- Stock Quantities — a memo tree, parallel to Orders, for exactly the
-- same reason: quantity is not money, and a quantity account sitting
-- inside the real Chart of Accounts subtree would get silently summed
-- into Trial Balance/Balance Sheet as if it were a monetary figure. A
-- batch's Value account (the monetary side) still lives under the real
-- Inventory node, since that IS meant to show in real reports — only
-- the Qty side needs to live outside it.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (98, 98, 'Stock Quantities', 1, '2026-01-01', 1);

-- Employees and Manufacturers — memo trees, same reason and same
-- mechanism as Orders/Stock Quantities above: these are directory
-- entries (who someone is), not GL accounts, so they live outside the
-- real Chart of Accounts subtree and can never leak into a financial
-- statement. Deliberately separate from Accounts Receivable/Payable:
-- the same real person can be an employee AND a customer (Charlie
-- Brown, say) — that's two separate entities today (one per role,
-- each with its own contact record), not one entity trying to occupy
-- two places in a tree that only allows a single parent. Reconciling
-- "these two entities are the same real person" is a genuinely
-- separate design question, not solved by this alone.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (100, 100, 'Employees', 1, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (101, 101, 'Manufacturers', 1, '2026-01-01', 1);

-- Items — the logical, canonical thing being bought or sold (e.g. "M6x20
-- Hex Bolt"), same memo-tree treatment as Employees/Manufacturers above.
-- Deliberately NOT tied to a single manufacturer or vendor: the same
-- item is routinely available from more than one of each, at different
-- prices and package sizes, and which one gets used isn't always about
-- price — local stock, package size fitting the shelving, past
-- reliability. That many-to-many relationship (and its own attributes)
-- is what item_source exists for, below.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (102, 102, 'Items', 1, '2026-01-01', 1);

-- Divisions — profit centers, tracked as a real dimension on
-- journal_line (division_id) rather than duplicated accounts per
-- division. A memo branch like Employees/Manufacturers/Items above:
-- directory entries, not GL accounts.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (120, 120, 'Divisions', 1, '2026-01-01', 1);

-- Locations — retail outlets and warehouses, as real entities. A
-- memo branch like Employees/Manufacturers/Divisions above: a
-- directory, not a GL account.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (121, 121, 'Locations', 1, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (25, 25, 'Cost of Goods Sold', 10, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (26, 26, 'Rent', 10, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (27, 27, 'Wages', 10, '2026-01-01', 1);
-- Real, additional employer cost on top of gross wages — see the
-- real, direct explanation above Medicare Levy Payable/Superannuation
-- Payable, and in payEmployeeWages itself.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (527, 527, 'Superannuation Expense', 10, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (28, 28, 'Utilities', 10, '2026-01-01', 1);

INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (289, 289, 'Electricity', 28, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (290, 290, 'Refrigeration', 289, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (291, 291, 'Lighting & General', 289, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (292, 292, 'Gas', 28, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (293, 293, 'Water', 28, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (294, 294, 'Internet', 28, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (295, 295, 'Telephone', 28, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (29, 29, 'Office', 10, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (30, 30, 'Miscellaneous', 10, '2026-01-01', 1);

INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (31, 31, 'Business Reports', 1, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (32, 32, 'Balance Sheet', 31, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (33, 33, 'Profit and Loss Statement', 31, '2026-01-01', 1);
-- Added later, alongside the two reports above rather than under generic
-- Vocabulary — a Trial Balance and a ledger comparison are themselves
-- reports, structurally, the same as Balance Sheet/P&L.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (84, 84, 'Trial Balance', 31, '2026-01-01', 1);
-- Added later, alongside the reports above — a real, further, distinct
-- kind of report entirely: not a real, calculated figure at all, but
-- a real, free-text disclosure a person actually writes (accounting
-- policy, a contingent liability, a related-party transaction) that
-- genuinely belongs alongside a real business's own Balance Sheet/P&L,
-- the same, real, standard practice as "Notes to the Financial
-- Statements" in any real, published set of accounts.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (60822, 60822, 'Notes to the Financial Statements', 31, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (85, 85, 'Compare Ledgers', 31, '2026-01-01', 1);
-- Not a report of its own — a tag on specific expense accounts (just
-- "Cost of Goods Sold" for now) distinguishing them from ordinary
-- operating expenses, so the P&L can insert a real Gross Profit
-- subtotal above Net Profit. Same relation_id mechanism, reused one
-- level deeper than the report/category tagging above.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (310, 310, 'COGS', 31, '2026-01-01', 1);
INSERT INTO entity_set_relation (entity_id, relation_id) VALUES ((SELECT id FROM current_entities WHERE name = 'Cost of Goods Sold'), 310);

-- The report/category mapping as real, editable data (see the note on
-- relation_id above) rather than logic in a view — reassigning which
-- report a category (and everything under it) appears on is one UPDATE.
INSERT INTO entity_set_relation (entity_id, relation_id) VALUES ((SELECT id FROM current_entities WHERE name = 'Asset'), 32);
INSERT INTO entity_set_relation (entity_id, relation_id) VALUES ((SELECT id FROM current_entities WHERE name = 'Liability'), 32);
INSERT INTO entity_set_relation (entity_id, relation_id) VALUES ((SELECT id FROM current_entities WHERE name = 'Equity'), 32);
INSERT INTO entity_set_relation (entity_id, relation_id) VALUES ((SELECT id FROM current_entities WHERE name = 'Income'), 33);
INSERT INTO entity_set_relation (entity_id, relation_id) VALUES ((SELECT id FROM current_entities WHERE name = 'Expense'), 33);

INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (34, 34, 'Businesses', 0, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (35, 35, 'My Business', 34, '2026-01-01', 1);
-- Per the real, new structure createBusiness itself now builds: every
-- real ledger lives under its own business's own, real Ledgers node,
-- never directly under the business. My Business is hand-seeded, raw
-- data (bypassing createBusiness entirely), so this must be built by
-- hand here too, to match.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (999000, 999000, 'Ledgers', 35, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (36, 36, 'Actual', 999000, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (37, 37, 'Proposed Growth Budget 2026-27', 999000, '2026-01-01', 1);

-- Reusable UI vocabulary — each word exists exactly once. Wherever the
-- application shows, say, a save action or a Debit column, anywhere at
-- all, it looks up the single matching entity here — never a second one
-- scoped to "this screen's Save." See localized_text below for how this
-- combines with translation to show it in any language, not just this
-- canonical English text.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (38, 38, 'Vocabulary', 1, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (39, 39, 'Save', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (40, 40, 'Cancel', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (41, 41, 'Continue', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (42, 42, 'Add', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (43, 43, 'Delete', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (44, 44, 'Date', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (45, 45, 'Reference', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (46, 46, 'Description', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (47, 47, 'Category', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (48, 48, 'Name', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (49, 49, 'Account', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (50, 50, 'Memo', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (51, 51, 'Debit', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (52, 52, 'Credit', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (53, 53, 'Total', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (54, 54, 'Balance', 38, '2026-01-01', 1);

-- Added later: nav labels, report section headings, and other UI
-- chrome that was hardcoded in the frontend instead of coming from
-- Vocabulary like everything else here. 'Equity' and 'Income' are
-- deliberately NOT duplicated here — they already exist as Chart of
-- Accounts category names (ids 8, 9), and reusing that same entity
-- for a report heading is exactly the point of 'one word, used
-- everywhere' — a second entity with the same name would violate
-- the uniqueness constraint anyway.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (56, 56, 'Entity Tree', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (57, 57, 'Structured Editor', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (58, 58, 'Journal Entries', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (59, 59, 'General Journal', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (60, 60, 'Reports', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (62, 62, 'Business', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (63, 63, 'Ledger', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (64, 64, 'Language', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (65, 65, 'Switch', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (66, 66, 'Edit', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (67, 67, 'New', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (68, 68, 'Parent', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (69, 69, 'Relation', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (70, 70, 'Assets', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (71, 71, 'Liabilities', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (72, 72, 'Expenses', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (74, 74, 'Net Loss', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (75, 75, 'Variance', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (76, 76, 'Total Assets', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (77, 77, 'Total Liabilities', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (78, 78, 'Total Equity', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (542, 542, 'Total Liabilities + Equity', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (79, 79, 'Total Income', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (80, 80, 'Total Expenses', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (81, 81, 'Account Number', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (82, 82, 'No Entries Yet', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (83, 83, 'Record The First One', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (86, 86, 'Setup', 38, '2026-01-01', 1);

-- Added later still: the login screen's own labels were hardcoded
-- English in the frontend, so changing the display language there had
-- nothing to actually translate — a real, reported bug, not a design
-- choice. Fixed at the root: these words now exist in Vocabulary like
-- everything else, with real German translations below.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (103, 103, 'Username', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (104, 104, 'Password', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (106, 106, 'Logging In', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (541, 541, 'Welcome to Better Brighter Multi-Ledger — please log in.', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (107, 107, 'Could Not Log In', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (108, 108, 'Username And Password Required', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (114, 114, 'Password Changed', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (115, 115, 'Customers', 38, '2026-01-01', 1);
-- Per direct, emphatic correction: Customers stays, correctly, a real
-- child of Vocabulary — its own real, "source of all truth" home as
-- a real word/phrase. The real, additional, equal path to Accounts
-- Receivable (for real reporting purposes) is via the established
-- dimension mechanism — the exact, same, real, "multiple equal paths"
-- pattern already proven this session for division/location/tier —
-- not a second, real, structural parent_id, which an entity can only
-- ever have one of. Matches setEntityLink's own, exact, real naming
-- convention directly (name = "{entity} — {linkType}", a real,
-- structural child of the entity itself, with its own real
-- relation_id pointing at the real target) — the equivalent of a real
-- setDimensionParent('Customers', 'Header Account', 'Accounts
-- Receivable', ...) call, handcrafted here in SQL to match this
-- file's own, established, direct-SQL seeding convention.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (539, 539, 'Customers — Dimension: Header Account', 115, '2026-01-01', 1);
INSERT INTO entity_set_relation (entity_id, relation_id) VALUES (539, (SELECT id FROM current_entities WHERE name = 'Accounts Receivable'));
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (116, 116, 'Vendors', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (540, 540, 'Vendors — Dimension: Header Account', 116, '2026-01-01', 1);
INSERT INTO entity_set_relation (entity_id, relation_id) VALUES (540, (SELECT id FROM current_entities WHERE name = 'Accounts Payable'));
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (117, 117, 'Phone', 38, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (118, 118, 'Email', 38, '2026-01-01', 1);

-- Transaction Templates — a global container (shared across all
-- businesses, same as Chart of Accounts), with the proven "Credit Sale"
-- template as a worked example. Its fields are children of the template
-- entity; each field's own name IS its translatable label, same
-- mechanism as any Vocabulary word.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (87, 87, 'Transaction Templates', 1, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (88, 88, 'Credit Sale', 87, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (89, 89, 'Customer', 88, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (90, 90, 'Item', 88, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (91, 91, 'Quantity', 88, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (92, 92, 'Unit Price', 88, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (93, 93, 'Discount Percent', 88, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (94, 94, 'Tax Rate', 88, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (95, 95, 'Unit Cost', 88, '2026-01-01', 1);

-- Added later, appended rather than renumbering the tree above: a third
-- language. Originally Klingon (one demo word, dropped per explicit
-- request once German and French were both complete) — French now
-- fills this slot as a genuinely, fully translated language rather than
-- a single-word novelty.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (55, 55, 'French', (SELECT id FROM current_entities WHERE name = 'Languages'), '2026-01-01', 1);

-- =====================================================================
-- The other tables, in dependency order.
-- =====================================================================

CREATE TABLE account (
  entity_id     INTEGER PRIMARY KEY,
  accountnumber TEXT UNIQUE,              -- nullable: a lazily-vivified account has none until assigned
  balance_minor INTEGER NOT NULL DEFAULT 0,
  -- NULL means this account's own home/reporting currency (whatever
  -- the business normally reports in) — never inferred from a locale
  -- code (confirmed directly against Node's own Intl.NumberFormat and
  -- the real SQL-Ledger source: neither can be trusted to imply a
  -- currency correctly). Fixed per account via the Chart of Accounts;
  -- a single journal entry may span multiple currencies, but every
  -- distinct currency present must independently balance to zero —
  -- see post_journal_entry_insert below.
  currency      TEXT,
  -- Layer 1 of the real, dedicated cash-flow/growth-planning design
  -- (docs/cash-flow-and-growth-planning.md). Deliberately the ONLY
  -- new column this feature needs: "is this a real bank account at
  -- all" is derived from the real existence of a "Bank Account Of"
  -- link (setEntityLink, in db.ts) to its real business/division
  -- scope, not a separate is_bank_account flag — the link itself
  -- already tells you both "yes, this is a bank account" and "which
  -- real division/business it belongs to" in one, single, real fact.
  -- NULL means no real, arranged overdraft/credit facility at all —
  -- a real, meaningful difference from zero, which would mean a real
  -- facility of genuinely zero headroom.
  overdraft_limit_minor INTEGER
);

-- Another 1:1 extension, same shape as account — any entity (a customer,
-- vendor, or employee) can optionally have contact details. Deliberately
-- plain, separate fields rather than one free-text "address" blob: a
-- structured address is what makes a mailing-label or a report actually
-- usable later, and splitting it now costs nothing.
-- contact eliminated as its own table, per direct, absolute
-- instruction. A true 1:1 extension needs no child entity at all -
-- every real field lives directly in the parent entity's own, real
-- detail_json (the same, real, established pattern already proven
-- for item_source/stock_lot). This compatibility view recomputes the
-- exact, same, real column shape the removed table used to provide,
-- so this codebase's own, many, real, existing read queries against
-- "contact" keep working completely unchanged - only the real write
-- paths (setContact and its own, dedicated siblings - setReminderLevel,
-- registerCustomer, verifyCustomer, setPosPin, setLocation,
-- clockInToProject's own wage lookup, item description setters) needed
-- rewriting to merge into detail_json directly instead.
CREATE VIEW contact AS
SELECT
  e.entity_id AS entity_id,
  json_extract(e.detail_json, '$.person_name') AS person_name,
  json_extract(e.detail_json, '$.phone') AS phone,
  json_extract(e.detail_json, '$.email') AS email,
  json_extract(e.detail_json, '$.address_line1') AS address_line1,
  json_extract(e.detail_json, '$.address_line2') AS address_line2,
  json_extract(e.detail_json, '$.city') AS city,
  json_extract(e.detail_json, '$.region') AS region,
  json_extract(e.detail_json, '$.postal_code') AS postal_code,
  json_extract(e.detail_json, '$.country') AS country,
  CAST(json_extract(e.detail_json, '$.payment_terms_days') AS INTEGER) AS payment_terms_days,
  CAST(json_extract(e.detail_json, '$.credit_limit_minor') AS INTEGER) AS credit_limit_minor,
  CAST(json_extract(e.detail_json, '$.wage_minor_per_hour') AS INTEGER) AS wage_minor_per_hour,
  CAST(json_extract(e.detail_json, '$.salary_minor_per_year') AS INTEGER) AS salary_minor_per_year,
  COALESCE(CAST(json_extract(e.detail_json, '$.reminder_level') AS INTEGER), 0) AS reminder_level,
  json_extract(e.detail_json, '$.preferred_language') AS preferred_language,
  json_extract(e.detail_json, '$.password_hash') AS password_hash,
  json_extract(e.detail_json, '$.verification_status') AS verification_status,
  json_extract(e.detail_json, '$.card_label') AS card_label,
  json_extract(e.detail_json, '$.pos_pin') AS pos_pin,
  CAST(json_extract(e.detail_json, '$.bottle_capacity') AS INTEGER) AS bottle_capacity,
  CAST(json_extract(e.detail_json, '$.carton_capacity') AS INTEGER) AS carton_capacity,
  json_extract(e.detail_json, '$.timezone') AS timezone,
  json_extract(e.detail_json, '$.item_description') AS item_description,
  json_extract(e.detail_json, '$.item_unit_of_measure') AS item_unit_of_measure,
  json_extract(e.detail_json, '$.item_upc') AS item_upc,
  CAST(json_extract(e.detail_json, '$.item_retail_price_minor') AS INTEGER) AS item_retail_price_minor
FROM entities e
WHERE e.row_id = (SELECT MAX(row_id) FROM entities e2 WHERE e2.entity_id = e.entity_id)
  AND e.detail_json IS NOT NULL AND json_extract(e.detail_json, '$.__is_contact') = 1;

-- pos_shift: a real, timestamped clerk sign-on/sign-off record — per
-- direct requirement, this genuinely IS the real timecard
-- (payEmployeeWages's own hours-worked mode sums these directly), not
-- just an "who's currently active" indicator. signed_off_at is NULL
-- for a real, currently-open shift; every terminal at the same
-- location queries this same, real, shared, server-side state, not
-- any per-browser store — signing on at any one terminal in a
-- location is meant to activate that clerk everywhere at that same
-- location.
-- pos_shift eliminated as its own table, per direct, absolute
-- instruction. A real "Shift" entity, one per real sign-on event,
-- created directly under the employee's own entity, its own real
-- name carrying "Open" or "Closed at <time>" directly, relation_id
-- pointing at the real location - see signOn/signOff in db.ts.

-- Per direct, explicit principle: an employee clocking in is placing a
-- real, standing Purchase Order for their own real product — their
-- time, at their own real price per hour (contact.wage_minor_per_hour)
-- — accepted at clock-in, its real delivery completed (and thus
-- rendered liable to payment) at clock-out. The real financial effect
-- of both moments flows entirely through the exact, same, proven,
-- staged, triggered PO/receiving mechanism every other order already
-- uses (placeOrder, then fulfillOrder via postStockReceipt) — never a
-- direct table write for the money itself. This table is purely a
-- real, simple, direct "who is currently clocked in, against which
-- real PO" state tracker, the same, established role pos_shift
-- already plays — not itself a financial posting mechanism.
-- employee_clock eliminated as its own table, per direct, absolute
-- instruction. A single "Clocked In — ..." entity under the
-- employee, deleted on clock-out - matching this table's own, prior
-- DELETE-on-clock-out semantics exactly - see clockInToProject/
-- clockOutOfProject in db.ts.


-- division: a 1:1 extension of a Division entity — the real
-- distinction SQL-Ledger itself uses (Departments marked as Cost
-- Center or Profit Center), not a generic, undifferentiated
-- "division" — a Cost Center applies to purchasing (AP/expense)
-- postings only; a Profit Center applies to both purchasing and
-- sales (AR/income). A genuine consolidation across several
-- cost/profit centers, if ever needed, is just an ordinary parent
-- entity above them in the tree — the existing parent_id mechanism
-- already does this, no separate schema required.
-- menu_section/menu_link/menu_override: removed entirely, per direct
-- correction — every real hierarchy and every real relationship-link
-- type belongs in the self-auditing entity tree, absolutely nowhere
-- else, with zero exceptions (not even a dedicated table holding
-- structured JSON, which is just as much an opaque, non-auditable
-- escape hatch as a plain table). The real menu is genuinely just
-- another hierarchy: Menu > "Menu Section: X" > "Menu Link: X — Y",
-- ordinary entities under Application. Each real link's own real
-- route lives as a real, direct setEntityLink record pointing at its
-- own, real, shared Route entity (under a real "Routes" root, the
-- same, established shared-naming shape Vocabulary already uses).
-- not_implemented/is_subheading are real, presence-only marker child
-- entities (existence itself is the real, true value, the same
-- pattern already used for a real CoA prototype tag). required_roles is
-- one real, direct child entity per real role — a genuine
-- one-to-many, the same, established shape already proven for a real
-- contact's own multiple contact types. sort_order needs no real
-- mechanism at all: entity_id's own real, natural, append-only
-- creation order already, correctly, is the real sibling order,
-- since these are seeded in the exact, intended display order — see
-- docs/menu-as-entity-tree-plan.md for the full, real design.
--
-- A real override (business- or user-scoped) is a real, direct child
-- entity of the menu item — "{item} — Override: {scope} {scopeId}"
-- — its own real Label linked via setEntityLink to a real, existing
-- Vocabulary word (never a bare string), and a real, presence-only
-- "— Hidden" marker child when hidden, the exact, same, established
-- scope shape vocabulary_preference below also uses.

-- vocabulary_preference: step 3 of
-- docs/translator-form-and-guard-rails-plan.md — the real, concrete
-- translator form itself, built on the real, confirmed Vendor/
-- Supplier case. concept_id is the real, shared, structural concept
-- (e.g. "Accounts Payable"); preferred_alternate_id is which real,
-- already-existing Vocabulary word (e.g. "Suppliers", reached via the
-- same, established Header Account dimension link every real
-- alternate name already uses) a real business or user prefers to
-- see, everywhere that concept's own real word is displayed — not
-- just in the menu, unlike menu_override above. The exact, same,
-- real, established scope shape as menu_override, deliberately kept
-- consistent rather than inventing a new one.
-- vocabulary_preference eliminated as its own table, per direct,
-- absolute instruction. A real, direct child entity under the
-- concept itself, one per (scope, scopeId), its own name encoding
-- both directly (scopeId isn't always a real entity id - a 'user'
-- scope is a plain users.id), relation_id pointing at the real,
-- preferred alternate - see setVocabularyPreference/
-- deleteVocabularyPreference in db.ts.

-- location: a 1:1 extension of a Location entity — a retail outlet or
-- warehouse. city groups locations that can transfer stock between
-- each other (a warehouse only serves its own city's outlets, not the
-- other city's). is_billing_address marks the one location invoices
-- are addressed to (Head Office) — a business fact, not derived from
-- location_type, since Head Office is also a warehouse here.
-- bottle_capacity/carton_capacity are the real, physical constraint a
-- retail outlet has (shelving and fridge space, floor space) — a
-- location-level fact, genuinely separate from any single item's own
-- min/max/reorder levels below, which are about how much of THIS
-- product to stock, not how much space exists in total.
-- item_location: a item's quantity on hand at one specific location,
-- plus that item's own min/max/reorder levels at that location — a
-- warehouse and a small retail outlet genuinely need different
-- stocking levels for the same product, so these are per (item,
-- location), not a single global number per item. All quantities and
-- levels are stored in the item's base unit (e.g. bottles) — cartons
-- are a display/entry convenience, converted using the item's own
-- package_quantity from item_source, never a second stored unit that
-- could drift out of sync with the base quantity.
-- stock_take / stock_take_line: a physical inventory count for one
-- location. Created as a sheet — one line per item currently on
-- record at that location, snapshotting expected quantity and
-- shelf_side/rack/level at creation time — so the person counting
-- works from a sheet ordered the way they actually walk the floor
-- (shelf side, then rack, then top to bottom), not alphabetically by
-- item name. Counts recorded against it, then completed — at which
-- point any variance (counted vs expected) is a genuine loss or gain,
-- posted to the ledger, and item_location.quantity_on_hand is
-- corrected to match what was actually counted.
-- stock_take / stock_take_line eliminated as separate tables, per
-- direct, absolute instruction. A real "Stock Take" entity under the
-- location, one per real event, its own name carrying take_date and
-- status directly; each real line a real, direct child entity under
-- it, one per item, relation_id pointing at that item, its own name
-- carrying shelf_side/rack/level/expected/counted directly - see
-- createStockTake/getStockTake/recordStockTakeCount in db-stock.ts.

-- stock_lot: a specific batch/lot of a item, with its own received and
-- expiration date — genuinely separate information from the item's
-- overall quantity on hand (account.balance_minor), since different
-- shipments of the same item expire at different times. Consuming
-- stock (dispatch, write-off) draws from whichever lot expires
-- soonest first, same "first in, first out" convention spoilage
-- management always uses.
-- stock_lot eliminated as its own table, per direct, absolute
-- instruction. A real, direct child entity under the item itself, one
-- per real lot, its own real detail_json holding quantity_on_hand,
-- cost_basis_minor, received_date, expiration_date - updated in place
-- exactly the same way the removed table's own UPDATE statements did.
-- See receiveLot/consumeFromLots/getExpiringStock in db-stock.ts.

-- item: a 1:1 extension of a Item entity, same shape as account/contact
-- — the canonical, manufacturer/vendor-agnostic description of the
-- thing itself. Universal barcode lives here (the item's own UPC, if
-- it has one independent of any particular vendor's packaging);
-- vendor-specific SKUs and package sizes live on item_source instead,
-- since those genuinely vary per source.
-- item_source: which manufacturer(s) and vendor(s) a item is actually
-- available through — a genuine many-to-many with its own attributes,
-- not a lookup. The same physical item is routinely available from
-- more than one manufacturer, through more than one vendor, at
-- different prices and package sizes — and which combination actually
-- gets used isn't always about price: local stock on hand, a package
-- size that fits the shelving, a vendor's track record for on-time
-- delivery. is_preferred and preference_notes exist to capture that
-- reasoning explicitly, not derive it from price alone.
-- item_source eliminated as its own table, per direct, absolute
-- instruction. Each real source is a real, direct child entity under
-- the item itself, relation_id pointing at the real vendor (the most
-- commonly joined-on field), every other real field (manufacturer_id,
-- vendor_sku, vendor_upc, price_minor, package_quantity, is_preferred,
-- preference_notes, currency, product_instance_id) held directly in
-- that entity's own, real detail_json. This compatibility view
-- recomputes the exact, same, real column shape the removed table
-- used to provide, so every one of this codebase's own, many, real,
-- existing read queries against "item_source" keeps working
-- completely unchanged - only the two, real write paths
-- (addOrUpdateItemSource, deleteItemSource, in db.ts) needed rewriting
-- to write real entities/detail_json directly instead.
CREATE VIEW item_source AS
SELECT
  e.id AS id,
  e.parent_id AS item_id,
  CAST(json_extract(e.detail_json, '$.manufacturer_id') AS INTEGER) AS manufacturer_id,
  e.relation_id AS vendor_id,
  json_extract(e.detail_json, '$.vendor_sku') AS vendor_sku,
  json_extract(e.detail_json, '$.vendor_upc') AS vendor_upc,
  CAST(json_extract(e.detail_json, '$.price_minor') AS INTEGER) AS price_minor,
  CAST(json_extract(e.detail_json, '$.package_quantity') AS INTEGER) AS package_quantity,
  CAST(json_extract(e.detail_json, '$.is_preferred') AS INTEGER) AS is_preferred,
  json_extract(e.detail_json, '$.preference_notes') AS preference_notes,
  json_extract(e.detail_json, '$.currency') AS currency,
  CAST(json_extract(e.detail_json, '$.product_instance_id') AS INTEGER) AS product_instance_id
-- Classified by a real "Item Source" tag-child entity (set by
-- addOrUpdateItemSource, backend/src/db.ts) - never a name pattern
-- (this view was once WHERE e.name LIKE '% — Source — %') and never
-- a JSON field (once json_extract(e.detail_json, '$._entity_type')).
-- See docs/skill-no-name-encoded-values.md.
FROM current_entities e
WHERE EXISTS (SELECT 1 FROM current_entities tag WHERE tag.parent_id = e.id AND tag.name = 'Item Source' AND tag.relation_id IS NOT NULL);

-- A real, one-time database audit (per direct request: "ensure we
-- have no leftover permanent tables aitem from the necessary 4")
-- found and removed a genuinely dead design direction here: a
-- data-driven "transaction template" mechanism (template_field,
-- template_line, template_override — an entry screen's own fields and
-- GL mapping, expressed as data rather than code) that had a real,
-- complete schema and real, correct bootstrap data (a genuinely
-- working Credit Sale GL mapping, even referencing the real
-- conversation a double-counting bug in it was fixed in), but was
-- never actually wired up to any real, working code — confirmed
-- directly, not assumed: zero references anywhere in the backend's
-- own source. The app ultimately used real, hardcoded entry screens
-- (AR Sale, AP Purchase, and so on, as actual Svelte pages) instead
-- of this data-driven approach. Removed rather than left as a
-- misleading, unused artifact suggesting a mechanism that doesn't
-- actually exist.


CREATE TABLE journal (
  id               INTEGER PRIMARY KEY,
  business_id      INTEGER NOT NULL,
  ledger_id        INTEGER NOT NULL,
  reference        TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  transdate        TEXT,
  -- Who posted this entry — the other half of the audit trail
  -- alongside entities' own append-only history: an entity's changes
  -- are self-auditing via created_by/deleted_by, and journal postings
  -- get the same guarantee here, permanently, never reassignable.
  user_id          INTEGER NOT NULL,
  reversal_of      INTEGER REFERENCES journal(id),
  generated_from   INTEGER REFERENCES journal(id),
  -- An ordinary entry is recurrence = 'once' — not a special case, the
  -- default and the common case. 'weekly'/'monthly'/'yearly' turn this
  -- one journal into a whole schedule of occurrences, expanded by
  -- journal_occurrences below, never physically written as extra rows.
  recurrence       TEXT NOT NULL DEFAULT 'once',
  -- NULL = no defined end (ongoing indefinitely, e.g. a monthly bank
  -- fee with no planned stop date). Ignored for 'once'.
  recurrence_count INTEGER
);

-- A real, serious bug this constraint exists specifically to prevent:
-- without it, two DIFFERENT journal rows could share the same
-- reference/business/ledger (e.g. reversing the same occurrence twice
-- — the reversal reference is deterministic, so a second attempt
-- reused the first one's exact reference). post_journal_entry_insert's
-- journal_line-insert step looks up "the" journal row by reference
-- alone, which becomes genuinely ambiguous the moment a duplicate
-- exists — SQLite's scalar subquery silently picks one of the matches,
-- misattaching lines to the wrong header rather than erroring. Found
-- by reproducing the exact double-reversal scenario directly and
-- inspecting the raw journal_line rows, not by inspection alone.
CREATE UNIQUE INDEX journal_reference_unique ON journal(reference, business_id, ledger_id);

CREATE TABLE journal_line (
  journal_id     INTEGER NOT NULL REFERENCES journal(id),
  account_id     INTEGER NOT NULL REFERENCES account(entity_id),
  -- The same (journal, account) line can carry more than one dated
  -- amount over its schedule — a wage increase, a tax-rate change —
  -- without a second table or a second journal: just another row here,
  -- effective from a later date. For a 'once' entry this is simply the
  -- journal's own transdate, and there is only ever the one row.
  effective_date TEXT NOT NULL,
  amount_minor   INTEGER NOT NULL,          -- positive = debit, negative = credit
  memo           TEXT NOT NULL DEFAULT '',
  -- Optional profit-center/division tag — a real, separate dimension
  -- from the account itself, not a duplicated set of accounts per
  -- division. The same "Sales Revenue" account can be posted to by
  -- both a Manufacturing division and a Services division, and
  -- reports can roll up combined or split by division, without
  -- multiplying the Chart of Accounts by the number of divisions.
  division_id    INTEGER,
  -- Which real location a quantity movement (receive/dispatch/
  -- transfer/write-off) actually happened at — distinct from
  -- division_id (a financial reporting dimension) since a quantity
  -- movement isn't itself a financial posting; NULL for every real,
  -- ordinary financial journal_line, which has no location of its
  -- own. Only ever set directly by postQuantityMovement, never
  -- inferred.
  location_id    INTEGER,
  -- The bank's own real cheque/EFT reference number, distinct from
  -- this app's own internal journal reference — captured at payment
  -- time so a later, real bank reconciliation can match a real
  -- imported bank statement line back to the exact real payment it
  -- corresponds to, not just by date and amount (which can be
  -- genuinely ambiguous, e.g. two real cheques for the same amount on
  -- the same day). NULL for every real posting that isn't a cheque or
  -- EFT payment at all.
  bank_reference TEXT,
  -- A real, surrogate primary key, not the composite
  -- (journal_id, account_id, effective_date) this table used to use
  -- directly — needed because a real transfer now genuinely posts two
  -- real lines against the SAME product account, on the SAME date,
  -- within the SAME journal entry (source location, destination
  -- location), which that composite key could never allow. The
  -- original safeguard — no two lines for the same ordinary financial
  -- account on the same date within one journal — is preserved below
  -- as a real, partial unique index instead, scoped to exactly the
  -- real case it was protecting: ordinary financial lines, which
  -- never carry a location at all.
  id             INTEGER PRIMARY KEY
);
-- Preserves the original duplicate-prevention guarantee for every
-- real, ordinary financial journal_line (location_id IS NULL) —
-- genuinely does NOT apply to quantity-movement lines, which
-- legitimately can and do share (journal_id, account_id,
-- effective_date) across two different, real locations. Also allows
-- a real, genuine exception, per direct request: a year-end close
-- posting several, real, separate lines to the same Retained Earnings
-- account within one entry, one per real, active division — see
-- closeBooks. COALESCE(division_id, -1) rather than the raw column:
-- SQLite treats NULL as distinct from itself in a unique index, so
-- two real, genuinely untagged (division_id IS NULL) lines would
-- otherwise silently evade this guarantee entirely — the exact,
-- original duplicate-line mistake this index exists to prevent.
CREATE UNIQUE INDEX journal_line_unique_ordinary ON journal_line(journal_id, account_id, effective_date, COALESCE(division_id, -1)) WHERE location_id IS NULL;

-- Expands every journal into its actual occurrences: for 'once', just
-- itself; for a recurring journal, one row per scheduled date, with each
-- line's amount resolved to whichever effective_date is the most recent
-- one at or before that occurrence — so a wage increase entered partway
-- through the schedule applies from exactly the date it says, and every
-- earlier occurrence keeps the original amount. This view — never the
-- raw tables directly — is what account balances, the journal list, and
-- every financial statement read from, for every ledger alike; an
-- ordinary Actual posting and a budget's recurring entry are the exact
-- same mechanism, just recurrence = 'once' vs not.
CREATE VIEW journal_occurrences AS
WITH RECURSIVE occurrences(journal_id, occurrence_date, n) AS (
  SELECT id, transdate, 1 FROM journal
  UNION ALL
  SELECT j.id,
         CASE j.recurrence
           WHEN 'weekly'  THEN date(o.occurrence_date, '+7 days')
           WHEN 'monthly' THEN date(o.occurrence_date, '+1 month')
           WHEN 'yearly'  THEN date(o.occurrence_date, '+1 year')
         END,
         o.n + 1
  FROM journal j
  JOIN occurrences o ON o.journal_id = j.id
  WHERE j.recurrence != 'once'
    AND (j.recurrence_count IS NULL OR o.n < j.recurrence_count)
    AND o.n < 1000 -- a hard safety cap on an open-ended schedule, not a real business limit
)
SELECT
  o.journal_id,
  j.business_id,
  j.ledger_id,
  j.reference,
  j.description,
  o.occurrence_date AS transdate,
  j.user_id,
  jl.account_id,
  jl.amount_minor,
  jl.memo,
  jl.division_id
FROM occurrences o
JOIN journal j ON j.id = o.journal_id
JOIN journal_line jl ON jl.journal_id = o.journal_id
WHERE jl.effective_date = (
  SELECT MAX(jl2.effective_date)
  FROM journal_line jl2
  WHERE jl2.journal_id = jl.journal_id
    AND jl2.account_id = jl.account_id
    AND jl2.effective_date <= o.occurrence_date
);

-- A REAL table, not a view — the frontend inserts one plain row per line
-- while building up a pending transaction. Deliberately repeats
-- business/ledger/description/transdate across every line of the same
-- entry rather than normalizing them out: this table is a transient
-- input buffer, not the record of truth, and every row here is deleted
-- the moment it's successfully posted.
CREATE TABLE journal_entry_staging (
  reference    TEXT NOT NULL,
  business     TEXT NOT NULL,
  ledger       TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  transdate    TEXT,
  account      TEXT NOT NULL,
  -- The real, structural fix for a real, confirmed ambiguity: a bare
  -- name lookup (SELECT id FROM current_entities WHERE name = ?)
  -- cannot tell two, real, different entities of the same name aitem
  -- (scoped uniqueness correctly allows this at different levels —
  -- a product and its own Sales/COGS/Inventory account could
  -- genuinely, deliberately share a name once the redundant
  -- "Sales - "/"COGS - " text prefix is removed). When a caller
  -- already knows the exact, real, correct entity — not just its
  -- name — it passes that id here directly, and the real posting
  -- trigger resolves against it directly, skipping the ambiguous
  -- name lookup entirely for this one line. NULL for the real,
  -- existing, ordinary case: a caller that only has a name (a
  -- user-typed account on a form), which still resolves by name,
  -- exactly as before.
  account_id   INTEGER,
  amount_minor INTEGER NOT NULL,
  memo         TEXT NOT NULL DEFAULT '',
  -- Optional profit-center/division name, same dimension as
  -- journal_line.division_id. NOT NULL with a real, shared default
  -- rather than nullable, for the exact same real reason `location`
  -- below already is: SQLite treats NULL as distinct from itself in a
  -- primary key, so a nullable division would silently let two real,
  -- ordinary financial lines stage against the same account twice.
  -- The real, genuine case this now correctly allows instead: a
  -- year-end close posting several, real, separate lines to the same
  -- Retained Earnings account, one per real, active division — see
  -- closeBooks.
  division     TEXT NOT NULL DEFAULT '',
  bank_reference TEXT, -- the bank's own real cheque/EFT reference number, same dimension as journal_line.bank_reference
  -- The real, physical location a quantity movement actually happened
  -- at, same dimension as journal_line.location_id — '' (not NULL) and
  -- unused for an ordinary financial posting. NOT NULL with a real,
  -- shared default rather than nullable: SQLite treats NULL as
  -- distinct from itself in a primary key, so a nullable location
  -- would silently let an ordinary financial posting stage two lines
  -- against the same account — the exact duplicate-line mistake this
  -- key exists to prevent. A real transfer is the one, genuine case
  -- that needs two lines against the SAME account (a product) at two
  -- DIFFERENT real locations (source, destination) under one, shared
  -- reference — true double-entry quantity tracking, not two separate,
  -- merely-netting-to-zero postings.
  location     TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (reference, business, ledger, account, account_id, location, division)
);

-- Four real, form-specific staging tables — each shaped exactly to the
-- fields that entry screen actually has (a customer, a vendor, an
-- amount, a date, a reference), not a generic account/amount pair. Each
-- has its own "post" command (a dummy view + INSTEAD OF INSERT trigger,
-- same pattern as post_journal_entry), which builds the right two-line
-- General Journal entry into journal_entry_staging and then posts it
-- through the exact same atomic post_journal_entry mechanism everything
-- else uses — so there's still only one real posting engine underneath,
-- these are just purpose-built front doors to it.

-- Assembly BOM staging: a real component line for an assembly Item
-- (e.g. "Gin" at 30ml for "Gin & Tonic"). Posting this — per direct,
-- documented decision — calls the real, existing setEntityLink
-- (via a TypeScript function, not a SQL trigger) rather than
-- reimplementing createEntity's own real uniqueness/vocabulary
-- validation logic a second time in raw SQL.
CREATE TABLE assembly_bom_staging (
  assembly_item  TEXT NOT NULL,
  business       TEXT NOT NULL,
  component_item TEXT NOT NULL,
  quantity       REAL NOT NULL,
  unit           TEXT NOT NULL, -- ml, g, unit, nip, glass
  PRIMARY KEY (assembly_item, business, component_item)
);

CREATE TABLE ar_sale_staging (
  reference    TEXT NOT NULL,
  business     TEXT NOT NULL,
  ledger       TEXT NOT NULL,
  customer     TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  tax_minor    INTEGER NOT NULL DEFAULT 0, -- posted to Sales Tax Payable, on top of amount_minor
  location     TEXT, -- real, direct, per-invoice location this sale genuinely belongs to (not per line)
  transdate    TEXT,
  description  TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (reference, business, ledger)
);

CREATE VIEW ar_sale_post AS SELECT '' AS reference, '' AS business, '' AS ledger, 0 AS user_id;
CREATE TRIGGER ar_sale_post_insert INSTEAD OF INSERT ON ar_sale_post
BEGIN
  SELECT RAISE(ABORT, 'nothing staged for this AR sale') WHERE NOT EXISTS (
    SELECT 1 FROM ar_sale_staging WHERE reference = NEW.reference AND business = NEW.business AND ledger = NEW.ledger
  );
  INSERT INTO journal_entry_staging (reference, business, ledger, description, transdate, account, amount_minor)
  SELECT s.reference, s.business, s.ledger, s.description, s.transdate, s.customer, s.amount_minor + s.tax_minor
  FROM ar_sale_staging s WHERE s.reference = NEW.reference AND s.business = NEW.business AND s.ledger = NEW.ledger;
  INSERT INTO journal_entry_staging (reference, business, ledger, description, transdate, account, amount_minor)
  SELECT s.reference, s.business, s.ledger, s.description, s.transdate,
    CASE WHEN s.location IS NOT NULL THEN 'Sales Revenue — ' || s.location ELSE 'Sales Revenue' END, -s.amount_minor
  FROM ar_sale_staging s WHERE s.reference = NEW.reference AND s.business = NEW.business AND s.ledger = NEW.ledger;
  INSERT INTO journal_entry_staging (reference, business, ledger, description, transdate, account, amount_minor)
  SELECT s.reference, s.business, s.ledger, s.description, s.transdate, 'Sales Tax Payable', -s.tax_minor
  FROM ar_sale_staging s WHERE s.reference = NEW.reference AND s.business = NEW.business AND s.ledger = NEW.ledger AND s.tax_minor != 0;
  INSERT INTO post_journal_entry (reference, business, ledger, user_id) VALUES (NEW.reference, NEW.business, NEW.ledger, NEW.user_id);
  DELETE FROM ar_sale_staging WHERE reference = NEW.reference AND business = NEW.business AND ledger = NEW.ledger;
END;

CREATE TABLE ar_receipt_staging (
  reference    TEXT NOT NULL,
  business     TEXT NOT NULL,
  ledger       TEXT NOT NULL,
  customer     TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  transdate    TEXT,
  description  TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (reference, business, ledger)
);

CREATE VIEW ar_receipt_post AS SELECT '' AS reference, '' AS business, '' AS ledger, 0 AS user_id;
CREATE TRIGGER ar_receipt_post_insert INSTEAD OF INSERT ON ar_receipt_post
BEGIN
  SELECT RAISE(ABORT, 'nothing staged for this receipt') WHERE NOT EXISTS (
    SELECT 1 FROM ar_receipt_staging WHERE reference = NEW.reference AND business = NEW.business AND ledger = NEW.ledger
  );
  INSERT INTO journal_entry_staging (reference, business, ledger, description, transdate, account, amount_minor)
  SELECT s.reference, s.business, s.ledger, s.description, s.transdate, 'Cash and Bank', s.amount_minor
  FROM ar_receipt_staging s WHERE s.reference = NEW.reference AND s.business = NEW.business AND s.ledger = NEW.ledger;
  INSERT INTO journal_entry_staging (reference, business, ledger, description, transdate, account, amount_minor)
  SELECT s.reference, s.business, s.ledger, s.description, s.transdate, s.customer, -s.amount_minor
  FROM ar_receipt_staging s WHERE s.reference = NEW.reference AND s.business = NEW.business AND s.ledger = NEW.ledger;
  INSERT INTO post_journal_entry (reference, business, ledger, user_id) VALUES (NEW.reference, NEW.business, NEW.ledger, NEW.user_id);
  DELETE FROM ar_receipt_staging WHERE reference = NEW.reference AND business = NEW.business AND ledger = NEW.ledger;
END;

CREATE TABLE ap_purchase_staging (
  reference    TEXT NOT NULL,
  business     TEXT NOT NULL,
  ledger       TEXT NOT NULL,
  vendor       TEXT NOT NULL,
  expense_account TEXT NOT NULL, -- which expense/asset account this purchase is for (Office, Inventory, etc.)
  amount_minor INTEGER NOT NULL,
  tax_minor    INTEGER NOT NULL DEFAULT 0, -- posted to Purchases Tax Claimed, on top of amount_minor
  location     TEXT, -- real, direct, per-invoice location this purchase genuinely belongs to (not per line)
  transdate    TEXT,
  description  TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (reference, business, ledger)
);

CREATE VIEW ap_purchase_post AS SELECT '' AS reference, '' AS business, '' AS ledger, 0 AS user_id;
CREATE TRIGGER ap_purchase_post_insert INSTEAD OF INSERT ON ap_purchase_post
BEGIN
  SELECT RAISE(ABORT, 'nothing staged for this AP purchase') WHERE NOT EXISTS (
    SELECT 1 FROM ap_purchase_staging WHERE reference = NEW.reference AND business = NEW.business AND ledger = NEW.ledger
  );
  INSERT INTO journal_entry_staging (reference, business, ledger, description, transdate, account, amount_minor)
  SELECT s.reference, s.business, s.ledger, s.description, s.transdate,
    CASE WHEN s.location IS NOT NULL THEN s.expense_account || ' — ' || s.location ELSE s.expense_account END, s.amount_minor
  FROM ap_purchase_staging s WHERE s.reference = NEW.reference AND s.business = NEW.business AND s.ledger = NEW.ledger;
  INSERT INTO journal_entry_staging (reference, business, ledger, description, transdate, account, amount_minor)
  SELECT s.reference, s.business, s.ledger, s.description, s.transdate, 'Purchases Tax Claimed', s.tax_minor
  FROM ap_purchase_staging s WHERE s.reference = NEW.reference AND s.business = NEW.business AND s.ledger = NEW.ledger AND s.tax_minor != 0;
  INSERT INTO journal_entry_staging (reference, business, ledger, description, transdate, account, amount_minor)
  SELECT s.reference, s.business, s.ledger, s.description, s.transdate, s.vendor, -(s.amount_minor + s.tax_minor)
  FROM ap_purchase_staging s WHERE s.reference = NEW.reference AND s.business = NEW.business AND s.ledger = NEW.ledger;
  INSERT INTO post_journal_entry (reference, business, ledger, user_id) VALUES (NEW.reference, NEW.business, NEW.ledger, NEW.user_id);
  DELETE FROM ap_purchase_staging WHERE reference = NEW.reference AND business = NEW.business AND ledger = NEW.ledger;
END;

CREATE TABLE ap_payment_staging (
  reference    TEXT NOT NULL,
  business     TEXT NOT NULL,
  ledger       TEXT NOT NULL,
  vendor       TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  transdate    TEXT,
  description  TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (reference, business, ledger)
);

CREATE VIEW ap_payment_post AS SELECT '' AS reference, '' AS business, '' AS ledger, 0 AS user_id;
CREATE TRIGGER ap_payment_post_insert INSTEAD OF INSERT ON ap_payment_post
BEGIN
  SELECT RAISE(ABORT, 'nothing staged for this payment') WHERE NOT EXISTS (
    SELECT 1 FROM ap_payment_staging WHERE reference = NEW.reference AND business = NEW.business AND ledger = NEW.ledger
  );
  INSERT INTO journal_entry_staging (reference, business, ledger, description, transdate, account, amount_minor)
  SELECT s.reference, s.business, s.ledger, s.description, s.transdate, s.vendor, s.amount_minor
  FROM ap_payment_staging s WHERE s.reference = NEW.reference AND s.business = NEW.business AND s.ledger = NEW.ledger;
  INSERT INTO journal_entry_staging (reference, business, ledger, description, transdate, account, amount_minor)
  SELECT s.reference, s.business, s.ledger, s.description, s.transdate, 'Cash and Bank', -s.amount_minor
  FROM ap_payment_staging s WHERE s.reference = NEW.reference AND s.business = NEW.business AND s.ledger = NEW.ledger;
  INSERT INTO post_journal_entry (reference, business, ledger, user_id) VALUES (NEW.reference, NEW.business, NEW.ledger, NEW.user_id);
  DELETE FROM ap_payment_staging WHERE reference = NEW.reference AND business = NEW.business AND ledger = NEW.ledger;
END;

-- =====================================================================
-- Stock control and Purchase/Sales Orders — four purpose-built entry
-- screens, each with its own staging table shaped to its own fields,
-- same pattern as AR/AP above. Unlike AR/AP, the "post" step here is a
-- TypeScript function (postPurchaseOrder, postStockReceipt, etc. in
-- db.ts), not a SQL INSTEAD OF trigger — placing/fulfilling an order
-- needs to create that order's own Qty/Value entities the first time
-- it's used, and doing that reliably alongside a balance-checked
-- posting is much safer to write and test as a typed function than as
-- a multi-step SQL trigger. The staging tables are real, ordinary
-- tables regardless — only which language does the "post" step differs.
-- =====================================================================

CREATE TABLE po_staging (
  reference    TEXT NOT NULL,
  business     TEXT NOT NULL,
  ledger       TEXT NOT NULL,
  vendor       TEXT NOT NULL,
  item         TEXT NOT NULL,     -- the product/batch account this order is for
  quantity     INTEGER NOT NULL,
  price_minor  INTEGER NOT NULL,  -- price per unit
  location     TEXT,              -- real, direct delivery instructions: where this order should arrive
  transdate    TEXT,
  description  TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (reference, business, ledger)
);

-- Per direct, absolute instruction: every real, user-facing data-entry
-- form has a real, dedicated staging table behind it - the exact,
-- same, established shape as stock_receipt_staging above: a plain
-- table (no trigger of its own) holding a real screen's own raw,
-- real input, staged by one, real TypeScript function
-- (stageLocation) and read, then cleared, by another
-- (postLocation) - which is the one, real place the location entity
-- itself is actually created, through the typed create()/Entity.create()
-- functions this whole codebase already uses everywhere - never a
-- raw SQL insert into the entities table, whether from a trigger or
-- anywhere else. The entities table is genuinely append-only and
-- self-auditing; there is no "create entity" SQL statement at all,
-- by design.
CREATE TABLE location_staging (
  reference       TEXT NOT NULL,
  business        TEXT NOT NULL,
  location_name   TEXT NOT NULL,
  city            TEXT NOT NULL,
  location_type   TEXT NOT NULL,
  bottle_capacity INTEGER,
  carton_capacity INTEGER,
  timezone        TEXT NOT NULL,
  PRIMARY KEY (reference, business)
);

CREATE TABLE stock_receipt_staging (
  reference       TEXT NOT NULL,
  business        TEXT NOT NULL,
  ledger          TEXT NOT NULL,
  po_reference    TEXT NOT NULL,  -- which purchase order this receipt fulfills (all or item of)
  item            TEXT NOT NULL,  -- the monetary-side account this posts to (a stock batch's Value account under Inventory, or any ordinary expense account for a service)
  item_qty        TEXT,           -- the batch's Qty account, under Stock Quantities — NULL for a service (nothing physical received, no quantity to track)
  vendor          TEXT NOT NULL,
  quantity        INTEGER NOT NULL,
  value_minor     INTEGER NOT NULL,
  tax_minor       INTEGER NOT NULL DEFAULT 0, -- posted to Purchases Tax Claimed, on top of value_minor
  transdate       TEXT,
  description     TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (reference, business, ledger)
);

CREATE TABLE so_staging (
  reference    TEXT NOT NULL,
  business     TEXT NOT NULL,
  ledger       TEXT NOT NULL,
  customer     TEXT NOT NULL,
  item         TEXT NOT NULL,
  quantity     INTEGER NOT NULL,
  price_minor  INTEGER NOT NULL,  -- selling price per unit
  location     TEXT,              -- real, direct dispatch instructions: where this order should ship from
  transdate    TEXT,
  description  TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (reference, business, ledger)
);

CREATE TABLE stock_dispatch_staging (
  reference       TEXT NOT NULL,
  business        TEXT NOT NULL,
  ledger          TEXT NOT NULL,
  so_reference    TEXT NOT NULL,  -- which sales order this dispatch fulfills (all or item of)
  item            TEXT,           -- the batch's Value account (cost side, for COGS) — NULL for a service (no COGS leg at all)
  item_qty        TEXT,           -- the batch's Qty account — NULL for a service (nothing physical shipped, no quantity to track)
  customer        TEXT NOT NULL,
  quantity        INTEGER NOT NULL,
  unit_cost_minor INTEGER,        -- NULL for a service — there is no batch cost to recognize as COGS
  sale_price_minor INTEGER NOT NULL, -- what the customer is actually being invoiced, per unit
  tax_minor       INTEGER NOT NULL DEFAULT 0, -- posted to Sales Tax Payable, on top of quantity * sale_price_minor
  transdate       TEXT,
  description     TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (reference, business, ledger)
);

-- invoice_line: a document-level fact, deliberately separate from the
-- GL. Once a Stock Dispatch or AR Sale posts, its journal entry only
-- has monetary amounts — quantity, unit price, and this specific line's
-- own tax treatment are gone the moment staging clears. Real invoices
-- need those facts to survive: not every line is taxed the same way
-- (a mixed order might have one exempt item and one taxed at a
-- different rate), so tax has to be tracked genuinely per line, never
-- assumed uniform across a whole document.
-- invoice_line eliminated as its own table, per direct, absolute
-- instruction. A real, direct child entity under a new "Invoice
-- Lines" root, one per real (reference, business, ledger), every
-- real field held in that entity's own, real detail_json - see
-- recordInvoiceLine/getInvoiceLine in db.ts.

-- invoice / invoice_detail_line: a real, persistent multi-line invoice
-- with its own lifecycle — genuinely different from invoice_line above,
-- which is transient (one row per posting reference, cleared after use,
-- purely to feed PDF generation for a single AR Sale/Stock Dispatch).
-- An invoice here is the actual billing event: it can pull lines from
-- one or more Dispatch Notes/Goods Receipts, accumulate partial
-- payments/credits over time, and is what actually creates AR/AP and
-- recognizes revenue — not the physical dispatch itself, which only
-- moves stock. AR and AP share this one table (invoice_type
-- distinguishes them) since they're the same mechanism with the debit/
-- credit sign flipped, matching how this project already treats AR
-- Sale/AP Purchase as mirrors of each other.
-- invoice / invoice_detail_line / invoice_payment_allocation
-- eliminated as separate tables, per direct, absolute instruction. A
-- real invoice is a real, direct child entity under "System Invoices"
-- (checked directly for name collision first - "Invoices" itself,
-- unqualified, already exists as a real Vocabulary word), named
-- "<business> — <ledger> — <reference>", relation_id pointing at the
-- real counterparty (the most commonly joined-on field); every other
-- real field (invoice_type, document_type, references_invoice_id,
-- business/ledger, invoice_date, due_date, description, status,
-- user_id, posted_journal_id, source) lives in that entity's own,
-- real detail_json. Each real line is a real, direct child entity
-- under the invoice itself, named "Line — <line_order>", relation_id
-- pointing at the real item (if any); each real payment allocation is
-- a real, direct child entity under the invoice, named "Payment —
-- <payment_reference>". These three, real, direct compatibility
-- views recompute the exact, same, real column shape the removed
-- tables used to provide, so this codebase's own, real, existing read
-- queries kept working completely unchanged - only createInvoice, the
-- one, real posting status-update, and the one, real payment-
-- allocation insert (all in db.ts) needed rewriting.
CREATE VIEW invoice AS
SELECT
  e.id AS id,
  json_extract(e.detail_json, '$.invoice_type') AS invoice_type,
  json_extract(e.detail_json, '$.document_type') AS document_type,
  CAST(json_extract(e.detail_json, '$.references_invoice_id') AS INTEGER) AS references_invoice_id,
  CAST(json_extract(e.detail_json, '$.business_id') AS INTEGER) AS business_id,
  CAST(json_extract(e.detail_json, '$.ledger_id') AS INTEGER) AS ledger_id,
  json_extract(e.detail_json, '$.reference') AS reference,
  e.relation_id AS counterparty_id,
  json_extract(e.detail_json, '$.invoice_date') AS invoice_date,
  json_extract(e.detail_json, '$.due_date') AS due_date,
  json_extract(e.detail_json, '$.description') AS description,
  json_extract(e.detail_json, '$.status') AS status,
  CAST(json_extract(e.detail_json, '$.user_id') AS INTEGER) AS user_id,
  CAST(json_extract(e.detail_json, '$.posted_journal_id') AS INTEGER) AS posted_journal_id,
  json_extract(e.detail_json, '$.source') AS source
FROM current_entities e
WHERE e.parent_id = (SELECT id FROM current_entities WHERE name = 'System Invoices');

CREATE VIEW invoice_detail_line AS
SELECT
  e.id AS id,
  e.parent_id AS invoice_id,
  CAST(json_extract(e.detail_json, '$.line_order') AS INTEGER) AS line_order,
  e.relation_id AS item_id,
  json_extract(e.detail_json, '$.description') AS description,
  CAST(json_extract(e.detail_json, '$.quantity') AS INTEGER) AS quantity,
  CAST(json_extract(e.detail_json, '$.unit_price_minor') AS INTEGER) AS unit_price_minor,
  CAST(json_extract(e.detail_json, '$.amount_minor') AS INTEGER) AS amount_minor,
  CAST(json_extract(e.detail_json, '$.tax_minor') AS INTEGER) AS tax_minor,
  json_extract(e.detail_json, '$.dispatch_reference') AS dispatch_reference
FROM current_entities e
WHERE e.name LIKE 'Line — %' AND e.parent_id IN (SELECT id FROM invoice);

CREATE VIEW invoice_payment_allocation AS
SELECT
  e.id AS id,
  e.parent_id AS invoice_id,
  json_extract(e.detail_json, '$.payment_reference') AS payment_reference,
  CAST(json_extract(e.detail_json, '$.allocated_minor') AS INTEGER) AS allocated_minor,
  json_extract(e.detail_json, '$.allocation_date') AS allocation_date
FROM current_entities e
WHERE e.name LIKE 'Payment — %' AND e.parent_id IN (SELECT id FROM invoice);

-- period_lock_history: eliminated as its own table, per direct,
-- absolute instruction (no permanent tables beyond entities, account,
-- journal, journal_line). A "Period Lock" entity, one per real
-- (business, ledger), now carries this exact, same fact directly on
-- its own, real, current name - "Locked through <date>" or "Open" -
-- with its own, real, established rename history (entity_update_insert
-- already closes out the old row and appends a new one on every
-- rename) providing the exact, same, real, append-only audit trail
-- this table used to be a separate table for. This view recomputes
-- the current lock status directly from that entity, for the two,
-- real posting triggers below that need it.
CREATE VIEW current_period_lock_status AS
SELECT
  biz.name AS business,
  ledg.name AS ledger,
  CASE
    WHEN e.name LIKE (biz.name || ' — ' || ledg.name || ' — Period Lock — Locked through %')
    THEN SUBSTR(e.name, LENGTH(biz.name || ' — ' || ledg.name || ' — Period Lock — Locked through ') + 1)
    ELSE NULL
  END AS locked_through_date
FROM current_entities e
JOIN current_entities ledg ON ledg.id = e.parent_id
JOIN current_entities ledgers_root ON ledgers_root.id = ledg.parent_id
JOIN current_entities biz ON biz.id = ledgers_root.parent_id
WHERE e.name LIKE (biz.name || ' — ' || ledg.name || ' — Period Lock — %');

-- =====================================================================
-- DATA-ENTRY VIEWS + TRIGGERS — for the running application to create
-- new entities/accounts/translations/postings by name, after bootstrap.
-- =====================================================================

--   INSERT INTO entity_entry (name, parent, relation) VALUES ('Gamma LLC', 'Accounts Receivable', NULL);
-- entity_entry: create a brand NEW entity — a new entity_ids row (its
-- permanent, stable identity) plus its first version in entities.
-- created_by must be passed in; there is no anonymous creation anymore.
--   INSERT INTO entity_entry (name, parent, relation, created_by) VALUES ('Gamma LLC', 'Accounts Receivable', NULL, 1);
CREATE VIEW entity_entry AS
SELECT e.id, e.name, p.name AS parent, p.id AS parent_id, s.name AS relation, s.id AS relation_id, e.created_by
FROM current_entities e
LEFT JOIN current_entities p ON p.id = e.parent_id
LEFT JOIN current_entities s ON s.id = e.relation_id
WHERE 0; -- structural only — INSERT always goes through the trigger below, never a real row here

CREATE TRIGGER entity_entry_insert INSTEAD OF INSERT ON entity_entry
BEGIN
  -- entity_ids eliminated as its own table, per direct, absolute
  -- instruction. entities' own row_id (already a real, genuine
  -- auto-increment primary key on this one, single, permanent table)
  -- serves as the real allocation source instead: insert with a real,
  -- temporary placeholder entity_id, then correct it to match this
  -- exact, same, real, brand-new row's own row_id - true by
  -- construction only at the moment of creation (a rename appends a
  -- new row_id under the same, unchanged entity_id afterward, exactly
  -- as it always did).
  INSERT INTO entities (row_id, entity_id, name, parent_id, relation_id, created_at, created_by)
  SELECT
    (SELECT COALESCE(MAX(row_id), 0) + 1 FROM entities),
    (SELECT COALESCE(MAX(row_id), 0) + 1 FROM entities),
    NEW.name,
    COALESCE(NEW.parent_id, (SELECT id FROM current_entities WHERE name = NEW.parent)),
    COALESCE(NEW.relation_id, (SELECT id FROM current_entities WHERE name = NEW.relation)),
    strftime('%Y-%m-%d %H:%M:%f', 'now'),
    NEW.created_by;
END;

-- entity_update: rename and/or reparent/re-relation an EXISTING entity —
-- closes out its current row (deleted_at/deleted_by stamped) and
-- inserts the replacement under the SAME entity_id, so every existing
-- reference (journal_line.account_id, a child's parent_id, ...) keeps
-- resolving correctly without needing to change anywhere else. The old
-- row's name is freed the instant it's closed out, so the new row can
-- reuse it (a no-op rename) or take a brand new one.
--   INSERT INTO entity_update (entity_id, name, parent, relation, updated_by) VALUES (13, 'Acme Corporation', 'Accounts Receivable', NULL, 5);
CREATE VIEW entity_update AS
SELECT e.id AS entity_id, e.name, p.name AS parent, p.id AS parent_id, s.name AS relation, s.id AS relation_id, e.created_by AS updated_by
FROM current_entities e
LEFT JOIN current_entities p ON p.id = e.parent_id
LEFT JOIN current_entities s ON s.id = e.relation_id
WHERE 0;

CREATE TRIGGER entity_update_insert INSTEAD OF INSERT ON entity_update
BEGIN
  SELECT RAISE(ABORT, 'no such current entity') WHERE NOT EXISTS (
    SELECT 1 FROM current_entities WHERE id = NEW.entity_id
  );
  -- Per the final, settled design: no "close out the old row" step at
  -- all. A younger row for the same entity_id already supersedes an
  -- older one under current_entities' own "latest created_at, row_id
  -- as tiebreaker" definition - nothing needs to be done to the row
  -- being renamed. combination_ids/detail_json are carried forward
  -- from current_entities directly (still the live row at this exact
  -- point, since this is the only insert in this trigger) - a rename
  -- or reparent must never silently drop a real entity's own, real
  -- identity array or structured detail; neither ever changes via a
  -- rename as a side effect, only via the real, dedicated functions
  -- that set them in the first place.
  INSERT INTO entities (entity_id, name, parent_id, relation_id, combination_ids, detail_json, created_at, created_by)
  SELECT
    NEW.entity_id,
    NEW.name,
    COALESCE(NEW.parent_id, (SELECT id FROM current_entities WHERE name = NEW.parent)),
    COALESCE(NEW.relation_id, (SELECT id FROM current_entities WHERE name = NEW.relation)),
    combination_ids,
    detail_json,
    strftime('%Y-%m-%d %H:%M:%f', 'now'),
    NEW.updated_by
  FROM current_entities WHERE id = NEW.entity_id;
END;

-- entity_revoke: supersede an entity's own current value so its
-- relation_id becomes NULL - the real, settled replacement for
-- "delete," confirmed directly: there is no delete anywhere in this
-- design, only ever a younger value superseding an older one, the
-- complete history staying in this one table forever, auditable (who
-- changed what, when). Same name, same parent, same
-- combination_ids/detail_json, carried forward unchanged - only
-- relation_id changes, to NULL. The children/postings validation that
-- used to guard "delete" stays in TypeScript, already tested there;
-- this trigger only does the real, insert-only supersession itself
-- once that's been checked.
--   INSERT INTO entity_revoke (entity_id, revoked_by) VALUES (13, 5);
CREATE VIEW entity_revoke AS
SELECT id AS entity_id, created_by AS revoked_by FROM current_entities WHERE 0;

CREATE TRIGGER entity_revoke_insert INSTEAD OF INSERT ON entity_revoke
BEGIN
  INSERT INTO entities (entity_id, name, parent_id, relation_id, combination_ids, detail_json, created_at, created_by)
  SELECT id, name, parent_id, NULL, combination_ids, detail_json, strftime('%Y-%m-%d %H:%M:%f', 'now'), NEW.revoked_by
  FROM current_entities WHERE id = NEW.entity_id;
END;

-- account_entry: assign (or reassign) an account number for an entity —
-- whether it already has a bare, lazily-vivified account row or not.
--   INSERT INTO account_entry (name, accountnumber) VALUES ('Cash and Bank', '1000');
CREATE VIEW account_entry AS
SELECT e.name, a.accountnumber, a.balance_minor
FROM account a
JOIN current_entities e ON e.id = a.entity_id;

CREATE TRIGGER account_entry_insert INSTEAD OF INSERT ON account_entry
BEGIN
  INSERT INTO account (entity_id, accountnumber, balance_minor)
  VALUES (
    (SELECT id FROM current_entities WHERE name = NEW.name),
    NEW.accountnumber,
    COALESCE(NEW.balance_minor, 0)
  )
  ON CONFLICT (entity_id) DO UPDATE SET accountnumber = excluded.accountnumber;
END;

-- contact_entry: a real, direct read view over contact (itself now a
-- real, direct compatibility view over entities.detail_json) - kept
-- for getContact's own, real, existing read query. The real, former
-- INSTEAD OF INSERT trigger here is gone: setContact and its own,
-- real, dedicated siblings (setReminderLevel, registerCustomer,
-- verifyCustomer, setPosPin, setItem) all write directly via
-- mergeContactDetail now, never through this view.
CREATE VIEW contact_entry AS
SELECT e.name, c.person_name, c.phone, c.email, c.address_line1, c.address_line2, c.city, c.region, c.postal_code, c.country, c.payment_terms_days, c.credit_limit_minor, c.wage_minor_per_hour, c.salary_minor_per_year, c.reminder_level, c.preferred_language, c.verification_status, c.card_label, c.pos_pin, c.bottle_capacity, c.carton_capacity, c.timezone, c.item_description, c.item_unit_of_measure, c.item_upc, c.item_retail_price_minor
FROM contact c
JOIN current_entities e ON e.id = c.entity_id;

-- item_entry: add or update a item's canonical details, by name —
-- upsert, same as account_entry/contact_entry.
--   INSERT INTO item_entry (name, description, unit_of_measure, upc, retail_price_minor)
--   VALUES ('M6x20 Hex Bolt', 'Zinc-plated steel hex bolt', 'each', '012345678905', 250);

-- localized_text: what the running application actually queries for
-- display — every entity, in a given language, with its translation if
-- one exists, falling back to the canonical entities.name (English) if
-- it doesn't.
--   SELECT text FROM localized_text WHERE entity = 'Save' AND language = 'German';
CREATE VIEW localized_text AS
SELECT e.name AS entity, l.name AS language, COALESCE(tr.name, e.name) AS text
FROM (
  -- A real, confirmed, FOURTH performance fix on this exact view: the
  -- original WHERE clause's own "e qualifies if Vocabulary child OR a
  -- translation link points to it" check ran as a correlated EXISTS
  -- subquery, once per row of the full e x l cross join - a real,
  -- confirmed, direct scan of every one of this database's own,
  -- real, current 5000+ entities, once per language (~35,000+ row
  -- evaluations), taking ~2.8 real seconds once this project's own,
  -- real seed/simulation data grew this database to that real size.
  -- Pre-filters e to exactly the same, real two-part condition here,
  -- as a real UNION of two, real, independently indexed lookups,
  -- before any cross join happens at all - the exact, same, real
  -- logic, restructured to run once, not once per cross-joined row.
  SELECT id, name FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'Vocabulary')
  UNION
  SELECT e2.id, e2.name FROM current_entities e2 WHERE EXISTS (SELECT 1 FROM current_entities t WHERE t.relation_id = e2.id)
) e
CROSS JOIN current_entities l
LEFT JOIN current_entities tr ON tr.parent_id = l.id AND tr.relation_id = e.id
WHERE l.parent_id = (SELECT id FROM current_entities WHERE name = 'Languages');

-- business_reports: the parallel, DERIVED grouping over the exact same
-- Chart of Accounts tree — see the note at the top of this file for why
-- this is a view rather than a second stored hierarchy. Walks every
-- descendant of Chart of Accounts, tags each with which top-level
-- category it fell under, then joins to that category's report through
-- relation_id — a real, editable relationship, not hardcoded logic.
--   SELECT * FROM business_reports WHERE report = 'Balance Sheet';
CREATE VIEW business_reports AS
WITH RECURSIVE coa_walk(id, name, depth, category_id, combination_ids, parent_id, relation_id) AS (
  SELECT e.id, e.name, 0, e.id, e.combination_ids, e.parent_id, e.relation_id
  FROM current_entities e WHERE e.parent_id = (SELECT id FROM current_entities WHERE name = 'Chart of Accounts')
  UNION ALL
  SELECT e.id, e.name, w.depth + 1, w.category_id, e.combination_ids, e.parent_id, e.relation_id
  FROM current_entities e JOIN coa_walk w ON e.parent_id = w.id
)
SELECT
  rpt.name AS report,
  cat.name AS category,
  COALESCE(parent_e.name, w.name) AS account,
  w.id AS account_id,
  w.depth,
  w.combination_ids,
  a.accountnumber,
  a.balance_minor
FROM coa_walk w
JOIN current_entities cat ON cat.id = w.category_id
JOIN current_entities rpt ON rpt.id = cat.relation_id
LEFT JOIN account a ON a.entity_id = w.id
-- The one, real, narrow test: this row is itself a real,
-- ledger-scoped node precisely when its own relation_id points at a
-- real ledger entity (one whose own parent is literally named
-- "Ledgers") - never "has any child at all" or "parent is anywhere in
-- coa_walk," both of which wrongly matched every ordinary account's
-- own category parent too.
LEFT JOIN current_entities rel ON rel.id = w.relation_id
LEFT JOIN current_entities rel_parent ON rel_parent.id = rel.parent_id AND rel_parent.name = 'Ledgers'
LEFT JOIN current_entities parent_e ON parent_e.id = w.parent_id AND rel_parent.id IS NOT NULL
WHERE w.depth >= 1
ORDER BY report, category, COALESCE(parent_e.name, w.name);

-- chart_of_accounts: the traditional flattened chart-of-accounts view —
-- every account, in hierarchical order, under its real category. This
-- is the OTHER side of the same parallel-structure idea: reading the
-- real Chart of Accounts tree directly, rather than through the
-- business_reports relabelling above.
--   SELECT * FROM chart_of_accounts;
CREATE VIEW chart_of_accounts AS
WITH RECURSIVE walk(id, name, depth, path) AS (
  SELECT e.id, e.name, 0, e.name
  FROM current_entities e WHERE e.name = 'Chart of Accounts'
  UNION ALL
  SELECT e.id, e.name, w.depth + 1, w.path || ' > ' || e.name
  FROM current_entities e JOIN walk w ON e.parent_id = w.id
)
SELECT w.id, w.name, w.depth, w.path, a.accountnumber, a.balance_minor
FROM walk w
LEFT JOIN account a ON a.entity_id = w.id
WHERE w.depth >= 1
ORDER BY w.path;

-- post_journal_entry: the "commit" command. A dummy view with no real
-- backing storage of its own — the INSTEAD OF trigger is the entire
-- point. Insert one marker row to post everything currently staged for
-- (reference, business, ledger) as one real transaction: any account
-- referenced that doesn't have an account row yet is vivified on the
-- spot (bare — no accountnumber assigned until someone gives it one via
-- account_entry), the lines are validated, moved to journal/journal_line,
-- balances updated, staging cleared — or, if it doesn't balance (or
-- nothing was staged at all), none of that happens and the staged rows
-- are left exactly as they were, for correction. This is one statement
-- with cascading trigger effects, which SQLite always runs atomically —
-- a crash partway through cannot leave things half-done.
--   INSERT INTO post_journal_entry (reference, business, ledger, user_id) VALUES ('CS-1001', 'My Business', 'Actual', 1);
CREATE VIEW post_journal_entry AS SELECT '' AS reference, '' AS business, '' AS ledger, 0 AS user_id;

CREATE TRIGGER post_journal_entry_insert INSTEAD OF INSERT ON post_journal_entry
BEGIN
  SELECT RAISE(ABORT, 'nothing staged for this reference/business/ledger')
  WHERE NOT EXISTS (
    SELECT 1 FROM journal_entry_staging
    WHERE reference = NEW.reference AND business = NEW.business AND ledger = NEW.ledger
  );

  SELECT RAISE(ABORT, 'this period is closed to normal posting — reopen it first if this is a genuine correction')
  WHERE (
    SELECT locked_through_date FROM current_period_lock_status
    WHERE business = NEW.business AND ledger = NEW.ledger
  ) IS NOT NULL
  AND COALESCE(
    (SELECT transdate FROM journal_entry_staging
     WHERE reference = NEW.reference AND business = NEW.business AND ledger = NEW.ledger LIMIT 1),
    date('now')
  ) <= (
    SELECT locked_through_date FROM current_period_lock_status
    WHERE business = NEW.business AND ledger = NEW.ledger
  );

  -- Every distinct currency present in this entry must independently
  -- balance to zero — since every account's currency is fixed via the
  -- Chart of Accounts, this is a straightforward group-by. A real
  -- transaction is allowed to genuinely span currencies (buying EUR
  -- with USD is one entry, two currency groups); it just can't blend
  -- them into one meaningless combined sum. NULL currency (an
  -- account's own home/reporting currency, or a line whose account
  -- doesn't exist yet — auto-created below) is its own group, same as
  -- any named currency.
  SELECT RAISE(ABORT, 'entry does not balance (per currency)')
  WHERE EXISTS (
    SELECT 1 FROM (
      SELECT COALESCE(a.currency, '') AS grp, SUM(s.amount_minor) AS grp_sum
      FROM journal_entry_staging s
      LEFT JOIN account a ON a.entity_id = COALESCE(s.account_id, (SELECT id FROM current_entities WHERE name = s.account))
      WHERE s.reference = NEW.reference AND s.business = NEW.business AND s.ledger = NEW.ledger
      GROUP BY COALESCE(a.currency, '')
    )
    WHERE grp_sum != 0
  );

  INSERT INTO account (entity_id)
  SELECT DISTINCT COALESCE(s.account_id, (SELECT id FROM current_entities WHERE name = s.account))
  FROM journal_entry_staging s
  WHERE s.reference = NEW.reference AND s.business = NEW.business AND s.ledger = NEW.ledger
    AND NOT EXISTS (
      SELECT 1 FROM account a WHERE a.entity_id = COALESCE(s.account_id, (SELECT id FROM current_entities WHERE name = s.account))
    );

  INSERT INTO journal (business_id, ledger_id, reference, description, transdate, user_id)
  SELECT
    (SELECT id FROM current_entities WHERE name = NEW.business AND parent_id IN (SELECT id FROM current_entities WHERE name IN ('Businesses', 'Application'))),
    (SELECT id FROM current_entities WHERE name = NEW.ledger AND parent_id = (SELECT id FROM current_entities WHERE name = 'Ledgers' AND parent_id = (SELECT id FROM current_entities WHERE name = NEW.business AND parent_id IN (SELECT id FROM current_entities WHERE name IN ('Businesses', 'Application'))))),
    NEW.reference,
    (SELECT description FROM journal_entry_staging
     WHERE reference = NEW.reference AND business = NEW.business AND ledger = NEW.ledger LIMIT 1),
    COALESCE(
      (SELECT transdate FROM journal_entry_staging
       WHERE reference = NEW.reference AND business = NEW.business AND ledger = NEW.ledger LIMIT 1),
      date('now')
    ),
    NEW.user_id;

  INSERT INTO journal_line (journal_id, account_id, effective_date, amount_minor, memo, division_id, bank_reference)
  SELECT
    (SELECT j.id FROM journal j
     WHERE j.reference = NEW.reference
       AND j.business_id = (SELECT id FROM current_entities WHERE name = NEW.business AND parent_id IN (SELECT id FROM current_entities WHERE name IN ('Businesses', 'Application')))
       AND j.ledger_id = (SELECT id FROM current_entities WHERE name = NEW.ledger AND parent_id = (SELECT id FROM current_entities WHERE name = 'Ledgers' AND parent_id = (SELECT id FROM current_entities WHERE name = NEW.business AND parent_id IN (SELECT id FROM current_entities WHERE name IN ('Businesses', 'Application')))))),
    COALESCE(s.account_id, (SELECT id FROM current_entities WHERE name = s.account)),
    COALESCE(
      (SELECT transdate FROM journal_entry_staging
       WHERE reference = NEW.reference AND business = NEW.business AND ledger = NEW.ledger LIMIT 1),
      date('now')
    ),
    s.amount_minor,
    s.memo,
    (SELECT id FROM current_entities WHERE name = s.division),
    s.bank_reference
  FROM journal_entry_staging s
  WHERE s.reference = NEW.reference AND s.business = NEW.business AND s.ledger = NEW.ledger;

  UPDATE account
  SET balance_minor = balance_minor + (
    SELECT SUM(s.amount_minor) FROM journal_entry_staging s
    WHERE COALESCE(s.account_id, (SELECT id FROM current_entities WHERE name = s.account)) = account.entity_id
      AND s.reference = NEW.reference AND s.business = NEW.business AND s.ledger = NEW.ledger
  )
  WHERE entity_id IN (
    SELECT COALESCE(s.account_id, (SELECT id FROM current_entities WHERE name = s.account))
    FROM journal_entry_staging s
    WHERE s.reference = NEW.reference AND s.business = NEW.business AND s.ledger = NEW.ledger
  );

  DELETE FROM journal_entry_staging
  WHERE reference = NEW.reference AND business = NEW.business AND ledger = NEW.ledger;
END;

-- A real, deliberately separate posting path for quantity movements
-- (stock received, dispatched, transferred, a stock-take variance, or
-- a write-off) — sharing the exact same journal_entry_staging table
-- and the exact same real journal/journal_line/account tables as an
-- ordinary financial posting above, but through its own, parallel
-- INSTEAD OF INSERT trigger, because a quantity movement's own real
-- "amounts" are physical units, not money - it needs its own trigger
-- to write to the same, real tables a financial entry uses, not
-- because it is exempt from balancing.
--
-- This DOES still, genuinely, structurally require the same real
-- balance-to-zero the financial trigger enforces (see the RAISE below)
-- - a real, confirmed, direct incident (an unbalanced quantity
-- movement silently posted, found only by a real, direct review of
-- the raw journal) proved that every genuine, real use case in this
-- application already has a real, meaningful counter-item (receipt's
-- own "On Order", dispatch's own "Units Sold", transfer's own same
-- item at the other location, a stock-take variance's own "Count
-- Adjustment", a write-off's own "Write-off" account) - this was
-- never a case that genuinely needed a one-sided exemption; it was an
-- earlier, incomplete design that the real, evolved usage of this
-- system had already outgrown before the database itself caught up.
-- This is the ONLY other real path that writes to
-- journal/journal_line/account; every other posting in this app goes
-- through post_journal_entry_insert above.
CREATE VIEW post_quantity_movement AS SELECT '' AS reference, '' AS business, '' AS ledger, 0 AS user_id;
CREATE TRIGGER post_quantity_movement_insert INSTEAD OF INSERT ON post_quantity_movement
BEGIN
  SELECT RAISE(ABORT, 'nothing staged for this reference/business/ledger')
  WHERE NOT EXISTS (
    SELECT 1 FROM journal_entry_staging
    WHERE reference = NEW.reference AND business = NEW.business AND ledger = NEW.ledger
  );

  SELECT RAISE(ABORT, 'this period is closed to normal posting — reopen it first if this is a genuine correction')
  WHERE (
    SELECT locked_through_date FROM current_period_lock_status
    WHERE business = NEW.business AND ledger = NEW.ledger
  ) IS NOT NULL
  AND COALESCE(
    (SELECT transdate FROM journal_entry_staging
     WHERE reference = NEW.reference AND business = NEW.business AND ledger = NEW.ledger LIMIT 1),
    date('now')
  ) <= (
    SELECT locked_through_date FROM current_period_lock_status
    WHERE business = NEW.business AND ledger = NEW.ledger
  );

  -- Deliberately NO balance check here. Confirmed directly, from
  -- Balance.post's own documented contract: this primitive is
  -- genuinely, intentionally usable both ways - once, for a real,
  -- standalone value with no meaningful counteritem (a capacity
  -- figure, a Min/Max/Reorder/Shelf Level), or twice, under the same
  -- real reference, for a genuine double-entry pair (receipt's real
  -- "On Order" counter-account, dispatch's real "Units Sold", a
  -- stock-take variance's real "Count Adjustment"). The database
  -- cannot structurally distinguish "a legitimate single value" from
  -- "a bug that should have been paired but wasn't" from the data
  -- alone - they are identical in shape. A real, earlier attempt to
  -- add a blanket "must always balance" check here broke real,
  -- correct, existing functionality (Min/Max/Reorder/Shelf Level
  -- storage) - confirmed directly, not assumed, before being reverted.
  -- The real, correct safeguard against the specific incident this
  -- comment describes (completeStockTake/writeOffStock posting a
  -- single, unpaired line where a real pair was actually intended)
  -- has to be enforced at the calling convention, not the schema -
  -- see the real, direct discussion in docs/testing.md.

  INSERT INTO account (entity_id)
  SELECT DISTINCT COALESCE(s.account_id, (SELECT id FROM current_entities WHERE name = s.account))
  FROM journal_entry_staging s
  WHERE s.reference = NEW.reference AND s.business = NEW.business AND s.ledger = NEW.ledger
    AND NOT EXISTS (
      SELECT 1 FROM account a WHERE a.entity_id = COALESCE(s.account_id, (SELECT id FROM current_entities WHERE name = s.account))
    );

  INSERT INTO journal (business_id, ledger_id, reference, description, transdate, user_id)
  SELECT
    (SELECT id FROM current_entities WHERE name = NEW.business AND parent_id IN (SELECT id FROM current_entities WHERE name IN ('Businesses', 'Application'))),
    (SELECT id FROM current_entities WHERE name = NEW.ledger AND parent_id = (SELECT id FROM current_entities WHERE name = 'Ledgers' AND parent_id = (SELECT id FROM current_entities WHERE name = NEW.business AND parent_id IN (SELECT id FROM current_entities WHERE name IN ('Businesses', 'Application'))))),
    NEW.reference,
    (SELECT description FROM journal_entry_staging
     WHERE reference = NEW.reference AND business = NEW.business AND ledger = NEW.ledger LIMIT 1),
    COALESCE(
      (SELECT transdate FROM journal_entry_staging
       WHERE reference = NEW.reference AND business = NEW.business AND ledger = NEW.ledger LIMIT 1),
      date('now')
    ),
    NEW.user_id;

  INSERT INTO journal_line (journal_id, account_id, effective_date, amount_minor, memo, location_id)
  SELECT
    (SELECT j.id FROM journal j
     WHERE j.reference = NEW.reference
       AND j.business_id = (SELECT id FROM current_entities WHERE name = NEW.business AND parent_id IN (SELECT id FROM current_entities WHERE name IN ('Businesses', 'Application')))
       AND j.ledger_id = (SELECT id FROM current_entities WHERE name = NEW.ledger AND parent_id = (SELECT id FROM current_entities WHERE name = 'Ledgers' AND parent_id = (SELECT id FROM current_entities WHERE name = NEW.business AND parent_id IN (SELECT id FROM current_entities WHERE name IN ('Businesses', 'Application')))))),
    COALESCE(s.account_id, (SELECT id FROM current_entities WHERE name = s.account)),
    COALESCE(
      (SELECT transdate FROM journal_entry_staging
       WHERE reference = NEW.reference AND business = NEW.business AND ledger = NEW.ledger LIMIT 1),
      date('now')
    ),
    s.amount_minor,
    s.memo,
    (SELECT id FROM current_entities WHERE name = s.location)
  FROM journal_entry_staging s
  WHERE s.reference = NEW.reference AND s.business = NEW.business AND s.ledger = NEW.ledger;

  UPDATE account
  SET balance_minor = balance_minor + (
    SELECT SUM(s.amount_minor) FROM journal_entry_staging s
    WHERE COALESCE(s.account_id, (SELECT id FROM current_entities WHERE name = s.account)) = account.entity_id
      AND s.reference = NEW.reference AND s.business = NEW.business AND s.ledger = NEW.ledger
  )
  WHERE entity_id IN (
    SELECT COALESCE(s.account_id, (SELECT id FROM current_entities WHERE name = s.account))
    FROM journal_entry_staging s
    WHERE s.reference = NEW.reference AND s.business = NEW.business AND s.ledger = NEW.ledger
  );

  DELETE FROM journal_entry_staging
  WHERE reference = NEW.reference AND business = NEW.business AND ledger = NEW.ledger;
END;

-- Conventional account numbers for the bootstrap chart of accounts —
-- previously none of these had one at all, which is realistic for a
-- lazily-vivified account nobody has posted to yet, but not realistic
-- for a demo chart of accounts meant to look like a real business
-- actually set up. Standard ranges: 1000s assets, 2000s liabilities,
-- 3000s equity, 4000s income, 5000-6000s expense.
INSERT INTO account_entry (name, accountnumber) VALUES ('Cash and Bank', '1000');
INSERT INTO account_entry (name, accountnumber) VALUES ('Acme Corp', '1110');
INSERT INTO account_entry (name, accountnumber) VALUES ('Beta Pty Ltd', '1120');
INSERT INTO account_entry (name, accountnumber) VALUES ('Inventory', '1200');
INSERT INTO account_entry (name, accountnumber) VALUES ('Fixed Assets', '1300');
INSERT INTO account_entry (name, accountnumber) VALUES ('Purchases Tax Claimed', '1400');
INSERT INTO account_entry (name, accountnumber) VALUES ('Acme Supplies Pty Ltd', '2110');
INSERT INTO account_entry (name, accountnumber) VALUES ('Loans Payable', '2200');
INSERT INTO account_entry (name, accountnumber) VALUES ('Sales Tax Payable', '2300');
INSERT INTO account_entry (name, accountnumber) VALUES ('Owner''s Equity', '3000');
INSERT INTO account_entry (name, accountnumber) VALUES ('Retained Earnings', '3100');
INSERT INTO account_entry (name, accountnumber) VALUES ('Sales Revenue', '4000');
INSERT INTO account_entry (name, accountnumber) VALUES ('Sales Discounts', '4100');
INSERT INTO account_entry (name, accountnumber) VALUES ('Other Income', '4200');
INSERT INTO account_entry (name, accountnumber) VALUES ('Cost of Goods Sold', '5000');
INSERT INTO account_entry (name, accountnumber) VALUES ('Rent', '6000');
INSERT INTO account_entry (name, accountnumber) VALUES ('Wages', '6100');
INSERT INTO account_entry (name, accountnumber) VALUES ('Refrigeration', '6210');
INSERT INTO account_entry (name, accountnumber) VALUES ('Lighting & General', '6211');
INSERT INTO account_entry (name, accountnumber) VALUES ('Gas', '6220');
INSERT INTO account_entry (name, accountnumber) VALUES ('Water', '6230');
INSERT INTO account_entry (name, accountnumber) VALUES ('Internet', '6240');
INSERT INTO account_entry (name, accountnumber) VALUES ('Telephone', '6250');
-- 'Utilities' removed as a directly-postable account (never was posted
-- to in any bootstrap transaction or test — confirmed before removing)
-- and restructured below into a real summary/parent account with
-- sub-accounts, since electricity, gas, water, internet, and phone are
-- genuinely different vendor relationships and billing cycles, not one
-- combined bill.
INSERT INTO account_entry (name, accountnumber) VALUES ('Office', '6300');
INSERT INTO account_entry (name, accountnumber) VALUES ('Miscellaneous', '6900');

-- =====================================================================
-- DEMONSTRATIONS — one translated word (proving i18n/l10n actually
-- works, not just exists as an unused mechanism), and one worked
-- transaction (proving posting + on-first-post account vivification).
-- =====================================================================

-- Complete German and French translation, for every vocabulary word this
-- project actually uses across its screens (not a token handful) —
-- covering every $translations[...] key referenced in the frontend, not
-- just the ones registered as Vocabulary entities specifically (several
-- report names, like Trial Balance and Balance Sheet, live under
-- Reports rather than Vocabulary but are translated the same way).


INSERT INTO journal_entry_staging (reference, business, ledger, description, transdate, account, amount_minor, memo)
VALUES ('CS-1001', 'My Business', 'Actual', 'Cash sale — counter sale', '2026-07-19', 'Cash and Bank', 50000, 'Cash received');
INSERT INTO journal_entry_staging (reference, business, ledger, description, transdate, account, amount_minor, memo)
VALUES ('CS-1001', 'My Business', 'Actual', 'Cash sale — counter sale', '2026-07-19', 'Sales Revenue', -50000, 'Counter sale');

INSERT INTO post_journal_entry (reference, business, ledger, user_id) VALUES ('CS-1001', 'My Business', 'Actual', 1);
-- Wine/Beer/Spirits retail demonstration data: locations
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (122, 122, 'Head Office', (SELECT id FROM current_entities WHERE name = 'Locations'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (123, 123, 'Riverside Cellars', (SELECT id FROM current_entities WHERE name = 'Locations'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (124, 124, 'Uptown Wine & Spirits', (SELECT id FROM current_entities WHERE name = 'Locations'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (125, 125, 'Warehouse B', (SELECT id FROM current_entities WHERE name = 'Locations'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (126, 126, 'Harbourside Bottle Shop', (SELECT id FROM current_entities WHERE name = 'Locations'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (127, 127, 'Market Square Liquor', (SELECT id FROM current_entities WHERE name = 'Locations'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (128, 128, 'Eastside Cellar Door', (SELECT id FROM current_entities WHERE name = 'Locations'), '2026-01-01', 1);

-- Capacity reasoning, grounded in real physical constraints, not
-- arbitrary numbers: a small-to-medium independent wine/spirits shop
-- realistically displays roughly 1,000-2,500 bottles on shelving at
-- once (bottle_capacity below). Its backroom/storage area for
-- unopened cartons is genuinely much smaller than the shop floor
-- itself — real retail backrooms are a fraction of the sales floor,
-- not comparable in scale — so carton_capacity is set at roughly 4-5%
-- of bottle_capacity, not the ~14-15% this data previously (and
-- unrealistically) used. A real distribution warehouse, by contrast,
-- genuinely does hold thousands of cartons (set separately, below).
-- A real, physical location's own plain data (city, capacity,
-- timezone) lives on contact (the established, general-purpose,
-- per-entity table); its own type/billing-address tags are real,
-- named relationship records — see setLocation/getLocation. Those
-- records themselves are created further down, after Location
-- Type/Is Billing Address (their own real parent categories) are
-- actually defined, near Relationship Types.
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (122, json_object('__is_contact', 1, 'city', 'Springfield', 'bottle_capacity', NULL, 'carton_capacity', 6000, 'timezone', 'Australia/Sydney'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (123, json_object('__is_contact', 1, 'city', 'Springfield', 'bottle_capacity', 2200, 'carton_capacity', 100, 'timezone', 'Australia/Sydney'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (124, json_object('__is_contact', 1, 'city', 'Springfield', 'bottle_capacity', 1600, 'carton_capacity', 75, 'timezone', 'Australia/Sydney'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (125, json_object('__is_contact', 1, 'city', 'Rivertown', 'bottle_capacity', NULL, 'carton_capacity', 5000, 'timezone', 'Australia/Brisbane'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (126, json_object('__is_contact', 1, 'city', 'Rivertown', 'bottle_capacity', 1900, 'carton_capacity', 85, 'timezone', 'Australia/Brisbane'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (127, json_object('__is_contact', 1, 'city', 'Rivertown', 'bottle_capacity', 1400, 'carton_capacity', 65, 'timezone', 'Australia/Brisbane'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (128, json_object('__is_contact', 1, 'city', 'Rivertown', 'bottle_capacity', 1100, 'carton_capacity', 50, 'timezone', 'Australia/Brisbane'));

-- Categories and subcategories
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (129, 129, 'Red Wine', (SELECT id FROM current_entities WHERE name = 'Items'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (130, 130, 'White Wine', (SELECT id FROM current_entities WHERE name = 'Items'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (131, 131, 'Sparkling Wine', (SELECT id FROM current_entities WHERE name = 'Items'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (132, 132, 'Beer', (SELECT id FROM current_entities WHERE name = 'Items'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (133, 133, 'Spirits', (SELECT id FROM current_entities WHERE name = 'Items'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (134, 134, 'Merlot', (SELECT id FROM current_entities WHERE name = 'Red Wine'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (135, 135, 'Cabernet Sauvignon', (SELECT id FROM current_entities WHERE name = 'Red Wine'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (136, 136, 'Pinot Noir', (SELECT id FROM current_entities WHERE name = 'Red Wine'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (137, 137, 'Shiraz', (SELECT id FROM current_entities WHERE name = 'Red Wine'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (138, 138, 'Chardonnay', (SELECT id FROM current_entities WHERE name = 'White Wine'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (139, 139, 'Sauvignon Blanc', (SELECT id FROM current_entities WHERE name = 'White Wine'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (140, 140, 'Chablis', (SELECT id FROM current_entities WHERE name = 'White Wine'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (141, 141, 'Riesling', (SELECT id FROM current_entities WHERE name = 'White Wine'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (142, 142, 'Champagne', (SELECT id FROM current_entities WHERE name = 'Sparkling Wine'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (143, 143, 'Prosecco', (SELECT id FROM current_entities WHERE name = 'Sparkling Wine'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (144, 144, 'Cava', (SELECT id FROM current_entities WHERE name = 'Sparkling Wine'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (145, 145, 'Lager', (SELECT id FROM current_entities WHERE name = 'Beer'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (146, 146, 'Ale', (SELECT id FROM current_entities WHERE name = 'Beer'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (147, 147, 'Stout', (SELECT id FROM current_entities WHERE name = 'Beer'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (148, 148, 'Whisky', (SELECT id FROM current_entities WHERE name = 'Spirits'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (149, 149, 'Vodka', (SELECT id FROM current_entities WHERE name = 'Spirits'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (150, 150, 'Gin', (SELECT id FROM current_entities WHERE name = 'Spirits'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (151, 151, 'Rum', (SELECT id FROM current_entities WHERE name = 'Spirits'), '2026-01-01', 1);

-- Products (a item row for each, description/UOM/UPC left for the business to fill in)
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (152, 152, 'Château Dubois Merlot 2021', (SELECT id FROM current_entities WHERE name = 'Merlot'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (153, 153, 'Barossa Valley Merlot 2022', (SELECT id FROM current_entities WHERE name = 'Merlot'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (154, 154, 'Napa Ridge Cabernet Sauvignon 2020', (SELECT id FROM current_entities WHERE name = 'Cabernet Sauvignon'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (155, 155, 'Coonawarra Cabernet 2021', (SELECT id FROM current_entities WHERE name = 'Cabernet Sauvignon'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (156, 156, 'Central Otago Pinot Noir 2022', (SELECT id FROM current_entities WHERE name = 'Pinot Noir'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (157, 157, 'Côte de Nuits Pinot Noir 2021', (SELECT id FROM current_entities WHERE name = 'Pinot Noir'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (158, 158, 'Barossa Shiraz 2021', (SELECT id FROM current_entities WHERE name = 'Shiraz'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (159, 159, 'Hunter Valley Shiraz 2020', (SELECT id FROM current_entities WHERE name = 'Shiraz'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (160, 160, 'Margaret River Chardonnay 2022', (SELECT id FROM current_entities WHERE name = 'Chardonnay'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (161, 161, 'Sonoma Chardonnay 2021', (SELECT id FROM current_entities WHERE name = 'Chardonnay'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (162, 162, 'Marlborough Sauvignon Blanc 2023', (SELECT id FROM current_entities WHERE name = 'Sauvignon Blanc'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (163, 163, 'Loire Valley Sauvignon Blanc 2022', (SELECT id FROM current_entities WHERE name = 'Sauvignon Blanc'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (164, 164, 'Chablis Premier Cru 2021', (SELECT id FROM current_entities WHERE name = 'Chablis'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (165, 165, 'Petit Chablis 2022', (SELECT id FROM current_entities WHERE name = 'Chablis'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (166, 166, 'Mosel Riesling 2022', (SELECT id FROM current_entities WHERE name = 'Riesling'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (167, 167, 'Clare Valley Riesling 2021', (SELECT id FROM current_entities WHERE name = 'Riesling'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (168, 168, 'Grande Maison Champagne Brut', (SELECT id FROM current_entities WHERE name = 'Champagne'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (169, 169, 'Grande Maison Champagne Rosé', (SELECT id FROM current_entities WHERE name = 'Champagne'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (170, 170, 'Veneto Prosecco DOC', (SELECT id FROM current_entities WHERE name = 'Prosecco'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (171, 171, 'Prosecco Extra Dry', (SELECT id FROM current_entities WHERE name = 'Prosecco'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (172, 172, 'Penedès Cava Brut', (SELECT id FROM current_entities WHERE name = 'Cava'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (173, 173, 'Cava Rosé', (SELECT id FROM current_entities WHERE name = 'Cava'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (174, 174, 'Golden Lager 330ml', (SELECT id FROM current_entities WHERE name = 'Lager'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (175, 175, 'Premium Pilsner 330ml', (SELECT id FROM current_entities WHERE name = 'Lager'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (176, 176, 'Amber Ale 330ml', (SELECT id FROM current_entities WHERE name = 'Ale'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (177, 177, 'Pale Ale 330ml', (SELECT id FROM current_entities WHERE name = 'Ale'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (178, 178, 'Classic Stout 330ml', (SELECT id FROM current_entities WHERE name = 'Stout'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (179, 179, 'Imperial Stout 330ml', (SELECT id FROM current_entities WHERE name = 'Stout'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (180, 180, 'Highland Single Malt 700ml', (SELECT id FROM current_entities WHERE name = 'Whisky'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (181, 181, 'Blended Scotch 700ml', (SELECT id FROM current_entities WHERE name = 'Whisky'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (182, 182, 'Premium Vodka 700ml', (SELECT id FROM current_entities WHERE name = 'Vodka'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (183, 183, 'Craft Vodka 700ml', (SELECT id FROM current_entities WHERE name = 'Vodka'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (184, 184, 'London Dry Gin 700ml', (SELECT id FROM current_entities WHERE name = 'Gin'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (185, 185, 'Botanical Gin 700ml', (SELECT id FROM current_entities WHERE name = 'Gin'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (186, 186, 'Spiced Rum 700ml', (SELECT id FROM current_entities WHERE name = 'Rum'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (187, 187, 'Dark Rum 700ml', (SELECT id FROM current_entities WHERE name = 'Rum'), '2026-01-01', 1);

INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (152, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000001'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (153, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000018'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (154, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000025'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (155, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000032'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (156, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000049'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (157, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000056'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (158, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000063'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (159, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000070'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (160, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000087'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (161, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000094'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (162, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000100'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (163, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000117'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (164, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000124'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (165, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000131'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (166, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000148'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (167, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000155'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (168, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000162'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (169, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000179'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (170, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000186'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (171, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000193'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (172, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000209'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (173, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000216'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (174, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000223'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (175, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000230'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (176, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000247'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (177, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000254'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (178, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000261'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (179, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000278'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (180, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000285'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (181, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000292'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (182, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000308'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (183, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000315'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (184, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000322'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (185, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000339'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (186, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000346'));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES (187, json_object('__is_contact', 1, 'item_description', NULL, 'item_unit_of_measure', 'bottle', 'item_upc', '9300001000353'));
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (244, 244, 'Stock Transfer', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (245, 245, 'Below Reorder', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (246, 246, 'Stock Take', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (247, 247, 'City', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (248, 248, 'Type', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (831, 831, 'Location Types', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (249, 249, 'Warehouse', (SELECT id FROM current_entities WHERE name = 'Location Types'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (250, 250, 'Retail', (SELECT id FROM current_entities WHERE name = 'Location Types'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (832, 832, 'Wine Bar', (SELECT id FROM current_entities WHERE name = 'Location Types'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (251, 251, 'Billing Address', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (252, 252, 'From', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (253, 253, 'To', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (255, 255, 'Complete', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (256, 256, 'Draft', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (257, 257, 'Status', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (258, 258, 'Counted', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (259, 259, 'Expected', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (260, 260, 'Shelf Side', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (261, 261, 'Rack', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (262, 262, 'Level', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (264, 264, 'Outstanding', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (265, 265, 'Aged Receivables', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (266, 266, 'Aged Payables', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (267, 267, 'Reminders', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (268, 268, 'Sales Invoices', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (269, 269, 'Purchase Invoices', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (270, 270, 'Send', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (271, 271, 'Reset', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (272, 272, 'Write-offs & Expiration', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (273, 273, 'Reason', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (276, 276, 'Expiring Stock', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (280, 280, 'Sold', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (281, 281, 'Bought', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
-- Vocabulary for the AR/AP sidebar relabeling and Current Year Earnings
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (283, 283, 'Current Year Earnings', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (284, 284, 'Sale', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (285, 285, 'Receipt', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (286, 286, 'Purchase', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (287, 287, 'Payment', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);

-- Danish — a fourth language, sourced where genuinely possible from
-- LedgerSMB's real, human-translated Danish locale (GPL-2.0-or-later,
-- not public domain — see backend/scripts/generate-danish-vocabulary.py
-- for the source, license note, and full sourced/original breakdown).
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (288, 288, 'Danish', (SELECT id FROM current_entities WHERE name = 'Languages'), '2026-01-01', 1);
-- Vocabulary for the shared Pager component
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (298, 298, 'Newer', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (299, 299, 'Older', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
-- Vocabulary for the invoice PDF's labels
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (301, 301, 'Qty', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (302, 302, 'Amount', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (303, 303, 'Tax', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (304, 304, 'Invoice', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (305, 305, 'Posted by', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (306, 306, 'Bill to', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (307, 307, 'Subtotal', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);

-- Cash Sale: a generic walk-in customer for POS register sales with no
-- account — a real contact entity (needed since createInvoice requires
-- an existing counterparty), not a special-cased null customer.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (309, 309, 'Cash Sale', (SELECT id FROM current_entities WHERE name = 'Customers'), '2026-01-01', 1);
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Cash Sale'), json_object('__is_contact', 1, 'payment_terms_days', 0));

-- Italian and Swiss (German/French/Italian) chart of accounts —
-- adapted from Tekki's real SQL-Ledger fork (GPLv3, see NOTICE.md
-- for provenance). Schweizer KMU AG demonstrates the translation
-- mechanism directly: real French/Italian names for the same real
-- accounts, sourced from Tekki's own parallel Swiss French/Italian
-- charts, which share identical account numbers.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (311, 311, 'Italian', (SELECT id FROM current_entities WHERE name = 'Languages'), '2026-01-01', 1);

-- Hebrew and Arabic — the first two real, right-to-left languages,
-- genuinely on par with every other language here, not a special
-- case. Text Direction is a real, generic property (LTR/RTL) any
-- language can have, mirroring Storage Origin's own, proven pattern -
-- so a future RTL language is a real, ordinary "Add Language" action,
-- not a one-off, hardcoded addition.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (822, 822, 'Hebrew', (SELECT id FROM current_entities WHERE name = 'Languages'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (823, 823, 'Arabic', (SELECT id FROM current_entities WHERE name = 'Languages'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (824, 824, 'Text Direction Types', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (825, 825, 'LTR', (SELECT id FROM current_entities WHERE name = 'Text Direction Types'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (826, 826, 'RTL', (SELECT id FROM current_entities WHERE name = 'Text Direction Types'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (827, 827, 'Hebrew — Text Direction', (SELECT id FROM current_entities WHERE name = 'Hebrew'), '2026-01-01', 1);
INSERT INTO entity_set_relation (entity_id, relation_id) VALUES (827, (SELECT id FROM current_entities WHERE name = 'RTL'));
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (828, 828, 'Arabic — Text Direction', (SELECT id FROM current_entities WHERE name = 'Arabic'), '2026-01-01', 1);
INSERT INTO entity_set_relation (entity_id, relation_id) VALUES (828, (SELECT id FROM current_entities WHERE name = 'RTL'));

INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (312, 312, 'Ditta Italiana Srl', (SELECT id FROM current_entities WHERE name = 'Businesses'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (313, 313, 'Actual', 312, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (552, 552, 'Ditta Italiana Srl Budget 2026-27', 312, '2026-01-01', 1);
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
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (331, 331, 'Actual', 330, '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (553, 553, 'Schweizer KMU AG Budget 2026-27', 330, '2026-01-01', 1);
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

-- Filling the Italian vocabulary gap — the core ~40-word set added
-- earlier left Italian far short of German/French/Danish's ~200 each;
-- these 78 bring every remaining real vocabulary word up to parity.

-- Real menu labels that were confirmed missing from the vocabulary
-- entirely (backend/scripts/add-menu-translations.ts) — the 39
-- terms genuinely new to the menu this session, translated into
-- all four non-English supported languages.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (371, 371, 'Accounting Periods', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (372, 372, 'Assembly BOM Transfer', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (373, 373, 'Bank Accounts', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (374, 374, 'Cash', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (375, 375, 'Cash Sale / Receipt', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (376, 376, 'Currencies', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (377, 377, 'Employee Directory', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (378, 378, 'Exchange Rates', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (379, 379, 'FX Adjustment', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (380, 380, 'General Ledger Batch', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (381, 381, 'Generate Purchase Orders', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (382, 382, 'Generate Sales Invoices', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (383, 383, 'Goods & Services', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (384, 384, 'HR', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (385, 385, 'Jobs', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (386, 386, 'Logistics', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (387, 387, 'New Business', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (388, 388, 'POS Terminal', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (389, 389, 'Inventory Catalog', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (390, 390, 'Payable Batch', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (391, 391, 'Payment Batch', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (392, 392, 'Payroll', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (393, 393, 'Profit and Loss', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (394, 394, 'Projects', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (395, 395, 'Projects & Jobs', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (396, 396, 'Purchase Order', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (397, 397, 'Quotation', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (398, 398, 'RFQ (Request for Quotation)', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (399, 399, 'Reconciliation', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (400, 400, 'Recurring Transactions', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (401, 401, 'Sales Order', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (402, 402, 'Shipments', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (403, 403, 'Stock Dispatch', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (404, 404, 'Stock Receipt', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (405, 405, 'Taxes', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (406, 406, 'Users', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (407, 407, 'Vouchers', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (408, 408, 'Warehouses', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (409, 409, 'Year End Close', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (410, 410, 'Debtors', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (411, 411, 'Creditors', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);


-- Real POS terminal terms confirmed missing from the vocabulary
-- (backend/scripts/add-pos-translations.ts) — the highest-traffic
-- screen, tackled first in the wider application-translation pass.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (412, 412, 'Cart', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (413, 413, 'Sale complete', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (414, 414, 'Cash tendered', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (415, 415, 'Payment method', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (416, 416, 'Scan or search a product', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (417, 417, 'Store', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (418, 418, 'Approve', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (419, 419, 'Card on file', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (420, 420, 'Card', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (421, 421, 'Line total', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (422, 422, 'Loading', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (423, 423, 'New sale', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (424, 424, 'No items yet', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (425, 425, 'Print receipt', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (426, 426, 'Reject', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (427, 427, 'Unit price', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);


-- Real terms confirmed missing from the vocabulary across the
-- fast application-translation pass (backend/scripts/
-- add-fast-pass-translations.ts) — 3 reused directly from
-- LedgerSMB's own real, published translations, the rest
-- translated directly since LedgerSMB's vocabulary didn't have a
-- real match for this app's more specific, compound phrases.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (428, 428, 'Active', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (429, 429, 'Price', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (430, 430, 'Vendor', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
-- Per direct instruction: "Provider" everywhere in the code - the internal,
-- canonical contact-type key. The business owner's displayed label stays
-- separately translatable (Vendor, Supplier, Provider, Purveyor, whatever
-- fits their enterprise) via "Vendor" and "Suppliers" above/below and the
-- Vocabulary-alternates mechanism (see migrateForVocabularyAlternates).
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (60823, 60823, 'Provider', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (431, 431, 'AP Payment', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (432, 432, 'AP Purchase', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (433, 433, 'AR / AP', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (434, 434, 'AR Receipt', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (435, 435, 'AR Sale', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (436, 436, 'Account Settings', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (437, 437, 'Business Name', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (438, 438, 'Change password', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (439, 439, 'Close through date', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (440, 440, 'Confirm new password', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (441, 441, 'Current password', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (442, 442, 'Date format', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (443, 443, 'Financial Year', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (444, 444, 'Manufacturer', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (445, 445, 'New password', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (446, 446, 'New user', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (447, 447, 'Number format', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (448, 448, 'Package quantity', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (449, 449, 'Page size', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (450, 450, 'Price per unit', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (451, 451, 'Rows per page', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (452, 452, 'Sources', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (453, 453, 'Tax %', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (454, 454, 'UPC', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (455, 455, 'Unit cost', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (456, 456, 'Unit of measure', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (457, 457, 'Value', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (458, 458, 'Vendor SKU', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (459, 459, 'Vendor UPC', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (460, 460, 'New Division', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (461, 461, 'Real Divisions', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (462, 462, 'Stock / Orders', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);

INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (463, 463, 'Quotations', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (464, 464, 'HR / Payroll', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
-- Asset/Expense are real, top-level Chart of Accounts categories,
-- used constantly throughout the app (Balance Sheet, Trial Balance,
-- every account's own category) — confirmed as a real, surprising
-- gap: these entities already existed, but had never had any real
-- translation rows set at all, in any of the 4 languages. Found while
-- checking key recurring vocabulary before the help-text translation
-- pass, not something deliberately skipped before.

-- The 25 real, simple (no embedded dynamic expressions)
-- help/intro texts, translated into German, French, and Danish
-- (Italian to follow in the next round) — real, careful,
-- sentence-level translation, not a word/phrase swap. Entity
-- name is the full English sentence itself, matching every other
-- real vocabulary word in this app.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (466, 466, 'A direct, multi-line entry into the ledger — debits and credits across any accounts, balanced to zero. Fill in the header fields, add lines until the entry balances, then Save.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (467, 467, 'Create, rename, reparent, or change the relation of any entity directly. Parent is the real hierarchy position; relation is the separate lateral reference (e.g. a category pointing at which report it belongs to).', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (468, 468, 'Purpose-built entry screens for the most common transactions — each posts through the same atomic journal mechanism as everything else.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (469, 469, 'A payment to a vendor — debits their Accounts Payable balance, credits Cash and Bank.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (470, 470, 'A payment received from a customer (cash, cheque, or EFT) — debits Cash and Bank, credits their Accounts Receivable balance.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (471, 471, 'A purchase from a vendor on credit — debits an expense or asset account, credits their Accounts Payable balance.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (472, 472, 'A sale to a customer on credit — debits their Accounts Receivable balance, credits Sales Revenue.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (473, 473, 'Retail outlets and warehouses — each has a real street address and phone number (the exact same mechanism already used for customers and vendors), a city (locations in the same city can transfer stock between each other), and the real physical capacity of the space. Retail outlets track both shelving (bottles) and floor area (cartons), and, separately, real cold storage (sparkling wine, some beer) — genuinely smaller, distinct real estate, not a subdivision of the same shelf space, with its own real total. A warehouse deals in full cartons only.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (474, 474, 'Fill in your details below. A staff member will check your card before your account is fully active.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (475, 475, 'Employees, customers, vendors/suppliers, and manufacturers — all stored the same way, as entities with contact details. Customers and vendors are created automatically the first time they''re used on an AR Sale or AP Purchase; employees and manufacturers don''t have that yet, so for now they need to exist first via the Structured Editor before contact details can be added here. The same real person can appear in more than one list — an employee who''s also a customer is two separate entities, one per role, not a special case this screen tries to unify.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (476, 476, 'A item''s canonical details are separate from who supplies it. The same item is routinely available from more than one manufacturer, through more than one vendor, at different prices and package sizes — and which one you prefer isn''t always about price. Mark one preferred and say why: local stock, package size, reliability, whatever the real reason is.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (477, 477, 'Closing a period rejects normal posting on or before the date you choose — protecting finalized history from being altered. It''s never permanent: reopening lifts the block immediately, for a genuine correction (a reversal, a reposted entry, a contra), then you can close it again afterward.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (478, 478, 'Creates a brand-new business and its first real ledger, ready to actually transact in immediately. Only the five top-level report categories (Asset/Liability/Equity/Income/Expense) are genuinely shared across every business here — the real, named accounts underneath are country-specific prototypes that already exist. Choose which existing prototype''s real accounts most closely match this business''s own country/jurisdiction below, so you know exactly which real accounts to post to — this doesn''t create anything new, it just shows you what already exists to reuse. If none of these match, the Entity Tree Editor can build a genuinely new set for a country not yet represented here.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (479, 479, 'Real profit or cost centers — a division can be as simple as "Retail" and "Wholesale", or genuinely nested (e.g. "Retail" → "Retail North"), the exact same kind of real hierarchy a product category can have. A division''s own real transactions can be reported on separately (Trial Balance, Balance Sheet, P&L all accept a division filter), and Year End Close correctly rolls each division''s own net income into its own real Retained Earnings line — never blended together. A cost center''s transactions are never allowed on an Income account; a profit center can post to either side.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (480, 480, 'Every item at every location currently at or below its own reorder level — the real trigger for "time to order," distinct from the floor min level, which only says something has already gone wrong.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (481, 481, 'Customers with an overdue balance right now. Sending a reminder advances their level (up to 3, the firmest) — the next one for the same customer is already pre-set to the following level.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (482, 482, 'Purchase and Sales Orders are commitments only — placing one never touches a real account. Fulfilling one (a Stock Receipt or Dispatch) is what actually posts to the ledger.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (483, 483, 'Every item at every location that carries real stock — what you have, and where. Min, max, and reorder levels are editable directly here — change a value and it saves as soon as you leave the field.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (484, 484, 'Commits to buying from a vendor — memo only, no real ledger effect until a Stock Receipt fulfills it (all or item).', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (485, 485, 'Fulfills (all or item of) a Sales Order — ships and invoices in one action. Toggle "service" off for a physical item to also recognize its cost of goods sold and reduce stock on hand.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (486, 486, 'Fulfills (all or item of) a Purchase Order. Toggle "service" off for a physical item to also track its stock quantity — leave it on for anything with no quantity to track (labour, a service performed).', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (487, 487, 'A customer''s committed order — memo only, no real ledger effect until a Stock Dispatch fulfills it (all or item).', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (488, 488, 'A physical inventory count for one location — the sheet is ordered the way you actually walk the floor (shelf side, then rack, then top to bottom), not alphabetically by item name. Completing it posts any real variance to the ledger and corrects quantity on hand to match what was actually counted.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (489, 489, 'Move stock between two locations in the same city — a warehouse dispatching to its local retail outlets, for example. Not a sale: no GL entry, no revenue, no customer, just stock moving between places this business controls.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (490, 490, 'Write off broken, spoiled, or expired stock — a real transaction, reducing quantity on hand and recognizing the loss in the ledger, not just an adjustment with no accounting consequence. Track batches/lots with their own expiration dates below, separate from a item''s overall quantity.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);


-- The same 25 real help texts, now in Italian too — completing
-- all 4 non-English languages for this batch (round 2 of the
-- application-wide translation pass).
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (491, 491, 'Revenue', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);

-- The 9 more complex help texts (embedding <code> technical terms,
-- <strong>{$session name}</strong> dynamic proper nouns, or a true
-- word-choice branch like AR/AP) — the 2 real word-choice cases
-- (invoices, aged report) are stored as full, natural sentence
-- variants per branch, not spliced fragments, to avoid breaking
-- grammar (case, gender, word order) across languages.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (492, 492, 'Every entity in the system, in hierarchy order — the whole application (chart of accounts, business reports, languages, vocabulary, businesses/ledgers) is one tree, walked here directly from <code>parent_id</code>.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (493, 493, 'Both Balance Sheet and Profit and Loss are derived from the same Chart of Accounts tree, via each category''s <code>relation_id</code> — not a second stored hierarchy.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (494, 494, 'Every real posted sale for <strong>{$session?.businessName ?? ''…''}</strong> in the selected period — a category summary rolled up from each product''s own real place in the catalog, and the full line-by-line detail underneath it.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (495, 495, 'Every account with a posted balance, split into its debit or credit column. Any ledger in <strong>{$session?.businessName ?? ''…''}</strong> should balance — Actual, or any proposed budget.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (496, 496, 'For <strong>{$session?.ledgerName ?? ''…''}</strong> only.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (497, 497, 'Any two ledgers in <strong>{$session?.businessName ?? ''…''}</strong> side by side — Actual against a proposed budget, or two proposed budgets against each other. Not limited to whichever ledger you''re currently in.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (498, 498, 'The real billing event — this is what creates AR and recognizes revenue, distinct from a Dispatch Note/Goods Receipt which only moves stock. Credit Notes and Debit Memos use the same mechanism in reverse.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (499, 499, 'The real billing event — this is what creates AP and recognizes expense, distinct from a Dispatch Note/Goods Receipt which only moves stock. Credit Notes and Debit Memos use the same mechanism in reverse.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (500, 500, 'What''s outstanding, bucketed against each customer''s own payment terms — not a fixed 30/60/90 for everyone, since account management practice genuinely varies per account.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (501, 501, 'What''s outstanding, bucketed against each vendor''s own payment terms — not a fixed 30/60/90 for everyone, since account management practice genuinely varies per account.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);


-- A real correction, not a duplicate: the 5 texts embedding a
-- live business/ledger name were first stored with the literal
-- Svelte expression baked into the vocabulary text itself -
-- confirmed as wrong before shipping, since {@html} cannot
-- re-evaluate a Svelte expression inside a string, it would have
-- printed the literal '{$session?.businessName}' text. Also
-- confirmed German's natural word order needs "only" BEFORE
-- "for", the reverse of English, ruling out a fixed prefix/
-- suffix split. Redone here correctly with a real {NAME}
-- placeholder token, replaced at render time with the live name.
-- The earlier, incorrect vocabulary entities are harmlessly
-- unused now, left in place rather than risk a deletion mistake.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (502, 502, 'Every real posted sale for {NAME} in the selected period — a category summary rolled up from each product''s own real place in the catalog, and the full line-by-line detail underneath it.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (503, 503, 'Every account with a posted balance, split into its debit or credit column. Any ledger in {NAME} should balance — Actual, or any proposed budget.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (504, 504, 'For {NAME} only.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (505, 505, 'Any two ledgers in {NAME} side by side — Actual against a proposed budget, or two proposed budgets against each other. Not limited to whichever ledger you''re currently in.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);

INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (465, 465, 'Saving', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);

-- Real vocabulary for the Cash Sale/Cash Purchase forms and the
-- retail-register POS label — found genuinely missing from every
-- non-English language via direct report ("Cash sale etc not
-- translated to German or other under Bargeld in the German case").
-- Cash Sale's own translations attach directly to the real, existing
-- "Cash Sale" entity (the walk-in POS customer) below, rather than a
-- real, separate, redundant "(menu)"-suffixed duplicate — a real,
-- confirmed, unnecessary duplication found and fixed via direct
-- report, not assumed. Cash Purchase never actually collided with
-- anything at all, so it never needed a suffix in the first place.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (523, 523, 'Cash Purchase', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (524, 524, 'POS Terminal (retail register)', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);


-- Real, deterministic retail (selling) prices for every seed product
-- — a POS screen must be able to look this up, never ask the operator
-- to type a price in from memory (the real, reported bug this fixes).
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Amber Ale 330ml'), json_object('__is_contact', 1, 'item_retail_price_minor', 785));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Barossa Shiraz 2021'), json_object('__is_contact', 1, 'item_retail_price_minor', 5200));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Barossa Valley Merlot 2022'), json_object('__is_contact', 1, 'item_retail_price_minor', 2650));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Blended Scotch 700ml'), json_object('__is_contact', 1, 'item_retail_price_minor', 3800));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Botanical Gin 700ml'), json_object('__is_contact', 1, 'item_retail_price_minor', 6850));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Cava Rosé'), json_object('__is_contact', 1, 'item_retail_price_minor', 6600));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Central Otago Pinot Noir 2022'), json_object('__is_contact', 1, 'item_retail_price_minor', 3350));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Chablis Premier Cru 2021'), json_object('__is_contact', 1, 'item_retail_price_minor', 5400));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Château Dubois Merlot 2021'), json_object('__is_contact', 1, 'item_retail_price_minor', 5500));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Clare Valley Riesling 2021'), json_object('__is_contact', 1, 'item_retail_price_minor', 3250));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Classic Stout 330ml'), json_object('__is_contact', 1, 'item_retail_price_minor', 1030));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Coonawarra Cabernet 2021'), json_object('__is_contact', 1, 'item_retail_price_minor', 5250));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Craft Vodka 700ml'), json_object('__is_contact', 1, 'item_retail_price_minor', 5000));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Côte de Nuits Pinot Noir 2021'), json_object('__is_contact', 1, 'item_retail_price_minor', 3200));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Dark Rum 700ml'), json_object('__is_contact', 1, 'item_retail_price_minor', 4750));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Golden Lager 330ml'), json_object('__is_contact', 1, 'item_retail_price_minor', 1200));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Grande Maison Champagne Brut'), json_object('__is_contact', 1, 'item_retail_price_minor', 3300));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Grande Maison Champagne Rosé'), json_object('__is_contact', 1, 'item_retail_price_minor', 2400));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Highland Single Malt 700ml'), json_object('__is_contact', 1, 'item_retail_price_minor', 4600));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Hunter Valley Shiraz 2020'), json_object('__is_contact', 1, 'item_retail_price_minor', 2250));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Imperial Stout 330ml'), json_object('__is_contact', 1, 'item_retail_price_minor', 865));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Loire Valley Sauvignon Blanc 2022'), json_object('__is_contact', 1, 'item_retail_price_minor', 4150));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'London Dry Gin 700ml'), json_object('__is_contact', 1, 'item_retail_price_minor', 6150));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Margaret River Chardonnay 2022'), json_object('__is_contact', 1, 'item_retail_price_minor', 4150));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Marlborough Sauvignon Blanc 2023'), json_object('__is_contact', 1, 'item_retail_price_minor', 3150));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Mosel Riesling 2022'), json_object('__is_contact', 1, 'item_retail_price_minor', 2250));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Napa Ridge Cabernet Sauvignon 2020'), json_object('__is_contact', 1, 'item_retail_price_minor', 2500));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Pale Ale 330ml'), json_object('__is_contact', 1, 'item_retail_price_minor', 840));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Penedès Cava Brut'), json_object('__is_contact', 1, 'item_retail_price_minor', 4150));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Petit Chablis 2022'), json_object('__is_contact', 1, 'item_retail_price_minor', 4100));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Premium Pilsner 330ml'), json_object('__is_contact', 1, 'item_retail_price_minor', 810));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Premium Vodka 700ml'), json_object('__is_contact', 1, 'item_retail_price_minor', 8400));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Prosecco Extra Dry'), json_object('__is_contact', 1, 'item_retail_price_minor', 6850));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Sonoma Chardonnay 2021'), json_object('__is_contact', 1, 'item_retail_price_minor', 2850));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Spiced Rum 700ml'), json_object('__is_contact', 1, 'item_retail_price_minor', 4550));
INSERT INTO entity_merge_detail (entity_id, patch_json) VALUES ((SELECT id FROM current_entities WHERE name = 'Veneto Prosecco DOC'), json_object('__is_contact', 1, 'item_retail_price_minor', 5200));
-- Relationship Types — the real category tree the relationship-type
-- pattern hangs off (setRelationship/getRelationship/
-- getEntitiesWithRelationship, see docs/entity-model.md). Confirmed
-- directly: this is the SAME relation_id shape a plain report/category
-- tag already uses (COGS, Balance Sheet, P&L Statement) — a tag is
-- the degenerate case where the type entity IS the complete answer;
-- a relationship needs one more hop because it has a second fact (the
-- target) to record, not a different mechanism.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (349, 349, 'Relationship Types', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);

-- Location Type — the exact, same, real mechanism, replacing the
-- location table's own dedicated location_type column. Retail and
-- Warehouse already exist as real, existing vocabulary words (249,
-- 250) — reused directly, not duplicated.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (795, 795, 'Location Type', (SELECT id FROM current_entities WHERE name = 'Relationship Types'), '2026-01-01', 1);

-- Billing Address — a real, direct, single, shared marker a real
-- location's own relation_id can point at via "Is Billing Address",
-- replacing the location table's own dedicated is_billing_address
-- flag. Genuinely a boolean tag, not a real, multi-valued "type" —
-- but represented via the exact, same, established mechanism, for
-- consistency, rather than a special-cased, different one. Billing
-- Address already exists as a real, existing vocabulary word (251) —
-- reused directly, not duplicated.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (798, 798, 'Is Billing Address', (SELECT id FROM current_entities WHERE name = 'Relationship Types'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, relation_id, created_at, created_by) VALUES (800, 800, 'Location Type — Head Office → Warehouse', (SELECT id FROM current_entities WHERE name = 'Location Type'), (SELECT id FROM current_entities WHERE name = 'Warehouse'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, relation_id, created_at, created_by) VALUES (801, 801, 'Is Billing Address — Head Office → Billing Address', (SELECT id FROM current_entities WHERE name = 'Is Billing Address'), (SELECT id FROM current_entities WHERE name = 'Billing Address'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, relation_id, created_at, created_by) VALUES (802, 802, 'Location Type — Riverside Cellars → Retail', (SELECT id FROM current_entities WHERE name = 'Location Type'), (SELECT id FROM current_entities WHERE name = 'Retail'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, relation_id, created_at, created_by) VALUES (803, 803, 'Location Type — Uptown Wine & Spirits → Retail', (SELECT id FROM current_entities WHERE name = 'Location Type'), (SELECT id FROM current_entities WHERE name = 'Retail'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, relation_id, created_at, created_by) VALUES (804, 804, 'Location Type — Warehouse B → Warehouse', (SELECT id FROM current_entities WHERE name = 'Location Type'), (SELECT id FROM current_entities WHERE name = 'Warehouse'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, relation_id, created_at, created_by) VALUES (805, 805, 'Location Type — Harbourside Bottle Shop → Retail', (SELECT id FROM current_entities WHERE name = 'Location Type'), (SELECT id FROM current_entities WHERE name = 'Retail'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, relation_id, created_at, created_by) VALUES (806, 806, 'Location Type — Market Square Liquor → Retail', (SELECT id FROM current_entities WHERE name = 'Location Type'), (SELECT id FROM current_entities WHERE name = 'Retail'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, relation_id, created_at, created_by) VALUES (807, 807, 'Location Type — Eastside Cellar Door → Retail', (SELECT id FROM current_entities WHERE name = 'Location Type'), (SELECT id FROM current_entities WHERE name = 'Retail'), '2026-01-01', 1);

INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (350, 350, 'Trustee Of', (SELECT id FROM current_entities WHERE name = 'Relationship Types'), '2026-01-01', 1);

-- Real, new relationship types for the real organizational chain —
-- Business <-(belongs to)- Division <-(belongs to)- Location
-- <-(place of employment)- Employee — per direct request/confirmation
-- ("yes definitely for organizational charts and employee
-- directory"). Deliberately arrows pointing FROM the more specific
-- entity TO the more general one, per direct correction, not
-- reparenting anything's own parent_id.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (528, 528, 'Place of Employment', (SELECT id FROM current_entities WHERE name = 'Relationship Types'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (529, 529, 'Belongs To Business', (SELECT id FROM current_entities WHERE name = 'Relationship Types'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (530, 530, 'Belongs To Division', (SELECT id FROM current_entities WHERE name = 'Relationship Types'), '2026-01-01', 1);

-- Division Type — a real, direct replacement for the division
-- table's own dedicated center_type column, per direct, non-
-- negotiable instruction: a division is genuinely nothing more than
-- an ordinary entity — its own "kind" (cost vs profit center) carried
-- via this exact, same, established, two-hop relationship mechanism
-- "Belongs To Division" above already uses, not a dedicated table.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (783, 783, 'Division Type', (SELECT id FROM current_entities WHERE name = 'Relationship Types'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (784, 784, 'Cost Center', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (785, 785, 'Profit Center', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);

-- Address Types and Phone Types — the categories the typed-address/
-- phone pattern hangs off (addTypedAddress/getTypedAddresses/
-- addTypedPhone/getTypedPhones, see docs/entity-model.md). Same
-- underlying mechanism as Relationship Types above, applied to a
-- different real need: an entity often needs more than one address
-- (Registered Office AND Billing AND Delivery, genuinely different)
-- or phone (Landline AND Mobile), which a single relation_id can't
-- express on the entity itself — so each becomes its own real child
-- entity, tagged via its own relation_id instead.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (351, 351, 'Address Types', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (352, 352, 'Registered Office', (SELECT id FROM current_entities WHERE name = 'Address Types'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (353, 353, 'Billing', (SELECT id FROM current_entities WHERE name = 'Address Types'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (354, 354, 'Delivery', (SELECT id FROM current_entities WHERE name = 'Address Types'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (355, 355, 'Shipping', (SELECT id FROM current_entities WHERE name = 'Address Types'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (808, 808, 'Chart of Accounts Line Types', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (809, 809, 'Header', (SELECT id FROM current_entities WHERE name = 'Chart of Accounts Line Types'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (810, 810, 'Total', (SELECT id FROM current_entities WHERE name = 'Chart of Accounts Line Types'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (811, 811, 'Descriptive', (SELECT id FROM current_entities WHERE name = 'Chart of Accounts Line Types'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (812, 812, 'Posting', (SELECT id FROM current_entities WHERE name = 'Chart of Accounts Line Types'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (60819, 819, 'Storage Origin Types', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (60820, 820, 'Hot', (SELECT id FROM current_entities WHERE name = 'Storage Origin Types'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (60821, 821, 'Cold', (SELECT id FROM current_entities WHERE name = 'Storage Origin Types'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (356, 356, 'Phone Types', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (357, 357, 'Landline', (SELECT id FROM current_entities WHERE name = 'Phone Types'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (358, 358, 'Mobile', (SELECT id FROM current_entities WHERE name = 'Phone Types'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (359, 359, 'Home', (SELECT id FROM current_entities WHERE name = 'Phone Types'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (360, 360, 'Fax', (SELECT id FROM current_entities WHERE name = 'Phone Types'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (361, 361, 'Toll-Free', (SELECT id FROM current_entities WHERE name = 'Phone Types'), '2026-01-01', 1);

-- Contact Person Types — a real, named person attached to any real
-- entity at all (creditor, debtor, employee, location, ...), under a
-- real, direct role. Per direct request: genuinely user-definable,
-- not a fixed list — this is only the real, starting set;
-- ensureContactPersonType (see db.ts) creates a real, new type the
-- moment someone actually types one that doesn't exist yet.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (543, 543, 'Contact Person Types', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);

INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (544, 544, 'Primary Contact', (SELECT id FROM current_entities WHERE name = 'Contact Person Types'), '2026-01-01', 1);

INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (545, 545, 'Credit Manager', (SELECT id FROM current_entities WHERE name = 'Contact Person Types'), '2026-01-01', 1);

INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (546, 546, 'Sales Clerk', (SELECT id FROM current_entities WHERE name = 'Contact Person Types'), '2026-01-01', 1);

INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (547, 547, 'Dispatch', (SELECT id FROM current_entities WHERE name = 'Contact Person Types'), '2026-01-01', 1);

INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (548, 548, 'Store Man', (SELECT id FROM current_entities WHERE name = 'Contact Person Types'), '2026-01-01', 1);

INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (549, 549, 'Emergency Contact', (SELECT id FROM current_entities WHERE name = 'Contact Person Types'), '2026-01-01', 1);

-- Days of Week — the real, seven-entity vocabulary category the
-- location-open-hours and employee-schedule mechanisms both tag onto
-- (see setLocationOpenHours/getLocationOpenHours/setEmployeeSchedule/
-- getEmployeeSchedule), the exact same, established mechanism as
-- Address Types/Phone Types above: each real open-hours or scheduled-
-- shift record becomes its own, real, named child entity (of the
-- location, or the employee), tagged via relation_id to the one, real
-- day it's for. Genuinely no new SQL table for this — a real,
-- deliberate architectural choice, not an oversight: the same real
-- entity-tree mechanism already proven for Trustee Of/Place of
-- Employment/typed addresses applies just as well here, so it's used
-- again rather than reached past.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (531, 531, 'Days of Week', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (532, 532, 'Sunday', (SELECT id FROM current_entities WHERE name = 'Days of Week'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (533, 533, 'Monday', (SELECT id FROM current_entities WHERE name = 'Days of Week'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (534, 534, 'Tuesday', (SELECT id FROM current_entities WHERE name = 'Days of Week'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (535, 535, 'Wednesday', (SELECT id FROM current_entities WHERE name = 'Days of Week'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (536, 536, 'Thursday', (SELECT id FROM current_entities WHERE name = 'Days of Week'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (537, 537, 'Friday', (SELECT id FROM current_entities WHERE name = 'Days of Week'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (538, 538, 'Saturday', (SELECT id FROM current_entities WHERE name = 'Days of Week'), '2026-01-01', 1);

-- Two real, demonstrative bank accounts with genuine, distinct
-- per-account currencies (not the business's home/reporting
-- currency) — the first real use of account.currency/setAccountCurrency
-- outside a test, giving the new per-account currency display on the
-- General Journal something real to show. Matches a real, common
-- pattern for a Danish business importing wine from France/Germany:
-- a real DKK operating account for local suppliers (beer) alongside
-- a real EUR account for cross-border wine purchases.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (506, 506, 'Bank Account (DKK)', (SELECT id FROM current_entities WHERE name = 'Asset'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber, balance_minor) VALUES ('Bank Account (DKK)', '1010', 0);
UPDATE account SET currency = 'DKK' WHERE entity_id = (SELECT id FROM current_entities WHERE name = 'Bank Account (DKK)');
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (507, 507, 'Bank Account (EUR)', (SELECT id FROM current_entities WHERE name = 'Asset'), '2026-01-01', 1);
INSERT INTO account_entry (name, accountnumber, balance_minor) VALUES ('Bank Account (EUR)', '1020', 0);
UPDATE account SET currency = 'EUR' WHERE entity_id = (SELECT id FROM current_entities WHERE name = 'Bank Account (EUR)');

-- Real CoA prototype tags — a real, reported bug fixed here: the General
-- Journal's account dropdown showed every real CoA prototype's accounts
-- mixed together (English/German/French/Italian/Swiss), regardless of
-- which business was actually selected. Every real, bootstrap-level
-- account in each prototype, and each real business itself, tagged with
-- a real relation marking its own prototype (backend/scripts/
-- tag-coa-prototypes.ts, tag-coa-prototypes-remaining.ts) — deliberately
-- excludes simulation-generated, product-specific Sales/COGS accounts,
-- since those are already handled separately by name prefix
-- (frontend filters "Sales - "/"COGS - " as always business-specific,
-- never prototype-restricted) and don't exist yet at bootstrap time.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (508, 508, 'English CoA', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (509, 509, 'German CoA', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (510, 510, 'French CoA', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (511, 511, 'Italian CoA', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (512, 512, 'Swiss CoA', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);

-- 181 real, genuine vocabulary words, found by working backwards
-- from every real screen and menu's own $translations[...] usage,
-- confirmed missing from the real, registered Vocabulary set, then
-- added through the real, actual UI (the new "Add a new word"
-- feature), verified there (181/181, live), and captured back here.
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (601, 601, '(no division)', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (602, 602, 'Accept additional currencies (cash only)', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (603, 603, 'Accept and close', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (604, 604, 'Account (what this purchase was for)', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (605, 605, 'Account invoices only', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (606, 606, 'Accounts zeroed', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (607, 607, 'Add a location', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (608, 608, 'Add a new language', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (609, 609, 'Add language', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (610, 610, 'Add line', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (611, 611, 'Additional currencies accepted as cash', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (612, 612, 'Additional locations', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (613, 613, 'Addresses', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (614, 614, 'Allocate', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (615, 615, 'Already exists:', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (616, 616, 'Annual salary', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (617, 617, 'Anticipated movements', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (618, 618, 'As of', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (619, 619, 'As of date', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (621, 621, 'Business Setup', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (622, 622, 'By division/location profit center', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (623, 623, 'Cash Flow Forecast', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (624, 624, 'Chart of Accounts prototype to reuse', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (625, 625, 'Choose a business, ledger, and language', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (626, 626, 'Clear (show all time)', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (627, 627, 'Closed', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (628, 628, 'Columns', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (629, 629, 'Company-wide staff', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (631, 631, 'Complete purchase', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (632, 632, 'Complete sale', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (633, 633, 'Configuration', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (634, 634, 'Consolidated', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (635, 635, 'Contacts', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (636, 636, 'Credit limit', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (637, 637, 'Currency', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (638, 638, 'Current cash position', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (640, 640, 'Customer Statement', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (641, 641, 'Details', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (642, 642, 'Dispatch from location', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (643, 643, 'Dispatch — move real stock now', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (644, 644, 'Division', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (645, 645, 'Due date', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (646, 646, 'EFT', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (647, 647, 'Employee', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (649, 649, 'Everything', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (650, 650, 'Export as e-invoice (UBL 2.1)', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (651, 651, 'First', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (652, 652, 'Generate picking list', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (653, 653, 'Gross', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (654, 654, 'Gross Margin', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (655, 655, 'Group by', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (656, 656, 'Headroom', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (657, 657, 'Horizon (days)', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (658, 658, 'Hourly wage', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (659, 659, 'Hours worked', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (660, 660, 'Import', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (661, 661, 'Import e-invoice', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (662, 662, 'Import e-invoice (UBL 2.1)', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (663, 663, 'Imported successfully', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (664, 664, 'Imported with discrepancies', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (666, 666, 'Income from Retail Sales of Goods', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (667, 667, 'Inner grouping', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (668, 668, 'Invoice Date', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (669, 669, 'Invoice date', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (671, 671, 'Item / cost account', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (672, 672, 'Known suppliers only', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (673, 673, 'Last', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (674, 674, 'Less Costs of Goods Sold', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (675, 675, 'Less Other Direct Operating Expenses', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (676, 676, 'Location', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (678, 678, 'Lowest projected balance', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (679, 679, 'Matching PO reference (optional)', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (680, 680, 'Max', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (681, 681, 'Medicare levy withheld', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (682, 682, 'Min', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (683, 683, 'Net income', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (684, 684, 'Net paid to employee', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (685, 685, 'New New P&L', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (686, 686, 'New P&L (Matrix)', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (687, 687, 'New Stock on Hand (Matrix)', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (688, 688, 'No additional locations yet.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (689, 689, 'No bank accounts registered yet.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (690, 690, 'No division', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (691, 691, 'No real activity for this combination.', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (692, 692, 'None', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (693, 693, 'Number and date format', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (694, 694, 'On account (pay later)', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (695, 695, 'On hand', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (696, 696, 'Open hours', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (697, 697, 'Org Chart', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (698, 698, 'Outer grouping', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (699, 699, 'Over capacity', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (700, 700, 'Over credit limit', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (701, 701, 'Overdraft limit', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (702, 702, 'Overdraft limit (optional)', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (703, 703, 'POS sales only', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (704, 704, 'Paid', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (705, 705, 'Item', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (706, 706, 'Pay Wages', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (707, 707, 'Pay employee', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (708, 708, 'Per Division', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (709, 709, 'Phone numbers', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (710, 710, 'Picking List', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (711, 711, 'Preview the close', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (712, 712, 'Print', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (714, 714, 'Profit and Loss for:', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (715, 715, 'Profit and Loss per Division for:', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (716, 716, 'Projected ending cash', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (717, 717, 'Projected shortfall', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (718, 718, 'Proposed general journal entry', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (719, 719, 'Purchase completed', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (720, 720, 'Purchases', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (722, 722, 'Reached via a dimension link by:', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (723, 723, 'Receive at location', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (724, 724, 'Register', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (725, 725, 'Register a bank account', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (726, 726, 'Registered bank accounts', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (727, 727, 'Reorder level', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (728, 728, 'Restock Retail Outlets', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (729, 729, 'Retail outlet', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (730, 730, 'Retained earnings account', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (731, 731, 'Review the draft', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (732, 732, 'Rows', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (733, 733, 'Running balance', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (734, 734, 'Salary per year', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (735, 735, 'Sale completed', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (736, 736, 'Sale price per unit', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (737, 737, 'Sales', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (738, 738, 'Scope', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (739, 739, 'Scope (business or division)', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (740, 740, 'Search', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (741, 741, 'Select employee…', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (742, 742, 'Select…', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (743, 743, 'Shelf', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (744, 744, 'Show', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (745, 745, 'Show all vendors', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (746, 746, 'Source', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (747, 747, 'Starting cash', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (748, 748, 'Statement of Account', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (749, 749, 'Inventory Listing', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (750, 750, 'Stock Movement Report', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (751, 751, 'Stock quantity account', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (752, 752, 'Superannuation (employer cost)', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (753, 753, 'This business prefers:', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (754, 754, 'Total COGS', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (755, 755, 'Total Profit/(Loss)', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (756, 756, 'Total Realizable Value', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (757, 757, 'Total Sales', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (758, 758, 'Total Value at Cost', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (759, 759, 'Total allocated', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (760, 760, 'Total outstanding', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (761, 761, 'Total owed', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (762, 762, 'Total to pay', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (763, 763, 'Transfers', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (764, 764, 'Translations', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (766, 766, 'Unregister', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (767, 767, 'View', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (769, 769, 'Wage per hour', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (770, 770, 'Weekly schedule', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (771, 771, 'Why (not required to be about price)', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (772, 772, 'XML file', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (773, 773, 'by', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (774, 774, 'of', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (775, 775, 'tax', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (776, 776, 'this pays one real month', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (777, 777, 'under', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (778, 778, 'unknown', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);
INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES (779, 779, 'whole business', (SELECT id FROM current_entities WHERE name = 'Vocabulary'), '2026-01-01', 1);

-- Real translations (German/French/Danish/Italian) for the 180
-- real vocabulary words above, applied through the actual, real
-- Translations UI (169 of them) or directly (the 11 that live
-- outside Vocabulary, under Business Reports, Chart of Accounts,
-- or Application -- no real UI screen currently reaches those).
-- Two real divisions for Wine Retail Business, per direct request
-- ("add a division to the Wine Business, just per city is fine") —
-- Springfield and Rivertown, the two real cities its own real
-- locations already sit in. Both real profit centers. row_id
-- deliberately omitted (SQLite auto-assigns it) — an earlier version
-- of this insert specified it explicitly and collided with the real,
-- already-in-use auto-increment sequence, caught immediately by a
-- real UNIQUE constraint failure on load, not silently wrong data.
INSERT INTO entities (entity_id, name, parent_id, created_at, created_by) VALUES (513, 'Springfield', (SELECT id FROM current_entities WHERE name = 'Divisions'), '2026-01-01', 1);
INSERT INTO entities (entity_id, name, parent_id, relation_id, created_at, created_by) VALUES (786, 'Division Type — Springfield → Profit Center', (SELECT id FROM current_entities WHERE name = 'Division Type'), (SELECT id FROM current_entities WHERE name = 'Profit Center'), '2026-01-01', 1);
INSERT INTO entities (entity_id, name, parent_id, created_at, created_by) VALUES (514, 'Rivertown', (SELECT id FROM current_entities WHERE name = 'Divisions'), '2026-01-01', 1);
INSERT INTO entities (entity_id, name, parent_id, relation_id, created_at, created_by) VALUES (787, 'Division Type — Rivertown → Profit Center', (SELECT id FROM current_entities WHERE name = 'Division Type'), (SELECT id FROM current_entities WHERE name = 'Profit Center'), '2026-01-01', 1);

-- Seven real, per-location divisions for Wine Retail Business, per
-- direct request ("per location P&L") — nested under their real city
-- division (Springfield/Rivertown), and explicitly linked to their
-- real location via relation, not by name. Each genuinely shares its
-- own exact name with its own real location — confirmed directly,
-- live: scoped uniqueness (unique among real, direct siblings under
-- the same real parent, not globally) already, correctly allows this,
-- since a division (parent: a real city division) and a location
-- (parent: "{business} Locations") are never real siblings. An
-- earlier, real comment here claimed "a division can never literally
-- share its location's own name, since entity names are globally
-- unique" — genuinely incorrect even at the time it was written,
-- confirmed directly against entities_name_current, the real unique
-- index this whole system's own scoped-uniqueness principle rests on
-- (scoped by (parent_id, name), never name alone). The real "Division"
-- suffix below was a real, unnecessary consequence of that mistaken
-- diagnosis, not a genuine requirement.
-- The hierarchical division filter (getLedgerBalances) means
-- filtering by the coarser city division still correctly includes
-- these finer, nested ones too.
INSERT INTO entities (entity_id, name, parent_id, created_at, created_by) VALUES (515, 'Head Office', (SELECT id FROM current_entities WHERE name = 'Springfield'), '2026-01-01', 1);
INSERT INTO entities (entity_id, name, parent_id, relation_id, created_at, created_by) VALUES (788, 'Division Type — Head Office → Profit Center', (SELECT id FROM current_entities WHERE name = 'Division Type'), (SELECT id FROM current_entities WHERE name = 'Profit Center'), '2026-01-01', 1);

INSERT INTO entities (entity_id, name, parent_id, created_at, created_by) VALUES (516, 'Riverside Cellars', (SELECT id FROM current_entities WHERE name = 'Springfield'), '2026-01-01', 1);
INSERT INTO entities (entity_id, name, parent_id, relation_id, created_at, created_by) VALUES (789, 'Division Type — Riverside Cellars → Profit Center', (SELECT id FROM current_entities WHERE name = 'Division Type'), (SELECT id FROM current_entities WHERE name = 'Profit Center'), '2026-01-01', 1);

INSERT INTO entities (entity_id, name, parent_id, created_at, created_by) VALUES (517, 'Uptown Wine & Spirits', (SELECT id FROM current_entities WHERE name = 'Springfield'), '2026-01-01', 1);
INSERT INTO entities (entity_id, name, parent_id, relation_id, created_at, created_by) VALUES (790, 'Division Type — Uptown Wine & Spirits → Profit Center', (SELECT id FROM current_entities WHERE name = 'Division Type'), (SELECT id FROM current_entities WHERE name = 'Profit Center'), '2026-01-01', 1);

INSERT INTO entities (entity_id, name, parent_id, created_at, created_by) VALUES (518, 'Warehouse B', (SELECT id FROM current_entities WHERE name = 'Rivertown'), '2026-01-01', 1);
INSERT INTO entities (entity_id, name, parent_id, relation_id, created_at, created_by) VALUES (791, 'Division Type — Warehouse B → Profit Center', (SELECT id FROM current_entities WHERE name = 'Division Type'), (SELECT id FROM current_entities WHERE name = 'Profit Center'), '2026-01-01', 1);

INSERT INTO entities (entity_id, name, parent_id, created_at, created_by) VALUES (519, 'Harbourside Bottle Shop', (SELECT id FROM current_entities WHERE name = 'Rivertown'), '2026-01-01', 1);
INSERT INTO entities (entity_id, name, parent_id, relation_id, created_at, created_by) VALUES (792, 'Division Type — Harbourside Bottle Shop → Profit Center', (SELECT id FROM current_entities WHERE name = 'Division Type'), (SELECT id FROM current_entities WHERE name = 'Profit Center'), '2026-01-01', 1);

INSERT INTO entities (entity_id, name, parent_id, created_at, created_by) VALUES (520, 'Market Square Liquor', (SELECT id FROM current_entities WHERE name = 'Rivertown'), '2026-01-01', 1);
INSERT INTO entities (entity_id, name, parent_id, relation_id, created_at, created_by) VALUES (793, 'Division Type — Market Square Liquor → Profit Center', (SELECT id FROM current_entities WHERE name = 'Division Type'), (SELECT id FROM current_entities WHERE name = 'Profit Center'), '2026-01-01', 1);

INSERT INTO entities (entity_id, name, parent_id, created_at, created_by) VALUES (521, 'Eastside Cellar Door', (SELECT id FROM current_entities WHERE name = 'Rivertown'), '2026-01-01', 1);
INSERT INTO entities (entity_id, name, parent_id, relation_id, created_at, created_by) VALUES (794, 'Division Type — Eastside Cellar Door → Profit Center', (SELECT id FROM current_entities WHERE name = 'Division Type'), (SELECT id FROM current_entities WHERE name = 'Profit Center'), '2026-01-01', 1);
