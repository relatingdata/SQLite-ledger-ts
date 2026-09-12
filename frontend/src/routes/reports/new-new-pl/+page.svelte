<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/state.svelte';
  import { session } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { translations } from '$lib/state.svelte';
  import FromToDateFields from '$lib/components/FromToDateFields.svelte';
  import { getProfitAndLossByAxis, getAxisValues, MatrixApiError, type ProfitAndLossByAxisNode, type MatrixAxis, type AxisValues } from '$lib/matrix-api';
  import AxisPLNode from '$lib/components/AxisPLNode.svelte';

  const GROUPABLE_AXES: Exclude<MatrixAxis, 'Consolidated'>[] = ['Product', 'Category', 'Location', 'Division'];

  // Division and Location are genuinely the same, one real hierarchy —
  // Location Categorization — at two different levels of grain (a
  // division is a real, coarser grouping of locations; a location is
  // that same hierarchy's own finest, individual leaf). The exact,
  // same is true of Category and Product — Product Categorization.
  // Crossing a hierarchy against its own other level ("Division v
  // Location", "Category v Product") is genuinely redundant, not a
  // real, second, independent dimension — it's the same grouping
  // crossed against itself. A real, meaningful two-axis breakdown
  // crosses one, real, whole hierarchy against the other: Division or
  // Location (how a real sale is grouped by where it happened) against
  // Category or Product (what was actually sold) — always makes real
  // sense, in any combination, including any drill-down within each.
  const LOCATION_HIERARCHY: Exclude<MatrixAxis, 'Consolidated'>[] = ['Division', 'Location'];
  const PRODUCT_HIERARCHY: Exclude<MatrixAxis, 'Consolidated'>[] = ['Category', 'Product'];
  function opposingHierarchyAxes(axis: Exclude<MatrixAxis, 'Consolidated'> | 'Consolidated'): (Exclude<MatrixAxis, 'Consolidated'> | 'Consolidated')[] {
    if (LOCATION_HIERARCHY.includes(axis as never)) return ['Consolidated', ...PRODUCT_HIERARCHY];
    if (PRODUCT_HIERARCHY.includes(axis as never)) return ['Consolidated', ...LOCATION_HIERARCHY];
    return ['Consolidated', ...GROUPABLE_AXES];
  }

  // A real, single, unified dropdown per vector — per direct request,
  // "Consolidated" at the top, then each real axis type as its own,
  // real, selectable group-by heading, with every real, specific value
  // within it listed directly beneath, in the same, one dropdown —
  // rather than two, real, separate dropdowns (axis type, then a
  // second, separate "narrow to one value" picker).
  //
  // Each option's own real value is a real, combined string: the axis
  // type alone ("Location") means "group by every real Location";
  // "Location::Riverside Cellars" means "narrow to this one, real,
  // specific value" — still genuinely grouped by Location underneath
  // (so its own real drill-down still shows correctly), just showing
  // only the one, real, chosen branch.
  let outerSelection = 'Division';
  let innerSelection = 'Product';

  let axisValues: AxisValues | null = null;
  let fromDate = '';
  let toDate = '';
  let nodes: ProfitAndLossByAxisNode[] = [];
  let loading = true;
  let error = '';

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

  $: outerAxis = parseSelection(outerSelection).axis;
  $: innerAxis = parseSelection(innerSelection).axis;
  $: allowedInnerAxes = opposingHierarchyAxes(outerAxis).filter((a): a is Exclude<MatrixAxis, 'Consolidated'> => a !== 'Consolidated');
  $: allowedOuterAxes = opposingHierarchyAxes(innerAxis).filter((a): a is Exclude<MatrixAxis, 'Consolidated'> => a !== 'Consolidated');
  $: totalProfitLoss = nodes.reduce((s, n) => s + n.profitAndLoss.net_income_minor, 0);

  // A real, direct guard: if changing one grouping's own hierarchy
  // would leave the other one showing a stale, no-longer-real,
  // available selection (e.g. Outer moves from Location to Category
  // while Inner is still Product — now genuinely the same hierarchy
  // crossed against itself), reset that one to Consolidated rather
  // than silently keeping an invalid, unlisted value selected. A
  // direct function call, not a reactive statement — Svelte correctly
  // rejects the reactive form here as a genuine cyclical dependency
  // (outerAxis depends on outerSelection, which the guard itself
  // would also assign).
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

<svelte:head><title>{translations.current['New New P&L'] ?? 'New New P&L'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['New New P&L'] ?? 'New New P&L'}</legend>
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
