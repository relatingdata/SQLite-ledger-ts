// Converted from routes/items.ts. Mounted (old route) with requireAuth for
// the whole router; PUT/POST/DELETE further require Administrator or
// Bookkeeper, replicated per-function here exactly as the old route did it.
import {
  listItems,
  countItems,
  getItem,
  setItem,
  setItemStorageOrigin,
  getItemStorageOrigin,
  listItemSources,
  addOrUpdateItemSource,
  deleteItemSource,
  stageBomComponent,
  postBomComponents,
  getBomComponents,
  deleteBomComponent,
  ValidationError,
  NotFoundError,
  asUserId,
  asItemName,
  asBusinessName,
} from '../db.js';
import { CallError, requireAuth, requireRole, row, table, type BackendCall } from '../call-dispatch.js';

interface ItemSummaryRow {
  name: string;
  description: string;
  unit_of_measure: string;
  upc: string;
  retail_price_minor: string;
  source_count: string;
  storage_origin: string;
  product: string;
  totalCount: string;
}
const ITEM_SUMMARY_HEADER: (keyof ItemSummaryRow)[] = ['name', 'description', 'unit_of_measure', 'upc', 'retail_price_minor', 'source_count', 'storage_origin', 'product', 'totalCount'];

export const itemsFunctions: Record<string, BackendCall> = {
  // Positional args: [0] business, [1] limit, [2] offset. The real result
  // (rows + a separate totalCount) is denormalized onto every row (see
  // matrix-reports.ts's own precedent) with one sentinel row (name='',
  // a real item's name is never empty) carrying totalCount when there
  // are zero real rows to denormalize onto.
  listItems: (v, user) => {
    requireAuth(user);
    const [business, limitRaw, offsetRaw] = v;
    if (!business) throw new CallError(400, 'business is required.');
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const offset = offsetRaw ? Number(offsetRaw) : 0;
    const rows = listItems(asBusinessName(business), limit, offset);
    const totalCount = String(countItems(asBusinessName(business)));
    if (rows.length === 0) {
      return table(ITEM_SUMMARY_HEADER, [{ name: '', description: '', unit_of_measure: '', upc: '', retail_price_minor: '', source_count: '0', storage_origin: '', product: '', totalCount }]);
    }
    return table<ItemSummaryRow>(
      ITEM_SUMMARY_HEADER,
      rows.map((r) => ({
        name: r.name,
        description: r.description ?? '',
        unit_of_measure: r.unit_of_measure ?? '',
        upc: r.upc ?? '',
        retail_price_minor: r.retail_price_minor === null ? '' : String(r.retail_price_minor),
        source_count: String(r.source_count),
        storage_origin: r.storage_origin ?? '',
        product: r.product ?? '',
        totalCount,
      }))
    );
  },
  // Positional args: [0] name. Row: [0] exists ('1'/'0'), [1] description,
  // [2] unit_of_measure, [3] upc, [4] retail_price_minor.
  getItem: (v, user) => {
    requireAuth(user);
    const [name] = v;
    if (!name) throw new CallError(400, 'name is required.');
    const item = getItem(name);
    if (!item) return row('0', '', '', '', '');
    return row('1', item.description, item.unit_of_measure, item.upc, item.retail_price_minor);
  },
  // Positional args: [0] name, [1] description, [2] unit_of_measure, [3] upc.
  setItem: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [name, description, unit_of_measure, upc] = v;
    if (!name) throw new CallError(400, 'name is required.');
    setItem(name, { description: description || null, unit_of_measure: unit_of_measure || null, upc: upc || null });
    return row();
  },
  // Positional args: [0] itemName.
  listItemSources: (v, user) => {
    requireAuth(user);
    const [itemName] = v;
    if (!itemName) throw new CallError(400, 'itemName is required.');
    const sources = listItemSources(itemName);
    return table(
      ['id', 'item_id', 'item_name', 'manufacturer_id', 'manufacturer_name', 'vendor_id', 'vendor_name', 'vendor_sku', 'vendor_upc', 'price_minor', 'currency', 'package_quantity', 'is_preferred', 'preference_notes'],
      sources
    );
  },
  // Positional args: [0] itemName, [1] manufacturerName, [2] vendorName,
  // [3] vendorSku, [4] vendorUpc, [5] priceMinor, [6] currency,
  // [7] packageQuantity, [8] isPreferred ('true'/''), [9] preferenceNotes.
  addOrUpdateItemSource: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [itemName, manufacturerName, vendorName, vendorSku, vendorUpc, priceMinorRaw, currency, packageQuantityRaw, isPreferredRaw, preferenceNotes] = v;
    if (!itemName || !vendorName) throw new CallError(400, 'itemName and vendorName are required.');
    try {
      addOrUpdateItemSource({
        itemName,
        manufacturerName: manufacturerName || null,
        vendorName,
        vendorSku: vendorSku || null,
        vendorUpc: vendorUpc || null,
        priceMinor: priceMinorRaw ? Number(priceMinorRaw) : null,
        currency: currency || null,
        packageQuantity: packageQuantityRaw ? Number(packageQuantityRaw) : null,
        isPreferred: isPreferredRaw === 'true',
        preferenceNotes: preferenceNotes || null,
      });
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] id.
  deleteItemSource: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [idRaw] = v;
    if (!idRaw) throw new CallError(400, 'id is required.');
    try {
      deleteItemSource(Number(idRaw));
      return row();
    } catch (err) {
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      throw err;
    }
  },
  // Positional args: [0] itemName.
  getBomComponents: (v, user) => {
    requireAuth(user);
    const [itemName] = v;
    if (!itemName) throw new CallError(400, 'itemName is required.');
    return table(
      ['component', 'quantity', 'unit', 'kind', 'durationHours', 'scheduledStart', 'scheduledEnd', 'priceMinor'],
      getBomComponents(itemName).map((l) => ({ ...l, durationHours: l.durationHours ?? '', scheduledStart: l.scheduledStart ?? '', scheduledEnd: l.scheduledEnd ?? '', priceMinor: l.priceMinor ?? '' }))
    );
  },
  // Positional args: [0] itemName, [1] business, [2] componentItem,
  // [3] quantity, [4] unit, [5] kind? ('Material' default — every
  // pre-existing caller omits this and is unaffected), [6] durationHours?,
  // [7] scheduledStart?, [8] scheduledEnd? (Labour/Plant Recipe lines
  // only), [9] priceMinor? (Stage-4 widening — a Recipe/Project Proposal
  // line's quoted/costed price). Stages then immediately posts, same
  // two-step real sequence as the old route handler, then returns the
  // full, updated component list.
  setBomComponent: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [itemName, business, componentItem, quantityRaw, unit, kindRaw, durationRaw, scheduledStart, scheduledEnd, priceMinorRaw] = v;
    if (!itemName || !business || !componentItem || !quantityRaw || !unit) {
      throw new CallError(400, 'itemName, business, componentItem, quantity and unit are all required.');
    }
    const kind = (kindRaw || 'Material') as 'Material' | 'Labour' | 'Plant';
    if (kind !== 'Material' && kind !== 'Labour' && kind !== 'Plant') {
      throw new CallError(400, `kind must be Material, Labour or Plant — got "${kindRaw}".`);
    }
    try {
      stageBomComponent({
        assemblyItem: itemName, business, componentItem, quantity: Number(quantityRaw), unit, kind,
        durationHours: durationRaw ? Number(durationRaw) : undefined,
        scheduledStart: scheduledStart || undefined,
        scheduledEnd: scheduledEnd || undefined,
        priceMinor: priceMinorRaw ? Number(priceMinorRaw) : undefined,
      });
      postBomComponents(itemName, business, asUserId(admin.id));
      return table(
        ['component', 'quantity', 'unit', 'kind', 'durationHours', 'scheduledStart', 'scheduledEnd', 'priceMinor'],
        getBomComponents(itemName).map((l) => ({ ...l, durationHours: l.durationHours ?? '', scheduledStart: l.scheduledStart ?? '', scheduledEnd: l.scheduledEnd ?? '', priceMinor: l.priceMinor ?? '' }))
      );
    } catch (err) {
      if (err instanceof ValidationError || err instanceof NotFoundError) throw new CallError(400, err.message);
      throw err;
    }
  },
  // Positional args: [0] itemName, [1] componentItem.
  deleteBomComponent: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [itemName, componentItem] = v;
    if (!itemName || !componentItem) throw new CallError(400, 'itemName and componentItem are both required.');
    deleteBomComponent(itemName, componentItem, asUserId(admin.id));
    return row();
  },
  // Positional args: [0] itemName. No live frontend caller (both
  // getItemStorageOrigin/setItemStorageOrigin are commented out in
  // api.ts as unused) — built anyway for a complete backend surface.
  getItemStorageOrigin: (v, user) => {
    requireAuth(user);
    const [itemName] = v;
    if (!itemName) throw new CallError(400, 'itemName is required.');
    return row(getItemStorageOrigin(asItemName(itemName)) ?? '');
  },
  // Positional args: [0] itemName, [1] origin ('Hot'/'Cold'/'').
  setItemStorageOrigin: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [itemName, origin] = v;
    if (!itemName) throw new CallError(400, 'itemName is required.');
    setItemStorageOrigin(asItemName(itemName), (origin || null) as 'Hot' | 'Cold' | null, asUserId(admin.id));
    return row();
  },
};
