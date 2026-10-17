# A shared tree-editor component — scoping `business-setup` and `items` onto one shell

## The real, confirmed duplication this addresses

`frontend/src/routes/setup/business-setup/+page.svelte` (816 lines, after the hierarchy
generalization in this same chapter) and `frontend/src/routes/items/+page.svelte` (825 lines)
are two separate, hand-rolled implementations of the exact same UI idiom: a selectable tree on
the left, a detail panel on the right, Insert/Delete as the add/remove mechanism (replacing the
scattered "+ Add..." link-buttons a direct report once called confusing), each with its own
`Selection` union type, its own `handle*Keydown`, its own inline add-forms, and its own
`role="toolbar"`/`aria-keyshortcuts` wiring. Confirmed directly: neither imports the other, and
neither builds on the one, real, already-shared list component, `TypedList.svelte` (325 lines,
used by `AddressList`/`PhoneList`/`ContactList` and similar flat lists) — `TypedList` was built
for a single, flat level of items, not a multi-level tree of heterogeneous node kinds, so it
could not be reused here without real extension.

**The real cost, not a hypothetical one**: any future change to the tree idiom itself — focus
behavior, the Insert/Delete keyboard contract, the active-row styling, screen-reader hint
wording — has to be made by hand in both files today, with nothing enforcing the two stay in
sync. They have already drifted once (business-setup's own keyboard-hint text and CSS class
names were renamed from "division" to "group" in the hierarchy-generalization work; `items`'
own tree was never touched and still uses its original category vocabulary throughout).

## What the two real trees actually have in common, and where they genuinely differ

| | `business-setup` | `items` |
|---|---|---|
| Real backing mechanism | Hierarchy-link (`setHierarchyParent`/`getHierarchyParent`) | Structural `parent_id` nesting |
| Real tree shape | Exactly 3 levels, fixed kinds: group → location → employee | Arbitrary depth, 2 kinds: category (nested arbitrarily) → item (leaf only) |
| Node kinds sharing one visual level? | No — each level is a different kind | Yes — a category can nest under another category |
| Detail panel per kind | 3 genuinely different forms (group has none; location has city/type/hours/addresses/phones; employee has wage/schedule/additional-locations) | 2 genuinely different forms (category: name/rename only; item: description/UPC/price/BOM/sources/etc., a much larger form) |
| Add-inline form per kind | 3, varying field counts (group: 1 field; location: 4 + N hierarchy-dimension fields; employee: 1 field) | 2 (category: 1 field; item: many) |
| Keyboard contract | Insert context-sensitive on current selection; Delete removes selection | Same shape, confirmed by inspection |

The genuine common shell is: a tree of selectable nodes, each carrying a `kind` and a `name`;
a single active selection; Insert dispatching to an add-flow keyed by the current selection's
kind; Delete removing the current selection via a caller-supplied async handler; a detail panel
that renders whatever the caller provides for the selected node's kind. The things that must
stay caller-supplied, never absorbed into the shared component, are: how a node's own children
are fetched/shaped (hierarchy-link vs. `parent_id` are genuinely different data sources), and
every add-form/detail-form's own fields (these have no real overlap between the two pages and
forcing a shared shape would make both worse, not better).

## Non-goals

- **Not** merging the two *data* mechanisms (hierarchy-link vs. `parent_id`) — that is a
  separate, larger, already-flagged undertaking (Items/Categories moving onto the generic
  Hierarchy mechanism), out of scope here and not a prerequisite for this refactor.
- **Not** forcing `TypedList.svelte` to grow tree support — a new, separate component is
  cleaner than retrofitting a flat-list component into a tree one; `TypedList` stays as-is for
  its own, genuinely flat callers.
- **Not** a visual redesign — the goal is to de-duplicate the mechanism, not change how either
  screen looks or behaves from the user's point of view. Every existing e2e step must keep
  passing with no observable difference.

## The staged plan

**Stage 0 — lock down a regression net before touching either file.** Today, business-setup's
own logic is exercised only by the UI-path e2e tutorial's two "Create Location" steps; nothing
exercises its employee flows, additional-locations sub-feature, or the hierarchy-dimension
fields just added. Before refactoring underneath it, add direct Playwright coverage (either a
small, targeted spec in `e2e/tests/`, or further `tutorial-steps.csv` steps) for: adding an
employee, editing a location's hierarchy-dimension tags, and the additional-locations save flow.
Do the same gap-check for `items` (its category add/rename/delete, and at least one item
add/edit). This stage produces no refactor yet — it exists so Stages 2–3 have something real to
catch a regression with, beyond "didn't throw."

**Stage 1 — extract the shared shell from `business-setup` alone, with zero behavior change.**
Build `frontend/src/lib/components/TreeEditor.svelte` by lifting `business-setup`'s own
tree-rendering, selection state, and `handleTreeKeydown` logic out verbatim, generalized just
enough to take: a tree data prop (`{ kind: string; name: string; children: TreeNode[] }[]`-
shaped, supplied by the caller already resolved — `TreeEditor` never fetches anything itself), a
`selection` binding, an `onInsert(selection)` callback (caller decides what Insert means for the
current selection's kind), an `onDelete(selection)` async callback, and named slots for each
node's own row rendering and the detail panel. `business-setup` becomes the one, real, first
caller — migrated in place, verified against Stage 0's new coverage plus the existing suite,
with **no** API-shape decisions made in the abstract first; the shape comes from what this one,
real caller actually needs. This is deliberately a one-caller extraction, not a
guessed-up-front generic design — per this project's own established practice (see how the
Hierarchy mechanism itself only generalized after a second, real, concrete need appeared, never
speculatively).

**Stage 2 — migrate `items` onto the same shell, letting its real second use pressure-test the
API.** Only once `items`' own category/item tree is rebuilt on `TreeEditor` do we find out which
parts of Stage 1's API were genuinely general and which were accidentally business-setup-shaped.
Expect at least one real revision here (e.g. arbitrary-depth category nesting vs.
business-setup's fixed 3 levels may need the tree-data prop's recursion handled slightly
differently) — budget for it rather than treating Stage 1's shape as final. Verified the same
way: Stage 0's `items` coverage plus the full existing suite.

**Stage 3 — only if Stage 2 reveals a second real pattern, extract it too.** Candidates to watch
for, not committed to: a shared "inline add-form" wrapper (both pages' add-forms are a handful
of fields plus Add/Cancel buttons in the same visual slot) and a shared
keyboard-hint-text component (`treeHintId` + the `<p class="keyboard-hint">` pattern). Neither is
extracted speculatively in Stage 1 — only if, after Stage 2, the duplication is still real and
non-trivial.

**Stage 4 — close the coverage gap properly.** Add direct component-level tests for
`TreeEditor.svelte` itself (selection transitions, Insert/Delete dispatch, keyboard handling) —
something neither page has ever had for its own tree logic, now finally possible against one,
shared, much smaller surface instead of two large pages.

## Risks and how each stage guards against them

- **False genericity** — an API shaped to fit two callers acceptably but neither one well. Guarded by
  never designing the shape before Stage 2's real, second caller exists.
- **Silent behavior drift during extraction** — Stage 0 exists specifically so Stages 1–2 have
  real, automated coverage of the exact flows most at risk (the ones with no coverage today),
  not just a hope that the existing thin suite would catch it.
- **Scope creep into merging the two backing data mechanisms** — explicitly a non-goal above;
  if Stage 2 starts to feel like it requires that merge to proceed cleanly, stop and treat that
  as its own, separate, larger decision rather than folding it in here.

## Rough sequencing note

Stages 0–1 are the most directly useful on their own (real test coverage gain; one real,
smaller, more maintainable business-setup file) and could ship independently even if Stage 2
is deferred. Stage 2 is where the actual duplication gets removed, so it's the real point of
doing this at all — Stage 1 without Stage 2 is worth doing, but isn't the goal.
