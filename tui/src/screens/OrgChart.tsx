// A TUI port of the Business Structure popup's unified "Org Chart" step
// (frontend/src/lib/components/BusinessStructurePopup.svelte +
// OrgChartNode.svelte) — Locations, Divisions, Departments, and
// Employees, all together. The web app draws this as a typed-box
// diagram with connector lines; a terminal can't usefully draw that,
// so this screen keeps the same real data and operations (create/
// delete Location, create/delete Division, create/delete Department,
// move a Location between Divisions, assign/clear an Employee's
// Department and Manager) as a drill-down list instead — Divisions
// and Departments (plus their own "Unassigned" buckets) at the top,
// each bucket's Locations or Employees underneath. Same endpoints,
// same payload shapes — see tui/src/api.ts.
//
// A Location is a real, postable CoA account (matched to its own,
// same-named account node by name); a Division is a pure Hierarchy
// reporting tag with no account of its own — same distinction the web
// app's own code comments document. Deleting a Division value here
// only removes the tag/grouping value, never a Location.
import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
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
} from '../api.js';
import { Panel } from '../components/Panel.js';
import { brass, ink, inkSoft } from '../theme.js';

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

export function OrgChart({ businessName, onBack }: { businessName: string; onBack: () => void }) {
  const [orgChart, setOrgChart] = useState<OrgChartStructure | null>(null);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [locationDivision, setLocationDivision] = useState<Record<string, string | null>>({});
  const [divisionValues, setDivisionValues] = useState<string[]>([]);
  const [locationTypes, setLocationTypes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [view, setView] = useState<View>('buckets');
  const [bucketSelected, setBucketSelected] = useState(0);
  const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null);
  const [locationSelected, setLocationSelected] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState<LocationRecord | null>(null);
  const [employeeSelected, setEmployeeSelected] = useState(0);
  const [selectedEmployee, setSelectedEmployee] = useState<OrgChartEmployee | null>(null);

  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [newDivisionName, setNewDivisionName] = useState('');
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationCity, setNewLocationCity] = useState('');
  const [newLocationType, setNewLocationType] = useState('Retail');
  const [newLocationBottle, setNewLocationBottle] = useState('');
  const [newLocationCarton, setNewLocationCarton] = useState('');
  const [fieldInput, setFieldInput] = useState('');

  function findEmployee(structure: OrgChartStructure, name: string): OrgChartEmployee | null {
    for (const dep of structure.departments) {
      const found = dep.employees.find((e) => e.name === name);
      if (found) return found;
    }
    return structure.unassignedEmployees.find((e) => e.name === name) ?? null;
  }

  // Refreshes every real data source this screen draws on (org chart,
  // locations, the Division grouping's values, each location's own
  // Division tag) in one pass — and, if an Employee or Location is
  // currently open on screen, re-syncs that item's own snapshot too, so
  // a mutation never leaves this screen showing stale data for an item
  // that isn't itself re-fetched from `data`/`locations` on every render.
  async function refresh(resync?: { employeeName?: string; locationName?: string }): Promise<void> {
    try {
      const biz = asBusinessName(businessName);
      const [chart, locs, hierarchy] = await Promise.all([getOrgChartStructure(businessName), listLocations(biz), getHierarchy(businessName)]);
      const tags = await Promise.all(locs.map((l) => getHierarchyTag(l.name, DIVISION).catch(() => ({ parentName: null }))));
      const divisionByLocation = Object.fromEntries(locs.map((l, i) => [l.name, tags[i]!.parentName]));
      setOrgChart(chart);
      setLocations(locs);
      setLocationDivision(divisionByLocation);
      setDivisionValues(hierarchy.find((h) => h.grouping === DIVISION)?.values ?? []);
      setError(null);
      if (resync?.employeeName) setSelectedEmployee(findEmployee(chart, resync.employeeName));
      if (resync?.locationName) setSelectedLocation(locs.find((l) => l.name === resync.locationName) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the org chart.');
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    void refresh();
    void getLocationTypes()
      .then((types) => types.length > 0 && setLocationTypes(types))
      .catch(() => {});
  }, [businessName]);

  const divisionBuckets: Bucket[] = divisionValues
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .map((v) => ({ key: v, kind: 'division', label: v, count: locations.filter((l) => locationDivision[l.name] === v).length }));
  divisionBuckets.push({
    key: UNASSIGNED_DIV,
    kind: 'division',
    label: 'Unassigned (no division)',
    count: locations.filter((l) => !locationDivision[l.name]).length,
  });
  const departmentBuckets: Bucket[] = orgChart
    ? [
        ...orgChart.departments.map((d) => ({ key: d.name, kind: 'department' as const, label: d.name, count: d.employees.length })),
        { key: UNASSIGNED_DEPT, kind: 'department' as const, label: 'Unassigned (no department)', count: orgChart.unassignedEmployees.length },
      ]
    : [];
  const buckets: Bucket[] = [...divisionBuckets, ...departmentBuckets];

  const bucketLocations: LocationRecord[] =
    selectedBucket?.kind === 'division'
      ? locations
          .filter((l) => (selectedBucket.key === UNASSIGNED_DIV ? !locationDivision[l.name] : locationDivision[l.name] === selectedBucket.key))
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];
  const bucketEmployees: OrgChartEmployee[] =
    selectedBucket?.kind === 'department'
      ? selectedBucket.key === UNASSIGNED_DEPT
        ? orgChart?.unassignedEmployees ?? []
        : orgChart?.departments.find((d) => d.name === selectedBucket.key)?.employees ?? []
      : [];

  useInput((input, key) => {
    if (key.escape) {
      if (view === 'buckets') return onBack();
      if (view === 'add-menu') return setView('buckets');
      if (view === 'new-department' || view === 'new-division') return setView('add-menu');
      if (view.startsWith('new-location-')) return setView('add-menu');
      if (view === 'locations') return setView('buckets');
      if (view === 'set-location-division') return setView('locations');
      if (view === 'employees') return setView('buckets');
      if (view === 'employee-actions') return setView('employees');
      if (view === 'set-department' || view === 'set-manager') return setView('employee-actions');
      return;
    }
    if (view === 'buckets' && orgChart) {
      if (key.downArrow) setBucketSelected((s) => Math.min(s + 1, buckets.length - 1));
      if (key.upArrow) setBucketSelected((s) => Math.max(s - 1, 0));
      if (key.return) {
        const bucket = buckets[bucketSelected];
        if (bucket) {
          setSelectedBucket(bucket);
          setLocationSelected(0);
          setEmployeeSelected(0);
          setView(bucket.kind === 'division' ? 'locations' : 'employees');
        }
      }
      if (input === 'i') setView('add-menu');
      if (input === 'd') {
        const bucket = buckets[bucketSelected];
        if (!bucket) return;
        if (bucket.kind === 'division' && bucket.key !== UNASSIGNED_DIV) void removeDivision(bucket.key);
        if (bucket.kind === 'department' && bucket.key !== UNASSIGNED_DEPT) void removeDepartment(bucket.key);
      }
    }
    if (view === 'locations' && selectedBucket) {
      if (key.downArrow) setLocationSelected((s) => Math.min(s + 1, Math.max(bucketLocations.length - 1, 0)));
      if (key.upArrow) setLocationSelected((s) => Math.max(s - 1, 0));
      if (key.return && bucketLocations[locationSelected]) {
        setSelectedLocation(bucketLocations[locationSelected]!);
        setView('set-location-division');
      }
      if (input === 'd' && bucketLocations[locationSelected]) void removeLocation(bucketLocations[locationSelected]!.name);
    }
    if (view === 'employees' && selectedBucket) {
      if (key.downArrow) setEmployeeSelected((s) => Math.min(s + 1, Math.max(bucketEmployees.length - 1, 0)));
      if (key.upArrow) setEmployeeSelected((s) => Math.max(s - 1, 0));
      if (key.return && bucketEmployees[employeeSelected]) {
        setSelectedEmployee(bucketEmployees[employeeSelected]!);
        setFieldInput('');
        setView('employee-actions');
      }
    }
  });

  async function removeDepartment(name: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteDepartment(businessName, name);
      setBucketSelected(0);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete that department.');
    } finally {
      setBusy(false);
    }
  }

  async function removeDivision(name: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteHierarchyValue(businessName, DIVISION, name);
      setBucketSelected(0);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete that division.');
    } finally {
      setBusy(false);
    }
  }

  async function removeLocation(name: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteLocation(name, businessName);
      setLocationSelected(0);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete that location.');
    } finally {
      setBusy(false);
    }
  }

  async function addDepartment() {
    const name = newDepartmentName.trim();
    if (!name) return setView('add-menu');
    setBusy(true);
    setError(null);
    try {
      await createDepartment(businessName, name);
      await refresh();
      setView('buckets');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create that department.');
      setView('add-menu');
    } finally {
      setBusy(false);
    }
  }

  async function addDivision() {
    const name = newDivisionName.trim();
    if (!name) return setView('add-menu');
    setBusy(true);
    setError(null);
    try {
      await createHierarchyGrouping(businessName, DIVISION);
      await createHierarchyValue(businessName, DIVISION, name);
      await refresh();
      setView('buckets');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create that division.');
      setView('add-menu');
    } finally {
      setBusy(false);
    }
  }

  function parseOptionalInt(s: string): number | null {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  async function addLocation() {
    const name = newLocationName.trim();
    if (!name) return setView('add-menu');
    setBusy(true);
    setError(null);
    try {
      await createLocation(name, businessName, {
        city: newLocationCity.trim(),
        location_type: newLocationType,
        is_billing_address: false,
        bottle_capacity: parseOptionalInt(newLocationBottle),
        carton_capacity: parseOptionalInt(newLocationCarton),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setNewLocationName('');
      setNewLocationCity('');
      setNewLocationType('Retail');
      setNewLocationBottle('');
      setNewLocationCarton('');
      await refresh();
      setView('buckets');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create that location.');
      setView('add-menu');
    } finally {
      setBusy(false);
    }
  }

  async function moveLocationDivision(locationName: string, divisionName: string | null) {
    setBusy(true);
    setError(null);
    try {
      if (divisionName) await setHierarchyTag(locationName, DIVISION, divisionName);
      else await deleteHierarchyTag(locationName, DIVISION);
      await refresh({ locationName });
      setView('locations');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not move that location.');
    } finally {
      setBusy(false);
    }
  }

  async function assignDepartment(employeeName: string, departmentName: string) {
    setBusy(true);
    setError(null);
    try {
      await setEmployeeDepartment(employeeName, departmentName);
      await refresh({ employeeName });
      setView('employees');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not assign that department.');
      setView('employee-actions');
    } finally {
      setBusy(false);
    }
  }

  async function clearDepartment(employeeName: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteEmployeeDepartment(employeeName);
      await refresh({ employeeName });
      setView('employees');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not clear that department.');
    } finally {
      setBusy(false);
    }
  }

  async function assignManager(employeeName: string, managerName: string) {
    setBusy(true);
    setError(null);
    try {
      await setEmployeeManager(employeeName, managerName);
      await refresh({ employeeName });
      setView('employee-actions');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not assign that manager.');
      setView('employee-actions');
    } finally {
      setBusy(false);
    }
  }

  async function clearManager(employeeName: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteEmployeeManager(employeeName);
      await refresh({ employeeName });
      setView('employee-actions');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not clear that manager.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !loaded) return <Panel title="Org Chart"><Text color="red">{error}</Text></Panel>;
  if (!loaded || !orgChart) return <Panel title="Org Chart"><Text color={inkSoft}>Loading…</Text></Panel>;

  if (view === 'buckets') {
    return (
      <Panel title={`Org Chart — ${businessName}`} focused>
        <Text color={inkSoft} dimColor>Divisions</Text>
        {divisionBuckets.map((b, i) => (
          <Text key={b.key} color={i === bucketSelected ? brass : ink}>
            {i === bucketSelected ? '› ' : '  '}{b.label} ({b.count})
          </Text>
        ))}
        <Text color={inkSoft} dimColor>Departments</Text>
        {departmentBuckets.map((b, i) => {
          const idx = divisionBuckets.length + i;
          return (
            <Text key={b.key} color={idx === bucketSelected ? brass : ink}>
              {idx === bucketSelected ? '› ' : '  '}{b.label} ({b.count})
            </Text>
          );
        })}
        {error && <Text color="red">{error}</Text>}
        {busy && <Text color={inkSoft}>Working…</Text>}
        <Text color={inkSoft} dimColor>
          ↑/↓ highlight · Enter open a bucket · I add Location/Division/Department · D delete highlighted (not Unassigned) · Escape back to menu
        </Text>
      </Panel>
    );
  }

  if (view === 'add-menu') {
    const items = [
      { label: 'New Location…', value: 'location' },
      { label: 'New Division…', value: 'division' },
      { label: 'New Department…', value: 'department' },
    ];
    return (
      <Panel title={`Org Chart — ${businessName} — add`} focused>
        <SelectInput
          items={items}
          onSelect={(item) => {
            if (item.value === 'location') {
              setNewLocationName('');
              setNewLocationCity('');
              setNewLocationType(locationTypes[0] ?? 'Retail');
              setNewLocationBottle('');
              setNewLocationCarton('');
              setView('new-location-name');
            } else if (item.value === 'division') {
              setNewDivisionName('');
              setView('new-division');
            } else {
              setNewDepartmentName('');
              setView('new-department');
            }
          }}
        />
        <Text color={inkSoft} dimColor>Escape cancels</Text>
      </Panel>
    );
  }

  if (view === 'new-department') {
    return (
      <Panel title={`Org Chart — ${businessName} — new department`} focused>
        <TextInput value={newDepartmentName} onChange={setNewDepartmentName} onSubmit={() => void addDepartment()} />
        {error && <Text color="red">{error}</Text>}
        <Text color={inkSoft} dimColor>
          Enter creates it (real CoA accounts are provisioned alongside it) · Escape cancels
        </Text>
      </Panel>
    );
  }

  if (view === 'new-division') {
    return (
      <Panel title={`Org Chart — ${businessName} — new division`} focused>
        <TextInput value={newDivisionName} onChange={setNewDivisionName} onSubmit={() => void addDivision()} />
        {error && <Text color="red">{error}</Text>}
        <Text color={inkSoft} dimColor>
          Enter creates it (a pure reporting tag — no account of its own) · Escape cancels
        </Text>
      </Panel>
    );
  }

  if (view === 'new-location-name') {
    return (
      <Panel title={`Org Chart — ${businessName} — new location — name`} focused>
        <TextInput value={newLocationName} onChange={setNewLocationName} onSubmit={() => newLocationName.trim() && setView('new-location-city')} />
        {error && <Text color="red">{error}</Text>}
        <Text color={inkSoft} dimColor>Enter continues · Escape cancels</Text>
      </Panel>
    );
  }

  if (view === 'new-location-city') {
    return (
      <Panel title={`Org Chart — ${businessName} — ${newLocationName} — city`} focused>
        <TextInput value={newLocationCity} onChange={setNewLocationCity} onSubmit={() => setView('new-location-type')} />
        {error && <Text color="red">{error}</Text>}
        <Text color={inkSoft} dimColor>Enter continues (blank is fine) · Escape cancels</Text>
      </Panel>
    );
  }

  if (view === 'new-location-type') {
    const items = (locationTypes.length > 0 ? locationTypes : ['Retail']).map((t) => ({ label: t, value: t }));
    return (
      <Panel title={`Org Chart — ${businessName} — ${newLocationName} — type`} focused>
        <SelectInput items={items} initialIndex={Math.max(items.findIndex((i) => i.value === newLocationType), 0)} onSelect={(item) => { setNewLocationType(item.value); setView('new-location-bottle'); }} />
        <Text color={inkSoft} dimColor>Escape cancels</Text>
      </Panel>
    );
  }

  if (view === 'new-location-bottle') {
    return (
      <Panel title={`Org Chart — ${businessName} — ${newLocationName} — bottle capacity`} focused>
        <TextInput value={newLocationBottle} onChange={setNewLocationBottle} onSubmit={() => setView('new-location-carton')} />
        {error && <Text color="red">{error}</Text>}
        <Text color={inkSoft} dimColor>Optional — Enter continues blank or with a number · Escape cancels</Text>
      </Panel>
    );
  }

  if (view === 'new-location-carton') {
    return (
      <Panel title={`Org Chart — ${businessName} — ${newLocationName} — carton capacity`} focused>
        <TextInput value={newLocationCarton} onChange={setNewLocationCarton} onSubmit={() => void addLocation()} />
        {error && <Text color="red">{error}</Text>}
        {busy && <Text color={inkSoft}>Working…</Text>}
        <Text color={inkSoft} dimColor>Optional — Enter creates the location · Escape cancels</Text>
      </Panel>
    );
  }

  if (view === 'locations' && selectedBucket) {
    return (
      <Panel title={`Org Chart — ${businessName} — ${selectedBucket.label}`} focused>
        {bucketLocations.length === 0 && <Text color={inkSoft}>No locations in this bucket.</Text>}
        {bucketLocations.map((l, i) => (
          // A single Text node, padded with plain string spacing rather
          // than fixed-width Boxes — a long, real location name (or a
          // test's own, deliberately unique one) would otherwise overflow
          // a fixed-width Box and wrap onto its own extra line, breaking
          // this row in two. Padding never truncates, so nothing is ever
          // lost — only alignment degrades for a name past the column.
          <Text key={l.name} color={i === locationSelected ? brass : ink}>
            {i === locationSelected ? '› ' : '  '}
            {l.name.padEnd(26)}
            <Text color={inkSoft}>{(l.city || '(no city)').padEnd(16)}{l.location_type}</Text>
          </Text>
        ))}
        {error && <Text color="red">{error}</Text>}
        {busy && <Text color={inkSoft}>Working…</Text>}
        <Text color={inkSoft} dimColor>
          ↑/↓ highlight · Enter move to another division · D delete highlighted location · Escape back
        </Text>
      </Panel>
    );
  }

  if (view === 'set-location-division' && selectedLocation) {
    const items = [
      { label: 'Unassigned (no division)', value: UNASSIGNED_DIV },
      ...divisionValues.map((v) => ({ label: v, value: v })),
    ];
    return (
      <Panel title={`Org Chart — ${selectedLocation.name} — division`} focused>
        <SelectInput items={items} onSelect={(item) => void moveLocationDivision(selectedLocation.name, item.value === UNASSIGNED_DIV ? null : item.value)} />
        {error && <Text color="red">{error}</Text>}
        {busy && <Text color={inkSoft}>Working…</Text>}
        <Text color={inkSoft} dimColor>Escape cancels</Text>
      </Panel>
    );
  }

  if (view === 'employees' && selectedBucket) {
    return (
      <Panel title={`Org Chart — ${businessName} — ${selectedBucket.label}`} focused>
        {bucketEmployees.length === 0 && <Text color={inkSoft}>No employees in this bucket.</Text>}
        {bucketEmployees.map((e, i) => (
          <Box key={e.name}>
            <Box width={22}>
              <Text color={i === employeeSelected ? brass : ink}>{i === employeeSelected ? '› ' : '  '}{e.name}</Text>
            </Box>
            <Box width={20}>
              <Text color={inkSoft}>{e.location ?? '(no location)'}</Text>
            </Box>
            <Text color={inkSoft}>reports to: {e.managerName ?? '(none)'}</Text>
          </Box>
        ))}
        {error && <Text color="red">{error}</Text>}
        <Text color={inkSoft} dimColor>
          ↑/↓ highlight · Enter manage an employee · Escape back
        </Text>
      </Panel>
    );
  }

  if (view === 'employee-actions' && selectedEmployee) {
    const inDepartment = selectedBucket?.key !== UNASSIGNED_DEPT;
    const items = [
      { label: 'Set / move department…', value: 'set-department' },
      ...(inDepartment ? [{ label: 'Clear department (unassign)', value: 'clear-department' }] : []),
      { label: 'Set manager…', value: 'set-manager' },
      ...(selectedEmployee.managerName ? [{ label: 'Clear manager', value: 'clear-manager' }] : []),
    ];
    return (
      <Panel title={`Org Chart — ${selectedEmployee.name}`} focused>
        <Text color={ink}>Location: {selectedEmployee.location ?? '(none)'}</Text>
        <Text color={ink}>Reports to: {selectedEmployee.managerName ?? '(none)'}</Text>
        {error && <Text color="red">{error}</Text>}
        {busy && <Text color={inkSoft}>Working…</Text>}
        <Box marginTop={1}>
          <SelectInput
            items={items}
            onSelect={(item) => {
              setFieldInput('');
              if (item.value === 'set-department') setView('set-department');
              else if (item.value === 'clear-department') void clearDepartment(selectedEmployee.name);
              else if (item.value === 'set-manager') setView('set-manager');
              else if (item.value === 'clear-manager') void clearManager(selectedEmployee.name);
            }}
          />
        </Box>
        <Text color={inkSoft} dimColor>
          Escape back to the employee list
        </Text>
      </Panel>
    );
  }

  if (view === 'set-department' && selectedEmployee) {
    return (
      <Panel title={`Org Chart — ${selectedEmployee.name} — department`} focused>
        <TextInput value={fieldInput} onChange={setFieldInput} onSubmit={() => fieldInput.trim() && void assignDepartment(selectedEmployee.name, fieldInput.trim())} />
        {error && <Text color="red">{error}</Text>}
        <Text color={inkSoft} dimColor>
          Type an existing department's exact name · Enter assigns · Escape cancels
        </Text>
      </Panel>
    );
  }

  if (view === 'set-manager' && selectedEmployee) {
    return (
      <Panel title={`Org Chart — ${selectedEmployee.name} — manager`} focused>
        <TextInput value={fieldInput} onChange={setFieldInput} onSubmit={() => fieldInput.trim() && void assignManager(selectedEmployee.name, fieldInput.trim())} />
        {error && <Text color="red">{error}</Text>}
        <Text color={inkSoft} dimColor>
          Type the employee this person reports to · Enter assigns · Escape cancels
        </Text>
      </Panel>
    );
  }

  return null;
}
