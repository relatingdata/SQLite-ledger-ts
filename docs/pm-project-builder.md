
# Recipe, Plant, Skill, Prototype, Live Project, Milestone, and the scheduling/contention engine

This chapter documents the mechanism behind the Project Builder
tutorial (`docs/user-manual-ch5-project-builder-tutorial.md`,
`make test-e2e-project-builder-tutorial`). It generalizes the widened,
Stage-1 Bill of Materials mechanism (`docs/pm-domain-reference.md`'s
own BOM section) from a Material-only manufacturing recipe into a
"Recipe" that can also carry Labour (an employee or external
contractor's own time) and Plant (hired or owned equipment's own
time), then builds a real Project/Milestone/scheduling layer on top of
it — all additive, with zero change to Retail's or Manufacturing's own
BOM usage.

## Recipe — BOM widened, not replaced

`stageBomComponent`'s input (`backend/src/db.ts`) gained four optional
fields, all defaulting to the Material-only shape every pre-existing
caller already used:

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
  priceMinor?: number; // the per-line quoted/costed price
}
```

`postBomComponents`/`getBomComponents` write and read these the same,
additive way Quantity/Unit already were — one more `Entity.setAttr`
per field, only when present. A Material line (Manufacturing's own
usage, `docs/user-manual-ch4-manufacturing-tutorial.md`) never sets
`kind`/`durationHours`/`scheduledStart`/`priceMinor` and is completely
unaffected. A Labour or Plant line's own `componentItem` is not a real
Item at all — it is the name of the real employee/contractor (Labour)
or Plant item (Plant) the line books time against.

## Plant — hired/owned equipment as a clockable resource

A new, per-business root, `Plant` (`PER_BUSINESS_ROOTS`, `db.ts`), same
shape as `Items`/`Locations`.

- `createPlantItem(name, business, hourlyRateMinor, ownedOrHired,
  userId, hireVendor?)` — `ownedOrHired` is `'Owned' | 'Hired'`;
  `hireVendor` is only meaningful for `'Hired'`.
- `getPlantItem(name)` / `listPlant(business)`.
- `clockPlantIn(plantName, projectExpenseAccount, business, ledger,
  userId)` / `clockPlantOut(plantName, business, ledger, userId)` /
  `getOpenPlantClock(plantName)` (`backend/src/db-journal.ts`) — a
  direct structural copy of `clockInToProject`/`clockOutOfProject`,
  substituting the Plant item's own `Hourly Rate` for an employee's own
  `wage_minor_per_hour`. Posts a real Purchase Order at clock-in and a
  real receipt (hours × hourly rate) at clock-out, exactly like the
  employee version.
- `call-dispatch/plant.ts` exposes all of the above, role-gated like
  every other mutating call in this rollout.

## Skill — a named taxonomy tagged onto a contact with a real rate

A lazy, idempotent, global `Skills` root (same idiom as
`db-quotations.ts`'s own `ensureQuotationsRoot`) under the
`Application` root — not per-business, since the same skill name
(`Electrical — Licensed`, `Framing`, ...) is meaningful across every
business.

- `ensureSkill(name, userId)` / `listSkills()`.
- `tagSkill(contactName, skillName, rateMinorPerHour, userId)` /
  `untagSkill(contactName, skillName, userId)` / `getSkills(contactName)`
  — Shape B (`setEntityLink`) + Shape A (`Entity.setAttr`) composed
  exactly the way BOM already does for its own assembly→component link,
  just tagged `'Skill'` instead of `'BOM'`, carrying a real, pairing-
  specific `Rate` (one contact can be tagged with several skills, each
  at its own rate — a licensed electrician and a general labourer are
  not paid the same for the same hour).
- `call-dispatch/plant.ts` exposes `ensureSkill`/`listSkills`/
  `tagSkill`/`untagSkill`/`getSkills` alongside Plant's own entries.

Tagging a skill is currently informational/reporting-facing — nothing
in the scheduling engine below reads a Recipe line's resource name back
against its tagged skills to validate that, say, only a
`Electrical — Licensed`-tagged contact can be booked on an
`Electrical — Licensed` line. A Recipe's Labour line names a real
contact directly; enforcing a skill match is explicitly out of this
round's scope.

## Project Proposal Prototypes — a reusable library of Recipe templates

A new per-business root, `Project Proposal Prototypes`
(`PER_BUSINESS_ROOTS`, `typeBusinessPrototypeRootName`), holding named
templates (`Small Dwelling`/`Medium Dwelling`/`Large Dwelling`, ...) —
`backend/src/db-prototypes.ts`. Named after, but not implemented with,
this app's own existing product prototype/instance vocabulary
(`defineProductShape`/`ensureProductInstance`, `db.ts`) — same naming
spirit only; a Prototype reuses Recipe's own BOM mechanism verbatim,
staged under the prototype's own entity instead of an assembly item.

- `createPrototype(name, business, userId)` / `listPrototypes(business)`.
- `addPrototypeLine(prototypeName, business, kind, resourceOrItemName,
  quantity, unit, priceMinor, userId, durationHours?, scheduledStart?)`
  / `getPrototypeLines(prototypeName)` — a direct call-through to
  `stageBomComponent`/`postBomComponents`/`getBomComponents`.
- `instantiateProjectProposal(prototypeName, reference, client,
  business, ledger, headerItem, transdate, userId,
  targetCompletionDate?)` — creates a brand-new, ordinary Quotation
  (`createQuotation`, unmodified) under a real, required header Item
  (`headerItem` — the overall job's own line-item identity on the
  ledger; the real commitment detail lives in the copied Recipe lines,
  quoted at 1 × the sum of every line's own `priceMinor`), then copies
  every one of the prototype's own lines onto it — including each
  line's own `scheduledStart`, copied verbatim. Two proposals
  instantiated from the same prototype therefore ask for the exact same
  resources on the exact same dates unless a caller edits the copy
  afterward with `addQuotationLine` — this is deliberate: it is exactly
  how the tutorial engineers a real, reproducible double-booking
  without hand-crafting one.
- `updatePrototypeLine(prototypeName, business, resourceOrItemName,
  userId, newDurationHours?, newPriceMinor?)` — a bounded, explicit,
  human-driven revision of one named line. Per direct instruction, this
  is never automatic learning from project profitability: nothing here
  reads a completed project's own real margin and decides to call this
  on its own. It only ever changes *future* instantiations; any
  Quotation already instantiated and accepted keeps its own, already-
  copied lines untouched.
- `call-dispatch/prototypes.ts` exposes all of the above.

## Quotation widened into a multi-line Project Proposal

`db-quotations.ts`'s own, deliberately real "no new SQL table, no
JSON, no raw SQL UPDATE" constraint (see its own header comment) meant
the only way to attach genuine, multi-line detail to a Quotation was to
reuse an existing mechanism, not invent a second one:

- `addQuotationLine(reference, kind, resourceOrItemName, quantity,
  unit, priceMinor, userId, durationHours?, scheduledStart?)` /
  `getQuotationLines(reference)` — attaches a Recipe-shaped child line
  directly under the Quotation's own existing entity, via the exact
  same `stageBomComponent`/`postBomComponents`/`getBomComponents` calls
  BOM and Prototype lines both use, parameterized by the quotation's
  own `reference` instead of an assembly item. A plain, line-less
  Quotation/RFQ (every Retail caller) never calls this and is
  completely unaffected.
- `acceptQuotation(reference, userId, projectDetails?)` — additively
  widened. When the Quotation carries real Recipe lines **and** the
  caller opts in with `projectDetails: { projectName, targetCompletionDate
  }`, accepting also:
  1. Creates the real Live Project (`createLiveProject`, below) under
     its OWN name — deliberately never reusing the Quotation's own
     `reference` for this, since a Live Project and its originating
     Quotation are two separate, same-business entities and sharing one
     bare name between them would be exactly the kind of unscoped-
     resolution collision `typeBusinessLiveProjectsRootName`'s own
     comment warns against.
  2. Creates an `Invoicing` Milestone due on `targetCompletionDate`.
  3. Provisions a dedicated Profit Center + Expense account
     (`provisionProjectProfitCenter`, Stage 5, below).
  4. Copies every Recipe line onto the Live Project and runs
     `scheduleProjectRecipeLines`/`checkMilestoneAchievability` (below)
     for its real, as-accepted schedule.
  A caller that omits `projectDetails`, or a plain, line-less
  Quotation/RFQ, triggers none of this — purely the original status
  flip every pre-existing caller already relies on.

## Live Project and Milestone

`backend/src/db-projects.ts`. A new per-business root, `Live Projects`
(`PER_BUSINESS_ROOTS`, `typeBusinessLiveProjectsRootName`) — a real
entity, genuinely distinct from both the pre-existing, account-name-
only "project" `clockInToProject` already took (`docs/pm-domain-
concepts.md`'s "Projects" section) and the pre-existing "Projects"
Vocabulary label.

- `createLiveProject(name, business, client, requestedStart,
  targetCompletionDate, userId)` — sets `Client`/`Requested Start`/
  `Target Completion Date` attributes.
- `getLiveProject(name)` returns `{ name, client, requestedStart,
  targetCompletionDate, scheduleRisk?, profitCenter?,
  projectExpenseAccount? }` — the latter three are undefined until
  `provisionProjectProfitCenter`/`checkMilestoneAchievability` actually
  run.
- `listLiveProjects(business)`.
- `createMilestone(projectName, milestoneType, dueDate, userId, label?)`
  — `milestoneType` is `'Plans Submission' | 'Inspection' | 'Invoicing'`;
  a Milestone is a real child entity of the Project, carrying its own
  `Milestone Type`/`Due Date`/possible `Schedule Risk`.
- `getMilestones(projectName)`.

## The scheduling/contention engine — auto-reschedule into the future, never block

The real overlap idiom this whole engine generalizes already existed,
for a different purpose: `setEmployeeSchedule`'s own
`s.starts_at < other.ends_at && other.starts_at < s.ends_at`
(`db.ts`) checks whether one employee's two shifts, on the same day,
overlap. `findNextAvailableWindow` is the exact same inequality, lifted
from time-of-day ranges to date ranges, and from "this employee's other
shift" to "this resource's Labour/Plant commitments across every OTHER
live Project in the business":

```ts
export function findNextAvailableWindow(
  resourceName: string,
  business: BusinessName,
  desiredStart: string,
  durationDays: number,
  excludeProject?: string
): ScheduleResolution; // { start, end, pushedOut, conflictingProject? }
```

- `getResourceBookings(resourceName, business, excludeProject?)` — every
  real, currently-scheduled Labour/Plant line for a named resource,
  across every project in the business except `excludeProject` (so a
  project's own, not-yet-finalized lines never conflict with
  themselves).
- `findNextAvailableWindow` scans forward from `desiredStart`, jumping
  straight to the end of whichever booking it hits (not a blind day-by-
  day loop), until it finds a genuinely clear window. **It never
  refuses or blocks** — per direct, repeated instruction, a real
  conflict always resolves by moving the window into the future, never
  by failing the request.
- `scheduleProjectRecipeLines(projectName, business, userId)` runs every
  real Labour/Plant line (Material lines are left untouched) through
  `findNextAvailableWindow`, re-stages each one's real, resolved
  `scheduledStart`/`scheduledEnd` via the same `stageBomComponent` call
  that set it in the first place (a re-stage of the same
  `componentItem` replaces its line in place — the same idiom BOM
  already uses for a revised quantity), and returns every resolved
  line, including whether and by which other project it was pushed out.
- `checkMilestoneAchievability(projectName, userId)` walks the
  project's own resolved lines, takes the latest `scheduledEnd` as the
  real completion date, and — **only if that date now falls after the
  project's own `Target Completion Date`** — sets a real, human-
  readable `Schedule Risk` message on both the Project and its
  `Invoicing` Milestone (or its last Milestone, if none is typed
  `Invoicing`). This is a warning, never a block: the project is still
  fully, genuinely scheduled; the business simply now has a real,
  computed fact that a client's wanted date will be missed, and why.
  Clearing a prior risk is left to the caller (`Entity.clearAttr`) —
  re-running this never needs to "undo" anything, since a project whose
  lines now all resolve on time simply never has the attribute set.

`acceptQuotation`'s own `projectDetails` path (above) is the one real,
current caller of `scheduleProjectRecipeLines`/
`checkMilestoneAchievability` — accepting a Project Proposal always
schedules it for real, against whatever every other already-accepted
Live Project in the business is holding.

## Stage 5 — per-project cost-vs-price tracking via Profit Centers

`provisionProjectProfitCenter(projectName, business, userId)` — called
automatically by `acceptQuotation`'s `projectDetails` path, and exposed
directly (`call-dispatch/projects.ts`) for a Live Project created some
other way:

1. `createProfitCenter(business, \`${projectName} — Profit Center\`,
   userId)` — the existing, unmodified Profit Center mechanism, zero
   new reporting logic.
2. `resolvePostingRoot('Expense', userId, business, profitCenterName)`
   + `Entity.ensureUnder(\`${projectName} — Labour & Plant\`,
   expenseGroup.id, userId)` — a real, dedicated Expense account,
   properly classified under that Profit Center's own Expense group via
   the SAME, already-proven mechanism every other Profit-Center-scoped
   posting (Sales/COGS/Inventory) already uses.
3. Both names are written back onto the Project as its own
   `Profit Center`/`Project Expense Account` attributes
   (`getLiveProject`'s own `profitCenter`/`projectExpenseAccount`
   fields).

`clockInToProject`/`clockPlantIn` take that real `projectExpenseAccount`
name directly — zero change to either function's own signature; a
Live Project's own expense account is simply the kind of account name
they already accepted. `getProjectCostReport(projectName)` compares the
real, live balance of that account (the project's actual labour+plant
cost) against the sum of every Recipe line's own `priceMinor` (the
quoted total), returning `{ quotedTotalMinor, actualCostMinor,
marginMinor }`. Material-line cost is deliberately **not** included —
Recipe Material lines flow through the ordinary, pre-existing PO/
receipt/Inventory path, not yet routed through a project's own Profit
Center; left for a future round, per this plan's own stated scope.

### A real bug found and fixed while building this: project expense account names containing " — "

`provisionProjectProfitCenter`'s own expense-account naming convention
(`\`${projectName} — Labour & Plant\``) genuinely contains the same
`" — "` separator a clock entity's own name uses to encode its three
fields (`Clocked In — <po reference> — <project expense account> —
<clocked-in-at>`, `db-journal.ts`). `getOpenProjectClockEntity`'s
original parsing did a naive, fixed 4-way `split(' — ')`, which
silently misparsed the account name once it carried its own `" — "` —
`clockedInAt` ended up as a fragment of the account's own name (not a
real date), producing `NaN` hours worked and a `NOT NULL` constraint
failure on the resulting stock receipt the moment the Project Builder
tutorial's own `clockOutOfProject`/`clockPlantOut` steps first tried a
real project-scoped account name. Fixed by splitting from both ends
(`poReference` is always the second segment; `clockedInAt` is always
the last; everything in between, rejoined with `" — "`, is the real
account name) — correct for any account name, not just ones with zero
em dashes of their own. A new, permanent unit test
(`backend/test/db.test.ts`, "a real project expense account whose own
name contains..."`) locks this in by exercising the real `provisionProjectProfitCenter`-produced
account name directly, for both the Employee and Plant clock paths.

## Testing

See `docs/pm-testing-e2e.md`'s own "Project Builder tutorial" section
for the tutorial fixture, the three new `make` targets, and the "full"
tier's computed invariants.

## Deliberately deferred, not part of this round

- Tiered Pricing (Standard/Express/Opportunity price points).
- A skill-match check between a Recipe Labour line's own resource name
  and that contact's tagged Skills.
- Routing Recipe Material-line cost through a project's own Profit
  Center (currently Material flows through the ordinary PO/receipt
  path, untracked against the project).
- A bespoke, Retail-style golden-figure volume simulation for Project
  Builder (the "full" tier uses computed invariants instead, per the
  user's own "lighter now" answer).
- Any Gantt-style timeline or task-dependency UI (see
  `docs/pm-domain-concepts.md`'s own "Gantt charts" section).
