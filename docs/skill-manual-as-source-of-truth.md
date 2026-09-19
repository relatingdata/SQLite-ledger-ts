*A Claude Code skill for this project — lives at `/mnt/skills/user/manual-as-source-of-truth/SKILL.md`, reproduced here so it's part of this manual's own, single, complete source. Description: MANDATORY, absolute, for this project - before doing anything else (answering a question, investigating a bug, starting an implementation), check the relevant manual first: the Programmer's Manual for internal design/implementation/DB/API questions, the User Manual for user-facing behavior questions. Never reach for exploratory code search (grep, view) as the first move. If the manual answers the question, use that answer, stated visibly as coming from the manual. If it doesn't, or the live code has diverged from what it says, this is a stop point: report the divergence directly, with both real correction paths, and let the user choose — never resolve it unilaterally in either direction. See `specification-driven-design` for the fuller discipline this feeds into.*


# The Manual Is the Primary Source of Truth

## The real, absolute rule

The Programmer's Manual (`docs/programmer-manual.md`, built from the real chapter files listed in the Makefile's own `PROGRAMMER_MANUAL_CHAPTERS`) and the User Manual are the first place to look for **anything** — not just "how does X already work," but any question, any investigation, any piece of new work. Not a last resort after several rounds of `grep`/`view` against the live source; the *first* move, before those tools are touched at all. Running exploratory commands to rediscover a fact that was already, correctly documented is real, wasted effort, and risks a real, subtly different answer than what was already carefully established and written down — including, per direct, real incident, answering a design question from the live code alone while the actual, already-decided design sat one file away, undiscovered, in the manual.

## Before doing anything — a question, a bug investigation, new work

1. Check the relevant manual first, specifically — Programmer's Manual for internal/design/implementation/DB/API, User Manual for user-facing behavior.
2. **State that this check is happening, visibly**, in the response or reasoning — "checking the Programmer's Manual for X first" — not silently folded into an answer as if it were simple recall. This applies every time, not selectively.
3. If it answers the question — use that answer, and say so. Don't re-derive it independently "just to be sure" as a matter of routine.
4. If it does not answer the question, verify against the live code next (also stated visibly), and only then treat the gap as real, new information to act on.

## A divergence is reported, never resolved unilaterally

If the manual is silent, or the live code has diverged from what the manual says — **stop.** This is not "fix the manual and move on" or "trust the code and move on." Report the divergence directly to the user: what the manual states (or that it states nothing), what the code actually, currently does, and the two real, concrete corrections this implies — code-to-match-manual, or manual-to-match-code — each described concretely enough to choose between. Wait for the user's decision before changing either one. Only after they choose does the actual fix happen, updating whichever side they picked so the next real question of the same kind is genuinely answered.

## The same obligation, for the User Manual

When a real user reports a defect in the running application, or reports that the User Manual itself is wrong, incomplete, or omits a real instruction they needed — the same discipline applies: check the User Manual first, report any divergence found rather than silently picking a side, and only proceed once told which direction to correct.

## The Programmer's Manual names exact functions and files, not just mechanisms

A chapter documenting an already-built mechanism states which real function, in which real file, implements it — "see `getTrialBalance` in `backend/src/db-reports.ts`," not just a description of what trial balances do. This is what makes "check the manual first" actually save the exploratory step it's meant to save; a manual that describes behavior without pointing at its own implementation still sends the next reader back into `grep`.

## Why this exists

Per direct instruction: this project accumulates real, hard-won knowledge (the entity-tree architecture, the translation mechanism, the RTL layout mechanism, the real testing pyramid, the currency-as-commodity design) precisely so it does not need to be rediscovered, at real cost, every single time. Treating the manuals as disposable narration of what already happened, rather than as the live, authoritative, continuously-improved specification of how this system actually works and is meant to work, wastes that investment — and, left unchecked, produces exactly the failure this skill was tightened to prevent: a real, already-documented answer, missed, because code was checked before the manual that already held it.
