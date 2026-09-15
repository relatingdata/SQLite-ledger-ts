<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import {
    getHierarchy,
    getProductShapes,
    createHierarchyGrouping,
    createHierarchyValue,
    defineProductShape as defineProductShapeApi,
    ApiError,
    type HierarchyGroupingWithValues,
  } from '$lib/api';

  let groupings: HierarchyGroupingWithValues[] = [];
  let shapes: [string, string][][] = [];
  let loading = true;
  let error = '';

  let newGroupingName = '';
  let creatingGrouping = false;

  let valueForGrouping: Record<string, string> = {};
  let addingValueTo = '';

  // A real, direct, growable list of (dimension name, grouping name)
  // pairs — the same, real shape defineProductShape itself expects,
  // built up one real row at a time rather than a single, fragile
  // text field a person would have to format exactly right.
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
      newGroupingName = '';
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
      valueForGrouping[groupingName] = '';
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
      {#if groupings.length === 0}
        <p class="empty">{translations.current['No real hierarchy groupings yet.'] ?? 'No real hierarchy groupings yet.'}</p>
      {:else}
        <div class="cards">
          {#each groupings as g}
            <div class="card grouping-card">
              <h4>{g.grouping}</h4>
              {#if g.values.length === 0}
                <p class="hint">{translations.current['No real values yet.'] ?? 'No real values yet.'}</p>
              {:else}
                <ul class="values">
                  {#each g.values as v}
                    <li>{v}</li>
                  {/each}
                </ul>
              {/if}
              <div class="add-row">
                <input
                  type="text"
                  placeholder={translations.current['New value'] ?? 'New value'}
                  bind:value={valueForGrouping[g.grouping]}
                  onkeydown={(e) => e.key === 'Enter' && addValue(g.grouping)}
                />
                <button class="btn" onclick={() => addValue(g.grouping)} disabled={addingValueTo === g.grouping}>
                  {addingValueTo === g.grouping ? '…' : (translations.current['Add'] ?? 'Add')}
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <div class="add-row new-grouping">
        <input
          type="text"
          placeholder={translations.current['New grouping name (e.g. Storage, Glass Size)'] ?? 'New grouping name (e.g. Storage, Glass Size)'}
          bind:value={newGroupingName}
          onkeydown={(e) => e.key === 'Enter' && addGrouping()}
        />
        <button class="btn" onclick={addGrouping} disabled={creatingGrouping}>
          {creatingGrouping ? '…' : (translations.current['Add grouping'] ?? 'Add grouping')}
        </button>
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
  .grouping-card {
    padding: 1rem 1.1rem;
    width: 260px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .grouping-card h4 {
    margin: 0;
  }
  .values {
    margin: 0;
    padding-left: 1.2rem;
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
  .new-grouping {
    max-width: 480px;
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
