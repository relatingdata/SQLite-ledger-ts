<script lang="ts">
  // Locations setup and storage actions — see
  // docs/pm-frontend-reference.md for the full design.
  import { onMount } from 'svelte';
  import { getEntityTree, listLocations, saveLocation, createLocation, deleteLocation, createEntity, asBusinessName, asLedgerName, asAccountName, ApiError, getLocationTypes, createLocationType, getLocationCurrencies, nominateLocationCurrency, getHierarchy, convertStorageSpace, resolveOpenContainerAccounts, stageLine, postJournalEntry, type EntityNode, type LocationRecord, type HierarchyGroupingWithValues } from '$lib/api';
  import { translations } from '$lib/state.svelte';
  import { session } from '$lib/state.svelte';
  import { openContainerLines, freshReference } from '$lib/canned-journal';
  import AddressList from '$lib/components/AddressList.svelte';
  import PhoneList from '$lib/components/PhoneList.svelte';
  import ContactList from '$lib/components/ContactList.svelte';

  // Refrigerated-section suffix — see docs/pm-frontend-reference.md.
  const COLD_SUFFIX = ' — Refrigerated';

  let entities: EntityNode[] = $state([]);

  // Walks the live tree by id, not a constructed name string — see docs/pm-frontend-reference.md.
  function thisBusinessLocationsId(): number | undefined {
    const biz = entities.find((e) => e.name === session.current?.businessName);
    if (!biz) return undefined;
    return entities.find((e) => e.name === 'Locations' && e.parent_id === biz.id)?.id;
  }
  let locations: LocationRecord[] = $state([]);
  let loading = $state(true);
  let error = $state('');
  let message = $state('');

  import Form from '$lib/components/Form.svelte';

  let selectedName = $state('');
  let creatingNew = $state(false);

  // Intl's own IANA timezone database — see docs/pm-frontend-reference.md.
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

  // Extensible location types — see docs/pm-frontend-reference.md.
  let locationTypes: string[] = $state([]);
  let newLocationType = $state('');
  let addingLocationType = $state(false);

  // Storage combinations reuse the Hierarchy/Product mechanism — see docs/pm-frontend-reference.md.
  let hierarchyGroupings: HierarchyGroupingWithValues[] = $state([]);
  let openContainerItem = $state('');
  let openContainerGrouping = $state('');
  let openContainerFrom = $state('');
  let openContainerTo = $state('');
  let openContainerCartonsOpened = $state('1');
  let openContainerUnitsProduced = $state('');
  let openingContainer = $state(false);
  let convertGrouping = $state('');
  let convertFrom = $state('');
  let convertTo = $state('');
  let convertQuantity = $state('');
  let converting = $state(false);
  let storageActionMessage = $state('');
  let storageActionError = $state('');

  async function doOpenContainer() {
    if (!session.current?.businessName || !selectedName || !openContainerItem || !openContainerGrouping || !openContainerFrom || !openContainerTo) return;
    openingContainer = true;
    storageActionError = '';
    storageActionMessage = '';
    try {
      // Canned account selection via openContainerLines — see docs/pm-frontend-reference.md.
      const business = asBusinessName(session.current.businessName);
      const ledger = asLedgerName(session.current.ledgerName);
      const definitionDimensions: [string, string][] = [[openContainerGrouping, openContainerGrouping]];
      const cartonsOpened = Number(openContainerCartonsOpened) || 1;
      const unitsProduced = Number(openContainerUnitsProduced) || 0;
      const resolved = await resolveOpenContainerAccounts({
        business: session.current.businessName,
        location: selectedName,
        item: openContainerItem,
        definitionDimensions,
        containerValues: [openContainerFrom],
        unitValues: [openContainerTo],
      });
      const built = openContainerLines({
        cartonsOpened,
        unitsProduced,
        containerSpaceAccount: resolved.containerSpaceAccount,
        containerOccupiedAccount: resolved.containerOccupiedAccount,
        unitSpaceAccount: resolved.unitSpaceAccount,
        unitOccupiedAccount: resolved.unitOccupiedAccount,
        containerSpaceAccountId: resolved.containerSpaceAccountId,
        containerOccupiedAccountId: resolved.containerOccupiedAccountId,
        unitSpaceAccountId: resolved.unitSpaceAccountId,
        unitOccupiedAccountId: resolved.unitOccupiedAccountId,
        inventoryFromAccount: resolved.inventoryFromAccount,
        inventoryToAccount: resolved.inventoryToAccount,
        inventoryFromAccountId: resolved.inventoryFromAccountId,
        inventoryToAccountId: resolved.inventoryToAccountId,
        unitCostMinor: resolved.unitCostMinor,
      });
      const reference = freshReference('STORAGE-OPEN');
      for (const line of built.spaceLines) {
        await stageLine({ reference, business, ledger, account: asAccountName(line.account), accountId: line.accountId, amount_minor: line.amount_minor }, 'Open Container');
      }
      await postJournalEntry(reference, business, ledger, 'Open Container');
      if (built.valueLines.length > 0) {
        const valueReference = `${reference}-ITEM-VALUE`;
        for (const line of built.valueLines) {
          await stageLine({ reference: valueReference, business, ledger, account: asAccountName(line.account), accountId: line.accountId, amount_minor: line.amount_minor }, 'Open Container');
        }
        await postJournalEntry(valueReference, business, ledger, 'Open Container');
      }
      storageActionMessage = translations.current['Container opened.'] ?? 'Container opened.';
      openContainerUnitsProduced = '';
    } catch (e) {
      storageActionError = e instanceof ApiError ? e.message : 'Could not open container.';
    } finally {
      openingContainer = false;
    }
  }

  async function doConvertStorage() {
    if (!session.current?.businessName || !convertGrouping || !convertFrom || !convertTo || !selectedName) return;
    converting = true;
    storageActionError = '';
    storageActionMessage = '';
    try {
      await convertStorageSpace({
        business: session.current.businessName,
        ledger: session.current.ledgerName,
        itemName: selectedName,
        definitionDimensions: [[convertGrouping, convertGrouping]],
        fromValues: [convertFrom],
        toValues: [convertTo],
        quantity: Number(convertQuantity) || 0,
      });
      storageActionMessage = translations.current['Storage converted.'] ?? 'Storage converted.';
      convertQuantity = '';
    } catch (e) {
      storageActionError = e instanceof ApiError ? e.message : 'Could not convert storage - this direction may never have been defined.';
    } finally {
      converting = false;
    }
  }

  let coldLocation: LocationRecord | null = $state(null);
  let coldBottleCapacity = $state('');
  let coldCartonCapacity = $state('');
  let coldSaving = $state(false);
  let addingCold = $state(false);

  // Nominated further trading currencies — see docs/pm-frontend-reference.md.
  let locationCurrencies: string[] = $state([]);
  let newCurrencyCode = $state('');
  let addingCurrency = $state(false);

  async function loadAll() {
    loading = true;
    try {
      [entities, locations, locationTypes, hierarchyGroupings] = await Promise.all([
        getEntityTree(), listLocations(asBusinessName(session.current?.businessName ?? '')), getLocationTypes(),
        session.current?.businessName ? getHierarchy(session.current.businessName) : Promise.resolve([]),
      ]);
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
      newLocationValues.locationType = newLocationType.trim();
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
    if (!session.current) throw new Error('No real, current business selected.');
    try {
      // Awaits the full backend transaction before resolving — see docs/pm-frontend-reference.md.
      await createLocation(name, session.current.businessName, {
        city,
        location_type: String(v.locationType ?? 'Retail'),
        is_billing_address: false,
        bottle_capacity: null,
        carton_capacity: null,
        timezone: String(v.timezone ?? 'UTC'),
      }, 'Create Location');
    } catch (e) {
      throw e instanceof ApiError ? e : new Error('Could not create location.');
    }
    closeInsert();
    await loadAll();
    const loc = locations.find((l) => l.name === name);
    if (loc) select(loc);
  }

  // Insert/Enter/Escape/Delete idiom — see docs/pm-frontend-reference.md.
  // selectedName already IS this list's selection model (set by select()
  // below, which the detail panel has always used), so there's no second,
  // parallel id to keep in sync — Delete just acts on whichever location
  // the existing detail panel already has open.
  function closeInsert() {
    creatingNew = false;
    newLocationValues = { name: '', city: '', locationType: 'Retail', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  }

  // Scoped to the location-list toolbar div, target-tag-filtered the same
  // way every other converted screen's handler is, so typing in the
  // "+ Add type" mini-form's own input never fires these.
  function handleListKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return;
    if (e.key === 'Insert') {
      e.preventDefault();
      creatingNew = true;
    } else if (e.key === 'Delete' && selectedName) {
      e.preventDefault();
      deleteSelectedLocation();
    }
  }

  async function deleteSelectedLocation() {
    if (!selectedName || !session.current?.businessName) return;
    if (!confirm(`Delete "${translations.current[selectedName] ?? selectedName}"? This cannot be undone.`)) return;
    error = '';
    try {
      await deleteLocation(selectedName, session.current.businessName);
      selectedName = '';
      await loadAll();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not delete location.';
    }
  }

  async function select(loc: LocationRecord) {
    selectedName = loc.name;
    city = loc.city;
    locationType = loc.location_type;
    timezone = loc.timezone;
    bottleCapacity = loc.bottle_capacity != null ? String(loc.bottle_capacity) : '';
    cartonCapacity = loc.carton_capacity != null ? String(loc.carton_capacity) : '';
    error = '';
    message = '';
    addingCold = false;
    addingCurrency = false;

    coldLocation = locations.find((l) => l.name === loc.name + COLD_SUFFIX) ?? null;
    coldBottleCapacity = coldLocation?.bottle_capacity != null ? String(coldLocation.bottle_capacity) : '';
    coldCartonCapacity = coldLocation?.carton_capacity != null ? String(coldLocation.carton_capacity) : '';

    locationCurrencies = await getLocationCurrencies(loc.name).catch(() => []);
  }

  function cancelEdit() {
    selectedName = '';
  }

  let totalBottleCapacity = $derived((bottleCapacity ? Number(bottleCapacity) : 0) + (coldBottleCapacity ? Number(coldBottleCapacity) : 0));
  let totalCartonCapacity = $derived((cartonCapacity ? Number(cartonCapacity) : 0) + (coldCartonCapacity ? Number(coldCartonCapacity) : 0));

  async function save() {
    if (!selectedName || !session.current?.businessName) return;
    saving = true;
    error = '';
    message = '';
    try {
      await saveLocation(
        selectedName,
        {
          city,
          location_type: locationType,
          is_billing_address: false,
          bottle_capacity: bottleCapacity ? Number(bottleCapacity) : null,
          carton_capacity: cartonCapacity ? Number(cartonCapacity) : null,
          timezone,
        },
        session.current.businessName
      );
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
    if (!selectedName || !session.current?.businessName) return;
    coldSaving = true;
    error = '';
    try {
      const coldName = selectedName + COLD_SUFFIX;
      await createEntity({ name: coldName, parentId: thisBusinessLocationsId() });
      await saveLocation(
        coldName,
        {
          city,
          location_type: 'Retail',
          is_billing_address: false,
          bottle_capacity: coldBottleCapacity ? Number(coldBottleCapacity) : null,
          carton_capacity: coldCartonCapacity ? Number(coldCartonCapacity) : null,
          timezone,
        },
        session.current.businessName
      );
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
    if (!coldLocation || !session.current?.businessName) return;
    coldSaving = true;
    error = '';
    try {
      await saveLocation(
        coldLocation.name,
        {
          city,
          location_type: 'Retail',
          is_billing_address: false,
          bottle_capacity: coldBottleCapacity ? Number(coldBottleCapacity) : null,
          carton_capacity: coldCartonCapacity ? Number(coldCartonCapacity) : null,
          timezone,
        },
        session.current.businessName
      );
      message = 'Saved.';
      await loadAll();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not save refrigerated capacity.';
    } finally {
      coldSaving = false;
    }
  }

  async function addCurrencyToLocation() {
    const code = newCurrencyCode.trim().toUpperCase();
    if (!code || locationCurrencies.includes(code)) return;
    error = '';
    try {
      await nominateLocationCurrency(selectedName, code);
      locationCurrencies = [...locationCurrencies, code];
      newCurrencyCode = '';
      addingCurrency = false;
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not nominate that currency.';
    }
  }
</script>

<svelte:head><title>{translations.current['Locations'] ?? 'Locations'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Locations'] ?? 'Locations'}</legend>
  <p class="intro">{translations.current['Retail outlets and warehouses — each has a real street address and phone number (the exact same mechanism already used for customers and providers), a city (locations in the same city can transfer stock between each other), and the real physical capacity of the space. Retail outlets track both shelving (bottles) and floor area (cartons), and, separately, real cold storage (sparkling wine, some beer) — genuinely smaller, distinct real estate, not a subdivision of the same shelf space, with its own real total. A warehouse deals in full cartons only.'] ?? 'Retail outlets and warehouses — each has a real street address and phone number (the exact same mechanism already used for customers and providers), a city (locations in the same city can transfer stock between each other), and the real physical capacity of the space. Retail outlets track both shelving (bottles) and floor area (cartons), and, separately, real cold storage (sparkling wine, some beer) — genuinely smaller, distinct real estate, not a subdivision of the same shelf space, with its own real total. A warehouse deals in full cartons only.'}</p>

  {#if loading}
    <p class="center-text">Loading…</p>
  {:else}
    {#if error}<p class="error center-text">{error}</p>{/if}
    {#if message}<p class="success center-text">{message}</p>{/if}

    <div class="list-toolbar" role="toolbar" tabindex="0" aria-describedby="locations-hint" aria-keyshortcuts="Insert Delete" onkeydown={handleListKeydown}>
      {#if creatingNew}
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
        <Form
          fields={[
            { name: 'name', label: 'Location name, e.g. Downtown Cellar', type: 'text' },
            { name: 'city', label: 'City', type: 'text' },
            { name: 'locationType', label: 'Type', type: 'select', options: locationTypes },
            { name: 'timezone', label: 'Timezone', type: 'select', options: ALL_TIMEZONES },
          ]}
          bind:values={newLocationValues}
          onSubmit={createNewLocation}
          showSubmitButton={false}
          onCancel={closeInsert}
        />
      {/if}
      {#if locations.length === 0 && !creatingNew}
        <p class="empty">{translations.current['None yet — press Insert to add one.'] ?? 'None yet — press Insert to add one.'}</p>
      {/if}
      {#each locations.filter((l) => !l.name.endsWith(COLD_SUFFIX)) as loc}
        <div
          class="entry"
          class:active={selectedName === loc.name}
          role="button"
          tabindex="0"
          onclick={() => select(loc)}
          onkeydown={(e) => { if (e.key === 'Enter') select(loc); }}
        >
          <span class="ref">{translations.current[loc.name] ?? loc.name}</span>
          <span class="dim">{loc.city} · {loc.location_type}</span>
        </div>
      {/each}
    </div>
    <p class="keyboard-hint" id="locations-hint">{translations.current['Insert adds a new location. Delete removes the selected one.'] ?? 'Insert adds a new location. Delete removes the selected one.'}</p>
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

            <fieldset class="currencies-fieldset">
              <legend>{translations.current['Currencies this location trades in'] ?? 'Currencies this location trades in'}</legend>
              <p class="field-note">
                {translations.current["Nearly every real location trades only in its business's own home currency — this is only for a location genuinely near a national border, or one that otherwise takes real cash in another currency."] ??
                  "Nearly every real location trades only in its business's own home currency — this is only for a location genuinely near a national border, or one that otherwise takes real cash in another currency."}
              </p>
              {#if locationCurrencies.length > 0}
                <ul class="currency-list">
                  {#each locationCurrencies as code}<li>{code}</li>{/each}
                </ul>
              {/if}
              {#if !addingCurrency}
                <button type="button" class="add-link" onclick={() => (addingCurrency = true)}>+ {translations.current['Nominate a further currency'] ?? 'Nominate a further currency'}</button>
              {:else}
                <div class="currency-add-row">
                  <input bind:value={newCurrencyCode} placeholder="e.g. USD" maxlength="6" onkeydown={(e) => e.key === 'Enter' && addCurrencyToLocation()} />
                  <button type="button" class="btn small" onclick={addCurrencyToLocation}>{translations.current['Add'] ?? 'Add'}</button>
                </div>
              {/if}
            </fieldset>
          {:else}
            <fieldset>
              <legend>{translations.current['Carton capacity'] ?? 'Carton capacity'}</legend>
              <input bind:value={cartonCapacity} inputmode="numeric" placeholder="e.g. 6000" />
            </fieldset>
          {/if}
        </fieldset>

        {#if hierarchyGroupings.length > 0}
          <fieldset class="sub-block">
            <legend>{translations.current['Storage Actions'] ?? 'Storage Actions'}</legend>
            <p class="field-help">
              {translations.current['Uses the real Hierarchy groupings and values already set up under Setup → Hierarchies. Add or edit those there first.'] ??
                'Uses the real Hierarchy groupings and values already set up under Setup → Hierarchies. Add or edit those there first.'}
            </p>

            {#if storageActionError}<p class="error">{storageActionError}</p>{/if}
            {#if storageActionMessage}<p class="success">{storageActionMessage}</p>{/if}

            <div class="storage-action-cards">
              <div class="card">
                <h4>{translations.current['Open a Container'] ?? 'Open a Container'}</h4>
                <p class="hint">{translations.current['Two, independent space movements — never a conversion, and never linked by a rate.'] ?? 'Two, independent space movements — never a conversion, and never linked by a rate.'}</p>
                <div class="add-row">
                  <input bind:value={openContainerItem} placeholder={translations.current['Item name…'] ?? 'Item name…'} />
                </div>
                <div class="add-row">
                  <select bind:value={openContainerGrouping}>
                    <option value="">{translations.current['Grouping…'] ?? 'Grouping…'}</option>
                    {#each hierarchyGroupings as g}<option value={g.grouping}>{g.grouping}</option>{/each}
                  </select>
                </div>
                {#if openContainerGrouping}
                  {@const values = hierarchyGroupings.find((g) => g.grouping === openContainerGrouping)?.values ?? []}
                  <div class="add-row">
                    <select bind:value={openContainerFrom}>
                      <option value="">{translations.current['Container value…'] ?? 'Container value…'}</option>
                      {#each values as v}<option value={v}>{v}</option>{/each}
                    </select>
                    <input bind:value={openContainerCartonsOpened} inputmode="numeric" placeholder="1" style="max-width:5rem" />
                  </div>
                  <div class="add-row">
                    <select bind:value={openContainerTo}>
                      <option value="">{translations.current['Unit value…'] ?? 'Unit value…'}</option>
                      {#each values as v}<option value={v}>{v}</option>{/each}
                    </select>
                    <input bind:value={openContainerUnitsProduced} inputmode="numeric" placeholder="e.g. 24" style="max-width:6rem" />
                  </div>
                {/if}
                <button class="btn small" onclick={doOpenContainer} disabled={openingContainer || !openContainerItem || !openContainerGrouping || !openContainerFrom || !openContainerTo}>
                  {openingContainer ? '…' : (translations.current['Open Container'] ?? 'Open Container')}
                </button>
              </div>

              <div class="card">
                <h4>{translations.current['Convert Storage'] ?? 'Convert Storage'}</h4>
                <p class="hint">{translations.current['A real, defined, one-directional exchange rate — e.g. Hot to Cold. The reverse direction simply refuses if never set up.'] ?? 'A real, defined, one-directional exchange rate — e.g. Hot to Cold. The reverse direction simply refuses if never set up.'}</p>
                <div class="add-row">
                  <select bind:value={convertGrouping}>
                    <option value="">{translations.current['Grouping…'] ?? 'Grouping…'}</option>
                    {#each hierarchyGroupings as g}<option value={g.grouping}>{g.grouping}</option>{/each}
                  </select>
                </div>
                {#if convertGrouping}
                  {@const values = hierarchyGroupings.find((g) => g.grouping === convertGrouping)?.values ?? []}
                  <div class="add-row">
                    <select bind:value={convertFrom}>
                      <option value="">{translations.current['From…'] ?? 'From…'}</option>
                      {#each values as v}<option value={v}>{v}</option>{/each}
                    </select>
                    <select bind:value={convertTo}>
                      <option value="">{translations.current['To…'] ?? 'To…'}</option>
                      {#each values as v}<option value={v}>{v}</option>{/each}
                    </select>
                  </div>
                  <div class="add-row">
                    <input bind:value={convertQuantity} inputmode="numeric" placeholder={translations.current['Quantity'] ?? 'Quantity'} />
                  </div>
                {/if}
                <button class="btn small" onclick={doConvertStorage} disabled={converting || !convertGrouping || !convertFrom || !convertTo || !convertQuantity}>
                  {converting ? '…' : (translations.current['Convert'] ?? 'Convert')}
                </button>
              </div>
            </div>
          </fieldset>
        {/if}

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
  .storage-action-cards {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 0.6rem;
  }
  .storage-action-cards .card {
    width: 300px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .storage-action-cards h4 {
    margin: 0;
  }
  .storage-action-cards .add-row {
    display: flex;
    gap: 0.4rem;
  }
  .storage-action-cards select {
    flex: 1;
    min-width: 0;
  }
  .intro {
    max-width: 70ch;
  }
  .center-text {
    text-align: center;
  }

  .currencies-fieldset {
    margin-top: 1rem;
  }
  .field-note {
    font-size: var(--font-size-small, 0.85rem);
    color: var(--ink-soft);
    max-width: 60ch;
  }
  .currency-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    list-style: none;
    padding: 0;
    margin: 0.4rem 0;
  }
  .currency-list li {
    padding: 0.2rem 0.6rem;
    border-radius: 3px;
    background: var(--paper-dim, #f2ede1);
    border: 1px solid var(--brass);
  }
  .currency-add-row {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.4rem;
  }
  .currency-add-row input {
    max-width: 8rem;
  }
  .add-link {
    background: none;
    border: none;
    color: var(--brass-dark);
    text-decoration: underline;
    cursor: pointer;
    padding: 0;
    font-size: var(--font-size-base);
  }

  .layout-detail-only {
    display: flex;
    justify-content: center;
  }
  .list-toolbar:focus {
    outline: none;
  }
  .list-toolbar:focus-visible {
    border-color: var(--brass);
  }
  .keyboard-hint {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    margin: 0.3rem 0 0;
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
