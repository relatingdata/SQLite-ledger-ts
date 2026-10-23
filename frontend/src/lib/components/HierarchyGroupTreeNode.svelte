<script lang="ts">
  import { translations } from '$lib/state.svelte';
  export let name: string;
  export let hierarchyName: string;
  export let selected: string;
  export let children: { name: string; children: any[] }[];
  export let onSelect: (name: string) => void;
  export let depth = 0;

  // Display-only name stripping — see docs/pm-frontend-reference.md.
  $: suffixPattern = new RegExp(` ${hierarchyName}$`);
  $: displayName = name.replace(suffixPattern, '');
</script>

<div class="node" style="padding-left: {depth * 1.1}rem">
  <button type="button" class="node-btn" class:active={selected === name} onclick={() => onSelect(name)}>
    {displayName}
  </button>
</div>
{#each children as child (child.name)}
  <svelte:self name={translations.current[child.name] ?? child.name} {hierarchyName} {selected} children={child.children} {onSelect} depth={depth + 1} />
{/each}

<style>
  .node {
    display: flex;
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
</style>
