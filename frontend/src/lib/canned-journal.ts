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

/** A real, fresh, unique reference for a canned entry built client-side
 * — the same shape (`<PREFIX>-<timestamp>-<random>`) the backend's own
 * canned functions used to generate server-side. */
export function freshReference(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}
