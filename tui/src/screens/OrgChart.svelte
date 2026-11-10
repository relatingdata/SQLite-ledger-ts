<!--
  A TUI port of the Business Structure popup's unified "Org Chart" step
  (frontend/src/lib/components/BusinessStructurePopup.svelte +
  OrgChartNode.svelte) - Locations, Divisions, Departments, and
  Employees, all together. The web app draws this as a typed-box
  diagram with connector lines; a terminal can't usefully draw that,
  so this screen keeps the same real data and operations (create/
  delete Location, create/delete Division, create/delete Department,
  move a Location between Divisions, assign/clear an Employee's
  Department and Manager) as a drill-down list instead - Divisions
  and Departments (plus their own "Unassigned" buckets) at the top,
  each bucket's Locations or Employees underneath. Same endpoints,
  same payload shapes - see tui/src/api.ts.

  A Location is a real, postable CoA account (matched to its own,
  same-named account node by name); a Division is a pure Hierarchy
  reporting tag with no account of its own - same distinction the web
  app's own code comments document. Deleting a Division value here
  only removes the tag/grouping value, never a Location.
-->
<script lang="ts">
  import { Box, Text } from 'sveltui';
  import { keyboard } from 'sveltui';
  import { onDestroy } from 'svelte';
  import {
    ApiError,
    asBusinessName,
    createDepartment,
    createHierarchyGrouping,
    createHierarchyValue,
    createLocation,
    deleteDepartment,
    deleteEmployeeDepartment,
    deleteEmployeeManager,
    deleteHierarchyTag,
    deleteHierarchyValue,
    deleteLocation,
    getHierarchy,
    getHierarchyTag,
    getLocationTypes,
    getOrgChartStructure,
    listLocations,
    setEmployeeDepartment,
    setEmployeeManager,
    setHierarchyTag,
    type LocationRecord,
    type OrgChartEmployee,
    type OrgChartStructure,
  } from '../api.ts';
  import Panel from '../components/Panel.svelte';
  import TextInput from '../components/TextInput.svelte';
  import SelectList from '../components/SelectList.svelte';
  import { brass, ink, inkSoft } from '../theme.ts';

  type View =
    | 'buckets'
    | 'add-menu'
    | 'new-department'
    | 'new-division'
    | 'new-location-name'
    | 'new-location-city'
    | 'new-location-type'
    | 'new-location-bottle'
    | 'new-location-carton'
    | 'locations'
    | 'set-location-division'
    | 'employees'
    | 'employee-actions'
    | 'set-department'
    | 'set-manager';

  const DIVISION = 'Division';
  const UNASSIGNED_DEPT = '__unassigned_dept__';
  const UNASSIGNED_DIV = '__unassigned_div__';

  type Bucket = { key: string; kind: 'division' | 'department'; label: string; count: number };

  let { businessName, onBack }: { businessName: string; onBack: () => void } = $props();

  let orgChart: OrgChartStructure | null = $state(null);
  let locations: LocationRecord[] = $state([]);
  let locationDivision: Record<string, string | null> = $state({});
  let divisionValues: string[] = $state([]);
  let locationTypes: string[] = $state([]);
  let error: string | null = $state(null);
  let busy = $state(false);
  let loaded = $state(false);

  let view: View = $state('buckets');
  let bucketSelected = $state(0);
  let selectedBucket: Bucket | null = $state(null);
  let locationSelected = $state(0);
  let selectedLocation: LocationRecord | null = $state(null);
  let employeeSelected = $state(0);
  let selectedEmployee: OrgChartEmployee | null = $state(null);

  let newDepartmentName = $state('');
  let newDivisionName = $state('');
  let newLocationName = $state('');
  let newLocationCity = $state('');
  let newLocationType = $state('Retail');
  let newLocationBottle = $state('');
  let newLocationCarton = $state('');
  let fieldInput = $state('');

  function findEmployee(structure: OrgChartStructure, name: string): OrgChartEmployee | null {
    for (const dep of structure.departments) {
      const found = dep.employees.find((e) => e.name === name);
      if (found) return found;
    }
    return structure.unassignedEmployees.find((e) => e.name === name) ?? null;
  }

  async function refresh(resync?: { employeeName?: string; locationName?: string }): Promise<void> {
    try {
      const biz = asBusinessName(businessName);
      const [chart, locs, hierarchy] = await Promise.all([getOrgChartStructure(businessName), listLocations(biz), getHierarchy(businessName)]);
      const tags = await Promise.all(locs.map((l) => getHierarchyTag(l.name, DIVISION).catch(() => ({ parentName: null }))));
      const divisionByLocation = Object.fromEntries(locs.map((l, i) => [l.name, tags[i]!.parentName]));
      orgChart = chart;
      locations = locs;
      locationDivision = divisionByLocation;
      divisionValues = hierarchy.find((h) => h.grouping === DIVISION)?.values ?? [];
      error = null;
      if (resync?.employeeName) selectedEmployee = findEmployee(chart, resync.employeeName);
      if (resync?.locationName) selectedLocation = locs.find((l) => l.name === resync.locationName) ?? null;
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not load the org chart.';
    } finally {
      loaded = true;
    }
  }
  void refresh();
  void getLocationTypes()
    .then((types) => { if (types.length > 0) locationTypes = types; })
    .catch(() => {});

  const divisionBuckets = $derived.by<Bucket[]>(() => {
    const result = divisionValues
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .map((v): Bucket => ({ key: v, kind: 'division', label: v, count: locations.filter((l) => locationDivision[l.name] === v).length }));
    result.push({
      key: UNASSIGNED_DIV,
      kind: 'division',
      label: 'Unassigned (no division)',
      count: locations.filter((l) => !locationDivision[l.name]).length,
    });
    return result;
  });
  const departmentBuckets = $derived.by<Bucket[]>(() =>
    orgChart
      ? [
          ...orgChart.departments.map((d): Bucket => ({ key: d.name, kind: 'department', label: d.name, count: d.employees.length })),
          { key: UNASSIGNED_DEPT, kind: 'department', label: 'Unassigned (no department)', count: orgChart.unassignedEmployees.length },
        ]
      : [],
  );
  const buckets = $derived<Bucket[]>([...divisionBuckets, ...departmentBuckets]);

  const bucketLocations = $derived<LocationRecord[]>(
    selectedBucket?.kind === 'division'
      ? locations
          .filter((l) => (selectedBucket!.key === UNASSIGNED_DIV ? !locationDivision[l.name] : locationDivision[l.name] === selectedBucket!.key))
          .sort((a, b) => a.name.localeCompare(b.name))
      : [],
  );
  const bucketEmployees = $derived<OrgChartEmployee[]>(
    selectedBucket?.kind === 'department'
      ? selectedBucket.key === UNASSIGNED_DEPT
        ? orgChart?.unassignedEmployees ?? []
        : orgChart?.departments.find((d) => d.name === selectedBucket!.key)?.employees ?? []
      : [],
  );

  const unsubscribe = keyboard.on((event) => {
    if (event.key === 'Escape') {
      if (view === 'buckets') { onBack(); return true; }
      if (view === 'add-menu') { view = 'buckets'; return true; }
      if (view === 'new-department' || view === 'new-division') { view = 'add-menu'; return true; }
      if (view.startsWith('new-location-')) { view = 'add-menu'; return true; }
      if (view === 'locations') { view = 'buckets'; return true; }
      if (view === 'set-location-division') { view = 'locations'; return true; }
      if (view === 'employees') { view = 'buckets'; return true; }
      if (view === 'employee-actions') { view = 'employees'; return true; }
      if (view === 'set-department' || view === 'set-manager') { view = 'employee-actions'; return true; }
      return true;
    }
    if (view === 'buckets' && orgChart) {
      switch (event.key) {
        case 'ArrowDown':
          bucketSelected = Math.min(bucketSelected + 1, buckets.length - 1);
          return true;
        case 'ArrowUp':
          bucketSelected = Math.max(bucketSelected - 1, 0);
          return true;
        case 'Enter': {
          const bucket = buckets[bucketSelected];
          if (bucket) {
            selectedBucket = bucket;
            locationSelected = 0;
            employeeSelected = 0;
            view = bucket.kind === 'division' ? 'locations' : 'employees';
          }
          return true;
        }
        default:
          if (event.key === 'i') { view = 'add-menu'; return true; }
          if (event.key === 'd') {
            const bucket = buckets[bucketSelected];
            if (bucket) {
              if (bucket.kind === 'division' && bucket.key !== UNASSIGNED_DIV) void removeDivision(bucket.key);
              if (bucket.kind === 'department' && bucket.key !== UNASSIGNED_DEPT) void removeDepartment(bucket.key);
            }
            return true;
          }
          return false;
      }
    }
    if (view === 'locations' && selectedBucket) {
      switch (event.key) {
        case 'ArrowDown':
          locationSelected = Math.min(locationSelected + 1, Math.max(bucketLocations.length - 1, 0));
          return true;
        case 'ArrowUp':
          locationSelected = Math.max(locationSelected - 1, 0);
          return true;
        case 'Enter':
          if (bucketLocations[locationSelected]) {
            selectedLocation = bucketLocations[locationSelected];
            view = 'set-location-division';
          }
          return true;
        default:
          if (event.key === 'd' && bucketLocations[locationSelected]) { void removeLocation(bucketLocations[locationSelected].name); return true; }
          return false;
      }
    }
    if (view === 'employees' && selectedBucket) {
      switch (event.key) {
        case 'ArrowDown':
          employeeSelected = Math.min(employeeSelected + 1, Math.max(bucketEmployees.length - 1, 0));
          return true;
        case 'ArrowUp':
          employeeSelected = Math.max(employeeSelected - 1, 0);
          return true;
        case 'Enter':
          if (bucketEmployees[employeeSelected]) {
            selectedEmployee = bucketEmployees[employeeSelected];
            fieldInput = '';
            view = 'employee-actions';
          }
          return true;
        default:
          return false;
      }
    }
  });
  onDestroy(unsubscribe);

  async function removeDepartment(name: string) {
    busy = true; error = null;
    try {
      // Note: api.ts's real signature is (name, business) - the original
      // screen this was ported from called it the other way round.
      await deleteDepartment(name, businessName);
      bucketSelected = 0;
      await refresh();
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not delete that department.';
    } finally { busy = false; }
  }

  async function removeDivision(name: string) {
    busy = true; error = null;
    try {
      await deleteHierarchyValue(businessName, DIVISION, name);
      bucketSelected = 0;
      await refresh();
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not delete that division.';
    } finally { busy = false; }
  }

  async function removeLocation(name: string) {
    busy = true; error = null;
    try {
      await deleteLocation(name, businessName);
      locationSelected = 0;
      await refresh();
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not delete that location.';
    } finally { busy = false; }
  }

  async function addDepartment() {
    const name = newDepartmentName.trim();
    if (!name) { view = 'add-menu'; return; }
    busy = true; error = null;
    try {
      await createDepartment(businessName, name);
      await refresh();
      view = 'buckets';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not create that department.';
      view = 'add-menu';
    } finally { busy = false; }
  }

  async function addDivision() {
    const name = newDivisionName.trim();
    if (!name) { view = 'add-menu'; return; }
    busy = true; error = null;
    try {
      await createHierarchyGrouping(businessName, DIVISION);
      await createHierarchyValue(businessName, DIVISION, name);
      await refresh();
      view = 'buckets';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not create that division.';
      view = 'add-menu';
    } finally { busy = false; }
  }

  function parseOptionalInt(s: string): number | null {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  async function addLocation() {
    const name = newLocationName.trim();
    if (!name) { view = 'add-menu'; return; }
    busy = true; error = null;
    try {
      await createLocation(name, businessName, {
        city: newLocationCity.trim(),
        location_type: newLocationType,
        is_billing_address: false,
        bottle_capacity: parseOptionalInt(newLocationBottle),
        carton_capacity: parseOptionalInt(newLocationCarton),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      newLocationName = '';
      newLocationCity = '';
      newLocationType = 'Retail';
      newLocationBottle = '';
      newLocationCarton = '';
      await refresh();
      view = 'buckets';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not create that location.';
      view = 'add-menu';
    } finally { busy = false; }
  }

  async function moveLocationDivision(locationName: string, divisionName: string | null) {
    busy = true; error = null;
    try {
      if (divisionName) await setHierarchyTag(locationName, DIVISION, divisionName);
      else await deleteHierarchyTag(locationName, DIVISION);
      await refresh({ locationName });
      view = 'locations';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not move that location.';
    } finally { busy = false; }
  }

  async function assignDepartment(employeeName: string, departmentName: string) {
    busy = true; error = null;
    try {
      await setEmployeeDepartment(employeeName, departmentName);
      await refresh({ employeeName });
      view = 'employees';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not assign that department.';
      view = 'employee-actions';
    } finally { busy = false; }
  }

  async function clearDepartment(employeeName: string) {
    busy = true; error = null;
    try {
      await deleteEmployeeDepartment(employeeName);
      await refresh({ employeeName });
      view = 'employees';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not clear that department.';
    } finally { busy = false; }
  }

  async function assignManager(employeeName: string, managerName: string) {
    busy = true; error = null;
    try {
      await setEmployeeManager(employeeName, managerName);
      await refresh({ employeeName });
      view = 'employee-actions';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not assign that manager.';
      view = 'employee-actions';
    } finally { busy = false; }
  }

  async function clearManager(employeeName: string) {
    busy = true; error = null;
    try {
      await deleteEmployeeManager(employeeName);
      await refresh({ employeeName });
      view = 'employee-actions';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not clear that manager.';
    } finally { busy = false; }
  }
</script>

{#if error && !loaded}
  <Panel title="Org Chart"><Text text={error} color="red" /></Panel>
{:else if !loaded || !orgChart}
  <Panel title="Org Chart"><Text text="Loading…" color={inkSoft} /></Panel>
{:else if view === 'buckets'}
  <Panel title={`Org Chart — ${businessName}`} focused>
    <Text text="Divisions" color={inkSoft} dim />
    {#each divisionBuckets as b, i (b.key)}
      <Text text={`${i === bucketSelected ? '› ' : '  '}${b.label} (${b.count})`} color={i === bucketSelected ? brass : ink} />
    {/each}
    <Text text="Departments" color={inkSoft} dim />
    {#each departmentBuckets as b, i (b.key)}
      {@const idx = divisionBuckets.length + i}
      <Text text={`${idx === bucketSelected ? '› ' : '  '}${b.label} (${b.count})`} color={idx === bucketSelected ? brass : ink} />
    {/each}
    {#if error}<Text text={error} color="red" />{/if}
    {#if busy}<Text text="Working…" color={inkSoft} />{/if}
    <Text text="↑/↓ highlight · Enter open a bucket · I add Location/Division/Department · D delete highlighted (not Unassigned) · ←/→ Item Categories / Other Hierarchies · Escape back to menu" color={inkSoft} dim />
  </Panel>
{:else if view === 'add-menu'}
  <Panel title={`Org Chart — ${businessName} — add`} focused>
    <SelectList
      items={[
        { label: 'New Location…', value: 'location' },
        { label: 'New Division…', value: 'division' },
        { label: 'New Department…', value: 'department' },
      ]}
      onSelect={(item) => {
        if (item.value === 'location') {
          newLocationName = '';
          newLocationCity = '';
          newLocationType = locationTypes[0] ?? 'Retail';
          newLocationBottle = '';
          newLocationCarton = '';
          view = 'new-location-name';
        } else if (item.value === 'division') {
          newDivisionName = '';
          view = 'new-division';
        } else {
          newDepartmentName = '';
          view = 'new-department';
        }
      }}
    />
    <Text text="Escape cancels" color={inkSoft} dim />
  </Panel>
{:else if view === 'new-department'}
  <Panel title={`Org Chart — ${businessName} — new department`} focused>
    <TextInput bind:value={newDepartmentName} focused onSubmit={() => void addDepartment()} />
    {#if error}<Text text={error} color="red" />{/if}
    <Text text="Enter creates it (real CoA accounts are provisioned alongside it) · Escape cancels" color={inkSoft} dim />
  </Panel>
{:else if view === 'new-division'}
  <Panel title={`Org Chart — ${businessName} — new division`} focused>
    <TextInput bind:value={newDivisionName} focused onSubmit={() => void addDivision()} />
    {#if error}<Text text={error} color="red" />{/if}
    <Text text="Enter creates it (a pure reporting tag — no account of its own) · Escape cancels" color={inkSoft} dim />
  </Panel>
{:else if view === 'new-location-name'}
  <Panel title={`Org Chart — ${businessName} — new location — name`} focused>
    <TextInput bind:value={newLocationName} focused onSubmit={() => { if (newLocationName.trim()) view = 'new-location-city'; }} />
    {#if error}<Text text={error} color="red" />{/if}
    <Text text="Enter continues · Escape cancels" color={inkSoft} dim />
  </Panel>
{:else if view === 'new-location-city'}
  <Panel title={`Org Chart — ${businessName} — ${newLocationName} — city`} focused>
    <TextInput bind:value={newLocationCity} focused onSubmit={() => (view = 'new-location-type')} />
    {#if error}<Text text={error} color="red" />{/if}
    <Text text="Enter continues (blank is fine) · Escape cancels" color={inkSoft} dim />
  </Panel>
{:else if view === 'new-location-type'}
  <Panel title={`Org Chart — ${businessName} — ${newLocationName} — type`} focused>
    <SelectList
      items={(locationTypes.length > 0 ? locationTypes : ['Retail']).map((t) => ({ label: t, value: t }))}
      onSelect={(item) => { newLocationType = item.value; view = 'new-location-bottle'; }}
    />
    <Text text="Escape cancels" color={inkSoft} dim />
  </Panel>
{:else if view === 'new-location-bottle'}
  <Panel title={`Org Chart — ${businessName} — ${newLocationName} — bottle capacity`} focused>
    <TextInput bind:value={newLocationBottle} focused onSubmit={() => (view = 'new-location-carton')} />
    {#if error}<Text text={error} color="red" />{/if}
    <Text text="Optional — Enter continues blank or with a number · Escape cancels" color={inkSoft} dim />
  </Panel>
{:else if view === 'new-location-carton'}
  <Panel title={`Org Chart — ${businessName} — ${newLocationName} — carton capacity`} focused>
    <TextInput bind:value={newLocationCarton} focused onSubmit={() => void addLocation()} />
    {#if error}<Text text={error} color="red" />{/if}
    {#if busy}<Text text="Working…" color={inkSoft} />{/if}
    <Text text="Optional — Enter creates the location · Escape cancels" color={inkSoft} dim />
  </Panel>
{:else if view === 'locations' && selectedBucket}
  <Panel title={`Org Chart — ${businessName} — ${selectedBucket.label}`} focused>
    {#if bucketLocations.length === 0}
      <Text text="No locations in this bucket." color={inkSoft} />
    {/if}
    {#each bucketLocations as l, i (l.name)}
      <Text
        text={`${i === locationSelected ? '› ' : '  '}${l.name.padEnd(26)}${(l.city || '(no city)').padEnd(16)}${l.location_type}`}
        color={i === locationSelected ? brass : ink}
      />
    {/each}
    {#if error}<Text text={error} color="red" />{/if}
    {#if busy}<Text text="Working…" color={inkSoft} />{/if}
    <Text text="↑/↓ highlight · Enter move to another division · D delete highlighted location · Escape back" color={inkSoft} dim />
  </Panel>
{:else if view === 'set-location-division' && selectedLocation}
  <Panel title={`Org Chart — ${selectedLocation.name} — division`} focused>
    <SelectList
      items={[{ label: 'Unassigned (no division)', value: UNASSIGNED_DIV }, ...divisionValues.map((v) => ({ label: v, value: v }))]}
      onSelect={(item) => void moveLocationDivision(selectedLocation!.name, item.value === UNASSIGNED_DIV ? null : item.value)}
    />
    {#if error}<Text text={error} color="red" />{/if}
    {#if busy}<Text text="Working…" color={inkSoft} />{/if}
    <Text text="Escape cancels" color={inkSoft} dim />
  </Panel>
{:else if view === 'employees' && selectedBucket}
  <Panel title={`Org Chart — ${businessName} — ${selectedBucket.label}`} focused>
    <Text
      text={
        bucketEmployees.length === 0
          ? 'No employees in this bucket.'
          : bucketEmployees
              .map(
                (e, i) =>
                  `${i === employeeSelected ? '› ' : '  '}${e.name.padEnd(22)}${e.location ?? '(no location)'} · reports to: ${e.managerName ?? '(none)'}`
              )
              .join('\n')
      }
      color={ink}
    />
    <Text text="↑/↓ highlight · Enter manage an employee · Escape back" color={inkSoft} dim />
    <Text text={error ?? ''} color="red" />
  </Panel>
{:else if view === 'employee-actions' && selectedEmployee}
  {@const inDepartment = selectedBucket?.key !== UNASSIGNED_DEPT}
  {@const items = [
    { label: 'Set / move department…', value: 'set-department' },
    ...(inDepartment ? [{ label: 'Clear department (unassign)', value: 'clear-department' }] : []),
    { label: 'Set manager…', value: 'set-manager' },
    ...(selectedEmployee.managerName ? [{ label: 'Clear manager', value: 'clear-manager' }] : []),
  ]}
  <Panel title={`Org Chart — ${selectedEmployee.name}`} focused>
    <Text text={`Location: ${selectedEmployee.location ?? '(none)'}`} color={ink} />
    <Text text={`Reports to: ${selectedEmployee.managerName ?? '(none)'}`} color={ink} />
    {#if error}<Text text={error} color="red" />{/if}
    {#if busy}<Text text="Working…" color={inkSoft} />{/if}
    <Box marginTop={1}>
      <SelectList
        items={items}
        onSelect={(item) => {
          fieldInput = '';
          if (item.value === 'set-department') view = 'set-department';
          else if (item.value === 'clear-department') void clearDepartment(selectedEmployee!.name);
          else if (item.value === 'set-manager') view = 'set-manager';
          else if (item.value === 'clear-manager') void clearManager(selectedEmployee!.name);
        }}
      />
    </Box>
    <Text text="Escape back to the employee list" color={inkSoft} dim />
  </Panel>
{:else if view === 'set-department' && selectedEmployee}
  <Panel title={`Org Chart — ${selectedEmployee.name} — department`} focused>
    <TextInput bind:value={fieldInput} focused onSubmit={() => { if (fieldInput.trim()) void assignDepartment(selectedEmployee!.name, fieldInput.trim()); }} />
    {#if error}<Text text={error} color="red" />{/if}
    <Text text="Type an existing department's exact name · Enter assigns · Escape cancels" color={inkSoft} dim />
  </Panel>
{:else if view === 'set-manager' && selectedEmployee}
  <Panel title={`Org Chart — ${selectedEmployee.name} — manager`} focused>
    <TextInput bind:value={fieldInput} focused onSubmit={() => { if (fieldInput.trim()) void assignManager(selectedEmployee!.name, fieldInput.trim()); }} />
    {#if error}<Text text={error} color="red" />{/if}
    <Text text="Type the employee this person reports to · Enter assigns · Escape cancels" color={inkSoft} dim />
  </Panel>
{/if}
