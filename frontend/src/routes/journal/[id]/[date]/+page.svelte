<script lang="ts">
  import { formatAmount } from '$lib/format';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { getJournalEntry, reverseJournalEntry as apiReverse, ApiError, type JournalDetail } from '$lib/api';
  import { translations } from '$lib/state.svelte';
  import { auth, hasRole } from '$lib/state.svelte';
  import { session } from '$lib/state.svelte';

  let entry: JournalDetail | null = $state(null);
  let loading = $state(true);
  let error = $state('');
  let reversing = $state(false);

  let journalId = $derived(Number($page.params.id));
  let occurrenceDate = $derived($page.params.date);
  let isAlreadyAReversal = $derived.by(() => entry?.reference.includes('-REV-') ?? false);

  onMount(async () => {
    if (!occurrenceDate) {
      error = 'Missing occurrence date.';
      loading = false;
      return;
    }
    try {
      entry = session.current ? await getJournalEntry(session.current.businessName, session.current.ledgerName, journalId, occurrenceDate) : null;
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  });

  async function reverse() {
    if (!occurrenceDate || !confirm('Reverse this entry? This posts a new offsetting entry — it does not delete or edit this one.')) return;
    error = '';
    reversing = true;
    try {
      if (session.current) await apiReverse(session.current.businessName, session.current.ledgerName, journalId, occurrenceDate);
      goto('/journal');
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not reverse this entry.';
    } finally {
      reversing = false;
    }
  }

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');
</script>

<svelte:head><title>Journal Entry {entry?.reference ?? ''}</title></svelte:head>

{#if loading}
  <p>Loading…</p>
{:else if !entry}
  <p class="error">{error}</p>
{:else}
  {#if error}<p class="error">{error}</p>{/if}
  <fieldset class="page-title">
  <legend>{entry.reference}</legend>
  <div class="header-row">
    {#if hasRole(auth.current, 'Administrator', 'Bookkeeper') && !isAlreadyAReversal}
      <button class="btn secondary" onclick={reverse} disabled={reversing}>{reversing ? 'Reversing…' : 'Reverse'}</button>
    {/if}
  </div>
  <p class="meta">
    {entry.occurrence_date ?? ''} — {entry.description || 'No description'} · {entry.business} / {entry.ledger}
    {#if entry.recurrence !== 'once'}
      <span class="badge">recurring ({entry.recurrence})</span>
    {/if}
  </p>

    <table>
      <thead>
        <tr>
          <th>{translations.current['Account'] ?? 'Account'}</th>
          <th>{translations.current['Account Number'] ?? 'Account #'}</th>
          <th>{translations.current['Memo'] ?? 'Memo'}</th>
          <th class="num">{translations.current['Debit'] ?? 'Debit'}</th>
          <th class="num">{translations.current['Credit'] ?? 'Credit'}</th>
        </tr>
      </thead>
      <tbody>
        {#each entry.lines as line}
          <tr>
            <td>{line.account}</td>
            <td class="mono">{line.accountnumber ?? ''}</td>
            <td>{line.memo}</td>
            <td class="num mono amount-debit">{line.amount_minor > 0 ? fmt(line.amount_minor) : ''}</td>
            <td class="num mono amount-credit">{line.amount_minor < 0 ? fmt(-line.amount_minor) : ''}</td>
          </tr>
        {/each}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3"><strong>{translations.current['Total'] ?? 'Total'}</strong></td>
          <td class="num mono amount-debit"><strong>{fmt(entry.total_debit_minor)}</strong></td>
          <td class="num mono amount-credit"><strong>{fmt(entry.total_credit_minor)}</strong></td>
        </tr>
      </tfoot>
    </table>
  </fieldset>
{/if}
<style>
  .header-row {
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  .meta {
    color: var(--ink-soft);
    margin: 0.2rem 0 1.2rem;
  }

  .badge {
    display: inline-block;
    margin-left: 0.5rem;
    padding: 0.1em 0.5em;
    border-radius: 3px;
    background: var(--rule);
    font-size: var(--font-size-small);
  }

  tfoot td {
    border-bottom: none;
    border-top: 2px solid var(--rule-strong);
  }
</style>
