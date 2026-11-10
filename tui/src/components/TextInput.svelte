<!--
  A plain Svelte component built on sveltui's own low-level `keyboard`
  module (onKey/on), the same way Ink's own ecosystem builds
  ink-text-input as userland code on top of Ink's useInput() hook —
  sveltui ships no Input component yet (confirmed directly against its
  own source), so this is the real, missing "battery" rather than a
  framework patch. Focus is controlled explicitly by the parent (a
  `focused` prop), matching this app's own existing pattern (Login.tsx
  et al used ink-text-input's `focus` prop the same way) rather than
  sveltui's separate focusable/tabIndex system, so porting every screen
  means changing only the import, not the screen's own control flow.
-->
<script lang="ts">
  import { Box, Text } from 'sveltui';
  import { keyboard } from 'sveltui';
  import { onDestroy } from 'svelte';
  import { brass, inkSoft } from '../theme.ts';

  let {
    value = $bindable(''),
    focused = false,
    mask,
    onSubmit,
    width,
  }: {
    value?: string;
    focused?: boolean;
    mask?: string;
    onSubmit?: () => void;
    width?: number | string;
  } = $props();

  let cursor = $state(value.length);
  // Keep the cursor sane if `value` is set from outside (e.g. cleared
  // after submit) rather than by this component's own typing.
  $effect(() => {
    if (cursor > value.length) cursor = value.length;
  });

  // keyboard.on() registers against a single process-wide listener set
  // that is never cleared between screens, so a handler left subscribed
  // after its own component is torn down keeps intercepting events ahead
  // of whatever screen mounts next (listeners fire oldest-first, and the
  // first one to return `true` wins) - unsubscribing on destroy is not
  // optional here.
  const unsubscribe = keyboard.on((event) => {
    if (!focused) return;
    switch (event.key) {
      case 'Enter':
        // Deferred for the same reason as SelectList's Enter case: see
        // its comment. onSubmit commonly swaps fields or the whole
        // screen, which can mount new keyboard.on() subscribers into
        // the same listener set this dispatch loop is still iterating.
        queueMicrotask(() => onSubmit?.());
        return true;
      case 'Backspace':
        if (cursor > 0) {
          value = value.slice(0, cursor - 1) + value.slice(cursor);
          cursor -= 1;
        }
        return true;
      case 'Delete':
        if (cursor < value.length) {
          value = value.slice(0, cursor) + value.slice(cursor + 1);
        }
        return true;
      case 'ArrowLeft':
        if (cursor > 0) cursor -= 1;
        return true;
      case 'ArrowRight':
        if (cursor < value.length) cursor += 1;
        return true;
      case 'Home':
      case 'Ctrl+A':
        cursor = 0;
        return true;
      case 'End':
      case 'Ctrl+E':
        cursor = value.length;
        return true;
      default:
        // Ordinary printable input - anything else (Tab, Escape, arrow
        // keys already handled above, control chars) is left alone so
        // it can still bubble to a screen-level handler (e.g. Escape to
        // go back).
        if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
          value = value.slice(0, cursor) + event.key + value.slice(cursor);
          cursor += 1;
          return true;
        }
        return false;
    }
  });
  onDestroy(unsubscribe);

  const displayed = $derived(mask ? mask.repeat(value.length) : value);
</script>

<Box width={width}>
  <Text text={focused ? displayed || ' ' : displayed || ' '} color={focused ? brass : inkSoft} />
</Box>
