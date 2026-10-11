import crypto from 'node:crypto';
import { db, ValidationError, NotFoundError, supersedeEntity } from './db.js';
import { Entity } from './primitives.js';
import { hashPassword, verifyPassword } from './password.js';

const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// Password hashing — see password.ts (shared with self-registered
// customer accounts in db.ts, to avoid a circular import).
// ---------------------------------------------------------------------------

export { hashPassword, verifyPassword };

// ---------------------------------------------------------------------------
// Users and roles — real, plain entities under "Users"/"Roles", per
// direct, absolute instruction (no permanent tables beyond the real
// four). A user's own detail (password_hash, active, page_size,
// number_format, date_format) lives in that entity's own, real
// detail_json. Each granted role is a real, direct child entity under
// the user itself, relation_id pointing at the real role - the same,
// real, proven pattern already used for vocabulary_preference.
// ---------------------------------------------------------------------------

interface UserDetail {
  password_hash: string;
  active: number;
  page_size: number;
  number_format: string;
  date_format: string;
}

function getUserDetail(userId: number): UserDetail | undefined {
  const row = db.prepare(`SELECT detail_json FROM current_entities WHERE id = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'System Users')`).get(userId) as { detail_json: string } | undefined;
  return row ? JSON.parse(row.detail_json) : undefined;
}

function setUserDetail(userId: number, detail: UserDetail): void {
  Entity.setDetailJson(userId, JSON.stringify(detail));
}

function getUserRoleNames(userId: number): string[] {
  return (
    db
      .prepare(`SELECT role.name FROM current_entities link JOIN current_entities role ON role.id = link.relation_id JOIN current_entities tag ON tag.parent_id = link.id AND tag.name = 'Role' AND tag.relation_id IS NOT NULL WHERE link.parent_id = ?`)
      .all(userId) as { name: string }[]
  ).map((r) => r.name);
}

export interface UserSummary {
  id: number;
  username: string;
  active: boolean;
  roles: string[];
}

export function listUsers(): UserSummary[] {
  const users = db
    .prepare(`SELECT id, name AS username, detail_json FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'System Users') ORDER BY name`)
    .all() as { id: number; username: string; detail_json: string }[];
  return users.map((u) => {
    const detail: UserDetail = JSON.parse(u.detail_json);
    return { id: u.id, username: u.username, active: !!detail.active, roles: getUserRoleNames(u.id) };
  });
}

export function listRoles(): { id: number; name: string }[] {
  return db
    .prepare(`SELECT id, name FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'System Roles') ORDER BY id`)
    .all() as { id: number; name: string }[];
}

export function createUser(username: string, password: string, roleNames: string[]): UserSummary {
  const usersRoot = db.prepare(`SELECT id FROM current_entities WHERE name = 'System Users'`).get() as { id: number };
  const existing = Entity.getUnder(username, usersRoot.id);
  if (existing) throw new ValidationError(`A user named "${username}" already exists.`);
  if (password.length < 8) throw new ValidationError('Password must be at least 8 characters.');

  const created = Entity.create(username, usersRoot.id, 1 as never);
  const detail: UserDetail = { password_hash: hashPassword(password), active: 1, page_size: 20, number_format: '1 000.00', date_format: 'dd/mm/yyyy' };
  setUserDetail(created.id, detail);
  setUserRoles(created.id, roleNames);
  return listUsers().find((u) => u.id === created.id)!;
}

export function setUserRoles(userId: number, roleNames: string[]): void {
  const roleIds = roleNames.map((name) => {
    const row = db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'System Roles')`).get(name) as { id: number } | undefined;
    if (!row) throw new ValidationError(`No such role "${name}".`);
    return { id: row.id, name };
  });
  const existingLinks = db.prepare(`SELECT link.id FROM current_entities link JOIN current_entities tag ON tag.parent_id = link.id AND tag.name = 'Role' AND tag.relation_id IS NOT NULL WHERE link.parent_id = ?`).all(userId) as { id: number }[];
  for (const link of existingLinks) Entity.untag(link.id, 'Role', 1 as never);
  const userRow = db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(userId) as { name: string };
  for (const role of roleIds) {
    const created = Entity.create(`${userRow.name} — Role — ${role.name}`, userId, 1 as never);
    supersedeEntity(created.id, { relation: role.name }, 1 as never);
    Entity.tag(created.id, 'Role', 1 as never);
  }
}

export function setUserActive(userId: number, active: boolean): void {
  const detail = getUserDetail(userId);
  if (!detail) throw new NotFoundError(`User ${userId} not found.`);
  detail.active = active ? 1 : 0;
  setUserDetail(userId, detail);
  if (!active) {
    const sessions = db.prepare(`SELECT id FROM current_entities WHERE relation_id = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'System Sessions')`).all(userId) as { id: number }[];
    for (const s of sessions) Entity.relate(s.id, null, 1 as never);
  }
}

export function changePassword(userId: number, newPassword: string): void {
  if (newPassword.length < 8) throw new ValidationError('Password must be at least 8 characters.');
  const detail = getUserDetail(userId);
  if (!detail) throw new NotFoundError(`User ${userId} not found.`);
  detail.password_hash = hashPassword(newPassword);
  setUserDetail(userId, detail);
}

export function changeOwnPassword(userId: number, currentPassword: string, newPassword: string): void {
  const detail = getUserDetail(userId);
  if (!detail) throw new NotFoundError(`User ${userId} not found.`);
  if (!verifyPassword(currentPassword, detail.password_hash)) {
    throw new ValidationError('Current password is incorrect.');
  }
  changePassword(userId, newPassword);
}

// ---------------------------------------------------------------------------
// Sessions — real, plain entities under "Sessions", named by their own
// real token, relation_id pointing at the real user, detail_json
// holding expires_at.
// ---------------------------------------------------------------------------

export interface AuthenticatedUser {
  id: number;
  username: string;
  roles: string[];
  page_size: number;
  number_format: string;
  date_format: string;
}

export class AuthError extends Error {}

export function login(username: string, password: string): { token: string; user: AuthenticatedUser } {
  const usersRoot = db.prepare(`SELECT id FROM current_entities WHERE name = 'System Users'`).get() as { id: number } | undefined;
  const userRow = usersRoot ? (db.prepare(`SELECT id, name FROM current_entities WHERE name = ? AND parent_id = ?`).get(username, usersRoot.id) as { id: number; name: string } | undefined) : undefined;
  const detail = userRow ? getUserDetail(userRow.id) : undefined;
  if (!userRow || !detail || !detail.active || !verifyPassword(password, detail.password_hash)) {
    throw new AuthError('Invalid username or password.');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS).toISOString();
  const sessionsRoot = db.prepare(`SELECT id FROM current_entities WHERE name = 'System Sessions'`).get() as { id: number };
  const sessionEntity = Entity.create(`Session — ${token}`, sessionsRoot.id, 1 as never);
  supersedeEntity(sessionEntity.id, { relation: username }, 1 as never);
  Entity.setDetailJson(sessionEntity.id, JSON.stringify({ expires_at: expiresAt }));

  const roles = getUserRoleNames(userRow.id);

  return {
    token,
    user: { id: userRow.id, username: userRow.name, roles, page_size: detail.page_size, number_format: detail.number_format, date_format: detail.date_format },
  };
}

function findSessionByToken(token: string): { id: number; user_id: number; expires_at: string; business_name: string | null; profit_center_name: string | null } | undefined {
  const row = db
    .prepare(`SELECT id, relation_id AS user_id, detail_json FROM current_entities WHERE name = ? AND relation_id IS NOT NULL AND parent_id = (SELECT id FROM current_entities WHERE name = 'System Sessions')`)
    .get(`Session — ${token}`) as { id: number; user_id: number; detail_json: string } | undefined;
  if (!row) return undefined;
  const detail = JSON.parse(row.detail_json);
  return { id: row.id, user_id: row.user_id, expires_at: detail.expires_at, business_name: detail.business_name ?? null, profit_center_name: detail.profit_center_name ?? null };
}

export function logout(token: string): void {
  const session = findSessionByToken(token);
  if (session) Entity.relate(session.id, null, 1 as never);
}

/** Sets this one, real, connected session's own current business - the
 * real, global business context for every further real request this
 * same session makes, until changed again or the session ends. Also
 * updates the real, currently-running request's own, live context
 * (see session-context.ts), so a person switching business mid-way
 * through their own real session sees it take effect immediately, not
 * just on their real, next request. */
export function setSessionBusiness(token: string, businessName: string): void {
  const session = findSessionByToken(token);
  if (!session) throw new AuthError('Session not found or expired.');
  const row = db.prepare(`SELECT detail_json FROM current_entities WHERE id = ?`).get(session.id) as { detail_json: string };
  const detail = JSON.parse(row.detail_json);
  detail.business_name = businessName;
  Entity.setDetailJson(session.id, JSON.stringify(detail));
}

export function getSessionBusiness(token: string): string | null {
  const session = findSessionByToken(token);
  return session?.business_name ?? null;
}

/** Per docs/profit-centers-design.md's Phase C: the exact, same real
 * mechanism as setSessionBusiness/getSessionBusiness above, for the
 * real, current Profit Center instead — a third, independent field
 * alongside business_name on the one, same session record. Trust-
 * model only, honestly: per the design doc's own, direct finding,
 * there is no real, per-user restriction on which businesses a person
 * may pick either, so a Profit Center picker gets the exact, same
 * real, temporary gap today's business picker already has, not a
 * regression introduced here. Setting it to a business a person
 * cannot actually use yet goes entirely unchecked - same as business
 * itself, today. */
export function setSessionProfitCenter(token: string, profitCenterName: string | null): void {
  const session = findSessionByToken(token);
  if (!session) throw new AuthError('Session not found or expired.');
  const row = db.prepare(`SELECT detail_json FROM current_entities WHERE id = ?`).get(session.id) as { detail_json: string };
  const detail = JSON.parse(row.detail_json);
  detail.profit_center_name = profitCenterName;
  Entity.setDetailJson(session.id, JSON.stringify(detail));
}

export function getSessionProfitCenter(token: string): string | null {
  const session = findSessionByToken(token);
  return session?.profit_center_name ?? null;
}

export function getSessionUser(token: string | undefined): AuthenticatedUser | null {
  if (!token) return null;
  const session = findSessionByToken(token);
  if (!session) return null;
  const detail = getUserDetail(session.user_id);
  if (!detail) return null;
  if (!detail.active) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    Entity.relate(session.id, null, 1 as never);
    return null;
  }
  const userRow = db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(session.user_id) as { name: string };
  const roles = getUserRoleNames(session.user_id);
  return { id: session.user_id, username: userRow.name, roles, page_size: detail.page_size, number_format: detail.number_format, date_format: detail.date_format };
}

export function setOwnPageSize(userId: number, pageSize: number): void {
  if (!Number.isInteger(pageSize) || pageSize < 5 || pageSize > 200) {
    throw new ValidationError('Page size must be a whole number between 5 and 200.');
  }
  const detail = getUserDetail(userId);
  if (!detail) throw new NotFoundError(`User ${userId} not found.`);
  detail.page_size = pageSize;
  setUserDetail(userId, detail);
}

const ALLOWED_NUMBER_FORMATS = ["1,000.00", '1 000.00', '1.000,00', '1000,00', '1000.00', "1'000.00"];
export function setOwnNumberFormat(userId: number, numberFormat: string): void {
  if (!ALLOWED_NUMBER_FORMATS.includes(numberFormat)) {
    throw new ValidationError(`Number format must be one of: ${ALLOWED_NUMBER_FORMATS.join(', ')}.`);
  }
  const detail = getUserDetail(userId);
  if (!detail) throw new NotFoundError(`User ${userId} not found.`);
  detail.number_format = numberFormat;
  setUserDetail(userId, detail);
}

const ALLOWED_DATE_FORMATS = ['dd/mm/yyyy', 'mm/dd/yyyy', 'dd.mm.yyyy', 'dd-mm-yyyy', 'yyyy-mm-dd'];
export function setOwnDateFormat(userId: number, dateFormat: string): void {
  if (!ALLOWED_DATE_FORMATS.includes(dateFormat)) {
    throw new ValidationError(`Date format must be one of: ${ALLOWED_DATE_FORMATS.join(', ')}.`);
  }
  const detail = getUserDetail(userId);
  if (!detail) throw new NotFoundError(`User ${userId} not found.`);
  detail.date_format = dateFormat;
  setUserDetail(userId, detail);
}
