<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { formatAmount, todayIsoDate } from '$lib/format';
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import { getCashFlowForecast, ApiError, type CashFlowForecast } from '$lib/api';

  let asOfDate = $state(todayIsoDate());
  let horizonDays = $state(90);
  let forecast: CashFlowForecast | null = $state(null);
  let loading = $state(true);
  let error = $state('');

  let latestRequestId = 0;
  async function load() {
    if (!session.current) return;
    const requestId = ++latestRequestId;
    loading = true;
    error = '';
    try {
      const result = await getCashFlowForecast(session.current.businessName, session.current.ledgerName, asOfDate, horizonDays);
      if (requestId !== latestRequestId) return;
      forecast = result;
    } catch (e) {
      if (requestId !== latestRequestId) return;
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      if (requestId === latestRequestId) loading = false;
    }
  }

  onMount(load);

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');

  let runningTotals = $derived.by(() => {
    if (!forecast) return [];
    let running = forecast.starting_cash_minor;
    return forecast.lines.map((l) => {
      running += l.amount_minor;
      return running;
    });
  });
</script>

<svelte:head><title>{translations.current['Cash Flow Forecast'] ?? 'Cash Flow Forecast'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Cash Flow Forecast'] ?? 'Cash Flow Forecast'}</legend>
  <p class="intro">
    {translations.current['A real, forward-looking projection — not the historical Cashflow Statement. Every real, outstanding invoice is assumed to land on its own due date; genuinely recurring cash movements (rent, subscriptions) are projected from their own real schedule. Home currency only, for now.'] ?? 'A real, forward-looking projection — not the historical Cashflow Statement. Every real, outstanding invoice is assumed to land on its own due date; genuinely recurring cash movements (rent, subscriptions) are projected from their own real schedule. Home currency only, for now.'}
  </p>
<div class="controls">
  <fieldset>
    <legend>{translations.current['As of date'] ?? 'As of date'}</legend>
    <input type="date" bind:value={asOfDate} onchange={load} />
  </fieldset>
  <fieldset>
    <legend>{translations.current['Horizon (days)'] ?? 'Horizon (days)'}</legend>
    <select bind:value={horizonDays} onchange={load}>
      <option value={30}>30</option>
      <option value={60}>60</option>
      <option value={90}>90</option>
      <option value={180}>180</option>
    </select>
  </fieldset>
</div>

{#if loading}
  <p class="center-text">Loading…</p>
{:else if error}
  <p class="error">{error}</p>
{:else if forecast}
  <div class="card summary-card">
    <div class="summary-row">
      <div>
        <span class="summary-label">{translations.current['Starting cash'] ?? 'Starting cash'}</span>
        <span class="summary-value mono">{fmt(forecast.starting_cash_minor)}</span>
      </div>
      <div>
        <span class="summary-label">{translations.current['Projected ending cash'] ?? 'Projected ending cash'}</span>
        <span class="summary-value mono">{fmt(forecast.ending_cash_minor)}</span>
      </div>
      <div>
        <span class="summary-label">{translations.current['Lowest projected balance'] ?? 'Lowest projected balance'}</span>
        <span class="summary-value mono" class:warn={forecast.lowest_projected_balance_minor < 0}>
          {fmt(forecast.lowest_projected_balance_minor)} ({forecast.lowest_balance_date})
        </span>
      </div>
      <div>
        <span class="summary-label">{translations.current['Overdraft limit'] ?? 'Overdraft limit'}</span>
        <span class="summary-value mono">{forecast.overdraft_limit_minor === null ? '—' : fmt(forecast.overdraft_limit_minor)}</span>
      </div>
    </div>
  </div>

  {#if forecast.first_shortfall_date !== null}
    <div class="card shortfall-card">
      <strong>{translations.current['Projected shortfall'] ?? 'Projected shortfall'}:</strong>
      {translations.current['Cash is projected to fall below your arranged overdraft limit on'] ?? 'Cash is projected to fall below your arranged overdraft limit on'}
      <strong>{forecast.first_shortfall_date}</strong>,
      {translations.current['by'] ?? 'by'}
      <strong class="mono">{fmt(forecast.first_shortfall_amount_minor ?? 0)}</strong>.
    </div>
  {:else if forecast.overdraft_limit_minor !== null}
    <div class="card ok-card">
      {translations.current['No shortfall projected — cash stays within your arranged overdraft limit throughout this horizon.'] ?? 'No shortfall projected — cash stays within your arranged overdraft limit throughout this horizon.'}
    </div>
  {/if}

  <fieldset class="card-legend">
    <legend>{translations.current['Anticipated movements'] ?? 'Anticipated movements'}</legend>
    {#if forecast.lines.length === 0}
      <p class="empty">{translations.current['No anticipated movements within this horizon.'] ?? 'No anticipated movements within this horizon.'}</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>{translations.current['Date'] ?? 'Date'}</th>
            <th>{translations.current['Description'] ?? 'Description'}</th>
            <th>{translations.current['Source'] ?? 'Source'}</th>
            <th class="num">{translations.current['Amount'] ?? 'Amount'}</th>
            <th class="num">{translations.current['Running balance'] ?? 'Running balance'}</th>
          </tr>
        </thead>
        <tbody>
          {#each forecast.lines as line, i}
            <tr>
              <td>{line.date}</td>
              <td>{line.description}</td>
              <td>{line.source}</td>
              <td class="num mono" class:credit={line.amount_minor > 0} class:debit={line.amount_minor < 0}>{fmt(line.amount_minor)}</td>
              <td class="num mono" class:warn={runningTotals[i] < 0}>{fmt(runningTotals[i])}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </fieldset>
{/if}

</fieldset>
<style>
  .intro {
    max-width: 80ch;
  }
  .center-text {
    text-align: center;
  }
  .error {
    color: var(--debit);
  }
  .controls {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 1.2rem;
    margin-bottom: 1.2rem;
  }
  .card {
    max-width: 950px;
    margin: 0 auto 1.2rem;
    padding: 1.2rem 1.3rem;
    border: 1px solid var(--rule-strong, #ccc);
    border-radius: 8px;
    background: var(--paper);
  }
  .summary-card {
    background: #fdf6e8;
    border-color: #d9a441;
  }
  .shortfall-card {
    background: #fbe9e7;
    border-color: var(--debit, #a33a2e);
    color: var(--debit, #a33a2e);
  }
  .ok-card {
    background: #eef7ee;
    border-color: var(--credit, #2e7d32);
    color: var(--credit, #2e7d32);
  }
  .summary-row {
    display: flex;
    justify-content: space-around;
    text-align: center;
  }
  .summary-label {
    display: block;
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    letter-spacing: 0.02em;
  }
  .summary-value {
    display: block;
    font-size: var(--font-size-large);
    font-weight: 600;
    margin-top: 0.2rem;
  }
  th,
  td {
    padding: 0.4rem 0.6rem;
    text-align: left;
    border-bottom: 1px solid var(--rule);
  }
  .num {
    text-align: right;
  }
  .mono {
    font-variant-numeric: tabular-nums;
  }
  .credit {
    color: var(--credit);
  }
  .debit {
    color: var(--debit);
  }
  .warn {
    color: var(--debit, #a33a2e);
    font-weight: 600;
  }
  .empty {
    color: var(--ink-soft);
  }
</style>
