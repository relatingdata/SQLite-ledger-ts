<script lang="ts">
  import { formatAmount } from '$lib/format';
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { auth, hasRole } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import {
    getBusinesses,
    getLedgers,
    getEntityTree,
    stageLine,
    postJournalEntry,
    createRecurringJournal,
    getPeriodStatus,
    asBusinessName,
    asLedgerName,
    asAccountName,
    ApiError,
    type EntityNode,
    type PeriodLockStatus,
  } from '$lib/api';
  import { parseMinorUnits } from '$lib/money';
  import {
    emptyRow,
    addRow,
    removeRowAt,
    autoBalanceTrailingRow,
    autoExpandIfTrailingRowFilled,
    activeRows,
    debitTotalMinor,
    creditTotalMinor,
    differenceMinor,
    canSave,
    type Row,
  } from '$lib/journalGrid';

  let businesses: { id: number; name: string }[] = $state([]);
  let ledgers: { id: number; name: string }[] = $state([]);
  let accounts: EntityNode[] = $state([]);
  let loading = $state(true);
  let error = $state('');
  let message = $state('');
  let saving = $state(false);

  let business = $state('');
  let ledger = $state('');
  let reference = $state('');
  let transdate = $state(new Date().toISOString().slice(0, 10));
  let description = $state('');
  let recurrence: 'once' | 'weekly' | 'monthly' | 'yearly' = $state('once');
  let recurrenceCount: string = $state('');

  let rows: Row[] = $state([emptyRow()]);
  let periodStatus: PeriodLockStatus | null = $state(null);

  let isClosedForTransdate = $derived.by(() => !!(periodStatus?.locked_through_date && transdate && transdate <= periodStatus.locked_through_date));

  async function refreshPeriodStatus() {
    if (!business || !ledger) return;
    try {
      periodStatus = await getPeriodStatus(asBusinessName(business), asLedgerName(ledger));
    } catch {
      periodStatus = null; // non-fatal — the entry screen still works, just without the heads-up
    }
  }

  async function loadStatic() {
    loading = true;
    try {
      [businesses, accounts] = await Promise.all([getBusinesses(), getEntityTree()]);
      business = session.current?.businessName ?? businesses[0]?.name ?? '';
      await loadLedgers();
      if (session.current?.ledgerName && ledgers.some((l) => l.name === session.current!.ledgerName)) {
        ledger = session.current.ledgerName;
      }
      await refreshPeriodStatus();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  }

  async function loadLedgers() {
    if (!business) return;
    ledgers = await getLedgers(business);
    if (!ledger || !ledgers.some((l) => l.name === ledger)) {
      ledger = ledgers.find((l) => l.name === 'Actual')?.name ?? ledgers[0]?.name ?? '';
    }
    await refreshPeriodStatus();
  }

  onMount(loadStatic);

  // A real, reported bug fixed here: the dropdown used to show every
  // account in the entire system, mixing every real CoA family
  // together (German/French/Italian accounts alongside English ones)
  // regardless of which business was actually selected. Each real
  // account and each real business now carries a relation tagging its
  // own CoA family (see backend/scripts/tag-coa-families.ts) — filter
  // to the current business's own family specifically. Accounts with
  // no family relation at all are always shown: real, product-specific
  // Sales/COGS accounts (named "Sales - ..."/"COGS - ...", already
  // tagged COGS for a different purpose) and real customer/vendor
  // contact accounts are universal, not tied to any one CoA family.
  const postableAccounts = () => {
    const currentBusiness = accounts.find((a) => a.name === business);
    const currentFamilyId = currentBusiness?.relation_id ?? null;
    const familyName = (id: number | null) => (id == null ? null : accounts.find((a) => a.id === id)?.name ?? null);
    const currentFamily = familyName(currentFamilyId);
    const allFamilyNames = new Set(['English CoA', 'German CoA', 'French CoA', 'Italian CoA', 'Swiss CoA']);

    return accounts.filter((a) => {
      if (!a.is_postable_account || accounts.some((c) => c.parent_id === a.id)) return false;
      if (a.name.startsWith('Sales - ') || a.name.startsWith('COGS - ')) return true;
      const accountFamily = familyName(a.relation_id);
      if (accountFamily == null || !allFamilyNames.has(accountFamily)) return true; // universal (e.g. customer/vendor) or unrelated relation (e.g. an address/phone type — never expected here, but never hidden incorrectly either)
      return accountFamily === currentFamily;
    });
  };

  function onRowChanged(index: number, field: 'account' | 'debit' | 'credit') {
    // A single journal line is either a debit or a credit, never
    // both — confirmed as a real, live bug: entering a value in both
    // fields on one line silently computed debit-minus-credit as a
    // net amount rather than rejecting the input, which could post a
    // real, wrong-sign figure without any warning. Typing into one
    // field now clears the other, the same behavior standard
    // accounting software uses, rather than relying on a person to
    // notice and self-correct.
    if (field === 'debit' && rows[index].debit) rows[index].credit = '';
    if (field === 'credit' && rows[index].credit) rows[index].debit = '';
    rows = autoExpandIfTrailingRowFilled(rows);
    rows = autoBalanceTrailingRow(rows, index);
  }

  // Insert always adds a new row at the end — it has no conflicting
  // native meaning in a modern browser, so it's safe to act on
  // regardless of which field currently has focus.
  //
  // Delete is trickier: a text input already uses Delete to remove the
  // character ahead of the cursor, and stealing that would break normal
  // editing. So Delete only removes the row when there's nothing for it
  // to do natively — the account dropdown (not a text field at all) or
  // a text field that's currently empty.
  function onRowKeydown(e: KeyboardEvent, index: number) {
    if (e.key === 'Insert') {
      e.preventDefault();
      rows = addRow(rows);
      return;
    }
    if (e.key === 'Delete') {
      const target = e.target as HTMLElement;
      const isEmptySelect = target instanceof HTMLSelectElement && target.value === '';
      const isEmptyField = target instanceof HTMLInputElement && target.value === '';
      if (isEmptySelect || isEmptyField) {
        e.preventDefault();
        rows = removeRowAt(rows, index);
      }
    }
  }

  let debitTotal = $derived(debitTotalMinor(rows));
  let creditTotal = $derived(creditTotalMinor(rows));
  let difference = $derived(differenceMinor(rows));
  let entryIsBalanced = $derived(canSave(rows));

  const fmt = (minorUnits: number) => formatAmount(minorUnits, auth.current?.user.number_format ?? '1 000.00');

  function cancel() {
    rows = [emptyRow()];
    reference = '';
    description = '';
    recurrence = 'once';
    recurrenceCount = '';
    error = '';
    message = '';
  }

  async function save() {
    error = '';
    message = '';
    if (!reference.trim()) {
      error = `${translations.current['Reference'] ?? 'Reference'} is required.`;
      return;
    }
    if (!entryIsBalanced) {
      error = 'This entry does not balance yet.';
      return;
    }
    saving = true;
    try {
      const lines = activeRows(rows).map((r) => ({
        account: r.account,
        amount_minor: parseMinorUnits(r.debit || '0') - parseMinorUnits(r.credit || '0'),
        memo: r.memo || undefined,
      }));

      if (recurrence === 'once') {
        for (const line of lines) {
          await stageLine({
            reference,
            business: asBusinessName(business),
            ledger: asLedgerName(ledger),
            description: description || undefined,
            transdate,
            account: asAccountName(line.account),
            amount_minor: line.amount_minor,
            memo: line.memo,
          });
        }
        await postJournalEntry(reference, asBusinessName(business), asLedgerName(ledger));
      } else {
        await createRecurringJournal(
          asBusinessName(business),
          asLedgerName(ledger),
          reference,
          transdate,
          recurrence,
          lines.map((l) => ({ ...l, account: asAccountName(l.account) })),
          description || undefined,
          recurrenceCount ? Number(recurrenceCount) : undefined
        );
      }

      message = `Entry ${reference} saved.`;
      reference = '';
      description = '';
      recurrence = 'once';
      recurrenceCount = '';
      rows = [emptyRow()];
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not save this entry.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head><title>{translations.current['General Journal'] ?? 'General Journal'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['General Journal'] ?? 'General Journal'}</legend>
  <p class="intro">{translations.current['A direct, multi-line entry into the ledger — debits and credits across any accounts, balanced to zero. Fill in the header fields, add lines until the entry balances, then Save.'] ?? 'A direct, multi-line entry into the ledger — debits and credits across any accounts, balanced to zero. Fill in the header fields, add lines until the entry balances, then Save.'}</p>

  {#if loading}
  <p>Loading…</p>
{:else}
    {#if error}<p class="error">{error}</p>{/if}
    {#if message}<p class="success">{message}</p>{/if}

    <p class="context-line">
      <strong>{business}</strong> — {ledger}
    </p>
    <div class="row">
      <fieldset>
        <legend>{recurrence === 'once' ? (translations.current['Date'] ?? 'Date') : (translations.current['Start Date'] ?? 'Start Date')}</legend>
        <input type="date" bind:value={transdate} />
      </fieldset>
      <fieldset>
        <legend>{translations.current['Reference'] ?? 'Reference'}</legend>
        <input bind:value={reference} placeholder="e.g. GJ-1001" />
      </fieldset>
      <fieldset class="grow">
        <legend>{translations.current['Description'] ?? 'Description'}</legend>
        <input bind:value={description} placeholder="optional" />
      </fieldset>
      {#if periodStatus}
        <div class="period-status" class:closed={periodStatus.locked_through_date}>
          {#if periodStatus.locked_through_date}
            Closed through {periodStatus.locked_through_date}
          {:else}
            Period open
          {/if}
          {#if hasRole(auth.current, 'Administrator')}
            <a href="/setup/periods">manage</a>
          {/if}
        </div>
      {/if}
      <fieldset>
        <legend>{translations.current['Recurrence'] ?? 'Recurrence'}</legend>
        <select bind:value={recurrence}>
          <option value="once">{translations.current['Once'] ?? 'Once'}</option>
          <option value="weekly">{translations.current['Weekly'] ?? 'Weekly'}</option>
          <option value="monthly">{translations.current['Monthly'] ?? 'Monthly'}</option>
          <option value="yearly">{translations.current['Yearly'] ?? 'Yearly'}</option>
        </select>
      </fieldset>
      {#if recurrence !== 'once'}
        <fieldset>
          <legend>{translations.current['Number of occurrences'] ?? 'Number of occurrences'}</legend>
          <input bind:value={recurrenceCount} placeholder="leave blank for ongoing" inputmode="numeric" />
        </fieldset>
      {/if}
    </div>

    <div class="grid-box">
      <table class="grid">
        <thead>
          <tr>
            <th>{translations.current['Account'] ?? 'Account'}</th>
            <th>{translations.current['Memo'] ?? 'Memo'}</th>
            <th class="num">{translations.current['Debit'] ?? 'Debit'}</th>
            <th class="num">{translations.current['Credit'] ?? 'Credit'}</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row, i}
            <tr onkeydown={(e) => onRowKeydown(e, i)}>
              <td>
                <select bind:value={row.account} onchange={() => onRowChanged(i, 'account')}>
                  <option value="">—</option>
                  {#each postableAccounts() as a}
                    <option value={translations.current[a.name] ?? a.name}>
                      {a.accountnumber ? `${a.accountnumber} — ${translations.current[a.name] ?? a.name}` : a.name}{a.currency ? ` (${a.currency})` : ''}
                    </option>
                  {/each}
                </select>
              </td>
              <td>
                <input bind:value={row.memo} placeholder="optional" />
              </td>
              <td>
                <input
                  class="num"
                  bind:value={row.debit}
                  oninput={() => onRowChanged(i, 'debit')}
                  placeholder="0.00"
                  inputmode="decimal"
                />
              </td>
              <td>
                <input
                  class="num"
                  bind:value={row.credit}
                  oninput={() => onRowChanged(i, 'credit')}
                  placeholder="0.00"
                  inputmode="decimal"
                />
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="grid-box totals-box">
      <table class="grid">
        <tbody>
          <tr>
            <td colspan="2"><strong>{translations.current['Total'] ?? 'Total'}</strong></td>
            <td class="num mono amount-debit"><strong>{fmt(debitTotal)}</strong></td>
            <td class="num mono amount-credit"><strong>{fmt(creditTotal)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="hint">Press Insert to add a line; Delete on an empty field or the account picker to remove one.</p>

    <div class="balance-row" class:balanced={entryIsBalanced} class:neutral={activeRows(rows).length === 0}>
      {#if activeRows(rows).length === 0}
        Add at least two lines to begin.
      {:else if entryIsBalanced}
        ✓ Balanced
      {:else if difference === 0}
        Pick an account for every line to finish.
      {:else}
        Out of balance by {fmt(Math.abs(difference))}
      {/if}
    </div>

    {#if isClosedForTransdate}
      <p class="error">
        {transdate} falls within a closed period (through {periodStatus?.locked_through_date}) — this will be rejected
        unless the period is reopened first.
      </p>
    {/if}

    <div class="button-row">
      {#if entryIsBalanced}
        <button class="btn" onclick={save} disabled={saving}>
          {saving ? 'Saving…' : (translations.current['Save'] ?? 'Save')}
        </button>
      {/if}
      <button type="button" class="btn secondary" onclick={cancel} disabled={saving}>{translations.current['Cancel'] ?? 'Cancel'}</button>
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

  .totals-box {
    margin-top: -1px;
    border-top: 2px solid var(--rule-strong);
    border-radius: 0 0 8px 8px;
  }

  .row {
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .grow {
    flex: 1;
    min-width: 200px;
  }

  .grid input, .grid select {
    width: 100%;
    box-sizing: border-box;
  }

  .grid input.num {
    text-align: right;
  }

  .grid td {
    padding: 0.3em 0.4em;
  }

  .hint {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    margin: -0.4rem 0 0;
    text-align: center;
  }

  .balance-row {
    font-weight: 600;
    color: var(--debit);
  }

  .balance-row.neutral {
    color: var(--ink-soft);
    font-weight: 400;
  }

  .balance-row.balanced {
    color: var(--credit);
  }

  .success {
    color: var(--credit);
  }
  .period-status {
    align-self: flex-end;
    padding: 0.5rem 0.8rem;
    border-radius: 6px;
    font-size: var(--font-size-small);
    background: var(--credit-bg, #eef6ee);
    color: var(--ink-soft);
    white-space: nowrap;
  }

  .period-status a {
    margin-left: 0.5rem;
    color: var(--brass-dark);
  }

  .period-status.closed {
    background: var(--debit-bg, #faf0ee);
  }

  .button-row {
    display: flex;
    justify-content: center;
    gap: 0.6rem;
  }

  .secondary {
    background: transparent;
    border: 1px solid var(--rule-strong);
    color: var(--ink);
  }
</style>
