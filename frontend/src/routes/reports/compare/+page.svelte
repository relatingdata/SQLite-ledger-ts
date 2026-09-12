<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import {
    getLedgers,
    getTrialBalanceComparison,
    getProfitAndLossComparison,
    ApiError,
    type TrialBalanceComparison,
    type ProfitAndLossComparison,
  } from '$lib/api';
  import { translations } from '$lib/state.svelte';

  let ledgers: { id: number; name: string }[] = $state([]);
  let ledgerA = $state('');
  let compareToLedger = $state('');
  let tbCmp: TrialBalanceComparison | null = $state(null);
  let plCmp: ProfitAndLossComparison | null = $state(null);
  let loading = $state(true);
  let error = $state('');

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');
  // A net income total can genuinely be negative (a net loss) — shown
  // parenthesized and in red, same convention as everywhere else,
  // never as a bare negative number.
  const fmtNet = (c: number) => (c < 0 ? `(${fmt(Math.abs(c))})` : fmt(c));
  // Unfavorable variances shown parenthesized, matching the same
  // convention as the contra-balance styling on Balance Sheet/P&L.
  // Deliberately takes "is this unfavorable" explicitly rather than
  // inferring it from raw sign — favorable/unfavorable flips between
  // Income (more is good) and Expense (less is good), so the same
  // positive number needs opposite treatment depending on which
  // section it's in.
  const fmtVariance = (c: number, isUnfavorable: boolean) => (isUnfavorable ? `(${fmt(Math.abs(c))})` : fmt(Math.abs(c)));

  onMount(async () => {
    if (!session.current) return;
    try {
      ledgers = await getLedgers(session.current.businessName);
      ledgerA = session.current.ledgerName;
      compareToLedger = ledgers.find((l) => l.name !== session.current!.ledgerName)?.name ?? '';
      await loadComparison();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  });

  let latestRequestId = 0;
  // Same, real, confirmed fix as Balance Sheet — see there for why.
  let introTemplate = $derived(translations.current["Any two ledgers in {NAME} side by side — Actual against a proposed budget, or two proposed budgets against each other. Not limited to whichever ledger you're currently in."] ?? "Any two ledgers in {NAME} side by side — Actual against a proposed budget, or two proposed budgets against each other. Not limited to whichever ledger you're currently in.");
  let introItems = $derived(introTemplate.split('{NAME}'));
  async function loadComparison() {
    if (!ledgerA || !compareToLedger || !session.current) return;
    const requestId = ++latestRequestId;
    error = '';
    try {
      const result = await Promise.all([
        getTrialBalanceComparison(session.current.businessName, ledgerA, compareToLedger),
        getProfitAndLossComparison(session.current.businessName, ledgerA, compareToLedger),
      ]);
      if (requestId !== latestRequestId) return;
      [tbCmp, plCmp] = result;
    } catch (e) {
      if (requestId !== latestRequestId) return;
      error = e instanceof ApiError ? e.message : 'Failed to load comparison.';
    }
  }
</script>

<svelte:head><title>{translations.current['Compare Ledgers'] ?? 'Compare Ledgers'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Compare Ledgers'] ?? 'Compare Ledgers'}</legend>
  <p class="intro">
    {introItems[0]}<strong>{session.current?.businessName ?? '…'}</strong>{introItems[1] ?? ''}
  </p>

{#if loading}
  <p>Loading…</p>
{:else if error}
  <p class="error">{error}</p>
{:else}
  <div class="card picker">
    <fieldset>
      <legend>{translations.current['Ledger A'] ?? 'Ledger A'}</legend>
      <select bind:value={ledgerA} onchange={loadComparison}>
        {#each ledgers as l}
          <option value={translations.current[l.name] ?? l.name}>{translations.current[l.name] ?? l.name}</option>
        {/each}
      </select>
    </fieldset>
    <fieldset>
      <legend>{translations.current['Ledger'] ?? 'Ledger'} B</legend>
      <select bind:value={compareToLedger} onchange={loadComparison}>
        {#each ledgers.filter((l) => l.name !== ledgerA) as l}
          <option value={translations.current[l.name] ?? l.name}>{translations.current[l.name] ?? l.name}</option>
        {/each}
      </select>
    </fieldset>
  </div>

  {#if plCmp}
    <div class="card section">
      <h3>{translations.current['Profit and Loss Statement'] ?? 'Profit and Loss'} — {plCmp.ledgerA} vs {plCmp.ledgerB}</h3>
      <table>
        <thead>
          <tr>
            <th>{translations.current['Account'] ?? 'Account'}</th>
            <th class="num">{plCmp.ledgerA}</th>
            <th class="num">{plCmp.ledgerB}</th>
            <th class="num">{translations.current['Variance'] ?? 'Variance'}</th>
          </tr>
        </thead>
        <tbody>
          <tr class="group-heading"><td colspan="4">{translations.current['Income'] ?? 'Income'}</td></tr>
          {#each plCmp.income as line}
            <tr>
              <td>{translations.current[line.name] ?? line.name}</td>
              <td class="num mono" class:amount-debit={line.a_minor < 0}>{fmtNet(line.a_minor)}</td>
              <td class="num mono" class:amount-debit={line.b_minor < 0}>{fmtNet(line.b_minor)}</td>
              <td class="num mono" class:amount-credit={line.variance_minor > 0} class:amount-debit={line.variance_minor < 0}>
                {fmtVariance(line.variance_minor, line.variance_minor < 0)}
              </td>
            </tr>
          {/each}
          <tr class="group-heading"><td colspan="4">{translations.current['Expenses'] ?? 'Expenses'}</td></tr>
          {#each plCmp.expenses as line}
            <tr>
              <td>{translations.current[line.name] ?? line.name}</td>
              <td class="num mono" class:amount-debit={line.a_minor < 0}>{fmtNet(line.a_minor)}</td>
              <td class="num mono" class:amount-debit={line.b_minor < 0}>{fmtNet(line.b_minor)}</td>
              <td class="num mono" class:amount-debit={line.variance_minor > 0} class:amount-credit={line.variance_minor < 0}>
                {fmtVariance(line.variance_minor, line.variance_minor > 0)}
              </td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr>
            <td><strong>{translations.current['Net Income'] ?? 'Net Income'}</strong></td>
            <td class="num mono" class:amount-debit={plCmp.a_net_income_minor < 0}><strong>{fmtNet(plCmp.a_net_income_minor)}</strong></td>
            <td class="num mono" class:amount-debit={plCmp.b_net_income_minor < 0}><strong>{fmtNet(plCmp.b_net_income_minor)}</strong></td>
            <td
              class="num mono"
              class:amount-credit={plCmp.net_income_variance_minor > 0}
              class:amount-debit={plCmp.net_income_variance_minor < 0}
            >
              <strong>{fmtVariance(plCmp.net_income_variance_minor, plCmp.net_income_variance_minor < 0)}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  {/if}

  {#if tbCmp}
    <div class="card section">
      <h3>{translations.current['Trial Balance'] ?? 'Trial Balance'} — {tbCmp.ledgerA} vs {tbCmp.ledgerB}</h3>
      <table>
        <thead>
          <tr>
            <th>{translations.current['Account'] ?? 'Account'}</th>
            <th class="num">{tbCmp.ledgerA} {translations.current['Debit'] ?? 'Debit'}</th>
            <th class="num">{tbCmp.ledgerA} {translations.current['Credit'] ?? 'Credit'}</th>
            <th class="num">{tbCmp.ledgerB} {translations.current['Debit'] ?? 'Debit'}</th>
            <th class="num">{tbCmp.ledgerB} {translations.current['Credit'] ?? 'Credit'}</th>
          </tr>
        </thead>
        <tbody>
          {#each tbCmp.rows as row}
            <tr>
              <td>{translations.current[row.name] ?? row.name}</td>
              <td class="num mono amount-debit">{row.a_debit_minor ? fmt(row.a_debit_minor) : ''}</td>
              <td class="num mono amount-credit">{row.a_credit_minor ? fmt(row.a_credit_minor) : ''}</td>
              <td class="num mono amount-debit">{row.b_debit_minor ? fmt(row.b_debit_minor) : ''}</td>
              <td class="num mono amount-credit">{row.b_credit_minor ? fmt(row.b_credit_minor) : ''}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{/if}
</fieldset>

<style>
  .intro {
    max-width: 60ch;
  }

.picker {
    padding: 0.9rem 1.2rem;
    margin-bottom: 1.2rem;
    display: flex;
    gap: 0.8rem;
  }

  .section {
    padding: 1rem 1.2rem 1.2rem;
    margin-bottom: 1.2rem;
  }

  .group-heading td {
    font-weight: 600;
    color: var(--ink-soft);
    font-size: var(--font-size-small);
    letter-spacing: 0.02em;
    border-bottom: none;
    padding-top: 0.9rem;
  }

  tfoot td {
    border-bottom: none;
    border-top: 2px solid var(--rule-strong);
  }
</style>
