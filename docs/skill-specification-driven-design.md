*A Claude Code skill for this project — lives at `/mnt/skills/user/specification-driven-design/SKILL.md`, reproduced here so it's part of this manual's own, single, complete source. Description: MANDATORY, absolute, for this project - the User Manual and Programmer's Manual are not narration written after the fact; they are the binding specification. Before any real, non-trivial implementation work, the intended behavior must already be stated in the relevant manual, and every test must be directly traceable to a specific statement in it — e2e/Playwright tests to the User Manual, unit/API/DB tests to the Programmer's Manual. A manual/code divergence, found in either direction, is never resolved unilaterally — it is reported immediately, with both correction paths laid out, for the user to choose. Distinct from `design-driven-development` (a Design Thinking process for arriving at a good design) - this skill governs what is authoritative and in what order things are allowed to happen, regardless of how the design itself was arrived at.*


# Specification-Driven Design

## The real, absolute rule

The manuals are the specification, not the write-up. **Nothing is implemented, and no test is written, except as a direct, traceable derivation of something the relevant manual already states.** If the manual doesn't yet state it, the manual is updated *first* — as its own, explicit step, visibly stated before any code or test is touched — and only then does work proceed from what it now says.

The real, required sequence, every time, for non-trivial work:

1. **State it in the manual.** The relevant manual (User Manual for user-facing behavior, Programmer's Manual for internal design/implementation/DB/API) is updated to say, explicitly, what the intended behavior is — before any test or code exists for it.
2. **Derive the test directly from that statement.** An e2e/Playwright test traces to a specific User Manual statement; a unit/API/DB test traces to a specific Programmer's Manual statement. Confirm the test genuinely fails first (per `test-driven-development`).
3. **Implement to make the derived test pass.** Not the other way around, and not from a mental model of what the feature "should" do — from what the manual, right now, actually says.

Deviating from this order — writing code before the spec is stated, or skipping the failing-test step — happens only when the user says so explicitly, in advance, for that specific piece of work, and why.

## Consulting the manual is a visible step, not a silent one

Per `manual-as-source-of-truth`: the Programmer's Manual (for internal/design/DB/API questions) or User Manual (for user-facing behavior questions) is checked *before* any exploratory `grep`/`view` against the live source, every time — not as a general habit, but as a step stated out loud, in the response or in visible reasoning, each time it happens: "checking the Programmer's Manual for X first." The same applies to the follow-up check of the manual's claim against the live code — that verification step is stated explicitly too, not folded silently into an answer as if it were simple recall. Both halves of this are worth surfacing because they're exactly the discipline that's easy to skip under time pressure, and skipping it silently is indistinguishable, to a reader, from never having done it at all.

## A divergence is reported, never resolved alone

The moment a real gap is found — the manual is silent on something the code does, or the manual and the live code actively disagree — that is a stop point, not a fix-it-and-move-on point. Report it directly: what the manual says (or that it says nothing), what the code actually does, and the two real, concrete options this implies — correct the code to match the manual's stated intent, or correct the manual to match the code's real, current behavior — each with what it would actually change and affect. Wait for the user's choice before touching either. This holds even when one direction seems obviously correct; which one is *intended* is a judgment only the user can make with certainty.

## The Programmer's Manual points to exact code, not just describes it

A Programmer's Manual entry that explains a mechanism without saying which function, in which file, implements it forces the next reader back into exploratory search — precisely the cost `manual-as-source-of-truth` exists to avoid. Going forward, a Programmer's Manual chapter describing a real, existing mechanism names the specific, real function(s) and file(s) that implement it directly (e.g. "see `getTrialBalance` in `backend/src/db-reports.ts`"), not just the mechanism in the abstract. This is a real, expected property of every chapter that documents already-built behavior, not an occasional nicety.

## Why this exists

Per direct instruction, following a real, direct, immediate incident: a design already discussed and already documented (currency as a commodity, in `multicurrency-design.md`) was answered from scratch, by exploring the live code, without checking the manual first — producing an answer that was accurate about the *current, built* state but silent about the *already-decided, documented* design sitting one file away. The manual being the actual specification, checked first every time, with the check itself stated visibly, is the direct, permanent fix for this exact failure mode recurring.
