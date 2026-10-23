<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import FromToDateFields from '$lib/components/FromToDateFields.svelte';
  import {
    getProfitAndLoss,
    getProfitAndLossByHierarchyTree,
    getHierarchyGroups,
    getLedgerDateRange,
    ApiError,
    type ProfitAndLoss,
    type ProfitAndLossByGroupNode,
    type HierarchyGroupRecord,
  } from '$lib/api';
  import { translations } from '$lib/state.svelte';
  import { screenTitle } from '$lib/state.svelte';
  import HierarchyGroupTreePicker from '$lib/components/HierarchyGroupTreePicker.svelte';
  import ProfitAndLossTable from '$lib/components/ProfitAndLossTable.svelte';
  import HierarchyGroupPLNode from '$lib/components/HierarchyGroupPLNode.svelte';

  // "Division" is a business-chosen name, not privileged — see docs/pm-frontend-reference.md.
  const hierarchyName = 'Division';
  const hierarchyPath = ['Location', hierarchyName];

  let pl: ProfitAndLoss | null = $state(null);
  let byGroup: ProfitAndLossByGroupNode[] = $state([]);
  let loading = $state(true);
  let error = $state('');
  let fromDate = $state('');
  let toDate = $state('');
  let groups: HierarchyGroupRecord[] = $state([]);
  let selectedGroup = $state('');
  // "Per Division" and the tree picker are mutually exclusive views — see docs/pm-frontend-reference.md.
  let viewMode: 'consolidated' | 'per-group' = $state('consolidated');

  let latestRequestId = 0;
  async function load() {
    const requestId = ++latestRequestId;
    loading = true;
    try {
      if (!session.current) throw new Error('No ledger selected.');
      if (viewMode === 'per-group') {
        const result = await getProfitAndLossByHierarchyTree(session.current.businessName, session.current.ledgerName, hierarchyPath, hierarchyName, fromDate || undefined, toDate || undefined);
        if (requestId !== latestRequestId) return;
        byGroup = result;
      } else {
        const result = await getProfitAndLoss(session.current.businessName, session.current.ledgerName, fromDate || undefined, toDate || undefined, selectedGroup || undefined, selectedGroup ? hierarchyPath : undefined, selectedGroup ? hierarchyName : undefined);
        if (requestId !== latestRequestId) return;
        pl = result;
      }
    } catch (e) {
      if (requestId !== latestRequestId) return;
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      if (requestId === latestRequestId) loading = false;
    }
  }

  function setViewMode(mode: 'consolidated' | 'per-group') {
    if (viewMode === mode) return;
    viewMode = mode;
    load();
  }

  onMount(async () => {
    try {
      groups = await getHierarchyGroups(hierarchyName);
    } catch {
      /* the group filter is optional; leave the list empty if it fails to load */
    }
    // Default date range to earliest-to-latest activity — see docs/pm-frontend-reference.md.
    if (session.current) {
      try {
        const range = await getLedgerDateRange(session.current.businessName, session.current.ledgerName);
        if (range.earliest && range.latest) {
          fromDate = range.earliest;
          toDate = range.latest;
        }
      } catch {
        /* defaulting the date range is a convenience, not a requirement — fall through to "all time" if it fails */
      }
    }
    await load();
  });

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');

  function formatDateRange(from: string, to: string): string {
    const fmtOne = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    if (from && to) return `${fmtOne(from)} – ${fmtOne(to)}`;
    if (from) return `From ${fmtOne(from)}`;
    if (to) return `Through ${fmtOne(to)}`;
    return 'All time';
  }
  const pageTitle = $derived(screenTitle('/reports/old-pl'));
</script>

<svelte:head><title>{translations.current['Profit and Loss'] ?? 'Profit and Loss'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Profit and Loss'] ?? 'Profit and Loss'}</legend>
<div class="date-controls">
  <fieldset>
    <legend>{translations.current['View'] ?? 'View'}</legend>
    <div class="view-toggle">
      <button type="button" class:active={viewMode === 'consolidated'} onclick={() => setViewMode('consolidated')}>{translations.current['Consolidated'] ?? 'Consolidated'}</button>
      <button type="button" class:active={viewMode === 'per-group'} onclick={() => setViewMode('per-group')}>{translations.current['Per Division'] ?? 'Per Division'}</button>
    </div>
  </fieldset>
  {#if viewMode === 'consolidated'}
    <fieldset>
      <legend>{translations.current['Division'] ?? 'Division'}</legend>
      <HierarchyGroupTreePicker {hierarchyName} {groups} selected={selectedGroup} onSelect={(name) => { selectedGroup = name; load(); }} />
    </fieldset>
  {/if}
  <FromToDateFields bind:fromDate bind:toDate onchange={load} />
  {#if fromDate || toDate}<button class="link" onclick={() => { fromDate = ''; toDate = ''; load(); }}>{translations.current['Clear (show all time)'] ?? 'Clear (show all time)'}</button>{/if}
</div>

{#if loading}
  <p class="center-text">Loading…</p>
{:else if error}
  <p class="error center-text">{error}</p>
{:else if viewMode === 'consolidated' && pl}
  <div class="report-wrap">
    <div class="report card">
      <div class="title-block">
        <p class="title-line">{pageTitle ?? (translations.current['Profit and Loss for:'] ?? 'Profit and Loss for:')}</p>
        <p class="title-line group">{selectedGroup.replace(new RegExp(` ${hierarchyName}$`), '') || (translations.current['Consolidated'] ?? 'Consolidated')}</p>
        <p class="title-line company">{session.current?.businessName ?? ''}</p>
        <p class="title-line period">{formatDateRange(fromDate, toDate)}</p>
      </div>
      <ProfitAndLossTable {pl} />
    </div>
  </div>
{:else if viewMode === 'per-group'}
  <div class="report-wrap">
    <div class="report card">
      <div class="title-block">
        <p class="title-line">{translations.current['Profit and Loss per Division for:'] ?? 'Profit and Loss per Division for:'}</p>
        <p class="title-line company">{session.current?.businessName ?? ''}</p>
        <p class="title-line period">{formatDateRange(fromDate, toDate)}</p>
      </div>
      {#if byGroup.length === 0}
        <p class="empty">{translations.current['No real division has any activity within this date range.'] ?? 'No real division has any activity within this date range.'}</p>
      {:else}
        {#each byGroup as node}
          <HierarchyGroupPLNode {node} {hierarchyName} />
        {/each}
      {/if}
    </div>
  </div>
{/if}

</fieldset>
<style>
  .center-text {
    text-align: center;
  }

  .date-controls {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 0.8rem;
    margin-bottom: 1.2rem;
    flex-wrap: wrap;
  }

  .view-toggle {
    display: flex;
    gap: 0.3rem;
  }

  .view-toggle button {
    border: 1px solid var(--rule-strong);
    background: var(--paper);
    color: var(--ink-soft);
    padding: 0.3rem 0.7rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: var(--font-size-base);
  }

  .view-toggle button.active {
    background: var(--brass);
    border-color: var(--brass-dark);
    color: #fff;
    font-weight: 600;
  }

  .report-wrap {
    display: flex;
    justify-content: center;
  }

  .report {
    padding: 1.2rem 1.6rem 1.4rem;
    max-width: 640px;
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

  .title-line.group {
    color: var(--ink-soft);
    font-size: var(--font-size-base);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .title-line.period {
    color: var(--ink-soft);
    font-size: var(--font-size-medium);
  }

  .empty {
    text-align: center;
    color: var(--ink-soft);
    font-style: italic;
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
</style>
