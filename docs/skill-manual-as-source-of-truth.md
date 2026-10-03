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

## A second, more severe occurrence: treating a superseded mechanism as legitimate because it ran

Per direct correction, a second, confirmed instance of this exact skill being violated — worse than
the first, because the answer was not merely one `grep` away but stated as the opening line of the
very manual chapter that governs the mechanism in question. Asked to produce a realistic tutorial
end-to-end test, a large amount of effort was spent running, type-checking, and debugging
`backend/scripts/simulate-wine-retail-month.ts` as a legitimate, parallel testing path — fixing over
150 type errors in it, bisecting it across git history, finding and fixing a real bug inside it —
all without once checking whether this script was supposed to exist at all. It was not: the Step
Runner chapter's own opening line states, "per direct instruction," that this script is one of three
mechanisms (the others being the tutorial's own bespoke Playwright script and demo-seeding) the Step
Runner exists specifically **to replace**. A passing result, or a script that runs without error, was
treated as evidence of legitimacy — it is not. Whether code runs is a property of the code; whether
it is the sanctioned way to do something is a property of a decision, and only the manual holds that.

**The concrete rules this produced, now permanent, not merely a restated intention:**

1. **Before treating any script or mechanism as a legitimate test path, search the manual for its
   own literal filename first** — not "check the manual when something feels off," a mechanical,
   named-file search before the first time it is run or edited in a session.
2. **The sighting of two parallel mechanisms doing the same apparent job is itself the trigger to
   search the manual, not a reason to proceed with both.** The moment two things look like they do
   the same work (a bespoke script and a general-purpose runner; two parallel account trees; two
   contact-type tags), that duplication is exactly the shape of thing this project's own history
   shows gets explicitly, deliberately resolved somewhere in the manual — stop and search before
   assuming either one, or both, are still valid.
3. **State the manual check out loud, every time**, per this skill's own existing rule above,
   restated here because it was the rule most directly skipped: "checking the Programmer's Manual
   for X first," visibly, not folded silently into an answer.
4. **After any environment or context loss (a sandbox reset, a long-conversation compaction),
   re-read the relevant manual chapter before resuming work from memory.** Reconstructing lost work
   from recollection of the conversation, without re-checking it against the manual's own record, is
   precisely the failure this skill exists to prevent — memory is exactly what the manual is for.
5. **A passing test, a clean compile, or a script that runs to completion is evidence the code
   works — never evidence that the code, or the mechanism it belongs to, was authorized to exist.**
   Those are two separate questions, and only the second one is answered by the manual.

## Why this exists

Per direct instruction: this project accumulates real, hard-won knowledge (the entity-tree architecture, the translation mechanism, the RTL layout mechanism, the real testing pyramid, the currency-as-commodity design) precisely so it does not need to be rediscovered, at real cost, every single time. Treating the manuals as disposable narration of what already happened, rather than as the live, authoritative, continuously-improved specification of how this system actually works and is meant to work, wastes that investment — and, left unchecked, produces exactly the failure this skill was tightened to prevent: a real, already-documented answer, missed, because code was checked before the manual that already held it.
