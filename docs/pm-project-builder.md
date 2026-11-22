# Recipe, Plant, Skill, Prototype, Live Project, Milestone, and the scheduling/contention engine

This chapter describes what the Project Builder tutorial
(`docs/user-manual-ch5-project-builder-tutorial.md`, `make
test-e2e-project-builder-tutorial`) exercises: a bill of materials
whose lines can be Labour and Plant as well as Material, and live
projects scheduled from those lines. Retail and Manufacturing use the
same bill of materials with Material lines only.

## Recipe: a bill of materials with Labour and Plant lines

`stageBomComponent` (`backend/src/db.ts`) takes:

```ts
export interface BomComponentInput {
  assemblyItem: string;
  business: string;
  componentItem: string; // a component Item (Material), or a resource name (Labour: employee/contractor; Plant: a Plant item)
  quantity: number;
  unit: string;
  kind?: BomLineKind; // 'Material' | 'Labour' | 'Plant' — default 'Material'
  durationHours?: number;
  scheduledStart?: string;
  scheduledEnd?: string;
  priceMinor?: number; // the line's quoted price
}
```

`postBomComponents` writes each field that is present as an attribute
of the line (`Entity.setAttr`), and `getBomComponents` reads them back.
A Material line sets none of `kind`, `durationHours`, `scheduledStart`
or `priceMinor`. A Labour line's `componentItem` names an employee or
contractor, and a Plant line's names a Plant item; neither is an item.
Staging the same `componentItem` again replaces its line.

`deleteBomComponent(assembly, component)` removes one line: it clears
the line's `BOM` tag and removes its `BOM — {component}` link.

Tests (*Testing: Unit*, "Running the tests"):
- "stageBomComponent/postBomComponents/getBomComponents: a real Bill of Materials, built on setEntityLink, per the wine-bar-assemblies-plan design" (`backend/test/db.test.ts`)
- "stageBomComponent/postBomComponents/getBomComponents: Recipe widening — Labour and Plant lines carry a real kind/duration/schedule, Material stays the default" (`backend/test/db.test.ts`)

## Plant: equipment with an hourly rate

`Plant` is a per-business root (`PER_BUSINESS_ROOTS`, `db.ts`), like
`Items` and `Locations`.

- `createPlantItem(name, business, hourlyRateMinor, ownedOrHired,
  userId, hireVendor?)`: `ownedOrHired` is `'Owned' | 'Hired'`;
  `hireVendor` applies to `'Hired'`.
- `getPlantItem(name)`, `listPlant(business)`.
- `clockPlantIn(plantName, projectExpenseAccount, business, ledger,
  userId)`, `clockPlantOut(plantName, business, ledger, userId)` and
  `getOpenPlantClock(plantName)` (`backend/src/db-journal.ts`) work as
  `clockInToProject` and `clockOutOfProject` do, with the Plant item's
  `Hourly Rate` in place of the employee's `wage_minor_per_hour`: a
  purchase order at clock-in, and its receipt (hours × rate) at
  clock-out.
- `call-dispatch/plant.ts` dispatches them, with a role check on every
  call that changes data.

Tests (*Testing: Unit*, "Running the tests"):
- "createPlantItem/getPlantItem/listPlant: a real, per-business Plant root, same shape as Items/Locations" (`backend/test/db.test.ts`)
- "clockPlantIn/clockPlantOut/getOpenPlantClock: Plant's own clock, a direct structural copy of the real Employee clock-in/out" (`backend/test/db.test.ts`)

### Clock entities and account names that contain " — "

An open clock is an entity named `Clocked In — <po reference> — <project
expense account> — <clocked-in-at>`. A project expense account
(`<project> — Labour & Plant`) contains " — " itself, so
`getOpenProjectClockEntity` takes the reference from the second part,
the time from the last, and joins everything between as the account
name.

Its test is listed in *The Journal API*, with the clock functions.

## Skill: a contact's skill, with a rate

`Skills` is one root under `Application`, made when first needed, since
a skill's name (`Electrical — Licensed`, `Framing`) means the same in
every business.

- `ensureSkill(name, userId)`, `listSkills()`.
- `tagSkill(contactName, skillName, rateMinorPerHour, userId)`,
  `untagSkill(contactName, skillName, userId)`, `getSkills(contactName)`:
  a `Skill` link from the contact to the skill (`setEntityLink`, as BOM
  links an assembly to a component), carrying the pair's `Rate`. One
  contact can have several skills, each at its own rate.
- `call-dispatch/plant.ts` dispatches them.

Nothing reads skills when scheduling: a Labour line names a contact,
and any contact can be booked on it.

Tests (*Testing: Unit*, "Running the tests"):
- "ensureSkill/listSkills/tagSkill/untagSkill/getSkills: a real, pairing-specific rate per contact+skill, on top of the same setEntityLink shape BOM already uses" (`backend/test/db.test.ts`)

## Project Proposal Prototypes: recipe templates

`Project Proposal Prototypes` is a per-business root
(`PER_BUSINESS_ROOTS`, `typeBusinessPrototypeRootName`) of named
templates (`Small Dwelling`, `Medium Dwelling`, …),
`backend/src/db-prototypes.ts`. A prototype's lines are bill-of-materials
lines staged under the prototype's entity. (Unrelated to
`defineProductShape`/`ensureProductInstance` in `db.ts`.)

- `createPrototype(name, business, userId)`, `listPrototypes(business)`.
- `addPrototypeLine(prototypeName, business, kind, resourceOrItemName,
  quantity, unit, priceMinor, userId, durationHours?, scheduledStart?)`
  and `getPrototypeLines(prototypeName)` call `stageBomComponent`,
  `postBomComponents` and `getBomComponents`.
- `instantiateProjectProposal(prototypeName, reference, client,
  business, ledger, headerItem, transdate, userId,
  targetCompletionDate?)` creates a quotation (`createQuotation`) for
  one `headerItem` at the sum of the lines' `priceMinor`, and copies
  every line onto it, `scheduledStart` included. Two proposals from one
  prototype therefore ask for the same resources on the same dates
  unless a line is changed with `addQuotationLine`; the tutorial relies
  on this for its double-booking.
- `updatePrototypeLine(prototypeName, business, resourceOrItemName,
  userId, newDurationHours?, newPriceMinor?)` changes one line of the
  prototype. Quotations made from it before keep their copies. Nothing
  calls it automatically.
- `call-dispatch/prototypes.ts` dispatches them.

Tests (*Testing: Unit*, "Running the tests"):
- "Project Proposal Prototypes: a reusable library instantiated into a real Quotation, refined via updatePrototypeLine — which only ever changes FUTURE instantiations, never a past, already-copied one" (`backend/test/db.test.ts`)

## A quotation with recipe lines is a Project Proposal

- `addQuotationLine(reference, kind, resourceOrItemName, quantity,
  unit, priceMinor, userId, durationHours?, scheduledStart?)` and
  `getQuotationLines(reference)` stage and read bill-of-materials lines
  under the quotation's entity. A quotation or RFQ without lines is
  unchanged.
- `acceptQuotation(reference, userId, projectDetails?)` sets the status
  to `accepted`. When the quotation has lines and `projectDetails`
  (`{ projectName, targetCompletionDate }`) is given, it also:
  1. creates a Live Project named `projectName` (not the quotation's
     reference: the two are different entities of one business);
  2. creates an `Invoicing` milestone due on `targetCompletionDate`;
  3. calls `provisionProjectProfitCenter` (below);
  4. copies the lines onto the project, then runs
     `scheduleProjectRecipeLines` and `checkMilestoneAchievability`.

Tests (*Testing: Unit*, "Running the tests"):
- "addQuotationLine/getQuotationLines: a Quotation widened into a real, multi-line Project Proposal — Material/Labour/Plant lines all round-trip through the exact same Stage-1 BOM mechanism, staged under the quotation's own reference, not an assembly item" (`backend/test/db.test.ts`)
- "acceptQuotation: accepting a multi-line Project Proposal with real projectDetails creates the real Live Project and an Invoicing Milestone, and schedules every Labour/Plant line — a plain, line-less Quotation (Retail's own shape) is completely unaffected" (`backend/test/db.test.ts`)

## Live Project and Milestone

`backend/src/db-projects.ts`. `Live Projects` is a per-business root
(`PER_BUSINESS_ROOTS`, `typeBusinessLiveProjectsRootName`). A Live
Project is an entity, unlike the account name that `clockInToProject`
calls a project (*Domain Concepts*, "Projects"), and unlike the
"Projects" Vocabulary label.

- `createLiveProject(name, business, client, requestedStart,
  targetCompletionDate, userId)` sets `Client`, `Requested Start` and
  `Target Completion Date`, and refuses a name the business already has.
- `getLiveProject(name)` returns `{ name, client, requestedStart,
  targetCompletionDate, scheduleRisk?, profitCenter?,
  projectExpenseAccount? }`; the last three are set by
  `checkMilestoneAchievability` and `provisionProjectProfitCenter`.
- `listLiveProjects(business)`.
- `createMilestone(projectName, milestoneType, dueDate, userId, label?)`:
  `milestoneType` is `'Plans Submission' | 'Inspection' | 'Invoicing'`.
  A milestone is a child of the project, with `Milestone Type`, `Due
  Date` and possibly `Schedule Risk`.
- `getMilestones(projectName)`.

Tests (*Testing: Unit*, "Running the tests"):
- "createLiveProject/getLiveProject/listLiveProjects: a real Project entity, distinct from the pre-existing "Projects" Vocabulary label and from clockInToProject's own account-name-only "project"" (`backend/test/db.test.ts`)
- "createMilestone/getMilestones: real construction-stage gates, Plans Submission/Inspection/Invoicing" (`backend/test/db.test.ts`)

## Scheduling: a conflict moves the booking later, never refuses it

```ts
export function findNextAvailableWindow(
  resourceName: string,
  business: BusinessName,
  desiredStart: string,
  durationDays: number,
  excludeProject?: string
): ScheduleResolution; // { start, end, pushedOut, conflictingProject? }
```

- `getResourceBookings(resourceName, business, excludeProject?)`: every
  scheduled Labour and Plant line naming the resource, in every project
  of the business but `excludeProject`, so a project never conflicts
  with itself.
- `findNextAvailableWindow` starts at `desiredStart` and, while the
  window overlaps a booking (`start < other end && other start < end`,
  the test `setEmployeeSchedule` applies to shifts), moves it to the
  end of that booking. It always returns a window.
- `scheduleProjectRecipeLines(projectName, business, userId)` passes
  each Labour and Plant line (not Material) through
  `findNextAvailableWindow`, stages the line again with its resolved
  `scheduledStart` and `scheduledEnd`, and returns each line with
  whether it was moved and by which project.
- `checkMilestoneAchievability(projectName, userId)` takes the latest
  `scheduledEnd` as the completion date. When that is after the
  project's `Target Completion Date`, it sets `Schedule Risk` on the
  project and on its `Invoicing` milestone (or its last milestone). The
  project stays scheduled. It never clears a risk set before
  (`Entity.clearAttr` does).

`acceptQuotation` with `projectDetails` is the caller of both.

Tests (*Testing: Unit*, "Running the tests"):
- "findNextAvailableWindow/scheduleProjectRecipeLines/checkMilestoneAchievability: a real Plant double-booking across two live Projects is auto-rescheduled into the future, never blocked, and warns only when a Milestone becomes unachievable" (`backend/test/db.test.ts`)

## A project's cost against its price

`provisionProjectProfitCenter(projectName, business, userId)`, called by
`acceptQuotation` and dispatched by `call-dispatch/projects.ts`:

1. `createProfitCenter(business, "<project> — Profit Center", userId)`;
2. `resolvePostingRoot('Expense', userId, business, profitCenterName)`,
   then `Entity.ensureUnder("<project> — Labour & Plant", …)`: an
   Expense account under that profit center's Expense group;
3. sets the project's `Profit Center` and `Project Expense Account`.

`clockInToProject` and `clockPlantIn` take that account as their
`projectExpenseAccount`. `getProjectCostReport(projectName)` returns
`{ projectName, quotedTotalMinor, actualCostMinor, marginMinor }`: the
sum of the lines' `priceMinor`, the account's balance
(`getAccountBalanceMinor`, `db.ts`: the stored balance, or 0 for an
account never posted to, taken as a positive number), and the
difference. Material lines are bought through purchase orders into
Inventory, so their cost is not in it.

Tests (*Testing: Unit*, "Running the tests"):
- "provisionProjectProfitCenter/getProjectCostReport: a real Project's own Profit Center isolates its real labour/plant cost from every other business activity, compared against the Recipe lines' own quoted price" (`backend/test/db.test.ts`)

## Not implemented

- Tiered prices (Standard, Express, Opportunity).
- Checking a Labour line's contact against its skills.
- Material cost in a project's profit center.
- A simulation with fixed expected figures: the full tier checks
  computed invariants (*Testing: The Test-Runner*, "Full / volume — the Project Builder cycle simulation").
- A Gantt chart or task dependencies (*Domain Concepts*, "Gantt charts").
