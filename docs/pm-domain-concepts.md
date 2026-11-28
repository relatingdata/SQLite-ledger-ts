# Domain Concepts: Services, Projects, Staff Scheduling, Gantt Charts

Where the app models four things people expect an ERP to have, and
what it does not have.

## Sale and purchase of services (non-inventory items)

There is no Service entity. A service is a Stock Receipt or Stock
Dispatch line without a quantity.

- **Where**: the Stock Receipt (`frontend/src/routes/stock/stock-receipt/`)
  and Stock Dispatch (`frontend/src/routes/stock/stock-dispatch/`) pages
  have an `isService` checkbox ("This is a service — no physical stock
  quantity to track"). Ticked, the page sends `item_qty: undefined` to
  `stageOrderReceipt` or `stageOrderDispatch`.
- **What changes**: the money and tax legs post as usual. There is no
  `-QTY` posting, no cost of goods sold and no change to any item's
  quantity on hand.
- **In reports**: a service is in no inventory report
  (`getInventoryListing`, `getStockMovementReport`, below-reorder) and
  in every financial one (Trial Balance, P&L, Balance Sheet, Sales
  Report).

Tests (*Testing: Unit*, "Running the tests"):
- "a service dispatch (no item, no item_qty, no unit_cost) skips COGS and quantity movement entirely — matches the exact worked example: 10 hours @ 150.00 with 10% tax" (`backend/test/db.test.ts`)
- "a service receipt (no item_qty) skips the quantity movement, still posts the monetary and tax legs correctly" (`backend/test/db.test.ts`)

## Projects

Two mechanisms answer to "project".

### A project as an expense account

`clockInToProject`, `clockOutOfProject` and
`getOpenProjectClockForEmployee` (`backend/src/db-journal.ts`;
dispatched by `call-dispatch/projects.ts` as `clockInToProject`,
`clockOutOfProject` and `getOpenProjectClock`) take a project as the
name of an Expense account (`projectExpenseAccount: AccountName`). The
page is `/projects` (generated, forms template: `states.projectClock`,
`formActions.clockIn`/`clockOut`): pick an employee and an
account, clock in or out.

- The employee is a vendor selling their time: clocking in stages a
  purchase order against the account; clocking out posts hours ×
  the employee's wage rate against it.
- The open clock is a child entity of the employee, `Clocked In — <PO
  reference> — <project account> — <timestamp>`, related to `Active`.
- There is no project record: no dates, budget, status or site.

### Live Project

A Live Project (*Project Builder*) is an entity under the business's
`Live Projects` root (`PER_BUSINESS_ROOTS`, `db.ts`), with `Client`,
`Requested Start`, `Target Completion Date`, `Schedule Risk`, `Profit
Center` and `Project Expense Account`, and `Milestone` children
(`Plans Submission`, `Inspection`, `Invoicing`, each with a `Due Date`).
Accepting a Project Proposal (a quotation with recipe lines) creates
one, with its own Profit Center and Expense account.

The two meet at the account: `clockInToProject` and `clockPlantIn`
take the Live Project's `Project Expense Account`, so time clocked
against it is the project's cost (`getProjectCostReport`).
`clockInToProject` does not check that an account belongs to a project.

- **Where**: `backend/src/db-projects.ts` (`createLiveProject`,
  `getLiveProject`, `listLiveProjects`, `createMilestone`,
  `getMilestones`, `getResourceBookings`, `findNextAvailableWindow`,
  `scheduleProjectRecipeLines`, `checkMilestoneAchievability`,
  `provisionProjectProfitCenter`, `getProjectCostReport`), dispatched
  by `call-dispatch/projects.ts`, `call-dispatch/plant.ts` and
  `call-dispatch/prototypes.ts`.

## Staff allocation / scheduling beyond project clock-in

`setEmployeeSchedule` and `getEmployeeSchedule` (`db.ts`, dispatched
by `call-dispatch/locations.ts`) record when an employee works at a
location. They share nothing with project clocking: an employee's
clock-ins and location schedule are separate facts.

## Gantt charts, task dependencies, multi-project overviews

There is no Gantt chart, no task or dependency between tasks, and no
screen showing more than one project or employee at a time.
`getResourceBookings` and `findNextAvailableWindow` do look across
projects: a resource booked on another live project pushes a new
booking later. That has no screen of its own.

`docs/construction-project-management-plan.md` is a design, not
implemented: sites, tasks and budgets as child entities, a dependency
as one link entity per edge, the critical path computed in TypeScript.
