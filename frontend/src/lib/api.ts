// The full documentation for this file's own design (the request
// wrapper, auth, branded types, version check, and the "frontend-
// driven canned journal" pattern) lives in docs/pm-frontend-
// reference.md — this file carries only short, function-specific
// pointers below, not full explanations.
import { auth } from './state.svelte';

const BASE = 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Branded types, re-declared independently of the backend's own —
// see docs/pm-frontend-reference.md.
export type BusinessName = string & { readonly __brand: 'BusinessName' };
export type LedgerName = string & { readonly __brand: 'LedgerName' };
export type AccountName = string & { readonly __brand: 'AccountName' };
export type HierarchyGroupName = string & { readonly __brand: 'HierarchyGroupName' };
export type LocationName = string & { readonly __brand: 'LocationName' };
export type EmployeeName = string & { readonly __brand: 'EmployeeName' };
export type CustomerName = string & { readonly __brand: 'CustomerName' };
export type ProviderName = string & { readonly __brand: 'ProviderName' };
export type ItemName = string & { readonly __brand: 'ItemName' };
export function asBusinessName(name: string): BusinessName {
  return name as BusinessName;
}
export function asLedgerName(name: string): LedgerName {
  return name as LedgerName;
}
export function asAccountName(name: string): AccountName {
  return name as AccountName;
}
// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export function asHierarchyGroupName(name: string): HierarchyGroupName {
//   return name as HierarchyGroupName;
// }
export function asLocationName(name: string): LocationName {
  return name as LocationName;
}
export function asEmployeeName(name: string): EmployeeName {
  return name as EmployeeName;
}
export function asCustomerName(name: string): CustomerName {
  return name as CustomerName;
}
export function asProviderName(name: string): ProviderName {
  return name as ProviderName;
}
export function asItemName(name: string): ItemName {
  return name as ItemName;
}

// Numeric, part-by-part comparison, not lexical — see docs/pm-frontend-reference.md.
export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

// Reloads the frontend if it's older than the live backend; otherwise
// just warns — see docs/pm-frontend-reference.md.
export async function checkVersion(): Promise<void> {
  try {
    const health = await request<{ ok: boolean; appVersion: string; dbVersion: string }>('/health');
    const cmp = compareVersions(__APP_VERSION__, health.appVersion);
    if (cmp === 0) return;
    if (cmp < 0) {
      console.warn(`Frontend version ${__APP_VERSION__} is older than the real, running backend's own ${health.appVersion} - reloading.`);
      window.location.reload();
    } else {
      console.warn(`Backend version ${health.appVersion} is older than this real, running frontend's own ${__APP_VERSION__} - the backend needs restarting; this cannot be done from the frontend.`);
    }
  } catch {
    // A real, failed version check (backend genuinely unreachable) is
    // not this function's own concern - every other real call already
    // surfaces that failure on its own.
  }
}

// Minimal ASCII-CSV line codec, mirroring shared-fixtures/csv.ts's
// escaping exactly (duplicated, not imported, since the frontend has its
// own Vite build separate from the backend/shared-fixtures package) -
// the wire format for the new direct, no-JSON call protocol
// (call-dispatch.ts/routes/call.ts). Per direct instruction: the
// screen's own name is the backend call, looked up with a plain
// property read there, never eval - an unrecognized name just fails
// cleanly (see callScreen below).
function escapeAscii(text: string): string {
  return Array.from(text)
    .map((ch) => {
      const code = ch.codePointAt(0)!;
      return code < 128 ? ch : '\\u{' + code.toString(16) + '}';
    })
    .join('');
}
function unescapeAscii(text: string): string {
  return text.replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}
function csvField(value: string): string {
  const escaped = escapeAscii(value);
  if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) return '"' + escaped.replace(/"/g, '""') + '"';
  return escaped;
}
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else current += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      fields.push(current);
      current = '';
    } else current += ch;
  }
  fields.push(current);
  return fields;
}

// Calls the one, generic /api/call endpoint: name plus its positional
// values (see backend/src/call-dispatch/*.ts for each function's own,
// documented order), no JSON anywhere, in either direction. Returns the
// raw response lines (already CSV-split and unescaped); callRow/
// callTable below interpret them per backend/src/routes/call.ts's two
// response shapes (a scalar 'row' is always exactly one line, a 'table'
// is always at least two: header, then zero or more data rows).
async function callRaw(name: string, values: (string | undefined)[]): Promise<string[][]> {
  const current = auth.current;
  const headers: Record<string, string> = { 'Content-Type': 'text/csv' };
  if (current) headers.Authorization = `Bearer ${current.token}`;
  const line = [name, ...values.map((v) => v ?? '')].map(csvField).join(',');
  let res: Response;
  try {
    res = await fetch(`${BASE}/call`, { method: 'POST', headers, body: line });
  } catch {
    throw new ApiError(0, `Can't reach the backend at ${BASE}. Make sure it's running (cd backend && npm run dev).`);
  }
  if (res.status === 401) auth.clear();
  const lines = text_lines(await res.text());
  const firstFields = splitCsvLine(lines[0] ?? '').map(unescapeAscii);
  if (firstFields[0] === 'error') throw new ApiError(res.status, firstFields[1] ?? res.statusText);
  return lines.map((l) => splitCsvLine(l).map(unescapeAscii));
}
function text_lines(text: string): string[] {
  return text.split('\n').filter((l) => l.length > 0);
}

// A scalar result: exactly one response line, "ok,value1,value2,...".
async function callRow<T>(name: string, values: (string | undefined)[], parseResult: (fields: string[]) => T): Promise<T> {
  const lines = await callRaw(name, values);
  return parseResult(lines[0].slice(1));
}

// A tabular/list result: line 1 is bare "ok", line 2 is the header row,
// lines 3+ are one data row each (possibly zero rows).
async function callTable<T>(name: string, values: (string | undefined)[], parseRow: (fields: Record<string, string>) => T): Promise<T[]> {
  const lines = await callRaw(name, values);
  if (lines.length < 2) return [];
  const header = lines[1];
  return lines.slice(2).map((fields) => parseRow(Object.fromEntries(header.map((h, i) => [h, fields[i] ?? '']))));
}

// Same wire call as callRaw, but for a function whose real input
// includes a genuine, caller-variable-length array of records (a
// shopping cart's lines, a journal's lines) - every lineItems row
// becomes one more CSV line in the request body, after the first
// (see backend/src/routes/call.ts). Each row's own column order is
// documented at that function's BACKEND_FUNCTIONS entry.
async function callRawWithLines(name: string, values: (string | undefined)[], lineItems: (string | undefined)[][]): Promise<string[][]> {
  const current = auth.current;
  const headers: Record<string, string> = { 'Content-Type': 'text/csv' };
  if (current) headers.Authorization = `Bearer ${current.token}`;
  const firstLine = [name, ...values.map((v) => v ?? '')].map(csvField).join(',');
  const itemLines = lineItems.map((item) => item.map((v) => csvField(v ?? '')).join(','));
  const body = [firstLine, ...itemLines].join('\n');
  let res: Response;
  try {
    res = await fetch(`${BASE}/call`, { method: 'POST', headers, body });
  } catch {
    throw new ApiError(0, `Can't reach the backend at ${BASE}. Make sure it's running (cd backend && npm run dev).`);
  }
  if (res.status === 401) auth.clear();
  const lines = text_lines(await res.text());
  const firstFields = splitCsvLine(lines[0] ?? '').map(unescapeAscii);
  if (firstFields[0] === 'error') throw new ApiError(res.status, firstFields[1] ?? res.statusText);
  return lines.map((l) => splitCsvLine(l).map(unescapeAscii));
}
async function callRowWithLines<T>(name: string, values: (string | undefined)[], lineItems: (string | undefined)[][], parseResult: (fields: string[]) => T): Promise<T> {
  const lines = await callRawWithLines(name, values, lineItems);
  return parseResult(lines[0].slice(1));
}


async function request<T>(path: string, init?: RequestInit, screenName?: string): Promise<T> {
  const current = auth.current;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (current) headers.Authorization = `Bearer ${current.token}`;
  if (screenName) headers['X-Screen-Name'] = screenName;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { headers, ...init });
  } catch {
    throw new ApiError(0, `Can't reach the backend at ${BASE}. Make sure it's running (cd backend && npm run dev).`);
  }
  if (res.status === 401) {
    auth.clear(); // the session is gone (expired, logged out elsewhere, or deactivated) — treat as logged out
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.error?.message ?? body.error ?? message;
      if (typeof message === 'object') message = JSON.stringify(message);
    } catch {
      /* ignore parse failure */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface EntityNode {
  id: number;
  name: string;
  parent_id: number | null;
  relation_id: number | null;
  accountnumber: string | null;
  balance_minor: number | null;
  currency: string | null;
  depth: number;
  is_postable_account: boolean;
}

function parseEntityNode(f: Record<string, string>): EntityNode {
  return {
    id: Number(f.id),
    name: f.name,
    parent_id: f.parent_id === '' ? null : Number(f.parent_id),
    relation_id: f.relation_id === '' ? null : Number(f.relation_id),
    accountnumber: f.accountnumber || null,
    balance_minor: f.balance_minor === '' ? null : Number(f.balance_minor),
    currency: f.currency || null,
    depth: Number(f.depth),
    is_postable_account: f.is_postable_account === 'true',
  };
}
// business scopes the tree to just that business's own subtree - a performance fix for screens
// that only ever need one business's locations/items/contacts/ledgers, not the whole system's
// entity tree (every business, every CoA prototype, all vocabulary). Omitted, unchanged: the
// full tree, still needed by admin-style screens (Entity Tree, CoA prototype pickers).
export const getEntityTree = (business?: string) => callTable('getEntityTree', [business], parseEntityNode);

export interface HierarchyLinkPointingAt {
  entityName: string;
  hierarchyName: string;
}
function parseHierarchyLinkPointingAt(f: Record<string, string>): HierarchyLinkPointingAt {
  return { entityName: f.entityName, hierarchyName: f.hierarchyName };
}
export const getHierarchyLinksPointingAt = (entityId: number) => callTable('getHierarchyLinksPointingAt', [String(entityId)], parseHierarchyLinkPointingAt);

function parseEntityNodeRow(f: string[]): EntityNode {
  return {
    id: Number(f[0]),
    name: f[1],
    parent_id: f[2] === '' ? null : Number(f[2]),
    relation_id: f[3] === '' ? null : Number(f[3]),
    accountnumber: f[4] || null,
    balance_minor: f[5] === '' ? null : Number(f[5]),
    currency: f[6] || null,
    depth: 0,
    is_postable_account: false,
  };
}
export const createEntity = (data: { name: string; parent?: string | null; parentId?: number | null; relation?: string | null; accountnumber?: string | null }) =>
  callRow('createEntity', [data.name, data.parent ?? undefined, data.parentId != null ? String(data.parentId) : undefined, data.relation ?? undefined, data.accountnumber ?? undefined], parseEntityNodeRow);
export const setEntityRelationship = (entityName: string, relationshipType: string, targetName: string) =>
  callRow('setEntityRelationship', [entityName, relationshipType, targetName], () => undefined);

// See docs/pm-frontend-reference.md.
export const createProvider = (name: string) => callRow('createProvider', [name], (f) => ({ id: Number(f[0]) }));
export const createCustomer = (name: string) => callRow('createCustomer', [name], (f) => ({ id: Number(f[0]) }));
export const createEmployeeContact = (name: string, placeOfEmployment: string) =>
  callRow('createEmployeeContact', [name, placeOfEmployment], (f) => ({ id: Number(f[0]) }));

export const supersedeEntity = (
  id: number,
  data: { name?: string; parent?: string | null; relation?: string | null; accountnumber?: string | null }
) => callRow('supersedeEntity', [String(id), data.name ?? undefined, data.parent ?? undefined, data.relation ?? undefined, data.accountnumber ?? undefined], parseEntityNodeRow);

export const revokeEntity = (id: number) => callRow('revokeEntity', [String(id)], () => undefined);

export interface ReportRow {
  report: string;
  category: string;
  account: AccountName;
  depth: number;
  accountnumber: string | null;
  balance_minor: number | null;
}

// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const getBusinessReports = () => request<ReportRow[]>('/reports/business-reports');

export interface ChartRow {
  id: number;
  name: string;
  depth: number;
  path: string;
  accountnumber: string | null;
  balance_minor: number | null;
}

// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const getChartOfAccounts = () => request<ChartRow[]>('/reports/chart-of-accounts');

export interface BankAccountRow {
  name: string;
  accountnumber: string | null;
  balance_minor: number;
  currency: string | null;
  overdraft_limit_minor: number | null;
  scope: string;
}
export interface CashPositionByCurrency {
  currency: string | null;
  total_balance_minor: number;
  total_overdraft_limit_minor: number | null;
  headroom_minor: number | null;
}
export const getBankAccounts = (business: BusinessName, ledger: LedgerName) =>
  callTable('getBankAccounts', [business, ledger], (f): BankAccountRow => ({
    name: f.name,
    accountnumber: f.accountnumber || null,
    balance_minor: Number(f.balance_minor),
    currency: f.currency || null,
    overdraft_limit_minor: f.overdraft_limit_minor === '' ? null : Number(f.overdraft_limit_minor),
    scope: f.scope,
  }));
export const getCashPosition = (business: BusinessName, ledger: LedgerName) =>
  callTable('getCashPosition', [business, ledger], (f): CashPositionByCurrency => ({
    currency: f.currency || null,
    total_balance_minor: Number(f.total_balance_minor),
    total_overdraft_limit_minor: f.total_overdraft_limit_minor === '' ? null : Number(f.total_overdraft_limit_minor),
    headroom_minor: f.headroom_minor === '' ? null : Number(f.headroom_minor),
  }));

export interface ForecastLine {
  date: string;
  description: string;
  amount_minor: number;
  source: 'AR' | 'AP' | 'recurring';
}
export interface CashFlowForecast {
  as_of_date: string;
  horizon_end_date: string;
  starting_cash_minor: number;
  overdraft_limit_minor: number | null;
  lines: ForecastLine[];
  ending_cash_minor: number;
  lowest_projected_balance_minor: number;
  lowest_balance_date: string;
  first_shortfall_date: string | null;
  first_shortfall_amount_minor: number | null;
}
export const getCashFlowForecast = (business: BusinessName, ledger: LedgerName, asOfDate?: string, horizonDays?: number) =>
  callRow('getCashFlowForecast', [business, ledger, asOfDate, horizonDays ? String(horizonDays) : undefined], (f): CashFlowForecast => ({
    as_of_date: f[0],
    horizon_end_date: f[1],
    starting_cash_minor: Number(f[2]),
    overdraft_limit_minor: f[3] === '' ? null : Number(f[3]),
    lines: decodeRecordList(['date', 'description', 'amount_minor', 'source'], f[4]).map((l) => ({
      date: l.date,
      description: l.description,
      amount_minor: Number(l.amount_minor),
      source: l.source as 'AR' | 'AP' | 'recurring',
    })),
    ending_cash_minor: Number(f[5]),
    lowest_projected_balance_minor: Number(f[6]),
    lowest_balance_date: f[7],
    first_shortfall_date: f[8] || null,
    first_shortfall_amount_minor: f[9] === '' ? null : Number(f[9]),
  }));

export const registerBankAccount = (accountName: string, business: BusinessName, scopeName: string, overdraftLimitMinor: number | null) =>
  callRow('registerBankAccount', [accountName, business, scopeName, overdraftLimitMinor != null ? String(overdraftLimitMinor) : undefined], () => undefined);
export const unregisterBankAccount = (accountName: string) =>
  callRow('unregisterBankAccount', [accountName], () => undefined);


export interface TrialBalanceRow {
  id: number;
  name: string;
  accountnumber: string | null;
  debit_minor: number;
  credit_minor: number;
  currency: string | null;
  has_quantity_postings: boolean;
}
export interface TrialBalanceCurrencySubtotal {
  currency: string | null;
  total_debit_minor: number;
  total_credit_minor: number;
  balanced: boolean;
}
export interface TrialBalance {
  rows: TrialBalanceRow[];
  total_debit_minor: number;
  total_credit_minor: number;
  by_currency: TrialBalanceCurrencySubtotal[];
}
export const getTrialBalance = (business: BusinessName, ledger: LedgerName, asOfDate?: string) =>
  callRow('getTrialBalance', [business, ledger, asOfDate], (f): TrialBalance => ({
    rows: decodeRecordList(['id', 'name', 'accountnumber', 'debit_minor', 'credit_minor', 'currency', 'has_quantity_postings'], f[0]).map((r) => ({
      id: Number(r.id),
      name: r.name,
      accountnumber: r.accountnumber || null,
      debit_minor: Number(r.debit_minor),
      credit_minor: Number(r.credit_minor),
      currency: r.currency || null,
      has_quantity_postings: r.has_quantity_postings === 'true',
    })),
    total_debit_minor: Number(f[1]),
    total_credit_minor: Number(f[2]),
    by_currency: decodeRecordList(['currency', 'total_debit_minor', 'total_credit_minor', 'balanced'], f[3]).map((r) => ({
      currency: r.currency || null,
      total_debit_minor: Number(r.total_debit_minor),
      total_credit_minor: Number(r.total_credit_minor),
      balanced: r.balanced === 'true',
    })),
  }));

export interface SalesReportLine {
  invoice_date: string;
  reference: string;
  item_name: string | null;
  description: string;
  quantity: number | null;
  unit_price_minor: number | null;
  amount_minor: number;
}
export interface SalesCategorySummary {
  category: string;
  quantity: number;
  amount_minor: number;
}
export interface SalesReport {
  detailed: SalesReportLine[];
  category_summary: SalesCategorySummary[];
  total_quantity: number;
  total_amount_minor: number;
}
export const getSalesReport = (business: BusinessName, ledger: LedgerName, fromDate?: string, toDate?: string) =>
  callRow('getSalesReport', [business, ledger, fromDate, toDate], (f): SalesReport => ({
    detailed: decodeRecordList(['invoice_date', 'reference', 'item_name', 'description', 'quantity', 'unit_price_minor', 'amount_minor'], f[0]).map((r) => ({
      invoice_date: r.invoice_date,
      reference: r.reference,
      item_name: r.item_name || null,
      description: r.description,
      quantity: r.quantity === '' ? null : Number(r.quantity),
      unit_price_minor: r.unit_price_minor === '' ? null : Number(r.unit_price_minor),
      amount_minor: Number(r.amount_minor),
    })),
    category_summary: decodeRecordList(['category', 'quantity', 'amount_minor'], f[1]).map((r) => ({
      category: r.category,
      quantity: Number(r.quantity),
      amount_minor: Number(r.amount_minor),
    })),
    total_quantity: Number(f[2]),
    total_amount_minor: Number(f[3]),
  }));

// Named AccountStatementLine (not StatementLine) to avoid colliding with
// the unrelated, invoice-based StatementLine interface declared later in
// this file for Customer Statements (arap.ts) - TypeScript silently merges
// two same-named top-level interfaces in one module, which had been
// quietly requiring the union of both shapes' fields until these report
// functions' real object literals exposed it.
export interface AccountStatementLine {
  name: string;
  accountnumber: string | null;
  debit_minor: number;
  credit_minor: number;
  is_contra: boolean;
}
export interface BalanceSheet {
  assets: AccountStatementLine[];
  liabilities: AccountStatementLine[];
  equity: AccountStatementLine[];
  assets_tree: CategoryTreeNode[];
  liabilities_tree: CategoryTreeNode[];
  equity_tree: CategoryTreeNode[];
  total_assets_minor: number;
  total_liabilities_minor: number;
  total_equity_minor: number;
  balanced: boolean;
}
export interface MenuLinkRow {
  key: string;
  href: string;
  label: string;
  notImplemented: boolean;
  isSubheading: boolean;
  requiredRoles: string[] | null;
}
export interface MenuSectionRow {
  key: string;
  label: string;
  links: MenuLinkRow[];
}
// Converted off the old JSON '/menu' route onto the call protocol.
// getMenuTree's two-level sections->links shape arrives flattened (one
// row per link, a no-link section as one row with empty link_* fields)
// - reassembled into the same MenuSectionRow[] shape every caller
// already expects, so no component needs to change.
export const getMenuTree = async (businessName?: string): Promise<MenuSectionRow[]> => {
  const flatRows = await callTable('getMenuTree', [businessName], (f) => f);
  const sections = new Map<string, MenuSectionRow>();
  for (const f of flatRows) {
    let section = sections.get(f.section_key);
    if (!section) {
      section = { key: f.section_key, label: f.section_label, links: [] };
      sections.set(f.section_key, section);
    }
    if (f.link_key) {
      section.links.push({
        key: f.link_key,
        href: f.link_href,
        label: f.link_label,
        notImplemented: f.link_notImplemented === 'true',
        isSubheading: f.link_isSubheading === 'true',
        requiredRoles: f.link_requiredRoles ? f.link_requiredRoles.split('|') : null,
      });
    }
  }
  return [...sections.values()];
};
// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const setMenuOverride = (menuItemKey: string, scope: 'business' | 'user', scopeId: number, overrideLabel: string | null, hidden: boolean) =>
//   request<{ ok: true }>('/menu/override', { method: 'POST', body: JSON.stringify({ menuItemKey, scope, scopeId, overrideLabel, hidden }) });
// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const deleteMenuOverride = (menuItemKey: string, scope: 'business' | 'user', scopeId: number) =>
//   request<{ ok: true }>('/menu/override', { method: 'DELETE', body: JSON.stringify({ menuItemKey, scope, scopeId }) });

const STATEMENT_LINE_FIELDS = ['name', 'accountnumber', 'debit_minor', 'credit_minor', 'is_contra'];
function decodeStatementLines(encoded: string): AccountStatementLine[] {
  return decodeRecordList(STATEMENT_LINE_FIELDS, encoded).map((r) => ({
    name: r.name,
    accountnumber: r.accountnumber || null,
    debit_minor: Number(r.debit_minor),
    credit_minor: Number(r.credit_minor),
    is_contra: r.is_contra === 'true',
  }));
}

export const getBalanceSheet = (business: BusinessName, ledger: LedgerName, asOfDate?: string) =>
  callRow('getBalanceSheet', [business, ledger, asOfDate], (f): BalanceSheet => ({
    assets: decodeStatementLines(f[0]),
    liabilities: decodeStatementLines(f[1]),
    equity: decodeStatementLines(f[2]),
    assets_tree: decodeCategoryTree(f[3]),
    liabilities_tree: decodeCategoryTree(f[4]),
    equity_tree: decodeCategoryTree(f[5]),
    total_assets_minor: Number(f[6]),
    total_liabilities_minor: Number(f[7]),
    total_equity_minor: Number(f[8]),
    balanced: f[9] === 'true',
  }));

export interface CategoryTreeNode {
  name: string;
  accountnumber: string | null;
  is_leaf: boolean;
  debit_minor: number;
  credit_minor: number;
  is_contra: boolean;
  children: CategoryTreeNode[];
}
export interface ProfitAndLoss {
  income: AccountStatementLine[];
  expenses: AccountStatementLine[];
  cogs_expenses: AccountStatementLine[];
  operating_expenses: AccountStatementLine[];
  income_tree: CategoryTreeNode[];
  cogs_tree: CategoryTreeNode[];
  operating_expenses_tree: CategoryTreeNode[];
  total_income_minor: number;
  total_expenses_minor: number;
  gross_profit_minor: number;
  net_income_minor: number;
}
// Matches call-dispatch/reports.ts's own encodeProfitAndLoss exactly - one
// shared decoder reused by the plain getProfitAndLoss row response, each
// row of getProfitAndLossByHierarchy's table, and each node of
// getProfitAndLossByHierarchyTree's recursive tree below.
function decodeProfitAndLoss(encoded: string): ProfitAndLoss {
  const f = decodeStringList(encoded);
  return {
    income: decodeStatementLines(f[0]),
    expenses: decodeStatementLines(f[1]),
    cogs_expenses: decodeStatementLines(f[2]),
    operating_expenses: decodeStatementLines(f[3]),
    income_tree: decodeCategoryTree(f[4]),
    cogs_tree: decodeCategoryTree(f[5]),
    operating_expenses_tree: decodeCategoryTree(f[6]),
    total_income_minor: Number(f[7]),
    total_expenses_minor: Number(f[8]),
    gross_profit_minor: Number(f[9]),
    net_income_minor: Number(f[10]),
  };
}

export const getProfitAndLoss = (business: BusinessName, ledger: LedgerName, fromDate?: string, toDate?: string, group?: string, hierarchyPath?: string[], hierarchyName?: string) =>
  callRow(
    'getProfitAndLoss',
    [business, ledger, fromDate, toDate, group, hierarchyPath && hierarchyPath.length > 0 ? hierarchyPath.join(',') : undefined, hierarchyName],
    (f): ProfitAndLoss => decodeProfitAndLoss(f[0])
  );

export interface ProfitAndLossByGroup {
  group: HierarchyGroupName | null;
  profitAndLoss: ProfitAndLoss;
}
export const getProfitAndLossByHierarchy = (business: BusinessName, ledger: LedgerName, hierarchyPath: string[], fromDate?: string, toDate?: string) =>
  callTable('getProfitAndLossByHierarchy', [business, ledger, hierarchyPath.join(','), fromDate, toDate], (f): ProfitAndLossByGroup => ({
    group: (f.group || null) as HierarchyGroupName | null,
    profitAndLoss: decodeProfitAndLoss(f.profitAndLoss),
  }));

export interface ProfitAndLossByGroupNode extends ProfitAndLossByGroup {
  children: ProfitAndLossByGroupNode[];
}
// Matches call-dispatch/reports.ts's own encodeProfitAndLossByGroupTree -
// a genuine, arbitrary-depth group tree where every node also carries a
// full ProfitAndLoss (itself containing three more arbitrary-depth
// category trees), decoded by the same self-recursive technique as
// decodeCategoryTree.
function decodeProfitAndLossByGroupTree(encoded: string): ProfitAndLossByGroupNode[] {
  return decodeStringList(encoded).map((lineEncoded) => {
    const f = decodeStringList(lineEncoded);
    return { group: (f[0] || null) as HierarchyGroupName | null, profitAndLoss: decodeProfitAndLoss(f[1]), children: decodeProfitAndLossByGroupTree(f[2]) };
  });
}
export const getProfitAndLossByHierarchyTree = (business: BusinessName, ledger: LedgerName, hierarchyPath: string[], hierarchyName?: string, fromDate?: string, toDate?: string) =>
  callRow('getProfitAndLossByHierarchyTree', [business, ledger, hierarchyPath.join(','), hierarchyName, fromDate, toDate], (f): ProfitAndLossByGroupNode[] => decodeProfitAndLossByGroupTree(f[0]));

export interface LedgerDateRange {
  earliest: string | null;
  latest: string | null;
}
export const getLedgerDateRange = (business: BusinessName, ledger: LedgerName) =>
  callRow('getLedgerDateRange', [business, ledger], (f): LedgerDateRange => ({ earliest: f[0] || null, latest: f[1] || null }));

export const getLanguages = () => callTable('getLanguages', [], (f) => ({ id: Number(f.id), name: f.name }));
export const getLanguageDirection = (language: string) => callRow('getLanguageDirection', [language], (f): { direction: 'LTR' | 'RTL' } => ({ direction: f[0] as 'LTR' | 'RTL' }));
export const setLanguageDirection = (language: string, direction: 'LTR' | 'RTL' | null) => callRow('setLanguageDirection', [language, direction ?? ''], () => undefined);
export const getDefaultLanguage = () => callRow('getDefaultLanguage', [], (f): { language: string | null } => ({ language: f[0] || null }));
export const setDefaultLanguage = (language: string) => callRow('setDefaultLanguage', [language], () => undefined);
export const getLocalizedText = async (language: string, businessName?: string): Promise<Record<string, string>> => {
  const rows = await callTable('getLocalizedText', [language, businessName], (f) => ({ entity: f.entity, text: f.text }));
  return Object.fromEntries(rows.map((r) => [r.entity, r.text]));
};

// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const getVocabularyAlternates = (word: string) => callTable('getVocabularyAlternates', [word], (f) => f.name);

export interface ConceptWithAlternates {
  headerAccountName: string;
  alternates: string[];
  defaultAlternate: string;
}
export const getConceptsWithAlternates = () =>
  callTable('getConceptsWithAlternates', [], (f): ConceptWithAlternates => ({ headerAccountName: f.headerAccountName, alternates: decodeStringList(f.alternates), defaultAlternate: f.defaultAlternate }));

export interface VocabularyWord {
  name: string;
  translations: Record<string, string>;
}
export const getVocabularyWords = async (): Promise<VocabularyWord[]> => {
  const rows = await callTable('getVocabularyWords', [], (f) => ({ word: f.word, language: f.language, text: f.text }));
  const byWord = new Map<string, Record<string, string>>();
  const order: string[] = [];
  for (const r of rows) {
    if (!byWord.has(r.word)) {
      byWord.set(r.word, {});
      order.push(r.word);
    }
    if (r.language !== '') byWord.get(r.word)![r.language] = r.text;
  }
  return order.map((name) => ({ name, translations: byWord.get(name)! }));
};
// Name-based — see deleteTranslationConcept in db.ts. Refuses (409) while
// the word is still genuinely translated anywhere, or is a real hierarchy/
// vocabulary-alternate target.
export const deleteVocabularyWord = (word: string) => callRow('deleteVocabularyWord', [word], () => undefined);

export const setVocabularyPreference = (conceptName: string, scope: 'business' | 'user', scopeId: number, preferredAlternateName: string) =>
  callRow('setVocabularyPreference', [conceptName, scope, String(scopeId), preferredAlternateName], (): { ok: true } => ({ ok: true }));

export const deleteVocabularyPreference = (conceptName: string, scope: 'business' | 'user', scopeId: number) =>
  callRow('deleteVocabularyPreference', [conceptName, scope, String(scopeId)], (): { ok: true } => ({ ok: true }));
export const setTranslation = (entity: string, language: string, text: string) => callRow('setTranslation', [entity, language, text], () => undefined);

export interface HierarchyGroupRecord {
  name: string;
  parentName: string | null;
}
// Generic replacement for the former, privileged getDivisions() — see docs/pm-frontend-reference.md.
export const getHierarchyGroups = (hierarchyName: string) =>
  callTable('getHierarchyGroups', [hierarchyName], (f): HierarchyGroupRecord => ({ name: f.name, parentName: f.parentName || null }));

export interface HierarchyGroupingWithValues {
  grouping: string;
  values: string[];
}
export const getHierarchy = async (business: string): Promise<HierarchyGroupingWithValues[]> => {
  const rows = await callTable('getHierarchy', [business], (f) => ({ grouping: f.grouping, value: f.value }));
  const byGrouping = new Map<string, string[]>();
  const order: string[] = [];
  for (const r of rows) {
    if (!byGrouping.has(r.grouping)) {
      byGrouping.set(r.grouping, []);
      order.push(r.grouping);
    }
    if (r.value !== '') byGrouping.get(r.grouping)!.push(r.value);
  }
  return order.map((grouping) => ({ grouping, values: byGrouping.get(grouping)! }));
};
export const getProductShapes = async (business: string): Promise<[string, string][][]> => {
  const rows = await callTable('getProductShapes', [business], (f) => f.shape);
  return rows.map((encoded) => decodeShape(encoded) ?? []);
};
export const createHierarchyGrouping = (business: string, groupingName: string) =>
  callRow('createHierarchyGrouping', [business, groupingName], (f): { name: string } => ({ name: f[0] }));
export const createHierarchyValue = (business: string, groupingName: string, valueName: string, parentValueName?: string | null) =>
  callRow('createHierarchyValue', [business, groupingName, valueName, parentValueName ?? undefined], (f): { name: string } => ({ name: f[0] }));
export const defineProductShape = (business: string, dimensions: [string, string][]) =>
  callRow('defineProductShape', [business, encodeShape(dimensions)], (f): { dimensions: [string, string][] } => ({ dimensions: decodeShape(f[0]) ?? [] }));
// Name-based, like the creators just above — getHierarchy's own
// HierarchyGroupingWithValues shape carries no entity ids. See
// deleteHierarchyGrouping/deleteHierarchyValue in db.ts.
export const deleteHierarchyGrouping = (business: string, groupingName: string) => callRow('deleteHierarchyGrouping', [business, groupingName], () => undefined);
export const deleteHierarchyValue = (business: string, groupingName: string, valueName: string) =>
  callRow('deleteHierarchyValue', [business, groupingName, valueName], () => undefined);

// Generic entity-to-hierarchy-value tagging — see docs/pm-frontend-reference.md.
export const setHierarchyTag = (entityName: string, hierarchyName: string, parentName: string) =>
  callRow('setHierarchyTag', [entityName, hierarchyName, parentName], (f): { entityName: string; hierarchyName: string; parentName: string } => ({ entityName: f[0], hierarchyName: f[1], parentName: f[2] }));
export const getHierarchyTag = (entityName: string, hierarchyName: string) =>
  callRow('getHierarchyTag', [entityName, hierarchyName], (f): { parentName: string | null } => ({ parentName: f[0] || null }));
export const deleteHierarchyTag = (entityName: string, hierarchyName: string) => callRow('deleteHierarchyTag', [entityName, hierarchyName], () => undefined);
// Every real tag for one named hierarchy in one call (entity name ->
// value name) — builds a real display tree (e.g. Category in the Items
// catalog) without one request per item or per value. See
// getHierarchyAssignments in db.ts.
export const getHierarchyAssignments = async (hierarchyName: string): Promise<Record<string, string>> => {
  const rows = await callTable('getHierarchyAssignments', [hierarchyName], (f) => ({ entityName: f.entityName, parentName: f.parentName }));
  return Object.fromEntries(rows.map((r) => [r.entityName, r.parentName]));
};

export const getBusinesses = () => callTable('getBusinesses', [], (f) => ({ id: Number(f.id), name: f.name }));
export const getBusinessTypes = () => callTable('getBusinessTypes', [], (f) => ({ name: f.name, questions: decodeStringList(f.questions) }));
export const saveBusinessTypeAnswers = (businessName: string, answers: Record<string, string>) =>
  callRow('saveBusinessTypeAnswers', [businessName, encodeRecordList(['key', 'value'], Object.entries(answers).map(([key, value]) => ({ key, value })))], () => undefined);
export const getLedgers = (businessName: string) => callTable('getLedgers', [businessName], (f) => ({ id: Number(f.id), name: f.name }));
// Session/ledger/Profit Center pickers — see docs/pm-frontend-reference.md.
export const getActiveLedger = (businessName: string) =>
  callRow('getActiveLedger', [businessName], (f): { activeLedger: string | null } => ({ activeLedger: f[0] || null }));
export const getProfitCenters = (businessName: string) => callTable('getProfitCenters', [businessName], (f) => ({ id: Number(f.id), name: f.name }));
export const createProfitCenter = (businessName: string, profitCenterName: string) =>
  callRow('createProfitCenter', [businessName, profitCenterName], (f) => ({ id: Number(f[0]), name: f[1] }));
export const setSessionProfitCenter = (profitCenterName: string | null) => callRow('setSessionProfitCenter', [profitCenterName ?? undefined], () => undefined);
export type ReportingFrequency = 'annual' | 'biannual' | 'quarterly' | 'monthly';
// Converted off the old JSON '/businesses' route onto the new, direct,
// no-JSON call protocol (per direct instruction - see
// backend/src/call-dispatch.ts's "Create Business" entry for the exact
// positional order this must match). businessAdmin.password is shown
// exactly once, never recoverable later — see docs/pm-frontend-reference.md.
export const createBusiness = (
  businessName: string,
  financialYearLabel: string,
  coaPrototype?: string,
  secondaryCurrencies?: string[],
  entityStructure?: 'sole_trader' | 'partnership' | 'llc' | 'unlimited_liability' | 'publicly_traded',
  partnerNames?: string[],
  financialYearStart?: string,
  reportingFrequency?: ReportingFrequency
) =>
  callRow(
    'Create Business',
    [businessName, financialYearLabel, coaPrototype, secondaryCurrencies?.join('|'), entityStructure, partnerNames?.join('|'), financialYearStart, reportingFrequency],
    (f): { business: BusinessName; actualLedger: string; budgetLedger: string; businessAdmin: { username: string; password: string } } => ({
      business: f[0] as BusinessName,
      actualLedger: f[1],
      budgetLedger: f[2],
      businessAdmin: { username: f[3], password: f[4] },
    })
  );
export const getCoaPrototypeAccounts = (language: string) => callTable('getCoaPrototypeAccounts', [language], (f) => f.name);
export interface ReportingPeriod { label: string; startDate: string; endDate: string; }
export const getReportingPeriods = (businessName: string, asOf?: string) =>
  callTable('getReportingPeriods', [businessName, asOf], (f): ReportingPeriod => ({ label: f.label, startDate: f.startDate, endDate: f.endDate }));

export const nominateBankAccount = (businessName: string, bankAccountName: string, routingDetail: string, accountNumber: string) =>
  callRow('nominateBankAccount', [businessName, bankAccountName, routingDetail, accountNumber], (f) => ({ id: Number(f[0]) }));

// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const getNominatedBankAccounts = (businessName: string) =>
//   request<{ name: string; routingDetail: string; accountNumber: string }[]>(`/businesses/${encodeURIComponent(businessName)}/bank-accounts`);

export interface BusinessConfigurationReport {
  businessName: string;
  addresses: { address_type: string; address1?: string; city?: string; [key: string]: unknown }[];
  phones: { phone_type: string; phone?: string; [key: string]: unknown }[];
  ownerOrPartners: string[];
  bankAccounts: { name: string; routingDetail: string; accountNumber: string }[];
  homeCurrency: string | null;
  secondaryCurrencies: string[];
  hierarchies: HierarchyGroupingWithValues[];
  locations: { name: string; city: string; locationType: string }[];
  categories: string[];
  chartOfAccountsPrototype: string | null;
  notes: { name: string; text: string }[];
}

export const getBusinessConfigurationReport = (businessName: string) =>
  callRow(
    'getBusinessConfigurationReport',
    [businessName],
    (f): BusinessConfigurationReport => ({
      businessName: f[0],
      addresses: decodeRecordList(['address_type', 'address_line1', 'city'], f[1]).map((r) => ({ address_type: r.address_type, address1: r.address_line1 || undefined, city: r.city || undefined })),
      phones: decodeRecordList(['phone_type', 'phone'], f[2]).map((r) => ({ phone_type: r.phone_type, phone: r.phone || undefined })),
      ownerOrPartners: decodeStringList(f[3]),
      bankAccounts: decodeRecordList(['name', 'routingDetail', 'accountNumber'], f[4]).map((r) => ({ name: r.name, routingDetail: r.routingDetail, accountNumber: r.accountNumber })),
      homeCurrency: f[5] || null,
      secondaryCurrencies: decodeStringList(f[6]),
      hierarchies: decodeRecordList(['grouping', 'values'], f[7]).map((r) => ({ grouping: r.grouping, values: decodeStringList(r.values) })),
      locations: decodeRecordList(['name', 'city', 'locationType'], f[8]).map((r) => ({ name: r.name, city: r.city, locationType: r.locationType })),
      categories: decodeStringList(f[9]),
      chartOfAccountsPrototype: f[11] || null,
      notes: decodeRecordList(['name', 'text'], f[10]).map((r) => ({ name: r.name, text: r.text })),
    })
  );

export const buildBankCurrencyStructure = (
  businessName: string,
  headerName: string,
  leafKind: 'asset' | 'equity',
  selections: { bankAccountName: string; currency: string }[],
  homeCurrency: string
) =>
  callRow(
    'buildBankCurrencyStructure',
    [businessName, headerName, leafKind, encodeRecordList(['bankAccountName', 'currency'], selections), homeCurrency],
    () => undefined
  );

export interface StagedLine {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  description?: string;
  transdate?: string;
  account: AccountName;
  accountId?: number; // resolves name collisions — see docs/pm-frontend-reference.md
  amount_minor: number;
  memo?: string;
}

export const stageLine = (line: StagedLine) =>
  callRow('stageLine', [line.reference, line.business, line.ledger, line.description, line.transdate, line.account, line.accountId != null ? String(line.accountId) : undefined, String(line.amount_minor), line.memo], () => undefined);

// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const getStagedLines = (reference: string, business: BusinessName, ledger: LedgerName) =>
//   callTable('getStagedLines', [reference, business, ledger], (f): StagedLine => ({ ... }));

// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const removeStagedLine = (reference: string, business: BusinessName, ledger: LedgerName, account: AccountName) =>
//   callRow('removeStagedLine', [reference, business, ledger, account], () => undefined);

export const postJournalEntry = (reference: string, business: BusinessName, ledger: LedgerName) => callRow('postJournalEntry', [reference, business, ledger], () => undefined);

export interface JournalSummary {
  journal_id: number;
  occurrence_date: string | null;
  reference: string;
  description: string;
  business: BusinessName;
  ledger: LedgerName;
  recurrence: string;
  total_debit_minor: number;
  total_credit_minor: number;
}
function parseJournalSummary(f: Record<string, string>): JournalSummary {
  return {
    journal_id: Number(f.journal_id),
    occurrence_date: f.occurrence_date || null,
    reference: f.reference,
    description: f.description,
    business: f.business as BusinessName,
    ledger: f.ledger as LedgerName,
    recurrence: f.recurrence,
    total_debit_minor: Number(f.total_debit_minor),
    total_credit_minor: Number(f.total_credit_minor),
  };
}

export const listJournalEntries = async (business: BusinessName, ledger: LedgerName, limit = 100, offset = 0): Promise<{ rows: JournalSummary[]; totalCount: number }> => {
  const lines = await callRaw('listJournalEntries', [business, ledger, String(limit), String(offset)]);
  if (lines.length < 2) return { rows: [], totalCount: 0 };
  const header = lines[1];
  const parsed = lines.slice(2).map((fields) => Object.fromEntries(header.map((h, i) => [h, fields[i] ?? ''])));
  const totalCount = parsed.length > 0 ? Number(parsed[0].totalCount) : 0;
  const rows = parsed[0]?.reference === '' ? [] : parsed.map(parseJournalSummary);
  return { rows, totalCount };
};

export interface JournalDetail extends JournalSummary {
  lines: { account: AccountName; accountnumber: string | null; amount_minor: number; memo: string }[];
}

export const getJournalEntry = (business: BusinessName, ledger: LedgerName, journalId: number, occurrenceDate: string) =>
  callRow('getJournalEntry', [business, ledger, String(journalId), occurrenceDate], (f): JournalDetail => ({
    ...parseJournalSummary({ journal_id: f[0], occurrence_date: f[1], reference: f[2], description: f[3], business: f[4], ledger: f[5], recurrence: f[6], total_debit_minor: f[8], total_credit_minor: f[9] }),
    lines: decodeRecordList(['account', 'accountnumber', 'amount_minor', 'memo'], f[11]).map((l) => ({
      account: l.account as AccountName,
      accountnumber: l.accountnumber || null,
      amount_minor: Number(l.amount_minor),
      memo: l.memo,
    })),
  }));

export interface TrialBalanceComparisonRow {
  id: number;
  name: string;
  accountnumber: string | null;
  a_debit_minor: number;
  a_credit_minor: number;
  b_debit_minor: number;
  b_credit_minor: number;
}
export interface TrialBalanceComparison {
  ledgerA: string;
  ledgerB: string;
  rows: TrialBalanceComparisonRow[];
}
export const getTrialBalanceComparison = (business: BusinessName, a: string, b: string) =>
  callRow('getTrialBalanceComparison', [business, a, b], (f): TrialBalanceComparison => ({
    ledgerA: f[0],
    ledgerB: f[1],
    rows: decodeRecordList(['id', 'name', 'accountnumber', 'a_debit_minor', 'a_credit_minor', 'b_debit_minor', 'b_credit_minor'], f[2]).map((r) => ({
      id: Number(r.id),
      name: r.name,
      accountnumber: r.accountnumber || null,
      a_debit_minor: Number(r.a_debit_minor),
      a_credit_minor: Number(r.a_credit_minor),
      b_debit_minor: Number(r.b_debit_minor),
      b_credit_minor: Number(r.b_credit_minor),
    })),
  }));

export interface ProfitAndLossComparisonLine {
  name: string;
  accountnumber: string | null;
  a_minor: number;
  b_minor: number;
  variance_minor: number;
}
export interface ProfitAndLossComparison {
  ledgerA: string;
  ledgerB: string;
  income: ProfitAndLossComparisonLine[];
  expenses: ProfitAndLossComparisonLine[];
  a_total_income_minor: number;
  b_total_income_minor: number;
  a_total_expenses_minor: number;
  b_total_expenses_minor: number;
  a_net_income_minor: number;
  b_net_income_minor: number;
  net_income_variance_minor: number;
}
const COMPARISON_LINE_FIELDS = ['name', 'accountnumber', 'a_minor', 'b_minor', 'variance_minor'];
export const getProfitAndLossComparison = (business: BusinessName, a: string, b: string) =>
  callRow('getProfitAndLossComparison', [business, a, b], (f): ProfitAndLossComparison => ({
    ledgerA: f[0],
    ledgerB: f[1],
    income: decodeRecordList(COMPARISON_LINE_FIELDS, f[2]).map((r) => ({
      name: r.name,
      accountnumber: r.accountnumber || null,
      a_minor: Number(r.a_minor),
      b_minor: Number(r.b_minor),
      variance_minor: Number(r.variance_minor),
    })),
    expenses: decodeRecordList(COMPARISON_LINE_FIELDS, f[3]).map((r) => ({
      name: r.name,
      accountnumber: r.accountnumber || null,
      a_minor: Number(r.a_minor),
      b_minor: Number(r.b_minor),
      variance_minor: Number(r.variance_minor),
    })),
    a_total_income_minor: Number(f[4]),
    b_total_income_minor: Number(f[5]),
    a_total_expenses_minor: Number(f[6]),
    b_total_expenses_minor: Number(f[7]),
    a_net_income_minor: Number(f[8]),
    b_net_income_minor: Number(f[9]),
    net_income_variance_minor: Number(f[10]),
  }));

export interface Contact {
  business_name: string | null;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  payment_terms_days: number | null;
  credit_limit_minor: number | null;
  wage_minor_per_hour: number | null;
  salary_minor_per_year: number | null;
  reminder_level: number;
  preferred_language: string | null;
}

const CONTACT_FIELD_ORDER: (keyof Contact)[] = [
  'business_name', 'phone', 'email', 'address_line1', 'address_line2', 'city', 'region', 'postal_code', 'country',
  'payment_terms_days', 'credit_limit_minor', 'wage_minor_per_hour', 'salary_minor_per_year', 'preferred_language',
];
export const getContact = (name: string) =>
  callRow('getContact', [name], (f): Contact | null => {
    if (f[0] === '0') return null;
    return {
      business_name: f[1] || null,
      phone: f[2] || null,
      email: f[3] || null,
      address_line1: f[4] || null,
      address_line2: f[5] || null,
      city: f[6] || null,
      region: f[7] || null,
      postal_code: f[8] || null,
      country: f[9] || null,
      payment_terms_days: f[10] === '' ? null : Number(f[10]),
      credit_limit_minor: f[11] === '' ? null : Number(f[11]),
      wage_minor_per_hour: f[12] === '' ? null : Number(f[12]),
      salary_minor_per_year: f[13] === '' ? null : Number(f[13]),
      reminder_level: Number(f[14]),
      preferred_language: f[15] || null,
    };
  });
export const setContact = (name: string, contact: Partial<Contact>) =>
  callRow('setContact', [name, ...CONTACT_FIELD_ORDER.map((field) => (contact[field] == null ? undefined : String(contact[field])))], () => undefined);

export interface CreditStatus {
  balanceMinor: number;
  limitMinor: number | null;
  overLimit: boolean;
  remainingMinor: number | null;
}
export const getCreditStatus = (name: string) =>
  callRow(
    'getCreditStatus',
    [name],
    (f): CreditStatus => ({ balanceMinor: Number(f[0]), limitMinor: f[1] === '' ? null : Number(f[1]), overLimit: f[2] === 'true', remainingMinor: f[3] === '' ? null : Number(f[3]) })
  );

export interface TypedAddress {
  address_type: string;
  record_name: string;
  business_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
}
export const getTypedAddresses = (name: string) =>
  callTable('getTypedAddresses', [name], (f): TypedAddress => ({
    address_type: f.address_type,
    record_name: f.record_name,
    business_name: f.business_name || null,
    address_line1: f.address_line1 || null,
    address_line2: f.address_line2 || null,
    city: f.city || null,
    region: f.region || null,
    postal_code: f.postal_code || null,
    country: f.country || null,
  }));
export const setTypedAddress = (name: string, address: Partial<TypedAddress> & { address_type: string }) =>
  callRow(
    'setTypedAddress',
    [name, address.address_type, address.business_name ?? undefined, address.address_line1 ?? undefined, address.address_line2 ?? undefined, address.city ?? undefined, address.region ?? undefined, address.postal_code ?? undefined, address.country ?? undefined],
    () => undefined
  );
export const deleteTypedAddress = (name: string, addressType: string) => callRow('deleteTypedAddress', [name, addressType], () => undefined);

export interface TypedPhone {
  phone_type: string;
  record_name: string;
  phone: string | null;
  business_name: string | null;
}
export const getTypedPhones = (name: string) =>
  callTable('getTypedPhones', [name], (f): TypedPhone => ({ phone_type: f.phone_type, record_name: f.record_name, phone: f.phone || null, business_name: f.business_name || null }));
export const setTypedPhone = (name: string, phoneType: string, phone: string, businessName?: string | null) =>
  callRow('setTypedPhone', [name, phoneType, phone, businessName ?? undefined], () => undefined);
export const deleteTypedPhone = (name: string, phoneType: string) => callRow('deleteTypedPhone', [name, phoneType], () => undefined);

export interface ContactPerson {
  contact_type: string;
  record_name: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}
export const listContactPersonTypes = () => callTable('listContactPersonTypes', [], (f) => f.name);
export const listAddressTypes = () => callTable('listAddressTypes', [], (f) => f.name);
export const getLocationTypes = () => callTable('getLocationTypes', [], (f): string => f.name);
export const createLocationType = (name: string) => callRow('createLocationType', [name], (f): { name: string } => ({ name: f[0] }));
export const listPhoneTypes = () => callTable('listPhoneTypes', [], (f) => f.name);
export const getTypedContactPersons = (name: string) =>
  callTable('getTypedContactPersons', [name], (f): ContactPerson => ({ contact_type: f.contact_type, record_name: f.record_name, name: f.name || null, phone: f.phone || null, email: f.email || null }));
export const setTypedContactPerson = (name: string, contactType: string, value: { name: string; phone?: string | null; email?: string | null }) =>
  callRow('setTypedContactPerson', [name, contactType, value.name, value.phone ?? undefined, value.email ?? undefined], () => undefined);
export const deleteTypedContactPerson = (name: string, contactType: string) => callRow('deleteTypedContactPerson', [name, contactType], () => undefined);

export interface RecurringJournalLine {
  account: AccountName;
  amount_minor: number;
  memo?: string;
  effective_date?: string;
}

export const createRecurringJournal = (
  business: BusinessName,
  ledger: LedgerName,
  reference: string,
  startDate: string,
  recurrence: 'once' | 'weekly' | 'monthly' | 'yearly',
  lines: RecurringJournalLine[],
  description?: string,
  recurrenceCount?: number
) =>
  callRowWithLines(
    'createRecurringJournal',
    [business, ledger, reference, startDate, recurrence, description, recurrenceCount != null ? String(recurrenceCount) : undefined],
    lines.map((l) => [l.account, String(l.amount_minor), l.memo, l.effective_date]),
    () => undefined
  );

export interface ARAPBaseInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  amount_minor: number;
  tax_minor?: number;
  location?: string;
  transdate?: string;
  description?: string;
}

// stageARSale/postARSale removed entirely (docs/canned-journal-to-frontend-design.md)
// — confirmed dead (no references anywhere), and their backend route/table/trigger removed too.

export const stageARReceipt = (input: ARAPBaseInput & { customer: string }) =>
  callRow('stageARReceipt', [input.reference, input.business, input.ledger, input.customer, String(input.amount_minor), input.transdate, input.description], () => undefined);
export const postARReceipt = (reference: string, business: BusinessName, ledger: LedgerName) => callRow('postARReceipt', [reference, business, ledger], () => undefined);

// stageAPPurchase/postAPPurchase removed entirely (docs/canned-journal-to-frontend-design.md)
// — confirmed dead (no references anywhere), and their backend route/table/trigger removed too.

export const stageAPPayment = (input: ARAPBaseInput & { vendor: string }) =>
  callRow('stageAPPayment', [input.reference, input.business, input.ledger, input.vendor, String(input.amount_minor), input.transdate, input.description], () => undefined);
export const postAPPayment = (reference: string, business: BusinessName, ledger: LedgerName) => callRow('postAPPayment', [reference, business, ledger], () => undefined);

export interface LoginResponse {
  token: string;
  user: { id: number; username: string; roles: string[]; page_size: number; number_format: string; date_format: string };
}

export const apiLogin = (username: string, password: string) =>
  callRow('login', [username, password], (f): LoginResponse => ({
    token: f[0],
    user: { id: Number(f[1]), username: f[2], roles: decodeStringList(f[3]), page_size: Number(f[4]), number_format: f[5], date_format: f[6] },
  }));

export const apiLogout = () => callRow('logout', [], () => undefined);

export interface UserSummary {
  id: number;
  username: string;
  active: boolean;
  roles: string[];
}

export const getUsers = () => callTable('getUsers', [], (f): UserSummary => ({ id: Number(f.id), username: f.username, active: f.active === 'true', roles: decodeStringList(f.roles) }));
export const getRoles = () => callTable('getRoles', [], (f) => ({ id: Number(f.id), name: f.name }));
export const createUserAccount = (username: string, password: string, roles: string[]) =>
  callRow('createUser', [username, password, encodeStringList(roles)], (f): UserSummary => ({ id: Number(f[0]), username: f[1], active: f[2] === 'true', roles: decodeStringList(f[3]) }));
export const setUserRolesApi = (userId: number, roles: string[]) => callRow('setUserRolesApi', [String(userId), encodeStringList(roles)], () => undefined);
export const setUserActiveApi = (userId: number, active: boolean) => callRow('setUserActiveApi', [String(userId), String(active)], () => undefined);
export const changeUserPassword = (userId: number, password: string) => callRow('changeUserPassword', [String(userId), password], () => undefined);

// See docs/pm-frontend-reference.md.
export interface UserRoleMatrix {
  users: string[];
  roles: string[];
  assignments: { user: string; role: string }[];
}
export const getUserRoleMatrix = (business: string) =>
  callRow('getUserRoleMatrix', [business], (f): UserRoleMatrix => ({
    users: decodeStringList(f[0]),
    roles: decodeStringList(f[1]),
    assignments: decodeRecordList(['user', 'role'], f[2]).map((r) => ({ user: r.user, role: r.role })),
  }));
export const setUserRoleInBusiness = (business: string, username: string, roleName: string) => callRow('setUserRoleInBusiness', [business, username, roleName], () => undefined);
export const unsetUserRoleInBusiness = (business: string, username: string, roleName: string) => callRow('unsetUserRoleInBusiness', [business, username, roleName], () => undefined);

export const reverseJournalEntry = (business: BusinessName, ledger: LedgerName, journalId: number, occurrenceDate: string, reversalDate?: string) =>
  callRow('reverseJournalEntry', [business, ledger, String(journalId), occurrenceDate, reversalDate], () => undefined);

export interface PurchaseOrderInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  vendor: string;
  item: string;
  quantity: number;
  price_minor: number;
  location?: string;
  transdate?: string;
  description?: string;
}
export const stagePurchaseOrder = (input: PurchaseOrderInput) =>
  callRow('stagePurchaseOrder', [input.reference, input.business, input.ledger, input.vendor, input.item, String(input.quantity), String(input.price_minor), input.location, input.transdate, input.description], () => undefined);
export const postPurchaseOrder = (reference: string, business: BusinessName, ledger: LedgerName) =>
  callRow('postPurchaseOrder', [reference, business, ledger], () => undefined);

export interface OrderReceiptInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  po_reference: string;
  item: string;
  item_qty?: string;
  vendor: string;
  quantity: number;
  value_minor: number;
  tax_minor?: number;
  transdate?: string;
  description?: string;
}
export const stageOrderReceipt = (input: OrderReceiptInput) =>
  callRow(
    'stageOrderReceipt',
    [input.reference, input.business, input.ledger, input.po_reference, input.item, input.item_qty, input.vendor, String(input.quantity), String(input.value_minor), input.tax_minor === undefined ? undefined : String(input.tax_minor), input.transdate, input.description],
    () => undefined
  );
export const postOrderReceipt = (reference: string, business: BusinessName, ledger: LedgerName) =>
  callRow('postOrderReceipt', [reference, business, ledger], () => undefined);

export interface SalesOrderInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  customer: string;
  item: string;
  quantity: number;
  price_minor: number;
  location?: string;
  transdate?: string;
  description?: string;
}
export const stageSalesOrder = (input: SalesOrderInput) =>
  callRow('stageSalesOrder', [input.reference, input.business, input.ledger, input.customer, input.item, String(input.quantity), String(input.price_minor), input.location, input.transdate, input.description], () => undefined);
export const postSalesOrder = (reference: string, business: BusinessName, ledger: LedgerName) =>
  callRow('postSalesOrder', [reference, business, ledger], () => undefined);

// Quotations (AR, to a customer) and RFQs (AP, to a provider) — each is
// a real Sales/Purchase Order staged exactly as one would be, just not
// yet posted. See docs/pm-journal-api.md.
export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
export type QuotationDirection = 'AR' | 'AP';
export interface QuotationRecord {
  reference: string;
  direction: QuotationDirection;
  status: QuotationStatus;
  business: string;
  ledger: string;
  customer?: string;
  vendor?: string;
  item: string;
  quantity: number;
  price_minor: number;
  location?: string | null;
  transdate?: string | null;
  description?: string | null;
  expiryDate?: string | null;
}
function parseQuotationRecord(f: Record<string, string>): QuotationRecord {
  return {
    reference: f.reference,
    direction: f.direction as QuotationDirection,
    status: f.status as QuotationStatus,
    business: f.business,
    ledger: f.ledger,
    customer: f.customer || undefined,
    vendor: f.vendor || undefined,
    item: f.item,
    quantity: Number(f.quantity),
    price_minor: Number(f.price_minor),
    location: f.location || null,
    transdate: f.transdate || null,
    description: f.description || null,
    expiryDate: f.expiryDate || null,
  };
}
export const listQuotations = (business: BusinessName, ledger: LedgerName, direction?: QuotationDirection) => callTable('listQuotations', [business, ledger, direction], parseQuotationRecord);
export const getQuotation = async (reference: string): Promise<QuotationRecord> => {
  const rows = await callTable('getQuotation', [reference], parseQuotationRecord);
  return rows[0];
};
export const createQuotation = (input: SalesOrderInput & { expiryDate?: string }) =>
  callRow('createQuotation', [input.reference, input.business, input.ledger, input.customer, input.item, String(input.quantity), String(input.price_minor), input.location, input.transdate, input.description, input.expiryDate], () => undefined);
export const createRfq = (input: PurchaseOrderInput & { expiryDate?: string }) =>
  callRow('createRfq', [input.reference, input.business, input.ledger, input.vendor, input.item, String(input.quantity), String(input.price_minor), input.location, input.transdate, input.description, input.expiryDate], () => undefined);
export const markQuotationSent = (reference: string) => callRow('markQuotationSent', [reference], () => undefined);
export const acceptQuotation = (reference: string) => callRow('acceptQuotation', [reference], () => undefined);
export const rejectQuotation = (reference: string) => callRow('rejectQuotation', [reference], () => undefined);

export interface OrderDispatchInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  so_reference: string;
  item?: string;
  item_qty?: string;
  customer: string;
  quantity: number;
  unit_cost_minor?: number;
  sale_price_minor: number;
  tax_minor?: number;
  transdate?: string;
  description?: string;
}
export const stageOrderDispatch = (input: OrderDispatchInput) =>
  callRow(
    'stageOrderDispatch',
    [
      input.reference,
      input.business,
      input.ledger,
      input.so_reference,
      input.item,
      input.item_qty,
      input.customer,
      String(input.quantity),
      input.unit_cost_minor === undefined ? undefined : String(input.unit_cost_minor),
      String(input.sale_price_minor),
      input.tax_minor === undefined ? undefined : String(input.tax_minor),
      input.transdate,
      input.description,
    ],
    () => undefined
  );
export const postOrderDispatch = (reference: string, business: BusinessName, ledger: LedgerName) =>
  callRow('postOrderDispatch', [reference, business, ledger], () => undefined);

export const getOrderStatus = (reference: string) =>
  callRow('getOrderStatus', [reference], (f) => ({ quantity: Number(f[0]), value_minor: Number(f[1]) }));

export interface PeriodLockStatus {
  locked_through_date: string | null;
  changed_by: number | null;
  changed_at: string | null;
}
export const getPeriodStatus = (business: BusinessName, ledger: LedgerName) =>
  callRow(
    'getPeriodStatus',
    [business, ledger],
    (f): PeriodLockStatus => ({ locked_through_date: f[0] || null, changed_by: f[1] ? Number(f[1]) : null, changed_at: f[2] || null })
  );
export const closePeriod = (business: BusinessName, ledger: LedgerName, throughDate: string) => callRow('closePeriod', [business, ledger, throughDate], () => undefined);
export const reopenPeriod = (business: BusinessName, ledger: LedgerName) => callRow('reopenPeriod', [business, ledger], () => undefined);

export const changeOwnPassword = (currentPassword: string, newPassword: string) => callRow('changeOwnPassword', [currentPassword, newPassword], () => undefined);

export const getRecordingStatus = () => request<{ recording: boolean }>('/recording');
export const startRecording = () => request<{ recording: boolean }>('/recording/start', { method: 'POST' });
export const stopRecording = () => request<{ recording: boolean }>('/recording/stop', { method: 'POST' });

export const setOwnPageSize = (pageSize: number) => callRow('setOwnPageSize', [String(pageSize)], () => undefined);
export const setOwnNumberFormat = (numberFormat: string) => callRow('setOwnNumberFormat', [numberFormat], () => undefined);
export const setOwnDateFormat = (dateFormat: string) => callRow('setOwnDateFormat', [dateFormat], () => undefined);

export interface Item {
  description: string | null;
  unit_of_measure: string | null;
  upc: string | null;
}
export interface ItemSummary {
  name: string;
  description: string | null;
  unit_of_measure: string | null;
  upc: string | null;
  retail_price_minor: number | null;
  source_count: number;
  storage_origin: 'Hot' | 'Cold' | null;
  product: string | null;
  combinationValues?: string[]; // set when a scanned barcode matches a specific combination — see docs/pm-frontend-reference.md
  combinationShape?: [string, string][];
}
// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const getItemStorageOrigin = (itemName: string) => request<{ origin: 'Hot' | 'Cold' | null }>(`/items/${encodeURIComponent(itemName)}/storage-origin`);
// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const setItemStorageOrigin = (itemName: string, origin: 'Hot' | 'Cold' | null) =>
//   request<void>(`/items/${encodeURIComponent(itemName)}/storage-origin`, { method: 'PUT', body: JSON.stringify({ origin }) });

export type BomComponent = { component: string; quantity: number; unit: string };
function parseBomComponent(f: Record<string, string>): BomComponent {
  return { component: f.component, quantity: Number(f.quantity), unit: f.unit };
}
export const getBomComponents = async (itemName: string): Promise<{ components: BomComponent[] }> => ({ components: await callTable('getBomComponents', [itemName], parseBomComponent) });
export const setBomComponent = async (itemName: string, business: string, componentItem: string, quantity: number, unit: string): Promise<{ components: BomComponent[] }> => ({
  components: await callTable('setBomComponent', [itemName, business, componentItem, String(quantity), unit], parseBomComponent),
});
export const deleteBomComponent = (itemName: string, componentItem: string) => callRow('deleteBomComponent', [itemName, componentItem], () => undefined);
export interface ItemSource {
  id: number;
  item_id: number;
  item_name: string;
  manufacturer_id: number | null;
  manufacturer_name: string | null;
  vendor_id: number;
  vendor_name: string;
  vendor_sku: string | null;
  vendor_upc: string | null;
  price_minor: number | null;
  currency: string | null;
  package_quantity: number | null;
  is_preferred: boolean;
  preference_notes: string | null;
}
export interface ItemSourceInput {
  manufacturerName?: string | null;
  vendorName: ProviderName;
  vendorSku?: string | null;
  vendorUpc?: string | null;
  priceMinor?: number | null;
  currency?: string | null; // null = home currency; non-null = a separate priced row, never a conversion — see docs/pm-frontend-reference.md
  packageQuantity?: number | null;
  isPreferred?: boolean;
  preferenceNotes?: string | null;
}

// business is required — items are scoped per business, see docs/pm-frontend-reference.md.
export const listItems = async (business: string, limit?: number, offset = 0): Promise<{ rows: ItemSummary[]; totalCount: number }> => {
  const lines = await callRaw('listItems', [business, limit != null ? String(limit) : undefined, limit != null ? String(offset) : undefined]);
  if (lines.length < 2) return { rows: [], totalCount: 0 };
  const header = lines[1];
  const parsed = lines.slice(2).map((fields) => Object.fromEntries(header.map((h, i) => [h, fields[i] ?? ''])));
  const totalCount = parsed.length > 0 ? Number(parsed[0].totalCount) : 0;
  const rows: ItemSummary[] = parsed[0]?.name === '' ? [] : parsed.map((f) => ({
    name: f.name,
    description: f.description || null,
    unit_of_measure: f.unit_of_measure || null,
    upc: f.upc || null,
    retail_price_minor: f.retail_price_minor ? Number(f.retail_price_minor) : null,
    source_count: Number(f.source_count),
    storage_origin: (f.storage_origin || null) as 'Hot' | 'Cold' | null,
    product: f.product || null,
  }));
  return { rows, totalCount };
};
export const getItem = (name: string) =>
  callRow('getItem', [name], (f): Item | null => (f[0] === '0' ? null : { description: f[1] || null, unit_of_measure: f[2] || null, upc: f[3] || null }));

export interface ProductSummary {
  name: string;
  itemCount: number;
}
// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const listProducts = () => request<ProductSummary[]>('/products');
// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const createProduct = (name: string, parent = 'Items') => request<void>('/products', { method: 'POST', body: JSON.stringify({ name, parent }) });
// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const setItemProduct = (itemName: string, productName: string | null) =>
//   request<void>('/products/item-assignment', { method: 'PUT', body: JSON.stringify({ itemName, productName }) });
export const setItem = (name: string, item: Partial<Item>) =>
  callRow('setItem', [name, item.description ?? undefined, item.unit_of_measure ?? undefined, item.upc ?? undefined], () => undefined);
function parseItemSource(f: Record<string, string>): ItemSource {
  return {
    id: Number(f.id),
    item_id: Number(f.item_id),
    item_name: f.item_name,
    manufacturer_id: f.manufacturer_id ? Number(f.manufacturer_id) : null,
    manufacturer_name: f.manufacturer_name || null,
    vendor_id: Number(f.vendor_id),
    vendor_name: f.vendor_name,
    vendor_sku: f.vendor_sku || null,
    vendor_upc: f.vendor_upc || null,
    price_minor: f.price_minor ? Number(f.price_minor) : null,
    currency: f.currency || null,
    package_quantity: f.package_quantity ? Number(f.package_quantity) : null,
    is_preferred: f.is_preferred === 'true',
    preference_notes: f.preference_notes || null,
  };
}
export const listItemSources = (itemName: ItemName) => callTable('listItemSources', [itemName], parseItemSource);
export const addOrUpdateItemSource = (itemName: ItemName, source: ItemSourceInput) =>
  callRow(
    'addOrUpdateItemSource',
    [
      itemName,
      source.manufacturerName ?? undefined,
      source.vendorName,
      source.vendorSku ?? undefined,
      source.vendorUpc ?? undefined,
      source.priceMinor != null ? String(source.priceMinor) : undefined,
      source.currency ?? undefined,
      source.packageQuantity != null ? String(source.packageQuantity) : undefined,
      source.isPreferred ? 'true' : undefined,
      source.preferenceNotes ?? undefined,
    ],
    () => undefined
  );
export const deleteItemSource = (id: number) => callRow('deleteItemSource', [String(id)], () => undefined);

// ---------------------------------------------------------------------------
// Invoices — real multi-line invoices, Credit Notes/Debit Memos, payment
// allocation, aged reports, reminders, and history.
// ---------------------------------------------------------------------------

export interface InvoiceLine {
  id?: number;
  description: string;
  quantity?: number | null;
  unitPriceMinor?: number | null;
  amountMinor: number;
  taxMinor?: number;
  itemName?: string | null;
  dispatchReference?: string | null;
}

export interface InvoiceInput {
  invoiceType: 'AR' | 'AP';
  documentType?: 'invoice' | 'credit_note' | 'debit_memo';
  referencesInvoiceId?: number | null;
  business: BusinessName;
  ledger: LedgerName;
  reference: string;
  counterpartyName: string;
  invoiceDate: string;
  description?: string;
  lines: InvoiceLine[];
}

export interface Invoice {
  id: number;
  invoice_type: 'AR' | 'AP';
  document_type: 'invoice' | 'credit_note' | 'debit_memo';
  references_invoice_id: number | null;
  business: BusinessName;
  ledger: LedgerName;
  reference: string;
  counterparty: string;
  invoice_date: string;
  due_date: string | null;
  description: string;
  status: 'draft' | 'posted' | 'void';
  posted_by: string | null;
  source: 'manual' | 'pos';
  lines: (InvoiceLine & { id: number })[];
  total_amount_minor: number;
  total_tax_minor: number;
}

const INVOICE_LINE_FIELDS = ['id', 'description', 'quantity', 'unitPriceMinor', 'amountMinor', 'taxMinor', 'itemName', 'dispatchReference'];
function decodeInvoiceLines(encoded: string): (InvoiceLine & { id: number })[] {
  return decodeRecordList(INVOICE_LINE_FIELDS, encoded).map((r) => ({
    id: Number(r.id),
    description: r.description,
    quantity: r.quantity === '' ? null : Number(r.quantity),
    unitPriceMinor: r.unitPriceMinor === '' ? null : Number(r.unitPriceMinor),
    amountMinor: Number(r.amountMinor),
    taxMinor: Number(r.taxMinor),
    itemName: r.itemName || null,
    dispatchReference: r.dispatchReference || null,
  }));
}
// Matches call-dispatch/invoices.ts's own encodeInvoice exactly - shared
// by getInvoiceById (one invoice) and listInvoices (an array of them).
function decodeInvoice(encoded: string): Invoice {
  const f = decodeStringList(encoded);
  return {
    id: Number(f[0]),
    invoice_type: f[1] as 'AR' | 'AP',
    document_type: f[2] as 'invoice' | 'credit_note' | 'debit_memo',
    references_invoice_id: f[3] === '' ? null : Number(f[3]),
    business: f[4] as BusinessName,
    ledger: f[5] as LedgerName,
    reference: f[6],
    counterparty: f[7],
    invoice_date: f[8],
    due_date: f[9] || null,
    description: f[10],
    status: f[11] as 'draft' | 'posted' | 'void',
    posted_by: f[12] || null,
    source: f[13] as 'manual' | 'pos',
    lines: decodeInvoiceLines(f[14]),
    total_amount_minor: Number(f[15]),
    total_tax_minor: Number(f[16]),
  };
}

export const listInvoices = (
  business: BusinessName,
  ledger: LedgerName,
  invoiceType?: 'AR' | 'AP',
  source: 'manual' | 'pos' | 'all' = 'manual',
  limit = 50,
  offset = 0
) =>
  callRow('listInvoices', [business, ledger, invoiceType, source, String(limit), String(offset)], (f): { rows: Invoice[]; totalCount: number } => ({
    totalCount: Number(f[0]),
    rows: decodeStringList(f[1]).map(decodeInvoice),
  }));
export const getInvoiceById = (id: number) =>
  callRow('getInvoiceById', [String(id)], (f): Invoice => {
    if (f[0] !== '1') throw new ApiError(404, 'No such invoice.');
    return decodeInvoice(f[1]);
  });
export const createInvoice = (input: InvoiceInput) =>
  callRowWithLines(
    'createInvoice',
    [input.invoiceType, input.business, input.ledger, input.reference, input.counterpartyName, input.invoiceDate, input.description],
    input.lines.map((l) => [l.description, l.quantity != null ? String(l.quantity) : undefined, l.unitPriceMinor != null ? String(l.unitPriceMinor) : undefined, String(l.amountMinor), l.taxMinor != null ? String(l.taxMinor) : undefined, l.itemName ?? undefined, l.dispatchReference ?? undefined]),
    (f): { id: number } => ({ id: Number(f[0]) })
  );
export const postInvoiceById = (id: number, revenueOrExpenseAccount: string, taxAccount: string, restockInventory = false) =>
  callRow('postInvoiceById', [String(id), revenueOrExpenseAccount, taxAccount, String(restockInventory)], () => undefined);
export const getInvoiceOutstanding = (id: number) => callRow('getInvoiceOutstanding', [String(id)], (f): { outstanding_minor: number } => ({ outstanding_minor: Number(f[0]) }));
export const allocatePaymentToInvoice = (id: number, paymentReference: string, allocatedMinor: number, allocationDate: string, paymentAccount: string) =>
  callRow('allocatePaymentToInvoice', [String(id), paymentReference, String(allocatedMinor), allocationDate, paymentAccount], () => undefined);

/** A real, exported UBL 2.1 XML document - now travels back as one
 * ordinary, csvField-escaped call-protocol row value (handles embedded
 * commas/quotes/newlines exactly like any other string) instead of a raw
 * fetch of a separate XML endpoint; the one live caller already builds
 * its own Blob/download link client-side from the returned text, so
 * nothing about that behavior changes. */
export const exportInvoiceAsEInvoice = (id: number) => callRow('exportInvoiceAsEInvoice', [String(id)], (f): string => f[0]);

// Returns the PDF as a base64 string (invoice.ts's own routes/invoice.ts
// counterpart streamed a binary file; the CSV call-dispatch protocol
// carries no binary, so the buffer is base64-encoded as one ordinary
// field — decode it back into bytes for a real download, same "build the
// download link client-side" approach as exportInvoiceAsEInvoice above).
export const exportInvoicePdf = (input: { invoiceReference: string; customerName: string; date: string; business: string; ledger: string; lineReferences: string[] }) =>
  callRow(
    'exportInvoicePdf',
    [input.invoiceReference, input.customerName, input.date, input.business, input.ledger, encodeStringList(input.lineReferences)],
    (f): string => f[0]
  );

export interface EInvoiceDiscrepancy {
  field: string;
  poValue: string;
  invoiceValue: string;
}
export interface ImportEInvoiceResult {
  invoiceId: number;
  discrepancies: EInvoiceDiscrepancy[];
}
export const importEInvoice = (xml: string, business: BusinessName, ledger: LedgerName, vendorName: ProviderName, poReference?: string) =>
  callRow('importEInvoice', [xml, business, ledger, vendorName, poReference], (f): ImportEInvoiceResult => ({
    invoiceId: Number(f[0]),
    discrepancies: decodeRecordList(['field', 'poValue', 'invoiceValue'], f[1]).map((r) => ({ field: r.field, poValue: r.poValue, invoiceValue: r.invoiceValue })),
  }));

export interface AgedRow {
  invoice_id: number;
  reference: string;
  counterparty: string;
  invoice_date: string;
  due_date: string | null;
  outstanding_minor: number;
  days_overdue: number;
  bucket: string;
}
export interface AgedSummaryRow {
  counterparty: string;
  outstanding_minor: number;
  oldest_days_overdue: number;
}
export const getAgedInvoices = (business: BusinessName, ledger: LedgerName, invoiceType: 'AR' | 'AP', asOfDate?: string) =>
  callTable('getAgedInvoices', [business, ledger, invoiceType, asOfDate], (f): AgedRow => ({
    invoice_id: Number(f.invoice_id),
    reference: f.reference,
    counterparty: f.counterparty,
    invoice_date: f.invoice_date,
    due_date: f.due_date || null,
    outstanding_minor: Number(f.outstanding_minor),
    days_overdue: Number(f.days_overdue),
    bucket: f.bucket,
  }));
export const getAgedSummary = (business: BusinessName, ledger: LedgerName, invoiceType: 'AR' | 'AP', asOfDate?: string) =>
  callTable('getAgedSummary', [business, ledger, invoiceType, asOfDate], (f): AgedSummaryRow => ({
    counterparty: f.counterparty,
    outstanding_minor: Number(f.outstanding_minor),
    oldest_days_overdue: Number(f.oldest_days_overdue),
  }));

export interface StatementLine {
  invoice_id: number;
  reference: string;
  invoice_date: string;
  due_date: string | null;
  total_minor: number;
  paid_minor: number;
  outstanding_minor: number;
  status: 'Paid' | 'Outstanding' | 'Partially paid';
}
export interface CustomerStatement {
  customer: string;
  as_of_date: string;
  lines: StatementLine[];
  total_outstanding_minor: number;
}
export const getCustomerStatement = (business: BusinessName, ledger: LedgerName, customer: string, asOfDate?: string) =>
  callRow('getCustomerStatement', [business, ledger, customer, asOfDate], (f): CustomerStatement => ({
    customer: f[0],
    as_of_date: f[1],
    lines: decodeRecordList(['invoice_id', 'reference', 'invoice_date', 'due_date', 'total_minor', 'paid_minor', 'outstanding_minor', 'status'], f[2]).map((r) => ({
      invoice_id: Number(r.invoice_id),
      reference: r.reference,
      invoice_date: r.invoice_date,
      due_date: r.due_date || null,
      total_minor: Number(r.total_minor),
      paid_minor: Number(r.paid_minor),
      outstanding_minor: Number(r.outstanding_minor),
      status: r.status as 'Paid' | 'Outstanding' | 'Partially paid',
    })),
    total_outstanding_minor: Number(f[3]),
  }));

export interface HistoryLine {
  invoice_reference: string;
  invoice_date: string;
  document_type: 'invoice' | 'credit_note' | 'debit_memo';
  description: string;
  quantity: number | null;
  unit_price_minor: number | null;
  amount_minor: number;
}
export const getCounterpartyHistory = (business: BusinessName, ledger: LedgerName, counterparty: string) =>
  callTable('getCounterpartyHistory', [business, ledger, counterparty], (f): HistoryLine => ({
    invoice_reference: f.invoice_reference,
    invoice_date: f.invoice_date,
    document_type: f.document_type as 'invoice' | 'credit_note' | 'debit_memo',
    description: f.description,
    quantity: f.quantity === '' ? null : Number(f.quantity),
    unit_price_minor: f.unit_price_minor === '' ? null : Number(f.unit_price_minor),
    amount_minor: Number(f.amount_minor),
  }));

export interface ReminderCandidate {
  counterparty: string;
  current_level: number;
  next_level: number;
  outstanding_minor: number;
  oldest_days_overdue: number;
}
export const getReminderCandidates = (business: BusinessName, ledger: LedgerName, asOfDate?: string) =>
  callTable('getReminderCandidates', [business, ledger, asOfDate], (f): ReminderCandidate => ({
    counterparty: f.counterparty,
    current_level: Number(f.current_level),
    next_level: Number(f.next_level),
    outstanding_minor: Number(f.outstanding_minor),
    oldest_days_overdue: Number(f.oldest_days_overdue),
  }));
export const sendReminder = (counterparty: string) => callRow('sendReminder', [counterparty], (f): { new_level: number } => ({ new_level: Number(f[0]) }));
export const resetReminder = (counterparty: string) => callRow('resetReminder', [counterparty], () => undefined);

// ---------------------------------------------------------------------------
// Stock write-offs and lot/expiration tracking
// ---------------------------------------------------------------------------

export const writeOffItems = (input: {
  business: BusinessName;
  ledger: LedgerName;
  reference: string;
  itemName: ItemName;
  quantity: number;
  unitCostMinor: number;
  writeOffExpenseAccount: string;
  inventoryAccount: string;
  reason: string;
  transdate?: string;
}) =>
  callRow(
    'writeOffItems',
    [input.business, input.ledger, input.reference, input.itemName, String(input.quantity), String(input.unitCostMinor), input.writeOffExpenseAccount, input.inventoryAccount, input.reason, input.transdate],
    () => undefined
  );

export const receiveLot = (input: {
  business: BusinessName;
  ledger: LedgerName;
  reference: string;
  itemName: ItemName;
  lotNumber: string;
  receivedDate: string;
  expirationDate?: string | null;
  quantity: number;
}) =>
  callRow(
    'receiveLot',
    [input.business, input.ledger, input.reference, input.itemName, input.lotNumber, input.receivedDate, input.expirationDate ?? undefined, String(input.quantity)],
    () => undefined
  );

export interface ExpiringLot {
  item: string;
  lot_number: string;
  expiration_date: string;
  quantity_on_hand: number;
  days_until_expiration: number;
}
export const getExpiringStock = (asOfDate?: string, withinDays = 30) =>
  callTable('getExpiringStock', [asOfDate, String(withinDays)], (f) => ({
    item: f.item,
    lot_number: f.lot_number,
    expiration_date: f.expiration_date,
    quantity_on_hand: Number(f.quantity_on_hand),
    days_until_expiration: Number(f.days_until_expiration),
  }));

// ---------------------------------------------------------------------------
// Locations, per-location stock, transfers, below-reorder, and Stock Takes
// ---------------------------------------------------------------------------

export interface LocationInput {
  city: string;
  location_type: string;
  is_billing_address: boolean;
  bottle_capacity?: number | null;
  carton_capacity?: number | null;
  timezone: string; // IANA identifier, required — see docs/pm-frontend-reference.md
}
export interface LocationRecord extends LocationInput {
  name: string;
}

export const listLocations = (business: BusinessName) =>
  callTable('listLocations', [business], (f): LocationRecord => ({
    name: f.name,
    city: f.city,
    location_type: f.location_type,
    is_billing_address: f.is_billing_address === 'true',
    bottle_capacity: f.bottle_capacity === '' ? null : Number(f.bottle_capacity),
    carton_capacity: f.carton_capacity === '' ? null : Number(f.carton_capacity),
    timezone: f.timezone,
  }));

export interface EmployeeClock {
  employee: string;
  po_reference: string;
  project_expense_account: string;
  clocked_in_at: string;
}
const parseEmployeeClock = (f: string[]): EmployeeClock => ({ employee: f[0], po_reference: f[1], project_expense_account: f[2], clocked_in_at: f[3] });
export const clockInToProject = (employeeName: EmployeeName, projectExpenseAccount: string, business: BusinessName, ledger: LedgerName) =>
  callRow('clockInToProject', [employeeName, projectExpenseAccount, business, ledger], parseEmployeeClock);
export const clockOutOfProject = (employeeName: EmployeeName, business: BusinessName, ledger: LedgerName) =>
  callRow('clockOutOfProject', [employeeName, business, ledger], () => undefined);
export const getOpenProjectClock = (employeeName: EmployeeName) =>
  callRow('getOpenProjectClock', [employeeName], (f): EmployeeClock | null => (f[0] ? parseEmployeeClock(f) : null));
export const getLocationByName = (name: string) =>
  callRow('getLocationByName', [name], (f): LocationRecord => ({
    name: f[0],
    city: f[1],
    location_type: f[2],
    is_billing_address: f[3] === 'true',
    bottle_capacity: f[4] === '' ? null : Number(f[4]),
    carton_capacity: f[5] === '' ? null : Number(f[5]),
    timezone: f[6],
  }));
// Scoped by business, like createLocation — see docs/pm-frontend-reference.md.
export const saveLocation = (name: string, input: LocationInput, business: string) =>
  callRow(
    'saveLocation',
    [name, business, input.city, input.location_type, String(input.is_billing_address), input.bottle_capacity == null ? '' : String(input.bottle_capacity), input.carton_capacity == null ? '' : String(input.carton_capacity), input.timezone],
    () => undefined
  );

// A single atomic server-side request — see docs/pm-frontend-reference.md.
export const createLocation = (name: string, business: string, input: LocationInput) =>
  callRow(
    'createLocation',
    [name, business, input.city, input.location_type, String(input.is_billing_address), input.bottle_capacity == null ? '' : String(input.bottle_capacity), input.carton_capacity == null ? '' : String(input.carton_capacity), input.timezone],
    () => undefined
  );

// Name-based, since listLocations's own LocationRecord carries no entity id
// — see deleteLocation in db.ts. revokeEntity's own guards (capacity
// account, inventory, journal_line postings, a Division tag) do the real
// safety work.
export const deleteLocation = (name: string, business: string) => callRow('deleteLocation', [name, business], () => undefined);

// Department CRUD + Employee ↔ Department/Manager — mirrors deleteLocation's
// own business-scoped, name-based conventions. See backend/src/routes/departments.ts
// and /root/.claude/plans/stateful-snacking-adleman.md.
export interface DepartmentRecord {
  id: number;
  name: string;
}
export const listDepartments = (business: string) => callTable('listDepartments', [business], (f) => ({ id: Number(f.id), name: f.name }));
export const createDepartment = (business: string, name: string) => callRow('createDepartment', [business, name], (f) => ({ id: Number(f[0]), name: f[1] }));
export const deleteDepartment = (name: string, business: string) => callRow('deleteDepartment', [name, business], () => undefined);

export interface OrgChartEmployee {
  name: string;
  location: string | null;
  managerName: string | null;
}
export interface OrgChartDepartment {
  name: string;
  employees: OrgChartEmployee[];
}
export interface OrgChartStructure {
  business: string;
  departments: OrgChartDepartment[];
  unassignedEmployees: OrgChartEmployee[];
}
export const getOrgChartStructure = async (business: string): Promise<OrgChartStructure> => {
  const rawRows = await callTable('getOrgChartStructure', [business], (f) => f);
  const departments: OrgChartDepartment[] = [];
  const byName = new Map<string, OrgChartDepartment>();
  const unassignedEmployees: OrgChartEmployee[] = [];
  for (const r of rawRows) {
    if (r.section === 'unassigned') {
      unassignedEmployees.push({ name: r.employeeName, location: r.location || null, managerName: r.managerName || null });
      continue;
    }
    let dept = byName.get(r.department);
    if (!dept) {
      dept = { name: r.department, employees: [] };
      byName.set(r.department, dept);
      departments.push(dept);
    }
    if (r.employeeName !== '') dept.employees.push({ name: r.employeeName, location: r.location || null, managerName: r.managerName || null });
  }
  return { business, departments, unassignedEmployees };
};

export const setEmployeeDepartment = (employeeName: string, departmentName: string) => callRow('setEmployeeDepartment', [employeeName, departmentName], () => undefined);
export const deleteEmployeeDepartment = (employeeName: string) => callRow('deleteEmployeeDepartment', [employeeName], () => undefined);
export const setEmployeeManager = (employeeName: string, managerName: string) => callRow('setEmployeeManager', [employeeName, managerName], () => undefined);
export const deleteEmployeeManager = (employeeName: string) => callRow('deleteEmployeeManager', [employeeName], () => undefined);

// Reuses the Hierarchy/Product mechanism — see docs/pm-frontend-reference.md.
export const convertStorageSpace = (input: {
  business: string;
  ledger: string;
  itemName: string;
  definitionDimensions: [string, string][];
  fromValues: string[];
  toValues: string[];
  quantity: number;
  reference?: string;
}) =>
  callRow(
    'convertStorageSpace',
    [input.business, input.ledger, input.itemName, encodeShape(input.definitionDimensions), encodeStringList(input.fromValues), encodeStringList(input.toValues), String(input.quantity), input.reference],
    () => undefined
  );

export const openStorageContainer = (input: {
  business: string;
  ledger: string;
  location: string;
  item: string;
  definitionDimensions: [string, string][];
  containerValues: string[];
  cartonsOpened: number;
  unitValues: string[];
  unitsProduced: number;
  reference?: string;
}) =>
  callRow(
    'openStorageContainer',
    [
      input.business,
      input.ledger,
      input.location,
      input.item,
      encodeShape(input.definitionDimensions),
      encodeStringList(input.containerValues),
      String(input.cartonsOpened),
      encodeStringList(input.unitValues),
      String(input.unitsProduced),
      input.reference,
    ],
    () => undefined
  );

// The frontend-driven canned journal pattern — see docs/pm-frontend-reference.md.
export interface ResolvedOpenContainerAccounts {
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
}
export const resolveOpenContainerAccounts = (input: {
  business: string;
  location: string;
  item: string;
  definitionDimensions: [string, string][];
  containerValues: string[];
  unitValues: string[];
}) =>
  callRow(
    'resolveOpenContainerAccounts',
    [input.business, input.location, input.item, encodeShape(input.definitionDimensions), encodeStringList(input.containerValues), encodeStringList(input.unitValues)],
    (f): ResolvedOpenContainerAccounts => ({
      containerSpaceAccount: f[0],
      containerOccupiedAccount: f[1],
      unitSpaceAccount: f[2],
      unitOccupiedAccount: f[3],
      containerSpaceAccountId: Number(f[4]),
      containerOccupiedAccountId: Number(f[5]),
      unitSpaceAccountId: Number(f[6]),
      unitOccupiedAccountId: Number(f[7]),
      inventoryFromAccount: f[8],
      inventoryToAccount: f[9],
      inventoryFromAccountId: Number(f[10]),
      inventoryToAccountId: Number(f[11]),
      unitCostMinor: f[12] === '' ? null : Number(f[12]),
    })
  );

// See docs/pm-frontend-reference.md.
export const getLocationCurrencies = (locationName: string) => callRow('getLocationCurrencies', [locationName], (f) => decodeStringList(f[0]));
export const nominateLocationCurrency = (locationName: string, currencyCode: string) => callRow('nominateLocationCurrency', [locationName, currencyCode], () => undefined);

export interface PosTerminalRecord {
  name: string;
  currency: string | null;
}
export const getPosTerminals = (locationName: string) => callTable('getPosTerminals', [locationName], (f) => ({ name: f.name, currency: f.currency || null }));
export const createPosTerminal = (locationName: string, terminalName: string, currency?: string) => callRow('createPosTerminal', [locationName, terminalName, currency], () => undefined);

export interface OpenHoursLine {
  day: string;
  opens_at: string;
  closes_at: string;
}
export const getLocationOpenHours = (locationName: LocationName) =>
  callTable('getLocationOpenHours', [locationName], (f): OpenHoursLine => ({ day: f.day, opens_at: f.opens_at, closes_at: f.closes_at }));
export const setLocationOpenHours = (locationName: LocationName, hours: OpenHoursLine[]) =>
  callRowWithLines('setLocationOpenHours', [locationName], hours.map((h) => [h.day, h.opens_at, h.closes_at]), () => undefined);

export interface ScheduleLine {
  day: string;
  starts_at: string;
  ends_at: string;
}
export interface EmployeeScheduleLine extends ScheduleLine {
  location: string;
}
export interface LocationScheduleLine extends ScheduleLine {
  employee: string;
}
// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const getScheduleAtLocation = (locationName: LocationName) => request<LocationScheduleLine[]>(`/locations/${encodeURIComponent(locationName)}/schedule`);
export const getEmployeeSchedule = (employeeName: EmployeeName) =>
  callTable('getEmployeeSchedule', [employeeName], (f): EmployeeScheduleLine => ({ location: f.location, day: f.day, starts_at: f.starts_at, ends_at: f.ends_at }));
export const setEmployeeSchedule = (employeeName: EmployeeName, locationName: LocationName, schedule: ScheduleLine[]) =>
  callRowWithLines('setEmployeeSchedule', [employeeName, locationName], schedule.map((s) => [s.day, s.starts_at, s.ends_at]), () => undefined);

export interface ItemLocationLevels {
  quantity_on_hand: number;
  min_level: number | null;
  max_level: number | null;
  reorder_level: number | null;
  shelf_side: string | null;
  rack: string | null;
  level: number | null;
}
export const getItemLocation = (itemName: ItemName, locationName: LocationName) =>
  callRow('getItemLocation', [itemName, locationName], (f): ItemLocationLevels => ({
    quantity_on_hand: Number(f[0]),
    min_level: f[1] === '' ? null : Number(f[1]),
    max_level: f[2] === '' ? null : Number(f[2]),
    reorder_level: f[3] === '' ? null : Number(f[3]),
    shelf_side: f[4] || null,
    rack: f[5] || null,
    level: f[6] === '' ? null : Number(f[6]),
  }));
export const setItemLocationLevels = (
  itemName: ItemName,
  locationName: LocationName,
  levels: { minLevel?: number | null; maxLevel?: number | null; reorderLevel?: number | null; shelfSide?: string | null; rack?: string | null; level?: number | null },
  businessName: string,
  ledgerName?: string
) =>
  callRow(
    'setItemLocationLevels',
    [
      itemName,
      locationName,
      levels.minLevel == null ? '' : String(levels.minLevel),
      levels.maxLevel == null ? '' : String(levels.maxLevel),
      levels.reorderLevel == null ? '' : String(levels.reorderLevel),
      levels.shelfSide ?? '',
      levels.rack ?? '',
      levels.level == null ? '' : String(levels.level),
      businessName,
      ledgerName,
    ],
    () => undefined
  );

export const receiveItems = (
  locationName: LocationName,
  input: { business: BusinessName; ledger: LedgerName; reference: string; itemName: ItemName; quantity: number; transdate?: string; combinationValues?: string[]; combinationShape?: [string, string][] }
) =>
  callRow(
    'receiveItems',
    [locationName, input.business, input.ledger, input.reference, input.itemName, String(input.quantity), input.transdate, encodeStringList(input.combinationValues), encodeShape(input.combinationShape)],
    () => undefined
  );

// The narrow, physical-only half of the canned journal pattern — see docs/pm-frontend-reference.md.
export const receiveIntoStorageStock = (
  locationName: LocationName,
  input: { business: BusinessName; ledger: LedgerName; reference: string; itemName: ItemName; quantity: number; transdate?: string; combinationValues?: string[]; combinationShape?: [string, string][] }
) =>
  callRow(
    'receiveIntoStorageStock',
    [locationName, input.business, input.ledger, input.reference, input.itemName, String(input.quantity), input.transdate, encodeStringList(input.combinationValues), encodeShape(input.combinationShape)],
    () => undefined
  );

export interface ResolvedReceiveAccounts {
  inventoryAccount: string;
  payableAccount: string;
  unitCostMinor: number | null;
}
export const resolveReceiveAccounts = (input: { business: BusinessName; itemName: ItemName; combinationValues?: string[]; combinationShape?: [string, string][] }) =>
  callRow(
    'resolveReceiveAccounts',
    [input.business, input.itemName, encodeStringList(input.combinationValues), encodeShape(input.combinationShape)],
    (f): ResolvedReceiveAccounts | null =>
      f[0] === '0' ? null : { inventoryAccount: f[1], payableAccount: f[2], unitCostMinor: f[3] === '' ? null : Number(f[3]) }
  );

// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const dispatchItems = (
//   locationName: LocationName,
//   input: { business: BusinessName; ledger: LedgerName; reference: string; itemName: ItemName; quantity: number; transdate?: string }
// ) => request<void>(`/locations/${encodeURIComponent(locationName)}/dispatch`, { method: 'POST', body: JSON.stringify(input) });

export const transferItems = (input: { business: BusinessName; ledger: LedgerName; itemName: ItemName; fromLocationName: string; toLocationName: string; quantity: number; reference: string }) =>
  callRow('transferItems', [input.business, input.ledger, input.itemName, input.fromLocationName, input.toLocationName, String(input.quantity), input.reference, undefined], () => undefined);

// The narrow, physical-only half of the canned journal pattern — see docs/pm-frontend-reference.md.
export const transferStock = (input: { business: BusinessName; ledger: LedgerName; itemName: ItemName; fromLocationName: string; toLocationName: string; quantity: number; reference: string; transdate?: string }) =>
  callRow(
    'transferStock',
    [input.business, input.ledger, input.itemName, input.fromLocationName, input.toLocationName, String(input.quantity), input.reference, input.transdate],
    () => undefined
  );

export interface ResolvedTransferAccounts {
  fromInventoryAccount: string;
  toInventoryAccount: string;
  unitCostMinor: number | null;
}
export const resolveTransferAccounts = (input: { business: BusinessName; itemName: ItemName; fromLocationName: string; toLocationName: string }) =>
  callRow('resolveTransferAccounts', [input.business, input.itemName, input.fromLocationName, input.toLocationName], (f): ResolvedTransferAccounts => ({
    fromInventoryAccount: f[0],
    toInventoryAccount: f[1],
    unitCostMinor: f[2] === '' ? null : Number(f[2]),
  }));

export interface BelowReorderRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  reorder_level: number;
  min_level: number | null;
  max_level: number | null;
}
export const getBelowReorderStock = () =>
  callTable('getBelowReorderStock', [], (f): BelowReorderRow => ({
    item: f.item,
    location: f.location,
    quantity_on_hand: Number(f.quantity_on_hand),
    reorder_level: Number(f.reorder_level),
    min_level: f.min_level === '' ? null : Number(f.min_level),
    max_level: f.max_level === '' ? null : Number(f.max_level),
  }));
export interface StockOutRiskRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  daily_consumption_rate: number;
  days_until_stockout: number | null;
  shortest_lead_time_days: number | null;
  at_risk: boolean;
}
export const getStockOutRiskReport = (windowDays = 2) =>
  callTable('getStockOutRiskReport', [String(windowDays)], (f): StockOutRiskRow => ({
    item: f.item,
    location: f.location,
    quantity_on_hand: Number(f.quantity_on_hand),
    daily_consumption_rate: Number(f.daily_consumption_rate),
    days_until_stockout: f.days_until_stockout === '' ? null : Number(f.days_until_stockout),
    shortest_lead_time_days: f.shortest_lead_time_days === '' ? null : Number(f.shortest_lead_time_days),
    at_risk: f.at_risk === 'true',
  }));
// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const setItemSourceLeadTime = (item: string, vendor: string, days: number) =>
//   callRow('setItemSourceLeadTime', [item, vendor, String(days)], () => undefined);

export interface PickingListLine {
  invoiceLineId: number;
  item: string;
  quantity: number;
  shelfSide: string | null;
  rack: string | null;
  level: number | null;
  picked: boolean;
}
export interface RestockLineInput {
  item: string;
  quantity: number;
}
export const getRestockPickingList = async (runReference: string, warehouseName: string, lines: RestockLineInput[]): Promise<PickingListLine[]> => {
  const rawLines = await callRawWithLines('getRestockPickingList', [runReference, warehouseName], lines.map((l) => [l.item, String(l.quantity)]));
  if (rawLines.length < 2) return [];
  const header = rawLines[1];
  return rawLines.slice(2).map((fields) => {
    const f = Object.fromEntries(header.map((h, i) => [h, fields[i] ?? '']));
    return {
      invoiceLineId: Number(f.invoiceLineId),
      item: f.item,
      quantity: Number(f.quantity),
      shelfSide: f.shelfSide || null,
      rack: f.rack || null,
      level: f.level === '' ? null : Number(f.level),
      picked: f.picked === 'true',
    };
  });
};
export const confirmRestockPickedLine = (runReference: string, item: string, business: BusinessName, ledger: LedgerName) =>
  callRow('confirmRestockPickedLine', [runReference, item, business, ledger], () => undefined);
export const dispatchRestockRun = (
  runReference: string,
  business: BusinessName,
  ledger: LedgerName,
  warehouseName: string,
  retailOutletName: string,
  lines: RestockLineInput[],
  transdate?: string
) =>
  callRowWithLines('dispatchRestockRun', [runReference, business, ledger, warehouseName, retailOutletName, transdate], lines.map((l) => [l.item, String(l.quantity)]), () => undefined);

export interface StockTakeLine {
  id: number;
  item: string;
  shelf_side: string | null;
  rack: string | null;
  level: number | null;
  expected_quantity: number;
  counted_quantity: number | null;
}
export interface StockTake {
  id: number;
  location: string;
  take_date: string;
  status: 'draft' | 'completed';
  lines: StockTakeLine[];
}

export const createStockTake = (locationName: LocationName, takeDate: string, businessName?: string) =>
  callRow('createStockTake', [locationName, takeDate, businessName], (f) => ({ id: Number(f[0]) }));
export const getStockTake = (id: number) =>
  callRow('getStockTake', [String(id)], (f): StockTake => ({
    id: Number(f[0]),
    location: f[1],
    take_date: f[2],
    status: f[3] as 'draft' | 'completed',
    lines: decodeRecordList(['id', 'item', 'shelf_side', 'rack', 'level', 'expected_quantity', 'counted_quantity'], f[4]).map((r) => ({
      id: Number(r.id),
      item: r.item,
      shelf_side: r.shelf_side || null,
      rack: r.rack || null,
      level: r.level === '' ? null : Number(r.level),
      expected_quantity: Number(r.expected_quantity),
      counted_quantity: r.counted_quantity === '' ? null : Number(r.counted_quantity),
    })),
  }));
export const recordStockTakeCount = (id: number, itemName: ItemName, countedQuantity: number) =>
  callRow('recordStockTakeCount', [String(id), itemName, String(countedQuantity)], () => undefined);
export const completeStockTake = (
  id: number,
  business: BusinessName,
  ledger: LedgerName,
  varianceExpenseAccount: string,
  inventoryAccount: string,
  unitCostMinorByItem: Record<string, number>
) =>
  callRow(
    'completeStockTake',
    [String(id), business, ledger, varianceExpenseAccount, inventoryAccount, encodeRecordList(['key', 'value'], Object.entries(unitCostMinorByItem).map(([key, value]) => ({ key, value: String(value) })))],
    () => undefined
  );

// ---------------------------------------------------------------------------
// POS terminal
// ---------------------------------------------------------------------------

function decodeStringList(encoded: string): string[] {
  if (encoded === '') return [];
  return splitCsvLine(encoded).map(unescapeAscii);
}
function decodeShape(encoded: string): [string, string][] | undefined {
  if (encoded === '') return undefined;
  const flat = decodeStringList(encoded);
  const pairs: [string, string][] = [];
  for (let i = 0; i < flat.length; i += 2) pairs.push([flat[i], flat[i + 1]]);
  return pairs;
}
function encodeStringList(values: string[] | undefined): string {
  if (!values || values.length === 0) return '';
  return values.map(csvField).join(',');
}
function encodeShape(shape: [string, string][] | undefined): string {
  if (!shape || shape.length === 0) return '';
  return encodeStringList(shape.flat());
}
// Matches call-dispatch.ts's own encodeRecordList/decodeRecordList exactly
// — a real response can nest a whole further array of records inside one
// field (journal.ts's previewCloseBooks: lines[]/groupBreakdown[]/
// profitCenterBreakdown[]), encoded by reusing encodeStringList one level
// deeper rather than inventing a new scheme.
function decodeRecordList(fields: string[], encoded: string): Record<string, string>[] {
  return decodeStringList(encoded).map((lineEncoded) => {
    const values = decodeStringList(lineEncoded);
    return Object.fromEntries(fields.map((f, i) => [f, values[i] ?? '']));
  });
}
function encodeRecordList<T>(fields: (keyof T & string)[], records: T[]): string {
  return encodeStringList(records.map((r) => encodeStringList(fields.map((f) => (r[f] === null || r[f] === undefined ? '' : String(r[f]))))));
}

// Matches call-dispatch.ts's own encodeCategoryTree/decodeCategoryTree
// exactly — a genuine, arbitrary-depth recursive tree (Balance Sheet/
// Profit and Loss's own category trees), decoded by calling itself again
// on each node's own encoded children, however deep the real tree goes.
function decodeCategoryTree(encoded: string): CategoryTreeNode[] {
  return decodeStringList(encoded).map((lineEncoded) => {
    const f = decodeStringList(lineEncoded);
    return { name: f[0], accountnumber: f[1] || null, is_leaf: f[2] === 'true', debit_minor: Number(f[3]), credit_minor: Number(f[4]), is_contra: f[5] === 'true', children: decodeCategoryTree(f[6]) };
  });
}

export const lookupItemByUpc = (upc: string) =>
  callRow('lookupByUpc', [upc], (f): ItemSummary => ({
    name: f[0],
    description: f[1] || null,
    unit_of_measure: f[2] || null,
    upc: f[3] || null,
    retail_price_minor: f[4] ? Number(f[4]) : null,
    source_count: Number(f[5]),
    storage_origin: (f[6] || null) as 'Hot' | 'Cold' | null,
    product: f[7] || null,
    combinationValues: f[8] ? decodeStringList(f[8]) : undefined,
    combinationShape: f[9] ? decodeShape(f[9]) : undefined,
  }));

export interface PosSaleLineInput {
  itemName: ItemName;
  quantity: number;
  unitPriceMinor?: number;
  taxMinor: number;
  tier?: string;
  combinationValues?: string[]; // set when a scanned barcode matches a specific combination — see docs/pm-frontend-reference.md
  combinationShape?: [string, string][];
}
export interface PosSaleResult {
  invoiceId: number;
  reference: string;
  totalMinor: number;
  changeDueMinor: number;
}
export const completePosSale = (input: {
  business: BusinessName;
  ledger: LedgerName;
  locationName: LocationName;
  customerName: CustomerName;
  lines: PosSaleLineInput[];
  revenueAccount?: string;
  taxAccount: string;
  paymentMethod?: string;
  cashTenderedMinor?: number;
  transdate?: string;
  terminalName?: string;
}) =>
  callRowWithLines(
    'completePosSale',
    [input.business, input.ledger, input.locationName, input.customerName, input.revenueAccount, input.taxAccount, input.paymentMethod, input.cashTenderedMinor === undefined ? undefined : String(input.cashTenderedMinor), input.transdate, input.terminalName],
    input.lines.map((l) => [l.itemName, String(l.quantity), l.unitPriceMinor === undefined ? undefined : String(l.unitPriceMinor), String(l.taxMinor), l.tier, encodeStringList(l.combinationValues), encodeShape(l.combinationShape)]),
    (f): PosSaleResult => ({ invoiceId: Number(f[0]), reference: f[1], totalMinor: Number(f[2]), changeDueMinor: Number(f[3]) })
  );

export interface CashPurchaseLineInput {
  itemName: ItemName;
  quantity: number;
  unitPriceMinor: number;
  taxMinor: number;
}
export interface CashPurchaseResult {
  invoiceId: number;
  reference: string;
  totalMinor: number;
}
export const completeCashPurchase = (input: {
  business: BusinessName;
  ledger: LedgerName;
  locationName: LocationName;
  vendorName: ProviderName;
  lines: CashPurchaseLineInput[];
  taxAccount: string;
  paymentMethod?: string;
  transdate?: string;
}) =>
  callRowWithLines(
    'completeCashPurchase',
    [input.business, input.ledger, input.locationName, input.vendorName, input.taxAccount, input.paymentMethod, input.transdate],
    input.lines.map((l) => [l.itemName, String(l.quantity), String(l.unitPriceMinor), String(l.taxMinor)]),
    (f): CashPurchaseResult => ({ invoiceId: Number(f[0]), reference: f[1], totalMinor: Number(f[2]) })
  );

export const receiveStock = (input: {
  business: BusinessName;
  ledger: LedgerName;
  reference: string;
  locationName: LocationName;
  lines: { itemName: string; quantity: number }[];
  transdate?: string;
}) =>
  callRowWithLines(
    'receiveStock',
    [input.business, input.ledger, input.reference, input.locationName, input.transdate],
    input.lines.map((l) => [l.itemName, String(l.quantity)]),
    () => undefined
  );

export const dispatchStock = (input: {
  business: BusinessName;
  ledger: LedgerName;
  reference: string;
  locationName: LocationName;
  lines: { itemName: string; quantity: number }[];
  transdate?: string;
}) =>
  callRowWithLines(
    'dispatchStock',
    [input.business, input.ledger, input.reference, input.locationName, input.transdate],
    input.lines.map((l) => [l.itemName, String(l.quantity)]),
    () => undefined
  );

export interface PayWagesResult {
  invoiceId: number;
  reference: string;
  grossMinor: number;
  medicareLevyMinor: number;
  superannuationMinor: number;
  netMinor: number;
}
export const payEmployeeWages = (input: {
  business: BusinessName;
  ledger: LedgerName;
  employeeName: EmployeeName;
  hours?: number; // hourly employees only — a salaried mismatch is refused
  wagesExpenseAccount?: string;
  paymentMethod?: string;
  transdate?: string;
}) =>
  callRow(
    'payEmployeeWages',
    [input.business, input.ledger, input.employeeName, input.hours === undefined ? undefined : String(input.hours), input.wagesExpenseAccount, input.paymentMethod, input.transdate],
    (f): PayWagesResult => ({ invoiceId: Number(f[0]), reference: f[1], grossMinor: Number(f[2]), medicareLevyMinor: Number(f[3]), superannuationMinor: Number(f[4]), netMinor: Number(f[5]) })
  );

export interface OrganizationChart {
  business: BusinessName;
  companyWideEmployees: string[];
  groups: { group: HierarchyGroupName; locations: { location: string; employees: string[] }[] }[];
}
export const getOrganizationChart = async (businessName: string): Promise<OrganizationChart> => {
  const rawRows = await callTable('getOrganizationChart', [businessName], (f) => f);
  const companyWideEmployees: string[] = [];
  const groups: { group: HierarchyGroupName; locations: { location: string; employees: string[] }[] }[] = [];
  const groupByName = new Map<string, { group: HierarchyGroupName; locations: { location: string; employees: string[] }[] }>();
  const locByKey = new Map<string, { location: string; employees: string[] }>();
  for (const r of rawRows) {
    if (r.section === 'company') {
      companyWideEmployees.push(r.employee);
      continue;
    }
    let g = groupByName.get(r.group);
    if (!g) {
      g = { group: r.group as HierarchyGroupName, locations: [] };
      groupByName.set(r.group, g);
      groups.push(g);
    }
    if (r.location === '') continue; // a group with zero locations — nothing further to add
    const key = `${r.group}\u0000${r.location}`;
    let loc = locByKey.get(key);
    if (!loc) {
      loc = { location: r.location, employees: [] };
      locByKey.set(key, loc);
      g.locations.push(loc);
    }
    if (r.employee !== '') loc.employees.push(r.employee);
  }
  return { business: businessName as BusinessName, companyWideEmployees, groups };
};

export interface CloseBooksResult {
  reference: string;
  netIncomeMinor: number;
  accountsZeroed: number;
  groupBreakdown: { group: HierarchyGroupName | null; netIncomeMinor: number }[];
  profitCenterBreakdown: { profitCenter: string | null; netIncomeMinor: number }[]; // per Profit Center, mirroring groupBreakdown
}
function parseGroupBreakdown(f: string): { group: HierarchyGroupName | null; netIncomeMinor: number }[] {
  return decodeRecordList(['group', 'netIncomeMinor'], f).map((r) => ({ group: (r.group || null) as HierarchyGroupName | null, netIncomeMinor: Number(r.netIncomeMinor) }));
}
function parseProfitCenterBreakdown(f: string): { profitCenter: string | null; netIncomeMinor: number }[] {
  return decodeRecordList(['profitCenter', 'netIncomeMinor'], f).map((r) => ({ profitCenter: r.profitCenter || null, netIncomeMinor: Number(r.netIncomeMinor) }));
}
export const closeBooks = (input: { business: BusinessName; ledger: LedgerName; asOfDate: string; retainedEarningsAccount: string; hierarchyPath?: string[] }) =>
  callRow(
    'closeBooks',
    [input.business, input.ledger, input.asOfDate, input.retainedEarningsAccount, input.hierarchyPath?.length ? encodeStringList(input.hierarchyPath) : undefined],
    (f): CloseBooksResult => ({
      reference: f[0],
      netIncomeMinor: Number(f[1]),
      accountsZeroed: Number(f[2]),
      groupBreakdown: parseGroupBreakdown(f[3]),
      profitCenterBreakdown: parseProfitCenterBreakdown(f[4]),
    })
  );

export interface CloseBooksPreview {
  lines: {
    account: AccountName;
    accountId?: number; // resolves name collisions, same as StagedLine.accountId — see docs/pm-frontend-reference.md
    amount_minor: number;
  }[];
  netIncomeMinor: number;
  accountsZeroed: number;
  groupBreakdown: { group: HierarchyGroupName | null; netIncomeMinor: number }[];
  profitCenterBreakdown: { profitCenter: string | null; netIncomeMinor: number }[];
}
export const previewCloseBooks = (input: { business: BusinessName; ledger: LedgerName; asOfDate: string; retainedEarningsAccount: string; hierarchyPath?: string[] }) =>
  callRow(
    'previewCloseBooks',
    [input.business, input.ledger, input.asOfDate, input.retainedEarningsAccount, input.hierarchyPath?.length ? encodeStringList(input.hierarchyPath) : undefined],
    (f): CloseBooksPreview => ({
      lines: decodeRecordList(['account', 'accountId', 'amount_minor'], f[0]).map((l) => ({ account: l.account as AccountName, accountId: l.accountId ? Number(l.accountId) : undefined, amount_minor: Number(l.amount_minor) })),
      netIncomeMinor: Number(f[1]),
      accountsZeroed: Number(f[2]),
      groupBreakdown: parseGroupBreakdown(f[3]),
      profitCenterBreakdown: parseProfitCenterBreakdown(f[4]),
    })
  );

// Mirrors the Close Books canned journal split, for Rollover — see docs/pm-frontend-reference.md.
export interface ResolvedRollover {
  reference: string;
  lines: { account: AccountName; amount_minor: number }[];
  accountsCarriedForward: number;
}
export const resolveRolloverLines = (input: { business: BusinessName; oldLedger: LedgerName; newLedger: LedgerName; asOfDate: string }) =>
  callRow(
    'resolveRolloverLines',
    [input.business, input.oldLedger, input.newLedger, input.asOfDate],
    (f): ResolvedRollover => ({
      reference: f[0],
      lines: decodeRecordList(['account', 'amount_minor'], f[1]).map((l) => ({ account: l.account as AccountName, amount_minor: Number(l.amount_minor) })),
      accountsCarriedForward: Number(f[2]),
    })
  );

export const createLedger = (business: BusinessName, ledger: LedgerName) => callRow('createLedger', [business, ledger], (f): { ledger: string } => ({ ledger: f[0] }));

// ---------------------------------------------------------------------------
// Customer self-registration and verification
// ---------------------------------------------------------------------------

export interface CustomerRegistrationInput {
  name: string;
  email: string;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
  country?: string | null;
  preferred_language?: string | null;
  password: string;
  card_label?: string | null;
}
export const registerCustomer = (input: CustomerRegistrationInput) =>
  callRow(
    'registerCustomer',
    [
      input.name,
      input.email,
      input.phone ?? undefined,
      input.address_line1 ?? undefined,
      input.address_line2 ?? undefined,
      input.city ?? undefined,
      input.region ?? undefined,
      input.postal_code ?? undefined,
      input.country ?? undefined,
      input.preferred_language ?? undefined,
      input.password,
      input.card_label ?? undefined,
    ],
    (fields) => ({ status: fields[0] })
  );

export interface PendingCustomer {
  name: string;
  email: string | null;
  phone: string | null;
  card_label: string | null;
}
export const listPendingCustomers = () => callTable('listPendingCustomers', [], (f) => ({ name: f.name, email: f.email || null, phone: f.phone || null, card_label: f.card_label || null }));
export const verifyCustomer = (name: string, approve: boolean) => callRow('verifyCustomer', [name, String(approve)], () => undefined);

// ---------------------------------------------------------------------------
// Stock listing — every item/location combination with real stock
// ---------------------------------------------------------------------------

export interface InventoryListingRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  min_level: number | null;
  max_level: number | null;
  reorder_level: number | null;
}
// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const getInventoryListing = (limit = 100, offset = 0) =>
//   request<{ rows: InventoryListingRow[]; totalCount: number }>(`/stock-listing?limit=${limit}&offset=${offset}`);

export interface LocationCapacityStatus {
  bottleQuantity: number;
  bottleCapacity: number | null;
  bottleOverCapacity: boolean;
  cartonQuantity: number;
  cartonCapacity: number | null;
  cartonOverCapacity: boolean;
}
export interface InventoryListingLocationGroup {
  location: string;
  city: string | null;
  group: HierarchyGroupName | null;
  rows: InventoryListingRow[];
  total_on_hand: number;
  capacity: LocationCapacityStatus;
}
export const getInventoryListingByLocation = async (businessName: string, hierarchyName?: string): Promise<InventoryListingLocationGroup[]> => {
  const flatRows = await callTable('getInventoryListingByLocation', [businessName, hierarchyName], (f) => f);
  const groups: InventoryListingLocationGroup[] = [];
  const byLocation = new Map<string, InventoryListingLocationGroup>();
  for (const f of flatRows) {
    let group = byLocation.get(f.location);
    if (!group) {
      group = {
        location: f.location,
        city: f.city || null,
        group: (f.group || null) as HierarchyGroupName | null,
        rows: [],
        total_on_hand: Number(f.total_on_hand),
        capacity: {
          bottleQuantity: Number(f.bottleQuantity),
          bottleCapacity: f.bottleCapacity === '' ? null : Number(f.bottleCapacity),
          bottleOverCapacity: f.bottleOverCapacity === 'true',
          cartonQuantity: Number(f.cartonQuantity),
          cartonCapacity: f.cartonCapacity === '' ? null : Number(f.cartonCapacity),
          cartonOverCapacity: f.cartonOverCapacity === 'true',
        },
      };
      byLocation.set(f.location, group);
      groups.push(group);
    }
    if (f.item !== '') {
      group.rows.push({
        item: f.item,
        location: f.location,
        quantity_on_hand: Number(f.quantity_on_hand),
        min_level: f.min_level === '' ? null : Number(f.min_level),
        max_level: f.max_level === '' ? null : Number(f.max_level),
        reorder_level: f.reorder_level === '' ? null : Number(f.reorder_level),
      });
    }
  }
  return groups;
};

// Storage Capacity accounts sit outside Chart of Accounts — see docs/pm-frontend-reference.md.
export interface StorageSpaceCurrencyRow {
  currency: string;
  installed_minor: number;
  occupied_minor: number;
  remaining_minor: number;
  balanced: boolean;
}
export interface StorageSpaceLocationGroup {
  location: string;
  currencies: StorageSpaceCurrencyRow[];
}
export const getStorageSpaceReport = async (): Promise<StorageSpaceLocationGroup[]> => {
  const flatRows = await callTable('getStorageSpaceReport', [], (f) => f);
  const groups: StorageSpaceLocationGroup[] = [];
  const byLocation = new Map<string, StorageSpaceLocationGroup>();
  for (const f of flatRows) {
    let group = byLocation.get(f.location);
    if (!group) {
      group = { location: f.location, currencies: [] };
      byLocation.set(f.location, group);
      groups.push(group);
    }
    if (f.currency !== '') {
      group.currencies.push({
        currency: f.currency,
        installed_minor: Number(f.installed_minor),
        occupied_minor: Number(f.occupied_minor),
        remaining_minor: Number(f.remaining_minor),
        balanced: f.balanced === 'true',
      });
    }
  }
  return groups;
};

export interface StockMovementRow {
  item: string;
  category: string | null;
  quantity: number;
  date: string;
}
export interface OrderReceiptRow extends StockMovementRow {
  location: string;
  group: HierarchyGroupName | null;
  vendor: string | null;
}
export interface StockTransferRow extends StockMovementRow {
  from_location: string;
  to_location: string;
}
export interface StockSaleRow extends StockMovementRow {
  location: string;
  group: HierarchyGroupName | null;
  vendor: string | null;
  amount_minor: number;
}
export interface StockMovementReport {
  receipts: OrderReceiptRow[];
  transfers: StockTransferRow[];
  sales: StockSaleRow[];
}
export const getStockMovementReport = (business: BusinessName, ledger: LedgerName, fromDate?: string, toDate?: string, hierarchyName?: string) =>
  callRow('getStockMovementReport', [business, ledger, fromDate, toDate, hierarchyName], (f): StockMovementReport => ({
    receipts: decodeRecordList(['item', 'category', 'quantity', 'date', 'location', 'group', 'vendor'], f[0]).map((r) => ({
      item: r.item,
      category: r.category || null,
      quantity: Number(r.quantity),
      date: r.date,
      location: r.location,
      group: (r.group || null) as HierarchyGroupName | null,
      vendor: r.vendor || null,
    })),
    transfers: decodeRecordList(['item', 'category', 'quantity', 'date', 'from_location', 'to_location'], f[1]).map((r) => ({
      item: r.item,
      category: r.category || null,
      quantity: Number(r.quantity),
      date: r.date,
      from_location: r.from_location,
      to_location: r.to_location,
    })),
    sales: decodeRecordList(['item', 'category', 'quantity', 'date', 'location', 'group', 'vendor', 'amount_minor'], f[2]).map((r) => ({
      item: r.item,
      category: r.category || null,
      quantity: Number(r.quantity),
      date: r.date,
      location: r.location,
      group: (r.group || null) as HierarchyGroupName | null,
      vendor: r.vendor || null,
      amount_minor: Number(r.amount_minor),
    })),
  }));
