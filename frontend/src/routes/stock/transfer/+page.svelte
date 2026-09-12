<script lang="ts">
  import { onMount } from 'svelte';
  import { listLocations, listItems, getItemLocation, transferStock, asBusinessName, asLedgerName, asItemName, asLocationName, ApiError, type LocationRecord, type ItemSummary, type ItemLocationLevels } from '$lib/api';
  import { session } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import Form from '$lib/components/Form.svelte';

  let locations: LocationRecord[] = $state([]);
  let items: ItemSummary[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  let values: Record<string, string | number | string[]> = $state({ item: '', fromLocation: '', toLocation: '', quantity: '', reference: '' });
  let fromQty: ItemLocationLevels | null = $state(null);

  async function loadAll() {
    loading = true;
    try {
      [locations, { rows: items }] = await Promise.all([listLocations(asBusinessName(session.current?.businessName ?? '')), listItems()]);
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  }

  onMount(loadAll);

  async function checkFromQty() {
    fromQty = null;
    const itemName = String(values.item ?? '');
    const fromLocation = String(values.fromLocation ?? '');
    if (itemName && fromLocation) {
      try {
        fromQty = await getItemLocation(asItemName(itemName), asLocationName(fromLocation));
      } catch {
        // ignore — not on hand there at all yet
      }
    }
  }

  // Re-check on-hand quantity, and reset the destination, whenever
  // the item or the source location changes — the same real, dynamic
  // dependency the original hand-written page already had.
  let lastItem = '';
  let lastFromLocation = '';
  $effect(() => {
    const item = String(values.item ?? '');
    const fromLocation = String(values.fromLocation ?? '');
    if (item !== lastItem || fromLocation !== lastFromLocation) {
      if (fromLocation !== lastFromLocation) values.toLocation = '';
      lastItem = item;
      lastFromLocation = fromLocation;
      checkFromQty();
    }
  });

  let fromCity = $derived(locations.find((l) => l.name === values.fromLocation)?.city);
  let sameCity = $derived(locations.filter((l) => l.name !== values.fromLocation && l.city === fromCity));

  async function submit(v: Record<string, string | number | string[]>) {
    const itemName = String(v.item ?? '');
    const fromLocation = String(v.fromLocation ?? '');
    const toLocation = String(v.toLocation ?? '');
    const quantity = String(v.quantity ?? '');
    if (!itemName || !fromLocation || !toLocation) return;
    try {
      await transferStock({
        business: asBusinessName(session.current?.businessName ?? ''),
        ledger: asLedgerName(session.current?.ledgerName ?? ''),
        itemName: asItemName(itemName),
        fromLocationName: asLocationName(fromLocation),
        toLocationName: asLocationName(toLocation),
        quantity: Math.round(Math.abs(Number(quantity))),
        reference: String(v.reference ?? ''),
      });
      values.quantity = '';
      values.reference = '';
      await checkFromQty();
    } catch (e) {
      throw e instanceof ApiError ? new Error(e.message) : new Error('Could not transfer.');
    }
  }
</script>

<svelte:head><title>{translations.current['Stock Transfer'] ?? 'Stock Transfer'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Stock Transfer'] ?? 'Stock Transfer'}</legend>
  <p class="intro">{translations.current['Move stock between two locations in the same city — a warehouse dispatching to its local retail outlets, for example. Not a sale: no GL entry, no revenue, no customer, just stock moving between places this business controls.'] ?? 'Move stock between two locations in the same city — a warehouse dispatching to its local retail outlets, for example. Not a sale: no GL entry, no revenue, no customer, just stock moving between places this business controls.'}</p>

  {#if loading}
  <p>Loading…</p>
{:else}
    {#if error}<p class="error">{error}</p>{/if}
    {#if fromQty}
      <p class="dim">On hand at {values.fromLocation}: <strong>{fromQty.quantity_on_hand}</strong></p>
    {/if}
    <Form
      fields={[
        { name: 'item', label: 'Item', type: 'select', options: items.map((p) => p.name) },
        { name: 'fromLocation', label: 'From location', type: 'select', options: locations.map((l) => l.name) },
        { name: 'toLocation', label: 'To location', type: 'select', options: sameCity.map((l) => l.name) },
        { name: 'quantity', label: 'Quantity', type: 'number' },
        { name: 'reference', label: 'Reference', type: 'text' },
      ]}
      bind:values
      onSubmit={submit}
      submitLabel="Transfer"
      savingLabel="Transferring…"
    />
  {/if}
</fieldset>

<style>
  .intro {
    max-width: 70ch;
  }

  .dim {
    color: var(--ink-soft);
    font-size: var(--font-size-medium);
  }
</style>
