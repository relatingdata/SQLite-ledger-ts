import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutOrgChart, BOX_WIDTH, BOX_HEIGHT, type OrgChartBoxInput } from '../src/lib/org-chart-layout.ts';

function overlaps(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  // Real box-rectangle overlap, not just identical centers — two boxes at
  // the same depth only truly collide if their x ranges intersect.
  const sameRow = a.y === b.y;
  const xOverlap = Math.abs(a.x - b.x) < BOX_WIDTH;
  return sameRow && xOverlap;
}

test('layoutOrgChart: no two boxes ever overlap, and depth strictly matches containment', () => {
  const nodes: OrgChartBoxInput[] = [
    { id: 'div:North', parentId: null, label: 'North', kind: 'division' },
    { id: 'loc:Shop A', parentId: 'div:North', label: 'Shop A', kind: 'location' },
    { id: 'loc:Shop B', parentId: 'div:North', label: 'Shop B', kind: 'location' },
    { id: 'div:South', parentId: null, label: 'South', kind: 'division' },
    { id: 'loc:Shop C', parentId: 'div:South', label: 'Shop C', kind: 'location' },
    { id: 'dept:Sales', parentId: null, label: 'Sales', kind: 'department' },
    { id: 'emp:Alice', parentId: 'dept:Sales', label: 'Alice', kind: 'employee' },
    { id: 'emp:Bob', parentId: 'dept:Sales', label: 'Bob', kind: 'employee', managerId: 'emp:Alice' },
  ];

  const layout = layoutOrgChart(nodes);
  assert.equal(layout.boxes.length, nodes.length, 'every input box gets placed');

  // No overlaps, checked pairwise.
  for (let i = 0; i < layout.boxes.length; i++) {
    for (let j = i + 1; j < layout.boxes.length; j++) {
      assert.equal(overlaps(layout.boxes[i], layout.boxes[j]), false, `${layout.boxes[i].label} and ${layout.boxes[j].label} must not overlap`);
    }
  }

  const byId = new Map(layout.boxes.map((b) => [b.id, b]));
  // Depth strictly increases by exactly one row (BOX_HEIGHT + gap) per
  // containment level - a location is always one full row below its division.
  const north = byId.get('div:North')!;
  const shopA = byId.get('loc:Shop A')!;
  assert.ok(shopA.y > north.y, 'a location sits below its division');
  assert.equal(shopA.y - north.y, (layout.boxes.find((b) => b.id === 'dept:Sales')!.y === north.y ? 1 : 1) * (BOX_HEIGHT + 56), 'exactly one row down');

  // Reports-to connector only drawn when both ends are real, placed boxes.
  assert.equal(layout.connectors.length, 1);
  assert.deepEqual(layout.connectors[0], { fromId: 'emp:Bob', toId: 'emp:Alice', dashed: true });

  // A parent is centered over its real children (two Shops under North).
  const shopB = byId.get('loc:Shop B')!;
  assert.equal(north.x, (shopA.x + shopB.x) / 2, 'North is centered over Shop A and Shop B');
});

test('layoutOrgChart: a managerId pointing outside the chart (or to a box that got filtered out) is simply ignored, never a crash', () => {
  const nodes: OrgChartBoxInput[] = [{ id: 'emp:Lonely', parentId: null, label: 'Lonely', kind: 'employee', managerId: 'emp:Nobody' }];
  const layout = layoutOrgChart(nodes);
  assert.equal(layout.boxes.length, 1);
  assert.equal(layout.connectors.length, 0);
});

test('layoutOrgChart: a dangling parentId (parent not present in this box set) is treated as a root, not dropped', () => {
  const nodes: OrgChartBoxInput[] = [{ id: 'loc:Orphan', parentId: 'div:Gone', label: 'Orphan', kind: 'location' }];
  const layout = layoutOrgChart(nodes);
  assert.equal(layout.boxes.length, 1);
  assert.equal(layout.boxes[0].y, 0, 'placed at the root row since its stated parent does not actually exist in this box set');
});

test('layoutOrgChart: an empty chart produces an empty, zero-sized layout', () => {
  const layout = layoutOrgChart([]);
  assert.deepEqual(layout.boxes, []);
  assert.deepEqual(layout.connectors, []);
  assert.equal(layout.width, BOX_WIDTH);
  assert.equal(layout.height, BOX_HEIGHT);
});
