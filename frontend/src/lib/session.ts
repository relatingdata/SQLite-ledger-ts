import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { asBusinessName, asLedgerName, type BusinessName, type LedgerName } from './api';

export interface SessionContext {
  businessId: number;
  businessName: BusinessName;
  ledgerId: number;
  ledgerName: LedgerName;
  languageId: number;
  languageName: string;
}

const STORAGE_KEY = 'sql-ledger-ts-session';

function loadStored(): SessionContext | null {
  if (!browser) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionContext;
    // Superseded by state.svelte.ts — see docs/pm-frontend-reference.md.
    return { ...parsed, businessName: asBusinessName(parsed.businessName), ledgerName: asLedgerName(parsed.ledgerName) };
  } catch {
    return null;
  }
}

function createSessionStore() {
  const { subscribe, set } = writable<SessionContext | null>(loadStored());

  return {
    subscribe,
    set(context: SessionContext) {
      if (browser) localStorage.setItem(STORAGE_KEY, JSON.stringify(context));
      set(context);
    },
    clear() {
      if (browser) localStorage.removeItem(STORAGE_KEY);
      set(null);
    },
  };
}

export const session = createSessionStore();
