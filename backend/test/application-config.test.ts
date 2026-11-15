// The application's configuration as entities (application/application.entities,
// written by scripts/extract-application-config.ts) and its ASCII form
// (src/entities/entities-text.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Store } from '../src/core/store.js';
import { loadEntitiesText, dumpEntitiesText } from '../src/entities/entities-text.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(here, '..', '..', 'application', 'application.entities');

function load(text: string): Store {
  const store = new Store(':memory:');
  loadEntitiesText(store, text);
  return store;
}

test('the ASCII form of the entities loads and writes back unchanged', () => {
  const text = fs.readFileSync(configPath, 'utf-8');
  assert.ok(/^[\x0a\x20-\x7e]*$/.test(text), 'only printable ASCII and newlines');
  assert.equal(dumpEntitiesText(load(text)), text);
});

test('values, references, kinds, ordered children and escapes survive the ASCII form', () => {
  const text = [
    'Root',
    ' Active',
    ' Application',
    '  Calls',
    '   save :Call Client=saveThing',
    '    - :Parameter Name=first',
    '    - :Parameter Name="second one" Note="caf\\u00e9 \\"quoted\\"\\nline"',
    '  Kinds',
    '   Call Ordered>/Root/Active',
    '   Parameter',
    '  Screens',
    '   "/cash/sale" Uses>/Root/Application/Calls/save',
    '',
  ].join('\n');
  const store = load(text);
  assert.equal(dumpEntitiesText(store), text);
  const calls = store.child(store.child(store.child(null, 'Root')!.id, 'Application')!.id, 'Calls')!;
  const params = store.children(store.child(calls.id, 'save')!.id).filter((c) => store.child(c.id, 'Kind'));
  assert.deepEqual(params.map((p) => p.name), ['a0', 'a1']);
  const note = store.child(params[1].id, 'Note')!;
  assert.equal(store.get(note.relation!).name, 'café "quoted"\nline');
});

test('every call the step runner makes is configured with its parameters in screen order', () => {
  const store = load(fs.readFileSync(configPath, 'utf-8'));
  const app = store.child(store.child(null, 'Root')!.id, 'Application')!;
  const calls = store.child(app.id, 'Calls')!;
  const csv = fs.readFileSync(path.join(here, '..', '..', 'shared-fixtures', 'screens.csv'), 'utf-8').split('\n').slice(1).filter(Boolean);
  const expected = new Map<string, string[]>();
  for (const line of csv) {
    const cols = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"'));
    const [, , , , fn, , position, field] = cols;
    if (!fn || !field) continue;
    const list = expected.get(fn) ?? [];
    list[Number(position) - 1] = field;
    expected.set(fn, list);
  }
  assert.ok(expected.size > 50);
  for (const [fn, fields] of expected) {
    const call = store.child(calls.id, fn);
    assert.ok(call, `no call ${fn}`);
    const names = store.children(call.id).filter((c) => store.child(c.id, 'Kind')).map((p) => store.get(store.child(p.id, 'Name')!.relation!).name);
    assert.deepEqual(names.slice(0, fields.filter(Boolean).length), fields.filter(Boolean), fn);
  }
});
