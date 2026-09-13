*A Claude Code skill for this project — lives at `/mnt/skills/user/backend-first-testing/SKILL.md`, reproduced here so it's part of this manual's own, single, complete source. Description: MANDATORY, absolute, for this project - before reaching for Playwright/browser testing, always ask whether the thing being tested is provably backend-only (a validation error, a SQL/entity-resolution bug, a business-logic calculation). If so, reproduce and verify it at the lowest possible level first - raw SQL against the schema, then a direct backend function call - never a browser. Also mandatory: when a scenario needs testing at more than one level (database, backend, frontend), every level must read the exact same, small, named, ASCII fixture - never a separately-invented copy of "similar" test data per level.*


# Backend-First Testing

## The real testing pyramid, in order of preference

1. **Database level.** Raw SQL directly against the real schema — `INSERT`/`UPDATE` statements hitting real tables, checking that views and triggers (`localized_text`, `entity_delete`'s own `INSTEAD OF INSERT`, etc.) produce the right result. No TypeScript at all. The fastest, most isolated layer — and, confirmed directly this project's own real history, exactly where several real bugs actually lived (the `localized_text` view's own collision bugs, `createStockTake`'s whole-database name lookup).
2. **Backend function level.** Calling real `db.ts`/`db-stock.ts` functions directly (`createStockTake(...)`, `recordStockTakeCount(...)`) — no HTTP, no browser. Tests real business logic in isolation, in milliseconds.
3. **HTTP/API level.** Real requests against the real Express routes — tests the real request/response contract, auth, serialization.
4. **Browser/E2E level (Playwright).** Reserved for what is genuinely, irreducibly about the UI itself: layout, RTL mirroring, translation rendering, interactive widget behavior. Never the default reach for "verify a backend function works" — confirmed, directly, a real mistake made in this project's own history: a pure backend validation-error bug (a name-collision bug inside `createStockTake`) was first, wrongly, investigated via a Playwright browser test, adding real login flows, DOM selectors, dev-server timing, and duplicate-process risk — none of it relevant to a bug that a single, direct function call could have exposed in milliseconds.

## Before writing any new test

Ask, explicitly: **is this provably backend-only?** If a bug's own stack trace / error message names a backend file and function with no UI code in the path at all, it is backend-only — start at level 1 or 2, not level 4. Only escalate to Playwright when the specific thing being verified cannot be observed any other way (a real, visual rendering, or an interaction only expressible via real DOM events).

## Shared ASCII fixtures across every level

When a single scenario or bug needs testing at more than one level (e.g. a schema-level repro, then a backend-level repro, then eventually a UI-level confirmation), every level reads the exact same, small, named, ASCII fixture — the same real discipline already established for this project's seed data (`shared-fixtures/*.csv`, read identically by backend scripts and Playwright tests). Never let each test level invent its own, separate, "similar enough" test data — that is exactly the kind of drift this project's own CSV migration work was created to eliminate for seed data, and the same principle applies to test fixtures.
