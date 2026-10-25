<script lang="ts" generics="T">
  // The generic, selectable, Insert/Delete-driven flat-list editor — see
  // docs/pm-frontend-reference.md, "Insert/Enter/Escape/Delete", and the
  // approved plan at the time this was built. Generalizes
  // TypedList.svelte's own, already-correct Insert/Delete toolbar shape
  // (role="toolbar", aria-keyshortcuts="Insert Delete", the same
  // target-tag-filtering handleKeydown) for every FLAT-list,
  // entity-table-configuration screen that isn't typed/keyed the way
  // TypedList.svelte's own three callers (AddressList/ContactList/
  // PhoneList) are. TypedList.svelte itself is left untouched — this is a
  // new, sibling component, not a rewrite of it.
  //
  // Unlike TypedList.svelte, this component does not manage its own
  // "inserting"/selection state — the caller owns both (`inserting`,
  // `selectedId`), the same way TreeEditor.svelte already leaves "adding"
  // entirely to its own callers. This keeps one, single, consistent
  // ownership model across both of this idiom's shared primitives.
  import type { Snippet } from 'svelte';

  let {
    legend,
    hintText,
    items,
    getId,
    selectedId,
    onSelect,
    onInsert,
    onDelete,
    inserting = false,
    emptyText,
    form,
    row,
  }: {
    legend: string;
    hintText: string;
    items: T[];
    getId: (item: T) => string | number;
    selectedId: string | number | null;
    onSelect: (item: T) => void;
    onInsert: () => void;
    onDelete: (item: T) => void;
    inserting?: boolean;
    emptyText?: string;
    // Rendered only while `inserting` is true — owns its own input(s) and
    // its own Enter-to-confirm/Escape-to-cancel (via Form.svelte's
    // showSubmitButton/onCancel props, or a hand-rolled single-field
    // onkeydown, same pattern items/+page.svelte already uses).
    form?: Snippet;
    row: Snippet<[T]>;
  } = $props();

  const hintId = `selectable-list-hint-${crypto.randomUUID()}`;

  // Insert/Delete owned by this component's own toolbar div — identical
  // shape to TypedList.svelte's own handleKeydown, kept deliberately the
  // same so both components behave identically at the keyboard.
  function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return;
    if (e.key === 'Insert') {
      e.preventDefault();
      onInsert();
    } else if (e.key === 'Delete' && selectedId != null) {
      e.preventDefault();
      const selected = items.find((item) => getId(item) === selectedId);
      if (selected) onDelete(selected);
    }
  }

  function selectRow(e: MouseEvent | KeyboardEvent, item: T) {
    onSelect(item);
    (e.currentTarget as HTMLElement)?.focus();
  }
</script>

<!--
  Same real reasoning as TypedList.svelte's own markup comment: fieldset
  can never legally take an interactive ARIA role, so the real,
  keyboard-navigable toolbar semantics live on the inner div, wrapping
  just the real list content, genuinely announced via aria-describedby
  pointing at the same, real, existing keyboard-hint text shown visually
  below.
-->
<fieldset class="sub-block">
  <legend>{legend}</legend>
  <div role="toolbar" tabindex="0" aria-describedby={hintId} aria-keyshortcuts="Insert Delete" onkeydown={handleKeydown}>
    {#if items.length === 0 && !inserting && emptyText}
      <p class="empty">{emptyText}</p>
    {/if}
    {#each items as item (getId(item))}
      <div
        class="repeat-block"
        class:selected={selectedId === getId(item)}
        role="button"
        tabindex="0"
        onclick={(e) => selectRow(e, item)}
        onkeydown={(e) => e.key === 'Enter' && selectRow(e, item)}
      >
        {@render row(item)}
      </div>
    {/each}
    {#if inserting && form}
      <div class="repeat-block editing">
        {@render form()}
      </div>
    {/if}
  </div>
  <p class="keyboard-hint" id={hintId}>{hintText}</p>
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
  .repeat-block {
    border: 1px solid var(--rule);
    border-radius: 6px;
    padding: 0.55rem 0.7rem;
    margin-bottom: 0.5rem;
    background: var(--paper-dim, #f9f6ef);
    cursor: pointer;
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
  .keyboard-hint {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    text-align: center;
    margin: 0.3rem 0 0;
  }
</style>
