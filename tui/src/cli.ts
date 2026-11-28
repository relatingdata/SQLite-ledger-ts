#!/usr/bin/env bun
import { mount, keyboard } from 'sveltui';
import { mount as svelteMount, unmount } from 'svelte';
import App from './App.svelte';
import Nothing from './components/Nothing.svelte';
import { registry } from 'sveltui/src/core/state/engine.svelte.ts';

// sveltui 0.1.7 starts its root with $effect.root and calls the root
// component itself, bypassing Svelte's own mount(). Five things need
// doing first, three of them from Svelte 5.56 on (docs/tui-design.md, "Running on Svelte 5.56"):
// - Svelte's DOM operations are initialised only by its own mount(), so an
//   empty component is mounted once into a detached element first;
// - a component appends its nodes before an anchor, which sveltui never
//   passes, so the root is given one in a detached element. sveltui draws
//   from its own state, not from these nodes;
// - sveltui hands a destroyed component's slot to the next component
//   created; on Svelte 5.56 that new component's row is then not drawn
//   (list rows went missing after a screen change), so no slot is ever
//   reused: a released slot is never put on the free list;
// - sveltui's mount registers an Escape handler (clearing sveltui's own
//   focus, which this TUI does not use) ahead of every screen's, and it
//   consumes the key, so no screen ever sees Escape: it is not registered;
// - sveltui reads each chunk of terminal input as one key, and keys
//   pressed while a screen is busy arrive together in one chunk (six
//   Escapes as "\x1b\x1b\x1b\x1b\x1b\x1b"), which matches no key: each
//   chunk is split into its keys before sveltui sees it.
/** One chunk of terminal input as its keys: an escape sequence (CSI
 * "\x1b[" up to its final byte, or SS3 "\x1bO" and one byte), a lone
 * Escape, or one character. */
export function splitKeys(chunk: string): string[] {
  const keys: string[] = [];
  let i = 0;
  while (i < chunk.length) {
    if (chunk[i] === '\x1b' && chunk[i + 1] === '[') {
      let j = i + 2;
      while (j < chunk.length && !(chunk.charCodeAt(j) >= 0x40 && chunk.charCodeAt(j) <= 0x7e)) j++;
      keys.push(chunk.slice(i, j + 1));
      i = j + 1;
    } else if (chunk[i] === '\x1b' && chunk[i + 1] === 'O' && i + 2 < chunk.length) {
      keys.push(chunk.slice(i, i + 3));
      i += 3;
    } else {
      const key = String.fromCodePoint(chunk.codePointAt(i)!);
      keys.push(key);
      i += key.length;
    }
  }
  return keys;
}
const emit = process.stdin.emit.bind(process.stdin);
process.stdin.emit = ((event: string | symbol, ...args: unknown[]) => {
  if (event !== 'data') return emit(event, ...args);
  for (const key of splitKeys(String(args[0]))) emit('data', key);
  return true;
}) as typeof process.stdin.emit;

class NoFreeSlots {
  get length(): number { return 0; }
  push(): number { return 0; }
  pop(): undefined { return undefined; }
}
registry.freeIndices = new NoFreeSlots() as unknown as number[];
unmount(svelteMount(Nothing, { target: document.createElement('div') }));
const host = document.createElement('div');
const anchor = document.createComment('');
host.append(anchor);

const onKey = keyboard.onKey;
keyboard.onKey = (key, handler) => (key === 'Escape' ? () => {} : onKey(key, handler));
mount(() => (App as unknown as (anchor: Node, props: Record<string, unknown>) => void)(anchor, {}), { fullscreen: true });
keyboard.onKey = onKey;
