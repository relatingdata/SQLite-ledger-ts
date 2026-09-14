*A Claude Code skill for this project — lives at `/mnt/skills/user/documentation-coverage-enforcement/SKILL.md`, reproduced here so it's part of this manual's own, single, complete source. Description: MANDATORY, absolute, for this project - a real, automated, mechanical check (make check-docs-coverage) runs as part of make verify-fresh, scanning every real, exported backend function, every real Makefile target, and every real frontend route, failing loudly if its own name never appears anywhere in the assembled Programmer's Manual. This is the strongest real, structural guarantee against documentation drift that is honestly achievable - it catches total absence, not semantic staleness, and does not, cannot, and should never be described as making drift "impossible."*


# Documentation Coverage Enforcement

## An honest statement of what this is, and what it is not

Per direct challenge: "impossible" is not an honest word to use here, and this skill exists specifically to avoid overselling. What follows is the strongest real, mechanical, structural safeguard actually achievable — not a promise that drift cannot happen, because it can:

- This check confirms a name **appears** in the manual — it cannot confirm the manual's own description of that name is still **accurate**. A function whose behavior changed, whose signature was extended, or whose real purpose shifted, while its old manual mention remains technically present, passes this check while still being genuinely stale. Semantic staleness is a real, separate, harder problem this check does not solve — `manual-as-source-of-truth` and `skill-review-after-failure` remain the real, human/AI-judgment defenses against that class of drift.
- This check only covers backend exported functions, Makefile targets, and frontend routes — not every real fact a manual might get wrong (a described relationship, a workflow's real steps, a business rule).

## The real, mechanical check

`make check-docs-coverage` (a real, standing Makefile target, part of `make verify-fresh`, per `makefile-only-execution`):

1. Extracts every real `export function <name>` from `backend/src/*.ts`.
2. Extracts every real Makefile target name.
3. Extracts every real frontend route (`+page.svelte` paths).
4. For each, checks whether that exact name appears anywhere in the assembled `docs/programmer-manual.md`.
5. Reports every real name with zero mentions, and exits non-zero if any exist that aren't already in the real, tracked baseline (`docs/documentation-coverage-baseline.md`) — a real, structural build failure, not a warning to ignore.

## The real, honest ratchet

This project had 149 real, pre-existing, genuinely undocumented names the day this check was introduced — fixing all of them before the check itself could exist was not realistic. `docs/documentation-coverage-baseline.md` lists those known gaps explicitly, by name. The check enforces **zero new gaps** from this point forward; the baseline is expected to shrink over real, separate documentation work, never to grow. A name should only ever be added to the baseline for a genuine, deliberate, temporary reason stated directly next to it — never as a routine way to make the check pass.

## The real, absolute rule

1. Every new, real, exported backend function, Makefile target, or frontend route must be mentioned, by name, somewhere in a real manual chapter before the work introducing it is considered complete.
2. `make check-docs-coverage` runs as a real, standing part of `make verify-fresh` — a change that adds real, undocumented surface area fails the same, standard verification every other change goes through, not a separate, optional step easy to skip.
3. A real name appearing in the manual is the necessary, checkable floor — it is not sufficient on its own. `manual-as-source-of-truth` still governs whether what's written is actually correct.

## Why build this instead of just promising harder

Per direct, fair challenge to be honest rather than reassuring: an unenforced promise ("I will always update the manual") has already, repeatedly, not been followed inside this exact project's own history — several real skill chapters were only created after being directly asked whether they already existed. A real, mechanical, build-failing check does not depend on remembering; it depends on the check running, which `makefile-only-execution` and `verify-fresh` already make close to automatic. This is offered as the honest, strongest real answer to the request, not a claim that the underlying problem is solved.
