<script lang="ts">
  // The "Business Structure" popup — a graphical, editable view over a
  // business's Locations, Divisions, Item Categories, and any other
  // generic Hierarchy, all in one place. See docs/pm-frontend-reference.md
  // for the full design and the hierarchy-tag-vs-structural-reparent
  // distinction this component depends on.
  //
  // Deliberately calls no new backend endpoints: every add/move action
  // below reuses the exact same, already-existing functions the
  // Locations, Setup → Hierarchies, and Items Catalog screens call
  // directly — this is a unified graphical front end over those same
  // capabilities, not a replacement for them.
  import {
    asBusinessName,
    createLocation,
    listLocations,
    getLocationTypes,
    getHierarchy,
    getHierarchyTag,
    setHierarchyTag,
    deleteHierarchyTag,
    createHierarchyGrouping,
    createHierarchyValue,
    getEntityTree,
    createEntity,
    supersedeEntity,
    listItems,
    ApiError,
    type LocationRecord,
    type HierarchyGroupingWithValues,
    type EntityNode,
    type ItemSummary,
  } from '$lib/api';
  import { translations } from '$lib/state.svelte';
  import StructureTreeNode, { type StructureNode } from './StructureTreeNode.svelte';
  import Form, { type FormField } from './Form.svelte';

  let { business, onClose }: { business: string; onClose: () => void } = $props();

  type Tab = 'locations' | 'categories' | 'hierarchies';
  let activeTab: Tab = $state('locations');

  const DIVISION = 'Division';
  const UNASSIGNED_KEY = '__unassigned__';

  // ---------------------------------------------------------------
  // Locations & Divisions
  // ---------------------------------------------------------------
  let locations: LocationRecord[] = $state([]);
  let locationDivision: Record<string, string | null> = $state({});
  let divisionValues: string[] = $state([]);
  let locationTypes: string[] = $state([]);
  let locationsError = $state('');
  let locationsLoading = $state(true);

  async function loadLocationsTab() {
    locationsLoading = true;
    locationsError = '';
    try {
      const biz = asBusinessName(business);
      const [locs, hierarchy, types] = await Promise.all([listLocations(biz), getHierarchy(business), getLocationTypes()]);
      locations = locs;
      locationTypes = types;
      divisionValues = hierarchy.find((h: HierarchyGroupingWithValues) => h.grouping === DIVISION)?.values ?? [];
      const tags = await Promise.all(locs.map((l) => getHierarchyTag(l.name, DIVISION).catch(() => ({ parentName: null }))));
      locationDivision = Object.fromEntries(locs.map((l, i) => [l.name, tags[i].parentName]));
    } catch (e) {
      locationsError = e instanceof ApiError ? e.message : 'Could not load locations and divisions.';
    } finally {
      locationsLoading = false;
    }
  }

  let locationsTree: StructureNode[] = $derived.by(() => {
    const byDivision = new Map<string | null, LocationRecord[]>();
    for (const l of locations) {
      const d = locationDivision[l.name] ?? null;
      const list = byDivision.get(d) ?? [];
      list.push(l);
      byDivision.set(d, list);
    }
    const locationNode = (l: LocationRecord): StructureNode => ({ key: `loc:${l.name}`, name: l.name, kind: 'location', children: [], canMove: true });
    const divisionNodes: StructureNode[] = divisionValues
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({
        key: `div:${v}`,
        name: v,
        kind: 'division-value',
        children: (byDivision.get(v) ?? []).sort((a, b) => a.name.localeCompare(b.name)).map(locationNode),
        canMove: false,
      }));
    const unassigned = (byDivision.get(null) ?? []).sort((a, b) => a.name.localeCompare(b.name)).map(locationNode);
    return [
      ...divisionNodes,
      { key: UNASSIGNED_KEY, name: 'Unassigned', label: 'Unassigned (no division)', kind: 'division-value', children: unassigned, canMove: false },
    ];
  });

  // Add forms — a new Location, or a new Division value.
  let addingLocationForm = $state(false);
  let newLocationValues: Record<string, string | number | string[]> = $state({ name: '', city: '', locationType: 'Retail' });
  const locationFields: FormField[] = $derived.by(() => [
    { name: 'name', label: 'Location name', type: 'text' },
    { name: 'city', label: 'City', type: 'text' },
    { name: 'locationType', label: 'Location type', type: 'select', options: locationTypes },
  ]);
  async function submitNewLocation(values: Record<string, string | number | string[]>) {
    await createLocation(
      String(values.name ?? '').trim(),
      business,
      { city: String(values.city ?? '').trim(), location_type: String(values.locationType ?? 'Retail'), is_billing_address: false, bottle_capacity: null, carton_capacity: null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      'Business Structure Popup'
    );
    addingLocationForm = false;
    newLocationValues = { name: '', city: '', locationType: 'Retail' };
    await loadLocationsTab();
  }

  let addingDivisionValue = $state(false);
  let newDivisionValueName = $state('');
  async function submitNewDivisionValue() {
    if (!newDivisionValueName.trim()) return;
    try {
      await createHierarchyGrouping(business, DIVISION);
      await createHierarchyValue(business, DIVISION, newDivisionValueName.trim());
      newDivisionValueName = '';
      addingDivisionValue = false;
      await loadLocationsTab();
    } catch (e) {
      locationsError = e instanceof ApiError ? e.message : 'Could not create division.';
    }
  }

  function onAddChildLocationsTab(node: StructureNode) {
    // Only the synthetic "Unassigned"/division roots offer "+ Add" in
    // this tab, used to add a brand-new division value; adding a
    // location itself uses the standalone button below the tree.
    addingDivisionValue = true;
  }

  let movingLocationKey: string | null = $state(null);
  let moveLocationOptions: { value: string | null; label: string }[] = $derived.by(() => [
    { value: null, label: translations.current['Unassigned (no division)'] ?? 'Unassigned (no division)' },
    ...divisionValues.map((v) => ({ value: v, label: v })),
  ]);
  function startMoveLocation(node: StructureNode) {
    movingLocationKey = node.key;
  }
  async function confirmMoveLocation(node: StructureNode, destination: string | null) {
    try {
      if (destination) await setHierarchyTag(node.name, DIVISION, destination);
      else await deleteHierarchyTag(node.name, DIVISION);
      movingLocationKey = null;
      await loadLocationsTab();
    } catch (e) {
      locationsError = e instanceof ApiError ? e.message : 'Could not move location.';
    }
  }

  // ---------------------------------------------------------------
  // Item Categories
  // ---------------------------------------------------------------
  let entities: EntityNode[] = $state([]);
  let items: ItemSummary[] = $state([]);
  let categoriesError = $state('');
  let categoriesLoading = $state(true);

  async function loadCategoriesTab() {
    categoriesLoading = true;
    categoriesError = '';
    try {
      const [tree, itemsResult] = await Promise.all([getEntityTree(), listItems(business)]);
      entities = tree;
      items = itemsResult.rows;
    } catch (e) {
      categoriesError = e instanceof ApiError ? e.message : 'Could not load item categories.';
    } finally {
      categoriesLoading = false;
    }
  }

  function itemsRootEntity(): EntityNode | undefined {
    const biz = entities.find((e) => e.name === business);
    if (biz) {
      const scoped = entities.find((e) => e.name === 'Items' && e.parent_id === biz.id);
      if (scoped) return scoped;
    }
    return entities.find((e) => e.name === 'Items');
  }

  let categoryTree: StructureNode[] = $derived.by(() => {
    const root = itemsRootEntity();
    if (!root) return [];
    const itemNames = new Set(items.map((i) => i.name));
    const byParentId = new Map<number, EntityNode[]>();
    for (const e of entities) {
      if (e.parent_id == null) continue;
      const list = byParentId.get(e.parent_id) ?? [];
      list.push(e);
      byParentId.set(e.parent_id, list);
    }
    const build = (categoryEntity: EntityNode): StructureNode => {
      const kids = (byParentId.get(categoryEntity.id) ?? []).filter((k) => !itemNames.has(k.name)).sort((a, b) => a.name.localeCompare(b.name));
      return { key: `cat:${categoryEntity.id}`, name: categoryEntity.name, kind: 'category', canAddChild: true, canMove: categoryEntity.id !== root.id, children: kids.map(build) };
    };
    return (byParentId.get(root.id) ?? [])
      .filter((e) => !itemNames.has(e.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(build);
  });

  let allCategoryNames: string[] = $derived.by(() => {
    const root = itemsRootEntity();
    const itemNames = new Set(items.map((i) => i.name));
    return entities.filter((e) => e.id !== root?.id && !itemNames.has(e.name) && isUnderItemsRoot(e)).map((e) => e.name);
  });
  function isUnderItemsRoot(e: EntityNode): boolean {
    const root = itemsRootEntity();
    if (!root) return false;
    let cur: EntityNode | undefined = e;
    const byId = new Map(entities.map((x) => [x.id, x]));
    let guard = 0;
    while (cur && guard++ < 50) {
      if (cur.id === root.id) return true;
      cur = cur.parent_id != null ? byId.get(cur.parent_id) : undefined;
    }
    return false;
  }

  let addingCategoryUnder: StructureNode | 'root' | null = $state(null);
  let newCategoryName = $state('');
  function onAddChildCategoriesTab(node: StructureNode) {
    addingCategoryUnder = node;
    newCategoryName = '';
  }
  function addTopLevelCategory() {
    addingCategoryUnder = 'root';
    newCategoryName = '';
  }
  async function submitNewCategory() {
    if (!newCategoryName.trim() || !addingCategoryUnder) return;
    const root = itemsRootEntity();
    if (!root) return;
    const parentId = addingCategoryUnder === 'root' ? root.id : entities.find((e) => e.name === (addingCategoryUnder as StructureNode).name)?.id;
    if (!parentId) return;
    try {
      await createEntity({ name: newCategoryName.trim(), parentId }, 'Business Structure Popup');
      addingCategoryUnder = null;
      newCategoryName = '';
      await loadCategoriesTab();
    } catch (e) {
      categoriesError = e instanceof ApiError ? e.message : 'Could not create category.';
    }
  }

  // supersedeEntity's own reparent API (backend/src/db.ts:402, api.ts:148)
  // takes a bare parent NAME, not a parent id — a pre-existing
  // limitation this popup inherits rather than introduces (the
  // Structured Editor's own reparent dropdown has the same one). Every
  // business's Items root is literally named "Items" (only unique
  // among siblings under the same parent, per schema/00-core.sql's
  // entities_name_unique trigger), so "move to top level" is reliable
  // only while at most one business's Items root is reachable by that
  // bare name at once — true for this app's own single-business-at-a-
  // time demo/test setup, but worth fixing in supersedeEntity itself
  // (accepting a parent id) before this popup is trusted multi-business.
  let movingCategoryKey: string | null = $state(null);
  let moveCategoryOptions: { value: string | null; label: string }[] = $derived.by(() => {
    const root = itemsRootEntity();
    const options = root ? [{ value: root.name, label: `${translations.current['Top level'] ?? 'Top level'} (${root.name})` }] : [];
    return [...options, ...allCategoryNames.sort((a, b) => a.localeCompare(b)).map((n) => ({ value: n, label: n }))];
  });
  function startMoveCategory(node: StructureNode) {
    movingCategoryKey = node.key;
  }
  async function confirmMoveCategory(node: StructureNode, destination: string | null) {
    if (!destination) return;
    const entity = entities.find((e) => e.name === node.name);
    if (!entity) return;
    try {
      await supersedeEntity(entity.id, { parent: destination });
      movingCategoryKey = null;
      await loadCategoriesTab();
    } catch (e) {
      categoriesError = e instanceof ApiError ? e.message : 'Could not move category.';
    }
  }

  // ---------------------------------------------------------------
  // Other Hierarchies (any grouping other than Division)
  // ---------------------------------------------------------------
  let hierarchy: HierarchyGroupingWithValues[] = $state([]);
  let hierarchiesError = $state('');
  let hierarchiesLoading = $state(true);

  async function loadHierarchiesTab() {
    hierarchiesLoading = true;
    hierarchiesError = '';
    try {
      hierarchy = (await getHierarchy(business)).filter((h) => h.grouping !== DIVISION);
    } catch (e) {
      hierarchiesError = e instanceof ApiError ? e.message : 'Could not load hierarchies.';
    } finally {
      hierarchiesLoading = false;
    }
  }

  let hierarchiesTree: StructureNode[] = $derived.by(() =>
    hierarchy
      .slice()
      .sort((a, b) => a.grouping.localeCompare(b.grouping))
      .map((h) => ({
        key: `grp:${h.grouping}`,
        name: h.grouping,
        kind: 'hierarchy-value',
        canAddChild: true,
        children: h.values
          .slice()
          .sort((a, b) => a.localeCompare(b))
          .map((v) => ({ key: `grp:${h.grouping}:${v}`, name: v, kind: 'hierarchy-value', children: [] }) as StructureNode),
      }))
  );

  let addingGrouping = $state(false);
  let newGroupingName = $state('');
  async function submitNewGrouping() {
    if (!newGroupingName.trim()) return;
    try {
      await createHierarchyGrouping(business, newGroupingName.trim());
      newGroupingName = '';
      addingGrouping = false;
      await loadHierarchiesTab();
    } catch (e) {
      hierarchiesError = e instanceof ApiError ? e.message : 'Could not create hierarchy.';
    }
  }

  let addingValueUnderGrouping: string | null = $state(null);
  let newHierarchyValueName = $state('');
  function onAddChildHierarchiesTab(node: StructureNode) {
    // Only grouping-level nodes (no ':' in their key beyond "grp:<name>")
    // offer "+ Add" here, to add a new value under that grouping.
    if (node.key.split(':').length === 2) {
      addingValueUnderGrouping = node.name;
      newHierarchyValueName = '';
    }
  }
  async function submitNewHierarchyValue() {
    if (!newHierarchyValueName.trim() || !addingValueUnderGrouping) return;
    try {
      await createHierarchyValue(business, addingValueUnderGrouping, newHierarchyValueName.trim());
      addingValueUnderGrouping = null;
      newHierarchyValueName = '';
      await loadHierarchiesTab();
    } catch (e) {
      hierarchiesError = e instanceof ApiError ? e.message : 'Could not create hierarchy value.';
    }
  }

  function selectTab(tab: Tab) {
    activeTab = tab;
    if (tab === 'locations' && locations.length === 0 && locationsLoading) loadLocationsTab();
    if (tab === 'categories' && entities.length === 0 && categoriesLoading) loadCategoriesTab();
    if (tab === 'hierarchies' && hierarchy.length === 0 && hierarchiesLoading) loadHierarchiesTab();
  }

  // Load the first tab eagerly on mount.
  loadLocationsTab();
</script>

<div class="overlay" role="presentation" onclick={onClose}>
  <div class="panel" role="dialog" aria-modal="true" tabindex="-1" aria-label={translations.current['Business Structure'] ?? 'Business Structure'} onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
    <header>
      <h2>{translations.current['Business Structure'] ?? 'Business Structure'}</h2>
      <button type="button" class="close-btn" onclick={onClose} aria-label="Close">×</button>
    </header>
    <nav class="tabs">
      <button type="button" class:active={activeTab === 'locations'} onclick={() => selectTab('locations')}>{translations.current['Locations & Divisions'] ?? 'Locations & Divisions'}</button>
      <button type="button" class:active={activeTab === 'categories'} onclick={() => selectTab('categories')}>{translations.current['Item Categories'] ?? 'Item Categories'}</button>
      <button type="button" class:active={activeTab === 'hierarchies'} onclick={() => selectTab('hierarchies')}>{translations.current['Other Hierarchies'] ?? 'Other Hierarchies'}</button>
    </nav>

    <div class="tab-body">
      {#if activeTab === 'locations'}
        {#if locationsError}<p class="error">{locationsError}</p>{/if}
        {#if locationsLoading}
          <p>{translations.current['Loading…'] ?? 'Loading…'}</p>
        {:else}
          <div class="tree">
            {#each locationsTree as node (node.key)}
              <StructureTreeNode {node} onAddChild={onAddChildLocationsTab} onStartMove={startMoveLocation} movingKey={movingLocationKey} moveOptions={moveLocationOptions} onConfirmMove={confirmMoveLocation} onCancelMove={() => (movingLocationKey = null)} />
            {/each}
          </div>
          <div class="tab-actions">
            {#if !addingLocationForm}
              <button type="button" class="btn" onclick={() => (addingLocationForm = true)}>+ {translations.current['New Location'] ?? 'New Location'}</button>
            {/if}
            {#if !addingDivisionValue}
              <button type="button" class="btn secondary" onclick={() => (addingDivisionValue = true)}>+ {translations.current['New Division'] ?? 'New Division'}</button>
            {/if}
          </div>
          {#if addingLocationForm}
            <Form fields={locationFields} values={newLocationValues} onSubmit={submitNewLocation} submitLabel="Create Location" />
          {/if}
          {#if addingDivisionValue}
            <div class="inline-form">
              <input bind:value={newDivisionValueName} placeholder={translations.current['Division name, e.g. Adelaide Metro'] ?? 'Division name, e.g. Adelaide Metro'} />
              <button type="button" class="btn" onclick={submitNewDivisionValue}>{translations.current['Create'] ?? 'Create'}</button>
              <button type="button" class="btn secondary" onclick={() => (addingDivisionValue = false)}>{translations.current['Cancel'] ?? 'Cancel'}</button>
            </div>
          {/if}
        {/if}
      {:else if activeTab === 'categories'}
        {#if categoriesError}<p class="error">{categoriesError}</p>{/if}
        {#if categoriesLoading}
          <p>{translations.current['Loading…'] ?? 'Loading…'}</p>
        {:else}
          <div class="tree">
            {#each categoryTree as node (node.key)}
              <StructureTreeNode {node} onAddChild={onAddChildCategoriesTab} onStartMove={startMoveCategory} movingKey={movingCategoryKey} moveOptions={moveCategoryOptions} onConfirmMove={confirmMoveCategory} onCancelMove={() => (movingCategoryKey = null)} />
            {/each}
          </div>
          <div class="tab-actions">
            <button type="button" class="btn" onclick={addTopLevelCategory}>+ {translations.current['New top-level category'] ?? 'New top-level category'}</button>
          </div>
          {#if addingCategoryUnder}
            <div class="inline-form">
              <input bind:value={newCategoryName} placeholder={translations.current['Category name'] ?? 'Category name'} />
              <button type="button" class="btn" onclick={submitNewCategory}>{translations.current['Create'] ?? 'Create'}</button>
              <button type="button" class="btn secondary" onclick={() => (addingCategoryUnder = null)}>{translations.current['Cancel'] ?? 'Cancel'}</button>
            </div>
          {/if}
        {/if}
      {:else}
        {#if hierarchiesError}<p class="error">{hierarchiesError}</p>{/if}
        {#if hierarchiesLoading}
          <p>{translations.current['Loading…'] ?? 'Loading…'}</p>
        {:else}
          <p class="field-note">{translations.current['Any further grouping your business wants to report by — region, bottle size, storage area — beyond Division.'] ?? 'Any further grouping your business wants to report by — region, bottle size, storage area — beyond Division.'}</p>
          <div class="tree">
            {#each hierarchiesTree as node (node.key)}
              <StructureTreeNode {node} onAddChild={onAddChildHierarchiesTab} onStartMove={() => {}} movingKey={null} moveOptions={[]} onConfirmMove={() => {}} onCancelMove={() => {}} />
            {/each}
          </div>
          <div class="tab-actions">
            {#if !addingGrouping}
              <button type="button" class="btn" onclick={() => (addingGrouping = true)}>+ {translations.current['New Hierarchy'] ?? 'New Hierarchy'}</button>
            {/if}
          </div>
          {#if addingGrouping}
            <div class="inline-form">
              <input bind:value={newGroupingName} placeholder={translations.current['Hierarchy name, e.g. Storage'] ?? 'Hierarchy name, e.g. Storage'} />
              <button type="button" class="btn" onclick={submitNewGrouping}>{translations.current['Create'] ?? 'Create'}</button>
              <button type="button" class="btn secondary" onclick={() => (addingGrouping = false)}>{translations.current['Cancel'] ?? 'Cancel'}</button>
            </div>
          {/if}
          {#if addingValueUnderGrouping}
            <div class="inline-form">
              <input bind:value={newHierarchyValueName} placeholder={translations.current['Value name, e.g. Secure'] ?? 'Value name, e.g. Secure'} />
              <button type="button" class="btn" onclick={submitNewHierarchyValue}>{translations.current['Create'] ?? 'Create'}</button>
              <button type="button" class="btn secondary" onclick={() => (addingValueUnderGrouping = null)}>{translations.current['Cancel'] ?? 'Cancel'}</button>
            </div>
          {/if}
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(20, 20, 20, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .panel {
    background: var(--paper);
    border-radius: 10px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
    width: min(44rem, 92vw);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.2rem;
    border-bottom: 1px solid var(--rule);
  }
  header h2 {
    margin: 0;
    font-size: var(--font-size-large);
  }
  .close-btn {
    background: none;
    border: none;
    font-size: 1.4rem;
    line-height: 1;
    cursor: pointer;
    color: var(--ink-soft);
  }
  .tabs {
    display: flex;
    gap: 0.3rem;
    padding: 0.6rem 1.2rem 0;
    border-bottom: 1px solid var(--rule);
  }
  .tabs button {
    background: none;
    border: none;
    padding: 0.5rem 0.8rem;
    cursor: pointer;
    font: inherit;
    border-bottom: 2px solid transparent;
    color: var(--ink-soft);
  }
  .tabs button.active {
    color: var(--ink);
    border-bottom-color: var(--brass);
    font-weight: 600;
  }
  .tab-body {
    padding: 1rem 1.2rem;
    overflow-y: auto;
  }
  .tree {
    border: 1px solid var(--rule);
    border-radius: 8px;
    padding: 0.5rem;
    margin-bottom: 0.8rem;
    max-height: 18rem;
    overflow-y: auto;
  }
  .tab-actions {
    display: flex;
    gap: 0.6rem;
    margin-bottom: 0.8rem;
  }
  .inline-form {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
</style>
