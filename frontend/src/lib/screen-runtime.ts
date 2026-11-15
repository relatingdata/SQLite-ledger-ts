// What generated screens do, by name. A screen's configuration
// (application/application.entities) names its choice sources, its totals
// rule and its action; this module is the hand-written behaviour behind
// those names. Everything else about a generated screen (its fields,
// layout, labels, styling) is configuration.
//
// An action takes the context (business, ledger, the screen's fixed
// contact), the field values and the filled lines, makes the backend
// calls, and returns the message to show. A validation failure throws
// Invalid, whose message is shown as is.

import { translations } from '$lib/state.svelte';
import {
  getEntityTree,
  listItems,
  listLocations,
  createInvoice,
  postInvoiceById,
  receiveStock,
  dispatchStock,
  completeCashPurchase,
  completePosSale,
  transferStock,
  resolveTransferAccounts,
  stageLine,
  postJournalEntry,
  getItemLocation,
  listItemSources,
  stagePurchaseOrder,
  postPurchaseOrder,
  asAccountName,
  asBusinessName,
  asLedgerName,
  asLocationName,
  asProviderName,
  asCustomerName,
  asItemName,
  type EntityNode,
} from '$lib/api';
import { transferLines } from '$lib/canned-journal';
import { parseMinorUnits, parseQuantity } from '$lib/money';

export interface Context {
  business: string;
  ledger: string;
  /** The screen's fixed contact (its Party), if it has one. */
  party: string;
}
export type Values = Record<string, string>;
export interface Line {
  itemName: string;
  quantity: number;
  unitPriceMinor: number;
  taxMinor?: number;
}
export interface Choice {
  value: string;
  label: string;
  /** For locations: the city, which filters can use. */
  city?: string;
}
/** What a reaction changes: field values, a field's narrowed choices
 * (undefined restores the full list), and the screen's information line. */
export interface Patch {
  values?: Values;
  choices?: Record<string, Choice[] | undefined>;
  info?: string;
}
export interface Totals {
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export class Invalid extends Error {}

const t = (word: string) => translations.current[word] ?? word;

// --- choice sources -----------------------------------------------------------

const named = (es: { name: string }[]): Choice[] => es.map((e) => ({ value: e.name, label: e.name }));
const under = (es: EntityNode[], parentName: string) => es.filter((e) => es.find((p) => p.id === e.parent_id)?.name === parentName);

export const sources: Record<string, (business: string) => Promise<Choice[]>> = {
  locations: async (business) => (await listLocations(asBusinessName(business))).map((l) => ({ value: l.name, label: l.name, city: l.city ?? undefined })),
  items: async (business) => named((await listItems(business)).rows),
  providers: async () => named(under(await getEntityTree(), 'Accounts Payable')),
  customers: async () => named(under(await getEntityTree(), 'Accounts Receivable')),
  postableAccounts: async () => {
    const es = await getEntityTree();
    return es
      .filter((a) => a.is_postable_account && !es.some((c) => c.parent_id === a.id))
      .map((a) => ({ value: a.name, label: a.accountnumber ? `${a.accountnumber} — ${a.name}` : a.name }));
  },
};

// --- filters: a field's choices narrowed by the other values ---------------------

export const filters: Record<string, (choices: Choice[], values: Values) => Choice[]> = {
  /** Other locations in the same city as fromLocation. */
  sameCityAsFrom: (choices, v) => {
    const city = choices.find((c) => c.value === v.fromLocation)?.city;
    return choices.filter((c) => c.value !== v.fromLocation && c.city === city);
  },
};

// --- reactions: run when a field marked Reacts changes ---------------------------

async function onHandAtFrom(v: Values): Promise<string> {
  if (!v.item || !v.fromLocation) return '';
  try {
    const levels = await getItemLocation(asItemName(v.item), asLocationName(v.fromLocation));
    return `${t('On hand at')} ${v.fromLocation}: ${levels.quantity_on_hand}`;
  } catch {
    return '';
  }
}

export const reactions: Record<string, (c: Context, v: Values) => Promise<Patch>> = {
  /** The stock on hand of the item at the location it leaves from. */
  onHand: async (_c, v) => ({ info: await onHandAtFrom(v) }),
  /** A new location to leave from: the destination must be chosen again. */
  fromLocationChanged: async (_c, v) => ({ values: { toLocation: '' }, info: await onHandAtFrom(v) }),
  /** An item's known sources: the preferred provider and its price, and
   * the providers narrowed to those known for it. */
  itemSources: async (_c, v) => {
    if (!v.item) return { choices: { provider: undefined } };
    try {
      const known = await listItemSources(asItemName(v.item));
      const preferred = known.find((s) => s.is_preferred) ?? known[0];
      return {
        choices: { provider: known.length > 0 ? known.map((s) => ({ value: s.vendor_name, label: s.vendor_name })) : undefined },
        values: preferred
          ? { provider: preferred.vendor_name, ...(preferred.price_minor != null ? { price: (preferred.price_minor / 100).toFixed(2) } : {}) }
          : { provider: '' },
      };
    } catch {
      return { choices: { provider: undefined } };
    }
  },
  /** A provider chosen: follow its known price for the item. */
  providerPrice: async (_c, v) => {
    if (!v.item || !v.provider) return {};
    try {
      const match = (await listItemSources(asItemName(v.item))).find((s) => s.vendor_name === v.provider);
      return match?.price_minor != null ? { values: { price: (match.price_minor / 100).toFixed(2) } } : {};
    } catch {
      return {};
    }
  },
};

// --- totals ------------------------------------------------------------------

const subtotal = (lines: Line[]) => lines.reduce((sum, l) => sum + (l.itemName.trim() ? l.quantity * l.unitPriceMinor : 0), 0);

export const totals: Record<string, (lines: Line[], values: Values) => Totals> = {
  /** Tax typed on each line. */
  lineTax: (lines) => {
    const subtotalMinor = subtotal(lines);
    const taxMinor = lines.reduce((sum, l) => sum + (l.itemName.trim() ? (l.taxMinor ?? 0) : 0), 0);
    return { subtotalMinor, taxMinor, totalMinor: subtotalMinor + taxMinor };
  },
  /** A quantity field times a price field, for a screen with no lines. */
  quantityTimesPrice: (_lines, values) => {
    const totalMinor = values.quantity && values.price ? parseQuantity(values.quantity) * parseMinorUnits(values.price) : 0;
    return { subtotalMinor: totalMinor, taxMinor: 0, totalMinor };
  },
  /** A tax percentage (the taxRate field) of the subtotal. */
  taxRate: (lines, values) => {
    const subtotalMinor = subtotal(lines);
    const taxMinor = values.taxRate ? Math.round(subtotalMinor * (Number(values.taxRate) / 100)) : 0;
    return { subtotalMinor, taxMinor, totalMinor: subtotalMinor + taxMinor };
  },
};

// --- actions -----------------------------------------------------------------

const lineTaxAt = (values: Values) => (l: Line) =>
  values.taxRate ? Math.round(l.quantity * l.unitPriceMinor * (Number(values.taxRate) / 100)) : 0;

/** The lines that are real catalogue items, which move stock. */
async function stockLines(business: string, lines: Line[]): Promise<Line[]> {
  const items = new Set((await listItems(business)).rows.map((i) => i.name));
  return lines.filter((l) => items.has(l.itemName));
}

/** An on-account invoice (AP or AR), its stock movement, then posting it. */
async function onAccount(kind: 'AP' | 'AR', c: Context, v: Values, lines: Line[], counterparty: string, location: string, account: string, taxAccount: string): Promise<void> {
  if (!v.reference?.trim() || !counterparty || (kind === 'AP' && !account) || lines.length === 0) {
    throw new Invalid(kind === 'AP' ? 'Reference, provider, account, and at least one item line are all required.' : 'Reference, customer, and at least one item line are all required.');
  }
  const moving = await stockLines(c.business, lines);
  if (moving.length > 0 && !location) {
    throw new Invalid(kind === 'AP' ? 'Select a location — these items will be received into stock.' : 'Select a location — these items will be dispatched from stock.');
  }
  const taxOf = lineTaxAt(v);
  const { id } = await createInvoice({
    invoiceType: kind,
    business: asBusinessName(c.business),
    ledger: asLedgerName(c.ledger),
    reference: v.reference,
    counterpartyName: counterparty,
    invoiceDate: v.transdate,
    description: v.description || undefined,
    lines: lines.map((l) => ({
      description: l.itemName,
      quantity: l.quantity,
      unitPriceMinor: l.unitPriceMinor,
      amountMinor: l.quantity * l.unitPriceMinor,
      taxMinor: taxOf(l),
      itemName: l.itemName,
    })),
  });
  if (moving.length > 0) {
    const movement = {
      business: asBusinessName(c.business),
      ledger: asLedgerName(c.ledger),
      reference: v.reference,
      locationName: asLocationName(location),
      lines: moving.map((l) => ({ itemName: l.itemName, quantity: l.quantity })),
      transdate: v.transdate,
    };
    await (kind === 'AP' ? receiveStock(movement) : dispatchStock(movement));
  }
  await postInvoiceById(id, account, taxAccount);
}

const itemLines = (lines: Line[]) => lines.map((l) => ({ ...l, itemName: asItemName(l.itemName), taxMinor: l.taxMinor ?? 0 }));

export const actions: Record<string, (c: Context, v: Values, lines: Line[]) => Promise<string>> = {
  apPurchase: async (c, v, lines) => {
    await onAccount('AP', c, v, lines, v.provider, v.purchaseLocation, v.expenseAccount, 'Purchases Tax Claimed');
    return `Purchase ${v.reference} from ${v.provider} recorded.`;
  },
  arSale: async (c, v, lines) => {
    await onAccount('AR', c, v, lines, v.customer, v.saleLocation, 'Sales Revenue', 'Sales Tax Payable');
    return `Sale ${v.reference} to ${v.customer} recorded.`;
  },
  transfer: async (c, v) => {
    const quantity = Math.round(Math.abs(Number(v.quantity ?? '')));
    if (!v.item || !v.fromLocation || !v.toLocation) throw new Invalid('Item, from location and to location are all required.');
    const business = asBusinessName(c.business);
    const ledger = asLedgerName(c.ledger);
    // The physical movement first, then the value entry between the two
    // locations' inventory accounts.
    await transferStock({ business, ledger, itemName: asItemName(v.item), fromLocationName: asLocationName(v.fromLocation), toLocationName: asLocationName(v.toLocation), quantity, reference: v.reference });
    const resolved = await resolveTransferAccounts({ business, itemName: asItemName(v.item), fromLocationName: asLocationName(v.fromLocation), toLocationName: asLocationName(v.toLocation) });
    const lines = transferLines({ quantity, fromInventoryAccount: resolved.fromInventoryAccount, toInventoryAccount: resolved.toInventoryAccount, unitCostMinor: resolved.unitCostMinor });
    if (lines.length > 0) {
      const valueReference = `${v.reference}-VALUE`;
      for (const line of lines) {
        await stageLine({ reference: valueReference, business, ledger, account: asAccountName(line.account), amount_minor: line.amount_minor });
      }
      await postJournalEntry(valueReference, business, ledger);
    }
    return `${t('Transferred')} ${quantity} ${v.item}: ${v.fromLocation} \u2192 ${v.toLocation}.`;
  },
  purchaseOrder: async (c, v) => {
    if (!v.reference?.trim() || !v.provider || !v.item || !v.quantity || !v.price) {
      throw new Invalid('Reference, provider, item, quantity, and price are all required.');
    }
    const business = asBusinessName(c.business);
    const ledger = asLedgerName(c.ledger);
    await stagePurchaseOrder({
      reference: v.reference,
      business,
      ledger,
      vendor: asProviderName(v.provider),
      item: asAccountName(v.item),
      quantity: parseQuantity(v.quantity),
      price_minor: parseMinorUnits(v.price),
      location: v.deliveryLocation ? asLocationName(v.deliveryLocation) : undefined,
      transdate: v.transdate,
      description: v.description || undefined,
    });
    await postPurchaseOrder(v.reference, business, ledger);
    return `Purchase Order ${v.reference} placed with ${v.provider}.`;
  },
  cashPurchase: async (c, v, lines) => {
    if (!v.locationName) throw new Invalid('Select a location.');
    const res = await completeCashPurchase({
      business: asBusinessName(c.business),
      ledger: asLedgerName(c.ledger),
      locationName: asLocationName(v.locationName),
      vendorName: asProviderName(c.party),
      lines: itemLines(lines),
      taxAccount: 'Sales Tax Payable',
      paymentMethod: v.paymentMethod,
      transdate: v.transdate,
    });
    return `${t('Purchase completed')}: ${res.reference}`;
  },
  cashSale: async (c, v, lines) => {
    if (!v.locationName) throw new Invalid('Select a location.');
    const res = await completePosSale({
      business: asBusinessName(c.business),
      ledger: asLedgerName(c.ledger),
      locationName: asLocationName(v.locationName),
      customerName: asCustomerName(c.party),
      lines: itemLines(lines),
      taxAccount: 'Sales Tax Payable',
      paymentMethod: v.paymentMethod,
      transdate: v.transdate,
    });
    return `${t('Sale completed')}: ${res.reference}`;
  },
};
