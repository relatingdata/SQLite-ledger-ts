// A direct, near-verbatim port of frontend/src/lib/api.ts's own
// callRow/callTable/callRawWithLines wrapper against the real, single
// POST /api/call ASCII-CSV protocol, and the handful of functions this
// TUI's v1 scope actually needs — same call names, same positional
// argument order, same branded types. The old per-path JSON/REST
// request() wrapper this file used to carry is gone: the backend
// deleted every one of those routes (backend/src/server.ts now mounts
// only /api/health, /api/recording and /api/call), so this port is not
// optional polish, it is what makes the TUI able to log in at all.
// See docs/tui-design.md ("Why this is a thin client, not a second
// frontend") for why this is a port, not a reimplementation.
import { loadSession, saveSession, type SessionState } from './session.js';

const BASE = 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

// Branded types — re-declared independently of the backend's own and of
// the frontend's own, matching the established convention both already
// follow (docs/pm-frontend-reference.md).
export type BusinessName = string & { readonly __brand: 'BusinessName' };
export type LedgerName = string & { readonly __brand: 'LedgerName' };
export type AccountName = string & { readonly __brand: 'AccountName' };
export const asBusinessName = (name: string): BusinessName => name as BusinessName;
export const asLedgerName = (name: string): LedgerName => name as LedgerName;
export const asAccountName = (name: string): AccountName => name as AccountName;

let session: SessionState | null = loadSession();

export function getSession(): SessionState | null {
  return session;
}

export function setSession(next: SessionState | null): void {
  session = next;
  saveSession(next);
}

// Business/ledger selection is pure client-side state in the real,
// current backend — there is no server-side "session business" to set
// any more (confirmed: frontend/src/lib/api.ts has no equivalent call
// at all). Kept as a no-op, not deleted, so ChooseBusiness.tsx's
// existing `await setSessionBusiness(name)` call keeps working
// unchanged; the business name it already holds afterward is all any
// other real call below ever needed.
export const setSessionBusiness = async (_businessName: string): Promise<void> => {
  /* no-op — see comment above */
};

// --- The one, real wire protocol: ASCII-CSV over POST /api/call --------
// Mirrors frontend/src/lib/api.ts's own codec exactly (duplicated, not
// imported, since the TUI has its own separate build from the frontend's
// Vite one) — see backend/src/call-dispatch/*.ts for each function's own,
// documented positional-argument order and backend/src/routes/call.ts for
// the two response shapes ('row': one scalar line; 'table': a header
// line then zero or more data rows).
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
function text_lines(text: string): string[] {
  return text.split('\n').filter((l) => l.length > 0);
}

async function callRaw(name: string, values: (string | undefined)[]): Promise<string[][]> {
  const headers: Record<string, string> = { 'Content-Type': 'text/csv' };
  if (session) headers.Authorization = `Bearer ${session.token}`;
  const line = [name, ...values.map((v) => v ?? '')].map(csvField).join(',');
  let res: Response;
  try {
    res = await fetch(`${BASE}/call`, { method: 'POST', headers, body: line });
  } catch {
    throw new ApiError(0, `Can't reach the backend at ${BASE}. Make sure it's running (cd backend && npm run dev).`);
  }
  if (res.status === 401) setSession(null); // the session is gone — treat as logged out, same as the web frontend does
  const lines = text_lines(await res.text());
  const firstFields = splitCsvLine(lines[0] ?? '').map(unescapeAscii);
  if (firstFields[0] === 'error') throw new ApiError(res.status, firstFields[1] ?? res.statusText);
  return lines.map((l) => splitCsvLine(l).map(unescapeAscii));
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
// includes a genuine, caller-variable-length array of records (a shopping
// cart's lines, a journal's lines) — every lineItems row becomes one more
// CSV line in the request body, after the first.
async function callRawWithLines(name: string, values: (string | undefined)[], lineItems: (string | undefined)[][]): Promise<string[][]> {
  const headers: Record<string, string> = { 'Content-Type': 'text/csv' };
  if (session) headers.Authorization = `Bearer ${session.token}`;
  const firstLine = [name, ...values.map((v) => v ?? '')].map(csvField).join(',');
  const itemLines = lineItems.map((item) => item.map((v) => csvField(v ?? '')).join(','));
  const body = [firstLine, ...itemLines].join('\n');
  let res: Response;
  try {
    res = await fetch(`${BASE}/call`, { method: 'POST', headers, body });
  } catch {
    throw new ApiError(0, `Can't reach the backend at ${BASE}. Make sure it's running (cd backend && npm run dev).`);
  }
  if (res.status === 401) setSession(null);
  const lines = text_lines(await res.text());
  const firstFields = splitCsvLine(lines[0] ?? '').map(unescapeAscii);
  if (firstFields[0] === 'error') throw new ApiError(res.status, firstFields[1] ?? res.statusText);
  return lines.map((l) => splitCsvLine(l).map(unescapeAscii));
}
async function callRowWithLines<T>(name: string, values: (string | undefined)[], lineItems: (string | undefined)[][], parseResult: (fields: string[]) => T): Promise<T> {
  const lines = await callRawWithLines(name, values, lineItems);
  return parseResult(lines[0].slice(1));
}

// --- Encoding helpers (mirror frontend/src/lib/api.ts exactly) ---------

function decodeStringList(encoded: string): string[] {
  if (encoded === '') return [];
  return splitCsvLine(encoded).map(unescapeAscii);
}
function encodeStringList(values: string[] | undefined): string {
  if (!values || values.length === 0) return '';
  return values.map(csvField).join(',');
}
// Matches call-dispatch.ts's own encodeRecordList/decodeRecordList exactly
// — a real response can nest a whole further array of records inside one
// field, encoded by reusing encodeStringList one level deeper rather than
// inventing a new scheme.
function decodeRecordList(fields: string[], encoded: string): Record<string, string>[] {
  return decodeStringList(encoded).map((lineEncoded) => {
    const values = decodeStringList(lineEncoded);
    return Object.fromEntries(fields.map((f, i) => [f, values[i] ?? '']));
  });
}
function encodeRecordList<T>(fields: (keyof T & string)[], records: T[]): string {
  return encodeStringList(records.map((r) => encodeStringList(fields.map((f) => (r[f] === null || r[f] === undefined ? '' : String(r[f]))))));
}

// --- Auth --------------------------------------------------------------

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

// --- Businesses / ledgers --------------------------------------------

export const getBusinesses = () => callTable('getBusinesses', [], (f): { id: number; name: string } => ({ id: Number(f.id), name: f.name }));
export const getLedgers = (businessName: string) => callTable('getLedgers', [businessName], (f): { id: number; name: string } => ({ id: Number(f.id), name: f.name }));

// --- Menu --------------------------------------------------------------

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
// getMenuTree's two-level sections->links shape arrives flattened (one row
// per link, a no-link section as one row with empty link_* fields) —
// reassembled here into the same MenuSectionRow[] shape every screen
// already expects.
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

// --- General Journal -----------------------------------------------

export interface StagedLine {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  description?: string;
  transdate?: string;
  account: AccountName;
  amount_minor: number;
  memo?: string;
}
export const stageLine = (line: StagedLine) =>
  callRow('stageLine', [line.reference, line.business, line.ledger, line.description, line.transdate, line.account, undefined, String(line.amount_minor), line.memo], () => undefined);
// A real, live server call (backend/src/call-dispatch/journal.ts) the web
// frontend has no caller for (commented out there as unused) — this TUI
// calls it directly, same positional args, so Get really reads the
// server's own staged lines for this reference.
export const getStagedLines = (reference: string, business: BusinessName, ledger: LedgerName) =>
  callTable('getStagedLines', [reference, business, ledger], (f): StagedLine => ({
    reference: f.reference,
    business: f.business as BusinessName,
    ledger: f.ledger as LedgerName,
    description: f.description || undefined,
    transdate: f.transdate || undefined,
    account: f.account as AccountName,
    amount_minor: Number(f.amount_minor),
    memo: f.memo || undefined,
  }));
// Same real, live, frontend-unused call as above — Delete on a staged
// line really un-stages it server-side, not merely removes it from this
// screen's own, local list.
export const removeStagedLine = (reference: string, business: BusinessName, ledger: LedgerName, account: AccountName) =>
  callRow('removeStagedLine', [reference, business, ledger, account], () => undefined);
export const postJournalEntry = (reference: string, business: BusinessName, ledger: LedgerName) =>
  callRow('postJournalEntry', [reference, business, ledger], () => undefined);

// --- Balance Sheet -----------------------------------------------------

export interface StatementLine {
  name: string;
  accountnumber: string | null;
  debit_minor: number;
  credit_minor: number;
  is_contra: boolean;
}
export interface BalanceSheet {
  assets: StatementLine[];
  liabilities: StatementLine[];
  equity: StatementLine[];
  total_assets_minor: number;
  total_liabilities_minor: number;
  total_equity_minor: number;
  balanced: boolean;
}
const STATEMENT_LINE_FIELDS = ['name', 'accountnumber', 'debit_minor', 'credit_minor', 'is_contra'];
function decodeStatementLines(encoded: string): StatementLine[] {
  return decodeRecordList(STATEMENT_LINE_FIELDS, encoded).map((r) => ({
    name: r.name,
    accountnumber: r.accountnumber || null,
    debit_minor: Number(r.debit_minor),
    credit_minor: Number(r.credit_minor),
    is_contra: r.is_contra === 'true',
  }));
}
// This TUI's own BalanceSheet screen only ever needs the five flat line
// lists and totals, not the full category tree (assets_tree/
// liabilities_tree/equity_tree) the web Balance Sheet page also decodes —
// those fields (f[3]/f[4]/f[5]) are real, present in every response, and
// simply not read here.
export const getBalanceSheet = (business: BusinessName, ledger: LedgerName, asOfDate?: string) =>
  callRow('getBalanceSheet', [business, ledger, asOfDate], (f): BalanceSheet => ({
    assets: decodeStatementLines(f[0]),
    liabilities: decodeStatementLines(f[1]),
    equity: decodeStatementLines(f[2]),
    total_assets_minor: Number(f[6]),
    total_liabilities_minor: Number(f[7]),
    total_equity_minor: Number(f[8]),
    balanced: f[9] === 'true',
  }));

// --- New Business wizard ------------------------------------------
// Mirrors frontend/src/lib/api.ts's own createBusiness/nominateBankAccount/
// buildBankCurrencyStructure calls — same call names, same positional
// argument order (backend/src/call-dispatch/businesses.ts).

export type EntityStructure = 'sole_trader' | 'partnership' | 'llc' | 'unlimited_liability' | 'publicly_traded';
export type ReportingFrequency = 'annual' | 'biannual' | 'quarterly' | 'monthly';

export interface CreateBusinessResult {
  business: string;
  actualLedger: string;
  budgetLedger: string;
  businessAdmin: { username: string; password: string };
}
export const createBusiness = (
  businessName: string,
  financialYearLabel: string,
  coaPrototype?: string,
  secondaryCurrencies?: string[],
  entityStructure?: EntityStructure,
  partnerNames?: string[],
  financialYearStart?: string,
  reportingFrequency?: ReportingFrequency
) =>
  callRow(
    'Create Business',
    [businessName, financialYearLabel, coaPrototype, secondaryCurrencies?.join('|'), entityStructure, partnerNames?.join('|'), financialYearStart, reportingFrequency],
    (f): CreateBusinessResult => ({
      business: f[0],
      actualLedger: f[1],
      budgetLedger: f[2],
      businessAdmin: { username: f[3], password: f[4] },
    })
  );

export const nominateBankAccount = (businessName: string, bankAccountName: string, routingDetail: string, accountNumber: string) =>
  callRow('nominateBankAccount', [businessName, bankAccountName, routingDetail, accountNumber], (f): { id: number } => ({ id: Number(f[0]) }));

export const buildBankCurrencyStructure = (
  businessName: string,
  headerName: string,
  leafKind: 'asset' | 'equity',
  selections: { bankAccountName: string; currency: string }[],
  homeCurrency: string
) =>
  callRow('buildBankCurrencyStructure', [businessName, headerName, leafKind, encodeRecordList(['bankAccountName', 'currency'], selections), homeCurrency], () => undefined);

// --- Org Chart / Departments ----------------------------------------
// Mirrors backend/src/call-dispatch/departments.ts — a Department is a
// real, postable CoA cost-center (unlike Division, a pure reporting tag);
// Employee↔Department and Employee↔Manager are two independent facts set
// via setHierarchyTag-style name-based calls, never clobbering the
// employee's existing "Place of Employment" relationship.

export const listDepartments = (business: string) => callTable('listDepartments', [business], (f): { id: number; name: string } => ({ id: Number(f.id), name: f.name }));

export const createDepartment = (business: string, name: string) => callRow('createDepartment', [business, name], (f): { id: number; name: string } => ({ id: Number(f[0]), name: f[1] }));

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

// --- Locations ---------------------------------------------------------
// Mirrors frontend/src/lib/api.ts's own Locations section — same call
// names, same positional shapes. Unlike Department, a Location is matched
// to its own, separate same-named CoA account node by name, not the
// entity itself.

export interface LocationInput {
  city: string;
  location_type: string;
  is_billing_address: boolean;
  bottle_capacity?: number | null;
  carton_capacity?: number | null;
  timezone: string; // IANA identifier, required
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

export const getLocationTypes = () => callTable('getLocationTypes', [], (f): string => f.name);

export const createLocation = (name: string, business: string, input: LocationInput) =>
  callRow(
    'createLocation',
    [name, business, input.city, input.location_type, String(input.is_billing_address), input.bottle_capacity == null ? '' : String(input.bottle_capacity), input.carton_capacity == null ? '' : String(input.carton_capacity), input.timezone],
    () => undefined
  );

// Name-based, since listLocations's own LocationRecord carries no entity
// id — revokeEntity's own guards (capacity account, inventory,
// journal_line postings, a Division tag) do the real safety work.
export const deleteLocation = (name: string, business: string) => callRow('deleteLocation', [name, business], () => undefined);

// --- Hierarchy / Division ------------------------------------------------
// Mirrors frontend/src/lib/api.ts's own Hierarchy section — generic
// primitives; Division is just a Hierarchy literally named "Division", a
// pure reporting tag with no account of its own (unlike Location/Department).

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

export const createHierarchyGrouping = (business: string, groupingName: string) =>
  callRow('createHierarchyGrouping', [business, groupingName], (f): { name: string } => ({ name: f[0] }));
export const createHierarchyValue = (business: string, groupingName: string, valueName: string, parentValueName?: string | null) =>
  callRow('createHierarchyValue', [business, groupingName, valueName, parentValueName ?? undefined], (f): { name: string } => ({ name: f[0] }));

export const deleteHierarchyGrouping = (business: string, groupingName: string) => callRow('deleteHierarchyGrouping', [business, groupingName], () => undefined);
export const deleteHierarchyValue = (business: string, groupingName: string, valueName: string) =>
  callRow('deleteHierarchyValue', [business, groupingName, valueName], () => undefined);

export const setHierarchyTag = (entityName: string, hierarchyName: string, parentName: string) =>
  callRow('setHierarchyTag', [entityName, hierarchyName, parentName], (f): { entityName: string; hierarchyName: string; parentName: string } => ({ entityName: f[0], hierarchyName: f[1], parentName: f[2] }));
export const getHierarchyTag = (entityName: string, hierarchyName: string) =>
  callRow('getHierarchyTag', [entityName, hierarchyName], (f): { parentName: string | null } => ({ parentName: f[0] || null }));
export const deleteHierarchyTag = (entityName: string, hierarchyName: string) => callRow('deleteHierarchyTag', [entityName, hierarchyName], () => undefined);

// Every real tag for one named hierarchy in one call (entity name -> value
// name) — builds a real display tree without one request per value.
export const getHierarchyAssignments = async (hierarchyName: string): Promise<Record<string, string>> => {
  const rows = await callTable('getHierarchyAssignments', [hierarchyName], (f) => ({ entityName: f.entityName, parentName: f.parentName }));
  return Object.fromEntries(rows.map((r) => [r.entityName, r.parentName]));
};

// --- Entity tree, Items ---------------------------------------------------
// Mirrors frontend/src/lib/api.ts's own getEntityTree/listItems — used
// here only to list real providers/accounts (filtered by parent) and real
// items, for the Purchasing screens below.

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
export const getEntityTree = (business?: string) => callTable('getEntityTree', [business], parseEntityNode);

export interface ItemSummary {
  name: string;
  description: string | null;
  unit_of_measure: string | null;
  upc: string | null;
  retail_price_minor: number | null;
  source_count: number;
  storage_origin: 'Hot' | 'Cold' | null;
  product: string | null;
}
// business is required — items are scoped per business.
export const listItems = async (business: string, limit?: number, offset = 0): Promise<{ rows: ItemSummary[]; totalCount: number }> => {
  const lines = await callRaw('listItems', [business, limit != null ? String(limit) : undefined, limit != null ? String(offset) : undefined]);
  if (lines.length < 2) return { rows: [], totalCount: 0 };
  const header = lines[1];
  const parsed = lines.slice(2).map((fields) => Object.fromEntries(header.map((h, i) => [h, fields[i] ?? ''])));
  const totalCount = parsed.length > 0 ? Number(parsed[0].totalCount) : 0;
  const rows: ItemSummary[] =
    parsed[0]?.name === ''
      ? []
      : parsed.map((f) => ({
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
export const listItemSources = (itemName: string) => callTable('listItemSources', [itemName], parseItemSource);

// --- Invoices (AP Purchase uses the real, shared AR/AP invoice mechanism) -
// Mirrors frontend/src/lib/api.ts's own Invoices section.

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
// Matches call-dispatch/invoices.ts's own encodeInvoice exactly.
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
export const listInvoices = (business: BusinessName, ledger: LedgerName, invoiceType?: 'AR' | 'AP', source: 'manual' | 'pos' | 'all' = 'manual', limit = 50, offset = 0) =>
  callRow('listInvoices', [business, ledger, invoiceType, source, String(limit), String(offset)], (f): { rows: Invoice[]; totalCount: number } => ({
    totalCount: Number(f[0]),
    rows: decodeStringList(f[1]).map(decodeInvoice),
  }));
export const createInvoice = (input: InvoiceInput) =>
  callRowWithLines(
    'createInvoice',
    [input.invoiceType, input.business, input.ledger, input.reference, input.counterpartyName, input.invoiceDate, input.description],
    input.lines.map((l) => [
      l.description,
      l.quantity != null ? String(l.quantity) : undefined,
      l.unitPriceMinor != null ? String(l.unitPriceMinor) : undefined,
      String(l.amountMinor),
      l.taxMinor != null ? String(l.taxMinor) : undefined,
      l.itemName ?? undefined,
      l.dispatchReference ?? undefined,
    ]),
    (f): { id: number } => ({ id: Number(f[0]) })
  );
export const postInvoiceById = (id: number, revenueOrExpenseAccount: string, taxAccount: string, restockInventory = false) =>
  callRow('postInvoiceById', [String(id), revenueOrExpenseAccount, taxAccount, String(restockInventory)], () => undefined);
export const getInvoiceOutstanding = (id: number) => callRow('getInvoiceOutstanding', [String(id)], (f): { outstanding_minor: number } => ({ outstanding_minor: Number(f[0]) }));
export const allocatePaymentToInvoice = (id: number, paymentReference: string, allocatedMinor: number, allocationDate: string, paymentAccount: string) =>
  callRow('allocatePaymentToInvoice', [String(id), paymentReference, String(allocatedMinor), allocationDate, paymentAccount], () => undefined);

// --- Stock receive (alongside an on-account Purchase) ---------------------

export const receiveStock = (input: { business: BusinessName; ledger: LedgerName; reference: string; locationName: string; lines: { itemName: string; quantity: number }[]; transdate?: string }) =>
  callRowWithLines(
    'receiveStock',
    [input.business, input.ledger, input.reference, input.locationName, input.transdate],
    input.lines.map((l) => [l.itemName, String(l.quantity)]),
    () => undefined
  );

// --- Cash Purchase ---------------------------------------------------------
// Mirrors frontend/src/lib/api.ts's own completeCashPurchase — one real,
// atomic call: a genuine AP invoice to the given provider, posted, stock
// received, then immediately paid off in full.

export interface CashPurchaseLineInput {
  itemName: string;
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
  locationName: string;
  vendorName: string;
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

// --- Purchase Order ---------------------------------------------------------
// Mirrors frontend/src/lib/api.ts's own stagePurchaseOrder/postPurchaseOrder
// — memo-only when placed, no real ledger effect until a Stock Receipt
// fulfills it.

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
  callRow(
    'stagePurchaseOrder',
    [input.reference, input.business, input.ledger, input.vendor, input.item, String(input.quantity), String(input.price_minor), input.location, input.transdate, input.description],
    () => undefined
  );
export const postPurchaseOrder = (reference: string, business: BusinessName, ledger: LedgerName) => callRow('postPurchaseOrder', [reference, business, ledger], () => undefined);

// --- AP Payment -------------------------------------------------------------
// Mirrors frontend/src/lib/api.ts's own stageAPPayment/postAPPayment —
// debits the provider's Accounts Payable balance, credits Cash and Bank.

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
export const stageAPPayment = (input: ARAPBaseInput & { vendor: string }) =>
  callRow('stageAPPayment', [input.reference, input.business, input.ledger, input.vendor, String(input.amount_minor), input.transdate, input.description], () => undefined);
export const postAPPayment = (reference: string, business: BusinessName, ledger: LedgerName) => callRow('postAPPayment', [reference, business, ledger], () => undefined);

// --- Stock dispatch (alongside an on-account AR Sale) -----------------------
// Mirrors frontend/src/lib/api.ts's own dispatchStock — the Sale-side
// counterpart to receiveStock above.

export const dispatchStock = (input: { business: BusinessName; ledger: LedgerName; reference: string; locationName: string; lines: { itemName: string; quantity: number }[]; transdate?: string }) =>
  callRowWithLines(
    'dispatchStock',
    [input.business, input.ledger, input.reference, input.locationName, input.transdate],
    input.lines.map((l) => [l.itemName, String(l.quantity)]),
    () => undefined
  );

// --- Cash Sale / POS Terminal -------------------------------------------------
// Mirrors frontend/src/lib/api.ts's own completePosSale — the same real
// call both Cash Sale (CashSale.tsx, always to the one real 'Cash'
// customer) and the POS Terminal (POS.tsx, 'Cash' or a real, named
// on-account customer) make. The real backend function also accepts a
// scanned-barcode combination (tier/combinationValues/combinationShape)
// and a terminalName — this v1 TUI port never sends those, same scope
// limit the rest of this file already keeps elsewhere.
export interface PosSaleLineInput {
  itemName: string;
  quantity: number;
  unitPriceMinor?: number;
  taxMinor: number;
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
  locationName: string;
  customerName: string;
  lines: PosSaleLineInput[];
  taxAccount: string;
  paymentMethod?: string;
  cashTenderedMinor?: number;
  transdate?: string;
  terminalName?: string;
}) =>
  callRowWithLines(
    'completePosSale',
    [input.business, input.ledger, input.locationName, input.customerName, undefined, input.taxAccount, input.paymentMethod, input.cashTenderedMinor === undefined ? undefined : String(input.cashTenderedMinor), input.transdate, input.terminalName],
    input.lines.map((l) => [l.itemName, String(l.quantity), l.unitPriceMinor === undefined ? undefined : String(l.unitPriceMinor), String(l.taxMinor), undefined, undefined, undefined]),
    (f): PosSaleResult => ({ invoiceId: Number(f[0]), reference: f[1], totalMinor: Number(f[2]), changeDueMinor: Number(f[3]) })
  );

// --- Contacts (Customers/Providers) -----------------------------------------
// Mirrors frontend/src/lib/api.ts's own Contact/getContact/setContact and
// CreditStatus/getCreditStatus — used here by the Customers screen.
// Address/phone management and counterparty history are real, optional
// extras on the web screen this v1 port skips, same stated reason as the
// rest of this file's own simplifications.

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
  'business_name',
  'phone',
  'email',
  'address_line1',
  'address_line2',
  'city',
  'region',
  'postal_code',
  'country',
  'payment_terms_days',
  'credit_limit_minor',
  'wage_minor_per_hour',
  'salary_minor_per_year',
  'preferred_language',
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
  callRow('getCreditStatus', [name], (f): CreditStatus => ({ balanceMinor: Number(f[0]), limitMinor: f[1] === '' ? null : Number(f[1]), overLimit: f[2] === 'true', remainingMinor: f[3] === '' ? null : Number(f[3]) }));
