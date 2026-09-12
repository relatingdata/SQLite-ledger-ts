# Seed data generation scripts

These generated the bootstrap SQL that now lives in `schema.sql` — kept
here for provenance and auditability rather than thrown away once their
output was copied in. They are not run as part of `make install`/`make
dev`; the SQL they produced is already committed directly in
`schema.sql`. Re-running one will regenerate equivalent SQL to stdout
(or a file, per script) that would need the same manual review and
`entity_id` collision-checking described below before merging into
`schema.sql` again — they were not written to be idempotent against an
already-seeded database.

## generate-wine-retail-seed.py

Generates the wine/beer/spirits retail demonstration data: 7 locations
(Head Office + 2 more Springfield retail outlets, Warehouse B + 3
Rivertown retail outlets), 5 categories with 15 subcategories, 36
fictional products (deliberately not real commercial brand names), and
per-location `part_location` rows (quantity, min/max/reorder,
shelf_side/rack/level) — a randomized but seeded (`random.seed(42)`)
split of bulk warehouse stock and smaller retail selling quantities.

Entity IDs start at 122 (the highest `entity_id` in `schema.sql` at the
time this was written was 121) and run through 187.

## generate-bmw-pcs-entities.py

Generates the Chart of Accounts entities for BMW M GmbH (HGB structure)
and Peugeot Citroën Sochaux SNC (Plan Comptable Général structure) — the
same businesses proven correct in the German/French financial-statement
comparison work (see the backend test suite). Entity IDs continue from
188 through 243.

## generate-bmw-pcs-postings.py

Generates the `journal_entry_staging`/`post_journal_entry` SQL that
posts both companies' real, published/filed 2020 figures — the exact
same cent-for-cent values already verified against BMW's actual Annual
Financial Statements and Peugeot Citroën Sochaux SNC's actual filed
comptes annuels. BMW's balance sheet and P&L post as two independent
transactions (only correct because BMW's net income happens to be
exactly zero); PCS's post as one combined transaction (required,
because a non-zero net income means the balance sheet alone will not
balance as a standalone posting — see the French comparison work for
why).

## generate-new-screen-vocabulary.py

Generates German/French translation entries for the vocabulary
introduced by the Locations, Stock Transfer, Stock Take, Below Reorder,
Reminders, and Aged Report screens. Entity IDs continue from 244.

Two words in the original word list (`Reference`, `Unit Cost`) turned
out to already exist as vocabulary from earlier work — this script's
raw output would create duplicate entities for those two; the version
actually merged into `schema.sql` had those two entity-creation lines
manually removed before committing (their translation-insert lines were
kept, since `translation_entry`'s `ON CONFLICT` upsert makes those safe
to re-run against an existing translation).

## generate-wine-retail-migration.py

Generates the safe, name-based migration version of the wine retail
seed data (`migrateForWineRetailDemoData` in `db.ts`) — the same 7
locations/36 products/72 stock rows as `generate-wine-retail-seed.py`,
but using `createEntity`/`setLocation`/`createPart`/
`receiveStockAtLocation` (which auto-allocate entity_ids) instead of
hardcoded IDs, so it's safe to add to an *existing* database without a
reset. Written after a real user question ("can I load the wine
business data without another release?") made clear that demo/
bootstrap data living only in `schema.sql` — applied only via `make
reset-db` — genuinely wasn't good enough for data someone might want on
a database they're already using. Tested against a database that
genuinely predates this data (Head Office and everything else absent),
confirmed two consecutive startups both correctly add all of it without
duplicating.

## generate-danish-vocabulary.py

Generates Danish translations for this project's vocabulary — see the
script's own docstring for the full sourcing breakdown (which words
come from LedgerSMB's real Danish locale versus this project's own
translations) and the license note (LedgerSMB is GPL-2.0-or-later, not
public domain).
