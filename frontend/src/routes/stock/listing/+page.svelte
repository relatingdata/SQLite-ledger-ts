<script lang="ts">
  import { onMount } from 'svelte';
  import { getInventoryListingByLocation, setItemLocationLevels, asItemName, asLocationName, ApiError, type InventoryListingLocationGroup, type InventoryListingRow } from '$lib/api';
  import { translations } from '$lib/state.svelte';

  let groups: InventoryListingLocationGroup[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  async function load() {
    loading = true;
    try {
      groups = await getInventoryListingByLocation();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  }

  onMount(load);

  // Real division groups, each holding its own real location groups —
  // built directly from the same real division tag
  // getInventoryListingByLocation already computed, not re-derived here.
  // Locations with no real division fall under a real, explicit
  // "(No division)" group rather than being silently dropped.
  const NO_DIVISION = '__none__';
  let divisionGroups = $derived.by(() => {
    const byDivision = new Map<string, InventoryListingLocationGroup[]>();
    for (const g of groups) {
      const key = g.division ?? NO_DIVISION;
      if (!byDivision.has(key)) byDivision.set(key, []);
      byDivision.get(key)!.push(g);
    }
    return [...byDivision.entries()]
      .map(([name, locs]) => ({ name, locations: locs, total: locs.reduce((s, l) => s + l.total_on_hand, 0) }))
      .sort((a, b) => (a.name === NO_DIVISION ? 1 : b.name === NO_DIVISION ? -1 : a.name.localeCompare(b.name)));
  });

  // Every division and every location starts collapsed — read as
  // totals first, real detail on demand, the same pattern already
  // proven on the P&L report.
  let expandedDivisions = $state(new Set<string>());
  let expandedLocations = $state(new Set<string>());
  function toggleDivision(name: string) {
    expandedDivisions = new Set(expandedDivisions);
    if (expandedDivisions.has(name)) expandedDivisions.delete(name);
    else expandedDivisions.add(name);
  }
  function toggleLocation(name: string) {
    expandedLocations = new Set(expandedLocations);
    if (expandedLocations.has(name)) expandedLocations.delete(name);
    else expandedLocations.add(name);
  }

  let saving: Record<string, boolean> = $state({});
  let saveError: Record<string, string> = $state({});

  function key(row: InventoryListingRow) {
    return `${row.item}::${row.location}`;
  }

  async function saveLevels(row: InventoryListingRow) {
    const k = key(row);
    saving = { ...saving, [k]: true };
    saveError = { ...saveError, [k]: '' };
    try {
      await setItemLocationLevels(asItemName(row.item), asLocationName(row.location), {
        minLevel: row.min_level,
        maxLevel: row.max_level,
        reorderLevel: row.reorder_level,
      });
    } catch (e) {
      saveError = { ...saveError, [k]: e instanceof ApiError ? e.message : 'Failed to save.' };
    } finally {
      saving = { ...saving, [k]: false };
    }
  }
</script>

<svelte:head><title>{translations.current['Inventory Listing'] ?? 'Inventory Listing'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Inventory Listing'] ?? 'Inventory Listing'}</legend>
  <p class="intro">{translations.current['Every item at every location that carries real stock — what you have, and where. Min, max, and reorder levels are editable directly here — change a value and it saves as soon as you leave the field.'] ?? 'Every item at every location that carries real stock — what you have, and where. Min, max, and reorder levels are editable directly here — change a value and it saves as soon as you leave the field.'}</p>
{#if loading}
  <p class="center-text">Loading…</p>
{:else if error}
  <p class="error center-text">{error}</p>
{:else if groups.length === 0}
  <p class="center-text empty">{translations.current['No stock recorded anywhere yet.'] ?? 'No stock recorded anywhere yet.'}</p>
{:else}
  <div class="report-wrap">
    <div class="grid-box">
      {#each divisionGroups as dg}
        <div class="division-block">
          <button type="button" class="division-head" onclick={() => toggleDivision(dg.name)}>
            <span class="disclosure">{expandedDivisions.has(dg.name) ? '▾' : '▸'}</span>
            <span class="division-name">{dg.name === NO_DIVISION ? (translations.current['No division'] ?? '(No division)') : dg.name}</span>
            <span class="division-total num mono">{dg.total.toLocaleString()}</span>
          </button>

          {#if expandedDivisions.has(dg.name)}
            {#each dg.locations as loc}
              <div class="location-block">
                <button type="button" class="location-head" onclick={() => toggleLocation(loc.location)}>
                  <span class="disclosure">{expandedLocations.has(loc.location) ? '▾' : '▸'}</span>
                  <span class="location-name">{loc.location}</span>
                  {#if loc.city}<span class="location-city">{loc.city}</span>{/if}
                  {#if loc.capacity.bottleOverCapacity || loc.capacity.cartonOverCapacity}
                    <span class="capacity-warning" title="Over its own, real configured capacity">
                      {translations.current['Over capacity'] ?? 'Over capacity'}
                    </span>
                  {/if}
                  <span class="location-total num mono">{loc.total_on_hand.toLocaleString()}</span>
                </button>

                {#if expandedLocations.has(loc.location)}
                  <table>
                    <thead>
                      <tr>
                        <th>{translations.current['Item'] ?? 'Item'}</th>
                        <th class="num">{translations.current['On hand'] ?? 'On hand'}</th>
                        <th class="num">{translations.current['Min'] ?? 'Min'}</th>
                        <th class="num">{translations.current['Max'] ?? 'Max'}</th>
                        <th class="num">{translations.current['Reorder Level'] ?? 'Reorder Level'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each loc.rows as row}
                        <tr class:below={row.reorder_level != null && row.quantity_on_hand <= row.reorder_level}>
                          <td>{row.item}</td>
                          <td class="num mono">{row.quantity_on_hand}</td>
                          <td class="num">
                            <input class="level-input" type="number" min="0" bind:value={row.min_level} onchange={() => saveLevels(row)} disabled={saving[key(row)]} />
                          </td>
                          <td class="num">
                            <input class="level-input" type="number" min="0" bind:value={row.max_level} onchange={() => saveLevels(row)} disabled={saving[key(row)]} />
                          </td>
                          <td class="num">
                            <input class="level-input" type="number" min="0" bind:value={row.reorder_level} onchange={() => saveLevels(row)} disabled={saving[key(row)]} />
                            {#if saveError[key(row)]}<span class="row-error">{saveError[key(row)]}</span>{/if}
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}

</fieldset>
<style>
  .center-text {
    text-align: center;
  }
  .empty {
    color: var(--ink-soft);
  }

  .report-wrap {
    display: flex;
    justify-content: center;
  }

  .grid-box {
    border: 1px solid var(--rule-strong);
    border-radius: 8px;
    overflow: hidden;
    width: 100%;
    max-width: 760px;
    background: var(--paper);
  }

  .division-block + .division-block {
    border-top: 2px solid var(--ink);
  }

  .division-head,
  .location-head {
    display: flex;
    align-items: center;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    font: inherit;
  }

  .division-head {
    padding: 0.6rem 0.9rem;
    font-weight: 700;
    background: var(--paper-dim, #f2ede1);
  }

  .division-head:hover,
  .location-head:hover {
    background: var(--paper-dim, #f2ede1);
  }

  .location-block {
    border-top: 1px solid var(--rule);
  }

  .location-head {
    padding: 0.45rem 0.9rem 0.45rem 2rem;
    font-weight: 600;
  }

  .disclosure {
    display: inline-block;
    width: 1.1rem;
    color: var(--ink-soft);
  }

  .division-name,
  .location-name {
    flex: 1;
  }

  .location-city {
    color: var(--ink-soft);
    font-size: var(--font-size-small);
    margin-right: 1rem;
  }

  .division-total,
  .location-total {
    min-width: 4rem;
    text-align: right;
  }

  .capacity-warning {
    font-size: var(--font-size-small);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    background: #fdecea;
    color: #a33a2e;
    margin-left: 0.5rem;
  }

  th,
  td {
    padding: 0.4rem 0.7rem;
    text-align: left;
    border-bottom: 1px solid var(--rule);
  }
  th:first-child,
  td:first-child {
    padding-left: 3rem;
  }
  tr.below td {
    color: var(--debit);
  }
  .level-input {
    width: 4.5rem;
    text-align: right;
  }
  .row-error {
    display: block;
    color: var(--debit);
    font-size: var(--font-size-small);
  }
</style>
