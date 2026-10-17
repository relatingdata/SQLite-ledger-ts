<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { translations } from '$lib/state.svelte';
  import type { ProfitAndLossByGroupNode } from '$lib/api';
  import ProfitAndLossTable from '$lib/components/ProfitAndLossTable.svelte';

  export let node: ProfitAndLossByGroupNode;
  export let hierarchyName: string;
  export let depth = 0;

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');
  let open = false;
  $: suffixPattern = new RegExp(` ${hierarchyName}$`);
</script>

<div class="group-section" style="margin-left: {depth * 1.2}rem">
  <button type="button" class="group-head" class:open onclick={() => (open = !open)}>
    <span class="disclosure">{open ? '▾' : '▸'}</span>
    <span class="group-name">{node.group?.replace(suffixPattern, '') ?? (translations.current['(No group)'] ?? '(No group)')}</span>
    <span class="group-figures">
      <span class:negative={node.profitAndLoss.net_income_minor < 0}>{node.profitAndLoss.net_income_minor < 0 ? `(${fmt(-node.profitAndLoss.net_income_minor)})` : fmt(node.profitAndLoss.net_income_minor)}</span>
    </span>
  </button>
  {#if open}
    <div class="group-body">
      {#if node.profitAndLoss.total_income_minor !== 0 || node.profitAndLoss.total_expenses_minor !== 0}
        <ProfitAndLossTable pl={node.profitAndLoss} />
      {/if}
      {#each node.children as child}
        <svelte:self node={child} {hierarchyName} depth={depth + 1} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .group-section {
    border-bottom: 1px solid var(--rule);
  }

  .group-head {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.6rem 0.2rem;
    text-align: left;
    font-size: var(--font-size-medium);
    font-family: inherit;
  }

  .group-head:hover {
    background: var(--paper-dim, #f2ede1);
  }

  .disclosure {
    display: inline-block;
    width: 1rem;
    color: var(--ink-soft);
  }

  .group-name {
    flex: 1;
    font-weight: 600;
  }

  .group-figures {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .group-figures .negative {
    color: var(--debit);
  }

  .group-body {
    padding: 0 0.2rem 0.8rem 1.6rem;
  }
</style>
