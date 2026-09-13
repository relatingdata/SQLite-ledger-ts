*A Claude Code skill for this project — lives at `/mnt/skills/user/explicit-skill-attribution/SKILL.md`, reproduced here so it's part of this manual's own, single, complete source. Description: MANDATORY, absolute, for this project - every real action must state, in writing, at the point it's taken, which skill governs it ("Applying skill: <name>") or that it is routine/uncovered ("Routine action, no skill applies"). A skill that doesn't visibly govern real-time behavior is worthless. Over time, a routine action that works repeatedly is a candidate for a new skill; an approach that wastes time or fails is a candidate for a documented "anti-skill" (a named pattern to actively avoid), not silently dropped.*


# Explicit Skill Attribution

## Why this exists

Per direct, real feedback: skills mean nothing if they don't visibly govern practice. Writing "backend-first-testing" and "test-driven-development" as skills, then quietly reverting to un-tested, un-analyzed code changes anyway (as happened directly, in this project, immediately after both skills were written) is worse than not having the skills at all — it creates the appearance of rigor without the substance.

## The real, absolute rule

1. **Before or during any real action**, state plainly which skill governs it: `Applying skill: backend-first-testing (writing the repro at the lowest real level)`. If no skill applies, say so: `Routine action, no skill applies.`
2. **This is not a formality tacked on after the fact.** State it at the point the action is taken, not retrofitted into a later summary once the work is already done.
3. **A skill invoked but not actually followed is worse than honesty about skipping it.** If time pressure means a skill's full discipline isn't being followed, say that directly — "skipping the red/green check here, noting the real risk" — rather than silently doing less than the skill requires while implying otherwise.

## Anti-skills: capturing what doesn't work, not just what does

A real, repeated approach that wastes time, produces false confidence, or causes rework is exactly as valuable to document as a real, repeated approach that works well — the difference is a skill says "do this," an anti-skill says "this looks reasonable but isn't; do something else instead." Per the `continual-skill-improvement` skill's own cycle, a real, confirmed failure mode is a genuine candidate for a new anti-skill entry, not something to just quietly stop doing without writing it down.

## This project's own, real, immediate example

Both `backend-first-testing` and `test-driven-development` were written as real skills — and then, in the very next real bug fix (the `completeStockTake`/`writeOffStock` unbalanced quantity-movement fix), the code was changed directly, without first writing a failing test, and without a documented impact analysis — until directly challenged on exactly this. This skill exists so that gap is visible and named the moment it happens, not only when someone else has to ask about it.
