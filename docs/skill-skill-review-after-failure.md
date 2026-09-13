*A Claude Code skill for this project — lives at `/mnt/skills/user/skill-review-after-failure/SKILL.md`, reproduced here so it's part of this manual's own, single, complete source. Description: MANDATORY, absolute, for this project - whenever following an existing skill's own process reveals a further, unexpected failure or gap (not the failure the skill was written to catch, but a new, different surprise found while using it), stop and explicitly review it before moving on: what was the hidden assumption, could it realistically have been anticipated, what would the real impact have been if the skill's discipline had not been followed, and does this warrant a new skill, a revision to an existing one, or a documented anti-skill. This review is itself part of finishing the task, not a separate, optional step.*


# Skill Review After Failure

## Why this is its own, separate skill

`continual-skill-improvement` already describes the overall cycle (incident → skill → embraced → revised). This skill is the specific, concrete step inside that cycle that was, itself, being skipped: when a skill's own process surfaces a *second*, unexpected problem — not the bug the skill exists to catch, but a new surprise found only because the skill's discipline was actually followed — that surprise needs its own, explicit review, immediately, not just a passing mention on the way to the next task.

## The real incident this comes from

Following `test-driven-development` properly (write a test, confirm it fails, restore the fix, confirm it passes) surfaced a *second*, different failure on the "should now pass" run — a hidden assumption in the test's own setup (an account name that only exists for one specific business, not the generic one the test used). This was fixed and moved past in the same breath as the original bug, without a distinct, explicit review of what the hidden assumption actually was, whether it was foreseeable, or what it implied for how tests should be written generally. That review, once actually asked for, produced a real, useful new skill (`test-writing-standard`) — which would not have been written otherwise.

## The real, absolute rule

When a skill's own process reveals an unexpected, different failure:

1. **Stop and name the hidden assumption explicitly** — not just fix it and continue. What was actually assumed that turned out to be false?
2. **Ask whether it was foreseeable.** Could this have been anticipated from the skill's own existing documentation, or is it genuinely new information?
3. **Ask, honestly, what the real impact would have been if the skill's discipline had not been followed at all.** Sometimes the honest answer is "probably nothing" for the immediate task — that's a valid, useful answer, not a reason to skip the review. The value of the discipline is not always "the fix would have been wrong"; it can be "the resulting test would have been untrustworthy in a way nobody would have noticed."
4. **Decide, explicitly, whether this warrants**: a new skill (as with `test-writing-standard`), a revision to the skill that surfaced it, or a documented anti-skill (a pattern to actively avoid) — not silence.

## When this applies

Any time a skill's process (a red/green cycle, an impact analysis, a design-plan review) surfaces a genuine surprise distinct from what it was checking for in the first place. A skill working exactly as expected, with no surprises, needs no review beyond the skill's own, normal completion.
