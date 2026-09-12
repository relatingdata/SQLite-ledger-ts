<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { getBusinesses, getLedgers, getEntityTree, stageSalesOrder, postSalesOrder, listLocations, asBusinessName, asLedgerName, ApiError, type EntityNode, type LocationRecord } from '$lib/api';
  import { parseMinorUnits, parseQuantity } from '$lib/money';
  import { filterToItems } from '$lib/entityTree';

  let businesses: { id: number; name: string }[] = [];
  let ledgers: { id: number; name: string }[] = [];
  let entities: EntityNode[] = [];
  let loading = true;
  let saving = false;
  let error = '';
  let message = '';

  let business = '';
  let ledger = '';
  let customer = '';
  let item = '';
  let quantity = '';
  let price = '';
  let reference = '';
  let transdate = new Date().toISOString().slice(0, 10);
  let description = '';
  let locations: LocationRecord[] = [];
  let dispatchLocation = '';

  onMount(async () => {
    try {
      [businesses, entities] = await Promise.all([getBusinesses(), getEntityTree()]);
      business = session.current?.businessName ?? businesses[0]?.name ?? '';
      await loadLedgers();
      locations = await listLocations(asBusinessName(business));
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

  $: customers = entities.filter((e) => {
    const parent = entities.find((p) => p.id === e.parent_id);
    return parent?.name === 'Accounts Receivable';
  });
  $: items = filterToItems(entities);

  $: totalMinor = quantity && price ? parseQuantity(quantity) * parseMinorUnits(price) : 0;

  async function save() {
    error = '';
    message = '';
    if (!reference.trim() || !customer || !item || !quantity || !price) {
      error = 'Reference, customer, item, quantity, and price are all required.';
      return;
    }
    saving = true;
    try {
      const price_minor = parseMinorUnits(price);
      await stageSalesOrder({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), customer, item, quantity: parseQuantity(quantity), price_minor, location: dispatchLocation || undefined, transdate, description: description || undefined });
      await postSalesOrder(reference, asBusinessName(business), asLedgerName(ledger));
      message = `Sales Order ${reference} placed for ${customer}.`;
      reference = '';
      quantity = '';
      price = '';
      description = '';
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not place this order.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head><title>{translations.current['Sales Order'] ?? 'Sales Order'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Sales Order'] ?? 'Sales Order'}</legend>
  <p class="intro">{translations.current['A customer\'s committed order — memo only, no real ledger effect until a Stock Dispatch fulfills it (all or item).'] ?? 'A customer\'s committed order — memo only, no real ledger effect until a Stock Dispatch fulfills it (all or item).'}</p>

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
        <input bind:value={reference} placeholder="e.g. SO-1001" />
      </fieldset>
    </div>
    <div class="row">
      <fieldset class="grow">
        <legend>{translations.current['Customer'] ?? 'Customer'}</legend>
        <select bind:value={customer}>
          <option value="">Select customer…</option>
          {#each customers as c}<option value={translations.current[c.name] ?? c.name}>{translations.current[c.name] ?? c.name}</option>{/each}
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
        <legend>{translations.current['Dispatch location'] ?? 'Dispatch location'}</legend>
        <select bind:value={dispatchLocation}>
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
      <p class="total-line">{translations.current['Total committed:'] ?? 'Total committed:'}<strong>{formatAmount(totalMinor, auth.current?.user.number_format ?? '1 000.00')}</strong></p>
    {/if}
    <button class="btn" onclick={save} disabled={saving}>{saving ? (translations.current['Saving'] ?? 'Saving…') : (translations.current['Save'] ?? 'Save')}</button>
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
</style>
