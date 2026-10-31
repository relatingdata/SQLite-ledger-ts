// A TUI port of the web app's "Cash Purchase" screen
// (frontend/src/lib/components/CashTransaction.svelte, direction:
// 'purchase') — a purchase from the one real 'Cash' provider, posted
// exactly like an on-account purchase then paid off in full the same
// instant (completeCashPurchase, one atomic backend call). Choose any
// real location to receive stock at, including a warehouse.
import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { ApiError, asBusinessName, asLedgerName, completeCashPurchase, listLocations, type LocationRecord } from '../api.js';
import { Panel } from '../components/Panel.js';
import { MoneyText } from '../components/MoneyText.js';
import { brass, ink, inkSoft } from '../theme.js';

type Step = 'location' | 'lines' | 'line-item' | 'line-qty' | 'line-price' | 'line-tax' | 'payment-method' | 'saved';
type Line = { itemName: string; quantity: number; unitPriceMinor: number; taxMinor: number };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function dollarsToMinor(text: string): number {
  const n = Number(text.trim());
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
}

export function CashPurchase({ businessName, ledgerName, onBack }: { businessName: string; ledgerName: string; onBack: () => void }) {
  const [step, setStep] = useState<Step>('location');
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [locationName, setLocationName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'eft'>('cash');

  const [lines, setLines] = useState<Line[]>([]);
  const [selected, setSelected] = useState(0);
  const [lineItemName, setLineItemName] = useState('');
  // All three start blank rather than pre-filled — see the matching note
  // in Purchase.tsx; ink-text-input appends at the cursor on first
  // keystroke rather than replacing a bound default.
  const [lineQty, setLineQty] = useState('');
  const [linePrice, setLinePrice] = useState('');
  const [lineTax, setLineTax] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ reference: string; totalMinor: number } | null>(null);

  useEffect(() => {
    void listLocations(asBusinessName(businessName))
      .then((locs) => {
        setLocations(locs);
        if (locs.length > 0) setLocationName((prev) => prev || locs[0]!.name);
      })
      .catch(() => {});
  }, [businessName]);

  const subtotalMinor = lines.reduce((s, l) => s + l.quantity * l.unitPriceMinor, 0);
  const taxMinor = lines.reduce((s, l) => s + l.taxMinor, 0);
  const totalMinor = subtotalMinor + taxMinor;

  useInput((input, key) => {
    if (key.escape) {
      if (step === 'location' || step === 'saved') return onBack();
      if (step === 'lines') return setStep('location');
      if (step === 'line-item' || step === 'line-qty' || step === 'line-price' || step === 'line-tax') return setStep('lines');
      if (step === 'payment-method') return setStep('lines');
      return;
    }
    if (step !== 'lines') return;
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
    if (input === 's' && lines.length > 0) setStep('payment-method');
  });

  function addLine() {
    const name = lineItemName.trim();
    const qty = Number(lineQty);
    if (!name || !Number.isFinite(qty) || qty <= 0) {
      setError('A line needs an item name and a positive quantity.');
      setStep('lines');
      return;
    }
    setLines((prev) => [...prev, { itemName: name, quantity: qty, unitPriceMinor: dollarsToMinor(linePrice), taxMinor: dollarsToMinor(lineTax) }]);
    setError(null);
    setStep('lines');
  }

  async function save() {
    if (!locationName || lines.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await completeCashPurchase({
        business: asBusinessName(businessName),
        ledger: asLedgerName(ledgerName),
        locationName,
        vendorName: 'Cash',
        lines,
        taxAccount: 'Sales Tax Payable',
        paymentMethod,
        transdate: todayIso(),
      });
      setSaved({ reference: res.reference, totalMinor: res.totalMinor });
      setStep('saved');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not complete this purchase.');
      setStep('lines');
    } finally {
      setBusy(false);
    }
  }

  const title = `Cash Purchase — ${businessName} / ${ledgerName}`;

  if (step === 'location') {
    const selectItems = locations.map((l) => ({ label: l.name, value: l.name }));
    return (
      <Panel title={title} focused>
        <Text color={inkSoft}>A purchase from the 'Cash' provider — posted and paid off in full the same instant.</Text>
        <Text color={brass}>Receive at location</Text>
        {selectItems.length > 0 ? (
          <SelectInput items={selectItems} onSelect={(item) => { setLocationName(item.value); setStep('lines'); }} />
        ) : (
          <Text color={inkSoft}>Loading locations…</Text>
        )}
        <Text color={inkSoft} dimColor>Escape back to menu</Text>
      </Panel>
    );
  }
  if (step === 'line-item' || step === 'line-qty' || step === 'line-price' || step === 'line-tax') {
    return (
      <Panel title={`New line — ${locationName}`} focused>
        <Box><Box width={10}><Text color={step === 'line-item' ? brass : inkSoft}>Item</Text></Box><TextInput value={lineItemName} onChange={setLineItemName} focus={step === 'line-item'} onSubmit={() => setStep('line-qty')} /></Box>
        <Box><Box width={10}><Text color={step === 'line-qty' ? brass : inkSoft}>Quantity</Text></Box><TextInput value={lineQty} onChange={setLineQty} focus={step === 'line-qty'} onSubmit={() => setStep('line-price')} /></Box>
        <Box><Box width={10}><Text color={step === 'line-price' ? brass : inkSoft}>Price</Text></Box><TextInput value={linePrice} onChange={setLinePrice} focus={step === 'line-price'} onSubmit={() => setStep('line-tax')} /></Box>
        <Box><Box width={10}><Text color={step === 'line-tax' ? brass : inkSoft}>Tax</Text></Box><TextInput value={lineTax} onChange={setLineTax} focus={step === 'line-tax'} onSubmit={addLine} /></Box>
        {error && <Text color="red">{error}</Text>}
        <Text color={inkSoft} dimColor>Enter moves to the next field · Escape cancels this line</Text>
      </Panel>
    );
  }
  if (step === 'payment-method') {
    const items = [{ label: 'Cash', value: 'cash' as const }, { label: 'EFT', value: 'eft' as const }];
    return (
      <Panel title={`${title} — payment method`} focused>
        <SelectInput items={items} onSelect={(item) => { setPaymentMethod(item.value); void save(); }} />
        {busy && <Text color={inkSoft}>Working…</Text>}
        <Text color={inkSoft} dimColor>Escape back to the lines</Text>
      </Panel>
    );
  }
  if (step === 'saved' && saved) {
    return (
      <Panel title={title} focused>
        <Text color={brass} bold>Purchase completed — {saved.reference}, <MoneyText minorUnits={saved.totalMinor} /></Text>
        <Text color={inkSoft} dimColor>Escape back to menu</Text>
      </Panel>
    );
  }

  // step === 'lines'
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
            <Box width={24}><Text bold>Total to pay</Text></Box>
            <MoneyText minorUnits={totalMinor} />
            <Text color={inkSoft}> (tax: <MoneyText minorUnits={taxMinor} />)</Text>
          </Box>
        )}
        {error && <Text color="red">{error}</Text>}
        <Text color={inkSoft} dimColor>
          I add a line · ↑/↓ select · D delete selected · S choose payment method and complete · Escape back
        </Text>
      </Box>
    </Panel>
  );
}
