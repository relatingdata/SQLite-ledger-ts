<!--
  A TUI port of the web app's "POS Terminal" screen
  (frontend/src/routes/pos/+page.svelte) - the everyday retail
  register: pick a location, build a cart, choose cash or card (or
  sell on account to a real, existing customer instead of the one
  real 'Cash' customer), and complete the sale (completePosSale, the
  same real endpoint Cash Sale itself calls).

  Deliberately out of scope for this v1 screen, same, real reasons as
  every other simplification in this TUI: barcode/UPC scanning (items
  are found by typing a name, matched case-insensitive/substring, the
  same way the web screen's own on-screen search list works);
  per-location, per-currency terminals; pending customer
  self-registration review; and a combination-priced item's own
  server-resolved price (this screen always prices a line from the
  catalog's own flat retail price, or lets the price be typed
  directly).

  "On account" isn't a separate toggle here, unlike the web screen's
  own checkbox - typing any customer name other than 'Cash' at the
  customer step means on account to that customer, skipping cash
  tendered/change due entirely.
-->
<script lang="ts">
  import { Box, Text } from 'sveltui';
  import { keyboard } from 'sveltui';
  import { onDestroy } from 'svelte';
  import { ApiError, asBusinessName, asLedgerName, completePosSale, listItems, listLocations, type ItemSummary, type LocationRecord } from '../api.ts';
  import Panel from '../components/Panel.svelte';
  import TextInput from '../components/TextInput.svelte';
  import SelectList from '../components/SelectList.svelte';
  import { formatMinor } from '../components/MoneyText.svelte';
  import { brass, ink, inkSoft } from '../theme.ts';

  type Step = 'location' | 'cart' | 'line-item' | 'line-qty' | 'line-price' | 'line-tax' | 'customer' | 'payment-method' | 'cash-tendered' | 'saved';
  type Line = { itemName: string; quantity: number; unitPriceMinor: number; taxMinor: number };

  function dollarsToMinor(text: string): number {
    const n = Number(text.trim());
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
  }

  let { businessName, ledgerName, onBack }: { businessName: string; ledgerName: string; onBack: () => void } = $props();

  let step: Step = $state('location');
  let locations: LocationRecord[] = $state([]);
  let items: ItemSummary[] = $state([]);
  let locationName = $state('');

  let lines: Line[] = $state([]);
  let selected = $state(0);
  let lineItemName = $state('');
  let lineQty = $state('');
  let linePrice = $state('');
  let lineTax = $state('');

  // Blank is treated as 'Cash' below - starting blank (not pre-filled
  // with 'Cash') matches every other free-text field in this TUI.
  let customerName = $state('');
  let paymentMethod: 'cash' | 'card' = $state('cash');
  let cashTendered = $state('');

  let error: string | null = $state(null);
  let busy = $state(false);
  let saved: { reference: string; totalMinor: number; changeDueMinor: number } | null = $state(null);

  void listLocations(asBusinessName(businessName))
    .then((locs) => {
      const retail = locs.filter((l) => l.location_type === 'Retail');
      locations = retail;
      if (retail.length > 0 && !locationName) locationName = retail[0].name;
    })
    .catch(() => {});
  void listItems(businessName).then((r) => (items = r.rows)).catch(() => {});

  const itemsByName = $derived(new Map(items.map((i) => [i.name.toLowerCase(), i])));
  function matchItem(typed: string): ItemSummary | undefined {
    const t = typed.trim().toLowerCase();
    if (!t) return undefined;
    return itemsByName.get(t) ?? items.find((i) => i.name.toLowerCase().includes(t));
  }
  const matchedLineItem = $derived(matchItem(lineItemName));

  const subtotalMinor = $derived(lines.reduce((s, l) => s + l.quantity * l.unitPriceMinor, 0));
  const taxMinor = $derived(lines.reduce((s, l) => s + l.taxMinor, 0));
  const totalMinor = $derived(subtotalMinor + taxMinor);
  const onAccount = $derived(customerName.trim() !== '' && customerName.trim().toLowerCase() !== 'cash');
  const cashTenderedMinor = $derived(dollarsToMinor(cashTendered));
  const changeDueMinor = $derived(Math.max(0, cashTenderedMinor - totalMinor));

  const unsubscribe = keyboard.on((event) => {
    if (event.key === 'Escape') {
      if (step === 'location' || step === 'saved') { onBack(); return true; }
      if (step === 'cart') { step = 'location'; return true; }
      if (step === 'line-item' || step === 'line-qty' || step === 'line-price' || step === 'line-tax') { step = 'cart'; return true; }
      if (step === 'customer') { step = 'cart'; return true; }
      if (step === 'payment-method') { step = 'customer'; return true; }
      if (step === 'cash-tendered') { step = 'payment-method'; return true; }
      return true;
    }
    if (step !== 'cart') return;
    switch (event.key) {
      case 'ArrowDown':
        selected = Math.min(selected + 1, Math.max(lines.length - 1, 0));
        return true;
      case 'ArrowUp':
        selected = Math.max(selected - 1, 0);
        return true;
      case 'Enter':
        if (lines.length > 0) step = 'customer';
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
      step = 'cart';
      return;
    }
    const catalog = matchItem(name);
    const unitPriceMinor = linePrice ? dollarsToMinor(linePrice) : catalog?.retail_price_minor ?? 0;
    lines = [...lines, { itemName: catalog?.name ?? name, quantity: qty, unitPriceMinor, taxMinor: dollarsToMinor(lineTax) }];
    error = null;
    step = 'cart';
  }

  async function save() {
    if (!locationName || lines.length === 0) return;
    busy = true; error = null;
    try {
      const res = await completePosSale({
        business: asBusinessName(businessName),
        ledger: asLedgerName(ledgerName),
        locationName,
        customerName: onAccount ? customerName.trim() : 'Cash',
        lines,
        taxAccount: 'Sales Tax Payable',
        paymentMethod: onAccount ? undefined : paymentMethod,
        cashTenderedMinor: onAccount ? undefined : cashTenderedMinor,
      });
      saved = { reference: res.reference, totalMinor: res.totalMinor, changeDueMinor: res.changeDueMinor };
      step = 'saved';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not complete this sale.';
      step = 'cart';
    } finally { busy = false; }
  }

  const title = $derived(`POS Terminal — ${businessName} / ${ledgerName}`);
</script>

{#if step === 'location'}
  <Panel title={title} focused>
    <Text text="The everyday retail register — a real location of type 'Retail'." color={inkSoft} />
    {#if locations.length > 0}
      <SelectList items={locations.map((l) => ({ label: l.name, value: l.name }))} onSelect={(item) => { locationName = item.value; step = 'cart'; }} />
    {:else}
      <Text text="No real Retail-type location exists yet." color={inkSoft} />
    {/if}
    <Text text="Escape back to menu" color={inkSoft} dim />
  </Panel>
{:else if step === 'line-item' || step === 'line-qty' || step === 'line-price' || step === 'line-tax'}
  <Panel title={`New line — ${locationName}`} focused>
    <Box flexDirection="row"><Box width={10}><Text text="Item" color={step === 'line-item' ? brass : inkSoft} /></Box><TextInput bind:value={lineItemName} focused={step === 'line-item'} onSubmit={() => (step = 'line-qty')} /></Box>
    <Text
      text={matchedLineItem ? `  matches catalog item "${matchedLineItem.name}"${matchedLineItem.retail_price_minor != null ? ` — retail price $${formatMinor(matchedLineItem.retail_price_minor)}` : ''}` : ''}
      color={inkSoft}
      dim
    />
    <Box flexDirection="row"><Box width={10}><Text text="Quantity" color={step === 'line-qty' ? brass : inkSoft} /></Box><TextInput bind:value={lineQty} focused={step === 'line-qty'} onSubmit={() => (step = 'line-price')} /></Box>
    <Box flexDirection="row"><Box width={10}><Text text="Price" color={step === 'line-price' ? brass : inkSoft} /></Box><TextInput bind:value={linePrice} focused={step === 'line-price'} onSubmit={() => (step = 'line-tax')} /></Box>
    <Text text={step === 'line-price' ? '  blank uses the catalog retail price above, when there is one' : ''} color={inkSoft} dim />
    <Box flexDirection="row"><Box width={10}><Text text="Tax" color={step === 'line-tax' ? brass : inkSoft} /></Box><TextInput bind:value={lineTax} focused={step === 'line-tax'} onSubmit={addLine} /></Box>
    {#if error}<Text text={error} color="red" />{/if}
    <Text text="Enter moves to the next field · Escape cancels this line" color={inkSoft} dim />
  </Panel>
{:else if step === 'customer'}
  <Panel title={`${title} — ${locationName}`} focused>
    <Box flexDirection="row"><Box width={14}><Text text="Customer" color={brass} /></Box><TextInput bind:value={customerName} focused onSubmit={() => (onAccount ? void save() : (step = 'payment-method'))} /></Box>
    <Text text="Blank pays now, to 'Cash' · any other, real customer's exact name sells on account, skipping payment · Enter continues · Escape back" color={inkSoft} dim />
  </Panel>
{:else if step === 'payment-method'}
  <Panel title={`${title} — payment method`} focused>
    <SelectList
      items={[{ label: 'Cash', value: 'cash' }, { label: 'Card', value: 'card' }]}
      onSelect={(item) => { paymentMethod = item.value; if (item.value === 'cash') step = 'cash-tendered'; else void save(); }}
    />
    {#if busy}<Text text="Working…" color={inkSoft} />{/if}
    <Text text="Escape back" color={inkSoft} dim />
  </Panel>
{:else if step === 'cash-tendered'}
  <Panel title={`${title} — cash tendered`} focused>
    <Box flexDirection="row"><Box width={14}><Text text="Amount given" color={brass} /></Box><TextInput bind:value={cashTendered} focused onSubmit={() => void save()} /></Box>
    <Text text={cashTendered ? `Change due: $${formatMinor(changeDueMinor)}` : ''} color={inkSoft} />
    <Text text={error ?? ''} color="red" />
    {#if busy}<Text text="Working…" color={inkSoft} />{/if}
    <Text text="Enter completes the sale · Escape back" color={inkSoft} dim />
  </Panel>
{:else if step === 'saved' && saved}
  <Panel title={title} focused>
    <Text text={`Sale ${saved.reference} completed — $${formatMinor(saved.totalMinor)}${saved.changeDueMinor > 0 ? `\nChange due: $${formatMinor(saved.changeDueMinor)}` : ''}`} color={brass} bold />
    <Text text="Escape back to menu" color={inkSoft} dim />
  </Panel>
{:else}
  <Panel title={`${title} — ${locationName}`} focused>
    <Box flexDirection="column">
      <Text text={`${'Item'.padEnd(26)}Qty × unit price (tax)`} color={inkSoft} />
      <Text text={`${'Total'.padEnd(26)}$${formatMinor(totalMinor)} (tax: $${formatMinor(taxMinor)})`} bold />
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
      <Text text="I add a line · ↑/↓ select · D delete selected · Enter chooses customer/payment and completes · Escape back" color={inkSoft} dim />
      <Text text={error ?? ''} color="red" />
    </Box>
  </Panel>
{/if}
