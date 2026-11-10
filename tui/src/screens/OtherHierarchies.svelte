<!--
  A TUI port of the Business Structure popup's "Other Hierarchies" step
  (frontend/src/lib/components/BusinessStructurePopup.svelte's
  hierarchiesTree - any Hierarchy grouping other than Division or
  Category, each a flat list of values, never nested further here).
  Same real, generic Hierarchy primitives as Division and Item
  Category (backend/src/routes/hierarchy.ts) - most businesses never
  need this at all. Same endpoints, same payload shapes - see
  tui/src/api.ts.
-->
<script lang="ts">
  import { Text } from 'sveltui';
  import { keyboard } from 'sveltui';
  import { onDestroy } from 'svelte';
  import { ApiError, createHierarchyGrouping, createHierarchyValue, deleteHierarchyGrouping, deleteHierarchyValue, getHierarchy, type HierarchyGroupingWithValues } from '../api.ts';
  import Panel from '../components/Panel.svelte';
  import TextInput from '../components/TextInput.svelte';
  import { brass, ink, inkSoft } from '../theme.ts';

  const DIVISION = 'Division';
  const CATEGORY = 'Category';

  type View = 'groupings' | 'new-grouping' | 'values' | 'new-value';

  let { businessName, onBack }: { businessName: string; onBack: () => void } = $props();

  let groupings: HierarchyGroupingWithValues[] = $state([]);
  let error: string | null = $state(null);
  let busy = $state(false);
  let loaded = $state(false);

  let view: View = $state('groupings');
  let groupingSelected = $state(0);
  let selectedGroupingName: string | null = $state(null);
  let valueSelected = $state(0);
  let newGroupingName = $state('');
  let newValueName = $state('');

  async function refresh(): Promise<void> {
    try {
      const h = await getHierarchy(businessName);
      groupings = h.filter((g) => g.grouping !== DIVISION && g.grouping !== CATEGORY).sort((a, b) => a.grouping.localeCompare(b.grouping));
      error = null;
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not load hierarchies.';
    } finally {
      loaded = true;
    }
  }
  void refresh();

  const currentGrouping = $derived(groupings.find((g) => g.grouping === selectedGroupingName) ?? null);
  const currentValues = $derived(currentGrouping ? currentGrouping.values.slice().sort((a, b) => a.localeCompare(b)) : []);

  const unsubscribe = keyboard.on((event) => {
    if (event.key === 'Escape') {
      if (view === 'new-grouping') { view = 'groupings'; return true; }
      if (view === 'new-value') { view = 'values'; return true; }
      if (view === 'values') { view = 'groupings'; return true; }
      onBack();
      return true;
    }
    if (view === 'groupings') {
      switch (event.key) {
        case 'ArrowDown':
          groupingSelected = Math.min(groupingSelected + 1, Math.max(groupings.length - 1, 0));
          return true;
        case 'ArrowUp':
          groupingSelected = Math.max(groupingSelected - 1, 0);
          return true;
        case 'Enter':
          if (groupings[groupingSelected]) {
            selectedGroupingName = groupings[groupingSelected].grouping;
            valueSelected = 0;
            view = 'values';
          }
          return true;
        default:
          if (event.key === 'i') { newGroupingName = ''; view = 'new-grouping'; return true; }
          if (event.key === 'd' && groupings[groupingSelected]) { void removeGrouping(groupings[groupingSelected].grouping); return true; }
          return false;
      }
    }
    if (view === 'values' && currentGrouping) {
      switch (event.key) {
        case 'ArrowDown':
          valueSelected = Math.min(valueSelected + 1, Math.max(currentValues.length - 1, 0));
          return true;
        case 'ArrowUp':
          valueSelected = Math.max(valueSelected - 1, 0);
          return true;
        default:
          if (event.key === 'i') { newValueName = ''; view = 'new-value'; return true; }
          if (event.key === 'd' && currentValues[valueSelected]) { void removeValue(currentGrouping.grouping, currentValues[valueSelected]); return true; }
          return false;
      }
    }
  });
  onDestroy(unsubscribe);

  async function removeGrouping(name: string) {
    busy = true; error = null;
    try {
      await deleteHierarchyGrouping(businessName, name);
      groupingSelected = 0;
      await refresh();
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not delete that hierarchy.';
    } finally { busy = false; }
  }

  async function removeValue(groupingName: string, valueName: string) {
    busy = true; error = null;
    try {
      await deleteHierarchyValue(businessName, groupingName, valueName);
      valueSelected = 0;
      await refresh();
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not delete that value.';
    } finally { busy = false; }
  }

  async function addGrouping() {
    const name = newGroupingName.trim();
    if (!name) { view = 'groupings'; return; }
    busy = true; error = null;
    try {
      await createHierarchyGrouping(businessName, name);
      await refresh();
      view = 'groupings';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not create that hierarchy.';
      view = 'groupings';
    } finally { busy = false; }
  }

  async function addValue() {
    const name = newValueName.trim();
    if (!name || !currentGrouping) { view = 'values'; return; }
    busy = true; error = null;
    try {
      await createHierarchyValue(businessName, currentGrouping.grouping, name);
      await refresh();
      view = 'values';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not create that value.';
      view = 'values';
    } finally { busy = false; }
  }
</script>

{#if error && !loaded}
  <Panel title="Other Hierarchies"><Text text={error} color="red" /></Panel>
{:else if !loaded}
  <Panel title="Other Hierarchies"><Text text="Loading…" color={inkSoft} /></Panel>
{:else if view === 'groupings' || view === 'new-grouping'}
  <Panel title={`Other Hierarchies — ${businessName}`} focused>
    {#if groupings.length === 0 && view === 'groupings'}
      <Text text="No other hierarchies yet — press I to add one." color={inkSoft} />
    {/if}
    {#if view === 'groupings'}
      {#each groupings as g, i (g.grouping)}
        <Text text={`${i === groupingSelected ? '› ' : '  '}${g.grouping} (${g.values.length})`} color={i === groupingSelected ? brass : ink} />
      {/each}
    {/if}
    {#if view === 'new-grouping'}
      <TextInput bind:value={newGroupingName} focused onSubmit={() => void addGrouping()} />
      <Text text="Enter creates it · Escape cancels" color={inkSoft} dim />
    {/if}
    {#if error}<Text text={error} color="red" />{/if}
    {#if busy}<Text text="Working…" color={inkSoft} />{/if}
    {#if view === 'groupings'}
      <Text text="↑/↓ highlight · Enter open · I add a hierarchy · D delete highlighted · ←/→ Org Chart / Item Categories · Escape back to menu" color={inkSoft} dim />
    {/if}
  </Panel>
{:else if (view === 'values' || view === 'new-value') && currentGrouping}
  <Panel title={`Other Hierarchies — ${businessName} — ${currentGrouping.grouping}`} focused>
    {#if view === 'values' && currentValues.length === 0}
      <Text text="No values yet — press I to add one." color={inkSoft} />
    {/if}
    {#if view === 'values'}
      {#each currentValues as v, i (v)}
        <Text text={`${i === valueSelected ? '› ' : '  '}${v}`} color={i === valueSelected ? brass : ink} />
      {/each}
    {/if}
    {#if view === 'new-value'}
      <TextInput bind:value={newValueName} focused onSubmit={() => void addValue()} />
      <Text text="Enter creates it · Escape cancels" color={inkSoft} dim />
    {/if}
    {#if error}<Text text={error} color="red" />{/if}
    {#if busy}<Text text="Working…" color={inkSoft} />{/if}
    {#if view === 'values'}
      <Text text="↑/↓ highlight · I add a value · D delete highlighted · Escape back" color={inkSoft} dim />
    {/if}
  </Panel>
{/if}
