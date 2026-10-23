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

// Cash Purchase's canned shape — see docs/pm-frontend-reference.md.
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

// Cash Sale's canned shape — see docs/pm-frontend-reference.md.
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
