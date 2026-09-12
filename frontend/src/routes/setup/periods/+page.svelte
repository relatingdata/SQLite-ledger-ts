<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import { getBusinesses, getLedgers, getPeriodStatus, closePeriod, reopenPeriod, asBusinessName, asLedgerName, ApiError, type PeriodLockStatus } from '$lib/api';

  let businesses: { id: number; name: string }[] = [];
  let ledgers: { id: number; name: string }[] = [];
  let loading = true;
  let error = '';
  let message = '';
  let working = false;

  let business = '';
  let ledger = '';
  let status: PeriodLockStatus | null = null;
  let throughDate = new Date().toISOString().slice(0, 10);

  onMount(async () => {
    try {
      businesses = await getBusinesses();
      business = session.current?.businessName ?? businesses[0]?.name ?? '';
      await loadLedgers();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  });

  async function loadLedgers() {
    if (!business) return;
    ledgers = await getLedgers(business);
    if (!ledger || !ledgers.some((l) => l.name === ledger)) {
      ledger = session.current?.ledgerName && ledgers.some((l) => l.name === session.current!.ledgerName) ? session.current.ledgerName : ledgers[0]?.name ?? '';
    }
    await refreshStatus();
  }

  async function refreshStatus() {
    if (!business || !ledger) return;
    status = await getPeriodStatus(asBusinessName(business), asLedgerName(ledger));
  }

  async function doClose() {
    error = '';
    message = '';
    working = true;
    try {
      await closePeriod(asBusinessName(business), asLedgerName(ledger), throughDate);
      message = `Closed ${ledger} through ${throughDate}. Normal posting on or before that date will now be rejected.`;
      await refreshStatus();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not close this period.';
    } finally {
      working = false;
    }
  }

  async function doReopen() {
    error = '';
    message = '';
    working = true;
    try {
      await reopenPeriod(asBusinessName(business), asLedgerName(ledger));
      message = `Reopened ${ledger} — normal posting is allowed again, for corrections such as reversals, reposting, or contras.`;
      await refreshStatus();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not reopen this period.';
    } finally {
      working = false;
    }
  }
</script>

<svelte:head><title>{translations.current['Accounting Periods'] ?? 'Accounting Periods'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Accounting Periods'] ?? 'Accounting Periods'}</legend>
  <p class="intro">{translations.current['Closing a period rejects normal posting on or before the date you choose — protecting finalized history from being altered. It\'s never permanent: reopening lifts the block immediately, for a genuine correction (a reversal, a reposted entry, a contra), then you can close it again afterward.'] ?? 'Closing a period rejects normal posting on or before the date you choose — protecting finalized history from being altered. It\'s never permanent: reopening lifts the block immediately, for a genuine correction (a reversal, a reposted entry, a contra), then you can close it again afterward.'}</p>
{#if loading}
  <p>Loading…</p>
{:else}
  {#if error}<p class="error">{error}</p>{/if}
  {#if message}<p class="success">{message}</p>{/if}

  <div class="page-wrap">
    <div class="card form">
      <p class="context-line">
        <strong>{business}</strong> — {ledger}
      </p>

      {#if status}
        <div class="status" class:closed={status.locked_through_date}>
          {#if status.locked_through_date}
            <strong>{translations.current['Closed'] ?? 'Closed'}</strong> through {status.locked_through_date}
            {#if status.changed_at}<span class="dim"> — set {status.changed_at}</span>{/if}
          {:else}
            <strong>{translations.current['Open'] ?? 'Open'}</strong> — normal posting is allowed on any date
            {#if status.changed_at}<span class="dim"> — last changed {status.changed_at}</span>{/if}
          {/if}
        </div>
      {/if}

      <div class="row">
        <fieldset>
          <legend>{translations.current['Close through date'] ?? 'Close through date'}</legend>
          <input type="date" bind:value={throughDate} />
        </fieldset>
        <button class="btn" onclick={doClose} disabled={working}>{translations.current['Close period'] ?? 'Close period'}</button>
        <button class="btn secondary" onclick={doReopen} disabled={working || !status?.locked_through_date}>{translations.current['Reopen period'] ?? 'Reopen period'}</button>
      </div>
    </div>
  </div>
{/if}

</fieldset>
<style>

  .context-line {
    font-size: var(--font-size-base);
    color: var(--ink-soft);
    margin: 0;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--rule);
  }

  .page-wrap {
    display: flex;
    justify-content: center;
  }

  .form {
    padding: 1.2rem 1.3rem 1.4rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 560px;
    width: 100%;
  }

  .row {
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .status {
    padding: 0.7rem 0.9rem;
    border-radius: 8px;
    background: var(--credit-bg, #eef6ee);
    border: 1px solid var(--rule);
  }

  .status.closed {
    background: var(--debit-bg, #faf0ee);
  }

  .dim {
    color: var(--ink-soft);
    font-size: var(--font-size-base);
  }

  .success {
    color: var(--credit);
  }

  .secondary {
    background: transparent;
    border: 1px solid var(--rule-strong);
    color: var(--ink);
  }
</style>
