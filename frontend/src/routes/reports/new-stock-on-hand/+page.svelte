<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/state.svelte';
  import { session } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { translations } from '$lib/state.svelte';
  import { getStockOnHandMatrix, MatrixApiError, type StockOnHandMatrix, type MatrixAxis } from '$lib/matrix-api';
  import { getHierarchy } from '$lib/api';

  // Further hierarchies appended live, never hardcoded — see docs/pm-frontend-reference.md.
  let AXES: MatrixAxis[] = $state(['Product', 'Category', 'Location', 'Consolidated']);

  let rowAxis: MatrixAxis = $state('Product');
  let colAxis: MatrixAxis = $state('Location');
  let matrix: StockOnHandMatrix | null = $state(null);
  let loading = $state(true);
  let error = $state('');

  let latestRequestId = 0;
  async function load() {
    const requestId = ++latestRequestId;
    loading = true;
    error = '';
    try {
      const result = await getStockOnHandMatrix(rowAxis, colAxis);
      if (requestId !== latestRequestId) return;
      matrix = result;
    } catch (e) {
      if (requestId !== latestRequestId) return;
      error = e instanceof MatrixApiError ? e.message : 'Failed to load.';
    } finally {
      if (requestId === latestRequestId) loading = false;
    }
  }

  onMount(async () => {
    if (session.current) {
      try {
        const hierarchy = await getHierarchy(session.current.businessName);
        const furtherHierarchies = hierarchy.map((h) => h.grouping) as MatrixAxis[];
        if (furtherHierarchies.length > 0) AXES = ['Product', 'Category', 'Location', ...furtherHierarchies, 'Consolidated'];
      } catch {
        /* the axis dropdowns still work with just Product/Category/Location/Consolidated if this fails — further, business-chosen hierarchies are an addition, not a requirement */
      }
    }
    await load();
  });

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');

  let rowKeys = $derived.by(() => matrix ? [...new Set(matrix.cells.map((c) => c.rowKey))].sort() : []);
  let colKeys = $derived.by(() => matrix ? [...new Set(matrix.cells.map((c) => c.colKey))].sort() : []);
  let cellLookup = $derived.by(() => matrix ? new Map(matrix.cells.map((c) => [`${c.rowKey}\u0000${c.colKey}`, c])) : new Map());

  function cellFor(rowKey: string, colKey: string) {
    return cellLookup.get(`${rowKey}\u0000${colKey}`);
  }

  function rowTotals(rowKey: string): { qty: number; value: number; realizable: number } {
    let qty = 0;
    let value = 0;
    let realizable = 0;
    for (const colKey of colKeys) {
      const cell = cellFor(rowKey, colKey);
      if (cell) {
        qty += cell.quantityBottles;
        value += cell.valueAtCostMinor;
        realizable += cell.realizableValueMinor;
      }
    }
    return { qty, value, realizable };
  }
</script>

<svelte:head><title>{translations.current['New Stock on Hand (Matrix)'] ?? 'New Stock on Hand (Matrix)'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['New Stock on Hand (Matrix)'] ?? 'New Stock on Hand (Matrix)'}</legend>
  <p class="intro">
    {translations.current['The real, same two-axis mechanism as the New P&L report, applied to real, current, on-hand stock — quantity, value at cost, and realizable value at current retail price, instead of Sales vs. COGS.'] ??
      'The real, same two-axis mechanism as the New P&L report, applied to real, current, on-hand stock — quantity, value at cost, and realizable value at current retail price, instead of Sales vs. COGS.'}
  </p>
  <p class="caveat">
    {translations.current['Cost shown is the preferred vendor\u2019s own current price per unit \u2014 not a real, tracked historical average, since no such figure exists yet on a per-item basis.'] ??
      "Cost shown is the preferred vendor's own current price per unit — not a real, tracked historical average, since no such figure exists yet on a per-item basis."}
  </p>
<div class="controls">
  <fieldset>
    <legend>{translations.current['Rows'] ?? 'Rows'}</legend>
    <select bind:value={rowAxis} onchange={load}>
      {#each AXES as axis}
        <option value={axis}>{axis}</option>
      {/each}
    </select>
  </fieldset>
  <fieldset>
    <legend>{translations.current['Columns'] ?? 'Columns'}</legend>
    <select bind:value={colAxis} onchange={load}>
      {#each AXES as axis}
        <option value={axis}>{axis}</option>
      {/each}
    </select>
  </fieldset>
</div>

{#if loading}
  <p class="center-text">Loading…</p>
{:else if error}
  <p class="error center-text">{error}</p>
{:else if matrix}
  <div class="summary-card">
    <div><span class="summary-label">{translations.current['Total Value at Cost'] ?? 'Total Value at Cost'}</span><span class="summary-value">{fmt(matrix.totalValueAtCostMinor)}</span></div>
    <div><span class="summary-label">{translations.current['Total Realizable Value'] ?? 'Total Realizable Value'}</span><span class="summary-value">{fmt(matrix.totalRealizableValueMinor)}</span></div>
  </div>

  {#if rowKeys.length === 0}
    <p class="empty">{translations.current['No real stock on hand for this combination.'] ?? 'No real stock on hand for this combination.'}</p>
  {:else}
    <div class="matrix-wrap">
      <table>
        <thead>
          <tr>
            <th class="row-header-cell">{rowAxis}</th>
            {#each colKeys as colKey}
              <th class="col-header" colspan="4">{colKey}</th>
            {/each}
            <th class="col-header total-col" colspan="3">{translations.current['Total'] ?? 'Total'}</th>
          </tr>
          <tr class="subheader">
            <th></th>
            {#each colKeys as _}
              <th class="num">{translations.current['Qty'] ?? 'Qty'}</th>
              <th class="num">{translations.current['Cost/unit'] ?? 'Cost/unit'}</th>
              <th class="num">{translations.current['Value'] ?? 'Value'}</th>
              <th class="num">{translations.current['Realizable'] ?? 'Realizable'}</th>
            {/each}
            <th class="num total-col">{translations.current['Qty'] ?? 'Qty'}</th>
            <th class="num total-col">{translations.current['Value'] ?? 'Value'}</th>
            <th class="num total-col">{translations.current['Realizable'] ?? 'Realizable'}</th>
          </tr>
        </thead>
        <tbody>
          {#each rowKeys as rowKey}
            {@const totals = rowTotals(rowKey)}
            <tr>
              <td class="row-header-cell">{rowKey}</td>
              {#each colKeys as colKey}
                {@const cell = cellFor(rowKey, colKey)}
                <td class="num mono">{cell && cell.quantityBottles !== 0 ? cell.quantityBottles : ''}</td>
                <td class="num mono">{cell?.lastCostMinor ? fmt(cell.lastCostMinor) : ''}</td>
                <td class="num mono">{cell && cell.valueAtCostMinor !== 0 ? fmt(cell.valueAtCostMinor) : ''}</td>
                <td class="num mono realizable">{cell && cell.realizableValueMinor !== 0 ? fmt(cell.realizableValueMinor) : ''}</td>
              {/each}
              <td class="num mono total-col"><strong>{totals.qty}</strong></td>
              <td class="num mono total-col"><strong>{fmt(totals.value)}</strong></td>
              <td class="num mono realizable total-col"><strong>{fmt(totals.realizable)}</strong></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{/if}

</fieldset>
<style>
  .center-text {
    text-align: center;
  }
  .intro {
    max-width: 80ch;
    margin: 0 auto 0.4rem;
  }
  .caveat {
    max-width: 80ch;
    margin: 0 auto 1rem;
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    font-style: italic;
  }
  .controls {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 1.2rem;
    flex-wrap: wrap;
  }
  .summary-card {
    display: flex;
    justify-content: center;
    gap: 2rem;
    background: var(--paper-dim, #f2ede1);
    border-radius: 6px;
    padding: 0.8rem 1.2rem;
    margin: 0 auto 1.2rem;
    max-width: 700px;
  }
  .summary-card div {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .summary-label {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .summary-value {
    font-weight: 700;
    font-size: var(--font-size-large);
    font-variant-numeric: tabular-nums;
  }
  .empty {
    text-align: center;
    color: var(--ink-soft);
    font-style: italic;
  }
  .matrix-wrap {
    overflow-x: auto;
    max-width: 100%;
  }
  table {
    border-collapse: collapse;
    margin: 0 auto;
    font-size: var(--font-size-base);
  }
  th,
  td {
    padding: 0.35rem 0.6rem;
    border-bottom: 1px solid var(--rule);
    white-space: nowrap;
  }
  .row-header-cell {
    text-align: left;
    font-weight: 600;
    position: sticky;
    left: 0;
    background: var(--paper);
  }
  .col-header {
    text-align: center;
    border-bottom: 1px solid var(--rule-strong);
    font-weight: 700;
  }
  .subheader th {
    font-weight: 400;
    color: var(--ink-soft);
    font-size: var(--font-size-small);
    border-bottom: 2px solid var(--ink);
  }
  .num {
    text-align: right;
  }
  .mono {
    font-variant-numeric: tabular-nums;
  }
  .realizable {
    color: var(--brass-dark);
  }
  .total-col {
    border-left: 2px solid var(--ink);
  }
</style>
