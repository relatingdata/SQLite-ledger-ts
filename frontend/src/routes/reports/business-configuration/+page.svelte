<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { getBusinessConfigurationReport, ApiError, type BusinessConfigurationReport } from '$lib/api';
  import { translations } from '$lib/state.svelte';

  let report: BusinessConfigurationReport | null = $state(null);
  let loading = $state(true);
  let error = $state('');

  async function load() {
    if (!session.current) return;
    loading = true;
    error = '';
    try {
      report = await getBusinessConfigurationReport(session.current.businessName);
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  }

  onMount(load);
</script>

<svelte:head><title>{translations.current['Business Configuration Report'] ?? 'Business Configuration Report'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Business Configuration Report'] ?? 'Business Configuration Report'}</legend>
  <p class="intro">
    {translations.current['Everything this business\'s own setup actually captured - name, addresses, phones, owner(s)/partner(s), banking details, currencies, divisions, locations, and categories. Never item details - see Inventory Catalog for those.'] ?? 'Everything this business\'s own setup actually captured - name, addresses, phones, owner(s)/partner(s), banking details, currencies, divisions, locations, and categories. Never item details - see Inventory Catalog for those.'}
  </p>

  {#if loading}
    <p>{translations.current['Loading…'] ?? 'Loading…'}</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else if report}
    <fieldset>
      <legend>{translations.current['Business Name'] ?? 'Business Name'}</legend>
      <p>{report.businessName}</p>
    </fieldset>

    <fieldset>
      <legend>{translations.current['Addresses'] ?? 'Addresses'}</legend>
      {#if report.addresses.length === 0}
        <p class="field-note">{translations.current['None recorded.'] ?? 'None recorded.'}</p>
      {:else}
        {#each report.addresses as a}
          <p>{a.address_type}: {a.address1 ?? ''} {a.city ?? ''}</p>
        {/each}
      {/if}
    </fieldset>

    <fieldset>
      <legend>{translations.current['Phones'] ?? 'Phones'}</legend>
      {#if report.phones.length === 0}
        <p class="field-note">{translations.current['None recorded.'] ?? 'None recorded.'}</p>
      {:else}
        {#each report.phones as p}
          <p>{p.phone_type}: {p.phone ?? ''}</p>
        {/each}
      {/if}
    </fieldset>

    <fieldset>
      <legend>{translations.current['Owner(s) / Partner(s)'] ?? 'Owner(s) / Partner(s)'}</legend>
      {#if report.ownerOrPartners.length === 0}
        <p class="field-note">{translations.current['None recorded.'] ?? 'None recorded.'}</p>
      {:else}
        {#each report.ownerOrPartners as name}<p>{name}</p>{/each}
      {/if}
    </fieldset>

    <fieldset>
      <legend>{translations.current['Banking Details'] ?? 'Banking Details'}</legend>
      {#if report.bankAccounts.length === 0}
        <p class="field-note">{translations.current['None recorded.'] ?? 'None recorded.'}</p>
      {:else}
        <table>
          <thead><tr><th>{translations.current['Bank Account'] ?? 'Bank Account'}</th><th>{translations.current['Routing Detail'] ?? 'Routing Detail'}</th><th>{translations.current['Account Number'] ?? 'Account Number'}</th></tr></thead>
          <tbody>
            {#each report.bankAccounts as b}
              <tr><td>{b.name}</td><td>{b.routingDetail}</td><td>{b.accountNumber}</td></tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </fieldset>

    <fieldset>
      <legend>{translations.current['Currencies'] ?? 'Currencies'}</legend>
      <p>{translations.current['Home currency'] ?? 'Home currency'}: {report.homeCurrency ?? '—'}</p>
      {#if report.secondaryCurrencies.length > 0}
        <p>{translations.current['Also trades in'] ?? 'Also trades in'}: {report.secondaryCurrencies.join(', ')}</p>
      {/if}
    </fieldset>

    <fieldset>
      <legend>{translations.current['Divisions'] ?? 'Divisions'}</legend>
      {#if report.divisions.length === 0}
        <p class="field-note">{translations.current['None recorded.'] ?? 'None recorded.'}</p>
      {:else}
        {#each report.divisions as d}<p>{d}</p>{/each}
      {/if}
    </fieldset>

    <fieldset>
      <legend>{translations.current['Locations'] ?? 'Locations'}</legend>
      {#if report.locations.length === 0}
        <p class="field-note">{translations.current['None recorded.'] ?? 'None recorded.'}</p>
      {:else}
        <table>
          <thead><tr><th>{translations.current['Name'] ?? 'Name'}</th><th>{translations.current['City'] ?? 'City'}</th><th>{translations.current['Type'] ?? 'Type'}</th></tr></thead>
          <tbody>
            {#each report.locations as l}
              <tr><td>{l.name}</td><td>{l.city}</td><td>{l.locationType}</td></tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </fieldset>

    <fieldset>
      <legend>{translations.current['Categories'] ?? 'Categories'}</legend>
      {#if report.categories.length === 0}
        <p class="field-note">{translations.current['None recorded.'] ?? 'None recorded.'}</p>
      {:else}
        {#each report.categories as c}<p>{c}</p>{/each}
      {/if}
    </fieldset>

    <fieldset>
      <legend>{translations.current['Notes to the Financial Statements'] ?? 'Notes to the Financial Statements'}</legend>
      {#if report.notes.length === 0}
        <p class="field-note">{translations.current['None recorded.'] ?? 'None recorded.'}</p>
      {:else}
        {#each report.notes as n}<p>{n.text}</p>{/each}
      {/if}
    </fieldset>
  {/if}
</fieldset>
