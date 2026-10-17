<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/state.svelte';
  import { session } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { translations } from '$lib/state.svelte';
  import FromToDateFields from '$lib/components/FromToDateFields.svelte';
  import { getSalesCogsMatrix, MatrixApiError, type SalesCogsMatrix, type MatrixAxis } from '$lib/matrix-api';
  import { getHierarchy } from '$lib/api';

  // A business's own further, chosen hierarchies (e.g. "Division") are
  // never hardcoded here — they're read live from the business's own
  // Hierarchy configuration below, whatever real names it actually
  // chose. Location and any such further hierarchy are genuinely the
  // same, one real hierarchy (Location Categorization) at two
  // different levels of grain; the exact, same is true of Category and
  // Product (Product Categorization). Crossing a hierarchy against its
  // own other level ("Division x Location", "Category x Product") is
  // genuinely redundant — see the identical, fuller comment in New New
  // P&L.
  let furtherHierarchies: MatrixAxis[] = [];
  $: locationHierarchy = ['Location', ...furtherHierarchies] as MatrixAxis[];
  const PRODUCT_HIERARCHY: MatrixAxis[] = ['Category', 'Product'];
  $: axes = ['Product', 'Category', ...locationHierarchy, 'Consolidated'] as MatrixAxis[];
  function opposingHierarchyAxes(axis: MatrixAxis): MatrixAxis[] {
    if (locationHierarchy.includes(axis)) return ['Consolidated', ...PRODUCT_HIERARCHY];
    if (PRODUCT_HIERARCHY.includes(axis)) return ['Consolidated', ...locationHierarchy];
    return axes;
  }
  $: allowedColAxes = opposingHierarchyAxes(rowAxis);
  $: allowedRowAxes = opposingHierarchyAxes(colAxis);

  let rowAxis: MatrixAxis = 'Product';
  let colAxis: MatrixAxis = 'Location';
  let fromDate = '';
  let toDate = '';
  let matrix: SalesCogsMatrix | null = null;
  let loading = true;
  let error = '';

  let latestRequestId = 0;
  function onRowChange() {
    if (colAxis !== 'Consolidated' && !opposingHierarchyAxes(rowAxis).includes(colAxis)) colAxis = 'Consolidated';
    load();
  }
  function onColChange() {
    if (rowAxis !== 'Consolidated' && !opposingHierarchyAxes(colAxis).includes(rowAxis)) rowAxis = 'Consolidated';
    load();
  }
  async function load() {
    if (!session.current) return;
    const requestId = ++latestRequestId;
    loading = true;
    error = '';
    try {
      const result = await getSalesCogsMatrix(session.current.businessName, session.current.ledgerName, rowAxis, colAxis, fromDate || undefined, toDate || undefined);
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
        furtherHierarchies = hierarchy.map((h) => h.grouping) as MatrixAxis[];
      } catch {
        /* the axis dropdowns still work with just Product/Category/Location if this fails — further, business-chosen hierarchies are an addition, not a requirement */
      }
    }
    await load();
  });

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');

  // Build the real, distinct row and column keys, each sorted, and a
  // real, direct lookup from (row, col) to its own real cell — the
  // standard, real pivot-table shape.
  $: rowKeys = matrix ? [...new Set(matrix.cells.map((c) => c.rowKey))].sort() : [];
  $: colKeys = matrix ? [...new Set(matrix.cells.map((c) => c.colKey))].sort() : [];
  $: cellLookup = matrix ? new Map(matrix.cells.map((c) => [`${c.rowKey}\u0000${c.colKey}`, c])) : new Map();

  function cellFor(rowKey: string, colKey: string) {
    return cellLookup.get(`${rowKey}\u0000${colKey}`);
  }

  function rowTotals(rowKey: string): { sales: number; cogs: number } {
    let sales = 0;
    let cogs = 0;
    for (const colKey of colKeys) {
      const cell = cellFor(rowKey, colKey);
      if (cell) {
        sales += cell.salesMinor;
        cogs += cell.cogsMinor;
      }
    }
    return { sales, cogs };
  }
</script>

<svelte:head><title>{translations.current['New P&L (Matrix)'] ?? 'New P&L (Matrix)'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['New P&L (Matrix)'] ?? 'New P&L (Matrix)'}</legend>
  <p class="intro">
    {translations.current['A real, two-axis Sales vs. COGS report. Pick what each axis breaks down by — Product, Category, Location, any further hierarchy this business has set up, or Consolidated (no breakdown at all) — for any real combination, from the single, most-granular Product-by-Location matrix down to one, single, Consolidated number.'] ??
      'A real, two-axis Sales vs. COGS report. Pick what each axis breaks down by — Product, Category, Location, any further hierarchy this business has set up, or Consolidated (no breakdown at all) — for any real combination, from the single, most-granular Product-by-Location matrix down to one, single, Consolidated number.'}
  </p>
<div class="controls">
  <fieldset>
    <legend>{translations.current['Rows'] ?? 'Rows'}</legend>
    <select bind:value={rowAxis} onchange={onRowChange}>
      {#each allowedRowAxes as axis}
        <option value={axis}>{axis}</option>
      {/each}
    </select>
  </fieldset>
  <fieldset>
    <legend>{translations.current['Columns'] ?? 'Columns'}</legend>
    <select bind:value={colAxis} onchange={onColChange}>
      {#each allowedColAxes as axis}
        <option value={axis}>{axis}</option>
      {/each}
    </select>
  </fieldset>
  <FromToDateFields bind:fromDate bind:toDate onchange={load} />
  {#if fromDate || toDate}
    <button class="link" onclick={() => { fromDate = ''; toDate = ''; load(); }}>{translations.current['Clear (show all time)'] ?? 'Clear (show all time)'}</button>
  {/if}
</div>

{#if loading}
  <p class="center-text">Loading…</p>
{:else if error}
  <p class="error center-text">{error}</p>
{:else if matrix}
  <div class="summary-card">
    <div><span class="summary-label">{translations.current['Total Sales'] ?? 'Total Sales'}</span><span class="summary-value">{fmt(matrix.totalSalesMinor)}</span></div>
    <div><span class="summary-label">{translations.current['Total COGS'] ?? 'Total COGS'}</span><span class="summary-value">{fmt(matrix.totalCogsMinor)}</span></div>
    <div class="gross"><span class="summary-label">{translations.current['Gross Margin'] ?? 'Gross Margin'}</span><span class="summary-value">{fmt(matrix.totalSalesMinor - matrix.totalCogsMinor)}</span></div>
  </div>

  {#if rowKeys.length === 0}
    <p class="empty">{translations.current['No real activity for this combination.'] ?? 'No real activity for this combination.'}</p>
  {:else}
    <div class="matrix-wrap">
      <table>
        <thead>
          <tr>
            <th class="row-header-cell">{rowAxis}</th>
            {#each colKeys as colKey}
              <th class="col-header" colspan="2">{colKey}</th>
            {/each}
            <th class="col-header total-col" colspan="2">{translations.current['Total'] ?? 'Total'}</th>
          </tr>
          <tr class="subheader">
            <th></th>
            {#each colKeys as _}
              <th class="num">{translations.current['Sales'] ?? 'Sales'}</th>
              <th class="num">{translations.current['COGS'] ?? 'COGS'}</th>
            {/each}
            <th class="num total-col">{translations.current['Sales'] ?? 'Sales'}</th>
            <th class="num total-col">{translations.current['COGS'] ?? 'COGS'}</th>
          </tr>
        </thead>
        <tbody>
          {#each rowKeys as rowKey}
            {@const totals = rowTotals(rowKey)}
            <tr>
              <td class="row-header-cell">{rowKey}</td>
              {#each colKeys as colKey}
                {@const cell = cellFor(rowKey, colKey)}
                <td class="num mono">{cell && cell.salesMinor !== 0 ? fmt(cell.salesMinor) : ''}</td>
                <td class="num mono cogs">{cell && cell.cogsMinor !== 0 ? fmt(cell.cogsMinor) : ''}</td>
              {/each}
              <td class="num mono total-col"><strong>{fmt(totals.sales)}</strong></td>
              <td class="num mono cogs total-col"><strong>{fmt(totals.cogs)}</strong></td>
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
    margin: 0 auto 1rem;
  }
  .controls {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 1.2rem;
    flex-wrap: wrap;
  }
  .link {
    background: none;
    border: none;
    color: var(--brass-dark);
    text-decoration: underline;
    cursor: pointer;
    font-size: var(--font-size-base);
    padding: 0.4rem 0;
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
  .gross .summary-value {
    color: var(--brass-dark);
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
  .cogs {
    color: var(--debit, #b1442e);
  }
  .total-col {
    border-left: 2px solid var(--ink);
  }
</style>
