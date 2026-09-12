# Prompt: Wine Store Shelving Layout (JSCAD)

This is the single prompt, reconstructed after the fact, that would
have produced the final store layout model directly — synthesized
from an iterative session where each round corrected one real gap.
Kept for reference alongside `wine-store-layout.html`, since it's
useful context for explaining that file (and, later, the
`part_location`/`shelf_side`/`rack`/`level` fields it visually
represents) in the system manual.

---

Using JSCAD's actual boolean/additive geometry (not three.js for
modeling — three.js only as the final rendering layer, converting
JSCAD's baked polygon output via `geom3.toPolygons()`), build a wine
store floor plan:

**Bottle** (built once per wine color, then reused everywhere via
cheap `translate()`/`rotateZ()` — never recompute the booleans per
instance): a cylinder body (~60% of total height) plus a narrower
cylinder neck (~40% height, ~35% of body radius), a dark screw cap
covering only the top ~30% of the neck, and a white half-cylinder
label (built via `subtract` then `intersect` with a half-space) on the
correct front-facing side.

**Shelf unit**: `subtract(outer box, inner cavity)` where the cavity
is open only at the front face — solid back, top, bottom, and sides —
tall enough to clear the bottle plus cap with real hand-room above,
holding a 6-wide × 4-deep grid, all one wine color per unit.

**Assembly**: stack 4 units vertically = one level-column; tile 3
level-columns side by side = one row-face (3 wide × 4 tall). A
double-sided (free-standing) row is two row-faces mirrored back-to-back
sharing a middle divider; a single-sided (wall) row is one row-face
with its back flush against a wall.

**Floor plan**: single-sided rows at the top and bottom (backed against
those walls, facing into the store), 6 double-sided free-standing rows
between them with human-sized aisles, each row split into a left group
and right group by a central cross-aisle wider than one row-unit. A
single floor plane sized from the actual placed geometry's real
extents, not an assumed formula.

Track each row's Y-extent explicitly when placing it, rather than
assuming symmetric bounds.

---

## What no prompt would have caught

The two costliest bugs during the actual session weren't modeling
choices a better prompt could have specified — they were real JSCAD
API behaviors only found by testing the library directly (`node -e
"..."` against the real `@jscad/modeling` package) rather than
guessing in the browser:

- `translate()`/`rotateZ()` never bake into a geometry's raw vertex
  data — they only update a lazy `.transforms` matrix. Reading
  `.polygons[].vertices` directly silently ignores every placement
  call. The fix is `geom3.toPolygons()`, which correctly applies the
  transform.
- Color lives on the top-level `geom3` object, not per-polygon —
  `union`-ing differently-colored parts together loses it. Differently
  colored parts (a bottle's body/neck/cap/label) need to stay as
  separate geometries, each converted to its own mesh.
