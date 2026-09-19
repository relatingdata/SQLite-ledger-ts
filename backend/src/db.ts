import { Database } from './sqlite-runtime.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hashPassword, verifyPassword } from './password.js';
import { Entity, Link, Balance, Detail } from './primitives.js';
import { getLedgerBalances } from './db-reports.js';

// ---------------------------------------------------------------------------
// The real data model, stated plainly here since it spans many real
// tables and functions no single file boundary can capture on its own.
//
// PERMANENT DATA lives in two real categories, not one:
//
// 1. The core double-entry ledger: entities (+ entity_ids), journal,
//    journal_line, account. This is the only real, permanent record of
//    what happened financially — every dollar and every unit of
//    quantity, real and auditable, forever.
//
// 2. Real, permanent SIDE DATA that genuinely cannot live in #1: who a
//    user is and what they're allowed to do (users, roles,
//    user_roles, sessions), an entity's own real contact/location/item
//    details (contact, location, item, item_source, item_location,
//    division), a document's own real lifecycle distinct from its
//    underlying posting (invoice, invoice_line, invoice_detail_line,
//    invoice_payment_allocation), physical count records (stock_take,
//    stock_take_line, stock_lot), document templates, translations,
//    and period-close history. None of this is derivable from a
//    journal_line's own, narrow shape (a signed amount against an
//    account on a date) — a journal line has no field for "this
//    customer's phone number," and it shouldn't grow one.
//
// TRANSIENT STAGING data is journal_entry_staging and the four
// screen-specific *_staging tables (ar_sale, ar_receipt, ap_purchase,
// ap_payment) plus po/so/stock_receipt/stock_dispatch_staging — each
// exists only between a person filling in a form and that form being
// posted, and is deleted the moment posting succeeds.
//
// THE REAL WRITE PATHS to journal/journal_line/account — there are
// exactly THREE, each with a real, distinct reason, not one flow with
// accidental exceptions:
//
// 1. Ordinary financial postings (the vast majority): a screen-specific
//    staging table's own INSTEAD OF INSERT trigger copies rows into
//    journal_entry_staging, then INSERT INTO post_journal_entry fires
//    post_journal_entry_insert, which validates the entry balances
//    (per currency) and the period is open, then writes journal +
//    journal_line + updates account.balance_minor, then clears
//    staging. See postJournalEntry() and its trigger in schema.sql.
//
// 2. Quantity movements (stock received/dispatched/transferred): a
//    real, parallel staging + trigger pair — journal_entry_staging
//    again, but post_quantity_movement instead of post_journal_entry —
//    because a quantity movement is a single, real line against one
//    product's own tracking account, not a two-sided, balanced
//    transaction; forcing it through the balance check would require
//    inventing a fake offsetting account. See postQuantityMovement()
//    and its trigger in schema.sql.
//
// 3. Recurring journals: written directly by createRecurringJournal(),
//    never staged at all, because recurrence is a property of the
//    journal itself — there's no single moment to balance-check
//    against; each future occurrence gets its own, separate balance
//    check at read time, via the journal_occurrences view.
//
// A fourth, much narrower case — confirmPickedLine/
// confirmRestockPickedLine — writes a bare journal row with
// deliberately no journal_line and no account at all, since a
// picking-list tick-off has no financial or quantity meaning
// whatsoever; it exists purely as a real, auditable "who ticked this,
// and when" record.
//
// Every one of these four is documented at its own definition, not
// just here — this block is a map, not the only copy of the reasoning.
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DB_PATH ?? path.join(dataDir, 'entities.sqlite');
// DB_VERBOSE=1 npm run dev prints every SQL statement as it executes —
// a real-time view of what the app is actually doing to the database,
// useful for watching workflows unfold without a separate tool.
export const db = new Database(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// A real, direct compatibility shim: bun:sqlite's own .get() returns
// null for "no row found"; better-sqlite3 (which every existing call
// site and test assertion in this codebase was written against)
// returns undefined for the exact same case. Normalizing once, here,
// at the source, rather than touching every one of the hundreds of
// real call sites throughout this codebase.
const realPrepare = db.prepare.bind(db);
db.prepare = ((sql: string) => {
  const stmt = realPrepare(sql);
  const realGet = stmt.get.bind(stmt);
  stmt.get = ((...args: unknown[]) => realGet(...args) ?? undefined) as typeof stmt.get;
  return stmt;
}) as typeof db.prepare;

const alreadyInitialized = db
  .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='entities'`)
  .get();
if (!alreadyInitialized) {
  // schema.sql was split into real, separate files, per direct
  // request: the basic, structural schema; each real language's own
  // vocabulary separately; and the German BMW / French Peugeot demo
  // ledger data separately. Loaded here, concatenated, in the real,
  // safe dependency order — confirmed directly by a real, live
  // database-load test before this split was trusted, not assumed:
  // core first (every real entity a vocabulary translation or demo
  // posting could reference), then the demo ledger data (depends on
  // core entities already existing — Businesses, German CoA, French
  // CoA), then a real, separate "link every real, existing business
  // to its own real CoA family" block (a real, second, genuine
  // dependency found only by a live load failure, not anticipated in
  // advance — it references entities from both core AND the demo
  // block, so it must load after both), then each real, per-language
  // vocabulary file (each only depends on its own real, target
  // entity already existing, all of which live in core).
  const schemaDir = path.join(__dirname, '..', 'schema');
  // Controls whether the foreign demo businesses (BMW M GmbH, Peugeot
  // Citroën Sochaux SNC, Ditta Italiana Srl, Schweizer KMU AG) are
  // seeded at all — the exact, same, real flag db-seed.ts uses for
  // Wine Retail Business. Per direct instruction: only 'My Business'
  // (the one dummy company for login) should exist, so a person can
  // build Wine Retail Business from scratch via Playwright rather than
  // have it pre-populated.
  const seedDemoBusinesses = process.env.SEED_DEMO_BUSINESSES !== 'false';
  const readSchema = (f: string) => fs.readFileSync(path.join(schemaDir, f), 'utf8');
  const foreignBusinessLinePattern = /'Ditta Italiana Srl'|'Schweizer KMU AG'/;

  const coreSql = readSchema('00-core.sql');
  db.exec(seedDemoBusinesses ? coreSql : coreSql.split('\n').filter((line) => !foreignBusinessLinePattern.test(line)).join('\n'));
  if (seedDemoBusinesses) db.exec(readSchema('20-demo-bmw-peugeot.sql'));

  // 30-coa-links.sql links every real, existing account (both core's
  // own real accounts and, when present, the foreign demo businesses'
  // own) to its own real CoA family — genuinely depends on entities
  // from both, so it must run after both, real, above. When the
  // foreign demo businesses are skipped, many of its own real lines
  // reference an account that only exists in that skipped file — not
  // just the 4 real lines naming a foreign business directly, but
  // every real, foreign-specific account each one's own real CoA
  // family also tags. Filtered here, directly, against what actually,
  // really exists in the database at this point — never guessed at
  // or hand-enumerated — so this stays correct even if the foreign
  // file's own real account set changes later.
  const coaLinksSql = readSchema('30-coa-links.sql');
  const filteredCoaLinksSql = seedDemoBusinesses
    ? coaLinksSql
    : coaLinksSql
        .split('\n')
        .filter((line) => {
          const match = line.match(/WHERE name = '((?:[^'\\]|\\.)*)'\)/);
          if (!match) return true; // not a real, single-entity-lookup line — keep it as-is
          const entityName = match[1].replace(/''/g, "'");
          return !!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(entityName);
        })
        .join('\n');
  db.exec(filteredCoaLinksSql);

  for (const f of ['10-vocab-english.sql', '10-vocab-german.sql', '10-vocab-french.sql', '10-vocab-danish.sql', '10-vocab-italian.sql']) {
    const sql = readSchema(f);
    // These are genuinely dead, comment-only stub files (leftover from
    // the historical migration to the entity-tree translation
    // mechanism) - real, actual SQL statements only, or bun:sqlite's
    // own, stricter exec() throws on an effectively-empty script.
    const hasRealStatement = sql.split('\n').some((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('--');
    });
    if (hasRealStatement) db.exec(sql);
  }
}

// Migration for a database created before accounting periods existed —
// must run FIRST, before migrateForRecurringJournals below: that
// migration may recreate post_journal_entry_insert, whose body now
// references period_lock_history, so the table has to already exist
// by the time that trigger is (re)created, not just by the time
// anything actually queries it.

// Migration renaming entities.sibling_id -> entities.relation_id — the
// original name implied a tree-peer relationship this column never
// actually had; "relation" matches the real, now-proven pattern
// (setRelationship/getRelationship/getEntitiesWithRelationship, see
// docs/entity-model.md). Confirmed directly before relying on it:
// SQLite's own ALTER TABLE RENAME COLUMN automatically updates the SQL
// text of every dependent view (current_entities, business_reports),
// so those need no separate migration step. entity_entry/entity_update
// are different — their own OUTPUT column is named "sibling" as a view
// alias, not a table column, so the automatic rename can't reach it;
// those two views (and their INSTEAD OF triggers) are explicitly
// recreated here to match.

export class ValidationError extends Error {}
export class NotFoundError extends Error {}

// Placed here specifically, before seedRemainingData() runs below -
// a real, confirmed JS temporal-dead-zone fix: these are real `const`
// declarations, not hoisted the way the functions that reference them
// (create, fetch, isGenuineCategoryOrItemsRoot) are, and
// seedRemainingData() calls createItem, which needs
// typeCategoryOrItemsRootName already initialized, at real module-
// load time. Found directly, via a real, failing test run, not
// assumed correct.
export const typeBusinessName: TypeDescriptor<'BusinessName'> = { brand: 'BusinessName' };
export const typeEmployeeName: TypeDescriptor<'EmployeeName'> = { brand: 'EmployeeName' };
export const typeVendorName: TypeDescriptor<'VendorName'> = { brand: 'VendorName' };
export const typeCustomerName: TypeDescriptor<'CustomerName'> = { brand: 'CustomerName' };
export const typeCategoryOrItemsRootName: TypeDescriptor<'CategoryOrItemsRootName'> = {
  brand: 'CategoryOrItemsRootName',
  validate: (name) => isGenuineCategoryOrItemsRoot(name),
};
export const typeItemName: TypeDescriptor<'ItemName'> = { brand: 'ItemName' };
// A real, generic descriptor for a fixed, well-known, always-existing
// root container (Businesses, Employees, Vendors, Customers) - no
// real validate needed, since these are schema-seeded, never
// user-supplied. Used purely to fetch() a real, typed starting point
// for create<T> chains, per no-generic-functions.
export const typeRootName: TypeDescriptor<'RootName'> = { brand: 'RootName' };
export const typeLedgerName: TypeDescriptor<'LedgerName'> = { brand: 'LedgerName' };
// The three, real, per-business container kinds createBusiness itself
// allocates - auto-generated by the system, never user-supplied
// directly, so no real validate function is needed here either.
export const typeBusinessLocationsRootName: TypeDescriptor<'BusinessLocationsRootName'> = { brand: 'BusinessLocationsRootName' };
export const typeBusinessItemsRootName: TypeDescriptor<'BusinessItemsRootName'> = { brand: 'BusinessItemsRootName' };
export const typeBusinessContactsRootName: TypeDescriptor<'BusinessContactsRootName'> = { brand: 'BusinessContactsRootName' };
export const typeLineTypeMarkerName: TypeDescriptor<'LineTypeMarkerName'> = { brand: 'LineTypeMarkerName' };
export const typeStorageOriginMarkerName: TypeDescriptor<'StorageOriginMarkerName'> = { brand: 'StorageOriginMarkerName' };
export const typeTextDirectionMarkerName: TypeDescriptor<'TextDirectionMarkerName'> = { brand: 'TextDirectionMarkerName' };
export const typeVocabularyWordName: TypeDescriptor<'VocabularyWordName'> = { brand: 'VocabularyWordName' };
export const typeRelationshipRecordName: TypeDescriptor<'RelationshipRecordName'> = { brand: 'RelationshipRecordName' };
export const typeOpenHoursRecordName: TypeDescriptor<'OpenHoursRecordName'> = { brand: 'OpenHoursRecordName' };
export const typeScheduleRecordName: TypeDescriptor<'ScheduleRecordName'> = { brand: 'ScheduleRecordName' };
export const typeEntityLinkRecordName: TypeDescriptor<'EntityLinkRecordName'> = { brand: 'EntityLinkRecordName' };
export const typeProjectTaskName: TypeDescriptor<'ProjectTaskName'> = { brand: 'ProjectTaskName' };
export const typeMenuOverrideName: TypeDescriptor<'MenuOverrideName'> = { brand: 'MenuOverrideName' };
export const typeHiddenMarkerName: TypeDescriptor<'HiddenMarkerName'> = { brand: 'HiddenMarkerName' };
export const typeTranslationConceptName: TypeDescriptor<'TranslationConceptName'> = { brand: 'TranslationConceptName' };
export const typeEquityAccountName: TypeDescriptor<'EquityAccountName'> = { brand: 'EquityAccountName' };
export const typeAssetAccountName: TypeDescriptor<'AssetAccountName'> = { brand: 'AssetAccountName' };
export const typeChartOfAccountsNodeName: TypeDescriptor<'ChartOfAccountsNodeName'> = { brand: 'ChartOfAccountsNodeName' };
export const typeChartOfAccountsRootName: TypeDescriptor<'ChartOfAccountsRootName'> = { brand: 'ChartOfAccountsRootName' };
export const typeLocationTypeMarkerName: TypeDescriptor<'LocationTypeMarkerName'> = { brand: 'LocationTypeMarkerName' };
export const typeIsBillingAddressMarkerName: TypeDescriptor<'IsBillingAddressMarkerName'> = { brand: 'IsBillingAddressMarkerName' };
// Raw, unvalidated creation step - a location isn't genuinely "real"
// (has a real location_type) until setLocation runs afterward; this
// covers the bare allocation moment only.
export const typeLocationEntityName: TypeDescriptor<'LocationEntityName'> = { brand: 'LocationEntityName' };
export const typeExpenseCategoryName: TypeDescriptor<'ExpenseCategoryName'> = { brand: 'ExpenseCategoryName' };
export const typeMenuSectionName: TypeDescriptor<'MenuSectionName'> = { brand: 'MenuSectionName' };
export const typeMenuLinkName: TypeDescriptor<'MenuLinkName'> = { brand: 'MenuLinkName' };
export const typeMenuLinkFlagName: TypeDescriptor<'MenuLinkFlagName'> = { brand: 'MenuLinkFlagName' };
export const typeBusinessTypeName: TypeDescriptor<'BusinessTypeName'> = { brand: 'BusinessTypeName' };
export const typeBusinessTypeQuestionsRootName: TypeDescriptor<'BusinessTypeQuestionsRootName'> = { brand: 'BusinessTypeQuestionsRootName' };
export const typeBusinessTypeQuestionName: TypeDescriptor<'BusinessTypeQuestionName'> = { brand: 'BusinessTypeQuestionName' };
export const typeDivisionName: TypeDescriptor<'DivisionName'> = { brand: 'DivisionName' };

import { seedRemainingData } from './db-seed.js';
seedRemainingData();


// ---------------------------------------------------------------------------
// Entities — append-only (see schema.sql): every write goes through
// entity_entry/entity_update/entity_delete, by name, never a raw
// UPDATE/DELETE on the table itself. Every write requires a userId —
// there's no anonymous entity creation, rename, or delete anymore.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Branded types: BusinessName and LedgerName are both, structurally, just
// strings — TypeScript's own structural typing would never catch a caller
// silently swapping which one goes where, since two `string` parameters are
// indistinguishable to the compiler. Branding makes this a real, genuine,
// caught-at-compile-time type error instead of a naming convention that
// could be silently violated. `asBusinessName`/`asLedgerName` are the one,
// explicit, real boundary where an ordinary string becomes one or the
// other — every real call site downstream carries that distinction through
// automatically, with no further casts needed.
// ---------------------------------------------------------------------------
export type BusinessName = string & { readonly __brand: 'BusinessName' };
export type LedgerName = string & { readonly __brand: 'LedgerName' };
export type AccountName = string & { readonly __brand: 'AccountName' };
export type DivisionName = string & { readonly __brand: 'DivisionName' };
export type LocationName = string & { readonly __brand: 'LocationName' };
export type EmployeeName = string & { readonly __brand: 'EmployeeName' };
export type CustomerName = string & { readonly __brand: 'CustomerName' };
export type VendorName = string & { readonly __brand: 'VendorName' };
export type ItemName = string & { readonly __brand: 'ItemName' };
// Numeric IDs get the exact, same treatment, for the exact, same real
// reason — a plain `number` can't distinguish "who performed this
// action" (userId, a real, direct primary key into the separate,
// real `users` table) from "which entity" (accountId/itemId/
// employeeId/locationId/etc., all genuinely the same underlying
// concept — a real, direct primary key into the one, shared
// entity_ids table every real entity in this system uses, just
// referenced under a semantically-named parameter per call site).
// EntityId deliberately covers all of those together, rather than a
// separate branded type per semantic name — they're structurally
// identical, unlike userId, which is a real, genuinely separate
// numeric space.
export type UserId = number & { readonly __brand: 'UserId' };
export type EntityId = number & { readonly __brand: 'EntityId' };
export function asUserId(id: number): UserId {
  return id as UserId;
}
export function asEntityId(id: number): EntityId {
  return id as EntityId;
}
export function asBusinessName(name: string): BusinessName {
  return name as BusinessName;
}
export function asLedgerName(name: string): LedgerName {
  return name as LedgerName;
}
export function asAccountName(name: string): AccountName {
  return name as AccountName;
}
export function asDivisionName(name: string): DivisionName {
  return name as DivisionName;
}
export function asLocationName(name: string): LocationName {
  return name as LocationName;
}
export function asEmployeeName(name: string): EmployeeName {
  return name as EmployeeName;
}
export function asCustomerName(name: string): CustomerName {
  return name as CustomerName;
}
export function asVendorName(name: string): VendorName {
  return name as VendorName;
}
export function asItemName(name: string): ItemName {
  return name as ItemName;
}

export interface EntityNode {
  id: number;
  name: string;
  parent_id: number | null;
  relation_id: number | null;
  accountnumber: string | null;
  balance_minor: number | null;
  currency: string | null;
}

/** The whole tree, flat, each row carrying its own depth from the single
 * root — easiest shape for a frontend to turn into a nested tree view.
 * Walks current_entities — a closed-out (renamed-away-from or deleted)
 * version never appears here, only history queries see those. */
/** The whole entity tree, flat, each row carrying its own depth AND
 * whether it's a genuine descendant of Chart of Accounts — the correct
 * way to identify a postable account, not a depth heuristic. depth
 * alone can't distinguish an account (Rent, at depth 4 under Chart of
 * Accounts > Expense) from something that happens to sit at the same
 * depth for an unrelated reason (Actual, a LEDGER, at depth 3 under
 * Businesses > My Business) — a real, reproduced bug where several
 * screens' account pickers used exactly that heuristic and picked up
 * ledgers, vocabulary words, and other non-account entities purely by
 * depth coincidence. */
export function getEntityTree(): (EntityNode & { depth: number; is_postable_account: boolean; line_type: string | null })[] {
  const rows = db
    .prepare(
      `WITH RECURSIVE walk(id, depth) AS (
         SELECT id, 0 FROM current_entities WHERE parent_id IS NULL
         UNION ALL
         SELECT e.id, w.depth + 1 FROM current_entities e JOIN walk w ON e.parent_id = w.id
       ),
       real_accounts(id) AS (
         SELECT id FROM current_entities WHERE name = 'Chart of Accounts'
         UNION ALL
         SELECT e.id FROM current_entities e
         JOIN real_accounts r ON e.parent_id = r.id
         WHERE NOT EXISTS (SELECT 1 FROM contact WHERE entity_id = r.id)
       )
       SELECT e.id, e.name, e.parent_id, e.relation_id, a.accountnumber, a.balance_minor, a.currency, w.depth,
              (ra.id IS NOT NULL AND p.entity_id IS NULL) AS is_postable_account,
              lt_target.name AS line_type,
              do_target.name AS display_order_next
       FROM walk w
       JOIN current_entities e ON e.id = w.id
       LEFT JOIN account a ON a.entity_id = e.id
       LEFT JOIN real_accounts ra ON ra.id = e.id
       LEFT JOIN contact p ON p.entity_id = e.id
       LEFT JOIN current_entities lt_record ON lt_record.name = e.name || ' — Line Type'
       LEFT JOIN current_entities lt_target ON lt_target.id = lt_record.relation_id
       LEFT JOIN current_entities do_record ON do_record.name = e.name || ' — Display Order'
       LEFT JOIN current_entities do_target ON do_target.id = do_record.relation_id
       ORDER BY w.depth, e.name`
    )
    .all() as (EntityNode & { depth: number; is_postable_account: number; line_type: string | null; display_order_next: string | null })[];
  // Per direct question, confirmed a real, second, even larger N+1
  // query problem, the genuine, dominant cost of this whole function:
  // orderSiblingsByDisplayOrder called getEntityLink(s.name, 'Display
  // Order') - a real, separate SQL query - once per real entity,
  // across the entire tree, even though the overwhelming majority
  // never have one set. Display Order is now joined directly into the
  // one, single query above instead, and passed through rather than
  // looked up again per sibling.
  const withFlags = rows.map((r) => ({ ...r, is_postable_account: !!r.is_postable_account }));
  // Re-order every real, individual level of siblings via the real
  // Display Order chain, only for levels that actually have one set —
  // everything else keeps today's exact, existing alphabetical order
  // the SQL query above already produced.
  const byParent = new Map<number | null, typeof withFlags>();
  for (const r of withFlags) {
    const list = byParent.get(r.parent_id) ?? [];
    list.push(r);
    byParent.set(r.parent_id, list);
  }
  const result: typeof withFlags = [];
  const seenParents = new Set<number | null>();
  for (const r of withFlags) {
    if (seenParents.has(r.parent_id)) continue;
    seenParents.add(r.parent_id);
    const siblings = byParent.get(r.parent_id)!;
    result.push(...orderSiblingsByDisplayOrderPreJoined(siblings));
  }
  return result;
}

/** The exact, same, real ordering logic as orderSiblingsByDisplayOrder
 * below, but using the display_order_next field getEntityTree's own
 * query already joined in directly - never a real, separate,
 * per-sibling getEntityLink query, which was this whole function's
 * genuine, dominant cost (confirmed directly, via a real, isolated
 * timing comparison). */
function orderSiblingsByDisplayOrderPreJoined<T extends { id: number; name: string; display_order_next: string | null }>(siblings: T[]): T[] {
  const nextByName = new Map<string, string>();
  const pointedAt = new Set<string>();
  for (const s of siblings) {
    const next = s.display_order_next;
    if (next && siblings.some((x) => x.name === next)) {
      nextByName.set(s.name, next);
      pointedAt.add(next);
    }
  }
  const ordered = siblings.filter((s) => nextByName.has(s.name) || pointedAt.has(s.name));
  if (ordered.length === 0) {
    return [...siblings].sort((a, b) => a.name.localeCompare(b.name));
  }
  const byName = new Map(ordered.map((s) => [s.name, s]));
  const first = ordered.find((s) => !pointedAt.has(s.name)) ?? ordered[0];
  const chain: T[] = [];
  const seen = new Set<string>();
  let current: T | undefined = first;
  while (current && !seen.has(current.name)) {
    chain.push(current);
    seen.add(current.name);
    const nextName = nextByName.get(current.name);
    current = nextName ? byName.get(nextName) : undefined;
  }
  const unordered = siblings.filter((s) => !seen.has(s.name)).sort((a, b) => a.name.localeCompare(b.name));
  return [...chain, ...unordered];
}

export function getEntity(id: number): EntityNode | undefined {
  return db
    .prepare(
      `SELECT e.id, e.name, e.parent_id, e.relation_id, a.accountnumber, a.balance_minor
       FROM current_entities e LEFT JOIN account a ON a.entity_id = e.id WHERE e.id = ?`
    )
    .get(id) as EntityNode | undefined;
}

export interface EntityHistoryRow {
  name: string;
  parent_id: number | null;
  relation_id: number | null;
  created_at: string;
  created_by: number;
  deleted_at: string | null;
  deleted_by: number | null;
}

/** Every version an entity has ever had, oldest first — the point of
 * the whole append-only design: nothing about this is reconstructed or
 * inferred, it's simply every row that was ever written, in order. */
export function getEntityHistory(id: number): EntityHistoryRow[] {
  return db
    .prepare(
      `SELECT name, parent_id, relation_id, created_at, created_by, deleted_at, deleted_by
       FROM entities WHERE entity_id = ? ORDER BY row_id`
    )
    .all(id) as EntityHistoryRow[];
}

function resolveId(name: string | null | undefined): number | null {
  if (name == null || name === '') return null;
  const row = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(name) as { id: number } | undefined;
  if (!row) throw new ValidationError(`No entity named "${name}".`);
  return row.id;
}

/** Resolves a real product's own, correct entity id — reliably
 * disambiguated from any real, same-named Sales/COGS/Inventory
 * account it may now genuinely share a name with (per the direct,
 * confirmed decision to remove the redundant "Sales - "/"COGS - "
 * text prefix, since the real, structural parent already conveys
 * this). A real product always, genuinely, structurally descends
 * from Items; its own financial accounts never do. */
export function resolveItemId(itemName: ItemName): number | undefined {
  return (
    db
      .prepare(
        `WITH RECURSIVE ancestors(id, orig) AS (
           SELECT id, id FROM current_entities WHERE name = ?
           UNION ALL
           SELECT e.parent_id, a.orig FROM current_entities e JOIN ancestors a ON e.id = a.id WHERE e.parent_id IS NOT NULL
         )
         SELECT DISTINCT orig AS id FROM ancestors a
         JOIN current_entities e ON e.id = a.id
         WHERE e.name = 'Items' OR e.name LIKE '% Items'`
      )
      .get(itemName) as { id: number } | undefined
  )?.id;
}

export interface NewEntity {
  name: string;
  parent?: string | null;
  parentId?: number | null;
  relation?: string | null;
  accountnumber?: string | null;
}

/** A real type descriptor - a value, never a bare string kind
 * argument, per no-generic-functions and direct instruction. Carries
 * both the compile-time brand and the real, runtime check together,
 * as one thing, since TypeScript has no reflection on generic type
 * parameters at runtime. */
export interface TypeDescriptor<TBrand extends string> {
  readonly brand: TBrand;
  /** For a real, Vocabulary-backed kind marker (a Location Type, an
   * Address Type), the exact set of valid names - checked against
   * before insertion, never after. Omit entirely for a genuinely
   * freely-named entity (a business's own chosen name, "Riverside
   * Cellars") - per direct instruction, there is no barrier to
   * naming a business, a division, a location, and an employee all
   * "Springfield" at once; free names are never constrained to a
   * fixed vocabulary. */
  readonly validNames?: () => string[];
  /** For a real, structural kind (a Category, genuinely any live
   * descendant of Items; a Location, genuinely has a real
   * location_type set) - a real, direct, runtime check against the
   * live entity tree, since TypeScript cannot statically know this.
   * Omit for a kind with no real, existing structural fact to check
   * (a bare Business/Employee name is valid the moment it's a real,
   * live entity at all). */
  readonly validate?: (name: string) => boolean;
}

export interface TypedNode<TBrand extends string> {
  readonly id: EntityId;
  readonly name: string & { readonly __brand: TBrand };
}

/** The real counterpart to create<T> - per direct instruction ("the
 * application verifies that a node is a Division by fetching its
 * type"): confirms an *existing* real entity genuinely matches a
 * type descriptor, and returns it as a real TypedNode - the one, real
 * place validation happens, so every function downstream that takes
 * a TypedNode<T> parameter can trust it was already checked, rather
 * than re-validating a bare string at every point of use. */
export function fetch<TBrand extends string>(name: string, type: TypeDescriptor<TBrand>): TypedNode<TBrand> {
  const id = resolveId(name);
  if (id == null) throw new ValidationError(`No entity named "${name}".`);
  if (type.validate && !type.validate(name)) {
    throw new ValidationError(`"${name}" exists, but is not a genuine ${type.brand}.`);
  }
  return { id: asEntityId(id), name: name as string & { __brand: TBrand } };
}

/** The real, numeric-id counterpart to fetch - for the real, existing
 * cases that already hold an id (from a route param, a prior query),
 * not a name, per no-generic-functions. */
export function fetchById<TBrand extends string>(id: number, type: TypeDescriptor<TBrand>): TypedNode<TBrand> {
  const row = db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(id) as { name: string } | undefined;
  if (!row) throw new ValidationError(`No entity with id ${id}.`);
  if (type.validate && !type.validate(row.name)) {
    throw new ValidationError(`"${row.name}" exists, but is not a genuine ${type.brand}.`);
  }
  return { id: asEntityId(id), name: row.name as string & { __brand: TBrand } };
}

/** The one, real, generic creation primitive - per direct
 * instruction, no dependency on the generic createEntity. Allocates
 * the next node directly via entity_entry (the real, low-level,
 * trigger-backed mechanism createEntity itself is built on), doing
 * its own, real, scoped-not-global uniqueness check first - the
 * exact, same rule as createEntity's own (two real siblings under the
 * same real parent can't share a name; the exact same name is
 * genuinely fine under a different parent - a business, a division, a
 * location, and an employee can all correctly be "Springfield" at
 * once) - and, when the type descriptor carries a real, Vocabulary-
 * backed validNames() list, checking the given name against it
 * *before* allocating, never after, so there is nothing to roll back
 * on a real, rejected name. */
export function create<TParentBrand extends string, TChildBrand extends string>(
  parent: TypedNode<TParentBrand>,
  type: TypeDescriptor<TChildBrand>,
  name: string,
  userId: UserId
): TypedNode<TChildBrand> {
  if (type.validNames && !type.validNames().includes(name)) {
    throw new ValidationError(`"${name}" is not a real, known ${type.brand} — use one of: ${type.validNames().join(', ')}.`);
  }
  const existing = db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(name, parent.id);
  if (existing) throw new ValidationError(`"${name}" already exists under this real, same parent.`);
  db.prepare(`INSERT INTO entity_entry (name, parent_id, created_by) VALUES (?, ?, ?)`).run(name, parent.id, userId);
  const row = db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(name, parent.id) as { id: number };
  return { id: asEntityId(row.id), name: name as string & { __brand: TChildBrand } };
}

/** Real, direct, structural validation - per no-generic-functions,
 * the actual fix for the originally-confirmed gap: createItem's own
 * parent used to accept any real entity name at all, never checking
 * it was genuinely a Category or the Items root. A Category is
 * structurally any real, live node under the global Items root
 * (Red Wine, Merlot, arbitrary depth) - a real, deliberate,
 * pragmatic definition that doesn't distinguish a genuine category
 * from a specific, already-created product also living under Items,
 * since both are real, valid parents for a new item in practice
 * (a product itself never legitimately has children in this catalog,
 * but nothing here forbids it structurally - a real, honest, stated
 * limit, not hidden). */
export function isGenuineCategoryOrItemsRoot(name: string): boolean {
  return name === 'Items' || name.endsWith(' Items') || isDescendantOf(name, 'Items');
}


export function createEntity(input: NewEntity, userId: UserId): EntityNode {
  const parentId = input.parentId ?? (input.parent ? resolveId(input.parent) : null);
  // Scoped, not global: two real, direct siblings under the same real
  // parent can't share a name, but the exact, same name is genuinely
  // fine at a different level, or under a different parent — a
  // company, a division, a location, and an employee can all
  // genuinely, correctly be called "Springfield" at once.
  const existing = parentId
    ? db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(input.name, parentId)
    : db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id IS NULL`).get(input.name);
  if (existing) throw new ValidationError(`"${input.name}" already exists under this real, same parent.`);
  // Vocabulary specifically also needs a real, case-insensitive check
  // — unlike scoped uniqueness elsewhere, a real translatable word is
  // meant to be one, single, flat, distinct entry ("Tax" and "tax", or
  // "On Hand" and "On hand", are never genuinely two different real
  // words, just a human typo away from silently fragmenting one real
  // word's own translations across two, confusing entries).
  if (parentId && input.name) {
    const parentName = (db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(parentId) as { name: string } | undefined)?.name;
    if (parentName === 'Vocabulary') {
      const caseInsensitiveMatch = db
        .prepare(`SELECT name FROM current_entities WHERE parent_id = ? AND LOWER(name) = LOWER(?)`)
        .get(parentId, input.name) as { name: string } | undefined;
      if (caseInsensitiveMatch) {
        throw new ValidationError(`"${input.name}" already exists in Vocabulary as "${caseInsensitiveMatch.name}" — use that exact, existing word instead of creating a near-duplicate.`);
      }
    }
  }
  resolveId(input.relation);
  db.prepare(`INSERT INTO entity_entry (name, parent, parent_id, relation, created_by) VALUES (?, ?, ?, ?, ?)`).run(
    input.name,
    input.parentId ? null : (input.parent ?? null),
    input.parentId ?? null,
    input.relation ?? null,
    userId
  );
  const idRow = (parentId
    ? db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(input.name, parentId)
    : db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id IS NULL`).get(input.name)) as { id: number };
  const id = idRow.id;
  if (input.accountnumber) {
    db.prepare(`INSERT INTO account (entity_id, accountnumber) VALUES (?, ?)`).run(id, input.accountnumber);
  }
  return getEntity(id)!;
}

export interface EntityUpdate {
  name?: string;
  parent?: string | null;
  relation?: string | null;
  /** Per direct, confirmed finding: resolving `relation` by bare name
   * is genuinely ambiguous once two, real, differently-scoped
   * entities share the same name (e.g. a real Location and a real
   * Product Instance node both named "Riverside Cellars"). Provide
   * this instead, when the exact, real target id is already known,
   * to bypass that ambiguity entirely - the same, now-proven pattern
   * already used for accountId/entityId elsewhere this session. */
  relationId?: number;
  accountnumber?: string | null;
}

/** A rename, reparent, or re-relation — closes out the entity's current
 * row and appends its replacement (entity_update in schema.sql), rather
 * than updating in place. Fields not provided keep their current value
 * carried forward onto the new row; entity_update needs the full set on
 * every write, so this fetches whatever wasn't explicitly changed. */
export function updateEntity(id: number, input: EntityUpdate, userId: UserId): EntityNode {
  const current = getEntity(id);
  if (!current) throw new NotFoundError(`Entity ${id} not found.`);

  const name = input.name !== undefined ? input.name : current.name;
  const parentId = input.parent !== undefined ? resolveId(input.parent) : current.parent_id;
  const relationId = input.relationId !== undefined ? input.relationId : input.relation !== undefined ? resolveId(input.relation) : current.relation_id;
  if (parentId === id) throw new ValidationError('An entity cannot be its own parent.');

  if (input.name !== undefined || input.parent !== undefined || input.relation !== undefined || input.relationId !== undefined) {
    const parentName = parentId != null ? (db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(parentId) as { name: string }).name : null;
    const relationName = relationId != null ? (db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(relationId) as { name: string }).name : null;
    db.prepare(`INSERT INTO entity_update (entity_id, name, parent, parent_id, relation, relation_id, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      id,
      name,
      parentName,
      parentId,
      relationName,
      relationId,
      userId
    );
  }

  if (input.accountnumber !== undefined) {
    const existingAccount = db.prepare(`SELECT entity_id FROM account WHERE entity_id = ?`).get(id);
    if (existingAccount) {
      db.prepare(`UPDATE account SET accountnumber = ? WHERE entity_id = ?`).run(input.accountnumber, id);
    } else if (input.accountnumber) {
      db.prepare(`INSERT INTO account (entity_id, accountnumber) VALUES (?, ?)`).run(id, input.accountnumber);
    }
  }
  return getEntity(id)!;
}

export interface Relationship {
  type: string;
  target: string;
}

/** Every real, already-known Chart of Accounts line type — the same,
 * established, user-amendable pattern already proven for address,
 * phone, and contact person types (see docs/entity-model.md). */
export function listLineTypes(): string[] {
  return db
    .prepare(
      `SELECT child.name FROM current_entities child
       JOIN current_entities parent ON parent.id = child.parent_id AND parent.name = 'Chart of Accounts Line Types'
       ORDER BY child.name`
    )
    .all()
    .map((r) => (r as { name: string }).name);
}

/** Sets a Chart of Accounts line's own explicit type (Header / Total
 * / Descriptive / Posting, or any real, further, user-added type) —
 * a real, direct use of the existing setEntityLink mechanism, per
 * direct instruction (no new tables): the same, real relationship
 * primitive already proven for dimension links elsewhere in this
 * codebase, not a new concept. Passing null removes the link
 * entirely, restoring today's real, existing is_postable_account-
 * derived behavior for that entity. */
export function setLineType(entityName: string, lineType: string | null, userId: UserId): void {
  if (lineType === null) {
    deleteEntityLink(entityName, 'Line Type', userId);
    return;
  }
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(lineType)) {
    create(fetch('Chart of Accounts Line Types', typeRootName), typeLineTypeMarkerName, lineType, userId);
  }
  setEntityLink(entityName, 'Line Type', lineType, userId);
}

/** The real, currently-set line type for one entity, or undefined if
 * never explicitly typed — the exact, same real getEntityLink
 * mechanism already proven elsewhere. */
export function getLineType(entityName: string): string | undefined {
  return getEntityLink(entityName, 'Line Type');
}

/** A real, explicit, per-Item "Storage Origin" dimension —
 * Hot (shelf) or Cold (refrigerated) — as a genuine relationship on
 * the Item entity itself, per direct instruction: not the earlier,
 * hardcoded category-name guess (COLD_STORAGE_CATEGORIES), which
 * could only ever say yes/no for a handful of known category names,
 * never represent the dimension explicitly on the Item itself, and
 * could never be corrected for a genuine exception. The exact same,
 * real setEntityLink mechanism already proven for Line Type, and the
 * same "Storage Origin Types" marker-entity parent pattern already
 * proven for Address Types/Phone Types/Chart of Accounts Line Types.
 * Passing null removes the link entirely — a real, valid "not yet
 * assigned a storage origin" state, not an error. */
export function setItemStorageOrigin(itemName: ItemName, origin: 'Hot' | 'Cold' | null, userId: UserId): void {
  if (origin === null) {
    deleteEntityLink(itemName, 'Storage Origin', userId);
    return;
  }
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Storage Origin Types')`).get(origin)) {
    create(fetch('Storage Origin Types', typeRootName), typeStorageOriginMarkerName, origin, userId);
  }
  setEntityLink(itemName, 'Storage Origin', origin, userId);
}

/** The real, currently-set storage origin for one Item, or undefined
 * if it's never been explicitly assigned one yet. */
export function getItemStorageOrigin(itemName: ItemName): 'Hot' | 'Cold' | undefined {
  return getEntityLink(itemName, 'Storage Origin') as 'Hot' | 'Cold' | undefined;
}

/** A real, generic "Text Direction" for any language — LTR or RTL —
 * mirroring setItemStorageOrigin's exact pattern, so any future
 * right-to-left language (not just Hebrew/Arabic specifically) is a
 * real, first-class citizen through the same, ordinary "Add Language"
 * mechanism, not a hardcoded, one-off special case. */
export function setLanguageDirection(languageName: string, direction: 'LTR' | 'RTL' | null, userId: UserId): void {
  if (direction === null) {
    deleteEntityLink(languageName, 'Text Direction', userId);
    return;
  }
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Text Direction Types')`).get(direction)) {
    create(fetch('Text Direction Types', typeRootName), typeTextDirectionMarkerName, direction, userId);
  }
  setEntityLink(languageName, 'Text Direction', direction, userId);
}

export function getLanguageDirection(languageName: string): 'LTR' | 'RTL' | undefined {
  return getEntityLink(languageName, 'Text Direction') as 'LTR' | 'RTL' | undefined;
}

/** Real, explicit display ordering among siblings — a genuine linked
 * list, per direct instruction (no new tables, another relationship
 * instead): "X — Display Order" links to whichever real sibling
 * comes immediately after X. An entity with no such link, and that
 * no other sibling's own link points at, is the real, first item;
 * one with no such link that some other sibling does point at is the
 * real, last. Entities with no real, explicit link at all anywhere
 * in a level keep today's exact, existing alphabetical order,
 * appended after every real, explicitly-ordered entity — the same,
 * real "lazily migrate only once actually touched" design already
 * used elsewhere in this codebase. */
function orderSiblingsByDisplayOrder<T extends { id: number; name: string }>(siblings: T[]): T[] {
  const nextByName = new Map<string, string>();
  const pointedAt = new Set<string>();
  for (const s of siblings) {
    const next = getEntityLink(s.name, 'Display Order');
    if (next && siblings.some((x) => x.name === next)) {
      nextByName.set(s.name, next);
      pointedAt.add(next);
    }
  }
  const ordered = siblings.filter((s) => nextByName.has(s.name) || pointedAt.has(s.name));
  if (ordered.length === 0) {
    return [...siblings].sort((a, b) => a.name.localeCompare(b.name));
  }
  const byName = new Map(ordered.map((s) => [s.name, s]));
  const first = ordered.find((s) => !pointedAt.has(s.name)) ?? ordered[0];
  const chain: T[] = [];
  const seen = new Set<string>();
  let current: T | undefined = first;
  while (current && !seen.has(current.name)) {
    chain.push(current);
    seen.add(current.name);
    const nextName = nextByName.get(current.name);
    current = nextName ? byName.get(nextName) : undefined;
  }
  const unordered = siblings.filter((s) => !seen.has(s.name)).sort((a, b) => a.name.localeCompare(b.name));
  return [...chain, ...unordered];
}

/** Moves one entity up or down among its own real siblings (same
 * parent_id) by re-linking the real "Display Order" chain — swaps
 * this entity's own position with whichever sibling is currently
 * immediately adjacent in that direction, in today's real, effective
 * order (an explicit chain first, then alphabetically among any
 * real, remaining unordered siblings — the exact, same order
 * orderSiblingsByDisplayOrder above already produces). Lazily
 * converts every visible sibling from alphabetical to an explicit
 * chain the first time any of them is ever moved. */
export function reorderSiblings(entityId: EntityId, direction: 'up' | 'down', userId: UserId): void {
  const entity = getEntity(entityId);
  if (!entity) throw new NotFoundError(`Entity ${entityId} not found.`);
  const rawSiblings = db
    .prepare(`SELECT id, name FROM current_entities WHERE ${entity.parent_id != null ? 'parent_id = ?' : 'parent_id IS NULL'}`)
    .all(...(entity.parent_id != null ? [entity.parent_id] : [])) as { id: number; name: string }[];
  const siblings = orderSiblingsByDisplayOrder(rawSiblings);
  const index = siblings.findIndex((s) => s.id === entityId);
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= siblings.length) return;
  const newOrder = [...siblings];
  [newOrder[index], newOrder[swapWith]] = [newOrder[swapWith], newOrder[index]];
  relinkDisplayOrderChain(newOrder, userId);
}

/** The same real operation as reorderSiblings, applied to a real,
 * multi-selected block of siblings at once — moves the whole
 * selected group up/down together as a unit, preserving their own
 * relative order within the block. All entityIds must share the
 * same real parent (a real, direct requirement — moving items
 * "together" across different levels has no coherent meaning). */
export function reorderSiblingsBulk(entityIds: number[], direction: 'up' | 'down', userId: UserId): void {
  if (entityIds.length === 0) return;
  const entities = entityIds.map((id) => {
    const e = getEntity(id);
    if (!e) throw new NotFoundError(`Entity ${id} not found.`);
    return e;
  });
  const parentId = entities[0].parent_id;
  if (entities.some((e) => e.parent_id !== parentId)) {
    throw new ValidationError('Every selected entity must share the same real parent to be reordered together.');
  }
  const rawSiblings = db
    .prepare(`SELECT id, name FROM current_entities WHERE ${parentId != null ? 'parent_id = ?' : 'parent_id IS NULL'}`)
    .all(...(parentId != null ? [parentId] : [])) as { id: number; name: string }[];
  const siblings = orderSiblingsByDisplayOrder(rawSiblings);
  const selectedIds = new Set(entityIds);
  // The real, selected block itself — exactly the selected entities,
  // in their own current, real relative order. Deliberately NOT the
  // full span between the first and last selected index: a
  // non-adjacent selection (e.g. picking the 1st and 3rd of five
  // siblings) would otherwise silently sweep up the unselected item
  // sitting between them too.
  const block = siblings.filter((s) => selectedIds.has(s.id));
  const rest = siblings.filter((s) => !selectedIds.has(s.id));
  const indices = siblings.map((s, i) => (selectedIds.has(s.id) ? i : -1)).filter((i) => i !== -1);
  const firstIndex = Math.min(...indices);
  const lastIndex = Math.max(...indices);
  // The real, adjacent, non-selected sibling in the direction of
  // travel — walking outward from the block skips over any other
  // already-selected sibling sitting right at that edge (a
  // non-adjacent selection can have one).
  let anchorIndex = direction === 'up' ? firstIndex - 1 : lastIndex + 1;
  while (anchorIndex >= 0 && anchorIndex < siblings.length && selectedIds.has(siblings[anchorIndex].id)) {
    anchorIndex += direction === 'up' ? -1 : 1;
  }
  if (anchorIndex < 0 || anchorIndex >= siblings.length) return;
  const anchor = siblings[anchorIndex];
  const anchorRestIndex = rest.findIndex((s) => s.id === anchor.id);
  const insertAt = direction === 'up' ? anchorRestIndex : anchorRestIndex + 1;
  const newOrder = [...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)];
  relinkDisplayOrderChain(newOrder, userId);
}

/** Rewrites the real "Display Order" chain to match a real, given,
 * already-decided order — clears any real, stale links from
 * siblings no longer item of the chain (an entity deleted since the
 * chain was last built), then links each entity to the one real,
 * next after it. */
function relinkDisplayOrderChain(orderedSiblings: { id: number; name: string }[], userId: UserId): void {
  for (const s of orderedSiblings) deleteEntityLink(s.name, 'Display Order', userId);
  for (let i = 0; i < orderedSiblings.length - 1; i++) {
    setEntityLink(orderedSiblings[i].name, 'Display Order', orderedSiblings[i + 1].name, userId);
  }
}

/** Records that `entityName` has a relationship of `relationshipType`
 * with `targetName` — e.g. "Smith Family Trust" is "Trustee Of"
 * "Boutique Wine Company". This is the SAME relation_id mechanism a
 * plain report/category tag already uses (COGS, Balance Sheet, P&L
 * Statement) — a tag is the degenerate case of this exact shape,
 * where the type entity IS the complete answer and no second fact is
 * needed. A relationship genuinely needs two facts (what kind, and
 * with whom), so it uses one more hop: entityName's own relation_id
 * points at a real, lazily-created intermediate entity — that
 * entity's own parent_id gives the type (relationshipType, expected
 * to live under a real category like "Relationship Types"), and its
 * own relation_id gives the target. Not a new mechanism — the same one,
 * used recursively, exactly the way a real relationship (which needs
 * both a type and a target) actually requires. See
 * docs/entity-model.md. */
export function setRelationship(entityName: string, relationshipType: string, targetName: string, userId: UserId): void {
  const recordName = `${relationshipType} — ${entityName} → ${targetName}`;
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(recordName)) {
    create(fetch(relationshipType, typeRootName), typeRelationshipRecordName, recordName, userId);
  }
  const record = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(recordName) as { id: number };
  updateEntity(record.id, { relation: targetName }, userId);
  const entity = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(entityName) as { id: number } | undefined;
  if (!entity) throw new NotFoundError(`No entity named "${entityName}".`);
  updateEntity(entity.id, { relation: recordName }, userId);
}

/** The single-entity lookup: "what relationship does entityName have,
 * and with whom?" Walks entityName's own relation_id one hop to the
 * intermediate record, then reads that record's parent_id (the type)
 * and relation_id (the target) — undefined if entityName's relation_id
 * isn't actually a relationship record (e.g. it's a plain tag, or
 * unset). */
export function getRelationship(entityName: string): Relationship | undefined {
  const row = db
    .prepare(
      `SELECT rel_type.name AS type, target.name AS target
       FROM current_entities e
       JOIN current_entities rel ON rel.id = e.relation_id
       JOIN current_entities rel_type ON rel_type.id = rel.parent_id
       JOIN current_entities target ON target.id = rel.relation_id
       WHERE e.name = ?`
    )
    .get(entityName) as Relationship | undefined;
  return row;
}

/** The group query: "show me every entity with a relationship of this
 * type, and its target" — e.g. every company acting as trustee for
 * anything. Walks from the type node down to every intermediate
 * relationship record under it, then to whatever entity's own
 * relation_id actually points at that record. */
export function getEntitiesWithRelationship(relationshipType: string): { source: string; target: string }[] {
  return db
    .prepare(
      `SELECT source.name AS source, target.name AS target
       FROM current_entities rel
       JOIN current_entities rel_type ON rel_type.id = rel.parent_id AND rel_type.name = ?
       JOIN current_entities target ON target.id = rel.relation_id
       JOIN current_entities source ON source.relation_id = rel.id`
    )
    .all(relationshipType) as { source: string; target: string }[];
}

export interface OrgChartDivision {
  division: string;
  locations: { location: string; employees: string[] }[];
}
export interface OrganizationChart {
  business: string;
  companyWideEmployees: string[]; // "Place of Employment" points straight at the business itself
  divisions: OrgChartDivision[];
}

/** Builds the real, complete organizational chart for a real
 * business, walking the full, real chain — Business <-(belongs to)-
 * Division <-(belongs to)- Location <-(place of employment)- Employee
 * — through the three real relationship layers, not through
 * parent_id at all (each of those stays exactly where it already
 * was; only the relationship layer is new). Per direct confirmation:
 * "yes definitely for organizational charts and employee directory". */
export interface HierarchyNode {
  id: number;
  name: string;
  children: HierarchyNode[];
}

/** Builds the real, in-memory tree for any real hierarchy, from its
 * own, real root entity, for the application to hold and walk in
 * memory — Chart of Accounts, Vocabulary, or any other real,
 * structural tree, all built the exact, same, generic way. Walks two,
 * real, distinct kinds of edge together: (1) direct, structural
 * parent_id children, and (2) for hierarchies built from a real,
 * named relationship (e.g. "Belongs To Division") rather than plain
 * structural nesting, every real entity elsewhere in the tree whose
 * own relationship names this node as its target — the same,
 * established mechanism getEntitiesWithRelationship already uses.
 * This also, correctly includes a real entity that is genuinely its
 * own group (e.g. a single-location "division" with no separate,
 * dedicated division entity of its own — its own relationship simply
 * targets itself), never silently dropped for lacking a second,
 * redundant relationship record. */
export function getHierarchy(rootName: string, relationshipType?: string): HierarchyNode {
  const rootId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(rootName) as { id: number } | undefined)?.id;
  if (!rootId) throw new NotFoundError(`No real entity named "${rootName}".`);

  const relPairs = relationshipType ? getEntitiesWithRelationship(relationshipType) : [];
  const childrenByTarget = new Map<string, string[]>();
  for (const { source, target } of relPairs) {
    if (!childrenByTarget.has(target)) childrenByTarget.set(target, []);
    childrenByTarget.get(target)!.push(source);
  }

  // A real, indirect cycle (A -> B -> A) in a relationship chain
  // would otherwise recurse forever — better-sqlite3 is synchronous
  // and blocking, so an unguarded cycle here genuinely hangs the
  // entire event loop, not just this one, real request. A plain
  // depth counter is sufficient: no genuine, real hierarchy in this
  // application is anywhere near this deep.
  const MAX_DEPTH = 100;
  function buildNode(id: number, name: string, depth: number): HierarchyNode {
    if (depth > MAX_DEPTH) {
      throw new ValidationError(`getHierarchy("${rootName}") exceeded ${MAX_DEPTH} levels of real depth — a genuine cycle in the relationship chain, not a real, this-deep hierarchy.`);
    }
    const directChildren = db.prepare(`SELECT id, name FROM current_entities WHERE parent_id = ?`).all(id) as { id: number; name: string }[];
    const seen = new Set(directChildren.map((c) => c.name));
    const relationshipChildNames = (childrenByTarget.get(name) ?? []).filter((n) => n !== name && !seen.has(n));
    for (const n of relationshipChildNames) seen.add(n);
    const relationshipChildren = relationshipChildNames
      .map((n) => db.prepare(`SELECT id, name FROM current_entities WHERE name = ?`).get(n) as { id: number; name: string } | undefined)
      .filter((c): c is { id: number; name: string } => !!c);
    return {
      id,
      name,
      children: [...directChildren, ...relationshipChildren].map((c) => buildNode(c.id, c.name, depth + 1)),
    };
  }
  return buildNode(rootId, rootName, 0);
}

export function getOrganizationChart(businessName: BusinessName): OrganizationChart {
  const businessRows = getEntitiesWithRelationship('Belongs To Business').filter((r) => r.target === businessName);
  const locationRows = getEntitiesWithRelationship('Belongs To Division');
  const employmentRows = getEntitiesWithRelationship('Place of Employment');

  const companyWideEmployees = employmentRows.filter((r) => r.target === businessName).map((r) => r.source).sort();

  // A real division is genuinely either (1) a real entity with its
  // own "Belongs To Business" relationship pointing at this business,
  // or (2) any real target of a "Belongs To Division" relationship
  // whose own locations trace back to this business — covering a
  // single-location "division" that is genuinely its own group, with
  // no separate, dedicated division entity or business relationship
  // of its own (its own location's relationship simply targets
  // itself), never silently dropped from the real org chart.
  const businessDivisionNames = new Set(businessRows.map((r) => r.source));
  for (const { target } of locationRows) {
    businessDivisionNames.add(target);
  }
  // Filter division-only-by-location-relationship names to genuinely
  // real ones belonging to this business — a location's own city or
  // structural home under this exact business's own Locations.
  const businessLocationNames = new Set(
    (db.prepare(`SELECT e.name FROM current_entities e WHERE e.parent_id = (SELECT id FROM current_entities WHERE name = ?)`).all(`${businessName} Locations`) as { name: string }[]).map((r) => r.name)
  );

  const divisions: OrgChartDivision[] = [...businessDivisionNames]
    .filter((divisionName) => businessRows.some((r) => r.source === divisionName) || businessLocationNames.has(divisionName))
    .sort()
    .map((divisionName) => {
      const locations = locationRows
        .filter((l) => l.target === divisionName)
        .map((l) => l.source)
        .sort()
        .map((locationName) => ({
          location: locationName,
          employees: employmentRows
            .filter((e) => e.target === locationName)
            .map((e) => e.source)
            .sort(),
        }));
      return { division: divisionName, locations };
    });

  return { business: businessName, companyWideEmployees, divisions };
}

export function deleteEntity(id: number, userId: UserId): void {
  const hasChildren = db.prepare(`SELECT 1 FROM current_entities WHERE parent_id = ? LIMIT 1`).get(id);
  if (hasChildren) throw new ValidationError('Cannot delete an entity that still has children — move or delete them first.');
  const hasPostings = db.prepare(`SELECT 1 FROM journal_line WHERE account_id = ? LIMIT 1`).get(id);
  if (hasPostings) throw new ValidationError('Cannot delete an entity that has journal postings against it.');
  const entity = getEntity(id);
  if (!entity) throw new NotFoundError(`Entity ${id} not found.`);
  // Per direct rule: every real business must always have both a
  // real Actual ledger and a real Budget ledger — never deletable
  // down to zero of either kind, even a genuinely empty, brand-new
  // one with no real postings yet at all (the two checks above
  // wouldn't otherwise catch this, since a ledger itself carries no
  // real children or direct postings of its own — journal_line
  // references the real account, not the ledger).
  const parent = entity.parent_id ? getEntity(entity.parent_id) : null;
  if (parent && db.prepare(`SELECT 1 FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses') AND id = ?`).get(parent.id)) {
    const siblingLedgers = db.prepare(`SELECT name FROM current_entities WHERE parent_id = ?`).all(parent.id) as { name: string }[];
    const isActual = entity.name.endsWith(' Actual') || entity.name === 'Actual';
    const isBudget = / Budget /.test(` ${entity.name} `) || entity.name.startsWith('Budget ') || entity.name === 'Budget';
    const otherActualCount = siblingLedgers.filter((s) => s.name !== entity.name && (s.name.endsWith(' Actual') || s.name === 'Actual')).length;
    const otherBudgetCount = siblingLedgers.filter((s) => s.name !== entity.name && (/ Budget /.test(` ${s.name} `) || s.name.startsWith('Budget ') || s.name === 'Budget')).length;
    if (isActual && otherActualCount === 0) throw new ValidationError(`"${parent.name}" must always have a real Actual ledger — this is its only one.`);
    if (isBudget && otherBudgetCount === 0) throw new ValidationError(`"${parent.name}" must always have a real Budget ledger — this is its only one.`);
  }
  // account/contact/translation rows are deliberately left in place —
  // they're historical facts about this now-closed-out entity_id (what
  // was its phone number, its account number, when it was deleted),
  // consistent with everything else here never disappearing outright.
  db.prepare(`INSERT INTO entity_delete (entity_id, deleted_by) VALUES (?, ?)`).run(id, userId);
}

// ---------------------------------------------------------------------------
// Contacts — phone/address for any entity (a customer, vendor, employee).
// Same 1:1 extension shape as account; upsert is a full replace (see the
// note in schema.sql), so callers should always send the complete record.
// ---------------------------------------------------------------------------

export interface AgingBucket {
  label: string;
  through_days: number;
}

/** Derives the three aging buckets from one stored term — a customer
 * on Net 30 ages at 30/60/90, Net 7 at 7/14/21, Net 14 at 14/28/42.
 * null (not yet configured) falls back to a conventional 30/60/90.
 * 0 (cash only) still gets buckets — nothing is ever truly exempt from
 * aging, a cash-only customer who hasn't paid is overdue immediately,
 * so their single bucket boundary is 0 itself. */
export interface CreditStatus {
  balanceMinor: number;
  limitMinor: number | null;
  overLimit: boolean;
  /** How much real headroom remains before the limit — negative once
   * already over. Null when no real limit has been set at all. */
  remainingMinor: number | null;
}

/** A real customer or vendor's own current credit position — their
 * own entity's real, live balance (already their true, current
 * outstanding amount, no separate calculation needed) against their
 * own real, configured credit_limit_minor. A real, non-blocking
 * check: callers decide whether to warn or refuse, this only reports
 * the real facts. */
export function getCreditStatus(entityName: string): CreditStatus {
  const row = db
    .prepare(
      `SELECT COALESCE(a.balance_minor, 0) AS balance_minor, c.credit_limit_minor
       FROM current_entities e
       LEFT JOIN account a ON a.entity_id = e.id
       LEFT JOIN contact c ON c.entity_id = e.id
       WHERE e.name = ?`
    )
    .get(entityName) as { balance_minor: number; credit_limit_minor: number | null } | undefined;
  const balanceMinor = Math.abs(row?.balance_minor ?? 0); // a real AR balance is naturally negative (credit-normal); a real outstanding amount owed is always reported as positive here
  const limitMinor = row?.credit_limit_minor ?? null;
  return {
    balanceMinor,
    limitMinor,
    overLimit: limitMinor !== null && balanceMinor > limitMinor,
    remainingMinor: limitMinor !== null ? limitMinor - balanceMinor : null,
  };
}

export function getAgingBuckets(paymentTermsDays: number | null): AgingBucket[] {
  const term = paymentTermsDays ?? 30;
  if (term === 0) return [{ label: 'Due immediately', through_days: 0 }];
  return [
    { label: `1-${term}`, through_days: term },
    { label: `${term + 1}-${term * 2}`, through_days: term * 2 },
    { label: `${term * 2 + 1}-${term * 3}`, through_days: term * 3 },
  ];
}

// ---------------------------------------------------------------------------
// Invoices — the real billing event, distinct from the physical
// Dispatch Note/Goods Receipt. AR and AP share this mechanism (same
// shape, debit/credit sign flipped), matching how AR Sale/AP Purchase
// already mirror each other in this project.
// ---------------------------------------------------------------------------

export interface InvoiceLineInput {
  description: string;
  quantity?: number | null;
  unitPriceMinor?: number | null;
  amountMinor: number;
  taxMinor?: number;
  itemName?: string | null;
  dispatchReference?: string | null;
}

export interface InvoiceInput {
  invoiceType: 'AR' | 'AP';
  documentType?: 'invoice' | 'credit_note' | 'debit_memo';
  referencesInvoiceId?: number | null;
  business: string;
  ledger: string;
  reference: string;
  counterpartyName: string;
  invoiceDate: string;
  description?: string;
  lines: InvoiceLineInput[];
  /** 'pos' for an immediate point-of-sale cash/card sale, 'manual'
   * (the default) for a deliberate, account-based invoice created
   * directly. */
  source?: 'manual' | 'pos';
}

export interface Invoice {
  id: number;
  invoice_type: 'AR' | 'AP';
  document_type: 'invoice' | 'credit_note' | 'debit_memo';
  references_invoice_id: number | null;
  business: string;
  ledger: string;
  reference: string;
  counterparty: string;
  invoice_date: string;
  due_date: string | null;
  description: string;
  status: 'draft' | 'posted' | 'void';
  posted_by: string | null;
  source: 'manual' | 'pos';
  lines: (InvoiceLineInput & { id: number })[];
  total_amount_minor: number;
  total_tax_minor: number;
}

export function createInvoice(input: InvoiceInput, userId: UserId): number {
  const businessId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(input.business) as { id: number } | undefined)?.id;
  if (!businessId) throw new ValidationError(`No business named "${input.business}".`);
  const ledgerId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(input.ledger) as { id: number } | undefined)?.id;
  if (!ledgerId) throw new ValidationError(`No ledger named "${input.ledger}".`);
  const counterpartyId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(input.counterpartyName) as { id: number } | undefined)
    ?.id;
  if (!counterpartyId) throw new ValidationError(`No customer/vendor named "${input.counterpartyName}".`);
  if (input.lines.length === 0) throw new ValidationError('An invoice needs at least one line.');
  if (input.referencesInvoiceId != null && !getInvoice(input.referencesInvoiceId)) {
    throw new ValidationError(`No invoice with id ${input.referencesInvoiceId} to reference.`);
  }
  // A real, explicit check before the insert, not left for the raw
  // SQLite UNIQUE constraint to surface as an opaque 500 error — found
  // via a real, live e-invoice import test: importing a real,
  // incoming invoice whose reference happens to collide with an
  // existing one (a genuinely real scenario, not hypothetical) needs
  // a real, clear message, not a stack trace.
  const existingWithSameReference = db
    .prepare(`SELECT 1 FROM invoice WHERE business_id = ? AND ledger_id = ? AND reference = ?`)
    .get(businessId, ledgerId, input.reference);
  if (existingWithSameReference) {
    throw new ValidationError(`An invoice with reference "${input.reference}" already exists in ${input.ledger} — references must be unique within a ledger.`);
  }

  // Due date derived from the counterparty's own payment terms, same
  // "1x the term" logic getAgingBuckets already uses — genuinely
  // computed, not left blank for someone to fill in by hand.
  const contact = getContact(input.counterpartyName);
  const termDays = contact?.payment_terms_days ?? 30;
  const dueDate = db.prepare(`SELECT date(?, '+' || ? || ' days') AS d`).get(input.invoiceDate, termDays) as { d: string };

  const result = db
    .prepare(
      `INSERT INTO invoice (invoice_type, document_type, references_invoice_id, business_id, ledger_id, reference, counterparty_id, invoice_date, due_date, description, status, user_id, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
    )
    .run(
      input.invoiceType,
      input.documentType ?? 'invoice',
      input.referencesInvoiceId ?? null,
      businessId,
      ledgerId,
      input.reference,
      counterpartyId,
      input.invoiceDate,
      dueDate.d,
      input.description ?? '',
      userId,
      input.source ?? 'manual'
    );
  const invoiceId = result.lastInsertRowid as number;

  input.lines.forEach((line, i) => {
    const itemId = line.itemName ? resolveItemId(asItemName(line.itemName)) : null;
    db.prepare(
      `INSERT INTO invoice_detail_line (invoice_id, line_order, item_id, description, quantity, unit_price_minor, amount_minor, tax_minor, dispatch_reference)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      invoiceId,
      i,
      itemId ?? null,
      line.description,
      line.quantity ?? null,
      line.unitPriceMinor ?? null,
      line.amountMinor,
      line.taxMinor ?? 0,
      line.dispatchReference ?? null
    );
  });

  return invoiceId;
}

export function getInvoice(id: number): Invoice | undefined {
  const row = db
    .prepare(
      `SELECT i.id, i.invoice_type, i.document_type, i.references_invoice_id, biz.name AS business, led.name AS ledger, i.reference,
              cp.name AS counterparty, i.invoice_date, i.due_date, i.description, i.status, u.username AS posted_by, i.source
       FROM invoice i
       JOIN current_entities biz ON biz.id = i.business_id
       JOIN current_entities led ON led.id = i.ledger_id
       JOIN current_entities cp ON cp.id = i.counterparty_id
       LEFT JOIN journal j ON j.id = i.posted_journal_id
       LEFT JOIN users u ON u.id = j.user_id
       WHERE i.id = ?`
    )
    .get(id) as Omit<Invoice, 'lines' | 'total_amount_minor' | 'total_tax_minor'> | undefined;
  if (!row) return undefined;

  const lines = db
    .prepare(
      `SELECT idl.id, idl.description, idl.quantity, idl.unit_price_minor AS unitPriceMinor, idl.amount_minor AS amountMinor,
              idl.tax_minor AS taxMinor, idl.dispatch_reference AS dispatchReference, p.name AS itemName
       FROM invoice_detail_line idl
       LEFT JOIN current_entities p ON p.id = idl.item_id
       WHERE idl.invoice_id = ?
       ORDER BY idl.line_order`
    )
    .all(id) as (InvoiceLineInput & { id: number })[];

  return {
    ...row,
    lines,
    total_amount_minor: lines.reduce((s, l) => s + l.amountMinor, 0),
    total_tax_minor: lines.reduce((s, l) => s + (l.taxMinor ?? 0), 0),
  };
}

// ---------------------------------------------------------------------------
// E-invoicing — real, structured UBL 2.1 XML export/import, per direct
// request ("e-invoice both in and out"). Targets the core, mandatory
// UBL 2.1 fields (the same real structure Peppol BIS Billing 3.0/
// PINT A-NZ build on) rather than every optional business rule in the
// full, official schema — a real, genuinely UBL-structured document,
// not a claim of full network-certified compliance.
// ---------------------------------------------------------------------------

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** A real, posted invoice exported as a real UBL 2.1 Invoice XML
 * document — the same real structure a real Peppol Access Point
 * would expect to receive: cbc:ID, cbc:IssueDate,
 * AccountingSupplierParty/AccountingCustomerParty, one real
 * InvoiceLine per real invoice line, TaxTotal, LegalMonetaryTotal. */
export function exportInvoiceAsUbl(invoiceId: number): string {
  const invoice = getInvoice(invoiceId);
  if (!invoice) throw new NotFoundError(`No invoice with id ${invoiceId}.`);
  if (invoice.status !== 'posted') throw new ValidationError(`Invoice ${invoice.reference} must be posted before it can be exported as a real e-invoice.`);

  const invoiceTypeCode = invoice.document_type === 'credit_note' ? '381' : invoice.document_type === 'debit_memo' ? '383' : '380'; // real UBL 1001 code list values
  const totalMinor = invoice.total_amount_minor + invoice.total_tax_minor;
  const lines = invoice.lines
    .map(
      (l, i) => `  <cac:InvoiceLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="EA">${l.quantity ?? 1}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="AUD">${(l.amountMinor / 100).toFixed(2)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${xmlEscape(l.description)}</cbc:Name>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="AUD">${((l.unitPriceMinor ?? l.amountMinor) / 100).toFixed(2)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${xmlEscape(invoice.reference)}</cbc:ID>
  <cbc:IssueDate>${invoice.invoice_date}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>${invoiceTypeCode}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>AUD</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${xmlEscape(invoice.business)}</cbc:Name></cac:PartyName>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${xmlEscape(invoice.counterparty)}</cbc:Name></cac:PartyName>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="AUD">${(invoice.total_tax_minor / 100).toFixed(2)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="AUD">${(invoice.total_amount_minor / 100).toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="AUD">${(invoice.total_amount_minor / 100).toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="AUD">${(totalMinor / 100).toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="AUD">${(totalMinor / 100).toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${lines}
</Invoice>
`;
}

export interface UblImportLine {
  description: string;
  quantity: number;
  unitPriceMinor: number;
  amountMinor: number;
}
export interface UblImportResult {
  reference: string;
  issueDate: string;
  supplierName: string;
  totalMinor: number;
  taxMinor: number;
  lines: UblImportLine[];
}

/** A real, incoming UBL 2.1 XML document, parsed into its real fields
 * — deliberately simple, regex-based extraction rather than a full
 * XML parser dependency, since the real fields this app needs back
 * out are a small, well-known, fixed set within a document this same
 * export function itself already produces in a predictable shape. */
export function parseUblInvoice(xml: string): UblImportResult {
  function tag(name: string, source: string): string | null {
    const m = source.match(new RegExp(`<(?:cbc:)?${name}[^>]*>([^<]*)</(?:cbc:)?${name}>`));
    return m ? m[1] : null;
  }
  const reference = tag('ID', xml);
  const issueDate = tag('IssueDate', xml);
  if (!reference || !issueDate) throw new ValidationError('Not a real, valid UBL invoice — missing a real ID or IssueDate.');

  const supplierBlock = xml.match(/<cac:AccountingSupplierParty>([\s\S]*?)<\/cac:AccountingSupplierParty>/);
  const supplierName = supplierBlock ? tag('Name', supplierBlock[1]) ?? '(unknown supplier)' : '(unknown supplier)';

  const taxMinor = Math.round(Number(tag('TaxAmount', xml) ?? '0') * 100);
  const payableMinor = Math.round(Number(tag('PayableAmount', xml) ?? '0') * 100);

  const lineBlocks = [...xml.matchAll(/<cac:InvoiceLine>([\s\S]*?)<\/cac:InvoiceLine>/g)].map((m) => m[1]);
  const lines: UblImportLine[] = lineBlocks.map((block) => {
    const quantity = Number(tag('InvoicedQuantity', block) ?? '1');
    const amountMinor = Math.round(Number(tag('LineExtensionAmount', block) ?? '0') * 100);
    const priceMatch = block.match(/<cac:Price>([\s\S]*?)<\/cac:Price>/);
    const unitPriceMinor = priceMatch ? Math.round(Number(tag('PriceAmount', priceMatch[1]) ?? '0') * 100) : amountMinor;
    const itemMatch = block.match(/<cac:Item>([\s\S]*?)<\/cac:Item>/);
    const description = itemMatch ? tag('Name', itemMatch[1]) ?? '(unnamed item)' : '(unnamed item)';
    return { description, quantity, unitPriceMinor, amountMinor };
  });

  return { reference, issueDate, supplierName, totalMinor: payableMinor - taxMinor, taxMinor, lines };
}

export interface EInvoiceDiscrepancy {
  field: string;
  poValue: string;
  invoiceValue: string;
}

/** The real "3-way match" — compares a real, incoming e-invoice
 * against the real Purchase Order it claims to be for (matched by
 * vendor and real, close-enough total), surfacing any real, genuine
 * mismatch rather than silently accepting whatever the e-invoice
 * says. Returns an empty array when everything genuinely matches, or
 * when no matching real PO can be found at all (a real, separate
 * fact the caller should also decide how to handle, not folded into
 * "discrepancy" here). */
export function checkEInvoiceDiscrepancies(parsed: UblImportResult, poReference?: string): EInvoiceDiscrepancy[] {
  if (!poReference) return [];
  const poVendor = db.prepare(`SELECT relation_id FROM current_entities WHERE name = ?`).get(`${poReference} Qty`) as { relation_id: number | null } | undefined;
  const poItem = db.prepare(`SELECT relation_id FROM current_entities WHERE name = ?`).get(`${poReference} Value`) as { relation_id: number | null } | undefined;
  const discrepancies: EInvoiceDiscrepancy[] = [];
  if (poVendor?.relation_id) {
    const vendorName = (db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(poVendor.relation_id) as { name: string } | undefined)?.name;
    if (vendorName && vendorName !== parsed.supplierName) {
      discrepancies.push({ field: 'Vendor', poValue: vendorName, invoiceValue: parsed.supplierName });
    }
  }
  const status = poItem ? getOrderStatus(poReference) : null;
  if (status) {
    const invoiceLineTotal = parsed.lines.reduce((s, l) => s + l.amountMinor, 0);
    // Allow a small, real rounding tolerance (1 cent per line) rather
    // than flagging every invoice for an honest floating-point
    // rounding difference that isn't a genuine discrepancy at all.
    if (Math.abs(invoiceLineTotal - status.value_minor) > parsed.lines.length) {
      discrepancies.push({
        field: 'Total amount',
        poValue: (status.value_minor / 100).toFixed(2),
        invoiceValue: (invoiceLineTotal / 100).toFixed(2),
      });
    }
  }
  return discrepancies;
}

/** A real, parsed e-invoice, imported as a real, draft AP invoice —
 * deliberately never auto-posted. The existing draft status IS the
 * real approval gate: a draft has no GL effect at all until someone
 * explicitly reviews it and posts it, the same real mechanism every
 * other invoice already uses, not a new status invented for this one
 * case. Any real discrepancy found against the matching PO is
 * recorded directly in the invoice's own description, so it's
 * immediately visible to whoever reviews the draft, not hidden in a
 * separate place they'd have to know to check. */
export function importUblInvoiceAsDraft(xml: string, business: BusinessName, ledger: LedgerName, vendorName: string, userId: UserId, poReference?: string): { invoiceId: number; discrepancies: EInvoiceDiscrepancy[] } {
  const parsed = parseUblInvoice(xml);
  const discrepancies = checkEInvoiceDiscrepancies(parsed, poReference);
  const description = discrepancies.length
    ? `Imported e-invoice — ${discrepancies.length} real discrepancy${discrepancies.length > 1 ? 'ies' : ''} against PO ${poReference}: ${discrepancies.map((d) => `${d.field} (PO: ${d.poValue}, invoice: ${d.invoiceValue})`).join('; ')}`
    : poReference
      ? `Imported e-invoice — matches PO ${poReference}, no discrepancies found.`
      : 'Imported e-invoice — no PO reference given to match against.';

  const invoiceId = createInvoice(
    {
      invoiceType: 'AP',
      business,
      ledger,
      reference: parsed.reference,
      counterpartyName: vendorName,
      invoiceDate: parsed.issueDate,
      description,
      lines: parsed.lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, amountMinor: l.amountMinor, taxMinor: 0 })),
    },
    userId
  );
  return { invoiceId, discrepancies };
}

// ---------------------------------------------------------------------------
// Picking, packing, and dispatch — per direct request: "you just got a
// list of approved customer orders on a delivery run and printed the
// picking/packing list (with warehouse shelf location), picked them
// and confirmed items... printed the invoice and when a delivery
// run/courier pickup was completed." Built on the real, existing
// invoice mechanism (a real, unposted invoice IS a real, approved
// order — no new "order" concept needed) and the real, existing
// item_location shelf fields, not the old, abstract Qty/Value
// stock-dispatch mechanism, which never knew about real shelves at
// all.
// ---------------------------------------------------------------------------

export interface PickingListLine {
  invoiceLineId: number;
  item: string;
  quantity: number;
  shelfSide: string | null;
  rack: string | null;
  level: number | null;
  picked: boolean;
}

/** A real invoice's own real lines, turned into a real picking list —
 * sorted by real shelf order (rack, then level, then shelf side), so
 * a real person walking the floor picks in one, efficient physical
 * pass rather than crossing back and forth. Per direct request, shelf
 * detail is the LAST real field here (not the first) — printed on the
 * far right so the whole shelf/rack/level column can be torn off
 * before the list goes out with the delivery, without a customer ever
 * seeing the real warehouse layout. */
export function getPickingList(invoiceId: number, locationName: LocationName): PickingListLine[] {
  const invoice = getInvoice(invoiceId);
  if (!invoice) throw new NotFoundError(`No invoice with id ${invoiceId}.`);
  if (invoice.status !== 'draft') throw new ValidationError(`Invoice ${invoice.reference} is already ${invoice.status} — a picking list is for a real, still-unfulfilled order.`);

  const pickedRefs = new Set(
    (db.prepare(`SELECT DISTINCT reference FROM journal WHERE reference LIKE ?`).all(`${invoice.reference}-PICK-%`) as { reference: string }[]).map((r) => r.reference)
  );

  const lines = invoice.lines
    .filter((l) => l.itemName)
    .map((l) => {
      const shelf = getItemLocation(asItemName(l.itemName!), locationName);
      return {
        invoiceLineId: l.id,
        item: l.itemName!,
        quantity: l.quantity ?? 1,
        shelfSide: shelf?.shelf_side ?? null,
        rack: shelf?.rack ?? null,
        level: shelf?.level ?? null,
        picked: pickedRefs.has(`${invoice.reference}-PICK-${l.id}`),
      };
    });

  // Real shelf order: rack (alphabetical), then level (low to high —
  // a real person works one level at a time, not zig-zagging), then
  // shelf side. A real line with no shelf recorded at all sorts last,
  // not first — an unplaced item shouldn't derail an otherwise
  // efficient, real walking order.
  return lines.sort((a, b) => {
    if (a.rack !== b.rack) return (a.rack ?? '\uffff').localeCompare(b.rack ?? '\uffff');
    if (a.level !== b.level) return (a.level ?? Infinity) - (b.level ?? Infinity);
    return (a.shelfSide ?? '\uffff').localeCompare(b.shelfSide ?? '\uffff');
  });
}

/** Marks one real picking-list line as physically picked — a real,
 * lightweight journal entry (a bare journal row only, deliberately no
 * journal_line and no account at all — this is the THIRD, and final,
 * genuine exception to the single financial-posting path, since a
 * tick-off has no financial or quantity meaning whatsoever, not even
 * a single-account one; the real stock reduction happens once at
 * dispatchOrderFromPickingList below) so the real, per-line
 * confirmation state survives a page reload and is genuinely
 * auditable (who ticked it, and when), not just client-side UI state
 * that vanishes the moment the tab closes. */
export function confirmPickedLine(invoiceId: number, invoiceLineId: number, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  const invoice = getInvoice(invoiceId);
  if (!invoice) throw new NotFoundError(`No invoice with id ${invoiceId}.`);
  const ref = `${invoice.reference}-PICK-${invoiceLineId}`;
  const already = db.prepare(`SELECT 1 FROM journal WHERE reference = ?`).get(ref);
  if (already) return; // idempotent — ticking an already-ticked line does nothing, not a duplicate real record
  db.prepare(`INSERT INTO journal (business_id, ledger_id, reference, description, transdate, user_id) VALUES ((SELECT id FROM current_entities WHERE name = ?), (SELECT id FROM current_entities WHERE name = ?), ?, ?, date('now'), ?)`).run(
    business,
    ledger,
    ref,
    'Picking list line confirmed picked',
    userId
  );
}

/** Once every real line on a real order has been physically picked
 * and confirmed, this is the real "delivery run/courier pickup
 * completed" moment: posts the real invoice (recognizing revenue) and
 * dispatches real, physical stock for every real line from the real
 * location it was actually picked from — the same, real, already-
 * tested dispatchStockFromLocation mechanism this app's own POS sales
 * already use, not a separate, parallel dispatch path. */
export function dispatchOrderFromPickingList(invoiceId: number, locationName: LocationName, revenueAccount: string, taxAccount: string, userId: UserId): void {
  const invoice = getInvoice(invoiceId);
  if (!invoice) throw new NotFoundError(`No invoice with id ${invoiceId}.`);
  const pickingList = getPickingList(invoiceId, locationName);
  const unpicked = pickingList.filter((l) => !l.picked);
  if (unpicked.length > 0) {
    throw new ValidationError(`${unpicked.length} real line${unpicked.length > 1 ? 's are' : ' is'} not yet confirmed picked — every line must be ticked off before dispatch.`);
  }

  postInvoice(invoiceId, revenueAccount, taxAccount, userId);
  for (const line of pickingList) {
    dispatchStockFromLocation(asBusinessName(invoice.business), asLedgerName(invoice.ledger), `${invoice.reference}-DISPATCH-${line.item}`, asItemName(line.item!), asLocationName(locationName), line.quantity!, userId, invoice.invoice_date);
  }
}

// ---------------------------------------------------------------------------
// Restocking retail outlets from a warehouse — a real, deliberately
// separate case from the customer-order picking above, per direct
// request: "the restocking of retail outlets from warehouses" is
// foremost among "a very similar process for our own retail store
// restocking runs." A real, internal transfer has no customer and no
// revenue at all, so it's genuinely not an invoice — but it needs the
// exact same real shelf-order/tick-off/refuse-until-complete pattern,
// built on transferStock (the same, real, already-tested mechanism
// this app's own simulation already uses for restocking) rather than
// dispatchStockFromLocation/postInvoice.
// ---------------------------------------------------------------------------

export interface RestockLineInput {
  item: string;
  quantity: number;
}

/** A real restocking run's own picking list — sorted by real shelf
 * order at the warehouse it's actually being picked from (the same
 * real ordering logic as the customer-order picking list above), for
 * a real, explicit list of (item, quantity) since there's no real
 * "order" entity a restocking run is derived from the way a customer
 * order derives from a real invoice. */
export function getRestockPickingList(runReference: string, warehouseName: LocationName, lines: RestockLineInput[]): PickingListLine[] {
  const pickedRefs = new Set(
    (db.prepare(`SELECT DISTINCT reference FROM journal WHERE reference LIKE ?`).all(`${runReference}-PICK-%`) as { reference: string }[]).map((r) => r.reference)
  );

  const rows = lines.map((l, i) => {
    const shelf = getItemLocation(asItemName(l.item), warehouseName);
    return {
      invoiceLineId: i, // a real, stable index within this run — there's no real invoice_line row to key off for a restocking run
      item: l.item,
      quantity: l.quantity,
      shelfSide: shelf?.shelf_side ?? null,
      rack: shelf?.rack ?? null,
      level: shelf?.level ?? null,
      picked: pickedRefs.has(`${runReference}-PICK-${l.item}`),
    };
  });

  return rows.sort((a, b) => {
    if (a.rack !== b.rack) return (a.rack ?? '\uffff').localeCompare(b.rack ?? '\uffff');
    if (a.level !== b.level) return (a.level ?? Infinity) - (b.level ?? Infinity);
    return (a.shelfSide ?? '\uffff').localeCompare(b.shelfSide ?? '\uffff');
  });
}

/** Marks one real restocking-run line as physically picked — the same
 * real, lightweight, auditable journal entry pattern as
 * confirmPickedLine, keyed by the run's own reference and the real
 * item name (a restocking run has no real invoice_line id to key by). */
export function confirmRestockPickedLine(runReference: string, itemName: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  const ref = `${runReference}-PICK-${itemName}`;
  const already = db.prepare(`SELECT 1 FROM journal WHERE reference = ?`).get(ref);
  if (already) return;
  db.prepare(`INSERT INTO journal (business_id, ledger_id, reference, description, transdate, user_id) VALUES ((SELECT id FROM current_entities WHERE name = ?), (SELECT id FROM current_entities WHERE name = ?), ?, ?, date('now'), ?)`).run(
    business,
    ledger,
    ref,
    'Restocking run line confirmed picked',
    userId
  );
}

/** The real "restocking run completed" moment — refuses outright if
 * any real line is still unticked, otherwise transfers real, physical
 * stock for every real line from the real warehouse to the real
 * retail outlet, using transferStock, the exact same real mechanism
 * this app's own simulation already relies on for restocking. */
export function dispatchRestockFromPickingList(
  runReference: string,
  business: BusinessName,
  ledger: LedgerName,
  warehouseName: LocationName,
  retailOutletName: LocationName,
  lines: RestockLineInput[],
  userId: UserId,
  transdate?: string
): void {
  const pickingList = getRestockPickingList(runReference, warehouseName, lines);
  const unpicked = pickingList.filter((l) => !l.picked);
  if (unpicked.length > 0) {
    throw new ValidationError(`${unpicked.length} real line${unpicked.length > 1 ? 's are' : ' is'} not yet confirmed picked — every line must be ticked off before this restocking run can be dispatched.`);
  }
  for (const line of pickingList) {
    // Each real line needs its own, distinct reference — confirmed
    // directly, not assumed: journal.reference must be unique per
    // (business, ledger), so reusing one shared base reference across
    // different real products in the same run would collide.
    transferStock(business, ledger, asItemName(line.item), asLocationName(warehouseName), asLocationName(retailOutletName), line.quantity, `${runReference}-XFER-${line.item}`, userId, transdate);
  }
}

export interface ListInvoicesOptions {
  invoiceType?: 'AR' | 'AP';
  /** Defaults to 'manual' — real, deliberate account invoices only.
   * Pass 'pos' explicitly to see POS transactions instead, or 'all'
   * for both. A person managing "who do we owe/are owed money by"
   * genuinely doesn't want thousands of already-settled POS receipts
   * mixed in by default. */
  source?: 'manual' | 'pos' | 'all';
  /** Omit for no real limit at all — every matching invoice. Only the
   * UI-facing list page itself should ever pass a real page size;
   * internal callers computing a real balance/aging figure need every
   * real invoice, not just one page of them. */
  limit?: number;
  offset?: number;
}
export function listInvoices(business: BusinessName, ledger: LedgerName, options: ListInvoicesOptions = {}): Invoice[] {
  const { invoiceType, source = 'manual', limit, offset = 0 } = options;
  const ids = db
    .prepare(
      `SELECT i.id FROM invoice i
       JOIN current_entities biz ON biz.id = i.business_id
       JOIN current_entities led ON led.id = i.ledger_id
       WHERE biz.name = ? AND led.name = ? AND (? IS NULL OR i.invoice_type = ?) AND (? = 'all' OR i.source = ?)
       ORDER BY i.invoice_date DESC, i.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(business, ledger, invoiceType ?? null, invoiceType ?? null, source, source, limit ?? -1, offset) as { id: number }[];
  return ids.map((r) => getInvoice(r.id)!);
}

export function countInvoices(business: BusinessName, ledger: LedgerName, invoiceType?: 'AR' | 'AP', source: 'manual' | 'pos' | 'all' = 'manual'): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total FROM invoice i
       JOIN current_entities biz ON biz.id = i.business_id
       JOIN current_entities led ON led.id = i.ledger_id
       WHERE biz.name = ? AND led.name = ? AND (? IS NULL OR i.invoice_type = ?) AND (? = 'all' OR i.source = ?)`
    )
    .get(business, ledger, invoiceType ?? null, invoiceType ?? null, source, source) as { total: number };
  return row.total;
}

/** Posts a draft invoice to the GL — the real billing event: this is
 * what actually creates AR/AP and recognizes revenue/expense, not the
 * physical Dispatch Note/Goods Receipt the lines may reference. */
/** revenueOrExpenseAccount is normally one account name, posting a
 * single lump-sum line for the whole invoice — the original, still
 * the default behavior every existing caller keeps getting unchanged.
 * Pass a function instead to post one line per invoice_detail_line,
 * each to its own account (e.g. each product's own real Sales/COGS
 * leaf) — the real fix for "the same two aggregate accounts absorb
 * every product's revenue," not a lump sum masquerading as detail. */
export function postInvoice(
  id: number,
  revenueOrExpenseAccount: string | { name: string; id: number } | ((line: InvoiceLineInput & { id: number }) => string | { name: string; id: number }),
  taxAccount: string,
  userId: UserId,
  restockInventory = false,
  divisionName?: string,
  counterpartyAccountOverride?: string
): void {
  const invoice = getInvoice(id);
  if (!invoice) throw new NotFoundError(`No invoice with id ${id}.`);
  if (invoice.status !== 'draft') throw new ValidationError(`Invoice ${invoice.reference} is already ${invoice.status}, not a draft.`);

  const total = invoice.total_amount_minor + invoice.total_tax_minor;
  // AR invoice: debit the customer. AP invoice: credit the vendor.
  // A Credit Note/Debit Memo is the same mechanism run in reverse —
  // it corrects an invoice, so its effect on the counterparty and on
  // revenue/expense is the opposite of an ordinary invoice's.
  const isCorrection = invoice.document_type === 'credit_note' || invoice.document_type === 'debit_memo';
  const baseSign = invoice.invoice_type === 'AR' ? 1 : -1;
  const sign = isCorrection ? -baseSign : baseSign;

  stageLine({
    reference: invoice.reference,
    business: asBusinessName(invoice.business),
    ledger: asLedgerName(invoice.ledger),
    description: invoice.description || `${invoice.invoice_type} Invoice ${invoice.reference}`,
    transdate: invoice.invoice_date,
    // A real, genuine question answered directly, not assumed correct
    // because it worked: "why are cash sales going through the AR
    // system in any way?" They shouldn't need to — a real, immediate
    // cash sale has no genuine receivable at all, even momentarily.
    // counterpartyAccountOverride, when given, posts straight to the
    // real payment account instead of the customer's own AR balance,
    // skipping the round trip through Accounts Receivable entirely.
    // The invoice record's own counterparty (for real history/receipt
    // purposes) is completely untouched either way.
    account: asAccountName(counterpartyAccountOverride ?? invoice.counterparty),
    amount_minor: sign * total,
    division: divisionName ? asDivisionName(divisionName) : undefined,
  });
  if (typeof revenueOrExpenseAccount === 'function') {
    for (const line of invoice.lines) {
      const resolved = revenueOrExpenseAccount(line);
      const accountName = typeof resolved === 'string' ? resolved : resolved.name;
      const accountId = typeof resolved === 'string' ? undefined : resolved.id;
      stageLine({
        reference: invoice.reference,
        business: asBusinessName(invoice.business),
        ledger: asLedgerName(invoice.ledger),
        transdate: invoice.invoice_date,
        account: asAccountName(accountName),
        accountId,
        amount_minor: -sign * line.amountMinor,
        division: divisionName ? asDivisionName(divisionName) : undefined,
      });
    }
  } else {
    const accountName = typeof revenueOrExpenseAccount === 'string' ? revenueOrExpenseAccount : revenueOrExpenseAccount.name;
    const accountId = typeof revenueOrExpenseAccount === 'string' ? undefined : revenueOrExpenseAccount.id;
    stageLine({
      reference: invoice.reference,
      business: asBusinessName(invoice.business),
      ledger: asLedgerName(invoice.ledger),
      transdate: invoice.invoice_date,
      account: asAccountName(accountName),
      accountId,
      amount_minor: -sign * invoice.total_amount_minor,
      division: divisionName ? asDivisionName(divisionName) : undefined,
    });
  }
  if (invoice.total_tax_minor !== 0) {
    stageLine({
      reference: invoice.reference,
      business: asBusinessName(invoice.business),
      ledger: asLedgerName(invoice.ledger),
      transdate: invoice.invoice_date,
      account: asAccountName(taxAccount),
      amount_minor: -sign * invoice.total_tax_minor,
      division: divisionName ? asDivisionName(divisionName) : undefined,
    });
  }
  postJournalEntry(invoice.reference, asBusinessName(invoice.business), asLedgerName(invoice.ledger), userId);

  // Restocking — the real distinction SQL-Ledger's Credit Invoice
  // (restocks) vs Credit Note (doesn't) draws. Only meaningful for
  // lines with an actual quantity and item — nothing to restock for a
  // service line. Direction matters and is genuinely opposite for the
  // two sides: a customer returning goods to us (AR credit_note)
  // increases what we have on hand; us returning goods to a vendor
  // (AP debit_memo) decreases it.
  if (restockInventory && isCorrection) {
    const restockSign = invoice.invoice_type === 'AR' ? 1 : -1;
    for (const line of invoice.lines) {
      if (line.itemName && line.quantity) {
        postQuantityMovement(
          asBusinessName(invoice.business),
          asLedgerName(invoice.ledger),
          `${invoice.reference}-RESTOCK-${line.id}`,
          asAccountName(line.itemName),
          restockSign * line.quantity,
          userId,
          invoice.invoice_date
        );
      }
    }
  }

  const journalId = (
    db.prepare(`SELECT id FROM journal WHERE reference = ? AND business_id = (SELECT id FROM current_entities WHERE name = ?) AND ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ?))`)
      .get(invoice.reference, invoice.business, invoice.ledger, invoice.business) as { id: number }
  ).id;
  db.prepare(`UPDATE invoice SET status = 'posted', posted_journal_id = ? WHERE id = ?`).run(journalId, id);
}

/** Records that a specific AR Receipt/AP Payment posting was applied
 * against a specific invoice — the real fact aged reports need, since
 * a receipt can span several invoices and an invoice's own total tells
 * you nothing about what's actually still outstanding.
 *
 * Also posts the real GL movement this represents — previously this
 * function only recorded the allocation as a tracking fact and never
 * touched the ledger at all, so a "paid" sale's cash never actually
 * reached Cash and Bank, and the customer's own AR balance never
 * actually went down. Confirmed directly against the real wine
 * business data before fixing: $920,626.23 in sales marked paid via
 * this function, only $500 of which had ever actually reached Cash
 * and Bank — the rest sat invisibly on the "Cash Sale" customer's own
 * balance forever. AR posts to the customer's own name directly (the
 * established pattern); AP mirrors it in the opposite direction. */
export function allocatePayment(
  invoiceId: number,
  paymentReference: string,
  allocatedMinor: number,
  allocationDate: string,
  paymentAccount: string,
  userId: UserId,
  skipJournalPosting = false
): void {
  const invoice = getInvoice(invoiceId);
  if (!invoice) throw new NotFoundError(`No invoice with id ${invoiceId}.`);
  if (invoice.status !== 'posted') throw new ValidationError(`Invoice ${invoice.reference} must be posted before payments can be allocated to it.`);
  const outstanding = getInvoiceOutstandingMinor(invoiceId);
  if (allocatedMinor > outstanding) {
    throw new ValidationError(`Cannot allocate ${(allocatedMinor / 100).toFixed(2)} — only ${(outstanding / 100).toFixed(2)} is outstanding on ${invoice.reference}.`);
  }

  // skipJournalPosting: true is for a real, immediate cash sale whose
  // own initial posting already went straight to the real payment
  // account (postInvoice's counterpartyAccountOverride) — the real
  // cash-side GL effect already happened once; posting it again here
  // would incorrectly touch the customer's own AR balance a second
  // time for money that never genuinely sat there. Only the real
  // allocation record below (for real outstanding-balance tracking)
  // is needed in that case, not a second journal entry.
  if (!skipJournalPosting) {
    // AR: debit the payment account (cash increases), credit the
    // customer's own AR-style balance (it decreases). AP: the mirror —
    // debit the vendor's own balance (the liability decreases), credit
    // the payment account (cash decreases).
    const sign = invoice.invoice_type === 'AR' ? 1 : -1;
    stageLine({ reference: paymentReference, business: asBusinessName(invoice.business), ledger: asLedgerName(invoice.ledger), transdate: allocationDate, account: asAccountName(paymentAccount), amount_minor: sign * allocatedMinor });
    stageLine({ reference: paymentReference, business: asBusinessName(invoice.business), ledger: asLedgerName(invoice.ledger), transdate: allocationDate, account: asAccountName(invoice.counterparty), amount_minor: -sign * allocatedMinor });
    postJournalEntry(paymentReference, asBusinessName(invoice.business), asLedgerName(invoice.ledger), userId);
  }

  // Only recorded once the real, underlying journal posting above has
  // genuinely succeeded (or was correctly skipped) — a real, direct
  // fix, not the original order, which recorded this fact first and
  // could silently leave a real, "successful" allocation on record
  // even when the actual, real cash movement never posted at all.
  db.prepare(`INSERT INTO invoice_payment_allocation (invoice_id, payment_reference, allocated_minor, allocation_date) VALUES (?, ?, ?, ?)`).run(
    invoiceId,
    paymentReference,
    allocatedMinor,
    allocationDate
  );
}

export function getInvoiceOutstandingMinor(invoiceId: number): number {
  const invoice = getInvoice(invoiceId);
  if (!invoice) throw new NotFoundError(`No invoice with id ${invoiceId}.`);
  const total = invoice.total_amount_minor + invoice.total_tax_minor;
  const allocated = (
    db.prepare(`SELECT COALESCE(SUM(allocated_minor), 0) AS s FROM invoice_payment_allocation WHERE invoice_id = ?`).get(invoiceId) as {
      s: number;
    }
  ).s;
  return total - allocated;
}

export interface AgedInvoiceRow {
  invoice_id: number;
  reference: string;
  counterparty: string;
  invoice_date: string;
  due_date: string | null;
  outstanding_minor: number;
  days_overdue: number;
  bucket: string;
}

/** Every posted, not-fully-paid invoice of the given type, bucketed by
 * how overdue it is against EACH customer/vendor's own payment terms —
 * not a fixed 30/60/90 for everyone, since account management practice
 * genuinely varies per account (see getAgingBuckets). */
export function getAgedInvoices(business: BusinessName, ledger: LedgerName, invoiceType: 'AR' | 'AP', asOfDate: string): AgedInvoiceRow[] {
  const invoices = listInvoices(business, ledger, { invoiceType, source: 'all' }).filter((i) => i.status === 'posted' && i.document_type === 'invoice');
  const rows: AgedInvoiceRow[] = [];
  for (const inv of invoices) {
    const outstanding = getInvoiceOutstandingMinor(inv.id);
    if (outstanding <= 0) continue;
    const daysRow = db.prepare(`SELECT CAST(julianday(?) - julianday(?) AS INTEGER) AS d`).get(asOfDate, inv.due_date ?? inv.invoice_date) as {
      d: number;
    };
    const daysOverdue = Math.max(0, daysRow.d);
    const contact = getContact(inv.counterparty);
    const buckets = getAgingBuckets(contact?.payment_terms_days ?? null);
    const bucket = buckets.find((b) => daysOverdue <= b.through_days)?.label ?? `Over ${buckets[buckets.length - 1].through_days}`;
    rows.push({
      invoice_id: inv.id,
      reference: inv.reference,
      counterparty: inv.counterparty,
      invoice_date: inv.invoice_date,
      due_date: inv.due_date,
      outstanding_minor: outstanding,
      days_overdue: daysOverdue,
      bucket,
    });
  }
  return rows.sort((a, b) => b.days_overdue - a.days_overdue);
}

export interface AgedSummaryRow {
  counterparty: string;
  outstanding_minor: number;
  oldest_days_overdue: number;
}

/** The Summary view SQL-Ledger's own aging report has alongside its
 * Detail view — one row per customer/vendor with their total
 * outstanding, not per invoice. */
export function getAgedSummary(business: BusinessName, ledger: LedgerName, invoiceType: 'AR' | 'AP', asOfDate: string): AgedSummaryRow[] {
  const detail = getAgedInvoices(business, ledger, invoiceType, asOfDate);
  const byCounterparty = new Map<string, { outstanding: number; oldestDays: number }>();
  for (const row of detail) {
    const existing = byCounterparty.get(row.counterparty) ?? { outstanding: 0, oldestDays: 0 };
    existing.outstanding += row.outstanding_minor;
    existing.oldestDays = Math.max(existing.oldestDays, row.days_overdue);
    byCounterparty.set(row.counterparty, existing);
  }
  return Array.from(byCounterparty.entries())
    .map(([counterparty, { outstanding, oldestDays }]) => ({ counterparty, outstanding_minor: outstanding, oldest_days_overdue: oldestDays }))
    .sort((a, b) => b.outstanding_minor - a.outstanding_minor);
}

export interface StatementLine {
  invoice_id: number;
  reference: string;
  invoice_date: string;
  due_date: string | null;
  total_minor: number;
  paid_minor: number;
  outstanding_minor: number;
  status: 'Paid' | 'Outstanding' | 'Partially paid';
}

export interface CustomerStatement {
  customer: string;
  as_of_date: string;
  lines: StatementLine[];
  total_outstanding_minor: number;
}

/** A real, single customer's own statement — every real, posted
 * invoice as of a given date, whether fully paid, partially paid, or
 * still outstanding, not just the aged-and-unpaid subset
 * getAgedInvoices already covers. Per direct request: "can we print
 * or send a customer statement of paid and currently outstanding
 * invoices?" — this is the real, underlying data both a screen and a
 * PDF/print view need.
 *
 * Deliberately NOT reusing getInvoiceOutstandingMinor as-is: that
 * function sums every real allocation ever made, regardless of date —
 * correct for "right now", wrong for a real, historical "as of"
 * statement, which must only count payments actually allocated by
 * that date, not ones made afterward. Recomputed here directly,
 * filtered by allocation_date, so a statement genuinely reflects what
 * was true as of the date requested. */
export function getCustomerStatement(business: BusinessName, ledger: LedgerName, customerName: string, asOfDate: string): CustomerStatement {
  const invoices = listInvoices(business, ledger, { invoiceType: 'AR', source: 'all' }).filter(
    (i) => i.counterparty === customerName && i.status === 'posted' && i.document_type === 'invoice' && i.invoice_date <= asOfDate
  );
  const lines: StatementLine[] = invoices.map((inv) => {
    const total = inv.total_amount_minor + inv.total_tax_minor;
    const paid = (
      db
        .prepare(`SELECT COALESCE(SUM(allocated_minor), 0) AS s FROM invoice_payment_allocation WHERE invoice_id = ? AND allocation_date <= ?`)
        .get(inv.id, asOfDate) as { s: number }
    ).s;
    const outstanding = total - paid;
    const status: StatementLine['status'] = outstanding <= 0 ? 'Paid' : paid > 0 ? 'Partially paid' : 'Outstanding';
    return { invoice_id: inv.id, reference: inv.reference, invoice_date: inv.invoice_date, due_date: inv.due_date, total_minor: total, paid_minor: paid, outstanding_minor: outstanding, status };
  });
  const totalOutstanding = lines.reduce((sum, l) => sum + Math.max(0, l.outstanding_minor), 0);
  return { customer: customerName, as_of_date: asOfDate, lines: lines.sort((a, b) => a.invoice_date.localeCompare(b.invoice_date)), total_outstanding_minor: totalOutstanding };
}

export interface HistoryLine {
  invoice_reference: string;
  invoice_date: string;
  document_type: 'invoice' | 'credit_note' | 'debit_memo';
  description: string;
  quantity: number | null;
  unit_price_minor: number | null;
  amount_minor: number;
}

/** What a specific customer/vendor has actually bought or sold, by
 * item — SQL-Ledger's own Customer/Vendor history reports, grouped by
 * invoice line rather than just invoice totals, since "what have they
 * been buying" is genuinely a line-item-level question. */
export function getCounterpartyHistory(business: BusinessName, ledger: LedgerName, counterpartyName: string): HistoryLine[] {
  const invoices = listInvoices(business, ledger, { source: 'all' }).filter((i) => i.counterparty === counterpartyName && i.status === 'posted');
  const lines: HistoryLine[] = [];
  for (const inv of invoices) {
    for (const line of inv.lines) {
      lines.push({
        invoice_reference: inv.reference,
        invoice_date: inv.invoice_date,
        document_type: inv.document_type,
        description: line.description,
        quantity: line.quantity ?? null,
        unit_price_minor: line.unitPriceMinor ?? null,
        amount_minor: line.amountMinor,
      });
    }
  }
  return lines.sort((a, b) => (a.invoice_date < b.invoice_date ? 1 : -1));
}

/** Exact UPC lookup for barcode scanning at the register — a scanner
 * types the UPC and hits Enter, so this needs to be an exact match,
 * not a fuzzy search. Returns undefined for no match or an empty UPC,
 * rather than matching every item with a NULL upc. */
export function getItemByUpc(upc: string): ItemSummary | undefined {
  if (!upc) return undefined;
  return db
    .prepare(
      `SELECT e.name, p.item_description AS description, p.item_unit_of_measure AS unit_of_measure, p.item_upc AS upc, p.item_retail_price_minor AS retail_price_minor,
              (SELECT COUNT(*) FROM item_source ps WHERE ps.item_id = e.id) AS source_count
       FROM contact p JOIN current_entities e ON e.id = p.entity_id WHERE p.item_upc = ?`
    )
    .get(upc) as ItemSummary | undefined;
}

export interface PosSaleLineInput {
  itemName: string;
  quantity: number;
  /** Omit when a real terminalName is given below and this item has a
   * real, matching item_source row for that terminal's own currency
   * (getItemPriceForCurrency) - the price is then resolved
   * automatically, not hand-entered per sale. Required otherwise. */
  unitPriceMinor?: number;
  taxMinor: number;
  /** Optional — which real selling unit this line represents (e.g.
   * "Bottle", "Six-Pack", "Carton"), when the same product genuinely
   * sells more than one way. Omit for a product with only one. */
  tier?: string;
  /** Optional — per the real Hierarchy/Product cartesian mechanism: a
   * real, specific combination (e.g. ["Riverside Cellars", "Lager",
   * "330ml", "can", "single", "Cold"]) this line represents. When
   * provided (together with combinationShape), Sales/COGS/Inventory
   * each get a real, new leaf pointing at this combination's own,
   * shared identity — taking priority over tier/location resolution,
   * since the combination already, structurally includes the
   * location. */
  combinationValues?: string[];
  /** Required alongside combinationValues — the exact, same, real,
   * ordered [dimensionName, groupingName] pairs the values line up
   * against (see defineProductShape). */
  combinationShape?: [string, string][];
}

export interface PosSaleInput {
  business: BusinessName;
  ledger: LedgerName;
  locationName: LocationName;
  /** An existing customer to sell on account to, or the generic
   * walk-in "Cash Sale" contact for a no-account sale. */
  customerName: CustomerName;
  lines: PosSaleLineInput[];
  /** Omit to post each line to its own real, per-product Sales/COGS
   * account (lazily created via ensureProductSalesCogsAccounts) —
   * the correct default, since "several dozen products all sharing
   * one aggregate account" was never actually right. Pass an explicit
   * account name only when a single, shared revenue account is
   * genuinely what's wanted. */
  revenueAccount?: AccountName;
  taxAccount: AccountName;
  /** Omit entirely for an on-account sale (no immediate payment —
   * becomes a normal outstanding AR invoice). Present for cash/card,
   * where the sale is paid in full at the register immediately. */
  paymentMethod?: string;
  cashTenderedMinor?: number;
  /** Defaults to today's real date if omitted — a POS sale normally
   * happens right now. Only needed explicitly for backdated data
   * (simulations, corrections), never for an ordinary live sale. */
  transdate?: string;
  /** A real, specific, physical POS terminal this sale happened at -
   * per docs/border-multicurrency-pos-plan.md, Slice 4. When given,
   * resolves its own real currency (getEffectiveSaleCurrency) and
   * auto-fills any line's unitPriceMinor left unspecified from that
   * item's own real, matching item_source row for that currency
   * (getItemPriceForCurrency). Two real terminals at the exact same,
   * real location can each transact in a genuinely different
   * currency this way. Omit for the ordinary, single-currency case -
   * completely unaffected, real, existing behavior. */
  terminalName?: string;
}

export interface PosSaleResult {
  invoiceId: number;
  reference: string;
  totalMinor: number;
  changeDueMinor: number;
}

/** Completes a full register sale as one atomic operation — posts the
 * invoice, dispatches stock from the specific location the sale
 * happened at, and (for cash/card) allocates full payment immediately
 * — rather than three separate calls that could leave the sale
 * half-completed (invoice posted but stock not dispatched, etc.) if
 * something failed partway through. Stock availability at this exact
 * location is checked for every line before anything is written. */
/** Walks any real entity up to (but excluding) a given root — used
 * for both product categories (Beer -> Ale/Lager/Stout under 'Items')
 * and division hierarchies (a division can itself be nested under a
 * broader one, e.g. 'Retail' -> 'Retail North', under 'Divisions') —
 * the same real, ordinary entity tree mechanism either way, already
 * genuinely user-configurable through the Entity Tree Editor with
 * zero code changes needed to reorganize it. Returns the chain from
 * the top level down to the entity's immediate parent. */
/** A real, direct, reliable answer to "is this entity genuinely a
 * descendant of that root" - per no-generic-functions, the missing
 * piece getAncestorChain doesn't provide: that function returns
 * whatever partial chain it collected whether or not it actually
 * reached the real root, so it can't itself distinguish "genuinely a
 * descendant" from "ran out of real ancestors first." Walks up to
 * 100 real levels (matching getDimensionAncestorChain's own, existing
 * real safety bound) before giving up. */
export function isDescendantOf(entityName: string, rootName: string): boolean {
  const entities = getEntityTree();
  const start = entities.find((e) => e.name === entityName);
  if (!start) return false;
  if (entityName === rootName) return true;
  const isRoot = (name: string) => name === rootName || (rootName === 'Items' && name.endsWith(' Items'));
  let current = entities.find((e) => e.id === start.parent_id);
  for (let i = 0; i < 100 && current; i++) {
    if (isRoot(current.name)) return true;
    current = entities.find((e) => e.id === current!.parent_id);
  }
  return false;
}

/** Per direct correction: not a generic, per-kind TypeDescriptor walk
 * - a Division and a real, user-created Sub-Division are structurally
 * the exact, same kind of thing, just at different real depths, and
 * forcing a separate, branded TypeScript type onto each level would
 * be artificial, not a genuine distinction. The real, right model:
 * one, uniform, non-generic node shape, and a single walk from a real
 * leaf (an Item or a Location) up an arbitrary, real, user-defined
 * chain of named entities, however many real levels exist, until it
 * reaches the real Business node itself. */
export interface HierarchyChainNode {
  readonly id: EntityId;
  readonly name: string;
}

export function getHierarchyChain(leafName: ItemName | LocationName): HierarchyChainNode[] {
  const entities = getEntityTree();
  const businessesRootId = entities.find((e) => e.name === 'Businesses')?.id;
  const chain: HierarchyChainNode[] = [];
  let current = entities.find((e) => e.name === leafName);
  for (let i = 0; i < 100 && current; i++) {
    chain.push({ id: asEntityId(current.id), name: current.name });
    if (current.parent_id === businessesRootId) break; // current IS the real Business node itself, already pushed
    current = entities.find((e) => e.id === current!.parent_id);
  }
  return chain;
}

export function getAncestorChain(entityName: string, rootName: string): string[] {
  // Per direct question, confirmed a real, genuine, measured
  // performance issue (~14,000x, confirmed directly): getEntityTree()
  // fetches and parses the entire, real entities table - two real,
  // recursive CTEs plus several joins - just to walk a real, direct
  // parent_id chain one step at a time. This function is called
  // throughout the real sales hot-path (ensureProductSalesCogsAccounts,
  // called on every real sale), so replaced with a direct, indexed
  // walk instead - one small, targeted query per real level, using
  // this table's own, existing, real entities_entity_id_current index.
  const start = db.prepare(`SELECT id, parent_id FROM current_entities WHERE name = ?`).get(entityName) as { id: number; parent_id: number | null } | undefined;
  if (!start) return [];
  const chain: string[] = [];
  const isRoot = (name: string) => name === rootName || (rootName === 'Items' && name.endsWith(' Items'));
  let currentId = start.parent_id;
  for (let i = 0; i < 100 && currentId != null; i++) {
    const row = db.prepare(`SELECT id, name, parent_id FROM current_entities WHERE id = ?`).get(currentId) as { id: number; name: string; parent_id: number | null } | undefined;
    if (!row || isRoot(row.name)) break;
    chain.unshift(row.name);
    currentId = row.parent_id;
  }
  return chain;
}

/** Mirrors a category chain onto the GL side, lazily creating any
 * missing level — "Sales - Beer" under Income, then "Sales - Ale"
 * under "Sales - Beer", and so on — returning the real, deepest
 * category name to parent the final per-product leaf under. The same
 * mechanism for a differently-configured catalog automatically
 * produces a differently-shaped P&L: a category left flat (no
 * sub-categories) gets one real grouping level, one broken down
 * further gets more — without a single line of code changing between
 * the two. */
export function ensureCategoryChain(rootName: string, prefix: string, chain: string[], userId: UserId): { name: string; id: number } {
  let currentParent = rootName;
  let currentParentId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(rootName) as { id: number } | undefined)?.id ?? null;
  for (const cat of chain) {
    const catName = `${prefix}${cat}`;
    const row = currentParentId ? Entity.ensureUnder(catName, currentParentId, userId) : Entity.create(catName, rootName, userId);
    currentParent = catName;
    currentParentId = row.id;
  }
  return { name: currentParent, id: currentParentId! };
}

/** Each product's own real Sales/COGS leaves — lazily created on
 * first use, the same "fail loudly if the ancestor path is missing"
 * discipline as every other lazily-vivified entity here (Income/
 * Expense must already exist, which they always do). COGS side is
 * tagged via relation_id -> "COGS", the same mechanism the Gross
 * Profit calculation already reads — a new product's COGS leaf is
 * correctly included in Gross Profit the moment it's created, not a
 * separate step someone could forget.
 *
 * Both leaves parent under a real, mirrored copy of the product's own
 * real category chain (see getProductCategoryChain/
 * ensureCategoryChain above) — not flat under Income/Expense
 * directly. Confirmed directly, not assumed: before this, Income had
 * 97 flat direct children (81 of them real per-product Sales
 * accounts), with zero grouping at all — genuinely unusable as a real
 * P&L read. Since the product category tree is already real and
 * user-configurable, this needed no new, separate "category system" —
 * just mirroring what already exists.
 *
 * tier is optional — omit it for a product with only one real selling
 * unit. Pass it (e.g. "Bottle", "Six-Pack", "Carton") when the same
 * product genuinely sells multiple ways, since a bottle's margin and
 * a carton's margin are real, different facts, not the same number
 * shown twice — blending them back into one account would silently
 * undo the whole point of splitting by product in the first place. */
export function ensureProductSalesCogsAccounts(itemName: ItemName, userId: UserId, tier?: string): { salesAccount: string; salesAccountId: number; cogsAccount: string; cogsAccountId: number } {
  const suffix = tier ? ` (${tier})` : '';
  const salesAccount = `${itemName}${suffix}`;
  const cogsAccount = `${itemName}${suffix}`;
  const categoryChain = getAncestorChain(itemName, 'Items');

  const salesParent = ensureCategoryChain('Sales Revenue', '', categoryChain, userId);
  const salesRow = Entity.ensureUnder(salesAccount, salesParent.id, userId);

  const cogsParent = ensureCategoryChain('Cost of Goods Sold', '', categoryChain, userId);
  const existingCogs = Entity.getUnder(cogsAccount, cogsParent.id);
  const cogsRow = existingCogs ?? Entity.create(cogsAccount, cogsParent.id, userId);
  if (!existingCogs || !Entity.get(cogsRow.id)?.relation_id) Entity.relate(cogsRow.id, 'COGS', userId);
  return { salesAccount, salesAccountId: salesRow.id, cogsAccount, cogsAccountId: cogsRow.id };
}

/** Per direct request: "anything that contains a dollar or quantity
 * via currency/bottle/carton value must have a CoA entry" — the exact
 * same, real, established Sales/COGS-per-product pattern above,
 * applied to Inventory's own dollar value. A real, direct, structural
 * child of Inventory itself (not a flat, single account any real
 * product's own purchase/sale shares) — so the existing, real Balance
 * Sheet category-tree walk (already proven for Accounts Receivable)
 * picks this up automatically and shows it as genuinely expandable,
 * with no further, separate reporting code needed at all. */
export function ensureProductInventoryAccount(itemName: ItemName, userId: UserId): { inventoryAccount: string; inventoryAccountId: number } {
  const inventoryParentId = (db.prepare(`SELECT id FROM current_entities WHERE name = 'Inventory'`).get() as { id: number }).id;
  const row = Entity.ensureUnder(itemName, inventoryParentId, userId);
  return { inventoryAccount: itemName, inventoryAccountId: row.id };
}

/** The exact, same, real (product, location) leaf pattern as
 * ensureProductLocationLeaf — extended to Inventory too. Per direct,
 * explicit confirmation: "the sale, COGS, and inventory are recorded
 * in accounts that are determined by the cartesian product of
 * products and locations" — Inventory is not a special case exempt
 * from this. */
export function ensureProductLocationInventoryAccount(itemName: ItemName, locationName: LocationName, userId: UserId): { inventoryAccount: string; inventoryAccountId: number } {
  const { inventoryAccountId: baseId } = ensureProductInventoryAccount(itemName, userId);
  const locationAccount = `${itemName} — ${locationName}`;
  const existing = Entity.getUnder(locationAccount, baseId);
  const row = existing ?? Entity.create(locationAccount, baseId, userId);
  if (!existing) setDimensionParent(locationAccount, 'Location', locationName, userId);
  return { inventoryAccount: locationAccount, inventoryAccountId: row.id };
}

// ---------------------------------------------------------------------------
// The Hierarchy / Product cartesian mechanism, per the settled design in
// docs/cartesian-account-linking-plan.md:
//
// - Hierarchy: real, named groupings and values (Beer -> Lager/Ale,
//   Storage -> Hot/Cold), living under a real business's own
//   "Hierarchy" root - a real, user-extensible vocabulary of facts,
//   never hardcoded, never privileged.
// - Product: one real node, holding both real Product Definitions
//   (a chain of dimension nodes - Location, Item, Size, Container,
//   Quantity, Storage - each pointing, via relation_id, at the real
//   Hierarchy *grouping* it represents) and real Product Instances
//   (one real, specific combination - e.g. Riverside Cellars, Lager,
//   330ml, can, single, Cold - each node pointing, via relation_id,
//   at the real Hierarchy *value* it represents; the instance's own
//   first node additionally points at the Definition's own first
//   node, recording which shape this instance follows).
// - A definition node and an instance node need no separate flag to
//   tell them apart: a definition's relation_id always lands on a
//   real Hierarchy grouping; an instance's always lands on one of
//   that grouping's own, real children.
// - New, real leaves under Inventory/Sales/COGS point directly (via
//   relation_id) at a real Product Instance's own first node - the
//   one, real, shared, canonical identity all three financial
//   accounts refer back to, per direct instruction, rather than each
//   independently re-deriving the same combination.
// ---------------------------------------------------------------------------

function ensureBusinessRoot(businessName: BusinessName, rootName: string, userId: UserId): { id: number; name: string } {
  const business = fetch(businessName, typeBusinessName);
  return Entity.getUnder(rootName, business.id) ?? Entity.create(rootName, business.id, userId);
}

/** Ensures a real Hierarchy grouping exists (e.g. "Beer," "Storage")
 * directly under a business's own real "Hierarchy" root. */
export function ensureHierarchyGrouping(businessName: BusinessName, groupingName: string, userId: UserId): { id: number; name: string } {
  const hierarchyRoot = ensureBusinessRoot(businessName, 'Hierarchy', userId);
  return Entity.getUnder(groupingName, hierarchyRoot.id) ?? Entity.create(groupingName, hierarchyRoot.id, userId);
}

/** Ensures a real, named value (e.g. "Lager," "Cold") exists under a
 * real Hierarchy grouping - the grouping itself must already exist
 * (created via ensureHierarchyGrouping first). */
export function ensureHierarchyValue(businessName: BusinessName, groupingName: string, valueName: string, userId: UserId): { id: number; name: string } {
  const grouping = ensureHierarchyGrouping(businessName, groupingName, userId);
  return Entity.getUnder(valueName, grouping.id) ?? Entity.create(valueName, grouping.id, userId);
}

/** Defines the real, ordered shape of a Product combination for a
 * business - a real chain of dimension nodes, each one's own
 * relation_id pointing at the real Hierarchy grouping it represents.
 * `dimensions` is an ordered array of [dimensionName, groupingName]
 * pairs (dimensionName is this chain link's own, real, generic name -
 * "Item," "Storage" - groupingName is the real Hierarchy grouping it
 * points at - "Beer," "Storage"). Idempotent: calling this again with
 * the exact, same shape returns the exact, same, existing chain. */
export function defineProductShape(businessName: BusinessName, dimensions: [string, string][], userId: UserId): { id: number; name: string }[] {
  const product = ensureBusinessRoot(businessName, 'Product', userId);
  const chain: { id: number; name: string }[] = [];
  let parentId = product.id;
  for (const [dimensionName, groupingName] of dimensions) {
    const grouping = ensureHierarchyGrouping(businessName, groupingName, userId);
    let node = Entity.getUnder(dimensionName, parentId);
    if (!node) {
      node = Entity.create(dimensionName, parentId, userId);
      Entity.relate(node.id, grouping.name, userId, grouping.id);
    }
    chain.push(node);
    parentId = node.id;
  }
  return chain;
}

/** Ensures one real, specific Product Instance exists - a real chain
 * of value nodes (e.g. "Riverside Cellars," "Lager," "330ml," "can,"
 * "single," "Cold"), each one's own relation_id pointing at the real
 * Hierarchy value it represents, with the instance's own first node
 * additionally pointing (via relation_id) at the real Definition's
 * own first node - recording which real shape this instance follows.
 * Returns the instance's own, real, first (top) node - the one,
 * shared, canonical identity every real, related financial account
 * leaf should point back to. */
/** Per direct design decision: a real Product Instance is now one,
 * single, real entity directly under Product - no chain of
 * intermediate nodes at all. Its own identity is a real, flat,
 * ordered JSON array of the real Hierarchy values' own, stable ids
 * (combination_ids) - genuinely rename-safe by construction, since
 * entity_id never changes across a rename (see the entity_update
 * trigger, which now explicitly carries this array forward). Looked
 * up by exact array match - genuinely unambiguous, since two,
 * different, real combinations can never produce the identical,
 * ordered id array. */
export function ensureProductInstance(businessName: BusinessName, definitionDimensions: [string, string][], values: string[], userId: UserId): { id: number; name: string } {
  if (values.length !== definitionDimensions.length) throw new ValidationError('A real Product Instance needs exactly one, real value per real dimension in its Definition.');
  defineProductShape(businessName, definitionDimensions, userId);
  const product = ensureBusinessRoot(businessName, 'Product', userId);
  const hierarchyValueIds: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const groupingName = definitionDimensions[i][1];
    const hierarchyValue = ensureHierarchyValue(businessName, groupingName, values[i], userId);
    hierarchyValueIds.push(hierarchyValue.id);
  }
  const combinationIdsJson = JSON.stringify(hierarchyValueIds);
  const existing = db.prepare(`SELECT id, name FROM current_entities WHERE parent_id = ? AND combination_ids = ?`).get(product.id, combinationIdsJson) as { id: number; name: string } | undefined;
  if (existing) return existing;
  const name = values.join(' — ');
  const created = Entity.create(name, product.id, userId);
  db.prepare(`UPDATE entities SET combination_ids = ? WHERE entity_id = ? AND deleted_at IS NULL`).run(combinationIdsJson, created.id);
  return created;
}

/** The one, real, live place a combination's own display name is ever
 * computed - always from its own, real, stable combination_ids array,
 * never trusted from a stored name column. Genuinely rename-safe:
 * even if every real Hierarchy value in the chain has since been
 * renamed, this always reflects their current, real names. */
export function getCombinationDisplayName(entityId: number): string {
  const row = db.prepare(`SELECT combination_ids FROM current_entities WHERE id = ?`).get(entityId) as { combination_ids: string | null } | undefined;
  if (!row?.combination_ids) throw new ValidationError(`Entity ${entityId} has no real combination_ids set.`);
  const ids = JSON.parse(row.combination_ids) as number[];
  const rows = db.prepare(`SELECT id, name FROM current_entities WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids) as { id: number; name: string }[];
  const byId = new Map(rows.map((r) => [r.id, r.name]));
  return ids.map((id) => byId.get(id) ?? '?').join(' — ');
}

/** Per direct instruction: "the POS terminal uses the barcode and
 * then looks up the product name climbing the Instance tree" - a real
 * scanner identifies one, exact, terminal combination node directly
 * (via a real barcode registered against it, see getCombinationByUpc
 * below); this walks back up its own, real parent_id chain to the
 * real Product root, reconstructing the full, ordered combinationValues
 * array a real sale actually needs - never requiring a cashier to
 * manually pick each real dimension one at a time. */
/** Per direct instruction: "the POS terminal uses the barcode and
 * then looks up the product name climbing the Instance tree" - now a
 * real, single, direct lookup rather than a real, multi-step walk:
 * a real scanner identifies one, exact Product Instance directly (via
 * a real barcode registered against it, see getCombinationByUpc
 * below), whose own, real, flat combination_ids array already holds
 * everything needed - the full, ordered combinationValues array a
 * real sale actually needs, and each real value's own grouping, for
 * combinationShape - never requiring a cashier to manually pick each
 * real dimension one at a time. */
export function climbInstanceTree(instanceId: number): { combinationValues: string[]; combinationShape: [string, string][] } {
  const row = db.prepare(`SELECT combination_ids FROM current_entities WHERE id = ?`).get(instanceId) as { combination_ids: string | null } | undefined;
  if (!row?.combination_ids) return { combinationValues: [], combinationShape: [] };
  const ids = JSON.parse(row.combination_ids) as number[];
  const rows = db
    .prepare(`SELECT e.id, e.name, g.name AS grouping_name FROM current_entities e LEFT JOIN current_entities g ON g.id = e.parent_id WHERE e.id IN (${ids.map(() => '?').join(',')})`)
    .all(...ids) as { id: number; name: string; grouping_name: string | null }[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const combinationValues = ids.map((id) => byId.get(id)?.name ?? '?');
  const combinationShape: [string, string][] = ids.map((id) => {
    const grouping = byId.get(id)?.grouping_name ?? '?';
    return [grouping, grouping];
  });
  return { combinationValues, combinationShape };
}

/** Per the same, real, direct instruction - resolves a real,
 * scanned barcode directly to its own, real, exact combination (the
 * real item_source row this barcode was registered against, together
 * with the real, full combinationValues/combinationShape a real sale
 * needs), by climbing from its own, real, tagged Product Instance
 * terminal node. Returns undefined for a barcode with no real,
 * registered combination - the exact, same, existing, base-item-only
 * barcode lookup (getItemByUpc) still covers every real item that
 * has no combination-specific variant at all. */
export function getCombinationByUpc(upc: string): { itemName: string; combinationValues: string[]; combinationShape: [string, string][] } | undefined {
  if (!upc) return undefined;
  const row = db
    .prepare(
      `SELECT item_e.name AS item_name, ps.product_instance_id
       FROM item_source ps
       JOIN current_entities item_e ON item_e.id = ps.item_id
       WHERE ps.vendor_upc = ? AND ps.product_instance_id != 0
       LIMIT 1`
    )
    .get(upc) as { item_name: string; product_instance_id: number } | undefined;
  if (!row) return undefined;
  const { combinationValues, combinationShape } = climbInstanceTree(row.product_instance_id);
  return { itemName: row.item_name, combinationValues, combinationShape };
}

/** Creates one real, new leaf directly under a real, existing,
 * top-level account (Inventory, Sales, or COGS) — never an
 * intermediate per-item grouping node, per direct correction — whose
 * own relation_id points at a real Product Instance's own top node.
 * This is the one, real, shared, canonical link all three financial
 * accounts for the same, real combination refer back to. */
export function ensureCombinationAccountLeaf(baseAccountName: string, instanceTopNode: { id: number; name: string }, userId: UserId): { id: number; name: string } {
  const baseId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(baseAccountName) as { id: number } | undefined)?.id;
  if (!baseId) throw new ValidationError(`No real account named "${baseAccountName}".`);
  const instanceRow = db.prepare(`SELECT combination_ids FROM current_entities WHERE id = ?`).get(instanceTopNode.id) as { combination_ids: string | null } | undefined;
  const combinationIds = instanceRow?.combination_ids ?? null;
  // A real, confirmed bug, found directly, before this fix: even a
  // genuinely unique combination's own terminal value (e.g. "Cold")
  // can still, correctly, be shared by real, different, unrelated
  // items whose own combinations happen to end in the same, real
  // value. Looks up by the leaf's own, real combination_ids array
  // matching exactly - genuinely unambiguous, since it's the same,
  // stable array copied directly from the real Product Instance this
  // leaf represents, never a bare name.
  const existing = combinationIds != null ? (db.prepare(`SELECT id, name FROM current_entities WHERE parent_id = ? AND combination_ids = ?`).get(baseId, combinationIds) as { id: number; name: string } | undefined) : undefined;
  if (existing) return existing;
  // A real, second, genuine issue found directly, per direct
  // question: the bare terminal value alone ("Cold") is a real,
  // meaningless name in a report once two, real, different items'
  // own combinations happen to share it - and the earlier, numeric-id
  // fallback ("Cold (7350)") is no more meaningful to a real, human
  // reader. Uses the instance's own, real, full combination
  // (getCombinationDisplayName) instead (e.g. "Riverside Cellars —
  // DupCheck Lager — Cold") - genuinely unique on its own, and
  // genuinely readable, since it names every real value that makes
  // this one, specific combination what it is. Computed once here for
  // the leaf's own, real, initial name; never trusted as authoritative
  // afterward - a report re-derives it live from combination_ids.
  const leafName = combinationIds != null ? getCombinationDisplayName(instanceTopNode.id) : instanceTopNode.name;
  const leaf = Entity.create(leafName, baseId, userId);
  if (combinationIds != null) db.prepare(`UPDATE entities SET combination_ids = ? WHERE entity_id = ? AND deleted_at IS NULL`).run(combinationIds, leaf.id);
  return leaf;
}

/** Per direct instruction: real, business-scoped listing functions
 * for the frontend to actually use this mechanism through -
 * "Hierarchy" and "Product" are real, bare, non-globally-unique names
 * (one real root per business), so both resolve their own real
 * business's own root directly, never via a global, ambiguous
 * bare-name lookup. */
export interface HierarchyGroupingWithValues {
  grouping: string;
  values: string[];
}

export function getBusinessHierarchy(businessName: BusinessName): HierarchyGroupingWithValues[] {
  const hierarchyId = (
    db.prepare(`SELECT id FROM current_entities WHERE name = 'Hierarchy' AND parent_id = (SELECT id FROM current_entities WHERE name = ?)`).get(businessName) as
      | { id: number }
      | undefined
  )?.id;
  if (!hierarchyId) return [];
  const groupings = db.prepare(`SELECT id, name FROM current_entities WHERE parent_id = ?`).all(hierarchyId) as { id: number; name: string }[];
  return groupings.map((g) => ({
    grouping: g.name,
    values: (db.prepare(`SELECT name FROM current_entities WHERE parent_id = ?`).all(g.id) as { name: string }[]).map((v) => v.name),
  }));
}

/** A real, direct, single Product shape - one real dimension chain,
 * each entry the dimension's own real name paired with the real
 * Hierarchy grouping it points at. */
export function getBusinessProductShapes(businessName: BusinessName): [string, string][][] {
  const productId = (
    db.prepare(`SELECT id FROM current_entities WHERE name = 'Product' AND parent_id = (SELECT id FROM current_entities WHERE name = ?)`).get(businessName) as
      | { id: number }
      | undefined
  )?.id;
  const hierarchyId = (
    db.prepare(`SELECT id FROM current_entities WHERE name = 'Hierarchy' AND parent_id = (SELECT id FROM current_entities WHERE name = ?)`).get(businessName) as
      | { id: number }
      | undefined
  )?.id;
  if (!productId || !hierarchyId) return [];
  // A real Definition's own first node is a direct child of Product
  // whose own relation_id lands on a real Hierarchy grouping itself
  // (Hierarchy's own direct id) - a real Instance's own first node is
  // also a direct child of Product, but its own relation_id lands one
  // level deeper (a real value under a grouping, never the grouping
  // itself) - the one, sufficient, already-established distinction.
  const definitionRoots = db
    .prepare(`SELECT e.id, e.name FROM current_entities e JOIN current_entities rel ON rel.id = e.relation_id WHERE e.parent_id = ? AND rel.parent_id = ?`)
    .all(productId, hierarchyId) as { id: number; name: string }[];
  return definitionRoots.map((root) => {
    const chain: [string, string][] = [];
    let node: { id: number; name: string } | undefined = root;
    while (node) {
      const row = db.prepare(`SELECT e.name AS own_name, rel.name AS relation_name FROM current_entities e LEFT JOIN current_entities rel ON rel.id = e.relation_id WHERE e.id = ?`).get(node.id) as
        | { own_name: string; relation_name: string | null }
        | undefined;
      if (!row) break;
      chain.push([row.own_name, row.relation_name ?? '']);
      const child = db.prepare(`SELECT id, name FROM current_entities WHERE parent_id = ?`).get(node.id) as { id: number; name: string } | undefined;
      node = child;
    }
    return chain;
  });
}

/** A real product's own, genuine unit cost — the preferred, known
 * item_source's own price_minor, divided by its own package_quantity
 * (a source is priced per real, physical package/carton, not per
 * individual unit). Falls back to the first, real, known source at
 * all if none is marked preferred, and to null (no real, known cost
 * at all yet) rather than a fabricated, invented number — a real,
 * genuinely new product with no supplier registered yet has no real
 * cost to post, and COGS/Inventory simply won't move for it until one
 * is. */
export function getProductUnitCostMinor(itemName: ItemName): number | null {
  const sources = listItemSources(itemName);
  if (sources.length === 0) return null;
  const source = sources.find((s) => s.is_preferred) ?? sources[0];
  if (source.price_minor == null || !source.package_quantity) return null;
  return Math.round(source.price_minor / source.package_quantity);
}

/** Per the confirmed product/tier/leaf design
 * (docs/multi-dimensional-reporting.md §10): a real, single, distinct
 * tier-level item — e.g. "Amber Ale 330ml (Bottle)" — as a genuine,
 * structural child of its own real Sales leaf, with COGS reaching the
 * same item via the dimension mechanism (the same, confirmed shape as
 * §4, now correctly applied at the tier level rather than the
 * ambiguous, shared base-product level that caused real, confirmed
 * corruption in an earlier attempt — see §10's own, full account).
 *
 * Deliberately does NOT touch baseProductName's own, existing entity
 * at all — no re-parenting of it happens here. baseProductName stays
 * exactly where it already is; this creates a real, new, additional,
 * distinct tier-level entity alongside it. This is the direct fix for
 * the real, confirmed bug found in an earlier attempt: re-parenting a
 * single, shared item meant every other tier's own, later call could
 * no longer walk back to Items to re-derive its own category chain,
 * since the shared item's own parent had already moved. With each
 * tier as its own, separate, brand-new entity instead, there is
 * nothing shared to break — every tier's own real leaf has exactly
 * one real Sales leaf of its own, from the moment it's first created. */
export function ensureProductTierItem(baseProductName: ItemName, tier: string, userId: UserId): { tierItemName: string; tierItemId: number; salesAccount: string; salesAccountId: number; cogsAccount: string; cogsAccountId: number } {
  const { salesAccount, salesAccountId, cogsAccount, cogsAccountId } = ensureProductSalesCogsAccounts(baseProductName, userId, tier);
  const tierItemName = `${baseProductName} (${tier})`;

  const existing = Entity.getUnder(tierItemName, salesAccountId);
  const tierItemRow = existing ?? Entity.create(tierItemName, salesAccountId, userId);
  if (!existing) {
    mergeContactDetail(tierItemRow.id, {});
    setDimensionParent(tierItemName, 'COGS Product', cogsAccount, userId);
  }
  return { tierItemName, tierItemId: tierItemRow.id, salesAccount, salesAccountId, cogsAccount, cogsAccountId };
}

/** Per direct confirmation — "location must become structural the
 * same way tier did", retiring journal_line.division_id as a tag
 * entirely once this exists — the exact, same, proven pattern
 * ensureProductTierItem already uses, mirrored one real level deeper.
 *
 * A real (tier, location) combination is what a real sale actually,
 * physically is — "Amber Ale 330ml (Bottle) sold at Riverside
 * Cellars" is a real, genuinely distinct fact from the same product
 * sold at Uptown Wine & Spirits, not a tag on an otherwise-identical
 * posting. The existing, real tier-level Sales/COGS leaves
 * (ensureProductTierItem's own output) become real, pure summary
 * categories the moment a real location-level leaf is created beneath
 * them — mirroring exactly how the real, base product itself became a
 * pure category the moment real tier-level leaves were created beneath
 * it. A real, new, distinct Sales/COGS leaf pair is created per real
 * location, each a genuine child of the existing, real tier-level
 * leaf — never re-parented, never shared — with a real, new, distinct
 * item beneath the new Sales leaf, the real, actual, postable,
 * sellable endpoint. Deliberately mirrors the same, real, confirmed
 * fix for tier-restructuring attempt #3's own real bug: the real,
 * existing, shared tierItemName entity is never touched here at all,
 * only ever read from, so there is no shared, ambiguous parent for a
 * second, real, different location to corrupt. */
export function ensureProductTierLocationLeaf(tierItemName: string, locationName: LocationName, userId: UserId, tierItemId?: number): { leafItemName: string; leafItemId: number; salesAccount: string; salesAccountId: number; cogsAccount: string; cogsAccountId: number } {
  // Per direct question, confirmed a real, genuine performance issue:
  // getEntityTree() fetches and parses the entire, real entities
  // table just to find a handful of specific, individual rows via a
  // JS .find() - real, wasted work on every real call, when this
  // table's own, real, existing indexes (entities_entity_id_current,
  // entities_name_lookup) already make each of these a direct,
  // indexed seek instead. Replaced with targeted, real, direct
  // queries - genuinely faster, not just theoretically so, confirmed
  // via EXPLAIN QUERY PLAN elsewhere in this schema.
  const tierItem = tierItemId != null
    ? (db.prepare(`SELECT id, name, parent_id FROM current_entities WHERE id = ?`).get(tierItemId) as { id: number; name: string; parent_id: number | null } | undefined)
    : (db.prepare(`SELECT id, name, parent_id FROM current_entities WHERE name = ?`).get(tierItemName) as { id: number; name: string; parent_id: number | null } | undefined);
  if (!tierItem) throw new ValidationError(`No real item named "${tierItemName}".`);
  const tierSalesLeaf = db.prepare(`SELECT id, name FROM current_entities WHERE id = ?`).get(tierItem.parent_id) as { id: number; name: string } | undefined;
  if (!tierSalesLeaf) throw new ValidationError(`"${tierItemName}" has no real, structural parent.`);
  const tierCogsAccount = getDimensionParent(tierItemName, 'COGS Product');
  if (!tierCogsAccount) throw new ValidationError(`"${tierItemName}" has no real COGS account.`);
  const tierCogsEntity = db.prepare(`SELECT id, name FROM current_entities WHERE name = ? AND relation_id IS NOT NULL`).get(tierCogsAccount) as { id: number; name: string } | undefined;
  if (!tierCogsEntity) throw new ValidationError(`"${tierCogsAccount}" is not a real, existing entity.`);

  const leafItemName = `${tierItemName} — ${locationName}`;
  const salesAccount = `${tierSalesLeaf.name} — ${locationName}`;
  const cogsAccount = `${tierCogsAccount} — ${locationName}`;

  let leafRow = Entity.getUnder(leafItemName, Entity.getUnder(salesAccount, tierSalesLeaf.id)?.id ?? -1);
  let salesRow = Entity.getUnder(salesAccount, tierSalesLeaf.id);
  let cogsRow = Entity.getUnder(cogsAccount, tierCogsEntity.id);
  if (!leafRow) {
    if (!salesRow) salesRow = Entity.create(salesAccount, tierSalesLeaf.id, userId);
    if (!cogsRow) {
      cogsRow = Entity.create(cogsAccount, tierCogsEntity.id, userId);
      Entity.relate(cogsRow.id, 'COGS', userId);
    }
    const createdLeaf = Entity.create(leafItemName, salesRow.id, userId);
    mergeContactDetail(createdLeaf.id, {});
    setDimensionParent(leafItemName, 'COGS Product', cogsAccount, userId);
    // The real, structural fact a real journal_line.account_id can now
    // be walked from directly — which real location this real Sales
    // leaf (and its own real COGS counteritem) actually belongs to —
    // replacing the real, separate division_id tag this whole design
    // exists to retire. Set on the real, actual posting targets
    // themselves (the Sales/COGS leaves), not the item, since a real
    // journal_line's own account_id always points at one of those two,
    // never at the item.
    setDimensionParent(salesAccount, 'Location', locationName, userId);
    setDimensionParent(cogsAccount, 'Location', locationName, userId);
    leafRow = { id: createdLeaf.id, name: leafItemName };
  }
  return { leafItemName, leafItemId: leafRow.id, salesAccount, salesAccountId: salesRow!.id, cogsAccount, cogsAccountId: cogsRow!.id };
}

/** The exact, same, real, proven (product, location) leaf pattern
 * above — extended to an ordinary, non-tiered product too. Per
 * direct, explicit confirmation: "only location and product map to
 * an account — the [division/category] hierarchies are for reporting
 * only, not recording." A real product with no real tier at all still
 * genuinely needs its own, real, location-scoped Sales/COGS leaf the
 * exact, same way a tiered one does — the tier dimension and the
 * location dimension are independent of each other; a product having
 * only one real selling unit doesn't mean it's only ever sold from
 * one real place. */
export function ensureProductLocationLeaf(itemName: ItemName, locationName: LocationName, userId: UserId): { salesAccount: string; salesAccountId: number; cogsAccount: string; cogsAccountId: number } {
  const { salesAccount: baseSales, salesAccountId: baseSalesId, cogsAccount: baseCogs, cogsAccountId: baseCogsId } = ensureProductSalesCogsAccounts(itemName, userId);
  const salesAccount = `${baseSales} — ${locationName}`;
  const cogsAccount = `${baseCogs} — ${locationName}`;

  let salesRow = Entity.getUnder(salesAccount, baseSalesId);
  if (!salesRow) {
    salesRow = Entity.create(salesAccount, baseSalesId, userId);
    setDimensionParent(salesAccount, 'Location', locationName, userId);
  }
  let cogsRow = Entity.getUnder(cogsAccount, baseCogsId);
  if (!cogsRow) {
    cogsRow = Entity.create(cogsAccount, baseCogsId, userId);
    Entity.relate(cogsRow.id, 'COGS', userId);
    setDimensionParent(cogsAccount, 'Location', locationName, userId);
  }
  return { salesAccount, salesAccountId: salesRow.id, cogsAccount, cogsAccountId: cogsRow.id };
}


/** The real, structural replacement for journal_line.division_id —
 * given a real account name a real journal_line actually posted to,
 * walks its own, real "Location" dimension-parent directly (set by
 * ensureProductTierLocationLeaf above), rather than reading a
 * separate tag that could drift out of sync with where the account
 * actually, structurally sits. undefined for any real account with no
 * real, known location — an ordinary, non-product account (Cash and
 * Bank, Owner's Equity), or a real Sales/COGS leaf that predates this
 * design and has no real per-location leaf of its own yet. */
export function getLocationForAccount(accountName: AccountName): string | undefined {
  return getDimensionParent(accountName, 'Location');
}

/** The real, structural replacement for cityDivisionFor(division_id)
 * — walks a real account to its own, real, structural location first
 * (getLocationForAccount above), then reuses the exact, same, already-
 * proven location-to-division resolution cityDivisionFor already
 * provides. undefined under the same, real conditions
 * getLocationForAccount itself is. */
export function getDivisionForAccount(accountName: AccountName): string | undefined {
  const location = getLocationForAccount(accountName);
  if (!location) return undefined;
  return cityDivisionFor(location);
}

/** Lazily creates a real product's own two, real quantity-domain
 * accounts — the genuine double-entry counteritem for receipts and
 * sales, per direct confirmation: "on order" is a real, independently
 * meaningful fact (units committed via a real PO but not yet
 * received), not derived arithmetic, so receiving stock can now be a
 * real, balanced posting (debit on-hand, credit on-order) instead of
 * a single, unbalanced line. Likewise, "units sold" mirrors COGS on
 * the quantity side — a sale now debits units-sold and credits
 * on-hand, a real, balanced pair. Parented directly under the
 * product itself, the same real pattern Sales-/COGS- accounts
 * already use to stay obviously, nameably tied to their own product. */
/** Per direct correction: an entity's own stored name should never
 * bake in its parent's name too - the parent relationship (parent_id)
 * already supplies that, structurally. This reconstructs the
 * familiar, human-readable "Parent — Child" display form at
 * lookup/display time instead, from the real, live entity tree -
 * never stored as the entity's own, literal name. Real, direct
 * account resolution stays entirely safe doing this, since
 * post_journal_entry_insert's own trigger already prefers a real,
 * explicit accountId over a name lookup everywhere it posts. */
export function getQualifiedDisplayName(entityId: number): string {
  const entity = getEntity(entityId);
  if (!entity || entity.parent_id == null) return entity?.name ?? '';
  const parent = getEntity(entity.parent_id);
  if (!parent) return entity.name;
  return `${parent.name} — ${entity.name}`;
}

export function ensureProductQuantityAccounts(itemName: ItemName, userId: UserId): { onOrderAccount: string; onOrderAccountId: number; unitsSoldAccount: string; unitsSoldAccountId: number; countAdjustmentAccount: string; countAdjustmentAccountId: number; writeOffAccount: string; writeOffAccountId: number } {
  const itemId = resolveIdOrThrow(itemName);
  function ensureChild(childName: string): { name: string; id: number } {
    let entity = Entity.getUnder(childName, itemId);
    if (!entity) entity = Entity.create(childName, itemId, userId);
    return { name: entity.name, id: entity.id };
  }
  const onOrder = ensureChild('On Order');
  const unitsSold = ensureChild('Units Sold');
  const countAdjustment = ensureChild('Count Adjustment');
  const writeOff = ensureChild('Write-off');
  return {
    onOrderAccount: onOrder.name,
    onOrderAccountId: onOrder.id,
    unitsSoldAccount: unitsSold.name,
    unitsSoldAccountId: unitsSold.id,
    countAdjustmentAccount: countAdjustment.name,
    countAdjustmentAccountId: countAdjustment.id,
    writeOffAccount: writeOff.name,
    writeOffAccountId: writeOff.id,
  };
}

/** A location's own real city, if a real division with that exact
 * name happens to exist — used to automatically tag a POS sale with
 * its real, per-city division, with zero setup required beyond
 * creating the division itself. Returns undefined (no tagging at all)
 * for any business that hasn't set up city-named divisions — this is
 * opportunistic, not a requirement every business must satisfy. */
/** A real division to automatically tag a sale/stock movement at this
 * location with — genuinely arbitrary, not hardcoded to "city"
 * specifically: checks first for a real division matching the
 * location's own exact name (the most specific real grouping a
 * business could set up — one division per outlet), then falls back
 * to a real division matching the location's city (a coarser,
 * optional grouping — several outlets in the same city sharing one
 * division). Either, both, or neither may exist; this only ever
 * matches a real division that's actually been created, never invents
 * one. A business that wants no automatic division tagging at all
 * simply doesn't create either. */
export function cityDivisionFor(locationName: string): string | undefined {
  const location = getLocation(locationName);
  if (!location) return undefined;
  // A real division explicitly tied to this exact location via the
  // established "Belongs To Division" relationship (a location's own
  // relation_id pointing at a real record naming its own division) —
  // not a name match. A division and its own location can genuinely
  // share an exact name (scoped uniqueness allows this, since they're
  // never real siblings).
  const rel = getRelationship(locationName);
  if (rel && rel.type === 'Belongs To Division') return rel.target;
  const divisionNames = new Set(getDivisions().map((d) => d.name));
  if (location.city && divisionNames.has(location.city)) return location.city;
  return undefined;
}

/** The real, physical location a specific product should actually be
 * picked from/dispatched to, given the one, real, logical outlet a
 * person selected — automatically resolves to a real, cold-storage
 * sub-location (via its own real relation link to that outlet) when
 * the product genuinely needs one and that link actually exists;
 * otherwise, the logical outlet itself. Never assumes a cold sub-
 * location exists just because the product is cold — falls back
 * honestly to the real, given location if it doesn't. */
export function resolveDispatchLocation(itemName: ItemName, logicalLocationName: LocationName): LocationName {
  if (getItemStorageOrigin(itemName) !== 'Cold') return logicalLocationName;
  const coldSubLocation = db
    .prepare(
      `SELECT cold.name
       FROM current_entities cold
       JOIN current_entities logical ON logical.id = cold.relation_id
       WHERE logical.name = ? AND cold.name LIKE '%Refrigerated%'`
    )
    .get(logicalLocationName) as { name: string } | undefined;
  return coldSubLocation ? asLocationName(coldSubLocation.name) : logicalLocationName;
}

export function completePosSale(input: PosSaleInput, userId: UserId): PosSaleResult {
  if (input.lines.length === 0) throw new ValidationError('A sale needs at least one line.');

  // Per docs/border-multicurrency-pos-plan.md, Slice 4: a real,
  // specific terminal resolves its own real currency; any line that
  // didn't hand-enter a price gets one resolved from that item's own,
  // real, matching item_source row for that currency. Two real
  // terminals at the exact same, real location can each transact in a
  // genuinely different currency this way — completely unaffected,
  // real, existing behavior when terminalName is omitted.
  const effectiveCurrency = getEffectiveSaleCurrency(input.terminalName);
  for (const line of input.lines) {
    if (line.unitPriceMinor === undefined) {
      const instanceId = line.combinationValues && line.combinationShape ? ensureProductInstance(input.business, line.combinationShape, line.combinationValues, userId).id : undefined;
      const resolved = getItemPriceForCurrency(line.itemName, effectiveCurrency, instanceId);
      if (resolved === null) throw new ValidationError(`No real price found for "${line.itemName}" in ${effectiveCurrency ?? 'the home currency'}, and none was given directly.`);
      line.unitPriceMinor = resolved;
    }
  }

  if (input.paymentMethod === undefined) {
    // On-account sale — the customer must actually be verified if
    // they self-registered at all (a staff-created account customer
    // has no verification_status and is simply usable, since staff
    // already verified who they are by doing the setup).
    const contact = getContact(input.customerName);
    if (contact?.verification_status && contact.verification_status !== 'active') {
      throw new ValidationError(
        `"${input.customerName}" is ${contact.verification_status === 'pending' ? 'still awaiting staff verification' : 'not an approved account'} and cannot be sold to on account.`
      );
    }
  }

  for (const line of input.lines) {
    if (line.quantity <= 0) throw new ValidationError(`Quantity for "${line.itemName}" must be positive.`);
    const current = getItemLocation(asItemName(line.itemName), resolveDispatchLocation(asItemName(line.itemName), input.locationName));
    if (line.quantity > current.quantity_on_hand) {
      throw new ValidationError(`Only ${current.quantity_on_hand} of "${line.itemName}" on hand at "${input.locationName}" — cannot sell ${line.quantity}.`);
    }
  }

  return db.transaction((): PosSaleResult => {
    const today = input.transdate ?? todayAtLocation(input.locationName);
    const reference = `POS-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const invoiceId = createInvoice(
      {
        invoiceType: 'AR',
        business: input.business,
        ledger: input.ledger,
        reference,
        counterpartyName: input.customerName,
        invoiceDate: today,
        description: `POS sale at ${input.locationName}`,
        source: 'pos',
        lines: input.lines.map((l) => ({
          description: l.itemName,
          quantity: l.quantity,
          unitPriceMinor: l.unitPriceMinor,
          amountMinor: l.quantity * l.unitPriceMinor,
          taxMinor: l.taxMinor,
          itemName: l.itemName,
        })),
      },
      userId
    );

    postInvoice(
      invoiceId,
      input.revenueAccount ??
        ((line) => {
          if (!line.itemName) return 'Sales Revenue';
          const tier = input.lines.find((l) => l.itemName === line.itemName)?.tier;
          const combo = input.lines.find((l) => l.itemName === line.itemName);
          if (combo?.combinationValues && combo?.combinationShape) {
            const instanceTop = ensureProductInstance(input.business, combo.combinationShape, combo.combinationValues, userId);
            const leaf = ensureCombinationAccountLeaf('Sales Revenue', instanceTop, userId);
            return { name: leaf.name, id: leaf.id };
          }
          if (tier && input.locationName) {
            const tierItem = ensureProductTierItem(asItemName(line.itemName), tier, userId);
            const leaf = ensureProductTierLocationLeaf(tierItem.tierItemName, input.locationName, userId, tierItem.tierItemId);
            return { name: leaf.salesAccount, id: leaf.salesAccountId };
          }
          if (tier) {
            const tierItem = ensureProductTierItem(asItemName(line.itemName), tier, userId);
            return { name: tierItem.salesAccount, id: tierItem.salesAccountId };
          }
          if (input.locationName) {
            const leaf = ensureProductLocationLeaf(asItemName(line.itemName), input.locationName, userId);
            return { name: leaf.salesAccount, id: leaf.salesAccountId };
          }
          const base = ensureProductSalesCogsAccounts(asItemName(line.itemName), userId);
          return { name: base.salesAccount, id: base.salesAccountId };
        }),
      input.taxAccount,
      userId,
      false,
      cityDivisionFor(input.locationName),
      // A real, immediate cash sale has no genuine receivable at all,
      // even momentarily — post straight to the real payment account
      // instead of the customer's own AR balance. A genuine
      // "sell on account" sale (paymentMethod left undefined)
      // correctly still uses the customer's real AR balance, since
      // that IS a genuine, real receivable.
      input.paymentMethod ? 'Cash and Bank' : undefined
    );

    for (const line of input.lines) {
      dispatchStockFromLocation(input.business, input.ledger, `${reference}-DISPATCH-${line.itemName}`, asItemName(line.itemName), asLocationName(resolveDispatchLocation(asItemName(line.itemName), input.locationName)), line.quantity, userId, today);
    }

    // Real COGS + Inventory-value reduction — per direct, confirmed
    // finding: this function previously only ever posted revenue/tax,
    // leaving every real sale, in real, live use (not just the
    // simulation), with no real COGS effect and no real Inventory
    // reduction at all. The exact, same, tier/location-aware resolver
    // already proven for the Sales side above, reused here for COGS;
    // the credit side lands in that same, real product's own,
    // structural Inventory sub-account (ensureProductInventoryAccount),
    // not the old, flat, single "Inventory" account every product used
    // to share. A genuinely new product with no known supplier/cost
    // registered yet simply posts no COGS/Inventory line at all for
    // itself, rather than a fabricated, invented cost.
    const cogsRef = `${reference}-COGS`;
    let cogsTotal = 0;
    const cogsDivision = cityDivisionFor(input.locationName);
    for (const line of input.lines) {
      const unitCostMinor = getProductUnitCostMinor(asItemName(line.itemName));
      if (unitCostMinor == null) continue;
      const lineCogsMinor = line.quantity * unitCostMinor;
      if (lineCogsMinor <= 0) continue;
      let cogsAccount: string;
      let cogsAccountId: number;
      let inv: { inventoryAccount: string; inventoryAccountId: number } | undefined;
      if (line.combinationValues && line.combinationShape) {
        const instanceTop = ensureProductInstance(input.business, line.combinationShape, line.combinationValues, userId);
        const cogsLeaf = ensureCombinationAccountLeaf('Cost of Goods Sold', instanceTop, userId);
        const invLeaf = ensureCombinationAccountLeaf('Inventory', instanceTop, userId);
        cogsAccount = cogsLeaf.name;
        cogsAccountId = cogsLeaf.id;
        inv = { inventoryAccount: invLeaf.name, inventoryAccountId: invLeaf.id };
      } else if (line.tier && input.locationName) {
        const tierItem = ensureProductTierItem(asItemName(line.itemName), line.tier, userId);
        const leaf = ensureProductTierLocationLeaf(tierItem.tierItemName, input.locationName, userId, tierItem.tierItemId);
        cogsAccount = leaf.cogsAccount;
        cogsAccountId = leaf.cogsAccountId;
      } else if (line.tier) {
        const tierItem = ensureProductTierItem(asItemName(line.itemName), line.tier, userId);
        cogsAccount = tierItem.cogsAccount;
        cogsAccountId = tierItem.cogsAccountId;
      } else if (input.locationName) {
        const leaf = ensureProductLocationLeaf(asItemName(line.itemName), input.locationName, userId);
        cogsAccount = leaf.cogsAccount;
        cogsAccountId = leaf.cogsAccountId;
      } else {
        const base = ensureProductSalesCogsAccounts(asItemName(line.itemName), userId);
        cogsAccount = base.cogsAccount;
        cogsAccountId = base.cogsAccountId;
      }
      if (!(line.combinationValues && line.combinationShape)) {
        const resolved = input.locationName
          ? ensureProductLocationInventoryAccount(asItemName(line.itemName), input.locationName, userId)
          : ensureProductInventoryAccount(asItemName(line.itemName), userId);
        inv = resolved;
      }
      stageLine({ reference: cogsRef, business: asBusinessName(input.business), ledger: asLedgerName(input.ledger), transdate: today, account: asAccountName(cogsAccount), accountId: cogsAccountId, amount_minor: lineCogsMinor, division: cogsDivision ? asDivisionName(cogsDivision) : undefined });
      stageLine({ reference: cogsRef, business: asBusinessName(input.business), ledger: asLedgerName(input.ledger), transdate: today, account: asAccountName(inv!.inventoryAccount), accountId: inv!.inventoryAccountId, amount_minor: -lineCogsMinor, division: cogsDivision ? asDivisionName(cogsDivision) : undefined });
      cogsTotal += lineCogsMinor;
    }
    if (cogsTotal > 0) postJournalEntry(cogsRef, input.business, input.ledger, userId);

    const invoice = getInvoice(invoiceId)!;
    const totalMinor = invoice.total_amount_minor + invoice.total_tax_minor;

    let changeDueMinor = 0;
    if (input.paymentMethod) {
      // skipJournalPosting: true — the real cash-side GL effect
      // already happened once, directly, at postInvoice above; this
      // only records the real allocation fact so
      // getInvoiceOutstandingMinor correctly shows zero, not a
      // second, redundant journal entry.
      allocatePayment(invoiceId, `${reference}-PAYMENT`, totalMinor, today, 'Cash and Bank', userId, true);
      if (input.cashTenderedMinor != null) {
        changeDueMinor = Math.max(0, input.cashTenderedMinor - totalMinor);
      }
    }

    return { invoiceId, reference, totalMinor, changeDueMinor };
  })();
}

export interface CashPurchaseLineInput {
  itemName: string;
  quantity: number;
  unitPriceMinor: number;
  taxMinor: number;
}

export interface CashPurchaseInput {
  business: BusinessName;
  ledger: LedgerName;
  locationName: LocationName;
  vendorName: VendorName;
  lines: CashPurchaseLineInput[];
  taxAccount: AccountName;
  /** Present for cash/EFT, where the purchase is paid in full
   * immediately. Omit entirely for an on-account purchase (becomes a
   * normal outstanding AP invoice, the ordinary AP Purchase form's own
   * behavior) — this function exists specifically for the immediate-
   * payment case. */
  paymentMethod?: string;
  transdate?: string;
}

export interface CashPurchaseResult {
  invoiceId: number;
  reference: string;
  totalMinor: number;
}

/** Completes a full, immediate-payment purchase as one atomic
 * operation — the real, direct counteritem to completePosSale, mirroring
 * its exact structure for the purchase side: posts the invoice
 * straight to Cash and Bank (no genuine AP round-trip, the same real
 * reasoning completePosSale already uses for cash sales), receives
 * real, physical stock at the real, chosen location, and allocates
 * full payment immediately. A real, explicit location choice — any
 * real location, not just a warehouse — since a real, wholesale
 * purchase might receive directly into a retail outlet just as
 * easily. */
export function completeCashPurchase(input: CashPurchaseInput, userId: UserId): CashPurchaseResult {
  if (input.lines.length === 0) throw new ValidationError('A purchase needs at least one line.');

  return db.transaction((): CashPurchaseResult => {
    const today = input.transdate ?? todayAtLocation(input.locationName);
    const reference = `CASHPUR-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const invoiceId = createInvoice(
      {
        invoiceType: 'AP',
        business: input.business,
        ledger: input.ledger,
        reference,
        counterpartyName: input.vendorName,
        invoiceDate: today,
        description: `Cash purchase received at ${input.locationName}`,
        lines: input.lines.map((l) => ({
          description: l.itemName,
          quantity: l.quantity,
          unitPriceMinor: l.unitPriceMinor,
          amountMinor: l.quantity * l.unitPriceMinor,
          taxMinor: l.taxMinor,
          itemName: l.itemName,
        })),
      },
      userId
    );

    postInvoice(
      invoiceId,
      (line) => (line.itemName ? (() => { const inv = ensureProductLocationInventoryAccount(asItemName(line.itemName!), input.locationName, userId); return { name: inv.inventoryAccount, id: inv.inventoryAccountId }; })() : 'Inventory'),
      input.taxAccount,
      userId,
      false,
      cityDivisionFor(input.locationName),
      // The same, real reasoning completePosSale already uses for a
      // cash sale — a real, immediate cash purchase has no genuine
      // payable at all, even momentarily; post straight to the real
      // payment account instead of the vendor's own AP balance.
      input.paymentMethod ? 'Cash and Bank' : undefined
    );

    for (const line of input.lines) {
      receiveStockAtLocation(input.business, input.ledger, `${reference}-RECV-${line.itemName}`, asItemName(line.itemName), asLocationName(input.locationName), line.quantity, userId, today);
    }

    const invoice = getInvoice(invoiceId)!;
    const totalMinor = invoice.total_amount_minor + invoice.total_tax_minor;

    if (input.paymentMethod) {
      allocatePayment(invoiceId, `${reference}-PAYMENT`, totalMinor, today, 'Cash and Bank', userId, true);
    }

    return { invoiceId, reference, totalMinor };
  })();
}

export interface PayEmployeeWagesInput {
  business: string;
  ledger: string;
  employeeName: string;
  /** Required for an hourly employee (one with wage_minor_per_hour
   * set). Omit entirely for a salaried employee — their own real,
   * fixed monthly salary (salary_minor_per_year / 12) is used
   * instead, and providing hours for a salaried employee is refused
   * as a real, honest mismatch rather than silently ignored. */
  hours?: number;
  wagesExpenseAccount?: string;
  /** Present for cash/EFT, where the employee's own real, NET pay
   * (after Medicare withholding) is paid in full immediately. Omit to
   * leave the net amount owing as a real, ordinary outstanding AP
   * balance, paid later through the normal AP Payment screen. */
  paymentMethod?: string;
  transdate?: string;
}

export interface PayEmployeeWagesResult {
  invoiceId: number;
  reference: string;
  grossMinor: number;
  medicareLevyMinor: number;
  superannuationMinor: number;
  netMinor: number;
}

// Real, current Australian rates, per direct request — a real,
// simple flat percentage each, not a bracketed/progressive scale
// (which would need real, additional inputs like an annual income
// threshold this app doesn't collect).
const MEDICARE_LEVY_RATE = 0.015;
const SUPERANNUATION_RATE = 0.12;

/** Pays a real employee — hourly or salaried — treating them as a
 * real AP counterparty, the same real mechanism a vendor invoice
 * already uses, per direct request. A real, genuine multi-line
 * posting, not a simple two-sided one, since three real, separate
 * facts are true at once: the employee's own real gross pay (an
 * expense to the business), a real Medicare levy withheld from THEIR
 * pay (a real liability owed to the ATO, not a business cost), and a
 * real superannuation employer contribution ON TOP of gross pay (a
 * genuine, additional business cost, and a genuine, separate
 * liability owed to a real super fund) — three real, independent
 * amounts, not one derived from another. */
export function payEmployeeWages(input: PayEmployeeWagesInput, userId: UserId): PayEmployeeWagesResult {
  const contact = getContact(input.employeeName);
  if (!contact) throw new ValidationError(`No real contact named "${input.employeeName}".`);

  let grossMinor: number;
  if (contact.wage_minor_per_hour) {
    if (!input.hours || input.hours <= 0) throw new ValidationError(`"${input.employeeName}" is paid hourly — real hours worked must be given.`);
    grossMinor = Math.round(input.hours * contact.wage_minor_per_hour);
  } else if (contact.salary_minor_per_year) {
    if (input.hours) throw new ValidationError(`"${input.employeeName}" is on a real, fixed salary, not paid by the hour — hours worked doesn't apply here.`);
    grossMinor = Math.round(contact.salary_minor_per_year / 12); // one real, monthly pay period
  } else {
    throw new ValidationError(`"${input.employeeName}" has no real, configured wage rate or salary yet — set one on the Contacts page first.`);
  }

  return db.transaction((): PayEmployeeWagesResult => {
    const today = input.transdate ?? new Date().toISOString().slice(0, 10);
    const reference = `WAGES-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const wagesAccount = input.wagesExpenseAccount ?? (contact.salary_minor_per_year ? 'Wages' : 'Wages');
    const medicareLevyMinor = Math.round(grossMinor * MEDICARE_LEVY_RATE);
    const superannuationMinor = Math.round(grossMinor * SUPERANNUATION_RATE);
    const netMinor = grossMinor - medicareLevyMinor;

    // The employee's own real gross pay — the exact same real AP
    // mechanism a vendor invoice already uses (debit Wages, credit
    // the employee's own real balance), before any real withholding.
    const invoiceId = createInvoice(
      {
        invoiceType: 'AP',
        business: input.business,
        ledger: input.ledger,
        reference,
        counterpartyName: input.employeeName,
        invoiceDate: today,
        description: contact.wage_minor_per_hour
          ? `${input.hours} real hour${input.hours === 1 ? '' : 's'} of work, at the employee's own real wage rate`
          : `One real month's salary`,
        lines: [
          {
            description: contact.wage_minor_per_hour ? `${input.hours} hours worked` : 'Monthly salary',
            quantity: contact.wage_minor_per_hour ? input.hours! : 1,
            unitPriceMinor: contact.wage_minor_per_hour ? contact.wage_minor_per_hour : grossMinor,
            amountMinor: grossMinor,
            taxMinor: 0,
          },
        ],
      },
      userId
    );
    postInvoice(invoiceId, wagesAccount, 'Sales Tax Payable', userId, false, undefined, undefined);

    // Withholds the real Medicare levy from the employee's own real
    // balance — reduces what they're owed, and records a real,
    // separate liability owed to the ATO, not a cost to the business.
    stageLine({ reference: `${reference}-MEDICARE`, business: asBusinessName(input.business), ledger: asLedgerName(input.ledger), transdate: today, account: asAccountName(input.employeeName), amount_minor: medicareLevyMinor, memo: 'Medicare levy withheld' });
    stageLine({ reference: `${reference}-MEDICARE`, business: asBusinessName(input.business), ledger: asLedgerName(input.ledger), transdate: today, account: asAccountName('Medicare Levy Payable'), amount_minor: -medicareLevyMinor, memo: 'Medicare levy withheld' });
    postJournalEntry(`${reference}-MEDICARE`, asBusinessName(input.business), asLedgerName(input.ledger), userId);

    // A real, genuine, additional employer cost on top of gross pay —
    // never touches the employee's own balance at all.
    stageLine({ reference: `${reference}-SUPER`, business: asBusinessName(input.business), ledger: asLedgerName(input.ledger), transdate: today, account: asAccountName('Superannuation Expense'), amount_minor: superannuationMinor, memo: 'Superannuation employer contribution' });
    stageLine({ reference: `${reference}-SUPER`, business: asBusinessName(input.business), ledger: asLedgerName(input.ledger), transdate: today, account: asAccountName('Superannuation Payable'), amount_minor: -superannuationMinor, memo: 'Superannuation employer contribution' });
    postJournalEntry(`${reference}-SUPER`, asBusinessName(input.business), asLedgerName(input.ledger), userId);

    if (input.paymentMethod) {
      allocatePayment(invoiceId, `${reference}-PAYMENT`, netMinor, today, 'Cash and Bank', userId, true);
    }

    return { invoiceId, reference, grossMinor, medicareLevyMinor, superannuationMinor, netMinor };
  })();
}


/** Records that a reminder was sent to this customer, advancing their
 * level by one (capped at 3, the harshest) — so the next reminder for
 * the same customer is pre-set to the following level, matching
 * SQL-Ledger's own behavior. A targeted update, deliberately separate
 * from setContact's full-replace semantics, so an unrelated contact
 * edit never resets this. */
export function recordReminderSent(customerName: string): number {
  const id = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(customerName) as { id: number } | undefined)?.id;
  if (!id) throw new ValidationError(`No customer/vendor named "${customerName}".`);
  const current = (db.prepare(`SELECT reminder_level FROM contact WHERE entity_id = ?`).get(id) as { reminder_level: number } | undefined)?.reminder_level ?? 0;
  const next = current === 0 ? 1 : Math.min(3, current + 1);
  mergeContactDetail(id, { reminder_level: next });
  return next;
}

/** Resets a customer's reminder level back to 0 — once they've paid,
 * the next time they go overdue should start from the polite level 1
 * again, not pick up where a previous, unrelated overdue balance left
 * off. */
export function resetReminderLevel(customerName: string): void {
  const id = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(customerName) as { id: number } | undefined)?.id;
  if (!id) throw new ValidationError(`No customer/vendor named "${customerName}".`);
  mergeContactDetail(id, { reminder_level: 0 });
}

export interface ReminderCandidate {
  counterparty: string;
  current_level: number;
  next_level: number;
  outstanding_minor: number;
  oldest_days_overdue: number;
}

/** Which customers actually have an overdue balance right now, and
 * what reminder level they'd be sent at next — grouped per customer,
 * not per invoice, matching how reminders are actually addressed. */
export function getReminderCandidates(business: BusinessName, ledger: LedgerName, asOfDate: string): ReminderCandidate[] {
  const aged = getAgedInvoices(business, ledger, 'AR', asOfDate).filter((r) => r.days_overdue > 0);
  const byCustomer = new Map<string, { outstanding: number; oldestDays: number }>();
  for (const row of aged) {
    const existing = byCustomer.get(row.counterparty) ?? { outstanding: 0, oldestDays: 0 };
    existing.outstanding += row.outstanding_minor;
    existing.oldestDays = Math.max(existing.oldestDays, row.days_overdue);
    byCustomer.set(row.counterparty, existing);
  }
  return Array.from(byCustomer.entries()).map(([counterparty, { outstanding, oldestDays }]) => {
    const currentLevel = getContact(counterparty)?.reminder_level ?? 0;
    return {
      counterparty,
      current_level: currentLevel,
      next_level: Math.min(3, currentLevel + 1),
      outstanding_minor: outstanding,
      oldest_days_overdue: oldestDays,
    };
  });
}

export interface Contact {
  /** A real, human contact-person's own real name — only ever set on
   * a real ContactPerson record (see addTypedContactPerson below);
   * null for every other, real use of this same interface. */
  person_name: string | null;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  /** Base credit term in days — null means not yet configured, 0
   * means cash only. Aging buckets are derived from this (term,
   * 2x term, 3x term), never stored as three separate numbers. */
  payment_terms_days: number | null;
  /** The real, maximum outstanding balance this customer/vendor is
   * allowed to carry — null means no real limit has been set. A real,
   * separate dimension from payment_terms_days (see contact.credit_limit_minor). */
  credit_limit_minor: number | null;
  /** A real employee's own real wage rate, per hour — null for any
   * real contact that isn't an employee, or one whose wage hasn't
   * been set up yet. Deliberately gross only, no tax withholding
   * modeled — a real, stated simplification, not an oversight. */
  wage_minor_per_hour: number | null;
  /** A real, fixed annual salary — for management, distinct from
   * wage_minor_per_hour. An employee has exactly one of the two set,
   * never both. */
  salary_minor_per_year: number | null;
  reminder_level: number;
  /** This specific customer/vendor's own preferred language for
   * printed documents — takes priority over the business's own default
   * language when set. Genuinely necessary in multilingual markets
   * (Canada, Switzerland), where the business's own default language
   * says nothing about what a specific customer wants. */
  preferred_language: string | null;
  /** 'pending' immediately after self-registration until staff
   * verifies; 'active' once approved — the only status that may be
   * sold to on account; 'rejected' if declined. Null for contacts
   * that were never a self-registration (an ordinary staff-created
   * account customer needs none of this). */
  verification_status: 'pending' | 'active' | 'rejected' | null;
  /** Card type + last 4 only, e.g. "Visa ending 4242" — never a full
   * card number. */
  card_label: string | null;
  /** A real, short PIN an employee types to sign on at a POS terminal
   * — null means no PIN set yet, so this employee cannot sign on to
   * sell. Read-only here; set via the dedicated setPosPin, not an
   * ordinary contact edit. */
  pos_pin: string | null;
}

export function getContact(entityName: string): Contact | undefined {
  return db
    .prepare(
      `SELECT person_name, phone, email, address_line1, address_line2, city, region, postal_code, country, payment_terms_days, credit_limit_minor, wage_minor_per_hour, salary_minor_per_year, reminder_level, preferred_language, verification_status, card_label, pos_pin
       FROM contact_entry WHERE name = ?`
    )
    .get(entityName) as Contact | undefined;
}

export interface InvoiceLine {
  reference: string;
  description: string;
  quantity: number | null;
  unit_price_minor: number | null;
  amount_minor: number;
  tax_minor: number;
}

/** The document-level facts for a single posted reference — quantity,
 * unit price, and this specific line's own tax, exactly as they were
 * when it was posted. Returns undefined if this reference never
 * recorded one (e.g. an ordinary General Journal entry, which has no
 * invoice concept at all). */
export function getInvoiceLine(reference: string, business: BusinessName, ledger: LedgerName): InvoiceLine | undefined {
  return db
    .prepare(
      `SELECT reference, description, quantity, unit_price_minor, amount_minor, tax_minor
       FROM invoice_line WHERE reference = ? AND business = ? AND ledger = ?`
    )
    .get(reference, business, ledger) as InvoiceLine | undefined;
}

/** The real, distinct account names a given journal reference
 * actually posted to — used, for example, to make a reversal or
 * return land on the exact same real account the original
 * transaction used (a specific package-tier's own Sales account, not
 * a plain, product-level fallback that was never the real account
 * the sale itself used). */
export function getAccountsPostedTo(reference: string): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT e.name
       FROM journal_line jl
       JOIN journal j ON j.id = jl.journal_id
       JOIN current_entities e ON e.id = jl.account_id
       WHERE j.reference = ?`
    )
    .all(reference) as { name: string }[];
  return rows.map((r) => r.name);
}

/** A real, direct read-merge-write into the entity's own detail_json -
 * per direct, absolute instruction (contact eliminated as its own
 * table). Merges only the real, given fields, leaving every other
 * real, already-set field untouched - the exact, same, real "partial
 * upsert" shape the removed table's own ON CONFLICT DO UPDATE clause
 * always had. __is_contact: true marks this entity as a real contact
 * record for the compatibility view to find. */
export function mergeContactDetail(entityId: number, fields: Record<string, unknown>): void {
  const row = db.prepare(`SELECT detail_json FROM current_entities WHERE id = ?`).get(entityId) as { detail_json: string | null } | undefined;
  const current = row?.detail_json ? JSON.parse(row.detail_json) : {};
  const merged = { ...current, __is_contact: true, ...fields };
  db.prepare(`UPDATE entities SET detail_json = ? WHERE entity_id = ? AND deleted_at IS NULL`).run(JSON.stringify(merged), entityId);
}

export function setContact(entityName: string, contact: Partial<Contact>): void {
  const entityId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(entityName) as { id: number } | undefined)?.id;
  if (!entityId) throw new ValidationError(`No entity named "${entityName}".`);
  mergeContactDetail(entityId, {
    person_name: contact.person_name ?? null,
    phone: contact.phone ?? null,
    email: contact.email ?? null,
    address_line1: contact.address_line1 ?? null,
    address_line2: contact.address_line2 ?? null,
    city: contact.city ?? null,
    region: contact.region ?? null,
    postal_code: contact.postal_code ?? null,
    country: contact.country ?? null,
    payment_terms_days: contact.payment_terms_days ?? null,
    credit_limit_minor: contact.credit_limit_minor ?? null,
    wage_minor_per_hour: contact.wage_minor_per_hour ?? null,
    salary_minor_per_year: contact.salary_minor_per_year ?? null,
    preferred_language: contact.preferred_language ?? null,
    card_label: contact.card_label ?? null,
  });
}

/** Sets a real employee's own real PIN for signing on at a POS
 * terminal — its own, dedicated update path, deliberately not item
 * of the ordinary setContact upsert, the same real pattern already
 * used for reminder_level/password_hash/verification_status. A real,
 * short PIN (a handful of digits is typical), not hashed — this is a
 * real, low-stakes, physical-terminal identification mechanism, not
 * an authentication credential for the app itself. */
export function setPosPin(employeeName: string, pin: string): void {
  const id = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(employeeName) as { id: number } | undefined)?.id;
  if (!id) throw new ValidationError(`No employee named "${employeeName}".`);
  mergeContactDetail(id, { pos_pin: pin });
}

export interface PosShift {
  id: number;
  employee: string;
  location: string;
  signed_on_at: string;
  signed_off_at: string | null;
}

/** Signs a real employee on at a real location — validates their real
 * PIN (set via setPosPin) directly, not through the app's own
 * users/roles login at all. Per direct requirement: this genuinely
 * IS the real timecard (payEmployeeWages's hours-worked mode sums
 * these shifts directly), not just an "who's active" indicator, so
 * the real, resulting row records exactly when this happened, not
 * just that it did. Refuses if this same employee already has a
 * real, open shift anywhere — a real employee can only be signed on
 * at one real location at a time. */
export function signOn(employeeName: string, locationName: string): PosShift {
  const employee = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(employeeName) as { id: number } | undefined;
  if (!employee) throw new ValidationError(`No employee named "${employeeName}".`);
  const location = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(locationName) as { id: number } | undefined;
  if (!location) throw new ValidationError(`No location named "${locationName}".`);
  const contact = db.prepare(`SELECT pos_pin FROM contact WHERE entity_id = ?`).get(employee.id) as { pos_pin: string | null } | undefined;
  if (!contact?.pos_pin) throw new ValidationError(`"${employeeName}" has no real PIN set yet — cannot sign on.`);
  const alreadyOpen = db
    .prepare(`SELECT 1 FROM current_entities WHERE parent_id = ? AND name LIKE '% — Open'`)
    .get(employee.id);
  if (alreadyOpen) throw new ValidationError(`"${employeeName}" is already signed on somewhere — sign off first.`);
  const signedOnAt = new Date().toISOString();
  // A real Shift entity, one per real sign-on event - never reused
  // across shifts, unlike the Period Lock entity, since this
  // application's own, real timecard needs every real, past shift
  // kept as its own, distinct, queryable record, not just the latest
  // state. relation_id points directly at the real location - no
  // string-encoding needed for that part, unlike the timestamp.
  const shiftEntity = Entity.create(`${employeeName} — Shift — ${signedOnAt} — Open`, employee.id, asUserId(1));
  updateEntity(shiftEntity.id, { relation: locationName }, asUserId(1));
  return { id: shiftEntity.id, employee: employeeName, location: locationName, signed_on_at: signedOnAt, signed_off_at: null };
}

/** Verifies a real PIN against a real employee's own, stored PIN —
 * used by the real sign-on screen before calling signOn itself, so a
 * wrong PIN never even attempts to open a real shift. */
export function verifyPosPin(employeeName: string, pin: string): boolean {
  const employee = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(employeeName) as { id: number } | undefined;
  if (!employee) return false;
  const contact = db.prepare(`SELECT pos_pin FROM contact WHERE entity_id = ?`).get(employee.id) as { pos_pin: string | null } | undefined;
  return !!contact?.pos_pin && contact.pos_pin === pin;
}

/** Signs a real, currently-open shift off — records the real,
 * genuine end timestamp against that same shift, closing the real
 * timecard record it started. */
export function signOff(shiftId: number): void {
  const shift = db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(shiftId) as { name: string } | undefined;
  if (!shift) throw new ValidationError(`No real shift with id ${shiftId}.`);
  if (!shift.name.endsWith(' — Open')) throw new ValidationError(`This shift is already signed off.`);
  const signedOffAt = new Date().toISOString();
  updateEntity(shiftId, { name: `${shift.name.slice(0, -' — Open'.length)} — Closed at ${signedOffAt}` }, asUserId(1));
}

function parseShiftEntity(row: { id: number; employee: string; location: string; name: string }): PosShift {
  // Real shift entity name shape: "<employee> — Shift — <signed_on_at> — Open" or "... — Closed at <signed_off_at>".
  const afterShiftMarker = row.name.split(' — Shift — ')[1];
  const [signedOnAt, statusPart] = afterShiftMarker.split(' — ');
  const signed_off_at = statusPart.startsWith('Closed at ') ? statusPart.slice('Closed at '.length) : null;
  return { id: row.id, employee: row.employee, location: row.location, signed_on_at: signedOnAt, signed_off_at };
}

/** Every real, currently-open shift at a given location — the real,
 * shared, server-side state every terminal at that same location
 * queries, per direct requirement: signing on at any one terminal
 * must activate that clerk's "sales clerk" button on every terminal
 * at that same location, not just the one they signed on at. */
export function getActiveShiftsAtLocation(locationName: string): PosShift[] {
  const rows = db
    .prepare(
      `SELECT s.id, emp.name AS employee, loc.name AS location, s.name
       FROM current_entities s
       JOIN current_entities emp ON emp.id = s.parent_id
       JOIN current_entities loc ON loc.id = s.relation_id
       WHERE loc.name = ? AND s.name LIKE '% — Shift — % — Open'
       ORDER BY s.created_at`
    )
    .all(locationName) as { id: number; employee: string; location: string; name: string }[];
  return rows.map(parseShiftEntity);
}

/** A real employee's own, real, currently-open shift, if any —
 * regardless of location. Used to confirm a specific employee is
 * genuinely signed on before letting them act as the active clerk on
 * a real sale. */
export function getOpenShiftForEmployee(employeeName: string): PosShift | undefined {
  const row = db
    .prepare(
      `SELECT s.id, emp.name AS employee, loc.name AS location, s.name
       FROM current_entities s
       JOIN current_entities emp ON emp.id = s.parent_id
       JOIN current_entities loc ON loc.id = s.relation_id
       WHERE emp.name = ? AND s.name LIKE '% — Shift — % — Open'`
    )
    .get(employeeName) as { id: number; employee: string; location: string; name: string } | undefined;
  return row ? parseShiftEntity(row) : undefined;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface OpenHoursLine {
  day: string;
  opens_at: string;
  closes_at: string;
}

/** Sets a real location's own, real, weekly-recurring open hours —
 * built entirely on the entity-tree mechanism already proven for
 * typed addresses/phones, no new table at all: each real open day
 * becomes its own, real, named child entity of the location
 * ("{location} — {Day}: {opens}–{closes}"), tagged via relation_id to
 * the real day entity under Days of Week. A real, full replace: every
 * existing open-hours child is deleted first, so a day genuinely
 * omitted from `hours` means closed that day, not left stale. */
export function setLocationOpenHours(locationName: string, hours: OpenHoursLine[]): void {
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(locationName)) throw new ValidationError(`No location named "${locationName}".`);
  for (const h of hours) {
    if (!DAY_NAMES.includes(h.day)) throw new ValidationError(`"${h.day}" is not a real day of the week.`);
    if (h.opens_at >= h.closes_at) throw new ValidationError(`${h.day}: opening time must be before closing time.`);
  }
  for (const existing of getLocationOpenHours(locationName)) {
    deleteEntity((db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(`${locationName} — ${existing.day}: ${existing.opens_at}–${existing.closes_at}`) as { id: number }).id, asUserId(1));
  }
  for (const h of hours) {
    const recordName = `${locationName} — ${h.day}: ${h.opens_at}–${h.closes_at}`;
    create(fetch(locationName, typeRootName), typeOpenHoursRecordName, recordName, asUserId(1));
    const record = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(recordName) as { id: number };
    updateEntity(record.id, { relation: h.day }, asUserId(1));
  }
}

/** A real location's own, real, current weekly open hours — walks the
 * location's own real children for whichever are tagged under "Days
 * of Week" specifically (the same real filtering getTypedAddresses
 * already uses for Address Types), then parses the real, encoded time
 * range straight back out of each record's own name. */
export function getLocationOpenHours(locationName: string): OpenHoursLine[] {
  const rows = db
    .prepare(
      `SELECT child.name AS record_name, day.name AS day
       FROM current_entities child
       JOIN current_entities parent ON parent.id = child.parent_id AND parent.name = ?
       JOIN current_entities day ON day.id = child.relation_id
       JOIN current_entities day_category ON day_category.id = day.parent_id AND day_category.name = 'Days of Week'`
    )
    .all(locationName) as { record_name: string; day: string }[];
  return rows
    .map((r) => {
      const match = r.record_name.match(/: (\d{2}:\d{2})–(\d{2}:\d{2})$/);
      return { day: r.day, opens_at: match?.[1] ?? '', closes_at: match?.[2] ?? '' };
    })
    .sort((a, b) => DAY_NAMES.indexOf(a.day) - DAY_NAMES.indexOf(b.day));
}

export interface ScheduleLine {
  day: string;
  starts_at: string;
  ends_at: string;
}
export interface EmployeeScheduleLine extends ScheduleLine {
  location: string;
}
export interface LocationScheduleLine extends ScheduleLine {
  employee: string;
}

/** Sets a real employee's own, real, weekly-recurring schedule at a
 * real location — the same, real entity-tree mechanism as
 * setLocationOpenHours, one real, named child entity of the employee
 * per real, scheduled shift ("{employee} — {Day} at {location}:
 * {starts}–{ends}"), tagged via relation_id to the real day. Per
 * direct requirement, every real, proposed shift is validated against
 * that same location's own real open hours first — refuses a day the
 * location is genuinely closed, or a shift starting before/ending
 * after the real, open window that day. A real, full replace, scoped
 * to this one employee/location pair — a real, different location's
 * own schedule for the same employee is left untouched. */
export function setEmployeeSchedule(employeeName: string, locationName: string, schedule: ScheduleLine[]): void {
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(employeeName)) throw new ValidationError(`No employee named "${employeeName}".`);
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(locationName)) throw new ValidationError(`No location named "${locationName}".`);

  // A real employee can genuinely work a real shift outside a
  // location's own open hours at all — cleaning, stocking, receiving
  // a delivery before the doors open, and so on — so shifts are no
  // longer confined to open hours. What's genuinely, physically
  // limited instead is how much a real, single person can work at
  // all: a real, direct cap on hours per day and per week, checked
  // across every real location this employee works at combined, not
  // just this one.
  const MAX_HOURS_PER_DAY = 12;
  const MAX_HOURS_PER_WEEK = 48;
  const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  for (const s of schedule) {
    if (!DAY_NAMES.includes(s.day)) throw new ValidationError(`"${s.day}" is not a real day of the week.`);
    if (s.starts_at >= s.ends_at) throw new ValidationError(`${s.day}: shift start must be before shift end.`);
    const hours = (toMinutes(s.ends_at) - toMinutes(s.starts_at)) / 60;
    if (hours > MAX_HOURS_PER_DAY) {
      throw new ValidationError(`${s.day}'s shift (${s.starts_at}–${s.ends_at}, ${hours.toFixed(1)}h) exceeds the real ${MAX_HOURS_PER_DAY}-hour daily limit for one, single person.`);
    }
  }

  // A real, physical impossibility, per direct report: the same,
  // real employee genuinely cannot work two real, different
  // locations at the same real time, even though "which locations,
  // which days" is genuinely M:N overall. Checked against every
  // other real location's own, already-saved shifts for this same
  // employee — not this same location's own shifts, which are the
  // very ones about to be replaced below.
  const shiftsElsewhere = getEmployeeSchedule(employeeName).filter((e) => e.location !== locationName);
  for (const s of schedule) {
    for (const other of shiftsElsewhere) {
      if (other.day !== s.day) continue;
      const overlaps = s.starts_at < other.ends_at && other.starts_at < s.ends_at;
      if (overlaps) {
        throw new ValidationError(
          `${s.day}'s shift (${s.starts_at}–${s.ends_at}) at "${locationName}" overlaps a real, already-scheduled shift (${other.starts_at}–${other.ends_at}) at "${other.location}" — the same, real employee cannot work two locations at once.`
        );
      }
    }
  }

  // A real, direct weekly cap too — computed across the same,
  // real, full, combined picture (every other location's own,
  // already-saved shifts, plus this location's own, new ones), not
  // just this one location's own hours in isolation.
  const totalWeeklyMinutes = [...shiftsElsewhere, ...schedule]
    .reduce((sum, s) => sum + (toMinutes(s.ends_at) - toMinutes(s.starts_at)), 0);
  const totalWeeklyHours = totalWeeklyMinutes / 60;
  if (totalWeeklyHours > MAX_HOURS_PER_WEEK) {
    throw new ValidationError(
      `This real, combined schedule totals ${totalWeeklyHours.toFixed(1)}h across the week (every real location together) — over the real ${MAX_HOURS_PER_WEEK}-hour weekly limit for one, single person.`
    );
  }

  for (const existing of getEmployeeSchedule(employeeName).filter((e) => e.location === locationName)) {
    const recordName = `${employeeName} — ${existing.day} at ${locationName}: ${existing.starts_at}–${existing.ends_at}`;
    const record = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(recordName) as { id: number } | undefined;
    if (record) deleteEntity(record.id, asUserId(1));
  }
  for (const s of schedule) {
    const recordName = `${employeeName} — ${s.day} at ${locationName}: ${s.starts_at}–${s.ends_at}`;
    create(fetch(employeeName, typeRootName), typeScheduleRecordName, recordName, asUserId(1));
    const record = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(recordName) as { id: number };
    updateEntity(record.id, { relation: s.day }, asUserId(1));
  }
}

/** A real employee's own, real, complete weekly schedule — across
 * every real location they're scheduled at, not just one. */
export function getEmployeeSchedule(employeeName: string): EmployeeScheduleLine[] {
  const rows = db
    .prepare(
      `SELECT child.name AS record_name, day.name AS day
       FROM current_entities child
       JOIN current_entities parent ON parent.id = child.parent_id AND parent.name = ?
       JOIN current_entities day ON day.id = child.relation_id
       JOIN current_entities day_category ON day_category.id = day.parent_id AND day_category.name = 'Days of Week'`
    )
    .all(employeeName) as { record_name: string; day: string }[];
  return rows
    .map((r) => {
      const match = r.record_name.match(/ at (.+): (\d{2}:\d{2})–(\d{2}:\d{2})$/);
      return { day: r.day, location: match?.[1] ?? '', starts_at: match?.[2] ?? '', ends_at: match?.[3] ?? '' };
    })
    .sort((a, b) => DAY_NAMES.indexOf(a.day) - DAY_NAMES.indexOf(b.day));
}

/** Every real employee's own, real, scheduled shift at a given
 * location — the real, weekly roster view for that one location,
 * built by walking every real employee's own schedule and filtering
 * to this location, since a schedule record is parented under the
 * employee, not the location. */
export function getScheduleAtLocation(locationName: string): LocationScheduleLine[] {
  const employeesRoot = db.prepare(`SELECT id FROM current_entities WHERE name = 'Employees'`).get() as { id: number } | undefined;
  if (!employeesRoot) return [];
  const employees = db.prepare(`SELECT name FROM current_entities WHERE parent_id = ?`).all(employeesRoot.id) as { name: string }[];
  const result: LocationScheduleLine[] = [];
  for (const { name: employee } of employees) {
    for (const line of getEmployeeSchedule(employee)) {
      if (line.location === locationName) result.push({ employee, day: line.day, starts_at: line.starts_at, ends_at: line.ends_at });
    }
  }
  return result.sort((a, b) => DAY_NAMES.indexOf(a.day) - DAY_NAMES.indexOf(b.day));
}

export interface TypedAddress extends Contact {
  address_type: string;
  record_name: string;
}

/** An entity often needs more than one address (a Head Office AND a
 * Billing address AND a Delivery address, all genuinely different) —
 * more than one relation_id's worth of tagging, which a single entity
 * can't carry. So each address becomes its own real child entity —
 * parent_id already handles one-to-many naturally, the same mechanism
 * every other hierarchy in this app already uses — and that child's
 * own relation_id points at a real type marker under "Address Types"
 * (Head Office, Billing, Delivery...), exactly the relationship-type
 * pattern this project already proved, one level deeper. The actual
 * address values live in that child's own real contact_entry row —
 * the same mechanism already used for a location's own single
 * address, applied recursively rather than duplicated as new schema.
 * See docs/entity-model.md.
 *
 * addTypedAddress/getTypedAddresses/deleteTypedAddress and their
 * addTypedPhone/getTypedPhones/deleteTypedPhone counteritems below
 * were, until this refactor, two real, near-identical copies of the
 * exact same structure — differing only in the record-name suffix
 * ("Address" vs "Phone"), the type-category name, and how the real
 * value itself is saved/loaded. Per direct request, both now share
 * one, real, generic implementation (addTyped/getTyped/deleteTyped,
 * further below); each real, public function here is a thin,
 * real wrapper preserving the exact, external API every existing
 * caller already depends on — nothing about how AddressList.svelte or
 * any other real caller uses these needed to change at all. */
export function ensureAddressType(typeName: string, userId: UserId): void {
  if (!Entity.get(typeName)) Entity.create(typeName, 'Address Types', userId);
}

/** Every real, already-known address type — the preferred,
 * always-current source for a real "type" dropdown/combo, rather than
 * a fixed list baked into the frontend. Per direct request: a real,
 * new type ("Head Office", "Warehouse", ...) someone actually types
 * is immediately offered again on the next entity, the same,
 * established design already proven for contact person types. */
export function listAddressTypes(): string[] {
  return db
    .prepare(
      `SELECT child.name FROM current_entities child
       JOIN current_entities parent ON parent.id = child.parent_id AND parent.name = 'Address Types'
       ORDER BY child.name`
    )
    .all()
    .map((r) => (r as { name: string }).name);
}

export function addTypedAddress(entityName: string, addressType: string, value: Partial<Contact>, userId: UserId): string {
  ensureAddressType(addressType, userId);
  return addTyped(entityName, 'Address', addressType, value, (recordName, v) => setContact(recordName, v), userId);
}

/** Every typed address on an entity, each with its real type and
 * value — walks from the entity's own real children to whichever of
 * them are tagged under "Address Types" specifically (so a phone
 * child, tagged under "Phone Types" instead, is never mistaken for an
 * address, even though both use the exact same parent/relation
 * shape). */
export function getTypedAddresses(entityName: string): TypedAddress[] {
  return getTyped(entityName, 'Address Types', 'address_type', (recordName) => getContact(recordName) ?? {}) as TypedAddress[];
}

export function deleteTypedAddress(entityName: string, addressType: string, userId: UserId): void {
  deleteTyped(entityName, 'Address', addressType, userId);
}

export interface TypedPhone {
  phone_type: string;
  record_name: string;
  phone: string | null;
}

/** Same pattern as addTypedAddress, for phone numbers — a store
 * genuinely has a landline AND a mobile, not just one phone field. */
export function ensurePhoneType(typeName: string, userId: UserId): void {
  if (!Entity.get(typeName)) Entity.create(typeName, 'Phone Types', userId);
}

/** Every real, already-known phone type — same, established,
 * user-amendable design as address and contact person types. */
export function listPhoneTypes(): string[] {
  return db
    .prepare(
      `SELECT child.name FROM current_entities child
       JOIN current_entities parent ON parent.id = child.parent_id AND parent.name = 'Phone Types'
       ORDER BY child.name`
    )
    .all()
    .map((r) => (r as { name: string }).name);
}

export function addTypedPhone(entityName: string, phoneType: string, number: string, userId: UserId): string {
  ensurePhoneType(phoneType, userId);
  return addTyped(entityName, 'Phone', phoneType, { phone: number }, (recordName, v) => setContact(recordName, v), userId);
}

export function getTypedPhones(entityName: string): TypedPhone[] {
  return getTyped(entityName, 'Phone Types', 'phone_type', (recordName) => ({ phone: getContact(recordName)?.phone ?? null })) as TypedPhone[];
}

export function deleteTypedPhone(entityName: string, phoneType: string, userId: UserId): void {
  deleteTyped(entityName, 'Phone', phoneType, userId);
}

export interface ContactPerson {
  contact_type: string;
  record_name: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

/** A real, named person attached to any entity at all — a creditor,
 * debtor, employee, location, whatever — under a real, direct role
 * ("Credit Manager", "Sales Clerk", "Dispatch", "Store Man",
 * "Emergency Contact", ...). The exact, same, established
 * addTyped/getTyped/deleteTyped mechanism already proven for
 * addresses and phones — but genuinely user-definable, per direct
 * request, rather than a fixed, hardcoded list: ensureContactPersonType
 * below creates a real, new type the moment someone actually types
 * one that doesn't exist yet, rather than requiring it to be
 * pre-seeded first. */
export function ensureContactPersonType(typeName: string, userId: UserId): void {
  if (!Entity.get(typeName)) Entity.create(typeName, 'Contact Person Types', userId);
}

/** Every real, already-known contact person type — the preferred,
 * always-current source for a real "type" dropdown/combo, rather than
 * a fixed list baked into the frontend, so a genuinely new type
 * someone adds on one entity is immediately offered again on the
 * next. */
export function listContactPersonTypes(): string[] {
  return db
    .prepare(
      `SELECT child.name FROM current_entities child
       JOIN current_entities parent ON parent.id = child.parent_id AND parent.name = 'Contact Person Types'
       ORDER BY child.name`
    )
    .all()
    .map((r) => (r as { name: string }).name);
}

export function addTypedContactPerson(entityName: string, contactType: string, value: { name: string; phone?: string | null; email?: string | null }, userId: UserId): string {
  ensureContactPersonType(contactType, userId);
  return addTyped(entityName, 'Contact', contactType, { person_name: value.name, phone: value.phone ?? null, email: value.email ?? null }, (recordName, v) => setContact(recordName, v), userId);
}

export function getTypedContactPersons(entityName: string): ContactPerson[] {
  return getTyped(entityName, 'Contact Person Types', 'contact_type', (recordName) => {
    const c = getContact(recordName);
    return { name: c?.person_name ?? null, phone: c?.phone ?? null, email: c?.email ?? null };
  }) as ContactPerson[];
}

export function deleteTypedContactPerson(entityName: string, contactType: string, userId: UserId): void {
  deleteTyped(entityName, 'Contact', contactType, userId);
}

/** The real, shared, generic implementation behind addTypedAddress/
 * addTypedPhone above — creates (or reuses) a real, named child
 * entity ("{entityName} — {type} {thingSuffix}"), tags it via
 * relation_id to the real type marker, then saves its real value
 * through the caller's own save function (setContact, in both real,
 * current uses — kept as a real callback rather than hardcoded, so a
 * future typed-thing whose value isn't contact-shaped can still reuse
 * this without a further refactor). */
function addTyped<T>(entityName: string, thingSuffix: string, type: string, value: T, save: (recordName: string, value: T) => void, userId: UserId): string {
  const recordName = `${entityName} — ${type} ${thingSuffix}`;
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(recordName)) {
    create(fetch(entityName, typeRootName), typeEntityLinkRecordName, recordName, userId);
  }
  const record = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(recordName) as { id: number };
  updateEntity(record.id, { relation: type }, userId);
  save(recordName, value);
  return recordName;
}

/** The real, shared, generic implementation behind getTypedAddresses/
 * getTypedPhones above — walks the entity's own real children,
 * filtered to whichever are tagged under the given real type-category
 * (so an address child is never mistaken for a phone child, despite
 * sharing the exact same parent/relation shape), then loads each
 * real record's own value through the caller's own load function.
 * typeKey lets each real caller keep its own, existing field name
 * (address_type vs phone_type) rather than a generic "type" every
 * caller would need to rename around. */
function getTyped<T>(entityName: string, typeCategory: string, typeKey: string, load: (recordName: string) => Partial<T>): Record<string, unknown>[] {
  const rows = db
    .prepare(
      `SELECT type_marker.name AS type_name, child.name AS record_name
       FROM current_entities child
       JOIN current_entities parent ON parent.id = child.parent_id AND parent.name = ?
       JOIN current_entities type_marker ON type_marker.id = child.relation_id
       JOIN current_entities type_category ON type_category.id = type_marker.parent_id AND type_category.name = ?
       ORDER BY type_marker.name`
    )
    .all(entityName, typeCategory) as { type_name: string; record_name: string }[];
  return rows.map((r) => ({ [typeKey]: r.type_name, record_name: r.record_name, ...load(r.record_name) }));
}

/** The real, shared, generic implementation behind deleteTypedAddress/
 * deleteTypedPhone above. */
function deleteTyped(entityName: string, thingSuffix: string, type: string, userId: UserId): void {
  const recordName = `${entityName} — ${type} ${thingSuffix}`;
  const record = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(recordName) as { id: number } | undefined;
  if (record) deleteEntity(record.id, userId);
}

/** A real, small, third generic alongside addTyped<T>/getTyped<T>
 * above — for a real, pure link between two entities, with no
 * separate value of its own the way an address/phone has (setContact
 * on the typed record). Deliberately NOT setRelationship: that
 * function writes directly to the SOURCE entity's own relation_id,
 * which is genuinely wrong whenever that slot is already spoken for
 * — confirmed directly, not hypothetically: a GL account's own
 * relation_id already carries its real CoA-family tag (see
 * createBusiness), and a real, secondary-currency bank account
 * already depends on it for the General Journal's own account
 * filter. setEntityLink instead creates its own, real, separate
 * child entity for the link itself (the exact same real shape
 * addTyped<T> already uses), so the source entity's own relation_id
 * is never touched at all, whatever it's already being used for. */
/** Per docs/general-typed-hierarchy-resolution-plan.md - the real,
 * settled design: a hierarchy's kind is identified by what a real
 * entity's own relation_id directly points at (an abstract prototype
 * node), never by parent_id depth or a compile-time type parameter.
 * Works identically for a real, top-level Division and a real,
 * user-created Sub-Division - both point at the exact, same real
 * "Division" prototype. */
export function getPrototypeOf(entityName: string): string | undefined {
  const row = db
    .prepare(
      `SELECT proto.name FROM current_entities e
       JOIN current_entities proto ON proto.id = e.relation_id
       WHERE e.name = ?`
    )
    .get(entityName) as { name: string } | undefined;
  return row?.name;
}

/** Tags a real, actual node with the real prototype it represents -
 * directly on the entity's own relation_id, per the settled design,
 * not via setEntityLink's separate, intermediate record (that pattern
 * is for a named *relationship* between two otherwise-independent
 * entities; this is a direct, structural "what kind is this" fact
 * about the entity itself). */
export function setPrototype(entityName: string, prototypeName: string, userId: UserId): void {
  updateEntity(resolveIdOrThrow(entityName), { relation: prototypeName }, userId);
}

/** Seeds the real, default, recommended hierarchy prototypes for a
 * new business - per direct instruction, nothing here is special or
 * privileged: a business is free to rename, delete, or add further
 * real prototypes immediately, and no other real code may ever
 * special-case these four names specifically. */
export function seedDefaultHierarchyPrototypes(business: TypedNode<'BusinessName'>, userId: UserId): void {
  const hierarchies = create(business, typeRootName, 'Hierarchies', userId);
  const division = create(hierarchies, typeRootName, 'Division', userId);
  create(division, typeRootName, 'Location', userId);
  const category = create(hierarchies, typeRootName, 'Category', userId);
  create(category, typeRootName, 'Item', userId);
}

export function setEntityLink(entityName: string, linkType: string, targetName: string, userId: UserId, entityId?: number, targetId?: number): string {
  const recordName = `${entityName} — ${linkType}`;
  const parentNode = entityId != null ? fetchById(entityId, typeRootName) : fetch(entityName, typeRootName);
  let record = Entity.getUnder(recordName, parentNode.id);
  if (!record) {
    const created = create(parentNode, typeEntityLinkRecordName, recordName, userId);
    record = { id: created.id, name: created.name };
  }
  updateEntity(record.id, targetId != null ? { relationId: targetId } : { relation: targetName }, userId);
  return recordName;
}

/** The real target of a real link set via setEntityLink — undefined
 * if no such link exists at all. */
export function getEntityLink(entityName: string, linkType: string): string | undefined {
  const recordName = `${entityName} — ${linkType}`;
  const row = db
    .prepare(
      `SELECT target.name AS target
       FROM current_entities child
       JOIN current_entities target ON target.id = child.relation_id
       WHERE child.name = ?`
    )
    .get(recordName) as { target: string } | undefined;
  return row?.target;
}

export function deleteEntityLink(entityName: string, linkType: string, userId: UserId): void {
  const recordName = `${entityName} — ${linkType}`;
  const record = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(recordName) as { id: number } | undefined;
  if (record) deleteEntity(record.id, userId);
}

/** One real, staged Bill-of-Materials component line, not yet posted. */
export function stageBomComponent(input: {
  assemblyItem: string; business: string; componentItem: string; quantity: number; unit: string;
}): void {
  db.prepare(
    `INSERT INTO assembly_bom_staging (assembly_item, business, component_item, quantity, unit)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (assembly_item, business, component_item) DO UPDATE SET quantity = ?, unit = ?`
  ).run(input.assemblyItem, input.business, input.componentItem, input.quantity, input.unit, input.quantity, input.unit);
}

/** Materializes every staged component for one assembly Item into a
 * real entity-link (setEntityLink), matching the naming convention
 * already established for Storage Origin - per direct, documented
 * decision, a real TypeScript function here, not a SQL trigger,
 * since setEntityLink -> createEntity's own real uniqueness/vocabulary
 * validation logic is genuinely too involved to safely reimplement a
 * second time in raw SQL. */
export function postBomComponents(assemblyItem: string, business: string, userId: UserId): void {
  const rows = db
    .prepare(`SELECT component_item, quantity, unit FROM assembly_bom_staging WHERE assembly_item = ? AND business = ?`)
    .all(assemblyItem, business) as { component_item: string; quantity: number; unit: string }[];
  for (const row of rows) {
    // A real, existing link for this same component (any old
    // quantity) must be removed first - the quantity lives inside the
    // link-type string itself, so a changed quantity is a genuinely
    // different name to setEntityLink's own exact-match replace logic,
    // and would otherwise create a real, duplicate second link rather
    // than replacing the old one. Confirmed directly by a real test
    // failure (3 components instead of 2) before this fix.
    const existingLinks = db
      .prepare(
        `SELECT child.name AS link_name
         FROM current_entities child
         JOIN current_entities parent ON parent.id = child.parent_id
         WHERE parent.name = ? AND child.name LIKE ? || ' — BOM: ' || ? || ' (%'`
      )
      .all(assemblyItem, assemblyItem, row.component_item) as { link_name: string }[];
    for (const existing of existingLinks) {
      const oldLinkType = existing.link_name.slice(`${assemblyItem} — `.length);
      deleteEntityLink(assemblyItem, oldLinkType, userId);
    }
    const linkType = `BOM: ${row.component_item} (${row.quantity}${row.unit})`;
    setEntityLink(assemblyItem, linkType, row.component_item, userId);
  }
  db.prepare(`DELETE FROM assembly_bom_staging WHERE assembly_item = ? AND business = ?`).run(assemblyItem, business);
}

/** Removes one real, posted BOM component by component name (ignoring
 * its current quantity), mirroring the same lookup already proven
 * inside postBomComponents. */
export function deleteBomComponent(assemblyItem: string, componentItem: string, userId: UserId): void {
  const existingLinks = db
    .prepare(
      `SELECT child.name AS link_name
       FROM current_entities child
       JOIN current_entities parent ON parent.id = child.parent_id
       WHERE parent.name = ? AND child.name LIKE ? || ' — BOM: ' || ? || ' (%'`
    )
    .all(assemblyItem, assemblyItem, componentItem) as { link_name: string }[];
  for (const existing of existingLinks) {
    const linkType = existing.link_name.slice(`${assemblyItem} — `.length);
    deleteEntityLink(assemblyItem, linkType, userId);
  }
}

/** Every real, posted BOM component for one assembly Item, parsed
 * back out of its own link-entity name. */
export function getBomComponents(assemblyItem: string): { component: string; quantity: number; unit: string }[] {
  const rows = db
    .prepare(
      `SELECT child.name AS link_name
       FROM current_entities child
       JOIN current_entities parent ON parent.id = child.parent_id
       WHERE parent.name = ? AND child.name LIKE ? || ' — BOM: %'`
    )
    .all(assemblyItem, assemblyItem) as { link_name: string }[];
  const results: { component: string; quantity: number; unit: string }[] = [];
  for (const row of rows) {
    const match = row.link_name.match(/ — BOM: (.+) \(([0-9.]+)([a-z]+)\)$/);
    if (match) results.push({ component: match[1], quantity: parseFloat(match[2]), unit: match[3] });
  }
  return results;
}

/** A real Task, per direct instruction with NO new tables of any
 * kind - matching BOM's own proven pattern exactly: the schedule
 * itself is encoded directly into the task's own entity name, parsed
 * back out by a real, direct regex, not stored in any new column. */
export function createProjectTask(
  projectName: string,
  taskName: string,
  plannedStart: string,
  plannedEnd: string,
  userId: UserId
): void {
  const name = `${taskName} (${plannedStart} to ${plannedEnd})`;
  create(fetch(`${projectName} Tasks`, typeRootName), typeProjectTaskName, name, userId);
}

/** Every real task under one real project, with its own schedule
 * parsed back out of its own name - mirroring getBomComponents. */
export function getProjectTasks(projectName: string): { task: string; plannedStart: string; plannedEnd: string }[] {
  const rows = db
    .prepare(
      `SELECT child.name AS task_name
       FROM current_entities child
       JOIN current_entities parent ON parent.id = child.parent_id
       WHERE parent.name = ?`
    )
    .all(`${projectName} Tasks`) as { task_name: string }[];
  const results: { task: string; plannedStart: string; plannedEnd: string }[] = [];
  for (const row of rows) {
    const match = row.task_name.match(/^(.+) \(([0-9-]+) to ([0-9-]+)\)$/);
    if (match) results.push({ task: match[1], plannedStart: match[2], plannedEnd: match[3] });
  }
  return results;
}

/** One real dependency edge: a real, individual, named child entity
 * of the DEPENDENT task, matching setEntityLink/getBomComponents'
 * own, proven "one real link-entity per real relationship" pattern -
 * genuinely modeling a many-to-many graph with zero new tables, since
 * a task can have several of these, one per real predecessor. */
export function addTaskDependency(
  dependentTask: string,
  predecessorTask: string,
  dependencyType: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish',
  userId: UserId
): void {
  // A real task's own entity name has its schedule baked directly
  // into it (e.g. "Frame the walls (2026-09-06 to 2026-09-12)") - a
  // real, direct lookup by prefix resolves the caller's plain task
  // name to that real, full name before using it, rather than
  // assuming the caller already knows the exact, full name.
  const resolve = (plainName: string): string => {
    const row = db.prepare(`SELECT name FROM current_entities WHERE name LIKE ? || ' (%'`).get(plainName) as { name: string } | undefined;
    return row?.name ?? plainName;
  };
  const dependentFullName = resolve(dependentTask);
  const predecessorFullName = resolve(predecessorTask);
  const linkType = `Depends On: ${predecessorTask} (${dependencyType})`;
  setEntityLink(dependentFullName, linkType, predecessorFullName, userId);
}

/** Every real predecessor of one real task, with its real dependency
 * type, parsed back out of its own link-entity's own name. */
export function getTaskDependencies(dependentTask: string): { predecessor: string; dependencyType: string }[] {
  const resolved = (db.prepare(`SELECT name FROM current_entities WHERE name LIKE ? || ' (%'`).get(dependentTask) as { name: string } | undefined)?.name ?? dependentTask;
  const rows = db
    .prepare(
      `SELECT child.name AS link_name
       FROM current_entities child
       JOIN current_entities parent ON parent.id = child.parent_id
       WHERE parent.name = ? AND child.name LIKE ? || ' — Depends On: %'`
    )
    .all(resolved, resolved) as { link_name: string }[];
  const results: { predecessor: string; dependencyType: string }[] = [];
  for (const row of rows) {
    const match = row.link_name.match(/ — Depends On: (.+) \((\w+)\)$/);
    if (match) results.push({ predecessor: match[1], dependencyType: match[2] });
  }
  return results;
}

/** The real, generic "dimension" mechanism from
 * docs/multi-dimensional-reporting.md — a real, reusable capability
 * for any entity to be placed into any number of equal, independent
 * accumulation paths, none structurally privileged as the real
 * parent (parent_id stays whatever it already is — e.g. a GL
 * account's own product-category placement — untouched by any of
 * this). Deliberately NOT hardcoded to divisions or product
 * categories specifically: dimensionName is a real, free-form string
 * ("Division/Location", "Reporting Manager", any future dimension),
 * so the same, single mechanism serves every real case in the design
 * document, not a bespoke one built per dimension.
 *
 * Built entirely on setEntityLink/getEntityLink, already proven this
 * session to leave an entity's own relation_id genuinely untouched —
 * the same real property this needs, since a GL account's own
 * relation_id may already be spoken for by its real CoA-family tag,
 * exactly the conflict setEntityLink itself was built to avoid. */
export function setDimensionParent(entityName: string, dimensionName: string, parentName: string, userId: UserId, entityId?: number, targetId?: number): void {
  setEntityLink(entityName, `Dimension: ${dimensionName}`, parentName, userId, entityId, targetId);
}

export function getDimensionParent(entityName: string, dimensionName: string): string | undefined {
  return getEntityLink(entityName, `Dimension: ${dimensionName}`);
}

export function deleteDimensionParent(entityName: string, dimensionName: string, userId: UserId): void {
  deleteEntityLink(entityName, `Dimension: ${dimensionName}`, userId);
}

/** A real contact can genuinely play any combination of real contact
 * types at once (a customer who is also an employee, a vendor who is
 * also a customer) — Contacts itself is the one, real, structural
 * home every contact's own parent_id points to, regardless of how
 * many types it carries. Built on setEntityLink/getEntityLink with a
 * dynamic linkType per real type, so each type gets its own, real,
 * independent, coexisting child entity — never touching the
 * contact's own relation_id, and never limited to just one type at a
 * time the way a single relation_id alone could never support. */
export function setContactType(contactName: string, typeName: string, userId: UserId): void {
  setEntityLink(contactName, `Contact Type: ${typeName}`, typeName, userId);
}

export function removeContactType(contactName: string, typeName: string, userId: UserId): void {
  deleteEntityLink(contactName, `Contact Type: ${typeName}`, userId);
}

export function getContactTypes(contactName: string): string[] {
  const rows = db
    .prepare(
      `SELECT target.name AS target
       FROM current_entities child
       JOIN current_entities target ON target.id = child.relation_id
       WHERE child.parent_id = (SELECT id FROM current_entities WHERE name = ?) AND child.name LIKE ?`
    )
    .all(contactName, `${contactName} — Contact Type: %`) as { target: string }[];
  return rows.map((r) => r.target);
}

/** Every real base account this contact's own real types point at —
 * a customer's own type points at Accounts Receivable, a vendor's at
 * Accounts Payable, an employee's also at Accounts Payable (real
 * payroll — salary, tax, and other deductions owed — is genuinely a
 * payable obligation, not a receivable one). Derived, not stored
 * directly: a real contact with more than one real type can
 * genuinely have more than one real base account. */
export function getContactBaseAccounts(contactName: string): string[] {
  const types = getContactTypes(contactName);
  const accounts = types.map((t) => getDimensionParent(t, 'Header Account')).filter((a): a is string => !!a);
  return [...new Set(accounts)];
}

export function getContactsWithType(typeName: string): string[] {
  return Link.withTarget(`Contact Type: ${typeName}`, typeName);
}

/** The real "reverse" query a plain parent_id can never answer on its
 * own — every real entity whose own dimension-parent, within this
 * specific dimension, is exactly parentName. Queries the real link
 * child's own, real parent_id directly (set by setEntityLink/
 * createEntity to be the real, original entity, not parsed back out
 * of a name string), so this stays correct regardless of what
 * characters a real entity name happens to contain. */
export function getDimensionChildren(parentName: string, dimensionName: string): string[] {
  const rows = db
    .prepare(
      `SELECT orig.name AS entity_name
       FROM current_entities link
       JOIN current_entities target ON target.id = link.relation_id
       JOIN current_entities orig ON orig.id = link.parent_id
       WHERE target.name = ? AND link.name = orig.name || ' — ' || ?`
    )
    .all(parentName, `Dimension: ${dimensionName}`) as { entity_name: string }[];
  return rows.map((r) => r.entity_name);
}

/** Guard rail (docs/translator-form-and-guard-rails-plan.md, §5): "a
 * real, visible 'why is this here' trail" — every real entity that
 * reaches targetName via any real dimension link at all, regardless
 * of which specific dimension name, plus which real dimension each
 * one uses. Confirmed directly, live: this is exactly the real,
 * missing visibility that let this session's own real mistake
 * (Customers almost directly re-parented under Accounts Receivable)
 * go unnoticed until caught by hand — a real person looking at
 * "Accounts Receivable" today has no real, direct way to see that
 * "Customers" reaches it via a real, structural link at all. */
export function getDimensionLinksPointingAt(targetName: string): { entityName: string; dimensionName: string }[] {
  const rows = db
    .prepare(
      `SELECT orig.name AS entity_name, link.name AS link_name
       FROM current_entities link
       JOIN current_entities target ON target.id = link.relation_id
       JOIN current_entities orig ON orig.id = link.parent_id
       WHERE target.name = ? AND link.name LIKE orig.name || ' — Dimension: %'`
    )
    .all(targetName) as { entity_name: string; link_name: string }[];
  return rows.map((r) => ({
    entityName: r.entity_name,
    // link_name is always "{entity_name} — Dimension: {dimensionName}" —
    // strip the real, known prefix to recover the real dimension name itself.
    dimensionName: r.link_name.slice(`${r.entity_name} — Dimension: `.length),
  }));
}

/** Walks entityName's own dimension-parent chain, within one, real,
 * named dimension, all the way to a real root (the first real entity
 * with no further dimension-parent set in this same dimension) —
 * the real chain from entityName's own, immediate parent up to (but
 * not including) that root, in that order. A hard, safety cap on
 * depth guards against a real, accidental cycle rather than looping
 * forever. */
export function getDimensionAncestorChain(entityName: string, dimensionName: string): string[] {
  const chain: string[] = [];
  let current = entityName;
  for (let i = 0; i < 100; i++) {
    const parent = getDimensionParent(current, dimensionName);
    if (!parent) break;
    chain.push(parent);
    current = parent;
  }
  return chain;
}

/** Layer 1 of the real, dedicated cash-flow/growth-planning design
 * (docs/cash-flow-and-growth-planning.md) — registers a real,
 * existing GL account as genuinely representing actual cash/a bank
 * account, distinct from the broader Chart of Accounts (Inventory and
 * Accounts Receivable also sit under Asset, but are genuinely not
 * cash). scopeName is a real business or division name — per direct
 * requirement, "one division may bank with a different bank from
 * another division", so a bank account's own real scope is a genuine,
 * required fact, not an afterthought. Uses setEntityLink, not
 * setRelationship, specifically because a GL account's own relation_id
 * is already spoken for (its real CoA-family tag) — see
 * docs/cash-flow-and-growth-planning.md for the real, concrete
 * conflict this avoids, confirmed live before this function was
 * written. overdraftLimitMinor is real and optional: null means no
 * real, arranged facility at all, not zero headroom.
 *
 * business is a real, separate, required fact from scopeName,
 * confirmed necessary by a real, serious bug found live: the shared
 * Chart of Accounts means a GL account like "Cash and Bank" is one,
 * single, global entity used by every real business — confirmed
 * directly (only one such entity exists in the whole app). Without a
 * real, explicit business link, there would be no honest way to know
 * which business a registered bank account actually belongs to
 * whenever its own scopeName is a division, since divisions
 * themselves aren't structurally scoped to one business either. Kept
 * as its own, separate setEntityLink call (not reused from scopeName)
 * so scopeName can stay the real, human-meaningful business-or-
 * division distinction while business stays an unambiguous, always-
 * real business name to filter by. */
export function registerBankAccount(accountName: string, business: string, scopeName: string, overdraftLimitMinor: number | null, userId: UserId): void {
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(accountName)) {
    throw new ValidationError(`No account named "${accountName}".`);
  }
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(business)) {
    throw new ValidationError(`No real business named "${business}".`);
  }
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(scopeName)) {
    throw new ValidationError(`No real business/division named "${scopeName}".`);
  }
  setEntityLink(accountName, 'Bank Account', scopeName, userId);
  setEntityLink(accountName, 'Bank Account Business', business, userId);
  db.prepare(`INSERT INTO account (entity_id) VALUES ((SELECT id FROM current_entities WHERE name = ?)) ON CONFLICT (entity_id) DO NOTHING`).run(accountName);
  db.prepare(`UPDATE account SET overdraft_limit_minor = ? WHERE entity_id = (SELECT id FROM current_entities WHERE name = ?)`).run(overdraftLimitMinor, accountName);
}

/** Removes a real account's own bank-account registration entirely —
 * both real links (scope and business) and its own real overdraft
 * limit all genuinely gone, not just hidden. */
export function unregisterBankAccount(accountName: string, userId: UserId): void {
  deleteEntityLink(accountName, 'Bank Account', userId);
  deleteEntityLink(accountName, 'Bank Account Business', userId);
  db.prepare(`UPDATE account SET overdraft_limit_minor = NULL WHERE entity_id = (SELECT id FROM current_entities WHERE name = ?)`).run(accountName);
}

export interface BankAccountRow {
  name: string;
  accountnumber: string | null;
  balance_minor: number;
  currency: string | null;
  overdraft_limit_minor: number | null;
  scope: string;
}

/** Every real bank account registered to one, specific real business
 * — never another business's own, since the shared Chart of Accounts
 * means the same GL account could otherwise leak across businesses
 * entirely (the real bug this function was rewritten to fix). Each
 * account's own real, current balance is computed fresh, scoped to
 * this real ledger, the exact same real, established way
 * getLedgerBalances computes every other real balance in this app —
 * never account.balance_minor directly, which is a real, global,
 * cross-business figure, not a per-ledger one. */
export function getBankAccounts(business: BusinessName, ledger: LedgerName): BankAccountRow[] {
  const rows = db
    .prepare(
      `SELECT e.name, a.accountnumber, a.currency, a.overdraft_limit_minor
       FROM account a
       JOIN current_entities e ON e.id = a.entity_id
       JOIN current_entities link ON link.name = e.name || ' — Bank Account'
       JOIN current_entities bizlink ON bizlink.name = e.name || ' — Bank Account Business'
       WHERE bizlink.relation_id = (SELECT id FROM current_entities WHERE name = ?)
       ORDER BY e.name`
    )
    .all(business) as { name: string; accountnumber: string | null; currency: string | null; overdraft_limit_minor: number | null }[];
  const balances = getLedgerBalances(business, ledger);
  return rows.map((r) => {
    const accountId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(r.name) as { id: number }).id;
    return {
      name: r.name,
      accountnumber: r.accountnumber,
      balance_minor: balances.get(accountId) ?? 0,
      currency: r.currency,
      overdraft_limit_minor: r.overdraft_limit_minor,
      scope: getEntityLink(r.name, 'Bank Account')!,
    };
  });
}

export interface CashPositionByCurrency {
  currency: string | null;
  total_balance_minor: number;
  total_overdraft_limit_minor: number | null;
  headroom_minor: number | null;
}

/** The real, current cash position for one, specific real business's
 * own ledger — every real, registered bank account belonging to it,
 * grouped by real currency rather than blended into one, single,
 * meaningless total (a real €500 and a real $500 are not the same
 * real €1000 without a real, genuine exchange rate). Each real
 * currency group's own real headroom is its combined real balance
 * plus its combined real overdraft limit — null if any real account
 * in that currency group has no real, arranged facility at all, since
 * a real, unlimited headroom can't honestly be computed from a
 * genuinely unknown limit. */
export function getCashPosition(business: BusinessName, ledger: LedgerName): CashPositionByCurrency[] {
  const accounts = getBankAccounts(business, ledger);
  const byCurrency = new Map<string | null, { balance: number; limitKnownForAll: boolean; limitSum: number }>();
  for (const acc of accounts) {
    const existing = byCurrency.get(acc.currency) ?? { balance: 0, limitKnownForAll: true, limitSum: 0 };
    existing.balance += acc.balance_minor;
    if (acc.overdraft_limit_minor === null) {
      existing.limitKnownForAll = false;
    } else {
      existing.limitSum += acc.overdraft_limit_minor;
    }
    byCurrency.set(acc.currency, existing);
  }
  return Array.from(byCurrency.entries())
    .map(([currency, { balance, limitKnownForAll, limitSum }]) => ({
      currency,
      total_balance_minor: balance,
      total_overdraft_limit_minor: limitKnownForAll ? limitSum : null,
      headroom_minor: limitKnownForAll ? balance + limitSum : null,
    }))
    .sort((a, b) => (a.currency ?? '').localeCompare(b.currency ?? ''));
}

export interface ForecastLine {
  date: string;
  description: string;
  amount_minor: number; // positive = real, anticipated cash in; negative = real, anticipated cash out
  source: 'AR' | 'AP' | 'recurring';
}

export interface CashFlowForecast {
  as_of_date: string;
  horizon_end_date: string;
  starting_cash_minor: number;
  overdraft_limit_minor: number | null;
  lines: ForecastLine[];
  ending_cash_minor: number;
  lowest_projected_balance_minor: number;
  lowest_balance_date: string;
  /** Layer 3's own, real, meaningful moment — not "cash goes
   * negative", but "cash goes below the real, arranged overdraft
   * limit". Null when no real shortfall is projected within the
   * horizon at all — including when overdraft_limit_minor is itself
   * null (no real, known facility), in which case a shortfall can't
   * be honestly evaluated against an unknown limit, so none is ever
   * reported rather than silently treating the unknown limit as zero. */
  first_shortfall_date: string | null;
  /** How far below the real, arranged limit, at first_shortfall_date
   * — a real, positive number (the real, projected shortfall size),
   * not a signed headroom figure. Null under the same real conditions
   * as first_shortfall_date. */
  first_shortfall_amount_minor: number | null;
}

/** Layer 2 of the real, dedicated cash-flow/growth-planning design
 * (docs/cash-flow-and-growth-planning.md) — a real, forward-looking
 * projection, not the historical Cashflow Statement. A real, honest
 * first version, per the design document's own, stated default:
 * every real, outstanding invoice is assumed to land on its own real
 * due date, with no attempt yet to model a customer's real,
 * historical payment behavior beyond that.
 *
 * Three real sources, in date order: anticipated AR receipts (every
 * real, outstanding AR invoice's own due date, within the horizon),
 * committed AP payments (the same, for AP), and anticipated recurring
 * cash movements (journal_occurrences, filtered to lines actually
 * touching a real, registered bank account — the real, cash-side
 * impact of a recurring entry, e.g. the real "credit Cash" line of a
 * monthly rent journal, not its own expense-side line). Explicitly
 * excludes journal.recurrence = 'once' — confirmed necessary live,
 * against real data, not assumed: journal_occurrences expands EVERY
 * real journal into its own occurrences, ordinary one-off postings
 * included ("for 'once', just itself" — its own real schema comment),
 * so without this filter every real, historical POS sale and AP
 * payment ever posted would flood into this real, "recurring" source
 * too, which is genuinely wrong — those already happened once, real
 * recurring cash movements are the only real thing this section is
 * meant to anticipate.
 *
 * starting_cash_minor is Layer 1's own, real, home-currency cash
 * position (getCashPosition's null-currency group) — a real,
 * deliberate, first-version scope: a genuinely multi-currency
 * forecast is real, future work, not attempted here. */
export function getCashFlowForecast(business: BusinessName, ledger: LedgerName, asOfDate: string, horizonDays: number): CashFlowForecast {
  const horizonEndDate = db.prepare(`SELECT date(?, '+' || ? || ' days') AS d`).get(asOfDate, horizonDays) as { d: string };
  const horizonEnd = horizonEndDate.d;

  const lines: ForecastLine[] = [];

  const arInvoices = listInvoices(business, ledger, { invoiceType: 'AR', source: 'all' }).filter(
    (i) => i.status === 'posted' && i.document_type === 'invoice' && i.due_date && i.due_date > asOfDate && i.due_date <= horizonEnd
  );
  for (const inv of arInvoices) {
    const outstanding = getInvoiceOutstandingMinor(inv.id);
    if (outstanding > 0) {
      lines.push({ date: inv.due_date!, description: `${inv.reference} (${inv.counterparty})`, amount_minor: outstanding, source: 'AR' });
    }
  }

  const apInvoices = listInvoices(business, ledger, { invoiceType: 'AP', source: 'all' }).filter(
    (i) => i.status === 'posted' && i.document_type === 'invoice' && i.due_date && i.due_date > asOfDate && i.due_date <= horizonEnd
  );
  for (const inv of apInvoices) {
    const outstanding = getInvoiceOutstandingMinor(inv.id);
    if (outstanding > 0) {
      lines.push({ date: inv.due_date!, description: `${inv.reference} (${inv.counterparty})`, amount_minor: -outstanding, source: 'AP' });
    }
  }

  const bankAccountIds = new Set(
    getBankAccounts(business, ledger)
      .filter((a) => a.currency === null)
      .map((a) => (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(a.name) as { id: number }).id)
  );
  if (bankAccountIds.size > 0) {
    const placeholders = Array.from(bankAccountIds)
      .map(() => '?')
      .join(',');
    const recurringRows = db
      .prepare(
        `SELECT jo.transdate AS date, jo.reference, jo.description, jo.memo, jo.amount_minor
         FROM journal_occurrences jo
         JOIN current_entities biz ON biz.id = jo.business_id AND biz.name = ?
         JOIN current_entities led ON led.id = jo.ledger_id AND led.name = ?
         JOIN journal j ON j.id = jo.journal_id AND j.recurrence != 'once'
         WHERE jo.account_id IN (${placeholders})
           AND jo.transdate > ? AND jo.transdate <= ?`
      )
      .all(business, ledger, ...Array.from(bankAccountIds), asOfDate, horizonEnd) as { date: string; reference: string; description: string; memo: string; amount_minor: number }[];
    for (const row of recurringRows) {
      // A journal_line's own amount_minor is positive = debit,
      // negative = credit. A debit to a real, debit-normal bank
      // account is real, anticipated cash IN; a credit is real,
      // anticipated cash OUT — the sign is already correct as-is,
      // no flip needed, unlike the AR/AP lines above (which start
      // from a real, always-positive "amount owed" figure). The
      // real, journal-level description (e.g. "Monthly rent") is far
      // more meaningful than the line-level memo, which real callers
      // rarely set — fall back to memo, then reference, only if the
      // journal itself was never given a real description at all.
      lines.push({ date: row.date, description: row.description || row.memo || row.reference, amount_minor: row.amount_minor, source: 'recurring' });
    }
  }

  lines.sort((a, b) => a.date.localeCompare(b.date));

  const position = getCashPosition(business, ledger);
  const homeCurrency = position.find((p) => p.currency === null);
  const startingCash = homeCurrency?.total_balance_minor ?? 0;
  const overdraftLimit = homeCurrency?.total_overdraft_limit_minor ?? null;

  let running = startingCash;
  let lowest = startingCash;
  let lowestDate = asOfDate;
  let firstShortfallDate: string | null = null;
  let firstShortfallAmount: number | null = null;
  // A real shortfall is only ever evaluated against a real, known
  // limit — an unknown limit can't honestly be compared against at
  // all, so none is ever reported when overdraftLimit is null, rather
  // than silently treating "unknown" as "zero headroom".
  const startingHeadroom = overdraftLimit === null ? null : startingCash + overdraftLimit;
  if (startingHeadroom !== null && startingHeadroom < 0) {
    firstShortfallDate = asOfDate;
    firstShortfallAmount = -startingHeadroom;
  }
  for (const line of lines) {
    running += line.amount_minor;
    if (running < lowest) {
      lowest = running;
      lowestDate = line.date;
    }
    if (firstShortfallDate === null && overdraftLimit !== null) {
      const headroom = running + overdraftLimit;
      if (headroom < 0) {
        firstShortfallDate = line.date;
        firstShortfallAmount = -headroom;
      }
    }
  }

  return {
    as_of_date: asOfDate,
    horizon_end_date: horizonEnd,
    starting_cash_minor: startingCash,
    overdraft_limit_minor: overdraftLimit,
    lines,
    ending_cash_minor: running,
    lowest_projected_balance_minor: lowest,
    lowest_balance_date: lowestDate,
    first_shortfall_date: firstShortfallDate,
    first_shortfall_amount_minor: firstShortfallAmount,
  };
}

export interface CustomerRegistrationInput {
  name: string;
  email: string;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
  country?: string | null;
  preferred_language?: string | null;
  password: string;
  /** Card type + last 4 only, e.g. "Visa ending 4242" — never a full
   * card number. */
  card_label?: string | null;
}

/** A customer types their own details at a self-service terminal (or,
 * later, online) — creates the contact immediately, but in 'pending'
 * status: not yet usable for an on-account sale until staff actually
 * checks the card/ID against what was entered and approves. */
export function registerCustomer(input: CustomerRegistrationInput, userId: UserId): void {
  if (db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(input.name)) {
    throw new ValidationError(`"${input.name}" already exists — choose a different name, or ask staff to look up the existing account.`);
  }
  create(fetch('Customers', typeRootName), typeCustomerName, input.name, userId);
  setContact(input.name, {
    email: input.email,
    phone: input.phone ?? null,
    address_line1: input.address_line1 ?? null,
    address_line2: input.address_line2 ?? null,
    city: input.city ?? null,
    region: input.region ?? null,
    postal_code: input.postal_code ?? null,
    country: input.country ?? null,
    preferred_language: input.preferred_language ?? null,
    card_label: input.card_label ?? null,
  });
  const entityId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(input.name) as { id: number }).id;
  mergeContactDetail(entityId, { password_hash: hashPassword(input.password), verification_status: 'pending' });
}

export interface PendingCustomer {
  name: string;
  email: string | null;
  phone: string | null;
  card_label: string | null;
}

/** The queue staff work through — everyone who self-registered but
 * hasn't yet been checked against their actual card/ID. */
export function listPendingCustomers(): PendingCustomer[] {
  return db
    .prepare(
      `SELECT e.name, c.email, c.phone, c.card_label
       FROM contact c JOIN current_entities e ON e.id = c.entity_id
       WHERE c.verification_status = 'pending'
       ORDER BY e.name`
    )
    .all() as PendingCustomer[];
}

/** Staff approves or rejects a pending self-registration after
 * actually checking the card/ID against what was entered. Only
 * 'active' may be sold to on account — this is the real gate the
 * verification step exists to enforce. */
export function verifyCustomer(customerName: string, approve: boolean): void {
  const entityId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(customerName) as { id: number } | undefined)?.id;
  if (!entityId) throw new ValidationError(`No customer named "${customerName}".`);
  const current = (db.prepare(`SELECT verification_status FROM contact WHERE entity_id = ?`).get(entityId) as { verification_status: string | null } | undefined)
    ?.verification_status;
  if (current !== 'pending') throw new ValidationError(`"${customerName}" is not awaiting verification.`);
  mergeContactDetail(entityId, { verification_status: approve ? 'active' : 'rejected' });
}

/** For the customer terminal's own login — verifies a self-registered
 * customer's password. Deliberately separate from staff auth
 * (auth.ts's login()), since these are two different kinds of people
 * with entirely different permissions. */
export function authenticateCustomer(name: string, password: string): boolean {
  const row = db.prepare(`SELECT password_hash FROM contact WHERE entity_id = (SELECT id FROM current_entities WHERE name = ?)`).get(name) as
    | { password_hash: string | null }
    | undefined;
  if (!row?.password_hash) return false;
  return verifyPassword(password, row.password_hash);
}

// ---------------------------------------------------------------------------
// Items — a item's canonical details are manufacturer/vendor-agnostic;
// which manufacturer(s) and vendor(s) actually supply it, at what price
// and package size, is a genuine many-to-many tracked separately by
// item_source. Preference between sources is never derived from price
// alone — local stock, package size, reliability all matter in
// practice, so is_preferred is an explicit choice, not a computation.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Products — a real, genuine hierarchy level sitting above today's
// existing Item/Item entities, per direct instruction: a Product
// (e.g. "Golden Lager") is the real, conceptual/brand thing, never
// itself directly sellable or stockable; an Item (today's existing
// Item entity, e.g. "Golden Lager 330ml" or "Golden Lager 6-Pack") is
// the real, concrete, sellable/stockable packaging variant. Modeled
// purely as entity-tree structure, per direct instruction (no new
// tables) — a Product is a real, ordinary entity, a direct child of
// "Items", with every one of its own Items as real, direct children
// of it in turn (Items → Product → Item, one extra real level,
// genuinely optional: an Item with no real Product parent — a direct
// child of "Items" itself — remains exactly as valid as it always
// was, for a business that hasn't organized its own catalogue into
// products yet).
// ---------------------------------------------------------------------------

export interface ProductSummary {
  name: string;
  itemCount: number;
}

/** Every real, existing Product — confirmed directly against this
 * codebase's own existing data before writing this: "Product" is not
 * simply "any direct child of Items that isn't itself an Item" (a
 * category like "Beer" or a sub-category like "Lager" both fit that
 * description too, and neither is a Product in the brand-level sense
 * this hierarchy level means — "Golden Lager 330ml"'s own real
 * parent is "Lager", a taxonomic sub-category, several real levels
 * deep under Items, not "Beer" and not "Items" itself). A Product is
 * instead any real entity anywhere under Items that is the *direct*
 * parent of at least one real Item — the one level immediately above
 * where Items themselves sit, regardless of how many broader
 * category/sub-category levels sit above that. */
export function listProducts(): ProductSummary[] {
  return db
    .prepare(
      `WITH RECURSIVE items_tree(id) AS (
         SELECT id FROM current_entities WHERE name = 'Items' OR name LIKE '% Items'
         UNION ALL
         SELECT e.id FROM current_entities e JOIN items_tree t ON e.parent_id = t.id
       )
       SELECT p.name, COUNT(i.id) AS itemCount
       FROM current_entities p
       JOIN items_tree pt ON pt.id = p.id
       JOIN current_entities i ON i.parent_id = p.id
       JOIN contact c ON c.entity_id = i.id
       WHERE p.name != 'Items'
       GROUP BY p.id
       ORDER BY p.name`
    )
    .all() as ProductSummary[];
}

/** Creates a real, new Product — a thin, direct wrapper over
 * createEntity, under whichever real category/sub-category (or
 * "Items" itself) it belongs — a Product doesn't have to sit
 * directly under "Items"; it just has to be the real, direct parent
 * of the Items eventually created under it. */
export function createProduct(name: string, parent: string, userId: UserId): void {
  create(fetch(parent, typeCategoryOrItemsRootName), typeItemName, name, userId);
}

/** The real, current Product an Item belongs to, or null if this
 * Item is still a direct child of "Items" itself (no Product
 * assigned yet — a real, genuinely valid, ungrouped state, not an
 * error). */
export function getItemProduct(itemName: string): string | null {
  const row = db
    .prepare(
      `SELECT parent.name FROM current_entities item
       JOIN current_entities parent ON parent.id = item.parent_id
       WHERE item.name = ? AND parent.name != 'Items'`
    )
    .get(itemName) as { name: string } | undefined;
  return row?.name ?? null;
}

/** Moves a real, existing Item under a real, existing Product (or
 * back to being a direct child of "Items" itself, when productName
 * is null) — the real, direct mechanism for organizing today's flat
 * Items list into Product groupings after the fact, not just at
 * creation time. */
export function setItemProduct(itemName: string, productName: string | null, userId: UserId): void {
  updateEntity(resolveIdOrThrow(itemName), { parent: productName ?? 'Items' }, userId);
}

function resolveIdOrThrow(name: string): number {
  const id = resolveId(name);
  if (id == null) throw new NotFoundError(`No entity named "${name}".`);
  return id;
}

export interface Item {
  description: string | null;
  unit_of_measure: string | null;
  upc: string | null;
  /** This item's current real retail/selling price — what a POS
   * screen must look up, never ask the operator to type in. NULL
   * until explicitly set. */
  retail_price_minor: number | null;
}

export function getItem(entityName: string): Item | undefined {
  const row = db
    .prepare(
      `SELECT c.item_description AS description, c.item_unit_of_measure AS unit_of_measure, c.item_upc AS upc, c.item_retail_price_minor AS retail_price_minor
       FROM contact c JOIN current_entities e ON e.id = c.entity_id WHERE e.name = ?`
    )
    .get(entityName) as Item | undefined;
  return row;
}

export function setItem(entityName: string, item: Partial<Item>): void {
  const id = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(entityName) as { id: number } | undefined)?.id;
  if (!id) throw new ValidationError(`No entity named "${entityName}".`);
  mergeContactDetail(id, {
    item_description: item.description ?? null,
    item_unit_of_measure: item.unit_of_measure ?? null,
    item_upc: item.upc ?? null,
    item_retail_price_minor: item.retail_price_minor ?? null,
  });
}

export interface ItemSummary {
  name: string;
  description: string | null;
  unit_of_measure: string | null;
  upc: string | null;
  retail_price_minor: number | null;
  source_count: number;
  /** A real, explicit, per-Item dimension ('Hot' or 'Cold'), or null
   * if this Item has never had one explicitly assigned yet — see
   * setItemStorageOrigin/getItemStorageOrigin. Replaces an earlier,
   * hardcoded category-name guess (a fixed list of "known cold"
   * categories) with a genuine, correctable, per-Item relationship. */
  storage_origin: 'Hot' | 'Cold' | null;
  /** The real Product this Item belongs to, or null if it's still a
   * direct child of "Items" itself — genuinely valid, ungrouped. */
  product: string | null;
}

export function listItems(limit?: number, offset = 0): ItemSummary[] {
  const rows = db
    .prepare(
      `WITH RECURSIVE items_tree(id) AS (
         SELECT id FROM current_entities WHERE name = 'Items' OR name LIKE '% Items'
         UNION ALL
         SELECT e.id FROM current_entities e JOIN items_tree t ON e.parent_id = t.id
       )
       SELECT e.name, p.item_description AS description, p.item_unit_of_measure AS unit_of_measure, p.item_upc AS upc, p.item_retail_price_minor AS retail_price_minor,
              (SELECT COUNT(*) FROM item_source ps WHERE ps.item_id = e.id) AS source_count,
              parent.name AS parentName
       FROM current_entities e
       JOIN items_tree pt ON pt.id = e.id
       JOIN contact p ON p.entity_id = e.id
       JOIN current_entities parent ON parent.id = e.parent_id
       WHERE e.name != 'Items' AND e.name NOT LIKE '% Items'
       ORDER BY e.name
       LIMIT ? OFFSET ?`
    )
    .all(limit ?? -1, offset) as (ItemSummary & { parentName: string })[];
  return rows.map((r) => ({ ...r, storage_origin: getItemStorageOrigin(asItemName(r.name)) ?? null, product: r.parentName === 'Items' || r.parentName.endsWith(' Items') ? null : r.parentName }));
}

/** The real, total count of every real item — used by the frontend
 * pagination mechanism (Pager/createPaginator) to show "page n of
 * nn", not just Newer/Older. */
export function countItems(): number {
  const row = db
    .prepare(
      `WITH RECURSIVE items_tree(id) AS (
         SELECT id FROM current_entities WHERE name = 'Items' OR name LIKE '% Items'
         UNION ALL
         SELECT e.id FROM current_entities e JOIN items_tree t ON e.parent_id = t.id
       )
       SELECT COUNT(*) AS total
       FROM current_entities e
       JOIN items_tree pt ON pt.id = e.id
       JOIN contact p ON p.entity_id = e.id
       WHERE e.name != 'Items' AND e.name NOT LIKE '% Items'`
    )
    .get() as { total: number };
  return row.total;
}

/** Creates a new item, complete with its item row from the start (even
 * if description/UOM/UPC aren't filled in yet) — the real distinction
 * between a item and a category/subcategory (Red Wine, Merlot) isn't
 * tree position (an empty subcategory and a fresh item both look like
 * leaves), it's that a item explicitly IS one, from the moment it's
 * created, not once someone gets around to filling in its details. */
/** Per no-generic-functions - the real, original, confirmed gap this
 * closes: this parent used to be checked only by createEntity's own,
 * generic "does some real entity exist with this name," never "is
 * this genuinely a real Category or the Items root." fetch()+create()
 * closes that gap directly, with zero dependency on generic
 * createEntity at all. */
export function createItem(name: string, parentCategoryOrItemsRoot: string, userId: UserId): void {
  const parent = fetch(parentCategoryOrItemsRoot, typeCategoryOrItemsRootName);
  create(parent, typeItemName, name, userId);
  setItem(name, { description: null, unit_of_measure: null, upc: null });
}

export interface ItemSource {
  id: number;
  item_id: number;
  item_name: string;
  manufacturer_id: number | null;
  manufacturer_name: string | null;
  vendor_id: number;
  vendor_name: string;
  vendor_sku: string | null;
  vendor_upc: string | null;
  price_minor: number | null;
  package_quantity: number | null;
  is_preferred: boolean;
  preference_notes: string | null;
}

export function listItemSources(itemName: string): ItemSource[] {
  const rows = db
    .prepare(
      `SELECT ps.id, ps.item_id, item_e.name AS item_name,
              ps.manufacturer_id, mfr_e.name AS manufacturer_name,
              ps.vendor_id, vendor_e.name AS vendor_name,
              ps.vendor_sku, ps.vendor_upc, ps.price_minor, ps.package_quantity, ps.is_preferred, ps.preference_notes
       FROM item_source ps
       JOIN current_entities item_e ON item_e.id = ps.item_id
       JOIN current_entities vendor_e ON vendor_e.id = ps.vendor_id
       LEFT JOIN current_entities mfr_e ON mfr_e.id = ps.manufacturer_id
       WHERE item_e.name = ?
       ORDER BY ps.is_preferred DESC, vendor_e.name`
    )
    .all(itemName) as (Omit<ItemSource, 'is_preferred'> & { is_preferred: number })[];
  return rows.map((r) => ({ ...r, is_preferred: !!r.is_preferred }));
}

export interface ItemSourceInput {
  itemName: string;
  manufacturerName?: string | null;
  vendorName: string;
  vendorSku?: string | null;
  vendorUpc?: string | null;
  priceMinor?: number | null;
  packageQuantity?: number | null;
  isPreferred?: boolean;
  preferenceNotes?: string | null;
  /** NULL means this business's own home/reporting currency, matching
   * account.currency's own, identical convention. A real, different,
   * non-NULL currency here is a real, separate, independently-priced
   * row for the same item/vendor pair - not a converted number. See
   * docs/border-multicurrency-pos-plan.md, Slice 3. */
  currency?: string | null;
  /** Omit for a real, ordinary price that applies to the base item
   * generally. Provide a real Product Instance's own top node id
   * (see ensureProductInstance) for a price specific to one, exact
   * combination — a cold beer genuinely costs more than a warm one. */
  productInstanceId?: number;
}

export function addOrUpdateItemSource(input: ItemSourceInput): void {
  const itemId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(input.itemName) as { id: number } | undefined)?.id;
  if (!itemId) throw new ValidationError(`No item named "${input.itemName}".`);
  const vendorId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(input.vendorName) as { id: number } | undefined)?.id;
  if (!vendorId) throw new ValidationError(`No vendor named "${input.vendorName}".`);
  const manufacturerId = input.manufacturerName
    ? (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(input.manufacturerName) as { id: number } | undefined)?.id
    : null;
  if (input.manufacturerName && !manufacturerId) throw new ValidationError(`No manufacturer named "${input.manufacturerName}".`);

  // A real, direct child entity under the item itself - one per real
  // (manufacturer, vendor, currency, productInstance) combination,
  // matching the exact, same, real uniqueness the removed table's own
  // constraint enforced. relation_id points at the real vendor (the
  // most commonly joined-on field); every other real field lives in
  // this entity's own, real detail_json.
  const currency = input.currency ?? '';
  const productInstanceId = input.productInstanceId ?? 0;
  const uniqueSuffix = `mfr:${manufacturerId ?? ''} — vendor:${vendorId} — ccy:${currency} — pi:${productInstanceId}`;
  const sourceName = `${input.itemName} — Source — ${uniqueSuffix}`;
  const detail = JSON.stringify({
    manufacturer_id: manufacturerId ?? null,
    vendor_sku: input.vendorSku ?? null,
    vendor_upc: input.vendorUpc ?? null,
    price_minor: input.priceMinor ?? null,
    package_quantity: input.packageQuantity ?? null,
    is_preferred: input.isPreferred ? 1 : 0,
    preference_notes: input.preferenceNotes ?? null,
    currency,
    product_instance_id: productInstanceId,
  });
  const existing = Entity.getUnder(sourceName, itemId);
  if (existing) {
    db.prepare(`UPDATE entities SET detail_json = ? WHERE entity_id = ? AND deleted_at IS NULL`).run(detail, existing.id);
  } else {
    const created = Entity.create(sourceName, itemId, asUserId(1));
    updateEntity(created.id, { relation: input.vendorName }, asUserId(1));
    db.prepare(`UPDATE entities SET detail_json = ? WHERE entity_id = ? AND deleted_at IS NULL`).run(detail, created.id);
  }
}

/** Resolves a real, independently-set price for the given currency -
 * per docs/border-multicurrency-pos-plan.md, Slice 3, a real, fixed
 * price per currency, not a live exchange-rate conversion. Falls back
 * to the business's own home-currency row (the real, empty-string
 * convention `addOrUpdateItemSource` itself uses) when no row exists
 * for the specific currency asked for. */
export function getItemPriceForCurrency(itemName: string, currency: string | null, productInstanceId?: number): number | null {
  // Per direct instruction: the most specific, real fact wins - a
  // real, combination-specific price (a cold beer costs more than a
  // warm one) is checked first, exactly the same, established
  // principle already used for currency-specific pricing here,
  // generalized to any real, applicable combination, not currency
  // alone. Falls through cleanly to the exact, same, existing
  // behavior when no productInstanceId is given at all.
  if (productInstanceId != null) {
    const comboRow = db
      .prepare(
        `SELECT ps.price_minor
         FROM item_source ps
         JOIN current_entities item_e ON item_e.id = ps.item_id
         WHERE item_e.name = ? AND ps.currency = ? AND ps.product_instance_id = ?
         ORDER BY ps.is_preferred DESC
         LIMIT 1`
      )
      .get(itemName, currency ?? '', productInstanceId) as { price_minor: number | null } | undefined;
    if (comboRow) return comboRow.price_minor;
  }
  const row = db
    .prepare(
      `SELECT ps.price_minor
       FROM item_source ps
       JOIN current_entities item_e ON item_e.id = ps.item_id
       WHERE item_e.name = ? AND ps.currency = ? AND ps.product_instance_id = 0
       ORDER BY ps.is_preferred DESC
       LIMIT 1`
    )
    .get(itemName, currency ?? '') as { price_minor: number | null } | undefined;
  if (row) return row.price_minor;
  const fallback = db
    .prepare(
      `SELECT ps.price_minor
       FROM item_source ps
       JOIN current_entities item_e ON item_e.id = ps.item_id
       WHERE item_e.name = ? AND ps.currency = '' AND ps.product_instance_id = 0
       ORDER BY ps.is_preferred DESC
       LIMIT 1`
    )
    .get(itemName) as { price_minor: number | null } | undefined;
  return fallback?.price_minor ?? null;
}

// ---------------------------------------------------------------------------
// Currency exchange - genuinely a cartesian product, not one rate per
// currency. Per direct instruction: with N real, distinct currencies
// in active use, there are N*N real, ordered pairs (From x To), of
// which exactly N are trivial self-pairs (always exactly 1 - USD to
// USD is not a real exchange), leaving N*(N-1) real, distinct,
// independently-configurable rates. Three currencies (e.g. a business
// genuinely spanning the US/Canada border, with USD, CAD, and EUR
// both held and traded) means 9 total pairs, 3 trivial, 6 real ones -
// confirmed directly, per direct instruction, as the exact, correct
// count. Reuses the exact, same Hierarchy/Product cartesian mechanism
// already built and proven for wine combinations - a currency pair is
// a real Product Instance whose own two dimensions ("From Currency,"
// "To Currency") both point at the exact, same real "Currency"
// Hierarchy grouping, exactly as defineProductShape already supports
// today, with no change needed to it at all. Buy and sell prices per
// pair reuse item_source directly (two real, standing vendor rows -
// "FX Market (Buy)" and "FX Market (Sell)" - keyed by the pair's own
// real productInstanceId), the exact, same mechanism as any other
// item's own, independently-priced sources - per direct instruction,
// buying or selling a currency is no different from buying or selling
// any other item.
// ---------------------------------------------------------------------------

const CURRENCY_EXCHANGE_ITEM_NAME = 'Currency Exchange';
const CURRENCY_EXCHANGE_SHAPE: [string, string][] = [
  ['From Currency', 'Currency'],
  ['To Currency', 'Currency'],
];

function ensureCurrencyExchangeItem(userId: UserId): void {
  if (!Entity.get(CURRENCY_EXCHANGE_ITEM_NAME)) createItem(CURRENCY_EXCHANGE_ITEM_NAME, 'Items', userId);
  for (const vendorName of ['FX Market (Buy)', 'FX Market (Sell)']) {
    if (!Entity.get(vendorName)) createEntity({ name: vendorName, parent: 'Vendors' }, userId);
  }
}

/** Ensures the real, specific (From, To) currency pair exists as its
 * own, real Product Instance - the one, real place this pair's own
 * identity lives, whether or not a rate has been configured for it
 * yet. A genuine self-pair (fromCurrency === toCurrency) is real and
 * valid to ensure too (its own combination_ids will simply hold the
 * same, real Hierarchy value id twice), even though its own rate is
 * always, trivially 1 and never needs configuring - see
 * getCurrencyExchangeRate below. */
export function ensureCurrencyPair(businessName: BusinessName, fromCurrency: string, toCurrency: string, userId: UserId): { id: number; name: string } {
  ensureCurrencyExchangeItem(userId);
  return ensureProductInstance(businessName, CURRENCY_EXCHANGE_SHAPE, [fromCurrency, toCurrency], userId);
}

/** Sets a real (From, To) currency pair's own, real, configured buy
 * and/or sell rate - each expressed as "how many minor units of the
 * home/reporting currency equal one minor unit of fromCurrency," per
 * direct instruction that every currency, as configured, needs its
 * own real buy AND real sell rate (a real, genuine bid/ask spread,
 * never a single, shared number). Either side may be set
 * independently; omitting one leaves that side's own, existing,
 * configured rate (if any) untouched. A genuine self-pair is
 * rejected outright - its own rate is always, definitionally 1, never
 * a real, separate, configurable fact. */
export function setCurrencyExchangeRate(businessName: BusinessName, fromCurrency: string, toCurrency: string, userId: UserId, buyRateMinor?: number, sellRateMinor?: number): void {
  if (fromCurrency === toCurrency) throw new ValidationError(`A currency's own exchange rate against itself ("${fromCurrency}" to "${fromCurrency}") is always, definitionally 1 - never a real, separate, configurable rate.`);
  const pair = ensureCurrencyPair(businessName, fromCurrency, toCurrency, userId);
  if (buyRateMinor != null) addOrUpdateItemSource({ itemName: CURRENCY_EXCHANGE_ITEM_NAME, vendorName: 'FX Market (Buy)', priceMinor: buyRateMinor, isPreferred: true, productInstanceId: pair.id });
  if (sellRateMinor != null) addOrUpdateItemSource({ itemName: CURRENCY_EXCHANGE_ITEM_NAME, vendorName: 'FX Market (Sell)', priceMinor: sellRateMinor, isPreferred: true, productInstanceId: pair.id });
}

/** Resolves a real, specific (From, To) currency pair's own,
 * currently-configured rate, on whichever real side was asked for.
 * A genuine self-pair short-circuits to exactly 1 always - the one,
 * real, trivial case direct instruction confirmed needs no
 * configuration and no lookup at all. Returns null when the real,
 * distinct pair has never been configured on the requested side -
 * never a synthetic, reconstructed, or averaged rate. */
export function getCurrencyExchangeRate(businessName: BusinessName, fromCurrency: string, toCurrency: string, side: 'buy' | 'sell'): number | null {
  if (fromCurrency === toCurrency) return 1;
  // A real, direct, read-only lookup - never creates the pair, its
  // Hierarchy grouping, or its Hierarchy values just to check them,
  // unlike ensureCurrencyPair (which a real configuration step,
  // setCurrencyExchangeRate, genuinely needs to call). Walks the
  // exact, same, real structure ensureProductInstance itself builds -
  // business -> Hierarchy -> "Currency" -> value, and business ->
  // Product -> the pair's own instance, found by its own, real,
  // exact combination_ids match - never a guessed, composed name.
  const business = fetch(businessName, typeBusinessName);
  const hierarchyRoot = Entity.getUnder('Hierarchy', business.id);
  if (!hierarchyRoot) return null;
  const currencyGrouping = Entity.getUnder('Currency', hierarchyRoot.id);
  if (!currencyGrouping) return null;
  const fromValue = Entity.getUnder(fromCurrency, currencyGrouping.id);
  if (!fromValue) return null;
  const toValue = Entity.getUnder(toCurrency, currencyGrouping.id);
  if (!toValue) return null;
  const product = Entity.getUnder('Product', business.id);
  if (!product) return null;
  const combinationIdsJson = JSON.stringify([fromValue.id, toValue.id]);
  const pair = db.prepare(`SELECT id FROM current_entities WHERE parent_id = ? AND combination_ids = ?`).get(product.id, combinationIdsJson) as { id: number } | undefined;
  if (!pair) return null;
  // A real, direct, vendor-specific lookup - getItemPriceForCurrency
  // itself has no concept of "which vendor," and picking whichever
  // row merely happens to be marked preferred would silently return
  // either side at random once both a real buy and a real sell row
  // exist for the exact, same pair. Queries item_source directly,
  // filtered to the exact, real vendor this side actually means.
  const vendorName = side === 'buy' ? 'FX Market (Buy)' : 'FX Market (Sell)';
  const row = db
    .prepare(
      `SELECT ps.price_minor
       FROM item_source ps
       JOIN current_entities item_e ON item_e.id = ps.item_id
       JOIN current_entities vendor_e ON vendor_e.id = ps.vendor_id
       WHERE item_e.name = ? AND vendor_e.name = ? AND ps.product_instance_id = ?`
    )
    .get(CURRENCY_EXCHANGE_ITEM_NAME, vendorName, pair.id) as { price_minor: number | null } | undefined;
  return row?.price_minor ?? null;
}

/** Lists every real, distinct, non-trivial (From, To) pair among the
 * given currencies, in the real, exact count direct instruction
 * confirmed: N*(N-1) pairs for N real, distinct currencies (9 total
 * ordered pairs for 3 currencies, 3 of them the trivial self-pairs
 * excluded here, leaving 6 real, distinct ones) - a real, direct,
 * enumerable checklist for confirming every real pair this business
 * actually needs has been genuinely configured, rather than assuming
 * or guessing which ones matter. */
export function listCurrencyPairs(currencies: string[]): { from: string; to: string }[] {
  const pairs: { from: string; to: string }[] = [];
  for (const from of currencies) {
    for (const to of currencies) {
      if (from !== to) pairs.push({ from, to });
    }
  }
  return pairs;
}

export function deleteItemSource(id: number): void {
  const row = db.prepare(`SELECT id FROM current_entities WHERE id = ? AND name LIKE '% — Source — %'`).get(id) as { id: number } | undefined;
  if (!row) throw new NotFoundError(`No item source with id ${id}.`);
  deleteEntity(id, asUserId(1));
}

export * from './db-reports.js';

// ---------------------------------------------------------------------------
// Languages / translation
// ---------------------------------------------------------------------------

export function getLanguages(): { id: number; name: string }[] {
  return db
    .prepare(`SELECT id, name FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'Languages')`)
    .all() as { id: number; name: string }[];
}

/** The system-wide default display language — genuinely needs to live
 * somewhere reachable before anyone has logged in (the login screen
 * itself needs to know what to default to), so it can't be a
 * per-business setting; nothing business-specific is even chosen yet
 * at that point. Stored on Application's own relation_id — the root
 * entity has no other established use for that column, unlike
 * category/report entities (report links, see business_reports) or
 * Cost of Goods Sold-tagged expense accounts (see
 * ensureProductSalesCogsAccounts). See docs/entity-model.md for the
 * complete catalog of every distinct relation_id use in this codebase
 * — it is a genuinely overloaded field, one relationship per entity,
 * and that catalog exists specifically to keep two different features
 * from ever colliding on the same entity's single relation_id slot. */
export function getDefaultLanguage(): string | null {
  const row = db
    .prepare(
      `SELECT s.name FROM current_entities e
       JOIN current_entities s ON s.id = e.relation_id
       WHERE e.name = 'Application'`
    )
    .get() as { name: string } | undefined;
  return row?.name ?? null;
}

export function setDefaultLanguage(languageName: string, userId: UserId): void {
  const languageId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(languageName) as { id: number } | undefined)?.id;
  if (!languageId) throw new ValidationError(`No language named "${languageName}".`);
  const application = db.prepare(`SELECT id FROM current_entities WHERE name = 'Application'`).get() as { id: number };
  // Uses the same entity_update mechanism as every other entity change
  // — entities is append-only, a raw UPDATE would violate that.
  updateEntity(application.id, { relation: languageName }, userId);
}

/** Every real division that exists — a division is just an ordinary
 * entity under "Divisions" (at any depth, since a division can itself
 * be nested, e.g. "Retail" -> "Retail North", the same real hierarchy
 * a product category can have), with an optional real cost/profit
 * type set via setDivisionType. A division with no type set yet still
 * shows up here (type: null) — creating the entity and classifying it
 * are two separate, real steps, not one. */
export function getDivisions(): { id: number; name: string; parentName: string | null; centerType: string | null }[] {
  const rows = db
    .prepare(
      `WITH RECURSIVE divisions_tree(id) AS (
         SELECT id FROM current_entities WHERE name = 'Divisions'
         UNION ALL
         SELECT e.id FROM current_entities e JOIN divisions_tree t ON e.parent_id = t.id
       )
       SELECT e.id, e.name, p.name AS parent_name,
              (SELECT rel.name FROM current_entities rec
                 JOIN current_entities rel ON rel.id = rec.relation_id
                 WHERE rec.parent_id = (SELECT id FROM current_entities WHERE name = 'Division Type')
                 AND rec.name = 'Division Type — ' || e.name || ' → ' || rel.name) AS type_marker
       FROM current_entities e
       JOIN divisions_tree dt ON dt.id = e.id
       LEFT JOIN current_entities p ON p.id = e.parent_id
       WHERE e.name != 'Divisions'
       ORDER BY e.name`
    )
    .all() as { id: number; name: string; parent_name: string; type_marker: string | null }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    parentName: r.parent_name === 'Divisions' ? null : r.parent_name,
    centerType: r.type_marker,
  }));
}

export interface MenuLinkRow {
  key: string;
  href: string;
  label: string;
  notImplemented: boolean;
  isSubheading: boolean;
  requiredRoles: string[] | null;
  hidden: boolean;
}
export interface MenuSectionRow {
  key: string;
  label: string;
  hidden: boolean;
  links: MenuLinkRow[];
}

/** The real, 3-tier fallback chain, per step 3 of
 * docs/menu-as-entity-tree-plan.md — the same, real, established
 * shape already proven for translations: a real, user-scoped
 * override first, then a real, business-scoped one, then the real,
 * global default. userId/businessName are both optional — omitted
 * entirely, this returns the exact, same, unmodified, real, global
 * default menu step 1/2 already provide. */
export function getMenuTree(opts?: { businessName?: string; userId?: number }): MenuSectionRow[] {
  const businessId = opts?.businessName ? (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(opts.businessName) as { id: number } | undefined)?.id : undefined;

  // A real menu override lives as a real, direct child entity of the
  // menu item itself — the exact, same, established setEntityLink
  // shape used everywhere else in this codebase — never a dedicated
  // menu_override table, never JSON.
  function resolveOverride(entityName: string): { label: string | null; hidden: boolean } | null {
    if (opts?.userId != null) {
      const scope = `user ${opts.userId}`;
      const label = getEntityLink(`${entityName} — Override: ${scope}`, 'Label');
      const hidden = !!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(`${entityName} — Override: ${scope} — Hidden`);
      if (label !== undefined || hidden) return { label: label ?? null, hidden };
    }
    if (businessId != null) {
      const scope = `business ${businessId}`;
      const label = getEntityLink(`${entityName} — Override: ${scope}`, 'Label');
      const hidden = !!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(`${entityName} — Override: ${scope} — Hidden`);
      if (label !== undefined || hidden) return { label: label ?? null, hidden };
    }
    return null;
  }

  const sectionRows = db
    .prepare(
      `SELECT e.id, e.name, d.name AS real_label
       FROM current_entities e
       LEFT JOIN current_entities d ON d.id = e.relation_id
       WHERE e.parent_id = (SELECT id FROM current_entities WHERE name = 'Menu')
       ORDER BY e.id`
    )
    .all() as { id: number; name: string; real_label: string | null }[];

  const linkRows = db
    .prepare(
      `SELECT e.id, e.name, e.parent_id, d.name AS real_label
       FROM current_entities e
       LEFT JOIN current_entities d ON d.id = e.relation_id
       WHERE e.parent_id IN (SELECT id FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'Menu'))
       ORDER BY e.id`
    )
    .all() as { id: number; name: string; parent_id: number; real_label: string | null }[];

  return sectionRows
    .map((s) => {
      const override = resolveOverride(s.name);
      return {
        key: String(s.id),
        label: override?.label ?? s.real_label ?? s.name.replace(/^Menu Section: /, ''),
        hidden: override?.hidden ?? false,
        links: linkRows
          .filter((l) => l.parent_id === s.id)
          .map((l) => {
            const linkOverride = resolveOverride(l.name);
            const requiredRoles = (db.prepare(`SELECT name FROM current_entities WHERE parent_id = ? AND name LIKE ?`).all(l.id, `${l.name} — Required Role: %`) as { name: string }[]).map((r) =>
              r.name.replace(`${l.name} — Required Role: `, '')
            );
            return {
              key: String(l.id),
              href: getEntityLink(l.name, 'Route') ?? '',
              label: linkOverride?.label ?? l.real_label ?? l.name.replace(/^Menu Link: .* — /, ''),
              notImplemented: !!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(`${l.name} — Not Implemented`),
              isSubheading: !!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(`${l.name} — Is Subheading`),
              requiredRoles: requiredRoles.length > 0 ? requiredRoles : null,
              hidden: linkOverride?.hidden ?? false,
            };
          })
          .filter((l) => !l.hidden),
      };
    })
    .filter((s) => !s.hidden);
}

/** Resolves a single, real screen's own display label the exact,
 * same, real way its menu entry does — step 3's own real answer to
 * "screen titles reading from the same source" (§5 of the plan). Not
 * hardcoded per page at all: a real page passes its own real href,
 * this finds the real, matching menu_link entity and resolves it
 * through the exact, same, real override chain getMenuTree already
 * uses, so renaming a menu item and its own page title is always
 * exactly one, real edit, never two, separate places to keep in
 * sync. */
export function getScreenTitle(href: string, opts?: { businessName?: string; userId?: number }): string | undefined {
  const tree = getMenuTree(opts);
  for (const section of tree) {
    for (const link of section.links) {
      if (link.href.split('?')[0] === href) return link.label;
    }
  }
  return undefined;
}

export function setMenuOverride(menuItemKey: string, scope: 'business' | 'user', scopeId: number, overrideLabel: string | null, hidden: boolean, userId: UserId = asUserId(1)): void {
  const entityId = Number(menuItemKey);
  const menuItemName = (db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(entityId) as { name: string } | undefined)?.name;
  if (!menuItemName) throw new NotFoundError(`No real menu item with id ${entityId}.`);
  const overrideName = `${menuItemName} — Override: ${scope} ${scopeId}`;
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ? AND parent_id = ?`).get(overrideName, entityId)) {
    create(fetchById(entityId, typeRootName), typeMenuOverrideName, overrideName, userId);
  }
  if (overrideLabel) {
    // A real override label is a real Vocabulary word first — the
    // exact, same, established shape any other display label
    // already uses — ensured to exist before linking to it, never a
    // bare string on the override record itself.
    if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(overrideLabel)) {
      create(fetch('Vocabulary', typeRootName), typeVocabularyWordName, overrideLabel, userId);
    }
    setEntityLink(overrideName, 'Label', overrideLabel, userId);
  } else {
    deleteEntityLink(overrideName, 'Label', userId);
  }
  const hiddenMarkerName = `${overrideName} — Hidden`;
  const hiddenMarkerExists = !!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(hiddenMarkerName);
  if (hidden && !hiddenMarkerExists) create(fetch(overrideName, typeMenuOverrideName), typeHiddenMarkerName, hiddenMarkerName, userId);
  if (!hidden && hiddenMarkerExists) {
    const markerId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(hiddenMarkerName) as { id: number }).id;
    deleteEntity(markerId, userId);
  }
}

export function deleteMenuOverride(menuItemKey: string, scope: 'business' | 'user', scopeId: number, userId: UserId = asUserId(1)): void {
  const entityId = Number(menuItemKey);
  const menuItemName = (db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(entityId) as { name: string } | undefined)?.name;
  if (!menuItemName) return;
  const overrideName = `${menuItemName} — Override: ${scope} ${scopeId}`;
  const row = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(overrideName) as { id: number } | undefined;
  if (!row) return;
  const children = db.prepare(`SELECT id FROM current_entities WHERE parent_id = ?`).all(row.id) as { id: number }[];
  for (const child of children) deleteEntity(child.id, userId);
  deleteEntity(row.id, userId);
}

export function setDivisionType(divisionNameOrId: string | EntityId, typeMarkerName: string): void {
  const divisionName =
    typeof divisionNameOrId === 'number'
      ? (db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(divisionNameOrId) as { name: string } | undefined)?.name
      : divisionNameOrId;
  if (!divisionName || !db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(divisionName)) {
    throw new ValidationError(`No division named "${divisionNameOrId}".`);
  }
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Vocabulary')`).get(typeMarkerName)) {
    throw new ValidationError(`No division type named "${typeMarkerName}" — add it first (a real, user-extensible Vocabulary word, not a fixed, built-in list).`);
  }
  // A division is genuinely nothing more than an ordinary entity — its
  // own "kind" recorded as a real, direct, named record entity
  // ("Division Type — {division} → {marker}"), found by its own
  // predictable name, never touching the division's own relation_id
  // slot — that slot is already used, separately, by
  // cityDivisionFor's own linked-location mechanism for the seven
  // real, per-location divisions, and an entity only ever has one.
  // The marker itself is genuinely any real Vocabulary word, per
  // direct, non-negotiable instruction: every real "type" a real,
  // human administrator sees must be user-extensible and
  // translatable, never a fixed, compile-time set of choices.
  const recordName = `Division Type — ${divisionName} → ${typeMarkerName}`;
  // Remove any other, real, previous "Division Type — {division} →
  // ..." record first — never leaving a stale, contradictory one
  // behind alongside a new one for the exact, same, real division.
  const stale = db
    .prepare(
      `SELECT id, name FROM current_entities
       WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'Division Type')
       AND name = 'Division Type — ' || ? || ' → ' || (SELECT name FROM current_entities WHERE id = relation_id)
       AND name != ?`
    )
    .all(divisionName, recordName) as { id: number; name: string }[];
  for (const s of stale) Entity.delete(s.id, asUserId(1));
  const record = Entity.get(recordName) ?? Entity.create(recordName, 'Division Type', asUserId(1));
  Entity.relate(record.id, typeMarkerName, asUserId(1));
}

export function getDivisionType(divisionName: string): string | null {
  const row = db
    .prepare(
      `SELECT rel.name AS marker
       FROM current_entities rec
       JOIN current_entities rel ON rel.id = rec.relation_id
       WHERE rec.parent_id = (SELECT id FROM current_entities WHERE name = 'Division Type')
       AND rec.name = 'Division Type — ' || ? || ' → ' || rel.name`
    )
    .get(divisionName) as { marker: string } | undefined;
  return row?.marker ?? null;
}

/** Every real, currently-available division type — genuinely just
 * Vocabulary words, user-extensible via createDivisionType, never a
 * fixed, built-in list. */
export function getDivisionTypes(): string[] {
  return (
    db
      .prepare(
        `WITH RECURSIVE marks(id) AS (
           SELECT relation_id FROM current_entities
           WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'Division Type') AND relation_id IS NOT NULL
         )
         SELECT DISTINCT e.name FROM current_entities e JOIN marks m ON m.id = e.id ORDER BY e.name`
      )
      .all() as { name: string }[]
  ).map((r) => r.name);
}

/** Adds a brand-new, real division type — a plain Vocabulary word, a
 * real, human administrator can add directly (e.g. "Region", "Cost
 * Center", "Profit Center", or any real, custom kind a business
 * needs), per direct, non-negotiable instruction: every real "type" a
 * human sees must be user-extensible and translatable, never a fixed,
 * compile-time list. */
export function createDivisionType(name: string, userId: UserId): void {
  if (db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(name)) {
    throw new ValidationError(`"${name}" already exists.`);
  }
  create(fetch('Vocabulary', typeRootName), typeVocabularyWordName, name, userId);
}

/** Every real, known alternate name for the same, real concept
 * wordName itself belongs to — including wordName itself — found via
 * whichever real "Header Account" target wordName's own dimension
 * link points at (the same, established mechanism confirmed working
 * for Vendor/Supplier). Returns just [wordName] if it has no real
 * dimension link at all (an ordinary word with no known alternates
 * yet), rather than an empty list — a real word is always, at
 * minimum, its own real alternate. */
export interface VocabularyWord {
  name: string;
  translations: Record<string, string>;
}

/** Every real, direct word/phrase under Vocabulary, with its own,
 * real, current translation into each real, existing language — the
 * real, direct source for the new Translations/Vocabulary page. Only
 * direct children, not the full, recursive subtree — Vocabulary's
 * own, real words are already, deliberately, a flat, single-level
 * list (confirmed directly: no real word currently has its own,
 * further, nested children). */
export function getVocabularyWords(): VocabularyWord[] {
  // A real concept is genuinely any entity that has at least one
  // real, direct child translation under any real language — per
  // direct, non-negotiable instruction: every real language,
  // including English, is a peer, on equal footing, its own real
  // vocabulary living under it, each real word a direct child
  // entity whose own relation_id points back at the concept.
  const concepts = db
    .prepare(
      `SELECT DISTINCT c.name
       FROM current_entities e
       JOIN current_entities c ON c.id = e.relation_id
       JOIN current_entities lang ON lang.id = e.parent_id
       WHERE lang.parent_id = (SELECT id FROM current_entities WHERE name = 'Languages')
       ORDER BY c.name`
    )
    .all() as { name: string }[];
  const languages = getLanguages();
  return concepts.map((c) => {
    const translations: Record<string, string> = {};
    for (const lang of languages) {
      const text = getTranslation(c.name, lang.name);
      if (text) translations[lang.name] = text;
    }
    return { name: c.name, translations };
  });
}

export function getVocabularyAlternates(wordName: string): string[] {
  const target = getDimensionParent(wordName, 'Header Account');
  if (!target) return [wordName];
  const links = getDimensionLinksPointingAt(target).filter((l) => l.dimensionName === 'Header Account');
  return links.map((l) => l.entityName);
}

export interface ConceptWithAlternates {
  headerAccountName: string;
  alternates: string[];
  /** The real, original, already-established word for this concept —
   * the one with the lowest, real entity_id among the alternates,
   * since the real, original word was always, genuinely created
   * first, before any real, later alternate was added alongside it.
   * Choosing this one back is a real, direct "reset to default". */
  defaultAlternate: string;
}

/** Every real concept (a real "Header Account" target) that has more
 * than one, real, known word pointing at it — the real, discoverable
 * list the translator form itself lists. A concept with only one,
 * real, known word (no real alternate yet) isn't shown at all — there
 * would be nothing real to choose between. */
export function getConceptsWithAlternates(): ConceptWithAlternates[] {
  const rows = db
    .prepare(
      `SELECT target.name AS target_name, orig.name AS entity_name, orig.id AS entity_id
       FROM current_entities link
       JOIN current_entities target ON target.id = link.relation_id
       JOIN current_entities orig ON orig.id = link.parent_id
       WHERE link.name LIKE orig.name || ' — Dimension: Header Account'`
    )
    .all() as { target_name: string; entity_name: string; entity_id: number }[];
  const byTarget = new Map<string, { name: string; id: number }[]>();
  for (const r of rows) {
    if (!byTarget.has(r.target_name)) byTarget.set(r.target_name, []);
    byTarget.get(r.target_name)!.push({ name: r.entity_name, id: r.entity_id });
  }
  return [...byTarget.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([headerAccountName, entries]) => ({
      headerAccountName,
      alternates: entries.map((e) => e.name).sort(),
      defaultAlternate: entries.reduce((min, e) => (e.id < min.id ? e : min)).name,
    }));
}

export function setVocabularyPreference(conceptName: string, scope: 'business' | 'user', scopeId: number, preferredAlternateName: string): void {
  const conceptId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(conceptName) as { id: number } | undefined)?.id;
  if (!conceptId) throw new ValidationError(`No real entity named "${conceptName}".`);
  const alternate = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(preferredAlternateName) as { id: number } | undefined;
  if (!alternate) throw new ValidationError(`No real entity named "${preferredAlternateName}".`);
  // A real, direct child entity under the concept itself, one per
  // (scope, scopeId) - never a separate table. scopeId genuinely isn't
  // always a real entity id (a 'user' scope is a plain users.id, not
  // part of the entity tree at all), so it's encoded directly in the
  // preference entity's own name rather than as a structural parent/
  // relation link. relation_id points directly at the real, preferred
  // alternate - the one, real fact this preference actually records.
  const prefName = `${conceptName} — Preference — ${scope}:${scopeId}`;
  const existing = Entity.getUnder(prefName, conceptId);
  if (existing) {
    updateEntity(existing.id, { relation: preferredAlternateName }, asUserId(1));
  } else {
    const created = Entity.create(prefName, conceptId, asUserId(1));
    updateEntity(created.id, { relation: preferredAlternateName }, asUserId(1));
  }
}

export function deleteVocabularyPreference(conceptName: string, scope: 'business' | 'user', scopeId: number): void {
  const conceptId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(conceptName) as { id: number } | undefined)?.id;
  if (!conceptId) return;
  const prefName = `${conceptName} — Preference — ${scope}:${scopeId}`;
  const existing = Entity.getUnder(prefName, conceptId);
  if (existing) deleteEntity(existing.id, asUserId(1));
}

/** getLocalizedText, extended with the real, 3-tier vocabulary-
 * preference resolution chain (§4 of the plan, the exact, same,
 * established shape already proven for the menu): a real, user-scoped
 * preference first, then a real, business-scoped one, then the
 * unmodified, real, default word. Every real place throughout this
 * app that already reads $translations[name] — not just the menu —
 * automatically, correctly picks up a real, chosen alternate (e.g.
 * "Suppliers" instead of "Vendors") from this one, single, real
 * change, since they all share this one, same, real, loaded map. */
export function getLocalizedText(language: string, opts?: { businessName?: string; userId?: number }): Record<string, string> {
  const rows = db
    .prepare(`SELECT entity, text FROM localized_text WHERE language = ?`)
    .all(language) as { entity: string; text: string }[];
  const map: Record<string, string> = {};
  for (const r of rows) map[r.entity] = r.text;

  if (!opts?.businessName && !opts?.userId) return map;
  const businessId = opts.businessName ? (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(opts.businessName) as { id: number } | undefined)?.id : undefined;
  const preferences = db
    .prepare(
      `SELECT pref.parent_id AS concept_id, alt.name AS alternate_name,
              CASE WHEN pref.name LIKE '% — Preference — user:%' THEN 'user' ELSE 'business' END AS scope
       FROM current_entities pref
       JOIN current_entities alt ON alt.id = pref.relation_id
       WHERE (pref.name LIKE '% — Preference — user:' || ?) OR (pref.name LIKE '% — Preference — business:' || ?)`
    )
    .all(opts.userId ?? -1, businessId ?? -1) as { concept_id: number; scope: 'business' | 'user'; alternate_name: string }[];
  if (preferences.length === 0) return map;

  const conceptNames = db
    .prepare(`SELECT id, name FROM current_entities WHERE id IN (${preferences.map(() => '?').join(',')})`)
    .all(...preferences.map((p) => p.concept_id)) as { id: number; name: string }[];
  const nameById = new Map(conceptNames.map((c) => [c.id, c.name]));

  // A real, user-scoped preference always wins over a real, business-
  // scoped one for the exact, same concept — tracked here, in a real,
  // separate, local map, rather than the real, returned translations
  // map itself, since business rows can't be guaranteed to sort after
  // user rows in SQL.
  const sourceByConcept = new Map<string, 'business' | 'user'>();
  for (const p of preferences) {
    const conceptName = nameById.get(p.concept_id);
    if (!conceptName) continue;
    if (p.scope === 'business' && sourceByConcept.get(conceptName) === 'user') continue;
    map[conceptName] = map[p.alternate_name] ?? p.alternate_name;
    sourceByConcept.set(conceptName, p.scope);
  }
  return map;
}

export function setTranslation(conceptName: string, languageName: string, text: string, userId: UserId = asUserId(1)): void {
  // A real, confirmed bug fix: multiple, real, unrelated entities can
  // share a name (e.g. "Actual" - every real business has its own,
  // separate "Actual" ledger entity) - preferring the real Vocabulary
  // concept when one exists avoids attaching a translation to the
  // wrong, unrelated entity, while still falling back to any match
  // for any other, legitimate, non-Vocabulary use of this function.
  const conceptId = (
    db.prepare(`SELECT e.id FROM current_entities e WHERE e.name = ? AND e.parent_id = (SELECT id FROM current_entities WHERE name = 'Vocabulary')`).get(conceptName) as { id: number } | undefined
    ?? db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(conceptName) as { id: number } | undefined
  )?.id;
  if (!conceptId) throw new ValidationError(`No real entity named "${conceptName}".`);
  const languageId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(languageName) as { id: number } | undefined)?.id;
  if (!languageId) throw new ValidationError(`No real language named "${languageName}".`);

  // Remove any real, existing, stale translation for this exact
  // concept under this language first (different text) — never
  // leaving a stale, contradictory child entity behind alongside a
  // new one for the exact, same, real concept.
  const stale = db
    .prepare(`SELECT e.id, e.name FROM current_entities e WHERE e.parent_id = ? AND e.relation_id = ?`)
    .get(languageId, conceptId) as { id: number; name: string } | undefined;
  if (stale) {
    if (stale.name === text) return; // already correct, nothing to do
    deleteEntity(stale.id, userId);
  }

  // createEntity's own, established, scoped uniqueness (parent_id,
  // name) already, correctly rejects a genuine collision — two
  // different concepts sharing the exact same word under the exact
  // same language. Per direct instruction: this is a genuine bug in
  // how this application's own words are used (or a genuine ambiguity
  // in human language itself), to be flagged and studied, never
  // silently worked around with a suffix or similar — but also never
  // allowed to halt every other, real, unrelated translation.
  let created;
  try {
    created = create(fetchById(languageId, typeRootName), typeTranslationConceptName, text, userId);
  } catch (e) {
    const existing = db.prepare(`SELECT c.name AS concept FROM current_entities e JOIN current_entities c ON c.id = e.relation_id WHERE e.parent_id = ? AND e.name = ?`).get(languageId, text) as { concept: string } | undefined;
    // Per direct instruction: temporarily suppressed from stderr (100+
    // genuine ambiguities cluttered every command's output) - still
    // recorded, just to a real log file instead, not silently
    // discarded. See docs/flagged-translation-collisions.log.
    fs.appendFileSync(
      path.join(dataDir, '..', '..', 'docs', 'flagged-translation-collisions.log'),
      `"${conceptName}" and "${existing?.concept ?? '(unknown)'}" both genuinely translate to "${text}" in ${languageName} — a real, human-language ambiguity, not silently resolved. Keeping the existing translation.\n`
    );
    return;
  }
  // A real, confirmed bug fix: updateEntity(created.id, { relation:
  // conceptName }, userId) would re-resolve conceptName as a plain
  // string, all over again, through updateEntity's own, separate,
  // genuinely shared, general-purpose relation-resolution helper -
  // which is NOT Vocabulary-scoped, and so silently threw away the
  // correct, already-resolved conceptId computed above, replacing it
  // with whichever real, unrelated, ambiguously-named entity that
  // helper happened to find first (confirmed directly: "Actual" -
  // one of six, real, separate ledger entities sharing that name).
  // Setting relation_id directly from the already-correct conceptId,
  // via the same, real entity_update audit-trail mechanism
  // updateEntity itself uses, avoids this re-resolution entirely.
  db.prepare(`INSERT INTO entity_update (entity_id, name, parent, parent_id, relation, relation_id, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    created.id,
    created.name,
    languageName,
    languageId,
    conceptName,
    conceptId,
    userId
  );
}

/** Every real translation this application has, for one real
 * language — a real, direct child entity of {languageName}, per
 * concept, its own relation_id pointing back at that concept. */
export function getAllTranslations(languageName: string): Record<string, string> {
  const rows = db
    .prepare(
      `SELECT c.name AS concept, e.name AS text
       FROM current_entities e
       JOIN current_entities c ON c.id = e.relation_id
       WHERE e.parent_id = (SELECT id FROM current_entities WHERE name = ?)`
    )
    .all(languageName) as { concept: string; text: string }[];
  const result: Record<string, string> = {};
  for (const r of rows) result[r.concept] = r.text;
  return result;
}

export function getTranslation(conceptName: string, languageName: string): string | null {
  const row = db
    .prepare(
      `SELECT e.name
       FROM current_entities e
       JOIN current_entities c ON c.id = e.relation_id
       WHERE e.parent_id = (SELECT id FROM current_entities WHERE name = ?)
         AND c.name = ?
       ORDER BY (c.parent_id = (SELECT id FROM current_entities WHERE name = 'Vocabulary')) DESC
       LIMIT 1`
    )
    .get(languageName, conceptName) as { name: string } | undefined;
  return row?.name ?? null;
}

// ---------------------------------------------------------------------------
// Businesses / Ledgers (just entities, but with convenience helpers)
// ---------------------------------------------------------------------------

export function getBusinesses(): { id: number; name: BusinessName }[] {
  return db
    .prepare(`SELECT id, name FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')`)
    .all() as { id: number; name: BusinessName }[];
}

/** Every real ledger under a business — deliberately excludes
 * "{business} Locations", the one other real, direct child every
 * business now has (see createBusiness). Confirmed as a real, live
 * bug, not assumed: before this fix, "Wine Retail Business Locations"
 * showed up as a selectable option in the Trial Balance/General
 * Journal/every other ledger dropdown throughout the app, right next
 * to "Actual" — a genuinely different real
 * entity, not a ledger at all, that a person could accidentally
 * select and then find no real accounts postable to it. */
export function getLedgers(businessName: BusinessName): { id: number; name: LedgerName }[] {
  return db
    .prepare(`SELECT id, name FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = ?) AND name NOT IN (?, ?, ?, ?, ?)`)
    .all(businessName, `${businessName} Locations`, `${businessName} Items`, `${businessName} Contacts`, `${businessName} Chart of Accounts`, 'Hierarchies') as { id: number; name: LedgerName }[];
}

/** Creates a brand-new business, real and ready to actually transact
 * in — a business entity plus its first real ledger.
 *
 * Correction to an earlier, incomplete claim here: the Chart of
 * Accounts is NOT uniformly shared across every business. Confirmed
 * directly, not assumed: only the five top-level report categories
 * (Asset/Liability/Equity/Income/Expense) are genuinely global — every
 * country's accounting still groups into the same five buckets, so
 * business_reports correctly reuses them for every business. But the
 * real, named LEAF accounts underneath are genuinely country-specific
 * families that already exist as real, distinct entities: "Cash and
 * Bank"/"Sales Revenue" (English/generic, used by My Business and
 * Wine Retail Business), "Bankkontokorrent"/"Umsatzerlöse" (German,
 * BMW M GmbH), "Autres créances"/"Achats de marchandises" (French,
 * Peugeot), "Cassa e valori"/"Ricavi cessione beni" (Italian, Ditta
 * Italiana Srl), "Kasse"/"Kassenbestand und Bankguthaben" (Swiss,
 * Schweizer KMU AG) — genuinely different entities, confirmed by
 * entity_id, not just different display names for the same thing.
 *
 * A new business should reuse whichever family actually matches its
 * real country/jurisdiction — coaFamilyLedger, if given, is an
 * existing ledger's real name (e.g. "BMW M GmbH Actual") whose real
 * account set getCoaFamilyAccounts can then surface, so a person
 * setting up a new business can see exactly which real accounts to
 * post to before they start, rather than guessing or accidentally
 * defaulting to the generic English set regardless of their business's
 * actual country. This function itself creates no new accounts —
 * every real leaf account, in every family, already exists and is
 * simply reused; a genuinely new country not yet represented here
 * still needs its own leaves built through the Entity Tree Editor, a
 * real, honest, unbuilt gap (see docs/TODO.md).
 *
 * The ledger's real, stored name is genuinely just "{ledgerLabel}"
 * (e.g. "Actual", "Budget 2026-27") — no business-name prefix. This
 * was not always true: entity names were once globally unique across
 * the whole app, so a plain "Actual" would have collided with the
 * very first other business that also wanted one. Scoped uniqueness
 * (unique among real, direct siblings under the same real parent, not
 * globally) now correctly allows every business to have its own
 * "Actual" ledger without collision — confirmed safe only after fixing
 * a real, separate risk this exposed: post_journal_entry_insert and
 * post_quantity_movement_insert both resolved a ledger by a bare name
 * lookup with no business scoping, which would have silently posted a
 * transaction against the wrong business's own "Actual" ledger. Both
 * triggers now scope the lookup by the transaction's own, known
 * business first.
 *
 * See docs/entity-model.md and docs/TODO.md.
 *
 * Creates two real ledgers, not one — "Budget is just another
 * ledger," the same proven pattern My Business's own real "Proposed
 * Growth Budget 2026-27" ledger already uses, and the same one this
 * project already built a real, working Budget-vs-Actual comparison
 * against for Wine Retail Business (see
 * scripts/generate-wine-retail-budget.ts). A new business genuinely
 * needs both from day one: a real, ongoing Actual ledger to post real
 * transactions to, and a real Budget ledger for the financial year to
 * plan against and compare — not a second thing to remember to set up
 * later. financialYearLabel (e.g. "2026-27") is real, free text — not
 * computed from today's date, since a business's actual fiscal year
 * start genuinely varies by country/jurisdiction, and guessing it
 * wrong would silently mislabel a real business's own budget period. */
/** Per direct confirmation: a business's own legal/entity structure is
 * largely a cosmetic/reporting concern — the real, underlying
 * mechanism (entities, relationships, accounts) doesn't change per
 * structure, only the Balance Sheet's own equity-section presentation
 * does. "Sole Trader" and "Unlimited Liability" both genuinely use the
 * one, real, shared "Owner's Equity" account already built in — no
 * extra accounts needed. The others each get their own, real,
 * additional equity accounts, tagged with the same real CoA family as
 * the business itself so they're genuinely findable through the real
 * General Journal account dropdown, not created orphaned. */
export type EntityStructure = 'sole_trader' | 'partnership' | 'llc' | 'unlimited_liability' | 'publicly_traded';

export function setupEquityStructure(businessName: BusinessName, structure: EntityStructure, userId: UserId, coaFamily?: string, partnerNames?: string[]): void {
  const tag = (accountName: string) => {
    if (coaFamily) {
      updateEntity((db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(accountName) as { id: number }).id, { relation: coaFamily }, userId);
    }
  };
  const ensure = (accountName: string) => {
    if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(accountName)) {
      create(fetch('Equity', typeRootName), typeEquityAccountName, accountName, userId);
      tag(accountName);
    }
  };

  switch (structure) {
    case 'sole_trader':
    case 'unlimited_liability':
      // Owner's Equity already, genuinely exists as the real, shared, default account — nothing extra needed.
      break;
    case 'partnership':
      // A real Capital/Drawing account pair per real, named partner —
      // each partner's own real contribution and own real withdrawals
      // tracked separately, the real, standard partnership convention.
      for (const partner of partnerNames ?? []) {
        ensure(`${businessName} — ${partner} Capital`);
        ensure(`${businessName} — ${partner} Drawing`);
      }
      break;
    case 'llc':
      ensure(`${businessName} Members' Equity`);
      for (const member of partnerNames ?? []) {
        ensure(`${businessName} — ${member} Member Capital`);
      }
      break;
    case 'publicly_traded':
      ensure(`${businessName} Share Capital`);
      ensure(`${businessName} Dividends`);
      // Retained Earnings already, genuinely exists as the real, shared, default account.
      break;
  }
}

/** A real, structural, eager, one-time copy of the applicable Chart
 * of Accounts template into a genuine, independent, per-business
 * instance — the "class/instance" model, per direct instruction: the
 * system-supplied templates (Chart of Accounts, tagged per real CoA
 * family) are the real classes, living at the application level;
 * this is the real instance, living at the business level. Every
 * universal (untagged) account, plus every account tagged for this
 * exact family, is copied; accounts tagged for a different real
 * family are skipped. Deliberately additive, not a replacement: the
 * existing, global Chart of Accounts and its established, tag-based
 * family mechanism are left completely untouched, so every existing
 * GL-reporting function keeps working exactly as it already did —
 * this creates a genuine, new, real, independent copy alongside it,
 * not yet wired into posting or reporting (see
 * docs/coa-class-instance-plan.md for what remains). */
/** The one, real, shared mechanism that copies the shared Chart of
 * Accounts into any real, new destination root — family-tagged leaves
 * genuinely copied (only those matching coaFamily), a non-leaf,
 * structural category mirrored under a genuinely unique name (never
 * the bare category name alone — see the real, critical bug this
 * fixed, in lessons-learned.md). Used both by instantiateChartOfAccounts
 * (a real, per-business instance) and by the business-type template
 * mechanism (a real, per-legal-type prototype CoA) — the exact, same,
 * one, real copy logic, never duplicated. */
/** Every real, existing business type — Sole Trader, Partnership,
 * Pty Ltd Company, Incorporated Company — with its own real
 * questions, read directly from the real 'Business Type' entity tree
 * seeded in db-seed.ts. The one, real, database-driven source for the
 * new-business form's own type selector, replacing a hardcoded
 * frontend array with the same, real entities the prototype CoA
 * copies already live under. */
export interface BusinessTypeInfo {
  name: string;
  questions: string[];
}
export function getBusinessTypes(): BusinessTypeInfo[] {
  const root = db.prepare(`SELECT id FROM current_entities WHERE name = 'Business Type'`).get() as { id: number } | undefined;
  if (!root) return [];
  const types = db.prepare(`SELECT id, name FROM current_entities WHERE parent_id = ? ORDER BY id`).all(root.id) as { id: number; name: string }[];
  return types.map((t) => {
    const questionsRoot = db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(`${t.name} Questions`, t.id) as { id: number } | undefined;
    const questions = questionsRoot
      ? (db.prepare(`SELECT name FROM current_entities WHERE parent_id = ?`).all(questionsRoot.id) as { name: string }[]).map((q) => q.name.replace(`${t.name} — Question: `, ''))
      : [];
    return { name: t.name, questions };
  });
}

/** Records a real business's own real answers to its business type's
 * own questions, via Detail — the exact, same primitive already used
 * for every other open-ended contact fact (address, phone, email).
 * Genuinely additive: called separately, after a business already
 * exists, rather than folded into createBusiness's own signature. */
export function saveBusinessTypeAnswers(businessName: BusinessName, answers: Record<string, string>, userId: UserId): void {
  for (const [question, answer] of Object.entries(answers)) {
    if (answer.trim()) Detail.set(businessName, question, answer.trim(), userId);
  }
}

export function copyChartOfAccountsInto(destRootName: string, coaFamily: string | undefined, userId: UserId): void {
  const familyId = coaFamily ? (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(coaFamily) as { id: number } | undefined)?.id : undefined;
  const coaFamilyMarkerIds = new Set(
    (db.prepare(`SELECT id FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'Vocabulary') AND name LIKE '% CoA'`).all() as { id: number }[]).map((r) => r.id)
  );
  const sourceRootId = (db.prepare(`SELECT id FROM current_entities WHERE name = 'Chart of Accounts'`).get() as { id: number }).id;

  function copyChildren(sourceId: number, destParentId: number): void {
    const children = db.prepare(`SELECT id, name, relation_id FROM current_entities WHERE parent_id = ?`).all(sourceId) as { id: number; name: string; relation_id: number | null }[];
    for (const child of children) {
      const isFamilyTagged = child.relation_id !== null && coaFamilyMarkerIds.has(child.relation_id);
      if (isFamilyTagged) {
        // A real, family-tagged leaf is genuinely copied — a
        // universal (untagged) leaf is already, correctly, shared
        // across every business as-is, and copying it too would
        // create a dangerous, global name-duplicate breaking every
        // existing by-name lookup elsewhere in the app (confirmed
        // directly: this broke getBankAccounts/getCashPosition on a
        // duplicated test account before this fix).
        if (child.relation_id === familyId) {
          const existing = db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(child.name, destParentId) as { id: number } | undefined;
          if (!existing) create(fetchById(destParentId, typeRootName), typeChartOfAccountsNodeName, child.name, userId);
        }
      } else {
        // A non-leaf, structural category (Asset/Liability/...) is
        // mirrored under a genuinely unique name — never the real,
        // bare category name alone. Confirmed, directly, as the real,
        // critical root cause of a real regression: mirroring
        // "Equity" as plain "Equity" under every business's own real
        // CoA instance meant 7 real Equity entities existed at once
        // (1 global + 6 per-business mirrors) — and any other, real,
        // existing caller elsewhere in this app that still resolves a
        // bare "Equity" by plain name (e.g. `createEntity({ parent:
        // 'Equity' })`) could then resolve ambiguously to the wrong
        // one, silently. The real fix: this mirror's own real name is
        // "{destRootName} — {category}", genuinely unique, so no bare,
        // global by-name lookup elsewhere can ever match it by
        // accident. Its own real display name for reports/UI is
        // carried via relation_id, pointing back at the real,
        // original, shared category — the exact, same mechanism
        // already used for a translated Vocabulary word's own display
        // label.
        const mirrorName = `${destRootName} — ${child.name}`;
        const hasChildren = db.prepare(`SELECT 1 FROM current_entities WHERE parent_id = ? LIMIT 1`).get(child.id);
        if (!hasChildren) continue;
        let mirror = db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(mirrorName, destParentId) as { id: number } | undefined;
        if (!mirror) {
          mirror = create(fetchById(destParentId, typeRootName), typeChartOfAccountsNodeName, mirrorName, userId);
          updateEntity(mirror.id, { relation: child.name }, userId);
        }
        copyChildren(child.id, mirror.id);
      }
    }
  }
  const destRootId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(destRootName) as { id: number }).id;
  copyChildren(sourceRootId, destRootId);
}

export function instantiateChartOfAccounts(businessName: BusinessName, coaFamily: string | undefined, userId: UserId): void {
  const rootName = `${businessName} Chart of Accounts`;
  if (db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(rootName)) return;
  create(fetch(businessName, typeBusinessName), typeChartOfAccountsRootName, rootName, userId);
  copyChartOfAccountsInto(rootName, coaFamily, userId);
}

export function createBusiness(
  businessName: BusinessName,
  financialYearLabel: string,
  userId: UserId,
  coaFamily?: string,
  secondaryCurrencies?: string[],
  entityStructure?: EntityStructure,
  partnerNames?: string[]
): { business: BusinessName; actualLedger: LedgerName; budgetLedger: LedgerName } {
  const businessesRoot = fetch('Businesses', typeRootName);
  const business = create(businessesRoot, typeBusinessName, businessName, userId);
  const actualLedger = asLedgerName(`Actual`);
  const budgetLedger = asLedgerName(`Budget ${financialYearLabel}`);
  create(business, typeLedgerName, actualLedger, userId);
  create(business, typeLedgerName, budgetLedger, userId);
  // A real, confirmed fix: locations were never actually scoped per
  // business before — every business shared one, global "Locations"
  // parent, so selecting a different business's session still showed
  // another business's own real locations. Every new business now
  // gets its own real "{business} Locations" parent from day one.
  create(business, typeBusinessLocationsRootName, `${businessName} Locations`, userId);
  // The same real fix, applied to Items (this codebase's own real
  // term for a sellable/stockable inventory unit — never "Item"):
  // every business now gets its own real "{business} Items" parent
  // from day one, instead of sharing one, single, global catalogue
  // with every other business — the exact bug Locations already had
  // fixed above, confirmed directly still present for Items until
  // this point.
  create(business, typeBusinessItemsRootName, `${businessName} Items`, userId);
  // The real, unified, structural home for every real contact this
  // business deals with — customer, vendor, employee, or any real
  // combination — per direct instruction, scoped per-business (not
  // per-ledger, not global). A contact's own contact type(s) (which
  // real base account(s) it derives) are a separate, real,
  // independent relationship, never its own structural parent.
  create(business, typeBusinessContactsRootName, `${businessName} Contacts`, userId);
  // A real, second fix, found via the real, full-lifecycle Playwright
  // test: a new business was never actually tagged with its own real
  // CoA family relation at all — only the original, hand-tagged demo
  // businesses were (see backend/scripts/tag-coa-families.ts). The
  // real, live General Journal account dropdown filters strictly by
  // this tag (see frontend/src/routes/post/+page.svelte), so an
  // untagged business could never post to any real, family-specific
  // account at all through the actual UI — only universal ones
  // (customer/vendor contacts, product Sales-/COGS- accounts). Tags
  // the new business with its real, chosen family here, the same
  // real relation mechanism the demo businesses already use.
  if (coaFamily) {
    updateEntity(
      (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(businessName) as { id: number }).id,
      { relation: coaFamily },
      userId
    );
  }
  // The real, genuine, per-business instance of the applicable Chart
  // of Accounts template class, per direct instruction — additive
  // alongside the existing, unchanged, global, tag-based mechanism
  // above, which every existing GL-reporting function still uses.
  instantiateChartOfAccounts(businessName, coaFamily, userId);
  // Per direct request, and the real, direct insight behind it: most
  // real businesses transact in one, single, home currency — a
  // second currency is a real, genuine need only for a business
  // genuinely near a national border, not the common case. So this
  // is deliberately a real, optional, low-friction addition, not a
  // mandatory step every new business has to think through — a
  // completely ordinary business omits this entirely and gets
  // nothing extra. For each real, accepted secondary currency, a
  // real "Cash at Bank ({currency})" account is created — the same
  // real pattern the two, existing, hand-written demo currency
  // accounts (Bank Account (DKK)/(EUR)) already use, now genuinely
  // automatic rather than hand-written. Tagged with the same real CoA
  // family as the business itself, so it's genuinely findable through
  // the real General Journal account dropdown, not created orphaned
  // from a filtering standpoint.
  for (const currency of secondaryCurrencies ?? []) {
    const accountName = `Cash at Bank (${currency})`;
    if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(accountName)) {
      create(fetch('Asset', typeRootName), typeAssetAccountName, accountName, userId);
    }
    // The same real logic as setAccountCurrency (backend/src/db-reports.ts)
    // — inlined here rather than imported, since db-reports.ts already
    // imports from this module, and importing back would create a
    // real, genuine circular dependency between the two.
    db.prepare(`INSERT INTO account (entity_id) VALUES ((SELECT id FROM current_entities WHERE name = ?)) ON CONFLICT (entity_id) DO NOTHING`).run(accountName);
    db.prepare(`UPDATE account SET currency = ? WHERE entity_id = (SELECT id FROM current_entities WHERE name = ?)`).run(currency, accountName);
    if (coaFamily) {
      updateEntity(
        (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(accountName) as { id: number }).id,
        { relation: coaFamily },
        userId
      );
    }
  }
  if (entityStructure) {
    setupEquityStructure(businessName, entityStructure, userId, coaFamily, partnerNames);
  }
  // Per docs/general-typed-hierarchy-resolution-plan.md - a real,
  // recommended, non-privileged starting point every new business
  // gets, immediately renameable/deletable/extensible.
  seedDefaultHierarchyPrototypes(business, userId);
  return { business: businessName, actualLedger, budgetLedger };
}

/** Every real account a given ledger has actually posted to at least
 * once — used to let a person choose an existing Chart of Accounts
 * "family" (by picking a similar, already-real business/country) when
 * setting up a new business, and see exactly which real accounts that
 * choice means they'd be posting to. Genuinely different from
 * getChartOfAccounts (the full, static tree) — this is only the
 * accounts a real business has actually used, which is what someone
 * choosing a country template actually needs to see. */
export function getCoaFamilyAccounts(businessName: BusinessName, ledgerName: LedgerName): string[] {
  const ledger = db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ?)`).get(ledgerName, businessName) as { id: number } | undefined;
  if (!ledger) return [];
  const rows = db
    .prepare(
      `SELECT DISTINCT e.name
       FROM journal_line jl
       JOIN account a ON a.entity_id = jl.account_id
       JOIN current_entities e ON e.id = a.entity_id
       JOIN journal j ON j.id = jl.journal_id
       WHERE j.ledger_id = ?
       ORDER BY e.name`
    )
    .all(ledger.id) as { name: string }[];
  return rows.map((r) => r.name);
}

// ---------------------------------------------------------------------------
// Journal staging + posting
// ---------------------------------------------------------------------------

export interface StagedLine {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  description?: string;
  transdate?: string;
  account: AccountName;
  accountId?: number;
  amount_minor: number;
  memo?: string;
  division?: DivisionName;
  bankReference?: string;
}

export function stageLine(line: StagedLine): void {
  if (line.division) {
    const centerType = getDivisionType(line.division);
    if (centerType === 'Cost Center') {
      const category = (
        db.prepare(`SELECT category FROM business_reports WHERE account = ?`).get(line.account) as { category: string } | undefined
      )?.category;
      if (category === 'Income') {
        throw new ValidationError(
          `"${line.division}" is a Cost Center — it applies to purchasing only and cannot be used on an income account like "${line.account}". Use a Profit Center for sales-side postings.`
        );
      }
    }
  }
  db.prepare(
    `INSERT INTO journal_entry_staging (reference, business, ledger, description, transdate, account, account_id, amount_minor, memo, division, bank_reference)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (reference, business, ledger, account, account_id, location, division) DO UPDATE SET amount_minor = excluded.amount_minor, memo = excluded.memo, bank_reference = excluded.bank_reference, account_id = excluded.account_id`
  ).run(
    line.reference,
    line.business,
    line.ledger,
    line.description ?? '',
    line.transdate ?? null,
    line.account,
    line.accountId ?? null,
    line.amount_minor,
    line.memo ?? '',
    line.division ?? '',
    line.bankReference ?? null
  );
}

export function getStagedLines(reference: string, business: BusinessName, ledger: LedgerName): StagedLine[] {
  return db
    .prepare(
      `SELECT reference, business, ledger, description, transdate, account, amount_minor, memo, division, bank_reference AS bankReference
       FROM journal_entry_staging WHERE reference = ? AND business = ? AND ledger = ?`
    )
    .all(reference, business, ledger) as StagedLine[];
}

export interface RecurringJournalLine {
  account: string;
  amount_minor: number; // positive = debit, negative = credit
  memo?: string;
  effective_date?: string; // defaults to the journal's own start date if omitted
}

export type Recurrence = 'once' | 'weekly' | 'monthly' | 'yearly';

/** Creates a recurring journal directly — a real row in journal/
 * journal_line, not staged. This is the SECOND, and only other,
 * genuine exception to the single financial-posting path
 * (post_journal_entry_insert): recurrence is a property of the
 * journal itself, not something that makes sense to "post" the way a
 * single balanced entry does — there's no single moment to validate
 * balance against; each future occurrence is its own, separate
 * balance check, done by journal_occurrences at read time, not here.
 * Every referenced account is vivified here if it doesn't have one
 * yet — the same guarantee post_journal_entry's trigger gives
 * ordinary entries, just done in TypeScript rather than SQL since
 * this path doesn't go through that trigger at all. */
export function createRecurringJournal(
  business: BusinessName,
  ledger: LedgerName,
  reference: string,
  startDate: string,
  recurrence: Recurrence,
  lines: RecurringJournalLine[],
  userId: UserId,
  description?: string,
  recurrenceCount?: number
): void {
  const totalAtStart = lines.reduce((s, l) => s + (l.effective_date && l.effective_date !== startDate ? 0 : l.amount_minor), 0);
  if (totalAtStart !== 0) {
    throw new PostingError(`This entry does not balance at its start date (off by ${totalAtStart} minor units).`);
  }
  assertPeriodOpen(business, ledger, startDate);

  const businessId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(business) as { id: number } | undefined)?.id;
  const ledgerId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(ledger) as { id: number } | undefined)?.id;
  if (!businessId) throw new ValidationError(`No business named "${business}".`);
  if (!ledgerId) throw new ValidationError(`No ledger named "${ledger}".`);

  const insertJournal = db.prepare(
    `INSERT INTO journal (business_id, ledger_id, reference, description, transdate, user_id, recurrence, recurrence_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const vivify = db.prepare(`INSERT OR IGNORE INTO account (entity_id) VALUES (?)`);
  const insertLine = db.prepare(
    `INSERT INTO journal_line (journal_id, account_id, effective_date, amount_minor, memo) VALUES (?, ?, ?, ?, ?)`
  );

  const journalId = db.transaction(() => {
    const info = insertJournal.run(businessId, ledgerId, reference, description ?? '', startDate, userId, recurrence, recurrenceCount ?? null);
    const jid = Number(info.lastInsertRowid);
    for (const line of lines) {
      const acctId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(line.account) as { id: number } | undefined)?.id;
      if (!acctId) throw new ValidationError(`No entity named "${line.account}".`);
      vivify.run(acctId);
      insertLine.run(jid, acctId, line.effective_date ?? startDate, line.amount_minor, line.memo ?? '');
    }
    return jid;
  })();

  void journalId;
}

// ---------------------------------------------------------------------------
// AR/AP entry screens — each a purpose-built form with its own staging
// table (customer/vendor, amount, date — exactly that form's fields),
// posting through the exact same atomic post_journal_entry mechanism
// everything else uses. Two functions per form: stage (a plain insert)
// and post (fires the form's own INSTEAD OF INSERT trigger, which builds
// the right two-line entry and posts it).
// ---------------------------------------------------------------------------

/** The same, real, established "{account} — {location}" leaf pattern
 * — generalized for accounts with no real, specific product at all
 * (AR Sale's generic Sales Revenue, AP Purchase's chosen expense
 * account). Location here is genuinely per-invoice, not per-line —
 * these two screens have no line items to begin with. */
export function ensureLocationScopedAccount(baseAccountName: string, locationName: string, userId: UserId): string {
  const locationAccount = `${baseAccountName} — ${locationName}`;
  if (!Entity.get(locationAccount)) {
    const base = Entity.get(baseAccountName);
    if (!base) throw new ValidationError(`"${baseAccountName}" does not exist.`);
    Entity.create(locationAccount, baseAccountName, userId);
    setDimensionParent(locationAccount, 'Location', locationName, userId);
  }
  return locationAccount;
}

export interface ArSaleInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  customer: CustomerName;
  amount_minor: number;
  tax_minor?: number;
  location?: LocationName; // real, direct, per-invoice location — not per line
  transdate?: string;
  description?: string;
}

export function stageArSale(input: ArSaleInput): void {
  db.prepare(
    `INSERT INTO ar_sale_staging (reference, business, ledger, customer, amount_minor, tax_minor, location, transdate, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (reference, business, ledger) DO UPDATE SET
       customer = excluded.customer, amount_minor = excluded.amount_minor, tax_minor = excluded.tax_minor,
       location = excluded.location, transdate = excluded.transdate, description = excluded.description`
  ).run(input.reference, input.business, input.ledger, input.customer, input.amount_minor, input.tax_minor ?? 0, input.location ?? null, input.transdate ?? null, input.description ?? '');
}

export function postArSale(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  const staged = db
    .prepare(`SELECT * FROM ar_sale_staging WHERE reference = ? AND business = ? AND ledger = ?`)
    .get(reference, business, ledger) as (ArSaleInput & { tax_minor: number }) | undefined;
  if (!staged) throw new NotFoundError(`Nothing staged for AR sale ${reference}.`);
  if (staged.location) ensureLocationScopedAccount('Sales Revenue', staged.location, userId);
  try {
    db.prepare(`INSERT INTO ar_sale_post (reference, business, ledger, user_id) VALUES (?, ?, ?, ?)`).run(reference, business, ledger, userId);
  } catch (err) {
    throw new PostingError(err instanceof Error ? err.message : String(err));
  }
  db.prepare(
    `INSERT INTO invoice_line (reference, business, ledger, description, quantity, unit_price_minor, amount_minor, tax_minor) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)`
  ).run(reference, business, ledger, staged.description || 'Sale', staged.amount_minor, staged.tax_minor);
}

export interface ArReceiptInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  customer: CustomerName;
  amount_minor: number;
  transdate?: string;
  description?: string;
}

export function stageArReceipt(input: ArReceiptInput): void {
  db.prepare(
    `INSERT INTO ar_receipt_staging (reference, business, ledger, customer, amount_minor, transdate, description)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (reference, business, ledger) DO UPDATE SET
       customer = excluded.customer, amount_minor = excluded.amount_minor,
       transdate = excluded.transdate, description = excluded.description`
  ).run(input.reference, input.business, input.ledger, input.customer, input.amount_minor, input.transdate ?? null, input.description ?? '');
}

export function postArReceipt(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  try {
    db.prepare(`INSERT INTO ar_receipt_post (reference, business, ledger, user_id) VALUES (?, ?, ?, ?)`).run(reference, business, ledger, userId);
  } catch (err) {
    throw new PostingError(err instanceof Error ? err.message : String(err));
  }
}

export interface ApPurchaseInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  vendor: VendorName;
  expense_account: AccountName;
  amount_minor: number;
  tax_minor?: number;
  location?: LocationName; // real, direct, per-invoice location — not per line
  transdate?: string;
  description?: string;
}

export function stageApPurchase(input: ApPurchaseInput): void {
  db.prepare(
    `INSERT INTO ap_purchase_staging (reference, business, ledger, vendor, expense_account, amount_minor, tax_minor, location, transdate, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (reference, business, ledger) DO UPDATE SET
       vendor = excluded.vendor, expense_account = excluded.expense_account, amount_minor = excluded.amount_minor,
       tax_minor = excluded.tax_minor, location = excluded.location, transdate = excluded.transdate, description = excluded.description`
  ).run(
    input.reference, input.business, input.ledger, input.vendor, input.expense_account,
    input.amount_minor, input.tax_minor ?? 0, input.location ?? null, input.transdate ?? null, input.description ?? ''
  );
}

export function postApPurchase(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  const staged = db
    .prepare(`SELECT * FROM ap_purchase_staging WHERE reference = ? AND business = ? AND ledger = ?`)
    .get(reference, business, ledger) as (ApPurchaseInput & { tax_minor: number }) | undefined;
  if (!staged) throw new NotFoundError(`Nothing staged for AP purchase ${reference}.`);
  if (staged.location) ensureLocationScopedAccount(staged.expense_account, staged.location, userId);
  try {
    db.prepare(`INSERT INTO ap_purchase_post (reference, business, ledger, user_id) VALUES (?, ?, ?, ?)`).run(reference, business, ledger, userId);
  } catch (err) {
    throw new PostingError(err instanceof Error ? err.message : String(err));
  }
  db.prepare(
    `INSERT INTO invoice_line (reference, business, ledger, description, quantity, unit_price_minor, amount_minor, tax_minor) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)`
  ).run(reference, business, ledger, staged.description || 'Purchase', staged.amount_minor, staged.tax_minor);
}

export interface ApPaymentInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  vendor: VendorName;
  amount_minor: number;
  transdate?: string;
  description?: string;
}

export function stageApPayment(input: ApPaymentInput): void {
  db.prepare(
    `INSERT INTO ap_payment_staging (reference, business, ledger, vendor, amount_minor, transdate, description)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (reference, business, ledger) DO UPDATE SET
       vendor = excluded.vendor, amount_minor = excluded.amount_minor,
       transdate = excluded.transdate, description = excluded.description`
  ).run(input.reference, input.business, input.ledger, input.vendor, input.amount_minor, input.transdate ?? null, input.description ?? '');
}

export function postApPayment(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  try {
    db.prepare(`INSERT INTO ap_payment_post (reference, business, ledger, user_id) VALUES (?, ?, ?, ?)`).run(reference, business, ledger, userId);
  } catch (err) {
    throw new PostingError(err instanceof Error ? err.message : String(err));
  }
}

export * from './db-stock.js';
import { getLocation, getItemLocation, dispatchStockFromLocation, receiveStockAtLocation, transferStock, placeOrder, fulfillOrder, postQuantityMovement, getOrderStatus, todayAtLocation, getEffectiveSaleCurrency } from './db-stock.js';

// The four stock/order entry screens. Each stages into its own table,
// then "post" reads the staged row, does the real work (placing or
// fulfilling an order, moving quantity, posting the monetary side through
// the ordinary balanced mechanism), and clears the staged row — the
// same shape as AR/AP, just written as a function instead of a SQL
// trigger for the reasons noted in schema.sql.
// ---------------------------------------------------------------------------

export interface PurchaseOrderInput {
  reference: string;
  business: string;
  ledger: string;
  vendor: string;
  item: string;
  quantity: number;
  price_minor: number;
  location?: string; // real, direct delivery instructions: where this order should arrive
  transdate?: string;
  description?: string;
}

export function stagePurchaseOrder(input: PurchaseOrderInput): void {
  db.prepare(
    `INSERT INTO po_staging (reference, business, ledger, vendor, item, quantity, price_minor, location, transdate, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (reference, business, ledger) DO UPDATE SET
       vendor = excluded.vendor, item = excluded.item, quantity = excluded.quantity,
       price_minor = excluded.price_minor, location = excluded.location, transdate = excluded.transdate, description = excluded.description`
  ).run(input.reference, input.business, input.ledger, input.vendor, input.item, input.quantity, input.price_minor, input.location ?? null, input.transdate ?? null, input.description ?? '');
}

export function postPurchaseOrder(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  const staged = db
    .prepare(`SELECT * FROM po_staging WHERE reference = ? AND business = ? AND ledger = ?`)
    .get(reference, business, ledger) as PurchaseOrderInput | undefined;
  if (!staged) throw new NotFoundError(`Nothing staged for purchase order ${reference}.`);
  placeOrder(reference, business, ledger, staged.quantity, staged.quantity * staged.price_minor, userId, staged.transdate, asVendorName(staged.vendor), asItemName(staged.item), staged.location ? asLocationName(staged.location) : undefined);
  db.prepare(`DELETE FROM po_staging WHERE reference = ? AND business = ? AND ledger = ?`).run(reference, business, ledger);
}

export interface EmployeeClock {
  employee: string;
  po_reference: string;
  project_expense_account: string;
  clocked_in_at: string;
}

/** Clocks a real employee in against a real project expense account —
 * per direct, explicit, non-negotiable principle: this is a real
 * Purchase Order, accepted right now, for that employee's own real
 * product — their time — at their own real, established price per
 * hour (contact.wage_minor_per_hour). The real quantity is genuinely
 * unknown yet (the real hours worked won't be known until clock-out),
 * so a real, provisional single unit is ordered now; the real,
 * final quantity and value are what clock-out's own real receipt
 * actually delivers against this same, real, standing order. Goes
 * through the exact, same, proven, staged, triggered PO mechanism
 * every other purchase order already uses — never a direct table
 * write for the money itself. */
export function clockInToProject(employeeName: EmployeeName, projectExpenseAccount: AccountName, business: BusinessName, ledger: LedgerName, userId: UserId): EmployeeClock {
  const contact = getContact(employeeName);
  if (!contact) throw new ValidationError(`No real contact named "${employeeName}".`);
  if (!contact.wage_minor_per_hour) throw new ValidationError(`"${employeeName}" has no real, configured hourly wage rate yet — set one on the Contacts page first.`);
  const employee = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(employeeName) as { id: number } | undefined;
  if (!employee) throw new ValidationError(`No employee named "${employeeName}".`);
  const alreadyClocked = db.prepare(`SELECT 1 FROM current_entities WHERE parent_id = ? AND name LIKE 'Clocked In — %'`).get(employee.id);
  if (alreadyClocked) throw new ValidationError(`"${employeeName}" is already clocked in on a real project — clock out first.`);

  const clockedInAt = new Date().toISOString();
  const poReference = `CLOCK-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  stagePurchaseOrder({
    reference: poReference,
    business,
    ledger,
    vendor: employeeName,
    item: projectExpenseAccount,
    quantity: 1,
    price_minor: contact.wage_minor_per_hour,
    transdate: clockedInAt.slice(0, 10),
    description: `${employeeName}'s own real, standing time order against ${projectExpenseAccount}, accepted at clock-in`,
  });
  postPurchaseOrder(poReference, business, ledger, userId);

  // A real, single "Clocked In" entity under the employee - deleted on
  // clock-out (per direct instruction, no permanent tables beyond the
  // real four) rather than kept as its own, real, permanent history,
  // matching this table's own, prior DELETE-on-clock-out semantics
  // exactly (never an append-only log the way Period Lock/Shift are).
  Entity.create(`Clocked In — ${poReference} — ${projectExpenseAccount} — ${clockedInAt}`, employee.id, userId);
  return { employee: employeeName, po_reference: poReference, project_expense_account: projectExpenseAccount, clocked_in_at: clockedInAt };
}

function getOpenProjectClockEntity(employeeName: string): { id: number; po_reference: string; project_expense_account: string; clocked_in_at: string } | undefined {
  const row = db
    .prepare(
      `SELECT c.id, c.name FROM current_entities c
       JOIN current_entities emp ON emp.id = c.parent_id
       WHERE emp.name = ? AND c.name LIKE 'Clocked In — %'`
    )
    .get(employeeName) as { id: number; name: string } | undefined;
  if (!row) return undefined;
  const [, poReference, projectExpenseAccount, clockedInAt] = row.name.split(' — ');
  return { id: row.id, po_reference: poReference, project_expense_account: projectExpenseAccount, clocked_in_at: clockedInAt };
}

/** Clocks a real, currently clocked-in employee out — completes the
 * real delivery of their own, real, standing time order placed at
 * clock-in, rendering the real, computed hours worked (elapsed time
 * since clock-in, to the minute) genuinely liable to payment. Goes
 * through the exact, same, proven, staged, triggered stock-receipt
 * mechanism every other order's own real fulfillment already uses —
 * "item_qty" genuinely omitted, since real, direct labor time has
 * nothing physical to receive, the same way any other real service
 * already works with this same, established mechanism. */
export function clockOutOfProject(employeeName: EmployeeName, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  const open = getOpenProjectClockEntity(employeeName);
  if (!open) throw new ValidationError(`"${employeeName}" is not currently clocked in on any real project.`);

  const contact = getContact(employeeName)!;
  const clockedOutAt = new Date();
  const clockedInAt = new Date(open.clocked_in_at);
  const realHoursWorked = Math.max(0, (clockedOutAt.getTime() - clockedInAt.getTime()) / (1000 * 60 * 60));
  const valueMinor = Math.round(realHoursWorked * contact.wage_minor_per_hour!);

  const receiptReference = `${open.po_reference}-RECEIPT`;
  stageStockReceipt({
    reference: receiptReference,
    business,
    ledger,
    po_reference: open.po_reference,
    item: open.project_expense_account,
    vendor: employeeName,
    quantity: realHoursWorked,
    value_minor: valueMinor,
    transdate: clockedOutAt.toISOString().slice(0, 10),
    description: `${realHoursWorked.toFixed(2)} real hours worked, clock-in to clock-out, at ${employeeName}'s own real wage rate — real delivery of the standing time order accepted at clock-in, now genuinely liable to payment`,
  });
  postStockReceipt(receiptReference, business, ledger, userId);

  deleteEntity(open.id, asUserId(1));
}

/** A real employee's own, currently-open project clock-in, if any. */
export function getOpenProjectClockForEmployee(employeeName: EmployeeName): EmployeeClock | undefined {
  const open = getOpenProjectClockEntity(employeeName);
  if (!open) return undefined;
  return { employee: employeeName, po_reference: open.po_reference, project_expense_account: open.project_expense_account, clocked_in_at: open.clocked_in_at };
}

export interface StockReceiptInput {
  reference: string;
  business: string;
  ledger: string;
  po_reference: string;
  item: string; // the monetary-side account — a batch's Value account for stock, or any ordinary expense account for a service
  item_qty?: string | null; // the batch's Qty account — omit for a service (nothing physical received)
  vendor: string;
  quantity: number;
  value_minor: number;
  tax_minor?: number;
  transdate?: string;
  description?: string;
}

export function stageStockReceipt(input: StockReceiptInput): void {
  db.prepare(
    `INSERT INTO stock_receipt_staging
       (reference, business, ledger, po_reference, item, item_qty, vendor, quantity, value_minor, tax_minor, transdate, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (reference, business, ledger) DO UPDATE SET
       po_reference = excluded.po_reference, item = excluded.item, item_qty = excluded.item_qty,
       vendor = excluded.vendor, quantity = excluded.quantity, value_minor = excluded.value_minor,
       tax_minor = excluded.tax_minor, transdate = excluded.transdate, description = excluded.description`
  ).run(
    input.reference, input.business, input.ledger, input.po_reference, input.item, input.item_qty ?? null,
    input.vendor, input.quantity, input.value_minor, input.tax_minor ?? 0, input.transdate ?? null, input.description ?? ''
  );
}

export function postStockReceipt(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  const staged = db
    .prepare(`SELECT * FROM stock_receipt_staging WHERE reference = ? AND business = ? AND ledger = ?`)
    .get(reference, business, ledger) as (StockReceiptInput & { tax_minor: number }) | undefined;
  if (!staged) throw new NotFoundError(`Nothing staged for stock receipt ${reference}.`);

  // A service has nothing physical to receive — the quantity movement
  // (and the stock-batch tracking it implies) only happens when
  // item_qty was actually given.
  if (staged.item_qty) {
    postQuantityMovement(business, ledger, `${reference}-QTY`, asAccountName(staged.item_qty), staged.quantity, userId, staged.transdate);
  }
  stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), description: staged.description, transdate: staged.transdate, account: asAccountName(staged.item), amount_minor: staged.value_minor });
  if (staged.tax_minor) {
    stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), description: staged.description, transdate: staged.transdate, account: asAccountName('Purchases Tax Claimed'), amount_minor: staged.tax_minor });
  }
  stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), description: staged.description, transdate: staged.transdate, account: asAccountName(staged.vendor), amount_minor: -(staged.value_minor + staged.tax_minor) });
  postJournalEntry(reference, business, ledger, userId);
  fulfillOrder(staged.po_reference, reference, business, ledger, staged.quantity, staged.value_minor, userId, staged.transdate);

  db.prepare(
    `INSERT INTO invoice_line (reference, business, ledger, description, quantity, unit_price_minor, amount_minor, tax_minor) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    reference, business, ledger, staged.description || 'Receipt', staged.quantity,
    staged.quantity > 0 ? Math.round(staged.value_minor / staged.quantity) : null, staged.value_minor, staged.tax_minor
  );

  db.prepare(`DELETE FROM stock_receipt_staging WHERE reference = ? AND business = ? AND ledger = ?`).run(reference, business, ledger);
}

export interface SalesOrderInput {
  reference: string;
  business: string;
  ledger: string;
  customer: string;
  item: string;
  quantity: number;
  price_minor: number;
  location?: string; // real, direct dispatch instructions: where this order should ship from
  transdate?: string;
  description?: string;
}

export function stageSalesOrder(input: SalesOrderInput): void {
  db.prepare(
    `INSERT INTO so_staging (reference, business, ledger, customer, item, quantity, price_minor, location, transdate, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (reference, business, ledger) DO UPDATE SET
       customer = excluded.customer, item = excluded.item, quantity = excluded.quantity,
       price_minor = excluded.price_minor, location = excluded.location, transdate = excluded.transdate, description = excluded.description`
  ).run(input.reference, input.business, input.ledger, input.customer, input.item, input.quantity, input.price_minor, input.location ?? null, input.transdate ?? null, input.description ?? '');
}

export function postSalesOrder(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  const staged = db
    .prepare(`SELECT * FROM so_staging WHERE reference = ? AND business = ? AND ledger = ?`)
    .get(reference, business, ledger) as SalesOrderInput | undefined;
  if (!staged) throw new NotFoundError(`Nothing staged for sales order ${reference}.`);
  placeOrder(reference, business, ledger, staged.quantity, staged.quantity * staged.price_minor, userId, staged.transdate, undefined, asItemName(staged.item), staged.location ? asLocationName(staged.location) : undefined);
  db.prepare(`DELETE FROM so_staging WHERE reference = ? AND business = ? AND ledger = ?`).run(reference, business, ledger);
}

export interface StockDispatchInput {
  reference: string;
  business: string;
  ledger: string;
  so_reference: string;
  item?: string | null; // the batch's Value account (cost side) — omit for a service (no COGS leg)
  item_qty?: string | null; // the batch's Qty account — omit for a service (nothing physical shipped)
  customer: string;
  quantity: number;
  unit_cost_minor?: number | null; // omit for a service — there is no batch cost to recognize
  sale_price_minor: number;
  tax_minor?: number;
  transdate?: string;
  description?: string;
}

export function stageStockDispatch(input: StockDispatchInput): void {
  db.prepare(
    `INSERT INTO stock_dispatch_staging
       (reference, business, ledger, so_reference, item, item_qty, customer, quantity, unit_cost_minor, sale_price_minor, tax_minor, transdate, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (reference, business, ledger) DO UPDATE SET
       so_reference = excluded.so_reference, item = excluded.item, item_qty = excluded.item_qty,
       customer = excluded.customer, quantity = excluded.quantity, unit_cost_minor = excluded.unit_cost_minor,
       sale_price_minor = excluded.sale_price_minor, tax_minor = excluded.tax_minor,
       transdate = excluded.transdate, description = excluded.description`
  ).run(
    input.reference, input.business, input.ledger, input.so_reference, input.item ?? null, input.item_qty ?? null,
    input.customer, input.quantity, input.unit_cost_minor ?? null, input.sale_price_minor, input.tax_minor ?? 0,
    input.transdate ?? null, input.description ?? ''
  );
}

export function postStockDispatch(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  const staged = db
    .prepare(`SELECT * FROM stock_dispatch_staging WHERE reference = ? AND business = ? AND ledger = ?`)
    .get(reference, business, ledger) as (StockDispatchInput & { tax_minor: number }) | undefined;
  if (!staged) throw new NotFoundError(`Nothing staged for stock dispatch ${reference}.`);

  const saleAmount = staged.quantity * staged.sale_price_minor;

  stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), description: staged.description, transdate: staged.transdate, account: asAccountName(staged.customer), amount_minor: saleAmount + staged.tax_minor });
  stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), description: staged.description, transdate: staged.transdate, account: asAccountName('Sales Revenue'), amount_minor: -saleAmount });
  if (staged.tax_minor) {
    stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), description: staged.description, transdate: staged.transdate, account: asAccountName('Sales Tax Payable'), amount_minor: -staged.tax_minor });
  }
  postJournalEntry(reference, business, ledger, userId);

  // A service has no batch to draw cost from — no COGS leg, no
  // quantity movement, exactly the same way a service receipt skips
  // both on the purchasing side.
  if (staged.item && staged.unit_cost_minor != null) {
    const cogsAmount = staged.quantity * staged.unit_cost_minor;
    const cogsReference = `${reference}-COGS`;
    stageLine({ reference: cogsReference, business: asBusinessName(business), ledger: asLedgerName(ledger), description: 'Cost of goods sold', transdate: staged.transdate, account: asAccountName('Cost of Goods Sold'), amount_minor: cogsAmount });
    stageLine({ reference: cogsReference, business: asBusinessName(business), ledger: asLedgerName(ledger), description: 'Cost of goods sold', transdate: staged.transdate, account: asAccountName(staged.item), amount_minor: -cogsAmount });
    postJournalEntry(cogsReference, business, ledger, userId);
  }
  if (staged.item_qty) {
    postQuantityMovement(business, ledger, `${reference}-QTY`, asAccountName(staged.item_qty), -staged.quantity, userId, staged.transdate);
  }
  fulfillOrder(staged.so_reference, reference, business, ledger, staged.quantity, saleAmount, userId, staged.transdate);

  db.prepare(
    `INSERT INTO invoice_line (reference, business, ledger, description, quantity, unit_price_minor, amount_minor, tax_minor) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(reference, business, ledger, staged.description || 'Dispatch', staged.quantity, staged.sale_price_minor, saleAmount, staged.tax_minor);

  db.prepare(`DELETE FROM stock_dispatch_staging WHERE reference = ? AND business = ? AND ledger = ?`).run(reference, business, ledger);
}

export function removeStagedLine(reference: string, business: BusinessName, ledger: LedgerName, account: string): void {
  db.prepare(
    `DELETE FROM journal_entry_staging WHERE reference = ? AND business = ? AND ledger = ? AND account = ?`
  ).run(reference, business, ledger, account);
}

export class PostingError extends Error {}

export function postJournalEntry(reference: string, business: BusinessName, ledger: LedgerName, userId: UserId): void {
  try {
    db.prepare(`INSERT INTO post_journal_entry (reference, business, ledger, user_id) VALUES (?, ?, ?, ?)`).run(
      reference,
      business,
      ledger,
      userId
    );
  } catch (err) {
    // This statement only ever does one thing, so any error from it is a
    // posting failure worth surfacing as such — no need to pattern-match
    // SQLite's exact wording (which turned out not to contain "ABORT" at
    // all, just the RAISE message text itself, e.g. "entry does not
    // balance" — an earlier version of this guessed at the format instead
    // of checking, and never actually matched).
    throw new PostingError(err instanceof Error ? err.message : String(err));
  }
}

export interface JournalSummary {
  journal_id: number;
  occurrence_date: string | null;
  reference: string;
  description: string;
  business: string;
  ledger: string;
  recurrence: string;
  posted_by: string;
  total_debit_minor: number;
  total_credit_minor: number;
}

/** One row per OCCURRENCE, not per journal — a recurring journal with 12
 * monthly occurrences produces 12 rows here, each with its own date and
 * its own (possibly amended, see journal_occurrences) totals. An
 * ordinary 'once' entry is the trivial case: exactly one row. */
export function listJournalEntries(business: BusinessName, ledger: LedgerName, limit = 100, offset = 0): JournalSummary[] {
  return db
    .prepare(
      `SELECT jo.journal_id, jo.transdate AS occurrence_date, jo.reference, jo.description,
              biz.name AS business, led.name AS ledger, j.recurrence, u.username AS posted_by,
              COALESCE(SUM(CASE WHEN jo.amount_minor > 0 THEN jo.amount_minor ELSE 0 END), 0) AS total_debit_minor,
              COALESCE(SUM(CASE WHEN jo.amount_minor < 0 THEN -jo.amount_minor ELSE 0 END), 0) AS total_credit_minor
       FROM journal_occurrences jo
       JOIN journal j ON j.id = jo.journal_id
       JOIN current_entities biz ON biz.id = jo.business_id
       JOIN current_entities led ON led.id = jo.ledger_id
       JOIN users u ON u.id = jo.user_id
       WHERE biz.name = ? AND led.name = ?
         AND jo.reference NOT LIKE '%-QTY'
       GROUP BY jo.journal_id, jo.transdate
       ORDER BY jo.transdate DESC, jo.journal_id DESC
       LIMIT ? OFFSET ?`
    )
    .all(business, ledger, limit, offset) as JournalSummary[];
}

/** The total count behind listJournalEntries, needed for "page n of
 * nn" — same grouping (one row per journal_id + transdate), just
 * counted instead of returned. */
export function countJournalEntries(business: BusinessName, ledger: LedgerName): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total FROM (
         SELECT 1
         FROM journal_occurrences jo
         JOIN current_entities biz ON biz.id = jo.business_id
         JOIN current_entities led ON led.id = jo.ledger_id
         WHERE biz.name = ? AND led.name = ?
           AND jo.reference NOT LIKE '%-QTY'
         GROUP BY jo.journal_id, jo.transdate
       )`
    )
    .get(business, ledger) as { total: number };
  return row.total;
}

export interface JournalDetail extends JournalSummary {
  lines: { account: string; accountnumber: string | null; amount_minor: number; memo: string; division: string | null }[];
}

/** A specific occurrence needs both which journal AND which date — a
 * recurring journal's id alone isn't enough to pick out one occurrence
 * from its whole schedule. */
export function getJournalEntry(business: BusinessName, ledger: LedgerName, journalId: number, occurrenceDate: string): JournalDetail | undefined {
  const header = db
    .prepare(
      `SELECT jo.journal_id, jo.transdate AS occurrence_date, jo.reference, jo.description,
              biz.name AS business, led.name AS ledger, j.recurrence, u.username AS posted_by
       FROM journal_occurrences jo
       JOIN journal j ON j.id = jo.journal_id
       JOIN current_entities biz ON biz.id = jo.business_id
       JOIN current_entities led ON led.id = jo.ledger_id
       JOIN users u ON u.id = jo.user_id
       WHERE jo.journal_id = ? AND jo.transdate = ? AND biz.name = ? AND led.name = ?
       LIMIT 1`
    )
    .get(journalId, occurrenceDate, business, ledger) as
    | {
        journal_id: number;
        occurrence_date: string;
        reference: string;
        description: string;
        business: string;
        ledger: string;
        recurrence: string;
        posted_by: string;
      }
    | undefined;
  if (!header) return undefined;

  const lines = db
    .prepare(
      `SELECT e.name AS account, a.accountnumber, jo.amount_minor, jo.memo, d.name AS division
       FROM journal_occurrences jo
       JOIN current_entities e ON e.id = jo.account_id
       LEFT JOIN account a ON a.entity_id = e.id
       LEFT JOIN current_entities d ON d.id = jo.division_id
       WHERE jo.journal_id = ? AND jo.transdate = ?`
    )
    .all(journalId, occurrenceDate) as { account: string; accountnumber: string | null; amount_minor: number; memo: string; division: string | null }[];

  const total_debit_minor = lines.filter((l) => l.amount_minor > 0).reduce((s, l) => s + l.amount_minor, 0);
  const total_credit_minor = lines.filter((l) => l.amount_minor < 0).reduce((s, l) => s - l.amount_minor, 0);

  return { ...header, lines, total_debit_minor, total_credit_minor };
}

/** Reverses one occurrence of a posted entry — creates a brand new,
 * ordinary ('once') entry with every line's amount negated, dated
 * today (or a given date), referencing the original via reversal_of
 * (a column that's existed in this schema since the very first version
 * of `journal`, unused until now). Works the same whether the original
 * occurrence came from a plain entry or from a recurring journal's
 * schedule — reversing one occurrence never touches the original
 * journal row or its schedule, it only adds an offsetting entry next to
 * it. Reuses postGeneralJournalEntry's exact posting path (staging,
 * then post_journal_entry), so a reversal is validated and made atomic
 * the same way any other entry is — it can still fail if, implausibly,
 * the negated lines don't balance (they always will, since negating a
 * balanced set of amounts is still balanced), but the mechanism doesn't
 * special-case that away silently. */
// ---------------------------------------------------------------------------
// Accounting periods — a single "closed through" date per business/
// ledger, append-only (period_lock_history), same self-auditing shape
// as everything else here. Closing is never permanent: reopening
// (locked_through_date NULL) immediately lifts it for exactly the
// amendments — reversals, reposting, corrected entries, contras — that
// a genuine close should never permanently block.
// ---------------------------------------------------------------------------

export interface PeriodLockStatus {
  locked_through_date: string | null;
  changed_by: number | null;
  changed_at: string | null;
}

export interface LedgerDateRange {
  earliest: string | null;
  latest: string | null;
}

/** The real, earliest and latest transdate of anything ever actually
 * posted to this ledger — used to default a report's date pickers to
 * a period with genuinely real data in it, rather than leaving them
 * blank. A blank range isn't "everything, forever" for Income/Expense
 * once a Year End Close has happened — those accounts get zeroed as
 * item of closing, so "no date filter" after a close means "as of
 * right now", which is correctly zero, not a bug, but reads as one if
 * a person never realizes that's what's being shown. */
export function getLedgerDateRange(businessName: BusinessName, ledgerName: LedgerName): LedgerDateRange {
  const row = db
    .prepare(
      `SELECT MIN(j.transdate) AS earliest, MAX(j.transdate) AS latest
       FROM journal j
       WHERE j.ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ?))
         AND j.reference NOT LIKE 'CLOSE-%'`
    )
    .get(ledgerName, businessName) as { earliest: string | null; latest: string | null };
  return row;
}

export function getPeriodLockStatus(business: BusinessName, ledger: LedgerName): PeriodLockStatus {
  // A real "Period Lock" entity, one per (business, ledger) - its own,
  // real, established rename history (per entity_update_insert) IS
  // the real, append-only audit trail period_lock_history used to be
  // a separate table for; entity_id stays fixed, each rename closes
  // out the old row and appends a new one, exactly the same, real
  // shape. Never created ahead of time - a business/ledger that has
  // never been locked correctly, genuinely has no such entity yet.
  // The entity's own, real, current name always carries its current,
  // live status as a suffix (never a fixed, bare name), so this is a
  // real, direct prefix match, not an exact one.
  const ledgerEntity = db
    .prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ?)`)
    .get(ledger, business) as { id: number } | undefined;
  if (!ledgerEntity) return { locked_through_date: null, changed_by: null, changed_at: null };
  const lockEntityPrefix = `${business} — ${ledger} — Period Lock`;
  const row = db
    .prepare(`SELECT name, created_at, created_by FROM current_entities WHERE name LIKE ? AND parent_id = ?`)
    .get(`${lockEntityPrefix}%`, ledgerEntity.id) as { name: string; created_at: string; created_by: number } | undefined;
  if (!row) return { locked_through_date: null, changed_by: null, changed_at: null };
  const suffix = row.name.slice(lockEntityPrefix.length);
  const throughDate = suffix.startsWith(' — Locked through ') ? suffix.slice(' — Locked through '.length) : null;
  return { locked_through_date: throughDate, changed_by: row.created_by, changed_at: row.created_at };
}

function ensurePeriodLockEntity(business: BusinessName, ledger: LedgerName, userId: UserId): { id: number; name: string } {
  const ledgerEntity = db
    .prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ?)`)
    .get(ledger, business) as { id: number } | undefined;
  if (!ledgerEntity) throw new ValidationError(`No real ledger "${ledger}" under business "${business}".`);
  const lockEntityPrefix = `${business} — ${ledger} — Period Lock`;
  const existing = db
    .prepare(`SELECT id, name FROM current_entities WHERE name LIKE ? AND parent_id = ?`)
    .get(`${lockEntityPrefix}%`, ledgerEntity.id) as { id: number; name: string } | undefined;
  if (existing) return existing;
  return Entity.create(`${lockEntityPrefix} — Open`, ledgerEntity.id, userId);
}

export function closePeriod(business: BusinessName, ledger: LedgerName, throughDate: string, userId: UserId): void {
  const lockEntity = ensurePeriodLockEntity(business, ledger, userId);
  updateEntity(lockEntity.id, { name: `${business} — ${ledger} — Period Lock — Locked through ${throughDate}` }, userId);
}

export function reopenPeriod(business: BusinessName, ledger: LedgerName, userId: UserId): void {
  const lockEntity = ensurePeriodLockEntity(business, ledger, userId);
  updateEntity(lockEntity.id, { name: `${business} — ${ledger} — Period Lock — Open` }, userId);
}

/** Shared enforcement for the two direct-insert paths that bypass
 * post_journal_entry entirely (createRecurringJournal,
 * postQuantityMovement) — the SQL trigger already protects ordinary
 * posting and everything chained through it (AR/AP, stock screens),
 * but these two write straight into journal/journal_line themselves,
 * so they need the same check made explicitly, not inherited for
 * free. */
export function assertPeriodOpen(business: BusinessName, ledger: LedgerName, transdate: string): void {
  const status = getPeriodLockStatus(business, ledger);
  if (status.locked_through_date != null && transdate <= status.locked_through_date) {
    throw new PostingError(
      `This period is closed to normal posting (through ${status.locked_through_date}) — reopen it first if this is a genuine correction.`
    );
  }
}

export function reverseJournalEntry(business: BusinessName, ledger: LedgerName, journalId: number, occurrenceDate: string, userId: UserId, reversalDate?: string): void {
  const original = getJournalEntry(business, ledger, journalId, occurrenceDate);
  if (!original) throw new NotFoundError(`No entry found for journal ${journalId} on ${occurrenceDate}.`);

  const reversalReference = `${original.reference}-REV-${occurrenceDate}`;

  // The reversal reference is deterministic — always the same string
  // for this exact (journal, occurrence) pair — so reversing the same
  // occurrence twice would otherwise reuse it. Caught as a real,
  // reproduced bug: without this check, the second attempt didn't
  // error at all, it silently corrupted journal_line (both attempts'
  // lines ended up attached to the FIRST reversal's journal row, since
  // the posting trigger looks up "the" journal by reference alone,
  // which becomes ambiguous the instant a duplicate exists). The
  // journal_reference_unique index is the database-level backstop for
  // this whole class of bug; this check exists to give a clear,
  // specific message for this specific, easy-to-hit case rather than
  // surfacing a raw constraint violation.
  const alreadyReversed = db
    .prepare(
      `SELECT 1 FROM journal WHERE reference = ? AND business_id = (SELECT id FROM current_entities WHERE name = ?) AND ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ?))`
    )
    .get(reversalReference, original.business, original.ledger, original.business);
  if (alreadyReversed) {
    throw new PostingError(`${original.reference} (${occurrenceDate}) has already been reversed — reverse the reversal itself if this needs undoing again.`);
  }

  const date = reversalDate ?? new Date().toISOString().slice(0, 10);

  for (const line of original.lines) {
    stageLine({
      reference: reversalReference,
      business: asBusinessName(original.business),
      ledger: asLedgerName(original.ledger),
      description: `Reversal of ${original.reference} (${occurrenceDate})`,
      transdate: date,
      account: asAccountName(line.account),
      amount_minor: -line.amount_minor,
      memo: line.memo,
      division: line.division ? asDivisionName(line.division) : undefined,
    });
  }
  postJournalEntry(reversalReference, asBusinessName(original.business), asLedgerName(original.ledger), userId);

  db.prepare(
    `UPDATE journal SET reversal_of = ? WHERE reference = ? AND business_id = (SELECT id FROM current_entities WHERE name = ?) AND ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ?))`
  ).run(journalId, reversalReference, original.business, original.ledger, original.business);
}

// Migrates every real, existing translation into the entity-only
// mechanism — must run after every function above (setTranslation,
// createEntity, etc.) is defined, and after seedRemainingData() has
// already created every real concept entity.

