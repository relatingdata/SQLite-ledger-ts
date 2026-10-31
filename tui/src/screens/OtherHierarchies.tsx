// A TUI port of the Business Structure popup's "Other Hierarchies" step
// (frontend/src/lib/components/BusinessStructurePopup.svelte's
// hierarchiesTree — any Hierarchy grouping other than Division or
// Category, each a flat list of values, never nested further here).
// Same real, generic Hierarchy primitives as Division and Item
// Category (backend/src/routes/hierarchy.ts) — most businesses never
// need this at all. Same endpoints, same payload shapes — see
// tui/src/api.ts.
import React, { useEffect, useState } from 'react';
import { Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { ApiError, createHierarchyGrouping, createHierarchyValue, deleteHierarchyGrouping, deleteHierarchyValue, getHierarchy, type HierarchyGroupingWithValues } from '../api.js';
import { Panel } from '../components/Panel.js';
import { brass, ink, inkSoft } from '../theme.js';

const DIVISION = 'Division';
const CATEGORY = 'Category';

type View = 'groupings' | 'new-grouping' | 'values' | 'new-value';

export function OtherHierarchies({ businessName, onBack }: { businessName: string; onBack: () => void }) {
  const [groupings, setGroupings] = useState<HierarchyGroupingWithValues[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [view, setView] = useState<View>('groupings');
  const [groupingSelected, setGroupingSelected] = useState(0);
  const [selectedGrouping, setSelectedGrouping] = useState<string | null>(null);
  const [valueSelected, setValueSelected] = useState(0);
  const [newGroupingName, setNewGroupingName] = useState('');
  const [newValueName, setNewValueName] = useState('');

  async function refresh(): Promise<void> {
    try {
      const h = await getHierarchy(businessName);
      setGroupings(h.filter((g) => g.grouping !== DIVISION && g.grouping !== CATEGORY).sort((a, b) => a.grouping.localeCompare(b.grouping)));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load hierarchies.');
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    void refresh();
  }, [businessName]);

  const currentGrouping = groupings.find((g) => g.grouping === selectedGrouping) ?? null;
  const currentValues = currentGrouping ? currentGrouping.values.slice().sort((a, b) => a.localeCompare(b)) : [];

  useInput((input, key) => {
    if (key.escape) {
      if (view === 'new-grouping') return setView('groupings');
      if (view === 'new-value') return setView('values');
      if (view === 'values') return setView('groupings');
      return onBack();
    }
    if (view === 'groupings') {
      if (key.downArrow) setGroupingSelected((s) => Math.min(s + 1, Math.max(groupings.length - 1, 0)));
      if (key.upArrow) setGroupingSelected((s) => Math.max(s - 1, 0));
      if (key.return && groupings[groupingSelected]) {
        setSelectedGrouping(groupings[groupingSelected]!.grouping);
        setValueSelected(0);
        setView('values');
      }
      if (input === 'i') {
        setNewGroupingName('');
        setView('new-grouping');
      }
      if (input === 'd' && groupings[groupingSelected]) void removeGrouping(groupings[groupingSelected]!.grouping);
    }
    if (view === 'values' && currentGrouping) {
      if (key.downArrow) setValueSelected((s) => Math.min(s + 1, Math.max(currentValues.length - 1, 0)));
      if (key.upArrow) setValueSelected((s) => Math.max(s - 1, 0));
      if (input === 'i') {
        setNewValueName('');
        setView('new-value');
      }
      if (input === 'd' && currentValues[valueSelected]) void removeValue(currentGrouping.grouping, currentValues[valueSelected]!);
    }
  });

  async function removeGrouping(name: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteHierarchyGrouping(businessName, name);
      setGroupingSelected(0);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete that hierarchy.');
    } finally {
      setBusy(false);
    }
  }

  async function removeValue(groupingName: string, valueName: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteHierarchyValue(businessName, groupingName, valueName);
      setValueSelected(0);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete that value.');
    } finally {
      setBusy(false);
    }
  }

  async function addGrouping() {
    const name = newGroupingName.trim();
    if (!name) return setView('groupings');
    setBusy(true);
    setError(null);
    try {
      await createHierarchyGrouping(businessName, name);
      await refresh();
      setView('groupings');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create that hierarchy.');
      setView('groupings');
    } finally {
      setBusy(false);
    }
  }

  async function addValue() {
    const name = newValueName.trim();
    if (!name || !currentGrouping) return setView('values');
    setBusy(true);
    setError(null);
    try {
      await createHierarchyValue(businessName, currentGrouping.grouping, name);
      await refresh();
      setView('values');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create that value.');
      setView('values');
    } finally {
      setBusy(false);
    }
  }

  if (error && !loaded) return <Panel title="Other Hierarchies"><Text color="red">{error}</Text></Panel>;
  if (!loaded) return <Panel title="Other Hierarchies"><Text color={inkSoft}>Loading…</Text></Panel>;

  if (view === 'groupings' || view === 'new-grouping') {
    return (
      <Panel title={`Other Hierarchies — ${businessName}`} focused>
        {groupings.length === 0 && view === 'groupings' && <Text color={inkSoft}>No other hierarchies yet — press I to add one.</Text>}
        {view === 'groupings' &&
          groupings.map((g, i) => (
            <Text key={g.grouping} color={i === groupingSelected ? brass : ink}>
              {i === groupingSelected ? '› ' : '  '}{g.grouping} ({g.values.length})
            </Text>
          ))}
        {view === 'new-grouping' && (
          <>
            <TextInput value={newGroupingName} onChange={setNewGroupingName} onSubmit={() => void addGrouping()} />
            <Text color={inkSoft} dimColor>Enter creates it · Escape cancels</Text>
          </>
        )}
        {error && <Text color="red">{error}</Text>}
        {busy && <Text color={inkSoft}>Working…</Text>}
        {view === 'groupings' && (
          <Text color={inkSoft} dimColor>
            ↑/↓ highlight · Enter open · I add a hierarchy · D delete highlighted · ←/→ Org Chart / Item Categories · Escape back to menu
          </Text>
        )}
      </Panel>
    );
  }

  if ((view === 'values' || view === 'new-value') && currentGrouping) {
    return (
      <Panel title={`Other Hierarchies — ${businessName} — ${currentGrouping.grouping}`} focused>
        {view === 'values' && currentValues.length === 0 && <Text color={inkSoft}>No values yet — press I to add one.</Text>}
        {view === 'values' &&
          currentValues.map((v, i) => (
            <Text key={v} color={i === valueSelected ? brass : ink}>
              {i === valueSelected ? '› ' : '  '}{v}
            </Text>
          ))}
        {view === 'new-value' && (
          <>
            <TextInput value={newValueName} onChange={setNewValueName} onSubmit={() => void addValue()} />
            <Text color={inkSoft} dimColor>Enter creates it · Escape cancels</Text>
          </>
        )}
        {error && <Text color="red">{error}</Text>}
        {busy && <Text color={inkSoft}>Working…</Text>}
        {view === 'values' && (
          <Text color={inkSoft} dimColor>
            ↑/↓ highlight · I add a value · D delete highlighted · Escape back
          </Text>
        )}
      </Panel>
    );
  }

  return null;
}
