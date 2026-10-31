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
