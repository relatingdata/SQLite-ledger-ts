// Converted from routes/stock-lots.ts. Mounted (old route) with plain
// requireAuth, three of its four endpoints additionally gated with
// requireRole('Administrator','Bookkeeper') per-route — replicated here.
import { writeOffItems, receiveLot, consumeFromLots, getExpiringStock, asBusinessName, asLedgerName, asItemName, asAccountName, ValidationError, asUserId } from '../db.js';
import { CallError, requireAuth, requireRole, row, table, type BackendCall } from '../call-dispatch.js';

export const stockLotsFunctions: Record<string, BackendCall> = {
  // Positional args: [0] business, [1] ledger, [2] reference, [3] itemName,
  // [4] quantity, [5] unitCostMinor, [6] writeOffExpenseAccount,
  // [7] inventoryAccount, [8] reason, [9] transdate.
  // (writeOffItems also takes locationName/combinationValues/
  // combinationShape, but the old route's own schema never carried
  // those either — not ported here, matching real prior behavior.)
  writeOffItems: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, ledger, reference, itemName, quantityRaw, unitCostMinorRaw, writeOffExpenseAccount, inventoryAccount, reason, transdate] = v;
    if (!business || !ledger || !reference || !itemName || !quantityRaw || !unitCostMinorRaw || !writeOffExpenseAccount || !inventoryAccount || !reason) {
      throw new CallError(400, 'business, ledger, reference, itemName, quantity, unitCostMinor, writeOffExpenseAccount, inventoryAccount and reason are all required.');
    }
    try {
      writeOffItems(
        asBusinessName(business),
        asLedgerName(ledger),
        reference,
        asItemName(itemName),
        Number(quantityRaw),
        Number(unitCostMinorRaw),
        asAccountName(writeOffExpenseAccount),
        inventoryAccount,
        reason,
        asUserId(admin.id),
        transdate || undefined
      );
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] business, [1] ledger, [2] reference, [3] itemName,
  // [4] lotNumber, [5] receivedDate, [6] expirationDate, [7] quantity.
  receiveLot: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, ledger, reference, itemName, lotNumber, receivedDate, expirationDate, quantityRaw] = v;
    if (!business || !ledger || !reference || !itemName || !lotNumber || !receivedDate || !quantityRaw) {
      throw new CallError(400, 'business, ledger, reference, itemName, lotNumber, receivedDate and quantity are all required.');
    }
    try {
      receiveLot(asBusinessName(business), asLedgerName(ledger), reference, asItemName(itemName), lotNumber, receivedDate, expirationDate || null, Number(quantityRaw), asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] business, [1] ledger, [2] reference, [3] itemName,
  // [4] quantity, [5] transdate. No live frontend caller (confirmed via
  // grep of frontend/src/lib/api.ts) - built for a complete backend
  // surface, matching the old JSON route's own real behavior.
  consumeFromLots: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, ledger, reference, itemName, quantityRaw, transdate] = v;
    if (!business || !ledger || !reference || !itemName || !quantityRaw) throw new CallError(400, 'business, ledger, reference, itemName and quantity are all required.');
    try {
      const consumed = consumeFromLots(asBusinessName(business), asLedgerName(ledger), reference, asItemName(itemName), Number(quantityRaw), asUserId(admin.id), transdate || undefined);
      return table(['lot_number', 'consumed', 'expiration_date', 'cost_basis_minor'], consumed);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] asOfDate, [1] withinDays. No role gate (any
  // logged-in user), matching the old route.
  getExpiringStock: (v, user) => {
    requireAuth(user);
    const [asOfDate, withinDaysRaw] = v;
    const resolvedAsOfDate = asOfDate || new Date().toISOString().slice(0, 10);
    const withinDays = withinDaysRaw ? Number(withinDaysRaw) : 30;
    return table(['item', 'lot_number', 'expiration_date', 'quantity_on_hand', 'days_until_expiration'], getExpiringStock(resolvedAsOfDate, withinDays));
  },
};
