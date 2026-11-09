
# Chapter 5 — A Third Business: Project Builder

Chapters 3 and 4 showed two kinds of business that sell a finished
thing — bottles of wine, window and door frames. This chapter shows a
third kind: a dwelling-construction business that sells a whole
*project*, built up out of labour and hired equipment as well as
materials, scheduled against real dates a client cares about, and
costed against a dedicated budget for that one job. It also shows what
happens when two such projects compete for the same crew and the same
excavator at the same time — a real, everyday business problem, and
the whole reason this chapter exists.

## Setting up the business

We create "Tutorial Dwelling Construction" the same way Chapters 3 and
4 created their own businesses. One storage location, "Site Store",
holds the materials bought in for a job. Two clients — "Oak St Family
Trust" and "Riverside Developments" — will each commission a dwelling.

## Plant and Skills

Two new kinds of resource exist here that neither Retail nor
Manufacturing needed:

- **Plant** — real, named equipment the business owns or hires, each
  with its own hourly rate: a 20-tonne excavator, a tower crane, and a
  set of scaffolding.
- **Skills** — a tagged capability on a real person, each carrying its
  own hourly rate for that person: Site Management, Electrical —
  Licensed, Framing, and General Labour, tagged onto three real
  employees (Jordan Smith, Casey Brown, Morgan Lee) at their own
  individual wage rates.

Both are set up once and then reused across however many projects the
business takes on.

## The Prototype library

Rather than design every new dwelling's own labour, plant, and
material requirements from scratch, the business keeps a small library
of **Project Proposal Prototypes** — reusable templates for a Small,
Medium, and Large Dwelling, each recording a standard recipe of
material, labour, and plant lines (what's needed, how long it takes,
what it costs) refined from real projects the business has already
built. A new client quote starts from whichever prototype fits, not a
blank page.

## Two clients, the same template, overlapping dates

"123 Oak St" and "456 River Road" are both quoted from the exact same
Medium Dwelling prototype — same crew, same excavator, same tower
crane, same standard duration. Project A (123 Oak St) is instantiated
and accepted first, with no other work competing for those resources
yet, so it is scheduled exactly as requested and comfortably finishes
within its client's wanted date.

Project B (456 River Road) is instantiated from the same prototype
with dates that genuinely collide with Project A's already-booked
excavator and licensed electrician — and with a noticeably tighter
client-wanted completion date on top of that. Accepting Project B
never fails and never blocks: the scheduling engine simply looks at
what Project A has already booked, and pushes Project B's own
conflicting labour and plant lines into the next real, available
window after that conflict clears. That is the one, deliberate rule
behind all of this: a double-booking is always resolved into the
future, never refused.

The real consequence shows up on Project B, not Project A: with its
excavator and electrician time pushed out, Project B's completion date
now lands *after* what its own client wanted. The business sees this
as a real, computed **Schedule Risk** on the project and its Invoicing
Milestone — a plain warning, not a failure, and not something anyone
had to notice by eye. Project A, never touched by any conflict, carries
no such risk.

## Running the jobs

Both projects get a dedicated Profit Center of their own the moment
they're accepted — a clean, separate ledger of exactly what each job
costs, never mixed with the other. Materials are bought and received
into Site Store; an employee and a piece of plant each clock in and
out against their own project, posting real labour and plant cost
straight to that project's own account.

## Quoted price versus real cost

At the end of the job, each project's own cost report compares what it
was quoted against what it actually cost to deliver. Project A, which
ran to its original plan, comes in with a healthy, positive margin.
Project B — the one whose schedule was pushed out by the double-
booking — comes in over budget, with a **negative** margin. This is
the real, computed evidence behind the business case: an occasional
real resource clash like this one is now a measurable cost, not just a
feeling, and it's the kind of number that argues for hiring a second
crew or buying a second excavator rather than running every job through
one.

## A lesson fed back into the library

Having seen the real cost of the Medium Dwelling prototype's own tower
crane line run longer (and pricier) than the template assumed, the
business owner makes one deliberate, explicit change: `Update Prototype
Line` revises the Medium Dwelling template's tower crane duration and
price for every *future* quote built from it. This is a human decision,
made once, on purpose — nothing in this application watches a
project's own profitability and silently rewrites a prototype on its
own. Projects already quoted and accepted keep exactly the lines they
were quoted with; only the next dwelling built from this template
starts from the corrected figures.

## Running it yourself

```
make test-e2e-project-builder-tutorial          # fast — no browser
make test-e2e-project-builder-tutorial-browser  # the same tutorial, through a real browser
```

And, for a heavier, repeated proof — the same overlapping-project-pair
cycle run three times in a row against one fresh database, each cycle
on its own, non-overlapping dates, checked by real, computed rules
(every Profit Center's own totals reconcile to its own project's
postings only, a Schedule Risk is raised exactly where a real
double-booking was engineered and nowhere else, every accepted project
has its own real Invoicing Milestone, and the business as a whole stays
profitable) rather than one fixed, hardcoded number:

```
make test-e2e-project-builder-full
```
