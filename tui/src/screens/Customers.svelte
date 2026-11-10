<!--
  A TUI port of the web app's "Customers" screen
  (frontend/src/routes/contacts/+page.svelte, focus=customers) - browse
  real, account-based customers and edit their contact details
  (getContact/setContact). Customer (and provider) contacts aren't
  scoped to one business - every real customer is a direct child of
  the one, real, global entity literally named "Customers" - so this
  screen reads the unscoped entity tree and filters on that exact
  parent name, not a per-business one. Customers aren't created here
  at all - on the real app a new one is only ever created in passing,
  as a side effect of some other, real action (e.g. the first AR Sale
  naming it) - this screen only lists and edits ones that already
  exist.

  Deliberately out of scope for this v1 screen, same, real reason as
  every other simplification in this TUI: addresses, phone numbers,
  and counterparty transaction history are real, optional extras on
  the web screen; preferred-language and wage/salary fields are left
  out too. Email, payment terms, credit limit, and reminder level -
  enough to make the credit limit this screen itself can set actually
  mean something on the next AR Sale - are real and fully saved
  either way.
-->
<script lang="ts">
  import { Box, Text } from 'sveltui';
  import { keyboard } from 'sveltui';
  import { onDestroy } from 'svelte';
  import { ApiError, getContact, getCreditStatus, getEntityTree, setContact, type Contact, type CreditStatus, type EntityNode } from '../api.ts';
  import Panel from '../components/Panel.svelte';
  import TextInput from '../components/TextInput.svelte';
  import SelectList from '../components/SelectList.svelte';
  import { formatMinor } from '../components/MoneyText.svelte';
  import { brass, ink, inkSoft } from '../theme.ts';

  type Step = 'list' | 'email' | 'terms' | 'credit-limit' | 'reminder-level' | 'saved';

  function dollarsToMinorOrNull(text: string): number | null {
    const t = text.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
  }
  function intOrNull(text: string): number | null {
    const t = text.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isInteger(n) && n >= 0 ? n : null;
  }

  let { businessName, onBack }: { businessName: string; onBack: () => void } = $props();

  let step: Step = $state('list');
  let entities: EntityNode[] | null = $state(null);
  let error: string | null = $state(null);

  let selectedName = $state('');
  let email = $state('');
  let termsDays = $state('');
  let creditLimit = $state('');
  let reminderLevel = $state('');
  let creditStatus: CreditStatus | null = $state(null);
  let busy = $state(false);
  let message: string | null = $state(null);

  // Unscoped - see the comment above: real customer contacts aren't
  // business-scoped, so this intentionally does not pass businessName
  // the way the Purchasing screens' own listLocations/listItems calls
  // do.
  void getEntityTree()
    .then((r) => (entities = r))
    .catch((err) => (error = err instanceof ApiError ? err.message : 'Could not load customers.'));

  // Real customer contacts only - excludes the generic link/tag child
  // records that mechanism creates under the same "Customers"
  // container (e.g. "Customers — Hierarchy: Header Account"), always
  // named "<entity> — <linkType>" per that mechanism's own convention.
  const customers = $derived(
    (entities ?? []).filter((e) => (entities ?? []).find((p) => p.id === e.parent_id)?.name === 'Customers' && !e.name.includes(' — '))
  );

  const unsubscribe = keyboard.on((event) => {
    if (event.key === 'Escape') {
      if (step === 'list') { onBack(); return true; }
      if (step === 'email') { step = 'list'; return true; }
      if (step === 'terms') { step = 'email'; return true; }
      if (step === 'credit-limit') { step = 'terms'; return true; }
      if (step === 'reminder-level') { step = 'credit-limit'; return true; }
      if (step === 'saved') { step = 'list'; return true; }
      return true;
    }
    return false;
  });
  onDestroy(unsubscribe);

  async function selectCustomer(name: string) {
    selectedName = name;
    message = null;
    error = null;
    try {
      const [contact, status] = await Promise.all([getContact(name), getCreditStatus(name)]);
      email = contact?.email ?? '';
      termsDays = contact?.payment_terms_days != null ? String(contact.payment_terms_days) : '';
      creditLimit = contact?.credit_limit_minor != null ? (contact.credit_limit_minor / 100).toFixed(2) : '';
      reminderLevel = contact?.reminder_level != null ? String(contact.reminder_level) : '0';
      creditStatus = status;
      step = 'email';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not load this customer.';
    }
  }

  async function save() {
    busy = true; error = null;
    try {
      const update: Partial<Contact> = {
        email: email.trim() || null,
        payment_terms_days: intOrNull(termsDays),
        credit_limit_minor: dollarsToMinorOrNull(creditLimit),
        reminder_level: intOrNull(reminderLevel) ?? 0,
      };
      await setContact(selectedName, update);
      message = `Saved ${selectedName}.`;
      step = 'saved';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not save this customer.';
    } finally { busy = false; }
  }

  const title = $derived(`Customers — ${businessName}`);

  const creditLine = $derived(
    !creditStatus
      ? ''
      : creditStatus.limitMinor === null
        ? `Current balance: $${formatMinor(creditStatus.balanceMinor)} — no credit limit set.`
        : creditStatus.overLimit
          ? `Over limit — balance $${formatMinor(creditStatus.balanceMinor)} exceeds the $${formatMinor(creditStatus.limitMinor)} limit.`
          : `Balance $${formatMinor(creditStatus.balanceMinor)} of $${formatMinor(creditStatus.limitMinor)} limit.`
  );
  const creditLineColor = $derived(creditStatus?.overLimit ? 'red' : inkSoft);
</script>

{#if step === 'saved'}
  <Panel title={title} focused>
    <Text text={message ?? ''} color={brass} bold />
    <Text text="Escape back to the customer list" color={inkSoft} dim />
  </Panel>
{:else if step !== 'list'}
  <Panel title={`${title} — ${selectedName}`} focused>
    <Box flexDirection="row"><Box width={22}><Text text="Email" color={step === 'email' ? brass : ink} /></Box><TextInput bind:value={email} focused={step === 'email'} onSubmit={() => (step = 'terms')} /></Box>
    <Box flexDirection="row"><Box width={22}><Text text="Payment terms (days)" color={step === 'terms' ? brass : ink} /></Box><TextInput bind:value={termsDays} focused={step === 'terms'} onSubmit={() => (step = 'credit-limit')} /></Box>
    <Box flexDirection="row"><Box width={22}><Text text="Credit limit" color={step === 'credit-limit' ? brass : ink} /></Box><TextInput bind:value={creditLimit} focused={step === 'credit-limit'} onSubmit={() => (step = 'reminder-level')} /></Box>
    <Box flexDirection="row"><Box width={22}><Text text="Reminder level" color={step === 'reminder-level' ? brass : ink} /></Box><TextInput bind:value={reminderLevel} focused={step === 'reminder-level'} onSubmit={() => void save()} /></Box>
    <Text text={creditLine} color={creditLineColor} />
    <Text text={error ?? ''} color="red" />
    {#if busy}<Text text="Working…" color={inkSoft} />{/if}
    <Text text="0 payment terms means cash only · blank credit limit means no limit · Enter moves to the next field, saves on the last · Escape back" color={inkSoft} dim />
  </Panel>
{:else}
  <!--
    One single, stable Panel for the whole 'list' step, whether entities
    are still loading or already in hand - swapping in a brand new Panel
    component the instant data arrives (as an outer {#if entities === null}
    around the whole Panel once did) triggers a genuine sveltui layout bug
    where a freshly-mounted SelectList renders detached, at terminal row
    0, instead of inside its Panel. Keeping one Panel instance and only
    swapping its inner content avoids that same-tick remount entirely.
  -->
  <Panel title={title} focused>
    <Text text="Real, account-based customers — created today only via the Structured Editor or an API-side fixture step, not from this screen." color={inkSoft} />
    <Text text="Enter opens a customer's details · Escape back to menu" color={inkSoft} dim />
    <Text text={error ?? ''} color="red" />
    {#if entities === null}
      <Text text="Loading…" color={inkSoft} />
    {:else if customers.length === 0}
      <Text text="None yet." color={inkSoft} />
    {:else}
      <SelectList items={customers.map((c) => ({ label: c.name, value: c.name }))} onSelect={(item) => void selectCustomer(item.value)} />
    {/if}
  </Panel>
{/if}
