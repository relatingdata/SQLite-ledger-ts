<script lang="ts">
  import { onMount } from 'svelte';
  import { flip } from 'svelte/animate';
  import { dndzone, type DndEvent } from 'svelte-dnd-action';
  import { auth } from '$lib/state.svelte';
  import { session } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { translations } from '$lib/state.svelte';
  import FromToDateFields from '$lib/components/FromToDateFields.svelte';
  import { getProfitAndLossByAxis, getAxisValues, MatrixApiError, type ProfitAndLossByAxisNode, type MatrixAxis, type AxisValues } from '$lib/matrix-api';
  import AxisPLNode from '$lib/components/AxisPLNode.svelte';

  // Per docs/pl-pivot-builder-dnd-plan.md: the exact, same, real,
  // existing opposingHierarchyAxes constraint new-new-pl already
  // enforces via its own two dropdowns - Division/Location are the
  // exact, same, real hierarchy at two different grains, and so are
  // Category/Product, so crossing either against its own other level
  // is genuinely redundant, never a real, second, independent axis.
  type GroupableAxis = Exclude<MatrixAxis, 'Consolidated'>;
  const LOCATION_HIERARCHY: GroupableAxis[] = ['Division', 'Location'];
  const PRODUCT_HIERARCHY: GroupableAxis[] = ['Category', 'Product'];
  function opposingHierarchyAxes(axis: GroupableAxis): GroupableAxis[] {
    if (LOCATION_HIERARCHY.includes(axis)) return PRODUCT_HIERARCHY;
    if (PRODUCT_HIERARCHY.includes(axis)) return LOCATION_HIERARCHY;
    return [...LOCATION_HIERARCHY, ...PRODUCT_HIERARCHY];
  }

  interface Chip { id: GroupableAxis; axis: GroupableAxis; }
  const ALL_CHIPS: Chip[] = (['Division', 'Location', 'Category', 'Product'] as GroupableAxis[]).map((axis) => ({ id: axis, axis }));

  let trayChips: Chip[] = [...ALL_CHIPS];
  let rowChips: Chip[] = [];
  let colChips: Chip[] = [];
  // A real, direct, per-zone narrowing value ("this whole axis" vs
  // "just this one, specific value within it") - attached to the
  // zone itself once it holds a real chip, per the plan's own,
  // stated design, rather than a separate, disconnected control.
  let rowFilter = '';
  let colFilter = '';

  $: rowAxis = (rowChips[0]?.axis ?? 'Consolidated') as MatrixAxis;
  $: colAxis = (colChips[0]?.axis ?? 'Consolidated') as MatrixAxis;

  let axisValues: AxisValues | null = null;
  let fromDate = '';
  let toDate = '';
  let nodes: ProfitAndLossByAxisNode[] = [];
  let loading = true;
  let error = '';
  let rejectedFlash: 'row' | 'col' | null = null;

  const flipDurationMs = 220;

  function flashReject(zone: 'row' | 'col') {
    rejectedFlash = zone;
    setTimeout(() => { if (rejectedFlash === zone) rejectedFlash = null; }, 500);
  }

  function considerTray(e: CustomEvent<DndEvent<Chip>>) { trayChips = e.detail.items; }
  function finalizeTray(e: CustomEvent<DndEvent<Chip>>) { trayChips = e.detail.items; }

  function considerZone(zone: 'row' | 'col', e: CustomEvent<DndEvent<Chip>>) {
    if (zone === 'row') rowChips = e.detail.items;
    else colChips = e.detail.items;
  }

  function finalizeZone(zone: 'row' | 'col', e: CustomEvent<DndEvent<Chip>>) {
    let items = e.detail.items;
    // A real drop zone holds exactly one real axis at a time — a
    // second chip landing here bumps the zone's own, real, prior
    // occupant straight back to the tray, rather than allowing two.
    if (items.length > 1) {
      const kept = items[items.length - 1];
      const bumped = items.filter((c) => c.id !== kept.id);
      trayChips = [...trayChips, ...bumped];
      items = [kept];
    }
    const opposing = zone === 'row' ? colAxis : rowAxis;
    if (items[0] && opposing !== 'Consolidated' && !opposingHierarchyAxes(items[0].axis).includes(opposing as GroupableAxis)) {
      // A real, redundant, same-hierarchy crossing — the chip
      // visibly, immediately returns to the tray instead of silently
      // producing a self-crossed, meaningless report.
      trayChips = [...trayChips, items[0]];
      items = [];
      flashReject(zone);
    }
    if (zone === 'row') { rowChips = items; if (items.length === 0) rowFilter = ''; }
    else { colChips = items; if (items.length === 0) colFilter = ''; }
    load();
  }

  let latestRequestId = 0;
  async function load() {
    if (!session.current) return;
    const requestId = ++latestRequestId;
    loading = true;
    error = '';
    try {
      const result = await getProfitAndLossByAxis(
        session.current.businessName,
        session.current.ledgerName,
        rowAxis,
        colAxis,
        fromDate || undefined,
        toDate || undefined,
        rowFilter || undefined,
        colFilter || undefined
      );
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
        /* the zones still work with just the four, real, groupable axes if this fails — the specific-value narrowing is a convenience, not a requirement */
      }
    }
    await load();
  });

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');
  $: totalProfitLoss = nodes.reduce((s, n) => s + n.profitAndLoss.net_income_minor, 0);
</script>

<svelte:head><title>{translations.current['P&L Pivot Builder'] ?? 'P&L Pivot Builder'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['P&L Pivot Builder'] ?? 'P&L Pivot Builder'}</legend>
  <p class="intro">
    {translations.current['The same, real, two-axis P&L breakdown as New New P&L — drag a field into Rows or Columns instead of picking it from a list. An empty zone means Consolidated.'] ??
      'The same, real, two-axis P&L breakdown as New New P&L — drag a field into Rows or Columns instead of picking it from a list. An empty zone means Consolidated.'}
  </p>

  <div class="builder">
    <div class="tray-block">
      <p class="zone-label">{translations.current['Available fields'] ?? 'Available fields'}</p>
      <div class="tray" use:dndzone={{ items: trayChips, flipDurationMs, dropTargetStyle: {} }} onconsider={considerTray} onfinalize={finalizeTray}>
        {#each trayChips as chip (chip.id)}
          <div class="chip" animate:flip={{ duration: flipDurationMs }}>{chip.axis}</div>
        {/each}
        {#if trayChips.length === 0}<p class="tray-empty">{translations.current['All fields placed'] ?? 'All fields placed'}</p>{/if}
      </div>
    </div>

    <div class="zones">
      <div class="zone-block">
        <p class="zone-label">{translations.current['Rows'] ?? 'Rows'}</p>
        <div
          class="zone"
          class:rejected={rejectedFlash === 'row'}
          use:dndzone={{ items: rowChips, flipDurationMs, dropTargetStyle: {} }}
          onconsider={(e) => considerZone('row', e)}
          onfinalize={(e) => finalizeZone('row', e)}
        >
          {#each rowChips as chip (chip.id)}
            <div class="chip placed" animate:flip={{ duration: flipDurationMs }}>{chip.axis}</div>
          {/each}
          {#if rowChips.length === 0}<p class="zone-empty">{translations.current['Consolidated'] ?? 'Consolidated'}</p>{/if}
        </div>
        {#if rowChips[0] && axisValues}
          <select class="narrow" bind:value={rowFilter} onchange={load}>
            <option value="">{translations.current['Every'] ?? 'Every'} {rowChips[0].axis}</option>
            {#each axisValues[rowChips[0].axis] as value}<option value={value}>{value}</option>{/each}
          </select>
        {/if}
      </div>

      <div class="zone-block">
        <p class="zone-label">{translations.current['Columns'] ?? 'Columns'}</p>
        <div
          class="zone"
          class:rejected={rejectedFlash === 'col'}
          use:dndzone={{ items: colChips, flipDurationMs, dropTargetStyle: {} }}
          onconsider={(e) => considerZone('col', e)}
          onfinalize={(e) => finalizeZone('col', e)}
        >
          {#each colChips as chip (chip.id)}
            <div class="chip placed" animate:flip={{ duration: flipDurationMs }}>{chip.axis}</div>
          {/each}
          {#if colChips.length === 0}<p class="zone-empty">{translations.current['Consolidated'] ?? 'Consolidated'}</p>{/if}
        </div>
        {#if colChips[0] && axisValues}
          <select class="narrow" bind:value={colFilter} onchange={load}>
            <option value="">{translations.current['Every'] ?? 'Every'} {colChips[0].axis}</option>
            {#each axisValues[colChips[0].axis] as value}<option value={value}>{value}</option>{/each}
          </select>
        {/if}
      </div>
    </div>
  </div>

  <div class="controls">
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
          {#if rowAxis === 'Consolidated'}
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
  .center-text { text-align: center; }
  .intro { max-width: 80ch; margin: 0 auto 1rem; }

  .builder {
    display: flex;
    justify-content: center;
    gap: 1.2rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }
  .zone-label {
    margin: 0 0 0.3rem;
    font-size: var(--font-size-small, 0.85rem);
    color: var(--ink-soft);
  }
  .tray-block { min-width: 220px; }
  .tray {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    min-height: 3rem;
    padding: 0.6rem;
    border: 1px dashed var(--brass);
    border-radius: 4px;
    background: var(--paper-dim, #f2ede1);
  }
  .tray-empty, .zone-empty {
    margin: 0;
    padding: 0.3rem 0;
    color: var(--ink-faint, #888);
    font-style: italic;
  }
  .zones {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .zone-block { min-width: 180px; }
  .zone {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    min-height: 3rem;
    padding: 0.6rem;
    border: 2px solid var(--brass);
    border-radius: 4px;
    background: var(--paper);
    transition: border-color 0.2s, background 0.2s;
  }
  .zone.rejected {
    border-color: #b5453b;
    background: #fbeceb;
  }
  .chip {
    padding: 0.4rem 0.8rem;
    border-radius: 3px;
    background: var(--paper);
    border: 1px solid var(--brass-dark);
    color: var(--ink);
    cursor: grab;
    user-select: none;
    font-size: var(--font-size-base);
  }
  .chip.placed {
    background: var(--brass);
    color: var(--paper);
    font-weight: 600;
  }
  .narrow {
    margin-top: 0.4rem;
    max-width: 100%;
  }

  .controls {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 0.8rem;
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
  .report-wrap { display: flex; justify-content: center; }
  .report { padding: 1.2rem 1.6rem 1.4rem; max-width: 720px; width: 100%; }
  .title-block { text-align: center; margin-bottom: 1rem; }
  .title-line { margin: 0.15rem 0; }
  .title-line.company { font-weight: 700; font-size: var(--font-size-large); }
  .grand-total {
    display: flex;
    justify-content: space-between;
    font-weight: 700;
    border-top: 2px solid var(--ink);
    padding-top: 0.5rem;
    margin-top: 0.5rem;
  }
  .grand-total.negative { color: #b5453b; }
  .empty { text-align: center; color: var(--ink-faint, #888); padding: 1rem 0; }
</style>
