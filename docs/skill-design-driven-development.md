*A Claude Code skill for this project — lives at `/mnt/skills/user/design-driven-development/SKILL.md`, reproduced here so it's part of this manual's own, single, complete source. Description: For any real, non-trivial new feature or structural change (not a small bug fix) - write a real, direct plan document first (docs/<feature>-plan.md), covering the real scenario, what genuinely already exists, and the real, honest scope of what's being built - before writing implementation code. This project has already, repeatedly done this successfully (13 real, existing *-plan.md documents); this skill makes the pattern explicit and expected, rather than an inconsistent habit.*


# Design-Driven Development

## Why this is already this project's own, real, proven pattern

This project has 13 real, existing `docs/*-plan.md` documents, each written before the corresponding feature's implementation code — `construction-project-management-plan.md`, `multi-dimensional-reporting.md`, `menu-as-entity-tree-plan.md`, and others. Each follows the same, real, effective shape: describe the real business scenario, confirm — directly, not assumed — what already exists in the codebase relevant to it, then define the real, honest scope of what will actually be built. This has already worked; this skill makes it an explicit, expected step rather than an inconsistent habit that happens for some features and not others.

## The real stages, in order (a genuine, working Design Thinking cycle)

1. **Empathize / confirm reality.** Who actually uses this, and what real problem do they have? Just as importantly: what does the codebase *already* do here, confirmed directly by reading it — never assumed from memory. Several real, confirmed corrections this project's own history made were exactly this step done properly (e.g. `sql-ledger-comparison.md`'s claim that Timecards didn't exist, corrected once the real, existing `clockInToProject`/`clockOutOfProject` functions were actually found).
2. **Define the real, honest scope.** Write down, plainly, what this feature will and will not do — a real plan document, not a mental note. Honesty about what's *not* being built (yet) is as valuable as describing what is.
3. **Ideate.** Before committing to one approach, consider the real alternatives — this project's own, established `no-new-tables` discipline (encoding new capabilities via the existing entity-tree and link-entity mechanisms rather than schema changes; see that skill directly for the full, real rule) is itself the result of this step, applied consistently.
4. **Prototype toward the smallest real MVP.** Build the smallest, real, testable slice that proves the design — not the whole feature at once. This is the fastest real path to a working MVP, not a shortcut that skips design — the plan document is what makes the *smallest* real slice identifiable in the first place, rather than guessing at scope mid-implementation.
5. **Test.** Per the `backend-first-testing` skill — prove the smallest slice actually works, at the lowest real level that can prove it, before building the next slice on top.

## When this applies

A real, non-trivial new feature, or a structural change touching several real files/mechanisms — not a small, contained bug fix (which the `backend-first-testing` and `test-driven-development` skills already cover directly). If in doubt, the honest test is: would a real, direct plan document meaningfully clarify scope or catch a wrong assumption before code is written? If yes, write it.
