// Converted from routes/pos.ts. completePosSale/completeCashPurchase/
// receiveStock/dispatchStock all take a real, caller-variable-length
// array of lines (a shopping cart) - carried via the lineItems protocol
// extension (call-dispatch.ts's BackendCall 3rd param / routes/call.ts),
// one CSV line per item after the call's own first line, in the column
// order documented at each entry below.
import {
  getItemByUpc,
  getCombinationByUpc,
  completePosSale,
  completeCashPurchase,
  payEmployeeWages,
  getOrganizationChart,
  asBusinessName,
  asLedgerName,
  asLocationName,
  asCustomerName,
  asProviderName,
  asAccountName,
  asItemName,
  ValidationError,
  NotFoundError,
  asUserId,
  receiveItems,
  dispatchItems,
  resolveDispatchLocation,
  type PosSaleLineInput,
  type CashPurchaseLineInput,
} from '../db.js';
import { createPosTerminal, listPosTerminals, setTerminalCurrency } from '../db-stock.js';
import { CallError, encodeStringList, decodeStringList, encodeShape, decodeShape, requireAuth, requireRole, row, table, type BackendCall } from '../call-dispatch.js';

export const posFunctions: Record<string, BackendCall> = {
  // Positional args: [0] upc. No role gate (just requireAuth on the
  // whole mount, same as the old route).
  lookupByUpc: (v, user) => {
    requireAuth(user);
    const [upc] = v;
    if (!upc) throw new CallError(400, 'upc is required.');
    const combination = getCombinationByUpc(upc);
    if (combination) {
      const item = getItemByUpc(upc) ?? { name: combination.itemName, description: null, unit_of_measure: null, upc, retail_price_minor: null, source_count: 0, storage_origin: null, product: null };
      return row(
        combination.itemName,
        item.description,
        item.unit_of_measure,
        item.upc,
        item.retail_price_minor,
        item.source_count,
        item.storage_origin,
        item.product,
        encodeStringList(combination.combinationValues),
        encodeShape(combination.combinationShape)
      );
    }
    const item = getItemByUpc(upc);
    if (!item) throw new CallError(404, 'No item with that UPC.');
    return row(item.name, item.description, item.unit_of_measure, item.upc, item.retail_price_minor, item.source_count, item.storage_origin, item.product, '', '');
  },
  // First line's positional args: [0] business, [1] ledger,
  // [2] locationName, [3] customerName, [4] revenueAccount, [5] taxAccount,
  // [6] paymentMethod, [7] cashTenderedMinor, [8] transdate, [9] terminalName.
  // Line-items (one per cart line): itemName,quantity,unitPriceMinor,
  // taxMinor,tier,combinationValues(encoded),combinationShape(encoded).
  completePosSale: (v, user, lineItems) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, ledger, locationName, customerName, revenueAccount, taxAccount, paymentMethod, cashTenderedMinorRaw, transdate, terminalName] = v;
    if (!business || !ledger || !locationName || !customerName || !taxAccount) throw new CallError(400, 'business, ledger, locationName, customerName and taxAccount are all required.');
    if (lineItems.length === 0) throw new CallError(400, 'A sale needs at least one line.');
    const lines: PosSaleLineInput[] = lineItems.map(([itemName, quantityRaw, unitPriceMinorRaw, taxMinorRaw, tier, combinationValuesRaw, combinationShapeRaw]) => ({
      itemName,
      quantity: Number(quantityRaw),
      unitPriceMinor: unitPriceMinorRaw ? Number(unitPriceMinorRaw) : undefined,
      taxMinor: Number(taxMinorRaw),
      tier: tier || undefined,
      combinationValues: combinationValuesRaw ? decodeStringList(combinationValuesRaw) : undefined,
      combinationShape: combinationShapeRaw ? decodeShape(combinationShapeRaw) : undefined,
    }));
    try {
      const result = completePosSale(
        {
          business: asBusinessName(business),
          ledger: asLedgerName(ledger),
          locationName: asLocationName(locationName),
          customerName: asCustomerName(customerName),
          lines,
          revenueAccount: revenueAccount ? asAccountName(revenueAccount) : undefined,
          taxAccount: asAccountName(taxAccount),
          paymentMethod: paymentMethod || undefined,
          cashTenderedMinor: cashTenderedMinorRaw ? Number(cashTenderedMinorRaw) : undefined,
          transdate: transdate || undefined,
          terminalName: terminalName || undefined,
        },
        asUserId(admin.id)
      );
      return row(result.invoiceId, result.reference, result.totalMinor, result.changeDueMinor);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      throw err;
    }
  },
  // First line's positional args: [0] business, [1] ledger,
  // [2] locationName, [3] vendorName, [4] taxAccount, [5] paymentMethod,
  // [6] transdate. Line-items: itemName,quantity,unitPriceMinor,taxMinor,tier.
  // Live frontend caller: CashTransaction.svelte (shared cash-sale/
  // cash-purchase component).
  completeCashPurchase: (v, user, lineItems) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, ledger, locationName, vendorName, taxAccount, paymentMethod, transdate] = v;
    if (!business || !ledger || !locationName || !vendorName || !taxAccount) throw new CallError(400, 'business, ledger, locationName, vendorName and taxAccount are all required.');
    if (lineItems.length === 0) throw new CallError(400, 'A purchase needs at least one line.');
    const lines: CashPurchaseLineInput[] = lineItems.map(([itemName, quantityRaw, unitPriceMinorRaw, taxMinorRaw, tier]) => ({
      itemName,
      quantity: Number(quantityRaw),
      unitPriceMinor: Number(unitPriceMinorRaw),
      taxMinor: Number(taxMinorRaw),
      tier: tier || undefined,
    }));
    try {
      const result = completeCashPurchase(
        {
          business: asBusinessName(business),
          ledger: asLedgerName(ledger),
          locationName: asLocationName(locationName),
          vendorName: asProviderName(vendorName),
          lines,
          taxAccount: asAccountName(taxAccount),
          paymentMethod: paymentMethod || undefined,
          transdate: transdate || undefined,
        },
        asUserId(admin.id)
      );
      return row(result.invoiceId, result.reference, result.totalMinor);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      throw err;
    }
  },
  // First line's positional args: [0] business, [1] ledger,
  // [2] reference, [3] locationName, [4] transdate. Line-items:
  // itemName,quantity. Matches the old route's own per-line loop over
  // receiveItems exactly (same derived per-line reference suffix).
  receiveStock: (v, user, lineItems) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, ledger, reference, locationName, transdate] = v;
    if (!business || !ledger || !reference || !locationName) throw new CallError(400, 'business, ledger, reference and locationName are all required.');
    if (lineItems.length === 0) throw new CallError(400, 'At least one line is required.');
    try {
      for (const [itemName, quantityRaw] of lineItems) {
        receiveItems(asBusinessName(business), asLedgerName(ledger), `${reference}-RECV-${itemName}`, asItemName(itemName), asLocationName(locationName), Number(quantityRaw), asUserId(admin.id), transdate || undefined);
      }
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      throw err;
    }
  },
  // Same shape as receiveStock, calling dispatchItems (via
  // resolveDispatchLocation, exactly as the old route did).
  dispatchStock: (v, user, lineItems) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, ledger, reference, locationName, transdate] = v;
    if (!business || !ledger || !reference || !locationName) throw new CallError(400, 'business, ledger, reference and locationName are all required.');
    if (lineItems.length === 0) throw new CallError(400, 'At least one line is required.');
    try {
      for (const [itemNameRaw, quantityRaw] of lineItems) {
        const itemName = asItemName(itemNameRaw);
        dispatchItems(asBusinessName(business), asLedgerName(ledger), `${reference}-DISPATCH-${itemNameRaw}`, itemName, resolveDispatchLocation(itemName, asLocationName(locationName)), Number(quantityRaw), asUserId(admin.id), transdate || undefined);
      }
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      throw err;
    }
  },
  // Positional args: [0] business, [1] ledger, [2] employeeName,
  // [3] hours, [4] wagesExpenseAccount, [5] paymentMethod, [6] transdate.
  payEmployeeWages: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, ledger, employeeName, hoursRaw, wagesExpenseAccount, paymentMethod, transdate] = v;
    if (!business || !ledger || !employeeName) throw new CallError(400, 'business, ledger and employeeName are all required.');
    try {
      const result = payEmployeeWages(
        { business, ledger, employeeName, hours: hoursRaw ? Number(hoursRaw) : undefined, wagesExpenseAccount: wagesExpenseAccount || undefined, paymentMethod: paymentMethod || undefined, transdate: transdate || undefined },
        asUserId(admin.id)
      );
      return row(result.invoiceId, result.reference, result.grossMinor, result.medicareLevyMinor, result.superannuationMinor, result.netMinor);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      throw err;
    }
  },
  // Positional args: [0] businessName. Table columns: section
  // ('company'|'group'), group, location, employee. A group with zero
  // locations survives as one row (location='') since the frontend
  // reads group names even with no locations yet; a location with zero
  // employees survives as one row (employee='') since the frontend
  // reads every location name even with no staff assigned. No sentinel
  // needed for zero company-wide employees - that's a flat, unnamed
  // list, not something to preserve across an empty result. The real
  // "business" field is dropped from the wire (it's always just an echo
  // of the requested businessName - the frontend already has it).
  getOrganizationChart: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [businessName] = v;
    if (!businessName) throw new CallError(400, 'businessName is required.');
    const chart = getOrganizationChart(asBusinessName(businessName));
    const rows: { section: string; group: string; location: string; employee: string }[] = [];
    for (const name of chart.companyWideEmployees) rows.push({ section: 'company', group: '', location: '', employee: name });
    for (const g of chart.groups) {
      if (g.locations.length === 0) {
        rows.push({ section: 'group', group: g.group, location: '', employee: '' });
      } else {
        for (const loc of g.locations) {
          if (loc.employees.length === 0) rows.push({ section: 'group', group: g.group, location: loc.location, employee: '' });
          else for (const name of loc.employees) rows.push({ section: 'group', group: g.group, location: loc.location, employee: name });
        }
      }
    }
    return table(['section', 'group', 'location', 'employee'], rows);
  },
  // Positional args: [0] locationName. No role gate (just requireAuth),
  // same as the old route. Keyed by the frontend's own call name
  // (`getPosTerminals` in api.ts), same precedent as createDepartment.
  getPosTerminals: (v, user) => {
    requireAuth(user);
    const [locationName] = v;
    if (!locationName) throw new CallError(400, 'locationName is required.');
    return table(['name', 'currency'], listPosTerminals(locationName).map((t) => ({ name: t.name, currency: t.currency ?? '' })));
  },
  // Positional args: [0] locationName, [1] terminalName, [2] currency.
  createPosTerminal: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [locationName, terminalName, currency] = v;
    if (!locationName || !terminalName) throw new CallError(400, 'locationName and terminalName are both required.');
    try {
      createPosTerminal(terminalName, asLocationName(locationName), asUserId(admin.id));
      if (currency) setTerminalCurrency(terminalName, currency);
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
};
