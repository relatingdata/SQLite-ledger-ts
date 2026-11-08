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

There is **no separate "Project" entity type**. A project is just the
*name of an Expense Chart-of-Accounts account* — whatever account a
business already uses for, say, "Downtown Renovation" or "Client X
Consulting."

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
  account and that cost posts for real." There is no project record
  with its own start/end dates, budget, status, or site — the account
  name *is* the project's only identity.

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

**None of this exists.** There is no task entity, no task-dependency
graph, no project budget, no Gantt-style timeline, and no screen that
shows more than one project/employee at a time.

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
