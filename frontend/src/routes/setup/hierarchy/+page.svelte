<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import SelectableListEditor from '$lib/components/SelectableListEditor.svelte';
  import {
    getHierarchy,
    getProductShapes,
    createHierarchy,
    createHierarchyValue,
    deleteHierarchy,
    deleteHierarchyValue,
    defineProductShape as defineProductShapeApi,
    ApiError,
    type HierarchyWithValues,
    type HierarchyKind,
  } from '$lib/api';

  // Single source of truth for entity name display.
  function T(name: string): string {
    return translations.current[name] ?? name;
  }

  let hierarchies: HierarchyWithValues[] = [];
  let shapes: [string, string][][] = [];
  let loading = true;
  let error = '';

  let newHierarchyName = '';
  // What the new hierarchy groups — see docs/pm-domain-reference.md.
  let newHierarchyOf: HierarchyKind = 'Items';
  let creatingHierarchy = false;

  let valueForHierarchy: Record<string, string> = {};
  let addingValueTo = '';

  // Hierarchies list + each hierarchy's own values list, both converted to
  // the shared SelectableListEditor shell — see docs/pm-frontend-reference.md,
  // "Insert/Enter/Escape/Delete". Product Shapes below is deliberately left
  // button-driven (an in-progress multi-row draft committed as one unit,
  // not a list of independently insertable/deletable items — see the plan).
  let selectedHierarchyName: string | null = null;
  let insertingHierarchy = false;
  let selectedValueName: string | null = null;
  let insertingValue = false;
  $: selectedHierarchy = hierarchies.find((g) => g.hierarchy === selectedHierarchyName) ?? null;

  function selectHierarchy(g: HierarchyWithValues) {
    selectedHierarchyName = g.hierarchy;
    selectedValueName = null;
    insertingValue = false;
  }

  function openInsertHierarchy() {
    insertingHierarchy = true;
  }

  function closeInsertHierarchy() {
    insertingHierarchy = false;
    newHierarchyName = '';
  }

  function selectValue(v: string) {
    selectedValueName = v;
  }

  function openInsertValue() {
    insertingValue = true;
  }

  function closeInsertValue() {
    insertingValue = false;
    if (selectedHierarchyName) valueForHierarchy[selectedHierarchyName] = '';
  }

  async function deleteHierarchyRow(g: HierarchyWithValues) {
    if (!session.current?.businessName) return;
    if (!confirm(`${T('Delete')} "${T(g.hierarchy)}"? ${T("This can't be undone.")}`)) return;
    error = '';
    try {
      await deleteHierarchy(session.current.businessName, g.hierarchy);
      if (selectedHierarchyName === g.hierarchy) selectedHierarchyName = null;
      await load();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not delete this hierarchy.';
    }
  }

  async function deleteValue(v: string) {
    if (!session.current?.businessName || !selectedHierarchyName) return;
    if (!confirm(`${T('Delete')} "${T(v)}"? ${T("This can't be undone.")}`)) return;
    error = '';
    try {
      await deleteHierarchyValue(session.current.businessName, selectedHierarchyName, v);
      if (selectedValueName === v) selectedValueName = null;
      await load();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not delete this value.';
    }
  }

  // Growable (dimension, hierarchy) pair list — see docs/pm-frontend-reference.md.
  let newShapeRows: { dimension: string; hierarchy: string }[] = [{ dimension: '', hierarchy: '' }];
  let definingShape = false;

  async function load() {
    if (!session.current?.businessName) return;
    loading = true;
    error = '';
    try {
      const [loadedHierarchies, loadedShapes] = await Promise.all([getHierarchy(session.current.businessName), getProductShapes(session.current.businessName)]);
      hierarchies = loadedHierarchies;
      shapes = loadedShapes;
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  }

  onMount(load);

  async function addHierarchy() {
    if (!session.current?.businessName || !newHierarchyName.trim()) return;
    creatingHierarchy = true;
    error = '';
    try {
      await createHierarchy(session.current.businessName, newHierarchyName.trim(), newHierarchyOf);
      closeInsertHierarchy();
      await load();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not create hierarchy.';
    } finally {
      creatingHierarchy = false;
    }
  }

  async function addValue(hierarchyName: string) {
    const valueName = (valueForHierarchy[hierarchyName] ?? '').trim();
    if (!session.current?.businessName || !valueName) return;
    addingValueTo = hierarchyName;
    error = '';
    try {
      await createHierarchyValue(session.current.businessName, hierarchyName, valueName);
      closeInsertValue();
      await load();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not create value.';
    } finally {
      addingValueTo = '';
    }
  }

  function addShapeRow() {
    newShapeRows = [...newShapeRows, { dimension: '', hierarchy: '' }];
  }

  function removeShapeRow(index: number) {
    newShapeRows = newShapeRows.filter((_, i) => i !== index);
  }

  async function saveShape() {
    if (!session.current?.businessName) return;
    const dimensions: [string, string][] = newShapeRows.filter((r) => r.dimension.trim() && r.hierarchy.trim()).map((r) => [r.dimension.trim(), r.hierarchy.trim()]);
    if (dimensions.length === 0) return;
    definingShape = true;
    error = '';
    try {
      await defineProductShapeApi(session.current.businessName, dimensions);
      newShapeRows = [{ dimension: '', hierarchy: '' }];
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
      <h3>{translations.current['Hierarchies'] ?? 'Hierarchies'}</h3>
      <div class="hierarchy-layout">
        <SelectableListEditor
          legend={translations.current['Hierarchies'] ?? 'Hierarchies'}
          hintText={translations.current['Insert adds a hierarchy. Delete removes the selected hierarchy.'] ?? 'Insert adds a hierarchy. Delete removes the selected hierarchy.'}
          items={hierarchies}
          getId={(g) => g.hierarchy}
          selectedId={selectedHierarchyName}
          onSelect={selectHierarchy}
          onInsert={openInsertHierarchy}
          onDelete={deleteHierarchyRow}
          inserting={insertingHierarchy}
          emptyText={translations.current['No hierarchies yet.'] ?? 'No hierarchies yet.'}
        >
          {#snippet form()}
            <input
              type="text"
              placeholder={translations.current['New hierarchy name (e.g. Storage, Glass Size)'] ?? 'New hierarchy name (e.g. Storage, Glass Size)'}
              bind:value={newHierarchyName}
              disabled={creatingHierarchy}
              onkeydown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addHierarchy(); }
                else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeInsertHierarchy(); }
              }}
            />
            <select
              name="of"
              bind:value={newHierarchyOf}
              disabled={creatingHierarchy}
              onkeydown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addHierarchy(); }
                else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeInsertHierarchy(); }
              }}
            >
              <option value="Items">{translations.current['Of items'] ?? 'Of items'}</option>
              <option value="Locations">{translations.current['Of locations'] ?? 'Of locations'}</option>
            </select>
          {/snippet}
          {#snippet row(g)}
            <span>{T(g.hierarchy)}</span>
            <span class="hint">({g.of ? `${T(g.of)}, ` : ''}{g.values.length})</span>
          {/snippet}
        </SelectableListEditor>

        {#if selectedHierarchy}
          <SelectableListEditor
            legend={`${T('Values in')} "${T(selectedHierarchy.hierarchy)}"`}
            hintText={translations.current['Insert adds a value. Delete removes the selected value.'] ?? 'Insert adds a value. Delete removes the selected value.'}
            items={selectedHierarchy.values}
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
                bind:value={valueForHierarchy[selectedHierarchy.hierarchy]}
                disabled={addingValueTo === selectedHierarchy.hierarchy}
                onkeydown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addValue(selectedHierarchy!.hierarchy); }
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
                {#each shape as [dimension, hierarchy]}
                  <li>{dimension} <span class="hint">→ {hierarchy}</span></li>
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
            <input type="text" placeholder={translations.current['Hierarchy (e.g. Location)'] ?? 'Hierarchy (e.g. Location)'} bind:value={row.hierarchy} />
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
