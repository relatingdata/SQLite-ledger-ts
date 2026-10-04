<script lang="ts">
  import { onMount } from 'svelte';
  import { session, translations, auth } from '$lib/state.svelte';
  import { getStorageSpaceReport, ApiError, type StorageSpaceLocationGroup } from '$lib/api';
  import { formatAmount } from '$lib/format';

  let groups: StorageSpaceLocationGroup[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  onMount(async () => {
    if (!session.current) return;
    try {
      groups = await getStorageSpaceReport();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  });

  // Storage-space currencies are real, physical unit counts (how many
  // cartons, how many bottles) — never a dollar amount — so they are
  // shown as plain, whole numbers, never run through formatAmount's
  // own, real, currency-cents formatting.
  const fmt = (n: number) => n.toLocaleString(auth.current?.user.number_format?.includes(',') ? 'de-DE' : 'en-US');
</script>

<svelte:head><title>{translations.current['Inventory and Storage'] ?? 'Inventory and Storage'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Inventory and Storage'] ?? 'Inventory and Storage'}</legend>
  <p class="intro">
    {translations.current['Each real location\'s own, real, physical storage space — Installed, Occupied, and Remaining, per real storage unit (cartons, bottles, or whatever a business defines). These accounts live outside the Chart of Accounts, so they never appear on the Trial Balance.'] ?? "Each real location's own, real, physical storage space — Installed, Occupied, and Remaining, per real storage unit (cartons, bottles, or whatever a business defines). These accounts live outside the Chart of Accounts, so they never appear on the Trial Balance."}
  </p>
</fieldset>

{#if loading}
  <p>{translations.current['Loading…'] ?? 'Loading…'}</p>
{:else if error}
  <p class="error">{error}</p>
{:else if groups.length === 0}
  <p class="hint">{translations.current['No real storage-space activity yet.'] ?? 'No real storage-space activity yet.'}</p>
{:else}
  {#each groups as group}
    <fieldset class="location-group">
      <legend>{group.location}</legend>
      <table>
        <thead>
          <tr>
            <th>{translations.current['Storage Unit'] ?? 'Storage Unit'}</th>
            <th class="num">{translations.current['Installed'] ?? 'Installed'}</th>
            <th class="num">{translations.current['Occupied'] ?? 'Occupied'}</th>
            <th class="num">{translations.current['Remaining'] ?? 'Remaining'}</th>
            <th>{translations.current['Balanced?'] ?? 'Balanced?'}</th>
          </tr>
        </thead>
        <tbody>
          {#each group.currencies as c}
            <tr>
              <td>{c.currency.replace(/^SPACE-/, '')}</td>
              <td class="num">{fmt(Math.abs(c.installed_minor))}</td>
              <td class="num">{fmt(c.occupied_minor)}</td>
              <td class="num">{fmt(c.remaining_minor)}</td>
              <td class={c.balanced ? 'ok' : 'warn'}>{c.balanced ? (translations.current['Yes'] ?? 'Yes') : (translations.current['No — real mismatch'] ?? 'No — real mismatch')}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </fieldset>
  {/each}
{/if}

<style>
  .location-group {
    margin-bottom: 1.5rem;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th, td {
    padding: 0.4rem 0.6rem;
    text-align: left;
    border-bottom: 1px solid var(--rule);
  }
  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .ok {
    color: var(--ink-soft);
  }
  .warn {
    color: var(--danger, #b00);
    font-weight: 600;
  }
</style>
