// Per docs/canned-journal-to-frontend-design.md: the one, real, shared,
// non-duplicated module every "canned" financial screen's existing
// submit handler calls to build its own complete, already-balanced set
// of journal lines — then posts them through the exact, same, generic
// /journal/staging + /journal/post calls the General Journal screen's
// own "Save" button already uses (stageLine/postJournalEntry in
// $lib/api). Each function here is a pure, deterministic computation
// over the screen's own form values plus whatever real account names
// the backend has already resolved for it (see resolveCashTransactionAccounts
// in $lib/api) — it never creates an account, never touches stock
// quantities, and never calls the network itself.
//
// Per direct, explicit correction: a journal entry never carries a
// division or category of any kind — every real dimension (which
// location, which item, which storage tier/pack size) is baked
// directly into the account's own name, the cartesian product of
// Location x Item (x storage/size where that distinction genuinely
// changes cost or selling price), exactly the way
// ensureItemLocationInventoryAccount already names its own accounts
// (`<item> (<tier>) — <location>`). There is no separate tag field
// anywhere in this module, and there must never be one.

import { stageLine, postJournalEntry, type AccountName, type BusinessName, type LedgerName } from './api';

export interface CannedLine {
  account: string;
  amount_minor: number;
}

export interface CannedEntry {
  reference: string;
  lines: CannedLine[];
}

/** Cash Purchase's real, canned shape — the exact, same account
 * selection `completeCashPurchase`/`postInvoice` used to compute
 * server-side: debit each item's own, real, location-scoped Inventory
 * account (the real cartesian-product account name, already resolved
 * by resolveCashTransactionAccounts) for that line's amount; debit the
 * real tax account for the total tax, if any; credit the real
 * Cash-and-Bank account for the grand total. No division/category
 * field anywhere — the Inventory account's own name already carries
 * the real location (and tier, where given). */
export function cashPurchaseLines(input: {
  lines: { itemName: string; quantity: number; unitPriceMinor: number; taxMinor: number; tier?: string }[];
  inventoryAccounts: Record<string, string>;
  taxAccount: string;
  cashAccount: string;
}): CannedLine[] {
  const result: CannedLine[] = [];
  let taxTotal = 0;
  let grandTotal = 0;
  for (const l of input.lines) {
    const key = l.tier ? `${l.itemName} (${l.tier})` : l.itemName;
    const inventoryAccount = input.inventoryAccounts[key];
    if (!inventoryAccount) throw new Error(`No resolved Inventory account for "${key}".`);
    const amount = l.quantity * l.unitPriceMinor;
    result.push({ account: inventoryAccount, amount_minor: amount });
    taxTotal += l.taxMinor;
    grandTotal += amount + l.taxMinor;
  }
  if (taxTotal !== 0) result.push({ account: input.taxAccount, amount_minor: taxTotal });
  result.push({ account: input.cashAccount, amount_minor: -grandTotal });
  return result;
}

/** Cash Sale's real, canned shape — the exact, same account selection
 * completePosSale's own revenueAccount resolver closure and COGS loop
 * used to compute server-side, split into two separate results since
 * the real backend always posted these as two separate journal
 * entries (the main sale entry, and a second, COGS-only entry, posted
 * only when at least one line's real per-unit cost is actually known):
 * credit each item's own, real Sales Revenue account for that line's
 * amount; credit the real tax account for the total tax, if any; debit
 * the real Cash-and-Bank account for the grand total. Separately,
 * for every line whose real per-unit cost is known, debit that item's
 * own COGS account and credit its own, real, location-scoped
 * Inventory account for the real cost of goods sold — a genuinely new
 * product with no known cost yet simply posts no COGS/Inventory line
 * for itself, never a fabricated cost. No division/category field
 * anywhere — every real dimension already lives in the account's own
 * name. */
export function posSaleLines(input: {
  lines: { itemName: string; quantity: number; unitPriceMinor: number; taxMinor: number; tier?: string }[];
  salesAccounts: Record<string, string>;
  cogsAccounts: Record<string, string>;
  inventoryAccounts: Record<string, string>;
  unitCostMinor: Record<string, number | null>;
  taxAccount: string;
  cashAccount: string;
}): { lines: CannedLine[]; cogsLines: CannedLine[] } {
  const lines: CannedLine[] = [];
  const cogsLines: CannedLine[] = [];
  let taxTotal = 0;
  let grandTotal = 0;
  for (const l of input.lines) {
    const key = l.tier ? `${l.itemName} (${l.tier})` : l.itemName;
    const salesAccount = input.salesAccounts[key];
    if (!salesAccount) throw new Error(`No resolved Sales Revenue account for "${key}".`);
    const amount = l.quantity * l.unitPriceMinor;
    lines.push({ account: salesAccount, amount_minor: -amount });
    taxTotal += l.taxMinor;
    grandTotal += amount + l.taxMinor;

    const unitCost = input.unitCostMinor[key];
    if (unitCost != null) {
      const lineCogs = l.quantity * unitCost;
      if (lineCogs > 0) {
        const cogsAccount = input.cogsAccounts[key];
        const inventoryAccount = input.inventoryAccounts[key];
        if (!cogsAccount || !inventoryAccount) throw new Error(`No resolved COGS/Inventory account for "${key}".`);
        cogsLines.push({ account: cogsAccount, amount_minor: lineCogs });
        cogsLines.push({ account: inventoryAccount, amount_minor: -lineCogs });
      }
    }
  }
  if (taxTotal !== 0) lines.push({ account: input.taxAccount, amount_minor: -taxTotal });
  lines.push({ account: input.cashAccount, amount_minor: grandTotal });
  return { lines, cogsLines };
}

/** Stock Transfer's real, canned shape — the exact, same real dollar
 * movement transferItems's own plain, non-combination VALUE-posting
 * branch used to compute server-side: credit the item's real,
 * location-scoped Inventory account at the source location for the
 * real cost of the quantity moved, debit the real, matching Inventory
 * account at the destination. Returns an empty line list when this
 * item's own, real per-unit cost isn't known yet — the exact, same
 * real behavior that branch already used (no fabricated cost, no
 * entry posted at all), leaving only the real, physical stock
 * movement (transferStock) to actually happen. No division/category
 * field anywhere — each account's own name already carries its real
 * location. */
export function transferLines(input: {
  quantity: number;
  fromInventoryAccount: string;
  toInventoryAccount: string;
  unitCostMinor: number | null;
}): CannedLine[] {
  if (input.unitCostMinor == null) return [];
  const valueMinor = input.quantity * input.unitCostMinor;
  if (valueMinor <= 0) return [];
  return [
    { account: input.fromInventoryAccount, amount_minor: -valueMinor },
    { account: input.toInventoryAccount, amount_minor: valueMinor },
  ];
}

/** Open Container's real, canned shape — the exact, same two, real,
 * independent journal entries openStorageContainer itself used to
 * compute server-side, returned separately since they're genuinely
 * posted as two separate journal entries (the real storage-space
 * movement always posts; the real dollar Inventory-value movement
 * only posts when this item's own, real per-unit cost is actually
 * known — never a fabricated cost): the container's own real
 * "Remaining" space increases and its "Occupied" space decreases by
 * cartonsOpened (space freed, the container is now empty); the unit's
 * own real "Remaining" space decreases and its "Occupied" space
 * increases by unitsProduced (space taken up by the newly-loose
 * units) — no contra accounting of any kind, per direct instruction.
 * Separately, the same, real dollar Inventory value simply moves
 * directly from the container tier's own Inventory account to the
 * unit tier's own Inventory account, the same real dollar value just
 * re-tagged. No division/category field anywhere. */
export function openContainerLines(input: {
  cartonsOpened: number;
  unitsProduced: number;
  containerSpaceAccount: string;
  containerOccupiedAccount: string;
  unitSpaceAccount: string;
  unitOccupiedAccount: string;
  inventoryFromAccount: string;
  inventoryToAccount: string;
  unitCostMinor: number | null;
}): { spaceLines: CannedLine[]; valueLines: CannedLine[] } {
  const spaceLines: CannedLine[] = [
    { account: input.containerSpaceAccount, amount_minor: input.cartonsOpened },
    { account: input.containerOccupiedAccount, amount_minor: -input.cartonsOpened },
    { account: input.unitSpaceAccount, amount_minor: -input.unitsProduced },
    { account: input.unitOccupiedAccount, amount_minor: input.unitsProduced },
  ];
  let valueLines: CannedLine[] = [];
  if (input.unitCostMinor != null) {
    const valueMinor = input.unitsProduced * input.unitCostMinor;
    if (valueMinor > 0) {
      valueLines = [
        { account: input.inventoryFromAccount, amount_minor: -valueMinor },
        { account: input.inventoryToAccount, amount_minor: valueMinor },
      ];
    }
  }
  return { spaceLines, valueLines };
}

/** Receive Into Storage's real, canned shape — relevant only for a
 * real, combination-tracked receipt (an ordinary, plain receipt posts
 * no real dollar journal entry at all, before or after this
 * migration): the exact, same real dollar movement receiveItems's own
 * combination-receipt VALUE block used to compute server-side — debit
 * the item's own, real, combination-tier Inventory account for the
 * real cost of the quantity received, credit the real, control
 * Accounts Payable account. Returns an empty line list when either no
 * combination was given, or this item's own, real per-unit cost isn't
 * known yet — the exact, same real behavior that block already used
 * (no fabricated cost, no entry posted at all). No division/category
 * field anywhere. */
export function receiveIntoStorageLines(input: {
  quantity: number;
  resolved: { inventoryAccount: string; payableAccount: string; unitCostMinor: number | null } | null;
}): CannedLine[] {
  if (!input.resolved || input.resolved.unitCostMinor == null) return [];
  const valueMinor = input.quantity * input.resolved.unitCostMinor;
  if (valueMinor <= 0) return [];
  return [
    { account: input.resolved.inventoryAccount, amount_minor: valueMinor },
    { account: input.resolved.payableAccount, amount_minor: -valueMinor },
  ];
}

/** A real, fresh, unique reference for a canned entry built client-side
 * — the same shape (`<PREFIX>-<timestamp>-<random>`) the backend's own
 * canned functions used to generate server-side. */
export function freshReference(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}
