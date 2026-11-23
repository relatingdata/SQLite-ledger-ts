<!--
  A TUI port of the Business Structure popup's "Other Hierarchies" step
  (frontend/src/lib/components/BusinessStructurePopup.svelte's
  hierarchiesTree - any Hierarchy other than Division or
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
  import { ApiError, createHierarchy, createHierarchyValue, deleteHierarchy, deleteHierarchyValue, getHierarchy, firstHierarchyOf, type HierarchyWithValues } from '../api.ts';
  import Panel from '../components/Panel.svelte';
  import TextInput from '../components/TextInput.svelte';
  import { brass, ink, inkSoft } from '../theme.ts';


  type View = 'hierarchies' | 'new-hierarchy' | 'values' | 'new-value';

  let { businessName, onBack }: { businessName: string; onBack: () => void } = $props();

  let hierarchies: HierarchyWithValues[] = $state([]);
  let error: string | null = $state(null);
  let busy = $state(false);
  let loaded = $state(false);

  let view: View = $state('hierarchies');
  let groupingSelected = $state(0);
  let selectedHierarchyName: string | null = $state(null);
  let valueSelected = $state(0);
  let newHierarchyName = $state('');
  let newValueName = $state('');

  async function refresh(): Promise<void> {
    try {
      const h = await getHierarchy(businessName);
      // Every hierarchy except the first of each kind, which the Org Chart
      // and Item Categories screens show.
      const shown = new Set([firstHierarchyOf(h, 'Locations'), firstHierarchyOf(h, 'Items')]);
      hierarchies = h.filter((g) => g.of && !shown.has(g.hierarchy)).sort((a, b) => a.hierarchy.localeCompare(b.hierarchy));
      error = null;
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not load hierarchies.';
    } finally {
      loaded = true;
    }
  }
  void refresh();

  const currentHierarchy = $derived(hierarchies.find((g) => g.hierarchy === selectedHierarchyName) ?? null);
  const currentValues = $derived(currentHierarchy ? currentHierarchy.values.slice().sort((a, b) => a.localeCompare(b)) : []);

  const unsubscribe = keyboard.on((event) => {
    if (event.key === 'Escape') {
      if (view === 'new-hierarchy') { view = 'hierarchies'; return true; }
      if (view === 'new-value') { view = 'values'; return true; }
      if (view === 'values') { view = 'hierarchies'; return true; }
      onBack();
      return true;
    }
    if (view === 'hierarchies') {
      switch (event.key) {
        case 'ArrowDown':
          groupingSelected = Math.min(groupingSelected + 1, Math.max(hierarchies.length - 1, 0));
          return true;
        case 'ArrowUp':
          groupingSelected = Math.max(groupingSelected - 1, 0);
          return true;
        case 'Enter':
          if (hierarchies[groupingSelected]) {
            selectedHierarchyName = hierarchies[groupingSelected].hierarchy;
            valueSelected = 0;
            view = 'values';
          }
          return true;
        default:
          if (event.key === 'i') { newHierarchyName = ''; view = 'new-hierarchy'; return true; }
          if (event.key === 'd' && hierarchies[groupingSelected]) { void removeHierarchy(hierarchies[groupingSelected].hierarchy); return true; }
          return false;
      }
    }
    if (view === 'values' && currentHierarchy) {
      switch (event.key) {
        case 'ArrowDown':
          valueSelected = Math.min(valueSelected + 1, Math.max(currentValues.length - 1, 0));
          return true;
        case 'ArrowUp':
          valueSelected = Math.max(valueSelected - 1, 0);
          return true;
        default:
          if (event.key === 'i') { newValueName = ''; view = 'new-value'; return true; }
          if (event.key === 'd' && currentValues[valueSelected]) { void removeValue(currentHierarchy.hierarchy, currentValues[valueSelected]); return true; }
          return false;
      }
    }
  });
  onDestroy(unsubscribe);

  async function removeHierarchy(name: string) {
    busy = true; error = null;
    try {
      await deleteHierarchy(businessName, name);
      groupingSelected = 0;
      await refresh();
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not delete that hierarchy.';
    } finally { busy = false; }
  }

  async function removeValue(hierarchyName: string, valueName: string) {
    busy = true; error = null;
    try {
      await deleteHierarchyValue(businessName, hierarchyName, valueName);
      valueSelected = 0;
      await refresh();
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not delete that value.';
    } finally { busy = false; }
  }

  async function addHierarchy() {
    const name = newHierarchyName.trim();
    if (!name) { view = 'hierarchies'; return; }
    busy = true; error = null;
    try {
      // A further hierarchy of the items; a location hierarchy is named on the Org Chart.
      await createHierarchy(businessName, name, 'Items');
      await refresh();
      view = 'hierarchies';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not create that hierarchy.';
      view = 'hierarchies';
    } finally { busy = false; }
  }

  async function addValue() {
    const name = newValueName.trim();
    if (!name || !currentHierarchy) { view = 'values'; return; }
    busy = true; error = null;
    try {
      await createHierarchyValue(businessName, currentHierarchy.hierarchy, name);
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
{:else if view === 'hierarchies' || view === 'new-hierarchy'}
  <Panel title={`Other Hierarchies — ${businessName}`} focused>
    {#if hierarchies.length === 0 && view === 'hierarchies'}
      <Text text="No other hierarchies yet — press I to add one." color={inkSoft} />
    {/if}
    {#if view === 'hierarchies'}
      {#each hierarchies as g, i (g.hierarchy)}
        <Text text={`${i === groupingSelected ? '› ' : '  '}${g.hierarchy} (${g.values.length})`} color={i === groupingSelected ? brass : ink} />
      {/each}
    {/if}
    {#if view === 'new-hierarchy'}
      <TextInput bind:value={newHierarchyName} focused onSubmit={() => void addHierarchy()} />
      <Text text="Enter creates it · Escape cancels" color={inkSoft} dim />
    {/if}
    {#if error}<Text text={error} color="red" />{/if}
    {#if busy}<Text text="Working…" color={inkSoft} />{/if}
    {#if view === 'hierarchies'}
      <Text text="↑/↓ highlight · Enter open · I add a hierarchy · D delete highlighted · ←/→ Org Chart / Item Categories · Escape back to menu" color={inkSoft} dim />
    {/if}
  </Panel>
{:else if (view === 'values' || view === 'new-value') && currentHierarchy}
  <Panel title={`Other Hierarchies — ${businessName} — ${currentHierarchy.hierarchy}`} focused>
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
