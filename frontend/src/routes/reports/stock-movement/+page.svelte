<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { getStockMovementReport, getHierarchy, ApiError, type StockMovementReport, type OrderReceiptRow, type StockTransferRow, type StockSaleRow } from '$lib/api';
  import { translations } from '$lib/state.svelte';
  import FromToDateFields from '$lib/components/FromToDateFields.svelte';

  let report: StockMovementReport | null = $state(null);
  let loading = $state(true);
  let error = $state('');
  let fromDate = $state('');
  let toDate = $state('');

  type Tab = 'receipts' | 'transfers' | 'sales';
  let tab: Tab = $state('receipts');

  // Grouping names never hardcoded — see docs/pm-frontend-reference.md.
  type GroupKey = 'group' | 'location' | 'vendor' | 'category';
  let groupBy: GroupKey = $state('group');
  let hierarchyName: string | undefined = $state(undefined);

  let latestRequestId = 0;
  async function load() {
    const requestId = ++latestRequestId;
    loading = true;
    try {
      const result = await (session.current ? getStockMovementReport(session.current.businessName, session.current.ledgerName, fromDate || undefined, toDate || undefined, hierarchyName) : Promise.reject(new Error('No ledger selected.')));
      if (requestId !== latestRequestId) return;
      report = result;
    } catch (e) {
      if (requestId !== latestRequestId) return;
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      if (requestId === latestRequestId) loading = false;
    }
  }

  onMount(async () => {
    if (session.current) {
      try {
        const hierarchy = await getHierarchy(session.current.businessName);
        if (hierarchy.length > 0) hierarchyName = hierarchy[0].grouping;
      } catch {
        /* the report still works with no group tagging at all if this fails */
      }
    }
    await load();
  });

  // Starts collapsed, same pattern as P&L/Inventory Listing.
  let expandedGroups = $state(new Set<string>());
  function toggleGroup(key: string) {
    expandedGroups = new Set(expandedGroups);
    if (expandedGroups.has(key)) expandedGroups.delete(key);
    else expandedGroups.add(key);
  }

  function keyFor(row: OrderReceiptRow | StockTransferRow | StockSaleRow, key: GroupKey): string {
    if (key === 'category') return row.category ?? '(No category)';
    if ('from_location' in row) {
      // Transfers group by destination location — see docs/pm-frontend-reference.md.
      return key === 'location' ? row.to_location : '(Not applicable to transfers)';
    }
    if (key === 'group') return row.group ?? '(No group)';
    if (key === 'location') return row.location;
    return row.vendor ?? '(No vendor on file)';
  }

  function groupRows<T extends OrderReceiptRow | StockTransferRow | StockSaleRow>(rows: T[], key: GroupKey) {
    const groups = new Map<string, { name: string; rows: T[]; totalQuantity: number; totalAmount: number }>();
    for (const row of rows) {
      const k = keyFor(row, key);
      if (!groups.has(k)) groups.set(k, { name: k, rows: [], totalQuantity: 0, totalAmount: 0 });
      const g = groups.get(k)!;
      g.rows.push(row);
      g.totalQuantity += row.quantity;
      g.totalAmount += 'amount_minor' in row ? row.amount_minor : 0;
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  let groupingApplicable = $derived.by(() => tab !== 'transfers' || groupBy === 'location' || groupBy === 'category');
  let groups = $derived.by(() => !report
    ? []
    : tab === 'receipts'
      ? groupRows(report.receipts, groupingApplicable ? groupBy : 'category')
      : tab === 'transfers'
        ? groupRows(report.transfers, groupingApplicable ? groupBy : 'category')
        : groupRows(report.sales, groupingApplicable ? groupBy : 'category'));

  const fmt = (c: number) => (c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
</script>

<svelte:head><title>{translations.current['Stock Movement Report'] ?? 'Stock Movement Report'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Stock Movement Report'] ?? 'Stock Movement Report'}</legend>
  <p class="intro">{translations.current['The real, physical journey of stock — purchases received into each real warehouse, transfers on to retail outlets, and real sales — groupable by a business\'s own configured hierarchy (such as Division), location, vendor, or category.'] ?? "The real, physical journey of stock — purchases received into each real warehouse, transfers on to retail outlets, and real sales — groupable by a business's own configured hierarchy (such as Division), location, vendor, or category."}</p>
<div class="controls">
  <div class="tabs">
    <button type="button" class:active={tab === 'receipts'} onclick={() => (tab = 'receipts')}>{translations.current['Purchases'] ?? 'Purchases'}</button>
    <button type="button" class:active={tab === 'transfers'} onclick={() => (tab = 'transfers')}>{translations.current['Transfers'] ?? 'Transfers'}</button>
    <button type="button" class:active={tab === 'sales'} onclick={() => (tab = 'sales')}>{translations.current['Sales'] ?? 'Sales'}</button>
  </div>

  <fieldset>
    <legend>{translations.current['Group by'] ?? 'Group by'}</legend>
    <select bind:value={groupBy}>
      <option value="group">{translations.current[hierarchyName ?? 'Group'] ?? (hierarchyName ?? 'Group')}</option>
      <option value="location">{translations.current['Location'] ?? 'Location'}</option>
      <option value="vendor">{translations.current['Vendor'] ?? 'Vendor'}</option>
      <option value="category">{translations.current['Category'] ?? 'Category'}</option>
    </select>
  </fieldset>

  <FromToDateFields bind:fromDate bind:toDate onchange={load} />
</div>

{#if loading}
  <p class="center-text">Loading…</p>
{:else if error}
  <p class="error center-text">{error}</p>
{:else if !groupingApplicable}
  <p class="center-text empty">Transfers have no real {groupBy} of their own — try grouping by Location or Category.</p>
{:else if groups.length === 0}
  <p class="center-text empty">No {tab} in the selected period.</p>
{:else}
  <div class="report-wrap">
    <div class="grid-box">
      {#each groups as g}
        <div class="group-block">
          <button type="button" class="group-head" onclick={() => toggleGroup(g.name)}>
            <span class="disclosure">{expandedGroups.has(g.name) ? '▾' : '▸'}</span>
            <span class="group-name">{translations.current[g.name] ?? g.name}</span>
            <span class="group-total num mono">{g.totalQuantity.toLocaleString()}</span>
            {#if tab === 'sales'}<span class="group-total num mono">{fmt(g.totalAmount)}</span>{/if}
          </button>

          {#if expandedGroups.has(g.name)}
            <table>
              <thead>
                <tr>
                  <th>{translations.current['Item'] ?? 'Item'}</th>
                  <th>{translations.current['Date'] ?? 'Date'}</th>
                  {#if tab === 'receipts'}
                    <th>{translations.current['Location'] ?? 'Location'}</th>
                    <th>{translations.current['Vendor'] ?? 'Vendor'}</th>
                  {:else if tab === 'transfers'}
                    <th>{translations.current['From'] ?? 'From'}</th>
                    <th>To</th>
                  {:else}
                    <th>{translations.current['Location'] ?? 'Location'}</th>
                  {/if}
                  <th class="num">{translations.current['Qty'] ?? 'Qty'}</th>
                  {#if tab === 'sales'}<th class="num">{translations.current['Amount'] ?? 'Amount'}</th>{/if}
                </tr>
              </thead>
              <tbody>
                {#each g.rows.slice(0, 100) as row}
                  <tr>
                    <td>{row.item}</td>
                    <td>{row.date}</td>
                    {#if tab === 'receipts'}
                      <td>{(row as OrderReceiptRow).location}</td>
                      <td>{(row as OrderReceiptRow).vendor ?? '—'}</td>
                    {:else if tab === 'transfers'}
                      <td>{(row as StockTransferRow).from_location}</td>
                      <td>{(row as StockTransferRow).to_location}</td>
                    {:else}
                      <td>{(row as StockSaleRow).location}</td>
                    {/if}
                    <td class="num mono">{row.quantity.toLocaleString()}</td>
                    {#if tab === 'sales'}<td class="num mono">{fmt((row as StockSaleRow).amount_minor)}</td>{/if}
                  </tr>
                {/each}
              </tbody>
            </table>
            {#if g.rows.length > 100}
              <p class="truncation-note">Showing the first 100 of {g.rows.length} real rows — narrow the date range or group by a finer dimension to see the rest.</p>
            {/if}
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}

</fieldset>
<style>
  .center-text {
    text-align: center;
  }
  .empty {
    color: var(--ink-soft);
  }

  .controls {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 0.8rem;
    margin-bottom: 1.2rem;
    flex-wrap: wrap;
  }

  .tabs {
    display: flex;
    gap: 0.3rem;
  }
  .tabs button {
    padding: 0.5rem 0.9rem;
    border: 1px solid var(--rule-strong);
    background: var(--paper);
    cursor: pointer;
    border-radius: 6px;
  }
  .tabs button.active {
    background: var(--brass-dark, #7a5c2e);
    color: white;
    border-color: var(--brass-dark, #7a5c2e);
  }

  .report-wrap {
    display: flex;
    justify-content: center;
  }

  .grid-box {
    border: 1px solid var(--rule-strong);
    border-radius: 8px;
    overflow: hidden;
    width: 100%;
    max-width: 900px;
    background: var(--paper);
  }

  .group-block + .group-block {
    border-top: 1px solid var(--rule);
  }

  .group-head {
    display: flex;
    align-items: center;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    font: inherit;
    padding: 0.55rem 0.9rem;
    font-weight: 700;
  }
  .group-head:hover {
    background: var(--paper-dim, #f2ede1);
  }

  .disclosure {
    display: inline-block;
    width: 1.1rem;
    color: var(--ink-soft);
  }

  .group-name {
    flex: 1;
  }

  .group-total {
    min-width: 4.5rem;
    text-align: right;
    margin-left: 0.8rem;
  }

  th,
  td {
    padding: 0.4rem 0.7rem;
    text-align: left;
    border-bottom: 1px solid var(--rule);
  }
  th:first-child,
  td:first-child {
    padding-left: 2.6rem;
  }

  .truncation-note {
    padding: 0.5rem 2.6rem;
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    font-style: italic;
    margin: 0;
    border-bottom: 1px solid var(--rule);
  }
</style>
