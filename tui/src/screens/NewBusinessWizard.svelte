<!--
  A TUI port of frontend/src/routes/setup/new-business/+page.svelte's
  real flow: business basics -> POST /businesses (createBusiness) ->
  show the generated admin credentials exactly once -> the
  post-creation bank/currency wizard (nominateBankAccount, then
  buildBankCurrencyStructure). Same endpoints, same payload shapes -
  see tui/src/api.ts.
-->
<script lang="ts">
  import { Box, Text } from 'sveltui';
  import { keyboard } from 'sveltui';
  import { onDestroy } from 'svelte';
  import {
    ApiError,
    buildBankCurrencyStructure,
    createBusiness,
    nominateBankAccount,
    type CreateBusinessResult,
    type EntityStructure,
    type ReportingFrequency,
  } from '../api.ts';
  import Panel from '../components/Panel.svelte';
  import TextInput from '../components/TextInput.svelte';
  import SelectList from '../components/SelectList.svelte';
  import { brass, ink, inkSoft } from '../theme.ts';

  type Step =
    | 'name'
    | 'fy-label'
    | 'fy-start'
    | 'reporting-frequency'
    | 'coa-prototype'
    | 'entity-structure'
    | 'partners'
    | 'home-currency'
    | 'secondary-currencies'
    | 'confirm'
    | 'created'
    | 'bank-name'
    | 'bank-routing'
    | 'bank-account-number'
    | 'banks-list'
    | 'combos'
    | 'done';

  const REPORTING_FREQUENCIES: { label: string; value: ReportingFrequency }[] = [
    { label: 'Annual', value: 'annual' },
    { label: 'Biannual (every 6 months)', value: 'biannual' },
    { label: 'Quarterly', value: 'quarterly' },
    { label: 'Monthly', value: 'monthly' },
  ];
  const COA_PROTOTYPES = [
    { label: 'English / generic', value: 'English CoA' },
    { label: 'German', value: 'German CoA' },
    { label: 'French', value: 'French CoA' },
  ];
  const ENTITY_STRUCTURES: { label: string; value: EntityStructure; needsPartners: boolean }[] = [
    { label: 'Sole Trader', value: 'sole_trader', needsPartners: false },
    { label: 'Partnership', value: 'partnership', needsPartners: true },
    { label: 'Limited Liability Company', value: 'llc', needsPartners: true },
    { label: 'Unlimited Liability Company', value: 'unlimited_liability', needsPartners: false },
    { label: 'Publicly Traded Company', value: 'publicly_traded', needsPartners: false },
  ];

  function defaultFyLabel(): string {
    const y = new Date().getFullYear();
    return `${y}-${String(y + 1).slice(2)}`;
  }
  function defaultFyStart(): string {
    return `${new Date().getFullYear()}-07-01`;
  }

  interface NominatedBank {
    name: string;
    routingDetail: string;
    accountNumber: string;
  }

  let { onBack }: { onBack: () => void } = $props();

  let step: Step = $state('name');
  let error: string | null = $state(null);
  let busy = $state(false);

  let businessName = $state('');
  let fyLabel = $state(defaultFyLabel());
  let fyStart = $state(defaultFyStart());
  let reportingFrequency: ReportingFrequency = $state('annual');
  let coaPrototype = $state('English CoA');
  let entityStructure: EntityStructure = $state('sole_trader');
  let needsPartners = $state(false);
  let partnerInput = $state('');
  let partnerNames: string[] = $state([]);
  let homeCurrency = $state('AUD');
  let currencyInput = $state('');
  let secondaryCurrencies: string[] = $state([]);

  let result: CreateBusinessResult | null = $state(null);

  let bankName = $state('');
  let bankRouting = $state('');
  let bankAccountNumber = $state('');
  let nominatedBanks: NominatedBank[] = $state([]);
  let combos: { bankAccountName: string; currency: string; ticked: boolean }[] = $state([]);
  let comboSelected = $state(0);

  $effect(() => {
    homeCurrency = homeCurrency.toUpperCase();
  });
  $effect(() => {
    currencyInput = currencyInput.toUpperCase();
  });

  const unsubscribe = keyboard.on((event) => {
    if (event.key === 'Escape') {
      if (step === 'banks-list' || step === 'combos') {
        // the business itself already exists by this point - Escape just
        // skips the rest of the optional bank wizard
        onBack();
        return true;
      }
      if (step !== 'created' && step !== 'done') onBack();
      return true;
    }
    if (step === 'banks-list') {
      if (event.key === 'i') { step = 'bank-name'; return true; }
      if (event.key === 'c' && nominatedBanks.length > 0) { startCombos(); return true; }
    }
    if (step === 'combos') {
      switch (event.key) {
        case 'ArrowDown':
          comboSelected = Math.min(comboSelected + 1, combos.length - 1);
          return true;
        case 'ArrowUp':
          comboSelected = Math.max(comboSelected - 1, 0);
          return true;
        case 'Enter':
          void buildCombos();
          return true;
        default:
          if (event.key === ' ') {
            combos = combos.map((c, i) => (i === comboSelected ? { ...c, ticked: !c.ticked } : c));
            return true;
          }
          return false;
      }
    }
    if (step === 'done' && event.key === 'Enter') { onBack(); return true; }
    return false;
  });
  onDestroy(unsubscribe);

  async function submitBusiness() {
    busy = true; error = null;
    try {
      const created = await createBusiness(
        businessName.trim(),
        fyLabel.trim(),
        coaPrototype,
        secondaryCurrencies.length > 0 ? secondaryCurrencies : undefined,
        entityStructure,
        needsPartners && partnerNames.length > 0 ? partnerNames : undefined,
        fyStart || undefined,
        reportingFrequency,
      );
      result = created;
      step = 'created';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not create business.';
      step = 'confirm';
    } finally { busy = false; }
  }

  async function addBank() {
    if (!result) return;
    busy = true; error = null;
    try {
      await nominateBankAccount(result.business, bankName.trim(), bankRouting.trim(), bankAccountNumber.trim());
      nominatedBanks = [...nominatedBanks, { name: bankName.trim(), routingDetail: bankRouting.trim(), accountNumber: bankAccountNumber.trim() }];
      bankName = '';
      bankRouting = '';
      bankAccountNumber = '';
      step = 'banks-list';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not nominate that bank account.';
      step = 'banks-list';
    } finally { busy = false; }
  }

  function startCombos() {
    const allCurrencies = [homeCurrency, ...secondaryCurrencies];
    combos = nominatedBanks.flatMap((b) => allCurrencies.map((c) => ({ bankAccountName: b.name, currency: c, ticked: c === homeCurrency })));
    comboSelected = 0;
    step = 'combos';
  }

  async function buildCombos() {
    if (!result) return;
    const selections = combos.filter((c) => c.ticked).map(({ bankAccountName, currency }) => ({ bankAccountName, currency }));
    if (selections.length === 0) { step = 'done'; return; }
    busy = true; error = null;
    try {
      await buildBankCurrencyStructure(result.business, 'Cash at Bank', 'asset', selections, homeCurrency.trim().toUpperCase());
      step = 'done';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not build the Cash at Bank structure.';
    } finally { busy = false; }
  }

  const allCurrencies = $derived([homeCurrency, ...secondaryCurrencies]);
</script>

{#if step === 'name'}
  <Panel title="New Business — name" focused>
    <TextInput bind:value={businessName} focused onSubmit={() => { if (businessName.trim()) step = 'fy-label'; }} />
    <Text text="Enter continues · Escape cancels" color={inkSoft} dim />
  </Panel>
{:else if step === 'fy-label'}
  <Panel title={`New Business — ${businessName} — financial year label`} focused>
    <TextInput bind:value={fyLabel} focused onSubmit={() => { if (fyLabel.trim()) step = 'fy-start'; }} />
    <Text text={'Names the Budget ledger (e.g. "2026-27") · Enter continues · Escape cancels'} color={inkSoft} dim />
  </Panel>
{:else if step === 'fy-start'}
  <Panel title={`New Business — ${businessName} — financial year start date`} focused>
    <TextInput bind:value={fyStart} focused onSubmit={() => (step = 'reporting-frequency')} />
    <Text text="YYYY-MM-DD · Enter continues · Escape cancels" color={inkSoft} dim />
  </Panel>
{:else if step === 'reporting-frequency'}
  <Panel title={`New Business — ${businessName} — reporting frequency`} focused>
    <SelectList items={REPORTING_FREQUENCIES} onSelect={(item) => { reportingFrequency = item.value; step = 'coa-prototype'; }} />
    <Text text="↑/↓ move · Enter select · Escape cancels" color={inkSoft} dim />
  </Panel>
{:else if step === 'coa-prototype'}
  <Panel title={`New Business — ${businessName} — Chart of Accounts prototype`} focused>
    <SelectList items={COA_PROTOTYPES} onSelect={(item) => { coaPrototype = item.value; step = 'entity-structure'; }} />
    <Text text="↑/↓ move · Enter select · Escape cancels" color={inkSoft} dim />
  </Panel>
{:else if step === 'entity-structure'}
  <Panel title={`New Business — ${businessName} — legal structure`} focused>
    <SelectList
      items={ENTITY_STRUCTURES}
      onSelect={(item) => {
        const choice = ENTITY_STRUCTURES.find((s) => s.value === item.value) ?? ENTITY_STRUCTURES[0];
        entityStructure = choice.value;
        needsPartners = choice.needsPartners;
        step = choice.needsPartners ? 'partners' : 'home-currency';
      }}
    />
    <Text text="↑/↓ move · Enter select · Escape cancels" color={inkSoft} dim />
  </Panel>
{:else if step === 'partners'}
  <Panel title={`New Business — ${businessName} — partners`} focused>
    {#each partnerNames as p (p)}
      <Text text={`• ${p}`} color={ink} />
    {/each}
    <TextInput
      bind:value={partnerInput}
      focused
      onSubmit={() => {
        const name = partnerInput.trim();
        if (name) {
          partnerNames = [...partnerNames, name];
          partnerInput = '';
        } else {
          step = 'home-currency';
        }
      }}
    />
    <Text text="Enter a partner's name and press Enter to add another · empty Enter continues · Escape cancels" color={inkSoft} dim />
  </Panel>
{:else if step === 'home-currency'}
  <Panel title={`New Business — ${businessName} — home currency`} focused>
    <TextInput bind:value={homeCurrency} focused onSubmit={() => { if (homeCurrency.trim()) step = 'secondary-currencies'; }} />
    <Text text="e.g. AUD · Enter continues · Escape cancels" color={inkSoft} dim />
  </Panel>
{:else if step === 'secondary-currencies'}
  <Panel title={`New Business — ${businessName} — additional currencies (optional)`} focused>
    {#each secondaryCurrencies as c (c)}
      <Text text={`• ${c}`} color={ink} />
    {/each}
    <TextInput
      bind:value={currencyInput}
      focused
      onSubmit={() => {
        const code = currencyInput.trim();
        if (code && !secondaryCurrencies.includes(code)) {
          secondaryCurrencies = [...secondaryCurrencies, code];
          currencyInput = '';
        } else {
          step = 'confirm';
        }
      }}
    />
    <Text text="e.g. EUR, press Enter to add another · empty Enter continues · Escape cancels" color={inkSoft} dim />
  </Panel>
{:else if step === 'confirm'}
  <Panel title={`New Business — ${businessName} — review`} focused>
    <Text text={`Financial year: ${fyLabel} (starts ${fyStart}, ${reportingFrequency})`} color={ink} />
    <Text text={`Chart of Accounts prototype: ${coaPrototype}`} color={ink} />
    <Text text={`Legal structure: ${ENTITY_STRUCTURES.find((s) => s.value === entityStructure)?.label}`} color={ink} />
    {#if needsPartners}
      <Text text={`Partners: ${partnerNames.join(', ') || '(none entered)'}`} color={ink} />
    {/if}
    <Text text={`Home currency: ${homeCurrency}${secondaryCurrencies.length > 0 ? `, also ${secondaryCurrencies.join(', ')}` : ''}`} color={ink} />
    {#if error}<Text text={error} color="red" />{/if}
    {#if busy}<Text text="Creating…" color={inkSoft} />{/if}
    <Box marginTop={1}>
      <SelectList items={[{ label: 'Create this business', value: 'create' }]} onSelect={() => void submitBusiness()} />
    </Box>
    <Text text="Enter creates the business · Escape cancels" color={inkSoft} dim />
  </Panel>
{:else if step === 'created' && result}
  <Panel title={`${result.business} — created`} focused>
    <Text text={`${result.business} created, with two real ledgers: ${result.actualLedger} and ${result.budgetLedger}.`} color={brass} bold />
    <Text text="A dedicated admin user was created for this business. Copy this password now — it is shown only once." color="yellow" />
    <Text text={`Username: ${result.businessAdmin.username}`} color={ink} />
    <Text text={`Password: ${result.businessAdmin.password}`} color={ink} />
    <Box marginTop={1}>
      <SelectList items={[{ label: 'Continue to bank accounts', value: 'go' }]} onSelect={() => (step = 'bank-name')} />
    </Box>
    <Text text="Enter continues to the optional bank/currency wizard" color={inkSoft} dim />
  </Panel>
{:else if step === 'bank-name' || step === 'bank-routing' || step === 'bank-account-number'}
  <Panel title={`${result?.business} — nominate a bank account`} focused>
    <Box flexDirection="row">
      <Box width={16}>
        <Text text="Bank name" color={step === 'bank-name' ? brass : inkSoft} />
      </Box>
      <TextInput bind:value={bankName} focused={step === 'bank-name'} onSubmit={() => { if (bankName.trim()) step = 'bank-routing'; }} />
    </Box>
    <Box flexDirection="row">
      <Box width={16}>
        <Text text="BSB/routing" color={step === 'bank-routing' ? brass : inkSoft} />
      </Box>
      <TextInput bind:value={bankRouting} focused={step === 'bank-routing'} onSubmit={() => (step = 'bank-account-number')} />
    </Box>
    <Box flexDirection="row">
      <Box width={16}>
        <Text text="Account number" color={step === 'bank-account-number' ? brass : inkSoft} />
      </Box>
      <TextInput bind:value={bankAccountNumber} focused={step === 'bank-account-number'} onSubmit={() => void addBank()} />
    </Box>
    {#if error}<Text text={error} color="red" />{/if}
    {#if busy}<Text text="Saving…" color={inkSoft} />{/if}
    <Text text="Enter moves to the next field, then saves · Escape cancels the bank wizard" color={inkSoft} dim />
  </Panel>
{:else if step === 'banks-list'}
  <Panel title={`${result?.business} — nominated bank accounts`} focused>
    {#if nominatedBanks.length === 0}
      <Text text="No bank accounts nominated yet — press I to add one." color={inkSoft} />
    {/if}
    {#each nominatedBanks as b (b.name)}
      <Text text={`• ${b.name} — ${b.routingDetail} — ${b.accountNumber}`} color={ink} />
    {/each}
    <Text text="I add a bank account · C continue to currency setup · Escape skip the rest of the bank wizard" color={inkSoft} dim />
  </Panel>
{:else if step === 'combos'}
  <Panel title={`${result?.business} — Cash at Bank by currency`} focused>
    <Text text={'Tick which bank/currency pairs should get a real "Cash at Bank" account.'} color={inkSoft} />
    {#each combos as c, i (`${c.bankAccountName}-${c.currency}`)}
      <Text text={`${i === comboSelected ? '› ' : '  '}[${c.ticked ? 'x' : ' '}] ${c.bankAccountName} — ${c.currency}`} color={i === comboSelected ? brass : ink} />
    {/each}
    {#if allCurrencies.length === 1 && combos.length > 0}
      <Text text="(one currency — every bank account is ticked for it by default)" color={inkSoft} />
    {/if}
    {#if error}<Text text={error} color="red" />{/if}
    {#if busy}<Text text="Building…" color={inkSoft} />{/if}
    <Text text="↑/↓ move · Space toggle · Enter build the real structure · Escape skip" color={inkSoft} dim />
  </Panel>
{:else}
  <Panel title={`${result?.business} — ready`} focused>
    <Text text={`${result?.business} is set up and ready to post real transactions in.`} color={brass} bold />
    <Text text="Enter/Escape back to menu" color={inkSoft} dim />
  </Panel>
{/if}
