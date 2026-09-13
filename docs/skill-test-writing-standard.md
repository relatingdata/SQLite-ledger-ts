*A Claude Code skill for this project — lives at `/mnt/skills/user/test-writing-standard/SKILL.md`, reproduced here so it's part of this manual's own, single, complete source. Description: MANDATORY, absolute, for this project - every new test must be fully self-contained. Any account, entity, or vocabulary name a test references must either be created explicitly within that same test, or be a genuinely permanent, stable part of the schema (e.g. the business "My Business" itself, or a real, always-seeded core account) - never assumed present because it exists for some other, specific business (e.g. Wine Retail Company's own "Breakage & Spoilage"). Use unique, prefixed names per test (the established STTest/WOTest/<Feature>Test convention) to avoid collisions with other tests or real data.*


# Test-Writing Standard

## The real incident this comes from

A new regression test called `writeOffStock('My Business', ..., 'Breakage & Spoilage', ...)` — a real, existing account name, but one that only exists because Wine Retail Company's own demo data creates it. `'My Business'`, the generic business most of this test file uses, has no such account. The test failed with a real, but *wrong*, error (`NOT NULL constraint failed`) on its first "should now pass" run — not because the fix was wrong, but because the test's own setup carried a hidden assumption about what already existed. This is exactly the class of bug this project's own `backend-first-testing` and `test-driven-development` skills exist to catch — and it *was* caught, precisely because both directions of red/green were actually run, not assumed.

## The real, absolute rule

1. **Every account/entity/vocabulary name a new test uses must be accounted for explicitly** — either:
   - created within the test itself (`createEntity({ name: 'XTest Something', parent: '...' }, 1)`), or
   - confirmed to be part of the schema's own, permanent, always-seeded core (e.g. `'My Business'`, `'Actual'`, `'Inventory'`, real Vocabulary words) — not merely "it worked in some other test I copied from."
2. **Never assume a business-specific account exists for a generic test business.** Wine Retail Company's own demo accounts (`Breakage & Spoilage`, specific vendor names, etc.) are real, but scoped to that one, specific business — a test using `'My Business'` or any other generic test business must create its own, equivalent account if it needs one.
3. **Use a unique, prefixed name per test** (the established convention: `STTest`, `WOTest`, `QTYBalTest`, or a new, similarly distinct prefix) so a test's own entities can never collide with another test's, or with real, live application data.
4. **When a test's own setup needs an account/entity that a sibling test already creates for the same purpose**, prefer creating a new, same-named one scoped to the current test's own prefix over reusing the sibling's — cross-test coupling via shared fixture entities is its own, separate source of hidden assumptions.

## Why "standard," not just "quality"

This is deliberately a documented, checkable standard, not a vague aspiration — the same rigor `test-driven-development` demands for the red/green cycle applies equally to what a test actually contains. A TDD cycle run against a test with a hidden setup assumption doesn't protect against that assumption; it can only reveal it if the wrong direction happens to surface it, as it did here. Writing tests to this standard from the start reduces how often that discovery has to happen by accident.
