<!--
  A brand-new TUI screen — no original web or TUI predecessor existed
  for this one. Browse the real per-business item catalog (listItems),
  edit an item's own basic fields (description/unit of measure/UPC,
  via getItem/setItem), and manage its real Bill of Materials
  (getBomComponents/setBomComponent/deleteBomComponent — the same
  stage-then-post mechanism setBomComponent's own backend call already
  collapses into one round trip).

  I on the list creates an item with no category, as the web
  Inventory Catalog's "+ Item (unassigned)" does: its name, then Enter
  (createUncategorizedItem in tui/src/api.ts). Giving it a category is
  done in Business Structure's Item Categories. BOM *component* lines
  name items that already exist.
-->
<script lang="ts">
  import { Box, Text } from 'sveltui';
  import { keyboard } from 'sveltui';
  import { onDestroy } from 'svelte';
  import {
    ApiError,
    asBusinessName,
    getBomComponents,
    getItem,
    listItems,
    createUncategorizedItem,
    setBomComponent,
    setItem,
    deleteBomComponent,
    type BomComponent,
    type Item,
    type ItemSummary,
  } from '../api.ts';
  import Panel from '../components/Panel.svelte';
  import TextInput from '../components/TextInput.svelte';
  import SelectList from '../components/SelectList.svelte';
  import { brass, ink, inkSoft } from '../theme.ts';

  type Step = 'list' | 'new-item' | 'description' | 'unit' | 'upc' | 'bom' | 'component-name' | 'component-qty' | 'component-unit' | 'saved';

  let { businessName, onBack }: { businessName: string; onBack: () => void } = $props();

  let step: Step = $state('list');
  let items: ItemSummary[] | null = $state(null);
  let listError: string | null = $state(null);

  let selectedName = $state('');
  let description = $state('');
  let unitOfMeasure = $state('');
  let upc = $state('');

  let bom: BomComponent[] = $state([]);
  let bomSelected = $state(0);
  let componentName = $state('');
  let componentQty = $state('');
  let componentUnit = $state('');

  let error: string | null = $state(null);
  let busy = $state(false);
  let message: string | null = $state(null);

  function loadItems() {
    return listItems(businessName)
      .then((r) => (items = r.rows))
      .catch((err) => (listError = err instanceof ApiError ? err.message : 'Could not load items.'));
  }
  void loadItems();

  let newItemName = $state('');
  async function createItem() {
    const name = newItemName.trim();
    if (!name || busy) return;
    busy = true;
    error = null;
    step = 'list';
    try {
      await createUncategorizedItem(businessName, name);
      message = `Created ${name}.`;
      await loadItems();
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not create the item.';
    } finally {
      busy = false;
    }
  }

  const unsubscribe = keyboard.on((event) => {
    if (event.key === 'Escape') {
      if (step === 'list') { onBack(); return true; }
      if (step === 'new-item') { step = 'list'; return true; }
      if (step === 'description') { step = 'list'; return true; }
      if (step === 'unit') { step = 'description'; return true; }
      if (step === 'upc') { step = 'unit'; return true; }
      if (step === 'bom') { step = 'upc'; return true; }
      if (step === 'component-name' || step === 'component-qty' || step === 'component-unit') { step = 'bom'; return true; }
      if (step === 'saved') { step = 'list'; return true; }
      return true;
    }
    if (step === 'list' && event.key === 'i') {
      newItemName = '';
      error = null;
      message = null;
      step = 'new-item';
      return true;
    }
    if (step !== 'bom') return;
    switch (event.key) {
      case 'ArrowDown':
        bomSelected = Math.min(bomSelected + 1, Math.max(bom.length - 1, 0));
        return true;
      case 'ArrowUp':
        bomSelected = Math.max(bomSelected - 1, 0);
        return true;
      default:
        if (event.key === 'i') {
          componentName = '';
          componentQty = '';
          componentUnit = '';
          step = 'component-name';
          return true;
        }
        if (event.key === 'd' && bom[bomSelected]) {
          void removeComponent(bomSelected);
          return true;
        }
        return false;
    }
  });
  onDestroy(unsubscribe);

  async function selectItem(name: string) {
    selectedName = name;
    message = null;
    error = null;
    try {
      const [item, components] = await Promise.all([getItem(name), getBomComponents(name)]);
      const loaded: Item | null = item;
      description = loaded?.description ?? '';
      unitOfMeasure = loaded?.unit_of_measure ?? '';
      upc = loaded?.upc ?? '';
      bom = components;
      bomSelected = 0;
      step = 'description';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not load this item.';
    }
  }

  async function saveFields() {
    busy = true; error = null;
    try {
      await setItem(selectedName, { description: description || null, unit_of_measure: unitOfMeasure || null, upc: upc || null });
      message = `Saved ${selectedName}.`;
      step = 'bom';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not save this item.';
    } finally { busy = false; }
  }

  async function addComponent() {
    const name = componentName.trim();
    const qty = Number(componentQty);
    const unit = componentUnit.trim();
    if (!name || !Number.isFinite(qty) || qty <= 0 || !unit) {
      error = 'A component needs a real item name, a positive quantity, and a unit.';
      step = 'bom';
      return;
    }
    busy = true; error = null;
    try {
      bom = await setBomComponent(selectedName, businessName, name, qty, unit);
      step = 'bom';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not add this component.';
      step = 'bom';
    } finally { busy = false; }
  }

  async function removeComponent(index: number) {
    const comp = bom[index];
    busy = true; error = null;
    try {
      await deleteBomComponent(selectedName, comp.component);
      bom = await getBomComponents(selectedName);
      bomSelected = Math.max(0, Math.min(bomSelected, bom.length - 1));
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not remove this component.';
    } finally { busy = false; }
  }

  const title = $derived(`Items & BOM — ${businessName}`);
</script>

{#if step === 'saved'}
  <Panel title={title} focused>
    <Text text={message ?? ''} color={brass} bold />
    <Text text="Escape back to the item list" color={inkSoft} dim />
  </Panel>
{:else if step === 'description' || step === 'unit' || step === 'upc'}
  <Panel title={`${title} — ${selectedName}`} focused>
    <Box flexDirection="row"><Box width={16}><Text text="Description" color={step === 'description' ? brass : ink} /></Box><TextInput bind:value={description} focused={step === 'description'} onSubmit={() => (step = 'unit')} /></Box>
    <Box flexDirection="row"><Box width={16}><Text text="Unit of measure" color={step === 'unit' ? brass : ink} /></Box><TextInput bind:value={unitOfMeasure} focused={step === 'unit'} onSubmit={() => (step = 'upc')} /></Box>
    <Box flexDirection="row"><Box width={16}><Text text="UPC" color={step === 'upc' ? brass : ink} /></Box><TextInput bind:value={upc} focused={step === 'upc'} onSubmit={() => void saveFields()} /></Box>
    <Text text={error ?? ''} color="red" />
    {#if busy}<Text text="Working…" color={inkSoft} />{/if}
    <Text text="Enter moves to the next field, saves on the last (and opens the BOM editor) · Escape back" color={inkSoft} dim />
  </Panel>
{:else if step === 'component-name' || step === 'component-qty' || step === 'component-unit'}
  <Panel title={`New BOM component — ${selectedName}`} focused>
    <Box flexDirection="row"><Box width={14}><Text text="Component" color={step === 'component-name' ? brass : inkSoft} /></Box><TextInput bind:value={componentName} focused={step === 'component-name'} onSubmit={() => (step = 'component-qty')} /></Box>
    <Box flexDirection="row"><Box width={14}><Text text="Quantity" color={step === 'component-qty' ? brass : inkSoft} /></Box><TextInput bind:value={componentQty} focused={step === 'component-qty'} onSubmit={() => (step = 'component-unit')} /></Box>
    <Box flexDirection="row"><Box width={14}><Text text="Unit" color={step === 'component-unit' ? brass : inkSoft} /></Box><TextInput bind:value={componentUnit} focused={step === 'component-unit'} onSubmit={() => void addComponent()} /></Box>
    <Text text="Must be another real, existing item's exact name · Enter moves to the next field · Escape cancels" color={inkSoft} dim />
    <Text text={error ?? ''} color="red" />
    {#if busy}<Text text="Working…" color={inkSoft} />{/if}
  </Panel>
{:else if step === 'bom'}
  <Panel title={`${title} — ${selectedName} — BOM`} focused>
    <Text text="I add a component · ↑/↓ select · D delete selected · Escape back to this item's fields" color={inkSoft} dim />
    <Text text={error ?? ''} color="red" />
    {#if busy}<Text text="Working…" color={inkSoft} />{/if}
    <Text
      text={
        bom.length === 0
          ? 'No BOM components yet.'
          : bom.map((c, i) => `${i === bomSelected ? '› ' : '  '}${c.component.padEnd(28)}qty ${c.quantity} ${c.unit}`).join('\n')
      }
      color={ink}
    />
  </Panel>
<!-- Loading, none and the list each have a Panel of its own: content that
     appears inside a Panel that stays mounted draws blank
     (docs/tui-design.md, "Running on Svelte 5.56"). -->
{:else if step === 'new-item'}
  <Panel title={`${title} — new item`} focused>
    <Box flexDirection="row"><Box width={10}><Text text="Name" color={brass} /></Box><TextInput bind:value={newItemName} focused onSubmit={() => void createItem()} /></Box>
    <Text text="Enter creates the item, with no category · Escape cancels" color={inkSoft} dim />
  </Panel>
{:else if items === null}
  <Panel title={title} focused>
    <Text text="The business's item catalog — I adds an item with no category; Enter opens an item's fields and BOM." color={inkSoft} />
    <Text text="I add an item · Enter opens an item · Escape back to menu" color={inkSoft} dim />
    <Text text={listError ?? error ?? message ?? (busy ? 'Working…' : '')} color={listError || error ? 'red' : inkSoft} />
    <Text text="Loading…" color={inkSoft} />
  </Panel>
{:else if items.length === 0}
  <Panel title={title} focused>
    <Text text="The business's item catalog — I adds an item with no category; Enter opens an item's fields and BOM." color={inkSoft} />
    <Text text="I add an item · Enter opens an item · Escape back to menu" color={inkSoft} dim />
    <Text text={listError ?? error ?? message ?? (busy ? 'Working…' : '')} color={listError || error ? 'red' : inkSoft} />
    <Text text="None yet." color={inkSoft} />
  </Panel>
{:else}
  <Panel title={title} focused>
    <Text text="The business's item catalog — I adds an item with no category; Enter opens an item's fields and BOM." color={inkSoft} />
    <Text text="I add an item · Enter opens an item · Escape back to menu" color={inkSoft} dim />
    <Text text={listError ?? error ?? message ?? (busy ? 'Working…' : '')} color={listError || error ? 'red' : inkSoft} />
    <SelectList items={items.map((i) => ({ label: i.name, value: i.name }))} onSelect={(item) => void selectItem(item.value)} />
  </Panel>
{/if}
