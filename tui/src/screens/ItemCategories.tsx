// A TUI port of the Business Structure popup's "Item Categories" step
// (frontend/src/lib/components/BusinessStructurePopup.svelte's
// categoryTree, rendered on the web via StructureTreeNode.svelte's
// indented tree). Category is a pure, optional Hierarchy of tags on
// items (see docs/pm-domain-reference.md) — a value can itself be
// tagged under a further value of the same grouping, to any depth. A
// terminal can't usefully draw an indented recursive tree alongside
// everything else on screen, so this is a drill-down list instead:
// each level shows the categories directly under the current one (or,
// at the top, every top-level category), Enter walks one level
// deeper, Escape climbs back out. Same endpoints, same payload shapes
// — see tui/src/api.ts.
//
// Deliberately out of scope for this v1 screen, consistent with this
// TUI's other stated simplifications (docs/tui-design.md): moving a
// category to a different parent ("Move…" on the web). Create/browse/
// delete are real; re-parenting an existing category is not yet here.
import React, { useEffect, useState } from 'react';
import { Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import {
  ApiError,
  createHierarchyGrouping,
  createHierarchyValue,
  deleteHierarchyValue,
  getHierarchy,
  getHierarchyAssignments,
} from '../api.js';
import { Panel } from '../components/Panel.js';
import { brass, ink, inkSoft } from '../theme.js';

const CATEGORY = 'Category';
const ROOT = '__root__';

type View = 'list' | 'new';

export function ItemCategories({ businessName, onBack }: { businessName: string; onBack: () => void }) {
  const [categoryValues, setCategoryValues] = useState<string[]>([]);
  const [categoryParents, setCategoryParents] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [path, setPath] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);
  const [view, setView] = useState<View>('list');
  const [newCategoryName, setNewCategoryName] = useState('');

  async function refresh(): Promise<void> {
    try {
      const [h, assignments] = await Promise.all([getHierarchy(businessName), getHierarchyAssignments(CATEGORY)]);
      setCategoryValues(h.find((g) => g.grouping === CATEGORY)?.values ?? []);
      setCategoryParents(assignments);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load item categories.');
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    void refresh();
  }, [businessName]);

  function childrenOf(parentKey: string): string[] {
    const valueSet = new Set(categoryValues);
    return categoryValues
      .filter((name) => {
        const parent = categoryParents[name];
        const bucket = parent && valueSet.has(parent) ? parent : ROOT;
        return bucket === parentKey;
      })
      .sort((a, b) => a.localeCompare(b));
  }

  const currentParent = path.length > 0 ? path[path.length - 1]! : ROOT;
  const currentChildren = childrenOf(currentParent);

  useInput((input, key) => {
    if (key.escape) {
      if (view === 'new') return setView('list');
      if (path.length > 0) {
        setPath((p) => p.slice(0, -1));
        setSelected(0);
        return;
      }
      return onBack();
    }
    if (view !== 'list') return;
    if (key.downArrow) setSelected((s) => Math.min(s + 1, Math.max(currentChildren.length - 1, 0)));
    if (key.upArrow) setSelected((s) => Math.max(s - 1, 0));
    if (key.return && currentChildren[selected]) {
      setPath((p) => [...p, currentChildren[selected]!]);
      setSelected(0);
    }
    if (input === 'i') {
      setNewCategoryName('');
      setView('new');
    }
    if (input === 'd' && currentChildren[selected]) void removeCategory(currentChildren[selected]!);
  });

  async function removeCategory(name: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteHierarchyValue(businessName, CATEGORY, name);
      setSelected(0);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete that category.');
    } finally {
      setBusy(false);
    }
  }

  async function addCategory() {
    const name = newCategoryName.trim();
    if (!name) return setView('list');
    setBusy(true);
    setError(null);
    try {
      await createHierarchyGrouping(businessName, CATEGORY);
      await createHierarchyValue(businessName, CATEGORY, name, path.length > 0 ? path[path.length - 1] : undefined);
      await refresh();
      setView('list');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create that category.');
      setView('list');
    } finally {
      setBusy(false);
    }
  }

  const title = path.length > 0 ? `Item Categories — ${businessName} — ${path.join(' › ')}` : `Item Categories — ${businessName}`;

  if (error && !loaded) return <Panel title="Item Categories"><Text color="red">{error}</Text></Panel>;
  if (!loaded) return <Panel title="Item Categories"><Text color={inkSoft}>Loading…</Text></Panel>;

  if (view === 'new') {
    return (
      <Panel title={`${title} — new category`} focused>
        <TextInput value={newCategoryName} onChange={setNewCategoryName} onSubmit={() => void addCategory()} />
        {error && <Text color="red">{error}</Text>}
        {busy && <Text color={inkSoft}>Working…</Text>}
        <Text color={inkSoft} dimColor>
          Enter creates it {path.length > 0 ? `under "${path[path.length - 1]}"` : 'at the top level'} · Escape cancels
        </Text>
      </Panel>
    );
  }

  return (
    <Panel title={title} focused>
      {currentChildren.length === 0 && <Text color={inkSoft}>No categories here yet — press I to add one.</Text>}
      {currentChildren.map((name, i) => {
        const count = childrenOf(name).length;
        return (
          <Text key={name} color={i === selected ? brass : ink}>
            {i === selected ? '› ' : '  '}{name}
            {count > 0 ? ` (${count})` : ''}
          </Text>
        );
      })}
      {error && <Text color="red">{error}</Text>}
      {busy && <Text color={inkSoft}>Working…</Text>}
      <Text color={inkSoft} dimColor>
        ↑/↓ highlight · Enter drill in · I add a category here · D delete highlighted{path.length === 0 ? ' · ←/→ Org Chart / Other Hierarchies' : ''} · Escape back{path.length > 0 ? ' a level' : ' to menu'}
      </Text>
    </Panel>
  );
}
