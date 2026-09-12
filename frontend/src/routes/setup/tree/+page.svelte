<script lang="ts">
  import { onMount } from 'svelte';
  import { Tree, type LTreeNode } from '@keenmate/svelte-treeview';
  import { getEntityTree, ApiError, type EntityNode } from '$lib/api';
  import { toTreePaths, type TreeItem } from '$lib/treeAdapter';
  import { auth } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { translations } from '$lib/state.svelte';

  let treeData: TreeItem[] = [];
  let loading = true;
  let error = '';

  onMount(async () => {
    try {
      const entities: EntityNode[] = await getEntityTree();
      treeData = toTreePaths(entities);
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  });

  function minorUnitsToStr(minorUnits: number | null): string {
    if (minorUnits == null) return '';
    return formatAmount(minorUnits, auth.current?.user.number_format ?? '1 000.00');
  }
</script>

<svelte:head><title>{translations.current['Entity Tree'] ?? 'Entity Tree'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Entity Tree'] ?? 'Entity Tree'}</legend>
  <p class="intro">
    {@html translations.current['Every entity in the system, in hierarchy order — the whole application (chart of accounts, business reports, languages, vocabulary, businesses/ledgers) is one tree, walked here directly from <code>parent_id</code>.'] ?? 'Every entity in the system, in hierarchy order — the whole application (chart of accounts, business reports, languages, vocabulary, businesses/ledgers) is one tree, walked here directly from <code>parent_id</code>.'}
  </p>
{#if loading}
  <p>Loading…</p>
{:else if error}
  <p class="error">{error}</p>
{:else}
  <div class="card tree-card">
    <Tree
      data={treeData}
      idMember="path"
      pathMember="path"
      displayValueMember="name"
    >
      {#snippet nodeTemplate(node: LTreeNode<TreeItem>)}
        {#if node.data}
          <span class="node-label">{translations.current[node.data.name] ?? node.data.name}</span>
          {#if node.data.accountnumber}
            <span class="mono account-tag">{node.data.accountnumber}</span>
          {/if}
          {#if node.data.balance_minor != null && node.data.balance_minor !== 0}
            <span
              class="mono balance-tag"
              class:amount-debit={node.data.balance_minor > 0}
              class:amount-credit={node.data.balance_minor < 0}
            >
              {minorUnitsToStr(node.data.balance_minor)}
            </span>
          {/if}
        {/if}
      {/snippet}
    </Tree>
  </div>
{/if}

</fieldset>
<style>

  .tree-card {
    padding: 1rem 1.2rem;
  }

  .node-label {
    margin-right: 0.6rem;
  }

  .account-tag {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    margin-right: 0.6rem;
  }

  .balance-tag {
    font-size: var(--font-size-small);
  }

  :global(.intro code) {
    font-family: var(--font-mono);
    background: var(--rule);
    padding: 0.1em 0.35em;
    border-radius: 3px;
  }
</style>
