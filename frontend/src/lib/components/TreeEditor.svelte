<script lang="ts">
  import type { Snippet } from 'svelte';
  // The shared tree+Insert/Delete shell — see docs/pm-frontend-reference.md
  // for the full design.
  interface Props {
    legend: string;
    hintText: string;
    onInsert: () => void;
    onDelete: () => void;
    children: Snippet;
  }
  const { legend, hintText, onInsert, onDelete, children }: Props = $props();

  // Unique id per instance — see docs/pm-frontend-reference.md.
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
