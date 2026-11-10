<!--
  A TUI port of the web app's "Cash Sale" screen
  (frontend/src/lib/components/CashTransaction.svelte, direction:
  'sale') - a sale to the one real 'Cash' customer, posted exactly like
  an on-account sale then paid off in full the same instant
  (completePosSale - the same real endpoint the POS terminal itself
  uses). Choose any real location to dispatch from, including a
  warehouse.
-->
<script lang="ts">
  import { Box, Text } from 'sveltui';
  import { keyboard } from 'sveltui';
  import { onDestroy } from 'svelte';
  import { ApiError, asBusinessName, asLedgerName, completePosSale, listLocations, type LocationRecord } from '../api.ts';
  import Panel from '../components/Panel.svelte';
  import TextInput from '../components/TextInput.svelte';
  import SelectList from '../components/SelectList.svelte';
  import { formatMinor } from '../components/MoneyText.svelte';
  import { brass, ink, inkSoft } from '../theme.ts';

  type Step = 'location' | 'lines' | 'line-item' | 'line-qty' | 'line-price' | 'line-tax' | 'payment-method' | 'saved';
  type Line = { itemName: string; quantity: number; unitPriceMinor: number; taxMinor: number };

  function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }
  function dollarsToMinor(text: string): number {
    const n = Number(text.trim());
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
  }

  let { businessName, ledgerName, onBack }: { businessName: string; ledgerName: string; onBack: () => void } = $props();

  let step: Step = $state('location');
  let locations: LocationRecord[] = $state([]);
  let locationName = $state('');
  let paymentMethod: 'cash' | 'eft' = $state('cash');

  let lines: Line[] = $state([]);
  let selected = $state(0);
  let lineItemName = $state('');
  let lineQty = $state('');
  let linePrice = $state('');
  let lineTax = $state('');

  let error: string | null = $state(null);
  let busy = $state(false);
  let saved: { reference: string; totalMinor: number } | null = $state(null);

  void listLocations(asBusinessName(businessName))
    .then((locs) => {
      locations = locs;
      if (locs.length > 0 && !locationName) locationName = locs[0].name;
    })
    .catch(() => {});

  const subtotalMinor = $derived(lines.reduce((s, l) => s + l.quantity * l.unitPriceMinor, 0));
  const taxMinor = $derived(lines.reduce((s, l) => s + l.taxMinor, 0));
  const totalMinor = $derived(subtotalMinor + taxMinor);

  const unsubscribe = keyboard.on((event) => {
    if (event.key === 'Escape') {
      if (step === 'location' || step === 'saved') { onBack(); return true; }
      if (step === 'lines') { step = 'location'; return true; }
      if (step === 'line-item' || step === 'line-qty' || step === 'line-price' || step === 'line-tax') { step = 'lines'; return true; }
      if (step === 'payment-method') { step = 'lines'; return true; }
      return true;
    }
    if (step !== 'lines') return;
    switch (event.key) {
      case 'ArrowDown':
        selected = Math.min(selected + 1, Math.max(lines.length - 1, 0));
        return true;
      case 'ArrowUp':
        selected = Math.max(selected - 1, 0);
        return true;
      case 'Enter':
        if (lines.length > 0) step = 'payment-method';
        return true;
      case 'Backspace':
        if (lines[selected]) {
          lines = lines.filter((_, i) => i !== selected);
          selected = Math.max(0, Math.min(selected, lines.length - 1));
        }
        return true;
      default:
        if (event.key === 'i') {
          lineItemName = '';
          lineQty = '';
          linePrice = '';
          lineTax = '';
          step = 'line-item';
          return true;
        }
        if (event.key === 'd' && lines[selected]) {
          lines = lines.filter((_, i) => i !== selected);
          selected = Math.max(0, Math.min(selected, lines.length - 1));
          return true;
        }
        return false;
    }
  });
  onDestroy(unsubscribe);

  function addLine() {
    const name = lineItemName.trim();
    const qty = Number(lineQty);
    if (!name || !Number.isFinite(qty) || qty <= 0) {
      error = 'A line needs an item name and a positive quantity.';
      step = 'lines';
      return;
    }
    lines = [...lines, { itemName: name, quantity: qty, unitPriceMinor: dollarsToMinor(linePrice), taxMinor: dollarsToMinor(lineTax) }];
    error = null;
    step = 'lines';
  }

  async function save() {
    if (!locationName || lines.length === 0) return;
    busy = true; error = null;
    try {
      const res = await completePosSale({
        business: asBusinessName(businessName),
        ledger: asLedgerName(ledgerName),
        locationName,
        customerName: 'Cash',
        lines,
        taxAccount: 'Sales Tax Payable',
        paymentMethod,
        transdate: todayIso(),
      });
      saved = { reference: res.reference, totalMinor: res.totalMinor };
      step = 'saved';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not complete this sale.';
      step = 'lines';
    } finally { busy = false; }
  }

  const title = $derived(`Cash Sale — ${businessName} / ${ledgerName}`);
</script>

{#if step === 'location'}
  <Panel title={title} focused>
    <Text text="A sale to the 'Cash' customer — posted and paid off in full the same instant." color={inkSoft} />
    <Text text="Dispatch from location" color={brass} />
    {#if locations.length > 0}
      <SelectList items={locations.map((l) => ({ label: l.name, value: l.name }))} onSelect={(item) => { locationName = item.value; step = 'lines'; }} />
    {:else}
      <Text text="Loading locations…" color={inkSoft} />
    {/if}
    <Text text="Escape back to menu" color={inkSoft} dim />
  </Panel>
{:else if step === 'line-item' || step === 'line-qty' || step === 'line-price' || step === 'line-tax'}
  <Panel title={`New line — ${locationName}`} focused>
    <Box flexDirection="row"><Box width={10}><Text text="Item" color={step === 'line-item' ? brass : inkSoft} /></Box><TextInput bind:value={lineItemName} focused={step === 'line-item'} onSubmit={() => (step = 'line-qty')} /></Box>
    <Box flexDirection="row"><Box width={10}><Text text="Quantity" color={step === 'line-qty' ? brass : inkSoft} /></Box><TextInput bind:value={lineQty} focused={step === 'line-qty'} onSubmit={() => (step = 'line-price')} /></Box>
    <Box flexDirection="row"><Box width={10}><Text text="Price" color={step === 'line-price' ? brass : inkSoft} /></Box><TextInput bind:value={linePrice} focused={step === 'line-price'} onSubmit={() => (step = 'line-tax')} /></Box>
    <Box flexDirection="row"><Box width={10}><Text text="Tax" color={step === 'line-tax' ? brass : inkSoft} /></Box><TextInput bind:value={lineTax} focused={step === 'line-tax'} onSubmit={addLine} /></Box>
    {#if error}<Text text={error} color="red" />{/if}
    <Text text="Enter moves to the next field · Escape cancels this line" color={inkSoft} dim />
  </Panel>
{:else if step === 'payment-method'}
  <Panel title={`${title} — payment method`} focused>
    <SelectList
      items={[{ label: 'Cash', value: 'cash' }, { label: 'EFT', value: 'eft' }]}
      onSelect={(item) => { paymentMethod = item.value; void save(); }}
    />
    {#if busy}<Text text="Working…" color={inkSoft} />{/if}
    <Text text="Escape back to the lines" color={inkSoft} dim />
  </Panel>
{:else if step === 'saved' && saved}
  <Panel title={title} focused>
    <Box flexDirection="row">
      <Box><Text text={`Sale completed — ${saved.reference}, `} color={brass} bold /></Box>
      <Box><Text text={`$${formatMinor(saved.totalMinor)}`} color={brass} bold /></Box>
    </Box>
    <Text text="Escape back to menu" color={inkSoft} dim />
  </Panel>
{:else}
  <Panel title={`${title} — ${locationName}`} focused>
    <Box flexDirection="column">
      <Text text={`${'Item'.padEnd(26)}Qty × unit price (tax)`} color={inkSoft} />
      <Text text={`${'Total owed'.padEnd(26)}$${formatMinor(totalMinor)} (tax: $${formatMinor(taxMinor)})`} bold />
      <Text
        text={
          lines.length === 0
            ? 'No lines yet — press I to add one.'
            : lines
                .map((l, i) => `${i === selected ? '› ' : '  '}${l.itemName.padEnd(24)}qty ${l.quantity} × $${formatMinor(l.unitPriceMinor)} (tax: $${formatMinor(l.taxMinor)})`)
                .join('\n')
        }
        color={ink}
      />
      <Text text="I add a line · ↑/↓ select · D delete selected · Enter chooses payment method and completes · Escape back" color={inkSoft} dim />
      <Text text={error ?? ''} color="red" />
    </Box>
  </Panel>
{/if}
