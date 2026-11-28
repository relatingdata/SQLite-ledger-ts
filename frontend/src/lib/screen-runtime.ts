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
import { formatAmount, formatDate } from '$lib/format';
import {
  getEntityTree,
  listItems,
  listLocations,
  postOnAccountInvoice,
  completeCashPurchase,
  completePosSale,
  transferItems,
  getItemLocation,
  listItemSources,
  stagePurchaseOrder,
  postPurchaseOrder,
  stageSalesOrder,
  stageOrderReceipt,
  postOrderReceipt,
  getOrderStatus,
  getTrialBalance,
  getBelowReorderStock,
  getStockOutRiskReport,
  listJournalEntries,
  getLedgers,
  getStockMovementReport,
  changeOwnPassword,
  getPeriodStatus,
  closePeriod,
  reopenPeriod,
  ApiError,
  setOwnPageSize,
  setOwnNumberFormat,
  setOwnDateFormat,
  getInventoryListingByLocation,
  setItemLocationLevels,
  type OrderReceiptRow,
  type StockTransferRow,
  type StockSaleRow,
  getTrialBalanceComparison,
  getProfitAndLossComparison,
  getAgedInvoices,
  getAgedSummary,
  getReminderCandidates,
  getCustomerStatement,
  getSalesReport,
  getHierarchy,
  hierarchiesOf,
  getCashFlowForecast,
  getBusinessConfigurationReport,
  sendReminder,
  resetReminder,
  getStorageSpaceReport,
  getBalanceSheet,
  type CategoryTreeNode,
  type ProfitAndLoss,
  type ProfitAndLossComparisonLine,
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
  previewCloseBooks,
  resolveRolloverLines,
  stageLine,
  postJournalEntry,
  createLedger,
  getReportingPeriods,
  type CloseBooksPreview,
  type ResolvedRollover,
  getConceptsWithAlternates,
  setVocabularyPreference,
  deleteVocabularyPreference,
  getBankAccounts,
  getCashPosition,
  registerBankAccount,
  unregisterBankAccount,
  createHierarchy,
  createHierarchyValue,
  deleteHierarchy,
  deleteHierarchyValue,
  getProductShapes,
  defineProductShape,
  listHierarchyPrototypes,
  saveHierarchyPrototype,
  createHierarchyFromPrototype,
  type HierarchyKind,
} from '$lib/api';
import { getCube, getAxes, getProfitAndLossByAxis, type ProfitAndLossByAxisNode } from '$lib/matrix-api';
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
  /** Shown under this heading (an optgroup on the web). */
  group?: string;
  /** For report axes: the side the axis is on (item or location). */
  side?: string;
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

const STOCK_BY_LOCATION = '\u0000location';
const STOCK_BY_PROVIDER = '\u0000provider';

/** Report axes as choices: Consolidated, then each axis that can group a
 * report (Item, Location and the business's hierarchies) under its own
 * heading, the whole axis first and then each of its values
 * ("Division::South Australia"). */
async function axisChoices(business: string, ledger: string): Promise<Choice[]> {
  let values: Record<string, string[]> = { Item: [], Location: [] };
  let groups: Record<string, string> = {};
  try {
    ({ values, groups } = await getAxes(business, ledger));
  } catch {
    // the whole axes still work without their values
  }
  const sideOf = (axis: string) => (axis === 'Item' ? 'item' : axis === 'Location' ? 'location' : groups[axis]);
  const axes = ['Item', ...Object.keys(values).filter((k) => !['Item', 'Location'].includes(k) && groups[k] === 'item'), 'Location', ...Object.keys(values).filter((k) => !['Item', 'Location'].includes(k) && groups[k] === 'location')];
  return [
    { value: 'Consolidated', label: 'Consolidated' },
    ...axes.flatMap((axis) => [
      { value: axis, label: axis, group: axis, side: sideOf(axis) },
      ...(values[axis] ?? []).map((v) => ({ value: `${axis}::${v}`, label: v, group: axis, side: sideOf(axis) })),
    ]),
  ];
}
const axisOf = (selection: string) => selection.split('::')[0];
/** Choices in their groups, in order: consecutive choices of one group
 * together; a choice with no group stands alone. */
export function groupsOf(choices: Choice[]): { label?: string; choices: Choice[] }[] {
  const out: { label?: string; choices: Choice[] }[] = [];
  for (const c of choices) {
    const last = out[out.length - 1];
    if (last && c.group && last.label === c.group) last.choices.push(c);
    else out.push({ label: c.group, choices: [c] });
  }
  return out;
}
/** The axes another axis can be nested with: those on the other side. */
const againstAxis = (choices: Choice[], other: string): Choice[] => {
  const side = choices.find((c) => c.value === axisOf(other))?.side;
  return choices.filter((c) => c.value === 'Consolidated' || !side || c.side !== side);
};

export const sources: Record<string, (business: string, ledger: string) => Promise<Choice[]>> = {
  /** Report axes (axisChoices). */
  axes: axisChoices,
  /** How a user's amounts can be written. */
  numberFormats: async () => ['1,000.00', '1 000.00', '1.000,00', '1000,00', "1'000.00", '1000.00'].map((f) => ({ value: f, label: f })),
  /** How a user's dates can be written. */
  dateFormats: async () => ['dd/mm/yyyy', 'mm/dd/yyyy', 'dd.mm.yyyy', 'dd-mm-yyyy', 'yyyy-mm-dd'].map((f) => ({ value: f, label: f })),
  /** What stock movements group by: the business's location hierarchies,
   * Location, Provider, then its item hierarchies. */
  stockGroupings: async (business) => {
    let hierarchies: { hierarchy: string; of?: string | null }[] = [];
    try {
      hierarchies = (await getHierarchy(business)).filter((g) => g.of);
    } catch {
      // grouping by location or provider still works
    }
    const named = (of: string) => hierarchies.filter((g) => g.of === of).map((g) => ({ value: g.hierarchy, label: g.hierarchy }));
    return [...named('Locations'), { value: STOCK_BY_LOCATION, label: 'Location' }, { value: STOCK_BY_PROVIDER, label: 'Provider' }, ...named('Items')];
  },
  /** The business's ledgers, the session's own first. */
  ledgers: async (business, ledger) =>
    (await getLedgers(asBusinessName(business)))
      .map((l) => l.name)
      .sort((a, b) => (a === ledger ? -1 : b === ledger ? 1 : 0))
      .map((name) => ({ value: name, label: name })),
  /** The business's reporting periods, from its financial-year start and
   * reporting frequency (none when it has not stored them). */
  reportingPeriods: async (business) => {
    try {
      return (await getReportingPeriods(asBusinessName(business))).map((p) => ({ value: p.label, label: `${p.label} (${t('ends')} ${p.endDate})` }));
    } catch {
      return [];
    }
  },
  /** The postable asset accounts not yet registered as bank accounts. */
  bankAccountCandidates: async (business, ledger) => {
    const [entities, registered] = await Promise.all([getEntityTree(), getBankAccounts(asBusinessName(business), asLedgerName(ledger))]);
    const byId = new Map(entities.map((e) => [e.id, e]));
    const underAsset = (e: EntityNode | undefined): boolean => !!e && (e.name === 'Asset' || underAsset(e.parent_id !== null ? byId.get(e.parent_id) : undefined));
    const taken = new Set(registered.map((a) => a.name));
    return entities.filter((e) => e.is_postable_account && underAsset(e) && !taken.has(e.name)).map((e) => ({ value: e.name, label: e.name }));
  },
  /** What a bank account can belong to: the business, or any group of its
   * locations. */
  bankScopes: async (business) => {
    let groups: string[] = [];
    try {
      groups = hierarchiesOf(await getHierarchy(asBusinessName(business)), 'Locations').flatMap((h) => h.values);
    } catch {
      // the business itself is still a scope
    }
    return [business, ...groups].map((name) => ({ value: name, label: name }));
  },
  /** The saved hierarchy prototypes: what each groups and how many values. */
  hierarchyPrototypes: async () =>
    (await listHierarchyPrototypes()).map((p) => ({ value: p.prototype, label: `${t(p.prototype)} (${t(p.of === 'Items' ? 'Of items' : 'Of locations')}, ${p.values})` })),
  /** The postable accounts under Equity, Owner's Equity first. */
  equityAccounts: async () => {
    const entities = await getEntityTree();
    const byId = new Map(entities.map((e) => [e.id, e]));
    const underEquity = (e: EntityNode | undefined): boolean => !!e && (e.name === 'Equity' || underEquity(e.parent_id !== null ? byId.get(e.parent_id) : undefined));
    return entities
      .filter((e) => e.is_postable_account && underEquity(e))
      .sort((a, b) => (a.name === "Owner's Equity" ? -1 : b.name === "Owner's Equity" ? 1 : 0))
      .map((e) => ({ value: e.name, label: e.name }));
  },
  /** The business's hierarchies of its items, by name. */
  itemHierarchies: async (business) => named(hierarchiesOf(await getHierarchy(business), 'Items').map((g) => ({ name: g.hierarchy }))),
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
  /** Every ledger but the one chosen as ledger A. */
  otherThanLedgerA: (choices, v) => choices.filter((c) => c.value !== v.ledgerA),
  /** The axes the inner axis allows: on the other side from it. */
  againstInner: (choices, v) => againstAxis(choices, v.innerAxis ?? ''),
  /** The axes the outer axis allows: on the other side from it. */
  againstOuter: (choices, v) => againstAxis(choices, v.outerAxis ?? ''),
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

/** An axis no longer allowed beside the one just chosen goes back to
 * Consolidated. */
async function keepAxesApart(c: Context, v: Values, changed: 'outerAxis' | 'innerAxis'): Promise<Patch> {
  const other = changed === 'outerAxis' ? 'innerAxis' : 'outerAxis';
  if (!v[other] || v[other] === 'Consolidated') return {};
  const choices = await axisChoices(c.business, c.ledger);
  const sideOf = (sel: string) => choices.find((ch) => ch.value === axisOf(sel))?.side;
  return sideOf(v[changed]) && sideOf(v[changed]) === sideOf(v[other]) ? { values: { [other]: 'Consolidated' } } : {};
}

export const reactions: Record<string, (c: Context, v: Values) => Promise<Patch>> = {
  /** A reporting period chosen: the as-of date becomes its end, and a new
   * ledger not yet named is named "Actual <period>". */
  periodChosen: async (c, v) => {
    const period = (await getReportingPeriods(asBusinessName(c.business))).find((p) => p.label === v.period);
    if (!period) return {};
    return { values: { asOfDate: period.endDate, ...(!v.newLedger && !(v.newLedgerName ?? '').trim() ? { newLedgerName: `Actual ${period.label}` } : {}) } };
  },
  /** Ledger A changed: ledger B, if empty or now the same, becomes the
   * first other ledger. */
  ledgerAChanged: async (c, v) => {
    if (v.ledgerB && v.ledgerB !== v.ledgerA) return {};
    const other = (await getLedgers(asBusinessName(c.business))).find((l) => l.name !== v.ledgerA);
    return { values: { ledgerB: other?.name ?? '' } };
  },
  /** The outer axis changed: the inner one stays only on the other side. */
  outerAxisChanged: (c, v) => keepAxesApart(c, v, 'outerAxis'),
  /** The inner axis changed: the outer one stays only on the other side. */
  innerAxisChanged: (c, v) => keepAxesApart(c, v, 'innerAxis'),
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

/** An on-account invoice (AP or AR) with its stock movement, posted in one
 * backend transaction (postOnAccountInvoice). */
async function onAccount(kind: 'AP' | 'AR', c: Context, v: Values, lines: Line[], counterparty: string, location: string, account: string, taxAccount: string): Promise<void> {
  if (!v.reference?.trim() || !counterparty || (kind === 'AP' && !account) || lines.length === 0) {
    throw new Invalid(kind === 'AP' ? 'Reference, provider, account, and at least one item line are all required.' : 'Reference, customer, and at least one item line are all required.');
  }
  if ((await stockLines(c.business, lines)).length > 0 && !location) {
    throw new Invalid(kind === 'AP' ? 'Select a location — these items will be received into stock.' : 'Select a location — these items will be dispatched from stock.');
  }
  const taxOf = lineTaxAt(v);
  await postOnAccountInvoice({
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
    locationName: location ? asLocationName(location) : undefined,
    revenueOrExpenseAccount: account,
    taxAccount,
  });
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
    // One call, as every other caller makes it: the stock and, at its
    // first-in-first-out cost, its value move together.
    await transferItems({ business, ledger, itemName: asItemName(v.item), fromLocationName: asLocationName(v.fromLocation), toLocationName: asLocationName(v.toLocation), quantity, reference: v.reference });
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
/** What a list screen lists; a detail list's records are those of the
 * row selected in its parent list (parent). */
export const records: Record<string, (c: Context, parent?: Row) => Promise<Row[]>> = {
  /** The business's hierarchies: hierarchy (its name), name (as shown),
   * of (Items or Locations, or none for the application's own), and
   * detail: what it groups and how many values it has. */
  hierarchies: async (c) =>
    (await getHierarchy(asBusinessName(c.business))).map((g) => ({
      hierarchy: g.hierarchy,
      name: t(g.hierarchy),
      of: g.of ?? '',
      detail: `(${g.of ? `${t(g.of)}, ` : ''}${g.values.length})`,
    })),
  /** The values of the hierarchy selected (parent.hierarchy). */
  hierarchyValues: async (c, parent) =>
    ((await getHierarchy(asBusinessName(c.business))).find((g) => g.hierarchy === parent?.hierarchy)?.values ?? []).map((v) => ({
      value: v,
      name: t(v),
      hierarchy: parent?.hierarchy ?? '',
    })),
  /** The registered bank accounts: account (its name), name (as shown),
   * scope, currency, balance and overdraft limit. */
  bankAccounts: async (c) =>
    (await getBankAccounts(asBusinessName(c.business), asLedgerName(c.ledger))).map((a) => ({
      account: a.name,
      name: t(a.name),
      scope: a.scope,
      currency: a.currency ?? '',
      balance: amount(a.balance_minor),
      overdraft: a.overdraft_limit_minor === null ? '\u2014' : amount(a.overdraft_limit_minor),
    })),
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
  /** Deletes a hierarchy (row.hierarchy). */
  deleteHierarchy: async (c, row) => {
    await deleteHierarchy(c.business, row.hierarchy);
    return '';
  },
  /** Deletes a value (row.value) of its hierarchy (row.hierarchy). */
  deleteHierarchyValue: async (c, row) => {
    await deleteHierarchyValue(c.business, row.hierarchy, row.value);
    return '';
  },
  /** Unregisters a bank account (row.account); the account itself stays. */
  unregisterBankAccount: async (_c, row) => {
    await unregisterBankAccount(row.account);
    return '';
  },
  sendReminder: async (_c, row) => {
    const { new_level } = await sendReminder(row.party);
    return `Sent level ${new_level} reminder to ${row.party}.`;
  },
  resetReminder: async (_c, row) => {
    await resetReminder(row.party);
    return `Reset reminder level for ${row.party}.`;
  },
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
  /** A class for the whole line, and classes for single cells. */
  mark?: string;
  marks?: Record<string, string>;
  /** A small tag after the first cell, with its explanation. */
  badge?: string;
  badgeTitle?: string;
}
export interface ReportGroup {
  title: string;
  /** Which of the screen's tables shows it (its entries' Table); none: the default. */
  table?: string;
  /** Lines shown above the table (who and when, on a statement). */
  meta?: { label: string; value: string }[];
  /** Column headings that differ from the configured labels, by entry name. */
  labels?: Record<string, string>;
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
/** A section of a drillable report: a heading line with its figure, which
 * opens to show its table (rows, as a group's) and the sections under it. */
export interface ReportSection {
  key: string;
  name: string;
  figure: string;
  /** More figures after the first (a quantity, then an amount). */
  figures?: string[];
  negative?: boolean;
  open?: boolean;
  rows: ReportRow[];
  /** The table's columns; none: an account (a tree), its debit and credit.
   * An `input` column is a number field: changing it calls `save`. */
  columns?: { name: string; label: string; numeric?: boolean; input?: boolean }[];
  /** Saves a row's changed cells (an input column's value), throwing an
   * Error whose message the row shows. */
  save?: (row: ReportRow, cells: Record<string, string>) => Promise<void>;
  /** The heading's class, in place of axis-head and group-head. */
  headClass?: string;
  /** A detail beside the name (a location's city). */
  detail?: string;
  /** Tags beside the name (a warning). */
  tags?: { text: string; class: string; title?: string }[];
  /** A line under the table (rows left out, say). */
  note?: string;
  children: ReportSection[];
}
export interface Report {
  columns: ReportColumn[];
  /** A drillable report's sections (Template=drill), and its total line. */
  sections?: ReportSection[];
  /** Shown instead of the sections (why there are none to show). */
  message?: string;
  grandTotal?: { label: string; value: string; negative: boolean };
  /** For a report paged on the server (Paged=server): how many rows in all. */
  total?: number;
  /** A title and intro that differ from the screen's, for these parameters. */
  title?: string;
  intro?: string;
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

/** A Profit and Loss statement as rows: income, then costs of goods sold,
 * then other operating expenses, each a tree of accounts with its total,
 * then the profit or loss. Rows marked section-head, rule-row or
 * heavy-rule-row are one cell across the table. */
function statementRows(key: string, pl: ProfitAndLoss): ReportRow[] {
  const cellOf = (n: CategoryTreeNode) => ({ debit: n.debit_minor === 0 ? '' : n.is_contra ? `(${money(n.debit_minor)})` : money(n.debit_minor), credit: n.credit_minor === 0 ? '' : n.is_contra ? `(${money(n.credit_minor)})` : money(n.credit_minor) });
  const rule = (k: string, heavy = true): ReportRow => line(`${key}/${k}`, {}, { mark: heavy ? 'heavy-rule-row' : 'rule-row' });
  const part = (k: string, title: string, nodes: CategoryTreeNode[], totalCells: Record<string, string>, last: boolean): ReportRow[] => {
    const rows = treeRows(`${key}/${k}`, nodes, cellOf);
    return [
      line(`${key}/${k}/head`, { name: t(title) }, { mark: 'section-head' }),
      rule(`${k}/top`),
      ...(rows.length > 0 ? rows : [line(`${key}/${k}/none`, { name: t('None') }, { mark: 'empty' })]),
      rule(`${k}/bottom`),
      line(`${key}/${k}/total`, { name: t('Total'), ...totalCells }, { mark: 'total-row' }),
      ...(last ? [] : [rule(`${k}/gap`, false)]),
    ];
  };
  const cost = (lines: { debit_minor: number; credit_minor: number }[]) => money(lines.reduce((sum, l) => sum + l.debit_minor - l.credit_minor, 0));
  const net = pl.net_income_minor;
  return [
    ...part('income', 'Income from Retail Sales of Goods', pl.income_tree, { credit: money(pl.total_income_minor) }, false),
    ...part('cogs', 'Less Costs of Goods Sold', pl.cogs_tree, { debit: cost(pl.cogs_expenses) }, false),
    ...part('operating', 'Less Other Direct Operating Expenses', pl.operating_expenses_tree, { debit: cost(pl.operating_expenses) }, true),
    rule('net/top'),
    line(`${key}/net`, { name: t('Total Profit/(Loss)'), credit: net < 0 ? `(${money(-net)})` : money(net) }, { mark: net < 0 ? 'grand-total-row negative' : 'grand-total-row' }),
    rule('net/bottom'),
  ];
}

/** A section total in its debit or credit column, parenthesised when it is
 * on the other side than normal. */
function totalCells(amountMinor: number, normal: 'debit' | 'credit'): { cells: Record<string, string>; contra: string[] } {
  const isNormal = amountMinor >= 0;
  const side = (normal === 'debit') === isNormal ? 'debit' : 'credit';
  const shown = amountMinor === 0 ? '' : isNormal ? money(Math.abs(amountMinor)) : `(${money(Math.abs(amountMinor))})`;
  return { cells: { [side]: shown }, contra: isNormal ? [] : [side] };
}

const line = (key: string, cells: Record<string, string>, more: Partial<ReportRow> = {}): ReportRow => ({ key, depth: 0, ancestors: [], parent: false, cells, ...more });
/** A count in the user's number format (no decimals). */
const units = (n: number) => n.toLocaleString(auth.current?.user.number_format?.includes(',') ? 'de-DE' : 'en-US');
const count = (n: number | null | undefined) => (n == null ? '' : String(n));

const reminderLevel = (l: number) => t(l === 0 ? 'None sent' : l === 1 ? 'Level 1 (polite)' : l === 2 ? 'Level 2' : 'Level 3 (firm)');

export const reports: Record<string, (c: Context, v: Values) => Promise<Report>> = {
  /** What is outstanding per customer or provider (side), as a summary or
   * invoice by invoice (view), against each account's own terms. */
  aged: async (c, v) => {
    const side = v.side === 'AP' ? 'AP' : 'AR';
    const [business, ledger] = [asBusinessName(c.business), asLedgerName(c.ledger)];
    const labels = { party: t(side === 'AR' ? 'Customer' : 'Provider') };
    const rows: ReportRow[] = v.view === 'detail'
      ? (await getAgedInvoices(business, ledger, side, v.asOfDate || undefined)).map((r) => line(String(r.invoice_id),
          { reference: r.reference, party: r.counterparty, due: r.due_date ?? '', outstanding: money(r.outstanding_minor), days: String(r.days_overdue), bucket: r.bucket }))
      : (await getAgedSummary(business, ledger, side, v.asOfDate || undefined)).map((r) => line(r.counterparty,
          { party: r.counterparty, outstanding: money(r.outstanding_minor), days: String(r.oldest_days_overdue) }));
    return {
      title: t(side === 'AR' ? 'Aged Receivables' : 'Aged Payables'),
      intro: t(`What's outstanding, bucketed against each ${side === 'AR' ? 'customer' : 'provider'}'s own payment terms \u2014 not a fixed 30/60/90 for everyone, since account management practice genuinely varies per account.`),
      columns: [{ groups: [{ title: '', table: v.view === 'detail' ? 'detail' : '', labels, rows }] }],
    };
  },
  /** Everything the business's setup captured, section by section. */
  businessConfiguration: async (c) => {
    const r = await getBusinessConfigurationReport(c.business);
    const lines = (title: string, texts: string[]): ReportGroup => ({ title: t(title), table: 'lines', rows: texts.map((text, i) => line(String(i), { text })) });
    return { columns: [{ groups: [
      lines('Business Name', [r.businessName]),
      lines('Addresses', r.addresses.map((a) => `${a.address_type}: ${a.address1 ?? ''} ${a.city ?? ''}`)),
      lines('Phones', r.phones.map((p) => `${p.phone_type}: ${p.phone ?? ''}`)),
      lines('Owner(s) / Partner(s)', r.ownerOrPartners),
      { title: t('Banking Details'), table: 'banks', rows: r.bankAccounts.map((b) => line(b.name, { name: b.name, routing: b.routingDetail, number: b.accountNumber })) },
      lines('Currencies', [`${t('Home currency')}: ${r.homeCurrency ?? '\u2014'}`, ...(r.secondaryCurrencies.length > 0 ? [`${t('Also trades in')}: ${r.secondaryCurrencies.join(', ')}`] : [])]),
      lines('Hierarchies', r.hierarchies.map((h) => `${t(h.hierarchy)}${h.of ? ` (${t(h.of)})` : ''}: ${h.values.length > 0 ? h.values.join(', ') : t('None recorded.')}`)),
      { title: t('Locations'), table: 'locations', rows: r.locations.map((l) => line(l.name, { name: l.name, city: l.city, type: l.locationType })) },
      lines('Products', r.products),
      lines('Notes to the Financial Statements', r.notes.map((n) => n.text)),
    ] }] };
  },
  /** Cash projected forward: outstanding invoices on their due dates and
   * recurring movements on their schedules, against the overdraft limit. */
  cashFlow: async (c, v) => {
    const f = await getCashFlowForecast(asBusinessName(c.business), asLedgerName(c.ledger), v.asOfDate || undefined, Number(v.horizon) || 90);
    let running = f.starting_cash_minor;
    return {
      columns: [{ groups: [{
        title: t('Anticipated movements'),
        meta: [
          { label: t('Starting cash'), value: money(f.starting_cash_minor) },
          { label: t('Projected ending cash'), value: money(f.ending_cash_minor) },
          { label: t('Lowest projected balance'), value: `${money(f.lowest_projected_balance_minor)} (${f.lowest_balance_date})` },
          { label: t('Overdraft limit'), value: f.overdraft_limit_minor === null ? '\u2014' : money(f.overdraft_limit_minor) },
        ],
        rows: f.lines.map((l, i) => {
          running += l.amount_minor;
          return line(String(i), { date: l.date, description: l.description, source: l.source, amount: money(l.amount_minor), balance: money(running) },
            { marks: running < 0 ? { balance: 'warn' } : undefined });
        }),
      }] }],
      status: f.first_shortfall_date !== null
        ? { ok: false, text: `${t('Projected shortfall')}: ${t('Cash is projected to fall below your arranged overdraft limit on')} ${f.first_shortfall_date}, ${t('by')} ${money(f.first_shortfall_amount_minor ?? 0)}.` }
        : f.overdraft_limit_minor !== null
          ? { ok: true, text: t('No shortfall projected \u2014 cash stays within your arranged overdraft limit throughout this horizon.') }
          : undefined,
    };
  },
  /** Every posted sale in a period, summed by an item hierarchy (or by
   * item when the business has none) or line by line (view). */
  sales: async (c, v) => {
    const r = await getSalesReport(asBusinessName(c.business), asLedgerName(c.ledger), v.fromDate || undefined, v.toDate || undefined, v.hierarchy || undefined);
    const rows: ReportRow[] = v.view === 'detailed'
      ? r.detailed.map((l, i) => line(String(i), {
          date: l.invoice_date, reference: l.reference, item: l.item_name ?? l.description, quantity: count(l.quantity),
          unitPrice: l.unit_price_minor != null ? money(l.unit_price_minor) : '', amount: money(l.amount_minor),
        }))
      : r.group_summary.map((cs) => line(cs.group, {
          group: cs.group, quantity: String(cs.quantity), amount: money(cs.amount_minor),
          share: `${r.total_amount_minor > 0 ? ((cs.amount_minor / r.total_amount_minor) * 100).toFixed(1) : '0.0'}%`,
        }));
    return { columns: [{
      groups: [{ title: '', table: v.view === 'detailed' ? 'detailed' : '', rows, labels: { group: t(r.hierarchy ?? 'Item') } }],
      summary: { label: t('Total'), value: `${r.total_quantity} ${t('units')}, ${money(r.total_amount_minor)}` },
    }] };
  },
  /** Every posted invoice of one customer as of a date, paid or not. */
  statement: async (c, v) => {
    if (!v.customer) return { columns: [{ groups: [] }] };
    const st = await getCustomerStatement(asBusinessName(c.business), asLedgerName(c.ledger), v.customer, v.asOfDate || undefined);
    return { columns: [{ groups: [{
      title: t('Statement of Account'),
      meta: [{ label: t('Business'), value: c.business }, { label: t('Customer'), value: st.customer }, { label: t('As of'), value: st.as_of_date }],
      rows: st.lines.map((l) => line(String(l.invoice_id), {
        reference: l.reference, date: l.invoice_date, due: l.due_date ?? '', total: money(l.total_minor), paid: money(l.paid_minor), outstanding: money(l.outstanding_minor), status: t(l.status),
      })),
      footer: { reference: t('Total outstanding'), outstanding: money(st.total_outstanding_minor) },
    }] }] };
  },
  /** Customers overdue now, with the reminder level each has reached. */
  reminders: async (c, v) => ({
    columns: [{ groups: [{
      title: '',
      rows: (await getReminderCandidates(asBusinessName(c.business), asLedgerName(c.ledger), v.asOfDate || undefined)).map((r) => line(r.counterparty, {
        party: r.counterparty, outstanding: money(r.outstanding_minor), days: String(r.oldest_days_overdue),
        level: reminderLevel(r.current_level), next: reminderLevel(r.next_level), status: r.current_level > 0 ? 'sent' : 'none',
      })),
    }] }],
  }),
  /** Every item at every location at or below its reorder level; critical
   * when at or below its minimum. */
  belowReorder: async () => {
    const rows = await getBelowReorderStock();
    return { columns: [{
      groups: rows.length === 0 ? [] : [{
        title: '',
        rows: rows.map((r, i) => line(String(i),
          { item: r.item, location: r.location, onHand: count(r.quantity_on_hand), reorder: count(r.reorder_level), min: count(r.min_level), max: count(r.max_level) },
          { mark: r.min_level != null && r.quantity_on_hand <= r.min_level ? 'critical' : undefined })),
      }],
    }] };
  },
  /** Stock's journey over a period: purchases received, transfers or
   * sales (movement), grouped by a hierarchy, location or provider
   * (groupBy), each group showing its quantity (and a sale's amount) and
   * opening to its first 100 rows. */
  stockMovement: async (c, v) => {
    const report = await getStockMovementReport(asBusinessName(c.business), asLedgerName(c.ledger), v.fromDate || undefined, v.toDate || undefined);
    let itemHierarchies: string[] = [];
    try {
      itemHierarchies = (await getHierarchy(c.business)).filter((g) => g.of === 'Items').map((g) => g.hierarchy);
    } catch {
      // only Location and item hierarchies can group transfers
    }
    const movement = v.movement || 'receipts';
    const groupBy = v.groupBy || STOCK_BY_LOCATION;
    if (movement === 'transfers' && groupBy !== STOCK_BY_LOCATION && !itemHierarchies.includes(groupBy)) {
      return { columns: [], sections: [], message: t('A transfer is between two locations: group transfers by Location or by a hierarchy of the items.') };
    }
    type Row = OrderReceiptRow | StockTransferRow | StockSaleRow;
    const keyOf = (row: Row): string => {
      if (groupBy === STOCK_BY_LOCATION) return 'from_location' in row ? row.to_location : row.location;
      if (groupBy === STOCK_BY_PROVIDER) return ('vendor' in row ? row.vendor : null) ?? '(No provider on file)';
      return row.hierarchyValues[groupBy] ?? `(${t('No')} ${t(groupBy)})`;
    };
    const rows: Row[] = movement === 'transfers' ? report.transfers : movement === 'sales' ? report.sales : report.receipts;
    const amount = (minor: number) => (minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const columns = [
      { name: 'item', label: t('Item') },
      { name: 'date', label: t('Date') },
      ...(movement === 'receipts' ? [{ name: 'location', label: t('Location') }, { name: 'provider', label: t('Provider') }]
        : movement === 'transfers' ? [{ name: 'from', label: t('From') }, { name: 'to', label: 'To' }]
        : [{ name: 'location', label: t('Location') }]),
      { name: 'quantity', label: t('Qty'), numeric: true },
      ...(movement === 'sales' ? [{ name: 'amount', label: t('Amount'), numeric: true }] : []),
    ];
    const groups = new Map<string, Row[]>();
    for (const row of rows) groups.set(keyOf(row), [...(groups.get(keyOf(row)) ?? []), row]);
    const sections = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, members]): ReportSection => {
      const quantity = members.reduce((sum, r) => sum + r.quantity, 0);
      const total = members.reduce((sum, r) => sum + ('amount_minor' in r ? r.amount_minor : 0), 0);
      return {
        key: name,
        name: t(name),
        figure: quantity.toLocaleString(),
        figures: movement === 'sales' ? [amount(total)] : [],
        columns,
        rows: members.slice(0, 100).map((r, i) => line(`${name}/${i}`, {
          item: r.item, date: r.date, quantity: r.quantity.toLocaleString(),
          ...('from_location' in r ? { from: r.from_location, to: r.to_location } : { location: r.location }),
          ...('vendor' in r && !('amount_minor' in r) ? { provider: r.vendor ?? '\u2014' } : {}),
          ...('amount_minor' in r ? { amount: amount(r.amount_minor) } : {}),
        })),
        note: members.length > 100 ? `Showing the first 100 of ${members.length} real rows \u2014 narrow the date range or group by a finer dimension to see the rest.` : undefined,
        children: [],
      };
    });
    return { columns: [], sections, message: sections.length === 0 ? `No ${movement} in the selected period.` : undefined };
  },
  /** Every item at every location that carries stock, grouped by the
   * business's first location hierarchy, then by location: each item's
   * quantity on hand, and its min, max and reorder levels, which save as
   * they are changed. A location over its capacity is tagged so. */
  inventoryListing: async (c) => {
    let hierarchy: string | undefined;
    try {
      hierarchy = hierarchiesOf(await getHierarchy(c.business), 'Locations')[0]?.hierarchy;
    } catch {
      // the listing still works without its groups
    }
    const locations = await getInventoryListingByLocation(c.business, hierarchy);
    const NO_GROUP = '\u0000none';
    const byGroup = new Map<string, typeof locations>();
    for (const l of locations) byGroup.set(l.group ?? NO_GROUP, [...(byGroup.get(l.group ?? NO_GROUP) ?? []), l]);
    const level = (n: number | null) => (n == null ? '' : String(n));
    const columns = [
      { name: 'item', label: t('Item') },
      { name: 'onHand', label: t('On hand'), numeric: true },
      { name: 'min', label: t('Min'), numeric: true, input: true },
      { name: 'max', label: t('Max'), numeric: true, input: true },
      { name: 'reorder', label: t('Reorder level'), numeric: true, input: true },
    ];
    const toLevel = (text: string) => (text.trim() === '' ? null : Number(text));
    const save = async (row: ReportRow, cells: Record<string, string>) => {
      await setItemLocationLevels(asItemName(cells.item), asLocationName(cells.location),
        { minLevel: toLevel(cells.min), maxLevel: toLevel(cells.max), reorderLevel: toLevel(cells.reorder) }, c.business, c.ledger);
    };
    const sections = [...byGroup.entries()]
      .sort(([a], [b]) => (a === NO_GROUP ? 1 : b === NO_GROUP ? -1 : a.localeCompare(b)))
      .map(([group, locs]): ReportSection => ({
        key: group,
        name: group === NO_GROUP ? t('No group') : group,
        figure: locs.reduce((sum, l) => sum + l.total_on_hand, 0).toLocaleString(),
        rows: [],
        children: locs.map((l): ReportSection => ({
          key: `${group}/${l.location}`,
          name: l.location,
          headClass: 'location-head',
          detail: l.city ?? undefined,
          tags: l.capacity.bottleOverCapacity || l.capacity.cartonOverCapacity ? [{ text: t('Over capacity'), class: 'capacity-warning', title: 'Over its own, real configured capacity' }] : [],
          figure: l.total_on_hand.toLocaleString(),
          columns,
          save,
          rows: l.rows.map((r) => line(`${l.location}/${r.item}`,
            { item: r.item, location: r.location, onHand: String(r.quantity_on_hand), min: level(r.min_level), max: level(r.max_level), reorder: level(r.reorder_level) },
            { mark: r.reorder_level != null && r.quantity_on_hand <= r.reorder_level ? 'below' : undefined })),
          children: [],
        })),
      }));
    return { columns: [], sections };
  },
  /** Two ledgers side by side (ledgerA, ledgerB): their Profit and Loss
   * with each line's variance, and their Trial Balances. */
  compareLedgers: async (c, v) => {
    if (!v.ledgerA || !v.ledgerB) return { columns: [] };
    const business = asBusinessName(c.business);
    const [tb, pl] = await Promise.all([getTrialBalanceComparison(business, v.ledgerA, v.ledgerB), getProfitAndLossComparison(business, v.ledgerA, v.ledgerB)]);
    const net = (minor: number) => (minor < 0 ? `(${money(Math.abs(minor))})` : money(minor));
    const sign = (minor: number) => (minor > 0 ? 'amount-credit' : minor < 0 ? 'amount-debit' : '');
    // A variance is favourable when income is above, or expenses below, ledger B.
    const plLine = (l: ProfitAndLossComparisonLine, favourable: number) => line(`pl/${l.name}`,
      { name: t(l.name), a: net(l.a_minor), b: net(l.b_minor), variance: favourable < 0 ? `(${money(Math.abs(l.variance_minor))})` : money(Math.abs(l.variance_minor)) },
      { marks: { a: l.a_minor < 0 ? 'amount-debit' : '', b: l.b_minor < 0 ? 'amount-debit' : '', variance: sign(favourable) } });
    const heading = (key: string, name: string) => line(`pl/${key}`, { name: t(name) }, { mark: 'group-heading' });
    const amount = (minor: number) => (minor ? money(minor) : '');
    const groups: ReportGroup[] = [
          {
            title: `${t('Profit and Loss Statement')} \u2014 ${pl.ledgerA} vs ${pl.ledgerB}`,
            table: 'pl',
            labels: { a: pl.ledgerA, b: pl.ledgerB },
            rows: [
              heading('income', 'Income'),
              ...pl.income.map((l) => plLine(l, l.variance_minor)),
              heading('expenses', 'Expenses'),
              ...pl.expenses.map((l) => plLine(l, -l.variance_minor)),
            ],
            footer: { name: t('Net income'), a: net(pl.a_net_income_minor), b: net(pl.b_net_income_minor),
              variance: pl.net_income_variance_minor < 0 ? `(${money(Math.abs(pl.net_income_variance_minor))})` : money(Math.abs(pl.net_income_variance_minor)) },
          },
          {
            title: `${t('Trial Balance')} \u2014 ${tb.ledgerA} vs ${tb.ledgerB}`,
            table: 'tb',
            labels: { aDebit: `${tb.ledgerA} ${t('Debit')}`, aCredit: `${tb.ledgerA} ${t('Credit')}`, bDebit: `${tb.ledgerB} ${t('Debit')}`, bCredit: `${tb.ledgerB} ${t('Credit')}` },
            rows: tb.rows.map((r) => line(`tb/${r.id}`,
              { name: t(r.name), aDebit: amount(r.a_debit_minor), aCredit: amount(r.a_credit_minor), bDebit: amount(r.b_debit_minor), bCredit: amount(r.b_credit_minor) },
              { marks: { aDebit: 'amount-debit', aCredit: 'amount-credit', bDebit: 'amount-debit', bCredit: 'amount-credit' } })),
          },
    ];
    return { columns: [{ groups }] };
  },
  /** Profit and Loss by two nested axes (outerAxis, innerAxis; either one
   * narrowed to one value as "Axis::value"), over an optional period. */
  profitAndLossByAxis: async (c, v) => {
    const [outer, outerFilter] = (v.outerAxis || 'Consolidated').split('::');
    const [inner, innerFilter] = (v.innerAxis || 'Consolidated').split('::');
    const nodes = await getProfitAndLossByAxis(c.business, c.ledger, outer, inner, v.fromDate || undefined, v.toDate || undefined, outerFilter, innerFilter);
    const signed = (minor: number) => (minor < 0 ? `(${money(-minor)})` : money(minor));
    const section = (n: ProfitAndLossByAxisNode, path: string, open: boolean): ReportSection => ({
      key: `${path}/${n.key}`,
      name: n.key,
      figure: signed(n.profitAndLoss.net_income_minor),
      negative: n.profitAndLoss.net_income_minor < 0,
      open,
      rows: n.profitAndLoss.total_income_minor !== 0 || n.profitAndLoss.total_expenses_minor !== 0 ? statementRows(`${path}/${n.key}`, n.profitAndLoss) : [],
      children: n.children.map((child) => section(child, `${path}/${n.key}`, false)),
    });
    const total = nodes.reduce((sum, n) => sum + n.profitAndLoss.net_income_minor, 0);
    return {
      columns: [],
      sections: nodes.map((n) => section(n, '', outer === 'Consolidated')),
      grandTotal: { label: t('Total Profit/(Loss)'), value: signed(total), negative: total < 0 },
    };
  },
  /** The ledger's journal entries, a page at a time (Paged=server), each
   * linked to the entry by its id and date, a recurring one marked. */
  journalEntries: async (c, v) => {
    const page = await listJournalEntries(asBusinessName(c.business), asLedgerName(c.ledger), Number(v.limit || 100), Number(v.offset || 0));
    return {
      total: page.totalCount,
      columns: [{
        groups: page.rows.length === 0 ? [] : [{
          title: '',
          rows: page.rows.map((tx) => line(`${tx.journal_id}/${tx.occurrence_date}`,
            { date: tx.occurrence_date ?? '', reference: tx.reference, id: String(tx.journal_id), description: tx.description,
              debit: money(tx.total_debit_minor), credit: money(tx.total_credit_minor) },
            { badge: tx.recurrence !== 'once' ? tx.recurrence : undefined, marks: { debit: 'amount-debit', credit: 'amount-credit' } })),
        }],
      }],
    };
  },
  /** Every item on track to run out before an order placed today could
   * arrive: its recent daily use against the shortest provider lead time. */
  stockOutRisk: async () => {
    const rows = await getStockOutRiskReport(2);
    return { columns: [{
      groups: rows.length === 0 ? [] : [{
        title: '',
        rows: rows.map((r, i) => line(String(i),
          { item: r.item, location: r.location, onHand: count(r.quantity_on_hand), dailyUse: r.daily_consumption_rate.toFixed(1),
            daysLeft: r.days_until_stockout?.toFixed(1) ?? '', leadTime: count(r.shortest_lead_time_days) },
          { mark: 'critical' })),
      }],
    }] };
  },
  /** Each location's storage space per storage unit. */
  storageSpace: async () => ({
    columns: [{
      groups: (await getStorageSpaceReport()).map((g) => ({
        title: g.location,
        rows: g.currencies.map((c) => line(`${g.location}/${c.currency}`,
          { unit: c.currency.replace(/^SPACE-/, ''), installed: units(Math.abs(c.installed_minor)), occupied: units(c.occupied_minor), remaining: units(c.remaining_minor),
            balanced: c.balanced ? t('Yes') : t('No \u2014 real mismatch') },
          { marks: { balanced: c.balanced ? 'ok' : 'warn' } })),
      })),
    }],
  }),
  /** Every account with a balance, by currency, in its debit or credit column. */
  trialBalance: async (c, v) => {
    const tb = await getTrialBalance(asBusinessName(c.business), asLedgerName(c.ledger), v.asOfDate || undefined);
    const currencies = [...new Set(tb.rows.map((r) => r.currency))].sort((a, b) => (a ?? '').localeCompare(b ?? ''));
    const shown = (minor: number, currency: string | null) => (currency === null || !currency.startsWith('SPACE-') ? money(minor) : minor.toLocaleString());
    const groups: ReportGroup[] = currencies.map((currency) => {
      const sub = tb.by_currency.find((s) => s.currency === currency);
      return {
        title: currency ?? t('Home currency'),
        warn: sub && !sub.balanced ? t('Out of balance') : undefined,
        rows: tb.rows.filter((r) => r.currency === currency).map((r) => ({
          key: String(r.id), depth: 0, ancestors: [], parent: false,
          cells: { number: r.accountnumber ?? '', name: t(r.name), debit: r.debit_minor ? shown(r.debit_minor, currency) : '', credit: r.credit_minor ? shown(r.credit_minor, currency) : '' },
          badge: r.has_quantity_postings ? t('Qty') : undefined,
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

// --- pivots --------------------------------------------------------------------

/** One cell of a pivot: its row and column values, and the additive
 * figures behind it (totals are sums of these). */
export interface PivotCell {
  row: string;
  col: string;
  base: Record<string, number>;
}

/** A measure a pivot shows in each cell, and how it is formatted. */
export interface Measure {
  name: string;
  label: string;
  format: 'amount' | 'quantity' | 'percent';
  /** Shown in the grand total line above the grid. */
  summary?: boolean;
}

/** A measure as configured: totalled by the cube from its Source, or
 * worked out by its Formula from the other measures' (summed) totals. */
export interface MeasureDef {
  name: string;
  source?: string;
  formula?: string;
}

/** The cells of a pivot: the cube, for the measures that have a Source.
 * A period (fromDate to toDate) applies to postings; stock is as it is now. */
export async function cube(c: Context, v: Values, rowAxis: string, colAxis: string, defs: MeasureDef[]): Promise<PivotCell[]> {
  const sources = defs.filter((d): d is MeasureDef & { source: string } => !!d.source).map((d) => ({ name: d.name, source: d.source }));
  return (await getCube(c.business, c.ledger, rowAxis, colAxis, sources, v.fromDate || undefined, v.toDate || undefined)).map((x) => ({
    row: x.rowKey,
    col: x.colKey,
    base: x.values,
  }));
}

/** Every measure's value from summed totals: a sourced measure is its
 * total, a formula is worked out from those (no value where it divides by
 * nothing). */
export function measureValues(defs: MeasureDef[], base: Record<string, number>): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const d of defs) out[d.name] = d.formula ? evaluate(d.formula, { ...base, ...out }) : (base[d.name] ?? 0);
  return out;
}

/** Arithmetic on measure names: numbers, names, + - * / and brackets. */
export function evaluate(formula: string, names: Record<string, number | null>): number | null {
  const tokens = formula.match(/\d+(\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|[-+*/()]/g) ?? [];
  let at = 0;
  const peek = () => tokens[at];
  const next = () => tokens[at++];
  function primary(): number | null {
    const tok = next();
    if (tok === '(') {
      const v = sum();
      next();
      return v;
    }
    if (tok === '-') {
      const v = primary();
      return v == null ? null : -v;
    }
    if (tok !== undefined && /^\d/.test(tok)) return Number(tok);
    return tok !== undefined ? (names[tok] ?? 0) : null;
  }
  function product(): number | null {
    let v = primary();
    while (peek() === '*' || peek() === '/') {
      const op = next();
      const r = primary();
      if (v == null || r == null) v = null;
      else if (op === '*') v = v * r;
      else v = r === 0 ? null : v / r;
    }
    return v;
  }
  function sum(): number | null {
    let v = product();
    while (peek() === '+' || peek() === '-') {
      const op = next();
      const r = product();
      v = v == null || r == null ? null : op === '+' ? v + r : v - r;
    }
    return v;
  }
  return sum();
}

/** The axes a pivot can break down by, in groups: Item and the item
 * hierarchies, Location and the location hierarchies. Two axes of the same
 * group would only repeat each other, so they never cross. Values per
 * axis, for narrowing to one. */
export interface Axes {
  groups: string[][];
  values: Record<string, string[]>;
}

export async function loadAxes(c: Context): Promise<Axes> {
  const { values, groups }: { values: Record<string, string[]>; groups: Record<string, string> } = await getAxes(c.business, c.ledger).catch(() => ({ values: { Item: [], Location: [] }, groups: {} }));
  // A hierarchy with no values here would only say "No ..." everywhere.
  const further = (side: string) => Object.keys(values).filter((k) => !['Item', 'Location'].includes(k) && groups[k] === side && values[k].length > 0);
  return { groups: [['Item', ...further('item')], ['Location', ...further('location')]], values };
}

export const sameGroup = (axes: Axes, a: string, b: string): boolean =>
  a !== 'Consolidated' && b !== 'Consolidated' && axes.groups.some((g) => g.includes(a) && g.includes(b));

// --- forms (the forms template) ----------------------------------------------
//
// A forms screen is a column of forms, each a Section of the screen's
// description with its fields: its Action saves it (an Error's message is
// shown under the form; a returned Values replaces the form's values),
// its Initial gives its first values, its Preview a line shown under it.

/** A form's first values. */
export const formInitials: Record<string, () => Values> = {
  /** Closing through today. */
  closeThrough: () => ({ throughDate: new Date().toISOString().slice(0, 10) }),
  /** The user's page size. */
  pageSize: () => ({ pageSize: String(auth.current?.user.page_size ?? 20) }),
  /** The user's number and date formats. */
  formats: () => ({ numberFormat: auth.current?.user.number_format ?? '1 000.00', dateFormat: auth.current?.user.date_format ?? 'dd/mm/yyyy' }),
};

/** A form's saving. */
export const formActions: Record<string, (c: Context, v: Values) => Promise<Values | void>> = {
  /** Closes the session's ledger through a date: normal posting on or
   * before it is rejected. */
  closePeriod: async (c, v) => {
    await closePeriod(asBusinessName(c.business), asLedgerName(c.ledger), v.throughDate);
  },
  /** Reopens the session's ledger: normal posting is allowed again. */
  reopenPeriod: async (c) => {
    await reopenPeriod(asBusinessName(c.business), asLedgerName(c.ledger));
  },
  /** The business's preferred name for a concept (key: its default
   * name); the default itself removes the preference. The page reloads,
   * so every screen shows the new name. */
  saveVocabulary: async (c, v) => {
    const business = (await getEntityTree()).find((e) => e.name === c.business);
    if (!business) throw new Error(t('Could not complete.'));
    if (v.preferred === v.key) await deleteVocabularyPreference(v.key, 'business', business.id);
    else await setVocabularyPreference(v.key, 'business', business.id, v.preferred);
    window.location.reload();
  },
  /** A new hierarchy (name) of items or of locations (of). */
  createHierarchy: async (c, v) => {
    if (!(v.name ?? '').trim()) return;
    await createHierarchy(c.business, v.name.trim(), (v.of || 'Items') as HierarchyKind);
  },
  /** A new value (value) of the hierarchy selected (parent). */
  createHierarchyValue: async (c, v) => {
    if (!(v.value ?? '').trim()) return;
    await createHierarchyValue(c.business, v.parent, v.value.trim());
  },
  /** Saves the selected hierarchy (selected) as a prototype
   * (prototypeName) any business can start from. */
  saveHierarchyPrototype: async (c, v) => {
    const name = (v.prototypeName ?? '').trim();
    if (!name || !v.selected) return;
    await saveHierarchyPrototype(c.business, v.selected, name);
    return { message: `${t('Saved as prototype')}: ${name}` };
  },
  /** A new hierarchy (hierarchyName) started from a prototype
   * (prototype); it is then selected. */
  createHierarchyFromPrototype: async (c, v) => {
    const name = (v.hierarchyName ?? '').trim();
    if (!v.prototype || !name) return;
    await createHierarchyFromPrototype(c.business, v.prototype, name);
    return { select: name };
  },
  /** Registers an account as a bank account of a scope, with an optional
   * overdraft limit. */
  registerBankAccount: async (c, v) => {
    if (!v.account || !v.scope) throw new Error('Account and scope are both required.');
    const limitMinor = v.overdraftLimit === '' || v.overdraftLimit == null ? null : Math.round(Number(v.overdraftLimit) * 100);
    await registerBankAccount(v.account, asBusinessName(c.business), v.scope, limitMinor);
  },
  /** The user's page size: a whole number from 5 to 200. */
  savePageSize: async (_c, v) => {
    const pageSize = Number(v.pageSize);
    if (!Number.isInteger(pageSize) || pageSize < 5 || pageSize > 200) throw new Error('Page size must be a whole number between 5 and 200.');
    await setOwnPageSize(pageSize);
    if (auth.current) auth.set({ ...auth.current, user: { ...auth.current.user, page_size: pageSize } });
  },
  /** The user's number and date formats. */
  saveFormats: async (_c, v) => {
    await setOwnNumberFormat(v.numberFormat);
    await setOwnDateFormat(v.dateFormat);
    if (auth.current) auth.set({ ...auth.current, user: { ...auth.current.user, number_format: v.numberFormat, date_format: v.dateFormat } });
  },
  /** The user's password: at least 8 characters, confirmed; the form is
   * cleared once it is changed. */
  changePassword: async (_c, v) => {
    if ((v.newPassword ?? '').length < 8) throw new Error('New password must be at least 8 characters.');
    if (v.newPassword !== v.confirmPassword) throw new Error('New password and confirmation do not match.');
    try {
      await changeOwnPassword(v.currentPassword ?? '', v.newPassword);
    } catch (e) {
      throw e instanceof ApiError ? new Error(e.message) : new Error('Could not change password.');
    }
    return { currentPassword: '', newPassword: '', confirmPassword: '' };
  },
};

/** A table of figures a screen shows: its columns, and its rows' cells
 * with any cell's class (classes). */
export interface Table {
  columns: { name: string; label: string; numeric?: boolean }[];
  rows: { cells: Row; classes?: Record<string, string> }[];
}

/** A card's items: a text and a note beside it. */
export type Card = { text: string; note?: string }[];

/** Groups of items a list screen shows as cards. */
export const cards: Record<string, (c: Context) => Promise<Card[]>> = {
  /** Each product shape: its dimensions in order, each with its
   * hierarchy. */
  productShapes: async (c) =>
    (await getProductShapes(c.business)).map((shape) => shape.map(([dimension, hierarchy]) => ({ text: dimension, note: `\u2192 ${hierarchy}` }))),
};

/** Saving a list screen's growable rows together. */
export const lineActions: Record<string, (c: Context, lines: Values[]) => Promise<void>> = {
  /** A product shape from the rows with both a dimension and a hierarchy,
   * in order. */
  defineProductShape: async (c, lines) => {
    const dimensions: [string, string][] = lines.filter((l) => (l.dimension ?? '').trim() && (l.hierarchy ?? '').trim()).map((l) => [l.dimension.trim(), l.hierarchy.trim()]);
    if (dimensions.length === 0) return;
    await defineProductShape(c.business, dimensions);
  },
};

/** The tables a list screen shows above its list. */
export const tables: Record<string, (c: Context) => Promise<Table>> = {
  /** Cash by currency: balance, overdraft limit, and headroom (warn when
   * below zero). */
  cashPosition: async (c) => ({
    columns: [
      { name: 'currency', label: t('Currency') },
      { name: 'balance', label: t('Balance'), numeric: true },
      { name: 'overdraft', label: t('Overdraft limit'), numeric: true },
      { name: 'headroom', label: t('Headroom'), numeric: true },
    ],
    rows: (await getCashPosition(asBusinessName(c.business), asLedgerName(c.ledger))).map((r) => ({
      cells: {
        currency: r.currency ?? c.business,
        balance: amount(r.total_balance_minor),
        overdraft: r.total_overdraft_limit_minor === null ? '\u2014' : amount(r.total_overdraft_limit_minor),
        headroom: r.headroom_minor === null ? t('unknown') : amount(r.headroom_minor),
      },
      classes: (r.headroom_minor !== null && r.headroom_minor < 0 ? { headroom: 'warn' } : {}) as Record<string, string>,
    })),
  }),
};

/** A record a forms Section with Each shows as its own form. */
export interface FormRecord {
  key: string;
  title: string;
  note?: string;
  values: Values;
  /** Each select's options. */
  options: Record<string, string[]>;
}

/** The records of a forms Section with Each. */
export const formRecords: Record<string, (c: Context) => Promise<FormRecord[]>> = {
  /** Each concept with more than one name, on the name the business sees
   * now: the alternate whose translation is what its default shows. */
  vocabularyConcepts: async () =>
    (await getConceptsWithAlternates()).map((concept) => {
      const shown = t(concept.defaultAlternate);
      return {
        key: concept.defaultAlternate,
        title: concept.headerAccountName,
        note: `${t('Known, real, alternate words for this concept:')} ${concept.alternates.join(', ')}`,
        values: { preferred: concept.alternates.find((a) => t(a) === shown) ?? concept.defaultAlternate },
        options: { preferred: concept.alternates },
      };
    }),
};

/** A line shown under a form, from its values. */
export const previews: Record<string, (v: Values) => string> = {
  /** An amount and a date in the chosen formats. */
  formats: (v) => `Preview: ${formatAmount(123456789, v.numberFormat ?? '')} \u00b7 ${formatDate('2027-08-03', v.dateFormat ?? '')}`,
};

// --- proposals -----------------------------------------------------------------
//
// A review screen's sections each propose a journal entry from the
// screen's values (proposals), shown for review; accepting it posts it
// (accepts) and shows what was done. An Error's message is shown in the
// section.

/** A line of a proposed entry, its amounts written out. */
export interface ProposalRow {
  account: string;
  debit: string;
  credit: string;
}
/** A heading and the items under it. */
export interface Listing {
  heading: string;
  items: string[];
}
/** A proposed entry: its lines, figures under them, listings, and what
 * accepting it needs (data). */
export interface Proposal {
  rows: ProposalRow[];
  summary?: { label: string; value: string }[];
  lists?: Listing[];
  data?: unknown;
}
/** What accepting a proposal did. */
export interface Outcome {
  title: string;
  lines: { label: string; value: string }[];
  lists?: Listing[];
  note?: string;
}

const amount = (minor: number) => formatAmount(minor, auth.current?.user.number_format ?? '1 000.00');
const proposalRows = (lines: { account: string; amount_minor: number }[]): ProposalRow[] =>
  lines.map((l) => ({ account: l.account, debit: l.amount_minor > 0 ? amount(l.amount_minor) : '', credit: l.amount_minor < 0 ? amount(-l.amount_minor) : '' }));
const breakdown = (heading: string, groups: { group: string | null; netIncomeMinor: number }[]): Listing[] =>
  groups.length > 0 ? [{ heading, items: groups.map((d) => `${d.group ?? t('(no division)')}: ${amount(d.netIncomeMinor)}`) }] : [];
// The ledger a rollover goes into: the one chosen, or the new one named.
const rolloverTarget = (v: Values) => v.newLedger || (v.newLedgerName ?? '').trim();

/** An entry to review before it is posted. */
export const proposals: Record<string, (c: Context, v: Values) => Promise<Proposal>> = {
  /** Closing the books as of a date: every income and expense account
   * zeroed into the retained earnings account, with the net income by
   * location and the business's location hierarchies. */
  closeBooks: async (c, v) => {
    if (!v.retainedEarnings) throw new Error(t('Retained earnings account'));
    let hierarchyPath = ['Location'];
    try {
      const ofLocations = hierarchiesOf(await getHierarchy(asBusinessName(c.business)), 'Locations');
      if (ofLocations.length > 0) hierarchyPath = ['Location', ...ofLocations.map((h) => h.hierarchy)];
    } catch {
      // the close still works with just a Location breakdown
    }
    const preview = await previewCloseBooks({ business: asBusinessName(c.business), ledger: asLedgerName(c.ledger), asOfDate: v.asOfDate, retainedEarningsAccount: asAccountName(v.retainedEarnings), hierarchyPath });
    return {
      rows: proposalRows(preview.lines),
      summary: [{ label: t('Net income'), value: amount(preview.netIncomeMinor) }],
      lists: breakdown(`${t('Summary by division/location (informational — every division rolls into the one, combined Retained Earnings line above)')}:`, preview.groupBreakdown),
      data: preview,
    };
  },
  /** Rolling the balance-sheet accounts over into a ledger (created when
   * new) as its opening balances, as of a date. */
  rollover: async (c, v) => {
    const target = rolloverTarget(v);
    if (!target) throw new Error(t('Name the new ledger first.'));
    if (!v.newLedger) {
      try {
        await createLedger(asBusinessName(c.business), asLedgerName(target));
      } catch (e) {
        // rolling into a ledger made by a half-finished attempt is fine
        if (!(e instanceof ApiError)) throw e;
      }
    }
    const resolved = await resolveRolloverLines({ business: asBusinessName(c.business), oldLedger: asLedgerName(c.ledger), newLedger: asLedgerName(target), asOfDate: v.asOfDate });
    return { rows: proposalRows(resolved.lines), data: resolved };
  },
};

/** Posting an accepted proposal. */
export const accepts: Record<string, (c: Context, v: Values, p: Proposal) => Promise<Outcome>> = {
  /** Posts the proposed close as one entry, CLOSE-<ledger>-<date>. */
  closeBooks: async (c, v, p) => {
    const preview = p.data as CloseBooksPreview;
    const reference = `CLOSE-${c.ledger}-${v.asOfDate}`;
    for (const line of preview.lines) {
      await stageLine({
        reference,
        business: asBusinessName(c.business),
        ledger: asLedgerName(c.ledger),
        transdate: v.asOfDate,
        account: asAccountName(line.account),
        accountId: line.accountId,
        amount_minor: line.amount_minor,
        memo: line.account === v.retainedEarnings ? 'Year-end close — net income retained' : 'Year-end close',
      });
    }
    await postJournalEntry(reference, asBusinessName(c.business), asLedgerName(c.ledger));
    return {
      title: `${t('Closed')}: ${reference}`,
      lines: [
        { label: t('Net income'), value: amount(preview.netIncomeMinor) },
        { label: t('Accounts zeroed'), value: String(preview.accountsZeroed) },
      ],
      lists: breakdown(`${t('By division/location profit center')}:`, preview.groupBreakdown),
      note: t("Every real balance-sheet account — Inventory, Cash, Accounts Receivable/Payable — is unchanged and needs no further action: its real, current balance is already the new period's opening balance."),
    };
  },
  /** Posts the opening balances into the new ledger. */
  rollover: async (c, v, p) => {
    const resolved = p.data as ResolvedRollover;
    const target = asLedgerName(rolloverTarget(v));
    for (const line of resolved.lines) {
      await stageLine({
        reference: resolved.reference,
        business: asBusinessName(c.business),
        ledger: target,
        transdate: v.asOfDate,
        account: asAccountName(line.account),
        amount_minor: line.amount_minor,
        memo: `Opening balance carried forward from ${c.ledger}`,
      });
    }
    await postJournalEntry(resolved.reference, asBusinessName(c.business), target);
    return {
      title: `${t('Rolled over')}: ${resolved.reference}`,
      lines: [
        { label: t('New ledger'), value: target },
        { label: t('Accounts carried forward'), value: String(resolved.accountsCarriedForward) },
      ],
    };
  },
};

/** A forms screen's status line, reloaded after each form is saved. */
export const statuses: Record<string, (c: Context) => Promise<string>> = {
  /** Whether the session's ledger is closed, through when, and since when. */
  periodStatus: async (c) => {
    const status = await getPeriodStatus(asBusinessName(c.business), asLedgerName(c.ledger));
    const where = `${c.business} \u2014 ${c.ledger}: `;
    return status.locked_through_date
      ? `${where}${t('Closed')} through ${status.locked_through_date}${status.changed_at ? ` \u2014 set ${status.changed_at}` : ''}`
      : `${where}${t('Open')} \u2014 normal posting is allowed on any date${status.changed_at ? ` \u2014 last changed ${status.changed_at}` : ''}`;
  },
};
