<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import type { ProfitAndLossByAxisNode } from '$lib/matrix-api';
  import ProfitAndLossTable from '$lib/components/ProfitAndLossTable.svelte';
  import AxisPLNode from '$lib/components/AxisPLNode.svelte';

  let {
    node,
    depth = 0,
    openByDefault = false,
  }: {
    node: ProfitAndLossByAxisNode;
    depth?: number;
    openByDefault?: boolean;
  } = $props();

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');
  // Captures openByDefault once, starting state only — see docs/pm-frontend-reference.md.
  // svelte-ignore state_referenced_locally
  let open = $state(openByDefault);
</script>

<div class="axis-section" style="margin-left: {depth * 1.2}rem">
  <button type="button" class="axis-head" class:open onclick={() => (open = !open)}>
    <span class="disclosure">{open ? '▾' : '▸'}</span>
    <span class="axis-name">{node.key}</span>
    <span class="axis-figures">
      <span class:negative={node.profitAndLoss.net_income_minor < 0}>{node.profitAndLoss.net_income_minor < 0 ? `(${fmt(-node.profitAndLoss.net_income_minor)})` : fmt(node.profitAndLoss.net_income_minor)}</span>
    </span>
  </button>
  {#if open}
    <div class="axis-body">
      {#if node.profitAndLoss.total_income_minor !== 0 || node.profitAndLoss.total_expenses_minor !== 0}
        <ProfitAndLossTable pl={node.profitAndLoss} />
      {/if}
      {#each node.children as child}
        <AxisPLNode node={child} depth={depth + 1} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .axis-section {
    border-bottom: 1px solid var(--rule);
  }

  .axis-head {
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

  .axis-head:hover {
    background: var(--paper-dim, #f2ede1);
  }

  .disclosure {
    display: inline-block;
    width: 1rem;
    color: var(--ink-soft);
  }

  .axis-name {
    flex: 1;
    font-weight: 600;
  }

  .axis-figures {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .axis-figures .negative {
    color: var(--debit);
  }

  .axis-body {
    padding: 0 0.2rem 0.8rem 1.6rem;
  }
</style>
