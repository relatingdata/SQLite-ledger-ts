// Consolidated shared application state (auth, dirty-state, menu,
// session, translations), using Svelte 5 runes throughout — see
// docs/pm-frontend-reference.md for the full design.
import { browser } from '$app/environment';
import { asBusinessName, asLedgerName, type BusinessName, type LedgerName } from './api';
import type { MenuSectionRow } from './api';

// Auth — the currently logged-in user, if any.
export interface AuthUser {
  id: number;
  username: string;
  roles: string[];
  page_size: number;
  number_format: string; // see docs/pm-frontend-reference.md and $lib/format
  date_format: string;
}

export interface AuthState {
  token: string;
  user: AuthUser;
}

const AUTH_STORAGE_KEY = 'sql-ledger-ts-auth';

// sessionStorage, not localStorage — see docs/pm-frontend-reference.md.
function loadStoredAuth(): AuthState | null {
  if (!browser) return null;
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthState) : null;
  } catch {
    return null;
  }
}

let authState = $state<AuthState | null>(loadStoredAuth());

export const auth = {
  get current() {
    return authState;
  },
  set(state: AuthState) {
    if (browser) sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
    authState = state;
  },
  clear() {
    if (browser) sessionStorage.removeItem(AUTH_STORAGE_KEY);
    authState = null;
  },
};

export function hasRole(state: AuthState | null, ...roles: string[]): boolean {
  if (!state) return false;
  return state.user.roles.some((r) => roles.includes(r));
}

// Dirty state — unsaved-edit flag for the Esc-to-sidebar warning; see
// docs/pm-frontend-reference.md.
let unsavedEdit = $state(false);

export const hasUnsavedEdit = {
  get current() {
    return unsavedEdit;
  },
  set(value: boolean) {
    unsavedEdit = value;
  },
};

// Menu — the live, resolved menu tree; see docs/pm-frontend-reference.md.
let menuTreeState = $state<MenuSectionRow[]>([]);

export const menuTree = {
  get current() {
    return menuTreeState;
  },
  set(value: MenuSectionRow[]) {
    menuTreeState = value;
  },
};

// See docs/pm-frontend-reference.md.
export function screenTitle(href: string): string | undefined {
  for (const section of menuTreeState) {
    for (const link of section.links) {
      if (link.href.split('?')[0] === href) return link.label;
    }
  }
  return undefined;
}

// Session — the currently active business/ledger/language.
export interface SessionContext {
  businessId: number;
  businessName: BusinessName;
  ledgerId: number;
  ledgerName: LedgerName;
  languageId: number;
  languageName: string;
  // Per docs/profit-centers-design.md Phase C — see docs/pm-frontend-reference.md.
  profitCenterId?: number;
  profitCenterName?: string;
}

const SESSION_STORAGE_KEY = 'sql-ledger-ts-session';

function loadStoredSession(): SessionContext | null {
  if (!browser) return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionContext;
    // Cast once at this boundary — see docs/pm-frontend-reference.md.
    return { ...parsed, businessName: asBusinessName(parsed.businessName), ledgerName: asLedgerName(parsed.ledgerName) };
  } catch {
    return null;
  }
}

let sessionState = $state<SessionContext | null>(loadStoredSession());

export const session = {
  get current() {
    return sessionState;
  },
  set(context: SessionContext) {
    if (browser) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(context));
    sessionState = context;
  },
  clear() {
    if (browser) localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionState = null;
  },
};

// Translations — see docs/pm-frontend-reference.md.
let translationsState = $state<Record<string, string>>({});

export const translations = {
  get current() {
    return translationsState;
  },
  set(value: Record<string, string>) {
    translationsState = value;
  },
};
