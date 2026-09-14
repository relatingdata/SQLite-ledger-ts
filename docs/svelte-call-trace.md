# Svelte Call Trace

A real, direct, static trace of what each real frontend screen calls,
and roughly when — tracing the real Svelte 5 source (`+page.svelte`
files), not the compiled JavaScript. `make svelte-call-trace` runs it.

For each real page, per direct request, this identifies:

- **On load** — every real, imported `$lib/api` function called
  inside the page's own `onMount` block (or a named function passed
  directly to it, e.g. `onMount(loadAll)`).
- **On interaction** — every real, imported API function called
  anywhere else in the file (a button click, a form submit).

## The real, stated limit

This is a **static** trace, not a runtime one — per direct question,
genuinely possible and helpful, but with a real caveat: Svelte 5's own
reactivity (`$state`, `$derived`, `$effect`) means some real execution
doesn't happen as a plain, traceable function call the way this script
can see. A function called from inside a reactive `$effect` block that
re-runs when its own dependencies change isn't the same shape as a
direct `onclick` handler, and this script's own, simple regex-based
approach does not distinguish the two — both would show up as "on
interaction" here, even though one is triggered by a state change, not
a real, physical click. A true runtime trace (what actually fires, in
what order, for one real page load or one real form submission) would
need real, temporary instrumentation or the browser's own DevTools
profiler — a real, separate, larger piece of work, not attempted here.

Genuinely useful even with that limit: this gives a fast, real,
first-pass answer to "what does this screen actually call, and does it
look like it happens on load or only after a real interaction" without
reading every one of the 79 real pages by hand — the exact
`pattern-recognition-to-tooling` discipline this project now follows.
