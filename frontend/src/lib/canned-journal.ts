// The canned-journal computation module — see docs/pm-frontend-reference.md
// for the full design (the "frontend-driven canned journal" pattern, the
// "no division/category field" rule, and each screen's canned shape).

import { stageLine, postJournalEntry, type AccountName, type BusinessName, type LedgerName } from './api';

export interface CannedLine {
  account: string;
  accountId?: number; // resolves name collisions — see docs/pm-frontend-reference.md
  amount_minor: number;
}

export interface CannedEntry {
  reference: string;
  lines: CannedLine[];
}

// cashPurchaseLines/posSaleLines (Cash Purchase/Cash Sale's old, direct-
// to-Cash canned shapes) were removed along with the resolve-accounts
// endpoints that fed them. Both screens now go through
// completeCashPurchase/completePosSale instead — the same genuine
// invoice+stock+immediate-payment mechanism as any on-account
// Purchase/Sale, to the one real "Cash" provider/customer. See "Cash
// Sale and Cash Purchase" in pm-frontend-reference.md.

// Stock Transfer's canned shape — see docs/pm-frontend-reference.md.
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

// Open Container's canned shape — see docs/pm-frontend-reference.md.
export function openContainerLines(input: {
  cartonsOpened: number;
  unitsProduced: number;
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
}): { spaceLines: CannedLine[]; valueLines: CannedLine[] } {
  const spaceLines: CannedLine[] = [
    { account: input.containerSpaceAccount, accountId: input.containerSpaceAccountId, amount_minor: input.cartonsOpened },
    { account: input.containerOccupiedAccount, accountId: input.containerOccupiedAccountId, amount_minor: -input.cartonsOpened },
    { account: input.unitSpaceAccount, accountId: input.unitSpaceAccountId, amount_minor: -input.unitsProduced },
    { account: input.unitOccupiedAccount, accountId: input.unitOccupiedAccountId, amount_minor: input.unitsProduced },
  ];
  let valueLines: CannedLine[] = [];
  if (input.unitCostMinor != null) {
    const valueMinor = input.unitsProduced * input.unitCostMinor;
    if (valueMinor > 0) {
      valueLines = [
        { account: input.inventoryFromAccount, accountId: input.inventoryFromAccountId, amount_minor: -valueMinor },
        { account: input.inventoryToAccount, accountId: input.inventoryToAccountId, amount_minor: valueMinor },
      ];
    }
  }
  return { spaceLines, valueLines };
}

// Receive Into Storage's canned shape — see docs/pm-frontend-reference.md.
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

// Same reference shape the backend used server-side — see docs/pm-frontend-reference.md.
export function freshReference(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}
