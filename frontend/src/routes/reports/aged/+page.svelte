<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { formatAmount, todayIsoDate } from '$lib/format';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { session } from '$lib/state.svelte';
  import { getAgedInvoices, getAgedSummary, ApiError, type AgedRow, type AgedSummaryRow } from '$lib/api';
  import { translations } from '$lib/state.svelte';

  let invoiceType: 'AR' | 'AP' = 'AR';
  let view: 'summary' | 'detail' = 'summary';
  let asOfDate = todayIsoDate();
  let summary: AgedSummaryRow[] = [];
  let detail: AgedRow[] = [];
  let loading = true;
  let error = '';

  let latestRequestId = 0;
  async function load() {
    if (!session.current) return;
    const requestId = ++latestRequestId;
    loading = true;
    error = '';
    try {
      if (view === 'summary') {
        const result = await getAgedSummary(session.current.businessName, session.current.ledgerName, invoiceType, asOfDate || undefined);
        if (requestId !== latestRequestId) return;
        summary = result;
      } else {
        const result = await getAgedInvoices(session.current.businessName, session.current.ledgerName, invoiceType, asOfDate || undefined);
        if (requestId !== latestRequestId) return;
        detail = result;
      }
    } catch (e) {
      if (requestId !== latestRequestId) return;
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      if (requestId === latestRequestId) loading = false;
    }
  }

  onMount(() => {
    const t = $page.url.searchParams.get('type');
    if (t === 'AP') invoiceType = 'AP';
    load();
  });

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');
</script>

<svelte:head><title>Aged {invoiceType === 'AR' ? 'Receivables' : 'Payables'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{invoiceType === 'AR' ? (translations.current['Aged Receivables'] ?? 'Aged Receivables') : (translations.current['Aged Payables'] ?? 'Aged Payables')}</legend>
  <p class="intro">
    {invoiceType === 'AR'
      ? (translations.current["What's outstanding, bucketed against each customer's own payment terms — not a fixed 30/60/90 for everyone, since account management practice genuinely varies per account."] ?? "What's outstanding, bucketed against each customer's own payment terms — not a fixed 30/60/90 for everyone, since account management practice genuinely varies per account.")
      : (translations.current["What's outstanding, bucketed against each vendor's own payment terms — not a fixed 30/60/90 for everyone, since account management practice genuinely varies per account."] ?? "What's outstanding, bucketed against each vendor's own payment terms — not a fixed 30/60/90 for everyone, since account management practice genuinely varies per account.")}
  </p>
<div class="controls">
  <div class="toggle-group">
    <button class="btn secondary" class:active={invoiceType === 'AR'} onclick={() => { invoiceType = 'AR'; load(); }}>AR</button>
    <button class="btn secondary" class:active={invoiceType === 'AP'} onclick={() => { invoiceType = 'AP'; load(); }}>AP</button>
  </div>
  <div class="toggle-group">
    <button class="btn secondary" class:active={view === 'summary'} onclick={() => { view = 'summary'; load(); }}>{translations.current['Summary'] ?? 'Summary'}</button>
    <button class="btn secondary" class:active={view === 'detail'} onclick={() => { view = 'detail'; load(); }}>{translations.current['Detail'] ?? 'Detail'}</button>
  </div>
  <fieldset>
    <legend>{translations.current['As of date'] ?? 'As of date'}</legend>
    <input type="date" bind:value={asOfDate} onchange={load} />
  </fieldset>
</div>

{#if loading}
  <p>Loading…</p>
{:else if error}
  <p class="error">{error}</p>
{:else if view === 'summary'}
  <div class="grid-box">
    <table>
      <thead>
        <tr>
          <th>{invoiceType === 'AR' ? 'Customer' : 'Vendor'}</th>
          <th class="num">{translations.current['Outstanding'] ?? 'Outstanding'}</th>
          <th class="num">{translations.current['Oldest (days)'] ?? 'Oldest (days)'}</th>
        </tr>
      </thead>
      <tbody>
        {#if summary.length === 0}
          <tr><td colspan="3" class="empty">{translations.current['Nothing outstanding.'] ?? 'Nothing outstanding.'}</td></tr>
        {/if}
        {#each summary as row}
          <tr>
            <td>{row.counterparty}</td>
            <td class="num mono">{fmt(row.outstanding_minor)}</td>
            <td class="num mono">{row.oldest_days_overdue}</td>
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
          <th>{translations.current['Reference'] ?? 'Reference'}</th>
          <th>{invoiceType === 'AR' ? 'Customer' : 'Vendor'}</th>
          <th>{translations.current['Due date'] ?? 'Due date'}</th>
          <th class="num">{translations.current['Outstanding'] ?? 'Outstanding'}</th>
          <th class="num">{translations.current['Days overdue'] ?? 'Days overdue'}</th>
          <th>{translations.current['Bucket'] ?? 'Bucket'}</th>
        </tr>
      </thead>
      <tbody>
        {#if detail.length === 0}
          <tr><td colspan="6" class="empty">{translations.current['Nothing outstanding.'] ?? 'Nothing outstanding.'}</td></tr>
        {/if}
        {#each detail as row}
          <tr>
            <td>{row.reference}</td>
            <td>{row.counterparty}</td>
            <td>{row.due_date ?? ''}</td>
            <td class="num mono">{fmt(row.outstanding_minor)}</td>
            <td class="num mono">{row.days_overdue}</td>
            <td>{row.bucket}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

</fieldset>
<style>
.controls {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 1.2rem;
    margin-bottom: 1.2rem;
  }
  .toggle-group {
    display: flex;
    gap: 0.4rem;
  }
  .toggle-group .active {
    background: var(--brass);
    color: white;
    border-color: var(--brass);
  }
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
</style>
