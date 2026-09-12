import { test, beforeAll as before, afterAll as after } from 'bun:test';
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
  AuthError,
} = await import('../src/auth.ts');
const { ValidationError, db } = await import('../src/db.ts');

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
  const roles = listRoles();
  assert.deepEqual(
    roles.map((r) => r.name),
    ['Administrator', 'Bookkeeper', 'Read-Only', 'Developer']
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
