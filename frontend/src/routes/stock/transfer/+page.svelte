<script lang="ts">
  import { onMount } from 'svelte';
  import { listLocations, listItems, getItemLocation, resolveTransferAccounts, transferStock, stageLine, postJournalEntry, asBusinessName, asLedgerName, asItemName, asLocationName, asAccountName, ApiError, type LocationRecord, type ItemSummary, type ItemLocationLevels } from '$lib/api';
  import { session } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import Form from '$lib/components/Form.svelte';
  import { transferLines } from '$lib/canned-journal';

  let locations: LocationRecord[] = $state([]);
  let items: ItemSummary[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  let values: Record<string, string | number | string[]> = $state({ item: '', fromLocation: '', toLocation: '', quantity: '', reference: '' });
  let fromQty: ItemLocationLevels | null = $state(null);

  async function loadAll() {
    loading = true;
    try {
      [locations, { rows: items }] = await Promise.all([listLocations(asBusinessName(session.current?.businessName ?? '')), listItems(session.current?.businessName ?? '')]);
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
    const quantity = Math.round(Math.abs(Number(v.quantity ?? '')));
    const reference = String(v.reference ?? '');
    if (!itemName || !fromLocation || !toLocation) return;
    try {
      const business = asBusinessName(session.current?.businessName ?? '');
      const ledger = asLedgerName(session.current?.ledgerName ?? '');
      // Per docs/canned-journal-to-frontend-design.md Phase 1: the
      // real, physical quantity movement is done first, deliberately,
      // before anything is staged or posted — transferStock is the one,
      // real step genuinely likely to fail (not enough real stock on
      // hand, or the two real locations aren't actually in the same
      // city), and a failed transfer must never leave a real, posted
      // dollar journal entry behind for stock that never actually
      // moved. The canned account selection (which account, how much)
      // for the real dollar VALUE entry is computed here, client-side,
      // by the one, shared transferLines function — the backend is
      // only asked to resolve/create the real Inventory accounts (a
      // real, stateful side effect) and to move the real stock.
      await transferStock({
        business,
        ledger,
        itemName: asItemName(itemName),
        fromLocationName: asLocationName(fromLocation),
        toLocationName: asLocationName(toLocation),
        quantity,
        reference,
      }, 'Transfer Items');
      const resolved = await resolveTransferAccounts({
        business,
        itemName: asItemName(itemName),
        fromLocationName: asLocationName(fromLocation),
        toLocationName: asLocationName(toLocation),
      });
      const builtLines = transferLines({
        quantity,
        fromInventoryAccount: resolved.fromInventoryAccount,
        toInventoryAccount: resolved.toInventoryAccount,
        unitCostMinor: resolved.unitCostMinor,
      });
      if (builtLines.length > 0) {
        const valueReference = `${reference}-VALUE`;
        for (const line of builtLines) {
          await stageLine({
            reference: valueReference,
            business,
            ledger,
            account: asAccountName(line.account),
            amount_minor: line.amount_minor,
          }, 'Transfer Items');
        }
        await postJournalEntry(valueReference, business, ledger, 'Transfer Items');
      }
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
  <p class="intro">{translations.current['Move stock between two locations in the same city — a warehouse dispatching to its local retail outlets, for example. Not a sale: no revenue, no customer, just the item\'s own real Inventory value moving between the two real, location-scoped accounts it sits in, along with the physical stock itself.'] ?? 'Move stock between two locations in the same city — a warehouse dispatching to its local retail outlets, for example. Not a sale: no revenue, no customer, just the item\'s own real Inventory value moving between the two real, location-scoped accounts it sits in, along with the physical stock itself.'}</p>

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
