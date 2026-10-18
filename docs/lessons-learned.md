## Lessons learned along the way — explorations without a paddle, and discovery of the outboard

The rest of this manual describes the system as it stands today —
what it does, not the path taken to get there. This appendix is the
opposite, deliberately: a direct, honest record of the real mistakes,
dead ends, and mid-course discoveries from building the scoped-
uniqueness and location-accounting work, kept separate so the main
manual stays a clean description of the current state, not a diary.

### The $8 that wasn't a bug

Moving entity-name uniqueness from global to scoped changed SQLite's
own internal row-scan order for a query with no explicit `ORDER BY`,
shifting which purchase lot got averaged first for weighted-average
inventory costing in the existing simulation. The full simulation's
own expected total shifted by $8. Rather than assume this was harmless
or, worse, assume it was a bug and chase it, it was traced precisely —
diffing full simulation output, then the two resulting databases
account by account — before concluding it was a real, explainable,
harmless variance (the books remained genuinely balanced; every other
figure was unchanged) and updating the test's own expected baseline
to match.

### The gap that turned out to be the wrong gap

An early pass concluded that AR Sale and AP Purchase couldn't
genuinely carry a location without a larger redesign — adding real
product/location line items to screens that don't have any line-item
detail at all. That conclusion was wrong, and a direct correction
resolved it in a much smaller way than the original analysis
suggested: location is per-invoice, not per-line. Both screens
already had exactly one header-level field for their counterparty; location
needed the exact same treatment, not a line-item redesign. Worth
recording because the first, more cautious answer sounded reasonable
and still would have led to over-building something much bigger than
was actually needed.

### The prefix that looked cosmetic and wasn't

Removing the redundant "Sales - "/"COGS - " text prefix from account
names looked like a pure cosmetic cleanup — the account's own real
parent (Sales Revenue, Cost of Goods Sold) already conveyed what the
prefix was repeating. It was not cosmetic. A product and its own
Sales/COGS/Inventory accounts now genuinely, deliberately share a
name (scoped uniqueness correctly allows this at different levels),
and the codebase resolved accounts by bare name in far more places
than a first, careful-looking audit found.

**The real, honest shape of this exploration**, not smoothed over:

1. **First attempt**: removed the prefix, ran the test suite, watched
   it pass, and was about to consider the change complete. A separate,
   direct debug script — checking that a real sale's revenue actually
   reached the P&L, not just that tests were green — caught the sale
   silently vanishing. A product and its own Sales account, now
   sharing a name, resolved to the wrong entity. Reverted cleanly
   rather than shipped.
2. **Second attempt**: built the real, structural fix — `account_id`
   on the staging tables, preferred over the ambiguous name lookup.
   `make test` still failed, repeatedly, as each fix revealed a
   further, independent case of the identical bug in a part of the
   codebase the first fix hadn't touched: entity creation, then a
   second, completely separate SQL trigger for quantity movements,
   found only by tracing a nonsensical negative quantity back to its
   root cause live, not by inspection.
3. **Third attempt**: got the unit test suite to 187/187 — and this
   is the part worth remembering most: passing the full unit test
   suite still did not mean the system was correct. Running the
   actual, full, live simulation surfaced two further, real,
   independent bugs the unit tests never touched at all — a
   primary-key collision in the staging table itself (two different,
   real entities sharing a name were silently overwriting each
   other's postings via `ON CONFLICT`), and a live-only regression in
   Sales Report category counting (14 real categories silently
   collapsing to 9). Neither was caught by any unit test; both were
   only found by running the real simulation end to end and checking
   its own documented expected figures line by line.

**The real, actionable lesson**: for a change that redefines what
"the same name" is allowed to mean, `make test` passing is necessary
but nowhere close to sufficient. The full, live simulation — and
checking its own real, specific, numeric expected results, not just
"did it complete without throwing" — is where most of the real bugs
in this exploration were actually found. Budget for that step as
required, not optional, whenever a change touches identity or
uniqueness assumptions this broadly.

### The rename that looked simple and needed two real fixes to get right

`entities.relation_id` was originally called `sibling_id` — a real,
fair objection was raised: "sibling" implies a tree-peer relationship
(two nodes under the same parent), which this column never actually
had. What it actually stores is a lateral pointer for classification
tags and typed relationships between otherwise-independent entities —
neither of those is a "sibling" relationship in any real sense.
Renamed throughout: the real database column, every view and trigger
referencing it, every backend function and TypeScript interface, the
frontend API, the Structured Editor UI, and even the vocabulary word's
own old translations (German "Geschwister", French "Frère" — the
*familial* sense of sibling, wrong for the new meaning, replaced with
real translations for "relation" instead).

A real migration — checked directly against the source: it is an
inline, unnamed migration block in `backend/src/db.ts` (around line
225, comment "Migration renaming entities.sibling_id ->
entities.relation_id"), not a standalone function called
`migrateForRelationRename` (no such name exists anywhere in the
codebase; every real `migrateForXxx` function in `db-seed.ts` was
checked, and none matches) — was tested directly
against the actual pre-rename schema, not assumed to work, and caught
two real bugs before shipping:

1. SQLite's own `ALTER TABLE ... RENAME COLUMN` rewrites views that
   reference the renamed column *directly*, but does not reliably
   propagate through a two-level view chain, and fails outright when
   several dependent views need rewriting at once.
2. Manually enumerating "every dependent view" by hand missed a real
   one (`entity_delete`) on the first two attempts — it doesn't even
   reference `relation_id` itself, but still depends on
   `current_entities` existing.

The fix that actually worked: capture every view and trigger's real
SQL definition from `sqlite_master` in their original creation order
(which already respects dependencies, since `schema.sql` had to
create them in a working order the first time), drop all of them,
rename the real column, then recreate every one from its saved text
with the old name substituted for the new — not a hand-maintained
list of "the views I think depend on this." Worth remembering: even a
rename that looks purely cosmetic can hide real, structural
dependencies a manual list will miss.

### The audit that found real severity levels, not just a checklist

A full, direct audit of every bare-name lookup in the codebase (27
backend SQL lookups, 6 more in-memory JS comparisons, 31 frontend
cases) confirmed two things worth remembering as a general pattern,
not just about this one bug: first, a codebase-wide risk audit is
worth doing *before* declaring a class of bug fixed, not just after —
several of the collisions found and fixed during the resolution work
above were exactly the "high risk" category the audit had already,
separately, flagged as most likely to bite. Second, most bare-name
lookups in a real, mature codebase are genuinely low-risk (structurally
singular anchors no one would plausibly duplicate) — the value of the
audit was in finding the small number that weren't, not in treating
every instance as equally urgent.

### The branded-type sweep: a clean compile is not the same thing as a complete one

Per direct, explicit, non-negotiable instruction: every entity-derived
string parameter across the entire system needed its own real, branded
type — not just `BusinessName`/`LedgerName`, but `AccountName`,
`DivisionName`, `LocationName`, `EmployeeName`, `CustomerName`,
`VendorName`, `PartName` too. The honest, real shape of doing this
thoroughly, across four separate passes, each verified compile-clean
before starting the next:

1. **The first pass looked complete the moment `tsc --noEmit` returned
   zero errors** — and it genuinely was complete, for the specific
   functions touched (`StagedLine`, the AR/AP pair, `PosSaleInput`).
   But "zero errors for what I've touched so far" is not the same
   claim as "zero remaining plain-string business/ledger parameters
   anywhere in the system" — the second, much stronger claim, was only
   true after three more passes.
2. **Each pass widening a function's own signature revealed further,
   real callers the previous pass hadn't reached** — widening
   `postJournalEntry` (wave 2) cascaded into functions that themselves
   still took plain strings, which cascaded further when *those* were
   widened, and so on through waves 3 and 4. A clean compile after
   wave 2 said nothing real about wave 3's own scope; it only said
   wave 2 was internally consistent with itself.
3. **A real, genuine mistake made along the way, not glossed over**:
   after widening `db-stock.ts`'s own functions to use the new types,
   the compile-error count went *up*, not down — because the needed
   type imports (`BusinessName`, `LedgerName`, `AccountName`,
   `PartName`, `LocationName`) simply hadn't been added to that file's
   own import statement yet. An easy, honest, "Cannot find name"
   mistake, not a design flaw — but a real reminder that a rising
   error count mid-refactor needs direct investigation, not
   reflexively re-attempting the same fix.
4. **The only way to genuinely confirm completeness was an exhaustive,
   direct grep after the compile was clean** — `grep -rn "business:
   string, ledger: string"` across the entire backend, re-run after
   each fix, until it returned zero results twice in a row. This is
   what actually justified calling the sweep complete — not the clean
   compile alone, which only ever proves internal consistency among
   whatever has already been touched, never that nothing was missed.

### The bug the systematic sweep itself missed — a nested helper, not a top-level signature

The exhaustive grep confirming the branded-type sweep's completeness
(`grep -rn "business: string, ledger: string"`) was itself, genuinely,
insufficient — it only ever finds *function signatures*, not every
real, bare SQL lookup. Running the full, live simulation after the
sweep surfaced a real, serious, confirmed bug this exhaustive grep
never could have found: `getBalanceSheet`'s own internal
`sumDimensionDescendants` helper (a real, local, nested function, not
a top-level export) still resolved its own ledger by a bare,
unscoped name — invisible to a signature-level grep, since a nested
function's own internal SQL isn't a function signature at all. The
real, live consequence: the Balance Sheet's own fundamental
accounting equation stopped holding (`balanced: false`, off by
$139.74) the moment two real businesses genuinely shared the
identical "Actual" ledger name — exactly the kind of quiet,
non-throwing corruption a grep for a text pattern can never catch,
but a real, live simulation checking real, specific, numeric results
catches immediately. The real, actionable lesson, stated plainly: a
grep for a known text pattern proves that pattern is gone, nothing
more — it is not a substitute for exercising the real, live system
end to end.

### A real "hang" that was two, genuinely separate, small bugs — neither one where it first looked

A Playwright e2e tutorial script appeared to hang, intermittently and
at what looked like different points, across several real attempts —
the classic shape of "environmental flakiness." It genuinely wasn't.
Two real, separate, small, entirely deterministic bugs were hiding
behind that appearance, each found only once the debugging discipline
itself was tightened: **always reset the database (and restart the
backend process itself, not just the file on disk — better-sqlite3
holds its own open connection) to a known, fresh foundation before
trusting any diagnosis**, and instrument the exact, real step rather
than re-running the whole script and guessing from where it stopped.

**Bug one — a real, genuine CSS flexbox bug.** A "+ New category…"
form's own text input rendered at `width: 0`, invisible, though
present in the DOM (`count() === 1`, confirmed directly) — Playwright
correctly refused to `fill()` an element it couldn't see, and each
retry silently waited out its own timeout, which looked exactly like
a hang. Root cause, confirmed via direct `getComputedStyle`/
`getBoundingClientRect` inspection rather than guessed at: the
sibling `<select>` had no explicit flex sizing and claimed its own
natural content width first; the input's own `flex: 1` (shorthand for
`flex-basis: 0%`) meant it started from *zero* and only grows into
real space left over after every non-flexible sibling takes its own
share — space that, here, the select had already consumed entirely.
Confirmed the fix numerically (`width: 0` → `width: 538px`) before
trusting it, not by eye.

**Bug two — a real, genuine bug in the test script itself, not the
application.** `selectOption({ label: 'Cash and Bank' })` waited
indefinitely for an exact match that could never occur, because the
real, live option text includes an account-number prefix
(`"1000 — Cash and Bank"`) that the plain label never accounts for —
again indistinguishable, from the outside, from a genuine hang.
Playwright's own `label` matcher does not accept a regular expression
either (confirmed directly: `expected string, got object`); the real
fix was matching on the underlying `value` instead, which is the
plain name without the display-only prefix.

The real, actionable lesson: an intermittent-looking failure is not
evidence of an intermittent cause. Both of these were fully
deterministic, and reproduced identically, every time, once actually
isolated on a genuinely fresh foundation with the right instrument
attached — the appearance of flakiness came entirely from re-running
a long, multi-step script and guessing at which step failed, rather
than isolating the one, real, exact step and inspecting it directly.

### A real, genuine type distinction found mid-sweep: PartName is not AccountName

`writeOffStock`'s own call to `postQuantityMovement` was passing a
`PartName` where `AccountName` was now required — a real, genuine type
error, not a bug in the branding itself. A product's own name and its
### How 260 functions happened, and the real, direct correction that fixed it

A full audit (`docs/function-inventory.md`) found 260 separately-named,
exported backend functions — for a system whose entire, real,
foundational design is "everything is an entity," this is a genuine
failure, not a natural consequence of the app's own size. The real,
direct correction, stated plainly, is worth recording in full:

> "You are not using the principle that a child is only unique by
> name within one parent. You should not have functions that deal
> with a specific type — contacts are contacts first and foremost,
> then AP/AR/Employee/Manufacturer (as distinct from wholesaler/
> supplier/vendor), etc. (possibly more than one). The type of contact
> determines where the account(s) go in the current company's CoA,
> via a named relationship to the account(s) in the CoA, and others to
> the name, address details, phone details, etc. (assume user-
> expandable — web page, online order catalogue, email addresses).
> It should be the relationships — the classes (their own functions)
> that act on the instances — so there is one and only one way to do
> any particular thing with a phone number, name, address, quantity,
> currency amount, etc."

**How it actually arose, confirmed directly by reading the real
history**: almost every one of the 260 functions is one of five real
kinds of fact about an entity — its structural position, a named link
to another entity, a posted money/quantity balance, a contact detail,
or a hierarchy walk. Each new screen or feature this session got its
own new, specifically-named function (`getStockListing`,
`getBelowReorderStock`, `getPartLocation`, `ensureProductInventoryAccount`,
`ensureLocationScopedAccount`, and dozens more) instead of composing
the same, small, real set of primitives already available — the exact
opposite of the entity-only principle already established for data.
The direct, confirmed consequence: `part_location`'s own real "levels"
data was hand-rolled three separate times (a dedicated table, then
JSON-in-`accountnumber`, then finally correct) before landing on what
should have been the obvious, first answer — a real number is a real
account balance; a real string is a real link — because no shared
primitive existed yet to reach for.

**The real, new implementation** (`backend/src/primitives.ts`) is the
direct answer, organized by the object each primitive acts on, per
the design principle above:

- **`Entity`** — `create`/`get`/`getUnder`/`ensureUnder`/`rename`/
  `reparent`/`relate`/`delete`/`children`. `get` takes an optional
  `parent` argument specifically so every real lookup can be scoped —
  "a child is unique by name within one parent," never a bare, global
  `WHERE name = ?`.
- **`Link`** — `set`/`get`/`delete`/`mark`/`unmark`/`isMarked`/
  `withTarget`. One real shape for every named relationship this app
  has ever needed a one-off function for: a dimension parent, a
  contact type, a menu override, a CoA prototype tag, a route, a
  presence-only marker.
- **`Balance`** — `post`/`get`/`getScoped`. One real, append-only
  posting primitive for every money *or* quantity figure — the direct
  generalization of "buying price, selling price, and a unit
  conversion are all genuinely `$/unit` or `unit/unit` exchange
  rates," each with its own real audit trail, per the same, direct
  correction.
- **`Detail`** — `set`/`get`/`list`/`delete`. One real shape for any
  contact fact, genuinely open-ended (address, phone, email, a web
  page, an online order catalogue) — never a hardcoded, dedicated
  field added per new kind of detail.

**This is a real, ongoing, in-progress conversion, not a completed
migration** — existing functions are being rewired to compose these
primitives one at a time, each real conversion verified against the
full backend suite and the full e2e tutorial before moving to the
next, per direct instruction ("delete nothing," verify before
committing). Converted so far: `getPartLocation`,
`setPartLocationLevelDetails`, `ensureCategoryChain`,
`ensureProductInventoryAccount`, `ensureProductLocationInventoryAccount`,
`ensureLocationScopedAccount`, `getContactsWithType`. A real, direct
mistake caught mid-conversion, worth recording honestly: the first
attempt at converting `getContactsWithType` to `Link.withTarget`
assumed a fixed `linkType` of `'Contact Type'`; the real, actual
shipped.



### CoA-per-business, root-caused precisely on the second attempt

An earlier attempt to give every business its own real Chart of
Accounts instance (`instantiateChartOfAccounts`, called for every
existing business, not just brand-new ones) was reverted the same
session after a real, confirmed regression: BMW M GmbH's own real,
published 2020 HGB balance sheet — a figure this test suite already
proved reproduces exactly — silently went from $417,000 to $0.

The real, precise cause, found by direct investigation rather than
further guessing: `instantiateChartOfAccounts` "mirrors" each real,
universal, structural category (Asset/Liability/Equity/Income/
Expense) under a business's own new CoA instance, so a prototype-tagged
leaf account has somewhere real to nest. The mirror was created under
the exact, same, bare name as the original — `"Equity"` — meaning
multiple real `Equity` entities existed at once (confirmed directly:
7, after instantiating for every business — 1 global + 6 per-business
mirrors). Any other, real, existing code elsewhere in this
application that still resolves a bare category name globally (e.g.
a real test's own `createEntity({ name: ..., parent: 'Equity' })`)
could then resolve ambiguously to the wrong one, silently — exactly
what happened.

**The real, direct correction that applies here too**: "a child is
only unique by name within one parent." The fix was not to stop
mirroring structural categories (prototype-tagged leaves genuinely need
somewhere real to nest) but to give each real mirror its own
genuinely unique name — `` `${rootName} — ${category}` `` (e.g.
`"BMW M GmbH Chart of Accounts — Equity"`) — never the bare category
name a global lookup elsewhere could ever ambiguously match. The
mirror's own real display name for reports/UI is carried via
`relation_id`, pointing back at the real, original, shared category —
the exact, same mechanism a translated Vocabulary word's own display
label already uses. Verified directly: exactly 1 plain-named `Equity`
entity exists after instantiating for every business, both real proof
tests (BMW, Peugeot) pass, the full backend suite passes (187/187),
and the full e2e tutorial passes cleanly end to end.

### Balance.walk — one real primitive drives both P&L and Inventory drill-down

Per direct instruction: "the get balance function should retrieve all
the sales/COGS and/or inventory accounts and then deal with
hierarchies calculating vector or matrix sums — the display should
have all the data for P&L or Inventory drill down."

Added `Balance.walk(rootName)` — composes the already-existing
`getHierarchy` (a generic tree walk from any real root) with
`Balance.get` (a real account's own direct balance), summing
recursively at every real level. One real function, genuinely
generic over which real root it's pointed at: `Balance.walk('Income')`
or `Balance.walk('Expense')` for a real P&L drill-down,
`Balance.walk('Inventory')` for a real inventory drill-down — not a
separate, hand-rolled query per report screen. Each real node in the
returned tree carries its own direct balance (`own`), its own real
recursive subtree total (`total` — the real vector/matrix sum), and
its own real children, which is enough for a drill-down display to
render directly without further processing.

Exposed additively via a new `GET /api/reports/drill-down?root=...`
endpoint, alongside the existing `/profit-and-loss` and
`/balance-sheet` endpoints (left untouched, still the real,
established source for their own totals/checks) — verified live over
the real HTTP API (Income: $505,932,074,051 in minor units across 16
real top-level categories), the full backend suite (187/187), and the
full e2e tutorial.

### Hierarchy.buildTree: not "Balance", not per-category — one real, general primitive

Direct correction, worth recording in full: "not build Category or
Division — a general build hierarchy tree given a root that accesses
a specific property or perhaps list of properties (Name and price and
value of the associated account comes to mind) of the leaves of the
hierarchy or perhaps later the cartesian product of a number or
hierarchies — summing at each level of hierarchy — a tree ready to
display and drill down."

`Balance.walk` (this session's first attempt, immediately above) was
itself still too narrow — hardcoded to summing one thing, a balance.
Replaced with `Hierarchy.buildTree(rootName, getProperties)`:
`getProperties` is a real, caller-supplied function returning a real
map of any named numeric properties for a given leaf (`{ balance,
price, quantity, ... }`, any real set) — summed independently, per
property, at every real level. One real, general primitive; not
`buildCategoryTree`, not `buildDivisionTree`, not `Balance`-specific
at all.

**A real, critical bug found converting `buildCategoryTree` to compose
this** (the exact, load-bearing report already proven against BMW's
and Peugeot's own real financial statements): `Hierarchy.buildTree`'s
own internal leaf lookup resolved each node by plain name
(`Entity.get(n.name)`) — and a real product's own Sales account
deliberately reuses the product's own name (an established, direct
design decision from earlier this session), so two real, different
entities can share one real name. The bare, global lookup resolved to
the wrong one, silently returning an empty tree. The real fix: expose
`id` on `HierarchyNode` itself (already correctly resolved internally
by `getHierarchy`'s own parent-scoped queries) and use it directly,
rather than re-resolving by ambiguous name — the exact, same, "a
child is only unique by name within one parent" principle, now
correctly applied inside this primitive rather than merely stated
about the schema. Caught by testing this scenario directly (a product
with a real, nested category chain, one real posted sale) rather than
trusting the isolated primitive test alone, which had passed.

### Currency: debit/credit is a real property of a signed amount, not a separate concept

Direct correction: "credit and debit are a property of every currency
amount in the system, very definitely including account balances —
for that class there is an output method as in all reports and an
input method as in the General Journal and lines-entry tables where
data from every other screen ends up suitably massaged to affect the
appropriate accounts."

Added `Currency.toDebitCredit(amountMinor, normalSide)` (the one, real
output method — every report's own debit/credit split, and its own
`is_contra` flag, computed the same, one way) and
`Currency.fromDebitCredit(debitMinor, creditMinor)` (the one, real
input method — the exact, same, real class, the other direction).
Replaced three separate, hand-rolled copies of this exact split logic
(`x > 0 ? x : 0` / `x < 0 ? -x : 0`, duplicated across `getBalanceSheet`
and `getProfitAndLoss`'s own `toLine` functions, and again inside
`buildCategoryTree`) with calls to this one, real class.

Verified: full backend suite (187/187), and — critically, since this
touches the exact reports the CoA-mirror bug broke earlier — a direct
regression check against the pre-fix commit confirmed a real,
pre-existing, unrelated gap (Wine Retail Business's own real P&L
frontend e2e test already failed identically before any of this
session's changes, a date-range/demo-data issue, not a real
regression from this work) before trusting the fix as safe.

### SEED_DEMO_BUSINESSES: building Wine Retail Business from scratch via Playwright, for real

Direct instruction: "very definitely not load the foreign businesses,
or Wine Retail Business — I want to see this company built from
scratch via Playwright — I assume we only need the one dummy company
'Company' for login purposes only."

A real, honest confusion surfaced first: the existing Playwright
tutorial built a business named `Tutorial Wine Retail Co` — a
different, real, separate name from the actual, pre-seeded
`Wine Retail Business` — so "built via Playwright" was never quite
true of the real one. Fixed by renaming the tutorial's own target
business to `Wine Retail Business` itself, and switching its login
step to `My Business` (the one, real, always-present dummy company)
rather than `Wine Retail Business`, which may not exist at all now.

Added `SEED_DEMO_BUSINESSES=false` (default: unset, existing behavior
unchanged) to skip seeding every demo business except `My Business`.
Two real, genuine complications found along the way, both fixed by
reading the real, actual dependency rather than guessing:

- `Ditta Italiana Srl` and `Schweizer KMU AG` (not just BMW/Peugeot)
  are also hard-coded directly in `00-core.sql` — a real, trivial
  scale (5 total lines, confirmed directly), filtered the same way.
- `30-coa-links.sql` links every real account — both core's own and,
  when present, the foreign demo businesses' own — to its own CoA
  prototype. Filtering only the 4 lines naming a foreign business
  directly wasn't enough: many other lines in that same file
  reference an account that *only* exists in the skipped file. Fixed
  with a real, two-stage load — execute core (+ optional foreign
  demo) first, then filter `30-coa-links.sql`'s own lines against
  what's actually, really in the database at that point, rather than
  hand-enumerating every affected account name.

A real, genuine debugging detour worth recording honestly: this flag
must be set on every real backend start, not just the first —
`seedRemainingData()` runs every time the backend loads, not only
when the database is first created — and a test run without it set
consistently re-seeds `Wine Retail Business` even after it was
correctly skipped once. Added `make dev-no-demo` and made
`make playwright-tutorial` always set the flag (since the tutorial's
whole point is to build this business from scratch — it would
otherwise fail because the business already exists) specifically so a
person doesn't have to remember the raw environment variable
themselves. A second, real false alarm during this same debugging
session — `Wine Retail Business` appearing to still exist after a
`playwright-tutorial` run that had genuinely hung — turned out to be
stale screenshot/test-result output from an earlier, interrupted run,
not a real, live regression; resolved by wiping those directories and
re-running from a genuinely clean state before trusting the result.

Verified: full backend suite (187/187), and the full tutorial —
resumed and re-run from a genuinely clean state, not assumed — shows
`Company: Wine Retail Business`, `$100,000` balanced, built entirely
from scratch through the UI.

### Business Type / prototype CoA: a first, real go

Per direct suggestion, following `docs/coa-class-instance-plan.md`'s
own real, still-unbuilt design: a real `Business Type` top-level node,
with `Sole Trader`/`Partnership`/`Pty Ltd Company`/`Incorporated
Company` as real children, each with its own real prototype Chart of
Accounts copy underneath, and a real, simple set of questions attached
per type (number/names of partners, number/classes of shares, names
of directors, etc.) as real, Vocabulary-linked child entities.

The real, structural foundation reused what already existed rather
than duplicating it: `instantiateChartOfAccounts`'s own copy logic was
pulled out into a real, shared `copyChartOfAccountsInto(destRootName,
coaPrototype, userId)`, so both a real business's own instance and a
real business type's own prototype compose the exact, same, one, real
mechanism — including the same, already-fixed, genuinely-unique
mirror-naming (`{destRootName} — {category}`) that prevents the exact
global-name-collision bug found earlier this session.

Verified directly: each business type's own prototype CoA (e.g.
`Sole Trader CoA`) correctly shows five, genuinely-uniquely-named
structural mirrors (`Sole Trader CoA — Asset`, `— Equity`, ...), and
each type's own questions (e.g. `Partnership Questions`) correctly
lists its own three real, distinct question entities. Full backend
suite (187/187) and the full e2e tutorial both pass.

**A real, honest first-pass limitation, stated plainly**: this is
structural scaffolding, not yet a usable feature. Nothing in the
create-new-business UI offers a business-type choice yet, nothing
reads or displays a business type's own questions to actually collect
an answer, and no business created today is linked to any business
type at all. The real, next, separate steps: wire a business-type
selector into the new-business form, and design where a real, given
business's own real, answered question values should actually live
(most likely as a real `Detail`, scoped to that business, per the
same primitive already documented above).

### Business Type / prototype CoA: the UI wiring, completed

Per direct request to finish this: the new-business form's own
"Legal structure" dropdown was previously a hardcoded frontend array
(`ENTITY_STRUCTURES`), entirely disconnected from the real `Business
Type` entities built above. Replaced with a real, database-driven
fetch (`GET /businesses/types`, backed by a new `getBusinessTypes()`)
that reads the real `Business Type` entity tree directly, showing
each type's own real questions as free-text inputs.

Rather than rewrite the already-working `setupEquityStructure`
mechanism (which creates the real, correct extra equity accounts per
legal structure, and was already wired end to end), each real
database-driven business type name is mapped to its existing
`EntityStructure` value (`Sole Trader` → `sole_trader`, `Partnership`
→ `partnership`, `Pty Ltd Company` → `llc`, `Incorporated Company` →
`publicly_traded`) — a deliberate, additive unification rather than a
risky rewrite of working code with limited remaining verification
time. A real, new `saveBusinessTypeAnswers` function records each
question's own real answer via `Detail.set` — the exact, same
primitive already used for every other open-ended contact fact —
called separately after a business already exists, not folded into
`createBusiness`'s own signature.

Also confirmed directly, a genuinely good find: `POST /businesses`
already required the `Administrator` role
(`requireRole('Administrator')`) — the "an Application Administrator
can establish and configure a new company" requirement was already
satisfied by existing code, nothing further needed there.

Verified: full backend suite (187/187), and the full e2e tutorial —
which exercises this exact form — still passes cleanly with the new
selector in place, confirming the unification didn't disturb the
already-working creation flow.

### Testing the business-type UI: four real, separate bugs found, one still open

Following up on "did you test that Sole Trader could be created and
pass e2e test" — the honest answer was no, not fully, and continuing
to actually test it surfaced a real, genuinely useful chain of
findings, several of them bugs in the application itself, not just
the test script.

**Bug 1 — `option:checked` never matches after `selectOption` in this
browser context.** A Playwright trace showed the exact hang point:
`.locator('option:checked').textContent()` waits indefinitely for a
single matching element that this CSS pseudo-selector never actually
produces here, even though `selectOption` itself succeeded. Fixed by
reading `.inputValue()` instead — Playwright's own established,
reliable method for a `<select>`'s current value — and looking up the
matching option's own label directly.

**Bug 2 — a real, genuine application bug, not a test-script bug:**
`<select value={selectedBusinessType}>` bound a whole object, while
its own `<option value={bt.name}>` elements use plain strings. Svelte
has no way to match an object against a string, so on every reactive
re-render the DOM `<select>`'s own value was silently reset to empty
— meaning a real user selecting a business type in a real browser
would have seen their choice visually appear to work, then silently
revert. Found only by reading the actual Playwright trace's own
sequence of actions, not by guessing. Fixed by binding to the real,
matching string (`selectedBusinessType?.name`).

**Bug 3 — a real ordering bug, found while writing the e2e test
itself:** `getBusinessTypes()` had no `ORDER BY` clause, so SQLite's
own incidental return order made "Incorporated Company" the real,
actual default a person would see first — not the sensible "Sole
Trader" a reasonable person would assume. Confirmed directly (`db.ts`
query re-run manually) before and after the fix. This is exactly the
kind of bug that "works" in casual manual testing (a developer
already knows to pick the type they want) but would confuse a real,
first-time user relying on the default.

**A real, honest process lesson: a "passing" test can still be
meaningless.** A quick, isolated debug test (`debug_question2.spec.ts`)
reported "1 passed" while investigating whether a question's own
answer was actually being saved — but that test contained zero real
`expect()` assertions, only `console.log` calls. Its own "pass" meant
nothing beyond "no exception was thrown," and following that false
signal briefly obscured a real, more serious finding underneath: the
page's own body text, captured directly in that same debug run,
showed the "New Business" form still present after clicking "Create
Business" — meaning the real business creation itself may not have
completed, a genuinely more serious issue than the original question
about saving one field's answer. The lesson: a debug script written
to observe behavior, not to assert it, should never be read as
confirming success — only real assertions can do that.

**Environment instability, recorded honestly, not glossed over:** in
this same session, both dev servers were found to have crashed
mid-session (confirmed via `ps aux` and a `curl` connection-refused
check) with no code change responsible, and several `pkill`-style
shell commands themselves hung or timed out for reasons outside the
application's control. Each time, this was verified directly (server
health checked before assuming a code bug) rather than assumed away —
several apparent "hangs" during this investigation turned out to be
this instability, not a real, application-level defect, and treating
every hang as a code bug would have wasted real time chasing false
leads.

### CSS/HTML duplication: a real, empirical audit, not a guess

Per direct question ("how did we do reducing total lines with a common library?"), a real audit found the honest answer was disappointing at first glance — total frontend lines had barely moved (20,196 → 19,889, ~1.5%) despite real consolidation work. The reason, confirmed directly: that window also included substantial new feature growth (AR/AP restructuring, CoA hierarchy editor, Storage Origin, Product/Item hierarchy) in the same commits, masking the real saving from the earlier `CashTransaction`/`PaymentReceipt` mirror-pair collapse. A raw before/after line count, without isolating what actually changed, is a genuinely misleading metric on its own.

The real, useful technique that came out of this: extract every `<style>` block (or every non-script/style markup) from every `.svelte` file into one single working text file, each prefixed with `=== path ===`, then use a small Python script to find genuinely identical rule bodies or `<fieldset>` structures via *structural* matching (normalizing `{dynamic bindings}` to a placeholder, comparing declaration sets after sorting) — not name-based matching, which would miss real duplicates using different class names, and not naive text diffing, which would miss real duplicates using different whitespace/declaration order.

A real, embarrassing bug found and fixed in this exact process: the first pass at finding duplicate CSS rules didn't strip `/* comment */` blocks before running the rule-matching regex, so a comment's own text got matched as if it were a selector. Comments must always be stripped before any regex-based structural parsing of CSS.

A second, more consequential gap found the same way: the first "find every duplicate `table {}` rule" pass only matched rules with *exactly* the same two declarations in the *same* order — it missed 11 more files where the identical `width`/`border-collapse` redundancy was accompanied by one or two *additional* declarations (`margin`, `font-size`, `background`, `table-layout`). An exact-structural-match script systematically undercounts real duplication whenever real-world variations layer a genuinely small amount of extra, non-essential styling onto an otherwise-identical rule. The fix wasn't a smarter regex — it was a second, broader search (`grep` for the shared substring across all files) that caught what the first, narrower script missed.

A real, direct design call, not a technical finding: per explicit instruction, minor incidental differences (an extra `margin`, a `font-size` override) found alongside a genuinely redundant rule were treated as unintentional drift, not deliberate design, and removed along with the rule — favoring one, uniform, predictable look over accumulated per-component variation that nobody had actually chosen on purpose.

**Two real, permanent Claude skills came directly out of this whole thread of work** (see `docs/skill-wine-retail-e2e-and-docs.md` and `docs/skill-sql-ledger-ui-conventions.md`, also living at `/mnt/skills/user/`), enshrining exactly the two things repeatedly re-litigated across sessions: that Playwright (not a `curl` shortcut) and documentation updates are mandatory, not optional, after any change; and the real, established Svelte/CSS conventions (fieldset-legend as the page/field-title mechanism, the CSS variable palette, the translation-wrapping requirement) so future work matches the app's own existing look rather than reinventing it per page.

### Transactional integrity, the journal API, and a real, hard-won lesson in checking the manual before the code

A single, long session that began with a request to fix the tutorial e2e produced, in order: the removal of generic `createEntity` for good (renamed to `createEntityRaw`, kept only for its two real, deliberate, generic exceptions); a new, absolute, permanent skill (`docs/skill-transactional-integrity.md`) requiring every real save/submit to be an all-or-nothing guarantee; and, along the way, the discovery of a real, serious, previously-unnoticed gap in the journal-posting architecture itself.

**The manual-as-source-of-truth failure, named honestly**: asked to explain how stock reorder-level data could appear in journal entries without running either named test, the first, real instinct was to grep the live code and dig through archived database files — a direct, confirmed violation of `docs/skill-manual-as-source-of-truth.md`'s own, absolute rule to check the manual *first*, every time, before any exploratory code search. Checking the manual (`docs/css-styling-and-data-entry.md`'s own staging-mechanism table) then revealed the real answer directly: "Recurring transactions" was listed as a confirmed stub, when `createRecurringJournal` was actually implemented — just implemented wrongly. A second, real violation of the same skill followed immediately: the divergence was corrected unilaterally (editing the manual to describe the bug) instead of being *reported* and left for a decision, exactly the thing the skill explicitly forbids. Both failures were owned directly, not minimized, and the skill's own rule was re-applied properly from that point on.

**The real bug itself, confirmed by exhaustive search, not a single lucky find**: `createRecurringJournal` writes directly to `journal`/`journal_line`, bypassing `journal_entry_staging` and `post_journal_entry_insert`'s own real, per-currency balance check entirely, substituting a flat, currency-blind sum instead. A direct, exhaustive `grep` for every `INSERT INTO journal`/`INSERT INTO journal_line` in the backend found two further, real, previously-undocumented exceptions: `confirmPickedLine` and `confirmRestockPickedLine`, which use bare `journal` header rows (no lines, no amounts) as a lightweight, auditable marker for "this picking line was physically picked" — a deliberate, existing pattern, but a different kind of thing entirely from a genuine financial posting, left an open question rather than resolved unilaterally.

**The real, absolute requirement, stated in the strongest terms and now permanent**: all financial data — and, per direct, further instruction, *anything involving a currency, a stock unit, or a unit of shelving/storage space* — must be guaranteed to go through the real staging-table mechanism. A hand-written, prose "here's what goes through staging" table is not enough, because it had already gone stale in exactly the way that matters (a function's entry claimed staging-based behavior it didn't actually have) — so a real, mechanical, automated check (`scripts/check-journal-staging-only.ts`, wired into `verify-fresh`) was built to enforce this permanently: it fails loudly if any file other than `backend/src/db-journal.ts` contains a direct `INSERT INTO journal`/`journal_line`, catching the exact class of drift that hand-written documentation missed.

**A real, substantial refactor followed directly**: the entire journal/staging API — `stageLine`, `postJournalEntry`, `createRecurringJournal`, every AR/AP/PO/stock staging-and-posting pair, period-lock functions, `reverseJournalEntry` — extracted from the 7,908-line `db.ts` into its own, dedicated `backend/src/db-journal.ts` (~900 lines), matching the already-established `db-stock.ts`/`db-reports.ts` pattern. A real, embarrassing mistake was made and caught mid-extraction: the first attempt used line numbers that had already shifted from earlier edits in the same session, silently grabbing the wrong content and, worse, accidentally deleting `db.ts`'s own `export * from './db-stock.js'` re-export — reverted cleanly via `git checkout` the moment the compiler surfaced the damage, and redone carefully, verifying both extraction boundaries by direct inspection before touching either file again. 192/192 backend tests passed afterward, unchanged.

**The recurring-journal redesign, planned but not yet built**: per direct, further correction, the recurrence *schedule* itself (weekly/monthly/yearly, count, template lines) should live purely as real, entity-based definitions — never as special columns on the `journal` table, and never as a recursive, virtual-expansion view (`journal_occurrences`) replaying one set of lines across computed future dates. Materializing a due (or early) occurrence is a real, reviewed, person-driven action from the General Journal Entry screen — loading that occurrence's own template lines into the ordinary line-entry form, fully editable, then posting it through the exact, same, ordinary `stageLine`/`postJournalEntry` path as any one-off entry. This resolves the balance-check bug automatically (every occurrence becomes a real, ordinary, fully-validated posting) without requiring the staging trigger itself to understand recurrence at all.

**A separate, real, architectural correction on `Session.Business`**, made twice in direct succession: first, that reading the current business must never be a function call (`getCurrentBusiness()`) but a plain-reading property; second, that a genuinely plain, freely-reassignable module variable is unsafe on the backend specifically (it would leak between concurrent requests) but the *identical* concern does not apply on the frontend, where a single browser tab has exactly one user/business/language at a time — so the backend keeps its `AsyncLocalStorage`-backed getter (`Session.Business`, reading like a property, safely isolated underneath), while the frontend's own `Business.current` (extending the already-established `session.current` getter pattern) was deferred, by direct instruction, until after the tutorial e2e passes.

### Bug #10: `getVocabularyWords()` hid every brand-new word from its own search box, and what "English" actually is in this data model

**The real, confirmed bug**: `getVocabularyWords()` only returned concepts that already had at least one translation — directly contradicting its own documented intent (surfacing every vocabulary word for the `/setup/translations` screen's own search box). A word added via "Add a new word" was genuinely invisible to a real user the instant after they created it, until some other translation existed for it — a real, confirmed UX/backend bug found by driving the real, live UI through the step-runner, not by inspection or guesswork: creating a word via the UI and confirming the live word count didn't move, then giving it a translation via `--path api` and confirming the count incremented and the word appeared.

**The fix**: query every direct child of the one, true, global `Vocabulary` entity instead of joining through an existing translation. This had to be scoped carefully — every business gets its own, separate `Vocabulary` entity (via `instantiateChartOfAccounts`), so a bare, unscoped `WHERE name = 'Vocabulary'` is exactly the same class of ambiguous-name collision this session had already hit and fixed several times elsewhere in the entity tree. The real fix scopes the lookup through the `Application` root (entity id=1), the one, true, global parent, to reach the one, true, global `Vocabulary` and nobody else's.

**What this surfaced about the data model, worth recording precisely**: a vocabulary "concept" is not a separate id with an English label attached to it. The concept entity's own `name` column *is* its English text, directly — there is no stored "English translation" row at all. `getTranslation`/`setTranslation` only ever read and write genuine `Language` children (German, French, …), each storing translated text with a `relation_id` pointing back to the concept; `/setup/translations`'s own frontend explicitly excludes `"English"` from its editable-languages list for exactly this reason — there is no English row to edit.

So English isn't "first among equals" among the concept's translations — it's the concept's native encoding, the identity it's keyed by, not a peer entry sharing a table with its translations. This is also why the business-scoped English override (the vocabulary-alternates mechanism — `ensureVocabularyAlternate`/`setVocabularyPreference`/`getConceptsWithAlternates`/`deleteVocabularyPreference`, surfaced via `/setup/vocabulary`) had to exist as its own, separate layer rather than simply calling `setTranslation(concept, "English", …)`: doing the latter would mean renaming the concept entity itself, breaking every other `relation_id` and name-lookup keyed on that string across the whole tree. The alternates mechanism lets a business override the *displayed* English text without ever touching the concept's real identity.

Spot-verified end-to-end through the real, driven UI (not just `tsc`): a fresh-boot word count went from 261 to 625 once existing-but-untranslated words were correctly included, and a direct mini-repro (adding "Continue"/German and "Balance"/French live through `/setup/translations`) passed cleanly, confirming this fix together with the `search_and_select` exact-match fix (see above) both work correctly against the real, live page.

### Making English a real, editable Language, and a working-language translator workflow — and three more, real instances of the same ambiguous-name bug

**The real design change, per direct instruction**: English stopped being merely implied by a concept's own `entities.name` and became a genuine, editable `Language` — the same real shape as German or French, with its own, real translation rows under the one, true, global `Vocabulary`. This matters for two real, concrete reasons stated directly: (1) a business should be able to see and edit its own English wording through the exact same mechanism as any other language, not a structurally-privileged special case; (2) a real translator, more fluent in some third language than in English, should be able to work *from* that language instead — e.g. translating into Spanish while reading French as the reference, with native English only as the fallback when the chosen reference language doesn't have a given word yet.

**What changed, concretely**:
- `backend/schema/00-core.sql`: a single, generic `INSERT ... SELECT` (using `ROW_NUMBER() OVER (...)` to allocate fresh row/entity ids) backfills a real English translation row for every Vocabulary concept already seeded in the file — never by hand-listing 600+ words. The text is identical to the concept's own name by construction, so this was genuinely a no-op for every existing reader of `localized_text` (which already fell back to `entities.name`); the only real change is that the row now exists to be read back or overwritten.
- `backend/src/db.ts`: both of this codebase's real, shared entity-creation primitives (`create()` and `createEntityRaw()`) now automatically create a matching English translation row the moment a new word is created directly under the global Vocabulary — covering "Add a new word" from the real UI and every internal seed/business-type path (`db-seed.ts`) alike, from one, shared place, never duplicated per call site.
- `frontend/src/routes/setup/translations/+page.svelte`: English is no longer excluded from the per-word edit card; a new "Translate between languages" mode adds a reference-language / target-language picker and a two-column (reference, read-only ↔ target, editable) list across every word, with the target field pre-filled from the real, existing target text or, per direct instruction, a fresh copy of the reference text as an editable starting point rather than a blank field.

**Three more, real, confirmed instances of the ambiguous-name bug** (the same class as bug #10, `getVocabularyWords()`) were found and fixed while this work was in progress — every business gets its own, separate `Vocabulary` entity, so a bare, unscoped `WHERE name = 'Vocabulary'` is never safe once any business exists:
- `localized_text` (the SQL view every single page's displayed text is read through) — the real, direct fix behind bug #10, but the view itself still had the same, real, unscoped lookup baked in for which entities even need a fallback row. Scoped through the global `Application` root, same as everywhere else.
- `setTranslation`'s own concept-resolution subquery, and `getTranslation`'s own disambiguation tiebreak — both already *tried* to prefer the real Vocabulary concept, but did so via the same unscoped lookup, so the "preference" itself could silently pick the wrong business's Vocabulary.
- `copyChartOfAccountsInto` and `getChartOfAccountsPrototype` — both walk the real "% CoA" prototype markers (English CoA/German CoA/French CoA) via a Vocabulary lookup; an unscoped one here risked silently resolving to whichever business happened to exist, breaking prototype-tagged account copying for every business created after the first.

A single, shared `globalVocabularyId()` helper now backs every one of these real call sites, replacing five, separately-written, separately-riskable copies of the exact, same scoped subquery.

**RTL verified directly, not assumed**: Hebrew and Arabic were already seeded (schema) as genuine `Language` entities with `Text Direction: RTL`, and the whole app shell (login, session picker, main layout) already applied `dir="rtl"` from `getLanguageDirection` — all pre-existing, unaffected by this work. The new translator UI wires the same, real mechanism into its own inputs and reference columns. Confirmed live, through the real, driven UI (`step-runner.ts --path ui`), not just `tsc`: setting a real Hebrew translation for "Continue" (`המשך`) rendered genuinely right-to-left in the per-word edit card, screenshotted mid-run for direct visual confirmation, and the API's own `/i18n/vocabulary-words` response confirmed both the new English row and the Hebrew translation together in one real word's own translation map.

### db.test.ts fully retired: all 200 tests now run against real, per-test fixtures, never the shared 'admin' business — and two more, real instances of the unscoped-entity-lookup bug

The long-running migration away from the shared, globally-seeded `admin` business as this suite's implicit shared fixture is now complete: all 200 tests live in one file (the former `db2.test.ts`, now simply `db.test.ts` — the old file removed outright, not kept alongside it), every one of them creating its own, uniquely-named business via `fixtures.ts`'s `freshBusiness` rather than reading or writing `admin`'s own, real, accumulated state. The final 53 tests (hierarchy/multi-dimensional reporting, product combinations, multicurrency, bank-account/currency structure, contacts, storage-space conversion) were the most structurally demanding of the whole migration — see docs/test-fixtures-design.md's own rationale and the file's own header comment for the full convention.

**Two more, real, confirmed instances of the unscoped-entity-lookup bug** (the same class behind bug #10's `getVocabularyWords()` and the three fixed alongside the English-as-real-language work) surfaced directly from porting tests off the shared business onto fresh, per-test ones — exactly the kind of bug this migration was expected to surface, since two different businesses sharing a display name is common (every business gets the same default Chart of Accounts) but only ever happened to "work" against the single, shared `admin` business this suite used to depend on:

- `ensureCurrencyAccount` (`db-reports.ts`) called `setAccountCurrency(currencyAccountName, currency)` by bare name only, after already, correctly resolving the real entity id one line above (`existing`). Two businesses' own currency-tagged siblings sharing a display name (e.g. both have "Cash at Bank (USD)") meant `setAccountCurrency`'s own, separate, unscoped fallback lookup could silently tag the WRONG business's account, leaving the right one's currency unset and breaking its very next real posting's per-currency balance check. Fixed by passing `existing.id` through.
- `buildBankCurrencyStructure` (`db.ts`) had the exact same gap one call further down — `Entity.ensureUnder(leafName, header.id, userId)`'s own return value (already carrying the real, resolved id) was discarded, and `setAccountCurrency` was called with the bare name again. Fixed by capturing the return value and passing its `.id`.

**A third, related, residual risk was found but deliberately left unfixed**: `setTerminalCurrency`/`createPosTerminal` (`db-stock.ts`) has the same shape of gap, but fixing it properly isn't a one-line change — `createPosTerminal`'s own `"${locationName} Terminals"` parent lookup is itself unscoped one level up (two businesses can share a location name, confirmed directly by an already-ported test), so a real fix needs a small design decision about how to disambiguate a location-scoped sub-tree generally, not just thread one more id through. Not exercised by any failing test. Flagged here rather than patched speculatively.

Final verification: `npx tsc --noEmit` clean; the full, renamed `db.test.ts` passes 198/200, the same 2 failures (`languages list and localized_text fallback/override...`, `French works as a genuine, complete third language...`) present on the untouched baseline before any of this session's work — a pre-existing gap (German "Speichern" was never seeded) confirmed unrelated via direct comparison, not assumed.
