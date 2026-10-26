// Documented in docs/pm-entity-model.md ("backend/src/db.ts — the data
// model, write primitives, and the Hierarchy/Product cartesian
// mechanism") and docs/pm-domain-reference.md (the domain-level
// sections below "A live, generated snapshot") - this file carries no
// further multiline comments.
import { Database } from './sqlite-runtime.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hashPassword, verifyPassword } from './password.js';
import { Entity, Detail } from './primitives.js';
import { getLedgerBalances, ensureCurrencyAccount, resolveCashAtBankAccount, setAccountCurrency } from './db-reports.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DB_PATH ?? path.join(dataDir, 'entities.sqlite');
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
  const schemaDir = path.join(__dirname, '..', 'schema');
  const readSchema = (f: string) => fs.readFileSync(path.join(schemaDir, f), 'utf8');

  db.exec(readSchema('00-core.sql'));

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

export class ValidationError extends Error {}
export class NotFoundError extends Error {}

export const typeBusinessName: TypeDescriptor<'BusinessName'> = { brand: 'BusinessName' };
export const typeEmployeeName: TypeDescriptor<'EmployeeName'> = { brand: 'EmployeeName' };
export const typeProviderName: TypeDescriptor<'ProviderName'> = { brand: 'ProviderName' };
export const typeCustomerName: TypeDescriptor<'CustomerName'> = { brand: 'CustomerName' };
export const typeCategoryOrItemsRootName: TypeDescriptor<'CategoryOrItemsRootName'> = {
  brand: 'CategoryOrItemsRootName',
  validate: (name) => isGenuineCategoryOrItemsRoot(name),
};
export const typeItemName: TypeDescriptor<'ItemName'> = { brand: 'ItemName' };
export const typeRootName: TypeDescriptor<'RootName'> = { brand: 'RootName' };
export const typeLedgerName: TypeDescriptor<'LedgerName'> = { brand: 'LedgerName' };
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
export const typeLocationEntityName: TypeDescriptor<'LocationEntityName'> = { brand: 'LocationEntityName' };
export const typeDepartmentEntityName: TypeDescriptor<'DepartmentEntityName'> = { brand: 'DepartmentEntityName' };
export const typeExpenseCategoryName: TypeDescriptor<'ExpenseCategoryName'> = { brand: 'ExpenseCategoryName' };
export const typeMenuSectionName: TypeDescriptor<'MenuSectionName'> = { brand: 'MenuSectionName' };
export const typeMenuLinkName: TypeDescriptor<'MenuLinkName'> = { brand: 'MenuLinkName' };
export const typeMenuLinkFlagName: TypeDescriptor<'MenuLinkFlagName'> = { brand: 'MenuLinkFlagName' };
export const typeBusinessTypeName: TypeDescriptor<'BusinessTypeName'> = { brand: 'BusinessTypeName' };
export const typeBusinessTypeQuestionsRootName: TypeDescriptor<'BusinessTypeQuestionsRootName'> = { brand: 'BusinessTypeQuestionsRootName' };
export const typeBusinessTypeQuestionName: TypeDescriptor<'BusinessTypeQuestionName'> = { brand: 'BusinessTypeQuestionName' };

import { seedRemainingData } from './db-seed.js';
seedRemainingData();

export type BusinessName = string & { readonly __brand: 'BusinessName' };
export type LedgerName = string & { readonly __brand: 'LedgerName' };
export type AccountName = string & { readonly __brand: 'AccountName' };
export type LocationName = string & { readonly __brand: 'LocationName' };
export type EmployeeName = string & { readonly __brand: 'EmployeeName' };
export type CustomerName = string & { readonly __brand: 'CustomerName' };
export type ProviderName = string & { readonly __brand: 'ProviderName' };
export type ItemName = string & { readonly __brand: 'ItemName' };
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

// businessName scopes the tree to just that business's own subtree (its PER_BUSINESS_ROOTS —
// Locations, Items, Contacts, Vocabulary, Ledgers, Profit Centers — are all children of the
// business entity, so this is a safe, self-contained filter). Omitted, behavior is unchanged:
// the full system-wide tree (all businesses, CoA prototypes, vocabulary) is returned, which is
// still required by callers such as the Entity Tree admin screen and CoA-prototype pickers.
// See docs/pm-domain-reference.md.
export function getEntityTree(businessName?: string): (EntityNode & { depth: number; is_postable_account: boolean; line_type: string | null })[] {
  const businessRow = businessName
    ? (db
        .prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')`)
        .get(businessName) as { id: number } | undefined)
    : undefined;
  if (businessName && !businessRow) return []; // unknown business — scoped query, so an empty tree rather than silently falling back to everything
  const rows = db
    .prepare(
      `WITH RECURSIVE walk(id, depth) AS (
         SELECT id, 0 FROM current_entities WHERE ${businessRow ? 'id = ?' : 'parent_id IS NULL'}
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
    .all(...(businessRow ? [businessRow.id] : [])) as (EntityNode & { depth: number; is_postable_account: number; line_type: string | null; display_order_next: string | null })[];
  const withFlags = rows.map((r) => ({ ...r, is_postable_account: !!r.is_postable_account }));
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

export interface TypeDescriptor<TBrand extends string> {
  readonly brand: TBrand;
    readonly validNames?: () => string[];
    readonly validate?: (name: string) => boolean;
}

export interface TypedNode<TBrand extends string> {
  readonly id: EntityId;
  readonly name: string & { readonly __brand: TBrand };
}

export function requireEntity<TBrand extends string>(name: string, type: TypeDescriptor<TBrand>, parent?: TypedNode<string>): TypedNode<TBrand> {
  const id = resolveId(name, parent?.id);
  if (id == null) throw new ValidationError(`No entity named "${name}".`);
  if (type.validate && !type.validate(name)) {
    throw new ValidationError(`"${name}" exists, but is not a genuine ${type.brand}.`);
  }
  return { id: asEntityId(id), name: name as string & { __brand: TBrand } };
}

export function requireGlobalCoaCategory(categoryName: string): TypedNode<'RootName'> {
  const application = requireEntity('Application', typeRootName);
  const globalCoa = requireEntity('Chart of Accounts', typeChartOfAccountsRootName, application);
  return requireEntity(categoryName, typeRootName, globalCoa);
}

export function requireEntityById<TBrand extends string>(id: number, type: TypeDescriptor<TBrand>): TypedNode<TBrand> {
  const row = db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(id) as { name: string } | undefined;
  if (!row) throw new ValidationError(`No entity with id ${id}.`);
  if (type.validate && !type.validate(row.name)) {
    throw new ValidationError(`"${row.name}" exists, but is not a genuine ${type.brand}.`);
  }
  return { id: asEntityId(id), name: row.name as string & { __brand: TBrand } };
}

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
  if (parent.id === globalVocabularyId()) {
    setTranslation(name, 'English', name, userId);
  }
  return { id: asEntityId(row.id), name: name as string & { __brand: TChildBrand } };
}

export function isGenuineCategoryOrItemsRoot(name: string): boolean {
  return name === 'Items' || name.endsWith(' Items') || isDescendantOf(name, 'Items');
}

export function createEntityRaw(input: NewEntity, userId: UserId): EntityNode {
  const isGlobalVocabularyWord = input.parentId == null && input.parent === 'Vocabulary';
  const parentId = input.parentId ?? (isGlobalVocabularyWord ? globalVocabularyId() : input.parent ? resolveId(input.parent) : null);
  const existing = parentId
    ? db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(input.name, parentId)
    : db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id IS NULL`).get(input.name);
  if (existing) throw new ValidationError(`"${input.name}" already exists under this real, same parent.`);
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
  if (isGlobalVocabularyWord) {
    setTranslation(input.name, 'English', input.name, userId);
  }
  return getEntity(id)!;
}

export interface EntityUpdate {
  name?: string;
  parent?: string | null;
  relation?: string | null;
    relationId?: number;
  accountnumber?: string | null;
}

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

export function getItemStorageOrigin(itemName: ItemName): 'Hot' | 'Cold' | undefined {
  return getEntityLink(itemName, 'Storage Origin') as 'Hot' | 'Cold' | undefined;
}

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
  const block = siblings.filter((s) => selectedIds.has(s.id));
  const rest = siblings.filter((s) => !selectedIds.has(s.id));
  const indices = siblings.map((s, i) => (selectedIds.has(s.id) ? i : -1)).filter((i) => i !== -1);
  const firstIndex = Math.min(...indices);
  const lastIndex = Math.max(...indices);
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

function relinkDisplayOrderChain(orderedSiblings: { id: number; name: string }[], userId: UserId): void {
  for (const s of orderedSiblings) deleteEntityLink(s.name, 'Display Order', userId);
  for (let i = 0; i < orderedSiblings.length - 1; i++) {
    setEntityLink(orderedSiblings[i].name, 'Display Order', orderedSiblings[i + 1].name, userId);
  }
}

export function setRelationship(entityName: string, relationshipType: string, targetName: string, userId: UserId): void {
  const recordName = `${relationshipType} — ${entityName} → ${targetName}`;
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(recordName)) {
    create(requireEntity(relationshipType, typeRootName), typeRelationshipRecordName, recordName, userId);
  }
  const record = db.prepare(`SELECT id FROM current_entities WHERE name = ? ORDER BY id ASC LIMIT 1`).get(recordName) as { id: number };
  supersedeEntity(record.id, { relation: targetName }, userId);
  const entity = db.prepare(`SELECT id FROM current_entities WHERE name = ? ORDER BY id ASC LIMIT 1`).get(entityName) as { id: number } | undefined;
  if (!entity) throw new NotFoundError(`No entity named "${entityName}".`);
  supersedeEntity(entity.id, { relation: recordName }, userId);
}

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

export interface HierarchyNode {
  id: number;
  name: string;
  children: HierarchyNode[];
}

export function getHierarchy(rootName: string, relationshipType?: string, knownRootId?: number): HierarchyNode {
  const rootId = knownRootId ?? (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(rootName) as { id: number } | undefined)?.id;
  if (!rootId) throw new NotFoundError(`No real entity named "${rootName}".`);

  const relPairs = relationshipType ? getEntitiesWithRelationship(relationshipType) : [];
  const childrenByTarget = new Map<string, string[]>();
  for (const { source, target } of relPairs) {
    if (!childrenByTarget.has(target)) childrenByTarget.set(target, []);
    childrenByTarget.get(target)!.push(source);
  }

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

  const businessGroupNames = new Set(businessRows.map((r) => r.source));
  for (const { target } of locationRows) {
    businessGroupNames.add(target);
  }
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
  // Fetched first (not after the other guards, as before) because the new
  // incoming-links guard below needs the entity's own name to check.
  const entity = getEntity(id);
  if (!entity) throw new NotFoundError(`Entity ${id} not found.`);
  const hasChildren = db.prepare(`SELECT 1 FROM current_entities WHERE parent_id = ? LIMIT 1`).get(id);
  if (hasChildren) throw new ValidationError('Cannot revoke an entity that still has children — move or revoke them first.');
  const hasPostings = db.prepare(`SELECT 1 FROM journal_line WHERE account_id = ? LIMIT 1`).get(id);
  if (hasPostings) throw new ValidationError('Cannot revoke an entity that has journal postings against it.');
  // A real, confirmed orphaning risk the two checks above can't see: a link
  // record (setHierarchyParent/setEntityLink's `${entityName} — ${linkType}`
  // naming) is a child of the entity it TAGS, not of the entity it points
  // AT — so revoking the target (a Location, a Hierarchy value, a COGS
  // account, any entity referenced via relation_id) leaves that link's
  // relation_id dangling, invisible to the hasChildren check above. See
  // getEntityLinksPointingAt's own comment for the full reasoning, and
  // docs/pm-domain-reference.md for the specific cases this was found to
  // affect (per-location inventory/quantity accounts, Hierarchy values).
  //
  // Note: this codebase's SECOND, separate, previously-flagged exposure —
  // journal_line's own now-removed `location_id` column letting a Location
  // be revoked while still referenced by location-tagged postings — no
  // longer applies: that column was removed entirely (see "Quantity-on-hand
  // by location" in docs/pm-domain-reference.md), in favor of real,
  // per-location accounts that ARE ordinary children/postings targets and
  // so are already caught by the two checks above.
  const incomingLinks = getEntityLinksPointingAt(entity.name);
  if (incomingLinks.length) {
    const taggers = [...new Set(incomingLinks.map((l) => l.entityName))].join(', ');
    throw new ValidationError(`Cannot revoke "${entity.name}" — still referenced by: ${taggers}.`);
  }
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
  db.prepare(`INSERT INTO entity_revoke (entity_id, revoked_by) VALUES (?, ?)`).run(id, userId);
  const revokedRoot = requireEntity('Application', typeRootName);
  Entity.ensureUnder('Revoked', revokedRoot.id, userId);
  Entity.reparent(id, 'Revoked', userId);
}

export interface AgingBucket {
  label: string;
  through_days: number;
}

export interface CreditStatus {
  balanceMinor: number;
  limitMinor: number | null;
  overLimit: boolean;
    remainingMinor: number | null;
}

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
  const existingWithSameReference = db
    .prepare(`SELECT 1 FROM invoice WHERE business_id = ? AND ledger_id = ? AND reference = ?`)
    .get(businessId, ledgerId, input.reference);
  if (existingWithSameReference) {
    throw new ValidationError(`An invoice with reference "${input.reference}" already exists in ${input.ledger} — references must be unique within a ledger.`);
  }

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

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

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

export interface PickingListLine {
  invoiceLineId: number;
  item: string;
  quantity: number;
  shelfSide: string | null;
  rack: string | null;
  level: number | null;
  picked: boolean;
}

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

  return lines.sort((a, b) => {
    if (a.rack !== b.rack) return (a.rack ?? '\uffff').localeCompare(b.rack ?? '\uffff');
    if (a.level !== b.level) return (a.level ?? Infinity) - (b.level ?? Infinity);
    return (a.shelfSide ?? '\uffff').localeCompare(b.shelfSide ?? '\uffff');
  });
}

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

export interface RestockLineInput {
  item: string;
  quantity: number;
}

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
    transferItems(business, ledger, asItemName(line.item), asLocationName(warehouseName), asLocationName(retailOutletName), line.quantity, `${runReference}-XFER-${line.item}`, userId, transdate);
  }
}

export interface ListInvoicesOptions {
  invoiceType?: 'AR' | 'AP';
    source?: 'manual' | 'pos' | 'all';
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
  const isCorrection = invoice.document_type === 'credit_note' || invoice.document_type === 'debit_memo';
  const baseSign = invoice.invoice_type === 'AR' ? 1 : -1;
  const sign = isCorrection ? -baseSign : baseSign;

  stageLine({
    reference: invoice.reference,
    business: asBusinessName(invoice.business),
    ledger: asLedgerName(invoice.ledger),
    description: invoice.description || `${invoice.invoice_type} Invoice ${invoice.reference}`,
    transdate: invoice.invoice_date,
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

  db.transaction(() => {
  if (!skipJournalPosting) {
    const sign = invoice.invoice_type === 'AR' ? 1 : -1;
    const total = invoice.total_amount_minor + invoice.total_tax_minor;
    // The invoice's own counterparty leg may not have posted to an
    // account literally named invoice.counterparty — a foreign-currency
    // POS sale, for instance, tags it onto a currency-specific sibling
    // (e.g. "Cash (USD)") so it balances, per currency, against the
    // equally-tagged revenue/tax/COGS legs. Reuse whatever account the
    // invoice's own posting actually used, found by its own, real,
    // signed amount in that same journal entry, rather than assuming
    // the plain counterparty name — so the payment closes the exact
    // same account the invoice opened, never a mismatched, untagged one.
    const counterpartyLine = db
      .prepare(`SELECT e.name AS name FROM journal_line jl JOIN journal j ON j.id = jl.journal_id JOIN current_entities e ON e.id = jl.account_id WHERE j.reference = ? AND jl.amount_minor = ?`)
      .get(invoice.reference, sign * total) as { name: string } | undefined;
    const counterpartyAccountName = counterpartyLine?.name ?? invoice.counterparty;
    stageLine({ reference: paymentReference, business: asBusinessName(invoice.business), ledger: asLedgerName(invoice.ledger), transdate: allocationDate, account: asAccountName(paymentAccount), amount_minor: sign * allocatedMinor });
    stageLine({ reference: paymentReference, business: asBusinessName(invoice.business), ledger: asLedgerName(invoice.ledger), transdate: allocationDate, account: asAccountName(counterpartyAccountName), amount_minor: -sign * allocatedMinor });
    postJournalEntry(paymentReference, asBusinessName(invoice.business), asLedgerName(invoice.ledger), userId);
  }

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
    unitPriceMinor?: number;
  taxMinor: number;
    tier?: string;
    combinationValues?: string[];
    combinationShape?: [string, string][];
}

export interface PosSaleInput {
  business: BusinessName;
  ledger: LedgerName;
  locationName: LocationName;
    customerName: CustomerName;
  lines: PosSaleLineInput[];
    revenueAccount?: AccountName;
  taxAccount: AccountName;
    paymentMethod?: string;
  cashTenderedMinor?: number;
    transdate?: string;
    terminalName?: string;
}

export interface PosSaleResult {
  invoiceId: number;
  reference: string;
  totalMinor: number;
  changeDueMinor: number;
}

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

// Resolves where an item's Sales/COGS leaf account should post: the
// named root (Sales Revenue / Cost of Goods Sold), under its real
// Profit Center sub-account if one applies (Department is the one
// genuine "needs its own real balance" grouping, same reasoning as
// Location — see docs/pm-domain-reference.md). No further real
// sub-account nesting happens here for any reporting-only grouping
// (Category, Division, or any other business-defined Hierarchy) —
// those are never real account structure, only ever a generic,
// optional setHierarchyParent tag read back by the matrix-report
// engine (db-matrix-reports.ts), exactly alike for every one of them.
function resolvePostingRoot(rootName: string, userId: UserId, business?: BusinessName, profitCenter?: string): { name: string; id: number } {
  let currentParent = rootName;
  let currentParentId = business
    ? resolveBusinessCoaAccountId(business, rootName)
    : ((db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(rootName) as { id: number } | undefined)?.id ?? null);
  if (profitCenter && business && currentParentId) {
    const pcNode = resolveProfitCenterGroupNode(business, currentParentId, profitCenter, userId);
    currentParent = profitCenter;
    currentParentId = pcNode.id;
  }
  if (currentParentId == null) throw new ValidationError(`No real "${rootName}" account found${business ? ` for "${business}"` : ''}.`);
  return { name: currentParent, id: currentParentId };
}

export function ensureItemSalesCogsAccounts(itemName: ItemName, userId: UserId, tier?: string, business?: BusinessName, profitCenter?: string): { salesAccount: string; salesAccountId: number; cogsAccount: string; cogsAccountId: number } {
  const suffix = tier ? ` (${tier})` : '';
  const salesAccount = `${itemName}${suffix}`;
  const cogsAccount = `${itemName}${suffix}`;

  const salesParent = resolvePostingRoot('Sales Revenue', userId, business, profitCenter);
  const salesRow = Entity.ensureUnder(salesAccount, salesParent.id, userId);

  const cogsParent = resolvePostingRoot('Cost of Goods Sold', userId, business, profitCenter);
  const existingCogs = Entity.getUnder(cogsAccount, cogsParent.id);
  const cogsRow = existingCogs ?? Entity.create(cogsAccount, cogsParent.id, userId);
  if (!existingCogs || !Entity.get(cogsRow.id)?.relation_id) Entity.relate(cogsRow.id, 'COGS', userId);
  return { salesAccount, salesAccountId: salesRow.id, cogsAccount, cogsAccountId: cogsRow.id };
}

export function ensureItemInventoryAccount(itemName: ItemName, userId: UserId, tier?: string, business?: BusinessName, profitCenter?: string): { inventoryAccount: string; inventoryAccountId: number } {
  let inventoryParentId = business ? resolveBusinessCoaAccountId(business, 'Inventory') : (db.prepare(`SELECT id FROM current_entities WHERE name = 'Inventory'`).get() as { id: number }).id;
  if (profitCenter && business) inventoryParentId = resolveProfitCenterGroupNode(business, inventoryParentId, profitCenter, userId).id;
  const accountName = tier ? `${itemName} (${tier})` : itemName;
  const row = Entity.ensureUnder(accountName, inventoryParentId, userId);
  return { inventoryAccount: accountName, inventoryAccountId: row.id };
}

export function ensureItemLocationInventoryAccount(itemName: ItemName, locationName: LocationName, userId: UserId, tier?: string, business?: BusinessName, profitCenter?: string): { inventoryAccount: string; inventoryAccountId: number } {
  const { inventoryAccountId: baseId } = ensureItemInventoryAccount(itemName, userId, tier, business, profitCenter);
  const locationAccount = `${itemName}${tier ? ` (${tier})` : ''} — ${locationName}`;
  const existing = Entity.getUnder(locationAccount, baseId);
  const row = existing ?? Entity.create(locationAccount, baseId, userId);
  if (!existing) setHierarchyParent(locationAccount, 'Location', locationName, userId);
  return { inventoryAccount: locationAccount, inventoryAccountId: row.id };
}

// Mirrors ensureItemLocationInventoryAccount above, but for the item's own
// QUANTITY (unit count), not its financial value. Per direct instruction,
// replaces the former journal_line.location_id tag column: the VALUE side
// already worked this way (a real, provisioned per-location account,
// ordinary journal lines moving value directly between two of them), and
// the quantity side's own single, shared, global "Qty" account plus a
// location_id tag was the real inconsistency. A direct child of the item
// entity itself — the same level as ensureItemQuantityAccounts' own
// siblings (On Order, Units Sold, Count Adjustment, Write-off) — carrying
// the item's own unit-of-measure as its account currency.
//
// Named with a distinct " — Qty" suffix specifically so it can never
// collide, by name, with ensureItemLocationInventoryAccount's own account
// for the same item/location/tier (a different, real account, under a
// different parent — Chart of Accounts → Inventory — but this codebase
// already has one documented, confirmed bug class from two different, real
// accounts sharing one name: see journal_entry_staging.account_id's own
// comment in 00-core.sql). `tier` exists only for the same reason it does
// on the inventory side — storage-area/tier granularity (Hot/Cold,
// Carton/Bottle) is the combinationShape/ensureCombinationAccountLeaf
// system's own job (see docs/storage-space-as-currency-design.md), which
// already tracks quantity correctly, with no location_id of any kind, via
// its own per-combination "On Hand" accounts. This function and its
// read-only counterpart below cover only the single-location, no-tier
// (simple) receive/dispatch/transfer/stock-take path, at parity with how
// ensureItemLocationInventoryAccount already covers that same simple path
// (also always called with tier left undefined there).
export function ensureItemLocationQuantityAccount(itemName: ItemName, locationName: LocationName, userId: UserId, tier?: string, business?: BusinessName): { quantityAccount: string; quantityAccountId: number } {
  const itemId = resolveIdOrThrow(itemName);
  const unit = (getItem(itemName)?.unit_of_measure || 'UNITS').toUpperCase();
  const quantityAccount = `${itemName}${tier ? ` (${tier})` : ''} — ${locationName} — Qty`;
  const existing = Entity.getUnder(quantityAccount, itemId);
  const row = existing ?? Entity.create(quantityAccount, itemId, userId);
  if (!existing) {
    setAccountCurrency(quantityAccount, unit, row.id);
    // A location's own name can collide, by name alone, with an entirely
    // different entity elsewhere in the tree (e.g. the "Storage" subtree's
    // own, same-named capacity-account node for that same location — a
    // real, confirmed collision, found directly) — a bare
    // setHierarchyParent(..., locationName, userId) with no explicit
    // target id can silently resolve to the wrong one. When the business
    // is known, resolve the real Location entity unambiguously, scoped to
    // that business's own real Locations root, and pass its id directly.
    const locationsRootId = business ? resolveBusinessLocationsRootId(business) : undefined;
    const locationId = locationsRootId
      ? (db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(locationName, locationsRootId) as { id: number } | undefined)?.id
      : undefined;
    setHierarchyParent(quantityAccount, 'Location', locationName, userId, row.id, locationId);
  }
  return { quantityAccount, quantityAccountId: row.id };
}

// Read-only counterpart: resolves the account id without creating it, so a
// pure read (getItemLocation) never silently provisions a new, empty
// per-location quantity account just by being asked about a location an
// item has never actually moved to — undefined (not 0) means "never
// provisioned," which the caller treats as zero on-hand.
export function resolveItemLocationQuantityAccountId(itemName: ItemName, locationName: LocationName, tier?: string): number | undefined {
  const itemId = resolveItemId(itemName);
  if (itemId == null) return undefined;
  const quantityAccount = `${itemName}${tier ? ` (${tier})` : ''} — ${locationName} — Qty`;
  return Entity.getUnder(quantityAccount, itemId)?.id;
}

function ensureBusinessRoot(businessName: BusinessName, rootName: string, userId: UserId): { id: number; name: string } {
  const business = requireEntity(businessName, typeBusinessName, requireEntity('Businesses', typeRootName));
  return Entity.getUnder(rootName, business.id) ?? Entity.create(rootName, business.id, userId);
}

export function ensureHierarchyGrouping(businessName: BusinessName, groupingName: string, userId: UserId): { id: number; name: string } {
  const hierarchyRoot = ensureBusinessRoot(businessName, 'Hierarchy', userId);
  return Entity.getUnder(groupingName, hierarchyRoot.id) ?? Entity.create(groupingName, hierarchyRoot.id, userId);
}

export function ensureHierarchyValue(businessName: BusinessName, groupingName: string, valueName: string, userId: UserId): { id: number; name: string } {
  const grouping = ensureHierarchyGrouping(businessName, groupingName, userId);
  return Entity.getUnder(valueName, grouping.id) ?? Entity.create(valueName, grouping.id, userId);
}

// Name-based delete wrappers for the two, since getBusinessHierarchy's own
// HierarchyGroupingWithValues response (what the Hierarchy screen actually
// has in hand) carries no entity ids at all — changing that shared shape
// for this alone would ripple into every other consumer, so these resolve
// the id internally instead, the same way ensureHierarchyGrouping/Value
// above already do. revokeEntity's own guards (children, postings,
// incoming links via getEntityLinksPointingAt) do the real safety work —
// a grouping with live values is already blocked by the children check; a
// value some entity is still actually tagged with (e.g. a Location) is now
// caught by the incoming-links check. See
// /root/.claude/plans/stateful-snacking-adleman.md.
export function deleteHierarchyValue(businessName: BusinessName, groupingName: string, valueName: string, userId: UserId): void {
  const grouping = ensureHierarchyGrouping(businessName, groupingName, userId);
  const value = Entity.getUnder(valueName, grouping.id);
  if (!value) throw new NotFoundError(`No real value named "${valueName}" under "${groupingName}".`);
  revokeEntity(value.id, userId);
}

export function deleteHierarchyGrouping(businessName: BusinessName, groupingName: string, userId: UserId): void {
  const hierarchyRoot = ensureBusinessRoot(businessName, 'Hierarchy', userId);
  const grouping = Entity.getUnder(groupingName, hierarchyRoot.id);
  if (!grouping) throw new NotFoundError(`No real hierarchy grouping named "${groupingName}" for "${businessName}".`);
  revokeEntity(grouping.id, userId);
}

export function createProfitCenter(businessName: BusinessName, profitCenterName: string, userId: UserId): { id: number; name: string } {
  const root = ensureBusinessRoot(businessName, 'Profit Centers', userId);
  if (Entity.getUnder(profitCenterName, root.id)) {
    throw new ValidationError(`"${profitCenterName}" already exists as a Profit Center for "${businessName}".`);
  }
  return Entity.create(profitCenterName, root.id, userId);
}

export function getProfitCenters(businessName: BusinessName): { id: number; name: string }[] {
  const root = db
    .prepare(`SELECT id FROM current_entities WHERE name = 'Profit Centers' AND parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses'))`)
    .get(businessName) as { id: number } | undefined;
  if (!root) return [];
  return db.prepare(`SELECT id, name FROM current_entities WHERE parent_id = ? ORDER BY name`).all(root.id) as { id: number; name: string }[];
}

function resolveProfitCenterGroupNode(business: BusinessName, headerId: number, profitCenterName: string, userId: UserId): { id: number; name: string } {
  const pc = getProfitCenters(business).find((p) => p.name === profitCenterName);
  if (!pc) throw new ValidationError(`No real Profit Center named "${profitCenterName}" for "${business}" — create it first.`);
  const row = Entity.ensureUnder(profitCenterName, headerId, userId);
  setHierarchyParent(profitCenterName, 'Profit Center', profitCenterName, userId, row.id, pc.id);
  return row;
}

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

export function getCombinationDisplayName(entityId: number): string {
  const row = db.prepare(`SELECT combination_ids FROM current_entities WHERE id = ?`).get(entityId) as { combination_ids: string | null } | undefined;
  if (!row?.combination_ids) throw new ValidationError(`Entity ${entityId} has no real combination_ids set.`);
  const ids = JSON.parse(row.combination_ids) as number[];
  const rows = db.prepare(`SELECT id, name FROM current_entities WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids) as { id: number; name: string }[];
  const byId = new Map(rows.map((r) => [r.id, r.name]));
  return ids.map((id) => byId.get(id) ?? '?').join(' — ');
}

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

export function ensureCombinationAccountLeaf(baseAccountName: string, instanceTopNode: { id: number; name: string }, userId: UserId, baseAccountId?: number): { id: number; name: string } {
  const baseId = baseAccountId ?? (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(baseAccountName) as { id: number } | undefined)?.id;
  if (!baseId) throw new ValidationError(`No real account named "${baseAccountName}".`);
  const instanceRow = db.prepare(`SELECT combination_ids FROM current_entities WHERE id = ?`).get(instanceTopNode.id) as { combination_ids: string | null } | undefined;
  const combinationIds = instanceRow?.combination_ids ?? null;
  const existingByCombination = combinationIds != null
    ? (db.prepare(`SELECT id, name FROM current_entities WHERE parent_id = ? AND combination_ids = ?`).get(baseId, combinationIds) as { id: number; name: string } | undefined)
    : undefined;
  const existing = existingByCombination
    ?? (db.prepare(`SELECT id, name FROM current_entities WHERE parent_id = ? AND name = ?`).get(baseId, instanceTopNode.name) as { id: number; name: string } | undefined);
  if (existing) return existing;
  const leafName = combinationIds != null ? getCombinationDisplayName(instanceTopNode.id) : instanceTopNode.name;
  const leaf = Entity.create(leafName, baseId, userId);
  if (combinationIds != null) Entity.setCombinationIds(leaf.id, combinationIds);
  return leaf;
}

export function ensureLocationStorageRoot(business: BusinessName, locationName: string, userId: UserId): { id: number; name: string } {
  const businessEntity = requireEntity(business, typeBusinessName, requireEntity('Businesses', typeRootName));
  let coa: { id: number; name: string };
  try { coa = requireEntity('Chart of Accounts', typeRootName, businessEntity); } catch { coa = create(businessEntity, typeRootName, 'Chart of Accounts', userId); }
  const storage = (Entity.getUnder('Storage', coa.id) ?? create(coa as TypedNode<string>, typeRootName, 'Storage', userId)) as { id: number; name: string };
  return (Entity.getUnder(locationName, storage.id) ?? create(storage as TypedNode<string>, typeRootName, locationName, userId)) as { id: number; name: string };
}

export function ensureStorageCapacityStructure(parentEntity: { id: number; name: string }, userId: UserId): { remainingId: number; installedId: number; occupiedId: number } {
  const capacity = (Entity.getUnder('Storage Capacity', parentEntity.id) ?? create(parentEntity as TypedNode<string>, typeRootName, 'Storage Capacity', userId)) as { id: number; name: string };
  const remaining = (Entity.getUnder('Remaining', capacity.id) ?? create(capacity as TypedNode<string>, typeRootName, 'Remaining', userId)) as { id: number; name: string };
  const installed = (Entity.getUnder('Installed', capacity.id) ?? create(capacity as TypedNode<string>, typeRootName, 'Installed', userId)) as { id: number; name: string };
  const occupied = (Entity.getUnder('Occupied', capacity.id) ?? create(capacity as TypedNode<string>, typeRootName, 'Occupied', userId)) as { id: number; name: string };
  return { remainingId: remaining.id, installedId: installed.id, occupiedId: occupied.id };
}

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
  stageLine({ reference: ref, business, ledger, account: asAccountName(containerSpace.name), accountId: containerSpace.id, amount_minor: cartonsOpened });
  stageLine({ reference: ref, business, ledger, account: asAccountName(containerOccupied.name), accountId: containerOccupied.id, amount_minor: -cartonsOpened });
  stageLine({ reference: ref, business, ledger, account: asAccountName(unitSpace.name), accountId: unitSpace.id, amount_minor: -unitsProduced });
  stageLine({ reference: ref, business, ledger, account: asAccountName(unitOccupied.name), accountId: unitOccupied.id, amount_minor: unitsProduced });
  postJournalEntry(ref, business, ledger, userId);

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
    containerSpaceAccount: string;
  containerOccupiedAccount: string;
  unitSpaceAccount: string;
  unitOccupiedAccount: string;
    containerSpaceAccountId: number;
  containerOccupiedAccountId: number;
  unitSpaceAccountId: number;
  unitOccupiedAccountId: number;
    inventoryFromAccount: string;
  inventoryToAccount: string;
  inventoryFromAccountId: number;
  inventoryToAccountId: number;
    unitCostMinor: number | null;
}

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

export function getItemUnitCostMinor(itemName: ItemName): number | null {
  const sources = listItemSources(itemName);
  if (sources.length === 0) return null;
  const source = sources.find((s) => s.is_preferred) ?? sources[0];
  if (source.price_minor == null || !source.package_quantity) return null;
  return Math.round(source.price_minor / source.package_quantity);
}

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

export function ensureItemTierLocationLeaf(tierItemName: string, locationName: LocationName, userId: UserId, tierItemId?: number): { leafItemName: string; leafItemId: number; salesAccount: string; salesAccountId: number; cogsAccount: string; cogsAccountId: number } {
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
    setHierarchyParent(salesAccount, 'Location', locationName, userId);
    setHierarchyParent(cogsAccount, 'Location', locationName, userId);
    leafRow = { id: createdLeaf.id, name: leafItemName };
  }
  return { leafItemName, leafItemId: leafRow.id, salesAccount, salesAccountId: salesRow!.id, cogsAccount, cogsAccountId: cogsRow!.id };
}

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

export function getLocationForAccount(accountName: AccountName): string | undefined {
  return getHierarchyParent(accountName, 'Location');
}

export function getHierarchyGroupForAccount(accountName: AccountName, hierarchyName: string): string | undefined {
  const location = getLocationForAccount(accountName);
  if (!location) return undefined;
  return getHierarchyGroupForLocation(location, hierarchyName);
}

export function getQualifiedDisplayName(entityId: number): string {
  const entity = getEntity(entityId);
  if (!entity) return '';
  if (entity.parent_id == null) return entity.name;
  const parent = getEntity(entity.parent_id);
  if (!parent || entity.name.startsWith(`${parent.name} — `)) return entity.name;
  return `${parent.name} — ${entity.name}`;
}

export function ensureItemQuantityAccounts(itemName: ItemName, userId: UserId): { onOrderAccount: string; onOrderAccountId: number; unitsSoldAccount: string; unitsSoldAccountId: number; countAdjustmentAccount: string; countAdjustmentAccountId: number; writeOffAccount: string; writeOffAccountId: number } {
  const itemId = resolveIdOrThrow(itemName);
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

export function getHierarchyGroupForLocation(locationName: string, hierarchyName: string): string | undefined {
  return getHierarchyParent(locationName, hierarchyName);
}

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

  const effectiveCurrency = getEffectiveSaleCurrency(input.terminalName);
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
          amountMinor: l.quantity * l.unitPriceMinor!,
          taxMinor: l.taxMinor,
          itemName: l.itemName,
        })),
      },
      userId
    );

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
      // The counterparty leg posts to input.customerName directly (the
      // real "Cash" customer for an immediate-payment sale, or any real
      // on-account customer for the POS Terminal) — never a direct-to-
      // Cash-and-Bank shortcut. allocatePayment below then immediately
      // reconciles it to zero when a paymentMethod is given, so the
      // balance is real, even if only for an instant — see "Cash Sale
      // and Cash Purchase" in pm-frontend-reference.md. The one
      // exception: a foreign-currency terminal already tags the
      // revenue/tax/COGS legs onto currency-specific siblings (e.g.
      // "Sales Revenue (USD)"), so the counterparty leg must be tagged
      // the exact same way (e.g. "Cash (USD)") or the entry fails its
      // own, real, per-currency balance check.
      effectiveCurrency ? (tagCurrency(input.customerName) as { name: string }).name : undefined
    );

    for (const line of input.lines) {
      dispatchItems(input.business, input.ledger, `${reference}-DISPATCH-${line.itemName}`, asItemName(line.itemName), asLocationName(resolveDispatchLocation(asItemName(line.itemName), input.locationName)), line.quantity, userId, today);
    }

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
      allocatePayment(invoiceId, `${reference}-PAYMENT`, totalMinor, today, resolveCashAtBankAccount(input.business, effectiveCurrency ?? undefined, userId).name, userId, false);
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
    paymentMethod?: string;
  transdate?: string;
}

export interface CashPurchaseResult {
  invoiceId: number;
  reference: string;
  totalMinor: number;
}

// resolveCashTransactionAccounts/resolveSaleAccounts (and the canned-journal
// cashPurchaseLines/posSaleLines they fed) were the old, direct-to-Cash
// account-selection path for Cash Purchase/Cash Sale. Removed — both
// screens now go through completeCashPurchase/completePosSale, the
// same genuine invoice+stock+immediate-payment mechanism as any
// on-account Purchase/Sale, to the one real "Cash" provider/customer.
// See "Cash Sale and Cash Purchase" in pm-frontend-reference.md.

export interface ResolvedTransferAccounts {
    fromInventoryAccount: string;
    toInventoryAccount: string;
    unitCostMinor: number | null;
}

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
      false
      // No counterpartyAccountOverride here, deliberately — see the
      // matching note in completePosSale above. The purchase posts a
      // genuine AP invoice to input.vendorName (the real "Cash" provider
      // for an immediate-payment purchase), and allocatePayment below
      // immediately reconciles it to zero.
    );

    for (const line of input.lines) {
      receiveItems(input.business, input.ledger, `${reference}-RECV-${line.itemName}`, asItemName(line.itemName), asLocationName(input.locationName), line.quantity, userId, today);
    }

    const invoice = getInvoice(invoiceId)!;
    const totalMinor = invoice.total_amount_minor + invoice.total_tax_minor;

    if (input.paymentMethod) {
      allocatePayment(invoiceId, `${reference}-PAYMENT`, totalMinor, today, resolveCashAtBankAccount(input.business, undefined, userId).name, userId, false);
    }

    return { invoiceId, reference, totalMinor };
  })();
}

export interface PayEmployeeWagesInput {
  business: string;
  ledger: string;
  employeeName: string;
    hours?: number;
  wagesExpenseAccount?: string;
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

const MEDICARE_LEVY_RATE = 0.015;
const SUPERANNUATION_RATE = 0.12;

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

    stageLine({ reference: `${reference}-MEDICARE`, business: asBusinessName(input.business), ledger: asLedgerName(input.ledger), transdate: today, account: asAccountName(input.employeeName), amount_minor: medicareLevyMinor, memo: 'Medicare levy withheld' });
    stageLine({ reference: `${reference}-MEDICARE`, business: asBusinessName(input.business), ledger: asLedgerName(input.ledger), transdate: today, account: asAccountName('Medicare Levy Payable'), amount_minor: -medicareLevyMinor, memo: 'Medicare levy withheld' });
    postJournalEntry(`${reference}-MEDICARE`, asBusinessName(input.business), asLedgerName(input.ledger), userId);

    stageLine({ reference: `${reference}-SUPER`, business: asBusinessName(input.business), ledger: asLedgerName(input.ledger), transdate: today, account: asAccountName('Superannuation Expense'), amount_minor: superannuationMinor, memo: 'Superannuation employer contribution' });
    stageLine({ reference: `${reference}-SUPER`, business: asBusinessName(input.business), ledger: asLedgerName(input.ledger), transdate: today, account: asAccountName('Superannuation Payable'), amount_minor: -superannuationMinor, memo: 'Superannuation employer contribution' });
    postJournalEntry(`${reference}-SUPER`, asBusinessName(input.business), asLedgerName(input.ledger), userId);

    if (input.paymentMethod) {
      allocatePayment(invoiceId, `${reference}-PAYMENT`, netMinor, today, resolveCashAtBankAccount(asBusinessName(input.business), undefined, userId).name, userId, true);
    }

    return { invoiceId, reference, grossMinor, medicareLevyMinor, superannuationMinor, netMinor };
  })();
}

export function recordReminderSent(customerName: string): number {
  const id = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(customerName) as { id: number } | undefined)?.id;
  if (!id) throw new ValidationError(`No customer/vendor named "${customerName}".`);
  const current = (db.prepare(`SELECT reminder_level FROM contact WHERE entity_id = ?`).get(id) as { reminder_level: number } | undefined)?.reminder_level ?? 0;
  const next = current === 0 ? 1 : Math.min(3, current + 1);
  mergeContactDetail(id, { reminder_level: next });
  return next;
}

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
    person_name: string | null;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
    payment_terms_days: number | null;
    credit_limit_minor: number | null;
    wage_minor_per_hour: number | null;
    salary_minor_per_year: number | null;
  reminder_level: number;
    preferred_language: string | null;
    verification_status: 'pending' | 'active' | 'rejected' | null;
    card_label: string | null;
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

export function signOn(employeeName: string, locationName: string): PosShift {
  const employee = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(employeeName) as { id: number } | undefined;
  if (!employee) throw new ValidationError(`No employee named "${employeeName}".`);
  const location = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(locationName) as { id: number } | undefined;
  if (!location) throw new ValidationError(`No location named "${locationName}".`);
  const contact = db.prepare(`SELECT pos_pin FROM contact WHERE entity_id = ?`).get(employee.id) as { pos_pin: string | null } | undefined;
  if (!contact?.pos_pin) throw new ValidationError(`"${employeeName}" has no real PIN set yet — cannot sign on.`);
  const alreadyOpen = db
    .prepare(`SELECT 1 FROM current_entities shift JOIN current_entities tag ON tag.parent_id = shift.id AND tag.name = 'Open' AND tag.relation_id IS NOT NULL WHERE shift.parent_id = ?`)
    .get(employee.id);
  if (alreadyOpen) throw new ValidationError(`"${employeeName}" is already signed on somewhere — sign off first.`);
  const signedOnAt = new Date().toISOString();
  const shiftEntity = Entity.create(`${employeeName} — Shift — ${signedOnAt}`, employee.id, asUserId(1));
  supersedeEntity(shiftEntity.id, { relation: locationName }, asUserId(1));
  Entity.tag(shiftEntity.id, 'Open', asUserId(1));
  return { id: shiftEntity.id, employee: employeeName, location: locationName, signed_on_at: signedOnAt, signed_off_at: null };
}

export function verifyPosPin(employeeName: string, pin: string): boolean {
  const employee = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(employeeName) as { id: number } | undefined;
  if (!employee) return false;
  const contact = db.prepare(`SELECT pos_pin FROM contact WHERE entity_id = ?`).get(employee.id) as { pos_pin: string | null } | undefined;
  return !!contact?.pos_pin && contact.pos_pin === pin;
}

export function signOff(shiftId: number): void {
  if (!Entity.hasTag(shiftId, 'Open')) throw new ValidationError(`No real shift with id ${shiftId}, or it is already signed off.`);
  const signedOffAt = new Date().toISOString();
  Entity.untag(shiftId, 'Open', asUserId(1));
  Entity.setAttr(shiftId, 'Signed Off At', signedOffAt, asUserId(1));
}

function parseShiftEntity(row: { id: number; employee: string; location: string; created_at: string }): PosShift {
  return { id: row.id, employee: row.employee, location: row.location, signed_on_at: row.created_at, signed_off_at: Entity.getAttr(row.id, 'Signed Off At') ?? null };
}

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

export function setEmployeeSchedule(employeeName: string, locationName: string, schedule: ScheduleLine[]): void {
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(employeeName)) throw new ValidationError(`No employee named "${employeeName}".`);
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(locationName)) throw new ValidationError(`No location named "${locationName}".`);

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

export function ensureAddressType(typeName: string, userId: UserId): void {
  if (!Entity.get(typeName)) Entity.create(typeName, 'Address Types', userId);
}

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

export function ensurePhoneType(typeName: string, userId: UserId): void {
  if (!Entity.get(typeName)) Entity.create(typeName, 'Phone Types', userId);
}

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

export function ensureContactPersonType(typeName: string, userId: UserId): void {
  if (!Entity.get(typeName)) Entity.create(typeName, 'Contact Person Types', userId);
}

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
  return rows.map((r) => ({ [typeKey]: r.type_name, record_name: r.record_name, ...load(r.record_name) })) as T[];
}

function deleteTyped(entityName: string, thingSuffix: string, type: string, userId: UserId): void {
  const recordName = `${entityName} — ${type} ${thingSuffix}`;
  const record = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(recordName) as { id: number } | undefined;
  if (record) Entity.relate(record.id, null, userId);
}

// Known, real ambiguity when `entityId` is omitted: requireEntity's own
// name lookup (resolveId) searches `current_entities` globally, with no
// parent scoping and no ORDER BY — so it resolves to WHICHEVER row shares
// that exact name, not necessarily the one the caller meant. Confirmed in
// practice for Locations specifically: every location with a capacity
// account (ensureLocationCapacityAccount/ensureLocationStorageRoot) gets a
// same-named doppelganger node created under Chart of Accounts > Storage,
// so setHierarchyParent(locationName, ...) called without its own
// `entityId` can silently tag the WRONG node. Every caller that already
// has the real entity id in hand (setHierarchyParent's own 5th parameter)
// should pass it, rather than relying on this bare name lookup, whenever
// the entity's name isn't provably unique across the whole tree.
export function setEntityLink(entityName: string, linkType: string, targetName: string, userId: UserId, entityId?: number, targetId?: number): string {
  const recordName = `${entityName} — ${linkType}`;
  const parentNode = entityId != null ? requireEntityById(entityId, typeRootName) : requireEntity(entityName, typeRootName);
  let record = Entity.getUnder(recordName, parentNode.id);
  if (!record) {
    const created = create(parentNode, typeEntityLinkRecordName, recordName, userId);
    record = { id: created.id, name: created.name };
  }
  Entity.tag(record.id, linkType, userId);
  supersedeEntity(record.id, targetId != null ? { relationId: targetId } : { relation: targetName }, userId);
  return recordName;
}

export function getEntityLink(entityName: string, linkType: string): string | undefined {
  const recordName = `${entityName} — ${linkType}`;
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
    Entity.untag(record.id, linkType, userId);
  }
}

export function stageBomComponent(input: {
  assemblyItem: string; business: string; componentItem: string; quantity: number; unit: string;
}): void {
  db.prepare(
    `INSERT INTO assembly_bom_staging (assembly_item, business, component_item, quantity, unit)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (assembly_item, business, component_item) DO UPDATE SET quantity = ?, unit = ?`
  ).run(input.assemblyItem, input.business, input.componentItem, input.quantity, input.unit, input.quantity, input.unit);
}

export function postBomComponents(assemblyItem: string, business: string, userId: UserId): void {
  const rows = db
    .prepare(`SELECT component_item, quantity, unit FROM assembly_bom_staging WHERE assembly_item = ? AND business = ?`)
    .all(assemblyItem, business) as { component_item: string; quantity: number; unit: string }[];
  for (const row of rows) {
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

export function deleteBomComponent(assemblyItem: string, componentItem: string, userId: UserId): void {
  const linkType = `BOM — ${componentItem}`;
  const record = Entity.get(`${assemblyItem} — ${linkType}`, assemblyItem);
  if (record) Entity.untag(record.id, 'BOM', userId);
  deleteEntityLink(assemblyItem, linkType, userId);
}

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

function resolveProjectTaskName(name: string): string {
  if (db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(name)) return name;
  const candidates = db.prepare(`SELECT name FROM current_entities WHERE name LIKE ?`).all(`${name} (%)`) as { name: string }[];
  const match = candidates.find((c) => PROJECT_TASK_DATE_SUFFIX.exec(c.name)?.[1] === name);
  if (!match) throw new ValidationError(`No project task named "${name}".`);
  return match.name;
}

export function addTaskDependency(
  dependentTask: string,
  predecessorTask: string,
  dependencyType: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish',
  userId: UserId
): void {
  const dependentFullName = resolveProjectTaskName(dependentTask);
  const predecessorFullName = resolveProjectTaskName(predecessorTask);
  const linkType = `Depends On — ${predecessorFullName}`;
  setEntityLink(dependentFullName, linkType, predecessorFullName, userId);
  const record = Entity.get(`${dependentFullName} — ${linkType}`, dependentFullName);
  if (record) {
    Entity.tag(record.id, 'Dependency', userId);
    Entity.setAttr(record.id, 'Dependency Type', dependencyType, userId);
  }
}

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

export function setHierarchyParent(entityName: string, hierarchyName: string, parentName: string, userId: UserId, entityId?: number, targetId?: number): void {
  setEntityLink(entityName, `Hierarchy: ${hierarchyName}`, parentName, userId, entityId, targetId);
}

export function getHierarchyParent(entityName: string, hierarchyName: string): string | undefined {
  return getEntityLink(entityName, `Hierarchy: ${hierarchyName}`);
}

export function deleteHierarchyParent(entityName: string, hierarchyName: string, userId: UserId): void {
  deleteEntityLink(entityName, `Hierarchy: ${hierarchyName}`, userId);
}

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

export function getContactBaseAccounts(contactName: string): string[] {
  const types = getContactTypes(contactName);
  const accounts = types.map((t) => getHierarchyParent(t, 'Header Account')).filter((a): a is string => !!a);
  return [...new Set(accounts)];
}

export function createContact<TBrand extends string>(rootName: string, type: TypeDescriptor<TBrand>, contactType: string, name: string, userId: UserId): TypedNode<TBrand> {
  const entity = create(requireEntity(rootName, typeRootName), type, name, userId);
  setContactType(name, contactType, userId);
  return entity;
}

export function createProvider(name: string, userId: UserId): { id: number } {
  return createContact('Accounts Payable', typeProviderName, 'Provider', name, userId);
}

export function createCustomer(name: string, userId: UserId): { id: number } {
  return createContact('Customers', typeCustomerName, 'Customer', name, userId);
}

export function createEmployee(name: string, placeOfEmployment: string, userId: UserId): { id: number } {
  const entity = createContact('Employees', typeEmployeeName, 'Employee', name, userId);
  setRelationship(name, 'Place of Employment', placeOfEmployment, userId);
  return entity;
}

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

// Every real, direct setHierarchyParent tag for one named hierarchy, in
// one query - entity name -> the value it's tagged with. Covers both an
// item tagged with a value, and a value itself tagged with a further
// parent value (the same, single tag type either way), so one call gives
// every edge needed to build a real display tree for any hierarchy
// (Category included) without an N+1 per item or per value. Never
// privileges any particular hierarchy name.
export function getHierarchyAssignments(hierarchyName: string): Record<string, string> {
  const rows = db
    .prepare(
      `SELECT orig.name AS entity_name, target.name AS value_name
       FROM current_entities link
       JOIN current_entities target ON target.id = link.relation_id
       JOIN current_entities orig ON orig.id = link.parent_id
       WHERE link.name = orig.name || ' — ' || ?`
    )
    .all(`Hierarchy: ${hierarchyName}`) as { entity_name: string; value_name: string }[];
  const result: Record<string, string> = {};
  for (const r of rows) result[r.entity_name] = r.value_name;
  return result;
}

// The general form behind getHierarchyLinksPointingAt below: EVERY kind of
// link record this codebase creates (setEntityLink's own `${entityName} —
// ${linkType}` naming convention — Hierarchy: *, Location, COGS Product,
// Contact Type: *, Override: *, and any future kind) is a child of the
// TAGGED entity (`orig`), with its own relation_id pointing at the TARGET —
// so a plain children-check on the target alone (what revokeEntity already
// did before this function existed) can never see these, no matter which
// kind of link they are. Built for the Insert/Enter/Escape/Delete keyboard
// idiom's delete-safety guard (see docs/pm-frontend-reference.md and
// /root/.claude/plans/stateful-snacking-adleman.md) — see revokeEntity below.
export function getEntityLinksPointingAt(targetName: string): { entityName: string; linkType: string }[] {
  // Reconstructs setEntityLink's own naming invariant exactly
  // (`${entityName} — ${linkType}`, record tagged with linkType itself)
  // rather than a bare `LIKE orig.name || ' — %'` pattern, for two real
  // reasons found directly while wiring this up as revokeEntity's new
  // guard (see below): (1) setRelationship (a completely different, older
  // mechanism — a relationship record is a child of the relationship
  // TYPE's own root entity, e.g. "Belongs To Group", not of the tagged
  // entity) produces names that, by unlucky coincidence, also match a bare
  // `' — %'` wildcard off that root's name, with no real "entityName" to
  // report at all; (2) requiring the live tag join means deleteEntityLink/
  // deleteHierarchyParent's existing untag-based "remove this reference"
  // mechanism is correctly respected here too — an untagged link no longer
  // counts as a real, current reference, exactly as getEntityLink's own
  // read path already treats it.
  const rows = db
    .prepare(
      `SELECT orig.name AS entity_name, tag.name AS link_type
       FROM current_entities link
       JOIN current_entities target ON target.id = link.relation_id
       JOIN current_entities orig ON orig.id = link.parent_id
       JOIN current_entities tag ON tag.parent_id = link.id AND tag.relation_id IS NOT NULL
       WHERE target.name = ? AND link.name = orig.name || ' — ' || tag.name`
    )
    .all(targetName) as { entity_name: string; link_type: string }[];
  return rows.map((r) => ({ entityName: r.entity_name, linkType: r.link_type }));
}

// Symmetric, bulk counterpart to getEntityLinksPointingAt above (that one
// goes target → owners for any link type; this one goes "every owner of
// this one link type → its target," in a single query, for getOrgChartStructure's
// Employee → Department/Manager reads below — avoiding an N+1 per-employee
// getEntityLink call). Same join shape, same live-tag requirement.
export function getEntitiesWithLink(linkType: string): { entityName: string; targetName: string }[] {
  const rows = db
    .prepare(
      `SELECT orig.name AS entity_name, target.name AS target_name
       FROM current_entities link
       JOIN current_entities target ON target.id = link.relation_id
       JOIN current_entities orig ON orig.id = link.parent_id
       JOIN current_entities tag ON tag.parent_id = link.id AND tag.name = ? AND tag.relation_id IS NOT NULL
       WHERE link.name = orig.name || ' — ' || ?`
    )
    .all(linkType, linkType) as { entity_name: string; target_name: string }[];
  return rows.map((r) => ({ entityName: r.entity_name, targetName: r.target_name }));
}

// A thin filter over getEntityLinksPointingAt, kept so this function's two
// existing callers (editor/+page.svelte's warning panel, the Header
// Account/vocabulary-alternates lookup below) see no behavior change.
export function getHierarchyLinksPointingAt(targetName: string): { entityName: string; hierarchyName: string }[] {
  return getEntityLinksPointingAt(targetName)
    .filter((l) => l.linkType.startsWith('Hierarchy: '))
    .map((l) => ({ entityName: l.entityName, hierarchyName: l.linkType.slice('Hierarchy: '.length) }));
}

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
    const structuralParent = db
      .prepare(`SELECT parent.name AS parent_name FROM current_entities child JOIN current_entities parent ON parent.id = child.parent_id WHERE child.name = ?`)
      .get(r.group_name) as { parent_name: string } | undefined;
    return { name: r.group_name, parentName: structuralParent?.parent_name ?? null };
  });
}

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

export function getBankAccounts(business: BusinessName, ledger: LedgerName): BankAccountRow[] {
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
    first_shortfall_date: string | null;
    first_shortfall_amount_minor: number | null;
}

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
    card_label?: string | null;
}

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

export function verifyCustomer(customerName: string, approve: boolean): void {
  const entityId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(customerName) as { id: number } | undefined)?.id;
  if (!entityId) throw new ValidationError(`No customer named "${customerName}".`);
  const current = (db.prepare(`SELECT verification_status FROM contact WHERE entity_id = ?`).get(entityId) as { verification_status: string | null } | undefined)
    ?.verification_status;
  if (current !== 'pending') throw new ValidationError(`"${customerName}" is not awaiting verification.`);
  mergeContactDetail(entityId, { verification_status: approve ? 'active' : 'rejected' });
}

export function authenticateCustomer(name: string, password: string): boolean {
  const row = db.prepare(`SELECT password_hash FROM contact WHERE entity_id = (SELECT id FROM current_entities WHERE name = ?)`).get(name) as
    | { password_hash: string | null }
    | undefined;
  if (!row?.password_hash) return false;
  return verifyPassword(password, row.password_hash);
}

export interface ProductSummary {
  name: string;
  itemCount: number;
}

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

export function createProduct(name: string, parent: string, userId: UserId): void {
  create(requireEntity(parent, typeCategoryOrItemsRootName), typeItemName, name, userId);
}

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
    storage_origin: 'Hot' | 'Cold' | null;
    product: string | null;
}

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

export function createItem(name: string, parentCategoryOrItemsRoot: string, userId: UserId, businessName?: BusinessName): void {
  if (!businessName) {
    const parent = requireEntity(parentCategoryOrItemsRoot, typeCategoryOrItemsRootName);
    create(parent, typeItemName, name, userId);
    setItem(name, { description: null, unit_of_measure: null, upc: null });
    return;
  }
  const itemsRoot = requireEntity('Items', typeRootName, requireEntity(businessName, typeBusinessName, requireEntity('Businesses', typeRootName)));
  const parent =
    parentCategoryOrItemsRoot === 'Items'
      ? itemsRoot
      : requireEntityById(requireDescendantIdByName(itemsRoot.id, parentCategoryOrItemsRoot), typeCategoryOrItemsRootName);
  create(parent, typeItemName, name, userId);
  setItem(name, { description: null, unit_of_measure: null, upc: null });
}

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
    currency?: string | null;
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

export function getItemPriceForCurrency(itemName: string, currency: string | null, productInstanceId?: number): number | null {
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

// A business's financial-year start date and reporting-period frequency - stored the same way as
// home_currency above (detail_json on the business entity itself), real data rather than just the
// free-text financialYearLabel (which only ever drove the Budget ledger's name). See
// docs/pm-domain-reference.md ("Reporting periods") for the period-boundary math this backs.
export type ReportingFrequency = 'annual' | 'biannual' | 'quarterly' | 'monthly';
export const PERIOD_MONTHS: Record<ReportingFrequency, number> = { annual: 12, biannual: 6, quarterly: 3, monthly: 1 };

export function setBusinessReportingPeriod(businessName: string, financialYearStart: string, frequency: ReportingFrequency, userId: UserId): void {
  const businessId = (db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')`).get(businessName) as { id: number } | undefined)?.id;
  if (!businessId) throw new ValidationError(`No business named "${businessName}".`);
  const row = db.prepare(`SELECT detail_json FROM current_entities WHERE id = ?`).get(businessId) as { detail_json: string | null } | undefined;
  const current = row?.detail_json ? JSON.parse(row.detail_json) : {};
  Entity.setDetailJson(businessId, JSON.stringify({ ...current, financial_year_start: financialYearStart, reporting_frequency: frequency }));
  void userId;
}

export function getBusinessReportingPeriod(businessName: string): { financialYearStart: string; frequency: ReportingFrequency } | null {
  const row = db.prepare(`SELECT detail_json FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')`).get(businessName) as { detail_json: string | null } | undefined;
  if (!row?.detail_json) return null;
  const detail = JSON.parse(row.detail_json);
  if (!detail.financial_year_start || !detail.reporting_frequency) return null;
  return { financialYearStart: detail.financial_year_start, frequency: detail.reporting_frequency };
}

export interface ReportingPeriod {
  label: string;
  startDate: string;
  endDate: string;
}

// Every real period boundary from the stored financial-year start forward, at the stored
// frequency, through the first period that ends on or after `asOfDate` (today by default) - the
// one currently in progress. Pure calendar arithmetic (whole-month steps, so it's correct across
// different month lengths and leap years), not a fixed day-count. Returns [] when the business
// has no stored reporting period at all (createBusiness's legacy callers, or any business created
// before this feature) - callers fall back to free-form dates/ledger names exactly as before.
export function getReportingPeriods(businessName: string, asOfDate?: string): ReportingPeriod[] {
  const period = getBusinessReportingPeriod(businessName);
  if (!period) return [];
  const months = PERIOD_MONTHS[period.frequency];
  const start = new Date(`${period.financialYearStart}T00:00:00Z`);
  const limit = new Date(`${asOfDate ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const periods: ReportingPeriod[] = [];
  let cursor = start;
  let periodNumber = 1; // 1-based, resets to 1 at each financial-year anniversary
  let guard = 0;
  while (guard++ < 1000) {
    const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + months, cursor.getUTCDate()));
    const endDate = new Date(next.getTime() - 86400000);
    const fyLabel = financialYearLabelFor(start, cursor);
    periods.push({
      label: periodLabel(period.frequency, periodNumber, fyLabel, endDate),
      startDate: cursor.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
    });
    if (endDate >= limit) break;
    cursor = next;
    periodNumber = periodNumber >= 12 / months ? 1 : periodNumber + 1;
  }
  return periods;
}

// "2026-27" when the financial year crosses a calendar year boundary (the FY start month isn't
// January), else just "2026" — the same convention the New Business screen's free-text
// financialYearLabel already used, now derived from a real date instead of typed by hand.
function financialYearLabelFor(fyStart: Date, periodCursor: Date): string {
  const anniversaryYear =
    periodCursor.getUTCMonth() < fyStart.getUTCMonth() ||
    (periodCursor.getUTCMonth() === fyStart.getUTCMonth() && periodCursor.getUTCDate() < fyStart.getUTCDate())
      ? periodCursor.getUTCFullYear() - 1
      : periodCursor.getUTCFullYear();
  if (fyStart.getUTCMonth() === 0) return String(anniversaryYear);
  return `${anniversaryYear}-${String((anniversaryYear + 1) % 100).padStart(2, '0')}`;
}

function periodLabel(frequency: ReportingFrequency, periodNumber: number, fyLabel: string, endDate: Date): string {
  if (frequency === 'annual') return fyLabel;
  if (frequency === 'biannual') return `H${periodNumber} ${fyLabel}`;
  if (frequency === 'quarterly') return `Q${periodNumber} ${fyLabel}`;
  const monthName = endDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${monthName} ${endDate.getUTCFullYear()}`;
}

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

function resolveScopedLocationId(locationName: string, business?: BusinessName): number | undefined {
  if (business) {
    const rootId = resolveBusinessLocationsRootId(business);
    return rootId ? (db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(locationName, rootId) as { id: number } | undefined)?.id : undefined;
  }
  return (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(locationName) as { id: number } | undefined)?.id;
}

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

export function ensureCurrencyPair(businessName: BusinessName, fromCurrency: string, toCurrency: string, userId: UserId): { id: number; name: string } {
  ensureCurrencyExchangeItem(userId);
  return ensureProductInstance(businessName, CURRENCY_EXCHANGE_SHAPE, [fromCurrency, toCurrency], userId);
}

export function setCurrencyExchangeRate(businessName: BusinessName, fromCurrency: string, toCurrency: string, userId: UserId, buyRateMinor?: number, sellRateMinor?: number): void {
  if (fromCurrency === toCurrency) throw new ValidationError(`A currency's own exchange rate against itself ("${fromCurrency}" to "${fromCurrency}") is always, definitionally 1 - never a real, separate, configurable rate.`);
  const pair = ensureCurrencyPair(businessName, fromCurrency, toCurrency, userId);
  if (buyRateMinor != null) addOrUpdateItemSource({ itemName: CURRENCY_EXCHANGE_ITEM_NAME, vendorName: 'FX Market (Buy)', priceMinor: buyRateMinor, isPreferred: true, productInstanceId: pair.id });
  if (sellRateMinor != null) addOrUpdateItemSource({ itemName: CURRENCY_EXCHANGE_ITEM_NAME, vendorName: 'FX Market (Sell)', priceMinor: sellRateMinor, isPreferred: true, productInstanceId: pair.id });
}

export function getCurrencyExchangeRate(businessName: BusinessName, fromCurrency: string, toCurrency: string, side: 'buy' | 'sell'): number | null {
  if (fromCurrency === toCurrency) return 1;
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

export function getLanguages(): { id: number; name: string }[] {
  return db
    .prepare(`SELECT id, name FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'Languages')`)
    .all() as { id: number; name: string }[];
}

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

export function getMenuTree(opts?: { businessName?: string; userId?: number }): MenuSectionRow[] {
  const businessId = opts?.businessName ? (db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')`).get(opts.businessName) as { id: number } | undefined)?.id : undefined;

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

export function setMenuOverride(menuItemKey: string, scope: 'business' | 'user', scopeId: number, overrideLabel: string | null, hidden: boolean, userId: UserId = asUserId(1)): void {
  const entityId = Number(menuItemKey);
  const menuItemName = (db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(entityId) as { name: string } | undefined)?.name;
  if (!menuItemName) throw new NotFoundError(`No real menu item with id ${entityId}.`);
  const overrideName = `${menuItemName} — Override: ${scope} ${scopeId}`;
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ? AND parent_id = ?`).get(overrideName, entityId)) {
    create(requireEntityById(entityId, typeRootName), typeMenuOverrideName, overrideName, userId);
  }
  if (overrideLabel) {
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

export interface VocabularyWord {
  name: string;
  translations: Record<string, string>;
}

function globalVocabularyId(): number {
  const row = db
    .prepare(`SELECT id FROM current_entities WHERE name = 'Vocabulary' AND parent_id = (SELECT id FROM current_entities WHERE name = 'Application')`)
    .get() as { id: number } | undefined;
  if (!row) throw new Error('The one, true, global Vocabulary entity is missing from the entity tree.');
  return row.id;
}

export function getVocabularyWords(): VocabularyWord[] {
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
    defaultAlternate: string;
}

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
  const conceptId = (
    db.prepare(`SELECT e.id FROM current_entities e WHERE e.name = ? AND e.parent_id = ?`).get(conceptName, globalVocabularyId()) as { id: number } | undefined
    ?? db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(conceptName) as { id: number } | undefined
  )?.id;
  if (!conceptId) throw new ValidationError(`No real entity named "${conceptName}".`);
  const languageId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(languageName) as { id: number } | undefined)?.id;
  if (!languageId) throw new ValidationError(`No real language named "${languageName}".`);

  const stale = db
    .prepare(`SELECT e.id, e.name FROM current_entities e WHERE e.parent_id = ? AND e.relation_id = ?`)
    .get(languageId, conceptId) as { id: number; name: string } | undefined;
  if (stale && stale.name === text) return; // already correct, nothing to do

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
    fs.appendFileSync(
      path.join(dataDir, '..', '..', 'docs', 'flagged-translation-collisions.log'),
      `"${conceptName}" and "${existing?.concept ?? '(unknown)'}" both genuinely translate to "${text}" in ${languageName} — a real, human-language ambiguity, not silently resolved. Keeping the existing translation.\n`
    );
    return;
  }
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

// Every language that still has a real, current translation value for this
// concept — mirrors setTranslation's own conceptId resolution (global
// Vocabulary first, then any entity of that name) and its "stale" lookup
// shape (a translation value is a real child of the LANGUAGE, with its own
// relation_id pointing at the concept), but across every language rather
// than one. Built as the delete-safety check deleteTranslationConcept below
// needs — a word with live, real translations should never be silently
// deleted out from under them. See
// /root/.claude/plans/stateful-snacking-adleman.md.
//
// Deliberately excludes English: create()/createEntityRaw's own
// isGlobalVocabularyWord branch auto-creates an English identity
// translation (the word's own text, in English) the instant any Vocabulary
// word is created, as a structural artifact of the word's own existence —
// never independent, real human translation work. Counting it here would
// make deleteTranslationConcept refuse every single word, forever, which
// defeats the whole point of the guard. Found directly while writing this
// function's own regression test.
export function getTranslationsReferencing(conceptName: string): { languageName: string; text: string }[] {
  const conceptId = (
    db.prepare(`SELECT e.id FROM current_entities e WHERE e.name = ? AND e.parent_id = ?`).get(conceptName, globalVocabularyId()) as { id: number } | undefined
    ?? db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(conceptName) as { id: number } | undefined
  )?.id;
  if (!conceptId) return [];
  const rows = db
    .prepare(
      `SELECT lang.name AS language_name, e.name AS text
       FROM current_entities e
       JOIN current_entities lang ON lang.id = e.parent_id
       WHERE e.relation_id = ? AND lang.parent_id = (SELECT id FROM current_entities WHERE name = 'Languages') AND lang.name != 'English'`
    )
    .all(conceptId) as { language_name: string; text: string }[];
  return rows.map((r) => ({ languageName: r.language_name, text: r.text }));
}

// A real, Vocabulary-word-specific delete, name-based like setTranslation
// itself (the Translations screen's own words list — see
// getVocabularyWords — never carries entity ids, only names). Checks
// getTranslationsReferencing first so a word still genuinely translated
// somewhere is never silently deleted along with those translations; once
// clear, revokeEntity itself still independently guards against a word
// that's become a real hierarchy/vocabulary-alternate target (see
// getEntityLinksPointingAt) or that still has children.
export function deleteTranslationConcept(conceptName: string, userId: UserId): void {
  const stillTranslated = getTranslationsReferencing(conceptName);
  if (stillTranslated.length) {
    const languages = stillTranslated.map((t) => t.languageName).join(', ');
    throw new ValidationError(`"${conceptName}" is still translated in ${languages} — remove those translations first.`);
  }
  const conceptId = (
    db.prepare(`SELECT e.id FROM current_entities e WHERE e.name = ? AND e.parent_id = ?`).get(conceptName, globalVocabularyId()) as { id: number } | undefined
  )?.id;
  if (!conceptId) throw new NotFoundError(`No real vocabulary word named "${conceptName}".`);
  // Deliberately does NOT also revoke the word's own auto-created English
  // identity translation value (same reasoning as getTranslationsReferencing
  // excluding it above). Tried directly, revoking both genuinely fails:
  // the identity value's own name is always identical to the concept's own
  // name (create()'s own `setTranslation(name, 'English', name, userId)`),
  // so revoking both moves two, real, identically-named entities into the
  // one, same, global "Revoked" bucket at once — a genuine
  // entities_name_unique collision (parent-scoped uniqueness, see
  // docs/pm-domain-reference.md), regardless of which order they're
  // revoked in. Left as real, orphaned, harmless data instead — it's
  // never looked up again once the concept itself is gone, since
  // localized_text's own query only ever reaches a translation VALUE
  // through a live concept's relation_id, never the other way around.
  // Known, narrow, deliberately out-of-scope edge case left here, flagged
  // for visibility rather than silently worked around: a BRAND NEW word
  // later created with this exact, same text would collide with this
  // orphaned value when create() tries to auto-create its own English
  // identity translation — a real, pre-existing kind of limitation (this
  // whole codebase already accepts some append-only history cruft
  // elsewhere), not something this change introduces new risk for beyond
  // that one narrow case.
  revokeEntity(conceptId, userId);
}

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

export function getBusinesses(): { id: number; name: BusinessName }[] {
  return db
    .prepare(`SELECT id, name FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')`)
    .all() as { id: number; name: BusinessName }[];
}

export function getLedgers(businessName: BusinessName): { id: number; name: LedgerName }[] {
  return db
    .prepare(`SELECT id, name FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'Ledgers' AND parent_id = (SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')))`)
    .all(businessName) as { id: number; name: LedgerName }[];
}

function ensureActiveLedgerMarker(businessId: number, userId: UserId): { id: number; name: string } {
  return Entity.getUnder('Active Ledger', businessId) ?? Entity.create('Active Ledger', businessId, userId);
}

export function setActiveLedger(businessName: BusinessName, ledgerName: LedgerName, userId: UserId): void {
  const business = requireEntity(businessName, typeBusinessName, requireEntity('Businesses', typeRootName));
  const ledgersRoot = requireEntity('Ledgers', typeRootName, business);
  const ledger = requireEntity(ledgerName, typeLedgerName, ledgersRoot);
  const marker = ensureActiveLedgerMarker(business.id, userId);
  supersedeEntity(marker.id, { relationId: ledger.id }, userId);
}

export function getActiveLedger(businessName: BusinessName): LedgerName | null {
  const business = requireEntity(businessName, typeBusinessName, requireEntity('Businesses', typeRootName));
  const marker = db.prepare(`SELECT relation_id FROM current_entities WHERE name = 'Active Ledger' AND parent_id = ?`).get(business.id) as { relation_id: number | null } | undefined;
  if (!marker?.relation_id) return null;
  const ledger = db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(marker.relation_id) as { name: string } | undefined;
  return ledger ? asLedgerName(ledger.name) : null;
}

export type EntityStructure = 'sole_trader' | 'partnership' | 'llc' | 'unlimited_liability' | 'publicly_traded';

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

export function createLocation(businessName: BusinessName, locationName: string, userId: UserId): TypedNode<'LocationEntityName'> {
  const locationsRootId = resolveBusinessLocationsRootId(businessName);
  if (!locationsRootId) throw new ValidationError(`"${businessName}" has no Locations root to create a location under.`);
  return create({ id: asEntityId(locationsRootId), name: 'Locations' as string & { __brand: 'RootName' } }, typeLocationEntityName, locationName, userId);
}

export function createAndConfigureLocation(businessName: BusinessName, locationName: string, location: StockLocation, userId: UserId, group?: string, groupingName?: string): TypedNode<'LocationEntityName'> {
  return db.transaction(() => {
    const entity = createLocation(businessName, locationName, userId);
    setLocation(locationName, location, businessName);
    // A location's capacity account always belongs to whichever ledger is
    // genuinely open for trading right now - not forever hardcoded to
    // "Actual", which would silently misfile it into an old, closed
    // ledger once a rollover has moved the business into a later period
    // (see docs/user-manual-ch3-tutorial.md's Ice-business mini year-end).
    ensureLocationCapacityAccount(businessName, getActiveLedger(businessName) ?? asLedgerName('Actual'), asLocationName(locationName), userId);
    if (group && groupingName) {
      ensureHierarchyGrouping(businessName, groupingName, userId);
      ensureHierarchyValue(businessName, groupingName, group, userId);
      setHierarchyParent(locationName, groupingName, group, userId);
      setRelationship(group, 'Belongs To Business', businessName, userId);
    }
    setRelationship(locationName, 'Belongs To Group', group || locationName, userId);
    return entity;
  })();
}

// Name-based, for the same reason deleteHierarchyValue/deleteHierarchyGrouping
// above are: the Locations screen and the Business Structure popup both work
// from listLocations's LocationRecord shape, which carries no entity id.
// revokeEntity's own guards do the real safety work here too — a location
// with a live capacity account/inventory/journal_line.location_id postings,
// or a Division tag still pointing at it, is already blocked (the
// journal_line.location_id check and the incoming-links check respectively).
// See /root/.claude/plans/stateful-snacking-adleman.md.
export function deleteLocation(businessName: BusinessName, locationName: string, userId: UserId): void {
  const locationsRootId = resolveBusinessLocationsRootId(businessName);
  if (!locationsRootId) throw new NotFoundError(`"${businessName}" has no Locations root.`);
  const location = Entity.getUnder(locationName, locationsRootId);
  if (!location) throw new NotFoundError(`No real location named "${locationName}" for "${businessName}".`);
  revokeEntity(location.id, userId);
}

// Department — a new, genuinely different concept from Location, not a
// copy of it. See /root/.claude/plans/stateful-snacking-adleman.md's
// "Context": only Location and Product/Item map to real, postable CoA
// accounts; Division/Category stay pure reporting tags on purpose, and
// this plan doesn't touch that. Department is the other real case —
// a department-as-cost-center genuinely needs its own balance, the
// same way a Location does.
//
// Deliberately NOT the Location pattern of "a separate business-
// structure entity, cross-linked by name to a same-named CoA node"
// (ensureLocationStorageRoot/createLocation) — that's the documented,
// unresolved bare-name-collision class (docs/pm-entity-model.md). A
// Department's own entity, directly under Chart of Accounts > Expense
// > Departments, IS both the org-chart box and the postable account.
// One tree, nothing to collide.
export function ensureDepartmentsRoot(businessName: BusinessName, userId: UserId): { id: number; name: string } {
  const expenseId = resolveBusinessCoaAccountId(businessName, 'Expense');
  return Entity.ensureUnder('Departments', expenseId, userId);
}

export function createDepartment(businessName: BusinessName, departmentName: string, userId: UserId): TypedNode<'DepartmentEntityName'> {
  const departmentsRoot = ensureDepartmentsRoot(businessName, userId);
  // Entity.ensureUnder (get-or-create), not create() directly - a second
  // call for the same name must be a no-op, not a ValidationError, so that
  // createAndConfigureDepartment is genuinely idempotent end to end.
  const entity = Entity.ensureUnder(departmentName, departmentsRoot.id, userId);
  return { id: asEntityId(entity.id), name: entity.name as string & { __brand: 'DepartmentEntityName' } };
}

// Ordinary leaf accounts in the business's own home currency — unlike
// Location's Storage Capacity accounts, which deliberately use a
// synthetic unit currency (SPACE-BOTTLE/SPACE-CARTON), a department's
// Payroll/Other Expenses post in plain money, so no setAccountCurrency
// call is needed: every account is lazily vivified into the `account`
// table on its first real posting (see backend/schema/00-core.sql's
// "on-first-post account vivification" trigger), exactly like any
// ordinary, hand-created Chart of Accounts leaf.
export function ensureDepartmentAccounts(businessName: BusinessName, departmentName: string, userId: UserId): { payrollId: number; otherExpensesId: number } {
  const departmentsRoot = ensureDepartmentsRoot(businessName, userId);
  const department = Entity.getUnder(departmentName, departmentsRoot.id);
  if (!department) throw new NotFoundError(`No real department named "${departmentName}" for "${businessName}".`);
  const payroll = Entity.ensureUnder('Payroll', department.id, userId);
  const otherExpenses = Entity.ensureUnder('Other Expenses', department.id, userId);
  return { payrollId: payroll.id, otherExpensesId: otherExpenses.id };
}

export function createAndConfigureDepartment(businessName: BusinessName, departmentName: string, userId: UserId): TypedNode<'DepartmentEntityName'> {
  return db.transaction(() => {
    const entity = createDepartment(businessName, departmentName, userId);
    ensureDepartmentAccounts(businessName, departmentName, userId);
    return entity;
  })();
}

// Name-based, same reasoning as deleteLocation/deleteHierarchyValue
// above — but unlike those, a department always has two real children
// of its own the instant it's created (ensureDepartmentAccounts's
// Payroll/Other Expenses are provisioned eagerly, not lazily like a
// Location's per-item accounts), so a plain, single revokeEntity call
// here would make hasChildren refuse *every* department, always — not
// a meaningful guard, just a permanent dead end. This revokes the two
// known, always-provisioned leaves first (each still protected by
// revokeEntity's own hasPostings guard — a department that's actually
// been posted to stays genuinely undeletable), then the department
// itself, so hasChildren still correctly blocks on any *further*,
// manually-added sub-account, and the incoming-links guard
// (getEntityLinksPointingAt) still blocks while any Employee is tagged
// to this department via setEmployeeDepartment below.
export function deleteDepartment(businessName: BusinessName, departmentName: string, userId: UserId): void {
  const departmentsRoot = ensureDepartmentsRoot(businessName, userId);
  const department = Entity.getUnder(departmentName, departmentsRoot.id);
  if (!department) throw new NotFoundError(`No real department named "${departmentName}" for "${businessName}".`);
  db.transaction(() => {
    // Check the department's own incoming-links guard FIRST, by its real,
    // original name, before touching either leaf — otherwise an
    // Employee-guard failure on the department (reached last, below)
    // would only be discovered after the two leaves were already revoked,
    // which (see the rename note just below) is not a no-op.
    const incoming = getEntityLinksPointingAt(department.name);
    if (incoming.length) {
      const taggers = [...new Set(incoming.map((l) => l.entityName))].join(', ');
      throw new ValidationError(`Cannot revoke "${department.name}" — still referenced by: ${taggers}.`);
    }
    const payroll = Entity.getUnder('Payroll', department.id);
    const otherExpenses = Entity.getUnder('Other Expenses', department.id);
    // revokeEntity reparents every revoked entity into one shared, global
    // "Application > Revoked" bucket, by name. Unlike Location's uniquely-
    // named per-item leaves, every department reuses the identical two
    // literal leaf names ("Payroll"/"Other Expenses") - so revoking a
    // second department's leaves would bare-name-collide with the first
    // department's already-revoked leaves sitting there under Revoked.
    // Renaming each entity to something globally unique (its own id,
    // already unique) immediately before revoking it means only its
    // resting place under Revoked is distinguished - nothing else, since
    // every guard above that cares about the real name (hasPostings is
    // id-based; the incoming-links guard on the department itself was
    // already checked above using its real, original name).
    if (payroll) {
      Entity.rename(payroll.id, `${departmentName} — Payroll (#${payroll.id})`, userId);
      revokeEntity(payroll.id, userId);
    }
    if (otherExpenses) {
      Entity.rename(otherExpenses.id, `${departmentName} — Other Expenses (#${otherExpenses.id})`, userId);
      revokeEntity(otherExpenses.id, userId);
    }
    Entity.rename(department.id, `${departmentName} (#${department.id})`, userId);
    revokeEntity(department.id, userId);
  })();
}

export function listDepartments(businessName: BusinessName): { id: number; name: string }[] {
  const departmentsRoot = ensureDepartmentsRoot(businessName, asUserId(1));
  return Entity.children(departmentsRoot.id).sort((a, b) => a.name.localeCompare(b.name));
}

// Employee ↔ Department and Employee ↔ Manager — two new, independent
// facts about an employee. Deliberately built on setEntityLink (the
// same generic primitive setHierarchyParent wraps), never setRelationship
// — an entity's relation_id is a single slot, and setRelationship
// overwrites it; employees already use that one slot for their existing
// "Place of Employment" relationship (createEmployee, above). Using
// setEntityLink instead creates a separate *child* link-record entity
// with its own relation_id, so Department and Manager can coexist with
// Place of Employment on the same employee without clobbering it — and
// revokeEntity's incoming-links guard (getEntityLinksPointingAt) already
// matches this "<entity> — <linkType>" record shape, so deleting a
// Department while an employee is tagged to it, or revoking a manager
// while someone still reports to them, is blocked for free.
export function setEmployeeDepartment(employeeName: string, departmentName: string, userId: UserId, employeeId?: number, departmentId?: number): void {
  setEntityLink(employeeName, 'Department', departmentName, userId, employeeId, departmentId);
}

export function getEmployeeDepartment(employeeName: string): string | undefined {
  return getEntityLink(employeeName, 'Department');
}

export function deleteEmployeeDepartment(employeeName: string, userId: UserId): void {
  deleteEntityLink(employeeName, 'Department', userId);
}

export function getEmployeeManager(employeeName: string): string | undefined {
  return getEntityLink(employeeName, 'Manager');
}

// Rejects a self-report outright, and rejects anything that would close
// a reporting cycle by walking the existing Manager chain upward from
// the proposed manager — if employeeName turns up anywhere in that
// chain, assigning it would make employeeName indirectly their own
// manager. No existing primitive enforces this (no prior "chain of
// command" concept existed anywhere in the codebase before this plan),
// so it's a genuinely new invariant, checked here rather than left to
// a future report to silently loop forever.
export function setEmployeeManager(employeeName: string, managerName: string, userId: UserId, employeeId?: number, managerId?: number): void {
  if (managerName === employeeName) throw new ValidationError(`"${employeeName}" cannot be their own manager.`);
  let cursor: string | undefined = managerName;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === employeeName) throw new ValidationError(`Making "${managerName}" report to "${employeeName}" would create a reporting cycle.`);
    if (seen.has(cursor)) break; // a genuine, pre-existing cycle elsewhere — not this call's to fix
    seen.add(cursor);
    cursor = getEmployeeManager(cursor);
  }
  setEntityLink(employeeName, 'Manager', managerName, userId, employeeId, managerId);
}

export function deleteEmployeeManager(employeeName: string, userId: UserId): void {
  deleteEntityLink(employeeName, 'Manager', userId);
}

export interface OrgChartDepartment {
  name: string;
  employees: { name: string; location: string | null; managerName: string | null }[];
}
export interface OrgChartStructure {
  business: string;
  departments: OrgChartDepartment[];
  unassignedEmployees: { name: string; location: string | null; managerName: string | null }[];
}

// One aggregate read replacing what would otherwise be an N+1-per-
// employee/per-department fetch pattern (the same shape
// BusinessStructurePopup.svelte's loadLocationsTab already has for
// Locations/Divisions, via one getHierarchyTag call per location —
// deliberately not repeated here for Departments/Employees).
export function getOrgChartStructure(businessName: BusinessName): OrgChartStructure {
  const departmentRows = listDepartments(businessName);
  // Place of Employment is the older setRelationship mechanism (a
  // relationship record is a child of the relationship TYPE's own root,
  // not of the employee) — getEntitiesWithRelationship is the right
  // bulk reader for it. Department/Manager are the newer setEntityLink
  // mechanism (record is a child of the EMPLOYEE, tagged with the link
  // type) — getEntitiesWithLink is the right bulk reader for those; see
  // the two functions' own comments for why they're genuinely different
  // shapes, not interchangeable.
  const employmentRows = getEntitiesWithRelationship('Place of Employment');
  const departmentLinks = getEntitiesWithLink('Department');
  const managerLinks = getEntitiesWithLink('Manager');
  const locationByEmployee = new Map(employmentRows.map((r) => [r.source, r.target]));
  const departmentByEmployee = new Map(departmentLinks.map((r) => [r.entityName, r.targetName]));
  const managerByEmployee = new Map(managerLinks.map((r) => [r.entityName, r.targetName]));

  const allEmployeeNames = new Set([...locationByEmployee.keys(), ...departmentByEmployee.keys(), ...managerByEmployee.keys()]);
  const describe = (name: string) => ({
    name,
    location: locationByEmployee.get(name) ?? null,
    managerName: managerByEmployee.get(name) ?? null,
  });

  const departments: OrgChartDepartment[] = departmentRows.map((d) => ({
    name: d.name,
    employees: [...allEmployeeNames].filter((e) => departmentByEmployee.get(e) === d.name).sort().map(describe),
  }));
  const unassignedEmployees = [...allEmployeeNames].filter((e) => !departmentByEmployee.has(e)).sort().map(describe);
  return { business: businessName, departments, unassignedEmployees };
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

export function getBusinessConfigurationReport(businessName: BusinessName): BusinessConfigurationReport {
  const business = requireEntity(businessName, typeBusinessName, requireEntity('Businesses', typeRootName));
  const entities = getEntityTree();

  const ownerOrPartners: string[] = [
    ...Detail.list(businessName, 'Owner name'),
    ...Detail.list(businessName, 'Names of partners'),
    ...Detail.list(businessName, 'Names of directors'),
  ];

  const hierarchies = getBusinessHierarchy(businessName);

  const locationsRootId = resolveBusinessLocationsRootId(businessName);
  const locationEntities = locationsRootId ? entities.filter((e) => e.parent_id === locationsRootId) : [];
  const locations = locationEntities.map((e) => {
    const loc = getLocation(e.name);
    return { name: e.name, city: loc?.city ?? '', locationType: loc?.location_type ?? '' };
  });

  const itemsRootId = (entities.find((e) => e.name === 'Items' && e.parent_id === business.id) ?? entities.find((e) => e.name === `${businessName} Items` && e.parent_id === business.id))?.id;
  const categories = itemsRootId
    ? entities.filter((e) => e.parent_id === itemsRootId && entities.some((c) => c.parent_id === e.id)).map((e) => e.name)
    : [];

  const coaRootId = entities.find((e) => e.name === 'Chart of Accounts' && e.parent_id === business.id)?.id;
  const assetId = coaRootId ? entities.find((e) => e.name === 'Asset' && e.parent_id === coaRootId)?.id : undefined;
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
  setBusinessHomeCurrency(businessName, homeCurrency, userId);
  if (selections.length === 1) {
    Entity.ensureUnder(headerName, parentCategory.id, userId);
    return;
  }
  const header = Entity.ensureUnder(headerName, parentCategory.id, userId);
  for (const selection of selections) {
    const leafName = `${headerName} — ${selection.bankAccountName} (${selection.currency})`;
    const leaf = Entity.ensureUnder(leafName, header.id, userId);
    if (selection.currency !== homeCurrency) setAccountCurrency(leafName, selection.currency, leaf.id);
  }
}

export function setupEquityStructure(businessName: BusinessName, structure: EntityStructure, userId: UserId, coaPrototype?: string, partnerNames?: string[]): void {
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
      break;
    case 'partnership':
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
      break;
  }
}

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
        if (child.relation_id === prototypeId) {
          const existing = db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(child.name, destParentId) as { id: number } | undefined;
          if (!existing) create(requireEntityById(destParentId, typeRootName), typeChartOfAccountsNodeName, child.name, userId);
        }
      } else {
        const realChildren = db.prepare(`SELECT name FROM current_entities WHERE parent_id = ?`).all(child.id) as { name: string }[];
        const hasRealStructuralChild = realChildren.some((c) => !c.name.startsWith(`${child.name} — `));
        const alwaysCopyRegardlessOfDemoData = child.name === 'Cost of Goods Sold';
        if (!hasRealStructuralChild && !alwaysCopyRegardlessOfDemoData) continue;

        let ownWord = db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(child.name, businessVocabulary.id) as { id: number } | undefined;
        if (!ownWord) ownWord = create(businessVocabulary, typeRootName, child.name, userId);

        let mirror = db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(child.name, destParentId) as { id: number } | undefined;
        if (!mirror) {
          mirror = create(requireEntityById(destParentId, typeRootName), typeChartOfAccountsNodeName, child.name, userId);
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

export const PER_BUSINESS_ROOTS: { name: string; type: TypeDescriptor<string> }[] = [
  { name: 'Locations', type: typeBusinessLocationsRootName },
  { name: 'Items', type: typeBusinessItemsRootName },
  { name: 'Contacts', type: typeBusinessContactsRootName },
  { name: 'Vocabulary', type: typeRootName },
  { name: 'Ledgers', type: typeRootName },
  { name: 'Profit Centers', type: typeRootName },
];

export function createBusiness(
  businessName: BusinessName,
  financialYearLabel: string,
  userId: UserId,
  coaPrototype?: string,
  secondaryCurrencies?: string[],
  entityStructure?: EntityStructure,
  partnerNames?: string[],
  financialYearStart?: string,
  reportingFrequency?: ReportingFrequency
): { business: BusinessName; actualLedger: LedgerName; budgetLedger: LedgerName } {
  return db.transaction((): { business: BusinessName; actualLedger: LedgerName; budgetLedger: LedgerName } => {
  const businessesRoot = requireEntity('Businesses', typeRootName);
  const business = create(businessesRoot, typeBusinessName, businessName, userId);
  for (const root of PER_BUSINESS_ROOTS) {
    create(business, root.type, root.name, userId);
  }
  const ledgersRoot = requireEntity('Ledgers', typeRootName, business);
  const actualLedger = asLedgerName(`Actual`);
  const budgetLedger = asLedgerName(`Budget ${financialYearLabel}`);
  create(ledgersRoot, typeLedgerName, actualLedger, userId);
  create(ledgersRoot, typeLedgerName, budgetLedger, userId);
  setActiveLedger(businessName, actualLedger, userId);
  if (coaPrototype) {
    supersedeEntity(
      (db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')`).get(businessName) as { id: number }).id,
      { relation: coaPrototype },
      userId
    );
  }
  instantiateChartOfAccounts(businessName, coaPrototype, userId);
  for (const currency of secondaryCurrencies ?? []) {
    const accountName = `Cash at Bank (${currency})`;
    const businessCoa = requireEntity('Chart of Accounts', typeChartOfAccountsRootName, business);
    const businessAsset = requireEntity('Asset', typeRootName, businessCoa);
    const account = Entity.getUnder(accountName, businessAsset.id) ?? create(businessAsset, typeAssetAccountName, accountName, userId);
    db.prepare(`INSERT INTO account (entity_id) VALUES (?) ON CONFLICT (entity_id) DO NOTHING`).run(account.id);
    db.prepare(`UPDATE account SET currency = ? WHERE entity_id = ?`).run(currency, account.id);
    if (coaPrototype) {
      supersedeEntity(account.id, { relation: coaPrototype }, userId);
    }
  }
  if (entityStructure) {
    setupEquityStructure(businessName, entityStructure, userId, coaPrototype, partnerNames);
  }
  // Optional — legacy callers (existing tests/scripts) omit both and get exactly the prior
  // behavior. See docs/pm-domain-reference.md ("Reporting periods").
  if (financialYearStart) {
    setBusinessReportingPeriod(businessName, financialYearStart, reportingFrequency ?? 'annual', userId);
  }
  resolveCashAtBankAccount(businessName, undefined, userId);
  return { business: businessName, actualLedger, budgetLedger };
  })();
}

export function createLedger(businessName: BusinessName, ledgerName: LedgerName, userId: UserId): void {
  const business = requireEntity(businessName, typeBusinessName);
  const ledgersRoot = requireEntity('Ledgers', typeRootName, business);
  const existing = Entity.getUnder(ledgerName, ledgersRoot.id);
  if (existing) throw new ValidationError(`"${ledgerName}" already exists under "${businessName}".`);
  create(ledgersRoot, typeLedgerName, ledgerName, userId);
}

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

export * from './db-journal.js';
import { stageLine, postJournalEntry } from './db-journal.js';
export * from './db-stock.js';
import { getLocation, setLocation, getItemLocation, dispatchItems, receiveItems, transferItems, postQuantityMovement, getOrderStatus, todayAtLocation, getEffectiveSaleCurrency, ensureLocationCapacityAccount, type Location as StockLocation } from './db-stock.js';

