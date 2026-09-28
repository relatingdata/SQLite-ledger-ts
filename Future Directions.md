# Future Directions

A real, honest place to capture forward-looking ideas raised in
conversation but deliberately not built yet — either because they're
genuinely bigger undertakings, or because they depend on other,
real work landing first. Not a commitment, not a roadmap with dates —
just a real, direct record so a good idea doesn't get lost between
sessions.

## 1. Breakages and spoilage in the two-axis matrix reports

The New P&L (Matrix), New Stock on Hand, and New New P&L reports all
currently cover Sales vs. COGS. A real, further, natural extension:
Breakages and Spoilage write-offs should be breakable down and/or
summarized the exact same way — by Product, Category, Location,
Division, or Consolidated, nested the same "vector within a vector"
way New New P&L already does.

This is a real, genuine, incremental extension of the same, already-
proven mechanism (`db-matrix-reports.ts`), not a new design — the
real axis-resolution logic (`resolveKey`, `categoryForAccount`,
`locationForAccount`, `divisionForLocation`) is already fully general
and doesn't care whether the account it's given is a Sales, COGS, or
Breakages account. The real work is mostly in extending
`getSalesCogsMatrix`/`getProfitAndLossByAxis`'s own account-selection
query to also, optionally, include Breakages/Spoilage accounts, and
deciding on the right, real UI to show a third real figure (not just
two columns, Sales/COGS) per cell without the report becoming
cluttered.

## 2. Accounts created from entity links/CoA, lazily, from postings

A real, established pattern this session, worth naming explicitly so
it's a deliberate principle going forward, not a coincidence: a real
GL account (Sales/COGS leaf, tier-level part, location-specific leaf)
should be created lazily, the first real time a real posting actually
needs it — `ensureItemSalesCogsAccounts`, `ensureProductTierPart`,
and `ensureItemTierLocationLeaf` all follow this, real, same
shape. Never pre-generate a real, large, speculative Chart of
Accounts up front for every real, possible combination that might
never actually occur.

This principle should keep being followed for any real, future
structural dimension added the same way location/tier were — a real
account for a real (product, tier, location) combination should only
ever spring into existence the moment a real, live posting first
needs it, never before.

## 3. The real recording grid vs. real reporting rollups — decided and built

Resolved directly, not left open: **only product and location genuinely
map to a real, physical, posted-to account.** Division and category are
purely real, computed reporting rollups — walking a location's own real
parent (division tree) or a product's own real parent (category tree)
at report time — never a separately recorded dimension on the journal
line itself. `journal_line.division_id` is a real, existing, separate
tag column that predates this and is being retired in favor of this
structural approach, not the real, structural source of truth going
forward.

Built: `ensureItemLocationLeaf` extends the same, real, proven
(tier, location) pattern (`ensureItemTierLocationLeaf`) to every
ordinary product, tiered or not — a real sale at a real location now
always resolves to its own real `Sales - {Product} — {Location}` and
`COGS - {Product} — {Location}` leaf, not a shared, location-blind
aggregate. Verified live: the full simulation and every real,
documented expected figure (P&L, Sales Report, cash movement) are
unchanged — location-scoping only adds real reporting granularity, it
doesn't change any real, aggregate total.

Confirmed, directly, not newly built: the real, existing, generic
`setDimensionParent`/`getDimensionParent` mechanism (already used for
"Location" and "COGS Product") already, genuinely supports any further,
real, lateral relationship a product or location might carry — a real
wine's own region (Bordeaux, Tuscany), a real beer's own brewer — the
exact, same way, with no new, structural code required for the core
capability. These are real, additional classification links, not a
second, competing category hierarchy; a product's own real category
chain (Parts → Category → sub-category) stays the one, real, structural
grouping the Sales/COGS accounts nest under — a region or brewer link
is a separate, real, lateral fact about that same product, read the
same way `locationForAccount`/`getDimensionParent` already reads any
other dimension.

## 4. POS: "Hot" and "Cold" keys

Per direct request: add real, dedicated "Hot" and "Cold" keys to the
POS terminal's own UI plan. Right now, `completePosSale` already
resolves a real product to its own, correct, real location (including
the real Refrigerated variant) via the `tier`/product lookup itself —
a clerk doesn't manually choose hot vs. cold today at all, it's
already automatic based on which real product is being sold.

A real, dedicated Hot/Cold key would be a real, different, additional
capability — letting a clerk directly indicate a real, physical fact
about the actual, real transaction happening (a customer buying a
"cold" beer to drink immediately vs. a "warm" carton to take home,
say, for a real product that's sold in both real states) — distinct
from which physical location it happened to be picked up from. Needs
real, further thought on exactly what real, additional business fact
this key would capture that the existing tier/location resolution
doesn't already, and how (or whether) it should affect posting at
all, before this becomes a real, concrete design.

## 5. When adding future locations, divisions, and categories (and other hierarchies)

A real, direct question raised, not yet resolved: should these
hierarchy structures (division tree, category tree, and any future
ones) be locked against real, structural change during an active
business year, while still allowing real, new additions?

Worth real, careful thought before deciding: a real, mid-year
re-parenting (moving a real location from one division to another,
say) would retroactively change how every real, already-posted
transaction at that location rolls up into historical reports —
genuinely different from adding a real, brand-new location or
division, which affects nothing retroactively at all. The real,
concrete rule likely needs to distinguish "add a new, real leaf/branch"
(always safe) from "move or rename an existing, real one" (needs real,
careful handling — versioning, an effective-date system, or an
outright lock during an active period) — rather than one, blanket
rule for the whole, real hierarchy.

## 6. The Menu system as a real, editable part of the entity tree

A real, direct question raised earlier this session, revisited: is
the menu system itself just another real hierarchy under
"Application" — the same, real "everything is an entity" principle
already applied to every other part of this app? Today it's a real,
hardcoded, static array in `+layout.svelte`, identical for every
business, every user, every moment — genuinely inconsistent with the
rest of the app's own design philosophy.

Per direct request, this is a real, concrete next step, not just a
philosophical question: bring the current, real menu tree into the
entity table as it stands today (mirroring the existing, hardcoded
structure faithfully), as groundwork for making it genuinely editable
later — a real administrator restructuring, renaming, or adding menu
items live, the same way divisions/categories already can be today.

### Real, open questions worth thinking through before building this
- Per-business and per-user overrides, layered on top of some shared,
  real, default menu tree — how much of the existing app needs to
  change to actually read the menu from the entity tree at request
  time, rather than the static array?
- Should this reuse the existing `setDimensionParent`/dimension
  mechanism directly, or does a menu item's own, real, structural
  position (which section it's under, in which order) need to be a
  genuine, direct `parent_id`, given a menu, unlike a report, has a
  real, meaningful display order that a `parent_id` chain already,
  naturally encodes?

## 7. A real Glossary — synonymous terms across the whole app, in every language

Per direct request: real, synonymous terms (Vendor/Supplier/AP,
Customer/Debtor/AR, and others like them) should be handled
consistently everywhere they appear, via a real Glossary — extending
the same, existing, real translation mechanism already used
throughout the app (`translation_entry`, keyed by a real English term,
with real per-language equivalents) to also, genuinely capture
same-language synonyms, not just cross-language translations.

## 8. The User Manual and Glossary as self-documenting, in-application content — with a real, separate, exported PDF for now

Per direct clarification: for now, the real, concrete deliverable is
a real, ordinary, separate PDF — not, itself, a live application
feature. The bigger, real idea behind it, worth recording honestly as
a real, later direction rather than pursued now: the Glossary (and
potentially the whole User Manual itself) could, eventually, live as
real, genuine, in-application content — each real term or chapter its
own, real entity, versioned and translated the exact, same, real way
everything else in this app already is — with the real possibility of
user annotations and suggestions attached directly to the real content
they concern, rather than living in a separate, static document
disconnected from the real, live application a person is actually
using.

A real, honest, open question, not resolved here: how much of this
should reuse the existing translation/vocabulary mechanism directly,
versus needing its own, real, richer structure (a real annotation
needs an author, a timestamp, a status — none of which a simple
translation entry has today).

## 9. Chart of Accounts customization

Per direct request: "CoA customization is also required." Not yet
scoped in any real detail — recorded here honestly so it isn't lost,
rather than built in haste on an unconfirmed shape.

Real, open questions to work through carefully before building
anything, the same discipline already proven this session for the
menu and vocabulary work: what "customization" concretely means here
— renaming an existing, real account the way the vocabulary/menu
overrides already let a business rename a report or menu label,
versus a business adding its own, genuinely new accounts, versus
reorganizing the real, existing hierarchy (moving accounts between
headings)? Each of these is a real, differently-scoped piece of work,
and the existing `New Business` flow already lets a business pick
from country-specific Chart of Accounts families — customization
might reasonably build on that existing choice, or might be a real,
separate, later step for a business already set up.

## 10. Main panel not always responsive to top or side menu clicks

Per direct report, not yet investigated. A real, reported bug: the
main content panel sometimes doesn't respond when a top-bar or
sidebar menu item is clicked. Given how recently the menu's own
navigation mechanism changed this session (from a hardcoded array to
a live, fetched, structural source), this is a strong, first place to
look — the same, real class of async-timing issue already found and
fixed twice this session in the menu work (the default active-section
key, and the URL-to-active-section race condition) is a plausible,
related cause, though not yet confirmed.

## 11. Division/Location panel — a real, single, unified editor with insert/delete keys, not Add/Delete buttons

Per direct request: the combined division/location panel (Business
Setup, following the retirement of the separate Divisions page — see
commit 8517cf7) should use focus-sensitive Insert/Delete keyboard keys
for adding and removing a row, rather than explicit "Add"/"Delete"
buttons. Not yet designed or built. A real, genuine UI/UX pattern
change, not a small tweak — needs its own, careful pass: which
element needs real, keyboard focus for Insert/Delete to apply to the
right, real row; what real, visual affordance replaces the removed
buttons so the capability isn't hidden from a person who doesn't know
the keyboard shortcut exists; and how this interacts with the
existing inline "+ Add employee"/"+ Add location" pattern already
built into Business Setup.

## 12. Arrows within the current panel/screen — per-page, not yet built

Per direct request, alongside the menu's own arrow-key navigation
(commit e6ca5f7, which covers the top bar and sidebar only): arrow
keys should also navigate within whatever panel/screen is currently
open — moving between table rows, form fields, or other real,
focusable content on the page itself, not just the menu around it.

This is a real, much larger, genuinely per-page undertaking, not a
single, shared mechanism the way the menu's own arrow-key handling
could be: each real page has its own, different, real shape (a data
table, a tree, a multi-field form), and "the next real, focusable
thing" means something different on each one. Building this properly,
one real page at a time, deserves its own, careful pass — starting
with the Structured Editor (already the proof of concept for the Esc/
dirty-state mechanism) would be a reasonable, first, concrete case,
the same discipline already proven this session for the menu and
vocabulary work.
