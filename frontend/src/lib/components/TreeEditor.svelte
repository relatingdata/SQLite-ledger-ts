<script lang="ts">
  import type { Snippet } from 'svelte';
  // The real, generic shell shared by every selectable-tree + Insert/
  // Delete screen in this application (business-setup today; items'
  // own category/item tree is a planned second caller — see
  // docs/shared-tree-editor-component-plan.md). Deliberately owns
  // nothing about what a "node" is, what kinds exist, or what
  // Insert/Delete should actually do for the caller's own, current
  // selection — that decision is always the caller's, since it
  // genuinely differs per screen (business-setup: group -> location
  // -> employee; items: arbitrary-depth category -> item). What this
  // component DOES own, once, for every real caller: the toolbar
  // wrapper, the real ARIA wiring (role="toolbar", tabindex, a real,
  // unique id linking the toolbar to its own keyboard-hint text for a
  // screen reader), the INPUT/SELECT/TEXTAREA keydown guard (so typing
  // into an inline add-form's own fields never triggers Insert/Delete),
  // and translating a real Insert/Delete keypress into the two,
  // generic callbacks the caller actually supplies.
  //
  // fieldset can never legally take an interactive ARIA role (a fixed,
  // real, implicit "group" semantic the spec won't let any role
  // override) - so the real, deliberate keyboard-navigable toolbar
  // semantics live on the inner div, wrapping just the real tree
  // content passed in via the default snippet.
  interface Props {
    /** The tree panel's own fieldset legend (e.g. "{business} —
     * {hierarchyName} for Locations"). */
    legend: string;
    /** The real, dynamic keyboard-hint text shown below the tree -
     * computed by the caller from its own, current selection, since
     * only the caller knows what Insert/Delete will actually do from
     * here. */
    hintText: string;
    /** Called on a real Insert keypress - the caller reads its own,
     * current selection to decide what that means (add a location
     * within a selected group, an employee within a selected
     * location, or a new top-level group when nothing's selected). */
    onInsert: () => void;
    /** Called on a real Delete keypress - the caller reads its own,
     * current selection to decide what to remove, and handles its own
     * confirmation/async work. */
    onDelete: () => void;
    /** The real tree content itself (company-wide staff, groups,
     * locations, employees, inline add-forms) - entirely the
     * caller's own, since node kinds and their own detail genuinely
     * differ per screen. */
    children: Snippet;
  }
  const { legend, hintText, onInsert, onDelete, children }: Props = $props();

  // A real, unique id per real instance, so more than one TreeEditor
  // on the same real page (unlikely today, but never assumed) still
  // links its own toolbar to its own hint text correctly.
  const hintId = `tree-editor-hint-${crypto.randomUUID()}`;

  function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return;
    if (e.key === 'Insert') {
      e.preventDefault();
      onInsert();
    } else if (e.key === 'Delete') {
      e.preventDefault();
      onDelete();
    }
  }
</script>

<fieldset class="card-legend tree-panel">
  <legend>{legend}</legend>

  <div role="toolbar" tabindex="0" aria-describedby={hintId} aria-keyshortcuts="Insert Delete" onkeydown={handleKeydown}>
    {@render children()}
  </div>

  <p class="keyboard-hint" id={hintId}>{hintText}</p>
</fieldset>

<style>
  .tree-panel {
    flex: 0 0 320px;
  }
  .keyboard-hint {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    text-align: center;
    margin: 0.6rem 0 0;
  }
</style>
