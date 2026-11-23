<script lang="ts">
  // Org chart: groups, locations, employees — see
  // docs/pm-frontend-reference.md for the full design.
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import AddressList from '$lib/components/AddressList.svelte';
  import PhoneList from '$lib/components/PhoneList.svelte';
  import ContactList from '$lib/components/ContactList.svelte';
  import WeeklyHoursGrid from '$lib/components/WeeklyHoursGrid.svelte';
  import TreeEditor from '$lib/components/TreeEditor.svelte';
  import {
    getOrganizationChart,
    getHierarchy,
    createHierarchyValue,
    createHierarchy,
    hierarchiesOf,
    setHierarchyTag,
    getHierarchyTag,
    deleteHierarchyTag,
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
    revokeEntity,
    ApiError,
    type OrganizationChart,
    type HierarchyWithValues,
    type LocationRecord,
    type Contact,
    asLocationName,
    asEmployeeName,
    getHierarchyTree,
    listHierarchyPrototypes,
    createHierarchyFromPrototype,
    type HierarchyTreeNode,
    type HierarchyPrototype,
  } from '$lib/api';

  let chart: OrganizationChart | null = $state(null);
  let hierarchy: HierarchyWithValues[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  type Selection = { type: 'group' | 'location' | 'employee'; name: string; group?: string; location?: string } | null;
  let selection: Selection = $state(null);

  // The location hierarchy the tree shows: the one chosen, else the one the
  // chart's groups are values of, else the first; '' when the business
  // has none yet. Never a name in the code — see docs/pm-frontend-reference.md.
  let locationHierarchies = $derived(hierarchiesOf(hierarchy, 'Locations'));
  let chosenHierarchy = $state('');
  let locationHierarchyName = $derived.by(() => {
    if (locationHierarchies.some((g) => g.hierarchy === chosenHierarchy)) return chosenHierarchy;
    const groupNames = new Set<string>(chart ? chart.groups.map((g): string => g.group) : []);
    const match = locationHierarchies.find((h) => h.values.some((v) => groupNames.has(v)));
    return (match ?? locationHierarchies[0])?.hierarchy ?? '';
  });

  // The business's other location hierarchies — see docs/pm-frontend-reference.md.
  let otherHierarchies = $derived.by(() => locationHierarchies.filter((h) => h.hierarchy !== locationHierarchyName));

  // A new location hierarchy, named by the business.
  let addingHierarchy = $state(false);
  let newHierarchyName = $state('');
  let hierarchyError = $state('');
  // A new hierarchy starts empty, or from a prototype of locations.
  let prototypes: HierarchyPrototype[] = $state([]);
  let startFrom = $state('');
  async function addHierarchy() {
    if (!session.current || !newHierarchyName.trim()) return;
    hierarchyError = '';
    try {
      if (startFrom) await createHierarchyFromPrototype(session.current.businessName, startFrom, newHierarchyName.trim());
      else await createHierarchy(session.current.businessName, newHierarchyName.trim(), 'Locations');
      startFrom = '';
      chosenHierarchy = newHierarchyName.trim();
      newHierarchyName = '';
      addingHierarchy = false;
      await loadChart();
    } catch (e) {
      hierarchyError = e instanceof ApiError ? e.message : 'Could not create the hierarchy.';
    }
  }

  function selectGroup(name: string) {
    selection = { type: 'group', name };
    moving = false;
    addingValueWithin = false;
  }

  // The tree of the location hierarchy: values within values, and
  // locations within values, to any depth; each location in one place
  // (docs/pm-domain-reference.md, "Values nest to any depth").
  let tree: HierarchyTreeNode[] = $state([]);
  const childValues = (parent: string | null) => tree.filter((n) => n.kind === 'value' && n.parent === parent).map((n) => n.name).sort();
  const childLocations = (parent: string) => tree.filter((n) => n.kind === 'location' && n.parent === parent).map((n) => n.name).sort();
  let employeesAt = $derived.by(() => new Map(chart ? chart.groups.flatMap((g) => g.locations.map((l): [string, string[]] => [l.location, l.employees])) : []));
  let unassignedLocations = $derived.by(() => {
    const placed = new Set(tree.filter((n) => n.kind === 'location').map((n) => n.name));
    return [...new Set(chart ? chart.groups.flatMap((g) => g.locations.map((l) => l.location)) : [])].filter((l) => !placed.has(l)).sort();
  });
  /** The value a location or value is within, or '' at the top. */
  const parentOf = (name: string) => tree.find((n) => n.name === name)?.parent ?? '';
  /** A value and every value it holds. */
  function heldBy(value: string): Set<string> {
    const held = new Set([value]);
    for (const child of childValues(value)) for (const v of heldBy(child)) held.add(v);
    return held;
  }

  async function loadTree() {
    tree = session.current && locationHierarchyName ? await getHierarchyTree(session.current.businessName, locationHierarchyName) : [];
  }

  async function loadChart() {
    if (!session.current) return;
    loading = true;
    try {
      const [c, h, p] = await Promise.all([getOrganizationChart(session.current.businessName), getHierarchy(session.current.businessName), listHierarchyPrototypes()]);
      chart = c;
      hierarchy = h;
      prototypes = p.filter((x) => x.of === 'Locations');
      await loadTree();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  }
  onMount(loadChart);

  // --- Group creation (the hierarchy that groups Locations) --------
  let newGroupName = $state('');
  let creatingGroup = $state(false);
  let showAddGroup = $state(false);
  let groupError = $state('');
  async function addGroup() {
    if (!session.current || !newGroupName.trim()) return;
    creatingGroup = true;
    groupError = '';
    try {
      await createHierarchyValue(session.current.businessName, locationHierarchyName, newGroupName.trim());
      await setEntityRelationship(newGroupName.trim(), 'Belongs To Business', session.current.businessName);
      newGroupName = '';
      showAddGroup = false;
      await loadChart();
    } catch (e) {
      groupError = e instanceof ApiError ? e.message : `Could not create this ${locationHierarchyName.toLowerCase()}.`;
    } finally {
      creatingGroup = false;
    }
  }

  // --- A value within the selected value ----------------------------
  let addingValueWithin = $state(false);
  let newValueWithin = $state('');
  async function addValueWithin() {
    if (!session.current || selection?.type !== 'group' || !newValueWithin.trim()) return;
    groupError = '';
    try {
      await createHierarchyValue(session.current.businessName, locationHierarchyName, newValueWithin.trim(), selection.name);
      await setEntityRelationship(newValueWithin.trim(), 'Belongs To Business', session.current.businessName);
      newValueWithin = '';
      addingValueWithin = false;
      await loadChart();
    } catch (e) {
      groupError = e instanceof ApiError ? e.message : 'Could not create the value.';
    }
  }

  // --- Moving the selected location or value within another value ---
  let moving = $state(false);
  let moveTarget = $state('');
  let moveTargets = $derived.by(() => {
    if (!selection || selection.type === 'employee') return [];
    const excluded = selection.type === 'group' ? heldBy(selection.name) : new Set<string>();
    return tree.filter((n) => n.kind === 'value' && !excluded.has(n.name)).map((n) => n.name).sort();
  });
  async function moveSelected() {
    if (!session.current || !selection || selection.type === 'employee') return;
    groupError = '';
    try {
      if (moveTarget) await setHierarchyTag(selection.name, locationHierarchyName, moveTarget);
      else await deleteHierarchyTag(selection.name, locationHierarchyName);
      if (selection.type === 'location') await setEntityRelationship(selection.name, 'Belongs To Group', moveTarget || selection.name);
      moving = false;
      await loadChart();
    } catch (e) {
      groupError = e instanceof ApiError ? e.message : 'Could not move it.';
    }
  }

  // --- Location creation -------------------------------------------
  let newLocationName = $state('');
  let newLocationCity = $state('');
  let newLocationType: string = $state('Retail');
  let newLocationTimezone = $state(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const ALL_TIMEZONES = Intl.supportedValuesOf('timeZone');
  // See docs/pm-frontend-reference.md.
  let newLocationDimensionValues: Record<string, string> = $state({});
  let creatingLocationFor: string | null = $state(null);
  let locationError = $state('');
  async function addLocation(groupName: string) {
    if (!session.current || !newLocationName.trim() || !newLocationCity.trim()) return;
    locationError = '';
    try {
      const treeEntities = await getEntityTree();
      const biz = treeEntities.find((e) => e.name === session.current!.businessName);
      const locationsId = biz ? treeEntities.find((e) => e.name === 'Locations' && e.parent_id === biz.id)?.id : undefined;
      await createEntity({ name: newLocationName.trim(), parentId: locationsId });
      await saveLocation(
        newLocationName.trim(),
        { city: newLocationCity.trim(), location_type: newLocationType, is_billing_address: false, timezone: newLocationTimezone },
        session.current.businessName
      );
      await setEntityRelationship(newLocationName.trim(), 'Belongs To Group', groupName);
      // Also tagged via the Hierarchy mechanism — see docs/pm-frontend-reference.md.
      if (locationHierarchyName) await setHierarchyTag(newLocationName.trim(), locationHierarchyName, groupName);
      for (const h of otherHierarchies) {
        const value = newLocationDimensionValues[h.hierarchy];
        if (value) await setHierarchyTag(newLocationName.trim(), h.hierarchy, value);
      }
      newLocationName = '';
      newLocationCity = '';
      newLocationDimensionValues = {};
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

  // --- Insert/Delete on the tree — see docs/pm-frontend-reference.md.
  async function deleteSelected() {
    if (!selection) return;
    const label = selection.type === 'group' ? locationHierarchyName.toLowerCase() : selection.type === 'location' ? 'location' : 'employee';
    if (!confirm(`Delete ${label} "${translations.current[selection.name] ?? selection.name}"? This cannot be undone.`)) return;
    try {
      const entities = await getEntityTree();
      const target = entities.find((e) => e.name === selection!.name);
      if (!target) throw new Error(`${translations.current['No real entity named'] ?? 'No real entity named'} "${selection!.name}".`);
      await revokeEntity(target.id);
      selection = null;
      await loadChart();
    } catch (e) {
      error = e instanceof ApiError ? e.message : `Could not delete this ${label}.`;
    }
  }

  // Insert/Delete callbacks dispatched by TreeEditor.svelte — see docs/pm-frontend-reference.md.
  function handleInsert() {
    if (selection?.type === 'group') {
      creatingLocationFor = selection.name;
    } else if (selection?.type === 'location') {
      creatingEmployeeFor = selection.name;
    } else if (locationHierarchyName) {
      showAddGroup = true;
    } else {
      addingHierarchy = true;
    }
  }

  function handleDelete() {
    if (selection) deleteSelected();
  }

  // Dynamic keyboard-hint text — see docs/pm-frontend-reference.md.
  let hintText = $derived.by(() => {
    if (selection?.type === 'group') {
      return `Press Insert to add a location in "${translations.current[selection.name] ?? selection.name}", or Delete to remove it.`;
    } else if (selection?.type === 'location') {
      return `Press Insert to add an employee at "${translations.current[selection.name] ?? selection.name}", or Delete to remove it.`;
    } else if (selection?.type === 'employee') {
      return `Press Delete to remove "${translations.current[selection.name] ?? selection.name}". Select a location or ${locationHierarchyName.toLowerCase()} to add something new.`;
    }
    return `Select a ${locationHierarchyName.toLowerCase()} or location, then press Insert to add within it — or press Insert here to add a new ${locationHierarchyName.toLowerCase()}.`;
  });

  // --- Location detail -----------------------------------------------
  let locationRecord: LocationRecord | null = $state(null);
  let openHours: { day: string; from_time: string; to_time: string }[] = $state([]);
  // See docs/pm-frontend-reference.md.
  let locationDimensionValues: Record<string, string> = $state({});
  let locationSaving = $state(false);
  let locationSaveError = $state('');
  let locationSaveMessage = $state('');

  async function selectLocation(name: string, group: string) {
    selection = { type: 'location', name, group };
    locationSaveMessage = '';
    locationSaveError = '';
    const dimensions = otherHierarchies;
    const [loc, hours, tags] = await Promise.all([
      getLocationByName(asLocationName(name)),
      getLocationOpenHours(asLocationName(name)),
      Promise.all(dimensions.map((h) => getHierarchyTag(name, h.hierarchy))),
    ]);
    locationRecord = loc;
    openHours = hours.map((h) => ({ day: h.day, from_time: h.opens_at, to_time: h.closes_at }));
    const values: Record<string, string> = {};
    dimensions.forEach((h, i) => { values[h.hierarchy] = tags[i].parentName ?? ''; });
    locationDimensionValues = values;
  }

  async function saveLocationDetail() {
    if (!locationRecord || selection?.type !== 'location' || !session.current?.businessName) return;
    locationSaving = true;
    locationSaveError = '';
    locationSaveMessage = '';
    try {
      await saveLocation(
        selection.name,
        {
          city: locationRecord.city,
          location_type: locationRecord.location_type,
          is_billing_address: locationRecord.is_billing_address,
          bottle_capacity: locationRecord.bottle_capacity,
          carton_capacity: locationRecord.carton_capacity,
          timezone: locationRecord.timezone,
        },
        session.current.businessName
      );
      await setLocationOpenHours(
        asLocationName(selection.name),
        openHours.map((h) => ({ day: h.day, opens_at: h.from_time, closes_at: h.to_time }))
      );
      for (const h of otherHierarchies) {
        const value = locationDimensionValues[h.hierarchy];
        if (value) await setHierarchyTag(selection.name, h.hierarchy, value);
        else await deleteHierarchyTag(selection.name, h.hierarchy);
      }
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

  // See docs/pm-frontend-reference.md.
  let fullEmployeeSchedule: { day: string; location: string; starts_at: string; ends_at: string }[] = $state([]);
  let additionalLocationSelection: string | null = $state(null);
  let additionalLocationSchedule: { day: string; from_time: string; to_time: string }[] = $state([]);
  let addingAdditionalLocation = $state(false);
  let newAdditionalLocation = $state('');
  let additionalLocationSaving = $state(false);
  let additionalLocationError = $state('');

  let allLocationNames = $derived.by(() => chart ? chart.groups.flatMap((g) => g.locations.map((l) => l.location)) : []);
  let additionalLocations = $derived.by(() => selection?.type === 'employee' ? [...new Set(fullEmployeeSchedule.map((s) => s.location).filter((l) => l && l !== selection!.location))] : []);

  async function selectEmployee(name: string, group: string | undefined, location: string | undefined) {
    selection = { type: 'employee', name, group, location };
    employeeSaveMessage = '';
    employeeSaveError = '';
    additionalLocationSelection = null;
    addingAdditionalLocation = false;
    additionalLocationError = '';
    const [contact, schedule] = await Promise.all([getContact(asEmployeeName(name)), getEmployeeSchedule(asEmployeeName(name))]);
    employeeContact = contact ?? {
      business_name: null, phone: null, email: null, address_line1: null, address_line2: null, city: null, region: null, postal_code: null, country: null,
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

  // Deliberately a plain link-button, not Insert/Delete — see docs/pm-frontend-reference.md.
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
      // Reload fresh so state reflects the just-saved change — see docs/pm-frontend-reference.md.
      await selectEmployee(selection.name, selection.group, selection.location);
      selectAdditionalLocation(locationName);
    } catch (e) {
      additionalLocationError = e instanceof ApiError ? e.message : 'Could not save this location\'s schedule.';
    } finally {
      additionalLocationSaving = false;
    }
  }
</script>

{#snippet valueNode(value: string)}
  <div class="tree-section">
    <button type="button" class="tree-item group" class:active={selection?.type === 'group' && selection.name === value} onclick={() => selectGroup(value)}>
      {value}
    </button>
    <div class="tree-within">
      {#each childValues(value) as inner (inner)}{@render valueNode(inner)}{/each}
      {#each childLocations(value) as loc (loc)}{@render locationNode(loc, value)}{/each}
      {#if employeeError}<p class="error small">{employeeError}</p>{/if}
      {#if creatingLocationFor === value}
        <!-- A whole-form keydown, not per-field — see Form.svelte's own
             onFormKeydown and docs/pm-frontend-reference.md: this plain
             field group has no Form.svelte of its own, but Escape must
             still work from the select fields too, not just the text
             inputs. -->
        <div
          class="inline-add-block"
          onkeydown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); addLocation(value); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); creatingLocationFor = null; locationError = ''; }
          }}
        >
          <input bind:value={newLocationName} placeholder={translations.current['Location name'] ?? 'Location name'} />
          <input bind:value={newLocationCity} placeholder={translations.current['City'] ?? 'City'} />
          <select bind:value={newLocationType}>
            <option value="Retail">{translations.current['Retail'] ?? 'Retail'}</option>
            <option value="Warehouse">{translations.current['Warehouse'] ?? 'Warehouse'}</option>
          </select>
          <select bind:value={newLocationTimezone}>
            {#each ALL_TIMEZONES as tz}<option value={tz}>{tz}</option>{/each}
          </select>
          {#each otherHierarchies as h}
            <select bind:value={newLocationDimensionValues[h.hierarchy]}>
              <option value="">{translations.current[h.hierarchy] ?? h.hierarchy}…</option>
              {#each h.values as v}<option value={v}>{translations.current[v] ?? v}</option>{/each}
            </select>
          {/each}
        </div>
      {/if}
      {#if locationError}<p class="error small">{locationError}</p>{/if}
    </div>
  </div>
{/snippet}

{#snippet locationNode(loc: string, group: string)}
  <div class="tree-location">
    <button type="button" class="tree-item location" class:active={selection?.type === 'location' && selection.name === loc} onclick={() => selectLocation(loc, group)}>
      {loc}
    </button>
    <ul class="tree-list">
      {#each employeesAt.get(loc) ?? [] as emp}
        <li>
          <button type="button" class="tree-item" class:active={selection?.type === 'employee' && selection.name === emp} onclick={() => selectEmployee(emp, group, loc)}>{emp}</button>
        </li>
      {/each}
      <li>
        {#if creatingEmployeeFor === loc}
          <div class="inline-add">
            <input
              bind:value={newEmployeeName}
              placeholder={translations.current['Employee name'] ?? 'Employee name'}
              onkeydown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addEmployee(loc); }
                else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); creatingEmployeeFor = null; employeeError = ''; }
              }}
            />
          </div>
        {/if}
      </li>
    </ul>
  </div>
{/snippet}

{#snippet movePanel()}
  {#if locationHierarchyName && selection && selection.type !== 'employee'}
    {#if moving}
      <div class="move-panel">
        <select bind:value={moveTarget}>
          <option value="">{selection.type === 'group' ? (translations.current['(top level)'] ?? '(top level)') : (translations.current['Unassigned'] ?? 'Unassigned')}</option>
          {#each moveTargets as v (v)}<option value={v}>{translations.current[v] ?? v}</option>{/each}
        </select>
        <button type="button" class="btn small" onclick={moveSelected}>{translations.current['Move'] ?? 'Move'}</button>
        <button type="button" class="btn secondary small" onclick={() => (moving = false)}>{translations.current['Cancel'] ?? 'Cancel'}</button>
      </div>
    {:else}
      <button type="button" class="btn secondary small" onclick={() => { moving = true; moveTarget = parentOf(selection!.name); }}>{translations.current['Move…'] ?? 'Move…'}</button>
    {/if}
  {/if}
{/snippet}

<svelte:head><title>{translations.current['Business Setup'] ?? 'Business Setup'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Business Setup'] ?? 'Business Setup'}</legend>
  <p class="intro">
    {translations.current['One place to set up and amend the real, whole structure of a business'] ?? 'One place to set up and amend the real, whole structure of a business'} —
    {locationHierarchyName ? (translations.current[locationHierarchyName] ?? locationHierarchyName) : ''}
    {translations.current['groups of real Locations (with address, phone, and real weekly open hours), and each location\'s own real staff (with address, phone, wage/salary, and a real weekly schedule validated against that location\'s own open hours).'] ?? 'groups of real Locations (with address, phone, and real weekly open hours), and each location\'s own real staff (with address, phone, wage/salary, and a real weekly schedule validated against that location\'s own open hours).'}
  </p>

{#if loading}
  <p class="center-text">Loading…</p>
{:else if error}
  <p class="error">{error}</p>
{:else if chart}
  <div class="hierarchy-bar">
    {#if locationHierarchies.length > 0}
      <span>{translations.current['Hierarchy'] ?? 'Hierarchy'}:</span>
      {#each locationHierarchies as g (g.hierarchy)}
        <button type="button" class="btn secondary small hierarchy-choice" class:active={g.hierarchy === locationHierarchyName} onclick={async () => { chosenHierarchy = g.hierarchy; selection = null; await loadTree(); }}>{translations.current[g.hierarchy] ?? g.hierarchy}</button>
      {/each}
    {/if}
    {#if addingHierarchy}
      <input
        bind:value={newHierarchyName}
        placeholder={translations.current['Name of the hierarchy, e.g. Division'] ?? 'Name of the hierarchy, e.g. Division'}
        onkeydown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); addHierarchy(); }
          else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); addingHierarchy = false; hierarchyError = ''; }
        }}
      />
      {#if prototypes.length > 0}
        <select class="start-from" bind:value={startFrom}>
          <option value="">{translations.current['Empty'] ?? 'Empty'}</option>
          {#each prototypes as p (p.prototype)}<option value={p.prototype}>{translations.current['From'] ?? 'From'} {p.prototype}</option>{/each}
        </select>
      {/if}
    {:else}
      <button type="button" class="link-button" onclick={() => { addingHierarchy = true; newHierarchyName = ''; hierarchyError = ''; }}>+ {translations.current['New Hierarchy'] ?? 'New Hierarchy'}</button>
    {/if}
    {#if hierarchyError}<p class="error small">{hierarchyError}</p>{/if}
  </div>
  <div class="layout">
    <TreeEditor
      legend={locationHierarchyName ? `${chart.business} — ${translations.current[locationHierarchyName] ?? locationHierarchyName} ${translations.current['for Locations'] ?? 'for Locations'}` : `${chart.business} — ${translations.current['Locations'] ?? 'Locations'}`}
      {hintText}
      onInsert={handleInsert}
      onDelete={handleDelete}
    >
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

      {#each childValues(null) as value (value)}
        {@render valueNode(value)}
      {/each}
      {#if unassignedLocations.length > 0}
        <div class="tree-section">
          <p class="tree-heading">{locationHierarchyName ? (translations.current['Unassigned'] ?? 'Unassigned') : (translations.current['Locations'] ?? 'Locations')}</p>
          {#each unassignedLocations as loc (loc)}{@render locationNode(loc, loc)}{/each}
        </div>
      {/if}

      <div class="tree-section">
        {#if showAddGroup}
          <div class="inline-add">
            <input
              bind:value={newGroupName}
              placeholder={`${translations.current[locationHierarchyName] ?? locationHierarchyName} ${translations.current['Name'] ?? 'Name'}`}
              disabled={creatingGroup}
              onkeydown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addGroup(); }
                else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); showAddGroup = false; groupError = ''; }
              }}
            />
          </div>
        {/if}
        {#if groupError}<p class="error small">{groupError}</p>{/if}
      </div>
    </TreeEditor>

    <fieldset class="card-legend detail-panel">
      <legend>{selection?.name ?? (translations.current['Details'] ?? 'Details')}</legend>
      {#if !selection}
        <p class="hint">{translations.current['Select a group, location, or employee on the left — Insert adds within whatever\'s selected, Delete removes it.'] ?? `Select a ${locationHierarchyName.toLowerCase()}, location, or employee on the left — Insert adds within whatever's selected, Delete removes it.`}</p>
      {:else if selection.type === 'group'}
        <p class="hint">{`"${selection.name}" is a value of the ${locationHierarchyName} reporting hierarchy — press Insert to add a location within it, "+ Value within" to add a value within it, or Delete to remove it.`}</p>
        {#if addingValueWithin}
          <div class="inline-add">
            <input
              bind:value={newValueWithin}
              placeholder={translations.current['New value'] ?? 'New value'}
              onkeydown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addValueWithin(); }
                else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); addingValueWithin = false; }
              }}
            />
          </div>
        {:else}
          <button type="button" class="btn secondary small" onclick={() => { addingValueWithin = true; newValueWithin = ''; }}>+ {translations.current['Value within'] ?? 'Value within'}</button>
        {/if}
        {@render movePanel()}
        {#if groupError}<p class="error small">{groupError}</p>{/if}
      {:else if selection.type === 'location' && locationRecord}
        {@render movePanel()}
        {#if groupError}<p class="error small">{groupError}</p>{/if}
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

        {#if otherHierarchies.length > 0}
          <div class="row-2">
            {#each otherHierarchies as h}
              <fieldset>
                <legend>{translations.current[h.hierarchy] ?? h.hierarchy}</legend>
                <select bind:value={locationDimensionValues[h.hierarchy]}>
                  <option value="">{translations.current['(none)'] ?? '(none)'}</option>
                  {#each h.values as v}<option value={v}>{translations.current[v] ?? v}</option>{/each}
                </select>
              </fieldset>
            {/each}
          </div>
        {/if}

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
  .tree-within {
    margin-left: 1rem;
    border-left: 1px solid var(--border, #ddd);
    padding-left: 0.5rem;
  }
  .move-panel {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    margin: 0.4rem 0;
  }
  .hierarchy-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.8rem;
  }
  .hierarchy-choice.active {
    background: var(--brass-dark, #7a5c2e);
    color: white;
  }
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
  .tree-item.group {
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
