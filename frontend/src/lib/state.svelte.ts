// state.svelte.ts — the one, real, consolidated home for every real,
// shared piece of application state, using Svelte 5 runes throughout.
// Replaces five, separate, real files (auth.ts, dirty-state.ts,
// menu.ts, session.ts, translations.ts) — the exact "one library of
// common code, not the mess we have" consolidation, alongside the
// real runes migration itself.
import { browser } from '$app/environment';
import { asBusinessName, asLedgerName, type BusinessName, type LedgerName } from './api';
import type { MenuSectionRow } from './api';

// ===========================================================================
// Auth — the real, currently logged-in user, if any.
// ===========================================================================
export interface AuthUser {
  id: number;
  username: string;
  roles: string[];
  /** How many rows this user sees per page on any paginated list. */
  page_size: number;
  /** Explicit, fixed-choice display patterns — see $lib/format for
   * how these are actually applied. */
  number_format: string;
  date_format: string;
}

export interface AuthState {
  token: string;
  user: AuthUser;
}

const AUTH_STORAGE_KEY = 'sql-ledger-ts-auth';

// Deliberately sessionStorage, not localStorage: a financial
// application shouldn't stay logged in indefinitely just because the
// token is sitting in storage — closing the browser should mean
// logging in again next time. sessionStorage still survives an
// ordinary page reload within the same tab (so a refresh doesn't log
// you out), but clears when the tab/window itself closes, unlike
// localStorage which persists across browser restarts entirely.
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

// ===========================================================================
// Dirty state — per direct request: pressing Esc while in a real,
// main-content panel should return focus to the left sidebar — but if
// that panel has a real, genuine, unsaved edit pending, Esc should
// warn first, rather than silently discard it. Any real, individual
// page can opt in by setting this true while it has a real, unsaved
// edit, and false again once saved or discarded — the shared layout
// itself only ever reads it, never assumes a page's own, internal
// state.
// ===========================================================================
let unsavedEdit = $state(false);

export const hasUnsavedEdit = {
  get current() {
    return unsavedEdit;
  },
  set(value: boolean) {
    unsavedEdit = value;
  },
};

// ===========================================================================
// Menu — the real, live, resolved menu tree, populated once by
// +layout.svelte (the same, established pattern as $session/$auth/
// $translations), so any real page can resolve its own screen title
// through the exact, same, real source its own menu label uses,
// without a real, separate, duplicate fetch.
// ===========================================================================
let menuTreeState = $state<MenuSectionRow[]>([]);

export const menuTree = {
  get current() {
    return menuTreeState;
  },
  set(value: MenuSectionRow[]) {
    menuTreeState = value;
  },
};

/** Resolves a real screen's own display label the exact, same, real
 * way its menu entry does — step 3 of docs/menu-as-entity-tree-plan.md,
 * §5 ("screen titles reading from the same source"). Renaming a menu
 * item in the real, new editor (step 4) then, correctly,
 * automatically also renames the report's own heading — one, real,
 * single edit, never two, separate places to keep in sync. */
export function screenTitle(href: string): string | undefined {
  for (const section of menuTreeState) {
    for (const link of section.links) {
      if (link.href.split('?')[0] === href) return link.label;
    }
  }
  return undefined;
}

// ===========================================================================
// Session — the real, currently active business/ledger/language.
// ===========================================================================
export interface SessionContext {
  businessId: number;
  businessName: BusinessName;
  ledgerId: number;
  ledgerName: LedgerName;
  languageId: number;
  languageName: string;
  // Per docs/profit-centers-design.md's Phase C: chosen the exact,
  // same real way Business already is — automatically, with no
  // visible choice, for an ordinary user restricted to one; a picker,
  // like Business/Ledger above, for staff with access to several.
  // Both undefined for every business with zero real Profit Centers
  // — the exact same, real case as before this feature existed.
  // Trust model only, honestly: nothing here is enforced yet (see the
  // design doc's own, direct finding that Business itself isn't
  // either) - any ordinary user can still pick any real Profit Center
  // shown, same as Business today.
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
    // A real, direct value read back from localStorage is always,
    // genuinely just a plain string at that boundary — the same real
    // reasoning as a database read or an API response, cast once here.
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

// ===========================================================================
// Translations — maps a vocabulary entity's canonical (English) name
// to its text in the currently selected language — e.g.
// translations.current['Save'] might be 'Speichern'. Falls back to
// the English name itself for anything not translated, same as the
// backend's localized_text view does; populated by the layout
// whenever the session's chosen language changes.
// ===========================================================================
let translationsState = $state<Record<string, string>>({});

export const translations = {
  get current() {
    return translationsState;
  },
  set(value: Record<string, string>) {
    translationsState = value;
  },
};
