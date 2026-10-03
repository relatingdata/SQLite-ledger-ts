<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { getBusinesses, getLedgers, getEntityTree, stagePurchaseOrder, postPurchaseOrder, listItemSources, listLocations, asBusinessName, asLedgerName, asProviderName, asAccountName, asLocationName, asItemName, ApiError, type EntityNode, type ItemSource, type LocationRecord } from '$lib/api';
  import { parseMinorUnits, parseQuantity } from '$lib/money';
  import { filterToItems } from '$lib/entityTree';

  // Real, known sources for the currently-selected item — per direct
  // request: "purchase orders need to match suppliers of products
  // being ordered." Fetched fresh whenever the item changes; drives
  // which real vendors are actually offered, and auto-fills the
  // preferred one's own, known price.
  let itemSources: ItemSource[] = [];
  let loadingSources = false;
  let showAllVendors = false;

  let businesses: { id: number; name: string }[] = [];
  let ledgers: { id: number; name: string }[] = [];
  let entities: EntityNode[] = [];
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
  let description = '';
  let locations: LocationRecord[] = [];
  let deliveryLocation = '';

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

  $: vendors = entities.filter((e) => {
    const parent = entities.find((p) => p.id === e.parent_id);
    return parent?.name === 'Accounts Payable';
  });
  $: items = filterToItems(entities);

  // Real, known vendors for the currently-selected item — the item's
  // own preferred source's own vendor first, then every other real,
  // known alternate. showAllVendors is the real, direct escape hatch
  // for a genuine, new, one-off supplier this item has never been
  // bought from before — never silently blocked, just not the
  // default.
  $: knownVendorNames = itemSources.map((s) => s.vendor_name);
  $: vendorOptions = showAllVendors || itemSources.length === 0 ? vendors : vendors.filter((v) => knownVendorNames.includes(v.name));

  $: if (item) loadItemSources();
  $: if (!item) {
    itemSources = [];
    showAllVendors = false;
  }

  async function loadItemSources() {
    loadingSources = true;
    try {
      itemSources = await listItemSources(asItemName(item));
      showAllVendors = false;
      const preferred = itemSources.find((s) => s.is_preferred) ?? itemSources[0];
      if (preferred) {
        vendor = preferred.vendor_name;
        if (preferred.price_minor != null) price = (preferred.price_minor / 100).toFixed(2);
      } else {
        vendor = '';
      }
    } catch {
      // A real, direct order can still be placed even if the real,
      // known-sources list fails to load — this is a real, direct
      // guide, not a hard requirement.
      itemSources = [];
    } finally {
      loadingSources = false;
    }
  }

  $: totalMinor = quantity && price ? parseQuantity(quantity) * parseMinorUnits(price) : 0;

  // If the vendor is changed directly (e.g. picking a real,
  // known alternate instead of the auto-selected preferred one),
  // follow that source's own, known price too, rather than leaving a
  // stale figure from whichever source was previously selected.
  $: if (vendor && itemSources.length > 0) {
    const matching = itemSources.find((s) => s.vendor_name === vendor);
    if (matching?.price_minor != null) price = (matching.price_minor / 100).toFixed(2);
  }

  async function save() {
    error = '';
    message = '';
    if (!reference.trim() || !vendor || !item || !quantity || !price) {
      error = 'Reference, vendor, item, quantity, and price are all required.';
      return;
    }
    saving = true;
    try {
      const price_minor = parseMinorUnits(price);
      await stagePurchaseOrder({ reference, business: asBusinessName(business), ledger: asLedgerName(ledger), vendor: asProviderName(vendor), item: asAccountName(item), quantity: parseQuantity(quantity), price_minor, location: deliveryLocation ? asLocationName(deliveryLocation) : undefined, transdate, description: description || undefined });
      await postPurchaseOrder(reference, asBusinessName(business), asLedgerName(ledger));
      message = `Purchase Order ${reference} placed with ${vendor}.`;
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

<svelte:head><title>{translations.current['Purchase Order'] ?? 'Purchase Order'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Purchase Order'] ?? 'Purchase Order'}</legend>
  <p class="intro">{translations.current['Commits to buying from a vendor — memo only, no real ledger effect until a Stock Receipt fulfills it (all or item).'] ?? 'Commits to buying from a vendor — memo only, no real ledger effect until a Stock Receipt fulfills it (all or item).'}</p>

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
        <input bind:value={reference} placeholder="e.g. PO-1001" />
      </fieldset>
    </div>
    <div class="row">
      <fieldset class="grow">
        <legend>{translations.current['Item'] ?? 'Item'}</legend>
        <select bind:value={item}>
          <option value="">Select item…</option>
          {#each items as i}<option value={translations.current[i.name] ?? i.name}>{translations.current[i.name] ?? i.name}</option>{/each}
        </select>
      </fieldset>
      <fieldset class="grow">
        <legend>{translations.current['Vendor'] ?? 'Vendor'}</legend>
        <select bind:value={vendor}>
          <option value="">Select vendor…</option>
          {#each vendorOptions as v}<option value={translations.current[v.name] ?? v.name}>{translations.current[v.name] ?? v.name}</option>{/each}
        </select>
      </fieldset>
    </div>
    {#if item && !loadingSources}
      {#if itemSources.length > 0}
        <p class="source-hint">
          {#if showAllVendors}
            {translations.current['Showing every real vendor — click to only show this item\'s own, known suppliers.'] ?? 'Showing every real vendor — click to only show this item\'s own, known suppliers.'}
            <button type="button" class="link-button" onclick={() => (showAllVendors = false)}>{translations.current['Known suppliers only'] ?? 'Known suppliers only'}</button>
          {:else}
            {translations.current['Only showing this item\'s own, known suppliers'] ?? 'Only showing this item\'s own, known suppliers'} ({itemSources.length}).
            <button type="button" class="link-button" onclick={() => (showAllVendors = true)}>{translations.current['Show all vendors'] ?? 'Show all vendors'}</button>
          {/if}
        </p>
      {:else}
        <p class="source-hint">{translations.current['No real, known supplier on record for this item yet — showing every real vendor.'] ?? 'No real, known supplier on record for this item yet — showing every real vendor.'}</p>
      {/if}
    {/if}
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

  .source-hint {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    margin: -0.4rem 0 0;
  }

  .link-button {
    background: none;
    border: none;
    color: var(--brass-dark, #8a6d3b);
    font-size: var(--font-size-small);
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }
</style>
