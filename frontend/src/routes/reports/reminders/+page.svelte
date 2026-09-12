<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { formatAmount, todayIsoDate } from '$lib/format';
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { getReminderCandidates, sendReminder, resetReminder, ApiError, type ReminderCandidate } from '$lib/api';
  import { translations } from '$lib/state.svelte';

  let candidates: ReminderCandidate[] = [];
  let loading = true;
  let error = '';
  let message = '';
  let asOfDate = todayIsoDate();

  let latestRequestId = 0;
  async function load() {
    if (!session.current) return;
    const requestId = ++latestRequestId;
    loading = true;
    error = '';
    try {
      const result = await getReminderCandidates(session.current.businessName, session.current.ledgerName, asOfDate || undefined);
      if (requestId !== latestRequestId) return;
      candidates = result;
    } catch (e) {
      if (requestId !== latestRequestId) return;
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      if (requestId === latestRequestId) loading = false;
    }
  }

  onMount(load);

  async function send(counterparty: string) {
    error = '';
    message = '';
    try {
      const { new_level } = await sendReminder(counterparty);
      message = `Sent level ${new_level} reminder to ${counterparty}.`;
      await load();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not send.';
    }
  }

  async function reset(counterparty: string) {
    error = '';
    message = '';
    try {
      await resetReminder(counterparty);
      message = `Reset reminder level for ${counterparty}.`;
      await load();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not reset.';
    }
  }

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');
  const levelLabel = (l: number) => (l === 0 ? 'None sent' : l === 1 ? 'Level 1 (polite)' : l === 2 ? 'Level 2' : 'Level 3 (firm)');
</script>

<svelte:head><title>{translations.current['Reminders'] ?? 'Reminders'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Reminders'] ?? 'Reminders'}</legend>
  <p class="intro">{translations.current['Customers with an overdue balance right now. Sending a reminder advances their level (up to 3, the firmest) — the next one for the same customer is already pre-set to the following level.'] ?? 'Customers with an overdue balance right now. Sending a reminder advances their level (up to 3, the firmest) — the next one for the same customer is already pre-set to the following level.'}</p>
<div class="controls">
  <fieldset>
    <legend>{translations.current['As of date'] ?? 'As of date'}</legend>
    <input type="date" bind:value={asOfDate} onchange={load} />
  </fieldset>
</div>

{#if loading}
  <p>Loading…</p>
{:else if error}
  <p class="error">{error}</p>
{:else}
  {#if message}<p class="success">{message}</p>{/if}
  <div class="grid-box">
    <table>
      <thead>
        <tr>
          <th>{translations.current['Customer'] ?? 'Customer'}</th>
          <th class="num">{translations.current['Outstanding'] ?? 'Outstanding'}</th>
          <th class="num">{translations.current['Oldest (days)'] ?? 'Oldest (days)'}</th>
          <th>{translations.current['Current level'] ?? 'Current level'}</th>
          <th>{translations.current['Next'] ?? 'Next'}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#if candidates.length === 0}
          <tr><td colspan="6" class="empty">{translations.current['No overdue customers.'] ?? 'No overdue customers.'}</td></tr>
        {/if}
        {#each candidates as c}
          <tr>
            <td>{c.counterparty}</td>
            <td class="num mono">{fmt(c.outstanding_minor)}</td>
            <td class="num mono">{c.oldest_days_overdue}</td>
            <td>{levelLabel(c.current_level)}</td>
            <td>{levelLabel(c.next_level)}</td>
            <td class="actions">
              <button class="btn secondary" onclick={() => send(c.counterparty)}>{translations.current['Send'] ?? 'Send'} reminder</button>
              {#if c.current_level > 0}
                <button class="link" onclick={() => reset(c.counterparty)}>{translations.current['Reset'] ?? 'Reset'}</button>
              {/if}
            </td>
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
    justify-content: center;
    margin-bottom: 1.2rem;
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
  .actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .link {
    background: none;
    border: none;
    color: var(--brass-dark);
    text-decoration: underline;
    cursor: pointer;
    font-size: var(--font-size-small);
  }
  .success {
    color: var(--credit);
  }
</style>
