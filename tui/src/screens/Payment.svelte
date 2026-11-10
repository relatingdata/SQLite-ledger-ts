<!--
  A TUI port of the web app's "AP Payment" screen
  (frontend/src/lib/components/PaymentReceipt.svelte, direction:
  'payment') - a payment to a provider: debits their Accounts Payable
  balance, credits Cash and Bank (stageAPPayment, then postAPPayment,
  same two-step shape as the General Journal's own stage-then-post).
  Provider is a free-text field here, same stated v1 simplification
  the General Journal's Account field already makes.

  Deliberately out of scope for this v1 screen: allocating the payment
  against specific outstanding invoices (the web screen's own optional
  "Allocate to outstanding invoices" table) - a real, documented
  omission, not papered over; the payment itself is real and fully
  posted either way.
-->
<script lang="ts">
  import { Box, Text } from 'sveltui';
  import { keyboard } from 'sveltui';
  import { onDestroy } from 'svelte';
  import { ApiError, asBusinessName, asLedgerName, postAPPayment, stageAPPayment } from '../api.ts';
  import Panel from '../components/Panel.svelte';
  import TextInput from '../components/TextInput.svelte';
  import { formatMinor } from '../components/MoneyText.svelte';
  import { brass, ink, inkSoft } from '../theme.ts';

  type Step = 'reference' | 'provider' | 'amount' | 'description' | 'saved';

  function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }
  function dollarsToMinor(text: string): number {
    const n = Number(text.trim());
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
  }

  let { businessName, ledgerName, onBack }: { businessName: string; ledgerName: string; onBack: () => void } = $props();

  let step: Step = $state('reference');
  let reference = $state('');
  let provider = $state('');
  let amount = $state('');
  let description = $state('');
  let error: string | null = $state(null);
  let busy = $state(false);
  let saved: string | null = $state(null);

  const amountMinor = $derived(dollarsToMinor(amount));

  const unsubscribe = keyboard.on((event) => {
    if (event.key === 'Escape') {
      if (step === 'reference' || step === 'saved') { onBack(); return true; }
      if (step === 'provider') { step = 'reference'; return true; }
      if (step === 'amount') { step = 'provider'; return true; }
      if (step === 'description') { step = 'amount'; return true; }
      return true;
    }
    return false;
  });
  onDestroy(unsubscribe);

  async function save() {
    if (!reference.trim() || !provider.trim() || !amount) {
      error = 'Reference, provider, and amount are all required.';
      return;
    }
    busy = true; error = null;
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
      saved = `Payment ${reference} to ${provider} recorded.`;
      step = 'saved';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not record this payment.';
    } finally { busy = false; }
  }

  const title = $derived(`AP Payment — ${businessName} / ${ledgerName}`);
</script>

{#if step === 'reference'}
  <Panel title={title} focused>
    <Text text="A payment to a provider — debits their Accounts Payable balance, credits Cash and Bank." color={inkSoft} />
    <Box flexDirection="row"><Box width={14}><Text text="Reference" color={brass} /></Box><TextInput bind:value={reference} focused onSubmit={() => { if (reference.trim()) step = 'provider'; }} /></Box>
    <Text text="Enter continues · Escape back to menu" color={inkSoft} dim />
  </Panel>
{:else if step === 'provider'}
  <Panel title={`${title} — ${reference}`} focused>
    <Box flexDirection="row"><Box width={14}><Text text="Provider" color={brass} /></Box><TextInput bind:value={provider} focused onSubmit={() => { if (provider.trim()) step = 'amount'; }} /></Box>
    <Text text="Type an existing provider's exact name · Enter continues · Escape back" color={inkSoft} dim />
  </Panel>
{:else if step === 'amount'}
  <Panel title={`${title} — ${reference}`} focused>
    <Box flexDirection="row"><Box width={14}><Text text="Amount" color={brass} /></Box><TextInput bind:value={amount} focused onSubmit={() => { if (amount) step = 'description'; }} /></Box>
    <Text text={amount ? `= $${formatMinor(amountMinor)}` : ''} color={inkSoft} />
    <Text text="Enter continues · Escape back" color={inkSoft} dim />
  </Panel>
{:else if step === 'saved' && saved}
  <Panel title={title} focused>
    <Text text={saved} color={brass} bold />
    <Text text="Escape back to menu" color={inkSoft} dim />
  </Panel>
{:else}
  <Panel title={`${title} — ${reference}`} focused>
    <Text text={`Provider: ${provider}\nAmount: $${formatMinor(amountMinor)}`} color={ink} />
    <Box flexDirection="row"><Box width={14}><Text text="Description" color={brass} /></Box><TextInput bind:value={description} focused onSubmit={() => void save()} /></Box>
    <Text text={error ?? ''} color="red" />
    {#if busy}<Text text="Working…" color={inkSoft} />{/if}
    <Text text="Optional · Enter saves and posts the payment · Escape back" color={inkSoft} dim />
  </Panel>
{/if}
