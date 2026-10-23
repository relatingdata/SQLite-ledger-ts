<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { auth } from '$lib/state.svelte';
  import { getLedgers, getTrialBalance, asLedgerName, ApiError, type TrialBalance, type TrialBalanceRow, type TrialBalanceCurrencySubtotal } from '$lib/api';
  import { translations } from '$lib/state.svelte';
  import { formatAmount, todayIsoDate } from '$lib/format';

  let ledgers: { id: number; name: string }[] = $state([]);
  let selectedLedger = $state('');
  let tb: TrialBalance | null = $state(null);
  let loading = $state(true);
  let error = $state('');
  let asOfDate = $state(todayIsoDate());

  let latestRequestId = 0;
  // Same {@html}-reactivity fix as Balance Sheet — see docs/pm-frontend-reference.md.
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

  // Grouped by currency, quantity currencies shown as whole numbers — see docs/pm-frontend-reference.md.
  interface CurrencyGroup {
    currency: string | null;
    rows: TrialBalanceRow[];
    subtotal: { total_debit_minor: number; total_credit_minor: number; balanced: boolean } | undefined;
  }
  function groupByCurrency(result: TrialBalance | null): CurrencyGroup[] {
    if (!result) return [];
    const allRows: TrialBalanceRow[] = result.rows;
    const subtotals: TrialBalanceCurrencySubtotal[] = result.by_currency;
    const currencies: (string | null)[] = [];
    for (const r of allRows) if (!currencies.includes(r.currency)) currencies.push(r.currency);
    currencies.sort((a, b) => (a ?? '').localeCompare(b ?? ''));
    return currencies.map((currency) => ({
      currency,
      rows: allRows.filter((r) => r.currency === currency),
      subtotal: subtotals.find((c) => c.currency === currency),
    }));
  }
  let groups = $derived(groupByCurrency(tb));
  const isMonetary = (currency: string | null) => currency === null || !currency.startsWith('SPACE-');
  const fmtForCurrency = (amount: number, currency: string | null) => (isMonetary(currency) ? fmt(amount) : amount.toLocaleString());
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
  {#each groups as group}
    <div class="grid-box currency-group">
      <h3 class="currency-label">
        {group.currency ?? (translations.current['Home Currency'] ?? 'Home Currency')}
        {#if group.subtotal && !group.subtotal.balanced}
          <span class="warn">⚠ {translations.current['Out of balance'] ?? 'Out of balance'}</span>
        {/if}
      </h3>
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
          {#each group.rows as row}
            <tr>
              <td class="mono">{row.accountnumber ?? ''}</td>
              <td>
                {translations.current[row.name] ?? row.name}
                {#if row.has_quantity_postings}
                  <span class="badge" title={translations.current['This account mixes a real quantity-tracking posting with an ordinary dollar posting - its balance may not be a plain dollar figure without a closer look.'] ?? "This account mixes a real quantity-tracking posting with an ordinary dollar posting - its balance may not be a plain dollar figure without a closer look."}>{translations.current['qty'] ?? 'qty'}</span>
                {/if}
              </td>
              <td class="num mono amount-debit">{row.debit_minor ? fmtForCurrency(row.debit_minor, row.currency) : ''}</td>
              <td class="num mono amount-credit">{row.credit_minor ? fmtForCurrency(row.credit_minor, row.currency) : ''}</td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr class="totals-row">
            <td colspan="2"><strong>{translations.current['Subtotal'] ?? 'Subtotal'}</strong></td>
            <td class="num mono amount-debit"><strong>{fmtForCurrency(group.subtotal?.total_debit_minor ?? 0, group.currency)}</strong></td>
            <td class="num mono amount-credit"><strong>{fmtForCurrency(group.subtotal?.total_credit_minor ?? 0, group.currency)}</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>
  {/each}

  {#if groups.length === 1}
    <!-- Per the User Manual's own specification: the combined total is
         only genuinely meaningful, and only shown, when exactly one
         currency is present - summing different currencies together
         is not a real number. -->
    <p class="status" class:balanced={tb.total_debit_minor === tb.total_credit_minor}>
      {tb.total_debit_minor === tb.total_credit_minor ? '✓ Balanced' : 'Out of balance'}
    </p>
  {:else if groups.length > 1}
    <p class="hint">{translations.current['More than one currency is present - see each currency\'s own subtotal above; a single combined total across different currencies would not be a real number.'] ?? "More than one currency is present - see each currency's own subtotal above; a single combined total across different currencies would not be a real number."}</p>
  {/if}
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

  .currency-group {
    margin-bottom: 1.5rem;
  }

  .currency-label {
    margin: 0;
    padding: 0.5rem 0.8rem;
    font-size: var(--font-size-base);
    background: var(--rule);
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .warn {
    color: var(--danger, #b00);
    font-weight: 600;
    font-size: 0.9em;
  }

  .badge {
    display: inline-block;
    font-size: 0.75em;
    padding: 0.05em 0.4em;
    border-radius: 3px;
    background: var(--rule-strong);
    color: var(--ink-soft);
    margin-left: 0.4em;
    cursor: help;
  }

  .hint {
    text-align: center;
    color: var(--ink-soft);
    margin-top: 1rem;
  }
</style>
