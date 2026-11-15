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

import { auth, translations } from '$lib/state.svelte';
import { formatAmount } from '$lib/format';
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
  stageSalesOrder,
  stageOrderReceipt,
  postOrderReceipt,
  getOrderStatus,
  getTrialBalance,
  getBalanceSheet,
  type CategoryTreeNode,
  postSalesOrder,
  createQuotation,
  createRfq,
  listQuotations,
  acceptQuotation,
  rejectQuotation,
  markQuotationSent,
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
  /** The screen's ledger side (its Side: AR or AP), if it has one. */
  side?: string;
}
/** A record a screen lists: its fields as shown. */
export type Row = Record<string, string>;
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
  /** What is still open on the order named in the order field. */
  orderStatus: async (_c, v) => {
    if (!v.order?.trim()) return { info: '' };
    try {
      const open = await getOrderStatus(v.order);
      return { info: `${t('Still open on that order:')} ${open.quantity} ${t('units')}, ${formatAmount(open.value_minor, auth.current?.user.number_format ?? '1 000.00')}` };
    } catch {
      return { info: '' };
    }
  },
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
  /** A tax percentage (the taxRate field) of an amount (the value field). */
  valueTaxRate: (_lines, values) => {
    const subtotalMinor = values.value ? parseMinorUnits(values.value) : 0;
    const taxMinor = values.taxRate ? Math.round(subtotalMinor * (Number(values.taxRate) / 100)) : 0;
    return { subtotalMinor, taxMinor, totalMinor: subtotalMinor + taxMinor };
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
  /** A purchase: from the Cash provider it is paid off at once (the
   * backend's one atomic cash purchase); otherwise it is posted on account
   * to the chosen provider. */
  purchase: async (c, v, lines) => {
    if (c.party === 'Cash') {
      if (!v.location) throw new Invalid('Select a location.');
      const res = await completeCashPurchase({
        business: asBusinessName(c.business),
        ledger: asLedgerName(c.ledger),
        locationName: asLocationName(v.location),
        vendorName: asProviderName(c.party),
        lines: itemLines(lines),
        taxAccount: 'Sales Tax Payable',
        paymentMethod: v.paymentMethod,
        transdate: v.transdate,
      });
      return `${t('Purchase completed')}: ${res.reference}`;
    }
    await onAccount('AP', c, v, lines, v.provider, v.location, v.expenseAccount, 'Purchases Tax Claimed');
    return `Purchase ${v.reference} from ${v.provider} recorded.`;
  },
  /** A sale: to the Cash customer it is paid off at once; otherwise it is
   * posted on account to the chosen customer. */
  sale: async (c, v, lines) => {
    if (c.party === 'Cash') {
      if (!v.location) throw new Invalid('Select a location.');
      const res = await completePosSale({
        business: asBusinessName(c.business),
        ledger: asLedgerName(c.ledger),
        locationName: asLocationName(v.location),
        customerName: asCustomerName(c.party),
        lines: itemLines(lines),
        taxAccount: 'Sales Tax Payable',
        paymentMethod: v.paymentMethod,
        transdate: v.transdate,
      });
      return `${t('Sale completed')}: ${res.reference}`;
    }
    await onAccount('AR', c, v, lines, v.customer, v.location, 'Sales Revenue', 'Sales Tax Payable');
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
  /** Goods or a service received against a purchase order. */
  orderReceipt: async (c, v) => {
    if (!v.reference?.trim() || !v.order?.trim() || !v.provider || !v.item || !v.quantity || !v.value) {
      throw new Invalid('Reference, PO reference, provider, item, quantity, and value are all required.');
    }
    const business = asBusinessName(c.business);
    const ledger = asLedgerName(c.ledger);
    const value_minor = parseMinorUnits(v.value);
    await stageOrderReceipt({
      reference: v.reference, business, ledger, po_reference: v.order, item: v.item,
      item_qty: v.isService ? undefined : v.itemQty || undefined,
      vendor: v.provider, quantity: parseQuantity(v.quantity), value_minor,
      tax_minor: v.taxRate ? Math.round(value_minor * (Number(v.taxRate) / 100)) : 0,
      transdate: v.transdate, description: v.description || undefined,
    });
    await postOrderReceipt(v.reference, business, ledger);
    return `Receipt ${v.reference} recorded against ${v.order}.`;
  },
  salesOrder: async (c, v) => {
    if (!v.reference?.trim() || !v.customer || !v.item || !v.quantity || !v.price) {
      throw new Invalid('Reference, customer, item, quantity, and price are all required.');
    }
    const business = asBusinessName(c.business);
    const ledger = asLedgerName(c.ledger);
    await stageSalesOrder({
      reference: v.reference, business, ledger, customer: asCustomerName(v.customer), item: asAccountName(v.item),
      quantity: parseQuantity(v.quantity), price_minor: parseMinorUnits(v.price),
      location: v.deliveryLocation ? asLocationName(v.deliveryLocation) : undefined,
      transdate: v.transdate, description: v.description || undefined,
    });
    await postSalesOrder(v.reference, business, ledger);
    return `Sales Order ${v.reference} placed for ${v.customer}.`;
  },
  /** A quotation (side AR) or a request for quotation (side AP): an order
   * staged but not posted until it is accepted. */
  quotation: async (c, v) => {
    if (!v.reference?.trim() || !v.party || !v.item || !v.quantity || !v.price) {
      throw new Invalid(`Reference, ${c.side === 'AP' ? 'provider' : 'customer'}, item, quantity, and price are all required.`);
    }
    const common = {
      reference: v.reference, business: asBusinessName(c.business), ledger: asLedgerName(c.ledger),
      item: asAccountName(v.item), quantity: parseQuantity(v.quantity), price_minor: parseMinorUnits(v.price),
      location: v.location ? asLocationName(v.location) : undefined, transdate: v.transdate,
      description: v.description || undefined, expiryDate: v.expiryDate || undefined,
    };
    if (c.side === 'AP') {
      await createRfq({ ...common, vendor: asProviderName(v.party) });
      return `RFQ ${v.reference} drafted for ${v.party}.`;
    }
    await createQuotation({ ...common, customer: asCustomerName(v.party) });
    return `Quotation ${v.reference} drafted for ${v.party}.`;
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
};

// --- records -------------------------------------------------------------------

/** The records a screen lists below its form, refreshed after each action. */
export const records: Record<string, (c: Context) => Promise<Row[]>> = {
  quotations: async (c) =>
    (await listQuotations(asBusinessName(c.business), asLedgerName(c.ledger), c.side === 'AP' ? 'AP' : 'AR')).map((q) => ({
      reference: q.reference,
      party: q.customer ?? q.vendor ?? '',
      what: `${q.item} \u00d7 ${q.quantity}`,
      status: q.status,
      expires: q.expiryDate ?? '\u2014',
    })),
};

/** What a listed record's buttons do; each returns the message to show. */
export const commands: Record<string, (c: Context, row: Row) => Promise<string>> = {
  markSent: async (_c, row) => {
    await markQuotationSent(row.reference);
    return '';
  },
  accept: async (c, row) => {
    await acceptQuotation(row.reference);
    return `${row.reference} accepted \u2014 a real ${c.side === 'AP' ? 'Purchase' : 'Sales'} Order now exists for it.`;
  },
  reject: async (_c, row) => {
    await rejectQuotation(row.reference);
    return `${row.reference} marked rejected.`;
  },
};

// --- reports -------------------------------------------------------------------

/** One line of a report: its cells, already formatted, by column name. A
 * line under others in a tree names them (ancestors), so it shows only when
 * they are open; a parent line opens and closes. */
export interface ReportRow {
  key: string;
  depth: number;
  ancestors: string[];
  parent: boolean;
  cells: Record<string, string>;
  /** Columns whose amount is contra (shown in red). */
  contra?: string[];
  /** A small tag after the first cell, with its explanation. */
  badge?: string;
  badgeTitle?: string;
}
export interface ReportGroup {
  title: string;
  warn?: string;
  rows: ReportRow[];
  footer?: Record<string, string>;
  footerContra?: string[];
}
/** A column of the page: groups stacked, then an optional summary line. */
export interface ReportColumn {
  groups: ReportGroup[];
  summary?: { label: string; value: string };
}
export interface Report {
  columns: ReportColumn[];
  status?: { ok: boolean; text: string };
  note?: string;
}

const money = (minor: number) => formatAmount(minor, auth.current?.user.number_format ?? '1 000.00');

/** A tree of categories as rows, each under its ancestors. */
function treeRows(section: string, nodes: CategoryTreeNode[], cellOf: (n: CategoryTreeNode) => Record<string, string>, ancestors: string[] = []): ReportRow[] {
  return nodes.flatMap((n) => {
    const key = `${section}/${[...ancestors, n.name].join('/')}`;
    const parent = !n.is_leaf && n.children.length > 0;
    const row: ReportRow = {
      key, depth: ancestors.length, ancestors: ancestors.map((_, i) => `${section}/${ancestors.slice(0, i + 1).join('/')}`), parent,
      cells: { name: t(n.name), ...cellOf(n) },
      contra: n.is_contra ? ['debit', 'credit'].filter((c) => (c === 'debit' ? n.debit_minor : n.credit_minor) > 0) : [],
    };
    return [row, ...(parent ? treeRows(section, n.children, cellOf, [...ancestors, n.name]) : [])];
  });
}

/** A section total in its debit or credit column, parenthesised when it is
 * on the other side than normal. */
function totalCells(amountMinor: number, normal: 'debit' | 'credit'): { cells: Record<string, string>; contra: string[] } {
  const isNormal = amountMinor >= 0;
  const side = (normal === 'debit') === isNormal ? 'debit' : 'credit';
  const shown = amountMinor === 0 ? '' : isNormal ? money(Math.abs(amountMinor)) : `(${money(Math.abs(amountMinor))})`;
  return { cells: { [side]: shown }, contra: isNormal ? [] : [side] };
}

export const reports: Record<string, (c: Context, v: Values) => Promise<Report>> = {
  /** Every account with a balance, by currency, in its debit or credit column. */
  trialBalance: async (c, v) => {
    const tb = await getTrialBalance(asBusinessName(c.business), asLedgerName(c.ledger), v.asOfDate || undefined);
    const currencies = [...new Set(tb.rows.map((r) => r.currency))].sort((a, b) => (a ?? '').localeCompare(b ?? ''));
    const shown = (minor: number, currency: string | null) => (currency === null || !currency.startsWith('SPACE-') ? money(minor) : minor.toLocaleString());
    const groups: ReportGroup[] = currencies.map((currency) => {
      const sub = tb.by_currency.find((s) => s.currency === currency);
      return {
        title: currency ?? t('Home Currency'),
        warn: sub && !sub.balanced ? t('Out of balance') : undefined,
        rows: tb.rows.filter((r) => r.currency === currency).map((r) => ({
          key: String(r.id), depth: 0, ancestors: [], parent: false,
          cells: { number: r.accountnumber ?? '', name: t(r.name), debit: r.debit_minor ? shown(r.debit_minor, currency) : '', credit: r.credit_minor ? shown(r.credit_minor, currency) : '' },
          badge: r.has_quantity_postings ? t('qty') : undefined,
          badgeTitle: r.has_quantity_postings ? t('This account mixes a real quantity-tracking posting with an ordinary dollar posting - its balance may not be a plain dollar figure without a closer look.') : undefined,
        })),
        footer: { name: t('Subtotal'), debit: shown(sub?.total_debit_minor ?? 0, currency), credit: shown(sub?.total_credit_minor ?? 0, currency) },
      };
    });
    const balanced = tb.total_debit_minor === tb.total_credit_minor;
    return {
      columns: [{ groups }],
      status: groups.length === 1 ? { ok: balanced, text: balanced ? `\u2713 ${t('Balanced')}` : t('Out of balance') } : undefined,
      note: groups.length > 1 ? t("More than one currency is present - see each currency's own subtotal above; a single combined total across different currencies would not be a real number.") : undefined,
    };
  },
  /** Assets against liabilities and equity, each a tree of categories. */
  balanceSheet: async (c, v) => {
    const bs = await getBalanceSheet(asBusinessName(c.business), asLedgerName(c.ledger), v.asOfDate || undefined);
    const amount = (minor: number, contra: boolean) => (minor === 0 ? '' : contra ? `(${money(minor)})` : money(minor));
    const cellOf = (n: CategoryTreeNode) => ({ debit: amount(n.debit_minor, n.is_contra), credit: amount(n.credit_minor, n.is_contra) });
    const section = (title: string, nodes: CategoryTreeNode[], total: number, normal: 'debit' | 'credit', totalLabel: string): ReportGroup => {
      const tot = totalCells(total, normal);
      return { title: t(title), rows: treeRows(title, nodes, cellOf), footer: { name: t(totalLabel), ...tot.cells }, footerContra: tot.contra };
    };
    const [a, l, e] = [t('Assets'), t('Liabilities'), t('Equity')];
    return {
      columns: [
        { groups: [section('Assets', bs.assets_tree, bs.total_assets_minor, 'debit', 'Total Assets')] },
        {
          groups: [
            section('Liabilities', bs.liabilities_tree, bs.total_liabilities_minor, 'credit', 'Total Liabilities'),
            section('Equity', bs.equity_tree, bs.total_equity_minor, 'credit', 'Total Equity'),
          ],
          summary: { label: t('Total Liabilities + Equity'), value: money(bs.total_liabilities_minor + bs.total_equity_minor) },
        },
      ],
      status: { ok: bs.balanced, text: bs.balanced ? `\u2713 ${a} = ${l} + ${e}` : `${a} \u2260 ${l} + ${e}` },
    };
  },
};
