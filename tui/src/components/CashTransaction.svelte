<!--
  The Cash Purchase and Cash Sale screens, as the web's own
  CashTransaction component (frontend/src/lib/components/
  CashTransaction.svelte) is both: a purchase from the 'Cash' provider
  or a sale to the 'Cash' customer, posted and paid off in full the same
  instant in one backend call.

  It asks for the web form's fields in its order: the location, then a
  line's item, quantity, unit price and tax (Enter moves on; tax may be
  left blank). Below the line are the web form's actions: Complete
  purchase (or sale) with cash or EFT, and Add another line. Completing
  includes the line being written when it names an item.
-->
<script lang="ts" module>
  export type CashLine = { itemName: string; quantity: number; unitPriceMinor: number; taxMinor: number };
</script>

<script lang="ts">
  import { Box, Text } from 'sveltui';
  import { keyboard } from 'sveltui';
  import { onDestroy } from 'svelte';
  import { ApiError, asBusinessName, listLocations, type LocationRecord } from '../api.ts';
  import Panel from './Panel.svelte';
  import TextInput from './TextInput.svelte';
  import SelectList from './SelectList.svelte';
  import { formatMinor } from './MoneyText.svelte';
  import { brass, ink, inkSoft } from '../theme.ts';

  let {
    title,
    intro,
    locationLabel,
    completeLabel,
    completedLabel,
    businessName,
    complete,
    onBack,
  }: {
    title: string;
    intro: string;
    locationLabel: string;
    completeLabel: string;
    completedLabel: string;
    businessName: string;
    complete: (locationName: string, lines: CashLine[], paymentMethod: 'cash' | 'eft') => Promise<{ reference: string; totalMinor: number }>;
    onBack: () => void;
  } = $props();

  type Field = 'item' | 'qty' | 'price' | 'tax' | 'actions';

  function dollarsToMinor(text: string): number {
    const n = Number(text.trim());
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
  }

  let step: 'location' | 'form' | 'saved' = $state('location');
  let locations: LocationRecord[] | null = $state(null);
  let locationName = $state('');
  let field: Field = $state('item');
  let lines: CashLine[] = $state([]);
  let itemName = $state('');
  let qty = $state('');
  let price = $state('');
  let tax = $state('');
  let error: string | null = $state(null);
  let busy = $state(false);
  let saved: { reference: string; totalMinor: number } | null = $state(null);

  listLocations(asBusinessName(businessName))
    .then((rows) => (locations = rows))
    .catch((err) => (error = err instanceof ApiError ? err.message : 'Could not load the locations.'));

  const unsubscribe = keyboard.on((event) => {
    if (event.key !== 'Escape') return false;
    if (step === 'form') step = 'location';
    else onBack();
    return true;
  });
  onDestroy(unsubscribe);

  /** The line being written, when it names an item; an error otherwise. */
  function currentLine(): CashLine | null | string {
    const name = itemName.trim();
    if (!name) return null;
    const quantity = Number(qty);
    if (!Number.isFinite(quantity) || quantity <= 0) return 'A line needs a positive quantity.';
    return { itemName: name, quantity, unitPriceMinor: dollarsToMinor(price), taxMinor: dollarsToMinor(tax) };
  }
  function clearLine() {
    itemName = '';
    qty = '';
    price = '';
    tax = '';
    field = 'item';
  }

  async function act(action: 'cash' | 'eft' | 'add') {
    const line = currentLine();
    if (typeof line === 'string') { error = line; field = 'qty'; return; }
    error = null;
    if (action === 'add') {
      if (line) lines = [...lines, line];
      clearLine();
      return;
    }
    const all = line ? [...lines, line] : lines;
    if (all.length === 0) { error = 'A line needs an item.'; field = 'item'; return; }
    if (busy) return;
    busy = true;
    try {
      saved = await complete(locationName, all, action);
      step = 'saved';
    } catch (err) {
      error = err instanceof ApiError ? err.message : `Could not ${completeLabel.toLowerCase()}.`;
    } finally {
      busy = false;
    }
  }

  const subtotalMinor = $derived(lines.reduce((s, l) => s + l.quantity * l.unitPriceMinor, 0));
  const taxMinor = $derived(lines.reduce((s, l) => s + l.taxMinor, 0));
  const linesText = $derived(
    lines.length === 0
      ? 'No lines added yet.'
      : lines.map((l) => `  ${l.itemName.padEnd(24)}qty ${l.quantity} × $${formatMinor(l.unitPriceMinor)} (tax: $${formatMinor(l.taxMinor)})`).join('\n') +
          `\n  ${'Total'.padEnd(24)}$${formatMinor(subtotalMinor + taxMinor)}`
  );
</script>

<!-- Each step has a Panel of its own: content that appears inside a Panel
     that stays mounted draws blank (docs/tui-design.md, "Running on
     Svelte 5.56"). -->
{#if step === 'location' && locations}
  <Panel title={title} focused>
    <Text text={intro} color={inkSoft} />
    <Text text={locationLabel} color={brass} />
    <SelectList items={locations.map((l) => ({ label: l.name, value: l.name }))} onSelect={(item) => { locationName = item.value; clearLine(); step = 'form'; }} />
    <Text text="Escape back to menu" color={inkSoft} dim />
  </Panel>
{:else if step === 'location'}
  <Panel title={title} focused>
    <Text text={intro} color={inkSoft} />
    <Text text={locationLabel} color={brass} />
    <Text text={error ?? 'Loading locations…'} color={error ? 'red' : inkSoft} />
    <Text text="Escape back to menu" color={inkSoft} dim />
  </Panel>
{:else if step === 'form'}
  <Panel title={`${title} — ${locationName}`} focused>
    <Text text={linesText} color={ink} />
    <Box flexDirection="row"><Box width={12}><Text text="Item" color={field === 'item' ? brass : inkSoft} /></Box><TextInput bind:value={itemName} focused={field === 'item'} onSubmit={() => (field = 'qty')} /></Box>
    <Box flexDirection="row"><Box width={12}><Text text="Quantity" color={field === 'qty' ? brass : inkSoft} /></Box><TextInput bind:value={qty} focused={field === 'qty'} onSubmit={() => (field = 'price')} /></Box>
    <Box flexDirection="row"><Box width={12}><Text text="Unit price" color={field === 'price' ? brass : inkSoft} /></Box><TextInput bind:value={price} focused={field === 'price'} onSubmit={() => (field = 'tax')} /></Box>
    <Box flexDirection="row"><Box width={12}><Text text="Tax" color={field === 'tax' ? brass : inkSoft} /></Box><TextInput bind:value={tax} focused={field === 'tax'} onSubmit={() => (field = 'actions')} /></Box>
    <SelectList
      focused={field === 'actions'}
      items={[
        { label: `${completeLabel} (cash)`, value: 'cash' as const },
        { label: `${completeLabel} (EFT)`, value: 'eft' as const },
        { label: 'Add another line', value: 'add' as const },
      ]}
      onSelect={(item) => void act(item.value)}
    />
    <Text text={error ?? (busy ? 'Working…' : '')} color={error ? 'red' : inkSoft} />
    <Text text="Dollars, e.g. 1.00 · Enter moves to the next field, then to the actions · Escape back to the location" color={inkSoft} dim />
  </Panel>
{:else if saved}
  <Panel title={title} focused>
    <Text text={`${completedLabel} — ${saved.reference}, $${formatMinor(saved.totalMinor)}`} color={brass} bold />
    <Text text="Escape back to menu" color={inkSoft} dim />
  </Panel>
{/if}
