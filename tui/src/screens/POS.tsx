// A TUI port of the web app's "POS Terminal" screen
// (frontend/src/routes/pos/+page.svelte) — the everyday retail
// register: pick a location, build a cart, choose cash or card (or
// sell on account to a real, existing customer instead of the one
// real 'Cash' customer), and complete the sale (completePosSale, the
// same real endpoint Cash Sale (CashSale.tsx) itself calls).
//
// Deliberately out of scope for this v1 screen, same, real reasons as
// every other simplification in this TUI:
// - **Barcode/UPC scanning** (`lookupItemByUpc`) — a real scanner
//   isn't something a terminal session can exercise; items are found
//   by typing a name instead, matched the same case-insensitive,
//   substring way the web screen's own on-screen search list works
//   (`frontend/src/routes/pos/+page.svelte`'s own `searchResults`).
// - **Per-location, per-currency terminals** (`getPosTerminals`/
//   `createPosTerminal`) — a real, optional multi-currency feature
//   (docs/multicurrency-design.md Slice 4); every sale here posts in
//   the business's own home currency, with no terminal chosen.
// - **Pending customer self-registration review** (`listPendingCustomers`/
//   `verifyCustomer`) — a real, separate, customer-facing flow with its
//   own screen on the web app, not part of completing a sale itself.
// - **A combination-priced item's own server-resolved price**
//   (`combinationValues`/`combinationShape`) — this screen always
//   prices a line from the catalog's own flat `retail_price_minor`, or
//   lets the price be typed directly; a real, optional product variant
//   feature (size/color tiers) this v1 port doesn't reach.
// "On account" isn't a separate toggle here, unlike the web screen's
// own checkbox — typing any customer name other than 'Cash' at the
// customer step means on account to that customer, skipping cash
// tendered/change due entirely, the same real distinction the web
// screen's own onAccount flag makes.
import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { ApiError, asBusinessName, asLedgerName, completePosSale, listItems, listLocations, type ItemSummary, type LocationRecord } from '../api.js';
import { Panel } from '../components/Panel.js';
import { MoneyText } from '../components/MoneyText.js';
import { brass, ink, inkSoft } from '../theme.js';

type Step = 'location' | 'cart' | 'line-item' | 'line-qty' | 'line-price' | 'line-tax' | 'customer' | 'payment-method' | 'cash-tendered' | 'saved';
type Line = { itemName: string; quantity: number; unitPriceMinor: number; taxMinor: number };

function dollarsToMinor(text: string): number {
  const n = Number(text.trim());
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
}

export function POS({ businessName, ledgerName, onBack }: { businessName: string; ledgerName: string; onBack: () => void }) {
  const [step, setStep] = useState<Step>('location');
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [locationName, setLocationName] = useState('');

  const [lines, setLines] = useState<Line[]>([]);
  const [selected, setSelected] = useState(0);
  const [lineItemName, setLineItemName] = useState('');
  // All three start blank, not pre-filled with a catalog default — same
  // real, confirmed-live reason as every other line form in this TUI
  // (Purchase.tsx, CashPurchase.tsx, CashSale.tsx): ink-text-input's own
  // TextInput appends at the cursor rather than replacing on first
  // keystroke. The matched catalog item's own retail price is shown as
  // a dim hint instead of a bound default, and used only when the
  // price field is left blank.
  const [lineQty, setLineQty] = useState('');
  const [linePrice, setLinePrice] = useState('');
  const [lineTax, setLineTax] = useState('');

  // Starts blank, not pre-filled with 'Cash' — same, real, confirmed-live
  // reason as every line-item field in this TUI: ink-text-input appends
  // at the cursor rather than replacing on first keystroke, so a
  // pre-filled 'Cash' here silently produced "CashRiverside Restaurant"
  // when a real, different customer name was typed. Blank is treated as
  // 'Cash' below.
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [cashTendered, setCashTendered] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ reference: string; totalMinor: number; changeDueMinor: number } | null>(null);

  useEffect(() => {
    void listLocations(asBusinessName(businessName))
      .then((locs) => {
        const retail = locs.filter((l) => l.location_type === 'Retail');
        setLocations(retail);
        if (retail.length > 0) setLocationName((prev) => prev || retail[0]!.name);
      })
      .catch(() => {});
    void listItems(businessName)
      .then((r) => setItems(r.rows))
      .catch(() => {});
  }, [businessName]);

  const itemsByName = new Map(items.map((i) => [i.name.toLowerCase(), i]));
  function matchItem(typed: string): ItemSummary | undefined {
    const t = typed.trim().toLowerCase();
    if (!t) return undefined;
    return itemsByName.get(t) ?? items.find((i) => i.name.toLowerCase().includes(t));
  }
  const matchedLineItem = matchItem(lineItemName);

  const subtotalMinor = lines.reduce((s, l) => s + l.quantity * l.unitPriceMinor, 0);
  const taxMinor = lines.reduce((s, l) => s + l.taxMinor, 0);
  const totalMinor = subtotalMinor + taxMinor;
  const onAccount = customerName.trim() !== '' && customerName.trim().toLowerCase() !== 'cash';
  const cashTenderedMinor = dollarsToMinor(cashTendered);
  const changeDueMinor = Math.max(0, cashTenderedMinor - totalMinor);

  useInput((input, key) => {
    if (key.escape) {
      if (step === 'location' || step === 'saved') return onBack();
      if (step === 'cart') return setStep('location');
      if (step === 'line-item' || step === 'line-qty' || step === 'line-price' || step === 'line-tax') return setStep('cart');
      if (step === 'customer') return setStep('cart');
      if (step === 'payment-method') return setStep('customer');
      if (step === 'cash-tendered') return setStep('payment-method');
      return;
    }
    if (step !== 'cart') return;
    if (key.downArrow) setSelected((s) => Math.min(s + 1, Math.max(lines.length - 1, 0)));
    if (key.upArrow) setSelected((s) => Math.max(s - 1, 0));
    if (input === 'i') {
      setLineItemName('');
      setLineQty('');
      setLinePrice('');
      setLineTax('');
      setStep('line-item');
    }
    if ((input === 'd' || key.backspace) && lines[selected]) {
      setLines((prev) => prev.filter((_, i) => i !== selected));
      setSelected((s) => Math.max(0, Math.min(s, lines.length - 2)));
    }
    if (input === 's' && lines.length > 0) setStep('customer');
  });

  function addLine() {
    const name = lineItemName.trim();
    const qty = Number(lineQty);
    if (!name || !Number.isFinite(qty) || qty <= 0) {
      setError('A line needs an item name and a positive quantity.');
      setStep('cart');
      return;
    }
    const catalog = matchItem(name);
    const unitPriceMinor = linePrice ? dollarsToMinor(linePrice) : catalog?.retail_price_minor ?? 0;
    setLines((prev) => [...prev, { itemName: catalog?.name ?? name, quantity: qty, unitPriceMinor, taxMinor: dollarsToMinor(lineTax) }]);
    setError(null);
    setStep('cart');
  }

  async function save() {
    if (!locationName || lines.length === 0) return;
    setBusy(true);
    setError(null);
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
      setSaved({ reference: res.reference, totalMinor: res.totalMinor, changeDueMinor: res.changeDueMinor });
      setStep('saved');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not complete this sale.');
      setStep('cart');
    } finally {
      setBusy(false);
    }
  }

  const title = `POS Terminal — ${businessName} / ${ledgerName}`;

  if (step === 'location') {
    const selectItems = locations.map((l) => ({ label: l.name, value: l.name }));
    return (
      <Panel title={title} focused>
        <Text color={inkSoft}>The everyday retail register — a real location of type 'Retail'.</Text>
        {selectItems.length > 0 ? (
          <SelectInput items={selectItems} onSelect={(item) => { setLocationName(item.value); setStep('cart'); }} />
        ) : (
          <Text color={inkSoft}>No real Retail-type location exists yet.</Text>
        )}
        <Text color={inkSoft} dimColor>Escape back to menu</Text>
      </Panel>
    );
  }
  if (step === 'line-item' || step === 'line-qty' || step === 'line-price' || step === 'line-tax') {
    return (
      <Panel title={`New line — ${locationName}`} focused>
        <Box><Box width={10}><Text color={step === 'line-item' ? brass : inkSoft}>Item</Text></Box><TextInput value={lineItemName} onChange={setLineItemName} focus={step === 'line-item'} onSubmit={() => setStep('line-qty')} /></Box>
        {matchedLineItem && <Text color={inkSoft} dimColor>  matches catalog item "{matchedLineItem.name}"{matchedLineItem.retail_price_minor != null ? <> — retail price <MoneyText minorUnits={matchedLineItem.retail_price_minor} dim /></> : null}</Text>}
        <Box><Box width={10}><Text color={step === 'line-qty' ? brass : inkSoft}>Quantity</Text></Box><TextInput value={lineQty} onChange={setLineQty} focus={step === 'line-qty'} onSubmit={() => setStep('line-price')} /></Box>
        <Box><Box width={10}><Text color={step === 'line-price' ? brass : inkSoft}>Price</Text></Box><TextInput value={linePrice} onChange={setLinePrice} focus={step === 'line-price'} onSubmit={() => setStep('line-tax')} /></Box>
        {step === 'line-price' && <Text color={inkSoft} dimColor>  blank uses the catalog retail price above, when there is one</Text>}
        <Box><Box width={10}><Text color={step === 'line-tax' ? brass : inkSoft}>Tax</Text></Box><TextInput value={lineTax} onChange={setLineTax} focus={step === 'line-tax'} onSubmit={addLine} /></Box>
        {error && <Text color="red">{error}</Text>}
        <Text color={inkSoft} dimColor>Enter moves to the next field · Escape cancels this line</Text>
      </Panel>
    );
  }
  if (step === 'customer') {
    return (
      <Panel title={`${title} — ${locationName}`} focused>
        <Box><Box width={14}><Text color={brass}>Customer</Text></Box><TextInput value={customerName} onChange={setCustomerName} onSubmit={() => (onAccount ? void save() : setStep('payment-method'))} /></Box>
        <Text color={inkSoft} dimColor>Blank pays now, to 'Cash' · any other, real customer's exact name sells on account, skipping payment · Enter continues · Escape back</Text>
      </Panel>
    );
  }
  if (step === 'payment-method') {
    const methods = [{ label: 'Cash', value: 'cash' as const }, { label: 'Card', value: 'card' as const }];
    return (
      <Panel title={`${title} — payment method`} focused>
        <SelectInput items={methods} onSelect={(item) => { setPaymentMethod(item.value); if (item.value === 'cash') setStep('cash-tendered'); else void save(); }} />
        {busy && <Text color={inkSoft}>Working…</Text>}
        <Text color={inkSoft} dimColor>Escape back</Text>
      </Panel>
    );
  }
  if (step === 'cash-tendered') {
    return (
      <Panel title={`${title} — cash tendered`} focused>
        <Box><Box width={14}><Text color={brass}>Amount given</Text></Box><TextInput value={cashTendered} onChange={setCashTendered} onSubmit={() => void save()} /></Box>
        {cashTendered && <Box><Text color={inkSoft}>Change due: </Text><MoneyText minorUnits={changeDueMinor} /></Box>}
        {error && <Text color="red">{error}</Text>}
        {busy && <Text color={inkSoft}>Working…</Text>}
        <Text color={inkSoft} dimColor>Enter completes the sale · Escape back</Text>
      </Panel>
    );
  }
  if (step === 'saved' && saved) {
    return (
      <Panel title={title} focused>
        <Text color={brass} bold>Sale {saved.reference} completed — <MoneyText minorUnits={saved.totalMinor} /></Text>
        {saved.changeDueMinor > 0 && <Box><Text color={ink}>Change due: </Text><MoneyText minorUnits={saved.changeDueMinor} /></Box>}
        <Text color={inkSoft} dimColor>Escape back to menu</Text>
      </Panel>
    );
  }

  // step === 'cart'
  return (
    <Panel title={`${title} — ${locationName}`} focused>
      <Box flexDirection="column">
        <Box>
          <Box width={24}><Text color={inkSoft}>Item</Text></Box>
          <Box width={12}><Text color={inkSoft}>Quantity</Text></Box>
          <Box width={14}><Text color={inkSoft}>Unit price</Text></Box>
          <Box width={12}><Text color={inkSoft}>Tax</Text></Box>
        </Box>
        {lines.length === 0 && <Text color={inkSoft}>No lines yet — press I to add one.</Text>}
        {lines.map((l, i) => (
          <Box key={`${l.itemName}-${i}`}>
            <Box width={24}><Text color={i === selected ? brass : ink}>{i === selected ? '› ' : '  '}{l.itemName}</Text></Box>
            <Box width={12}><Text color={ink}>{l.quantity}</Text></Box>
            <Box width={14}><MoneyText minorUnits={l.unitPriceMinor} /></Box>
            <Box width={12}><MoneyText minorUnits={l.taxMinor} /></Box>
          </Box>
        ))}
        {lines.length > 0 && (
          <Box marginTop={1}>
            <Box width={24}><Text bold>Total</Text></Box>
            <MoneyText minorUnits={totalMinor} />
            <Text color={inkSoft}> (tax: <MoneyText minorUnits={taxMinor} />)</Text>
          </Box>
        )}
        {error && <Text color="red">{error}</Text>}
        <Text color={inkSoft} dimColor>
          I add a line · ↑/↓ select · D delete selected · S choose customer/payment and complete · Escape back
        </Text>
      </Box>
    </Panel>
  );
}
