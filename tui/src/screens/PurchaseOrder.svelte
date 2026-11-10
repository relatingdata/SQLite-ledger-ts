<!--
  A TUI port of the web app's "Purchase Order" screen
  (frontend/src/routes/stock/po/+page.svelte) - commits to buying one
  item from a provider; memo-only when placed, no real ledger effect
  until a Stock Receipt fulfills it (stagePurchaseOrder, then
  postPurchaseOrder, same two-step shape as the General Journal's own
  stage-then-post). Provider/Item are free-text fields here, the same
  stated v1 simplification the General Journal's Account field already
  makes - Location uses a real picker instead.
-->
<script lang="ts">
  import { Box, Text } from 'sveltui';
  import { keyboard } from 'sveltui';
  import { onDestroy } from 'svelte';
  import { ApiError, asBusinessName, asLedgerName, listLocations, postPurchaseOrder, stagePurchaseOrder, type LocationRecord } from '../api.ts';
  import Panel from '../components/Panel.svelte';
  import TextInput from '../components/TextInput.svelte';
  import SelectList from '../components/SelectList.svelte';
  import { formatMinor } from '../components/MoneyText.svelte';
  import { brass, ink, inkSoft } from '../theme.ts';

  type Step = 'reference' | 'item' | 'provider' | 'quantity' | 'price' | 'location' | 'description' | 'review' | 'saved';

  function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }
  function dollarsToMinor(text: string): number {
    const n = Number(text.trim());
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
  }

  const NO_LOCATION = '__no_location__';

  let { businessName, ledgerName, onBack }: { businessName: string; ledgerName: string; onBack: () => void } = $props();

  let step: Step = $state('reference');
  let locations: LocationRecord[] = $state([]);

  let reference = $state('');
  let item = $state('');
  let provider = $state('');
  let quantity = $state('');
  let price = $state('');
  let locationName = $state('');
  let description = $state('');

  let error: string | null = $state(null);
  let busy = $state(false);
  let saved: string | null = $state(null);

  void listLocations(asBusinessName(businessName)).then((r) => (locations = r)).catch(() => {});

  const quantityNum = $derived(Number(quantity));
  const priceMinor = $derived(dollarsToMinor(price));
  const totalMinor = $derived(Number.isFinite(quantityNum) ? quantityNum * priceMinor : 0);

  const unsubscribe = keyboard.on((event) => {
    if (event.key === 'Escape') {
      if (step === 'reference' || step === 'saved') { onBack(); return true; }
      if (step === 'item') { step = 'reference'; return true; }
      if (step === 'provider') { step = 'item'; return true; }
      if (step === 'quantity') { step = 'provider'; return true; }
      if (step === 'price') { step = 'quantity'; return true; }
      if (step === 'location') { step = 'price'; return true; }
      if (step === 'description') { step = 'location'; return true; }
      if (step === 'review') { step = 'description'; return true; }
      return true;
    }
    if (step === 'review' && event.key === 'Enter') { void save(); return true; }
    return false;
  });
  onDestroy(unsubscribe);

  async function save() {
    if (!reference.trim() || !provider.trim() || !item.trim() || !quantity || !price) {
      error = 'Reference, provider, item, quantity, and price are all required.';
      return;
    }
    busy = true; error = null;
    try {
      await stagePurchaseOrder({
        reference,
        business: asBusinessName(businessName),
        ledger: asLedgerName(ledgerName),
        vendor: provider.trim(),
        item: item.trim(),
        quantity: quantityNum,
        price_minor: priceMinor,
        location: locationName || undefined,
        transdate: todayIso(),
        description: description || undefined,
      });
      await postPurchaseOrder(reference, asBusinessName(businessName), asLedgerName(ledgerName));
      saved = `Purchase Order ${reference} placed with ${provider}.`;
      step = 'saved';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not place this order.';
    } finally { busy = false; }
  }

  const title = $derived(`Purchase Order — ${businessName} / ${ledgerName}`);
</script>

{#if step === 'reference'}
  <Panel title={title} focused>
    <Text text="Commits to buying from a provider — memo only, no real ledger effect until a Stock Receipt fulfills it." color={inkSoft} />
    <Box flexDirection="row"><Box width={14}><Text text="Reference" color={brass} /></Box><TextInput bind:value={reference} focused onSubmit={() => { if (reference.trim()) step = 'item'; }} /></Box>
    <Text text="Enter continues · Escape back to menu" color={inkSoft} dim />
  </Panel>
{:else if step === 'item'}
  <Panel title={`${title} — ${reference}`} focused>
    <Box flexDirection="row"><Box width={14}><Text text="Item" color={brass} /></Box><TextInput bind:value={item} focused onSubmit={() => { if (item.trim()) step = 'provider'; }} /></Box>
    <Text text="Type an existing item's exact name · Enter continues · Escape back" color={inkSoft} dim />
  </Panel>
{:else if step === 'provider'}
  <Panel title={`${title} — ${reference}`} focused>
    <Box flexDirection="row"><Box width={14}><Text text="Provider" color={brass} /></Box><TextInput bind:value={provider} focused onSubmit={() => { if (provider.trim()) step = 'quantity'; }} /></Box>
    <Text text="Type an existing provider's exact name · Enter continues · Escape back" color={inkSoft} dim />
  </Panel>
{:else if step === 'quantity'}
  <Panel title={`${title} — ${reference}`} focused>
    <Box flexDirection="row"><Box width={14}><Text text="Quantity" color={brass} /></Box><TextInput bind:value={quantity} focused onSubmit={() => { if (quantity) step = 'price'; }} /></Box>
    <Text text="Enter continues · Escape back" color={inkSoft} dim />
  </Panel>
{:else if step === 'price'}
  <Panel title={`${title} — ${reference}`} focused>
    <Box flexDirection="row"><Box width={18}><Text text="Price per unit" color={brass} /></Box><TextInput bind:value={price} focused onSubmit={() => { if (price) step = 'location'; }} /></Box>
    <Text text="Enter continues · Escape back" color={inkSoft} dim />
  </Panel>
{:else if step === 'location'}
  <Panel title={`${title} — ${reference}`} focused>
    <Text text="Delivery location" color={brass} />
    <SelectList
      items={[{ label: 'Not yet known', value: NO_LOCATION }, ...locations.map((l) => ({ label: l.name, value: l.name }))]}
      onSelect={(sel) => { locationName = sel.value === NO_LOCATION ? '' : sel.value; step = 'description'; }}
    />
    <Text text="Escape back" color={inkSoft} dim />
  </Panel>
{:else if step === 'description'}
  <Panel title={`${title} — ${reference}`} focused>
    <Box flexDirection="row"><Box width={14}><Text text="Description" color={brass} /></Box><TextInput bind:value={description} focused onSubmit={() => (step = 'review')} /></Box>
    <Text text="Optional · Enter continues · Escape back" color={inkSoft} dim />
  </Panel>
{:else if step === 'saved' && saved}
  <Panel title={title} focused>
    <Text text={saved} color={brass} bold />
    <Text text="Escape back to menu" color={inkSoft} dim />
  </Panel>
{:else}
  <Panel title={`${title} — review`} focused>
    <Text text={`Reference: ${reference}`} color={ink} />
    <Text text={`Item: ${item}`} color={ink} />
    <Text text={`Provider: ${provider}`} color={ink} />
    <Text
      text={`Quantity: ${quantity}\nPrice per unit: $${price}\nTotal committed: $${formatMinor(totalMinor)}`}
      color={ink}
    />
    <Text text={`Delivery location: ${locationName || '(not yet known)'}`} color={ink} />
    <Text text="Enter saves and places the order · Escape back to edit" color={inkSoft} dim />
    <Text text={error ?? ''} color="red" />
    {#if busy}<Text text="Working…" color={inkSoft} />{/if}
  </Panel>
{/if}
