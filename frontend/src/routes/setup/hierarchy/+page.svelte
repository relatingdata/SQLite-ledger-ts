<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import SelectableListEditor from '$lib/components/SelectableListEditor.svelte';
  import {
    getHierarchy,
    getProductShapes,
    createHierarchyGrouping,
    createHierarchyValue,
    deleteHierarchyGrouping,
    deleteHierarchyValue,
    defineProductShape as defineProductShapeApi,
    ApiError,
    type HierarchyGroupingWithValues,
  } from '$lib/api';

  // Single source of truth for entity name display.
  function T(name: string): string {
    return translations.current[name] ?? name;
  }

  let groupings: HierarchyGroupingWithValues[] = [];
  let shapes: [string, string][][] = [];
  let loading = true;
  let error = '';

  let newGroupingName = '';
  let creatingGrouping = false;

  let valueForGrouping: Record<string, string> = {};
  let addingValueTo = '';

  // Groupings list + each grouping's own values list, both converted to
  // the shared SelectableListEditor shell — see docs/pm-frontend-reference.md,
  // "Insert/Enter/Escape/Delete". Product Shapes below is deliberately left
  // button-driven (an in-progress multi-row draft committed as one unit,
  // not a list of independently insertable/deletable items — see the plan).
  let selectedGroupingName: string | null = null;
  let insertingGrouping = false;
  let selectedValueName: string | null = null;
  let insertingValue = false;
  $: selectedGrouping = groupings.find((g) => g.grouping === selectedGroupingName) ?? null;

  function selectGrouping(g: HierarchyGroupingWithValues) {
    selectedGroupingName = g.grouping;
    selectedValueName = null;
    insertingValue = false;
  }

  function openInsertGrouping() {
    insertingGrouping = true;
  }

  function closeInsertGrouping() {
    insertingGrouping = false;
    newGroupingName = '';
  }

  function selectValue(v: string) {
    selectedValueName = v;
  }

  function openInsertValue() {
    insertingValue = true;
  }

  function closeInsertValue() {
    insertingValue = false;
    if (selectedGroupingName) valueForGrouping[selectedGroupingName] = '';
  }

  async function deleteGrouping(g: HierarchyGroupingWithValues) {
    if (!session.current?.businessName) return;
    if (!confirm(`${T('Delete')} "${T(g.grouping)}"? ${T("This can't be undone.")}`)) return;
    error = '';
    try {
      await deleteHierarchyGrouping(session.current.businessName, g.grouping);
      if (selectedGroupingName === g.grouping) selectedGroupingName = null;
      await load();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not delete this grouping.';
    }
  }

  async function deleteValue(v: string) {
    if (!session.current?.businessName || !selectedGroupingName) return;
    if (!confirm(`${T('Delete')} "${T(v)}"? ${T("This can't be undone.")}`)) return;
    error = '';
    try {
      await deleteHierarchyValue(session.current.businessName, selectedGroupingName, v);
      if (selectedValueName === v) selectedValueName = null;
      await load();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not delete this value.';
    }
  }

  // Growable (dimension, grouping) pair list — see docs/pm-frontend-reference.md.
  let newShapeRows: { dimension: string; grouping: string }[] = [{ dimension: '', grouping: '' }];
  let definingShape = false;

  async function load() {
    if (!session.current?.businessName) return;
    loading = true;
    error = '';
    try {
      const [loadedGroupings, loadedShapes] = await Promise.all([getHierarchy(session.current.businessName), getProductShapes(session.current.businessName)]);
      groupings = loadedGroupings;
      shapes = loadedShapes;
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  }

  onMount(load);

  async function addGrouping() {
    if (!session.current?.businessName || !newGroupingName.trim()) return;
    creatingGrouping = true;
    error = '';
    try {
      await createHierarchyGrouping(session.current.businessName, newGroupingName.trim());
      closeInsertGrouping();
      await load();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not create grouping.';
    } finally {
      creatingGrouping = false;
    }
  }

  async function addValue(groupingName: string) {
    const valueName = (valueForGrouping[groupingName] ?? '').trim();
    if (!session.current?.businessName || !valueName) return;
    addingValueTo = groupingName;
    error = '';
    try {
      await createHierarchyValue(session.current.businessName, groupingName, valueName);
      closeInsertValue();
      await load();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not create value.';
    } finally {
      addingValueTo = '';
    }
  }

  function addShapeRow() {
    newShapeRows = [...newShapeRows, { dimension: '', grouping: '' }];
  }

  function removeShapeRow(index: number) {
    newShapeRows = newShapeRows.filter((_, i) => i !== index);
  }

  async function saveShape() {
    if (!session.current?.businessName) return;
    const dimensions: [string, string][] = newShapeRows.filter((r) => r.dimension.trim() && r.grouping.trim()).map((r) => [r.dimension.trim(), r.grouping.trim()]);
    if (dimensions.length === 0) return;
    definingShape = true;
    error = '';
    try {
      await defineProductShapeApi(session.current.businessName, dimensions);
      newShapeRows = [{ dimension: '', grouping: '' }];
      await load();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not define shape.';
    } finally {
      definingShape = false;
    }
  }
</script>

<svelte:head><title>{translations.current['Hierarchies'] ?? 'Hierarchies'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Hierarchies'] ?? 'Hierarchies'}</legend>
  <p class="intro">
    {translations.current['A Hierarchy groups real, named values for reporting — Storage temperature, glass size, anything worth breaking a report down by — kept separate from the product\u2019s own name.'] ??
      'A Hierarchy groups real, named values for reporting — Storage temperature, glass size, anything worth breaking a report down by — kept separate from the product\u2019s own name.'}
  </p>

  {#if error}<p class="error">{error}</p>{/if}

  {#if loading}
    <p class="center-text">Loading…</p>
  {:else}
    <section>
      <h3>{translations.current['Groupings'] ?? 'Groupings'}</h3>
      <div class="hierarchy-layout">
        <SelectableListEditor
          legend={translations.current['Groupings'] ?? 'Groupings'}
          hintText={translations.current['Insert adds a grouping. Delete removes the selected grouping.'] ?? 'Insert adds a grouping. Delete removes the selected grouping.'}
          items={groupings}
          getId={(g) => g.grouping}
          selectedId={selectedGroupingName}
          onSelect={selectGrouping}
          onInsert={openInsertGrouping}
          onDelete={deleteGrouping}
          inserting={insertingGrouping}
          emptyText={translations.current['No real hierarchy groupings yet.'] ?? 'No real hierarchy groupings yet.'}
        >
          {#snippet form()}
            <input
              type="text"
              placeholder={translations.current['New grouping name (e.g. Storage, Glass Size)'] ?? 'New grouping name (e.g. Storage, Glass Size)'}
              bind:value={newGroupingName}
              disabled={creatingGrouping}
              onkeydown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addGrouping(); }
                else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeInsertGrouping(); }
              }}
            />
          {/snippet}
          {#snippet row(g)}
            <span>{T(g.grouping)}</span>
            <span class="hint">({g.values.length})</span>
          {/snippet}
        </SelectableListEditor>

        {#if selectedGrouping}
          <SelectableListEditor
            legend={`${T('Values in')} "${T(selectedGrouping.grouping)}"`}
            hintText={translations.current['Insert adds a value. Delete removes the selected value.'] ?? 'Insert adds a value. Delete removes the selected value.'}
            items={selectedGrouping.values}
            getId={(v) => v}
            selectedId={selectedValueName}
            onSelect={selectValue}
            onInsert={openInsertValue}
            onDelete={deleteValue}
            inserting={insertingValue}
            emptyText={translations.current['No real values yet.'] ?? 'No real values yet.'}
          >
            {#snippet form()}
              <input
                type="text"
                placeholder={translations.current['New value'] ?? 'New value'}
                bind:value={valueForGrouping[selectedGrouping.grouping]}
                disabled={addingValueTo === selectedGrouping.grouping}
                onkeydown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addValue(selectedGrouping!.grouping); }
                  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeInsertValue(); }
                }}
              />
            {/snippet}
            {#snippet row(v)}
              <span>{T(v)}</span>
            {/snippet}
          </SelectableListEditor>
        {/if}
      </div>
    </section>

    <section>
      <h3>{translations.current['Product Shapes'] ?? 'Product Shapes'}</h3>
      <p class="hint">
        {translations.current['A shape defines which real hierarchies apply, and in what order, when recording one real, specific combination.'] ??
          'A shape defines which real hierarchies apply, and in what order, when recording one real, specific combination.'}
      </p>
      {#if shapes.length === 0}
        <p class="empty">{translations.current['No real Product shape defined yet.'] ?? 'No real Product shape defined yet.'}</p>
      {:else}
        <div class="cards">
          {#each shapes as shape}
            <div class="card">
              <ol class="shape-list">
                {#each shape as [dimension, grouping]}
                  <li>{dimension} <span class="hint">→ {grouping}</span></li>
                {/each}
              </ol>
            </div>
          {/each}
        </div>
      {/if}

      <div class="new-shape">
        {#each newShapeRows as row, i}
          <div class="add-row">
            <input type="text" placeholder={translations.current['Dimension name (e.g. Location)'] ?? 'Dimension name (e.g. Location)'} bind:value={row.dimension} />
            <input type="text" placeholder={translations.current['Hierarchy grouping (e.g. Location)'] ?? 'Hierarchy grouping (e.g. Location)'} bind:value={row.grouping} />
            {#if newShapeRows.length > 1}
              <button class="btn-secondary" onclick={() => removeShapeRow(i)}>×</button>
            {/if}
          </div>
        {/each}
        <div class="shape-actions">
          <button class="btn-secondary" onclick={addShapeRow}>{translations.current['+ Add dimension'] ?? '+ Add dimension'}</button>
          <button class="btn" onclick={saveShape} disabled={definingShape}>
            {definingShape ? '…' : (translations.current['Save shape'] ?? 'Save shape')}
          </button>
        </div>
      </div>
    </section>
  {/if}
</fieldset>

<style>
  .center-text {
    text-align: center;
  }
  .intro {
    color: var(--ink-soft);
    max-width: 70ch;
    margin: 0 auto 1.2rem;
    text-align: center;
  }
  .empty {
    text-align: center;
    color: var(--ink-soft);
    font-style: italic;
  }
  section {
    margin-bottom: 1.6rem;
  }
  section h3 {
    margin-bottom: 0.4rem;
  }
  .cards {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 0.8rem;
  }
  .hint {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    margin: 0;
  }
  .add-row {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }
  .add-row input {
    flex: 1;
    min-width: 0;
  }
  .hierarchy-layout {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .hierarchy-layout :global(fieldset.sub-block) {
    flex: 1;
    min-width: 260px;
  }
  .shape-list {
    margin: 0;
    padding-left: 1.2rem;
  }
  .new-shape {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    max-width: 560px;
  }
  .shape-actions {
    display: flex;
    justify-content: space-between;
    margin-top: 0.4rem;
  }
</style>
