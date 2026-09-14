<script lang="ts">
  import { onMount } from 'svelte';
  import { getEntityTree, listLocations, saveLocation, createEntity, asBusinessName, ApiError, getLocationTypes, createLocationType, type EntityNode, type LocationRecord } from '$lib/api';
  import { translations } from '$lib/state.svelte';
  import { session } from '$lib/state.svelte';
  import AddressList from '$lib/components/AddressList.svelte';
  import PhoneList from '$lib/components/PhoneList.svelte';
  import ContactList from '$lib/components/ContactList.svelte';

  // The suffix a real refrigerated section's own location entity is
  // named with — the same mechanism as every other location (its own
  // real entity, its own real capacity), not a special field. A
  // retail shop's cold storage (sparkling wine, some beer) is
  // genuinely smaller, separate real estate from its ordinary shelf
  // space, not a subdivision of the same number.
  const COLD_SUFFIX = ' — Refrigerated';

  let entities: EntityNode[] = $state([]);
  let locations: LocationRecord[] = $state([]);
  let loading = $state(true);
  let error = $state('');
  let message = $state('');

  import Form from '$lib/components/Form.svelte';

  let selectedName = $state('');
  let creatingNew = $state(false);

  // A real, direct, complete list of every genuine, currently-known
  // IANA timezone identifier — Intl's own, built-in, real timezone
  // database, the exact same real data Luxon uses on the backend, not
  // a hand-maintained, potentially-stale subset.
  const ALL_TIMEZONES = Intl.supportedValuesOf('timeZone');

  let newLocationValues: Record<string, string | number | string[]> = $state({
    name: '',
    city: '',
    locationType: 'Retail',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  let city = $state('');
  let locationType: string = $state('Retail');
  let timezone = $state('UTC');
  let bottleCapacity = $state('');
  let cartonCapacity = $state('');
  let saving = $state(false);

  // Real, extensible location types - per direct, confirmed finding,
  // this form previously hardcoded only Retail/Warehouse, completely
  // bypassing the backend's own, already-real, extensible mechanism
  // (getLocationTypes/createLocationType) - the exact same, real
  // pattern already correctly used for address/phone types.
  let locationTypes: string[] = $state([]);
  let newLocationType = $state('');
  let addingLocationType = $state(false);

  let coldLocation: LocationRecord | null = $state(null);
  let coldBottleCapacity = $state('');
  let coldCartonCapacity = $state('');
  let coldSaving = $state(false);
  let addingCold = $state(false);

  async function loadAll() {
    loading = true;
    try {
      [entities, locations, locationTypes] = await Promise.all([getEntityTree(), listLocations(asBusinessName(session.current?.businessName ?? '')), getLocationTypes()]);
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  }

  onMount(loadAll);

  async function addLocationType() {
    if (!newLocationType.trim()) return;
    addingLocationType = true;
    try {
      await createLocationType(newLocationType.trim());
      locationTypes = await getLocationTypes();
      locationType = newLocationType.trim();
      newLocationType = '';
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to add location type.';
    } finally {
      addingLocationType = false;
    }
  }

  async function createNewLocation(v: Record<string, string | number | string[]>) {
    const name = String(v.name ?? '').trim();
    const city = String(v.city ?? '').trim();
    if (!name || !city) throw new Error('Location name and city are both required.');
    try {
      await createEntity({ name, parent: `${session.current?.businessName} Locations` });
      await saveLocation(name, {
        city,
        location_type: String(v.locationType ?? 'Retail'),
        is_billing_address: false,
        bottle_capacity: null,
        carton_capacity: null,
        timezone: String(v.timezone ?? 'UTC'),
      });
    } catch (e) {
      throw e instanceof ApiError ? e : new Error('Could not create location.');
    }
    creatingNew = false;
    newLocationValues = { name: '', city: '', locationType: 'Retail', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    await loadAll();
    const loc = locations.find((l) => l.name === name);
    if (loc) select(loc);
  }

  function select(loc: LocationRecord) {
    selectedName = loc.name;
    city = loc.city;
    locationType = loc.location_type;
    timezone = loc.timezone;
    bottleCapacity = loc.bottle_capacity != null ? String(loc.bottle_capacity) : '';
    cartonCapacity = loc.carton_capacity != null ? String(loc.carton_capacity) : '';
    error = '';
    message = '';
    addingCold = false;

    coldLocation = locations.find((l) => l.name === loc.name + COLD_SUFFIX) ?? null;
    coldBottleCapacity = coldLocation?.bottle_capacity != null ? String(coldLocation.bottle_capacity) : '';
    coldCartonCapacity = coldLocation?.carton_capacity != null ? String(coldLocation.carton_capacity) : '';
  }

  function cancelEdit() {
    selectedName = '';
  }

  let totalBottleCapacity = $derived((bottleCapacity ? Number(bottleCapacity) : 0) + (coldBottleCapacity ? Number(coldBottleCapacity) : 0));
  let totalCartonCapacity = $derived((cartonCapacity ? Number(cartonCapacity) : 0) + (coldCartonCapacity ? Number(coldCartonCapacity) : 0));

  async function save() {
    if (!selectedName) return;
    saving = true;
    error = '';
    message = '';
    try {
      await saveLocation(selectedName, {
        city,
        location_type: locationType,
        is_billing_address: false,
        bottle_capacity: bottleCapacity ? Number(bottleCapacity) : null,
        carton_capacity: cartonCapacity ? Number(cartonCapacity) : null,
        timezone,
      });
      message = 'Saved.';
      await loadAll();
      const loc = locations.find((l) => l.name === selectedName);
      if (loc) select(loc);
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not save.';
    } finally {
      saving = false;
    }
  }

  async function createColdSection() {
    if (!selectedName) return;
    coldSaving = true;
    error = '';
    try {
      const coldName = selectedName + COLD_SUFFIX;
      await createEntity({ name: coldName, parent: `${session.current?.businessName} Locations` });
      await saveLocation(coldName, {
        city,
        location_type: 'Retail',
        is_billing_address: false,
        bottle_capacity: coldBottleCapacity ? Number(coldBottleCapacity) : null,
        carton_capacity: coldCartonCapacity ? Number(coldCartonCapacity) : null,
        timezone,
      });
      addingCold = false;
      await loadAll();
      const loc = locations.find((l) => l.name === selectedName);
      if (loc) select(loc);
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not create refrigerated section.';
    } finally {
      coldSaving = false;
    }
  }

  async function saveCold() {
    if (!coldLocation) return;
    coldSaving = true;
    error = '';
    try {
      await saveLocation(coldLocation.name, {
        city,
        location_type: 'Retail',
        is_billing_address: false,
        bottle_capacity: coldBottleCapacity ? Number(coldBottleCapacity) : null,
        carton_capacity: coldCartonCapacity ? Number(coldCartonCapacity) : null,
        timezone,
      });
      message = 'Saved.';
      await loadAll();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not save refrigerated capacity.';
    } finally {
      coldSaving = false;
    }
  }
</script>

<svelte:head><title>{translations.current['Locations'] ?? 'Locations'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Locations'] ?? 'Locations'}</legend>
  <p class="intro">{translations.current['Retail outlets and warehouses — each has a real street address and phone number (the exact same mechanism already used for customers and vendors), a city (locations in the same city can transfer stock between each other), and the real physical capacity of the space. Retail outlets track both shelving (bottles) and floor area (cartons), and, separately, real cold storage (sparkling wine, some beer) — genuinely smaller, distinct real estate, not a subdivision of the same shelf space, with its own real total. A warehouse deals in full cartons only.'] ?? 'Retail outlets and warehouses — each has a real street address and phone number (the exact same mechanism already used for customers and vendors), a city (locations in the same city can transfer stock between each other), and the real physical capacity of the space. Retail outlets track both shelving (bottles) and floor area (cartons), and, separately, real cold storage (sparkling wine, some beer) — genuinely smaller, distinct real estate, not a subdivision of the same shelf space, with its own real total. A warehouse deals in full cartons only.'}</p>

  {#if loading}
    <p class="center-text">Loading…</p>
  {:else}
    {#if error}<p class="error center-text">{error}</p>{/if}
    {#if message}<p class="success center-text">{message}</p>{/if}

    <div class="list-header">
      <button type="button" class="btn secondary small" onclick={() => (creatingNew = !creatingNew)}>
        {creatingNew ? 'Cancel' : '+ New Location'}
      </button>
    </div>
    {#if creatingNew}
      <Form
        fields={[
          { name: 'name', label: 'Location name, e.g. Downtown Cellar', type: 'text' },
          { name: 'city', label: 'City', type: 'text' },
          { name: 'locationType', label: 'Type', type: 'select', options: ['Retail', 'Warehouse'] },
          { name: 'timezone', label: 'Timezone', type: 'select', options: ALL_TIMEZONES },
        ]}
        bind:values={newLocationValues}
        onSubmit={createNewLocation}
        submitLabel="Create"
      />
    {/if}
    {#if locations.length === 0}
      <p class="empty">None yet — use "+ New Location" above.</p>
    {/if}
    {#each locations.filter((l) => !l.name.endsWith(COLD_SUFFIX)) as loc}
      <button type="button" class="entry" class:active={selectedName === loc.name} onclick={() => select(loc)}>
        <span class="ref">{translations.current[loc.name] ?? loc.name}</span>
        <span class="dim">{loc.city} · {loc.location_type}</span>
      </button>
    {/each}
  {/if}

{#if !loading}
  <div class="layout-detail-only">
    {#if selectedName}
      <fieldset class="form-card">
        <legend>{selectedName}</legend>

        <fieldset class="type-field">
          <legend>{translations.current['Type'] ?? 'Type'}</legend>
          <select bind:value={locationType}>
            {#each locationTypes as t}
              <option value={t}>{translations.current[t] ?? t}</option>
            {/each}
          </select>
          <div class="new-type-row">
            <input
              type="text"
              placeholder={translations.current['New type…'] ?? 'New type…'}
              bind:value={newLocationType}
              onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLocationType(); } }}
            />
            <button type="button" onclick={addLocationType} disabled={addingLocationType || !newLocationType.trim()}>
              {translations.current['+ Add type'] ?? '+ Add type'}
            </button>
          </div>
        </fieldset>

        {#key selectedName}
          <AddressList entityName={selectedName} />
          <PhoneList entityName={selectedName} />
          <ContactList entityName={selectedName} />
        {/key}

        <fieldset>
          <legend>{translations.current['City'] ?? 'City'}</legend>
          <input bind:value={city} />
        </fieldset>
        <p class="field-help">
          The city used to decide whether stock can transfer directly between locations — separate from any
          address above, since a mailing address and the city stock actually moves between aren't always the
          same fact.
        </p>

        <fieldset>
          <legend>{translations.current['Timezone'] ?? 'Timezone'}</legend>
          <select bind:value={timezone}>
            {#each ALL_TIMEZONES as tz}<option value={tz}>{tz}</option>{/each}
          </select>
        </fieldset>
        <p class="field-help">
          This real, physical location's own real timezone — used to decide what calendar day a sale or stock
          movement here actually happened on, using this location's own local time, not the server's. Two
          real stores can genuinely be an hour aitem in summer even if they're otherwise close together, if
          one observes daylight saving and the other doesn't.
        </p>

        <fieldset class="sub-block">
          <legend>{translations.current['Capacity'] ?? 'Capacity'}</legend>
          {#if locationType === 'Retail'}
            <table class="capacity-table">
              <thead>
                <tr>
                  <th></th>
                  <th class="num">{translations.current['Bottles'] ?? 'Bottles'}</th>
                  <th class="num">{translations.current['Cartons'] ?? 'Cartons'}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{translations.current['Shelf'] ?? 'Shelf'}</td>
                  <td class="num"><input bind:value={bottleCapacity} inputmode="numeric" placeholder="e.g. 2000" /></td>
                  <td class="num"><input bind:value={cartonCapacity} inputmode="numeric" placeholder="e.g. 100" /></td>
                </tr>
                <tr>
                  <td>{translations.current['Refrigerated'] ?? 'Refrigerated'}</td>
                  {#if coldLocation || addingCold}
                    <td class="num"><input bind:value={coldBottleCapacity} inputmode="numeric" placeholder="e.g. 200" /></td>
                    <td class="num"><input bind:value={coldCartonCapacity} inputmode="numeric" placeholder="e.g. 20" /></td>
                  {:else}
                    <td class="num dim" colspan="2">
                      <button type="button" class="btn secondary small" onclick={() => (addingCold = true)}>+ Add refrigerated section</button>
                    </td>
                  {/if}
                </tr>
                <tr class="total-row">
                  <td>{translations.current['Total'] ?? 'Total'}</td>
                  <td class="num">{totalBottleCapacity || ''}</td>
                  <td class="num">{totalCartonCapacity || ''}</td>
                </tr>
              </tbody>
            </table>
            {#if addingCold && !coldLocation}
              <button class="btn small" onclick={createColdSection} disabled={coldSaving}>
                {coldSaving ? 'Creating…' : 'Create Refrigerated Section'}
              </button>
            {:else if coldLocation}
              <button class="btn secondary small" onclick={saveCold} disabled={coldSaving}>
                {coldSaving ? 'Saving…' : 'Save Refrigerated Capacity'}
              </button>
            {/if}
          {:else}
            <fieldset>
              <legend>{translations.current['Carton capacity'] ?? 'Carton capacity'}</legend>
              <input bind:value={cartonCapacity} inputmode="numeric" placeholder="e.g. 6000" />
            </fieldset>
          {/if}
        </fieldset>

        <div class="form-actions">
          <button class="btn secondary" onclick={cancelEdit}>{translations.current['Cancel'] ?? 'Cancel'}</button>
          <button class="btn" onclick={save} disabled={saving}>{saving ? 'Saving…' : (translations.current['Save'] ?? 'Save')}</button>
        </div>
      </fieldset>
    {/if}
  </div>
{/if}
</fieldset>

<style>
  .intro {
    max-width: 70ch;
  }
  .center-text {
    text-align: center;
  }

  .layout-detail-only {
    display: flex;
    justify-content: center;
  }
  .list-header {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 0.5rem;
  }
  .btn.secondary {
    background: transparent;
    border: 1px solid var(--rule-strong);
  }
  .empty {
    color: var(--ink-soft);
    font-size: var(--font-size-base);
  }
  .entry {
    display: flex;
    flex-direction: column;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 0.4rem 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    margin-bottom: 0.15rem;
  }
  .entry:hover {
    background: var(--paper-dim, #f2ede1);
  }
  .entry.active {
    background: var(--paper-dim, #f2ede1);
    border-left: 3px solid var(--brass);
  }
  .ref {
    font-weight: 600;
    font-size: var(--font-size-base);
  }
  .dim {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
  }
  .form-card {
    flex: 1;
    max-width: 520px;
    background: var(--paper);
    padding: 1rem 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .form-card > legend {
    font-size: var(--font-size-large);
    font-weight: 600;
    color: var(--ink);
    padding: 0 0.5rem;
  }
  .type-field {
    align-self: flex-start;
    min-width: 160px;
  }
  .btn.small {
    padding: 0.25rem 0.6rem;
    font-size: var(--font-size-small);
  }
  .field-help {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    margin: -0.4rem 0 0;
  }
  .capacity-table {
    width: 100%;
    font-size: var(--font-size-base);
  }
  .capacity-table th,
  .capacity-table td {
    padding: 0.3rem 0.4rem;
  }
  .capacity-table input {
    width: 90px;
    text-align: right;
  }
  .total-row td {
    border-top: 1px solid var(--rule);
    font-weight: 600;
    padding-top: 0.5rem;
  }
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
  }
  .success {
    color: var(--credit);
  }
</style>
