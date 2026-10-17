import { test, after } from './test-runtime.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDbPath = path.join(os.tmpdir(), `sql-ledger-ts-auth-test-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = tmpDbPath;

const {
  hashPassword,
  verifyPassword,
  login,
  logout,
  getSessionUser,
  createUser,
  listUsers,
  listRoles,
  setUserRoles,
  setUserActive,
  changePassword,
  changeOwnPassword,
  setOwnPageSize,
  setOwnNumberFormat,
  setOwnDateFormat,
  getUserRoleMatrix,
  setUserRoleInBusiness,
  unsetUserRoleInBusiness,
  provisionBusinessAdminUser,
  userHasBusinessAdminRole,
  BUSINESS_ADMIN_ROLE,
  AuthError,
} = await import('../src/auth.ts');
const { requireRole, requireGlobalRole } = await import('../src/auth-middleware.ts');
const { ValidationError, db, asBusinessName, asUserId, createBusiness } = await import('../src/db.ts');

after(() => {
  db.close();
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.unlinkSync(tmpDbPath + suffix);
    } catch {
      /* fine if already gone */
    }
  }
});

test('password hashing: correct password verifies, wrong password is rejected', () => {
  const stored = hashPassword('a-real-password');
  assert.equal(verifyPassword('a-real-password', stored), true);
  assert.equal(verifyPassword('not-the-password', stored), false);
});

test('two hashes of the same password are different (salted), but both verify correctly', () => {
  const a = hashPassword('same-password');
  const b = hashPassword('same-password');
  assert.notEqual(a, b, 'salts should differ, so stored hashes should differ');
  assert.equal(verifyPassword('same-password', a), true);
  assert.equal(verifyPassword('same-password', b), true);
});

test('the bootstrap admin user exists with Administrator role and the documented default password', () => {
  // Per docs/business-admin-role-and-enforcement-design.md: a real,
  // fifth global role, granted only through the per-business matrix,
  // never globally — so the bootstrap admin user's own roles (below)
  // are unaffected.
  const roles = listRoles();
  assert.deepEqual(
    roles.map((r) => r.name),
    ['Administrator', 'Bookkeeper', 'Read-Only', 'Developer', 'Business Admin', 'Accountant']
  );
  const users = listUsers();
  const admin = users.find((u) => u.username === 'admin');
  assert.ok(admin);
  assert.deepEqual(admin!.roles, ['Administrator']);

  const { token, user } = login('admin', 'changeme123');
  assert.ok(token);
  assert.equal(user.username, 'admin');
  assert.deepEqual(user.roles, ['Administrator']);
});

test('login rejects a wrong password, and gives the same error for a nonexistent username (no user enumeration)', () => {
  let wrongPasswordError: unknown;
  try {
    login('admin', 'definitely-wrong');
  } catch (e) {
    wrongPasswordError = e;
  }
  let noSuchUserError: unknown;
  try {
    login('nobody-by-this-name', 'whatever');
  } catch (e) {
    noSuchUserError = e;
  }
  assert.ok(wrongPasswordError instanceof AuthError);
  assert.ok(noSuchUserError instanceof AuthError);
  assert.equal((wrongPasswordError as Error).message, (noSuchUserError as Error).message);
});

test('a valid session token resolves to the correct user and roles; an invalid one resolves to null', () => {
  const { token } = login('admin', 'changeme123');
  const user = getSessionUser(token);
  assert.ok(user);
  assert.equal(user!.username, 'admin');

  assert.equal(getSessionUser('not-a-real-token'), null);
  assert.equal(getSessionUser(undefined), null);
});

test('logout invalidates the session immediately', () => {
  const { token } = login('admin', 'changeme123');
  assert.ok(getSessionUser(token));
  logout(token);
  assert.equal(getSessionUser(token), null);
});

test('createUser rejects a duplicate username and a too-short password', () => {
  createUser('bookkeeper1', 'a-good-password', ['Bookkeeper']);
  assert.throws(() => createUser('bookkeeper1', 'another-password', ['Bookkeeper']), ValidationError);
  assert.throws(() => createUser('someoneelse', 'short', ['Bookkeeper']), ValidationError);
});

test('a newly created user can log in with the exact role(s) assigned', () => {
  createUser('readonly1', 'a-good-password', ['Read-Only']);
  const { user } = login('readonly1', 'a-good-password');
  assert.deepEqual(user.roles, ['Read-Only']);
});

test('setUserRoles changes what a session created afterward reflects', () => {
  const created = createUser('multirole1', 'a-good-password', ['Bookkeeper']);
  setUserRoles(created.id, ['Bookkeeper', 'Administrator']);
  const { user } = login('multirole1', 'a-good-password');
  assert.deepEqual([...user.roles].sort(), ['Administrator', 'Bookkeeper']);
});

test('deactivating a user immediately kills their existing sessions and blocks new logins', () => {
  const created = createUser('deactivateme', 'a-good-password', ['Bookkeeper']);
  const { token } = login('deactivateme', 'a-good-password');
  assert.ok(getSessionUser(token), 'session should be valid before deactivation');

  setUserActive(created.id, false);

  assert.equal(getSessionUser(token), null, 'existing session must be invalidated immediately on deactivation');
  assert.throws(() => login('deactivateme', 'a-good-password'), AuthError);
});

test('changePassword replaces the password — the old one stops working, the new one works', () => {
  const created = createUser('changepw1', 'original-password', ['Bookkeeper']);
  changePassword(created.id, 'brand-new-password');
  assert.throws(() => login('changepw1', 'original-password'), AuthError);
  const { user } = login('changepw1', 'brand-new-password');
  assert.equal(user.username, 'changepw1');
});

test('changeOwnPassword requires proving the current password first — unlike the admin path, which does not need to', () => {
  const user = createUser('selfservice1', 'the-original-password', ['Bookkeeper']);

  assert.throws(
    () => changeOwnPassword(user.id, 'a-wrong-guess', 'a-brand-new-password'),
    ValidationError,
    'must reject with the wrong current password, not silently allow the change'
  );

  // The password must be genuinely unchanged after the rejected attempt.
  assert.ok(login('selfservice1', 'the-original-password'), 'the original password must still work after a rejected change attempt');

  changeOwnPassword(user.id, 'the-original-password', 'a-brand-new-password');
  assert.ok(login('selfservice1', 'a-brand-new-password'), 'the new password must now work');
  assert.throws(() => login('selfservice1', 'the-original-password'), AuthError, 'the old password must no longer work');
});

test('setOwnPageSize: a real, user-settable preference, defaulting to 20, rejecting nonsense values', () => {
  const user = createUser('pagesizetest', 'testpass123', ['Administrator']);
  const { token } = login('pagesizetest', 'testpass123');
  const before = getSessionUser(token)!;
  assert.equal(before.page_size, 20, 'default page size must be 20 for a newly created user');

  setOwnPageSize(user.id, 50);
  const after = getSessionUser(token)!;
  assert.equal(after.page_size, 50);

  assert.throws(() => setOwnPageSize(user.id, 0), ValidationError, 'zero is not a usable page size');
  assert.throws(() => setOwnPageSize(user.id, -5), ValidationError, 'negative is nonsense');
  assert.throws(() => setOwnPageSize(user.id, 3.5), ValidationError, 'must be a whole number');
  assert.throws(() => setOwnPageSize(user.id, 10000), ValidationError, 'an absurdly large page size must be rejected too');

  // A rejected change must not have silently applied.
  const afterRejections = getSessionUser(token)!;
  assert.equal(afterRejections.page_size, 50, 'a rejected update must leave the previous value untouched');
});

test('setOwnNumberFormat/setOwnDateFormat: explicit, fixed-choice patterns — not locale inference — defaulting to 1 000.00 / dd/mm/yyyy, rejecting anything outside the fixed list', () => {
  const user = createUser('formattest', 'testpass123', ['Administrator']);
  const { token } = login('formattest', 'testpass123');
  const before = getSessionUser(token)!;
  assert.equal(before.number_format, '1 000.00', 'default must be the space-separated option, matching this business\'s real convention');
  assert.equal(before.date_format, 'dd/mm/yyyy', 'default must be day-first, matching this business\'s real convention');

  setOwnNumberFormat(user.id, '1,000.00');
  setOwnDateFormat(user.id, 'yyyy-mm-dd');
  const after = getSessionUser(token)!;
  assert.equal(after.number_format, '1,000.00');
  assert.equal(after.date_format, 'yyyy-mm-dd');

  assert.throws(() => setOwnNumberFormat(user.id, '1 000,00'), ValidationError, 'not one of the fixed, real options — must be rejected, not silently accepted as free text');
  assert.throws(() => setOwnDateFormat(user.id, 'DD/MM/YYYY'), ValidationError, 'case must match exactly — no silent normalization hiding a typo');

  // A rejected change must not have silently applied.
  const afterRejections = getSessionUser(token)!;
  assert.equal(afterRejections.number_format, '1,000.00');
  assert.equal(afterRejections.date_format, 'yyyy-mm-dd');
});

test('the per-business role matrix is a real, genuine Cartesian Product — the same user can hold a different role in a different business, independent of their global role', () => {
  createUser('matrixtest1', 'testpass123', ['Bookkeeper']);

  const before = getUserRoleMatrix(asBusinessName('admin'));
  assert.ok(before.users.includes('matrixtest1'), 'every real system user is a row');
  assert.ok(before.roles.includes('Administrator') && before.roles.includes('Read-Only'), 'every real system role is a column');
  assert.equal(before.assignments.some((a) => a.user === 'matrixtest1'), false, 'no cell is set yet — a global role assignment is a genuinely separate fact');

  setUserRoleInBusiness(asBusinessName('admin'), 'matrixtest1', 'Read-Only', asUserId(1));
  const afterSet = getUserRoleMatrix(asBusinessName('admin'));
  assert.ok(afterSet.assignments.some((a) => a.user === 'matrixtest1' && a.role === 'Read-Only'), 'the real cell is now set');

  // Setting the identical cell twice is a real, harmless no-op — never a duplicate row.
  setUserRoleInBusiness(asBusinessName('admin'), 'matrixtest1', 'Read-Only', asUserId(1));
  assert.equal(getUserRoleMatrix(asBusinessName('admin')).assignments.filter((a) => a.user === 'matrixtest1' && a.role === 'Read-Only').length, 1, 'idempotent — never a duplicate cell');

  // A genuinely different business gets its own, independent matrix — setting a cell in "admin" must not leak into it.
  createBusiness(asBusinessName('MatrixTest Business'), 'FY2027', asUserId(1));
  const otherBusinessMatrix = getUserRoleMatrix(asBusinessName('MatrixTest Business'));
  assert.equal(otherBusinessMatrix.assignments.some((a) => a.user === 'matrixtest1'), false, 'a real, genuinely separate business starts with its own, empty matrix');

  unsetUserRoleInBusiness(asBusinessName('admin'), 'matrixtest1', 'Read-Only', asUserId(1));
  assert.equal(getUserRoleMatrix(asBusinessName('admin')).assignments.some((a) => a.user === 'matrixtest1'), false, 'unsetting the real cell clears it');

  // Clearing an already-clear cell, or one that never existed, is a real, harmless no-op.
  unsetUserRoleInBusiness(asBusinessName('admin'), 'matrixtest1', 'Read-Only', asUserId(1));
  unsetUserRoleInBusiness(asBusinessName('admin'), 'nonexistentuser', 'Administrator', asUserId(1));

  assert.throws(() => setUserRoleInBusiness(asBusinessName('admin'), 'nonexistentuser', 'Read-Only', asUserId(1)), ValidationError, 'a real, unknown user must be rejected');
  assert.throws(() => setUserRoleInBusiness(asBusinessName('admin'), 'matrixtest1', 'Nonexistent Role', asUserId(1)), ValidationError, 'a real, unknown role must be rejected');

  // The real, global role from setUserRoles is a genuinely separate fact, untouched by any of the above.
  const globalRoles = listUsers().find((u) => u.username === 'matrixtest1')!.roles;
  assert.deepEqual(globalRoles, ['Bookkeeper'], 'the matrix is additive — it never changes the existing, global role assignment');
});

test('provisionBusinessAdminUser gives a new business a real, dedicated admin user with Business Admin only in that one business, never any global role', () => {
  createBusiness(asBusinessName('Provision Test Business'), 'FY2027', asUserId(1));
  const { username, password } = provisionBusinessAdminUser(asBusinessName('Provision Test Business'), asUserId(1));

  assert.equal(username, 'Provision Test Business Admin');
  assert.ok(password.length >= 8, 'the generated password must satisfy the same, real minimum length every user password does');

  const created = listUsers().find((u) => u.username === username);
  assert.ok(created, 'a real user was actually created');
  assert.deepEqual(created!.roles, [], 'zero global roles — Business Admin is granted only through the matrix, never globally');

  const matrix = getUserRoleMatrix(asBusinessName('Provision Test Business'));
  assert.ok(matrix.assignments.some((a) => a.user === username && a.role === BUSINESS_ADMIN_ROLE), 'Business Admin is set for this one business');

  // The generated password actually logs in.
  const { user } = login(username, password);
  assert.equal(user.username, username);
  assert.deepEqual(user.roles, [], 'login reflects the real, global roles only — still none');

  assert.equal(userHasBusinessAdminRole(asBusinessName('Provision Test Business'), username), true);
  assert.equal(userHasBusinessAdminRole(asBusinessName('admin'), username), false, 'Business Admin in one business must never leak into a genuinely different one');
  assert.equal(userHasBusinessAdminRole(asBusinessName('Provision Test Business'), 'nonexistentuser'), false);
  assert.equal(userHasBusinessAdminRole(asBusinessName('No Such Business At All'), username), false, 'a business that does not resolve is a real, honest "no", never a thrown error');
});

test('requireRole accepts a real, global role as before, and ALSO accepts Business Admin held in the session\'s current business — but requireGlobalRole never does', () => {
  createBusiness(asBusinessName('Enforcement Test Business'), 'FY2027', asUserId(1));
  const { username } = provisionBusinessAdminUser(asBusinessName('Enforcement Test Business'), asUserId(1));

  function fakeReq(overrides: Record<string, unknown>) {
    return { user: { id: 1, username, roles: [] as string[] }, businessName: null as string | null, ...overrides };
  }
  function run(mw: (req: unknown, res: unknown, next: () => void) => void, req: unknown) {
    let status: number | undefined;
    let nextCalled = false;
    const res = { status: (s: number) => { status = s; return { json: () => {} }; } };
    mw(req, res, () => { nextCalled = true; });
    return { nextCalled, status };
  }

  // No business selected at all — requireRole's Business Admin fallback has nothing to check, so it 403s.
  assert.equal(run(requireRole('Administrator'), fakeReq({ businessName: null })).nextCalled, false);

  // The right business, held as Business Admin — requireRole passes, for ANY role list, exactly the "full access within this business" promise.
  assert.equal(run(requireRole('Administrator'), fakeReq({ businessName: 'Enforcement Test Business' })).nextCalled, true);
  assert.equal(run(requireRole('Bookkeeper'), fakeReq({ businessName: 'Enforcement Test Business' })).nextCalled, true);

  // A genuinely different business — Business Admin in one business must never satisfy a check scoped to another.
  assert.equal(run(requireRole('Administrator'), fakeReq({ businessName: 'admin' })).nextCalled, false);

  // requireGlobalRole never consults the matrix at all, even for the right business — the one, real, deliberate carve-out (creating a business, managing the global user list).
  assert.equal(run(requireGlobalRole('Administrator'), fakeReq({ businessName: 'Enforcement Test Business' })).nextCalled, false);

  // A genuinely global Administrator still passes both, regardless of business.
  const globalAdminReq = fakeReq({ user: { id: 1, username: 'admin', roles: ['Administrator'] }, businessName: null });
  assert.equal(run(requireRole('Administrator'), globalAdminReq).nextCalled, true);
  assert.equal(run(requireGlobalRole('Administrator'), globalAdminReq).nextCalled, true);

  // Not logged in at all — both reject with 401, before any role check.
  const anonResult = run(requireRole('Administrator'), { user: undefined, businessName: null });
  assert.equal(anonResult.nextCalled, false);
  assert.equal(anonResult.status, 401);
});
