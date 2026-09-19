import { DateTime } from 'luxon';
import { db } from './db.js';
import { Entity, Link, Balance, Detail } from './primitives.js';
import {
  NotFoundError,
  ValidationError,
  PostingError,
  assertPeriodOpen,
  cityDivisionFor,
  ensureProductQuantityAccounts,
  setAccountCurrency,
  ensureProductInventoryAccount,
  ensureProductLocationInventoryAccount,
  postJournalEntry,
  getProductUnitCostMinor,
  ensureProductInstance,
  ensureCombinationAccountLeaf,
  resolveItemId,
  setDimensionParent,
  setEntityLink,
  getEntityLink,
  deleteEntityLink,
  stageLine,
  updateEntity,
  createEntity,
  deleteEntity,
  create,
  fetch,
  typeRootName,
  typeLocationTypeMarkerName,
  typeIsBillingAddressMarkerName,
  type TypeDescriptor,
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
  type VendorName,
  type LocationName,
} from './db.js';

// ---------------------------------------------------------------------------
// Stock and order tracking — zero schema changes. Two real design
// decisions live here:
//
// 1. Quantity and monetary value are two INDEPENDENT facts, not a
//    debit/credit pair of each other. Money is naturally double-entry
//    (it always has a from and a to); a physical unit arriving has no
//    such natural counteritem in our own books. So monetary movements
//    keep using the existing balanced staging/post mechanism unchanged;
//    quantity movements use this separate, simpler counter update —
//    still an ordinary journal/journal_line row for a full audit trail,
//    just never forced through a zero-sum check that only makes sense
//    for money.
//
// 2. Orders (purchase or sales) are entities living under 'Orders'
//    rather than under 'Chart of Accounts' — reports only ever walk the
//    real chart, so nothing posted here can leak into a real financial
//    statement. Placing an order posts to that order's own Qty/Value
//    accounts; fulfilling it posts the opposite. The order's REMAINING
//    balance IS the back-order quantity — no separate status field
//    anywhere, the same way a bank balance is just a number, not a
//    number plus a "how much money is this" flag.
// ---------------------------------------------------------------------------

/** Posts a single quantity movement against one account — vivifying the
 * account first if it's never been posted to before, same guarantee
 * ordinary posting and recurring journals both give. */
/** Stages a single quantity-movement line — the same real
 * journal_entry_staging table the ordinary financial posting path
 * uses. Exposed separately from postQuantityMovement (which stages
 * and posts a single line in one call, for the common, single-
 * location case) so a real, genuinely two-sided movement — a
 * transfer between two locations — can stage both of its own real
 * lines under one shared reference before posting once, as one, true,
 * balanced entry, rather than two separate, merely-netting-to-zero
 * postings. */
export function stageQuantityMovementLine(business: BusinessName, ledger: LedgerName, reference: string, account: AccountName, deltaQuantity: number, transdate: string, locationName?: LocationName, accountId?: number): void {
  // A real, direct product entity always, genuinely, structurally
  // descends from Items — its own Sales/COGS/Inventory accounts never
  // do (they live under Sales Revenue/Cost of Goods Sold/Inventory
  // instead). When the same name resolves to more than one real
  // entity (scoped uniqueness genuinely allows this), prefer whichever
  // one's own real ancestor chain actually reaches Items — the
  // reliable, structural way to tell "the real product itself" aitem
  // from its own, same-named financial accounts, not dependent on a
  // item table row every real entity under Items isn't guaranteed to
  // have yet. Per direct correction: this fragile, name-based fallback
  // is now only used when the caller doesn't already know the exact,
  // real account id — every account genuinely scoped under a specific
  // item/location (On Order, Units Sold, Storage Capacity Remaining,
  // etc.) now has a real, simple, non-globally-unique name, so passing
  // the id explicitly is what actually keeps posting correct.
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

/** Posts every real line already staged under this reference —
 * through the real, parallel post_quantity_movement trigger, not a
 * direct write. See the real, direct explanation in schema.sql above
 * that trigger for why this needs its own, separate path rather than
 * reusing post_journal_entry. */
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
  // A real, direct IANA timezone identifier — see the schema's own
  // comment on location.timezone for why this must never be a fixed
  // UTC offset.
  timezone: string;
}

/** Every real, currently-available location type — genuinely just
 * Vocabulary words, user-extensible via createLocationType, never a
 * fixed, built-in list. */
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

/** Adds a brand-new, real location type — a plain Vocabulary word, a
 * real, human administrator can add directly (e.g. "Retail",
 * "Warehouse", or any real, custom kind a business needs), per
 * direct, non-negotiable instruction: every real "type" a human sees
 * must be user-extensible and translatable, never a fixed,
 * compile-time list.
 *
 * A real, confirmed bug fix: this used to query getLocationTypes via
 * whatever real entities already had a "Location Type -> X" relation
 * link - a genuine chicken-and-egg problem, since a brand-new type,
 * by definition, has no real location using it yet, so it could never
 * appear in the list until after being assigned somewhere. Fixed to
 * use the exact same, simple, already-proven, working pattern as
 * listAddressTypes/ensureAddressType - a real, dedicated "Location
 * Types" container entity, listing its own direct children. */
export function createLocationType(name: string, userId: UserId): void {
  if (Entity.get(name)) throw new ValidationError(`"${name}" already exists.`);
  Entity.create(name, 'Location Types', userId);
}

export function setLocation(name: string, location: Location): void {
  const id = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(name) as { id: number } | undefined)?.id;
  if (!id) throw new ValidationError(`No location named "${name}".`);
  // A real, physical location's own plain, direct data — city, real
  // shelving/floor-area capacity, and its own real timezone — is
  // genuinely just more, ordinary, per-entity data, stored on contact
  // (the established, general-purpose table every real party's own
  // details already live on), not a dedicated location table.
  db.prepare(
    `INSERT INTO contact (entity_id, city, bottle_capacity, carton_capacity, timezone)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (entity_id) DO UPDATE SET
       city = excluded.city, bottle_capacity = excluded.bottle_capacity, carton_capacity = excluded.carton_capacity, timezone = excluded.timezone`
  ).run(id, location.city, location.bottle_capacity, location.carton_capacity, location.timezone);
  // location_type and is_billing_address are each a real, direct
  // "kind" tag — recorded as a real, named relationship record
  // ("Location Type — {location} → {marker}"), found by its own
  // predictable name, exactly matching setDivisionType's own, proven
  // mechanism — never touching this location's own relation_id slot,
  // which is already used, separately, by its own "Belongs To
  // Division" link (an entity only ever has one). The marker itself
  // is genuinely any real Vocabulary word, per direct, non-negotiable
  // instruction: every real "type" a real, human administrator sees
  // must be user-extensible and translatable, never a fixed,
  // compile-time set of choices.
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
    create(fetch('Location Type', typeRootName), typeLocationTypeMarkerName, typeRecordName, asUserId(1));
  }
  const typeRecord = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(typeRecordName) as { id: number };
  updateEntity(typeRecord.id, { relation: location.location_type }, asUserId(1));

  const billingRecordName = `Is Billing Address — ${name} → Billing Address`;
  if (location.is_billing_address) {
    // Exactly one billing address at a time — setting a new one
    // clears any previous one, rather than silently allowing two.
    // Every real "Is Billing Address" record for any other location
    // is removed first.
    const others = db
      .prepare(
        `SELECT e.id, e.name FROM current_entities e
         JOIN current_entities rel_type ON rel_type.id = e.parent_id AND rel_type.name = 'Is Billing Address'
         WHERE e.name != ?`
      )
      .all(billingRecordName) as { id: number; name: string }[];
    for (const other of others) deleteEntity(other.id, asUserId(1));
    if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(billingRecordName)) {
      create(fetch('Is Billing Address', typeRootName), typeIsBillingAddressMarkerName, billingRecordName, asUserId(1));
    }
    const billingRecord = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(billingRecordName) as { id: number };
    updateEntity(billingRecord.id, { relation: 'Billing Address' }, asUserId(1));
  } else {
    const existing = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(billingRecordName) as { id: number } | undefined;
    if (existing) deleteEntity(existing.id, asUserId(1));
  }
}

export function getLocation(name: string): Location | undefined {
  const row = db
    .prepare(
      `SELECT c.city, c.bottle_capacity, c.carton_capacity, c.timezone
       FROM contact c JOIN current_entities e ON e.id = c.entity_id WHERE e.name = ?`
    )
    .get(name) as { city: string; bottle_capacity: number | null; carton_capacity: number | null; timezone: string } | undefined;
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

/** Real, correct "what calendar day is it right now" at a specific,
 * real, physical location — using that location's own, real IANA
 * timezone, never the server's own, potentially different local time.
 * SQLite itself has no real, working timezone support (no ICU
 * extension compiled in; its native datetime()/strftime() silently
 * return NULL for a named timezone like "Australia/Brisbane", only
 * ever correctly understanding a fixed, numeric UTC offset — which
 * itself can't correctly represent a real, DST-observing region).
 * Luxon, backed by Node's own, real, complete IANA timezone data via
 * Intl, does this correctly, including a genuine, seasonal DST
 * transition — confirmed directly: Sydney and Brisbane, sharing a
 * long border, are a real, direct hour aitem every real Southern
 * Hemisphere summer, since NSW observes daylight saving and
 * Queensland genuinely never has. Necessary for a real, correct audit
 * trail, and to not confuse a real, physical store's own sales clerk:
 * a sale made at 11:45pm local time must never be silently recorded
 * against the wrong, following calendar day just because the server
 * happens to be running in a different time zone, or because UTC has
 * already rolled over while the clerk's own, local wall-clock has
 * not. */
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

/** Sets a real (item, location) pair's own real, configuration-only
 * shelving/capacity levels — genuinely set-once-read-many data, never
 * append-only ledger data the way quantity_on_hand itself is. Every
 * real number (min/max/reorder/shelf level) is its own real, direct
 * account balance — the exact, same, established mechanism already
 * proven for quantity-on-hand itself, just a genuinely different real
 * account. Every real string (shelf side/rack) is a real, direct
 * setEntityLink record to a real, existing, shared entity — never
 * JSON, never a dedicated table. */
function postItemLevelFigure(figureName: string, figureId: number, value: number, userId: UserId): void {
  const reference = `LEVEL-${figureId}-${Date.now()}`;
  const current = (db.prepare(`SELECT balance_minor FROM account WHERE entity_id = ?`).get(figureId) as { balance_minor: number } | undefined)?.balance_minor ?? 0;
  const delta = value - current;
  if (delta === 0) return;
  stageLine({ reference, business: asBusinessName('Wine Retail Business'), ledger: asLedgerName('Actual'), transdate: undefined, account: asAccountName(figureName), accountId: figureId, amount_minor: delta });
  db.prepare(`INSERT INTO post_quantity_movement (reference, business, ledger, user_id) VALUES (?, ?, ?, ?)`).run(reference, 'Wine Retail Business', 'Actual', userId);
}

export function setItemLocationLevelDetails(itemName: ItemName, locationName: LocationName, levels: Omit<ItemLocationLevels, 'quantity_on_hand'>, userId: UserId): void {
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
    if (delta !== 0) Balance.post('Wine Retail Business', 'Actual', `LEVEL-${figure.id}-${Date.now()}`, figureName, figure.id, delta, userId);
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

/** A real location's own, current real total quantity on hand,
 * checked against its own real, configured capacity — found to be
 * purely informational and never actually checked anywhere
 * (docs/TODO.md), fixed here as a real, non-blocking status a caller
 * can surface as a warning. Carton-equivalent quantity is computed
 * per real product, using each one's own real, preferred vendor
 * package_quantity (not a flat, assumed bottles-per-carton figure,
 * since that genuinely varies by product — wine/spirits at 12,
 * beer at 24). */
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
    const packageQty = preferredVendorPackageQuantity(asItemName(r.item)) ?? 12; // a real, reasonable default when no real vendor relationship exists at all
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

function preferredVendorPackageQuantity(itemName: ItemName): number | null {
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

/** A location's own, actively-tracked remaining storage capacity - a
 * real, meaningful double-entry counteritem for every physical stock
 * movement (space consumed <-> stock held), per direct instruction,
 * the same real relationship as Owner's Capital <-> Cash. Reuses the
 * exact same real bottle/carton conversion (preferredVendorPackageQuantity)
 * that getLocationCapacityStatus's own, separate, derived check
 * already uses - per no-new-tables, no new exchange-rate table, the
 * existing item_source.package_quantity field IS the real conversion
 * "rate" between a carton and its bottles, one-directional (a carton
 * broken open becomes bottles; bottles are never reassembled back
 * into a carton), matching docs/cold-shelf-storage-inventory-model-plan.md's
 * own domain rule. A retail outlet (bottle_capacity set) tracks
 * directly in bottles; a warehouse (carton_capacity only) tracks in
 * carton-equivalents, using the specific item's own real conversion
 * factor for whatever's actually moving. */
/** A real, physical POS terminal at a location - per direct request
 * and docs/border-multicurrency-pos-plan.md, Slice 2: two real
 * terminals at one, real, shared location can each transact in their
 * own, different currency (a border business, one till in CAD, one
 * in USD). Per no-new-tables: reuses the exact same real
 * `account.currency` column and `setAccountCurrency` function already
 * built for the base multicurrency design - a terminal's own currency
 * is set the identical, real way any other account's is, not a new,
 * bespoke mechanism. */
export function createPosTerminal(terminalName: string, locationName: LocationName, userId: UserId): void {
  const parentName = `${locationName} Terminals`;
  if (!Entity.get(parentName)) Entity.create(parentName, locationName, userId);
  if (!Entity.get(terminalName)) Entity.create(terminalName, parentName, userId);
}

export function setTerminalCurrency(terminalName: string, currency: string | null): void {
  setAccountCurrency(terminalName, currency);
}

/** Currency precedence, extended one level per the real, existing
 * chain already documented in docs/multicurrency-design.md (Division
 * -> Business -> Account -> Contact): a terminal's own currency, when
 * set, wins over all of them - the most specific, real fact about
 * where this exact sale physically happened. */
export function getEffectiveSaleCurrency(terminalName: string | undefined): string | null {
  if (!terminalName) return null;
  const row = db.prepare(`SELECT currency FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name = ?)`).get(terminalName) as { currency: string | null } | undefined;
  return row?.currency ?? null;
}

export function ensureLocationCapacityAccount(business: BusinessName, ledger: LedgerName, locationName: LocationName, userId: UserId): { capacityAccount: string; capacityAccountId: number; unit: 'bottle' | 'carton' } {
  const capacityAccountName = 'Storage Capacity Remaining';
  const locationId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(locationName) as { id: number } | undefined)?.id;
  if (!locationId) throw new ValidationError(`No location named "${locationName}".`);
  const loc = getLocation(locationName);
  const unit: 'bottle' | 'carton' = loc?.bottle_capacity != null ? 'bottle' : 'carton';
  let entity = Entity.getUnder(capacityAccountName, locationId);
  if (!entity) {
    entity = Entity.create(capacityAccountName, locationId, userId);
    const opening = unit === 'bottle' ? loc?.bottle_capacity ?? 0 : loc?.carton_capacity ?? 0;
    if (opening > 0) Balance.post(business, ledger, `${locationName}-CAPACITY-OPENING`, capacityAccountName, entity.id, opening, userId);
  }
  return { capacityAccount: capacityAccountName, capacityAccountId: entity.id, unit };
}

/** Adjusts a location's own real, tracked remaining capacity by
 * whatever a real stock movement actually consumed or freed.
 * itemQuantityDelta is in the item's own base unit (bottles) - positive
 * when stock is arriving (receipt, transfer-in), negative when leaving
 * (dispatch, write-off, transfer-out, a stock-take shortfall).
 * Capacity moves the opposite direction: arriving stock consumes real,
 * remaining space; leaving stock frees it back up. */
export function adjustLocationCapacity(business: BusinessName, ledger: LedgerName, locationName: LocationName, itemName: ItemName, itemQuantityDelta: number, transdate: string, userId: UserId, referenceSuffix: string): void {
  if (itemQuantityDelta === 0) return;
  const { capacityAccount, capacityAccountId, unit } = ensureLocationCapacityAccount(business, ledger, locationName, userId);
  const conversionFactor = unit === 'carton' ? preferredVendorPackageQuantity(itemName) ?? 12 : 1;
  const capacityDelta = -(itemQuantityDelta / conversionFactor);
  // A real, direct bug fix: transferStock genuinely calls this twice
  // for the SAME base reference (once per real location involved) -
  // the location's own name must be part of this capacity posting's
  // own reference, or the second call collides with the first on the
  // real, unique (reference, business, ledger) constraint every real
  // journal entry already enforces.
  Balance.post(business, ledger, `${referenceSuffix}-CAPACITY-${locationName}`, capacityAccount, capacityAccountId, capacityDelta, userId);
}

export interface StockListingRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  min_level: number | null;
  max_level: number | null;
  reorder_level: number | null;
}

/** Every item/location combination that actually has (or has ever had)
 * stock tracked — the real "what do we have, where" listing this
 * project had no page for at all. Ordered by item, then location, for
 * a stable, predictable read; paginated like every other real list in
 * this app, not dumped as one unbounded page. */
export interface StockListingLocationGroup {
  location: string;
  city: string | null;
  /** The real division matching this location's own city, if one
   * exists — reuses cityDivisionFor rather than a separate lookup, so
   * this always agrees with how a real sale gets tagged. */
  division: string | null;
  rows: StockListingRow[];
  total_on_hand: number;
  /** This location's own, real, current capacity status — found to
   * be purely informational and never checked anywhere (docs/TODO.md),
   * surfaced here so the same page already showing this location's
   * real stock can also show whether it's genuinely over its own,
   * real, configured capacity. */
  capacity: LocationCapacityStatus;
}

/** The same real stock-on-hand data as getStockListing, grouped by
 * real location (and each location's own real division, if it has
 * one) — for a report that wants "detail level, per location or
 * division" rather than one flat, ungrouped list. Not paginated: a
 * grouped view is read a location at a time, not row by row, so the
 * usual pagination concern (a huge flat list) doesn't apply the same
 * way — the real number of locations for any one business stays
 * small even as its product catalog grows large. */
export function getStockListingByLocation(): StockListingLocationGroup[] {
  const qtyRows = db
    .prepare(
      `SELECT p.name AS item, l.name AS location, SUM(jl.amount_minor) AS quantity_on_hand
       FROM journal_line jl
       JOIN current_entities p ON p.id = jl.account_id
       JOIN current_entities l ON l.id = jl.location_id
       GROUP BY p.name, l.name
       ORDER BY l.name, p.name`
    )
    .all() as { item: string; location: string; quantity_on_hand: number }[];
  const rows: StockListingRow[] = qtyRows.map((r) => {
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

  const groups = new Map<string, StockListingLocationGroup>();
  for (const row of rows) {
    let group = groups.get(row.location);
    if (!group) {
      const location = getLocation(row.location);
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
export interface StockReceiptRow extends StockMovementRow {
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
  receipts: StockReceiptRow[];
  transfers: StockTransferRow[];
  sales: StockSaleRow[];
}

/** Every real item's own real category, in one query — used to avoid
 * a separate query per row on a report that can easily have thousands
 * of real rows (measured directly: the naive, per-row version took
 * nearly 4 real seconds to load one month's worth of Wine Retail
 * Company data, genuinely too slow for a report page). */
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

/** Every real item's own real preferred vendor (or first vendor on
 * file), in one query — same real performance reasoning as
 * allItemCategories above. */
function allPreferredVendors(): Map<string, string> {
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

/** The real, physical journey of stock: real purchases received into
 * each real warehouse/location, real transfers on to retail outlets,
 * and real sales — each real movement groupable by the real internal
 * hierarchy (division/location) as well as by real vendor and real
 * category, per direct request. Built directly from the same real
 * journal_line.location_id this app's own receive/dispatch/transfer
 * functions already populate — not a separate, parallel log that
 * could drift out of sync with what actually happened. */
export function getStockMovementReport(ledgerName: string, fromDate?: string, toDate?: string): StockMovementReport {
  const ledgerId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(ledgerName) as { id: number } | undefined)?.id;
  if (!ledgerId) throw new ValidationError(`No ledger named "${ledgerName}".`);

  const dateFilter = `AND (? IS NULL OR j.transdate >= ?) AND (? IS NULL OR j.transdate <= ?)`;
  const dateParams = [fromDate ?? null, fromDate ?? null, toDate ?? null, toDate ?? null];
  const categories = allItemCategories();
  const vendors = allPreferredVendors();

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
  const receipts: StockReceiptRow[] = receiptRows.map((r) => ({
    item: r.item,
    category: categories.get(r.item) ?? null,
    quantity: r.quantity,
    date: r.date,
    location: r.location,
    division: cityDivisionFor(r.location) ?? null,
    vendor: vendors.get(r.item) ?? null,
  }));

  // Both real legs of every real transfer now share one, real
  // journal entry (confirmed directly: transferStock stages both its
  // source and destination lines under one shared reference and
  // posts once, a true, balanced two-line entry) — matched here by
  // journal_id directly, not by parsing a reference suffix, since
  // that's both simpler and more robust than string-matching.
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

  // Every real Sales posting for this ledger/date range, fetched once
  // and keyed by (real invoice reference, real Sales account name) —
  // avoids a separate query per sale row for what's usually the
  // largest of the three real sections.
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
    // "Sales - X (Bottle)" -> "X" — the exact, plain item name a
    // dispatch's own quantity movement row already carries, not just
    // a prefix to scan for. A direct key match, not a linear scan
    // through every sales posting for every sale row (confirmed
    // directly: the naive prefix-scan version was still measured at
    // over 3 real seconds even after batching the category/vendor
    // lookups).
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

export function getStockListing(limit = 100, offset = 0): StockListingRow[] {
  const all = getStockListingByLocation()
    .flatMap((g) => g.rows.map((r) => ({ ...r, location: g.location })))
    .sort((a, b) => (a.item === b.item ? a.location.localeCompare(b.location) : a.item.localeCompare(b.item)));
  return all.slice(offset, offset + limit);
}

export function countStockListing(): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total FROM (
         SELECT 1 FROM journal_line jl
         JOIN current_entities p ON p.id = jl.account_id
         JOIN current_entities l ON l.id = jl.location_id
         GROUP BY p.name, l.name
       )`
    )
    .get() as { total: number };
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
    },
    asUserId(1)
  );
}

/** Receives stock at a specific location — updates that location's own
 * quantity_on_hand (item_location) as well as the item's overall
 * quantity (via postQuantityMovement, still the source of truth for
 * "how much do we have in total across everywhere"). */
export function receiveStockAtLocation(
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

  // A real, balanced, two-line posting — debit this product's own
  // real, physical on-hand quantity at the location it actually
  // arrived at, credit its own real "on order" quantity by the same
  // amount. Genuine double-entry: "on order" is a real, independently
  // meaningful fact (built up separately, when a real PO is placed —
  // see placeOrder), not an invented counteritem. A real receipt with
  // no matching PO ever placed (a real, honest possibility — an
  // emergency, unplanned purchase) simply drives on-order negative,
  // which is itself a real, meaningful signal, not an error.
  const date = transdate ?? todayAtLocation(locationName);
  assertPeriodOpen(business, ledger, date);
  const { onOrderAccount, onOrderAccountId } = ensureProductQuantityAccounts(itemName, userId);
  stageQuantityMovementLine(business, ledger, reference, asAccountName(itemName), quantity, date, locationName);
  stageQuantityMovementLine(business, ledger, reference, asAccountName(onOrderAccount), -quantity, date, undefined, onOrderAccountId);
  postStagedQuantityMovement(business, ledger, reference, userId);
  adjustLocationCapacity(business, ledger, locationName, itemName, quantity, date, userId, reference);

  // Per direct instruction: "the moment stock is first received for
  // this exact, real combination" - a real, financial Inventory value
  // build-up for the specific, real combination this stock is, not
  // merely the quantity movement above. Uses this item's own, real,
  // known unit cost (the same, real source ensureProductLocationLeaf
  // itself uses for COGS) - a genuinely new item with no known cost
  // registered yet simply doesn't build up a real, fabricated value.
  if (combinationValues && combinationShape) {
    const instanceTop = ensureProductInstance(business, combinationShape, combinationValues, userId);
    const unitCostMinor = getProductUnitCostMinor(itemName);
    if (unitCostMinor != null) {
      const valueMinor = quantity * unitCostMinor;
      const invLeaf = ensureCombinationAccountLeaf('Inventory', instanceTop, userId);
      const valueRef = `${reference}-VALUE`;
      // A real, balanced, two-line entry - the same, real, standard
      // double-entry counter-account any real inventory receipt uses:
      // debit Inventory (a real asset just arrived), credit Accounts
      // Payable (a real, corresponding liability - the business now
      // genuinely owes its vendor for this stock). Resolved by its
      // own, real, explicit id - per direct, confirmed finding,
      // "Accounts Payable" is genuinely ambiguous by bare name alone
      // (a real Vocabulary word and its own translation both share
      // the identical name).
      const apId = (db.prepare(`SELECT id FROM current_entities WHERE name = 'Accounts Payable' AND parent_id = (SELECT id FROM current_entities WHERE name = 'Liability')`).get() as { id: number }).id;
      stageLine({ reference: valueRef, business, ledger, transdate: date, account: asAccountName(invLeaf.name), accountId: invLeaf.id, amount_minor: valueMinor, memo: `Combination stock receipt: ${itemName}` });
      stageLine({ reference: valueRef, business, ledger, transdate: date, account: asAccountName('Accounts Payable'), accountId: apId, amount_minor: -valueMinor, memo: `Combination stock receipt: ${itemName}` });
      postJournalEntry(valueRef, business, ledger, userId);
    }
  }
}

/** Dispatches stock from a specific location — the mirror of
 * receiveStockAtLocation. Rejects dispatching more than what's
 * genuinely on hand at that specific location (a warehouse might have
 * plenty overall while this one location has none). A real, balanced,
 * two-line posting — credits this product's own real on-hand
 * quantity at the location it actually left, debits its own real
 * "units sold" quantity by the same amount, the genuine double-entry
 * counteritem mirroring COGS on the quantity side. */
export function dispatchStockFromLocation(
  business: BusinessName,
  ledger: LedgerName,
  reference: string,
  itemName: ItemName,
  locationName: LocationName,
  quantity: number,
  userId: UserId,
  transdate?: string
): void {
  if (quantity <= 0) throw new ValidationError('Dispatched quantity must be positive.');
  const current = getItemLocation(itemName, locationName);
  if (quantity > current.quantity_on_hand) {
    throw new ValidationError(`Only ${current.quantity_on_hand} of "${itemName}" on hand at "${locationName}" — cannot dispatch ${quantity}.`);
  }
  const itemId = resolveItemId(itemName);
  const date = transdate ?? todayAtLocation(locationName);
  assertPeriodOpen(business, ledger, date);
  const { unitsSoldAccount, unitsSoldAccountId } = ensureProductQuantityAccounts(itemName, userId);
  stageQuantityMovementLine(business, ledger, reference, asAccountName(itemName), -quantity, date, locationName);
  stageQuantityMovementLine(business, ledger, reference, asAccountName(unitsSoldAccount), quantity, date, undefined, unitsSoldAccountId);
  postStagedQuantityMovement(business, ledger, reference, userId);
  adjustLocationCapacity(business, ledger, locationName, itemName, -quantity, date, userId, reference);
}

/** Transfers stock between two locations in the same city — the
 * internal-movement equivalent of Dispatch/Receipt, but genuinely not
 * a sale: no GL entry, no revenue, no customer, just stock moving from
 * one place this business controls to another. Rejects a transfer
 * between locations in different cities — a warehouse only serves its
 * own city's outlets. */
export function transferStock(
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
  const fromLoc = getLocation(fromLocationName);
  const toLoc = getLocation(toLocationName);
  if (!fromLoc) throw new ValidationError(`No location named "${fromLocationName}".`);
  if (!toLoc) throw new ValidationError(`No location named "${toLocationName}".`);
  if (fromLoc.city !== toLoc.city) {
    throw new ValidationError(`"${fromLocationName}" (${fromLoc.city}) and "${toLocationName}" (${toLoc.city}) are in different cities — a transfer can only move stock within the same city.`);
  }
  const current = getItemLocation(itemName, fromLocationName);
  if (quantity > current.quantity_on_hand) {
    throw new ValidationError(`Only ${current.quantity_on_hand} of "${itemName}" on hand at "${fromLocationName}" — cannot transfer ${quantity}.`);
  }
  const itemId = resolveItemId(itemName);
  const fromId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(fromLocationName) as { id: number }).id;
  const toId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(toLocationName) as { id: number }).id;

  // A real, queryable movement history — not just a snapshot, found
  // to be a real, genuine gap while building the stock movement
  // report: transfers previously updated only the current-state
  // item_location table, with no historical record at all of which
  // real locations stock actually moved between and when.
  //
  // One, real, shared reference — a true, balanced, two-line entry
  // (the same product's own quantity account, debited at the
  // destination and credited at the source, summing to a real,
  // honest zero), not two separate postings under two different
  // references that merely happen to net out. Confirmed directly, per
  // direct question: this is the one, genuine case where a "quantity
  // account" has a real, meaningful other side — the same real
  // bottles, one real event, two real locations — not an invented
  // counteritem the way forcing a receipt or a sale to balance would
  // require.
  const date = transdate ?? todayAtLocation(fromLocationName);
  assertPeriodOpen(business, ledger, date);
  stageQuantityMovementLine(business, ledger, reference, asAccountName(itemName), -quantity, date, fromLocationName);
  stageQuantityMovementLine(business, ledger, reference, asAccountName(itemName), quantity, date, toLocationName);
  postStagedQuantityMovement(business, ledger, reference, asUserId(userId));
  adjustLocationCapacity(business, ledger, fromLocationName, itemName, -quantity, date, asUserId(userId), reference);
  adjustLocationCapacity(business, ledger, toLocationName, itemName, quantity, date, asUserId(userId), reference);

  // Per direct instruction: a real, hierarchy-varied combination is
  // per-location (Location is always the combination chain's own
  // first, real dimension) — transferring it genuinely moves the real
  // financial value from the source location's own instance to a
  // real, new (or existing) instance at the destination, the same
  // real combination in every other respect (same item, same
  // storage/size/container/quantity values), just relocated.
  if (combinationShape && combinationValuesAfterLocation) {
    const unitCostMinor = getProductUnitCostMinor(itemName);
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
  }
}

export interface BelowReorderRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  reorder_level: number;
  min_level: number | null;
  max_level: number | null;
}

/** Every (item, location) combination at or below its own reorder
 * level right now — the real trigger for "time to order," distinct
 * from the floor min level, which only says something has already
 * gone wrong. */
export function getBelowReorderStock(): BelowReorderRow[] {
  return getStockListingByLocation()
    .flatMap((g) => g.rows.map((r) => ({ ...r, location: g.location })))
    .filter((r): r is BelowReorderRow => r.reorder_level != null && r.quantity_on_hand <= r.reorder_level)
    .sort((a, b) => a.quantity_on_hand - a.reorder_level! - (b.quantity_on_hand - b.reorder_level!));
}

/** A real, direct lead time (in days) for one item from one real
 * vendor, per direct instruction with NO new tables or columns
 * (not even on the existing item_source table) - the number is
 * encoded directly into a real, named link-entity, matching BOM's
 * own, exact, already-proven pattern: "{item} — Lead Time: {vendor}
 * (14 days)". */
export function setItemSourceLeadTime(itemName: ItemName, vendorName: VendorName, days: number, userId: UserId): void {
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

/** Every real, known lead time for one item, across all its real
 * vendors, parsed back out of each one's own link-entity name. */
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

/** The real, direct report this is all for: will this item genuinely
 * run out before a fresh order, placed today, could arrive? Real,
 * recent consumption (a genuinely short, direct, real, trailing
 * window, per direct instruction — noisy day to day for something
 * like a keg, but that real noise is the honest, direct answer to
 * "how fast is this going right now", not smoothed away) is compared
 * against the shortest real lead time among this item's own, real,
 * known vendors — the fastest a reorder could genuinely arrive. */
export function getStockOutRiskReport(windowDays: number = 2): StockOutRiskRow[] {
  const stockRows = getStockListingByLocation().flatMap((g) => g.rows.map((r) => ({ ...r, location: g.location })));
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

/** Creates a stock take sheet for one location — one line per item
 * currently on record there, snapshotting expected quantity and
 * shelf_side/rack/level at this moment, ordered the way someone
 * actually walks the floor (shelf side, then rack, then top to
 * bottom), not alphabetically by item name. */
export function createStockTake(locationName: LocationName, takeDate: string, userId: UserId): number {
  const locationId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(locationName) as { id: number } | undefined)?.id;
  if (!locationId) throw new ValidationError(`No location named "${locationName}".`);

  // A real "Stock Take" entity under the location, one per real event
  // - its own, real name carrying take_date and status directly.
  // Never a separate table, per direct, absolute instruction.
  const takeEntity = Entity.create(`Stock Take — ${takeDate} — ${Date.now()} — draft`, locationId, userId);
  const takeId = takeEntity.id;

  const resolvedLocationName = (db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(locationId) as { name: string }).name;
  const itemsHere = (getStockListingByLocation().find((g) => g.location === resolvedLocationName)?.rows ?? [])
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

  // Each real line: a real, direct child entity under the Stock Take
  // itself, one per real item, relation_id pointing at that item,
  // its own real name carrying shelf_side/rack/level/expected/counted
  // directly - counted starts genuinely empty (never yet counted).
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

/** Completes a stock take — every counted line's variance (counted vs
 * expected) is a genuine loss or gain, not a silent correction: posts
 * it to the ledger (shortage debits the variance expense, credits
 * inventory; overage is the reverse) and brings item_location's
 * quantity_on_hand into line with what was actually counted. Lines
 * never counted are left untouched — no count means no correction. */
export function completeStockTake(
  stockTakeId: number,
  business: BusinessName,
  ledger: LedgerName,
  varianceExpenseAccount: AccountName,
  /** @deprecated No longer used — each line now resolves its own,
   * real, per-product Inventory account directly, the same, real,
   * structural fix already applied to Purchases and Sales/COGS.
   * Kept only so existing callers (the real, live Stock Take UI, the
   * simulation) don't need a breaking API change to keep working. */
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
    // A real, direct, per-product reference — not one, shared
    // reference for every real, different product's own variance
    // within this stock take. A real, confirmed, pre-existing bug
    // found and fixed here, not assumed away: stageLine's own upsert
    // behavior (matching on reference+account) silently collapsed
    // every real, different product's own line into just the last
    // one whenever more than one product shared the same, real
    // variance expense account within the same stock take, losing
    // every earlier product's own variance entirely — a real,
    // genuine, silent data-loss bug that had never surfaced as a
    // visible error before, since both sides of the entry collided
    // equally (this same account was also shared on the Inventory
    // side, before that side became per-product). Matches the same,
    // established, real per-line-reference pattern already used
    // elsewhere in this codebase (e.g. invoice allocation).
    const reference = `STOCKTAKE-${stockTakeId}-${line.item}`;
    // Positive variance (found more) is a gain: debit inventory,
    // credit the variance account. Negative (shortage) is a loss: the
    // reverse.
    { const inv = ensureProductLocationInventoryAccount(asItemName(line.item), take.location as LocationName, userId); stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), transdate: take.take_date, account: asAccountName(inv.inventoryAccount), accountId: inv.inventoryAccountId, amount_minor: valueMinor, memo: `Stock take variance: ${line.item}` }); }
    stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), transdate: take.take_date, account: asAccountName(varianceExpenseAccount), amount_minor: -valueMinor });

    const currentOnHand = getItemLocation(asItemName(line.item), take.location as LocationName).quantity_on_hand;
    const delta = line.counted_quantity! - currentOnHand;
    if (delta !== 0) {
      // A real, confirmed bug fix: this used to stage only one, real
      // line (the item's own quantity account) with no counter-item
      // at all - genuinely unbalanced, unlike every other real
      // quantity movement in this codebase (receipt uses On Order,
      // dispatch uses Units Sold, transfer uses the same item at the
      // other location - all real, balanced, two-line postings). A
      // physical stock count discovering a real difference is exactly
      // as real an event as those - it gets its own, equally real
      // counter-account (Count Adjustment), not an exemption from
      // the same, correct, established pattern.
      const { countAdjustmentAccount, countAdjustmentAccountId } = ensureProductQuantityAccounts(asItemName(line.item), userId);
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

/** Writes off stock that's been broken, spoiled, expired, or otherwise
 * lost — a genuine dual-effect transaction, not just a quantity
 * adjustment with no accounting consequence: reduces the physical
 * quantity on hand (via postQuantityMovement, same mechanism dispatch
 * and receipt already use) AND posts a real GL entry recognizing the
 * loss (debits the write-off expense, credits inventory for the same
 * value) — unlike a sale, there's no revenue or customer on the other
 * side of this, just a genuine loss. */
export function writeOffStock(
  business: BusinessName,
  ledger: LedgerName,
  reference: string,
  itemName: ItemName,
  quantity: number,
  unitCostMinor: number,
  writeOffExpenseAccount: AccountName,
  /** @deprecated No longer used — resolves to that same, real
   * product's own, real Inventory sub-account directly. Kept only so
   * existing callers don't need a breaking API change. */
  inventoryAccount: string,
  reason: string,
  userId: UserId,
  transdate?: string,
  locationName?: LocationName
): void {
  if (quantity <= 0) throw new ValidationError('Write-off quantity must be positive — it is always a reduction, never a gain.');
  const totalMinor = quantity * unitCostMinor;
  const date = transdate ?? new Date().toISOString().slice(0, 10);

  stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), transdate: date, description: reason, account: asAccountName(writeOffExpenseAccount), amount_minor: totalMinor });
  { const inv = ensureProductInventoryAccount(itemName, userId); stageLine({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), transdate: date, account: asAccountName(inv.inventoryAccount), accountId: inv.inventoryAccountId, amount_minor: -totalMinor }); }
  postJournalEntry(reference, business, ledger, userId);

  // A real, confirmed bug fix, the same class as the stock-take
  // variance fix: this used to post a single, unbalanced quantity
  // line with no counter-item at all, unlike every other real
  // quantity movement in this codebase.
  const { writeOffAccount, writeOffAccountId } = ensureProductQuantityAccounts(itemName, userId);
  stageQuantityMovementLine(business, ledger, `${reference}-QTY`, asAccountName(itemName), -quantity, date);
  stageQuantityMovementLine(business, ledger, `${reference}-QTY`, asAccountName(writeOffAccount), quantity, date, undefined, writeOffAccountId);
  postStagedQuantityMovement(business, ledger, `${reference}-QTY`, userId);

  // A real write-off genuinely happens AT a specific, physical
  // location (a bottle breaks on a specific shelf) - when the caller
  // knows and provides it, the space it occupied is genuinely freed
  // back up, the same real principle as dispatch/transfer.
  if (locationName) adjustLocationCapacity(business, ledger, locationName, itemName, -quantity, date, userId, reference);
}

/** Records a specific batch/lot of a item arriving, with its own
 * expiration date — separate from (but keeping in step with) the
 * item's overall quantity on hand, since postQuantityMovement is
 * still the source of truth for "how much do we have," while this is
 * "which batches, expiring when." */
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

  db.prepare(
    `INSERT INTO stock_lot (item_id, lot_number, received_date, expiration_date, quantity_on_hand, cost_basis_minor)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (item_id, lot_number) DO UPDATE SET
       quantity_on_hand = quantity_on_hand + excluded.quantity_on_hand,
       cost_basis_minor = COALESCE(stock_lot.cost_basis_minor, 0) + COALESCE(excluded.cost_basis_minor, 0)`
  ).run(itemId, lotNumber, receivedDate, expirationDate, quantity, costBasisMinor ?? null);

  postQuantityMovement(business, ledger, reference, asAccountName(itemName), quantity, userId, receivedDate);
}

/** Consumes quantity from a item's lots, oldest-expiring first — the
 * real FIFO-by-expiration convention spoilage management actually
 * needs, not just "reduce the total." Rejects consuming more than
 * what's genuinely on hand across all lots combined, rather than
 * silently going negative. Returns which lots were actually drawn
 * from and how much, for a real audit trail of what specifically was
 * used. */
export function consumeFromLots(itemName: ItemName, quantity: number): { lot_number: string; consumed: number; expiration_date: string | null; cost_basis_minor: number | null }[] {
  if (quantity <= 0) throw new ValidationError('Quantity to consume must be positive.');
  const itemId = resolveItemId(itemName);
  if (!itemId) throw new ValidationError(`No item named "${itemName}".`);

  const lots = db
    .prepare(
      // A real, direct fix, per direct instruction (buying/selling a
      // currency needs the exact, same real FIFO discipline as wine,
      // by real acquisition order, not expiration - since a real
      // currency lot never expires at all): "id ASC" is a real,
      // deterministic tiebreaker among every lot sharing the same
      // (null) expiration_date, so FIFO genuinely means "oldest
      // acquired first," not an unspecified SQLite row order.
      `SELECT id, lot_number, expiration_date, quantity_on_hand, cost_basis_minor FROM stock_lot
       WHERE item_id = ? AND quantity_on_hand > 0
       ORDER BY (expiration_date IS NULL), expiration_date ASC, id ASC`
    )
    .all(itemId) as { id: number; lot_number: string; expiration_date: string | null; quantity_on_hand: number; cost_basis_minor: number | null }[];

  const totalAvailable = lots.reduce((s, l) => s + l.quantity_on_hand, 0);
  if (quantity > totalAvailable) {
    throw new ValidationError(`Only ${totalAvailable} of "${itemName}" available across all lots — cannot consume ${quantity}.`);
  }

  const consumed: { lot_number: string; consumed: number; expiration_date: string | null; cost_basis_minor: number | null }[] = [];
  let remaining = quantity;
  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, lot.quantity_on_hand);
    // Per direct instruction: the exact, proportional share of this
    // lot's own, real, actual cost basis that's leaving with it - the
    // one, real number a genuine FIFO gain/loss calculation needs.
    // Rounds to the nearest whole minor unit; the lot's own remaining
    // cost_basis_minor is reduced by the exact same amount, so
    // repeated partial consumption never drifts the total.
    const costBasisTaken = lot.cost_basis_minor != null ? Math.round((lot.cost_basis_minor * take) / lot.quantity_on_hand) : null;
    db.prepare(`UPDATE stock_lot SET quantity_on_hand = quantity_on_hand - ?, cost_basis_minor = ? WHERE id = ?`).run(
      take,
      costBasisTaken != null ? lot.cost_basis_minor! - costBasisTaken : lot.cost_basis_minor,
      lot.id
    );
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

/** Lots expiring within the given window (or already expired, which
 * show a negative days_until_expiration) — lots with no expiration
 * date at all are never included, since there's nothing to warn about. */
export function getExpiringStock(asOfDate: string, withinDays: number): ExpiringLot[] {
  const rows = db
    .prepare(
      `SELECT e.name AS item, sl.lot_number, sl.expiration_date, sl.quantity_on_hand,
              CAST(julianday(sl.expiration_date) - julianday(?) AS INTEGER) AS days_until_expiration
       FROM stock_lot sl
       JOIN current_entities e ON e.id = sl.item_id
       WHERE sl.expiration_date IS NOT NULL
         AND sl.quantity_on_hand > 0
         AND julianday(sl.expiration_date) - julianday(?) <= ?`
    )
    .all(asOfDate, asOfDate, withinDays) as ExpiringLot[];
  return rows.sort((a, b) => a.days_until_expiration - b.days_until_expiration);
}

/** Places a new order — creates its Qty/Value entities under Orders
 * (parented by name so multiple orders don't collide) and posts the
 * committed quantity and value to them. Purely informational: nothing
 * here touches a real account. */
/** A real, lightweight entity for internal, system bookkeeping (an
 * order's own Qty/Value tracking entities, a bootstrap category) —
 * bypasses the normal entity_entry audit-trail machinery since these
 * are never edited or renamed later, only created once. Shared by
 * both this file's own code (placeOrder) and the real, one-time
 * migrations in db-migration.ts. */
export function createSystemEntity(name: string, parentId: number | null): number {
  const info = db.prepare(`INSERT INTO entity_ids (id) VALUES (NULL)`).run();
  const entityId = Number(info.lastInsertRowid);
  db.prepare(`INSERT INTO entities (entity_id, name, parent_id, created_at, created_by) VALUES (?, ?, ?, datetime('now'), 1)`).run(
    entityId,
    name,
    parentId
  );
  return entityId;
}

export function placeOrder(
  orderReference: string,
  business: BusinessName,
  ledger: LedgerName,
  quantity: number,
  priceMinor: number,
  userId: UserId,
  transdate?: string,
  vendor?: VendorName,
  item?: ItemName,
  location?: LocationName
): void {
  const qtyName = `${orderReference} Qty`;
  const valueName = `${orderReference} Value`;
  const ordersId = (db.prepare(`SELECT id FROM current_entities WHERE name = 'Orders'`).get() as { id: number }).id;
  for (const name of [qtyName, valueName]) {
    const existing = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(name);
    if (!existing) createSystemEntity(name, ordersId);
  }
  // No new table, no new column — the mantra is no extra tables. This
  // order already has two real entities (Qty, Value), each with one
  // real, existing relation slot already provided by every entity in
  // this app. Real, existing capacity, reused directly: Qty's own
  // relation carries the real vendor, Value's own relation carries
  // the real item — exactly the same "relation is a separate, lateral
  // tag" mechanism this app already uses for COGS and CoA family
  // tagging, not a new mechanism invented for this one case.
  if (vendor) updateEntity((db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(qtyName) as { id: number }).id, { relation: vendor }, userId);
  if (item) updateEntity((db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(valueName) as { id: number }).id, { relation: item }, userId);
  // Real, direct delivery/dispatch instructions — a PO's own real
  // "where should this arrive" or a SO's own real "where should this
  // ship from" — recorded via the exact, same, existing, generic
  // Location dimension mechanism already used for a real posted
  // Sales/COGS leaf, not a new, separate mechanism. Set on the Qty
  // leaf (relation is already taken by vendor/item on the two real
  // leaves respectively; a dimension is a real, separate, independent
  // slot from relation).
  if (location) setDimensionParent(qtyName, 'Location', location, userId);
  postQuantityMovement(business, ledger, `${orderReference}-PLACE`, asAccountName(qtyName), quantity, userId, transdate);
  postQuantityMovement(business, ledger, `${orderReference}-PLACE-VALUE`, asAccountName(valueName), priceMinor, userId, transdate);
  // A real, named product's own real "on order" quantity — the
  // genuine double-entry counteritem credited later, at real receipt
  // (see receiveStockAtLocation). A new, real commitment being
  // recorded here, not a transfer between two existing pools, so this
  // one, single-sided line is correct — the offsetting credit happens
  // at the real, later moment the stock actually arrives.
  if (item) {
    const { onOrderAccount, onOrderAccountId } = ensureProductQuantityAccounts(item, userId);
    postQuantityMovement(business, ledger, `${orderReference}-PLACE-ONORDER`, asAccountName(onOrderAccount), quantity, userId, transdate, undefined, onOrderAccountId);
  }
}

/** Fulfills (all or item of) an order — reduces its Qty/Value memo
 * balances by exactly the quantity/value actually fulfilled. Whatever
 * remains on those two accounts afterward IS the back order — read
 * directly, never stored as a separate fact. */
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
  // fulfillingReference (the actual receipt/dispatch that's doing the
  // fulfilling) makes these genuinely unique per call — a real, found
  // bug: the old `${orderReference}-FULFILL` naming assumed exactly one
  // fulfillment per order, but partial fulfillment (a genuine back
  // order, closed over several separate receipts) is explicitly
  // something this system supports. Reusing the same reference on a
  // second partial fulfillment silently corrupted journal_line — see
  // the journal_reference_unique index and its comment for the full
  // story of how that surfaced.
  postQuantityMovement(business, ledger, `${orderReference}-FULFILL-${fulfillingReference}`, asAccountName(`${orderReference} Qty`), -quantityFulfilled, userId, transdate);
  postQuantityMovement(business, ledger, `${orderReference}-FULFILL-${fulfillingReference}-VALUE`, asAccountName(`${orderReference} Value`), -valueFulfilledMinor, userId, transdate);
}

/** The remaining committed quantity/value on an order — zero means
 * fully fulfilled; anything else is the open back order. */
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

// ---------------------------------------------------------------------------
