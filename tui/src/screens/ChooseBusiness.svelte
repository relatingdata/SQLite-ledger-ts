<script lang="ts">
  import { Text } from 'sveltui';
  import { ApiError, getBusinesses, getLedgers, getSession, setSessionBusiness, setSession } from '../api.ts';
  import Panel from '../components/Panel.svelte';
  import SelectList from '../components/SelectList.svelte';
  import { inkSoft } from '../theme.ts';

  // `startWith` opens straight at the ledger step of that business (as
  // after the New Business wizard's "Work in …"); "New Business", the
  // list's last entry as on the web's session page, opens the wizard.
  let {
    onChosen,
    onNewBusiness,
    startWith,
  }: { onChosen: (businessName: string, ledgerName: string) => void; onNewBusiness: () => void; startWith?: string } = $props();
  const NEW_BUSINESS = '\u0000new';

  let step: 'business' | 'ledger' = $state('business');
  let businesses: { id: number; name: string }[] | null = $state(null);
  let ledgers: { id: number; name: string }[] | null = $state(null);
  let businessName: string | null = $state(null);
  let error: string | null = $state(null);

  if (startWith) void chooseBusiness(startWith);
  else
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
      {#if businesses.length === 0}<Text text="No business yet: create the first one." color={inkSoft} />{/if}
      <SelectList
        items={[...businesses.map((b) => ({ label: b.name, value: b.name })), { label: 'New Business', value: NEW_BUSINESS }]}
        onSelect={(item) => (item.value === NEW_BUSINESS ? onNewBusiness() : chooseBusiness(item.value))}
      />
    </Panel>
  {/if}
{:else if !ledgers}
  <Panel title="Choose a ledger"><Text text="Loading…" color={inkSoft} /></Panel>
{:else}
  <Panel title={`Choose a ledger — ${businessName}`} focused>
    <SelectList items={ledgers.map((l) => ({ label: l.name, value: l.name }))} onSelect={(item) => chooseLedger(item.value)} />
  </Panel>
{/if}
