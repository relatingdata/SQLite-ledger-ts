<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { auth } from '$lib/state.svelte';
  import { getSalesReport, ApiError, type SalesReport } from '$lib/api';
  import { translations } from '$lib/state.svelte';
  import { formatAmount, todayIsoDate } from '$lib/format';

  let report: SalesReport | null = $state(null);
  let loading = $state(true);
  let error = $state('');
  let fromDate = $state(todayIsoDate());
  let toDate = $state(todayIsoDate());
  let view: 'summary' | 'detailed' = $state('summary');
  let page = $state(0);
  const pageSize = 100;

  let latestRequestId = 0;
  // Split on {NAME} — same, real, confirmed fix as Balance Sheet:
  // {@html} with an inline .replace() never updates once session.current
  // populates after this page's own, first, server-rendered pass.
  let introTemplate = $derived(translations.current["Every real posted sale for {NAME} in the selected period — a category summary rolled up from each product's own real place in the catalog, and the full line-by-line detail underneath it."] ?? "Every real posted sale for {NAME} in the selected period — a category summary rolled up from each product's own real place in the catalog, and the full line-by-line detail underneath it.");
  let introItems = $derived(introTemplate.split('{NAME}'));
  async function load() {
    if (!session.current) return;
    const requestId = ++latestRequestId;
    loading = true;
    try {
      const result = await getSalesReport(session.current.businessName, session.current.ledgerName, fromDate || undefined, toDate || undefined);
      if (requestId !== latestRequestId) return;
      report = result;
      page = 0;
    } catch (e) {
      if (requestId !== latestRequestId) return;
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      if (requestId === latestRequestId) loading = false;
    }
  }

  onMount(load);

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');
  let pageRows = $derived.by(() => report ? report.detailed.slice(page * pageSize, (page + 1) * pageSize) : []);
  let totalPages = $derived.by(() => report ? Math.max(1, Math.ceil(report.detailed.length / pageSize)) : 1);
</script>

<svelte:head><title>{translations.current['Sales Report'] ?? 'Sales Report'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Sales'] ?? 'Sales Report'}</legend>
  <p class="intro">
    {introItems[0]}<strong>{session.current?.businessName ?? '…'}</strong>{introItems[1] ?? ''}
  </p>
<div class="controls">
  <fieldset>
    <legend>{translations.current['From'] ?? 'From'}</legend>
    <input type="date" bind:value={fromDate} onchange={load} />
  </fieldset>
  <fieldset>
    <legend>To</legend>
    <input type="date" bind:value={toDate} onchange={load} />
  </fieldset>
  <fieldset>
    <legend>{translations.current['View'] ?? 'View'}</legend>
    <div class="view-toggle">
      <button class="btn" class:active={view === 'summary'} onclick={() => (view = 'summary')}>{translations.current['Category Summary'] ?? 'Category Summary'}</button>
      <button class="btn" class:active={view === 'detailed'} onclick={() => (view = 'detailed')}>{translations.current['Detailed'] ?? 'Detailed'}</button>
    </div>
  </fieldset>
</div>

{#if loading}
  <p>Loading…</p>
{:else if error}
  <p class="error">{error}</p>
{:else if report}
  <p class="total">
    Total: <span class="mono">{report.total_quantity}</span> units,
    <span class="mono">{fmt(report.total_amount_minor)}</span>
  </p>

  {#if view === 'summary'}
    <div class="grid-box">
      <table>
        <thead>
          <tr>
            <th>{translations.current['Category'] ?? 'Category'}</th>
            <th class="num">{translations.current['Quantity'] ?? 'Quantity'}</th>
            <th class="num">{translations.current['Amount'] ?? 'Amount'}</th>
            <th class="num">% of Total</th>
          </tr>
        </thead>
        <tbody>
          {#if report.category_summary.length === 0}
            <tr><td colspan="4" class="empty">{translations.current['No sales in this period.'] ?? 'No sales in this period.'}</td></tr>
          {/if}
          {#each report.category_summary as c}
            <tr>
              <td>{c.category}</td>
              <td class="num mono">{c.quantity}</td>
              <td class="num mono">{fmt(c.amount_minor)}</td>
              <td class="num mono">{report.total_amount_minor > 0 ? ((c.amount_minor / report.total_amount_minor) * 100).toFixed(1) : '0.0'}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="grid-box">
      <table>
        <thead>
          <tr>
            <th>{translations.current['Date'] ?? 'Date'}</th>
            <th>{translations.current['Reference'] ?? 'Reference'}</th>
            <th>{translations.current['Product'] ?? 'Product'}</th>
            <th class="num">{translations.current['Qty'] ?? 'Qty'}</th>
            <th class="num">{translations.current['Unit price'] ?? 'Unit price'}</th>
            <th class="num">{translations.current['Amount'] ?? 'Amount'}</th>
          </tr>
        </thead>
        <tbody>
          {#if pageRows.length === 0}
            <tr><td colspan="6" class="empty">{translations.current['No sales in this period.'] ?? 'No sales in this period.'}</td></tr>
          {/if}
          {#each pageRows as l}
            <tr>
              <td class="mono">{l.invoice_date}</td>
              <td class="mono">{l.reference}</td>
              <td>{l.item_name ?? l.description}</td>
              <td class="num mono">{l.quantity ?? ''}</td>
              <td class="num mono">{l.unit_price_minor != null ? fmt(l.unit_price_minor) : ''}</td>
              <td class="num mono">{fmt(l.amount_minor)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if totalPages > 1}
      <div class="pager">
        <button class="link" disabled={page === 0} onclick={() => page--}>← Newer</button>
        <span>Page {page + 1} of {totalPages}</span>
        <button class="link" disabled={page >= totalPages - 1} onclick={() => page++}>Older →</button>
      </div>
    {/if}
  {/if}
{/if}

</fieldset>
<style>
  .controls {
    display: flex;
    gap: 1rem;
    align-items: flex-end;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }
  .view-toggle {
    display: flex;
    gap: 0.4rem;
  }
  .btn.active {
    background: var(--accent, #2c5f4f);
    color: white;
  }
  .total {
    font-family: var(--font-display);
    font-size: var(--font-size-large);
    margin-bottom: 1rem;
  }
  .grid-box {
    max-width: 900px;
  }
  th,
  td {
    padding: 0.4rem 0.6rem;
    text-align: left;
    border-bottom: 1px solid var(--rule, #ddd);
  }
  .num {
    text-align: right;
  }
  .mono {
    font-family: var(--font-mono, monospace);
  }
  .empty {
    text-align: center;
    color: var(--ink-soft);
    font-style: italic;
  }
  .pager {
    display: flex;
    gap: 1rem;
    align-items: center;
    margin-top: 0.8rem;
  }
  .error {
    color: var(--debit, #b1442e);
  }
</style>
