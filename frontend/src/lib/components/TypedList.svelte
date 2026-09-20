<script lang="ts" generics="T extends Record<string, any>">
  // TypedList.svelte — the one, real, generic mechanism behind every
  // typed sub-list on an entity (Addresses, Phone numbers, Contacts,
  // and any real, future kind — spouses, children, whatever a real
  // workplace wants to organize). Per direct correction: three
  // hand-copied components (Address/Phone/Contact) were the exact DRY
  // violation this whole consolidation effort exists to eliminate.
  // This provides the mechanism — load/save/delete, the type-amend
  // UI, Insert/Delete keyboard handling, selection — once; each real
  // kind supplies only its own field shape and display, via Svelte 5
  // snippets, not policy baked in here.
  import type { Snippet } from 'svelte';
  import { translations } from '$lib/state.svelte';

  let {
    entityName,
    kindLabel,
    typeField,
    emptyText,
    newTypePlaceholder,
    listTypes,
    getItems,
    save,
    remove,
    canSave,
    initialValues,
    form,
    display,
  }: {
    entityName: string;
    /** Shown as this block's own legend — "Addresses", "Phone numbers", "Contacts". */
    kindLabel: string;
    /** Which real property of T holds its own type string ("address_type", "phone_type", "contact_type"). */
    typeField: keyof T & string;
    emptyText: string;
    newTypePlaceholder: string;
    listTypes: () => Promise<string[]>;
    getItems: (entityName: string) => Promise<T[]>;
    save: (entityName: string, type: string, values: Record<string, unknown>) => Promise<void>;
    remove: (entityName: string, type: string) => Promise<void>;
    /** Whether the current, real, in-progress form values are complete enough to save. */
    canSave: (values: Record<string, unknown>) => boolean;
    /** A real, fresh values object for a new, blank entry. */
    initialValues: () => Record<string, unknown>;
    /** The field-specific, real form body — receives the live values
     * object (mutate it directly via bind) and a ref-setter for the
     * field that should receive focus after pressing Insert. */
    form: Snippet<[{ values: Record<string, unknown>; setFirstField: (el: HTMLElement | undefined) => void }]>;
    /** The field-specific, real read-only display for one item. */
    display: Snippet<[T]>;
  } = $props();

  let items: T[] = $state([]);
  // A real, unique id for this real component instance's own
  // keyboard-hint text, so the panel below can genuinely announce
  // its real keyboard shortcuts to a screen reader, not just show
  // them visually.
  const hintId = `typed-list-hint-${crypto.randomUUID()}`;
  let knownTypes: string[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  let adding = $state(false);
  let newType = $state('');
  let addingNewType = $state(false);
  let newTypeText = $state('');
  let values: Record<string, unknown> = $state({});
  let saving = $state(false);
  let firstFieldEl: HTMLElement | undefined = $state();

  let selectedType: string | null = $state(null);

  async function load() {
    loading = true;
    try {
      [items, knownTypes] = await Promise.all([getItems(entityName), listTypes()]);
    } catch {
      items = [];
    } finally {
      loading = false;
    }
  }

  // Reload whenever the caller points this component at a different
  // entity (e.g. switching which vendor, customer, or location is
  // selected).
  $effect(() => {
    if (entityName) load();
  });

  function startAdd() {
    if (adding) return;
    const available = knownTypes.filter((t) => !items.some((i) => i[typeField] === t));
    newType = available[0] ?? '';
    addingNewType = available.length === 0;
    newTypeText = '';
    values = initialValues();
    adding = true;
    // A person just pressed Insert to get here — put their cursor
    // straight into the field they'll actually type into.
    setTimeout(() => firstFieldEl?.focus(), 0);
  }

  async function doSave() {
    const type = addingNewType ? newTypeText.trim() : newType;
    if (!type || !canSave(values)) return;
    saving = true;
    error = '';
    try {
      await save(entityName, type, values);
      adding = false;
      await load();
    } catch (e) {
      error = e instanceof Error ? e.message : `Could not save.`;
    } finally {
      saving = false;
    }
  }

  async function doRemove(type: string) {
    error = '';
    try {
      await remove(entityName, type);
      if (selectedType === type) selectedType = null;
      await load();
    } catch (e) {
      error = e instanceof Error ? e.message : `Could not delete.`;
    }
  }

  function selectBlock(e: MouseEvent | KeyboardEvent, type: string) {
    selectedType = type;
    (e.currentTarget as HTMLElement)?.focus();
  }

  // Owned entirely by this component, attached to its own root
  // element (not the window) — Insert/Delete work correctly the
  // moment this component is used anywhere, on any page, with zero
  // extra wiring required from the parent. No Add/Remove buttons at
  // all — Insert/Delete are the only way in or out.
  function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return;
    if (e.key === 'Insert') {
      e.preventDefault();
      startAdd();
    } else if (e.key === 'Delete' && selectedType) {
      e.preventDefault();
      doRemove(selectedType);
    }
  }
</script>

<!--
  fieldset can never legally take an interactive ARIA role (it has a
  fixed, real, implicit "group" semantic the spec won't let any role
  override) - so the real, deliberate keyboard-navigable toolbar
  semantics live on the inner div below instead, wrapping just the
  real list content. Each real entry already has its own real
  role="button" and tabindex; this div is its own further Tab stop
  only so Insert can add a new entry even when nothing inside is yet
  selected - genuinely announced via aria-describedby, pointing at
  the same, real, existing keyboard-hint text already shown visually
  below.
-->
<fieldset class="sub-block">
  <legend>{translations.current[kindLabel] ?? kindLabel}</legend>
  {#if error}<p class="error">{error}</p>{/if}
  {#if loading}
    <p class="empty">Loading…</p>
  {:else}
  <div role="toolbar" tabindex="0" aria-describedby={hintId} aria-keyshortcuts="Insert Delete" onkeydown={handleKeydown}>
    {#if items.length === 0 && !adding}
      <p class="empty">{emptyText}</p>
    {/if}
    {#each items as item}
      {@const type = item[typeField] as string}
      <div
        class="repeat-block"
        class:selected={selectedType === type}
        role="button"
        tabindex="0"
        onclick={(e) => selectBlock(e, type)}
        onkeydown={(e) => e.key === 'Enter' && selectBlock(e, type)}
      >
        <div class="repeat-block-head">
          <strong>{type}</strong>
        </div>
        <div class="repeat-block-body">
          {@render display(item)}
        </div>
      </div>
    {/each}
    {#if adding}
      <div class="repeat-block editing">
        <div class="repeat-block-head">
          {#if addingNewType}
            <input bind:value={newTypeText} placeholder={newTypePlaceholder} />
          {:else}
            <select bind:value={newType}>
              {#each knownTypes.filter((t) => !items.some((i) => i[typeField] === t)) as t}<option value={t}>{t}</option>{/each}
              <option value="">+ New type…</option>
            </select>
          {/if}
          {#if !addingNewType}
            <button type="button" class="link-button" onclick={() => { addingNewType = true; newType = ''; }}>+ New type</button>
          {/if}
        </div>
        <div class="repeat-block-form">
          {@render form({ values, setFirstField: (el) => (firstFieldEl = el) })}
          <div class="repeat-block-actions">
            <button type="button" class="btn secondary small" onclick={() => (adding = false)}>{translations.current['Cancel'] ?? 'Cancel'}</button>
            <button type="button" class="btn small" onclick={doSave} disabled={saving || !canSave(values) || (addingNewType && !newTypeText.trim())}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

    {/if}
  </div>
  {/if}
  {#if !loading}
    <p class="keyboard-hint" id={hintId}>
      {#if items.length > 0}Click an entry, then press Delete to remove it.{/if}
      {#if !adding}Press Insert to add one.{/if}
    </p>
  {/if}
</fieldset>

<style>
  .sub-block {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .sub-block:focus {
    outline: none;
  }
  .sub-block:focus-visible {
    border-color: var(--brass);
  }
  .empty {
    color: var(--ink-soft);
    font-size: var(--font-size-base);
  }
  .error {
    color: var(--debit);
    font-size: var(--font-size-base);
  }
  .repeat-block {
    border: 1px solid var(--rule);
    border-radius: 6px;
    padding: 0.55rem 0.7rem;
    margin-bottom: 0.5rem;
    background: var(--paper-dim, #f9f6ef);
    cursor: pointer;
  }
  .repeat-block:last-of-type {
    margin-bottom: 0.5rem;
  }
  .repeat-block.selected {
    border-color: var(--brass);
    box-shadow: 0 0 0 1px var(--brass);
  }
  .repeat-block.editing {
    background: var(--paper);
    border-color: var(--brass);
    cursor: default;
  }
  .repeat-block-head {
    margin-bottom: 0.3rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .repeat-block-head select,
  .repeat-block-head input {
    flex: 1;
  }
  .repeat-block-body {
    font-size: var(--font-size-base);
    color: var(--ink-soft);
    line-height: 1.4;
  }
  .repeat-block-form {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .repeat-block-form :global(input),
  .repeat-block-form :global(select),
  .repeat-block-form :global(textarea) {
    width: 100%;
  }
  .repeat-block-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.4rem;
    margin-top: 0.2rem;
  }
  .btn.secondary {
    background: transparent;
    border: 1px solid var(--rule-strong);
  }
  .btn.small {
    padding: 0.25rem 0.6rem;
    font-size: var(--font-size-small);
  }
  .link-button {
    background: none;
    border: none;
    color: var(--brass-dark, #8a6d3b);
    font-size: var(--font-size-small);
    cursor: pointer;
    padding: 0;
    white-space: nowrap;
  }
  .keyboard-hint {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    text-align: center;
    margin: 0.3rem 0 0;
  }
</style>
