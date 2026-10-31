// The terminal equivalent of frontend/src/lib/state.svelte.ts's own
// sessionStorage-backed auth state — a real Bearer token, persisted to
// a small, real, per-user file so a second run of this TUI doesn't
// force a fresh login every time, the same real convenience
// sessionStorage already gives the browser frontend within one tab.
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AuthUser {
  id: number;
  username: string;
  roles: string[];
  page_size: number;
  number_format: string;
  date_format: string;
}

export interface SessionState {
  token: string;
  user: AuthUser;
  businessName?: string;
  ledgerName?: string;
}

const SESSION_DIR = path.join(os.homedir(), '.sql-ledger-ts-tui');
const SESSION_FILE = path.join(SESSION_DIR, 'session.json');

export function loadSession(): SessionState | null {
  try {
    const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
    return JSON.parse(raw) as SessionState;
  } catch {
    return null;
  }
}

export function saveSession(state: SessionState | null): void {
  try {
    if (state === null) {
      fs.rmSync(SESSION_FILE, { force: true });
      return;
    }
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    fs.writeFileSync(SESSION_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
  } catch {
    // Non-fatal — a real, failed write just means the next run asks to
    // log in again, never a reason to crash the one currently running.
  }
}
