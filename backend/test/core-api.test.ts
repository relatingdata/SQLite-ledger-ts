// The core middleware's frontend API (src/core/api.ts): the plain-text
// protocol a frontend, and the step runner, speak to it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = path.join(os.tmpdir(), `sql-ledger-ts-core-api-${process.pid}.sqlite`);
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true });
process.env.CORE_DB_PATH = file;
const { callCore, CORE_CALLS } = await import('../src/core/api.js');
const { readCsv } = await import('../../shared-fixtures/csv.js');

function call(token: string | undefined, ...fields: string[]) {
  return callCore(fields.join(','), token);
}

function signIn(): string {
  const reply = call(undefined, 'login', 'admin', 'changeme123');
  assert.equal(reply.status, 200);
  return reply.body.split(',')[1];
}

test('the frontend API refuses a call without a session, an unknown function, and a wrong password', () => {
  assert.deepEqual(call(undefined, 'whoAmI'), { status: 401, body: 'error,Not signed in.' });
  assert.equal(call(undefined, 'login', 'admin', 'not-the-password').status, 401);
  assert.equal(call(undefined, 'login', 'nobody', 'changeme123').status, 401);
  const token = signIn();
  assert.equal(call(token, 'noSuchFunction').status, 404);
  assert.equal(callCore('', token).status, 400);
  assert.equal(call('not-a-token', 'whoAmI').status, 401);
});

test('the session holds the user, the business and the ledger; a form never has to send them', () => {
  const token = signIn();
  assert.equal(call(token, 'whoAmI').body, 'ok,admin,Global Business,Actual');

  assert.equal(call(token, 'createBusiness', 'Ice', '2026-27', 'sole trader', 'AUD', '', '').body, 'ok');
  assert.equal(call(token, 'createBusiness', 'Ice').status, 400);
  assert.equal(call(token, 'selectBusiness', 'No Such Business').status, 404);
  assert.equal(call(token, 'switchSession', 'Ice', 'Actual').body, 'ok');
  assert.equal(call(token, 'whoAmI').body, 'ok,admin,Ice,Actual');

  // Every value naming the business or ledger is left empty from here on:
  // the session supplies them. No location either: the trader has one item.
  assert.equal(call(token, 'createUncategorizedItem', '', 'Ice').body, 'ok');
  assert.equal(call(token, 'cashPurchaseSimple', '', '', 'Ice', '50', '100', '').body, 'ok');
  assert.equal(call(token, 'cashSaleSimple', '', '', 'Ice', '40', '200', '').body, 'ok');
  assert.equal(call(token, 'getProfitAndLoss').body, 'ok,8000,4000,4000');
  assert.equal(call(token, 'getTrialBalance').body.split(',')[0], 'ok');

  // A refusal comes back as an error line with its reason, and changes nothing.
  const oversold = call(token, 'cashSaleSimple', '', '', 'Ice', '999', '200', '');
  assert.equal(oversold.status, 400);
  assert.match(oversold.body, /^error,/);
  assert.equal(call(token, 'getProfitAndLoss').body, 'ok,8000,4000,4000');

  // A list comes back as a CSV table under a header row.
  const breakdown = call(token, 'getProfitAndLossByAxis', '', '', '', '', 'Item', 'Consolidated');
  assert.ok(breakdown.body.startsWith('ok\n'));
  assert.deepEqual(readCsv(breakdown.body.slice(3)), [{ outer: 'Ice', inner: '', total_income_minor: '8000', total_expense_minor: '4000', net_income_minor: '4000' }]);
  assert.equal(call(token, 'exists', 'Item', 'Ice').body, 'ok,true');
  assert.equal(call(token, 'exists', 'Item', 'Fire').body, 'ok,false');

  // The year-end count from a terminal or a phone: the sheet, a count, and
  // the rest confirmed automatically.
  const sheet = call(token, 'getStockTakeSheet', '2027-06-30');
  assert.deepEqual(readCsv(sheet.body.slice(3)), [{ location: '', item: 'Ice', on_hand: '10', counted: '' }]);
  assert.equal(call(token, 'confirmStockCount', 'Ice', '', '9', '2027-06-30').body, 'ok');
  assert.equal(call(token, 'completeYearEndStockTake', '2027-06-30').body, 'ok,0');
  assert.equal(readCsv(call(token, 'getStockTakeSheet', '2027-06-30').body.slice(3))[0].counted, '9');

  // Signing out ends the session.
  assert.equal(call(token, 'logout').body, 'ok');
  assert.equal(call(token, 'whoAmI').status, 401);
});

test("every function's values are in the order of its screen's fields in screens.csv", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const rows = readCsv(fs.readFileSync(path.join(here, '..', '..', 'shared-fixtures', 'screens.csv'), 'utf-8'));
  const screens = new Map<string, { api: string; fields: [number, string][] }>();
  for (const row of rows) {
    const screen = screens.get(row.screen_name) ?? { api: '', fields: [] };
    if (row.api_function) screen.api = row.api_function;
    if (row.field_name) screen.fields.push([Number(row.position), row.field_name]);
    screens.set(row.screen_name, screen);
  }
  let checked = 0;
  for (const [name, screen] of screens) {
    const fn = CORE_CALLS[screen.api];
    if (!fn) continue;
    const fields = screen.fields.sort((a, b) => a[0] - b[0]).map((f) => f[1]);
    assert.deepEqual(fn.params.slice(0, fields.length), fields, `screen "${name}" -> ${screen.api}`);
    checked += 1;
  }
  assert.ok(checked > 30, `only ${checked} screens checked`);
});
