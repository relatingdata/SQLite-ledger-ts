# The Menu as a Real Entity Hierarchy — a plan

Per direct request: a real, concrete plan for the menu system's
labels and structure to be driven from real entities, configurable
per company and per user, with the same configured names also
reflected in the real screen titles those menu items point to — plus
a dedicated editor for all of it, under Configuration.

This is a plan, not an implementation. Given the real stakes already
proven this session on foundational changes done in haste (the tier/
location restructuring took four real attempts; the AR/AP dimension
work needed two, real, direct corrections mid-build), this is written
to be reviewed and corrected *before* any code is touched, not after.

## 1. The core idea, restated plainly

The menu is genuinely just another real hierarchy, the same way
Divisions and product Categories already are — this app's own,
established "everything is an entity" principle, not yet applied to
its own navigation. Today it's a real, hardcoded, static array in
`+layout.svelte`, identical for every business, every user, every
moment — the one, real, remaining major piece of the UI that doesn't
yet follow the app's own foundational design.

## 2. What already exists that this can directly reuse

Nothing here needs new, foundational machinery — every real piece
already exists, proven this session:

- **The entity tree itself** (`current_entities`, `parent_id`) — a
  real menu section and its own real links are naturally a real,
  ordinary parent/child chain, the same shape as a Division and its
  own real, nested sub-divisions.
- **The dimension mechanism** (`setEntityLink`/`setDimensionParent`/
  `getDimensionParent`) — the real, proven way for one entity to
  reach another without disturbing its own, real, structural
  `parent_id` — directly relevant to how a real, per-business or
  per-user *override* should work (see §4), since an override must
  never be the override target's own real, structural parent.
- **The translation mechanism** (`translation_entry`) — already,
  genuinely provides "the same real concept, a different real label,
  chosen by context" — the exact, same shape a menu-label override
  needs, just keyed by business/user instead of by language.

## 3. The real, structural menu tree

A real, new top-level branch under "Application" — call it "Menu" —
containing the real, current section/link structure, faithfully
mirrored from the existing, hardcoded array:

```
Application
  Menu
    General Ledger                    (a real section)
      Journal Entries                 (a real link, → /journal)
      General Journal                 (→ /post)
      ...
    Accounts Receivable (Debtors / Sales)
      Sale                            (→ /arap/ar-sale)
      ...
```

Each real section entity and each real link entity is an ordinary,
real, named entity. A link entity's own real target route (`/journal`,
say) is stored the same, established way any other entity-to-fact
link already is in this app — most likely a real, direct field on a
dedicated `menu_link` table (mirroring how `location`/`division`/
`part` each already extend a real entity with their own, real,
type-specific columns), holding the real, literal route path and
whether it's a real, working link or a `notImplemented` placeholder.

**Display order**: a real, live, editable tree needs a genuine,
explicit ordering — `parent_id` alone doesn't carry one (two real
siblings have no defined relative order today, anywhere in this app).
This is a real, new, small, general capability the menu specifically
needs that nothing else currently does: an explicit `sort_order`
integer, most likely on the same `menu_link`/`menu_section` extension
tables, updated when an administrator reorders items in the real,
new editor (§6).

## 4. Per-company and per-user configuration

The real, global menu tree above is the real, shared *default* —
what a brand-new business, or a user with no real preferences of
their own, actually sees. Per-company or per-user customization is a
real, genuine *override* layered on top, not a real, separate,
duplicated tree per business — the same, real reason a translation
override doesn't require copying the entire vocabulary per language.

A real, new `menu_override` mechanism (in the same, established
spirit as `translation_entry`), keyed by `(menu_item, scope,
scope_id)` where `scope` is `'business'` or `'user'`:

Table: The proposed `menu_override` table's own real columns, with an example row

| menu_item | scope | scope_id | override_label | hidden |
|---|---|---|---|---|
| Profit and Loss | business | Wine Retail Business | Income Statement | false |
| Reconciliation | user | admin | (unset) | true |

A real, resolved label for a given user, at request time: look for a
real, user-scoped override first, then a real, business-scoped one,
then fall back to the entity's own real, default name — the same,
real, three-tier fallback chain the language/translation lookup
already, successfully uses (`$translations[name] ?? name`, extended
by one, real, additional layer).

**Hiding** an item (rather than renaming it) is a real, genuine,
separate, useful case on its own — a business that never does
multi-currency work might reasonably want Exchange Rates gone
entirely, without needing a real, empty label to hide it.

## 5. Screen titles reading from the same, real source

Per direct request, this is the real, more subtle half of this plan:
a business calling this "Income Statement" instead of "Profit and
Loss" should see that name *on the report itself*, not just in the
sidebar.

The real, correct mechanism: a real screen's own `<h2>` title should
be resolved through the exact, same real lookup a menu label already
is — not read from a real, separate, hardcoded string on that page at
all. Concretely, each real route already has, or would gain, a real,
associated menu-link entity (§3); the page component looks up that
same, real entity's own, resolved display name (§4's own override
chain) for its `<h2>`, rather than a literal string baked into the
Svelte file. Renaming "Profit and Loss" to "Income Statement" in the
real, new menu editor (§6) then, correctly, automatically changes
both the sidebar label *and* the report's own heading, from the one,
real, single edit — never two, separate places to keep in sync by
hand.

## 6. A real, dedicated editor, under Configuration

A new, real page — `/setup/menu`, alongside the existing Divisions
page, under the real, new "Hierarchies" heading already added there
this session — providing:

- The real, current menu tree, rendered the same, real, nested,
  drillable way Divisions already is.
- For any real business (an administrator's own, current business) or
  any real user (an administrator managing another real user's own
  preferences): a real, direct way to set a real override label, or
  toggle an item hidden, for that specific real scope.
- A real, explicit way to reorder real siblings (drag, or up/down
  controls) — writing the real, new `sort_order` value directly.
- A real, "Reset to default" action per override, removing it
  entirely rather than leaving a real, empty override row behind.

## 7. Real, open questions, not resolved here — flagged honestly rather than guessed at

- **Migration risk**: replacing the real, hardcoded array with a
  real, live, database-driven read on every real page load is a
  genuinely bigger, riskier change than it first appears — every real
  page in the app currently assumes the sidebar/top-bar structure is
  synchronous and always available. This needs its own, real,
  careful, incremental rollout (a real, new function returning the
  exact same real shape as today's hardcoded array first, verified
  identical, before any real override logic is layered on) — not a
  single, big-bang replacement.
- **Who can set a per-user override for someone else**: presumably an
  Administrator, but the real, exact permission boundary isn't
  decided here.
- **Whether `notImplemented` (a real, current, honest "this doesn't
  exist yet" marker) survives a real, per-business override at all**
  — a business shouldn't be able to "unhide" a screen that genuinely
  doesn't exist by renaming past the flag.
- **Whether reordering should be per-scope too**, or only the real,
  global order can change, with overrides limited to label/visibility
  — reordering per user, specifically, adds real, meaningful
  complexity (a user's own, real, custom order interacting with a
  business's own, different, real, custom order) that may not be
  worth the real, added complexity versus the real, likely, actual
  need.

## 8. Suggested, real order of attack, when this is actually built

1. Bring the real, current menu structure into the entity tree
   exactly as it stands today (§3), with no real behavior change at
   all yet — the live app keeps reading the hardcoded array,
   confirmed identical to the new, real, structural mirror via a
   direct, automated comparison, not by eye.
2. Switch the live app over to reading the real, new, structural
   source instead of the hardcoded array — still no real overrides or
   per-business customization yet, just confirming the real,
   structural read produces the exact, same, real, live menu as
   before.
3. Add the real, per-business/per-user override mechanism (§4) and
   wire screen titles through it (§5).
4. Build the real, dedicated editor (§6).

Each of these four is its own, real, separately verifiable,
separately committable step — the same, proven discipline already
used for the location/division restructuring this session.
