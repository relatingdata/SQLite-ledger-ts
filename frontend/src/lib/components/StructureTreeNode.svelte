<script lang="ts">
  // Generic, editable business-structure tree node — see
  // docs/pm-frontend-reference.md's "Business Structure popup" section.
  //
  // Unlike HierarchyGroupTreeNode.svelte (read-only, select-only), this
  // node renders an "+ Add" action (opens a type-specific add form,
  // owned by the caller) and a "Move…" action (opens an inline
  // destination picker, right here, for any node whose real parent/tag
  // can change). The caller decides, per node, which actions are legal
  // (canAddChild/canMove) and what the valid move destinations are —
  // this component has no opinion on Locations vs Item Categories vs a
  // generic Hierarchy, and makes no API calls itself.
  import { translations } from '$lib/state.svelte';
  import Self from './StructureTreeNode.svelte';

  export interface StructureNode {
    /** Unique within the whole tree — used for Svelte's keyed #each and
     * to identify which node is currently mid-move. */
    key: string;
    /** The real, underlying entity/hierarchy-value name used in API calls. */
    name: string;
    /** Display label, when it differs from the raw name (falls back to name). */
    label?: string;
    kind: 'location' | 'division-value' | 'category' | 'hierarchy-value';
    children: StructureNode[];
    canAddChild?: boolean;
    canMove?: boolean;
  }

  let {
    node,
    depth = 0,
    onAddChild,
    onStartMove,
    movingKey,
    moveOptions,
    onConfirmMove,
    onCancelMove,
    selectedKey = null,
    onSelect = () => {},
  }: {
    node: StructureNode;
    depth?: number;
    onAddChild: (node: StructureNode) => void;
    onStartMove: (node: StructureNode) => void;
    movingKey: string | null;
    moveOptions: { value: string | null; label: string }[];
    onConfirmMove: (node: StructureNode, destination: string | null) => void;
    onCancelMove: () => void;
    /** Which node (if any) the enclosing Insert/Delete toolbar currently has
     * selected — purely cosmetic here (a highlight), the actual Delete key
     * handling lives on the toolbar itself. */
    selectedKey?: string | null;
    onSelect?: (node: StructureNode) => void;
  } = $props();

  let selectedDestination: string | null = $state(null);
  let moveSelectEl: HTMLSelectElement | undefined = $state();

  $effect(() => {
    if (movingKey === node.key) {
      selectedDestination = moveOptions[0]?.value ?? null;
      // Real keyboard focus must land on the select itself, not stay on
      // the "Move…" trigger button that opened this panel — otherwise
      // Enter/Escape bubble from the button, through .node's own keydown
      // handler (which treats Enter there as "select this node"), and
      // never reach onMovePanelKeydown below at all, since .move-panel is
      // a sibling of .node in the markup, not its ancestor.
      moveSelectEl?.focus();
    }
  });

  // Escape/Enter on the inline Move picker — stopPropagation so Escape here
  // never also reaches +layout.svelte's global, hasUnsavedEdit-gated
  // handler (irrelevant to this popup anyway, since its own Escape is
  // already fully swallowed at the modal's root — see
  // BusinessStructurePopup.svelte's own onkeydown), nor the enclosing
  // Insert/Delete toolbar's own keydown handler.
  function onMovePanelKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.stopPropagation();
      onConfirmMove(node, selectedDestination);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      onCancelMove();
    }
  }
</script>

<div
  class="node"
  class:selected={selectedKey === node.key}
  style="padding-left: {depth * 1.1}rem"
  onclick={() => onSelect(node)}
  onkeydown={(e) => { if (e.key === 'Enter') onSelect(node); }}
  role="button"
  tabindex="0"
>
  <span class="node-name">{translations.current[node.label ?? node.name] ?? (node.label ?? node.name)}</span>
  <span class="node-actions">
    {#if node.canAddChild}
      <button type="button" class="link-btn" onclick={(e) => { e.stopPropagation(); onAddChild(node); }}>+ {translations.current['Add'] ?? 'Add'}</button>
    {/if}
    {#if node.canMove}
      <button type="button" class="link-btn" onclick={(e) => { e.stopPropagation(); onStartMove(node); }}>{translations.current['Move…'] ?? 'Move…'}</button>
    {/if}
  </span>
</div>

{#if movingKey === node.key}
  <div class="move-panel" style="padding-left: {(depth + 1) * 1.1}rem" onkeydown={onMovePanelKeydown}>
    <select bind:this={moveSelectEl} bind:value={selectedDestination}>
      {#each moveOptions as opt (opt.value ?? '')}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
    <p class="keyboard-hint">{translations.current['Enter moves it here. Escape cancels.'] ?? 'Enter moves it here. Escape cancels.'}</p>
  </div>
{/if}

{#each node.children as child (child.key)}
  <Self node={child} depth={depth + 1} {onAddChild} {onStartMove} {movingKey} {moveOptions} {onConfirmMove} {onCancelMove} {selectedKey} {onSelect} />
{/each}

<style>
  .node {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    padding: 0.3rem 0.5rem;
    border-radius: 5px;
  }
  .node:hover {
    background: var(--paper-dim, #f2ede1);
  }
  .node.selected {
    background: rgba(169, 129, 47, 0.12);
  }
  .node-name {
    font: inherit;
  }
  .node-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }
  .link-btn {
    background: none;
    border: none;
    color: var(--brass-dark);
    cursor: pointer;
    font-size: var(--font-size-small);
    padding: 0.1rem 0.3rem;
  }
  .link-btn:hover {
    text-decoration: underline;
  }
  .move-panel {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-top: 0.2rem;
    padding-bottom: 0.4rem;
  }
  .keyboard-hint {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    margin: 0;
  }
</style>
