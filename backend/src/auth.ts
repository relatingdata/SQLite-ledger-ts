import crypto from 'node:crypto';
import { db, ValidationError, NotFoundError } from './db.js';
import { hashPassword, verifyPassword } from './password.js';

const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// Password hashing — see password.ts (shared with self-registered
// customer accounts in db.ts, to avoid a circular import).
// ---------------------------------------------------------------------------

export { hashPassword, verifyPassword };

// ---------------------------------------------------------------------------
// Users and roles
// ---------------------------------------------------------------------------

export interface UserSummary {
  id: number;
  username: string;
  active: boolean;
  roles: string[];
}

export function listUsers(): UserSummary[] {
  const users = db.prepare(`SELECT id, username, active FROM users ORDER BY username`).all() as {
    id: number;
    username: string;
    active: number;
  }[];
  return users.map((u) => ({
    id: u.id,
    username: u.username,
    active: !!u.active,
    roles: (db
      .prepare(`SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ?`)
      .all(u.id) as { name: string }[]).map((r) => r.name),
  }));
}

export function listRoles(): { id: number; name: string }[] {
  return db.prepare(`SELECT id, name FROM roles ORDER BY id`).all() as { id: number; name: string }[];
}

export function createUser(username: string, password: string, roleNames: string[]): UserSummary {
  const existing = db.prepare(`SELECT id FROM users WHERE username = ?`).get(username);
  if (existing) throw new ValidationError(`A user named "${username}" already exists.`);
  if (password.length < 8) throw new ValidationError('Password must be at least 8 characters.');

  const info = db.prepare(`INSERT INTO users (username, password_hash) VALUES (?, ?)`).run(username, hashPassword(password));
  const userId = Number(info.lastInsertRowid);
  setUserRoles(userId, roleNames);
  return listUsers().find((u) => u.id === userId)!;
}

export function setUserRoles(userId: number, roleNames: string[]): void {
  const roleIds = roleNames.map((name) => {
    const row = db.prepare(`SELECT id FROM roles WHERE name = ?`).get(name) as { id: number } | undefined;
    if (!row) throw new ValidationError(`No such role "${name}".`);
    return row.id;
  });
  db.prepare(`DELETE FROM user_roles WHERE user_id = ?`).run(userId);
  const insert = db.prepare(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`);
  for (const roleId of roleIds) insert.run(userId, roleId);
}

export function setUserActive(userId: number, active: boolean): void {
  const result = db.prepare(`UPDATE users SET active = ? WHERE id = ?`).run(active ? 1 : 0, userId);
  if (result.changes === 0) throw new NotFoundError(`User ${userId} not found.`);
  if (!active) {
    // Deactivating a user should also kill any session they're currently using.
    db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
  }
}

export function changePassword(userId: number, newPassword: string): void {
  if (newPassword.length < 8) throw new ValidationError('Password must be at least 8 characters.');
  const result = db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hashPassword(newPassword), userId);
  if (result.changes === 0) throw new NotFoundError(`User ${userId} not found.`);
}

/** Self-service password change — unlike changePassword (Administrator
 * resetting someone else's, no verification needed since an admin
 * already has that authority), this requires proving you know the
 * CURRENT password first. Without that check, anyone who got hold of
 * a logged-in session (a shared computer, a stolen token) could lock
 * the real owner out permanently just by knowing they were signed in —
 * a real, meaningful difference from the admin path, not a redundant
 * extra step. */
export function changeOwnPassword(userId: number, currentPassword: string, newPassword: string): void {
  const user = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(userId) as { password_hash: string } | undefined;
  if (!user) throw new NotFoundError(`User ${userId} not found.`);
  if (!verifyPassword(currentPassword, user.password_hash)) {
    throw new ValidationError('Current password is incorrect.');
  }
  changePassword(userId, newPassword);
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export interface AuthenticatedUser {
  id: number;
  username: string;
  roles: string[];
  /** How many rows this user sees per page on any paginated list —
   * their own preference, defaulting to 20. */
  page_size: number;
  /** Explicit, fixed-choice display patterns — never inferred from a
   * locale code, which real ICU data can get wrong for a business's
   * actual convention (e.g. en-AU using commas, not the space this
   * business wants). See schema.sql for the exact allowed values. */
  number_format: string;
  date_format: string;
}

export class AuthError extends Error {}

export function login(username: string, password: string): { token: string; user: AuthenticatedUser } {
  const row = db.prepare(`SELECT id, username, password_hash, active, page_size, number_format, date_format FROM users WHERE username = ?`).get(username) as
    | { id: number; username: string; password_hash: string; active: number; page_size: number; number_format: string; date_format: string }
    | undefined;
  if (!row || !row.active || !verifyPassword(password, row.password_hash)) {
    // Deliberately the same error for "no such user" and "wrong password" —
    // distinguishing them would tell an attacker which usernames exist.
    throw new AuthError('Invalid username or password.');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS).toISOString();
  db.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`).run(token, row.id, expiresAt);

  const roles = (db
    .prepare(`SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ?`)
    .all(row.id) as { name: string }[]).map((r) => r.name);

  return {
    token,
    user: { id: row.id, username: row.username, roles, page_size: row.page_size, number_format: row.number_format, date_format: row.date_format },
  };
}

export function logout(token: string): void {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

/** Returns the authenticated user for a session token, or null if the
 * token is missing, expired, or belongs to a now-deactivated user —
 * every one of those should behave identically to "not logged in" from
 * the caller's point of view. */
export function getSessionUser(token: string | undefined): AuthenticatedUser | null {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.active, u.page_size, u.number_format, u.date_format, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token) as
    | { id: number; username: string; active: number; page_size: number; number_format: string; date_format: string; expires_at: string }
    | undefined;
  if (!row) return null;
  if (!row.active) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
    return null;
  }
  const roles = (db
    .prepare(`SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ?`)
    .all(row.id) as { name: string }[]).map((r) => r.name);
  return { id: row.id, username: row.username, roles, page_size: row.page_size, number_format: row.number_format, date_format: row.date_format };
}

/** A user changing their own display preference — deliberately
 * separate from setUserRoles/setUserActive, which are administrative
 * actions on someone else's account, not a personal preference. */
export function setOwnPageSize(userId: number, pageSize: number): void {
  if (!Number.isInteger(pageSize) || pageSize < 5 || pageSize > 200) {
    throw new ValidationError('Page size must be a whole number between 5 and 200.');
  }
  db.prepare(`UPDATE users SET page_size = ? WHERE id = ?`).run(pageSize, userId);
}

const ALLOWED_NUMBER_FORMATS = ["1,000.00", '1 000.00', '1.000,00', '1000,00', '1000.00', "1'000.00"];
export function setOwnNumberFormat(userId: number, numberFormat: string): void {
  if (!ALLOWED_NUMBER_FORMATS.includes(numberFormat)) {
    throw new ValidationError(`Number format must be one of: ${ALLOWED_NUMBER_FORMATS.join(', ')}.`);
  }
  db.prepare(`UPDATE users SET number_format = ? WHERE id = ?`).run(numberFormat, userId);
}

const ALLOWED_DATE_FORMATS = ['dd/mm/yyyy', 'mm/dd/yyyy', 'dd.mm.yyyy', 'dd-mm-yyyy', 'yyyy-mm-dd'];
export function setOwnDateFormat(userId: number, dateFormat: string): void {
  if (!ALLOWED_DATE_FORMATS.includes(dateFormat)) {
    throw new ValidationError(`Date format must be one of: ${ALLOWED_DATE_FORMATS.join(', ')}.`);
  }
  db.prepare(`UPDATE users SET date_format = ? WHERE id = ?`).run(dateFormat, userId);
}
