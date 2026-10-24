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

export const getEntityTree = () => request<EntityNode[]>('/entities');

export interface HierarchyLinkPointingAt {
  entityName: string;
  hierarchyName: string;
}
export const getHierarchyLinksPointingAt = (entityId: number) => request<HierarchyLinkPointingAt[]>(`/entities/${entityId}/hierarchy-links`);

export const createEntity = (data: { name: string; parent?: string | null; parentId?: number | null; relation?: string | null; accountnumber?: string | null }, screenName?: string) =>
  request<EntityNode>('/entities', { method: 'POST', body: JSON.stringify(data) }, screenName);
export const setEntityRelationship = (entityName: string, relationshipType: string, targetName: string) =>
  request<void>('/entities/relationship', { method: 'POST', body: JSON.stringify({ entityName, relationshipType, targetName }) });

// See docs/pm-frontend-reference.md.
export const createProvider = (name: string, screenName?: string) => request<EntityNode>('/entities/contact', { method: 'POST', body: JSON.stringify({ type: 'vendor', name }) }, screenName);
export const createCustomer = (name: string, screenName?: string) => request<EntityNode>('/entities/contact', { method: 'POST', body: JSON.stringify({ type: 'customer', name }) }, screenName);
export const createEmployeeContact = (name: string, placeOfEmployment: string, screenName?: string) =>
  request<EntityNode>('/entities/contact', { method: 'POST', body: JSON.stringify({ type: 'employee', name, placeOfEmployment }) }, screenName);

export const supersedeEntity = (
  id: number,
  data: { name?: string; parent?: string | null; relation?: string | null; accountnumber?: string | null }
) => request<EntityNode>(`/entities/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const revokeEntity = (id: number) => request<void>(`/entities/${id}`, { method: 'DELETE' });

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
// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const setMenuOverride = (menuItemKey: string, scope: 'business' | 'user', scopeId: number, overrideLabel: string | null, hidden: boolean) =>
//   request<{ ok: true }>('/menu/override', { method: 'POST', body: JSON.stringify({ menuItemKey, scope, scopeId, overrideLabel, hidden }) });
// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const deleteMenuOverride = (menuItemKey: string, scope: 'business' | 'user', scopeId: number) =>
//   request<{ ok: true }>('/menu/override', { method: 'DELETE', body: JSON.stringify({ menuItemKey, scope, scopeId }) });

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
export const getProfitAndLoss = (business: BusinessName, ledger: LedgerName, fromDate?: string, toDate?: string, group?: string, hierarchyPath?: string[], hierarchyName?: string) =>
  request<ProfitAndLoss>(
    `/reports/profit-and-loss?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}${fromDate ? `&fromDate=${fromDate}` : ''}${toDate ? `&toDate=${toDate}` : ''}${group ? `&group=${encodeURIComponent(group)}` : ''}${hierarchyPath && hierarchyPath.length > 0 ? `&hierarchyPath=${encodeURIComponent(hierarchyPath.join(','))}` : ''}${hierarchyName ? `&hierarchyName=${encodeURIComponent(hierarchyName)}` : ''}`
  );

export interface ProfitAndLossByGroup {
  group: HierarchyGroupName | null;
  profitAndLoss: ProfitAndLoss;
}
export const getProfitAndLossByHierarchy = (business: BusinessName, ledger: LedgerName, hierarchyPath: string[], fromDate?: string, toDate?: string) =>
  request<ProfitAndLossByGroup[]>(
    `/reports/profit-and-loss-by-hierarchy?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}&hierarchyPath=${encodeURIComponent(hierarchyPath.join(','))}${fromDate ? `&fromDate=${fromDate}` : ''}${toDate ? `&toDate=${toDate}` : ''}`
  );

export interface ProfitAndLossByGroupNode extends ProfitAndLossByGroup {
  children: ProfitAndLossByGroupNode[];
}
export const getProfitAndLossByHierarchyTree = (business: BusinessName, ledger: LedgerName, hierarchyPath: string[], hierarchyName?: string, fromDate?: string, toDate?: string) =>
  request<ProfitAndLossByGroupNode[]>(
    `/reports/profit-and-loss-by-hierarchy-tree?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}&hierarchyPath=${encodeURIComponent(hierarchyPath.join(','))}${hierarchyName ? `&hierarchyName=${encodeURIComponent(hierarchyName)}` : ''}${fromDate ? `&fromDate=${fromDate}` : ''}${toDate ? `&toDate=${toDate}` : ''}`
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

// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const getVocabularyAlternates = (word: string) => request<string[]>(`/i18n/vocabulary-alternates/${encodeURIComponent(word)}`);

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

export interface HierarchyGroupRecord {
  name: string;
  parentName: string | null;
}
// Generic replacement for the former, privileged getDivisions() — see docs/pm-frontend-reference.md.
export const getHierarchyGroups = (hierarchyName: string) => request<HierarchyGroupRecord[]>(`/hierarchy/groups?name=${encodeURIComponent(hierarchyName)}`);

export interface HierarchyGroupingWithValues {
  grouping: string;
  values: string[];
}
export const getHierarchy = (business: string) => request<HierarchyGroupingWithValues[]>(`/hierarchy?business=${encodeURIComponent(business)}`);
export const getProductShapes = (business: string) => request<[string, string][][]>(`/hierarchy/shapes?business=${encodeURIComponent(business)}`);
export const createHierarchyGrouping = (business: string, groupingName: string) =>
  request<{ name: string }>('/hierarchy/groupings', { method: 'POST', body: JSON.stringify({ business, groupingName }) });
export const createHierarchyValue = (business: string, groupingName: string, valueName: string, parentValueName?: string | null) =>
  request<{ name: string }>('/hierarchy/values', { method: 'POST', body: JSON.stringify({ business, groupingName, valueName, parentValueName }) });
export const defineProductShape = (business: string, dimensions: [string, string][]) =>
  request<{ dimensions: [string, string][] }>('/hierarchy/shapes', { method: 'POST', body: JSON.stringify({ business, dimensions }) });

// Generic entity-to-hierarchy-value tagging — see docs/pm-frontend-reference.md.
export const setHierarchyTag = (entityName: string, hierarchyName: string, parentName: string) =>
  request<{ entityName: string; hierarchyName: string; parentName: string }>('/hierarchy/parent', { method: 'POST', body: JSON.stringify({ entityName, hierarchyName, parentName }) });
export const getHierarchyTag = (entityName: string, hierarchyName: string) =>
  request<{ parentName: string | null }>(`/hierarchy/parent?entityName=${encodeURIComponent(entityName)}&hierarchyName=${encodeURIComponent(hierarchyName)}`);
export const deleteHierarchyTag = (entityName: string, hierarchyName: string) =>
  request<void>(`/hierarchy/parent?entityName=${encodeURIComponent(entityName)}&hierarchyName=${encodeURIComponent(hierarchyName)}`, { method: 'DELETE' });

export const getBusinesses = () => request<{ id: number; name: string }[]>('/businesses');
export const getBusinessTypes = () => request<{ name: string; questions: string[] }[]>('/businesses/types');
export const saveBusinessTypeAnswers = (businessName: string, answers: Record<string, string>) =>
  request<void>(`/businesses/${encodeURIComponent(businessName)}/business-type-answers`, { method: 'POST', body: JSON.stringify({ answers }) });
export const getLedgers = (businessName: string) =>
  request<{ id: number; name: string }[]>(`/businesses/${encodeURIComponent(businessName)}/ledgers`);
// Session/ledger/Profit Center pickers — see docs/pm-frontend-reference.md.
export const getActiveLedger = (businessName: string) =>
  request<{ activeLedger: string | null }>(`/businesses/${encodeURIComponent(businessName)}/active-ledger`);
export const getProfitCenters = (businessName: string) =>
  request<{ id: number; name: string }[]>(`/businesses/${encodeURIComponent(businessName)}/profit-centers`);
export const createProfitCenter = (businessName: string, profitCenterName: string) =>
  request<{ id: number; name: string }>(`/businesses/${encodeURIComponent(businessName)}/profit-centers`, { method: 'POST', body: JSON.stringify({ profitCenterName }) });
export const setSessionProfitCenter = (profitCenterName: string | null) =>
  request<void>('/auth/session/profit-center', { method: 'POST', body: JSON.stringify({ profitCenterName }) });
export const createBusiness = (
  businessName: string,
  financialYearLabel: string,
  coaPrototype?: string,
  secondaryCurrencies?: string[],
  entityStructure?: 'sole_trader' | 'partnership' | 'llc' | 'unlimited_liability' | 'publicly_traded',
  partnerNames?: string[],
  screenName?: string
) =>
  // businessAdmin.password is shown exactly once, never recoverable later — see docs/pm-frontend-reference.md.
  request<{ business: BusinessName; actualLedger: string; budgetLedger: string; businessAdmin: { username: string; password: string } }>('/businesses', {
    method: 'POST',
    body: JSON.stringify({ businessName, financialYearLabel, coaPrototype, secondaryCurrencies, entityStructure, partnerNames }),
  }, screenName);
export const getCoaPrototypeAccounts = (language: string) => request<string[]>(`/businesses/coa-prototype/${encodeURIComponent(language)}`);

export const nominateBankAccount = (businessName: string, bankAccountName: string, routingDetail: string, accountNumber: string) =>
  request<{ id: number }>(`/businesses/${encodeURIComponent(businessName)}/bank-accounts`, { method: 'POST', body: JSON.stringify({ bankAccountName, routingDetail, accountNumber }) });

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
  request<BusinessConfigurationReport>(`/businesses/${encodeURIComponent(businessName)}/configuration-report`);

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

export const stageLine = (line: StagedLine, screenName?: string) => request<void>('/journal/staging', { method: 'POST', body: JSON.stringify(line) }, screenName);

// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const getStagedLines = (reference: string, business: BusinessName, ledger: LedgerName) =>
//   request<StagedLine[]>(
//     `/journal/staging/${encodeURIComponent(reference)}/${encodeURIComponent(business)}/${encodeURIComponent(ledger)}`
//   );

// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const removeStagedLine = (reference: string, business: BusinessName, ledger: LedgerName, account: AccountName) =>
//   request<void>(
//     `/journal/staging/${encodeURIComponent(reference)}/${encodeURIComponent(business)}/${encodeURIComponent(ledger)}/${encodeURIComponent(account)}`,
//     { method: 'DELETE' }
//   );

export const postJournalEntry = (reference: string, business: BusinessName, ledger: LedgerName, screenName?: string) =>
  request<void>('/journal/post', { method: 'POST', body: JSON.stringify({ reference, business, ledger }) }, screenName);

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
  lines: { account: AccountName; accountnumber: string | null; amount_minor: number; memo: string }[];
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
  request<void>('/arap/ar-receipt/stage', { method: 'POST', body: JSON.stringify(input) });
export const postARReceipt = (reference: string, business: BusinessName, ledger: LedgerName) =>
  request<void>('/arap/ar-receipt/post', { method: 'POST', body: JSON.stringify({ reference, business, ledger }) });

// stageAPPurchase/postAPPurchase removed entirely (docs/canned-journal-to-frontend-design.md)
// — confirmed dead (no references anywhere), and their backend route/table/trigger removed too.

export const stageAPPayment = (input: ARAPBaseInput & { vendor: string }) =>
  request<void>('/arap/ap-payment/stage', { method: 'POST', body: JSON.stringify(input) });
export const postAPPayment = (reference: string, business: BusinessName, ledger: LedgerName) =>
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

// See docs/pm-frontend-reference.md.
export interface UserRoleMatrix {
  users: string[];
  roles: string[];
  assignments: { user: string; role: string }[];
}
export const getUserRoleMatrix = (business: string) => request<UserRoleMatrix>(`/auth/businesses/${encodeURIComponent(business)}/role-matrix`);
export const setUserRoleInBusiness = (business: string, username: string, roleName: string) =>
  request<void>(`/auth/businesses/${encodeURIComponent(business)}/role-matrix/${encodeURIComponent(username)}/${encodeURIComponent(roleName)}`, { method: 'PUT' });
export const unsetUserRoleInBusiness = (business: string, username: string, roleName: string) =>
  request<void>(`/auth/businesses/${encodeURIComponent(business)}/role-matrix/${encodeURIComponent(username)}/${encodeURIComponent(roleName)}`, { method: 'DELETE' });

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
export const stagePurchaseOrder = (input: PurchaseOrderInput, screenName?: string) =>
  request<void>('/stock/po/stage', { method: 'POST', body: JSON.stringify(input) }, screenName);
export const postPurchaseOrder = (reference: string, business: BusinessName, ledger: LedgerName, screenName?: string) =>
  request<void>('/stock/po/post', { method: 'POST', body: JSON.stringify({ reference, business, ledger }) }, screenName);

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
  request<void>('/stock/stock-receipt/stage', { method: 'POST', body: JSON.stringify(input) });
export const postOrderReceipt = (reference: string, business: BusinessName, ledger: LedgerName) =>
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
  request<void>('/stock/stock-dispatch/stage', { method: 'POST', body: JSON.stringify(input) });
export const postOrderDispatch = (reference: string, business: BusinessName, ledger: LedgerName) =>
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

export const getRecordingStatus = () => request<{ recording: boolean }>('/recording');
export const startRecording = () => request<{ recording: boolean }>('/recording/start', { method: 'POST' });
export const stopRecording = () => request<{ recording: boolean }>('/recording/stop', { method: 'POST' });

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
  combinationValues?: string[]; // set when a scanned barcode matches a specific combination — see docs/pm-frontend-reference.md
  combinationShape?: [string, string][];
}
// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const getItemStorageOrigin = (itemName: string) => request<{ origin: 'Hot' | 'Cold' | null }>(`/items/${encodeURIComponent(itemName)}/storage-origin`);
// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const setItemStorageOrigin = (itemName: string, origin: 'Hot' | 'Cold' | null) =>
//   request<void>(`/items/${encodeURIComponent(itemName)}/storage-origin`, { method: 'PUT', body: JSON.stringify({ origin }) });

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
export const listItems = (business: string, limit?: number, offset = 0) =>
  request<{ rows: ItemSummary[]; totalCount: number }>(`/items?business=${encodeURIComponent(business)}${limit != null ? `&limit=${limit}&offset=${offset}` : ''}`);
export const getItem = (name: string) => request<Item | null>(`/items/${encodeURIComponent(name)}`);

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
  request<void>(`/items/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify(item) });
export const listItemSources = (itemName: ItemName) => request<ItemSource[]>(`/items/${encodeURIComponent(itemName)}/sources`);
export const addOrUpdateItemSource = (itemName: ItemName, source: ItemSourceInput, screenName?: string) =>
  request<void>(`/items/${encodeURIComponent(itemName)}/sources`, { method: 'POST', body: JSON.stringify(source) }, screenName);
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
export const importEInvoice = (xml: string, business: BusinessName, ledger: LedgerName, vendorName: ProviderName, poReference?: string) =>
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
  timezone: string; // IANA identifier, required — see docs/pm-frontend-reference.md
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
// Scoped by business, like createLocation — see docs/pm-frontend-reference.md.
export const saveLocation = (name: string, input: LocationInput, business: string) =>
  request<void>(`/locations/${encodeURIComponent(name)}?business=${encodeURIComponent(business)}`, { method: 'PUT', body: JSON.stringify(input) });

// A single atomic server-side request — see docs/pm-frontend-reference.md.
export const createLocation = (name: string, business: string, input: LocationInput, screenName?: string) =>
  request<void>(`/locations/${encodeURIComponent(name)}?business=${encodeURIComponent(business)}`, { method: 'POST', body: JSON.stringify(input) }, screenName);

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
}) => request<void>('/locations/convert-storage', { method: 'POST', body: JSON.stringify(input) });

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
}, screenName?: string) => request<void>('/locations/open-container', { method: 'POST', body: JSON.stringify(input) }, screenName);

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
}, screenName?: string) =>
  request<ResolvedOpenContainerAccounts>('/locations/resolve-open-container-accounts', { method: 'POST', body: JSON.stringify(input) }, screenName);

// See docs/pm-frontend-reference.md.
export const getLocationCurrencies = (locationName: string) => request<string[]>(`/locations/${encodeURIComponent(locationName)}/currencies`);
export const nominateLocationCurrency = (locationName: string, currencyCode: string) =>
  request<void>(`/locations/${encodeURIComponent(locationName)}/currencies`, { method: 'POST', body: JSON.stringify({ currencyCode }) });

export interface PosTerminalRecord {
  name: string;
  currency: string | null;
}
export const getPosTerminals = (locationName: string) => request<PosTerminalRecord[]>(`/pos/terminals/${encodeURIComponent(locationName)}`);
export const createPosTerminal = (locationName: string, terminalName: string, currency?: string) =>
  request<void>(`/pos/terminals/${encodeURIComponent(locationName)}`, { method: 'POST', body: JSON.stringify({ terminalName, currency }) });

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
// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const getScheduleAtLocation = (locationName: LocationName) => request<LocationScheduleLine[]>(`/locations/${encodeURIComponent(locationName)}/schedule`);
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
  levels: { minLevel?: number | null; maxLevel?: number | null; reorderLevel?: number | null; shelfSide?: string | null; rack?: string | null; level?: number | null },
  businessName: string,
  ledgerName?: string
) => request<void>(`/locations/${encodeURIComponent(locationName)}/items/${encodeURIComponent(itemName)}`, { method: 'PUT', body: JSON.stringify({ ...levels, business: businessName, ledger: ledgerName }) });

export const receiveItems = (
  locationName: LocationName,
  input: { business: BusinessName; ledger: LedgerName; reference: string; itemName: ItemName; quantity: number; transdate?: string; combinationValues?: string[]; combinationShape?: [string, string][] },
  screenName?: string
) => request<void>(`/locations/${encodeURIComponent(locationName)}/receive`, { method: 'POST', body: JSON.stringify(input) }, screenName);

// The narrow, physical-only half of the canned journal pattern — see docs/pm-frontend-reference.md.
export const receiveIntoStorageStock = (
  locationName: LocationName,
  input: { business: BusinessName; ledger: LedgerName; reference: string; itemName: ItemName; quantity: number; transdate?: string; combinationValues?: string[]; combinationShape?: [string, string][] },
  screenName?: string
) => request<void>(`/locations/${encodeURIComponent(locationName)}/receive-stock`, { method: 'POST', body: JSON.stringify(input) }, screenName);

export interface ResolvedReceiveAccounts {
  inventoryAccount: string;
  payableAccount: string;
  unitCostMinor: number | null;
}
export const resolveReceiveAccounts = (
  input: { business: BusinessName; itemName: ItemName; combinationValues?: string[]; combinationShape?: [string, string][] },
  screenName?: string
) => request<ResolvedReceiveAccounts | null>('/locations/resolve-receive-accounts', { method: 'POST', body: JSON.stringify(input) }, screenName);

// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const dispatchItems = (
//   locationName: LocationName,
//   input: { business: BusinessName; ledger: LedgerName; reference: string; itemName: ItemName; quantity: number; transdate?: string }
// ) => request<void>(`/locations/${encodeURIComponent(locationName)}/dispatch`, { method: 'POST', body: JSON.stringify(input) });

export const transferItems = (input: { business: BusinessName; ledger: LedgerName; itemName: ItemName; fromLocationName: string; toLocationName: string; quantity: number; reference: string }, screenName?: string) =>
  request<void>('/locations/transfer', { method: 'POST', body: JSON.stringify(input) }, screenName);

// The narrow, physical-only half of the canned journal pattern — see docs/pm-frontend-reference.md.
export const transferStock = (input: { business: BusinessName; ledger: LedgerName; itemName: ItemName; fromLocationName: string; toLocationName: string; quantity: number; reference: string; transdate?: string }, screenName?: string) =>
  request<void>('/locations/transfer-stock', { method: 'POST', body: JSON.stringify(input) }, screenName);

export interface ResolvedTransferAccounts {
  fromInventoryAccount: string;
  toInventoryAccount: string;
  unitCostMinor: number | null;
}
export const resolveTransferAccounts = (input: { business: BusinessName; itemName: ItemName; fromLocationName: string; toLocationName: string }, screenName?: string) =>
  request<ResolvedTransferAccounts>('/locations/resolve-transfer-accounts', { method: 'POST', body: JSON.stringify(input) }, screenName);

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
// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export const setItemSourceLeadTime = (item: string, vendor: string, days: number) =>
//   request<void>('/reports/stock-out-risk/lead-time', { method: 'POST', body: JSON.stringify({ item, vendor, days }) });

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

export const createStockTake = (locationName: LocationName, takeDate: string, businessName?: string) =>
  request<{ id: number }>('/stock-takes', { method: 'POST', body: JSON.stringify({ locationName, takeDate, business: businessName }) });
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
}, screenName?: string) => request<PosSaleResult>('/pos/complete-sale', { method: 'POST', body: JSON.stringify(input) }, screenName);

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
}, screenName?: string) => request<CashPurchaseResult>('/pos/complete-cash-purchase', { method: 'POST', body: JSON.stringify(input) }, screenName);

export const receiveStock = (input: {
  business: BusinessName;
  ledger: LedgerName;
  reference: string;
  locationName: LocationName;
  lines: { itemName: string; quantity: number }[];
  transdate?: string;
}, screenName?: string) => request<void>('/pos/receive-stock', { method: 'POST', body: JSON.stringify(input) }, screenName);

export const dispatchStock = (input: {
  business: BusinessName;
  ledger: LedgerName;
  reference: string;
  locationName: LocationName;
  lines: { itemName: string; quantity: number }[];
  transdate?: string;
}, screenName?: string) => request<void>('/pos/dispatch-stock', { method: 'POST', body: JSON.stringify(input) }, screenName);

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
}) => request<PayWagesResult>('/pos/pay-wages', { method: 'POST', body: JSON.stringify(input) });

export interface OrganizationChart {
  business: BusinessName;
  companyWideEmployees: string[];
  groups: { group: HierarchyGroupName; locations: { location: string; employees: string[] }[] }[];
}
export const getOrganizationChart = (businessName: string) => request<OrganizationChart>(`/pos/org-chart/${encodeURIComponent(businessName)}`);

export interface CloseBooksResult {
  reference: string;
  netIncomeMinor: number;
  accountsZeroed: number;
  groupBreakdown: { group: HierarchyGroupName | null; netIncomeMinor: number }[];
  profitCenterBreakdown: { profitCenter: string | null; netIncomeMinor: number }[]; // per Profit Center, mirroring groupBreakdown
}
export const closeBooks = (input: { business: BusinessName; ledger: LedgerName; asOfDate: string; retainedEarningsAccount: string; hierarchyPath?: string[] }) =>
  request<CloseBooksResult>('/journal/close-books', { method: 'POST', body: JSON.stringify(input) });

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
  request<CloseBooksPreview>('/journal/preview-close-books', { method: 'POST', body: JSON.stringify(input) });

// Mirrors the Close Books canned journal split, for Rollover — see docs/pm-frontend-reference.md.
export interface ResolvedRollover {
  reference: string;
  lines: { account: AccountName; amount_minor: number }[];
  accountsCarriedForward: number;
}
export const resolveRolloverLines = (input: { business: BusinessName; oldLedger: LedgerName; newLedger: LedgerName; asOfDate: string }) =>
  request<ResolvedRollover>('/journal/resolve-rollover-lines', { method: 'POST', body: JSON.stringify(input) });

export const createLedger = (business: BusinessName, ledger: LedgerName) =>
  request<{ ledger: string }>('/journal/create-ledger', { method: 'POST', body: JSON.stringify({ business, ledger }) });

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
export const getInventoryListingByLocation = (businessName: string, hierarchyName?: string) =>
  request<InventoryListingLocationGroup[]>(`/stock-listing/by-location?business=${encodeURIComponent(businessName)}${hierarchyName ? `&hierarchyName=${encodeURIComponent(hierarchyName)}` : ''}`);

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
export const getStorageSpaceReport = () => request<StorageSpaceLocationGroup[]>('/stock-listing/storage-space');

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
  request<StockMovementReport>(
    `/stock-listing/movement?business=${encodeURIComponent(business)}&ledger=${encodeURIComponent(ledger)}${fromDate ? `&fromDate=${fromDate}` : ''}${toDate ? `&toDate=${toDate}` : ''}${hierarchyName ? `&hierarchyName=${encodeURIComponent(hierarchyName)}` : ''}`
  );
