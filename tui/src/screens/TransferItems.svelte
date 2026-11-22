<!--
  A TUI port of the web app's "Stock Transfer" screen
  (frontend/src/routes/stock/transfer/+page.svelte) - move stock
  between two locations in the same city (a warehouse dispatching to
  its local retail outlets, for example). Not a sale: no revenue, no
  customer, just the item's own real Inventory value moving between
  the two real, location-scoped accounts it sits in, along with the
  physical stock itself.

  The same one call as the web screen: transferItems moves the stock
  and, at its first-in-first-out cost, its value together, in one
  transaction.
-->
<script lang="ts">
  import { Box, Text } from 'sveltui';
  import { keyboard } from 'sveltui';
  import { onDestroy } from 'svelte';
  import {
    ApiError,
    asBusinessName,
    asLedgerName,
    getItemLocation,
    listItems,
    listLocations,
    transferItems,
    type ItemLocationLevels,
    type ItemSummary,
    type LocationRecord,
  } from '../api.ts';
  import Panel from '../components/Panel.svelte';
  import TextInput from '../components/TextInput.svelte';
  import SelectList from '../components/SelectList.svelte';
  import { brass, ink, inkSoft } from '../theme.ts';

  type Step = 'item' | 'from-location' | 'to-location' | 'quantity' | 'reference' | 'saved';

  function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  let { businessName, ledgerName, onBack }: { businessName: string; ledgerName: string; onBack: () => void } = $props();

  let step: Step = $state('item');
  let locations: LocationRecord[] = $state([]);
  let items: ItemSummary[] = $state([]);

  let itemName = $state('');
  let fromLocation = $state('');
  let toLocation = $state('');
  let quantity = $state('');
  let reference = $state('');

  let fromQty: ItemLocationLevels | null = $state(null);
  let error: string | null = $state(null);
  let busy = $state(false);
  let saved: string | null = $state(null);

  void listLocations(asBusinessName(businessName)).then((r) => (locations = r)).catch(() => {});
  void listItems(businessName).then((r) => (items = r.rows)).catch(() => {});

  // Same-city only, same as the web screen's own sameCity filter - a
  // transfer is for moving stock within one local cluster of
  // locations, not shipping it cross-country.
  const fromCity = $derived(locations.find((l) => l.name === fromLocation)?.city);
  const sameCityLocations = $derived(locations.filter((l) => l.name !== fromLocation && l.city === fromCity));

  const unsubscribe = keyboard.on((event) => {
    if (event.key === 'Escape') {
      if (step === 'item' || step === 'saved') { onBack(); return true; }
      if (step === 'from-location') { step = 'item'; return true; }
      if (step === 'to-location') { step = 'from-location'; return true; }
      if (step === 'quantity') { step = 'to-location'; return true; }
      if (step === 'reference') { step = 'quantity'; return true; }
      return true;
    }
    return false;
  });
  onDestroy(unsubscribe);

  async function pickFromLocation(name: string) {
    fromLocation = name;
    toLocation = '';
    step = 'to-location';
    fromQty = null;
    if (itemName) {
      try {
        fromQty = await getItemLocation(itemName, name);
      } catch {
        // not on hand there at all yet — leave fromQty null
      }
    }
  }

  async function save() {
    if (!itemName.trim() || !fromLocation || !toLocation || !quantity || !reference.trim()) {
      error = 'Item, from/to location, quantity, and reference are all required.';
      return;
    }
    const qty = Math.round(Math.abs(Number(quantity)));
    if (!Number.isFinite(qty) || qty <= 0) {
      error = 'Quantity must be a positive number.';
      return;
    }
    busy = true; error = null;
    try {
      const business = asBusinessName(businessName);
      const ledger = asLedgerName(ledgerName);
      const transdate = todayIso();
      await transferItems({ business, ledger, itemName: itemName.trim(), fromLocationName: fromLocation, toLocationName: toLocation, quantity: qty, reference, transdate });
      saved = `Transferred ${qty} × ${itemName} from ${fromLocation} to ${toLocation}.`;
      step = 'saved';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not transfer.';
    } finally { busy = false; }
  }

  const title = $derived(`Transfer Items — ${businessName} / ${ledgerName}`);
</script>

{#if step === 'item'}
  <Panel title={title} focused>
    <Text text="Move stock between two locations in the same city — not a sale: no revenue, no customer, just the item's own Inventory value and physical stock moving together." color={inkSoft} />
    <Box flexDirection="row"><Box width={14}><Text text="Item" color={brass} /></Box><TextInput bind:value={itemName} focused onSubmit={() => { if (itemName.trim()) step = 'from-location'; }} /></Box>
    <Text text="Type an existing item's exact name · Enter continues · Escape back to menu" color={inkSoft} dim />
  </Panel>
{:else if step === 'from-location'}
  <Panel title={`${title} — ${itemName}`} focused>
    <Text text="From location" color={brass} />
    {#if locations.length > 0}
      <SelectList items={locations.map((l) => ({ label: l.name, value: l.name }))} onSelect={(sel) => void pickFromLocation(sel.value)} />
    {:else}
      <Text text="Loading locations…" color={inkSoft} />
    {/if}
    <Text text="Escape back" color={inkSoft} dim />
  </Panel>
{:else if step === 'to-location'}
  <Panel title={`${title} — ${itemName} — from ${fromLocation}`} focused>
    <Text text={fromQty ? `On hand at ${fromLocation}: ${fromQty.quantity_on_hand}` : ''} color={inkSoft} />
    <Text text="To location" color={brass} />
    {#if sameCityLocations.length > 0}
      <SelectList items={sameCityLocations.map((l) => ({ label: l.name, value: l.name }))} onSelect={(sel) => { toLocation = sel.value; step = 'quantity'; }} />
    {:else}
      <Text text="No other, real location shares this one's city yet." color={inkSoft} />
    {/if}
    <Text text="Escape back" color={inkSoft} dim />
  </Panel>
{:else if step === 'quantity'}
  <Panel title={`${title} — ${itemName} — ${fromLocation} → ${toLocation}`} focused>
    <Box flexDirection="row"><Box width={14}><Text text="Quantity" color={brass} /></Box><TextInput bind:value={quantity} focused onSubmit={() => { if (quantity) step = 'reference'; }} /></Box>
    <Text text="Enter continues · Escape back" color={inkSoft} dim />
  </Panel>
{:else if step === 'reference'}
  <Panel title={`${title} — ${itemName} — ${fromLocation} → ${toLocation}`} focused>
    <Box flexDirection="row"><Box width={14}><Text text="Reference" color={brass} /></Box><TextInput bind:value={reference} focused onSubmit={() => void save()} /></Box>
    <Text text={error ?? ''} color="red" />
    {#if busy}<Text text="Working…" color={inkSoft} />{/if}
    <Text text="Enter transfers the stock and posts its value entry · Escape back" color={inkSoft} dim />
  </Panel>
{:else}
  <Panel title={title} focused>
    <Text text={saved ?? ''} color={brass} bold />
    <Text text="Escape back to menu" color={inkSoft} dim />
  </Panel>
{/if}
