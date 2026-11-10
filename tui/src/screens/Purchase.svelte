<!--
  A TUI port of the web app's "AP Purchase" screen
  (frontend/src/routes/arap/ap-purchase/+page.svelte) - a purchase from
  a provider on credit, using the real, shared AR/AP invoice mechanism
  (createInvoice -> postInvoiceById). A line naming a real catalog item
  is received into stock automatically, alongside the invoice, exactly
  like the web screen (receiveStock, called only when at least one
  line matches a real item). Provider and Account are free-text fields
  here, same stated v1 simplification the General Journal's own
  Account field already makes - Location uses a real picker instead,
  since it's a small, bounded, per-business list.
-->
<script lang="ts">
  import { Box, Text } from 'sveltui';
  import { keyboard } from 'sveltui';
  import { onDestroy } from 'svelte';
  import {
    ApiError,
    asBusinessName,
    asLedgerName,
    createInvoice,
    listItems,
    listLocations,
    postInvoiceById,
    receiveStock,
    type ItemSummary,
    type LocationRecord,
  } from '../api.ts';
  import Panel from '../components/Panel.svelte';
  import TextInput from '../components/TextInput.svelte';
  import SelectList from '../components/SelectList.svelte';
  import MoneyText, { formatMinor } from '../components/MoneyText.svelte';
  import { brass, ink, inkSoft } from '../theme.ts';

  type Step =
    | 'reference'
    | 'provider'
    | 'account'
    | 'tax-rate'
    | 'location'
    | 'description'
    | 'lines'
    | 'line-item'
    | 'line-qty'
    | 'line-price'
    | 'saved';

  type Line = { itemName: string; quantity: number; unitPriceMinor: number };

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
  let items: ItemSummary[] = $state([]);

  let reference = $state('');
  let provider = $state('');
  let account = $state('');
  let taxRate = $state('');
  let locationName = $state('');
  let description = $state('');

  let lines: Line[] = $state([]);
  let selected = $state(0);
  let lineItemName = $state('');
  let lineQty = $state('');
  let linePrice = $state('');

  let error: string | null = $state(null);
  let busy = $state(false);
  let saved: { reference: string; totalMinor: number } | null = $state(null);

  void listLocations(asBusinessName(businessName)).then((r) => (locations = r)).catch(() => {});
  void listItems(businessName).then((r) => (items = r.rows)).catch(() => {});

  const itemsByName = $derived(new Map(items.map((i) => [i.name, i])));
  const taxRateNumber = $derived(taxRate ? Number(taxRate) : 0);
  const subtotalMinor = $derived(lines.reduce((s, l) => s + l.quantity * l.unitPriceMinor, 0));
  const taxMinor = $derived(Number.isFinite(taxRateNumber) ? Math.round(subtotalMinor * (taxRateNumber / 100)) : 0);
  const totalMinor = $derived(subtotalMinor + taxMinor);

  const unsubscribe = keyboard.on((event) => {
    if (event.key === 'Escape') {
      if (step === 'reference' || step === 'saved') { onBack(); return true; }
      if (step === 'provider') { step = 'reference'; return true; }
      if (step === 'account') { step = 'provider'; return true; }
      if (step === 'tax-rate') { step = 'account'; return true; }
      if (step === 'location') { step = 'tax-rate'; return true; }
      if (step === 'description') { step = 'location'; return true; }
      if (step === 'lines') { step = 'description'; return true; }
      if (step === 'line-item' || step === 'line-qty' || step === 'line-price') { step = 'lines'; return true; }
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
        if (lines.length > 0) void save();
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
    const priceMinor = dollarsToMinor(linePrice);
    if (!name || !Number.isFinite(qty) || qty <= 0) {
      error = 'A line needs an item name and a positive quantity.';
      step = 'lines';
      return;
    }
    lines = [...lines, { itemName: name, quantity: qty, unitPriceMinor: priceMinor }];
    error = null;
    step = 'lines';
  }

  async function save() {
    if (!reference.trim() || !provider.trim() || !account.trim() || lines.length === 0) {
      error = 'Reference, provider, account, and at least one item line are all required.';
      return;
    }
    const stockLines = lines.filter((l) => itemsByName.has(l.itemName));
    if (stockLines.length > 0 && !locationName) {
      error = 'Select a location — these items will be received into stock.';
      step = 'location';
      return;
    }
    busy = true; error = null;
    try {
      const transdate = todayIso();
      const { id } = await createInvoice({
        invoiceType: 'AP',
        business: asBusinessName(businessName),
        ledger: asLedgerName(ledgerName),
        reference,
        counterpartyName: provider.trim(),
        invoiceDate: transdate,
        description: description || undefined,
        lines: lines.map((l) => ({
          description: l.itemName,
          quantity: l.quantity,
          unitPriceMinor: l.unitPriceMinor,
          amountMinor: l.quantity * l.unitPriceMinor,
          taxMinor: taxRate ? Math.round(l.quantity * l.unitPriceMinor * (taxRateNumber / 100)) : 0,
          itemName: l.itemName,
        })),
      });
      if (stockLines.length > 0) {
        await receiveStock({
          business: asBusinessName(businessName),
          ledger: asLedgerName(ledgerName),
          reference,
          locationName,
          lines: stockLines.map((l) => ({ itemName: l.itemName, quantity: l.quantity })),
          transdate,
        });
      }
      await postInvoiceById(id, account.trim(), 'Purchases Tax Claimed');
      saved = { reference, totalMinor };
      step = 'saved';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not record this purchase.';
    } finally { busy = false; }
  }

  const title = $derived(`AP Purchase — ${businessName} / ${ledgerName}`);
</script>

{#if step === 'reference'}
  <Panel title={title} focused>
    <Box flexDirection="row">
      <Box width={14}><Text text="Reference" color={brass} /></Box>
      <TextInput bind:value={reference} focused onSubmit={() => { if (reference.trim()) step = 'provider'; }} />
    </Box>
    <Text text="Enter continues · Escape back to menu" color={inkSoft} dim />
  </Panel>
{:else if step === 'provider'}
  <Panel title={`${title} — ${reference}`} focused>
    <Box flexDirection="row"><Box width={14}><Text text="Provider" color={brass} /></Box><TextInput bind:value={provider} focused onSubmit={() => { if (provider.trim()) step = 'account'; }} /></Box>
    <Text text="Type an existing provider's exact name · Enter continues · Escape back" color={inkSoft} dim />
  </Panel>
{:else if step === 'account'}
  <Panel title={`${title} — ${reference}`} focused>
    <Box flexDirection="row"><Box width={28}><Text text="Account (what this was for)" color={brass} /></Box><TextInput bind:value={account} focused onSubmit={() => { if (account.trim()) step = 'tax-rate'; }} /></Box>
    <Text text="An expense (e.g. Office) or asset (e.g. Inventory) account · Enter continues · Escape back" color={inkSoft} dim />
  </Panel>
{:else if step === 'tax-rate'}
  <Panel title={`${title} — ${reference}`} focused>
    <Box flexDirection="row"><Box width={14}><Text text="Tax %" color={brass} /></Box><TextInput bind:value={taxRate} focused onSubmit={() => (step = 'location')} /></Box>
    <Text text="Optional, e.g. 10 for 10% · Enter continues (blank is fine) · Escape back" color={inkSoft} dim />
  </Panel>
{:else if step === 'location'}
  <Panel title={`${title} — ${reference}`} focused>
    <SelectList
      items={[{ label: 'Not yet known', value: NO_LOCATION }, ...locations.map((l) => ({ label: l.name, value: l.name }))]}
      onSelect={(item) => { locationName = item.value === NO_LOCATION ? '' : item.value; step = 'description'; }}
    />
    <Text text="Where item lines will be received into stock · Escape back" color={inkSoft} dim />
  </Panel>
{:else if step === 'description'}
  <Panel title={`${title} — ${reference}`} focused>
    <Box flexDirection="row"><Box width={14}><Text text="Description" color={brass} /></Box><TextInput bind:value={description} focused onSubmit={() => (step = 'lines')} /></Box>
    <Text text="Optional · Enter continues · Escape back" color={inkSoft} dim />
  </Panel>
{:else if step === 'line-item' || step === 'line-qty' || step === 'line-price'}
  <Panel title={`New line — ${reference}`} focused>
    <Box flexDirection="row"><Box width={10}><Text text="Item" color={step === 'line-item' ? brass : inkSoft} /></Box><TextInput bind:value={lineItemName} focused={step === 'line-item'} onSubmit={() => (step = 'line-qty')} /></Box>
    <Box flexDirection="row"><Box width={10}><Text text="Quantity" color={step === 'line-qty' ? brass : inkSoft} /></Box><TextInput bind:value={lineQty} focused={step === 'line-qty'} onSubmit={() => (step = 'line-price')} /></Box>
    <Box flexDirection="row"><Box width={10}><Text text="Price" color={step === 'line-price' ? brass : inkSoft} /></Box><TextInput bind:value={linePrice} focused={step === 'line-price'} onSubmit={addLine} /></Box>
    {#if error}<Text text={error} color="red" />{/if}
    <Text text="Enter moves to the next field · Escape cancels this line" color={inkSoft} dim />
  </Panel>
{:else if step === 'saved' && saved}
  <Panel title={title} focused>
    <Box flexDirection="row">
      <Box><Text text={`Purchase ${saved.reference} recorded — `} color={brass} bold /></Box>
      <Box><MoneyText minorUnits={saved.totalMinor} /></Box>
    </Box>
    <Text text="Escape back to menu" color={inkSoft} dim />
  </Panel>
{:else}
  <Panel title={`${title} — ${reference}`} focused>
    <Box flexDirection="column">
      <Text text={`${'Item'.padEnd(26)}Qty × unit price`} color={inkSoft} />
      <Text text={`${'Total owed'.padEnd(26)}$${formatMinor(totalMinor)} (tax: $${formatMinor(taxMinor)})`} bold />
      <Text
        text={
          lines.length === 0
            ? 'No lines yet — press I to add one.'
            : lines
                .map((l, i) => `${i === selected ? '› ' : '  '}${l.itemName.padEnd(24)}qty ${l.quantity} × $${formatMinor(l.unitPriceMinor)}`)
                .join('\n')
        }
        color={ink}
      />
      <Text text="I add a line · ↑/↓ select · D delete selected · Enter saves (once at least one line) · Escape back" color={inkSoft} dim />
      <Text text={error ?? ''} color="red" />
      {#if busy}<Text text="Working…" color={inkSoft} />{/if}
    </Box>
  </Panel>
{/if}
