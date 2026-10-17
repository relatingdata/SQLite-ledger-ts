import crypto from 'node:crypto';
import { db, ValidationError, NotFoundError, supersedeEntity, revokeEntity, ensureProductInstance, getActiveLedger, type BusinessName, type LedgerName, type UserId } from './db.js';
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
  // Untagging alone (the old behavior) only cleared the 'Role' tag's
  // own relation_id — the link entity itself (e.g. "multirole1 — Role
  // — Bookkeeper") stayed alive under the user, so re-granting the
  // same role name later collided with it under entities_name_unique
  // (confirmed directly: "setUserRoles changes what a session created
  // afterward reflects", backend/test/auth.test.ts, and reproduced via
  // the Tutorial e2e API path in shared-fixtures/tutorial-steps.csv).
  // The real fix: revoke the whole link, not just its tag — the tag
  // child must be revoked first (revokeEntity refuses to revoke an
  // entity that still has children), which also moves it out from
  // under the link via revokeEntity's own "Revoked" reparent (db.ts),
  // so the link itself is then a true, childless leaf and can be
  // revoked too, freeing the (userId, name) slot for a fresh grant.
  for (const link of existingLinks) {
    const tagNode = Entity.getUnder('Role', link.id);
    if (tagNode) revokeEntity(tagNode.id, 1 as never);
    revokeEntity(link.id, 1 as never);
  }
  const userRow = db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(userId) as { name: string };
  for (const role of roleIds) {
    const created = Entity.create(`${userRow.name} — Role — ${role.name}`, userId, 1 as never);
    supersedeEntity(created.id, { relation: role.name }, 1 as never);
    Entity.tag(created.id, 'Role', 1 as never);
  }
}

// ---------------------------------------------------------------------------
// Per-business user roles — see docs/user-business-role-matrix-design.md.
// A real, genuine Cartesian Product (User × Role, scoped per Business),
// built on the exact, same, already-proven `defineProductShape`/
// `ensureProductInstance` mechanism used for Container × Unit size and
// Currency Exchange pairs — never a new, bespoke relationship or
// table. Additive, Phase 1 only: this records the real, per-business
// role fact and makes it editable; it does not change what any
// route's own `requireRole` enforces today — that stays the real,
// existing, global role from `setUserRoles` above, untouched.
// ---------------------------------------------------------------------------

const USER_ROLE_SHAPE: [string, string][] = [
  ['User', 'User'],
  ['Role', 'Role'],
];

export interface UserRoleMatrix {
  users: string[];
  roles: string[];
  /** Every real, currently-set cell — this user genuinely holds this
   * role, in this one, specific business. */
  assignments: { user: string; role: string }[];
}

/** The real, full User × Role matrix for one real business — every
 * row (every real system user) × every column (every real system
 * role), and which cells are currently set. Scoped the same, direct
 * way every other business-taking function in this codebase already
 * is — never a bare, unscoped read. */
export function getUserRoleMatrix(businessName: BusinessName): UserRoleMatrix {
  const users = listUsers().map((u) => u.username);
  const roles = listRoles().map((r) => r.name);
  const business = db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')`).get(businessName) as { id: number } | undefined;
  if (!business) throw new NotFoundError(`No such business "${businessName}".`);
  const productRoot = db.prepare(`SELECT id FROM current_entities WHERE name = 'Product' AND parent_id = ?`).get(business.id) as { id: number } | undefined;
  if (!productRoot) return { users, roles, assignments: [] };
  const rows = db.prepare(`SELECT combination_ids FROM current_entities WHERE parent_id = ? AND combination_ids IS NOT NULL`).all(productRoot.id) as { combination_ids: string }[];
  const idToName = new Map<number, string>();
  for (const row of db.prepare(`SELECT id, name FROM current_entities`).all() as { id: number; name: string }[]) idToName.set(row.id, row.name);
  const assignments = rows
    .map((r) => (JSON.parse(r.combination_ids) as number[]).map((id) => idToName.get(id)!))
    .filter((pair): pair is [string, string] => pair.length === 2 && pair.every(Boolean))
    .map(([user, role]) => ({ user, role }));
  return { users, roles, assignments };
}

/** Sets one real cell of the matrix: this user genuinely holds this
 * role, in this one, specific business. Idempotent — setting an
 * already-set cell is a real, harmless no-op, the same, established
 * `ensureProductInstance` semantics every other Cartesian Product in
 * this codebase already has. */
export function setUserRoleInBusiness(businessName: BusinessName, username: string, roleName: string, userId: UserId): void {
  if (!listUsers().some((u) => u.username === username)) throw new ValidationError(`No such user "${username}".`);
  if (!listRoles().some((r) => r.name === roleName)) throw new ValidationError(`No such role "${roleName}".`);
  ensureProductInstance(businessName, USER_ROLE_SHAPE, [username, roleName], userId);
}

/** Clears one real cell of the matrix — the real, direct inverse of
 * setUserRoleInBusiness, via the exact, same `revokeEntity` every
 * other reversible assignment in this codebase already uses. A cell
 * that was never set is a real, harmless no-op. */
export function unsetUserRoleInBusiness(businessName: BusinessName, username: string, roleName: string, userId: UserId): void {
  const business = db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')`).get(businessName) as { id: number } | undefined;
  if (!business) return;
  const productRoot = db.prepare(`SELECT id FROM current_entities WHERE name = 'Product' AND parent_id = ?`).get(business.id) as { id: number } | undefined;
  if (!productRoot) return;
  // combination_ids on a real Product Instance points at this real
  // business's own real Hierarchy *value* nodes (see
  // ensureProductInstance/ensureHierarchyValue, db.ts) - never the
  // global System Users/System Roles entities directly, even though
  // they share the identical, real display name. Resolved the exact,
  // same, real path ensureHierarchyValue itself walks.
  const hierarchyRoot = db.prepare(`SELECT id FROM current_entities WHERE name = 'Hierarchy' AND parent_id = ?`).get(business.id) as { id: number } | undefined;
  if (!hierarchyRoot) return;
  const userGrouping = db.prepare(`SELECT id FROM current_entities WHERE name = 'User' AND parent_id = ?`).get(hierarchyRoot.id) as { id: number } | undefined;
  const roleGrouping = db.prepare(`SELECT id FROM current_entities WHERE name = 'Role' AND parent_id = ?`).get(hierarchyRoot.id) as { id: number } | undefined;
  if (!userGrouping || !roleGrouping) return;
  const userValue = db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(username, userGrouping.id) as { id: number } | undefined;
  const roleValue = db.prepare(`SELECT id FROM current_entities WHERE name = ? AND parent_id = ?`).get(roleName, roleGrouping.id) as { id: number } | undefined;
  if (!userValue || !roleValue) return;
  const combinationIdsJson = JSON.stringify([userValue.id, roleValue.id]);
  const existing = db.prepare(`SELECT id FROM current_entities WHERE parent_id = ? AND combination_ids = ?`).get(productRoot.id, combinationIdsJson) as { id: number } | undefined;
  if (!existing) return;
  // A real, confirmed finding made while building this: `revokeEntity`
  // (db.ts) does NOT remove an entity from current_entities at all —
  // per its own real design (`docs/entity-model.md`'s append-only
  // history), it only ever supersedes relation_id to NULL, which a
  // Product Instance's own real identity (combination_ids) never
  // used in the first place, so the cell would have stayed visible
  // forever. The real, correct way to clear one real cell here is to
  // supersede combination_ids itself to NULL, via the exact, same
  // `entity_set_combination_ids` mechanism `ensureProductInstance`
  // uses to set it - this cell's own entity row still exists,
  // historically, exactly as this codebase's append-only design
  // requires, but no longer matches any real combination_ids lookup,
  // so getUserRoleMatrix (which filters on `combination_ids IS NOT
  // NULL`) correctly stops listing it.
  db.prepare(`INSERT INTO entity_set_combination_ids (entity_id, combination_ids) VALUES (?, ?)`).run(existing.id, null);
}

// ---------------------------------------------------------------------------
// Business Admin — a real, fifth global role (00-core.sql), granted
// per business through the matrix above, never globally. See
// docs/business-admin-role-and-enforcement-design.md for the full
// design; this is the real mechanism requireRole (auth-middleware.ts)
// and the per-business provisioning below (called from
// routes/businesses.ts, never from createBusiness in db.ts itself —
// db.ts cannot import this file without a real, genuine circular
// import, since this file already imports from db.ts) both depend on.
// ---------------------------------------------------------------------------

export const BUSINESS_ADMIN_ROLE = 'Business Admin';

/** Whether this user genuinely holds the Business Admin role in this
 * one, specific business — the real check requireRole's fallback
 * uses. Never throws: a business name that no longer resolves (a
 * stale session) or has no Product root yet (no business-role has
 * ever been assigned there) both mean, correctly, "no". */
export function userHasBusinessAdminRole(businessName: BusinessName, username: string): boolean {
  try {
    return getUserRoleMatrix(businessName).assignments.some((a) => a.user === username && a.role === BUSINESS_ADMIN_ROLE);
  } catch {
    return false;
  }
}

/** Creates the one, real, dedicated admin user a brand-new business
 * gets, per direct instruction — holding Business Admin in this one
 * business only (never any global role), so it has full, real access
 * within this business without being able to create another one, or
 * touch any other business's own data. Username is business-prefixed
 * (user names are global, under the one, real "System Users" root,
 * unlike the per-business Items/Locations/... roots), and the
 * generated password is returned once, in plain text, the same real,
 * show-once way the business-creation screen must display it — it is
 * never otherwise recoverable, since only its hash is ever stored. */
export function provisionBusinessAdminUser(businessName: BusinessName, createdBy: UserId): { username: string; password: string } {
  const username = `${businessName} Admin`;
  const password = crypto.randomBytes(24).toString('base64').replace(/[/+=]/g, '').slice(0, 16);
  createUser(username, password, []);
  setUserRoleInBusiness(businessName, username, BUSINESS_ADMIN_ROLE, createdBy);
  return { username, password };
}

// ---------------------------------------------------------------------------
// The active ledger, and who may post past it — see
// docs/active-ledger-design.md. Deliberately NOT a hard lock: the
// old ledger stays genuinely postable forever, for real corrections/
// adjustments (docs/ledger-scoped-accounts-and-rollover.md), only
// restricted to a smaller, real set of roles once it is no longer
// the business's own, current, active one.
// ---------------------------------------------------------------------------

/** Whether this user may post into this specific ledger, for this
 * specific business — true unconditionally when it IS the business's
 * own, real, current active ledger (ordinary trading, untouched by
 * any of this), or when this business has no real active-ledger
 * pointer yet (a business created before this concept existed).
 * Otherwise (a real posting into an already-rolled-over, non-active
 * ledger — a genuine correction/adjustment), requires the user to
 * hold Administrator or Accountant globally, or Business Admin in
 * this one, specific business (the matrix) — exactly the same three,
 * real roles `requireRole`'s own fallback already treats as "full
 * access within this business" elsewhere. */
export function canUserPostToLedger(business: BusinessName, ledger: LedgerName, user: { username: string; roles: string[] }): boolean {
  const active = getActiveLedger(business);
  if (!active || active === ledger) return true;
  if (user.roles.includes('Administrator') || user.roles.includes('Accountant')) return true;
  return userHasBusinessAdminRole(business, user.username);
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
