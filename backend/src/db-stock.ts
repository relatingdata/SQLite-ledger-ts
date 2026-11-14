// The full documentation for every function in this file lives in docs/pm-stock-api.md — this file carries no further multiline comments.

import { DateTime } from 'luxon';
import { db } from './db.js';
import { ensureStorageCapacityStructure, ensureLocationStorageRoot, resolveBusinessLocationsRootId } from './db.js';
import { Entity, Link, Balance } from './primitives.js';
import type { EntityNode } from './entity-driver.js';
import { Session } from './session-context.js';
import {
  NotFoundError,
  ValidationError,
  PostingError,
  mergeContactDetail,
  assertPeriodOpen,
  getHierarchyGroupForLocation,
  getHierarchyAssignments,
  ensureItemQuantityAccounts,
  setAccountCurrency,
  ensureItemInventoryAccount,
  ensureItemLocationInventoryAccount,
  ensureItemLocationQuantityAccount,
  resolveItemLocationQuantityAccountId,
  postJournalEntry,
  commitStagedQuantityMovement,
  getItemUnitCostMinor,
  ensureProductInstance,
  ensureCombinationAccountLeaf,
  resolveBusinessCoaAccountId,
  resolveItemId,
  setEntityLink,
  stageLine,
  create,
  requireEntity,
  typeRootName,
  typeBusinessName,
  type TypedNode,
  typeLocationTypeMarkerName,
  typeIsBillingAddressMarkerName,
  asBusinessName,
  asLedgerName,
  asItemName,
  asLocationName,
  asUserId,
  asAccountName,
  type BusinessName,
  type LedgerName,
  type UserId,
  type AccountName,
  type ItemName,
  type ProviderName,
  type LocationName,
} from './db.js';

// `locationName` no longer tags a journal_line (the location_id column was
// removed per direct instruction) — WHICH account a quantity line hits now
// carries the location, via ensureItemLocationQuantityAccount. Kept as a
// parameter only for callers that still pass `account`/`accountId`
// resolved from one of these per-location accounts; it is otherwise unused
// here directly. See docs/pm-domain-reference.md, "Quantity-on-hand by
// location: real per-location accounts, not a side-channel column".
export function stageQuantityMovementLine(business: BusinessName, ledger: LedgerName, reference: string, account: AccountName, deltaQuantity: number, transdate: string, accountId?: number, memo?: string): void {
  const resolvedAccountId =
    accountId ??
    (
      db
        .prepare(
          `WITH RECURSIVE ancestors(id, orig) AS (
         SELECT id, id FROM current_entities WHERE name = ?
         UNION ALL
         SELECT e.parent_id, a.orig FROM current_entities e JOIN ancestors a ON e.id = a.id WHERE e.parent_id IS NOT NULL
       )
       SELECT DISTINCT orig AS entity_id FROM ancestors a
       JOIN current_entities e ON e.id = a.id
       WHERE e.name = 'Items'`
        )
        .get(account) as { entity_id: number } | undefined
    )?.entity_id ?? null;
  db.prepare(
    `INSERT INTO journal_entry_staging (reference, business, ledger, description, transdate, account, account_id, amount_minor, memo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(reference, business, ledger, 'Quantity movement', transdate, account, resolvedAccountId, deltaQuantity, memo ?? '');
}

export function postStagedQuantityMovement(business: BusinessName, ledger: LedgerName, reference: string, userId: UserId): void {
  // Stage D: post_quantity_movement_insert (00-core.sql) is gone — this now
  // calls the shared TypeScript orchestration (db-journal.ts) directly.
  // commitStagedQuantityMovement already wraps failures as PostingError, so
  // no try/catch is needed here any more; kept anyway so a non-PostingError
  // thrown from deeper in the stack (a genuine bug) still surfaces as one,
  // matching this function's pre-existing contract.
  try {
    commitStagedQuantityMovement(reference, business, ledger, userId);
  } catch (err) {
    if (err instanceof PostingError) throw err;
    throw new PostingError(err instanceof Error ? err.message : String(err));
  }
}

export function postQuantityMovement(
  business: BusinessName,
  ledger: LedgerName,
  reference: string,
  account: AccountName,
  deltaQuantity: number,
  userId: UserId,
  transdate?: string,
  locationName?: LocationName,
  accountId?: number,
  memo?: string
): void {
  const date = transdate ?? (locationName ? todayAtLocation(locationName) : new Date().toISOString().slice(0, 10));
  assertPeriodOpen(business, ledger, date);
  stageQuantityMovementLine(business, ledger, reference, account, deltaQuantity, date, accountId, memo);
  postStagedQuantityMovement(business, ledger, reference, userId);
}

export interface Location {
  city: string;
  location_type: string;
  is_billing_address: boolean;
  bottle_capacity: number | null;
  carton_capacity: number | null;
  timezone: string;
}

export function getLocationTypes(): string[] {
  const root = Entity.get('Location Types');
  if (!root) return [];
  return Entity.children(root.id)
    .map((c) => c.name)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function createLocationType(name: string, userId: UserId): void {
  if (Entity.get(name)) throw new ValidationError(`"${name}" already exists.`);
  Entity.create(name, 'Location Types', userId);
}

// See docs/pm-stock-api.md — "setLocation/getLocation are both scoped by business directly in the SQL"
export function setLocation(name: string, location: Location, business?: BusinessName): void {
  const id = (
    business
      ? (() => {
          const rootId = resolveBusinessLocationsRootId(business);
          return rootId ? Entity.getUnder(name, rootId) : undefined;
        })()
      : Entity.get(name)
  )?.id;
  if (!id) throw new ValidationError(`No location named "${name}".`);
  mergeContactDetail(id, { city: location.city, bottle_capacity: location.bottle_capacity, carton_capacity: location.carton_capacity, timezone: location.timezone });
  const locationTypesRoot = Entity.get('Location Types');
  if (!locationTypesRoot || !Entity.getUnder(location.location_type, locationTypesRoot.id)) {
    throw new ValidationError(`No location type named "${location.location_type}" — add it first (a real, user-extensible Vocabulary word, not a fixed, built-in list).`);
  }
  const typeRecordName = `Location Type — ${name} → ${location.location_type}`;
  // This match (name built from the CURRENT relation's own name, via a
  // correlated subquery) has no equivalent EntityDriver primitive — it's
  // a one-off string-reconstruction match, not a plain name/parent/tag
  // lookup — so it stays raw SQL rather than inventing new driver scope
  // for a single call site.
  const staleType = db
    .prepare(
      `SELECT id, name FROM current_entities
       WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'Location Type')
       AND name = 'Location Type — ' || ? || ' → ' || (SELECT name FROM current_entities WHERE id = relation_id)
       AND name != ?`
    )
    .all(name, typeRecordName) as { id: number; name: string }[];
  for (const s of staleType) Entity.relate(s.id, null, asUserId(1));
  if (!Entity.get(typeRecordName)) {
    create(requireEntity('Location Type', typeRootName), typeLocationTypeMarkerName, typeRecordName, asUserId(1));
  }
  const typeRecord = Entity.get(typeRecordName)!;
  Entity.relate(typeRecord.id, location.location_type, asUserId(1));

  const billingRecordName = `Is Billing Address — ${name} → Billing Address`;
  if (location.is_billing_address) {
    const relType = Entity.get('Is Billing Address');
    const others = relType ? Entity.children(relType.id).filter((e) => e.name !== billingRecordName) : [];
    for (const other of others) Entity.relate(other.id, null, asUserId(1));
    if (!Entity.get(billingRecordName)) {
      create(requireEntity('Is Billing Address', typeRootName), typeIsBillingAddressMarkerName, billingRecordName, asUserId(1));
    }
    const billingRecord = Entity.get(billingRecordName)!;
    Entity.relate(billingRecord.id, 'Billing Address', asUserId(1));
  } else {
    const existing = Entity.get(billingRecordName);
    if (existing) Entity.relate(existing.id, null, asUserId(1));
  }
}

// See docs/pm-stock-api.md — "setLocation/getLocation are both scoped by business directly in the SQL"
export function getLocation(name: string, business?: BusinessName): Location | undefined {
  // Names are only unique WITHIN a parent (entities_name_unique), not
  // globally — the no-business branch below can't resolve via Entity.get
  // alone, because a same-named entity with no `contact` row elsewhere in
  // the tree would be ambiguous. The original SQL disambiguated by
  // requiring a real `contact` row (an inner join), so that's reproduced
  // here instead of simplifying it away. The business-scoped branch has
  // no such ambiguity (parent_id already pins it down), so it resolves
  // the entity via Entity.getUnder first and only touches `contact` by id.
  const row = (
    business
      ? (() => {
          const rootId = resolveBusinessLocationsRootId(business);
          const entity = rootId ? Entity.getUnder(name, rootId) : undefined;
          return entity ? db.prepare(`SELECT city, bottle_capacity, carton_capacity, timezone FROM contact WHERE entity_id = ?`).get(entity.id) : undefined;
        })()
      : db.prepare(`SELECT c.city, c.bottle_capacity, c.carton_capacity, c.timezone FROM contact c JOIN current_entities e ON e.id = c.entity_id WHERE e.name = ?`).get(name)
  ) as { city: string; bottle_capacity: number | null; carton_capacity: number | null; timezone: string } | undefined;
  if (!row) return undefined;
  // Same correlated-subquery string match as setLocation's staleType
  // lookup above — stays raw SQL for the same reason (a one-off
  // reconstruction match, not a plain lookup any EntityDriver primitive
  // covers).
  const typeRow = db
    .prepare(
      `SELECT rel.name AS marker
       FROM current_entities rec
       JOIN current_entities rel ON rel.id = rec.relation_id
       WHERE rec.parent_id = (SELECT id FROM current_entities WHERE name = 'Location Type')
       AND rec.name = 'Location Type — ' || ? || ' → ' || rel.name`
    )
    .get(name) as { marker: string } | undefined;
  const isBillingAddress = !!Entity.get(`Is Billing Address — ${name} → Billing Address`);
  return { city: row.city, location_type: typeRow?.marker ?? '', is_billing_address: isBillingAddress, bottle_capacity: row.bottle_capacity, carton_capacity: row.carton_capacity, timezone: row.timezone };
}

export function todayAtLocation(locationName: LocationName): string {
  const location = getLocation(locationName);
  const timezone = location?.timezone ?? 'UTC';
  return DateTime.now().setZone(timezone).toFormat('yyyy-MM-dd');
}

export interface ItemLocationLevels {
  quantity_on_hand: number;
  min_level: number | null;
  max_level: number | null;
  reorder_level: number | null;
  shelf_side: string | null;
  rack: string | null;
  level: number | null;
}

export function getItemLocation(itemName: ItemName, locationName: LocationName): ItemLocationLevels {
  // Real, provisioned per-location quantity account's own balance — see
  // ensureItemLocationQuantityAccount in db.ts. undefined (never
  // provisioned, i.e. this item has never moved to this location) reads
  // as zero on hand, same as before.
  const quantityAccountId = resolveItemLocationQuantityAccountId(itemName, locationName);
  const quantity_on_hand = quantityAccountId != null ? Balance.get(quantityAccountId) : 0;
  const levelsRecordName = `${itemName} — ${locationName} — Levels`;
  const levelsRow = Entity.get(levelsRecordName);
  function getLevelFigure(field: 'Min Level' | 'Max Level' | 'Reorder Level' | 'Shelf Level'): number | null {
    if (!levelsRow) return null;
    const figureRow = Entity.get(`${levelsRecordName} — ${field}`, levelsRecordName);
    return figureRow ? Balance.get(figureRow.id) : null;
  }
  return {
    quantity_on_hand,
    min_level: getLevelFigure('Min Level'),
    max_level: getLevelFigure('Max Level'),
    reorder_level: getLevelFigure('Reorder Level'),
    shelf_side: Link.get(levelsRecordName, 'Shelf Side') ?? null,
    rack: Link.get(levelsRecordName, 'Rack') ?? null,
    level: getLevelFigure('Shelf Level'),
  };
}

// See docs/pm-stock-api.md — "setItemLocationLevelDetails ... takes business/ledger/userId as optional, explicit parameters"
export function setItemLocationLevelDetails(itemName: ItemName, locationName: LocationName, levels: Omit<ItemLocationLevels, 'quantity_on_hand'>, business?: BusinessName, ledger?: LedgerName, userId?: UserId): void {
  const resolvedUserId = userId ?? asUserId(Session.UserId);
  const resolvedBusiness = business ?? Session.Business.name;
  const resolvedLedger = ledger ?? Session.Ledger;
  const item = Entity.get(itemName);
  if (!item) throw new ValidationError(`No item named "${itemName}".`);
  const levelsRecordName = `${itemName} — ${locationName} — Levels`;
  const levelsRecord = Entity.ensureUnder(levelsRecordName, item.id, resolvedUserId);
  function setLevelFigure(field: 'Min Level' | 'Max Level' | 'Reorder Level' | 'Shelf Level', value: number | null): void {
    const figureName = `${levelsRecordName} — ${field}`;
    const existing = Entity.getUnder(figureName, levelsRecord.id);
    if (value == null) {
      if (existing) {
        const currentBalance = Balance.get(existing.id);
        if (currentBalance !== 0) Balance.post(resolvedBusiness, resolvedLedger, `LEVEL-CLEAR-${existing.id}-${Date.now()}`, figureName, existing.id, -currentBalance, resolvedUserId);
      }
      return;
    }
    const figure = existing ?? Entity.create(figureName, levelsRecord.id, resolvedUserId);
    const delta = value - Balance.get(figure.id);
    if (delta !== 0) Balance.post(resolvedBusiness, resolvedLedger, `LEVEL-${figure.id}-${Date.now()}`, figureName, figure.id, delta, resolvedUserId);
  }
  setLevelFigure('Min Level', levels.min_level);
  setLevelFigure('Max Level', levels.max_level);
  setLevelFigure('Reorder Level', levels.reorder_level);
  setLevelFigure('Shelf Level', levels.level);
  if (levels.shelf_side) {
    if (!Entity.get(levels.shelf_side)) Entity.create(levels.shelf_side, 'Vocabulary', resolvedUserId);
    Link.set(levelsRecordName, 'Shelf Side', levels.shelf_side, resolvedUserId);
  } else {
    Link.delete(levelsRecordName, 'Shelf Side', resolvedUserId);
  }
  if (levels.rack) {
    if (!Entity.get(levels.rack)) Entity.create(levels.rack, 'Vocabulary', resolvedUserId);
    Link.set(levelsRecordName, 'Rack', levels.rack, resolvedUserId);
  } else {
    Link.delete(levelsRecordName, 'Rack', resolvedUserId);
  }
}

// Mirrors getEntityLink's own exact semantics (db.ts) — the active-tag
// check, not just the link record's own relation_id — but exposes the
// target's full EntityNode instead of only its name. The public
// Link.get/getHierarchyParent API returns a name only, and a location
// name is not guaranteed globally unique, so re-resolving a location
// purely by name afterward would risk landing on the wrong same-named
// location. Not a category-4 join (no account/journal/invoice/contact
// table involved) — a narrow, deliberate exception for a lookup the
// current EntityDriver interface doesn't yet expose by id, same class as
// the already-accepted combination_ids/created_at/created_by raw reads
// elsewhere in this engagement.
function resolveHierarchyLocationLink(leafName: string): EntityNode | undefined {
  const recordName = `${leafName} — Hierarchy: Location`;
  return db
    .prepare(
      `SELECT target.id, target.name, target.parent_id, target.relation_id
       FROM current_entities child
       JOIN current_entities target ON target.id = child.relation_id
       JOIN current_entities tag ON tag.parent_id = child.id AND tag.name = 'Hierarchy: Location' AND tag.relation_id IS NOT NULL
       WHERE child.name = ?`
    )
    .get(recordName) as EntityNode | undefined;
}

// Guards a `findAll({ nameSuffix })` lookup down to a true exact match
// (nameSuffix is `LIKE '%suffix'` under the hood) — same helper and same
// reasoning as db-reports.ts's identical function.
function exactly<T extends { name: string }>(name: string, nodes: T[]): T[] {
  return nodes.filter((n) => n.name === name);
}

// The full "Sales Revenue" subtree(s) — every descendant, unscoped (there
// may be more than one entity named "Sales Revenue", same as the original
// SQL's own unscoped `WHERE e.name = 'Sales Revenue'`).
function salesRevenueAccountIds(): Set<number> {
  const ids = new Set<number>();
  for (const root of exactly('Sales Revenue', Entity.findAll({ nameSuffix: 'Sales Revenue' }))) {
    for (const node of Entity.descendantsWithDepth(root.id)) ids.add(node.id);
  }
  return ids;
}

// Exported for db-matrix-reports.ts's getStockOnHandMatrix, which needs
// the exact same leaf/item/link/loc shape (same reasoning as every other
// shared-shape reuse in this file — one real query, not a duplicate).
export interface QtyLocationAccountRow {
  leafId: number;
  item: string;
  itemId: number;
  location: string;
  locationId: number;
  locationParentId: number | null;
  balance_minor: number;
}

// Shared by getLocationCapacityStatus / getInventoryListingByLocation /
// getStockMovementReport's movementRows / countInventoryListing — all four
// used to run their own, near-identical category-4 current_entities join
// (leaf/item/link/loc joined against `account` in one statement) to read
// the same real, per-location quantity accounts (a leaf entity named
// "{item} — {location} — Qty", a child of the item, hierarchy-location-
// linked to the location — see ensureItemLocationQuantityAccount, db.ts).
// The walk + join now happens once here via the EntityDriver (plus
// resolveHierarchyLocationLink above for the link itself); each call site
// below filters/maps these shared rows instead of repeating its own SQL.
export function allQtyLocationAccounts(): QtyLocationAccountRow[] {
  const qtyLeaves = Entity.findAll({ nameSuffix: ' — Qty' });
  if (qtyLeaves.length === 0) return [];
  const leafIds = qtyLeaves.map((l) => l.id);
  const balanceByLeafId = new Map(
    (
      db.prepare(`SELECT entity_id, balance_minor FROM account WHERE entity_id IN (${leafIds.map(() => '?').join(',')})`).all(...leafIds) as {
        entity_id: number;
        balance_minor: number;
      }[]
    ).map((a) => [a.entity_id, a.balance_minor])
  );
  const itemById = new Map(Entity.getMany(qtyLeaves.map((l) => l.parent_id).filter((id): id is number => id !== null)).map((e) => [e.id, e]));

  const rows: QtyLocationAccountRow[] = [];
  for (const leaf of qtyLeaves) {
    const balance_minor = balanceByLeafId.get(leaf.id);
    if (balance_minor === undefined) continue; // original INNER JOIN account
    const item = leaf.parent_id !== null ? itemById.get(leaf.parent_id) : undefined;
    if (!item) continue; // original INNER JOIN item
    const location = resolveHierarchyLocationLink(leaf.name);
    if (!location) continue; // original INNER JOIN link/loc
    rows.push({ leafId: leaf.id, item: item.name, itemId: item.id, location: location.name, locationId: location.id, locationParentId: location.parent_id, balance_minor });
  }
  return rows;
}

export interface LocationCapacityStatus {
  bottleQuantity: number;
  bottleCapacity: number | null;
  bottleOverCapacity: boolean;
  cartonQuantity: number;
  cartonCapacity: number | null;
  cartonOverCapacity: boolean;
}

export function getLocationCapacityStatus(locationName: LocationName): LocationCapacityStatus {
  const location = getLocation(locationName);
  // Reads each item's own real, provisioned per-location quantity
  // account balance directly — see ensureItemLocationQuantityAccount,
  // db.ts, and docs/pm-domain-reference.md, "Quantity-on-hand by
  // location: real per-location accounts, not a side-channel column".
  const rows = allQtyLocationAccounts()
    .filter((r) => r.location === locationName)
    .map((r) => ({ item: r.item, qty: r.balance_minor }));

  const bottleQuantity = rows.reduce((s, r) => s + r.qty, 0);
  const cartonQuantity = rows.reduce((s, r) => {
    const packageQty = preferredProviderPackageQuantity(asItemName(r.item)) ?? 12; // default when no vendor relationship exists
    return s + r.qty / packageQty;
  }, 0);

  const bottleCapacity = location?.bottle_capacity ?? null;
  const cartonCapacity = location?.carton_capacity ?? null;
  return {
    bottleQuantity,
    bottleCapacity,
    bottleOverCapacity: bottleCapacity !== null && bottleQuantity > bottleCapacity,
    cartonQuantity: Math.round(cartonQuantity * 100) / 100,
    cartonCapacity,
    cartonOverCapacity: cartonCapacity !== null && cartonQuantity > cartonCapacity,
  };
}

function preferredProviderPackageQuantity(itemName: ItemName): number | null {
  // Deliberately NOT Entity.get(itemName): item names are unique only
  // within their own parent (category/business), never globally, so an
  // unscoped lookup can return the wrong same-named entity when more than
  // one exists. The original JOIN disambiguated correctly by requiring a
  // matching item_source row to exist at all — preserved here exactly,
  // same fix and same reasoning as getLocation's no-business branch above.
  const row = db
    .prepare(
      `SELECT ps.package_quantity
       FROM item_source ps
       JOIN current_entities p ON p.id = ps.item_id
       WHERE p.name = ?
       ORDER BY ps.is_preferred DESC, ps.id ASC
       LIMIT 1`
    )
    .get(itemName) as { package_quantity: number | null } | undefined;
  return row?.package_quantity ?? null;
}

export function createPosTerminal(terminalName: string, locationName: LocationName, userId: UserId): void {
  const parentName = `${locationName} Terminals`;
  if (!Entity.get(parentName)) Entity.create(parentName, locationName, userId);
  if (!Entity.get(terminalName)) Entity.create(terminalName, parentName, userId);
}

export function listPosTerminals(locationName: string): { name: string; currency: string | null }[] {
  const parentName = `${locationName} Terminals`;
  const parent = Entity.get(parentName);
  if (!parent) return [];
  return db
    .prepare(`SELECT e.name, a.currency FROM current_entities e LEFT JOIN account a ON a.entity_id = e.id WHERE e.parent_id = ?`)
    .all(parent.id) as { name: string; currency: string | null }[];
}

export function setTerminalCurrency(terminalName: string, currency: string | null): void {
  setAccountCurrency(terminalName, currency);
}

export function getEffectiveSaleCurrency(terminalName: string | undefined): string | null {
  if (!terminalName) return null;
  const entity = Entity.get(terminalName);
  if (!entity) return null;
  const row = db.prepare(`SELECT currency FROM account WHERE entity_id = ?`).get(entity.id) as { currency: string | null } | undefined;
  return row?.currency ?? null;
}

// Docs: docs/storage-space-as-currency-design.md § 24. See docs/pm-stock-api.md § "Item-location levels and capacity status" for the {business} Locations root-naming note.
export function ensureLocationCapacityAccount(business: BusinessName, ledger: LedgerName, locationName: LocationName, userId: UserId): { capacityAccount: string; capacityAccountId: number; occupiedAccountId: number; unit: 'bottle' | 'carton' } {
  const locationsRootId = resolveBusinessLocationsRootId(business);
  const locationId = locationsRootId ? Entity.getUnder(locationName, locationsRootId)?.id : undefined;
  if (!locationId) throw new ValidationError(`No location named "${locationName}".`);
  const loc = getLocation(locationName, business);
  const unit: 'bottle' | 'carton' = loc?.bottle_capacity != null ? 'bottle' : 'carton';
  const leafName = unit === 'bottle' ? 'Bottle' : 'Carton';
  const storageRoot = ensureLocationStorageRoot(business, locationName, userId);
  const { remainingId, installedId, occupiedId } = ensureStorageCapacityStructure(storageRoot, userId);
  const currency = `SPACE-${unit.toUpperCase()}`;
  const occupied = Entity.getUnder(leafName, occupiedId) ?? Entity.create(leafName, occupiedId, userId);
  setAccountCurrency(occupied.name, currency, occupied.id);
  let entity = Entity.getUnder(leafName, remainingId);
  if (!entity) {
    entity = Entity.create(leafName, remainingId, userId);
    setAccountCurrency(entity.name, currency, entity.id);
    const installed = Entity.getUnder(leafName, installedId) ?? Entity.create(leafName, installedId, userId);
    setAccountCurrency(installed.name, currency, installed.id);
    const opening = unit === 'bottle' ? loc?.bottle_capacity ?? 0 : loc?.carton_capacity ?? 0;
    if (opening > 0) {
      const reference = `${locationName}-CAPACITY-OPENING`;
      stageLine({ reference, business, ledger, account: asAccountName(entity.name), accountId: entity.id, amount_minor: opening });
      stageLine({ reference, business, ledger, account: asAccountName(installed.name), accountId: installed.id, amount_minor: -opening });
      postJournalEntry(reference, business, ledger, userId);
    }
  }
  return { capacityAccount: entity.name, capacityAccountId: entity.id, occupiedAccountId: occupied.id, unit };
}

// Docs: docs/storage-space-as-currency-design.md § 24. Code and tests: where to look
export function adjustLocationCapacity(business: BusinessName, ledger: LedgerName, locationName: LocationName, itemName: ItemName, itemQuantityDelta: number, transdate: string, userId: UserId, referenceSuffix: string): void {
  if (itemQuantityDelta === 0) return;
  const { capacityAccount, capacityAccountId, occupiedAccountId, unit } = ensureLocationCapacityAccount(business, ledger, locationName, userId);
  const conversionFactor = unit === 'carton' ? preferredProviderPackageQuantity(itemName) ?? 12 : 1;
  const capacityDelta = -(itemQuantityDelta / conversionFactor);
  const reference = `${referenceSuffix}-CAPACITY-${locationName}`;
  stageLine({ reference, business, ledger, transdate, account: asAccountName(capacityAccount), accountId: capacityAccountId, amount_minor: capacityDelta });
  stageLine({ reference, business, ledger, transdate, account: asAccountName(capacityAccount), accountId: occupiedAccountId, amount_minor: -capacityDelta });
  postJournalEntry(reference, business, ledger, userId);
}

export interface InventoryListingRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  min_level: number | null;
  max_level: number | null;
  reorder_level: number | null;
}

export interface InventoryListingLocationGroup {
  location: string;
  city: string | null;
  group: string | null;
  rows: InventoryListingRow[];
  total_on_hand: number;
  capacity: LocationCapacityStatus;
}

export interface StorageSpaceRow {
  location: string;
  currency: string;
  kind: 'Installed' | 'Occupied' | 'Remaining';
  balance_minor: number;
}

export interface StorageSpaceLocationGroup {
  location: string;
  currencies: { currency: string; installed_minor: number; occupied_minor: number; remaining_minor: number; balanced: boolean }[];
}

// See docs/pm-stock-api.md § "The Storage Space Report"
const STORAGE_KINDS = ['Installed', 'Occupied', 'Remaining'] as const;

export function getStorageSpaceReport(): StorageSpaceLocationGroup[] {
  // Was a category-4 join across four current_entities levels (leaf ->
  // kind -> capacity -> loc) against journal/journal_line/account in one
  // statement. The parent-chain walk (unscoped — there may be more than
  // one entity named "Storage Capacity", same as the original's own
  // unscoped `capacity.name = 'Storage Capacity'`) now happens via the
  // EntityDriver; only the resulting leaf-id-to-(location,kind) map
  // crosses back into SQL, which otherwise stays a plain
  // journal/journal_line/account query. The final (location, currency,
  // kind) grouping — which can combine more than one leaf account — is
  // done here in TS instead of SQL's GROUP BY, with the `!= 0` filter
  // applied after that combination, exactly matching the original's own
  // grouping granularity (not a per-account one).
  const leafContext = new Map<number, { location: string; kind: string }>();
  for (const capacity of exactly('Storage Capacity', Entity.findAll({ nameSuffix: 'Storage Capacity' }))) {
    if (capacity.parent_id === null) continue;
    const loc = Entity.get(capacity.parent_id);
    if (!loc) continue;
    for (const kind of Entity.children(capacity.id)) {
      if (!(STORAGE_KINDS as readonly string[]).includes(kind.name)) continue;
      for (const leaf of Entity.children(kind.id)) {
        leafContext.set(leaf.id, { location: loc.name, kind: kind.name });
      }
    }
  }
  const leafIds = [...leafContext.keys()];
  const perAccountRows =
    leafIds.length === 0
      ? []
      : (db
          .prepare(
            `SELECT jl.account_id, a.currency AS currency, SUM(jl.amount_minor) AS balance_minor
             FROM journal j
             JOIN journal_line jl ON jl.journal_id = j.id
             JOIN account a ON a.entity_id = jl.account_id
             WHERE j.business_id = ? AND a.currency IS NOT NULL AND jl.account_id IN (${leafIds.map(() => '?').join(',')})
             GROUP BY jl.account_id, a.currency`
          )
          .all(Session.Business.id, ...leafIds) as { account_id: number; currency: string; balance_minor: number }[]);

  const grouped = new Map<string, { location: string; currency: string; kind: string; balance_minor: number }>();
  for (const r of perAccountRows) {
    const ctx = leafContext.get(r.account_id)!;
    const key = `${ctx.location}|${r.currency}|${ctx.kind}`;
    const existing = grouped.get(key);
    if (existing) existing.balance_minor += r.balance_minor;
    else grouped.set(key, { location: ctx.location, currency: r.currency, kind: ctx.kind, balance_minor: r.balance_minor });
  }
  const rows = [...grouped.values()].filter((r) => r.balance_minor !== 0);

  const groups = new Map<string, StorageSpaceLocationGroup>();
  for (const r of rows) {
    let group = groups.get(r.location);
    if (!group) { group = { location: r.location, currencies: [] }; groups.set(r.location, group); }
    let cur = group.currencies.find((c) => c.currency === r.currency);
    if (!cur) { cur = { currency: r.currency, installed_minor: 0, occupied_minor: 0, remaining_minor: 0, balanced: false }; group.currencies.push(cur); }
    if (r.kind === 'Installed') cur.installed_minor = r.balance_minor;
    else if (r.kind === 'Occupied') cur.occupied_minor = r.balance_minor;
    else if (r.kind === 'Remaining') cur.remaining_minor = r.balance_minor;
  }
  for (const group of groups.values()) {
    for (const cur of group.currencies) {
      cur.balanced = cur.occupied_minor + cur.remaining_minor === -cur.installed_minor;
    }
  }
  return [...groups.values()].sort((a, b) => a.location.localeCompare(b.location));
}

// See docs/pm-stock-api.md § "Stock listing and the movement report"
export function getInventoryListingByLocation(business?: BusinessName, hierarchyName?: string): InventoryListingLocationGroup[] {
  const resolvedBusiness = business ?? asBusinessName(Session.Business.name);
  // Quantity-on-hand is read directly from each real, provisioned
  // per-location quantity account's own balance_minor (see
  // ensureItemLocationQuantityAccount in db.ts) — not summed from
  // journal_line, which no longer carries a location of its own. Scoped
  // to this business via its own real Locations root (a location is
  // always a direct child of it), the same scoping resolveBusinessLocationsRootId
  // already provides elsewhere — see docs/pm-stock-api.md § "Stock listing
  // and the movement report" ("Business-scoping is not yet complete end to
  // end") for the pre-existing, acknowledged limits of this scoping.
  const locationsRootId = resolveBusinessLocationsRootId(resolvedBusiness);
  const qtyRows: { item: string; location: string; quantity_on_hand: number }[] = locationsRootId
    ? allQtyLocationAccounts()
        .filter((r) => r.locationParentId === locationsRootId && r.balance_minor !== 0)
        .map((r) => ({ item: r.item, location: r.location, quantity_on_hand: r.balance_minor }))
        .sort((a, b) => a.location.localeCompare(b.location) || a.item.localeCompare(b.item))
    : [];
  // getItemLocation has no business parameter — see docs/pm-stock-api.md § "Stock listing and the movement report" ("Business-scoping is not yet complete end to end")
  const rows: InventoryListingRow[] = qtyRows.map((r) => {
    const levels = getItemLocation(asItemName(r.item), asLocationName(r.location));
    return {
      item: r.item,
      location: r.location,
      quantity_on_hand: r.quantity_on_hand,
      min_level: levels.min_level,
      max_level: levels.max_level,
      reorder_level: levels.reorder_level,
    };
  });

  // getLocationCapacityStatus/getHierarchyGroupForLocation: same open gap, see note above.
  const groups = new Map<string, InventoryListingLocationGroup>();
  for (const row of rows) {
    let group = groups.get(row.location);
    if (!group) {
      const location = getLocation(row.location, resolvedBusiness);
      const groupName = hierarchyName ? (getHierarchyGroupForLocation(row.location, hierarchyName) ?? null) : null;
      group = { location: row.location, city: location?.city ?? null, group: groupName, rows: [], total_on_hand: 0, capacity: getLocationCapacityStatus(asLocationName(row.location)) };
      groups.set(row.location, group);
    }
    group.rows.push(row);
    group.total_on_hand += row.quantity_on_hand;
  }
  return [...groups.values()].sort((a, b) => a.location.localeCompare(b.location));
}

export interface StockMovementRow {
  item: string;
  category: string | null;
  quantity: number;
  date: string;
}
export interface OrderReceiptRow extends StockMovementRow {
  location: string;
  group: string | null;
  vendor: string | null;
}
export interface StockTransferRow extends StockMovementRow {
  from_location: string;
  to_location: string;
}
export interface StockSaleRow extends StockMovementRow {
  location: string;
  group: string | null;
  vendor: string | null;
  amount_minor: number;
}
export interface StockMovementReport {
  receipts: OrderReceiptRow[];
  transfers: StockTransferRow[];
  sales: StockSaleRow[];
}

// Category is a genuinely optional, generic Hierarchy tag — the exact
// same getHierarchyAssignments/getHierarchyParent mechanism Division or
// any other business-defined grouping already uses, never a real
// tree-position lookup. An item with no Category tag at all is
// correctly absent from this map, rather than reporting whatever real
// entity happens to sit above it.
function allItemCategories(): Map<string, string | null> {
  return new Map(Object.entries(getHierarchyAssignments('Category')));
}

function allPreferredProviders(): Map<string, string> {
  const rows = db.prepare(`SELECT item_id, vendor_id FROM item_source ORDER BY is_preferred DESC, id ASC`).all() as { item_id: number; vendor_id: number }[];
  const ids = new Set<number>();
  for (const r of rows) {
    ids.add(r.item_id);
    ids.add(r.vendor_id);
  }
  const names = new Map(Entity.getMany([...ids]).map((n) => [n.id, n.name] as const));
  const map = new Map<string, string>();
  for (const r of rows) {
    const item = names.get(r.item_id);
    const vendor = names.get(r.vendor_id);
    if (item && vendor && !map.has(item)) map.set(item, vendor); // first row per item, already ordered preferred-first
  }
  return map;
}

// See docs/pm-stock-api.md § "Stock listing and the movement report"
export function getStockMovementReport(business: string, ledgerName: string, fromDate?: string, toDate?: string, hierarchyName?: string): StockMovementReport {
  const businessEntity = Entity.get(business, 'Businesses');
  const ledgersRoot = businessEntity ? Entity.getUnder('Ledgers', businessEntity.id) : undefined;
  const ledgerId = ledgersRoot ? Entity.getUnder(ledgerName, ledgersRoot.id)?.id : undefined;
  if (!ledgerId) throw new ValidationError(`No real ledger named "${ledgerName}" under "${business}".`);

  const dateFilter = `AND (? IS NULL OR j.transdate >= ?) AND (? IS NULL OR j.transdate <= ?)`;
  const dateParams = [fromDate ?? null, fromDate ?? null, toDate ?? null, toDate ?? null];
  const categories = allItemCategories();
  const vendors = allPreferredProviders();

  // Each quantity-movement line hits a real, provisioned per-location
  // quantity account (a child of the item, named "{item} — {location} —
  // Qty") — see ensureItemLocationQuantityAccount, db.ts. item/location
  // are read from that account's own parent and Hierarchy:Location tag,
  // and the " — Qty" filter keeps this a quantity-only report: an
  // inventory VALUE account carries the same Location tag, but is never a
  // quantity movement. See docs/pm-domain-reference.md, "Quantity-on-hand
  // by location: real per-location accounts, not a side-channel column".
  // Was a category-4 current_entities join; now the SQL stays entity-free
  // (plain journal/journal_line by ledger+date) and every account_id is
  // matched against the shared qty-location map built above.
  const qtyAccountByLeafId = new Map(allQtyLocationAccounts().map((r) => [r.leafId, r]));
  const movementRowsRaw = db
    .prepare(
      `SELECT jl.journal_id, j.reference, jl.account_id, jl.amount_minor AS quantity, j.transdate AS date
       FROM journal_line jl
       JOIN journal j ON j.id = jl.journal_id
       WHERE j.ledger_id = ? ${dateFilter}`
    )
    .all(ledgerId, ...dateParams) as { journal_id: number; reference: string; account_id: number; quantity: number; date: string }[];
  const movementRows = movementRowsRaw
    .flatMap((r) => {
      const acct = qtyAccountByLeafId.get(r.account_id);
      return acct ? [{ journal_id: r.journal_id, reference: r.reference, item: acct.item, location: acct.location, quantity: r.quantity, date: r.date }] : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.location.localeCompare(b.location) || a.item.localeCompare(b.item));
  const movementsByJournalId = new Map<number, typeof movementRows>();
  for (const r of movementRows) {
    if (!movementsByJournalId.has(r.journal_id)) movementsByJournalId.set(r.journal_id, []);
    movementsByJournalId.get(r.journal_id)!.push(r);
  }

  const receipts: OrderReceiptRow[] = [];
  const transfers: StockTransferRow[] = [];
  const saleRows: { reference: string; item: string; location: string; quantity: number; date: string }[] = [];
  for (const lines of movementsByJournalId.values()) {
    const distinctLocations = new Set(lines.map((l) => l.location));
    if (distinctLocations.size === 2) {
      const outLeg = lines.find((l) => l.quantity < 0);
      const inLeg = lines.find((l) => l.quantity > 0);
      if (!outLeg || !inLeg) continue;
      transfers.push({
        item: inLeg.item,
        category: categories.get(inLeg.item) ?? null,
        quantity: inLeg.quantity,
        date: inLeg.date,
        from_location: outLeg.location,
        to_location: inLeg.location,
      });
    } else {
      for (const r of lines) {
        if (r.quantity > 0) {
          receipts.push({
            item: r.item,
            category: categories.get(r.item) ?? null,
            quantity: r.quantity,
            date: r.date,
            location: r.location,
            group: hierarchyName ? (getHierarchyGroupForLocation(r.location, hierarchyName) ?? null) : null,
            vendor: vendors.get(r.item) ?? null,
          });
        } else if (r.quantity < 0) {
          saleRows.push(r);
        }
      }
    }
  }

  // Was a category-4 `WITH RECURSIVE ancestors ... current_entities`
  // CTE joined to journal/journal_line in the same statement — the
  // ancestor walk now happens via the EntityDriver (salesRevenueAccountIds
  // below); only the resulting plain id set and the resolved account
  // names cross back into/out of SQL.
  const salesAccountIds = salesRevenueAccountIds();
  const salesPostingsRaw = db
    .prepare(
      `SELECT j2.reference AS ref, jl2.account_id, jl2.amount_minor AS amount
       FROM journal_line jl2
       JOIN journal j2 ON j2.id = jl2.journal_id
       WHERE j2.ledger_id = ? AND jl2.amount_minor < 0 ${dateFilter.replace(/j\./g, 'j2.')}`
    )
    .all(ledgerId, ...dateParams) as { ref: string; account_id: number; amount: number }[];
  const relevantSalesRows = salesPostingsRaw.filter((r) => salesAccountIds.has(r.account_id));
  const salesAccountNameById = new Map(Entity.getMany(relevantSalesRows.map((r) => r.account_id)).map((e) => [e.id, e.name]));
  const salesPostings = relevantSalesRows.map((r) => ({ ref: r.ref, account: salesAccountNameById.get(r.account_id)!, amount: r.amount }));
  const salesByRefAndItem = new Map<string, number>();
  for (const s of salesPostings) {
    const itemFromAccount = s.account.replace(/ — .+$/, '').replace(/ \([^)]*\)$/, '');
    salesByRefAndItem.set(`${s.ref}|${itemFromAccount}`, s.amount);
  }
  function saleAmountFor(invoiceRef: string, itemName: string): number {
    const amount = salesByRefAndItem.get(`${invoiceRef}|${itemName}`);
    return amount ? -amount : 0;
  }

  const sales: StockSaleRow[] = saleRows.map((r) => ({
    item: r.item,
    category: categories.get(r.item) ?? null,
    quantity: -r.quantity,
    date: r.date,
    location: r.location,
    group: hierarchyName ? (getHierarchyGroupForLocation(r.location, hierarchyName) ?? null) : null,
    vendor: vendors.get(r.item) ?? null,
    amount_minor: saleAmountFor(r.reference.replace(/-DISPATCH-.+$/, ''), r.item),
  }));

  return { receipts, transfers, sales };
}

export function getInventoryListing(limit = 100, offset = 0): InventoryListingRow[] {
  const all = getInventoryListingByLocation()
    .flatMap((g) => g.rows.map((r) => ({ ...r, location: g.location })))
    .sort((a, b) => (a.item === b.item ? a.location.localeCompare(b.location) : a.item.localeCompare(b.item)));
  return all.slice(offset, offset + limit);
}

export function countInventoryListing(): number {
  // Same real per-location quantity accounts getInventoryListingByLocation
  // reads — see ensureItemLocationQuantityAccount, db.ts.
  const locationsRootId = resolveBusinessLocationsRootId(asBusinessName(Session.Business.name));
  if (!locationsRootId) return 0;
  return allQtyLocationAccounts().filter((r) => r.locationParentId === locationsRootId && r.balance_minor !== 0).length;
}

export function setItemLocationLevels(
  itemName: ItemName,
  locationName: LocationName,
  levels: {
    minLevel?: number | null;
    maxLevel?: number | null;
    reorderLevel?: number | null;
    shelfSide?: string | null;
    rack?: string | null;
    level?: number | null;
  },
  business?: BusinessName,
  ledger?: LedgerName,
  userId?: UserId
): void {
  const itemId = resolveItemId(itemName);
  if (!itemId) throw new ValidationError(`No item named "${itemName}".`);
  const locationId = Entity.get(locationName)?.id;
  if (!locationId) throw new ValidationError(`No location named "${locationName}".`);
  setItemLocationLevelDetails(
    itemName,
    locationName,
    {
      min_level: levels.minLevel ?? null,
      max_level: levels.maxLevel ?? null,
      reorder_level: levels.reorderLevel ?? null,
      shelf_side: levels.shelfSide ?? null,
      rack: levels.rack ?? null,
      level: levels.level ?? null,
    },
    business,
    ledger,
    userId
  );
}

// Docs: docs/storage-space-as-currency-design.md § 24. Code and tests: where to look
export function ensureUnitsTrackingBaseAccounts(business: BusinessName, userId: UserId): { onHandId: number; receivedFromId: number } {
  const businessEntity = requireEntity(business, typeBusinessName, requireEntity('Businesses', typeRootName));
  const onHand = (Entity.getUnder('Units On Hand', businessEntity.id) ?? create(businessEntity as TypedNode<string>, typeRootName, 'Units On Hand', userId)) as { id: number; name: string };
  const receivedFrom = (Entity.getUnder('Units Received From', businessEntity.id) ?? create(businessEntity as TypedNode<string>, typeRootName, 'Units Received From', userId)) as { id: number; name: string };
  return { onHandId: onHand.id, receivedFromId: receivedFrom.id };
}

// Docs: docs/storage-space-as-currency-design.md § 24. Code and tests: where to look
export function receiveItems(
  business: BusinessName,
  ledger: LedgerName,
  reference: string,
  itemName: ItemName,
  locationName: LocationName,
  quantity: number,
  userId: UserId,
  transdate?: string,
  combinationValues?: string[],
  combinationShape?: [string, string][]
): void {
  if (quantity <= 0) throw new ValidationError('Received quantity must be positive.');
  const itemId = resolveItemId(itemName);
  if (!itemId) throw new ValidationError(`No item named "${itemName}".`);
  const locationId = Entity.get(locationName)?.id;
  if (!locationId) throw new ValidationError(`No location named "${locationName}".`);

  db.transaction(() => {
  const date = transdate ?? todayAtLocation(locationName);
  assertPeriodOpen(business, ledger, date);
  const { onOrderAccount, onOrderAccountId } = ensureItemQuantityAccounts(itemName, userId);
  const { quantityAccount, quantityAccountId } = ensureItemLocationQuantityAccount(itemName, locationName, userId, undefined, business);
  stageQuantityMovementLine(business, ledger, reference, asAccountName(quantityAccount), quantity, date, quantityAccountId);
  stageQuantityMovementLine(business, ledger, reference, asAccountName(onOrderAccount), -quantity, date, onOrderAccountId);
  postStagedQuantityMovement(business, ledger, reference, userId);
  adjustLocationCapacity(business, ledger, locationName, itemName, quantity, date, userId, reference);

  if (combinationValues && combinationShape) {
    const instanceTop = ensureProductInstance(business, combinationShape, combinationValues, userId);
    const unitCostMinor = getItemUnitCostMinor(itemName);
    if (unitCostMinor != null) {
      const valueMinor = quantity * unitCostMinor;
      const invLeaf = ensureCombinationAccountLeaf('Inventory', instanceTop, userId, resolveBusinessCoaAccountId(business, 'Inventory'));
      const valueRef = `${reference}-VALUE`;
      const apId = resolveBusinessCoaAccountId(business, 'Accounts Payable');
      stageLine({ reference: valueRef, business, ledger, transdate: date, account: asAccountName(invLeaf.name), accountId: invLeaf.id, amount_minor: valueMinor, memo: `Combination stock receipt: ${itemName}` });
      stageLine({ reference: valueRef, business, ledger, transdate: date, account: asAccountName('Accounts Payable'), accountId: apId, amount_minor: -valueMinor, memo: `Combination stock receipt: ${itemName}` });
      postJournalEntry(valueRef, business, ledger, userId);
    }
    const { onHandId, receivedFromId } = ensureUnitsTrackingBaseAccounts(business, userId);
    const unitsOnHand = ensureCombinationAccountLeaf('On Hand', instanceTop, userId, onHandId);
    const receivedFrom = ensureCombinationAccountLeaf('On Hand', instanceTop, userId, receivedFromId);
    const unitsCurrency = `UNITS-${combinationValues.join('-').toUpperCase()}`;
    setAccountCurrency(unitsOnHand.name, unitsCurrency, unitsOnHand.id);
    setAccountCurrency(receivedFrom.name, unitsCurrency, receivedFrom.id);
    const countRef = `${reference}-COUNT`;
    stageLine({ reference: countRef, business, ledger, transdate: date, account: asAccountName(unitsOnHand.name), accountId: unitsOnHand.id, amount_minor: quantity, memo: `Combination stock receipt (count): ${itemName}` });
    stageLine({ reference: countRef, business, ledger, transdate: date, account: asAccountName(receivedFrom.name), accountId: receivedFrom.id, amount_minor: -quantity, memo: `Combination stock receipt (count): ${itemName}` });
    postJournalEntry(countRef, business, ledger, userId);
  }
  })();
}

export interface ReceiveStockPhysicalInput {
  business: BusinessName;
  ledger: LedgerName;
  reference: string;
  itemName: ItemName;
  locationName: LocationName;
  quantity: number;
  transdate?: string;
  combinationValues?: string[];
  combinationShape?: [string, string][];
}

// See docs/pm-stock-api.md § "Receive/transfer: physical-only variants that post value from the frontend"
export function receiveStockPhysical(input: ReceiveStockPhysicalInput, userId: UserId): void {
  const { business, ledger, reference, itemName, locationName, quantity, transdate, combinationValues, combinationShape } = input;
  if (quantity <= 0) throw new ValidationError('Received quantity must be positive.');
  const itemId = resolveItemId(itemName);
  if (!itemId) throw new ValidationError(`No item named "${itemName}".`);
  const locationId = Entity.get(locationName)?.id;
  if (!locationId) throw new ValidationError(`No location named "${locationName}".`);

  db.transaction(() => {
    const date = transdate ?? todayAtLocation(locationName);
    assertPeriodOpen(business, ledger, date);
    const { onOrderAccount, onOrderAccountId } = ensureItemQuantityAccounts(itemName, userId);
    const { quantityAccount, quantityAccountId } = ensureItemLocationQuantityAccount(itemName, locationName, userId, undefined, business);
    stageQuantityMovementLine(business, ledger, reference, asAccountName(quantityAccount), quantity, date, quantityAccountId);
    stageQuantityMovementLine(business, ledger, reference, asAccountName(onOrderAccount), -quantity, date, onOrderAccountId);
    postStagedQuantityMovement(business, ledger, reference, userId);
    adjustLocationCapacity(business, ledger, locationName, itemName, quantity, date, userId, reference);

    if (combinationValues && combinationShape) {
      const instanceTop = ensureProductInstance(business, combinationShape, combinationValues, userId);
      const { onHandId, receivedFromId } = ensureUnitsTrackingBaseAccounts(business, userId);
      const unitsOnHand = ensureCombinationAccountLeaf('On Hand', instanceTop, userId, onHandId);
      const receivedFrom = ensureCombinationAccountLeaf('On Hand', instanceTop, userId, receivedFromId);
      const unitsCurrency = `UNITS-${combinationValues.join('-').toUpperCase()}`;
      setAccountCurrency(unitsOnHand.name, unitsCurrency, unitsOnHand.id);
      setAccountCurrency(receivedFrom.name, unitsCurrency, receivedFrom.id);
      const countRef = `${reference}-COUNT`;
      stageLine({ reference: countRef, business, ledger, transdate: date, account: asAccountName(unitsOnHand.name), accountId: unitsOnHand.id, amount_minor: quantity, memo: `Combination stock receipt (count): ${itemName}` });
      stageLine({ reference: countRef, business, ledger, transdate: date, account: asAccountName(receivedFrom.name), accountId: receivedFrom.id, amount_minor: -quantity, memo: `Combination stock receipt (count): ${itemName}` });
      postJournalEntry(countRef, business, ledger, userId);
    }
  })();
}

export interface ResolvedReceiveAccounts {
  inventoryAccount: string;
  payableAccount: string;
  unitCostMinor: number | null;
}

// See docs/pm-stock-api.md § "Receive/transfer: physical-only variants that post value from the frontend"
export function resolveReceiveAccounts(
  business: BusinessName,
  itemName: ItemName,
  combinationShape: [string, string][] | undefined,
  combinationValues: string[] | undefined,
  userId: UserId
): ResolvedReceiveAccounts | null {
  if (!combinationShape || !combinationValues) return null;
  const instanceTop = ensureProductInstance(business, combinationShape, combinationValues, userId);
  const invLeaf = ensureCombinationAccountLeaf('Inventory', instanceTop, userId, resolveBusinessCoaAccountId(business, 'Inventory'));
  return {
    inventoryAccount: invLeaf.name,
    payableAccount: 'Accounts Payable',
    unitCostMinor: getItemUnitCostMinor(itemName),
  };
}

// Docs: docs/storage-space-as-currency-design.md § 24. Code and tests: where to look
export function dispatchItems(
  business: BusinessName,
  ledger: LedgerName,
  reference: string,
  itemName: ItemName,
  locationName: LocationName,
  quantity: number,
  userId: UserId,
  transdate?: string,
  combinationValues?: string[],
  combinationShape?: [string, string][]
): void {
  if (quantity <= 0) throw new ValidationError('Dispatched quantity must be positive.');
  const current = getItemLocation(itemName, locationName);
  if (quantity > current.quantity_on_hand) {
    throw new ValidationError(`Only ${current.quantity_on_hand} of "${itemName}" on hand at "${locationName}" — cannot dispatch ${quantity}.`);
  }
  resolveItemId(itemName); // validates the real item exists; throws otherwise
  const date = transdate ?? todayAtLocation(locationName);
  assertPeriodOpen(business, ledger, date);
  db.transaction(() => {
  const { unitsSoldAccount, unitsSoldAccountId } = ensureItemQuantityAccounts(itemName, userId);
  const { quantityAccount, quantityAccountId } = ensureItemLocationQuantityAccount(itemName, locationName, userId, undefined, business);
  stageQuantityMovementLine(business, ledger, reference, asAccountName(quantityAccount), -quantity, date, quantityAccountId);
  stageQuantityMovementLine(business, ledger, reference, asAccountName(unitsSoldAccount), quantity, date, unitsSoldAccountId);
  postStagedQuantityMovement(business, ledger, reference, userId);
  adjustLocationCapacity(business, ledger, locationName, itemName, -quantity, date, userId, reference);

  if (combinationValues && combinationShape) {
    const instanceTop = ensureProductInstance(business, combinationShape, combinationValues, userId);
    const unitCostMinor = getItemUnitCostMinor(itemName);
    if (unitCostMinor != null) {
      const valueMinor = quantity * unitCostMinor;
      const invLeaf = ensureCombinationAccountLeaf('Inventory', instanceTop, userId, resolveBusinessCoaAccountId(business, 'Inventory'));
      const valueRef = `${reference}-VALUE`;
      const cogsId = resolveBusinessCoaAccountId(business, 'Cost of Goods Sold');
      stageLine({ reference: valueRef, business, ledger, transdate: date, account: asAccountName(invLeaf.name), accountId: invLeaf.id, amount_minor: -valueMinor, memo: `Combination stock dispatch: ${itemName}` });
      stageLine({ reference: valueRef, business, ledger, transdate: date, account: asAccountName('Cost of Goods Sold'), accountId: cogsId, amount_minor: valueMinor, memo: `Combination stock dispatch: ${itemName}` });
      postJournalEntry(valueRef, business, ledger, userId);
    }
    const { onHandId, receivedFromId } = ensureUnitsTrackingBaseAccounts(business, userId);
    const unitsOnHand = ensureCombinationAccountLeaf('On Hand', instanceTop, userId, onHandId);
    const receivedFrom = ensureCombinationAccountLeaf('On Hand', instanceTop, userId, receivedFromId);
    const unitsCurrency = `UNITS-${combinationValues.join('-').toUpperCase()}`;
    setAccountCurrency(unitsOnHand.name, unitsCurrency, unitsOnHand.id);
    setAccountCurrency(receivedFrom.name, unitsCurrency, receivedFrom.id);
    const countRef = `${reference}-COUNT`;
    stageLine({ reference: countRef, business, ledger, transdate: date, account: asAccountName(unitsOnHand.name), accountId: unitsOnHand.id, amount_minor: -quantity, memo: `Combination stock dispatch (count): ${itemName}` });
    stageLine({ reference: countRef, business, ledger, transdate: date, account: asAccountName(receivedFrom.name), accountId: receivedFrom.id, amount_minor: quantity, memo: `Combination stock dispatch (count): ${itemName}` });
    postJournalEntry(countRef, business, ledger, userId);
  }
  })();
}

// Docs: docs/storage-space-as-currency-design.md § 24. Code and tests: where to look
export function transferItems(
  business: BusinessName,
  ledger: LedgerName,
  itemName: ItemName,
  fromLocationName: LocationName,
  toLocationName: LocationName,
  quantity: number,
  reference: string,
  userId = 1,
  transdate?: string,
  combinationShape?: [string, string][],
  combinationValuesAfterLocation?: string[]
): void {
  if (quantity <= 0) throw new ValidationError('Transfer quantity must be positive.');
  const fromLoc = getLocation(fromLocationName, business);
  const toLoc = getLocation(toLocationName, business);
  if (!fromLoc) throw new ValidationError(`No location named "${fromLocationName}".`);
  if (!toLoc) throw new ValidationError(`No location named "${toLocationName}".`);
  if (fromLoc.city !== toLoc.city) {
    throw new ValidationError(`"${fromLocationName}" (${fromLoc.city}) and "${toLocationName}" (${toLoc.city}) are in different cities — a transfer can only move stock within the same city.`);
  }
  const current = getItemLocation(itemName, fromLocationName);
  if (quantity > current.quantity_on_hand) {
    throw new ValidationError(`Only ${current.quantity_on_hand} of "${itemName}" on hand at "${fromLocationName}" — cannot transfer ${quantity}.`);
  }
  resolveItemId(itemName); // validates the real item exists; throws otherwise
  for (const loc of [fromLocationName, toLocationName]) {
    if (!Entity.get(loc)) throw new ValidationError(`No location named "${loc}".`);
  }

  const date = transdate ?? todayAtLocation(fromLocationName);
  assertPeriodOpen(business, ledger, date);
  db.transaction(() => {
  const fromQty = ensureItemLocationQuantityAccount(itemName, fromLocationName, asUserId(userId), undefined, business);
  const toQty = ensureItemLocationQuantityAccount(itemName, toLocationName, asUserId(userId), undefined, business);
  stageQuantityMovementLine(business, ledger, reference, asAccountName(fromQty.quantityAccount), -quantity, date, fromQty.quantityAccountId);
  stageQuantityMovementLine(business, ledger, reference, asAccountName(toQty.quantityAccount), quantity, date, toQty.quantityAccountId);
  postStagedQuantityMovement(business, ledger, reference, asUserId(userId));
  adjustLocationCapacity(business, ledger, fromLocationName, itemName, -quantity, date, asUserId(userId), reference);
  adjustLocationCapacity(business, ledger, toLocationName, itemName, quantity, date, asUserId(userId), reference);

  // Non-combination path also moves the plain per-location Inventory value — see docs/pm-stock-api.md § "Receive/transfer: physical-only variants..."
  if (!(combinationShape && combinationValuesAfterLocation)) {
    const unitCostMinor = getItemUnitCostMinor(itemName);
    if (unitCostMinor != null) {
      const valueMinor = quantity * unitCostMinor;
      const fromAccount = ensureItemLocationInventoryAccount(itemName, fromLocationName, asUserId(userId), undefined, business);
      const toAccount = ensureItemLocationInventoryAccount(itemName, toLocationName, asUserId(userId), undefined, business);
      const valueRef = `${reference}-VALUE`;
      stageLine({ reference: valueRef, business, ledger, transdate: date, account: asAccountName(fromAccount.inventoryAccount), accountId: fromAccount.inventoryAccountId, amount_minor: -valueMinor, memo: `Transfer: ${itemName}` });
      stageLine({ reference: valueRef, business, ledger, transdate: date, account: asAccountName(toAccount.inventoryAccount), accountId: toAccount.inventoryAccountId, amount_minor: valueMinor, memo: `Transfer: ${itemName}` });
      postJournalEntry(valueRef, business, ledger, asUserId(userId));
    }
  }

  if (combinationShape && combinationValuesAfterLocation) {
    const unitCostMinor = getItemUnitCostMinor(itemName);
    if (unitCostMinor != null) {
      const valueMinor = quantity * unitCostMinor;
      const fromInstance = ensureProductInstance(business, combinationShape, [fromLocationName, ...combinationValuesAfterLocation], asUserId(userId));
      const toInstance = ensureProductInstance(business, combinationShape, [toLocationName, ...combinationValuesAfterLocation], asUserId(userId));
      const inventoryAccountId = resolveBusinessCoaAccountId(business, 'Inventory');
      const fromLeaf = ensureCombinationAccountLeaf('Inventory', fromInstance, asUserId(userId), inventoryAccountId);
      const toLeaf = ensureCombinationAccountLeaf('Inventory', toInstance, asUserId(userId), inventoryAccountId);
      const valueRef = `${reference}-VALUE`;
      stageLine({ reference: valueRef, business, ledger, transdate: date, account: asAccountName(fromLeaf.name), accountId: fromLeaf.id, amount_minor: -valueMinor, memo: `Combination transfer: ${itemName}` });
      stageLine({ reference: valueRef, business, ledger, transdate: date, account: asAccountName(toLeaf.name), accountId: toLeaf.id, amount_minor: valueMinor, memo: `Combination transfer: ${itemName}` });
      postJournalEntry(valueRef, business, ledger, asUserId(userId));
    }
    const fromInstance = ensureProductInstance(business, combinationShape, [fromLocationName, ...combinationValuesAfterLocation], asUserId(userId));
    const toInstance = ensureProductInstance(business, combinationShape, [toLocationName, ...combinationValuesAfterLocation], asUserId(userId));
    const { onHandId } = ensureUnitsTrackingBaseAccounts(business, asUserId(userId));
    const fromUnits = ensureCombinationAccountLeaf('On Hand', fromInstance, asUserId(userId), onHandId);
    const toUnits = ensureCombinationAccountLeaf('On Hand', toInstance, asUserId(userId), onHandId);
    const unitsCurrency = `UNITS-${combinationValuesAfterLocation.join('-').toUpperCase()}`;
    setAccountCurrency(fromUnits.name, unitsCurrency, fromUnits.id);
    setAccountCurrency(toUnits.name, unitsCurrency, toUnits.id);
    const countRef = `${reference}-COUNT`;
    stageLine({ reference: countRef, business, ledger, transdate: date, account: asAccountName(fromUnits.name), accountId: fromUnits.id, amount_minor: -quantity, memo: `Combination transfer (count): ${itemName}` });
    stageLine({ reference: countRef, business, ledger, transdate: date, account: asAccountName(toUnits.name), accountId: toUnits.id, amount_minor: quantity, memo: `Combination transfer (count): ${itemName}` });
    postJournalEntry(countRef, business, ledger, asUserId(userId));
  }
  })();
}

export interface TransferStockInput {
  business: BusinessName;
  ledger: LedgerName;
  itemName: ItemName;
  fromLocationName: LocationName;
  toLocationName: LocationName;
  quantity: number;
  reference: string;
  transdate?: string;
}

// See docs/pm-stock-api.md § "Receive/transfer: physical-only variants that post value from the frontend"
export function transferStock(input: TransferStockInput, userId: UserId): void {
  const { business, ledger, itemName, fromLocationName, toLocationName, quantity, reference, transdate } = input;
  if (quantity <= 0) throw new ValidationError('Transfer quantity must be positive.');
  const fromLoc = getLocation(fromLocationName, business);
  const toLoc = getLocation(toLocationName, business);
  if (!fromLoc) throw new ValidationError(`No location named "${fromLocationName}".`);
  if (!toLoc) throw new ValidationError(`No location named "${toLocationName}".`);
  if (fromLoc.city !== toLoc.city) {
    throw new ValidationError(`"${fromLocationName}" (${fromLoc.city}) and "${toLocationName}" (${toLoc.city}) are in different cities — a transfer can only move stock within the same city.`);
  }
  const current = getItemLocation(itemName, fromLocationName);
  if (quantity > current.quantity_on_hand) {
    throw new ValidationError(`Only ${current.quantity_on_hand} of "${itemName}" on hand at "${fromLocationName}" — cannot transfer ${quantity}.`);
  }
  resolveItemId(itemName); // validates the real item exists; throws otherwise

  const date = transdate ?? todayAtLocation(fromLocationName);
  assertPeriodOpen(business, ledger, date);
  db.transaction(() => {
    const fromQty = ensureItemLocationQuantityAccount(itemName, fromLocationName, userId, undefined, business);
    const toQty = ensureItemLocationQuantityAccount(itemName, toLocationName, userId, undefined, business);
    stageQuantityMovementLine(business, ledger, reference, asAccountName(fromQty.quantityAccount), -quantity, date, fromQty.quantityAccountId);
    stageQuantityMovementLine(business, ledger, reference, asAccountName(toQty.quantityAccount), quantity, date, toQty.quantityAccountId);
    postStagedQuantityMovement(business, ledger, reference, userId);
    adjustLocationCapacity(business, ledger, fromLocationName, itemName, -quantity, date, userId, reference);
    adjustLocationCapacity(business, ledger, toLocationName, itemName, quantity, date, userId, reference);
  })();
}

export interface BelowReorderRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  reorder_level: number;
  min_level: number | null;
  max_level: number | null;
}

export function getBelowReorderStock(): BelowReorderRow[] {
  return getInventoryListingByLocation()
    .flatMap((g) => g.rows.map((r) => ({ ...r, location: g.location })))
    .filter((r): r is BelowReorderRow => r.reorder_level != null && r.quantity_on_hand <= r.reorder_level)
    .sort((a, b) => a.quantity_on_hand - a.reorder_level! - (b.quantity_on_hand - b.reorder_level!));
}

export function setItemSourceLeadTime(itemName: ItemName, vendorName: ProviderName, days: number, userId: UserId): void {
  const linkType = `Lead Time — ${vendorName}`;
  setEntityLink(itemName, linkType, vendorName, userId);
  const record = Entity.get(`${itemName} — ${linkType}`, itemName);
  if (record) {
    Entity.tag(record.id, 'Lead Time', userId);
    Entity.setAttr(record.id, 'Days', String(days), userId);
  }
}

export function getItemLeadTimes(itemName: ItemName): { vendor: string; days: number }[] {
  const item = Entity.get(itemName);
  if (!item) return [];
  const rows = Entity.children(item.id)
    .filter((child) => child.relation_id !== null && Entity.hasTag(child.id, 'Lead Time'))
    .map((child) => ({ id: child.id, vendor: Entity.get(child.relation_id!)?.name }))
    .filter((r): r is { id: number; vendor: string } => r.vendor !== undefined);
  return rows.map((row) => ({ vendor: row.vendor, days: Number(Entity.getAttr(row.id, 'Days') ?? 0) }));
}

export interface StockOutRiskRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  daily_consumption_rate: number;
  days_until_stockout: number | null;
  shortest_lead_time_days: number | null;
  at_risk: boolean;
}

export function getStockOutRiskReport(windowDays: number = 2): StockOutRiskRow[] {
  const stockRows = getInventoryListingByLocation().flatMap((g) => g.rows.map((r) => ({ ...r, location: g.location })));
  const results: StockOutRiskRow[] = [];
  for (const row of stockRows) {
    // The item's own real, provisioned per-location quantity account —
    // see ensureItemLocationQuantityAccount, db.ts — found by name/parent
    // directly rather than a location_id join.
    const quantityAccountId = resolveItemLocationQuantityAccountId(asItemName(row.item), asLocationName(row.location));
    const consumed = (quantityAccountId != null
      ? db
          .prepare(
            `SELECT COALESCE(-SUM(amount_minor), 0) AS consumed
             FROM journal_line
             WHERE account_id = ? AND amount_minor < 0
               AND effective_date >= date('now', '-' || ? || ' days')`
          )
          .get(quantityAccountId, windowDays)
      : { consumed: 0 }) as { consumed: number };
    const dailyRate = consumed.consumed / windowDays;
    const leadTimes = getItemLeadTimes(asItemName(row.item));
    const shortestLeadTime = leadTimes.length > 0 ? Math.min(...leadTimes.map((l) => l.days)) : null;
    const daysUntilStockout = dailyRate > 0 ? row.quantity_on_hand / dailyRate : null;
    const atRisk = daysUntilStockout !== null && shortestLeadTime !== null && daysUntilStockout < shortestLeadTime;
    results.push({
      item: row.item,
      location: row.location,
      quantity_on_hand: row.quantity_on_hand,
      daily_consumption_rate: dailyRate,
      days_until_stockout: daysUntilStockout,
      shortest_lead_time_days: shortestLeadTime,
      at_risk: atRisk,
    });
  }
  return results.filter((r) => r.at_risk).sort((a, b) => (a.days_until_stockout ?? 0) - (b.days_until_stockout ?? 0));
}

export interface StockTakeLine {
  id: number;
  item: string;
  shelf_side: string | null;
  rack: string | null;
  level: number | null;
  expected_quantity: number;
  counted_quantity: number | null;
}

export interface StockTake {
  id: number;
  location: string;
  take_date: string;
  status: 'draft' | 'completed';
  lines: StockTakeLine[];
}

export function createStockTake(locationName: LocationName, takeDate: string, userId: UserId, business?: BusinessName): number {
  const locationId = Entity.get(locationName)?.id;
  if (!locationId) throw new ValidationError(`No location named "${locationName}".`);

  const takeEntity = Entity.create(`Stock Take — ${takeDate} — ${Date.now()} — draft`, locationId, userId);
  const takeId = takeEntity.id;

  const resolvedLocationName = Entity.get(locationId)!.name;
  const itemsHere = (getInventoryListingByLocation(business).find((g) => g.location === resolvedLocationName)?.rows ?? [])
    .map((r) => {
      const detail = getItemLocation(asItemName(r.item), asLocationName(resolvedLocationName));
      return { item_id: resolveItemId(asItemName(r.item)), item_name: r.item, quantity_on_hand: r.quantity_on_hand, shelf_side: detail.shelf_side, rack: detail.rack, level: detail.level };
    })
    .filter((r) => r.item_id != null)
    .sort((a, b) => {
      if ((a.shelf_side === null) !== (b.shelf_side === null)) return a.shelf_side === null ? 1 : -1;
      if (a.shelf_side !== b.shelf_side) return (a.shelf_side ?? '').localeCompare(b.shelf_side ?? '');
      if ((a.rack === null) !== (b.rack === null)) return a.rack === null ? 1 : -1;
      if (a.rack !== b.rack) return (a.rack ?? '').localeCompare(b.rack ?? '');
      if ((a.level === null) !== (b.level === null)) return a.level === null ? 1 : -1;
      return (a.level ?? 0) - (b.level ?? 0);
    });

  for (const p of itemsHere) {
    const lineEntity = Entity.create(
      `Line — ${p.item_name} — shelf:${p.shelf_side ?? ''} — rack:${p.rack ?? ''} — level:${p.level ?? ''} — expected:${p.quantity_on_hand} — counted:`,
      takeId,
      userId
    );
    Entity.relate(lineEntity.id, p.item_name, userId);
  }

  return takeId;
}

function parseStockTakeLine(row: { id: number; item: string; name: string }): StockTakeLine {
  const m = row.name.match(/^Line — .* — shelf:([^—]*)— rack:([^—]*)— level:([^—]*)— expected:(\d+) — counted:(\d*)$/);
  if (!m) throw new ValidationError(`Malformed real stock take line name: "${row.name}".`);
  const [, shelfSide, rack, level, expected, counted] = m;
  return {
    id: row.id,
    item: row.item,
    shelf_side: shelfSide.trim() || null,
    rack: rack.trim() || null,
    level: level.trim() ? Number(level.trim()) : null,
    expected_quantity: Number(expected),
    counted_quantity: counted.trim() ? Number(counted.trim()) : null,
  };
}

export function getStockTake(id: number): StockTake | undefined {
  const takeEntity = Entity.get(id);
  if (!takeEntity || takeEntity.parent_id === null || !takeEntity.name.startsWith('Stock Take — ')) return undefined;
  const location = Entity.get(takeEntity.parent_id)?.name;
  if (location === undefined) return undefined;
  const header = { id: takeEntity.id, location, name: takeEntity.name };
  const headerMatch = header.name.match(/^Stock Take — (\S+) — \d+ — (draft|completed)$/);
  if (!headerMatch) throw new ValidationError(`Malformed real stock take header name: "${header.name}".`);
  const lines = Entity.children(id)
    .filter((l) => l.name.startsWith('Line — ') && l.relation_id !== null)
    .map((l) => ({ id: l.id, item: Entity.get(l.relation_id!)?.name, name: l.name }))
    .filter((r): r is { id: number; item: string; name: string } => r.item !== undefined);
  const parsedLines = lines.map(parseStockTakeLine).sort((a, b) => {
    if ((a.shelf_side === null) !== (b.shelf_side === null)) return a.shelf_side === null ? 1 : -1;
    if (a.shelf_side !== b.shelf_side) return (a.shelf_side ?? '').localeCompare(b.shelf_side ?? '');
    if ((a.rack === null) !== (b.rack === null)) return a.rack === null ? 1 : -1;
    if (a.rack !== b.rack) return (a.rack ?? '').localeCompare(b.rack ?? '');
    if ((a.level === null) !== (b.level === null)) return a.level === null ? 1 : -1;
    return (a.level ?? 0) - (b.level ?? 0);
  });
  return { id: header.id, location: header.location, take_date: headerMatch[1], status: headerMatch[2] as 'draft' | 'completed', lines: parsedLines };
}

export function recordStockTakeCount(stockTakeId: number, itemName: ItemName, countedQuantity: number): void {
  const take = getStockTake(stockTakeId);
  if (!take) throw new NotFoundError(`No stock take with id ${stockTakeId}.`);
  if (take.status !== 'draft') throw new ValidationError(`Stock take ${stockTakeId} is already completed.`);
  if (countedQuantity < 0) throw new ValidationError('Counted quantity cannot be negative.');
  const line = take.lines.find((l) => l.item === itemName);
  if (!line) throw new ValidationError(`"${itemName}" is not on this stock take sheet.`);
  const row = Entity.get(line.id)!;
  const newName = row.name.replace(/counted:\d*$/, `counted:${countedQuantity}`);
  Entity.rename(line.id, newName, asUserId(1));
}

export function completeStockTake(
  stockTakeId: number,
  business: BusinessName,
  ledger: LedgerName,
  varianceExpenseAccount: AccountName,
  /** @deprecated See docs/stock-api-reference.md § Stock takes. */
  inventoryAccount: string,
  unitCostMinorByItem: Record<string, number>,
  userId: UserId
): void {
  const take = getStockTake(stockTakeId);
  if (!take) throw new NotFoundError(`No stock take with id ${stockTakeId}.`);
  if (take.status !== 'draft') throw new ValidationError(`Stock take ${stockTakeId} is already completed.`);

  for (const line of take.lines) {
    if (line.counted_quantity == null) continue;
    const variance = line.counted_quantity - line.expected_quantity;
    if (variance === 0) continue;
    const unitCostMinor = unitCostMinorByItem[line.item];
    if (unitCostMinor == null) throw new ValidationError(`No unit cost given for "${line.item}", which has a variance and needs one to be valued.`);
    const valueMinor = variance * unitCostMinor;
    const reference = `STOCKTAKE-${stockTakeId}-${line.item}`;
    { const inv = ensureItemLocationInventoryAccount(asItemName(line.item), take.location as LocationName, userId, undefined, asBusinessName(business)); stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), transdate: take.take_date, account: asAccountName(inv.inventoryAccount), accountId: inv.inventoryAccountId, amount_minor: valueMinor, memo: `Stock take variance: ${line.item}` }); }
    stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), transdate: take.take_date, account: asAccountName(varianceExpenseAccount), amount_minor: -valueMinor });

    const currentOnHand = getItemLocation(asItemName(line.item), take.location as LocationName).quantity_on_hand;
    const delta = line.counted_quantity! - currentOnHand;
    if (delta !== 0) {
      const { countAdjustmentAccount, countAdjustmentAccountId } = ensureItemQuantityAccounts(asItemName(line.item), userId);
      const { quantityAccount, quantityAccountId } = ensureItemLocationQuantityAccount(asItemName(line.item), take.location as LocationName, userId, undefined, asBusinessName(business));
      stageQuantityMovementLine(business, ledger, `${reference}-QTY`, asAccountName(quantityAccount), delta, take.take_date, quantityAccountId);
      stageQuantityMovementLine(business, ledger, `${reference}-QTY`, asAccountName(countAdjustmentAccount), -delta, take.take_date, countAdjustmentAccountId);
      postStagedQuantityMovement(business, ledger, `${reference}-QTY`, userId);
      adjustLocationCapacity(business, ledger, take.location as LocationName, asItemName(line.item), delta, take.take_date, userId, reference);
    }
    postJournalEntry(reference, business, ledger, userId);
  }

  const takeRow = Entity.get(stockTakeId)!;
  Entity.rename(stockTakeId, takeRow.name.replace(/ — draft$/, ' — completed'), userId);
}

// Docs: docs/storage-space-as-currency-design.md § 24. Code and tests: where to look
export function writeOffItems(
  business: BusinessName,
  ledger: LedgerName,
  reference: string,
  itemName: ItemName,
  quantity: number,
  unitCostMinor: number,
  writeOffExpenseAccount: AccountName,
  /** @deprecated See docs/storage-space-as-currency-design.md § 24, D8 (write-off). */
  inventoryAccount: string,
  reason: string,
  userId: UserId,
  transdate?: string,
  locationName?: LocationName,
  combinationValues?: string[],
  combinationShape?: [string, string][]
): void {
  if (quantity <= 0) throw new ValidationError('Write-off quantity must be positive — it is always a reduction, never a gain.');
  const totalMinor = quantity * unitCostMinor;
  const date = transdate ?? new Date().toISOString().slice(0, 10);

  stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), transdate: date, description: reason, account: asAccountName(writeOffExpenseAccount), amount_minor: totalMinor });
  { const inv = ensureItemInventoryAccount(itemName, userId, undefined, asBusinessName(business)); stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), transdate: date, account: asAccountName(inv.inventoryAccount), accountId: inv.inventoryAccountId, amount_minor: -totalMinor }); }
  postJournalEntry(reference, business, ledger, userId);

  const { writeOffAccount, writeOffAccountId } = ensureItemQuantityAccounts(itemName, userId);
  stageQuantityMovementLine(business, ledger, `${reference}-QTY`, asAccountName(itemName), -quantity, date);
  stageQuantityMovementLine(business, ledger, `${reference}-QTY`, asAccountName(writeOffAccount), quantity, date, writeOffAccountId);
  postStagedQuantityMovement(business, ledger, `${reference}-QTY`, userId);

  if (locationName) adjustLocationCapacity(business, ledger, locationName, itemName, -quantity, date, userId, reference);

  if (combinationValues && combinationShape) {
    const instanceTop = ensureProductInstance(business, combinationShape, combinationValues, userId);
    const { onHandId, receivedFromId } = ensureUnitsTrackingBaseAccounts(business, userId);
    const unitsOnHand = ensureCombinationAccountLeaf('On Hand', instanceTop, userId, onHandId);
    const receivedFrom = ensureCombinationAccountLeaf('On Hand', instanceTop, userId, receivedFromId);
    const unitsCurrency = `UNITS-${combinationValues.join('-').toUpperCase()}`;
    setAccountCurrency(unitsOnHand.name, unitsCurrency, unitsOnHand.id);
    setAccountCurrency(receivedFrom.name, unitsCurrency, receivedFrom.id);
    const countRef = `${reference}-COMBO-COUNT`;
    stageLine({ reference: countRef, business, ledger, transdate: date, account: asAccountName(unitsOnHand.name), accountId: unitsOnHand.id, amount_minor: -quantity, memo: `Combination write-off (count): ${itemName}` });
    stageLine({ reference: countRef, business, ledger, transdate: date, account: asAccountName(receivedFrom.name), accountId: receivedFrom.id, amount_minor: quantity, memo: `Combination write-off (count): ${itemName}` });
    postJournalEntry(countRef, business, ledger, userId);
  }
}

// Per direct instruction: no detail_json/JSON, no new table, no raw
// SQL UPDATE (an upsert's own "ON CONFLICT DO UPDATE" included)
// anywhere in this lot-tracking code. A lot's quantity-on-hand and
// cost basis are running numbers that change over time — exactly what
// this codebase already has a real, structural, append-only mechanism
// for (postQuantityMovement, the same primitive placeOrder/fulfillOrder
// use for their own "${reference} Qty"/"${reference} Value" running
// balances), so lots use the identical pattern instead of a mutable
// JSON counter: each lot gets its own real "${lotName} Qty" and
// "${lotName} Value" system account, under a shared "Stock Lots" root
// (mirroring the existing "Orders" root), and every receipt/consumption
// is a real, append-only quantity-movement posting against it — the
// actual running balance lives in account.balance_minor, maintained
// entirely by the pre-existing, foundational post_quantity_movement
// trigger (00-core.sql), never written to directly here. The lot's own
// tree position (a child of its item, for getExpiringStock's join) and
// its two write-once facts (received date, expiration date) are
// unchanged structurally — the dates move onto the lot entity via the
// existing, generic Entity.setAttr primitive (one scalar child entity,
// changed only through Entity.rename's INSERT-based entity_update
// trigger, never a literal UPDATE) instead of detail_json.
function ensureStockLotsRoot(): { id: number } {
  const existing = Entity.get('Stock Lots');
  if (existing) return existing;
  const application = Entity.get('Application')!;
  return { id: createSystemEntity('Stock Lots', application.id) };
}

function ensureLotAccount(lotAccountName: string): void {
  if (Entity.get(lotAccountName)) return;
  const root = ensureStockLotsRoot();
  createSystemEntity(lotAccountName, root.id);
}

function lotBalance(lotAccountName: string): number {
  const entity = Entity.get(lotAccountName);
  if (!entity) return 0;
  return (db.prepare(`SELECT balance_minor FROM account WHERE entity_id = ?`).get(entity.id) as { balance_minor: number } | undefined)?.balance_minor ?? 0;
}

export function receiveLot(
  business: BusinessName,
  ledger: LedgerName,
  reference: string,
  itemName: ItemName,
  lotNumber: string,
  receivedDate: string,
  expirationDate: string | null,
  quantity: number,
  userId: UserId,
  costBasisMinor?: number
): void {
  if (quantity <= 0) throw new ValidationError('Received quantity must be positive.');
  const itemId = resolveItemId(itemName);
  if (!itemId) throw new ValidationError(`No item named "${itemName}".`);

  const lotName = `${itemName} — Lot — ${lotNumber}`;
  const existing = Entity.getUnder(lotName, itemId);
  if (!existing) {
    const created = Entity.create(lotName, itemId, userId);
    Entity.setAttr(created.id, 'Received Date', receivedDate, userId);
    if (expirationDate) Entity.setAttr(created.id, 'Expiration Date', expirationDate, userId);
  }

  const qtyAccount = `${lotName} Qty`;
  const valueAccount = `${lotName} Value`;
  ensureLotAccount(qtyAccount);
  ensureLotAccount(valueAccount);
  postQuantityMovement(business, ledger, `${reference}-LOT-QTY`, asAccountName(qtyAccount), quantity, userId, receivedDate);
  if (costBasisMinor) postQuantityMovement(business, ledger, `${reference}-LOT-VALUE`, asAccountName(valueAccount), costBasisMinor, userId, receivedDate);

  postQuantityMovement(business, ledger, reference, asAccountName(itemName), quantity, userId, receivedDate);
}

export function consumeFromLots(
  business: BusinessName,
  ledger: LedgerName,
  reference: string,
  itemName: ItemName,
  quantity: number,
  userId: UserId,
  transdate?: string
): { lot_number: string; consumed: number; expiration_date: string | null; cost_basis_minor: number | null }[] {
  if (quantity <= 0) throw new ValidationError('Quantity to consume must be positive.');
  const itemId = resolveItemId(itemName);
  if (!itemId) throw new ValidationError(`No item named "${itemName}".`);

  const lotRows = Entity.findByNameContaining(' — Lot — ', itemId).map((r) => ({ id: r.id, name: r.name }));
  const lots = lotRows
    .map((r) => {
      const lotNumber = r.name.split(' — Lot — ')[1];
      const expirationDate = Entity.getAttr(r.id, 'Expiration Date') ?? null;
      const quantityOnHand = lotBalance(`${r.name} Qty`);
      const costBasisMinor = lotBalance(`${r.name} Value`) || null;
      return { id: r.id, name: r.name, lot_number: lotNumber, expiration_date: expirationDate, quantity_on_hand: quantityOnHand, cost_basis_minor: costBasisMinor };
    })
    .filter((l) => l.quantity_on_hand > 0)
    .sort((a, b) => {
      if ((a.expiration_date === null) !== (b.expiration_date === null)) return a.expiration_date === null ? 1 : -1;
      if (a.expiration_date !== b.expiration_date) return (a.expiration_date ?? '').localeCompare(b.expiration_date ?? '');
      return a.id - b.id;
    });

  const totalAvailable = lots.reduce((s, l) => s + l.quantity_on_hand, 0);
  if (quantity > totalAvailable) {
    throw new ValidationError(`Only ${totalAvailable} of "${itemName}" available across all lots — cannot consume ${quantity}.`);
  }

  const consumed: { lot_number: string; consumed: number; expiration_date: string | null; cost_basis_minor: number | null }[] = [];
  let remaining = quantity;
  let n = 0;
  for (const lot of lots) {
    if (remaining <= 0) break;
    n += 1;
    const take = Math.min(remaining, lot.quantity_on_hand);
    const costBasisTaken = lot.cost_basis_minor != null ? Math.round((lot.cost_basis_minor * take) / lot.quantity_on_hand) : null;
    postQuantityMovement(business, ledger, `${reference}-LOT-QTY-${n}`, asAccountName(`${lot.name} Qty`), -take, userId, transdate);
    if (costBasisTaken) postQuantityMovement(business, ledger, `${reference}-LOT-VALUE-${n}`, asAccountName(`${lot.name} Value`), -costBasisTaken, userId, transdate);
    consumed.push({ lot_number: lot.lot_number, consumed: take, expiration_date: lot.expiration_date, cost_basis_minor: costBasisTaken });
    remaining -= take;
  }
  return consumed;
}

export interface ExpiringLot {
  item: string;
  lot_number: string;
  expiration_date: string;
  quantity_on_hand: number;
  days_until_expiration: number;
}

export function getExpiringStock(asOfDate: string, withinDays: number): ExpiringLot[] {
  const lotEntities = Entity.findByNameContaining(' — Lot — ');

  const rows: ExpiringLot[] = [];
  for (const lot of lotEntities) {
    const item = lot.parent_id !== null ? Entity.get(lot.parent_id) : undefined;
    if (!item) continue;
    const lotNumber = lot.name.split(' — Lot — ')[1];
    const expirationDate = Entity.getAttr(lot.id, 'Expiration Date');
    if (!expirationDate) continue;
    const quantityOnHand = lotBalance(`${lot.name} Qty`);
    if (quantityOnHand <= 0) continue;
    const daysUntilExpiration = Math.trunc((Date.parse(expirationDate) - Date.parse(asOfDate)) / 86400000);
    if (daysUntilExpiration > withinDays) continue;
    rows.push({ item: item.name, lot_number: lotNumber, expiration_date: expirationDate, quantity_on_hand: quantityOnHand, days_until_expiration: daysUntilExpiration });
  }
  return rows.sort((a, b) => a.days_until_expiration - b.days_until_expiration);
}

export function createSystemEntity(name: string, parentId: number | null): number {
  if (parentId == null) throw new ValidationError('createSystemEntity requires a real, existing parent id.');
  return Entity.create(name, parentId, asUserId(1)).id;
}

// A shared, auto-vivified fallback pair for an order with no real catalog
// item (a pure value/time commitment — e.g. a service PO, or a labor/plant
// time-clock "order", db-journal.ts's clockInToProject/clockPlantIn) —
// ONE pair of accounts reused by every item-less order, never one freshly
// minted per order. Which order owns which slice of it lives purely in the
// journal's own reference (read back by a reference-LIKE sum, same as the
// per-item case below), never in a side entity.
function ensureSharedOnOrderAccounts(userId: UserId): { onOrderQtyAccountId: number; onOrderValueAccountId: number } {
  const ordersId = Entity.get('Orders')!.id;
  const qty = Entity.ensureUnder('On Order Qty', ordersId, userId);
  const value = Entity.ensureUnder('On Order Value', ordersId, userId);
  return { onOrderQtyAccountId: qty.id, onOrderValueAccountId: value.id };
}

// Pure SQL, no Entity.*/entityDriver call at all — the exact account an
// order's own placement posted to is simply whichever account its own
// `${orderReference}-PLACE-ONORDER`/`-PLACE-VALUE` journal line already
// hit; every later fulfillment or status read just looks that up
// directly, rather than re-deriving "which item/shared account was this"
// from a side entity (removed per direct instruction — "no separate
// entities should be created to track details already tracked in the
// journal entries"). Because this never touches Entity.*/entityDriver, it
// is also safe to call from inside a db.transaction() if one is ever
// needed here — unlike placeOrder's own account resolution, which still
// calls ensureItemQuantityAccounts/ensureSharedOnOrderAccounts (Entity.*)
// and so must stay outside any transaction, for the same cross-process
// deadlock reason documented there.
function resolveOrderAccounts(orderReference: string): {
  qtyAccountId: number | undefined;
  qtyAccountName: string | undefined;
  valueAccountId: number | undefined;
  valueAccountName: string | undefined;
} {
  const findBy = (reference: string): { account_id: number; name: string } | undefined =>
    db
      .prepare(
        `SELECT jl.account_id AS account_id, ce.name AS name
         FROM journal j JOIN journal_line jl ON jl.journal_id = j.id JOIN current_entities ce ON ce.id = jl.account_id
         WHERE j.reference = ? LIMIT 1`
      )
      .get(reference) as { account_id: number; name: string } | undefined;
  const qtyRow = findBy(`${orderReference}-PLACE-ONORDER`);
  const valueRow = findBy(`${orderReference}-PLACE-VALUE`);
  return { qtyAccountId: qtyRow?.account_id, qtyAccountName: qtyRow?.name, valueAccountId: valueRow?.account_id, valueAccountName: valueRow?.name };
}

export function placeOrder(
  orderReference: string,
  business: BusinessName,
  ledger: LedgerName,
  quantity: number,
  priceMinor: number,
  userId: UserId,
  transdate?: string,
  vendor?: ProviderName,
  item?: ItemName,
  location?: LocationName
): void {
  // Account resolution (configuration) deliberately happens BEFORE/outside
  // any db.transaction() below, never inside one alongside it — under
  // ENTITY_DRIVER=gleam, an Entity.*/entityDriver call goes out over real
  // HTTP to storage_engine, which writes the same, real entities.sqlite
  // through its OWN, separate SQLite connection. A still-open
  // better-sqlite3 write transaction already holds this file's one
  // write lock; calling out to a second, independent writer for the
  // SAME file while that lock is held is a real deadlock, not just
  // contention — confirmed directly, the hard way, running the real
  // tutorial e2e suite. Accounting (direct SQL, inside
  // postQuantityMovement's own transaction) and configuration (account
  // resolution, here) now have genuinely separate commit boundaries,
  // never interleaved in one transaction — the same distinction the
  // storage-engine integration's own design was asked to keep.
  //
  // Direct instruction: "when an order is placed the Item and Location
  // must obviously exist" — placeOrder never creates either; it only
  // requires them, same as always, now actually enforced for location
  // (previously only implicit, via setHierarchyParent's own lookup).
  if (location && !Entity.get(location)) throw new ValidationError(`No location named "${location}" — it must already exist.`);

  let qtyAccountName: string, qtyAccountId: number, valueAccountName: string, valueAccountId: number;
  if (item) {
    const accounts = ensureItemQuantityAccounts(item, userId);
    qtyAccountName = accounts.onOrderAccount;
    qtyAccountId = accounts.onOrderAccountId;
    valueAccountName = accounts.onOrderValueAccount;
    valueAccountId = accounts.onOrderValueAccountId;
  } else {
    const accounts = ensureSharedOnOrderAccounts(userId);
    qtyAccountName = 'On Order Qty';
    qtyAccountId = accounts.onOrderQtyAccountId;
    valueAccountName = 'On Order Value';
    valueAccountId = accounts.onOrderValueAccountId;
  }

  // vendor is no longer stored via a side relation (there is no longer a
  // per-order entity to relate it to) — it's carried as the -PLACE-VALUE
  // line's own memo instead, the real journal entry itself, read back by
  // checkEInvoiceDiscrepancies (db.ts) via plain SQL. location, deferred
  // per direct instruction ("the cartesian product of location x item x
  // storage... business rule... stocking levels" is a later, separate
  // task): not yet a further axis on which account this posts to, beyond
  // being required to exist above.
  postQuantityMovement(business, ledger, `${orderReference}-PLACE-VALUE`, asAccountName(valueAccountName), priceMinor, userId, transdate, undefined, valueAccountId, vendor ?? undefined);
  postQuantityMovement(business, ledger, `${orderReference}-PLACE-ONORDER`, asAccountName(qtyAccountName), quantity, userId, transdate, undefined, qtyAccountId);
}

export function fulfillOrder(
  orderReference: string,
  fulfillingReference: string,
  business: BusinessName,
  ledger: LedgerName,
  quantityFulfilled: number,
  valueFulfilledMinor: number,
  userId: UserId,
  transdate?: string
): void {
  // Pure SQL (resolveOrderAccounts), no Entity.*/entityDriver call at all —
  // unlike placeOrder, nothing here needs to run outside a transaction for
  // the cross-process deadlock reason; there simply isn't one left.
  const { qtyAccountId, qtyAccountName, valueAccountId, valueAccountName } = resolveOrderAccounts(orderReference);
  if (valueAccountId != null) {
    postQuantityMovement(business, ledger, `${orderReference}-FULFILL-${fulfillingReference}-VALUE`, asAccountName(valueAccountName!), -valueFulfilledMinor, userId, transdate, undefined, valueAccountId);
  }
  if (qtyAccountId != null) {
    postQuantityMovement(business, ledger, `${orderReference}-FULFILL-${fulfillingReference}-ONORDER`, asAccountName(qtyAccountName!), -quantityFulfilled, userId, transdate, undefined, qtyAccountId);
  }
}

export function getOrderStatus(orderReference: string): { quantity: number; value_minor: number } {
  const { qtyAccountId, valueAccountId } = resolveOrderAccounts(orderReference);
  const sumFor = (accountId: number | undefined): number => {
    if (accountId == null) return 0;
    return (
      db.prepare(`SELECT SUM(jl.amount_minor) AS total FROM journal j JOIN journal_line jl ON jl.journal_id = j.id WHERE j.reference LIKE ? AND jl.account_id = ?`).get(`${orderReference}%`, accountId) as {
        total: number | null;
      }
    ).total ?? 0;
  };
  return { quantity: sumFor(qtyAccountId), value_minor: sumFor(valueAccountId) };
}

