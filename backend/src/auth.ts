import crypto from 'node:crypto';
import { db, ValidationError, NotFoundError, ensureProductInstance, getActiveLedger, type BusinessName, type LedgerName, type UserId } from './db.js';
import { Entity } from './primitives.js';
import { hashPassword, verifyPassword } from './password.js';

const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours

// Documented in docs/pm-domain-reference.md, "Auth/user functions",
// "Sessions", and "Access control: roles, Business Admin, and the
// per-business matrix" - this file carries no further multiline
// comments.

export { hashPassword, verifyPassword };

interface UserDetail {
  password_hash: string;
  active: number;
  page_size: number;
  number_format: string;
  date_format: string;
}

function getUserDetail(userId: number): UserDetail | undefined {
  const usersRoot = Entity.get('System Users');
  const row = Entity.get(userId);
  if (!row || !usersRoot || row.parent_id !== usersRoot.id) return undefined;
  const password_hash = Entity.getAttr(userId, 'Password Hash');
  const active = Entity.getAttr(userId, 'Active');
  const page_size = Entity.getAttr(userId, 'Page Size');
  const number_format = Entity.getAttr(userId, 'Number Format');
  const date_format = Entity.getAttr(userId, 'Date Format');
  if (password_hash === undefined || active === undefined || page_size === undefined || number_format === undefined || date_format === undefined) return undefined;
  return { password_hash, active: active === '1' ? 1 : 0, page_size: Number(page_size), number_format, date_format };
}

function setUserDetail(userId: number, detail: UserDetail): void {
  Entity.setAttr(userId, 'Password Hash', detail.password_hash, 1 as never);
  Entity.setAttr(userId, 'Active', detail.active ? '1' : '0', 1 as never);
  Entity.setAttr(userId, 'Page Size', String(detail.page_size), 1 as never);
  Entity.setAttr(userId, 'Number Format', detail.number_format, 1 as never);
  Entity.setAttr(userId, 'Date Format', detail.date_format, 1 as never);
}

function getUserRoleNames(userId: number): string[] {
  return Entity.children(userId)
    .filter((link) => link.relation_id !== null && Entity.hasTag(link.id, 'Role'))
    .map((link) => Entity.get(link.relation_id!)?.name)
    .filter((name): name is string => name !== undefined);
}

export interface UserSummary {
  id: number;
  username: string;
  active: boolean;
  roles: string[];
}

export function listUsers(): UserSummary[] {
  const usersRoot = Entity.get('System Users');
  const users = usersRoot
    ? Entity.children(usersRoot.id)
        .slice()
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    : [];
  return users.map((u) => ({ id: u.id, username: u.name, active: Entity.getAttr(u.id, 'Active') === '1', roles: getUserRoleNames(u.id) }));
}

export function listRoles(): { id: number; name: string }[] {
  const rolesRoot = Entity.get('System Roles');
  if (!rolesRoot) return [];
  return Entity.children(rolesRoot.id)
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((r) => ({ id: r.id, name: r.name }));
}

export function createUser(username: string, password: string, roleNames: string[]): UserSummary {
  const usersRoot = Entity.get('System Users')!;
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
    const row = Entity.get(name, 'System Roles');
    if (!row) throw new ValidationError(`No such role "${name}".`);
    return { id: row.id, name };
  });
  const existingLinks = Entity.children(userId).filter((link) => Entity.hasTag(link.id, 'Role'));
  for (const link of existingLinks) {
    const tagNode = Entity.getUnder('Role', link.id);
    if (tagNode) Entity.revoke(tagNode.id, 1 as never);
    Entity.revoke(link.id, 1 as never);
  }
  const userRow = Entity.get(userId)!;
  for (const role of roleIds) {
    const created = Entity.create(`${userRow.name} — Role — ${role.name}`, userId, 1 as never);
    Entity.relate(created.id, role.name, 1 as never);
    Entity.tag(created.id, 'Role', 1 as never);
  }
}

const USER_ROLE_SHAPE: [string, string][] = [
  ['User', 'User'],
  ['Role', 'Role'],
];

export interface UserRoleMatrix {
  users: string[];
  roles: string[];
  assignments: { user: string; role: string }[];
}

export function getUserRoleMatrix(businessName: BusinessName): UserRoleMatrix {
  const users = listUsers().map((u) => u.username);
  const roles = listRoles().map((r) => r.name);
  const business = Entity.get(businessName, 'Businesses');
  if (!business) throw new NotFoundError(`No such business "${businessName}".`);
  const productRoot = Entity.getUnder('Product', business.id);
  if (!productRoot) return { users, roles, assignments: [] };
  // combination_ids is one of the two standing-mandate-approved JSON
  // exceptions (along with detail_json) and stays SQL-only — explicitly
  // out of scope for the Kaappi/EntityDriver migration.
  const rows = db.prepare(`SELECT combination_ids FROM current_entities WHERE parent_id = ? AND combination_ids IS NOT NULL`).all(productRoot.id) as { combination_ids: string }[];
  const idToName = new Map<number, string>();
  for (const node of Entity.findAll({})) idToName.set(node.id, node.name);
  const assignments = rows
    .map((r) => (JSON.parse(r.combination_ids) as number[]).map((id) => idToName.get(id)!))
    .filter((pair): pair is [string, string] => pair.length === 2 && pair.every(Boolean))
    .map(([user, role]) => ({ user, role }));
  return { users, roles, assignments };
}

export function setUserRoleInBusiness(businessName: BusinessName, username: string, roleName: string, userId: UserId): void {
  if (!listUsers().some((u) => u.username === username)) throw new ValidationError(`No such user "${username}".`);
  if (!listRoles().some((r) => r.name === roleName)) throw new ValidationError(`No such role "${roleName}".`);
  ensureProductInstance(businessName, USER_ROLE_SHAPE, [username, roleName], userId);
}

export function unsetUserRoleInBusiness(businessName: BusinessName, username: string, roleName: string, userId: UserId): void {
  const business = Entity.get(businessName, 'Businesses');
  if (!business) return;
  const productRoot = Entity.getUnder('Product', business.id);
  if (!productRoot) return;
  const hierarchyRoot = Entity.getUnder('Hierarchy', business.id);
  if (!hierarchyRoot) return;
  const userGrouping = Entity.getUnder('User', hierarchyRoot.id);
  const roleGrouping = Entity.getUnder('Role', hierarchyRoot.id);
  if (!userGrouping || !roleGrouping) return;
  const userValue = Entity.getUnder(username, userGrouping.id);
  const roleValue = Entity.getUnder(roleName, roleGrouping.id);
  if (!userValue || !roleValue) return;
  // combination_ids is the approved JSON exception — stays SQL-only, out
  // of scope for the Kaappi/EntityDriver migration.
  const combinationIdsJson = JSON.stringify([userValue.id, roleValue.id]);
  const existing = db.prepare(`SELECT id FROM current_entities WHERE parent_id = ? AND combination_ids = ?`).get(productRoot.id, combinationIdsJson) as { id: number } | undefined;
  if (!existing) return;
  db.prepare(`INSERT INTO entity_set_combination_ids (entity_id, combination_ids) VALUES (?, ?)`).run(existing.id, null);
}

export const BUSINESS_ADMIN_ROLE = 'Business Admin';

export function userHasBusinessAdminRole(businessName: BusinessName, username: string): boolean {
  try {
    return getUserRoleMatrix(businessName).assignments.some((a) => a.user === username && a.role === BUSINESS_ADMIN_ROLE);
  } catch {
    return false;
  }
}

export function provisionBusinessAdminUser(businessName: BusinessName, createdBy: UserId): { username: string; password: string } {
  const username = `${businessName} Admin`;
  const password = crypto.randomBytes(24).toString('base64').replace(/[/+=]/g, '').slice(0, 16);
  createUser(username, password, []);
  setUserRoleInBusiness(businessName, username, BUSINESS_ADMIN_ROLE, createdBy);
  return { username, password };
}

export function canUserPostToLedger(business: BusinessName, ledger: LedgerName, user: { username: string; roles: string[] }): boolean {
  const active = getActiveLedger(business);
  if (!active || active === ledger) return true;
  if (user.roles.includes('Administrator') || user.roles.includes('Accountant')) return true;
  return userHasBusinessAdminRole(business, user.username);
}

export function setUserActive(userId: number, active: boolean): void {
  if (Entity.getAttr(userId, 'Active') === undefined) throw new NotFoundError(`User ${userId} not found.`);
  Entity.setAttr(userId, 'Active', active ? '1' : '0', 1 as never);
  if (!active) {
    const sessionsRoot = Entity.get('System Sessions');
    const sessions = sessionsRoot ? Entity.children(sessionsRoot.id).filter((s) => s.relation_id === userId) : [];
    for (const s of sessions) Entity.relate(s.id, null, 1 as never);
  }
}

export function changePassword(userId: number, newPassword: string): void {
  if (newPassword.length < 8) throw new ValidationError('Password must be at least 8 characters.');
  if (Entity.getAttr(userId, 'Password Hash') === undefined) throw new NotFoundError(`User ${userId} not found.`);
  Entity.setAttr(userId, 'Password Hash', hashPassword(newPassword), 1 as never);
}

export function changeOwnPassword(userId: number, currentPassword: string, newPassword: string): void {
  const passwordHash = Entity.getAttr(userId, 'Password Hash');
  if (passwordHash === undefined) throw new NotFoundError(`User ${userId} not found.`);
  if (!verifyPassword(currentPassword, passwordHash)) {
    throw new ValidationError('Current password is incorrect.');
  }
  changePassword(userId, newPassword);
}

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
  const userRow = Entity.get(username, 'System Users');
  const detail = userRow ? getUserDetail(userRow.id) : undefined;
  if (!userRow || !detail || !detail.active || !verifyPassword(password, detail.password_hash)) {
    throw new AuthError('Invalid username or password.');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS).toISOString();
  const sessionsRoot = Entity.get('System Sessions')!;
  const sessionEntity = Entity.create(`Session — ${token}`, sessionsRoot.id, 1 as never);
  Entity.relate(sessionEntity.id, username, 1 as never);
  Entity.setAttr(sessionEntity.id, 'Expires At', expiresAt, 1 as never);

  const roles = getUserRoleNames(userRow.id);

  return {
    token,
    user: { id: userRow.id, username: userRow.name, roles, page_size: detail.page_size, number_format: detail.number_format, date_format: detail.date_format },
  };
}

function findSessionByToken(token: string): { id: number; user_id: number; expires_at: string; business_name: string | null; profit_center_name: string | null } | undefined {
  const row = Entity.get(`Session — ${token}`, 'System Sessions');
  if (!row || row.relation_id === null) return undefined;
  const user_id = row.relation_id;
  const expires_at = Entity.getAttr(row.id, 'Expires At');
  if (expires_at === undefined) return undefined;
  const profitCenterName = Entity.getAttr(row.id, 'Profit Center Name');
  return { id: row.id, user_id, expires_at, business_name: Entity.getAttr(row.id, 'Business Name') ?? null, profit_center_name: profitCenterName ? profitCenterName : null };
}

export function logout(token: string): void {
  const session = findSessionByToken(token);
  if (session) Entity.relate(session.id, null, 1 as never);
}

export function setSessionBusiness(token: string, businessName: string): void {
  const session = findSessionByToken(token);
  if (!session) throw new AuthError('Session not found or expired.');
  Entity.setAttr(session.id, 'Business Name', businessName, 1 as never);
}

export function getSessionBusiness(token: string): string | null {
  const session = findSessionByToken(token);
  return session?.business_name ?? null;
}

export function setSessionProfitCenter(token: string, profitCenterName: string | null): void {
  const session = findSessionByToken(token);
  if (!session) throw new AuthError('Session not found or expired.');
  // An empty string is used as the "cleared" sentinel — real profit
  // center names are always non-empty — so this stays a plain scalar
  // Entity.setAttr fact with no JSON and no SQL UPDATE, same as every
  // other field here; a null value cannot be represented by renaming a
  // value-entity, since the entity must always have SOME name.
  Entity.setAttr(session.id, 'Profit Center Name', profitCenterName ?? '', 1 as never);
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
  const userRow = Entity.get(session.user_id)!;
  const roles = getUserRoleNames(session.user_id);
  return { id: session.user_id, username: userRow.name, roles, page_size: detail.page_size, number_format: detail.number_format, date_format: detail.date_format };
}

export function setOwnPageSize(userId: number, pageSize: number): void {
  if (!Number.isInteger(pageSize) || pageSize < 5 || pageSize > 200) {
    throw new ValidationError('Page size must be a whole number between 5 and 200.');
  }
  if (Entity.getAttr(userId, 'Page Size') === undefined) throw new NotFoundError(`User ${userId} not found.`);
  Entity.setAttr(userId, 'Page Size', String(pageSize), 1 as never);
}

const ALLOWED_NUMBER_FORMATS = ["1,000.00", '1 000.00', '1.000,00', '1000,00', '1000.00', "1'000.00"];
export function setOwnNumberFormat(userId: number, numberFormat: string): void {
  if (!ALLOWED_NUMBER_FORMATS.includes(numberFormat)) {
    throw new ValidationError(`Number format must be one of: ${ALLOWED_NUMBER_FORMATS.join(', ')}.`);
  }
  if (Entity.getAttr(userId, 'Number Format') === undefined) throw new NotFoundError(`User ${userId} not found.`);
  Entity.setAttr(userId, 'Number Format', numberFormat, 1 as never);
}

const ALLOWED_DATE_FORMATS = ['dd/mm/yyyy', 'mm/dd/yyyy', 'dd.mm.yyyy', 'dd-mm-yyyy', 'yyyy-mm-dd'];
export function setOwnDateFormat(userId: number, dateFormat: string): void {
  if (!ALLOWED_DATE_FORMATS.includes(dateFormat)) {
    throw new ValidationError(`Date format must be one of: ${ALLOWED_DATE_FORMATS.join(', ')}.`);
  }
  if (Entity.getAttr(userId, 'Date Format') === undefined) throw new NotFoundError(`User ${userId} not found.`);
  Entity.setAttr(userId, 'Date Format', dateFormat, 1 as never);
}
