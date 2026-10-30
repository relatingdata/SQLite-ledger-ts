<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import {
    getBusinesses, getLedgers, getEntityTree, listLocations,
    createRfq, listQuotations, acceptQuotation, rejectQuotation, markQuotationSent,
    asBusinessName, asLedgerName, ApiError,
    type EntityNode, type LocationRecord, type QuotationRecord,
  } from '$lib/api';
  import { parseMinorUnits, parseQuantity } from '$lib/money';
  import { filterToItems } from '$lib/entityTree';

  let businesses: { id: number; name: string }[] = [];
  let ledgers: { id: number; name: string }[] = [];
  let entities: EntityNode[] = [];
  let rfqs: QuotationRecord[] = [];
  let loading = true;
  let saving = false;
  let error = '';
  let message = '';

  let business = '';
  let ledger = '';
  let vendor = '';
  let item = '';
  let quantity = '';
  let price = '';
  let reference = '';
  let transdate = new Date().toISOString().slice(0, 10);
  let expiryDate = '';
  let description = '';
  let locations: LocationRecord[] = [];
  let deliveryLocation = '';

  onMount(async () => {
    try {
      [businesses, entities] = await Promise.all([getBusinesses(), getEntityTree()]);
      business = session.current?.businessName ?? businesses[0]?.name ?? '';
      await loadLedgers();
      locations = await listLocations(asBusinessName(business));
      await refreshRfqs();
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

  async function refreshRfqs() {
    if (!business || !ledger) return;
    rfqs = await listQuotations(asBusinessName(business), asLedgerName(ledger), 'AP');
  }

  $: providers = entities.filter((e) => {
    const parent = entities.find((p) => p.id === e.parent_id);
    return parent?.name === 'Accounts Payable';
  });
  $: items = filterToItems(entities);

  $: totalMinor = quantity && price ? parseQuantity(quantity) * parseMinorUnits(price) : 0;

  async function save() {
    error = '';
    message = '';
    if (!reference.trim() || !vendor || !item || !quantity || !price) {
      error = 'Reference, provider, item, quantity, and price are all required.';
      return;
    }
    saving = true;
    try {
      const price_minor = parseMinorUnits(price);
      await createRfq({
        reference, business: asBusinessName(business), ledger: asLedgerName(ledger), vendor, item,
        quantity: parseQuantity(quantity), price_minor, location: deliveryLocation || undefined,
        transdate, description: description || undefined, expiryDate: expiryDate || undefined,
      });
      message = `RFQ ${reference} drafted for ${vendor}.`;
      reference = '';
      quantity = '';
      price = '';
      description = '';
      expiryDate = '';
      await refreshRfqs();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not draft this RFQ.';
    } finally {
      saving = false;
    }
  }

  async function doAccept(q: QuotationRecord) {
    error = '';
    message = '';
    try {
      await acceptQuotation(q.reference);
      message = `${q.reference} accepted — a real Purchase Order now exists for it.`;
      await refreshRfqs();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not accept this RFQ.';
    }
  }

  async function doReject(q: QuotationRecord) {
    error = '';
    message = '';
    try {
      await rejectQuotation(q.reference);
      message = `${q.reference} marked rejected.`;
      await refreshRfqs();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not reject this RFQ.';
    }
  }

  async function doMarkSent(q: QuotationRecord) {
    error = '';
    try {
      await markQuotationSent(q.reference);
      await refreshRfqs();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not update this RFQ.';
    }
  }
</script>

<svelte:head><title>{translations.current['RFQ (Request for Quotation)'] ?? 'RFQ (Request for Quotation)'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['RFQ (Request for Quotation)'] ?? 'RFQ (Request for Quotation)'}</legend>
  <p class="intro">
    {translations.current['A request sent to a provider — a real Purchase Order, staged but not yet posted. Accepting it posts the exact same order a Purchase Order screen would create.'] ??
      'A request sent to a provider — a real Purchase Order, staged but not yet posted. Accepting it posts the exact same order a Purchase Order screen would create.'}
  </p>

  {#if loading}
    <p>Loading…</p>
  {:else}
    {#if error}<p class="error">{error}</p>{/if}
    {#if message}<p class="success">{message}</p>{/if}

    <p class="context-line"><strong>{business}</strong> — {ledger}</p>
    <div class="row">
      <fieldset>
        <legend>{translations.current['Date'] ?? 'Date'}</legend>
        <input type="date" bind:value={transdate} />
      </fieldset>
      <fieldset>
        <legend>{translations.current['Reference'] ?? 'Reference'}</legend>
        <input bind:value={reference} placeholder="e.g. RFQ-1001" />
      </fieldset>
      <fieldset>
        <legend>{translations.current['Expires'] ?? 'Expires'}</legend>
        <input type="date" bind:value={expiryDate} />
      </fieldset>
    </div>
    <div class="row">
      <fieldset class="grow">
        <legend>{translations.current['Provider'] ?? 'Provider'}</legend>
        <select bind:value={vendor}>
          <option value="">Select provider…</option>
          {#each providers as p}<option value={translations.current[p.name] ?? p.name}>{translations.current[p.name] ?? p.name}</option>{/each}
        </select>
      </fieldset>
      <fieldset class="grow">
        <legend>{translations.current['Item'] ?? 'Item'}</legend>
        <select bind:value={item}>
          <option value="">Select item…</option>
          {#each items as i}<option value={translations.current[i.name] ?? i.name}>{translations.current[i.name] ?? i.name}</option>{/each}
        </select>
      </fieldset>
    </div>
    <div class="row">
      <fieldset>
        <legend>{translations.current['Quantity'] ?? 'Quantity'}</legend>
        <input bind:value={quantity} placeholder="0" inputmode="numeric" />
      </fieldset>
      <fieldset>
        <legend>{translations.current['Price per unit'] ?? 'Price per unit'}</legend>
        <input bind:value={price} placeholder="0.00" inputmode="decimal" />
      </fieldset>
      <fieldset class="grow">
        <legend>{translations.current['Delivery location'] ?? 'Delivery location'}</legend>
        <select bind:value={deliveryLocation}>
          <option value="">{translations.current['unknown'] ?? 'Not yet known'}</option>
          {#each locations as l}<option value={translations.current[l.name] ?? l.name}>{translations.current[l.name] ?? l.name}</option>{/each}
        </select>
      </fieldset>
      <fieldset class="grow">
        <legend>{translations.current['Description'] ?? 'Description'}</legend>
        <input bind:value={description} placeholder="optional" />
      </fieldset>
    </div>
    {#if quantity && price}
      <p class="total-line">{translations.current['Total requested:'] ?? 'Total requested:'}<strong>{formatAmount(totalMinor, auth.current?.user.number_format ?? '1 000.00')}</strong></p>
    {/if}
    <button class="btn" onclick={save} disabled={saving}>{saving ? (translations.current['Saving'] ?? 'Saving…') : (translations.current['Save draft'] ?? 'Save draft')}</button>

    <table class="quote-list">
      <thead>
        <tr>
          <th>{translations.current['Reference'] ?? 'Reference'}</th>
          <th>{translations.current['Provider'] ?? 'Provider'}</th>
          <th>{translations.current['Item'] ?? 'Item'}</th>
          <th>{translations.current['Status'] ?? 'Status'}</th>
          <th>{translations.current['Expires'] ?? 'Expires'}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each rfqs as q}
          <tr>
            <td>{q.reference}</td>
            <td>{q.vendor}</td>
            <td>{q.item} × {q.quantity}</td>
            <td><span class="status status-{q.status}">{q.status}</span></td>
            <td>{q.expiryDate ?? '—'}</td>
            <td class="actions">
              {#if q.status === 'draft'}
                <button class="btn-small" onclick={() => doMarkSent(q)}>Mark sent</button>
              {/if}
              {#if q.status === 'draft' || q.status === 'sent'}
                <button class="btn-small" onclick={() => doAccept(q)}>Accept → Order</button>
                <button class="btn-small btn-reject" onclick={() => doReject(q)}>Reject</button>
              {/if}
            </td>
          </tr>
        {:else}
          <tr><td colspan="6">No RFQs yet.</td></tr>
        {/each}
      </tbody>
    </table>
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
  .total-line {
    font-size: var(--font-size-medium);
    color: var(--ink-soft);
    margin: 0;
  }
  .quote-list {
    width: 100%;
    margin-top: 1.2rem;
    border-collapse: collapse;
  }
  .quote-list th,
  .quote-list td {
    text-align: left;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid var(--rule);
  }
  .status {
    text-transform: capitalize;
    font-size: var(--font-size-small);
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    background: var(--rule);
  }
  .status-accepted {
    background: var(--credit);
    color: white;
  }
  .status-rejected,
  .status-expired {
    background: var(--debit);
    color: white;
  }
  .actions {
    display: flex;
    gap: 0.4rem;
  }
  .btn-small {
    font-size: var(--font-size-small);
    padding: 0.2rem 0.5rem;
  }
  .btn-reject {
    color: var(--debit);
  }
</style>
