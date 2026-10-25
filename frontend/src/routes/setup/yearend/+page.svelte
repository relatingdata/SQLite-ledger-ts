<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import {
    getEntityTree,
    previewCloseBooks,
    stageLine,
    postJournalEntry,
    getLedgers,
    createLedger,
    resolveRolloverLines,
    getHierarchy,
    getReportingPeriods,
    asLedgerName,
    asAccountName,
    ApiError,
    type EntityNode,
    type CloseBooksResult,
    type CloseBooksPreview,
    type ResolvedRollover,
    type ReportingPeriod,
  } from '$lib/api';

  // Close-books breakdown by Location + configured hierarchy — see docs/pm-frontend-reference.md.
  let hierarchyPath: string[] = ['Location'];

  let entities: EntityNode[] = [];
  let loading = true;
  let error = '';

  let asOfDate = new Date().toISOString().slice(0, 10);
  let retainedEarningsAccount = '';

  // Real sub-annual close support — see docs/pm-domain-reference.md ("Reporting periods"). [] for
  // a business with no stored financial-year start/frequency, in which case this section simply
  // doesn't render and everything below works exactly as it always did (free-form date + ledger
  // name). closeBooks/rolloverToNewPeriod themselves already take an arbitrary date and ledger
  // name — what this adds is the business genuinely knowing its own period boundaries, rather
  // than the user having to compute "what's Q2 2026-27's end date" by hand.
  let reportingPeriods: ReportingPeriod[] = [];
  let selectedPeriodLabel = '';
  function applySelectedPeriod() {
    const period = reportingPeriods.find((p) => p.label === selectedPeriodLabel);
    if (!period) return;
    asOfDate = period.endDate;
    resetProposal();
    if (selectedLedgerOption === NEW_LEDGER_OPTION && !newLedgerName.trim()) {
      newLedgerName = `Actual ${period.label}`;
    }
    resetRollover();
  }

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
      if (session.current) {
        ledgers = await getLedgers(session.current.businessName);
        try {
          const hierarchy = await getHierarchy(session.current.businessName);
          if (hierarchy.length > 0) hierarchyPath = ['Location', ...hierarchy.map((h) => h.grouping)];
        } catch {
          /* the close still works with just a Location breakdown if this fails */
        }
        try {
          reportingPeriods = await getReportingPeriods(session.current.businessName);
        } catch {
          reportingPeriods = []; // no stored reporting period — falls back to free-form date/ledger name
        }
      }
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
      preview = await previewCloseBooks({ business: session.current.businessName, ledger: session.current.ledgerName, asOfDate, retainedEarningsAccount, hierarchyPath });
    } catch (e) {
      previewError = e instanceof ApiError ? e.message : 'Could not preview the close.';
    } finally {
      previewing = false;
    }
  }

  // Posts preview.lines directly, not via closeBooks() — see docs/pm-frontend-reference.md.
  async function acceptAndClose() {
    if (!session.current || !preview) return;
    closing = true;
    closeError = '';
    try {
      const reference = `CLOSE-${session.current.ledgerName}-${asOfDate}`;
      for (const line of preview.lines) {
        await stageLine({
          reference,
          business: session.current.businessName,
          ledger: session.current.ledgerName,
          transdate: asOfDate,
          account: asAccountName(line.account),
          accountId: line.accountId,
          amount_minor: line.amount_minor,
          memo: line.account === retainedEarningsAccount ? 'Year-end close — net income retained' : 'Year-end close',
        });
      }
      await postJournalEntry(reference, session.current.businessName, session.current.ledgerName);
      result = { reference, netIncomeMinor: preview.netIncomeMinor, accountsZeroed: preview.accountsZeroed, groupBreakdown: preview.groupBreakdown, profitCenterBreakdown: preview.profitCenterBreakdown };
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

  // --- Roll over to a new period — see docs/pm-frontend-reference.md.
  const NEW_LEDGER_OPTION = '__new__';
  let ledgers: { id: number; name: string }[] = [];
  let selectedLedgerOption = NEW_LEDGER_OPTION;
  let newLedgerName = '';

  let rolloverResolving = false;
  let rolloverError = '';
  let rolloverResolved: ResolvedRollover | null = null;

  let rolloverPosting = false;
  let rolloverPostError = '';
  let rolloverResult: { reference: string; accountsCarriedForward: number; newLedger: string } | null = null;

  function targetLedgerName(): string {
    return selectedLedgerOption === NEW_LEDGER_OPTION ? newLedgerName.trim() : selectedLedgerOption;
  }

  function resetRollover() {
    rolloverResolved = null;
    rolloverError = '';
    rolloverResult = null;
    rolloverPostError = '';
  }

  async function resolveRollover() {
    if (!session.current) return;
    const target = targetLedgerName();
    if (!target) {
      rolloverError = 'Name the new ledger first.';
      return;
    }
    resetRollover();
    rolloverResolving = true;
    try {
      if (selectedLedgerOption === NEW_LEDGER_OPTION) {
        try {
          await createLedger(session.current.businessName, asLedgerName(target));
        } catch (e) {
          // Rolling into an existing ledger from a half-finished attempt is valid — see docs/pm-frontend-reference.md.
          if (!(e instanceof ApiError)) throw e;
        }
        ledgers = await getLedgers(session.current.businessName);
      }
      rolloverResolved = await resolveRolloverLines({
        business: session.current.businessName,
        oldLedger: session.current.ledgerName,
        newLedger: asLedgerName(target),
        asOfDate,
      });
    } catch (e) {
      rolloverError = e instanceof ApiError ? e.message : 'Could not resolve the rollover.';
    } finally {
      rolloverResolving = false;
    }
  }

  async function acceptRollover() {
    if (!session.current || !rolloverResolved) return;
    const target = asLedgerName(targetLedgerName());
    rolloverPosting = true;
    rolloverPostError = '';
    try {
      for (const line of rolloverResolved.lines) {
        await stageLine({
          reference: rolloverResolved.reference,
          business: session.current.businessName,
          ledger: target,
          transdate: asOfDate,
          account: asAccountName(line.account),
          amount_minor: line.amount_minor,
          memo: `Opening balance carried forward from ${session.current.ledgerName}`,
        });
      }
      await postJournalEntry(rolloverResolved.reference, session.current.businessName, target);
      rolloverResult = { reference: rolloverResolved.reference, accountsCarriedForward: rolloverResolved.accountsCarriedForward, newLedger: target };
      rolloverResolved = null;
    } catch (e) {
      rolloverPostError = e instanceof ApiError ? e.message : 'Could not post the opening balances.';
    } finally {
      rolloverPosting = false;
    }
  }

  function rejectRollover() {
    rolloverResolved = null;
    rolloverError = '';
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

    {#if reportingPeriods.length > 0}
      <fieldset>
        <legend>{translations.current['Reporting period'] ?? 'Reporting period'}</legend>
        <select bind:value={selectedPeriodLabel} onchange={applySelectedPeriod}>
          <option value="">{translations.current['Pick a period…'] ?? 'Pick a period…'}</option>
          {#each reportingPeriods as p}<option value={p.label}>{p.label} ({translations.current['ends'] ?? 'ends'} {p.endDate})</option>{/each}
        </select>
        <p class="field-note">
          {translations.current["Computed from this business's own financial-year start date and reporting frequency — pick one to fill in the as-of date (and, below, a suggested new ledger name) instead of working it out by hand."] ?? "Computed from this business's own financial-year start date and reporting frequency — pick one to fill in the as-of date (and, below, a suggested new ledger name) instead of working it out by hand."}
        </p>
      </fieldset>
    {/if}
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

        {#if preview.groupBreakdown.length > 0}
          <p class="group-heading">{translations.current['Summary by division/location (informational — every division rolls into the one, combined Retained Earnings line above)'] ?? 'Summary by division/location (informational — every division rolls into the one, combined Retained Earnings line above)'}:</p>
          <ul class="group-list">
            {#each preview.groupBreakdown as d}
              <li>{d.group ?? (translations.current['(No division)'] ?? '(No division)')}: {fmt(d.netIncomeMinor)}</li>
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
        {#if result.groupBreakdown.length > 0}
          <p class="group-heading">{translations.current['By division/location profit center'] ?? 'By division/location profit center'}:</p>
          <ul class="group-list">
            {#each result.groupBreakdown as d}
              <li>{d.group ?? (translations.current['(No division)'] ?? '(No division)')}: {fmt(d.netIncomeMinor)}</li>
            {/each}
          </ul>
        {/if}
        <p class="opening-note">
          {translations.current['Every real balance-sheet account — Inventory, Cash, Accounts Receivable/Payable — is unchanged and needs no further action: its real, current balance is already the new period\'s opening balance.'] ?? 'Every real balance-sheet account — Inventory, Cash, Accounts Receivable/Payable — is unchanged and needs no further action: its real, current balance is already the new period\'s opening balance.'}
        </p>
      </div>
    {/if}
  </div>

  <div class="card form-card">
    <fieldset>
      <legend>{translations.current['Roll over to a new period'] ?? 'Roll over to a new period'}</legend>
      <p class="intro">
        {translations.current['Carries every real, non-zero Balance Sheet account — Cash, Inventory, Accounts Receivable/Payable, and every other real asset/liability/equity — forward into a new ledger as that ledger\'s own opening balance, as of the date above. Run this after closing the books above, since a real rollover should only ever carry forward real Balance Sheet accounts once Income/Expense have already been closed into Retained Earnings.'] ?? 'Carries every real, non-zero Balance Sheet account — Cash, Inventory, Accounts Receivable/Payable, and every other real asset/liability/equity — forward into a new ledger as that ledger\'s own opening balance, as of the date above. Run this after closing the books above, since a real rollover should only ever carry forward real Balance Sheet accounts once Income/Expense have already been closed into Retained Earnings.'}
      </p>

      <fieldset>
        <legend>{translations.current['New ledger'] ?? 'New ledger'}</legend>
        <select bind:value={selectedLedgerOption} onchange={resetRollover}>
          <option value={NEW_LEDGER_OPTION}>{translations.current['+ New ledger…'] ?? '+ New ledger…'}</option>
          {#each ledgers as l}<option value={l.name}>{l.name}</option>{/each}
        </select>
        {#if selectedLedgerOption === NEW_LEDGER_OPTION}
          <input type="text" bind:value={newLedgerName} oninput={resetRollover} placeholder={translations.current['New ledger name'] ?? 'New ledger name'} />
        {/if}
      </fieldset>

      {#if !rolloverResolved && !rolloverResult}
        {#if rolloverError}<p class="error">{rolloverError}</p>{/if}
        <button class="btn" onclick={resolveRollover} disabled={rolloverResolving}>
          {rolloverResolving ? 'Resolving…' : (translations.current['Resolve opening balances'] ?? 'Resolve opening balances')}
        </button>
      {/if}

      {#if rolloverResolved}
        <div class="preview-box">
          <p class="preview-heading">{translations.current['Proposed opening-balance entry'] ?? 'Proposed opening-balance entry'}</p>
          <table class="preview-table">
            <thead>
              <tr>
                <th>{translations.current['Account'] ?? 'Account'}</th>
                <th class="num">{translations.current['Debit'] ?? 'Debit'}</th>
                <th class="num">{translations.current['Credit'] ?? 'Credit'}</th>
              </tr>
            </thead>
            <tbody>
              {#each rolloverResolved.lines as line}
                <tr>
                  <td>{line.account}</td>
                  <td class="num">{line.amount_minor > 0 ? fmt(line.amount_minor) : ''}</td>
                  <td class="num">{line.amount_minor < 0 ? fmt(-line.amount_minor) : ''}</td>
                </tr>
              {/each}
            </tbody>
          </table>

          {#if rolloverPostError}<p class="error">{rolloverPostError}</p>{/if}
          <div class="decision-row">
            <button class="btn secondary" onclick={rejectRollover} disabled={rolloverPosting}>{translations.current['Reject'] ?? 'Reject'}</button>
            <button class="btn" onclick={acceptRollover} disabled={rolloverPosting}>
              {rolloverPosting ? 'Posting…' : (translations.current['Accept and roll over'] ?? 'Accept and roll over')}
            </button>
          </div>
        </div>
      {/if}

      {#if rolloverResult}
        <div class="close-result">
          <p><strong>{translations.current['Rolled over'] ?? 'Rolled over'}: {rolloverResult.reference}</strong></p>
          <p>{translations.current['New ledger'] ?? 'New ledger'}: {rolloverResult.newLedger}</p>
          <p>{translations.current['Accounts carried forward'] ?? 'Accounts carried forward'}: {rolloverResult.accountsCarriedForward}</p>
        </div>
      {/if}
    </fieldset>
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
  .group-heading {
    margin-top: 0.6rem !important;
    font-weight: 600;
  }
  .group-list {
    margin: 0.2rem 0 0;
    padding-left: 1.2rem;
    font-size: var(--font-size-medium);
  }
  .group-list li {
    margin: 0.1rem 0;
  }
</style>
