// The ASCII-CSV call protocol's dispatcher and its field codecs.
// Documented in docs/pm-journal-api.md, "The HTTP mounts".
import { test } from './test-runtime.ts';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

process.env.DB_PATH = path.join(os.tmpdir(), `sql-ledger-ts-call-dispatch-test-${process.pid}-${Date.now()}.sqlite`);
process.env.SEED_DEMO_BUSINESSES = 'false';
const dispatch = await import('../src/call-dispatch.ts');

test('callRouter: a call to an unknown function is a 404, never evaluated', () => {
  assert.throws(
    () => dispatch.callBackendFunction('process.exit', [], undefined),
    (err: unknown) => err instanceof dispatch.CallError && err.status === 404
  );
});

test('the call-dispatch codecs: every decode is the exact inverse of its encode, including commas, quotes and empty values', () => {
  const strings = ['plain', 'with, comma', 'with "quotes"', ''];
  assert.deepEqual(dispatch.decodeStringList(dispatch.encodeStringList(strings)), strings);
  assert.deepEqual(dispatch.decodeStringList(dispatch.encodeStringList([])), []);
  const shape: [string, string][] = [['Beer', 'Beer'], ['Lager', 'Storage']];
  assert.deepEqual(dispatch.decodeShape(dispatch.encodeShape(shape)), shape);
  const records = [{ name: 'Cash, petty', amount: '12' }, { name: 'Bank', amount: '' }];
  assert.deepEqual(dispatch.decodeRecordList(['name', 'amount'], dispatch.encodeRecordList(['name', 'amount'], records)), records);
  const category = [{ name: 'Sales', accountnumber: '4000', is_leaf: false, debit_minor: 0, credit_minor: 500, is_contra: false, children: [{ name: 'Wine, red', accountnumber: null, is_leaf: true, debit_minor: 0, credit_minor: 500, is_contra: false, children: [] }] }];
  assert.deepEqual(dispatch.decodeCategoryTree(dispatch.encodeCategoryTree(category)), category);
  const generic = [{ name: 'Total', accountId: null, own: {}, total: { EUR: 5 }, children: [{ name: 'Cash', accountId: 7, own: { EUR: 5 }, total: { EUR: 5 }, children: [] }] }];
  assert.deepEqual(dispatch.decodeGenericTree(dispatch.encodeGenericTree(generic)), generic);
});

test('the wire codec keeps a value with line breaks on one line: an XML document goes out and comes back whole', async () => {
  const { csvField, splitCsvLine, unescapeAscii } = await import('../../shared-fixtures/csv.ts');
  const xml = '<?xml version="1.0"?>\n<Invoice>\r\n\t<ID>INV-1, café</ID>\n</Invoice>';
  const line = ['ok', csvField(xml)].join(',');
  assert.equal(line.split('\n').length, 1, 'one record is one line');
  assert.deepEqual(splitCsvLine(line).map(unescapeAscii), ['ok', xml]);
});
