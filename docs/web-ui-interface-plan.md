# The Web UI Interface: a Plan for the Tutorial's `--path ui` Run

**Status: a plan. Nothing in it is built.** It exists to wire the Step Runner's `--path ui` path
to the real, existing web application for the 21-step tutorial data file
(`shared-fixtures/tutorial-steps.csv`), per `docs/realistic-tutorial-e2e-plan.md`'s own, unfinished
Phase E (`--path ui` has not yet been run against it).

## A direct, honest correction, found while writing this plan

Phase B of the realistic-tutorial plan added nine screen types with empty `ui_path`/selector
columns, wired only to the API path — each one assumed, without checking, that no real UI page
existed yet for the operation. **That assumption was wrong for at least seven of the nine.** A
sweep of every real route in `frontend/src/routes` (not assumed, read directly) found a working,
or at least present, page for nearly every one:

| My new screen | Real, existing page | Checked |
|---|---|---|
| Cash Purchase | `/arap/cash-purchase` (a thin wrapper around `CashTransaction.svelte`) | yes, direct view |
| Create Purchase Order | `/stock/po` | yes, fields confirmed |
| Transfer Items | `/stock/transfer` | yes, present, fields not yet fully surveyed |
| POS Sale | `/pos` — a full terminal UI, far richer than the API wrapper this session built | yes, fields confirmed |
| Post Journal Entry | `/post` ("General Journal" — not `/journal`, which is only the submenu list reviewed earlier this session) | yes, fields confirmed |
| Create Employee, and the Division itself | `/setup/business-setup` — this *is* Chapter 3's own "Business Setup" step, by name | yes, fields confirmed |
| Create Provider | `/contacts` (labelled "Vendors / Suppliers" — matching the business owner's own, translatable choice of word directly) | yes, confirmed |

**Set Location Capacity** and **Set Item Cost and Pack Size** are the two genuine exceptions, and
each has its own further finding below.

This is the same class of failure recorded in `docs/skill-manual-as-source-of-truth.md` — reaching
for a new mechanism before checking whether an existing, real one already does the job — applied
here to the frontend codebase rather than the manual. The fix is the same: check first. This plan
is that check, done properly, before any selector is wired.

## Finding: Set Location Capacity already has a home

`/setup/business-setup` already has a `saveLocationDetail` action with City and Type fields for a
location — capacity fields were not seen in the brief survey done so far and need a direct, close
read of this page's full form before concluding whether they already exist there or need adding
to it, rather than built as a separate screen.

## Finding: "selling price" does not exist anywhere, backend or frontend — confirmed directly

Read directly, `/items`'s own "Add a source" form has Manufacturer, Vendor, Vendor SKU, Vendor UPC,
**Price** (the buying/cost price), Currency, Package quantity, a Preferred-source checkbox, and a
free-text reason — exactly `addOrUpdateItemSource`'s own real fields. **No selling-price field
exists anywhere on it, or anywhere else searched.** This confirms, from the real UI itself and not
only the earlier backend search, that Chapter 3's own "cost and selling price, set here" is a real,
unbuilt capability, needing a new backend mechanism before any UI can expose it. Not proposed here
in detail — flagged as the one, real, new piece of backend work this plan depends on.

## The user's own design requirement: item, pricing, and suppliers in one atomic step

Per direct instruction: "buying and selling price and preferred and alternate suppliers are
created when the item is created." Today's real UI does not do this — `/items` creates the item
first (a plain name and category, via "+ Add"), and only afterward, once the item already exists
and is selected, shows the separate "Add a source" form beneath it. These are two, separate,
sequential actions on the same page, not one atomic step.

**The design implication**: `/items`'s own item-creation flow needs to become one, real,
multi-part step — the item's own name and category, together with at least one real source
(a provider, a buying price, a package quantity) and, once it exists, a selling price — submitted
together, not as two separate forms a person can walk away from half-finished. Concretely:

1. The existing "+ Add" form gains, inline, the same fields `addOrUpdateItemSource` already takes
   (Provider, buying price, package quantity, preferred), so the first provider relationship is
   created in the same action as the item itself.
2. A second, true alternate provider remains addable afterward, through the existing "Add a
   source" form — Chapter 3's own narrative only ever names one supplier per item, so a second
   is a genuine addition, not a contradiction of "created when the item is created."
3. A new, real `sellingPriceMinor` field is added to the same, combined form, backed by the new
   backend mechanism named above — this is the one piece with no existing mechanism to wire to at
   all, and needs its own design before this step can be built.

This is a real, user-facing redesign of `/items`'s own item-creation flow, not an addition to
`screens.csv` alone — the screen registry change follows once the real page itself is changed to
match, not before.

## The Step Runner's own entries, corrected

Per the findings above, `shared-fixtures/screens.csv`'s new entries from Phase B should point at
the real pages found, not stay empty:

| Screen | `ui_path` | Real submit action, as found |
|---|---|---|
| Create Purchase Order | `/stock/po` | `save` |
| Cash Purchase | `/arap/cash-purchase` | `submit` (via `CashTransaction.svelte`) |
| Transfer Items | `/stock/transfer` | not yet confirmed |
| POS Sale | `/pos` | `completeSale` |
| Post Journal Entry | `/post` | `save` |
| Create Employee | `/setup/business-setup` | `saveEmployeeDetail` |
| Create Provider | `/contacts` (with `?focus=vendors`, matching the existing menu link already found in `db-seed.ts`) | not yet confirmed |
| Set Location Capacity | `/setup/business-setup` (if its capacity fields are confirmed present) or a new field on `/locations` | not yet confirmed |
| Set Item Cost and Pack Size | folded into `/items`'s own, redesigned item-creation flow, per above | not applicable once redesigned |

**Every "not yet confirmed" cell is real, remaining work** — a direct, close read of that page's
own markup and selectors, the same discipline already applied to the seven rows marked "yes"
above, not assumed from the pattern the others showed.

## The order of work

1. **Close every "not yet confirmed" gap above** by direct inspection, before wiring a single
   selector — repeating the mistake this plan itself was written to correct (assuming instead of
   checking) would be the wrong way to build the correction.
2. **Confirm or deny Set Location Capacity's real home** on `/setup/business-setup`.
3. **Design the new selling-price mechanism** (backend) — its own, small design question, separate
   from this UI plan, since no selling-price concept exists anywhere today to build a UI on top of.
4. **Redesign `/items`'s item-creation flow** into the single, atomic step described above, once
   the selling-price mechanism exists to extend it with.
5. **Update `screens.csv`** with the real `ui_path`/selector values for every row, once each page's
   own real markup has been read directly, not guessed from a pattern.
6. **Run `--path ui`** against the 21-step tutorial data file, the same one already passing via
   `--path api`, and confirm every step passes through the real browser too — the Step Runner's
   own, stated purpose: the same steps, either path, so the two can never silently drift apart.

## What this plan has not verified

The exact fields and selectors of `/stock/transfer`, `/contacts`'s provider-creation form, and
whether `/setup/business-setup` already has location-capacity fields — each flagged above as
needing its own direct check before step 5 can be done; and whether `/pos`'s own, much richer
terminal flow (store, terminal, customer, scan-or-search) can be driven by the same simple
quantity/price arguments the API path uses, or needs its own, separate argument shape to match
what a person actually does at that screen.
