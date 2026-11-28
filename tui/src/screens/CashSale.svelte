<!--
  The web app's Cash Sale screen (frontend/src/lib/components/
  CashTransaction.svelte, direction 'sale'): a sale to the 'Cash'
  customer, posted exactly like an on-account sale and paid off in full
  the same instant (completePosSale, the endpoint the POS terminal
  uses). Stock can be dispatched from any location, a warehouse
  included. The form itself is components/CashTransaction.svelte.
-->
<script lang="ts">
  import { asBusinessName, asLedgerName, completePosSale } from '../api.ts';
  import CashTransaction, { type CashLine } from '../components/CashTransaction.svelte';

  let { businessName, ledgerName, onBack }: { businessName: string; ledgerName: string; onBack: () => void } = $props();

  const complete = (locationName: string, lines: CashLine[], paymentMethod: 'cash' | 'eft') =>
    completePosSale({
      business: asBusinessName(businessName),
      ledger: asLedgerName(ledgerName),
      locationName,
      customerName: 'Cash',
      lines,
      taxAccount: 'Sales Tax Payable',
      paymentMethod,
      transdate: new Date().toISOString().slice(0, 10),
    });
</script>

<CashTransaction
  title={`Cash Sale — ${businessName} / ${ledgerName}`}
  intro="A sale to the 'Cash' customer — posted and paid off in full the same instant."
  locationLabel="Dispatch from location"
  completeLabel="Complete sale"
  completedLabel="Sale completed"
  {businessName}
  {complete}
  {onBack}
/>
