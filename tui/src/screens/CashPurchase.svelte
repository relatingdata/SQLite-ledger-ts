<!--
  The web app's Cash Purchase screen (frontend/src/lib/components/
  CashTransaction.svelte, direction 'purchase'): a purchase from the
  'Cash' provider, posted exactly like an on-account purchase and paid
  off in full the same instant (completeCashPurchase, one atomic backend
  call). Stock can be received at any location, a warehouse included.
  The form itself is components/CashTransaction.svelte.
-->
<script lang="ts">
  import { asBusinessName, asLedgerName, completeCashPurchase } from '../api.ts';
  import CashTransaction, { type CashLine } from '../components/CashTransaction.svelte';

  let { businessName, ledgerName, onBack }: { businessName: string; ledgerName: string; onBack: () => void } = $props();

  const complete = (locationName: string, lines: CashLine[], paymentMethod: 'cash' | 'eft') =>
    completeCashPurchase({
      business: asBusinessName(businessName),
      ledger: asLedgerName(ledgerName),
      locationName,
      vendorName: 'Cash',
      lines,
      taxAccount: 'Sales Tax Payable',
      paymentMethod,
      transdate: new Date().toISOString().slice(0, 10),
    });
</script>

<CashTransaction
  title={`Cash Purchase — ${businessName} / ${ledgerName}`}
  intro="A purchase from the 'Cash' provider — posted and paid off in full the same instant."
  locationLabel="Receive at location"
  completeLabel="Complete purchase"
  completedLabel="Purchase completed"
  {businessName}
  {complete}
  {onBack}
/>
