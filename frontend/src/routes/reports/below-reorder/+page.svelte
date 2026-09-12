<script lang="ts">
  import { onMount } from 'svelte';
  import { getBelowReorderStock, ApiError, type BelowReorderRow } from '$lib/api';
  import { translations } from '$lib/state.svelte';

  let rows: BelowReorderRow[] = [];
  let loading = true;
  let error = '';

  onMount(async () => {
    try {
      rows = await getBelowReorderStock();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head><title>{translations.current['Below Reorder'] ?? 'Below Reorder'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Below Reorder'] ?? 'Below Reorder'}</legend>
  <p class="intro">{translations.current['Every item at every location currently at or below its own reorder level — the real trigger for "time to order," distinct from the floor min level, which only says something has already gone wrong.'] ?? 'Every item at every location currently at or below its own reorder level — the real trigger for "time to order," distinct from the floor min level, which only says something has already gone wrong.'}</p>
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
          <th class="num">{translations.current['Reorder Level'] ?? 'Reorder Level'}</th>
          <th class="num">{translations.current['Min'] ?? 'Min'}</th>
          <th class="num">{translations.current['Max'] ?? 'Max'}</th>
        </tr>
      </thead>
      <tbody>
        {#if rows.length === 0}
          <tr><td colspan="6" class="empty">{translations.current['Nothing needs reordering right now.'] ?? 'Nothing needs reordering right now.'}</td></tr>
        {/if}
        {#each rows as row}
          <tr class:critical={row.min_level != null && row.quantity_on_hand <= row.min_level}>
            <td>{row.item}</td>
            <td>{row.location}</td>
            <td class="num mono">{row.quantity_on_hand}</td>
            <td class="num mono">{row.reorder_level}</td>
            <td class="num mono">{row.min_level ?? ''}</td>
            <td class="num mono">{row.max_level ?? ''}</td>
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
