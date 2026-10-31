// A TUI port of the Business Structure popup's Org Chart step
// (frontend/src/lib/components/BusinessStructurePopup.svelte +
// OrgChartNode.svelte) — real Departments, each a genuine, postable
// CoA cost-center, with Employees assigned into them and an
// independent "reports to" manager link. The web app draws this as a
// typed-box diagram with connector lines; a terminal can't usefully
// draw that, so this screen keeps the same real data and operations
// (create/delete Department, assign/clear Employee Department and
// Manager) as a drill-down list instead — Departments and an
// "Unassigned" bucket at the top, each bucket's Employees underneath,
// each Employee's own two independent assignments one level further
// in. Same endpoints, same payload shapes — see tui/src/api.ts.
import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import {
  ApiError,
  createDepartment,
  deleteDepartment,
  deleteEmployeeDepartment,
  deleteEmployeeManager,
  getOrgChartStructure,
  setEmployeeDepartment,
  setEmployeeManager,
  type OrgChartEmployee,
  type OrgChartStructure,
} from '../api.js';
import { Panel } from '../components/Panel.js';
import { brass, ink, inkSoft } from '../theme.js';

type View = 'buckets' | 'new-department' | 'employees' | 'employee-actions' | 'set-department' | 'set-manager';

const UNASSIGNED = '__unassigned__';

export function OrgChart({ businessName, onBack }: { businessName: string; onBack: () => void }) {
  const [data, setData] = useState<OrgChartStructure | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [view, setView] = useState<View>('buckets');
  const [bucketSelected, setBucketSelected] = useState(0);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [employeeSelected, setEmployeeSelected] = useState(0);
  const [selectedEmployee, setSelectedEmployee] = useState<OrgChartEmployee | null>(null);

  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [fieldInput, setFieldInput] = useState('');

  function findEmployee(structure: OrgChartStructure, name: string): OrgChartEmployee | null {
    for (const dep of structure.departments) {
      const found = dep.employees.find((e) => e.name === name);
      if (found) return found;
    }
    return structure.unassignedEmployees.find((e) => e.name === name) ?? null;
  }

  // Refreshes the real org-chart data from the server, and — if an
  // employee is currently open on screen — re-syncs that employee's
  // own snapshot from the fresh data too. Without this second step,
  // a mutation (clear manager, say) would succeed on the server but
  // still show the employee's old, stale department/manager on this
  // same screen, since selectedEmployee is its own, separate bit of
  // state, not derived from `data` on every render.
  async function refresh(resyncEmployeeName?: string): Promise<OrgChartStructure | null> {
    try {
      const fresh = await getOrgChartStructure(businessName);
      setData(fresh);
      setError(null);
      if (resyncEmployeeName) setSelectedEmployee(findEmployee(fresh, resyncEmployeeName));
      return fresh;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the org chart.');
      return null;
    }
  }

  useEffect(() => {
    void refresh();
  }, [businessName]);

  const buckets = data
    ? [...data.departments.map((d) => ({ key: d.name, label: `${d.name} (${d.employees.length})`, employees: d.employees })),
       { key: UNASSIGNED, label: `Unassigned (${data.unassignedEmployees.length})`, employees: data.unassignedEmployees }]
    : [];
  const currentBucket = buckets.find((b) => b.key === selectedBucket) ?? null;

  useInput((input, key) => {
    if (key.escape) {
      if (view === 'buckets') return onBack();
      if (view === 'new-department') return setView('buckets');
      if (view === 'employees') return setView('buckets');
      if (view === 'employee-actions') return setView('employees');
      if (view === 'set-department' || view === 'set-manager') return setView('employee-actions');
      return;
    }
    if (view === 'buckets' && data) {
      if (key.downArrow) setBucketSelected((s) => Math.min(s + 1, buckets.length - 1));
      if (key.upArrow) setBucketSelected((s) => Math.max(s - 1, 0));
      if (key.return) {
        const bucket = buckets[bucketSelected];
        if (bucket) {
          setSelectedBucket(bucket.key);
          setEmployeeSelected(0);
          setView('employees');
        }
      }
      if (input === 'i') {
        setNewDepartmentName('');
        setView('new-department');
      }
      if (input === 'd') {
        const bucket = buckets[bucketSelected];
        if (bucket && bucket.key !== UNASSIGNED) void removeDepartment(bucket.key);
      }
    }
    if (view === 'employees' && currentBucket) {
      if (key.downArrow) setEmployeeSelected((s) => Math.min(s + 1, Math.max(currentBucket.employees.length - 1, 0)));
      if (key.upArrow) setEmployeeSelected((s) => Math.max(s - 1, 0));
      if (key.return && currentBucket.employees[employeeSelected]) {
        setSelectedEmployee(currentBucket.employees[employeeSelected]);
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
      void refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete that department.');
    } finally {
      setBusy(false);
    }
  }

  async function addDepartment() {
    const name = newDepartmentName.trim();
    if (!name) {
      setView('buckets');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createDepartment(businessName, name);
      void refresh();
      setView('buckets');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create that department.');
      setView('buckets');
    } finally {
      setBusy(false);
    }
  }

  async function assignDepartment(employeeName: string, departmentName: string) {
    setBusy(true);
    setError(null);
    try {
      await setEmployeeDepartment(employeeName, departmentName);
      await refresh(employeeName);
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
      await refresh(employeeName);
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
      await refresh(employeeName);
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
      await refresh(employeeName);
      setView('employee-actions');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not clear that manager.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <Panel title="Org Chart"><Text color="red">{error}</Text></Panel>;
  if (!data) return <Panel title="Org Chart"><Text color={inkSoft}>Loading…</Text></Panel>;

  if (view === 'buckets') {
    return (
      <Panel title={`Org Chart — ${businessName}`} focused>
        {buckets.length === 0 && <Text color={inkSoft}>No departments yet — press I to add one.</Text>}
        {buckets.map((b, i) => (
          <Text key={b.key} color={i === bucketSelected ? brass : ink}>
            {i === bucketSelected ? '› ' : '  '}{b.label}
          </Text>
        ))}
        {error && <Text color="red">{error}</Text>}
        {busy && <Text color={inkSoft}>Working…</Text>}
        <Text color={inkSoft} dimColor>
          ↑/↓ highlight · Enter open a bucket · I add department · D delete highlighted department · Escape back to menu
        </Text>
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

  if (view === 'employees' && currentBucket) {
    return (
      <Panel title={`Org Chart — ${businessName} — ${currentBucket.label}`} focused>
        {currentBucket.employees.length === 0 && <Text color={inkSoft}>No employees in this bucket.</Text>}
        {currentBucket.employees.map((e, i) => (
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
    const inDepartment = selectedBucket !== UNASSIGNED;
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
