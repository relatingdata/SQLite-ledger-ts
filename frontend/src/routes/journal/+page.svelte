<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { onMount } from 'svelte';
  import { listJournalEntries, type JournalSummary } from '$lib/api';
  import { translations } from '$lib/state.svelte';
  import { session } from '$lib/state.svelte';
  import { createPaginator } from '$lib/pagination';
  import Pager from '$lib/Pager.svelte';

  const journal = createPaginator<JournalSummary>((limit, offset) => {
    if (!session.current) return Promise.resolve({ items: [], totalCount: 0 });
    return listJournalEntries(session.current.businessName, session.current.ledgerName, limit, offset).then((r) => ({ items: r.rows, totalCount: r.totalCount }));
  });

  onMount(journal.load);

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');
</script>

<svelte:head><title>{translations.current['Journal Entries'] ?? 'Journal Entries'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Journal Entries'] ?? 'Journal Entries'}</legend>
{#if $journal.loading}
  <p>Loading…</p>
{:else if $journal.error}
  <p class="error">{$journal.error}</p>
{:else if $journal.items.length === 0}
  <p class="empty">
    {translations.current['No Entries Yet'] ?? 'No entries yet.'} <a href="/post">{translations.current['Post The First One'] ?? 'Post the first one.'}</a>
  </p>
{:else}
  <div class="card">
    <table>
      <thead>
        <tr>
          <th>{translations.current['Date'] ?? 'Date'}</th>
          <th>{translations.current['Reference'] ?? 'Reference'}</th>
          <th>{translations.current['Description'] ?? 'Description'}</th>
          <th class="num">{translations.current['Debit'] ?? 'Debit'}</th>
          <th class="num">{translations.current['Credit'] ?? 'Credit'}</th>
        </tr>
      </thead>
      <tbody>
        {#each $journal.items as tx}
          <tr>
            <td>{tx.occurrence_date ?? ''}</td>
            <td>
              <a href="/journal/{tx.journal_id}/{tx.occurrence_date}">{tx.reference}</a>
              {#if tx.recurrence !== 'once'}<span class="badge">{tx.recurrence}</span>{/if}
            </td>
            <td>{tx.description}</td>
            <td class="num mono amount-debit">{fmt(tx.total_debit_minor)}</td>
            <td class="num mono amount-credit">{fmt(tx.total_credit_minor)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <Pager paginator={journal} />
{/if}

</fieldset>
<style>
  .badge {
    display: inline-block;
    margin-left: 0.4rem;
    padding: 0.05em 0.4em;
    border-radius: 3px;
    background: var(--rule);
    font-size: var(--font-size-small);
    color: var(--ink-soft);
  }

  .empty {
    color: var(--ink-soft);
  }
</style>
