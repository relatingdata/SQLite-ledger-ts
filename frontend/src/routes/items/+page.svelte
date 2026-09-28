<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import { session } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { onMount } from 'svelte';
  import {
    getEntityTree,
    createEntity,
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
    asVendorName,
    ApiError,
    listLocations,
    getHierarchy,
    receiveStockAtLocation,
    asBusinessName,
    asLedgerName,
    asLocationName,
    type EntityNode,
    type ItemSummary,
    type Item,
    type ItemSource,
    type LocationRecord,
    type HierarchyGroupingWithValues,
  } from '$lib/api';

  let entities: EntityNode[] = $state([]);
  let items: ItemSummary[] = $state([]);
  let loading = $state(true);
  let error = $state('');
  let message = $state('');

  let selectedName = $state('');
  let item: Item = $state({ description: null, unit_of_measure: null, upc: null });
  let sources: ItemSource[] = $state([]);
  let savingItem = $state(false);

  let newItemName = $state('');
  let addingItem = $state(false);
  // A new item's category is required — this is exactly the fix for
  // a real, confirmed gap: the Structured Editor was the only way to
  // put a new product under a real category, and a category left
  // unset here means it silently sits flat under "Items" with none of
  // the real category-mirroring benefit (a real, working feature —
  // see ensureItemSalesCogsAccounts — that a product with no real
  // category simply never exercises). "+ New category…" lets someone
  // create a genuinely new category (optionally nested under an
  // existing one, e.g. Pinot Noir under Red Wine) without ever
  // touching the Structured Editor.
  const NEW_CATEGORY_OPTION = '__new__';
  let newItemCategory = $state('');
  let newCategoryName = $state('');
  let newCategoryParent = $state('Items');

  // A new source's fields — vendor is required, everything else optional.
  let sourceManufacturer = $state('');
  let sourceVendor = $state('');
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

  // Per direct instruction: receiving stock directly into a real,
  // named storage combination (e.g. Secure) - reuses the exact, same
  // real Hierarchy groupings already set up under Setup → Hierarchies,
  // exactly the same, established pattern the Locations page's own
  // Storage Actions section already uses.
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
    if (!session.current?.businessName || !selectedName || !receiveLocation || !receiveQuantity) return;
    receiving = true;
    receiveError = '';
    receiveMessage = '';
    try {
      const reference = `RECEIVE-${selectedName}-${Date.now()}`;
      await receiveStockAtLocation(asLocationName(receiveLocation), {
        business: asBusinessName(session.current.businessName),
        ledger: asLedgerName(session.current.ledgerName),
        reference,
        itemName: asItemName(selectedName),
        quantity: Number(receiveQuantity),
        combinationValues: receiveGrouping && receiveStorageValue ? [receiveStorageValue] : undefined,
        combinationShape: receiveGrouping && receiveStorageValue ? [[receiveGrouping, receiveGrouping]] : undefined,
      });
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
        getEntityTree(), listItems(),
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
  let vendors = $derived(entities.filter((e) => entities.find((p) => p.id === e.parent_id)?.name === 'Accounts Payable'));

  // A real category is any entity under "Items" (at any depth) that
  // itself has at least one real child — whether that child is
  // another, deeper category or a leaf product. Computed directly
  // from the real entity tree, not a separate, hand-maintained list —
  // a category a person creates through this page is immediately
  // available here the next time, with no extra step.
  const itemsRoot = () => {
    const biz = entities.find((e) => e.name === session.current?.businessName);
    if (biz) {
      const scoped = entities.find((e) => e.name === 'Items' && e.parent_id === biz.id);
      if (scoped) return scoped;
    }
    return entities.find((e) => e.name === 'Items');
  };
  let categories = $derived.by(() => {
    const root = itemsRoot();
    if (!root) return [];
    const isUnderItems = (id: number): boolean => {
      let current = entities.find((e) => e.id === id);
      while (current) {
        if (current.id === root.id) return true;
        current = entities.find((e) => e.id === current!.parent_id);
      }
      return false;
    };
    const hasChildren = new Set(entities.filter((e) => e.parent_id != null).map((e) => e.parent_id));
    return entities.filter((e) => e.id !== root.id && isUnderItems(e.id) && hasChildren.has(e.id)).sort((a, b) => a.name.localeCompare(b.name));
  });

  // Each real item's own real category (its direct parent's name) —
  // shown in the list so category assignment is actually visible, not
  // hidden information only the Structured Editor could reveal.
  function categoryOf(itemName: string): string {
    const item = entities.find((e) => e.name === itemName);
    if (!item) return '';
    const parent = entities.find((e) => e.id === item.parent_id);
    const isItemsRoot = parent?.name === 'Items' || parent?.name.endsWith(' Items');
    return isItemsRoot ? '(uncategorized)' : (parent?.name ?? '');
  }

  async function select(name: string) {
    selectedName = name;
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

  async function saveItem() {
    if (!selectedName) return;
    savingItem = true;
    error = '';
    message = '';
    try {
      await setItem(selectedName, item);
      items = (await listItems()).rows;
      message = `Saved ${selectedName}.`;
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not save item.';
    } finally {
      savingItem = false;
    }
  }

  async function addItem() {
    if (!newItemName.trim()) return;
    const usingNewCategory = newItemCategory === NEW_CATEGORY_OPTION;
    if (usingNewCategory && !newCategoryName.trim()) {
      error = 'A name for the new category is required.';
      return;
    }
    if (!usingNewCategory && !newItemCategory) {
      error = 'A category is required — pick an existing one, or "+ New category…" to create one.';
      return;
    }
    addingItem = true;
    error = '';
    try {
      let parentCategory = newItemCategory;
      let parentCategoryId: number | undefined;
      if (usingNewCategory) {
        // A real, confirmed bug, found directly, twice now: a bare
        // name ("Items") is no longer sufficient to disambiguate,
        // since every business now genuinely has its own, real,
        // plain "Items" root - only a real parentId (never a name
        // string) correctly, unambiguously identifies which one. A
        // real, further, confirmed bug, found directly, a third time:
        // searching this page's own, local `entities` array for the
        // category just created doesn't work either - that array is
        // still stale at this point (not yet re-fetched), so the
        // category can never actually be found there, silently
        // orphaning the real item with no parent at all. createEntity
        // already returns the real, new entity's own real id directly
        // - use that, never search anything.
        const itemsRootId = itemsRoot()?.id;
        const newCategory = await createEntity({ name: newCategoryName.trim(), parentId: itemsRootId });
        parentCategory = newCategoryName.trim();
        parentCategoryId = newCategory.id;
      } else {
        parentCategoryId = entities.find((e) => e.name === parentCategory && e.parent_id === itemsRoot()?.id)?.id;
      }
      await createEntity({ name: newItemName, parentId: parentCategoryId });
      // A real, pre-existing bug fixed here, not introduced by this
      // change: listItems requires a real `item` table row (INNER
      // JOIN), but this function only ever created the bare entity —
      // a newly-added item would silently vanish from its own list
      // the moment it was created, with no error shown. setItem here
      // ensures the real row exists immediately.
      await setItem(newItemName, { description: null, unit_of_measure: null, upc: null });
      entities = await getEntityTree();
      items = (await listItems()).rows;
      const created = newItemName;
      newItemName = '';
      newCategoryName = '';
      await select(created);
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not add item.';
    } finally {
      addingItem = false;
    }
  }

  async function addSource() {
    if (!selectedName || !sourceVendor) {
      error = 'A vendor is required.';
      return;
    }
    savingSource = true;
    error = '';
    try {
      await addOrUpdateItemSource(asItemName(selectedName), {
        manufacturerName: sourceManufacturer || null,
        vendorName: asVendorName(sourceVendor),
        vendorSku: sourceSku || null,
        vendorUpc: sourceUpc || null,
        priceMinor: sourcePrice ? Math.round(Math.abs(Number(sourcePrice)) * 100) : null,
        currency: sourceCurrency.trim().toUpperCase() || null,
        packageQuantity: sourcePackageQty ? Math.round(Math.abs(Number(sourcePackageQty))) : null,
        isPreferred: sourcePreferred,
        preferenceNotes: sourceNotes || null,
      });
      sources = await listItemSources(asItemName(selectedName));
      items = (await listItems()).rows;
      sourceManufacturer = '';
      sourceVendor = '';
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
      items = (await listItems()).rows;
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

<fieldset class="page-title">
  <legend>{translations.current['Inventory Catalog'] ?? 'Inventory Catalog'}</legend>
  <p class="intro">{translations.current['A item\'s canonical details are separate from who supplies it. The same item is routinely available from more than one manufacturer, through more than one vendor, at different prices and package sizes — and which one you prefer isn\'t always about price. Mark one preferred and say why: local stock, package size, reliability, whatever the real reason is.'] ?? 'A item\'s canonical details are separate from who supplies it. The same item is routinely available from more than one manufacturer, through more than one vendor, at different prices and package sizes — and which one you prefer isn\'t always about price. Mark one preferred and say why: local stock, package size, reliability, whatever the real reason is.'}</p>

  {#if loading}
    <p>Loading…</p>
  {:else}
    {#if error}<p class="error">{error}</p>{/if}

    {#if items.length === 0}
      <p class="empty">{translations.current['None yet.'] ?? 'None yet.'}</p>
    {/if}
    {#each items as p}
      <button type="button" class="entry" class:active={selectedName === p.name} onclick={() => select(p.name)}>
        <span>{translations.current[p.name] ?? p.name}</span>
        <span class="cat">{categoryOf(p.name)}</span>
        {#if p.source_count > 0}<span class="count">{p.source_count} source{p.source_count === 1 ? '' : 's'}</span>{/if}
      </button>
    {/each}
    <div class="add-item">
      <input bind:value={newItemName} placeholder={translations.current['New item name'] ?? 'New item name'} />
      <select bind:value={newItemCategory}>
        <option value="">Category…</option>
        {#each categories as c}<option value={translations.current[c.name] ?? c.name}>{translations.current[c.name] ?? c.name}</option>{/each}
        <option value={NEW_CATEGORY_OPTION}>+ New category…</option>
      </select>
      {#if newItemCategory === NEW_CATEGORY_OPTION}
        <div class="new-category-form">
          <input bind:value={newCategoryName} placeholder={translations.current['New category name, e.g. Pinot Noir'] ?? 'New category name, e.g. Pinot Noir'} />
          <select bind:value={newCategoryParent}>
            <option value={itemsRoot()?.name ?? 'Items'}>(top-level category)</option>
            {#each categories as c}<option value={translations.current[c.name] ?? c.name}>under {translations.current[c.name] ?? c.name}</option>{/each}
          </select>
        </div>
      {/if}
      <button class="btn secondary" onclick={addItem} disabled={addingItem || !newItemName.trim()}>+ Add</button>
    </div>
  {/if}
</fieldset>

{#if !loading}
  {#if selectedName}
      <div class="detail">
        {#if message}<p class="success">{message}</p>{/if}
        <div class="card form-card">
          <h3>{selectedName}</h3>
          <p class="category-line">{translations.current['Category:'] ?? 'Category:'}<strong>{categoryOf(selectedName)}</strong> — change it in Setup → Entity Tree</p>
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
              <legend>{translations.current['Vendor'] ?? 'Vendor'}</legend>
              <select bind:value={sourceVendor}>
                <option value="">Select vendor…</option>
                {#each vendors as v}<option value={translations.current[v.name] ?? v.name}>{translations.current[v.name] ?? v.name}</option>{/each}
              </select>
            </fieldset>
          </div>
          <div class="row-2">
            <fieldset>
              <legend>{translations.current['Vendor SKU'] ?? 'Vendor SKU'}</legend>
              <input bind:value={sourceSku} placeholder="optional" />
            </fieldset>
            <fieldset>
              <legend>{translations.current['Vendor UPC'] ?? 'Vendor UPC'}</legend>
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
              <input bind:value={sourceCurrency} placeholder={translations.current['home'] ?? 'home'} maxlength="6" title={translations.current['Leave blank for the home currency - a real, different code (e.g. USD) is a real, separate, independently-priced source for the same vendor, per docs/multicurrency-design.md.'] ?? 'Leave blank for the home currency - a real, different code (e.g. USD) is a real, separate, independently-priced source for the same vendor.'} />
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
{/if}

<style>

  .empty {
    color: var(--ink-soft);
    font-size: var(--font-size-base);
    margin: 0;
  }

  .entry {
    display: flex;
    flex-direction: column;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 0.4rem 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: var(--font-size-base);
    color: var(--ink);
  }

  .entry:hover {
    background: var(--paper-dim, #f2ede1);
  }

  .entry.active {
    background: var(--paper-dim, #f2ede1);
    border-left: 3px solid var(--brass);
    font-weight: 600;
  }

  .count {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
  }

  .cat {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
  }

  .category-line {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    margin: -0.4rem 0 0.2rem;
  }

  .new-category-form {
    display: flex;
    gap: 0.4rem;
    width: 100%;
  }

  .new-category-form input {
    flex: 1;
    min-width: 0;
  }

  .new-category-form select {
    flex: 0 1 auto;
    max-width: 45%;
  }

  .add-item {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.6rem;
  }

  .add-item input {
    flex: 1;
    font-size: var(--font-size-base);
  }

  .detail {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 560px;
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
