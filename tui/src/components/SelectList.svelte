<!--
  Replaces ink-select-input the same way TextInput.svelte replaces
  ink-text-input - built on sveltui's own keyboard module since
  sveltui ships no List/Select component yet. Up/Down (or k/j) moves
  the highlight, Enter selects. `focused` defaults to true to match
  ink-select-input's own default (auto-focus when it's the only input
  on screen), since most of this app's list screens never pass it.
-->
<script lang="ts" generics="T">
  import { Box, Text } from 'sveltui';
  import { keyboard } from 'sveltui';
  import { onDestroy } from 'svelte';
  import { brass, ink } from '../theme.ts';

  let {
    items,
    onSelect,
    focused = true,
    limit,
  }: {
    items: { label: string; value: T }[];
    onSelect: (item: { label: string; value: T }) => void;
    focused?: boolean;
    limit?: number;
  } = $props();

  let highlighted = $state(0);
  $effect(() => {
    if (highlighted >= items.length) highlighted = Math.max(0, items.length - 1);
  });

  // See TextInput.svelte: keyboard.on() is process-wide and never
  // auto-clears, so a handler left subscribed after its own SelectList
  // is torn down (e.g. the business-picker step swapping to the
  // ledger-picker step) keeps firing first and can swallow the new
  // screen's own Enter/arrow presses.
  const unsubscribe = keyboard.on((event) => {
    if (!focused || items.length === 0) return;
    switch (event.key) {
      case 'ArrowUp':
        highlighted = (highlighted - 1 + items.length) % items.length;
        return true;
      case 'ArrowDown':
        highlighted = (highlighted + 1) % items.length;
        return true;
      case 'Enter': {
        // Deferred, not called inline: `onSelect` commonly swaps the
        // whole screen (e.g. ChooseBusiness -> Menu), which mounts a new
        // SelectList/TextInput whose own keyboard.on() call adds itself
        // to the very same listener Set this dispatch loop is still
        // iterating - a live Set reflects insertions made mid-iteration,
        // so the screen that just mounted would otherwise also receive
        // *this* Enter and immediately act on it (observed as one
        // keypress drilling two menu levels deep). Queuing the actual
        // selection as a microtask lets this dispatch pass finish first.
        const chosen = items[highlighted];
        queueMicrotask(() => onSelect(chosen));
        return true;
      }
      default:
        if (event.key === 'k') {
          highlighted = (highlighted - 1 + items.length) % items.length;
          return true;
        }
        if (event.key === 'j') {
          highlighted = (highlighted + 1) % items.length;
          return true;
        }
        return false;
    }
  });
  onDestroy(unsubscribe);

  const visible = $derived(limit ? items.slice(0, limit) : items);
</script>

<Box flexDirection="column">
  {#each visible as item, i (i)}
    <Text text={`${i === highlighted ? '❯ ' : '  '}${item.label}`} color={i === highlighted ? brass : ink} bold={i === highlighted} />
  {/each}
</Box>
