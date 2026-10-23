import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface AuthUser {
  id: number;
  username: string;
  roles: string[];
  // Superseded by state.svelte.ts — see docs/pm-frontend-reference.md.
  page_size: number;
  number_format: string;
  date_format: string;
}

export interface AuthState {
  token: string;
  user: AuthUser;
}

const STORAGE_KEY = 'sql-ledger-ts-auth';

// sessionStorage, not localStorage — see docs/pm-frontend-reference.md.
function loadStored(): AuthState | null {
  if (!browser) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthState) : null;
  } catch {
    return null;
  }
}

function createAuthStore() {
  const { subscribe, set } = writable<AuthState | null>(loadStored());
  return {
    subscribe,
    set(state: AuthState) {
      if (browser) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      set(state);
    },
    clear() {
      if (browser) sessionStorage.removeItem(STORAGE_KEY);
      set(null);
    },
  };
}

export const auth = createAuthStore();

// UNUSED (checkpoint 426): no references found anywhere. Commented out, not deleted. See docs/unused-functions.md
// export function hasRole(state: AuthState | null, ...roles: string[]): boolean {
//   if (!state) return false;
//   return state.user.roles.some((r) => roles.includes(r));
// }
