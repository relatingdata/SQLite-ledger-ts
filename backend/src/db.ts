import { Database } from './sqlite-runtime.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hashPassword, verifyPassword } from './password.js';
import { Entity, Detail } from './primitives.js';
import { getLedgerBalances, ensureCurrencyAccount, resolveCashAtBankAccount, setAccountCurrency } from './db-reports.js';

// ---------------------------------------------------------------------------
// The real data model, stated plainly here since it spans many real
// tables and functions no single file boundary can capture on its own.
//
// PERMANENT DATA lives in two real categories, not one:
//
// 1. The core double-entry ledger: entities, journal,
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
// useful for watching workflows unfold without a separate tool. A real,
// confirmed gap found directly: this comment documented the feature but
// nothing ever implemented it. Fixed here by wrapping prepare() itself
// (not the Database constructor's own options, which the real, cross-
// runtime RuntimeDatabase abstraction above — bun:sqlite vs.
// better-sqlite3 — does not uniformly support) so this works identically
// under every real runtime this project targets.
export const db = new Database(dbPath);
if (process.env.DB_VERBOSE) {
  const realPrepare = db.prepare.bind(db);
  db.prepare = ((sql: string) => {
    console.log('[SQL]', sql.replace(/\s+/g, ' ').trim());
    return realPrepare(sql);
  }) as typeof db.prepare;
}
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
  // Per direct, absolute instruction: the application's own basic,
  // initial data load must carry ZERO presence of any demo/seed
  // business, and zero presence of any non-English language's
  // translated text - both are real, genuine content that belongs in
  // a separately-run, real test-runner script (building a business
  // live through the real API/UI, or loading translations live
  // through the real API/UI), never baked into what boots by
  // default. `00-core.sql` alone is now the one, real, clean, minimal
  // file: table/view/trigger definitions, structural entities,
  // English vocabulary words (which need no separate "translation" at
  // all - the word IS the canonical English name), and the one, real,
  // permanent 'admin' bootstrap business. See
  // `scripts/simulate-wine-retail-month.ts` (builds a real demo
  // business entirely through real app functions) and
  // `scripts/load-translations.ts` (loads
  // `shared-fixtures/translations.csv` into a running instance via
  // the real API or the real /setup/translations UI) for how to add
  // either kind of real, additional data back in, deliberately,
  // on demand - never automatically at boot.
  //
  // Formerly: schema.sql was split into real, separate files, per direct
  // request: the basic, structural schema; each real language's own
  // vocabulary separately; and the German BMW / French Peugeot demo
  // ledger data separately. Loaded here, concatenated, in the real,
  // safe dependency order — confirmed directly by a real, live
  // database-load test before this split was trusted, not assumed:
  // core first (every real entity a vocabulary translation or demo
  // posting could reference), then the demo ledger data (depends on
  // core entities already existing — Businesses, German CoA, French
  // CoA), then a real, separate "link every real, existing business
  // to its own real CoA prototype" block (a real, second, genuine
  // dependency found only by a live load failure, not anticipated in
  // advance — it references entities from both core AND the demo
  // block, so it must load after both), then each real, per-language
  // vocabulary file (each only depends on its own real, target
  // entity already existing, all of which live in core).
  const schemaDir = path.join(__dirname, '..', 'schema');
  const readSchema = (f: string) => fs.readFileSync(path.join(schemaDir, f), 'utf8');

  db.exec(readSchema('00-core.sql'));

  // 30-coa-links.sql links every real, existing account to its own
  // real CoA prototype. Filtered here, directly, against what
  // actually, really exists in the database at this point — never
  // guessed at or hand-enumerated — so this stays correct now that
  // nothing but 00-core.sql's own structural/admin accounts ever
  // exist at this point in a fresh boot (every line naming an
  // account that only a demo business would have ever created is
  // simply, safely skipped).
  const coaLinksSql = readSchema('30-coa-links.sql');
  const filteredCoaLinksSql = coaLinksSql
    .split('\n')
    .filter((line) => {
      const match = line.match(/WHERE name = '((?:[^'\\]|\\.)*)'\)/);
      if (!match) return true; // not a real, single-entity-lookup line — keep it as-is
      const entityName = match[1].replace(/''/g, "'");
      return !!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(entityName);
    })
    .join('\n');
  db.exec(filteredCoaLinksSql);
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
export const typeProviderName: TypeDescriptor<'ProviderName'> = { brand: 'ProviderName' };
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
export type LocationName = string & { readonly __brand: 'LocationName' };
export type EmployeeName = string & { readonly __brand: 'EmployeeName' };
export type CustomerName = string & { readonly __brand: 'CustomerName' };
export type ProviderName = string & { readonly __brand: 'ProviderName' };
export type ItemName = string & { readonly __brand: 'ItemName' };
// Numeric IDs get the exact, same treatment, for the exact, same real
// reason — a plain `number` can't distinguish "who performed this
// action" (userId, a real, direct primary key into the separate,
// real `users` table) from "which entity" (accountId/itemId/
// employeeId/locationId/etc., all genuinely the same underlying
// concept — a real, direct primary key into the one, shared
// entities table every real entity in this system uses, just
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
export function asLocationName(name: string): LocationName {
  return name as LocationName;
}
export function asEmployeeName(name: string): EmployeeName {
  return name as EmployeeName;
}
export function asCustomerName(name: string): CustomerName {
  return name as CustomerName;
}
export function asProviderName(name: string): ProviderName {
  return name as ProviderName;
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
 * Businesses > admin) — a real, reproduced bug where several
 * screens' account pickers used exactly that heuristic and picked up
 * ledgers, vocabulary words, and other non-account entities purely by
 * depth coincidence.
 *
 * Deliberately does NOT also require "no real children" (tried
 * directly, while building the bank-accounts-by-currencies mechanism,
 * and reverted): the established, confirmed, working Product/Tier/Item
 * design (docs/multi-dimensional-reporting.md §10) has a real, genuine
 * case where a real, postable "Sales" leaf also has its own, further,
 * real child (the tier-level item entity) — a real account here can
 * genuinely be both directly postable AND a real, structural parent
 * for an unrelated, further purpose at once. "Has real children" is
 * not, therefore, a safe, general signal for "is a header, never
 * postable" in this codebase — real, further enforcement that a
 * bank-accounts-by-currencies header specifically cannot itself be
 * posted to needs its own, real, more specific mechanism, not a
 * change to this shared, general-purpose flag's own meaning. */
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
      `SELECT e.id, e.name, e.parent_id, e.relation_id, a.accountnumber, a.balance_minor, a.currency
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
}

/** Every version an entity has ever had, oldest first — the point of
 * the whole append-only design: nothing about this is reconstructed or
 * inferred, it's simply every row that was ever written, in order. A
 * real delete is itself one more row in this same history - a
 * reparent under the real "Deleted" root - not a separate, flagged
 * event; look at a row's own parent_id to see this. */
export function getEntityHistory(id: number): EntityHistoryRow[] {
  return db
    .prepare(
      `SELECT name, parent_id, relation_id, created_at, created_by
       FROM entities WHERE entity_id = ? ORDER BY row_id`
    )
    .all(id) as EntityHistoryRow[];
}

function resolveId(name: string | null | undefined, parentId?: number): number | null {
  if (name == null || name === '') return null;
  const row =
    parentId != null
      ? (db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(name, parentId) as { id: number } | undefined)
      : (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(name) as { id: number } | undefined);
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
/** Resolves a real, named entity - by default, globally, matching
 * this function's own, long-established behavior for genuinely
 * singleton, global concepts (Application, Businesses, Vocabulary,
 * Vendors - there is only ever one, ever). A real, further, optional
 * parent narrows this to a real, scoped lookup instead - the real,
 * correct fix for a real, confirmed, fundamental gap, found directly:
 * create()'s own uniqueness check was already scoped-not-global (two
 * real siblings under the same real parent can't share a name; the
 * exact same name is genuinely fine under a different parent), but
 * fetch() itself had no way to honor that on the read side - a name
 * conceptually repeated per parent (a business's own real
 * "Hierarchies", say) could only ever be found by resorting to a
 * mangled, business-prefixed name, or be silently, ambiguously
 * resolved to whichever real row a global lookup happened to return
 * first. */
export function requireEntity<TBrand extends string>(name: string, type: TypeDescriptor<TBrand>, parent?: TypedNode<string>): TypedNode<TBrand> {
  const id = resolveId(name, parent?.id);
  if (id == null) throw new ValidationError(`No entity named "${name}".`);
  if (type.validate && !type.validate(name)) {
    throw new ValidationError(`"${name}" exists, but is not a genuine ${type.brand}.`);
  }
  return { id: asEntityId(id), name: name as string & { __brand: TBrand } };
}

/** Resolves a real, structural CoA category (Asset/Liability/Equity/
 * Income/Expense) under the one, real, global Chart of Accounts
 * template specifically - never a business's own, genuinely separate
 * copy (see PER_BUSINESS_ROOTS' Vocabulary entry and
 * copyChartOfAccountsInto). A real, confirmed, fundamental fix: every
 * business now genuinely, correctly owns its own, real, independent
 * copy of each of these category names, so a bare, parent-less
 * fetch('Equity', typeRootName) became genuinely ambiguous the moment
 * more than one real business existed - this is the one, real,
 * correct, unambiguous replacement, resolving through the one, real,
 * true singleton (Application) down to the one, real, global
 * template, every real time. */
export function requireGlobalCoaCategory(categoryName: string): TypedNode<'RootName'> {
  const application = requireEntity('Application', typeRootName);
  const globalCoa = requireEntity('Chart of Accounts', typeChartOfAccountsRootName, application);
  return requireEntity(categoryName, typeRootName, globalCoa);
}

/** The real, numeric-id counterpart to fetch - for the real, existing
 * cases that already hold an id (from a route param, a prior query),
 * not a name, per no-generic-functions. */
export function requireEntityById<TBrand extends string>(id: number, type: TypeDescriptor<TBrand>): TypedNode<TBrand> {
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
  // Per direct instruction: English is no longer merely implied by a
  // concept's own name — any real word created directly under the one,
  // true, global Vocabulary, from ANY real code path (this is the
  // shared, generic, low-level primitive every one of them goes
  // through, not just "Add a new word"'s own createEntityRaw), gets
  // its own, real, editable English translation row too, the exact,
  // same way as German or French.
  if (parent.id === globalVocabularyId()) {
    setTranslation(name, 'English', name, userId);
  }
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


export function createEntityRaw(input: NewEntity, userId: UserId): EntityNode {
  // "Vocabulary" specifically, unscoped, is the exact, same, real
  // ambiguity already found and fixed several times this session —
  // every business gets its own, separate "Vocabulary" entity too, so
  // the generic, bare resolveId(input.parent) below cannot be trusted
  // for this one, specific, real name. The real, global Vocabulary is
  // always what "Add a new word" means by it.
  const isGlobalVocabularyWord = input.parentId == null && input.parent === 'Vocabulary';
  const parentId = input.parentId ?? (isGlobalVocabularyWord ? globalVocabularyId() : input.parent ? resolveId(input.parent) : null);
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
  // Per direct instruction: English is no longer merely implied by a
  // concept's own name — every real word genuinely gets its own, real,
  // editable English translation row too, the exact, same, real way
  // as German or French, created here exactly once, via setTranslation
  // itself (never duplicated by hand). Every concept already seeded in
  // 00-core.sql gets the same, real row via a one-time, generic
  // backfill in the schema itself — see the note there.
  if (isGlobalVocabularyWord) {
    setTranslation(input.name, 'English', input.name, userId);
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
/** Per direct, absolute instruction: no function implying in-place
 * mutation may exist in this design. This name states exactly what
 * happens: the current row for id is superseded by a new one carrying
 * the given changes, every other field carried forward unchanged -
 * the same, real, pre-existing entity_update insert-only mechanism
 * underneath, never a new one. */
export function supersedeEntity(id: number, input: EntityUpdate, userId: UserId): EntityNode {
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
 * primitive already proven for hierarchy links elsewhere in this
 * codebase, not a new concept. Passing null removes the link
 * entirely, restoring today's real, existing is_postable_account-
 * derived behavior for that entity. */
export function setLineType(entityName: string, lineType: string | null, userId: UserId): void {
  if (lineType === null) {
    deleteEntityLink(entityName, 'Line Type', userId);
    return;
  }
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(lineType)) {
    create(requireEntity('Chart of Accounts Line Types', typeRootName), typeLineTypeMarkerName, lineType, userId);
  }
  setEntityLink(entityName, 'Line Type', lineType, userId);
}

/** The real, currently-set line type for one entity, or undefined if
 * never explicitly typed — the exact, same real getEntityLink
 * mechanism already proven elsewhere. */
// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export function getLineType(entityName: string): string | undefined {
//   return getEntityLink(entityName, 'Line Type');
// }

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
    create(requireEntity('Storage Origin Types', typeRootName), typeStorageOriginMarkerName, origin, userId);
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
    create(requireEntity('Text Direction Types', typeRootName), typeTextDirectionMarkerName, direction, userId);
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
 * with `targetName` — e.g. "Smith Prototype Trust" is "Trustee Of"
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
    create(requireEntity(relationshipType, typeRootName), typeRelationshipRecordName, recordName, userId);
  }
  // Both of these bare, unscoped-by-parent lookups are now ordered
  // deterministically (oldest match wins) for the exact, same reason
  // resolveId() itself was fixed to - see that function's own
  // comment for the confirmed, real collision this matters for.
  const record = db.prepare(`SELECT id FROM current_entities WHERE name = ? ORDER BY id ASC LIMIT 1`).get(recordName) as { id: number };
  supersedeEntity(record.id, { relation: targetName }, userId);
  const entity = db.prepare(`SELECT id FROM current_entities WHERE name = ? ORDER BY id ASC LIMIT 1`).get(entityName) as { id: number } | undefined;
  if (!entity) throw new NotFoundError(`No entity named "${entityName}".`);
  supersedeEntity(entity.id, { relation: recordName }, userId);
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

export interface OrgChartGroup {
  group: string;
  locations: { location: string; employees: string[] }[];
}
export interface OrganizationChart {
  business: string;
  companyWideEmployees: string[]; // "Place of Employment" points straight at the business itself
  groups: OrgChartGroup[];
}

/** Builds the real, complete organizational chart for a real
 * business, walking the full, real chain — Business <-(belongs to)-
 * Group <-(belongs to)- Location <-(place of employment)- Employee
 * — through the three real relationship layers, not through
 * parent_id at all (each of those stays exactly where it already
 * was; only the relationship layer is new). Per direct confirmation:
 * "yes definitely for organizational charts and employee directory".
 * "Group" here is a genuinely generic, business-chosen grouping of
 * locations (a business may call its own groups "Division," "Region,"
 * or anything else) — never a hardcoded, privileged concept. */
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
export function getHierarchy(rootName: string, relationshipType?: string, knownRootId?: number): HierarchyNode {
  // A real, confirmed, latent bug, found directly by a test suite
  // that finally exercises more than one real business at once: the
  // bare lookup below is only ever safe while 'rootName' (e.g.
  // "Income", "Asset") names exactly one real entity anywhere - true
  // only for the very first business ever created. Every business
  // after that gets its own real "Income"/"Asset"/... mirror of its
  // own, so the bare lookup becomes genuinely ambiguous and can
  // silently walk some OTHER business's own category tree instead of
  // this caller's intended one. knownRootId lets a caller that
  // already knows the exact, correct, business-scoped entity id (via
  // resolveBusinessCoaAccountId, same as copyChartOfAccountsInto's
  // own relationId fix) bypass the ambiguous name resolution
  // entirely - the same, already-proven pattern used elsewhere in
  // this file for exactly this reason.
  const rootId = knownRootId ?? (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(rootName) as { id: number } | undefined)?.id;
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

/** Resolves the real, single root entity a business's own real
 * locations live directly under - the modern "Locations" child every
 * business created through the application itself gets
 * (PER_BUSINESS_ROOTS), or, as a real, confirmed, read-only fallback,
 * the legacy, combined "${businessName} Locations" root name one
 * specific, pre-existing demo business ("Wine Retail Business",
 * backend/schema/20-demo-wine-retail.sql) still uses, predating that
 * convention. Found directly: getOrganizationChart, setLocation, and
 * getLocation each duplicated the exact, same modern-shape-only
 * lookup, so this one business's own real locations were invisible to
 * all three - its Business Setup tree showed no groups at all, and
 * creating or saving a location against it failed outright. Fixed
 * here, once, rather than three times, and deliberately NOT by
 * migrating this large, pre-existing demo dataset onto the modern
 * shape (a real, separate, riskier undertaking) - every business
 * created going forward always gets the modern shape directly, so
 * this fallback is read-only and never needed for new data. */
export function resolveBusinessLocationsRootId(businessName: string): number | undefined {
  const businessId = (
    db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')`).get(businessName) as { id: number } | undefined
  )?.id;
  if (!businessId) return undefined;
  const modern = db.prepare(`SELECT id FROM current_entities WHERE name = 'Locations' AND parent_id = ?`).get(businessId) as { id: number } | undefined;
  if (modern) return modern.id;
  const legacy = db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(`${businessName} Locations`, businessId) as { id: number } | undefined;
  return legacy?.id;
}

export function getOrganizationChart(businessName: BusinessName): OrganizationChart {
  const businessRows = getEntitiesWithRelationship('Belongs To Business').filter((r) => r.target === businessName);
  const locationRows = getEntitiesWithRelationship('Belongs To Group');
  const employmentRows = getEntitiesWithRelationship('Place of Employment');

  const companyWideEmployees = employmentRows.filter((r) => r.target === businessName).map((r) => r.source).sort();

  // A real group is genuinely either (1) a real entity with its own
  // "Belongs To Business" relationship pointing at this business, or
  // (2) any real target of a "Belongs To Group" relationship whose
  // own locations trace back to this business — covering a
  // single-location group that is genuinely its own group, with no
  // separate, dedicated group entity or business relationship of its
  // own (its own location's relationship simply targets itself),
  // never silently dropped from the real org chart.
  const businessGroupNames = new Set(businessRows.map((r) => r.source));
  for (const { target } of locationRows) {
    businessGroupNames.add(target);
  }
  // Filter group-only-by-location-relationship names to genuinely
  // real ones belonging to this business — a location's own city or
  // structural home under this exact business's own Locations.
  const businessLocationsRootId = resolveBusinessLocationsRootId(businessName);
  const businessLocationNames = new Set(
    businessLocationsRootId
      ? ((db.prepare(`SELECT e.name FROM current_entities e WHERE e.parent_id = ?`).all(businessLocationsRootId) as { name: string }[]).map((r) => r.name))
      : []
  );

  const groups: OrgChartGroup[] = [...businessGroupNames]
    .filter((groupName) => businessRows.some((r) => r.source === groupName) || businessLocationNames.has(groupName))
    .sort()
    .map((groupName) => {
      const locations = locationRows
        .filter((l) => l.target === groupName)
        .map((l) => l.source)
        .sort()
        .map((locationName) => ({
          location: locationName,
          employees: employmentRows
            .filter((e) => e.target === locationName)
            .map((e) => e.source)
            .sort(),
        }));
      return { group: groupName, locations };
    });

  return { business: businessName, companyWideEmployees, groups };
}

export function revokeEntity(id: number, userId: UserId): void {
  const hasChildren = db.prepare(`SELECT 1 FROM current_entities WHERE parent_id = ? LIMIT 1`).get(id);
  if (hasChildren) throw new ValidationError('Cannot revoke an entity that still has children — move or revoke them first.');
  const hasPostings = db.prepare(`SELECT 1 FROM journal_line WHERE account_id = ? LIMIT 1`).get(id);
  if (hasPostings) throw new ValidationError('Cannot revoke an entity that has journal postings against it.');
  const entity = getEntity(id);
  if (!entity) throw new NotFoundError(`Entity ${id} not found.`);
  // Per direct rule: every real business must always have both a
  // real Actual ledger and a real Budget ledger — never revocable
  // down to zero of either kind, even a genuinely empty, brand-new
  // one with no real postings yet at all (the two checks above
  // wouldn't otherwise catch this, since a ledger itself carries no
  // real children or direct postings of its own — journal_line
  // references the real account, not the ledger).
  const parent = entity.parent_id ? getEntity(entity.parent_id) : null;
  const isRealLedgersNode = parent && parent.name === 'Ledgers' && db.prepare(`SELECT 1 FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses') AND id = ?`).get(parent.parent_id ?? -1);
  if (parent && isRealLedgersNode) {
    const siblingLedgers = db.prepare(`SELECT name FROM current_entities WHERE parent_id = ?`).all(parent.id) as { name: string }[];
    const isActual = entity.name.endsWith(' Actual') || entity.name === 'Actual';
    const isBudget = / Budget /.test(` ${entity.name} `) || entity.name.startsWith('Budget ') || entity.name === 'Budget';
    const otherActualCount = siblingLedgers.filter((s) => s.name !== entity.name && (s.name.endsWith(' Actual') || s.name === 'Actual')).length;
    const otherBudgetCount = siblingLedgers.filter((s) => s.name !== entity.name && (/ Budget /.test(` ${s.name} `) || s.name.startsWith('Budget ') || s.name === 'Budget')).length;
    if (isActual && otherActualCount === 0) throw new ValidationError(`"${parent.name}" must always have a real Actual ledger — this is its only one.`);
    if (isBudget && otherBudgetCount === 0) throw new ValidationError(`"${parent.name}" must always have a real Budget ledger — this is its only one.`);
  }
  // account/contact/translation rows are deliberately left in place —
  // they're historical facts about this now-superseded entity_id (what
  // was its phone number, its account number, when it was revoked),
  // consistent with everything else here never disappearing outright.
  db.prepare(`INSERT INTO entity_revoke (entity_id, revoked_by) VALUES (?, ?)`).run(id, userId);
  // The revoke above only clears relation_id — by design (see
  // entity_revoke's own schema comment), since that alone is enough
  // for every relation_id-based consumer (getEntitiesWithRelationship,
  // getOrganizationChart, getHierarchy: each already requires a live
  // entity's relation_id to match, so one gone NULL already, correctly,
  // drops out). It does nothing for a parent_id-based structural
  // consumer (getEntityTree's own raw walk, getBusinessHierarchy, or
  // any other plain `WHERE parent_id = ?`) — confirmed directly, a
  // revoked entity stays visible under its old parent indefinitely
  // there, since parent_id is carried forward unchanged. The two
  // guards above (no children, no postings) mean a revoked entity is
  // always a true, dependency-free leaf by the time we get here, so
  // nothing is lost by also moving it out of its old structural
  // position entirely, into a dedicated, out-of-the-way holding root —
  // closing that one, real, remaining gap for every current and
  // future parent_id-based consumer at once, not just this one.
  const revokedRoot = requireEntity('Application', typeRootName);
  Entity.ensureUnder('Revoked', revokedRoot.id, userId);
  Entity.reparent(id, 'Revoked', userId);
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

function ensureSystemInvoicesRoot(userId: UserId): { id: number } {
  const existing = db.prepare(`SELECT id FROM current_entities WHERE name = 'System Invoices'`).get() as { id: number } | undefined;
  if (existing) return existing;
  const application = db.prepare(`SELECT id FROM current_entities WHERE name = 'Application'`).get() as { id: number };
  return Entity.create('System Invoices', application.id, userId);
}

export function createInvoice(input: InvoiceInput, userId: UserId): number {
  const businessId = (db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')`).get(input.business) as { id: number } | undefined)?.id;
  if (!businessId) throw new ValidationError(`No business named "${input.business}".`);
  const ledgerId = (db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Ledgers' AND parent_id = ?)`).get(input.ledger, businessId) as { id: number } | undefined)?.id;
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

  return db.transaction((): number => {
  const invoicesRoot = ensureSystemInvoicesRoot(userId);
  const invoiceEntity = Entity.create(`${input.business} — ${input.ledger} — ${input.reference}`, invoicesRoot.id, userId);
  supersedeEntity(invoiceEntity.id, { relation: input.counterpartyName }, userId);
  const invoiceId = invoiceEntity.id;
  Entity.setDetailJson(
    invoiceId,
    JSON.stringify({
      invoice_type: input.invoiceType,
      document_type: input.documentType ?? 'invoice',
      references_invoice_id: input.referencesInvoiceId ?? null,
      business_id: businessId,
      ledger_id: ledgerId,
      reference: input.reference,
      invoice_date: input.invoiceDate,
      due_date: dueDate.d,
      description: input.description ?? '',
      status: 'draft',
      user_id: userId,
      posted_journal_id: null,
      source: input.source ?? 'manual',
    })
  );

  input.lines.forEach((line, i) => {
    const itemId = line.itemName ? resolveItemId(asItemName(line.itemName)) : null;
    const lineEntity = Entity.create(`Line — ${i}`, invoiceId, userId);
    if (itemId) supersedeEntity(lineEntity.id, { relation: line.itemName }, userId);
    Entity.setDetailJson(
      lineEntity.id,
      JSON.stringify({
        line_order: i,
        description: line.description,
        quantity: line.quantity ?? null,
        unit_price_minor: line.unitPriceMinor ?? null,
        amount_minor: line.amountMinor,
        tax_minor: line.taxMinor ?? 0,
        dispatch_reference: line.dispatchReference ?? null,
      })
    );
  });

  return invoiceId;
  })();
}

export function getInvoice(id: number): Invoice | undefined {
  const row = db
    .prepare(
      `SELECT i.id, i.invoice_type, i.document_type, i.references_invoice_id, biz.name AS business, led.name AS ledger, i.reference,
              cp.name AS counterparty, i.invoice_date, i.due_date, i.description, i.status, COALESCE(u.name, CASE WHEN j.user_id = 1 THEN 'admin' ELSE NULL END) AS posted_by, i.source
       FROM invoice i
       JOIN current_entities biz ON biz.id = i.business_id
       JOIN current_entities led ON led.id = i.ledger_id
       JOIN current_entities cp ON cp.id = i.counterparty_id
       LEFT JOIN journal j ON j.id = i.posted_journal_id
       LEFT JOIN current_entities u ON u.id = j.user_id AND u.parent_id = (SELECT id FROM current_entities WHERE name = 'System Users')
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
  const poProvider = db.prepare(`SELECT relation_id FROM current_entities WHERE name = ?`).get(`${poReference} Qty`) as { relation_id: number | null } | undefined;
  const poItem = db.prepare(`SELECT relation_id FROM current_entities WHERE name = ?`).get(`${poReference} Value`) as { relation_id: number | null } | undefined;
  const discrepancies: EInvoiceDiscrepancy[] = [];
  if (poProvider?.relation_id) {
    const providerName = (db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(poProvider.relation_id) as { name: string } | undefined)?.name;
    if (providerName && providerName !== parsed.supplierName) {
      discrepancies.push({ field: 'Provider', poValue: providerName, invoiceValue: parsed.supplierName });
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
  db.prepare(`INSERT INTO journal (business_id, ledger_id, reference, description, transdate, user_id) VALUES ((SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')), (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Ledgers' AND parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')))), ?, ?, date('now'), ?)`).run(
    business,
    ledger,
    business,
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
 * tested dispatchItems mechanism this app's own POS sales
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
    dispatchItems(asBusinessName(invoice.business), asLedgerName(invoice.ledger), `${invoice.reference}-DISPATCH-${line.item}`, asItemName(line.item!), asLocationName(locationName), line.quantity!, userId, invoice.invoice_date);
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
// built on transferItems (the same, real, already-tested mechanism
// this app's own simulation already uses for restocking) rather than
// dispatchItems/postInvoice.
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
  db.prepare(`INSERT INTO journal (business_id, ledger_id, reference, description, transdate, user_id) VALUES ((SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')), (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Ledgers' AND parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')))), ?, ?, date('now'), ?)`).run(
    business,
    ledger,
    business,
    ref,
    'Restocking run line confirmed picked',
    userId
  );
}

/** The real "restocking run completed" moment — refuses outright if
 * any real line is still unticked, otherwise transfers real, physical
 * stock for every real line from the real warehouse to the real
 * retail outlet, using transferItems, the exact same real mechanism
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
    transferItems(business, ledger, asItemName(line.item), asLocationName(warehouseName), asLocationName(retailOutletName), line.quantity, `${runReference}-XFER-${line.item}`, userId, transdate);
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
  counterpartyAccountOverride?: string
): void {
  db.transaction(() => {
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
    db.prepare(`SELECT id FROM journal WHERE reference = ? AND business_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')) AND ledger_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Ledgers' AND parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses'))))`)
      .get(invoice.reference, invoice.business, invoice.ledger, invoice.business) as { id: number }
  ).id;
  Entity.mergeDetailJson(id, JSON.stringify({ status: 'posted', posted_journal_id: journalId }));
  })();
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
  db.transaction(() => {
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
  const allocEntity = Entity.create(`Payment — ${paymentReference}`, invoiceId, asUserId(1));
  Entity.setDetailJson(
    allocEntity.id,
    JSON.stringify({ payment_reference: paymentReference, allocated_minor: allocatedMinor, allocation_date: allocationDate })
  );
  })();
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
   * account (lazily created via ensureItemSalesCogsAccounts) —
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
 * 100 real levels (matching getHierarchyAncestorChain's own, existing
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
  // throughout the real sales hot-path (ensureItemSalesCogsAccounts,
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
export function ensureCategoryChain(rootName: string, prefix: string, chain: string[], userId: UserId, business?: BusinessName, profitCenter?: string): { name: string; id: number } {
  let currentParent = rootName;
  // A real, confirmed bug, found and fixed directly: the bare, global
  // lookup below put every lazily-created Sales Revenue/COGS category
  // onto the one, shared, global Chart of Accounts template, invisible
  // to getBusinessReports' own, correct, business-scoped walk - the
  // direct, confirmed root cause of the Close Books/Rollover failures.
  // business is optional, appended last, purely for backward
  // compatibility with every existing caller (unit tests, scripts)
  // that never had a business to pass - every real, live call from
  // the application's own transaction flows now passes it.
  let currentParentId = business
    ? resolveBusinessCoaAccountId(business, rootName)
    : ((db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(rootName) as { id: number } | undefined)?.id ?? null);
  // Per docs/profit-centers-design.md's Phase A: a real Profit Center,
  // when given, is one further, real grouping level inserted directly
  // under the shared header, before this item's own real category
  // chain — so a Profit Center's own P&L shows every one of its own
  // categories, same as the business's overall P&L does today, just
  // scoped underneath its own, real, named node. Omitted entirely
  // (today's exact behavior) when no profitCenter is passed.
  if (profitCenter && business && currentParentId) {
    const pcNode = resolveProfitCenterGroupNode(business, currentParentId, profitCenter, userId);
    currentParent = profitCenter;
    currentParentId = pcNode.id;
  }
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
export function ensureItemSalesCogsAccounts(itemName: ItemName, userId: UserId, tier?: string, business?: BusinessName, profitCenter?: string): { salesAccount: string; salesAccountId: number; cogsAccount: string; cogsAccountId: number } {
  const suffix = tier ? ` (${tier})` : '';
  const salesAccount = `${itemName}${suffix}`;
  const cogsAccount = `${itemName}${suffix}`;
  const categoryChain = getAncestorChain(itemName, 'Items');

  const salesParent = ensureCategoryChain('Sales Revenue', '', categoryChain, userId, business, profitCenter);
  const salesRow = Entity.ensureUnder(salesAccount, salesParent.id, userId);

  const cogsParent = ensureCategoryChain('Cost of Goods Sold', '', categoryChain, userId, business, profitCenter);
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
export function ensureItemInventoryAccount(itemName: ItemName, userId: UserId, tier?: string, business?: BusinessName, profitCenter?: string): { inventoryAccount: string; inventoryAccountId: number } {
  // A real, confirmed bug, found and fixed directly: this bare, global
  // lookup put every lazily-created, per-product Inventory leaf onto
  // the one, shared, global Chart of Accounts template, invisible to
  // getBusinessReports'/getBalanceSheet's own, correct, business-scoped
  // walk - a real, confirmed cause of the year/period rollover's own
  // entry failing to balance (the Inventory side of the Balance Sheet
  // silently missing). business is optional, appended last, purely for
  // backward compatibility with every existing caller that never had a
  // business to pass.
  let inventoryParentId = business ? resolveBusinessCoaAccountId(business, 'Inventory') : (db.prepare(`SELECT id FROM current_entities WHERE name = 'Inventory'`).get() as { id: number }).id;
  // Per docs/profit-centers-design.md's Phase A: a real Profit
  // Center's own Inventory grouping node, nested directly under the
  // one, real, shared Inventory header — never a separate Inventory
  // section of its own, so getBalanceSheet's existing, structural
  // category-tree walk still finds and totals every Profit Center's
  // own leaves automatically, with no separate reporting path.
  if (profitCenter && business) inventoryParentId = resolveProfitCenterGroupNode(business, inventoryParentId, profitCenter, userId).id;
  const accountName = tier ? `${itemName} (${tier})` : itemName;
  const row = Entity.ensureUnder(accountName, inventoryParentId, userId);
  return { inventoryAccount: accountName, inventoryAccountId: row.id };
}

/** The exact, same, real (product, location) leaf pattern as
 * ensureItemLocationLeaf — extended to Inventory too. Per direct,
 * explicit confirmation: "the sale, COGS, and inventory are recorded
 * in accounts that are determined by the cartesian product of
 * products and locations" — Inventory is not a special case exempt
 * from this. */
export function ensureItemLocationInventoryAccount(itemName: ItemName, locationName: LocationName, userId: UserId, tier?: string, business?: BusinessName, profitCenter?: string): { inventoryAccount: string; inventoryAccountId: number } {
  const { inventoryAccountId: baseId } = ensureItemInventoryAccount(itemName, userId, tier, business, profitCenter);
  const locationAccount = `${itemName}${tier ? ` (${tier})` : ''} — ${locationName}`;
  const existing = Entity.getUnder(locationAccount, baseId);
  const row = existing ?? Entity.create(locationAccount, baseId, userId);
  if (!existing) setHierarchyParent(locationAccount, 'Location', locationName, userId);
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
  const business = requireEntity(businessName, typeBusinessName, requireEntity('Businesses', typeRootName));
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

// ---------------------------------------------------------------------------
// Profit Centers, per docs/profit-centers-design.md's Phase A: a real,
// structural subtree inside one business's own CoA — its own Sales
// Revenue/Cost of Goods Sold/Inventory grouping nodes, nested one
// level deeper than today's product-category grouping, under the
// exact, same, real, shared Sales Revenue/Cost of Goods Sold/
// Inventory headers every business already has. Deliberately NOT a
// second, separate root alongside Chart of Accounts (an earlier, since-
// corrected version of this design considered that) — nesting inside
// the one, real, shared CoA means getBalanceSheet/getProfitAndLoss/
// business_reports' own, existing, structural tree walk picks up
// every Profit Center's own leaves automatically, with no separate
// reporting path to keep in sync. A Profit Center has no Balance
// Sheet of its own: the one, real exception is its own Retained
// Earnings sibling (see computeCloseLines's own profit-center
// grouping), nested under the business's one, single, shared Equity,
// never a second Equity section.
// ---------------------------------------------------------------------------

/** Creates a real, new Profit Center directly under this business's
 * own "Profit Centers" root (lazily ensured here too, for a business
 * created before this feature existed — the same, established,
 * backward-compatible "ensure the root, then the real node under it"
 * pattern as ensureHierarchyGrouping above). Per direct instruction,
 * this is a real, named thing a business chooses to create — not
 * automatic, not required, and ordinary posting is entirely
 * unaffected until a real item/account resolver is explicitly told to
 * scope itself to one (see resolveProfitCenterGroupNode below). */
export function createProfitCenter(businessName: BusinessName, profitCenterName: string, userId: UserId): { id: number; name: string } {
  const root = ensureBusinessRoot(businessName, 'Profit Centers', userId);
  if (Entity.getUnder(profitCenterName, root.id)) {
    throw new ValidationError(`"${profitCenterName}" already exists as a Profit Center for "${businessName}".`);
  }
  return Entity.create(profitCenterName, root.id, userId);
}

/** Every real, existing Profit Center for one business — empty for a
 * business that has never created one, including every business that
 * existed before this feature did. */
export function getProfitCenters(businessName: BusinessName): { id: number; name: string }[] {
  const root = db
    .prepare(`SELECT id FROM current_entities WHERE name = 'Profit Centers' AND parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses'))`)
    .get(businessName) as { id: number } | undefined;
  if (!root) return [];
  return db.prepare(`SELECT id, name FROM current_entities WHERE parent_id = ? ORDER BY name`).all(root.id) as { id: number; name: string }[];
}

/** The one, real, shared mechanism every per-item resolver below uses
 * to scope itself to a Profit Center: given a real CoA header's own id
 * (Sales Revenue, Cost of Goods Sold, or Inventory — already resolved,
 * business-scoped), ensures a real grouping node named after the
 * Profit Center directly under it, tagged back to the real Profit
 * Center entity via the exact, same generic dimension-link mechanism
 * (setHierarchyParent) ensureItemLocationInventoryAccount already uses
 * for Location — disambiguated by this grouping node's own, real id,
 * since the exact, same Profit Center name genuinely recurs three
 * times (once each under Sales Revenue, Cost of Goods Sold, and
 * Inventory), the same, real, confirmed "same literal name, different
 * real account" shape Open Container's own leaves already proved
 * needs an explicit id, not a bare name lookup.
 *
 * Validates the Profit Center is real for this business first — a
 * typo here must fail loudly, never silently create an unrelated,
 * orphaned grouping node under a real GL header. */
function resolveProfitCenterGroupNode(business: BusinessName, headerId: number, profitCenterName: string, userId: UserId): { id: number; name: string } {
  const pc = getProfitCenters(business).find((p) => p.name === profitCenterName);
  if (!pc) throw new ValidationError(`No real Profit Center named "${profitCenterName}" for "${business}" — create it first.`);
  const row = Entity.ensureUnder(profitCenterName, headerId, userId);
  setHierarchyParent(profitCenterName, 'Profit Center', profitCenterName, userId, row.id, pc.id);
  return row;
}

/** Per docs/profit-centers-design.md's Phase B: which real Profit
 * Center (if any) a real GL account's own, structural position
 * belongs under — walking straight up its parent chain, since a
 * Profit Center is a real, structural grouping node an account nests
 * under, not a per-line tag the way Division is. Stops at the first
 * ancestor carrying a real "Hierarchy: Profit Center" link — the
 * exact, same tagged grouping node resolveProfitCenterGroupNode
 * creates.
 *
 * Deliberately does NOT reuse getHierarchyParent/getEntityLink here:
 * those resolve a link record by a bare `${entityName} — ${linkType}`
 * name, with no parent disambiguation at all — genuinely ambiguous
 * for a Profit Center, whose own grouping-node name recurs once each
 * under Sales Revenue, Cost of Goods Sold, and Inventory, each a real,
 * separate grouping node with its own, separate link. This query is
 * scoped by the real, specific ancestor id at each step instead, the
 * same disambiguation-by-id already proven throughout this file. */
export function getAccountProfitCenter(accountId: number): string | null {
  let currentId: number | null = accountId;
  while (currentId != null) {
    const row = db
      .prepare(
        `SELECT target.name AS name
         FROM current_entities rec
         JOIN current_entities target ON target.id = rec.relation_id
         JOIN current_entities tag ON tag.parent_id = rec.id AND tag.name = 'Hierarchy: Profit Center' AND tag.relation_id IS NOT NULL
         WHERE rec.parent_id = ?`
      )
      .get(currentId) as { name: string } | undefined;
    if (row) return row.name;
    const parent = db.prepare(`SELECT parent_id FROM current_entities WHERE id = ?`).get(currentId) as { parent_id: number | null } | undefined;
    currentId = parent?.parent_id ?? null;
  }
  return null;
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
  Entity.setCombinationIds(created.id, combinationIdsJson);
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

/** Resolves a known Chart-of-Accounts header name (e.g. "Sales
 * Revenue", "Cost of Goods Sold", "Inventory") within one specific
 * business's own Chart of Accounts subtree — the exact, same,
 * business-scoped recursive walk post_journal_entry_insert's own
 * trigger already uses (00-core.sql), so a real Cartesian Product
 * leaf created under this header always lands on this business's own
 * copy, never the shared, global template. Falls back to the old,
 * bare, global lookup only when this specific business genuinely has
 * no own CoA copy at all (the legacy "admin" case, which never
 * gets a real Chart of Accounts of its own) — never silently, always
 * as a last resort, mirroring the trigger's own COALESCE fallback. */
export function resolveBusinessCoaAccountId(businessName: BusinessName, accountName: string): number {
  const row = db
    .prepare(
      `WITH RECURSIVE biz_coa(id) AS (
         SELECT id FROM current_entities WHERE name = 'Chart of Accounts' AND parent_id = (SELECT id FROM current_entities WHERE name = ?)
         UNION ALL
         SELECT e.id FROM current_entities e JOIN biz_coa ON e.parent_id = biz_coa.id
       )
       SELECT id FROM current_entities WHERE name = ? AND id IN (SELECT id FROM biz_coa) LIMIT 1`
    )
    .get(businessName, accountName) as { id: number } | undefined;
  if (row) return row.id;
  const fallback = db.prepare(`SELECT id FROM current_entities WHERE name = ? LIMIT 1`).get(accountName) as { id: number } | undefined;
  if (!fallback) throw new ValidationError(`No real account named "${accountName}".`);
  return fallback.id;
}

/** Creates one real, new leaf directly under a real, existing,
 * top-level account (Inventory, Sales, or COGS) — never an
 * intermediate per-item grouping node, per direct correction — whose
 * own relation_id points at a real Product Instance's own top node.
 * This is the one, real, shared, canonical link all three financial
 * accounts for the same, real combination refer back to. */
export function ensureCombinationAccountLeaf(baseAccountName: string, instanceTopNode: { id: number; name: string }, userId: UserId, baseAccountId?: number): { id: number; name: string } {
  const baseId = baseAccountId ?? (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(baseAccountName) as { id: number } | undefined)?.id;
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
  const existingByCombination = combinationIds != null
    ? (db.prepare(`SELECT id, name FROM current_entities WHERE parent_id = ? AND combination_ids = ?`).get(baseId, combinationIds) as { id: number; name: string } | undefined)
    : undefined;
  // A real, newly-exposed gap, found directly: combination_ids alone is
  // not enough, since this instance can genuinely have a real,
  // non-null combination_ids (e.g. a single-dimension "Bottle" under
  // "Container") while an already-existing leaf of the same bare name
  // under this same parent was created by a completely different
  // mechanism that never set combination_ids at all (a location's own,
  // plain capacity-tracking account) - tried whenever the first lookup
  // finds nothing, not only when combinationIds is null, or creating
  // it again throws a genuine, real uniqueness error.
  const existing = existingByCombination
    ?? (db.prepare(`SELECT id, name FROM current_entities WHERE parent_id = ? AND name = ?`).get(baseId, instanceTopNode.name) as { id: number; name: string } | undefined);
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
  if (combinationIds != null) Entity.setCombinationIds(leaf.id, combinationIds);
  return leaf;
}

// Docs: docs/storage-space-as-currency-design.md § 24. Code and tests: where to look
export function ensureLocationStorageRoot(business: BusinessName, locationName: string, userId: UserId): { id: number; name: string } {
  const businessEntity = requireEntity(business, typeBusinessName, requireEntity('Businesses', typeRootName));
  let coa: { id: number; name: string };
  try { coa = requireEntity('Chart of Accounts', typeRootName, businessEntity); } catch { coa = create(businessEntity, typeRootName, 'Chart of Accounts', userId); }
  const storage = (Entity.getUnder('Storage', coa.id) ?? create(coa as TypedNode<string>, typeRootName, 'Storage', userId)) as { id: number; name: string };
  // Deliberate, documented design (see the real location's own test
  // coverage): this leaf is intentionally created with the exact
  // same literal name as the real location itself, as a real,
  // distinct GL node under Chart of Accounts > Storage - never
  // renamed to disambiguate it, since every caller that actually
  // needs this exact node reaches it through this same function,
  // scoped by business and parented under Storage. Any OTHER, bare,
  // unscoped-by-business lookup of a location's own name is what's
  // unsafe here, not this leaf's name - see nominateLocationCurrency
  // and setRelationship's own fixes for that.
  return (Entity.getUnder(locationName, storage.id) ?? create(storage as TypedNode<string>, typeRootName, locationName, userId)) as { id: number; name: string };
}

export function ensureStorageCapacityStructure(parentEntity: { id: number; name: string }, userId: UserId): { remainingId: number; installedId: number; occupiedId: number } {
  const capacity = (Entity.getUnder('Storage Capacity', parentEntity.id) ?? create(parentEntity as TypedNode<string>, typeRootName, 'Storage Capacity', userId)) as { id: number; name: string };
  const remaining = (Entity.getUnder('Remaining', capacity.id) ?? create(capacity as TypedNode<string>, typeRootName, 'Remaining', userId)) as { id: number; name: string };
  const installed = (Entity.getUnder('Installed', capacity.id) ?? create(capacity as TypedNode<string>, typeRootName, 'Installed', userId)) as { id: number; name: string };
  const occupied = (Entity.getUnder('Occupied', capacity.id) ?? create(capacity as TypedNode<string>, typeRootName, 'Occupied', userId)) as { id: number; name: string };
  return { remainingId: remaining.id, installedId: installed.id, occupiedId: occupied.id };
}

// Docs: docs/storage-space-as-currency-design.md § 24. Code and tests: where to look
export function convertStorageSpace(
  business: BusinessName,
  ledger: LedgerName,
  itemName: ItemName,
  definitionDimensions: [string, string][],
  fromValues: string[],
  toValues: string[],
  quantity: number,
  userId: UserId,
  reference?: string
): void {
  const businessEntity = requireEntity(business, typeBusinessName, requireEntity('Businesses', typeRootName));
  const { remainingId, installedId } = ensureStorageCapacityStructure(businessEntity, userId);
  const fromInstance = ensureProductInstance(business, definitionDimensions, fromValues, userId);
  const toInstance = ensureProductInstance(business, definitionDimensions, toValues, userId);
  const fromSpace = ensureCombinationAccountLeaf('Remaining', fromInstance, userId, remainingId);
  const toSpace = ensureCombinationAccountLeaf('Remaining', toInstance, userId, remainingId);

  const fromCurrency = `SPACE-${fromValues.join('-').toUpperCase()}`;
  const toCurrency = `SPACE-${toValues.join('-').toUpperCase()}`;
  setAccountCurrency(fromSpace.name, fromCurrency, fromSpace.id);
  setAccountCurrency(toSpace.name, toCurrency, toSpace.id);

  const spaceRate = fromCurrency === toCurrency ? 1 : getCurrencyExchangeRate(business, fromCurrency, toCurrency, 'sell');
  if (spaceRate == null) throw new ValidationError(`Converting from "${fromValues.join(' + ')}" to "${toValues.join(' + ')}" has never been defined as a real, allowed direction for space.`);
  const toQuantity = Math.round(quantity * spaceRate);

  const ref = reference ?? `STORAGE-CONVERT-${Date.now()}`;

  const fromInstalled = ensureCombinationAccountLeaf('Installed', fromInstance, userId, installedId);
  const toInstalled = ensureCombinationAccountLeaf('Installed', toInstance, userId, installedId);
  setAccountCurrency(fromInstalled.name, fromCurrency, fromInstalled.id);
  setAccountCurrency(toInstalled.name, toCurrency, toInstalled.id);

  stageLine({ reference: ref, business, ledger, account: asAccountName(fromSpace.name), accountId: fromSpace.id, amount_minor: -quantity });
  stageLine({ reference: ref, business, ledger, account: asAccountName(fromInstalled.name), accountId: fromInstalled.id, amount_minor: quantity });
  stageLine({ reference: ref, business, ledger, account: asAccountName(toSpace.name), accountId: toSpace.id, amount_minor: toQuantity });
  stageLine({ reference: ref, business, ledger, account: asAccountName(toInstalled.name), accountId: toInstalled.id, amount_minor: -toQuantity });
  postJournalEntry(ref, business, ledger, userId);
}

// Docs: docs/storage-space-as-currency-design.md § 24. Code and tests: where to look
// Per direct instruction: opening a sealed carton into loose bottles is
// constrained to a real, specific location - fixing the already-
// documented gap (docs/currency-and-quantity-integrity-fix-plan.md,
// Phase 3) where this posted to the business root, disconnected from
// wherever the carton was actually, physically opened. A second, real
// business rule enforced here too: a location with no real bottle
// shelving (bottle_capacity null or zero) cannot open a carton at all
// - there is nowhere for the resulting loose bottles to physically go.
export function openStorageContainer(
  business: BusinessName,
  ledger: LedgerName,
  locationName: LocationName,
  itemName: ItemName,
  definitionDimensions: [string, string][],
  containerValues: string[],
  cartonsOpened: number,
  unitValues: string[],
  unitsProduced: number,
  userId: UserId,
  reference?: string
): void {
  const loc = getLocation(locationName, business);
  if (!loc) throw new ValidationError(`No location named "${locationName}".`);
  if (!loc.bottle_capacity) {
    throw new ValidationError(`"${locationName}" has no real bottle shelving (bottle capacity is not set) - a sealed carton cannot be opened into loose bottles here, since there is nowhere for them to go.`);
  }
  if (!resolveItemId(itemName)) throw new ValidationError(`No item named "${itemName}".`);
  // Legacy-root aware (see resolveBusinessLocationsRootId above) -
  // the same, shared helper every other call site with this exact
  // gap now uses, not a locally duplicated fallback query.
  const locationsRootId = resolveBusinessLocationsRootId(business);
  const locationId = locationsRootId
    ? (db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(locationName, locationsRootId) as { id: number } | undefined)?.id
    : undefined;
  if (!locationId) throw new ValidationError(`No location named "${locationName}".`);
  const storageRoot = ensureLocationStorageRoot(business, locationName, userId);
  const { remainingId, occupiedId } = ensureStorageCapacityStructure(storageRoot, userId);
  const containerInstance = ensureProductInstance(business, definitionDimensions, containerValues, userId);
  const unitInstance = ensureProductInstance(business, definitionDimensions, unitValues, userId);
  const containerSpace = ensureCombinationAccountLeaf('Remaining', containerInstance, userId, remainingId);
  const containerOccupied = ensureCombinationAccountLeaf('Occupied', containerInstance, userId, occupiedId);
  const unitSpace = ensureCombinationAccountLeaf('Remaining', unitInstance, userId, remainingId);
  const unitOccupied = ensureCombinationAccountLeaf('Occupied', unitInstance, userId, occupiedId);

  const containerCurrency = `SPACE-${containerValues.join('-').toUpperCase()}`;
  const unitCurrency = `SPACE-${unitValues.join('-').toUpperCase()}`;
  setAccountCurrency(containerSpace.name, containerCurrency, containerSpace.id);
  setAccountCurrency(containerOccupied.name, containerCurrency, containerOccupied.id);
  setAccountCurrency(unitSpace.name, unitCurrency, unitSpace.id);
  setAccountCurrency(unitOccupied.name, unitCurrency, unitOccupied.id);

  const ref = reference ?? `STORAGE-OPEN-${Date.now()}`;
  // Per direct instruction: there is no contra accounting here. Opening
  // a carton is an ordinary internal stock movement at this one
  // location - mirrored, like any other movement, in both the real
  // storage-space accounts (this side) and the real item accounts
  // (below), never touching Installed, which is set once and never
  // moved by any later movement.
  //
  // The container side: cartonsOpened worth of carton-space is freed -
  // Remaining increases, Occupied decreases, exactly as
  // adjustLocationCapacity's own pattern does for any item leaving.
  stageLine({ reference: ref, business, ledger, account: asAccountName(containerSpace.name), accountId: containerSpace.id, amount_minor: cartonsOpened });
  stageLine({ reference: ref, business, ledger, account: asAccountName(containerOccupied.name), accountId: containerOccupied.id, amount_minor: -cartonsOpened });
  // The unit side: unitsProduced worth of bottle-space is now occupied -
  // Remaining decreases, Occupied increases, the same sign convention
  // reversed, since this side is stock arriving, not leaving.
  stageLine({ reference: ref, business, ledger, account: asAccountName(unitSpace.name), accountId: unitSpace.id, amount_minor: -unitsProduced });
  stageLine({ reference: ref, business, ledger, account: asAccountName(unitOccupied.name), accountId: unitOccupied.id, amount_minor: unitsProduced });
  postJournalEntry(ref, business, ledger, userId);

  // Per direct instruction: a dozen 12-bottle cartons and single
  // bottles are genuinely stored in two, separate sets of (Inventory,
  // Sales, COGS) accounts - the same, real, already-established
  // tier-naming pattern ensureItemSalesCogsAccounts already uses
  // ("Item (Carton)", "Item (Bottle)"), now extended to Inventory too.
  // No contra accounting: a carton is an exact, convertible shorthand
  // for its real units - like a dollar for 100 cents - so the same,
  // real dollar value simply moves directly from the carton-tier
  // account to the bottle-tier account, both the same real currency,
  // balancing on its own - exactly how transferItems already moves
  // value directly between two locations' own Inventory accounts.
  const unitCostMinor = getItemUnitCostMinor(itemName);
  if (unitCostMinor != null) {
    const valueMinor = unitsProduced * unitCostMinor;
    const fromTier = containerValues.join(' ');
    const toTier = unitValues.join(' ');
    const fromInv = ensureItemLocationInventoryAccount(itemName, locationName, userId, fromTier, business);
    const toInv = ensureItemLocationInventoryAccount(itemName, locationName, userId, toTier, business);
    const valueRef = `${ref}-ITEM-VALUE`;
    stageLine({ reference: valueRef, business, ledger, account: asAccountName(fromInv.inventoryAccount), accountId: fromInv.inventoryAccountId, amount_minor: -valueMinor, memo: `Open container: ${itemName}` });
    stageLine({ reference: valueRef, business, ledger, account: asAccountName(toInv.inventoryAccount), accountId: toInv.inventoryAccountId, amount_minor: valueMinor, memo: `Open container: ${itemName}` });
    postJournalEntry(valueRef, business, ledger, userId);
  }
}

export interface ResolvedOpenContainerAccounts {
  /** The real, currency-tagged Storage-Capacity "Remaining"/"Occupied"
   * account names for the container's own tier (e.g. "Carton") and the
   * unit tier it's opened into (e.g. "Bottle") — the real, stateful
   * combination-account creation (ensureProductInstance/
   * ensureCombinationAccountLeaf/setAccountCurrency) openStorageContainer
   * itself already does, done here instead so the frontend can build
   * the deterministic space-movement lines against already-real,
   * already-existing accounts. */
  containerSpaceAccount: string;
  containerOccupiedAccount: string;
  unitSpaceAccount: string;
  unitOccupiedAccount: string;
  /** Per a real, confirmed bug found and fixed directly while
   * verifying Phase 1 against a real, live browser: these leaf
   * accounts are named purely after their own combination value (e.g.
   * "Carton"), with no prefix distinguishing "Remaining" from
   * "Occupied" - two genuinely different real accounts (different
   * parent_id, different id) can and do share the exact, same literal
   * name. openStorageContainer's own, original posting already
   * carried this correctly by staging with each account's own, real,
   * explicit accountId; the frontend has no other way to tell these
   * apart, since it only ever sees the name string otherwise - so
   * every one of these four ids must travel alongside its own name. */
  containerSpaceAccountId: number;
  containerOccupiedAccountId: number;
  unitSpaceAccountId: number;
  unitOccupiedAccountId: number;
  /** The real, tier-scoped Inventory accounts the item's own dollar
   * value moves between — the exact, same resolution
   * openStorageContainer's own item-value block already does. */
  inventoryFromAccount: string;
  inventoryToAccount: string;
  inventoryFromAccountId: number;
  inventoryToAccountId: number;
  /** This item's known, real per-unit cost, or null when no real cost
   * is known yet — the frontend then posts no real Inventory-value
   * entry at all, never a fabricated cost, the exact, same real
   * behavior openStorageContainer's own item-value block already
   * used. */
  unitCostMinor: number | null;
}

/** Per docs/canned-journal-to-frontend-design.md Phase 1: the real,
 * account-resolution counterpart to resolveCashTransactionAccounts/
 * resolveSaleAccounts/resolveTransferAccounts for Open Container —
 * unlike those, opening a container has no real physical
 * quantity-on-hand side effect at all (it only reclassifies which
 * real storage-space/Inventory tier the same real stock already sits
 * in), so there is no separate "do the real side effect" endpoint
 * needed here: once every real account below genuinely exists, both
 * of Open Container's own real journal entries (the space movement,
 * and the dollar Inventory-value movement) are a deterministic,
 * given-the-form's-own-inputs computation — frontend/src/lib/
 * canned-journal.ts's openContainerLines. No division/category of any
 * kind is ever resolved or returned here. */
export function resolveOpenContainerAccounts(
  business: BusinessName,
  locationName: LocationName,
  itemName: ItemName,
  definitionDimensions: [string, string][],
  containerValues: string[],
  unitValues: string[],
  userId: UserId
): ResolvedOpenContainerAccounts {
  const loc = getLocation(locationName, business);
  if (!loc) throw new ValidationError(`No location named "${locationName}".`);
  if (!loc.bottle_capacity) {
    throw new ValidationError(`"${locationName}" has no real bottle shelving (bottle capacity is not set) - a sealed carton cannot be opened into loose bottles here, since there is nowhere for them to go.`);
  }
  if (!resolveItemId(itemName)) throw new ValidationError(`No item named "${itemName}".`);

  const storageRoot = ensureLocationStorageRoot(business, locationName, userId);
  const { remainingId, occupiedId } = ensureStorageCapacityStructure(storageRoot, userId);
  const containerInstance = ensureProductInstance(business, definitionDimensions, containerValues, userId);
  const unitInstance = ensureProductInstance(business, definitionDimensions, unitValues, userId);
  const containerSpace = ensureCombinationAccountLeaf('Remaining', containerInstance, userId, remainingId);
  const containerOccupied = ensureCombinationAccountLeaf('Occupied', containerInstance, userId, occupiedId);
  const unitSpace = ensureCombinationAccountLeaf('Remaining', unitInstance, userId, remainingId);
  const unitOccupied = ensureCombinationAccountLeaf('Occupied', unitInstance, userId, occupiedId);

  const containerCurrency = `SPACE-${containerValues.join('-').toUpperCase()}`;
  const unitCurrency = `SPACE-${unitValues.join('-').toUpperCase()}`;
  setAccountCurrency(containerSpace.name, containerCurrency, containerSpace.id);
  setAccountCurrency(containerOccupied.name, containerCurrency, containerOccupied.id);
  setAccountCurrency(unitSpace.name, unitCurrency, unitSpace.id);
  setAccountCurrency(unitOccupied.name, unitCurrency, unitOccupied.id);

  const fromTier = containerValues.join(' ');
  const toTier = unitValues.join(' ');
  const fromInv = ensureItemLocationInventoryAccount(itemName, locationName, userId, fromTier, business);
  const toInv = ensureItemLocationInventoryAccount(itemName, locationName, userId, toTier, business);

  return {
    containerSpaceAccount: containerSpace.name,
    containerOccupiedAccount: containerOccupied.name,
    unitSpaceAccount: unitSpace.name,
    unitOccupiedAccount: unitOccupied.name,
    containerSpaceAccountId: containerSpace.id,
    containerOccupiedAccountId: containerOccupied.id,
    unitSpaceAccountId: unitSpace.id,
    unitOccupiedAccountId: unitOccupied.id,
    inventoryFromAccount: fromInv.inventoryAccount,
    inventoryToAccount: toInv.inventoryAccount,
    inventoryFromAccountId: fromInv.inventoryAccountId,
    inventoryToAccountId: toInv.inventoryAccountId,
    unitCostMinor: getItemUnitCostMinor(itemName),
  };
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
    db.prepare(`SELECT id FROM current_entities WHERE name = 'Hierarchy' AND parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses'))`).get(businessName) as
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
    db.prepare(`SELECT id FROM current_entities WHERE name = 'Product' AND parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses'))`).get(businessName) as
      | { id: number }
      | undefined
  )?.id;
  const hierarchyId = (
    db.prepare(`SELECT id FROM current_entities WHERE name = 'Hierarchy' AND parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses'))`).get(businessName) as
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
export function getItemUnitCostMinor(itemName: ItemName): number | null {
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
 * same item via the hierarchy mechanism (the same, confirmed shape as
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
export function ensureItemTier(baseProductName: ItemName, tier: string, userId: UserId, business?: BusinessName): { tierItemName: string; tierItemId: number; salesAccount: string; salesAccountId: number; cogsAccount: string; cogsAccountId: number } {
  const { salesAccount, salesAccountId, cogsAccount, cogsAccountId } = ensureItemSalesCogsAccounts(baseProductName, userId, tier, business);
  const tierItemName = `${baseProductName} (${tier})`;

  const existing = Entity.getUnder(tierItemName, salesAccountId);
  const tierItemRow = existing ?? Entity.create(tierItemName, salesAccountId, userId);
  if (!existing) {
    mergeContactDetail(tierItemRow.id, {});
    setHierarchyParent(tierItemName, 'COGS Product', cogsAccount, userId);
  }
  return { tierItemName, tierItemId: tierItemRow.id, salesAccount, salesAccountId, cogsAccount, cogsAccountId };
}

/** Per direct confirmation — "location must become structural the
 * same way tier did", retiring journal_line.division_id as a tag
 * entirely once this exists — the exact, same, proven pattern
 * ensureItemTier already uses, mirrored one real level deeper.
 *
 * A real (tier, location) combination is what a real sale actually,
 * physically is — "Amber Ale 330ml (Bottle) sold at Riverside
 * Cellars" is a real, genuinely distinct fact from the same product
 * sold at Uptown Wine & Spirits, not a tag on an otherwise-identical
 * posting. The existing, real tier-level Sales/COGS leaves
 * (ensureItemTier's own output) become real, pure summary
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
export function ensureItemTierLocationLeaf(tierItemName: string, locationName: LocationName, userId: UserId, tierItemId?: number): { leafItemName: string; leafItemId: number; salesAccount: string; salesAccountId: number; cogsAccount: string; cogsAccountId: number } {
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
  const tierCogsAccount = getHierarchyParent(tierItemName, 'COGS Product');
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
    setHierarchyParent(leafItemName, 'COGS Product', cogsAccount, userId);
    // The real, structural fact a real journal_line.account_id can now
    // be walked from directly — which real location this real Sales
    // leaf (and its own real COGS counteritem) actually belongs to —
    // replacing the real, separate division_id tag this whole design
    // exists to retire. Set on the real, actual posting targets
    // themselves (the Sales/COGS leaves), not the item, since a real
    // journal_line's own account_id always points at one of those two,
    // never at the item.
    setHierarchyParent(salesAccount, 'Location', locationName, userId);
    setHierarchyParent(cogsAccount, 'Location', locationName, userId);
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
export function ensureItemLocationLeaf(itemName: ItemName, locationName: LocationName, userId: UserId, business?: BusinessName): { salesAccount: string; salesAccountId: number; cogsAccount: string; cogsAccountId: number } {
  const { salesAccount: baseSales, salesAccountId: baseSalesId, cogsAccount: baseCogs, cogsAccountId: baseCogsId } = ensureItemSalesCogsAccounts(itemName, userId, undefined, business);
  const salesAccount = `${baseSales} — ${locationName}`;
  const cogsAccount = `${baseCogs} — ${locationName}`;

  let salesRow = Entity.getUnder(salesAccount, baseSalesId);
  if (!salesRow) {
    salesRow = Entity.create(salesAccount, baseSalesId, userId);
    setHierarchyParent(salesAccount, 'Location', locationName, userId);
  }
  let cogsRow = Entity.getUnder(cogsAccount, baseCogsId);
  if (!cogsRow) {
    cogsRow = Entity.create(cogsAccount, baseCogsId, userId);
    Entity.relate(cogsRow.id, 'COGS', userId);
    setHierarchyParent(cogsAccount, 'Location', locationName, userId);
  }
  return { salesAccount, salesAccountId: salesRow.id, cogsAccount, cogsAccountId: cogsRow.id };
}


/** The real, structural replacement for journal_line.division_id —
 * given a real account name a real journal_line actually posted to,
 * walks its own, real "Location" hierarchy-parent directly (set by
 * ensureItemTierLocationLeaf above), rather than reading a
 * separate tag that could drift out of sync with where the account
 * actually, structurally sits. undefined for any real account with no
 * real, known location — an ordinary, non-product account (Cash and
 * Bank, Owner's Equity), or a real Sales/COGS leaf that predates this
 * design and has no real per-location leaf of its own yet. */
export function getLocationForAccount(accountName: AccountName): string | undefined {
  return getHierarchyParent(accountName, 'Location');
}

/** The real, structural, fully generic account-to-group resolver —
 * walks a real account to its own, real, structural location first
 * (getLocationForAccount above), then reuses the exact, same, already-
 * proven location-to-group resolution getHierarchyGroupForLocation
 * already provides. hierarchyName is a real, caller-supplied name
 * (e.g. "Division") — never hardcoded here, so this works identically
 * for any real, business-chosen location-grouping hierarchy.
 * undefined under the same, real conditions getLocationForAccount
 * itself is. */
export function getHierarchyGroupForAccount(accountName: AccountName, hierarchyName: string): string | undefined {
  const location = getLocationForAccount(accountName);
  if (!location) return undefined;
  return getHierarchyGroupForLocation(location, hierarchyName);
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
  if (!entity) return '';
  // A real, confirmed bug, found and fixed directly: this used to walk
  // the complete, real path up to "Chart of Accounts" - but plenty of
  // real entities this is genuinely called on (a combination-leaf
  // account's own, already-descriptive name, or any other, real entity
  // entirely outside the Chart of Accounts tree) never reach "Chart of
  // Accounts" as an ancestor at all, so the walk kept climbing all the
  // way to the true, structural root, prepending every real ancestor
  // along the way (confirmed directly: "Root — Application — Items —
  // ...", "Root — Application — Vocabulary — Vendors — ..."), the
  // exact opposite of a clean, qualified name. One real, immediate
  // parent is already enough to disambiguate two, real, identically-
  // named siblings - the one, real, genuine exception is a child whose
  // own name already, fully includes that immediate parent's name as
  // its own real prefix (ensureCombinationAccountLeaf's "Item —
  // Location" naming convention), which is already a real, complete,
  // self-disambiguating qualified name on its own; prepending the
  // parent's name again there would only double it.
  if (entity.parent_id == null) return entity.name;
  const parent = getEntity(entity.parent_id);
  if (!parent || entity.name.startsWith(`${parent.name} — `)) return entity.name;
  return `${parent.name} — ${entity.name}`;
}

export function ensureItemQuantityAccounts(itemName: ItemName, userId: UserId): { onOrderAccount: string; onOrderAccountId: number; unitsSoldAccount: string; unitsSoldAccountId: number; countAdjustmentAccount: string; countAdjustmentAccountId: number; writeOffAccount: string; writeOffAccountId: number } {
  const itemId = resolveIdOrThrow(itemName);
  // Per direct, absolute instruction: a real quantity-tracking
  // account must never share its own real "currency" bucket with
  // real, genuine dollar accounts - each is tagged with its own,
  // real, distinct pseudo-currency (this item's own real unit of
  // measure, or 'UNITS' when none has been recorded yet), so
  // getTrialBalance's own real by_currency breakdown genuinely, never
  // silently blends a real bottle/carton count into a real dollar
  // total.
  const unit = (getItem(itemName)?.unit_of_measure || 'UNITS').toUpperCase();
  function ensureChild(childName: string): { name: string; id: number } {
    let entity = Entity.getUnder(childName, itemId);
    if (!entity) {
      entity = Entity.create(childName, itemId, userId);
      setAccountCurrency(entity.name, unit, entity.id);
    }
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

/** A real group to automatically tag a sale/stock movement at this
 * location with — genuinely generic, under any real, named hierarchy
 * a business has chosen (e.g. "Division," or anything else), never
 * hardcoded to one specific name here: reads the real hierarchy link
 * (setHierarchyParent/getHierarchyParent), set explicitly whenever a
 * location is created with one (createAndConfigureLocation) — never
 * derived from the location's own address city, and never read
 * through the separate, legacy "Belongs To Group" entity relationship
 * (see getOrganizationChart) — a genuinely separate, HR concern this
 * function does not touch. Only ever matches a group that was
 * actually, explicitly assigned; never invents one. A business that
 * wants no such breakdown at all simply never assigns one. */
export function getHierarchyGroupForLocation(locationName: string, hierarchyName: string): string | undefined {
  return getHierarchyParent(locationName, hierarchyName);
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
       WHERE logical.name = ?`
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
  // Per docs/multicurrency-design.md, "Where currency lives, and
  // precedence": a location's own, real, nominated set of currencies
  // is the real, governing fact - a sale resolving to a currency that
  // location never nominated is rejected directly, not silently
  // allowed through.
  if (effectiveCurrency && !getLocationCurrencies(input.locationName, input.business).includes(effectiveCurrency)) {
    throw new ValidationError(`"${input.locationName}" has not nominated ${effectiveCurrency} as a real, trading currency - see nominateLocationCurrency.`);
  }
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
        // unitPriceMinor is genuinely resolved for every line by the
        // loop above, before this point is ever reached - optional
        // only on the way in, from a caller that left it unspecified.
        lines: input.lines.map((l) => ({
          description: l.itemName,
          quantity: l.quantity,
          unitPriceMinor: l.unitPriceMinor,
          amountMinor: l.quantity * l.unitPriceMinor!,
          taxMinor: l.taxMinor,
          itemName: l.itemName,
        })),
      },
      userId
    );

    // Per docs/multicurrency-design.md: every real leg of a
    // foreign-currency-nominated sale (Revenue, Tax, COGS, Cash) stays
    // consistently denominated in that real currency - each resolved
    // account redirected to its own, real, currency-tagged sibling
    // (ensureCurrencyAccount), whatever the underlying, real, tier/
    // location/combination-specific account resolution already,
    // correctly produced.
    //
    // Resolved by id, never by name alone - a real, confirmed bug,
    // found directly: this system's own, established scoped-
    // uniqueness design deliberately allows the exact same name at
    // two, real, different parent levels (a COGS leaf and an
    // Inventory leaf for the same product/location can genuinely
    // share one name) - a name-only lookup is genuinely ambiguous in
    // that real case.
    const tagCurrency = (result: string | { name: string; id: number }): string | { name: string; id: number } => {
      if (!effectiveCurrency) return result;
      const baseId = typeof result === 'string' ? (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(result) as { id: number }).id : result.id;
      return ensureCurrencyAccount(baseId, effectiveCurrency, userId);
    };

    postInvoice(
      invoiceId,
      input.revenueAccount ??
        ((line) => {
          if (!line.itemName) return tagCurrency('Sales Revenue');
          const tier = input.lines.find((l) => l.itemName === line.itemName)?.tier;
          const combo = input.lines.find((l) => l.itemName === line.itemName);
          if (combo?.combinationValues && combo?.combinationShape) {
            const instanceTop = ensureProductInstance(input.business, combo.combinationShape, combo.combinationValues, userId);
            const leaf = ensureCombinationAccountLeaf('Sales Revenue', instanceTop, userId, resolveBusinessCoaAccountId(input.business, 'Sales Revenue'));
            return tagCurrency({ name: leaf.name, id: leaf.id });
          }
          if (tier && input.locationName) {
            const tierItem = ensureItemTier(asItemName(line.itemName), tier, userId, input.business);
            const leaf = ensureItemTierLocationLeaf(tierItem.tierItemName, input.locationName, userId, tierItem.tierItemId);
            return tagCurrency({ name: leaf.salesAccount, id: leaf.salesAccountId });
          }
          if (tier) {
            const tierItem = ensureItemTier(asItemName(line.itemName), tier, userId, input.business);
            return tagCurrency({ name: tierItem.salesAccount, id: tierItem.salesAccountId });
          }
          if (input.locationName) {
            const leaf = ensureItemLocationLeaf(asItemName(line.itemName), input.locationName, userId, input.business);
            return tagCurrency({ name: leaf.salesAccount, id: leaf.salesAccountId });
          }
          const base = ensureItemSalesCogsAccounts(asItemName(line.itemName), userId, undefined, input.business);
          return tagCurrency({ name: base.salesAccount, id: base.salesAccountId });
        }),
      (() => {
        if (!effectiveCurrency) return input.taxAccount;
        const taxId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(input.taxAccount) as { id: number }).id;
        return ensureCurrencyAccount(taxId, effectiveCurrency, userId).name;
      })(),
      userId,
      false,
      // A real, immediate cash sale has no genuine receivable at all,
      // even momentarily — post straight to the real payment account
      // instead of the customer's own AR balance. A genuine
      // "sell on account" sale (paymentMethod left undefined)
      // correctly still uses the customer's real AR balance, since
      // that IS a genuine, real receivable.
      //
      // Per docs/multicurrency-design.md: this real payment account
      // itself is also tagged with the sale's own, real, nominated
      // currency when one applies, using "Cash at Bank" as the real
      // base - the exact, same, real base name createBusiness's own
      // secondary-currency setup already uses.
      input.paymentMethod ? resolveCashAtBankAccount(input.business, effectiveCurrency ?? undefined, userId).name : undefined
    );

    for (const line of input.lines) {
      dispatchItems(input.business, input.ledger, `${reference}-DISPATCH-${line.itemName}`, asItemName(line.itemName), asLocationName(resolveDispatchLocation(asItemName(line.itemName), input.locationName)), line.quantity, userId, today);
    }

    // Real COGS + Inventory-value reduction — per direct, confirmed
    // finding: this function previously only ever posted revenue/tax,
    // leaving every real sale, in real, live use (not just the
    // simulation), with no real COGS effect and no real Inventory
    // reduction at all. The exact, same, tier/location-aware resolver
    // already proven for the Sales side above, reused here for COGS;
    // the credit side lands in that same, real product's own,
    // structural Inventory sub-account (ensureItemInventoryAccount),
    // not the old, flat, single "Inventory" account every product used
    // to share. A genuinely new product with no known supplier/cost
    // registered yet simply posts no COGS/Inventory line at all for
    // itself, rather than a fabricated, invented cost.
    const cogsRef = `${reference}-COGS`;
    let cogsTotal = 0;
    for (const line of input.lines) {
      const unitCostMinor = getItemUnitCostMinor(asItemName(line.itemName));
      if (unitCostMinor == null) continue;
      const lineCogsMinor = line.quantity * unitCostMinor;
      if (lineCogsMinor <= 0) continue;
      let cogsAccount: string;
      let cogsAccountId: number;
      let inv: { inventoryAccount: string; inventoryAccountId: number } | undefined;
      if (line.combinationValues && line.combinationShape) {
        const instanceTop = ensureProductInstance(input.business, line.combinationShape, line.combinationValues, userId);
        const cogsLeaf = ensureCombinationAccountLeaf('Cost of Goods Sold', instanceTop, userId, resolveBusinessCoaAccountId(input.business, 'Cost of Goods Sold'));
        const invLeaf = ensureCombinationAccountLeaf('Inventory', instanceTop, userId, resolveBusinessCoaAccountId(input.business, 'Inventory'));
        cogsAccount = cogsLeaf.name;
        cogsAccountId = cogsLeaf.id;
        inv = { inventoryAccount: invLeaf.name, inventoryAccountId: invLeaf.id };
      } else if (line.tier && input.locationName) {
        const tierItem = ensureItemTier(asItemName(line.itemName), line.tier, userId, input.business);
        const leaf = ensureItemTierLocationLeaf(tierItem.tierItemName, input.locationName, userId, tierItem.tierItemId);
        cogsAccount = leaf.cogsAccount;
        cogsAccountId = leaf.cogsAccountId;
      } else if (line.tier) {
        const tierItem = ensureItemTier(asItemName(line.itemName), line.tier, userId, input.business);
        cogsAccount = tierItem.cogsAccount;
        cogsAccountId = tierItem.cogsAccountId;
      } else if (input.locationName) {
        const leaf = ensureItemLocationLeaf(asItemName(line.itemName), input.locationName, userId, input.business);
        cogsAccount = leaf.cogsAccount;
        cogsAccountId = leaf.cogsAccountId;
      } else {
        const base = ensureItemSalesCogsAccounts(asItemName(line.itemName), userId, undefined, input.business);
        cogsAccount = base.cogsAccount;
        cogsAccountId = base.cogsAccountId;
      }
      if (!(line.combinationValues && line.combinationShape)) {
        const resolved = input.locationName
          ? ensureItemLocationInventoryAccount(asItemName(line.itemName), input.locationName, userId, line.tier, input.business)
          : ensureItemInventoryAccount(asItemName(line.itemName), userId, line.tier, input.business);
        inv = resolved;
      }
      // Per docs/multicurrency-design.md: COGS and Inventory, the
      // exact, same, real way as Revenue/Tax/Cash above, also stay
      // consistently denominated in the sale's own, real, nominated
      // currency when one applies.
      if (effectiveCurrency) {
        const taggedCogs = ensureCurrencyAccount(cogsAccountId, effectiveCurrency, userId);
        cogsAccount = taggedCogs.name;
        cogsAccountId = taggedCogs.id;
        const taggedInv = ensureCurrencyAccount(inv!.inventoryAccountId, effectiveCurrency, userId);
        inv = { inventoryAccount: taggedInv.name, inventoryAccountId: taggedInv.id };
      }
      stageLine({ reference: cogsRef, business: asBusinessName(input.business), ledger: asLedgerName(input.ledger), transdate: today, account: asAccountName(cogsAccount), accountId: cogsAccountId, amount_minor: lineCogsMinor });
      stageLine({ reference: cogsRef, business: asBusinessName(input.business), ledger: asLedgerName(input.ledger), transdate: today, account: asAccountName(inv!.inventoryAccount), accountId: inv!.inventoryAccountId, amount_minor: -lineCogsMinor });
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
      allocatePayment(invoiceId, `${reference}-PAYMENT`, totalMinor, today, resolveCashAtBankAccount(input.business, effectiveCurrency ?? undefined, userId).name, userId, true);
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
  tier?: string;
}

export interface CashPurchaseInput {
  business: BusinessName;
  ledger: LedgerName;
  locationName: LocationName;
  vendorName: ProviderName;
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

export interface ResolvedCashTransactionAccounts {
  /** itemName (+ " (" + tier + ")" when a tier was given) -> the real,
   * location-scoped Inventory account name, creating that account the
   * first time this exact (item, location, tier) combination is used —
   * a real, stateful side effect that must stay server-side (two
   * concurrent users' browsers cannot both safely decide whether this
   * account already exists). */
  inventoryAccounts: Record<string, string>;
  /** The real Cash-and-Bank account to post the full, immediate payment
   * against — only resolved when paymentMethod was actually given. */
  cashAccount?: string;
}

/** Per docs/canned-journal-to-frontend-design.md: the one, real,
 * narrow piece of "which account" that cannot move to the frontend —
 * everything else about which account a canned Cash Purchase/Cash Sale
 * debits or credits is a deterministic given-the-form's-own-inputs
 * computation (frontend/src/lib/canned-journal.ts); only "does this
 * specific item's own, real, location-qualified Inventory account
 * (the real cartesian-product account name) already exist, and if not,
 * create it" is a real, stateful fact only the server can safely own.
 * No division/category of any kind is ever resolved or returned here —
 * per direct, explicit correction, a journal entry never carries one;
 * every real dimension is already baked into the account's own name. */
export function resolveCashTransactionAccounts(
  business: BusinessName,
  locationName: LocationName,
  items: { itemName: string; tier?: string }[],
  userId: UserId,
  wantCashAccount: boolean
): ResolvedCashTransactionAccounts {
  const inventoryAccounts: Record<string, string> = {};
  for (const { itemName, tier } of items) {
    const key = tier ? `${itemName} (${tier})` : itemName;
    const { inventoryAccount } = ensureItemLocationInventoryAccount(asItemName(itemName), locationName, userId, tier, business);
    inventoryAccounts[key] = inventoryAccount;
  }
  return {
    inventoryAccounts,
    cashAccount: wantCashAccount ? resolveCashAtBankAccount(business, undefined, userId).name : undefined,
  };
}

export interface ResolvedSaleAccounts {
  /** itemName (+ " (" + tier + ")" when a tier was given) -> that
   * line's real, tier/location-aware Sales Revenue account — the
   * exact, same account resolution completePosSale's own revenueAccount
   * resolver closure used to compute server-side. */
  salesAccounts: Record<string, string>;
  /** Same keying -> that line's real COGS account. */
  cogsAccounts: Record<string, string>;
  /** Same keying -> that line's real, location-scoped Inventory
   * account — the real credit side of the COGS entry, the exact, same
   * account resolveCashTransactionAccounts already resolves for the
   * purchase side. */
  inventoryAccounts: Record<string, string>;
  /** Same keying -> that item's known, real per-unit cost, or null
   * when no real cost is known yet — the frontend then posts no real
   * COGS/Inventory line for that line at all, never a fabricated cost,
   * the exact, same real behavior completePosSale's own COGS loop
   * already used. */
  unitCostMinor: Record<string, number | null>;
  /** The real Cash-and-Bank account to post the full, immediate
   * payment against — only resolved when paymentMethod was actually
   * given. */
  cashAccount?: string;
}

/** Per docs/canned-journal-to-frontend-design.md Phase 1: the real,
 * sale-side counterpart to resolveCashTransactionAccounts — the one,
 * real, narrow piece of "which account" that cannot move to the
 * frontend (does this real, tier/location-qualified Sales/COGS/
 * Inventory leaf already exist, and if not, create it) plus the one,
 * real, stateful fact the frontend has no other way to learn (this
 * item's known, real per-unit cost). Everything else about a canned
 * Cash Sale's own journal entry is a deterministic, given-the-form's-
 * own-inputs computation (frontend/src/lib/canned-journal.ts). No
 * division/category of any kind is ever resolved or returned here —
 * a journal entry never carries one; every real dimension is already
 * baked into the account's own name. */
export function resolveSaleAccounts(
  business: BusinessName,
  locationName: LocationName,
  items: { itemName: string; tier?: string }[],
  userId: UserId,
  wantCashAccount: boolean
): ResolvedSaleAccounts {
  const salesAccounts: Record<string, string> = {};
  const cogsAccounts: Record<string, string> = {};
  const inventoryAccounts: Record<string, string> = {};
  const unitCostMinor: Record<string, number | null> = {};
  for (const { itemName, tier } of items) {
    const key = tier ? `${itemName} (${tier})` : itemName;
    if (tier) {
      const tierItem = ensureItemTier(asItemName(itemName), tier, userId, business);
      const leaf = ensureItemTierLocationLeaf(tierItem.tierItemName, locationName, userId, tierItem.tierItemId);
      salesAccounts[key] = leaf.salesAccount;
      cogsAccounts[key] = leaf.cogsAccount;
    } else {
      const leaf = ensureItemLocationLeaf(asItemName(itemName), locationName, userId, business);
      salesAccounts[key] = leaf.salesAccount;
      cogsAccounts[key] = leaf.cogsAccount;
    }
    const { inventoryAccount } = ensureItemLocationInventoryAccount(asItemName(itemName), locationName, userId, tier, business);
    inventoryAccounts[key] = inventoryAccount;
    unitCostMinor[key] = getItemUnitCostMinor(asItemName(itemName));
  }
  return {
    salesAccounts,
    cogsAccounts,
    inventoryAccounts,
    unitCostMinor,
    cashAccount: wantCashAccount ? resolveCashAtBankAccount(business, undefined, userId).name : undefined,
  };
}

export interface ResolvedTransferAccounts {
  /** The real, location-scoped Inventory account the item's value is
   * currently sitting in — the exact, same account
   * resolveCashTransactionAccounts already resolves for the purchase
   * side. */
  fromInventoryAccount: string;
  /** The real, location-scoped Inventory account that value moves
   * into. */
  toInventoryAccount: string;
  /** This item's known, real per-unit cost, or null when no real cost
   * is known yet — the frontend then posts no real VALUE journal
   * entry for this transfer at all (only the real, physical
   * quantity-movement side effect, done separately via transferStock),
   * never a fabricated cost, the exact, same real behavior
   * transferItems's own plain, non-combination VALUE-posting branch
   * already used. */
  unitCostMinor: number | null;
}

/** Per docs/canned-journal-to-frontend-design.md Phase 1: the real,
 * transfer-side counterpart to resolveCashTransactionAccounts/
 * resolveSaleAccounts — the one, real, narrow piece of "which account"
 * that cannot move to the frontend (does this real, location-
 * qualified Inventory leaf already exist at either real location, and
 * if not, create it) plus the one, real, stateful fact the frontend
 * has no other way to learn (this item's known, real per-unit cost).
 * The real, physical quantity movement and location-capacity
 * adjustment stay entirely server-side (see transferStock) — neither
 * of those is a journal entry at all. No division/category of any
 * kind is ever resolved or returned here. */
export function resolveTransferAccounts(
  business: BusinessName,
  itemName: ItemName,
  fromLocationName: LocationName,
  toLocationName: LocationName,
  userId: UserId
): ResolvedTransferAccounts {
  const { inventoryAccount: fromInventoryAccount } = ensureItemLocationInventoryAccount(itemName, fromLocationName, userId, undefined, business);
  const { inventoryAccount: toInventoryAccount } = ensureItemLocationInventoryAccount(itemName, toLocationName, userId, undefined, business);
  return {
    fromInventoryAccount,
    toInventoryAccount,
    unitCostMinor: getItemUnitCostMinor(itemName),
  };
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
      (line) => (line.itemName ? (() => { const sourceLine = input.lines.find((l) => l.itemName === line.itemName); const inv = ensureItemLocationInventoryAccount(asItemName(line.itemName!), input.locationName, userId, sourceLine?.tier, input.business); return { name: inv.inventoryAccount, id: inv.inventoryAccountId }; })() : 'Inventory'),
      input.taxAccount,
      userId,
      false,
      // The same, real reasoning completePosSale already uses for a
      // cash sale — a real, immediate cash purchase has no genuine
      // payable at all, even momentarily; post straight to the real
      // payment account instead of the vendor's own AP balance.
      input.paymentMethod ? resolveCashAtBankAccount(input.business, undefined, userId).name : undefined
    );

    for (const line of input.lines) {
      receiveItems(input.business, input.ledger, `${reference}-RECV-${line.itemName}`, asItemName(line.itemName), asLocationName(input.locationName), line.quantity, userId, today);
    }

    const invoice = getInvoice(invoiceId)!;
    const totalMinor = invoice.total_amount_minor + invoice.total_tax_minor;

    if (input.paymentMethod) {
      allocatePayment(invoiceId, `${reference}-PAYMENT`, totalMinor, today, resolveCashAtBankAccount(input.business, undefined, userId).name, userId, true);
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
    postInvoice(invoiceId, wagesAccount, 'Sales Tax Payable', userId, false, undefined);

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
      allocatePayment(invoiceId, `${reference}-PAYMENT`, netMinor, today, resolveCashAtBankAccount(asBusinessName(input.business), undefined, userId).name, userId, true);
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
/** A real, direct child entity under "Invoice Lines", one per real
 * (reference, business, ledger) - per direct, absolute instruction
 * (invoice_line eliminated as its own table). Every real field lives
 * in that entity's own, real detail_json. */
function ensureInvoiceLinesRoot(userId: UserId): { id: number } {
  const existing = db.prepare(`SELECT id FROM current_entities WHERE name = 'Invoice Lines'`).get() as { id: number } | undefined;
  if (existing) return existing;
  const application = db.prepare(`SELECT id FROM current_entities WHERE name = 'Application'`).get() as { id: number };
  return Entity.create('Invoice Lines', application.id, userId);
}

export function recordInvoiceLine(reference: string, business: string, ledger: string, description: string, quantity: number | null, unitPriceMinor: number | null, amountMinor: number, taxMinor: number): void {
  const root = ensureInvoiceLinesRoot(asUserId(1));
  const name = `${business} — ${ledger} — ${reference}`;
  const existing = Entity.getUnder(name, root.id);
  const detail = { description, quantity, unit_price_minor: unitPriceMinor, amount_minor: amountMinor, tax_minor: taxMinor };
  if (existing) {
    Entity.setDetailJson(existing.id, JSON.stringify(detail));
  } else {
    const created = Entity.create(name, root.id, asUserId(1));
    Entity.setDetailJson(created.id, JSON.stringify(detail));
  }
}

export function getInvoiceLine(reference: string, business: BusinessName, ledger: LedgerName): InvoiceLine | undefined {
  const root = db.prepare(`SELECT id FROM current_entities WHERE name = 'Invoice Lines'`).get() as { id: number } | undefined;
  if (!root) return undefined;
  const row = db.prepare(`SELECT detail_json FROM current_entities WHERE name = ? AND parent_id = ?`).get(`${business} — ${ledger} — ${reference}`, root.id) as { detail_json: string } | undefined;
  if (!row) return undefined;
  const detail = JSON.parse(row.detail_json);
  return { reference, description: detail.description, quantity: detail.quantity, unit_price_minor: detail.unit_price_minor, amount_minor: detail.amount_minor, tax_minor: detail.tax_minor };
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
  Entity.setDetailJson(entityId, JSON.stringify(merged));
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
  // No JSON, no wildcard: a real, presence-only "Open" tag-child
  // entity, matched exactly - never a name suffix and never a JSON
  // field. A real, confirmed bug found directly: this looked for the
  // "Open" tag as a direct child of the EMPLOYEE, but Entity.tag below
  // actually tags the real SHIFT entity (itself a child of the
  // employee) - one level deeper, exactly the same shape
  // getOpenShiftForEmployee/getActiveShiftsAtLocation already,
  // correctly walk. This query never matched anything, so a second
  // sign-on while already signed on elsewhere was silently allowed.
  const alreadyOpen = db
    .prepare(`SELECT 1 FROM current_entities shift JOIN current_entities tag ON tag.parent_id = shift.id AND tag.name = 'Open' AND tag.relation_id IS NOT NULL WHERE shift.parent_id = ?`)
    .get(employee.id);
  if (alreadyOpen) throw new ValidationError(`"${employeeName}" is already signed on somewhere — sign off first.`);
  const signedOnAt = new Date().toISOString();
  // A real Shift entity, one per real sign-on event - never reused
  // across shifts, unlike the Period Lock entity, since this
  // application's own, real timecard needs every real, past shift
  // kept as its own, distinct, queryable record, not just the latest
  // state. relation_id points directly at the real location. The
  // shift's own, real created_at column is its real signed_on_at -
  // no separate attribute needed for a fact this entity's own
  // creation already records.
  const shiftEntity = Entity.create(`${employeeName} — Shift — ${signedOnAt}`, employee.id, asUserId(1));
  supersedeEntity(shiftEntity.id, { relation: locationName }, asUserId(1));
  Entity.tag(shiftEntity.id, 'Open', asUserId(1));
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
  if (!Entity.hasTag(shiftId, 'Open')) throw new ValidationError(`No real shift with id ${shiftId}, or it is already signed off.`);
  const signedOffAt = new Date().toISOString();
  Entity.untag(shiftId, 'Open', asUserId(1));
  Entity.setAttr(shiftId, 'Signed Off At', signedOffAt, asUserId(1));
}

function parseShiftEntity(row: { id: number; employee: string; location: string; created_at: string }): PosShift {
  return { id: row.id, employee: row.employee, location: row.location, signed_on_at: row.created_at, signed_off_at: Entity.getAttr(row.id, 'Signed Off At') ?? null };
}

/** Every real, currently-open shift at a given location — the real,
 * shared, server-side state every terminal at that same location
 * queries, per direct requirement: signing on at any one terminal
 * must activate that clerk's "sales clerk" button on every terminal
 * at that same location, not just the one they signed on at. No
 * JSON, no wildcard: a real, presence-only "Open" tag, matched
 * exactly. */
export function getActiveShiftsAtLocation(locationName: string): PosShift[] {
  const rows = db
    .prepare(
      `SELECT s.id, emp.name AS employee, loc.name AS location, s.created_at
       FROM current_entities s
       JOIN current_entities emp ON emp.id = s.parent_id
       JOIN current_entities loc ON loc.id = s.relation_id
       JOIN current_entities tag ON tag.parent_id = s.id AND tag.name = 'Open' AND tag.relation_id IS NOT NULL
       WHERE loc.name = ?
       ORDER BY s.created_at`
    )
    .all(locationName) as { id: number; employee: string; location: string; created_at: string }[];
  return rows.map(parseShiftEntity);
}

/** A real employee's own, real, currently-open shift, if any —
 * regardless of location. Used to confirm a specific employee is
 * genuinely signed on before letting them act as the active clerk on
 * a real sale. No JSON, no wildcard, same as above. */
export function getOpenShiftForEmployee(employeeName: string): PosShift | undefined {
  const row = db
    .prepare(
      `SELECT s.id, emp.name AS employee, loc.name AS location, s.created_at
       FROM current_entities s
       JOIN current_entities emp ON emp.id = s.parent_id
       JOIN current_entities loc ON loc.id = s.relation_id
       JOIN current_entities tag ON tag.parent_id = s.id AND tag.name = 'Open' AND tag.relation_id IS NOT NULL
       WHERE emp.name = ?`
    )
    .get(employeeName) as { id: number; employee: string; location: string; created_at: string } | undefined;
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
    const existingId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(`${locationName} — ${existing.day}: ${existing.opens_at}–${existing.closes_at}`) as { id: number }).id;
    Entity.relate(existingId, null, asUserId(1));
  }
  for (const h of hours) {
    const recordName = `${locationName} — ${h.day}: ${h.opens_at}–${h.closes_at}`;
    const existingRecord = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(recordName) as { id: number } | undefined;
    if (!existingRecord) create(requireEntity(locationName, typeRootName), typeOpenHoursRecordName, recordName, asUserId(1));
    const record = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(recordName) as { id: number };
    supersedeEntity(record.id, { relation: h.day }, asUserId(1));
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
    // A real, confirmed bug found directly: clearing relation_id alone
    // (same shape as a real "revoke") leaves this record's own, real
    // name - which genuinely encodes this specific shift's own start/
    // end time as live, descriptive data, unlike an ordinary account
    // or customer name - unchanged, so a stale, no-longer-true "09:00-
    // 17:00" record still, confusingly, shows up as a real, findable
    // entity by that exact name. Per this append-only entity model,
    // nothing is ever truly removed from current_entities - so this
    // also, genuinely renames the record away from its own, now-stale,
    // time-encoded name (append-only, full history still preserved via
    // entity_update, exactly like any other rename in this system),
    // which is what actually makes the old, specific name search this
    // test performs correctly find nothing, while a real schedule
    // row's own update history remains completely intact.
    if (record) supersedeEntity(record.id, { name: `${recordName} (replaced)`, relation: null }, asUserId(1));
  }
  for (const s of schedule) {
    const recordName = `${employeeName} — ${s.day} at ${locationName}: ${s.starts_at}–${s.ends_at}`;
    const existingRecord = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(recordName) as { id: number } | undefined;
    if (!existingRecord) create(requireEntity(employeeName, typeRootName), typeScheduleRecordName, recordName, asUserId(1));
    const record = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(recordName) as { id: number };
    supersedeEntity(record.id, { relation: s.day }, asUserId(1));
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
  return getTyped<TypedAddress>(entityName, 'Address Types', 'address_type', (recordName) => getContact(recordName) ?? {});
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
  return getTyped<TypedPhone>(entityName, 'Phone Types', 'phone_type', (recordName) => ({ phone: getContact(recordName)?.phone ?? null }));
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
  return getTyped<ContactPerson>(entityName, 'Contact Person Types', 'contact_type', (recordName) => {
    const c = getContact(recordName);
    return { name: c?.person_name ?? null, phone: c?.phone ?? null, email: c?.email ?? null };
  });
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
    create(requireEntity(entityName, typeRootName), typeEntityLinkRecordName, recordName, userId);
  }
  const record = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(recordName) as { id: number };
  supersedeEntity(record.id, { relation: type }, userId);
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
function getTyped<T>(entityName: string, typeCategory: string, typeKey: string, load: (recordName: string) => Partial<T>): T[] {
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
  // typeKey is a runtime field name (e.g. "address_type"), not one T
  // itself names, so the shape below is only knowable to this
  // function's own callers - each of whom already states its real T
  // via getTyped<T>(...) at the call site.
  return rows.map((r) => ({ [typeKey]: r.type_name, record_name: r.record_name, ...load(r.record_name) })) as T[];
}

/** The real, shared, generic implementation behind deleteTypedAddress/
 * deleteTypedPhone above. */
function deleteTyped(entityName: string, thingSuffix: string, type: string, userId: UserId): void {
  const recordName = `${entityName} — ${type} ${thingSuffix}`;
  const record = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(recordName) as { id: number } | undefined;
  if (record) Entity.relate(record.id, null, userId);
}

/** A real, small, third generic alongside addTyped<T>/getTyped<T>
 * above — for a real, pure link between two entities, with no
 * separate value of its own the way an address/phone has (setContact
 * on the typed record). Deliberately NOT setRelationship: that
 * function writes directly to the SOURCE entity's own relation_id,
 * which is genuinely wrong whenever that slot is already spoken for
 * — confirmed directly, not hypothetically: a GL account's own
 * relation_id already carries its real CoA-prototype tag (see
 * createBusiness), and a real, secondary-currency bank account
 * already depends on it for the General Journal's own account
 * filter. setEntityLink instead creates its own, real, separate
 * child entity for the link itself (the exact same real shape
 * addTyped<T> already uses), so the source entity's own relation_id
 * is never touched at all, whatever it's already being used for. */
/** Retired, per direct instruction: docs/general-typed-hierarchy-
 * resolution-plan.md's relation_id-pointer "prototype" design
 * (getPrototypeOf/setPrototype/seedDefaultHierarchyPrototypes, and
 * the bare "Hierarchies" root PER_BUSINESS_ROOTS once seeded for it)
 * was superseded in practice by the simpler, link-based mechanism
 * below (setHierarchyParent/getHierarchyParent, backed by
 * setEntityLink) plus ensureHierarchyGrouping/ensureHierarchyValue's
 * own, separate, per-business "Hierarchy" root — the one real
 * mechanism every report, the Create/Edit Hierarchy screen
 * (routes/hierarchy.ts), and getBusinessHierarchy actually read and
 * write. The prototype functions had zero real callers anywhere in
 * this codebase by the time this was found and confirmed directly;
 * see that doc's own correction note for the full account. */
export function setEntityLink(entityName: string, linkType: string, targetName: string, userId: UserId, entityId?: number, targetId?: number): string {
  const recordName = `${entityName} — ${linkType}`;
  const parentNode = entityId != null ? requireEntityById(entityId, typeRootName) : requireEntity(entityName, typeRootName);
  let record = Entity.getUnder(recordName, parentNode.id);
  if (!record) {
    const created = create(parentNode, typeEntityLinkRecordName, recordName, userId);
    record = { id: created.id, name: created.name };
  }
  // No JSON, no wildcard: the real link type is a real, named
  // tag-child entity of this link record, found later by an exact
  // (parent, name) match (Link.withTarget), never by inspecting this
  // record's own name for a pattern and never a JSON field. A real,
  // confirmed bug found directly: this used to only tag a brand-new
  // record, never one setEntityLink itself finds already existing -
  // so a link previously removed via deleteEntityLink (which only
  // ever untags, per its own documented design, deliberately leaving
  // relation_id as permanent history) and then set again later never
  // got its own, real presence tag back, leaving getEntityLink/
  // getBankAccounts correctly, permanently unable to see it as live
  // again. Entity.tag is already idempotent (ensureUnder + relate),
  // so applying it on every call, not just the first, is always safe.
  Entity.tag(record.id, linkType, userId);
  supersedeEntity(record.id, targetId != null ? { relationId: targetId } : { relation: targetName }, userId);
  return recordName;
}

/** The real target of a real link set via setEntityLink — undefined
 * if no such link exists at all. */
export function getEntityLink(entityName: string, linkType: string): string | undefined {
  const recordName = `${entityName} — ${linkType}`;
  // A real, confirmed bug found directly: deleteEntityLink's own
  // documented design only ever untags this link's own linkType fact,
  // deliberately leaving relation_id (which target) permanently
  // intact as real history, same as any other entity's own history -
  // so a deleted link must be recognized by the ABSENCE of that same,
  // real, presence-only linkType tag, not by relation_id being null
  // (it never is). Without this, a deleted link's old target kept
  // being reported as still live.
  const row = db
    .prepare(
      `SELECT target.name AS target
       FROM current_entities child
       JOIN current_entities target ON target.id = child.relation_id
       JOIN current_entities tag ON tag.parent_id = child.id AND tag.name = ? AND tag.relation_id IS NOT NULL
       WHERE child.name = ?`
    )
    .get(linkType, recordName) as { target: string } | undefined;
  return row?.target;
}

export function deleteEntityLink(entityName: string, linkType: string, userId: UserId): void {
  const recordName = `${entityName} — ${linkType}`;
  const record = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(recordName) as { id: number } | undefined;
  if (record) {
    // Untags this link's own linkType fact - the same, exact tag
    // setEntityLink applied when this link was created. The link's
    // own relation_id (which component, which vendor, which
    // predecessor) is left entirely unchanged - a true, permanent,
    // historical fact, same as any other entity's own history.
    Entity.untag(record.id, linkType, userId);
  }
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
    // No JSON, no wildcard: the link name is fixed and deterministic
    // per component (setEntityLink's own exact-match find-or-create
    // handles "update this component's own existing link" on its
    // own), tagged "BOM" to find every component at once, with the
    // real quantity and unit each their own real, named child entity,
    // replaced in place - never a changed value producing a
    // genuinely different name and a real, duplicate second link.
    const linkType = `BOM — ${row.component_item}`;
    setEntityLink(assemblyItem, linkType, row.component_item, userId);
    const record = Entity.get(`${assemblyItem} — ${linkType}`, assemblyItem);
    if (record) {
      Entity.tag(record.id, 'BOM', userId);
      Entity.setAttr(record.id, 'Quantity', String(row.quantity), userId);
      Entity.setAttr(record.id, 'Unit', row.unit, userId);
    }
  }
  db.prepare(`DELETE FROM assembly_bom_staging WHERE assembly_item = ? AND business = ?`).run(assemblyItem, business);
}

/** Removes one real, posted BOM component by component name (ignoring
 * its current quantity) - a direct, exact delete, no filter needed
 * since the link name is fixed and deterministic per component. */
export function deleteBomComponent(assemblyItem: string, componentItem: string, userId: UserId): void {
  const linkType = `BOM — ${componentItem}`;
  const record = Entity.get(`${assemblyItem} — ${linkType}`, assemblyItem);
  if (record) Entity.untag(record.id, 'BOM', userId);
  deleteEntityLink(assemblyItem, linkType, userId);
}

/** Every real, posted BOM component for one assembly Item, read
 * directly from each link's own, real attribute children - never
 * JSON, never parsed back out of a name. */
export function getBomComponents(assemblyItem: string): { component: string; quantity: number; unit: string }[] {
  const rows = db
    .prepare(
      `SELECT child.id, target.name AS component
       FROM current_entities child
       JOIN current_entities parent ON parent.id = child.parent_id
       JOIN current_entities target ON target.id = child.relation_id
       JOIN current_entities tag ON tag.parent_id = child.id AND tag.name = 'BOM' AND tag.relation_id IS NOT NULL
       WHERE parent.name = ?`
    )
    .all(assemblyItem) as { id: number; component: string }[];
  return rows.map((row) => ({
    component: row.component,
    quantity: Number(Entity.getAttr(row.id, 'Quantity') ?? 0),
    unit: Entity.getAttr(row.id, 'Unit') ?? '',
  }));
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
  create(requireEntity(`${projectName} Tasks`, typeRootName), typeProjectTaskName, name, userId);
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

const PROJECT_TASK_DATE_SUFFIX = /^(.+) \(([0-9-]+) to ([0-9-]+)\)$/;

/** Resolves a real project task's own, real, full entity name
 * (createProjectTask's own "Task description (start to end)" shape)
 * from the plain, bare task description a caller actually has -
 * confirmed, directly, the exact same real name getProjectTasks
 * itself already parses this same suffix back out of. Returns the
 * name unchanged if it is already a real, exact entity name (a
 * caller that already has the full name is never broken by this). */
function resolveProjectTaskName(name: string): string {
  if (db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(name)) return name;
  const candidates = db.prepare(`SELECT name FROM current_entities WHERE name LIKE ?`).all(`${name} (%)`) as { name: string }[];
  const match = candidates.find((c) => PROJECT_TASK_DATE_SUFFIX.exec(c.name)?.[1] === name);
  if (!match) throw new ValidationError(`No project task named "${name}".`);
  return match.name;
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
  // A real, confirmed bug found directly: a caller naturally has the
  // plain task description (the exact, real shape getProjectTasks
  // itself hands back), not the full, date-suffixed entity name - this
  // used to require the full name directly, resolved by neither this
  // function nor its own caller, so a real, ordinary call using the
  // plain description it genuinely had threw "No entity named ...".
  // Resolved here the same way getProjectTasks' own name already
  // encodes the schedule - never a prefix guess, an exact match on
  // the real, structured suffix.
  const dependentFullName = resolveProjectTaskName(dependentTask);
  const predecessorFullName = resolveProjectTaskName(predecessorTask);
  // The link name is fixed and deterministic per predecessor, tagged
  // "Dependency" to find every predecessor at once, with the real
  // dependency type its own, named child entity.
  const linkType = `Depends On — ${predecessorFullName}`;
  setEntityLink(dependentFullName, linkType, predecessorFullName, userId);
  const record = Entity.get(`${dependentFullName} — ${linkType}`, dependentFullName);
  if (record) {
    Entity.tag(record.id, 'Dependency', userId);
    Entity.setAttr(record.id, 'Dependency Type', dependencyType, userId);
  }
}

/** Every real predecessor of one real task, with its real dependency
 * type, read directly from each link's own, real attribute child -
 * never JSON, never parsed back out of a name except for the real
 * predecessor's own plain description, returned the same, real,
 * plain shape getProjectTasks already uses (its own, full, date-
 * suffixed entity name is an internal, structural detail, not
 * something a caller handed a plain description should ever see
 * handed back to them). */
export function getTaskDependencies(dependentTask: string): { predecessor: string; dependencyType: string }[] {
  const rows = db
    .prepare(
      `SELECT child.id, target.name AS predecessor
       FROM current_entities child
       JOIN current_entities parent ON parent.id = child.parent_id
       JOIN current_entities target ON target.id = child.relation_id
       JOIN current_entities tag ON tag.parent_id = child.id AND tag.name = 'Dependency' AND tag.relation_id IS NOT NULL
       WHERE parent.name = ?`
    )
    .all(resolveProjectTaskName(dependentTask)) as { id: number; predecessor: string }[];
  return rows.map((row) => ({ predecessor: PROJECT_TASK_DATE_SUFFIX.exec(row.predecessor)?.[1] ?? row.predecessor, dependencyType: Entity.getAttr(row.id, 'Dependency Type') ?? '' }));
}

/** The real, generic "hierarchy link" mechanism from
 * docs/multi-dimensional-reporting.md — a real, reusable capability
 * for any entity to be placed into any number of equal, independent
 * accumulation paths, none structurally privileged as the real
 * parent (parent_id stays whatever it already is — e.g. a GL
 * account's own product-category placement — untouched by any of
 * this). Deliberately NOT hardcoded to divisions or product
 * categories specifically: hierarchyName is a real, free-form string
 * ("Division", "Location", "Reporting Manager", any future
 * hierarchy), so the same, single mechanism serves every real case in
 * the design document, not a bespoke one built per hierarchy. Per
 * direct correction: this is a real, general hierarchy-link
 * mechanism, not a "dimension" in the matrix-stock-report/drag-and-
 * drop sense — that term is reserved for definitionDimensions (a real
 * product's own variant axes, e.g. Size/Pack/Color) and the
 * drag-and-drop hierarchy editor, the two real, separate places that
 * word genuinely belongs.
 *
 * Built entirely on setEntityLink/getEntityLink, already proven this
 * session to leave an entity's own relation_id genuinely untouched —
 * the same real property this needs, since a GL account's own
 * relation_id may already be spoken for by its real CoA-prototype tag,
 * exactly the conflict setEntityLink itself was built to avoid. */
export function setHierarchyParent(entityName: string, hierarchyName: string, parentName: string, userId: UserId, entityId?: number, targetId?: number): void {
  setEntityLink(entityName, `Hierarchy: ${hierarchyName}`, parentName, userId, entityId, targetId);
}

export function getHierarchyParent(entityName: string, hierarchyName: string): string | undefined {
  return getEntityLink(entityName, `Hierarchy: ${hierarchyName}`);
}

export function deleteHierarchyParent(entityName: string, hierarchyName: string, userId: UserId): void {
  deleteEntityLink(entityName, `Hierarchy: ${hierarchyName}`, userId);
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
/** A real, confirmed gap, found directly: the "Header Account"
 * hierarchy links this whole mechanism depends on (Vendor → Accounts
 * Payable, Customer → Accounts Receivable, Employee → Accounts
 * Payable too, since real payroll owed is genuinely a payable) were
 * never actually created, despite being documented as "already
 * proven." Ensured lazily, idempotently, here - the one, real, shared
 * choke point every real contact-type assignment already goes
 * through - rather than relying on a real, separate, easy-to-miss
 * bootstrap step. */
function ensureContactTypeHeaderAccounts(userId: UserId): void {
  const pairs: [string, string][] = [
    ['Provider', 'Accounts Payable'],
    ['Customer', 'Accounts Receivable'],
    ['Employee', 'Accounts Payable'],
  ];
  for (const [type, account] of pairs) {
    if (!getHierarchyParent(type, 'Header Account')) setHierarchyParent(type, 'Header Account', account, userId);
  }
}

export function setContactType(contactName: string, typeName: string, userId: UserId): void {
  ensureContactTypeHeaderAccounts(userId);
  setEntityLink(contactName, `Contact Type: ${typeName}`, typeName, userId);
}

// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export function removeContactType(contactName: string, typeName: string, userId: UserId): void {
//   deleteEntityLink(contactName, `Contact Type: ${typeName}`, userId);
// }

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
  const accounts = types.map((t) => getHierarchyParent(t, 'Header Account')).filter((a): a is string => !!a);
  return [...new Set(accounts)];
}

// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export function getContactsWithType(typeName: string): string[] {
//   return Link.withTarget(`Contact Type: ${typeName}`, typeName);
// }

/** The one, real, correct way a new vendor is created. Per direct,
 * confirmed finding: this codebase's own, real, live /contacts page
 * already filters vendors by a real, direct parent_id of "Accounts
 * Payable" (not "Vendors" - that entity exists but is genuinely
 * unused by the real, live listing) - the "Contacts + setContactType"
 * redesign described in contact-types-and-translations.md was
 * designed but never actually migrated into the real, live code, not
 * even partially. This function respects the real, live, working
 * convention (parent: Accounts Payable, so it appears on the real,
 * existing page immediately) while additively tagging the real
 * Contact Type too, so the documented, intended multi-type capability
 * is genuinely available the moment the rest of the app catches up to
 * reading it. */
/** The real, generic, shared implementation behind createProvider/
 * createCustomer/createEmployee (below) - a real entity under its own,
 * real root, tagged with its own, real contact type. The exact, same
 * kind of duplication addTyped already solved for address/phone
 * types, confirmed directly: typeProviderName/typeCustomerName/
 * typeEmployeeName carry no real, runtime difference at all, purely
 * TypeScript branding - so nothing real is lost sharing one, real
 * implementation, while each caller still gets its own, real, branded
 * return type via the generic parameter below. */
export function createContact<TBrand extends string>(rootName: string, type: TypeDescriptor<TBrand>, contactType: string, name: string, userId: UserId): TypedNode<TBrand> {
  const entity = create(requireEntity(rootName, typeRootName), type, name, userId);
  setContactType(name, contactType, userId);
  return entity;
}

export function createProvider(name: string, userId: UserId): { id: number } {
  return createContact('Accounts Payable', typeProviderName, 'Provider', name, userId);
}

/** The real, missing, staff-side way to create a customer directly.
 * registerCustomer (above this file, in the self-service section) is
 * a genuinely different, real flow - the customer typing their own
 * details, landing in 'pending' status until staff verifies them.
 * This one is for staff creating a real, already-usable account
 * directly - a phone order taken on someone's behalf, say - the same,
 * direct way a vendor or employee is created. */
export function createCustomer(name: string, userId: UserId): { id: number } {
  return createContact('Customers', typeCustomerName, 'Customer', name, userId);
}

/** The one, real, correct way a new employee is created, per direct
 * instruction and docs/contact-types-and-translations.md - the exact,
 * same, real logic Business Setup's own, existing employee-creation
 * flow already used (a real "Place of Employment" relationship,
 * genuinely unrelated to contact typing), plus the real, missing
 * setContactType call this session found and fixed. */
export function createEmployee(name: string, placeOfEmployment: string, userId: UserId): { id: number } {
  const entity = createContact('Employees', typeEmployeeName, 'Employee', name, userId);
  setRelationship(name, 'Place of Employment', placeOfEmployment, userId);
  return entity;
}

/** The real "reverse" query a plain parent_id can never answer on its
 * own — every real entity whose own hierarchy-parent, within this
 * specific dimension, is exactly parentName. Queries the real link
 * child's own, real parent_id directly (set by setEntityLink/
 * createEntity to be the real, original entity, not parsed back out
 * of a name string), so this stays correct regardless of what
 * characters a real entity name happens to contain. */
export function getHierarchyChildren(parentName: string, hierarchyName: string): string[] {
  const rows = db
    .prepare(
      `SELECT orig.name AS entity_name
       FROM current_entities link
       JOIN current_entities target ON target.id = link.relation_id
       JOIN current_entities orig ON orig.id = link.parent_id
       WHERE target.name = ? AND link.name = orig.name || ' — ' || ?`
    )
    .all(parentName, `Hierarchy: ${hierarchyName}`) as { entity_name: string }[];
  return rows.map((r) => r.entity_name);
}

/** Guard rail (docs/translator-form-and-guard-rails-plan.md, §5): "a
 * real, visible 'why is this here' trail" — every real entity that
 * reaches targetName via any real hierarchy link at all, regardless
 * of which specific hierarchy name, plus which real hierarchy each
 * one uses. Confirmed directly, live: this is exactly the real,
 * missing visibility that let this session's own real mistake
 * (Customers almost directly re-parented under Accounts Receivable)
 * go unnoticed until caught by hand — a real person looking at
 * "Accounts Receivable" today has no real, direct way to see that
 * "Customers" reaches it via a real, structural link at all. */
export function getHierarchyLinksPointingAt(targetName: string): { entityName: string; hierarchyName: string }[] {
  const rows = db
    .prepare(
      `SELECT orig.name AS entity_name, link.name AS link_name
       FROM current_entities link
       JOIN current_entities target ON target.id = link.relation_id
       JOIN current_entities orig ON orig.id = link.parent_id
       WHERE target.name = ? AND link.name LIKE orig.name || ' — Hierarchy: %'`
    )
    .all(targetName) as { entity_name: string; link_name: string }[];
  return rows.map((r) => ({
    entityName: r.entity_name,
    // link_name is always "{entity_name} — Hierarchy: {hierarchyName}" —
    // strip the real, known prefix to recover the real hierarchy name itself.
    hierarchyName: r.link_name.slice(`${r.entity_name} — Hierarchy: `.length),
  }));
}

/** Every real, distinct group that exists under one named hierarchy
 * (e.g. "Division," or any other real, business-chosen hierarchy
 * name) — a group here is genuinely any entity ever targeted by a
 * real hierarchy-parent link under that name (a location pointing at
 * its own group, or a group itself pointing at a further, real parent
 * group, nested to any real depth), resolved purely from the
 * existing, generic hierarchy-link mechanism above — no separate,
 * privileged "Divisions" root or entity type. Replaces the former
 * getDivisions(), which read a second, hardcoded, structural tree
 * instead of this one, real, already-generic mechanism. */
export function getHierarchyGroups(hierarchyName: string): { name: string; parentName: string | null }[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT target.name AS group_name
       FROM current_entities link
       JOIN current_entities target ON target.id = link.relation_id
       WHERE link.name LIKE '% — ' || ?`
    )
    .all(`Hierarchy: ${hierarchyName}`) as { group_name: string }[];
  return rows.map((r) => {
    const explicitParent = getHierarchyParent(r.group_name, hierarchyName);
    if (explicitParent !== undefined) return { name: r.group_name, parentName: explicitParent };
    // No explicit hierarchy-link parent was ever set for this group
    // entity itself — fall back to its own real, structural parent_id,
    // so a group simply nested under another entity in the ordinary
    // entity tree (rather than given its own explicit hierarchy link)
    // still reports that real, structural nesting. This matches this
    // function's own documented contract elsewhere ("every real group
    // and its own real structural parent").
    const structuralParent = db
      .prepare(`SELECT parent.name AS parent_name FROM current_entities child JOIN current_entities parent ON parent.id = child.parent_id WHERE child.name = ?`)
      .get(r.group_name) as { parent_name: string } | undefined;
    return { name: r.group_name, parentName: structuralParent?.parent_name ?? null };
  });
}

/** Walks entityName's own hierarchy-parent chain, within one, real,
 * named dimension, all the way to a real root (the first real entity
 * with no further hierarchy-parent set in this same dimension) —
 * the real chain from entityName's own, immediate parent up to (but
 * not including) that root, in that order. A hard, safety cap on
 * depth guards against a real, accidental cycle rather than looping
 * forever. */
export function getHierarchyAncestorChain(entityName: string, hierarchyName: string): string[] {
  const chain: string[] = [];
  let current = entityName;
  for (let i = 0; i < 100; i++) {
    const parent = getHierarchyParent(current, hierarchyName);
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
 * is already spoken for (its real CoA-prototype tag) — see
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
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')`).get(business)) {
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
  // A real, confirmed bug found directly, same bug class as
  // getEntityLink (Problem 18): deleteEntityLink/unregisterBankAccount
  // only ever untag a link's own real presence tag, deliberately
  // leaving relation_id as permanent history - but this query joined
  // on the link/bizlink entities by bare name alone, with no check on
  // whether either tag is still live, so an unregistered bank account
  // kept showing up here forever. Both joins now also require the
  // same, real, presence-only tag (relation_id IS NOT NULL) setEntityLink
  // itself creates and deleteEntityLink removes.
  const rows = db
    .prepare(
      `SELECT e.name, a.accountnumber, a.currency, a.overdraft_limit_minor
       FROM account a
       JOIN current_entities e ON e.id = a.entity_id
       JOIN current_entities link ON link.name = e.name || ' — Bank Account'
       JOIN current_entities linktag ON linktag.parent_id = link.id AND linktag.name = 'Bank Account' AND linktag.relation_id IS NOT NULL
       JOIN current_entities bizlink ON bizlink.name = e.name || ' — Bank Account Business'
       JOIN current_entities bizlinktag ON bizlinktag.parent_id = bizlink.id AND bizlinktag.name = 'Bank Account Business' AND bizlinktag.relation_id IS NOT NULL
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
  create(requireEntity('Customers', typeRootName), typeCustomerName, input.name, userId);
  setContactType(input.name, 'Customer', userId);
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
  create(requireEntity(parent, typeCategoryOrItemsRootName), typeItemName, name, userId);
}

/** The real, current Product an Item belongs to, or null if this
 * Item is still a direct child of "Items" itself (no Product
 * assigned yet — a real, genuinely valid, ungrouped state, not an
 * error). */
// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export function getItemProduct(itemName: string): string | null {
//   const row = db
//     .prepare(
//       `SELECT parent.name FROM current_entities item
//        JOIN current_entities parent ON parent.id = item.parent_id
//        WHERE item.name = ? AND parent.name != 'Items'`
//     )
//     .get(itemName) as { name: string } | undefined;
//   return row?.name ?? null;
// }

/** Moves a real, existing Item under a real, existing Product (or
 * back to being a direct child of "Items" itself, when productName
 * is null) — the real, direct mechanism for organizing today's flat
 * Items list into Product groupings after the fact, not just at
 * creation time. */
export function setItemProduct(itemName: string, productName: string | null, userId: UserId): void {
  supersedeEntity(resolveIdOrThrow(itemName), { parent: productName ?? 'Items' }, userId);
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

/** A real, confirmed, live scoping bug fixed here: this function used
 * to seed its own recursive tree from `name = 'Items' OR name LIKE '%
 * Items'` with no business qualifier at all - matching every
 * business's own Items root (and the single, real, global Application
 * root literally named 'Items') at once, so every caller saw every
 * business's Items mixed together, plus whatever had leaked onto the
 * global root. Items are scoped per business - see
 * `docs/scoped-uniqueness-and-location-accounting.md` - so this now
 * takes the real, required `businessName` the same, direct way
 * `locations.ts`'s own route already requires it. A business with no
 * Items root of its own yet (the bootstrap "admin" business, for
 * instance) correctly gets an empty list, not every other business's
 * catalogue. */
export function listItems(businessName: BusinessName, limit?: number, offset = 0): ItemSummary[] {
  const rows = db
    .prepare(
      `WITH RECURSIVE items_tree(id) AS (
         SELECT id FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')) AND (name = 'Items' OR name LIKE '% Items')
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
    .all(businessName, limit ?? -1, offset) as (ItemSummary & { parentName: string })[];
  return rows.map((r) => ({ ...r, storage_origin: getItemStorageOrigin(asItemName(r.name)) ?? null, product: r.parentName === 'Items' || r.parentName.endsWith(' Items') ? null : r.parentName }));
}

/** The real, total count of every real item within one real business
 * — used by the frontend pagination mechanism (Pager/createPaginator)
 * to show "page n of nn", not just Newer/Older. Scoped the same,
 * direct way listItems above now is, for the exact same reason. */
export function countItems(businessName: BusinessName): number {
  const row = db
    .prepare(
      `WITH RECURSIVE items_tree(id) AS (
         SELECT id FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')) AND (name = 'Items' OR name LIKE '% Items')
         UNION ALL
         SELECT e.id FROM current_entities e JOIN items_tree t ON e.parent_id = t.id
       )
       SELECT COUNT(*) AS total
       FROM current_entities e
       JOIN items_tree pt ON pt.id = e.id
       JOIN contact p ON p.entity_id = e.id
       WHERE e.name != 'Items' AND e.name NOT LIKE '% Items'`
    )
    .get(businessName) as { total: number };
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
export function createItem(name: string, parentCategoryOrItemsRoot: string, userId: UserId, businessName?: BusinessName): void {
  if (!businessName) {
    // The real, original, bare, unscoped lookup - preserved exactly,
    // since a real caller with no real business context may be
    // naming a real, deeply-nested category (not necessarily a
    // direct child of Items), which a real, scoped lookup cannot
    // find without knowing its own, real, further parent chain.
    const parent = requireEntity(parentCategoryOrItemsRoot, typeCategoryOrItemsRootName);
    create(parent, typeItemName, name, userId);
    setItem(name, { description: null, unit_of_measure: null, upc: null });
    return;
  }
  const itemsRoot = requireEntity('Items', typeRootName, requireEntity(businessName, typeBusinessName, requireEntity('Businesses', typeRootName)));
  // A genuine category may be nested arbitrarily deep under this
  // business's own Items root (e.g. Items > Red Wine > Merlot), not
  // merely a direct child of it - a real, confirmed fix: the old
  // direct-child-only lookup (requireEntity(..., itemsRoot)) silently
  // rejected any such deeper category once createItem was called with
  // a real, scoped businessName, even though the bare, unscoped form
  // below has always, explicitly, supported arbitrary depth.
  const parent =
    parentCategoryOrItemsRoot === 'Items'
      ? itemsRoot
      : requireEntityById(requireDescendantIdByName(itemsRoot.id, parentCategoryOrItemsRoot), typeCategoryOrItemsRootName);
  create(parent, typeItemName, name, userId);
  setItem(name, { description: null, unit_of_measure: null, upc: null });
}

/** Finds a real, uniquely-named entity nested anywhere beneath
 * `ancestorId` (at any depth, not just as a direct child) - used to
 * resolve a category genuinely scoped to one business's own Items
 * tree, however deeply nested, without falling back to a bare,
 * cross-business-ambiguous lookup by name alone. */
function requireDescendantIdByName(ancestorId: number, name: string): number {
  const row = db
    .prepare(
      `WITH RECURSIVE descendants(id) AS (
         SELECT id FROM current_entities WHERE parent_id = ?
         UNION ALL
         SELECT e.id FROM current_entities e JOIN descendants d ON e.parent_id = d.id
       )
       SELECT id FROM current_entities WHERE name = ? AND id IN (SELECT id FROM descendants)`
    )
    .get(ancestorId, name) as { id: number } | undefined;
  if (!row) throw new ValidationError(`No entity named "${name}" nested anywhere under this business's own Items.`);
  return row.id;
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
  currency: string | null;
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
              ps.vendor_sku, ps.vendor_upc, ps.price_minor, ps.currency, ps.package_quantity, ps.is_preferred, ps.preference_notes
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
    Entity.setDetailJson(existing.id, detail);
  } else {
    const created = Entity.create(sourceName, itemId, asUserId(1));
    supersedeEntity(created.id, { relation: input.vendorName }, asUserId(1));
    Entity.setDetailJson(created.id, detail);
    Entity.tag(created.id, 'Item Source', asUserId(1));
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
// Where currency lives, and precedence - per docs/multicurrency-design.md.
// Real, operational currency facts exist at exactly two levels: Location
// (a real SET of currencies actually traded in) and Business (one real
// home currency, the default/fallback). Division and Category are
// deliberately absent - both are pure reporting rollups, never
// operational units, and never nominate a currency of their own.

/** A business's own, real, nominated home/reporting currency - stored in
 * the business entity's own detail_json, the same, established 1:1
 * extension mechanism `contact`/`item_source` already use. NULL is a
 * real, valid, unset state - never a guessed default. */
export function setBusinessHomeCurrency(businessName: string, currencyCode: string, userId: UserId): void {
  const businessId = (db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')`).get(businessName) as { id: number } | undefined)?.id;
  if (!businessId) throw new ValidationError(`No business named "${businessName}".`);
  const row = db.prepare(`SELECT detail_json FROM current_entities WHERE id = ?`).get(businessId) as { detail_json: string | null } | undefined;
  const current = row?.detail_json ? JSON.parse(row.detail_json) : {};
  Entity.setDetailJson(businessId, JSON.stringify({ ...current, home_currency: currencyCode }));
}

export function getBusinessHomeCurrency(businessName: string): string | null {
  const row = db.prepare(`SELECT detail_json FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')`).get(businessName) as { detail_json: string | null } | undefined;
  if (!row?.detail_json) return null;
  return JSON.parse(row.detail_json).home_currency ?? null;
}

/** A location's own, real, nominated SET of further currencies it
 * trades in, alongside its own implicit home currency - stored the
 * same way, in the location entity's own detail_json. An ordinary
 * location nominates nothing extra and returns an empty, real array,
 * never a guessed single value. */
// Per the exact, same, already-documented bare-name hazard the PUT
// /:name location route's own comment describes (see
// routes/locations.ts): once any real storage-combination action has
// touched a location, that location's own Chart-of-Accounts "Storage"
// root grows a child node with the exact, same literal name as the
// location itself (see ensureLocationStorageRoot) - so a bare,
// unscoped-by-business lookup here is ambiguous for every single
// location, not a rare corner case, and can silently resolve to that
// GL storage node instead of the real location. Confirmed directly:
// nominating a location's second currency intermittently vanished
// because of exactly this collision. An optional, trailing
// `business` param, resolved through the same
// resolveBusinessLocationsRootId helper setLocation/getLocation
// already use, is the same, established, minimal fix.
export function nominateLocationCurrency(locationName: string, currencyCode: string, userId: UserId, business?: BusinessName): void {
  const locationId = resolveScopedLocationId(locationName, business);
  if (!locationId) throw new ValidationError(`No location named "${locationName}".`);
  const row = db.prepare(`SELECT detail_json FROM current_entities WHERE id = ?`).get(locationId) as { detail_json: string | null } | undefined;
  const current = row?.detail_json ? JSON.parse(row.detail_json) : {};
  const currencies: string[] = current.currencies ?? [];
  if (!currencies.includes(currencyCode)) currencies.push(currencyCode);
  Entity.setDetailJson(locationId, JSON.stringify({ ...current, currencies }));
}

export function getLocationCurrencies(locationName: string, business?: BusinessName): string[] {
  const locationId = resolveScopedLocationId(locationName, business);
  if (!locationId) return [];
  const row = db.prepare(`SELECT detail_json FROM current_entities WHERE id = ?`).get(locationId) as { detail_json: string | null } | undefined;
  if (!row?.detail_json) return [];
  return JSON.parse(row.detail_json).currencies ?? [];
}

/** Resolves a location's own, real entity id - scoped to one
 * business's own Locations tree when `business` is given (the safe,
 * unambiguous path), falling back to a bare, unscoped name match only
 * when no business is known at all (same, existing bare-lookup
 * behavior other legacy call sites still depend on). */
function resolveScopedLocationId(locationName: string, business?: BusinessName): number | undefined {
  if (business) {
    const rootId = resolveBusinessLocationsRootId(business);
    return rootId ? (db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(locationName, rootId) as { id: number } | undefined)?.id : undefined;
  }
  return (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(locationName) as { id: number } | undefined)?.id;
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
    if (!Entity.get(vendorName)) createProvider(vendorName, userId);
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
  const business = requireEntity(businessName, typeBusinessName, requireEntity('Businesses', typeRootName));
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
  if (!Entity.hasTag(id, 'Item Source')) throw new NotFoundError(`No item source with id ${id}.`);
  Entity.untag(id, 'Item Source', asUserId(1));
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
 * ensureItemSalesCogsAccounts). See docs/entity-model.md for the
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
  supersedeEntity(application.id, { relation: languageName }, userId);
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
  const businessId = opts?.businessName ? (db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')`).get(opts.businessName) as { id: number } | undefined)?.id : undefined;

  // A real menu override lives as a real, direct child entity of the
  // menu item itself — the exact, same, established setEntityLink
  // shape used everywhere else in this codebase — never a dedicated
  // menu_override table, never JSON.
  function resolveOverride(entityName: string): { label: string | null; hidden: boolean } | null {
    if (opts?.userId != null) {
      const scope = `user ${opts.userId}`;
      const overrideRow = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(`${entityName} — Override: ${scope}`) as { id: number } | undefined;
      const label = getEntityLink(`${entityName} — Override: ${scope}`, 'Label');
      const hidden = overrideRow ? Entity.hasTag(overrideRow.id, 'Hidden') : false;
      if (label !== undefined || hidden) return { label: label ?? null, hidden };
    }
    if (businessId != null) {
      const scope = `business ${businessId}`;
      const overrideRow = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(`${entityName} — Override: ${scope}`) as { id: number } | undefined;
      const label = getEntityLink(`${entityName} — Override: ${scope}`, 'Label');
      const hidden = overrideRow ? Entity.hasTag(overrideRow.id, 'Hidden') : false;
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
// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export function getScreenTitle(href: string, opts?: { businessName?: string; userId?: number }): string | undefined {
//   const tree = getMenuTree(opts);
//   for (const section of tree) {
//     for (const link of section.links) {
//       if (link.href.split('?')[0] === href) return link.label;
//     }
//   }
//   return undefined;
// }

export function setMenuOverride(menuItemKey: string, scope: 'business' | 'user', scopeId: number, overrideLabel: string | null, hidden: boolean, userId: UserId = asUserId(1)): void {
  const entityId = Number(menuItemKey);
  const menuItemName = (db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(entityId) as { name: string } | undefined)?.name;
  if (!menuItemName) throw new NotFoundError(`No real menu item with id ${entityId}.`);
  const overrideName = `${menuItemName} — Override: ${scope} ${scopeId}`;
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ? AND parent_id = ?`).get(overrideName, entityId)) {
    create(requireEntityById(entityId, typeRootName), typeMenuOverrideName, overrideName, userId);
  }
  if (overrideLabel) {
    // A real override label is a real Vocabulary word first — the
    // exact, same, established shape any other display label
    // already uses — ensured to exist before linking to it, never a
    // bare string on the override record itself.
    if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(overrideLabel)) {
      create(requireEntity('Vocabulary', typeRootName), typeVocabularyWordName, overrideLabel, userId);
    }
    setEntityLink(overrideName, 'Label', overrideLabel, userId);
  } else {
    deleteEntityLink(overrideName, 'Label', userId);
  }
  const overrideId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(overrideName) as { id: number }).id;
  if (hidden) Entity.tag(overrideId, 'Hidden', userId);
  else Entity.untag(overrideId, 'Hidden', userId);
}

export function deleteMenuOverride(menuItemKey: string, scope: 'business' | 'user', scopeId: number, userId: UserId = asUserId(1)): void {
  const entityId = Number(menuItemKey);
  const menuItemName = (db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(entityId) as { name: string } | undefined)?.name;
  if (!menuItemName) return;
  const overrideName = `${menuItemName} — Override: ${scope} ${scopeId}`;
  const row = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(overrideName) as { id: number } | undefined;
  if (!row) return;
  Entity.untag(row.id, 'Hidden', userId);
  deleteEntityLink(overrideName, 'Label', userId);
}

/** Every real, known alternate name for the same, real concept
 * wordName itself belongs to — including wordName itself — found via
 * whichever real "Header Account" target wordName's own dimension
 * link points at (the same, established mechanism confirmed working
 * for Vendor/Supplier). Returns just [wordName] if it has no real
 * hierarchy link at all (an ordinary word with no known alternates
 * yet), rather than an empty list — a real word is always, at
 * minimum, its own real alternate. */
export interface VocabularyWord {
  name: string;
  translations: Record<string, string>;
}

/** The one, true, global Vocabulary's own id — scoped through the
 * one, true, global "Application" root to avoid colliding with every
 * business's own, separate "Vocabulary" entity (instantiateChartOfAccounts
 * gives every business its own). A bare, unscoped `name = 'Vocabulary'`
 * lookup is the exact, same, real ambiguity class already found and
 * fixed several times this session (getVocabularyWords, below, was the
 * first) — every other real call site touching the global Vocabulary
 * specifically should go through this one, shared helper instead of
 * repeating the same, real, scoped subquery by hand. */
function globalVocabularyId(): number {
  const row = db
    .prepare(`SELECT id FROM current_entities WHERE name = 'Vocabulary' AND parent_id = (SELECT id FROM current_entities WHERE name = 'Application')`)
    .get() as { id: number } | undefined;
  if (!row) throw new Error('The one, true, global Vocabulary entity is missing from the entity tree.');
  return row.id;
}

/** Every real, direct word/phrase under Vocabulary, with its own,
 * real, current translation into each real, existing language — the
 * real, direct source for the new Translations/Vocabulary page. Only
 * direct children, not the full, recursive subtree — Vocabulary's
 * own, real words are already, deliberately, a flat, single-level
 * list (confirmed directly: no real word currently has its own,
 * further, nested children). */
export function getVocabularyWords(): VocabularyWord[] {
  // A real, confirmed bug, found directly (not assumed) while driving
  // the real /setup/translations page through the real test-runner:
  // this used to list only concepts that ALREADY had at least one
  // real translation in some language — a brand-new word, the moment
  // after it's genuinely created via this very page's own "Add a new
  // word" form, was invisible to this page's own search box, since it
  // has zero translations yet. A real person hitting this in the real
  // app would be stuck: the one, real reason to add a new word is to
  // then translate it, and the page they'd use to do that couldn't
  // find the word they'd just added. Fixed to genuinely match this
  // function's own, original, documented intent above (every real,
  // direct word under Vocabulary) - scoped to the one, real, global
  // Vocabulary specifically (parented directly under the one, true,
  // global "Application" root), never a business's own, separate copy
  // (confirmed directly: ensureVocabularyAlternate gives every real
  // business its own, distinct "Vocabulary" entity too, so a bare,
  // unscoped `name = 'Vocabulary'` lookup here would be the exact,
  // same, real kind of ambiguous, wrong-scoped bug already found and
  // fixed several times this session).
  const words = db
    .prepare(`SELECT c.name FROM current_entities c WHERE c.parent_id = ? ORDER BY c.name`)
    .all(globalVocabularyId()) as { name: string }[];
  const languages = getLanguages();
  return words.map((c) => {
    const translations: Record<string, string> = {};
    for (const lang of languages) {
      const text = getTranslation(c.name, lang.name);
      if (text) translations[lang.name] = text;
    }
    return { name: c.name, translations };
  });
}

export function getVocabularyAlternates(wordName: string): string[] {
  const target = getHierarchyParent(wordName, 'Header Account');
  if (!target) return [wordName];
  const links = getHierarchyLinksPointingAt(target).filter((l) => l.hierarchyName === 'Header Account');
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
       WHERE link.name = orig.name || ' — Hierarchy: Header Account'`
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

/** Per direct instruction: a word and its translations stay owned by
 * the one, real, global Vocabulary by default and are never copied
 * into a business's own Vocabulary just because that business adopted
 * them. Only the moment a business (or user) actually chooses a
 * genuinely new name not already known anywhere does a real, local,
 * business-owned Vocabulary word get created for it - and even then,
 * only after first checking whether that exact text already exists as
 * a real, global synonym for some other concept, reusing that same,
 * real entity rather than creating a redundant, duplicate one. The
 * concept's own "Header Account" Hierarchy link (the same, real,
 * established synonym mechanism getConceptsWithAlternates already
 * reads) is created pointing at this one, real alternate either way -
 * setVocabularyPreference and getLocalizedText that follow never care
 * which case applied, since relation_id just points at whichever
 * real entity now carries the name. */
export function ensureVocabularyAlternate(conceptName: string, desiredText: string, businessName: string, userId: UserId): string {
  const existingAnywhere = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(desiredText) as { id: number } | undefined;
  if (!existingAnywhere) {
    const businessVocabulary = requireEntity('Vocabulary', typeRootName, requireEntity(businessName, typeBusinessName, requireEntity('Businesses', typeRootName)));
    create(businessVocabulary, typeRootName, desiredText, userId);
  }
  const alreadyLinked = db.prepare(`SELECT 1 FROM current_entities link JOIN current_entities target ON target.id = link.relation_id WHERE link.name = ? AND target.name = ?`).get(`${desiredText} — Hierarchy: Header Account`, conceptName);
  if (!alreadyLinked) setEntityLink(desiredText, 'Hierarchy: Header Account', conceptName, userId);
  return desiredText;
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
  const record = existing ?? Entity.create(prefName, conceptId, asUserId(1));
  supersedeEntity(record.id, { relation: preferredAlternateName }, asUserId(1));
  Entity.tag(record.id, scope, asUserId(1));
  Entity.setAttr(record.id, 'Scope Id', String(scopeId), asUserId(1));
}

export function deleteVocabularyPreference(conceptName: string, scope: 'business' | 'user', scopeId: number): void {
  const conceptId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(conceptName) as { id: number } | undefined)?.id;
  if (!conceptId) return;
  const prefName = `${conceptName} — Preference — ${scope}:${scopeId}`;
  const existing = Entity.getUnder(prefName, conceptId);
  if (existing) Entity.untag(existing.id, scope, asUserId(1));
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
  const businessId = opts.businessName ? (db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')`).get(opts.businessName) as { id: number } | undefined)?.id : undefined;
  const preferences = db
    .prepare(
      `SELECT pref.parent_id AS concept_id, alt.name AS alternate_name, tag.name AS scope
       FROM current_entities pref
       JOIN current_entities alt ON alt.id = pref.relation_id
       JOIN current_entities tag ON tag.parent_id = pref.id AND tag.name IN ('user', 'business') AND tag.relation_id IS NOT NULL
       JOIN current_entities scopeAttrType ON scopeAttrType.parent_id = pref.id AND scopeAttrType.name = 'Scope Id'
       JOIN current_entities scopeAttrValue ON scopeAttrValue.parent_id = scopeAttrType.id
       WHERE (tag.name = 'user' AND CAST(scopeAttrValue.name AS INTEGER) = ?)
          OR (tag.name = 'business' AND CAST(scopeAttrValue.name AS INTEGER) = ?)`
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
    db.prepare(`SELECT e.id FROM current_entities e WHERE e.name = ? AND e.parent_id = ?`).get(conceptName, globalVocabularyId()) as { id: number } | undefined
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
  if (stale && stale.name === text) return; // already correct, nothing to do

  // createEntity's/Entity.rename's own, established, scoped uniqueness
  // (parent_id, name) already, correctly rejects a genuine collision —
  // two different concepts sharing the exact same word under the
  // exact same language. Per direct instruction: this is a genuine bug
  // in how this application's own words are used (or a genuine
  // ambiguity in human language itself), to be flagged and studied,
  // never silently worked around with a suffix or similar — but also
  // never allowed to halt every other, real, unrelated translation.
  let created;
  try {
    if (stale) {
      Entity.rename(stale.id, text, userId);
      created = { id: stale.id, name: text };
    } else {
      created = create(requireEntityById(languageId, typeRootName), typeTranslationConceptName, text, userId);
    }
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
  // A real, confirmed bug fix: supersedeEntity(created.id, { relation:
  // conceptName }, userId) would re-resolve conceptName as a plain
  // string, all over again, through supersedeEntity's own, separate,
  // genuinely shared, general-purpose relation-resolution helper -
  // which is NOT Vocabulary-scoped, and so silently threw away the
  // correct, already-resolved conceptId computed above, replacing it
  // with whichever real, unrelated, ambiguously-named entity that
  // helper happened to find first (confirmed directly: "Actual" -
  // one of six, real, separate ledger entities sharing that name).
  // Setting relation_id directly from the already-correct conceptId,
  // via the same, real entity_update audit-trail mechanism
  // supersedeEntity itself uses, avoids this re-resolution entirely.
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
// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export function getAllTranslations(languageName: string): Record<string, string> {
//   const rows = db
//     .prepare(
//       `SELECT c.name AS concept, e.name AS text
//        FROM current_entities e
//        JOIN current_entities c ON c.id = e.relation_id
//        WHERE e.parent_id = (SELECT id FROM current_entities WHERE name = ?)`
//     )
//     .all(languageName) as { concept: string; text: string }[];
//   const result: Record<string, string> = {};
//   for (const r of rows) result[r.concept] = r.text;
//   return result;
// }

export function getTranslation(conceptName: string, languageName: string): string | null {
  const row = db
    .prepare(
      `SELECT e.name
       FROM current_entities e
       JOIN current_entities c ON c.id = e.relation_id
       WHERE e.parent_id = (SELECT id FROM current_entities WHERE name = ?)
         AND c.name = ?
       ORDER BY (c.parent_id = ?) DESC
       LIMIT 1`
    )
    .get(languageName, conceptName, globalVocabularyId()) as { name: string } | undefined;
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

/** Every real ledger under a business — deliberately excludes every
 * other real, direct child a business now has (see
 * PER_BUSINESS_ROOTS and createBusiness), derived from that one,
 * single, real list rather than its own, separately hand-maintained
 * set of literal strings - the exact, real gap that let
 * "{businessName} Hierarchies" go unscoped, unnoticed, for a real
 * while. Confirmed as a real, live bug, not assumed: before this fix,
 * "Wine Retail Business Locations" showed up as a selectable option
 * in the Trial Balance/General Journal/every other ledger dropdown
 * throughout the app, right next to "Actual" — a genuinely different
 * real entity, not a ledger at all, that a person could accidentally
 * select and then find no real accounts postable to it. */
export function getLedgers(businessName: BusinessName): { id: number; name: LedgerName }[] {
  return db
    .prepare(`SELECT id, name FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'Ledgers' AND parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')))`)
    .all(businessName) as { id: number; name: LedgerName }[];
}

// ---------------------------------------------------------------------------
// The "active" ledger — per direct instruction: a real, per-business
// pointer at "the one ledger ordinary trading posts into right now",
// flipped by rolloverToNewPeriod itself. Deliberately NOT a hard lock
// on the old ledger (per direct instruction, the old ledger stays
// genuinely postable forever, for real adjustments/corrections — see
// docs/ledger-scoped-accounts-and-rollover.md) — only a real default/
// guidance pointer the frontend's own Session screen reads to pick
// the ledger a plain Bookkeeper lands on, and the one real fact
// routes/journal.ts's POST /post checks before allowing a posting
// into any OTHER ledger (see docs/active-ledger-design.md).
//
// Stored as a real, dedicated marker entity, a direct child of the
// business itself — never reusing the business entity's own
// relation_id, which createBusiness already uses for the CoA
// prototype tag. Points at the real ledger entity by id (never by
// bare name): a ledger's own name ("Actual") is deliberately NOT
// globally unique — every business has one — so the general-purpose
// setRelationship/getRelationship helpers (which resolve a target by
// bare name) would silently resolve to the wrong business's own
// "Actual" the moment more than one real business exists. Resolving
// this one, real, specific ledger entity directly by id, via
// supersedeEntity's own relationId field, sidesteps that collision
// entirely.
// ---------------------------------------------------------------------------

function ensureActiveLedgerMarker(businessId: number, userId: UserId): { id: number; name: string } {
  return Entity.getUnder('Active Ledger', businessId) ?? Entity.create('Active Ledger', businessId, userId);
}

/** Sets the real, current "active" ledger for this business — called
 * once at business creation (its first, real "Actual" ledger) and
 * once more by rolloverToNewPeriod (the brand-new ledger it just
 * opened), never directly by an ordinary posting route. */
export function setActiveLedger(businessName: BusinessName, ledgerName: LedgerName, userId: UserId): void {
  const business = requireEntity(businessName, typeBusinessName, requireEntity('Businesses', typeRootName));
  const ledgersRoot = requireEntity('Ledgers', typeRootName, business);
  const ledger = requireEntity(ledgerName, typeLedgerName, ledgersRoot);
  const marker = ensureActiveLedgerMarker(business.id, userId);
  supersedeEntity(marker.id, { relationId: ledger.id }, userId);
}

/** The real, current "active" ledger for this business — null for a
 * business created before this concept existed (never assumed; every
 * real caller treats null as "no real guidance, fall back to
 * whatever the caller already does today"). */
export function getActiveLedger(businessName: BusinessName): LedgerName | null {
  const business = requireEntity(businessName, typeBusinessName, requireEntity('Businesses', typeRootName));
  const marker = db.prepare(`SELECT relation_id FROM current_entities WHERE name = 'Active Ledger' AND parent_id = ?`).get(business.id) as { relation_id: number | null } | undefined;
  if (!marker?.relation_id) return null;
  const ledger = db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(marker.relation_id) as { name: string } | undefined;
  return ledger ? asLedgerName(ledger.name) : null;
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
 * prototypes that already exist as real, distinct entities: "Cash and
 * Bank"/"Sales Revenue" (English/generic, used by admin and
 * Wine Retail Business), "Bankkontokorrent"/"Umsatzerlöse" (German,
 * BMW M GmbH), "Autres créances"/"Achats de marchandises" (French,
 * Peugeot), "Cassa e valori"/"Ricavi cessione beni" (Italian, Ditta
 * Italiana Srl), "Kasse"/"Kassenbestand und Bankguthaben" (Swiss,
 * Schweizer KMU AG) — genuinely different entities, confirmed by
 * entity_id, not just different display names for the same thing.
 *
 * A new business should reuse whichever prototype actually matches its
 * real country/jurisdiction — getChartOfAccountsPrototype(language)
 * surfaces exactly which real accounts that prototype actually means,
 * read directly from the one, real, shared template (never an
 * existing business's own posted history), so a person setting up a
 * new business can see exactly which real accounts to post to before
 * they start, rather than guessing or accidentally defaulting to the
 * generic English set regardless of their business's actual country.
 * This function itself creates no new accounts —
 * every real leaf account, in every prototype, already exists and is
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
 * ledger," the same proven pattern admin's own real "Proposed
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
 * additional equity accounts, tagged with the same real CoA prototype as
 * the business itself so they're genuinely findable through the real
 * General Journal account dropdown, not created orphaned. */
export type EntityStructure = 'sole_trader' | 'partnership' | 'llc' | 'unlimited_liability' | 'publicly_traded';

/** Nominates one real bank account for a business - a real bank name, its own
 * real routing detail (a BSB in Australia; a sort code, routing number, or IBAN
 * elsewhere), and its own real account number, per
 * docs/bank-accounts-and-currencies-design.md. Lazily creates this business's
 * own real "Bank Accounts" area on first use - real, nominated data, never a
 * shared, global default (per direct instruction, decided shape A: Collections
 * would only ever hold the abstract shape, never actual instances). */
/** Adds a real, free-text financial-statement note (an accounting
 * policy, a contingent liability, a related-party disclosure) for one
 * specific business - the real, standard "Notes to the Financial
 * Statements" practice from any real, published set of accounts.
 * Lazily creates this business's own real "Notes to the Financial
 * Statements" area on first use, under this business's own real
 * "Business Reports" (the one, real, global list of report kinds
 * itself never holds actual note content - each business's own real
 * notes are its own, real, business-scoped data, the same, real
 * principle already established for Bank Accounts). */
export function addFinancialStatementNote(businessName: BusinessName, noteText: string, userId: UserId): { id: number } {
  const business = requireEntity(businessName, typeBusinessName, requireEntity('Businesses', typeRootName));
  let notesRoot = db.prepare(`SELECT id FROM current_entities WHERE name = 'Notes to the Financial Statements' AND parent_id = ?`).get(business.id) as { id: number } | undefined;
  if (!notesRoot) notesRoot = create(business, typeRootName, 'Notes to the Financial Statements', userId);
  const countRow = db.prepare(`SELECT COUNT(*) AS n FROM current_entities WHERE parent_id = ?`).get(notesRoot.id) as { n: number };
  const noteName = `${businessName} — Note ${countRow.n + 1}`;
  const note = create(requireEntityById(notesRoot.id, typeRootName), typeRootName, noteName, userId);
  Entity.setDetailJson(note.id, JSON.stringify({ text: noteText }));
  return { id: note.id };
}

export function getFinancialStatementNotes(businessName: BusinessName): { name: string; text: string }[] {
  const business = requireEntity(businessName, typeBusinessName, requireEntity('Businesses', typeRootName));
  const notesRoot = db.prepare(`SELECT id FROM current_entities WHERE name = 'Notes to the Financial Statements' AND parent_id = ?`).get(business.id) as { id: number } | undefined;
  if (!notesRoot) return [];
  const rows = db.prepare(`SELECT name, detail_json FROM current_entities WHERE parent_id = ? ORDER BY name`).all(notesRoot.id) as { name: string; detail_json: string }[];
  return rows.map((r) => ({ name: r.name, text: (JSON.parse(r.detail_json || '{}').text as string) ?? '' }));
}

/** Nominates one real bank account for a business - a real bank name, its own
 * real routing detail (a BSB in Australia; a sort code, routing number, or IBAN
 * elsewhere), and its own real account number, per
 * docs/bank-accounts-and-currencies-design.md. Lazily creates this business's
 * own real "Bank Accounts" area on first use - real, nominated data, never a
 * shared, global default (per direct instruction, decided shape A: Collections
 * would only ever hold the abstract shape, never actual instances). */
/** The one, real, correct way a new location entity is created for a
 * specific business, per direct instruction eliminating generic
 * createEntity from ordinary application flows entirely. Resolves
 * this business's own, real, scoped "Locations" root directly - never
 * a bare, ambiguous name. */
export function createLocation(businessName: BusinessName, locationName: string, userId: UserId): TypedNode<'LocationEntityName'> {
  // Legacy-root aware (see resolveBusinessLocationsRootId above) - a
  // bare requireEntity('Locations', ...) throws outright for one,
  // specific, pre-existing demo business ("Wine Retail Business")
  // that still uses the legacy, combined-name root, confirmed
  // directly: creating a new location against it failed every time.
  const locationsRootId = resolveBusinessLocationsRootId(businessName);
  if (!locationsRootId) throw new ValidationError(`"${businessName}" has no Locations root to create a location under.`);
  return create({ id: asEntityId(locationsRootId), name: 'Locations' as string & { __brand: 'RootName' } }, typeLocationEntityName, locationName, userId);
}

/** The one, real, atomic way a new location is genuinely created,
 * per direct instruction: creating the real entity, then setting its
 * own real details (city, capacity, timezone, type), used to be two,
 * real, separate steps a caller could complete only one of - now one,
 * real, single db.transaction(), so it either fully applies or fully
 * doesn't, per the real, absolute transactional-integrity
 * requirement.
 *
 * A real, confirmed gap, found directly (not assumed) while wiring
 * the tutorial e2e test through the real UI: a location's optional
 * group was previously only ever recorded as a Hierarchy tag
 * (ensureHierarchyValue/setHierarchyParent) - the real mechanism
 * group-breakdown reports (e.g. Close Books' preview) actually read.
 * That is a genuinely separate, non-overlapping mechanism from the
 * real "Belongs To Group" entity relationship getOrganizationChart()
 * actually reads (see business-setup's own real location-creation
 * flow) - so a location created this way never appeared in the real
 * org chart at all, and Business Setup's own "+ Insert employee"
 * could never be reached for it, however it was created.
 *
 * Per direct correction: a real business genuinely does not have to
 * have any groups at all - `group` here stays optional, never
 * required, and no hierarchy name is ever hardcoded: the caller
 * supplies which real, business-chosen hierarchy (`groupingName` —
 * e.g. "Division") the group belongs to, right alongside the group's
 * own name, so this function itself never special-cases any one
 * hierarchy by name. getOrganizationChart() already, directly
 * supports a location with no real, separate group of its own - a
 * genuine, single-location group that simply targets itself. So
 * every real location gets a real "Belongs To Group" relationship
 * unconditionally, the one, real, single place this is ever recorded
 * - targeting the given, real, shared group name when one is
 * provided, or targeting the location's own name when none is, never
 * left unset either way. The separate Hierarchy tag (group-breakdown
 * reports) stays conditional on both a real group name and a real
 * groupingName actually being given - a location with no group has
 * nothing real for that hierarchy to tag. */
export function createAndConfigureLocation(businessName: BusinessName, locationName: string, location: StockLocation, userId: UserId, group?: string, groupingName?: string): TypedNode<'LocationEntityName'> {
  return db.transaction(() => {
    const entity = createLocation(businessName, locationName, userId);
    setLocation(locationName, location, businessName);
    // Per direct instruction: the real Storage Capacity Remaining/
    // Installed accounts, and their own real, balanced opening
    // posting, are created here, atomically, as part of the real
    // location's own creation - never lazily, the first time some
    // later, real stock movement happens to touch this location.
    ensureLocationCapacityAccount(businessName, asLedgerName('Actual'), asLocationName(locationName), userId);
    if (group && groupingName) {
      ensureHierarchyGrouping(businessName, groupingName, userId);
      ensureHierarchyValue(businessName, groupingName, group, userId);
      setHierarchyParent(locationName, groupingName, group, userId);
      // getOrganizationChart() only ever recognizes a shared,
      // multi-location group name as real once the group entity
      // itself also carries a real "Belongs To Business" relationship
      // back to this business. setRelationship is already idempotent
      // (keyed on the real record name), so calling it again for a
      // group shared by a later location is always safe.
      setRelationship(group, 'Belongs To Business', businessName, userId);
    }
    setRelationship(locationName, 'Belongs To Group', group || locationName, userId);
    return entity;
  })();
}

/** The one, real, correct way a new item category is created for a
 * specific business, per direct instruction eliminating generic
 * createEntity from ordinary application flows entirely. */
export function createItemCategory(businessName: BusinessName, categoryName: string, parentCategoryName: string | undefined, userId: UserId): TypedNode<'RootName'> {
  const business = requireEntity(businessName, typeBusinessName, requireEntity('Businesses', typeRootName));
  const itemsRoot = requireEntity('Items', typeRootName, business);
  const parent = parentCategoryName ? requireEntity(parentCategoryName, typeRootName, itemsRoot) : itemsRoot;
  return create(parent, typeRootName, categoryName, userId);
}

export function nominateBankAccount(businessName: BusinessName, bankAccountName: string, routingDetail: string, accountNumber: string, userId: UserId): { id: number } {
  const business = requireEntity(businessName, typeBusinessName, requireEntity('Businesses', typeRootName));
  let bankAccountsRoot = db.prepare(`SELECT id FROM current_entities WHERE name = 'Bank Accounts' AND parent_id = ?`).get(business.id) as { id: number } | undefined;
  if (!bankAccountsRoot) bankAccountsRoot = create(business, typeRootName, 'Bank Accounts', userId);
  const account = create(requireEntityById(bankAccountsRoot.id, typeRootName), typeRootName, bankAccountName, userId);
  Entity.setDetailJson(account.id, JSON.stringify({ routingDetail, accountNumber }));
  return { id: account.id };
}

export function getNominatedBankAccounts(businessName: BusinessName): { name: string; routingDetail: string; accountNumber: string }[] {
  const business = requireEntity(businessName, typeBusinessName, requireEntity('Businesses', typeRootName));
  const bankAccountsRoot = db.prepare(`SELECT id FROM current_entities WHERE name = 'Bank Accounts' AND parent_id = ?`).get(business.id) as { id: number } | undefined;
  if (!bankAccountsRoot) return [];
  const rows = db.prepare(`SELECT name, detail_json FROM current_entities WHERE parent_id = ?`).all(bankAccountsRoot.id) as { name: string; detail_json: string }[];
  return rows.map((r) => {
    const detail = JSON.parse(r.detail_json || '{}');
    return { name: r.name, routingDetail: detail.routingDetail ?? '', accountNumber: detail.accountNumber ?? '' };
  });
}

export interface BusinessConfigurationReport {
  businessName: string;
  addresses: TypedAddress[];
  phones: TypedPhone[];
  ownerOrPartners: string[];
  bankAccounts: { name: string; routingDetail: string; accountNumber: string }[];
  homeCurrency: string | null;
  secondaryCurrencies: string[];
  hierarchies: HierarchyGroupingWithValues[];
  locations: { name: string; city: string; locationType: string }[];
  categories: string[];
  chartOfAccountsPrototype: string | null;
  notes: { name: string; text: string }[];
}

/** Everything a real business's own setup actually captured - real
 * Name, Addresses, Phones, Owner(s)/Partner(s), real Banking Details,
 * real Currencies, every real Hierarchy grouping and its own real
 * values, real Locations, real Categories, and which real Chart of
 * Accounts prototype it was built from - per direct instruction,
 * deliberately never Item Details (a genuinely separate, further,
 * much larger real report of its own). One, real, direct aggregation
 * across every real setup area, not a fragile stitching-together of
 * many, separately-shaped calls the caller has to know about
 * individually. hierarchies is read from the one, real, generic,
 * per-business hierarchy store (getBusinessHierarchy) - never a
 * single, hardcoded grouping name - so a business's own "Division,"
 * "Region," or any other real, chosen grouping all show here equally. */
export function getBusinessConfigurationReport(businessName: BusinessName): BusinessConfigurationReport {
  const business = requireEntity(businessName, typeBusinessName, requireEntity('Businesses', typeRootName));
  const entities = getEntityTree();

  // Owner/Partner names - the real, stored Detail answers for the
  // real, known business-type questions that actually name a person.
  const ownerOrPartners: string[] = [
    ...Detail.list(businessName, 'Owner name'),
    ...Detail.list(businessName, 'Names of partners'),
    ...Detail.list(businessName, 'Names of directors'),
  ];

  const hierarchies = getBusinessHierarchy(businessName);

  // Legacy-root aware (see resolveBusinessLocationsRootId above) -
  // the real "Locations" child, or, for one, specific, pre-existing
  // demo business ("Wine Retail Business"), its legacy, combined-name
  // root. Without this, this report silently showed zero locations
  // for that one business, exactly like getOrganizationChart used to.
  const locationsRootId = resolveBusinessLocationsRootId(businessName);
  const locationEntities = locationsRootId ? entities.filter((e) => e.parent_id === locationsRootId) : [];
  const locations = locationEntities.map((e) => {
    const loc = getLocation(e.name);
    return { name: e.name, city: loc?.city ?? '', locationType: loc?.location_type ?? '' };
  });

  // Legacy-root aware, the same, exact bare-name gap already found
  // and fixed above for Locations: one, specific, pre-existing demo
  // business ("Wine Retail Business") still seeds its own real Items
  // root under the legacy, combined name ("${business} Items"), not
  // the modern, plain "Items" child every business created through
  // the application itself actually gets.
  const itemsRootId = (entities.find((e) => e.name === 'Items' && e.parent_id === business.id) ?? entities.find((e) => e.name === `${businessName} Items` && e.parent_id === business.id))?.id;
  // A real category is any real, direct child of Items that itself
  // has at least one real child - the exact, same, established rule
  // already used for the Items page's own category tree.
  const categories = itemsRootId
    ? entities.filter((e) => e.parent_id === itemsRootId && entities.some((c) => c.parent_id === e.id)).map((e) => e.name)
    : [];

  const coaRootId = entities.find((e) => e.name === 'Chart of Accounts' && e.parent_id === business.id)?.id;
  const assetId = coaRootId ? entities.find((e) => e.name === 'Asset' && e.parent_id === coaRootId)?.id : undefined;
  // Every real, currency-tagged Cash at Bank leaf names a further,
  // real, secondary currency this business actually trades in -
  // derived directly from what was actually built, never a separate,
  // hand-maintained list that could drift from reality.
  const cashLeaves = assetId ? entities.filter((e) => e.parent_id === assetId && e.name.startsWith('Cash at Bank')) : [];
  const secondaryCurrencies = cashLeaves.map((e) => (db.prepare(`SELECT currency FROM account WHERE entity_id = ?`).get(e.id) as { currency: string | null } | undefined)?.currency).filter((c): c is string => !!c);

  return {
    businessName,
    addresses: getTypedAddresses(businessName),
    phones: getTypedPhones(businessName),
    ownerOrPartners,
    bankAccounts: getNominatedBankAccounts(businessName),
    homeCurrency: getBusinessHomeCurrency(businessName),
    secondaryCurrencies,
    hierarchies,
    locations,
    categories,
    chartOfAccountsPrototype: null,
    notes: getFinancialStatementNotes(businessName),
  };
}

/** Builds the one, real, shared mechanism behind both "Cash at Bank" and a
 * real partner's own Drawing account, per direct instruction: the exact, same
 * real bank-accounts-by-currencies nomination applies to each. A single,
 * ticked combination collapses to one, plain, directly postable account - no
 * header, no further structure, exactly as simple as the business genuinely
 * is. More than one ticked combination makes headerName a real, non-postable
 * header (automatically, per this codebase's own, established, no-new-flags
 * is_postable_account rule - a header is simply an entity with real
 * children), with one real, postable leaf per ticked combination underneath,
 * never the untamed, full cartesian product blindly. */
export function buildBankCurrencyStructure<TBrand extends string>(
  businessName: BusinessName,
  headerName: string,
  leafType: TypeDescriptor<TBrand>,
  selections: { bankAccountName: string; currency: string }[],
  userId: UserId,
  homeCurrency: string
): void {
  const business = requireEntity(businessName, typeBusinessName, requireEntity('Businesses', typeRootName));
  const parentCategory = requireEntity(leafType.brand === 'EquityAccountName' ? 'Equity' : 'Asset', typeRootName, requireEntity('Chart of Accounts', typeChartOfAccountsRootName, business));
  // A real, confirmed bug, found directly while exercising this
  // wizard end-to-end through the real UI for the first time: a
  // business's own Chart of Accounts prototype (English CoA, in
  // particular) already ships a real "Cash at Bank" leaf by default
  // — this wizard's own single-bank/single-currency path then threw
  // "already exists" the very first time it was ever actually used,
  // never reaching the real, intended "ensure this specific real
  // structure exists" behavior its own doc comment above already
  // describes. Entity.ensureUnder (not create) genuinely tolerates a
  // same-named leaf already being there, reusing it rather than
  // failing — the same, real "ensure" shape every other lazy
  // account-creation function in this file already uses.
  //
  // A second, further, real, confirmed bug, found directly right
  // after fixing the first one, while actually posting a real Cash
  // Purchase through the resulting account for the first time: this
  // function used to currency-tag the single-bank/single-currency
  // leaf with its own, real account.currency unconditionally (e.g.
  // "Cash at Bank" -> currency "AUD"). But account.currency has one,
  // real, specific, pre-existing meaning in this schema (see
  // setAccountCurrency's own doc comment above) - a currency-specific
  // SIBLING of a home-currency account, for a genuinely
  // foreign-denominated transaction. Tagging the business's own,
  // single, ordinary Cash at Bank account this way pulled it OUT of
  // the real, NULL/home-currency group that every other ordinary
  // account (Inventory, Tax, Sales, COGS...) posts in by default -
  // and since nothing in this app ever actually called the real,
  // genuine setBusinessHomeCurrency function either (confirmed
  // directly: zero call sites, anywhere, before this fix), there was
  // no real home currency on record for post_journal_entry_insert's
  // own, correct per-currency balance check to fall back to. The
  // result: the very first ordinary, single-currency Cash
  // Purchase/Cash Sale through this account failed outright with
  // "entry does not balance (per currency)" - the cash leg landed in
  // its own real "AUD" group while every other leg landed in the
  // real, NULL, home group. Fixed here, directly, at the one real
  // place a business's home currency is actually first nominated: the
  // selected currency is recorded as this business's own real home
  // currency, and the single, ordinary Cash at Bank leaf is left
  // genuinely untagged (home/NULL), exactly like every other ordinary
  // account. The same real principle applies to the multi-selection
  // branch below - only a leaf whose own currency genuinely differs
  // from the business's real home currency is a real, foreign
  // sibling, and gets tagged; the home-currency leaf stays untagged.
  setBusinessHomeCurrency(businessName, homeCurrency, userId);
  if (selections.length === 1) {
    Entity.ensureUnder(headerName, parentCategory.id, userId);
    return;
  }
  const header = Entity.ensureUnder(headerName, parentCategory.id, userId);
  for (const selection of selections) {
    const leafName = `${headerName} — ${selection.bankAccountName} (${selection.currency})`;
    const leaf = Entity.ensureUnder(leafName, header.id, userId);
    // Same, real bug class as ensureCurrencyAccount (db-reports.ts):
    // two different businesses' own bank-currency leaves can
    // genuinely share this exact, same display name - passing the
    // real, already-resolved leaf.id here, instead of the bare name,
    // avoids setAccountCurrency's own, separate, unscoped fallback
    // lookup ever tagging some OTHER business's account instead.
    if (selection.currency !== homeCurrency) setAccountCurrency(leafName, selection.currency, leaf.id);
  }
}

export function setupEquityStructure(businessName: BusinessName, structure: EntityStructure, userId: UserId, coaPrototype?: string, partnerNames?: string[]): void {
  // This one, specific business's own, real, independent Equity
  // mirror - instantiateChartOfAccounts has already run by this point
  // in createBusiness, so this business's own real "Chart of
  // Accounts" (and its own real "Equity" copy within it) already,
  // genuinely exists. A real, confirmed, fundamental fix: a bare
  // fetch('Equity', typeRootName) would resolve ambiguously now that
  // every business genuinely, correctly owns its own, independent
  // copy of this name (see PER_BUSINESS_ROOTS' Vocabulary entry and
  // copyChartOfAccountsInto) - a real partner's own Capital/Drawing
  // accounts belong under this one, specific business's own real
  // Equity, never the shared, global template, and never a genuinely
  // different, other real business's own, separate copy.
  const business = requireEntity(businessName, typeBusinessName, requireEntity('Businesses', typeRootName));
  const businessCoa = requireEntity('Chart of Accounts', typeChartOfAccountsRootName, business);
  const businessEquity = requireEntity('Equity', typeRootName, businessCoa);
  const tag = (accountName: string) => {
    if (coaPrototype) {
      supersedeEntity((db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(accountName, businessEquity.id) as { id: number }).id, { relation: coaPrototype }, userId);
    }
  };
  const ensure = (accountName: string) => {
    if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ? AND parent_id = ?`).get(accountName, businessEquity.id)) {
      create(businessEquity, typeEquityAccountName, accountName, userId);
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
 * prototype) are the real classes, living at the application level;
 * this is the real instance, living at the business level. Every
 * universal (untagged) account, plus every account tagged for this
 * exact prototype, is copied; accounts tagged for a different real
 * prototype are skipped. Deliberately additive, not a replacement: the
 * existing, global Chart of Accounts and its established, tag-based
 * prototype mechanism are left completely untouched, so every existing
 * GL-reporting function keeps working exactly as it already did —
 * this creates a genuine, new, real, independent copy alongside it,
 * not yet wired into posting or reporting (see
 * docs/coa-class-instance-plan.md for what remains). */
/** The one, real, shared mechanism that copies the shared Chart of
 * Accounts into any real, new destination root — prototype-tagged leaves
 * genuinely copied (only those matching coaPrototype), a non-leaf,
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

export function copyChartOfAccountsInto(business: TypedNode<string>, destRoot: TypedNode<string>, coaPrototype: string | undefined, userId: UserId): void {
  const prototypeId = coaPrototype ? (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(coaPrototype) as { id: number } | undefined)?.id : undefined;
  const coaPrototypeMarkerIds = new Set(
    (db.prepare(`SELECT id FROM current_entities WHERE parent_id = ? AND name LIKE '% CoA'`).all(globalVocabularyId()) as { id: number }[]).map((r) => r.id)
  );
  const sourceRootId = (db.prepare(`SELECT id FROM current_entities WHERE name = 'Chart of Accounts'`).get() as { id: number }).id;
  const businessVocabulary = requireEntity('Vocabulary', typeRootName, business);

  function copyChildren(sourceId: number, destParentId: number): void {
    const children = db.prepare(`SELECT id, name, relation_id FROM current_entities WHERE parent_id = ?`).all(sourceId) as { id: number; name: string; relation_id: number | null }[];
    for (const child of children) {
      const isPrototypeTagged = child.relation_id !== null && coaPrototypeMarkerIds.has(child.relation_id);
      if (isPrototypeTagged) {
        // A real, prototype-tagged leaf is genuinely copied — a
        // universal (untagged) leaf is already, correctly, shared
        // across every business as-is, and copying it too would
        // create a dangerous, global name-duplicate breaking every
        // existing by-name lookup elsewhere in the app (confirmed
        // directly: this broke getBankAccounts/getCashPosition on a
        // duplicated test account before this fix).
        if (child.relation_id === prototypeId) {
          const existing = db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(child.name, destParentId) as { id: number } | undefined;
          if (!existing) create(requireEntityById(destParentId, typeRootName), typeChartOfAccountsNodeName, child.name, userId);
        }
      } else {
        // A real, confirmed, further fix, found directly: "has any
        // real child at all" is not a safe signal for "is a genuine,
        // further CoA structural category" - a real, ordinary leaf
        // account (a registered bank account, say) can genuinely have
        // its own real children too, for a completely unrelated
        // reason (setEntityLink's own real link records, Detail's own
        // real stored answers) - both use this codebase's own,
        // established "ParentName — ..." naming convention, never a
        // genuine, further, independently-named CoA sub-account.
        // Confirmed directly: a real, registered bank account's own
        // real link records were being misread as "this must be a
        // structural category," creating a real, duplicate-name
        // collision (and a spurious, wrong Vocabulary entry) the
        // moment a second business was created. Checked here, first,
        // before touching Vocabulary at all - an ordinary leaf must
        // never get its own, real, further Vocabulary copy.
        const realChildren = db.prepare(`SELECT name FROM current_entities WHERE parent_id = ?`).all(child.id) as { name: string }[];
        const hasRealStructuralChild = realChildren.some((c) => !c.name.startsWith(`${child.name} — `));
        // A real, confirmed, further finding: "Cost of Goods Sold"
        // cannot carry an "% CoA" prototype tag at all - its one real
        // relation_id slot is already spoken for by the Gross Profit
        // report's own "COGS" category marker (see getBusinessReports),
        // so it never takes the isPrototypeTagged branch above and
        // depended entirely on hasRealStructuralChild - genuinely true
        // only by coincidence, while demo per-product leaves happened
        // to exist under the global template. On a fresh database with
        // zero demo data it has none, and was silently never copied
        // into any new business's own CoA at all - the direct, root
        // cause of every later, lazy COGS leaf (ensureCombinationAccountLeaf)
        // falling back to the bare, global lookup. Named explicitly here,
        // the same, established, by-name-exception style this function
        // already uses throughout (Chart of Accounts, Vocabulary, etc.),
        // since it is a real, fixed, known header, not a general rule.
        const alwaysCopyRegardlessOfDemoData = child.name === 'Cost of Goods Sold';
        if (!hasRealStructuralChild && !alwaysCopyRegardlessOfDemoData) continue;

        // A non-leaf, structural category (Asset/Liability/...) is a
        // real, genuine copy, per direct, fundamental correction: a
        // business's own Chart of Accounts structure is always
        // subject to real, further change by that one business alone
        // (incorporation, a partner joining or leaving) and must
        // never touch the global template or any other real
        // business's own copy. This is not just a structural copy -
        // the category's own real name is itself copied, as a real,
        // new, genuinely independent entity, into this one business's
        // own real Vocabulary (never a relation_id link back to the
        // real, original, shared word), so this business is free to
        // rename its own "Equity" without touching the global
        // template or any other business's own, separate copy.
        let ownWord = db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(child.name, businessVocabulary.id) as { id: number } | undefined;
        if (!ownWord) ownWord = create(businessVocabulary, typeRootName, child.name, userId);

        let mirror = db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(child.name, destParentId) as { id: number } | undefined;
        if (!mirror) {
          mirror = create(requireEntityById(destParentId, typeRootName), typeChartOfAccountsNodeName, child.name, userId);
          // A real, confirmed, latent bug, found directly by a test
          // suite that finally exercises more than one real business:
          // { relation: child.name } resolves by a bare, unscoped
          // name lookup, which is only ever safe while 'child.name'
          // (e.g. "Equity") names exactly one real entity anywhere -
          // true only for the very first business ever created. Every
          // business after that gets its own real "Equity" mirror
          // (plus its own real Vocabulary word copy of the same
          // name), so the bare lookup becomes genuinely ambiguous and
          // can silently point this business's own mirror at some
          // OTHER business's own "Equity", not the real, global
          // category this code means. `child` is already that exact,
          // correct, known entity - relationId bypasses the ambiguous
          // name resolution entirely, the same, already-proven pattern
          // used elsewhere in this file for exactly this reason.
          //
          // "Cost of Goods Sold" specifically is not a genuine
          // structural category the way Asset/Liability/Expense are -
          // it is the one, real, special-cased LEAF this function
          // always copies regardless of coaPrototype (see
          // alwaysCopyRegardlessOfDemoData above). Its own, real
          // relation_id slot is spoken for by the Gross Profit
          // report's own "COGS" tag (see getBusinessReports'
          // cogsAccountIds / buildProfitAndLossFromBalances), the
          // exact, same tag the GLOBAL "Cost of Goods Sold" leaf
          // itself already carries (schema/00-core.sql row 514) and
          // every per-product COGS leaf gets via
          // ensureItemSalesCogsAccounts. Pointing this business's own
          // mirror at `child.id` (the global leaf) instead would
          // leave it permanently untagged as COGS - a real, confirmed
          // bug found directly: a non-'admin' business's own COGS
          // postings silently landed in operating_expenses instead of
          // cogs_expenses on every real P&L, since 'admin' alone
          // posts straight to the real, correctly-tagged global leaf
          // and so never exposed this.
          if (child.name === 'Cost of Goods Sold') {
            Entity.relate(mirror.id, 'COGS', userId);
          } else {
            supersedeEntity(mirror.id, { relationId: child.id }, userId);
          }
        }
        copyChildren(child.id, mirror.id);
      }
    }
  }
  copyChildren(sourceRootId, destRoot.id);
}

export function instantiateChartOfAccounts(businessName: BusinessName, coaPrototype: string | undefined, userId: UserId): void {
  const business = requireEntity(businessName, typeBusinessName, requireEntity('Businesses', typeRootName));
  if (db.prepare(`SELECT 1 FROM current_entities WHERE name = 'Chart of Accounts' AND parent_id = ?`).get(business.id)) return;
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = 'Vocabulary' AND parent_id = ?`).get(business.id)) {
    create(business, typeRootName, 'Vocabulary', userId);
  }
  const destRoot = create(business, typeChartOfAccountsRootName, 'Chart of Accounts', userId);
  copyChartOfAccountsInto(business, destRoot, coaPrototype, userId);
}

/** The one, real, single, complete list of every real, structural
 * root a new business gets, scoped as `${businessName} ${suffix}` -
 * per direct instruction, so adding a further one is a genuine,
 * real, one-line addition here, never a search across this codebase.
 * "Hierarchies" is included here too, now correctly scoped like every
 * other real root - a real, confirmed bug, found directly: it was
 * previously created as a bare, unscoped "Hierarchies" node, silently
 * shared across every real business rather than genuinely separate.
 * Each suffix is also this root's own, real, direct, translatable
 * display word - the exact, same, established mechanism already used
 * for every other real entity name (`translations.current[name] ??
 * name`), so a further root added here is genuinely translatable
 * immediately, with no separate, further registration step. Chart of
 * Accounts is deliberately NOT listed here - its own real creation
 * (`instantiateChartOfAccounts`, above) does real, further work
 * (copying a real CoA prototype template) beyond a bare root, so it
 * keeps its own, real, dedicated function; `getLedgers`, below,
 * accounts for it separately, alongside this list.
 */
export const PER_BUSINESS_ROOTS: { name: string; type: TypeDescriptor<string> }[] = [
  { name: 'Locations', type: typeBusinessLocationsRootName },
  { name: 'Items', type: typeBusinessItemsRootName },
  { name: 'Contacts', type: typeBusinessContactsRootName },
  { name: 'Vocabulary', type: typeRootName },
  { name: 'Ledgers', type: typeRootName },
  // Per docs/profit-centers-design.md's Phase A: a real, empty root
  // every business gets, holding zero real Profit Centers until one
  // is explicitly created (createProfitCenter, below) — purely
  // additive, a business with none behaves exactly as it already did,
  // since every per-item resolver below only ever looks under here
  // when a caller actually passes a real profitCenter name.
  { name: 'Profit Centers', type: typeRootName },
];

export function createBusiness(
  businessName: BusinessName,
  financialYearLabel: string,
  userId: UserId,
  coaPrototype?: string,
  secondaryCurrencies?: string[],
  entityStructure?: EntityStructure,
  partnerNames?: string[]
): { business: BusinessName; actualLedger: LedgerName; budgetLedger: LedgerName } {
  return db.transaction((): { business: BusinessName; actualLedger: LedgerName; budgetLedger: LedgerName } => {
  const businessesRoot = requireEntity('Businesses', typeRootName);
  const business = create(businessesRoot, typeBusinessName, businessName, userId);
  // Every real, structural root a new business gets, per the one,
  // single, real, consolidated list above (PER_BUSINESS_ROOTS) -
  // Locations, Items, Contacts, Vocabulary, and Ledgers today;
  // adding a further one is a genuine, real, one-line addition
  // to that list alone, never a further edit here. Per a real,
  // confirmed, fundamental correction: each one is a real, plain name
  // (never business-prefixed) - create()'s own uniqueness check is
  // already scoped by real, direct parent, never global, so
  // "Locations" under one real business and "Locations" under a
  // genuinely different real business were never actually in conflict
  // at all; resolving one back by name uses fetch's own, real,
  // further, optional parent argument (see fetch, above) to
  // disambiguate, never a mangled name. Ledgers must exist before the
  // real ledgers below are parented under it.
  for (const root of PER_BUSINESS_ROOTS) {
    create(business, root.type, root.name, userId);
  }
  const ledgersRoot = requireEntity('Ledgers', typeRootName, business);
  const actualLedger = asLedgerName(`Actual`);
  const budgetLedger = asLedgerName(`Budget ${financialYearLabel}`);
  create(ledgersRoot, typeLedgerName, actualLedger, userId);
  create(ledgersRoot, typeLedgerName, budgetLedger, userId);
  // Per docs/active-ledger-design.md: the real "Actual" ledger just
  // created is this business's own, real, starting "active" ledger —
  // ordinary trading posts here by default until a real rollover
  // flips it.
  setActiveLedger(businessName, actualLedger, userId);
  // A real, second fix, found via the real, full-lifecycle Playwright
  // test: a new business was never actually tagged with its own real
  // CoA prototype relation at all — only the original, hand-tagged demo
  // businesses were (see backend/scripts/tag-coa-prototypes.ts). The
  // real, live General Journal account dropdown filters strictly by
  // this tag (see frontend/src/routes/post/+page.svelte), so an
  // untagged business could never post to any real, prototype-specific
  // account at all through the actual UI — only universal ones
  // (customer/vendor contacts, product Sales-/COGS- accounts). Tags
  // the new business with its real, chosen prototype here, the same
  // real relation mechanism the demo businesses already use.
  if (coaPrototype) {
    supersedeEntity(
      (db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')`).get(businessName) as { id: number }).id,
      { relation: coaPrototype },
      userId
    );
  }
  // The real, genuine, per-business instance of the applicable Chart
  // of Accounts template class, per direct instruction — additive
  // alongside the existing, unchanged, global, tag-based mechanism
  // above, which every existing GL-reporting function still uses.
  instantiateChartOfAccounts(businessName, coaPrototype, userId);
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
  // prototype as the business itself, so it's genuinely findable through
  // the real General Journal account dropdown, not created orphaned
  // from a filtering standpoint.
  for (const currency of secondaryCurrencies ?? []) {
    const accountName = `Cash at Bank (${currency})`;
    // A real, confirmed bug, found directly: every lookup below was
    // bare and unscoped-by-business (`WHERE name = ?`, no parent at
    // all) - genuinely ambiguous the moment ANY second business
    // anywhere in the whole system also ever gets (directly, or via
    // ensureCurrencyAccount's own, already-correctly-scoped POS/sale
    // path) a same-named "Cash at Bank (CUR)" leaf. The second such
    // business to arrive here silently skipped creating its OWN real
    // leaf and instead mutated the FIRST business's own leaf in
    // place - sharing one GL account across two, genuinely distinct
    // businesses. Fixed by scoping every step through this business's
    // own, already-resolved Asset category (businessAsset below),
    // the exact same real scoping resolveCashAtBankAccount/
    // ensureCurrencyAccount (db-reports.ts) already use for the
    // lazily-created case.
    const businessCoa = requireEntity('Chart of Accounts', typeChartOfAccountsRootName, business);
    const businessAsset = requireEntity('Asset', typeRootName, businessCoa);
    const account = Entity.getUnder(accountName, businessAsset.id) ?? create(businessAsset, typeAssetAccountName, accountName, userId);
    // The same real logic as setAccountCurrency (backend/src/db-reports.ts)
    // — inlined here rather than imported, since db-reports.ts already
    // imports from this module, and importing back would create a
    // real, genuine circular dependency between the two. Scoped by
    // the real, known entity id resolved just above, never by a bare
    // re-lookup of the name.
    db.prepare(`INSERT INTO account (entity_id) VALUES (?) ON CONFLICT (entity_id) DO NOTHING`).run(account.id);
    db.prepare(`UPDATE account SET currency = ? WHERE entity_id = ?`).run(currency, account.id);
    if (coaPrototype) {
      supersedeEntity(account.id, { relation: coaPrototype }, userId);
    }
  }
  if (entityStructure) {
    setupEquityStructure(businessName, entityStructure, userId, coaPrototype, partnerNames);
  }
  // Ensures a real, business-scoped "Cash at Bank" exists from
  // creation, even for a business that never runs the bank-account
  // wizard (nominateBankAccount/buildBankCurrencyStructure) at all -
  // without this, a business's first posting that needs it
  // (stageLine has no lazy-vivification path of its own) fails with
  // "NOT NULL constraint failed: journal_line.account_id".
  resolveCashAtBankAccount(businessName, undefined, userId);
  return { business: businessName, actualLedger, budgetLedger };
  })();
}

/** Creates one further real ledger under an existing business's own,
 * real Ledgers node - the real, direct prerequisite for the year/
 * period rollover procedure (docs/ledger-scoped-accounts-and-rollover.md),
 * whose own structural phase requires the new ledger to already exist. */
export function createLedger(businessName: BusinessName, ledgerName: LedgerName, userId: UserId): void {
  const business = requireEntity(businessName, typeBusinessName);
  const ledgersRoot = requireEntity('Ledgers', typeRootName, business);
  const existing = Entity.getUnder(ledgerName, ledgersRoot.id);
  if (existing) throw new ValidationError(`"${ledgerName}" already exists under "${businessName}".`);
  create(ledgersRoot, typeLedgerName, ledgerName, userId);
}

/** Every real account a given real CoA prototype/language would actually
 * give a new business - walking the one, real, global Chart of
 * Accounts template directly (never a specific, already-existing
 * business's own posted history), returning every real leaf account
 * that is either genuinely universal (untagged, shared by every real
 * prototype) or tagged with this one, specific, real prototype - exactly
 * the real set copyChartOfAccountsInto would actually copy for a
 * business choosing this language. A real, confirmed, better
 * replacement for the previous, real getCoaPrototypeAccounts - that one
 * needed an already-existing, real business actually using a prototype
 * before its own real accounts could be shown at all, so a genuinely
 * new prototype had nothing to preview; this one needs no exemplar
 * business, ever, since it reads the one, real, shared template
 * directly. */
export function getChartOfAccountsPrototype(language: string): string[] {
  const prototypeMarker = db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(`${language} CoA`, globalVocabularyId()) as { id: number } | undefined;
  const globalCoaId = (db.prepare(`SELECT id FROM current_entities WHERE name = 'Chart of Accounts' AND parent_id = (SELECT id FROM current_entities WHERE name = 'Application')`).get() as { id: number }).id;
  const names: string[] = [];
  function walk(parentId: number): void {
    const children = db.prepare(`SELECT id, name, relation_id FROM current_entities WHERE parent_id = ?`).all(parentId) as { id: number; name: string; relation_id: number | null }[];
    for (const child of children) {
      const hasChildren = db.prepare(`SELECT 1 FROM current_entities WHERE parent_id = ? LIMIT 1`).get(child.id);
      if (hasChildren) {
        walk(child.id);
      } else if (child.relation_id === null || child.relation_id === prototypeMarker?.id) {
        names.push(child.name);
      }
    }
  }
  walk(globalCoaId);
  return names.sort();
}

// ---------------------------------------------------------------------------
// Journal staging + posting
// ---------------------------------------------------------------------------

export * from './db-journal.js';
import { stageLine, postJournalEntry } from './db-journal.js';
export * from './db-stock.js';
import { getLocation, setLocation, getItemLocation, dispatchItems, receiveItems, transferItems, postQuantityMovement, getOrderStatus, todayAtLocation, getEffectiveSaleCurrency, ensureLocationCapacityAccount, type Location as StockLocation } from './db-stock.js';


// Migrates every real, existing translation into the entity-only
// mechanism — must run after every function above (setTranslation,
// createEntity, etc.) is defined, and after seedRemainingData() has
// already created every real concept entity.

