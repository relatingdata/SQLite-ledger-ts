<!--
  A TUI port of the Business Structure popup's "Item Categories" step
  (frontend/src/lib/components/BusinessStructurePopup.svelte's
  categoryTree, rendered on the web via StructureTreeNode.svelte's
  indented tree). Category is a pure, optional Hierarchy of tags on
  items (see docs/pm-domain-reference.md) - a value can itself be
  tagged under a further value of the same grouping, to any depth. A
  terminal can't usefully draw an indented recursive tree alongside
  everything else on screen, so this is a drill-down list instead:
  each level shows the categories directly under the current one (or,
  at the top, every top-level category), Enter walks one level
  deeper, Escape climbs back out.
-->
<script lang="ts">
  import { Text } from 'sveltui';
  import { keyboard } from 'sveltui';
  import { onDestroy } from 'svelte';
  import {
    ApiError,
    createHierarchyGrouping,
    createHierarchyValue,
    deleteHierarchyValue,
    getHierarchy,
    getHierarchyAssignments,
  } from '../api.ts';
  import Panel from '../components/Panel.svelte';
  import TextInput from '../components/TextInput.svelte';
  import { brass, ink, inkSoft } from '../theme.ts';

  const CATEGORY = 'Category';
  const ROOT = '__root__';

  type View = 'list' | 'new';

  let { businessName, onBack }: { businessName: string; onBack: () => void } = $props();

  let categoryValues: string[] = $state([]);
  let categoryParents: Record<string, string> = $state({});
  let error: string | null = $state(null);
  let busy = $state(false);
  let loaded = $state(false);

  let path: string[] = $state([]);
  let selected = $state(0);
  let view: View = $state('list');
  let newCategoryName = $state('');

  async function refresh(): Promise<void> {
    try {
      const [h, assignments] = await Promise.all([getHierarchy(businessName), getHierarchyAssignments(CATEGORY)]);
      categoryValues = h.find((g) => g.grouping === CATEGORY)?.values ?? [];
      categoryParents = assignments;
      error = null;
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not load item categories.';
    } finally {
      loaded = true;
    }
  }
  void refresh();

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

  const currentParent = $derived(path.length > 0 ? path[path.length - 1]! : ROOT);
  const currentChildren = $derived(childrenOf(currentParent));

  const unsubscribe = keyboard.on((event) => {
    if (event.key === 'Escape') {
      if (view === 'new') { view = 'list'; return true; }
      if (path.length > 0) {
        path = path.slice(0, -1);
        selected = 0;
        return true;
      }
      onBack();
      return true;
    }
    if (view !== 'list') return;
    switch (event.key) {
      case 'ArrowDown':
        selected = Math.min(selected + 1, Math.max(currentChildren.length - 1, 0));
        return true;
      case 'ArrowUp':
        selected = Math.max(selected - 1, 0);
        return true;
      case 'Enter':
        if (currentChildren[selected]) {
          path = [...path, currentChildren[selected]];
          selected = 0;
        }
        return true;
      default:
        if (event.key === 'i') { newCategoryName = ''; view = 'new'; return true; }
        if (event.key === 'd' && currentChildren[selected]) { void removeCategory(currentChildren[selected]); return true; }
        return false;
    }
  });
  onDestroy(unsubscribe);

  async function removeCategory(name: string) {
    busy = true; error = null;
    try {
      await deleteHierarchyValue(businessName, CATEGORY, name);
      selected = 0;
      await refresh();
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not delete that category.';
    } finally { busy = false; }
  }

  async function addCategory() {
    const name = newCategoryName.trim();
    if (!name) { view = 'list'; return; }
    busy = true; error = null;
    try {
      await createHierarchyGrouping(businessName, CATEGORY);
      await createHierarchyValue(businessName, CATEGORY, name, path.length > 0 ? path[path.length - 1] : undefined);
      await refresh();
      view = 'list';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not create that category.';
      view = 'list';
    } finally { busy = false; }
  }

  const title = $derived(path.length > 0 ? `Item Categories — ${businessName} — ${path.join(' › ')}` : `Item Categories — ${businessName}`);
</script>

{#if error && !loaded}
  <Panel title="Item Categories"><Text text={error} color="red" /></Panel>
{:else if !loaded}
  <Panel title="Item Categories"><Text text="Loading…" color={inkSoft} /></Panel>
{:else if view === 'new'}
  <Panel title={`${title} — new category`} focused>
    <TextInput bind:value={newCategoryName} focused onSubmit={() => void addCategory()} />
    {#if error}<Text text={error} color="red" />{/if}
    {#if busy}<Text text="Working…" color={inkSoft} />{/if}
    <Text text={`Enter creates it ${path.length > 0 ? `under "${path[path.length - 1]}"` : 'at the top level'} · Escape cancels`} color={inkSoft} dim />
  </Panel>
{:else}
  <Panel title={title} focused>
    {#if currentChildren.length === 0}
      <Text text="No categories here yet — press I to add one." color={inkSoft} />
    {/if}
    {#each currentChildren as name, i (name)}
      {@const count = childrenOf(name).length}
      <Text text={`${i === selected ? '› ' : '  '}${name}${count > 0 ? ` (${count})` : ''}`} color={i === selected ? brass : ink} />
    {/each}
    {#if error}<Text text={error} color="red" />{/if}
    {#if busy}<Text text="Working…" color={inkSoft} />{/if}
    <Text
      text={`↑/↓ highlight · Enter drill in · I add a category here · D delete highlighted${path.length === 0 ? ' · ←/→ Org Chart / Other Hierarchies' : ''} · Escape back${path.length > 0 ? ' a level' : ' to menu'}`}
      color={inkSoft}
      dim
    />
  </Panel>
{/if}
