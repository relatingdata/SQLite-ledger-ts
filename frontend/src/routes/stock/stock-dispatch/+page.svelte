<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { getBusinesses, getLedgers, getEntityTree, getOrderStatus, stageOrderDispatch, postOrderDispatch, asBusinessName, asLedgerName, ApiError, type EntityNode } from '$lib/api';
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
  let soReference = $state('');
  let soStatus: { quantity: number; value_minor: number } | null = $state(null);
  let customer = $state('');
  let isService = $state(false);
  let item = $state('');
  let itemQty = $state('');
  let quantity = $state('');
  let unitCost = $state('');
  let salePrice = $state('');
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

  async function lookupSo() {
    soStatus = null;
    if (!soReference.trim()) return;
    try {
      soStatus = await getOrderStatus(soReference);
    } catch {
      /* not found yet — fine, the field just stays informational */
    }
  }

  let customers = $derived.by(() => entities.filter((e) => {
    const parent = entities.find((p) => p.id === e.parent_id);
    return parent?.name === 'Accounts Receivable';
  }));
  let postableAccounts = $derived(filterToItems(entities));

  let saleAmount = $derived(quantity && salePrice ? parseQuantity(quantity) * parseMinorUnits(salePrice) : 0);
  let taxMinor = $derived(taxRate ? Math.round(saleAmount * (Number(taxRate) / 100)) : 0);
  let totalMinor = $derived(saleAmount + taxMinor);

  async function save() {
    error = '';
    message = '';
    if (!reference.trim() || !soReference.trim() || !customer || !quantity || !salePrice) {
      error = 'Reference, SO reference, customer, quantity, and sale price are all required.';
      return;
    }
    if (!isService && (!item || !itemQty || !unitCost)) {
      error = 'For a physical item, the item account, quantity account, and unit cost are all required.';
      return;
    }
    saving = true;
    try {
      await stageOrderDispatch({
        reference, business: asBusinessName(business), ledger: asLedgerName(ledger), so_reference: soReference,
        item: isService ? undefined : item,
        item_qty: isService ? undefined : itemQty,
        unit_cost_minor: isService ? undefined : parseMinorUnits(unitCost),
        customer, quantity: parseQuantity(quantity), sale_price_minor: parseMinorUnits(salePrice), tax_minor: taxMinor,
        transdate, description: description || undefined,
      });
      await postOrderDispatch(reference, asBusinessName(business), asLedgerName(ledger));
      message = `Dispatch ${reference} recorded against ${soReference}.`;
      reference = '';
      quantity = '';
      unitCost = '';
      salePrice = '';
      taxRate = '';
      description = '';
      soStatus = null;
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not record this dispatch.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head><title>{translations.current['Stock Dispatch'] ?? 'Stock Dispatch'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Stock Dispatch'] ?? 'Stock Dispatch'}</legend>
  <p class="intro">{translations.current['Fulfills (all or item of) a Sales Order — ships and invoices in one action. Toggle "service" off for a physical item to also recognize its cost of goods sold and reduce stock on hand.'] ?? 'Fulfills (all or item of) a Sales Order — ships and invoices in one action. Toggle "service" off for a physical item to also recognize its cost of goods sold and reduce stock on hand.'}</p>

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
        <input bind:value={reference} placeholder="e.g. INV-1001" />
      </fieldset>
    </div>
    <div class="row">
      <fieldset>
        <legend>{translations.current['Sales Order'] ?? 'Sales Order'}</legend>
        <input bind:value={soReference} onblur={lookupSo} placeholder="e.g. SO-1001" />
      </fieldset>
      {#if soStatus}
        <p class="so-status">{translations.current['Still open on that SO:'] ?? 'Still open on that SO:'}<strong>{soStatus.quantity}</strong> units, <strong>{formatAmount(soStatus.value_minor, auth.current?.user.number_format ?? '1 000.00')}</strong></p>
      {/if}
    </div>
    <fieldset class="grow">
      <legend>{translations.current['Customer'] ?? 'Customer'}</legend>
      <select bind:value={customer}>
        <option value="">Select customer…</option>
        {#each customers as c}<option value={translations.current[c.name] ?? c.name}>{translations.current[c.name] ?? c.name}</option>{/each}
      </select>
    </fieldset>
    <label class="checkbox-label">
      <input type="checkbox" bind:checked={isService} />
      This is a service — no physical stock or cost of goods sold to recognize
    </label>
    {#if !isService}
      <div class="row">
        <fieldset class="grow">
          <legend>{translations.current['Item / cost account'] ?? 'Item / cost account'}</legend>
          <select bind:value={item}>
            <option value="">Select account…</option>
            {#each postableAccounts as a}<option value={translations.current[a.name] ?? a.name}>{a.accountnumber ? `${a.accountnumber} — ${translations.current[a.name] ?? a.name}` : a.name}</option>{/each}
          </select>
        </fieldset>
        <fieldset class="grow">
          <legend>{translations.current['Stock quantity account'] ?? 'Stock quantity account'}</legend>
          <select bind:value={itemQty}>
            <option value="">Select quantity account…</option>
            {#each postableAccounts as a}<option value={translations.current[a.name] ?? a.name}>{a.accountnumber ? `${a.accountnumber} — ${translations.current[a.name] ?? a.name}` : a.name}</option>{/each}
          </select>
        </fieldset>
        <fieldset>
          <legend>{translations.current['Unit cost'] ?? 'Unit cost'}</legend>
          <input bind:value={unitCost} placeholder="0.00" inputmode="decimal" />
        </fieldset>
      </div>
    {/if}
    <div class="row">
      <fieldset>
        <legend>{translations.current['Quantity'] ?? 'Quantity'}</legend>
        <input bind:value={quantity} placeholder="0" inputmode="numeric" />
      </fieldset>
      <fieldset>
        <legend>{translations.current['Sale price per unit'] ?? 'Sale price per unit'}</legend>
        <input bind:value={salePrice} placeholder="0.00" inputmode="decimal" />
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
    {#if quantity && salePrice}
      <div class="totals-box">
        <p class="total-line">{translations.current['Total invoiced:'] ?? 'Total invoiced:'}<strong>{formatAmount(totalMinor, auth.current?.user.number_format ?? '1 000.00')}</strong> (tax: {formatAmount(taxMinor, auth.current?.user.number_format ?? '1 000.00')})</p>
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

  .so-status {
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
