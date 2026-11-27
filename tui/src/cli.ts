#!/usr/bin/env bun
import { mount } from 'sveltui';
import { mount as svelteMount, unmount } from 'svelte';
import App from './App.svelte';
import Nothing from './components/Nothing.svelte';

// sveltui 0.1.7 starts its root with $effect.root and calls the root
// component itself, bypassing Svelte's own mount(). From Svelte 5.56 that
// leaves two things undone (docs/tui-design.md, "Running on Svelte 5.56"):
// - Svelte's DOM operations are initialised only by its own mount(), so an
//   empty component is mounted once into a detached element first;
// - a component appends its nodes before an anchor, which sveltui never
//   passes, so the root is given one in a detached element. sveltui draws
//   from its own state, not from these nodes.
unmount(svelteMount(Nothing, { target: document.createElement('div') }));
const host = document.createElement('div');
const anchor = document.createComment('');
host.append(anchor);

mount(() => (App as unknown as (anchor: Node, props: Record<string, unknown>) => void)(anchor, {}), { fullscreen: true });
