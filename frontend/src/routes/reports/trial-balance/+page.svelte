<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { auth } from '$lib/state.svelte';
  import { getLedgers, getTrialBalance, asLedgerName, ApiError, type TrialBalance } from '$lib/api';
  import { translations } from '$lib/state.svelte';
  import { formatAmount, todayIsoDate } from '$lib/format';

  let ledgers: { id: number; name: string }[] = $state([]);
  let selectedLedger = $state('');
  let tb: TrialBalance | null = $state(null);
  let loading = $state(true);
  let error = $state('');
  let asOfDate = $state(todayIsoDate());

  let latestRequestId = 0;
  // Same, real, confirmed fix as Balance Sheet — see there for why.
  let introTemplate = $derived(translations.current['Every account with a posted balance, split into its debit or credit column. Any ledger in {NAME} should balance — Actual, or any proposed budget.'] ?? 'Every account with a posted balance, split into its debit or credit column. Any ledger in {NAME} should balance — Actual, or any proposed budget.');
  let introItems = $derived(introTemplate.split('{NAME}'));
  async function load() {
    if (!selectedLedger) return;
    const requestId = ++latestRequestId;
    loading = true;
    try {
      const result = await getTrialBalance(session.current!.businessName, asLedgerName(selectedLedger), asOfDate || undefined);
      if (requestId !== latestRequestId) return;
      tb = result;
    } catch (e) {
      if (requestId !== latestRequestId) return;
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      if (requestId === latestRequestId) loading = false;
    }
  }

  onMount(async () => {
    if (!session.current) return;
    try {
      ledgers = await getLedgers(session.current.businessName);
      selectedLedger = session.current.ledgerName;
      await load();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
      loading = false;
    }
  });

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');
</script>

<svelte:head><title>{translations.current['Trial Balance'] ?? 'Trial Balance'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Trial Balance'] ?? 'Trial Balance'}</legend>
  <p class="intro">
    {introItems[0]}<strong>{session.current?.businessName ?? '…'}</strong>{introItems[1] ?? ''}
  </p>

  <div class="controls">
    <fieldset>
      <legend>{translations.current['Ledger'] ?? 'Ledger'}</legend>
      <select bind:value={selectedLedger} onchange={load}>
        {#each ledgers as l}<option value={translations.current[l.name] ?? l.name}>{translations.current[l.name] ?? l.name}</option>{/each}
      </select>
    </fieldset>
    <fieldset>
      <legend>{translations.current['As of date'] ?? 'As of date'}</legend>
      <input type="date" bind:value={asOfDate} onchange={load} />
    </fieldset>
    {#if asOfDate}<button class="link" onclick={() => { asOfDate = ''; load(); }}>{translations.current['Clear (show all time)'] ?? 'Clear (show all time)'}</button>{/if}
  </div>

{#if loading}
  <p>Loading…</p>
{:else if error}
  <p class="error">{error}</p>
{:else if tb}
  <div class="grid-box">
    <table>
      <thead>
        <tr>
          <th>{translations.current['Account Number'] ?? 'Account #'}</th>
          <th>{translations.current['Account'] ?? 'Account'}</th>
          <th class="num">{translations.current['Debit'] ?? 'Debit'}</th>
          <th class="num">{translations.current['Credit'] ?? 'Credit'}</th>
        </tr>
      </thead>
      <tbody>
        {#each tb.rows as row}
          <tr>
            <td class="mono">{row.accountnumber ?? ''}</td>
            <td>{translations.current[row.name] ?? row.name}</td>
            <td class="num mono amount-debit">{row.debit_minor ? fmt(row.debit_minor) : ''}</td>
            <td class="num mono amount-credit">{row.credit_minor ? fmt(row.credit_minor) : ''}</td>
          </tr>
        {/each}
      </tbody>
      <tfoot>
        <tr class="totals-row">
          <td colspan="2"><strong>{translations.current['Total'] ?? 'Total'}</strong></td>
          <td class="num mono amount-debit"><strong>{fmt(tb.total_debit_minor)}</strong></td>
          <td class="num mono amount-credit"><strong>{fmt(tb.total_credit_minor)}</strong></td>
        </tr>
      </tfoot>
    </table>
  </div>
  <p class="status" class:balanced={tb.total_debit_minor === tb.total_credit_minor}>
    {tb.total_debit_minor === tb.total_credit_minor ? '✓ Balanced' : 'Out of balance'}
  </p>
{/if}
</fieldset>

<style>
  .intro {
    max-width: 60ch;
  }

.grid-box {
    border: 1px solid var(--rule-strong);
    border-radius: 8px;
    overflow: hidden;
  }

  .grid-box table {
    margin: 0;
  }

  .grid-box th,
  .grid-box td {
    border-bottom: none;
  }

  .totals-row td {
    border-top: 2px solid var(--ink);
  }

  .status {
    margin-top: 1rem;
    font-weight: 600;
    color: var(--debit);
    text-align: center;
  }

  .status.balanced {
    color: var(--credit);
  }

  .controls {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 0.8rem;
    margin-bottom: 1rem;
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
