# Claude Skills — Index

This project maintains a set of Claude Code skills — standing process
rules, each anchored to a real, confirmed incident, that govern how
work on this codebase is done. Each lives at
`/mnt/skills/user/<name>/SKILL.md` and, historically, was also
reproduced in full in the compiled manual; this Programmer's Manual
keeps only this index (name, one-line purpose, and whether it's
mandatory) — read the skill file itself, or the Historical Design &
Decision Log (which still carries each skill's own full text and the
incident narrative behind it), for the complete text.

| Skill | Mandatory? | Purpose |
|---|---|---|
| `backend-first-testing` | Yes | Before reaching for Playwright/browser testing, prove a backend-only bug at the lowest possible level first (raw SQL, then a direct backend function call) — never a browser, when a browser isn't what the bug is actually about. |
| `branded-types-not-primitives` | Yes | Never use a bare `string`/`number` for a parameter or field that represents a specific, named kind of thing — use this project's own branded types (`ItemName`, `UserId`, `EntityId`, etc.) instead. |
| `continual-skill-improvement` | No (a practice, not a gate) | Skills emerge from confirmed incidents, get documented, get actually followed, and get revised when later use reveals the guidance was incomplete or wrong. |
| `design-driven-development` | For any non-trivial feature or structural change | Write a plan document (`docs/<feature>-plan.md`) — scenario, what already exists, honest scope — before writing implementation code. |
| `documentation-coverage-enforcement` | Yes | `make check-docs-coverage` fails loudly if any exported backend function, Makefile target, or frontend route is never named anywhere in the assembled manual. Catches total absence, not semantic staleness. |
| `explicit-skill-attribution` | Yes | State, at the point an action is taken, which skill governs it, or that it's routine/uncovered — a skill that doesn't visibly govern real-time behavior is worthless. |
| `git-history-safety` | Yes, before any deletion or history-rewrite | Before deleting a file, or any history-rewriting git action, stop — a committed file is recoverable; a rewritten history may not be. |
| `makefile-only-execution` | Yes | Every real action (tests, db reset, server restart, verification) goes through a named Makefile target — no ad-hoc shell command. |
| `manual-as-source-of-truth` | Yes | Check the relevant manual first, before exploratory code search, for any question — not just "how does X work." A divergence between the manual and the live code is a stop point to report, not resolve unilaterally. |
| `no-new-tables` | Yes, before any new SQL table | Check first whether the capability can be built from the existing entity-tree/link mechanisms. A new table is a last resort — see "Division, location, and part are genuinely just entities" in the Entity Model chapter for the concrete track record. |
| `pattern-recognition-to-tooling` | Yes | The same kind of manual, ad-hoc investigation repeated more than once in a session should be named and turned into a standing script/Makefile target immediately, not deferred. |
| `skill-review-after-failure` | Yes, when a skill's own process surfaces a second, unexpected problem | Review the hidden assumption explicitly — does it warrant a new skill, a revision, or a documented anti-skill — rather than a passing mention. |
| `sql-ledger-ui-conventions` | Reference, used whenever building/modifying a frontend page | The established Svelte/CSS conventions — top menu, side menu, page/panel titles, fieldset outlines, tables, buttons, tags, colors. Superseded in this manual by the Frontend Reference chapter's own CSS/panel-standard section, which is the current, condensed version of the same material. |
| `test-driven-development` | Yes, for any regression test | A regression test must be shown to genuinely FAIL against the unfixed code before it's trusted to PASS against the fix. |
| `test-writing-standard` | Yes, for every new test | Every test is fully self-contained — any account/entity/vocabulary name it references is either created within that same test or a genuinely permanent, stable part of the schema; never assumed present because some other business happens to have it. |
| `wine-retail-e2e-and-docs` | Yes, before reporting any change done | A closing checklist for any code change: Playwright actually run and passed (not a `curl` substitute), documentation actually updated (not a code comment instead). |

**Not included here**: `skill-step-runner-design.md` and
`skill-manual-as-source-of-truth`'s own underlying rationale have
their real, current content folded directly into the Testing: E2E and
System Overview chapters respectively, rather than listed as a
separate skill to read in full.