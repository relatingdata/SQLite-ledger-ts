*A Claude Code skill for this project — lives at `/mnt/skills/user/manual-as-source-of-truth/SKILL.md`, reproduced here so it's part of this manual's own, single, complete source. Description: MANDATORY, absolute, for this project - before running exploratory commands (grep, view, search) to rediscover how something already-built works, check the Programmer's Manual first. If the manual already answers the question, use that answer directly. If it does not, or is wrong, improve the manual as part of resolving the current task - not just answer from memory/exploration and move on, leaving the gap for next time. The same obligation applies to the User Manual whenever a real user reports a defect in the application, or reports the User Manual itself as wrong, incomplete, or missing instructions.*


# The Manual Is the Primary Source of Truth

## The real, absolute rule

The Programmer's Manual (`docs/programmer-manual.md`, built from the real chapter files listed in the Makefile's own `PROGRAMMER_MANUAL_CHAPTERS`) is the first place to look when re-establishing how something already-built in this project works — not a last resort after several rounds of `grep`/`view` against the live source. Running a dozen exploratory commands to rediscover a fact that was already, correctly documented is real, wasted effort, and risks a real, subtly different answer than what was already carefully established and written down.

## Before exploring the source code to answer "how does X work"

1. Check the Programmer's Manual first, specifically.
2. If it answers the question — use that answer. Don't re-derive it independently "just to be sure" as a matter of routine.
3. If it does not answer the question, or the real, live code has diverged from what the manual says — this is itself a real, genuine finding, not just a personal gap: **fix the manual** as part of resolving whatever the current task is, so the next real question of the same kind is actually answered next time. Do not just answer from live exploration and leave the manual as it was.

## The same obligation, for the User Manual

When a real user reports a defect in the running application, or reports that the User Manual itself is wrong, incomplete, or omits a real instruction they needed — the same discipline applies. Fixing the underlying bug (or answering the immediate question) is not the whole job; the User Manual must be corrected or extended too, so the next real user reading it does not hit the same, now-known gap.

## Why this exists

Per direct instruction: this project accumulates real, hard-won knowledge (the entity-tree architecture, the translation mechanism, the RTL layout mechanism, the real testing pyramid) precisely so it does not need to be rediscovered, at real cost, every single time. Treating the manuals as disposable narration of what already happened, rather than as the live, authoritative, continuously-improved record of how this system actually works, wastes that investment.
