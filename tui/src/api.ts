// A direct, near-verbatim port of frontend/src/lib/api.ts's own
// request() wrapper and the handful of functions this TUI's v1 scope
// actually needs — same endpoints, same payload shapes, same branded
// types. See docs/tui-design.md ("Why this is a thin client, not a
// second frontend") for why this is a port, not a reimplementation.
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session) headers.Authorization = `Bearer ${session.token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { headers, ...init });
  } catch {
    throw new ApiError(0, `Can't reach the backend at ${BASE}. Make sure it's running (cd backend && npm run dev).`);
  }
  if (res.status === 401) {
    setSession(null); // the session is gone — treat as logged out, same as the web frontend does
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
  return (await res.json()) as T;
}

// --- Auth ------------------------------------------------------------

export interface LoginResponse {
  token: string;
  user: { id: number; username: string; roles: string[]; page_size: number; number_format: string; date_format: string };
}
export const apiLogin = (username: string, password: string) =>
  request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });

export const setSessionBusiness = (businessName: string) =>
  request<void>('/auth/session/business', { method: 'POST', body: JSON.stringify({ businessName }) });

// --- Businesses / ledgers --------------------------------------------

export const getBusinesses = () => request<{ id: number; name: string }[]>('/businesses');
export const getLedgers = (businessName: string) =>
  request<{ id: number; name: string }[]>(`/businesses/${encodeURIComponent(businessName)}/ledgers`);

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
export const getMenuTree = (businessName?: string) =>
  request<MenuSectionRow[]>(`/menu${businessName ? `?business=${encodeURIComponent(businessName)}` : ''}`);

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
export const stageLine = (line: StagedLine) => request<void>('/journal/staging', { method: 'POST', body: JSON.stringify(line) });
export const getStagedLines = (reference: string, business: BusinessName, ledger: LedgerName) =>
  request<StagedLine[]>(`/journal/staging/${encodeURIComponent(reference)}/${encodeURIComponent(business)}/${encodeURIComponent(ledger)}`);
// A real, live server endpoint (backend/src/routes/journal.ts) the web
// frontend's own api.ts has commented out as unused — this TUI calls it
// directly, so Delete on a staged line really un-stages it server-side,
// not merely removes it from this screen's own, local list.
export const removeStagedLine = (reference: string, business: BusinessName, ledger: LedgerName, account: AccountName) =>
  request<void>(
    `/journal/staging/${encodeURIComponent(reference)}/${encodeURIComponent(business)}/${encodeURIComponent(ledger)}/${encodeURIComponent(account)}`,
    { method: 'DELETE' }
  );
export const postJournalEntry = (reference: string, business: BusinessName, ledger: LedgerName) =>
  request<void>('/journal/post', { method: 'POST', body: JSON.stringify({ reference, business, ledger }) });

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
export const getBalanceSheet = (business: BusinessName, ledger: LedgerName, asOfDate?: string) =>
  request<BalanceSheet>(
    `/reports/balance-sheet?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}${asOfDate ? `&asOfDate=${asOfDate}` : ''}`
  );

// --- New Business wizard ------------------------------------------
// Mirrors frontend/src/routes/setup/new-business/+page.svelte's own
// createBusiness/nominateBankAccount/buildBankCurrencyStructure calls
// — same endpoints, same payload shapes (backend/src/routes/businesses.ts).

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
  request<CreateBusinessResult>('/businesses', {
    method: 'POST',
    body: JSON.stringify({
      businessName,
      financialYearLabel,
      coaPrototype,
      secondaryCurrencies,
      entityStructure,
      partnerNames,
      financialYearStart,
      reportingFrequency,
    }),
  });

export const nominateBankAccount = (businessName: string, bankAccountName: string, routingDetail: string, accountNumber: string) =>
  request<{ id: number }>(`/businesses/${encodeURIComponent(businessName)}/bank-accounts`, {
    method: 'POST',
    body: JSON.stringify({ bankAccountName, routingDetail, accountNumber }),
  });

export const buildBankCurrencyStructure = (
  businessName: string,
  headerName: string,
  leafKind: 'asset' | 'equity',
  selections: { bankAccountName: string; currency: string }[],
  homeCurrency: string
) =>
  request<void>(`/businesses/${encodeURIComponent(businessName)}/bank-currency-structure`, {
    method: 'POST',
    body: JSON.stringify({ headerName, leafKind, selections, homeCurrency }),
  });

// --- Org Chart / Departments ----------------------------------------
// Mirrors backend/src/routes/departments.ts — a Department is a real,
// postable CoA cost-center (unlike Division, a pure reporting tag);
// Employee↔Department and Employee↔Manager are two independent facts
// set via setEntityLink, never clobbering the employee's existing
// "Place of Employment" relationship. See the plan file this backend
// work came from for the full design rationale.

export const listDepartments = (business: string) =>
  request<{ id: number; name: string }[]>(`/departments?business=${encodeURIComponent(business)}`);

export const createDepartment = (business: string, name: string) =>
  request<{ id: number; name: string }>('/departments', { method: 'POST', body: JSON.stringify({ business, name }) });

export const deleteDepartment = (business: string, name: string) =>
  request<void>(`/departments/${encodeURIComponent(name)}?business=${encodeURIComponent(business)}`, { method: 'DELETE' });

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
export const getOrgChartStructure = (business: string) =>
  request<OrgChartStructure>(`/departments/org-chart?business=${encodeURIComponent(business)}`);

export const setEmployeeDepartment = (employeeName: string, departmentName: string) =>
  request<void>(`/departments/employees/${encodeURIComponent(employeeName)}/department`, {
    method: 'PUT',
    body: JSON.stringify({ departmentName }),
  });
export const deleteEmployeeDepartment = (employeeName: string) =>
  request<void>(`/departments/employees/${encodeURIComponent(employeeName)}/department`, { method: 'DELETE' });

export const setEmployeeManager = (employeeName: string, managerName: string) =>
  request<void>(`/departments/employees/${encodeURIComponent(employeeName)}/manager`, {
    method: 'PUT',
    body: JSON.stringify({ managerName }),
  });
export const deleteEmployeeManager = (employeeName: string) =>
  request<void>(`/departments/employees/${encodeURIComponent(employeeName)}/manager`, { method: 'DELETE' });

// --- Locations ---------------------------------------------------------
// Mirrors frontend/src/lib/api.ts's own Locations section
// (backend/src/routes/locations.ts) — same endpoints, same payload
// shapes. Unlike Department, a Location is matched to its own,
// separate same-named CoA account node by name, not the entity itself.

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

export const listLocations = (business: BusinessName) => request<LocationRecord[]>(`/locations?business=${encodeURIComponent(business)}`);

export const getLocationTypes = () => request<string[]>('/locations/types');

export const createLocation = (name: string, business: string, input: LocationInput) =>
  request<void>(`/locations/${encodeURIComponent(name)}?business=${encodeURIComponent(business)}`, { method: 'POST', body: JSON.stringify(input) });

// Name-based, since listLocations's own LocationRecord carries no entity
// id — revokeEntity's own guards (capacity account, inventory,
// journal_line postings, a Division tag) do the real safety work.
export const deleteLocation = (name: string, business: string) =>
  request<void>(`/locations/${encodeURIComponent(name)}?business=${encodeURIComponent(business)}`, { method: 'DELETE' });

// --- Hierarchy / Division ------------------------------------------------
// Mirrors frontend/src/lib/api.ts's own Hierarchy section
// (backend/src/routes/hierarchy.ts) — generic primitives; Division is
// just a Hierarchy literally named "Division", a pure reporting tag
// with no account of its own (unlike Location/Department).

export interface HierarchyGroupingWithValues {
  grouping: string;
  values: string[];
}
export const getHierarchy = (business: string) => request<HierarchyGroupingWithValues[]>(`/hierarchy?business=${encodeURIComponent(business)}`);

export const createHierarchyGrouping = (business: string, groupingName: string) =>
  request<{ name: string }>('/hierarchy/groupings', { method: 'POST', body: JSON.stringify({ business, groupingName }) });
export const createHierarchyValue = (business: string, groupingName: string, valueName: string, parentValueName?: string | null) =>
  request<{ name: string }>('/hierarchy/values', { method: 'POST', body: JSON.stringify({ business, groupingName, valueName, parentValueName }) });

export const deleteHierarchyGrouping = (business: string, groupingName: string) =>
  request<void>(`/hierarchy/groupings?business=${encodeURIComponent(business)}&groupingName=${encodeURIComponent(groupingName)}`, { method: 'DELETE' });
export const deleteHierarchyValue = (business: string, groupingName: string, valueName: string) =>
  request<void>(`/hierarchy/values?business=${encodeURIComponent(business)}&groupingName=${encodeURIComponent(groupingName)}&valueName=${encodeURIComponent(valueName)}`, { method: 'DELETE' });

export const setHierarchyTag = (entityName: string, hierarchyName: string, parentName: string) =>
  request<{ entityName: string; hierarchyName: string; parentName: string }>('/hierarchy/parent', { method: 'POST', body: JSON.stringify({ entityName, hierarchyName, parentName }) });
export const getHierarchyTag = (entityName: string, hierarchyName: string) =>
  request<{ parentName: string | null }>(`/hierarchy/parent?entityName=${encodeURIComponent(entityName)}&hierarchyName=${encodeURIComponent(hierarchyName)}`);
export const deleteHierarchyTag = (entityName: string, hierarchyName: string) =>
  request<void>(`/hierarchy/parent?entityName=${encodeURIComponent(entityName)}&hierarchyName=${encodeURIComponent(hierarchyName)}`, { method: 'DELETE' });

// Every real tag for one named hierarchy in one call (entity name -> value
// name) — builds a real display tree without one request per value.
export const getHierarchyAssignments = (hierarchyName: string) =>
  request<Record<string, string>>(`/hierarchy/assignments?hierarchyName=${encodeURIComponent(hierarchyName)}`);

// --- Entity tree, Items ---------------------------------------------------
// Mirrors frontend/src/lib/api.ts's own getEntityTree/listItems — used
// here only to list real providers/accounts (filtered by parent) and
// real items, for the Purchasing screens below.

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
export const getEntityTree = (business?: string) => request<EntityNode[]>(`/entities${business ? `?business=${encodeURIComponent(business)}` : ''}`);

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
export const listItems = (business: string, limit?: number, offset = 0) =>
  request<{ rows: ItemSummary[]; totalCount: number }>(`/items?business=${encodeURIComponent(business)}${limit != null ? `&limit=${limit}&offset=${offset}` : ''}`);

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
export const listItemSources = (itemName: string) => request<ItemSource[]>(`/items/${encodeURIComponent(itemName)}/sources`);

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
export const listInvoices = (business: BusinessName, ledger: LedgerName, invoiceType?: 'AR' | 'AP', source: 'manual' | 'pos' | 'all' = 'manual', limit = 50, offset = 0) =>
  request<{ rows: Invoice[]; totalCount: number }>(
    `/invoices?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}${invoiceType ? `&type=${invoiceType}` : ''}&source=${source}&limit=${limit}&offset=${offset}`
  );
export const createInvoice = (input: InvoiceInput) => request<{ id: number }>('/invoices', { method: 'POST', body: JSON.stringify(input) });
export const postInvoiceById = (id: number, revenueOrExpenseAccount: string, taxAccount: string, restockInventory = false) =>
  request<void>(`/invoices/${id}/post`, { method: 'POST', body: JSON.stringify({ revenueOrExpenseAccount, taxAccount, restockInventory }) });
export const getInvoiceOutstanding = (id: number) => request<{ outstanding_minor: number }>(`/invoices/${id}/outstanding`);
export const allocatePaymentToInvoice = (id: number, paymentReference: string, allocatedMinor: number, allocationDate: string, paymentAccount: string) =>
  request<void>(`/invoices/${id}/allocate`, { method: 'POST', body: JSON.stringify({ paymentReference, allocatedMinor, allocationDate, paymentAccount }) });

// --- Stock receive (alongside an on-account Purchase) ---------------------

export const receiveStock = (
  input: { business: BusinessName; ledger: LedgerName; reference: string; locationName: string; lines: { itemName: string; quantity: number }[]; transdate?: string }
) => request<void>('/pos/receive-stock', { method: 'POST', body: JSON.stringify(input) });

// --- Cash Purchase ---------------------------------------------------------
// Mirrors frontend/src/lib/api.ts's own completeCashPurchase — one real,
// atomic call: a genuine AP invoice to the given provider, posted,
// stock received, then immediately paid off in full.

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
}) => request<CashPurchaseResult>('/pos/complete-cash-purchase', { method: 'POST', body: JSON.stringify(input) });

// --- Purchase Order ---------------------------------------------------------
// Mirrors frontend/src/lib/api.ts's own stagePurchaseOrder/postPurchaseOrder
// — memo-only when placed (backend/src/db-journal.ts's stagePurchaseOrder),
// no real ledger effect until a Stock Receipt fulfills it.

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
export const stagePurchaseOrder = (input: PurchaseOrderInput) => request<void>('/stock/po/stage', { method: 'POST', body: JSON.stringify(input) });
export const postPurchaseOrder = (reference: string, business: BusinessName, ledger: LedgerName) =>
  request<void>('/stock/po/post', { method: 'POST', body: JSON.stringify({ reference, business, ledger }) });

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
  request<void>('/arap/ap-payment/stage', { method: 'POST', body: JSON.stringify(input) });
export const postAPPayment = (reference: string, business: BusinessName, ledger: LedgerName) =>
  request<void>('/arap/ap-payment/post', { method: 'POST', body: JSON.stringify({ reference, business, ledger }) });

// --- Stock dispatch (alongside an on-account AR Sale) -----------------------
// Mirrors frontend/src/lib/api.ts's own dispatchStock — the Sale-side
// counterpart to receiveStock above.

export const dispatchStock = (
  input: { business: BusinessName; ledger: LedgerName; reference: string; locationName: string; lines: { itemName: string; quantity: number }[]; transdate?: string }
) => request<void>('/pos/dispatch-stock', { method: 'POST', body: JSON.stringify(input) });

// --- Cash Sale / POS Terminal -------------------------------------------------
// Mirrors frontend/src/lib/api.ts's own completePosSale — the same
// real endpoint both Cash Sale (CashSale.tsx, always to the one real
// 'Cash' customer) and the POS Terminal (POS.tsx, 'Cash' or a real,
// named on-account customer) call.

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
}) => request<PosSaleResult>('/pos/complete-sale', { method: 'POST', body: JSON.stringify(input) });

// --- Contacts (Customers/Providers) -----------------------------------------
// Mirrors frontend/src/lib/api.ts's own Contact/getContact/setContact and
// CreditStatus/getCreditStatus — used here by the Customers screen.
// Address/phone management and counterparty history (AddressList.svelte,
// PhoneList.svelte, ContactList.svelte, getCounterpartyHistory) are real,
// optional extras on the web screen this v1 port skips, same stated
// reason as the rest of this file's own simplifications.

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
export const getContact = (name: string) => request<Contact | null>(`/contacts/${encodeURIComponent(name)}`);
export const setContact = (name: string, contact: Partial<Contact>) =>
  request<void>(`/contacts/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify(contact) });

export interface CreditStatus {
  balanceMinor: number;
  limitMinor: number | null;
  overLimit: boolean;
  remainingMinor: number | null;
}
export const getCreditStatus = (name: string) => request<CreditStatus>(`/contacts/${encodeURIComponent(name)}/credit-status`);
