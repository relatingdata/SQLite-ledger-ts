*A Claude Code skill for this project — lives at `/mnt/skills/user/continual-skill-improvement/SKILL.md`, reproduced here so it's part of this manual's own, single, complete source. Description: A (not the only) process for continual improvement in this project - real skills emerge from real, confirmed incidents, get documented (SKILL.md plus a full Programmer's Manual chapter), get embraced (actually followed on every subsequent real task), and get MODIFIED as continual testing reveals a skill's own guidance was incomplete or wrong. Skills are living, revisable documents anchored to real events, not a fixed, one-time checklist.*


# Continual Skill Improvement

## What this is, and what it isn't

This is genuinely useful, but it is one real practice among several that keep quality up in this project — alongside direct verification (re-running things fresh rather than trusting memory), the real testing pyramid, and design-first plan documents. It does not replace those; it's the mechanism by which lessons from *using* them get captured so they don't have to be relearned.

## The real cycle, as it has actually happened in this project

1. **A real incident happens** — a mistake, a near-miss, or a genuinely effective pattern noticed while doing real work (not a hypothetical "best practice" imported from outside this project's own history).
2. **It gets documented** as a real, standing skill — a SKILL.md file under `/mnt/skills/user/`, written around the specific, real incident, not a generic restatement of a well-known principle.
3. **It gets embraced** — followed on every subsequent real task in this project, not just the one it was written for. A skill that sits unused is not actually part of this cycle.
4. **It gets modified when continual testing reveals a gap.** A skill is not fixed the moment it's written — confirmed directly, this project's own history: the `test-driven-development` skill exists *because* a real regression test, written under the `backend-first-testing` skill's own guidance, was later found to prove nothing on its first run. The newer skill didn't replace the older one — it added the missing half of the discipline the first skill hadn't yet covered. Expect this pattern to continue: a skill revealing its own incompleteness under real use is a genuine success of this cycle, not a failure of the skill.

## What actually triggers a new or revised skill

Not every mistake needs a new skill — a one-off typo doesn't. The real signal is: **would writing this down have prevented a real, avoidable cost, and is it likely to recur in a different, future context?** If yes, write it (or revise the closest existing skill) as part of finishing the task, not as a separate, later chore.

## Keeping the manual and the skills honest together

Per `manual-as-source-of-truth`: every real skill gets a full, corresponding Programmer's Manual chapter, kept in sync with the real `SKILL.md` file, not a summary that can drift from it. This appendix's own existence is itself an instance of the cycle it describes.
