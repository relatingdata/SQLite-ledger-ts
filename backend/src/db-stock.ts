// The full documentation for every function in this file lives in docs/stock-api-reference.md — this file carries no further comments.

import { DateTime } from 'luxon';
import { db } from './db.js';
import { ensureStorageCapacityStructure, ensureLocationStorageRoot } from './db.js';
import { Entity, Link, Balance } from './primitives.js';
import { Session } from './session-context.js';
import {
  NotFoundError,
  ValidationError,
  PostingError,
  mergeContactDetail,
  assertPeriodOpen,
  cityDivisionFor,
  ensureItemQuantityAccounts,
  setAccountCurrency,
  ensureItemInventoryAccount,
  ensureItemLocationInventoryAccount,
  postJournalEntry,
  getItemUnitCostMinor,
  ensureProductInstance,
  ensureCombinationAccountLeaf,
  resolveItemId,
  setDimensionParent,
  setEntityLink,
  deleteEntityLink,
  stageLine,
  updateEntity,
  deleteEntity,
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

export function stageQuantityMovementLine(business: BusinessName, ledger: LedgerName, reference: string, account: AccountName, deltaQuantity: number, transdate: string, locationName?: LocationName, accountId?: number): void {
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
    `INSERT INTO journal_entry_staging (reference, business, ledger, description, transdate, account, account_id, amount_minor, memo, location)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(reference, business, ledger, 'Quantity movement', transdate, account, resolvedAccountId, deltaQuantity, '', locationName ?? '');
}

export function postStagedQuantityMovement(business: BusinessName, ledger: LedgerName, reference: string, userId: UserId): void {
  try {
    db.prepare(`INSERT INTO post_quantity_movement (reference, business, ledger, user_id) VALUES (?, ?, ?, ?)`).run(reference, business, ledger, userId);
  } catch (err) {
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
  accountId?: number
): void {
  const date = transdate ?? (locationName ? todayAtLocation(locationName) : new Date().toISOString().slice(0, 10));
  assertPeriodOpen(business, ledger, date);
  stageQuantityMovementLine(business, ledger, reference, account, deltaQuantity, date, locationName, accountId);
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
  return (db
    .prepare(
      `SELECT child.name FROM current_entities child
       JOIN current_entities parent ON parent.id = child.parent_id AND parent.name = 'Location Types'
       ORDER BY child.name`
    )
    .all() as { name: string }[])
    .map((r) => r.name);
}

export function createLocationType(name: string, userId: UserId): void {
  if (Entity.get(name)) throw new ValidationError(`"${name}" already exists.`);
  Entity.create(name, 'Location Types', userId);
}

// Per direct instruction (Phase 0 of docs/currency-and-quantity-integrity-fix-plan.md):
// the exact, same bare-name bug as getLocation, found one function
// away from it - this one is worse, since it WRITES: a confirmed,
// real bug where a brand-new location's own contact details (city,
// capacity, timezone) were silently written onto an unrelated,
// pre-existing entity of the same name under a different business,
// leaving the real, new location with no contact row at all.
export function setLocation(name: string, location: Location, business?: BusinessName): void {
  const id = (business
    ? (db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Locations' AND parent_id = (SELECT id FROM current_entities WHERE name = ?))`).get(name, business) as { id: number } | undefined)
    : (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(name) as { id: number } | undefined)
  )?.id;
  if (!id) throw new ValidationError(`No location named "${name}".`);
  mergeContactDetail(id, { city: location.city, bottle_capacity: location.bottle_capacity, carton_capacity: location.carton_capacity, timezone: location.timezone });
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Location Types')`).get(location.location_type)) {
    throw new ValidationError(`No location type named "${location.location_type}" — add it first (a real, user-extensible Vocabulary word, not a fixed, built-in list).`);
  }
  const typeRecordName = `Location Type — ${name} → ${location.location_type}`;
  const staleType = db
    .prepare(
      `SELECT id, name FROM current_entities
       WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'Location Type')
       AND name = 'Location Type — ' || ? || ' → ' || (SELECT name FROM current_entities WHERE id = relation_id)
       AND name != ?`
    )
    .all(name, typeRecordName) as { id: number; name: string }[];
  for (const s of staleType) deleteEntity(s.id, asUserId(1));
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(typeRecordName)) {
    create(requireEntity('Location Type', typeRootName), typeLocationTypeMarkerName, typeRecordName, asUserId(1));
  }
  const typeRecord = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(typeRecordName) as { id: number };
  updateEntity(typeRecord.id, { relation: location.location_type }, asUserId(1));

  const billingRecordName = `Is Billing Address — ${name} → Billing Address`;
  if (location.is_billing_address) {
    const others = db
      .prepare(
        `SELECT e.id, e.name FROM current_entities e
         JOIN current_entities rel_type ON rel_type.id = e.parent_id AND rel_type.name = 'Is Billing Address'
         WHERE e.name != ?`
      )
      .all(billingRecordName) as { id: number; name: string }[];
    for (const other of others) deleteEntity(other.id, asUserId(1));
    if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(billingRecordName)) {
      create(requireEntity('Is Billing Address', typeRootName), typeIsBillingAddressMarkerName, billingRecordName, asUserId(1));
    }
    const billingRecord = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(billingRecordName) as { id: number };
    updateEntity(billingRecord.id, { relation: 'Billing Address' }, asUserId(1));
  } else {
    const existing = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(billingRecordName) as { id: number } | undefined;
    if (existing) deleteEntity(existing.id, asUserId(1));
  }
}

// Per direct instruction (Phase 0 of docs/currency-and-quantity-integrity-fix-plan.md):
// a bare name lookup cannot tell two, real locations of the same name
// apart when they belong to two different businesses (scoped
// uniqueness correctly allows this). A confirmed, real bug: a location
// created fresh under one business silently resolved, at every later
// operation, to an unrelated, pre-existing location of the same name
// under a different business entirely. When `business` is known, it
// must be part of the SQL that SELECTS the row, never a check applied
// afterwards to whichever row an unscoped query happened to return
// first - a confirmed, real bug in an earlier version of this same
// fix, caught directly by testing it, not merely by reasoning about it.
export function getLocation(name: string, business?: BusinessName): Location | undefined {
  const row = (business
    ? db.prepare(
        `SELECT c.city, c.bottle_capacity, c.carton_capacity, c.timezone, e.id as entity_id
         FROM contact c
         JOIN current_entities e ON e.id = c.entity_id
         WHERE e.name = ? AND e.parent_id = (SELECT id FROM current_entities WHERE name = 'Locations' AND parent_id = (SELECT id FROM current_entities WHERE name = ?))`
      ).get(name, business)
    : db.prepare(
        `SELECT c.city, c.bottle_capacity, c.carton_capacity, c.timezone, e.id as entity_id
         FROM contact c JOIN current_entities e ON e.id = c.entity_id WHERE e.name = ?`
      ).get(name)
  ) as { city: string; bottle_capacity: number | null; carton_capacity: number | null; timezone: string; entity_id: number } | undefined;
  if (!row) return undefined;
  const typeRow = db
    .prepare(
      `SELECT rel.name AS marker
       FROM current_entities rec
       JOIN current_entities rel ON rel.id = rec.relation_id
       WHERE rec.parent_id = (SELECT id FROM current_entities WHERE name = 'Location Type')
       AND rec.name = 'Location Type — ' || ? || ' → ' || rel.name`
    )
    .get(name) as { marker: string } | undefined;
  const isBillingAddress = !!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(`Is Billing Address — ${name} → Billing Address`);
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
  const quantity_on_hand = Balance.getScoped(itemName, 'location_id', locationName);
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

export function setItemLocationLevelDetails(itemName: ItemName, locationName: LocationName, levels: Omit<ItemLocationLevels, 'quantity_on_hand'>): void {
  const userId = asUserId(Session.UserId);
  const item = Entity.get(itemName);
  if (!item) throw new ValidationError(`No item named "${itemName}".`);
  const levelsRecordName = `${itemName} — ${locationName} — Levels`;
  const levelsRecord = Entity.ensureUnder(levelsRecordName, item.id, userId);
  function setLevelFigure(field: 'Min Level' | 'Max Level' | 'Reorder Level' | 'Shelf Level', value: number | null): void {
    const figureName = `${levelsRecordName} — ${field}`;
    const existing = Entity.getUnder(figureName, levelsRecord.id);
    if (value == null) {
      if (existing) Entity.delete(existing.id, userId);
      return;
    }
    const figure = existing ?? Entity.create(figureName, levelsRecord.id, userId);
    const delta = value - Balance.get(figure.id);
    if (delta !== 0) Balance.post(Session.Business.name, Session.Ledger, `LEVEL-${figure.id}-${Date.now()}`, figureName, figure.id, delta, userId);
  }
  setLevelFigure('Min Level', levels.min_level);
  setLevelFigure('Max Level', levels.max_level);
  setLevelFigure('Reorder Level', levels.reorder_level);
  setLevelFigure('Shelf Level', levels.level);
  if (levels.shelf_side) {
    if (!Entity.get(levels.shelf_side)) Entity.create(levels.shelf_side, 'Vocabulary', userId);
    Link.set(levelsRecordName, 'Shelf Side', levels.shelf_side, userId);
  } else {
    Link.delete(levelsRecordName, 'Shelf Side', userId);
  }
  if (levels.rack) {
    if (!Entity.get(levels.rack)) Entity.create(levels.rack, 'Vocabulary', userId);
    Link.set(levelsRecordName, 'Rack', levels.rack, userId);
  } else {
    Link.delete(levelsRecordName, 'Rack', userId);
  }
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
  const rows = db
    .prepare(
      `SELECT p.name AS item, SUM(jl.amount_minor) AS qty
       FROM journal_line jl
       JOIN current_entities p ON p.id = jl.account_id
       JOIN current_entities l ON l.id = jl.location_id
       WHERE l.name = ?
       GROUP BY p.name`
    )
    .all(locationName) as { item: string; qty: number }[];

  const bottleQuantity = rows.reduce((s, r) => s + r.qty, 0);
  const cartonQuantity = rows.reduce((s, r) => {
    const packageQty = preferredProviderPackageQuantity(asItemName(r.item)) ?? 12; // a real, reasonable default when no real vendor relationship exists at all
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
  const parent = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(parentName) as { id: number } | undefined;
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
  const row = db.prepare(`SELECT currency FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name = ?)`).get(terminalName) as { currency: string | null } | undefined;
  return row?.currency ?? null;
}

// Docs: docs/storage-space-as-currency-design.md § 24. Code and tests: where to look
// Per direct instruction: a second, separate bare-name lookup in this
// same function, found by direct investigation of the tutorial's own
// Head Office postings landing on an unrelated, pre-existing "Head
// Office" entity under a different division entirely - confirmed by
// tracing the real journal lines directly. getLocation below was
// already scoped (checkpoint 432), but it was only ever used to
// determine bottle vs. carton; the real entity id the Storage Capacity
// structure is actually built under came from this separate, unscoped
// query, untouched by that earlier fix. Scoped the same way getLocation
// itself is: filtered within the SQL by the real business, never a
// check on whichever row an unscoped query happened to return first.
export function ensureLocationCapacityAccount(business: BusinessName, ledger: LedgerName, locationName: LocationName, userId: UserId): { capacityAccount: string; capacityAccountId: number; occupiedAccountId: number; unit: 'bottle' | 'carton' } {
  // The pre-existing "Wine Retail Business" seed data has its own,
  // real, already-documented gap (docs/multi-dimensional-reporting.md
  // §2, confirmed directly in test's own getHierarchyChain assertion):
  // its own Locations root is named "{business} Locations", not the
  // standard "Locations" every other business uses. Tolerated here with
  // an explicit fallback, not silently masked - the standard name is
  // always tried first.
  const locationId = (
    db.prepare(
      `SELECT id FROM current_entities WHERE name = ? AND parent_id IN (
         SELECT id FROM current_entities WHERE name = 'Locations' AND parent_id = (SELECT id FROM current_entities WHERE name = ?)
         UNION
         SELECT id FROM current_entities WHERE name = ? || ' Locations' AND parent_id = (SELECT id FROM current_entities WHERE name = ?)
       )`
    ).get(locationName, business, business, business) as { id: number } | undefined
  )?.id;
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
  division: string | null;
  rows: InventoryListingRow[];
  total_on_hand: number;
  capacity: LocationCapacityStatus;
}

// Per direct instruction: "Inventory" is the real, correct word for this
// collection - "Stock" is retired from the code (it stays as a real,
// translatable Vocabulary word a person reads, and "Stock Take" is UI
// naming only, never a code term). A real, confirmed, serious bug fixed
// in the same pass: this query had no business scoping at all, so it
// aggregated every item and location sharing a name across every real
// business in the database together - confirmed directly, not assumed,
// by a genuine item named "Amber Ale 330ml" existing under several,
// different, unrelated businesses at once. journal already carries its
// own real business_id; joining through it, rather than matching item
// and location by bare name alone, is the real, direct fix.
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

// Per direct instruction: a real, new report, since the Trial Balance
// cannot and should not show these accounts - they are physical
// storage-space accounts under each real Location, never financial
// accounts under Chart of Accounts, so getLedgerBalances' own
// real_accounts CTE (which only walks Chart of Accounts) structurally
// excludes them. Scoped to Session.Business, the same, standing
// agreement already applied elsewhere.
export function getStorageSpaceReport(): StorageSpaceLocationGroup[] {
  const rows = db
    .prepare(
      `SELECT loc.name AS location, a.currency AS currency, kind.name AS kind, SUM(jl.amount_minor) AS balance_minor
       FROM journal j
       JOIN journal_line jl ON jl.journal_id = j.id
       JOIN account a ON a.entity_id = jl.account_id
       JOIN current_entities leaf ON leaf.id = jl.account_id
       JOIN current_entities kind ON kind.id = leaf.parent_id
       JOIN current_entities capacity ON capacity.id = kind.parent_id
       JOIN current_entities loc ON loc.id = capacity.parent_id
       WHERE j.business_id = ? AND capacity.name = 'Storage Capacity' AND kind.name IN ('Installed', 'Occupied', 'Remaining') AND a.currency IS NOT NULL
       GROUP BY loc.name, a.currency, kind.name
       HAVING SUM(jl.amount_minor) != 0`
    )
    .all(Session.Business.id) as { location: string; currency: string; kind: string; balance_minor: number }[];

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
      // Per direct instruction: Installed balances against Remaining at
      // opening (Occupied starts at zero) - a real, direct check that
      // the two still genuinely reconcile: however much space is
      // occupied or remaining must sum to exactly the real, installed
      // total, never a fraction, never a mismatch.
      cur.balanced = cur.occupied_minor + cur.remaining_minor === -cur.installed_minor;
    }
  }
  return [...groups.values()].sort((a, b) => a.location.localeCompare(b.location));
}

export function getInventoryListingByLocation(): InventoryListingLocationGroup[] {
  const qtyRows = db
    .prepare(
      `SELECT p.name AS item, l.name AS location, SUM(jl.amount_minor) AS quantity_on_hand
       FROM journal j
       JOIN journal_line jl ON jl.journal_id = j.id
       JOIN current_entities p ON p.id = jl.account_id
       JOIN current_entities l ON l.id = jl.location_id
       WHERE j.business_id = ?
       GROUP BY p.name, l.name
       ORDER BY l.name, p.name`
    )
    .all(Session.Business.id) as { item: string; location: string; quantity_on_hand: number }[];
  // Not fully closed: getItemLocation itself still has no business
  // parameter, so if two different businesses genuinely share both an
  // item name and a location name, its own min/max/reorder levels could
  // still come from the wrong one. Narrower than the bug just fixed
  // above (which mixed quantities across every business unconditionally)
  // - this one needs both names to collide at once - but real, not
  // closed, and not fixed in this pass.
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

  // getLocationCapacityStatus and cityDivisionFor still have no business
  // parameter of their own - the same, narrower, not-yet-closed risk
  // noted above applies to them too, not fixed in this pass.
  const groups = new Map<string, InventoryListingLocationGroup>();
  for (const row of rows) {
    let group = groups.get(row.location);
    if (!group) {
      const location = getLocation(row.location, asBusinessName(Session.Business.name));
      const division = cityDivisionFor(row.location) ?? null;
      group = { location: row.location, city: location?.city ?? null, division, rows: [], total_on_hand: 0, capacity: getLocationCapacityStatus(asLocationName(row.location)) };
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
  division: string | null;
  vendor: string | null;
}
export interface StockTransferRow extends StockMovementRow {
  from_location: string;
  to_location: string;
}
export interface StockSaleRow extends StockMovementRow {
  location: string;
  division: string | null;
  vendor: string | null;
  amount_minor: number;
}
export interface StockMovementReport {
  receipts: OrderReceiptRow[];
  transfers: StockTransferRow[];
  sales: StockSaleRow[];
}

function allItemCategories(): Map<string, string | null> {
  const rows = db
    .prepare(
      `SELECT p.name AS item, parent.name AS category
       FROM current_entities p
       JOIN current_entities parent ON parent.id = p.parent_id`
    )
    .all() as { item: string; category: string }[];
  return new Map(rows.map((r) => [r.item, r.category]));
}

function allPreferredProviders(): Map<string, string> {
  const rows = db
    .prepare(
      `SELECT p.name AS item, v.name AS vendor, ps.is_preferred
       FROM item_source ps
       JOIN current_entities p ON p.id = ps.item_id
       JOIN current_entities v ON v.id = ps.vendor_id
       ORDER BY ps.is_preferred DESC, ps.id ASC`
    )
    .all() as { item: string; vendor: string; is_preferred: number }[];
  const map = new Map<string, string>();
  for (const r of rows) if (!map.has(r.item)) map.set(r.item, r.vendor); // first row per item, already ordered preferred-first
  return map;
}

export function getStockMovementReport(ledgerName: string, fromDate?: string, toDate?: string): StockMovementReport {
  const ledgerId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(ledgerName) as { id: number } | undefined)?.id;
  if (!ledgerId) throw new ValidationError(`No ledger named "${ledgerName}".`);

  const dateFilter = `AND (? IS NULL OR j.transdate >= ?) AND (? IS NULL OR j.transdate <= ?)`;
  const dateParams = [fromDate ?? null, fromDate ?? null, toDate ?? null, toDate ?? null];
  const categories = allItemCategories();
  const vendors = allPreferredProviders();

  const receiptRows = db
    .prepare(
      `SELECT p.name AS item, l.name AS location, jl.amount_minor AS quantity, j.transdate AS date
       FROM journal_line jl
       JOIN journal j ON j.id = jl.journal_id
       JOIN current_entities p ON p.id = jl.account_id
       JOIN current_entities l ON l.id = jl.location_id
       WHERE j.ledger_id = ? AND j.reference LIKE '%-RECV' ${dateFilter}
       ORDER BY j.transdate, l.name, p.name`
    )
    .all(ledgerId, ...dateParams) as { item: string; location: string; quantity: number; date: string }[];
  const receipts: OrderReceiptRow[] = receiptRows.map((r) => ({
    item: r.item,
    category: categories.get(r.item) ?? null,
    quantity: r.quantity,
    date: r.date,
    location: r.location,
    division: cityDivisionFor(r.location) ?? null,
    vendor: vendors.get(r.item) ?? null,
  }));

  const transferLegRows = db
    .prepare(
      `SELECT jl.journal_id, p.name AS item, l.name AS location, jl.amount_minor AS quantity, j.transdate AS date
       FROM journal_line jl
       JOIN journal j ON j.id = jl.journal_id
       JOIN current_entities p ON p.id = jl.account_id
       JOIN current_entities l ON l.id = jl.location_id
       WHERE j.ledger_id = ? AND j.reference LIKE '%-XFER%' ${dateFilter}
       ORDER BY j.transdate, p.name`
    )
    .all(ledgerId, ...dateParams) as { journal_id: number; item: string; location: string; quantity: number; date: string }[];
  const legsByJournalId = new Map<number, typeof transferLegRows>();
  for (const r of transferLegRows) {
    if (!legsByJournalId.has(r.journal_id)) legsByJournalId.set(r.journal_id, []);
    legsByJournalId.get(r.journal_id)!.push(r);
  }
  const transfers: StockTransferRow[] = [];
  for (const legs of legsByJournalId.values()) {
    const outLeg = legs.find((l) => l.quantity < 0);
    const inLeg = legs.find((l) => l.quantity > 0);
    if (!outLeg || !inLeg) continue; // a real, genuine quantity movement that isn't actually a two-legged transfer — skip rather than guess
    transfers.push({
      item: inLeg.item,
      category: categories.get(inLeg.item) ?? null,
      quantity: inLeg.quantity,
      date: inLeg.date,
      from_location: outLeg.location,
      to_location: inLeg.location,
    });
  }

  const saleRows = db
    .prepare(
      `SELECT j.reference, p.name AS item, l.name AS location, jl.amount_minor AS quantity, j.transdate AS date
       FROM journal_line jl
       JOIN journal j ON j.id = jl.journal_id
       JOIN current_entities p ON p.id = jl.account_id
       JOIN current_entities l ON l.id = jl.location_id
       WHERE j.ledger_id = ? AND j.reference LIKE '%-DISPATCH-%' AND jl.amount_minor < 0 ${dateFilter}
       ORDER BY j.transdate, l.name, p.name`
    )
    .all(ledgerId, ...dateParams) as { reference: string; item: string; location: string; quantity: number; date: string }[];

  const salesPostings = db
    .prepare(
      `WITH RECURSIVE ancestors(id, orig) AS (
         SELECT id, id FROM current_entities
         UNION ALL
         SELECT e.parent_id, a.orig FROM current_entities e JOIN ancestors a ON e.id = a.id WHERE e.parent_id IS NOT NULL
       ),
       sales_accounts AS (
         SELECT DISTINCT orig AS id FROM ancestors a
         JOIN current_entities e ON e.id = a.id
         WHERE e.name = 'Sales Revenue'
       )
       SELECT j2.reference AS ref, e2.name AS account, jl2.amount_minor AS amount
       FROM journal_line jl2
       JOIN journal j2 ON j2.id = jl2.journal_id
       JOIN current_entities e2 ON e2.id = jl2.account_id
       JOIN sales_accounts sa ON sa.id = e2.id
       WHERE j2.ledger_id = ? AND jl2.amount_minor < 0 ${dateFilter.replace(/j\./g, 'j2.')}`
    )
    .all(ledgerId, ...dateParams) as { ref: string; account: string; amount: number }[];
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
    division: cityDivisionFor(r.location) ?? null,
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

// Per the same, real fix as getInventoryListingByLocation above: scoped
// to Session.Business, never a bare, global count across every business.
export function countInventoryListing(): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total FROM (
         SELECT 1 FROM journal j
         JOIN journal_line jl ON jl.journal_id = j.id
         JOIN current_entities p ON p.id = jl.account_id
         JOIN current_entities l ON l.id = jl.location_id
         WHERE j.business_id = ?
         GROUP BY p.name, l.name
       )`
    )
    .get(Session.Business.id) as { total: number };
  return row.total;
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
  }
): void {
  const itemId = resolveItemId(itemName);
  if (!itemId) throw new ValidationError(`No item named "${itemName}".`);
  const locationId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(locationName) as { id: number } | undefined)?.id;
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
    }
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
  const locationId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(locationName) as { id: number } | undefined)?.id;
  if (!locationId) throw new ValidationError(`No location named "${locationName}".`);

  db.transaction(() => {
  const date = transdate ?? todayAtLocation(locationName);
  assertPeriodOpen(business, ledger, date);
  const { onOrderAccount, onOrderAccountId } = ensureItemQuantityAccounts(itemName, userId);
  stageQuantityMovementLine(business, ledger, reference, asAccountName(itemName), quantity, date, locationName);
  stageQuantityMovementLine(business, ledger, reference, asAccountName(onOrderAccount), -quantity, date, undefined, onOrderAccountId);
  postStagedQuantityMovement(business, ledger, reference, userId);
  adjustLocationCapacity(business, ledger, locationName, itemName, quantity, date, userId, reference);

  if (combinationValues && combinationShape) {
    const instanceTop = ensureProductInstance(business, combinationShape, combinationValues, userId);
    const unitCostMinor = getItemUnitCostMinor(itemName);
    if (unitCostMinor != null) {
      const valueMinor = quantity * unitCostMinor;
      const invLeaf = ensureCombinationAccountLeaf('Inventory', instanceTop, userId);
      const valueRef = `${reference}-VALUE`;
      const apId = (db.prepare(`SELECT id FROM current_entities WHERE name = 'Accounts Payable' AND parent_id = (SELECT id FROM current_entities WHERE name = 'Liability')`).get() as { id: number }).id;
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
  stageQuantityMovementLine(business, ledger, reference, asAccountName(itemName), -quantity, date, locationName);
  stageQuantityMovementLine(business, ledger, reference, asAccountName(unitsSoldAccount), quantity, date, undefined, unitsSoldAccountId);
  postStagedQuantityMovement(business, ledger, reference, userId);
  adjustLocationCapacity(business, ledger, locationName, itemName, -quantity, date, userId, reference);

  if (combinationValues && combinationShape) {
    const instanceTop = ensureProductInstance(business, combinationShape, combinationValues, userId);
    const unitCostMinor = getItemUnitCostMinor(itemName);
    if (unitCostMinor != null) {
      const valueMinor = quantity * unitCostMinor;
      const invLeaf = ensureCombinationAccountLeaf('Inventory', instanceTop, userId);
      const valueRef = `${reference}-VALUE`;
      const cogsId = (db.prepare(`SELECT id FROM current_entities WHERE name = 'Cost of Goods Sold' AND parent_id = (SELECT id FROM current_entities WHERE name = 'Expense')`).get() as { id: number } | undefined)?.id
        ?? (db.prepare(`SELECT id FROM current_entities WHERE name = 'Cost of Goods Sold'`).get() as { id: number }).id;
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
    if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(loc)) throw new ValidationError(`No location named "${loc}".`);
  }

  const date = transdate ?? todayAtLocation(fromLocationName);
  assertPeriodOpen(business, ledger, date);
  db.transaction(() => {
  stageQuantityMovementLine(business, ledger, reference, asAccountName(itemName), -quantity, date, fromLocationName);
  stageQuantityMovementLine(business, ledger, reference, asAccountName(itemName), quantity, date, toLocationName);
  postStagedQuantityMovement(business, ledger, reference, asUserId(userId));
  adjustLocationCapacity(business, ledger, fromLocationName, itemName, -quantity, date, asUserId(userId), reference);
  adjustLocationCapacity(business, ledger, toLocationName, itemName, quantity, date, asUserId(userId), reference);

  // Per direct instruction: a real, confirmed bug - this plain
  // (non-combination) path moved quantity and location capacity, but
  // never any Inventory dollar value at all, unlike the
  // combination-tagged path just below it, which already does exactly
  // this. Mirrors that same, existing logic here, using the plain
  // per-location Inventory account completeCashPurchase already posts
  // to (ensureItemLocationInventoryAccount), so a transfer genuinely
  // moves value with the stock, not just its count and its space.
  if (!(combinationShape && combinationValuesAfterLocation)) {
    const unitCostMinor = getItemUnitCostMinor(itemName);
    if (unitCostMinor != null) {
      const valueMinor = quantity * unitCostMinor;
      const fromAccount = ensureItemLocationInventoryAccount(itemName, fromLocationName, asUserId(userId));
      const toAccount = ensureItemLocationInventoryAccount(itemName, toLocationName, asUserId(userId));
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
      const fromLeaf = ensureCombinationAccountLeaf('Inventory', fromInstance, asUserId(userId));
      const toLeaf = ensureCombinationAccountLeaf('Inventory', toInstance, asUserId(userId));
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
  const existing = db
    .prepare(
      `SELECT child.name AS link_name
       FROM current_entities child
       JOIN current_entities parent ON parent.id = child.parent_id
       WHERE parent.name = ? AND child.name LIKE ? || ' — Lead Time: ' || ? || ' (%'`
    )
    .get(itemName, itemName, vendorName) as { link_name: string } | undefined;
  if (existing) {
    const oldLinkType = existing.link_name.slice(`${itemName} — `.length);
    deleteEntityLink(itemName, oldLinkType, userId);
  }
  setEntityLink(itemName, `Lead Time: ${vendorName} (${days} days)`, vendorName, userId);
}

export function getItemLeadTimes(itemName: ItemName): { vendor: string; days: number }[] {
  const rows = db
    .prepare(
      `SELECT child.name AS link_name
       FROM current_entities child
       JOIN current_entities parent ON parent.id = child.parent_id
       WHERE parent.name = ? AND child.name LIKE ? || ' — Lead Time: %'`
    )
    .all(itemName, itemName) as { link_name: string }[];
  const results: { vendor: string; days: number }[] = [];
  for (const row of rows) {
    const match = row.link_name.match(/ — Lead Time: (.+) \((\d+) days\)$/);
    if (match) results.push({ vendor: match[1], days: parseInt(match[2], 10) });
  }
  return results;
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
    const consumed = db
      .prepare(
        `SELECT COALESCE(-SUM(jl.amount_minor), 0) AS consumed
         FROM journal_line jl
         JOIN current_entities p ON p.id = jl.account_id
         JOIN current_entities l ON l.id = jl.location_id
         WHERE p.name = ? AND l.name = ? AND jl.amount_minor < 0
           AND jl.effective_date >= date('now', '-' || ? || ' days')`
      )
      .get(row.item, row.location, windowDays) as { consumed: number };
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

export function createStockTake(locationName: LocationName, takeDate: string, userId: UserId): number {
  const locationId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(locationName) as { id: number } | undefined)?.id;
  if (!locationId) throw new ValidationError(`No location named "${locationName}".`);

  const takeEntity = Entity.create(`Stock Take — ${takeDate} — ${Date.now()} — draft`, locationId, userId);
  const takeId = takeEntity.id;

  const resolvedLocationName = (db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(locationId) as { name: string }).name;
  const itemsHere = (getInventoryListingByLocation().find((g) => g.location === resolvedLocationName)?.rows ?? [])
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
    updateEntity(lineEntity.id, { relation: p.item_name }, userId);
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
  const header = db
    .prepare(`SELECT t.id, l.name AS location, t.name FROM current_entities t JOIN current_entities l ON l.id = t.parent_id WHERE t.id = ? AND t.name LIKE 'Stock Take — %'`)
    .get(id) as { id: number; location: string; name: string } | undefined;
  if (!header) return undefined;
  const headerMatch = header.name.match(/^Stock Take — (\S+) — \d+ — (draft|completed)$/);
  if (!headerMatch) throw new ValidationError(`Malformed real stock take header name: "${header.name}".`);
  const lines = db
    .prepare(
      `SELECT l.id, item.name AS item, l.name
       FROM current_entities l
       JOIN current_entities item ON item.id = l.relation_id
       WHERE l.parent_id = ? AND l.name LIKE 'Line — %'`
    )
    .all(id) as { id: number; item: string; name: string }[];
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
  const row = db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(line.id) as { name: string };
  const newName = row.name.replace(/counted:\d*$/, `counted:${countedQuantity}`);
  updateEntity(line.id, { name: newName }, asUserId(1));
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
    { const inv = ensureItemLocationInventoryAccount(asItemName(line.item), take.location as LocationName, userId); stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), transdate: take.take_date, account: asAccountName(inv.inventoryAccount), accountId: inv.inventoryAccountId, amount_minor: valueMinor, memo: `Stock take variance: ${line.item}` }); }
    stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), transdate: take.take_date, account: asAccountName(varianceExpenseAccount), amount_minor: -valueMinor });

    const currentOnHand = getItemLocation(asItemName(line.item), take.location as LocationName).quantity_on_hand;
    const delta = line.counted_quantity! - currentOnHand;
    if (delta !== 0) {
      const { countAdjustmentAccount, countAdjustmentAccountId } = ensureItemQuantityAccounts(asItemName(line.item), userId);
      stageQuantityMovementLine(business, ledger, `${reference}-QTY`, asAccountName(line.item), delta, take.take_date, take.location as LocationName);
      stageQuantityMovementLine(business, ledger, `${reference}-QTY`, asAccountName(countAdjustmentAccount), -delta, take.take_date, undefined, countAdjustmentAccountId);
      postStagedQuantityMovement(business, ledger, `${reference}-QTY`, userId);
      adjustLocationCapacity(business, ledger, take.location as LocationName, asItemName(line.item), delta, take.take_date, userId, reference);
    }
    postJournalEntry(reference, business, ledger, userId);
  }

  const takeRow = db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(stockTakeId) as { name: string };
  updateEntity(stockTakeId, { name: takeRow.name.replace(/ — draft$/, ' — completed') }, userId);
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
  { const inv = ensureItemInventoryAccount(itemName, userId); stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), transdate: date, account: asAccountName(inv.inventoryAccount), accountId: inv.inventoryAccountId, amount_minor: -totalMinor }); }
  postJournalEntry(reference, business, ledger, userId);

  const { writeOffAccount, writeOffAccountId } = ensureItemQuantityAccounts(itemName, userId);
  stageQuantityMovementLine(business, ledger, `${reference}-QTY`, asAccountName(itemName), -quantity, date);
  stageQuantityMovementLine(business, ledger, `${reference}-QTY`, asAccountName(writeOffAccount), quantity, date, undefined, writeOffAccountId);
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
  if (existing) {
    const row = db.prepare(`SELECT detail_json FROM current_entities WHERE id = ?`).get(existing.id) as { detail_json: string };
    const detail = JSON.parse(row.detail_json);
    detail.quantity_on_hand += quantity;
    detail.cost_basis_minor = (detail.cost_basis_minor ?? 0) + (costBasisMinor ?? 0);
    db.prepare(`UPDATE entities SET detail_json = ? WHERE entity_id = ? AND deleted_at IS NULL`).run(JSON.stringify(detail), existing.id);
  } else {
    const created = Entity.create(lotName, itemId, userId);
    const detail = { received_date: receivedDate, expiration_date: expirationDate, quantity_on_hand: quantity, cost_basis_minor: costBasisMinor ?? null };
    db.prepare(`UPDATE entities SET detail_json = ? WHERE entity_id = ? AND deleted_at IS NULL`).run(JSON.stringify(detail), created.id);
  }

  postQuantityMovement(business, ledger, reference, asAccountName(itemName), quantity, userId, receivedDate);
}

export function consumeFromLots(itemName: ItemName, quantity: number): { lot_number: string; consumed: number; expiration_date: string | null; cost_basis_minor: number | null }[] {
  if (quantity <= 0) throw new ValidationError('Quantity to consume must be positive.');
  const itemId = resolveItemId(itemName);
  if (!itemId) throw new ValidationError(`No item named "${itemName}".`);

  const lotRows = db
    .prepare(`SELECT id, name, detail_json FROM current_entities WHERE parent_id = ? AND name LIKE '% — Lot — %'`)
    .all(itemId) as { id: number; name: string; detail_json: string }[];
  const lots = lotRows
    .map((r) => {
      const detail = JSON.parse(r.detail_json);
      const lotNumber = r.name.split(' — Lot — ')[1];
      return { id: r.id, lot_number: lotNumber, expiration_date: detail.expiration_date as string | null, quantity_on_hand: detail.quantity_on_hand as number, cost_basis_minor: detail.cost_basis_minor as number | null };
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
  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, lot.quantity_on_hand);
    const costBasisTaken = lot.cost_basis_minor != null ? Math.round((lot.cost_basis_minor * take) / lot.quantity_on_hand) : null;
    const row = db.prepare(`SELECT detail_json FROM current_entities WHERE id = ?`).get(lot.id) as { detail_json: string };
    const detail = JSON.parse(row.detail_json);
    detail.quantity_on_hand -= take;
    detail.cost_basis_minor = costBasisTaken != null ? lot.cost_basis_minor! - costBasisTaken : lot.cost_basis_minor;
    db.prepare(`UPDATE entities SET detail_json = ? WHERE entity_id = ? AND deleted_at IS NULL`).run(JSON.stringify(detail), lot.id);
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
  const rows = db
    .prepare(
      `SELECT item.name AS item,
              SUBSTR(lot.name, INSTR(lot.name, ' — Lot — ') + LENGTH(' — Lot — ')) AS lot_number,
              json_extract(lot.detail_json, '$.expiration_date') AS expiration_date,
              CAST(json_extract(lot.detail_json, '$.quantity_on_hand') AS INTEGER) AS quantity_on_hand,
              CAST(julianday(json_extract(lot.detail_json, '$.expiration_date')) - julianday(?) AS INTEGER) AS days_until_expiration
       FROM current_entities lot
       JOIN current_entities item ON item.id = lot.parent_id
       WHERE lot.name LIKE '% — Lot — %'
         AND json_extract(lot.detail_json, '$.expiration_date') IS NOT NULL
         AND CAST(json_extract(lot.detail_json, '$.quantity_on_hand') AS INTEGER) > 0
         AND julianday(json_extract(lot.detail_json, '$.expiration_date')) - julianday(?) <= ?`
    )
    .all(asOfDate, asOfDate, withinDays) as ExpiringLot[];
  return rows.sort((a, b) => a.days_until_expiration - b.days_until_expiration);
}

export function createSystemEntity(name: string, parentId: number | null): number {
  if (parentId == null) throw new ValidationError('createSystemEntity requires a real, existing parent id.');
  return Entity.create(name, parentId, asUserId(1)).id;
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
  db.transaction(() => {
  const qtyName = `${orderReference} Qty`;
  const valueName = `${orderReference} Value`;
  const ordersId = (db.prepare(`SELECT id FROM current_entities WHERE name = 'Orders'`).get() as { id: number }).id;
  for (const name of [qtyName, valueName]) {
    const existing = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(name);
    if (!existing) createSystemEntity(name, ordersId);
  }
  if (vendor) updateEntity((db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(qtyName) as { id: number }).id, { relation: vendor }, userId);
  if (item) updateEntity((db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(valueName) as { id: number }).id, { relation: item }, userId);
  if (location) setDimensionParent(qtyName, 'Location', location, userId);
  postQuantityMovement(business, ledger, `${orderReference}-PLACE`, asAccountName(qtyName), quantity, userId, transdate);
  postQuantityMovement(business, ledger, `${orderReference}-PLACE-VALUE`, asAccountName(valueName), priceMinor, userId, transdate);
  if (item) {
    const { onOrderAccount, onOrderAccountId } = ensureItemQuantityAccounts(item, userId);
    postQuantityMovement(business, ledger, `${orderReference}-PLACE-ONORDER`, asAccountName(onOrderAccount), quantity, userId, transdate, undefined, onOrderAccountId);
  }
  })();
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
  db.transaction(() => {
  postQuantityMovement(business, ledger, `${orderReference}-FULFILL-${fulfillingReference}`, asAccountName(`${orderReference} Qty`), -quantityFulfilled, userId, transdate);
  postQuantityMovement(business, ledger, `${orderReference}-FULFILL-${fulfillingReference}-VALUE`, asAccountName(`${orderReference} Value`), -valueFulfilledMinor, userId, transdate);
  })();
}

export function getOrderStatus(orderReference: string): { quantity: number; value_minor: number } {
  const qty =
    (db.prepare(`SELECT balance_minor FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name = ?)`).get(`${orderReference} Qty`) as
      | { balance_minor: number }
      | undefined)?.balance_minor ?? 0;
  const value =
    (db.prepare(`SELECT balance_minor FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name = ?)`).get(`${orderReference} Value`) as
      | { balance_minor: number }
      | undefined)?.balance_minor ?? 0;
  return { quantity: qty, value_minor: value };
}

