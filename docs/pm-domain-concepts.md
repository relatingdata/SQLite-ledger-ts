# Domain Concepts: Services, Projects, Staff Scheduling, Gantt Charts

A direct, honest answer to the question "where does the app model
X?" for four related domain topics people reasonably expect a ledger/
ERP app to have a dedicated entity for. For each, this states plainly
what exists today, where it lives, and what does not exist — so
answering this question never again requires reading source code from
scratch.

## Sale and purchase of services (non-inventory items)

There is **no separate "Service" entity type**. A service is a Stock
Receipt or Stock Dispatch line with its quantity tracking turned off.

- **Where**: the Stock Receipt (`frontend/src/routes/stock/stock-receipt/`)
  and Stock Dispatch (`frontend/src/routes/stock/stock-dispatch/`) pages
  each have an `isService` checkbox ("This is a service — no physical
  stock quantity to track"). Toggling it on sends `item_qty: undefined`
  to the backend (`receiveStock`/`dispatchStock`, `call-dispatch/pos.ts`)
  instead of a real count.
- **What actually changes**: nothing about the account posting — the
  real money/value leg still posts normally against whatever account
  the line names. Only the *quantity* leg is skipped: no `-QTY`-suffixed
  pseudo-posting, no COGS quantity movement, nothing added to any
  item's on-hand count.
- **What this means for reports**: a service line is invisible to
  inventory reports (`getInventoryListing`, `getStockMovementReport`,
  reorder/stock-out-risk) by design — there is no stock to list — but
  shows up normally in every financial report (Trial Balance, P&L,
  Balance Sheet, Sales Report) exactly like a physical item would.

## Projects

Two, genuinely separate mechanisms both answer to the word "project" in
this app, and neither replaced the other.

### The original, account-name-only "project"

A project is just the *name of an Expense Chart-of-Accounts account* —
whatever account a business already uses for, say, "Downtown
Renovation" or "Client X Consulting." Unchanged by the Project Builder
work below.

- **Where**: `backend/src/db-journal.ts` — `clockInToProject`,
  `clockOutOfProject`, `getOpenProjectClockForEmployee`. Dispatched via
  `call-dispatch/projects.ts` (`clockInToProject`/`clockOutOfProject`/
  `getOpenProjectClock`). Frontend: `frontend/src/routes/projects/`
  (171 lines — pick an employee, pick a project/account, clock in or
  out; nothing else).
- **How it's modeled**: the employee is treated as a vendor selling
  their own time. Clocking in stages a real Purchase Order against the
  chosen expense account (`projectExpenseAccount: AccountName` — a real
  account name, not a project id). Clocking out computes hours worked ×
  the employee's configured wage rate and posts that as a real cost
  against the project account.
- **Clock state**: a child entity under the employee
  (`Clocked In — <PO reference> — <project account> — <timestamp>`,
  tagged `Active`), not a new table — the same append-only entity-graph
  pattern used throughout this app, not a bespoke "project" schema.
- **What this means**: "assign staff to a project" works, in the narrow
  sense of "an employee can clock time against a named expense
  account and that cost posts for real." Used on its own, there is no
  project record with its own start/end dates, budget, status, or site
  — the account name *is* the project's only identity.

### Live Project — a real project entity, built for Project Builder

`clockInToProject`'s own `projectExpenseAccount` parameter is still
just an account name with no runtime check that it belongs to anything
— but since the Project Builder work (see `docs/pm-project-builder.md`
for the full mechanism), a real **Live Project** entity now exists too,
and the two compose: a Live Project's own, automatically provisioned
Expense account is exactly the kind of account name `clockInToProject`/
`clockPlantIn` already take, so real labour/plant time clocked against
a Live Project lands as a real cost on it, with zero change to either
clock function's own signature.

- **Where**: `backend/src/db-projects.ts` (`createLiveProject`,
  `getLiveProject`, `listLiveProjects`, `createMilestone`,
  `getMilestones`, `getResourceBookings`, `findNextAvailableWindow`,
  `scheduleProjectRecipeLines`, `checkMilestoneAchievability`,
  `provisionProjectProfitCenter`, `getProjectCostReport`). Dispatched
  via `call-dispatch/projects.ts` and `call-dispatch/plant.ts`/
  `call-dispatch/prototypes.ts`.
- **A real entity, not an account name**: `PER_BUSINESS_ROOTS`'s own
  `Live Projects` root (`db.ts`) — a Live Project carries its own
  `Client`/`Requested Start`/`Target Completion Date`/`Schedule Risk`/
  `Profit Center`/`Project Expense Account` attributes, and its own
  child `Milestone` entities (`Plans Submission`/`Inspection`/
  `Invoicing`, each with its own `Due Date` and possible `Schedule
  Risk`). It is created automatically when a multi-line Project
  Proposal (a widened Quotation, see below) is accepted.
- **What this means**: a Live Project has a real start/target-
  completion date, a real set of Milestones, a real dedicated Profit
  Center and Expense account comparing its quoted price to its actual
  labour/plant cost, and a real, computed Schedule Risk when a genuine
  resource double-booking pushes its completion past what the client
  wanted — everything the plain, account-name-only mechanism above
  deliberately does not have. See `docs/pm-project-builder.md` for the
  Recipe/Plant/Skill/Prototype/contention mechanism this is built on,
  and the Project Builder tutorial chapter for a full, worked example.

## Staff allocation / scheduling beyond project clock-in

Separately from project clocking, `backend/src/db-stock.ts`'s
location-scheduling functions (`setEmployeeSchedule`/
`getEmployeeSchedule`, `call-dispatch/locations.ts`) let a location
record which employees are rostered on, and when — a real, working
capability, but scoped to *location* staffing (who's on shift at a
store/warehouse), not to *project* staffing. The two systems don't
share any data: an employee's project clock-in and their location
schedule are entirely independent facts today.

## Gantt charts, task dependencies, multi-project overviews

**Still no Gantt chart, task-dependency graph, or screen that shows
more than one project/employee at a time.** What changed: Live
Project's own `findNextAvailableWindow`/`getResourceBookings`
(`db-projects.ts`, see above and `docs/pm-project-builder.md`) IS a
real, working cross-project awareness — it reads every OTHER live
project's own real Labour/Plant bookings for a named resource before
resolving a new one, and pushes a genuine conflict into the future
rather than ignoring it. That is real resource contention across
projects, computed on demand; it is not a Gantt-style timeline, has no
notion of a task or a dependency edge between two tasks, and has no UI
of its own — the Project Builder tutorial's own narration (never a
rendered chart) is how this is currently seen.

`docs/construction-project-management-plan.md` is a **design document
only** — a deliberately honest scoping of what a real construction/
multi-site project-management extension (sites, phases, subcontractors,
dependent task schedules, progress billing) would take, written against
this app's real, current primitives. It proposes modeling sites/tasks/
budgets as child entities (the same name-encodes-data pattern this app
already uses for BOM components), task dependencies as one link-entity
per edge, and computing the critical path in TypeScript rather than SQL.
**None of it is implemented.** If a future request asks for Gantt
charts or project scheduling, that design doc — not this chapter — is
the starting point for scoping the work; this chapter exists only to
make clear, without reading either the doc or the source, that the
capability itself doesn't exist yet.
