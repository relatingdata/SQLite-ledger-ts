// Converted from routes/auth.ts. login itself stays genuinely public (no
// requireAuth call at all, same as the old route) - every other function
// gates itself exactly as the old route did, most via requireAuth alone,
// "Everything below is Administrator-only user management" via
// requireGlobalRole('Administrator'). logout/setSessionBusiness/
// setSessionProfitCenter are the one real reason this rollout needed a
// new, 4th BackendCall parameter (token): they end or mutate the CURRENT
// session by its own raw bearer token, not by user id - call-dispatch.ts
// now threads that token through from routes/call.ts for exactly these
// three functions; every other function here simply never reads it.
import {
  login,
  logout,
  listUsers,
  listRoles,
  createUser,
  setUserRoles,
  setUserActive,
  changePassword,
  changeOwnPassword,
  setOwnPageSize,
  setOwnNumberFormat,
  setOwnDateFormat,
  setSessionBusiness,
  setSessionProfitCenter,
  getUserRoleMatrix,
  setUserRoleInBusiness,
  unsetUserRoleInBusiness,
  AuthError,
} from '../auth.js';
import { ValidationError, NotFoundError, asUserId, asBusinessName } from '../db.js';
import { CallError, encodeRecordList, encodeStringList, decodeStringList, requireAuth, requireGlobalRole, row, table, type BackendCall } from '../call-dispatch.js';

export const authFunctions: Record<string, BackendCall> = {
  login: (v) => {
    const [username, password] = v;
    if (!username || !password) throw new CallError(400, 'username and password are both required.');
    try {
      const { token, user } = login(username, password);
      return row(token, String(user.id), user.username, encodeStringList(user.roles), String(user.page_size), user.number_format, user.date_format);
    } catch (err) {
      if (err instanceof AuthError) throw new CallError(401, err.message);
      console.error(err);
      throw new CallError(500, 'Could not log in.');
    }
  },

  logout: (_v, user, _lineItems, token) => {
    requireAuth(user);
    if (token) logout(token);
    return row();
  },

  // No live frontend caller anywhere (grep-confirmed) - built anyway for
  // a complete backend surface.
  getMe: (_v, user) => {
    const u = requireAuth(user);
    return row(String(u.id), u.username, encodeStringList(u.roles), String(u.page_size), u.number_format, u.date_format);
  },

  // No live frontend caller anywhere (grep-confirmed) - built anyway for
  // a complete backend surface.
  setSessionBusiness: (v, user, _lineItems, token) => {
    requireAuth(user);
    const [businessName] = v;
    if (!businessName) throw new CallError(400, 'businessName is required.');
    if (!token) throw new CallError(401, 'Not logged in.');
    try {
      setSessionBusiness(token, businessName);
      return row();
    } catch (err) {
      if (err instanceof AuthError) throw new CallError(401, err.message);
      console.error(err);
      throw new CallError(500, 'Could not set the current business.');
    }
  },

  setSessionProfitCenter: (v, user, _lineItems, token) => {
    requireAuth(user);
    const [profitCenterNameRaw] = v;
    if (!token) throw new CallError(401, 'Not logged in.');
    try {
      setSessionProfitCenter(token, profitCenterNameRaw || null);
      return row();
    } catch (err) {
      if (err instanceof AuthError) throw new CallError(401, err.message);
      console.error(err);
      throw new CallError(500, 'Could not set the current Profit Center.');
    }
  },

  // "Everything below is Administrator-only user management" (old
  // route's own comment) - replicated exactly via requireGlobalRole.
  getUsers: (_v, user) => {
    requireGlobalRole(user, 'Administrator');
    return table(
      ['id', 'username', 'active', 'roles'],
      listUsers().map((u) => ({ id: String(u.id), username: u.username, active: String(u.active), roles: encodeStringList(u.roles) }))
    );
  },

  getRoles: (_v, user) => {
    requireGlobalRole(user, 'Administrator');
    return table(
      ['id', 'name'],
      listRoles().map((r) => ({ id: String(r.id), name: r.name }))
    );
  },

  createUser: (v, user) => {
    requireGlobalRole(user, 'Administrator');
    const [username, password, rolesEncoded] = v;
    if (!username || !password) throw new CallError(400, 'username and password are both required.');
    const roles = decodeStringList(rolesEncoded);
    if (roles.length === 0) throw new CallError(400, 'At least one role is required.');
    try {
      const created = createUser(username, password, roles);
      return row(String(created.id), created.username, String(created.active), encodeStringList(created.roles));
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not create user.');
    }
  },

  setUserRolesApi: (v, user) => {
    requireGlobalRole(user, 'Administrator');
    const [userId, rolesEncoded] = v;
    if (!userId) throw new CallError(400, 'userId is required.');
    try {
      setUserRoles(Number(userId), decodeStringList(rolesEncoded));
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not update roles.');
    }
  },

  setUserActiveApi: (v, user) => {
    requireGlobalRole(user, 'Administrator');
    const [userId, active] = v;
    if (!userId) throw new CallError(400, 'userId is required.');
    try {
      setUserActive(Number(userId), active === 'true');
      return row();
    } catch (err) {
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      console.error(err);
      throw new CallError(500, 'Could not update user.');
    }
  },

  changeUserPassword: (v, user) => {
    requireGlobalRole(user, 'Administrator');
    const [userId, password] = v;
    if (!userId || !password) throw new CallError(400, 'userId and password are both required.');
    try {
      changePassword(Number(userId), password);
      return row();
    } catch (err) {
      if (err instanceof ValidationError || err instanceof NotFoundError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not change password.');
    }
  },

  changeOwnPassword: (v, user) => {
    const u = requireAuth(user);
    const [currentPassword, newPassword] = v;
    if (!currentPassword || !newPassword) throw new CallError(400, 'currentPassword and newPassword are both required.');
    try {
      changeOwnPassword(asUserId(u.id), currentPassword, newPassword);
      return row();
    } catch (err) {
      if (err instanceof ValidationError || err instanceof NotFoundError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not change password.');
    }
  },

  setOwnPageSize: (v, user) => {
    const u = requireAuth(user);
    const [pageSize] = v;
    if (!pageSize) throw new CallError(400, 'pageSize is required.');
    try {
      setOwnPageSize(asUserId(u.id), Number(pageSize));
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not update page size.');
    }
  },

  setOwnNumberFormat: (v, user) => {
    const u = requireAuth(user);
    const [numberFormat] = v;
    if (!numberFormat) throw new CallError(400, 'numberFormat is required.');
    try {
      setOwnNumberFormat(asUserId(u.id), numberFormat);
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not update number format.');
    }
  },

  setOwnDateFormat: (v, user) => {
    const u = requireAuth(user);
    const [dateFormat] = v;
    if (!dateFormat) throw new CallError(400, 'dateFormat is required.');
    try {
      setOwnDateFormat(asUserId(u.id), dateFormat);
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not update date format.');
    }
  },

  getUserRoleMatrix: (v, user) => {
    requireGlobalRole(user, 'Administrator');
    const [business] = v;
    if (!business) throw new CallError(400, 'business is required.');
    try {
      const matrix = getUserRoleMatrix(asBusinessName(business));
      return row(
        encodeStringList(matrix.users),
        encodeStringList(matrix.roles),
        encodeRecordList(['user', 'role'], matrix.assignments)
      );
    } catch (err) {
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      console.error(err);
      throw new CallError(500, 'Could not load the role matrix.');
    }
  },

  setUserRoleInBusiness: (v, user) => {
    const admin = requireGlobalRole(user, 'Administrator');
    const [business, username, roleName] = v;
    if (!business || !username || !roleName) throw new CallError(400, 'business, username and roleName are all required.');
    try {
      setUserRoleInBusiness(asBusinessName(business), username, roleName, asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof ValidationError || err instanceof NotFoundError) throw new CallError(409, err.message);
      console.error(err);
      throw new CallError(500, 'Could not set this cell of the role matrix.');
    }
  },

  unsetUserRoleInBusiness: (v, user) => {
    const admin = requireGlobalRole(user, 'Administrator');
    const [business, username, roleName] = v;
    if (!business || !username || !roleName) throw new CallError(400, 'business, username and roleName are all required.');
    // Matches the old route's own catch-all exactly - no instanceof
    // check at all there, every error becomes this one fixed message.
    try {
      unsetUserRoleInBusiness(asBusinessName(business), username, roleName, asUserId(admin.id));
      return row();
    } catch (err) {
      console.error(err);
      throw new CallError(500, 'Could not clear this cell of the role matrix.');
    }
  },
};
