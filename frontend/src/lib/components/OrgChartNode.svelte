<script lang="ts">
  // Graphical, typed-box org chart — Locations, Divisions, Departments and
  // Employees, all on one canvas. Replaces StructureTreeNode's indented
  // tree only for BusinessStructurePopup.svelte's first step; Item
  // Categories and Other Hierarchies still use StructureTreeNode
  // unchanged. See /root/.claude/plans/stateful-snacking-adleman.md.
  //
  // Deliberately NOT a graph-layout library (none of d3/dagre/reactflow/
  // svelte-flow is installed) - org-chart-layout.ts is a small, pure,
  // independently-tested layout function; this component only turns its
  // output into absolutely-positioned boxes plus one overlaid <svg> for
  // the connector lines (both containment lines and dashed "reports to"
  // lines), using the same {id -> x,y} table for both.
  import { translations } from '$lib/state.svelte';
  import { layoutOrgChart, BOX_WIDTH, BOX_HEIGHT, type OrgChartBoxKind } from '$lib/org-chart-layout';

  export interface OrgChartBox {
    /** Unique within the whole chart - same role as StructureNode's key;
     * doubles as org-chart-layout.ts's own `id`. */
    key: string;
    parentId: string | null;
    label: string;
    kind: OrgChartBoxKind;
    managerId?: string | null;
    canAddChild?: boolean;
    canMove?: boolean;
    /** "Reports to…" is a second, independent action only Employee boxes
     * offer, alongside the generic "Move…" (which Employee boxes use for
     * "change Department"). */
    canReassignManager?: boolean;
  }

  let {
    nodes,
    onAddChild,
    onStartMove,
    movingKey,
    moveOptions,
    onConfirmMove,
    onCancelMove,
    onStartReassignManager,
    reassigningManagerKey,
    managerOptions,
    onConfirmReassignManager,
    onCancelReassignManager,
    selectedKey = null,
    onSelect = () => {},
  }: {
    nodes: OrgChartBox[];
    onAddChild: (node: OrgChartBox) => void;
    onStartMove: (node: OrgChartBox) => void;
    movingKey: string | null;
    moveOptions: { value: string | null; label: string }[];
    onConfirmMove: (node: OrgChartBox, destination: string | null) => void;
    onCancelMove: () => void;
    onStartReassignManager: (node: OrgChartBox) => void;
    reassigningManagerKey: string | null;
    managerOptions: { value: string | null; label: string }[];
    onConfirmReassignManager: (node: OrgChartBox, managerKey: string | null) => void;
    onCancelReassignManager: () => void;
    selectedKey?: string | null;
    onSelect?: (node: OrgChartBox) => void;
  } = $props();

  const byKey = $derived(new Map(nodes.map((n) => [n.key, n])));
  const layout = $derived(layoutOrgChart(nodes.map((n) => ({ id: n.key, parentId: n.parentId, label: n.label, kind: n.kind, managerId: n.managerId }))));
  const boxAt = $derived(new Map(layout.boxes.map((b) => [b.id, b])));

  function kindLabel(kind: OrgChartBoxKind): string {
    const map: Record<OrgChartBoxKind, string> = {
      division: 'Division',
      location: 'Location',
      department: 'Department',
      employee: 'Employee',
      unassigned: 'Unassigned',
    };
    return translations.current[map[kind]] ?? map[kind];
  }

  let moveSelectedDestination: string | null = $state(null);
  let managerSelectedDestination: string | null = $state(null);
  let moveSelectEl: HTMLSelectElement | undefined = $state();
  let managerSelectEl: HTMLSelectElement | undefined = $state();
  $effect(() => {
    if (movingKey) {
      moveSelectedDestination = moveOptions[0]?.value ?? null;
      // Real keyboard focus must land on the select itself (same reasoning
      // as StructureTreeNode.svelte's own identical effect) - otherwise
      // Enter/Escape stay on the "Move…" trigger button that opened this
      // panel (a native button treats Enter as "click me again") and never
      // reach onMovePanelKeydown below at all, since .inline-panel is a
      // sibling of the side-panel's action buttons, not their ancestor.
      moveSelectEl?.focus();
    }
  });
  $effect(() => {
    if (reassigningManagerKey) {
      managerSelectedDestination = managerOptions[0]?.value ?? null;
      managerSelectEl?.focus();
    }
  });

  function onMovePanelKeydown(e: KeyboardEvent, node: OrgChartBox) {
    if (e.key === 'Enter') {
      e.stopPropagation();
      onConfirmMove(node, moveSelectedDestination);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      onCancelMove();
    }
  }
  function onManagerPanelKeydown(e: KeyboardEvent, node: OrgChartBox) {
    if (e.key === 'Enter') {
      e.stopPropagation();
      onConfirmReassignManager(node, managerSelectedDestination);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      onCancelReassignManager();
    }
  }

  const selectedNode = $derived(selectedKey ? (byKey.get(selectedKey) ?? null) : null);
</script>

<div class="chart-wrap">
  <div class="canvas" style="width: {layout.width}px; height: {layout.height}px;">
    <svg class="lines" width={layout.width} height={layout.height}>
      {#each layout.boxes as box (box.id)}
        {#if box.parentId && boxAt.get(box.parentId)}
          {@const parent = boxAt.get(box.parentId)!}
          <line x1={parent.x + BOX_WIDTH / 2} y1={parent.y + BOX_HEIGHT} x2={box.x + BOX_WIDTH / 2} y2={box.y} class="containment-line" />
        {/if}
      {/each}
      {#each layout.connectors as c (c.fromId + '>' + c.toId)}
        {@const from = boxAt.get(c.fromId)}
        {@const to = boxAt.get(c.toId)}
        {#if from && to}
          <line x1={from.x + BOX_WIDTH / 2} y1={from.y} x2={to.x + BOX_WIDTH / 2} y2={to.y + BOX_HEIGHT} class="reports-to-line" />
        {/if}
      {/each}
    </svg>

    {#each layout.boxes as box (box.id)}
      {@const node = byKey.get(box.id)}
      {#if node}
        <div
          class="box box-{box.kind}"
          class:selected={selectedKey === node.key}
          style="left: {box.x}px; top: {box.y}px; width: {BOX_WIDTH}px; height: {BOX_HEIGHT}px;"
          onclick={() => onSelect(node)}
          onkeydown={(e) => { if (e.key === 'Enter') onSelect(node); }}
          role="button"
          tabindex="0"
        >
          <span class="box-kind">{kindLabel(box.kind)}</span>
          <span class="box-label">{translations.current[node.label] ?? node.label}</span>
        </div>
      {/if}
    {/each}
  </div>

  {#if selectedNode}
    <div class="side-panel">
      <h4>{translations.current[selectedNode.label] ?? selectedNode.label}</h4>
      <p class="side-kind">{kindLabel(selectedNode.kind)}</p>
      <div class="side-actions">
        {#if selectedNode.canAddChild}
          <button type="button" class="link-btn" onclick={() => onAddChild(selectedNode)}>+ {translations.current['Add'] ?? 'Add'}</button>
        {/if}
        {#if selectedNode.canMove}
          <button type="button" class="link-btn" onclick={() => onStartMove(selectedNode)}>{translations.current['Move…'] ?? 'Move…'}</button>
        {/if}
        {#if selectedNode.canReassignManager}
          <button type="button" class="link-btn" onclick={() => onStartReassignManager(selectedNode)}>{translations.current['Reports to…'] ?? 'Reports to…'}</button>
        {/if}
      </div>

      {#if movingKey === selectedNode.key}
        <div class="inline-panel" onkeydown={(e) => onMovePanelKeydown(e, selectedNode)}>
          <select bind:this={moveSelectEl} bind:value={moveSelectedDestination}>
            {#each moveOptions as opt (opt.value ?? '')}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
          <p class="keyboard-hint">{translations.current['Enter moves it here. Escape cancels.'] ?? 'Enter moves it here. Escape cancels.'}</p>
        </div>
      {/if}
      {#if reassigningManagerKey === selectedNode.key}
        <div class="inline-panel" onkeydown={(e) => onManagerPanelKeydown(e, selectedNode)}>
          <select bind:this={managerSelectEl} bind:value={managerSelectedDestination}>
            {#each managerOptions as opt (opt.value ?? '')}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
          <p class="keyboard-hint">{translations.current['Enter sets the manager. Escape cancels.'] ?? 'Enter sets the manager. Escape cancels.'}</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .chart-wrap {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }
  .canvas {
    position: relative;
    flex: 1;
    min-height: 4rem;
    overflow: auto;
  }
  .lines {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    overflow: visible;
  }
  .containment-line {
    stroke: var(--rule-strong);
    stroke-width: 1.5;
  }
  .reports-to-line {
    stroke: var(--brass);
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
  }
  .box {
    position: absolute;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.1rem;
    padding: 0.35rem 0.6rem;
    border-radius: 7px;
    border: 1px solid var(--rule);
    border-left: 4px solid var(--rule-strong);
    background: var(--paper);
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }
  .box:hover {
    background: var(--paper-dim);
  }
  .box.selected {
    border-color: var(--brass);
    box-shadow: 0 0 0 2px rgba(169, 129, 47, 0.25);
  }
  .box-division {
    border-left-color: #6a8caf;
  }
  .box-location {
    border-left-color: var(--brass);
  }
  .box-department {
    border-left-color: #7a9a6a;
  }
  .box-employee {
    border-left-color: #a97b8c;
  }
  .box-unassigned {
    border-left-color: var(--rule-strong);
    opacity: 0.8;
  }
  .box-kind {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--ink-soft);
  }
  .box-label {
    font-size: var(--font-size-small);
    font-weight: 600;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .side-panel {
    width: 14rem;
    flex-shrink: 0;
    border: 1px solid var(--rule);
    border-radius: 8px;
    padding: 0.7rem 0.8rem;
    background: var(--paper-raised, var(--paper));
  }
  .side-panel h4 {
    margin: 0 0 0.1rem;
    font-size: var(--font-size-medium);
  }
  .side-kind {
    margin: 0 0 0.6rem;
    font-size: var(--font-size-small);
    color: var(--ink-soft);
  }
  .side-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.3rem;
  }
  .link-btn {
    background: none;
    border: none;
    color: var(--brass-dark);
    cursor: pointer;
    font-size: var(--font-size-small);
    padding: 0.1rem 0;
  }
  .link-btn:hover {
    text-decoration: underline;
  }
  .inline-panel {
    margin-top: 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .keyboard-hint {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    margin: 0;
  }
</style>
