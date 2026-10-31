// A TUI port of the web app's "AP Payment" screen
// (frontend/src/lib/components/PaymentReceipt.svelte, direction:
// 'payment') — a payment to a provider: debits their Accounts
// Payable balance, credits Cash and Bank (stageAPPayment, then
// postAPPayment, same two-step shape as the General Journal's own
// stage-then-post). Provider is a free-text field here, same stated
// v1 simplification the General Journal's Account field already makes
// (docs/tui-design.md).
//
// Deliberately out of scope for this v1 screen: allocating the
// payment against specific outstanding invoices (the web screen's own
// optional "Allocate to outstanding invoices" table) — a real,
// documented omission, not papered over; the payment itself is real
// and fully posted either way.
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { ApiError, asBusinessName, asLedgerName, postAPPayment, stageAPPayment } from '../api.js';
import { Panel } from '../components/Panel.js';
import { MoneyText } from '../components/MoneyText.js';
import { brass, ink, inkSoft } from '../theme.js';

type Step = 'reference' | 'provider' | 'amount' | 'description' | 'saved';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function dollarsToMinor(text: string): number {
  const n = Number(text.trim());
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
}

export function Payment({ businessName, ledgerName, onBack }: { businessName: string; ledgerName: string; onBack: () => void }) {
  const [step, setStep] = useState<Step>('reference');
  const [reference, setReference] = useState('');
  const [provider, setProvider] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const amountMinor = dollarsToMinor(amount);

  useInput((_input, key) => {
    if (key.escape) {
      if (step === 'reference' || step === 'saved') return onBack();
      if (step === 'provider') return setStep('reference');
      if (step === 'amount') return setStep('provider');
      if (step === 'description') return setStep('amount');
      return;
    }
  });

  async function save() {
    if (!reference.trim() || !provider.trim() || !amount) {
      setError('Reference, provider, and amount are all required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const transdate = todayIso();
      await stageAPPayment({
        reference,
        business: asBusinessName(businessName),
        ledger: asLedgerName(ledgerName),
        vendor: provider.trim(),
        amount_minor: amountMinor,
        transdate,
        description: description || undefined,
      });
      await postAPPayment(reference, asBusinessName(businessName), asLedgerName(ledgerName));
      setSaved(`Payment ${reference} to ${provider} recorded.`);
      setStep('saved');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record this payment.');
    } finally {
      setBusy(false);
    }
  }

  const title = `AP Payment — ${businessName} / ${ledgerName}`;

  if (step === 'reference') {
    return (
      <Panel title={title} focused>
        <Text color={inkSoft}>A payment to a provider — debits their Accounts Payable balance, credits Cash and Bank.</Text>
        <Box><Box width={14}><Text color={brass}>Reference</Text></Box><TextInput value={reference} onChange={setReference} onSubmit={() => reference.trim() && setStep('provider')} /></Box>
        <Text color={inkSoft} dimColor>Enter continues · Escape back to menu</Text>
      </Panel>
    );
  }
  if (step === 'provider') {
    return (
      <Panel title={`${title} — ${reference}`} focused>
        <Box><Box width={14}><Text color={brass}>Provider</Text></Box><TextInput value={provider} onChange={setProvider} onSubmit={() => provider.trim() && setStep('amount')} /></Box>
        <Text color={inkSoft} dimColor>Type an existing provider's exact name · Enter continues · Escape back</Text>
      </Panel>
    );
  }
  if (step === 'amount') {
    return (
      <Panel title={`${title} — ${reference}`} focused>
        <Box><Box width={14}><Text color={brass}>Amount</Text></Box><TextInput value={amount} onChange={setAmount} onSubmit={() => amount && setStep('description')} /></Box>
        {amount && <Box><Text color={inkSoft}>= </Text><MoneyText minorUnits={amountMinor} /></Box>}
        <Text color={inkSoft} dimColor>Enter continues · Escape back</Text>
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

  // step === 'description'
  return (
    <Panel title={`${title} — ${reference}`} focused>
      <Text color={ink}>Provider: {provider}</Text>
      <Box><Text color={ink}>Amount: </Text><MoneyText minorUnits={amountMinor} /></Box>
      <Box><Box width={14}><Text color={brass}>Description</Text></Box><TextInput value={description} onChange={setDescription} onSubmit={() => void save()} /></Box>
      {error && <Text color="red">{error}</Text>}
      {busy && <Text color={inkSoft}>Working…</Text>}
      <Text color={inkSoft} dimColor>Optional · Enter saves and posts the payment · Escape back</Text>
    </Panel>
  );
}
