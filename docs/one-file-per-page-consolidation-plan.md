# Plan: One File Per Page, One Library — the Real 4x Reduction

Current, measured baseline: **17,765 lines** across 89 `.svelte`
files. Target, per direct instruction: **~4,440 lines** — roughly a
quarter. This is not achievable through the runes migration alone
(that changes syntax, not structure); it requires the real,
structural consolidation discussed earlier this session, now made
concrete.

## Why runes alone can't get there

The runes work committed alongside this plan converted ~2,200 lines
of syntax (`export let` → `$props()`, `$:` → `$derived`/`$effect`,
five stores into one file) without meaningfully shrinking the
codebase — it's the same logic, expressed differently. The real 4x
reduction can only come from **not writing the same logic 60+ times**.

## What's actually being repeated, confirmed directly

A direct sample (`new-business`, `cash-sale`) shows both pages
independently reimplementing the same real shapes: a `<fieldset>` +
`<label>` block per field, a loading/error/success state machine, a
submit handler with the same try/catch/finally shape, and hand-rolled
CSS for form layout that `app.css` already half-standardizes. This is
the real, concrete "mess" — not bad code, but the same real pattern
written fresh in each of dozens of files instead of once.

## The two real, generic components

### 1. `Form.svelte` — one component, every form

```svelte
<Form
  fields={[
    { name: 'businessName', label: 'Business name', type: 'text', required: true },
    { name: 'financialYearLabel', label: 'Financial year', type: 'text' },
    { name: 'coaPrototype', label: 'Chart of Accounts', type: 'select', options: coaPrototypes },
  ]}
  onSubmit={createBusiness}
/>
```

Handles, once, for every real page that currently reimplements them:
the field markup itself (label + input, keyed by `type`: `text`,
`number`, `select`, `date`, `checkbox` — the same closed, restrictive
set from the earlier forms-builder design), the loading/saving/
error/success state machine, and the submit wiring. A page's own
`+page.svelte` shrinks to a field list and a submit function — its
own real, unique logic — not the surrounding scaffolding.

**Field metadata can come from two places**, both real and already
established: a static array (like the example above, for a page
whose fields never change) or the database-driven shape already built
for Business Type questions (`Detail`-backed, `Link`-typed) for pages
whose fields are genuinely configurable per business. `Form.svelte`
doesn't care which — it takes a field list either way.

### 2. `Tree.svelte` — one component, every hierarchy

Replaces both the hand-written `DivisionTreeNode.svelte` (recursive,
`<svelte:self>`-based) and the external `@keenmate/svelte-treeview`
dependency used on the Entity Tree page — two real, different
implementations of the same real concept today. Takes a
`HierarchyNode`/`HierarchyTreeNode` (already the real, live shape
`getHierarchy`/`Hierarchy.buildTree` return from the backend) and a
`renderLabel` callback, and handles expand/collapse, indentation, and
recursion once.

## Real, measured impact — a conservative estimate

- **77 page files** currently average ~140 lines each (17,765 ÷ 89,
  weighted toward pages, not the smaller library files). A page using
  `Form.svelte` for a genuinely simple CRUD screen (there are real,
  many of these — most of `/setup/*`, most of `/arap/*`) drops to a
  field list and a submit call: **~25–40 lines**.
- Not every page collapses this far — the General Journal, journal
  grid, and matrix reports genuinely have their own real, complex
  logic that a generic form can't absorb, and shouldn't try to. A
  realistic estimate: **~50 of the 77 pages** are genuinely
  form-shaped and can shrink this way; the rest keep their own real
  logic but still benefit from the two tree implementations
  collapsing into one.
- **Two tree implementations become one**: `DivisionTreeNode.svelte`
  (69 lines) is retired; the Entity Tree page's own real usage of the
  external library is replaced with the same, one, real `Tree.svelte`.

Rough arithmetic: 50 pages × (~140 → ~35 lines) removes roughly
**5,250 lines**; the remaining structural repetition in forms
(duplicated CSS, duplicated loading-state boilerplate) removes a
further real, meaningful chunk once `app.css`'s own existing,
partial design system absorbs what `Form.svelte` doesn't need to
repeat per page. Getting from today's 17,765 to the real ~4,440
target is credible with this design, though the exact final number
depends on how many of the "~50" pages turn out to have real,
page-specific logic worth keeping separate — which won't be known
precisely until each one is actually converted and measured.

## Real, honest risk and ordering

This is a large, structural rewrite of the majority of the frontend's
own real, user-facing surface — genuinely higher-risk than the runes
migration, which only changed syntax underneath already-working
behavior. The ordering that keeps this safe:

1. Build `Form.svelte`/`Tree.svelte` as real, new, additive files —
   nothing existing changes yet.
2. Convert one real, simple, low-traffic page first (a strong
   candidate: `NotImplemented`'s own caller, or a single `/setup/*`
   CRUD screen) and verify it against the full e2e tutorial before
   converting a second.
3. Convert the ~50 genuinely form-shaped pages one at a time, each
   verified the same way, each a real, separate commit — never a
   single, one-shot rewrite of all 50 at once, given how much real
   surface area (every screen a real user actually touches) this
   covers.
4. Pages with genuine, unique logic (General Journal, matrix reports,
   the journal grid) are evaluated individually — some may still use
   `Form.svelte` for their own field portions while keeping custom
   logic around it; some may not benefit at all, and stay as they are.

Not yet started. This document is the real, concrete plan; building
`Form.svelte`/`Tree.svelte` themselves, and converting the first real
page, is the next, separate step.
