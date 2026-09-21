<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import AddressList from '$lib/components/AddressList.svelte';
  import PhoneList from '$lib/components/PhoneList.svelte';
  import ContactList from '$lib/components/ContactList.svelte';
  import WeeklyHoursGrid from '$lib/components/WeeklyHoursGrid.svelte';
  import {
    getOrganizationChart,
    createDivision,
    createEntity,
    setEntityRelationship,
    createEmployeeContact,
    getLocationByName,
    saveLocation,
    getLocationOpenHours,
    setLocationOpenHours,
    getContact,
    setContact,
    getEmployeeSchedule,
    setEmployeeSchedule,
    getEntityTree,
    deleteEntity,
    ApiError,
    type OrganizationChart,
    type LocationRecord,
    type Contact,
    asLocationName,
    asEmployeeName,
  } from '$lib/api';

  let chart: OrganizationChart | null = $state(null);
  let loading = $state(true);
  let error = $state('');

  type Selection = { type: 'division' | 'location' | 'employee'; name: string; division?: string; location?: string } | null;
  let selection: Selection = $state(null);
  // A real, unique id for this page's own keyboard-hint text, so the
  // tree panel below can genuinely announce its real keyboard
  // shortcuts to a screen reader.
  const treeHintId = `business-setup-tree-hint-${crypto.randomUUID()}`;

  function selectDivision(name: string) {
    selection = { type: 'division', name };
  }

  async function loadChart() {
    if (!session.current) return;
    loading = true;
    try {
      chart = await getOrganizationChart(session.current.businessName);
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  }
  onMount(loadChart);

  // --- Division creation -----------------------------------------
  let newDivisionName = $state('');
  let creatingDivision = $state(false);
  let showAddDivision = $state(false);
  let divisionError = $state('');
  async function addDivision() {
    if (!session.current || !newDivisionName.trim()) return;
    creatingDivision = true;
    divisionError = '';
    try {
      await createDivision(newDivisionName.trim(), null, 'Profit Center');
      await setEntityRelationship(newDivisionName.trim(), 'Belongs To Business', session.current.businessName);
      newDivisionName = '';
      showAddDivision = false;
      await loadChart();
    } catch (e) {
      divisionError = e instanceof ApiError ? e.message : 'Could not create division.';
    } finally {
      creatingDivision = false;
    }
  }

  // --- Location creation -------------------------------------------
  let newLocationName = $state('');
  let newLocationCity = $state('');
  let newLocationType: string = $state('Retail');
  let newLocationTimezone = $state(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const ALL_TIMEZONES = Intl.supportedValuesOf('timeZone');
  let creatingLocationFor: string | null = $state(null);
  let locationError = $state('');
  async function addLocation(divisionName: string) {
    if (!session.current || !newLocationName.trim() || !newLocationCity.trim()) return;
    locationError = '';
    try {
      const treeEntities = await getEntityTree();
      const biz = treeEntities.find((e) => e.name === session.current!.businessName);
      const locationsId = biz ? treeEntities.find((e) => e.name === 'Locations' && e.parent_id === biz.id)?.id : undefined;
      await createEntity({ name: newLocationName.trim(), parentId: locationsId });
      await saveLocation(newLocationName.trim(), { city: newLocationCity.trim(), location_type: newLocationType, is_billing_address: false, timezone: newLocationTimezone });
      await setEntityRelationship(newLocationName.trim(), 'Belongs To Division', divisionName);
      newLocationName = '';
      newLocationCity = '';
      creatingLocationFor = null;
      await loadChart();
    } catch (e) {
      locationError = e instanceof ApiError ? e.message : 'Could not create location.';
    }
  }

  // --- Employee creation --------------------------------------------
  let newEmployeeName = $state('');
  let creatingEmployeeFor: string | null = $state(null); // a location name, or "__company_wide__"
  let employeeError = $state('');
  async function addEmployee(placeOfEmployment: string) {
    if (!session.current || !newEmployeeName.trim()) return;
    employeeError = '';
    try {
      await createEmployeeContact(newEmployeeName.trim(), placeOfEmployment);
      newEmployeeName = '';
      creatingEmployeeFor = null;
      await loadChart();
    } catch (e) {
      employeeError = e instanceof ApiError ? e.message : 'Could not create employee.';
    }
  }

  // --- Insert/Delete on the tree itself, per direct request: the
  // real, established Insert/Delete pattern already proven for
  // addresses and phone numbers, extended here to replace the real,
  // scattered "+ Add..." link-buttons a direct report called
  // confusing. What Insert does depends on which real, currently
  // selected/focused item it's pressed from — a division selected
  // adds a location within it; a location selected adds an employee
  // at it; nothing (or an employee) selected adds a new division,
  // the real, top-level default.
  async function deleteSelected() {
    if (!selection) return;
    const label = selection.type === 'division' ? 'division' : selection.type === 'location' ? 'location' : 'employee';
    if (!confirm(`Delete ${label} "${translations.current[selection.name] ?? selection.name}"? This cannot be undone.`)) return;
    try {
      const entities = await getEntityTree();
      const target = entities.find((e) => e.name === selection!.name);
      if (!target) throw new Error(`${translations.current['No real entity named'] ?? 'No real entity named'} "${selection!.name}".`);
      await deleteEntity(target.id);
      selection = null;
      await loadChart();
    } catch (e) {
      error = e instanceof ApiError ? e.message : `Could not delete this ${label}.`;
    }
  }

  function handleTreeKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return;
    if (e.key === 'Insert') {
      e.preventDefault();
      if (selection?.type === 'division') {
        creatingLocationFor = selection.name;
      } else if (selection?.type === 'location') {
        creatingEmployeeFor = selection.name;
      } else {
        showAddDivision = true;
      }
    } else if (e.key === 'Delete' && selection) {
      e.preventDefault();
      deleteSelected();
    }
  }

  // --- Location detail -----------------------------------------------
  let locationRecord: LocationRecord | null = $state(null);
  let openHours: { day: string; from_time: string; to_time: string }[] = $state([]);
  let locationSaving = $state(false);
  let locationSaveError = $state('');
  let locationSaveMessage = $state('');

  async function selectLocation(name: string, division: string) {
    selection = { type: 'location', name, division };
    locationSaveMessage = '';
    locationSaveError = '';
    const [loc, hours] = await Promise.all([getLocationByName(asLocationName(name)), getLocationOpenHours(asLocationName(name))]);
    locationRecord = loc;
    openHours = hours.map((h) => ({ day: h.day, from_time: h.opens_at, to_time: h.closes_at }));
  }

  async function saveLocationDetail() {
    if (!locationRecord || selection?.type !== 'location') return;
    locationSaving = true;
    locationSaveError = '';
    locationSaveMessage = '';
    try {
      await saveLocation(selection.name, {
        city: locationRecord.city,
        location_type: locationRecord.location_type,
        is_billing_address: locationRecord.is_billing_address,
        bottle_capacity: locationRecord.bottle_capacity,
        carton_capacity: locationRecord.carton_capacity,
        timezone: locationRecord.timezone,
      });
      await setLocationOpenHours(
        asLocationName(selection.name),
        openHours.map((h) => ({ day: h.day, opens_at: h.from_time, closes_at: h.to_time }))
      );
      locationSaveMessage = 'Saved.';
    } catch (e) {
      locationSaveError = e instanceof ApiError ? e.message : 'Could not save.';
    } finally {
      locationSaving = false;
    }
  }

  // --- Employee detail -----------------------------------------------
  let employeeContact: Contact | null = $state(null);
  let employeeSchedule: { day: string; from_time: string; to_time: string }[] = $state([]);
  let employeeSaving = $state(false);
  let employeeSaveError = $state('');
  let employeeSaveMessage = $state('');

  // Every real location this employee already has a real schedule at,
  // beyond their own single, primary "Place of Employment" — the
  // backend's own setEmployeeSchedule/getEmployeeSchedule already,
  // genuinely support this, per location; this was previously a real,
  // direct UI gap, never a real backend one.
  let fullEmployeeSchedule: { day: string; location: string; starts_at: string; ends_at: string }[] = $state([]);
  let additionalLocationSelection: string | null = $state(null);
  let additionalLocationSchedule: { day: string; from_time: string; to_time: string }[] = $state([]);
  let addingAdditionalLocation = $state(false);
  let newAdditionalLocation = $state('');
  let additionalLocationSaving = $state(false);
  let additionalLocationError = $state('');

  let allLocationNames = $derived.by(() => chart ? chart.divisions.flatMap((d) => d.locations.map((l) => l.location)) : []);
  let additionalLocations = $derived.by(() => selection?.type === 'employee' ? [...new Set(fullEmployeeSchedule.map((s) => s.location).filter((l) => l && l !== selection!.location))] : []);

  async function selectEmployee(name: string, division: string | undefined, location: string | undefined) {
    selection = { type: 'employee', name, division, location };
    employeeSaveMessage = '';
    employeeSaveError = '';
    additionalLocationSelection = null;
    addingAdditionalLocation = false;
    additionalLocationError = '';
    const [contact, schedule] = await Promise.all([getContact(asEmployeeName(name)), getEmployeeSchedule(asEmployeeName(name))]);
    employeeContact = contact ?? {
      phone: null, email: null, address_line1: null, address_line2: null, city: null, region: null, postal_code: null, country: null,
      payment_terms_days: null, credit_limit_minor: null, wage_minor_per_hour: null, salary_minor_per_year: null, reminder_level: 0,
      preferred_language: null,
    };
    fullEmployeeSchedule = schedule;
    const atThisLocation = location ? schedule.filter((s) => s.location === location) : [];
    employeeSchedule = atThisLocation.map((s) => ({ day: s.day, from_time: s.starts_at, to_time: s.ends_at }));
  }

  async function saveEmployeeDetail() {
    if (!employeeContact || selection?.type !== 'employee') return;
    employeeSaving = true;
    employeeSaveError = '';
    employeeSaveMessage = '';
    try {
      await setContact(selection.name, {
        wage_minor_per_hour: employeeContact.wage_minor_per_hour,
        salary_minor_per_year: employeeContact.salary_minor_per_year,
      });
      if (selection.location) {
        await setEmployeeSchedule(
          asEmployeeName(selection.name),
          asLocationName(selection.location),
          employeeSchedule.map((s) => ({ day: s.day, starts_at: s.from_time, ends_at: s.to_time }))
        );
      }
      employeeSaveMessage = 'Saved.';
    } catch (e) {
      employeeSaveError = e instanceof ApiError ? e.message : 'Could not save.';
    } finally {
      employeeSaving = false;
    }
  }
  function selectAdditionalLocation(locationName: string) {
    additionalLocationSelection = locationName;
    addingAdditionalLocation = false;
    additionalLocationError = '';
    additionalLocationSchedule = fullEmployeeSchedule
      .filter((s) => s.location === locationName)
      .map((s) => ({ day: s.day, from_time: s.starts_at, to_time: s.ends_at }));
  }

  function startAddingAdditionalLocation() {
    addingAdditionalLocation = true;
    additionalLocationSelection = null;
    additionalLocationError = '';
    const available = allLocationNames.filter((l) => l !== selection?.location && !additionalLocations.includes(l));
    newAdditionalLocation = available[0] ?? '';
    additionalLocationSchedule = [];
  }

  async function saveAdditionalLocationSchedule() {
    if (selection?.type !== 'employee') return;
    const locationName = addingAdditionalLocation ? newAdditionalLocation : additionalLocationSelection;
    if (!locationName) return;
    additionalLocationSaving = true;
    additionalLocationError = '';
    try {
      await setEmployeeSchedule(
        asEmployeeName(selection.name),
        asLocationName(locationName),
        additionalLocationSchedule.map((s) => ({ day: s.day, starts_at: s.from_time, ends_at: s.to_time }))
      );
      // Reload this same employee fresh, so fullEmployeeSchedule and
      // the additional-locations list both genuinely reflect the
      // real, just-saved change, not stale, local state.
      await selectEmployee(selection.name, selection.division, selection.location);
      selectAdditionalLocation(locationName);
    } catch (e) {
      additionalLocationError = e instanceof ApiError ? e.message : 'Could not save this location\'s schedule.';
    } finally {
      additionalLocationSaving = false;
    }
  }
</script>

<svelte:head><title>{translations.current['Business Setup'] ?? 'Business Setup'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Business Setup'] ?? 'Business Setup'}</legend>
  <p class="intro">
    {translations.current['One place to set up and amend the real, whole structure of a business — its divisions, each division\'s own real locations (with address, phone, and real weekly open hours), and each location\'s own real staff (with address, phone, wage/salary, and a real weekly schedule validated against that location\'s own open hours).'] ?? 'One place to set up and amend the real, whole structure of a business — its divisions, each division\'s own real locations (with address, phone, and real weekly open hours), and each location\'s own real staff (with address, phone, wage/salary, and a real weekly schedule validated against that location\'s own open hours).'}
  </p>

{#if loading}
  <p class="center-text">Loading…</p>
{:else if error}
  <p class="error">{error}</p>
{:else if chart}
  <div class="layout">
    <!--
      fieldset can never legally take an interactive ARIA role (a
      fixed, real, implicit "group" semantic the spec won't let any
      role override) - so the real, deliberate keyboard-navigable
      toolbar semantics live on the inner div below instead, wrapping
      just the real tree content, the same, real pattern as
      TypedList.svelte.
    -->
    <fieldset class="card-legend tree-panel">
      <legend>{chart.business}</legend>

      <div role="toolbar" tabindex="0" aria-describedby={treeHintId} aria-keyshortcuts="Insert Delete" onkeydown={handleTreeKeydown}>
      {#if chart.companyWideEmployees.length > 0}
        <div class="tree-section">
          <p class="tree-heading">{translations.current['Company-wide staff'] ?? 'Company-wide staff'}</p>
          <ul class="tree-list">
            {#each chart.companyWideEmployees as emp}
              <li>
                <button type="button" class="tree-item" class:active={selection?.type === 'employee' && selection.name === emp} onclick={() => selectEmployee(emp, undefined, undefined)}>{emp}</button>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      {#each chart.divisions as division}
        <div class="tree-section">
          <button type="button" class="tree-item division" class:active={selection?.type === 'division' && selection.name === division.division} onclick={() => selectDivision(division.division)}>
            {division.division}
          </button>
          {#each division.locations as loc}
            <div class="tree-location">
              <button type="button" class="tree-item location" class:active={selection?.type === 'location' && selection.name === loc.location} onclick={() => selectLocation(loc.location, division.division)}>
                {loc.location}
              </button>
              <ul class="tree-list">
                {#each loc.employees as emp}
                  <li>
                    <button type="button" class="tree-item" class:active={selection?.type === 'employee' && selection.name === emp} onclick={() => selectEmployee(emp, division.division, loc.location)}>{emp}</button>
                  </li>
                {/each}
                <li>
                  {#if creatingEmployeeFor === loc.location}
                    <div class="inline-add">
                      <input bind:value={newEmployeeName} placeholder={translations.current['Employee name'] ?? 'Employee name'} />
                      <button class="btn small" onclick={() => addEmployee(loc.location)}>{translations.current['Add'] ?? 'Add'}</button>
                      <button class="btn small secondary" onclick={() => (creatingEmployeeFor = null)}>{translations.current['Cancel'] ?? 'Cancel'}</button>
                    </div>
                  {/if}
                </li>
              </ul>
            </div>
          {/each}
          {#if employeeError}<p class="error small">{employeeError}</p>{/if}

          {#if creatingLocationFor === division.division}
            <div class="inline-add-block">
              <input bind:value={newLocationName} placeholder={translations.current['Location name'] ?? 'Location name'} />
              <input bind:value={newLocationCity} placeholder={translations.current['City'] ?? 'City'} />
              <select bind:value={newLocationType}>
                <option value="Retail">{translations.current['Retail'] ?? 'Retail'}</option>
                <option value="Warehouse">{translations.current['Warehouse'] ?? 'Warehouse'}</option>
              </select>
              <select bind:value={newLocationTimezone}>
                {#each ALL_TIMEZONES as tz}<option value={tz}>{tz}</option>{/each}
              </select>
              <button class="btn small" onclick={() => addLocation(division.division)}>{translations.current['Add'] ?? 'Add'}</button>
              <button class="btn small secondary" onclick={() => (creatingLocationFor = null)}>{translations.current['Cancel'] ?? 'Cancel'}</button>
            </div>
          {/if}
          {#if locationError}<p class="error small">{locationError}</p>{/if}
        </div>
      {/each}

      <div class="tree-section">
        {#if showAddDivision}
          <div class="inline-add">
            <input bind:value={newDivisionName} placeholder={translations.current['Division name'] ?? 'Division name'} />
            <button class="btn small" disabled={creatingDivision} onclick={addDivision}>{translations.current['Add'] ?? 'Add'}</button>
            <button class="btn small secondary" onclick={() => (showAddDivision = false)}>{translations.current['Cancel'] ?? 'Cancel'}</button>
          </div>
        {/if}
        {#if divisionError}<p class="error small">{divisionError}</p>{/if}
      </div>
      </div>

      <p class="keyboard-hint" id={treeHintId}>
        {#if selection?.type === 'division'}Press Insert to add a location in "{translations.current[selection.name] ?? selection.name}", or Delete to remove it.
        {:else if selection?.type === 'location'}Press Insert to add an employee at "{translations.current[selection.name] ?? selection.name}", or Delete to remove it.
        {:else if selection?.type === 'employee'}Press Delete to remove "{translations.current[selection.name] ?? selection.name}". Select a location or division to add something new.
        {:else}Select a division or location, then press Insert to add within it — or press Insert here to add a new division.{/if}
      </p>
    </fieldset>

    <fieldset class="card-legend detail-panel">
      <legend>{selection?.name ?? (translations.current['Details'] ?? 'Details')}</legend>
      {#if !selection}
        <p class="hint">{translations.current['Select a division, location, or employee on the left — Insert adds within whatever\'s selected, Delete removes it.'] ?? 'Select a division, location, or employee on the left — Insert adds within whatever\'s selected, Delete removes it.'}</p>
      {:else if selection.type === 'division'}
        <p class="hint">{translations.current['A division is purely a reporting grouping — press Insert to add a real location within it, or Delete to remove this division.'] ?? 'A division is purely a reporting grouping — press Insert to add a real location within it, or Delete to remove this division.'}</p>
      {:else if selection.type === 'location' && locationRecord}
        <fieldset>
          <legend>{translations.current['City'] ?? 'City'}</legend>
          <input bind:value={locationRecord.city} />
        </fieldset>
        <div class="row-2">
          <fieldset>
            <legend>{translations.current['Type'] ?? 'Type'}</legend>
            <select bind:value={locationRecord.location_type}>
              <option value="Retail">{translations.current['Retail'] ?? 'Retail'}</option>
              <option value="Warehouse">{translations.current['Warehouse'] ?? 'Warehouse'}</option>
            </select>
          </fieldset>
        </div>

        <h4>{translations.current['Open hours'] ?? 'Open hours'}</h4>
        <WeeklyHoursGrid bind:lines={openHours} fromLabel="Opens" toLabel="Closes" />

        {#if locationSaveError}<p class="error">{locationSaveError}</p>{/if}
        {#if locationSaveMessage}<p class="success">{locationSaveMessage}</p>{/if}
        <button class="btn" onclick={saveLocationDetail} disabled={locationSaving}>{locationSaving ? 'Saving…' : (translations.current['Save'] ?? 'Save')}</button>

        <h4>{translations.current['Addresses'] ?? 'Addresses'}</h4>
        <AddressList entityName={translations.current[selection.name] ?? selection.name} />
        <h4>{translations.current['Phone numbers'] ?? 'Phone numbers'}</h4>
        <PhoneList entityName={translations.current[selection.name] ?? selection.name} />
      {:else if selection.type === 'employee' && employeeContact}
        <div class="row-2">
          <fieldset>
            <legend>{translations.current['Wage per hour'] ?? 'Wage per hour'}</legend>
            <input
              type="number"
              min="0"
              step="0.01"
              value={employeeContact.wage_minor_per_hour !== null ? (employeeContact.wage_minor_per_hour / 100).toFixed(2) : ''}
              oninput={(e) => {
                if (!employeeContact) return;
                employeeContact.wage_minor_per_hour = e.currentTarget.value === '' ? null : Math.round(Number(e.currentTarget.value) * 100);
                if (employeeContact.wage_minor_per_hour !== null) employeeContact.salary_minor_per_year = null;
              }}
            />
          </fieldset>
          <fieldset>
            <legend>{translations.current['Salary per year'] ?? 'Salary per year'}</legend>
            <input
              type="number"
              min="0"
              step="0.01"
              value={employeeContact.salary_minor_per_year !== null ? (employeeContact.salary_minor_per_year / 100).toFixed(2) : ''}
              oninput={(e) => {
                if (!employeeContact) return;
                employeeContact.salary_minor_per_year = e.currentTarget.value === '' ? null : Math.round(Number(e.currentTarget.value) * 100);
                if (employeeContact.salary_minor_per_year !== null) employeeContact.wage_minor_per_hour = null;
              }}
            />
          </fieldset>
        </div>

        {#if selection.location}
          <h4>{translations.current['Weekly schedule'] ?? 'Weekly schedule'} — {selection.location}</h4>
          <WeeklyHoursGrid bind:lines={employeeSchedule} fromLabel="Starts" toLabel="Ends" />
        {:else}
          <p class="hint">{translations.current['A real, company-wide employee is not scheduled against any single location.'] ?? 'A real, company-wide employee is not scheduled against any single location.'}</p>
        {/if}

        {#if employeeSaveError}<p class="error">{employeeSaveError}</p>{/if}
        {#if employeeSaveMessage}<p class="success">{employeeSaveMessage}</p>{/if}
        <button class="btn" onclick={saveEmployeeDetail} disabled={employeeSaving}>{employeeSaving ? 'Saving…' : (translations.current['Save'] ?? 'Save')}</button>

        <h4>{translations.current['Additional locations'] ?? 'Additional locations'}</h4>
        <p class="hint">{translations.current['A real employee can genuinely work a real, scheduled shift at more than one location — add another one here.'] ?? 'A real employee can genuinely work a real, scheduled shift at more than one location — add another one here.'}</p>
        <fieldset class="sub-block">
          <legend>{translations.current['Additional locations'] ?? 'Additional locations'}</legend>
          {#if additionalLocations.length === 0 && !addingAdditionalLocation}
            <p class="empty">{translations.current['No additional locations yet.'] ?? 'No additional locations yet.'}</p>
          {/if}
          {#each additionalLocations as loc}
            <button
              type="button"
              class="tree-item"
              class:active={additionalLocationSelection === loc}
              onclick={() => selectAdditionalLocation(loc)}
            >
              {loc}
            </button>
          {/each}
          {#if allLocationNames.filter((l) => l !== selection?.location && !additionalLocations.includes(l)).length > 0}
            <button type="button" class="link-button" onclick={startAddingAdditionalLocation}>+ {translations.current['Add a location'] ?? 'Add a location'}</button>
          {/if}

          {#if addingAdditionalLocation}
            <div class="additional-location-form">
              <label class="field-label" for="new-additional-location">{translations.current['Location'] ?? 'Location'}</label>
              <select id="new-additional-location" bind:value={newAdditionalLocation}>
                {#each allLocationNames.filter((l) => l !== selection?.location && !additionalLocations.includes(l)) as l}<option value={l}>{l}</option>{/each}
              </select>
              <WeeklyHoursGrid bind:lines={additionalLocationSchedule} fromLabel="Starts" toLabel="Ends" />
              {#if additionalLocationError}<p class="error">{additionalLocationError}</p>{/if}
              <button class="btn" onclick={saveAdditionalLocationSchedule} disabled={additionalLocationSaving || !newAdditionalLocation}>
                {additionalLocationSaving ? 'Saving…' : (translations.current['Save'] ?? 'Save')}
              </button>
            </div>
          {:else if additionalLocationSelection}
            <div class="additional-location-form">
              <h5>{translations.current['Weekly schedule'] ?? 'Weekly schedule'} — {additionalLocationSelection}</h5>
              <WeeklyHoursGrid bind:lines={additionalLocationSchedule} fromLabel="Starts" toLabel="Ends" />
              {#if additionalLocationError}<p class="error">{additionalLocationError}</p>{/if}
              <button class="btn" onclick={saveAdditionalLocationSchedule} disabled={additionalLocationSaving}>
                {additionalLocationSaving ? 'Saving…' : (translations.current['Save'] ?? 'Save')}
              </button>
            </div>
          {/if}
        </fieldset>

        <h4>{translations.current['Addresses'] ?? 'Addresses'}</h4>
        <AddressList entityName={translations.current[selection.name] ?? selection.name} />
        <h4>{translations.current['Phone numbers'] ?? 'Phone numbers'}</h4>
        <PhoneList entityName={translations.current[selection.name] ?? selection.name} />
        <ContactList entityName={translations.current[selection.name] ?? selection.name} />
      {/if}
    </fieldset>
  </div>
{/if}
</fieldset>

<style>
  .intro {
    max-width: 80ch;
  }
  .center-text {
    text-align: center;
  }
  .error {
    color: var(--debit, #a33a2e);
  }
  .error.small {
    font-size: var(--font-size-small);
    margin: 0.2rem 0;
  }
  .success {
    color: #2a5c2a;
  }
  .layout {
    display: flex;
    gap: 1.2rem;
    max-width: 1100px;
    margin: 0 auto;
    align-items: flex-start;
  }
  .tree-panel {
    flex: 0 0 320px;
  }
  .detail-panel {
    flex: 1;
    min-height: 300px;
  }
  .tree-section {
    margin-bottom: 0.9rem;
  }
  .tree-heading {
    font-weight: 600;
    font-size: var(--font-size-medium);
    margin: 0 0 0.3rem;
  }
  .tree-location {
    margin: 0.3rem 0 0.3rem 0.4rem;
  }
  .tree-item {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 0.2rem 0.4rem;
    font-size: var(--font-size-base);
    cursor: pointer;
    border-radius: 4px;
  }
  .tree-item.division {
    font-weight: 600;
    font-size: var(--font-size-medium);
    margin: 0 0 0.3rem;
    padding: 0.15rem 0.3rem;
  }
  .tree-item.location {
    font-weight: 600;
  }
  .tree-item.active {
    background: #f2e6c9;
  }
  .tree-list {
    list-style: none;
    margin: 0.1rem 0 0.1rem 0.8rem;
    padding: 0;
  }
  .keyboard-hint {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    text-align: center;
    margin: 0.6rem 0 0;
  }
  .inline-add,
  .inline-add-block {
    display: flex;
    gap: 0.3rem;
    align-items: center;
    margin: 0.3rem 0 0.3rem 0.8rem;
    flex-wrap: wrap;
  }
  .inline-add input,
  .inline-add-block input,
  .inline-add-block select {
    font-size: var(--font-size-small);
    padding: 0.15rem 0.3rem;
    border: 1px solid var(--rule);
    border-radius: 4px;
  }
  .btn.small {
    padding: 0.15rem 0.5rem;
    font-size: var(--font-size-small);
  }
  .hint {
    color: var(--ink-soft);
    font-size: var(--font-size-medium);
  }
  .row-2 {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.6rem;
  }
  .row-2 fieldset {
    flex: 1;
  }
  .detail-panel h4 {
    margin-bottom: 0.4rem;
    margin-top: 1.2rem;
  }
  .sub-block {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .empty {
    color: var(--ink-soft);
    font-size: var(--font-size-base);
  }
  .link-button {
    background: none;
    border: none;
    color: var(--brass-dark, #8a6d3b);
    font-size: var(--font-size-small);
    cursor: pointer;
    padding: 0.2rem 0;
    text-align: left;
    align-self: flex-start;
  }
  .field-label {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    margin-bottom: -0.2rem;
  }
  .additional-location-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.6rem;
    border: 1px solid var(--rule);
    border-radius: 6px;
    margin-top: 0.3rem;
  }
  .additional-location-form h5 {
    margin: 0;
  }
</style>
