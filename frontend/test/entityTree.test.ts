import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDescendantOf, filterToItems } from '../src/lib/entityTree.ts';
import type { EntityNode } from '../src/lib/api.ts';

function node(overrides: Partial<EntityNode>): EntityNode {
  return {
    id: 0,
    name: '',
    parent_id: null,
    relation_id: null,
    accountnumber: null,
    balance_minor: null,
    depth: 0,
    is_postable_account: false,
    ...overrides,
  };
}

test('isDescendantOf correctly identifies real ancestry, not just any postable leaf', () => {
  const entities: EntityNode[] = [
    node({ id: 1, name: 'Chart of Accounts', parent_id: null }),
    node({ id: 2, name: 'Asset', parent_id: 1 }),
    node({ id: 3, name: 'Cash and Bank', parent_id: 2, is_postable_account: true }),
    node({ id: 4, name: 'Items', parent_id: null }),
    node({ id: 5, name: 'Red Wine', parent_id: 4 }),
    node({ id: 6, name: 'Merlot 2021', parent_id: 5, is_postable_account: true }),
  ];

  assert.equal(isDescendantOf(entities[5], 'Items', entities), true, 'Merlot really is under Items');
  assert.equal(isDescendantOf(entities[2], 'Items', entities), false, 'Cash and Bank is under Asset/Chart of Accounts, not Items, even though both are postable leaves');
});

test('filterToItems excludes every non-product leaf, and does NOT require is_postable_account — real items never have that flag set at all', () => {
  const entities: EntityNode[] = [
    node({ id: 1, name: 'Chart of Accounts', parent_id: null }),
    node({ id: 2, name: 'Asset', parent_id: 1 }),
    node({ id: 3, name: 'Cash and Bank', parent_id: 2, is_postable_account: true }),
    node({ id: 4, name: 'Sales Revenue', parent_id: 1, is_postable_account: true }),
    node({ id: 10, name: 'Items', parent_id: null }),
    node({ id: 11, name: 'Red Wine', parent_id: 10 }),
    node({ id: 12, name: 'Merlot 2021', parent_id: 11, is_postable_account: false }), // matches real data exactly: items post via quantity movement, never the account table
    node({ id: 13, name: 'Shiraz 2021', parent_id: 11, is_postable_account: false }),
  ];

  const result = filterToItems(entities);
  const names = result.map((e) => e.name).sort();
  assert.deepEqual(names, ['Merlot 2021', 'Shiraz 2021'], 'only the two real wine products, not Cash and Bank or Sales Revenue — the exact reported bug');
});

test('isDescendantOf never infinite-loops on a malformed/cyclic tree', () => {
  const entities: EntityNode[] = [node({ id: 1, name: 'A', parent_id: 2 }), node({ id: 2, name: 'B', parent_id: 1 })];
  assert.equal(isDescendantOf(entities[0], 'Items', entities), false);
});
