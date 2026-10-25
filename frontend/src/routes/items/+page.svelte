<script lang="ts">
  // The Items catalog tree — see docs/pm-frontend-reference.md for the
  // full design of the sections below.
  import { auth } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import { session } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { onMount } from 'svelte';
  import TreeEditor from '$lib/components/TreeEditor.svelte';
  import {
    getEntityTree,
    createEntity,
    revokeEntity,
    listItems,
    getItem,
    setItem,
    listItemSources,
    addOrUpdateItemSource,
    getBomComponents,
    setBomComponent,
    deleteBomComponent,
    deleteItemSource,
    asItemName,
    asProviderName,
    ApiError,
    listLocations,
    getHierarchy,
    receiveIntoStorageStock,
    resolveReceiveAccounts,
    stageLine,
    postJournalEntry,
    asBusinessName,
    asLedgerName,
    asLocationName,
    asAccountName,
    type EntityNode,
    type ItemSummary,
    type Item,
    type ItemSource,
    type LocationRecord,
    type HierarchyGroupingWithValues,
  } from '$lib/api';
  import { receiveIntoStorageLines, freshReference } from '$lib/canned-journal';

  let entities: EntityNode[] = $state([]);
  let items: ItemSummary[] = $state([]);
  let loading = $state(true);
  let error = $state('');
  let message = $state('');

  // The tree selection: category or item — see docs/pm-frontend-reference.md.
  type Selection = { type: 'category'; name: string } | { type: 'item'; name: string; category: string } | null;
  let selection: Selection = $state(null);
  let selectedName = $derived.by(() => (selection?.type === 'item' ? selection.name : ''));

  let item: Item = $state({ description: null, unit_of_measure: null, upc: null });
  let sources: ItemSource[] = $state([]);
  let savingItem = $state(false);

  // A new source's fields — provider is required, everything else optional.
  let sourceManufacturer = $state('');
  let sourceProvider = $state('');
  let sourceSku = $state('');
  let sourceUpc = $state('');
  let sourcePrice = $state('');
  let sourceCurrency = $state('');
  let sourcePackageQty = $state('');
  let sourcePreferred = $state(false);

  // Bill of Materials — a new component's fields, and the real,
  // currently-posted list for whichever Item is selected.
  let bomComponents: { component: string; quantity: number; unit: string }[] = $state([]);
  let bomComponentItem = $state('');
  let bomQuantity = $state('');
  let bomUnit = $state('ml');
  let savingBom = $state(false);

  // Receiving into a named storage combination — see docs/pm-frontend-reference.md.
  let locations: LocationRecord[] = $state([]);
  let hierarchyGroupings: HierarchyGroupingWithValues[] = $state([]);
  let receiveLocation = $state('');
  let receiveGrouping = $state('');
  let receiveStorageValue = $state('');
  let receiveQuantity = $state('');
  let receiving = $state(false);
  let receiveMessage = $state('');
  let receiveError = $state('');

  async function doReceiveIntoStorage() {
    if (!session.current?.businessName || !selectedName || !receiveQuantity) return;
    receiving = true;
    receiveError = '';
    receiveMessage = '';
    try {
      // Physical movement first, then the canned VALUE entry — see docs/pm-frontend-reference.md.
      const business = asBusinessName(session.current.businessName);
      const ledger = asLedgerName(session.current.ledgerName);
      const quantity = Number(receiveQuantity);
      const combinationValues = receiveGrouping && receiveStorageValue ? [receiveStorageValue] : undefined;
      const combinationShape: [string, string][] | undefined = receiveGrouping && receiveStorageValue ? [[receiveGrouping, receiveGrouping]] : undefined;
      const reference = freshReference(`RECEIVE-${selectedName}`);
      await receiveIntoStorageStock(asLocationName(receiveLocation), {
        business,
        ledger,
        reference,
        itemName: asItemName(selectedName),
        quantity,
        combinationValues,
        combinationShape,
      }, 'Receive Into Storage');
      const resolved = await resolveReceiveAccounts({
        business,
        itemName: asItemName(selectedName),
        combinationValues,
        combinationShape,
      });
      const builtLines = receiveIntoStorageLines({ quantity, resolved });
      if (builtLines.length > 0) {
        const valueReference = `${reference}-VALUE`;
        for (const line of builtLines) {
          await stageLine({ reference: valueReference, business, ledger, account: asAccountName(line.account), amount_minor: line.amount_minor }, 'Receive Into Storage');
        }
        await postJournalEntry(valueReference, business, ledger, 'Receive Into Storage');
      }
      receiveMessage = translations.current['Stock received.'] ?? 'Stock received.';
      receiveQuantity = '';
    } catch (e) {
      receiveError = e instanceof ApiError ? e.message : 'Could not receive stock.';
    } finally {
      receiving = false;
    }
  }

  let sourceNotes = $state('');
  let savingSource = $state(false);

  async function loadAll() {
    loading = true;
    try {
      const [entityTree, itemsResult, loadedLocations, loadedGroupings] = await Promise.all([
        getEntityTree(session.current?.businessName), session.current?.businessName ? listItems(session.current.businessName) : Promise.resolve({ rows: [], totalCount: 0 }),
        session.current?.businessName ? listLocations(asBusinessName(session.current.businessName)) : Promise.resolve([]),
        session.current?.businessName ? getHierarchy(session.current.businessName) : Promise.resolve([]),
      ]);
      entities = entityTree;
      items = itemsResult.rows;
      locations = loadedLocations;
      hierarchyGroupings = loadedGroupings;
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  }

  onMount(loadAll);

  let manufacturers = $derived(entities.filter((e) => entities.find((p) => p.id === e.parent_id)?.name === 'Manufacturers'));
  let providers = $derived(entities.filter((e) => entities.find((p) => p.id === e.parent_id)?.name === 'Accounts Payable'));

  // Legacy-root fallback, mirroring resolveBusinessLocationsRootId — see docs/pm-frontend-reference.md.
  const itemsRoot = () => {
    const biz = entities.find((e) => e.name === session.current?.businessName);
    if (biz) {
      const scoped =
        entities.find((e) => e.name === 'Items' && e.parent_id === biz.id) ??
        entities.find((e) => e.name === `${biz.name} Items` && e.parent_id === biz.id);
      if (scoped) return scoped;
    }
    return entities.find((e) => e.name === 'Items');
  };

  // One id->children index, built once — see docs/pm-frontend-reference.md.
  let childrenByParentId = $derived.by(() => {
    const map = new Map<number, EntityNode[]>();
    for (const e of entities) {
      if (e.parent_id == null) continue;
      const list = map.get(e.parent_id) ?? [];
      list.push(e);
      map.set(e.parent_id, list);
    }
    return map;
  });

  interface CategoryTreeNode {
    entity: EntityNode;
    items: ItemSummary[];
    children: CategoryTreeNode[];
  }
  let categoryTree = $derived.by(() => {
    const root = itemsRoot();
    if (!root) return [];
    const itemByName = new Map(items.map((i) => [i.name, i]));
    const buildCategory = (categoryEntity: EntityNode): CategoryTreeNode => {
      const kids = (childrenByParentId.get(categoryEntity.id) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
      const childCategories: CategoryTreeNode[] = [];
      const childItems: ItemSummary[] = [];
      for (const kid of kids) {
        const asItem = itemByName.get(kid.name);
        if (asItem) childItems.push(asItem);
        else childCategories.push(buildCategory(kid));
      }
      return { entity: categoryEntity, items: childItems.sort((a, b) => a.name.localeCompare(b.name)), children: childCategories };
    };
    return (childrenByParentId.get(root.id) ?? [])
      .filter((e) => !itemByName.has(e.name))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(buildCategory);
  });

  // Items with no category at all — see docs/pm-frontend-reference.md.
  let uncategorizedItems = $derived.by(() => {
    const root = itemsRoot();
    if (!root) return [];
    const itemByName = new Map(items.map((i) => [i.name, i]));
    return (childrenByParentId.get(root.id) ?? [])
      .filter((e) => itemByName.has(e.name))
      .map((e) => itemByName.get(e.name)!)
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  async function reloadTreeAndItems() {
    entities = await getEntityTree(session.current?.businessName);
    if (session.current?.businessName) items = (await listItems(session.current.businessName)).rows;
  }

  function selectCategory(name: string) {
    selection = { type: 'category', name };
  }

  async function selectItem(name: string, category: string) {
    selection = { type: 'item', name, category };
    error = '';
    message = '';
    try {
      item = (await getItem(asItemName(name))) ?? { description: null, unit_of_measure: null, upc: null };
      sources = await listItemSources(asItemName(name));
      bomComponents = (await getBomComponents(name)).components;
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not load item details.';
    }
  }

  // --- Top-level category creation (Insert with nothing/an item selected) ---
  let addingCategory = $state(false);
  let newCategoryNameRoot = $state('');
  let categoryError = $state('');
  async function addTopLevelCategory() {
    if (!newCategoryNameRoot.trim()) return;
    const root = itemsRoot();
    if (!root) return;
    categoryError = '';
    try {
      await createEntity({ name: newCategoryNameRoot.trim(), parentId: root.id }, 'Create Entity');
      newCategoryNameRoot = '';
      addingCategory = false;
      entities = await getEntityTree(session.current?.businessName);
    } catch (e) {
      categoryError = e instanceof ApiError ? e.message : 'Could not create category.';
    }
  }

  // --- Subcategory creation (link button, not Insert/Delete) — see docs/pm-frontend-reference.md.
  let addingSubcategoryUnder: string | null = $state(null);
  let newSubcategoryName = $state('');
  let subcategoryError = $state('');
  function startAddingSubcategory(categoryName: string) {
    addingSubcategoryUnder = categoryName;
    newSubcategoryName = '';
    subcategoryError = '';
  }
  async function addSubcategory(parentCategoryName: string) {
    if (!newSubcategoryName.trim()) return;
    const parentId = entities.find((e) => e.name === parentCategoryName)?.id;
    if (!parentId) return;
    subcategoryError = '';
    try {
      await createEntity({ name: newSubcategoryName.trim(), parentId }, 'Create Entity');
      newSubcategoryName = '';
      addingSubcategoryUnder = null;
      entities = await getEntityTree(session.current?.businessName);
    } catch (e) {
      subcategoryError = e instanceof ApiError ? e.message : 'Could not create subcategory.';
    }
  }

  // --- Item creation (Insert with a category selected) ---
  let addingItemUnder: string | null = $state(null);
  let newItemNameField = $state('');
  let addingItem = $state(false);
  let itemAddError = $state('');
  async function addItemUnderCategory(categoryName: string) {
    if (!newItemNameField.trim()) return;
    const parentId = entities.find((e) => e.name === categoryName)?.id;
    if (!parentId) return;
    addingItem = true;
    itemAddError = '';
    try {
      await createEntity({ name: newItemNameField, parentId }, 'Create Entity');
      // setItem ensures the item row exists immediately — see docs/pm-frontend-reference.md.
      await setItem(newItemNameField, { description: null, unit_of_measure: null, upc: null });
      const created = newItemNameField;
      newItemNameField = '';
      addingItemUnder = null;
      await reloadTreeAndItems();
      await selectItem(created, categoryName);
    } catch (e) {
      itemAddError = e instanceof ApiError ? e.message : 'Could not add item.';
    } finally {
      addingItem = false;
    }
  }

  // --- Insert/Delete callbacks dispatched by TreeEditor.svelte — see docs/pm-frontend-reference.md.
  function handleInsert() {
    if (selection?.type === 'category') {
      addingItemUnder = selection.name;
      newItemNameField = '';
      itemAddError = '';
    } else {
      addingCategory = true;
      newCategoryNameRoot = '';
      categoryError = '';
    }
  }

  async function deleteSelected() {
    if (!selection) return;
    const label = selection.type === 'category' ? 'category' : 'item';
    if (!confirm(`Delete ${label} "${translations.current[selection.name] ?? selection.name}"? This cannot be undone.`)) return;
    try {
      const target = entities.find((e) => e.name === selection!.name);
      if (!target) throw new Error(`${translations.current['No real entity named'] ?? 'No real entity named'} "${selection!.name}".`);
      await revokeEntity(target.id);
      selection = null;
      await reloadTreeAndItems();
    } catch (e) {
      error = e instanceof ApiError ? e.message : `Could not delete this ${label}.`;
    }
  }

  function handleDelete() {
    if (selection) deleteSelected();
  }

  // Dynamic keyboard-hint text — see docs/pm-frontend-reference.md.
  let hintText = $derived.by(() => {
    if (selection?.type === 'category') {
      return translations.current['Press Insert to add an item in this category, or Delete to remove it. Use "+ Subcategory" to nest a category within it instead.'] ??
        'Press Insert to add an item in this category, or Delete to remove it. Use "+ Subcategory" to nest a category within it instead.';
    } else if (selection?.type === 'item') {
      return translations.current['Press Delete to remove this item. Select a category to add something within it.'] ??
        'Press Delete to remove this item. Select a category to add something within it.';
    }
    return translations.current['Select a category, then press Insert to add an item within it — or press Insert here to add a new top-level category.'] ??
      'Select a category, then press Insert to add an item within it — or press Insert here to add a new top-level category.';
  });

  async function saveItem() {
    if (!selectedName) return;
    savingItem = true;
    error = '';
    message = '';
    try {
      await setItem(selectedName, item);
      if (session.current?.businessName) items = (await listItems(session.current.businessName)).rows;
      message = `Saved ${selectedName}.`;
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not save item.';
    } finally {
      savingItem = false;
    }
  }

  async function addSource() {
    if (!selectedName || !sourceProvider) {
      error = 'A provider is required.';
      return;
    }
    savingSource = true;
    error = '';
    try {
      await addOrUpdateItemSource(asItemName(selectedName), {
        manufacturerName: sourceManufacturer || null,
        vendorName: asProviderName(sourceProvider),
        vendorSku: sourceSku || null,
        vendorUpc: sourceUpc || null,
        priceMinor: sourcePrice ? Math.round(Math.abs(Number(sourcePrice)) * 100) : null,
        currency: sourceCurrency.trim().toUpperCase() || null,
        packageQuantity: sourcePackageQty ? Math.round(Math.abs(Number(sourcePackageQty))) : null,
        isPreferred: sourcePreferred,
        preferenceNotes: sourceNotes || null,
      }, 'Set Item Cost and Pack Size');
      sources = await listItemSources(asItemName(selectedName));
      if (session.current?.businessName) items = (await listItems(session.current.businessName)).rows;
      sourceManufacturer = '';
      sourceProvider = '';
      sourceSku = '';
      sourceUpc = '';
      sourcePrice = '';
      sourceCurrency = '';
      sourcePackageQty = '';
      sourcePreferred = false;
      sourceNotes = '';
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not save this source.';
    } finally {
      savingSource = false;
    }
  }

  async function removeSource(id: number) {
    error = '';
    try {
      await deleteItemSource(id);
      sources = sources.filter((s) => s.id !== id);
      if (session.current?.businessName) items = (await listItems(session.current.businessName)).rows;
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not remove this source.';
    }
  }

  async function addBomComponent() {
    if (!selectedName || !bomComponentItem || !bomQuantity) return;
    const business = session.current?.businessName;
    if (!business) return;
    savingBom = true;
    error = '';
    try {
      const result = await setBomComponent(selectedName, business, bomComponentItem, parseFloat(bomQuantity), bomUnit);
      bomComponents = result.components;
      bomComponentItem = '';
      bomQuantity = '';
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not save this Bill of Materials component.';
    } finally {
      savingBom = false;
    }
  }

  async function removeBomComponent(component: string) {
    if (!selectedName) return;
    error = '';
    try {
      await deleteBomComponent(selectedName, component);
      bomComponents = bomComponents.filter((c) => c.component !== component);
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not remove this component.';
    }
  }

  const fmt = (minorUnits: number | null) => (minorUnits == null ? '' : formatAmount(minorUnits, auth.current?.user.number_format ?? '1 000.00'));
</script>

<svelte:head><title>{translations.current['Inventory Catalog'] ?? 'Inventory Catalog'}</title></svelte:head>

{#snippet categoryRow(node: CategoryTreeNode)}
  <div class="tree-category">
    <button type="button" class="tree-item category" class:active={selection?.type === 'category' && selection.name === node.entity.name} onclick={() => selectCategory(node.entity.name)}>
      {translations.current[node.entity.name] ?? node.entity.name}
    </button>
    <div class="tree-children">
      {#each node.children as child (child.entity.id)}
        {@render categoryRow(child)}
      {/each}
      {#each node.items as it (it.name)}
        <button type="button" class="tree-item item" class:active={selection?.type === 'item' && selection.name === it.name} onclick={() => selectItem(it.name, node.entity.name)}>
          <span>{translations.current[it.name] ?? it.name}</span>
          {#if it.source_count > 0}<span class="count">{it.source_count} source{it.source_count === 1 ? '' : 's'}</span>{/if}
        </button>
      {/each}
      {#if addingItemUnder === node.entity.name}
        <div class="inline-add">
          <input
            bind:value={newItemNameField}
            placeholder={translations.current['New item name'] ?? 'New item name'}
            onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItemUnderCategory(node.entity.name); } }}
          />
          <button class="btn small" onclick={() => addItemUnderCategory(node.entity.name)} disabled={addingItem || !newItemNameField.trim()}>{translations.current['Add'] ?? 'Add'}</button>
          <button class="btn small secondary" onclick={() => (addingItemUnder = null)}>{translations.current['Cancel'] ?? 'Cancel'}</button>
        </div>
        {#if itemAddError}<p class="error small">{itemAddError}</p>{/if}
      {/if}
      {#if addingSubcategoryUnder === node.entity.name}
        <div class="inline-add">
          <input
            bind:value={newSubcategoryName}
            placeholder={translations.current['Subcategory name'] ?? 'Subcategory name'}
            onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubcategory(node.entity.name); } }}
          />
          <button class="btn small" onclick={() => addSubcategory(node.entity.name)} disabled={!newSubcategoryName.trim()}>{translations.current['Add'] ?? 'Add'}</button>
          <button class="btn small secondary" onclick={() => (addingSubcategoryUnder = null)}>{translations.current['Cancel'] ?? 'Cancel'}</button>
        </div>
        {#if subcategoryError}<p class="error small">{subcategoryError}</p>{/if}
      {:else if selection?.type === 'category' && selection.name === node.entity.name}
        <button type="button" class="link-button" onclick={() => startAddingSubcategory(node.entity.name)}>+ {translations.current['Subcategory'] ?? 'Subcategory'}</button>
      {/if}
    </div>
  </div>
{/snippet}

<fieldset class="page-title">
  <legend>{translations.current['Inventory Catalog'] ?? 'Inventory Catalog'}</legend>
  <p class="intro">{translations.current['A item\'s canonical details are separate from who supplies it. The same item is routinely available from more than one manufacturer, through more than one provider, at different prices and package sizes — and which one you prefer isn\'t always about price. Mark one preferred and say why: local stock, package size, reliability, whatever the real reason is.'] ?? 'A item\'s canonical details are separate from who supplies it. The same item is routinely available from more than one manufacturer, through more than one provider, at different prices and package sizes — and which one you prefer isn\'t always about price. Mark one preferred and say why: local stock, package size, reliability, whatever the real reason is.'}</p>

  {#if loading}
    <p class="center-text">Loading…</p>
  {:else}
    {#if error}<p class="error">{error}</p>{/if}

    <div class="layout">
      <TreeEditor
        legend={translations.current['Categories and items'] ?? 'Categories and items'}
        {hintText}
        onInsert={handleInsert}
        onDelete={handleDelete}
      >
        {#if uncategorizedItems.length > 0}
          <div class="tree-section">
            <p class="tree-heading">{translations.current['Uncategorized'] ?? 'Uncategorized'}</p>
            {#each uncategorizedItems as it (it.name)}
              <button type="button" class="tree-item item" class:active={selection?.type === 'item' && selection.name === it.name} onclick={() => selectItem(it.name, itemsRoot()?.name ?? 'Items')}>
                <span>{translations.current[it.name] ?? it.name}</span>
                {#if it.source_count > 0}<span class="count">{it.source_count} source{it.source_count === 1 ? '' : 's'}</span>{/if}
              </button>
            {/each}
          </div>
        {/if}

        {#if categoryTree.length === 0 && uncategorizedItems.length === 0}
          <p class="empty">{translations.current['None yet.'] ?? 'None yet.'}</p>
        {/if}

        {#each categoryTree as node (node.entity.id)}
          {@render categoryRow(node)}
        {/each}

        <div class="tree-section">
          {#if addingCategory}
            <div class="inline-add">
              <input
                bind:value={newCategoryNameRoot}
                placeholder={translations.current['Category name'] ?? 'Category name'}
                onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTopLevelCategory(); } }}
              />
              <button class="btn small" onclick={addTopLevelCategory} disabled={!newCategoryNameRoot.trim()}>{translations.current['Add'] ?? 'Add'}</button>
              <button class="btn small secondary" onclick={() => (addingCategory = false)}>{translations.current['Cancel'] ?? 'Cancel'}</button>
            </div>
          {/if}
          {#if categoryError}<p class="error small">{categoryError}</p>{/if}
        </div>
      </TreeEditor>

      <div class="detail-panel">
        {#if !selection}
          <p class="hint">{translations.current['Select a category or item on the left — Insert adds within whatever\'s selected, Delete removes it.'] ?? 'Select a category or item on the left — Insert adds within whatever\'s selected, Delete removes it.'}</p>
        {:else if selection.type === 'category'}
          <p class="hint">{translations.current['A category is purely an organizing grouping — press Insert to add a real item within it, "+ Subcategory" to nest a further category, or Delete to remove this category.'] ?? 'A category is purely an organizing grouping — press Insert to add a real item within it, "+ Subcategory" to nest a further category, or Delete to remove this category.'}</p>
        {:else if selection.type === 'item'}
          <div class="detail">
            {#if message}<p class="success">{message}</p>{/if}
            <div class="card form-card">
              <h3>{selectedName}</h3>
              <p class="category-line">{translations.current['Category:'] ?? 'Category:'} <strong>{translations.current[selection.category] ?? selection.category}</strong></p>
              <fieldset>
                <legend>{translations.current['Description'] ?? 'Description'}</legend>
                <input bind:value={item.description} placeholder="optional" />
              </fieldset>
              <div class="row-2">
                <fieldset>
                  <legend>{translations.current['Unit of measure'] ?? 'Unit of measure'}</legend>
                  <input bind:value={item.unit_of_measure} placeholder="e.g. each" />
                </fieldset>
                <fieldset>
                  <legend>{translations.current['UPC'] ?? 'UPC'}</legend>
                  <input bind:value={item.upc} placeholder="optional" />
                </fieldset>
              </div>
              <button class="btn" onclick={saveItem} disabled={savingItem}>{savingItem ? (translations.current['Saving'] ?? 'Saving…') : (translations.current['Save'] ?? 'Save')}</button>
            </div>

            <div class="card sources-card">
              <h3>{translations.current['Sources'] ?? 'Sources'}</h3>
              {#if sources.length === 0}
                <p class="empty">{translations.current['No sources yet.'] ?? 'No sources yet.'}</p>
              {/if}
              {#each sources as s}
                <div class="source-row" class:preferred={s.is_preferred}>
                  <div class="source-main">
                    <strong>{s.vendor_name}</strong>
                    {#if s.manufacturer_name}<span class="dim"> via {s.manufacturer_name}</span>{/if}
                    {#if s.is_preferred}<span class="badge">preferred</span>{/if}
                    <button type="button" class="remove" onclick={() => removeSource(s.id)}>✕</button>
                  </div>
                  <div class="source-details dim">
                    {#if s.price_minor != null}{fmt(s.price_minor)}{#if s.currency} ({s.currency}){/if}{/if}
                    {#if s.package_quantity != null} · pack of {s.package_quantity}{/if}
                    {#if s.vendor_sku}· SKU {s.vendor_sku}{/if}
                  </div>
                  {#if s.preference_notes}<div class="source-notes">{s.preference_notes}</div>{/if}
                </div>
              {/each}

              <h4>{translations.current['Add a source'] ?? 'Add a source'}</h4>
              <div class="row-2">
                <fieldset>
                  <legend>{translations.current['Manufacturer'] ?? 'Manufacturer'}</legend>
                  <select bind:value={sourceManufacturer}>
                    <option value="">(not tracked)</option>
                    {#each manufacturers as m}<option value={translations.current[m.name] ?? m.name}>{translations.current[m.name] ?? m.name}</option>{/each}
                  </select>
                </fieldset>
                <fieldset>
                  <legend>{translations.current['Provider'] ?? 'Provider'}</legend>
                  <select bind:value={sourceProvider}>
                    <option value="">Select provider…</option>
                    {#each providers as v}<option value={translations.current[v.name] ?? v.name}>{translations.current[v.name] ?? v.name}</option>{/each}
                  </select>
                </fieldset>
              </div>
              <div class="row-2">
                <fieldset>
                  <legend>{translations.current['Provider SKU'] ?? 'Provider SKU'}</legend>
                  <input bind:value={sourceSku} placeholder="optional" />
                </fieldset>
                <fieldset>
                  <legend>{translations.current['Provider UPC'] ?? 'Provider UPC'}</legend>
                  <input bind:value={sourceUpc} placeholder="optional" />
                </fieldset>
              </div>
              <div class="row-2">
                <fieldset>
                  <legend>{translations.current['Price'] ?? 'Price'}</legend>
                  <input bind:value={sourcePrice} placeholder="0.00" inputmode="decimal" />
                </fieldset>
                <fieldset class="currency-field">
                  <legend>{translations.current['Currency'] ?? 'Currency'}</legend>
                  <input bind:value={sourceCurrency} placeholder={translations.current['home'] ?? 'home'} maxlength="6" title={translations.current['Leave blank for the home currency - a real, different code (e.g. USD) is a real, separate, independently-priced source for the same provider, per docs/multicurrency-design.md.'] ?? 'Leave blank for the home currency - a real, different code (e.g. USD) is a real, separate, independently-priced source for the same provider.'} />
                </fieldset>
                <fieldset>
                  <legend>{translations.current['Package quantity'] ?? 'Package quantity'}</legend>
                  <input bind:value={sourcePackageQty} placeholder="e.g. 100" inputmode="numeric" />
                </fieldset>
              </div>
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={sourcePreferred} />
                Preferred source
              </label>
              <fieldset>
                <legend>{translations.current['Why (not required to be about price)'] ?? 'Why (not required to be about price)'}</legend>
                <input bind:value={sourceNotes} placeholder="e.g. keeps more in local stock" />
              </fieldset>
              <button class="btn" onclick={addSource} disabled={savingSource}>{savingSource ? 'Saving…' : 'Add source'}</button>
            </div>

            {#if locations.length > 0}
              <div class="card">
                <h3>{translations.current['Receive Into Storage'] ?? 'Receive Into Storage'}</h3>
                <p class="hint">
                  {translations.current['Optionally into a real, named storage combination — set these up under Setup → Hierarchies first.'] ??
                    'Optionally into a real, named storage combination — set these up under Setup → Hierarchies first.'}
                </p>
                {#if receiveError}<p class="error">{receiveError}</p>{/if}
                {#if receiveMessage}<p class="success">{receiveMessage}</p>{/if}
                <div class="row-2">
                  <fieldset>
                    <legend>{translations.current['Location'] ?? 'Location'}</legend>
                    <select bind:value={receiveLocation}>
                      <option value="">{translations.current['Select location…'] ?? 'Select location…'}</option>
                      {#each locations as loc}<option value={loc.name}>{loc.name}</option>{/each}
                    </select>
                  </fieldset>
                  <fieldset>
                    <legend>{translations.current['Quantity'] ?? 'Quantity'}</legend>
                    <input bind:value={receiveQuantity} inputmode="numeric" placeholder="e.g. 24" />
                  </fieldset>
                </div>
                {#if hierarchyGroupings.length > 0}
                  <div class="row-2">
                    <fieldset>
                      <legend>{translations.current['Storage grouping (optional)'] ?? 'Storage grouping (optional)'}</legend>
                      <select bind:value={receiveGrouping}>
                        <option value="">{translations.current['None — plain receipt'] ?? 'None — plain receipt'}</option>
                        {#each hierarchyGroupings as g}<option value={g.grouping}>{g.grouping}</option>{/each}
                      </select>
                    </fieldset>
                    {#if receiveGrouping}
                      {@const values = hierarchyGroupings.find((g) => g.grouping === receiveGrouping)?.values ?? []}
                      <fieldset>
                        <legend>{translations.current['Value'] ?? 'Value'}</legend>
                        <select bind:value={receiveStorageValue}>
                          <option value="">{translations.current['Select…'] ?? 'Select…'}</option>
                          {#each values as v}<option value={v}>{v}</option>{/each}
                        </select>
                      </fieldset>
                    {/if}
                  </div>
                {/if}
                <button class="btn small" onclick={doReceiveIntoStorage} disabled={receiving || !receiveLocation || !receiveQuantity}>
                  {receiving ? '…' : (translations.current['Receive'] ?? 'Receive')}
                </button>
              </div>
            {/if}

            <div class="card bom-card">
              <h3>{translations.current['Bill of Materials'] ?? 'Bill of Materials'}</h3>
              <p class="hint">{translations.current['For assemblies built from other items — a cocktail, a glass of wine, a nip with mixer.'] ?? 'For assemblies built from other items — a cocktail, a glass of wine, a nip with mixer.'}</p>
              {#if bomComponents.length === 0}
                <p class="empty">{translations.current['No components yet.'] ?? 'No components yet.'}</p>
              {/if}
              {#each bomComponents as c}
                <div class="bom-row">
                  <span><strong>{c.component}</strong> — {c.quantity}{c.unit}</span>
                  <button type="button" class="remove" onclick={() => removeBomComponent(c.component)}>✕</button>
                </div>
              {/each}

              <h4>{translations.current['Add a component'] ?? 'Add a component'}</h4>
              <div class="row-2">
                <fieldset>
                  <legend>{translations.current['Component'] ?? 'Component'}</legend>
                  <select bind:value={bomComponentItem}>
                    <option value="">Select item…</option>
                    {#each items as i}<option value={i.name}>{translations.current[i.name] ?? i.name}</option>{/each}
                  </select>
                </fieldset>
                <fieldset>
                  <legend>{translations.current['Quantity'] ?? 'Quantity'}</legend>
                  <input bind:value={bomQuantity} placeholder="e.g. 30" inputmode="decimal" />
                </fieldset>
              </div>
              <fieldset>
                <legend>{translations.current['Unit'] ?? 'Unit'}</legend>
                <select bind:value={bomUnit}>
                  <option value="ml">ml</option>
                  <option value="g">g</option>
                  <option value="unit">unit</option>
                  <option value="nip">nip</option>
                  <option value="glass">glass</option>
                </select>
              </fieldset>
              <button class="btn" onclick={addBomComponent} disabled={savingBom}>{savingBom ? 'Saving…' : (translations.current['Add component'] ?? 'Add component')}</button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</fieldset>

<style>
  .center-text {
    text-align: center;
  }

  .empty {
    color: var(--ink-soft);
    font-size: var(--font-size-base);
    margin: 0;
  }

  .layout {
    display: flex;
    gap: 1.2rem;
    max-width: 1100px;
    margin: 0 auto;
    align-items: flex-start;
  }

  .detail-panel {
    flex: 1;
    min-height: 300px;
  }

  .tree-section {
    margin-bottom: 0.9rem;
  }

  .tree-heading {
    font-weight: 600;
    font-size: var(--font-size-medium);
    margin: 0 0 0.3rem;
  }

  .tree-category {
    margin: 0.3rem 0;
  }

  .tree-children {
    margin: 0.1rem 0 0.1rem 0.8rem;
  }

  .tree-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 0.2rem 0.4rem;
    font-size: var(--font-size-base);
    cursor: pointer;
    border-radius: 4px;
  }

  .tree-item.category {
    font-weight: 600;
    font-size: var(--font-size-medium);
    margin: 0 0 0.2rem;
    padding: 0.15rem 0.3rem;
    display: block;
  }

  .tree-item.active {
    background: #f2e6c9;
  }

  .count {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
  }

  .inline-add {
    display: flex;
    gap: 0.3rem;
    align-items: center;
    margin: 0.3rem 0;
    flex-wrap: wrap;
  }

  .inline-add input {
    font-size: var(--font-size-small);
    padding: 0.15rem 0.3rem;
    border: 1px solid var(--rule);
    border-radius: 4px;
  }

  .btn.small {
    padding: 0.15rem 0.5rem;
    font-size: var(--font-size-small);
  }

  .link-button {
    background: none;
    border: none;
    color: var(--brass-dark, #8a6d3b);
    font-size: var(--font-size-small);
    cursor: pointer;
    padding: 0.2rem 0;
    text-align: left;
    align-self: flex-start;
    display: block;
  }

  .hint {
    color: var(--ink-soft);
    font-size: var(--font-size-medium);
  }

  .error {
    color: var(--debit, #a33a2e);
  }

  .error.small {
    font-size: var(--font-size-small);
    margin: 0.2rem 0;
  }

  .category-line {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    margin: -0.4rem 0 0.2rem;
  }

  .detail {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-card,
  .sources-card {
    padding: 1rem 1.2rem 1.3rem;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }
  .row-2 {
    display: flex;
    gap: 0.8rem;
  }

  .row-2 > * {
    flex: 1;
  }
  .currency-field {
    flex: 0 0 6rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: var(--font-size-small);
    color: var(--ink-soft);
  }

  .checkbox-label {
    flex-direction: row;
    align-items: center;
    gap: 0.4rem;
  }

  .source-row {
    border: 1px solid var(--rule);
    border-radius: 6px;
    padding: 0.5rem 0.7rem;
    margin-bottom: 0.5rem;
  }

  .source-row.preferred {
    border-color: var(--brass);
    background: var(--paper-dim, #f9f5ec);
  }

  .source-main {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .dim {
    color: var(--ink-soft);
  }

  .badge {
    font-size: var(--font-size-small);
    background: var(--brass);
    color: white;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
  }

  .remove {
    margin-left: auto;
    background: none;
    border: none;
    color: var(--debit, #b1442e);
    cursor: pointer;
  }

  .source-details {
    font-size: var(--font-size-small);
    margin-top: 0.2rem;
  }

  .source-notes {
    font-size: var(--font-size-small);
    font-style: italic;
    margin-top: 0.2rem;
  }

  .success {
    color: var(--credit);
  }

  .secondary {
    background: transparent;
    border: 1px solid var(--rule-strong);
    color: var(--ink);
  }
</style>
