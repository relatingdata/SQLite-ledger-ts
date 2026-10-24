<script lang="ts">
  import { onMount } from 'svelte';
  import { getStockOutRiskReport, ApiError, type StockOutRiskRow } from '$lib/api';
  import { translations } from '$lib/state.svelte';

  let rows: StockOutRiskRow[] = [];
  let loading = true;
  let error = '';

  onMount(async () => {
    try {
      rows = await getStockOutRiskReport(2);
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head><title>{translations.current['Stock-Out Risk'] ?? 'Stock-Out Risk'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Stock-Out Risk'] ?? 'Stock-Out Risk'}</legend>
  <p class="intro">{translations.current['Every item genuinely on track to run out before a fresh order, placed today, could arrive — based on real, recent consumption and the shortest known provider lead time, not just a fixed reorder threshold.'] ?? 'Every item genuinely on track to run out before a fresh order, placed today, could arrive — based on real, recent consumption and the shortest known provider lead time, not just a fixed reorder threshold.'}</p>
{#if loading}
  <p>Loading…</p>
{:else if error}
  <p class="error">{error}</p>
{:else}
  <div class="grid-box">
    <table>
      <thead>
        <tr>
          <th>{translations.current['Item'] ?? 'Item'}</th>
          <th>{translations.current['Locations'] ?? 'Location'}</th>
          <th class="num">{translations.current['On hand'] ?? 'On hand'}</th>
          <th class="num">{translations.current['Daily use'] ?? 'Daily use'}</th>
          <th class="num">{translations.current['Days left'] ?? 'Days left'}</th>
          <th class="num">{translations.current['Lead time (days)'] ?? 'Lead time (days)'}</th>
        </tr>
      </thead>
      <tbody>
        {#if rows.length === 0}
          <tr><td colspan="6" class="empty">{translations.current['Nothing is genuinely at risk of running out right now.'] ?? 'Nothing is genuinely at risk of running out right now.'}</td></tr>
        {/if}
        {#each rows as row}
          <tr class="critical">
            <td>{row.item}</td>
            <td>{row.location}</td>
            <td class="num mono">{row.quantity_on_hand}</td>
            <td class="num mono">{row.daily_consumption_rate.toFixed(1)}</td>
            <td class="num mono">{row.days_until_stockout?.toFixed(1) ?? ''}</td>
            <td class="num mono">{row.shortest_lead_time_days ?? ''}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

</fieldset>
<style>
.grid-box {
    border: 1px solid var(--rule-strong);
    border-radius: 8px;
    overflow: hidden;
  }
  .grid-box th,
  .grid-box td {
    padding: 0.5rem 0.7rem;
    text-align: left;
    border-bottom: 1px solid var(--rule);
  }
  .empty {
    text-align: center;
    color: var(--ink-soft);
  }
  tr.critical td {
    color: var(--debit);
  }
</style>
