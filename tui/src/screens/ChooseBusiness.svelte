<script lang="ts">
  import { Text } from 'sveltui';
  import { ApiError, getBusinesses, getLedgers, getSession, setSessionBusiness, setSession } from '../api.ts';
  import Panel from '../components/Panel.svelte';
  import SelectList from '../components/SelectList.svelte';
  import { inkSoft } from '../theme.ts';

  let { onChosen }: { onChosen: (businessName: string, ledgerName: string) => void } = $props();

  let step: 'business' | 'ledger' = $state('business');
  let businesses: { id: number; name: string }[] | null = $state(null);
  let ledgers: { id: number; name: string }[] | null = $state(null);
  let businessName: string | null = $state(null);
  let error: string | null = $state(null);

  getBusinesses()
    .then((rows) => (businesses = rows))
    .catch((err) => (error = err instanceof ApiError ? err.message : 'Could not load businesses.'));

  async function chooseBusiness(name: string) {
    businessName = name;
    try {
      await setSessionBusiness(name);
      ledgers = await getLedgers(name);
      step = 'ledger';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not load ledgers.';
    }
  }

  function chooseLedger(ledgerName: string) {
    const session = getSession();
    if (session) setSession({ ...session, businessName: businessName!, ledgerName });
    onChosen(businessName!, ledgerName);
  }
</script>

{#if error}
  <Panel title="Choose a business"><Text text={error} color="red" /></Panel>
{:else if step === 'business'}
  {#if !businesses}
    <Panel title="Choose a business"><Text text="Loading…" color={inkSoft} /></Panel>
  {:else}
    <Panel title="Choose a business" focused>
      <SelectList items={businesses.map((b) => ({ label: b.name, value: b.name }))} onSelect={(item) => chooseBusiness(item.value)} />
    </Panel>
  {/if}
{:else if !ledgers}
  <Panel title="Choose a ledger"><Text text="Loading…" color={inkSoft} /></Panel>
{:else}
  <Panel title={`Choose a ledger — ${businessName}`} focused>
    <SelectList items={ledgers.map((l) => ({ label: l.name, value: l.name }))} onSelect={(item) => chooseLedger(item.value)} />
  </Panel>
{/if}
