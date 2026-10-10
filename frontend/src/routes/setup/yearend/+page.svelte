<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import { getEntityTree, previewCloseBooks, closeBooks, ApiError, type EntityNode, type CloseBooksResult, type CloseBooksPreview } from '$lib/api';

  let entities: EntityNode[] = [];
  let loading = true;
  let error = '';

  let asOfDate = new Date().toISOString().slice(0, 10);
  let retainedEarningsAccount = '';

  let previewing = false;
  let previewError = '';
  let preview: CloseBooksPreview | null = null;

  let closing = false;
  let closeError = '';
  let result: CloseBooksResult | null = null;

  onMount(async () => {
    try {
      entities = await getEntityTree();
      const byId = new Map(entities.map((e) => [e.id, e]));
      function isUnderEquity(e: EntityNode): boolean {
        let cur: EntityNode | undefined = e;
        while (cur) {
          if (cur.name === 'Equity') return true;
          cur = cur.parent_id !== null ? byId.get(cur.parent_id) : undefined;
        }
        return false;
      }
      const equityAccounts = entities.filter((e) => e.is_postable_account && isUnderEquity(e));
      const ownersEquity = equityAccounts.find((e) => e.name === "Owner's Equity");
      retainedEarningsAccount = ownersEquity?.name ?? equityAccounts[0]?.name ?? '';
      equityAccountOptions = equityAccounts;
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  });

  let equityAccountOptions: EntityNode[] = [];

  function resetProposal() {
    preview = null;
    previewError = '';
    result = null;
    closeError = '';
  }

  async function fetchPreview() {
    if (!session.current || !retainedEarningsAccount) return;
    previewing = true;
    previewError = '';
    preview = null;
    result = null;
    try {
      preview = await previewCloseBooks({ ledger: session.current.ledgerName, asOfDate, retainedEarningsAccount });
    } catch (e) {
      previewError = e instanceof ApiError ? e.message : 'Could not preview the close.';
    } finally {
      previewing = false;
    }
  }

  async function acceptAndClose() {
    if (!session.current || !preview) return;
    closing = true;
    closeError = '';
    try {
      result = await closeBooks({
        business: session.current.businessName,
        ledger: session.current.ledgerName,
        asOfDate,
        retainedEarningsAccount,
      });
      preview = null;
    } catch (e) {
      closeError = e instanceof ApiError ? e.message : 'Could not close the books.';
    } finally {
      closing = false;
    }
  }

  function reject() {
    preview = null;
    previewError = '';
  }

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');
</script>

<svelte:head><title>{translations.current['Year End Close'] ?? 'Year End Close'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Year End Close'] ?? 'Year End Close'}</legend>
  <p class="intro">
    {translations.current['A real, one-time close: zeros every real income and expense account, posting the real, net difference into a real equity account as one, single, balanced entry.'] ?? 'A real, one-time close: zeros every real income and expense account, posting the real, net difference into a real equity account as one, single, balanced entry.'}
  </p>
  <p class="intro">
    {translations.current['Real balance-sheet accounts — Cash, Inventory, Accounts Receivable/Payable, and every other real asset/liability — are never touched by this process at all. Their real, ending balance simply carries forward as-is, automatically becoming the new period\'s own opening balance, since a real balance-sheet account is a genuine, persistent running total, not something that resets each period the way income and expense do.'] ?? 'Real balance-sheet accounts — Cash, Inventory, Accounts Receivable/Payable, and every other real asset/liability — are never touched by this process at all. Their real, ending balance simply carries forward as-is, automatically becoming the new period\'s own opening balance, since a real balance-sheet account is a genuine, persistent running total, not something that resets each period the way income and expense do.'}
  </p>
{#if loading}
  <p class="center-text">Loading…</p>
{:else}
  <div class="card form-card">
    <p class="context-line">
      <strong>{session.current?.businessName ?? ''}</strong> — {session.current?.ledgerName ?? ''}
    </p>

    <div class="row-2">
      <fieldset>
        <legend>{translations.current['As of date'] ?? 'As of date'}</legend>
        <input type="date" bind:value={asOfDate} onchange={resetProposal} />
      </fieldset>
      <fieldset>
        <legend>{translations.current['Retained earnings account'] ?? 'Retained earnings account'}</legend>
        <select bind:value={retainedEarningsAccount} onchange={resetProposal}>
          {#each equityAccountOptions as acc}<option value={translations.current[acc.name] ?? acc.name}>{translations.current[acc.name] ?? acc.name}</option>{/each}
        </select>
      </fieldset>
    </div>

    {#if !preview && !result}
      <p class="hint">
        {translations.current['Nothing posts yet — the next step shows the real, proposed general journal entry for you to review, before anything is actually closed.'] ?? 'Nothing posts yet — the next step shows the real, proposed general journal entry for you to review, before anything is actually closed.'}
      </p>
      {#if previewError}<p class="error">{previewError}</p>{/if}
      <button class="btn" onclick={fetchPreview} disabled={previewing || !retainedEarningsAccount}>
        {previewing ? 'Loading…' : (translations.current['Preview the close'] ?? 'Preview the close')}
      </button>
    {/if}

    {#if preview}
      <div class="preview-box">
        <p class="preview-heading">{translations.current['Proposed general journal entry'] ?? 'Proposed general journal entry'}</p>
        <table class="preview-table">
          <thead>
            <tr>
              <th>{translations.current['Account'] ?? 'Account'}</th>
              <th class="num">{translations.current['Debit'] ?? 'Debit'}</th>
              <th class="num">{translations.current['Credit'] ?? 'Credit'}</th>
            </tr>
          </thead>
          <tbody>
            {#each preview.lines as line}
              <tr>
                <td>{line.account}</td>
                <td class="num">{line.amount_minor > 0 ? fmt(line.amount_minor) : ''}</td>
                <td class="num">{line.amount_minor < 0 ? fmt(-line.amount_minor) : ''}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p class="preview-net">{translations.current['Net Income'] ?? 'Net Income'}: <strong>{fmt(preview.netIncomeMinor)}</strong></p>

        {#if preview.divisionBreakdown.length > 0}
          <p class="division-heading">{translations.current['Summary by division/location (informational — every division rolls into the one, combined Retained Earnings line above)'] ?? 'Summary by division/location (informational — every division rolls into the one, combined Retained Earnings line above)'}:</p>
          <ul class="division-list">
            {#each preview.divisionBreakdown as d}
              <li>{d.division ?? (translations.current['(No division)'] ?? '(No division)')}: {fmt(d.netIncomeMinor)}</li>
            {/each}
          </ul>
        {/if}

        {#if closeError}<p class="error">{closeError}</p>{/if}
        <div class="decision-row">
          <button class="btn secondary" onclick={reject} disabled={closing}>{translations.current['Reject'] ?? 'Reject'}</button>
          <button class="btn" onclick={acceptAndClose} disabled={closing}>
            {closing ? 'Closing…' : (translations.current['Accept and close'] ?? 'Accept and close')}
          </button>
        </div>
      </div>
    {/if}

    {#if result}
      <div class="close-result">
        <p><strong>{translations.current['Closed'] ?? 'Closed'}: {result.reference}</strong></p>
        <p>{translations.current['Net Income'] ?? 'Net Income'}: {fmt(result.netIncomeMinor)}</p>
        <p>{translations.current['Accounts zeroed'] ?? 'Accounts zeroed'}: {result.accountsZeroed}</p>
        {#if result.divisionBreakdown.length > 0}
          <p class="division-heading">{translations.current['By division/location profit center'] ?? 'By division/location profit center'}:</p>
          <ul class="division-list">
            {#each result.divisionBreakdown as d}
              <li>{d.division ?? (translations.current['(No division)'] ?? '(No division)')}: {fmt(d.netIncomeMinor)}</li>
            {/each}
          </ul>
        {/if}
        <p class="opening-note">
          {translations.current['Every real balance-sheet account — Inventory, Cash, Accounts Receivable/Payable — is unchanged and needs no further action: its real, current balance is already the new period\'s opening balance.'] ?? 'Every real balance-sheet account — Inventory, Cash, Accounts Receivable/Payable — is unchanged and needs no further action: its real, current balance is already the new period\'s opening balance.'}
        </p>
      </div>
    {/if}
  </div>
{/if}

</fieldset>
<style>
  .intro {
    max-width: 70ch;
  }
  .intro + .intro {
    margin-top: 0.6rem;
  }
  .center-text {
    text-align: center;
  }
  .context-line {
    font-size: var(--font-size-base);
    color: var(--ink-soft);
    margin: 0 0 0.8rem;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--rule);
  }
  .form-card {
    max-width: 720px;
    margin: 0 auto 1.2rem;
    padding: 1.2rem 1.3rem;
    border: 1px solid var(--rule-strong, #ccc);
    border-radius: 8px;
    background: var(--paper);
  }
  .row-2 {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.6rem;
  }
  .row-2 fieldset {
    flex: 1;
  }
  .hint {
    font-size: var(--font-size-base);
    color: var(--ink-soft);
    margin: 0.6rem 0;
  }
  .error {
    color: var(--debit, #a33a2e);
  }
  .preview-box {
    margin: 1rem 0;
    padding: 0.8rem 1rem;
    border: 1px solid #d9a441;
    border-radius: 6px;
    background: #fdf6e8;
    color: #6b4c14;
  }
  .preview-heading {
    font-weight: 600;
    margin: 0 0 0.5rem;
  }
  .preview-table th,
  .preview-table td {
    padding: 0.35rem 0.5rem;
    text-align: left;
    border-bottom: 1px solid var(--rule);
  }
  .preview-table th.num,
  .preview-table td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .preview-net {
    margin: 0.6rem 0 0;
    font-size: var(--font-size-medium);
  }
  .decision-row {
    display: flex;
    gap: 0.6rem;
    margin-top: 0.8rem;
  }
  .close-result {
    padding: 0.6rem 0.8rem;
    border-radius: 5px;
    background: #eaf5ea;
    color: #2a5c2a;
    margin: 0.8rem 0;
  }
  .close-result p {
    margin: 0.15rem 0;
  }
  .opening-note {
    margin-top: 0.6rem !important;
    font-style: italic;
  }
  .division-heading {
    margin-top: 0.6rem !important;
    font-weight: 600;
  }
  .division-list {
    margin: 0.2rem 0 0;
    padding-left: 1.2rem;
    font-size: var(--font-size-medium);
  }
  .division-list li {
    margin: 0.1rem 0;
  }
  .line-division {
    color: var(--ink-soft);
    font-size: var(--font-size-base);
    font-style: italic;
  }
</style>
