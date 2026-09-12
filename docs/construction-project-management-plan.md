# Construction/Multi-Site Project Management: Real Scope, Honestly Assessed

## The real business scenario

A building/construction company runs many real projects at once, each
at a different physical site, each with its own real schedule, budget,
and Gantt-style plan of dependent tasks — not just "one employee
clocked into one project" (the real, current, basic capability this
application already has via `/projects`).

## What genuinely already exists — confirmed directly, not assumed

`clockInToProject`/`clockOutOfProject` (backend `db.ts`) already do
real, working, valued labor-cost tracking: clocking in stages a real
Purchase Order against a project's own expense account; clocking out
computes real hours worked × the employee's own configured wage rate,
posting that as a real cost against the project. This is a genuine,
if basic, Timecards capability — `sql-ledger-comparison.md` was
corrected directly, since it previously and incorrectly claimed no
equivalent existed at all.

The real, current `/projects` screen (171 lines) is exactly this one
capability and nothing more: pick an employee, pick a project (a
single expense account), clock in or out. No site, no schedule, no
budget, no multi-project overview, no dependency between tasks.

## What's genuinely, completely missing

- **Multiple, distinct real sites per project** — today, a "project"
  is just a single expense account; there's no real concept of a
  physical site, or of a project spanning several sites.
- **Schedules and Gantt-style planning** — no real, dependent-task
  model exists anywhere in this codebase (task A must finish before
  task B starts, task C runs in parallel with task B, etc.) — this is
  a genuinely different kind of data than anything currently modeled.
- **Project budgets** — no real "planned vs. actual" cost tracking
  exists; clocking in/out posts real, actual costs only, with nothing
  to compare them against.
- **Multi-project, multi-employee overview** — today's screen only
  shows one employee's own current clock status; there's no real
  "which of my 12 sites has anyone clocked in right now" view.

## A real, honest, no-new-tables-first design sketch

Per this project's own established convention: a real "site" is
genuinely just another Item hierarchy sibling of Locations — a
`{project} Sites` parent under each real Project entity, each site a
real, ordinary child entity, so `clockInToProject` could be extended
to take an optional real site alongside its existing project/expense
account, with no new table required for this specific piece.

**A real, honest, direct limitation of the no-new-tables approach**:
task dependencies (Gantt-style "B can't start until A finishes") are
genuinely a graph, not a tree — the existing `parent_id`/`relation_id`
entity model is built for hierarchy and simple, single-target links,
not arbitrary many-to-many task dependencies with real start/end date
constraints. This is very likely the first genuinely honest case this
session where a real, dedicated table (or a small handful of them) is
the more correct engineering choice, rather than stretching the
existing entity-link mechanism to fit a shape it wasn't designed for.

## A real, no-new-tables-at-all design, per direct, absolute instruction

No new tables. No new columns on any existing table, including
`contact`. Every piece of this — sites, tasks, schedules, budgets, and
dependencies — is a real, ordinary child entity, using exactly the
same mechanism already proven working for Bill of Materials this
session: dates and amounts encoded directly into the entity's own
name, parsed back out by a real, direct regex, with dependencies as
real, individual link-entities under their own task.

### Sites — a real child entity, same shape as Locations under a Business

`createEntity({ name: 'Riverside Site', parent: '{Project} Sites' })`
— identical, direct precedent to how Locations already sit under
`{Business} Locations`.

### Tasks — a real child entity, schedule encoded in its own name

`createEntity({ name: 'Frame the walls (2026-09-15 to 2026-09-20)', parent: '{Project} Tasks' })`
— matching exactly how a BOM component's quantity is encoded directly
into its own link-entity's name (`"Gin & Tonic — BOM: Gin (30ml)"`), a
real, direct, already-proven pattern, not a new idea. A real, direct
function, `getProjectTasks(projectName)`, would parse the parenthetical
date range back out with a regex, mirroring `getBomComponents` exactly.

### Task dependencies — a real, individual link-entity per edge, per task

For "Frame the walls" depending on "Pour the foundation" finishing
first: a real child entity of the *dependent* task, named
`"Frame the walls — Depends On: Pour the foundation (finish_to_start)"`
— exactly the same real shape as a BOM component link
(`"{assembly} — BOM: {component} ({qty}{unit})"`), just naming a
predecessor task instead of a stock item, and a dependency type
instead of a quantity. A task can have several of these real, separate
child entities — one per real predecessor — genuinely modeling the
many-to-many dependency graph without any new table, since each real
dependency is simply its own, individual entity, the same way each BOM
component already is.

### Budget vs. actual — also just a real, named entity, no new column

`"{task} — Budget (2500.00)"` as a real child entity under the task,
parsed the same way; actual cost continues to come from the existing,
real, already-working `clockInToProject`/`clockOutOfProject` posting
mechanism, compared directly against this parsed budget figure in a
real, direct TypeScript function — no schema change needed for
"budget vs. actual" at all, since both sides are already real,
retrievable numbers once parsed.

### Critical-path computation — still real, standard graph work

The algorithm itself (topological sort, forward/backward pass, zero-
slack tasks) is unchanged from before — it simply now walks these
real, individual dependency link-entities (found via
`current_entities` `parent_id`/`relation_id`, exactly like
`getBomComponents` already does) instead of rows in a dedicated table.


## Honest, direct open questions, not yet resolved

- Whether Gantt-chart *rendering* belongs in this application at all,
  versus real, two-way integration with an existing, dedicated
  project-scheduling tool (e.g. exporting/importing a real, standard
  schedule format) — a genuinely large scope difference.
- Whether "budget vs. actual" should reuse the existing Chart of
  Accounts (a budget account paired with each real expense account),
  or needs its own, separate real concept.
- Whether multi-site tracking is more naturally a Location (the
  existing, real Location entity type) reused for a construction site,
  or a genuinely new, distinct kind of entity.
