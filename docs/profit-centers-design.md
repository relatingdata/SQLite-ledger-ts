## Profit Centers — a real, structural subtree inside one business's own CoA

Per direct instruction: designed and documented fully here before any code changes,
not built first and explained after — the same discipline `docs/session-business-context.md`
already followed for the session-context work this design leans on directly.

### The real problem this solves, and why Division/Hierarchy can't

This application already has two real ways to sub-total a business's activity: the
Division entity tree (`getDivisions`, `backend/src/db.ts` ~6350) and the Hierarchy/
category dimension system. Both are deliberately **tags, never account owners** — a
Division is a bare entity with no Income/Expense/Inventory children of its own; every
real posting still lands in the business's one, shared set of accounts, and a report
groups by the tag afterward. This was a direct, confirmed design decision, reinforced
twice this session: the recent removal of the `division_id`/Cost-Center/Profit-Center
journal-line tag entirely, and `computeCloseLines`'s own comment
(`backend/src/db-reports.ts` ~1191) describing an earlier, per-division Retained
Earnings leaf as a rejected mistake, removed on the principle that division is "only
ever a real, pure sub-totaling/reporting dimension."

Per direct instruction, a Profit Center is a genuinely different, stronger thing: a
real node that **owns** its own Income subtree, its own Expense subtree, and its own
Inventory subtree — real, separate Sales/COGS/Inventory leaves per profit center, not
one shared set split by a tag afterward. It explicitly does **not** own a Balance
Sheet (no separate Asset/Liability/Equity of its own) and is explicitly **not** a
second business — one business, one Balance Sheet, one set of Cash/AR/AP/Equity
accounts, no matter how many Profit Centers it has.

### The structural model — corrected directly during Phase A's own implementation

An earlier draft of this section put each Profit Center's Income/Expense/Inventory
headers under a brand-new `Profit Centers` root, sibling to `Chart of Accounts` —
structurally separate from the business's one, real, shared CoA tree. Building Phase A
found that wrong before it was built: `getBalanceSheet`/`getProfitAndLoss`/
`business_reports` (`backend/src/db-reports.ts`) all walk the structural tree starting
from the business's own `Chart of Accounts` root — a Profit Center's accounts living
outside that tree would be real, but invisible to every existing report, a second,
parallel reporting path silently diverging from the first. Corrected, and now what's
actually built: **a Profit Center is a real, named grouping node nested directly
under the business's own, already-existing, shared Sales Revenue / Cost of Goods Sold
/ Inventory headers** — one further, real level, the exact, same mechanism already
proven for a product's own category chain (`ensureCategoryChain`), just inserted
first, before that chain. Concretely, a sale of "Red Wine" scoped to the "Downtown
Store" Profit Center lands at `Income > Sales Revenue > Downtown Store > Red Wine`,
not under some separate, parallel Income tree — so `getProfitAndLoss`'s own,
existing, structural walk finds and totals it automatically, with zero changes to any
report. The same is true of Inventory: `Asset > ... > Inventory > Downtown Store >
Red Wine` nests exactly where `ensureItemLocationInventoryAccount`'s own
location-scoped leaves already nest, one level deeper.

This also directly answers "it has to explicitly live in the CoA" — it does, more
literally than the first draft: inside the one, real, shared Chart of Accounts tree
every other account already lives in, never beside it.

A Profit Center still has **no** Asset/Liability/Equity header of its own — nothing
above changes that. The one, real, shared Balance Sheet gains exactly one new thing
per Profit Center: a named sibling under the business's existing, single Retained
Earnings account — `Retained Earnings (Profit Center X)` — created the moment that
Profit Center first closes with a non-zero result, via the exact, same
`ensureCurrencyAccount`-style sibling-creation mechanism already proven for
currency-tagged Retained Earnings (`backend/src/db-reports.ts` ~143). Equity itself
is never duplicated; it just grows one more real leaf, exactly the way it already
grows one more leaf per foreign currency closed. This is the concrete, structural
thing a Division/Hierarchy tag could never produce, and the real reason Profit
Centers can't just be "a stronger Division."

### Where this plugs into existing code — Phase A, done and verified

Built directly against the real code, not sketched:

- **The `Profit Centers` root** (`backend/src/db.ts`'s `PER_BUSINESS_ROOTS`) — a real,
  empty root every business now gets automatically (new businesses immediately;
  existing ones lazily, the first time anything needs it), holding zero real Profit
  Centers until one is explicitly created.
- **`createProfitCenter(businessName, profitCenterName, userId)`** / **
  `getProfitCenters(businessName)`** — creates/lists real Profit Center entities under
  that root, business-scoped, rejecting a duplicate name outright. Exposed via
  `POST`/`GET /businesses/:name/profit-centers` and the matching
  `frontend/src/lib/api.ts` wrappers — not wired into any screen yet (that's Phase C).
- **`resolveProfitCenterGroupNode(business, headerId, profitCenterName, userId)`** —
  the one, real, shared mechanism every resolver below uses: given an already-resolved,
  business-scoped header id (Sales Revenue, Cost of Goods Sold, or Inventory), ensures
  a real grouping node named after the Profit Center directly underneath it, tagged
  back to the real Profit Center entity via the exact, same generic dimension-link
  mechanism (`setDimensionParent`) `ensureItemLocationInventoryAccount` already uses
  for Location — disambiguated by this grouping node's own, real id, since the exact,
  same Profit Center name genuinely recurs three times (once each under Sales
  Revenue, Cost of Goods Sold, and Inventory), the same, real, confirmed "same literal
  name, different real account" shape Open Container's own leaves already proved
  needs an explicit id, not a bare name lookup. Validates the Profit Center is real
  for this business first — an unknown name fails loudly, never silently creates an
  orphaned grouping node under a real GL header.
- **Per-item account resolution**: `ensureCategoryChain`, `ensureItemSalesCogsAccounts`,
  `ensureItemInventoryAccount`, and `ensureItemLocationInventoryAccount`
  (`backend/src/db.ts`) all gained an optional, trailing `profitCenter?: string`
  parameter — when omitted (every existing caller, today), behavior is provably
  unchanged; when given, the leaf nests one further level under the Profit Center's
  own grouping node, as above. Verified directly in `backend/test/db.test.ts`: one
  test confirms a business starts with zero Profit Centers and duplicate creation is
  rejected; a second confirms both the unscoped (unchanged) and scoped (nested
  correctly under each of Sales Revenue/Cost of Goods Sold/Inventory, including the
  location-scoped Inventory leaf) shapes, plus the loud failure on an unknown Profit
  Center name. `tsc --noEmit` (backend, same 6 pre-existing baseline errors),
  `svelte-check` (frontend, 0 errors/warnings), and the backend test suite (136 pass —
  134 plus these 2 new — / 80 fail, unchanged baseline) all confirmed.
- **Close Books** (not yet built — Phase B): `computeCloseLines` (`backend/src/db-reports.ts` ~1222) already
  groups net income by `(division, currency)` internally before posting per-currency.
  It gains a third grouping key, Profit Center, and posts one real line per
  `(profitCenter, currency)` combination with a non-zero result, each into its own
  `ensureCurrencyAccount`-style Retained Earnings sibling (nesting both dimensions
  the same way currency alone does today — `Retained Earnings (Profit Center X)
  (EUR)` when both apply). `divisionBreakdown` gains a sibling,
  `profitCenterBreakdown`, for the same, real, informational reporting purpose.
- **Rollover**: `resolveRolloverLines`/`rolloverToNewPeriod`
  (`backend/src/db-reports.ts`) read the old ledger's non-zero Balance Sheet lines —
  unaffected in shape, since Profit Centers never touch the Balance Sheet directly;
  the new ledger simply ends up with however many Retained Earnings siblings the old
  one closed with.

### Session integration — leans directly on the half-built session-business-context design

Per direct instruction, a Profit Center is chosen the same way Business already is:
automatically, with no visible choice, for an ordinary user restricted to one; offered
as a picker (like today's business/ledger dropdowns) for accounting staff with access
to several or all. Concretely, this becomes a third field alongside the session
record's own `business_name` — `profit_center_name` — read and set through the exact
same mechanism `docs/session-business-context.md` already designed for business
(`setSessionBusiness`/`getSessionBusiness` on the session entity's `detail_json`,
`req.business`/`req.profitCenter` attached by `attachUser`).

**An honest, direct finding from checking this before writing it down**: that
session-context design's own "Honest, current status" section says the route-level
conversion away from `req.query.business` **has not actually been done yet** — the
primitive exists (`session-context.ts`, `setSessionBusiness`/`getSessionBusiness`)
but no route reads `req.business` instead of a request field today. More
fundamentally, **there is no existing per-user restriction to a subset of businesses
at all** — `getBusinesses()` returns every business in the system to every logged-in
user, unfiltered, and no request validates that a user may act on the business they
send. So "accounting staff may have access to a number or all of them" for Profit
Centers is not a case of mirroring an existing Business-level access control — that
control doesn't exist yet, for Business either. Building real per-user restriction
(which businesses, which profit centers a given user may select) is a genuinely new,
separate access-control feature, for which the closest scaffolding is this same,
half-built session-context work — a natural, single place to add both a business
grant and a profit-center grant together, since both would use the identical
mechanism (a real entity relationship from user to the things they may select,
checked wherever the session picker and `setSessionBusiness`-equivalent calls happen).
Until that's built, a Profit Center picker would work exactly like today's Business
picker: every Profit Center shown to every user, trusted, not enforced — a real,
honest, temporary gap, not silently assumed solved.

### Phased plan

- **Phase A — structural CoA support: done.** The `Profit Centers` root, the Profit
  Center entity type, and threading a Profit Center through the per-item account
  resolvers, nesting under the business's own shared Sales Revenue/Cost of Goods
  Sold/Inventory headers rather than a separate, owned subtree (see the corrected
  structural model above). A business created today with zero Profit Centers behaves
  exactly as before — verified, not just assumed.
- **Phase B — Close Books extension**: `computeCloseLines` grouping and posting by
  Profit Center, `ensureCurrencyAccount`-style Retained Earnings siblings,
  `profitCenterBreakdown`.
- **Phase C — session integration, trust model only**: `profit_center_name` added to
  the session record and `req.profitCenter`, a picker on the `/session` page exactly
  like today's business/ledger dropdowns, no enforcement yet (matching today's actual
  Business behavior honestly, not a regression).
- **Phase D — real per-user access control (separate, bigger, later)**: the
  user-to-business and user-to-profit-center grant mechanism itself, built once,
  covering both dimensions, finishing the session-context route conversion along the
  way.
- **Phase E — deferred per direct instruction ("for now... but later")**: creating a
  brand-new Profit Center immediately after a period-end, by extending the Chart of
  Accounts as part of (or right after) Rollover, rather than only at business-setup
  time. Explicitly out of scope until Phases A–C exist and are verified.

Per direct instruction: this document provides the real, structural *method* a
business can use — it imposes no real *policy*. A business with zero Profit Centers
is unaffected; a business with one behaves exactly like today, transparently, for
every ordinary user who never needs to know the concept exists.
