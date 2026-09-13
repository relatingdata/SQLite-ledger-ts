*A Claude Code skill for this project — lives at `/mnt/skills/user/test-driven-development/SKILL.md`, reproduced here so it's part of this manual's own, single, complete source. Description: MANDATORY, absolute, for this project - when writing a test meant to prove a bug is fixed (a regression test), the test must be shown to genuinely FAIL against the unfixed code before it is trusted to PASS against the fix. A test that only ever ran against already-fixed code has not actually proven anything - it may be passing by accident, for a reason unrelated to the real fix. Applies to every regression test, not just ones that "seem tricky."*


# Test-Driven Development

## The real incident this comes from

A real, permanent, backend-level regression test was written for the `createStockTake` name-collision bug — and it passed, immediately, on the first run. It felt done. It was not: the test's own entity-creation order happened to make the real item's later insertion accidentally win the old, buggy code's own unscoped lookup, completely by chance — meaning the test would have passed identically whether the real fix was present or not. It proved nothing. This was only caught by the direct, deliberate step of reverting the real fix and re-running the test — which then, correctly, failed — before restoring the fix and confirming it passed again.

## The real, absolute rule

**Red, then green — both genuinely observed, never assumed.** For any test whose whole purpose is proving a specific bug is fixed:

1. Write the test.
2. **Genuinely, temporarily revert the real fix** (or write the test before the fix exists at all) and run the test. It must fail, with an error that clearly matches the real, originally-reported problem — not a different, incidental failure.
3. Restore (or apply) the real fix and run the test again. It must now pass.
4. Only after both steps are directly, actually observed — not inferred, not assumed because "the code looks right" — is the test trusted as a genuine regression test.

A test that has only ever been run once, against already-fixed code, has not proven it catches the bug it claims to catch. This is not a formality for "tricky" cases — the real incident above happened on a case that looked completely straightforward.

## Why this matters more than it might seem

A regression test that doesn't actually test the regression is worse than no test at all: it gives real, false confidence that a bug is covered, permanently, silently, until the exact same bug recurs and the "passing" test does nothing to catch it. The discipline of deliberately watching it fail first is the only way to know, for certain, that the test is anchored to the real, correct condition.
