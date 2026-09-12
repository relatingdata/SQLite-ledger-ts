<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { getBusinesses, getLedgers, getLanguages, getLocalizedText, getLanguageDirection, asBusinessName, asLedgerName, ApiError } from '$lib/api';
  import { session } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';

  let businesses: { id: number; name: string }[] = $state([]);
  let ledgers: { id: number; name: string }[] = $state([]);
  let languages: { id: number; name: string }[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  let selectedBusinessId: number | '' = $state('');
  let selectedLedgerId: number | '' = $state('');
  let selectedLanguageId: number | '' = $state('');

  async function load() {
    loading = true;
    try {
      [businesses, languages] = await Promise.all([getBusinesses(), getLanguages()]);

      const current = session.current;
      const storedDisplayLanguage = browser ? localStorage.getItem('display-language') : null;
      selectedBusinessId =
        (current && businesses.find((b) => b.name === current.businessName)?.id) ?? businesses[0]?.id ?? '';
      selectedLanguageId =
        (current && languages.find((l) => l.name === current.languageName)?.id) ??
        (storedDisplayLanguage && languages.find((l) => l.name === storedDisplayLanguage)?.id) ??
        languages.find((l) => l.name === 'English')?.id ??
        languages[0]?.id ??
        '';
      await loadLedgers();
      await applyDisplayLanguage();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  }

  async function loadLedgers() {
    if (!selectedBusinessId) {
      ledgers = [];
      return;
    }
    const businessName = businesses.find((b) => b.id === selectedBusinessId)?.name;
    if (!businessName) return;
    ledgers = await getLedgers(businessName);
    const current = session.current;
    const preferred =
      (current && current.businessName === businessName && ledgers.find((l) => l.name === current.ledgerName)) ||
      ledgers.find((l) => l.name === 'Actual');
    selectedLedgerId = preferred?.id ?? ledgers[0]?.id ?? '';
  }

  onMount(load);

  $effect(() => {
    if (selectedBusinessId) loadLedgers();
  });

  // Reactive display translation — the same pattern the login page
  // uses (translations is populated from session.current.languageName
  // everywhere else in the app, but there's no session yet while
  // picking one, so this page needs its own direct wiring, same as
  // login does before authentication exists at all).
  let textDirection = $state<'ltr' | 'rtl'>('ltr');

  async function applyDisplayLanguage() {
    const language = languages.find((l) => l.id === selectedLanguageId)?.name;
    if (!language) return;
    try {
      translations.set(language === 'English' ? {} : await getLocalizedText(language));
    } catch {
      translations.set({});
    }
    try {
      const { direction } = await getLanguageDirection(language);
      textDirection = direction === 'RTL' ? 'rtl' : 'ltr';
    } catch {
      textDirection = 'ltr';
    }
  }

  function continueToApp() {
    if (!selectedBusinessId || !selectedLedgerId || !selectedLanguageId) return;
    const business = businesses.find((b) => b.id === selectedBusinessId)!;
    const ledger = ledgers.find((l) => l.id === selectedLedgerId)!;
    const language = languages.find((l) => l.id === selectedLanguageId)!;
    session.set({
      businessId: business.id,
      businessName: asBusinessName(business.name),
      ledgerId: ledger.id,
      ledgerName: asLedgerName(ledger.name),
      languageId: language.id,
      languageName: language.name,
    });
    goto('/');
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') continueToApp();
  }
</script>

<svelte:head><title>{translations.current['Choose business, ledger, and language'] ?? 'Choose business, ledger, and language'}</title></svelte:head>

<div class="app-frame" dir={textDirection}>
  <div class="app-frame-title">Better Brighter Multi-Ledger</div>
{#if loading}
  <p>Loading…</p>
{:else}
  {#if error}<p class="error">{error}</p>{/if}

  <div class="wrap">
    <!-- This fieldset only listens for Enter as a shortcut; the real interactive elements (the selects and button below) already have their own correct roles and keyboard behavior. -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
  <fieldset class="card-legend form" onkeydown={onKeydown}>
    <legend>{translations.current['Choose a business, ledger, and language'] ?? 'Choose a business, ledger, and language'}</legend>
    <p class="intro">
      Pick which business you're working in, which ledger — "Actual" is the real books; anything else is a separate,
      isolated scenario — and which language the interface displays in.
    </p>
    <fieldset>
      <legend>{translations.current['Business'] ?? 'Business'}</legend>
      <select bind:value={selectedBusinessId}>
        {#each businesses as b}
          <option value={b.id}>{translations.current[b.name] ?? b.name}</option>
        {/each}
      </select>
    </fieldset>

    <fieldset>
      <legend>{translations.current['Ledger'] ?? 'Ledger'}</legend>
      <select bind:value={selectedLedgerId}>
        {#each ledgers as l}
          <option value={l.id}>{translations.current[l.name] ?? l.name}</option>
        {/each}
      </select>
    </fieldset>

    <fieldset>
      <legend>{translations.current['Language'] ?? 'Language'}</legend>
      <select bind:value={selectedLanguageId} onchange={applyDisplayLanguage}>
        {#each languages as l}
          <option value={l.id}>{translations.current[l.name] ?? l.name}</option>
        {/each}
      </select>
    </fieldset>

    <button
      class="btn"
      onclick={continueToApp}
      disabled={!selectedBusinessId || !selectedLedgerId || !selectedLanguageId}
    >
      {translations.current['Continue'] ?? 'Continue'}
    </button>
  </fieldset>
  </div>
{/if}
</div>

<style>
  .app-frame {
    min-height: 95vh;
    border: 1px solid var(--rule);
    border-radius: 12px;
    margin: 0.5rem;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .app-frame-title {
    position: absolute;
    top: 1rem;
    left: 1.2rem;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--font-size-large);
    color: var(--ink);
  }

  .app-frame[dir="rtl"] .app-frame-title {
    left: auto;
    right: 1.2rem;
  }

  .intro {
    padding: 0.9rem 1.2rem;
  }

  .wrap {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 80vh;
  }

  .form {
    padding: 1.3rem 1.4rem 1.5rem;
    padding-top: 1.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    max-width: 420px;
  }

</style>
