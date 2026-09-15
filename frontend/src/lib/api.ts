import { auth } from './state.svelte';

const BASE = 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Branded types: mirrors the backend's own BusinessName/LedgerName/etc.
// system exactly (see the Programmer's Manual, "Entity identity
// resolution") — plain `string` parameters cannot distinguish a
// business's own name from a ledger's own name to the compiler, so a
// silently swapped argument order was never actually caught. The
// frontend and backend are separate TypeScript projects with no shared
// types package, so these are genuinely re-declared here, not
// imported — the same real reasoning applies on both sides
// independently. asBusinessName/asLedgerName/etc. are the one,
// explicit, real boundary where an ordinary string (typed by a person,
// or read back from an API response) genuinely becomes branded.
// ---------------------------------------------------------------------------
export type BusinessName = string & { readonly __brand: 'BusinessName' };
export type LedgerName = string & { readonly __brand: 'LedgerName' };
export type AccountName = string & { readonly __brand: 'AccountName' };
export type DivisionName = string & { readonly __brand: 'DivisionName' };
export type LocationName = string & { readonly __brand: 'LocationName' };
export type EmployeeName = string & { readonly __brand: 'EmployeeName' };
export type CustomerName = string & { readonly __brand: 'CustomerName' };
export type VendorName = string & { readonly __brand: 'VendorName' };
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
export function asDivisionName(name: string): DivisionName {
  return name as DivisionName;
}
export function asLocationName(name: string): LocationName {
  return name as LocationName;
}
export function asEmployeeName(name: string): EmployeeName {
  return name as EmployeeName;
}
export function asCustomerName(name: string): CustomerName {
  return name as CustomerName;
}
export function asVendorName(name: string): VendorName {
  return name as VendorName;
}
export function asItemName(name: string): ItemName {
  return name as ItemName;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const current = auth.current;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (current) headers.Authorization = `Bearer ${current.token}`;

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

export const getEntityTree = () => request<EntityNode[]>('/entities');

export interface DimensionLinkPointingAt {
  entityName: string;
  dimensionName: string;
}
export const getDimensionLinksPointingAt = (entityId: number) => request<DimensionLinkPointingAt[]>(`/entities/${entityId}/dimension-links`);

export const createEntity = (data: { name: string; parent?: string | null; relation?: string | null; accountnumber?: string | null }) =>
  request<EntityNode>('/entities', { method: 'POST', body: JSON.stringify(data) });
export const setEntityRelationship = (entityName: string, relationshipType: string, targetName: string) =>
  request<void>('/entities/relationship', { method: 'POST', body: JSON.stringify({ entityName, relationshipType, targetName }) });

export const updateEntity = (
  id: number,
  data: { name?: string; parent?: string | null; relation?: string | null; accountnumber?: string | null }
) => request<EntityNode>(`/entities/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteEntity = (id: number) => request<void>(`/entities/${id}`, { method: 'DELETE' });

export interface ReportRow {
  report: string;
  category: string;
  account: AccountName;
  depth: number;
  accountnumber: string | null;
  balance_minor: number | null;
}

export const getBusinessReports = () => request<ReportRow[]>('/reports/business-reports');

export interface ChartRow {
  id: number;
  name: string;
  depth: number;
  path: string;
  accountnumber: string | null;
  balance_minor: number | null;
}

export const getChartOfAccounts = () => request<ChartRow[]>('/reports/chart-of-accounts');

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
  request<BankAccountRow[]>(`/reports/bank-accounts?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}`);
export const getCashPosition = (business: BusinessName, ledger: LedgerName) =>
  request<CashPositionByCurrency[]>(`/reports/cash-position?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}`);

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
  request<CashFlowForecast>(
    `/reports/cash-flow-forecast?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}${asOfDate ? `&asOfDate=${asOfDate}` : ''}${horizonDays ? `&horizonDays=${horizonDays}` : ''}`
  );

export const registerBankAccount = (accountName: string, business: BusinessName, scopeName: string, overdraftLimitMinor: number | null) =>
  request<void>(`/reports/bank-accounts/${encodeURIComponent(accountName)}`, { method: 'PUT', body: JSON.stringify({ business, scopeName, overdraftLimitMinor }) });
export const unregisterBankAccount = (accountName: string) =>
  request<void>(`/reports/bank-accounts/${encodeURIComponent(accountName)}`, { method: 'DELETE' });


export interface TrialBalanceRow {
  id: number;
  name: string;
  accountnumber: string | null;
  debit_minor: number;
  credit_minor: number;
}
export interface TrialBalance {
  rows: TrialBalanceRow[];
  total_debit_minor: number;
  total_credit_minor: number;
}
export const getTrialBalance = (business: BusinessName, ledger: LedgerName, asOfDate?: string) =>
  request<TrialBalance>(`/reports/trial-balance?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}${asOfDate ? `&asOfDate=${asOfDate}` : ''}`);

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
  request<SalesReport>(
    `/reports/sales?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}${fromDate ? `&fromDate=${fromDate}` : ''}${toDate ? `&toDate=${toDate}` : ''}`
  );

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
export const getMenuTree = (businessName?: string) => request<MenuSectionRow[]>(`/menu${businessName ? `?business=${encodeURIComponent(businessName)}` : ''}`);
export const setMenuOverride = (menuItemKey: string, scope: 'business' | 'user', scopeId: number, overrideLabel: string | null, hidden: boolean) =>
  request<{ ok: true }>('/menu/override', { method: 'POST', body: JSON.stringify({ menuItemKey, scope, scopeId, overrideLabel, hidden }) });
export const deleteMenuOverride = (menuItemKey: string, scope: 'business' | 'user', scopeId: number) =>
  request<{ ok: true }>('/menu/override', { method: 'DELETE', body: JSON.stringify({ menuItemKey, scope, scopeId }) });

export const getBalanceSheet = (business: BusinessName, ledger: LedgerName, asOfDate?: string) =>
  request<BalanceSheet>(`/reports/balance-sheet?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}${asOfDate ? `&asOfDate=${asOfDate}` : ''}`);

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
  income: StatementLine[];
  expenses: StatementLine[];
  cogs_expenses: StatementLine[];
  operating_expenses: StatementLine[];
  income_tree: CategoryTreeNode[];
  cogs_tree: CategoryTreeNode[];
  operating_expenses_tree: CategoryTreeNode[];
  total_income_minor: number;
  total_expenses_minor: number;
  gross_profit_minor: number;
  net_income_minor: number;
}
export const getProfitAndLoss = (business: BusinessName, ledger: LedgerName, fromDate?: string, toDate?: string, divisionName?: string) =>
  request<ProfitAndLoss>(
    `/reports/profit-and-loss?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}${fromDate ? `&fromDate=${fromDate}` : ''}${toDate ? `&toDate=${toDate}` : ''}${divisionName ? `&division=${encodeURIComponent(divisionName)}` : ''}`
  );

export interface ProfitAndLossByDivision {
  division: DivisionName | null;
  profitAndLoss: ProfitAndLoss;
}
export const getProfitAndLossByDivision = (business: BusinessName, ledger: LedgerName, fromDate?: string, toDate?: string) =>
  request<ProfitAndLossByDivision[]>(
    `/reports/profit-and-loss-by-division?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}${fromDate ? `&fromDate=${fromDate}` : ''}${toDate ? `&toDate=${toDate}` : ''}`
  );

export interface ProfitAndLossByDivisionNode extends ProfitAndLossByDivision {
  children: ProfitAndLossByDivisionNode[];
}
export const getProfitAndLossByDivisionTree = (business: BusinessName, ledger: LedgerName, fromDate?: string, toDate?: string) =>
  request<ProfitAndLossByDivisionNode[]>(
    `/reports/profit-and-loss-by-division-tree?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}${fromDate ? `&fromDate=${fromDate}` : ''}${toDate ? `&toDate=${toDate}` : ''}`
  );

export interface LedgerDateRange {
  earliest: string | null;
  latest: string | null;
}
export const getLedgerDateRange = (business: BusinessName, ledger: LedgerName) => request<LedgerDateRange>(`/reports/ledger-date-range?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}`);

export const getLanguages = () => request<{ id: number; name: string }[]>('/i18n/languages');
export const getLanguageDirection = (language: string) => request<{ direction: 'LTR' | 'RTL' }>(`/i18n/language-direction/${encodeURIComponent(language)}`);
export const setLanguageDirection = (language: string, direction: 'LTR' | 'RTL' | null) =>
  request<void>(`/i18n/language-direction/${encodeURIComponent(language)}`, { method: 'PUT', body: JSON.stringify({ direction }) });
export const getDefaultLanguage = () => request<{ language: string | null }>('/i18n/default-language');
export const setDefaultLanguage = (language: string) =>
  request<void>('/i18n/default-language', { method: 'PUT', body: JSON.stringify({ language }) });
export const getLocalizedText = (language: string, businessName?: string) =>
  request<Record<string, string>>(`/i18n/text/${encodeURIComponent(language)}${businessName ? `?business=${encodeURIComponent(businessName)}` : ''}`);

export const getVocabularyAlternates = (word: string) => request<string[]>(`/i18n/vocabulary-alternates/${encodeURIComponent(word)}`);

export interface ConceptWithAlternates {
  headerAccountName: string;
  alternates: string[];
  defaultAlternate: string;
}
export const getConceptsWithAlternates = () => request<ConceptWithAlternates[]>('/i18n/concepts-with-alternates');

export interface VocabularyWord {
  name: string;
  translations: Record<string, string>;
}
export const getVocabularyWords = () => request<VocabularyWord[]>('/i18n/vocabulary-words');

export const setVocabularyPreference = (conceptName: string, scope: 'business' | 'user', scopeId: number, preferredAlternateName: string) =>
  request<{ ok: true }>('/i18n/vocabulary-preference', { method: 'POST', body: JSON.stringify({ conceptName, scope, scopeId, preferredAlternateName }) });

export const deleteVocabularyPreference = (conceptName: string, scope: 'business' | 'user', scopeId: number) =>
  request<{ ok: true }>('/i18n/vocabulary-preference', { method: 'DELETE', body: JSON.stringify({ conceptName, scope, scopeId }) });
export const setTranslation = (entity: string, language: string, text: string) =>
  request<void>('/i18n/translations', { method: 'POST', body: JSON.stringify({ entity, language, text }) });

export interface DivisionRecord {
  id: number;
  name: string;
  parentName: string | null;
  centerType: string | null;
}
export const getDivisions = () => request<DivisionRecord[]>('/divisions');
export const createDivision = (name: string, parent: string | null, centerType: string) =>
  request<{ name: string }>('/divisions', { method: 'POST', body: JSON.stringify({ name, parent, centerType }) });

export interface HierarchyGroupingWithValues {
  grouping: string;
  values: string[];
}
export const getHierarchy = (business: string) => request<HierarchyGroupingWithValues[]>(`/hierarchy?business=${encodeURIComponent(business)}`);
export const getProductShapes = (business: string) => request<[string, string][][]>(`/hierarchy/shapes?business=${encodeURIComponent(business)}`);
export const createHierarchyGrouping = (business: string, groupingName: string) =>
  request<{ name: string }>('/hierarchy/groupings', { method: 'POST', body: JSON.stringify({ business, groupingName }) });
export const createHierarchyValue = (business: string, groupingName: string, valueName: string) =>
  request<{ name: string }>('/hierarchy/values', { method: 'POST', body: JSON.stringify({ business, groupingName, valueName }) });
export const defineProductShape = (business: string, dimensions: [string, string][]) =>
  request<{ dimensions: [string, string][] }>('/hierarchy/shapes', { method: 'POST', body: JSON.stringify({ business, dimensions }) });

export const getBusinesses = () => request<{ id: number; name: string }[]>('/businesses');
export const getBusinessTypes = () => request<{ name: string; questions: string[] }[]>('/businesses/types');
export const saveBusinessTypeAnswers = (businessName: string, answers: Record<string, string>) =>
  request<void>(`/businesses/${encodeURIComponent(businessName)}/business-type-answers`, { method: 'POST', body: JSON.stringify({ answers }) });
export const getLedgers = (businessName: string) =>
  request<{ id: number; name: string }[]>(`/businesses/${encodeURIComponent(businessName)}/ledgers`);
export const createBusiness = (
  businessName: string,
  financialYearLabel: string,
  coaFamily?: string,
  secondaryCurrencies?: string[],
  entityStructure?: 'sole_trader' | 'partnership' | 'llc' | 'unlimited_liability' | 'publicly_traded',
  partnerNames?: string[]
) =>
  request<{ business: BusinessName; actualLedger: string; budgetLedger: string }>('/businesses', {
    method: 'POST',
    body: JSON.stringify({ businessName, financialYearLabel, coaFamily, secondaryCurrencies, entityStructure, partnerNames }),
  });
export const getCoaFamilyAccounts = (businessName: string, ledgerName: string) => request<string[]>(`/businesses/coa-family/${encodeURIComponent(businessName)}/${encodeURIComponent(ledgerName)}`);

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
  request<StagedLine[]>(
    `/journal/staging/${encodeURIComponent(reference)}/${encodeURIComponent(business)}/${encodeURIComponent(ledger)}`
  );

export const removeStagedLine = (reference: string, business: BusinessName, ledger: LedgerName, account: AccountName) =>
  request<void>(
    `/journal/staging/${encodeURIComponent(reference)}/${encodeURIComponent(business)}/${encodeURIComponent(ledger)}/${encodeURIComponent(account)}`,
    { method: 'DELETE' }
  );

export const postJournalEntry = (reference: string, business: BusinessName, ledger: LedgerName) =>
  request<void>('/journal/post', { method: 'POST', body: JSON.stringify({ reference, business, ledger }) });

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

export const listJournalEntries = (business: BusinessName, ledger: LedgerName, limit = 100, offset = 0) =>
  request<{ rows: JournalSummary[]; totalCount: number }>(
    `/journal?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}&limit=${limit}&offset=${offset}`
  );

export interface JournalDetail extends JournalSummary {
  lines: { account: AccountName; accountnumber: string | null; amount_minor: number; memo: string; division: DivisionName | null }[];
}

export const getJournalEntry = (business: BusinessName, ledger: LedgerName, journalId: number, occurrenceDate: string) =>
  request<JournalDetail>(`/journal/${journalId}/${occurrenceDate}?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}`);

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
  request<TrialBalanceComparison>(`/reports/trial-balance-comparison?business=${encodeURIComponent(business)}&a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);

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
export const getProfitAndLossComparison = (business: BusinessName, a: string, b: string) =>
  request<ProfitAndLossComparison>(`/reports/profit-and-loss-comparison?business=${encodeURIComponent(business)}&a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);

export interface Contact {
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

export interface TypedAddress {
  address_type: string;
  record_name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
}
export const getTypedAddresses = (name: string) => request<TypedAddress[]>(`/contacts/${encodeURIComponent(name)}/addresses`);
export const setTypedAddress = (name: string, address: Partial<TypedAddress> & { address_type: string }) =>
  request<void>(`/contacts/${encodeURIComponent(name)}/addresses`, { method: 'PUT', body: JSON.stringify(address) });
export const deleteTypedAddress = (name: string, addressType: string) =>
  request<void>(`/contacts/${encodeURIComponent(name)}/addresses/${encodeURIComponent(addressType)}`, { method: 'DELETE' });

export interface TypedPhone {
  phone_type: string;
  record_name: string;
  phone: string | null;
}
export const getTypedPhones = (name: string) => request<TypedPhone[]>(`/contacts/${encodeURIComponent(name)}/phones`);
export const setTypedPhone = (name: string, phoneType: string, phone: string) =>
  request<void>(`/contacts/${encodeURIComponent(name)}/phones`, { method: 'PUT', body: JSON.stringify({ phone_type: phoneType, phone }) });
export const deleteTypedPhone = (name: string, phoneType: string) =>
  request<void>(`/contacts/${encodeURIComponent(name)}/phones/${encodeURIComponent(phoneType)}`, { method: 'DELETE' });

export interface ContactPerson {
  contact_type: string;
  record_name: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}
export const listContactPersonTypes = () => request<string[]>('/contacts/contact-person-types');
export const listAddressTypes = () => request<string[]>('/contacts/address-types');
export const getLocationTypes = () => request<string[]>('/locations/types');
export const createLocationType = (name: string) => request<{ name: string }>('/locations/types', { method: 'POST', body: JSON.stringify({ name }) });
export const listPhoneTypes = () => request<string[]>('/contacts/phone-types');
export const getTypedContactPersons = (name: string) => request<ContactPerson[]>(`/contacts/${encodeURIComponent(name)}/contact-persons`);
export const setTypedContactPerson = (name: string, contactType: string, value: { name: string; phone?: string | null; email?: string | null }) =>
  request<void>(`/contacts/${encodeURIComponent(name)}/contact-persons`, { method: 'PUT', body: JSON.stringify({ contact_type: contactType, ...value }) });
export const deleteTypedContactPerson = (name: string, contactType: string) =>
  request<void>(`/contacts/${encodeURIComponent(name)}/contact-persons/${encodeURIComponent(contactType)}`, { method: 'DELETE' });

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
  request<void>('/journal/recurring', {
    method: 'POST',
    body: JSON.stringify({ business, ledger, reference, startDate, recurrence, lines, description, recurrenceCount }),
  });

export interface ArApBaseInput {
  reference: string;
  business: BusinessName;
  ledger: LedgerName;
  amount_minor: number;
  tax_minor?: number;
  location?: string;
  transdate?: string;
  description?: string;
}

export const stageArSale = (input: ArApBaseInput & { customer: string }) =>
  request<void>('/arap/ar-sale/stage', { method: 'POST', body: JSON.stringify(input) });
export const postArSale = (reference: string, business: BusinessName, ledger: LedgerName) =>
  request<void>('/arap/ar-sale/post', { method: 'POST', body: JSON.stringify({ reference, business, ledger }) });

export const stageArReceipt = (input: ArApBaseInput & { customer: string }) =>
  request<void>('/arap/ar-receipt/stage', { method: 'POST', body: JSON.stringify(input) });
export const postArReceipt = (reference: string, business: BusinessName, ledger: LedgerName) =>
  request<void>('/arap/ar-receipt/post', { method: 'POST', body: JSON.stringify({ reference, business, ledger }) });

export const stageApPurchase = (input: ArApBaseInput & { vendor: string; expense_account: string }) =>
  request<void>('/arap/ap-purchase/stage', { method: 'POST', body: JSON.stringify(input) });
export const postApPurchase = (reference: string, business: BusinessName, ledger: LedgerName) =>
  request<void>('/arap/ap-purchase/post', { method: 'POST', body: JSON.stringify({ reference, business, ledger }) });

export const stageApPayment = (input: ArApBaseInput & { vendor: string }) =>
  request<void>('/arap/ap-payment/stage', { method: 'POST', body: JSON.stringify(input) });
export const postApPayment = (reference: string, business: BusinessName, ledger: LedgerName) =>
  request<void>('/arap/ap-payment/post', { method: 'POST', body: JSON.stringify({ reference, business, ledger }) });

export interface LoginResponse {
  token: string;
  user: { id: number; username: string; roles: string[]; page_size: number; number_format: string; date_format: string };
}

export const apiLogin = (username: string, password: string) =>
  request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });

export const apiLogout = () => request<void>('/auth/logout', { method: 'POST' });

export interface UserSummary {
  id: number;
  username: string;
  active: boolean;
  roles: string[];
}

export const getUsers = () => request<UserSummary[]>('/auth/users');
export const getRoles = () => request<{ id: number; name: string }[]>('/auth/roles');
export const createUserAccount = (username: string, password: string, roles: string[]) =>
  request<UserSummary>('/auth/users', { method: 'POST', body: JSON.stringify({ username, password, roles }) });
export const setUserRolesApi = (userId: number, roles: string[]) =>
  request<void>(`/auth/users/${userId}/roles`, { method: 'PUT', body: JSON.stringify({ roles }) });
export const setUserActiveApi = (userId: number, active: boolean) =>
  request<void>(`/auth/users/${userId}/active`, { method: 'PUT', body: JSON.stringify({ active }) });
export const changeUserPassword = (userId: number, password: string) =>
  request<void>(`/auth/users/${userId}/password`, { method: 'PUT', body: JSON.stringify({ password }) });

export const reverseJournalEntry = (business: BusinessName, ledger: LedgerName, journalId: number, occurrenceDate: string, reversalDate?: string) =>
  request<void>(`/journal/${journalId}/${occurrenceDate}/reverse`, {
    method: 'POST',
    body: JSON.stringify({ business, ledger, reversalDate }),
  });

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
  request<void>('/stock/po/stage', { method: 'POST', body: JSON.stringify(input) });
export const postPurchaseOrder = (reference: string, business: BusinessName, ledger: LedgerName) =>
  request<void>('/stock/po/post', { method: 'POST', body: JSON.stringify({ reference, business, ledger }) });

export interface StockReceiptInput {
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
export const stageStockReceipt = (input: StockReceiptInput) =>
  request<void>('/stock/stock-receipt/stage', { method: 'POST', body: JSON.stringify(input) });
export const postStockReceipt = (reference: string, business: BusinessName, ledger: LedgerName) =>
  request<void>('/stock/stock-receipt/post', { method: 'POST', body: JSON.stringify({ reference, business, ledger }) });

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
  request<void>('/stock/so/stage', { method: 'POST', body: JSON.stringify(input) });
export const postSalesOrder = (reference: string, business: BusinessName, ledger: LedgerName) =>
  request<void>('/stock/so/post', { method: 'POST', body: JSON.stringify({ reference, business, ledger }) });

export interface StockDispatchInput {
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
export const stageStockDispatch = (input: StockDispatchInput) =>
  request<void>('/stock/stock-dispatch/stage', { method: 'POST', body: JSON.stringify(input) });
export const postStockDispatch = (reference: string, business: BusinessName, ledger: LedgerName) =>
  request<void>('/stock/stock-dispatch/post', { method: 'POST', body: JSON.stringify({ reference, business, ledger }) });

export const getOrderStatus = (reference: string) =>
  request<{ quantity: number; value_minor: number }>(`/stock/order-status/${encodeURIComponent(reference)}`);

export interface PeriodLockStatus {
  locked_through_date: string | null;
  changed_by: number | null;
  changed_at: string | null;
}
export const getPeriodStatus = (business: BusinessName, ledger: LedgerName) =>
  request<PeriodLockStatus>(`/period/status?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}`);
export const closePeriod = (business: BusinessName, ledger: LedgerName, throughDate: string) =>
  request<void>('/period/close', { method: 'POST', body: JSON.stringify({ business, ledger, throughDate }) });
export const reopenPeriod = (business: BusinessName, ledger: LedgerName) =>
  request<void>('/period/reopen', { method: 'POST', body: JSON.stringify({ business, ledger }) });

export const changeOwnPassword = (currentPassword: string, newPassword: string) =>
  request<void>('/auth/me/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) });

export const setOwnPageSize = (pageSize: number) => request<void>('/auth/me/page-size', { method: 'PUT', body: JSON.stringify({ pageSize }) });
export const setOwnNumberFormat = (numberFormat: string) =>
  request<void>('/auth/me/number-format', { method: 'PUT', body: JSON.stringify({ numberFormat }) });
export const setOwnDateFormat = (dateFormat: string) => request<void>('/auth/me/date-format', { method: 'PUT', body: JSON.stringify({ dateFormat }) });

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
  /** Present only when the scanned barcode is registered against a
   * real, specific combination (see climbInstanceTree/getCombinationByUpc) -
   * the register uses these directly, rather than asking a cashier to
   * manually pick each real dimension one at a time. */
  combinationValues?: string[];
  combinationShape?: [string, string][];
}
export const getItemStorageOrigin = (itemName: string) => request<{ origin: 'Hot' | 'Cold' | null }>(`/items/${encodeURIComponent(itemName)}/storage-origin`);
export const setItemStorageOrigin = (itemName: string, origin: 'Hot' | 'Cold' | null) =>
  request<void>(`/items/${encodeURIComponent(itemName)}/storage-origin`, { method: 'PUT', body: JSON.stringify({ origin }) });

export type BomComponent = { component: string; quantity: number; unit: string };
export const getBomComponents = (itemName: string) => request<{ components: BomComponent[] }>(`/items/${encodeURIComponent(itemName)}/bom`);
export const setBomComponent = (itemName: string, business: string, componentItem: string, quantity: number, unit: string) =>
  request<{ components: BomComponent[] }>(`/items/${encodeURIComponent(itemName)}/bom`, {
    method: 'PUT',
    body: JSON.stringify({ business, componentItem, quantity, unit }),
  });
export const deleteBomComponent = (itemName: string, componentItem: string) =>
  request<void>(`/items/${encodeURIComponent(itemName)}/bom/${encodeURIComponent(componentItem)}`, { method: 'DELETE' });
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
  package_quantity: number | null;
  is_preferred: boolean;
  preference_notes: string | null;
}
export interface ItemSourceInput {
  manufacturerName?: string | null;
  vendorName: VendorName;
  vendorSku?: string | null;
  vendorUpc?: string | null;
  priceMinor?: number | null;
  packageQuantity?: number | null;
  isPreferred?: boolean;
  preferenceNotes?: string | null;
}

export const listItems = (limit?: number, offset = 0) =>
  request<{ rows: ItemSummary[]; totalCount: number }>(`/items${limit != null ? `?limit=${limit}&offset=${offset}` : ''}`);
export const getItem = (name: string) => request<Item | null>(`/items/${encodeURIComponent(name)}`);

export interface ProductSummary {
  name: string;
  itemCount: number;
}
export const listProducts = () => request<ProductSummary[]>('/products');
export const createProduct = (name: string, parent = 'Items') => request<void>('/products', { method: 'POST', body: JSON.stringify({ name, parent }) });
export const setItemProduct = (itemName: string, productName: string | null) =>
  request<void>('/products/item-assignment', { method: 'PUT', body: JSON.stringify({ itemName, productName }) });
export const setItem = (name: string, item: Partial<Item>) =>
  request<void>(`/items/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify(item) });
export const listItemSources = (itemName: ItemName) => request<ItemSource[]>(`/items/${encodeURIComponent(itemName)}/sources`);
export const addOrUpdateItemSource = (itemName: ItemName, source: ItemSourceInput) =>
  request<void>(`/items/${encodeURIComponent(itemName)}/sources`, { method: 'POST', body: JSON.stringify(source) });
export const deleteItemSource = (id: number) => request<void>(`/items/sources/${id}`, { method: 'DELETE' });

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

export const listInvoices = (
  business: BusinessName,
  ledger: LedgerName,
  invoiceType?: 'AR' | 'AP',
  source: 'manual' | 'pos' | 'all' = 'manual',
  limit = 50,
  offset = 0
) =>
  request<{ rows: Invoice[]; totalCount: number }>(
    `/invoices?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}${invoiceType ? `&type=${invoiceType}` : ''}&source=${source}&limit=${limit}&offset=${offset}`
  );
export const getInvoiceById = (id: number) => request<Invoice>(`/invoices/${id}`);
export const createInvoice = (input: InvoiceInput) => request<{ id: number }>('/invoices', { method: 'POST', body: JSON.stringify(input) });
export const postInvoiceById = (id: number, revenueOrExpenseAccount: string, taxAccount: string, restockInventory = false) =>
  request<void>(`/invoices/${id}/post`, { method: 'POST', body: JSON.stringify({ revenueOrExpenseAccount, taxAccount, restockInventory }) });
export const getInvoiceOutstanding = (id: number) => request<{ outstanding_minor: number }>(`/invoices/${id}/outstanding`);
export const allocatePaymentToInvoice = (id: number, paymentReference: string, allocatedMinor: number, allocationDate: string, paymentAccount: string) =>
  request<void>(`/invoices/${id}/allocate`, { method: 'POST', body: JSON.stringify({ paymentReference, allocatedMinor, allocationDate, paymentAccount }) });

/** A real, exported UBL 2.1 XML document — fetched as raw text, not
 * through the generic, JSON-only request() helper, since this
 * endpoint returns a real XML file, not a JSON body. */
export async function exportInvoiceAsEInvoice(id: number): Promise<string> {
  const current = auth.current;
  const headers: Record<string, string> = {};
  if (current) headers.Authorization = `Bearer ${current.token}`;
  const res = await fetch(`${BASE}/invoices/${id}/e-invoice`, { headers });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.error?.message ?? body.error ?? message;
    } catch {
      /* ignore parse failure */
    }
    throw new ApiError(res.status, message);
  }
  return res.text();
}

export interface EInvoiceDiscrepancy {
  field: string;
  poValue: string;
  invoiceValue: string;
}
export interface ImportEInvoiceResult {
  invoiceId: number;
  discrepancies: EInvoiceDiscrepancy[];
}
export const importEInvoice = (xml: string, business: BusinessName, ledger: LedgerName, vendorName: VendorName, poReference?: string) =>
  request<ImportEInvoiceResult>('/invoices/import-e-invoice', { method: 'POST', body: JSON.stringify({ xml, business, ledger, vendorName, poReference }) });

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
  request<AgedRow[]>(
    `/reports/aged?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}&type=${invoiceType}${asOfDate ? `&asOfDate=${asOfDate}` : ''}`
  );
export const getAgedSummary = (business: BusinessName, ledger: LedgerName, invoiceType: 'AR' | 'AP', asOfDate?: string) =>
  request<AgedSummaryRow[]>(
    `/reports/aged/summary?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}&type=${invoiceType}${asOfDate ? `&asOfDate=${asOfDate}` : ''}`
  );

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
  request<CustomerStatement>(
    `/reports/statement?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}&customer=${encodeURIComponent(customer)}${asOfDate ? `&asOfDate=${asOfDate}` : ''}`
  );

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
  request<HistoryLine[]>(`/reports/history?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}&counterparty=${encodeURIComponent(counterparty)}`);

export interface ReminderCandidate {
  counterparty: string;
  current_level: number;
  next_level: number;
  outstanding_minor: number;
  oldest_days_overdue: number;
}
export const getReminderCandidates = (business: BusinessName, ledger: LedgerName, asOfDate?: string) =>
  request<ReminderCandidate[]>(`/reminders?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}${asOfDate ? `&asOfDate=${asOfDate}` : ''}`);
export const sendReminder = (counterparty: string) =>
  request<{ new_level: number }>(`/reminders/${encodeURIComponent(counterparty)}/send`, { method: 'POST' });
export const resetReminder = (counterparty: string) => request<void>(`/reminders/${encodeURIComponent(counterparty)}/reset`, { method: 'POST' });

// ---------------------------------------------------------------------------
// Stock write-offs and lot/expiration tracking
// ---------------------------------------------------------------------------

export const writeOffStock = (input: {
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
}) => request<void>('/stock-lots/write-off', { method: 'POST', body: JSON.stringify(input) });

export const receiveLot = (input: {
  business: BusinessName;
  ledger: LedgerName;
  reference: string;
  itemName: ItemName;
  lotNumber: string;
  receivedDate: string;
  expirationDate?: string | null;
  quantity: number;
}) => request<void>('/stock-lots/lots', { method: 'POST', body: JSON.stringify(input) });

export interface ExpiringLot {
  item: string;
  lot_number: string;
  expiration_date: string;
  quantity_on_hand: number;
  days_until_expiration: number;
}
export const getExpiringStock = (asOfDate?: string, withinDays = 30) =>
  request<ExpiringLot[]>(`/stock-lots/lots/expiring?withinDays=${withinDays}${asOfDate ? `&asOfDate=${asOfDate}` : ''}`);

// ---------------------------------------------------------------------------
// Locations, per-location stock, transfers, below-reorder, and Stock Takes
// ---------------------------------------------------------------------------

export interface LocationInput {
  city: string;
  location_type: string;
  is_billing_address: boolean;
  bottle_capacity?: number | null;
  carton_capacity?: number | null;
  // A real, direct IANA timezone identifier (e.g. "Australia/Sydney")
  // — required, since a real, physical location's own transactions
  // must record against that location's own real, local calendar day.
  timezone: string;
}
export interface LocationRecord extends LocationInput {
  name: string;
}

export const listLocations = (business: BusinessName) => request<LocationRecord[]>(`/locations?business=${encodeURIComponent(business)}`);

export interface EmployeeClock {
  employee: string;
  po_reference: string;
  project_expense_account: string;
  clocked_in_at: string;
}
export const clockInToProject = (employeeName: EmployeeName, projectExpenseAccount: string, business: BusinessName, ledger: LedgerName) =>
  request<EmployeeClock>('/projects/clock-in', { method: 'POST', body: JSON.stringify({ employeeName, projectExpenseAccount, business, ledger }) });
export const clockOutOfProject = (employeeName: EmployeeName, business: BusinessName, ledger: LedgerName) =>
  request<void>('/projects/clock-out', { method: 'POST', body: JSON.stringify({ employeeName, business, ledger }) });
export const getOpenProjectClock = (employeeName: EmployeeName) =>
  request<EmployeeClock | null>(`/projects/open-clock?employeeName=${encodeURIComponent(employeeName)}`);
export const getLocationByName = (name: string) => request<LocationRecord>(`/locations/${encodeURIComponent(name)}`);
export const saveLocation = (name: string, input: LocationInput) =>
  request<void>(`/locations/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify(input) });

export interface OpenHoursLine {
  day: string;
  opens_at: string;
  closes_at: string;
}
export const getLocationOpenHours = (locationName: LocationName) => request<OpenHoursLine[]>(`/locations/${encodeURIComponent(locationName)}/open-hours`);
export const setLocationOpenHours = (locationName: LocationName, hours: OpenHoursLine[]) =>
  request<void>(`/locations/${encodeURIComponent(locationName)}/open-hours`, { method: 'PUT', body: JSON.stringify({ hours }) });

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
export const getScheduleAtLocation = (locationName: LocationName) => request<LocationScheduleLine[]>(`/locations/${encodeURIComponent(locationName)}/schedule`);
export const getEmployeeSchedule = (employeeName: EmployeeName) => request<EmployeeScheduleLine[]>(`/locations/employees/${encodeURIComponent(employeeName)}/schedule`);
export const setEmployeeSchedule = (employeeName: EmployeeName, locationName: LocationName, schedule: ScheduleLine[]) =>
  request<void>(`/locations/employees/${encodeURIComponent(employeeName)}/schedule`, { method: 'PUT', body: JSON.stringify({ locationName, schedule }) });

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
  request<ItemLocationLevels>(`/locations/${encodeURIComponent(locationName)}/items/${encodeURIComponent(itemName)}`);
export const setItemLocationLevels = (
  itemName: ItemName,
  locationName: LocationName,
  levels: { minLevel?: number | null; maxLevel?: number | null; reorderLevel?: number | null; shelfSide?: string | null; rack?: string | null; level?: number | null }
) => request<void>(`/locations/${encodeURIComponent(locationName)}/items/${encodeURIComponent(itemName)}`, { method: 'PUT', body: JSON.stringify(levels) });

export const receiveStockAtLocation = (
  locationName: LocationName,
  input: { business: BusinessName; ledger: LedgerName; reference: string; itemName: ItemName; quantity: number; transdate?: string }
) => request<void>(`/locations/${encodeURIComponent(locationName)}/receive`, { method: 'POST', body: JSON.stringify(input) });

export const dispatchStockFromLocation = (
  locationName: LocationName,
  input: { business: BusinessName; ledger: LedgerName; reference: string; itemName: ItemName; quantity: number; transdate?: string }
) => request<void>(`/locations/${encodeURIComponent(locationName)}/dispatch`, { method: 'POST', body: JSON.stringify(input) });

export const transferStock = (input: { business: BusinessName; ledger: LedgerName; itemName: ItemName; fromLocationName: string; toLocationName: string; quantity: number; reference: string }) =>
  request<void>('/locations/transfer', { method: 'POST', body: JSON.stringify(input) });

export interface BelowReorderRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  reorder_level: number;
  min_level: number | null;
  max_level: number | null;
}
export const getBelowReorderStock = () => request<BelowReorderRow[]>('/reports/below-reorder');
export interface StockOutRiskRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  daily_consumption_rate: number;
  days_until_stockout: number | null;
  shortest_lead_time_days: number | null;
  at_risk: boolean;
}
export const getStockOutRiskReport = (windowDays = 2) => request<StockOutRiskRow[]>(`/reports/stock-out-risk?windowDays=${windowDays}`);
export const setItemSourceLeadTime = (item: string, vendor: string, days: number) =>
  request<void>('/reports/stock-out-risk/lead-time', { method: 'POST', body: JSON.stringify({ item, vendor, days }) });

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
export const getRestockPickingList = (runReference: string, warehouseName: string, lines: RestockLineInput[]) =>
  request<PickingListLine[]>(`/locations/restock/${encodeURIComponent(runReference)}/picking-list`, {
    method: 'POST',
    body: JSON.stringify({ warehouseName, lines }),
  });
export const confirmRestockPickedLine = (runReference: string, item: string, business: BusinessName, ledger: LedgerName) =>
  request<void>(`/locations/restock/${encodeURIComponent(runReference)}/confirm-picked`, { method: 'POST', body: JSON.stringify({ item, business, ledger }) });
export const dispatchRestockRun = (
  runReference: string,
  business: BusinessName,
  ledger: LedgerName,
  warehouseName: string,
  retailOutletName: string,
  lines: RestockLineInput[],
  transdate?: string
) =>
  request<void>(`/locations/restock/${encodeURIComponent(runReference)}/dispatch`, {
    method: 'POST',
    body: JSON.stringify({ business, ledger, warehouseName, retailOutletName, lines, transdate }),
  });

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

export const createStockTake = (locationName: LocationName, takeDate: string) =>
  request<{ id: number }>('/stock-takes', { method: 'POST', body: JSON.stringify({ locationName, takeDate }) });
export const getStockTake = (id: number) => request<StockTake>(`/stock-takes/${id}`);
export const recordStockTakeCount = (id: number, itemName: ItemName, countedQuantity: number) =>
  request<void>(`/stock-takes/${id}/count`, { method: 'POST', body: JSON.stringify({ itemName, countedQuantity }) });
export const completeStockTake = (
  id: number,
  business: BusinessName,
  ledger: LedgerName,
  varianceExpenseAccount: string,
  inventoryAccount: string,
  unitCostMinorByItem: Record<string, number>
) =>
  request<void>(`/stock-takes/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ business, ledger, varianceExpenseAccount, inventoryAccount, unitCostMinorByItem }),
  });

// ---------------------------------------------------------------------------
// POS terminal
// ---------------------------------------------------------------------------

export const lookupItemByUpc = (upc: string) => request<ItemSummary>(`/pos/lookup/${encodeURIComponent(upc)}`);

export interface PosSaleLineInput {
  itemName: ItemName;
  quantity: number;
  unitPriceMinor?: number;
  taxMinor: number;
  tier?: string;
  /** Present only when this line represents a real, specific
   * combination (see climbInstanceTree/getCombinationByUpc) — set
   * automatically when a barcode registered against one is scanned. */
  combinationValues?: string[];
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
}) => request<PosSaleResult>('/pos/complete-sale', { method: 'POST', body: JSON.stringify(input) });

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
  vendorName: VendorName;
  lines: CashPurchaseLineInput[];
  taxAccount: string;
  paymentMethod?: string;
  transdate?: string;
}) => request<CashPurchaseResult>('/pos/complete-cash-purchase', { method: 'POST', body: JSON.stringify(input) });

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
  /** Required for an hourly employee. Omit entirely for a salaried
   * one — providing it is refused as a real, honest mismatch. */
  hours?: number;
  wagesExpenseAccount?: string;
  paymentMethod?: string;
  transdate?: string;
}) => request<PayWagesResult>('/pos/pay-wages', { method: 'POST', body: JSON.stringify(input) });

export interface OrganizationChart {
  business: BusinessName;
  companyWideEmployees: string[];
  divisions: { division: DivisionName; locations: { location: string; employees: string[] }[] }[];
}
export const getOrganizationChart = (businessName: string) => request<OrganizationChart>(`/pos/org-chart/${encodeURIComponent(businessName)}`);

export interface CloseBooksResult {
  reference: string;
  netIncomeMinor: number;
  accountsZeroed: number;
  divisionBreakdown: { division: DivisionName | null; netIncomeMinor: number }[];
}
export const closeBooks = (input: { business: BusinessName; ledger: LedgerName; asOfDate: string; retainedEarningsAccount: string }) =>
  request<CloseBooksResult>('/journal/close-books', { method: 'POST', body: JSON.stringify(input) });

export interface CloseBooksPreview {
  lines: { account: AccountName; amount_minor: number; division?: string }[];
  netIncomeMinor: number;
  accountsZeroed: number;
  divisionBreakdown: { division: DivisionName | null; netIncomeMinor: number }[];
}
export const previewCloseBooks = (input: { ledger: LedgerName; asOfDate: string; retainedEarningsAccount: string }) =>
  request<CloseBooksPreview>('/journal/preview-close-books', { method: 'POST', body: JSON.stringify(input) });

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
  request<{ status: string }>('/customers/register', { method: 'POST', body: JSON.stringify(input) });

export interface PendingCustomer {
  name: string;
  email: string | null;
  phone: string | null;
  card_label: string | null;
}
export const listPendingCustomers = () => request<PendingCustomer[]>('/customer-verification/pending');
export const verifyCustomer = (name: string, approve: boolean) =>
  request<void>(`/customer-verification/${encodeURIComponent(name)}/verify`, { method: 'POST', body: JSON.stringify({ approve }) });

// ---------------------------------------------------------------------------
// Stock listing — every item/location combination with real stock
// ---------------------------------------------------------------------------

export interface StockListingRow {
  item: string;
  location: string;
  quantity_on_hand: number;
  min_level: number | null;
  max_level: number | null;
  reorder_level: number | null;
}
export const getStockListing = (limit = 100, offset = 0) =>
  request<{ rows: StockListingRow[]; totalCount: number }>(`/stock-listing?limit=${limit}&offset=${offset}`);

export interface LocationCapacityStatus {
  bottleQuantity: number;
  bottleCapacity: number | null;
  bottleOverCapacity: boolean;
  cartonQuantity: number;
  cartonCapacity: number | null;
  cartonOverCapacity: boolean;
}
export interface StockListingLocationGroup {
  location: string;
  city: string | null;
  division: DivisionName | null;
  rows: StockListingRow[];
  total_on_hand: number;
  capacity: LocationCapacityStatus;
}
export const getStockListingByLocation = () => request<StockListingLocationGroup[]>('/stock-listing/by-location');

export interface StockMovementRow {
  item: string;
  category: string | null;
  quantity: number;
  date: string;
}
export interface StockReceiptRow extends StockMovementRow {
  location: string;
  division: DivisionName | null;
  vendor: string | null;
}
export interface StockTransferRow extends StockMovementRow {
  from_location: string;
  to_location: string;
}
export interface StockSaleRow extends StockMovementRow {
  location: string;
  division: DivisionName | null;
  vendor: string | null;
  amount_minor: number;
}
export interface StockMovementReport {
  receipts: StockReceiptRow[];
  transfers: StockTransferRow[];
  sales: StockSaleRow[];
}
export const getStockMovementReport = (ledger: LedgerName, fromDate?: string, toDate?: string) =>
  request<StockMovementReport>(
    `/stock-listing/movement?ledger=${encodeURIComponent(ledger)}${fromDate ? `&fromDate=${fromDate}` : ''}${toDate ? `&toDate=${toDate}` : ''}`
  );
