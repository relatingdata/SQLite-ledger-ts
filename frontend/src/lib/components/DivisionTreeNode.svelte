<script lang="ts">
  import { translations } from '$lib/state.svelte';
  export let name: string;
  export let selected: string;
  export let children: { name: string; children: any[] }[];
  export let onSelect: (name: string) => void;
  export let depth = 0;

  // A real, per-location division can never literally share its own
  // location's name (entity names are globally unique — "Head
  // Office" the location already exists), so it's genuinely named
  // "Head Office Division" underneath. That's a real, necessary
  // implementation detail, not something a person picking a division
  // from a dropdown needs to see — stripped here for display only;
  // `name` itself (used for the real selection) is untouched.
  $: displayName = name.replace(/ Division$/, '');
</script>

<div class="node" style="padding-left: {depth * 1.1}rem">
  <button type="button" class="node-btn" class:active={selected === name} onclick={() => onSelect(name)}>
    {displayName}
  </button>
</div>
{#each children as child (child.name)}
  <svelte:self name={translations.current[child.name] ?? child.name} {selected} children={child.children} {onSelect} depth={depth + 1} />
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
