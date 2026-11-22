# Claude Skills — Index

The project's process rules for working on the code. Each one's full
text is `docs/skill-<name>.md`. One skill is kept as a skill folder in
the repository: `backend/skills/fix-branded-types/` (a codemod that
wraps bare values passed where a branded type is expected).

| Skill | Mandatory? | Purpose |
|---|---|---|
| `backend-first-testing` | Yes | Prove a backend bug at the lowest level that shows it (SQL, then a backend call), not in a browser. |
| `branded-types-not-primitives` | Yes | A parameter or field naming a kind of thing takes its branded type (`ItemName`, `UserId`, `EntityId`), never a bare `string` or `number`. |
| `continual-skill-improvement` | No (a practice) | Skills come from incidents, are followed, and are revised when use shows them wrong. |
| `design-driven-development` | For non-trivial work | Write a plan (`docs/<feature>-plan.md`: scenario, what exists, scope) before code. |
| `documentation-coverage-enforcement` | Yes | `make check-docs-coverage` fails when an exported backend name, Makefile target or route is not in the manual. |
| `explicit-skill-attribution` | Yes | Say, when acting, which skill governs the action, or that none does. |
| `git-history-safety` | Yes, before deleting or rewriting history | Stop before deleting a file or rewriting git history. |
| `makefile-only-execution` | Yes | Every action (tests, database reset, servers, checks) goes through a Makefile target. |
| `manual-as-source-of-truth` | Yes | Read the manual before the code. A difference between them is reported, not resolved alone. |
| `no-name-encoded-values` | Yes | A fact about an entity is an attribute or a link, never part of its name parsed back, found by a wildcard, or kept as JSON. |
| `no-new-tables` | Yes, before a new table | Build from entities and links first; a table is the last resort (*The Entity Model*). |
| `pattern-recognition-to-tooling` | Yes | An investigation done twice becomes a script and a Makefile target. |
| `skill-review-after-failure` | Yes, when a skill's process meets a second problem | Name the hidden assumption: a new skill, a revision, or a documented anti-skill. |
| `specification-driven-design` | Yes | The manuals are the specification: the manual changes first, every test traces to a statement in it, and a divergence goes to the user. |
| `sql-ledger-ui-conventions` | Reference | The page conventions (menus, titles, fieldsets, tables, buttons, colours); *Frontend Reference* holds the current version. |
| `step-runner-design` | Reference | The step runner as the one testing and data-loading tool (*Testing: The Test-Runner*). |
| `test-driven-development` | Yes, for a regression test | A regression test must fail on the unfixed code before it is trusted. |
| `test-writing-standard` | Yes | A test creates every name it uses, or uses only permanent schema entities. |
| `transactional-integrity` | Yes | Every Save or Submit either commits a whole transaction or tells the person it failed and why. |
| `version-check` | Yes | The root `VERSION` file is the one application version the frontend, backend and database are checked against. |
| `wine-retail-e2e-and-docs` | Yes, before reporting a change done | The browser path actually ran and passed, and the manual is updated. |
