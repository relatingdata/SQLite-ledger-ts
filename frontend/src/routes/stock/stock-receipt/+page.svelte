<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { getBusinesses, getLedgers, getEntityTree, getOrderStatus, stageStockReceipt, postStockReceipt, asBusinessName, asLedgerName, ApiError, type EntityNode } from '$lib/api';
  import { parseMinorUnits, parseQuantity } from '$lib/money';
  import { filterToItems } from '$lib/entityTree';

  let businesses: { id: number; name: string }[] = $state([]);
  let ledgers: { id: number; name: string }[] = $state([]);
  let entities: EntityNode[] = $state([]);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state('');
  let message = $state('');

  let business = $state('');
  let ledger = $state('');
  let poReference = $state('');
  let poStatus: { quantity: number; value_minor: number } | null = $state(null);
  let vendor = $state('');
  let item = $state('');
  let isService = $state(false);
  let itemQty = $state('');
  let quantity = $state('');
  let value = $state('');
  let taxRate = $state('');
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

  async function lookupPo() {
    poStatus = null;
    if (!poReference.trim()) return;
    try {
      poStatus = await getOrderStatus(poReference);
    } catch {
      /* not found yet — fine, the field just stays informational */
    }
  }

  let vendors = $derived.by(() => entities.filter((e) => {
    const parent = entities.find((p) => p.id === e.parent_id);
    return parent?.name === 'Accounts Payable';
  }));
  let postableAccounts = $derived(filterToItems(entities));

  let taxMinor = $derived(value && taxRate ? Math.round(parseMinorUnits(value) * (Number(taxRate) / 100)) : 0);
  let totalMinor = $derived((value ? parseMinorUnits(value) : 0) + taxMinor);

  async function save() {
    error = '';
    message = '';
    if (!reference.trim() || !poReference.trim() || !vendor || !item || !quantity || !value) {
      error = 'Reference, PO reference, vendor, item, quantity, and value are all required.';
      return;
    }
    saving = true;
    try {
      await stageStockReceipt({
        reference, business: asBusinessName(business), ledger: asLedgerName(ledger), po_reference: poReference, item,
        item_qty: isService ? undefined : itemQty || undefined,
        vendor, quantity: parseQuantity(quantity), value_minor: parseMinorUnits(value), tax_minor: taxMinor,
        transdate, description: description || undefined,
      });
      await postStockReceipt(reference, asBusinessName(business), asLedgerName(ledger));
      message = `Receipt ${reference} recorded against ${poReference}.`;
      reference = '';
      quantity = '';
      value = '';
      taxRate = '';
      description = '';
      poStatus = null;
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not record this receipt.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head><title>{translations.current['Stock Receipt'] ?? 'Stock Receipt'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Stock Receipt'] ?? 'Stock Receipt'}</legend>
  <p class="intro">{translations.current['Fulfills (all or item of) a Purchase Order. Toggle "service" off for a physical item to also track its stock quantity — leave it on for anything with no quantity to track (labour, a service performed).'] ?? 'Fulfills (all or item of) a Purchase Order. Toggle "service" off for a physical item to also track its stock quantity — leave it on for anything with no quantity to track (labour, a service performed).'}</p>

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
        <input bind:value={reference} placeholder="e.g. RCPT-1001" />
      </fieldset>
    </div>
    <div class="row">
      <fieldset>
        <legend>{translations.current['Purchase Order'] ?? 'Purchase Order'}</legend>
        <input bind:value={poReference} onblur={lookupPo} placeholder="e.g. PO-1001" />
      </fieldset>
      {#if poStatus}
        <p class="po-status">{translations.current['Still open on that PO:'] ?? 'Still open on that PO:'}<strong>{poStatus.quantity}</strong> units, <strong>{formatAmount(poStatus.value_minor, auth.current?.user.number_format ?? '1 000.00')}</strong></p>
      {/if}
    </div>
    <div class="row">
      <fieldset class="grow">
        <legend>{translations.current['Vendor'] ?? 'Vendor'}</legend>
        <select bind:value={vendor}>
          <option value="">Select vendor…</option>
          {#each vendors as v}<option value={translations.current[v.name] ?? v.name}>{translations.current[v.name] ?? v.name}</option>{/each}
        </select>
      </fieldset>
      <fieldset class="grow">
        <legend>{translations.current['Item / account (what this receipt is for)'] ?? 'Item / account (what this receipt is for)'}</legend>
        <select bind:value={item}>
          <option value="">Select account…</option>
          {#each postableAccounts as a}<option value={translations.current[a.name] ?? a.name}>{a.accountnumber ? `${a.accountnumber} — ${translations.current[a.name] ?? a.name}` : a.name}</option>{/each}
        </select>
      </fieldset>
    </div>
    <label class="checkbox-label">
      <input type="checkbox" bind:checked={isService} />
      This is a service — no physical stock quantity to track
    </label>
    {#if !isService}
      <fieldset>
        <legend>{translations.current['Stock quantity account'] ?? 'Stock quantity account'}</legend>
        <select bind:value={itemQty}>
          <option value="">Select quantity account…</option>
          {#each postableAccounts as a}<option value={translations.current[a.name] ?? a.name}>{a.accountnumber ? `${a.accountnumber} — ${translations.current[a.name] ?? a.name}` : a.name}</option>{/each}
        </select>
      </fieldset>
    {/if}
    <div class="row">
      <fieldset>
        <legend>{translations.current['Quantity'] ?? 'Quantity'}</legend>
        <input bind:value={quantity} placeholder="0" inputmode="numeric" />
      </fieldset>
      <fieldset>
        <legend>{translations.current['Value'] ?? 'Value'}</legend>
        <input bind:value={value} placeholder="0.00" inputmode="decimal" />
      </fieldset>
      <fieldset>
        <legend>{translations.current['Tax %'] ?? 'Tax %'}</legend>
        <input bind:value={taxRate} placeholder="0" inputmode="decimal" />
      </fieldset>
      <fieldset class="grow">
        <legend>{translations.current['Description'] ?? 'Description'}</legend>
        <input bind:value={description} placeholder="optional" />
      </fieldset>
    </div>
    {#if value}
      <div class="totals-box">
        <p class="total-line">{translations.current['Total owed to vendor:'] ?? 'Total owed to vendor:'}<strong>{formatAmount(totalMinor, auth.current?.user.number_format ?? '1 000.00')}</strong> (tax claimed: {formatAmount(taxMinor, auth.current?.user.number_format ?? '1 000.00')})</p>
      </div>
    {/if}
    <div class="button-row">
      <button class="btn" onclick={save} disabled={saving}>{saving ? (translations.current['Saving'] ?? 'Saving…') : (translations.current['Save'] ?? 'Save')}</button>
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

  .row {
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: var(--font-size-base);
    color: var(--ink-soft);
  }

  .checkbox-label {
    flex-direction: row;
    align-items: center;
    gap: 0.4rem;
  }

  .grow {
    flex: 1;
    min-width: 180px;
  }

  .success {
    color: var(--credit);
  }

  .po-status {
    font-size: var(--font-size-medium);
    color: var(--ink-soft);
    margin: 0;
  }

  .totals-box {
    border: 1px solid var(--rule-strong);
    border-radius: 8px;
    padding: 0.6rem 1rem;
    text-align: center;
  }

  .total-line {
    font-size: var(--font-size-medium);
    color: var(--ink-soft);
    margin: 0;
  }

  .button-row {
    display: flex;
    justify-content: center;
  }
</style>
