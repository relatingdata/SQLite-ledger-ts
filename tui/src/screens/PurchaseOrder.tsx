// A TUI port of the web app's "Purchase Order" screen
// (frontend/src/routes/stock/po/+page.svelte) — commits to buying one
// item from a provider; memo-only when placed, no real ledger effect
// until a Stock Receipt fulfills it (stagePurchaseOrder, then
// postPurchaseOrder, same two-step shape as the General Journal's own
// stage-then-post). Provider/Item are free-text fields here, the same
// stated v1 simplification the General Journal's Account field already
// makes (docs/tui-design.md) — Location uses a real picker instead.
import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { ApiError, asBusinessName, asLedgerName, listLocations, postPurchaseOrder, stagePurchaseOrder, type LocationRecord } from '../api.js';
import { Panel } from '../components/Panel.js';
import { MoneyText } from '../components/MoneyText.js';
import { brass, ink, inkSoft } from '../theme.js';

type Step = 'reference' | 'item' | 'provider' | 'quantity' | 'price' | 'location' | 'description' | 'review' | 'saved';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function dollarsToMinor(text: string): number {
  const n = Number(text.trim());
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
}

const NO_LOCATION = '__no_location__';

export function PurchaseOrder({ businessName, ledgerName, onBack }: { businessName: string; ledgerName: string; onBack: () => void }) {
  const [step, setStep] = useState<Step>('reference');
  const [locations, setLocations] = useState<LocationRecord[]>([]);

  const [reference, setReference] = useState('');
  const [item, setItem] = useState('');
  const [provider, setProvider] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [locationName, setLocationName] = useState('');
  const [description, setDescription] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    void listLocations(asBusinessName(businessName)).then(setLocations).catch(() => {});
  }, [businessName]);

  const quantityNum = Number(quantity);
  const priceMinor = dollarsToMinor(price);
  const totalMinor = Number.isFinite(quantityNum) ? quantityNum * priceMinor : 0;

  useInput((input, key) => {
    if (key.escape) {
      if (step === 'reference' || step === 'saved') return onBack();
      if (step === 'item') return setStep('reference');
      if (step === 'provider') return setStep('item');
      if (step === 'quantity') return setStep('provider');
      if (step === 'price') return setStep('quantity');
      if (step === 'location') return setStep('price');
      if (step === 'description') return setStep('location');
      if (step === 'review') return setStep('description');
      return;
    }
    if (step === 'review' && input === 's') void save();
  });

  async function save() {
    if (!reference.trim() || !provider.trim() || !item.trim() || !quantity || !price) {
      setError('Reference, provider, item, quantity, and price are all required.');
      return;
    }
    setBusy(true);
    setError(null);
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
      setSaved(`Purchase Order ${reference} placed with ${provider}.`);
      setStep('saved');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not place this order.');
    } finally {
      setBusy(false);
    }
  }

  const title = `Purchase Order — ${businessName} / ${ledgerName}`;

  if (step === 'reference') {
    return (
      <Panel title={title} focused>
        <Text color={inkSoft}>Commits to buying from a provider — memo only, no real ledger effect until a Stock Receipt fulfills it.</Text>
        <Box><Box width={14}><Text color={brass}>Reference</Text></Box><TextInput value={reference} onChange={setReference} onSubmit={() => reference.trim() && setStep('item')} /></Box>
        <Text color={inkSoft} dimColor>Enter continues · Escape back to menu</Text>
      </Panel>
    );
  }
  if (step === 'item') {
    return (
      <Panel title={`${title} — ${reference}`} focused>
        <Box><Box width={14}><Text color={brass}>Item</Text></Box><TextInput value={item} onChange={setItem} onSubmit={() => item.trim() && setStep('provider')} /></Box>
        <Text color={inkSoft} dimColor>Type an existing item's exact name · Enter continues · Escape back</Text>
      </Panel>
    );
  }
  if (step === 'provider') {
    return (
      <Panel title={`${title} — ${reference}`} focused>
        <Box><Box width={14}><Text color={brass}>Provider</Text></Box><TextInput value={provider} onChange={setProvider} onSubmit={() => provider.trim() && setStep('quantity')} /></Box>
        <Text color={inkSoft} dimColor>Type an existing provider's exact name · Enter continues · Escape back</Text>
      </Panel>
    );
  }
  if (step === 'quantity') {
    return (
      <Panel title={`${title} — ${reference}`} focused>
        <Box><Box width={14}><Text color={brass}>Quantity</Text></Box><TextInput value={quantity} onChange={setQuantity} onSubmit={() => quantity && setStep('price')} /></Box>
        <Text color={inkSoft} dimColor>Enter continues · Escape back</Text>
      </Panel>
    );
  }
  if (step === 'price') {
    return (
      <Panel title={`${title} — ${reference}`} focused>
        <Box><Box width={18}><Text color={brass}>Price per unit</Text></Box><TextInput value={price} onChange={setPrice} onSubmit={() => price && setStep('location')} /></Box>
        <Text color={inkSoft} dimColor>Enter continues · Escape back</Text>
      </Panel>
    );
  }
  if (step === 'location') {
    const selectItems = [{ label: 'Not yet known', value: NO_LOCATION }, ...locations.map((l) => ({ label: l.name, value: l.name }))];
    return (
      <Panel title={`${title} — ${reference}`} focused>
        <Text color={brass}>Delivery location</Text>
        <SelectInput items={selectItems} onSelect={(sel) => { setLocationName(sel.value === NO_LOCATION ? '' : sel.value); setStep('description'); }} />
        <Text color={inkSoft} dimColor>Escape back</Text>
      </Panel>
    );
  }
  if (step === 'description') {
    return (
      <Panel title={`${title} — ${reference}`} focused>
        <Box><Box width={14}><Text color={brass}>Description</Text></Box><TextInput value={description} onChange={setDescription} onSubmit={() => setStep('review')} /></Box>
        <Text color={inkSoft} dimColor>Optional · Enter continues · Escape back</Text>
      </Panel>
    );
  }
  if (step === 'saved' && saved) {
    return (
      <Panel title={title} focused>
        <Text color={brass} bold>{saved}</Text>
        <Text color={inkSoft} dimColor>Escape back to menu</Text>
      </Panel>
    );
  }

  // step === 'review'
  return (
    <Panel title={`${title} — review`} focused>
      <Text color={ink}>Reference: {reference}</Text>
      <Text color={ink}>Item: {item}</Text>
      <Text color={ink}>Provider: {provider}</Text>
      <Text color={ink}>Quantity: {quantity}</Text>
      <Text color={ink}>Price per unit: ${price}</Text>
      <Box><Text color={ink}>Total committed: </Text><MoneyText minorUnits={totalMinor} /></Box>
      <Text color={ink}>Delivery location: {locationName || '(not yet known)'}</Text>
      {error && <Text color="red">{error}</Text>}
      {busy && <Text color={inkSoft}>Working…</Text>}
      <Text color={inkSoft} dimColor>S saves and places the order · Escape back to edit</Text>
    </Panel>
  );
}
