// Converted from routes/locations.ts (and its four sibling routers —
// belowReorderRouter/stockOutRiskRouter/stockListingRouter/
// stockTakesRouter — all mounted behind their own blanket requireAuth,
// same as locationsRouter itself; see server.ts). The largest single
// file in this rollout (40 endpoints). Every mutating endpoint that used
// requireRole('Administrator', 'Bookkeeper') in the old route keeps that
// exact gate here; every endpoint that had no requireRole still needs
// requireAuth, since the OLD gate was the router's own blanket
// app.use(..., requireAuth, ...), not "public".
import {
  getLocation,
  setLocation,
  stageLocation,
  postLocation,
  deleteLocation,
  getLocationTypes,
  createLocationType,
  convertStorageSpace,
  openStorageContainer,
  resolveOpenContainerAccounts,
  resolveReceiveAccounts,
  resolveTransferAccounts,
  getItemLocation,
  setItemLocationLevels,
  receiveItems,
  receiveStockPhysical,
  dispatchItems,
  transferItems,
  transferStock,
  getRestockPickingList,
  confirmRestockPickedLine,
  dispatchRestockFromPickingList,
  setLocationOpenHours,
  getLocationOpenHours,
  setEmployeeSchedule,
  getEmployeeSchedule,
  getScheduleAtLocation,
  getBelowReorderStock,
  getStockOutRiskReport,
  setItemSourceLeadTime,
  getInventoryListing,
  getInventoryListingByLocation,
  getStorageSpaceReport,
  getStockMovementReport,
  countInventoryListing,
  createStockTake,
  getStockTake,
  recordStockTakeCount,
  completeStockTake,
  nominateLocationCurrency,
  getLocationCurrencies,
  getEntityTree,
  resolveBusinessLocationsRootId,
  ValidationError,
  NotFoundError,
  asBusinessName,
  asLedgerName,
  asAccountName,
  asItemName,
  asLocationName,
  asProviderName,
  asUserId,
} from '../db.js';
import { CallError, encodeStringList, decodeStringList, decodeShape, encodeRecordList, decodeRecordList, requireAuth, requireRole, row, table, type BackendCall } from '../call-dispatch.js';

export const locationsFunctions: Record<string, BackendCall> = {
  // GET / — business query param is required (locations are scoped per
  // business); same resolveBusinessLocationsRootId legacy-root fallback
  // the old route used directly.
  listLocations: (v, user) => {
    requireAuth(user);
    const [business] = v;
    if (!business) throw new CallError(400, 'business is required — locations are scoped per business.');
    const entities = getEntityTree();
    const locationsParentId = resolveBusinessLocationsRootId(business);
    const locationEntities = locationsParentId ? entities.filter((e) => e.parent_id === locationsParentId) : [];
    return table(
      ['name', 'city', 'location_type', 'is_billing_address', 'bottle_capacity', 'carton_capacity', 'timezone'],
      locationEntities.map((e) => {
        const loc = getLocation(e.name)!;
        return {
          name: e.name,
          city: loc.city,
          location_type: loc.location_type,
          is_billing_address: String(loc.is_billing_address),
          bottle_capacity: loc.bottle_capacity,
          carton_capacity: loc.carton_capacity,
          timezone: loc.timezone,
        };
      })
    );
  },

  getLocationTypes: (_v, user) => {
    requireAuth(user);
    return table(['name'], getLocationTypes().map((name) => ({ name })));
  },

  createLocationType: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [name] = v;
    if (!name) throw new CallError(400, 'name is required.');
    try {
      createLocationType(name, asUserId(user!.id));
      return row(name);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not create location type.');
    }
  },

  convertStorageSpace: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, ledger, itemName, definitionDimensionsEncoded, fromValuesEncoded, toValuesEncoded, quantity, reference] = v;
    try {
      convertStorageSpace(
        asBusinessName(business),
        asLedgerName(ledger),
        asItemName(itemName),
        decodeShape(definitionDimensionsEncoded) ?? [],
        decodeStringList(fromValuesEncoded),
        decodeStringList(toValuesEncoded),
        Number(quantity),
        asUserId(user!.id),
        reference || undefined
      );
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not convert storage.');
    }
  },

  openStorageContainer: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, ledger, location, item, definitionDimensionsEncoded, containerValuesEncoded, cartonsOpened, unitValuesEncoded, unitsProduced, reference] = v;
    try {
      openStorageContainer(
        asBusinessName(business),
        asLedgerName(ledger),
        asLocationName(location),
        asItemName(item),
        decodeShape(definitionDimensionsEncoded) ?? [],
        decodeStringList(containerValuesEncoded),
        Number(cartonsOpened),
        decodeStringList(unitValuesEncoded),
        Number(unitsProduced),
        asUserId(user!.id),
        reference || undefined
      );
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not open container.');
    }
  },

  resolveOpenContainerAccounts: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, location, item, definitionDimensionsEncoded, containerValuesEncoded, unitValuesEncoded] = v;
    try {
      const result = resolveOpenContainerAccounts(
        asBusinessName(business),
        asLocationName(location),
        asItemName(item),
        decodeShape(definitionDimensionsEncoded) ?? [],
        decodeStringList(containerValuesEncoded),
        decodeStringList(unitValuesEncoded),
        asUserId(user!.id)
      );
      return row(
        result.containerSpaceAccount,
        result.containerOccupiedAccount,
        result.unitSpaceAccount,
        result.unitOccupiedAccount,
        String(result.containerSpaceAccountId),
        String(result.containerOccupiedAccountId),
        String(result.unitSpaceAccountId),
        String(result.unitOccupiedAccountId),
        result.inventoryFromAccount,
        result.inventoryToAccount,
        String(result.inventoryFromAccountId),
        String(result.inventoryToAccountId),
        result.unitCostMinor
      );
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      console.error(err);
      throw new CallError(500, 'Could not resolve accounts.');
    }
  },

  resolveReceiveAccounts: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, itemName, combinationValuesEncoded, combinationShapeEncoded] = v;
    try {
      const result = resolveReceiveAccounts(asBusinessName(business), asItemName(itemName), decodeShape(combinationShapeEncoded), decodeStringList(combinationValuesEncoded), asUserId(user!.id));
      if (!result) return row('0', '', '', '');
      return row('1', result.inventoryAccount, result.payableAccount, result.unitCostMinor);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      console.error(err);
      throw new CallError(500, 'Could not resolve accounts.');
    }
  },

  transferItems: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, ledger, itemName, fromLocationName, toLocationName, quantity, reference, transdate] = v;
    try {
      transferItems(asBusinessName(business), asLedgerName(ledger), asItemName(itemName), asLocationName(fromLocationName), asLocationName(toLocationName), Number(quantity), reference, asUserId(user!.id), transdate || undefined);
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not transfer stock.');
    }
  },

  transferStock: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, ledger, itemName, fromLocationName, toLocationName, quantity, reference, transdate] = v;
    try {
      transferStock(
        {
          business: asBusinessName(business),
          ledger: asLedgerName(ledger),
          itemName: asItemName(itemName),
          fromLocationName: asLocationName(fromLocationName),
          toLocationName: asLocationName(toLocationName),
          quantity: Number(quantity),
          reference,
          transdate: transdate || undefined,
        },
        asUserId(user!.id)
      );
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not transfer stock.');
    }
  },

  resolveTransferAccounts: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, itemName, fromLocationName, toLocationName] = v;
    try {
      const result = resolveTransferAccounts(asBusinessName(business), asItemName(itemName), asLocationName(fromLocationName), asLocationName(toLocationName), asUserId(user!.id));
      return row(result.fromInventoryAccount, result.toInventoryAccount, result.unitCostMinor);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      console.error(err);
      throw new CallError(500, 'Could not resolve accounts.');
    }
  },

  // GET /:name — deliberately unscoped by business, matching the old
  // route exactly (never fixed the way PUT /:name was — see the long
  // comment on that route in routes/locations.ts).
  getLocationByName: (v, user) => {
    requireAuth(user);
    const [name] = v;
    const location = getLocation(name);
    if (!location) throw new CallError(404, 'No such location.');
    return row(name, location.city, location.location_type, String(location.is_billing_address), location.bottle_capacity, location.carton_capacity, location.timezone);
  },

  createLocation: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    // is_billing_address is intentionally not forwarded to stageLocation —
    // matches the old route exactly: LocationStagingInput never carried
    // that field, so POST /:name silently dropped it too, even though its
    // own request schema accepted it.
    const [name, business, city, locationType, _isBillingAddress, bottleCapacity, cartonCapacity, timezone] = v;
    if (!business) throw new CallError(400, 'business is required.');
    try {
      const reference = `LOC-${name}-${Date.now()}`;
      stageLocation({
        reference,
        business: asBusinessName(business),
        location_name: name,
        city,
        location_type: locationType,
        bottle_capacity: bottleCapacity === '' ? null : Number(bottleCapacity),
        carton_capacity: cartonCapacity === '' ? null : Number(cartonCapacity),
        timezone,
      });
      postLocation(reference, asBusinessName(business), asUserId(user!.id));
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not create location.');
    }
  },

  // PUT /:name — business IS required here (the real, confirmed bug fix
  // documented on this route in routes/locations.ts: a bare, business-less
  // lookup can land on a same-named GL "Storage" node instead of the real
  // location once any storage-combination action has touched it).
  saveLocation: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [name, business, city, locationType, isBillingAddress, bottleCapacity, cartonCapacity, timezone] = v;
    if (!business) throw new CallError(400, 'business is required.');
    try {
      setLocation(
        name,
        {
          city,
          location_type: locationType,
          is_billing_address: isBillingAddress === 'true',
          bottle_capacity: bottleCapacity === '' ? null : Number(bottleCapacity),
          carton_capacity: cartonCapacity === '' ? null : Number(cartonCapacity),
          timezone,
        },
        asBusinessName(business)
      );
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not save location.');
    }
  },

  deleteLocation: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [name, business] = v;
    if (!business) throw new CallError(400, 'business is required.');
    try {
      deleteLocation(asBusinessName(business), name, asUserId(user!.id));
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      console.error(err);
      throw new CallError(500, 'Could not delete location.');
    }
  },

  getLocationCurrencies: (v, user) => {
    requireAuth(user);
    const [locationName, business] = v;
    return row(encodeStringList(getLocationCurrencies(locationName, business ? asBusinessName(business) : undefined)));
  },

  nominateLocationCurrency: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [locationName, currencyCode, business] = v;
    if (!currencyCode) throw new CallError(400, 'currencyCode is required.');
    try {
      nominateLocationCurrency(locationName, currencyCode, asUserId(user!.id), business ? asBusinessName(business) : undefined);
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not nominate that currency.');
    }
  },

  getItemLocation: (v, user) => {
    requireAuth(user);
    const [itemName, locationName] = v;
    const levels = getItemLocation(asItemName(itemName), asLocationName(locationName));
    return row(String(levels.quantity_on_hand), levels.min_level, levels.max_level, levels.reorder_level, levels.shelf_side, levels.rack, levels.level);
  },

  setItemLocationLevels: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [itemName, locationName, minLevel, maxLevel, reorderLevel, shelfSide, rack, level, business, ledger] = v;
    if (!business) throw new CallError(400, 'business is required.');
    try {
      setItemLocationLevels(
        asItemName(itemName),
        asLocationName(locationName),
        {
          minLevel: minLevel === '' ? null : Number(minLevel),
          maxLevel: maxLevel === '' ? null : Number(maxLevel),
          reorderLevel: reorderLevel === '' ? null : Number(reorderLevel),
          shelfSide: shelfSide || null,
          rack: rack || null,
          level: level === '' ? null : Number(level),
        },
        asBusinessName(business),
        asLedgerName(ledger || 'Actual'),
        asUserId(user!.id)
      );
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not save levels.');
    }
  },

  receiveItems: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [locationName, business, ledger, reference, itemName, quantity, transdate, combinationValuesEncoded, combinationShapeEncoded] = v;
    try {
      receiveItems(
        asBusinessName(business),
        asLedgerName(ledger),
        reference,
        asItemName(itemName),
        asLocationName(locationName),
        Number(quantity),
        asUserId(user!.id),
        transdate || undefined,
        combinationValuesEncoded ? decodeStringList(combinationValuesEncoded) : undefined,
        combinationShapeEncoded ? decodeShape(combinationShapeEncoded) : undefined
      );
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not receive stock.');
    }
  },

  receiveIntoStorageStock: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [locationName, business, ledger, reference, itemName, quantity, transdate, combinationValuesEncoded, combinationShapeEncoded] = v;
    try {
      receiveStockPhysical(
        {
          business: asBusinessName(business),
          ledger: asLedgerName(ledger),
          reference,
          itemName: asItemName(itemName),
          locationName: asLocationName(locationName),
          quantity: Number(quantity),
          transdate: transdate || undefined,
          combinationValues: combinationValuesEncoded ? decodeStringList(combinationValuesEncoded) : undefined,
          combinationShape: combinationShapeEncoded ? decodeShape(combinationShapeEncoded) : undefined,
        },
        asUserId(user!.id)
      );
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not receive stock.');
    }
  },

  // No live frontend caller anywhere (grep-confirmed, already commented
  // out in api.ts) — built anyway for a complete backend surface. The old
  // route never forwarded combinationValues/combinationShape to
  // dispatchItems even though movementSchema allows them — matched
  // exactly, not "fixed."
  dispatchItems: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [locationName, business, ledger, reference, itemName, quantity, transdate] = v;
    try {
      dispatchItems(asBusinessName(business), asLedgerName(ledger), reference, asItemName(itemName), asLocationName(locationName), Number(quantity), asUserId(user!.id), transdate || undefined);
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not dispatch stock.');
    }
  },

  // lines: the request-side lineItems protocol (item, quantity pairs).
  getRestockPickingList: (v, user, lineItems) => {
    requireAuth(user);
    const [runReference, warehouseName] = v;
    if (!warehouseName) throw new CallError(400, 'warehouseName and lines are required.');
    const lines = lineItems.map((l) => ({ item: l[0], quantity: Number(l[1]) }));
    try {
      const result = getRestockPickingList(runReference, asLocationName(warehouseName), lines);
      return table(
        ['invoiceLineId', 'item', 'quantity', 'shelfSide', 'rack', 'level', 'picked'],
        result.map((l) => ({ invoiceLineId: String(l.invoiceLineId), item: l.item, quantity: String(l.quantity), shelfSide: l.shelfSide, rack: l.rack, level: l.level, picked: String(l.picked) }))
      );
    } catch (err) {
      // Matches the old route's own bare catch-all exactly — no
      // instanceof check at all there.
      console.error(err);
      throw new CallError(500, 'Could not load the real restocking picking list.');
    }
  },

  confirmRestockPickedLine: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [runReference, item, business, ledger] = v;
    try {
      confirmRestockPickedLine(runReference, item, asBusinessName(business), asLedgerName(ledger), asUserId(user!.id));
      return row();
    } catch (err) {
      // Matches the old route's own bare catch-all exactly.
      console.error(err);
      throw new CallError(500, 'Could not confirm this line as picked.');
    }
  },

  // lines: the request-side lineItems protocol (item, quantity pairs).
  dispatchRestockRun: (v, user, lineItems) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [runReference, business, ledger, warehouseName, retailOutletName, transdate] = v;
    const lines = lineItems.map((l) => ({ item: l[0], quantity: Number(l[1]) }));
    try {
      dispatchRestockFromPickingList(runReference, asBusinessName(business), asLedgerName(ledger), asLocationName(warehouseName), asLocationName(retailOutletName), lines, asUserId(user!.id), transdate || undefined);
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not dispatch this restocking run.');
    }
  },

  // hours: the request-side lineItems protocol (day, opens_at, closes_at triples).
  setLocationOpenHours: (v, user, lineItems) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [locationName] = v;
    const hours = lineItems.map((l) => ({ day: l[0], opens_at: l[1], closes_at: l[2] }));
    try {
      setLocationOpenHours(locationName, hours);
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not set open hours.');
    }
  },

  getLocationOpenHours: (v, user) => {
    requireAuth(user);
    const [locationName] = v;
    return table(['day', 'opens_at', 'closes_at'], getLocationOpenHours(locationName));
  },

  // No live frontend caller anywhere (grep-confirmed, already commented
  // out in api.ts) — built anyway for a complete backend surface.
  getScheduleAtLocation: (v, user) => {
    requireAuth(user);
    const [locationName] = v;
    return table(
      ['employee', 'day', 'starts_at', 'ends_at'],
      getScheduleAtLocation(locationName)
    );
  },

  // schedule: the request-side lineItems protocol (day, starts_at, ends_at triples).
  setEmployeeSchedule: (v, user, lineItems) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [employeeName, locationName] = v;
    const schedule = lineItems.map((l) => ({ day: l[0], starts_at: l[1], ends_at: l[2] }));
    try {
      setEmployeeSchedule(employeeName, locationName, schedule);
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, "Could not set this employee's schedule.");
    }
  },

  getEmployeeSchedule: (v, user) => {
    requireAuth(user);
    const [employeeName] = v;
    return table(['location', 'day', 'starts_at', 'ends_at'], getEmployeeSchedule(employeeName));
  },

  getBelowReorderStock: (_v, user) => {
    requireAuth(user);
    return table(['item', 'location', 'quantity_on_hand', 'reorder_level', 'min_level', 'max_level'], getBelowReorderStock());
  },

  getStockOutRiskReport: (v, user) => {
    requireAuth(user);
    const [windowDays] = v;
    return table(['item', 'location', 'quantity_on_hand', 'daily_consumption_rate', 'days_until_stockout', 'shortest_lead_time_days', 'at_risk'], getStockOutRiskReport(windowDays ? Number(windowDays) : 2));
  },

  // No live frontend caller anywhere (grep-confirmed, already commented
  // out in api.ts) — built anyway for a complete backend surface.
  setItemSourceLeadTime: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [item, vendor, days] = v;
    try {
      setItemSourceLeadTime(asItemName(item), asProviderName(vendor), Number(days), asUserId(user!.id));
      return row();
    } catch (err) {
      // Matches the old route's own bare catch-all exactly.
      console.error(err);
      throw new CallError(500, 'Could not save this lead time.');
    }
  },

  // No live frontend caller anywhere (grep-confirmed, already commented
  // out in api.ts) — built anyway for a complete backend surface.
  getInventoryListing: (v, user) => {
    requireAuth(user);
    const [limit, offset] = v;
    const rows = getInventoryListing(limit ? Number(limit) : 100, offset ? Number(offset) : 0);
    return row(String(countInventoryListing()), encodeRecordList(['item', 'location', 'quantity_on_hand', 'min_level', 'max_level', 'reorder_level'], rows));
  },

  getInventoryListingByLocation: (v, user) => {
    requireAuth(user);
    const [business, hierarchyName] = v;
    if (!business) throw new CallError(400, 'business is required.');
    const groups = getInventoryListingByLocation(asBusinessName(business), hierarchyName || undefined);
    type FlatRow = {
      location: string;
      city: string;
      group: string;
      item: string;
      quantity_on_hand: string;
      min_level: string;
      max_level: string;
      reorder_level: string;
      total_on_hand: string;
      bottleQuantity: string;
      bottleCapacity: string;
      bottleOverCapacity: string;
      cartonQuantity: string;
      cartonCapacity: string;
      cartonOverCapacity: string;
    };
    const flat: FlatRow[] = [];
    for (const g of groups) {
      const base = {
        location: g.location,
        city: g.city ?? '',
        group: g.group ?? '',
        total_on_hand: String(g.total_on_hand),
        bottleQuantity: String(g.capacity.bottleQuantity),
        bottleCapacity: g.capacity.bottleCapacity == null ? '' : String(g.capacity.bottleCapacity),
        bottleOverCapacity: String(g.capacity.bottleOverCapacity),
        cartonQuantity: String(g.capacity.cartonQuantity),
        cartonCapacity: g.capacity.cartonCapacity == null ? '' : String(g.capacity.cartonCapacity),
        cartonOverCapacity: String(g.capacity.cartonOverCapacity),
      };
      if (g.rows.length === 0) {
        flat.push({ ...base, item: '', quantity_on_hand: '', min_level: '', max_level: '', reorder_level: '' });
      } else {
        for (const r of g.rows) {
          flat.push({
            ...base,
            item: r.item,
            quantity_on_hand: String(r.quantity_on_hand),
            min_level: r.min_level == null ? '' : String(r.min_level),
            max_level: r.max_level == null ? '' : String(r.max_level),
            reorder_level: r.reorder_level == null ? '' : String(r.reorder_level),
          });
        }
      }
    }
    return table(
      ['location', 'city', 'group', 'item', 'quantity_on_hand', 'min_level', 'max_level', 'reorder_level', 'total_on_hand', 'bottleQuantity', 'bottleCapacity', 'bottleOverCapacity', 'cartonQuantity', 'cartonCapacity', 'cartonOverCapacity'],
      flat
    );
  },

  getStorageSpaceReport: (_v, user) => {
    requireAuth(user);
    const groups = getStorageSpaceReport();
    type FlatRow = { location: string; currency: string; installed_minor: string; occupied_minor: string; remaining_minor: string; balanced: string };
    const flat: FlatRow[] = [];
    for (const g of groups) {
      if (g.currencies.length === 0) {
        flat.push({ location: g.location, currency: '', installed_minor: '', occupied_minor: '', remaining_minor: '', balanced: '' });
      } else {
        for (const c of g.currencies) {
          flat.push({ location: g.location, currency: c.currency, installed_minor: String(c.installed_minor), occupied_minor: String(c.occupied_minor), remaining_minor: String(c.remaining_minor), balanced: String(c.balanced) });
        }
      }
    }
    return table(['location', 'currency', 'installed_minor', 'occupied_minor', 'remaining_minor', 'balanced'], flat);
  },

  // receipts/transfers/sales: three separate, unrelated arrays in one
  // result — same shape class as journal.ts's previewCloseBooks — each
  // encoded via encodeRecordList rather than forced into one table.
  getStockMovementReport: (v, user) => {
    requireAuth(user);
    const [business, ledger, fromDate, toDate, hierarchyName] = v;
    if (!business) throw new CallError(400, 'business is required.');
    if (!ledger) throw new CallError(400, 'ledger is required.');
    try {
      const report = getStockMovementReport(business, ledger, fromDate || undefined, toDate || undefined, hierarchyName || undefined);
      return row(
        encodeRecordList(['item', 'category', 'quantity', 'date', 'location', 'group', 'vendor'], report.receipts.map((r) => ({ ...r, category: r.category ?? '', group: r.group ?? '', vendor: r.vendor ?? '' }))),
        encodeRecordList(['item', 'category', 'quantity', 'date', 'from_location', 'to_location'], report.transfers.map((r) => ({ ...r, category: r.category ?? '' }))),
        encodeRecordList(['item', 'category', 'quantity', 'date', 'location', 'group', 'vendor', 'amount_minor'], report.sales.map((r) => ({ ...r, category: r.category ?? '', group: r.group ?? '', vendor: r.vendor ?? '' })))
      );
    } catch (err) {
      // Matches the old route's own exact, narrower gate: ValidationError
      // maps to 404 here, not the usual 409.
      if (err instanceof ValidationError) throw new CallError(404, err.message);
      console.error(err);
      throw new CallError(500, 'Could not load the stock movement report.');
    }
  },

  createStockTake: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [locationName, takeDate, business] = v;
    if (!locationName || !takeDate) throw new CallError(400, 'locationName and takeDate are both required.');
    try {
      const id = createStockTake(asLocationName(locationName), takeDate, asUserId(user!.id), business ? asBusinessName(business) : undefined);
      return row(String(id));
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not create stock take.');
    }
  },

  getStockTake: (v, user) => {
    requireAuth(user);
    const [id] = v;
    const take = getStockTake(Number(id));
    if (!take) throw new CallError(404, 'No such stock take.');
    return row(String(take.id), take.location, take.take_date, take.status, encodeRecordList(['id', 'item', 'shelf_side', 'rack', 'level', 'expected_quantity', 'counted_quantity'], take.lines));
  },

  recordStockTakeCount: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [id, itemName, countedQuantity] = v;
    if (!itemName || countedQuantity === undefined) throw new CallError(400, 'itemName and countedQuantity are both required.');
    try {
      recordStockTakeCount(Number(id), asItemName(itemName), Number(countedQuantity));
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not record count.');
    }
  },

  completeStockTake: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [id, business, ledger, varianceExpenseAccount, inventoryAccount, unitCostMinorByItemEncoded] = v;
    const unitCostMinorByItem = Object.fromEntries(decodeRecordList(['key', 'value'], unitCostMinorByItemEncoded).map((r) => [r.key, Number(r.value)]));
    try {
      completeStockTake(Number(id), asBusinessName(business), asLedgerName(ledger), asAccountName(varianceExpenseAccount), inventoryAccount, unitCostMinorByItem, asUserId(user!.id));
      return row();
    } catch (err) {
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not complete stock take.');
    }
  },
};
