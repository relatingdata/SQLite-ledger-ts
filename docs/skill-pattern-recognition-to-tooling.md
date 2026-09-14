*A Claude Code skill for this project — lives at `/mnt/skills/user/pattern-recognition-to-tooling/SKILL.md`, reproduced here so it's part of this manual's own, single, complete source. Description: MANDATORY, absolute, for this project - whenever the same kind of manual, ad-hoc investigation (grepping for the same class of thing, checking the same class of fact by hand) happens more than once in a session, stop and name it explicitly, then build a real, standing, reusable script/Makefile target for it immediately - not "later," not "if there's time." Repetition noticed and not systematized is itself the failure mode this skill exists to catch.*


# Pattern Recognition To Tooling

## The real incident this comes from

This exact session ran dozens of individual, ad-hoc `grep`/`view` calls to check "does this function exist," "how many times is this called," "is this claim in the manual still accurate" — the same, real *kind* of question, asked by hand, over and over, before finally being told directly to build a real, systematic tool instead (`scripts/call-graph.ts`). The pattern was real and repeating well before that direct prompt - it should have been caught and systematized without needing to be told.

## The real, absolute rule

1. **After the *second* time doing the same *kind* of manual check** (not necessarily the identical command, but the same real class of question - "does X exist," "how many places call Y," "is claim Z still true") - stop before doing it a third time by hand.
2. **Name the pattern explicitly**, in writing, in the moment it's noticed - not retrospectively once someone else points it out.
3. **Build the real, standing tool immediately** - a script plus a real Makefile target, per `makefile-only-execution` - before continuing with the task that revealed the pattern. The systematic version replaces the ad-hoc one from that point forward in the same conversation, not just for next time.
4. **Flag it urgently, not quietly** - state directly, in the response, "this is the Nth time I've done X by hand; building a real tool for it now" - surfacing the pattern is itself part of the job, not an optional narration.

## Real, concrete examples from this project's own history

- Checking "does this claim in the manual match reality" by hand, repeatedly, across many individual `grep` calls → became `check-docs-coverage`, a real, standing, mechanical check.
- Checking "how many places call this function" by hand, to judge whether something was dead code → became `call-graph.ts`.
- Checking "is this test name colliding with an existing one" by hand → should have become a real, standing pre-check script the moment it happened a second time, not stayed a manual habit.

## The real, honest limit

Not every repeated action needs a tool - re-running `make verify-fresh` after every real change is repetition by design, not a pattern to "fix." The real signal is specifically: a manual, ad-hoc *investigation* (a search, a comparison, a count) repeated for the same *kind* of question, where a script could answer it once and for all future need, not a routine, already-systematic verification step.
