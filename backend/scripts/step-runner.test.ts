import { test } from '../test/test-runtime.ts';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  parseCsvLine,
  loadScreens,
  loadSteps,
  lintSteps,
  runStepViaApi,
  type Screen,
} from './step-runner.ts';
import { createBusiness, asBusinessName, asUserId, getEntityTree } from '../src/db.ts';

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'step-runner-test-'));
}

test('parseCsvLine: plain fields', () => {
  assert.deepEqual(parseCsvLine('a,b,c'), ['a', 'b', 'c']);
});

test('parseCsvLine: quoted fields with embedded commas', () => {
  assert.deepEqual(parseCsvLine('"Create Business","Wine Co, Ltd","2027-28"'), ['Create Business', 'Wine Co, Ltd', '2027-28']);
});

test('parseCsvLine: doubled quotes inside a quoted field', () => {
  assert.deepEqual(parseCsvLine('"She said ""hi""",ok'), ['She said "hi"', 'ok']);
});

test('loadScreens: groups fields by screen and sorts by position', () => {
  const dir = tempDir();
  const path = join(dir, 'screens.csv');
  writeFileSync(
    path,
    'screen_name,ui_path,open_selector,api_function,submit_selector,position,field_name,field_selector,field_type\n' +
      'Login,/login,,,button:has-text(\'Log in\'),2,password,input#pw,text\n' +
      'Login,/login,,,button:has-text(\'Log in\'),1,username,input#user,text\n'
  );
  const screens = loadScreens(path);
  const login = screens.get('Login')!;
  assert.equal(login.fields.length, 2);
  assert.equal(login.fields[0].field_name, 'username', 'fields must be sorted by position, not file order');
  assert.equal(login.fields[1].field_name, 'password');
});

test('loadSteps: reads a purely positional data file with no header row', () => {
  const dir = tempDir();
  const path = join(dir, 'data.csv');
  writeFileSync(path, '"Login","admin","changeme123"\n"Create Business","Wine Co","2027-28"\n');
  const steps = loadSteps(path);
  assert.equal(steps.length, 2);
  assert.equal(steps[0].screen_name, 'Login');
  assert.deepEqual(steps[0].values, ['admin', 'changeme123']);
  assert.equal(steps[0].verify, '', 'no .control.csv exists, so verify must default to empty, not throw');
});

test('loadSteps: reads a matching .control.csv when present, aligned by row', () => {
  const dir = tempDir();
  const path = join(dir, 'data.csv');
  writeFileSync(path, '"Login","admin","changeme123"\n"Create Business","Wine Co","2027-28"\n');
  writeFileSync(join(dir, 'data.control.csv'), 'path,verify,screenshot\napi,,login_shot\nui,business_exists,biz_shot\n');
  const steps = loadSteps(path);
  assert.equal(steps[0].path, 'api');
  assert.equal(steps[0].screenshot, 'login_shot');
  assert.equal(steps[1].path, 'ui');
  assert.equal(steps[1].verify, 'business_exists');
});

test('lintSteps: flags a screen_name with no real registry entry', () => {
  const screens = new Map<string, Screen>();
  const steps = [{ index: 1, screen_name: 'Nonexistent Screen', values: ['x'], path: '', verify: '', screenshot: '' }];
  const problems = lintSteps(steps, screens);
  assert.ok(problems.some((p) => p.includes('no real entry in the screen registry')));
});

test('lintSteps: flags a real value-count mismatch against the registry', () => {
  const screens = new Map<string, Screen>([
    ['Login', { screen_name: 'Login', ui_path: '', open_selector: '', api_function: '', submit_selector: '', fields: [
      { position: 1, field_name: 'username', field_selector: '', field_type: 'text' },
      { position: 2, field_name: 'password', field_selector: '', field_type: 'text' },
    ] }],
  ]);
  const steps = [{ index: 1, screen_name: 'Login', values: ['admin'], path: '', verify: '', screenshot: '' }];
  const problems = lintSteps(steps, screens);
  assert.ok(problems.some((p) => p.includes('real value(s)') && p.includes('real field(s)')));
});

test('lintSteps: flags an api_function with no real API_REGISTRY entry', () => {
  const screens = new Map<string, Screen>([
    ['Made Up', { screen_name: 'Made Up', ui_path: '', open_selector: '', api_function: 'notARealFunction', submit_selector: '', fields: [] }],
  ]);
  const steps = [{ index: 1, screen_name: 'Made Up', values: [], path: '', verify: '', screenshot: '' }];
  const problems = lintSteps(steps, screens);
  assert.ok(problems.some((p) => p.includes('no real API_REGISTRY entry')));
});

test('lintSteps: a genuinely correct fixture reports zero real problems', () => {
  const screens = new Map<string, Screen>([
    ['Login', { screen_name: 'Login', ui_path: '', open_selector: '', api_function: '', submit_selector: '', fields: [
      { position: 1, field_name: 'username', field_selector: '', field_type: 'text' },
    ] }],
  ]);
  const steps = [{ index: 1, screen_name: 'Login', values: ['admin'], path: '', verify: '', screenshot: '' }];
  assert.deepEqual(lintSteps(steps, screens), []);
});

test('lintSteps: flags a real, data-submitting screen with no real api_function as a real, silent no-op waiting to happen', () => {
  const screens = new Map<string, Screen>([
    ['Create Item', { screen_name: 'Create Item', screen_kind: 'data', ui_path: '/items', open_selector: '', api_function: '', submit_selector: "button:has-text('+ Add')", fields: [] }],
  ]);
  const steps = [{ index: 1, screen_name: 'Create Item', values: [], path: '', verify: '', screenshot: '' }];
  const problems = lintSteps(steps, screens);
  assert.ok(problems.some((p) => p.includes('silently do nothing at all')));
});

test('runStepViaApi: a real createBusiness step, run through the real, live backend, genuinely creates the business', () => {
  const screens = new Map<string, Screen>([
    ['Create Business', {
      screen_name: 'Create Business', ui_path: '', open_selector: '', api_function: 'createBusiness', submit_selector: '',
      fields: [
        { position: 1, field_name: 'businessName', field_selector: '', field_type: 'text' },
        { position: 2, field_name: 'financialYearLabel', field_selector: '', field_type: 'text' },
      ],
    }],
  ]);
  const step = { index: 1, screen_name: 'Create Business', values: ['StepRunnerUnitTest Co', '2027-28'], path: 'api', verify: 'business_exists', screenshot: '' };
  const result = runStepViaApi(step, screens);
  assert.equal(result.ok, true, result.error);
  assert.ok(getEntityTree().some((e) => e.name === 'StepRunnerUnitTest Co'), 'the real business must genuinely exist after the real step runs');
});

test('runStepViaApi: a real, deliberately-wrong verify correctly reports failure, not a false pass', () => {
  const screens = new Map<string, Screen>([
    ['Create Business', {
      screen_name: 'Create Business', ui_path: '', open_selector: '', api_function: 'createBusiness', submit_selector: '',
      fields: [
        { position: 1, field_name: 'businessName', field_selector: '', field_type: 'text' },
        { position: 2, field_name: 'financialYearLabel', field_selector: '', field_type: 'text' },
      ],
    }],
  ]);
  const step = { index: 1, screen_name: 'Create Business', values: ['StepRunnerUnitTest Co Two', '2027-28'], path: 'api', verify: 'location_exists', screenshot: '' };
  const result = runStepViaApi(step, screens);
  assert.equal(result.ok, false, 'verify checks a locationName that was never provided, so this must genuinely fail, not silently pass');
});
