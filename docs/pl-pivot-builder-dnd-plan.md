*Built. Live at `frontend/src/routes/reports/pl-pivot/+page.svelte` (route: `/reports/pl-pivot`), alongside `new-new-pl`, not replacing it. Checked against `svelte-dnd-action`'s actual, live behavior before this was considered done, per `specification-driven-design`.*

# A Real, Drag-and-Drop Pivot Builder for the Profit & Loss Report, on `svelte-dnd-action`

## The real, current state, checked directly

`frontend/src/routes/reports/new-new-pl/+page.svelte` already has a real, genuine two-axis pivot mechanism underneath it — `getProfitAndLossByAxis(business, ledger, fromDate, toDate, outerAxis, innerAxis, outerFilter, innerFilter)` in `backend/src/db-matrix-reports.ts`. `MatrixAxis` is typed as `'Item' | 'Location' | 'Consolidated' | (string & {})` — Category and Division were always, and remain, ordinary business-defined hierarchy names rather than fixed members of the type (Product has since been renamed Item; Category, formerly its own structural literal, has since been generalized to the same open-ended tag mechanism Division already used — see `docs/pm-domain-reference.md`'s "Hierarchies and multi-dimensional reporting"). What's genuinely fixed today isn't the backend (which already takes any axis in either slot) — it's the UI: two, real, plain `<select>` dropdowns, one for the "outer" (row) axis and one for the "inner" (column) axis. This is the real "two fixed dimensions" the request refers to: fixed not because only two axes exist, but because assigning which axis goes where is a dropdown choice, not a real, direct, visual, drag-and-drop one.

A real, existing constraint already governs valid combinations, and any redesign must keep it: `opposingHierarchyAxes` rejects crossing a hierarchy against its own other level (Division against Location, Category against Product) as genuinely redundant — a real, meaningful two-axis breakdown always crosses one whole hierarchy (Location or Division — "where") against the other (Category or Product — "what").

## The real, proposed alternative

A real pivot-builder interface, in the style of the animated field-assignment demos this request references: a tray of real, draggable "field" chips (Consolidated, Division, Location, Category, Product) that a person drags into one of two real drop zones — **Rows** and **Columns** — rather than picking from two separate dropdowns. Dropping a chip into a zone that already holds one swaps it out (a real zone holds exactly one axis at a time, matching the report's own real, current two-axis shape); dragging a chip out of a zone, or back to the tray, clears that axis back to a real, sensible default.

**`svelte-dnd-action`** (`isaacHagoel/svelte-dnd-action`, npm, current major 3.x) is a real, direct, well-suited fit for this, checked directly, not assumed:
- A real, confirmed, direct Svelte 5 support (native `onconsider`/`onfinalize` props, alongside the legacy `on:consider`/`on:finalize` directive form for Svelte 4) — this project runs Svelte `5.56.8`, confirmed directly against `frontend/package.json`.
- Action-based (`use:dndzone`), not a wrapped, opaque component — fits this project's own, established preference for direct, minimal-abstraction primitives over heavier third-party UI frameworks.
- Built-in `flip` animation via `svelte/animate` — the real, animated reassignment feel (a chip visibly sliding from the tray into a Rows/Columns zone, and the zone's own prior occupant visibly sliding back out) is the library's own, core, out-of-the-box behavior, not something to hand-build.
- Real, direct keyboard accessibility and touch support — both genuine, standing requirements for this project's own screens generally, not just a desktop-mouse nicety.
- Actively maintained (52+ other real, published projects depend on it per npm's own registry; a real, recent release adding explicit Svelte 5 peer-dependency support) — a real, low-risk dependency to add, not an abandoned or experimental one.

## Real, concrete mechanics

1. **The tray**: a real `dndzone` container holding the five real, available field chips (`Consolidated`, `Division`, `Location`, `Category`, `Product`) as its own, real `items` array — chips return here when removed from Rows/Columns.
2. **Rows and Columns**: two, real, separate `dndzone` containers, each real, direct drop target holding zero or one real chip. The existing `opposingHierarchyAxes` check runs on every real `finalize` event: if the dropped chip's own hierarchy already occupies the *other* zone, the drop is rejected (the chip visibly, immediately animates back to its own prior position) rather than silently producing a redundant, self-crossed report — a real, direct, visible constraint, not a disabled, greyed-out chip a person has to puzzle out in advance.
3. **The specific-value narrowing** (`outer.filter`/`inner.filter` today's dropdown already supports, e.g. narrowing "Location" down to one specific location) becomes a real, small, secondary control attached to a filled Rows/Columns zone once it holds a chip — a real, live text input or small select appearing directly on the zone itself, not a separate, disconnected dropdown elsewhere on the page.
4. **`getProfitAndLossByAxis` itself needs zero changes** — the backend already accepts any axis in either slot; this redesign is entirely about how the person expresses that choice, never about what the report can compute.

## Real, open questions, deliberately left here rather than guessed at

- **Whether this replaces `new-new-pl` outright, or ships as a real, further, separate route** (`new-new-new-pl`, or a real, better name) **alongside it** — this project's own, established pattern (`new-pl` and `new-new-pl` coexisting through prior iterations) suggests the latter until the drag-and-drop version is confirmed to genuinely work better in practice, not just in principle.
- **Whether the same pivot-builder pattern should extend to `getSalesCogsMatrix`/`getStockOnHandMatrix`** (`db-matrix-reports.ts`'s other two real, existing row/column-axis functions) once proven on the P&L specifically, or whether P&L alone is the right, first, contained slice.
- **Exact chip styling/placement** — left deliberately unspecified; this is a real, visual/UX decision worth a look at the actual rendered page, not a guess made in prose.

## Real, next step, not taken here

Per `specification-driven-design`: this document states the real, proposed direction and checks it against what already exists; it does not install `svelte-dnd-action`, write the new route, or touch `new-new-pl` at all. Confirmation of direction (which of the open questions above to resolve, and how) should come before any of that code gets written.
