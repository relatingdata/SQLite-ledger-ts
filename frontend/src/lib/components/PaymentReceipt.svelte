<script lang="ts">
  // The shared AP Payment/AR Receipt screen — see
  // docs/pm-frontend-reference.md for the full design.
  import { onMount } from 'svelte';
  import { session, translations } from '$lib/state.svelte';
  import {
    getBusinesses,
    getLedgers,
    getEntityTree,
    stageAPPayment,
    postAPPayment,
    stageARReceipt,
    postARReceipt,
    listInvoices,
    getInvoiceOutstanding,
    allocatePaymentToInvoice,
    asBusinessName,
    asLedgerName,
    asProviderName,
    asCustomerName,
    ApiError,
    type EntityNode,
    type Invoice,
  } from '$lib/api';
  import { parseMinorUnits } from '$lib/money';

  let { direction }: { direction: 'payment' | 'receipt' } = $props();

  // direction is static — same pattern as CashTransaction.svelte.
  // svelte-ignore state_referenced_locally
  const isPayment = direction === 'payment';
  const partyLabel = isPayment ? 'Vendor' : 'Customer';
  const partyParentEntity = isPayment ? 'Accounts Payable' : 'Accounts Receivable';
  const title = isPayment ? 'AP Payment' : 'AR Receipt';
  const intro = isPayment
    ? 'A payment to a vendor — debits their Accounts Payable balance, credits Cash and Bank.'
    : 'A receipt from a customer — debits Cash and Bank, credits their Accounts Receivable balance.';
  const verbedNoun = isPayment ? 'payment' : 'receipt';
  const amountVerb = isPayment ? 'paid' : 'received';
  const notRecordedError = isPayment ? 'Could not record this payment.' : 'Could not record this receipt.';
  const referencePlaceholder = isPayment ? 'e.g. PMT-1001' : 'e.g. RCT-1001';
  const invoiceSide: 'AP' | 'AR' = isPayment ? 'AP' : 'AR';

  // Outstanding invoices, fetched fresh per party — see docs/pm-frontend-reference.md.
  let outstandingInvoices: (Invoice & { outstanding_minor: number })[] = $state([]);
  let allocations: Record<number, string> = $state({});
  let loadingInvoices = $state(false);

  let businesses: { id: number; name: string }[] = $state([]);
  let ledgers: { id: number; name: string }[] = $state([]);
  let entities: EntityNode[] = $state([]);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state('');
  let message = $state('');

  let business = $state('');
  let ledger = $state('');
  let partyName = $state('');
  let amount = $state('');
  let reference = $state('');
  let transdate = $state(new Date().toISOString().slice(0, 10));
  let description = $state('');

  onMount(async () => {
    try {
      [businesses, entities] = await Promise.all([getBusinesses(), getEntityTree()]);
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
  }

  let parties = $derived(entities.filter((e) => entities.find((p) => p.id === e.parent_id)?.name === partyParentEntity));

  async function loadOutstandingInvoices() {
    loadingInvoices = true;
    try {
      const { rows } = await listInvoices(asBusinessName(business), asLedgerName(ledger), invoiceSide, 'manual', 500);
      const forThisParty = rows.filter((inv) => inv.counterparty === partyName && inv.status === 'posted');
      const withOutstanding = await Promise.all(
        forThisParty.map(async (inv) => ({ ...inv, outstanding_minor: (await getInvoiceOutstanding(inv.id)).outstanding_minor }))
      );
      outstandingInvoices = withOutstanding.filter((inv) => inv.outstanding_minor > 0);
      allocations = {};
    } catch {
      // Payment/receipt still works if invoice list fails to load — see docs/pm-frontend-reference.md.
      outstandingInvoices = [];
    } finally {
      loadingInvoices = false;
    }
  }

  $effect(() => {
    if (partyName && business && ledger) loadOutstandingInvoices();
    else {
      outstandingInvoices = [];
      allocations = {};
    }
  });

  let totalAllocatedMinor = $derived(Object.values(allocations).reduce((sum, v) => sum + (parseMinorUnits(v || '0') || 0), 0));

  async function save() {
    error = '';
    message = '';
    if (!reference.trim() || !partyName || !amount) {
      error = `Reference, ${partyLabel.toLowerCase()}, and amount are all required.`;
      return;
    }
    const amount_minor = parseMinorUnits(amount);
    if (totalAllocatedMinor > amount_minor) {
      error = `Cannot allocate ${(totalAllocatedMinor / 100).toFixed(2)} to invoices — only ${(amount_minor / 100).toFixed(2)} is being ${amountVerb}.`;
      return;
    }
    saving = true;
    try {
      if (isPayment) {
        await stageAPPayment({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), vendor: asProviderName(partyName), amount_minor, transdate, description: description || undefined });
        await postAPPayment(reference, asBusinessName(business), asLedgerName(ledger));
      } else {
        await stageARReceipt({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), customer: asCustomerName(partyName), amount_minor, transdate, description: description || undefined });
        await postARReceipt(reference, asBusinessName(business), asLedgerName(ledger));
      }
      // Optional, best-effort allocation per invoice — see docs/pm-frontend-reference.md.
      const realAllocations = Object.entries(allocations).filter(([, v]) => parseMinorUnits(v || '0') > 0);
      for (const [invoiceId, v] of realAllocations) {
        // Distinct reference per allocation — see docs/pm-frontend-reference.md.
        await allocatePaymentToInvoice(Number(invoiceId), `${reference}-alloc-${invoiceId}`, parseMinorUnits(v), transdate, 'Cash and Bank');
      }
      message = `${isPayment ? 'Payment' : 'Receipt'} ${reference} ${isPayment ? 'to' : 'from'} ${partyName} recorded${realAllocations.length ? `, allocated to ${realAllocations.length} invoice(s)` : ''}.`;
      reference = '';
      amount = '';
      description = '';
      allocations = {};
      if (partyName) await loadOutstandingInvoices();
    } catch (e) {
      error = e instanceof ApiError ? e.message : notRecordedError;
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head><title>{translations.current[title] ?? title}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current[title] ?? title}</legend>
  <p class="intro">{translations.current[intro] ?? intro}</p>

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
          <legend>{translations.current['Date'] ?? 'Date'}</legend>
          <input type="date" bind:value={transdate} />
        </fieldset>
        <fieldset>
          <legend>{translations.current['Reference'] ?? 'Reference'}</legend>
          <input bind:value={reference} placeholder={referencePlaceholder} />
        </fieldset>
      </div>
      <div class="row">
        <fieldset class="grow">
          <legend>{translations.current[partyLabel] ?? partyLabel}</legend>
          <select bind:value={partyName}>
            <option value="">Select {partyLabel.toLowerCase()}…</option>
            {#each parties as p}<option value={translations.current[p.name] ?? p.name}>{translations.current[p.name] ?? p.name}</option>{/each}
          </select>
        </fieldset>
        <fieldset>
          <legend>{translations.current['Amount'] ?? 'Amount'}</legend>
          <input bind:value={amount} placeholder="0.00" inputmode="decimal" />
        </fieldset>
        <fieldset class="grow">
          <legend>{translations.current['Description'] ?? 'Description'}</legend>
          <input bind:value={description} placeholder="optional" />
        </fieldset>
      </div>
      <button class="btn" onclick={save} disabled={saving}>{saving ? (translations.current['Saving'] ?? 'Saving…') : (translations.current['Save'] ?? 'Save')}</button>

    {#if partyName}
      <div class="card allocation-card">
        <h3>{translations.current['Allocate to outstanding invoices (optional)'] ?? 'Allocate to outstanding invoices (optional)'}</h3>
        {#if loadingInvoices}
          <p class="hint">Loading…</p>
        {:else if outstandingInvoices.length === 0}
          <p class="hint">{translations.current[`No real, outstanding invoices for this ${partyLabel.toLowerCase()}.`] ?? `No real, outstanding invoices for this ${partyLabel.toLowerCase()}.`}</p>
        {:else}
          <table>
            <thead>
              <tr>
                <th>{translations.current['Reference'] ?? 'Reference'}</th>
                <th>{translations.current['Invoice Date'] ?? 'Invoice Date'}</th>
                <th>{translations.current['Outstanding'] ?? 'Outstanding'}</th>
                <th>{translations.current['Allocate'] ?? 'Allocate'}</th>
              </tr>
            </thead>
            <tbody>
              {#each outstandingInvoices as inv}
                <tr>
                  <td>{inv.reference}</td>
                  <td>{inv.invoice_date}</td>
                  <td>{(inv.outstanding_minor / 100).toFixed(2)}</td>
                  <td><input bind:value={allocations[inv.id]} placeholder="0.00" inputmode="decimal" /></td>
                </tr>
              {/each}
            </tbody>
          </table>
          <p class="hint">
            {translations.current['Total allocated'] ?? 'Total allocated'}: {(totalAllocatedMinor / 100).toFixed(2)}
            {#if amount}/ {(parseMinorUnits(amount) / 100).toFixed(2)}{/if}
          </p>
        {/if}
      </div>
    {/if}
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

  .row {
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .grow {
    flex: 1;
    min-width: 180px;
  }

  .success {
    color: var(--credit);
  }

  .allocation-card {
    padding: 1.1rem 1.2rem 1.3rem;
    margin-top: 1rem;
  }

  .allocation-card h3 {
    margin-top: 0;
  }

  .allocation-card th,
  .allocation-card td {
    text-align: left;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid var(--rule);
  }

  .allocation-card input {
    width: 100px;
  }

  .hint {
    font-size: var(--font-size-base);
    color: var(--ink-soft);
  }
</style>
