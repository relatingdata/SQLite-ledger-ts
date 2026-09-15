<script lang="ts">
  import { goto } from '$app/navigation';
  import { createBusiness, getCoaFamilyAccounts, getBusinessTypes, saveBusinessTypeAnswers, ApiError } from '$lib/api';
  import { translations } from '$lib/state.svelte';
  import { onMount } from 'svelte';

  // Real, existing ledgers whose actual Chart of Accounts a new
  // business can reuse — confirmed directly, not assumed, that these
  // are genuinely distinct real account sets, not just different
  // display names for the same underlying accounts. Only the five
  // top-level report categories (Asset/Liability/Equity/Income/
  // Expense) are actually shared across every business; these leaf
  // accounts are real, country-specific families.
  const COA_FAMILIES = [
    { label: 'English / generic', business: 'Wine Retail Business', ledger: 'Actual', familyName: 'English CoA' },
    { label: 'German (BMW M GmbH)', business: 'BMW M GmbH', ledger: 'Actual', familyName: 'German CoA' },
    { label: 'French (Peugeot Citroën Sochaux SNC)', business: 'Peugeot Citroën Sochaux SNC', ledger: 'Actual', familyName: 'French CoA' },
  ];

  let businessName = '';
  let financialYearLabel = '2026-27';
  let selectedFamily = COA_FAMILIES[0];
  let familyAccounts: string[] = [];
  let loadingAccounts = false;
  let saving = false;
  let error = '';
  let result: { business: string; actualLedger: string; budgetLedger: string } | null = null;

  // Per direct insight: the vast majority of real businesses transact
  // in one, single, home currency — a second currency is a real need
  // only for a business genuinely near a national border, not the
  // common case. Deliberately collapsed, optional, and off by
  // default, not a mandatory step every new business has to think
  // through.
  let showCurrencies = false;
  let newCurrencyCode = '';
  let secondaryCurrencies: string[] = [];
  function addCurrency() {
    const code = newCurrencyCode.trim().toUpperCase();
    if (!code || secondaryCurrencies.includes(code)) return;
    secondaryCurrencies = [...secondaryCurrencies, code];
    newCurrencyCode = '';
  }
  function removeCurrency(code: string) {
    secondaryCurrencies = secondaryCurrencies.filter((c) => c !== code);
  }

  // Per direct confirmation: a business's own legal structure is
  // largely cosmetic/reporting — only the Balance Sheet's own equity
  // section changes shape, nothing else. Defaults to Sole Trader,
  // which needs no extra setup at all (Owner's Equity already exists).
  const ENTITY_STRUCTURES: { value: 'sole_trader' | 'partnership' | 'llc' | 'unlimited_liability' | 'publicly_traded'; label: string; needsPartners: boolean }[] = [
    { value: 'sole_trader', label: 'Sole Trader', needsPartners: false },
    { value: 'partnership', label: 'Partnership', needsPartners: true },
    { value: 'llc', label: 'Limited Liability Company', needsPartners: true },
    { value: 'unlimited_liability', label: 'Unlimited Liability Company', needsPartners: false },
    { value: 'publicly_traded', label: 'Publicly Traded Company', needsPartners: false },
  ];
  let entityStructure: (typeof ENTITY_STRUCTURES)[number] = ENTITY_STRUCTURES[0];
  let newPartnerName = '';
  let partnerNames: string[] = [];
  function addPartner() {
    const name = newPartnerName.trim();
    if (!name || partnerNames.includes(name)) return;
    partnerNames = [...partnerNames, name];
    newPartnerName = '';
  }
  function removePartner(name: string) {
    partnerNames = partnerNames.filter((p) => p !== name);
  }

  // Real business types, read from the database (the real 'Business
  // Type' entity tree — Sole Trader/Partnership/Pty Ltd Company/
  // Incorporated Company, each with its own real prototype CoA and
  // questions) rather than a hardcoded frontend list. Mapped to the
  // existing, already-working EntityStructure values so the backend's
  // own setupEquityStructure mechanism (which creates the real extra
  // equity accounts per structure) keeps working unchanged — this is
  // a real, additive unification, not a rewrite of a working
  // mechanism.
  const BUSINESS_TYPE_TO_ENTITY_STRUCTURE: Record<string, (typeof ENTITY_STRUCTURES)[number]['value']> = {
    'Sole Trader': 'sole_trader',
    Partnership: 'partnership',
    'Pty Ltd Company': 'llc',
    'Incorporated Company': 'publicly_traded',
  };
  let businessTypes: { name: string; questions: string[] }[] = [];
  let selectedBusinessType: { name: string; questions: string[] } | null = null;
  let questionAnswers: Record<string, string> = {};
  onMount(async () => {
    try {
      businessTypes = await getBusinessTypes();
      if (businessTypes.length > 0) selectBusinessType(businessTypes[0]);
    } catch {
      businessTypes = [];
    }
  });
  function selectBusinessType(bt: { name: string; questions: string[] }) {
    if (selectedBusinessType?.name === bt.name) return;
    selectedBusinessType = bt;
    questionAnswers = {};
    const mapped = BUSINESS_TYPE_TO_ENTITY_STRUCTURE[bt.name];
    if (mapped) entityStructure = ENTITY_STRUCTURES.find((s) => s.value === mapped) ?? entityStructure;
  }

  async function loadFamilyAccounts() {
    loadingAccounts = true;
    try {
      familyAccounts = await getCoaFamilyAccounts(selectedFamily.business, selectedFamily.ledger);
    } catch {
      familyAccounts = [];
    } finally {
      loadingAccounts = false;
    }
  }

  loadFamilyAccounts();

  async function submit() {
    if (!businessName.trim() || !financialYearLabel.trim()) return;
    saving = true;
    error = '';
    try {
      result = await createBusiness(
        businessName.trim(),
        financialYearLabel.trim(),
        selectedFamily.familyName,
        secondaryCurrencies.length > 0 ? secondaryCurrencies : undefined,
        entityStructure.value,
        entityStructure.needsPartners && partnerNames.length > 0 ? partnerNames : undefined
      );
      const answered = Object.fromEntries(Object.entries(questionAnswers).filter(([, v]) => v && v.trim()));
      if (Object.keys(answered).length > 0) {
        await saveBusinessTypeAnswers(businessName.trim(), answered);
      }
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not create business.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head><title>{translations.current['New Business'] ?? 'New Business'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['New Business'] ?? 'New Business'}</legend>
  <p class="intro">{translations.current['Creates a brand-new business and its first real ledger, ready to actually transact in immediately. Only the five top-level report categories (Asset/Liability/Equity/Income/Expense) are genuinely shared across every business here — the real, named accounts underneath are country-specific families that already exist. Choose which existing family\'s real accounts most closely match this business\'s own country/jurisdiction below, so you know exactly which real accounts to post to — this doesn\'t create anything new, it just shows you what already exists to reuse. If none of these match, the Entity Tree Editor can build a genuinely new set for a country not yet represented here.'] ?? 'Creates a brand-new business and its first real ledger, ready to actually transact in immediately. Only the five top-level report categories (Asset/Liability/Equity/Income/Expense) are genuinely shared across every business here — the real, named accounts underneath are country-specific families that already exist. Choose which existing family\'s real accounts most closely match this business\'s own country/jurisdiction below, so you know exactly which real accounts to post to — this doesn\'t create anything new, it just shows you what already exists to reuse. If none of these match, the Entity Tree Editor can build a genuinely new set for a country not yet represented here.'}</p>

  {#if result}
    <p class="success">
      <strong>{result.business}</strong> created, with two real ledgers ready from day one:
      <strong>{result.actualLedger}</strong> and <strong>{result.budgetLedger}</strong>.
    </p>
    <p>
      Next: post the owner's capital contribution into <strong>{result.actualLedger}</strong> through
      <a href="/post">{translations.current['General Journal'] ?? 'General Journal'}</a> (debit whichever cash/bank account matches the chosen family, credit
      the matching equity account), then set up any real locations under
      <a href="/setup/tree">{translations.current['Entity Tree'] ?? 'Entity Tree'}</a> and <a href="/locations">{translations.current['Locations'] ?? 'Locations'}</a>. Post the financial year's
      plan into <strong>{result.budgetLedger}</strong> the same way — Budget is just another real ledger,
      comparable against Actual through <a href="/reports/compare">{translations.current['Compare Ledgers'] ?? 'Compare Ledgers'}</a>.
    </p>
    <button class="btn" onclick={() => goto('/post')}>{translations.current['Go to General Journal'] ?? 'Go to General Journal'}</button>
  {:else}
    <fieldset>
      <legend>{translations.current['Business Name'] ?? 'Business Name'}</legend>
      <input bind:value={businessName} placeholder="e.g. Corner Store Pty Ltd" />
    </fieldset>
    <fieldset>
      <legend>{translations.current['Financial Year'] ?? 'Financial Year'}</legend>
      <input bind:value={financialYearLabel} placeholder="e.g. 2026-27" />
      <p class="field-note">
        Creates both a real Actual ledger for ongoing transactions and a real Budget ledger for this financial
        year — a new business needs both from day one, not a second thing to remember to set up later. Free
        text, not computed from today's date — a real fiscal year start genuinely varies by country.
      </p>
    </fieldset>
    <fieldset>
      <legend>{translations.current['Chart of Accounts family to reuse'] ?? 'Chart of Accounts family to reuse'}</legend>
      <select bind:value={selectedFamily} onchange={loadFamilyAccounts}>
        {#each COA_FAMILIES as f}<option value={f}>{f.label}</option>{/each}
      </select>
    </fieldset>
    <fieldset>
      <legend>{translations.current['Business type'] ?? 'Business type'}</legend>
      {#if businessTypes.length > 0}
        <select value={selectedBusinessType?.name} onchange={(e) => selectBusinessType(businessTypes.find((bt) => bt.name === (e.target as HTMLSelectElement).value)!)}>
          {#each businessTypes as bt}<option value={bt.name}>{translations.current[bt.name] ?? bt.name}</option>{/each}
        </select>
        <p class="field-note">
          {translations.current["This only changes the Balance Sheet's own equity section — Sole Trader needs nothing extra (the real, shared Owner's Equity account already exists); the others get their own real, additional equity accounts."] ?? "This only changes the Balance Sheet's own equity section — Sole Trader needs nothing extra (the real, shared Owner's Equity account already exists); the others get their own real, additional equity accounts."}
        </p>
        {#if selectedBusinessType && selectedBusinessType.questions.length > 0}
          <div class="business-type-questions">
            {#each selectedBusinessType.questions as q}
              <label class="question-row">
                <span>{translations.current[q] ?? q}</span>
                <input bind:value={questionAnswers[q]} />
              </label>
            {/each}
          </div>
        {/if}
      {:else}
        <p class="field-note">{translations.current['Loading business types…'] ?? 'Loading business types…'}</p>
      {/if}
      {#if entityStructure.needsPartners}
        {#if partnerNames.length > 0}
          <ul class="currency-list">
            {#each partnerNames as name}
              <li>{name} <button type="button" class="remove-link" onclick={() => removePartner(name)}>×</button></li>
            {/each}
          </ul>
        {/if}
        <div class="currency-add-row">
          <input bind:value={newPartnerName} placeholder="e.g. Alice Nguyen" onkeydown={(e) => e.key === 'Enter' && addPartner()} />
          <button type="button" class="btn small" onclick={addPartner}>{translations.current['Add'] ?? 'Add'}</button>
        </div>
      {/if}
    </fieldset>
    <div class="accounts-preview">
      {#if loadingAccounts}
        <p class="empty">Loading…</p>
      {:else if familyAccounts.length === 0}
        <p class="empty">No accounts posted under this ledger yet — nothing to preview.</p>
      {:else}
        <p class="preview-label">{translations.current['Real accounts this family actually uses:'] ?? 'Real accounts this family actually uses:'}</p>
        <ul>
          {#each familyAccounts as a}<li>{a}</li>{/each}
        </ul>
      {/if}
    </div>

    {#if !showCurrencies}
      <button type="button" class="add-link" onclick={() => (showCurrencies = true)}>
        + {translations.current['Accept additional currencies (cash only)'] ?? 'Accept additional currencies (cash only)'}
      </button>
    {:else}
      <fieldset>
        <legend>{translations.current['Additional currencies accepted as cash'] ?? 'Additional currencies accepted as cash'}</legend>
        <p class="field-note">
          {translations.current['Most real businesses transact in one, single currency — this is only for a business genuinely near a national border, or one that otherwise expects to take real cash in another currency. Each one gets its own real "Cash at Bank" account, ready to use immediately.'] ?? 'Most real businesses transact in one, single currency — this is only for a business genuinely near a national border, or one that otherwise expects to take real cash in another currency. Each one gets its own real "Cash at Bank" account, ready to use immediately.'}
        </p>
        {#if secondaryCurrencies.length > 0}
          <ul class="currency-list">
            {#each secondaryCurrencies as code}
              <li>{code} <button type="button" class="remove-link" onclick={() => removeCurrency(code)}>×</button></li>
            {/each}
          </ul>
        {/if}
        <div class="currency-add-row">
          <input bind:value={newCurrencyCode} placeholder="e.g. EUR" maxlength="3" onkeydown={(e) => e.key === 'Enter' && addCurrency()} />
          <button type="button" class="btn small" onclick={addCurrency}>{translations.current['Add'] ?? 'Add'}</button>
        </div>
      </fieldset>
    {/if}

    {#if error}<p class="error">{error}</p>{/if}
    <button class="btn" onclick={submit} disabled={saving || !businessName.trim() || !financialYearLabel.trim()}>
      {saving ? 'Creating…' : 'Create Business'}
    </button>
  {/if}
</fieldset>

<style>
  .business-type-questions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.6rem;
  }
  .question-row {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: var(--font-size-base);
  }
  .success {
    color: var(--credit);
  }
  .field-note {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    margin: 0.3rem 0 0;
  }
  .accounts-preview {
    border: 1px solid var(--rule);
    border-radius: 6px;
    padding: 0.5rem 0.7rem;
    max-height: 180px;
    overflow-y: auto;
  }
  .preview-label {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    margin: 0 0 0.3rem;
  }
  .accounts-preview ul {
    margin: 0;
    padding-left: 1.1rem;
    font-size: var(--font-size-small);
  }
  .empty {
    color: var(--ink-soft);
    font-size: var(--font-size-base);
    margin: 0;
  }
  .error {
    color: var(--debit);
  }
  .add-link {
    background: none;
    border: none;
    color: var(--brass-dark, #8a6d3b);
    font-size: var(--font-size-base);
    cursor: pointer;
    padding: 0.2rem 0;
    text-align: left;
  }
  .currency-list {
    list-style: none;
    margin: 0.4rem 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .currency-list li {
    background: #f2e6c9;
    border-radius: 4px;
    padding: 0.15rem 0.5rem;
    font-size: var(--font-size-base);
  }
  .remove-link {
    background: none;
    border: none;
    cursor: pointer;
    font-weight: bold;
    color: var(--debit, #a33a2e);
    padding: 0 0.15rem;
  }
  .currency-add-row {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.3rem;
  }
  .currency-add-row input {
    width: 100px;
    padding: 0.2rem 0.4rem;
    border: 1px solid var(--rule);
    border-radius: 4px;
  }
  .btn.small {
    padding: 0.2rem 0.6rem;
    font-size: var(--font-size-base);
  }
</style>
