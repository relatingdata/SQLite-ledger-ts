<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/state.svelte';
  import { session } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import FromToDateFields from '$lib/components/FromToDateFields.svelte';
  import { translations } from '$lib/state.svelte';
  import { getProfitAndLossByAxis, getAxisValues, MatrixApiError, type ProfitAndLossByAxisNode, type MatrixAxis, type AxisValues } from '$lib/matrix-api';
  import AxisPLNode from '$lib/components/AxisPLNode.svelte';

  // Unified axis dropdown — see docs/pm-frontend-reference.md.
  let outerSelection = $state('Location');
  let innerSelection = $state('Item');

  let axisValues: AxisValues | null = $state(null);
  let fromDate = $state('');
  let toDate = $state('');
  let nodes: ProfitAndLossByAxisNode[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  // Hierarchy-redundancy guard — see docs/pm-frontend-reference.md.
  const ITEM_HIERARCHY: Exclude<MatrixAxis, 'Consolidated'>[] = ['Category', 'Item'];
  let furtherHierarchies = $derived((axisValues ? Object.keys(axisValues).filter((k) => !['Item', 'Category', 'Location'].includes(k)) : []) as Exclude<MatrixAxis, 'Consolidated'>[]);
  let locationHierarchy = $derived(['Location', ...furtherHierarchies] as Exclude<MatrixAxis, 'Consolidated'>[]);
  let groupableAxes = $derived(['Item', 'Category', ...locationHierarchy] as Exclude<MatrixAxis, 'Consolidated'>[]);
  function opposingHierarchyAxes(axis: Exclude<MatrixAxis, 'Consolidated'> | 'Consolidated'): (Exclude<MatrixAxis, 'Consolidated'> | 'Consolidated')[] {
    if (locationHierarchy.includes(axis as never)) return ['Consolidated', ...ITEM_HIERARCHY];
    if (ITEM_HIERARCHY.includes(axis as never)) return ['Consolidated', ...locationHierarchy];
    return ['Consolidated', ...groupableAxes];
  }

  function parseSelection(selection: string): { axis: MatrixAxis; filter?: string } {
    const sepIdx = selection.indexOf('::');
    if (sepIdx === -1) return { axis: selection as MatrixAxis };
    return { axis: selection.slice(0, sepIdx) as MatrixAxis, filter: selection.slice(sepIdx + 2) };
  }

  let latestRequestId = 0;
  async function load() {
    if (!session.current) return;
    const requestId = ++latestRequestId;
    loading = true;
    error = '';
    try {
      const outer = parseSelection(outerSelection);
      const inner = parseSelection(innerSelection);
      const result = await getProfitAndLossByAxis(session.current.businessName, session.current.ledgerName, outer.axis, inner.axis, fromDate || undefined, toDate || undefined, outer.filter, inner.filter);
      if (requestId !== latestRequestId) return;
      nodes = result;
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
        axisValues = await getAxisValues(session.current.businessName, session.current.ledgerName);
      } catch {
        /* the dropdowns still work with just the four, real, group-by headings if this fails — the specific-value lists are a convenience, not a requirement */
      }
    }
    await load();
  });

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');

  let outerAxis = $derived(parseSelection(outerSelection).axis);
  let innerAxis = $derived(parseSelection(innerSelection).axis);
  let allowedInnerAxes = $derived(opposingHierarchyAxes(outerAxis).filter((a): a is Exclude<MatrixAxis, 'Consolidated'> => a !== 'Consolidated'));
  let allowedOuterAxes = $derived(opposingHierarchyAxes(innerAxis).filter((a): a is Exclude<MatrixAxis, 'Consolidated'> => a !== 'Consolidated'));
  let totalProfitLoss = $derived(nodes.reduce((s, n) => s + n.profitAndLoss.net_income_minor, 0));

  // Resets the other grouping to Consolidated on conflict — see docs/pm-frontend-reference.md.
  function onOuterChange() {
    const newOuterAxis = parseSelection(outerSelection).axis;
    const currentInnerAxis = parseSelection(innerSelection).axis;
    if (currentInnerAxis !== 'Consolidated' && !opposingHierarchyAxes(newOuterAxis).includes(currentInnerAxis)) {
      innerSelection = 'Consolidated';
    }
    load();
  }
  function onInnerChange() {
    const newInnerAxis = parseSelection(innerSelection).axis;
    const currentOuterAxis = parseSelection(outerSelection).axis;
    if (currentOuterAxis !== 'Consolidated' && !opposingHierarchyAxes(newInnerAxis).includes(currentOuterAxis)) {
      outerSelection = 'Consolidated';
    }
    load();
  }
</script>

<svelte:head><title>{translations.current['Profit and Loss'] ?? 'Profit and Loss'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Profit and Loss'] ?? 'Profit and Loss'}</legend>
  <p class="intro">
    {translations.current['A real P&L statement, in the same, vertical, drillable layout as the original — but grouped by two, real, independent, nested groupings at once. Pick what each level breaks down by, or narrow either one down to a single, particular value directly.'] ??
      'A real P&L statement, in the same, vertical, drillable layout as the original — but grouped by two, real, independent, nested groupings at once. Pick what each level breaks down by, or narrow either one down to a single, particular value directly.'}
  </p>
<div class="controls">
  <fieldset>
    <legend>{translations.current['Outer grouping'] ?? 'Outer grouping'}</legend>
    <select bind:value={outerSelection} onchange={onOuterChange}>
      <option value="Consolidated">{translations.current['Consolidated'] ?? 'Consolidated'}</option>
      {#each allowedOuterAxes as axis}
        <optgroup label={axis}>
          <option value={axis}>{axis}</option>
          {#if axisValues}
            {#each axisValues[axis] as value}
              <option value={`${axis}::${value}`}>{value}</option>
            {/each}
          {/if}
        </optgroup>
      {/each}
    </select>
  </fieldset>
  <fieldset>
    <legend>{translations.current['Inner grouping'] ?? 'Inner grouping'}</legend>
    <select bind:value={innerSelection} onchange={onInnerChange}>
      <option value="Consolidated">{translations.current['Consolidated'] ?? 'Consolidated'}</option>
      {#each allowedInnerAxes as axis}
        <optgroup label={axis}>
          <option value={axis}>{axis}</option>
          {#if axisValues}
            {#each axisValues[axis] as value}
              <option value={`${axis}::${value}`}>{value}</option>
            {/each}
          {/if}
        </optgroup>
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
{:else}
  <div class="report-wrap">
    <div class="report card">
      <div class="title-block">
        <p class="title-line">{translations.current['Profit and Loss for:'] ?? 'Profit and Loss for:'}</p>
        <p class="title-line company">{session.current?.businessName ?? ''}</p>
      </div>
      {#if nodes.length === 0}
        <p class="empty">{translations.current['No real activity for this combination.'] ?? 'No real activity for this combination.'}</p>
      {:else}
        {#if outerAxis === 'Consolidated'}
          <!-- A real, single Consolidated outer grouping renders its
               own drill-down table directly, with no real, extra,
               redundant "Consolidated" click-to-expand wrapper around
               the one, only real section there could ever be. -->
          {#each nodes as node}
            <AxisPLNode {node} openByDefault={true} />
          {/each}
        {:else}
          {#each nodes as node}
            <AxisPLNode {node} />
          {/each}
        {/if}
        <div class="grand-total" class:negative={totalProfitLoss < 0}>
          <span>{translations.current['Total Profit/(Loss)'] ?? 'Total Profit/(Loss)'}</span>
          <span>{totalProfitLoss < 0 ? `(${fmt(-totalProfitLoss)})` : fmt(totalProfitLoss)}</span>
        </div>
      {/if}
    </div>
  </div>
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
    gap: 0.8rem;
    margin-bottom: 1.2rem;
    flex-wrap: wrap;
  }
  select {
    max-width: 220px;
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
  .report-wrap {
    display: flex;
    justify-content: center;
  }
  .report {
    padding: 1.2rem 1.6rem 1.4rem;
    max-width: 720px;
    width: 100%;
  }
  .title-block {
    text-align: center;
    margin-bottom: 1rem;
  }
  .title-line {
    margin: 0.15rem 0;
  }
  .title-line.company {
    font-weight: 700;
    font-size: var(--font-size-large);
  }
  .empty {
    text-align: center;
    color: var(--ink-soft);
    font-style: italic;
  }
  .grand-total {
    display: flex;
    justify-content: space-between;
    padding: 0.8rem 0.2rem 0.2rem;
    margin-top: 0.4rem;
    border-top: 2px solid var(--ink);
    font-weight: 700;
    font-size: var(--font-size-large);
    font-variant-numeric: tabular-nums;
  }
  .grand-total.negative {
    color: var(--debit);
  }
</style>
