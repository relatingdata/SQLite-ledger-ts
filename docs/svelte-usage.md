# How much of Svelte this application actually uses

Per direct request: a plain, honest description of the real, limited
extent to which this application makes use of Svelte in the frontend.

## 1. The real version, and the real reactivity model actually used

**This section is obsolete and was corrected against the current source,
not merely re-measured.** It originally claimed this application "makes
zero use of Svelte 5's own, newer 'runes' API" and that every component
"still uses Svelte's older, 'legacy' reactivity model exclusively." That
was true at the time this section was written, but an active migration
has happened since (see `docs/svelte-5-runes-migration-plan.md`, a
sibling chapter in this same manual, which documents it in detail — the
two chapters directly contradicted each other until this correction).
Verified directly: `grep -rl '\$state(\|\$derived(\|\$props(' frontend/src --include="*.svelte"`
currently returns **53 of 101** `.svelte` files using runes; only **9**
files remain on the legacy `$:` model exclusively. The application is now
predominantly rune-based, not legacy-exclusive. For the current, authoritative
status and the remaining legacy files, read `svelte-5-runes-migration-plan.md`
instead of trusting a specific count here, since both numbers will keep moving
as the migration continues — don't let this section's own numbers go stale
again without updating that sibling chapter too.

## 2. Real, shared, cross-component state: Svelte's own stores

Where a real piece of state needs to be shared across more than one,
separate component — the logged-in session, the current auth/role
information, the live menu tree, the current set of translations, or
the shared "does the current panel have an unsaved edit" flag — this
application uses Svelte's own, plain `writable`/`derived` stores
(`svelte/store`), each in its own, small, dedicated file under
`frontend/src/lib/` (`session.ts`, `auth.ts`, `menu.ts`,
`translations.ts`, `dirty-state.ts`). A component reads a real store's
own, current value with the `$` prefix (`$session`, `$translations`)
and Svelte handles re-rendering that component whenever the real,
underlying store value changes.

There is no real, separate, larger state-management library in use
at all (no Redux-style pattern, no genuinely global, all-in-one
store) — each real store is small, focused on one real concern, and
plain.

## 3. Real components: mostly one file per real screen, plain HTML/CSS inside

The overwhelming majority of this application's real screens are a
single, direct `+page.svelte` file — real markup, real inline
`<style>`, and a real `<script>` block, all in one file, rather than
composed from many small, separate, reusable components the way a
larger, more componentized frontend often is. A genuinely reusable
piece (`AddressList.svelte`, `PhoneList.svelte`, the recursive
`DivisionPLNode.svelte` used by the P&L's own division tree) exists
where the same, real shape is genuinely needed in more than one real
place — but this is the exception, not the default pattern.

## 4. Real, external dependencies: one, small, focused library

Beyond Svelte and SvelteKit themselves, this application has exactly
one, real, external frontend dependency:
`@keenmate/svelte-treeview`, used specifically for the Entity Tree
page (Configuration), where a real, generic, recursive tree-render
was more practical to reuse than write by hand. There is no broader
UI component kit or design-system library in use anywhere else — every
other real button, table, form, and card in the application is plain,
hand-written HTML and CSS, styled directly, not drawn from a real,
shared, third-party component library.

## 5. The real, honest summary

This application uses Svelte for what it's most directly good at —
real, reactive UI, real, shared state via stores, and SvelteKit's own
real, file-based routing — while deliberately staying on the older,
simpler reactivity model, avoiding any real, larger UI framework or
state-management library, and keeping almost every real screen as
one, direct, readable file rather than a deep tree of small,
composed components. The result is a real, plain, and — by design —
limited use of what Svelte itself is capable of, in keeping with the
same, direct, "everything readable in one place" spirit the backend's
own, deliberately ORM-free SQL usage follows too.
