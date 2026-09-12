<script lang="ts">
  import DivisionTreeNode from './DivisionTreeNode.svelte';
  import { translations } from '$lib/state.svelte';
  import type { DivisionRecord } from '$lib/api';

  export let divisions: DivisionRecord[] = [];
  export let selected = '';
  export let onSelect: (name: string) => void;

  let open = false;

  // Real divisions can be genuinely nested (a real, per-location
  // division under a real, per-city one) — built into an actual tree
  // here, not left as the flat, alphabetical list a plain <select>
  // forced everything into, since the whole point of this picker is
  // to make that real structure visible: Consolidated (the company)
  // -> Division -> Location, any level directly choosable, not just
  // the leaves.
  $: tree = (() => {
    const byParent = new Map<string | null, DivisionRecord[]>();
    for (const d of divisions) {
      const key = d.parentName;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(d);
    }
    function build(parentName: string | null): { name: string; children: any[] }[] {
      return (byParent.get(parentName) ?? [])
        .map((d) => ({ name: d.name, children: build(d.name) }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    // Divisions whose own real parent isn't itself a division (e.g. a
    // city division parented directly under "Divisions") are the real
    // top level here — found by checking which parent names never
    // appear as a division's own name.
    const divisionNames = new Set(divisions.map((d) => d.name));
    const topLevelParents = new Set(divisions.filter((d) => !divisionNames.has(d.parentName ?? '')).map((d) => d.parentName));
    return [...topLevelParents].flatMap((p) => build(p));
  })();

  function pick(name: string) {
    onSelect(name);
    open = false;
  }
</script>

<div class="picker">
  <button type="button" class="current" onclick={() => (open = !open)}>
    {(selected || '').replace(/ Division$/, '') || (translations.current['Consolidated'] ?? 'Consolidated')}
    <span class="caret">{open ? '▴' : '▾'}</span>
  </button>
  {#if open}
    <div class="panel">
      <button type="button" class="node-btn root" class:active={selected === ''} onclick={() => pick('')}>
        {translations.current['Consolidated'] ?? 'Consolidated'}
      </button>
      {#each tree as node (node.name)}
        <DivisionTreeNode name={translations.current[node.name] ?? node.name} {selected} children={node.children} onSelect={pick} depth={1} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .picker {
    position: relative;
  }
  .current {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.7rem;
    border: 1px solid var(--rule-strong, #ccc);
    border-radius: 6px;
    background: var(--paper);
    cursor: pointer;
    font: inherit;
    min-width: 10rem;
    justify-content: space-between;
  }
  .caret {
    color: var(--ink-soft);
    font-size: var(--font-size-small);
  }
  .panel {
    position: absolute;
    top: calc(100% + 0.3rem);
    left: 0;
    z-index: 20;
    background: var(--paper);
    border: 1px solid var(--rule-strong, #ccc);
    border-radius: 8px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
    padding: 0.4rem;
    min-width: 16rem;
    max-height: 20rem;
    overflow-y: auto;
  }
  .node-btn {
    background: none;
    border: none;
    text-align: left;
    padding: 0.32rem 0.6rem;
    cursor: pointer;
    border-radius: 5px;
    font: inherit;
    width: 100%;
  }
  .node-btn:hover {
    background: var(--paper-dim, #f2ede1);
  }
  .node-btn.active {
    background: var(--brass-dark, #7a5c2e);
    color: white;
    font-weight: 600;
  }
  .root {
    font-weight: 700;
    border-bottom: 1px solid var(--rule);
    margin-bottom: 0.3rem;
    border-radius: 0;
  }
</style>
