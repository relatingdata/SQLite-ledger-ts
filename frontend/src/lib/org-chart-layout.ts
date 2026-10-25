// Pure, dependency-free layout for the org chart canvas in
// OrgChartNode.svelte — see /root/.claude/plans/stateful-snacking-adleman.md.
// No d3/dagre/reactflow/svelte-flow is installed (confirmed from
// package.json) and this tree is shallow with modest fan-out, so a full
// tidy-tree algorithm would be overkill: classic simple tree layout —
// depth -> y, in-order leaf position -> x, a parent centered over its
// children — is good enough and easy to reason about and test.
//
// Kept entirely free of Svelte/DOM so it can be unit-tested in isolation
// (see org-chart-layout.test.ts).

export type OrgChartBoxKind = 'division' | 'location' | 'department' | 'employee' | 'unassigned';

export interface OrgChartBoxInput {
  /** Unique within the whole chart. */
  id: string;
  /** Containment parent (division contains locations, department contains
   * employees, etc). null/absent (or pointing at an id not in the input
   * set) makes this box a top-level root. */
  parentId: string | null;
  label: string;
  kind: OrgChartBoxKind;
  /** The id of this employee's manager, if any — drawn as a separate,
   * dashed "reports to" line that can cross containment subtrees
   * entirely independently of parentId. Ignored for non-employee boxes. */
  managerId?: string | null;
}

export interface LayoutBox extends OrgChartBoxInput {
  x: number;
  y: number;
}

export interface LayoutConnector {
  fromId: string;
  toId: string;
  dashed: boolean;
}

export interface OrgChartLayout {
  boxes: LayoutBox[];
  connectors: LayoutConnector[];
  width: number;
  height: number;
}

export const BOX_WIDTH = 168;
export const BOX_HEIGHT = 60;
export const H_GAP = 28;
export const V_GAP = 56;

export function layoutOrgChart(nodes: OrgChartBoxInput[]): OrgChartLayout {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<string | null, OrgChartBoxInput[]>();
  for (const n of nodes) {
    // A parentId that isn't actually present in this box set (already
    // filtered out, or simply absent) makes the box a root, same as a
    // bare null — never a dangling reference into nothing.
    const key = n.parentId != null && byId.has(n.parentId) ? n.parentId : null;
    const list = childrenOf.get(key) ?? [];
    list.push(n);
    childrenOf.set(key, list);
  }
  for (const list of childrenOf.values()) list.sort((a, b) => a.label.localeCompare(b.label));

  let nextLeafSlot = 0;
  const xOf = new Map<string, number>();
  const depthOf = new Map<string, number>();
  const visiting = new Set<string>();

  function visit(id: string, depth: number): number {
    // Containment (parentId) must be a real tree, built by the caller from
    // real structural data — but guard against an accidental cycle anyway
    // rather than ever hanging the UI on a layout bug.
    if (visiting.has(id)) {
      const x = nextLeafSlot++;
      xOf.set(id, x);
      depthOf.set(id, depth);
      return x;
    }
    visiting.add(id);
    depthOf.set(id, depth);
    const kids = childrenOf.get(id) ?? [];
    let x: number;
    if (kids.length === 0) {
      x = nextLeafSlot++;
    } else {
      const childXs = kids.map((k) => visit(k.id, depth + 1));
      x = childXs.reduce((a, b) => a + b, 0) / childXs.length;
    }
    xOf.set(id, x);
    visiting.delete(id);
    return x;
  }

  const roots = (childrenOf.get(null) ?? []).slice();
  for (const r of roots) visit(r.id, 0);

  const boxes: LayoutBox[] = nodes
    .filter((n) => xOf.has(n.id))
    .map((n) => ({
      ...n,
      x: xOf.get(n.id)! * (BOX_WIDTH + H_GAP),
      y: depthOf.get(n.id)! * (BOX_HEIGHT + V_GAP),
    }));

  // Reports-to lines: independent of the containment tree entirely, can
  // cross department/division/location subtrees — only requires both ends
  // to be real boxes actually placed above.
  const connectors: LayoutConnector[] = nodes
    .filter((n) => n.managerId && byId.has(n.managerId) && xOf.has(n.id) && xOf.has(n.managerId))
    .map((n) => ({ fromId: n.id, toId: n.managerId as string, dashed: true }));

  const maxX = boxes.length ? Math.max(...boxes.map((b) => b.x)) : 0;
  const maxY = boxes.length ? Math.max(...boxes.map((b) => b.y)) : 0;
  return { boxes, connectors, width: maxX + BOX_WIDTH, height: maxY + BOX_HEIGHT };
}
